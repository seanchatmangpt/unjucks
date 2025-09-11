# Turtle (TTL) File Processing and RDF Serialization Index

## Overview

This document provides a comprehensive index of all Turtle (TTL) file processing and RDF serialization capabilities within the Unjucks codebase. The system implements a robust semantic web stack with N3.js as the core RDF processing engine.

---

## 🐢 Core Turtle Processing Components

### Primary Turtle Parser

**Location**: `/src/lib/turtle-parser.js`

**Key Features**:
- Full Turtle parsing with N3.js backend
- Synchronous and asynchronous parsing APIs
- Comprehensive error handling with line/column information
- Performance statistics tracking
- Support for multiple RDF formats: `text/turtle`, `application/n-triples`, `application/n-quads`, `text/n3`

**Main Classes**:
- `TurtleParser` - Main parsing class
- `TurtleParseError` - Custom error type with location info
- `TurtleUtils` - Utility functions for RDF data manipulation

**API Examples**:
```javascript
// Basic parsing
const parser = new TurtleParser();
const result = await parser.parse(turtleContent);

// Convenience functions
const result = await parseTurtle(content, options);
const result = parseTurtleSync(content, options);
```

### RDF Data Loader

**Location**: `/src/lib/rdf-data-loader.js`

**Features**:
- Multi-source RDF data loading (file, inline, URI)
- Intelligent caching with TTL and size limits
- HTTP/HTTPS fetching with retry logic and timeout
- Template context creation for Nunjucks integration
- BDD test compatibility interface

**Cache Features**:
- TTL-based expiration (default: 5 minutes)
- Size-based eviction (default: 100 entries)
- Background cleanup timer
- Cache statistics and monitoring

**Source Types**:
```javascript
// File source
{ type: 'file', path: '/path/to/file.ttl' }

// Inline content
{ type: 'inline', content: '@prefix ex: <...>' }

// HTTP/HTTPS URI
{ type: 'uri', uri: 'https://example.org/data.ttl' }
```

### RDF Filters for Templates

**Location**: `/src/lib/rdf-filters.js`

**Comprehensive Filter Set**:
1. `rdfSubject(predicate, object)` - Find subjects with given predicate-object
2. `rdfObject(subject, predicate)` - Get objects for subject-predicate pair  
3. `rdfPredicate(subject, object)` - Find predicates connecting subject-object
4. `rdfQuery(pattern)` - SPARQL-like pattern matching
5. `rdfLabel(resource)` - Get best available label (rdfs:label, skos:prefLabel, etc.)
6. `rdfType(resource)` - Get rdf:type values
7. `rdfNamespace(prefix)` - Resolve namespace prefixes
8. `rdfGraph(name)` - Filter by named graph
9. `rdfExpand(prefixed)` - Expand prefixed URI to full URI
10. `rdfCompact(uri)` - Compact full URI to prefixed form
11. `rdfCount(subject?, predicate?, object?)` - Count matching triples
12. `rdfExists(subject, predicate?, object?)` - Check triple existence

**Built-in Prefixes**:
```javascript
{
  rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
  rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
  owl: 'http://www.w3.org/2002/07/owl#',
  xsd: 'http://www.w3.org/2001/XMLSchema#',
  foaf: 'http://xmlns.com/foaf/0.1/',
  skos: 'http://www.w3.org/2004/02/skos/core#',
  dcterms: 'http://purl.org/dc/terms/',
  schema: 'http://schema.org/'
}
```

---

## 🏗️ High-Level Semantic Processing

### Ontology Template Engine

**Location**: `/src/core/ontology-template-engine.js`

**Features**:
- RDF/Turtle ontology integration with Nunjucks templates
- SPARQL-like querying capabilities
- Subject-based data extraction for template variables
- Custom Nunjucks filters for ontology data
- Batch generation from ontology patterns

**Key Methods**:
- `loadOntology(ttlFilePath)` - Load single ontology
- `loadOntologies(ttlFilePaths)` - Load multiple ontologies
- `extractTemplateData(subjectUri)` - Extract structured data for templates
- `generate(options)` - Generate from ontology and template
- `generateBatch(options)` - Batch generation with pattern matching

### Semantic Command Interface

**Location**: `/src/commands/semantic.js`

**Command Structure**:
```bash
unjucks semantic generate --input ontology.ttl --output ./generated
unjucks semantic validate --schema schema.ttl
unjucks semantic query --sparql "SELECT ?s ?p ?o WHERE { ?s ?p ?o }"
unjucks semantic export --format jsonld --output model.jsonld
```

**Generation Types**:
- `ontology` - Generate ontology from template
- `knowledge-graph` - Generate knowledge graph structures  
- `linked-data-api` - Generate Linked Data API servers

---

## 📁 TTL File Inventory

### Test Fixtures and Examples (52+ files)

**Core Test Data**:
- `/tests/fixtures/turtle/basic-person.ttl` - FOAF person data
- `/tests/fixtures/turtle/complex-project.ttl` - Complex RDF structures
- `/tests/fixtures/turtle/enterprise-schema.ttl` - Enterprise ontology
- `/tests/fixtures/turtle/sample-ontology.ttl` - Sample vocabulary

**Performance Test Data**:
- `/tests/fixtures/turtle/performance/small-100.ttl` - 100 triples
- `/tests/fixtures/turtle/performance/medium-1000.ttl` - 1K triples  
- `/tests/fixtures/turtle/performance/large-10000.ttl` - 10K triples
- `/tests/fixtures/performance/massive-enterprise-graph.ttl` - Large dataset

**Security Test Data**:
- `/tests/security/fixtures/malicious-patterns.ttl` - Attack vector testing
- `/tests/fixtures/turtle/invalid-syntax.ttl` - Malformed data testing

**Domain-Specific Examples**:
- `/tests/fixtures/semantic/financial/fibo-instruments.ttl` - Financial ontology
- `/tests/fixtures/semantic/healthcare/fhir-patient-data.ttl` - Healthcare data
- `/tests/fixtures/semantic/supply-chain/gs1-product-catalog.ttl` - Supply chain

**Enterprise Templates**:
- `/_templates/enterprise/data/schemas/compliance-requirements.ttl`
- `/_templates/enterprise/data/schemas/api-standards.ttl`
- `/src/semantic/schemas/gdpr-compliance.ttl`
- `/src/semantic/schemas/sox-compliance.ttl`

### Generated Examples and Demos
- `/person.ttl` - Generated person data
- `/job.ttl` - Job/position data
- `/examples/output-semantic-web-demo.ttl` - Demo output
- `/examples/generated/reverse-generated.ttl` - Reverse engineering output

---

## 🔄 RDF Serialization and Conversion

### Triple/Quad Processing

**Core Data Structures**:
```typescript
interface RDFTerm {
  type: 'uri' | 'literal' | 'blank';
  value: string;
  datatype?: string;
  language?: string;
}

interface ParsedTriple {
  subject: RDFTerm;
  predicate: RDFTerm;
  object: RDFTerm;
}
```

**N3.js Integration**:
- `Store` - In-memory triple store
- `Parser` - RDF parsing (Turtle, N-Triples, N3, etc.)
- `DataFactory` - Term creation utilities
- `Quad` - RDF quad representation

### JSON-LD Conversion

**Location**: `/tests/integration/json-ld/json-ld-context-generation.test.js`

**Features**:
- Turtle to JSON-LD context generation
- JSON-LD document validation
- Context compaction and expansion
- Template-driven JSON-LD generation

**Mock JSON-LD Processor** (for testing):
```javascript
class MockJsonLdProcessor {
  static async compact(document, context);
  static async expand(document);
  static validateContext(context);
}
```

---

## 🗄️ Triple Stores and Graph Databases

### In-Memory Store (N3.Store)

**Primary Usage**:
- Fast querying with quad patterns
- SPARQL-like filtering capabilities
- Template-time data access
- Cache-backed persistence

**Query Patterns**:
```javascript
// Pattern matching
store.getQuads(subject?, predicate?, object?, graph?);

// Count matching
store.countQuads(subject?, predicate?, object?, graph?);

// Iteration
store.forEach(callback, subject?, predicate?, object?, graph?);
```

### External Store Integration

**SPARQL Endpoints**:
- HTTP/HTTPS SPARQL endpoint querying
- Content negotiation for multiple RDF formats
- Pagination support for large result sets
- Rate limiting and error handling

**Configuration Example**:
```javascript
{
  sparqlEndpoint: 'http://localhost:7200/repositories/museum',
  maxResults: 1000,
  pageSize: 50,
  rateLimitWindow: 900000,
  rateLimitMax: 100
}
```

---

## 🌐 Namespace and Prefix Management

### Default Prefix Registry

**Standard Prefixes**:
```turtle
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix skos: <http://www.w3.org/2004/02/skos/core#> .
@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix schema: <http://schema.org/> .
```

**Domain-Specific Prefixes**:
```turtle
@prefix person: <http://unjucks.dev/person/> .
@prefix skill: <http://unjucks.dev/skill/> .
@prefix enterprise: <http://enterprise.com/> .
@prefix compliance: <http://enterprise.com/compliance#> .
```

### Prefix Resolution

**URI Expansion**:
- Automatic prefix expansion in queries
- Template-time URI resolution
- Configurable namespace mappings

**Utility Functions**:
- `TurtleUtils.expandPrefix(prefixed, prefixes)`
- `TurtleUtils.compactUri(fullUri, prefixes)`
- `rdfExpand(prefixed)` filter
- `rdfCompact(uri)` filter

---

## 🔍 Blank Node and IRI Processing

### Blank Node Handling

**Formats Supported**:
- Standard blank node syntax: `_:nodeId`
- Anonymous blank nodes: `[]`
- Blank node collections and lists

**Processing Features**:
- Automatic blank node ID generation
- Blank node scoping and isolation
- Template access to blank node properties

**Example**:
```turtle
ex:person1 foaf:address [
  schema:streetAddress "123 Main St" ;
  schema:addressLocality "Anytown" ;
  schema:postalCode "12345"
] .
```

### IRI Validation and Processing

**IRI Support**:
- Full HTTP/HTTPS IRI validation
- URN format support
- Unicode IRI handling
- Relative IRI resolution

**Validation Function**:
```javascript
TurtleUtils.isValidUri(uri) // Boolean validation
```

**IRI Types Handled**:
- Absolute HTTP/HTTPS URIs
- URN identifiers (uuid, isbn, etc.)
- Fragment identifiers (#)
- Query parameters (?)

---

## 🛠️ Data Type Conversion and Validation

### XSD Data Type Support

**Supported Types**:
- `xsd:integer`, `xsd:int`, `xsd:long`, `xsd:short`
- `xsd:decimal`, `xsd:double`, `xsd:float`
- `xsd:boolean`
- `xsd:date`, `xsd:dateTime`, `xsd:time`
- `xsd:string` (default)

**Conversion Function**:
```javascript
TurtleUtils.convertLiteralValue(term);
// Returns: number | boolean | Date | string
```

### Language Tags

**Support Features**:
- RFC 5646 language tag parsing
- Multi-language literal handling
- Template access to language-specific values

**Example**:
```turtle
ex:resource rdfs:label "Hello"@en, "Hola"@es, "Bonjour"@fr .
```

---

## 📊 Performance and Statistics

### Parse Performance Tracking

**Metrics Collected**:
- `tripleCount` - Number of parsed triples
- `prefixCount` - Number of namespace prefixes
- `subjectCount` - Number of unique subjects
- `predicateCount` - Number of unique predicates  
- `parseTime` - Parsing duration in milliseconds

### Memory Usage Optimization

**Features**:
- Streaming triple processing
- Memory-efficient caching
- Large file handling (tested up to 10K+ triples)
- Garbage collection friendly

**Performance Targets**:
- 1000 triples parsed in <1 second
- Memory usage scales linearly with dataset size
- Cache hit rates >80% for repeated queries

---

## 🔒 Security and Validation

### Security Testing

**Attack Vector Coverage**:
- XSS injection via JavaScript URIs
- Path traversal attempts
- Oversized content handling
- Template injection prevention
- File system access blocking

**Test Files**:
- `/tests/security/fixtures/malicious-patterns.ttl`
- `/tests/fixtures/turtle/malicious.ttl`

### Input Validation

**Validation Layers**:
1. Syntax validation (N3.js parser)
2. URI format validation
3. Data type validation
4. Security pattern detection
5. Resource limit enforcement

**Error Handling**:
```javascript
try {
  const result = await parser.parse(content);
} catch (error) {
  console.log(error.line, error.column, error.message);
}
```

---

## 🧪 Testing Coverage

### Unit Tests

**Primary Test Files**:
- `/tests/unit/turtle-parser.comprehensive.test.js` (491 lines)
- `/tests/unit/rdf-filters.test.js` (128 lines)
- `/tests/unit/rdf-data-loader.test.js`

**Test Categories**:
- Basic parsing functionality
- Error handling and edge cases
- Performance and statistics
- Unicode and internationalization
- Security and malformed input

### Integration Tests

**Semantic Web Integration**:
- `/tests/semantic-integration.test.js`
- `/tests/semantic-web-filters.test.js`
- `/tests/linked-data-validation.test.js`

**Template Integration**:
- `/tests/integration/rdf-validation-final.test.js`
- `/tests/integration/semantic-scenarios.test.js`

### BDD Feature Tests

**Feature Coverage**:
- `/tests/features/turtle-data-support.feature.spec.js`
- `/tests/features/semantic/*.feature.spec.js`
- Financial FIBO compliance
- Healthcare FHIR integration
- Supply chain GS1 tracking

---

## 📈 Advanced Features

### Inference and Reasoning

**N3 Rules Support**:
```n3
@prefix person: <http://unjucks.dev/person/> .

# Rule: Senior level inference
{
  ?person person:yearsOfExperience ?years .
  ?years math:greaterThan 5 .
} => {
  ?person person:seniorityLevel "Senior" .
} .
```

### SHACL Validation

**Validation Shapes**:
- Constraint validation
- Cardinality checking  
- Data type enforcement
- Custom validation functions

**Integration Files**:
- `/tests/fixtures/knowledge-graphs/schemas/kg-validation.shacl.ttl`
- `/tests/fixtures/turtle/shacl-validation.ttl`

### Semantic Reasoners

**Reasoning Capabilities**:
- Class hierarchy inference
- Property chain reasoning
- Inverse property resolution
- Transitive property handling

---

## 🔗 API and Integration Points

### Template Filters API

**Registration**:
```javascript
import { registerRDFFilters } from './lib/rdf-filters.js';

const env = nunjucks.configure();
registerRDFFilters(env, { store: myStore });
```

**Usage in Templates**:
```nunjucks
{% for person in rdfSubject('rdf:type', 'foaf:Person') %}
  Name: {{ person | rdfLabel }}
  Email: {{ rdfObject(person, 'foaf:mbox')[0].value }}
{% endfor %}
```

### CLI Integration

**Commands Available**:
```bash
# Generate from ontology
unjucks semantic generate ontology library-management --withInferences

# Validate schema
unjucks semantic validate --schema user.ttl

# Execute SPARQL
unjucks semantic query --sparql "SELECT * WHERE {?s ?p ?o} LIMIT 10"

# Export to JSON-LD  
unjucks semantic export --format jsonld --output data.jsonld
```

### MCP (Model Context Protocol) Integration

**Coordination Features**:
- Swarm-based RDF processing
- Distributed template generation
- Multi-agent semantic workflows
- Cross-system RDF data sharing

---

## 🎯 Usage Examples

### Basic Turtle Processing

```javascript
import { TurtleParser } from './src/lib/turtle-parser.js';

const parser = new TurtleParser();
const result = await parser.parse(`
  @prefix foaf: <http://xmlns.com/foaf/0.1/> .
  @prefix ex: <http://example.org/> .
  
  ex:john a foaf:Person ;
    foaf:name "John Doe" ;
    foaf:age 30 .
`);

console.log(`Parsed ${result.stats.tripleCount} triples`);
console.log(`Found ${result.stats.subjectCount} subjects`);
```

### Template Generation with RDF Data

```javascript
import { RDFDataLoader } from './src/lib/rdf-data-loader.js';
import { TemplateEngine } from './src/lib/template-engine.js';

const loader = new RDFDataLoader();
const data = await loader.loadFromSource({
  type: 'file',
  path: './person.ttl'
});

const engine = new TemplateEngine();
const result = await engine.render('person-template.njk', {
  rdf: data,
  people: data.rdfSubject('rdf:type', 'foaf:Person')
});
```

### Advanced RDF Querying

```javascript
import { createRDFFilters } from './src/lib/rdf-filters.js';

const filters = createRDFFilters({ store: myStore });

// Find all developers
const developers = filters.rdfSubject('schema:jobTitle', 'Developer');

// Get skills for a person
const skills = filters.rdfObject('ex:person1', 'person:hasSkill');

// Count total people
const peopleCount = filters.rdfCount(null, 'rdf:type', 'foaf:Person');
```

---

## 📋 Summary Statistics

- **TTL Files**: 52+ files across test fixtures, templates, and examples
- **Core Components**: 5 main processing classes
- **RDF Filters**: 12 template filters for RDF data access
- **Test Coverage**: 15+ comprehensive test suites
- **Supported Formats**: Turtle, N-Triples, N-Quads, N3, JSON-LD
- **Performance**: 1000+ triples/second parsing
- **Security**: Comprehensive attack vector testing
- **Integration**: CLI, templates, MCP, SPARQL endpoints

This comprehensive RDF/Turtle processing system provides enterprise-grade semantic web capabilities with robust error handling, performance optimization, and extensive testing coverage.