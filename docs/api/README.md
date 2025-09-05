# API Reference

Complete programmatic API reference for Unjucks v1.0.

## Overview

Unjucks provides a comprehensive Node.js API for integrating code generation into your applications. The API mirrors the CLI functionality while providing additional programmatic features.

## Installation

```bash
npm install unjucks
```

## Core Classes

### Generator

The main class for template processing and file generation.

```typescript
import { Generator } from 'unjucks';

const generator = new Generator('/path/to/_templates');
```

#### Constructor

```typescript
new Generator(templatesDir?: string)
```

**Parameters:**
- `templatesDir` (optional) - Path to templates directory. Defaults to auto-discovery.

**Auto-discovery process:**
1. Starts from current working directory
2. Walks up directory tree looking for `package.json`
3. Looks for `_templates` or `templates` directory
4. Falls back to `_templates` in current directory

#### Methods

##### `listGenerators(): Promise<GeneratorConfig[]>`

List all available generators.

```typescript
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

**Returns:** Array of `GeneratorConfig` objects.

##### `listTemplates(generatorName: string): Promise<TemplateConfig[]>`

List all templates for a specific generator.

```typescript
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

**Parameters:**
- `generatorName` - Name of the generator

**Returns:** Array of `TemplateConfig` objects.

##### `scanTemplateForVariables(generatorName: string, templateName: string): Promise<{variables: TemplateVariable[], cliArgs: Record<string, any>}>`

Scan a template for variables and generate CLI argument definitions.

```typescript
const result = await generator.scanTemplateForVariables('component', 'react');
console.log(result.variables);
// [
//   {
//     name: 'componentName',
//     type: 'string',
//     description: 'Name of the component',
//     defaultValue: undefined,
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

**Parameters:**
- `generatorName` - Generator name
- `templateName` - Template name

**Returns:** Object with variables and CLI arguments.

##### `generate(options: GenerateOptions): Promise<GenerateResult>`

Generate files from a template.

```typescript
const result = await generator.generate({
  generator: 'component',
  template: 'react',
  dest: './src/components',
  force: false,
  dry: false,
  // Additional variables are passed dynamically
  componentName: 'Button',
  withProps: true,
  withTests: true
});

console.log(result.files);
// [
//   {
//     path: './src/components/Button.tsx',
//     content: 'import React from "react"...'
//   }
// ]
```

**Parameters:** `GenerateOptions` object (see [Types](#types) section).

**Returns:** `GenerateResult` object with generated files.

##### `initProject(options: InitOptions): Promise<void>`

Initialize a new project with template generators.

```typescript
await generator.initProject({
  type: 'cli',
  dest: './my-project'
});
```

**Parameters:** `InitOptions` object.

##### `getTemplatesDirectory(): string`

Get the resolved templates directory path.

```typescript
const templatesPath = generator.getTemplatesDirectory();
console.log(templatesPath); // "/path/to/_templates"
```

**Returns:** Absolute path to templates directory.

### TemplateScanner

Utility class for analyzing templates and extracting variables.

```typescript
import { TemplateScanner } from 'unjucks';

const scanner = new TemplateScanner();
```

#### Methods

##### `scanTemplate(templatePath: string): Promise<TemplateScanResult>`

Scan a template directory for variables.

```typescript
const result = await scanner.scanTemplate('/path/to/_templates/component/react');
console.log(result);
// {
//   templatePath: '/path/to/_templates/component/react',
//   variables: [...],
//   files: [...]
// }
```

**Parameters:**
- `templatePath` - Absolute path to template directory

**Returns:** `TemplateScanResult` object.

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

**Parameters:**
- `variables` - Array of `TemplateVariable` objects

**Returns:** CLI arguments object.

##### `convertArgsToVariables(args: any, variables: TemplateVariable[]): Record<string, any>`

Convert CLI arguments to template variables.

```typescript
const args = { componentName: 'Button', withProps: true };
const variables = [
  { name: 'componentName', type: 'string' },
  { name: 'withProps', type: 'boolean' }
];

const templateVars = scanner.convertArgsToVariables(args, variables);
console.log(templateVars);
// { componentName: 'Button', withProps: true }
```

**Parameters:**
- `args` - CLI arguments object
- `variables` - Array of `TemplateVariable` objects

**Returns:** Template variables object.

## Command Functions

Pre-built command functions for CLI integration.

### generateCommand

Citty command for template generation.

```typescript
import { generateCommand } from 'unjucks';
import { runMain } from 'citty';

runMain(generateCommand);
```

### listCommand

Citty command for listing generators.

```typescript
import { listCommand } from 'unjucks';
import { runMain } from 'citty';

runMain(listCommand);
```

### initCommand

Citty command for project initialization.

```typescript
import { initCommand } from 'unjucks';
import { runMain } from 'citty';

runMain(initCommand);
```

### versionCommand

Citty command for version information.

```typescript
import { versionCommand } from 'unjucks';
import { runMain } from 'citty';

runMain(versionCommand);
```

## Dynamic Commands

Utilities for creating dynamic CLI commands.

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

Interactive prompt utilities.

### promptForGenerator

Prompt user to select a generator.

```typescript
import { promptForGenerator } from 'unjucks';

const generator = new Generator();
const generators = await generator.listGenerators();
const selected = await promptForGenerator(generators);
console.log(selected); // 'component'
```

### promptForTemplate

Prompt user to select a template.

```typescript
import { promptForTemplate } from 'unjucks';

const generator = new Generator();
const templates = await generator.listTemplates('component');
const selected = await promptForTemplate(templates);
console.log(selected); // 'react'
```

### promptForProjectType

Prompt user to select a project type for initialization.

```typescript
import { promptForProjectType } from 'unjucks';

const projectType = await promptForProjectType();
console.log(projectType); // 'cli'
```

## Types

### GeneratorConfig

```typescript
interface GeneratorConfig {
  name: string;
  description?: string;
  templates: TemplateConfig[];
}
```

### TemplateConfig

```typescript
interface TemplateConfig {
  name: string;
  description?: string;
  files: string[];
  prompts?: PromptConfig[];
}
```

### PromptConfig

```typescript
interface PromptConfig {
  name: string;
  message: string;
  type: 'input' | 'confirm' | 'list' | 'checkbox';
  default?: any;
  choices?: string[];
}
```

### GenerateOptions

```typescript
interface GenerateOptions {
  generator: string;
  template: string;
  dest: string;
  force: boolean;
  dry: boolean;
  // Additional properties are template variables
  [key: string]: any;
}
```

### GenerateResult

```typescript
interface GenerateResult {
  files: TemplateFile[];
}
```

### TemplateFile

```typescript
interface TemplateFile {
  path: string;
  content: string;
}
```

### InitOptions

```typescript
interface InitOptions {
  type: string;
  dest: string;
}
```

### TemplateVariable

```typescript
interface TemplateVariable {
  name: string;
  type: 'string' | 'boolean' | 'number' | 'array';
  description?: string;
  defaultValue?: any;
  required?: boolean;
}
```

### TemplateScanResult

```typescript
interface TemplateScanResult {
  templatePath: string;
  variables: TemplateVariable[];
  files: string[];
}
```

## Examples

### Basic Generation

```typescript
import { Generator } from 'unjucks';

async function generateComponent() {
  const generator = new Generator();
  
  const result = await generator.generate({
    generator: 'component',
    template: 'react',
    dest: './src/components',
    force: false,
    dry: false,
    componentName: 'Button',
    withProps: true,
    withTests: true
  });
  
  console.log(`Generated ${result.files.length} files`);
  result.files.forEach(file => {
    console.log(`- ${file.path}`);
  });
}

generateComponent().catch(console.error);
```

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
      force: false,
      dry: false,
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

### Template Analysis

```typescript
import { Generator, TemplateScanner } from 'unjucks';

async function analyzeTemplate() {
  const generator = new Generator();
  const scanner = new TemplateScanner();
  
  // Get all generators
  const generators = await generator.listGenerators();
  
  for (const gen of generators) {
    console.log(`\n📦 ${gen.name}`);
    
    // Get templates for this generator
    const templates = await generator.listTemplates(gen.name);
    
    for (const template of templates) {
      console.log(`  📄 ${template.name}`);
      
      // Analyze template variables
      const analysis = await generator.scanTemplateForVariables(gen.name, template.name);
      
      console.log(`    Variables:`);
      analysis.variables.forEach(variable => {
        console.log(`    - ${variable.name} (${variable.type})`);
      });
    }
  }
}

analyzeTemplate().catch(console.error);
```

### Batch Generation

```typescript
import { Generator } from 'unjucks';

async function batchGenerate() {
  const generator = new Generator();
  
  const components = [
    { name: 'Button', withProps: true },
    { name: 'Input', withProps: true },
    { name: 'Modal', withProps: false }
  ];
  
  for (const component of components) {
    await generator.generate({
      generator: 'component',
      template: 'react',
      dest: './src/components',
      force: true,
      dry: false,
      componentName: component.name,
      withProps: component.withProps,
      withTests: true
    });
    
    console.log(`Generated ${component.name} component`);
  }
}

batchGenerate().catch(console.error);
```

### Interactive Generator

```typescript
import { Generator, promptForGenerator, promptForTemplate } from 'unjucks';
import inquirer from 'inquirer';

async function interactiveGenerate() {
  const generator = new Generator();
  
  // Select generator
  const generators = await generator.listGenerators();
  const selectedGenerator = await promptForGenerator(generators);
  
  // Select template
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
    force: false,
    dry: false,
    ...variables
  });
  
  console.log('Generated files:');
  result.files.forEach(file => console.log(`- ${file.path}`));
}

interactiveGenerate().catch(console.error);
```

## Error Handling

### Common Errors

```typescript
import { Generator } from 'unjucks';

async function handleErrors() {
  const generator = new Generator();
  
  try {
    await generator.generate({
      generator: 'nonexistent',
      template: 'test',
      dest: './src',
      force: false,
      dry: false
    });
  } catch (error) {
    if (error.message.includes('not found')) {
      console.error('Generator or template not found');
    } else {
      console.error('Generation failed:', error.message);
    }
  }
}
```

### Validation

```typescript
import { Generator } from 'unjucks';

async function validateGeneration() {
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
  
  it('should generate files', async () => {
    const result = await generator.generate({
      generator: 'component',
      template: 'react',
      dest: './test-output',
      force: true,
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
      dry: false,
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

*For more examples and integration patterns, see the [Getting Started Guide](../getting-started.md) and [Testing Guide](../testing/README.md).*