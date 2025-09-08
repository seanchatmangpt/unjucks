# Spec-to-Code Transformation Engine

A powerful engine that transforms specifications into code using template-based generation with full traceability.

## Overview

The Spec-to-Code Transformation Engine consists of four main components:

1. **Parser** - Extracts structured data from various specification formats
2. **Mapper** - Maps specifications to appropriate templates  
3. **Generator** - Generates code using templates with variable substitution
4. **Traceability** - Maintains links between spec elements and generated code

## Supported Formats

- **YAML** - Structured specification files
- **JSON** - JSON specification format
- **Markdown** - Documentation-driven specifications
- **OpenAPI** - REST API specifications

## Quick Start

```typescript
import { SpecEngine } from './src/core/spec-engine/index.js';

// Initialize engine
const engine = new SpecEngine({
  templatesDirectory: 'templates',
  outputDirectory: 'src/generated',
  mappingFile: 'template-mappings.yaml'
});

await engine.initialize();

// Transform specification to code
const yamlSpec = `
name: User Service
entities:
  - name: User
    type: model
    properties:
      - name: id
        type: string
      - name: email
        type: string
`;

const result = await engine.transformSpecToCode(yamlSpec, 'yaml');

console.log(`Generated ${result.files.length} files`);
console.log(`Processed ${result.metadata.statistics.entitiesProcessed} entities`);
```

## Architecture

### Parser Component

Extracts structured data from specifications:

```typescript
const parser = new SpecificationParser();
const spec = await parser.parseSpecification(content, 'yaml', {
  strict: false,
  validateSchema: true,
  includeComments: true,
  resolveReferences: true
});
```

### Mapper Component

Maps specifications to templates based on patterns:

```typescript
const mapper = new TemplateMapper('templates', 'mappings.yaml');
await mapper.initialize();

const mappings = await mapper.findMatchingTemplates(spec);
const variables = await mapper.mapVariables(spec, mappings[0]);
```

### Generator Component

Generates code from templates:

```typescript
const generator = new CodeGenerator(mapper, 'templates', 'output');
const result = await generator.generateFromSpecification(spec, {
  dryRun: false,
  overwriteExisting: false,
  createDirectories: true,
  includeTraceability: true
});
```

### Traceability Component

Tracks relationships between spec elements and generated code:

```typescript
const tracker = engine.getTraceabilityTracker();
const records = tracker.getRecordsForFile('user.model.ts');
const report = tracker.generateTraceabilityReport(spec);
```

## Specification Format

### YAML Specification

```yaml
name: User Management System
version: 1.0.0
description: A system for managing users
metadata:
  author: Developer
  category: business
  priority: high

entities:
  - id: user-entity
    name: User
    type: model
    properties:
      - name: id
        type: string
        required: true
      - name: email
        type: string
        required: true
        constraints:
          - type: pattern
            value: "^[^@]+@[^@]+\\.[^@]+$"

relationships:
  - type: hasOne
    source:
      entityId: user-entity
    target:
      entityId: profile-entity

constraints:
  - type: validation
    description: Email must be unique
    entities: [user-entity]
    expression: "UNIQUE(email)"

context:
  domain: user-management
  technology:
    language: typescript
    framework: nestjs
    database: postgresql
```

### Markdown Specification

```markdown
# User Management System

A comprehensive system for managing users.

## Entities

Entity: User
- id: string
- email: string
- name: string

Service: UserService
- createUser: method
- getUserById: method

## Requirements

- Users must be able to register
- Passwords must be secure
```

## Template System

Templates use Nunjucks with custom filters and frontmatter:

```ejs
---
entityTypes:
  - model
to: models/{{ entityName | kebabCase }}.model.ts
variables:
  entityName: entities[0].name
  properties: entities[0].properties
---
export class {{ entityName }} {
  {% for property in properties %}
  {{ property.name }}: {{ property.type }};
  {% endfor %}
}
```

### Available Filters

- `camelCase` - Convert to camelCase
- `pascalCase` - Convert to PascalCase  
- `kebabCase` - Convert to kebab-case
- `snakeCase` - Convert to snake_case
- `pluralize` - Make plural
- `singularize` - Make singular

### Frontmatter Options

- `to` - Output file path
- `inject` - Injection mode (before, after, append, prepend)
- `skipIf` - Condition to skip generation
- `chmod` - File permissions
- `entityTypes` - Matching entity types
- `variables` - Variable mappings

## Template Mappings

Configure how specs map to templates:

```yaml
models:
  - specPattern:
      entityTypes: [model]
      technologyStack:
        language: typescript
    templatePath: typescript/model.ejs
    variables:
      entityName:
        specPath: name
        transformer: pascalCase
    priority: 20
```

## Advanced Features

### Multiple File Generation

Generate multiple files from one template:

```ejs
---
files:
  - to: models/{{ entityName }}.model.ts
  - to: dtos/{{ entityName }}.dto.ts
    skipIf: "{{ skipDto }}"
---
Template content here...
```

### File Injection

Inject code into existing files:

```ejs
---
to: existing-file.ts
inject: after
afterPattern: "// INSERT NEW METHODS"
---
public newMethod(): void {
  // Implementation
}
```

### Conditional Generation

Skip generation based on conditions:

```ejs
---
to: {{ entityName }}.ts
skipIf: "{{ entity.type != 'model' }}"
---
Content only for models...
```

## Traceability

Track relationships between specifications and generated code:

```typescript
// Get traceability for a file
const records = tracker.getRecordsForFile('user.model.ts');

// Find files that contain a spec element
const files = tracker.findGeneratedFilesForSpecElement('user-entity');

// Generate comprehensive report
const report = tracker.generateTraceabilityReport(spec);
console.log(`Coverage: ${report.coverage.coveragePercentage}%`);
```

## Integration with Unjucks

The spec engine integrates with the existing unjucks pipeline:

1. Parse specifications using the spec engine parser
2. Map to templates using intelligent matching
3. Generate code with full traceability
4. Maintain compatibility with existing unjucks templates

## Error Handling

The engine provides comprehensive error handling:

```typescript
const result = await engine.transformSpecToCode(spec, 'yaml');

// Check for errors
if (result.errors.length > 0) {
  result.errors.forEach(error => {
    console.error(`${error.type}: ${error.message}`);
  });
}

// Check for warnings
result.warnings.forEach(warning => {
  console.warn(`${warning.type}: ${warning.message}`);
  console.warn(`Suggestions: ${warning.suggestions.join(', ')}`);
});
```

## Performance

- Parallel template processing
- Template caching
- Efficient pattern matching
- Memory-conscious traceability tracking

## Testing

Comprehensive test suite covering:

- Parser for all supported formats
- Template mapping with various patterns
- Code generation with different options
- Traceability tracking accuracy
- Integration scenarios

```bash
npm test -- tests/core/spec-engine/
```

## Examples

See the `examples/` directory for:

- Sample specifications in different formats
- Template mapping configurations
- Generated code samples
- Integration examples

## Contributing

1. Follow existing code patterns
2. Add tests for new features
3. Update documentation
4. Ensure backward compatibility