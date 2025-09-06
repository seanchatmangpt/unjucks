# MCP API Specifications for Unjucks

## OpenAPI 3.0 Specification

This document provides the complete OpenAPI specification for the Unjucks MCP server tools.

```yaml
openapi: 3.0.0
info:
  title: Unjucks MCP API
  version: 1.0.0
  description: |
    Model Context Protocol API for Unjucks template generation system.
    Provides standardized tools for AI assistants to generate code from templates.
  contact:
    name: Unjucks Team
    url: https://github.com/unjs/unjucks
  license:
    name: MIT
    url: https://opensource.org/licenses/MIT

servers:
  - url: stdio://unjucks-mcp
    description: MCP Server via stdio transport

paths:
  /tools/list:
    post:
      summary: List Available Tools
      description: Retrieve all available MCP tools provided by the Unjucks server
      operationId: listTools
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/MCPRequest'
            example:
              jsonrpc: "2.0"
              id: 1
              method: "tools/list"
      responses:
        '200':
          description: List of available tools
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ToolsListResponse'
              example:
                jsonrpc: "2.0"
                id: 1
                result:
                  tools:
                    - name: unjucks_list
                      description: List available generators and templates
                      inputSchema:
                        type: object
                        properties:
                          generator:
                            type: string
                          detailed:
                            type: boolean

  /tools/call:
    post:
      summary: Call Specific Tool
      description: Execute a specific tool with provided parameters
      operationId: callTool
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/ToolCallRequest'
      responses:
        '200':
          description: Tool execution result
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ToolCallResponse'
        '400':
          description: Invalid parameters or tool not found
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/MCPError'

components:
  schemas:
    MCPRequest:
      type: object
      required:
        - jsonrpc
        - id
        - method
      properties:
        jsonrpc:
          type: string
          enum: ["2.0"]
          description: JSON-RPC version
        id:
          oneOf:
            - type: string
            - type: number
          description: Request identifier
        method:
          type: string
          description: Method to call
        params:
          type: object
          description: Method parameters

    MCPResponse:
      type: object
      required:
        - jsonrpc
        - id
      properties:
        jsonrpc:
          type: string
          enum: ["2.0"]
        id:
          oneOf:
            - type: string
            - type: number
        result:
          description: Successful result
        error:
          $ref: '#/components/schemas/MCPError'

    MCPError:
      type: object
      required:
        - code
        - message
      properties:
        code:
          type: integer
          description: Error code
        message:
          type: string
          description: Error message
        data:
          description: Additional error data

    ToolCallRequest:
      allOf:
        - $ref: '#/components/schemas/MCPRequest'
        - type: object
          properties:
            method:
              type: string
              enum: ["tools/call"]
            params:
              type: object
              required:
                - name
                - arguments
              properties:
                name:
                  type: string
                  enum:
                    - unjucks_list
                    - unjucks_generate
                    - unjucks_help
                    - unjucks_dry_run
                    - unjucks_inject
                arguments:
                  type: object

    ToolCallResponse:
      allOf:
        - $ref: '#/components/schemas/MCPResponse'
        - type: object
          properties:
            result:
              type: object
              properties:
                content:
                  type: array
                  items:
                    $ref: '#/components/schemas/ToolResultContent'
                isError:
                  type: boolean

    ToolResultContent:
      type: object
      required:
        - type
        - text
      properties:
        type:
          type: string
          enum: ["text"]
        text:
          type: string
          description: Result content as text

    ToolsListResponse:
      allOf:
        - $ref: '#/components/schemas/MCPResponse'
        - type: object
          properties:
            result:
              type: object
              properties:
                tools:
                  type: array
                  items:
                    $ref: '#/components/schemas/ToolDefinition'

    ToolDefinition:
      type: object
      required:
        - name
        - description
        - inputSchema
      properties:
        name:
          type: string
          description: Tool name
        description:
          type: string
          description: Tool description
        inputSchema:
          $ref: '#/components/schemas/JSONSchema'

    JSONSchema:
      type: object
      description: JSON Schema definition for tool parameters

    # Tool-specific schemas
    UnjucksListParams:
      type: object
      properties:
        generator:
          type: string
          pattern: "^[a-zA-Z0-9_-]+$"
          description: Filter by specific generator name
        detailed:
          type: boolean
          default: false
          description: Include detailed information including variables
      additionalProperties: false

    UnjucksGenerateParams:
      type: object
      required:
        - generator
        - template
      properties:
        generator:
          type: string
          pattern: "^[a-zA-Z0-9_-]+$"
          description: Name of the generator to use
        template:
          type: string
          pattern: "^[a-zA-Z0-9_-]+$"
          description: Name of the template within the generator
        dest:
          type: string
          default: "."
          description: Destination directory for generated files
        variables:
          type: object
          additionalProperties: true
          description: Template variables as key-value pairs
        force:
          type: boolean
          default: false
          description: Overwrite existing files without prompting
        dry:
          type: boolean
          default: false
          description: Show what would be generated without creating files
      additionalProperties: false

    UnjucksHelpParams:
      type: object
      required:
        - generator
        - template
      properties:
        generator:
          type: string
          pattern: "^[a-zA-Z0-9_-]+$"
          description: Name of the generator
        template:
          type: string
          pattern: "^[a-zA-Z0-9_-]+$"
          description: Name of the template
      additionalProperties: false

    UnjucksDryRunParams:
      allOf:
        - $ref: '#/components/schemas/UnjucksGenerateParams'
        - type: object
          properties:
            showContent:
              type: boolean
              default: false
              description: Include file content in preview
            showDiff:
              type: boolean
              default: false
              description: Show diffs for existing files

    UnjucksInjectParams:
      type: object
      required:
        - filePath
        - content
      properties:
        filePath:
          type: string
          description: Path to the file to inject content into
        content:
          type: string
          description: Content to inject into the file
        mode:
          type: string
          enum: ["inject", "append", "prepend", "lineAt"]
          default: "inject"
          description: Injection mode
        target:
          type: string
          description: Target string for inject mode (inject before/after this)
        lineNumber:
          type: integer
          minimum: 1
          description: Line number for lineAt mode (1-based)
        backup:
          type: boolean
          default: true
          description: Create backup before modification
        force:
          type: boolean
          default: false
          description: Force injection even if content already exists
      additionalProperties: false

    # Response schemas
    GeneratorInfo:
      type: object
      properties:
        name:
          type: string
        description:
          type: string
        templateCount:
          type: integer
        templates:
          type: array
          items:
            $ref: '#/components/schemas/TemplateInfo'

    TemplateInfo:
      type: object
      properties:
        name:
          type: string
        description:
          type: string
        files:
          type: array
          items:
            type: string
        fileCount:
          type: integer
        variables:
          type: array
          items:
            $ref: '#/components/schemas/VariableInfo'
        variableCount:
          type: integer

    VariableInfo:
      type: object
      properties:
        name:
          type: string
        type:
          type: string
          enum: ["string", "boolean", "number"]
        description:
          type: string
        required:
          type: boolean
        defaultValue:
          description: Default value (any type)
        isPositional:
          type: boolean

    GenerateResult:
      type: object
      properties:
        success:
          type: boolean
        files:
          type: array
          items:
            $ref: '#/components/schemas/FileOperation'
        errors:
          type: array
          items:
            type: string

    FileOperation:
      type: object
      properties:
        path:
          type: string
        action:
          type: string
          enum: ["created", "updated", "skipped", "injected"]
        content:
          type: string
          description: File content (only for dry runs)

    HelpResult:
      type: object
      properties:
        variables:
          type: array
          items:
            $ref: '#/components/schemas/VariableInfo'
        examples:
          type: array
          items:
            type: string
        frontmatterOptions:
          type: array
          items:
            type: string

    InjectResult:
      type: object
      properties:
        success:
          type: boolean
        action:
          type: string
          enum: ["injected", "skipped", "failed"]
        message:
          type: string
        backupPath:
          type: string
          description: Path to backup file (if created)
```

## JSON-RPC Error Codes

The MCP server follows JSON-RPC 2.0 error code conventions:

| Code | Name | Description |
|------|------|-------------|
| -32700 | Parse error | Invalid JSON was received |
| -32600 | Invalid Request | The JSON sent is not a valid Request object |
| -32601 | Method not found | The method does not exist |
| -32602 | Invalid params | Invalid method parameter(s) |
| -32603 | Internal error | Internal JSON-RPC error |
| -32000 | Server error | Reserved for implementation-defined server-errors |

### Custom Error Codes

| Code | Name | Description |
|------|------|-------------|
| -32001 | Security Error | Path traversal or forbidden access |
| -32002 | Template Error | Template not found or invalid |
| -32003 | Variable Error | Missing or invalid template variables |
| -32004 | File System Error | File operation failed |
| -32005 | Validation Error | Parameter validation failed |

## Tool Parameter Validation

### Security Validation Rules

```typescript
const SECURITY_RULES = {
  // Path validation
  allowedPathPatterns: [
    /^\.\/.*$/,           // Relative paths starting with ./
    /^[^\/].*$/,          // Relative paths not starting with /
  ],
  
  forbiddenPathPatterns: [
    /\.\.\//,             // Path traversal
    /^\/etc\//,           // System directories
    /^\/root\//,
    /^\/sys\//,
    /^\/proc\//,
    /^C:\\Windows\//,     // Windows system directories
    /^C:\\Program Files\//,
  ],
  
  // Content validation
  maxContentLength: 1000000,      // 1MB
  maxVariableNameLength: 100,
  maxVariableValueLength: 10000,
  maxFilePathLength: 1000,
  
  // Operation limits
  maxFilesPerOperation: 50,
  maxConcurrentOperations: 10,
  operationTimeoutMs: 30000,
};
```

### Input Sanitization

```typescript
function sanitizeInput(input: any): any {
  if (typeof input === 'string') {
    // Remove null bytes and control characters
    return input.replace(/[\x00-\x1F\x7F]/g, '');
  }
  
  if (Array.isArray(input)) {
    return input.map(sanitizeInput);
  }
  
  if (typeof input === 'object' && input !== null) {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(input)) {
      sanitized[sanitizeInput(key)] = sanitizeInput(value);
    }
    return sanitized;
  }
  
  return input;
}
```

## Example Integration Patterns

### 1. Basic Tool Usage

```typescript
// List all generators
const listRequest = {
  jsonrpc: "2.0",
  id: 1,
  method: "tools/call",
  params: {
    name: "unjucks_list",
    arguments: {}
  }
};

// Generate component
const generateRequest = {
  jsonrpc: "2.0", 
  id: 2,
  method: "tools/call",
  params: {
    name: "unjucks_generate",
    arguments: {
      generator: "component",
      template: "react",
      variables: {
        name: "UserProfile",
        withProps: true
      },
      dest: "./src/components"
    }
  }
};
```

### 2. Error Handling Pattern

```typescript
async function safeToolCall(toolName: string, args: any): Promise<any> {
  const request = {
    jsonrpc: "2.0",
    id: Date.now(),
    method: "tools/call", 
    params: {
      name: toolName,
      arguments: args
    }
  };

  try {
    const response = await sendMCPRequest(request);
    
    if (response.error) {
      throw new Error(`MCP Error ${response.error.code}: ${response.error.message}`);
    }
    
    if (response.result?.isError) {
      throw new Error(`Tool Error: ${response.result.content[0]?.text}`);
    }
    
    return response.result;
  } catch (error) {
    console.error(`Tool call failed: ${toolName}`, error);
    throw error;
  }
}
```

### 3. Batch Operations

```typescript
async function batchGenerateComponents(components: ComponentSpec[]): Promise<GenerateResult[]> {
  const requests = components.map((spec, index) => ({
    jsonrpc: "2.0",
    id: index + 1,
    method: "tools/call",
    params: {
      name: "unjucks_generate",
      arguments: {
        generator: "component",
        template: spec.template,
        variables: spec.variables,
        dest: spec.destination
      }
    }
  }));

  const responses = await Promise.all(
    requests.map(req => sendMCPRequest(req))
  );

  return responses.map(response => {
    if (response.error) {
      throw new Error(`Batch operation failed: ${response.error.message}`);
    }
    return parseGenerateResult(response.result);
  });
}
```

### 4. Validation Pipeline

```typescript
async function validateAndGenerate(
  generator: string, 
  template: string, 
  variables: Record<string, any>
): Promise<GenerateResult> {
  
  // Step 1: Get template help
  const helpResult = await safeToolCall('unjucks_help', {
    generator,
    template
  });
  
  // Step 2: Validate required variables
  const help = parseHelpResult(helpResult);
  const missingVars = help.variables
    .filter(v => v.required && !(v.name in variables))
    .map(v => v.name);
    
  if (missingVars.length > 0) {
    throw new Error(`Missing required variables: ${missingVars.join(', ')}`);
  }
  
  // Step 3: Dry run to preview
  const dryRunResult = await safeToolCall('unjucks_dry_run', {
    generator,
    template,
    variables,
    showContent: true
  });
  
  const preview = parseDryRunResult(dryRunResult);
  if (preview.conflicts && preview.conflicts.length > 0) {
    console.warn('File conflicts detected:', preview.conflicts);
  }
  
  // Step 4: Generate if validation passes
  return safeToolCall('unjucks_generate', {
    generator,
    template,
    variables
  });
}
```

## Performance Monitoring

### Request Timing

```typescript
class MCPPerformanceMonitor {
  private metrics: Map<string, number[]> = new Map();
  
  startTiming(operationId: string): string {
    const timingId = `${operationId}-${Date.now()}`;
    this.metrics.set(timingId, [performance.now()]);
    return timingId;
  }
  
  endTiming(timingId: string): number {
    const timing = this.metrics.get(timingId);
    if (!timing) return 0;
    
    const duration = performance.now() - timing[0];
    timing.push(duration);
    
    return duration;
  }
  
  getStats(operation: string): {
    avg: number;
    min: number;
    max: number;
    count: number;
  } {
    const timings = Array.from(this.metrics.entries())
      .filter(([key]) => key.startsWith(operation))
      .map(([, values]) => values[1])
      .filter(v => v !== undefined);
      
    if (timings.length === 0) {
      return { avg: 0, min: 0, max: 0, count: 0 };
    }
    
    return {
      avg: timings.reduce((a, b) => a + b, 0) / timings.length,
      min: Math.min(...timings),
      max: Math.max(...timings),
      count: timings.length
    };
  }
}
```

### Memory Usage Tracking

```typescript
class MCPMemoryMonitor {
  private baseline = process.memoryUsage();
  
  getMemoryDelta(): NodeJS.MemoryUsage {
    const current = process.memoryUsage();
    return {
      rss: current.rss - this.baseline.rss,
      heapTotal: current.heapTotal - this.baseline.heapTotal,
      heapUsed: current.heapUsed - this.baseline.heapUsed,
      external: current.external - this.baseline.external,
      arrayBuffers: current.arrayBuffers - this.baseline.arrayBuffers
    };
  }
  
  formatMemoryUsage(usage: NodeJS.MemoryUsage): string {
    return Object.entries(usage)
      .map(([key, value]) => `${key}: ${(value / 1024 / 1024).toFixed(2)}MB`)
      .join(', ');
  }
}
```

This comprehensive API specification provides all the technical details needed for implementing robust integrations with the Unjucks MCP server.