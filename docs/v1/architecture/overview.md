# Architecture Overview

Essential architectural concepts for Unjucks v1.0 - the modular code generation system.

## Core Principles

### 1. Modular Design
- **Single Responsibility**: Each component has one focused purpose
- **Loose Coupling**: Components interact through well-defined interfaces
- **Extensibility**: Plugin architecture supports custom filters and extensions

### 2. Zero Configuration
- Works out of the box with sensible defaults
- Automatic template discovery and CLI generation
- User-friendly prompts for missing information

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Unjucks CLI                            │
├─────────────────────────────────────────────────────────────────┤
│                     Command Layer                              │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌──────────┐  │
│  │   generate  │ │    list     │ │    init     │ │   help   │  │
│  └─────────────┘ └─────────────┘ └─────────────┘ └──────────┘  │
├─────────────────────────────────────────────────────────────────┤
│                    Service Layer                               │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                 Generator                                   │ │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────┐ │ │
│  │  │ Discovery   │ │ Processing  │ │    File Generation      │ │ │
│  │  └─────────────┘ └─────────────┘ └─────────────────────────┘ │ │
│  └─────────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │              TemplateScanner                                │ │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────┐ │ │
│  │  │ Variable    │ │ File        │ │    CLI Args             │ │ │
│  │  │ Extraction  │ │ Analysis    │ │    Generation           │ │ │
│  │  └─────────────┘ └─────────────┘ └─────────────────────────┘ │ │
│  └─────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│                    Engine Layer                                │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────────┐ │
│  │   Nunjucks      │ │  File System    │ │     Prompts         │ │
│  │   Engine        │ │  Operations     │ │     (Inquirer)      │ │
│  └─────────────────┘ └─────────────────┘ └─────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. CLI Layer (cli.ts)
**Purpose**: Command routing, argument parsing, and user interaction

**Key Features**:
- Dynamic command generation from templates
- Comprehensive help system
- Interactive prompts for missing variables

### 2. Generator Service (lib/generator.ts)
**Purpose**: Template discovery, processing, and file generation orchestration

**Core Methods**:
```typescript
class Generator {
  async listGenerators(): Promise<GeneratorConfig[]>
  async listTemplates(generator: string): Promise<TemplateConfig[]>
  async scanTemplateForVariables(generator: string, template: string)
  async generate(options: GenerateOptions): Promise<GenerateResult>
  async initProject(options: InitOptions): Promise<void>
}
```

### 3. Template Scanner (lib/template-scanner.ts)
**Purpose**: Template analysis, variable extraction, and CLI argument generation

**Variable Detection**:
```typescript
// Nunjucks patterns detected
{{ variableName }}                    // String variable
{{ variableName | filter }}           // String with filter
{% if variableName %}                 // Boolean variable
{% for item in items %}               // Array variable (items)
{{ componentName | pascalCase }}.tsx  // Variable in filename
```

## Data Flow

### Template Generation Process
```
User Input → CLI Parsing → Template Discovery → Variable Extraction → Template Rendering → File Output
     ↓           ↓              ↓                     ↓                    ↓              ↓
CLI Command → Arguments → Generator/Template → Variables List → Nunjucks Engine → Generated Files
```

### Detailed Steps

1. **Command Parsing**
   ```bash
   unjucks generate component react --componentName Button --withProps
   ```

2. **Template Discovery**
   ```typescript
   // Find template at: _templates/component/react/
   const templatePath = path.join(templatesDir, 'component', 'react');
   ```

3. **Variable Extraction**
   ```typescript
   // Scan template files for {{ variables }}
   const variables = scanner.scanTemplate(templatePath);
   ```

4. **Variable Collection**
   ```typescript
   // Merge CLI args with prompts
   const templateVars = {
     componentName: 'Button',    // From CLI
     withProps: true,            // From CLI
     withTests: await prompt()   // From interactive prompt
   };
   ```

5. **Template Rendering & File Generation**
   ```typescript
   // Process each template file
   const content = nunjucks.render(templateContent, templateVars);
   const filename = nunjucks.render(templateFilename, templateVars);
   await fs.writeFile(path.join(destDir, filename), content);
   ```

## Template Structure

### Standard Layout
```
_templates/
├── generator1/                 # Generator directory
│   ├── config.yml             # Optional configuration
│   ├── template1/             # Template directory
│   │   ├── file1.txt.njk      # Template files
│   │   ├── {{ name }}.ts      # Dynamic filename
│   │   └── subdir/
│   │       └── nested.tsx
│   └── template2/
└── generator2/
```

### Configuration Example
```yaml
# _templates/component/config.yml
name: "component"
description: "Generate React components"
templates:
  - name: "react"
    description: "React functional component"
    files:
      - "{{ componentName | pascalCase }}.tsx"
      - "{{ componentName | pascalCase }}.test.tsx"
    prompts:
      - name: "componentName"
        message: "Component name:"
        type: "input"
        default: "MyComponent"
      - name: "withProps"
        message: "Include props interface?"
        type: "confirm"
        default: true
```

## Built-in Filters

### String Transformation
```typescript
camelCase:    "hello world" → "helloWorld"
pascalCase:   "hello world" → "HelloWorld"
kebabCase:    "hello world" → "hello-world"
snakeCase:    "hello world" → "hello_world"
titleCase:    "hello world" → "Hello World"
```

### Pluralization
```typescript
pluralize:    "item" → "items"
singularize:  "items" → "item"
```

### Capitalization
```typescript
capitalize:   "hello world" → "Hello world"
```

## Error Handling

### Error Categories
1. **User Errors**: Invalid syntax, missing variables, file conflicts
2. **System Errors**: Template not found, file permissions, invalid template syntax
3. **Configuration Errors**: Invalid YAML, missing files, circular dependencies

### Error Recovery
```typescript
try {
  await generator.generate(options);
} catch (error) {
  if (error instanceof TemplateNotFoundError) {
    console.error(`Template not found. Available templates:`);
    showAvailableTemplates();
  } else if (error instanceof VariableValidationError) {
    console.error(`Missing required variables:`);
    showRequiredVariables(error.missingVars);
  }
}
```

## Performance Features

### Optimization Strategies
1. **Lazy Loading**: Templates loaded only when accessed
2. **Caching**: Template analysis results cached for performance
3. **Efficient File Operations**: Optimized file system interactions

### Target Performance
| Operation | Target | Typical |
|-----------|--------|---------|
| Template Discovery | < 100ms | ~50ms |
| Variable Extraction | < 50ms | ~25ms |
| File Generation | < 200ms/file | ~100ms/file |
| CLI Startup | < 500ms | ~200ms |

## Extension Points

### Custom Filters
```typescript
// Register custom filter
env.addFilter('customFilter', (str: string) => {
  return processString(str);
});

// Usage in template
{{ variableName | customFilter }}
```

### Custom Commands
```typescript
// Add custom command
const customCommand = defineCommand({
  meta: { name: 'custom' },
  async run() {
    // Custom logic
  }
});

main.subCommands.custom = customCommand;
```

---

*This overview covers the essential architecture concepts. For detailed implementation specifics, see the template engine and file operations documentation.*