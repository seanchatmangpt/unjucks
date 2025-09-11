/**
 * KGEN Query Engine - Main Entry Point
 * 
 * Advanced SPARQL query engine with optimization, caching, and analytics
 */

// Core engine
export { default as QueryEngine } from './engine/QueryEngine.js';

// Types
export * from './types/index.js';

// Caching
export { default as AdvancedQueryCache, CacheKeyGenerator } from './cache/QueryCache.js';

// Optimization
export { default as QueryOptimizer } from './optimization/QueryOptimizer.js';

// Pattern matching
export { default as TriplePatternMatcher } from './patterns/TriplePatternMatcher.js';

// Templates
export { default as PreDefinedQueries } from './templates/PreDefinedQueries.js';

// Context extraction
export { default as ContextExtractor } from './context/ContextExtractor.js';

// Result formatting
export { default as QueryResultFormatter } from './results/QueryResultFormatter.js';

// Convenience factory function
export function createQueryEngine(config?: any): QueryEngine {
  return new QueryEngine(config);
}

// Pre-configured engine instances
export function createOptimizedEngine(): QueryEngine {
  return new QueryEngine({
    enableSPARQL: true,
    enableSemanticSearch: true,
    enableGraphAnalytics: true,
    enableQueryCache: true,
    enableQueryOptimization: true,
    enableIndexing: true,
    enableStatistics: true,
    enableRealTimeAnalytics: true,
    queryTimeout: 30000,
    maxResultSize: 10000,
    cacheTTL: 600000, // 10 minutes
    semanticSearchConfig: {
      enableFullText: true,
      enableFuzzySearch: true,
      enableVectorSearch: true,
      similarityThreshold: 0.7,
      maxSearchResults: 100
    }
  });
}

export function createBasicEngine(): QueryEngine {
  return new QueryEngine({
    enableSPARQL: true,
    enableSemanticSearch: false,
    enableGraphAnalytics: false,
    enableQueryCache: true,
    enableQueryOptimization: false,
    enableIndexing: true,
    enableStatistics: false,
    enableRealTimeAnalytics: false,
    queryTimeout: 15000,
    maxResultSize: 1000,
    cacheTTL: 300000 // 5 minutes
  });
}

export function createHighPerformanceEngine(): QueryEngine {
  return new QueryEngine({
    enableSPARQL: true,
    enableSemanticSearch: true,
    enableGraphAnalytics: true,
    enableQueryCache: true,
    enableQueryOptimization: true,
    enableIndexing: true,
    enableStatistics: true,
    enableRealTimeAnalytics: true,
    queryTimeout: 60000,
    maxResultSize: 50000,
    cacheTTL: 1800000, // 30 minutes
    cacheSize: '500MB',
    metricsCollectionInterval: 30000, // 30 seconds
    semanticSearchConfig: {
      enableFullText: true,
      enableFuzzySearch: true,
      enableVectorSearch: true,
      similarityThreshold: 0.6,
      maxSearchResults: 1000,
      embeddingModel: 'sentence-transformers/all-MiniLM-L6-v2'
    }
  });
}

// Export version information
export const VERSION = '2.0.0';
export const FEATURES = [
  'SPARQL 1.1 Support',
  'Advanced Query Optimization', 
  'Intelligent Caching',
  'Triple Pattern Matching',
  'Semantic Search',
  'Graph Analytics',
  'Context Extraction',
  'Multiple Result Formats',
  'Real-time Metrics',
  'Provenance Tracking',
  'Compliance Queries'
] as const;