# Unjucks API Documentation

## Table of Contents
1. [Overview](#overview)
2. [Core API](#core-api)
3. [Template API](#template-api)
4. [Semantic Web API](#semantic-web-api)
5. [CLI API](#cli-api)
6. [Plugin API](#plugin-api)
7. [Configuration API](#configuration-api)
8. [Type Definitions](#type-definitions)
9. [Error Handling](#error-handling)
10. [Examples](#examples)

## Overview

The Unjucks API provides programmatic access to all template generation, semantic web processing, and CLI functionality. This documentation covers both the JavaScript API and the command-line interface.

### Installation
```bash
npm install @seanchatmangpt/unjucks
```

### Basic Import
```javascript
import { Unjucks, SemanticProcessor, TemplateEngine } from '@seanchatmangpt/unjucks';
```

## Core API

### Unjucks Class
The main entry point for programmatic access.

#### Constructor
```typescript
constructor(config?: UnjucksConfig)
```

**Parameters:**
- `config` (optional): Configuration object

**Example:**
```javascript
import { Unjucks } from '@seanchatmangpt/unjucks';

const unjucks = new Unjucks({
  templates: ['_templates'],
  variables: { author: 'John Doe' }
});
```

#### Methods

##### `generate(options: GenerateOptions): Promise<GenerateResult>`
Generate files from templates.

**Parameters:**
```typescript
interface GenerateOptions {
  generator: string;          // Generator name
  template: string;           // Template name
  name?: string;             // Instance name
  output?: string;           // Output directory
  variables?: object;        // Template variables
  dryRun?: boolean;          // Preview only
  force?: boolean;           // Overwrite existing files
}
```

**Returns:**
```typescript
interface GenerateResult {
  success: boolean;
  files: string[];           // Generated file paths
  errors?: string[];         // Error messages
  warnings?: string[];       // Warning messages
}
```

**Example:**
```javascript
const result = await unjucks.generate({
  generator: 'component',
  template: 'react',
  name: 'Button',
  variables: { type: 'primary' }
});

if (result.success) {
  console.log('Generated files:', result.files);
} else {
  console.error('Errors:', result.errors);
}
```

##### `list(generator?: string): Promise<ListResult>`
List available generators and templates.

**Parameters:**
- `generator` (optional): Specific generator to list templates for

**Returns:**
```typescript
interface ListResult {
  generators: GeneratorInfo[];
}

interface GeneratorInfo {
  name: string;
  description?: string;
  templates: TemplateInfo[];
}

interface TemplateInfo {
  name: string;
  description?: string;
  prompts?: PromptInfo[];
}
```

**Example:**
```javascript
const list = await unjucks.list();
console.log('Available generators:', list.generators);

// List specific generator
const componentList = await unjucks.list('component');
```

##### `preview(options: GenerateOptions): Promise<PreviewResult>`
Preview template output without writing files.

**Returns:**
```typescript
interface PreviewResult {
  files: PreviewFile[];
}

interface PreviewFile {
  path: string;
  content: string;
  action: 'create' | 'update' | 'skip';
}
```

**Example:**
```javascript
const preview = await unjucks.preview({
  generator: 'component',
  template: 'react',
  name: 'Button'
});

preview.files.forEach(file => {
  console.log(`${file.action}: ${file.path}`);
  console.log(file.content);
});
```

##### `inject(options: InjectOptions): Promise<InjectResult>`
Inject content into existing files.

**Parameters:**
```typescript
interface InjectOptions {
  file: string;              // Target file path
  pattern?: string;          // Injection pattern
  content: string;           // Content to inject
  before?: string;           // Insert before pattern
  after?: string;            // Insert after pattern
  replace?: string;          // Replace pattern
}
```

**Example:**
```javascript
const result = await unjucks.inject({
  file: 'src/routes/index.js',
  pattern: '// ROUTES',
  content: "app.use('/users', usersRouter);"
});
```

## Template API

### TemplateEngine Class
Core template processing engine.

#### Constructor
```typescript
constructor(config: TemplateConfig)
```

#### Methods

##### `loadTemplate(path: string): Promise<Template>`
Load template from file system.

**Example:**
```javascript
import { TemplateEngine } from '@seanchatmangpt/unjucks';

const engine = new TemplateEngine({
  templatePath: '_templates'
});

const template = await engine.loadTemplate('component/react');
```

##### `render(template: Template, variables: object): Promise<string>`
Render template with variables.

**Example:**
```javascript
const rendered = await engine.render(template, {
  name: 'Button',
  type: 'primary'
});
```

##### `addHelper(name: string, fn: Function): void`
Add custom template helper.

**Example:**
```javascript
engine.addHelper('titleCase', (str) => {
  return str.replace(/\w\S*/g, (txt) => 
    txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
  );
});
```

### Template Structure

#### Template Definition
```typescript
interface Template {
  name: string;
  path: string;
  config: TemplateConfig;
  files: TemplateFile[];
}

interface TemplateFile {
  from: string;              // Source template file
  to: string;                // Output file path
  condition?: string;        // Conditional generation
}

interface TemplateConfig {
  prompts?: PromptConfig[];
  variables?: object;
  hooks?: {
    before?: Function;
    after?: Function;
  };
}
```

#### Prompt Configuration
```typescript
interface PromptConfig {
  type: 'input' | 'select' | 'confirm' | 'multiselect';
  name: string;
  message: string;
  choices?: string[] | ChoiceObject[];
  default?: any;
  validate?: (input: any) => boolean | string;
  when?: (answers: object) => boolean;
}

interface ChoiceObject {
  name: string;
  value: any;
  disabled?: boolean | string;
}
```

**Example:**
```javascript
// _templates/component/new/index.js
module.exports = {
  prompts: [
    {
      type: 'input',
      name: 'name',
      message: 'Component name?',
      validate: (input) => input.length > 0 || 'Name is required'
    },
    {
      type: 'select',
      name: 'type',
      message: 'Component type?',
      choices: [
        { name: 'Functional', value: 'functional' },
        { name: 'Class', value: 'class' }
      ]
    },
    {
      type: 'confirm',
      name: 'includeTests',
      message: 'Include test files?',
      default: true
    }
  ]
};
```

## Semantic Web API

### SemanticProcessor Class
Handle RDF/Turtle processing and ontology operations.

#### Constructor
```typescript
constructor(config?: SemanticConfig)
```

**Parameters:**
```typescript
interface SemanticConfig {
  namespace?: string;        // Default namespace
  prefixes?: object;         // Prefix mappings
  formats?: string[];        // Supported formats
}
```

#### Methods

##### `loadOntology(source: string): Promise<Ontology>`
Load RDF ontology from file or URL.

**Example:**
```javascript
import { SemanticProcessor } from '@seanchatmangpt/unjucks';

const processor = new SemanticProcessor({
  namespace: 'http://example.com/',
  prefixes: {
    'ex': 'http://example.com/',
    'schema': 'http://schema.org/'
  }
});

const ontology = await processor.loadOntology('schema.ttl');
```

##### `generateCode(ontology: Ontology, options: CodeGenOptions): Promise<CodeGenResult>`
Generate code from ontology.

**Parameters:**
```typescript
interface CodeGenOptions {
  format: 'typescript' | 'javascript' | 'python' | 'java';
  output: string;            // Output directory
  namespace?: string;        // Target namespace
  includeValidation?: boolean;
  includeSerializers?: boolean;
}
```

**Returns:**
```typescript
interface CodeGenResult {
  files: GeneratedFile[];
  classes: ClassInfo[];
  properties: PropertyInfo[];
}
```

**Example:**
```javascript
const result = await processor.generateCode(ontology, {
  format: 'typescript',
  output: 'src/models/',
  includeValidation: true
});
```

##### `validateData(data: string, schema: Ontology): Promise<ValidationResult>`
Validate RDF data against schema.

**Returns:**
```typescript
interface ValidationResult {
  valid: boolean;
  violations: Violation[];
}

interface Violation {
  type: string;
  message: string;
  subject?: string;
  predicate?: string;
  object?: string;
}
```

**Example:**
```javascript
const validation = await processor.validateData('data.ttl', ontology);
if (!validation.valid) {
  console.log('Violations:', validation.violations);
}
```

##### `convertFormat(input: string, outputFormat: string): Promise<string>`
Convert between RDF formats.

**Example:**
```javascript
const turtle = await processor.convertFormat('data.json', 'turtle');
const jsonld = await processor.convertFormat('data.ttl', 'json-ld');
```

##### `executeSparql(query: string, dataset: string): Promise<SparqlResult>`
Execute SPARQL query.

**Example:**
```javascript
const query = `
  PREFIX ex: <http://example.com/>
  SELECT ?name ?age WHERE {
    ?person ex:name ?name ;
            ex:age ?age .
  }
`;

const result = await processor.executeSparql(query, 'data.ttl');
console.log('Results:', result.bindings);
```

### Ontology API

#### Ontology Class
```typescript
class Ontology {
  classes: OntologyClass[];
  properties: OntologyProperty[];
  individuals: OntologyIndividual[];
  
  getClass(uri: string): OntologyClass | undefined;
  getProperty(uri: string): OntologyProperty | undefined;
  getSubClasses(classUri: string): OntologyClass[];
  getProperties(classUri: string): OntologyProperty[];
}
```

#### OntologyClass
```typescript
interface OntologyClass {
  uri: string;
  label?: string;
  comment?: string;
  superClasses: string[];
  equivalentClasses: string[];
  disjointWith: string[];
  properties: OntologyProperty[];
}
```

#### OntologyProperty
```typescript
interface OntologyProperty {
  uri: string;
  label?: string;
  comment?: string;
  domain: string[];
  range: string[];
  type: 'ObjectProperty' | 'DatatypeProperty' | 'AnnotationProperty';
  functional?: boolean;
  inverseFunctional?: boolean;
  transitive?: boolean;
  symmetric?: boolean;
}
```

## CLI API

### Command Registration
Register custom CLI commands.

```typescript
interface CommandConfig {
  name: string;
  description: string;
  options?: OptionConfig[];
  action: (args: any, options: any) => Promise<void>;
}

interface OptionConfig {
  name: string;
  description: string;
  type: 'string' | 'boolean' | 'number';
  default?: any;
  required?: boolean;
}
```

**Example:**
```javascript
import { registerCommand } from '@seanchatmangpt/unjucks/cli';

registerCommand({
  name: 'custom',
  description: 'Custom command',
  options: [
    {
      name: 'input',
      description: 'Input file',
      type: 'string',
      required: true
    }
  ],
  action: async (args, options) => {
    console.log('Custom command executed:', options.input);
  }
});
```

### CLI Utilities

#### `parseArguments(argv: string[]): ParsedArgs`
Parse command line arguments.

#### `showHelp(command?: string): void`
Display help information.

#### `showVersion(): void`
Display version information.

## Plugin API

### Plugin System
Extend Unjucks functionality with plugins.

#### Plugin Structure
```typescript
interface Plugin {
  name: string;
  version: string;
  type: 'generator' | 'helper' | 'processor' | 'command';
  register: (unjucks: Unjucks) => void;
  unregister?: (unjucks: Unjucks) => void;
}
```

#### Creating a Plugin
```javascript
// my-plugin.js
module.exports = {
  name: 'my-plugin',
  version: '1.0.0',
  type: 'helper',
  
  register(unjucks) {
    // Add custom helper
    unjucks.addHelper('myHelper', (input) => {
      return input.toUpperCase();
    });
    
    // Add custom validator
    unjucks.addValidator('email', (value) => {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    });
  }
};
```

#### Loading Plugins
```javascript
import { Unjucks } from '@seanchatmangpt/unjucks';

const unjucks = new Unjucks();
unjucks.loadPlugin('./plugins/my-plugin.js');
```

### Built-in Plugin Types

#### Generator Plugin
```javascript
module.exports = {
  type: 'generator',
  register(unjucks) {
    unjucks.addGenerator('my-generator', {
      path: './generators/my-generator',
      description: 'My custom generator'
    });
  }
};
```

#### Helper Plugin
```javascript
module.exports = {
  type: 'helper',
  register(unjucks) {
    unjucks.addHelper('formatCurrency', (amount, currency = 'USD') => {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency
      }).format(amount);
    });
  }
};
```

#### Processor Plugin
```javascript
module.exports = {
  type: 'processor',
  register(unjucks) {
    unjucks.addProcessor('custom-format', {
      extensions: ['.custom'],
      process: (content, context) => {
        // Custom processing logic
        return processedContent;
      }
    });
  }
};
```

## Configuration API

### Configuration Schema
```typescript
interface UnjucksConfig {
  // Template configuration
  templates?: string[];       // Template directories
  variables?: object;         // Global variables
  helpers?: object;          // Custom helpers
  
  // Output configuration
  output?: {
    directory?: string;       // Default output directory
    overwrite?: boolean;      // Overwrite existing files
    backup?: boolean;         // Create backups
  };
  
  // Semantic web configuration
  semantic?: {
    namespace?: string;       // Default namespace
    prefixes?: object;        // Prefix mappings
    formats?: string[];       // Supported formats
  };
  
  // Plugin configuration
  plugins?: string[];        // Plugin paths
  
  // CLI configuration
  cli?: {
    colors?: boolean;         // Enable colors
    interactive?: boolean;    // Enable interactive mode
    verbose?: boolean;        // Verbose output
  };
}
```

### Configuration Loading
```javascript
import { loadConfig } from '@seanchatmangpt/unjucks/config';

// Load from multiple sources
const config = await loadConfig([
  'unjucks.config.js',
  '.unjucks.json',
  'package.json'
]);
```

### Environment Configuration
```javascript
// Use different configs per environment
const env = process.env.NODE_ENV || 'development';
const config = await loadConfig(`unjucks.${env}.config.js`);
```

## Type Definitions

### Core Types
```typescript
// Generator and template types
interface Generator {
  name: string;
  path: string;
  templates: Template[];
}

interface Template {
  name: string;
  path: string;
  config: TemplateConfig;
  files: TemplateFile[];
}

// Variable and context types
interface Context {
  name?: string;
  variables: object;
  helpers: object;
  config: UnjucksConfig;
}

// Result types
interface GenerateResult {
  success: boolean;
  files: string[];
  errors?: string[];
  warnings?: string[];
  duration?: number;
}
```

### Semantic Types
```typescript
// RDF types
interface Triple {
  subject: string;
  predicate: string;
  object: string;
  graph?: string;
}

interface Quad extends Triple {
  graph: string;
}

// Ontology types
interface OntologyClass {
  uri: string;
  label?: string;
  comment?: string;
  superClasses: string[];
  properties: OntologyProperty[];
}

interface OntologyProperty {
  uri: string;
  label?: string;
  comment?: string;
  domain: string[];
  range: string[];
  type: PropertyType;
}

enum PropertyType {
  ObjectProperty = 'ObjectProperty',
  DatatypeProperty = 'DatatypeProperty',
  AnnotationProperty = 'AnnotationProperty'
}
```

## Error Handling

### Error Types
```typescript
// Base error class
class UnjucksError extends Error {
  code: string;
  context?: object;
}

// Specific error types
class TemplateNotFoundError extends UnjucksError {}
class GenerationError extends UnjucksError {}
class ValidationError extends UnjucksError {}
class SemanticError extends UnjucksError {}
```

### Error Handling Examples
```javascript
import { Unjucks, TemplateNotFoundError } from '@seanchatmangpt/unjucks';

try {
  const result = await unjucks.generate({
    generator: 'nonexistent',
    template: 'template'
  });
} catch (error) {
  if (error instanceof TemplateNotFoundError) {
    console.error('Template not found:', error.message);
  } else {
    console.error('Unknown error:', error);
  }
}
```

## Examples

### Example 1: Programmatic Generation
```javascript
import { Unjucks } from '@seanchatmangpt/unjucks';

async function generateComponents() {
  const unjucks = new Unjucks();
  
  const components = ['Button', 'Input', 'Modal'];
  
  for (const component of components) {
    const result = await unjucks.generate({
      generator: 'component',
      template: 'react',
      name: component,
      variables: {
        type: 'typescript',
        includeTests: true,
        includeStories: true
      }
    });
    
    console.log(`Generated ${component}:`, result.files);
  }
}

generateComponents().catch(console.error);
```

### Example 2: Semantic Code Generation
```javascript
import { SemanticProcessor } from '@seanchatmangpt/unjucks';

async function generateFromOntology() {
  const processor = new SemanticProcessor({
    namespace: 'http://example.com/ecommerce#'
  });
  
  // Load ontology
  const ontology = await processor.loadOntology('ecommerce.ttl');
  
  // Generate TypeScript interfaces
  const result = await processor.generateCode(ontology, {
    format: 'typescript',
    output: 'src/types/',
    includeValidation: true,
    includeSerializers: true
  });
  
  console.log('Generated classes:', result.classes.length);
  console.log('Files created:', result.files);
}

generateFromOntology().catch(console.error);
```

### Example 3: Custom Plugin
```javascript
// plugins/database-plugin.js
module.exports = {
  name: 'database-plugin',
  version: '1.0.0',
  type: 'helper',
  
  register(unjucks) {
    // Add database helpers
    unjucks.addHelper('sqlType', (jsType) => {
      const typeMap = {
        'string': 'VARCHAR(255)',
        'number': 'INTEGER',
        'boolean': 'BOOLEAN',
        'Date': 'TIMESTAMP'
      };
      return typeMap[jsType] || 'TEXT';
    });
    
    unjucks.addHelper('generateMigration', (tableName, fields) => {
      const columns = fields.map(field => 
        `${field.name} ${unjucks.helpers.sqlType(field.type)}`
      ).join(',\n  ');
      
      return `
CREATE TABLE ${tableName} (
  id SERIAL PRIMARY KEY,
  ${columns},
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
      `.trim();
    });
  }
};

// Usage in template
// <%= generateMigration(tableName, fields) %>
```

### Example 4: Batch Processing
```javascript
import { Unjucks } from '@seanchatmangpt/unjucks';
import { readFileSync } from 'fs';

async function batchGenerate() {
  const unjucks = new Unjucks();
  
  // Load batch configuration
  const batchConfig = JSON.parse(readFileSync('batch.json', 'utf-8'));
  
  const results = [];
  
  for (const operation of batchConfig.operations) {
    try {
      const result = await unjucks.generate(operation);
      results.push({ ...operation, result });
      console.log(`✓ Generated ${operation.generator}/${operation.template}/${operation.name}`);
    } catch (error) {
      console.error(`✗ Failed ${operation.generator}/${operation.template}/${operation.name}:`, error.message);
      results.push({ ...operation, error: error.message });
    }
  }
  
  // Generate summary report
  const successful = results.filter(r => r.result?.success).length;
  const failed = results.filter(r => r.error).length;
  
  console.log(`\nBatch complete: ${successful} successful, ${failed} failed`);
  
  return results;
}

batchGenerate().catch(console.error);
```

---

This API documentation provides comprehensive coverage of all Unjucks APIs. For additional examples and use cases, see the [User Guide](USER_GUIDE.md) and [Examples](../examples/).