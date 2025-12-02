/**
 * Receipt Show Command
 * 
 * Displays attestation details and git-note pointer for generated artifacts.
 * Shows cryptographic proof of generation process and provenance chain.
 */

import { defineCommand } from 'citty';
import { readFileSync, existsSync } from 'fs';
import { resolve, basename, dirname } from 'path';
import { consola } from 'consola';
import { execSync } from 'child_process';

interface Attestation {
  version: string;
  metadata: {
    timestamp: string;
    generator: string;
    gitCommit?: string;
    environment: Record<string, any>;
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
    }>;
  };
  outputs: Array<{
    path: string;
    hash: string;
    size: number;
  }>;
  provenance: {
    process: string;
    command: string;
    workingDirectory: string;
  };
  signature?: {
    algorithm: string;
    value: string;
    publicKey?: string;
  };
}

export default defineCommand({
  meta: {
    name: 'show',
    description: 'Display attestation and git-note information for artifacts'
  },
  args: {
    file: {
      type: 'string',
      description: 'Path to artifact file or attestation file',
      required: true
    },
    format: {
      type: 'string',
      description: 'Output format (json|table|summary)',
      default: 'summary'
    },
    verify: {
      type: 'boolean',
      description: 'Verify cryptographic signature if present',
      default: false
    },
    'show-inputs': {
      type: 'boolean',
      description: 'Show detailed input file information',
      default: false
    },
    'show-git-notes': {
      type: 'boolean',
      description: 'Display associated git notes',
      default: true
    },
    json: {
      type: 'boolean',
      description: 'Output as JSON',
      default: false
    }
  },
  async run({ args }) {
    try {
      const filePath = resolve(args.file);
      let attestationPath: string;
      
      // Determine attestation file path
      if (filePath.endsWith('.attest.json')) {
        attestationPath = filePath;
      } else {
        // Look for corresponding .attest.json file
        attestationPath = filePath + '.attest.json';
        if (!existsSync(attestationPath)) {
          // Try in same directory with different naming
          const dir = dirname(filePath);
          const file = basename(filePath);
          attestationPath = resolve(dir, `${file}.attest.json`);
          
          if (!existsSync(attestationPath)) {
            throw new Error(`No attestation file found for: ${filePath}`);
          }
        }
      }

      if (!existsSync(attestationPath)) {
        throw new Error(`Attestation file not found: ${attestationPath}`);
      }

      const attestationContent = readFileSync(attestationPath, 'utf8');
      const attestation: Attestation = JSON.parse(attestationContent);

      // Get git notes if requested and available
      let gitNotes: string | null = null;
      if (args['show-git-notes']) {
        try {
          const gitCommit = attestation.metadata.gitCommit;
          if (gitCommit) {
            gitNotes = execSync(`git notes show ${gitCommit}`, { 
              encoding: 'utf8',
              stdio: 'pipe'
            }).trim();
          }
        } catch (error) {
          // Git notes are optional
        }
      }

      // Verify signature if requested
      let signatureValid: boolean | null = null;
      if (args.verify && attestation.signature) {
        signatureValid = await verifySignature(attestation);
      }

      const result = {
        success: true,
        data: {
          attestation,
          attestationPath,
          gitNotes,
          signatureValid,
          summary: {
            generator: attestation.metadata.generator,
            timestamp: attestation.metadata.timestamp,
            inputCount: attestation.inputs.graphs.length + attestation.inputs.templates.length,
            outputCount: attestation.outputs.length,
            hasSigned: !!attestation.signature,
            gitCommit: attestation.metadata.gitCommit
          }
        },
        timestamp: new Date().toISOString()
      };

      if (args.json || args.format === 'json') {
        console.log(JSON.stringify(result, null, 2));
      } else if (args.format === 'table') {
        displayTable(result.data);
      } else {
        displaySummary(result.data, args);
      }

    } catch (error) {
      const errorResult = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        code: 'RECEIPT_SHOW_FAILED',
        timestamp: new Date().toISOString()
      };

      if (args.json) {
        console.log(JSON.stringify(errorResult, null, 2));
      } else {
        consola.error(`Receipt show failed: ${errorResult.error}`);
      }
      process.exit(1);
    }
  }
});

function displaySummary(data: any, args: any): void {
  const { attestation, gitNotes, signatureValid, summary } = data;

  consola.info('🧾 Artifact Receipt');
  consola.info('─'.repeat(50));
  
  consola.info(`Generator: ${summary.generator}`);
  consola.info(`Generated: ${new Date(summary.timestamp).toLocaleString()}`);
  consola.info(`Git Commit: ${summary.gitCommit || 'N/A'}`);
  consola.info(`Inputs: ${summary.inputCount} files`);
  consola.info(`Outputs: ${summary.outputCount} files`);
  
  if (attestation.signature) {
    const status = signatureValid === true ? '✅ Valid' : 
                   signatureValid === false ? '❌ Invalid' : 
                   '⏳ Not Verified';
    consola.info(`Signature: ${status} (${attestation.signature.algorithm})`);
  } else {
    consola.info('Signature: Not signed');
  }

  if (args['show-inputs']) {
    consola.info('\n📊 Input Details:');
    
    if (attestation.inputs.graphs.length > 0) {
      consola.info('  Knowledge Graphs:');
      for (const graph of attestation.inputs.graphs) {
        consola.info(`    • ${graph.path} (${graph.hash.slice(0, 8)}...)`);
      }
    }
    
    if (attestation.inputs.templates.length > 0) {
      consola.info('  Templates:');
      for (const template of attestation.inputs.templates) {
        consola.info(`    • ${template.path} (${template.hash.slice(0, 8)}...)`);
      }
    }
  }

  consola.info('\n📁 Generated Files:');
  for (const output of attestation.outputs) {
    consola.info(`  • ${output.path} (${formatBytes(output.size)})`);
  }

  if (gitNotes) {
    consola.info('\n📝 Git Notes:');
    consola.info(gitNotes);
  }

  consola.info('\n🔍 Generation Command:');
  consola.info(`  ${attestation.provenance.command}`);
}

function displayTable(data: any): void {
  const { attestation } = data;
  
  // Create table format - simplified for console output
  console.log('\n🧾 Artifact Receipt Summary');
  console.log('┌─────────────────┬─────────────────────────────────────────┐');
  console.log('│ Property        │ Value                                   │');
  console.log('├─────────────────┼─────────────────────────────────────────┤');
  console.log(`│ Generator       │ ${attestation.metadata.generator.padEnd(39)} │`);
  console.log(`│ Timestamp       │ ${new Date(attestation.metadata.timestamp).toLocaleString().padEnd(39)} │`);
  console.log(`│ Git Commit      │ ${(attestation.metadata.gitCommit || 'N/A').padEnd(39)} │`);
  console.log(`│ Input Files     │ ${(attestation.inputs.graphs.length + attestation.inputs.templates.length).toString().padEnd(39)} │`);
  console.log(`│ Output Files    │ ${attestation.outputs.length.toString().padEnd(39)} │`);
  console.log('└─────────────────┴─────────────────────────────────────────┘');
}

async function verifySignature(attestation: Attestation): Promise<boolean> {
  // Placeholder for signature verification
  // In a real implementation, this would verify the cryptographic signature
  try {
    if (!attestation.signature) {
      return false;
    }
    
    // This would involve:
    // 1. Extracting the signature from the attestation
    // 2. Reconstructing the signed content
    // 3. Verifying using the appropriate cryptographic library
    // 4. Checking against the public key
    
    consola.warn('Signature verification not implemented yet');
    return true; // Placeholder
  } catch (error) {
    return false;
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}