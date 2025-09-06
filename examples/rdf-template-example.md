# RDF Template Example

This example demonstrates a complete workflow using RDF data with Nunjucks templates to generate TypeScript models, API endpoints, and documentation from semantic data.

## Scenario: Building a Knowledge Management System

We'll create a template that generates a complete TypeScript application structure from RDF ontology data describing a knowledge management system with users, documents, and categories.

## 1. RDF Data Source (ontology.ttl)

First, let's examine our sample RDF data:

```turtle
@prefix ex: <http://example.org/km/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .

# Entity Definitions
ex:User a ex:Entity ;
    rdfs:label "User" ;
    rdfs:comment "Represents a system user" ;
    ex:hasProperty ex:userId, ex:username, ex:email, ex:createdAt ;
    ex:hasRelation ex:ownsDocument, ex:belongsToGroup .

ex:Document a ex:Entity ;
    rdfs:label "Document" ;
    rdfs:comment "Represents a knowledge document" ;
    ex:hasProperty ex:documentId, ex:title, ex:content, ex:publishedAt ;
    ex:hasRelation ex:ownedBy, ex:inCategory, ex:hasTag .

ex:Category a ex:Entity ;
    rdfs:label "Category" ;
    rdfs:comment "Document categorization" ;
    ex:hasProperty ex:categoryId, ex:name, ex:description ;
    ex:hasRelation ex:containsDocument, ex:hasParent .

# Property Definitions
ex:userId a ex:Property ;
    rdfs:label "user_id" ;
    ex:hasDataType xsd:string ;
    ex:isPrimaryKey true ;
    ex:isRequired true .

ex:username a ex:Property ;
    rdfs:label "username" ;
    ex:hasDataType xsd:string ;
    ex:maxLength 50 ;
    ex:isRequired true ;
    ex:isUnique true .

ex:email a ex:Property ;
    rdfs:label "email" ;
    ex:hasDataType xsd:string ;
    ex:pattern "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$" ;
    ex:isRequired true ;
    ex:isUnique true .

ex:createdAt a ex:Property ;
    rdfs:label "created_at" ;
    ex:hasDataType xsd:dateTime ;
    ex:isRequired true .

ex:documentId a ex:Property ;
    rdfs:label "document_id" ;
    ex:hasDataType xsd:string ;
    ex:isPrimaryKey true ;
    ex:isRequired true .

ex:title a ex:Property ;
    rdfs:label "title" ;
    ex:hasDataType xsd:string ;
    ex:maxLength 200 ;
    ex:isRequired true .

ex:content a ex:Property ;
    rdfs:label "content" ;
    ex:hasDataType xsd:string ;
    ex:isLongText true .

ex:publishedAt a ex:Property ;
    rdfs:label "published_at" ;
    ex:hasDataType xsd:dateTime .

# Relations
ex:ownsDocument a ex:Relation ;
    rdfs:label "owns" ;
    ex:hasSource ex:User ;
    ex:hasTarget ex:Document ;
    ex:cardinality "one-to-many" .

ex:inCategory a ex:Relation ;
    rdfs:label "belongs to category" ;
    ex:hasSource ex:Document ;
    ex:hasTarget ex:Category ;
    ex:cardinality "many-to-one" .
```

## 2. Template Structure

Our generator will have multiple templates organized as:

```
templates/
├── api/
│   ├── index.ejs.t
│   ├── models/
│   │   └── entity.ejs.t
│   ├── controllers/
│   │   └── entity-controller.ejs.t
│   └── routes/
│       └── entity-routes.ejs.t
└── docs/
    └── api-documentation.ejs.t
```

## 3. Entity Model Template

**File: `templates/api/models/entity.ejs.t`**

```yaml
---
to: src/models/<%= entityName.toLowerCase() %>.ts
rdf:
  type: file
  path: data/ontology.ttl
entityUri: ex:<%= entityName %>
---
```

```typescript
// Auto-generated model for <%= entityName %>
// Generated from RDF ontology at <%= new Date().toISOString() %>

<%
// Get entity information
const entity = entityUri;
const entityLabel = entity | rdfLabel;
const entityComment = entity | rdfObject('rdfs:comment');
const properties = entity | rdfObject('ex:hasProperty');
const relations = entity | rdfObject('ex:hasRelation');

// Helper function to map XSD types to TypeScript types
function mapDataType(xsdType) {
  const typeMapping = {
    'http://www.w3.org/2001/XMLSchema#string': 'string',
    'http://www.w3.org/2001/XMLSchema#integer': 'number',
    'http://www.w3.org/2001/XMLSchema#decimal': 'number',
    'http://www.w3.org/2001/XMLSchema#boolean': 'boolean',
    'http://www.w3.org/2001/XMLSchema#dateTime': 'Date',
    'http://www.w3.org/2001/XMLSchema#date': 'Date'
  };
  return typeMapping[xsdType] || 'any';
}
%>

<% if (entityComment.length > 0) { %>
/**
 * <%= entityComment[0].value %>
 */
<% } %>
export interface I<%= entityLabel %> {
  <% for (const prop of properties) { %>
  <% 
    const propUri = prop.value;
    const propLabel = propUri | rdfLabel;
    const dataType = propUri | rdfObject('ex:hasDataType');
    const isRequired = propUri | rdfExists('ex:isRequired', '"true"^^xsd:boolean');
    const tsType = dataType.length > 0 ? mapDataType(dataType[0].value) : 'string';
  %>
  /** <%= propUri | rdfObject('rdfs:comment') %> */
  <%= propLabel.toLowerCase().replace(/\s+/g, '_') %><%= isRequired ? '' : '?' %>: <%= tsType %>;
  <% } %>
  
  <% for (const rel of relations) { %>
  <% 
    const relUri = rel.value;
    const relLabel = relUri | rdfLabel;
    const target = relUri | rdfObject('ex:hasTarget');
    const cardinality = relUri | rdfObject('ex:cardinality');
    
    if (target.length > 0) {
      const targetLabel = target[0].value | rdfLabel;
      const isMany = cardinality.length > 0 && cardinality[0].value.includes('many');
  %>
  /** Relationship: <%= relLabel %> */
  <%= relLabel.toLowerCase().replace(/\s+/g, '_') %>?: <% if (isMany) { %><%= targetLabel %>[]<% } else { %><%= targetLabel %><% } %>;
  <% 
    }
  } %>
}

export class <%= entityLabel %> implements I<%= entityLabel %> {
  <% for (const prop of properties) { %>
  <% 
    const propUri = prop.value;
    const propLabel = propUri | rdfLabel;
    const dataType = propUri | rdfObject('ex:hasDataType');
    const isRequired = propUri | rdfExists('ex:isRequired', '"true"^^xsd:boolean');
    const tsType = dataType.length > 0 ? mapDataType(dataType[0].value) : 'string';
  %>
  public <%= propLabel.toLowerCase().replace(/\s+/g, '_') %><%= isRequired ? '' : '?' %>: <%= tsType %>;
  <% } %>

  constructor(data: Partial<I<%= entityLabel %>>) {
    <% for (const prop of properties) { %>
    <% 
      const propLabel = prop.value | rdfLabel;
      const fieldName = propLabel.toLowerCase().replace(/\s+/g, '_');
    %>
    if (data.<%= fieldName %> !== undefined) {
      this.<%= fieldName %> = data.<%= fieldName %>;
    }
    <% } %>
  }

  /**
   * Validation method based on RDF constraints
   */
  validate(): string[] {
    const errors: string[] = [];

    <% for (const prop of properties) { %>
    <% 
      const propUri = prop.value;
      const propLabel = propUri | rdfLabel;
      const fieldName = propLabel.toLowerCase().replace(/\s+/g, '_');
      const isRequired = propUri | rdfExists('ex:isRequired', '"true"^^xsd:boolean');
      const maxLength = propUri | rdfObject('ex:maxLength');
      const pattern = propUri | rdfObject('ex:pattern');
    %>
    
    <% if (isRequired) { %>
    if (!this.<%= fieldName %>) {
      errors.push('<%= propLabel %> is required');
    }
    <% } %>
    
    <% if (maxLength.length > 0) { %>
    if (this.<%= fieldName %> && this.<%= fieldName %>.length > <%= maxLength[0].value %>) {
      errors.push('<%= propLabel %> must be <%= maxLength[0].value %> characters or less');
    }
    <% } %>
    
    <% if (pattern.length > 0) { %>
    if (this.<%= fieldName %> && !/<%= pattern[0].value %>/.test(this.<%= fieldName %>)) {
      errors.push('<%= propLabel %> has invalid format');
    }
    <% } %>
    <% } %>

    return errors;
  }

  /**
   * Serialize to JSON
   */
  toJSON(): I<%= entityLabel %> {
    return {
      <% for (const prop of properties) { %>
      <% 
        const propLabel = prop.value | rdfLabel;
        const fieldName = propLabel.toLowerCase().replace(/\s+/g, '_');
      %>
      <%= fieldName %>: this.<%= fieldName %>,
      <% } %>
    };
  }

  /**
   * Create from JSON
   */
  static fromJSON(json: I<%= entityLabel %>): <%= entityLabel %> {
    return new <%= entityLabel %>(json);
  }
}

export default <%= entityLabel %>;
```

## 4. API Controller Template  

**File: `templates/api/controllers/entity-controller.ejs.t`**

```yaml
---
to: src/controllers/<%= entityName.toLowerCase() %>-controller.ts
rdf:
  type: file
  path: data/ontology.ttl
entityUri: ex:<%= entityName %>
---
```

```typescript
// Auto-generated controller for <%= entityName %>
import { Request, Response } from 'express';
import { <%= entityName %>, I<%= entityName %> } from '../models/<%= entityName.toLowerCase() %>';

<%
const entity = entityUri;
const entityLabel = entity | rdfLabel;
const properties = entity | rdfObject('ex:hasProperty');
const primaryKey = properties.find(p => p.value | rdfExists('ex:isPrimaryKey', '"true"^^xsd:boolean'));
const pkField = primaryKey ? (primaryKey.value | rdfLabel).toLowerCase().replace(/\s+/g, '_') : 'id';
%>

export class <%= entityLabel %>Controller {
  /**
   * Get all <%= entityLabel.toLowerCase() %>s
   * GET /<%= entityLabel.toLowerCase() %>s
   */
  async getAll(req: Request, res: Response): Promise<void> {
    try {
      // TODO: Implement database query
      const <%= entityLabel.toLowerCase() %>s: I<%= entityLabel %>[] = [];
      
      res.json({
        success: true,
        data: <%= entityLabel.toLowerCase() %>s,
        count: <%= entityLabel.toLowerCase() %>s.length
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve <%= entityLabel.toLowerCase() %>s',
        error: error.message
      });
    }
  }

  /**
   * Get <%= entityLabel.toLowerCase() %> by <%= pkField %>
   * GET /<%= entityLabel.toLowerCase() %>s/:<%= pkField %>
   */
  async getById(req: Request, res: Response): Promise<void> {
    try {
      const { <%= pkField %> } = req.params;
      
      // TODO: Implement database query
      const <%= entityLabel.toLowerCase() %>: I<%= entityLabel %> | null = null;
      
      if (!<%= entityLabel.toLowerCase() %>) {
        res.status(404).json({
          success: false,
          message: '<%= entityLabel %> not found'
        });
        return;
      }

      res.json({
        success: true,
        data: <%= entityLabel.toLowerCase() %>
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve <%= entityLabel.toLowerCase() %>',
        error: error.message
      });
    }
  }

  /**
   * Create new <%= entityLabel.toLowerCase() %>
   * POST /<%= entityLabel.toLowerCase() %>s
   */
  async create(req: Request, res: Response): Promise<void> {
    try {
      const <%= entityLabel.toLowerCase() %>Data: I<%= entityLabel %> = req.body;
      const <%= entityLabel.toLowerCase() %> = new <%= entityLabel %>(<%= entityLabel.toLowerCase() %>Data);
      
      // Validate data based on RDF constraints
      const validationErrors = <%= entityLabel.toLowerCase() %>.validate();
      if (validationErrors.length > 0) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: validationErrors
        });
        return;
      }

      // TODO: Save to database
      
      res.status(201).json({
        success: true,
        message: '<%= entityLabel %> created successfully',
        data: <%= entityLabel.toLowerCase() %>.toJSON()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to create <%= entityLabel.toLowerCase() %>',
        error: error.message
      });
    }
  }

  /**
   * Update <%= entityLabel.toLowerCase() %>
   * PUT /<%= entityLabel.toLowerCase() %>s/:<%= pkField %>
   */
  async update(req: Request, res: Response): Promise<void> {
    try {
      const { <%= pkField %> } = req.params;
      const updateData: Partial<I<%= entityLabel %>> = req.body;
      
      // TODO: Find existing record and update
      
      res.json({
        success: true,
        message: '<%= entityLabel %> updated successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to update <%= entityLabel.toLowerCase() %>',
        error: error.message
      });
    }
  }

  /**
   * Delete <%= entityLabel.toLowerCase() %>
   * DELETE /<%= entityLabel.toLowerCase() %>s/:<%= pkField %>
   */
  async delete(req: Request, res: Response): Promise<void> {
    try {
      const { <%= pkField %> } = req.params;
      
      // TODO: Delete from database
      
      res.json({
        success: true,
        message: '<%= entityLabel %> deleted successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to delete <%= entityLabel.toLowerCase() %>',
        error: error.message
      });
    }
  }
}

export default new <%= entityLabel %>Controller();
```

## 5. API Documentation Template

**File: `templates/docs/api-documentation.ejs.t`**

```yaml
---
to: docs/api/README.md
rdf:
  type: file
  path: data/ontology.ttl
---
```

```markdown
# Knowledge Management System API

Auto-generated API documentation based on RDF ontology.

<%
// Get all entities
const entities = '' | rdfSubject('rdf:type', 'ex:Entity');
%>

## Overview

This API provides endpoints for managing a knowledge management system with the following entities:

<% for (const entityUri of entities) { %>
<% 
  const entityLabel = entityUri | rdfLabel;
  const entityComment = entityUri | rdfObject('rdfs:comment');
%>
- **<%= entityLabel %>**: <%= entityComment.length > 0 ? entityComment[0].value : 'No description available' %>
<% } %>

## Authentication

All endpoints require authentication. Include your API token in the Authorization header:

```
Authorization: Bearer your-api-token
```

## Entities

<% for (const entityUri of entities) { %>
<% 
  const entityLabel = entityUri | rdfLabel;
  const entityComment = entityUri | rdfObject('rdfs:comment');
  const properties = entityUri | rdfObject('ex:hasProperty');
  const relations = entityUri | rdfObject('ex:hasRelation');
  const primaryKey = properties.find(p => p.value | rdfExists('ex:isPrimaryKey', '"true"^^xsd:boolean'));
  const pkField = primaryKey ? (primaryKey.value | rdfLabel).toLowerCase().replace(/\s+/g, '_') : 'id';
%>

### <%= entityLabel %>

<%= entityComment.length > 0 ? entityComment[0].value : 'No description available' %>

#### Properties

| Field | Type | Required | Description |
|-------|------|----------|-------------|
<% for (const prop of properties) { %>
<% 
  const propUri = prop.value;
  const propLabel = propUri | rdfLabel;
  const fieldName = propLabel.toLowerCase().replace(/\s+/g, '_');
  const dataType = propUri | rdfObject('ex:hasDataType');
  const isRequired = propUri | rdfExists('ex:isRequired', '"true"^^xsd:boolean');
  const propComment = propUri | rdfObject('rdfs:comment');
  const maxLength = propUri | rdfObject('ex:maxLength');
  
  let typeInfo = dataType.length > 0 ? dataType[0].value.split('#')[1] || 'string' : 'string';
  if (maxLength.length > 0) {
    typeInfo += ` (max: ${maxLength[0].value})`;
  }
%>
| `<%= fieldName %>` | <%= typeInfo %> | <%= isRequired ? 'Yes' : 'No' %> | <%= propComment.length > 0 ? propComment[0].value : '-' %> |
<% } %>

#### Relationships

<% if (relations.length > 0) { %>
| Relationship | Target | Cardinality | Description |
|--------------|--------|-------------|-------------|
<% for (const rel of relations) { %>
<% 
  const relUri = rel.value;
  const relLabel = relUri | rdfLabel;
  const target = relUri | rdfObject('ex:hasTarget');
  const cardinality = relUri | rdfObject('ex:cardinality');
  const relComment = relUri | rdfObject('rdfs:comment');
  
  const targetLabel = target.length > 0 ? target[0].value | rdfLabel : 'Unknown';
  const cardinalityLabel = cardinality.length > 0 ? cardinality[0].value : 'Unknown';
%>
| `<%= relLabel %>` | <%= targetLabel %> | <%= cardinalityLabel %> | <%= relComment.length > 0 ? relComment[0].value : '-' %> |
<% } %>
<% } else { %>
No relationships defined.
<% } %>

#### Endpoints

##### GET /<%= entityLabel.toLowerCase() %>s
Get all <%= entityLabel.toLowerCase() %>s with optional filtering and pagination.

**Response:**
```json
{
  "success": true,
  "data": [<%= entityLabel %>],
  "count": number
}
```

##### GET /<%= entityLabel.toLowerCase() %>s/:<%= pkField %>
Get a specific <%= entityLabel.toLowerCase() %> by <%= pkField %>.

**Response:**
```json
{
  "success": true,
  "data": <%= entityLabel %>
}
```

##### POST /<%= entityLabel.toLowerCase() %>s
Create a new <%= entityLabel.toLowerCase() %>.

**Request Body:**
```json
{
<% for (const prop of properties) { %>
<% 
  const propUri = prop.value;
  const propLabel = propUri | rdfLabel;
  const fieldName = propLabel.toLowerCase().replace(/\s+/g, '_');
  const dataType = propUri | rdfObject('ex:hasDataType');
  const isRequired = propUri | rdfExists('ex:isRequired', '"true"^^xsd:boolean');
  
  let sampleValue;
  if (dataType.length > 0) {
    const dt = dataType[0].value;
    if (dt.includes('string')) sampleValue = '"string"';
    else if (dt.includes('integer') || dt.includes('decimal')) sampleValue = 'number';
    else if (dt.includes('boolean')) sampleValue = 'boolean';
    else if (dt.includes('dateTime') || dt.includes('date')) sampleValue = '"2024-01-01T00:00:00Z"';
    else sampleValue = '"value"';
  } else {
    sampleValue = '"string"';
  }
%>
  "<%= fieldName %>": <%= sampleValue %><%= isRequired ? '' : ' // optional' %><%= loop.last ? '' : ',' %>
<% } %>
}
```

##### PUT /<%= entityLabel.toLowerCase() %>s/:<%= pkField %>
Update an existing <%= entityLabel.toLowerCase() %>.

##### DELETE /<%= entityLabel.toLowerCase() %>s/:<%= pkField %>
Delete a <%= entityLabel.toLowerCase() %>.

---

<% } %>

## Error Responses

All endpoints may return the following error responses:

### 400 Bad Request
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": ["Error description"]
}
```

### 404 Not Found
```json
{
  "success": false,
  "message": "Resource not found"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "message": "Internal server error",
  "error": "Error details"
}
```

## Data Types

### Common XSD Types Mapping

| XSD Type | TypeScript Type | JSON Type | Description |
|----------|-----------------|-----------|-------------|
| xsd:string | string | string | Text data |
| xsd:integer | number | number | Integer numbers |
| xsd:decimal | number | number | Decimal numbers |
| xsd:boolean | boolean | boolean | True/false values |
| xsd:dateTime | Date | string | ISO 8601 date-time |
| xsd:date | Date | string | ISO 8601 date |

---

*Generated from RDF ontology on <%= new Date().toISOString() %>*
```

## 6. Using the Templates

### Command Examples

Generate models for all entities:
```bash
# Generate User model
unjucks generate api/models/entity --entityName=User

# Generate Document model  
unjucks generate api/models/entity --entityName=Document

# Generate Category model
unjucks generate api/models/entity --entityName=Category
```

Generate controllers:
```bash
# Generate all controllers
unjucks generate api/controllers/entity-controller --entityName=User
unjucks generate api/controllers/entity-controller --entityName=Document  
unjucks generate api/controllers/entity-controller --entityName=Category
```

Generate documentation:
```bash
# Generate API documentation
unjucks generate docs/api-documentation
```

### Batch Generation

Create a script to generate everything at once:

```javascript
// scripts/generate-api.js
const entities = ['User', 'Document', 'Category'];

for (const entity of entities) {
  // Generate model
  await unjucks.generate('api/models/entity', { entityName: entity });
  
  // Generate controller
  await unjucks.generate('api/controllers/entity-controller', { entityName: entity });
}

// Generate documentation
await unjucks.generate('docs/api-documentation');
```

## 7. Generated Output Structure

The templates will generate:

```
src/
├── models/
│   ├── user.ts
│   ├── document.ts
│   └── category.ts
├── controllers/
│   ├── user-controller.ts
│   ├── document-controller.ts
│   └── category-controller.ts
└── routes/
    └── index.ts
docs/
└── api/
    └── README.md
```

This example demonstrates how RDF filters enable sophisticated code generation from semantic data, creating type-safe, validated, and well-documented APIs directly from ontological definitions.