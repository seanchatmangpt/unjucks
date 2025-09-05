# System Architecture

Comprehensive architecture documentation for Unjucks v1.0, covering design principles, component interactions, and implementation details.

## Overview

Unjucks is built as a modular, extensible code generation system with a clean separation of concerns. The architecture emphasizes flexibility, performance, and developer experience.

## Architecture Principles

### 1. Modular Design
- **Single Responsibility**: Each component has a focused, well-defined purpose
- **Loose Coupling**: Components interact through well-defined interfaces
- **High Cohesion**: Related functionality is grouped together

### 2. Extensibility
- **Plugin Architecture**: Support for custom filters and extensions
- **Template Discovery**: Automatic discovery of generators and templates
- **Dynamic CLI**: Automatically generated CLI from template analysis

### 3. Developer Experience
- **Zero Configuration**: Works out of the box with sensible defaults
- **Interactive Prompts**: User-friendly prompts for missing information
- **Comprehensive Feedback**: Clear error messages and progress indicators

### 4. Performance
- **Lazy Loading**: Components loaded only when needed
- **Caching**: Template analysis results cached for performance
- **Efficient File Operations**: Optimized file system interactions

## System Components

### Core Architecture Diagram

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

## Component Details

### 1. CLI Layer (cli.ts)

**Responsibilities:**
- Command routing and argument parsing
- User interface and feedback
- Integration with Citty command framework

**Key Features:**
- Dynamic command generation from templates
- Comprehensive help system
- Error handling and user feedback

```typescript
// CLI Architecture
const main = defineCommand({
  meta: { name: "unjucks" },
  subCommands: {
    generate: createDynamicGenerateCommand(),  // Dynamic CLI generation
    list: listCommand,                         // Static command
    init: initCommand,                         // Static command
    help: createTemplateHelpCommand()          // Dynamic help
  }
});
```

### 2. Generator Service (lib/generator.ts)

**Responsibilities:**
- Template discovery and management
- File generation workflow orchestration
- Configuration management
- Variable collection and processing

**Core Methods:**
```typescript
class Generator {
  // Discovery
  async listGenerators(): Promise<GeneratorConfig[]>
  async listTemplates(generator: string): Promise<TemplateConfig[]>
  
  // Analysis
  async scanTemplateForVariables(generator: string, template: string)
  
  // Generation
  async generate(options: GenerateOptions): Promise<GenerateResult>
  
  // Initialization
  async initProject(options: InitOptions): Promise<void>
}
```

**Template Discovery Process:**
1. Find templates directory (_templates or templates)
2. Scan subdirectories as generators
3. Load generator configurations (config.yml)
4. Discover templates within generators
5. Build generator/template registry

### 3. Template Scanner (lib/template-scanner.ts)

**Responsibilities:**
- Template file analysis
- Variable extraction from Nunjucks syntax
- CLI argument generation
- Type inference for variables

**Variable Detection Patterns:**
```typescript
// Nunjucks variable patterns
{{ variableName }}                    // String variable
{{ variableName | filter }}           // String with filter
{% if variableName %}                 // Boolean variable
{% for item in items %}               // Array variable (items)

// Filename patterns
{{ componentName | pascalCase }}.tsx  // Variable in filename

// Boolean detection heuristics
withTests, hasProps, isActive         // Boolean by naming convention
```

### 4. Nunjucks Engine Integration

**Responsibilities:**
- Template rendering
- Custom filter implementation
- Environment configuration

**Custom Filters:**
```typescript
// String transformation filters
camelCase:    "hello world" → "helloWorld"
pascalCase:   "hello world" → "HelloWorld"
kebabCase:    "hello world" → "hello-world"
snakeCase:    "hello world" → "hello_world"
titleCase:    "hello world" → "Hello World"

// Pluralization filters
pluralize:    "item" → "items"
singularize:  "items" → "item"

// Capitalization filters
capitalize:   "hello world" → "Hello world"
```

### 5. File System Operations

**Responsibilities:**
- File and directory creation
- Atomic file operations
- Permission handling
- Conflict resolution

**File Generation Workflow:**
```
Template Processing → Variable Substitution → Filename Generation → File Writing
       ↓                      ↓                      ↓               ↓
   Parse template     Apply Nunjucks engine    Process filename    Create/update
   files and dirs     with variables           variables           files safely
```

### 6. Dynamic Command Generation

**Responsibilities:**
- Runtime CLI command creation
- Argument parsing and validation
- Help text generation

**Dynamic CLI Process:**
1. User runs `unjucks generate <generator> <template>`
2. System scans template for variables
3. CLI arguments generated from variables
4. Command executed with parsed arguments
5. Variables passed to template engine

## Data Flow Architecture

### Template Generation Flow

```
User Input → CLI Parsing → Template Discovery → Variable Extraction → Template Rendering → File Output
     ↓           ↓              ↓                     ↓                    ↓              ↓
CLI Command → Arguments → Generator/Template → Variables List → Nunjucks Engine → Generated Files
```

### Detailed Flow Steps

1. **Command Parsing**
   ```typescript
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
   // Result: [{ name: 'componentName', type: 'string' }, ...]
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

5. **Template Rendering**
   ```typescript
   // Process each template file
   const content = nunjucks.render(templateContent, templateVars);
   const filename = nunjucks.render(templateFilename, templateVars);
   ```

6. **File Generation**
   ```typescript
   // Write processed files to destination
   await fs.writeFile(path.join(destDir, filename), content);
   ```

## Template Structure

### Standard Template Layout

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

### Configuration Schema

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

## Error Handling Strategy

### Error Categories

1. **User Errors**
   - Invalid command syntax
   - Missing required variables
   - File conflicts

2. **System Errors**
   - Template not found
   - File system permissions
   - Invalid template syntax

3. **Configuration Errors**
   - Invalid YAML configuration
   - Missing template files
   - Circular dependencies

### Error Handling Flow

```typescript
try {
  // Operation
  await generator.generate(options);
} catch (error) {
  if (error instanceof TemplateNotFoundError) {
    // Show available templates
    console.error(`Template not found. Available templates:`);
    showAvailableTemplates();
  } else if (error instanceof VariableValidationError) {
    // Show variable requirements
    console.error(`Missing required variables:`);
    showRequiredVariables(error.missingVars);
  } else {
    // Generic error handling
    console.error(`Generation failed: ${error.message}`);
  }
}
```

## Performance Considerations

### Optimization Strategies

1. **Lazy Loading**
   - Templates loaded only when accessed
   - CLI commands generated on-demand
   - File operations batched when possible

2. **Caching**
   - Template analysis results cached
   - Generator configurations cached
   - File system lookups minimized

3. **Memory Management**
   - Large file operations streamed
   - Template content released after processing
   - Temporary files cleaned up automatically

### Performance Metrics

| Operation | Target Performance | Actual (v1.0) |
|-----------|-------------------|---------------|
| Template Discovery | < 100ms | ~50ms |
| Variable Extraction | < 50ms | ~25ms |
| File Generation | < 200ms/file | ~100ms/file |
| CLI Startup | < 500ms | ~200ms |

## Security Architecture

### Input Validation

```typescript
// Template path validation
const safePath = path.resolve(templatesDir, userPath);
if (!safePath.startsWith(templatesDir)) {
  throw new SecurityError('Path traversal attempt detected');
}

// Variable validation
const sanitizedVars = Object.fromEntries(
  Object.entries(vars).map(([key, value]) => [
    sanitizeVariableName(key),
    sanitizeVariableValue(value)
  ])
);
```

### File System Security

1. **Path Validation**
   - Prevent path traversal attacks
   - Validate file extensions
   - Restrict output directories

2. **Permission Checks**
   - Verify write permissions
   - Check file ownership
   - Respect system file attributes

3. **Template Sandboxing**
   - Restrict template file access
   - Prevent arbitrary code execution
   - Validate template syntax

## Extension Points

### 1. Custom Filters

```typescript
// Register custom filter
env.addFilter('customFilter', (str: string) => {
  return processString(str);
});

// Usage in template
{{ variableName | customFilter }}
```

### 2. Custom Commands

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

### 3. Template Processors

```typescript
// Custom template processor
class CustomTemplateProcessor {
  async process(template: string, variables: any): Promise<string> {
    // Custom processing logic
    return processedTemplate;
  }
}
```

### 4. Variable Extractors

```typescript
// Custom variable extractor
class CustomVariableExtractor {
  extractVariables(content: string): TemplateVariable[] {
    // Custom extraction logic
    return variables;
  }
}
```

## Testing Architecture

### Test Strategy

1. **Unit Tests** - Individual component testing
2. **Integration Tests** - Component interaction testing
3. **BDD Tests** - Behavior-driven feature testing
4. **Performance Tests** - Load and stress testing

### Test Structure

```
tests/
├── unit/                      # Vitest unit tests
│   ├── generator.test.ts
│   ├── template-scanner.test.ts
│   └── filters.test.ts
├── step-definitions/          # Cucumber step implementations
├── fixtures/                  # Test data and templates
└── support/                   # Test utilities
```

### Test Coverage

- **Unit Tests**: 95%+ code coverage
- **Integration Tests**: All major workflows
- **BDD Tests**: 302 scenarios across 18 features
- **Performance Tests**: Key operation benchmarks

## Deployment Architecture

### Build Process

```typescript
// obuild configuration
export default {
  entries: [
    'src/index.ts',      // Main API
    'src/cli.ts'         // CLI entry point
  ],
  outDir: 'dist',
  format: 'esm',
  target: 'node16',
  dts: true              // Generate TypeScript definitions
};
```

### Distribution

1. **npm Package** - Primary distribution method
2. **Global Installation** - CLI available system-wide
3. **Local Installation** - Project-specific usage
4. **Docker Image** - Containerized deployment (future)

### Compatibility

- **Node.js**: >= 16.0.0
- **Operating Systems**: macOS, Linux, Windows
- **Package Managers**: npm, pnpm, yarn
- **Module Systems**: ESM (primary), CJS (compatibility)

## Future Architecture Considerations

### Planned Enhancements

1. **Plugin System**
   - Third-party generator plugins
   - Custom filter packages
   - Template marketplace integration

2. **Remote Templates**
   - Git repository templates
   - NPM template packages
   - Template sharing platform

3. **Advanced Features**
   - Template composition
   - Multi-language support
   - IDE integrations

4. **Performance Improvements**
   - Parallel template processing
   - Incremental generation
   - Template compilation

### Scalability Considerations

1. **Large Projects**
   - Template registry optimization
   - Memory usage optimization
   - Batch operation support

2. **Enterprise Features**
   - Template governance
   - Audit logging
   - Access controls

3. **Cloud Integration**
   - Serverless deployment
   - Container orchestration
   - CI/CD pipeline integration

---

*For implementation details and API usage, see the [API Reference](../api/README.md) and [Getting Started Guide](../getting-started.md).*