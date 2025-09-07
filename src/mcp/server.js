/**
 * Main MCP server implementation for Unjucks
 * Provides template generation and scaffolding tools via the Model Context Protocol
 */

import { stdin, stdout, stderr } from 'node:process';
import { Transform } from 'node:stream';
import { MCPRequestHandler } from './handlers/index.js';
import { createMCPError } from './utils.js';
import { MCPErrorCode } from './types.js';

/**
 * Main MCP Server class
 * @class UnjucksMCPServer
 */
export class UnjucksMCPServer {
  /**
   * @param {MCPRequestHandler} requestHandler - Request handler instance
   * @param {number} requestId - Current request ID counter
   * @param {boolean} isShuttingDown - Shutdown flag
   */
  constructor() {
    this.requestHandler = new MCPRequestHandler();
    this.requestId = 0;
    this.isShuttingDown = false;
    this.setupProcessHandlers();
  }

  /**
   * Start the MCP server
   * @returns {Promise<void>}
   */
  async start() {
    try {
      console.error('[MCP] Starting Unjucks MCP Server...');

      // Set up JSON-RPC communication over stdio
      this.setupJSONRPCCommunication();

      console.error('[MCP] Server started successfully');
      console.error(`[MCP] Server info: ${JSON.stringify(this.requestHandler.getServerInfo())}`);
      console.error(`[MCP] Capabilities: ${JSON.stringify(this.requestHandler.getCapabilities())}`);

    } catch (error) {
      console.error('[MCP] Failed to start server:', error);
      process.exit(1);
    }
  }

  /**
   * Stop the MCP server gracefully
   * @returns {Promise<void>}
   */
  async stop() {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;
    console.error('[MCP] Shutting down server...');
    
    // Give time for any pending operations
    await new Promise(resolve => setTimeout(resolve, 100));
    
    console.error('[MCP] Server stopped');
  }

  /**
   * Set up JSON-RPC communication over stdio
   * @private
   */
  setupJSONRPCCommunication() {
    let buffer = '';

    // Create transform stream to handle JSON-RPC messages
    const messageProcessor = new Transform({
      objectMode: false,
      transform(chunk, encoding, callback) {
        buffer += chunk.toString();
        
        // Process complete JSON-RPC messages
        let newlineIndex;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, newlineIndex).trim();
          buffer = buffer.slice(newlineIndex + 1);
          
          if (line) {
            this.push(line + '\n');
          }
        }
        
        callback();
      }
    });

    // Process incoming messages
    stdin.pipe(messageProcessor).on('data', async (data) => {
      const line = data.toString().trim();
      if (!line) return;

      try {
        const message = JSON.parse(line);
        await this.processMessage(message);
      } catch (error) {
        console.error('[MCP] Error parsing JSON message:', error);
        console.error('[MCP] Raw message:', line);
        
        // Send parse error response if possible
        const errorResponse = createMCPError(
          null,
          MCPErrorCode.ParseError,
          'Invalid JSON in request'
        );
        this.sendMessage(errorResponse);
      }
    });

    // Handle stream errors
    stdin.on('error', (error) => {
      console.error('[MCP] stdin error:', error);
    });

    stdout.on('error', (error) => {
      console.error('[MCP] stdout error:', error);
    });
  }

  /**
   * Process incoming MCP messages
   * @param {any} message - The message to process
   * @private
   */
  async processMessage(message) {
    try {
      if (this.isValidMCPRequest(message)) {
        // Handle request
        const response = await this.requestHandler.handleRequest(message);
        this.sendMessage(response);
        
      } else if (this.isValidMCPNotification(message)) {
        // Handle notification (no response)
        await this.requestHandler.handleNotification(message);
        
      } else {
        console.error('[MCP] Invalid message format:', message);
        
        // Send error response if we can determine an ID
        const id = message?.id || 0;
        const errorResponse = createMCPError(
          id,
          MCPErrorCode.InvalidRequest,
          'Invalid message format'
        );
        this.sendMessage(errorResponse);
      }
      
    } catch (error) {
      console.error('[MCP] Error processing message:', error);
      
      const id = message?.id || 0;
      const errorResponse = createMCPError(
        id,
        MCPErrorCode.InternalError,
        error instanceof Error ? error.message : 'Internal server error'
      );
      this.sendMessage(errorResponse);
    }
  }

  /**
   * Send message to client via stdout
   * @param {object} message - MCP response or notification
   * @private
   */
  sendMessage(message) {
    try {
      const json = JSON.stringify(message);
      stdout.write(json + '\n');
      
      if (process.env.DEBUG_UNJUCKS) {
        console.error(`[MCP] Sent: ${json.slice(0, 200)}${json.length > 200 ? '...' : ''}`);
      }
      
    } catch (error) {
      console.error('[MCP] Error sending message:', error);
    }
  }

  /**
   * Send notification to client
   * @param {string} method - Notification method
   * @param {any} [params] - Optional parameters
   */
  sendNotification(method, params) {
    /** @type {import('./types.js').MCPNotification} */
    const notification = {
      jsonrpc: "2.0",
      method,
      ...(params && { params })
    };
    
    this.sendMessage(notification);
  }

  /**
   * Set up process event handlers
   * @private
   */
  setupProcessHandlers() {
    // Graceful shutdown on SIGINT/SIGTERM
    const handleShutdown = async (signal) => {
      console.error(`[MCP] Received ${signal}, shutting down...`);
      await this.stop();
      process.exit(0);
    };

    process.on('SIGINT', () => handleShutdown('SIGINT'));
    process.on('SIGTERM', () => handleShutdown('SIGTERM'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('[MCP] Uncaught exception:', error);
      this.stop().finally(() => process.exit(1));
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('[MCP] Unhandled rejection at:', promise, 'reason:', reason);
    });

    // Handle stdin close
    stdin.on('close', async () => {
      console.error('[MCP] stdin closed, shutting down...');
      await this.stop();
      process.exit(0);
    });

    stdin.on('end', async () => {
      console.error('[MCP] stdin ended, shutting down...');
      await this.stop();
      process.exit(0);
    });
  }

  /**
   * Type guard for MCP requests
   * @param {any} obj - Object to check
   * @returns {boolean}
   * @private
   */
  isValidMCPRequest(obj) {
    return (
      obj &&
      typeof obj === "object" &&
      obj.jsonrpc === "2.0" &&
      (typeof obj.id === "string" || typeof obj.id === "number") &&
      typeof obj.method === "string"
    );
  }

  /**
   * Type guard for MCP notifications
   * @param {any} obj - Object to check
   * @returns {boolean}
   * @private
   */
  isValidMCPNotification(obj) {
    return (
      obj &&
      typeof obj === "object" &&
      obj.jsonrpc === "2.0" &&
      typeof obj.method === "string" &&
      !("id" in obj)
    );
  }

  /**
   * Get next request ID
   * @returns {number}
   * @private
   */
  getNextRequestId() {
    return ++this.requestId;
  }

  /**
   * Get server statistics
   * @returns {object} Server stats
   */
  getStats() {
    return {
      uptime: process.uptime(),
      requestsProcessed: this.requestId,
      isShuttingDown: this.isShuttingDown
    };
  }
}

/**
 * Create and start the MCP server
 * @returns {Promise<UnjucksMCPServer>}
 */
export async function createUnjucksMCPServer() {
  const server = new UnjucksMCPServer();
  await server.start();
  return server;
}

/**
 * Main entry point for the MCP server
 * @returns {Promise<void>}
 */
export async function main() {
  try {
    await createUnjucksMCPServer();
    
    // Keep the process running
    await new Promise(() => {}); // Run forever until killed
    
  } catch (error) {
    console.error('[MCP] Failed to start server:', error);
    process.exit(1);
  }
}

// Auto-start if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}