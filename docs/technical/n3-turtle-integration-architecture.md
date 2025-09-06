# N3.js and Turtle Format Integration Architecture

## Executive Summary

This document outlines the architecture for integrating N3.js and Turtle format support into the Unjucks template system, enabling RDF data to be parsed and made available as template context variables.

## Current Unjucks Architecture Analysis

### Core Components
- **Generator**: Main orchestrator using Nunjucks templates
- **FrontmatterParser**: YAML-based configuration parser with extension points
- **TemplateScanner**: Variable extraction and CLI argument generation
- **FileInjector**: File writing and injection capabilities
- **TemplateCache**: Performance optimization layer

### Key Extension Points
1. **Nunjucks Filters**: Custom filters in `Generator.addCustomFilters()`
2. **FrontmatterConfig**: Interface supports new properties
3. **TemplateVariable**: Supports string|boolean|number types
4. **CLI Args Generation**: Dynamic argument creation from template variables

## N3.js Turtle Integration Architecture

### 1. Core Integration Strategy (80/20 Approach)

**20% of features providing 80% of value:**
- Turtle file parsing into JavaScript objects
- RDF data injection into Nunjucks context
- Basic SPARQL-like queries for data filtering
- CLI flags for Turtle data sources

### 2. Component Architecture

```typescript
// New components to add
interface TurtleDataSource {
  path: string;
  namespace?: string;
  format: 'turtle' | 'n3' | 'trig';
}

interface RDFContext {
  triples: Triple[];
  subjects: Map<string, Triple[]>;
  predicates: Map<string, Triple[]>;
  objects: Map<string, Triple[]>;
  namespaces: Map<string, string>;
}

class TurtleParser {
  // N3.js integration
  parse(source: string): Promise<RDFContext>
  parseFile(path: string): Promise<RDFContext>
  query(context: RDFContext, pattern: TriplePattern): Triple[]
}

class RDFContextBuilder {
  // Build context for templates
  buildContext(sources: TurtleDataSource[]): Promise<Record<string, any>>
}
```

### 3. Integration Points

#### A. Frontmatter Extensions
```yaml
---
to: "{{ subject | kebabCase }}.ts"
turtle_data: "./data/schema.ttl"
turtle_namespace: "schema"
turtle_query: 
  subject: "?s a schema:Person"
skipIf: "!turtle_data"
---
```

#### B. CLI Interface
```bash
unjucks generate person template \
  --turtle-data ./data/people.ttl \
  --turtle-namespace people \
  --turtle-query "?s a foaf:Person"
```

#### C. Template Context Structure
```javascript
{
  // Existing variables
  name: "John",
  withTests: true,
  
  // New RDF context
  rdf: {
    people: {
      subjects: [...],
      by_type: {
        "foaf:Person": [...],
        "schema:Organization": [...]
      },
      namespaces: {
        foaf: "http://xmlns.com/foaf/0.1/",
        schema: "https://schema.org/"
      }
    }
  }
}
```

### 4. Data Flow Architecture

```
1. CLI/Frontmatter → TurtleDataSource[]
2. TurtleParser.parseFile() → RDFContext
3. RDFContextBuilder.buildContext() → Template Variables
4. Generator.nunjucksEnv.renderString() → Processed Content
5. FileInjector → Final Output
```

### 5. Caching Strategy

#### Multi-level Caching
1. **File-level**: Cache parsed Turtle files by file path + mtime
2. **Query-level**: Cache SPARQL-like query results
3. **Context-level**: Cache built template contexts

```typescript
interface TurtleCacheEntry {
  filePath: string;
  mtime: number;
  parsed: RDFContext;
  queries: Map<string, Triple[]>;
}
```

### 6. Error Handling Architecture

#### Graceful Degradation
1. **Missing Turtle files**: Log warning, continue with empty RDF context
2. **Parse errors**: Display helpful error messages with line numbers
3. **Query errors**: Fallback to empty result set
4. **Network timeouts**: For remote Turtle sources

```typescript
interface RDFError {
  type: 'parse' | 'query' | 'network' | 'file';
  message: string;
  source?: string;
  line?: number;
  column?: number;
}
```

### 7. Performance Optimization

#### Memory Management
- **Streaming parsing** for large RDF datasets
- **Lazy loading** of RDF contexts
- **Memory pooling** for Triple objects
- **Background parsing** with worker threads

#### Query Optimization
- **Index structures** for subjects, predicates, objects
- **Query plan optimization** for complex patterns
- **Result caching** with TTL expiration

### 8. CLI Interface Design

#### New CLI Arguments
```typescript
interface TurtleCliArgs {
  'turtle-data'?: string | string[];     // File paths or URLs
  'turtle-namespace'?: string;           // Context namespace
  'turtle-query'?: string;               // SPARQL-like query
  'turtle-format'?: 'turtle' | 'n3' | 'trig';
  'turtle-cache'?: boolean;              // Enable/disable caching
  'turtle-remote'?: boolean;             // Allow remote sources
}
```

#### Usage Examples
```bash
# Basic Turtle data injection
unjucks generate api endpoint --turtle-data ./schema.ttl

# Multiple data sources
unjucks generate docs --turtle-data ./schema.ttl,./vocab.ttl

# Remote data source
unjucks generate model --turtle-data https://schema.org/Person.ttl --turtle-remote

# With query filtering
unjucks generate component --turtle-data ./ui.ttl --turtle-query "?s a ui:Component"
```

### 9. TypeScript Interface Design

```typescript
// Core RDF types
interface Triple {
  subject: NamedNode | BlankNode;
  predicate: NamedNode;
  object: NamedNode | BlankNode | Literal;
}

interface NamedNode {
  termType: 'NamedNode';
  value: string;
}

interface Literal {
  termType: 'Literal';
  value: string;
  language?: string;
  datatype?: NamedNode;
}

// Template context types
interface RDFTemplateContext {
  triples: Triple[];
  subjects: Record<string, Triple[]>;
  predicates: Record<string, Triple[]>;
  query: (pattern: string) => Triple[];
  namespaces: Record<string, string>;
}

// Configuration extensions
interface FrontmatterConfig {
  // Existing properties...
  turtle_data?: string | string[];
  turtle_namespace?: string;
  turtle_query?: string | string[];
  turtle_format?: 'turtle' | 'n3' | 'trig';
}
```

### 10. Testing Strategy

#### Test Categories
1. **Unit Tests**: TurtleParser, RDFContextBuilder, query engine
2. **Integration Tests**: Full template generation with RDF data
3. **Performance Tests**: Large dataset handling, memory usage
4. **Error Tests**: Malformed Turtle, network failures

#### Test Data
- **Small datasets**: For unit tests (< 100 triples)
- **Medium datasets**: For integration tests (1K-10K triples)
- **Large datasets**: For performance tests (100K+ triples)

### 11. Migration and Compatibility

#### Backward Compatibility
- All existing templates continue to work unchanged
- RDF features are opt-in via frontmatter or CLI
- No breaking changes to existing APIs

#### Migration Path
1. **Phase 1**: Core N3.js integration with basic parsing
2. **Phase 2**: Query engine and advanced filtering
3. **Phase 3**: Performance optimizations and caching
4. **Phase 4**: Remote data sources and advanced features

## Implementation Priority

### High Priority (MVP)
1. Basic Turtle file parsing with N3.js
2. Simple RDF context injection into templates
3. CLI arguments for Turtle data sources
4. Basic error handling and validation

### Medium Priority
1. Query engine for data filtering
2. Caching system for parsed data
3. Multiple data source support
4. Advanced Nunjucks filters for RDF

### Low Priority
1. Remote data source support
2. Performance optimizations for large datasets
3. Advanced SPARQL query support
4. Real-time data updates

## Risk Assessment

### Technical Risks
- **Performance**: Large RDF datasets could impact generation speed
- **Memory**: Parsed triples could consume significant memory
- **Complexity**: RDF concepts may confuse template authors

### Mitigation Strategies
- Implement streaming and lazy loading
- Add memory usage monitoring and limits
- Provide clear documentation and examples
- Start with simple use cases and gradually add complexity

## Conclusion

This architecture provides a solid foundation for integrating N3.js and Turtle format support into Unjucks while maintaining backward compatibility and following the 80/20 principle. The design emphasizes performance, caching, and developer experience while providing a clear migration path.