# Programmatic API

Complete Node.js API reference for integrating Unjucks into your applications.

## Installation

```bash
npm install unjucks
```

## Core API

### Generator Class

Main class for template processing and file generation.

```typescript
import { Generator } from 'unjucks';

const generator = new Generator('/path/to/_templates');
```

#### Constructor

```typescript
new Generator(templatesDir?: string)
```

**Auto-discovery process:**
1. Starts from current working directory
2. Walks up directory tree looking for `package.json`
3. Looks for `_templates` or `templates` directory
4. Falls back to `_templates` in current directory

#### Methods

##### `generate(options: GenerateOptions): Promise<GenerateResult>`

Generate files from a template.

```typescript
interface GenerateOptions {
  generator: string;      // Generator name
  template: string;       // Template name
  dest: string;          // Destination directory
  force?: boolean;       // Overwrite existing files (default: false)
  dry?: boolean;         // Preview only, don't write (default: false)
  [variableName: string]: any; // Template variables
}

interface GenerateResult {
  files: TemplateFile[];
}

interface TemplateFile {
  path: string;    // Generated file path
  content: string; // Generated file content
}
```

**Example:**
```typescript
const result = await generator.generate({
  generator: 'component',
  template: 'react',
  dest: './src/components',
  force: false,
  dry: false,
  // Template variables
  componentName: 'Button',
  withProps: true,
  withTests: true
});

console.log(`Generated ${result.files.length} files`);
result.files.forEach(file => {
  console.log(`- ${file.path}`);
});
```

##### `listGenerators(): Promise<GeneratorConfig[]>`

List all available generators.

```typescript
interface GeneratorConfig {
  name: string;
  description?: string;
  templates: TemplateConfig[];
}

const generators = await generator.listGenerators();
console.log(generators);
// [
//   {
//     name: 'component',
//     description: 'Generate React components',
//     templates: [...]
//   }
// ]
```

##### `listTemplates(generatorName: string): Promise<TemplateConfig[]>`

List templates for a specific generator.

```typescript
interface TemplateConfig {
  name: string;
  description?: string;
  files: string[];
  prompts?: PromptConfig[];
}

const templates = await generator.listTemplates('component');
console.log(templates);
// [
//   {
//     name: 'react',
//     description: 'React functional component',
//     files: ['Component.tsx', 'Component.test.tsx']
//   }
// ]
```

##### `scanTemplateForVariables(generator: string, template: string): Promise<ScanResult>`

Extract variables from templates and generate CLI argument definitions.

```typescript
interface ScanResult {
  variables: TemplateVariable[];
  cliArgs: Record<string, any>;
}

interface TemplateVariable {
  name: string;
  type: 'string' | 'boolean' | 'number' | 'array';
  description?: string;
  defaultValue?: any;
  required?: boolean;
}

const result = await generator.scanTemplateForVariables('component', 'react');

console.log(result.variables);
// [
//   {
//     name: 'componentName',
//     type: 'string',
//     description: 'Name of the component',
//     required: true
//   }
// ]

console.log(result.cliArgs);
// {
//   componentName: {
//     type: 'string',
//     description: 'Name of the component'
//   }
// }
```

##### `getTemplatesDirectory(): string`

Get the resolved templates directory path.

```typescript
const templatesPath = generator.getTemplatesDirectory();
console.log(templatesPath); // "/absolute/path/to/_templates"
```

### TemplateScanner Class

Utility class for analyzing templates and extracting variables.

```typescript
import { TemplateScanner } from 'unjucks';

const scanner = new TemplateScanner();
```

#### Methods

##### `scanTemplate(templatePath: string): Promise<TemplateScanResult>`

Scan a template directory for variables.

```typescript
interface TemplateScanResult {
  templatePath: string;
  variables: TemplateVariable[];
  files: string[];
}

const result = await scanner.scanTemplate('/path/to/_templates/component/react');
console.log(result);
// {
//   templatePath: '/path/to/_templates/component/react',
//   variables: [...],
//   files: [...]
// }
```

##### `generateCliArgs(variables: TemplateVariable[]): Record<string, any>`

Generate CLI argument definitions from template variables.

```typescript
const variables = [
  { name: 'componentName', type: 'string', required: true },
  { name: 'withProps', type: 'boolean', defaultValue: true }
];

const cliArgs = scanner.generateCliArgs(variables);
console.log(cliArgs);
// {
//   componentName: { type: 'string', description: 'componentName' },
//   withProps: { type: 'boolean', description: 'withProps', default: true }
// }
```

## Command Functions

Pre-built command functions for CLI integration with Citty.

### generateCommand

```typescript
import { generateCommand } from 'unjucks';
import { runMain } from 'citty';

runMain(generateCommand);
```

### listCommand

```typescript
import { listCommand } from 'unjucks';
import { runMain } from 'citty';

runMain(listCommand);
```

### initCommand

```typescript
import { initCommand } from 'unjucks';
import { runMain } from 'citty';

runMain(initCommand);
```

## Dynamic Commands

### createDynamicGenerateCommand

Create a generate command with dynamic argument discovery.

```typescript
import { createDynamicGenerateCommand } from 'unjucks';

const dynamicGenerate = createDynamicGenerateCommand();
```

### createTemplateHelpCommand

Create a help command for showing template variables.

```typescript
import { createTemplateHelpCommand } from 'unjucks';

const helpCommand = createTemplateHelpCommand();
```

## Prompt Utilities

Interactive prompt utilities using inquirer-style prompts.

### promptForGenerator

```typescript
import { promptForGenerator } from 'unjucks';

const generator = new Generator();
const generators = await generator.listGenerators();
const selected = await promptForGenerator(generators);
console.log(selected); // 'component'
```

### promptForTemplate

```typescript
import { promptForTemplate } from 'unjucks';

const generator = new Generator();
const templates = await generator.listTemplates('component');
const selected = await promptForTemplate(templates);
console.log(selected); // 'react'
```

### promptForProjectType

```typescript
import { promptForProjectType } from 'unjucks';

const projectType = await promptForProjectType();
console.log(projectType); // 'cli'
```

## Advanced Examples

### Custom CLI Integration

```typescript
import { defineCommand, runMain } from 'citty';
import { Generator } from 'unjucks';

const generator = new Generator();

const myCommand = defineCommand({
  meta: {
    name: 'my-generator',
    description: 'My custom generator'
  },
  args: {
    name: {
      type: 'string',
      description: 'Component name',
      required: true
    },
    dest: {
      type: 'string',
      description: 'Destination directory',
      default: './src'
    }
  },
  async run({ args }) {
    const result = await generator.generate({
      generator: 'component',
      template: 'react',
      dest: args.dest,
      componentName: args.name,
      withProps: true,
      withTests: true
    });
    
    console.log('Generated files:');
    result.files.forEach(file => console.log(`- ${file.path}`));
  }
});

runMain(myCommand);
```

### Template Analysis Pipeline

```typescript
import { Generator } from 'unjucks';

async function analyzeAllTemplates() {
  const generator = new Generator();
  
  const generators = await generator.listGenerators();
  
  for (const gen of generators) {
    console.log(`\n📦 ${gen.name}`);
    
    const templates = await generator.listTemplates(gen.name);
    
    for (const template of templates) {
      console.log(`  📄 ${template.name}`);
      
      const analysis = await generator.scanTemplateForVariables(gen.name, template.name);
      
      console.log(`    Variables:`);
      analysis.variables.forEach(variable => {
        console.log(`    - ${variable.name} (${variable.type})`);
      });
    }
  }
}
```

### Batch Generation Pipeline

```typescript
import { Generator } from 'unjucks';

async function batchGenerate() {
  const generator = new Generator();
  
  const components = [
    { name: 'Button', withProps: true },
    { name: 'Input', withProps: true },
    { name: 'Modal', withProps: false }
  ];
  
  const results = await Promise.all(
    components.map(component =>
      generator.generate({
        generator: 'component',
        template: 'react',
        dest: './src/components',
        force: true,
        componentName: component.name,
        withProps: component.withProps,
        withTests: true
      })
    )
  );
  
  console.log(`Generated ${results.length} components`);
  results.forEach((result, index) => {
    console.log(`${components[index].name}: ${result.files.length} files`);
  });
}
```

### Interactive Generator

```typescript
import { Generator, promptForGenerator, promptForTemplate } from 'unjucks';
import inquirer from 'inquirer';

async function interactiveGenerate() {
  const generator = new Generator();
  
  // Select generator and template
  const generators = await generator.listGenerators();
  const selectedGenerator = await promptForGenerator(generators);
  
  const templates = await generator.listTemplates(selectedGenerator);
  const selectedTemplate = await promptForTemplate(templates);
  
  // Get template variables
  const analysis = await generator.scanTemplateForVariables(
    selectedGenerator,
    selectedTemplate
  );
  
  // Prompt for variables
  const variables: any = {};
  for (const variable of analysis.variables) {
    const answers = await inquirer.prompt([{
      name: variable.name,
      message: variable.description || `Enter ${variable.name}:`,
      type: variable.type === 'boolean' ? 'confirm' : 'input',
      default: variable.defaultValue
    }]);
    
    Object.assign(variables, answers);
  }
  
  // Generate files
  const result = await generator.generate({
    generator: selectedGenerator,
    template: selectedTemplate,
    dest: './src',
    ...variables
  });
  
  console.log('Generated files:');
  result.files.forEach(file => console.log(`- ${file.path}`));
}
```

## Error Handling

```typescript
import { Generator } from 'unjucks';

async function handleErrors() {
  const generator = new Generator();
  
  try {
    await generator.generate({
      generator: 'nonexistent',
      template: 'test',
      dest: './src',
      componentName: 'Test'
    });
  } catch (error) {
    if (error.message.includes('not found')) {
      console.error('Generator or template not found');
    } else if (error.message.includes('already exists')) {
      console.error('File already exists, use force: true');
    } else {
      console.error('Generation failed:', error.message);
    }
  }
}

// Validation before generation
async function validateBeforeGenerate() {
  const generator = new Generator();
  
  // Check if generator exists
  const generators = await generator.listGenerators();
  const generatorExists = generators.some(g => g.name === 'component');
  
  if (!generatorExists) {
    throw new Error('Component generator not found');
  }
  
  // Check if template exists
  const templates = await generator.listTemplates('component');
  const templateExists = templates.some(t => t.name === 'react');
  
  if (!templateExists) {
    throw new Error('React template not found');
  }
  
  // Proceed with generation...
}
```

## Testing

### Unit Testing

```typescript
import { Generator } from 'unjucks';
import { describe, it, expect } from 'vitest';
import path from 'path';

describe('Generator', () => {
  const templatesDir = path.join(__dirname, 'fixtures', '_templates');
  const generator = new Generator(templatesDir);
  
  it('should list generators', async () => {
    const generators = await generator.listGenerators();
    expect(generators).toHaveLength(1);
    expect(generators[0].name).toBe('component');
  });
  
  it('should generate files in dry run', async () => {
    const result = await generator.generate({
      generator: 'component',
      template: 'react',
      dest: './test-output',
      dry: true, // Use dry run for testing
      componentName: 'TestComponent',
      withProps: true
    });
    
    expect(result.files).toHaveLength(2);
    expect(result.files[0].path).toContain('TestComponent.tsx');
    expect(result.files[0].content).toContain('TestComponent');
  });
});
```

### Integration Testing

```typescript
import { Generator } from 'unjucks';
import fs from 'fs-extra';
import path from 'path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('Generator Integration', () => {
  const testDir = path.join(__dirname, 'test-workspace');
  const generator = new Generator();
  
  beforeEach(async () => {
    await fs.ensureDir(testDir);
  });
  
  afterEach(async () => {
    await fs.remove(testDir);
  });
  
  it('should create real files', async () => {
    await generator.generate({
      generator: 'component',
      template: 'react',
      dest: testDir,
      force: true,
      componentName: 'Button',
      withProps: true
    });
    
    const buttonFile = path.join(testDir, 'Button.tsx');
    expect(await fs.pathExists(buttonFile)).toBe(true);
    
    const content = await fs.readFile(buttonFile, 'utf-8');
    expect(content).toContain('Button');
    expect(content).toContain('interface ButtonProps');
  });
});
```

---

For CLI usage, see the [CLI Reference](./cli-reference.md) documentation.