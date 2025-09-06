# Semantic RDF/TTL/N3 Template Generators

This directory contains Unjucks template generators for creating complete semantic data ecosystems using RDF, Turtle (TTL), and N3 formats. These templates demonstrate Unjucks' core mission of generating structured, semantic files from data-driven templates.

## Overview

The semantic template generators enable you to:

- **Generate Ontologies** from domain models and business requirements
- **Create RDF Data Instances** with proper semantic validation
- **Build SHACL Validation Shapes** for data quality assurance  
- **Generate SPARQL Queries** for data access and analytics

## Template Structure

```
_templates/semantic/
├── ontology/
│   └── ontology.ttl.njk          # Ontology generator with OWL constructs
├── data/
│   └── data-instances.ttl.njk    # RDF data instance generator
├── shacl/
│   └── validation-shapes.ttl.njk # SHACL validation rules generator
├── sparql/
│   └── queries.sparql.njk        # SPARQL query generator
└── README.md                     # This documentation
```

## Templates

### 1. Ontology Generator (`ontology/ontology.ttl.njk`)

Generates OWL ontologies with:
- **Namespace Management** - Dynamic prefix declarations
- **Class Definitions** - OWL classes with restrictions and annotations
- **Property Definitions** - Object and data properties with domains/ranges
- **Individual Declarations** - Named individuals and facts
- **SWRL Rules** - Semantic Web Rule Language support
- **Import Statements** - External ontology integration

**Features:**
- Automatic IRI generation and versioning
- OWL constructs (restrictions, characteristics, equivalence)
- RDFS inference patterns
- Provenance metadata integration
- Enterprise compliance annotations

### 2. Data Instance Generator (`data/data-instances.ttl.njk`)

Generates RDF data instances with:
- **Typed Instances** - Properly classified RDF resources
- **Property Assertions** - Data and object property values
- **Collections** - RDF bags, sequences, and alternatives  
- **Linked Data** - External resource connections
- **Geospatial Data** - WGS84 coordinates and geometry
- **Temporal Data** - Time intervals and durations
- **Provenance** - Data lineage and source tracking

**Features:**
- Dataset metadata (VoID, DCAT)
- Nested instance generation
- Automatic datatype detection
- Multi-language support
- Statistical summaries

### 3. SHACL Validation Generator (`shacl/validation-shapes.ttl.njk`)

Generates SHACL validation shapes with:
- **Node Shapes** - Class-based validation rules
- **Property Shapes** - Path-based property constraints
- **Property Groups** - UI organization structures
- **Custom Functions** - SPARQL-based validation logic
- **SHACL Rules** - Data transformation rules
- **Test Cases** - Validation test scenarios

**Features:**
- Comprehensive constraint types (cardinality, datatypes, patterns)
- Severity levels and custom messages
- Qualified value shapes
- Complex SPARQL constraints
- Closed shape validation

### 4. SPARQL Query Generator (`sparql/queries.sparql.njk`)

Generates SPARQL queries with:
- **Basic Queries** - SELECT, CONSTRUCT, DESCRIBE, ASK
- **Analytics Queries** - Aggregation and business intelligence
- **Federated Queries** - Cross-endpoint data integration
- **Reasoning Queries** - Inference-enabled queries
- **Update Operations** - INSERT, DELETE, MODIFY operations

**Features:**
- Dynamic WHERE patterns
- Complex path expressions
- OPTIONAL and UNION constructs
- FILTER expressions and BIND operations
- Graph-based queries (GRAPH, SERVICE)

## Domain Examples

### Healthcare Domain (`examples/semantic-generation/healthcare-domain.yml`)

Complete healthcare semantic model with:
- **Patient Management** - Patient records, providers, appointments
- **Clinical Data** - Medical conditions, treatments, prescriptions
- **Compliance** - HIPAA, HL7 FHIR, SNOMED CT integration
- **Quality Assurance** - SHACL validation for clinical data
- **Analytics** - Population health and outcomes analysis

### Financial Services (`examples/semantic-generation/financial-domain.yml`)

Comprehensive financial domain model with:
- **Customer Management** - KYC, risk assessment, compliance
- **Account Management** - Various account types and transactions
- **Investment Tracking** - Portfolio management and valuations
- **Regulatory Compliance** - Basel III, MiFID II, FATCA
- **Risk Analytics** - Credit scoring and fraud detection

### Supply Chain (`examples/semantic-generation/supply-chain-domain.yml`)

End-to-end supply chain semantic model with:
- **Traceability** - Product lifecycle and provenance tracking
- **Supplier Management** - Qualification and performance metrics
- **Logistics** - Shipment tracking and delivery optimization
- **Sustainability** - Carbon footprint and ESG metrics
- **Blockchain Integration** - Immutable audit trails

## Semantic-Aware Features

### Nunjucks Filters

Custom semantic filters for RDF generation:

```nunjucks
{# Convert to camelCase for RDF names #}
{{ "product name" | camelize }}  → productName

{# Generate semantic values with proper datatypes #}
{{ "2024-01-15" | semanticValue }}  → "2024-01-15"^^xsd:date
{{ 42 | semanticValue }}  → "42"^^xsd:integer
{{ true | semanticValue }}  → "true"^^xsd:boolean

{# Create prefixed names #}
{{ "http://example.org/Product" | prefixedName(prefixes) }}  → ex:Product

{# Generate SPARQL terms #}
{{ "?subject" | sparqlTerm }}  → ?subject
{{ "ex:predicate" | sparqlTerm }}  → ex:predicate
```

### Dynamic Namespace Management

```nunjucks
{%- set prefixes = prefixes | default({}) | merge({
  "ex": "http://example.org/",
  "owl": "http://www.w3.org/2002/07/owl#",
  "rdfs": "http://www.w3.org/2000/01/rdf-schema#"
}) -%}

{% for prefix, uri in prefixes -%}
@prefix {{ prefix }}: <{{ uri }}> .
{% endfor %}
```

### Enterprise Compliance

Templates include enterprise-ready features:
- **Regulatory Compliance** - Built-in compliance patterns
- **Data Governance** - Metadata and lineage tracking
- **Security** - Access control and privacy annotations
- **Audit Trails** - Comprehensive provenance tracking
- **Performance** - Optimized query patterns

## Usage Examples

### Generate Healthcare Ontology

```bash
# Generate complete healthcare semantic ecosystem
unjucks generate semantic ontology --domain healthcare \
  --config examples/semantic-generation/healthcare-domain.yml

# Output: healthcare-ontology/healthcare-ontology.ttl
```

### Generate Financial Data Instances

```bash
# Generate financial customer and transaction data
unjucks generate semantic data --domain financial \
  --instanceSetName "customer-data" \
  --config examples/semantic-generation/financial-domain.yml

# Output: financial-data/customer-data-instances.ttl
```

### Generate Supply Chain SHACL Shapes

```bash
# Generate validation shapes for supply chain data
unjucks generate semantic shacl --domain supply-chain \
  --validationLevel strict \
  --config examples/semantic-generation/supply-chain-domain.yml

# Output: supply-chain-shapes/supply-chain-shapes.ttl
```

### Generate Analytics Queries

```bash
# Generate SPARQL queries for business analytics
unjucks generate semantic sparql --domain financial \
  --querySetName "risk-analytics" \
  --optimizationTarget performance \
  --config examples/semantic-generation/financial-domain.yml

# Output: financial-queries/risk-analytics-queries.sparql
```

## Integration Patterns

### Enterprise Data Pipeline

```yaml
# Data pipeline configuration
pipeline:
  stages:
    - name: "ontology-generation"
      template: "semantic/ontology"
      config: "domain-model.yml"
      
    - name: "data-transformation"
      template: "semantic/data"
      config: "data-sources.yml"
      
    - name: "validation"
      template: "semantic/shacl"
      config: "quality-rules.yml"
      
    - name: "query-generation"
      template: "semantic/sparql"
      config: "analytics-requirements.yml"
```

### CI/CD Integration

```yaml
# GitHub Actions workflow
- name: Generate Semantic Assets
  run: |
    unjucks generate semantic ontology --config healthcare-domain.yml
    unjucks generate semantic data --config patient-data.yml
    unjucks generate semantic shacl --config validation-rules.yml
    unjucks generate semantic sparql --config analytics-queries.yml
    
- name: Validate Generated RDF
  run: |
    riot --validate healthcare-ontology.ttl
    shacl validate --shapes healthcare-shapes.ttl --data patient-data.ttl
```

### Knowledge Graph Construction

```bash
# Complete knowledge graph generation
unjucks batch semantic \
  --templates ontology,data,shacl,sparql \
  --domains healthcare,financial,supply-chain \
  --output knowledge-graph/

# Result: Integrated multi-domain knowledge graph
```

## Best Practices

### 1. Namespace Strategy

- Use consistent base IRIs across domains
- Implement versioning for ontology evolution
- Follow W3C naming conventions
- Document namespace choices in ADRs

### 2. Data Modeling

- Start with core entities and relationships
- Layer complexity incrementally
- Use existing vocabularies (FHIR, FIBO, GS1)
- Maintain business-semantic alignment

### 3. Validation Strategy

- Progressive validation levels (warning → violation)
- Business rule enforcement via SHACL
- Custom functions for complex validation
- Performance-optimized shapes

### 4. Query Optimization

- Index-friendly query patterns
- Minimize cartesian products
- Use property paths efficiently
- Implement pagination for large results

## Advanced Features

### Blockchain Integration

```yaml
# Blockchain provenance tracking
provenance:
  blockchain:
    enabled: true
    network: "ethereum"
    contractAddress: "0x..."
    events:
      - "ProductCreated"
      - "OwnershipTransferred"
      - "QualityAssessed"
```

### Multi-Modal Data

```yaml
# Integrate structured and unstructured data
instances:
  - name: "medical_image_001"
    types: ["MedicalImage", "DicomImage"]
    properties:
      imageData: "base64:iVBORw0KGgoAAAANSUhEUgAA..."
      annotations: "AI-detected anomalies in lung tissue"
```

### Real-time Streaming

```yaml
# Stream processing integration
streams:
  - name: "iot_sensor_data"
    format: "json-ld"
    template: "semantic/data"
    frequency: "1s"
    validation: "semantic/shacl"
```

## Contributing

When contributing new semantic templates:

1. Follow RDF/OWL best practices
2. Include comprehensive examples
3. Add SHACL validation rules
4. Provide SPARQL query examples
5. Document enterprise use cases
6. Test with real-world data
7. Include performance benchmarks

## Resources

- [RDF 1.1 Specification](https://www.w3.org/TR/rdf11-concepts/)
- [OWL 2 Web Ontology Language](https://www.w3.org/TR/owl2-overview/)
- [SHACL Specification](https://www.w3.org/TR/shacl/)
- [SPARQL 1.1 Query Language](https://www.w3.org/TR/sparql11-query/)
- [Linked Data Best Practices](https://www.w3.org/TR/ld-bp/)
- [FAIR Data Principles](https://www.go-fair.org/fair-principles/)

---

**Unjucks Semantic Templates** - Transforming domain knowledge into machine-readable semantics with enterprise-grade quality and compliance.