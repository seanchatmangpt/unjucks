/**
 * High-Performance Graph Diff Optimizer for RDF/SPARQL
 * 
 * Optimizes graph comparison and diff algorithms for large RDF datasets
 * with advanced indexing, streaming support, and delta computation.
 */

import { EventEmitter } from 'events';
import consola from 'consola';
import crypto from 'crypto';
import { Store, DataFactory, Util } from 'n3';
import { KGenErrorHandler } from '../../utils/error-handler.js';

const { namedNode, literal, quad } = DataFactory;

export class GraphDiffOptimizer extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      batchSize: config.batchSize || 10000,
      maxMemoryUsage: config.maxMemoryUsage || 500 * 1024 * 1024, // 500MB
      enableStreaming: config.enableStreaming !== false,
      enableIndexing: config.enableIndexing !== false,
      compressionLevel: config.compressionLevel || 'medium',
      parallelProcessing: config.parallelProcessing !== false,
      cacheEnabled: config.cacheEnabled !== false,
      ...config
    };
    
    this.logger = consola.withTag('graph-diff-optimizer');
    
    // Performance tracking
    this.metrics = {
      diffsComputed: 0,
      totalQuadsCompared: 0,
      avgDiffTime: 0,
      cacheHits: 0,
      cacheMisses: 0,
      memoryPeakUsage: 0
    };
    
    // Caching structures
    this.diffCache = new Map();
    this.graphHashes = new Map();
    this.indexCache = new Map();
    
    // Streaming buffers
    this.addedBuffer = [];
    this.removedBuffer = [];
    this.changedBuffer = [];
    
    // Performance monitoring
    this.performanceMonitor = this._initializePerformanceMonitor();
    
    // Error handling
    this.errorHandler = new KGenErrorHandler({
      enableRecovery: true,
      maxRetryAttempts: 3,
      retryDelay: 1000
    });
    
    this.state = 'initialized';
  }

  /**
   * Initialize performance monitoring
   */
  _initializePerformanceMonitor() {
    return {
      startTime: null,
      memoryUsage: process.memoryUsage(),
      lastGC: this.getDeterministicTimestamp(),
      activeOperations: new Set()
    };
  }

  /**
   * Compute high-performance diff between two RDF graphs
   */
  async computeGraphDiff(graphA, graphB, options = {}) {
    const startTime = this.getDeterministicTimestamp();
    const operationId = crypto.randomBytes(8).toString('hex');
    
    try {
      this.logger.debug(`Starting graph diff computation: ${operationId}`);
      this.performanceMonitor.activeOperations.add(operationId);
      
      // Generate graph fingerprints for caching
      const hashA = await this._computeGraphHash(graphA);
      const hashB = await this._computeGraphHash(graphB);
      const cacheKey = `${hashA}-${hashB}`;
      
      // Check cache first
      if (this.config.cacheEnabled && this.diffCache.has(cacheKey)) {
        this.metrics.cacheHits++;
        this.logger.debug(`Cache hit for diff computation: ${operationId}`);
        return this.diffCache.get(cacheKey);
      }
      
      this.metrics.cacheMisses++;
      
      // Determine optimal diff strategy based on graph sizes
      const strategy = this._selectDiffStrategy(graphA, graphB, options);
      this.logger.debug(`Using diff strategy: ${strategy} for ${operationId}`);
      
      let diff;
      switch (strategy) {
        case 'streaming':
          diff = await this._computeStreamingDiff(graphA, graphB, options);
          break;
        case 'indexed':
          diff = await this._computeIndexedDiff(graphA, graphB, options);
          break;
        case 'parallel':
          diff = await this._computeParallelDiff(graphA, graphB, options);
          break;
        case 'incremental':
          diff = await this._computeIncrementalDiff(graphA, graphB, options);
          break;
        default:
          diff = await this._computeBasicDiff(graphA, graphB, options);
      }
      
      // Enhance diff with metadata
      diff = await this._enrichDiffMetadata(diff, {
        operationId,
        strategy,
        graphSizeA: graphA.size || this._getGraphSize(graphA),
        graphSizeB: graphB.size || this._getGraphSize(graphB),
        executionTime: this.getDeterministicTimestamp() - startTime,
        hashA,
        hashB
      });
      
      // Cache result
      if (this.config.cacheEnabled && diff.added.length + diff.removed.length < 10000) {
        this.diffCache.set(cacheKey, diff);
        
        // Limit cache size
        if (this.diffCache.size > 100) {
          const oldestKey = this.diffCache.keys().next().value;
          this.diffCache.delete(oldestKey);
        }
      }
      
      // Update metrics
      this._updateMetrics(diff, startTime);
      
      this.logger.debug(`Graph diff completed in ${this.getDeterministicTimestamp() - startTime}ms: ${operationId}`);
      this.emit('diff-computed', { operationId, diff, executionTime: this.getDeterministicTimestamp() - startTime });
      
      return diff;
      
    } catch (error) {
      this.logger.error(`Graph diff computation failed: ${operationId}`, error);
      throw error;
    } finally {
      this.performanceMonitor.activeOperations.delete(operationId);
    }
  }

  /**
   * Select optimal diff strategy based on graph characteristics
   */
  _selectDiffStrategy(graphA, graphB, options = {}) {
    const sizeA = graphA.size || this._getGraphSize(graphA);
    const sizeB = graphB.size || this._getGraphSize(graphB);
    const totalSize = sizeA + sizeB;
    
    // Force specific strategy if requested
    if (options.strategy) {
      return options.strategy;
    }
    
    // Very large graphs use streaming
    if (totalSize > 1000000 || this._estimateMemoryUsage(totalSize) > this.config.maxMemoryUsage) {
      return 'streaming';
    }
    
    // Large graphs with good CPU use parallel processing
    if (totalSize > 100000 && this.config.parallelProcessing) {
      return 'parallel';
    }
    
    // Medium graphs use indexing
    if (totalSize > 10000 && this.config.enableIndexing) {
      return 'indexed';
    }
    
    // Incremental diffs for similar graphs
    if (Math.abs(sizeA - sizeB) / Math.max(sizeA, sizeB) < 0.1) {
      return 'incremental';
    }
    
    return 'basic';
  }

  /**
   * Compute streaming diff for very large graphs
   */
  async _computeStreamingDiff(graphA, graphB, options = {}) {
    this.logger.debug('Computing streaming diff');
    
    const diff = {
      added: [],
      removed: [],
      changed: [],
      metadata: {}
    };
    
    const batchSize = options.batchSize || this.config.batchSize;
    
    // Create sorted iterators for both graphs
    const iteratorA = this._createSortedQuadIterator(graphA);
    const iteratorB = this._createSortedQuadIterator(graphB);
    
    let batchA = [];
    let batchB = [];
    let hasMoreA = true;
    let hasMoreB = true;
    
    while (hasMoreA || hasMoreB) {
      // Fill batches
      if (hasMoreA && batchA.length < batchSize) {
        const batch = this._getNextBatch(iteratorA, batchSize - batchA.length);
        batchA.push(...batch);
        hasMoreA = batch.length === batchSize - batchA.length + batch.length;
      }
      
      if (hasMoreB && batchB.length < batchSize) {
        const batch = this._getNextBatch(iteratorB, batchSize - batchB.length);
        batchB.push(...batch);
        hasMoreB = batch.length === batchSize - batchB.length + batch.length;
      }
      
      // Compare batches
      const batchDiff = this._compareBatches(batchA, batchB);
      
      // Stream results
      await this._streamDiffResults(batchDiff, diff);
      
      // Update batches for next iteration
      batchA = batchA.slice(batchDiff.processedA);
      batchB = batchB.slice(batchDiff.processedB);
      
      // Memory management
      if (this._checkMemoryPressure()) {
        await this._handleMemoryPressure();
      }
      
      // Yield control
      await new Promise(resolve => setImmediate(resolve));
    }
    
    return diff;
  }

  /**
   * Compute indexed diff for medium-large graphs
   */
  async _computeIndexedDiff(graphA, graphB, options = {}) {
    this.logger.debug('Computing indexed diff');
    
    // Build indexes
    const indexA = await this._buildQuadIndex(graphA);
    const indexB = await this._buildQuadIndex(graphB);
    
    const diff = {
      added: [],
      removed: [],
      changed: [],
      metadata: { indexedComparison: true }
    };
    
    // Find removed quads (in A but not in B)
    for (const [quadKey, quad] of indexA) {
      if (!indexB.has(quadKey)) {
        diff.removed.push(quad);
      }
    }
    
    // Find added quads (in B but not in A)
    for (const [quadKey, quad] of indexB) {
      if (!indexA.has(quadKey)) {
        diff.added.push(quad);
      }
    }
    
    return diff;
  }

  /**
   * Compute parallel diff using worker threads
   */
  async _computeParallelDiff(graphA, graphB, options = {}) {
    this.logger.debug('Computing parallel diff');
    
    const numWorkers = options.workers || require('os').cpus().length;
    const chunks = this._partitionGraphs(graphA, graphB, numWorkers);
    
    const promises = chunks.map((chunk, index) => 
      this._computeChunkDiff(chunk.graphA, chunk.graphB, { 
        ...options, 
        chunkIndex: index 
      })
    );
    
    const chunkDiffs = await Promise.all(promises);
    
    // Merge results
    return this._mergeChunkDiffs(chunkDiffs);
  }

  /**
   * Compute incremental diff for similar graphs
   */
  async _computeIncrementalDiff(graphA, graphB, options = {}) {
    this.logger.debug('Computing incremental diff');
    
    // Use graph hashes to identify unchanged regions
    const hashMapA = await this._buildRegionHashMap(graphA);
    const hashMapB = await this._buildRegionHashMap(graphB);
    
    const diff = {
      added: [],
      removed: [],
      changed: [],
      unchanged: [],
      metadata: { incrementalComparison: true }
    };
    
    // Identify changed regions
    const changedRegions = new Set();
    
    for (const [region, hashA] of hashMapA) {
      const hashB = hashMapB.get(region);
      if (hashB && hashA !== hashB) {
        changedRegions.add(region);
      } else if (!hashB) {
        // Region removed
        diff.removed.push(...this._getRegionQuads(graphA, region));
      } else {
        // Region unchanged
        diff.unchanged.push(...this._getRegionQuads(graphA, region));
      }
    }
    
    // Find new regions
    for (const [region, hashB] of hashMapB) {
      if (!hashMapA.has(region)) {
        changedRegions.add(region);
      }
    }
    
    // Compute detailed diff only for changed regions
    for (const region of changedRegions) {
      const regionQuadsA = this._getRegionQuads(graphA, region);
      const regionQuadsB = this._getRegionQuads(graphB, region);
      
      const regionDiff = await this._computeBasicDiff(
        new Store(regionQuadsA),
        new Store(regionQuadsB),
        options
      );
      
      diff.added.push(...regionDiff.added);
      diff.removed.push(...regionDiff.removed);
      diff.changed.push(...regionDiff.changed);
    }
    
    return diff;
  }

  /**
   * Compute basic diff for small graphs
   */
  async _computeBasicDiff(graphA, graphB, options = {}) {
    this.logger.debug('Computing basic diff');
    
    const quadsA = this._getGraphQuads(graphA);
    const quadsB = this._getGraphQuads(graphB);
    
    const diff = {
      added: [],
      removed: [],
      changed: [],
      metadata: { basicComparison: true }
    };
    
    // Convert to sets for efficient lookup
    const setA = new Set(quadsA.map(quad => this._quadToString(quad)));
    const setB = new Set(quadsB.map(quad => this._quadToString(quad)));
    
    // Find removed (in A but not B)
    for (const quad of quadsA) {
      const quadStr = this._quadToString(quad);
      if (!setB.has(quadStr)) {
        diff.removed.push(quad);
      }
    }
    
    // Find added (in B but not A)
    for (const quad of quadsB) {
      const quadStr = this._quadToString(quad);
      if (!setA.has(quadStr)) {
        diff.added.push(quad);
      }
    }
    
    return diff;
  }

  /**
   * Compute graph hash for caching
   */
  async _computeGraphHash(graph) {
    const key = this._getGraphIdentifier(graph);
    
    if (this.graphHashes.has(key)) {
      return this.graphHashes.get(key);
    }
    
    const quads = this._getGraphQuads(graph);
    const sortedQuads = quads
      .map(quad => this._quadToString(quad))
      .sort()
      .join('\n');
    
    const hash = crypto.createHash('sha256')
      .update(sortedQuads)
      .digest('hex');
    
    this.graphHashes.set(key, hash);
    return hash;
  }

  /**
   * Build quad index for fast lookup
   */
  async _buildQuadIndex(graph) {
    const index = new Map();
    const quads = this._getGraphQuads(graph);
    
    for (const quad of quads) {
      const key = this._quadToString(quad);
      index.set(key, quad);
    }
    
    return index;
  }

  /**
   * Build region hash map for incremental diffs
   */
  async _buildRegionHashMap(graph, regionSize = 1000) {
    const hashMap = new Map();
    const quads = this._getGraphQuads(graph);
    
    // Group quads by subject to create regions
    const regions = new Map();
    for (const quad of quads) {
      const subject = quad.subject.value;
      if (!regions.has(subject)) {
        regions.set(subject, []);
      }
      regions.get(subject).push(quad);
    }
    
    // Create hash for each region
    for (const [subject, regionQuads] of regions) {
      const regionStr = regionQuads
        .map(quad => this._quadToString(quad))
        .sort()
        .join('\n');
      
      const hash = crypto.createHash('sha256')
        .update(regionStr)
        .digest('hex');
      
      hashMap.set(subject, hash);
    }
    
    return hashMap;
  }

  /**
   * Create sorted quad iterator for streaming
   */
  _createSortedQuadIterator(graph) {
    const quads = this._getGraphQuads(graph);
    
    // Sort quads for deterministic processing
    quads.sort((a, b) => this._compareQuads(a, b));
    
    let index = 0;
    
    return {
      hasNext: () => index < quads.length,
      next: () => index < quads.length ? quads[index++] : null,
      peek: () => index < quads.length ? quads[index] : null
    };
  }

  /**
   * Get next batch from iterator
   */
  _getNextBatch(iterator, batchSize) {
    const batch = [];
    
    while (batch.length < batchSize && iterator.hasNext()) {
      batch.push(iterator.next());
    }
    
    return batch;
  }

  /**
   * Compare two batches of quads
   */
  _compareBatches(batchA, batchB) {
    const diff = {
      added: [],
      removed: [],
      processedA: 0,
      processedB: 0
    };
    
    let indexA = 0;
    let indexB = 0;
    
    while (indexA < batchA.length && indexB < batchB.length) {
      const quadA = batchA[indexA];
      const quadB = batchB[indexB];
      
      const comparison = this._compareQuads(quadA, quadB);
      
      if (comparison < 0) {
        // Quad A is smaller, it's removed
        diff.removed.push(quadA);
        indexA++;
        diff.processedA++;
      } else if (comparison > 0) {
        // Quad B is smaller, it's added
        diff.added.push(quadB);
        indexB++;
        diff.processedB++;
      } else {
        // Quads are equal, skip both
        indexA++;
        indexB++;
        diff.processedA++;
        diff.processedB++;
      }
    }
    
    // Handle remaining quads
    while (indexA < batchA.length) {
      diff.removed.push(batchA[indexA++]);
      diff.processedA++;
    }
    
    while (indexB < batchB.length) {
      diff.added.push(batchB[indexB++]);
      diff.processedB++;
    }
    
    return diff;
  }

  /**
   * Stream diff results to avoid memory pressure
   */
  async _streamDiffResults(batchDiff, accumulatedDiff) {
    // Add to buffers
    this.addedBuffer.push(...batchDiff.added);
    this.removedBuffer.push(...batchDiff.removed);
    
    // Flush buffers when they get large
    if (this.addedBuffer.length > 10000) {
      accumulatedDiff.added.push(...this.addedBuffer.splice(0));
    }
    
    if (this.removedBuffer.length > 10000) {
      accumulatedDiff.removed.push(...this.removedBuffer.splice(0));
    }
    
    // Emit progress event
    this.emit('diff-progress', {
      addedCount: this.addedBuffer.length + accumulatedDiff.added.length,
      removedCount: this.removedBuffer.length + accumulatedDiff.removed.length
    });
  }

  /**
   * Check for memory pressure
   */
  _checkMemoryPressure() {
    const memUsage = process.memoryUsage();
    const threshold = this.config.maxMemoryUsage;
    
    this.metrics.memoryPeakUsage = Math.max(
      this.metrics.memoryPeakUsage,
      memUsage.heapUsed
    );
    
    return memUsage.heapUsed > threshold;
  }

  /**
   * Handle memory pressure
   */
  async _handleMemoryPressure() {
    this.logger.warn('Memory pressure detected, performing cleanup');
    
    // Clear caches
    this.diffCache.clear();
    this.indexCache.clear();
    
    // Flush buffers
    this.addedBuffer.length = 0;
    this.removedBuffer.length = 0;
    this.changedBuffer.length = 0;
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    // Wait for memory to stabilize
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  /**
   * Partition graphs for parallel processing
   */
  _partitionGraphs(graphA, graphB, numPartitions) {
    const quadsA = this._getGraphQuads(graphA);
    const quadsB = this._getGraphQuads(graphB);
    
    const partitionSize = Math.max(
      Math.ceil(quadsA.length / numPartitions),
      Math.ceil(quadsB.length / numPartitions)
    );
    
    const partitions = [];
    
    for (let i = 0; i < numPartitions; i++) {
      const startA = i * partitionSize;
      const endA = Math.min((i + 1) * partitionSize, quadsA.length);
      const startB = i * partitionSize;
      const endB = Math.min((i + 1) * partitionSize, quadsB.length);
      
      partitions.push({
        graphA: new Store(quadsA.slice(startA, endA)),
        graphB: new Store(quadsB.slice(startB, endB))
      });
    }
    
    return partitions;
  }

  /**
   * Compute diff for a single chunk
   */
  async _computeChunkDiff(chunkA, chunkB, options = {}) {
    // Use basic diff for chunks
    return await this._computeBasicDiff(chunkA, chunkB, options);
  }

  /**
   * Merge chunk diffs into final result
   */
  _mergeChunkDiffs(chunkDiffs) {
    const merged = {
      added: [],
      removed: [],
      changed: [],
      metadata: { 
        parallelProcessing: true,
        chunks: chunkDiffs.length
      }
    };
    
    for (const diff of chunkDiffs) {
      merged.added.push(...diff.added);
      merged.removed.push(...diff.removed);
      merged.changed.push(...diff.changed);
    }
    
    return merged;
  }

  /**
   * Enrich diff with metadata
   */
  async _enrichDiffMetadata(diff, metadata) {
    return {
      ...diff,
      metadata: {
        ...diff.metadata,
        ...metadata,
        addedCount: diff.added.length,
        removedCount: diff.removed.length,
        changedCount: diff.changed ? diff.changed.length : 0,
        totalChanges: diff.added.length + diff.removed.length + (diff.changed ? diff.changed.length : 0)
      }
    };
  }

  /**
   * Update performance metrics
   */
  _updateMetrics(diff, startTime) {
    this.metrics.diffsComputed++;
    this.metrics.totalQuadsCompared += diff.metadata.addedCount + diff.metadata.removedCount;
    
    const executionTime = this.getDeterministicTimestamp() - startTime;
    this.metrics.avgDiffTime = (
      (this.metrics.avgDiffTime * (this.metrics.diffsComputed - 1) + executionTime) / 
      this.metrics.diffsComputed
    );
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats() {
    const memUsage = process.memoryUsage();
    
    return {
      ...this.metrics,
      cacheSize: this.diffCache.size,
      currentMemoryUsage: memUsage.heapUsed,
      memoryEfficiency: this.metrics.memoryPeakUsage > 0 ? 
        memUsage.heapUsed / this.metrics.memoryPeakUsage : 1,
      activeOperations: this.performanceMonitor.activeOperations.size,
      cacheHitRate: this.metrics.cacheHits + this.metrics.cacheMisses > 0 ?
        this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses) : 0
    };
  }

  /**
   * Clear caches and reset state
   */
  clearCaches() {
    this.diffCache.clear();
    this.graphHashes.clear();
    this.indexCache.clear();
    this.addedBuffer.length = 0;
    this.removedBuffer.length = 0;
    this.changedBuffer.length = 0;
    
    this.logger.debug('Caches cleared');
  }

  // Helper methods

  _getGraphSize(graph) {
    if (graph.size !== undefined) return graph.size;
    if (graph.length !== undefined) return graph.length;
    if (Array.isArray(graph)) return graph.length;
    if (graph.getQuads) return graph.getQuads().length;
    return 0;
  }

  _getGraphQuads(graph) {
    if (Array.isArray(graph)) return graph;
    if (graph.getQuads) return graph.getQuads();
    if (graph.match) return Array.from(graph.match());
    return [];
  }

  _getGraphIdentifier(graph) {
    return graph.id || graph.name || crypto.randomBytes(8).toString('hex');
  }

  _estimateMemoryUsage(quadCount) {
    // Rough estimate: each quad uses ~200 bytes in memory
    return quadCount * 200;
  }

  _quadToString(quad) {
    return `${quad.subject.value} ${quad.predicate.value} ${quad.object.value} ${quad.graph ? quad.graph.value : ''}`;
  }

  _compareQuads(quadA, quadB) {
    const strA = this._quadToString(quadA);
    const strB = this._quadToString(quadB);
    return strA < strB ? -1 : strA > strB ? 1 : 0;
  }

  _getRegionQuads(graph, region) {
    const quads = this._getGraphQuads(graph);
    return quads.filter(quad => quad.subject.value === region);
  }
}

export default GraphDiffOptimizer;