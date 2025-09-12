/**
 * Cryptographic Integrity Verifier
 * Provides cryptographic integrity verification for generated artifacts
 * Ensures deterministic generation and tamper detection
 */

import { EventEmitter } from 'events';
import consola from 'consola';
import { createHash, createHmac, randomBytes, timingSafeEqual, createCipher, createDecipher } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { Store } from 'n3';

export class IntegrityVerifier extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      // Cryptographic settings
      hashAlgorithm: 'sha256',
      hmacAlgorithm: 'sha256',
      signatureAlgorithm: 'RS256', // For digital signatures
      
      // Integrity verification settings
      enableChecksums: true,
      enableDigitalSignatures: false,
      enableTimestamping: true,
      enableProvenanceTracking: true,
      
      // Storage settings
      integrityStorePath: './integrity-store',
      maxIntegrityRecords: 100000,
      retentionDays: 365,
      
      // Performance settings
      enableParallelProcessing: true,
      batchSize: 100,
      verificationTimeout: 30000,
      
      ...config
    };
    
    this.logger = consola.withTag('integrity-verifier');
    
    // Integrity tracking
    this.integrityRecords = new Map();
    this.verificationCache = new Map();
    this.integrityKeys = new Map();
    
    // Statistics
    this.metrics = {
      verificationsPerformed: 0,
      integrityViolations: 0,
      artifactsProtected: 0,
      avgVerificationTime: 0
    };
    
    // Master integrity key
    this.masterKey = null;
  }

  /**
   * Initialize integrity verifier
   */
  async initialize() {
    try {
      this.logger.info('Initializing cryptographic integrity verifier...');
      
      // Generate or load master key
      await this._initializeMasterKey();
      
      // Setup integrity storage
      await this._initializeIntegrityStorage();
      
      // Load existing records
      await this._loadIntegrityRecords();
      
      // Setup cleanup interval
      this.cleanupInterval = setInterval(() => {
        this._cleanupExpiredRecords();
      }, 3600000); // Every hour
      
      this.logger.success('Cryptographic integrity verifier initialized');
      
    } catch (error) {
      this.logger.error('Failed to initialize integrity verifier:', error);
      throw error;
    }
  }

  /**
   * Generate integrity proof for artifact
   * @param {object} artifact - Artifact to protect
   * @param {object} metadata - Additional metadata
   * @returns {Promise<object>} Integrity proof
   */
  async generateIntegrityProof(artifact, metadata = {}) {
    const startTime = this.getDeterministicTimestamp();
    
    try {
      this.logger.info('Generating integrity proof for artifact');
      
      const proof = {
        id: randomBytes(16).toString('hex'),
        timestamp: this.getDeterministicDate(),
        algorithm: this.config.hashAlgorithm,
        metadata: {
          ...metadata,
          generatedBy: 'kgen-integrity-verifier',
          version: '1.0.0'
        }
      };
      
      // Serialize artifact for hashing
      const serializedArtifact = this._serializeArtifact(artifact);
      
      // Generate cryptographic hash
      proof.hash = this._generateHash(serializedArtifact);
      
      // Generate HMAC for tamper detection
      proof.hmac = this._generateHMAC(serializedArtifact, proof.id);
      
      // Generate checksums for critical components
      if (this.config.enableChecksums) {
        proof.checksums = await this._generateComponentChecksums(artifact);
      }
      
      // Add provenance information
      if (this.config.enableProvenanceTracking) {
        proof.provenance = await this._generateProvenanceData(artifact, metadata);
      }
      
      // Digital signature (if enabled)
      if (this.config.enableDigitalSignatures) {
        proof.signature = await this._generateDigitalSignature(proof);
      }
      
      // Store integrity record
      this.integrityRecords.set(proof.id, {
        proof,
        artifact: serializedArtifact,
        createdAt: this.getDeterministicTimestamp()
      });
      
      // Update metrics
      this.metrics.artifactsProtected++;
      const verificationTime = this.getDeterministicTimestamp() - startTime;
      this._updateMetrics(verificationTime);
      
      this.emit('integrity-proof-generated', {
        proofId: proof.id,
        artifactType: metadata.type,
        verificationTime
      });
      
      this.logger.success(`Integrity proof generated: ${proof.id}`);
      
      return proof;
      
    } catch (error) {
      this.logger.error('Failed to generate integrity proof:', error);
      throw error;
    }
  }

  /**
   * Verify artifact integrity
   * @param {object} artifact - Artifact to verify
   * @param {object} proof - Integrity proof
   * @returns {Promise<object>} Verification result
   */
  async verifyIntegrity(artifact, proof) {
    const startTime = this.getDeterministicTimestamp();
    
    try {
      this.logger.info(`Verifying integrity: ${proof.id}`);
      
      const verificationResult = {
        valid: false,
        proofId: proof.id,
        violations: [],
        metadata: {
          verifiedAt: this.getDeterministicDate(),
          algorithm: proof.algorithm,
          verificationTime: 0
        }
      };
      
      // Check if proof exists in records
      const storedRecord = this.integrityRecords.get(proof.id);
      if (!storedRecord) {
        verificationResult.violations.push('Integrity proof not found in records');
        return verificationResult;
      }
      
      // Serialize current artifact
      const serializedArtifact = this._serializeArtifact(artifact);
      
      // Verify cryptographic hash
      const expectedHash = this._generateHash(serializedArtifact);
      if (!timingSafeEqual(
        Buffer.from(proof.hash, 'hex'),
        Buffer.from(expectedHash, 'hex')
      )) {
        verificationResult.violations.push('Cryptographic hash mismatch');
      }
      
      // Verify HMAC
      const expectedHMAC = this._generateHMAC(serializedArtifact, proof.id);
      if (!timingSafeEqual(
        Buffer.from(proof.hmac, 'hex'),
        Buffer.from(expectedHMAC, 'hex')
      )) {
        verificationResult.violations.push('HMAC verification failed');
      }
      
      // Verify checksums
      if (this.config.enableChecksums && proof.checksums) {
        const checksumViolations = await this._verifyComponentChecksums(artifact, proof.checksums);
        verificationResult.violations.push(...checksumViolations);
      }
      
      // Verify provenance
      if (this.config.enableProvenanceTracking && proof.provenance) {
        const provenanceViolations = await this._verifyProvenance(artifact, proof.provenance);
        verificationResult.violations.push(...provenanceViolations);
      }
      
      // Verify digital signature
      if (this.config.enableDigitalSignatures && proof.signature) {
        const signatureValid = await this._verifyDigitalSignature(proof);
        if (!signatureValid) {
          verificationResult.violations.push('Digital signature verification failed');
        }
      }
      
      // Check timestamp validity
      if (this.config.enableTimestamping) {
        const timestampViolations = this._verifyTimestamp(proof.timestamp);
        verificationResult.violations.push(...timestampViolations);
      }
      
      // Determine overall validity
      verificationResult.valid = verificationResult.violations.length === 0;
      
      // Update metrics
      this.metrics.verificationsPerformed++;
      if (!verificationResult.valid) {
        this.metrics.integrityViolations++;
      }
      
      const verificationTime = this.getDeterministicTimestamp() - startTime;
      verificationResult.metadata.verificationTime = verificationTime;
      this._updateMetrics(verificationTime);
      
      // Emit verification event
      this.emit('integrity-verified', {
        proofId: proof.id,
        valid: verificationResult.valid,
        violations: verificationResult.violations.length,
        verificationTime
      });
      
      if (!verificationResult.valid) {
        this.emit('integrity-violation', {
          proofId: proof.id,
          violations: verificationResult.violations,
          artifact: this._sanitizeArtifactForLogging(artifact)
        });
      }
      
      this.logger.info(`Integrity verification completed: ${proof.id} (${verificationResult.valid ? 'VALID' : 'INVALID'})`);
      
      return verificationResult;
      
    } catch (error) {
      this.logger.error(`Integrity verification failed: ${proof.id}`, error);
      
      return {
        valid: false,
        proofId: proof.id,
        violations: [`Verification error: ${error.message}`],
        metadata: {
          verifiedAt: this.getDeterministicDate(),
          verificationTime: this.getDeterministicTimestamp() - startTime,
          error: error.message
        }
      };
    }
  }

  /**
   * Generate deterministic artifact hash
   * @param {object} artifact - Artifact to hash
   * @param {object} options - Hashing options
   * @returns {Promise<string>} Deterministic hash
   */
  async generateDeterministicHash(artifact, options = {}) {
    try {
      // Ensure deterministic serialization
      const canonicalArtifact = this._canonicalizeArtifact(artifact);
      const serialized = JSON.stringify(canonicalArtifact, Object.keys(canonicalArtifact).sort());
      
      // Add salt for uniqueness if provided
      const saltedContent = options.salt ? `${options.salt}:${serialized}` : serialized;
      
      return this._generateHash(saltedContent);
      
    } catch (error) {
      this.logger.error('Failed to generate deterministic hash:', error);
      throw error;
    }
  }

  /**
   * Create integrity checkpoint for multiple artifacts
   * @param {Array} artifacts - Artifacts to checkpoint
   * @param {object} metadata - Checkpoint metadata
   * @returns {Promise<object>} Checkpoint
   */
  async createIntegrityCheckpoint(artifacts, metadata = {}) {
    try {
      this.logger.info(`Creating integrity checkpoint for ${artifacts.length} artifacts`);
      
      const checkpoint = {
        id: randomBytes(16).toString('hex'),
        timestamp: this.getDeterministicDate(),
        artifactCount: artifacts.length,
        metadata,
        proofs: []
      };
      
      // Generate proofs for all artifacts
      const proofPromises = artifacts.map((artifact, index) => 
        this.generateIntegrityProof(artifact, {
          ...metadata,
          checkpointId: checkpoint.id,
          artifactIndex: index
        })
      );
      
      checkpoint.proofs = await Promise.all(proofPromises);
      
      // Generate checkpoint hash
      checkpoint.checkpointHash = this._generateHash(
        JSON.stringify({
          id: checkpoint.id,
          timestamp: checkpoint.timestamp,
          proofs: checkpoint.proofs.map(p => p.hash)
        })
      );
      
      this.logger.success(`Integrity checkpoint created: ${checkpoint.id}`);
      
      return checkpoint;
      
    } catch (error) {
      this.logger.error('Failed to create integrity checkpoint:', error);
      throw error;
    }
  }

  /**
   * Verify integrity checkpoint
   * @param {Array} artifacts - Current artifacts
   * @param {object} checkpoint - Integrity checkpoint
   * @returns {Promise<object>} Verification result
   */
  async verifyIntegrityCheckpoint(artifacts, checkpoint) {
    try {
      this.logger.info(`Verifying integrity checkpoint: ${checkpoint.id}`);
      
      const result = {
        valid: true,
        checkpointId: checkpoint.id,
        artifactResults: [],
        violations: []
      };
      
      // Verify artifact count
      if (artifacts.length !== checkpoint.artifactCount) {
        result.valid = false;
        result.violations.push(`Artifact count mismatch: expected ${checkpoint.artifactCount}, got ${artifacts.length}`);
        return result;
      }
      
      // Verify each artifact
      for (let i = 0; i < artifacts.length; i++) {
        const artifact = artifacts[i];
        const proof = checkpoint.proofs[i];
        
        if (!proof) {
          result.valid = false;
          result.violations.push(`Missing proof for artifact ${i}`);
          continue;
        }
        
        const artifactResult = await this.verifyIntegrity(artifact, proof);
        result.artifactResults.push(artifactResult);
        
        if (!artifactResult.valid) {
          result.valid = false;
          result.violations.push(`Artifact ${i} integrity violation`);
        }
      }
      
      // Verify checkpoint hash
      const expectedCheckpointHash = this._generateHash(
        JSON.stringify({
          id: checkpoint.id,
          timestamp: checkpoint.timestamp,
          proofs: checkpoint.proofs.map(p => p.hash)
        })
      );
      
      if (checkpoint.checkpointHash !== expectedCheckpointHash) {
        result.valid = false;
        result.violations.push('Checkpoint hash verification failed');
      }
      
      this.logger.info(`Checkpoint verification completed: ${checkpoint.id} (${result.valid ? 'VALID' : 'INVALID'})`);
      
      return result;
      
    } catch (error) {
      this.logger.error(`Checkpoint verification failed: ${checkpoint.id}`, error);
      throw error;
    }
  }

  /**
   * Get integrity metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      activeRecords: this.integrityRecords.size,
      cacheSize: this.verificationCache.size,
      uptime: this.getDeterministicTimestamp() - (this.startTime || this.getDeterministicTimestamp())
    };
  }

  /**
   * Export integrity records
   * @param {object} options - Export options
   * @returns {Promise<object>} Exported data
   */
  async exportIntegrityRecords(options = {}) {
    try {
      const records = Array.from(this.integrityRecords.entries())
        .map(([id, record]) => ({
          id,
          proof: record.proof,
          createdAt: new Date(record.createdAt)
        }));
      
      const exportData = {
        exportedAt: this.getDeterministicDate(),
        recordCount: records.length,
        records: options.includeArtifacts ? records : records.map(r => ({ ...r, artifact: undefined }))
      };
      
      if (options.saveTo) {
        await fs.writeFile(options.saveTo, JSON.stringify(exportData, null, 2));
        this.logger.info(`Integrity records exported to: ${options.saveTo}`);
      }
      
      return exportData;
      
    } catch (error) {
      this.logger.error('Failed to export integrity records:', error);
      throw error;
    }
  }

  /**
   * Shutdown integrity verifier
   */
  async shutdown() {
    try {
      this.logger.info('Shutting down integrity verifier...');
      
      // Clear cleanup interval
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
      }
      
      // Save integrity records
      await this._saveIntegrityRecords();
      
      // Clear sensitive data
      this.integrityKeys.clear();
      this.verificationCache.clear();
      this.masterKey = null;
      
      this.logger.success('Integrity verifier shutdown completed');
      
    } catch (error) {
      this.logger.error('Error during integrity verifier shutdown:', error);
      throw error;
    }
  }

  // Private methods

  async _initializeMasterKey() {
    // In production, load from secure key storage
    this.masterKey = randomBytes(32);
    this.logger.info('Master integrity key initialized');
  }

  async _initializeIntegrityStorage() {
    const storageDir = path.dirname(this.config.integrityStorePath);
    await fs.mkdir(storageDir, { recursive: true });
  }

  async _loadIntegrityRecords() {
    try {
      const data = await fs.readFile(this.config.integrityStorePath, 'utf8');
      const records = JSON.parse(data);
      
      for (const [id, record] of Object.entries(records)) {
        this.integrityRecords.set(id, record);
      }
      
      this.logger.info(`Loaded ${this.integrityRecords.size} integrity records`);
      
    } catch (error) {
      // File doesn't exist or is corrupted - start fresh
      this.logger.info('No existing integrity records found, starting fresh');
    }
  }

  async _saveIntegrityRecords() {
    try {
      const records = Object.fromEntries(this.integrityRecords);
      await fs.writeFile(this.config.integrityStorePath, JSON.stringify(records, null, 2));
      this.logger.info('Integrity records saved');
      
    } catch (error) {
      this.logger.error('Failed to save integrity records:', error);
    }
  }

  _serializeArtifact(artifact) {
    // Ensure consistent serialization
    if (typeof artifact === 'string') {
      return artifact;
    }
    
    return JSON.stringify(this._canonicalizeArtifact(artifact));
  }

  _canonicalizeArtifact(artifact) {
    if (typeof artifact !== 'object' || artifact === null) {
      return artifact;
    }
    
    if (Array.isArray(artifact)) {
      return artifact.map(item => this._canonicalizeArtifact(item));
    }
    
    // Sort object keys for deterministic serialization
    const canonicalized = {};
    const sortedKeys = Object.keys(artifact).sort();
    
    for (const key of sortedKeys) {
      canonicalized[key] = this._canonicalizeArtifact(artifact[key]);
    }
    
    return canonicalized;
  }

  _generateHash(content) {
    return createHash(this.config.hashAlgorithm)
      .update(content, 'utf8')
      .digest('hex');
  }

  _generateHMAC(content, key) {
    const hmacKey = createHash('sha256')
      .update(this.masterKey)
      .update(key, 'utf8')
      .digest();
    
    return createHmac(this.config.hmacAlgorithm, hmacKey)
      .update(content, 'utf8')
      .digest('hex');
  }

  async _generateComponentChecksums(artifact) {
    const checksums = {};
    
    // Generate checksums for different artifact components
    if (artifact.content) {
      checksums.content = this._generateHash(artifact.content);
    }
    
    if (artifact.metadata) {
      checksums.metadata = this._generateHash(JSON.stringify(artifact.metadata));
    }
    
    if (artifact.dependencies) {
      checksums.dependencies = this._generateHash(JSON.stringify(artifact.dependencies));
    }
    
    return checksums;
  }

  async _verifyComponentChecksums(artifact, expectedChecksums) {
    const violations = [];
    const actualChecksums = await this._generateComponentChecksums(artifact);
    
    for (const [component, expectedChecksum] of Object.entries(expectedChecksums)) {
      const actualChecksum = actualChecksums[component];
      
      if (!actualChecksum) {
        violations.push(`Missing component for checksum verification: ${component}`);
      } else if (actualChecksum !== expectedChecksum) {
        violations.push(`Checksum mismatch for component: ${component}`);
      }
    }
    
    return violations;
  }

  async _generateProvenanceData(artifact, metadata) {
    return {
      source: metadata.source || 'unknown',
      generator: metadata.generator || 'kgen',
      version: metadata.version || '1.0.0',
      timestamp: this.getDeterministicDate(),
      dependencies: metadata.dependencies || [],
      processingSteps: metadata.processingSteps || [],
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch
      }
    };
  }

  async _verifyProvenance(artifact, expectedProvenance) {
    const violations = [];
    
    // Basic provenance verification
    if (!expectedProvenance.source) {
      violations.push('Missing provenance source information');
    }
    
    if (!expectedProvenance.timestamp) {
      violations.push('Missing provenance timestamp');
    }
    
    // Verify environment consistency if specified
    if (expectedProvenance.environment) {
      if (expectedProvenance.environment.nodeVersion !== process.version) {
        violations.push('Node.js version mismatch in provenance');
      }
      if (expectedProvenance.environment.platform !== process.platform) {
        violations.push('Platform mismatch in provenance');
      }
    }
    
    return violations;
  }

  async _generateDigitalSignature(proof) {
    // Placeholder for digital signature generation
    // In production, use proper cryptographic signing
    const content = JSON.stringify({
      hash: proof.hash,
      hmac: proof.hmac,
      timestamp: proof.timestamp
    });
    
    return createHmac('sha256', this.masterKey)
      .update(content)
      .digest('hex');
  }

  async _verifyDigitalSignature(proof) {
    // Placeholder for digital signature verification
    // In production, use proper cryptographic verification
    const content = JSON.stringify({
      hash: proof.hash,
      hmac: proof.hmac,
      timestamp: proof.timestamp
    });
    
    const expectedSignature = createHmac('sha256', this.masterKey)
      .update(content)
      .digest('hex');
    
    return timingSafeEqual(
      Buffer.from(proof.signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  }

  _verifyTimestamp(timestamp) {
    const violations = [];
    const now = this.getDeterministicTimestamp();
    const timestampMs = new Date(timestamp).getTime();
    
    // Check if timestamp is in the future
    if (timestampMs > now + 60000) { // Allow 1 minute clock skew
      violations.push('Timestamp is in the future');
    }
    
    // Check if timestamp is too old
    const maxAge = this.config.retentionDays * 24 * 60 * 60 * 1000;
    if (now - timestampMs > maxAge) {
      violations.push('Timestamp is too old');
    }
    
    return violations;
  }

  _sanitizeArtifactForLogging(artifact) {
    if (typeof artifact === 'string') {
      return artifact.length > 200 ? artifact.substring(0, 200) + '...' : artifact;
    }
    
    return JSON.stringify(artifact).substring(0, 500) + '...';
  }

  _updateMetrics(verificationTime) {
    const totalVerifications = this.metrics.verificationsPerformed;
    this.metrics.avgVerificationTime = (
      (this.metrics.avgVerificationTime * (totalVerifications - 1) + verificationTime) /
      totalVerifications
    );
  }

  _cleanupExpiredRecords() {
    const now = this.getDeterministicTimestamp();
    const maxAge = this.config.retentionDays * 24 * 60 * 60 * 1000;
    const expired = [];
    
    for (const [id, record] of this.integrityRecords.entries()) {
      if (now - record.createdAt > maxAge) {
        expired.push(id);
      }
    }
    
    expired.forEach(id => this.integrityRecords.delete(id));
    
    // Limit total records
    if (this.integrityRecords.size > this.config.maxIntegrityRecords) {
      const entries = Array.from(this.integrityRecords.entries());
      entries.sort((a, b) => a[1].createdAt - b[1].createdAt);
      
      const toRemove = entries.slice(0, Math.floor(this.integrityRecords.size * 0.1));
      toRemove.forEach(([id]) => this.integrityRecords.delete(id));
    }
    
    if (expired.length > 0) {
      this.logger.info(`Cleaned up ${expired.length} expired integrity records`);
    }
  }
}

export default IntegrityVerifier;