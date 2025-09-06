/**
 * Request handler for MCP protocol messages
 */

import type {
  MCPRequest,
  MCPResponse,
  MCPNotification,
  MCPError,
  MCPErrorCode,
  Tool,
  ToolCall,
  ToolResult,
  ServerInfo,
  ServerCapabilities
} from '../types.js';
import {
  createMCPError,
  createMCPResponse,
  createTextToolResult,
  validateRequiredParams,
  validateObjectSchema,
  handleToolError,
  withTimeout
} from '../utils.js';
import { TOOL_IMPLEMENTATIONS } from '../tools/index.js';
import { TOOL_SCHEMAS } from '../types.js';

/**
 * Main request handler for MCP protocol
 */
export class MCPRequestHandler {
  private serverInfo: ServerInfo;
  private capabilities: ServerCapabilities;

  constructor() {
    this.serverInfo = {
      name: "unjucks-mcp-server",
      version: "1.0.0",
      protocolVersion: "2024-11-05"
    };

    this.capabilities = {
      tools: {
        listChanged: true
      },
      logging: {
        level: "info"
      }
    };
  }

  /**
   * Handle incoming MCP requests
   */
  async handleRequest(request: MCPRequest): Promise<MCPResponse> {
    try {
      // Validate request structure
      if (!this.isValidRequest(request)) {
        return createMCPError(
          request.id || 0,
          MCPErrorCode.InvalidRequest,
          "Invalid MCP request format"
        );
      }

      const startTime = performance.now();

      // Route request to appropriate handler
      let result: any;
      
      switch (request.method) {
        case 'initialize':
          result = await this.handleInitialize(request.params);
          break;

        case 'tools/list':
          result = await this.handleToolsList(request.params);
          break;

        case 'tools/call':
          result = await this.handleToolsCall(request.params);
          break;

        case 'ping':
          result = await this.handlePing();
          break;

        default:
          return createMCPError(
            request.id,
            MCPErrorCode.MethodNotFound,
            `Method '${request.method}' not found`
          );
      }

      // Log performance if debug mode
      if (process.env.DEBUG_UNJUCKS) {
        const duration = performance.now() - startTime;
        console.log(`[MCP] ${request.method} completed in ${duration.toFixed(2)}ms`);
      }

      return createMCPResponse(request.id, result);

    } catch (error) {
      console.error(`[MCP] Error handling request ${request.method}:`, error);
      
      return createMCPError(
        request.id || 0,
        MCPErrorCode.InternalError,
        error instanceof Error ? error.message : 'Internal server error'
      );
    }
  }

  /**
   * Handle notifications (no response required)
   */
  async handleNotification(notification: MCPNotification): Promise<void> {
    try {
      switch (notification.method) {
        case 'notifications/initialized':
          // Server initialization complete
          break;

        case 'notifications/cancelled':
          // Request cancelled
          break;

        default:
          console.warn(`[MCP] Unknown notification: ${notification.method}`);
      }
    } catch (error) {
      console.error(`[MCP] Error handling notification ${notification.method}:`, error);
    }
  }

  /**
   * Handle initialize request
   */
  private async handleInitialize(params: any): Promise<any> {
    // Validate client capabilities
    const clientCapabilities = params?.capabilities || {};
    
    return {
      protocolVersion: this.serverInfo.protocolVersion,
      capabilities: this.capabilities,
      serverInfo: this.serverInfo,
      instructions: "Unjucks MCP Server provides tools for template generation and file scaffolding. " +
                   "Use unjucks_list to discover templates, unjucks_help for detailed information, " +
                   "unjucks_dry_run to preview changes, and unjucks_generate to create files."
    };
  }

  /**
   * Handle tools/list request
   */
  private async handleToolsList(params: any): Promise<{ tools: Tool[] }> {
    const tools: Tool[] = [
      {
        name: "unjucks_list",
        description: "List available generators and templates with optional detailed information",
        inputSchema: TOOL_SCHEMAS.unjucks_list
      },
      {
        name: "unjucks_generate", 
        description: "Generate files from templates with variable substitution",
        inputSchema: TOOL_SCHEMAS.unjucks_generate
      },
      {
        name: "unjucks_help",
        description: "Get detailed help and documentation for a specific generator and template",
        inputSchema: TOOL_SCHEMAS.unjucks_help
      },
      {
        name: "unjucks_dry_run",
        description: "Preview what files would be generated without writing them",
        inputSchema: TOOL_SCHEMAS.unjucks_dry_run
      },
      {
        name: "unjucks_inject",
        description: "Inject content into existing files with various positioning options",
        inputSchema: TOOL_SCHEMAS.unjucks_inject
      }
    ];

    return { tools };
  }

  /**
   * Handle tools/call request
   */
  private async handleToolsCall(params: any): Promise<ToolResult> {
    try {
      // Validate required parameters
      const missing = validateRequiredParams(params, ['name', 'arguments']);
      if (missing.length > 0) {
        return createTextToolResult(
          `Missing required parameters: ${missing.join(', ')}`,
          true
        );
      }

      const { name, arguments: args } = params as ToolCall;

      // Check if tool exists
      if (!(name in TOOL_IMPLEMENTATIONS)) {
        return createTextToolResult(
          `Unknown tool: ${name}. Available tools: ${Object.keys(TOOL_IMPLEMENTATIONS).join(', ')}`,
          true
        );
      }

      // Get tool implementation
      const toolImplementation = TOOL_IMPLEMENTATIONS[name as keyof typeof TOOL_IMPLEMENTATIONS];

      // Validate arguments against schema
      if (name in TOOL_SCHEMAS) {
        const schema = TOOL_SCHEMAS[name as keyof typeof TOOL_SCHEMAS];
        const validation = validateObjectSchema(args, schema);
        
        if (!validation.valid) {
          return createTextToolResult(
            `Invalid arguments for ${name}: ${validation.errors.join(', ')}`,
            true
          );
        }
      }

      // Execute tool with timeout
      const result = await withTimeout(
        toolImplementation(args),
        60000, // 60 second timeout
        `Tool ${name} execution timed out`
      );

      return result;

    } catch (error) {
      return handleToolError(error, 'tools/call', 'executing tool');
    }
  }

  /**
   * Handle ping request
   */
  private async handlePing(): Promise<{ pong: boolean }> {
    return { pong: true };
  }

  /**
   * Validate request structure
   */
  private isValidRequest(obj: any): obj is MCPRequest {
    return (
      obj &&
      typeof obj === "object" &&
      obj.jsonrpc === "2.0" &&
      (typeof obj.id === "string" || typeof obj.id === "number") &&
      typeof obj.method === "string"
    );
  }

  /**
   * Get server information
   */
  getServerInfo(): ServerInfo {
    return { ...this.serverInfo };
  }

  /**
   * Get server capabilities
   */
  getCapabilities(): ServerCapabilities {
    return { ...this.capabilities };
  }

  /**
   * Update server capabilities (if needed)
   */
  updateCapabilities(newCapabilities: Partial<ServerCapabilities>): void {
    this.capabilities = { ...this.capabilities, ...newCapabilities };
  }
}