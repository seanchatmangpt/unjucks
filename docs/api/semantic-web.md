# Semantic Web APIs Reference

## Overview

Unjucks provides comprehensive Semantic Web capabilities for RDF processing, SPARQL querying, ontology validation, and semantic reasoning. These APIs enable enterprise-scale knowledge graph processing with support for multiple formats and compliance frameworks.

## Core Concepts

### RDF (Resource Description Framework)
- **Triples**: Subject-Predicate-Object statements
- **Namespaces**: URI-based identification system
- **Serializations**: Turtle, N3, JSON-LD, RDF/XML

### Ontologies
- **OWL**: Web Ontology Language for formal semantics
- **RDFS**: RDF Schema for basic vocabulary
- **SHACL**: Shapes Constraint Language for validation

### SPARQL
- **Query**: Retrieve data from RDF graphs
- **Update**: Modify RDF graphs
- **Federation**: Query across multiple endpoints

## RDF Data Processing

### RDF Data Loader API

#### Load RDF Data
Load and parse RDF data from various sources.

```typescript
interface RDFDataLoader {
  loadFromFile(filePath: string, options?: LoadOptions): Promise<RDFDataset>;
  loadFromURI(uri: string, options?: LoadOptions): Promise<RDFDataset>;
  loadInline(content: string, format: RDFFormat, options?: LoadOptions): Promise<RDFDataset>;
}

interface LoadOptions {
  format?: RDFFormat;
  baseIRI?: string;
  prefixes?: Record<string, string>;
  validate?: boolean;
  maxTriples?: number;
  timeout?: number;
}

type RDFFormat = 
  | 'text/turtle'
  | 'application/n-triples' 
  | 'application/ld+json'
  | 'application/rdf+xml'
  | 'text/n3';
```

**Example Usage:**
```typescript
import { RDFDataLoader } from '@unjucks/semantic';

const loader = new RDFDataLoader();

// Load from file
const dataset = await loader.loadFromFile('./schema.ttl', {
  format: 'text/turtle',
  validate: true,
  baseIRI: 'https://example.org/',
  prefixes: {
    ex: 'https://example.org/',
    foaf: 'http://xmlns.com/foaf/0.1/'
  }
});

// Load from URI
const ontology = await loader.loadFromURI('https://schema.org/schema.ttl', {
  timeout: 30000,
  maxTriples: 100000
});

// Load inline RDF
const inlineData = await loader.loadInline(`
  @prefix ex: <https://example.org/> .
  ex:Person a rdfs:Class .
  ex:name rdfs:domain ex:Person .
`, 'text/turtle');
```

### RDF Data Sources Configuration

#### File-based Sources
```yaml
# In template frontmatter
rdf:
  type: file
  source: ./data/schema.ttl
  format: text/turtle
  baseIRI: https://example.org/
  prefixes:
    ex: https://example.org/
    foaf: http://xmlns.com/foaf/0.1/
```

#### URI-based Sources
```yaml
rdf:
  type: uri
  source: https://schema.org/version/latest/schemaorg-current-https.ttl
  format: text/turtle
  timeout: 30000
  headers:
    User-Agent: Unjucks/2.0
    Accept: text/turtle, application/rdf+xml
```

#### Inline Sources
```yaml
rdf:
  type: inline
  source: |
    @prefix ex: <https://example.org/> .
    ex:User a rdfs:Class ;
      rdfs:label "User Account" .
  format: text/turtle
```

#### SPARQL Endpoint Sources
```yaml
rdf:
  type: sparql
  endpoint: https://dbpedia.org/sparql
  query: |
    CONSTRUCT {
      ?person a foaf:Person ;
        foaf:name ?name ;
        foaf:knows ?friend .
    }
    WHERE {
      ?person a foaf:Person ;
        foaf:name ?name .
      OPTIONAL { ?person foaf:knows ?friend }
    }
    LIMIT 1000
  timeout: 45000
```

### RDF Type Conversion

#### Convert RDF to TypeScript
Generate TypeScript interfaces from RDF ontologies.

```typescript
interface RDFTypeConverter {
  convertTurtleToTypeScript(
    ontologyPath: string, 
    outputDir: string,
    options?: ConversionOptions
  ): Promise<ConversionResult>;
  
  generateValidationHelpers(
    definitions: TypeDefinition[]
  ): string;
}

interface ConversionOptions {
  generateZodSchemas?: boolean; // default: true
  generateValidators?: boolean; // default: true
  generateDocs?: boolean; // default: false
  prefix?: string; // default: ""
  excludeClasses?: string[];
  includeClasses?: string[];
  optimizeForPerformance?: boolean; // default: false
}

interface ConversionResult {
  definitions: TypeDefinition[];
  metrics: {
    classesProcessed: number;
    propertiesGenerated: number;
    executionTime: number;
  };
  warnings: string[];
}
```

**CLI Usage:**
```bash
# Basic type generation
unjucks semantic types --ontology schema.owl --output ./types

# Advanced options
unjucks semantic types \
  --ontology user.ttl \
  --output ./src/types \
  --schemas \
  --validators \
  --generate-docs
```

**Generated Output Example:**
```typescript
// Generated from ontology
export interface Person {
  '@type': 'Person';
  name: string;
  email?: string;
  age?: number;
  knows?: Person[];
}

// Generated Zod schema
export const PersonSchema = z.object({
  '@type': z.literal('Person'),
  name: z.string(),
  email: z.string().email().optional(),
  age: z.number().int().min(0).optional(),
  knows: z.array(z.lazy(() => PersonSchema)).optional()
});

// Generated validator
export function validatePerson(data: unknown): data is Person {
  return PersonSchema.safeParse(data).success;
}
```

## SPARQL Query Engine

### Query Execution

#### Basic Queries
```typescript
interface SPARQLQueryEngine {
  executeQuery(
    query: string,
    dataset: RDFDataset,
    options?: QueryOptions
  ): Promise<QueryResult>;
  
  executeUpdate(
    update: string,
    dataset: RDFDataset,
    options?: UpdateOptions
  ): Promise<UpdateResult>;
}

interface QueryOptions {
  timeout?: number; // default: 30000ms
  limit?: number;
  offset?: number;
  reasoning?: boolean; // default: false
  optimization?: 'none' | 'basic' | 'aggressive'; // default: 'basic'
}

interface QueryResult {
  bindings: Record<string, any>[];
  metadata: {
    executionTime: number;
    tripleCount: number;
    optimized: boolean;
  };
  warnings?: string[];
}
```

**Example Queries:**
```sparql
-- SELECT query
SELECT ?person ?name ?email
WHERE {
  ?person a ex:Person ;
    ex:name ?name ;
    ex:email ?email .
  FILTER(STRLEN(?name) > 3)
}
ORDER BY ?name
LIMIT 100

-- CONSTRUCT query  
CONSTRUCT {
  ?person a foaf:Person ;
    foaf:name ?name ;
    foaf:mbox ?email .
}
WHERE {
  ?person a ex:Person ;
    ex:name ?name ;
    ex:email ?email .
}

-- ASK query
ASK {
  ?person a ex:Person ;
    ex:admin true .
}

-- DESCRIBE query
DESCRIBE ?person
WHERE {
  ?person ex:role "admin" .
}
```

#### Federated Queries
Query across multiple SPARQL endpoints.

```typescript
interface FederatedQueryEngine extends SPARQLQueryEngine {
  addEndpoint(name: string, url: string, options?: EndpointOptions): void;
  executeFederatedQuery(query: string, options?: FederatedOptions): Promise<QueryResult>;
}

interface EndpointOptions {
  timeout?: number;
  authentication?: {
    type: 'basic' | 'bearer' | 'api-key';
    credentials: string | { username: string; password: string };
  };
  headers?: Record<string, string>;
  retries?: number;
}
```

**Federated Query Example:**
```sparql
SELECT ?person ?dbpediaInfo ?wikidataId
WHERE {
  # Local data
  ?person a ex:Person ;
    ex:name ?name .
  
  # DBpedia lookup
  SERVICE <https://dbpedia.org/sparql> {
    ?dbpediaPerson rdfs:label ?name@en ;
      dbo:abstract ?dbpediaInfo .
    FILTER(STRLEN(?dbpediaInfo) > 100)
  }
  
  # Wikidata lookup  
  SERVICE <https://query.wikidata.org/sparql> {
    ?wikidataPerson rdfs:label ?name@en ;
      wdt:P31 wd:Q5 ; # instance of human
      wdt:P214 ?wikidataId .
  }
}
```

### Query Optimization

#### Automatic Optimization
```typescript
interface QueryOptimizer {
  optimizeQuery(query: string, statistics?: DatasetStatistics): OptimizedQuery;
  explainQuery(query: string): QueryPlan;
  analyzePerformance(query: string, result: QueryResult): PerformanceAnalysis;
}

interface OptimizedQuery {
  query: string;
  optimizations: string[];
  estimatedImprovement: number; // percentage
}

interface QueryPlan {
  steps: QueryStep[];
  estimatedCost: number;
  joinOrder: string[];
  indexUsage: string[];
}
```

**CLI Usage:**
```bash
# Execute optimized query
unjucks semantic query \
  --sparql "SELECT ?s ?p ?o WHERE { ?s ?p ?o }" \
  --knowledge data.ttl \
  --optimization aggressive \
  --reasoning

# Query with performance analysis
unjucks semantic query \
  --pattern "?person,foaf:name,?name" \
  --knowledge people.ttl \
  --format table \
  --explain
```

## Semantic Validation

### Ontology Validation

#### Comprehensive Validation
```typescript
interface SemanticValidator {
  validateOntology(
    ontologyPath: string,
    options?: ValidationOptions
  ): Promise<ValidationResult>;
  
  validateData(
    dataPath: string,
    schemaPath: string,
    options?: ValidationOptions
  ): Promise<ValidationResult>;
  
  validateCompliance(
    dataPath: string,
    frameworks: ComplianceFramework[],
    options?: ValidationOptions
  ): Promise<ComplianceResult>;
}

interface ValidationOptions {
  strictMode?: boolean; // default: false
  maxErrors?: number; // default: 100
  timeout?: number; // default: 30000ms
  enableInference?: boolean; // default: false
  reportLevel?: 'error' | 'warning' | 'info'; // default: 'warning'
}

interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  info: ValidationInfo[];
  metrics: {
    triplesValidated: number;
    executionTime: number;
    memoryUsage: number;
  };
  score?: number; // 0-100 quality score
}

interface ValidationError {
  code: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
  location?: {
    line?: number;
    column?: number;
    triple?: string;
  };
  suggestion?: string;
}
```

#### SHACL Validation
```turtle
# SHACL shapes for validation
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix ex: <https://example.org/> .

ex:PersonShape
  a sh:NodeShape ;
  sh:targetClass ex:Person ;
  sh:property [
    sh:path ex:name ;
    sh:datatype xsd:string ;
    sh:minCount 1 ;
    sh:maxCount 1 ;
    sh:minLength 1 ;
    sh:maxLength 100 ;
  ] ;
  sh:property [
    sh:path ex:email ;
    sh:datatype xsd:string ;
    sh:pattern "^[\\w\\.-]+@[\\w\\.-]+\\.[a-zA-Z]{2,}$" ;
    sh:maxCount 1 ;
  ] ;
  sh:property [
    sh:path ex:age ;
    sh:datatype xsd:integer ;
    sh:minInclusive 0 ;
    sh:maxInclusive 150 ;
    sh:maxCount 1 ;
  ] .
```

**CLI Usage:**
```bash
# Basic validation
unjucks semantic validate --rdf data.ttl --ontology schema.owl

# Strict compliance validation
unjucks semantic validate \
  --rdf patient-data.ttl \
  --compliance HIPAA,GDPR \
  --strict \
  --format json

# Custom schema validation
unjucks semantic validate \
  --rdf user-data.ttl \
  --schema user-shapes.ttl \
  --format summary
```

### Compliance Frameworks

#### GDPR Compliance
```typescript
interface GDPRValidator {
  validatePersonalData(dataset: RDFDataset): GDPRValidationResult;
  checkDataRetention(dataset: RDFDataset, retentionPolicies: RetentionPolicy[]): ComplianceResult;
  validateConsent(dataset: RDFDataset): ConsentValidationResult;
}

interface GDPRValidationResult {
  personalDataFound: PersonalDataItem[];
  consentRequired: boolean;
  retentionPeriod: number; // days
  recommendations: string[];
}
```

#### HIPAA Compliance
```typescript
interface HIPAAValidator {
  validatePHI(dataset: RDFDataset): PHIValidationResult;
  checkAccessControls(dataset: RDFDataset): AccessControlResult;
  validateAuditTrail(dataset: RDFDataset): AuditResult;
}
```

#### SOX Compliance
```typescript
interface SOXValidator {
  validateFinancialData(dataset: RDFDataset): FinancialValidationResult;
  checkChangeManagement(dataset: RDFDataset): ChangeManagementResult;
  validateEvidenceRetention(dataset: RDFDataset): EvidenceResult;
}
```

## Reasoning and Inference

### Rule-based Reasoning

#### N3 Rules Engine
```typescript
interface N3ReasoningEngine {
  applyRules(
    premises: RDFDataset,
    rules: N3Rule[],
    options?: ReasoningOptions
  ): Promise<InferenceResult>;
  
  explainInference(
    conclusion: Triple,
    premises: RDFDataset,
    rules: N3Rule[]
  ): Promise<ExplanationResult>;
}

interface ReasoningOptions {
  maxDepth?: number; // default: 10
  maxInferences?: number; // default: 10000
  strategy?: 'forward' | 'backward' | 'hybrid'; // default: 'forward'
  timeout?: number; // default: 60000ms
  enableExplanation?: boolean; // default: false
}

interface InferenceResult {
  inferences: Triple[];
  metadata: {
    rulesApplied: number;
    inferenceSteps: number;
    executionTime: number;
  };
  explanations?: ExplanationPath[];
}
```

**N3 Rules Examples:**
```n3
# Rule: If someone knows someone, the relationship is symmetric
{ ?person ex:knows ?friend } => { ?friend ex:knows ?person } .

# Rule: Transitive closure for organizational hierarchy
{ ?person ex:reportsTo ?manager . ?manager ex:reportsTo ?senior } 
=> 
{ ?person ex:indirectlyReportsTo ?senior } .

# Rule: Infer person type from email domain
{ ?person ex:email ?email . ?email string:matches ".*@company\\.com" } 
=> 
{ ?person a ex:Employee } .

# Rule: Data privacy classification
{ ?data ex:contains ?field . ?field a ex:PersonalData } 
=> 
{ ?data ex:classification ex:Confidential } .
```

**CLI Usage:**
```bash
# Apply reasoning rules
unjucks semantic reason \
  --variables vars.json \
  --rules privacy-rules.n3,business-rules.n3 \
  --mode forward \
  --depth 5 \
  --output enhanced-vars.json

# Explain inference
unjucks semantic reason \
  --variables data.json \
  --rules inference-rules.n3 \
  --explain \
  --output explanation.json
```

### OWL Reasoning

#### Description Logic Reasoning
```typescript
interface OWLReasoner {
  classify(ontology: OWLOntology): Promise<ClassificationResult>;
  checkConsistency(ontology: OWLOntology): Promise<ConsistencyResult>;
  computeInferences(ontology: OWLOntology, expressivity: OWLExpressivity): Promise<InferenceResult>;
}

interface OWLExpressivity {
  level: 'EL' | 'QL' | 'RL' | 'DL' | 'Full';
  features: {
    nominals?: boolean;
    inverseRoles?: boolean;
    transitiveRoles?: boolean;
    roleHierarchy?: boolean;
    dataTypes?: boolean;
  };
}
```

**OWL Ontology Example:**
```turtle
# OWL class hierarchy
ex:Person a owl:Class .
ex:Employee a owl:Class ;
  rdfs:subClassOf ex:Person .
ex:Manager a owl:Class ;
  rdfs:subClassOf ex:Employee .

# Property definitions
ex:manages a owl:ObjectProperty ;
  rdfs:domain ex:Manager ;
  rdfs:range ex:Employee .

ex:salary a owl:DatatypeProperty ;
  rdfs:domain ex:Employee ;
  rdfs:range xsd:decimal .

# Restrictions
ex:Manager rdfs:subClassOf [
  a owl:Restriction ;
  owl:onProperty ex:manages ;
  owl:minCardinality 1
] .

# Equivalence
ex:Boss owl:equivalentClass ex:Manager .
```

## Advanced Features

### Knowledge Graph Analytics

#### Graph Statistics
```typescript
interface KnowledgeGraphAnalytics {
  computeStatistics(dataset: RDFDataset): GraphStatistics;
  findCommunities(dataset: RDFDataset): Community[];
  analyzeCentrality(dataset: RDFDataset): CentralityMetrics;
  detectAnomalies(dataset: RDFDataset): Anomaly[];
}

interface GraphStatistics {
  tripleCount: number;
  subjectCount: number;
  predicateCount: number;
  objectCount: number;
  classCount: number;
  propertyCount: number;
  avgDegree: number;
  density: number;
  diamter: number;
  clusteringCoefficient: number;
}
```

### Performance Optimization

#### Indexing Strategies
```typescript
interface RDFIndexManager {
  createIndex(
    dataset: RDFDataset,
    strategy: IndexStrategy
  ): Promise<RDFIndex>;
  
  optimizeQueries(
    queries: string[],
    index: RDFIndex
  ): QueryOptimization[];
}

type IndexStrategy = 
  | 'SPO'    // Subject-Predicate-Object
  | 'PSO'    // Predicate-Subject-Object  
  | 'OSP'    // Object-Subject-Predicate
  | 'SPOG'   // Subject-Predicate-Object-Graph
  | 'FULL';  // All permutations
```

#### Caching
```typescript
interface SemanticCache {
  cacheQuery(query: string, result: QueryResult, ttl?: number): void;
  cacheInference(rules: N3Rule[], premises: string, result: InferenceResult): void;
  invalidatePattern(pattern: string): void;
  getStatistics(): CacheStatistics;
}
```

### Data Quality Assessment

#### Quality Metrics
```typescript
interface DataQualityAssessment {
  assessCompleteness(dataset: RDFDataset, schema?: RDFDataset): CompletenessReport;
  assessConsistency(dataset: RDFDataset): ConsistencyReport;
  assessAccuracy(dataset: RDFDataset, goldStandard?: RDFDataset): AccuracyReport;
  generateQualityReport(dataset: RDFDataset): QualityReport;
}

interface QualityReport {
  overallScore: number; // 0-100
  completeness: number;
  consistency: number;
  accuracy: number;
  recommendations: QualityRecommendation[];
  metrics: {
    duplicateTriples: number;
    malformedURIs: number;
    missingLabels: number;
    orphanedResources: number;
  };
}
```

## Integration Examples

### Template Generation with Semantic Data
```yaml
# Template frontmatter with semantic processing
---
to: src/models/<%= className %>.ts
rdf:
  type: file
  source: ./ontologies/business-model.ttl
rdfQuery:
  subject: "?class"
  predicate: "rdf:type" 
  object: "owl:Class"
  limit: 50
semanticValidation:
  enabled: true
  ontologies: ["./ontologies/core.owl"]
  strictMode: false
  complianceFrameworks: ["GDPR", "HIPAA"]
variableEnhancement:
  semanticMapping: true
  typeInference: true
  ontologyContext: ["./ontologies/core.owl", "./ontologies/business.owl"]
---

// Generated TypeScript model from semantic data
export interface <%= className %> {
<% if (semanticProperties) { %>
  <% semanticProperties.forEach(prop => { %>
  <%= prop.name %><%= prop.required ? '' : '?' %>: <%= prop.tsType %>;
  <% }) %>
<% } %>
}

// Validation schema from ontology constraints  
export const <%= className %>Schema = z.object({
<% if (semanticProperties) { %>
  <% semanticProperties.forEach(prop => { %>
  <%= prop.name %>: <%= prop.zodSchema %><%= prop.required ? '' : '.optional()' %>,
  <% }) %>
<% } %>
});
```

### Workflow Integration
```bash
# Complete semantic workflow
unjucks semantic orchestrate --workflow semantic-workflow.json --parallel

# semantic-workflow.json
{
  "name": "Enterprise Data Processing",
  "steps": [
    {
      "name": "validate-ontology",
      "type": "validate", 
      "params": {
        "templatePath": "schema.owl",
        "compliance": ["GDPR", "SOX"],
        "strictMode": true
      }
    },
    {
      "name": "apply-reasoning",
      "type": "reason",
      "params": {
        "rules": ["business-rules.n3"],
        "mode": "forward",
        "depth": 3
      }
    },
    {
      "name": "generate-types",
      "type": "generate",
      "params": {
        "ontologyPaths": ["schema.owl"],
        "outputDir": "./generated",
        "generateTypes": true,
        "generateSchemas": true,
        "generateValidators": true
      }
    }
  ]
}
```

This comprehensive Semantic Web API enables enterprise-scale knowledge processing with full compliance support and advanced reasoning capabilities.