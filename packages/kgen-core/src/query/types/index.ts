/**
 * Query Engine Type Definitions
 * 
 * Comprehensive TypeScript definitions for the KGEN Query Engine
 */

export interface QueryEngineConfig {
  // Core configuration
  enableSPARQL: boolean;
  enableSemanticSearch: boolean;
  enableGraphAnalytics: boolean;
  
  // Performance settings
  queryTimeout: number;
  maxResultSize: number;
  enableQueryCache: boolean;
  cacheSize: string;
  cacheTTL: number;
  
  // Optimization settings
  enableQueryOptimization: boolean;
  enableIndexing: boolean;
  enableStatistics: boolean;
  
  // Analytics settings
  enableRealTimeAnalytics: boolean;
  metricsCollectionInterval: number;
  
  // Search settings
  semanticSearchConfig: SemanticSearchConfig;
  
  // Storage settings
  storageBackend: 'n3' | 'rdflib' | 'oxigraph' | 'custom';
  persistentStorage: boolean;
  storageLocation?: string;
}

export interface SemanticSearchConfig {
  enableFullText: boolean;
  enableFuzzySearch: boolean;
  similarityThreshold: number;
  maxSearchResults: number;
  enableVectorSearch?: boolean;
  embeddingModel?: string;
}

export interface QueryExecutionContext {
  queryId: string;
  query: string;
  parsedQuery: ParsedQuery;
  startTime: number;
  timeout: number;
  maxResults: number;
  enableOptimization: boolean;
  optimizedQuery?: ParsedQuery;
  metadata?: Record<string, any>;
}

export interface ParsedQuery {
  queryType: 'SELECT' | 'CONSTRUCT' | 'ASK' | 'DESCRIBE' | 'UPDATE' | 'INSERT' | 'DELETE';
  prefixes?: Record<string, string>;
  where?: QueryPattern[];
  variables?: string[];
  limit?: number;
  offset?: number;
  orderBy?: OrderByClause[];
  groupBy?: string[];
  having?: FilterExpression[];
}

export interface QueryPattern {
  type: 'triple' | 'filter' | 'optional' | 'union' | 'graph' | 'service';
  subject?: TripleComponent;
  predicate?: TripleComponent;
  object?: TripleComponent;
  graph?: TripleComponent;
  patterns?: QueryPattern[];
  expression?: FilterExpression;
}

export interface TripleComponent {
  type: 'variable' | 'uri' | 'literal' | 'blank';
  value: string;
  datatype?: string;
  language?: string;
}

export interface FilterExpression {
  type: 'operation' | 'function' | 'comparison' | 'logical';
  operator: string;
  args: (FilterExpression | TripleComponent)[];
}

export interface OrderByClause {
  variable: string;
  descending?: boolean;
}

export interface QueryResults {
  head: {
    vars: string[];
  };
  results: {
    bindings: Binding[];
  };
  metadata: QueryResultMetadata;
  fromCache?: boolean;
  truncated?: boolean;
}

export interface Binding {
  [variable: string]: BindingValue;
}

export interface BindingValue {
  type: 'uri' | 'literal' | 'bnode';
  value: string;
  datatype?: string;
  language?: string;
}

export interface QueryResultMetadata {
  queryId: string;
  executionTime: number;
  resultCount: number;
  fromIndex: boolean;
  cacheHit: boolean;
  optimizations: string[];
}

export interface QueryPlan {
  id: string;
  query: ParsedQuery;
  steps: ExecutionStep[];
  estimatedCost: number;
  estimatedTime: number;
  indexes: string[];
  joinOrder: number[];
  optimizations: string[];
}

export interface ExecutionStep {
  id: number;
  type: 'pattern_match' | 'join' | 'filter' | 'sort' | 'limit' | 'projection';
  pattern?: QueryPattern;
  estimatedCost: number;
  estimatedTime: number;
  estimatedRows: number;
  indexes: string[];
}

export interface QueryCache {
  get(key: string): QueryCacheEntry | undefined;
  set(key: string, value: QueryCacheEntry): void;
  delete(key: string): boolean;
  clear(): void;
  size: number;
  getStats(): CacheStats;
}

export interface QueryCacheEntry {
  result: QueryResults;
  timestamp: number;
  ttl: number;
  accessCount: number;
  lastAccessed: number;
  size: number;
}

export interface CacheStats {
  size: number;
  hits: number;
  misses: number;
  hitRate: number;
  totalSize: number;
  averageSize: number;
  oldestEntry: number;
  newestEntry: number;
}

export interface QueryMetrics {
  totalQueries: number;
  successfulQueries: number;
  failedQueries: number;
  averageExecutionTime: number;
  cacheHits: number;
  cacheMisses: number;
  slowQueries: number;
  queryComplexityDistribution: Record<string, number>;
}

export interface GraphMetrics {
  basic: BasicGraphMetrics;
  structural: StructuralGraphMetrics;
  semantic: SemanticGraphMetrics;
  quality: QualityGraphMetrics;
  centrality: CentralityGraphMetrics;
  connectivity: ConnectivityGraphMetrics;
  derived: DerivedGraphMetrics;
}

export interface BasicGraphMetrics {
  nodeCount: number;
  edgeCount: number;
  tripleCount: number;
  predicateCount: number;
  classCount: number;
  propertyCount: number;
}

export interface StructuralGraphMetrics {
  density: number;
  diameter: number;
  averagePathLength: number;
  averageDegree: number;
  maxDegree: number;
  minDegree: number;
}

export interface SemanticGraphMetrics {
  ontologyComplexity: number;
  semanticDensity: number;
  classHierarchyDepth: number;
  propertyHierarchyDepth: number;
  instanceToClassRatio: number;
}

export interface QualityGraphMetrics {
  completeness: number;
  consistency: number;
  accuracy: number;
  timeliness: number;
  validity: number;
}

export interface CentralityGraphMetrics {
  degreeCentrality: Record<string, number>;
  betweennessCentrality: Record<string, number>;
  closenesseCentrality: Record<string, number>;
  eigenvectorCentrality: Record<string, number>;
}

export interface ConnectivityGraphMetrics {
  connectedComponents: number;
  stronglyConnectedComponents: number;
  clusteringCoefficient: number;
  modularity: number;
  assortativity: number;
}

export interface DerivedGraphMetrics {
  sparsity: number;
  efficiency: number;
  smallWorldness: number;
  scaleFreeness: number;
}

export interface PatternMatch {
  pattern: QueryPattern;
  bindings: Binding[];
  cost: number;
  selectivity: number;
}

export interface TriplePattern {
  subject: TripleComponent;
  predicate: TripleComponent;
  object: TripleComponent;
  graph?: TripleComponent;
}

export interface Index {
  name: string;
  type: 'spo' | 'pos' | 'osp' | 'sop' | 'pso' | 'ops' | 'full-text' | 'spatial' | 'temporal';
  size: number;
  lastUpdated: Date;
  statistics: IndexStatistics;
}

export interface IndexStatistics {
  totalEntries: number;
  uniqueEntries: number;
  averageKeyLength: number;
  memoryUsage: number;
  accessCount: number;
  lastAccessed: Date;
}

export interface QueryOptimizationResult {
  originalQuery: ParsedQuery;
  optimizedQuery: ParsedQuery;
  optimizations: OptimizationRule[];
  estimatedSpeedup: number;
  warnings: string[];
}

export interface OptimizationRule {
  name: string;
  description: string;
  applied: boolean;
  estimatedBenefit: number;
  conditions: string[];
}

export interface SearchResult {
  uri: string;
  label?: string;
  description?: string;
  type?: string;
  score: number;
  relevance: number;
  context: SearchContext;
  highlight?: string[];
}

export interface SearchContext {
  source: 'fulltext' | 'fuzzy' | 'semantic' | 'vector';
  matchType: 'exact' | 'partial' | 'similarity' | 'embedding';
  confidence: number;
  metadata: Record<string, any>;
}

export interface ContextExtractionResult {
  entities: EntityContext[];
  properties: PropertyContext[];
  classes: ClassContext[];
  relationships: RelationshipContext[];
  temporal: TemporalContext[];
  spatial: SpatialContext[];
  provenance: ProvenanceContext[];
}

export interface EntityContext {
  uri: string;
  label?: string;
  types: string[];
  properties: Record<string, any>;
  incomingRelations: string[];
  outgoingRelations: string[];
  importance: number;
}

export interface PropertyContext {
  uri: string;
  label?: string;
  domain: string[];
  range: string[];
  frequency: number;
  distinctValues: number;
  examples: any[];
}

export interface ClassContext {
  uri: string;
  label?: string;
  superClasses: string[];
  subClasses: string[];
  instances: number;
  properties: string[];
}

export interface RelationshipContext {
  predicate: string;
  subject: string;
  object: string;
  weight: number;
  confidence: number;
  temporal?: {
    start?: Date;
    end?: Date;
    during?: Date;
  };
}

export interface TemporalContext {
  timepoint?: Date;
  interval?: {
    start: Date;
    end: Date;
  };
  duration?: number;
  precision: 'year' | 'month' | 'day' | 'hour' | 'minute' | 'second';
}

export interface SpatialContext {
  location: {
    latitude: number;
    longitude: number;
  };
  region?: string;
  precision: number;
  source: string;
}

export interface ProvenanceContext {
  entity: string;
  activity: string;
  agent: string;
  timestamp: Date;
  derivation: string[];
  influence: string[];
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  statistics: ValidationStatistics;
}

export interface ValidationError {
  code: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
  location?: {
    line: number;
    column: number;
  };
  suggestion?: string;
}

export interface ValidationWarning {
  code: string;
  message: string;
  location?: {
    line: number;
    column: number;
  };
}

export interface ValidationStatistics {
  totalChecks: number;
  passed: number;
  failed: number;
  warnings: number;
  executionTime: number;
}

// Event types
export interface QueryEngineEvents {
  'query:started': { queryId: string; query: string; };
  'query:completed': { queryId: string; executionTime: number; resultCount: number; };
  'query:failed': { queryId: string; error: Error; executionTime: number; };
  'query:cached': { queryId: string; cacheKey: string; };
  'query:cache_hit': { queryId: string; query: string; };
  'query:optimized': { originalQuery: ParsedQuery; optimizedQuery: ParsedQuery; };
  'query:plan_created': { planId: string; estimatedCost: number; };
  'query:analyzed': { queryId: string; complexity: any; };
  'search:completed': { searchTerms: string; resultCount: number; };
  'search:failed': { searchTerms: string; error: Error; };
  'insights:generated': { graphId: string; insightCount: number; };
  'patterns:detected': { graphId: string; patternCount: number; };
  'metrics:calculated': { graphId: string; metrics: GraphMetrics; };
  'metrics:collected': { timestamp: number; metrics: any; };
  'cache:evicted': { key: string; reason: string; };
  'index:updated': { indexName: string; additions: number; deletions: number; };
}

// Error types
export class QueryEngineError extends Error {
  constructor(message: string, public code: string, public details?: any) {
    super(message);
    this.name = 'QueryEngineError';
  }
}

export class QueryParsingError extends QueryEngineError {
  constructor(message: string, details?: any) {
    super(message, 'QUERY_PARSING_ERROR', details);
    this.name = 'QueryParsingError';
  }
}

export class QueryExecutionError extends QueryEngineError {
  constructor(message: string, details?: any) {
    super(message, 'QUERY_EXECUTION_ERROR', details);
    this.name = 'QueryExecutionError';
  }
}

export class QueryTimeoutError extends QueryEngineError {
  constructor(message: string, timeout: number) {
    super(message, 'QUERY_TIMEOUT_ERROR', { timeout });
    this.name = 'QueryTimeoutError';
  }
}