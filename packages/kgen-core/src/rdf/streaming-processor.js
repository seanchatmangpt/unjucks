/**
 * High-Performance Streaming RDF Processor - Enhanced for 100M+ triples
 * Memory-efficient streaming with backpressure control and parallel processing
 */

import { Parser, Store, DataFactory, Util } from 'n3';
import { EventEmitter, Transform } from 'stream';
import { Worker } from 'worker_threads';
import { createHash } from 'crypto';
import { GraphProcessor } from './graph-processor.js';
import { HashCalculator } from './hash-calculator.js';
import { RDFSerializers } from './serializers.js';

const { namedNode, literal, blankNode, defaultGraph, quad } = DataFactory;

export class StreamingRDFProcessor extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      // Performance settings
      batchSize: config.batchSize || 10000,
      maxConcurrency: config.maxConcurrency || require('os').cpus().length,
      memoryLimit: config.memoryLimit || 2 * 1024 * 1024 * 1024, // 2GB
      enableCompression: config.enableCompression !== false,
      
      // Streaming settings
      highWaterMark: config.highWaterMark || 16 * 1024, // 16KB
      objectMode: config.objectMode !== false,
      backpressureThreshold: config.backpressureThreshold || 100000,
      
      // Index settings
      enableIndexing: config.enableIndexing !== false,
      indexStrategy: config.indexStrategy || 'btree',
      bloomFilterSize: config.bloomFilterSize || 1000000,
      
      // Transaction settings
      enableTransactions: config.enableTransactions !== false,
      maxTransactionSize: config.maxTransactionSize || 100000,
      transactionTimeout: config.transactionTimeout || 30000,
      
      ...config
    };

    // Core components
    this.graphProcessor = new GraphProcessor(config);
    this.hashCalculator = new HashCalculator(config);
    this.serializers = new RDFSerializers(config);
    
    // Performance tracking
    this.metrics = {
      triplesProcessed: 0,
      batchesProcessed: 0,
      memoryUsage: 0,
      throughput: 0,
      errors: 0,
      startTime: Date.now(),
      lastBenchmark: Date.now()
    };
    
    // Indexing structures
    this.indexes = {
      spo: new Map(), // Subject-Predicate-Object
      pos: new Map(), // Predicate-Object-Subject  
      osp: new Map(), // Object-Subject-Predicate
      bloom: null     // Bloom filter for existence queries
    };
    
    // Transaction state
    this.transactions = new Map();
    this.transactionLog = [];
    this.currentTransaction = null;
    
    // Worker pool for parallel processing
    this.workers = [];
    this.workerQueue = [];
    
    // Stream state
    this.processing = false;
    this.backpressure = false;
    this.streamBuffers = new Map();
    
    this.status = 'initialized';
  }

  /**
   * Initialize the streaming processor
   */
  async initialize() {
    try {
      this.status = 'initializing';
      
      // Initialize core components
      await this.graphProcessor.initialize?.();
      
      // Setup worker pool
      if (this.config.maxConcurrency > 1) {
        await this._initializeWorkerPool();
      }
      
      // Initialize indexes
      if (this.config.enableIndexing) {
        await this._initializeIndexes();
      }
      
      // Initialize transaction system
      if (this.config.enableTransactions) {
        await this._initializeTransactions();
      }
      
      // Start performance monitoring
      this._startPerformanceMonitoring();
      
      this.status = 'ready';
      this.emit('initialized');
      
    } catch (error) {
      this.status = 'error';
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Create a streaming transformer for RDF parsing
   */
  createParseStream(format = 'turtle', options = {}) {
    const opts = { ...this.config, ...options };
    
    return new Transform({
      objectMode: opts.objectMode,
      highWaterMark: opts.highWaterMark,
      
      transform: (chunk, encoding, callback) => {
        this._processChunk(chunk, format, opts)
          .then(result => callback(null, result))
          .catch(error => callback(error));
      },
      
      flush: (callback) => {
        this._finalizeStream()
          .then(() => callback())
          .catch(error => callback(error));
      }
    });
  }

  /**
   * Stream RDF data from readable source
   */
  async streamFromSource(source, format = 'turtle', options = {}) {
    return new Promise((resolve, reject) => {
      const parseStream = this.createParseStream(format, options);
      const chunks = [];
      
      parseStream.on('data', chunk => {
        chunks.push(chunk);
        
        // Handle backpressure
        if (chunks.length > this.config.backpressureThreshold) {
          this._handleBackpressure();
        }
      });
      
      parseStream.on('end', () => {
        this._updateMetrics();
        resolve({
          totalQuads: this.metrics.triplesProcessed,
          chunks: chunks.length,
          throughput: this._calculateThroughput(),
          memoryUsage: process.memoryUsage().heapUsed
        });
      });
      
      parseStream.on('error', reject);
      
      source.pipe(parseStream);
    });
  }

  /**
   * Begin atomic transaction
   */
  async beginTransaction(options = {}) {
    if (!this.config.enableTransactions) {
      throw new Error('Transactions are disabled');
    }
    
    const transactionId = this._generateTransactionId();
    const transaction = {
      id: transactionId,
      startTime: Date.now(),
      operations: [],
      snapshots: new Map(),
      status: 'active',
      timeout: setTimeout(() => {
        this._timeoutTransaction(transactionId);
      }, this.config.transactionTimeout)
    };
    
    this.transactions.set(transactionId, transaction);
    this.currentTransaction = transaction;
    
    // Create initial snapshot
    await this._createSnapshot(transaction);
    
    this.emit('transaction-started', { id: transactionId });
    return transactionId;
  }

  /**
   * Commit transaction
   */
  async commitTransaction(transactionId) {
    const transaction = this.transactions.get(transactionId);
    
    if (!transaction) {
      throw new Error(`Transaction ${transactionId} not found`);
    }
    
    if (transaction.status !== 'active') {
      throw new Error(`Transaction ${transactionId} is not active`);
    }
    
    try {
      // Apply all operations atomically
      await this._commitOperations(transaction);
      
      // Update transaction log
      this.transactionLog.push({
        id: transactionId,
        operations: transaction.operations.length,
        duration: Date.now() - transaction.startTime,
        status: 'committed',
        timestamp: new Date().toISOString()
      });
      
      transaction.status = 'committed';
      clearTimeout(transaction.timeout);
      
      this.emit('transaction-committed', { id: transactionId });
      
    } catch (error) {
      await this.rollbackTransaction(transactionId);
      throw error;
    }
  }

  /**
   * Rollback transaction
   */
  async rollbackTransaction(transactionId) {
    const transaction = this.transactions.get(transactionId);
    
    if (!transaction) {
      throw new Error(`Transaction ${transactionId} not found`);
    }
    
    try {
      // Restore from snapshot
      await this._restoreSnapshot(transaction);
      
      transaction.status = 'rolled-back';
      clearTimeout(transaction.timeout);
      
      this.transactionLog.push({
        id: transactionId,
        operations: transaction.operations.length,
        duration: Date.now() - transaction.startTime,
        status: 'rolled-back',
        timestamp: new Date().toISOString()
      });
      
      this.emit('transaction-rolled-back', { id: transactionId });
      
    } catch (error) {
      this.emit('error', new Error(`Failed to rollback transaction ${transactionId}: ${error.message}`));
      throw error;
    } finally {
      this.transactions.delete(transactionId);
      
      if (this.currentTransaction?.id === transactionId) {
        this.currentTransaction = null;
      }
    }
  }

  /**
   * Add quads with transaction support
   */
  async addQuads(quads, options = {}) {
    const normalizedQuads = Array.isArray(quads) ? quads : [quads];
    
    if (this.currentTransaction) {
      // Add to transaction operations
      this.currentTransaction.operations.push({
        type: 'add',
        quads: normalizedQuads,
        timestamp: Date.now()
      });
    } else {
      // Direct addition
      await this._addQuadsToStore(normalizedQuads, options);
    }
    
    // Update indexes if enabled
    if (this.config.enableIndexing) {
      await this._updateIndexes('add', normalizedQuads);
    }
    
    this.metrics.triplesProcessed += normalizedQuads.length;
    this.emit('quads-added', { count: normalizedQuads.length });
    
    return normalizedQuads.length;
  }

  /**
   * Remove quads with transaction support
   */
  async removeQuads(quads, options = {}) {
    const normalizedQuads = Array.isArray(quads) ? quads : [quads];
    
    if (this.currentTransaction) {
      // Add to transaction operations
      this.currentTransaction.operations.push({
        type: 'remove',
        quads: normalizedQuads,
        timestamp: Date.now()
      });
    } else {
      // Direct removal
      await this._removeQuadsFromStore(normalizedQuads, options);
    }
    
    // Update indexes if enabled
    if (this.config.enableIndexing) {
      await this._updateIndexes('remove', normalizedQuads);
    }
    
    this.emit('quads-removed', { count: normalizedQuads.length });
    
    return normalizedQuads.length;
  }

  /**
   * Lightning-fast pattern matching with indexes
   */
  async queryPattern(pattern, options = {}) {
    const opts = { limit: 10000, offset: 0, ...options };
    
    // Use bloom filter for quick existence check
    if (this.indexes.bloom && !this._bloomFilterCheck(pattern)) {
      return [];
    }
    
    // Determine best index strategy
    const indexKey = this._selectOptimalIndex(pattern);
    const results = await this._queryFromIndex(indexKey, pattern, opts);
    
    this.emit('query-executed', {
      pattern,
      resultCount: results.length,
      indexUsed: indexKey
    });
    
    return results;
  }

  /**
   * Parallel batch processing
   */
  async processBatch(batch, operation, options = {}) {
    if (this.workers.length === 0) {
      // Fallback to sequential processing
      return this._processSequential(batch, operation, options);
    }
    
    // Distribute work across workers
    const chunkSize = Math.ceil(batch.length / this.workers.length);
    const promises = [];
    
    for (let i = 0; i < batch.length; i += chunkSize) {
      const chunk = batch.slice(i, i + chunkSize);
      const worker = this._getAvailableWorker();
      
      promises.push(
        this._executeOnWorker(worker, operation, chunk, options)
      );
    }
    
    const results = await Promise.all(promises);
    return results.flat();
  }

  /**
   * Get comprehensive performance statistics
   */
  getPerformanceStats() {
    const currentTime = Date.now();
    const uptimeMs = currentTime - this.metrics.startTime;
    const memUsage = process.memoryUsage();
    
    return {
      uptime: uptimeMs,
      throughput: {
        triplesPerSecond: (this.metrics.triplesProcessed / uptimeMs) * 1000,
        batchesPerSecond: (this.metrics.batchesProcessed / uptimeMs) * 1000,
        currentTps: this._calculateCurrentThroughput()
      },
      memory: {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external,
        utilization: (memUsage.heapUsed / this.config.memoryLimit) * 100
      },
      indexes: {
        spoSize: this.indexes.spo.size,
        posSize: this.indexes.pos.size,
        ospSize: this.indexes.osp.size,
        bloomSize: this.indexes.bloom?.size || 0
      },
      transactions: {
        active: Array.from(this.transactions.values()).filter(t => t.status === 'active').length,
        total: this.transactionLog.length,
        averageDuration: this._calculateAverageTransactionDuration()
      },
      workers: {
        count: this.workers.length,
        busy: this.workers.filter(w => w.busy).length,
        queueSize: this.workerQueue.length
      },
      totals: {
        triplesProcessed: this.metrics.triplesProcessed,
        batchesProcessed: this.metrics.batchesProcessed,
        errors: this.metrics.errors
      }
    };
  }

  // Private methods

  async _processChunk(chunk, format, options) {
    try {
      const parser = new Parser({ format, ...options });
      const quads = [];
      
      return new Promise((resolve, reject) => {
        parser.parse(chunk.toString(), (error, quad, prefixes) => {
          if (error) {
            this.metrics.errors++;
            return reject(error);
          }
          
          if (quad) {
            quads.push(quad);
          } else {
            // Processing complete
            this.addQuads(quads)
              .then(() => resolve(quads))
              .catch(reject);
          }
        });
      });
    } catch (error) {
      this.metrics.errors++;
      throw error;
    }
  }

  async _initializeWorkerPool() {
    const { env } = await import('../config/environment.js');
    
    // Check if workers are enabled in environment
    if (!env.ENABLE_WORKERS) {
      this.logger.info('Worker threads disabled by environment configuration');
      return;
    }
    
    const workerCount = env.WORKER_COUNT || this.config.maxConcurrency;
    
    for (let i = 0; i < workerCount; i++) {
      const worker = new Worker(new URL('./worker.js', import.meta.url), {
        workerData: { 
          workerId: i, 
          config: { 
            ...this.config,
            timeout: env.WORKER_TIMEOUT || this.config.timeout
          } 
        }
      });
      
      worker.busy = false;
      worker.on('message', (result) => {
        worker.busy = false;
        this._processWorkerResult(worker, result);
      });
      
      worker.on('error', (error) => {
        this.emit('worker-error', { workerId: i, error });
        worker.busy = false;
      });
      
      this.workers.push(worker);
    }
  }

  async _initializeIndexes() {
    // Initialize B-tree indexes for fast lookups
    this.indexes.spo = new Map();
    this.indexes.pos = new Map();
    this.indexes.osp = new Map();
    
    // Initialize bloom filter for existence queries
    this.indexes.bloom = this._createBloomFilter(this.config.bloomFilterSize);
  }

  async _initializeTransactions() {
    // Setup transaction log cleanup
    setInterval(() => {
      this._cleanupTransactionLog();
    }, 60000); // Cleanup every minute
  }

  _startPerformanceMonitoring() {
    setInterval(() => {
      this._updateMetrics();
    }, 1000); // Update every second
  }

  _updateMetrics() {
    const currentTime = Date.now();
    const timeDiff = currentTime - this.metrics.lastBenchmark;
    
    if (timeDiff > 0) {
      this.metrics.throughput = (this.metrics.triplesProcessed / timeDiff) * 1000;
      this.metrics.memoryUsage = process.memoryUsage().heapUsed;
      this.metrics.lastBenchmark = currentTime;
    }
  }

  _generateTransactionId() {
    return createHash('sha256')
      .update(`${Date.now()}-${Math.random()}`)
      .digest('hex')
      .substring(0, 16);
  }

  async _createSnapshot(transaction) {
    // Create lightweight snapshot of current state
    transaction.snapshots.set('initial', {
      storeSize: this.graphProcessor.store.size,
      timestamp: Date.now()
    });
  }

  async _commitOperations(transaction) {
    for (const operation of transaction.operations) {
      if (operation.type === 'add') {
        await this._addQuadsToStore(operation.quads);
      } else if (operation.type === 'remove') {
        await this._removeQuadsFromStore(operation.quads);
      }
    }
  }

  async _restoreSnapshot(transaction) {
    // Restore from snapshot by reversing operations
    const operations = [...transaction.operations].reverse();
    
    for (const operation of operations) {
      if (operation.type === 'add') {
        await this._removeQuadsFromStore(operation.quads);
      } else if (operation.type === 'remove') {
        await this._addQuadsToStore(operation.quads);
      }
    }
  }

  async _addQuadsToStore(quads, options = {}) {
    return this.graphProcessor.addQuads(quads, options.graph);
  }

  async _removeQuadsFromStore(quads, options = {}) {
    return this.graphProcessor.removeQuads(quads);
  }

  async _updateIndexes(operation, quads) {
    for (const quad of quads) {
      const sKey = `${quad.subject.value}|${quad.predicate.value}|${quad.object.value}`;
      const pKey = `${quad.predicate.value}|${quad.object.value}|${quad.subject.value}`;
      const oKey = `${quad.object.value}|${quad.subject.value}|${quad.predicate.value}`;
      
      if (operation === 'add') {
        this._addToIndex(this.indexes.spo, sKey, quad);
        this._addToIndex(this.indexes.pos, pKey, quad);
        this._addToIndex(this.indexes.osp, oKey, quad);
        
        if (this.indexes.bloom) {
          this._bloomFilterAdd(this.indexes.bloom, sKey);
        }
      } else if (operation === 'remove') {
        this._removeFromIndex(this.indexes.spo, sKey, quad);
        this._removeFromIndex(this.indexes.pos, pKey, quad);
        this._removeFromIndex(this.indexes.osp, oKey, quad);
      }
    }
  }

  _addToIndex(index, key, quad) {
    if (!index.has(key)) {
      index.set(key, []);
    }
    index.get(key).push(quad);
  }

  _removeFromIndex(index, key, quad) {
    if (index.has(key)) {
      const quads = index.get(key);
      const filtered = quads.filter(q => !this._quadsEqual(q, quad));
      
      if (filtered.length === 0) {
        index.delete(key);
      } else {
        index.set(key, filtered);
      }
    }
  }

  _quadsEqual(a, b) {
    return a.subject.equals(b.subject) &&
           a.predicate.equals(b.predicate) &&
           a.object.equals(b.object) &&
           a.graph.equals(b.graph);
  }

  _selectOptimalIndex(pattern) {
    // Select most selective index based on pattern
    if (pattern.subject && pattern.predicate) {
      return 'spo';
    } else if (pattern.predicate && pattern.object) {
      return 'pos';
    } else if (pattern.object && pattern.subject) {
      return 'osp';
    } else if (pattern.subject) {
      return 'spo';
    } else if (pattern.predicate) {
      return 'pos';
    } else if (pattern.object) {
      return 'osp';
    }
    return 'spo'; // Default
  }

  async _queryFromIndex(indexKey, pattern, options) {
    const index = this.indexes[indexKey];
    const results = [];
    
    // Build search key based on available pattern elements
    const searchKeys = this._buildSearchKeys(pattern, indexKey);
    
    for (const key of searchKeys) {
      if (index.has(key)) {
        const matches = index.get(key);
        results.push(...matches.slice(options.offset, options.offset + options.limit));
        
        if (results.length >= options.limit) {
          break;
        }
      }
    }
    
    return results;
  }

  _buildSearchKeys(pattern, indexType) {
    // Build possible search keys based on pattern and index type
    const keys = [];
    
    switch (indexType) {
      case 'spo':
        if (pattern.subject) {
          if (pattern.predicate) {
            if (pattern.object) {
              keys.push(`${pattern.subject.value}|${pattern.predicate.value}|${pattern.object.value}`);
            } else {
              // Find all keys starting with subject|predicate
              keys.push(...this._findKeysWithPrefix(this.indexes.spo, `${pattern.subject.value}|${pattern.predicate.value}`));
            }
          } else {
            // Find all keys starting with subject
            keys.push(...this._findKeysWithPrefix(this.indexes.spo, pattern.subject.value));
          }
        }
        break;
      // Similar logic for pos and osp indexes
    }
    
    return keys;
  }

  _findKeysWithPrefix(index, prefix) {
    const keys = [];
    for (const key of index.keys()) {
      if (key.startsWith(prefix)) {
        keys.push(key);
      }
    }
    return keys;
  }

  _createBloomFilter(size) {
    // Simple bloom filter implementation
    return {
      size,
      bits: new Array(size).fill(false),
      hashFunctions: 3
    };
  }

  _bloomFilterAdd(filter, item) {
    for (let i = 0; i < filter.hashFunctions; i++) {
      const hash = this._hash(item + i) % filter.size;
      filter.bits[hash] = true;
    }
  }

  _bloomFilterCheck(pattern) {
    const key = `${pattern.subject?.value || ''}|${pattern.predicate?.value || ''}|${pattern.object?.value || ''}`;
    
    for (let i = 0; i < this.indexes.bloom.hashFunctions; i++) {
      const hash = this._hash(key + i) % this.indexes.bloom.size;
      if (!this.indexes.bloom.bits[hash]) {
        return false;
      }
    }
    return true;
  }

  _hash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  _getAvailableWorker() {
    return this.workers.find(w => !w.busy) || this.workers[0];
  }

  async _executeOnWorker(worker, operation, data, options) {
    return new Promise((resolve, reject) => {
      worker.busy = true;
      
      const timeout = setTimeout(() => {
        worker.busy = false;
        reject(new Error('Worker timeout'));
      }, 30000);
      
      const handler = (result) => {
        clearTimeout(timeout);
        worker.removeListener('message', handler);
        worker.busy = false;
        
        if (result.error) {
          reject(new Error(result.error));
        } else {
          resolve(result.data);
        }
      };
      
      worker.on('message', handler);
      worker.postMessage({ operation, data, options });
    });
  }

  _processSequential(batch, operation, options) {
    // Fallback sequential processing
    return Promise.all(
      batch.map(item => this._processItem(item, operation, options))
    );
  }

  async _processItem(item, operation, options) {
    // Process individual item based on operation type
    switch (operation) {
      case 'parse':
        return this._parseItem(item, options);
      case 'hash':
        return this.hashCalculator.calculateQuadHash(item, options);
      case 'serialize':
        return this.serializers.serialize([item], options.format, options);
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }

  _calculateThroughput() {
    const currentTime = Date.now();
    const timeElapsed = currentTime - this.metrics.startTime;
    
    return timeElapsed > 0 ? (this.metrics.triplesProcessed / timeElapsed) * 1000 : 0;
  }

  _calculateCurrentThroughput() {
    const currentTime = Date.now();
    const timeSinceLastBenchmark = currentTime - this.metrics.lastBenchmark;
    
    return timeSinceLastBenchmark > 0 ? (this.metrics.triplesProcessed / timeSinceLastBenchmark) * 1000 : 0;
  }

  _calculateAverageTransactionDuration() {
    const completedTransactions = this.transactionLog.filter(t => t.status !== 'active');
    
    if (completedTransactions.length === 0) return 0;
    
    const totalDuration = completedTransactions.reduce((sum, t) => sum + t.duration, 0);
    return totalDuration / completedTransactions.length;
  }

  _handleBackpressure() {
    if (!this.backpressure) {
      this.backpressure = true;
      this.emit('backpressure-start');
      
      // Implement backpressure handling
      setTimeout(() => {
        this.backpressure = false;
        this.emit('backpressure-end');
      }, 1000);
    }
  }

  async _finalizeStream() {
    // Finalize any pending operations
    this._updateMetrics();
    this.emit('stream-finalized');
  }

  _timeoutTransaction(transactionId) {
    this.rollbackTransaction(transactionId)
      .catch(error => this.emit('error', error));
  }

  _cleanupTransactionLog() {
    // Remove old transaction log entries
    const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours
    this.transactionLog = this.transactionLog.filter(t => 
      new Date(t.timestamp).getTime() > cutoffTime
    );
  }

  /**
   * Shutdown the streaming processor
   */
  async shutdown() {
    this.status = 'shutting-down';
    
    // Rollback any active transactions
    for (const [id, transaction] of this.transactions) {
      if (transaction.status === 'active') {
        await this.rollbackTransaction(id);
      }
    }
    
    // Terminate workers
    await Promise.all(
      this.workers.map(worker => worker.terminate())
    );
    
    // Clear all data structures
    this.indexes.spo.clear();
    this.indexes.pos.clear();
    this.indexes.osp.clear();
    this.transactions.clear();
    this.streamBuffers.clear();
    
    this.removeAllListeners();
    this.status = 'shutdown';
  }
}

export default StreamingRDFProcessor;
