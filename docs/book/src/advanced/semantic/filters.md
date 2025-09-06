# Semantic Filters

## Overview

Unjucks provides 12+ specialized RDF filters for seamless integration of semantic data into Nunjucks templates. These filters enable sophisticated manipulation of RDF triples, URI handling, namespace management, and query pattern processing directly within templates, making semantic web data as accessible as regular template variables.

## Core RDF Filters

### 1. rdfObject Filter

Extract objects for a given subject-predicate pair.

```nunjucks
{# Get all types for a resource #}
{% set types = resource | rdfObject('rdf:type') %}
{% for type in types %}
  Type: {{ type.value | rdfCompact }}
{% endfor %}

{# Get property values with metadata #}
{% set name = person | rdfObject('foaf:name') | first %}
Name: {{ name.value }}
{% if name.language %}
Language: {{ name.language }}
{% endif %}
```

**Filter Signature:**
```typescript
rdfObject(subject: string, predicate: string): RDFFilterResult[]

interface RDFFilterResult {
  value: string;
  type: 'literal' | 'uri' | 'blank';
  datatype?: string;
  language?: string;
}
```

### 2. rdfSubject Filter

Find subjects that have a given predicate-object pair.

```nunjucks
{# Find all resources of a specific type #}
{% set services = rdfSubject('rdf:type', 'company:Service') %}
{% for service in services %}
  Service: {{ service | rdfLabel }}
{% endfor %}

{# Find resources with specific property values #}
{% set highPriorityTasks = rdfSubject('priority:level', '"high"') %}
{% for task in highPriorityTasks %}
  Critical Task: {{ task | rdfLabel }}
{% endfor %}
```

### 3. rdfPredicate Filter

Find predicates connecting a subject-object pair.

```nunjucks
{# Discover relationships between resources #}
{% set relationships = rdfPredicate(person, organization) %}
{% for relationship in relationships %}
  {{ person | rdfLabel }} {{ relationship | rdfCompact }} {{ organization | rdfLabel }}
{% endfor %}
```

### 4. rdfQuery Filter

Execute SPARQL-like pattern matching queries.

```nunjucks
{# Simple pattern queries #}
{% set results = rdfQuery('?service rdf:type company:Service') %}
{% for result in results %}
  {# result[0] = subject, result[1] = predicate, result[2] = object #}
  Service: {{ result[0].value | rdfLabel }}
{% endfor %}

{# Complex pattern matching #}
{% set complexResults = rdfQuery({
  subject: '?person',
  predicate: 'foaf:knows', 
  object: '?friend'
}) %}
```

### 5. rdfLabel Filter

Get the best available human-readable label for resources.

```nunjucks
{# Automatic label resolution with fallbacks #}
Resource Label: {{ resource | rdfLabel }}

{# Tries in order: rdfs:label → skos:prefLabel → dc:title → foaf:name → localName #}
{% set displayName = resource | rdfLabel %}
```

**Label Resolution Priority:**
1. `rdfs:label`
2. `skos:prefLabel` 
3. `dcterms:title`
4. `foaf:name`
5. Local name from URI

### 6. rdfType Filter

Get all rdf:type values for a resource.

```nunjucks
{# Get resource types #}
{% set types = resource | rdfType %}
{% for type in types %}
  Type: {{ type | rdfCompact }}
{% endfor %}

{# Check for specific type #}
{% if 'company:Service' in (resource | rdfType) %}
  This is a service resource.
{% endif %}
```

### 7. rdfNamespace Filter

Resolve namespace prefixes to full URIs.

```nunjucks
{# Resolve prefixes #}
Schema.org namespace: {{ 'schema' | rdfNamespace }}
{# Output: http://schema.org/ #}

Company namespace: {{ 'company' | rdfNamespace }}
{# Output: http://company.com/ontology/ #}
```

### 8. rdfGraph Filter

Query specific named graphs.

```nunjucks
{# Get all triples from a named graph #}
{% set hrTriples = rdfGraph('http://company.com/graphs/hr') %}
{% for triple in hrTriples %}
  {{ triple[0].value }} {{ triple[1].value }} {{ triple[2].value }}
{% endfor %}

{# Query default graph #}
{% set defaultTriples = rdfGraph() %}
```

## URI Manipulation Filters

### 9. rdfExpand Filter

Expand prefixed names to full URIs.

```nunjucks
{# Expand prefixed URIs #}
Full URI: {{ 'foaf:Person' | rdfExpand }}
{# Output: http://xmlns.com/foaf/0.1/Person #}

Expanded property: {{ 'schema:name' | rdfExpand }}
{# Output: http://schema.org/name #}
```

### 10. rdfCompact Filter

Compact full URIs to prefixed form.

```nunjucks
{# Compact long URIs #}
Compact form: {{ 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type' | rdfCompact }}
{# Output: rdf:type #}

Schema property: {{ 'http://schema.org/name' | rdfCompact }}
{# Output: schema:name #}
```

## Query and Utility Filters

### 11. rdfCount Filter

Count matching triples.

```nunjucks
{# Count total triples #}
Total triples: {{ rdfCount() }}

{# Count by subject #}
Properties for {{ resource | rdfLabel }}: {{ rdfCount(resource) }}

{# Count by predicate-object #}
Services: {{ rdfCount(null, 'rdf:type', 'company:Service') }}

{# Count specific patterns #}
{% set serviceCount = rdfCount('?s', 'rdf:type', 'company:Service') %}
Found {{ serviceCount }} services.
```

### 12. rdfExists Filter

Check if triples exist.

```nunjucks
{# Conditional generation based on RDF data #}
{% if rdfExists(resource, 'company:requiresApproval') %}
  <!-- Generate approval workflow -->
  export const APPROVAL_REQUIRED = true;
{% endif %}

{# Check for specific values #}
{% if rdfExists(service, 'company:status', '"active"') %}
  <!-- Generate active service configuration -->
{% endif %}
```

## Advanced Filter Usage Patterns

### Chaining Filters

```nunjucks
{# Complex filter chains for code generation #}
export interface {{ resource | rdfLabel | pascalCase }}Config {
  {% for property in resource | rdfObject('schema:hasProperty') 
                              | map('value') 
                              | map('rdfLabel') 
                              | sort %}
  {{ property | camelCase }}: {{ property | rdfObject('schema:rangeIncludes') 
                                        | first.value 
                                        | rdfCompact 
                                        | toTypeScript }};
  {% endfor %}
}
```

### Conditional Template Logic

```nunjucks
{# Generate different code based on semantic properties #}
{% set complianceRequired = resource | rdfExists('company:requiresCompliance') %}
{% set dataTypes = resource | rdfObject('company:handlesDataType') %}

export class {{ resource | rdfLabel | pascalCase }}Service {
  {% if complianceRequired %}
  private auditLogger = new ComplianceAuditLogger();
  {% endif %}
  
  {% if 'company:PersonalData' in dataTypes | map('value') %}
  private gdprHandler = new GDPRDataHandler();
  {% endif %}
  
  async process{{ resource | rdfLabel | pascalCase }}(data: InputData): Promise<void> {
    {% if complianceRequired %}
    await this.auditLogger.logStart(data.id);
    {% endif %}
    
    // Process data based on semantic properties
    {% for dataType in dataTypes %}
    {% if dataType.value == 'company:PersonalData' %}
    await this.gdprHandler.validateConsent(data);
    {% endif %}
    {% endfor %}
    
    {% if complianceRequired %}
    await this.auditLogger.logComplete(data.id);
    {% endif %}
  }
}
```

### Dynamic Code Generation

```nunjucks
{# Generate API endpoints from RDF service descriptions #}
{% set endpoints = service | rdfObject('api:hasEndpoint') %}
{% for endpoint in endpoints %}
  {# Extract endpoint metadata #}
  {% set method = endpoint.value | rdfObject('api:httpMethod') | first.value | upper %}
  {% set path = endpoint.value | rdfObject('api:path') | first.value %}
  {% set authRequired = endpoint.value | rdfExists('api:requiresAuth') %}
  {% set rateLimited = endpoint.value | rdfExists('api:rateLimited') %}
  
  {{ method }} {{ path }}:
  {% if authRequired %}
    - Authentication: Required
  {% endif %}
  {% if rateLimited %}
    - Rate Limited: {{ endpoint.value | rdfObject('api:rateLimit') | first.value }} req/min
  {% endif %}
  
{% endfor %}
```

## Template-Specific Semantic Functions

### Business Logic Extraction

```nunjucks
{# Extract business rules from ontology #}
{% set businessRules = entity | rdfObject('business:hasRule') %}
{% if businessRules | length > 0 %}
export class {{ entity | rdfLabel | pascalCase }}BusinessLogic {
  {% for rule in businessRules %}
  // Business Rule: {{ rule.value | rdfLabel }}
  validate{{ rule.value | rdfLabel | pascalCase }}(input: any): ValidationResult {
    {% set conditions = rule.value | rdfObject('business:condition') %}
    {% for condition in conditions %}
    if (!({{ condition.value | rdfObject('business:expression') | first.value }})) {
      return {
        valid: false,
        message: "{{ condition.value | rdfObject('business:errorMessage') | first.value }}"
      };
    }
    {% endfor %}
    
    return { valid: true };
  }
  {% endfor %}
}
{% endif %}
```

### Compliance Code Generation

```nunjucks
{# Generate GDPR compliance code from ontology #}
{% set personalDataTypes = rdfQuery('?type rdfs:subClassOf* gdpr:PersonalData') %}
{% if personalDataTypes | length > 0 %}
/**
 * GDPR Data Protection Implementation
 * Personal Data Types: {{ personalDataTypes | map(attribute=0) | map('value') | map('rdfLabel') | join(', ') }}
 */
export class GDPRComplianceService {
  {% for dataType in personalDataTypes %}
  {% set retentionPeriod = dataType[0].value | rdfObject('gdpr:retentionPeriod') | first %}
  {% if retentionPeriod %}
  
  // {{ dataType[0].value | rdfLabel }} retention policy
  async enforce{{ dataType[0].value | rdfLabel | pascalCase }}Retention(): Promise<void> {
    const retentionDays = {{ retentionPeriod.value }};
    const cutoffDate = new Date(Date.now() - (retentionDays * 24 * 60 * 60 * 1000));
    
    await this.repository.deleteExpiredRecords(
      '{{ dataType[0].value | rdfCompact }}',
      cutoffDate
    );
  }
  {% endif %}
  {% endfor %}
}
{% endif %}
```

### Multi-Language Support

```nunjucks
{# Generate internationalized content from RDF #}
{% set labels = resource | rdfObject('rdfs:label') %}
export const LABELS = {
  {% for label in labels %}
  {% if label.language %}
  {{ label.language }}: "{{ label.value }}",
  {% endif %}
  {% endfor %}
  default: "{{ resource | rdfLabel }}"
};
```

## Performance Optimization

### Filter Caching

```nunjucks
{# Cache expensive queries for template performance #}
{% set _serviceCache = rdfQuery('?s rdf:type company:Service') %}
{% set services = _serviceCache %}

{# Reuse cached results #}
{% for service in services %}
  Service: {{ service[0].value | rdfLabel }}
{% endfor %}

Total services: {{ services | length }}
```

### Selective Filtering

```nunjucks
{# Use specific filters for better performance #}
{# Good: Direct object access #}
{% set name = person | rdfObject('foaf:name') | first %}

{# Less optimal: General query #}
{% set nameQuery = rdfQuery('?p foaf:name ?name . FILTER(?p = <' + person + '>)') %}
```

## Error Handling and Debugging

### Safe Filter Usage

```nunjucks
{# Handle missing data gracefully #}
{% set name = person | rdfObject('foaf:name') | first %}
{% if name %}
Name: {{ name.value }}
{% else %}
Name: {{ person | rdfLabel }}
{% endif %}

{# Default values for missing properties #}
Priority: {{ task | rdfObject('priority:level') | first.value | default('normal') }}
```

### Debug Information

```nunjucks
{# Template debugging with RDF context #}
{% if DEBUG %}
<!-- DEBUG: RDF Context Information -->
<!-- Resource: {{ resource }} -->
<!-- Types: {{ resource | rdfType | join(', ') }} -->
<!-- Properties: {{ rdfCount(resource) }} -->
<!-- Generated at: {{ "now" | date('ISO') }} -->
{% endif %}
```

## Integration with Other Systems

### Database Schema Generation

```nunjucks
{# Generate database schema from RDF ontology #}
{% set entities = rdfQuery('?entity rdf:type owl:Class') %}
{% for entity in entities %}
-- Table for {{ entity[0].value | rdfLabel }}
CREATE TABLE {{ entity[0].value | rdfLabel | snake_case }} (
  id UUID PRIMARY KEY,
  {% set properties = entity[0].value | rdfObject('rdfs:hasProperty') %}
  {% for property in properties %}
  {{ property.value | rdfLabel | snake_case }} {{ property.value | rdfObject('schema:rangeIncludes') | first.value | toSQLType }},
  {% endfor %}
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
{% endfor %}
```

### API Documentation Generation

```nunjucks
{# Generate OpenAPI spec from RDF service descriptions #}
openapi: 3.0.0
info:
  title: {{ service | rdfLabel }}
  version: "{{ service | rdfObject('api:version') | first.value }}"
  description: "{{ service | rdfObject('rdfs:comment') | first.value }}"

paths:
  {% set endpoints = service | rdfObject('api:hasEndpoint') %}
  {% for endpoint in endpoints %}
  {{ endpoint.value | rdfObject('api:path') | first.value }}:
    {{ endpoint.value | rdfObject('api:httpMethod') | first.value | lower }}:
      summary: "{{ endpoint.value | rdfLabel }}"
      description: "{{ endpoint.value | rdfObject('rdfs:comment') | first.value }}"
      {% if endpoint.value | rdfExists('api:requiresAuth') %}
      security:
        - bearerAuth: []
      {% endif %}
      {% set parameters = endpoint.value | rdfObject('api:hasParameter') %}
      {% if parameters | length > 0 %}
      parameters:
        {% for param in parameters %}
        - name: {{ param.value | rdfLabel }}
          in: {{ param.value | rdfObject('api:parameterIn') | first.value }}
          required: {{ param.value | rdfExists('api:required') }}
          schema:
            type: {{ param.value | rdfObject('api:parameterType') | first.value }}
        {% endfor %}
      {% endif %}
  {% endfor %}
```

These comprehensive semantic filters transform RDF data into template-friendly formats, enabling sophisticated code generation that understands domain semantics, business rules, and ontological relationships while maintaining template readability and performance.