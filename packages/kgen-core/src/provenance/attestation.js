/**
 * Enhanced Attestation System - .attest.json Sidecar Generation
 * 
 * Creates cryptographic attestations for every KGEN artifact with complete
 * provenance tracking, hash verification, and compliance metadata.
 */

import { createHash, createSign, createVerify } from 'crypto';
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
      
      // Calculate artifact hash
      const artifactHash = await this.calculateFileHash(artifactPath);
      
      // Get file stats
      const stats = await fs.stat(artifactPath);
      
      // Build base attestation
      const attestation = {
        // Core identification
        attestationId: uuidv4(),
        version: this.config.attestationVersion,
        timestamp: this.getDeterministicDate().toISOString(),
        
        // Artifact information
        artifact: {
          path: path.resolve(artifactPath),
          relativePath: path.relative(process.cwd(), artifactPath),
          hash: `${this.config.hashAlgorithm}:${artifactHash}`,
          size: stats.size,
          created: stats.birthtime.toISOString(),
          modified: stats.mtime.toISOString()
        },
        
        // Generation metadata
        generation: {
          graphHash: metadata.graphHash || null,
          template: metadata.template || null,
          templateVersion: metadata.templateVersion || null,
          rules: metadata.rules || null,
          rulesVersion: metadata.rulesVersion || null,
          engine: `kgen@${metadata.engineVersion || 'unknown'}`,
          timestamp: metadata.timestamp || this.getDeterministicDate().toISOString(),
          operationId: metadata.operationId || null
        },
        
        // Provenance tracking (PROV-O compliant)
        provenance: await this.buildProvenanceMetadata(metadata, artifactPath),
        
        // Compliance information
        compliance: {
          standard: this.config.provenanceStandard,
          level: this.config.complianceLevel,
          retentionPeriod: metadata.retentionPeriod || '7years',
          regulations: metadata.regulations || ['GDPR'],
          auditTrail: metadata.auditTrail || []
        },
        
        // Environment snapshot
        environment: this.config.includeEnvironmentInfo ? await this.captureEnvironment() : null,
        
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
      
      // Add digital signature if enabled
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
}

export default AttestationGenerator;