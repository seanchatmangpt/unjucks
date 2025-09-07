# Semantic Web BDD Test Suite

A comprehensive Behavior-Driven Development (BDD) test suite for RDF/Turtle semantic web use cases, validating template filters in semantic web contexts including ontologies, SPARQL queries, linked data, and knowledge graphs.

## 📊 Test Suite Overview

- **Total Features**: 6 comprehensive BDD features  
- **Total Test Lines**: 2,000+ lines of Gherkin scenarios
- **Coverage**: All major semantic web use cases and template filters
- **Validation**: Real-world RDF/Turtle generation patterns

## 🎯 Feature Files

### 1. **ontology-generation.feature** (162 lines)
Tests class and property generation with template filters for OWL ontologies:
- Basic ontology class generation with PascalCase filtering
- Schema.org mapped classes and properties
- Complex ontology definitions with multiple filters
- OWL restrictions with filtered class names
- Multilingual ontology labels with locale filters
- Datatype restrictions and versioning metadata
- SHACL shapes with filtered constraints

### 2. **sparql-query-templates.feature** (239 lines)
Dynamic SPARQL query generation with filtered variables:
- Basic SELECT queries with camelCase filtered variables
- CONSTRUCT queries for data transformation
- Parameterized queries with filter chains
- Aggregation queries with grouped results
- Federated queries across multiple endpoints
- Temporal queries with date range filtering
- SPARQL UPDATE statements with property filters
- Complex property path queries
- Geospatial queries with coordinate filtering

### 3. **linked-data-resources.feature** (307 lines)
Resource URI generation with slug and case filters:
- Person resources with slug-based URIs
- Hierarchical organization URIs with kebabCase
- Publication resources with DOI-based URIs
- Versioned dataset resources with date filters
- SKOS concept schemes with hierarchical URIs
- Geo-referenced resources with coordinate-based URIs
- Multimedia resources with content-based URIs
- Content negotiation metadata generation

### 4. **namespace-management.feature** (243 lines)
Prefix and namespace handling with case transformation filters:
- Namespace prefix generation from organization names
- Consistent namespace declarations across documents
- Domain-specific namespace hierarchies
- Versioned namespace URIs with date filters
- OWL ontology imports with namespace filtering
- SPARQL prefix declarations with vocabulary categorization
- JSON-LD context with camelCase property filtering
- Namespace documentation with usage examples
- Cross-vocabulary alignment mappings

### 5. **knowledge-graph-construction.feature** (397 lines)
Complex RDF generation workflows for comprehensive knowledge graphs:
- Multi-entity academic knowledge graphs with relationship filters
- Temporal knowledge graphs with event sequencing
- Probabilistic knowledge graphs with confidence scoring
- Multi-modal data integration across content types
- Provenance tracking with PROV-O filtering
- Cross-domain knowledge graphs with ontology alignment

### 6. **advanced-semantic-filtering.feature** (336 lines)
Sophisticated template filters for complex RDF scenarios:
- Multi-language RDF literals with locale filtering
- XSD datatype detection and typed literal generation
- Faker integration for realistic semantic test data
- JSON-LD context-aware filtering
- SHACL shapes with validation constraint filtering
- OWL ontology complex restriction filtering
- RDF-star statements with meta-properties
- Web Annotation Data Model compliance for multimedia

### 7. **semantic-web-integration.feature** (318 lines)
End-to-end integration testing with real-world validation:
- Academic knowledge graph generation and validation
- Schema.org structured data for web publication
- FAIR data principles compliance testing
- Cross-platform semantic data validation
- Performance testing for large-scale generation
- Semantic search and discovery validation
- Real-time semantic data integration
- Semantic web API generation and testing

## 🔧 Key Template Filters Tested

### Case Transformation
- `pascalCase`: PersonProfile, ResearchProject
- `camelCase`: firstName, publicationDate, emailAddress
- `kebabCase`: mit-computer-science-lab, neural-architecture-search
- `snakeCase`: first_name, publication_date, email_address
- `titleCase`: "Research Publication", "Machine Learning"

### URI Generation
- `slug`: "Dr. John A. Smith-Wilson" → "dr-john-a-smith-wilson"
- URI path construction with hierarchical filtering
- DOI-based and coordinate-based URI schemes

### Data Type & Formatting
- `formatDate`: ISO 8601 date/time formatting for RDF literals
- `escape`: HTML/XML entity escaping for safe RDF generation
- `tojson`: JSON serialization for complex RDF values
- `round`: Precision control for numeric RDF literals

### Semantic-Specific
- Namespace prefix generation and standardization
- Vocabulary alignment and cross-references
- Multi-language literal generation with @lang tags
- XSD datatype detection and assignment
- Content-type based filtering for multimedia resources

## 🧪 Test Execution

### Prerequisites
```bash
npm install @cucumber/cucumber chai nunjucks
```

### Running Tests
```bash
# Run all semantic web features
npm run test:cucumber -- tests/features/semantic/

# Run specific feature
npm run test:cucumber -- tests/features/semantic/ontology-generation.feature

# Run with specific tags
npm run test:cucumber -- --tags "@ontology or @sparql"
```

### Step Definitions
Located in `tests/features/semantic/step_definitions/semantic_steps.js`:
- Complete Nunjucks environment with semantic filters
- Test context management for complex scenarios
- RDF validation and assertion helpers
- Template rendering and output verification

## 🎯 Real-World Test Scenarios

### Academic Domain Examples
- **Ontologies**: Person → schema:Person, ResearchProject classes
- **Properties**: firstName → schema:givenName, lastUpdated → dct:modified  
- **Resources**: "John Doe" → `<http://example.org/person/john-doe>`
- **SPARQL**: Dynamic WHERE clauses with filtered variable names
- **Knowledge Graphs**: Complex multi-entity academic networks

### Advanced RDF Patterns
- **Turtle Serialization**: Proper formatting with filtered identifiers
- **Schema.org Mappings**: Type conversions with semantic filters
- **Multi-language**: Locale-specific literal generation
- **Datatypes**: Faker integration with XSD datatype mapping
- **SPARQL CONSTRUCT**: Complex transformations with filter chains
- **OWL Restrictions**: Sophisticated logical constraint patterns
- **JSON-LD**: Context generation with filtered property mappings

## 🚀 Key Benefits

1. **Comprehensive Coverage**: Tests all major semantic web use cases
2. **Real-World Validation**: Scenarios based on actual semantic web applications
3. **Filter Integration**: Validates template filters in semantic contexts
4. **Standards Compliance**: Tests against W3C RDF, OWL, SPARQL standards
5. **Performance Testing**: Scalability validation for large knowledge graphs
6. **Integration Testing**: End-to-end workflows with multiple tools
7. **Quality Assurance**: Automated validation of generated RDF quality

This test suite ensures that your Unjucks template system can reliably generate high-quality, standards-compliant semantic web data across all major use cases and scales.