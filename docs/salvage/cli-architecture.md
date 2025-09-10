# CLI Architecture Analysis

## Overview

Unjucks implements a sophisticated CLI architecture built on **Citty** with advanced argument processing, command routing, and interactive capabilities. The architecture supports both Hygen-style positional syntax and explicit command syntax.

## Core Architecture Components

### 1. Entry Points

#### Primary Entry Point (`src/cli/index.js`)
- **Framework**: Citty-based command definition and routing
- **Argument Processing**: Advanced preprocessing with Hygen-style positional support
- **Error Handling**: Comprehensive error recovery and user guidance
- **Module Architecture**: ES module exports with dynamic imports

#### Binary Wrapper (`bin/unjucks.cjs`)
- **Node.js Compatibility**: Version checking (requires Node.js 18+)
- **Error Recovery**: Graceful handling of module loading failures
- **Process Management**: Uncaught exception and promise rejection handling
- **Dynamic Loading**: ES module import from CommonJS wrapper

### 2. Command Structure

#### Command Registration Pattern
```javascript
const main = defineCommand({
  meta: { name: "unjucks", version: getVersion(), description: "..." },
  args: { /* global arguments */ },
  subCommands: {
    // PRIMARY UNIFIED COMMANDS
    new: newCommand,            // Primary command - clear intent
    preview: previewCommand,    // Safe exploration
    help: advancedHelpCommand,  // Context-sensitive help
    
    // SECONDARY COMMANDS
    list: listCommand,
    init: initCommand,
    inject: injectCommand,
    version: versionCommand,
    
    // LEGACY SUPPORT
    generate: generateCommand,  // Legacy command with deprecation warnings
    
    // ADVANCED FEATURES
    semantic: semanticCommand,
    github: githubCommand,
    // ... more commands
  }
});
```

#### Command Definition Pattern
Each command follows a consistent structure:
```javascript
export const exampleCommand = defineCommand({
  meta: {
    name: "command-name",
    description: "Command description"
  },
  args: {
    // Positional arguments
    generator: {
      type: "positional",
      description: "Generator name",
      required: false
    },
    // Named arguments
    force: {
      type: "boolean",
      description: "Force overwrite",
      default: false
    },
    // Aliases
    verbose: {
      type: "boolean",
      alias: "v",
      description: "Verbose output"
    }
  },
  async run(context) {
    const { args } = context;
    // Command implementation
  }
});
```

## 3. Argument Processing Pipeline

### Hygen-Style Positional Preprocessing
The CLI supports intelligent transformation of Hygen-style commands:

```javascript
/**
 * Enhanced pre-process arguments for Hygen-style positional syntax
 * Examples:
 * - unjucks component react MyComponent -> unjucks generate component react MyComponent
 * - unjucks api endpoint users --auth -> unjucks generate api endpoint users --auth
 */
const preprocessArgs = () => {
  const rawArgs = process.argv.slice(2);
  
  // Early returns for performance
  if (rawArgs.length === 0) return rawArgs;
  
  const firstArg = rawArgs[0];
  
  // Don't transform explicit commands
  const explicitCommands = new Set([
    'generate', 'new', 'preview', 'help', 'list', 'init', 'inject', 
    'version', 'semantic', 'swarm', 'workflow', 'perf', 'github'
  ]);
  
  if (explicitCommands.has(firstArg)) return rawArgs;
  
  // Don't transform flags
  if (firstArg.startsWith('-')) return rawArgs;
  
  // Transform Hygen-style to explicit syntax
  if (rawArgs.length >= 2 && !rawArgs[1].startsWith('-')) {
    process.env.UNJUCKS_POSITIONAL_ARGS = JSON.stringify(rawArgs);
    return ['generate', ...rawArgs];
  }
  
  return rawArgs;
};
```

### Variable Extraction and Processing
Commands implement sophisticated variable extraction:

```javascript
// Positional argument processing
function fallbackPositionalParsing(args) {
  const variables = {};
  
  if (args.length > 2) {
    const [, , ...additionalArgs] = args;
    
    // First additional arg is typically the 'name'
    if (additionalArgs.length > 0 && !additionalArgs[0].startsWith("-")) {
      variables.name = additionalArgs[0];
    }
    
    // Handle remaining positional args with type inference
    additionalArgs.slice(1).forEach((arg, index) => {
      if (!arg.startsWith("-")) {
        variables[`arg${index + 2}`] = inferArgumentType(arg);
      }
    });
  }
  
  return variables;
}

// Smart type inference
function inferArgumentType(arg) {
  if (arg === "true" || arg === "false") return arg === "true";
  if (!isNaN(Number(arg))) return Number(arg);
  return arg;
}

// Flag-based variable extraction
function extractFlagVariables(args) {
  const flagVars = {};
  const excludedKeys = [
    "generator", "template", "name", "force", "dry", "_",
    "backup", "skipPrompts", "verbose", "quiet", "v", "y", "q"
  ];
  
  for (const [key, value] of Object.entries(args)) {
    if (!excludedKeys.includes(key) && !key.startsWith('$')) {
      flagVars[key] = value;
    }
  }
  
  return flagVars;
}
```

## 4. Command Implementation Patterns

### Generate Command (Core Functionality)
The generate command demonstrates the full CLI architecture:

```javascript
export const generateCommand = defineCommand({
  meta: {
    name: "generate",
    description: "Generate files from templates with intelligent scaffolding"
  },
  args: {
    generator: { type: "positional", required: false },
    template: { type: "positional", required: false },
    name: { type: "string", required: false },
    dest: { type: "string", default: "." },
    force: { type: "boolean", default: false },
    dry: { type: "boolean", default: false },
    verbose: { type: "boolean", alias: "v", default: false }
  },
  async run(context) {
    const { args } = context;
    
    // 1. Argument preprocessing and validation
    // 2. Interactive prompts if needed
    // 3. Template discovery and validation
    // 4. Variable extraction and merging
    // 5. File generation with progress feedback
    // 6. Result reporting and next steps
  }
});
```

### Help Command (Dynamic Documentation)
Advanced help system with template scanning:

```javascript
export const helpCommand = defineCommand({
  meta: { name: "help", description: "Show template variable help" },
  args: {
    generator: { type: "positional", required: false },
    template: { type: "positional", required: false },
    verbose: { type: "boolean", alias: "v", default: false }
  },
  async run(context) {
    // Dynamic generator/template discovery
    // Context-sensitive help generation
    // Variable extraction from templates
    // Interactive documentation
  },
  
  // Helper methods for dynamic scanning
  async scanGenerators(templatesDir) { /* ... */ },
  async scanTemplates(templatesDir, generatorName) { /* ... */ },
  async parseTemplateVariables(templatesDir, generator, template) { /* ... */ }
});
```

### List Command (Advanced Filtering)
Comprehensive listing with multiple output formats:

```javascript
export const listCommand = defineCommand({
  args: {
    generator: { type: "positional", required: false },
    category: { type: "string", alias: "c" },
    search: { type: "string", alias: "s" },
    format: { type: "string", default: "table", alias: "f" },
    sort: { type: "string", default: "name" },
    direction: { type: "string", default: "asc", alias: "d" },
    detailed: { type: "boolean", alias: "D", default: false },
    quiet: { type: "boolean", alias: "q", default: false }
  },
  async run(context) {
    // Multi-format output (table, JSON, YAML, simple)
    // Advanced filtering and sorting
    // Template metadata extraction
    // Usage statistics integration
  }
});
```

## 5. Interactive Capabilities

### Project Type Selection
```javascript
// Interactive mode implementation
async function promptForGenerator(generators) {
  console.log(chalk.cyan("\n📋 Available Generators:"));
  generators.forEach((gen, index) => {
    console.log(`  ${index + 1}. ${chalk.green(gen.name)} - ${gen.description}`);
  });
  
  // Simplified selection for demonstration
  const selected = generators[0];
  console.log(chalk.blue(`Selected: ${selected.name}`));
  return { generator: selected.name, template: 'default' };
}
```

### Template Variable Scanning
```javascript
async function scanTemplateForVariables(generatorName, templateName) {
  const templateFiles = await this.getTemplateFiles(templatePath);
  const variables = new Set();
  
  for (const templateFile of templateFiles) {
    const templateContent = await fs.readFile(templateFile, 'utf8');
    const { data: frontmatter, content } = matter(templateContent);
    
    // Extract variables from frontmatter and content
    const fullContent = (frontmatter.to || '') + '\n' + content;
    const variableMatches = fullContent.match(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g);
    
    if (variableMatches) {
      variableMatches.forEach(match => {
        const varName = match.replace(/[{}\s]/g, '');
        variables.add(varName);
      });
    }
  }
  
  return { variables: Array.from(variables) };
}
```

## 6. Error Handling and Validation

### Command Error Types
```javascript
export class UnjucksCommandError extends Error {
  constructor(message, code, suggestions = []) {
    super(message);
    this.name = 'UnjucksCommandError';
    this.code = code;
    this.suggestions = suggestions;
  }
}

export const CommandError = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  DIRECTORY_NOT_EMPTY: 'DIRECTORY_NOT_EMPTY',
  PERMISSION_DENIED: 'PERMISSION_DENIED'
};
```

### Validation Pipeline
```javascript
// Argument validation system
const validationResults = [
  validators.generator(args.generator),
  validators.outputFormat(args.format),
  validators.sortOption(args.sort),
  validators.sortDirection(args.direction)
];

if (!displayValidationResults(validationResults, "list")) {
  throw createCommandError(
    "Invalid arguments provided to list command",
    CommandError.VALIDATION_ERROR,
    [
      "Check valid formats: table, json, yaml, simple",
      "Check valid sort options: name, modified, created, usage"
    ]
  );
}
```

## 7. Output Formatting

### Multi-Format Output Support
```javascript
async function outputResults(generators, args) {
  switch (args.format) {
    case "json":
      console.log(JSON.stringify(generators, null, 2));
      break;
    case "yaml":
      console.log(yaml.stringify(generators));
      break;
    case "simple":
      outputSimpleFormat(generators, args);
      break;
    default:
    case "table":
      outputTableFormat(generators, args);
      break;
  }
}
```

### Rich Table Output
```javascript
function outputTableFormat(generators, args) {
  const table = new Table({
    head: args.detailed 
      ? ["Generator", "Description", "Templates", "Category", "Usage"]
      : ["Generator", "Description", "Templates"],
    style: { head: ["cyan"] },
    wordWrap: true,
    colWidths: args.detailed ? [18, 35, 20, 15, 12] : [25, 45, 30]
  });
  
  for (const gen of generators) {
    const row = [
      chalk.green(gen.name),
      gen.description || chalk.gray("No description"),
      gen.templates.length > 0 
        ? gen.templates.map(t => t.name).join(", ")
        : chalk.gray("None")
    ];
    
    if (args.detailed) {
      row.push(
        gen.category || chalk.gray("None"),
        gen.usage?.count?.toString() || chalk.gray("N/A")
      );
    }
    
    table.push(row);
  }
  
  console.log(table.toString());
}
```

## 8. Performance Optimizations

### Early Returns and Caching
- **Argument Preprocessing**: Early returns for empty arguments and flags
- **Command Lookup**: Set-based command validation for O(1) lookup
- **Template Scanning**: Recursive scanning with memoization
- **Version Resolution**: Fast version resolution with caching

### Memory Management
- **Stream Processing**: Large file handling with streams
- **Lazy Loading**: Dynamic imports for optional features
- **Resource Cleanup**: Proper cleanup of temporary resources

## 9. Extension Points

### Command Registration
New commands can be easily added to the subCommands object with full feature parity.

### Argument Processing
The preprocessing pipeline can be extended for new syntax patterns.

### Output Formatters
New output formats can be added to the outputResults function.

### Validation System
Custom validators can be added to the validation pipeline.

## Key Architectural Strengths

1. **Hybrid Syntax Support**: Both Hygen-style positional and explicit command syntax
2. **Dynamic Discovery**: Template and generator scanning without hardcoded configurations
3. **Rich Interaction**: Comprehensive help system and interactive prompts
4. **Error Recovery**: Sophisticated error handling with actionable suggestions
5. **Multi-Format Output**: Support for various output formats (table, JSON, YAML)
6. **Type Safety**: Intelligent type inference for arguments
7. **Performance**: Optimized parsing and early returns for better performance
8. **Extensibility**: Clean extension points for new commands and features

This architecture demonstrates a mature CLI implementation that balances power, usability, and maintainability while supporting both simple and advanced use cases.