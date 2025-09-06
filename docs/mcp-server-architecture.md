# Unjucks MCP Server Architecture Design

## Executive Summary

This document defines the Model Context Protocol (MCP) server architecture for Unjucks, enabling seamless integration with Claude and other AI assistants. The design follows the 80/20 principle, focusing on the most valuable operations while ensuring scalability, security, and maintainability.

## System Overview

The MCP server acts as a bridge between AI assistants and the Unjucks template generation system, providing standardized tool interfaces for template discovery, generation, and management.

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Claude / AI Assistant                      │
└─────────────────────────┬───────────────────────────────────────────┘
                          │ MCP Protocol
                          │
┌─────────────────────────▼───────────────────────────────────────────┐
│                     Unjucks MCP Server                             │
│  ┌─────────────────┬────────────────┬───────────────────────────┐  │
│  │   Tool Router   │  Validator     │    Security Manager       │  │
│  └─────────────────┴────────────────┴───────────────────────────┘  │
│  ┌─────────────────┬────────────────┬───────────────────────────┐  │
│  │  Discovery API  │ Generation API │     Management API        │  │
│  └─────────────────┴────────────────┴───────────────────────────┘  │
└─────────────────────────┬───────────────────────────────────────────┘
                          │ Internal API
                          │
┌─────────────────────────▼───────────────────────────────────────────┐
│                    Unjucks Core Engine                             │
│  ┌─────────────────┬────────────────┬───────────────────────────┐  │
│  │   Generator     │  FileInjector  │    Template Scanner       │  │
│  └─────────────────┴────────────────┴───────────────────────────┘  │
│  ┌─────────────────┬────────────────┬───────────────────────────┐  │
│  │ Dynamic Commands│  Arg Parser    │     Performance Monitor   │  │
│  └─────────────────┴────────────────┴───────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

## Core MCP Tools (80/20 Focus)

### 1. unjucks_list
**Purpose**: Discover and list available generators/templates
**Usage**: 95% of users need template discovery

```typescript
interface ListParams {
  generator?: string;      // Optional: filter by generator
  format?: "simple" | "detailed" | "json";
  showHidden?: boolean;
}

interface ListResult {
  generators: {
    name: string;
    description?: string;
    templates: {
      name: string;
      description?: string;
      files: string[];
    }[];
  }[];
}
```

### 2. unjucks_generate
**Purpose**: Generate files from templates with variables
**Usage**: 90% of core functionality

```typescript
interface GenerateParams {
  generator: string;       // Required: generator name
  template: string;        // Required: template name
  dest?: string;          // Optional: destination (default: ".")
  variables?: Record<string, any>; // Template variables
  force?: boolean;        // Overwrite existing files
  dry?: boolean;          // Preview without creating files
}

interface GenerateResult {
  success: boolean;
  files: {
    path: string;
    action: "created" | "updated" | "skipped" | "injected";
    content?: string;       // For dry runs
  }[];
  errors?: string[];
}
```

### 3. unjucks_help
**Purpose**: Get template variable help and documentation
**Usage**: 70% of users need variable guidance

```typescript
interface HelpParams {
  generator: string;
  template: string;
}

interface HelpResult {
  variables: {
    name: string;
    type: "string" | "boolean" | "number";
    description: string;
    required: boolean;
    defaultValue?: any;
    isPositional?: boolean;
  }[];
  examples: string[];
  frontmatterOptions: string[];
}
```

### 4. unjucks_dry_run
**Purpose**: Preview generation without creating files
**Usage**: 60% of users for validation

```typescript
interface DryRunParams extends GenerateParams {
  showContent?: boolean;   // Include file content in preview
  showDiff?: boolean;     // Show diffs for existing files
}

interface DryRunResult {
  wouldCreate: string[];
  wouldUpdate: string[];
  wouldSkip: string[];
  conflicts: string[];
  preview?: Record<string, string>; // path -> content
}
```

### 5. unjucks_inject
**Purpose**: Inject content into existing files
**Usage**: 40% of users for advanced workflows

```typescript
interface InjectParams {
  filePath: string;
  content: string;
  mode: "inject" | "append" | "prepend" | "lineAt";
  target?: string;        // For inject mode
  lineNumber?: number;    // For lineAt mode
  backup?: boolean;
  force?: boolean;
}

interface InjectResult {
  success: boolean;
  action: "injected" | "skipped" | "failed";
  message: string;
  backupPath?: string;
}
```

## Architecture Components

### 1. MCP Server Core (`src/mcp/server.ts`)

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';

export class UnjucksMCPServer {
  private server: Server;
  private toolRouter: ToolRouter;
  private validator: RequestValidator;
  private securityManager: SecurityManager;

  constructor() {
    this.server = new Server({
      name: "unjucks",
      version: "1.0.0",
      description: "Unjucks template generation MCP server"
    }, {
      capabilities: {
        tools: {}
      }
    });

    this.setupHandlers();
  }

  private setupHandlers() {
    // Tool listing
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: TOOL_DEFINITIONS
    }));

    // Tool execution
    this.server.setRequestHandler(CallToolRequestSchema, async (request) =>
      this.handleToolCall(request)
    );
  }
}
```

### 2. Tool Router (`src/mcp/tools/router.ts`)

```typescript
export class ToolRouter {
  private tools: Map<string, ToolHandler>;

  constructor() {
    this.tools = new Map([
      ['unjucks_list', new ListToolHandler()],
      ['unjucks_generate', new GenerateToolHandler()],
      ['unjucks_help', new HelpToolHandler()],
      ['unjucks_dry_run', new DryRunToolHandler()],
      ['unjucks_inject', new InjectToolHandler()],
    ]);
  }

  async route(toolName: string, params: any): Promise<ToolResult> {
    const handler = this.tools.get(toolName);
    if (!handler) {
      throw new Error(`Unknown tool: ${toolName}`);
    }

    return await handler.execute(params);
  }
}
```

### 3. Security Manager (`src/mcp/security/manager.ts`)

```typescript
export class SecurityManager {
  private readonly MAX_FILE_SIZE = 100_000_000; // 100MB
  private readonly DANGEROUS_PATHS = [
    '/etc', '/root', '/sys', '/proc', '/dev',
    'C:\\Windows', 'C:\\Program Files'
  ];

  validateFilePath(path: string): SecurityCheckResult {
    // Path traversal protection
    const normalized = path.normalize(path);
    if (normalized.includes('..')) {
      return { valid: false, reason: 'Path traversal detected' };
    }

    // System path protection
    const resolved = path.resolve(normalized);
    for (const dangerousPath of this.DANGEROUS_PATHS) {
      if (resolved.startsWith(dangerousPath)) {
        return { valid: false, reason: 'System directory access blocked' };
      }
    }

    return { valid: true, sanitized: resolved };
  }

  async validateFileSize(path: string): Promise<boolean> {
    if (await fs.pathExists(path)) {
      const stats = await fs.stat(path);
      return stats.size <= this.MAX_FILE_SIZE;
    }
    return true;
  }
}
```

### 4. Request Validator (`src/mcp/validation/validator.ts`)

```typescript
export class RequestValidator {
  private schemas: Map<string, JSONSchema7>;

  constructor() {
    this.schemas = new Map([
      ['unjucks_list', LIST_SCHEMA],
      ['unjucks_generate', GENERATE_SCHEMA],
      ['unjucks_help', HELP_SCHEMA],
      ['unjucks_dry_run', DRY_RUN_SCHEMA],
      ['unjucks_inject', INJECT_SCHEMA],
    ]);
  }

  validate(toolName: string, params: any): ValidationResult {
    const schema = this.schemas.get(toolName);
    if (!schema) {
      return { valid: false, errors: [`Unknown tool: ${toolName}`] };
    }

    const ajv = new Ajv({ allErrors: true });
    const validate = ajv.compile(schema);
    const valid = validate(params);

    if (!valid) {
      return {
        valid: false,
        errors: validate.errors?.map(err => 
          `${err.instancePath}: ${err.message}`
        ) || []
      };
    }

    return { valid: true };
  }
}
```

## Tool Handler Implementations

### List Tool Handler (`src/mcp/tools/list.ts`)

```typescript
export class ListToolHandler implements ToolHandler {
  async execute(params: ListParams): Promise<ToolResult> {
    try {
      const generator = new Generator();
      const generators = await generator.listGenerators();

      if (params.generator) {
        const filtered = generators.filter(g => g.name === params.generator);
        if (filtered.length === 0) {
          return {
            content: [{
              type: "text",
              text: `Generator '${params.generator}' not found`
            }],
            isError: true
          };
        }
        return this.formatResult(filtered, params.format);
      }

      return this.formatResult(generators, params.format);
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error listing generators: ${error.message}`
        }],
        isError: true
      };
    }
  }

  private formatResult(generators: GeneratorConfig[], format?: string) {
    switch (format) {
      case "json":
        return {
          content: [{
            type: "text",
            text: JSON.stringify(generators, null, 2)
          }]
        };
      
      case "detailed":
        return {
          content: [{
            type: "text",
            text: this.formatDetailed(generators)
          }]
        };
      
      default:
        return {
          content: [{
            type: "text",
            text: this.formatSimple(generators)
          }]
        };
    }
  }
}
```

### Generate Tool Handler (`src/mcp/tools/generate.ts`)

```typescript
export class GenerateToolHandler implements ToolHandler {
  private securityManager: SecurityManager;

  constructor() {
    this.securityManager = new SecurityManager();
  }

  async execute(params: GenerateParams): Promise<ToolResult> {
    try {
      // Validate destination path
      if (params.dest) {
        const pathCheck = this.securityManager.validateFilePath(params.dest);
        if (!pathCheck.valid) {
          return {
            content: [{
              type: "text",
              text: `Security error: ${pathCheck.reason}`
            }],
            isError: true
          };
        }
      }

      const generator = new Generator();
      const result = await generator.generate({
        generator: params.generator,
        template: params.template,
        dest: params.dest || ".",
        force: params.force || false,
        dry: params.dry || false,
        variables: params.variables || {}
      });

      return {
        content: [{
          type: "text",
          text: this.formatGenerateResult(result, params.dry)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Generation failed: ${error.message}`
        }],
        isError: true
      };
    }
  }
}
```

## Error Handling Strategy

### 1. Validation Errors
- Schema validation failures
- Parameter type mismatches  
- Missing required parameters

### 2. Security Errors
- Path traversal attempts
- System directory access
- File size limit violations

### 3. Template Errors
- Generator/template not found
- Variable parsing failures
- Template rendering errors

### 4. File System Errors
- Permission denied
- Disk space issues
- Race conditions

## Performance Optimizations

### 1. Caching Strategy
```typescript
interface CacheConfig {
  templateScan: { ttl: 300000 };     // 5 minutes
  generatorList: { ttl: 60000 };     // 1 minute
  fileSystem: { ttl: 30000 };        // 30 seconds
}
```

### 2. Batch Operations
- Template scanning
- File existence checks
- Variable extraction

### 3. Resource Limits
- Maximum concurrent operations: 10
- Template depth limit: 10
- File size limit: 100MB
- Operation timeout: 30 seconds

## Configuration

### MCP Server Configuration (`mcp-server.json`)

```json
{
  "name": "unjucks",
  "version": "1.0.0",
  "description": "Unjucks template generation server",
  "transport": {
    "type": "stdio"
  },
  "capabilities": {
    "tools": true,
    "resources": false,
    "prompts": false
  },
  "security": {
    "maxFileSize": 104857600,
    "allowedPaths": ["./", "../"],
    "blockedPaths": ["/etc", "/root", "/sys"],
    "maxConcurrentOps": 10
  },
  "cache": {
    "enabled": true,
    "templateScan": 300000,
    "generatorList": 60000,
    "fileSystem": 30000
  }
}
```

### Integration with Existing Unjucks

The MCP server integrates with existing Unjucks components:

1. **Generator**: Core template processing
2. **FileInjector**: File modification operations  
3. **TemplateScanner**: Variable extraction
4. **ArgumentParser**: Parameter handling
5. **PerformanceMonitor**: Metrics collection

## Deployment and Usage

### 1. Installation
```bash
# Install MCP server capability
npm install @unjucks/mcp-server

# Or build from source
npm run build:mcp
```

### 2. Claude Integration
```json
{
  "mcpServers": {
    "unjucks": {
      "command": "npx",
      "args": ["unjucks", "mcp-server"]
    }
  }
}
```

### 3. Usage Examples
```typescript
// Claude can now use these tools
await unjucks_list({ format: "detailed" });
await unjucks_generate({
  generator: "component",
  template: "react",
  variables: { name: "UserProfile" },
  dest: "./src/components"
});
```

## Future Enhancements

### Phase 2 Tools
- `unjucks_migrate`: Hygen to Unjucks migration
- `unjucks_validate`: Template validation  
- `unjucks_init`: Project initialization
- `unjucks_config`: Configuration management

### Advanced Features
- Template marketplace integration
- AI-assisted template generation
- Real-time template editing
- Collaborative template development

## Conclusion

This architecture provides a robust, secure, and scalable foundation for MCP integration with Unjucks. The 80/20 focus ensures immediate value while maintaining extensibility for future enhancements.

The design leverages existing Unjucks capabilities while adding the necessary abstractions for MCP protocol compliance, security, and error handling.