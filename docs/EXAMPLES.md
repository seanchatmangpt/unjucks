# KGEN Examples

Real-world examples demonstrating KGEN's capabilities for knowledge graph-driven code generation.

## Table of Contents

- [Basic Graph Processing](#basic-graph-processing)
- [API Generation](#api-generation-example)
- [Database Schema Generation](#database-schema-generation)
- [Documentation Generation](#documentation-generation)
- [Multi-Template Projects](#multi-template-projects)
- [Drift Detection Workflows](#drift-detection-workflows)
- [Advanced RDF Processing](#advanced-rdf-processing)

---

## Basic Graph Processing

### Simple RDF Graph

**File**: `person-graph.ttl`
```turtle
@prefix ex: <http://example.org/> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .

ex:john a foaf:Person ;
    foaf:name "John Smith" ;
    foaf:email "john@example.com" ;
    foaf:age 30 .

ex:jane a foaf:Person ;
    foaf:name "Jane Doe" ;
    foaf:email "jane@example.com" ;
    foaf:age 25 .
```

**Commands**:
```bash
# Generate graph hash
kgen graph hash person-graph.ttl

# Build searchable index
kgen graph index person-graph.ttl

# Compare with modified version
kgen graph diff person-graph.ttl person-graph-v2.ttl
```

**Expected Output**:
```json
{
  "success": true,
  "operation": "graph:hash",
  "file": "person-graph.ttl",
  "hash": "7a8b9c1d2e3f4a5b6c7d8e9f0a1b2c3d",
  "size": 245,
  "triples": 6,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

---

## API Generation Example

### REST API Schema

**File**: `user-api.ttl`
```turtle
@prefix api: <http://api.example.org/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

# Service Definition
api:UserService a api:RESTService ;
    api:baseURL "http://localhost:3000" ;
    api:version "1.0.0" ;
    rdfs:label "User Management API" .

# Entity Model
api:User a api:Entity ;
    rdfs:label "User" ;
    api:hasProperty api:id, api:name, api:email, api:age .

api:id a api:Property ;
    api:type "string" ;
    api:required true ;
    api:primary true .

api:name a api:Property ;
    api:type "string" ;
    api:required true ;
    api:minLength 2 ;
    api:maxLength 100 .

api:email a api:Property ;
    api:type "string" ;
    api:required true ;
    api:pattern "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$" .

api:age a api:Property ;
    api:type "number" ;
    api:required false ;
    api:min 0 ;
    api:max 150 .

# Endpoints
api:getUser a api:Endpoint ;
    api:method "GET" ;
    api:path "/users/{id}" ;
    api:pathParam api:id ;
    api:response api:User .

api:createUser a api:Endpoint ;
    api:method "POST" ;
    api:path "/users" ;
    api:requestBody api:User ;
    api:response api:User .
```

### API Template

**File**: `_templates/api-service.njk`
```nunjucks
---
to: "{{ service.name | lower }}-service.js"
inject: false
---
/**
 * {{ service.label }}
 * Generated from {{ graph.path }}
 * Hash: {{ graph.hash }}
 */

const express = require('express');
const { body, param, validationResult } = require('express-validator');

class {{ service.name }}Service {
  constructor() {
    this.app = express();
    this.setupRoutes();
  }

  setupRoutes() {
    {% for endpoint in service.endpoints %}
    // {{ endpoint.label }}
    this.app.{{ endpoint.method | lower }}('{{ endpoint.path }}', [
      {% if endpoint.pathParams %}
      {% for param in endpoint.pathParams %}
      param('{{ param.name }}').{{ param.validation }},
      {% endfor %}
      {% endif %}
      {% if endpoint.requestBody %}
      {% for prop in endpoint.requestBody.properties %}
      body('{{ prop.name }}')
        {%- if prop.required %}.notEmpty(){% endif %}
        {%- if prop.type === 'email' %}.isEmail(){% endif %}
        {%- if prop.minLength %}.isLength({ min: {{ prop.minLength }} }){% endif %}
        {%- if prop.maxLength %}.isLength({ max: {{ prop.maxLength }} }){% endif %},
      {% endfor %}
      {% endif %}
    ], this.handle{{ endpoint.name }}Endpoint.bind(this));
    {% endfor %}
  }

  {% for endpoint in service.endpoints %}
  async handle{{ endpoint.name }}Endpoint(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      // Implementation for {{ endpoint.method }} {{ endpoint.path }}
      {% if endpoint.method === 'GET' %}
      const id = req.params.id;
      // Fetch {{ service.entity.name | lower }} by ID
      res.json({ id, message: 'Retrieved successfully' });
      {% elif endpoint.method === 'POST' %}
      const data = req.body;
      // Create new {{ service.entity.name | lower }}
      res.status(201).json({ ...data, id: 'generated-id' });
      {% endif %}
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
  {% endfor %}

  start(port = 3000) {
    this.app.listen(port, () => {
      console.log(`{{ service.label }} listening on port ${port}`);
    });
  }
}

module.exports = {{ service.name }}Service;
```

### Generation Commands

```bash
# Generate API service
kgen artifact generate -g user-api.ttl -t api-service -o ./generated

# View generation details
kgen artifact explain ./generated/userservice-service.js

# Validate reproducibility
kgen deterministic verify ./generated/userservice-service.js
```

**Generated Output**: `generated/userservice-service.js`
```javascript
/**
 * User Management API
 * Generated from user-api.ttl
 * Hash: 7a8b9c1d2e3f4a5b6c7d8e9f0a1b2c3d
 */

const express = require('express');
const { body, param, validationResult } = require('express-validator');

class UserService {
  constructor() {
    this.app = express();
    this.setupRoutes();
  }

  setupRoutes() {
    // Get User
    this.app.get('/users/:id', [
      param('id').notEmpty(),
    ], this.handleGetUserEndpoint.bind(this));

    // Create User  
    this.app.post('/users', [
      body('name').notEmpty().isLength({ min: 2 }).isLength({ max: 100 }),
      body('email').notEmpty().isEmail(),
      body('age').isLength({ min: 0 }).isLength({ max: 150 }),
    ], this.handleCreateUserEndpoint.bind(this));
  }

  async handleGetUserEndpoint(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const id = req.params.id;
      res.json({ id, message: 'Retrieved successfully' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async handleCreateUserEndpoint(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const data = req.body;
      res.status(201).json({ ...data, id: 'generated-id' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  start(port = 3000) {
    this.app.listen(port, () => {
      console.log('User Management API listening on port ${port}');
    });
  }
}

module.exports = UserService;
```

---

## Database Schema Generation

### Schema Definition

**File**: `database-schema.ttl`
```turtle
@prefix db: <http://db.example.org/> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

db:UsersTable a db:Table ;
    rdfs:label "users" ;
    db:hasColumn db:userIdColumn, db:usernameColumn, db:emailColumn .

db:userIdColumn a db:Column ;
    db:name "id" ;
    db:type "UUID" ;
    db:primaryKey true ;
    db:nullable false .

db:usernameColumn a db:Column ;
    db:name "username" ;
    db:type "VARCHAR(100)" ;
    db:nullable false ;
    db:unique true .

db:emailColumn a db:Column ;
    db:name "email" ;
    db:type "VARCHAR(255)" ;
    db:nullable false ;
    db:unique true .

db:PostsTable a db:Table ;
    rdfs:label "posts" ;
    db:hasColumn db:postIdColumn, db:titleColumn, db:authorIdColumn .

db:authorIdColumn a db:Column ;
    db:name "author_id" ;
    db:type "UUID" ;
    db:nullable false ;
    db:foreignKey db:userIdColumn .
```

### Database Template

**File**: `_templates/database/schema/migration.sql.njk`
```nunjucks
---
to: "migrations/{{ timestamp }}_create_{{ table.name }}.sql"
---
-- Migration: Create {{ table.label }}
-- Generated: {{ timestamp }}
-- From: {{ graph.path }}

{% for table in schema.tables %}
CREATE TABLE {{ table.name }} (
  {% for column in table.columns %}
  {{ column.name }} {{ column.type }}
  {%- if column.primaryKey %} PRIMARY KEY{% endif %}
  {%- if not column.nullable %} NOT NULL{% endif %}
  {%- if column.unique %} UNIQUE{% endif %}
  {%- if column.default %} DEFAULT {{ column.default }}{% endif %}
  {%- if not loop.last %},{% endif %}
  {% endfor %}
  {% if table.foreignKeys %}
  ,
  {% for fk in table.foreignKeys %}
  FOREIGN KEY ({{ fk.column }}) REFERENCES {{ fk.referencedTable }}({{ fk.referencedColumn }})
  {%- if not loop.last %},{% endif %}
  {% endfor %}
  {% endif %}
);

{% if table.indexes %}
-- Indexes for {{ table.name }}
{% for index in table.indexes %}
CREATE INDEX idx_{{ table.name }}_{{ index.columns | join('_') }} ON {{ table.name }}({{ index.columns | join(', ') }});
{% endfor %}
{% endif %}

{% endfor %}
```

### Generation Commands

```bash
# Generate database migration
kgen artifact generate -g database-schema.ttl -t database/schema/migration -o ./migrations

# Generate model classes
kgen artifact generate -g database-schema.ttl -t database/schema/model -o ./models
```

---

## Documentation Generation

### API Documentation Schema

**File**: `api-docs.ttl`
```turtle
@prefix docs: <http://docs.example.org/> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

docs:UserAPI a docs:APIDocumentation ;
    docs:title "User Management API" ;
    docs:version "v1.0" ;
    docs:description "RESTful API for user management operations" ;
    docs:hasEndpoint docs:getUserEndpoint, docs:createUserEndpoint .

docs:getUserEndpoint a docs:Endpoint ;
    docs:method "GET" ;
    docs:path "/users/{id}" ;
    docs:summary "Retrieve user by ID" ;
    docs:description "Fetches a single user resource by their unique identifier" ;
    docs:hasParameter docs:userIdParam ;
    docs:hasResponse docs:getUserResponse .

docs:userIdParam a docs:PathParameter ;
    docs:name "id" ;
    docs:type "string" ;
    docs:required true ;
    docs:description "Unique user identifier" .

docs:getUserResponse a docs:Response ;
    docs:statusCode 200 ;
    docs:description "User retrieved successfully" ;
    docs:hasSchema docs:userSchema .

docs:userSchema a docs:Schema ;
    docs:type "object" ;
    docs:hasProperty docs:idProperty, docs:nameProperty, docs:emailProperty .
```

### Documentation Template

**File**: `_templates/api-docs.njk`
```nunjucks
---
to: "docs/{{ api.name | kebab }}-api.md"
---
# {{ api.title }}

**Version**: {{ api.version }}  
**Description**: {{ api.description }}

## Base URL
```
{{ api.baseURL || 'http://localhost:3000' }}
```

## Authentication
{{ api.authentication.description || 'No authentication required' }}

## Endpoints

{% for endpoint in api.endpoints %}
### {{ endpoint.summary }}

**{{ endpoint.method }}** `{{ endpoint.path }}`

{{ endpoint.description }}

{% if endpoint.parameters %}
#### Parameters

| Name | Type | Location | Required | Description |
|------|------|----------|----------|-------------|
{% for param in endpoint.parameters %}
| {{ param.name }} | {{ param.type }} | {{ param.location }} | {{ param.required ? 'Yes' : 'No' }} | {{ param.description }} |
{% endfor %}
{% endif %}

{% if endpoint.requestBody %}
#### Request Body

```json
{{ endpoint.requestBody | jsonify }}
```
{% endif %}

#### Responses

{% for response in endpoint.responses %}
**{{ response.statusCode }}** - {{ response.description }}

{% if response.schema %}
```json
{{ response.schema | jsonify }}
```
{% endif %}
{% endfor %}

#### Example

```bash
curl -X {{ endpoint.method }} {{ api.baseURL }}{{ endpoint.path | replace('{id}', '123') }}{% if endpoint.requestBody %} \
  -H "Content-Type: application/json" \
  -d '{{ endpoint.requestBody | jsonify }}'{% endif %}
```

---
{% endfor %}

## Error Codes

| Code | Description |
|------|-------------|
| 400 | Bad Request - Invalid input parameters |
| 404 | Not Found - Resource not found |
| 500 | Internal Server Error - Server error |

## Rate Limiting

{{ api.rateLimiting.description || 'No rate limiting implemented' }}

---

*Generated by KGEN from {{ graph.path }}*  
*Last updated: {{ timestamp }}*
```

### Generation

```bash
# Generate API documentation
kgen generate docs -g api-docs.ttl -t api-docs -o ./docs/api.md
```

---

## Multi-Template Projects

### Project Structure

```
project/
├── kgen.config.js
├── schemas/
│   ├── user-api.ttl
│   └── blog-api.ttl
├── _templates/
│   ├── api-service.njk
│   ├── database/
│   │   └── migration.sql.njk
│   └── docs/
│       └── api-docs.md.njk
└── generated/
```

### Batch Generation Script

**File**: `scripts/generate-all.sh`
```bash
#!/bin/bash

# Generate all services from schemas
for schema in schemas/*.ttl; do
    echo "Processing $schema..."
    
    # Generate API service
    ./bin/kgen.mjs artifact generate -g "$schema" -t api-service -o ./generated/services
    
    # Generate database migration
    ./bin/kgen.mjs artifact generate -g "$schema" -t database/migration -o ./generated/migrations
    
    # Generate documentation
    ./bin/kgen.mjs generate docs -g "$schema" -t docs/api-docs -o ./generated/docs
done

# Create project lockfile
./bin/kgen.mjs project lock .

# Create project attestation
./bin/kgen.mjs project attest .

echo "Generation complete!"
```

### Project Configuration

**File**: `kgen.config.js`
```javascript
export default {
  directories: {
    out: './generated',
    templates: '_templates',
    cache: '.kgen/cache'
  },
  generate: {
    defaultTemplate: 'api-service',
    attestByDefault: true,
    globalVars: {
      author: 'Development Team',
      license: 'MIT',
      timestamp: () => new Date().toISOString()
    }
  },
  drift: {
    onDrift: 'fail',
    exitCode: 3
  }
};
```

---

## Drift Detection Workflows

### CI/CD Integration

**File**: `.github/workflows/kgen-validation.yml`
```yaml
name: KGEN Validation

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Regenerate artifacts
        run: |
          ./scripts/generate-all.sh
          
      - name: Check for drift
        run: |
          ./bin/kgen.mjs artifact drift ./generated
          
      - name: Verify attestations
        run: |
          ./bin/kgen.mjs project attest .
          ./bin/kgen.mjs validate artifacts ./generated
```

### Drift Detection Commands

```bash
# Check for drift in specific directory
kgen artifact drift ./generated --verbose

# Alternative drift command syntax
kgen drift detect ./generated

# Create baseline for comparison
kgen project lock .

# Compare current state with lockfile
kgen validate artifacts ./generated
```

---

## Advanced RDF Processing

### Complex Knowledge Graph

**File**: `enterprise-schema.ttl`
```turtle
@prefix org: <http://organization.example.org/> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .

# Organization structure
org:Company a owl:Class ;
    rdfs:label "Company" ;
    rdfs:comment "A business organization" .

org:Department a owl:Class ;
    rdfs:label "Department" ;
    rdfs:subClassOf org:OrganizationalUnit .

org:Employee a owl:Class ;
    rdfs:label "Employee" ;
    rdfs:subClassOf org:Person .

# Relationships
org:belongsTo a owl:ObjectProperty ;
    rdfs:domain org:Employee ;
    rdfs:range org:Department .

org:manages a owl:ObjectProperty ;
    rdfs:domain org:Employee ;
    rdfs:range org:Department .

# Data properties
org:employeeId a owl:DatatypeProperty ;
    rdfs:domain org:Employee ;
    rdfs:range owl:string .

org:salary a owl:DatatypeProperty ;
    rdfs:domain org:Employee ;
    rdfs:range owl:decimal .
```

### SPARQL Queries

**File**: `queries/employee-report.sparql`
```sparql
PREFIX org: <http://organization.example.org/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?employeeName ?departmentName ?salary
WHERE {
  ?employee a org:Employee ;
            rdfs:label ?employeeName ;
            org:belongsTo ?department ;
            org:salary ?salary .
  ?department rdfs:label ?departmentName .
}
ORDER BY DESC(?salary)
```

### Query Execution

```bash
# Execute SPARQL query
kgen query sparql -g enterprise-schema.ttl -f queries/employee-report.sparql --format csv

# Inline query
kgen query sparql -g enterprise-schema.ttl -q "SELECT ?s ?p ?o WHERE { ?s a org:Employee }"

# Generate comprehensive graph index
kgen graph index enterprise-schema.ttl
```

### Template with SPARQL Integration

**File**: `_templates/org-chart.njk`
```nunjucks
---
to: "org-chart.html"
sparqlQueries:
  employees: "SELECT ?name ?dept WHERE { ?e a org:Employee ; rdfs:label ?name ; org:belongsTo ?d . ?d rdfs:label ?dept }"
  departments: "SELECT ?name WHERE { ?d a org:Department ; rdfs:label ?name }"
---
<!DOCTYPE html>
<html>
<head>
    <title>Organization Chart</title>
    <style>
        .department { margin: 20px 0; padding: 10px; border: 1px solid #ccc; }
        .employee { margin: 5px 0; padding: 5px; background: #f9f9f9; }
    </style>
</head>
<body>
    <h1>Organization Chart</h1>
    
    {% for dept in sparql.departments %}
    <div class="department">
        <h2>{{ dept.name }}</h2>
        
        {% for employee in sparql.employees %}
        {% if employee.dept === dept.name %}
        <div class="employee">{{ employee.name }}</div>
        {% endif %}
        {% endfor %}
    </div>
    {% endfor %}
</body>
</html>
```

This comprehensive examples guide demonstrates KGEN's power in transforming semantic knowledge graphs into practical, deterministic artifacts across various domains and use cases.