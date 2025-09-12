/**
 * Cryptographic Manager - Handles signing and verification for provenance
 * 
 * Provides cryptographic services including digital signatures, hash verification,
 * and key management for provenance attestations and integrity chains.
 */

import crypto from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import consola from 'consola';

export class CryptoManager {
  constructor(config = {}) {
    this.config = {
      algorithm: config.signatureAlgorithm || 'RSA-SHA256',
      hashAlgorithm: config.hashAlgorithm || 'sha256',
      keySize: config.keySize || 2048,
      keyPath: config.keyPath || './keys/provenance.pem',
      publicKeyPath: config.publicKeyPath || './keys/provenance.pub',
      autoGenerateKeys: config.autoGenerateKeys !== false,
      keyPassphrase: config.keyPassphrase || process.env.KGEN_KEY_PASSPHRASE,
      enableKeyRotation: config.enableKeyRotation || false,
      keyRotationInterval: config.keyRotationInterval || 86400000, // 24 hours
      ...config
    };
    
    this.logger = consola.withTag('crypto-manager');
    
    // Key storage
    this.privateKey = null;
    this.publicKey = null;
    this.keyMetadata = {
      generated: null,
      algorithm: this.config.algorithm,
      size: this.config.keySize,
      fingerprint: null
    };
    
    // Signature cache for performance
    this.signatureCache = new Map();
    this.verificationCache = new Map();
    this.maxCacheSize = config.maxCacheSize || 1000;
    
    this.state = 'uninitialized';
  }

  /**
   * Initialize cryptographic manager
   */
  async initialize() {
    try {
      this.logger.info('Initializing cryptographic manager...');
      
      // Load or generate keys
      await this._loadOrGenerateKeys();
      
      // Initialize key rotation if enabled
      if (this.config.enableKeyRotation) {
        await this._startKeyRotation();
      }
      
      this.state = 'ready';
      this.logger.success('Cryptographic manager initialized successfully');
      
      return {
        status: 'success',
        algorithm: this.config.algorithm,
        keySize: this.config.keySize,
        publicKeyFingerprint: this.keyMetadata.fingerprint
      };
      
    } catch (error) {
      this.logger.error('Failed to initialize cryptographic manager:', error);
      this.state = 'error';
      throw error;
    }
  }

  /**
   * Sign data with private key
   * @param {Object|string} data - Data to sign
   * @param {Object} options - Signing options
   * @returns {Promise<string>} Digital signature
   */
  async signData(data, options = {}) {
    try {
      if (this.state !== 'ready') {
        throw new Error('Cryptographic manager not initialized');
      }
      
      if (!this.privateKey) {
        throw new Error('Private key not available');
      }
      
      // Prepare data for signing
      const dataToSign = typeof data === 'string' ? data : JSON.stringify(data, null, 0);
      
      // Check cache first
      const cacheKey = this._generateCacheKey(dataToSign, 'sign');
      if (this.signatureCache.has(cacheKey) && !options.skipCache) {
        return this.signatureCache.get(cacheKey);
      }
      
      // Create signature
      const sign = crypto.createSign(this.config.algorithm);
      sign.update(dataToSign, 'utf8');
      
      const signature = sign.sign({
        key: this.privateKey,
        passphrase: this.config.keyPassphrase || 'kgen-default-passphrase'
      }, 'base64');
      
      // Cache signature
      this._cacheSignature(cacheKey, signature);
      
      this.logger.debug('Data signed successfully');
      
      return signature;
      
    } catch (error) {
      this.logger.error('Failed to sign data:', error);
      throw error;
    }
  }

  /**
   * Verify signature with public key
   * @param {Object|string} data - Original data
   * @param {string} signature - Signature to verify
   * @param {Object} options - Verification options
   * @returns {Promise<boolean>} Verification result
   */
  async verifySignature(data, signature, options = {}) {
    try {
      if (this.state !== 'ready') {
        throw new Error('Cryptographic manager not initialized');
      }
      
      if (!this.publicKey) {
        throw new Error('Public key not available');
      }
      
      // Prepare data for verification
      const dataToVerify = typeof data === 'string' ? data : JSON.stringify(data, null, 0);
      
      // Check cache first
      const cacheKey = this._generateCacheKey(dataToVerify + signature, 'verify');
      if (this.verificationCache.has(cacheKey) && !options.skipCache) {
        return this.verificationCache.get(cacheKey);
      }
      
      // Verify signature
      const verify = crypto.createVerify(this.config.algorithm);
      verify.update(dataToVerify, 'utf8');
      
      const isValid = verify.verify(this.publicKey, signature, 'base64');
      
      // Cache verification result
      this._cacheVerification(cacheKey, isValid);
      
      this.logger.debug(`Signature verification: ${isValid ? 'valid' : 'invalid'}`);
      
      return isValid;
      
    } catch (error) {
      this.logger.error('Failed to verify signature:', error);
      return false;
    }
  }

  /**
   * Generate hash for data
   * @param {Object|string|Buffer} data - Data to hash
   * @param {Object} options - Hashing options
   * @returns {string} Hash digest
   */
  generateHash(data, options = {}) {
    try {
      const algorithm = options.algorithm || this.config.hashAlgorithm;
      const encoding = options.encoding || 'hex';
      
      const hash = crypto.createHash(algorithm);
      
      if (Buffer.isBuffer(data)) {
        hash.update(data);
      } else if (typeof data === 'string') {
        hash.update(data, 'utf8');
      } else {
        hash.update(JSON.stringify(data, null, 0), 'utf8');
      }
      
      return hash.digest(encoding);
      
    } catch (error) {
      this.logger.error('Failed to generate hash:', error);
      throw error;
    }
  }

  /**
   * Verify hash integrity
   * @param {Object|string|Buffer} data - Original data
   * @param {string} expectedHash - Expected hash
   * @param {Object} options - Verification options
   * @returns {boolean} Hash verification result
   */
  verifyHash(data, expectedHash, options = {}) {
    try {
      const actualHash = this.generateHash(data, options);
      return actualHash === expectedHash;
    } catch (error) {
      this.logger.error('Failed to verify hash:', error);
      return false;
    }
  }

  /**
   * Generate key pair for signing
   * @param {Object} options - Key generation options
   * @returns {Promise<Object>} Generated key pair
   */
  async generateKeyPair(options = {}) {
    try {
      this.logger.info('Generating new key pair...');
      
      // Ensure we have a passphrase for key encryption
      const passphrase = options.passphrase || this.config.keyPassphrase || 'kgen-default-passphrase';
      
      const keyOptions = {
        modulusLength: options.keySize || this.config.keySize,
        publicKeyEncoding: {
          type: 'spki',
          format: 'pem'
        },
        privateKeyEncoding: {
          type: 'pkcs8',
          format: 'pem',
          cipher: 'aes-256-cbc',
          passphrase: passphrase
        }
      };
      
      const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', keyOptions);
      
      // Calculate fingerprint
      const fingerprint = this._calculateKeyFingerprint(publicKey);
      
      const keyPair = {
        publicKey,
        privateKey,
        fingerprint,
        algorithm: this.config.algorithm,
        size: keyOptions.modulusLength,
        generated: new Date().toISOString()
      };
      
      this.logger.success(`Generated ${keyOptions.modulusLength}-bit RSA key pair`);
      
      return keyPair;
      
    } catch (error) {
      this.logger.error('Failed to generate key pair:', error);
      throw error;
    }
  }

  /**
   * Save key pair to files
   * @param {Object} keyPair - Key pair to save
   * @param {Object} options - Save options
   */
  async saveKeyPair(keyPair, options = {}) {
    try {
      const privateKeyPath = options.privateKeyPath || this.config.keyPath;
      const publicKeyPath = options.publicKeyPath || this.config.publicKeyPath;
      
      // Ensure directories exist
      await fs.mkdir(path.dirname(privateKeyPath), { recursive: true });
      await fs.mkdir(path.dirname(publicKeyPath), { recursive: true });
      
      // Save private key
      await fs.writeFile(privateKeyPath, keyPair.privateKey, { mode: 0o600 });
      
      // Save public key
      await fs.writeFile(publicKeyPath, keyPair.publicKey, { mode: 0o644 });
      
      // Save metadata
      const metadataPath = `${privateKeyPath}.meta`;
      const metadata = {
        fingerprint: keyPair.fingerprint,
        algorithm: keyPair.algorithm,
        size: keyPair.size,
        generated: keyPair.generated
      };
      await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
      
      this.logger.success(`Saved key pair to ${privateKeyPath} and ${publicKeyPath}`);
      
    } catch (error) {
      this.logger.error('Failed to save key pair:', error);
      throw error;
    }
  }

  /**
   * Load key pair from files
   * @param {Object} options - Load options
   * @returns {Promise<Object>} Loaded key pair
   */
  async loadKeyPair(options = {}) {
    try {
      const privateKeyPath = options.privateKeyPath || this.config.keyPath;
      const publicKeyPath = options.publicKeyPath || this.config.publicKeyPath;
      
      // Load private key
      const privateKey = await fs.readFile(privateKeyPath, 'utf8');
      
      // Load public key
      const publicKey = await fs.readFile(publicKeyPath, 'utf8');
      
      // Load metadata if available
      const metadataPath = `${privateKeyPath}.meta`;
      let metadata = {};
      try {
        const metadataContent = await fs.readFile(metadataPath, 'utf8');
        metadata = JSON.parse(metadataContent);
      } catch (error) {
        // Calculate fingerprint if metadata not available
        metadata.fingerprint = this._calculateKeyFingerprint(publicKey);
      }
      
      const keyPair = {
        publicKey,
        privateKey,
        fingerprint: metadata.fingerprint,
        algorithm: metadata.algorithm || this.config.algorithm,
        size: metadata.size || this.config.keySize,
        generated: metadata.generated
      };
      
      this.logger.success('Loaded key pair successfully');
      
      return keyPair;
      
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`Key files not found. Expected: ${privateKeyPath}, ${publicKeyPath}`);
      }
      this.logger.error('Failed to load key pair:', error);
      throw error;
    }
  }

  /**
   * Rotate keys (generate new pair and update)
   * @param {Object} options - Rotation options
   */
  async rotateKeys(options = {}) {
    try {
      this.logger.info('Rotating cryptographic keys...');
      
      // Generate new key pair
      const newKeyPair = await this.generateKeyPair(options);
      
      // Backup old keys
      if (this.privateKey && options.backupOld !== false) {
        await this._backupCurrentKeys();
      }
      
      // Update current keys
      this.privateKey = newKeyPair.privateKey;
      this.publicKey = newKeyPair.publicKey;
      this.keyMetadata = {
        generated: newKeyPair.generated,
        algorithm: newKeyPair.algorithm,
        size: newKeyPair.size,
        fingerprint: newKeyPair.fingerprint
      };
      
      // Save new keys
      await this.saveKeyPair(newKeyPair);
      
      // Clear caches
      this.signatureCache.clear();
      this.verificationCache.clear();
      
      this.logger.success('Key rotation completed successfully');
      
      return {
        newFingerprint: newKeyPair.fingerprint,
        rotatedAt: new Date().toISOString()
      };
      
    } catch (error) {
      this.logger.error('Failed to rotate keys:', error);
      throw error;
    }
  }

  /**
   * Create cryptographic signature chain
   * @param {Array} operations - Array of operations to chain
   * @returns {Promise<Object>} Signature chain
   */
  async createSignatureChain(operations) {
    try {
      this.logger.info(`Creating signature chain for ${operations.length} operations`);
      
      const chain = {
        id: crypto.randomUUID(),
        created: new Date().toISOString(),
        algorithm: this.config.algorithm,
        keyFingerprint: this.keyMetadata.fingerprint,
        links: []
      };
      
      let previousHash = null;
      
      for (const [index, operation] of operations.entries()) {
        // Create operation data for signing
        const operationData = {
          index,
          operationId: operation.operationId,
          type: operation.type,
          timestamp: operation.endTime || operation.startTime,
          integrityHash: operation.integrityHash,
          previousHash
        };
        
        // Sign the operation data
        const signature = await this.signData(operationData);
        
        // Calculate link hash
        const linkHash = this.generateHash({
          ...operationData,
          signature
        });
        
        const link = {
          index,
          operationId: operation.operationId,
          operationHash: operation.integrityHash,
          previousHash,
          linkHash,
          signature,
          timestamp: operationData.timestamp
        };
        
        chain.links.push(link);
        previousHash = linkHash;
      }
      
      // Sign the entire chain
      chain.chainSignature = await this.signData({
        chainId: chain.id,
        links: chain.links.map(l => l.linkHash),
        keyFingerprint: chain.keyFingerprint
      });
      
      this.logger.success(`Created signature chain with ${chain.links.length} links`);
      
      return chain;
      
    } catch (error) {
      this.logger.error('Failed to create signature chain:', error);
      throw error;
    }
  }

  /**
   * Verify signature chain integrity
   * @param {Object} chain - Signature chain to verify
   * @returns {Promise<Object>} Verification result
   */
  async verifySignatureChain(chain) {
    try {
      this.logger.info(`Verifying signature chain ${chain.id}`);
      
      const result = {
        valid: true,
        chainId: chain.id,
        totalLinks: chain.links.length,
        validLinks: 0,
        brokenLinks: [],
        errors: []
      };
      
      // Verify chain signature
      const chainData = {
        chainId: chain.id,
        links: chain.links.map(l => l.linkHash),
        keyFingerprint: chain.keyFingerprint
      };
      
      const chainSignatureValid = await this.verifySignature(chainData, chain.chainSignature);
      if (!chainSignatureValid) {
        result.valid = false;
        result.errors.push('Chain signature verification failed');
      }
      
      // Verify each link
      let expectedPreviousHash = null;
      
      for (const [index, link] of chain.links.entries()) {
        const linkValid = await this._verifyChainLink(link, expectedPreviousHash, index);
        
        if (linkValid.valid) {
          result.validLinks++;
        } else {
          result.valid = false;
          result.brokenLinks.push({
            index,
            operationId: link.operationId,
            errors: linkValid.errors
          });
        }
        
        expectedPreviousHash = link.linkHash;
      }
      
      result.integrityScore = chain.links.length > 0 ? result.validLinks / chain.links.length : 1;
      
      this.logger.info(`Chain verification completed: ${result.valid ? 'VALID' : 'INVALID'}`);
      
      return result;
      
    } catch (error) {
      this.logger.error('Failed to verify signature chain:', error);
      return {
        valid: false,
        error: error.message,
        chainId: chain?.id
      };
    }
  }

  /**
   * Generate attestation signature for artifact
   * @param {Object} attestation - Attestation to sign
   * @returns {Promise<Object>} Signed attestation
   */
  async signAttestation(attestation) {
    try {
      // Create signing data (exclude signature field)
      const signingData = {
        attestationId: attestation.attestationId,
        artifactId: attestation.artifactId,
        artifact: attestation.artifact,
        generation: attestation.generation,
        provenance: attestation.provenance,
        system: attestation.system,
        integrity: attestation.integrity,
        timestamps: attestation.timestamps
      };
      
      // Generate signature
      const signature = await this.signData(signingData);
      
      // Create signature metadata
      const signatureMetadata = {
        algorithm: this.config.algorithm,
        keyFingerprint: this.keyMetadata.fingerprint,
        signedAt: new Date().toISOString(),
        signature
      };
      
      // Return attestation with signature
      return {
        ...attestation,
        signature: signatureMetadata
      };
      
    } catch (error) {
      this.logger.error('Failed to sign attestation:', error);
      throw error;
    }
  }

  /**
   * Verify attestation signature
   * @param {Object} attestation - Attestation to verify
   * @returns {Promise<boolean>} Verification result
   */
  async verifyAttestation(attestation) {
    try {
      if (!attestation.signature) {
        return false;
      }
      
      // Extract signing data
      const signingData = {
        attestationId: attestation.attestationId,
        artifactId: attestation.artifactId,
        artifact: attestation.artifact,
        generation: attestation.generation,
        provenance: attestation.provenance,
        system: attestation.system,
        integrity: attestation.integrity,
        timestamps: attestation.timestamps
      };
      
      // Verify signature
      return await this.verifySignature(signingData, attestation.signature.signature);
      
    } catch (error) {
      this.logger.error('Failed to verify attestation signature:', error);
      return false;
    }
  }

  /**
   * Get crypto manager status
   */
  getStatus() {
    return {
      state: this.state,
      algorithm: this.config.algorithm,
      hashAlgorithm: this.config.hashAlgorithm,
      keySize: this.config.keySize,
      keyMetadata: this.keyMetadata,
      cacheStats: {
        signatures: this.signatureCache.size,
        verifications: this.verificationCache.size,
        maxSize: this.maxCacheSize
      },
      features: {
        keyRotation: this.config.enableKeyRotation,
        autoGenerate: this.config.autoGenerateKeys
      }
    };
  }

  // Private methods

  async _loadOrGenerateKeys() {
    try {
      // Try to load existing keys
      const keyPair = await this.loadKeyPair();
      this.privateKey = keyPair.privateKey;
      this.publicKey = keyPair.publicKey;
      this.keyMetadata = {
        generated: keyPair.generated,
        algorithm: keyPair.algorithm,
        size: keyPair.size,
        fingerprint: keyPair.fingerprint
      };
      
      this.logger.info('Loaded existing key pair');
      
    } catch (error) {
      if (this.config.autoGenerateKeys) {
        this.logger.info('Existing keys not found, generating new pair...');
        
        // Generate new key pair
        const keyPair = await this.generateKeyPair();
        this.privateKey = keyPair.privateKey;
        this.publicKey = keyPair.publicKey;
        this.keyMetadata = {
          generated: keyPair.generated,
          algorithm: keyPair.algorithm,
          size: keyPair.size,
          fingerprint: keyPair.fingerprint
        };
        
        // Save new keys
        await this.saveKeyPair(keyPair);
        
      } else {
        throw new Error('Keys not found and auto-generation disabled');
      }
    }
  }

  async _startKeyRotation() {
    setInterval(async () => {
      try {
        await this.rotateKeys();
      } catch (error) {
        this.logger.error('Automatic key rotation failed:', error);
      }
    }, this.config.keyRotationInterval);
    
    this.logger.info(`Key rotation scheduled every ${this.config.keyRotationInterval}ms`);
  }

  async _backupCurrentKeys() {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupDir = path.join(path.dirname(this.config.keyPath), 'backup');
      
      await fs.mkdir(backupDir, { recursive: true });
      
      const backupPrivatePath = path.join(backupDir, `provenance-${timestamp}.pem`);
      const backupPublicPath = path.join(backupDir, `provenance-${timestamp}.pub`);
      
      await fs.writeFile(backupPrivatePath, this.privateKey);
      await fs.writeFile(backupPublicPath, this.publicKey);
      
      this.logger.info(`Backed up keys to ${backupDir}`);
      
    } catch (error) {
      this.logger.warn('Failed to backup current keys:', error);
    }
  }

  _calculateKeyFingerprint(publicKey) {
    const hash = crypto.createHash('sha256');
    hash.update(publicKey);
    return hash.digest('hex').substring(0, 16);
  }

  _generateCacheKey(data, operation) {
    const hash = crypto.createHash('md5');
    hash.update(`${operation}:${data}`);
    return hash.digest('hex');
  }

  _cacheSignature(key, signature) {
    if (this.signatureCache.size >= this.maxCacheSize) {
      // Simple LRU eviction
      const firstKey = this.signatureCache.keys().next().value;
      this.signatureCache.delete(firstKey);
    }
    
    this.signatureCache.set(key, signature);
  }

  _cacheVerification(key, result) {
    if (this.verificationCache.size >= this.maxCacheSize) {
      // Simple LRU eviction
      const firstKey = this.verificationCache.keys().next().value;
      this.verificationCache.delete(firstKey);
    }
    
    this.verificationCache.set(key, result);
  }

  /**
   * Generate Merkle tree for batch operations
   * @param {Array} operations - Operations to include in tree
   * @returns {Object} Merkle tree data
   */
  generateMerkleTree(operations) {
    try {
      if (operations.length === 0) {
        return {
          root: null,
          tree: [],
          proofs: new Map()
        };
      }
      
      // Create leaf hashes
      const leaves = operations.map(op => this.generateHash(op.integrityHash || op.operationId));
      
      // Build tree bottom-up
      const tree = [leaves];
      let currentLevel = leaves;
      
      while (currentLevel.length > 1) {
        const nextLevel = [];
        
        for (let i = 0; i < currentLevel.length; i += 2) {
          const left = currentLevel[i];
          const right = i + 1 < currentLevel.length ? currentLevel[i + 1] : left;
          const combined = this.generateHash(left + right);
          nextLevel.push(combined);
        }
        
        tree.push(nextLevel);
        currentLevel = nextLevel;
      }
      
      const root = currentLevel[0];
      
      // Generate proofs for each operation
      const proofs = new Map();
      
      for (let i = 0; i < operations.length; i++) {
        const proof = this._generateMerkleProof(tree, i);
        proofs.set(operations[i].operationId, proof);
      }
      
      return {
        root,
        tree,
        proofs
      };
      
    } catch (error) {
      this.logger.error('Failed to generate Merkle tree:', error);
      throw error;
    }
  }

  /**
   * Verify Merkle proof
   * @param {string} leaf - Leaf hash to verify
   * @param {Array} proof - Merkle proof path
   * @param {string} root - Expected root hash
   * @returns {boolean} Verification result
   */
  verifyMerkleProof(leaf, proof, root) {
    try {
      let currentHash = leaf;
      
      for (const proofElement of proof) {
        if (proofElement.position === 'left') {
          currentHash = this.generateHash(proofElement.hash + currentHash);
        } else {
          currentHash = this.generateHash(currentHash + proofElement.hash);
        }
      }
      
      return currentHash === root;
      
    } catch (error) {
      this.logger.error('Failed to verify Merkle proof:', error);
      return false;
    }
  }

  _generateMerkleProof(tree, leafIndex) {
    const proof = [];
    let currentIndex = leafIndex;
    
    for (let level = 0; level < tree.length - 1; level++) {
      const currentLevel = tree[level];
      const siblingIndex = currentIndex % 2 === 0 ? currentIndex + 1 : currentIndex - 1;
      
      if (siblingIndex < currentLevel.length) {
        proof.push({
          hash: currentLevel[siblingIndex],
          position: currentIndex % 2 === 0 ? 'right' : 'left'
        });
      }
      
      currentIndex = Math.floor(currentIndex / 2);
    }
    
    return proof;
  }

  async _verifyChainLink(link, expectedPreviousHash, expectedIndex) {
    try {
      const errors = [];
      
      // Verify previous hash
      if (link.previousHash !== expectedPreviousHash) {
        errors.push(`Previous hash mismatch: expected ${expectedPreviousHash}, got ${link.previousHash}`);
      }
      
      // Verify index sequence
      if (link.index !== expectedIndex) {
        errors.push(`Index mismatch: expected ${expectedIndex}, got ${link.index}`);
      }
      
      // Verify link signature
      const linkData = {
        index: link.index,
        operationId: link.operationId,
        operationHash: link.operationHash,
        previousHash: link.previousHash,
        timestamp: link.timestamp
      };
      
      const signatureValid = await this.verifySignature(linkData, link.signature);
      if (!signatureValid) {
        errors.push('Link signature verification failed');
      }
      
      // Verify link hash
      const expectedLinkHash = this.generateHash({
        ...linkData,
        signature: link.signature
      });
      
      if (link.linkHash !== expectedLinkHash) {
        errors.push(`Link hash mismatch: expected ${expectedLinkHash}, got ${link.linkHash}`);
      }
      
      return {
        valid: errors.length === 0,
        errors
      };
      
    } catch (error) {
      return {
        valid: false,
        errors: [`Chain link verification failed: ${error.message}`]
      };
    }
  }
}

export default CryptoManager;