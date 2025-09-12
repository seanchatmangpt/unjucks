/**
 * Cryptographic Verification System
 * 
 * Implements comprehensive cryptographic verification for KGEN artifacts
 * including hash verification, signature validation, and integrity checking.
 */

import { createHash, createVerify, timingSafeEqual } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import consola from 'consola';
import { v4 as uuidv4 } from 'uuid';

export class CryptographicVerifier {
  constructor(config = {}) {
    this.config = {
      // Hash algorithms (ordered by preference)
      hashAlgorithms: ['sha256', 'sha512', 'sha3-256'],
      primaryHash: 'sha256',
      
      // Signature algorithms
      signatureAlgorithms: ['RSA-SHA256', 'RSA-SHA512', 'ECDSA'],
      
      // Verification settings
      enableTimingAttackProtection: true,
      enableHashChainVerification: true,
      enableIntegrityDatabase: true,
      
      // File paths
      publicKeyPath: process.env.KGEN_PUBLIC_KEY_PATH || './keys/public.pem',
      trustStorePath: process.env.KGEN_TRUST_STORE || './keys/truststore.json',
      integrityDbPath: process.env.KGEN_INTEGRITY_DB || './verification/integrity.db.json',
      
      // Performance
      batchSize: 100,
      enableCaching: true,
      cacheTimeout: 5 * 60 * 1000, // 5 minutes
      
      ...config
    };
    
    this.logger = consola.withTag('crypto-verifier');
    this.verificationCache = new Map();
    this.integrityDatabase = new Map();
    this.trustStore = new Map();
    
    this.metrics = {
      verificationsPerformed: 0,
      hashesComputed: 0,
      signaturesVerified: 0,
      cacheHits: 0,
      cacheMisses: 0,
      integrityFailures: 0
    };
  }

  /**
   * Initialize the verification system
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      // Load trust store
      await this.loadTrustStore();
      
      // Load integrity database
      await this.loadIntegrityDatabase();
      
      this.logger.success('Cryptographic verifier initialized');
    } catch (error) {
      this.logger.error('Failed to initialize verifier:', error);
      throw error;
    }
  }

  /**
   * Verify a single artifact with its attestation
   * @param {string} artifactPath - Path to artifact
   * @param {Object|string} attestation - Attestation object or path
   * @returns {Promise<Object>} Verification result
   */
  async verifyArtifact(artifactPath, attestation = null) {
    const startTime = Date.now();
    const verificationId = uuidv4();
    
    try {
      this.logger.info(`Starting verification for ${path.basename(artifactPath)}`);
      
      // Load attestation if path provided
      if (typeof attestation === 'string') {
        const attestationContent = await fs.readFile(attestation, 'utf8');
        attestation = JSON.parse(attestationContent);
      } else if (!attestation) {
        // Try to find sidecar attestation
        const attestationPath = artifactPath + '.attest.json';
        try {
          const attestationContent = await fs.readFile(attestationPath, 'utf8');
          attestation = JSON.parse(attestationContent);
        } catch {
          attestation = null;
        }
      }
      
      const result = {
        verificationId,
        artifactPath: path.resolve(artifactPath),
        timestamp: new Date().toISOString(),
        valid: true,
        errors: [],
        warnings: [],
        checks: {},
        metrics: {
          verificationTime: 0,
          hashComputeTime: 0,
          signatureVerifyTime: 0
        },
        attestation: attestation ? {
          found: true,
          path: attestation.artifact?.path,
          timestamp: attestation.timestamp
        } : {
          found: false,
          path: null,
          timestamp: null
        }
      };
      
      // Check if artifact exists
      result.checks.artifactExists = await this.fileExists(artifactPath);
      if (!result.checks.artifactExists) {
        result.errors.push(`Artifact not found: ${artifactPath}`);
        result.valid = false;
        return result;
      }
      
      // Perform hash verification
      await this.verifyHashes(artifactPath, attestation, result);
      
      // Perform signature verification
      if (attestation?.signature) {
        await this.verifySignature(attestation, result);
      }
      
      // Verify attestation structure
      if (attestation) {
        await this.verifyAttestationStructure(attestation, result);
      }
      
      // Verify against integrity database
      await this.verifyIntegrityDatabase(artifactPath, result);
      
      // Update metrics
      result.metrics.verificationTime = Date.now() - startTime;
      this.metrics.verificationsPerformed++;
      
      if (!result.valid) {
        this.metrics.integrityFailures++;
      }
      
      // Cache result if valid
      if (this.config.enableCaching && result.valid) {
        this.cacheVerificationResult(artifactPath, result);
      }
      
      // Log result
      if (result.valid) {
        this.logger.success(`✓ Verification passed for ${path.basename(artifactPath)}`);
      } else {
        this.logger.error(`✗ Verification failed for ${path.basename(artifactPath)}: ${result.errors.join(', ')}`);
      }
      
      return result;
    } catch (error) {
      this.logger.error(`Verification error for ${artifactPath}:`, error);
      return {
        verificationId,
        artifactPath: path.resolve(artifactPath),
        timestamp: new Date().toISOString(),
        valid: false,
        errors: [`Verification failed: ${error.message}`],
        warnings: [],
        checks: {},
        metrics: { verificationTime: Date.now() - startTime }
      };
    }
  }

  /**
   * Verify hash integrity
   * @param {string} artifactPath - Path to artifact
   * @param {Object} attestation - Attestation object
   * @param {Object} result - Result object to update
   * @returns {Promise<void>}
   */
  async verifyHashes(artifactPath, attestation, result) {
    const hashStartTime = Date.now();
    
    try {
      // Compute current hash
      const currentHash = await this.computeFileHash(artifactPath, this.config.primaryHash);
      result.checks.currentHash = `${this.config.primaryHash}:${currentHash}`;
      
      // Verify against attestation if available
      if (attestation?.artifact?.hash) {
        const [algorithm, expectedHash] = attestation.artifact.hash.split(':');
        
        if (algorithm !== this.config.primaryHash) {
          // Recompute with attestation's algorithm
          const attestationHash = await this.computeFileHash(artifactPath, algorithm);
          result.checks.hashMatches = this.secureCompare(attestationHash, expectedHash);
        } else {
          result.checks.hashMatches = this.secureCompare(currentHash, expectedHash);
        }
        
        if (!result.checks.hashMatches) {
          result.errors.push(`Hash mismatch: expected ${expectedHash}, got ${currentHash}`);
          result.valid = false;
        }
        
        result.checks.attestedHash = attestation.artifact.hash;
      } else {
        result.warnings.push('No attestation hash available for verification');
      }
      
      // Verify additional hash algorithms if present
      if (attestation?.verification?.additionalHashes) {
        for (const [alg, expectedHash] of Object.entries(attestation.verification.additionalHashes)) {
          const computedHash = await this.computeFileHash(artifactPath, alg);
          const matches = this.secureCompare(computedHash, expectedHash);
          result.checks[`${alg}Matches`] = matches;
          
          if (!matches) {
            result.errors.push(`${alg} hash mismatch`);
            result.valid = false;
          }
        }
      }
      
      result.metrics.hashComputeTime = Date.now() - hashStartTime;
    } catch (error) {
      result.errors.push(`Hash verification failed: ${error.message}`);
      result.valid = false;
    }
  }

  /**
   * Verify digital signature
   * @param {Object} attestation - Attestation with signature
   * @param {Object} result - Result object to update
   * @returns {Promise<void>}
   */
  async verifySignature(attestation, result) {
    const signatureStartTime = Date.now();
    
    try {
      const signature = attestation.signature;
      
      if (!signature || !signature.signature) {
        result.warnings.push('No signature found in attestation');
        return;
      }
      
      // Check if we have the public key
      const publicKey = await this.getPublicKey(signature.publicKeyFingerprint);
      if (!publicKey) {
        result.warnings.push('Public key not found in trust store');
        result.checks.signatureVerified = false;
        return;
      }
      
      // Create canonical content for verification
      const { signature: sig, ...signable } = attestation;
      const canonicalContent = this.canonicalizeContent(signable);
      
      // Verify signature
      const verify = createVerify(signature.algorithm);
      verify.update(canonicalContent);
      
      result.checks.signatureVerified = verify.verify(publicKey, signature.signature, 'hex');
      
      if (!result.checks.signatureVerified) {
        result.errors.push('Digital signature verification failed');
        result.valid = false;
      } else {
        result.checks.signedBy = signature.publicKeyFingerprint;
        result.checks.signedAt = signature.signedAt;
      }
      
      // Verify canonical content hash if provided
      if (signature.canonicalContent) {
        const computedCanonicalHash = createHash('sha256').update(canonicalContent).digest('hex');
        result.checks.canonicalHashMatches = this.secureCompare(
          computedCanonicalHash,
          signature.canonicalContent
        );
        
        if (!result.checks.canonicalHashMatches) {
          result.errors.push('Canonical content hash mismatch');
          result.valid = false;
        }
      }
      
      result.metrics.signatureVerifyTime = Date.now() - signatureStartTime;
      this.metrics.signaturesVerified++;
    } catch (error) {
      result.errors.push(`Signature verification failed: ${error.message}`);
      result.valid = false;
    }
  }

  /**
   * Verify attestation structure and metadata
   * @param {Object} attestation - Attestation to verify
   * @param {Object} result - Result object to update
   * @returns {Promise<void>}
   */
  async verifyAttestationStructure(attestation, result) {
    try {
      // Check required fields
      const requiredFields = [
        'attestationId',
        'version',
        'timestamp',
        'artifact',
        'generation',
        'provenance',
        'verification'
      ];
      
      const missingFields = requiredFields.filter(field => !attestation.hasOwnProperty(field));
      if (missingFields.length > 0) {
        result.errors.push(`Missing required fields: ${missingFields.join(', ')}`);
        result.valid = false;
      }
      
      result.checks.structureValid = missingFields.length === 0;
      
      // Verify timestamps
      if (attestation.timestamp) {
        const timestamp = new Date(attestation.timestamp);
        const now = new Date();
        
        if (timestamp > now) {
          result.warnings.push('Attestation timestamp is in the future');
        }
        
        // Check if attestation is too old (configurable threshold)
        const maxAge = 365 * 24 * 60 * 60 * 1000; // 1 year
        if (now - timestamp > maxAge) {
          result.warnings.push('Attestation is older than maximum age threshold');
        }
      }
      
      // Verify PROV-O compliance
      if (attestation.provenance) {
        result.checks.provOCompliant = this.verifyProvOCompliance(attestation.provenance);
        if (!result.checks.provOCompliant) {
          result.warnings.push('Provenance metadata is not fully PROV-O compliant');
        }
      }
      
      // Verify version compatibility
      if (attestation.version) {
        result.checks.versionSupported = this.isVersionSupported(attestation.version);
        if (!result.checks.versionSupported) {
          result.warnings.push(`Attestation version ${attestation.version} may not be fully supported`);
        }
      }
    } catch (error) {
      result.errors.push(`Structure verification failed: ${error.message}`);
      result.valid = false;
    }
  }

  /**
   * Verify against integrity database
   * @param {string} artifactPath - Path to artifact
   * @param {Object} result - Result object to update
   * @returns {Promise<void>}
   */
  async verifyIntegrityDatabase(artifactPath, result) {
    if (!this.config.enableIntegrityDatabase) return;
    
    try {
      const normalizedPath = path.resolve(artifactPath);
      const dbEntry = this.integrityDatabase.get(normalizedPath);
      
      if (dbEntry) {
        result.checks.inIntegrityDb = true;
        result.checks.dbTimestamp = dbEntry.timestamp;
        
        // Verify hash against database
        if (dbEntry.hash && result.checks.currentHash) {
          const currentHashValue = result.checks.currentHash.split(':')[1];
          const dbHashValue = dbEntry.hash.split(':')[1];
          
          result.checks.dbHashMatches = this.secureCompare(currentHashValue, dbHashValue);
          
          if (!result.checks.dbHashMatches) {
            result.errors.push('File hash does not match integrity database');
            result.valid = false;
          }
        }
      } else {
        result.checks.inIntegrityDb = false;
        result.warnings.push('File not found in integrity database');
      }
    } catch (error) {
      result.warnings.push(`Integrity database check failed: ${error.message}`);
    }
  }

  /**
   * Compute file hash using specified algorithm
   * @param {string} filePath - Path to file
   * @param {string} algorithm - Hash algorithm
   * @returns {Promise<string>} Hash string
   */
  async computeFileHash(filePath, algorithm = this.config.primaryHash) {
    const hash = createHash(algorithm);
    const fileBuffer = await fs.readFile(filePath);
    hash.update(fileBuffer);
    this.metrics.hashesComputed++;
    return hash.digest('hex');
  }

  /**
   * Secure string comparison using timing-safe equal
   * @param {string} a - First string
   * @param {string} b - Second string
   * @returns {boolean} True if equal
   */
  secureCompare(a, b) {
    if (!this.config.enableTimingAttackProtection) {
      return a === b;
    }
    
    if (a.length !== b.length) {
      return false;
    }
    
    try {
      return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
    } catch {
      // Fallback for non-hex strings
      return timingSafeEqual(Buffer.from(a), Buffer.from(b));
    }
  }

  /**
   * Create canonical content representation
   * @param {Object} obj - Object to canonicalize
   * @returns {string} Canonical string
   */
  canonicalizeContent(obj) {
    const sortObjectKeys = (object) => {
      if (typeof object !== 'object' || object === null) return object;
      if (Array.isArray(object)) return object.map(sortObjectKeys);
      
      const sorted = {};
      Object.keys(object).sort().forEach(key => {
        sorted[key] = sortObjectKeys(object[key]);
      });
      return sorted;
    };
    
    return JSON.stringify(sortObjectKeys(obj), null, 0);
  }

  /**
   * Load trust store from file
   * @returns {Promise<void>}
   */
  async loadTrustStore() {
    try {
      if (await this.fileExists(this.config.trustStorePath)) {
        const content = await fs.readFile(this.config.trustStorePath, 'utf8');
        const trustStoreData = JSON.parse(content);
        
        for (const [fingerprint, keyData] of Object.entries(trustStoreData)) {
          this.trustStore.set(fingerprint, keyData);
        }
        
        this.logger.debug(`Loaded ${this.trustStore.size} keys from trust store`);
      }
    } catch (error) {
      this.logger.warn('Failed to load trust store:', error);
    }
  }

  /**
   * Load integrity database from file
   * @returns {Promise<void>}
   */
  async loadIntegrityDatabase() {
    try {
      if (await this.fileExists(this.config.integrityDbPath)) {
        const content = await fs.readFile(this.config.integrityDbPath, 'utf8');
        const dbData = JSON.parse(content);
        
        for (const [filePath, entry] of Object.entries(dbData)) {
          this.integrityDatabase.set(filePath, entry);
        }
        
        this.logger.debug(`Loaded ${this.integrityDatabase.size} entries from integrity database`);
      }
    } catch (error) {
      this.logger.warn('Failed to load integrity database:', error);
    }
  }

  /**
   * Get public key by fingerprint
   * @param {string} fingerprint - Key fingerprint
   * @returns {Promise<string|null>} Public key or null
   */
  async getPublicKey(fingerprint) {
    const keyData = this.trustStore.get(fingerprint);
    if (keyData) {
      return keyData.publicKey;
    }
    
    // Try loading default public key
    try {
      if (await this.fileExists(this.config.publicKeyPath)) {
        return await fs.readFile(this.config.publicKeyPath, 'utf8');
      }
    } catch {
      // Ignore error
    }
    
    return null;
  }

  /**
   * Verify PROV-O compliance
   * @param {Object} provenance - Provenance metadata
   * @returns {boolean} True if compliant
   */
  verifyProvOCompliance(provenance) {
    // Check for required PROV-O elements
    const requiredElements = ['entity', 'activity', 'agent'];
    const hasRequiredElements = requiredElements.every(element => provenance[element]);
    
    // Check for proper context
    const hasContext = provenance['@context'] && provenance['@context']['prov'];
    
    // Check for proper relations
    const hasRelations = provenance.relations && 
                        provenance.relations['prov:wasGeneratedBy'];
    
    return hasRequiredElements && hasContext && hasRelations;
  }

  /**
   * Check if attestation version is supported
   * @param {string} version - Attestation version
   * @returns {boolean} True if supported
   */
  isVersionSupported(version) {
    const supportedVersions = ['1.0.0', '2.0.0'];
    return supportedVersions.includes(version);
  }

  /**
   * Check if file exists
   * @param {string} filePath - File path
   * @returns {Promise<boolean>} True if exists
   */
  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Cache verification result
   * @param {string} artifactPath - Artifact path
   * @param {Object} result - Verification result
   * @returns {void}
   */
  cacheVerificationResult(artifactPath, result) {
    const cacheKey = path.resolve(artifactPath);
    const cacheEntry = {
      result,
      timestamp: Date.now(),
      expires: Date.now() + this.config.cacheTimeout
    };
    
    this.verificationCache.set(cacheKey, cacheEntry);
  }

  /**
   * Get cached verification result
   * @param {string} artifactPath - Artifact path
   * @returns {Object|null} Cached result or null
   */
  getCachedResult(artifactPath) {
    const cacheKey = path.resolve(artifactPath);
    const entry = this.verificationCache.get(cacheKey);
    
    if (entry && Date.now() < entry.expires) {
      this.metrics.cacheHits++;
      return entry.result;
    }
    
    if (entry) {
      this.verificationCache.delete(cacheKey);
    }
    
    this.metrics.cacheMisses++;
    return null;
  }

  /**
   * Batch verify multiple artifacts
   * @param {Array<string>} artifactPaths - Array of artifact paths
   * @param {Object} options - Verification options
   * @returns {Promise<Array<Object>>} Array of verification results
   */
  async batchVerify(artifactPaths, options = {}) {
    const results = [];
    const batchId = uuidv4();
    
    this.logger.info(`Starting batch verification of ${artifactPaths.length} artifacts`);
    
    for (let i = 0; i < artifactPaths.length; i += this.config.batchSize) {
      const batch = artifactPaths.slice(i, i + this.config.batchSize);
      const batchPromises = batch.map(async (artifactPath, index) => {
        const result = await this.verifyArtifact(artifactPath, options.attestations?.[i + index]);
        result.batchId = batchId;
        result.batchIndex = i + index;
        return result;
      });
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }
    
    const validCount = results.filter(r => r.valid).length;
    this.logger.info(`Batch verification complete: ${validCount}/${results.length} artifacts valid`);
    
    return results;
  }

  /**
   * Get verification metrics
   * @returns {Object} Metrics object
   */
  getMetrics() {
    return {
      ...this.metrics,
      cacheSize: this.verificationCache.size,
      trustStoreSize: this.trustStore.size,
      integrityDbSize: this.integrityDatabase.size,
      cacheHitRate: this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses),
      averageVerificationTime: this.metrics.verificationsPerformed > 0 ? 
        this.metrics.totalVerificationTime / this.metrics.verificationsPerformed : 0
    };
  }

  /**
   * Clean up resources
   * @returns {Promise<void>}
   */
  async shutdown() {
    this.verificationCache.clear();
    this.logger.info('Cryptographic verifier shutdown complete');
  }
}

export default CryptographicVerifier;