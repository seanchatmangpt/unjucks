#!/usr/bin/env node

import { Command } from 'commander';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { createHash, createVerify } from 'crypto';
import chalk from 'chalk';

/**
 * Provenance validation engine
 */
class ProvenanceValidator {
  constructor() {
    this.attestations = new Map();
    this.validationResults = {
      verified: [],
      failed: [],
      warnings: []
    };
  }

  /**
   * Load attestation file
   * @param {string} attestationPath - Path to .attest.json file
   * @returns {Object} Parsed attestation data
   */
  loadAttestation(attestationPath) {
    if (!existsSync(attestationPath)) {
      throw new Error(`Attestation file not found: ${attestationPath}`);
    }

    try {
      const content = readFileSync(attestationPath, 'utf8');
      const attestation = JSON.parse(content);
      
      // Basic structure validation
      this.validateAttestationStructure(attestation);
      
      return attestation;
    } catch (error) {
      throw new Error(`Invalid attestation file: ${error.message}`);
    }
  }

  /**
   * Validate attestation file structure
   * @param {Object} attestation - Attestation data
   */
  validateAttestationStructure(attestation) {
    const required = ['version', 'timestamp', 'subject', 'predicate', 'materials', 'byproducts'];
    
    for (const field of required) {
      if (!attestation.hasOwnProperty(field)) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    if (!attestation.predicateType || attestation.predicateType !== 'https://in-toto.io/Statement/v1') {
      throw new Error('Invalid predicate type - must be in-toto Statement v1');
    }

    if (!Array.isArray(attestation.materials)) {
      throw new Error('Materials must be an array');
    }

    if (!Array.isArray(attestation.byproducts)) {
      throw new Error('Byproducts must be an array');
    }
  }

  /**
   * Verify file integrity against attestation
   * @param {string} filePath - File to verify
   * @param {Object} expectedArtifact - Expected artifact info from attestation
   * @returns {Object} Verification result
   */
  verifyFileIntegrity(filePath, expectedArtifact) {
    const result = {
      valid: true,
      file: filePath,
      errors: [],
      warnings: []
    };

    if (!existsSync(filePath)) {
      result.valid = false;
      result.errors.push('File not found');
      return result;
    }

    try {
      const content = readFileSync(filePath);
      const actualHash = createHash('sha256').update(content).digest('hex');
      
      // Check hash
      if (expectedArtifact.digest && expectedArtifact.digest.sha256) {
        if (actualHash !== expectedArtifact.digest.sha256) {
          result.valid = false;
          result.errors.push(
            `Hash mismatch - Expected: ${expectedArtifact.digest.sha256.substring(0, 16)}..., ` +
            `Actual: ${actualHash.substring(0, 16)}...`
          );
        }
      } else {
        result.warnings.push('No hash digest found in attestation');
      }

      // Check size if available
      if (expectedArtifact.size) {
        const actualSize = content.length;
        if (actualSize !== expectedArtifact.size) {
          result.valid = false;
          result.errors.push(
            `Size mismatch - Expected: ${expectedArtifact.size} bytes, Actual: ${actualSize} bytes`
          );
        }
      }

      // Check media type if available
      if (expectedArtifact.mediaType) {
        const extension = filePath.split('.').pop().toLowerCase();
        const expectedExtensions = {
          'application/x-turtle': ['ttl', 'turtle'],
          'text/n3': ['n3'],
          'application/ld+json': ['jsonld'],
          'application/rdf+xml': ['rdf', 'xml'],
          'text/plain': ['txt'],
          'application/json': ['json']
        };

        const validExtensions = expectedExtensions[expectedArtifact.mediaType] || [];
        if (validExtensions.length > 0 && !validExtensions.includes(extension)) {
          result.warnings.push(
            `Media type mismatch - Expected: ${expectedArtifact.mediaType}, File extension: .${extension}`
          );
        }
      }

    } catch (error) {
      result.valid = false;
      result.errors.push(`Verification error: ${error.message}`);
    }

    return result;
  }

  /**
   * Verify cryptographic signature if present
   * @param {Object} attestation - Attestation data
   * @returns {Object} Signature verification result
   */
  verifySignature(attestation) {
    const result = {
      valid: true,
      signed: false,
      errors: [],
      warnings: []
    };

    if (!attestation.envelope || !attestation.envelope.signatures) {
      result.warnings.push('No cryptographic signatures found');
      return result;
    }

    result.signed = true;

    try {
      for (const signature of attestation.envelope.signatures) {
        if (!signature.sig || !signature.keyid) {
          result.valid = false;
          result.errors.push('Invalid signature format');
          continue;
        }

        // Note: In a real implementation, you would:
        // 1. Retrieve the public key using signature.keyid
        // 2. Verify the signature against the payload
        // 3. Check certificate chain and trust
        
        // For now, we just check the structure
        result.warnings.push(`Signature verification requires public key for keyid: ${signature.keyid}`);
      }
    } catch (error) {
      result.valid = false;
      result.errors.push(`Signature verification failed: ${error.message}`);
    }

    return result;
  }

  /**
   * Verify provenance chain completeness
   * @param {Object} attestation - Attestation data
   * @returns {Object} Chain verification result
   */
  verifyProvenanceChain(attestation) {
    const result = {
      valid: true,
      errors: [],
      warnings: [],
      chainLength: 0,
      materials: attestation.materials?.length || 0,
      byproducts: attestation.byproducts?.length || 0
    };

    // Check for required provenance metadata
    if (!attestation.predicate.builder) {
      result.warnings.push('No builder information in provenance');
    }

    if (!attestation.predicate.recipe) {
      result.warnings.push('No recipe/process information in provenance');
    }

    // Verify materials chain
    if (attestation.materials && attestation.materials.length > 0) {
      attestation.materials.forEach((material, index) => {
        if (!material.uri) {
          result.warnings.push(`Material ${index} missing URI`);
        }
        if (!material.digest) {
          result.warnings.push(`Material ${index} missing digest`);
        }
      });
    } else {
      result.warnings.push('No input materials tracked');
    }

    // Verify byproducts
    if (attestation.byproducts && attestation.byproducts.length > 0) {
      attestation.byproducts.forEach((byproduct, index) => {
        if (!byproduct.uri) {
          result.warnings.push(`Byproduct ${index} missing URI`);
        }
        if (!byproduct.digest) {
          result.warnings.push(`Byproduct ${index} missing digest`);
        }
      });
    }

    // Check timestamp validity
    if (attestation.timestamp) {
      const attestationTime = new Date(attestation.timestamp);
      const now = new Date();
      
      if (attestationTime > now) {
        result.valid = false;
        result.errors.push('Attestation timestamp is in the future');
      }
      
      // Check if attestation is too old (configurable threshold)
      const ageInDays = (now - attestationTime) / (1000 * 60 * 60 * 24);
      if (ageInDays > 365) {
        result.warnings.push(`Attestation is ${Math.round(ageInDays)} days old`);
      }
    }

    return result;
  }

  /**
   * Verify complete provenance for a set of artifacts
   * @param {string} attestationPath - Path to attestation file
   * @param {Array} artifactPaths - Paths to artifacts to verify
   * @returns {Object} Complete verification results
   */
  async verifyProvenance(attestationPath, artifactPaths) {
    const results = {
      success: true,
      attestation: {
        file: attestationPath,
        valid: false,
        signed: false
      },
      artifacts: [],
      provenance: {},
      signature: {},
      summary: {
        totalArtifacts: artifactPaths.length,
        verifiedArtifacts: 0,
        failedArtifacts: 0,
        warnings: 0
      }
    };

    try {
      // Load and validate attestation
      console.log(chalk.blue(`📋 Loading attestation: ${attestationPath}`));
      const attestation = this.loadAttestation(attestationPath);
      results.attestation.valid = true;
      
      console.log(chalk.green('  ✓ Attestation structure valid'));
      console.log(chalk.gray(`    Version: ${attestation.version}`));
      console.log(chalk.gray(`    Timestamp: ${attestation.timestamp}`));
      console.log(chalk.gray(`    Materials: ${attestation.materials?.length || 0}`));
      console.log(chalk.gray(`    Byproducts: ${attestation.byproducts?.length || 0}`));

      // Verify cryptographic signature
      const signatureResult = this.verifySignature(attestation);
      results.signature = signatureResult;
      results.attestation.signed = signatureResult.signed;
      
      if (signatureResult.signed) {
        console.log(signatureResult.valid ? 
          chalk.green('  ✓ Signatures present') : 
          chalk.red('  ✗ Signature verification failed')
        );
      } else {
        console.log(chalk.yellow('  ⚠ No cryptographic signatures'));
      }

      // Verify provenance chain
      const chainResult = this.verifyProvenanceChain(attestation);
      results.provenance = chainResult;
      
      console.log(chainResult.valid ? 
        chalk.green('  ✓ Provenance chain valid') : 
        chalk.red('  ✗ Provenance chain issues')
      );

      // Verify each artifact
      console.log(chalk.blue('\n🔍 Verifying Artifacts:'));
      console.log(chalk.blue('━'.repeat(25)));

      for (const artifactPath of artifactPaths) {
        // Find matching artifact in attestation
        const expectedArtifact = [...(attestation.materials || []), ...(attestation.byproducts || [])]
          .find(artifact => artifact.uri === artifactPath || artifact.uri.endsWith(artifactPath));

        if (!expectedArtifact) {
          results.artifacts.push({
            file: artifactPath,
            valid: false,
            errors: ['Artifact not found in attestation'],
            warnings: []
          });
          results.summary.failedArtifacts++;
          console.log(chalk.red(`  ✗ ${artifactPath} - Not in attestation`));
          continue;
        }

        const artifactResult = this.verifyFileIntegrity(artifactPath, expectedArtifact);
        results.artifacts.push(artifactResult);

        if (artifactResult.valid) {
          results.summary.verifiedArtifacts++;
          console.log(chalk.green(`  ✓ ${artifactPath}`));
        } else {
          results.summary.failedArtifacts++;
          results.success = false;
          console.log(chalk.red(`  ✗ ${artifactPath}`));
          artifactResult.errors.forEach(error => {
            console.log(chalk.red(`    ${error}`));
          });
        }

        artifactResult.warnings.forEach(warning => {
          console.log(chalk.yellow(`    ⚠ ${warning}`));
          results.summary.warnings++;
        });
      }

    } catch (error) {
      results.success = false;
      results.attestation.error = error.message;
      console.error(chalk.red(`Provenance verification failed: ${error.message}`));
    }

    return results;
  }
}

/**
 * Create validate provenance command
 * @returns {Command} The configured validate provenance command
 */
export function createValidateProvenanceCommand() {
  return new Command('provenance')
    .description('Verify provenance and integrity of generated artifacts using attestations')
    .option('-a, --attestation <file>', 'Path to .attest.json attestation file', '.attest.json')
    .option('-f, --artifacts <files...>', 'Specific artifact files to verify')
    .option('--auto-discover', 'Auto-discover artifacts from attestation', true)
    .option('--json', 'Output results in JSON format')
    .option('-v, --verbose', 'Show detailed verification information')
    .option('--exit-code', 'Exit with non-zero code if verification fails')
    .option('--require-signature', 'Require cryptographic signatures', false)
    .action(async (options) => {
      try {
        const validator = new ProvenanceValidator();
        let artifactPaths = options.artifacts || [];

        // Auto-discover artifacts if none specified
        if (artifactPaths.length === 0 && options.autoDiscover) {
          try {
            const attestation = validator.loadAttestation(resolve(options.attestation));
            artifactPaths = [...(attestation.materials || []), ...(attestation.byproducts || [])]
              .map(artifact => artifact.uri)
              .filter(uri => typeof uri === 'string');
            
            console.log(chalk.blue(`📋 Auto-discovered ${artifactPaths.length} artifacts from attestation`));
          } catch (error) {
            console.error(chalk.red('Could not auto-discover artifacts:'), error.message);
            process.exit(1);
          }
        }

        if (artifactPaths.length === 0) {
          console.error(chalk.red('No artifacts specified for verification'));
          process.exit(1);
        }

        console.log(chalk.blue('🔐 Provenance Verification'));
        console.log(chalk.blue('━'.repeat(30)));

        const results = await validator.verifyProvenance(
          resolve(options.attestation),
          artifactPaths
        );

        // Display summary
        console.log(chalk.blue('\n📊 Verification Summary'));
        console.log(chalk.blue('━'.repeat(25)));
        console.log(`Attestation: ${results.attestation.valid ? chalk.green('Valid') : chalk.red('Invalid')}`);
        console.log(`Signatures: ${results.attestation.signed ? chalk.green('Present') : chalk.yellow('None')}`);
        console.log(`Verified artifacts: ${chalk.green(results.summary.verifiedArtifacts)}`);
        console.log(`Failed artifacts: ${chalk.red(results.summary.failedArtifacts)}`);
        console.log(`Warnings: ${chalk.yellow(results.summary.warnings)}`);

        // Check required signature constraint
        if (options.requireSignature && !results.attestation.signed) {
          console.log(chalk.red('\n❌ Required cryptographic signatures missing'));
          results.success = false;
        }

        if (results.success) {
          console.log(chalk.green('\n🎉 Provenance verification successful'));
        } else {
          console.log(chalk.red('\n❌ Provenance verification failed'));
        }

        // JSON output
        if (options.json) {
          console.log(chalk.blue('\n📄 JSON Results:'));
          console.log(JSON.stringify(results, null, 2));
        }

        if (options.exitCode && !results.success) {
          process.exit(1);
        }

      } catch (error) {
        console.error(chalk.red('Provenance verification failed:'), error.message);
        if (options.exitCode) {
          process.exit(1);
        }
      }
    });
}