/**
 * Hash Chain Anchor - Immutable audit trail anchoring
 * 
 * Provides hash chain-based anchoring for provenance records to ensure
 * tamper-evident audit trails with cryptographic proof of integrity.
 */

import consola from 'consola';
import crypto from 'crypto';
import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import { KGenErrorHandler, createEnhancedTryCatch } from '../../utils/error-handler.js';

export class BlockchainAnchor extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      hashAlgorithm: config.hashAlgorithm || 'sha256',
      signatureAlgorithm: config.signatureAlgorithm || 'RSA-SHA256',
      interval: config.blockchainInterval || 3600000, // 1 hour
      batchSize: config.blockchainBatchSize || 100,
      confirmations: config.confirmations || 6,
      retryAttempts: config.retryAttempts || 3,
      enableDigitalSignatures: config.enableDigitalSignatures || false,
      keyPath: config.keyPath,
      chainValidationInterval: config.chainValidationInterval || 300000, // 5 minutes
      ...config
    };

    this.logger = consola.withTag('hash-chain-anchor');
    
    // Hash chain state
    this.pendingAnchors = [];
    this.anchorHistory = [];
    this.merkleRoots = new Map();
    this.intervalTimer = null;
    this.hashChain = [];
    this.privateKey = null;
    this.digitalSignatures = new Map();
    this.validationTimer = null;

    this.state = 'initialized';
    
    // Initialize comprehensive error handler
    this.errorHandler = new KGenErrorHandler({
      enableRecovery: true,
      maxRetryAttempts: config.retryAttempts || 3,
      retryDelay: 1000,
      enableEventEmission: true
    });
    this._setupErrorRecoveryStrategies();
  }

  /**
   * Initialize hash chain anchor
   */
  async initialize() {
    try {
      this.logger.info('Initializing hash chain anchor');

      // Initialize hash chain with genesis block
      await this._initializeHashChain();

      // Load digital signature keys if enabled
      if (this.config.enableDigitalSignatures) {
        await this._loadSignatureKeys();
      }

      // Start periodic anchoring
      await this._startPeriodicAnchoring();

      // Start hash chain validation
      await this._startChainValidation();

      // Load existing anchor history
      await this._loadAnchorHistory();

      this.state = 'ready';
      this.logger.success('Hash chain anchor initialized successfully');

      return { 
        status: 'success', 
        chainLength: this.hashChain.length,
        signaturesEnabled: this.config.enableDigitalSignatures
      };

    } catch (error) {
      const operationId = 'blockchain-anchor:initialize';
      const errorContext = {
        component: 'blockchain-anchor',
        operation: 'initialization',
        input: {
          signaturesEnabled: this.config.enableDigitalSignatures,
          interval: this.config.interval,
          batchSize: this.config.batchSize
        },
        state: { currentState: this.state, chainLength: this.hashChain.length }
      };
      
      const handlingResult = await this.errorHandler.handleError(
        operationId,
        error,
        errorContext,
        { suppressRethrow: false }
      );
      
      this.state = 'error';
      this.emit('error', {
        operationId,
        error,
        errorContext: handlingResult.errorContext
      });
      
      throw error;
    }
  }

  /**
   * Queue provenance record for anchoring
   * @param {string} recordId - Record identifier
   * @param {string} hash - Record hash
   * @param {Object} metadata - Additional metadata
   * @param {Date} timestamp - Optional deterministic timestamp
   */
  async queueForAnchoring(recordId, hash, metadata = {}, timestamp = null) {
    try {
      const anchorEntry = {
        id: recordId,
        hash,
        timestamp: timestamp || new Date(),
        metadata,
        status: 'pending'
      };

      this.pendingAnchors.push(anchorEntry);
      
      this.logger.debug(`Queued record for anchoring: ${recordId}`);
      this.emit('queued', { recordId, hash });

      // Immediate anchoring if batch size reached
      if (this.pendingAnchors.length >= this.config.batchSize) {
        await this._performAnchoring();
      }

      return { status: 'queued', recordId, hash };

    } catch (error) {
      const operationId = `queue-anchor:${recordId}`;
      const errorContext = {
        component: 'blockchain-anchor',
        operation: 'queue-anchoring',
        input: { recordId, hash, metadata },
        state: {
          pendingCount: this.pendingAnchors.length,
          chainLength: this.hashChain.length
        }
      };
      
      const handlingResult = await this.errorHandler.handleError(
        operationId,
        error,
        errorContext
      );
      
      if (!handlingResult.recovered) {
        throw error;
      }
      
      return handlingResult.result;
    }
  }

  /**
   * Verify anchor integrity
   * @param {string} recordId - Record identifier
   * @param {string} hash - Record hash to verify
   */
  async verifyAnchor(recordId, hash) {
    try {
      this.logger.info(`Verifying anchor for record: ${recordId}`);

      // Find anchor record
      const anchorRecord = this._findAnchorRecord(recordId);
      if (!anchorRecord) {
        return {
          verified: false,
          reason: 'No anchor record found',
          recordId
        };
      }

      // Verify hash chain integrity
      const chainVerification = await this.verifyHashChain();

      // Verify hash inclusion in Merkle tree
      const merkleVerification = this._verifyMerkleInclusion(
        hash,
        anchorRecord.merkleProof,
        anchorRecord.merkleRoot
      );

      // Verify digital signature if available
      let signatureVerification = { verified: true };
      if (anchorRecord.digitalSignature) {
        signatureVerification = this._verifyDigitalSignature(
          anchorRecord,
          anchorRecord.digitalSignature
        );
      }

      const verified = chainVerification.integrityScore >= 0.95 && 
                      merkleVerification.verified && 
                      signatureVerification.verified;

      const result = {
        verified,
        recordId,
        anchorRecord,
        chainVerification,
        merkleVerification,
        signatureVerification,
        verifiedAt: new Date()
      };

      this.emit('verified', result);
      return result;

    } catch (error) {
      const operationId = `verify-anchor:${recordId}`;
      const errorContext = {
        component: 'blockchain-anchor',
        operation: 'anchor-verification',
        input: { recordId, hash },
        state: {
          chainLength: this.hashChain.length,
          anchorHistorySize: this.anchorHistory.length
        }
      };
      
      const handlingResult = await this.errorHandler.handleError(
        operationId,
        error,
        errorContext
      );
      
      if (!handlingResult.recovered) {
        throw error;
      }
      
      return handlingResult.result || {
        verified: false,
        reason: 'Verification failed with recoverable error',
        errorId: handlingResult.errorContext.errorId
      };
    }
  }

  /**
   * Get anchor status for record
   * @param {string} recordId - Record identifier
   */
  getAnchorStatus(recordId) {
    // Check pending anchors
    const pending = this.pendingAnchors.find(a => a.id === recordId);
    if (pending) {
      return {
        status: 'pending',
        queuedAt: pending.timestamp,
        recordId
      };
    }

    // Check anchor history
    const anchored = this._findAnchorRecord(recordId);
    if (anchored) {
      return {
        status: 'anchored',
        blockIndex: anchored.blockIndex,
        blockHash: anchored.blockHash,
        chainLength: this.hashChain.length,
        hasSignature: !!anchored.digitalSignature,
        anchoredAt: anchored.timestamp,
        recordId
      };
    }

    return {
      status: 'not_found',
      recordId
    };
  }

  /**
   * Get anchoring statistics
   */
  getStatistics() {
    const totalAnchored = this.anchorHistory.length;
    const pendingCount = this.pendingAnchors.length;
    
    const successfulAnchors = this.anchorHistory.filter(a => a.status === 'confirmed').length;
    const failedAnchors = this.anchorHistory.filter(a => a.status === 'failed').length;

    return {
      totalAnchored,
      pendingCount,
      successfulAnchors,
      failedAnchors,
      successRate: totalAnchored > 0 ? successfulAnchors / totalAnchored : 1,
      chainLength: this.hashChain.length,
      signaturesEnabled: this.config.enableDigitalSignatures,
      totalSignatures: this.digitalSignatures.size,
      state: this.state
    };
  }

  /**
   * Shutdown hash chain anchor
   */
  async shutdown() {
    try {
      this.logger.info('Shutting down hash chain anchor...');

      // Clear interval timer
      if (this.intervalTimer) {
        clearInterval(this.intervalTimer);
        this.intervalTimer = null;
      }

      // Clear validation timer
      if (this.validationTimer) {
        clearInterval(this.validationTimer);
        this.validationTimer = null;
      }

      // Anchor any remaining pending records
      if (this.pendingAnchors.length > 0) {
        this.logger.info(`Anchoring ${this.pendingAnchors.length} remaining records`);
        await this._performAnchoring();
      }

      this.state = 'shutdown';
      this.logger.success('Hash chain anchor shutdown completed');

    } catch (error) {
      const operationId = 'blockchain-anchor:shutdown';
      const errorContext = {
        component: 'blockchain-anchor',
        operation: 'shutdown',
        state: {
          pendingAnchors: this.pendingAnchors.length,
          timersActive: !!(this.intervalTimer || this.validationTimer)
        }
      };
      
      await this.errorHandler.handleError(
        operationId,
        error,
        errorContext,
        { suppressRethrow: false }
      );
      
      throw error;
    }
  }

  // Private methods

  async _initializeHashChain() {
    // Initialize hash chain with genesis block
    if (this.hashChain.length === 0) {
      const genesisBlock = {
        index: 0,
        timestamp: new Date(),
        operationId: 'genesis',
        previousHash: '0',
        hash: crypto.createHash(this.config.hashAlgorithm)
          .update('genesis-block')
          .digest('hex')
      };
      
      this.hashChain.push(genesisBlock);
    }
  }

  async _loadSignatureKeys() {
    try {
      if (this.config.keyPath && await fs.access(this.config.keyPath).then(() => true).catch(() => false)) {
        this.privateKey = await fs.readFile(this.config.keyPath, 'utf8');
        this.logger.info('Digital signature keys loaded');
      } else {
        this.logger.warn('Digital signature enabled but no keys found');
      }
    } catch (error) {
      const operationId = 'blockchain-anchor:load-keys';
      const errorContext = {
        component: 'blockchain-anchor',
        operation: 'load-signature-keys',
        input: { keyPath: this.config.keyPath }
      };
      
      await this.errorHandler.handleError(
        operationId,
        error,
        errorContext,
        { suppressRethrow: true }
      );
    }
  }

  async _startPeriodicAnchoring() {
    this.intervalTimer = setInterval(async () => {
      if (this.pendingAnchors.length > 0) {
        try {
          await this._performAnchoring();
        } catch (error) {
          const operationId = 'blockchain-anchor:periodic-anchoring';
          const errorContext = {
            component: 'blockchain-anchor',
            operation: 'periodic-anchoring',
            state: { pendingCount: this.pendingAnchors.length }
          };
          
          await this.errorHandler.handleError(
            operationId,
            error,
            errorContext,
            { suppressRethrow: true }
          );
        }
      }
    }, this.config.interval);
  }

  async _startChainValidation() {
    this.validationTimer = setInterval(async () => {
      try {
        const result = await this.verifyHashChain();
        if (result.integrityScore < 0.95) {
          this.logger.warn('Hash chain integrity degraded:', result);
        }
      } catch (error) {
        const operationId = 'blockchain-anchor:chain-validation';
        const errorContext = {
          component: 'blockchain-anchor',
          operation: 'chain-validation',
          state: { chainLength: this.hashChain.length }
        };
        
        await this.errorHandler.handleError(
          operationId,
          error,
          errorContext,
          { suppressRethrow: true }
        );
      }
    }, this.config.chainValidationInterval);
  }

  async _loadAnchorHistory() {
    // Load existing anchor history from storage
    // This would typically load from a database or file
    this.anchorHistory = [];
  }

  async _performAnchoring() {
    if (this.pendingAnchors.length === 0) {
      return;
    }

    try {
      this.logger.info(`Anchoring ${this.pendingAnchors.length} records to hash chain`);

      // Create Merkle tree
      const merkleTree = this._buildMerkleTree(this.pendingAnchors);
      const merkleRoot = merkleTree.root;

      // Store Merkle tree
      const treeId = crypto.createHash('sha256')
        .update(`${this.hashChain.length}-${merkleRoot}`)
        .digest('hex');
      this.merkleRoots.set(treeId, merkleTree);

      // Add to hash chain
      const blockData = await this._addToHashChain({
        operationId: `anchor-batch-${this.hashChain.length}`,
        type: 'anchor',
        endTime: new Date(),
        integrityHash: merkleRoot
      });

      // Generate digital signature if enabled
      let digitalSignature = null;
      if (this.config.enableDigitalSignatures && this.privateKey) {
        digitalSignature = await this._generateDigitalSignature({
          operationId: blockData.operationId,
          integrityHash: merkleRoot,
          endTime: blockData.timestamp
        });
      }

      // Update pending anchors
      for (const [index, anchor] of this.pendingAnchors.entries()) {
        const anchorRecord = {
          ...anchor,
          status: 'confirmed',
          blockIndex: this.hashChain.length - 1,
          blockHash: blockData.hash,
          merkleRoot,
          merkleProof: merkleTree.getProof(index),
          treeId,
          digitalSignature
        };

        this.anchorHistory.push(anchorRecord);
      }

      // Store signature if generated
      if (digitalSignature) {
        this.digitalSignatures.set(blockData.operationId, digitalSignature);
      }

      // Clear pending anchors
      const anchoredCount = this.pendingAnchors.length;
      this.pendingAnchors = [];

      this.logger.success(`Successfully anchored ${anchoredCount} records. Block: ${blockData.hash}`);
      this.emit('anchored', {
        count: anchoredCount,
        blockIndex: this.hashChain.length - 1,
        blockHash: blockData.hash,
        merkleRoot
      });

    } catch (error) {
      const operationId = `perform-anchoring:${this.hashChain.length}`;
      const errorContext = {
        component: 'blockchain-anchor',
        operation: 'batch-anchoring',
        input: { pendingCount: this.pendingAnchors.length },
        state: { chainLength: this.hashChain.length }
      };
      
      const handlingResult = await this.errorHandler.handleError(
        operationId,
        error,
        errorContext
      );
      
      // Mark failed anchors with enhanced error context
      for (const anchor of this.pendingAnchors) {
        anchor.status = 'failed';
        anchor.error = error.message;
        anchor.errorId = handlingResult.errorContext?.errorId;
        anchor.classification = handlingResult.errorContext?.classification;
        this.anchorHistory.push(anchor);
      }
      
      this.pendingAnchors = [];
      
      if (!handlingResult.recovered) {
        throw error;
      }
      
      return handlingResult.result;
    }
  }

  _buildMerkleTree(records) {
    // Simple Merkle tree implementation
    const leaves = records.map(record => 
      crypto.createHash('sha256').update(record.hash).digest('hex')
    );

    const tree = {
      leaves,
      root: null,
      levels: [],
      getProof: (index) => {
        // Generate Merkle proof for given leaf index
        const proof = [];
        let currentIndex = index;
        
        for (const level of tree.levels) {
          const siblingIndex = currentIndex % 2 === 0 ? currentIndex + 1 : currentIndex - 1;
          if (siblingIndex < level.length) {
            proof.push({
              hash: level[siblingIndex],
              position: currentIndex % 2 === 0 ? 'right' : 'left'
            });
          }
          currentIndex = Math.floor(currentIndex / 2);
        }
        
        return proof;
      }
    };

    // Build tree levels
    let currentLevel = [...leaves];
    tree.levels.push([...currentLevel]);

    while (currentLevel.length > 1) {
      const nextLevel = [];
      
      for (let i = 0; i < currentLevel.length; i += 2) {
        const left = currentLevel[i];
        const right = currentLevel[i + 1] || left; // Handle odd number of nodes
        
        const combined = crypto.createHash('sha256')
          .update(left + right)
          .digest('hex');
        
        nextLevel.push(combined);
      }
      
      tree.levels.push([...nextLevel]);
      currentLevel = nextLevel;
    }

    tree.root = currentLevel[0];
    return tree;
  }

  async _addToHashChain(context) {
    const previousBlock = this.hashChain[this.hashChain.length - 1];
    const newBlock = {
      index: this.hashChain.length,
      timestamp: context.endTime,
      operationId: context.operationId,
      previousHash: previousBlock.hash,
      data: {
        type: context.type,
        integrityHash: context.integrityHash
      },
      hash: null
    };
    
    // Calculate block hash
    const blockString = JSON.stringify({
      index: newBlock.index,
      timestamp: newBlock.timestamp,
      operationId: newBlock.operationId,
      previousHash: newBlock.previousHash,
      data: newBlock.data
    }, Object.keys(newBlock).sort());
    
    newBlock.hash = crypto.createHash(this.config.hashAlgorithm)
      .update(blockString)
      .digest('hex');
    
    this.hashChain.push(newBlock);
    return newBlock;
  }

  async verifyHashChain() {
    try {
      this.logger.info('Verifying hash chain integrity');
      
      const verificationResult = {
        totalLinks: this.hashChain.length,
        validLinks: 0,
        brokenLinks: [],
        integrityScore: 0
      };
      
      for (let i = 1; i < this.hashChain.length; i++) {
        const currentLink = this.hashChain[i];
        const previousLink = this.hashChain[i - 1];
        
        if (currentLink.previousHash === previousLink.hash) {
          verificationResult.validLinks++;
        } else {
          verificationResult.brokenLinks.push({
            index: i,
            expected: previousLink.hash,
            actual: currentLink.previousHash,
            operationId: currentLink.operationId
          });
        }
      }
      
      verificationResult.integrityScore = this.hashChain.length > 0 ?
        verificationResult.validLinks / Math.max(1, this.hashChain.length - 1) : 1;
      
      return verificationResult;
      
    } catch (error) {
      const operationId = 'blockchain-anchor:verify-chain';
      const errorContext = {
        component: 'blockchain-anchor',
        operation: 'chain-verification',
        state: { chainLength: this.hashChain.length }
      };
      
      const handlingResult = await this.errorHandler.handleError(
        operationId,
        error,
        errorContext
      );
      
      if (!handlingResult.recovered) {
        throw error;
      }
      
      return handlingResult.result || {
        totalLinks: this.hashChain.length,
        validLinks: 0,
        brokenLinks: [],
        integrityScore: 0,
        error: 'Verification failed but recovered'
      };
    }
  }

  async _generateDigitalSignature(context) {
    if (!this.privateKey) {
      throw new Error('Private key not available for digital signatures');
    }
    
    const dataToSign = JSON.stringify({
      operationId: context.operationId,
      integrityHash: context.integrityHash,
      timestamp: context.endTime
    });
    
    const sign = crypto.createSign(this.config.signatureAlgorithm);
    sign.update(dataToSign);
    return sign.sign(this.privateKey, 'hex');
  }

  _verifyDigitalSignature(context, signature) {
    try {
      if (!this.privateKey) {
        return { verified: false, reason: 'No public key available' };
      }

      const dataToSign = JSON.stringify({
        operationId: context.operationId,
        integrityHash: context.integrityHash,
        timestamp: context.endTime || context.timestamp
      });

      const verify = crypto.createVerify(this.config.signatureAlgorithm);
      verify.update(dataToSign);
      
      // Note: This is simplified - in practice you'd use a public key derived from private key
      const verified = verify.verify(this.privateKey, signature, 'hex');
      
      return {
        verified,
        algorithm: this.config.signatureAlgorithm
      };

    } catch (error) {
      return {
        verified: false,
        error: error.message
      };
    }
  }

  _verifyMerkleInclusion(hash, proof, merkleRoot) {
    try {
      // Verify hash is included in Merkle tree using proof
      let computedHash = crypto.createHash('sha256').update(hash).digest('hex');

      for (const proofElement of proof) {
        if (proofElement.position === 'right') {
          computedHash = crypto.createHash('sha256')
            .update(computedHash + proofElement.hash)
            .digest('hex');
        } else {
          computedHash = crypto.createHash('sha256')
            .update(proofElement.hash + computedHash)
            .digest('hex');
        }
      }

      return {
        verified: computedHash === merkleRoot,
        computedRoot: computedHash,
        expectedRoot: merkleRoot
      };

    } catch (error) {
      return {
        verified: false,
        error: error.message
      };
    }
  }

  _findAnchorRecord(recordId) {
    return this.anchorHistory.find(record => record.id === recordId);
  }
  
  /**
   * Get error handling statistics for blockchain anchor
   */
  getErrorStatistics() {
    return this.errorHandler.getErrorStatistics();
  }
  
  /**
   * Setup error recovery strategies for blockchain anchor
   */
  _setupErrorRecoveryStrategies() {
    // File system error recovery for key loading
    this.errorHandler.registerRecoveryStrategy('filesystem', async (errorContext, options) => {
      this.logger.info('Attempting filesystem error recovery');
      
      if (errorContext.error.code === 'ENOENT' && errorContext.context.operation === 'load-signature-keys') {
        this.logger.warn('Signature key file not found, continuing without digital signatures');
        this.config.enableDigitalSignatures = false;
        return { success: true, reason: 'Disabled digital signatures due to missing key file' };
      }
      
      return { success: false, reason: 'Filesystem error not recoverable' };
    });
    
    // Crypto operation error recovery
    this.errorHandler.registerRecoveryStrategy('crypto', async (errorContext, options) => {
      this.logger.info('Attempting crypto operation recovery');
      
      if (errorContext.context.operation === 'anchor-verification') {
        // Fall back to basic hash verification without digital signatures
        return {
          success: true,
          reason: 'Falling back to basic verification without digital signatures',
          fallbackVerification: true
        };
      }
      
      return { success: false, reason: 'Crypto error not recoverable' };
    });
    
    // Chain integrity error recovery
    this.errorHandler.registerRecoveryStrategy('integrity', async (errorContext, options) => {
      this.logger.info('Attempting chain integrity recovery');
      
      // Could implement chain repair or rebuild strategies
      if (this.hashChain.length > 1) {
        this.logger.warn('Chain integrity issue detected, marking for manual review');
        this.emit('integrity-warning', {
          chainLength: this.hashChain.length,
          errorContext
        });
        return { success: true, reason: 'Chain marked for manual review' };
      }
      
      return { success: false, reason: 'Chain integrity cannot be automatically recovered' };
    });
  }
}

export default BlockchainAnchor;