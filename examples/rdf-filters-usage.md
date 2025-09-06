# RDF Filters Usage Examples

This document demonstrates how to use RDF filters in Nunjucks templates with the Unjucks generator system.

## Basic Setup

```javascript
import { createRDFFilters, registerRDFFilters } from 'unjucks';
import { Parser, Store } from 'n3';
import nunjucks from 'nunjucks';

// Parse RDF data
const store = new Store();
const parser = new Parser();
const rdfData = `
  @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
  @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
  @prefix foaf: <http://xmlns.com/foaf/0.1/> .
  @prefix ex: <http://example.org/> .

  ex:john rdf:type foaf:Person ;
          rdfs:label "John Doe" ;
          foaf:name "John Doe" ;
          foaf:age 30 ;
          foaf:homepage <http://johndoe.com> .
`;
const quads = parser.parse(rdfData);
store.addQuads(quads);

// Setup Nunjucks with RDF filters
const env = nunjucks.configure();
registerRDFFilters(env, { store });
```

## Filter Examples

### 1. rdfSubject(predicate, object) - Find subjects

**Template:**
```nunjucks
{% set people = 'rdf:type' | rdfSubject('foaf:Person') %}
People in our data:
{% for person in people %}
- {{ person | rdfLabel }}
{% endfor %}
```

**Output:**
```
People in our data:
- John Doe
```

### 2. rdfObject(subject, predicate) - Get objects

**Template:**
```nunjucks
{% set ages = 'ex:john' | rdfObject('foaf:age') %}
John's age: {{ ages[0].value }}
{% if ages[0].type === 'literal' %}(stored as literal){% endif %}
```

**Output:**
```
John's age: 30 (stored as literal)
```

### 3. rdfPredicate(subject, object) - Find predicates

**Template:**
```nunjucks
{% set predicates = 'ex:john' | rdfPredicate('"John Doe"') %}
Properties linking John to "John Doe":
{% for pred in predicates %}
- {{ pred | rdfCompact }}
{% endfor %}
```

**Output:**
```
Properties linking John to "John Doe":
- rdfs:label
- foaf:name
```

### 4. rdfQuery(pattern) - SPARQL-like pattern matching

**Template (Object Pattern):**
```nunjucks
{% set results = { subject: null, predicate: 'rdf:type', object: 'foaf:Person' } | rdfQuery %}
Query results (all people):
{% for result in results %}
- Subject: {{ result[0].value | rdfCompact }}
- Type: {{ result[2].value | rdfCompact }}
{% endfor %}
```

**Template (String Pattern):**
```nunjucks
{% set results = '?s rdf:type foaf:Person' | rdfQuery %}
People found: {{ results.length }}
```

### 5. rdfLabel(resource) - Get best label

**Template:**
```nunjucks
{% set person = 'ex:john' %}
Display name: {{ person | rdfLabel }}

{# Tries in order: rdfs:label, skos:prefLabel, dc:title, foaf:name, local name #}
```

**Output:**
```
Display name: John Doe
```

### 6. rdfType(resource) - Get rdf:type

**Template:**
```nunjucks
{% set types = 'ex:john' | rdfType %}
John's types:
{% for type in types %}
- {{ type | rdfCompact }}
{% endfor %}
```

**Output:**
```
John's types:
- foaf:Person
```

### 7. rdfNamespace(prefix) - Resolve namespace prefixes

**Template:**
```nunjucks
FOAF namespace: {{ 'foaf' | rdfNamespace }}
RDF namespace: {{ 'rdf' | rdfNamespace }}
Custom namespace: {{ 'ex' | rdfNamespace }}
```

**Output:**
```
FOAF namespace: http://xmlns.com/foaf/0.1/
RDF namespace: http://www.w3.org/1999/02/22-rdf-syntax-ns#
Custom namespace: http://example.org/
```

### 8. rdfGraph(name) - Filter by named graph

**Template:**
```nunjucks
{% set allTriples = rdfGraph() %}
Total triples: {{ allTriples.length }}

{# Named graph filtering (if named graphs exist) #}
{% set graphTriples = 'http://example.org/graph1' | rdfGraph %}
Triples in specific graph: {{ graphTriples.length }}
```

## Additional Utility Filters

### rdfExpand(prefixed) - Expand prefixed URI

**Template:**
```nunjucks
{% set fullUri = 'foaf:Person' | rdfExpand %}
Full URI: {{ fullUri }}
```

**Output:**
```
Full URI: http://xmlns.com/foaf/0.1/Person
```

### rdfCompact(uri) - Compact full URI to prefixed form

**Template:**
```nunjucks
{% set compacted = 'http://xmlns.com/foaf/0.1/Person' | rdfCompact %}
Prefixed form: {{ compacted }}
```

**Output:**
```
Prefixed form: foaf:Person
```

### rdfCount() - Count matching triples

**Template:**
```nunjucks
Total triples: {{ rdfCount() }}
John's properties: {{ 'ex:john' | rdfCount }}
People count: {{ rdfCount(null, 'rdf:type', 'foaf:Person') }}
```

### rdfExists() - Check if triple exists

**Template:**
```nunjucks
{% if 'ex:john' | rdfExists %}
John exists in our data
{% endif %}

{% if 'ex:john' | rdfExists('foaf:age') %}
John has an age property
{% endif %}

{% if 'ex:john' | rdfExists('rdf:type', 'foaf:Person') %}
John is a person
{% endif %}
```

## Complex Template Examples

### Person Card Generator

**Template:**
```nunjucks
{# Generate person cards for all people in the dataset #}
{% set people = 'rdf:type' | rdfSubject('foaf:Person') %}

{% for person in people %}
<div class="person-card">
  <h2>{{ person | rdfLabel }}</h2>
  
  {% set ages = person | rdfObject('foaf:age') %}
  {% if ages.length > 0 %}
  <p>Age: {{ ages[0].value }}</p>
  {% endif %}
  
  {% set homepages = person | rdfObject('foaf:homepage') %}
  {% if homepages.length > 0 %}
  <p>Website: <a href="{{ homepages[0].value }}">{{ homepages[0].value }}</a></p>
  {% endif %}
  
  <div class="properties">
    <h3>All Properties:</h3>
    {% set allProps = person | rdfQuery %}
    {% for prop in allProps %}
    <div>{{ prop[1].value | rdfCompact }}: {{ prop[2].value }}</div>
    {% endfor %}
  </div>
</div>
{% endfor %}
```

### Namespace Documentation

**Template:**
```nunjucks
{# Generate namespace documentation #}
<h1>RDF Namespaces Used</h1>

{% set namespaces = ['rdf', 'rdfs', 'owl', 'foaf', 'skos', 'dc', 'schema', 'ex'] %}

{% for prefix in namespaces %}
<div class="namespace">
  <h2>{{ prefix }}</h2>
  <p>URI: <code>{{ prefix | rdfNamespace }}</code></p>
  
  {# Count usage #}
  {% set usageCount = rdfCount(null, null, null) %}
  <p>Used in {{ usageCount }} triples</p>
</div>
{% endfor %}
```

### Property Summary

**Template:**
```nunjucks
{# Generate a summary of all properties used #}
<h1>Property Usage Summary</h1>

{% set allTriples = rdfGraph() %}
{% set propertyMap = {} %}

{# Build property usage map (pseudo-code, actual implementation would differ) #}
{% for triple in allTriples %}
  {% set prop = triple[1].value | rdfCompact %}
  {% set count = prop | rdfCount(null, prop) %}
  
  <div class="property-stats">
    <h3>{{ prop }}</h3>
    <p>Full URI: {{ prop | rdfExpand }}</p>
    <p>Usage count: {{ count }}</p>
    
    {# Show example subjects using this property #}
    {% set examples = prop | rdfSubject('?o') | slice(0, 3) %}
    <p>Example subjects:</p>
    <ul>
    {% for subject in examples %}
      <li>{{ subject | rdfLabel }} ({{ subject | rdfCompact }})</li>
    {% endfor %}
    </ul>
  </div>
{% endfor %}
```

## Error Handling

The RDF filters include robust error handling and will gracefully return empty results or fallback values when:

- Invalid URIs are provided
- Resources don't exist in the dataset
- Malformed patterns are used in queries
- Unknown prefixes are referenced

```nunjucks
{# Safe usage patterns #}
{% set label = 'unknown:resource' | rdfLabel %}  {# Returns 'resource' #}
{% set objects = 'ex:missing' | rdfObject('foaf:name') %}  {# Returns [] #}
{% set count = 'malformed::uri' | rdfCount %}  {# Returns 0 #}
```

## Integration with Frontmatter

You can configure RDF data sources in template frontmatter:

```yaml
---
to: output/{{ resource | rdfLabel | slug }}.html
rdf: data/people.ttl
rdfQuery:
  subject: "{{ resource }}"
  predicate: null
  object: null
---
<h1>{{ resource | rdfLabel }}</h1>
<p>Type: {{ resource | rdfType | join(', ') | rdfCompact }}</p>
```

This enables powerful RDF-driven code generation for semantic web applications, documentation systems, and data-driven development workflows.