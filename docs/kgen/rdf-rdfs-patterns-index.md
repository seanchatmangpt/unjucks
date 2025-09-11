# RDF & RDFS Usage Patterns Index

## Overview

This document provides a comprehensive index of RDF and RDFS usage patterns found in the Unjucks codebase, covering vocabulary definitions, graph manipulation, serialization formats, and implementation patterns.

## 1. RDF Core Vocabulary Usage

### 1.1 RDF Type Declarations (`rdf:type`)

The most heavily used RDF pattern across the codebase for type assertions:

**Primary Usage Locations:**
- Template schemas: `_templates/enterprise/data/schemas/`
- API governance: `src/semantic/schemas/api-governance.ttl`
- Ontology definitions: `src/semantic/ontologies/`
- Test fixtures: `tests/fixtures/turtle/`

**Common Patterns:**
```turtle
# Class type declarations
:Customer rdf:type rdfs:Class ;
:APIEndpoint rdf:type owl:Class ;

# Instance declarations
ex:alice rdf:type foaf:Person ;
api:UserService rdf:type api:RestApi ;

# Template queries
?s rdf:type foaf:Person
?person rdf:type schema:Person
```

**Special Handling:**
- SPARQL shorthand: `rdf:type` → `a` conversion
- Query patterns: `?entity rdf:type ?class`
- Filter implementations for type-based queries

### 1.2 RDF Collections and Lists

**List Structure Patterns:**
```turtle
# RDF List construction
bibo:authorList/rdf:rest*/rdf:first ?author

# Empty list handling
rdf:nil
```

**Filter Implementation:**
- `rdfList()` filter converts arrays to RDF list syntax
- Empty arrays → `rdf:nil`

### 1.3 RDF Containers and Collections

Limited usage found, primarily in:
- Sequence numbering: `rdf:_1`, `rdf:_2`, etc.
- Collection aggregation patterns

## 2. RDFS Schema Vocabulary

### 2.1 Class Hierarchy (`rdfs:Class`, `rdfs:subClassOf`)

**Core Schema Files:**
- `/src/semantic/schemas/api-governance.ttl`: 81 usages
- `/src/semantic/schemas/gdpr-compliance.ttl`: 97 usages
- User ontology: `/schema/user.ttl`

**Hierarchy Patterns:**
```turtle
api:RestApi a owl:Class ;
    rdfs:subClassOf api:ApiEndpoint ;
    rdfs:label "REST API"@en .

api:PublicApi a owl:Class ;
    rdfs:subClassOf api:ApiEndpoint ;
    rdfs:label "Public API"@en .
```

### 2.2 Property Definitions (`rdfs:domain`, `rdfs:range`)

**Domain/Range Specifications:**
```turtle
:hasName a owl:DatatypeProperty ;
    rdfs:domain :User ;
    rdfs:range xsd:string ;
    rdfs:label "has name" .

api:generatesEndpoint a owl:DatatypeProperty ;
    rdfs:domain template:Template ;
    rdfs:range xsd:boolean .
```

### 2.3 Property Hierarchy (`rdfs:subPropertyOf`)

**Usage Context:**
- Property specialization in ontologies
- Inheritance patterns in validation schemas

### 2.4 Labels and Comments (`rdfs:label`, `rdfs:comment`)

**Annotation Patterns:**
```turtle
:User a owl:Class ;
    rdfs:label "User" ;
    rdfs:comment "A user of the system." .

governance:ApiGovernance a owl:Class ;
    rdfs:label "API Governance Framework"@en ;
    rdfs:comment "Enterprise API governance and management standards"@en .
```

## 3. RDF Graph Manipulation

### 3.1 Triple Patterns

**Core Triple Structure:**
- **Subject-Predicate-Object** patterns throughout templates
- **Variable binding** in SPARQL-like queries: `?s ?p ?o`
- **Pattern matching** for template generation

**Implementation Files:**
- `/src/commands/knowledge.js`: Triple parsing and manipulation (1,500+ lines)
- `/src/lib/turtle-parser.js`: N3.js integration for triple processing

### 3.2 Quad Support (Named Graphs)

**Named Graph Patterns:**
```turtle
# Named graph declarations (limited usage)
GRAPH <http://example.org/graphs/user-profiles> {
    ex:user1 foaf:name "John Doe" .
}

GRAPH <http://example.org/graphs/company-data> {
    ex:company1 rdfs:label "Example Corp" .
}
```

**Implementation:**
- SQL schema: `graph VARCHAR(255) DEFAULT 'default'`
- Index support: `idx_triples_graph`
- Template examples in `examples/output-semantic-web-demo.ttl`

### 3.3 Triple Store Operations

**Core Operations:**
- **Addition**: `addTriple(triple)` methods
- **Querying**: SPARQL-like pattern matching
- **Filtering**: Subject/predicate/object filters
- **Counting**: Triple statistics and metrics

## 4. RDF Serialization Formats

### 4.1 Turtle (`.ttl`)

**Primary Format** - 53 `.ttl` files found:

**Key Files:**
- Enterprise schemas: `_templates/enterprise/data/schemas/*.ttl`
- API governance: `src/semantic/schemas/api-governance.ttl`
- Test fixtures: `tests/fixtures/turtle/*.ttl`
- Examples: `examples/**/*.ttl`

### 4.2 N-Triples

**Parser Support:**
- N-Triples parsing: `parseNTriples(content)`
- Export functionality: `exportAsNTriples(triples)`

### 4.3 JSON-LD

**Integration Points:**
- JSON-LD context generation
- Template output format option
- Structured data embedding

**Patterns:**
```javascript
// JSON-LD structured data
{
  "@context": "https://schema.org",
  "@type": "Person",
  "name": "John Doe"
}
```

### 4.4 RDF/XML

**Limited Usage:**
- Export support: `exportAsRDFXML()`
- Legacy format compatibility
- Template output option

## 5. Vocabulary Definitions and Schemas

### 5.1 Standard Vocabularies

**Heavily Used Vocabularies:**
- **FOAF** (`foaf:`): Person/Agent descriptions - 30+ usages
- **Dublin Core** (`dc:`, `dcterms:`): Metadata annotations
- **Schema.org** (`schema:`): Structured data patterns
- **OWL** (`owl:`): Ontology definitions
- **SKOS** (`skos:`): Knowledge organization

**Enterprise Vocabularies:**
- **API Governance**: Custom API management vocabulary
- **GDPR Compliance**: Privacy regulation compliance
- **SOX Compliance**: Financial regulation compliance

### 5.2 Custom Ontologies

**Domain-Specific Ontologies:**
```turtle
# Enterprise template ontology
template:Template a owl:Class ;
    rdfs:label "Template" .

# API governance ontology  
api:ApiEndpoint a owl:Class ;
    rdfs:label "API Endpoint" .

# Compliance ontologies
gdpr:PersonalData a owl:Class ;
    rdfs:label "Personal Data" .
```

## 6. SHACL Validation Integration

### 6.1 SHACL Constraints

**Validation Patterns:**
```turtle
:UserShape a sh:NodeShape ;
    sh:targetClass :User ;
    sh:property [
        sh:path :hasName ;
        sh:datatype xsd:string ;
        sh:minCount 1 ;
        sh:message "Name is required"
    ] .
```

**Integration Points:**
- Template validation rules
- Data quality constraints
- Enterprise compliance validation

### 6.2 Constraint Types

- **Cardinality**: `sh:minCount`, `sh:maxCount`
- **Datatype**: `sh:datatype`
- **Pattern**: `sh:pattern` for regex validation
- **Value constraints**: `sh:in` for enumerated values

## 7. RDF Dataset and Named Graph Handling

### 7.1 Dataset Metadata

**VoID (Vocabulary of Interlinked Datasets):**
```turtle
<http://example.org/dataset> a void:Dataset ;
    void:triples 1000 ;
    void:subjects 200 ;
    void:properties 50 .
```

**DCAT Integration:**
```turtle
<http://example.org/catalog> a dcat:Dataset ;
    dcat:title "Knowledge Graph Dataset" ;
    dcat:description "Generated semantic data" .
```

### 7.2 Named Graph Management

**Limited Implementation:**
- Graph isolation patterns
- Access control by graph
- Multi-tenant data separation

## 8. RDF Reification Patterns

### 8.1 Statement Reification

**Found Patterns:**
```turtle
# RDF reification for metadata about triples
_:stmt1 a rdf:Statement ;
    rdf:subject ex:person1 ;
    rdf:predicate foaf:knows ;
    rdf:object ex:person2 ;
    kg:confidence "0.95"^^xsd:decimal .
```

**Usage Context:**
- Knowledge graph confidence scores
- Provenance tracking
- Temporal annotations

### 8.2 N-ary Relations

**Implementation:**
- Qualified relations using blank nodes
- Complex relationship modeling
- Metadata attachment to relationships

## 9. Template Integration Patterns

### 9.1 RDF Filter Functions

**Key Filters:**
- `rdfQuery(pattern)`: SPARQL-like queries
- `rdfSubject(predicate, object)`: Subject lookup
- `rdfObject(subject, predicate)`: Object retrieval
- `rdfType(resource)`: Type extraction
- `rdfGraph(name)`: Named graph filtering

### 9.2 Template Queries

**Common Query Patterns:**
```nunjucks
{# Query all persons #}
{% for person in rdf.query("?s rdf:type foaf:Person") %}
    <h3>{{ person.name }}</h3>
{% endfor %}

{# Type-based filtering #}
{% set services = rdf.query("?s rdf:type service:Service") %}

{# Property-based queries #}
{{ person | rdfProperty("foaf:name") | first }}
```

## 10. Performance and Scale Patterns

### 10.1 Performance Thresholds

**Scale Limits:**
- Maximum triples: 10,000,000 (production)
- Maximum subjects: 25,000
- Maximum predicates: 1,000
- Index optimization for `rdf:type` queries

### 10.2 Optimization Patterns

**Query Optimization:**
- Special indexing for `rdf:type`
- Cached pattern matching
- Bulk operation support

## 11. Compliance and Governance Integration

### 11.1 GDPR Patterns

**Privacy-Aware RDF:**
```turtle
personal:EmailAddress rdf:type gdpr:PersonalData ;
    gdpr:hasLegalBasis gdpr:Consent .

personal:HealthData rdf:type gdpr:SpecialCategoryData ;
    gdpr:requiresExplicitConsent true .
```

### 11.2 Enterprise Governance

**API Governance Patterns:**
```turtle
api:UserAPI rdf:type api:PublicApi ;
    api:requiresAuthentication true ;
    api:hasSecurityMechanism security:OAuth2 .
```

## 12. Error Handling and Validation

### 12.1 Parse Error Patterns

**Common Issues:**
- Invalid IRI characters
- Malformed literal syntax
- Namespace resolution failures

### 12.2 Validation Rules

**Consistency Checks:**
- Type hierarchy validation
- Property domain/range checking
- Compliance rule validation

## 13. Industry-Specific Applications

### 13.1 Fortune 500 Integration

**Walmart Supply Chain:**
```turtle
walmart:Product rdf:type supply:Item ;
    supply:hasSupplier walmart:Supplier001 .
```

**Healthcare (CVS):**
```turtle
cvs:Prescription rdf:type drug:Medication ;
    drug:hasInteraction cvs:DrugInteraction001 .
```

**Financial Services (JPMorgan):**
```turtle
jpmorgan:TradingAccount rdf:type fibo-fnd:Account ;
    fibo-fnd:hasAccountHolder jpmorgan:Client001 .
```

## 14. Testing and Quality Assurance

### 14.1 Test Coverage

**RDF-Related Tests:**
- Turtle parsing validation
- SPARQL query generation
- Filter function testing
- Performance benchmarking

### 14.2 Quality Metrics

**Validation Coverage:**
- Syntax validation: 100+ test cases
- Semantic validation: SHACL integration
- Performance testing: Large dataset handling

## 15. Future Enhancements

### 15.1 Planned Features

- Enhanced named graph support
- Advanced SPARQL query capabilities
- Improved reification patterns
- Extended vocabulary integration

### 15.2 Performance Improvements

- Query optimization
- Caching strategies
- Streaming operations
- Memory efficiency

## File Index

**Core Implementation Files:**
- `/src/lib/turtle-parser.js` - N3.js integration and parsing
- `/src/commands/knowledge.js` - Graph manipulation and querying
- `/src/lib/filters/rdf-filters.js` - Template filter functions

**Schema Files:**
- `/src/semantic/schemas/api-governance.ttl` - API governance vocabulary
- `/src/semantic/schemas/gdpr-compliance.ttl` - GDPR compliance vocabulary  
- `/schema/user.ttl` - Basic user ontology

**Template Examples:**
- `/examples/output-semantic-web-demo.ttl` - Comprehensive RDF example
- `/_templates/semantic/` - Semantic web template generators
- `/tests/fixtures/turtle/` - Test ontologies and data

This index provides a comprehensive overview of RDF and RDFS patterns implemented in the Unjucks codebase, serving as a reference for developers working with semantic web features and template generation.