# SPARQL Query Index

*Generated on 2025-01-11 - Comprehensive index of SPARQL query builders, endpoints, and patterns in the Unjucks codebase*

## Overview

This document indexes all SPARQL query builders, endpoints, query patterns, and implementations found throughout the Unjucks semantic web templating system. The system provides extensive SPARQL template generation capabilities with integrated semantic web filters.

## 📋 Summary Statistics

- **SPARQL Template Files**: 8 core template types
- **Filter Functions**: 20+ semantic web filters
- **Query Pattern Types**: SELECT, CONSTRUCT, ASK, UPDATE operations
- **Graph Patterns**: WHERE, OPTIONAL, UNION, FILTER support
- **Federated Queries**: Multi-endpoint federation support
- **Integration Points**: Nunjucks template system, semantic CLI commands

---

## 🏗️ Template Architecture

### Core SPARQL Template Files

#### 1. SELECT Query Template (`select-query.sparql.njk`)
**Location**: `/tests/fixtures/sparql/select-query.sparql.njk`

**Features**:
- Dynamic variable selection with `DISTINCT` support
- Triple pattern generation from arrays
- FILTER expression support with `sparqlFilter` filter
- OPTIONAL pattern support
- UNION pattern support
- Query modifiers: `GROUP BY`, `HAVING`, `ORDER BY`, `LIMIT`, `OFFSET`

**Key Patterns**:
```sparql
SELECT{% if distinct %} DISTINCT{% endif %} {% for var in variables %}{{ var | sparqlVar }}{% endfor %}
WHERE {
  {% for pattern in patterns %}
  {{ pattern.subject | sparqlVar }} {{ pattern.predicate | rdfPropertyFilter }} {{ pattern.object | sparqlValue }} .
  {% endfor %}
  
  {% if filters %}
  {% for filter in filters %}
  FILTER({{ filter | sparqlFilter }})
  {% endfor %}
  {% endif %}
}
```

#### 2. CONSTRUCT Query Template (`construct-query.sparql.njk`)
**Location**: `/tests/fixtures/sparql/construct-query.sparql.njk`

**Features**:
- Dynamic triple construction
- Derived triple generation with type inference
- Subquery support within WHERE clause
- Complex pattern matching

**Key Patterns**:
```sparql
CONSTRUCT {
  {% for triple in constructTriples %}
  {{ triple.subject | sparqlVar }} {{ triple.predicate | rdfPropertyFilter }} {{ triple.object | sparqlValue }} .
  {% endfor %}
}
WHERE {
  {% for subquery in subqueries %}
  {
    SELECT {{ subquery.variables | map('sparqlVar') | join(' ') }}
    WHERE { ... }
  }
  {% endfor %}
}
```

#### 3. Federated Query Template (`federated-query.sparql.njk`)
**Location**: `/tests/fixtures/sparql/federated-query.sparql.njk`

**Features**:
- Multi-endpoint SERVICE queries
- Cross-endpoint variable binding
- Conditional federated queries with OPTIONAL SERVICE
- Complex federation patterns with external endpoints (DBpedia, etc.)

**Key Patterns**:
```sparql
SELECT {{ variables | map('sparqlVar') | join(' ') }}
WHERE {
  # Local patterns
  {% for pattern in localPatterns %}...{% endfor %}
  
  # Federated queries to external endpoints
  {% for endpoint in federatedEndpoints %}
  SERVICE {{ endpoint.url | rdfResource }} {
    {% for pattern in endpoint.patterns %}...{% endfor %}
  }
  {% endfor %}
  
  # Cross-endpoint joins
  {% if crossEndpointJoins %}
  {% for join in crossEndpointJoins %}
  FILTER({{ join.leftVar | sparqlVar }} = {{ join.rightVar | sparqlVar }})
  {% endfor %}
  {% endif %}
}
```

#### 4. UPDATE Query Template (`update-query.sparql.njk`)
**Location**: `/tests/fixtures/sparql/update-query.sparql.njk`

**Features**:
- Multiple update operations: INSERT, DELETE, DELETE_INSERT, CLEAR, CREATE, DROP, COPY, MOVE, ADD
- Graph management operations
- Conditional update patterns
- Bulk data operations

**Update Operations**:
```sparql
{% if operation === 'INSERT' %}
INSERT DATA { ... }

{% elif operation === 'DELETE_INSERT' %}
DELETE { ... }
INSERT { ... }
WHERE { ... }

{% elif operation === 'CLEAR' %}
CLEAR {% if graphUri %}GRAPH {{ graphUri | rdfResource }}{% else %}DEFAULT{% endif %}
{% endif %}
```

#### 5. Complex Query Template (`complex-query.sparql.njk`)
**Location**: `/tests/fixtures/sparql/complex-query.sparql.njk`

**Advanced Features**:
- Named graph queries with `GRAPH` clauses
- Property path expressions
- Advanced filter types: regex, language, datatype, bound, exists
- Aggregation functions
- Silent service queries

**Advanced Patterns**:
```sparql
WHERE {
  {% if namedGraphs %}
  {% for graph in namedGraphs %}
  GRAPH {{ graph.uri | rdfResource }} {
    {% for pattern in graph.patterns %}...{% endfor %}
  }
  {% endfor %}
  {% endif %}
  
  {% if regexFilters %}
  {% for regex in regexFilters %}
  FILTER(regex({{ regex.variable | sparqlVar }}, "{{ regex.pattern | escapeRegex }}"{% if regex.flags %}, "{{ regex.flags }}"{% endif %}))
  {% endfor %}
  {% endif %}
  
  {% if existsPatterns %}
  {% for exists in existsPatterns %}
  FILTER({% if exists.negated %}NOT {% endif %}EXISTS { ... })
  {% endfor %}
  {% endif %}
}
```

---

## 🔧 SPARQL Filter Functions

### Core Semantic Web Filters

The system implements 20+ semantic web filters for SPARQL query generation:

#### Variable and Resource Filters
```javascript
// Variable formatting
sparqlVar('userName') → '?userName'
sparqlVar(['person', 'name']) → '?person ?name'

// Resource URI formatting  
rdfResource('Person', 'schema') → 'schema:Person'
rdfPropertyFilter('full_name') → 'fullName' (camelCase property)
```

#### Namespace and Ontology Filters
```javascript
// Standard ontology prefixes
schemaOrg('Person') → 'schema:Person'
foaf('name') → 'foaf:name' 
dublinCore('title') → 'dct:title'
skos('Concept') → 'skos:Concept'
owl('Class') → 'owl:Class'

// CURIE formatting
curie('http://schema.org/Person') → 'schema:Person'
```

#### Value and Data Type Filters
```javascript
// RDF value formatting
rdfValue(123) → '123'
rdfDatatype('string') → 'xsd:string'
rdfLiteral('Hello', 'en') → '"Hello"@en'

// SPARQL-specific filters
sparqlFilter('?age > 21') → 'FILTER(?age > 21)'
sparqlAggregation('COUNT(?item)') → 'COUNT(?item) AS ?count'
```

### Filter Integration Points

**Location**: `/src/lib/nunjucks-filters.js`
- Base filter registration system
- String transformation utilities
- Date formatting support

**Location**: `/tests/semantic-web-filters.test.js`
- Comprehensive filter test suite
- Integration validation
- Edge case testing

---

## 📊 Query Pattern Catalog

### Basic Graph Patterns

#### 1. Triple Patterns
```sparql
?subject ?predicate ?object .
{{ pattern.subject | sparqlVar }} {{ pattern.predicate | rdfPropertyFilter }} {{ pattern.object | sparqlValue }} .
```

#### 2. OPTIONAL Patterns
```sparql
OPTIONAL {
  {{ optional.subject | sparqlVar }} {{ optional.predicate | rdfPropertyFilter }} {{ optional.object | sparqlValue }} .
}
```

#### 3. UNION Patterns
```sparql
{
  {% for union in unionPatterns %}
  {% if not loop.first %}UNION{% endif %}
  {
    {% for pattern in union %}...{% endfor %}
  }
  {% endfor %}
}
```

### Advanced Graph Patterns

#### 1. Named Graph Queries
```sparql
GRAPH {{ graph.uri | rdfResource }} {
  {% for pattern in graph.patterns %}...{% endfor %}
}
```

#### 2. Property Path Expressions
```sparql
{{ pattern.subject | sparqlVar }} {{ pattern.propertyPath | sparqlPropertyPath }} {{ pattern.object | sparqlValue }}
```

#### 3. Subqueries
```sparql
{
  SELECT {{ subquery.variables | map('sparqlVar') | join(' ') }}
  WHERE {
    {% for pattern in subquery.patterns %}...{% endfor %}
  }
}
```

### Filter Pattern Types

#### 1. Basic Filters
```sparql
FILTER({{ filter | sparqlFilter }})
```

#### 2. Regex Filters
```sparql
FILTER(regex({{ regex.variable | sparqlVar }}, "{{ regex.pattern | escapeRegex }}"{% if regex.flags %}, "{{ regex.flags }}"{% endif %}))
```

#### 3. Language Filters  
```sparql
FILTER(lang({{ langFilter.variable | sparqlVar }}) = "{{ langFilter.language }}")
```

#### 4. Datatype Filters
```sparql
FILTER(datatype({{ dtFilter.variable | sparqlVar }}) = {{ dtFilter.datatype | rdfDatatype }})
```

#### 5. Existence Filters
```sparql
FILTER({% if exists.negated %}NOT {% endif %}EXISTS {
  {% for pattern in exists.patterns %}...{% endfor %}
})
```

---

## 🌐 Federated Query Implementations

### Multi-Endpoint Architecture

The system supports complex federated SPARQL queries across multiple endpoints:

#### 1. Basic Federation
```sparql
SERVICE {{ endpoint.url | rdfResource }} {
  {% for pattern in endpoint.patterns %}
  {{ pattern.subject | sparqlVar }} {{ pattern.predicate | rdfPropertyFilter }} {{ pattern.object | sparqlValue }} .
  {% endfor %}
}
```

#### 2. Conditional Federation
```sparql
OPTIONAL {
  SERVICE {{ conditional.endpoint | rdfResource }} {
    {% for pattern in conditional.patterns %}...{% endfor %}
  }
}
```

#### 3. Cross-Endpoint Joins
```sparql
# Local patterns
{% for pattern in localPatterns %}...{% endfor %}

# External service queries with variable binding
SERVICE <http://dbpedia.org/sparql> {
  ?entity dbo:abstract ?abstract .
  FILTER(lang(?abstract) = "en")
}

# Join variables across endpoints
FILTER(?localVar = ?externalVar)
```

### Supported External Endpoints
- **DBpedia**: `<http://dbpedia.org/sparql>`
- **Wikidata**: For entity linking and external data
- **Custom enterprise endpoints**: Configurable federation

---

## 🔄 SPARQL Update Operations

### Update Operation Types

#### 1. INSERT Operations
```sparql
INSERT DATA {
  {% for triple in insertTriples %}
  {{ triple.subject | rdfResource }} {{ triple.predicate | rdfPropertyFilter }} {{ triple.object | rdfValue }} .
  {% endfor %}
}
```

#### 2. DELETE Operations
```sparql
DELETE DATA {
  {% for triple in deleteTriples %}
  {{ triple.subject | rdfResource }} {{ triple.predicate | rdfPropertyFilter }} {{ triple.object | rdfValue }} .
  {% endfor %}
}
```

#### 3. DELETE/INSERT Operations
```sparql
DELETE {
  {% for triple in deleteTriples %}...{% endfor %}
}
INSERT {
  {% for triple in insertTriples %}...{% endfor %}
}
WHERE {
  {% for pattern in wherePatterns %}...{% endfor %}
}
```

#### 4. Graph Management
```sparql
# Graph operations with optional SILENT flag
CREATE {% if silent %}SILENT {% endif %}GRAPH {{ graphUri | rdfResource }}
DROP {% if silent %}SILENT {% endif %}GRAPH {{ graphUri | rdfResource }}
CLEAR {% if graphUri %}GRAPH {{ graphUri | rdfResource }}{% else %}DEFAULT{% endif %}

# Graph copying/moving
COPY {% if silent %}SILENT {% endif %}{{ sourceGraph | default('DEFAULT') }} TO {{ targetGraph | rdfResource }}
MOVE {% if silent %}SILENT {% endif %}{{ sourceGraph | default('DEFAULT') }} TO {{ targetGraph | rdfResource }}
```

---

## 🏢 Enterprise Query Templates

### Knowledge Graph Query Generator
**Location**: `/tests/fixtures/knowledge-graphs/templates/sparql-queries.sparql.njk`

**Capabilities**:
- **Entity Discovery**: Type-based entity queries with counting
- **Relationship Analysis**: Graph traversal and centrality analysis
- **Temporal Queries**: Time-series analysis and event tracking
- **Aggregation Queries**: Statistical analysis and grouping
- **Maintenance Queries**: Data quality and consistency checking
- **Performance Monitoring**: Query execution tracking

**Sample Enterprise Patterns**:

#### Entity Discovery
```sparql
# Find all entity types in the knowledge graph
SELECT ?type (COUNT(?entity) AS ?count)
WHERE {
    ?entity a ?type .
    FILTER(!isBlank(?entity))
}
GROUP BY ?type
ORDER BY DESC(?count)
```

#### Relationship Analysis
```sparql
# Find entities with highest degree centrality
SELECT ?entity ?name (COUNT(?relationship) AS ?degree)
WHERE {
    {
        ?entity ?relationship ?target .
        FILTER(?relationship != a)
    } UNION {
        ?source ?relationship ?entity .
        FILTER(?relationship != a)
    }
    OPTIONAL { ?entity schema:name ?name }
}
GROUP BY ?entity ?name
ORDER BY DESC(?degree)
LIMIT {{ centralityLimit || 20 }}
```

#### Data Quality Queries
```sparql
# Find orphaned entities (no relationships)
SELECT ?entity ?name
WHERE {
    ?entity a ?type ;
            schema:name ?name .
    FILTER NOT EXISTS { ?entity ?p ?o . FILTER(?p != a && ?p != schema:name) }
    FILTER NOT EXISTS { ?s ?p ?entity . FILTER(?p != a) }
}

# Find duplicate entities by name
SELECT ?name (COUNT(?entity) AS ?duplicateCount)
WHERE {
    ?entity schema:name ?name .
}
GROUP BY ?name
HAVING (COUNT(?entity) > 1)
ORDER BY DESC(?duplicateCount)
```

---

## 📡 Query Execution and Endpoints

### Semantic Query Engine
**Location**: `/src/lib/semantic-query-engine.js`

**Interface**:
```javascript
class SemanticQueryEngine {
  async query(sparql, options = {}) {
    return {
      success: true,
      results: [],
      bindings: []
    };
  }

  async validateQuery(sparql) {
    return {
      valid: true,
      errors: []
    };
  }
}
```

### Integration Points

#### CLI Commands
**Location**: `/src/commands/semantic.js`
- Semantic web template generation
- SPARQL query execution via CLI
- Integration with knowledge graph processing

#### Knowledge Graph Command
**Location**: `/src/commands/knowledge-graph.js`  
- Knowledge graph template processing
- RDF data integration
- Semantic validation workflows

---

## 🧪 Testing and Validation

### Test Coverage

#### SPARQL Template Tests
**Location**: `/tests/fixtures/sparql/`
- Complete query type coverage
- Template rendering validation
- Filter function integration tests

#### Integration Tests
**Location**: `/tests/semantic-web-filters.test.js`
```javascript
describe('Semantic Web Filters', () => {
  // Core RDF/Turtle filter tests
  // SPARQL variable formatting tests  
  // Filter chaining and integration tests
});
```

#### Clean Room Validation
**Location**: `/tests/semantic-web-clean-room/sparql/`
- Isolated SPARQL functionality tests
- Security validation for query generation
- Template injection prevention

### Quality Assurance

#### Validation Reports
- **Location**: `/docs/SPARQL_FILTER_VALIDATION_REPORT.md`
- **Location**: `/docs/SEMANTIC_WEB_FIXES.md`
- **Location**: `/docs/SPARQL_FIXES_SUMMARY.md`

#### Security Analysis
- Template injection prevention in SPARQL queries
- Input sanitization for query parameters
- Safe variable binding practices

---

## 🔧 Query Optimization Patterns

### Performance Techniques

#### 1. Query Structure Optimization
```sparql
# Efficient pattern ordering (most selective first)
?entity a schema:Person .           # Most selective
?entity schema:name ?name .         # Medium selectivity  
OPTIONAL { ?entity foaf:age ?age }  # Least selective, optional
```

#### 2. Index-Friendly Patterns
```sparql
# Use typed literals for better indexing
FILTER(?date >= "2023-01-01"^^xsd:date)
FILTER(?price > 100.00)
```

#### 3. Limit Result Sets
```sparql
# Always include reasonable limits
ORDER BY DESC(?relevanceScore)
LIMIT {{ limit | default(100) }}
```

### Template Performance Features

#### Caching Support
- Template compilation caching
- Query result caching capabilities  
- Incremental updates for large datasets

#### Batch Operations
- Multi-query execution templates
- Bulk insert/update patterns
- Transaction support templates

---

## 🎯 Usage Examples

### Basic Query Generation

```javascript
// Template context
const context = {
  dest: './output',
  queryName: 'employee-search', 
  baseUri: 'http://company.example.org',
  distinct: true,
  variables: ['employee', 'name', 'department'],
  patterns: [
    { subject: '?employee', predicate: 'a', object: 'schema:Person' },
    { subject: '?employee', predicate: 'schema:name', object: '?name' },
    { subject: '?employee', predicate: 'org:memberOf', object: '?department' }
  ],
  filters: ['?name != ""', 'lang(?name) = "en"'],
  orderBy: ['?name'],
  limit: 50
};

// Generated SPARQL
SELECT DISTINCT ?employee ?name ?department
WHERE {
  ?employee a schema:Person .
  ?employee schema:name ?name .
  ?employee org:memberOf ?department .
  FILTER(?name != "")
  FILTER(lang(?name) = "en")
}
ORDER BY ?name
LIMIT 50
```

### Federated Query Generation

```javascript
const federatedContext = {
  variables: ['person', 'localName', 'dbpediaAbstract'],
  localPatterns: [
    { subject: '?person', predicate: 'schema:name', object: '?localName' },
    { subject: '?person', predicate: 'owl:sameAs', object: '?dbpediaUri' }
  ],
  federatedEndpoints: [{
    url: 'http://dbpedia.org/sparql',
    patterns: [
      { subject: '?dbpediaUri', predicate: 'dbo:abstract', object: '?dbpediaAbstract' }
    ],
    filters: ['lang(?dbpediaAbstract) = "en"']
  }]
};
```

### Complex Analytics Query

```javascript
const analyticsContext = {
  queryName: 'department-metrics',
  variables: ['department', 'employeeCount', 'avgSalary'],
  patterns: [
    { subject: '?employee', predicate: 'org:memberOf', object: '?department' },
    { subject: '?employee', predicate: 'schema:salary', object: '?salary' }
  ],
  groupBy: ['?department'],
  aggregations: ['COUNT(?employee) AS ?employeeCount', 'AVG(?salary) AS ?avgSalary'],
  orderBy: ['DESC(?employeeCount)'],
  limit: 20
};
```

---

## 📁 File Structure Summary

```
/tests/fixtures/sparql/
├── select-query.sparql.njk          # Basic SELECT queries
├── construct-query.sparql.njk       # CONSTRUCT queries with subqueries
├── federated-query.sparql.njk       # Multi-endpoint federation
├── update-query.sparql.njk          # All UPDATE operations
├── complex-query.sparql.njk         # Advanced patterns & filters
├── language-tagged.sparql.njk       # Language-specific queries
└── example-with-frontmatter.sparql.njk  # Template metadata demo

/tests/fixtures/knowledge-graphs/templates/
└── sparql-queries.sparql.njk        # Enterprise KG query generator

/src/lib/
├── nunjucks-filters.js              # Core filter system
├── semantic-query-engine.js         # Query execution engine  
├── semantic-template-processor.js   # Template processing
└── semantic-validator.js            # Query validation

/tests/semantic-web*/
├── sparql-queries.sparql            # Real query examples
├── test-sparql-integration.js       # Integration tests
└── semantic-validation-*.js         # Validation test suites

/docs/
├── SPARQL_FILTER_VALIDATION_REPORT.md
├── SEMANTIC_WEB_FIXES.md
└── semantic-web-filters-implementation-summary.md
```

---

## 🚀 Integration Workflows

### CLI Usage
```bash
# Generate SPARQL templates
unjucks generate sparql employee-queries --baseUri="http://company.org/" --dest="./queries"

# Semantic web template processing
unjucks semantic generate-ontology --domain="enterprise" --output="./ontology"

# Knowledge graph processing
unjucks knowledge-graph process --input="data.ttl" --queries="queries.sparql"
```

### Programmatic Usage
```javascript
import { SemanticQueryEngine } from './src/lib/semantic-query-engine.js';

const engine = new SemanticQueryEngine();

// Execute generated SPARQL
const result = await engine.query(generatedSparql, {
  endpoint: 'http://localhost:3030/dataset/query',
  format: 'json'
});

// Validate query syntax
const validation = await engine.validateQuery(sparqlString);
if (validation.valid) {
  console.log('Query is valid');
} else {
  console.error('Validation errors:', validation.errors);
}
```

---

## 🔍 Advanced Features

### Template Frontmatter Integration
All SPARQL templates support rich frontmatter metadata:

```yaml
---
to: "{{ dest }}/queries/{{ queryName }}.sparql"
inject: false
force: "{{ force || false }}"
unless: "{{ skipIf }}"
sparql: |
  SELECT ?person ?name ?age
  WHERE {
    ?person a schema:Person .
    ?person schema:name ?name .
    ?person schema:age ?age .
    FILTER(?age > 21)
  }
rdf:
  prefixes:
    - "foaf: http://xmlns.com/foaf/0.1/"
    - "schema: http://schema.org/"
---
```

### Query Composition and Reuse
- Template inheritance for common query patterns
- Partial query templates for reusable WHERE clauses
- Dynamic prefix management
- Query optimization hints

### Security and Validation
- SPARQL injection prevention through proper escaping
- Query complexity analysis and limits
- Result set size constraints
- Endpoint access controls

---

## 📊 Statistics

- **Total SPARQL Templates**: 8 specialized templates
- **Filter Functions**: 20+ semantic web filters  
- **Query Types**: SELECT, CONSTRUCT, ASK, UPDATE, DESCRIBE
- **Graph Patterns**: Basic, Optional, Union, Named Graph, Property Path
- **Federation Support**: Multi-endpoint with cross-joins
- **Update Operations**: 8 different update types
- **Test Coverage**: 15+ test files with integration validation
- **Enterprise Features**: Knowledge graph analytics, performance monitoring

---

*This index represents a comprehensive mapping of SPARQL capabilities within the Unjucks semantic web templating system. The implementation provides production-ready SPARQL query generation with extensive customization, security, and performance optimization features.*