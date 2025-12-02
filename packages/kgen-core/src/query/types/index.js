/**
 * Query Engine Type Definitions
 * 
 * Comprehensive JSDoc definitions for the KGEN Query Engine
 */

/**
 * Core configuration for the Query Engine
 * @typedef {Object} QueryEngineConfig
 * @property {boolean} enableSPARQL - Enable SPARQL processing
 * @property {boolean} enableSemanticSearch - Enable semantic search capabilities
 * @property {boolean} enableGraphAnalytics - Enable graph analytics
 * @property {number} queryTimeout - Query timeout in milliseconds
 * @property {number} maxResultSize - Maximum number of results to return
 * @property {boolean} enableQueryCache - Enable query result caching
 * @property {string} cacheSize - Cache size specification
 * @property {number} cacheTTL - Cache time-to-live in milliseconds
 * @property {boolean} enableQueryOptimization - Enable query optimization
 * @property {boolean} enableIndexing - Enable indexing for performance
 * @property {boolean} enableStatistics - Enable statistics collection
 * @property {boolean} enableRealTimeAnalytics - Enable real-time analytics
 * @property {number} metricsCollectionInterval - Metrics collection interval in milliseconds
 * @property {SemanticSearchConfig} semanticSearchConfig - Semantic search configuration
 * @property {'n3'|'rdflib'|'oxigraph'|'custom'} storageBackend - Storage backend type
 * @property {boolean} persistentStorage - Enable persistent storage
 * @property {string} [storageLocation] - Storage location path
 */

/**
 * Semantic search configuration
 * @typedef {Object} SemanticSearchConfig
 * @property {boolean} enableFullText - Enable full-text search
 * @property {boolean} enableFuzzySearch - Enable fuzzy search
 * @property {number} similarityThreshold - Similarity threshold for search results
 * @property {number} maxSearchResults - Maximum number of search results
 * @property {boolean} [enableVectorSearch] - Enable vector-based search
 * @property {string} [embeddingModel] - Embedding model for vector search
 */

/**
 * Query execution context
 * @typedef {Object} QueryExecutionContext
 * @property {string} queryId - Unique query identifier
 * @property {string} query - Original query string
 * @property {ParsedQuery} parsedQuery - Parsed query object
 * @property {number} startTime - Query start timestamp
 * @property {number} timeout - Query timeout in milliseconds
 * @property {number} maxResults - Maximum results to return
 * @property {boolean} enableOptimization - Whether optimization is enabled
 * @property {ParsedQuery} [optimizedQuery] - Optimized query object
 * @property {Record<string, any>} [metadata] - Additional metadata
 */

/**
 * Parsed query representation
 * @typedef {Object} ParsedQuery
 * @property {'SELECT'|'CONSTRUCT'|'ASK'|'DESCRIBE'|'UPDATE'|'INSERT'|'DELETE'} queryType - Type of query
 * @property {Record<string, string>} [prefixes] - Query prefixes
 * @property {QueryPattern[]} [where] - WHERE clause patterns
 * @property {string[]} [variables] - Query variables
 * @property {number} [limit] - LIMIT clause value
 * @property {number} [offset] - OFFSET clause value
 * @property {OrderByClause[]} [orderBy] - ORDER BY clauses
 * @property {string[]} [groupBy] - GROUP BY variables
 * @property {FilterExpression[]} [having] - HAVING clause filters
 */

/**
 * Query pattern representation
 * @typedef {Object} QueryPattern
 * @property {'triple'|'filter'|'optional'|'union'|'graph'|'service'} type - Pattern type
 * @property {TripleComponent} [subject] - Subject component
 * @property {TripleComponent} [predicate] - Predicate component
 * @property {TripleComponent} [object] - Object component
 * @property {TripleComponent} [graph] - Graph component
 * @property {QueryPattern[]} [patterns] - Nested patterns
 * @property {FilterExpression} [expression] - Filter expression
 */

/**
 * RDF triple component
 * @typedef {Object} TripleComponent
 * @property {'variable'|'uri'|'literal'|'blank'} type - Component type
 * @property {string} value - Component value
 * @property {string} [datatype] - Literal datatype URI
 * @property {string} [language] - Literal language tag
 */

/**
 * Filter expression
 * @typedef {Object} FilterExpression
 * @property {'operation'|'function'|'comparison'|'logical'} type - Expression type
 * @property {string} operator - Expression operator
 * @property {Array<FilterExpression|TripleComponent>} args - Expression arguments
 */

/**
 * ORDER BY clause
 * @typedef {Object} OrderByClause
 * @property {string} variable - Variable to order by
 * @property {boolean} [descending] - Whether to sort in descending order
 */

/**
 * Query execution results
 * @typedef {Object} QueryResults
 * @property {Object} head - Result head with variable names
 * @property {string[]} head.vars - Variable names in results
 * @property {Object} results - Result bindings
 * @property {Binding[]} results.bindings - Variable binding arrays
 * @property {QueryResultMetadata} metadata - Query execution metadata
 * @property {boolean} [fromCache] - Whether results came from cache
 * @property {boolean} [truncated] - Whether results were truncated
 * @property {boolean} [boolean] - Boolean result for ASK queries
 */

/**
 * Variable binding in query results
 * @typedef {Object} Binding
 */

/**
 * Binding value
 * @typedef {Object} BindingValue
 * @property {'uri'|'literal'|'bnode'} type - Value type
 * @property {string} value - Value content
 * @property {string} [datatype] - Literal datatype URI
 * @property {string} [language] - Literal language tag
 */

/**
 * Query result metadata
 * @typedef {Object} QueryResultMetadata
 * @property {string} queryId - Query identifier
 * @property {number} executionTime - Execution time in milliseconds
 * @property {number} resultCount - Number of results returned
 * @property {boolean} fromIndex - Whether results used indexes
 * @property {boolean} cacheHit - Whether result was cached
 * @property {string[]} optimizations - Applied optimizations
 */

/**
 * Query execution plan
 * @typedef {Object} QueryPlan
 * @property {string} id - Plan identifier
 * @property {ParsedQuery} query - Query being planned
 * @property {ExecutionStep[]} steps - Execution steps
 * @property {number} estimatedCost - Estimated execution cost
 * @property {number} estimatedTime - Estimated execution time
 * @property {string[]} indexes - Indexes to use
 * @property {number[]} joinOrder - Join execution order
 * @property {string[]} optimizations - Applied optimizations
 */

/**
 * Query execution step
 * @typedef {Object} ExecutionStep
 * @property {number} id - Step identifier
 * @property {'pattern_match'|'join'|'filter'|'sort'|'limit'|'projection'} type - Step type
 * @property {QueryPattern} [pattern] - Pattern being matched
 * @property {number} estimatedCost - Estimated step cost
 * @property {number} estimatedTime - Estimated step time
 * @property {number} estimatedRows - Estimated result rows
 * @property {string[]} indexes - Indexes used by step
 */

/**
 * Query cache interface
 * @typedef {Object} QueryCache
 * @property {function(string): QueryCacheEntry|undefined} get - Get cache entry
 * @property {function(string, QueryCacheEntry): void} set - Set cache entry
 * @property {function(string): boolean} delete - Delete cache entry
 * @property {function(): void} clear - Clear cache
 * @property {number} size - Current cache size
 * @property {function(): CacheStats} getStats - Get cache statistics
 */

/**
 * Query cache entry
 * @typedef {Object} QueryCacheEntry
 * @property {QueryResults} result - Cached result
 * @property {number} timestamp - Cache timestamp
 * @property {number} ttl - Time to live
 * @property {number} accessCount - Access counter
 * @property {number} lastAccessed - Last access timestamp
 * @property {number} size - Entry size in bytes
 */

/**
 * Cache statistics
 * @typedef {Object} CacheStats
 * @property {number} size - Current size
 * @property {number} hits - Cache hits
 * @property {number} misses - Cache misses
 * @property {number} hitRate - Hit rate percentage
 * @property {number} totalSize - Total size in bytes
 * @property {number} averageSize - Average entry size
 * @property {number} oldestEntry - Oldest entry timestamp
 * @property {number} newestEntry - Newest entry timestamp
 */

/**
 * Query execution metrics
 * @typedef {Object} QueryMetrics
 * @property {number} totalQueries - Total queries executed
 * @property {number} successfulQueries - Successful queries
 * @property {number} failedQueries - Failed queries
 * @property {number} averageExecutionTime - Average execution time
 * @property {number} cacheHits - Cache hits
 * @property {number} cacheMisses - Cache misses
 * @property {number} slowQueries - Number of slow queries
 * @property {Record<string, number>} queryComplexityDistribution - Query complexity distribution
 */

/**
 * Comprehensive graph metrics
 * @typedef {Object} GraphMetrics
 * @property {BasicGraphMetrics} basic - Basic graph metrics
 * @property {StructuralGraphMetrics} structural - Structural metrics
 * @property {SemanticGraphMetrics} semantic - Semantic metrics
 * @property {QualityGraphMetrics} quality - Quality metrics
 * @property {CentralityGraphMetrics} centrality - Centrality metrics
 * @property {ConnectivityGraphMetrics} connectivity - Connectivity metrics
 * @property {DerivedGraphMetrics} derived - Derived metrics
 */

/**
 * Basic graph metrics
 * @typedef {Object} BasicGraphMetrics
 * @property {number} nodeCount - Number of nodes
 * @property {number} edgeCount - Number of edges
 * @property {number} tripleCount - Number of triples
 * @property {number} predicateCount - Number of predicates
 * @property {number} classCount - Number of classes
 * @property {number} propertyCount - Number of properties
 */

/**
 * Structural graph metrics
 * @typedef {Object} StructuralGraphMetrics
 * @property {number} density - Graph density
 * @property {number} diameter - Graph diameter
 * @property {number} averagePathLength - Average path length
 * @property {number} averageDegree - Average node degree
 * @property {number} maxDegree - Maximum node degree
 * @property {number} minDegree - Minimum node degree
 */

/**
 * Semantic graph metrics
 * @typedef {Object} SemanticGraphMetrics
 * @property {number} ontologyComplexity - Ontology complexity score
 * @property {number} semanticDensity - Semantic density
 * @property {number} classHierarchyDepth - Class hierarchy depth
 * @property {number} propertyHierarchyDepth - Property hierarchy depth
 * @property {number} instanceToClassRatio - Instance to class ratio
 */

/**
 * Graph quality metrics
 * @typedef {Object} QualityGraphMetrics
 * @property {number} completeness - Data completeness score
 * @property {number} consistency - Data consistency score
 * @property {number} accuracy - Data accuracy score
 * @property {number} timeliness - Data timeliness score
 * @property {number} validity - Data validity score
 */

/**
 * Centrality metrics
 * @typedef {Object} CentralityGraphMetrics
 * @property {Record<string, number>} degreeCentrality - Degree centrality scores
 * @property {Record<string, number>} betweennessCentrality - Betweenness centrality scores
 * @property {Record<string, number>} closenesseCentrality - Closeness centrality scores
 * @property {Record<string, number>} eigenvectorCentrality - Eigenvector centrality scores
 */

/**
 * Connectivity metrics
 * @typedef {Object} ConnectivityGraphMetrics
 * @property {number} connectedComponents - Number of connected components
 * @property {number} stronglyConnectedComponents - Number of strongly connected components
 * @property {number} clusteringCoefficient - Clustering coefficient
 * @property {number} modularity - Modularity score
 * @property {number} assortativity - Assortativity coefficient
 */

/**
 * Derived graph metrics
 * @typedef {Object} DerivedGraphMetrics
 * @property {number} sparsity - Graph sparsity
 * @property {number} efficiency - Graph efficiency
 * @property {number} smallWorldness - Small-world property
 * @property {number} scaleFreeness - Scale-free property
 */

/**
 * Pattern matching result
 * @typedef {Object} PatternMatch
 * @property {QueryPattern} pattern - Matched pattern
 * @property {Binding[]} bindings - Variable bindings
 * @property {number} cost - Matching cost
 * @property {number} selectivity - Pattern selectivity
 */

/**
 * Triple pattern
 * @typedef {Object} TriplePattern
 * @property {TripleComponent} subject - Subject component
 * @property {TripleComponent} predicate - Predicate component
 * @property {TripleComponent} object - Object component
 * @property {TripleComponent} [graph] - Graph component
 */

/**
 * Index information
 * @typedef {Object} Index
 * @property {string} name - Index name
 * @property {'spo'|'pos'|'osp'|'sop'|'pso'|'ops'|'full-text'|'spatial'|'temporal'} type - Index type
 * @property {number} size - Index size
 * @property {Date} lastUpdated - Last update timestamp
 * @property {IndexStatistics} statistics - Index statistics
 */

/**
 * Index statistics
 * @typedef {Object} IndexStatistics
 * @property {number} totalEntries - Total index entries
 * @property {number} uniqueEntries - Unique index entries
 * @property {number} averageKeyLength - Average key length
 * @property {number} memoryUsage - Memory usage in bytes
 * @property {number} accessCount - Access counter
 * @property {Date} lastAccessed - Last access timestamp
 */

/**
 * Query optimization result
 * @typedef {Object} QueryOptimizationResult
 * @property {ParsedQuery} originalQuery - Original query
 * @property {ParsedQuery} optimizedQuery - Optimized query
 * @property {OptimizationRule[]} optimizations - Applied optimizations
 * @property {number} estimatedSpeedup - Estimated performance improvement
 * @property {string[]} warnings - Optimization warnings
 */

/**
 * Optimization rule
 * @typedef {Object} OptimizationRule
 * @property {string} name - Rule name
 * @property {string} description - Rule description
 * @property {boolean} applied - Whether rule was applied
 * @property {number} estimatedBenefit - Estimated benefit score
 * @property {string[]} conditions - Application conditions
 */

/**
 * Search result
 * @typedef {Object} SearchResult
 * @property {string} uri - Result URI
 * @property {string} [label] - Result label
 * @property {string} [description] - Result description
 * @property {string} [type] - Result type
 * @property {number} score - Relevance score
 * @property {number} relevance - Relevance rating
 * @property {SearchContext} context - Search context
 * @property {string[]} [highlight] - Highlighted text snippets
 */

/**
 * Search context information
 * @typedef {Object} SearchContext
 * @property {'fulltext'|'fuzzy'|'semantic'|'vector'} source - Search source type
 * @property {'exact'|'partial'|'similarity'|'embedding'} matchType - Match type
 * @property {number} confidence - Confidence score
 * @property {Record<string, any>} metadata - Additional metadata
 */

/**
 * Context extraction result
 * @typedef {Object} ContextExtractionResult
 * @property {EntityContext[]} entities - Extracted entities
 * @property {PropertyContext[]} properties - Extracted properties
 * @property {ClassContext[]} classes - Extracted classes
 * @property {RelationshipContext[]} relationships - Extracted relationships
 * @property {TemporalContext[]} temporal - Temporal context
 * @property {SpatialContext[]} spatial - Spatial context
 * @property {ProvenanceContext[]} provenance - Provenance context
 */

/**
 * Entity context information
 * @typedef {Object} EntityContext
 * @property {string} uri - Entity URI
 * @property {string} [label] - Entity label
 * @property {string[]} types - Entity types
 * @property {Record<string, any>} properties - Entity properties
 * @property {string[]} incomingRelations - Incoming relation predicates
 * @property {string[]} outgoingRelations - Outgoing relation predicates
 * @property {number} importance - Importance score
 */

/**
 * Property context information
 * @typedef {Object} PropertyContext
 * @property {string} uri - Property URI
 * @property {string} [label] - Property label
 * @property {string[]} domain - Property domain classes
 * @property {string[]} range - Property range classes
 * @property {number} frequency - Usage frequency
 * @property {number} distinctValues - Number of distinct values
 * @property {any[]} examples - Example values
 */

/**
 * Class context information
 * @typedef {Object} ClassContext
 * @property {string} uri - Class URI
 * @property {string} [label] - Class label
 * @property {string[]} superClasses - Super class URIs
 * @property {string[]} subClasses - Sub class URIs
 * @property {number} instances - Number of instances
 * @property {string[]} properties - Associated properties
 */

/**
 * Relationship context information
 * @typedef {Object} RelationshipContext
 * @property {string} predicate - Relationship predicate
 * @property {string} subject - Subject URI
 * @property {string} object - Object URI
 * @property {number} weight - Relationship weight
 * @property {number} confidence - Confidence score
 * @property {Object} [temporal] - Temporal information
 * @property {Date} [temporal.start] - Start time
 * @property {Date} [temporal.end] - End time
 * @property {Date} [temporal.during] - During time
 */

/**
 * Temporal context information
 * @typedef {Object} TemporalContext
 * @property {Date} [timepoint] - Specific time point
 * @property {Object} [interval] - Time interval
 * @property {Date} interval.start - Interval start
 * @property {Date} interval.end - Interval end
 * @property {number} [duration] - Duration in milliseconds
 * @property {'year'|'month'|'day'|'hour'|'minute'|'second'} precision - Time precision
 */

/**
 * Spatial context information
 * @typedef {Object} SpatialContext
 * @property {Object} location - Geographic location
 * @property {number} location.latitude - Latitude coordinate
 * @property {number} location.longitude - Longitude coordinate
 * @property {string} [region] - Geographic region
 * @property {number} precision - Location precision
 * @property {string} source - Data source
 */

/**
 * Provenance context information
 * @typedef {Object} ProvenanceContext
 * @property {string} entity - Entity URI
 * @property {string} activity - Activity URI
 * @property {string} agent - Agent URI
 * @property {Date} timestamp - Provenance timestamp
 * @property {string[]} derivation - Derivation chain
 * @property {string[]} influence - Influence chain
 */

/**
 * Validation result
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - Whether validation passed
 * @property {ValidationError[]} errors - Validation errors
 * @property {ValidationWarning[]} warnings - Validation warnings
 * @property {ValidationStatistics} statistics - Validation statistics
 */

/**
 * Validation error
 * @typedef {Object} ValidationError
 * @property {string} code - Error code
 * @property {string} message - Error message
 * @property {'error'|'warning'|'info'} severity - Error severity
 * @property {Object} [location] - Error location
 * @property {number} location.line - Line number
 * @property {number} location.column - Column number
 * @property {string} [suggestion] - Suggested fix
 */

/**
 * Validation warning
 * @typedef {Object} ValidationWarning
 * @property {string} code - Warning code
 * @property {string} message - Warning message
 * @property {Object} [location] - Warning location
 * @property {number} location.line - Line number
 * @property {number} location.column - Column number
 */

/**
 * Validation statistics
 * @typedef {Object} ValidationStatistics
 * @property {number} totalChecks - Total validation checks
 * @property {number} passed - Passed checks
 * @property {number} failed - Failed checks
 * @property {number} warnings - Warning count
 * @property {number} executionTime - Execution time in milliseconds
 */

/**
 * Query engine events interface
 * @typedef {Object} QueryEngineEvents
 * @property {Object} query:started - Query started event
 * @property {string} query:started.queryId - Query identifier
 * @property {string} query:started.query - Query string
 * @property {Object} query:completed - Query completed event
 * @property {string} query:completed.queryId - Query identifier
 * @property {number} query:completed.executionTime - Execution time
 * @property {number} query:completed.resultCount - Result count
 * @property {Object} query:failed - Query failed event
 * @property {string} query:failed.queryId - Query identifier
 * @property {Error} query:failed.error - Failure error
 * @property {number} query:failed.executionTime - Execution time
 */

/**
 * Base class for Query Engine errors
 */
export class QueryEngineError extends Error {
  /**
   * @param {string} message - Error message
   * @param {string} code - Error code
   * @param {any} [details] - Additional error details
   */
  constructor(message, code, details) {
    super(message);
    this.code = code;
    this.details = details;
    this.name = 'QueryEngineError';
  }
}

/**
 * Query parsing error
 */
export class QueryParsingError extends QueryEngineError {
  /**
   * @param {string} message - Error message
   * @param {any} [details] - Additional error details
   */
  constructor(message, details) {
    super(message, 'QUERY_PARSING_ERROR', details);
    this.name = 'QueryParsingError';
  }
}

/**
 * Query execution error
 */
export class QueryExecutionError extends QueryEngineError {
  /**
   * @param {string} message - Error message
   * @param {any} [details] - Additional error details
   */
  constructor(message, details) {
    super(message, 'QUERY_EXECUTION_ERROR', details);
    this.name = 'QueryExecutionError';
  }
}

/**
 * Query timeout error
 */
export class QueryTimeoutError extends QueryEngineError {
  /**
   * @param {string} message - Error message
   * @param {number} timeout - Timeout value in milliseconds
   */
  constructor(message, timeout) {
    super(message, 'QUERY_TIMEOUT_ERROR', { timeout });
    this.name = 'QueryTimeoutError';
  }
}