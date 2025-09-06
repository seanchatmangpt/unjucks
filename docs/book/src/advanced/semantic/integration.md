# Semantic Web Integration

## Overview

Unjucks provides comprehensive semantic web integration through N3.js reasoning engine, enabling intelligent template generation from RDF/Turtle data sources. This integration transforms static template systems into knowledge-aware code generators that understand domain semantics, business rules, and compliance requirements.

## Architecture

### Core Components

```typescript
// Semantic processing pipeline
RDF Data Sources → N3.js Parser → Knowledge Graph → Query Engine → Template Context
      ↓               ↓               ↓               ↓               ↓
   HTTP/File      Turtle/N3      In-Memory Store   SPARQL-like     Nunjucks Variables
   Caching        Validation     Index-based       Filtering       Dynamic CLI Args
```

### N3.js Reasoning Engine Integration

```typescript
import { Store, Parser, Writer, Reasoner } from 'n3';

class SemanticTemplateEngine {
  private store: Store = new Store();
  private reasoner: Reasoner = new Reasoner();
  
  async processSemanticData(source: RDFDataSource): Promise<SemanticContext> {
    // 1. Parse RDF data
    const parser = new Parser();
    const quads = parser.parse(await this.loadSource(source));
    
    // 2. Add to knowledge graph
    this.store.addQuads(quads);
    
    // 3. Apply reasoning rules
    const inferences = await this.reasoner.reason(this.store);
    this.store.addQuads(inferences);
    
    // 4. Generate template context
    return this.createTemplateContext();
  }
}
```

## RDF Data Integration

### Multi-Source Data Loading

#### HTTP Sources with Caching
```yaml
# Template frontmatter
---
to: "services/{{ serviceName }}.ts"
rdf:
  - type: uri
    source: "https://ontology.company.com/services.ttl"
    cache_ttl: 3600
  - type: uri 
    source: "https://compliance.company.com/sox.ttl"
    cache_ttl: 86400
rdfQuery: "?service rdf:type company:Service"
---
```

**Features:**
- **HTTP Caching**: ETags, Last-Modified headers, conditional requests
- **Multi-level TTL**: File-level, query-level, context-level caching
- **Error Recovery**: Graceful fallbacks for network failures
- **Performance**: Sub-100ms cache hits, ~1s cold loads

#### File-based Sources
```yaml
rdf:
  - type: file
    source: "./ontologies/business-rules.ttl"
  - type: file
    source: "./schemas/enterprise-model.n3"
    format: "n3"
```

### Data Validation and Quality

```typescript
// Semantic validation pipeline
class RDFValidator {
  validateOntology(source: string): ValidationResult {
    return {
      syntaxErrors: this.checkSyntax(source),
      consistencyErrors: this.checkConsistency(source),
      completenessScore: this.assessCompleteness(source),
      qualityMetrics: this.calculateQuality(source)
    };
  }
}
```

## Knowledge Graph Construction

### Ontology Management

#### Enterprise Ontology Structure
```turtle
@prefix company: <http://company.com/ontology/> .
@prefix fhir: <http://hl7.org/fhir/> .
@prefix fibo: <https://spec.edmcouncil.org/fibo/ontology/> .

# Multi-domain integration
company:Service a rdfs:Class ;
    rdfs:subClassOf fhir:Resource ;  # Healthcare compliance
    company:requiresCompliance fibo:RegulatoryRequirement ;  # Financial compliance
    company:hasCapability company:Capability .
```

#### Dynamic Schema Evolution
```typescript
class OntologyManager {
  async updateOntology(changes: OntologyChange[]): Promise<void> {
    // 1. Validate changes
    const validation = await this.validateChanges(changes);
    
    // 2. Apply incremental updates
    for (const change of changes) {
      await this.applyChange(change);
    }
    
    // 3. Recompute inferences
    await this.recomputeInferences();
    
    // 4. Notify dependent templates
    await this.notifyTemplateUpdates(changes.affectedResources);
  }
}
```

### Reasoning Capabilities

#### Business Rule Processing
```turtle
# N3 reasoning rules for business logic
{
  ?service company:hasComplexity ?complexity .
  ?complexity math:greaterThan 8 .
} => {
  ?service company:requiresArchitectReview true .
} .

{
  ?service company:handlesPersonalData true .
  ?service company:operatesInEU true .
} => {
  ?service company:requiresGDPRCompliance true .
} .
```

#### Template Integration
```nunjucks
{# Template with semantic reasoning #}
{% if service | rdfExists('company:requiresArchitectReview') %}
// ARCHITECTURE REVIEW REQUIRED
// Complexity: {{ service | rdfObject('company:hasComplexity') | first.value }}
export interface ArchitectureReviewMetadata {
  reviewRequired: true;
  complexity: {{ service | rdfObject('company:hasComplexity') | first.value }};
  reviewer: '{{ service | rdfObject('company:assignedReviewer') | first.value }}';
}
{% endif %}
```

## SPARQL-like Querying

### Query Engine Architecture

```typescript
interface SemanticQuery {
  pattern: TriplePattern;
  filters?: FilterExpression[];
  orderBy?: SortExpression;
  limit?: number;
  groupBy?: GroupExpression;
}

class SemanticQueryEngine {
  // Optimized query processing
  async executeQuery(query: SemanticQuery): Promise<QueryResult[]> {
    // 1. Query optimization
    const optimized = this.optimizeQuery(query);
    
    // 2. Index-based execution
    const intermediate = await this.executePatterns(optimized.patterns);
    
    // 3. Apply filters and transformations
    return this.applyPostProcessing(intermediate, optimized);
  }
}
```

### Advanced Query Patterns

#### Federated Queries
```typescript
// Query across multiple knowledge graphs
const federatedQuery = await rdf.federatedQuery([
  {
    source: 'https://hr.company.com/employees.ttl',
    pattern: '?employee company:hasRole ?role'
  },
  {
    source: 'https://projects.company.com/assignments.ttl', 
    pattern: '?employee company:assignedTo ?project'
  }
]);
```

#### Complex Pattern Matching
```typescript
// Multi-step reasoning queries
const complexQuery = await rdf.query({
  pattern: `
    ?project company:hasService ?service .
    ?service company:hasComplexity ?complexity .
    ?service company:requiresSkill ?skill .
    ?employee company:hasSkill ?skill .
    ?employee company:availableFor ?project .
  `,
  filters: [
    '?complexity > 7',
    '?employee company:seniorityLevel >= 5'
  ]
});
```

## Template Generation Pipeline

### Context Enrichment

```typescript
class SemanticContextBuilder {
  async buildContext(rdfData: RDFData, query: string): Promise<TemplateContext> {
    return {
      // Raw query results
      results: await this.executeQuery(query),
      
      // Inferred knowledge
      inferences: await this.applyReasoning(rdfData),
      
      // Validation results
      validation: await this.validateConstraints(rdfData),
      
      // Performance metadata
      metrics: this.collectMetrics(),
      
      // Dynamic variables
      variables: await this.extractVariables(rdfData)
    };
  }
}
```

### Real-time Template Updates

```typescript
// Live template regeneration on ontology changes
class LiveTemplateUpdater {
  private watcher: OntologyWatcher;
  
  async startWatching(ontologyPath: string): Promise<void> {
    this.watcher.on('change', async (change) => {
      // 1. Identify affected templates
      const affectedTemplates = await this.findDependentTemplates(change);
      
      // 2. Regenerate templates
      for (const template of affectedTemplates) {
        await this.regenerateTemplate(template);
      }
      
      // 3. Validate generated code
      await this.validateGeneratedCode(affectedTemplates);
    });
  }
}
```

## Performance Optimization

### Caching Strategies

#### Multi-Level Cache Architecture
```typescript
interface CacheStrategy {
  L1: MemoryCache;      // <1ms access time
  L2: RedisCache;       // ~1ms access time  
  L3: FileSystemCache;  // ~10ms access time
}

class SemanticCache implements CacheStrategy {
  async get(key: string): Promise<CachedData | null> {
    return (await this.L1.get(key)) ||
           (await this.L2.get(key)) ||
           (await this.L3.get(key));
  }
}
```

#### Intelligent Cache Invalidation
```typescript
class SmartCacheInvalidation {
  // Dependency-aware cache invalidation
  async invalidate(changedResource: string): Promise<void> {
    const dependents = await this.findDependencies(changedResource);
    
    for (const dependent of dependents) {
      await this.cache.remove(dependent);
      await this.scheduleRegeneration(dependent);
    }
  }
}
```

### Query Optimization

#### Index-based Query Execution
```typescript
class IndexedQueryEngine {
  private indexes = {
    bySubject: new Map<string, Quad[]>(),
    byPredicate: new Map<string, Quad[]>(),
    byObject: new Map<string, Quad[]>(),
    composite: new Map<string, Quad[]>()  // Multi-field indexes
  };
  
  // O(1) lookups for indexed patterns
  executeIndexedQuery(pattern: TriplePattern): Quad[] {
    const index = this.selectOptimalIndex(pattern);
    return index.get(this.buildIndexKey(pattern)) || [];
  }
}
```

## Enterprise Integration Patterns

### Compliance Automation

```yaml
# GDPR-compliant service generation
---
to: "services/{{ serviceName }}/gdpr-compliance.ts"
rdf: "./ontologies/gdpr-requirements.ttl"
rdfQuery: "?service company:processesPersonalData true"
skipIf: "{{ service | rdfExists('company:gdprExempt') }}"
---
/**
 * GDPR Compliance for {{ serviceName }}
 * Data Categories: {{ service | rdfObject('gdpr:dataCategories') | map('rdfLabel') | join(', ') }}
 * Legal Basis: {{ service | rdfObject('gdpr:legalBasis') | first | rdfLabel }}
 */

export class {{ serviceName }}GDPRCompliance {
  // Auto-generated from GDPR ontology
  private readonly retentionPeriod = {{ service | rdfObject('gdpr:retentionPeriod') | first.value }}; // days
  private readonly encryptionRequired = {{ service | rdfObject('gdpr:encryptionRequired') | first.value }};
  
  {% if service | rdfExists('gdpr:rightToErasure') %}
  async erasePersonalData(subjectId: string): Promise<void> {
    // Implementation required by GDPR Article 17
  }
  {% endif %}
  
  {% if service | rdfExists('gdpr:rightToPortability') %}  
  async exportPersonalData(subjectId: string): Promise<PersonalDataExport> {
    // Implementation required by GDPR Article 20
  }
  {% endif %}
}
```

### Multi-Tenant Configuration

```typescript
// Tenant-specific template generation
class MultiTenantSemanticEngine {
  async generateForTenant(tenantId: string, template: string): Promise<string> {
    // 1. Load tenant-specific ontology
    const tenantOntology = await this.loadTenantOntology(tenantId);
    
    // 2. Apply tenant-specific reasoning
    const context = await this.buildTenantContext(tenantOntology);
    
    // 3. Generate tenant-specific code
    return this.renderTemplate(template, context);
  }
}
```

## Real-World Use Cases

### Healthcare Interoperability (FHIR)

```yaml
---
to: "fhir/resources/{{ resourceType }}.ts"
rdf: "https://hl7.org/fhir/R4/{{ resourceType | lower }}.ttl"
rdfQuery: "?resource rdf:type fhir:{{ resourceType }}"
---
/**
 * HL7 FHIR {{ resourceType }} Resource
 * Profile: {{ resource | rdfObject('fhir:profile') | first.value }}
 * Compliance: HL7 FHIR R4
 */
export interface {{ resourceType }}Resource {
  resourceType: '{{ resourceType }}';
  
  // Required elements (cardinality 1..*)
  {% for required in resource | rdfObject('fhir:required') %}
  {{ required | rdfLabel | camelCase }}: {{ required | rdfObject('fhir:dataType') | first.value | toFHIRType }};
  {% endfor %}
  
  // Optional elements (cardinality 0..*)
  {% for optional in resource | rdfObject('fhir:optional') %}
  {{ optional | rdfLabel | camelCase }}?: {{ optional | rdfObject('fhir:dataType') | first.value | toFHIRType }};
  {% endfor %}
}
```

### Financial Compliance (FIBO)

```yaml
---
to: "financial/{{ instrumentType | slugify }}.ts"
rdf: "https://spec.edmcouncil.org/fibo/ontology/SEC/{{ instrumentType }}.ttl"
rdfQuery: "?instrument rdf:type fibo:{{ instrumentType }}"
---
/**
 * FIBO-compliant {{ instrumentType }} Implementation  
 * Regulation: {{ instrument | rdfObject('fibo:regulatedBy') | first | rdfLabel }}
 * Risk Weight: {{ instrument | rdfObject('fibo:riskWeight') | first.value }}%
 */
export class {{ instrumentType }}Instrument {
  // Basel III capital calculation (auto-generated from FIBO)
  calculateCapitalRequirement(exposure: number): CapitalResult {
    const riskWeight = {{ instrument | rdfObject('fibo:riskWeight') | first.value }};
    const riskWeightedAssets = exposure * (riskWeight / 100);
    
    return {
      riskWeightedAssets,
      minimumCapital: riskWeightedAssets * 0.08, // 8% Basel III requirement
      tier1Capital: riskWeightedAssets * 0.06    // 6% Tier 1 requirement
    };
  }
}
```

## Monitoring and Analytics

### Semantic Processing Metrics

```typescript
interface SemanticMetrics {
  // Processing performance
  parseTimeMs: number;
  inferenceTimeMs: number;
  queryTimeMs: number;
  
  // Data quality
  tripleCount: number;
  inferenceCount: number;
  consistencyScore: number;
  
  // Template generation
  templatesGenerated: number;
  variablesExtracted: number;
  cacheHitRatio: number;
}

class SemanticMonitor {
  collectMetrics(): SemanticMetrics {
    return {
      parseTimeMs: this.measureParsingTime(),
      inferenceTimeMs: this.measureInferenceTime(), 
      queryTimeMs: this.measureQueryTime(),
      tripleCount: this.store.size,
      inferenceCount: this.reasoner.inferences.length,
      consistencyScore: this.validator.checkConsistency(),
      templatesGenerated: this.templateCount,
      variablesExtracted: this.variableCount,
      cacheHitRatio: this.cache.hitRatio
    };
  }
}
```

This comprehensive semantic web integration enables Unjucks to generate intelligent, compliance-aware, and domain-specific code from rich ontological knowledge, transforming template generation into a semantic-aware process that understands business context, regulatory requirements, and domain expertise.