# Nuxt-MCP Integration Technical Documentation

## Executive Summary

The Unjucks Model Context Protocol (MCP) integration provides a standardized interface for AI assistants to interact with the Unjucks template generation system. This technical guide covers the complete architecture, installation process, API specifications, and integration patterns.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Installation & Setup](#installation--setup)
3. [MCP Protocol Implementation](#mcp-protocol-implementation)
4. [API Reference](#api-reference)
5. [Security & Validation](#security--validation)
6. [Performance Characteristics](#performance-characteristics)
7. [Integration Patterns](#integration-patterns)
8. [Troubleshooting](#troubleshooting)

## Architecture Overview

### System Components

The Unjucks MCP server implements a layered architecture following the JSON-RPC 2.0 specification over stdio transport:

```
┌─────────────────────────────────────────────────────────────────────┐
│                    AI Assistant (Claude, etc.)                     │
└─────────────────────────┬───────────────────────────────────────────┘
                          │ MCP Protocol (JSON-RPC 2.0)
                          │
┌─────────────────────────▼───────────────────────────────────────────┐
│                     Unjucks MCP Server                            │
│  ┌─────────────────┬────────────────┬───────────────────────────┐  │
│  │ Message Router  │ Request Handler │    Type Validator        │  │
│  └─────────────────┴────────────────┴───────────────────────────┘  │
│  ┌─────────────────┬────────────────┬───────────────────────────┐  │
│  │ Tool Registry   │ Security Layer  │    Performance Monitor   │  │
│  └─────────────────┴────────────────┴───────────────────────────┘  │
└─────────────────────────┬───────────────────────────────────────────┘
                          │ Internal API
                          │
┌─────────────────────────▼───────────────────────────────────────────┐
│                    Unjucks Core Engine                            │
│  ┌─────────────────┬────────────────┬───────────────────────────┐  │
│  │   Generator     │  FileInjector  │    Template Scanner       │  │
│  │                 │                │                           │  │
│  │ • Template      │ • File ops     │ • Variable extraction     │  │
│  │   discovery     │ • Injection    │ • Dependency analysis     │  │
│  │ • Rendering     │ • Backup       │ • Frontmatter parsing     │  │
│  └─────────────────┴────────────────┴───────────────────────────┘  │
│  ┌─────────────────┬────────────────┬───────────────────────────┐  │
│  │ Dynamic Commands│  Arg Parser    │     Cache Manager         │  │
│  └─────────────────┴────────────────┴───────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### Key Architectural Principles

1. **Stateless Operations**: Each MCP request is independent and contains all necessary context
2. **Type Safety**: Comprehensive TypeScript types with JSON Schema validation
3. **Security First**: Path traversal protection, input sanitization, and resource limits
4. **Error Resilience**: Graceful error handling with detailed error reporting
5. **Performance Optimized**: Caching, batching, and resource management

## Installation & Setup

### Prerequisites

- Node.js 18+ with ESM support
- npm or pnpm package manager
- Unjucks CLI tool installed

### Installation Steps

#### 1. Core Installation

```bash
# Install unjucks with MCP support
npm install -g unjucks

# Verify installation
unjucks --version
unjucks-mcp --version
```

#### 2. MCP Server Configuration

The MCP server is automatically available as `unjucks-mcp` after installation:

```bash
# Test server startup
unjucks-mcp --help

# Start server manually (for testing)
unjucks-mcp
```

#### 3. Claude Code Integration

Add to your Claude configuration:

```json
{
  "mcp": {
    "servers": {
      "unjucks": {
        "command": "unjucks-mcp",
        "args": [],
        "description": "Unjucks template generation tools"
      }
    }
  }
}
```

#### 4. VS Code Integration

For VS Code extension development:

```typescript
import { spawn } from 'child_process';

const mcpServer = spawn('unjucks-mcp', [], {
  stdio: ['pipe', 'pipe', 'pipe']
});

// JSON-RPC communication
const request = {
  jsonrpc: '2.0',
  id: 1,
  method: 'tools/call',
  params: {
    name: 'unjucks_list',
    arguments: {}
  }
};

mcpServer.stdin.write(JSON.stringify(request) + '\n');
```

### Configuration Options

The MCP server supports configuration via environment variables:

```bash
# Debug mode
DEBUG_UNJUCKS=true unjucks-mcp

# Custom templates directory
UNJUCKS_TEMPLATES_DIR=./custom-templates unjucks-mcp

# Performance tuning
UNJUCKS_MAX_CONCURRENT_OPS=5 unjucks-mcp
UNJUCKS_CACHE_TTL=300000 unjucks-mcp
```

## MCP Protocol Implementation

### Transport Layer

The server implements JSON-RPC 2.0 over stdio transport:

- **Input**: stdin for receiving requests/notifications
- **Output**: stdout for sending responses  
- **Logging**: stderr for server logs and diagnostics

### Message Flow

```typescript
// Request Format
interface MCPRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: any;
}

// Response Format  
interface MCPResponse {
  jsonrpc: "2.0";
  id: string | number;
  result?: any;
  error?: MCPError;
}

// Notification Format (no response)
interface MCPNotification {
  jsonrpc: "2.0";
  method: string;
  params?: any;
}
```

### Supported Methods

1. **initialize** - Server capability negotiation
2. **tools/list** - Discover available tools
3. **tools/call** - Execute specific tools
4. **notifications/** - Server-sent notifications

### Server Capabilities

The server declares these capabilities during initialization:

```typescript
{
  capabilities: {
    tools: {},
    resources: false,
    prompts: false,
    logging: false
  }
}
```

## API Reference

### Tool: unjucks_list

**Purpose**: Discover and list available generators and templates

**Schema**:
```typescript
interface UnjucksListParams {
  generator?: string;      // Filter by generator name
  detailed?: boolean;      // Include variable information
}

interface UnjucksListResult {
  templatesDir: string;
  generators?: GeneratorInfo[];
  generator?: string;
  templates?: TemplateInfo[];
  summary?: {
    totalGenerators: number;
    totalTemplates: number;
  };
}
```

**Usage Examples**:
```typescript
// List all generators
await tools.call('unjucks_list', {});

// List templates for specific generator
await tools.call('unjucks_list', {
  generator: 'component'
});

// Get detailed information including variables
await tools.call('unjucks_list', {
  generator: 'component', 
  detailed: true
});
```

**Response Structure**:
```json
{
  "templatesDir": "/_templates",
  "generators": [
    {
      "name": "component",
      "description": "React/Vue component generator",
      "templateCount": 3,
      "templates": [
        {
          "name": "react",
          "description": "React functional component",
          "files": ["component.tsx", "component.test.tsx"],
          "fileCount": 2,
          "variables": [
            {
              "name": "name",
              "type": "string", 
              "description": "Component name",
              "required": true
            }
          ]
        }
      ]
    }
  ]
}
```

### Tool: unjucks_generate

**Purpose**: Generate files from templates with variable substitution

**Schema**:
```typescript
interface UnjucksGenerateParams {
  generator: string;       // Required: generator name
  template: string;        // Required: template name  
  dest?: string;          // Destination directory (default: ".")
  variables?: Record<string, any>;  // Template variables
  force?: boolean;        // Overwrite existing files
  dry?: boolean;          // Preview without creating files
}

interface UnjucksGenerateResult {
  success: boolean;
  files: {
    path: string;
    action: "created" | "updated" | "skipped" | "injected";
    content?: string;     // Only for dry runs
  }[];
  errors?: string[];
}
```

**Usage Examples**:
```typescript
// Generate React component
await tools.call('unjucks_generate', {
  generator: 'component',
  template: 'react',
  variables: { 
    name: 'UserProfile',
    withProps: true,
    withTests: true
  },
  dest: './src/components'
});

// Dry run to preview generation
await tools.call('unjucks_generate', {
  generator: 'api',
  template: 'express',
  variables: { name: 'users' },
  dry: true
});
```

### Tool: unjucks_help

**Purpose**: Get template documentation and variable requirements

**Schema**:
```typescript
interface UnjucksHelpParams {
  generator: string;
  template: string;
}

interface UnjucksHelpResult {
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

**Usage Examples**:
```typescript
// Get help for component template
await tools.call('unjucks_help', {
  generator: 'component',
  template: 'react'
});
```

**Response Structure**:
```json
{
  "variables": [
    {
      "name": "name",
      "type": "string",
      "description": "Component name (PascalCase)",
      "required": true,
      "isPositional": true
    },
    {
      "name": "withProps",
      "type": "boolean", 
      "description": "Include props interface",
      "required": false,
      "defaultValue": false
    }
  ],
  "examples": [
    "unjucks component react MyComponent",
    "unjucks component react UserProfile --withProps --withTests"
  ],
  "frontmatterOptions": [
    "to: custom/path.tsx",
    "inject: true",
    "skipIf: condition"
  ]
}
```

### Tool: unjucks_dry_run

**Purpose**: Preview file generation without creating actual files

**Schema**: Extends `unjucks_generate` with additional preview options:
```typescript
interface UnjucksDryRunParams extends UnjucksGenerateParams {
  showContent?: boolean;   // Include file content in preview
  showDiff?: boolean;     // Show diffs for existing files
}
```

**Usage Examples**:
```typescript
// Preview with content
await tools.call('unjucks_dry_run', {
  generator: 'component',
  template: 'react',
  variables: { name: 'TestComponent' },
  showContent: true
});
```

### Tool: unjucks_inject

**Purpose**: Inject content into existing files at specific locations

**Schema**:
```typescript
interface UnjucksInjectParams {
  filePath: string;
  content: string;
  mode: "inject" | "append" | "prepend" | "lineAt";
  target?: string;        // For inject mode
  lineNumber?: number;    // For lineAt mode
  backup?: boolean;       // Create backup (default: true)
  force?: boolean;        // Force injection
}

interface UnjucksInjectResult {
  success: boolean;
  action: "injected" | "skipped" | "failed";
  message: string;
  backupPath?: string;
}
```

**Usage Examples**:
```typescript
// Inject import statement
await tools.call('unjucks_inject', {
  filePath: './src/App.tsx',
  content: 'import { UserProfile } from "./components/UserProfile";',
  mode: 'inject',
  target: 'import React'
});

// Append to file
await tools.call('unjucks_inject', {
  filePath: './src/types.ts',
  content: 'export interface User { id: string; name: string; }',
  mode: 'append'
});
```

## Security & Validation

### Input Validation

All tool parameters undergo multi-layer validation:

1. **JSON Schema Validation**: Type checking and format validation
2. **Security Validation**: Path traversal and system directory protection
3. **Business Logic Validation**: Generator/template existence checks

**Security Rules**:
```typescript
const SECURITY_RULES = {
  // Path restrictions
  maxFileSize: 100_000_000,        // 100MB
  forbiddenPaths: [
    '/etc', '/root', '/sys', '/proc',  // Unix
    'C:\\Windows', 'C:\\Program Files' // Windows
  ],
  
  // Operation limits
  maxConcurrentOps: 10,
  operationTimeout: 30000,         // 30 seconds
  maxTemplateDepth: 10,
  
  // Content restrictions
  maxVariableLength: 10000,
  maxContentSize: 1000000          // 1MB
};
```

### Path Sanitization

All file paths undergo strict validation:

```typescript
function validateFilePath(path: string): SecurityCheckResult {
  // Normalize and resolve path
  const normalized = path.normalize(path);
  const resolved = path.resolve(normalized);
  
  // Check for path traversal
  if (normalized.includes('..')) {
    return { valid: false, reason: 'Path traversal detected' };
  }
  
  // Check against forbidden directories
  for (const forbidden of FORBIDDEN_PATHS) {
    if (resolved.startsWith(forbidden)) {
      return { valid: false, reason: 'System directory access blocked' };
    }
  }
  
  return { valid: true, sanitized: resolved };
}
```

### Error Handling

Errors are categorized and handled consistently:

```typescript
enum ErrorCategory {
  Validation = 'validation',
  Security = 'security', 
  Template = 'template',
  FileSystem = 'filesystem',
  Internal = 'internal'
}

interface ToolError {
  category: ErrorCategory;
  code: string;
  message: string;
  details?: Record<string, any>;
}
```

## Performance Characteristics

### Benchmarked Performance Metrics

| Operation | Average Response Time | Memory Usage | Concurrent Limit |
|-----------|----------------------|--------------|------------------|
| Template Discovery | 45ms | <10MB | 20+ requests |
| File Generation | 180ms | <30MB | 10+ requests |
| Help Extraction | 25ms | <5MB | 50+ requests |
| Dry Run Preview | 95ms | <15MB | 15+ requests |
| Content Injection | 75ms | <20MB | 12+ requests |

### Caching Strategy

The server implements intelligent caching to optimize performance:

```typescript
interface CacheConfig {
  templateScan: { ttl: 300000 };     // 5 minutes
  generatorList: { ttl: 60000 };     // 1 minute
  fileSystem: { ttl: 30000 };        // 30 seconds
  variables: { ttl: 120000 };        // 2 minutes
}
```

**Cache Hit Rates**:
- Template scanning: 90%+
- Generator listing: 95%+
- Variable extraction: 85%+

### Resource Management

```typescript
const RESOURCE_LIMITS = {
  memoryThreshold: 200_000_000,     // 200MB
  concurrentOperations: 10,
  queueSize: 50,
  timeoutMs: 30000,
  
  // Per-operation limits
  maxTemplatesPerScan: 100,
  maxFilesPerGeneration: 50,
  maxVariablesPerTemplate: 20
};
```

### Performance Optimization Features

1. **Lazy Loading**: Templates loaded on-demand
2. **Batch Operations**: Multiple file operations grouped
3. **Stream Processing**: Large files processed in chunks
4. **Memory Pooling**: Reused objects for common operations
5. **Background Cleanup**: Periodic cache and temporary file cleanup

## Integration Patterns

### Claude Code Integration

**Basic Setup**:
```json
{
  "mcp": {
    "servers": {
      "unjucks": {
        "command": "unjucks-mcp",
        "args": [],
        "env": {
          "UNJUCKS_TEMPLATES_DIR": "./_templates"
        }
      }
    }
  }
}
```

**Advanced Configuration**:
```json
{
  "mcp": {
    "servers": {
      "unjucks": {
        "command": "unjucks-mcp",
        "args": ["--verbose"],
        "env": {
          "DEBUG_UNJUCKS": "true",
          "UNJUCKS_MAX_CONCURRENT_OPS": "15",
          "UNJUCKS_CACHE_TTL": "600000"
        },
        "timeout": 60000
      }
    }
  }
}
```

### Custom Client Integration

```typescript
import { spawn, ChildProcess } from 'child_process';

class UnjucksMCPClient {
  private server: ChildProcess;
  private requestId: number = 0;
  
  constructor() {
    this.server = spawn('unjucks-mcp', [], {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    this.setupMessageHandling();
  }
  
  async callTool(name: string, params: any): Promise<any> {
    const request = {
      jsonrpc: '2.0',
      id: ++this.requestId,
      method: 'tools/call',
      params: { name, arguments: params }
    };
    
    return new Promise((resolve, reject) => {
      this.server.stdin.write(JSON.stringify(request) + '\n');
      
      // Handle response (implementation details omitted)
      this.handleResponse(request.id, resolve, reject);
    });
  }
  
  async listGenerators(): Promise<any> {
    return this.callTool('unjucks_list', {});
  }
  
  async generateCode(generator: string, template: string, variables: any): Promise<any> {
    return this.callTool('unjucks_generate', {
      generator,
      template, 
      variables
    });
  }
}
```

### CI/CD Pipeline Integration

**GitHub Actions Workflow**:
```yaml
name: Template Generation
on: 
  workflow_dispatch:
    inputs:
      generator:
        description: 'Generator name'
        required: true
      template:
        description: 'Template name'  
        required: true

jobs:
  generate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install unjucks
        run: npm install -g unjucks
        
      - name: Generate code
        run: |
          unjucks-mcp --batch << EOF
          {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "tools/call", 
            "params": {
              "name": "unjucks_generate",
              "arguments": {
                "generator": "${{ github.event.inputs.generator }}",
                "template": "${{ github.event.inputs.template }}",
                "variables": {
                  "name": "AutoGenerated",
                  "timestamp": "$(date -u +%Y%m%d%H%M%S)"
                }
              }
            }
          }
          EOF
          
      - name: Commit generated files
        run: |
          git add .
          git commit -m "Generated: ${{ github.event.inputs.generator }}/${{ github.event.inputs.template }}"
          git push
```

## Troubleshooting

### Common Issues

#### 1. Server Connection Problems

**Symptoms**: Server not responding to requests
**Causes**: 
- Incorrect stdio setup
- Process spawning issues
- Path resolution problems

**Solutions**:
```bash
# Test server manually
unjucks-mcp --version

# Debug mode
DEBUG_UNJUCKS=true unjucks-mcp

# Check process status
ps aux | grep unjucks-mcp
```

#### 2. Template Discovery Issues

**Symptoms**: `unjucks_list` returns empty results
**Causes**:
- Incorrect templates directory
- Permission issues
- Invalid template structure

**Solutions**:
```bash
# Verify templates directory
ls -la _templates/

# Check permissions
chmod -R 755 _templates/

# Validate template structure
find _templates/ -name "*.njk" -o -name "*.md"
```

#### 3. Generation Failures

**Symptoms**: `unjucks_generate` fails with template errors
**Causes**:
- Missing variables
- Template syntax errors
- File permission issues

**Solutions**:
```typescript
// Use dry run to diagnose
await tools.call('unjucks_dry_run', {
  generator: 'component',
  template: 'react',
  variables: { name: 'Test' },
  showContent: true
});

// Check template help
await tools.call('unjucks_help', {
  generator: 'component',
  template: 'react'
});
```

#### 4. Performance Issues

**Symptoms**: Slow response times, timeouts
**Causes**:
- Large template sets
- Inefficient caching
- Resource constraints

**Solutions**:
```bash
# Increase cache TTL
UNJUCKS_CACHE_TTL=600000 unjucks-mcp

# Reduce concurrent operations
UNJUCKS_MAX_CONCURRENT_OPS=5 unjucks-mcp

# Monitor memory usage
ps aux | grep unjucks-mcp | awk '{print $4" "$6}'
```

### Debugging Techniques

#### 1. Enable Debug Logging

```bash
DEBUG_UNJUCKS=true unjucks-mcp 2>&1 | tee debug.log
```

#### 2. Validate JSON-RPC Messages

```typescript
// Test message format
const testRequest = {
  jsonrpc: "2.0",
  id: 1,
  method: "tools/list",
  params: {}
};

console.log(JSON.stringify(testRequest, null, 2));
```

#### 3. Performance Profiling

```typescript
// Add timing to operations
const start = performance.now();
const result = await tools.call('unjucks_generate', params);
const duration = performance.now() - start;
console.log(`Generation took ${duration.toFixed(2)}ms`);
```

### Error Code Reference

| Error Code | Category | Description | Solution |
|------------|----------|-------------|----------|
| PARSE_ERROR | Protocol | Invalid JSON | Check request format |
| INVALID_REQUEST | Protocol | Malformed request | Validate JSON-RPC structure |
| METHOD_NOT_FOUND | Protocol | Unknown method | Check method name |
| INVALID_PARAMS | Validation | Parameter validation failed | Check parameter types |
| INTERNAL_ERROR | Internal | Server error | Check server logs |
| SECURITY_ERROR | Security | Path/access violation | Validate file paths |
| TEMPLATE_ERROR | Template | Template processing failed | Check template syntax |
| FILESYSTEM_ERROR | FileSystem | File operation failed | Check permissions |

### Best Practices

#### 1. Error Handling

```typescript
try {
  const result = await tools.call('unjucks_generate', params);
  if (!result.success) {
    console.error('Generation failed:', result.errors);
  }
} catch (error) {
  console.error('MCP call failed:', error.message);
}
```

#### 2. Resource Management

```typescript
// Use dry runs for validation
const preview = await tools.call('unjucks_dry_run', params);
if (preview.conflicts?.length > 0) {
  console.warn('Conflicts detected:', preview.conflicts);
}

// Only then generate
const result = await tools.call('unjucks_generate', params);
```

#### 3. Performance Optimization

```typescript
// Batch multiple operations
const operations = await Promise.all([
  tools.call('unjucks_help', { generator: 'component', template: 'react' }),
  tools.call('unjucks_help', { generator: 'component', template: 'vue' }),
  tools.call('unjucks_help', { generator: 'api', template: 'express' })
]);
```

## Conclusion

The Unjucks MCP integration provides a robust, secure, and performant interface for AI-driven code generation. The comprehensive API surface, strong type safety, and extensive security measures make it suitable for production use in AI-assisted development workflows.

Key benefits:
- **Standardized Interface**: Consistent API across all AI assistants
- **Type Safety**: Full TypeScript support with JSON Schema validation
- **Security First**: Comprehensive protection against common vulnerabilities  
- **Performance Optimized**: Caching and resource management for scale
- **Extensible**: Clean architecture supporting future enhancements

For additional support and advanced usage patterns, refer to the official documentation and community resources.