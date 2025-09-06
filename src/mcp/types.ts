/**
 * TypeScript definitions and schemas for the Unjucks MCP server
 */

// MCP Protocol Types
export interface MCPRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: any;
}

export interface MCPResponse {
  jsonrpc: "2.0";
  id: string | number;
  result?: any;
  error?: MCPError;
}

export interface MCPError {
  code: number;
  message: string;
  data?: any;
}

export interface MCPNotification {
  jsonrpc: "2.0";
  method: string;
  params?: any;
}

// MCP Server Metadata
export interface ServerInfo {
  name: string;
  version: string;
  protocolVersion: string;
}

export interface ServerCapabilities {
  tools?: ToolsCapability;
  resources?: ResourcesCapability;
  prompts?: PromptsCapability;
  logging?: LoggingCapability;
}

export interface ToolsCapability {
  listChanged?: boolean;
}

export interface ResourcesCapability {
  subscribe?: boolean;
  listChanged?: boolean;
}

export interface PromptsCapability {
  listChanged?: boolean;
}

export interface LoggingCapability {
  level?: "error" | "warn" | "info" | "debug";
}

// Tool Definitions
export interface Tool {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface ToolCall {
  name: string;
  arguments: Record<string, any>;
}

export interface ToolResult {
  content: Array<{
    type: "text" | "image" | "resource";
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
  _meta?: Record<string, any>;
}

// Unjucks-specific Types
export interface UnjucksGenerator {
  name: string;
  description?: string;
  templates: UnjucksTemplate[];
}

export interface UnjucksTemplate {
  name: string;
  description?: string;
  files: string[];
  variables: UnjucksVariable[];
}

export interface UnjucksVariable {
  name: string;
  type: "string" | "number" | "boolean";
  description?: string;
  defaultValue?: any;
  required?: boolean;
}

export interface UnjucksGenerateParams {
  generator: string;
  template: string;
  dest: string;
  variables?: Record<string, any>;
  force?: boolean;
  dry?: boolean;
}

export interface UnjucksGenerateResult {
  files: Array<{
    path: string;
    content: string;
    action: "created" | "updated" | "skipped" | "injected";
  }>;
  summary: {
    created: number;
    updated: number;
    skipped: number;
    injected: number;
  };
}

export interface UnjucksListParams {
  generator?: string;
  detailed?: boolean;
}

export interface UnjucksHelpParams {
  generator: string;
  template: string;
}

export interface UnjucksDryRunParams extends UnjucksGenerateParams {
  dry: true;
}

export interface UnjucksInjectParams {
  file: string;
  content: string;
  before?: string;
  after?: string;
  append?: boolean;
  prepend?: boolean;
  lineAt?: number;
  force?: boolean;
  dry?: boolean;
}

// Error Codes
export enum MCPErrorCode {
  ParseError = -32700,
  InvalidRequest = -32600,
  MethodNotFound = -32601,
  InvalidParams = -32602,
  InternalError = -32603,
  ServerError = -32000,
  ApplicationError = -32001,
  ResourceNotFound = -32002,
  PermissionDenied = -32003,
}

// Validation Schemas
export const TOOL_SCHEMAS = {
  unjucks_list: {
    type: "object" as const,
    properties: {
      generator: {
        type: "string",
        description: "Specific generator to list templates for (optional)"
      },
      detailed: {
        type: "boolean",
        description: "Include detailed information about templates",
        default: false
      }
    },
    additionalProperties: false
  },

  unjucks_generate: {
    type: "object" as const,
    properties: {
      generator: {
        type: "string",
        description: "Name of the generator to use"
      },
      template: {
        type: "string", 
        description: "Name of the template within the generator"
      },
      dest: {
        type: "string",
        description: "Destination directory for generated files"
      },
      variables: {
        type: "object",
        description: "Template variables as key-value pairs",
        additionalProperties: true
      },
      force: {
        type: "boolean",
        description: "Force overwrite existing files",
        default: false
      },
      dry: {
        type: "boolean", 
        description: "Dry run - show what would be generated without writing files",
        default: false
      }
    },
    required: ["generator", "template", "dest"],
    additionalProperties: false
  },

  unjucks_help: {
    type: "object" as const,
    properties: {
      generator: {
        type: "string",
        description: "Name of the generator"
      },
      template: {
        type: "string",
        description: "Name of the template within the generator" 
      }
    },
    required: ["generator", "template"],
    additionalProperties: false
  },

  unjucks_dry_run: {
    type: "object" as const,
    properties: {
      generator: {
        type: "string",
        description: "Name of the generator to use"
      },
      template: {
        type: "string",
        description: "Name of the template within the generator"
      },
      dest: {
        type: "string", 
        description: "Destination directory for generated files"
      },
      variables: {
        type: "object",
        description: "Template variables as key-value pairs",
        additionalProperties: true
      }
    },
    required: ["generator", "template", "dest"],
    additionalProperties: false
  },

  unjucks_inject: {
    type: "object" as const,
    properties: {
      file: {
        type: "string",
        description: "Target file to inject content into"
      },
      content: {
        type: "string",
        description: "Content to inject"
      },
      before: {
        type: "string",
        description: "Inject content before this pattern/string"
      },
      after: {
        type: "string",
        description: "Inject content after this pattern/string"
      },
      append: {
        type: "boolean",
        description: "Append content to end of file"
      },
      prepend: {
        type: "boolean",
        description: "Prepend content to beginning of file"
      },
      lineAt: {
        type: "number",
        description: "Inject content at specific line number"
      },
      force: {
        type: "boolean",
        description: "Force injection even if target patterns not found",
        default: false
      },
      dry: {
        type: "boolean",
        description: "Dry run - show what would be injected without modifying files",
        default: false
      }
    },
    required: ["file", "content"],
    additionalProperties: false
  }
} as const;

// Type guards
export function isValidMCPRequest(obj: any): obj is MCPRequest {
  return (
    obj &&
    typeof obj === "object" &&
    obj.jsonrpc === "2.0" &&
    (typeof obj.id === "string" || typeof obj.id === "number") &&
    typeof obj.method === "string"
  );
}

export function isValidMCPNotification(obj: any): obj is MCPNotification {
  return (
    obj &&
    typeof obj === "object" &&
    obj.jsonrpc === "2.0" &&
    typeof obj.method === "string" &&
    !("id" in obj)
  );
}

// Utility types for better type inference
export type ToolName = keyof typeof TOOL_SCHEMAS;
export type ToolParams<T extends ToolName> = T extends keyof typeof TOOL_SCHEMAS 
  ? typeof TOOL_SCHEMAS[T] extends { properties: infer P }
    ? { [K in keyof P]: any }
    : never
  : never;