# Variable Extractor API Documentation

## Overview

The Variable Extractor is a comprehensive system for analyzing templates and extracting variables across multiple syntax patterns. It supports nested object notation, loop variables, conditionals, filters, pipes, and custom syntax definitions.

## Location

- **Source**: `/src/office/utils/variable-extractor.js`
- **Tests**: `/tests/office/utils/variable-extractor.test.js`
- **Examples**: `/src/office/utils/example-usage.js`

## Features

### ✅ Multiple Variable Syntaxes
- **Handlebars/Mustache**: `{{variable}}`
- **Single Brace**: `{variable}`
- **Template Literals**: `${variable}`
- **Angular**: `<variable>`
- **PHP**: `<?= $variable ?>`
- **ERB**: `<%= variable %>`
- **Jinja2/Django**: `{{ variable }}`
- **Custom Syntax**: Extensible pattern system

### ✅ Advanced Pattern Detection
- **Nested Objects**: `user.profile.name`, `data.items[0].title`
- **Array Access**: `items[index]`, `data["key"][0]`
- **Loop Variables**: `{{#each items}}`, `{{for item in items}}`
- **Conditionals**: `{{#if condition}}`, `{{#unless condition}}`
- **Filters/Pipes**: `{{value|currency}}`, `{{date|format:'YYYY-MM-DD'}}`
- **Complex Expressions**: Multi-variable conditionals and dependencies

### ✅ Analysis Features
- **Variable Validation**: Name checking, reserved word detection
- **Dependency Mapping**: Variable interdependency analysis
- **Complexity Scoring**: Template complexity assessment
- **Error Handling**: Graceful malformed template handling
- **Performance**: Efficient large template processing

### ✅ Documentation Generation
- **Markdown**: Human-readable documentation
- **JSON**: Structured data export
- **HTML**: Styled web documentation

## API Reference

### Constructor

```javascript
import VariableExtractor from './variable-extractor.js';

const extractor = new VariableExtractor({
  includeLineNumbers: true,    // Track variable positions
  validateNames: true,         // Validate variable names
  trackDependencies: true,     // Build dependency graph
  ignoreComments: true,        // Skip commented variables
  customSyntax: []            // Custom syntax definitions
});
```

### Core Methods

#### `extract(content, options)`
Extracts all variables from template content.

```javascript
const result = extractor.extract(templateContent);
// Returns: ExtractionResult object
```

**ExtractionResult Structure:**
```javascript
{
  variables: VariableInfo[],           // All extracted variables
  byType: Map<string, VariableInfo[]>, // Variables grouped by type
  dependencies: Map<string, string[]>, // Dependency graph
  statistics: {
    totalVariables: number,
    uniqueVariables: number,
    byType: Object,
    complexityScore: number
  },
  errors: string[],                    // Parsing errors
  warnings: string[]                   // Parsing warnings
}
```

**VariableInfo Structure:**
```javascript
{
  name: string,           // Variable name
  type: string,           // Variable type (simple, object, array, loop, conditional, filter)
  syntax: string,         // Original syntax found
  path: string,           // Full path for nested variables
  line: number,           // Line number where found
  column: number,         // Column position
  dependencies: string[], // Other variables this depends on
  metadata: Object        // Additional information
}
```

#### `extractByType(content, type)`
Extracts variables of a specific type.

```javascript
const loops = extractor.extractByType(content, 'loop');
const filters = extractor.extractByType(content, 'filter');
```

#### `getDependencies(content, variableName)`
Gets dependencies for a specific variable.

```javascript
const deps = extractor.getDependencies(content, 'user');
// Returns: ['index', 'key'] (variables that 'user' depends on)
```

#### `validateVariables(variables)`
Validates variable names and returns validation results.

```javascript
const validation = extractor.validateVariables(variables);
// Returns: { valid: [], invalid: [], warnings: [] }
```

#### `generateDocumentation(result, options)`
Generates documentation from extraction results.

```javascript
// Markdown documentation
const markdown = extractor.generateDocumentation(result, {
  format: 'markdown',
  includeExamples: true,
  includeTypes: true,
  includeDependencies: true
});

// JSON documentation
const json = extractor.generateDocumentation(result, {
  format: 'json'
});

// HTML documentation
const html = extractor.generateDocumentation(result, {
  format: 'html'
});
```

#### `addCustomSyntax(name, definition)`
Adds custom syntax definition.

```javascript
extractor.addCustomSyntax('brackets', {
  pattern: /\[\[([^\]]+)\]\]/g,
  extractor: (match, content, line, column) => {
    return [{
      name: match[1].trim(),
      type: 'custom',
      syntax: match[0],
      path: match[1].trim(),
      line,
      column,
      dependencies: [],
      metadata: { customType: 'brackets' }
    }];
  }
});
```

## Usage Examples

### Basic Variable Extraction

```javascript
const template = 'Hello {{name}}, you have {{messages.count}} messages';
const result = extractor.extract(template);

console.log(`Found ${result.variables.length} variables`);
result.variables.forEach(v => {
  console.log(`${v.name} (${v.type}): ${v.path}`);
});
```

### Complex Template Analysis

```javascript
const complexTemplate = `
{{#each posts}}
  <article>
    <h2>{{title|capitalize}}</h2>
    <p>By {{author.name}} on {{date|format:'YYYY-MM-DD'}}</p>
    {{#if featured}}⭐ Featured{{/if}}
  </article>
{{/each}}
`;

const result = extractor.extract(complexTemplate);

// Analyze by type
for (const [type, variables] of result.byType) {
  console.log(`${type}: ${variables.length} variables`);
}

// Check dependencies
for (const [variable, deps] of result.dependencies) {
  console.log(`${variable} depends on: ${deps.join(', ')}`);
}
```

### Documentation Generation

```javascript
const template = '{{user.name|title}} - {{user.posts|count}} posts';
const result = extractor.extract(template);
const docs = extractor.generateDocumentation(result, {
  format: 'markdown',
  includeTypes: true,
  includeDependencies: true
});

console.log(docs);
```

## Variable Types

### Simple Variables
- **Pattern**: `{{name}`, `{age}`, `${id}`
- **Type**: `'simple'`
- **Example**: `{{username}}`

### Object Variables
- **Pattern**: `{{object.property}}`
- **Type**: `'object'`
- **Example**: `{{user.profile.name}}`

### Array Variables
- **Pattern**: `{{array[index]}}`
- **Type**: `'array'`
- **Example**: `{{items[0].title}}`

### Loop Variables
- **Pattern**: `{{#each items}}`, `{{for item in items}}`
- **Type**: `'loop'`
- **Metadata**: `{ loopType, iteratorVar }`

### Conditional Variables
- **Pattern**: `{{#if condition}}`, `{{#unless condition}}`
- **Type**: `'conditional'`
- **Metadata**: `{ conditionType, fullCondition }`

### Filter Variables
- **Pattern**: `{{value|filter}}`, `{{data|filter:param}}`
- **Type**: `'filter'`
- **Metadata**: `{ filters, rawFilters }`

## Performance Characteristics

- **Large Templates**: Efficiently processes 1000+ variables
- **Memory Usage**: Optimized for minimal memory footprint
- **Speed**: 2-3ms for typical templates, <100ms for complex templates
- **Scalability**: Linear performance with template size

## Error Handling

The extractor gracefully handles:
- Malformed template syntax
- Invalid variable names
- Unclosed tags
- Nested syntax errors
- Large file processing

Errors are collected in the `errors` array without stopping extraction.

## Extension Points

### Custom Syntax
Add support for new template engines by defining custom syntax patterns.

### Custom Validators
Extend variable validation with custom rules.

### Custom Documentation Formats
Add new documentation output formats.

### Custom Metadata Extractors
Enhance variable analysis with custom metadata extraction.

## Testing

The extractor includes comprehensive tests covering:
- All supported syntax types
- Edge cases and error conditions
- Performance benchmarks
- Real-world template examples
- Custom syntax extension

Run tests with:
```bash
npm test -- tests/office/utils/variable-extractor.test.js
```

## Integration

The Variable Extractor integrates seamlessly with:
- **Template Generators**: Analyze template variables before rendering
- **CLI Tools**: Extract variables for flag generation
- **Documentation Systems**: Auto-generate variable documentation
- **Validation Pipelines**: Ensure template variable consistency
- **IDE Extensions**: Provide variable completion and validation

## Version History

- **v1.0.0**: Initial implementation with full feature set
  - Multi-syntax support
  - Nested object/array notation
  - Loop and conditional detection
  - Filter/pipe analysis
  - Variable validation
  - Documentation generation
  - Custom syntax support
  - Comprehensive test suite