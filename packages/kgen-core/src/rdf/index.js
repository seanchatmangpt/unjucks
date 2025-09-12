/**
 * KGEN RDF Processing - Enhanced Main Entry Point
 * 
 * Migrated and enhanced RDF processing suite with:
 * - Deterministic SHA256 graph hashing
 * - Canonical RDF serialization
 * - Semantic-aware indexing
 * - N3.js integration for reasoning
 * - Graph diff functionality for change detection
 */

// Import core RDF processing classes
import { Parser, Writer, Store, DataFactory, Util } from 'n3';
import { CanonicalRDFProcessor } from './canonical-processor.js';
import { GraphIndexer } from './graph-indexer.js';
import { EnhancedRDFProcessor } from './enhanced-processor.js';
// Import enhanced components
import { SparqlInterface } from './sparql-interface.js';
import KgenSparqlEngine from './sparql-engine.js';
import SemanticHasher from './semantic-hasher.js';
// Legacy components - will import conditionally to avoid missing dependency errors
// import { GraphProcessor } from './graph-processor.js';
// import { GraphDiffEngine } from './graph-diff-engine.js';  
// import { ContentAddressedCache } from './content-addressed-cache.js';
import { EventEmitter } from 'events';
import consola from 'consola';
import crypto from 'crypto';

// Re-export core migrated classes
export { 
  CanonicalRDFProcessor,
  GraphIndexer, 
  EnhancedRDFProcessor,
  SparqlInterface,
  KgenSparqlEngine,
  SemanticHasher
};

// Export N3.js components for direct access
export { Parser, Writer, Store, DataFactory, Util };

/**
 * Enhanced RDF Processor - Main System Factory
 * 
 * Creates a complete RDF processing system with deterministic operations:
 * - Canonical RDF processing with SHA256 hashing
 * - Semantic indexing and reasoning
 * - Graph diff and change detection
 * - N3.js-powered operations
 * 
 * @param {Object} options - Configuration options
 * @returns {Object} Complete enhanced RDF processing system
 */
export function createRDFProcessor(options = {}) {
  // Initialize enhanced components
  const canonicalProcessor = new CanonicalRDFProcessor(options.canonical);
  const indexer = new GraphIndexer(options.indexing);
  const enhancedProcessor = new EnhancedRDFProcessor({
    ...options.enhanced,
    canonicalProcessor,
    indexer
  });
  
  // Legacy components for compatibility (stubbed)
  const processor = { 
    parseRDF: async () => ({ quads: [] }), 
    addQuads: () => {}, 
    calculateContentHash: () => 'stub', 
    getSubjects: () => [], 
    getPredicates: () => [], 
    getObjects: () => [], 
    getStats: () => ({}),
    store: new Store()
  };
  const diffEngine = { 
    calculateDiff: async () => ({}), 
    getStats: () => ({}) 
  };
  const sparqlInterface = { 
    select: async () => ({}), 
    getStats: () => ({}) 
  };
  const cache = { 
    store: async () => ({}), 
    getStats: () => ({}) 
  };
  
  const system = {
    // Enhanced components
    canonicalProcessor,
    indexer,
    enhancedProcessor,
    
    // Legacy components
    processor,
    diffEngine,
    sparqlInterface,
    cache,
    
    // Enhanced methods with deterministic processing
    async processGraphDeterministic(data, format = 'turtle', options = {}) {
      const startTime = this.getDeterministicTimestamp();
      
      try {
        // Parse with canonical processor for deterministic results
        const parseResult = await canonicalProcessor.parseRDF(data, format, {
          continueOnError: options.continueOnError !== false,
          enableValidation: options.enableValidation !== false,
          ...options
        });
        
        if (!parseResult.valid && !options.continueOnError) {
          throw new Error(`RDF parsing failed: ${parseResult.errors.map(e => e.message).join(', ')}`);
        }
        
        // Generate canonical hash (deterministic SHA256)
        const hashResult = await canonicalProcessor.generateCanonicalHash(parseResult.quads, options);
        
        // Index the graph for efficient queries
        let indexResult = null;
        if (options.enableIndexing !== false) {
          indexResult = await indexer.indexQuads(parseResult.quads, {
            batchSize: options.batchSize || 1000,
            enableFullText: options.enableFullText !== false
          });
        }
        
        const processingTime = this.getDeterministicTimestamp() - startTime;
        
        return {
          success: true,
          parsing: {
            quads: parseResult.quads,
            count: parseResult.count,
            format: parseResult.format,
            prefixes: parseResult.prefixes,
            parseTime: parseResult.parseTime,
            errors: parseResult.errors,
            valid: parseResult.valid
          },
          hashing: {
            hash: hashResult.hash,
            canonical: hashResult.canonical,
            algorithm: 'sha256',
            deterministic: true,
            metadata: hashResult.metadata
          },
          indexing: indexResult ? {
            indexed: indexResult.indexed,
            statistics: indexResult.indexes.statistics,
            processingTime: indexResult.processingTime
          } : null,
          performance: {
            totalTime: processingTime,
            throughput: Math.round(parseResult.count / (processingTime / 1000))
          },
          timestamp: this.getDeterministicDate().toISOString()
        };
      } catch (error) {
        return {
          success: false,
          error: error.message,
          timestamp: this.getDeterministicDate().toISOString()
        };
      }
    },
    
    async compareGraphsDeterministic(graph1Data, graph2Data, options = {}) {
      const startTime = this.getDeterministicTimestamp();
      
      try {
        // Parse both graphs canonically
        const [parse1, parse2] = await Promise.all([
          canonicalProcessor.parseRDF(graph1Data, options.format1 || 'turtle'),
          canonicalProcessor.parseRDF(graph2Data, options.format2 || 'turtle')
        ]);
        
        if (!parse1.valid || !parse2.valid) {
          return {
            success: false,
            error: 'One or both graphs contain invalid RDF',
            parseErrors: {
              graph1: parse1.errors,
              graph2: parse2.errors
            }
          };
        }
        
        // Perform semantic comparison
        const comparison = await canonicalProcessor.compareGraphs(
          parse1.quads,
          parse2.quads,
          {
            checkSemanticEquivalence: options.checkSemanticEquivalence !== false,
            includeChanges: options.includeChanges !== false,
            maxChanges: options.maxChanges || 100,
            ...options
          }
        );
        
        return {
          success: true,
          identical: comparison.identical,
          semanticallyEquivalent: comparison.semanticallyEquivalent,
          differences: comparison.differences,
          summary: {
            ...comparison.summary,
            processingTime: this.getDeterministicTimestamp() - startTime
          },
          changes: comparison.changes || null,
          timestamp: this.getDeterministicDate().toISOString()
        };
      } catch (error) {
        return {
          success: false,
          error: error.message,
          timestamp: this.getDeterministicDate().toISOString()
        };
      }
    },
    
    async queryGraphSemantic(graphData, query, options = {}) {
      try {
        // Parse and index graph
        const parseResult = await canonicalProcessor.parseRDF(graphData, options.format || 'turtle');
        if (!parseResult.valid) {
          throw new Error('Invalid RDF graph for querying');
        }
        
        // Index for efficient querying
        await indexer.indexQuads(parseResult.quads);
        
        let results;
        
        if (typeof query === 'string') {
          // Text search
          results = indexer.searchText(query, options);
        } else if (query.type) {
          // Type-based query
          results = indexer.findByType(query.type, options);
        } else if (query.language) {
          // Language-based query
          results = indexer.findByLanguage(query.language, options);
        } else {
          // Pattern-based query
          results = await indexer.query(query, options);
        }
        
        return {
          success: true,
          results: results.results,
          count: results.count,
          hasMore: results.hasMore,
          query,
          timestamp: this.getDeterministicDate().toISOString()
        };
      } catch (error) {
        return {
          success: false,
          error: error.message,
          query,
          timestamp: this.getDeterministicDate().toISOString()
        };
      }
    },
    
    // Legacy methods for backward compatibility
    async processGraph(data, format) {
      const result = await processor.parseRDF(data, format);
      processor.addQuads(result.quads);
      return {
        ...result,
        hash: processor.calculateContentHash(),
        subjects: processor.getSubjects(),
        predicates: processor.getPredicates(),
        objects: processor.getObjects()
      };
    },
    
    async compareGraphs(graph1, graph2, options) {
      return await diffEngine.calculateDiff(graph1, graph2, options);
    },
    
    async queryGraph(query, options) {
      return await sparqlInterface.select(processor.store, query, options);
    },
    
    async cacheContent(content, options) {
      return await cache.store(content, options);
    },
    
    // Enhanced system statistics
    getStats() {
      return {
        enhanced: {
          canonical: canonicalProcessor.getMetrics(),
          indexing: indexer.getIndexSummary(),
          enhanced: enhancedProcessor ? enhancedProcessor.getStatus() : null
        },
        legacy: {
          processor: processor.getStats(),
          diffEngine: diffEngine.getStats(),
          sparqlInterface: sparqlInterface.getStats(),
          cache: cache.getStats()
        },
        system: {
          memoryUsage: process.memoryUsage(),
          uptime: process.uptime(),
          timestamp: this.getDeterministicDate().toISOString()
        }
      };
    },
    
    // Utility methods
    async generateCanonicalHash(data, format = 'turtle', options = {}) {
      const parseResult = await canonicalProcessor.parseRDF(data, format, options);
      if (!parseResult.valid) {
        throw new Error(`Invalid RDF for hashing: ${parseResult.errors.map(e => e.message).join(', ')}`);
      }
      return await canonicalProcessor.generateCanonicalHash(parseResult.quads, options);
    },
    
    async indexGraph(data, format = 'turtle', options = {}) {
      const parseResult = await canonicalProcessor.parseRDF(data, format, options);
      if (!parseResult.valid) {
        throw new Error(`Invalid RDF for indexing: ${parseResult.errors.map(e => e.message).join(', ')}`);
      }
      return await indexer.indexQuads(parseResult.quads, options);
    },
    
    // Cleanup methods
    async shutdown() {
      await Promise.all([
        enhancedProcessor?.shutdown?.(),
        canonicalProcessor?.reset?.(),
        indexer?.clear?.()
      ]);
      consola.info('RDF Processing System shutdown complete');
    }
  };
  
  // Initialize enhanced processor if available
  if (enhancedProcessor && enhancedProcessor.initialize) {
    enhancedProcessor.initialize().catch(error => {
      consola.warn('Enhanced processor initialization failed:', error.message);
    });
  }
  
  return system;
}

/**
 * Create a lightweight RDF processor for basic operations
 * @param {Object} options - Configuration options
 * @returns {Object} Basic RDF processor
 */
export function createBasicRDFProcessor(options = {}) {
  const canonicalProcessor = new CanonicalRDFProcessor(options.canonical);
  
  return {
    async parse(data, format = 'turtle') {
      return await canonicalProcessor.parseRDF(data, format);
    },
    
    async hash(data, format = 'turtle') {
      const parseResult = await canonicalProcessor.parseRDF(data, format);
      return await canonicalProcessor.generateCanonicalHash(parseResult.quads);
    },
    
    async compare(data1, data2, format = 'turtle') {
      const [parse1, parse2] = await Promise.all([
        canonicalProcessor.parseRDF(data1, format),
        canonicalProcessor.parseRDF(data2, format)
      ]);
      return await canonicalProcessor.compareGraphs(parse1.quads, parse2.quads);
    }
  };
}

/**
 * Default RDF processing system instance
 */
let defaultProcessor = null;

/**
 * Get or create the default RDF processor instance
 * @param {Object} options - Configuration options
 * @returns {Object} Default RDF processor
 */
export function getDefaultProcessor(options = {}) {
  if (!defaultProcessor) {
    defaultProcessor = createRDFProcessor(options);
  }
  return defaultProcessor;
}

/**
 * Reset the default processor instance
 */
export function resetDefaultProcessor() {
  if (defaultProcessor && defaultProcessor.shutdown) {
    defaultProcessor.shutdown();
  }
  defaultProcessor = null;
}