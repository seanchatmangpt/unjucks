# SPARQL Query Engine Implementation

## Overview

The SPARQL Query Engine is a production-ready implementation that provides comprehensive SPARQL query execution capabilities for the KGEN system. It enables extracting data from RDF graphs to drive template generation and artifact creation.

## Architecture

### Core Components

1. **SparqlEngine** (`packages/kgen-core/src/sparql-engine.js`)
   - Main engine for SPARQL query execution
   - Supports SELECT, CONSTRUCT, ASK, DESCRIBE queries
   - Template variable resolution
   - Context extraction for artifacts

2. **QueryTemplates** (`packages/kgen-core/src/query-templates.js`)
   - Comprehensive collection of predefined SPARQL query templates
   - Context extraction patterns
   - Impact analysis queries
   - Validation and integrity checks

3. **SparqlCommand** (`packages/kgen-core/src/cli/sparql-command.js`)
   - Command-line interface for query execution
   - Interactive query shell
   - Result formatting and export

4. **ArtifactSparqlIntegration** (`packages/kgen-core/src/integration/artifact-sparql-integration.js`)
   - Integration layer for artifact generation
   - Variable resolution from RDF graphs
   - Context enrichment for templates

## Key Features

### 1. Query Execution
- **Multiple Query Types**: SELECT, CONSTRUCT, ASK, DESCRIBE
- **Query Optimization**: Automatic query optimization and caching
- **Result Processing**: Structured result formatting and enrichment
- **Error Handling**: Comprehensive error handling and logging

### 2. Template Variable Resolution
```javascript
const variables = await sparqlEngine.extractTemplateVariables('user.java.njk', {
  entityUri: 'http://example.org/User',
  artifactType: 'java-class'
});

// Returns:
// {
//   className: { value: 'User', type: 'string', source: 'graph' },
//   packageName: { value: 'com.example', type: 'string', source: 'graph' },
//   generateTests: { value: true, type: 'boolean', source: 'context' }
// }
```

### 3. Context Extraction
```javascript
const context = await sparqlEngine.extractContext('http://example.org/User');

// Returns rich context including:
// - Entity properties
// - Relationships (incoming/outgoing)
// - Metadata
// - Provenance information (if enabled)
```

### 4. Impact Analysis
```javascript
const impact = await sparqlEngine.analyzeImpact('http://example.org/User');

// Returns:
// - Direct dependents
// - Indirect dependents (transitive)
// - Dependencies
// - Impact score and risk level
```

### 5. Graph Validation
```javascript
const validation = await sparqlEngine.validateGraph();

// Checks for:
// - Orphaned nodes
// - Broken references
// - Missing required properties
// - Duplicate entities
// - Cyclic dependencies
```

## Query Templates

### Template Resolution Queries
- `templateVariables`: Extract variables for a specific template
- `templateByPath`: Get template metadata by path
- `allTemplates`: List all available templates
- `contextualVariables`: Merge template and context variables

### Context Extraction Queries
- `entityContext`: Extract all properties for an entity
- `entityRelations`: Get incoming/outgoing relationships
- `entityHierarchy`: Extract type hierarchy
- `domainModel`: Extract domain model structure

### Impact Analysis Queries
- `directDependents`: Find direct dependencies
- `transitiveDependents`: Find transitive dependencies
- `impactScope`: Analyze scope of changes
- `riskAssessment`: Assess risk levels

### Validation Queries
- `schemaValidation`: Validate against SHACL constraints
- `referenceIntegrity`: Check reference integrity
- `consistencyCheck`: Check logical consistency
- `dataQuality`: Assess data quality

## Command-Line Usage

### Initialize Engine
```bash
# Initialize with RDF graph
node packages/kgen-core/src/cli/sparql-command.js init graph.ttl

# Execute query
node packages/kgen-core/src/cli/sparql-command.js query "SELECT ?s ?p ?o WHERE { ?s ?p ?o } LIMIT 10"

# Execute template query
node packages/kgen-core/src/cli/sparql-command.js template entityContext --entityUri http://example.org/User

# Extract variables
node packages/kgen-core/src/cli/sparql-command.js variables user.java.njk --context '{"entityType":"User"}'

# Analyze impact
node packages/kgen-core/src/cli/sparql-command.js impact http://example.org/User

# Validate graph
node packages/kgen-core/src/cli/sparql-command.js validate

# Show statistics
node packages/kgen-core/src/cli/sparql-command.js stats
```

### Output Formats
- **JSON**: Structured data (default)
- **Table**: Formatted table output
- **CSV**: Comma-separated values
- **Pretty**: Pretty-printed JSON

## Integration with Artifact Generation

### Variable Resolution Flow
1. **Template Analysis**: Identify required variables from template
2. **Graph Query**: Extract variables from RDF graph using SPARQL
3. **Context Merge**: Merge with provided context variables
4. **Type Coercion**: Convert values to appropriate types
5. **Validation**: Ensure required variables are present

### Context Enrichment
1. **Entity Properties**: Extract all properties for entities
2. **Relationships**: Map incoming/outgoing relationships
3. **Metadata**: Include creation, modification, versioning data
4. **Provenance**: Track lineage and generation history
5. **Computed Values**: Add derived properties and statistics

## Performance Optimizations

### Caching
- **Query Results**: Cache frequently executed queries
- **Variable Resolution**: Cache resolved template variables
- **Context Data**: Cache extracted context information

### Query Optimization
- **Automatic LIMIT**: Add limits to prevent runaway queries
- **Pattern Ordering**: Optimize triple pattern ordering
- **Index Usage**: Leverage graph processor indexing

### Memory Management
- **LRU Eviction**: Least-recently-used cache eviction
- **Size Limits**: Configurable cache size limits
- **Cleanup**: Automatic cleanup of expired cache entries

## Configuration

### Engine Options
```javascript
const sparqlEngine = new SparqlEngine({
  enableCaching: true,
  maxCacheSize: 5000,
  queryTimeout: 60000,
  maxResults: 50000,
  enableOptimization: true,
  enableProvenance: true
});
```

### Template Options
```javascript
const queryTemplates = new QueryTemplates({
  defaultNamespaces: {
    kgen: 'http://kgen.enterprise/',
    prov: 'http://www.w3.org/ns/prov#'
  }
});
```

## Error Handling

### Query Errors
- **Parse Errors**: Invalid SPARQL syntax
- **Execution Errors**: Query execution failures
- **Timeout Errors**: Query execution timeouts
- **Resource Errors**: Insufficient resources

### Recovery Strategies
- **Graceful Degradation**: Fall back to simpler queries
- **Retry Logic**: Automatic retry for transient failures
- **Error Logging**: Comprehensive error logging and reporting
- **Circuit Breaker**: Prevent cascading failures

## Testing

### Unit Tests
```bash
# Run basic functionality test
node src/test-sparql-basic.js

# Expected output:
# ✅ Query execution working
# ✅ Variable extraction working
# ✅ Context extraction working
# ✅ Graph validation working
```

### Integration Tests
- **Graph Loading**: Test RDF parsing and loading
- **Query Execution**: Test all query types
- **Template Integration**: Test with actual templates
- **Performance**: Load testing with large graphs

## Metrics and Monitoring

### Engine Metrics
- **Queries Executed**: Total number of queries
- **Cache Hit Rate**: Percentage of cache hits
- **Average Execution Time**: Mean query execution time
- **Error Rate**: Query failure rate

### Graph Metrics
- **Graph Size**: Number of triples/quads
- **Entity Counts**: Subjects, predicates, objects
- **Named Graphs**: Number of named graphs
- **Index Status**: Index efficiency metrics

## Best Practices

### Query Design
- **Use LIMIT**: Always include LIMIT for SELECT queries
- **Selective Patterns**: Put most selective patterns first
- **Index Usage**: Design queries to use available indexes
- **Namespace Prefixes**: Use consistent namespace prefixes

### Variable Resolution
- **Required Variables**: Mark required variables in templates
- **Type Safety**: Ensure proper type coercion
- **Default Values**: Provide sensible defaults
- **Context Hierarchy**: Establish clear context precedence

### Performance
- **Cache Warming**: Pre-populate frequently used data
- **Batch Queries**: Combine related queries when possible
- **Resource Limits**: Set appropriate resource limits
- **Monitoring**: Monitor performance metrics

## Troubleshooting

### Common Issues
1. **Missing Dependencies**: Ensure sparqljs and n3 are installed
2. **Memory Issues**: Increase heap size for large graphs
3. **Query Timeouts**: Optimize queries or increase timeout
4. **Cache Issues**: Clear cache for stale data

### Debug Mode
```javascript
const sparqlEngine = new SparqlEngine({
  debug: true,
  logLevel: 'debug'
});
```

### Performance Profiling
```javascript
// Enable detailed metrics
const metrics = sparqlEngine.getMetrics();
console.log('Performance:', {
  avgQueryTime: metrics.averageExecutionTime,
  cacheHitRate: metrics.hitRate,
  queriesExecuted: metrics.queriesExecuted
});
```

## Future Enhancements

### Planned Features
- **Federated Queries**: Support for federated SPARQL queries
- **Streaming Results**: Support for streaming large result sets
- **Graph Updates**: Support for UPDATE queries
- **Custom Functions**: Support for custom SPARQL functions

### Performance Improvements
- **Parallel Execution**: Parallel query execution
- **Advanced Caching**: Semantic caching strategies
- **Query Planning**: Cost-based query planning
- **Distributed Processing**: Support for distributed graphs

## Conclusion

The SPARQL Query Engine provides a robust, production-ready foundation for extracting data from RDF graphs in the KGEN system. Its comprehensive feature set, performance optimizations, and integration capabilities make it suitable for enterprise-scale knowledge graph applications.