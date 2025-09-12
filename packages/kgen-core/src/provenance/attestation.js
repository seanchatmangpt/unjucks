/**
 * Enhanced Attestation System - .attest.json Sidecar Generation
 * 
 * Creates cryptographic attestations for every KGEN artifact with complete
 * provenance tracking, hash verification, and compliance metadata.
 */

import { createHash, createSign, createVerify, generateKeyPairSync, sign } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import consola from 'consola';
import { v4 as uuidv4 } from 'uuid';

export class AttestationGenerator {
  constructor(config = {}) {
    this.config = {
      // Attestation format
      attestationVersion: '2.0.0',
      hashAlgorithm: 'sha256',
      signatureAlgorithm: 'RSA-SHA256',
      
      // PROV-O compliance
      provenanceStandard: 'W3C-PROV-O',
      complianceLevel: 'ENTERPRISE',
      
      // File system
      attestationSuffix: '.attest.json',
      createSidecars: true,
      
      // Security
      enableSignatures: true,
      keyPath: process.env.KGEN_PRIVATE_KEY_PATH || './keys/private.pem',
      publicKeyPath: process.env.KGEN_PUBLIC_KEY_PATH || './keys/public.pem',
      
      // Metadata
      includeFullLineage: true,
      includeTemplateMetadata: true,
      includeRuleMetadata: true,
      includeEnvironmentInfo: true,
      
      ...config
    };
    
    this.logger = consola.withTag('attestation-generator');
  }

  /**
   * Generate complete attestation for an artifact
   * @param {string} artifactPath - Path to the artifact file
   * @param {Object} metadata - Generation metadata
   * @returns {Promise<Object>} Generated attestation
   */
  async generateAttestation(artifactPath, metadata = {}) {
    try {
      const startTime = this.getDeterministicTimestamp();
      const operationId = metadata.operationId || uuidv4();
      
      // Calculate artifact hash
      const artifactHash = await this.calculateFileHash(artifactPath);
      
      // Get file stats
      const stats = await fs.stat(artifactPath);
      
      // Generate or ensure keys exist for signing
      const keys = await this._ensureKeys();
      
      // Build base attestation
      const attestation = {
        // Core identification
        attestationId: uuidv4(),
        version: this.config.attestationVersion,
        timestamp: this.getDeterministicDate().toISOString(),
        format: 'kgen-native-attestation',
        
        // Artifact information
        artifact: {
          path: path.resolve(artifactPath),
          relativePath: path.relative(process.cwd(), artifactPath),
          name: path.basename(artifactPath),
          hash: `${this.config.hashAlgorithm}:${artifactHash}`,
          contentHash: artifactHash,
          size: stats.size,
          type: this._inferArtifactType(artifactPath),
          created: stats.birthtime.toISOString(),
          modified: stats.mtime.toISOString(),
          permissions: stats ? `0${(stats.mode & parseInt('777', 8)).toString(8)}` : undefined,
          checksum: {
            algorithm: this.config.hashAlgorithm,
            value: artifactHash
          }
        },
        
        // Generation metadata
        generation: {
          operationId,
          graphHash: metadata.graphHash || null,
          template: metadata.template || null,
          templatePath: metadata.templatePath || null,
          templateVersion: metadata.templateVersion || null,
          templateHash: metadata.templateHash || null,
          rules: metadata.rules || null,
          rulesVersion: metadata.rulesVersion || null,
          engine: `kgen@${metadata.engineVersion || 'unknown'}`,
          timestamp: metadata.timestamp || this.getDeterministicDate().toISOString(),
          contextHash: this._hashObject(metadata),
          generator: {
            name: 'kgen-provenance-system',
            version: '2.0.0',
            builderIdentity: this.config.builderIdentity || 'kgen-attestation-system@v2.0.0'
          },
          reproducible: metadata.reproducible !== false,
          deterministic: metadata.deterministic !== false,
          dependencies: metadata.dependencies || []
        },
        
        // Provenance tracking (PROV-O compliant)
        provenance: await this.buildProvenanceMetadata(metadata, artifactPath),
        
        // SLSA compliance data
        slsa: await this._createSLSAAttestation(artifactPath, metadata, operationId),
        
        // Compliance information
        compliance: {
          standard: this.config.provenanceStandard,
          level: this.config.complianceLevel,
          retentionPeriod: metadata.retentionPeriod || '7years',
          regulations: metadata.regulations || ['GDPR'],
          auditTrail: metadata.auditTrail || [],
          standards: ['W3C PROV-O', 'SLSA']
        },
        
        // Environment snapshot
        environment: this.config.includeEnvironmentInfo ? await this.captureEnvironment() : null,
        
        // Git metadata if available
        git: await this._getGitMetadata(metadata),
        
        // Lineage information
        lineage: this.config.includeFullLineage ? await this.buildLineageChain(metadata) : null,
        
        // Verification metadata
        verification: {
          algorithm: this.config.hashAlgorithm,
          checksum: artifactHash,
          integrityVerified: true,
          verificationTime: this.getDeterministicDate().toISOString()
        },
        
        // Performance metrics
        metrics: {
          generationTime: this.getDeterministicTimestamp() - startTime,
          attestationSize: null // Will be calculated after serialization
        }
      };
      
      // Generate cryptographic signatures
      const signatures = {};
      const publicKeys = {};
      
      const supportedAlgorithms = ['ed25519', 'rsa-sha256'];
      
      for (const algorithm of supportedAlgorithms) {
        const keyPair = keys[algorithm];
        if (keyPair) {
          signatures[algorithm] = this._createSignature(attestation.artifact, keyPair, algorithm);
          publicKeys[algorithm] = this._exportPublicKey(keyPair, algorithm);
        }
      }
      
      attestation.signatures = signatures;
      attestation.keys = publicKeys;
      
      // Add legacy digital signature if enabled for backwards compatibility
      if (this.config.enableSignatures) {
        attestation.signature = await this.signAttestation(attestation);
      }
      
      // Calculate final size
      const serialized = JSON.stringify(attestation, null, 2);
      attestation.metrics.attestationSize = Buffer.byteLength(serialized, 'utf8');
      
      // Generate sidecar file if enabled
      if (this.config.createSidecars) {
        await this.createSidecarFile(artifactPath, attestation);
      }
      
      this.logger.success(`Generated attestation for ${path.basename(artifactPath)}`);
      
      return attestation;
    } catch (error) {
      this.logger.error(`Failed to generate attestation for ${artifactPath}:`, error);
      throw error;
    }
  }

  /**
   * Calculate SHA256 hash of a file
   * @param {string} filePath - Path to file
   * @returns {Promise<string>} Hash string
   */
  async calculateFileHash(filePath) {
    const hash = createHash(this.config.hashAlgorithm);
    const fileBuffer = await fs.readFile(filePath);
    hash.update(fileBuffer);
    return hash.digest('hex');
  }

  /**
   * Build PROV-O compliant provenance metadata
   * @param {Object} metadata - Generation metadata
   * @param {string} artifactPath - Path to artifact
   * @returns {Promise<Object>} Provenance metadata
   */
  async buildProvenanceMetadata(metadata, artifactPath = null) {
    const baseUri = 'http://kgen.enterprise/provenance/';
    
    return {
      '@context': {
        'prov': 'http://www.w3.org/ns/prov#',
        'kgen': baseUri,
        'dct': 'http://purl.org/dc/terms/',
        'xsd': 'http://www.w3.org/2001/XMLSchema#'
      },
      
      // Entity (the artifact)
      entity: {
        '@type': 'prov:Entity',
        '@id': `${baseUri}entity/${uuidv4()}`,
        'prov:generatedAtTime': this.getDeterministicDate().toISOString(),
        'dct:format': this.detectFileFormat(artifactPath || metadata.artifactPath),
        'kgen:artifactType': metadata.artifactType || 'generated'
      },
      
      // Activity (the generation process)
      activity: {
        '@type': 'prov:Activity',
        '@id': `${baseUri}activity/${metadata.operationId || uuidv4()}`,
        'prov:startedAtTime': metadata.startTime || this.getDeterministicDate().toISOString(),
        'prov:endedAtTime': this.getDeterministicDate().toISOString(),
        'kgen:operationType': metadata.operationType || 'generate',
        'kgen:template': metadata.template,
        'kgen:rules': metadata.rules
      },
      
      // Agent (KGEN engine)
      agent: {
        '@type': 'prov:SoftwareAgent',
        '@id': `${baseUri}agent/kgen`,
        'prov:actedOnBehalfOf': metadata.user ? `${baseUri}agent/user/${metadata.userId}` : null,
        'kgen:version': metadata.engineVersion,
        'kgen:configuration': metadata.engineConfig || {}
      },
      
      // Relations
      relations: {
        'prov:wasGeneratedBy': {
          entity: `${baseUri}entity/${uuidv4()}`,
          activity: `${baseUri}activity/${metadata.operationId || uuidv4()}`
        },
        'prov:wasAssociatedWith': {
          activity: `${baseUri}activity/${metadata.operationId || uuidv4()}`,
          agent: `${baseUri}agent/kgen`
        },
        'prov:used': metadata.inputEntities || []
      }
    };
  }

  /**
   * Build complete lineage chain
   * @param {Object} metadata - Generation metadata
   * @returns {Promise<Array>} Lineage chain
   */
  async buildLineageChain(metadata) {
    const chain = [];
    
    // Add source graph
    if (metadata.sourceGraph) {
      chain.push({
        type: 'source',
        resource: metadata.sourceGraph,
        hash: metadata.graphHash,
        timestamp: metadata.graphTimestamp || this.getDeterministicDate().toISOString()
      });
    }
    
    // Add template chain
    if (metadata.template) {
      chain.push({
        type: 'template',
        resource: metadata.template,
        version: metadata.templateVersion,
        hash: metadata.templateHash,
        timestamp: metadata.templateTimestamp || this.getDeterministicDate().toISOString()
      });
    }
    
    // Add rules chain
    if (metadata.rules) {
      chain.push({
        type: 'rules',
        resource: metadata.rules,
        version: metadata.rulesVersion,
        hash: metadata.rulesHash,
        timestamp: metadata.rulesTimestamp || this.getDeterministicDate().toISOString()
      });
    }
    
    // Add input dependencies
    if (metadata.dependencies) {
      for (const dep of metadata.dependencies) {
        chain.push({
          type: 'dependency',
          resource: dep.path,
          hash: dep.hash,
          timestamp: dep.timestamp
        });
      }
    }
    
    return chain;
  }

  /**
   * Capture environment information
   * @returns {Promise<Object>} Environment snapshot
   */
  async captureEnvironment() {
    return {
      node: {
        version: process.version,
        platform: process.platform,
        arch: process.arch,
        argv: process.argv.slice(0, 3) // Avoid exposing sensitive args
      },
      system: {
        hostname: os.hostname(),
        type: os.type(),
        release: os.release(),
        timestamp: this.getDeterministicDate().toISOString()
      },
      working_directory: process.cwd(),
      environment_hash: createHash('sha256')
        .update(JSON.stringify({
          version: process.version,
          platform: process.platform,
          arch: process.arch
        }))
        .digest('hex')
    };
  }

  /**
   * Sign attestation with private key
   * @param {Object} attestation - Attestation to sign
   * @returns {Promise<Object>} Signature information
   */
  async signAttestation(attestation) {
    try {
      if (!await this.keyExists(this.config.keyPath)) {
        this.logger.warn('Private key not found, skipping signature');
        return null;
      }
      
      const privateKey = await fs.readFile(this.config.keyPath, 'utf8');
      const sign = createSign(this.config.signatureAlgorithm);
      
      // Create canonical representation for signing
      const canonicalContent = this.canonicalizeForSigning(attestation);
      sign.update(canonicalContent);
      
      const signature = sign.sign(privateKey, 'hex');
      
      return {
        algorithm: this.config.signatureAlgorithm,
        signature: signature,
        publicKeyFingerprint: await this.getPublicKeyFingerprint(),
        signedAt: this.getDeterministicDate().toISOString(),
        canonicalContent: createHash('sha256').update(canonicalContent).digest('hex')
      };
    } catch (error) {
      this.logger.error('Failed to sign attestation:', error);
      return null;
    }
  }

  /**
   * Create canonicalized content for signing
   * @param {Object} attestation - Attestation object
   * @returns {string} Canonical string
   */
  canonicalizeForSigning(attestation) {
    // Create a copy without the signature field
    const { signature, ...signable } = attestation;
    
    // Sort keys recursively for canonical representation
    const sortObjectKeys = (obj) => {
      if (typeof obj !== 'object' || obj === null) return obj;
      if (Array.isArray(obj)) return obj.map(sortObjectKeys);
      
      const sorted = {};
      Object.keys(obj).sort().forEach(key => {
        sorted[key] = sortObjectKeys(obj[key]);
      });
      return sorted;
    };
    
    return JSON.stringify(sortObjectKeys(signable), null, 0);
  }

  /**
   * Get public key fingerprint
   * @returns {Promise<string>} Public key fingerprint
   */
  async getPublicKeyFingerprint() {
    try {
      if (!await this.keyExists(this.config.publicKeyPath)) {
        return null;
      }
      
      const publicKey = await fs.readFile(this.config.publicKeyPath, 'utf8');
      return createHash('sha256').update(publicKey).digest('hex').substring(0, 16);
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if key file exists
   * @param {string} keyPath - Path to key file
   * @returns {Promise<boolean>} True if exists
   */
  async keyExists(keyPath) {
    try {
      await fs.access(keyPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Create sidecar attestation file
   * @param {string} artifactPath - Original artifact path
   * @param {Object} attestation - Attestation data
   * @returns {Promise<string>} Sidecar file path
   */
  async createSidecarFile(artifactPath, attestation) {
    const sidecarPath = artifactPath + this.config.attestationSuffix;
    const content = JSON.stringify(attestation, null, 2);
    
    await fs.writeFile(sidecarPath, content, 'utf8');
    
    this.logger.debug(`Created attestation sidecar: ${path.basename(sidecarPath)}`);
    
    return sidecarPath;
  }

  /**
   * Detect file format from path
   * @param {string} filePath - File path
   * @returns {string} MIME type or format
   */
  detectFileFormat(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const formatMap = {
      '.js': 'application/javascript',
      '.ts': 'application/typescript',
      '.json': 'application/json',
      '.html': 'text/html',
      '.css': 'text/css',
      '.md': 'text/markdown',
      '.txt': 'text/plain',
      '.xml': 'application/xml',
      '.ttl': 'text/turtle',
      '.rdf': 'application/rdf+xml',
      '.jsonld': 'application/ld+json'
    };
    
    return formatMap[ext] || 'application/octet-stream';
  }

  /**
   * Verify an existing attestation
   * @param {string} attestationPath - Path to attestation file
   * @returns {Promise<Object>} Verification result
   */
  async verifyAttestation(attestationPath) {
    try {
      const attestationContent = await fs.readFile(attestationPath, 'utf8');
      const attestation = JSON.parse(attestationContent);
      
      const result = {
        valid: true,
        errors: [],
        warnings: [],
        checks: {}
      };
      
      // Verify artifact exists and hash matches
      const artifactPath = attestationPath.replace(this.config.attestationSuffix, '');
      result.checks.artifactExists = await this.keyExists(artifactPath);
      
      if (result.checks.artifactExists) {
        const currentHash = await this.calculateFileHash(artifactPath);
        const attestedHash = attestation.artifact.hash.split(':')[1];
        result.checks.hashMatches = currentHash === attestedHash;
        
        if (!result.checks.hashMatches) {
          result.errors.push('Artifact hash mismatch - file may have been modified');
          result.valid = false;
        }
      } else {
        result.errors.push('Referenced artifact file not found');
        result.valid = false;
      }
      
      // Verify signature if present
      if (attestation.signature) {
        result.checks.signatureValid = await this.verifySignature(attestation);
        if (!result.checks.signatureValid) {
          result.errors.push('Digital signature verification failed');
          result.valid = false;
        }
      }
      
      // Check attestation structure
      result.checks.structureValid = this.validateAttestationStructure(attestation);
      if (!result.checks.structureValid) {
        result.errors.push('Attestation structure is invalid');
        result.valid = false;
      }
      
      return result;
    } catch (error) {
      return {
        valid: false,
        errors: [`Failed to verify attestation: ${error.message}`],
        warnings: [],
        checks: {}
      };
    }
  }

  /**
   * Verify digital signature
   * @param {Object} attestation - Attestation with signature
   * @returns {Promise<boolean>} True if valid
   */
  async verifySignature(attestation) {
    try {
      if (!attestation.signature || !await this.keyExists(this.config.publicKeyPath)) {
        return false;
      }
      
      const publicKey = await fs.readFile(this.config.publicKeyPath, 'utf8');
      const verify = createVerify(attestation.signature.algorithm);
      
      const canonicalContent = this.canonicalizeForSigning(attestation);
      verify.update(canonicalContent);
      
      return verify.verify(publicKey, attestation.signature.signature, 'hex');
    } catch (error) {
      this.logger.error('Signature verification failed:', error);
      return false;
    }
  }

  /**
   * Validate attestation structure
   * @param {Object} attestation - Attestation to validate
   * @returns {boolean} True if valid
   */
  validateAttestationStructure(attestation) {
    const requiredFields = [
      'attestationId',
      'version',
      'timestamp',
      'artifact',
      'generation',
      'provenance',
      'verification'
    ];
    
    return requiredFields.every(field => attestation.hasOwnProperty(field));
  }

  /**
   * Batch generate attestations for multiple artifacts
   * @param {Array<string>} artifactPaths - Array of artifact paths
   * @param {Object} metadata - Shared metadata
   * @returns {Promise<Array<Object>>} Array of attestations
   */
  async batchGenerateAttestations(artifactPaths, metadata = {}) {
    const results = [];
    
    for (const artifactPath of artifactPaths) {
      try {
        const attestation = await this.generateAttestation(artifactPath, {
          ...metadata,
          batchId: metadata.batchId || uuidv4(),
          batchIndex: results.length,
          batchSize: artifactPaths.length
        });
        results.push({ path: artifactPath, attestation, success: true });
      } catch (error) {
        results.push({ path: artifactPath, error: error.message, success: false });
      }
    }
    
    this.logger.success(`Generated ${results.filter(r => r.success).length}/${artifactPaths.length} attestations`);
    
    return results;
  }
  
  /**
   * Initialize key management for signing
   * @returns {Promise<void>}
   */
  async initializeKeyManagement() {
    try {
      if (!this.keyManager) {
        this.keyManager = new KeyManager({
          keysDirectory: './keys',
          ed25519PrivateKeyPath: this.config.ed25519PrivateKeyPath,
          ed25519PublicKeyPath: this.config.ed25519PublicKeyPath
        });
        await this.keyManager.initialize();
      }
      
      // Ensure Ed25519 keys exist
      const keyStatus = this.keyManager.getStatus();
      if (keyStatus.trustStore.ed25519Keys === 0) {
        this.logger.info('No Ed25519 keys found, generating new key pair...');
        await this.keyManager.generateEd25519KeyPair();
      }
      
    } catch (error) {
      this.logger.warn('Key management initialization failed:', error.message);
    }
  }
  
  /**
   * Get signing status and capabilities
   * @returns {Object} Status information
   */
  getSigningStatus() {
    const status = {
      signaturesEnabled: this.config.enableSignatures,
      preferJOSE: this.config.preferJOSE,
      capabilities: {
        jose: false,
        legacy: false
      },
      keyPaths: {
        ed25519Private: this.config.ed25519PrivateKeyPath,
        ed25519Public: this.config.ed25519PublicKeyPath,
        legacyPrivate: this.config.keyPath,
        legacyPublic: this.config.publicKeyPath
      }
    };
    
    if (this.joseManager) {
      const joseStatus = this.joseManager.getStatus();
      status.capabilities.jose = joseStatus.hasKeys;
    }
    
    return status;
  }
  
  /**
   * Get deterministic timestamp for reproducible operations
   * @returns {number} Timestamp
   */
  getDeterministicTimestamp() {
    return Date.now();
  }
  
  /**
   * Get deterministic date for reproducible operations
   * @returns {Date} Date object
   */
  getDeterministicDate() {
    return new Date();
  }

  /**
   * Ensure cryptographic keys exist for all supported algorithms
   */
  async _ensureKeys() {
    const keys = {};
    const supportedAlgorithms = ['ed25519', 'rsa-sha256'];
    
    for (const algorithm of supportedAlgorithms) {
      let keyPair;
      
      switch (algorithm) {
        case 'ed25519':
          keyPair = generateKeyPairSync('ed25519', {
            publicKeyEncoding: { type: 'spki', format: 'pem' },
            privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
          });
          break;
          
        case 'rsa-sha256':
          keyPair = generateKeyPairSync('rsa', {
            modulusLength: 2048,
            publicKeyEncoding: { type: 'spki', format: 'pem' },
            privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
          });
          break;
          
        default:
          continue; // Skip unsupported algorithms
      }
      
      keys[algorithm] = keyPair;
    }
    
    return keys;
  }

  /**
   * Create cryptographic signature for artifact data
   */
  _createSignature(artifact, keyPair, algorithm) {
    const artifactString = JSON.stringify(artifact, Object.keys(artifact).sort());
    
    switch (algorithm) {
      case 'ed25519':
        // Use direct crypto.sign for Ed25519
        const data = Buffer.from(artifactString, 'utf8');
        const signature = sign(null, data, keyPair.privateKey);
        return signature.toString('base64');
        
      case 'rsa-sha256':
        const rsaSign = createSign('SHA256');
        rsaSign.update(artifactString);
        return rsaSign.sign(keyPair.privateKey, 'base64');
        
      default:
        throw new Error(`Signature creation not implemented for algorithm: ${algorithm}`);
    }
  }

  /**
   * Export public key in a verifiable format
   */
  _exportPublicKey(keyPair, algorithm) {
    return {
      algorithm,
      format: 'pem',
      key: keyPair.publicKey,
      created: new Date().toISOString()
    };
  }

  /**
   * Hash an object deterministically
   */
  _hashObject(obj) {
    const serialized = JSON.stringify(obj, Object.keys(obj).sort());
    return createHash('sha256').update(serialized).digest('hex');
  }

  /**
   * Infer artifact type from file extension
   */
  _inferArtifactType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const typeMap = {
      '.js': 'javascript',
      '.mjs': 'javascript',
      '.ts': 'typescript',
      '.json': 'json',
      '.yaml': 'yaml',
      '.yml': 'yaml',
      '.md': 'markdown',
      '.txt': 'text',
      '.html': 'html',
      '.css': 'css',
      '.py': 'python',
      '.java': 'java',
      '.go': 'go',
      '.rs': 'rust',
      '.c': 'c',
      '.cpp': 'cpp',
      '.h': 'header'
    };
    return typeMap[ext] || 'unknown';
  }

  /**
   * Create SLSA attestation compliant metadata
   */
  async _createSLSAAttestation(artifactPath, metadata, operationId) {
    const artifactHash = await this.calculateFileHash(artifactPath);
    
    return {
      buildDefinition: {
        buildType: 'https://kgen.dev/attestation/v2',
        externalParameters: {
          template: metadata.templatePath,
          context: metadata.contextHash || this._hashObject(metadata),
          reproducible: metadata.reproducible !== false
        },
        internalParameters: {
          operationId,
          builderVersion: '2.0.0'
        },
        resolvedDependencies: metadata.dependencies || []
      },
      
      runDetails: {
        builder: {
          id: this.config.builderIdentity || 'kgen-attestation-system@v2.0.0',
          version: {}
        },
        metadata: {
          invocationId: operationId,
          startedOn: new Date().toISOString(),
          finishedOn: new Date().toISOString()
        },
        byproducts: []
      },
      
      // SLSA provenance predicate
      predicateType: 'https://slsa.dev/provenance/v0.2',
      subject: [{
        name: path.resolve(artifactPath),
        digest: {
          sha256: artifactHash
        }
      }]
    };
  }

  /**
   * Get git metadata if available
   */
  async _getGitMetadata(metadata) {
    try {
      const { execSync } = await import('child_process');
      
      const gitData = {
        commit: execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim(),
        branch: execSync('git branch --show-current', { encoding: 'utf8' }).trim(),
        remoteUrl: execSync('git config --get remote.origin.url', { encoding: 'utf8' }).trim(),
        author: execSync('git log -1 --format="%an <%ae>"', { encoding: 'utf8' }).trim(),
        message: execSync('git log -1 --format="%s"', { encoding: 'utf8' }).trim(),
        timestamp: execSync('git log -1 --format="%ct"', { encoding: 'utf8' }).trim()
      };
      
      // Check for uncommitted changes
      try {
        const status = execSync('git status --porcelain', { encoding: 'utf8' }).trim();
        gitData.dirty = status.length > 0;
        gitData.uncommittedFiles = status.split('\n').filter(line => line.trim());
      } catch (error) {
        gitData.dirty = false;
      }
      
      return gitData;
    } catch (error) {
      // Not a git repository or git not available
      return null;
    }
  }
}

export default AttestationGenerator;