# API Overview

Unjucks v1.0 programmatic API for code generation and file scaffolding.

## Quick Start

```bash
npm install unjucks
```

```typescript
import { Generator } from 'unjucks';

const generator = new Generator();
const result = await generator.generate({
  generator: 'component',
  template: 'react',
  dest: './src/components',
  componentName: 'Button',
  withProps: true
});
```

## Core Classes

### Generator

Main class for template processing and file generation.

```typescript
import { Generator } from 'unjucks';

const generator = new Generator('/path/to/_templates');
```

#### Essential Methods

**`generate(options: GenerateOptions)`**
Generate files from a template.

```typescript
const result = await generator.generate({
  generator: 'component',
  template: 'react',
  dest: './src/components',
  force: false,
  dry: false,
  // Template variables
  componentName: 'Button',
  withProps: true
});
```

**`listGenerators()`**
List all available generators.

```typescript
const generators = await generator.listGenerators();
// [{ name: 'component', description: 'Generate components', templates: [...] }]
```

**`listTemplates(generatorName: string)`**
List templates for a generator.

```typescript
const templates = await generator.listTemplates('component');
// [{ name: 'react', description: 'React component', files: [...] }]
```

**`scanTemplateForVariables(generator: string, template: string)`**
Extract variables from templates.

```typescript
const { variables, cliArgs } = await generator.scanTemplateForVariables('component', 'react');
// variables: [{ name: 'componentName', type: 'string', required: true }]
```

### TemplateScanner

Utility for template analysis and variable extraction.

```typescript
import { TemplateScanner } from 'unjucks';

const scanner = new TemplateScanner();
const result = await scanner.scanTemplate('/path/to/template');
```

## Essential Types

```typescript
interface GenerateOptions {
  generator: string;
  template: string;
  dest: string;
  force?: boolean;
  dry?: boolean;
  [variableName: string]: any;
}

interface GenerateResult {
  files: TemplateFile[];
}

interface TemplateFile {
  path: string;
  content: string;
}

interface GeneratorConfig {
  name: string;
  description?: string;
  templates: TemplateConfig[];
}

interface TemplateConfig {
  name: string;
  description?: string;
  files: string[];
}

interface TemplateVariable {
  name: string;
  type: 'string' | 'boolean' | 'number' | 'array';
  description?: string;
  defaultValue?: any;
  required?: boolean;
}
```

## Common Patterns

### Basic Generation

```typescript
import { Generator } from 'unjucks';

async function generateComponent() {
  const generator = new Generator();
  
  const result = await generator.generate({
    generator: 'component',
    template: 'react',
    dest: './src/components',
    componentName: 'Button',
    withProps: true,
    withTests: true
  });
  
  console.log(`Generated ${result.files.length} files`);
}
```

### Batch Generation

```typescript
const components = ['Button', 'Input', 'Modal'];

for (const name of components) {
  await generator.generate({
    generator: 'component',
    template: 'react',
    dest: './src/components',
    componentName: name,
    withProps: true
  });
}
```

### Template Analysis

```typescript
// List all generators
const generators = await generator.listGenerators();

// Analyze specific template
const { variables } = await generator.scanTemplateForVariables('component', 'react');
variables.forEach(v => console.log(`${v.name}: ${v.type}`));
```

### Dry Run (Preview)

```typescript
const result = await generator.generate({
  generator: 'component',
  template: 'react',
  dest: './src',
  dry: true, // Preview only
  componentName: 'Button'
});

// result.files contains preview content
```

## Error Handling

```typescript
try {
  await generator.generate({
    generator: 'nonexistent',
    template: 'test',
    dest: './src',
    componentName: 'Button'
  });
} catch (error) {
  if (error.message.includes('not found')) {
    console.error('Generator or template not found');
  } else {
    console.error('Generation failed:', error.message);
  }
}
```

## CLI Integration

Pre-built command functions for quick CLI setup:

```typescript
import { generateCommand, listCommand } from 'unjucks';
import { runMain } from 'citty';

// Use built-in commands
runMain(generateCommand);
```

## Testing

```typescript
import { Generator } from 'unjucks';

describe('Generator', () => {
  it('should generate files', async () => {
    const generator = new Generator('./test-templates');
    const result = await generator.generate({
      generator: 'component',
      template: 'react',
      dest: './test-output',
      dry: true, // Use dry run for testing
      componentName: 'Test'
    });
    
    expect(result.files).toHaveLength(1);
    expect(result.files[0].content).toContain('Test');
  });
});
```

---

For complete API reference and advanced usage, see the [Programmatic API](./programmatic-api.md) documentation.