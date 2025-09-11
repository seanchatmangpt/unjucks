# Ontology and OWL Usage Index

This document provides a comprehensive mapping of all ontology definitions, Web Ontology Language (OWL) usage, and semantic web patterns in the Unjucks codebase.

## Executive Summary

The Unjucks project implements a sophisticated ontology-driven template generation system with:
- **Core Ontology Engine**: Integrates N3.js for RDF/Turtle processing with Nunjucks templating
- **Enterprise Template Ontology**: 410-line comprehensive semantic model for code generation
- **Governance Rules**: N3 logic rules for compliance and security (20 rules, 312 lines)
- **CLI Integration**: Full command-line interface for ontology operations
- **Template Generators**: OWL-based template generation for domain and mapping ontologies

## Core Ontology Implementation

### 1. Primary Ontology Engine
**File**: `/Users/sac/unjucks/src/core/ontology-template-engine.js`
**Lines**: 342 total

**Key Components**:
- **N3 Store Integration**: RDF triple storage and querying using N3.js
- **Template Data Extraction**: Converts RDF to template-friendly JSON objects
- **Custom Nunjucks Filters**: 5 specialized filters for ontology data processing
- **Batch Processing**: Handles multiple subjects in single operation
- **Inference Rules**: N3 notation rules for semantic reasoning

**Core Classes**:
```javascript
export class OntologyTemplateEngine {
  constructor(options = {}) {
    this.store = new N3.Store();        // RDF storage
    this.parser = new N3.Parser();      // Turtle parser
    this.env = nunjucks.configure();    // Template engine
  }
}
```

### 2. CLI Commands Interface
**File**: `/Users/sac/unjucks/src/cli/commands/ontology.js`
**Lines**: 311 total

**Available Commands**:
- `ontology generate` - Generate from ontology and template
- `ontology list` - List available ontology templates  
- `ontology query` - Query ontology data with SPARQL-like patterns
- `ontology extract` - Extract structured data from specific subjects

**Command Usage**:
```bash
unjucks ontology generate person.ttl --template person-card
unjucks ontology generate company.ttl --batch --output-dir ./generated
unjucks ontology query person.ttl --subject http://example.org/person/alex
```

## Enterprise Template Ontology

### 3. Core Enterprise Ontology
**File**: `/Users/sac/unjucks/src/semantic/ontologies/enterprise-template-ontology.ttl`
**Lines**: 410 total

**Namespace Declarations**:
```turtle
@prefix template: <http://unjucks.dev/template/> .
@prefix enterprise: <http://unjucks.dev/enterprise/> .
@prefix unjucks: <http://unjucks.dev/ontology/> .
@prefix generator: <http://unjucks.dev/generator/> .
```

**Core Class Hierarchy**:
```turtle
template:Template a owl:Class
├── template:GeneratorTemplate
├── template:ComponentTemplate  
├── template:ServiceTemplate
│   └── template:MicroserviceTemplate
├── template:DataTemplate
├── template:UiTemplate
├── template:MonolithTemplate
└── template:ServerlessTemplate

enterprise:EnterpriseTemplate
├── enterprise:ComplianceTemplate
├── enterprise:SecurityTemplate
└── enterprise:AuditTemplate
```

**Key Object Properties** (18 total):
- `template:dependsOn` - Template dependencies
- `template:extendsTemplate` - Template inheritance
- `template:hasVariable` - Template variables
- `template:usesGenerator` - Code generator associations
- `template:author` - Template authorship

**Key Datatype Properties** (45 total):
- **Functional**: `template:name`, `template:version`, `template:language`
- **System Architecture**: `template:isMicroservice`, `template:isMonolith`, `template:isServerless`
- **Data Processing**: `template:hasFinancialData`, `template:processesTransactions`
- **Security**: `template:isMultiTenant`, `template:isCriticalSystem`
- **Performance**: `template:expectedRequestsPerMinute`, `template:expectedConcurrentUsers`

## Governance and Reasoning Rules

### 4. N3 Logic Rules System
**File**: `/Users/sac/unjucks/src/semantic/rules/enterprise-governance.n3`
**Lines**: 312 total

**Rule Categories**:
1. **API Security** (Rules 1-2): Authentication, rate limiting, versioning
2. **Financial Compliance** (Rules 3-4): SOX requirements, audit trails
3. **GDPR Privacy** (Rules 5-6, 19): Personal data protection, consent management
4. **Infrastructure** (Rules 7, 14-17): High-volume APIs, real-time systems
5. **Industry Compliance** (Rules 11-12): PCI DSS, HIPAA requirements
6. **Advanced Security** (Rules 16, 18, 20): Critical infrastructure, emergency access

**Example Rule - SOX Compliance**:
```n3
{
    ?template template:hasFinancialData true
}
=>
{
    ?template sox:requiresAuditTrail true ;
              sox:requiresAccessControl true ;
              sox:dataRetentionPeriod "P7Y" ;
              audit:requiresImmutableLog true ;
              access:minimumAuthLevel "manager" .
}
```

## Template Generation System

### 5. OWL Template Generators

**Basic Ontology Generator**:
**File**: `/Users/sac/unjucks/tests/fixtures/ontologies/basic-ontology.owl.njk`
```turtle
@prefix {{ nsPrefix | kebabCase }}: <{{ namespace | rdfResource }}/> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
```

**Domain Ontology Generator**: 
**File**: `/Users/sac/unjucks/tests/fixtures/ontologies/domain-ontology.owl.njk`
- **Features**: Domain-specific classes, restrictions, enumerations
- **Output**: Complete OWL domain ontologies with RDFS hierarchies

**Upper Ontology Generator**:
**File**: `/Users/sac/unjucks/tests/fixtures/ontologies/upper-ontology.owl.njk`
- **Features**: Abstract conceptual framework, temporal entities, quality/quantity classes
- **Classes**: Entity, Abstract, Concrete, TemporalEntity, Event, Process, Quality, Role
- **Properties**: partOf/hasPart, dependsOn, hasParticipant, temporal relations

**Mapping Ontology Generator**:
**File**: `/Users/sac/unjucks/tests/fixtures/ontologies/mapping-ontology.owl.njk`
- **Features**: Cross-vocabulary alignments, SKOS mappings, property transformations
- **Relations**: equivalentClass, subclass, exactMatch, closeMatch, broadMatch

### 6. Semantic Template Generator
**File**: `/Users/sac/unjucks/_templates/semantic/ontology/ontology.ttl.njk`
**Lines**: 236 total

**Advanced Features**:
- Dynamic prefix management
- OWL class restrictions and characteristics
- SWRL rule integration
- Individual and annotation property support
- Comprehensive template variables support

## Ontology File Ecosystem

### 7. Schema Definitions
**User Schema**: `/Users/sac/unjucks/schema/user.ttl`
```turtle
:User a owl:Class ;
    rdfs:label "User" ;
    rdfs:comment "A user of the system."

:hasName a owl:DatatypeProperty ;
    rdfs:domain :User ;
    rdfs:range xsd:string .
```

**Enterprise Schemas**:
- `/Users/sac/unjucks/src/semantic/schemas/gdpr-compliance.ttl`
- `/Users/sac/unjucks/src/semantic/schemas/sox-compliance.ttl`  
- `/Users/sac/unjucks/src/semantic/schemas/api-governance.ttl`

### 8. Test and Example Ontologies

**Sample Ontologies** (47 .ttl files):
- Fortune 5 company data: `/Users/sac/unjucks/tests/fixtures/fortune5/*.ttl`
- Performance test data: `/Users/sac/unjucks/tests/fixtures/turtle/performance/*.ttl`
- Semantic web examples: `/Users/sac/unjucks/tests/semantic-web-clean-room/examples/*.ttl`

**Complex Schema Examples**:
- **Enterprise Schema**: `/Users/sac/unjucks/tests/fixtures/turtle/enterprise-schema.ttl`
- **API Ontology**: `/Users/sac/unjucks/tests/fixtures/turtle/api-ontology.ttl`
- **Compliance Ontology**: `/Users/sac/unjucks/tests/fixtures/turtle/compliance-ontology.ttl`

## OWL Vocabulary Usage

### 9. OWL Class Constructs
**owl:Class Usage**: Found in 74+ files
- Basic class definitions in all ontology files
- Class hierarchies with `rdfs:subClassOf`
- Equivalence relations with `owl:equivalentClass`
- Disjoint classes with `owl:disjointWith`

**OWL Properties**:
- **owl:ObjectProperty**: Relates entities to entities
- **owl:DatatypeProperty**: Relates entities to literals
- **owl:FunctionalProperty**: Single-valued properties
- **owl:InverseFunctionalProperty**: Unique identification
- **owl:TransitiveProperty**: Transitive relations
- **owl:SymmetricProperty**: Bidirectional relations

### 10. Advanced OWL Features

**Property Characteristics**:
```turtle
template:partOf rdf:type owl:TransitiveProperty ;
    owl:inverseOf template:hasPart .

template:hasTemporalExtent rdf:type owl:FunctionalProperty ;
    rdfs:domain template:TemporalEntity ;
    rdfs:range time:TemporalEntity .
```

**Class Restrictions**:
```turtle
template:TemporalEntity owl:equivalentClass [
    rdf:type owl:Restriction ;
    owl:onProperty template:hasTemporalExtent ;
    owl:someValuesFrom time:TemporalEntity
] .
```

## RDFS Vocabulary Integration

### 11. RDFS Schema Elements
**Core RDFS Usage** (found in all .ttl files):
- `rdfs:Class` - Class definitions
- `rdfs:subClassOf` - Class hierarchies  
- `rdfs:domain` - Property domain constraints
- `rdfs:range` - Property range constraints
- `rdfs:label` - Human-readable labels
- `rdfs:comment` - Documentation strings
- `rdfs:isDefinedBy` - Provenance information

**Example RDFS Pattern**:
```turtle
template:Template a rdfs:Class ;
    rdfs:label "Template"@en ;
    rdfs:comment "A template for code generation with semantic annotations"@en ;
    rdfs:isDefinedBy <http://unjucks.dev/ontology/> .
```

## Ontology Validation Patterns

### 12. SHACL Integration
**Limited SHACL Usage**: Found in knowledge graph fixtures
- `/Users/sac/unjucks/tests/fixtures/knowledge-graphs/schemas/kg-validation.shacl.ttl`
- Basic shape validation for semantic templates

### 13. N3 Validation Rules
**Custom Validation**: Embedded in governance rules
- Type checking through N3 inference
- Compliance validation via reasoning
- Template consistency checking

**Example Validation Rule**:
```n3
{
    ?template api:generatesEndpoint true .
    ?template api:isPublic true 
} 
=> 
{ 
    ?template api:requiresAuthentication true ;
              compliance:requiresSecurityReview true .
}
```

## Ontology Alignment and Mapping

### 14. Cross-Vocabulary Mappings
**Mapping Infrastructure**:
- SKOS concept schemes for template categories
- OWL equivalence and subsumption mappings
- Cross-reference mappings in enterprise ontologies

**Standard Vocabulary Integration**:
- **FOAF**: Person and agent modeling
- **Dublin Core**: Metadata and provenance
- **SKOS**: Concept hierarchies and vocabularies
- **PROV**: Provenance and workflow tracking
- **Schema.org**: Structured data compatibility

### 15. Alignment Patterns
**Example Mappings**:
```turtle
# Enterprise to Schema.org alignment
enterprise:Person owl:equivalentClass foaf:Person .
enterprise:Organization owl:equivalentClass foaf:Organization .

# Cross-vocabulary property mapping  
template:name rdfs:subPropertyOf dc:title .
template:description rdfs:subPropertyOf dc:description .
```

## Knowledge Graph Features

### 16. Enterprise Knowledge Graphs
**Fortune 5 Data Models**:
- **Walmart**: Product catalogs, supply chain events
- **JPMorgan**: Financial instruments and compliance
- **CVS Health**: Patient records and healthcare data

**Knowledge Graph Templates**:
- Schema mapping templates: `/Users/sac/unjucks/tests/fixtures/knowledge-graphs/templates/`
- Relationship mapping: Schema evolution and alignment
- Validation frameworks: SHACL-based validation

### 17. Semantic Web Standards Compliance
**W3C Standards Implementation**:
- **RDF 1.1**: Core RDF data model
- **Turtle 1.1**: Terse RDF Triple Language  
- **OWL 2 Web Ontology Language**: Full OWL 2 DL support
- **RDFS**: RDF Schema vocabulary
- **SPARQL**: Query language patterns (basic support)
- **N3**: Notation3 for logic rules

## Performance and Scalability

### 18. Ontology Processing Performance
**Large Dataset Handling**:
- Performance test files up to 10,000 triples
- Batch processing for multiple subjects
- Optimized N3 store operations
- Memory-efficient streaming for large ontologies

**Benchmark Files**:
- `/Users/sac/unjucks/tests/fixtures/turtle/performance/small-100.ttl`
- `/Users/sac/unjucks/tests/fixtures/turtle/performance/medium-1000.ttl`  
- `/Users/sac/unjucks/tests/fixtures/turtle/performance/large-10000.ttl`
- `/Users/sac/unjucks/tests/fixtures/performance/massive-enterprise-graph.ttl`

## Security and Compliance Integration

### 19. Security-Aware Ontologies
**Security Template Properties**:
- `template:requiresAuthentication`
- `template:requiresEncryption` 
- `template:isCriticalSystem`
- `security:threatLevel`
- `access:requiresMultiFactorAuth`

**Compliance Frameworks**:
- **SOX**: Sarbanes-Oxley financial compliance
- **GDPR**: General Data Protection Regulation
- **HIPAA**: Healthcare privacy standards
- **PCI DSS**: Payment card industry security

### 20. Audit and Governance
**Audit Trail Integration**:
- Template usage tracking via ontology properties
- Compliance requirement inference through N3 rules
- Automated governance policy enforcement
- Real-time compliance monitoring capabilities

## Development and Testing Framework

### 21. Test Coverage
**Ontology Testing Files**:
- **Unit Tests**: `/Users/sac/unjucks/tests/unit/rdf-filters.test.js`
- **Integration Tests**: `/Users/sac/unjucks/tests/semantic-web-filters.test.js`
- **Validation Tests**: `/Users/sac/unjucks/tests/bdd/semantic-web-rdf-scenarios.test.js`
- **Clean Room Tests**: `/Users/sac/unjucks/tests/semantic-web-clean-room/`

**Test Categories**:
- RDF parsing and generation
- Template data extraction
- SPARQL-like querying
- Ontology validation
- Compliance rule inference

### 22. Documentation and Examples
**Comprehensive Documentation**:
- **User Guide**: `/Users/sac/unjucks/docs/v3/ONTOLOGY-GUIDE.md` (746 lines)
- **Technical Specs**: RDF integration architecture documents
- **API Documentation**: Semantic web API specifications
- **Tutorial Examples**: Real-world ontology usage patterns

## Summary Statistics

### File Count and Distribution
- **Total TTL Files**: 52 files across the codebase
- **OWL Templates**: 4 generator templates (.owl.njk)
- **N3 Rule Files**: 1 comprehensive governance ruleset
- **Core Engine Files**: 2 primary implementation files
- **Test Files**: 25+ semantic web test files
- **Documentation**: 10+ ontology-related documentation files

### Code Complexity
- **Lines of Code**: 1,400+ lines of core ontology engine code
- **Ontology Definitions**: 410 lines of enterprise template ontology
- **Governance Rules**: 312 lines of N3 logic rules
- **Template Generators**: 650+ lines of OWL template code
- **Documentation**: 2,000+ lines of ontology documentation

### Standards and Vocabularies
- **OWL 2**: Full Web Ontology Language support
- **RDFS**: RDF Schema vocabulary integration
- **SKOS**: Simple Knowledge Organization System
- **Dublin Core**: Metadata vocabulary
- **FOAF**: Friend of a Friend vocabulary
- **Schema.org**: Structured data vocabulary
- **PROV**: Provenance vocabulary
- **Custom Vocabularies**: 8 domain-specific namespaces

This comprehensive ontology and OWL implementation provides a robust foundation for semantic template generation, enterprise compliance, and knowledge-driven code generation in the Unjucks ecosystem.