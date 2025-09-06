# RDF Filters Usage Guide

This guide demonstrates how to use RDF filters in Nunjucks templates with the Unjucks generator system.

## Overview

RDF filters enable querying and manipulating RDF data directly within Nunjucks templates. The filters work with data loaded from Turtle files, providing semantic web capabilities for code generation.

## Setting Up RDF Filters

### 1. Loading RDF Data

Configure RDF data sources in your template frontmatter:

```yaml
---
to: src/models/{{ className }}.ts
rdf:
  - type: file
    path: data/ontology.ttl
  - type: inline
    content: |
      @prefix ex: <http://example.org/> .
      ex:Person a ex:Class ;
          ex:hasProperty ex:name, ex:email .
---
```

### 2. Available RDF Filters

#### Basic Query Filters

**`rdfSubject(predicate, object)`** - Find subjects with given predicate-object pair:
```nunjucks
{# Find all classes that have properties #}
{% set classes = "" | rdfSubject("ex:hasProperty", "?") %}
```

**`rdfObject(subject, predicate)`** - Get objects for subject-predicate pair:
```nunjucks
{# Get all properties of a class #}
{% set properties = "ex:Person" | rdfObject("ex:hasProperty") %}
{% for prop in properties %}
  {{ prop.value }}
{% endfor %}
```

**`rdfPredicate(subject, object)`** - Find predicates connecting subject-object:
```nunjucks
{# Find relationships between Person and name #}
{% set relations = "ex:Person" | rdfPredicate("ex:name") %}
```

#### Pattern Matching

**`rdfQuery(pattern)`** - SPARQL-like triple pattern queries:
```nunjucks
{# Query with pattern object #}
{% set results = { subject: "ex:Person", predicate: "rdf:type", object: null } | rdfQuery %}

{# Query with pattern string #}
{% set persons = "?s rdf:type foaf:Person" | rdfQuery %}
```

#### Resource Information

**`rdfLabel(resource)`** - Get human-readable labels:
```nunjucks
{# Get label, falling back to local name #}
<h1>{{ "ex:Person" | rdfLabel }}</h1>
```

**`rdfType(resource)`** - Get RDF types:
```nunjucks
{# List all types of a resource #}
{% set types = "ex:john" | rdfType %}
{% for type in types %}
  Type: {{ type | rdfCompact }}
{% endfor %}
```

#### Namespace Utilities

**`rdfNamespace(prefix)`** - Resolve namespace prefixes:
```nunjucks
{# Get full namespace URI #}
Base namespace: {{ "foaf" | rdfNamespace }}
```

**`rdfExpand(prefixed)`** - Expand prefixed URI to full URI:
```nunjucks
{# Expand foaf:Person to full URI #}
Full URI: {{ "foaf:Person" | rdfExpand }}
```

**`rdfCompact(uri)`** - Compact full URI to prefixed form:
```nunjucks
{# Compact http://xmlns.com/foaf/0.1/Person to foaf:Person #}
Compact: {{ "http://xmlns.com/foaf/0.1/Person" | rdfCompact }}
```

#### Utility Filters

**`rdfCount(subject?, predicate?, object?)`** - Count matching triples:
```nunjucks
{# Count all properties of a class #}
Property count: {{ "ex:Person" | rdfCount("ex:hasProperty") }}
```

**`rdfExists(subject, predicate?, object?)`** - Check if triple exists:
```nunjucks
{# Check if Person has name property #}
{% if "ex:Person" | rdfExists("ex:hasProperty", "ex:name") %}
  Person has name property!
{% endif %}
```

**`rdfGraph(name?)`** - Filter by named graph:
```nunjucks
{# Get triples from specific graph #}
{% set graphTriples = "ex:schema" | rdfGraph %}
```

## Practical Examples

### 1. Generating TypeScript Classes from RDF Schema

Template with RDF data:
```yaml
---
to: src/models/{{ className }}.ts
rdf:
  type: file
  path: schemas/{{ schemaFile }}
className: "{{ 'ex:' + entityName | rdfLabel | pascalCase }}"
---
```

```nunjucks
// Auto-generated from RDF schema
export class {{ className }} {
  {% set entity = "ex:" + entityName %}
  {% set properties = entity | rdfObject("ex:hasProperty") %}
  
  {% for prop in properties %}
  {% set propName = prop.value | rdfLabel | camelCase %}
  {% set propType = prop.value | rdfObject("ex:hasDataType") %}
  {{ propName }}: {{ propType[0].value | mapXSDType }};
  {% endfor %}

  constructor(
    {% for prop in properties %}
    {% set propName = prop.value | rdfLabel | camelCase %}
    {% set propType = prop.value | rdfObject("ex:hasDataType") %}
    public {{ propName }}: {{ propType[0].value | mapXSDType }}{{ "," if not loop.last }}
    {% endfor %}
  ) {}
}
```

### 2. API Documentation Generation

```nunjucks
# {{ "ex:" + apiName | rdfLabel }} API

{% set endpoints = "ex:" + apiName | rdfObject("ex:hasEndpoint") %}
## Endpoints

{% for endpoint in endpoints %}
{% set method = endpoint.value | rdfObject("ex:httpMethod") %}
{% set path = endpoint.value | rdfObject("ex:path") %}
{% set description = endpoint.value | rdfLabel %}

### {{ method[0].value }} {{ path[0].value }}

{{ description }}

{% set parameters = endpoint.value | rdfObject("ex:hasParameter") %}
{% if parameters.length > 0 %}
**Parameters:**
{% for param in parameters %}
- `{{ param.value | rdfLabel }}`: {{ param.value | rdfObject("ex:description") }}
{% endfor %}
{% endif %}
{% endfor %}
```

### 3. Database Schema Generation

```nunjucks
-- Generated from RDF ontology
{% set entities = "" | rdfSubject("rdf:type", "ex:Entity") %}

{% for entity in entities %}
{% set tableName = entity | rdfLabel | snakeCase %}
CREATE TABLE {{ tableName }} (
  id SERIAL PRIMARY KEY,
  {% set properties = entity | rdfObject("ex:hasProperty") %}
  {% for prop in properties %}
  {% set columnName = prop.value | rdfLabel | snakeCase %}
  {% set dataType = prop.value | rdfObject("ex:sqlType") %}
  {{ columnName }} {{ dataType[0].value }}{{ "," if not loop.last }}
  {% endfor %}
);

{% endfor %}
```

## Working with Different Data Types

### Handling Literals with Datatypes

```nunjucks
{% set ageProperty = "ex:age" | rdfObject("ex:hasDataType") %}
{% for datatype in ageProperty %}
  {% if datatype.datatype == "http://www.w3.org/2001/XMLSchema#integer" %}
    // This is an integer property
    {{ property }}: number;
  {% endif %}
{% endfor %}
```

### Language Tags

```nunjucks
{% set labels = "ex:Product" | rdfObject("rdfs:label") %}
{% for label in labels %}
  {% if label.language == "en" %}
    English: {{ label.value }}
  {% elif label.language == "es" %}
    Spanish: {{ label.value }}
  {% endif %}
{% endfor %}
```

## Best Practices

### 1. Use Descriptive Variable Names
```nunjucks
{# Good #}
{% set classProperties = className | rdfObject("ex:hasProperty") %}

{# Avoid #}
{% set props = className | rdfObject("ex:hasProperty") %}
```

### 2. Check for Existence Before Use
```nunjucks
{% if "ex:Person" | rdfExists("ex:hasProperty") %}
  {% set properties = "ex:Person" | rdfObject("ex:hasProperty") %}
  {# Process properties #}
{% endif %}
```

### 3. Cache Complex Queries
```nunjucks
{# Cache results of expensive queries #}
{% set allClasses = "" | rdfSubject("rdf:type", "rdfs:Class") %}
{% for class in allClasses %}
  {# Process each class #}
{% endfor %}
```

### 4. Use Compact URIs for Readability
```nunjucks
{# More readable with prefixes #}
{% set person = "foaf:Person" | rdfExpand %}

{# Than full URIs #}
{% set person = "http://xmlns.com/foaf/0.1/Person" %}
```

## Error Handling

RDF filters are designed to be robust and return empty results rather than throwing errors:

```nunjucks
{# Safe to use even with invalid URIs #}
{% set properties = "invalid:uri" | rdfObject("ex:hasProperty") %}
{# properties will be an empty array #}

{% if properties.length > 0 %}
  Found {{ properties.length }} properties
{% else %}
  No properties found
{% endif %}
```

## Integration with Template Context

RDF filters work seamlessly with other Nunjucks features:

```nunjucks
{# Combine with loops and conditionals #}
{% for entity in entities %}
  {% set entityLabel = entity | rdfLabel %}
  {% if entityLabel | lower | includes("person") %}
    // This is a person-related entity
    export class {{ entityLabel | pascalCase }} {
      {% set props = entity | rdfObject("ex:hasProperty") %}
      {% for prop in props %}
        {{ prop.value | rdfLabel | camelCase }}: string;
      {% endfor %}
    }
  {% endif %}
{% endfor %}
```

This comprehensive guide covers all the available RDF filters and their practical applications in template generation.