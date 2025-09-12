/**
 * Enhanced Attestation CLI Commands
 * 
 * Provides CLI interface for the new JOSE/JWS attestation system
 */

import { EnhancedAttestationGenerator } from '../security/enhanced-attestation-generator.js';
import { promises as fs } from 'fs';
import path from 'path';
import consola from 'consola';

const logger = consola.withTag('attestation-cli');

/**
 * CLI command to generate enhanced attestations
 */
export async function generateAttestationCommand(artifactPath, options = {}) {
  try {
    logger.info(`Generating enhanced attestation for ${path.basename(artifactPath)}...`);
    
    // Initialize the enhanced generator
    const generator = new EnhancedAttestationGenerator({
      defaultFormat: options.format || 'comprehensive',
      keyStorePath: options.keyStorePath || './keys',
      createSidecarFiles: options.sidecarFiles !== false
    });
    
    await generator.initialize();
    
    // Generate attestation
    const attestation = await generator.generateAttestation(artifactPath, {
      operationId: options.operationId,
      templatePath: options.templatePath,
      generatedAt: options.timestamp ? new Date(options.timestamp).toISOString() : undefined
    }, {
      format: options.format
    });
    
    // Output results
    if (options.output) {
      await fs.writeFile(options.output, JSON.stringify(attestation, null, 2));
      logger.success(`Attestation saved to: ${options.output}`);
    } else {
      console.log(JSON.stringify(attestation, null, 2));
    }
    
    // Show summary
    logger.info('Attestation Summary:');
    logger.info(`  Format: ${attestation.format}`);
    if (attestation.signatures) {
      logger.info(`  JWS Signatures: ${Object.keys(attestation.signatures).join(', ')}`);
    }
    if (attestation.legacy?.signature) {
      logger.info(`  Legacy Hash: ${attestation.legacy.signature.value.substring(0, 16)}...`);
    }
    
    return attestation;
    
  } catch (error) {
    logger.error('Failed to generate attestation:', error);
    throw error;
  }
}

/**
 * CLI command to verify attestations
 */
export async function verifyAttestationCommand(attestationPath, options = {}) {
  try {
    logger.info(`Verifying attestation: ${path.basename(attestationPath)}...`);
    
    const generator = new EnhancedAttestationGenerator({
      keyStorePath: options.keyStorePath || './keys'
    });
    
    await generator.initialize();
    
    // Verify attestation
    const result = await generator.verifyAttestation(attestationPath, {
      crossVerify: options.crossVerify
    });
    
    // Output results
    if (options.output) {
      await fs.writeFile(options.output, JSON.stringify(result, null, 2));
      logger.success(`Verification result saved to: ${options.output}`);
    }
    
    // Show summary
    const status = result.valid ? '✅ VALID' : '❌ INVALID';
    logger.info(`Verification Result: ${status}`);
    
    if (result.details) {
      logger.info('Details:');
      Object.entries(result.details).forEach(([key, value]) => {
        const icon = value === true ? '✅' : value === false ? '❌' : 'ℹ️';
        logger.info(`  ${icon} ${key}: ${value}`);
      });
    }
    
    if (result.errors && result.errors.length > 0) {
      logger.info('Errors:');
      result.errors.forEach(error => logger.error(`  - ${error}`));
    }
    
    return result;
    
  } catch (error) {
    logger.error('Failed to verify attestation:', error);
    throw error;
  }
}

/**
 * CLI command to compare legacy vs JWS formats
 */
export async function compareFormatsCommand(artifactPath, options = {}) {
  try {
    logger.info(`Comparing attestation formats for ${path.basename(artifactPath)}...`);
    
    const generator = new EnhancedAttestationGenerator({
      keyStorePath: options.keyStorePath || './keys'
    });
    
    await generator.initialize();
    
    // Compare formats
    const comparison = await generator.compareFormats(artifactPath);
    
    // Output results
    if (options.output) {
      await fs.writeFile(options.output, JSON.stringify(comparison, null, 2));
      logger.success(`Comparison result saved to: ${options.output}`);
    } else {
      console.log(JSON.stringify(comparison, null, 2));
    }
    
    // Show summary
    logger.info('Format Comparison:');
    logger.info(`  Legacy (SHA-256): ${comparison.legacy.size} bytes`);
    logger.info(`  JWS (Cryptographic): ${comparison.jws.size} bytes`);
    logger.info(`  Size Difference: +${comparison.comparison.sizeDifference} bytes (${(comparison.comparison.sizeRatio * 100).toFixed(1)}%)`);
    logger.info(`  Security: ${comparison.comparison.securityImprovement}`);
    logger.info(`  Standards: ${comparison.comparison.standardsCompliance}`);
    logger.info(`  Recommendation: ${comparison.recommendation}`);
    
    return comparison;
    
  } catch (error) {
    logger.error('Failed to compare formats:', error);
    throw error;
  }
}

/**
 * CLI command to export verification tools
 */
export async function exportVerificationCommand(outputDir, options = {}) {
  try {
    logger.info(`Exporting verification tools to ${outputDir}...`);
    
    const generator = new EnhancedAttestationGenerator({
      keyStorePath: options.keyStorePath || './keys'
    });
    
    await generator.initialize();
    
    // Export tools
    const result = await generator.exportVerificationTools(outputDir);
    
    logger.success('Verification tools exported:');
    logger.info(`  Utilities: ${result.files.utilities.length} files`);
    logger.info(`  Public Keys: ${result.keyCount} keys`);
    logger.info(`  Algorithms: ${result.algorithms.join(', ')}`);
    
    return result;
    
  } catch (error) {
    logger.error('Failed to export verification tools:', error);
    throw error;
  }
}

/**
 * CLI command to migrate legacy attestations
 */
export async function migrateLegacyCommand(attestationPath, options = {}) {
  try {
    logger.info(`Migrating legacy attestation: ${path.basename(attestationPath)}...`);
    
    const generator = new EnhancedAttestationGenerator({
      keyStorePath: options.keyStorePath || './keys'
    });
    
    await generator.initialize();
    
    // Migrate attestation
    const result = await generator.migrateLegacyAttestation(attestationPath, {
      outputPath: options.output,
      backupOriginal: options.backup !== false
    });
    
    logger.success('Migration completed:');
    logger.info(`  Original format: legacy (SHA-256)`);
    logger.info(`  New format: comprehensive (JWS + legacy)`);
    if (result.signatures) {
      logger.info(`  JWS signatures: ${Object.keys(result.signatures).join(', ')}`);
    }
    
    return result;
    
  } catch (error) {
    logger.error('Failed to migrate attestation:', error);
    throw error;
  }
}

/**
 * CLI command to show system status
 */
export async function statusCommand(options = {}) {
  try {
    const generator = new EnhancedAttestationGenerator({
      keyStorePath: options.keyStorePath || './keys'
    });
    
    await generator.initialize();
    
    const status = generator.getStatus();
    
    console.log(JSON.stringify(status, null, 2));
    
    logger.info('Enhanced Attestation System Status:');
    logger.info(`  Initialized: ${status.initialized ? '✅' : '❌'}`);
    logger.info(`  Default Format: ${status.config.defaultFormat}`);
    logger.info(`  Supported Algorithms: ${status.config.supportedAlgorithms.join(', ')}`);
    logger.info(`  Metrics:`);
    logger.info(`    Generated: ${status.metrics.generated}`);
    logger.info(`    Verified: ${status.metrics.verified}`);
    logger.info(`    JWS Created: ${status.metrics.jwsCreated}`);
    logger.info(`    Legacy Created: ${status.metrics.legacyCreated}`);
    
    return status;
    
  } catch (error) {
    logger.error('Failed to get system status:', error);
    throw error;
  }
}

// Export CLI commands
export const attestationCommands = {
  generate: generateAttestationCommand,
  verify: verifyAttestationCommand,
  compare: compareFormatsCommand,
  export: exportVerificationCommand,
  migrate: migrateLegacyCommand,
  status: statusCommand
};

export default attestationCommands;