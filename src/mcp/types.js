/**
 * JavaScript definitions and schemas for the Unjucks MCP server
 * @fileoverview Type definitions converted to JSDoc comments
 */

// Error Codes
export const MCPErrorCode = {
  ParseError: -32700,
  InvalidRequest: -32600,
  MethodNotFound: -32601,
  InvalidParams: -32602,
  InternalError: -32603,
  ServerError: -32000,
  ApplicationError: -32001,
  ResourceNotFound: -32002,
  PermissionDenied: -32003
};

// Validation Schemas
export const TOOL_SCHEMAS = {
  unjucks_list: {
    type: "object",
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
    type: "object",
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
    type: "object",
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
    type: "object",
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
    type: "object",
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
};

// Type guards
export function isValidMCPRequest(obj) {
  return (
    obj !== null &&
    obj !== undefined &&
    typeof obj === "object" &&
    obj.jsonrpc === "2.0" &&
    (typeof obj.id === "string" || typeof obj.id === "number") &&
    typeof obj.method === "string"
  );
}

export function isValidMCPNotification(obj) {
  return (
    obj &&
    typeof obj === "object" &&
    obj.jsonrpc === "2.0" &&
    typeof obj.method === "string" &&
    !("id" in obj)
  );
}

/**
 * @typedef {Object} MCPRequest
 * @property {"2.0"} jsonrpc
 * @property {string|number} id
 * @property {string} method
 * @property {any} [params]
 */

/**
 * @typedef {Object} MCPResponse
 * @property {"2.0"} jsonrpc
 * @property {string|number} id
 * @property {any} [result]
 * @property {MCPError} [error]
 */

/**
 * @typedef {Object} MCPError
 * @property {number} code
 * @property {string} message
 * @property {any} [data]
 */

/**
 * @typedef {Object} MCPNotification
 * @property {"2.0"} jsonrpc
 * @property {string} method
 * @property {any} [params]
 */

/**
 * @typedef {Object} ServerInfo
 * @property {string} name
 * @property {string} version
 * @property {string} protocolVersion
 */

/**
 * @typedef {Object} ServerCapabilities
 * @property {ToolsCapability} [tools]
 * @property {ResourcesCapability} [resources]
 * @property {PromptsCapability} [prompts]
 * @property {LoggingCapability} [logging]
 */

/**
 * @typedef {Object} ToolsCapability
 * @property {boolean} [listChanged]
 */

/**
 * @typedef {Object} ResourcesCapability
 * @property {boolean} [subscribe]
 * @property {boolean} [listChanged]
 */

/**
 * @typedef {Object} PromptsCapability
 * @property {boolean} [listChanged]
 */

/**
 * @typedef {Object} LoggingCapability
 * @property {"error"|"warn"|"info"|"debug"} [level]
 */

/**
 * @typedef {Object} Tool
 * @property {string} name
 * @property {string} description
 * @property {Object} inputSchema
 * @property {"object"} inputSchema.type
 * @property {Record<string, any>} inputSchema.properties
 * @property {string[]} [inputSchema.required]
 */

/**
 * @typedef {Object} ToolCall
 * @property {string} name
 * @property {Record<string, any>} arguments
 */

/**
 * @typedef {Object} ToolResult
 * @property {Array<{type: "text"|"image"|"resource", text?: string, data?: string, mimeType?: string}>} content
 * @property {boolean} [isError]
 * @property {Record<string, any>} [_meta]
 */

/**
 * @typedef {Object} UnjucksGenerator
 * @property {string} name
 * @property {string} [description]
 * @property {UnjucksTemplate[]} templates
 */

/**
 * @typedef {Object} UnjucksTemplate
 * @property {string} name
 * @property {string} [description]
 * @property {string[]} files
 * @property {UnjucksVariable[]} variables
 */

/**
 * @typedef {Object} UnjucksVariable
 * @property {string} name
 * @property {"string"|"number"|"boolean"} type
 * @property {string} [description]
 * @property {any} [defaultValue]
 * @property {boolean} [required]
 */

/**
 * @typedef {Object} UnjucksGenerateParams
 * @property {string} generator
 * @property {string} template
 * @property {string} dest
 * @property {Record<string, any>} [variables]
 * @property {boolean} [force]
 * @property {boolean} [dry]
 */

/**
 * @typedef {Object} UnjucksGenerateResult
 * @property {Array<{path: string, content: string, action: "created"|"updated"|"skipped"|"injected"}>} files
 * @property {Object} summary
 * @property {number} summary.created
 * @property {number} summary.updated
 * @property {number} summary.skipped
 * @property {number} summary.injected
 */

/**
 * @typedef {Object} UnjucksListParams
 * @property {string} [generator]
 * @property {boolean} [detailed]
 */

/**
 * @typedef {Object} UnjucksHelpParams
 * @property {string} generator
 * @property {string} template
 */

/**
 * @typedef {UnjucksGenerateParams & {dry: true}} UnjucksDryRunParams
 */

/**
 * @typedef {Object} UnjucksInjectParams
 * @property {string} file
 * @property {string} content
 * @property {string} [before]
 * @property {string} [after]
 * @property {boolean} [append]
 * @property {boolean} [prepend]
 * @property {number} [lineAt]
 * @property {boolean} [force]
 * @property {boolean} [dry]
 */