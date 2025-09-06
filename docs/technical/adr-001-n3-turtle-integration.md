# ADR-001: N3.js and Turtle Format Integration

**Status:** Proposed  
**Date:** 2025-09-06  
**Deciders:** Unjucks Architecture Team, Hive Mind Collective  

## Context and Problem Statement

Unjucks currently generates code from templates using Nunjucks with YAML frontmatter, but lacks the ability to work with semantic data formats like RDF/Turtle. Many modern applications need to generate code from ontologies, schemas, and linked data sources. We need to integrate RDF parsing capabilities while maintaining backward compatibility and performance.

## Decision Drivers

- **Developer Experience**: Simple integration with existing Unjucks workflow
- **Performance**: No significant impact on generation speed
- **Backward Compatibility**: Existing templates must continue working
- **Semantic Web Standards**: Support for standard RDF formats
- **Template Power**: Enable rich code generation from semantic data
- **80/20 Principle**: Focus on features that provide maximum value

## Considered Options

### Option 1: External RDF Processing
- **Pros**: Clean separation of concerns, no core changes
- **Cons**: Complex workflow, poor DX, requires external tools

### Option 2: Full SPARQL Integration  
- **Pros**: Complete semantic web compliance
- **Cons**: Overkill for template generation, performance impact, complexity

### Option 3: N3.js with Simple Query Engine (CHOSEN)
- **Pros**: Mature library, streaming support, good performance, template-focused
- **Cons**: Custom query syntax, not full SPARQL

### Option 4: Custom RDF Parser
- **Pros**: Complete control, optimized for templates
- **Cons**: Reinventing the wheel, maintenance burden

## Decision Outcome

**Chosen Option: N3.js with Simple Query Engine**

We will integrate N3.js library with a template-optimized query engine that provides:

1. **Turtle/N3 file parsing** using N3.js streaming parser
2. **Template context injection** of RDF data as JavaScript objects  
3. **Simple query syntax** optimized for template generation
4. **Multi-level caching** for performance optimization
5. **Graceful error handling** with fallback behaviors

## Implementation Strategy

### Core Components
```typescript
// New components to add to Unjucks
class TurtleParser {
  parse(source: string): Promise<RDFContext>
  parseFile(path: string): Promise<RDFContext>
}

class RDFContextBuilder {
  buildContext(sources: TurtleDataSource[]): Promise<Record<string, any>>
}

class SimpleQueryEngine {
  query(pattern: string, context: RDFContext): QueryResult[]
}
```

### Integration Points
1. **Frontmatter Extension**: New `turtle_*` properties
2. **CLI Extension**: New `--turtle-*` arguments
3. **Context Extension**: New `rdf.*` template variables
4. **Filter Extension**: New Nunjucks filters for RDF operations
5. **Cache Extension**: RDF-specific caching layers

### Template Usage Examples
```yaml
---
to: "{{ subject | kebabCase }}.ts"
turtle_data: "./schema.ttl"
turtle_namespace: "schema"  
turtle_query: "?s rdf:type schema:Person"
---
```

```nunjucks
{% set people = rdf.schema.query("?s rdf:type schema:Person") %}
{% for person in people %}
export class {{ person.s.value | split("/") | last | pascalCase }} {
  // Generated from {{ person.s.value }}
}
{% endfor %}
```

## Consequences

### Positive
- **Rich Semantic Generation**: Generate code from ontologies and schemas
- **Standards Compliance**: Support for W3C RDF standards
- **Performance**: Streaming parsing and multi-level caching
- **Developer Experience**: Simple CLI and frontmatter integration
- **Backward Compatibility**: Zero impact on existing templates
- **Extensibility**: Foundation for advanced semantic features

### Negative
- **New Dependency**: Adds N3.js as a core dependency
- **Learning Curve**: Developers need to understand RDF concepts
- **Query Limitations**: Custom syntax, not full SPARQL
- **Memory Usage**: RDF data structures consume additional memory
- **Complexity**: More moving parts in the system

### Neutral
- **Bundle Size**: Minimal impact due to tree-shaking
- **Maintenance**: Well-maintained N3.js library reduces burden

## Implementation Plan

### Phase 1: Core Integration (MVP)
- [ ] Add N3.js dependency
- [ ] Implement TurtleParser class
- [ ] Basic RDF context injection
- [ ] CLI argument support
- [ ] Frontmatter extensions
- [ ] Basic error handling

### Phase 2: Query Engine
- [ ] Simple query parser
- [ ] Pattern matching engine  
- [ ] Template query syntax
- [ ] Nunjucks filters
- [ ] Query result caching

### Phase 3: Optimization
- [ ] Multi-level caching system
- [ ] Memory usage optimization
- [ ] Streaming parser integration
- [ ] Performance benchmarking

### Phase 4: Advanced Features
- [ ] Remote data source support
- [ ] Advanced query operations
- [ ] Real-time data updates
- [ ] Extended SPARQL features

## Validation and Testing

### Test Strategy
- **Unit Tests**: Parser, query engine, context builder
- **Integration Tests**: Full template generation workflows
- **Performance Tests**: Large dataset handling
- **Compatibility Tests**: Backward compatibility validation
- **Error Tests**: Graceful degradation scenarios

### Success Metrics
- Zero breaking changes to existing templates
- < 100ms overhead for typical RDF datasets (< 1MB)
- > 90% test coverage for new RDF features
- Clear documentation and examples
- Positive developer feedback

## Monitoring and Review

### Performance Monitoring
- Generation time metrics
- Memory usage tracking
- Cache hit rates
- Error rates and types

### Review Schedule
- 30 days: Initial implementation review
- 90 days: Performance and usage analysis  
- 180 days: Feature completeness evaluation
- 365 days: Strategic direction assessment

## Related ADRs
- ADR-002: RDF Caching Strategy (TBD)
- ADR-003: Query Language Design (TBD)  
- ADR-004: Template Context Architecture (TBD)

## References
- [N3.js Documentation](https://github.com/rdfjs/N3.js)
- [RDF 1.1 Turtle Specification](https://www.w3.org/TR/turtle/)
- [Unjucks Architecture Documentation](./n3-turtle-integration-architecture.md)
- [RDF Query Engine Design](./rdf-query-engine-design.md)