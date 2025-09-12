/**
 * KGEN RDF Processing - Main Entry Point
 * 
 * Comprehensive RDF processing suite for deterministic knowledge compilation
 */

// Import the classes
import { GraphProcessor } from './graph-processor.js';
import { GraphDiffEngine } from './graph-diff-engine.js';  
import { SparqlInterface } from './sparql-interface.js';
import { ContentAddressedCache } from './content-addressed-cache.js';

// Re-export classes for external use
export { GraphProcessor, GraphDiffEngine, SparqlInterface, ContentAddressedCache };

/**
 * Create a complete RDF processing system with all components
 * @param {Object} options - Configuration options
 * @returns {Object} Complete RDF processing system
 */
export function createRDFProcessor(options = {}) {
  const processor = new GraphProcessor(options.graph);
  const diffEngine = new GraphDiffEngine(options.diff);
  const sparqlInterface = new SparqlInterface(options.sparql);
  const cache = new ContentAddressedCache(options.cache);
  
  return {
    processor,
    diffEngine,
    sparqlInterface,
    cache,
    
    // Convenience methods
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
    
    getStats() {
      return {
        processor: processor.getStats(),
        diffEngine: diffEngine.getStats(),
        sparqlInterface: sparqlInterface.getStats(),
        cache: cache.getStats()
      };
    }
  };
}