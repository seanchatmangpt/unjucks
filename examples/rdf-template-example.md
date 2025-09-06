# RDF Template Examples for Unjucks

## Basic Turtle Data Usage

### 1. Simple Entity Template

**Data File** (`data/people.ttl`):
```turtle
@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix ex: <http://example.org/> .

ex:alice a foaf:Person ;
    foaf:name "Alice Johnson" ;
    foaf:mbox <mailto:alice@example.org> ;
    foaf:knows ex:bob .

ex:bob a foaf:Person ;
    foaf:name "Bob Smith" ;
    foaf:mbox <mailto:bob@example.org> .
```

**Template** (`person-card.njk`):
```nunjucks
---
to: src/components/{{ person | rdfLabel | kebabCase }}.tsx
rdf:
  type: file
  source: ./data/people.ttl
---
import React from 'react';

{% set person = $rdf.query({ type: 'foaf:Person' })[0] %}

export const {{ person | rdfLabel | pascalCase }}Card = () => {
  return (
    <div className="person-card">
      <h2>{{ person | rdfLabel }}</h2>
      <p>Email: {{ person | rdfObject('foaf:mbox') | replace('mailto:', '') }}</p>
      {% set friends = person | rdfObject('foaf:knows') %}
      {% if friends %}
      <p>Knows: {{ friends | rdfLabel }}</p>
      {% endif %}
    </div>
  );
};
```

### 2. Schema-Driven Model Generation

**Ontology** (`ontology/schema.ttl`):
```turtle
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix app: <http://myapp.com/ontology#> .

app:User a owl:Class ;
    rdfs:label "User" ;
    rdfs:comment "Application user entity" .

app:username a owl:DatatypeProperty ;
    rdfs:domain app:User ;
    rdfs:range xsd:string ;
    rdfs:label "username" .

app:email a owl:DatatypeProperty ;
    rdfs:domain app:User ;
    rdfs:range xsd:string ;
    rdfs:label "email" .

app:createdAt a owl:DatatypeProperty ;
    rdfs:domain app:User ;
    rdfs:range xsd:dateTime ;
    rdfs:label "createdAt" .
```

**Template** (`model.ts.njk`):
```nunjucks
---
to: src/models/{{ className }}.ts
rdf:
  type: file
  source: ./ontology/schema.ttl
  variables:
    - className
---
{% set class = $rdf.query({ subject: 'app:' + className, predicate: 'rdf:type', object: 'owl:Class' })[0] %}
{% set properties = $rdf.query({ predicate: 'rdfs:domain', object: class.subject }) %}

/**
 * {{ class | rdfObject('rdfs:comment') }}
 */
export interface {{ className }} {
{% for prop in properties %}
  {% set propName = prop | rdfObject('rdfs:label') %}
  {% set propType = prop | rdfObject('rdfs:range') | rdfToTsType %}
  {{ propName }}: {{ propType }};
{% endfor %}
}

export class {{ className }}Model implements {{ className }} {
{% for prop in properties %}
  {% set propName = prop | rdfObject('rdfs:label') %}
  {% set propType = prop | rdfObject('rdfs:range') | rdfToTsType %}
  {{ propName }}: {{ propType }};
{% endfor %}

  constructor(data: Partial<{{ className }}>) {
    Object.assign(this, data);
  }
}
```

### 3. API Endpoint Generation from RDF

**API Schema** (`api/endpoints.ttl`):
```turtle
@prefix api: <http://api.example.org/> .
@prefix http: <http://www.w3.org/2011/http#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

api:getUserEndpoint a api:Endpoint ;
    rdfs:label "getUser" ;
    api:path "/users/:id" ;
    api:method "GET" ;
    api:returns api:User ;
    api:params [
        api:name "id" ;
        api:type "string" ;
        api:required true
    ] .

api:createUserEndpoint a api:Endpoint ;
    rdfs:label "createUser" ;
    api:path "/users" ;
    api:method "POST" ;
    api:returns api:User ;
    api:body api:UserInput .
```

**Template** (`api-client.ts.njk`):
```nunjucks
---
to: src/api/client.ts
rdf:
  type: file
  source: ./api/endpoints.ttl
---
import axios from 'axios';

export class APIClient {
  private baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

{% for endpoint in $rdf.query({ type: 'api:Endpoint' }) %}
  {% set name = endpoint | rdfLabel %}
  {% set method = endpoint | rdfObject('api:method') | lower %}
  {% set path = endpoint | rdfObject('api:path') %}
  {% set returns = endpoint | rdfObject('api:returns') | rdfLabel %}

  async {{ name }}(
    {%- if endpoint | rdfObject('api:params') -%}
    params: { id: string },
    {%- endif -%}
    {%- if endpoint | rdfObject('api:body') -%}
    data: {{ endpoint | rdfObject('api:body') | rdfLabel }},
    {%- endif -%}
  ): Promise<{{ returns }}> {
    const response = await axios.{{ method }}(
      `${this.baseURL}{{ path }}`
      {%- if method === 'get' and endpoint | rdfObject('api:params') -%}
        .replace(':id', params.id)
      {%- endif -%}
      {%- if method === 'post' -%}
      , data
      {%- endif -%}
    );
    return response.data;
  }
{% endfor %}
}
```

### 4. Configuration from RDF

**Config** (`config/app.ttl`):
```turtle
@prefix cfg: <http://config.example.org/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

cfg:appConfig a cfg:Configuration ;
    cfg:appName "MyApp" ;
    cfg:version "1.0.0" ;
    cfg:port 3000 ;
    cfg:enableLogging true ;
    cfg:database [
        cfg:host "localhost" ;
        cfg:port 5432 ;
        cfg:name "myapp_db"
    ] .
```

**Template** (`config.ts.njk`):
```nunjucks
---
to: src/config.ts
rdf:
  type: file
  source: ./config/app.ttl
---
{% set config = $rdf.query({ type: 'cfg:Configuration' })[0] %}
{% set db = config | rdfObject('cfg:database') %}

export const config = {
  appName: "{{ config | rdfObject('cfg:appName') }}",
  version: "{{ config | rdfObject('cfg:version') }}",
  port: {{ config | rdfObject('cfg:port') }},
  enableLogging: {{ config | rdfObject('cfg:enableLogging') }},
  database: {
    host: "{{ db | rdfObject('cfg:host') }}",
    port: {{ db | rdfObject('cfg:port') }},
    name: "{{ db | rdfObject('cfg:name') }}"
  }
};
```

### 5. Multi-Source RDF Data

**Template** (`combined.ts.njk`):
```nunjucks
---
to: src/combined.ts
rdf:
  - type: file
    source: ./data/users.ttl
    name: users
  - type: file
    source: ./data/roles.ttl
    name: roles
  - type: inline
    source: |
      @prefix app: <http://app.example.org/> .
      app:config app:theme "dark" .
---

// Users from first source
export const users = [
{% for user in $rdf.users.query({ type: 'foaf:Person' }) %}
  {
    name: "{{ user | rdfLabel }}",
    email: "{{ user | rdfObject('foaf:mbox') }}"
  },
{% endfor %}
];

// Roles from second source
export const roles = [
{% for role in $rdf.roles.query({ type: 'app:Role' }) %}
  "{{ role | rdfLabel }}",
{% endfor %}
];

// Config from inline source
export const theme = "{{ $rdf.inline.query({ subject: 'app:config' })[0] | rdfObject('app:theme') }}";
```

## Advanced Filter Usage

### Custom RDF Filters

```nunjucks
{# Get all classes from an ontology #}
{% set classes = $rdf.query({ predicate: 'rdf:type', object: 'owl:Class' }) %}

{# Get human-readable label with fallback #}
{{ resource | rdfLabel | default(resource.uri | basename) }}

{# Convert RDF datatype to TypeScript type #}
{{ 'xsd:string' | rdfToTsType }}  {# outputs: string #}
{{ 'xsd:integer' | rdfToTsType }} {# outputs: number #}
{{ 'xsd:boolean' | rdfToTsType }} {# outputs: boolean #}

{# Query with complex patterns #}
{% set results = $rdf.query({
  subject: '?person',
  predicate: 'foaf:knows',
  object: 'ex:alice'
}) %}

{# Filter by named graph #}
{% set graphData = $rdf.graph('http://example.org/graph1') %}

{# Expand prefixed URI #}
{{ 'foaf:Person' | rdfExpand }} {# outputs: http://xmlns.com/foaf/0.1/Person #}

{# Compact full URI #}
{{ 'http://xmlns.com/foaf/0.1/name' | rdfCompact }} {# outputs: foaf:name #}
```

## CLI Usage Examples

```bash
# Generate from RDF data
unjucks generate model User --rdf ./ontology/schema.ttl

# List available entities in RDF file
unjucks list --rdf ./data/entities.ttl

# Generate with inline RDF data
unjucks generate api-client --rdf-inline "@prefix api: <http://api.example.org/> . api:endpoint1 api:path '/users' ."

# Generate multiple files from RDF
unjucks generate batch --rdf ./ontology/*.ttl --template ./templates/model.njk
```

## Best Practices

1. **Use Prefixes**: Define common prefixes in your Turtle files for readability
2. **Validate Data**: Use SHACL shapes to validate RDF data before generation
3. **Cache Results**: Enable caching for large RDF files
4. **Type Safety**: Use TypeScript types for RDF structures
5. **Error Handling**: Always handle missing RDF data gracefully in templates