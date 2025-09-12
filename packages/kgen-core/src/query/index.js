/**
 * Query Engine Module - Complete SPARQL 1.1 Query Engine
 * 
 * Exports all query engine components for template context extraction
 * and high-performance SPARQL processing.
 */

export { QueryEngine } from './engine.js';
export { default as ResultSerializer } from './result-serializer.js';
export { default as QueryOptimizer } from './query-optimizer.js';
export { default as TemplateQueryPatterns } from './template-query-patterns.js';
export { default as EnhancedQueryMethods } from './enhanced-query-methods.js';

// Convenience factory function
export function createQueryEngine(config = {}) {
  const engine = new QueryEngine(config);
  return engine;
}

// Pre-configured query engines for common use cases
export const createTemplateQueryEngine = (config = {}) => {
  return createQueryEngine({
    ...config,
    enableQueryOptimization: true,
    enableStatistics: true,
    enableQueryCache: true,
    patterns: {
      defaultNamespaces: {
        'rdf': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
        'rdfs': 'http://www.w3.org/2000/01/rdf-schema#',
        'owl': 'http://www.w3.org/2002/07/owl#',
        'template': 'http://kgen.dev/template#',
        'kgen': 'http://kgen.dev/ontology#'
      }
    }
  });
};

export const createOptimizedQueryEngine = (config = {}) => {
  return createQueryEngine({
    ...config,
    enableQueryOptimization: true,
    enableStatistics: true,
    enableIndexing: true,
    enableQueryCache: true,
    enableRealTimeAnalytics: true,
    optimizer: {
      enableJoinReordering: true,
      enableFilterPushdown: true,
      enableConstantFolding: true,
      costModel: 'statistics'
    }
  });
};

export const createAnalyticsQueryEngine = (config = {}) => {
  return createQueryEngine({
    ...config,
    enableGraphAnalytics: true,
    enableSemanticSearch: true,
    enableRealTimeAnalytics: true,
    metricsCollectionInterval: 30000, // 30 seconds
    semanticSearchConfig: {
      enableFullText: true,
      enableFuzzySearch: true,
      similarityThreshold: 0.6,
      maxSearchResults: 200
    }
  });
};