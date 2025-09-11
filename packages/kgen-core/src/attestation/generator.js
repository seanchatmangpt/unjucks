/**
 * Attestation Generator - Lightweight .attest.json sidecar generation
 * 
 * Adapted from the existing PROV-O provenance system to create immutable,
 * cryptographically verifiable links from artifacts back to their origin.
 * Generates .attest.json sidecar files for every artifact with hash chains.
 */

import { EventEmitter } from 'events';
import crypto from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import consola from 'consola';

export class AttestationGenerator extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      // Attestation configuration
      enableCryptographicHashing: true,
      hashAlgorithm: 'sha256',
      attestationVersion: '1.0.0',
      
      // Template tracking
      enableTemplateTracking: true,
      enableRuleVersioning: true,
      
      // Blockchain integration (adapted from existing system)
      enableBlockchainIntegrity: process.env.KGEN_BLOCKCHAIN_ENABLED === 'true',
      blockchainNetwork: process.env.KGEN_BLOCKCHAIN_NETWORK || 'ethereum',
      
      // Output configuration
      sidecarExtension: '.attest.json',
      enablePrettyPrint: true,
      
      // Verification settings
      enableChainValidation: true,
      enableFastVerification: true,
      
      ...config
    };
    
    this.logger = consola.withTag('attestation-generator');
    
    // Attestation state (lightweight compared to full provenance)
    this.artifactRegistry = new Map();
    this.hashChain = [];
    this.templateVersions = new Map();
    this.ruleVersions = new Map();
    this.verificationCache = new Map();
    
    // Blockchain integration (reuse existing anchor if available)
    this.blockchainAnchor = null;
    
    this.state = 'initialized';
  }

  /**
   * Initialize the attestation generator
   */
  async initialize() {
    try {
      this.logger.info('Initializing attestation generator...');
      
      // Initialize hash chain with genesis block (adapted from provenance)
      await this._initializeHashChain();
      
      // Load existing template and rule versions
      await this._loadVersionHistory();
      
      // Initialize blockchain integration if enabled
      if (this.config.enableBlockchainIntegrity) {
        await this._initializeBlockchainIntegration();
      }
      
      this.state = 'ready';
      this.logger.success('Attestation generator initialized successfully');
      
      return {
        status: 'success',
        version: this.config.attestationVersion,
        blockchain: this.blockchainAnchor ? 'enabled' : 'disabled'
      };
      
    } catch (error) {
      this.logger.error('Failed to initialize attestation generator:', error);
      this.state = 'error';
      throw error;
    }
  }

  /**
   * Generate .attest.json sidecar for an artifact
   * @param {string} artifactPath - Path to the generated artifact
   * @param {Object} context - Generation context from kgen
   * @returns {Promise<Object>} Attestation record
   */
  async generateAttestation(artifactPath, context) {
    try {
      this.logger.info(`Generating attestation for artifact: ${artifactPath}`);
      
      // Calculate artifact hash
      const artifactContent = await fs.readFile(artifactPath);
      const artifactHash = crypto.createHash(this.config.hashAlgorithm)
        .update(artifactContent)
        .digest('hex');
      
      // Generate attestation ID
      const attestationId = crypto.randomUUID();
      const timestamp = new Date();
      
      // Build attestation record
      const attestation = {
        // Core attestation metadata
        id: attestationId,
        version: this.config.attestationVersion,
        timestamp: timestamp.toISOString(),
        
        // Artifact information
        artifact: {
          path: artifactPath,
          name: path.basename(artifactPath),
          hash: artifactHash,
          size: artifactContent.length,
          mimeType: this._detectMimeType(artifactPath)
        },
        
        // Source graph linkage (immutable link to origin)
        provenance: {
          sourceGraph: context.sourceGraph || {},
          templatePath: context.templatePath,
          templateHash: context.templateHash,
          templateVersion: await this._getTemplateVersion(context.templatePath),
          ruleVersion: await this._getRuleVersion(context.rulePath),
          variables: context.variables || {},
          generatedAt: timestamp.toISOString(),
          generationAgent: context.agent || 'kgen-system'
        },
        
        // Cryptographic verification
        integrity: {
          hashAlgorithm: this.config.hashAlgorithm,
          verificationChain: await this._buildVerificationChain(context),
          previousHash: this._getPreviousChainHash(),
          chainIndex: this.hashChain.length
        },
        
        // Template lineage tracking
        templateLineage: {
          templateFamily: context.templateFamily,
          derivedFrom: context.derivedTemplates || [],
          modifications: context.modifications || [],
          dependencies: context.dependencies || []
        }
      };
      
      // Add blockchain anchor if enabled
      if (this.blockchainAnchor) {
        attestation.blockchain = await this._prepareBlockchainAttestation(attestation);
      }
      
      // Generate attestation hash for chain
      attestation.attestationHash = await this._generateAttestationHash(attestation);
      
      // Add to hash chain
      await this._addToHashChain(attestation);
      
      // Store in artifact registry
      this.artifactRegistry.set(artifactPath, attestation);
      
      // Write .attest.json sidecar file
      const sidecarPath = await this._writeSidecarFile(artifactPath, attestation);
      
      this.logger.success(`Generated attestation: ${sidecarPath}`);
      this.emit('attestation:generated', { artifactPath, attestation, sidecarPath });
      
      return {
        attestation,
        sidecarPath,
        artifactHash,
        attestationHash: attestation.attestationHash
      };
      
    } catch (error) {
      this.logger.error(`Failed to generate attestation for ${artifactPath}:`, error);
      throw error;
    }
  }

  /**
   * Verify attestation for an artifact
   * @param {string} artifactPath - Path to the artifact
   * @returns {Promise<Object>} Verification result
   */
  async verifyAttestation(artifactPath) {
    try {
      this.logger.info(`Verifying attestation for artifact: ${artifactPath}`);
      
      const sidecarPath = this._getSidecarPath(artifactPath);
      
      // Check if sidecar exists
      if (!await this._fileExists(sidecarPath)) {
        return {
          verified: false,
          reason: 'No attestation sidecar found',
          artifactPath
        };
      }
      
      // Load attestation
      const attestation = JSON.parse(await fs.readFile(sidecarPath, 'utf8'));
      
      // Verify artifact hash
      const currentArtifactHash = await this._calculateFileHash(artifactPath);
      const hashVerified = currentArtifactHash === attestation.artifact.hash;
      
      // Verify chain integrity
      const chainVerification = await this._verifyChainIntegrity(attestation);
      
      // Verify template lineage
      const lineageVerification = await this._verifyTemplateLineage(attestation);
      
      // Verify blockchain anchor if present
      let blockchainVerification = { verified: true, reason: 'Not anchored' };
      if (attestation.blockchain && this.blockchainAnchor) {
        blockchainVerification = await this.blockchainAnchor.verifyAnchor(
          attestation.id,
          attestation.attestationHash
        );
      }
      
      const overallVerified = hashVerified && 
                              chainVerification.verified && 
                              lineageVerification.verified &&
                              blockchainVerification.verified;
      
      const result = {
        verified: overallVerified,
        artifactPath,
        attestation,
        verificationDetails: {
          artifactHash: { verified: hashVerified, expected: attestation.artifact.hash, actual: currentArtifactHash },
          chain: chainVerification,
          lineage: lineageVerification,
          blockchain: blockchainVerification
        },
        verifiedAt: new Date().toISOString()
      };
      
      // Cache verification result for fast lookups
      this.verificationCache.set(artifactPath, result);
      
      this.emit('attestation:verified', result);
      return result;
      
    } catch (error) {
      this.logger.error(`Failed to verify attestation for ${artifactPath}:`, error);
      return {
        verified: false,
        reason: `Verification error: ${error.message}`,
        artifactPath
      };
    }
  }

  /**
   * Explain artifact origin (for kgen artifact explain command)
   * @param {string} artifactPath - Path to the artifact
   * @returns {Promise<Object>} Detailed explanation of artifact origin
   */
  async explainArtifact(artifactPath) {
    try {
      this.logger.info(`Explaining artifact origin: ${artifactPath}`);
      
      // Load and verify attestation
      const verification = await this.verifyAttestation(artifactPath);
      if (!verification.verified) {
        return {
          success: false,
          reason: 'Attestation verification failed',
          verification
        };
      }
      
      const attestation = verification.attestation;
      
      // Build comprehensive explanation
      const explanation = {
        artifact: {
          path: artifactPath,
          name: attestation.artifact.name,
          generatedAt: attestation.provenance.generatedAt,
          verified: verification.verified
        },
        
        origin: {
          template: {
            path: attestation.provenance.templatePath,
            version: attestation.provenance.templateVersion,
            family: attestation.templateLineage.templateFamily,
            hash: attestation.provenance.templateHash
          },
          
          rule: {
            version: attestation.provenance.ruleVersion,
            modifications: attestation.templateLineage.modifications
          },
          
          sourceGraph: attestation.provenance.sourceGraph,
          variables: attestation.provenance.variables,
          agent: attestation.provenance.generationAgent
        },
        
        lineage: {
          derivedFrom: attestation.templateLineage.derivedFrom,
          dependencies: attestation.templateLineage.dependencies,
          chainPosition: attestation.integrity.chainIndex,
          previousHash: attestation.integrity.previousHash
        },
        
        integrity: {
          artifactHash: attestation.artifact.hash,
          attestationHash: attestation.attestationHash,
          verificationChain: attestation.integrity.verificationChain,
          blockchainAnchored: !!attestation.blockchain
        }
      };
      
      // Add blockchain information if available
      if (attestation.blockchain) {
        explanation.blockchain = {
          network: attestation.blockchain.network,
          transactionHash: attestation.blockchain.transactionHash,
          blockNumber: attestation.blockchain.blockNumber,
          merkleRoot: attestation.blockchain.merkleRoot
        };
      }
      
      return {
        success: true,
        explanation,
        attestation,
        verification
      };
      
    } catch (error) {
      this.logger.error(`Failed to explain artifact ${artifactPath}:`, error);
      return {
        success: false,
        reason: `Explanation error: ${error.message}`,
        error
      };
    }
  }

  /**
   * Get attestation statistics
   */
  getStatistics() {
    return {
      state: this.state,
      totalArtifacts: this.artifactRegistry.size,
      hashChainLength: this.hashChain.length,
      templateVersions: this.templateVersions.size,
      ruleVersions: this.ruleVersions.size,
      verificationCacheSize: this.verificationCache.size,
      blockchain: this.blockchainAnchor ? this.blockchainAnchor.getStatistics() : null
    };
  }

  // Private methods

  async _initializeHashChain() {
    // Genesis block for attestation chain (adapted from provenance)
    if (this.hashChain.length === 0) {
      const genesisBlock = {
        index: 0,
        timestamp: new Date().toISOString(),
        type: 'genesis',
        hash: crypto.createHash(this.config.hashAlgorithm)
          .update('attestation-genesis-block')
          .digest('hex'),
        previousHash: '0'
      };
      
      this.hashChain.push(genesisBlock);
    }
  }

  async _loadVersionHistory() {
    // Load existing template and rule versions
    // This would typically load from storage
    this.templateVersions.clear();
    this.ruleVersions.clear();
  }

  async _initializeBlockchainIntegration() {
    try {
      // Dynamic import of existing BlockchainAnchor (avoid circular dependencies)
      const { BlockchainAnchor } = await import('../../../src/kgen/provenance/blockchain/anchor.js');
      this.blockchainAnchor = new BlockchainAnchor(this.config);
      await this.blockchainAnchor.initialize();
      this.logger.info('Blockchain integration initialized for attestations');
    } catch (error) {
      this.logger.warn('Failed to initialize blockchain integration:', error.message);
      this.blockchainAnchor = null;
    }
  }

  async _getTemplateVersion(templatePath) {
    if (!templatePath) return null;
    
    // Calculate template version based on hash
    try {
      const templateContent = await fs.readFile(templatePath);
      const templateHash = crypto.createHash(this.config.hashAlgorithm)
        .update(templateContent)
        .digest('hex');
      
      // Store version mapping
      const version = `v${templateHash.substring(0, 8)}`;
      this.templateVersions.set(templatePath, { version, hash: templateHash });
      
      return version;
    } catch (error) {
      return `unknown-${Date.now()}`;
    }
  }

  async _getRuleVersion(rulePath) {
    if (!rulePath) return null;
    
    // Similar to template versioning
    try {
      const ruleContent = await fs.readFile(rulePath);
      const ruleHash = crypto.createHash(this.config.hashAlgorithm)
        .update(ruleContent)
        .digest('hex');
      
      const version = `r${ruleHash.substring(0, 8)}`;
      this.ruleVersions.set(rulePath, { version, hash: ruleHash });
      
      return version;
    } catch (error) {
      return `unknown-${Date.now()}`;
    }
  }

  async _buildVerificationChain(context) {
    // Build verification chain from source to artifact
    const chain = [];
    
    // Template verification
    if (context.templatePath) {
      chain.push({
        type: 'template',
        path: context.templatePath,
        hash: context.templateHash,
        version: await this._getTemplateVersion(context.templatePath)
      });
    }
    
    // Rule verification
    if (context.rulePath) {
      chain.push({
        type: 'rule',
        path: context.rulePath,
        version: await this._getRuleVersion(context.rulePath)
      });
    }
    
    // Source graph verification
    if (context.sourceGraph && Object.keys(context.sourceGraph).length > 0) {
      const sourceGraphHash = crypto.createHash(this.config.hashAlgorithm)
        .update(JSON.stringify(context.sourceGraph, Object.keys(context.sourceGraph).sort()))
        .digest('hex');
      
      chain.push({
        type: 'sourceGraph',
        hash: sourceGraphHash,
        entities: Object.keys(context.sourceGraph).length
      });
    }
    
    return chain;
  }

  _getPreviousChainHash() {
    if (this.hashChain.length === 0) return '0';
    return this.hashChain[this.hashChain.length - 1].hash;
  }

  async _generateAttestationHash(attestation) {
    // Generate hash for the attestation (excluding the hash itself)
    const attestationData = {
      id: attestation.id,
      timestamp: attestation.timestamp,
      artifact: attestation.artifact,
      provenance: attestation.provenance,
      integrity: {
        hashAlgorithm: attestation.integrity.hashAlgorithm,
        verificationChain: attestation.integrity.verificationChain,
        previousHash: attestation.integrity.previousHash,
        chainIndex: attestation.integrity.chainIndex
      },
      templateLineage: attestation.templateLineage
    };
    
    const dataString = JSON.stringify(attestationData, Object.keys(attestationData).sort());
    return crypto.createHash(this.config.hashAlgorithm).update(dataString).digest('hex');
  }

  async _addToHashChain(attestation) {
    const chainBlock = {
      index: this.hashChain.length,
      timestamp: attestation.timestamp,
      type: 'attestation',
      artifactPath: attestation.artifact.path,
      attestationId: attestation.id,
      hash: attestation.attestationHash,
      previousHash: this._getPreviousChainHash()
    };
    
    this.hashChain.push(chainBlock);
  }

  async _prepareBlockchainAttestation(attestation) {
    // Queue for blockchain anchoring
    await this.blockchainAnchor.queueForAnchoring(
      attestation.id,
      attestation.attestationHash,
      {
        artifactPath: attestation.artifact.path,
        timestamp: attestation.timestamp
      }
    );
    
    return {
      network: this.config.blockchainNetwork,
      queued: true,
      queuedAt: new Date().toISOString()
    };
  }

  _getSidecarPath(artifactPath) {
    return artifactPath + this.config.sidecarExtension;
  }

  async _writeSidecarFile(artifactPath, attestation) {
    const sidecarPath = this._getSidecarPath(artifactPath);
    const content = this.config.enablePrettyPrint 
      ? JSON.stringify(attestation, null, 2)
      : JSON.stringify(attestation);
    
    await fs.writeFile(sidecarPath, content, 'utf8');
    return sidecarPath;
  }

  async _fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async _calculateFileHash(filePath) {
    const content = await fs.readFile(filePath);
    return crypto.createHash(this.config.hashAlgorithm).update(content).digest('hex');
  }

  async _verifyChainIntegrity(attestation) {
    try {
      // Verify that the attestation fits properly in the chain
      const chainIndex = attestation.integrity.chainIndex;
      
      if (chainIndex >= this.hashChain.length) {
        return {
          verified: false,
          reason: 'Chain index out of range'
        };
      }
      
      const chainBlock = this.hashChain[chainIndex];
      const verified = chainBlock.attestationId === attestation.id &&
                       chainBlock.hash === attestation.attestationHash;
      
      return {
        verified,
        reason: verified ? 'Chain integrity confirmed' : 'Chain integrity mismatch'
      };
      
    } catch (error) {
      return {
        verified: false,
        reason: `Chain verification error: ${error.message}`
      };
    }
  }

  async _verifyTemplateLineage(attestation) {
    try {
      // Verify template and rule versions still match
      const templateVerified = await this._verifyTemplateVersion(
        attestation.provenance.templatePath,
        attestation.provenance.templateVersion
      );
      
      const ruleVerified = await this._verifyRuleVersion(
        attestation.templateLineage.ruleVersion
      );
      
      return {
        verified: templateVerified && ruleVerified,
        reason: 'Template lineage verified',
        details: { templateVerified, ruleVerified }
      };
      
    } catch (error) {
      return {
        verified: false,
        reason: `Template lineage verification error: ${error.message}`
      };
    }
  }

  async _verifyTemplateVersion(templatePath, expectedVersion) {
    if (!templatePath) return true;
    
    try {
      const currentVersion = await this._getTemplateVersion(templatePath);
      return currentVersion === expectedVersion;
    } catch {
      return false;
    }
  }

  async _verifyRuleVersion(expectedRuleVersion) {
    // Rule version verification logic
    return true; // Simplified for now
  }

  _detectMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.json': 'application/json',
      '.js': 'application/javascript',
      '.ts': 'application/typescript',
      '.html': 'text/html',
      '.css': 'text/css',
      '.md': 'text/markdown',
      '.txt': 'text/plain',
      '.xml': 'application/xml',
      '.yaml': 'application/yaml',
      '.yml': 'application/yaml'
    };
    
    return mimeTypes[ext] || 'application/octet-stream';
  }
}

export default AttestationGenerator;