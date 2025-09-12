# KGEN Frontmatter Workflow System

The KGEN Frontmatter Workflow System is a comprehensive template processing engine that enables metadata-driven artifact generation with deterministic output, provenance tracking, and audit trails.

## Overview

The frontmatter workflow system extends KGEN's capabilities by providing:

- **Metadata-driven template processing** with YAML frontmatter
- **Multiple operation modes** (write, inject, append, prepend, lineAt)
- **Conditional processing** with skipIf logic
- **Dynamic path resolution** with Nunjucks template rendering
- **Schema validation** for frontmatter consistency
- **Comprehensive metadata extraction** for audit trails
- **Security analysis** of templates and operations
- **Provenance tracking** for all operations

## Architecture

The system consists of several interconnected components:

### Core Components

1. **FrontmatterWorkflowEngine** - Main orchestration engine
2. **FrontmatterParser** - YAML frontmatter parsing with validation
3. **PathResolver** - Dynamic output path resolution
4. **ConditionalProcessor** - skipIf condition evaluation
5. **OperationEngine** - File operation execution
6. **SchemaValidator** - Frontmatter schema validation
7. **MetadataExtractor** - Comprehensive metadata analysis

### Integration

The system integrates seamlessly with KGEN's core engine through the `_processTemplate` and `_executeGeneration` methods, replacing placeholder template processing with production-ready frontmatter-driven workflow.

## Template Structure

Templates use YAML frontmatter to define metadata and processing instructions:

```yaml
---
to: "{{ outputDir }}/{{ name | kebabCase }}.ts"
inject: false
append: false
prepend: false
skipIf: "environment == 'production'"
variables:
  name:
    type: string
    required: true
    description: Component name
  outputDir:
    type: string
    default: "./src/components"
chmod: "644"
sh:
  - "echo 'Generated {{ name }}'"
---
// Template content with Nunjucks syntax
export const {{ name | pascalCase }} = {
  // Component implementation
};
```

## Frontmatter Fields

### Core Fields

- **`to`** - Output file path (supports Nunjucks templating)
- **`operationMode`** - Explicit operation mode (write/inject/append/prepend/lineAt)

### Operation Mode Fields

- **`inject`** - Enable injection mode (boolean)
- **`append`** - Enable append mode (boolean)
- **`prepend`** - Enable prepend mode (boolean)
- **`lineAt`** - Insert at specific line number (integer)

### Injection Configuration

- **`before`** - Inject before this marker (string)
- **`after`** - Inject after this marker (string)

### Conditional Processing

- **`skipIf`** - Skip condition expression (string)
- **`when`** - Alternative to skipIf (boolean/string)

### File Operations

- **`chmod`** - File permissions (octal string or number)
- **`overwrite`** - Allow file overwriting (boolean)
- **`backup`** - Create backup before modification (boolean)
- **`createDirectories`** - Create parent directories (boolean, default: true)

### Shell Commands

- **`sh`** - Shell commands to execute after operation (array of strings)

### Variable Definitions

- **`variables`** - Variable schema definitions (object)

```yaml
variables:
  componentName:
    type: string
    required: true
    description: Name of the component to generate
  withTests:
    type: boolean
    default: false
    description: Include test files
  framework:
    type: string
    choices: ["react", "vue", "angular"]
    default: "react"
```

## Operation Modes

### Write Mode (Default)

Creates or overwrites a file with the rendered template content.

```yaml
---
to: "src/{{ name }}.ts"
# write mode is default
---
export const {{ name }} = {};
```

### Append Mode

Adds content to the end of an existing file.

```yaml
---
to: "src/index.ts"
append: true
---
export { {{ name }} } from './{{ name }}';
```

### Prepend Mode

Adds content to the beginning of an existing file.

```yaml
---
to: "src/imports.ts"
prepend: true
---
import { {{ name }} } from './{{ name }}';
```

### Injection Mode

Inserts content at specific markers or locations within an existing file.

```yaml
---
to: "src/config.ts"
inject: true
after: "// INJECT_COMPONENTS"
---
  {{ name }}: () => import('./components/{{ name }}'),
```

### LineAt Mode

Inserts content at a specific line number.

```yaml
---
to: "src/routes.ts"
lineAt: 10
---
{ path: '/{{ name }}', component: {{ name | pascalCase }} },
```

## Conditional Processing

Templates can be conditionally processed using the `skipIf` field:

### Simple Conditions

```yaml
---
to: "{{ name }}.ts"
skipIf: "skipGeneration"
---
```

### Expression Conditions

```yaml
---
to: "{{ name }}.test.ts"
skipIf: "!withTests"
---
```

### Complex Conditions

```yaml
---
to: "{{ name }}.spec.ts"
skipIf: "environment == 'production' && !includeTests"
---
```

### Utility Functions

Available functions in skipIf expressions:

- `exists(variable)` - Check if variable exists and is not null/undefined
- `empty(value)` - Check if value is empty (string, array, object)
- `length(value)` - Get length of string, array, or object keys
- `includes(collection, item)` - Check if collection includes item
- `startsWith(string, prefix)` - Check if string starts with prefix
- `endsWith(string, suffix)` - Check if string ends with suffix

## Dynamic Path Resolution

Output paths support Nunjucks template syntax with built-in filters:

### Path Filters

- `dirname` - Get directory name
- `basename` - Get base filename
- `extname` - Get file extension
- `join` - Join path components

### String Filters

- `kebabCase` - Convert to kebab-case
- `camelCase` - Convert to camelCase
- `pascalCase` - Convert to PascalCase
- `snakeCase` - Convert to snake_case
- `titleCase` - Convert to Title Case

### Example

```yaml
---
to: "{{ category | kebabCase }}/{{ name | pascalCase }}/{{ name | kebabCase }}.component.ts"
---
```

## Schema Validation

Templates can be validated against predefined schemas:

### Built-in Schemas

- **`default`** - Basic validation (minimal requirements)
- **`basic`** - Standard frontmatter fields
- **`kgen`** - KGEN-specific extensions

### Custom Schemas

Register custom schemas programmatically:

```javascript
import { SchemaValidator } from '@kgen/frontmatter';

const validator = new SchemaValidator();

validator.registerSchema('component', {
  type: 'object',
  required: ['to'],
  properties: {
    to: { type: 'string', format: 'path' },
    componentType: { 
      type: 'string', 
      enum: ['functional', 'class', 'hook'] 
    }
  }
});
```

## CLI Commands

### Show Enhanced Template Information

Display comprehensive template analysis including frontmatter metadata:

```bash
kgen templates show-enhanced --name api-service --validate --security
```

Options:
- `--metadata` - Extract comprehensive metadata
- `--validate` - Validate frontmatter against schema
- `--security` - Perform security analysis
- `--variables` - Extract and analyze variables
- `--dependencies` - Analyze template dependencies
- `--complexity` - Calculate complexity metrics

### Validate Templates

Validate template frontmatter against schemas:

```bash
kgen templates validate --name api-service --schema kgen
```

Options:
- `--schema` - Schema name for validation
- `--pattern` - Glob pattern for templates
- `--strict` - Enable strict validation mode
- `--fail-fast` - Stop on first validation error
- `--show-valid` - Show valid templates in output

## API Usage

### Basic Template Processing

```javascript
import { processTemplate } from '@kgen/frontmatter';

const template = `---
to: "src/{{ name }}.ts"
---
export const {{ name }} = {};`;

const context = { name: 'MyComponent' };

const result = await processTemplate(template, context);
console.log(result.artifacts); // Generated files
```

### Batch Processing

```javascript
import { processTemplates } from '@kgen/frontmatter';

const templates = [
  { content: template1, context: context1 },
  { content: template2, context: context2 }
];

const result = await processTemplates(templates);
console.log(`${result.successful}/${result.total} templates processed`);
```

### Advanced Configuration

```javascript
import { FrontmatterWorkflowEngine } from '@kgen/frontmatter';

const engine = new FrontmatterWorkflowEngine({
  enableValidation: true,
  enableProvenance: true,
  enableConditionalProcessing: true,
  maxConcurrentOperations: 10,
  deterministic: true
});

await engine.initialize();

try {
  const result = await engine.processTemplate(template, context, {
    enableSchemaValidation: true,
    schema: 'component'
  });
} finally {
  await engine.shutdown();
}
```

## Security Considerations

The frontmatter workflow system includes comprehensive security analysis:

### Security Features

1. **Safe Expression Evaluation** - Sandboxed skipIf condition evaluation
2. **Shell Command Analysis** - Detection of dangerous shell operations
3. **Path Validation** - Prevention of path traversal attacks
4. **Permission Analysis** - Warning about overly permissive file permissions

### Security Scores

Templates receive security scores (0-100) based on:
- Shell command safety
- File permission settings
- Path configuration
- Expression complexity

### Best Practices

1. Use restrictive file permissions (644 for files, 755 for directories)
2. Avoid shell commands that modify system files
3. Validate all input variables
4. Use relative paths instead of absolute paths
5. Enable security analysis in production workflows

## Performance and Scalability

### Concurrency Control

The system supports concurrent processing with configurable limits:

```javascript
const engine = new FrontmatterWorkflowEngine({
  maxConcurrentOperations: 10 // Process up to 10 templates simultaneously
});
```

### Caching

Multiple levels of caching improve performance:

- **Parse Cache** - Cached frontmatter parsing results
- **Path Resolution Cache** - Cached dynamic path resolutions
- **Expression Cache** - Cached condition evaluations
- **Metadata Cache** - Cached metadata extraction results

### Metrics

The system provides comprehensive performance metrics:

```javascript
const result = await engine.processTemplate(template, context);

console.log(`Processing time: ${result.metadata.extractionMetadata.extractionTime}ms`);
console.log(`Path resolution: ${result.pathResolution.pathMetadata.resolutionTime}ms`);
console.log(`Operation execution: ${result.operationMetadata.executionTime}ms`);
```

## Error Handling and Recovery

### Error Categories

1. **Parse Errors** - Invalid YAML frontmatter
2. **Validation Errors** - Schema validation failures
3. **Path Errors** - Invalid or conflicting output paths
4. **Operation Errors** - File system operation failures
5. **Condition Errors** - skipIf evaluation failures

### Recovery Strategies

- **Automatic Retry** - Configurable retry attempts with exponential backoff
- **Backup and Rollback** - Automatic backup creation and rollback on failure
- **Graceful Degradation** - Continue processing other templates on individual failures
- **Safe Defaults** - Use safe default values when conditions fail

### Error Reporting

Comprehensive error context includes:

```json
{
  "operationId": "fwf_1234567890_abc123",
  "error": "Template processing failed",
  "errorContext": {
    "component": "frontmatter-workflow",
    "operation": "template_processing",
    "templateId": "api-service",
    "pathResolution": "success",
    "conditionalResult": "skipped"
  },
  "recovery": {
    "attempted": true,
    "successful": false,
    "strategy": "rollback"
  }
}
```

## Integration Examples

### With Express.js Generator

```yaml
---
to: "routes/{{ resource | kebabCase }}.js"
skipIf: "!includeRoutes"
variables:
  resource:
    type: string
    required: true
  methods:
    type: array
    default: ["GET", "POST"]
---
const express = require('express');
const router = express.Router();

{% for method in methods %}
router.{{ method.toLowerCase() }}('/', (req, res) => {
  // {{ method }} {{ resource }}
});
{% endfor %}

module.exports = router;
```

### With React Component Generator

```yaml
---
to: "src/components/{{ name | pascalCase }}/{{ name | pascalCase }}.tsx"
variables:
  name:
    type: string
    required: true
  withProps:
    type: boolean
    default: true
  withStyles:
    type: boolean
    default: false
---
import React from 'react';
{% if withStyles %}
import styles from './{{ name | pascalCase }}.module.css';
{% endif %}

{% if withProps %}
interface {{ name | pascalCase }}Props {
  children?: React.ReactNode;
  className?: string;
}
{% endif %}

export const {{ name | pascalCase }}: React.FC{% if withProps %}<{{ name | pascalCase }}Props>{% endif %} = ({% if withProps %}{ children, className }{% endif %}) => {
  return (
    <div {% if withStyles %}className={`${styles.{{ name | camelCase }}} ${className || ''}`}{% else %}className={className}{% endif %}>
      <h1>{{ name | titleCase }} Component</h1>
      {% if withProps %}{children}{% endif %}
    </div>
  );
};

export default {{ name | pascalCase }};
```

## Testing

The frontmatter workflow system includes comprehensive test coverage:

### Unit Tests

- Frontmatter parsing with edge cases
- Conditional expression evaluation
- Path resolution with various patterns
- Operation execution for all modes
- Schema validation with custom schemas
- Metadata extraction completeness

### Integration Tests

- End-to-end template processing workflows
- KGEN engine integration
- CLI command functionality
- Error handling and recovery
- Concurrent processing scenarios

### Performance Tests

- Large template batch processing
- Memory usage optimization
- Cache effectiveness
- Concurrent operation limits

Run tests with:

```bash
npm test -- --grep "frontmatter"
```

## Migration Guide

### From Basic Templates

Existing templates without frontmatter continue to work. To add frontmatter:

1. Add YAML frontmatter block at the beginning
2. Define output path with `to` field
3. Add variable definitions as needed
4. Test with `kgen templates validate`

### From Hygen

Migration from Hygen templates:

1. Convert `---` separators to YAML frontmatter
2. Update `to:` paths to use Nunjucks syntax
3. Convert `unless:` to `skipIf:` expressions
4. Update shell commands to `sh:` array format

### From Legacy KGEN

Legacy KGEN templates can be enhanced:

1. Move output path configuration to frontmatter
2. Add schema validation for consistency
3. Enable security analysis
4. Add conditional processing logic

## Troubleshooting

### Common Issues

#### Invalid YAML Frontmatter

**Error**: `Parse error: Invalid YAML frontmatter`

**Solution**: Validate YAML syntax, check indentation, ensure quotes are balanced

#### Path Resolution Failures

**Error**: `Path validation failed: Invalid characters`

**Solution**: Check path for invalid characters, use forward slashes, avoid path traversal

#### Condition Evaluation Errors

**Error**: `Condition evaluation failed: Unknown function`

**Solution**: Use only supported functions, check variable names, validate expression syntax

#### Schema Validation Failures

**Error**: `Schema validation failed: Required field missing`

**Solution**: Check required fields in schema, add missing frontmatter fields

### Debug Mode

Enable debug mode for detailed logging:

```bash
KGEN_DEBUG=1 kgen templates show-enhanced --name problematic-template
```

### Performance Issues

If experiencing slow template processing:

1. Check template complexity scores
2. Reduce concurrent operations limit
3. Enable caching for repeated operations
4. Simplify complex skipIf expressions

## Contributing

The frontmatter workflow system is designed for extensibility:

### Adding Custom Validators

```javascript
import { SchemaValidator } from '@kgen/frontmatter';

const validator = new SchemaValidator();

validator.registerValidator('custom-check', (frontmatter, context) => {
  const errors = [];
  const warnings = [];
  
  // Custom validation logic
  if (frontmatter.customField && !frontmatter.customField.match(/^[A-Z]/)) {
    errors.push({
      code: 'CUSTOM_VALIDATION_ERROR',
      message: 'Custom field must start with uppercase letter',
      path: ['customField'],
      severity: 'error'
    });
  }
  
  return { errors, warnings };
});
```

### Adding Custom Filters

```javascript
import { PathResolver } from '@kgen/frontmatter';

const resolver = new PathResolver();

resolver.nunjucksEnv.addFilter('customCase', (str) => {
  return str.split('').map((c, i) => 
    i % 2 === 0 ? c.toLowerCase() : c.toUpperCase()
  ).join('');
});
```

### Extending Operation Modes

New operation modes can be added to the `OperationEngine`:

```javascript
async _executeCustomOperation(targetPath, content, frontmatter, operationId) {
  // Custom operation implementation
  return {
    operationType: 'custom',
    artifacts: [/* custom artifacts */]
  };
}
```

## Roadmap

Future enhancements planned:

- **Template Inheritance** - Support for template extension and inheritance
- **Watch Mode** - Automatic template regeneration on file changes
- **Plugin System** - Extensible plugin architecture for custom operations
- **IDE Integration** - Language server protocol support for template editing
- **Performance Optimization** - Further performance improvements for large template sets
- **Advanced Security** - Additional security analysis and sandboxing features

## Support

For issues, questions, or contributions:

- **Documentation**: https://kgen.dev/docs/frontmatter
- **Issues**: https://github.com/kgen/kgen/issues
- **Discussions**: https://github.com/kgen/kgen/discussions
- **Examples**: https://github.com/kgen/kgen-examples

---

*Last updated: [Current Date]*
*Version: 1.0.0*