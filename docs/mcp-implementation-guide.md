# MCP Server Implementation Guide

## Module Structure

```
src/
├── mcp/
│   ├── server.ts              # Main MCP server entry point
│   ├── types.ts               # MCP-specific type definitions
│   ├── config.ts              # Server configuration management
│   │
│   ├── tools/
│   │   ├── router.ts          # Tool routing and dispatch
│   │   ├── base.ts            # Base tool handler interface
│   │   ├── list.ts            # unjucks_list implementation
│   │   ├── generate.ts        # unjucks_generate implementation
│   │   ├── help.ts            # unjucks_help implementation
│   │   ├── dry-run.ts         # unjucks_dry_run implementation
│   │   └── inject.ts          # unjucks_inject implementation
│   │
│   ├── validation/
│   │   ├── validator.ts       # Request validation logic
│   │   ├── schemas.ts         # JSON schemas for tools
│   │   └── sanitizer.ts       # Input sanitization
│   │
│   ├── security/
│   │   ├── manager.ts         # Security policy enforcement
│   │   ├── path-validator.ts  # File path validation
│   │   └── rate-limiter.ts    # Request rate limiting
│   │
│   ├── adapters/
│   │   ├── generator.ts       # Generator class adapter
│   │   ├── injector.ts        # FileInjector adapter
│   │   └── scanner.ts         # TemplateScanner adapter
│   │
│   └── utils/
│       ├── cache.ts           # Caching utilities
│       ├── logger.ts          # Structured logging
│       └── metrics.ts         # Performance metrics
│
├── cli.ts                     # Add MCP server command
└── commands/
    └── mcp-server.ts          # MCP server CLI command
```

## Implementation Steps

### Phase 1: Core Infrastructure (Week 1)

#### Step 1.1: Base Types and Configuration

```typescript
// src/mcp/types.ts
export interface MCPServerConfig {
  name: string;
  version: string;
  description: string;
  security: SecurityConfig;
  cache: CacheConfig;
  limits: ResourceLimits;
}

export interface ToolHandler {
  name: string;
  execute(params: any): Promise<ToolResult>;
  validate(params: any): ValidationResult;
}

export interface ToolResult {
  content: Array<{
    type: "text" | "resource";
    text?: string;
    resource?: string;
  }>;
  isError?: boolean;
  _meta?: Record<string, any>;
}
```

#### Step 1.2: Server Bootstrap

```typescript
// src/mcp/server.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

export class UnjucksMCPServer {
  private server: Server;
  private config: MCPServerConfig;
  private toolRouter: ToolRouter;

  constructor(config?: Partial<MCPServerConfig>) {
    this.config = this.buildConfig(config);
    this.server = new Server({
      name: this.config.name,
      version: this.config.version,
      description: this.config.description
    }, {
      capabilities: { tools: {} }
    });

    this.toolRouter = new ToolRouter(this.config);
    this.setupHandlers();
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error(`Unjucks MCP Server ${this.config.version} started`);
  }
}
```

### Phase 2: Tool Implementation (Week 2)

#### Step 2.1: Base Tool Handler

```typescript
// src/mcp/tools/base.ts
export abstract class BaseToolHandler implements ToolHandler {
  protected validator: RequestValidator;
  protected securityManager: SecurityManager;
  
  constructor(
    protected name: string,
    protected schema: JSONSchema7
  ) {
    this.validator = new RequestValidator();
    this.securityManager = new SecurityManager();
  }

  abstract execute(params: any): Promise<ToolResult>;

  validate(params: any): ValidationResult {
    return this.validator.validate(this.name, params, this.schema);
  }

  protected handleError(error: Error, context?: string): ToolResult {
    const message = context ? 
      `${context}: ${error.message}` : error.message;
    
    return {
      content: [{ type: "text", text: message }],
      isError: true,
      _meta: {
        errorType: this.classifyError(error),
        errorCode: error.name || 'UnknownError',
        timestamp: new Date().toISOString()
      }
    };
  }

  private classifyError(error: Error): string {
    if (error.message.includes('not found')) return 'template';
    if (error.message.includes('security')) return 'security';
    if (error.message.includes('validation')) return 'validation';
    if (error.message.includes('permission')) return 'filesystem';
    return 'unknown';
  }
}
```

#### Step 2.2: List Tool Implementation

```typescript
// src/mcp/tools/list.ts
export class ListToolHandler extends BaseToolHandler {
  private generatorAdapter: GeneratorAdapter;

  constructor() {
    super('unjucks_list', LIST_SCHEMA);
    this.generatorAdapter = new GeneratorAdapter();
  }

  async execute(params: ListParams): Promise<ToolResult> {
    try {
      const validation = this.validate(params);
      if (!validation.valid) {
        return {
          content: [{ type: "text", text: validation.errors.join(', ') }],
          isError: true
        };
      }

      const generators = await this.generatorAdapter.listForMCP(params);
      return this.formatOutput(generators, params.format);

    } catch (error) {
      return this.handleError(error, 'Generator listing failed');
    }
  }

  private formatOutput(generators: GeneratorConfig[], format?: string) {
    switch (format) {
      case 'json':
        return {
          content: [{ 
            type: "text", 
            text: JSON.stringify(generators, null, 2) 
          }]
        };

      case 'detailed':
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

### Phase 3: Security and Validation (Week 3)

#### Step 3.1: Security Manager

```typescript
// src/mcp/security/manager.ts
export class SecurityManager {
  private pathValidator: PathValidator;
  private rateLimiter: RateLimiter;

  constructor(config: SecurityConfig) {
    this.pathValidator = new PathValidator(config.pathRules);
    this.rateLimiter = new RateLimiter(config.rateLimits);
  }

  async validateRequest(request: any): Promise<SecurityCheckResult> {
    // Rate limiting
    const rateLimitResult = await this.rateLimiter.checkLimit();
    if (!rateLimitResult.allowed) {
      return {
        valid: false,
        reason: 'Rate limit exceeded',
        retryAfter: rateLimitResult.retryAfter
      };
    }

    // Path validation for file operations
    if (request.params?.filePath || request.params?.dest) {
      const pathResult = this.pathValidator.validate(
        request.params.filePath || request.params.dest
      );
      if (!pathResult.valid) {
        return pathResult;
      }
    }

    return { valid: true };
  }
}
```

#### Step 3.2: Request Validator

```typescript
// src/mcp/validation/validator.ts
export class RequestValidator {
  private ajv: Ajv;
  private schemas: Map<string, ValidateFunction>;

  constructor() {
    this.ajv = new Ajv({ 
      allErrors: true,
      strict: false,
      removeAdditional: true
    });
    this.schemas = new Map();
    this.loadSchemas();
  }

  validate(toolName: string, params: any): ValidationResult {
    const validator = this.schemas.get(toolName);
    if (!validator) {
      return {
        valid: false,
        errors: [`Unknown tool: ${toolName}`]
      };
    }

    const valid = validator(params);
    if (!valid) {
      return {
        valid: false,
        errors: this.formatErrors(validator.errors || [])
      };
    }

    return { valid: true };
  }

  private formatErrors(errors: ErrorObject[]): string[] {
    return errors.map(error => {
      const path = error.instancePath || 'root';
      return `${path}: ${error.message}`;
    });
  }
}
```

### Phase 4: Adapter Layer (Week 4)

#### Step 4.1: Generator Adapter

```typescript
// src/mcp/adapters/generator.ts
export class GeneratorAdapter {
  private generator: Generator;
  private cache: Cache;

  constructor() {
    this.generator = new Generator();
    this.cache = new Cache({ ttl: 300000 }); // 5 minutes
  }

  async listForMCP(params: ListParams): Promise<GeneratorConfig[]> {
    const cacheKey = `list:${JSON.stringify(params)}`;
    
    return this.cache.get(cacheKey, async () => {
      let generators = await this.generator.listGenerators();

      if (params.generator) {
        generators = generators.filter(g => g.name === params.generator);
      }

      if (!params.showHidden) {
        generators = generators.filter(g => !g.name.startsWith('.'));
      }

      return generators;
    });
  }

  async generateForMCP(params: MCPGenerateParams): Promise<MCPGenerateResult> {
    try {
      const result = await this.generator.generate({
        generator: params.generator,
        template: params.template,
        dest: params.dest || ".",
        force: params.force || false,
        dry: params.dry || false,
        variables: params.variables || {}
      });

      return {
        success: true,
        files: result.files.map(f => ({
          path: f.path,
          action: this.determineAction(f),
          content: params.dry ? f.content : undefined
        }))
      };

    } catch (error) {
      return {
        success: false,
        files: [],
        errors: [error.message]
      };
    }
  }

  private determineAction(file: TemplateFile): string {
    if (file.injectionResult?.skipped) return "skipped";
    if (file.injectionResult?.success) {
      if (file.frontmatter?.inject) return "injected";
      if (file.frontmatter?.append || file.frontmatter?.prepend) return "updated";
      return "created";
    }
    return "failed";
  }
}
```

### Phase 5: CLI Integration (Week 5)

#### Step 5.1: MCP Server Command

```typescript
// src/commands/mcp-server.ts
export const mcpServerCommand = defineCommand({
  meta: {
    name: "mcp-server",
    description: "Start the Unjucks MCP server for AI assistant integration"
  },
  args: {
    config: {
      type: "string",
      description: "Path to MCP server configuration file",
      alias: "c"
    },
    debug: {
      type: "boolean", 
      description: "Enable debug logging",
      default: false
    },
    templatesDir: {
      type: "string",
      description: "Override templates directory",
      alias: "t"
    }
  },
  async run({ args }) {
    try {
      // Load configuration
      const config = await loadMCPConfig(args.config);
      
      if (args.templatesDir) {
        config.templatesDir = args.templatesDir;
      }

      if (args.debug) {
        config.logging.level = 'debug';
      }

      // Start MCP server
      const server = new UnjucksMCPServer(config);
      
      // Graceful shutdown handling
      process.on('SIGINT', async () => {
        await server.shutdown();
        process.exit(0);
      });

      await server.start();

    } catch (error) {
      console.error(chalk.red('Failed to start MCP server:'), error);
      process.exit(1);
    }
  }
});
```

#### Step 5.2: CLI Integration

```typescript
// src/cli.ts - Add to subCommands
export const main = defineCommand({
  // ... existing configuration ...
  subCommands: {
    generate: createDynamicGenerateCommand(),
    list: listCommand,
    init: initCommand,
    version: versionCommand, 
    help: createTemplateHelpCommand(),
    "mcp-server": mcpServerCommand,  // Add MCP server command
  },
  // ... rest of configuration ...
});
```

## Testing Strategy

### Unit Tests
```typescript
// tests/mcp/tools/list.test.ts
describe('ListToolHandler', () => {
  let handler: ListToolHandler;

  beforeEach(() => {
    handler = new ListToolHandler();
  });

  it('should list all generators', async () => {
    const result = await handler.execute({});
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain('Available generators:');
  });

  it('should filter by generator name', async () => {
    const result = await handler.execute({ generator: 'component' });
    expect(result.content[0].text).toContain('component');
  });

  it('should handle invalid parameters', async () => {
    const result = await handler.execute({ format: 'invalid' });
    expect(result.isError).toBe(true);
  });
});
```

### Integration Tests
```typescript
// tests/mcp/integration.test.ts
describe('MCP Server Integration', () => {
  let server: UnjucksMCPServer;

  beforeEach(async () => {
    server = new UnjucksMCPServer({
      templatesDir: './tests/fixtures/templates'
    });
  });

  it('should handle complete generation workflow', async () => {
    // List generators
    const listResult = await server.callTool('unjucks_list', {});
    expect(listResult.isError).toBe(false);

    // Generate from template
    const generateResult = await server.callTool('unjucks_generate', {
      generator: 'component',
      template: 'react',
      variables: { name: 'TestComponent' },
      dry: true
    });
    
    expect(generateResult.isError).toBe(false);
    expect(generateResult.content[0].text).toContain('TestComponent');
  });
});
```

## Performance Benchmarks

### Target Metrics
- Tool response time: < 100ms (95th percentile)
- Memory usage: < 50MB baseline
- Concurrent requests: 10+ without degradation
- Template scanning: < 500ms for 100 templates

### Monitoring
```typescript
// src/mcp/utils/metrics.ts
export class MetricsCollector {
  private metrics: Map<string, Metric[]> = new Map();

  recordToolExecution(toolName: string, duration: number, success: boolean) {
    const metric: Metric = {
      timestamp: Date.now(),
      duration,
      success,
      toolName
    };

    const toolMetrics = this.metrics.get(toolName) || [];
    toolMetrics.push(metric);
    this.metrics.set(toolName, toolMetrics.slice(-100)); // Keep last 100
  }

  getStats(toolName: string): ToolStats {
    const metrics = this.metrics.get(toolName) || [];
    const durations = metrics.map(m => m.duration);
    
    return {
      totalCalls: metrics.length,
      successRate: metrics.filter(m => m.success).length / metrics.length,
      avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
      p95Duration: this.percentile(durations, 95),
      p99Duration: this.percentile(durations, 99)
    };
  }
}
```

## Configuration Management

### Default Configuration
```typescript
// src/mcp/config.ts
export const DEFAULT_MCP_CONFIG: MCPServerConfig = {
  name: "unjucks",
  version: "1.0.0", 
  description: "Unjucks template generation MCP server",
  security: {
    maxFileSize: 100_000_000,
    allowedPaths: ["./", "../"],
    blockedPaths: ["/etc", "/root", "/sys", "/proc"],
    maxConcurrentOps: 10,
    rateLimiting: {
      windowMs: 60_000,
      maxRequests: 100
    }
  },
  cache: {
    enabled: true,
    templateScan: 300_000,
    generatorList: 60_000,
    fileSystem: 30_000
  },
  limits: {
    maxTemplateDepth: 10,
    operationTimeout: 30_000,
    maxVariables: 100,
    maxFileCount: 1000
  }
};
```

This implementation guide provides a comprehensive roadmap for building the MCP server integration with Unjucks, following clean architecture principles and ensuring robust security, performance, and maintainability.