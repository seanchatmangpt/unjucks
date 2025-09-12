/**
 * Enhanced Attestation Generator
 * 
 * Replaces the existing SHA-256 based attestation system with:
 * - Real JWS signatures using JOSE
 * - Ed25519 and RSA key support
 * - Backward compatibility with legacy format
 * - External verification support
 */

import { JOSEAttestationSystem } from './jose-attestation-system.js';
import { KeyManagementUtilities } from './key-management-utilities.js';
import { AttestationVerifier } from './attestation-verifier.js';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import consola from 'consola';
import { v4 as uuidv4 } from 'uuid';

export class EnhancedAttestationGenerator {
  constructor(config = {}) {
    this.config = {
      // Output formats
      generateJWS: config.generateJWS !== false,
      generateLegacy: config.generateLegacy !== false,
      defaultFormat: config.defaultFormat || 'comprehensive', // jws-only, legacy-only, comprehensive
      
      // Key configuration
      defaultAlgorithm: config.defaultAlgorithm || 'EdDSA',
      supportedAlgorithms: config.supportedAlgorithms || ['EdDSA', 'RS256', 'RS512'],
      
      // File handling
      createSidecarFiles: config.createSidecarFiles !== false,
      sidecarSuffix: config.sidecarSuffix || '.attest.json',
      
      // Verification
      enableCrossVerification: config.enableCrossVerification || false,
      verificationTools: config.verificationTools || ['jose'],
      
      // Storage
      keyStorePath: config.keyStorePath || './keys',
      
      ...config
    };
    
    this.logger = consola.withTag('enhanced-attestation');
    
    // Initialize subsystems
    this.joseSystem = new JOSEAttestationSystem({
      keyStorePath: this.config.keyStorePath,
      defaultAlgorithm: this.config.defaultAlgorithm,
      supportedAlgorithms: this.config.supportedAlgorithms
    });
    
    this.keyManager = new KeyManagementUtilities({
      keyStorePath: this.config.keyStorePath,
      supportedAlgorithms: this.config.supportedAlgorithms
    });
    
    this.verifier = new AttestationVerifier();
    
    this.initialized = false;
    this.metrics = {
      generated: 0,
      verified: 0,
      jwsCreated: 0,
      legacyCreated: 0,
      errors: 0
    };
  }

  /**
   * Initialize the enhanced attestation system
   */
  async initialize() {
    if (this.initialized) return;
    
    try {
      this.logger.info('Initializing enhanced attestation generator...');
      
      // Initialize subsystems in parallel
      await Promise.all([
        this.joseSystem.initialize(),
        this.keyManager.initialize()
      ]);
      
      this.initialized = true;
      this.logger.success('Enhanced attestation generator ready');
      
    } catch (error) {
      this.logger.error('Failed to initialize enhanced attestation generator:', error);
      throw error;
    }
  }

  /**
   * Generate enhanced attestation for an artifact
   * @param {string} artifactPath - Path to the artifact
   * @param {Object} context - Generation context
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} Generated attestation
   */
  async generateAttestation(artifactPath, context = {}, options = {}) {
    await this.initialize();
    
    try {
      const startTime = performance.now();
      this.logger.info(`Generating attestation for ${path.basename(artifactPath)}...`);
      
      // Read and analyze artifact
      const artifactData = await this._analyzeArtifact(artifactPath);
      
      // Determine output format
      const format = options.format || this.config.defaultFormat;
      
      let attestation;
      
      switch (format) {
        case 'jws-only':
          attestation = await this._generateJWSOnlyAttestation(artifactData, context, options);
          break;
          
        case 'legacy-only':
          attestation = await this._generateLegacyOnlyAttestation(artifactData, context, options);
          break;
          
        case 'comprehensive':
        default:
          attestation = await this._generateComprehensiveAttestation(artifactData, context, options);
          break;
      }
      
      // Add generation metadata
      attestation.metadata = {
        ...attestation.metadata,
        generationTime: performance.now() - startTime,
        generator: 'enhanced-attestation-generator',
        generatorVersion: '2.0.0',
        format,
        kgenVersion: process.env.KGEN_VERSION || '1.0.0'
      };
      
      // Create sidecar file if requested
      if (this.config.createSidecarFiles) {
        const sidecarPath = `${artifactPath}${this.config.sidecarSuffix}`;
        await this._writeSidecarFile(sidecarPath, attestation);
        attestation.metadata.sidecarPath = sidecarPath;
      }
      
      // Cross-verify if enabled
      if (this.config.enableCrossVerification && attestation.signatures) {
        attestation.verification = await this._performCrossVerification(attestation);
      }
      
      this.metrics.generated++;
      this.logger.success(`Generated ${format} attestation: ${path.basename(artifactPath)}`);
      
      return attestation;
      
    } catch (error) {
      this.metrics.errors++;
      this.logger.error(`Failed to generate attestation for ${artifactPath}:`, error);
      throw error;
    }
  }

  /**
   * Verify an existing attestation
   * @param {string|Object} attestation - Attestation file path or object
   * @param {Object} options - Verification options
   * @returns {Promise<Object>} Verification result
   */
  async verifyAttestation(attestation, options = {}) {
    await this.initialize();
    
    try {
      let attestationData;
      let attestationPath;
      
      if (typeof attestation === 'string') {
        attestationPath = attestation;
        attestationData = JSON.parse(await fs.readFile(attestationPath, 'utf8'));
      } else {
        attestationData = attestation;
      }
      
      this.logger.info('Verifying attestation...');
      
      const results = {
        valid: true,
        format: attestationData.format || 'unknown',
        verificationTime: 0,
        details: {},
        errors: []
      };
      
      const startTime = performance.now();
      
      // Verify artifact integrity
      if (attestationData.artifact?.path) {
        try {
          const currentData = await this._analyzeArtifact(attestationData.artifact.path);
          
          results.details.artifactExists = true;
          results.details.contentMatches = currentData.contentHash === attestationData.artifact.contentHash;
          results.details.sizeMatches = currentData.size === attestationData.artifact.size;
          
          if (!results.details.contentMatches) {
            results.valid = false;
            results.errors.push('Artifact content has changed');
          }
          
        } catch (error) {
          results.valid = false;
          results.errors.push(`Artifact not accessible: ${error.message}`);
        }
      }
      
      // Verify JWS signatures if present
      if (attestationData.signatures) {
        results.details.signatureVerification = await this._verifyJWSSignatures(attestationData);
        
        if (!results.details.signatureVerification.valid) {
          results.valid = false;
          results.errors.push('JWS signature verification failed');
        }
      }
      
      // Verify legacy signature if present
      if (attestationData.legacy?.signature) {
        results.details.legacySignatureValid = await this._verifyLegacySignature(attestationData);
        
        if (!results.details.legacySignatureValid) {
          results.errors.push('Legacy signature verification failed (informational)');
        }
      }
      
      // Cross-verify with external tools if requested
      if (options.crossVerify && attestationData.signatures) {
        results.details.crossVerification = await this._performCrossVerification(attestationData);
      }
      
      results.verificationTime = performance.now() - startTime;
      this.metrics.verified++;
      
      this.logger.info(`Verification complete: ${results.valid ? 'VALID' : 'INVALID'}`);
      
      return results;
      
    } catch (error) {
      this.metrics.errors++;
      this.logger.error('Verification failed:', error);
      return {
        valid: false,
        error: error.message,
        verificationTime: 0
      };
    }
  }

  /**
   * Compare legacy vs JWS attestation formats
   * @param {string} artifactPath - Path to artifact
   * @param {Object} context - Generation context
   * @returns {Promise<Object>} Comparison result
   */
  async compareFormats(artifactPath, context = {}) {
    await this.initialize();
    
    const startTime = performance.now();
    
    this.logger.info('Generating format comparison...');
    
    // Generate both formats
    const [legacyAttestation, jwsAttestation] = await Promise.all([
      this.generateAttestation(artifactPath, context, { format: 'legacy-only' }),
      this.generateAttestation(artifactPath, context, { format: 'jws-only' })
    ]);
    
    // Size comparison
    const legacySize = JSON.stringify(legacyAttestation).length;
    const jwsSize = JSON.stringify(jwsAttestation).length;
    
    // Security comparison
    const comparison = {
      timestamp: new Date().toISOString(),
      artifact: path.basename(artifactPath),
      
      legacy: {
        format: 'SHA-256 hash-based',
        size: legacySize,
        signature: legacyAttestation.legacy?.signature?.value || 'none',
        verifiable: false,
        externallyVerifiable: false,
        cryptographicallySecure: false,
        standard: 'Custom',
        keyManagement: 'None'
      },
      
      jws: {
        format: 'JWS (JSON Web Signature)',
        size: jwsSize,
        signatures: Object.keys(jwsAttestation.signatures || {}),
        verifiable: true,
        externallyVerifiable: true,
        cryptographicallySecure: true,
        standard: 'RFC 7515 (JWS)',
        keyManagement: 'Ed25519/RSA with rotation'
      },
      
      comparison: {
        sizeDifference: jwsSize - legacySize,
        sizeRatio: jwsSize / legacySize,
        securityImprovement: 'Cryptographic signatures vs hash-only',
        verificationImprovement: 'External tool compatibility',
        standardsCompliance: 'RFC compliance vs custom format'
      },
      
      recommendation: jwsSize < legacySize * 3 
        ? 'JWS format recommended: Better security with acceptable size increase'
        : 'JWS format recommended: Significant security improvement justifies size increase',
      
      processingTime: performance.now() - startTime
    };
    
    this.logger.success('Format comparison complete');
    
    return comparison;
  }

  /**
   * Migrate legacy attestations to JWS format
   * @param {string} attestationPath - Path to legacy attestation
   * @param {Object} options - Migration options
   * @returns {Promise<Object>} Migrated attestation
   */
  async migrateLegacyAttestation(attestationPath, options = {}) {
    await this.initialize();
    
    try {
      this.logger.info(`Migrating legacy attestation: ${path.basename(attestationPath)}`);
      
      // Load legacy attestation
      const legacyData = JSON.parse(await fs.readFile(attestationPath, 'utf8'));
      
      // Extract context from legacy format
      const context = {
        operationId: legacyData.generation?.operationId,
        templatePath: legacyData.generation?.templatePath,
        contextHash: legacyData.generation?.contextHash,
        templateHash: legacyData.generation?.templateHash,
        generatedAt: legacyData.generation?.generatedAt,
        ...legacyData.generation?.context
      };
      
      // Generate new JWS attestation
      const enhancedAttestation = await this.generateAttestation(
        legacyData.artifact?.path,
        context,
        { format: 'comprehensive' }
      );
      
      // Add migration metadata
      enhancedAttestation.migration = {
        migratedFrom: 'legacy',
        originalFile: attestationPath,
        migratedAt: new Date().toISOString(),
        originalSignature: legacyData.signature?.value,
        migrationTool: 'enhanced-attestation-generator'
      };
      
      // Save migrated attestation
      if (options.outputPath) {
        await fs.writeFile(options.outputPath, JSON.stringify(enhancedAttestation, null, 2));
      }
      
      // Backup original if requested
      if (options.backupOriginal) {
        const backupPath = `${attestationPath}.backup`;
        await fs.copyFile(attestationPath, backupPath);
      }
      
      this.logger.success(`Migrated attestation: ${path.basename(attestationPath)}`);
      
      return enhancedAttestation;
      
    } catch (error) {
      this.logger.error(`Failed to migrate ${attestationPath}:`, error);
      throw error;
    }
  }

  /**
   * Export verification tools for external use
   * @param {string} outputDir - Output directory
   * @returns {Promise<Object>} Export result
   */
  async exportVerificationTools(outputDir) {
    await this.initialize();
    
    try {
      this.logger.info(`Exporting verification tools to ${outputDir}...`);
      
      // Export utilities
      const utilityFiles = await this.verifier.exportVerificationUtilities(outputDir);
      
      // Export public keys
      const jwks = await this.joseSystem.exportPublicJWKS();
      const jwksPath = path.join(outputDir, 'public-keys.jwks');
      await fs.writeFile(jwksPath, JSON.stringify(jwks, null, 2));
      
      // Create example files
      const exampleDir = path.join(outputDir, 'examples');
      await fs.mkdir(exampleDir, { recursive: true });
      
      // Create a sample attestation for testing
      const sampleAttestation = await this._createSampleAttestation(exampleDir);
      const samplePath = path.join(exampleDir, 'sample-attestation.json');
      await fs.writeFile(samplePath, JSON.stringify(sampleAttestation, null, 2));
      
      const exportResult = {
        outputDir,
        files: {
          utilities: utilityFiles,
          publicKeys: jwksPath,
          sample: samplePath
        },
        exportedAt: new Date().toISOString(),
        keyCount: jwks.keys.length,
        algorithms: [...new Set(jwks.keys.map(k => k.alg))]
      };
      
      this.logger.success(`Exported verification tools: ${utilityFiles.length + 2} files`);
      
      return exportResult;
      
    } catch (error) {
      this.logger.error('Failed to export verification tools:', error);
      throw error;
    }
  }

  /**
   * Get system status and metrics
   */
  getStatus() {
    return {
      initialized: this.initialized,
      metrics: this.metrics,
      config: {
        defaultFormat: this.config.defaultFormat,
        supportedAlgorithms: this.config.supportedAlgorithms,
        createSidecarFiles: this.config.createSidecarFiles
      },
      subsystems: {
        joseSystem: this.joseSystem.getStatus(),
        keyManager: this.keyManager ? 'available' : 'unavailable'
      }
    };
  }

  // Private methods

  async _analyzeArtifact(artifactPath) {
    const content = await fs.readFile(artifactPath, 'utf8');
    const stats = await fs.stat(artifactPath);
    
    return {
      path: artifactPath,
      name: path.basename(artifactPath),
      content,
      contentHash: crypto.createHash('sha256').update(content).digest('hex'),
      size: stats.size,
      lastModified: stats.mtime.toISOString(),
      type: this._inferArtifactType(artifactPath)
    };
  }

  async _generateJWSOnlyAttestation(artifactData, context, options) {
    const algorithms = options.algorithms || this.config.supportedAlgorithms;
    const signatures = {};
    
    // Generate JWS tokens for requested algorithms
    for (const algorithm of algorithms) {
      try {
        const jwsToken = await this.joseSystem.createAttestationJWS(artifactData, context, algorithm);
        signatures[algorithm.toLowerCase()] = jwsToken;
        this.metrics.jwsCreated++;
      } catch (error) {
        this.logger.warn(`Failed to create ${algorithm} signature:`, error);
      }
    }
    
    // Export public keys
    const jwks = await this.joseSystem.exportPublicJWKS();
    
    return {
      version: '2.0.0',
      format: 'jws-only',
      artifact: {
        path: artifactData.path,
        name: artifactData.name,
        contentHash: artifactData.contentHash,
        size: artifactData.size,
        type: artifactData.type
      },
      signatures,
      keys: jwks.keys.reduce((acc, key) => {
        acc[key.alg.toLowerCase()] = key;
        return acc;
      }, {}),
      metadata: {
        created: new Date().toISOString()
      }
    };
  }

  async _generateLegacyOnlyAttestation(artifactData, context, options) {
    // Generate legacy format (for compatibility)
    const artifact = {
      path: artifactData.path,
      contentHash: artifactData.contentHash,
      size: artifactData.size
    };
    
    const generation = {
      templatePath: context.templatePath,
      context: context.context || {},
      contextHash: context.contextHash || crypto.createHash('sha256').update(JSON.stringify(context)).digest('hex'),
      templateHash: context.templateHash,
      generatedAt: context.generatedAt || new Date().toISOString(),
      operationId: context.operationId || uuidv4()
    };
    
    const legacyAttestation = {
      version: '1.0.0',
      format: 'legacy-only',
      artifact,
      generation,
      environment: {
        generator: {
          name: 'kgen-deterministic-generator',
          version: '1.0.0'
        },
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        staticBuildTime: new Date().toISOString()
      },
      verification: {
        reproducible: true,
        deterministic: true,
        algorithm: 'sha256'
      },
      signature: {
        algorithm: 'sha256',
        value: crypto.createHash('sha256').update(JSON.stringify({
          artifact,
          generation
        })).digest('hex')
      }
    };
    
    this.metrics.legacyCreated++;
    
    return legacyAttestation;
  }

  async _generateComprehensiveAttestation(artifactData, context, options) {
    // Generate both JWS and legacy formats
    const [jwsAttestation, legacyAttestation] = await Promise.all([
      this._generateJWSOnlyAttestation(artifactData, context, options),
      this._generateLegacyOnlyAttestation(artifactData, context, options)
    ]);
    
    return {
      version: '2.0.0',
      format: 'comprehensive',
      
      // Enhanced artifact information
      artifact: {
        ...jwsAttestation.artifact,
        lastModified: artifactData.lastModified
      },
      
      // Generation context
      generation: legacyAttestation.generation,
      
      // JWS signatures (primary security mechanism)
      signatures: jwsAttestation.signatures,
      
      // Public keys for verification
      keys: jwsAttestation.keys,
      
      // Legacy compatibility
      legacy: {
        format: legacyAttestation.format,
        signature: legacyAttestation.signature,
        environment: legacyAttestation.environment,
        verification: legacyAttestation.verification
      },
      
      // Verification instructions
      verification: {
        primary: 'Use JWS signatures with any standard JWT library',
        fallback: 'Legacy SHA-256 hash for backward compatibility',
        external: 'Public keys available in JWKS format',
        examples: {
          nodejs: 'jwt.verify(signatures.eddsa, keys.eddsa)',
          cli: 'jwt verify --key public.jwk token.jwt',
          python: 'jwt.decode(token, key, algorithms=["EdDSA"])'
        }
      },
      
      // Compliance information
      compliance: {
        standards: ['RFC 7515', 'RFC 7518', 'RFC 7519'], // JWS, JWA, JWT
        backwardCompatible: true,
        externallyVerifiable: true,
        cryptographicallySecure: true
      },
      
      metadata: {
        created: new Date().toISOString()
      }
    };
  }

  async _writeSidecarFile(sidecarPath, attestation) {
    await fs.writeFile(sidecarPath, JSON.stringify(attestation, null, 2));
    this.logger.debug(`Created sidecar file: ${sidecarPath}`);
  }

  async _verifyJWSSignatures(attestationData) {
    if (!attestationData.signatures) {
      return { valid: false, error: 'No JWS signatures found' };
    }
    
    const results = {};
    let allValid = true;
    
    for (const [algorithm, jwsToken] of Object.entries(attestationData.signatures)) {
      try {
        const publicKey = attestationData.keys[algorithm];
        if (!publicKey) {
          results[algorithm] = { valid: false, error: 'Public key not found' };
          allValid = false;
          continue;
        }
        
        const result = await this.verifier.verifyWithJOSE(jwsToken, publicKey);
        results[algorithm] = result;
        
        if (!result.valid) {
          allValid = false;
        }
        
      } catch (error) {
        results[algorithm] = { valid: false, error: error.message };
        allValid = false;
      }
    }
    
    return {
      valid: allValid,
      algorithms: results,
      signatureCount: Object.keys(attestationData.signatures).length
    };
  }

  async _verifyLegacySignature(attestationData) {
    if (!attestationData.legacy?.signature) {
      return false;
    }
    
    try {
      // Recreate the data that was signed
      const signingData = {
        artifact: attestationData.artifact,
        generation: attestationData.generation
      };
      
      const expectedHash = crypto.createHash('sha256')
        .update(JSON.stringify(signingData))
        .digest('hex');
      
      return expectedHash === attestationData.legacy.signature.value;
      
    } catch (error) {
      this.logger.warn('Legacy signature verification failed:', error);
      return false;
    }
  }

  async _performCrossVerification(attestationData) {
    if (!attestationData.signatures || !attestationData.keys) {
      return { valid: false, error: 'No signatures or keys for cross-verification' };
    }
    
    const results = {};
    
    // Cross-verify each algorithm
    for (const [algorithm, jwsToken] of Object.entries(attestationData.signatures)) {
      const publicKey = attestationData.keys[algorithm];
      if (publicKey) {
        try {
          results[algorithm] = await this.verifier.crossVerify(
            jwsToken,
            publicKey,
            { tools: this.config.verificationTools }
          );
        } catch (error) {
          results[algorithm] = { 
            consensus: { consensus: 'invalid', confidence: 0 },
            error: error.message 
          };
        }
      }
    }
    
    return results;
  }

  async _createSampleAttestation(outputDir) {
    // Create a sample file for testing
    const sampleContent = 'console.log("Hello from KGEN!");';
    const samplePath = path.join(outputDir, 'sample.js');
    await fs.writeFile(samplePath, sampleContent);
    
    // Generate attestation for the sample
    return await this.generateAttestation(samplePath, {
      templatePath: 'examples/hello-world.njk',
      operationId: 'sample-operation-' + Date.now()
    }, { format: 'comprehensive' });
  }

  _inferArtifactType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const typeMap = {
      '.js': 'javascript',
      '.ts': 'typescript',
      '.json': 'json',
      '.yaml': 'yaml',
      '.yml': 'yaml',
      '.md': 'markdown',
      '.txt': 'text'
    };
    return typeMap[ext] || 'unknown';
  }
}

// Export singleton instance
export const enhancedAttestationGenerator = new EnhancedAttestationGenerator();
export default EnhancedAttestationGenerator;