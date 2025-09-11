# Knowledge Graph Structures Documentation

## Overview

This document provides comprehensive documentation of all knowledge graph structures, schemas, and implementations found in the Unjucks codebase. The system implements a sophisticated knowledge graph infrastructure supporting RDF/OWL ontologies, SPARQL querying, SHACL validation, and enterprise-grade semantic web capabilities.

## Table of Contents

1. [Core Architecture](#core-architecture)
2. [Schema Definitions](#schema-definitions)
3. [Entity-Relationship Models](#entity-relationship-models)
4. [Graph Construction Pipelines](#graph-construction-pipelines)
5. [Query Languages and Interfaces](#query-languages-and-interfaces)
6. [Graph Analytics and Metrics](#graph-analytics-and-metrics)
7. [Visualization Components](#visualization-components)
8. [Deployment Infrastructure](#deployment-infrastructure)
9. [Template System Integration](#template-system-integration)
10. [Testing and Validation](#testing-and-validation)

## Core Architecture

### Knowledge Graph Command Interface

**Location**: `/src/commands/knowledge-graph.js`

The main CLI interface provides comprehensive knowledge graph operations:

- **Generate**: Creates RDF knowledge graphs from structured data
- **Validate**: SHACL constraint validation against schemas
- **Query**: SPARQL query execution with multiple output formats
- **Deploy**: Infrastructure deployment with Docker Compose
- **Convert**: Format conversion between RDF serializations

**Key Features**:
- Multiple RDF formats: Turtle, RDF/XML, JSON-LD, N-Triples
- SHACL validation with error reporting
- Performance monitoring and quality metrics
- Template-driven generation pipeline
- Enterprise deployment configurations

### Knowledge Graph Pipeline

**Location**: `/src/lib/knowledge-graph/kg-pipeline.js` (referenced)

Core processing pipeline supporting:
- Template-based entity extraction
- Relationship mapping and qualification
- Schema alignment and validation
- Quality assessment and reporting
- Multi-format output generation

## Schema Definitions

### SHACL Validation Schema

**Location**: `/tests/fixtures/knowledge-graphs/schemas/kg-validation.shacl.ttl`

Comprehensive validation framework covering:

#### Entity Validation Shapes

```turtle
kg:PersonShape
    a sh:NodeShape ;
    sh:targetClass schema:Person ;
    sh:property [
        sh:path schema:name ;
        sh:minCount 1 ;
        sh:maxCount 1 ;
        sh:datatype xsd:string ;
        sh:message "Person must have exactly one name"
    ] ;
    sh:property [
        sh:path foaf:mbox ;
        sh:maxCount 1 ;
        sh:pattern "^mailto:.+@.+\\..+" ;
        sh:message "Email must be a valid mailto URI"
    ] .
```

#### Relationship Validation

```turtle
kg:RelationshipShape
    a sh:NodeShape ;
    sh:targetNode kg:QualifiedRelation ;
    sh:property [
        sh:path kg:hasSubject ;
        sh:minCount 1 ;
        sh:maxCount 1 ;
        sh:nodeKind sh:IRI
    ] ;
    sh:property [
        sh:path kg:confidence ;
        sh:maxCount 1 ;
        sh:datatype xsd:decimal ;
        sh:minInclusive 0.0 ;
        sh:maxInclusive 1.0 ;
        sh:message "Confidence must be between 0 and 1"
    ] .
```

#### Data Quality Constraints

- **Provenance Tracking**: Creation timestamps and source attribution
- **URI Pattern Validation**: Enforced naming conventions
- **Temporal Consistency**: Date validation and logical ordering
- **Completeness Requirements**: Mandatory property checking

## Entity-Relationship Models

### Schema Mapping Template

**Location**: `/tests/fixtures/knowledge-graphs/templates/schema-mapping.ttl.njk`

Advanced ontology alignment system:

#### Class Alignments
- Schema.org mappings with equivalentClass relationships
- FOAF integration for person/organization entities
- Custom vocabulary bridging
- Hierarchical inheritance structures

#### Property Alignments
- Domain and range specifications
- Functional and inverse functional properties
- Transitive and symmetric relationship handling
- Dublin Core metadata integration

#### SKOS Concept Mappings
- Hierarchical taxonomies with broader/narrower relationships
- Multi-lingual concept labels
- Cross-vocabulary exact/close matches
- Concept scheme organization

### Relationship Mapping Template

**Location**: `/tests/fixtures/knowledge-graphs/templates/relationship-mapping.ttl.njk`

Sophisticated relationship modeling:

#### Direct Relationships
```turtle
{{ relationships | map(rel => {
    const subjectUri = 'kg:' + (rel.subject | slug);
    const predicateUri = rel.predicate.startsWith('http') ? '<' + rel.predicate + '>' : 'kg:' + (rel.predicate | camelCase);
    const objectUri = rel.object.startsWith('http') ? '<' + rel.object + '>' : 'kg:' + (rel.object | slug);
    
    let statement = subjectUri + ' ' + predicateUri + ' ' + objectUri;
    
    if (rel.confidence) {
        const stmtId = 'kg:stmt_' + (rel.subject + '_' + rel.predicate + '_' + rel.object | slug);
        statement += ' .\n' + stmtId + ' a rdf:Statement ;\n    rdf:subject ' + subjectUri + ' ;\n    rdf:predicate ' + predicateUri + ' ;\n    rdf:object ' + objectUri + ' ;\n    kg:confidence "' + rel.confidence + '"^^xsd:decimal';
    }
    
    return statement + ' .';
}) | join('\n\n') }}
```

#### Qualified Relationships (N-ary Relations)
- Complex relationship contexts with qualifiers
- Temporal validity periods
- Confidence scoring and provenance
- Multi-dimensional relationship attributes

#### Network Relationships
- Weighted and directed graph structures
- Hierarchical path encoding
- Bidirectional relationship handling
- Graph topology preservation

### Entity Extraction Template

**Location**: `/tests/fixtures/knowledge-graphs/templates/entity-extraction.ttl.njk`

Comprehensive entity modeling:

#### Core Entity Types
- **Person**: FOAF integration with names, emails, birth dates
- **Organization**: Schema.org alignment with websites, industries
- **Product**: Commercial entities with pricing and branding
- **Place**: Geospatial entities with coordinates and addresses
- **Event**: Temporal entities with start/end dates and locations

#### Dynamic Property Handling
```turtle
// Custom properties
if (item.properties) {
    Object.keys(item.properties).forEach(key => {
        const value = item.properties[key];
        const predicate = 'schema:' + (key | camelCase);
        
        if (typeof value === 'string' && value.startsWith('http')) {
            properties.push(predicate + ' <' + value + '>');
        } else if (typeof value === 'number') {
            properties.push(predicate + ' "' + value + '"^^xsd:decimal');
        } else if (typeof value === 'boolean') {
            properties.push(predicate + ' "' + value + '"^^xsd:boolean');
        } else {
            properties.push(predicate + ' "' + value + '"@en');
        }
    });
}
```

## Graph Construction Pipelines

### Template-Driven Generation

The knowledge graph construction follows a sophisticated pipeline:

1. **Data Ingestion**: JSON/CSV/XML source processing
2. **Entity Extraction**: Template-based entity identification
3. **Relationship Mapping**: Property and object relationship creation
4. **Schema Alignment**: Vocabulary mapping and validation
5. **Quality Assessment**: SHACL validation and metrics collection
6. **Output Generation**: Multi-format RDF serialization

### Metadata and Provenance

**Location**: `/tests/fixtures/knowledge-graphs/templates/graph-metadata.ttl.njk`

Comprehensive metadata tracking:

#### Provenance Information
```turtle
kg:provenance a prov:Entity ;
    dct:title "{{ domain | title }} Knowledge Graph Provenance" ;
    prov:wasGeneratedBy kg:generationActivity ;
    prov:generatedAtTime "{{ now() | formatDate('YYYY-MM-DDTHH:mm:ss') }}"^^xsd:dateTime ;
    prov:wasAttributedTo kg:agent .
```

#### Quality Metrics
- Completeness scoring across entities/relationships/attributes
- Accuracy measurements (syntactic/semantic)
- Consistency validation (logical/representational)
- Coverage analysis (domain/temporal/geographic)
- Timeliness tracking and freshness scoring

#### Version Control
- Graph versioning with change tracking
- Addition/deletion/modification counts
- Revision history with previous version links
- Release date and description metadata

## Query Languages and Interfaces

### SPARQL Query Templates

**Location**: `/tests/fixtures/knowledge-graphs/templates/sparql-queries.sparql.njk`

Comprehensive query library:

#### Basic Entity Queries
```sparql
# Find all entity types in the knowledge graph
SELECT ?type (COUNT(?entity) AS ?count)
WHERE {
    ?entity a ?type .
    FILTER(!isBlank(?entity))
}
GROUP BY ?type
ORDER BY DESC(?count)
```

#### Relationship Discovery
```sparql
# Find shortest path between two entities
SELECT ?path
WHERE {
    ?start schema:name "{{ startEntity || 'Entity1' }}" .
    ?end schema:name "{{ endEntity || 'Entity2' }}" .
    ?start (kg:relatedTo+) ?end .
    BIND(kg:shortestPath(?start, ?end) AS ?path)
}
```

#### Graph Analytics Queries
```sparql
# Find entities with highest degree centrality
SELECT ?entity ?name (COUNT(?relationship) AS ?degree)
WHERE {
    {
        ?entity ?relationship ?target .
        FILTER(?relationship != a)
    } UNION {
        ?source ?relationship ?entity .
        FILTER(?relationship != a)
    }
    OPTIONAL { ?entity schema:name ?name }
}
GROUP BY ?entity ?name
ORDER BY DESC(?degree)
LIMIT {{ centralityLimit || 20 }}
```

#### Maintenance and Quality Queries
- Orphaned entity detection
- Duplicate identification
- Inconsistency analysis
- Missing property validation

### API Query Interface

**Location**: `/tests/fixtures/knowledge-graphs/deployment/kg-api-server.js`

RESTful API providing:

#### Endpoints
- **POST /api/v1/query**: SPARQL query execution
- **GET /api/v1/entities/search**: Entity search with full-text
- **GET /api/v1/entities/:id**: Entity detail retrieval
- **GET /api/v1/entities/:id/relationships**: Relationship exploration
- **GET /api/v1/stats**: Graph statistics and metrics

#### Security Features
- API key authentication
- Rate limiting (1000 requests/15 minutes)
- Input validation and sanitization
- Query operation restrictions (no INSERT/DELETE in query endpoint)
- CORS configuration

#### Performance Optimization
- NodeCache integration (5-minute TTL)
- Query execution time monitoring
- Request/response logging
- Health check endpoints

## Graph Analytics and Metrics

### Statistical Analysis

The system provides comprehensive graph analytics:

#### Basic Metrics
- Total triples, subjects, predicates, objects
- Entity and relationship counts by type
- Average and maximum node degree
- Clustering coefficient calculation
- Average path length measurement

#### Quality Assessment
```turtle
kg:qualityAssessment a owl:NamedIndividual , kg:QualityReport ;
    kg:completenessScore "{{ qualityMetrics.completeness.overall | default(0) }}"^^xsd:decimal ;
    kg:accuracyScore "{{ qualityMetrics.accuracy.overall | default(0) }}"^^xsd:decimal ;
    kg:consistencyScore "{{ qualityMetrics.consistency.overall | default(0) }}"^^xsd:decimal ;
    kg:totalTriples {{ statistics.totalTriples || 0 }} ;
    kg:averageDegree "{{ statistics.averageDegree || 0 }}"^^xsd:decimal ;
    kg:clusteringCoefficient "{{ statistics.clusteringCoefficient || 0 }}"^^xsd:decimal .
```

#### Centrality Measures
- Degree centrality identification
- Betweenness centrality (referenced in traversal patterns)
- PageRank-style authority scoring
- Hub and authority analysis

## Visualization Components

### Graph Visualization Infrastructure

The system supports multiple visualization approaches:

#### Web-Based Interfaces
- **YASGUI**: SPARQL query interface with result visualization
- **Custom React UI**: Entity browser and relationship explorer
- **Grafana Dashboards**: Metrics and monitoring visualization

#### Data Export for Visualization
- D3.js compatible JSON formats
- Cytoscape.js graph structures
- Vis.js network layouts
- GraphViz DOT format export

#### Interactive Features
- Entity search and filtering
- Relationship path highlighting
- Temporal data animation
- Geographic mapping integration

## Deployment Infrastructure

### Docker Compose Configuration

**Location**: `/tests/fixtures/knowledge-graphs/deployment/docker-compose.yml`

Enterprise-grade deployment stack:

#### Triple Stores
- **Apache Jena Fuseki**: Primary SPARQL endpoint (port 3030)
- **OpenLink Virtuoso**: Alternative high-performance option (port 8890)
- **OntoText GraphDB**: Enterprise features (port 7200)

#### Supporting Services
- **Elasticsearch**: Full-text search capabilities (port 9200)
- **Redis**: Query result caching (port 6379)
- **Knowledge Graph API**: RESTful interface (port 3000)
- **Web UI**: React-based interface (port 3001)
- **YASGUI**: SPARQL query interface (port 3002)

#### Monitoring and Operations
- **Prometheus**: Metrics collection (port 9090)
- **Grafana**: Visualization and alerting (port 3003)
- **Data Loader**: Batch RDF import service
- **Backup Service**: Automated backup with S3 integration

#### Network Configuration
```yaml
networks:
  kg-network:
    driver: bridge
    ipam:
      driver: default
      config:
        - subnet: 172.20.0.0/16
```

#### Volume Management
- Persistent storage for triple store data
- Configuration file mounting
- Log aggregation and rotation
- Backup storage management

## Template System Integration

### Nunjucks Template Architecture

The knowledge graph system integrates deeply with the Unjucks template engine:

#### Template Variables
- Dynamic entity and relationship data injection
- Schema alignment configuration
- Output format selection
- Quality metric thresholds

#### Filter Integration
- RDF-specific filters for URI generation
- Date/time formatting for temporal data
- String manipulation for entity naming
- Validation and sanitization filters

#### Conditional Generation
```nunjucks
{% if entities %}
# Entity Definitions
{{ entities | map(item => {
    const entityId = item.id || item.name | slug;
    const entityUri = 'kg:' + entityId;
    const entityType = item.type | default('Thing') | pascalCase | schemaType;
    // ... entity generation logic
}) | join('\n\n') }}
{% endif %}
```

### MCP Integration Testing

**Location**: `/tests/integration/knowledge-graph-processing.test.js`

Comprehensive integration testing:

#### Enterprise Workflow Testing
- Fortune 5 compliance knowledge graph processing
- API generation with semantic annotations
- Cross-ontology reasoning validation
- Large-scale graph performance testing

#### Semantic Template Generation
- RDF data synchronization with template variables
- Semantic reasoning integration
- Code generation with compliance rules
- Real-time knowledge graph updates

## Testing and Validation

### Test Infrastructure

The system includes comprehensive testing across multiple dimensions:

#### Unit Tests
- RDF parsing and serialization
- SPARQL query construction
- Schema validation logic
- Template rendering accuracy

#### Integration Tests
- End-to-end pipeline execution
- MCP bridge functionality
- API endpoint validation
- Performance benchmarking

#### Security Testing
- Input sanitization validation
- Query injection prevention
- Authentication and authorization
- Rate limiting effectiveness

#### Production Readiness
- Scalability stress testing
- Error recovery validation
- Monitoring and alerting
- Backup and restore procedures

### Validation Frameworks

#### SHACL Validation
- Constraint checking against schemas
- Error reporting with detailed messages
- Quality score calculation
- Compliance verification

#### Data Quality Metrics
- Completeness assessment
- Accuracy validation
- Consistency checking
- Timeliness evaluation

## File Structure Summary

### Core Implementation Files
```
/src/commands/knowledge-graph.js          # Main CLI interface
/src/lib/knowledge-graph/kg-pipeline.js  # Core processing pipeline
/tests/fixtures/knowledge-graphs/        # Template and test data
  schemas/kg-validation.shacl.ttl        # SHACL validation schemas
  templates/                            # Generation templates
    entity-extraction.ttl.njk            # Entity modeling
    relationship-mapping.ttl.njk         # Relationship structures
    schema-mapping.ttl.njk                # Ontology alignment
    graph-metadata.ttl.njk                # Provenance and quality
    sparql-queries.sparql.njk             # Query templates
  deployment/                           # Infrastructure
    docker-compose.yml                    # Service orchestration
    kg-api-server.js                      # REST API server
```

### Supporting Files
```
/tests/integration/knowledge-graph-processing.test.js  # Integration tests
/docs/kgen/                                          # Documentation
  rdf-rdfs-patterns-index.md                         # RDF patterns
  sparql-query-index.md                              # SPARQL reference
  shacl-validation-index.md                          # Validation guide
  turtle-rdf-index.md                                # Turtle syntax
  ontology-owl-index.md                              # OWL ontologies
```

## Architecture Patterns

### Design Principles
1. **Template-Driven Generation**: All RDF output generated through Nunjucks templates
2. **Schema-First Validation**: SHACL constraints enforce data quality
3. **Modular Pipeline Architecture**: Pluggable components for different domains
4. **Multi-Format Support**: Flexible output in various RDF serializations
5. **Enterprise Integration**: Production-ready deployment and monitoring

### Extensibility Points
- Custom entity type handlers
- Domain-specific relationship mappers
- Vocabulary alignment modules
- Quality metric calculators
- Visualization component plugins

This comprehensive knowledge graph infrastructure provides a solid foundation for semantic web applications, supporting everything from simple RDF generation to complex enterprise knowledge management systems.