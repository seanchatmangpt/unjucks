# Semantic Generation Usage Guide

This guide demonstrates how Unjucks transforms structured domain knowledge into comprehensive semantic ecosystems, enabling AI-ready data integration and advanced analytics across enterprise domains.

## Quick Start

```bash
# Generate healthcare ontology
unjucks generate semantic/ontology --config examples/semantic-generation/healthcare-domain.yml

# Generate financial data instances  
unjucks generate semantic/data --config examples/semantic-generation/financial-domain.yml

# Generate supply chain SHACL shapes
unjucks generate semantic/shacl --config examples/semantic-generation/supply-chain-domain.yml

# Generate all semantic assets for a domain
unjucks generate semantic --config examples/semantic-generation/healthcare-domain.yml --all
```

## Domain Examples

### 🏥 Healthcare Domain (`healthcare-domain.yml`)

**Use Cases:**
- Electronic Health Records (EHR)
- Clinical Decision Support Systems
- Patient Management Platforms
- Healthcare Analytics
- Medical Device Integration
- Telemedicine Platforms

**Key Features:**
- **FHIR R4 Compliance** - HL7 FHIR resource mapping
- **HIPAA Compliance** - Privacy and security annotations
- **Clinical Terminologies** - SNOMED CT, ICD-10, LOINC integration
- **Patient Safety** - Allergy tracking and drug interactions
- **Care Coordination** - Provider networks and referrals
- **Quality Metrics** - Healthcare outcomes measurement

### 💰 Financial Services (`financial-domain.yml`)

**Use Cases:**
- Risk Management Systems
- Regulatory Reporting (Basel III, MiFID II)
- Customer Onboarding (KYC/AML)
- Portfolio Management
- Credit Assessment
- Fraud Detection

**Key Features:**
- **Regulatory Compliance** - Basel III, MiFID II, FATCA, GDPR
- **Risk Management** - Credit scoring, VaR calculations
- **Customer Segmentation** - High-net-worth, retail, institutional
- **Transaction Monitoring** - AML, sanctions screening
- **Investment Tracking** - Portfolio valuations, performance
- **Data Privacy** - GDPR compliance patterns

### 🚛 Supply Chain Management (`supply-chain-domain.yml`)

**Use Cases:**
- Product Traceability Systems
- Supplier Risk Management
- Logistics Optimization
- Sustainability Reporting
- Quality Assurance
- Blockchain Integration

**Key Features:**
- **End-to-End Traceability** - Product lifecycle tracking
- **GS1 Standards** - EPCIS, GTIN, GLN integration
- **Supplier Management** - Qualification, audits, performance
- **IoT Integration** - Sensor data, real-time tracking
- **Sustainability** - Carbon footprint, ESG metrics
- **Blockchain** - Immutable audit trails

## Configuration Structure

Each domain configuration follows a consistent structure:

```yaml
# Domain Configuration
domain: "domain-name"
version: "x.y.z"
baseIRI: "http://domain.example.org"
creator: "Organization Name"

# Namespace Management
prefixes:
  "": "http://domain.example.org/ontology#"
  "domain": "http://domain.example.org/ontology#"
  # External vocabularies...

# Ontology Structure
classes:
  - name: "EntityName"
    label: "Human Label"
    comment: "Description"
    subClassOf: "ParentClass"
    restrictions: [...]

properties:
  - name: "propertyName"
    type: "ObjectProperty|DatatypeProperty"
    domain: "DomainClass"
    range: "RangeClass"

# Sample Data
instances:
  - name: "instance_id"
    types: ["Class1", "Class2"]
    properties: {...}
    relationships: [...]

# Validation Rules
nodeShapes:
  - name: "EntityShape"
    targetClass: "Entity"
    properties: [...]

# Query Templates
queries:
  - name: "query_name"
    type: "SELECT"
    description: "Query purpose"
    select: [...]
    where: [...]
```

## Usage Patterns

### Batch Generation

Generate all semantic assets for multiple domains:

```bash
# Generate complete semantic ecosystem
for domain in healthcare financial supply-chain; do
  unjucks generate semantic \
    --config examples/semantic-generation/${domain}-domain.yml \
    --output semantic-assets/${domain}/
done
```

### CI/CD Pipeline Integration

```yaml
# .github/workflows/semantic-generation.yml
name: Generate Semantic Assets
on: [push, pull_request]

jobs:
  generate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install Unjucks
        run: npm install -g unjucks
        
      - name: Generate Healthcare Assets
        run: |
          unjucks generate semantic/ontology \
            --config examples/semantic-generation/healthcare-domain.yml \
            --output generated/healthcare/
            
      - name: Validate Generated RDF
        run: |
          # Use riot or similar RDF validator
          docker run --rm -v $PWD:/data jena/riot \
            --validate generated/healthcare/healthcare-ontology.ttl
            
      - name: Upload Artifacts
        uses: actions/upload-artifact@v3
        with:
          name: semantic-assets
          path: generated/
```

## Best Practices

### 1. Domain Modeling
- Start with core business entities
- Follow existing standards and vocabularies
- Use consistent naming conventions
- Document business rules clearly

### 2. Data Quality
- Define comprehensive validation rules
- Use appropriate severity levels
- Include meaningful error messages
- Test with real-world data

### 3. Query Design
- Optimize for common use cases
- Include performance hints
- Provide example parameters
- Document expected results

### 4. Maintenance
- Version control configurations
- Regular validation and testing
- Update external vocabulary references
- Monitor performance metrics

---

These examples demonstrate how Unjucks transforms structured domain knowledge into comprehensive semantic ecosystems, enabling AI-ready data integration and advanced analytics across enterprise domains.