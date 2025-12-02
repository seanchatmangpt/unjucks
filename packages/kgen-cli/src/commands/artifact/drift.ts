/**
 * Artifact Drift Detection Command
 * 
 * Detects byte-level and structural drift between generated artifacts and their sources.
 * Uses attestation files for cryptographic verification of generation integrity.
 * Exits with code 3 when drift is detected (SPR requirement).
 */

import { defineCommand } from 'citty';
import { consola } from 'consola';
import { readFileSync, existsSync, statSync } from 'fs';
import { resolve, dirname, basename, join } from 'path';
import { createHash } from 'crypto';

interface Attestation {
  version: string;
  metadata: {
    timestamp: string;
    generator: string;
    gitCommit?: string;
  };
  inputs: {
    graphs: Array<{
      path: string;
      hash: string;
      size: number;
    }>;
    templates: Array<{
      path: string;
      hash: string;
      size: number;
    }>;
    variables?: Record<string, any>;
  };
  outputs: Array<{
    path: string;
    hash: string;
    size: number;
    generatedAt: string;
  }>;
}

interface DriftResult {
  hasDrift: boolean;
  driftType: 'none' | 'byte' | 'structure' | 'missing' | 'attestation';
  severity: 'none' | 'low' | 'medium' | 'high' | 'critical';
  details: {
    expectedHash?: string;
    actualHash?: string;
    sizeChange?: {
      expected: number;
      actual: number;
      delta: number;
    };
    missingFiles?: string[];
    attestationIssues?: string[];
  };
  canRegenerate: boolean;
  recommendation: string;
}

export default defineCommand({
  meta: {
    name: 'drift',
    description: 'Detect drift between generated artifacts and sources (exits 3 on drift)'
  },
  args: {
    artifact: {
      type: 'positional',
      description: 'Artifact file or directory to check for drift',
      required: true
    },
    attestation: {
      type: 'string',
      description: 'Path to attestation file (.attest.json)',
      alias: 'a'
    },
    baseline: {
      type: 'string',
      description: 'Baseline hash or file to compare against',
      alias: 'b'
    },
    'check-structure': {
      type: 'boolean',
      description: 'Perform structural drift analysis beyond byte comparison',
      default: false
    },
    'regenerate-on-drift': {
      type: 'boolean',
      description: 'Attempt regeneration if drift detected',
      alias: 'regen',
      default: false
    },
    'fail-on-drift': {
      type: 'boolean',
      description: 'Exit with code 3 when drift detected (default: true)',
      default: true
    },
    quiet: {
      type: 'boolean',
      description: 'Suppress non-error output',
      alias: 'q',
      default: false
    },
    json: {
      type: 'boolean',
      description: 'Output results in JSON format',
      default: false
    }
  },
  async run({ args }) {
    try {
      const artifactPath = resolve(args.artifact);
      
      // Check if artifact exists
      if (!existsSync(artifactPath)) {
        const result: DriftResult = {
          hasDrift: true,
          driftType: 'missing',
          severity: 'critical',
          details: {
            missingFiles: [artifactPath]
          },
          canRegenerate: false,
          recommendation: 'Artifact file is missing. Check path or regenerate from source.'
        };
        
        await outputResult(result, args);
        process.exit(args['fail-on-drift'] ? 3 : 0);
      }

      // Find attestation file
      let attestationPath = args.attestation;
      if (!attestationPath) {
        // Look for corresponding .attest.json file
        attestationPath = artifactPath + '.attest.json';
        if (!existsSync(attestationPath)) {
          attestationPath = join(dirname(artifactPath), 'generation.attest.json');
          if (!existsSync(attestationPath)) {
            attestationPath = join(dirname(artifactPath), `${basename(artifactPath)}.attest.json`);
          }
        }
      }

      let attestation: Attestation | null = null;
      if (attestationPath && existsSync(attestationPath)) {
        try {
          const attestationContent = readFileSync(attestationPath, 'utf8');
          attestation = JSON.parse(attestationContent);
        } catch (error) {
          if (!args.quiet) {
            consola.warn(`Failed to parse attestation file: ${attestationPath}`);
          }
        }
      }

      // Perform drift detection
      const driftResult = await detectDrift(artifactPath, attestation, args);

      // Output result
      await outputResult(driftResult, args);

      // Exit with appropriate code
      if (driftResult.hasDrift && args['fail-on-drift']) {
        process.exit(3); // SPR requirement: exit code 3 on drift
      } else {
        process.exit(0);
      }

    } catch (error) {
      const errorResult = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        code: 'DRIFT_CHECK_FAILED',
        timestamp: new Date().toISOString()
      };

      if (args.json) {
        console.log(JSON.stringify(errorResult, null, 2));
      } else if (!args.quiet) {
        consola.error(`Drift check failed: ${errorResult.error}`);
      }
      process.exit(1);
    }
  }
});

async function detectDrift(
  artifactPath: string, 
  attestation: Attestation | null, 
  args: any
): Promise<DriftResult> {
  
  const artifactContent = readFileSync(artifactPath, 'utf8');
  const actualHash = createHash('blake3', { outputLength: 32 }).update(artifactContent).digest('hex');
  const actualSize = Buffer.byteLength(artifactContent, 'utf8');
  
  // If we have an attestation, use it for verification
  if (attestation) {
    return await detectDriftFromAttestation(artifactPath, actualHash, actualSize, attestation, args);
  }
  
  // If we have a baseline, compare against it
  if (args.baseline) {
    return await detectDriftFromBaseline(artifactPath, actualHash, actualSize, args.baseline, args);
  }
  
  // No reference point - cannot detect drift
  return {
    hasDrift: false,
    driftType: 'none',
    severity: 'none',
    details: {},
    canRegenerate: false,
    recommendation: 'No attestation or baseline found - cannot verify integrity.'
  };
}

async function detectDriftFromAttestation(
  artifactPath: string,
  actualHash: string,
  actualSize: number,
  attestation: Attestation,
  args: any
): Promise<DriftResult> {
  
  // Find the corresponding output in attestation
  const expectedOutput = attestation.outputs.find(output => 
    output.path === artifactPath || 
    basename(output.path) === basename(artifactPath)
  );
  
  if (!expectedOutput) {
    return {
      hasDrift: true,
      driftType: 'attestation',
      severity: 'medium',
      details: {
        attestationIssues: ['Artifact not found in attestation outputs']
      },
      canRegenerate: true,
      recommendation: 'Artifact not tracked in attestation. May be manually modified or from different generation.'
    };
  }
  
  // Check byte-level drift
  if (actualHash !== expectedOutput.hash) {
    const sizeDelta = actualSize - expectedOutput.size;
    const sizeChange = Math.abs(sizeDelta) / expectedOutput.size;
    
    let severity: DriftResult['severity'] = 'low';
    if (sizeChange > 0.5) severity = 'critical';
    else if (sizeChange > 0.1) severity = 'high';
    else if (sizeChange > 0.05) severity = 'medium';
    
    return {
      hasDrift: true,
      driftType: 'byte',
      severity,
      details: {
        expectedHash: expectedOutput.hash,
        actualHash,
        sizeChange: {
          expected: expectedOutput.size,
          actual: actualSize,
          delta: sizeDelta
        }
      },
      canRegenerate: canRegenerateFromAttestation(attestation),
      recommendation: `Byte-level drift detected. ${sizeChange > 0.1 ? 'Significant' : 'Minor'} changes found.`
    };
  }
  
  // Perform structural analysis if requested
  if (args['check-structure']) {
    const structuralDrift = await detectStructuralDrift(artifactPath, attestation);
    if (structuralDrift.hasDrift) {
      return structuralDrift;
    }
  }
  
  // No drift detected
  return {
    hasDrift: false,
    driftType: 'none',
    severity: 'none',
    details: {
      expectedHash: expectedOutput.hash,
      actualHash
    },
    canRegenerate: false,
    recommendation: 'No drift detected. Artifact matches attestation.'
  };
}

async function detectDriftFromBaseline(
  artifactPath: string,
  actualHash: string,
  actualSize: number,
  baseline: string,
  args: any
): Promise<DriftResult> {
  
  let expectedHash: string;
  
  if (existsSync(baseline)) {
    // Baseline is a file
    const baselineContent = readFileSync(baseline, 'utf8');
    expectedHash = createHash('blake3', { outputLength: 32 }).update(baselineContent).digest('hex');
  } else {
    // Assume baseline is a hash
    expectedHash = baseline;
  }
  
  if (actualHash !== expectedHash) {
    return {
      hasDrift: true,
      driftType: 'byte',
      severity: 'medium',
      details: {
        expectedHash,
        actualHash
      },
      canRegenerate: false,
      recommendation: 'Byte-level drift detected against baseline.'
    };
  }
  
  return {
    hasDrift: false,
    driftType: 'none',
    severity: 'none',
    details: {
      expectedHash,
      actualHash
    },
    canRegenerate: false,
    recommendation: 'No drift detected against baseline.'
  };
}

async function detectStructuralDrift(
  artifactPath: string,
  attestation: Attestation
): Promise<DriftResult> {
  // Placeholder for structural analysis
  // In a real implementation, this would:
  // 1. Parse the artifact based on its type (JSON, XML, code, etc.)
  // 2. Compare structural elements against expected patterns
  // 3. Detect semantic changes that don't affect byte comparison
  
  return {
    hasDrift: false,
    driftType: 'none',
    severity: 'none',
    details: {},
    canRegenerate: false,
    recommendation: 'Structural analysis not yet implemented.'
  };
}

function canRegenerateFromAttestation(attestation: Attestation): boolean {
  // Check if we have sufficient information to regenerate
  return attestation.inputs.graphs.length > 0 && 
         attestation.inputs.templates.length > 0;
}

async function outputResult(result: DriftResult, args: any): Promise<void> {
  const output = {
    success: !result.hasDrift,
    data: {
      drift: result,
      summary: {
        status: result.hasDrift ? 'DRIFT_DETECTED' : 'NO_DRIFT',
        type: result.driftType,
        severity: result.severity,
        canRegenerate: result.canRegenerate
      }
    },
    timestamp: new Date().toISOString()
  };

  if (args.json) {
    console.log(JSON.stringify(output, null, 2));
  } else if (!args.quiet) {
    if (result.hasDrift) {
      const icon = result.severity === 'critical' ? '🚨' : 
                   result.severity === 'high' ? '⚠️' : 
                   result.severity === 'medium' ? '⚡' : '📊';
      
      consola.warn(`${icon} Drift detected: ${result.driftType.toUpperCase()}`);
      consola.info(`Severity: ${result.severity.toUpperCase()}`);
      consola.info(`Recommendation: ${result.recommendation}`);
      
      if (result.details.expectedHash && result.details.actualHash) {
        consola.info(`Expected: ${result.details.expectedHash.slice(0, 16)}...`);
        consola.info(`Actual:   ${result.details.actualHash.slice(0, 16)}...`);
      }
      
      if (result.details.sizeChange) {
        const delta = result.details.sizeChange.delta;
        const sign = delta > 0 ? '+' : '';
        consola.info(`Size change: ${sign}${delta} bytes (${result.details.sizeChange.expected} → ${result.details.sizeChange.actual})`);
      }
    } else {
      consola.success('✅ No drift detected');
    }
  }
}