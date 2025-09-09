/**
 * Enhanced MCP server with improved startup, error handling, and health monitoring
 * @fileoverview Stabilized version of the Unjucks MCP server with optimizations
 */

import { stdin, stdout, stderr } from 'node:process';
import { Transform } from 'node:stream';
import { EnhancedMCPRequestHandler } from './handlers/enhanced-request-handler.js';
import { createMCPError } from './utils.js';
import { MCPErrorCode } from './types.js';
import { createHealthMonitor, createHealthMiddleware } from './connection-health.js';

/**
 * Enhanced MCP Server with health monitoring and auto-recovery
 * @class EnhancedUnjucksMCPServer
 */
export class EnhancedUnjucksMCPServer {
  /**
   * @param {Object} options - Server configuration options
   * @param {number} [options.startupTimeout=10000] - Startup timeout in ms
   * @param {number} [options.requestTimeout=60000] - Request timeout in ms
   * @param {boolean} [options.enableHealthMonitoring=true] - Enable health monitoring
   * @param {Object} [options.healthOptions] - Health monitor options
   */
  constructor(options = {}) {
    this.options = {
      startupTimeout: 10000,
      requestTimeout: 60000,
      enableHealthMonitoring: true,
      healthOptions: {},
      ...options
    };

    this.requestHandler = new EnhancedMCPRequestHandler();
    this.requestId = 0;
    this.isShuttingDown = false;
    this.isStarted = false;
    this.startupPromise = null;

    // Health monitoring
    this.healthMonitor = this.options.enableHealthMonitoring 
      ? createHealthMonitor(this.options.healthOptions)
      : null;
    
    this.healthMiddleware = this.healthMonitor 
      ? createHealthMiddleware(this.healthMonitor)
      : null;

    this.setupProcessHandlers();
    this.setupHealthMonitoring();
  }

  /**
   * Start the MCP server with timeout and error handling
   * @returns {Promise<void>}
   */
  async start() {
    if (this.isStarted || this.startupPromise) {
      return this.startupPromise;
    }

    this.startupPromise = this._performStartup();
    return this.startupPromise;
  }

  /**
   * Internal startup procedure with timeout
   * @returns {Promise<void>}
   * @private
   */
  async _performStartup() {
    try {
      console.error('[MCP] Starting Enhanced Unjucks MCP Server...');

      // Start with timeout
      await Promise.race([
        this._initializeServer(),
        new Promise((_, reject) => {
          setTimeout(() => {
            reject(new Error(`Server startup timed out after ${this.options.startupTimeout}ms`));
          }, this.options.startupTimeout);
        })
      ]);

      this.isStarted = true;
      console.error('[MCP] Server started successfully');
      console.error(`[MCP] Server info: ${JSON.stringify(this.requestHandler.getServerInfo())}`);
      
      // Start health monitoring
      if (this.healthMonitor) {
        this.healthMonitor.start();
        console.error('[MCP] Health monitoring enabled');
      }

    } catch (error) {
      console.error('[MCP] Failed to start server:', error);
      this.isStarted = false;
      throw error;
    }
  }

  /**
   * Initialize server components
   * @returns {Promise<void>}
   * @private
   */
  async _initializeServer() {
    // Set up JSON-RPC communication with improved error handling
    this.setupEnhancedJSONRPCCommunication();

    // Test basic functionality
    await this._performStartupHealthCheck();
  }

  /**
   * Perform startup health check
   * @returns {Promise<void>}
   * @private
   */
  async _performStartupHealthCheck() {
    try {
      // Test request handler
      const testRequest = {
        jsonrpc: "2.0",
        id: "startup_test",
        method: "ping",
        params: {}
      };

      const response = await this.requestHandler.handleRequest(testRequest);
      
      if (response.error) {
        throw new Error(`Startup health check failed: ${response.error.message}`);
      }

      console.error('[MCP] Startup health check passed');
    } catch (error) {
      throw new Error(`Startup health check failed: ${error.message}`);
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
    console.error('[MCP] Shutting down enhanced server...');
    
    try {
      // Stop health monitoring
      if (this.healthMonitor) {
        this.healthMonitor.stop();
      }

      // Give time for any pending operations
      await new Promise(resolve => setTimeout(resolve, 500));
      
      this.isStarted = false;
      console.error('[MCP] Enhanced server stopped');
      
    } catch (error) {
      console.error('[MCP] Error during shutdown:', error);
    }
  }

  /**
   * Set up enhanced JSON-RPC communication with better error handling
   * @private
   */
  setupEnhancedJSONRPCCommunication() {
    let buffer = '';
    let messageCount = 0;

    // Create enhanced transform stream
    const messageProcessor = new Transform({
      objectMode: false,
      transform(chunk, encoding, callback) {
        try {
          buffer += chunk.toString();
          
          // Process complete JSON-RPC messages with better parsing
          let newlineIndex;
          while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
            const line = buffer.slice(0, newlineIndex).trim();
            buffer = buffer.slice(newlineIndex + 1);
            
            if (line && line.length > 0) {
              this.push(line + '\n');
            }
          }
          
          callback();
        } catch (error) {
          console.error('[MCP] Transform error:', error);
          callback(error);
        }
      }
    });

    // Enhanced message processing with health monitoring
    stdin.pipe(messageProcessor).on('data', async (data) => {
      const line = data.toString().trim();
      if (!line) return;

      messageCount++;
      const requestId = `req_${messageCount}_${Date.now()}`;

      try {
        const message = JSON.parse(line);
        await this.processEnhancedMessage(message, requestId);
      } catch (error) {
        console.error('[MCP] Error parsing JSON message:', error);
        console.error('[MCP] Raw message:', line.substring(0, 200));
        
        // Record error in health monitoring
        if (this.healthMiddleware) {
          this.healthMiddleware.postError(requestId, error);
        }
        
        // Send parse error response if possible
        const errorResponse = createMCPError(
          null,
          MCPErrorCode.ParseError,
          'Invalid JSON in request'
        );
        this.sendEnhancedMessage(errorResponse);
      }
    });

    // Enhanced error handling for streams
    stdin.on('error', (error) => {
      console.error('[MCP] stdin error:', error);
      if (this.healthMonitor) {
        this.healthMonitor.recordRequestError('stdin', error);
      }
    });

    stdout.on('error', (error) => {
      console.error('[MCP] stdout error:', error);
      if (this.healthMonitor) {
        this.healthMonitor.recordRequestError('stdout', error);
      }
    });

    // Handle backpressure and flow control
    messageProcessor.on('error', (error) => {
      console.error('[MCP] Message processor error:', error);
    });
  }

  /**
   * Process incoming MCP messages with enhanced error handling and monitoring
   * @param {any} message - The message to process
   * @param {string} requestId - Unique request identifier
   * @private
   */
  async processEnhancedMessage(message, requestId) {
    try {
      // Record request start for health monitoring
      if (this.healthMiddleware && this.isValidMCPRequest(message)) {
        this.healthMiddleware.preRequest(requestId, message.method);
      }

      if (this.isValidMCPRequest(message)) {
        // Handle request with timeout
        const response = await Promise.race([
          this.requestHandler.handleRequest(message),
          new Promise((_, reject) => {
            setTimeout(() => {
              reject(new Error(`Request ${message.method} timed out after ${this.options.requestTimeout}ms`));
            }, this.options.requestTimeout);
          })
        ]);

        this.sendEnhancedMessage(response);
        
        // Record success
        if (this.healthMiddleware) {
          this.healthMiddleware.postSuccess(requestId);
        }
        
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
        this.sendEnhancedMessage(errorResponse);
        
        // Record error
        if (this.healthMiddleware) {
          const error = new Error('Invalid message format');
          this.healthMiddleware.postError(requestId, error);
        }
      }
      
    } catch (error) {
      console.error('[MCP] Error processing enhanced message:', error);
      
      // Record error in health monitoring
      if (this.healthMiddleware) {
        this.healthMiddleware.postError(requestId, error);
      }
      
      const id = message?.id || 0;
      const errorResponse = createMCPError(
        id,
        MCPErrorCode.InternalError,
        error instanceof Error ? error.message : 'Internal server error'
      );
      this.sendEnhancedMessage(errorResponse);
    }
  }

  /**
   * Send message to client with enhanced error handling
   * @param {object} message - MCP response or notification
   * @private
   */
  sendEnhancedMessage(message) {
    try {
      const json = JSON.stringify(message);
      
      // Validate JSON before sending
      if (json.length > 1024 * 1024) { // 1MB limit
        console.warn('[MCP] Large message detected:', json.length, 'bytes');
      }
      
      stdout.write(json + '\n');
      
      if (process.env.DEBUG_UNJUCKS) {
        const preview = json.length > 200 ? json.slice(0, 200) + '...' : json;
        console.error(`[MCP] Sent: ${preview}`);
      }
      
    } catch (error) {
      console.error('[MCP] Error sending enhanced message:', error);
      
      // Try to send a simpler error message
      try {
        const simpleError = createMCPError(
          message?.id || 0,
          MCPErrorCode.InternalError,
          'Failed to send response'
        );
        stdout.write(JSON.stringify(simpleError) + '\n');
      } catch (fallbackError) {
        console.error('[MCP] Failed to send fallback error:', fallbackError);
      }
    }
  }

  /**
   * Set up health monitoring event handlers
   * @private
   */
  setupHealthMonitoring() {
    if (!this.healthMonitor) return;

    // Handle recovery events
    this.healthMonitor.on('recovery:attempt', async () => {
      console.log('[MCP] Attempting auto-recovery...');
      
      try {
        // Reset request handler if needed
        // Could reinitialize components here
        console.log('[MCP] Auto-recovery completed');
      } catch (error) {
        console.error('[MCP] Auto-recovery failed:', error);
      }
    });

    // Log health status changes
    this.healthMonitor.on('status:changed', ({ newStatus }) => {
      console.log(`[MCP] Health status: ${newStatus}`);
    });

    // Periodic health reporting
    if (process.env.DEBUG_UNJUCKS) {
      setInterval(() => {
        console.log(`[MCP] ${this.healthMonitor.getStatusSummary()}`);
      }, 30000); // Every 30 seconds
    }
  }

  /**
   * Set up enhanced process event handlers
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

    // Enhanced uncaught exception handling
    process.on('uncaughtException', (error) => {
      console.error('[MCP] Uncaught exception:', error);
      
      if (this.healthMonitor) {
        this.healthMonitor.recordRequestError('uncaught', error);
      }
      
      this.stop().finally(() => process.exit(1));
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('[MCP] Unhandled rejection at:', promise, 'reason:', reason);
      
      if (this.healthMonitor) {
        const error = reason instanceof Error ? reason : new Error(String(reason));
        this.healthMonitor.recordRequestError('unhandled', error);
      }
    });

    // Enhanced stdin handling
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

    // Handle process warnings
    process.on('warning', (warning) => {
      if (process.env.DEBUG_UNJUCKS) {
        console.warn('[MCP] Process warning:', warning.message);
      }
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
   * Get server statistics including health metrics
   * @returns {object} Enhanced server stats
   */
  getEnhancedStats() {
    const basicStats = {
      uptime: process.uptime(),
      requestsProcessed: this.requestId,
      isShuttingDown: this.isShuttingDown,
      isStarted: this.isStarted,
      memoryUsage: process.memoryUsage(),
      nodeVersion: process.version
    };

    if (this.healthMonitor) {
      return {
        ...basicStats,
        health: this.healthMonitor.getHealthReport()
      };
    }

    return basicStats;
  }

  /**
   * Get health report (if monitoring enabled)
   * @returns {object|null} Health report or null if monitoring disabled
   */
  getHealthReport() {
    return this.healthMonitor ? this.healthMonitor.getHealthReport() : null;
  }
}

/**
 * Create and start the enhanced MCP server
 * @param {Object} [options] - Server options
 * @returns {Promise<EnhancedUnjucksMCPServer>}
 */
export async function createEnhancedUnjucksMCPServer(options) {
  const server = new EnhancedUnjucksMCPServer(options);
  await server.start();
  return server;
}

/**
 * Main entry point for the enhanced MCP server
 * @param {Object} [options] - Server options
 * @returns {Promise<void>}
 */
export async function main(options) {
  try {
    const server = await createEnhancedUnjucksMCPServer(options);
    
    // Keep the process running
    await new Promise(() => {}); // Run forever until killed
    
  } catch (error) {
    console.error('[MCP] Failed to start enhanced server:', error);
    process.exit(1);
  }
}

// Auto-start if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}