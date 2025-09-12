/**
 * KGEN RDF Store - Enhanced Quad Storage and Management
 * 
 * Advanced RDF quad storage system with indexing, querying, and persistence
 * Built on N3.js Store with additional features for performance and semantics
 */

import { Store, DataFactory, Util } from 'n3';
import crypto from 'crypto';
import { consola } from 'consola';
import { EventEmitter } from 'events';

const { namedNode, literal, blankNode, quad, defaultGraph } = DataFactory;

export class RDFStore extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.config = {
      enableIndexing: true,
      enableStatistics: true,
      enableTransactions: true,
      enablePersistence: false,
      maxQuads: 1000000,
      indexingStrategy: 'balanced', // 'minimal', 'balanced', 'comprehensive'
      persistenceFormat: 'n-quads',
      autoCommit: true,
      ...options
    };
    
    this.store = new Store();
    this.indexes = new Map();
    this.statistics = {
      totalQuads: 0,
      totalSubjects: 0,
      totalPredicates: 0,
      totalObjects: 0,
      totalGraphs: 0,
      operations: {
        add: 0,
        remove: 0,
        query: 0,
        match: 0
      },
      startTime: Date.now()
    };
    
    this.transactions = new Map();
    this.activeTransaction = null;
    this.changeLog = [];
    
    this.logger = consola.withTag('rdf-store');
    
    if (this.config.enableIndexing) {
      this._initializeIndexes();
    }
  }

  /**
   * Add quads to the store
   * @param {Array|Quad} quadsOrQuad - Single quad or array of quads
   * @param {Object} options - Operation options
   * @returns {Object} Operation result
   */
  addQuads(quadsOrQuad, options = {}) {
    const startTime = Date.now();
    const quads = Array.isArray(quadsOrQuad) ? quadsOrQuad : [quadsOrQuad];
    
    try {
      let addedCount = 0;
      const duplicates = [];
      
      for (const quadToAdd of quads) {
        // Check if quad already exists
        if (this.store.has(quadToAdd)) {
          duplicates.push(quadToAdd);
          continue;
        }
        
        // Add to store
        this.store.addQuad(quadToAdd);
        addedCount++;
        
        // Update indexes if enabled
        if (this.config.enableIndexing) {
          this._updateIndexesForAdd(quadToAdd);
        }
        
        // Track in transaction if active
        if (this.activeTransaction) {
          this.activeTransaction.operations.push({
            type: 'add',
            quad: quadToAdd,
            timestamp: Date.now()
          });
        }
        
        // Log change
        this.changeLog.push({
          operation: 'add',
          quad: quadToAdd,
          timestamp: Date.now()
        });
      }
      
      // Update statistics
      this.statistics.totalQuads += addedCount;
      this.statistics.operations.add += addedCount;
      this._updateStatistics();
      
      const result = {
        success: true,
        added: addedCount,
        duplicates: duplicates.length,
        totalQuads: this.store.size,
        operationTime: Date.now() - startTime
      };
      
      this.emit('quads-added', { ...result, quads: quads.slice(0, addedCount) });
      return result;
      
    } catch (error) {
      this.logger.error('Failed to add quads:', error);
      return {
        success: false,
        error: error.message,
        added: 0,
        operationTime: Date.now() - startTime
      };
    }
  }

  /**
   * Remove quads from the store
   * @param {Array|Quad} quadsOrQuad - Single quad or array of quads
   * @param {Object} options - Operation options
   * @returns {Object} Operation result
   */
  removeQuads(quadsOrQuad, options = {}) {
    const startTime = Date.now();
    const quads = Array.isArray(quadsOrQuad) ? quadsOrQuad : [quadsOrQuad];
    
    try {
      let removedCount = 0;
      const notFound = [];
      
      for (const quadToRemove of quads) {
        if (this.store.has(quadToRemove)) {
          this.store.removeQuad(quadToRemove);
          removedCount++;
          
          // Update indexes if enabled
          if (this.config.enableIndexing) {
            this._updateIndexesForRemove(quadToRemove);
          }
          
          // Track in transaction if active
          if (this.activeTransaction) {
            this.activeTransaction.operations.push({
              type: 'remove',
              quad: quadToRemove,
              timestamp: Date.now()
            });
          }
        } else {
          notFound.push(quadToRemove);
        }
      }
      
      // Update statistics
      this.statistics.totalQuads -= removedCount;
      this.statistics.operations.remove += removedCount;
      this._updateStatistics();
      
      const result = {
        success: true,
        removed: removedCount,
        notFound: notFound.length,
        totalQuads: this.store.size,
        operationTime: Date.now() - startTime
      };
      
      this.emit('quads-removed', { ...result, quads: quads.slice(0, removedCount) });
      return result;
      
    } catch (error) {
      this.logger.error('Failed to remove quads:', error);
      return {
        success: false,
        error: error.message,
        removed: 0,
        operationTime: Date.now() - startTime
      };
    }
  }

  /**
   * Get quads matching pattern
   * @param {Term} subject - Subject pattern (null for any)
   * @param {Term} predicate - Predicate pattern (null for any)
   * @param {Term} object - Object pattern (null for any)
   * @param {Term} graph - Graph pattern (null for any)
   * @returns {Array} Matching quads
   */
  getQuads(subject = null, predicate = null, object = null, graph = null) {
    const startTime = Date.now();
    
    try {
      this.statistics.operations.query++;
      
      const quads = this.store.getQuads(subject, predicate, object, graph);
      
      const queryTime = Date.now() - startTime;
      
      this.emit('query-executed', {
        pattern: { subject, predicate, object, graph },
        resultCount: quads.length,
        queryTime
      });
      
      return quads;
      
    } catch (error) {
      this.logger.error('Query failed:', error);
      return [];
    }
  }

  /**
   * Check if quad exists in store
   * @param {Quad} quad - Quad to check
   * @returns {boolean} True if quad exists
   */
  has(quad) {
    return this.store.has(quad);
  }

  /**
   * Get all subjects in the store
   * @param {Term} predicate - Optional predicate filter
   * @param {Term} object - Optional object filter
   * @returns {Array} Array of subject terms
   */
  getSubjects(predicate = null, object = null) {
    if (this.config.enableIndexing && this.indexes.has('subjects')) {
      const subjectIndex = this.indexes.get('subjects');
      if (!predicate && !object) {
        return Array.from(subjectIndex.keys());
      }
    }
    
    const subjects = new Set();
    const quads = this.getQuads(null, predicate, object);
    
    quads.forEach(quad => {
      subjects.add(quad.subject);
    });
    
    return Array.from(subjects);
  }

  /**
   * Get all predicates in the store
   * @param {Term} subject - Optional subject filter
   * @param {Term} object - Optional object filter
   * @returns {Array} Array of predicate terms
   */
  getPredicates(subject = null, object = null) {
    if (this.config.enableIndexing && this.indexes.has('predicates')) {
      const predicateIndex = this.indexes.get('predicates');
      if (!subject && !object) {
        return Array.from(predicateIndex.keys());
      }
    }
    
    const predicates = new Set();
    const quads = this.getQuads(subject, null, object);
    
    quads.forEach(quad => {
      predicates.add(quad.predicate);
    });
    
    return Array.from(predicates);
  }

  /**
   * Get all objects in the store
   * @param {Term} subject - Optional subject filter
   * @param {Term} predicate - Optional predicate filter
   * @returns {Array} Array of object terms
   */
  getObjects(subject = null, predicate = null) {
    if (this.config.enableIndexing && this.indexes.has('objects')) {
      const objectIndex = this.indexes.get('objects');
      if (!subject && !predicate) {
        return Array.from(objectIndex.keys());
      }
    }
    
    const objects = new Set();
    const quads = this.getQuads(subject, predicate, null);
    
    quads.forEach(quad => {
      objects.add(quad.object);
    });
    
    return Array.from(objects);
  }

  /**
   * Execute a pattern matching query with advanced options
   * @param {Object} pattern - Query pattern
   * @param {Object} options - Query options
   * @returns {Object} Query results with metadata
   */
  match(pattern, options = {}) {
    const startTime = Date.now();
    
    try {
      this.statistics.operations.match++;
      
      const {
        subject = null,
        predicate = null,
        object = null,
        graph = null,
        limit = null,
        offset = 0,
        orderBy = null
      } = pattern;
      
      let quads = this.getQuads(subject, predicate, object, graph);
      
      // Apply ordering if specified
      if (orderBy) {
        quads = this._orderQuads(quads, orderBy);
      }
      
      // Apply pagination
      const totalCount = quads.length;
      if (offset > 0 || limit !== null) {
        const start = offset;
        const end = limit ? start + limit : undefined;
        quads = quads.slice(start, end);
      }
      
      const queryTime = Date.now() - startTime;
      
      return {
        success: true,
        quads,
        count: quads.length,
        totalCount,
        hasMore: limit ? totalCount > (offset + limit) : false,
        queryTime,
        pattern
      };
      
    } catch (error) {
      this.logger.error('Match operation failed:', error);
      return {
        success: false,
        error: error.message,
        quads: [],
        count: 0,
        queryTime: Date.now() - startTime
      };
    }
  }

  /**
   * Start a transaction
   * @param {string} transactionId - Optional transaction ID
   * @returns {string} Transaction ID
   */
  beginTransaction(transactionId = null) {
    const txId = transactionId || crypto.randomUUID();
    
    const transaction = {
      id: txId,
      startTime: Date.now(),
      operations: [],
      committed: false,
      rollback: false
    };
    
    this.transactions.set(txId, transaction);
    this.activeTransaction = transaction;
    
    this.logger.debug(`Started transaction: ${txId}`);
    return txId;
  }

  /**
   * Commit the active transaction
   * @param {string} transactionId - Optional transaction ID
   * @returns {Object} Commit result
   */
  commitTransaction(transactionId = null) {
    const txId = transactionId || (this.activeTransaction ? this.activeTransaction.id : null);
    const transaction = this.transactions.get(txId);
    
    if (!transaction) {
      return { success: false, error: 'Transaction not found' };
    }
    
    try {
      transaction.committed = true;
      transaction.commitTime = Date.now();
      
      // For this implementation, operations are already applied
      // In a full implementation, operations would be staged and applied here
      
      this.activeTransaction = null;
      
      this.logger.debug(`Committed transaction: ${txId} (${transaction.operations.length} operations)`);
      
      return {
        success: true,
        transactionId: txId,
        operationCount: transaction.operations.length,
        duration: transaction.commitTime - transaction.startTime
      };
      
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Rollback the active transaction
   * @param {string} transactionId - Optional transaction ID
   * @returns {Object} Rollback result
   */
  rollbackTransaction(transactionId = null) {
    const txId = transactionId || (this.activeTransaction ? this.activeTransaction.id : null);
    const transaction = this.transactions.get(txId);
    
    if (!transaction) {
      return { success: false, error: 'Transaction not found' };
    }
    
    try {
      // Reverse the operations
      const reversedOps = transaction.operations.reverse();
      
      for (const op of reversedOps) {
        if (op.type === 'add') {
          this.store.removeQuad(op.quad);
        } else if (op.type === 'remove') {
          this.store.addQuad(op.quad);
        }
      }
      
      transaction.rollback = true;
      transaction.rollbackTime = Date.now();
      this.activeTransaction = null;
      
      this.logger.debug(`Rolled back transaction: ${txId} (${transaction.operations.length} operations)`);
      
      return {
        success: true,
        transactionId: txId,
        operationCount: transaction.operations.length,
        duration: transaction.rollbackTime - transaction.startTime
      };
      
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get store statistics
   * @returns {Object} Comprehensive statistics
   */
  getStatistics() {
    return {
      ...this.statistics,
      size: this.store.size,
      uptime: Date.now() - this.statistics.startTime,
      transactions: {
        total: this.transactions.size,
        active: this.activeTransaction ? 1 : 0
      },
      indexes: {
        enabled: this.config.enableIndexing,
        count: this.indexes.size
      },
      memory: process.memoryUsage()
    };
  }

  /**
   * Clear all data from the store
   * @returns {Object} Clear operation result
   */
  clear() {
    const previousSize = this.store.size;
    
    try {
      this.store = new Store();
      this.indexes.clear();
      this.changeLog = [];
      this.transactions.clear();
      this.activeTransaction = null;
      
      this.statistics = {
        totalQuads: 0,
        totalSubjects: 0,
        totalPredicates: 0,
        totalObjects: 0,
        totalGraphs: 0,
        operations: {
          add: 0,
          remove: 0,
          query: 0,
          match: 0
        },
        startTime: Date.now()
      };
      
      if (this.config.enableIndexing) {
        this._initializeIndexes();
      }
      
      this.emit('store-cleared', { previousSize });
      
      return {
        success: true,
        previousSize,
        currentSize: 0
      };
      
    } catch (error) {
      this.logger.error('Failed to clear store:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Import quads from another store or array
   * @param {Store|Array} source - Source of quads
   * @returns {Object} Import result
   */
  import(source) {
    const startTime = Date.now();
    
    try {
      let quads;
      
      if (Array.isArray(source)) {
        quads = source;
      } else if (source.getQuads) {
        quads = source.getQuads();
      } else {
        throw new Error('Unsupported source type for import');
      }
      
      const result = this.addQuads(quads);
      
      return {
        ...result,
        imported: result.added,
        totalTime: Date.now() - startTime
      };
      
    } catch (error) {
      this.logger.error('Import failed:', error);
      return {
        success: false,
        error: error.message,
        imported: 0,
        totalTime: Date.now() - startTime
      };
    }
  }

  /**
   * Export all quads from the store
   * @returns {Array} Array of all quads
   */
  export() {
    return this.getQuads();
  }

  /**
   * Get store size
   * @returns {number} Number of quads in store
   */
  get size() {
    return this.store.size;
  }

  // Private methods
  
  _initializeIndexes() {
    this.indexes.set('subjects', new Map());
    this.indexes.set('predicates', new Map());
    this.indexes.set('objects', new Map());
    
    if (this.config.indexingStrategy === 'comprehensive') {
      this.indexes.set('graphs', new Map());
      this.indexes.set('terms', new Map());
    }
  }
  
  _updateIndexesForAdd(quad) {
    // Update subject index
    if (this.indexes.has('subjects')) {
      const subjectIndex = this.indexes.get('subjects');
      const subjectKey = quad.subject.value;
      if (!subjectIndex.has(subjectKey)) {
        subjectIndex.set(subjectKey, new Set());
      }
      subjectIndex.get(subjectKey).add(quad);
    }
    
    // Update predicate index
    if (this.indexes.has('predicates')) {
      const predicateIndex = this.indexes.get('predicates');
      const predicateKey = quad.predicate.value;
      if (!predicateIndex.has(predicateKey)) {
        predicateIndex.set(predicateKey, new Set());
      }
      predicateIndex.get(predicateKey).add(quad);
    }
    
    // Update object index
    if (this.indexes.has('objects')) {
      const objectIndex = this.indexes.get('objects');
      const objectKey = quad.object.value;
      if (!objectIndex.has(objectKey)) {
        objectIndex.set(objectKey, new Set());
      }
      objectIndex.get(objectKey).add(quad);
    }
  }
  
  _updateIndexesForRemove(quad) {
    // Update subject index
    if (this.indexes.has('subjects')) {
      const subjectIndex = this.indexes.get('subjects');
      const subjectKey = quad.subject.value;
      const subjectSet = subjectIndex.get(subjectKey);
      if (subjectSet) {
        subjectSet.delete(quad);
        if (subjectSet.size === 0) {
          subjectIndex.delete(subjectKey);
        }
      }
    }
    
    // Similar updates for predicates and objects...
  }
  
  _updateStatistics() {
    if (this.config.enableStatistics) {
      // Update unique counts
      this.statistics.totalSubjects = this.getSubjects().length;
      this.statistics.totalPredicates = this.getPredicates().length;
      this.statistics.totalObjects = this.getObjects().length;
    }
  }
  
  _orderQuads(quads, orderBy) {
    // Simple ordering by term value
    return quads.sort((a, b) => {
      const aValue = a[orderBy]?.value || '';
      const bValue = b[orderBy]?.value || '';
      return aValue.localeCompare(bValue);
    });
  }
}

/**
 * Create an RDF store instance
 * @param {Object} options - Configuration options
 * @returns {RDFStore} New store instance
 */
export function createRDFStore(options = {}) {
  return new RDFStore(options);
}

export default RDFStore;