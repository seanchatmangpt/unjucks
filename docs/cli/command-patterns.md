# CLI Command Patterns and Architecture

This document describes the architectural patterns, design principles, and implementation details of the Unjucks CLI system.

## Architecture Overview

The Unjucks CLI is built using the **Citty** framework and follows a modular command structure with the following core patterns:

### Command Definition Pattern
```typescript
export const commandName = defineCommand({
  meta: {
    name: "command-name",
    description: "Brief description of what this command does"
  },
  args: {
    // Argument definitions with types, defaults, aliases
    paramName: {
      type: "string" | "boolean" | "positional",
      description: "Parameter description",
      required: false,
      alias: "p",
      default: "default-value"
    }
  },
  async run({ args }) {
    // Command implementation
  }
});
```

### Subcommand Pattern
Complex commands use subcommands for organization:
```typescript
export const mainCommand = defineCommand({
  meta: { name: "main", description: "Main command" },
  subCommands: {
    sub1: defineCommand({ /* subcommand definition */ }),
    sub2: defineCommand({ /* subcommand definition */ })
  }
});
```

## Command Categories

### 1. Core Commands
Located in `/src/commands/` with primary functionality:

- **generate.ts**: Main template generation with intelligent scaffolding
- **list.ts**: Generator and template discovery with filtering
- **init.ts**: Project and generator initialization
- **inject.ts**: File injection and modification capabilities

### 2. Advanced Commands
Extended functionality for specialized use cases:

- **workflow.ts**: Event-driven workflow automation
- **swarm.ts**: AI agent swarm orchestration
- **github.ts**: GitHub integration and repository management
- **mcp.ts**: Model Context Protocol server management

### 3. Specialized Commands
Domain-specific functionality:

- **semantic.ts**: Semantic web and RDF operations
- **neural.ts**: Neural network pattern management
- **security.ts**: Security analysis and validation
- **perf.ts**: Performance monitoring and optimization

## Key Design Patterns

### 1. Validation Pattern
All commands implement comprehensive input validation:

```typescript
// Validate command arguments
const validationResults = [
  validators.generator(args.generator),
  validators.template(args.template),
  validators.path(args.dest, { allowCreate: true }),
  validators.variables(extractFlagVariables(args)),
];

if (!displayValidationResults(validationResults, "generate")) {
  throw createCommandError(
    "Invalid arguments provided to generate command",
    CommandError.VALIDATION_ERROR,
    suggestions
  );
}
```

### 2. Spinner and Progress Pattern
Visual feedback for long-running operations:

```typescript
const spinner = ora("Processing...").start();

try {
  // Perform operations
  spinner.text = "Updated status...";
  // More operations
  spinner.succeed("Operation completed successfully!");
} catch (error) {
  spinner.fail("Operation failed");
  throw error;
}
```

### 3. Error Handling Pattern
Structured error handling with user-friendly messages:

```typescript
try {
  // Command logic
} catch (error) {
  if (error instanceof UnjucksCommandError) {
    console.error(chalk.red(`\n❌ ${error.message}`));
    
    if (error.suggestions?.length > 0) {
      console.log(chalk.blue("\n💡 Suggestions:"));
      error.suggestions.forEach(suggestion => {
        console.log(chalk.blue(`  • ${suggestion}`));
      });
    }
  } else {
    // Generic error handling
  }
  
  process.exit(1);
}
```

### 4. Output Formatting Pattern
Consistent output formatting across commands:

```typescript
function outputResults(data: any[], format: string) {
  switch (format) {
    case "json":
      console.log(JSON.stringify(data, null, 2));
      break;
    case "yaml":
      console.log(yaml.stringify(data));
      break;
    case "table":
      // Use cli-table3 for formatted output
      break;
    default:
      // Simple text format
  }
}
```

## Variable System Architecture

### Dynamic Variable Discovery
The CLI implements intelligent variable discovery from templates:

1. **Template Scanning**: Parses templates for `{{ variable }}` patterns
2. **Filename Analysis**: Extracts variables from dynamic filenames
3. **Frontmatter Processing**: Reads template metadata and configuration
4. **Type Inference**: Automatically determines variable types (string, boolean, number)

### Positional Argument Processing
Supports Hygen-style positional arguments with intelligent mapping:

```typescript
// Hygen-style: unjucks component react MyButton --withTests
// Maps to: { generator: "component", template: "react", name: "MyButton", withTests: true }

function fallbackPositionalParsing(args: string[]): Record<string, any> {
  const variables: Record<string, any> = {};
  
  if (args.length > 2) {
    const [, , ...additionalArgs] = args;
    
    // First additional arg is typically the 'name'
    if (additionalArgs.length > 0 && !additionalArgs[0].startsWith("-")) {
      variables.name = additionalArgs[0];
    }
    
    // Process remaining positional arguments
    // ...
  }
  
  return variables;
}
```

## Integration Patterns

### 1. MCP Integration Pattern
Commands can integrate with Model Context Protocol for AI coordination:

```typescript
async function executeMCPCommand(tool: string, params: any) {
  try {
    const mcp = await createMCPBridge();
    const result = await mcp.callTool(tool, params);
    return result;
  } catch (error) {
    // Fallback to local implementation
    return executeLocalFallback(params);
  }
}
```

### 2. Swarm Coordination Pattern
Agent coordination through hooks system:

```typescript
// Pre-task hook
await executeMCPCommand("mcp__claude-flow__hooks", {
  action: "pre-task",
  description: "CLI analysis"
});

// Post-edit hook
await executeMCPCommand("mcp__claude-flow__hooks", {
  action: "post-edit",
  file: filePath,
  memoryKey: "swarm/cli/analysis"
});
```

### 3. Template System Integration
Direct integration with the Unjucks template engine:

```typescript
const generator = new Generator();

// List available generators
const generators = await generator.listGenerators();

// Generate from template
const result = await generator.generate({
  generator: generatorName,
  template: templateName,
  dest: args.dest,
  variables: processedVariables
});
```

## Command Lifecycle

### 1. Initialization Phase
- Parse command-line arguments
- Validate required parameters
- Initialize necessary services (MCP bridge, generators, etc.)

### 2. Validation Phase
- Validate all input parameters
- Check file system permissions
- Verify template availability
- Display validation results

### 3. Execution Phase
- Execute primary command logic
- Show progress indicators
- Handle intermediate errors
- Coordinate with external services

### 4. Output Phase
- Format and display results
- Show success/error messages
- Provide next step suggestions
- Clean up temporary resources

## Error Types and Handling

### Command Error Types
```typescript
enum CommandError {
  VALIDATION_ERROR = "VALIDATION_ERROR",
  FILE_NOT_FOUND = "FILE_NOT_FOUND",
  PERMISSION_DENIED = "PERMISSION_DENIED",
  TEMPLATE_ERROR = "TEMPLATE_ERROR",
  NETWORK_ERROR = "NETWORK_ERROR"
}
```

### Error Response Pattern
```typescript
throw new UnjucksCommandError(
  "COMMAND_SPECIFIC_ERROR",
  "User-friendly error message",
  ["Helpful suggestion 1", "Helpful suggestion 2"],
  { additionalDetails: "for debugging" }
);
```

## Performance Considerations

### 1. Lazy Loading
Commands and dependencies are loaded only when needed:
- Dynamic imports for heavy modules
- On-demand template discovery
- Conditional MCP server connections

### 2. Caching Strategy
- Template metadata caching
- Generator discovery results
- File system operation optimization

### 3. Progress Feedback
- Spinner animations for long operations
- Step-by-step progress indicators
- Time-based operation estimates

## Testing Patterns

### Command Testing Structure
```typescript
describe("generate command", () => {
  it("should generate files from template", async () => {
    const result = await generateCommand.run({
      args: { generator: "test", template: "basic", name: "TestEntity" }
    });
    
    expect(result.success).toBe(true);
    expect(result.files).toContain("TestEntity.js");
  });
});
```

### Integration Testing
- BDD scenarios using Cucumber
- CLI execution testing with actual file system
- MCP protocol compliance testing
- Cross-platform compatibility testing

This architectural foundation provides the flexibility and extensibility needed for the comprehensive CLI system while maintaining consistency and reliability across all commands.