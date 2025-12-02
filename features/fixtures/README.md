# Unjucks Test Fixtures

This directory contains comprehensive test fixtures and sample data for Unjucks BDD scenario testing.

## Directory Structure

```
fixtures/
├── rdf/                    # RDF/Turtle test data
│   ├── academic-paper.ttl  # Academic research data graph
│   ├── api-specification.ttl # REST API semantic specification
│   ├── component-library.ttl # UI component library metadata
│   └── error-cases.ttl     # Error scenarios and edge cases
├── templates/              # Template files for rendering tests
│   ├── basic-component.ejs # React component template
│   ├── api-endpoint.ejs    # REST API endpoint template
│   ├── database-migration.ejs # Database migration template
│   ├── test-suite.ejs      # Test file template
│   └── error-template.ejs  # Template with intentional errors
├── ontologies/             # SHACL shapes and ontology definitions
│   ├── user-validation.shacl.ttl      # User/API validation shapes
│   └── component-library.shacl.ttl    # UI component validation shapes
├── projects/               # Sample project structures
│   ├── basic-node-api/     # Basic Node.js API project
│   ├── react-component-lib/ # React component library
│   └── basic-git-repo/     # Git repository with history
└── README.md               # This file
```

## RDF Test Data

### academic-paper.ttl
- **Purpose**: Academic research domain testing
- **Content**: Authors, papers, organizations, collaborations
- **Relationships**: FOAF persons, BIBO publications, ORG organizations
- **Use Cases**: Ontology integration, semantic queries, relationship mapping

### api-specification.ttl  
- **Purpose**: REST API semantic specification
- **Content**: Endpoints, schemas, validation rules, rate limits
- **Standards**: Hydra API documentation, OpenAPI semantics
- **Use Cases**: API generation, validation, documentation

### component-library.ttl
- **Purpose**: UI component library metadata  
- **Content**: Components, props, design tokens, categories
- **Standards**: Design system ontology, component specifications
- **Use Cases**: Component generation, documentation, validation

### error-cases.ttl
- **Purpose**: Error scenarios and edge cases
- **Content**: Invalid data, circular references, constraint violations
- **Use Cases**: Validation testing, error handling, robustness

## Template Files

### basic-component.ejs
- **Purpose**: React component generation
- **Variables**: name, description, props, variants, icons
- **Features**: TypeScript support, prop validation, styling

### api-endpoint.ejs
- **Purpose**: REST API endpoint generation
- **Variables**: entityName, properties, relationships, authentication
- **Features**: CRUD operations, validation, error handling

### database-migration.ejs
- **Purpose**: Database migration files
- **Variables**: tableName, properties, relationships, indexes
- **Features**: Sequelize migrations, constraints, foreign keys

### test-suite.ejs
- **Purpose**: Component test generation
- **Variables**: componentName, props, interactions, accessibility
- **Features**: Jest/RTL tests, accessibility testing, edge cases

### error-template.ejs
- **Purpose**: Error scenario testing
- **Content**: Intentional template errors, missing variables
- **Use Cases**: Error handling validation, template debugging

## SHACL Validation Shapes

### user-validation.shacl.ttl
- **Target**: User, Organization, Session entities
- **Validations**: Required fields, data types, constraints
- **Features**: SPARQL-based rules, circular reference detection

### component-library.shacl.ttl  
- **Target**: UI components, design tokens, categories
- **Validations**: Component structure, token formats, dependencies
- **Features**: Design system compliance, accessibility rules

## Sample Projects

### basic-node-api/
- **Type**: Node.js Express API
- **Features**: REST endpoints, middleware, testing setup
- **Dependencies**: Express, Jest, ESLint, TypeScript

### react-component-lib/
- **Type**: React component library
- **Features**: Storybook, Jest, Rollup, TypeScript
- **Dependencies**: React, Storybook, Testing Library

### basic-git-repo/
- **Type**: Git repository with history  
- **Features**: Multiple commits, branches, merges, tags
- **Content**: Basic Node.js project structure

## Usage Patterns

### 80/20 Critical Test Data
The fixtures focus on the most common and critical patterns:
- **User management (40%)**: Authentication, profiles, organizations
- **Component systems (25%)**: UI libraries, design systems
- **API specifications (20%)**: REST endpoints, validation
- **Academic data (15%)**: Research, publications, collaboration

### BDD Scenario Support
Fixtures support all major BDD test categories:
- **Smoke tests**: Basic functionality validation
- **Integration tests**: Cross-system interactions  
- **Performance tests**: Large datasets, complex queries
- **Security tests**: Input validation, injection attempts
- **Error handling**: Edge cases, malformed data

### Template Variable Patterns
Common variable patterns across templates:
- **Entity names**: User, Organization, Component
- **Properties**: id, name, email, type, description  
- **Relationships**: belongsTo, hasMany, references
- **Metadata**: timestamps, versions, creators
- **Configuration**: variants, sizes, options

## Testing Scenarios

### Positive Test Cases
- Valid RDF parsing and querying
- Successful template rendering
- SHACL validation passing
- Git operations completing
- Project initialization working

### Negative Test Cases  
- Malformed RDF/Turtle syntax
- Missing template variables
- SHACL constraint violations
- Git conflicts and errors
- Invalid project structures

### Edge Cases
- Large datasets (10,000+ triples)
- Deep relationship nesting
- Unicode and special characters
- SQL injection attempts
- XSS in template data
- Circular dependencies

### Performance Cases
- Memory usage under limits
- Processing time constraints  
- Concurrent operations
- Cache effectiveness
- Query optimization

## Maintenance

### Adding New Fixtures
1. Follow existing naming conventions
2. Include comprehensive metadata
3. Add both positive and negative cases
4. Document variable patterns
5. Update this README

### Data Consistency
- Use consistent prefixes across RDF files
- Maintain referential integrity
- Follow semantic web best practices
- Validate against SHACL shapes
- Test template rendering

### Version Control
- Track fixture changes with meaningful commits
- Tag stable fixture versions
- Document breaking changes
- Maintain backward compatibility where possible