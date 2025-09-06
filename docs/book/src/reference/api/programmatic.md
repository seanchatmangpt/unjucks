# API Reference - Programmatic Interface Documentation

This comprehensive reference covers the complete Unjucks programmatic API for integration into applications and tools.

## Table of Contents

- [Core API](#core-api)
- [Generator API](#generator-api)
- [Template Engine API](#template-engine-api)
- [File Operations API](#file-operations-api)
- [Configuration API](#configuration-api)
- [Semantic Web API](#semantic-web-api)
- [TypeScript Interfaces](#typescript-interfaces)
- [Error Handling](#error-handling)
- [Integration Examples](#integration-examples)

## Core API

### Installation & Import

```typescript
// ES modules
import { 
  Generator, 
  TemplateScanner, 
  FileInjector,
  FrontmatterParser,
  SemanticTemplateOrchestrator
} from 'unjucks';

// CommonJS
const { Generator } = require('unjucks');

// Specific imports
import { Generator } from 'unjucks/generator';
import { TemplateScanner } from 'unjucks/template-scanner';
```

### Basic Usage

```typescript
import { Generator } from 'unjucks';

// Initialize generator
const generator = new Generator('./my-templates');

// Generate files
const result = await generator.generate({
  generator: 'component',
  template: 'react',
  dest: './src/components',
  variables: {
    name: 'MyButton',
    withTests: true
  }
});

console.log(`Generated ${result.files.length} files`);
```

## Generator API

### Generator Class

The main class for template generation and management.

#### Constructor

```typescript
class Generator {
  constructor(templatesDir?: string);
}
```

**Parameters:**
- `templatesDir` (optional): Path to templates directory. Defaults to auto-discovery.

**Example:**
```typescript
// Auto-discover templates directory
const generator = new Generator();

// Explicit templates directory
const generator = new Generator('./my-templates');
```

#### Methods

##### `generate(options: GenerateOptions): Promise<GenerateResult>`

Generate files from a template.

```typescript
interface GenerateOptions {
  generator: string;       // Generator name
  template: string;        // Template name
  dest: string;           // Destination directory
  force?: boolean;        // Overwrite existing files
  dry?: boolean;          // Dry run mode
  variables?: Record<string, any>; // Template variables
}

interface GenerateResult {
  files: TemplateFile[];  // Generated files
  warnings?: string[];   // Generation warnings
}

interface TemplateFile {
  path: string;          // File path
  content: string;       // File content
  frontmatter?: FrontmatterConfig; // Frontmatter configuration
  injectionResult?: InjectionResult; // Injection result if applicable
}
```

**Example:**
```typescript
const result = await generator.generate({
  generator: 'api',
  template: 'express',
  dest: './src/api',
  variables: {
    modelName: 'User',
    withAuth: true,
    database: 'postgresql'
  }
});

// Handle results
for (const file of result.files) {
  console.log(`Created: ${file.path}`);
}
```

##### `listGenerators(): Promise<GeneratorConfig[]>`

List all available generators.

```typescript
interface GeneratorConfig {
  name: string;
  description?: string;
  templates: TemplateConfig[];
  category?: string;
  path?: string;
  created?: Date;
  modified?: Date;
  usage?: {
    count: number;
    lastUsed?: Date;
  };
}

interface TemplateConfig {
  name: string;
  description?: string;
  files: string[];
  prompts?: PromptConfig[];
  variables?: TemplateVariable[];
  path?: string;
  tags?: string[];
  created?: Date;
  modified?: Date;
}
```

**Example:**
```typescript
const generators = await generator.listGenerators();

for (const gen of generators) {
  console.log(`${gen.name}: ${gen.description}`);
  console.log(`  Templates: ${gen.templates.map(t => t.name).join(', ')}`);
}
```

##### `listTemplates(generatorName: string): Promise<TemplateConfig[]>`

List templates for a specific generator.

**Example:**
```typescript
const templates = await generator.listTemplates('component');

for (const template of templates) {
  console.log(`${template.name}: ${template.description}`);
  console.log(`  Files: ${template.files.join(', ')}`);
}
```

##### `scanTemplateForVariables(generator: string, template: string): Promise<ScanResult>`

Analyze template for variables and generate CLI arguments.

```typescript
interface ScanResult {
  variables: TemplateVariable[];
  cliArgs: Record<string, any>;
}

interface TemplateVariable {
  name: string;
  type: 'string' | 'boolean' | 'number' | 'array';
  required: boolean;
  description?: string;
  defaultValue?: any;
  choices?: string[];
}
```

**Example:**
```typescript
const scan = await generator.scanTemplateForVariables('component', 'react');

console.log('Variables:', scan.variables);
console.log('CLI Args:', scan.cliArgs);

// Use discovered variables
const result = await generator.generate({
  generator: 'component',
  template: 'react', 
  dest: './src',
  variables: {
    [scan.variables[0].name]: 'MyComponent'
  }
});
```

##### `initProject(options: InitOptions): Promise<InitResult>`

Initialize a new project with generators.

```typescript
interface InitOptions {
  type: ProjectType;
  name: string;
  description?: string;
  dest: string;
  git?: boolean;
  install?: boolean;
  variables?: Record<string, any>;
}

type ProjectType = 
  | 'node-library' | 'node-cli' 
  | 'express-api' | 'fastify-api' | 'nestjs-api'
  | 'react-app' | 'next-app' | 'vue-app' | 'svelte-app';

interface InitResult {
  files: string[];
  scriptsRun?: string[];
  warnings?: string[];
}
```

**Example:**
```typescript
const result = await generator.initProject({
  type: 'react-app',
  name: 'my-awesome-app',
  dest: './my-app',
  git: true,
  install: true,
  variables: {
    author: 'John Doe',
    license: 'MIT'
  }
});

console.log(`Created project with ${result.files.length} files`);
```

##### `renderTemplate(options: RenderOptions): Promise<RenderResult>`

Render a template without writing files.

```typescript
interface RenderOptions {
  generator: string;
  template: string;
  variables: Record<string, any>;
  file?: string; // Specific file to render
}

interface RenderResult {
  content: string;
  variables: Record<string, any>;
  frontmatter?: FrontmatterConfig;
}
```

**Example:**
```typescript
const rendered = await generator.renderTemplate({
  generator: 'component',
  template: 'react',
  variables: { name: 'Button' },
  file: 'Component.tsx'
});

console.log('Rendered content:', rendered.content);
```

## Template Scanner API

Advanced template analysis and variable discovery.

### TemplateScanner Class

```typescript
import { TemplateScanner } from 'unjucks';

const scanner = new TemplateScanner();
```

#### Methods

##### `scanTemplate(templatePath: string): Promise<ScanResult>`

Scan a template directory for variables and metadata.

```typescript
const result = await scanner.scanTemplate('./templates/component/react');

console.log('Discovered variables:', result.variables);
console.log('File patterns:', result.filePatterns);
```

##### `generateCliArgs(variables: TemplateVariable[]): Record<string, any>`

Generate CLI argument definitions from template variables.

```typescript
const variables: TemplateVariable[] = [
  { name: 'componentName', type: 'string', required: true },
  { name: 'withTests', type: 'boolean', required: false, defaultValue: true }
];

const cliArgs = scanner.generateCliArgs(variables);
// Returns Citty-compatible argument definitions
```

##### `convertArgsToVariables(args: any, variables: TemplateVariable[]): Record<string, any>`

Convert CLI arguments to template variables.

```typescript
const args = { componentName: 'Button', withTests: true };
const templateVars = scanner.convertArgsToVariables(args, variables);
```

## File Operations API

### FileInjector Class

Advanced file injection and modification operations.

```typescript
import { FileInjector } from 'unjucks';

const injector = new FileInjector();
```

#### Methods

##### `processFile(path: string, content: string, frontmatter: FrontmatterConfig, options: InjectionOptions): Promise<InjectionResult>`

Process a file with injection logic.

```typescript
interface FrontmatterConfig {
  to?: string;
  inject?: boolean;
  before?: string;
  after?: string;
  append?: boolean;
  prepend?: boolean;
  lineAt?: number;
  skipIf?: string;
  chmod?: string | number;
  sh?: string | string[];
}

interface InjectionOptions {
  force?: boolean;
  dry?: boolean;
  backup?: boolean;
}

interface InjectionResult {
  success: boolean;
  message: string;
  skipped: boolean;
  changes: string[];
  backupPath?: string;
}
```

**Example:**
```typescript
const result = await injector.processFile(
  './src/app.ts',
  'import { Logger } from "./logger";',
  { inject: true, after: 'import' },
  { backup: true }
);

if (result.success) {
  console.log('Injection successful:', result.message);
}
```

##### `setPermissions(path: string, mode: string | number): Promise<void>`

Set file permissions.

```typescript
await injector.setPermissions('./script.sh', 0o755);
// or
await injector.setPermissions('./config.json', '644');
```

##### `executeCommands(commands: string[], cwd: string): Promise<ShellResult>`

Execute shell commands after file operations.

```typescript
interface ShellResult {
  success: boolean;
  outputs: string[];
  errors: string[];
}

const result = await injector.executeCommands(
  ['npm install', 'npm run build'],
  './project-dir'
);
```

## Configuration API

### Loading and Managing Configuration

```typescript
import { loadConfig, validateConfig, mergeConfig } from 'unjucks/config';

// Load configuration
const config = await loadConfig('./unjucks.config.ts');

// Validate configuration
const validation = validateConfig(config);
if (!validation.valid) {
  console.error('Config errors:', validation.errors);
}

// Merge configurations
const merged = mergeConfig(baseConfig, environmentConfig);
```

### Configuration Types

```typescript
interface UnjucksConfig {
  templatesDir?: string;
  outputDir?: string;
  cacheDir?: string;
  templateEngine?: TemplateEngineConfig;
  fileOperations?: FileOperationsConfig;
  performance?: PerformanceConfig;
  security?: SecurityConfig;
  semantic?: SemanticConfig;
  development?: DevelopmentConfig;
}
```

## Semantic Web API

### SemanticTemplateOrchestrator Class

Generate code from RDF/OWL ontologies.

```typescript
import { SemanticTemplateOrchestrator } from 'unjucks/semantic';

const orchestrator = new SemanticTemplateOrchestrator({
  ontologyPaths: ['./schema.ttl'],
  templateDir: '_templates',
  outputDir: './generated'
});
```

#### Methods

##### `generateFromSemantic(): Promise<SemanticResult>`

Generate code from semantic templates.

```typescript
interface SemanticResult {
  generatedFiles: GeneratedFile[];
  metrics: {
    templatesProcessed: number;
    typesGenerated: number;
    filesGenerated: number;
    executionTimeMs: number;
    validationsPassed: number;
  };
}

const result = await orchestrator.generateFromSemantic();
console.log(`Generated ${result.metrics.filesGenerated} files`);
```

### RDFTypeConverter Class

Convert RDF ontologies to TypeScript types.

```typescript
import { RDFTypeConverter } from 'unjucks/rdf';

const converter = new RDFTypeConverter();

// Convert ontology to TypeScript
const result = await converter.convertTurtleToTypeScript(
  './schema.ttl',
  './types'
);

// Generate validation helpers
const validators = converter.generateValidationHelpers(result.definitions);
```

## Error Handling

### Error Types

Unjucks provides specific error types for different scenarios:

```typescript
import { 
  UnjucksError,
  TemplateNotFoundError,
  ValidationError,
  FileOperationError,
  SemanticError 
} from 'unjucks/errors';

try {
  await generator.generate(options);
} catch (error) {
  if (error instanceof TemplateNotFoundError) {
    console.error('Template not found:', error.templatePath);
    console.error('Available templates:', error.availableTemplates);
  } else if (error instanceof ValidationError) {
    console.error('Validation failed:', error.validationErrors);
  } else if (error instanceof FileOperationError) {
    console.error('File operation failed:', error.operation, error.filePath);
  } else if (error instanceof SemanticError) {
    console.error('Semantic processing failed:', error.ontologyPath);
  }
}
```

### Error Recovery

```typescript
import { ErrorRecovery } from 'unjucks/recovery';

const recovery = new ErrorRecovery();

try {
  await generator.generate(options);
} catch (error) {
  // Attempt automatic recovery
  const recovered = await recovery.attemptRecovery(error, options);
  
  if (recovered.success) {
    console.log('Recovered successfully:', recovered.message);
  } else {
    console.error('Recovery failed:', recovered.error);
  }
}
```

## Integration Examples

### Express.js Integration

```typescript
import express from 'express';
import { Generator } from 'unjucks';

const app = express();
const generator = new Generator();

app.post('/api/generate', async (req, res) => {
  try {
    const { generator: gen, template, variables } = req.body;
    
    const result = await generator.generate({
      generator: gen,
      template,
      dest: './generated',
      variables
    });
    
    res.json({
      success: true,
      files: result.files.map(f => f.path),
      count: result.files.length
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

app.listen(3000);
```

### Next.js API Route

```typescript
// pages/api/generate.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { Generator } from 'unjucks';

const generator = new Generator();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === 'POST') {
    try {
      const result = await generator.generate(req.body);
      
      res.status(200).json({
        success: true,
        files: result.files.length,
        paths: result.files.map(f => f.path)
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
```

### CLI Tool Integration

```typescript
#!/usr/bin/env node
import { defineCommand, runMain } from 'citty';
import { Generator } from 'unjucks';

const myTool = defineCommand({
  meta: {
    name: 'my-generator-tool',
    description: 'Custom code generation tool'
  },
  args: {
    template: { type: 'string', required: true },
    output: { type: 'string', default: './output' }
  },
  async run({ args }) {
    const generator = new Generator('./my-templates');
    
    const result = await generator.generate({
      generator: 'custom',
      template: args.template,
      dest: args.output,
      variables: process.env
    });
    
    console.log(`✅ Generated ${result.files.length} files`);
  }
});

runMain(myTool);
```

### Build Tool Plugin

```typescript
// webpack-plugin.js
import { Generator } from 'unjucks';

class UnjucksWebpackPlugin {
  constructor(options) {
    this.options = options;
    this.generator = new Generator();
  }

  apply(compiler) {
    compiler.hooks.beforeCompile.tapAsync('UnjucksPlugin', async (params, callback) => {
      try {
        await this.generator.generate(this.options);
        callback();
      } catch (error) {
        callback(error);
      }
    });
  }
}

// Usage in webpack.config.js
module.exports = {
  plugins: [
    new UnjucksWebpackPlugin({
      generator: 'types',
      template: 'api',
      dest: './src/generated',
      variables: { apiVersion: 'v1' }
    })
  ]
};
```

### Testing Integration

```typescript
// test-utils.ts
import { Generator } from 'unjucks';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

export class TestGenerator {
  private tempDir: string;
  private generator: Generator;

  async setup() {
    this.tempDir = await mkdtemp(join(tmpdir(), 'unjucks-test-'));
    this.generator = new Generator('./test-templates');
  }

  async cleanup() {
    await rm(this.tempDir, { recursive: true });
  }

  async generate(options: Partial<GenerateOptions>) {
    return this.generator.generate({
      dest: this.tempDir,
      ...options
    });
  }

  getOutputPath() {
    return this.tempDir;
  }
}

// test.spec.ts
import { TestGenerator } from './test-utils';

describe('Template Generation', () => {
  let testGen: TestGenerator;

  beforeEach(async () => {
    testGen = new TestGenerator();
    await testGen.setup();
  });

  afterEach(async () => {
    await testGen.cleanup();
  });

  it('should generate component files', async () => {
    const result = await testGen.generate({
      generator: 'component',
      template: 'react',
      variables: { name: 'TestButton' }
    });

    expect(result.files).toHaveLength(2);
    expect(result.files[0].path).toContain('TestButton.tsx');
  });
});
```

### Streaming Generation

```typescript
import { Generator } from 'unjucks';
import { Readable } from 'stream';

class StreamingGenerator extends Generator {
  async *generateStream(options: GenerateOptions): AsyncGenerator<TemplateFile> {
    const templates = await this.getTemplateFiles(options.generator, options.template);
    
    for (const templatePath of templates) {
      const file = await this.processTemplate(templatePath, options.variables);
      yield file;
    }
  }
}

// Usage
const generator = new StreamingGenerator();

for await (const file of generator.generateStream(options)) {
  console.log(`Processing: ${file.path}`);
  // Handle file as it's generated
  await writeFile(file.path, file.content);
}
```

### Async/Parallel Generation

```typescript
import { Generator } from 'unjucks';

class ParallelGenerator extends Generator {
  async generateParallel(requests: GenerateOptions[]): Promise<GenerateResult[]> {
    const promises = requests.map(options => this.generate(options));
    return Promise.all(promises);
  }

  async generateBatch(options: GenerateOptions, batches: Record<string, any>[]): Promise<GenerateResult[]> {
    const promises = batches.map(variables => 
      this.generate({ ...options, variables })
    );
    return Promise.all(promises);
  }
}

// Generate multiple components in parallel
const generator = new ParallelGenerator();

const results = await generator.generateBatch(
  { generator: 'component', template: 'react', dest: './src' },
  [
    { name: 'Header', withTests: true },
    { name: 'Footer', withTests: false },
    { name: 'Sidebar', withTests: true }
  ]
);

console.log(`Generated ${results.length} component sets`);
```

This comprehensive API reference provides everything needed to integrate Unjucks programmatically into any application or workflow.