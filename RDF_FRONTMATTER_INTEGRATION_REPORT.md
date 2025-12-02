# RDF Support for Frontmatter Engine - Integration Report

## Executive Summary

This report analyzes the `~/unrdf` library to identify RDF processing capabilities that should be integrated into the frontmatter workflow engine. The analysis covers N3.js, @comunica/query-sparql, @rdfjs, eyereasoner, jsonld, and rdf-ext libraries.

## Current State

### Frontmatter Engine Architecture
- **Location**: `src/kgen/core/frontmatter/workflow-engine.js`
- **Parser**: `src/kgen/core/frontmatter/parser.js` (has basic RDF config extraction at lines 348-376)
- **Current RDF Support**: Minimal - only extracts RDF configuration from frontmatter, no actual processing

### Existing RDF Infrastructure in Codebase
- **N3.js**: Already integrated (`n3@^1.26.0` in package.json)
- **RDF Processors**: `packages/kgen-core/src/rdf/processor.js` and `src/kgen/rdf/index.js`
- **SPARQL Support**: Basic SPARQL query execution exists
- **Turtle Parsing**: Implemented in multiple locations

## Recommended Components from ~/unrdf Library

### 1. N3.js Core Components

#### Primary Usage Pattern
```javascript
import { Store, Parser, Writer, DataFactory } from 'n3';
```

**Available in unrdf:**
- `src/knowledge-engine/index.mjs` - Re-exports N3 components
- `src/knowledge-engine/parse.mjs` - Enhanced parsing utilities
- `src/composables/use-validator.mjs` - Validation with N3 Store
- `src/utils/term-utils.mjs` - Term manipulation utilities
- `src/utils/quad-utils.mjs` - Quad manipulation utilities

**Recommendation**: Use unrdf's enhanced parsing utilities:
- `parseTurtle(ttl, baseIRI)` - Parses Turtle with OpenTelemetry tracing
- `toTurtle(store, options)` - Serializes Store to Turtle
- `parseJsonLd(jsonld, baseIRI)` - Parses JSON-LD
- `toJsonLd(store, options)` - Serializes to JSON-LD

**Integration Point**: Extend `FrontmatterParser.getRDFConfig()` to actually load and parse RDF data.

### 2. @comunica/query-sparql Integration

#### Available in unrdf
- **Location**: `src/knowledge-engine/query.mjs`
- **Query Engine**: Singleton pattern with caching (eliminates 100-500ms initialization overhead)
- **Location**: `src/knowledge-engine/query-cache.mjs` - Cached QueryEngine instance

**Key Function:**
```javascript
export async function query(store, sparql, options = {}) {
  const comunica = getQueryEngine(); // Cached singleton
  const res = await comunica.query(sparql, queryOptions);
  // Handles SELECT, ASK, CONSTRUCT, DESCRIBE
}
```

**Benefits:**
- Performance: Singleton QueryEngine eliminates initialization overhead
- OpenTelemetry tracing built-in
- Handles all SPARQL query types (SELECT, ASK, CONSTRUCT, DESCRIBE)
- Automatic result type detection and conversion

**Recommendation**: Use unrdf's `query()` function for SPARQL queries in frontmatter. This provides:
- Better performance than creating new QueryEngine instances
- Consistent query interface
- Built-in observability

**Integration Point**: Add SPARQL query execution to `FrontmatterWorkflowEngine.processTemplate()` when frontmatter contains `rdfQuery` or `sparql` fields.

### 3. eyereasoner (N3 Reasoning)

#### Available in unrdf
- **Location**: `src/knowledge-engine/reason.mjs`
- **Composable**: `src/composables/use-reasoner.mjs` - High-level reasoning interface

**Key Function:**
```javascript
export async function reason(store, rules, options = {}) {
  const query = await loadBasicQuery(); // eyereasoner.basicQuery
  const { result } = await query(combinedQuads, []);
  // Returns Store with original + inferred quads
}
```

**Features:**
- Forward-chaining reasoning with N3 rules
- Supports Turtle rule strings or Store instances
- Option to include/exclude original data
- Debug mode for reasoning inspection

**Recommendation**: Use unrdf's `reason()` function for rule-based inference when frontmatter specifies reasoning rules.

**Integration Point**: Add reasoning step in `FrontmatterWorkflowEngine.processTemplate()` when frontmatter contains `rdfRules` or `reasoning` configuration.

### 4. @rdfjs Components

#### Available in unrdf
- **@rdfjs/data-model**: `^2.0.0` - Used for RDF term creation
- **@rdfjs/namespace**: `^2.0.0` - Namespace utilities
- **@rdfjs/serializer-jsonld**: `^2.0.0` - JSON-LD serialization
- **@rdfjs/serializer-turtle**: `^1.1.5` - Turtle serialization
- **@rdfjs/to-ntriples**: `^2.0.0` - N-Triples serialization

**Usage in unrdf:**
- `src/react-hooks/core/useTriples.mjs` - References @rdfjs/data-model
- Used primarily for compatibility with rdf-ext and rdf-validate-shacl

**Recommendation**: Use N3.js DataFactory directly (already in codebase) instead of @rdfjs/data-model for consistency. Use @rdfjs serializers only if needed for specific format requirements.

### 5. jsonld Library

#### Available in unrdf
- **Version**: `jsonld@^8.2.0`
- **Location**: `src/knowledge-engine/parse.mjs` - `parseJsonLd()` and `toJsonLd()` functions

**Key Functions:**
```javascript
export async function parseJsonLd(jsonld, baseIRI = 'http://example.org/') {
  // Parses JSON-LD to N3 Store
}

export async function toJsonLd(store, options = {}) {
  // Serializes N3 Store to JSON-LD
}
```

**Recommendation**: Use unrdf's `parseJsonLd()` and `toJsonLd()` functions for JSON-LD support. These provide:
- Consistent interface with Turtle parsing
- OpenTelemetry tracing
- Error handling

**Integration Point**: Extend RDF data loading to support JSON-LD format in addition to Turtle.

### 6. rdf-ext Integration

#### Available in unrdf
- **Version**: `rdf-ext@^2.0.0`
- **Primary Usage**: `src/knowledge-engine/validate.mjs` - SHACL validation

**Key Usage:**
```javascript
import rdf from 'rdf-ext';
import SHACLValidator from 'rdf-validate-shacl';

const validator = new SHACLValidator(rdf.dataset(shapesStore.getQuads()));
const report = validator.validate(rdf.dataset(store.getQuads()));
```

**Recommendation**: Use unrdf's `validateShacl()` function for SHACL validation. This provides:
- SHACL validation against shapes
- Detailed validation reports
- Support for Turtle or Store shapes

**Integration Point**: Add SHACL validation step when frontmatter contains `rdfValidate: true` or `shaclShapes` configuration.

### 7. Composables - High-Level RDF Interfaces

#### Available in unrdf
- **Location**: `src/composables/` - Opinionated, high-level RDF composable functions
- **Export**: `src/composables/index.mjs` - Central export point

**Key Composables:**

1. **`useGraph()`** - `src/composables/use-graph.mjs`
   - High-level graph operations with context management
   - SPARQL query methods: `query()`, `select()`, `ask()`, `construct()`, `update()`
   - Graph operations: `union()`, `difference()`, `intersection()`, `isIsomorphic()`
   - Validation: `validate()`, `validateOrThrow()`
   - Serialization: `serialize()`, `toJSONLD()`
   - Statistics: `stats()`
   - Clownface pointer: `pointer()` for fluent graph traversal

2. **`useReasoner()`** - `src/composables/use-reasoner.mjs`
   - High-level reasoning interface
   - Methods: `infer()`, `inferSequence()`, `wouldInfer()`, `getStats()`
   - Pipeline support: `createPipeline()`
   - Import/Export: `import()`, `export()`
   - Statistics tracking for inference operations

3. **`useValidator()`** - `src/composables/use-validator.mjs`
   - SHACL validation wrapper
   - Methods: `validate()`, `validateOrThrow()`
   - Automatic store coercion (string, Store, or array)
   - JSON output option: `validate(data, shapes, { asJson: true })`

4. **`useCanon()`** - `src/composables/use-canon.mjs`
   - Canonicalization and isomorphism operations
   - Methods: `canonicalize()`, `isIsomorphic()`, `hash()`
   - Grouping: `groupByIsomorphism()`, `findIsomorphic()`, `allIsomorphic()`
   - Comparison: `compare()`, `getStats()`
   - Uses URDNA2015 algorithm (rdf-canonize)

5. **`useTerms()`** - `src/composables/use-terms.mjs`
   - RDF term creation with base IRI resolution
   - Methods: `iri()`, `lit()`, `bnode()`, `quad()`, `graph()`
   - Type checking: `isNamedNode()`, `isLiteral()`, `isBlankNode()`, etc.
   - Automatic relative IRI resolution

6. **`useTurtle()`** - `src/composables/use-turtle.mjs`
   - File system operations for Turtle files
   - Methods: `load()`, `loadAll()`, `save()`, `saveDefault()`, `loadDefault()`
   - Directory management: `listFiles()`, `stats()`, `clear()`
   - Parsing: `parse()`, `serialize()`
   - Automatic validation on load

7. **`useDelta()`** - `src/composables/use-delta.mjs`
   - Graph diff and patch operations
   - Methods: `compareWith()`, `syncWith()`, `apply()`, `merge()`, `invert()`
   - Patch creation: `createPatch()`, `applyPatch()`
   - Statistics: `getStats()`, `isEmpty()`
   - Deterministic sorting support

8. **`usePrefixes()`** - `src/composables/use-prefixes.mjs`
   - Prefix registry management
   - Methods: `register()`, `expand()`, `shrink()`, `list()`, `clear()`
   - Supports Map, Array, or Object input formats

**Benefits of Using Composables:**
- **Context Management**: Automatic store context handling
- **Error Handling**: Built-in validation and error messages
- **Consistency**: Opinionated APIs enforce best practices
- **Convenience**: High-level methods for common operations
- **Type Safety**: Input validation and type checking

**Recommendation**: Consider using composables for:
- **Template Context**: Use `useGraph()` to provide a rich `$rdf` object in templates
- **Reasoning**: Use `useReasoner()` for rule-based inference in frontmatter
- **Validation**: Use `useValidator()` for SHACL validation
- **File Operations**: Use `useTurtle()` for loading/saving RDF files from frontmatter
- **Term Creation**: Use `useTerms()` for creating RDF terms in templates

**Note**: Composables require a store context to be initialized. For frontmatter engine integration, you may need to:
1. Create a temporary store context for each template processing operation
2. Or adapt composables to work without context (use underlying engine functions directly)

**Alternative Approach**: Use the underlying engine functions directly (from `knowledge-engine/`) if context management is not needed, as they are more lightweight and don't require context setup.

## Recommended Integration Architecture

### Phase 1: Core RDF Data Loading

**Components to Use:**
1. `unrdf/src/knowledge-engine/parse.mjs`:
   - `parseTurtle()` - Load Turtle files
   - `parseJsonLd()` - Load JSON-LD files
   - `toTurtle()` - Serialize for debugging

**Integration:**
- Extend `FrontmatterParser.getRDFConfig()` to return parsed Store
- Add RDF data loading in `FrontmatterWorkflowEngine.processTemplate()`
- Store parsed RDF in template context

### Phase 2: SPARQL Query Support

**Components to Use:**
1. `unrdf/src/knowledge-engine/query.mjs`:
   - `query(store, sparql, options)` - Execute SPARQL queries

**Integration:**
- Add `rdfQuery` or `sparql` field support in frontmatter
- Execute queries after RDF data loading
- Inject query results into template context

### Phase 3: Reasoning Support

**Components to Use:**
1. `unrdf/src/knowledge-engine/reason.mjs`:
   - `reason(store, rules, options)` - Apply N3 rules

**Integration:**
- Add `rdfRules` field support in frontmatter
- Apply reasoning after data loading
- Use reasoned Store for queries and template context

### Phase 4: Validation Support

**Components to Use:**
1. `unrdf/src/knowledge-engine/validate.mjs`:
   - `validateShacl(store, shapes, options)` - SHACL validation

**Integration:**
- Add `rdfValidate` and `shaclShapes` field support
- Validate RDF data before template processing
- Report validation errors/warnings

## Implementation Recommendations

### 1. Create RDF Integration Module

**New File**: `src/kgen/core/frontmatter/rdf-integration.js`

```javascript
import { parseTurtle, parseJsonLd, query, reason, validateShacl } from '~/unrdf/src/knowledge-engine/index.mjs';
import { Store } from 'n3';

export class FrontmatterRDFIntegration {
  async loadRDFData(config, context) {
    // Use unrdf parseTurtle/parseJsonLd
  }
  
  async executeQuery(store, sparql, options) {
    // Use unrdf query()
  }
  
  async applyReasoning(store, rules, options) {
    // Use unrdf reason()
  }
  
  async validateData(store, shapes, options) {
    // Use unrdf validateShacl()
  }
}
```

### 2. Extend Frontmatter Parser

**File**: `src/kgen/core/frontmatter/parser.js`

- Enhance `getRDFConfig()` to return structured RDF configuration
- Add validation for RDF configuration fields
- Support multiple RDF data sources

### 3. Extend Workflow Engine

**File**: `src/kgen/core/frontmatter/workflow-engine.js`

- Add RDF processing step in `processTemplate()`
- Integrate RDF data into template context
- Support RDF-based conditional processing

### 4. Template Context Enhancement

**File**: `packages/kgen-core/src/templating/context.js`

- Enhance `integrateRDFData()` to use unrdf components
- Add `$rdf` object to template context with:
  - `store` - N3 Store instance
  - `query(sparql)` - SPARQL query function
  - `subjects`, `predicates`, `objects` - Term access
  - `prefixes` - Namespace mappings

## Dependencies to Add

Based on unrdf's package.json, add these dependencies:

```json
{
  "dependencies": {
    "@comunica/query-sparql": "^3.0.0",
    "eyereasoner": "^1.0.0",
    "jsonld": "^8.2.0",
    "rdf-ext": "^2.0.0",
    "rdf-validate-shacl": "^0.6.5"
  }
}
```

**Note**: `n3@^1.26.0` is already in package.json.

## Performance Considerations

### Query Engine Caching
- unrdf uses singleton QueryEngine pattern
- Eliminates 100-500ms initialization overhead per query
- **Recommendation**: Import and use unrdf's `getQueryEngine()` from `query-cache.mjs`

### OpenTelemetry Tracing
- All unrdf functions include OpenTelemetry spans
- Provides observability for RDF operations
- **Recommendation**: Keep tracing enabled for production debugging

## Security Considerations

### Sandboxing
- unrdf has `EffectSandbox` for secure hook execution
- **Recommendation**: Consider sandboxing for user-provided SPARQL queries in frontmatter

### Input Validation
- Validate SPARQL queries before execution
- Validate RDF data sources (file paths, URIs)
- **Recommendation**: Add validation layer before RDF processing

## Testing Strategy

### Unit Tests
- Test RDF data loading from various sources
- Test SPARQL query execution
- Test reasoning with sample rules
- Test SHACL validation

### Integration Tests
- Test frontmatter with RDF configuration
- Test template rendering with RDF data
- Test error handling for invalid RDF

## Migration Path

1. **Phase 1** (Week 1-2): Add RDF data loading using unrdf's parse functions
2. **Phase 2** (Week 3-4): Add SPARQL query support using unrdf's query function
3. **Phase 3** (Week 5-6): Add reasoning support using unrdf's reason function
4. **Phase 4** (Week 7-8): Add SHACL validation support using unrdf's validate function

## Summary

### Key Components to Use from unrdf:

**Core Engine Functions** (Recommended for direct integration):
1. **Parsing**: `parseTurtle()`, `parseJsonLd()` from `knowledge-engine/parse.mjs`
2. **Querying**: `query()` from `knowledge-engine/query.mjs` (with cached QueryEngine)
3. **Reasoning**: `reason()` from `knowledge-engine/reason.mjs` (using eyereasoner)
4. **Validation**: `validateShacl()` from `knowledge-engine/validate.mjs` (using rdf-ext)
5. **Utilities**: Term and quad utilities from `utils/term-utils.mjs` and `utils/quad-utils.mjs`

**Composables** (Optional - for higher-level APIs):
6. **Graph Operations**: `useGraph()` from `composables/use-graph.mjs` - SPARQL queries, graph operations
7. **Reasoning**: `useReasoner()` from `composables/use-reasoner.mjs` - High-level inference interface
8. **Validation**: `useValidator()` from `composables/use-validator.mjs` - SHACL validation wrapper
9. **Canonicalization**: `useCanon()` from `composables/use-canon.mjs` - Isomorphism and canonicalization
10. **File I/O**: `useTurtle()` from `composables/use-turtle.mjs` - Turtle file operations
11. **Change Tracking**: `useDelta()` from `composables/use-delta.mjs` - Graph diff and patch
12. **Term Creation**: `useTerms()` from `composables/use-terms.mjs` - RDF term creation utilities
13. **Prefix Management**: `usePrefixes()` from `composables/use-prefixes.mjs` - Prefix registry

### Benefits:
- Production-ready, tested components
- Performance optimizations (QueryEngine caching)
- Built-in observability (OpenTelemetry)
- Consistent API across RDF operations
- Comprehensive error handling

### Next Steps:
1. Review and approve this integration plan
2. Add required dependencies to package.json
3. Create RDF integration module
4. Extend frontmatter parser and workflow engine
5. Add comprehensive tests
6. Update documentation

