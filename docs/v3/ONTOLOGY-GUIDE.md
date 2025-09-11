# Ontology-Driven Template Engine Guide

The Unjucks v3 Ontology Template Engine integrates RDF/Turtle semantic data with Nunjucks templates, enabling powerful knowledge-driven code generation and documentation workflows.

## Table of Contents

1. [Overview](#overview)
2. [Core Architecture](#core-architecture)
3. [RDF/Turtle Data Format](#rdfturtle-data-format)
4. [CLI Commands](#cli-commands)
5. [Creating Ontology Templates](#creating-ontology-templates)
6. [SPARQL-like Queries](#sparql-like-queries)
7. [Batch Processing](#batch-processing)
8. [Advanced Features](#advanced-features)
9. [Examples and Use Cases](#examples-and-use-cases)
10. [Best Practices](#best-practices)

## Overview

The Ontology Template Engine enables you to:

- **Generate code from semantic data** using RDF/Turtle ontologies
- **Query and extract structured information** from knowledge graphs
- **Create templates that understand relationships** between entities
- **Process multiple subjects** in batch operations
- **Leverage semantic reasoning** for intelligent code generation

### Key Benefits

- **Type Safety**: Ontology schemas provide structure validation
- **Relationship Awareness**: Templates can navigate object relationships
- **Reusable Knowledge**: Same ontology can generate multiple outputs
- **Standards Compliant**: Uses W3C RDF standards
- **Extensible**: Support for custom vocabularies and inference rules

## Core Architecture

### OntologyTemplateEngine Class

The engine integrates three main components:

```javascript
import { OntologyTemplateEngine } from './src/core/ontology-template-engine.js';

const engine = new OntologyTemplateEngine({
  templatePath: './templates'  // Optional: custom template directory
});
```

#### Core Components

1. **N3 Store**: RDF triple storage and querying
2. **Nunjucks Environment**: Template rendering with custom filters
3. **Data Extraction**: Converts RDF to template-friendly objects

### Data Flow

```
RDF/Turtle → N3 Parser → RDF Store → Data Extractor → Template Variables → Nunjucks → Generated Output
```

## RDF/Turtle Data Format

### Basic Syntax

Turtle (Terse RDF Triple Language) uses subject-predicate-object triples:

```turtle
@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix person: <http://unjucks.dev/person/> .
@prefix skill: <http://unjucks.dev/skill/> .

<http://example.org/person/alex-martinez> a foaf:Person ;
    foaf:name "Alex Martinez" ;
    foaf:firstName "Alex" ;
    foaf:lastName "Martinez" ;
    foaf:mbox <mailto:alex.martinez@email.com> ;
    person:hasSkill skill:JavaScript, skill:TypeScript ;
    person:hasExperience [
        schema:name "Tech Lead" ;
        schema:description "Led development team" ;
        person:yearsOfExperience 6
    ] .
```

### Supported Vocabularies

#### FOAF (Friend of a Friend)
- `foaf:Person` - Person entity
- `foaf:name` - Full name
- `foaf:firstName` - First name
- `foaf:lastName` - Last name
- `foaf:mbox` - Email address

#### Schema.org
- `schema:jobTitle` - Job title
- `schema:name` - Generic name property
- `schema:description` - Description text

#### Custom Person Vocabulary
- `person:hasSkill` - Skills relationship
- `person:hasExperience` - Work experience
- `person:hasEducation` - Education background
- `person:yearsOfExperience` - Years of experience

### Blank Nodes

Use blank nodes for complex nested data:

```turtle
person:hasExperience [
    a person:WorkExperience ;
    schema:name "Senior Developer" ;
    schema:description "Full-stack development" ;
    person:yearsOfExperience 5 ;
    person:company "TechCorp"
] .
```

## CLI Commands

### `unjucks ontology generate`

Generate files from ontology data and templates.

```bash
# Basic generation
unjucks ontology generate person.ttl --template person-card --output profile.html

# Use specific subject
unjucks ontology generate data.ttl --subject http://example.org/person/john --template resume

# Batch processing
unjucks ontology generate company.ttl --batch --output-dir ./generated
```

**Arguments:**
- `ontology` (required): Path to RDF/Turtle file
- `--template, -t`: Template name or path
- `--subject, -s`: Subject URI to process
- `--output, -o`: Output file path
- `--batch, -b`: Process all subjects
- `--output-dir, -d`: Directory for batch output

### `unjucks ontology list`

List available ontology templates.

```bash
unjucks ontology list
```

**Output:**
```
📋 Available Ontology Templates:

  person-card
    Generate HTML profile cards from person data
    
  api-docs
    Generate API documentation from service ontologies
```

### `unjucks ontology query`

Query ontology data with filtering.

```bash
# Query all triples
unjucks ontology query person.ttl

# Filter by subject
unjucks ontology query person.ttl --subject http://example.org/person/alex

# Filter by predicate
unjucks ontology query person.ttl --predicate foaf:name

# Different output formats
unjucks ontology query person.ttl --format json
unjucks ontology query person.ttl --format turtle
```

**Arguments:**
- `ontology` (required): Path to RDF/Turtle file
- `--subject, -s`: Filter by subject URI
- `--predicate, -p`: Filter by predicate
- `--object, -o`: Filter by object value
- `--format, -f`: Output format (table, json, turtle)

### `unjucks ontology extract`

Extract structured data from ontology for a specific subject.

```bash
# Extract to console
unjucks ontology extract person.ttl --subject http://example.org/person/alex

# Extract to JSON file
unjucks ontology extract person.ttl --subject http://example.org/person/alex --output alex.json
```

**Arguments:**
- `ontology` (required): Path to RDF/Turtle file
- `--subject, -s` (required): Subject URI to extract
- `--output, -o`: Output JSON file path

**Output Structure:**
```json
{
  "subject": "http://example.org/person/alex",
  "properties": {
    "name": "Alex Martinez",
    "firstName": "Alex",
    "lastName": "Martinez",
    "email": "alex.martinez@email.com",
    "jobTitle": "Senior Developer",
    "skills": ["JavaScript", "TypeScript", "React"],
    "experience": {
      "title": "Tech Lead",
      "description": "Led development team",
      "years": 6
    }
  },
  "relationships": [
    {
      "predicate": "type",
      "object": "http://xmlns.com/foaf/0.1/Person"
    }
  ]
}
```

## Creating Ontology Templates

### Template Structure

Ontology templates are Nunjucks files with access to extracted ontology data:

```html
---
to: generated/{{ firstName | lower }}-{{ lastName | lower }}.html
---
<!DOCTYPE html>
<html>
<head>
    <title>{{ name }} - Profile</title>
</head>
<body>
    <h1>{{ name }}</h1>
    <p>{{ jobTitle }}</p>
    
    {% if skills %}
    <h3>Skills</h3>
    {% for skill in skills %}
        <span class="skill">{{ skill }}</span>
    {% endfor %}
    {% endif %}
    
    <!-- Access raw ontology data -->
    <div class="metadata">
        <p>Subject: {{ ontology.subject }}</p>
        <p>Relations: {{ ontology.relationships.length }}</p>
    </div>
</body>
</html>
```

### Available Variables

Templates have access to:

1. **Extracted Properties**: Direct access to structured data
   - `name`, `firstName`, `lastName`
   - `email`, `jobTitle`
   - `skills[]`, `experience{}`, `education{}`

2. **Ontology Object**: Raw ontology information
   - `ontology.subject` - Subject URI
   - `ontology.properties` - All extracted properties
   - `ontology.relationships[]` - Raw RDF relationships

3. **Store Object**: Direct access to RDF store for custom queries

### Custom Filters

The engine provides specialized Nunjucks filters:

#### `formatUri`
Format URIs to readable names:
```html
{{ "http://example.org/skill/JavaScript" | formatUri }}
<!-- Output: JavaScript -->
```

#### `namespace`
Extract namespace from URI:
```html
{{ "http://xmlns.com/foaf/0.1/Person" | namespace }}
<!-- Output: http://xmlns.com/foaf/0.1/ -->
```

#### `matchesOntology`
Check if URI matches pattern:
```html
{% if subject | matchesOntology("person") %}
    <p>This is a person entity</p>
{% endif %}
```

#### `getOntologyProperty`
Get specific property from store:
```html
{{ subject | getOntologyProperty("foaf:name") }}
```

#### `getAllOntologyValues`
Get all values for a predicate:
```html
{% for skill in subject | getAllOntologyValues("person:hasSkill") %}
    <span>{{ skill | formatUri }}</span>
{% endfor %}
```

### Template Location

Place ontology templates in:
```
templates/ontology-driven/
├── person-card.njk
├── api-docs.njk
├── resume.njk
└── team-directory.njk
```

## SPARQL-like Queries

### Basic Pattern Matching

The engine supports basic triple pattern queries:

```javascript
// Get all triples
const allTriples = engine.store.getQuads(null, null, null);

// Get triples for specific subject
const personTriples = engine.store.getQuads(
  'http://example.org/person/alex',
  null, 
  null
);

// Get all names
const names = engine.store.getQuads(
  null,
  'http://xmlns.com/foaf/0.1/name',
  null
);
```

### In Templates

Query the store directly in templates:

```html
{% set personQuads = store.getQuads(ontology.subject, null, null) %}
<h3>All Properties ({{ personQuads.length }} total):</h3>
{% for quad in personQuads %}
    <p>{{ quad.predicate.value | formatUri }}: {{ quad.object.value }}</p>
{% endfor %}
```

### Advanced Queries

For complex SPARQL queries, the engine can be extended with proper SPARQL engines:

```javascript
// Future: Full SPARQL support
const results = await engine.sparqlQuery(`
  SELECT ?person ?name ?skill WHERE {
    ?person foaf:name ?name .
    ?person person:hasSkill ?skill .
    FILTER(CONTAINS(?skill, "JavaScript"))
  }
`);
```

## Batch Processing

### Process All Subjects

Generate files for every subject in an ontology:

```bash
unjucks ontology generate company.ttl --batch --output-dir ./generated
```

### Subject Pattern Filtering

Filter subjects by URI pattern:

```bash
unjucks ontology generate data.ttl --batch --subject "person" --output-dir ./people
```

This processes only subjects containing "person" in their URI.

### Programmatic Batch Processing

```javascript
const results = await engine.generateBatch({
  ontologyPath: 'team.ttl',
  templatePath: 'templates/ontology-driven/profile.njk',
  outputDir: './team-profiles',
  subjectPattern: 'person'  // Optional filter
});

console.log(`Generated ${results.length} files`);
results.forEach(r => {
  console.log(`${r.subject} → ${r.outputPath}`);
});
```

## Advanced Features

### Inference Rules

The engine supports basic inference rules using N3 notation:

```javascript
const rules = `
  @prefix person: <http://unjucks.dev/person/> .
  
  # Infer seniority level from experience
  {
    ?person person:yearsOfExperience ?years .
    ?years math:greaterThan 5 .
  } => {
    ?person person:seniorityLevel "Senior" .
  } .
  
  # Match skills to job requirements
  {
    ?person person:hasSkill ?skill .
    ?job person:requiresSkill ?skill .
  } => {
    ?person person:qualifiedFor ?job .
  } .
`;
```

### Multiple Ontology Loading

Load data from multiple files:

```javascript
await engine.loadOntologies([
  'people.ttl',
  'skills.ttl',
  'companies.ttl'
]);
```

### Custom Data Extraction

Extend the data extraction for custom vocabularies:

```javascript
class CustomOntologyEngine extends OntologyTemplateEngine {
  async extractTemplateData(subjectUri) {
    const data = await super.extractTemplateData(subjectUri);
    
    // Add custom property extraction
    const quads = this.store.getQuads(subjectUri, null, null);
    for (const quad of quads) {
      if (quad.predicate.value.includes('customProperty')) {
        data.properties.customValue = quad.object.value;
      }
    }
    
    return data;
  }
}
```

## Examples and Use Cases

### 1. Team Directory Generation

**Ontology (team.ttl):**
```turtle
@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix person: <http://unjucks.dev/person/> .

<http://company.com/person/alice> a foaf:Person ;
    foaf:name "Alice Johnson" ;
    foaf:mbox <mailto:alice@company.com> ;
    person:department "Engineering" ;
    person:role "Tech Lead" .

<http://company.com/person/bob> a foaf:Person ;
    foaf:name "Bob Smith" ;
    foaf:mbox <mailto:bob@company.com> ;
    person:department "Design" ;
    person:role "Senior Designer" .
```

**Template (team-directory.njk):**
```html
---
to: team/{{ name | lower | replace(" ", "-") }}.html
---
<div class="team-member">
    <h2>{{ name }}</h2>
    <p><strong>Department:</strong> {{ department }}</p>
    <p><strong>Role:</strong> {{ role }}</p>
    <p><strong>Email:</strong> <a href="mailto:{{ email }}">{{ email }}</a></p>
</div>
```

**Command:**
```bash
unjucks ontology generate team.ttl --template team-directory --batch --output-dir ./team
```

### 2. API Documentation from Service Ontology

**Ontology (api.ttl):**
```turtle
@prefix api: <http://api.company.com/> .
@prefix schema: <http://schema.org/> .

api:UserService a api:Service ;
    schema:name "User Management API" ;
    schema:description "Handles user registration and authentication" ;
    api:hasEndpoint api:createUser, api:getUser, api:updateUser .

api:createUser a api:Endpoint ;
    schema:name "Create User" ;
    api:httpMethod "POST" ;
    api:path "/users" ;
    api:requestSchema "CreateUserRequest" ;
    api:responseSchema "UserResponse" .
```

**Template (api-docs.njk):**
```markdown
---
to: docs/{{ name | lower | replace(" ", "-") }}.md
---
# {{ name }}

{{ description }}

## Endpoints

{% for endpoint in endpoints %}
### {{ endpoint.name }}

- **Method:** {{ endpoint.httpMethod }}
- **Path:** {{ endpoint.path }}
- **Request:** {{ endpoint.requestSchema }}
- **Response:** {{ endpoint.responseSchema }}

{% endfor %}
```

### 3. Resume Generation

**Ontology (resume.ttl):**
```turtle
@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix cv: <http://cv.example.org/> .

<http://example.org/person/jane> a foaf:Person ;
    foaf:name "Jane Doe" ;
    foaf:mbox <mailto:jane@example.com> ;
    cv:hasWorkExperience [
        cv:jobTitle "Senior Developer" ;
        cv:company "TechCorp" ;
        cv:startDate "2020-01-01" ;
        cv:endDate "2023-12-31" ;
        cv:description "Led development of microservices platform"
    ] ;
    cv:hasEducation [
        cv:degree "BS Computer Science" ;
        cv:institution "State University" ;
        cv:graduationYear "2019"
    ] .
```

### 4. Configuration File Generation

Generate configuration files from ontology data:

**Ontology (config.ttl):**
```turtle
@prefix config: <http://config.app.com/> .

config:Database a config:Service ;
    config:host "localhost" ;
    config:port 5432 ;
    config:name "myapp" ;
    config:ssl true .

config:Redis a config:Service ;
    config:host "localhost" ;
    config:port 6379 ;
    config:database 0 .
```

**Template (docker-compose.njk):**
```yaml
---
to: docker-compose.yml
---
version: '3.8'
services:
  {% for service in services %}
  {{ service.name | lower }}:
    image: {{ service.name | lower }}:latest
    environment:
      - HOST={{ service.host }}
      - PORT={{ service.port }}
      {% if service.ssl %}- SSL_ENABLED=true{% endif %}
  {% endfor %}
```

## Best Practices

### 1. Ontology Design

- **Use standard vocabularies** (FOAF, Schema.org) when possible
- **Define clear namespaces** for custom properties
- **Use meaningful URIs** that indicate entity type and identity
- **Normalize data** to avoid duplication
- **Document custom vocabularies** in comments

### 2. Template Organization

- **Group templates by domain** (person, api, config)
- **Use consistent naming** conventions
- **Include template descriptions** in comments
- **Make templates reusable** across different ontologies
- **Test with sample data** before production use

### 3. Data Quality

- **Validate ontology syntax** before processing
- **Use consistent data types** for properties
- **Handle missing data** gracefully in templates
- **Provide default values** where appropriate
- **Document required vs optional** properties

### 4. Performance

- **Load ontologies once** and reuse the engine
- **Filter large datasets** using subject patterns
- **Cache extracted data** for repeated use
- **Use batch processing** for multiple outputs
- **Monitor memory usage** with large ontologies

### 5. Error Handling

```javascript
try {
  await engine.loadOntology('data.ttl');
  const result = await engine.generate(options);
} catch (error) {
  if (error.message.includes('parse')) {
    console.error('Invalid Turtle syntax:', error.message);
  } else if (error.message.includes('subject')) {
    console.error('Subject not found in ontology');
  } else {
    console.error('Generation failed:', error.message);
  }
}
```

### 6. Testing

Create test ontologies for template validation:

```turtle
# test-person.ttl
@prefix foaf: <http://xmlns.com/foaf/0.1/> .

<http://test.org/person/test> a foaf:Person ;
    foaf:name "Test Person" ;
    foaf:firstName "Test" ;
    foaf:lastName "Person" ;
    foaf:mbox <mailto:test@example.com> .
```

Test templates with known data:

```bash
unjucks ontology generate test-person.ttl --template person-card --output test-output.html
```

### 7. Documentation

Document your custom vocabularies:

```turtle
# Custom Person Vocabulary Documentation
@prefix person: <http://unjucks.dev/person/> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

person:hasSkill rdfs:label "has skill" ;
    rdfs:comment "Relates a person to a skill they possess" ;
    rdfs:domain foaf:Person ;
    rdfs:range person:Skill .

person:yearsOfExperience rdfs:label "years of experience" ;
    rdfs:comment "Number of years of professional experience" ;
    rdfs:domain person:WorkExperience ;
    rdfs:range xsd:integer .
```

## Troubleshooting

### Common Issues

1. **Parse Errors**: Check Turtle syntax, especially semicolons and periods
2. **Missing Subjects**: Verify subject URIs match exactly
3. **Empty Output**: Check if properties are being extracted correctly
4. **Template Errors**: Use `--output` to debug generated content
5. **Memory Issues**: Process large ontologies in smaller batches

### Debug Commands

```bash
# Check ontology structure
unjucks ontology query data.ttl --format table

# Extract and inspect data
unjucks ontology extract data.ttl --subject http://example.org/person/test

# List available templates
unjucks ontology list

# Test template without writing files
unjucks ontology generate data.ttl --template test (without --output)
```

The Ontology Template Engine opens up powerful possibilities for knowledge-driven code generation, enabling teams to maintain single sources of truth in semantic formats while generating multiple outputs for different systems and use cases.