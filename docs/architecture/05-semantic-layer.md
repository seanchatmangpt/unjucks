# Semantic Layer Architecture

## Overview

The semantic layer in Unjucks provides advanced RDF/Turtle data processing capabilities using N3.js, enabling ontology-aware template generation, compliance validation, and knowledge-driven code generation. This layer transforms traditional template scaffolding into an intelligent system that understands domain semantics and regulatory requirements.

## Core Architecture

```
┌────────────────────────────────────────────────────────────────────────────┐
│                          Semantic Layer Architecture                         │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  Template Context                  Semantic Processing                      │
│  ┌─────────────────┐             ┌────────────────────────────┐      │
│  │ Frontmatter      │  MCP        │ RDF Data Processing        │      │
│  │ • RDF Config     │ ◄─────────► │ • Turtle Parser (N3.js)    │      │
│  │ • Data Sources   │             │ • Multi-source Loading      │      │
│  │ • Validation    │             │ • SPARQL-like Queries       │      │
│  └────────┬─────────┘             └─────────────┬───────────────┘      │
│           │                                      │                      │
│           ▼                                      ▼                      │
│  ┌─────────────────┐             ┌─────────────────┘             ┌─────────────────┐  │
│  │ Ontology Cache  │             │ Query Engine    │             │ Semantic Filter │  │
│  │ • Schema.org    │ ◄───────────► │ • Triple Match   │ ◄───────────► │ • SPARQL       │  │
│  │ • FHIR         │             │ • Path Traversal │             │ • Ontology Map │  │
│  │ • FIBO         │             │ • Aggregation    │             │ • Compliance   │  │
│  └────────┬─────────┘             └────────┬─────────┘             └────────┬─────────┘  │
│           │                              │                              │           │
│           ▼                              ▼                              ▼           │
│  ┌────────────────────────────────────────────────────────────────────────────┐  │
│  │                        Validation and Compliance Engine                     │  │
│  │  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐  │  │
│  │  │ GDPR Validator │  │ HIPAA Validator│  │ Custom Rules   │  │  │
│  │  │ • Data Rights   │  │ • PHI Handling  │  │ • Domain Logic │  │  │
│  │  │ • Consent Mgmt  │  │ • Access Logs   │  │ • Quality Gates│  │  │
│  │  └────────────────┘  └────────────────┘  └────────────────┘  │  │
│  └────────────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

## N3.js Integration

### Turtle Parser Implementation

The semantic layer leverages N3.js for robust RDF/Turtle parsing with performance optimizations:

```typescript
interface TurtleParseResult {
  triples: ParsedTriple[];
  prefixes: NamespacePrefixes;
  stats: ParseStats;
  namedGraphs?: string[];
}

class TurtleParser {
  private options: TurtleParseOptions;
  private parser: N3.Parser;
  
  constructor(options: TurtleParseOptions = {}) {
    this.options = {
      baseIRI: options.baseIRI || "http://example.org/",
      format: options.format || "text/turtle",
      blankNodePrefix: options.blankNodePrefix || "_:",
      ...options,
    };
    
    this.parser = new N3.Parser(this.options);
  }
  
  async parse(content: string): Promise<TurtleParseResult> {
    const startTime = Date.now();
    const triples: ParsedTriple[] = [];
    const prefixes: NamespacePrefixes = {};
    
    try {
      const quads = this.parser.parse(content);
      
      for (const quad of quads) {
        triples.push(this.convertQuadToTriple(quad));
      }
      
      // Extract prefixes from content
      const prefixMatches = content.match(/@prefix\s+(\w*):?\s*<([^>]+)>/g);
      if (prefixMatches) {
        for (const match of prefixMatches) {
          const prefixMatch = match.match(/@prefix\s+(\w*):?\s*<([^>]+)>/);
          if (prefixMatch) {
            const [, prefix, uri] = prefixMatch;
            prefixes[prefix || ""] = uri;
          }
        }
      }
      
      const parseTime = Date.now() - startTime;
      
      return {
        triples,
        prefixes,
        stats: {
          tripleCount: triples.length,
          prefixCount: Object.keys(prefixes).length,
          subjectCount: new Set(triples.map(t => t.subject.value)).size,
          predicateCount: new Set(triples.map(t => t.predicate.value)).size,
          parseTime,
        },
        namedGraphs: [],
      };
    } catch (error) {
      throw new TurtleParseError(
        `Parse error: ${error.message}`,
        undefined,
        undefined,
        error
      );
    }
  }
}
```

### RDF Store Operations

Integration with N3.js Store for efficient querying and data manipulation:

```typescript
class SemanticStore {
  private store: N3.Store;
  private queryEngine: QueryEngine;
  
  constructor() {
    this.store = new N3.Store();
    this.queryEngine = new QueryEngine(this.store);
  }
  
  async loadFromSource(source: RDFDataSource): Promise<void> {
    const parser = new TurtleParser(source.options);
    const result = await parser.parse(source.content);
    
    // Convert triples to N3 quads and add to store
    const quads = result.triples.map(triple => {
      const subject = this.createTerm(triple.subject);
      const predicate = this.createTerm(triple.predicate);
      const object = this.createTerm(triple.object);
      
      return N3.quad(subject, predicate, object);
    });
    
    this.store.addQuads(quads);
  }
  
  query(pattern: TriplePattern): ParsedTriple[] {
    const matches = this.store.getQuads(
      pattern.subject ? this.createTerm(pattern.subject) : null,
      pattern.predicate ? this.createTerm(pattern.predicate) : null,
      pattern.object ? this.createTerm(pattern.object) : null
    );
    
    return matches.map(quad => this.convertQuadToTriple(quad));
  }
  
  sparqlQuery(queryString: string): Promise<QueryResult[]> {
    return this.queryEngine.execute(queryString);
  }
}
```

## Data Sources and Loading

### Multi-Source Data Loader

```typescript
class RDFDataLoader {
  private cache = new Map<string, CacheEntry>();
  private parser: TurtleParser;
  
  async loadFromSource(source: RDFDataSource): Promise<TurtleParseResult> {
    const cacheKey = this.generateCacheKey(source);
    
    // Check cache first
    const cachedEntry = this.cache.get(cacheKey);
    if (cachedEntry && !this.isExpired(cachedEntry)) {
      return cachedEntry.data;
    }
    
    // Load data based on source type
    let content: string;
    switch (source.type) {
      case 'file':
        content = await this.loadFromFile(source.path || source.source);
        break;
        
      case 'uri':
        content = await this.loadFromURI(source.uri || source.source);
        break;
        
      case 'inline':
        content = source.content || source.source;
        break;
        
      case 'sparql':
        content = await this.loadFromSparqlEndpoint(source);
        break;
        
      default:
        throw new Error(`Unsupported source type: ${source.type}`);
    }
    
    // Parse and cache
    const result = await this.parser.parse(content);
    this.cacheResult(cacheKey, result);
    
    return result;
  }
  
  private async loadFromSparqlEndpoint(source: RDFDataSource): Promise<string> {
    const response = await fetch(source.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/sparql-query',
        'Accept': 'text/turtle',
        ...source.headers
      },
      body: source.query
    });
    
    if (!response.ok) {
      throw new Error(`SPARQL query failed: ${response.status} ${response.statusText}`);
    }
    
    return response.text();
  }
}
```

### Template Context Integration

```typescript
class SemanticContextBuilder {
  createTemplateContext(data: TurtleParseResult): SemanticContext {
    const context: SemanticContext = {
      subjects: {},
      prefixes: data.prefixes,
      triples: data.triples,
      stats: data.stats,
      queries: {},
      mappings: {}
    };
    
    // Group triples by subject for easier template access
    for (const triple of data.triples) {
      const subjectUri = triple.subject.value;
      if (!context.subjects[subjectUri]) {
        context.subjects[subjectUri] = {
          uri: subjectUri,
          type: triple.subject.type,
          properties: {},
          relationships: {}
        };
      }
      
      const predicateUri = triple.predicate.value;
      const simplePredicate = this.simplifiyPredicateUri(predicateUri);
      
      // Handle object properties vs data properties
      if (triple.object.type === 'uri') {
        if (!context.subjects[subjectUri].relationships[simplePredicate]) {
          context.subjects[subjectUri].relationships[simplePredicate] = [];
        }
        context.subjects[subjectUri].relationships[simplePredicate].push({
          uri: triple.object.value,
          type: 'uri'
        });
      } else {
        if (!context.subjects[subjectUri].properties[simplePredicate]) {
          context.subjects[subjectUri].properties[simplePredicate] = [];
        }
        context.subjects[subjectUri].properties[simplePredicate].push({
          value: triple.object.value,
          datatype: triple.object.datatype,
          language: triple.object.language
        });
      }
    }
    
    return context;
  }
  
  private simplifiyPredicateUri(predicateUri: string): string {
    // Extract local name from URI
    const hashIndex = predicateUri.lastIndexOf('#');
    const slashIndex = predicateUri.lastIndexOf('/');
    const separatorIndex = Math.max(hashIndex, slashIndex);
    
    return separatorIndex !== -1 
      ? predicateUri.substring(separatorIndex + 1)
      : predicateUri;
  }
}
```

## Semantic Filters for Nunjucks

### SPARQL Query Filter

```typescript
class SparqlFilter {
  constructor(private store: SemanticStore) {}
  
  // Usage in template: {{ rdfData | sparql('SELECT ?name WHERE { ?s foaf:name ?name }') }}
  async filter(data: any, queryString: string): Promise<any[]> {
    try {
      const results = await this.store.sparqlQuery(queryString);
      return results.map(binding => {
        const result: any = {};
        for (const [variable, term] of binding) {
          result[variable] = this.termToValue(term);
        }
        return result;
      });
    } catch (error) {
      console.error('SPARQL query failed:', error);
      return [];
    }
  }
  
  private termToValue(term: N3.Term): any {
    if (term.termType === 'Literal') {
      const literal = term as N3.Literal;
      return this.convertLiteralValue(literal);
    }
    return term.value;
  }
}
```

### Ontology Mapping Filter

```typescript
class OntologyMappingFilter {
  constructor(private ontologyCache: OntologyCache) {}
  
  // Usage: {{ entity | ontologyMap('schema.org') }}
  async filter(entity: any, targetOntology: string): Promise<any> {
    const mappingRules = await this.ontologyCache.getMappingRules(
      entity.type,
      targetOntology
    );
    
    if (!mappingRules) {
      return entity; // No mapping available
    }
    
    const mappedEntity: any = { ...entity };
    
    // Apply property mappings
    for (const [sourceProperty, targetProperty] of Object.entries(mappingRules.propertyMappings)) {
      if (entity.properties[sourceProperty]) {
        mappedEntity.properties[targetProperty] = entity.properties[sourceProperty];
        if (mappingRules.removeSourceProperties) {
          delete mappedEntity.properties[sourceProperty];
        }
      }
    }
    
    // Apply type mapping
    if (mappingRules.typeMapping) {
      mappedEntity.type = mappingRules.typeMapping;
    }
    
    return mappedEntity;
  }
}
```

### Compliance Validation Filter

```typescript
class ComplianceFilter {
  constructor(private validators: Map<string, ComplianceValidator>) {}
  
  // Usage: {{ data | complianceCheck('GDPR') }}
  async filter(data: any, framework: string): Promise<ComplianceResult> {
    const validator = this.validators.get(framework);
    if (!validator) {
      throw new Error(`Unknown compliance framework: ${framework}`);
    }
    
    return await validator.validate(data);
  }
}
```

## Ontology Cache and Management

### Cache Implementation

```typescript
class OntologyCache {
  private cache = new Map<string, OntologyDefinition>();
  private mappingCache = new Map<string, MappingRules>();
  
  async loadOntology(ontologyUri: string): Promise<OntologyDefinition> {
    let ontology = this.cache.get(ontologyUri);
    
    if (!ontology) {
      ontology = await this.fetchOntology(ontologyUri);
      this.cache.set(ontologyUri, ontology);
    }
    
    return ontology;
  }
  
  async getMappingRules(sourceType: string, targetOntology: string): Promise<MappingRules | null> {
    const key = `${sourceType}->${targetOntology}`;
    let rules = this.mappingCache.get(key);
    
    if (!rules) {
      rules = await this.computeMappingRules(sourceType, targetOntology);
      if (rules) {
        this.mappingCache.set(key, rules);
      }
    }
    
    return rules;
  }
  
  private async fetchOntology(uri: string): Promise<OntologyDefinition> {
    const response = await fetch(uri, {
      headers: {
        'Accept': 'text/turtle, application/rdf+xml, application/ld+json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch ontology from ${uri}`);
    }
    
    const content = await response.text();
    const parser = new TurtleParser();
    const parseResult = await parser.parse(content);
    
    return this.buildOntologyDefinition(parseResult);
  }
  
  private buildOntologyDefinition(parseResult: TurtleParseResult): OntologyDefinition {
    const definition: OntologyDefinition = {
      classes: {},
      properties: {},
      individuals: {},
      prefixes: parseResult.prefixes
    };
    
    // Extract classes, properties, and individuals from triples
    for (const triple of parseResult.triples) {
      if (triple.predicate.value === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type') {
        const typeUri = triple.object.value;
        
        if (typeUri === 'http://www.w3.org/2002/07/owl#Class' || 
            typeUri === 'http://www.w3.org/2000/01/rdf-schema#Class') {
          definition.classes[triple.subject.value] = {
            uri: triple.subject.value,
            label: '',
            comment: '',
            properties: [],
            superClasses: []
          };
        }
        
        if (typeUri === 'http://www.w3.org/2002/07/owl#ObjectProperty' ||
            typeUri === 'http://www.w3.org/2002/07/owl#DatatypeProperty') {
          definition.properties[triple.subject.value] = {
            uri: triple.subject.value,
            type: typeUri === 'http://www.w3.org/2002/07/owl#ObjectProperty' ? 'object' : 'datatype',
            domain: [],
            range: [],
            label: '',
            comment: ''
          };
        }
      }
    }
    
    // Extract labels, comments, domains, ranges, etc.
    for (const triple of parseResult.triples) {
      const subjectUri = triple.subject.value;
      const predicateUri = triple.predicate.value;
      const objectValue = triple.object.value;
      
      if (definition.classes[subjectUri]) {
        if (predicateUri === 'http://www.w3.org/2000/01/rdf-schema#label') {
          definition.classes[subjectUri].label = objectValue;
        } else if (predicateUri === 'http://www.w3.org/2000/01/rdf-schema#comment') {
          definition.classes[subjectUri].comment = objectValue;
        } else if (predicateUri === 'http://www.w3.org/2000/01/rdf-schema#subClassOf') {
          definition.classes[subjectUri].superClasses.push(objectValue);
        }
      }
      
      if (definition.properties[subjectUri]) {
        if (predicateUri === 'http://www.w3.org/2000/01/rdf-schema#domain') {
          definition.properties[subjectUri].domain.push(objectValue);
        } else if (predicateUri === 'http://www.w3.org/2000/01/rdf-schema#range') {
          definition.properties[subjectUri].range.push(objectValue);
        }
      }
    }
    
    return definition;
  }
}
```

## Compliance Validation Framework

### GDPR Validator

```typescript
class GDPRValidator implements ComplianceValidator {
  async validate(data: any): Promise<ComplianceResult> {
    const violations: ComplianceViolation[] = [];
    const warnings: ComplianceWarning[] = [];
    
    // Check for personal data handling
    if (this.containsPersonalData(data)) {
      // Verify legal basis
      if (!this.hasLegalBasis(data)) {
        violations.push({
          rule: 'GDPR-6.1',
          description: 'Processing of personal data requires legal basis',
          severity: 'critical',
          dataPath: this.getPersonalDataPaths(data)
        });
      }
      
      // Check data minimization
      if (!this.isDataMinimal(data)) {
        warnings.push({
          rule: 'GDPR-5.1c',
          description: 'Personal data should be adequate, relevant, and limited to what is necessary',
          severity: 'warning',
          suggestions: ['Remove unnecessary personal data fields']
        });
      }
      
      // Verify retention policy
      if (!this.hasRetentionPolicy(data)) {
        violations.push({
          rule: 'GDPR-5.1e',
          description: 'Personal data must not be kept longer than necessary',
          severity: 'major',
          dataPath: this.getPersonalDataPaths(data)
        });
      }
    }
    
    return {
      framework: 'GDPR',
      compliant: violations.length === 0,
      violations,
      warnings,
      score: this.calculateComplianceScore(violations, warnings),
      recommendations: this.generateRecommendations(violations, warnings)
    };
  }
  
  private containsPersonalData(data: any): boolean {
    const personalDataPatterns = [
      /email/i,
      /phone/i,
      /address/i,
      /name/i,
      /birth/i,
      /ssn/i,
      /passport/i,
      /license/i
    ];
    
    return this.checkForPatterns(data, personalDataPatterns);
  }
  
  private checkForPatterns(obj: any, patterns: RegExp[]): boolean {
    if (typeof obj !== 'object' || obj === null) {
      return false;
    }
    
    for (const key in obj) {
      if (patterns.some(pattern => pattern.test(key))) {
        return true;
      }
      
      if (typeof obj[key] === 'object') {
        if (this.checkForPatterns(obj[key], patterns)) {
          return true;
        }
      }
    }
    
    return false;
  }
}
```

### FHIR Validator

```typescript
class FHIRValidator implements ComplianceValidator {
  private fhirStructureDefinitions: Map<string, FHIRStructureDefinition>;
  
  async validate(data: any): Promise<ComplianceResult> {
    const violations: ComplianceViolation[] = [];
    const warnings: ComplianceWarning[] = [];
    
    // Check resource type
    if (!data.resourceType) {
      violations.push({
        rule: 'FHIR-001',
        description: 'FHIR resources must have a resourceType',
        severity: 'critical',
        dataPath: 'root'
      });
      
      return {
        framework: 'FHIR',
        compliant: false,
        violations,
        warnings,
        score: 0,
        recommendations: ['Add resourceType field to the resource']
      };
    }
    
    // Validate against structure definition
    const structureDefinition = this.fhirStructureDefinitions.get(data.resourceType);
    if (structureDefinition) {
      this.validateAgainstStructure(data, structureDefinition, violations, warnings);
    }
    
    // Check cardinality constraints
    this.validateCardinality(data, violations);
    
    // Validate terminology bindings
    this.validateTerminology(data, warnings);
    
    return {
      framework: 'FHIR',
      compliant: violations.length === 0,
      violations,
      warnings,
      score: this.calculateComplianceScore(violations, warnings),
      recommendations: this.generateFHIRRecommendations(violations, warnings)
    };
  }
}
```

## Query Engine Implementation

### SPARQL-like Query Processing

```typescript
class QueryEngine {
  constructor(private store: N3.Store) {}
  
  executeQuery(queryString: string): QueryResult[] {
    const query = this.parseQuery(queryString);
    
    switch (query.type) {
      case 'SELECT':
        return this.executeSelectQuery(query as SelectQuery);
      case 'CONSTRUCT':
        return this.executeConstructQuery(query as ConstructQuery);
      case 'ASK':
        return this.executeAskQuery(query as AskQuery);
      default:
        throw new Error(`Unsupported query type: ${query.type}`);
    }
  }
  
  private executeSelectQuery(query: SelectQuery): QueryResult[] {
    const bindings: Map<string, N3.Term>[] = [];
    
    // Simple implementation for basic triple patterns
    for (const pattern of query.patterns) {
      const matches = this.store.getQuads(
        this.resolveVariable(pattern.subject, new Map()),
        this.resolveVariable(pattern.predicate, new Map()),
        this.resolveVariable(pattern.object, new Map())
      );
      
      for (const match of matches) {
        const binding = new Map<string, N3.Term>();
        
        if (this.isVariable(pattern.subject)) {
          binding.set(pattern.subject.substring(1), match.subject);
        }
        if (this.isVariable(pattern.predicate)) {
          binding.set(pattern.predicate.substring(1), match.predicate);
        }
        if (this.isVariable(pattern.object)) {
          binding.set(pattern.object.substring(1), match.object);
        }
        
        bindings.push(binding);
      }
    }
    
    return bindings;
  }
  
  private isVariable(term: string): boolean {
    return term.startsWith('?') || term.startsWith('$');
  }
}
```

## Performance Optimizations

### Streaming Processing

```typescript
class StreamingSemanticProcessor {
  async processLargeDataset(sourceStream: ReadableStream): Promise<void> {
    const parser = new N3.StreamParser();
    const writer = new N3.StreamWriter();
    
    sourceStream
      .pipeThrough(parser)
      .pipeThrough(new TransformStream({
        transform: (quad, controller) => {
          // Apply semantic transformations
          const transformedQuad = this.applySemanticRules(quad);
          if (transformedQuad) {
            controller.enqueue(transformedQuad);
          }
        }
      }))
      .pipeTo(writer.getWritableStream());
  }
  
  private applySemanticRules(quad: N3.Quad): N3.Quad | null {
    // Apply filtering, transformation, or validation rules
    // Return null to filter out the quad
    return quad;
  }
}
```

### Memory Management

```typescript
class MemoryOptimizedStore {
  private store: N3.Store;
  private memoryMonitor: MemoryMonitor;
  
  constructor(private maxMemoryMB = 512) {
    this.store = new N3.Store();
    this.memoryMonitor = new MemoryMonitor();
    
    // Periodic cleanup
    setInterval(() => this.performCleanup(), 60000);
  }
  
  private performCleanup(): void {
    const currentMemoryMB = this.memoryMonitor.getCurrentUsage();
    
    if (currentMemoryMB > this.maxMemoryMB * 0.8) {
      // Implement memory cleanup strategies
      this.clearExpiredCache();
      this.compactStore();
      
      if (currentMemoryMB > this.maxMemoryMB * 0.9) {
        this.aggressiveCleanup();
      }
    }
  }
}
```

This semantic layer architecture provides the foundation for intelligent, ontology-aware template generation that can adapt to domain-specific requirements and maintain compliance with regulatory frameworks.