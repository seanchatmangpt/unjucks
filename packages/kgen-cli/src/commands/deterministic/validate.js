/**
 * Deterministic Validate Command
 * 
 * Validates deterministic properties of artifacts ensuring byte-for-byte reproducibility.
 * Integrates with the deterministic engine for autonomous agent systems.
 */

import { defineCommand } from 'citty';
import { createHash } from 'crypto';
import { readFileSync, existsSync, statSync } from 'fs';
import { join, resolve, extname } from 'path';
import { glob } from 'glob';

export default defineCommand({
  meta: {
    name: 'validate',
    description: 'Validate deterministic properties of artifacts'
  },
  args: {
    artifact: {
      type: 'string',
      description: 'Path to artifact file or directory to validate',
      required: true
    },
    manifest: {
      type: 'string',
      description: 'Path to generation manifest for validation',
      required: false
    },
    'check-hashes': {
      type: 'boolean',
      description: 'Validate artifact hashes against manifest',
      default: true
    },
    'check-timestamps': {
      type: 'boolean',
      description: 'Check for non-deterministic timestamps',
      default: true
    },
    'check-metadata': {
      type: 'boolean',
      description: 'Validate metadata consistency',
      default: true
    },
    'deep-scan': {
      type: 'boolean',
      description: 'Perform deep content analysis for deterministic violations',
      default: false
    },
    'output-format': {
      type: 'string',
      description: 'Output format (json|table|detailed)',
      default: 'json'
    },
    'fail-on-issues': {
      type: 'boolean',
      description: 'Exit with error code if validation issues found',
      default: true
    }
  },
  async run({ args }) {
    try {
      const startTime = this.getDeterministicTimestamp();
      const artifactPath = resolve(args.artifact);
      
      if (!existsSync(artifactPath)) {
        throw new Error(`Artifact path not found: ${artifactPath}`);
      }
      
      // Determine if validating file or directory
      const isDirectory = statSync(artifactPath).isDirectory();
      const artifacts = isDirectory ? await collectArtifacts(artifactPath) : [artifactPath];
      
      // Load manifest if provided
      let manifest = null;
      if (args.manifest) {
        const manifestPath = resolve(args.manifest);
        if (existsSync(manifestPath)) {
          manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
        }
      } else if (isDirectory) {
        // Try to find manifest in directory
        const manifestPath = join(artifactPath, 'generation-manifest.json');
        if (existsSync(manifestPath)) {
          manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
        }
      }
      
      // Validate each artifact
      const validationResults = [];
      for (const artifact of artifacts) {
        const result = await validateArtifact(artifact, manifest, args);
        validationResults.push(result);
      }
      
      // Aggregate results
      const summary = aggregateValidationResults(validationResults);
      
      const result = {
        success: summary.totalIssues === 0,
        data: {
          summary,
          artifacts: validationResults,
          validationTime: this.getDeterministicTimestamp() - startTime,
          manifest: manifest ? {
            found: true,
            path: args.manifest || join(artifactPath, 'generation-manifest.json'),
            seed: manifest.generation?.seed,
            template: manifest.generation?.template
          } : {
            found: false
          }
        },
        timestamp: this.getDeterministicDate().toISOString()
      };
      
      // Output based on format
      if (args['output-format'] === 'table') {
        outputTable(result);
      } else if (args['output-format'] === 'detailed') {
        outputDetailed(result);
      } else {
        console.log(JSON.stringify(result, null, 2));
      }
      
      // Exit with error if issues found and fail-on-issues is true
      if (args['fail-on-issues'] && summary.totalIssues > 0) {
        process.exit(1);
      }
      
      return result;
      
    } catch (error) {
      const result = {
        success: false,
        error: {
          message: error.message,
          code: 'VALIDATION_ERROR',
          artifact: args.artifact,
          timestamp: this.getDeterministicDate().toISOString()
        }
      };
      
      console.error(JSON.stringify(result, null, 2));
      process.exit(1);
    }
  }
});

/**
 * Collect all artifacts in a directory
 */
async function collectArtifacts(directory) {
  const patterns = [
    '**/*.js', '**/*.ts', '**/*.py', '**/*.md', '**/*.json', '**/*.txt',
    '**/*.html', '**/*.css', '**/*.yaml', '**/*.yml'
  ];
  
  const artifacts = [];
  for (const pattern of patterns) {
    const files = await glob(pattern, { cwd: directory, absolute: true });
    artifacts.push(...files);
  }
  
  // Remove duplicates and exclude manifest files
  return [...new Set(artifacts)].filter(f => !f.endsWith('generation-manifest.json'));
}

/**
 * Validate individual artifact
 */
async function validateArtifact(artifactPath, manifest, args) {
  const content = readFileSync(artifactPath, 'utf8');
  const actualHash = createHash('sha256').update(content).digest('hex');
  const stat = statSync(artifactPath);
  
  const issues = [];
  const checks = {
    hashMatch: null,
    timestampDeterministic: null,
    metadataConsistent: null,
    contentDeterministic: null
  };
  
  // Check hash against manifest
  if (args['check-hashes'] && manifest) {
    const manifestArtifact = manifest.artifacts?.find(a => 
      artifactPath.endsWith(a.path) || a.path.endsWith(artifactPath.split('/').pop())
    );
    
    if (manifestArtifact) {
      checks.hashMatch = actualHash === manifestArtifact.hash;
      if (!checks.hashMatch) {
        issues.push({
          type: 'hash-mismatch',
          severity: 'error',
          message: `Hash mismatch: expected ${manifestArtifact.hash}, got ${actualHash}`,
          expected: manifestArtifact.hash,
          actual: actualHash
        });
      }
    } else {
      issues.push({
        type: 'missing-manifest-entry',
        severity: 'warning',
        message: 'Artifact not found in manifest'
      });
    }
  }
  
  // Check for non-deterministic timestamps
  if (args['check-timestamps']) {
    const timestampPatterns = [
      /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/g,  // ISO timestamps
      /\d{10,13}/g,  // Unix timestamps
      /Date\s*\(\s*\)/g,  // this.getDeterministicDate() calls
      /timestamp['":\s]*['"]\d{4}-/gi  // timestamp fields
    ];
    
    let hasDynamicTimestamps = false;
    for (const pattern of timestampPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        // Check if timestamps are the deterministic fixed value
        const deterministicTimestamp = '2024-01-01T00:00:00.000Z';
        const nonDeterministic = matches.filter(m => !m.includes('2024-01-01T00:00:00.000Z'));
        
        if (nonDeterministic.length > 0) {
          hasDynamicTimestamps = true;
          issues.push({
            type: 'dynamic-timestamp',
            severity: 'warning',
            message: `Found potentially non-deterministic timestamps: ${nonDeterministic.slice(0, 3).join(', ')}`,
            matches: nonDeterministic.slice(0, 5)
          });
        }
      }
    }
    checks.timestampDeterministic = !hasDynamicTimestamps;
  }
  
  // Check metadata consistency
  if (args['check-metadata']) {
    const metadataIssues = checkMetadataConsistency(content, manifest);
    issues.push(...metadataIssues);
    checks.metadataConsistent = metadataIssues.length === 0;
  }
  
  // Deep content scan for deterministic violations
  if (args['deep-scan']) {
    const deepIssues = performDeepScan(content);
    issues.push(...deepIssues);
    checks.contentDeterministic = deepIssues.filter(i => i.severity === 'error').length === 0;
  }
  
  return {
    path: artifactPath,
    hash: actualHash,
    size: content.length,
    modified: stat.mtime.toISOString(),
    checks,
    issues,
    valid: issues.filter(i => i.severity === 'error').length === 0
  };
}

/**
 * Check metadata consistency
 */
function checkMetadataConsistency(content, manifest) {
  const issues = [];
  
  // Look for seed references
  const seedMatches = content.match(/seed['":\s]*['"](.*?)['"]/gi);
  if (seedMatches && manifest?.generation?.seed) {
    const manifestSeed = manifest.generation.seed;
    const contentSeeds = seedMatches.map(m => m.match(/['"](.*?)['"]/)?.[1]).filter(Boolean);
    
    const inconsistentSeeds = contentSeeds.filter(s => s !== manifestSeed);
    if (inconsistentSeeds.length > 0) {
      issues.push({
        type: 'seed-inconsistency',
        severity: 'error',
        message: `Content seed mismatch: manifest has ${manifestSeed}, content has ${inconsistentSeeds.join(', ')}`,
        manifestSeed,
        contentSeeds: inconsistentSeeds
      });
    }
  }
  
  // Look for version references
  const versionMatches = content.match(/version['":\s]*['"](.*?)['"]/gi);
  if (versionMatches && manifest?.generation?.version) {
    // Similar version consistency check would go here
  }
  
  return issues;
}

/**
 * Perform deep scan for deterministic violations
 */
function performDeepScan(content) {
  const issues = [];
  
  // Check for Math.random() calls
  if (content.includes('Math.random()')) {
    issues.push({
      type: 'non-deterministic-random',
      severity: 'error',
      message: 'Found Math.random() calls which are non-deterministic'
    });
  }
  
  // Check for process.hrtime or performance.now()
  const timingPatterns = ['process.hrtime', 'performance.now()', 'this.getDeterministicTimestamp()'];
  for (const pattern of timingPatterns) {
    if (content.includes(pattern)) {
      issues.push({
        type: 'non-deterministic-timing',
        severity: 'warning',
        message: `Found ${pattern} which may be non-deterministic`
      });
    }
  }
  
  // Check for file system operations with dynamic paths
  const fsPatterns = ['readFileSync', 'writeFileSync', 'existsSync'];
  for (const pattern of fsPatterns) {
    if (content.includes(pattern)) {
      issues.push({
        type: 'file-system-access',
        severity: 'info',
        message: `Found ${pattern} - ensure file paths are deterministic`
      });
    }
  }
  
  return issues;
}

/**
 * Aggregate validation results
 */
function aggregateValidationResults(results) {
  const summary = {
    totalArtifacts: results.length,
    validArtifacts: results.filter(r => r.valid).length,
    invalidArtifacts: results.filter(r => !r.valid).length,
    totalIssues: results.reduce((sum, r) => sum + r.issues.length, 0),
    issuesBySeverity: {
      error: results.reduce((sum, r) => sum + r.issues.filter(i => i.severity === 'error').length, 0),
      warning: results.reduce((sum, r) => sum + r.issues.filter(i => i.severity === 'warning').length, 0),
      info: results.reduce((sum, r) => sum + r.issues.filter(i => i.severity === 'info').length, 0)
    },
    checksStatus: {
      hashMatches: results.filter(r => r.checks.hashMatch === true).length,
      timestampsDeterministic: results.filter(r => r.checks.timestampDeterministic === true).length,
      metadataConsistent: results.filter(r => r.checks.metadataConsistent === true).length,
      contentDeterministic: results.filter(r => r.checks.contentDeterministic === true).length
    }
  };
  
  return summary;
}

/**
 * Output results in table format
 */
function outputTable(result) {
  console.log('\n=== Deterministic Validation Results ===');
  console.log(`Total Artifacts: ${result.data.summary.totalArtifacts}`);
  console.log(`Valid: ${result.data.summary.validArtifacts}`);
  console.log(`Invalid: ${result.data.summary.invalidArtifacts}`);
  console.log(`Total Issues: ${result.data.summary.totalIssues}`);
  
  console.log('\nIssues by Severity:');
  console.log(`  Errors: ${result.data.summary.issuesBySeverity.error}`);
  console.log(`  Warnings: ${result.data.summary.issuesBySeverity.warning}`);
  console.log(`  Info: ${result.data.summary.issuesBySeverity.info}`);
  
  if (result.data.summary.totalIssues > 0) {
    console.log('\nArtifacts with Issues:');
    result.data.artifacts.filter(a => a.issues.length > 0).forEach(artifact => {
      console.log(`\n${artifact.path}:`);
      artifact.issues.forEach(issue => {
        console.log(`  ${issue.severity.toUpperCase()}: ${issue.message}`);
      });
    });
  }
}

/**
 * Output detailed results
 */
function outputDetailed(result) {
  outputTable(result);
  console.log('\n=== Detailed Results ===');
  console.log(JSON.stringify(result, null, 2));
}