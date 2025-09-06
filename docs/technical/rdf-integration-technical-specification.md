# N3.js RDF Integration Technical Specification

## API Surface and Integration Points

### 1. Enhanced Frontmatter Configuration

#### RDF Data Source Configuration
```typescript
interface RDFDataSourceConfig {
  // Data source specification
  rdf?: RDFDataSource | string;
  turtle?: RDFDataSource | string;
  rdfData?: string;        // Inline Turtle content
  turtleData?: string;     // Alias for rdfData
  
  // Base URI and namespace configuration
  rdfBaseUri?: string;
  rdfPrefixes?: Record<string, string>;
  
  // Query configuration
  rdfQuery?: string | SPARQLSelectQuery | SimpleRDFQuery;
  
  // Schema and validation
  rdfSchema?: string | SchemaSource;
  rdfValidate?: boolean;
  
  // Performance options
  rdfCache?: boolean | RDFCacheOptions;
  rdfLazy?: boolean;
  
  // Variable mapping
  rdfVariables?: string[] | RDFVariableMapping;
}

interface RDFDataSource {
  type: 'file' | 'inline' | 'uri' | 'sparql-endpoint';
  source: string;
  format?: 'turtle' | 'n-triples' | 'rdf-xml' | 'json-ld';
  headers?: Record<string, string>;    // For HTTP sources
  auth?: AuthConfig;                   // Authentication for endpoints
  variables?: string[];                // Specific variables to extract
  baseUri?: string;                    // Override global base URI
}

interface SimpleRDFQuery {
  subject?: string;     // URI pattern or variable
  predicate?: string;   // Property URI or variable  
  object?: string;      // Value pattern or variable
  limit?: number;       // Result limit
  offset?: number;      // Result offset
}

interface SPARQLSelectQuery {
  sparql: string;       // Full SPARQL query
  bindings?: Record<string, any>;  // Variable bindings
}
```

#### Example Frontmatter Configurations

**Basic File Loading**
```yaml
---
to: "people/{{ person.name | kebabCase }}.md"
turtle: "./data/people.ttl"
rdfBaseUri: "https://example.org/"
rdfPrefixes:
  foaf: "http://xmlns.com/foaf/0.1/"
  ex: "https://example.org/"
---
```

**Inline RDF Data**
```yaml
---
to: "{{ project.name | kebabCase }}/README.md"
turtleData: |
  @prefix ex: <https://example.org/> .
  @prefix doap: <http://usefulinc.com/ns/doap#> .
  
  ex:myProject a doap:Project ;
               doap:name "My Amazing Project" ;
               doap:description "A project built with Unjucks" .
---
```

**SPARQL Query**
```yaml
---
to: "reports/{{ reportType }}.md"  
turtle: "./data/organization.ttl"
rdfQuery:
  sparql: |
    SELECT ?person ?name ?role WHERE {
      ?person foaf:name ?name ;
              org:hasRole ?role .
      FILTER(?role = org:Manager)
    }
  bindings:
    orgId: "https://example.org/acme"
---
```

**Schema Validation**
```yaml
---
to: "generated/{{ className | pascalCase }}.ts"
turtle: "./schemas/ontology.ttl"
rdfSchema: "./shapes/class-constraints.ttl"
rdfValidate: true
rdfQuery:
  subject: "?class"
  predicate: "rdf:type" 
  object: "owl:Class"
---
```

### 2. Template Context Extensions

#### The $rdf Object
```typescript
interface RDFTemplateContext {
  $rdf: {
    // Core data access
    subjects: Record<string, RDFResource>;
    prefixes: Record<string, string>;
    triples: ReadonlyArray<Quad>;
    
    // Query methods
    query(sparql: string): RDFQueryResult;
    find(subject?: string, predicate?: string, object?: string): Quad[];
    
    // Type-based access
    getByType(typeUri: string): RDFResource[];
    hasType(resource: string, typeUri: string): boolean;
    
    // URI utilities
    compact(uri: string): string;
    expand(prefixed: string): string;
    localName(uri: string): string;
    namespace(uri: string): string;
    
    // Property access helpers
    property(resource: string, property: string): RDFValue[];
    propertyFirst(resource: string, property: string): RDFValue | null;
    label(resource: string): string;
    comment(resource: string): string;
    
    // Data filtering and sorting
    filter(resources: RDFResource[], property: string, value: any): RDFResource[];
    sortBy(resources: RDFResource[], property: string): RDFResource[];
    
    // Schema information
    classes: string[];
    properties: string[];
    vocabularies: string[];
  };
  
  $metadata: {
    sourceFiles: string[];
    tripleCount: number;
    loadTime: number;
    vocabs: Record<string, VocabularyInfo>;
    errors: string[];
    warnings: string[];
  };
  
  // Direct variable access from RDF
  [variableName: string]: any;
}
```

#### RDF Resource Access Patterns
```nunjucks
{# Direct property access #}
{{ person.foaf_name }}
{{ person["http://xmlns.com/foaf/0.1/name"] }}

{# Using $rdf context #}
{{ $rdf.property(person.uri, "foaf:name") | first }}
{{ $rdf.label(person.uri) }}

{# Type-based queries #}
{% for person in $rdf.getByType("foaf:Person") %}
  - {{ $rdf.label(person.uri) }}
{% endfor %}

{# SPARQL queries #}
{% set managers = $rdf.query("SELECT ?p WHERE { ?p org:hasRole org:Manager }") %}
{% for binding in managers.bindings %}
  Manager: {{ binding.p | rdfValue }}
{% endfor %}
```

### 3. RDF Filter Functions

#### Core URI Manipulation Filters
```typescript
interface URIFilters {
  // Compact full URI using prefixes
  rdfCompact(uri: string, prefixes?: Record<string, string>): string;
  
  // Expand prefixed URI to full URI
  rdfExpand(prefixed: string, prefixes?: Record<string, string>): string;
  
  // Extract local name from URI
  rdfLocalName(uri: string): string;
  
  // Extract namespace from URI
  rdfNamespace(uri: string): string;
  
  // Create template variable name from URI
  rdfVarName(uri: string): string;
}
```

#### Data Access and Conversion Filters
```typescript
interface DataFilters {
  // Convert RDF value to JavaScript type
  rdfValue(value: RDFValue): any;
  
  // Get property values for resource
  rdfProperty(resource: RDFResource | string, property: string, data?: TurtleData): any[];
  
  // Get first property value
  rdfPropertyFirst(resource: RDFResource | string, property: string, data?: TurtleData): any;
  
  // Get human-readable label
  rdfLabel(resource: RDFResource | string, data?: TurtleData): string;
  
  // Get description/comment
  rdfComment(resource: RDFResource | string, data?: TurtleData): string;
  
  // Format RDF value according to datatype
  rdfFormat(value: RDFValue, format?: string): string;
}
```

#### Type and Query Filters
```typescript
interface TypeQueryFilters {
  // Check if resource has specific type
  rdfHasType(resource: RDFResource | string, typeUri: string, data?: TurtleData): boolean;
  
  // Get all resources of specific type
  rdfByType(data: TurtleData, typeUri: string): RDFResource[];
  
  // Filter resources by property value
  rdfFilter(resources: RDFResource[], property: string, value: any): RDFResource[];
  
  // Sort resources by property
  rdfSortBy(resources: RDFResource[], property: string): RDFResource[];
  
  // Execute SPARQL query
  rdfQuery(template: string, bindings?: Record<string, string>): string;
  
  // Create JSON-LD context
  rdfContext(prefixes: Record<string, string>, additional?: any): object;
}
```

#### Filter Usage Examples
```nunjucks
{# URI manipulation #}
{{ "http://xmlns.com/foaf/0.1/name" | rdfCompact($rdf.prefixes) }}
{# Output: foaf:name #}

{{ "foaf:Person" | rdfExpand($rdf.prefixes) }}  
{# Output: http://xmlns.com/foaf/0.1/Person #}

{{ person.uri | rdfLocalName }}
{# Output: john-doe #}

{# Data access #}
{{ person | rdfProperty("foaf:name") | join(", ") }}
{{ person | rdfLabel }}
{{ birthDate | rdfValue | date("YYYY-MM-DD") }}

{# Type checking and filtering #}
{% if person | rdfHasType("foaf:Person") %}
  This is a person!
{% endif %}

{% set people = $rdf | rdfByType("foaf:Person") %}
{% set managers = people | rdfFilter("org:hasRole", "org:Manager") %}
{% set sortedManagers = managers | rdfSortBy("foaf:name") %}

{# Query generation #}
{% set queryTemplate = "SELECT ?p WHERE { ?p rdf:type ?type }" %}
{{ queryTemplate | rdfQuery({ type: "foaf:Person" }) }}
```

### 4. Advanced RDF Integration Features

#### Schema-Aware Template Generation
```yaml
---
to: "models/{{ className | pascalCase }}.ts"
turtle: "./ontology/domain-model.ttl"
rdfSchema: "./constraints/model-shapes.ttl"
rdfQuery:
  sparql: |
    SELECT ?class ?property ?range ?cardinality WHERE {
      ?class rdf:type owl:Class ;
             rdfs:subClassOf* ?restriction .
      ?restriction owl:onProperty ?property ;
                   owl:onClass ?range .
      OPTIONAL { ?restriction owl:cardinality ?cardinality }
    }
---

// Generated TypeScript model from OWL ontology
{% for classBinding in $rdf.query(rdfQuery).bindings | groupBy("class") %}
export interface {{ classBinding.key | rdfLocalName | pascalCase }} {
  {% for prop in classBinding.values %}
  {{ prop.property | rdfLocalName | camelCase }}{% if prop.cardinality != "1" %}?{% endif %}: {{ prop.range | rdfLocalName | jsType }}{% if prop.cardinality == "0" or prop.cardinality > "1" %}[]{% endif %};
  {% endfor %}
}
{% endfor %}
```

#### Multi-Source RDF Data Loading
```yaml
---
to: "documentation/{{ module }}/API.md"
rdf:
  - type: file
    source: "./schemas/core-ontology.ttl"
    variables: ["coreClasses", "coreProperties"]
  - type: file  
    source: "./data/{{ module }}-instances.ttl"
    variables: ["moduleInstances"]
  - type: sparql-endpoint
    source: "https://dbpedia.org/sparql"
    query: |
      SELECT ?concept ?label WHERE {
        ?concept rdfs:label ?label .
        FILTER(CONTAINS(?label, "{{ searchTerm }}"))
      }
    variables: ["externalConcepts"]
---

# API Documentation for {{ module }}

## Core Classes
{% for class in coreClasses %}
### {{ class | rdfLabel }}
{{ class | rdfComment }}
{% endfor %}

## Related Concepts  
{% for concept in externalConcepts %}
- {{ concept.label }}: {{ concept.concept }}
{% endfor %}
```

#### RDF-Driven CLI Argument Generation
```typescript
// Enhanced template scanner with RDF schema support
interface RDFSchemaSupport {
  generateCliArgs(schemaFile: string): Promise<CliArguments>;
  
  // Extract CLI arguments from RDF schema
  extractFromOntology(ontologyFile: string): {
    required: string[];
    optional: string[];
    types: Record<string, string>;
    descriptions: Record<string, string>;
    defaults: Record<string, any>;
  };
}

// Usage in templates
async generateDynamicCliArgs(generatorName: string, templateName: string) {
  const templatePath = path.join(this.templatesDir, generatorName, templateName);
  
  // Check for RDF schema in template
  const rdfSchema = await this.findRDFSchema(templatePath);
  if (rdfSchema) {
    return this.rdfSchemaSupport.generateCliArgs(rdfSchema);
  }
  
  // Fallback to standard variable scanning
  return this.scanTemplateForVariables(generatorName, templateName);
}
```

### 5. Performance and Caching Specifications

#### Cache Configuration
```typescript
interface RDFCacheConfig {
  // Memory cache for parsed RDF data
  memoryCache: {
    enabled: boolean;
    maxSize: number;        // Max entries
    maxMemory: string;      // e.g., "100MB"
    ttl: number;           // TTL in seconds
  };
  
  // File system cache
  diskCache: {
    enabled: boolean;
    directory: string;      // Cache directory
    compression: boolean;   // Compress cached data
    encryption: boolean;    // Encrypt sensitive data
  };
  
  // Query result cache
  queryCache: {
    enabled: boolean;
    maxResults: number;     // Max cached query results
    ttl: number;           // Query cache TTL
  };
}
```

#### Cache Key Generation Strategy
```typescript
interface CacheKeyGeneration {
  // Data source cache keys
  fileKey(filePath: string, lastModified: Date): string;
  inlineKey(content: string): string;
  uriKey(uri: string, headers: Record<string, string>): string;
  
  // Query cache keys  
  sparqlKey(query: string, dataSourceKey: string): string;
  filterKey(filterChain: string[], resourceId: string): string;
  
  // Composite keys for multi-source data
  compositeKey(sources: RDFDataSource[]): string;
}
```

#### Memory Management
```typescript
interface MemoryManagement {
  // Resource limits
  maxTriplesInMemory: number;
  maxConcurrentQueries: number;
  gcThreshold: number;
  
  // Cleanup strategies
  cleanupOnMemoryPressure(): void;
  evictLeastRecentlyUsed(): void;
  compactStore(): void;
  
  // Memory monitoring
  getCurrentUsage(): MemoryStats;
  predictUsage(dataSource: RDFDataSource): number;
}

interface MemoryStats {
  totalMemoryUsage: number;
  rdfDataSize: number;
  cacheSize: number;
  queryResultSize: number;
  availableMemory: number;
}
```

### 6. Error Handling and Validation

#### RDF Parsing Error Handling
```typescript
interface RDFErrorHandling {
  // Syntax error recovery
  syntaxErrorStrategy: 'strict' | 'lenient' | 'repair';
  
  // Error reporting
  reportParsingErrors(errors: RDFParseError[]): void;
  reportValidationErrors(errors: ValidationError[]): void;
  
  // Fallback mechanisms
  fallbackToEmptyData: boolean;
  fallbackToDefaultValues: Record<string, any>;
  
  // Error context
  includeSourceContext: boolean;
  maxErrorsToReport: number;
}

interface RDFParseError {
  line: number;
  column: number;
  message: string;
  severity: 'error' | 'warning' | 'info';
  suggestion?: string;
  code: string;
}
```

#### Template Error Context
```typescript
interface RDFTemplateError extends Error {
  type: 'rdf-parse' | 'rdf-query' | 'rdf-filter' | 'rdf-validation';
  source: string;        // RDF source that caused error
  template: string;      // Template file path
  line?: number;         // Line in template
  column?: number;       // Column in template
  rdfContext?: {
    subject?: string;
    predicate?: string;
    object?: string;
  };
  suggestions: string[];
}
```

### 7. Development and Debugging Support

#### Debug Mode Configuration
```typescript
interface RDFDebugConfig {
  // Logging levels
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  logQueries: boolean;
  logCacheHits: boolean;
  logParsingTime: boolean;
  
  // Template debugging
  highlightRDFAccess: boolean;
  validatePropertyAccess: boolean;
  warnOnMissingProperties: boolean;
  
  // Performance monitoring
  trackQueryPerformance: boolean;
  profileMemoryUsage: boolean;
  reportSlowQueries: number; // Threshold in ms
}
```

#### CLI Debug Tools
```bash
# Validate RDF data
unjucks rdf validate ./data/people.ttl

# Test RDF queries
unjucks rdf query ./data/people.ttl "SELECT ?name WHERE { ?p foaf:name ?name }"

# Show cache statistics
unjucks rdf cache stats

# Validate template with RDF schema
unjucks rdf template-check ./templates/person/profile.md.njk

# Profile RDF performance
unjucks rdf profile ./templates/report/annual.md.njk --data ./data/large-dataset.ttl
```

### 8. Migration and Compatibility

#### Backward Compatibility Guarantees
- Existing Unjucks templates work without modification
- RDF features are completely opt-in
- No performance impact for non-RDF templates
- Graceful degradation when RDF data unavailable

#### Migration Helpers
```typescript
interface MigrationSupport {
  // Convert from other RDF template systems
  fromJena(templateDir: string): Promise<void>;
  fromRDF4J(templateDir: string): Promise<void>;
  
  // Validate migration
  validateMigration(oldTemplates: string[], newTemplates: string[]): MigrationReport;
  
  // Update existing templates
  addRDFSupport(templateFile: string, rdfSource: RDFDataSource): Promise<void>;
}
```

## Security Considerations

### Data Source Validation
- File path sanitization and sandbox restrictions
- URI validation and allowlist support  
- Content-type validation for remote sources
- Size limits for inline data and file sources

### Query Security
- SPARQL injection prevention through parameterized queries
- Resource usage limits (time, memory, result size)
- Access control for sensitive RDF properties
- Audit logging for data access patterns

### Cache Security
- Encrypted cache storage for sensitive data
- Cache isolation between projects/users
- Automatic cache expiration and cleanup
- Secure key generation and validation

## Conclusion

This technical specification provides the detailed API surface and integration patterns needed to implement N3.js RDF support in Unjucks. The design prioritizes developer experience while maintaining performance, security, and backward compatibility.

The comprehensive filter system, flexible data source configuration, and robust caching strategy will enable powerful semantic web capabilities in template-driven development workflows while preserving the simplicity that makes Unjucks effective.