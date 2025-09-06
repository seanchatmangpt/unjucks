# ADR-002: N3.js RDF Integration Architecture

## Status
**Proposed** - 2025-01-06

## Context

Unjucks, as a template-driven code generation system, needs to support semantic web data sources (RDF/Turtle) to enable developers to generate code from ontologies, linked data, and semantic schemas. This integration must be performant, maintainable, and backward compatible with existing templates.

### Key Requirements
1. **Semantic Data Support**: Load and process RDF data from multiple sources (files, inline, URIs)
2. **Template Integration**: Provide intuitive access patterns within Nunjucks templates
3. **Performance**: Handle large RDF datasets efficiently with appropriate caching
4. **Schema Support**: Validate data against OWL/RDFS/SHACL schemas
5. **Developer Experience**: Clear APIs, good error messages, and debugging tools
6. **Backward Compatibility**: No impact on existing non-RDF templates

## Decision

We will integrate N3.js as the primary RDF processing library into Unjucks through a multi-layered architecture:

### Architecture Layers

1. **Data Loading Layer** (`RDFDataLoader`)
   - Multi-source RDF data loading (file, inline, URI, SPARQL endpoint)
   - Caching with LRU memory cache and file system persistence
   - Error handling and validation

2. **Template Integration Layer** (`RDFTemplateContext`)
   - Enhanced Nunjucks context with `$rdf` object
   - Direct variable access from RDF properties
   - Metadata exposure for debugging and introspection

3. **Filter System** (`RDFFilters`)
   - Comprehensive set of RDF-specific Nunjucks filters
   - URI manipulation, data access, type checking, and querying
   - Chainable filter operations for complex data transformations

4. **Schema Support Layer** (`SchemaValidator`)
   - OWL/RDFS ontology loading
   - SHACL constraint validation
   - Basic inference engine for property reasoning

5. **Caching Layer** (`RDFCacheManager`)
   - Multi-level caching (L1: memory, L2: query results, L3: filesystem)
   - Intelligent cache key generation and invalidation
   - Memory management with resource limits

### Key Design Decisions

#### 1. N3.js as Core RDF Library
**Decision**: Use N3.js as the primary RDF parsing and querying library.

**Rationale**:
- Mature, actively maintained TypeScript library
- Excellent performance for large RDF datasets  
- Built-in SPARQL query support
- Compatible with W3C RDF standards
- Strong typing support for better developer experience

**Alternatives Considered**:
- rdflib.js: Less performant, heavier dependency
- Custom RDF parser: Too much development overhead
- Multiple backend support: Added complexity without clear benefits

#### 2. Opt-in Integration via Frontmatter
**Decision**: RDF features are enabled through frontmatter configuration only.

**Rationale**:
- Zero impact on existing templates
- Clear declaration of data dependencies
- Enables per-template RDF configuration
- Supports gradual migration and adoption

**Example**:
```yaml
---
to: "{{ className | kebabCase }}.ts"
turtle: "./schemas/ontology.ttl"
rdfQuery:
  subject: "?class"
  predicate: "rdf:type"
  object: "owl:Class"
---
```

#### 3. Multi-level Caching Strategy
**Decision**: Implement L1 (memory), L2 (query), and L3 (filesystem) caching.

**Rationale**:
- RDF parsing is computationally expensive
- Template generation often reuses same data
- Query results can be cached independently
- Filesystem cache survives process restarts

**Trade-offs**:
- Added complexity in cache management
- Memory usage considerations for large datasets
- Cache invalidation challenges

#### 4. Enhanced Template Context Pattern
**Decision**: Extend Nunjucks context with `$rdf` object and direct variable mapping.

**Rationale**:
- Intuitive access patterns: `{{ person.foaf_name }}` and `{{ $rdf.label(person.uri) }}`
- Preserves existing Nunjucks syntax and patterns
- Provides both simple and advanced access methods
- Clear separation between RDF and template data

#### 5. Comprehensive Filter System
**Decision**: Provide specialized RDF filters for common operations.

**Rationale**:
- Nunjucks filters are familiar to template authors
- Chainable operations enable complex transformations
- Type-safe operations with TypeScript support
- Reusable patterns across templates

**Examples**:
```nunjucks
{{ uri | rdfCompact($rdf.prefixes) }}
{{ person | rdfProperty("foaf:name") | first }}
{{ $rdf | rdfByType("foaf:Person") | rdfSortBy("foaf:name") }}
```

#### 6. Schema Validation Integration
**Decision**: Support OWL/RDFS/SHACL validation as optional template features.

**Rationale**:
- Enables data quality checks during generation
- Supports ontology-driven development workflows
- Optional to avoid performance impact when not needed
- Extensible validation framework

## Consequences

### Positive
1. **Rich Semantic Capabilities**: Developers can generate code from ontologies and linked data
2. **Performance**: Multi-level caching provides excellent performance for repeated operations
3. **Flexibility**: Multiple data sources and query methods support diverse workflows
4. **Type Safety**: Strong TypeScript integration improves developer experience
5. **Maintainability**: Clean layer separation enables independent component evolution
6. **Backward Compatibility**: Existing templates continue working without changes

### Negative
1. **Complexity**: Additional layers increase overall system complexity
2. **Memory Usage**: RDF data structures can be memory-intensive
3. **Learning Curve**: Developers need to understand RDF concepts and query patterns
4. **Dependency Management**: N3.js and related libraries add to bundle size
5. **Cache Management**: Multi-level caching requires careful memory and storage management

### Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Memory exhaustion with large RDF datasets | High | Implement memory limits, streaming parsing, and resource cleanup |
| Performance degradation for complex queries | Medium | Query result caching, indexed access patterns, and query optimization |
| Breaking changes in N3.js updates | Medium | Abstract RDF operations behind interfaces, comprehensive test coverage |
| Developer confusion with RDF concepts | Medium | Comprehensive documentation, examples, and error messages |
| Cache corruption or invalidation issues | Low | Versioned cache format, automatic cleanup, and fallback mechanisms |

## Implementation Phases

### Phase 1: Core Infrastructure (Weeks 1-3)
- Enhanced frontmatter parser with RDF configuration
- Basic RDFDataLoader with file and inline support
- Simple template context integration
- Core type definitions

### Phase 2: Template Integration (Weeks 4-7)
- Complete RDF filter system implementation
- Enhanced template context with `$rdf` object
- Basic caching layer (L1 memory cache)
- Error handling and validation

### Phase 3: Advanced Features (Weeks 8-12)
- SPARQL query support
- Schema validation (OWL/RDFS/SHACL)
- Multi-level caching implementation
- Performance optimization

### Phase 4: Developer Experience (Weeks 13-15)
- CLI debugging tools
- Comprehensive documentation and examples
- Migration utilities
- Performance profiling tools

## Success Metrics

### Functional Metrics
- [ ] Support for Turtle, N-Triples, and JSON-LD formats
- [ ] SPARQL query execution with 90% compatibility
- [ ] OWL/RDFS/SHACL schema validation
- [ ] Zero breaking changes to existing templates

### Performance Metrics
- [ ] Parse 100K triples in under 2 seconds
- [ ] Template generation with caching 5x faster than without
- [ ] Memory usage under 200MB for 1M triple datasets
- [ ] 95% cache hit rate for repeated operations

### Developer Experience Metrics
- [ ] Clear error messages with line/column information
- [ ] Comprehensive filter documentation with examples
- [ ] IDE support through TypeScript definitions
- [ ] Successful migration from 2+ other RDF template systems

## Related Decisions

- **ADR-001**: N3.js Turtle Integration - Established foundation for RDF support
- **Future ADR**: GraphQL-to-SPARQL Translation - May extend query capabilities
- **Future ADR**: Real-time RDF Data Sources - May add streaming data support

## References

- [N3.js Documentation](https://github.com/rdfjs/N3.js)
- [W3C RDF 1.1 Specification](https://www.w3.org/TR/rdf11-concepts/)
- [SPARQL 1.1 Query Language](https://www.w3.org/TR/sparql11-query/)
- [SHACL Shapes Constraint Language](https://www.w3.org/TR/shacl/)
- [Nunjucks Template Engine](https://mozilla.github.io/nunjucks/)

---

**Decision made by**: System Architecture Team  
**Review date**: 2025-03-01  
**Next review**: 2025-06-01