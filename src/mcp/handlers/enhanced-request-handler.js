/**
 * Enhanced request handler with improved error handling and tool discovery
 * @fileoverview Robust MCP request handling with better error recovery and tool management
 */

import { MCPErrorCode } from '../types.js';
import {
  createMCPError,
  createMCPResponse,
  createTextToolResult,
  validateRequiredParams,
  validateObjectSchema,
  handleToolError,
  withTimeout
} from '../utils.js';
import { TOOL_IMPLEMENTATIONS, getAvailableToolNames, isToolAvailable } from '../tools/index.js';
import { TOOL_SCHEMAS } from '../types.js';

/**
 * Enhanced MCP request handler with better error handling and tool discovery
 * @class EnhancedMCPRequestHandler
 */
export class EnhancedMCPRequestHandler {
  /**
   * @param {Object} options - Handler configuration options
   * @param {number} [options.defaultTimeout=60000] - Default timeout for tool calls
   * @param {boolean} [options.enableToolCaching=true] - Enable tool result caching
   * @param {number} [options.maxCacheSize=100] - Maximum cache entries
   */
  constructor(options = {}) {
    this.options = {
      defaultTimeout: 60000,
      enableToolCaching: true,
      maxCacheSize: 100,
      ...options
    };

    this.serverInfo = {
      name: "unjucks-mcp-server-enhanced",
      version: "1.1.0",
      protocolVersion: "2024-11-05"
    };

    this.capabilities = {
      tools: {
        listChanged: true
      },
      logging: {
        level: "info"
      },
      experimental: {
        toolCaching: this.options.enableToolCaching,
        healthMonitoring: true
      }
    };

    // Tool cache for performance optimization
    this.toolCache = this.options.enableToolCaching ? new Map() : null;
    this.requestMetrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      toolUsageStats: new Map()
    };
  }

  /**
   * Handle incoming MCP requests with enhanced error handling
   * @param {import('../types.js').MCPRequest} request - The MCP request
   * @returns {Promise<import('../types.js').MCPResponse>}
   */
  async handleRequest(request) {
    const startTime = performance.now();
    this.requestMetrics.totalRequests++;

    try {
      // Validate request structure with detailed error reporting
      const validationResult = this.validateRequest(request);
      if (!validationResult.valid) {
        this.requestMetrics.failedRequests++;
        return createMCPError(
          request.id || 0,
          MCPErrorCode.InvalidRequest,
          validationResult.error
        );
      }

      /** @type {any} */
      let result;
      
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

        case 'server/status':
          result = await this.handleServerStatus();
          break;

        case 'tools/refresh':
          result = await this.handleToolsRefresh();
          break;

        default:
          this.requestMetrics.failedRequests++;
          return createMCPError(
            request.id,
            MCPErrorCode.MethodNotFound,
            `Method '${request.method}' not found. Available methods: initialize, tools/list, tools/call, ping, server/status, tools/refresh`
          );
      }

      // Update metrics
      const duration = performance.now() - startTime;
      this.updateResponseTimeMetrics(duration);
      this.requestMetrics.successfulRequests++;

      // Log performance if debug mode
      if (process.env.DEBUG_UNJUCKS) {
        console.log(`[MCP] ${request.method} completed in ${duration.toFixed(2)}ms`);
      }

      return createMCPResponse(request.id, result);

    } catch (error) {
      this.requestMetrics.failedRequests++;
      console.error(`[MCP] Error handling enhanced request ${request.method}:`, error);
      
      return createMCPError(
        request.id || 0,
        MCPErrorCode.InternalError,
        this.formatError(error)
      );
    }
  }

  /**
   * Handle notifications with enhanced error handling
   * @param {import('../types.js').MCPNotification} notification - The MCP notification
   * @returns {Promise<void>}
   */
  async handleNotification(notification) {
    try {
      switch (notification.method) {
        case 'notifications/initialized':
          // Server initialization complete
          console.log('[MCP] Client initialization complete');
          break;

        case 'notifications/cancelled':
          // Request cancelled
          if (notification.params?.id) {
            this.handleRequestCancellation(notification.params.id);
          }
          break;

        case 'notifications/tools/changed':
          // Tools changed - refresh cache
          this.invalidateToolCache();
          break;

        default:
          console.warn(`[MCP] Unknown notification: ${notification.method}`);
      }
    } catch (error) {
      console.error(`[MCP] Error handling notification ${notification.method}:`, error);
    }
  }

  /**
   * Validate request structure with detailed error reporting
   * @param {any} obj - Object to validate
   * @returns {{valid: boolean, error?: string}}
   * @private
   */
  validateRequest(obj) {
    if (!obj || typeof obj !== "object") {
      return { valid: false, error: "Request must be an object" };
    }

    if (obj.jsonrpc !== "2.0") {
      return { valid: false, error: "Invalid JSON-RPC version, must be '2.0'" };
    }

    if (typeof obj.id !== "string" && typeof obj.id !== "number") {
      return { valid: false, error: "Request ID must be a string or number" };
    }

    if (typeof obj.method !== "string" || obj.method.trim() === "") {
      return { valid: false, error: "Method must be a non-empty string" };
    }

    return { valid: true };
  }

  /**
   * Handle initialize request with enhanced capabilities
   * @param {any} params - Request parameters
   * @returns {Promise<any>}
   * @private
   */
  async handleInitialize(params) {
    // Validate client capabilities
    const clientCapabilities = params?.capabilities || {};
    
    // Detect client version for compatibility
    const clientInfo = params?.clientInfo || {};
    
    return {
      protocolVersion: this.serverInfo.protocolVersion,
      capabilities: this.capabilities,
      serverInfo: {
        ...this.serverInfo,
        availableTools: getAvailableToolNames().length,
        supportedFeatures: [
          'tool_caching',
          'health_monitoring',
          'detailed_errors',
          'performance_metrics'
        ]
      },
      instructions: "Enhanced Unjucks MCP Server provides robust template generation and file scaffolding. " +
                   "Use unjucks_list to discover templates, unjucks_help for detailed information, " +
                   "unjucks_dry_run to preview changes, and unjucks_generate to create files. " +
                   "Server includes health monitoring and enhanced error handling for reliable operation."
    };
  }

  /**
   * Handle tools/list request with enhanced tool discovery
   * @param {any} params - Request parameters
   * @returns {Promise<{tools: import('../types.js').Tool[]}>}
   * @private
   */
  async handleToolsList(params) {
    const includeMetadata = params?.includeMetadata === true;
    const toolPrefix = params?.prefix;

    /** @type {import('../types.js').Tool[]} */
    const tools = [];

    // Get available tool names with optional filtering
    let toolNames = getAvailableToolNames();
    
    if (toolPrefix) {
      toolNames = toolNames.filter(name => name.startsWith(toolPrefix));
    }

    for (const toolName of toolNames) {
      const tool = {
        name: toolName,
        description: this.getToolDescription(toolName),
        inputSchema: TOOL_SCHEMAS[toolName] || { type: "object", properties: {} }
      };

      // Add metadata if requested
      if (includeMetadata) {
        const stats = this.requestMetrics.toolUsageStats.get(toolName);
        tool.metadata = {
          usageCount: stats?.count || 0,
          averageExecutionTime: stats?.averageTime || 0,
          lastUsed: stats?.lastUsed || null,
          successRate: stats ? (stats.successes / stats.count * 100).toFixed(1) : '0.0'
        };
      }

      tools.push(tool);
    }

    return { 
      tools,
      totalAvailable: getAvailableToolNames().length,
      filtered: toolPrefix ? toolNames.length : undefined
    };
  }

  /**
   * Handle tools/call request with enhanced error handling and caching
   * @param {any} params - Request parameters
   * @returns {Promise<import('../types.js').ToolResult>}
   * @private
   */
  async handleToolsCall(params) {
    const startTime = performance.now();

    try {
      // Validate required parameters with detailed errors
      const validation = this.validateToolCallParams(params);
      if (!validation.valid) {
        return createTextToolResult(validation.error, {}, true);
      }

      /** @type {import('../types.js').ToolCall} */
      const { name, arguments: args } = params;

      // Check if tool exists
      if (!isToolAvailable(name)) {
        return createTextToolResult(
          `Unknown tool: ${name}. Available tools: ${getAvailableToolNames().join(', ')}`,
          { availableTools: getAvailableToolNames() },
          true
        );
      }

      // Check cache first (if enabled and appropriate)
      const cacheKey = this.generateCacheKey(name, args);
      if (this.toolCache && this.shouldUseCache(name, args)) {
        const cachedResult = this.toolCache.get(cacheKey);
        if (cachedResult && !this.isCacheExpired(cachedResult)) {
          this.updateToolUsageStats(name, performance.now() - startTime, true, true);
          return {
            ...cachedResult.result,
            _meta: {
              ...cachedResult.result._meta,
              cached: true,
              cacheTimestamp: cachedResult.timestamp
            }
          };
        }
      }

      // Validate arguments against schema with detailed errors
      if (name in TOOL_SCHEMAS) {
        const schema = TOOL_SCHEMAS[name];
        const argValidation = validateObjectSchema(args, schema);
        
        if (!argValidation.valid) {
          this.updateToolUsageStats(name, performance.now() - startTime, false);
          return createTextToolResult(
            `Invalid arguments for ${name}:\n${argValidation.errors.map(e => `  • ${e}`).join('\n')}`,
            { 
              errors: argValidation.errors,
              expectedSchema: schema,
              receivedArgs: Object.keys(args)
            },
            true
          );
        }
      }

      // Get tool implementation
      const toolImplementation = TOOL_IMPLEMENTATIONS[name];

      // Execute tool with enhanced timeout and error handling
      const result = await withTimeout(
        this.executeToolWithRetry(toolImplementation, args, name),
        this.options.defaultTimeout,
        `Tool ${name} execution timed out after ${this.options.defaultTimeout}ms`
      );

      // Cache result if appropriate
      if (this.toolCache && this.shouldCacheResult(name, args, result)) {
        this.cacheToolResult(cacheKey, result);
      }

      // Update usage statistics
      this.updateToolUsageStats(name, performance.now() - startTime, true);

      return result;

    } catch (error) {
      const duration = performance.now() - startTime;
      const toolName = params?.name || 'unknown';
      this.updateToolUsageStats(toolName, duration, false);
      
      return handleToolError(error, 'tools/call', `executing tool ${toolName}`);
    }
  }

  /**
   * Execute tool with retry logic for transient failures
   * @param {Function} toolImplementation - Tool function to execute
   * @param {Object} args - Tool arguments
   * @param {string} toolName - Tool name for logging
   * @param {number} [maxRetries=2] - Maximum retry attempts
   * @returns {Promise<any>}
   * @private
   */
  async executeToolWithRetry(toolImplementation, args, toolName, maxRetries = 2) {
    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          console.log(`[MCP] Retrying ${toolName} (attempt ${attempt + 1}/${maxRetries + 1})`);
          // Wait before retry with exponential backoff
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }

        return await toolImplementation(args);

      } catch (error) {
        lastError = error;
        
        // Don't retry for certain types of errors
        if (this.isNonRetryableError(error)) {
          throw error;
        }

        if (attempt === maxRetries) {
          console.error(`[MCP] Tool ${toolName} failed after ${maxRetries + 1} attempts:`, error);
        }
      }
    }

    throw lastError;
  }

  /**
   * Check if an error should not be retried
   * @param {Error} error - The error to check
   * @returns {boolean}
   * @private
   */
  isNonRetryableError(error) {
    const message = error.message.toLowerCase();
    return (
      message.includes('validation') ||
      message.includes('invalid') ||
      message.includes('not found') ||
      message.includes('permission') ||
      message.includes('unauthorized')
    );
  }

  /**
   * Handle ping request with server health info
   * @returns {Promise<{pong: boolean, health: Object}>}
   * @private
   */
  async handlePing() {
    return { 
      pong: true,
      timestamp: Date.now(),
      uptime: process.uptime(),
      health: {
        status: 'healthy',
        toolsAvailable: getAvailableToolNames().length,
        requestMetrics: this.getRequestMetrics()
      }
    };
  }

  /**
   * Handle server status request
   * @returns {Promise<Object>}
   * @private
   */
  async handleServerStatus() {
    return {
      server: this.serverInfo,
      capabilities: this.capabilities,
      metrics: this.getDetailedMetrics(),
      cache: this.toolCache ? {
        enabled: true,
        size: this.toolCache.size,
        maxSize: this.options.maxCacheSize
      } : { enabled: false }
    };
  }

  /**
   * Handle tools refresh request
   * @returns {Promise<{refreshed: boolean, toolCount: number}>}
   * @private
   */
  async handleToolsRefresh() {
    this.invalidateToolCache();
    return {
      refreshed: true,
      toolCount: getAvailableToolNames().length,
      timestamp: Date.now()
    };
  }

  /**
   * Validate tool call parameters
   * @param {any} params - Parameters to validate
   * @returns {{valid: boolean, error?: string}}
   * @private
   */
  validateToolCallParams(params) {
    if (!params || typeof params !== 'object') {
      return { valid: false, error: 'Tool call parameters must be an object' };
    }

    if (typeof params.name !== 'string' || !params.name.trim()) {
      return { valid: false, error: 'Tool name must be a non-empty string' };
    }

    if (!params.arguments || typeof params.arguments !== 'object') {
      return { valid: false, error: 'Tool arguments must be an object' };
    }

    return { valid: true };
  }

  /**
   * Get tool description
   * @param {string} toolName - Tool name
   * @returns {string}
   * @private
   */
  getToolDescription(toolName) {
    const descriptions = {
      unjucks_list: "List available generators and templates with optional detailed information and usage statistics",
      unjucks_generate: "Generate files from templates with variable substitution and enhanced error handling",
      unjucks_help: "Get detailed help and documentation for a specific generator and template",
      unjucks_dry_run: "Preview what files would be generated without writing them to disk",
      unjucks_inject: "Inject content into existing files with various positioning options and validation"
    };

    return descriptions[toolName] || "Template generation tool";
  }

  /**
   * Cache management methods
   */

  /**
   * Generate cache key for tool call
   * @param {string} toolName - Tool name
   * @param {Object} args - Tool arguments
   * @returns {string}
   * @private
   */
  generateCacheKey(toolName, args) {
    const argsString = JSON.stringify(args, Object.keys(args).sort());
    return `${toolName}:${Buffer.from(argsString).toString('base64')}`;
  }

  /**
   * Check if tool result should use cache
   * @param {string} toolName - Tool name
   * @param {Object} args - Tool arguments
   * @returns {boolean}
   * @private
   */
  shouldUseCache(toolName, args) {
    // Only cache read-only operations
    return toolName === 'unjucks_list' || toolName === 'unjucks_help';
  }

  /**
   * Check if cached result should be stored
   * @param {string} toolName - Tool name
   * @param {Object} args - Tool arguments
   * @param {Object} result - Tool result
   * @returns {boolean}
   * @private
   */
  shouldCacheResult(toolName, args, result) {
    return this.shouldUseCache(toolName, args) && !result.isError;
  }

  /**
   * Cache tool result
   * @param {string} cacheKey - Cache key
   * @param {Object} result - Tool result
   * @private
   */
  cacheToolResult(cacheKey, result) {
    if (!this.toolCache) return;

    // Implement LRU eviction if cache is full
    if (this.toolCache.size >= this.options.maxCacheSize) {
      const firstKey = this.toolCache.keys().next().value;
      this.toolCache.delete(firstKey);
    }

    this.toolCache.set(cacheKey, {
      result: { ...result },
      timestamp: Date.now()
    });
  }

  /**
   * Check if cache entry is expired
   * @param {{timestamp: number}} cacheEntry - Cache entry
   * @returns {boolean}
   * @private
   */
  isCacheExpired(cacheEntry) {
    const maxAge = 5 * 60 * 1000; // 5 minutes
    return Date.now() - cacheEntry.timestamp > maxAge;
  }

  /**
   * Invalidate tool cache
   * @private
   */
  invalidateToolCache() {
    if (this.toolCache) {
      this.toolCache.clear();
      console.log('[MCP] Tool cache invalidated');
    }
  }

  /**
   * Handle request cancellation
   * @param {string|number} requestId - Request ID to cancel
   * @private
   */
  handleRequestCancellation(requestId) {
    console.log(`[MCP] Request ${requestId} cancelled by client`);
    // Could implement request cancellation logic here
  }

  /**
   * Metrics and monitoring methods
   */

  /**
   * Update response time metrics
   * @param {number} duration - Response time in milliseconds
   * @private
   */
  updateResponseTimeMetrics(duration) {
    const total = this.requestMetrics.totalRequests;
    const current = this.requestMetrics.averageResponseTime;
    this.requestMetrics.averageResponseTime = ((current * (total - 1)) + duration) / total;
  }

  /**
   * Update tool usage statistics
   * @param {string} toolName - Tool name
   * @param {number} duration - Execution time
   * @param {boolean} success - Whether execution was successful
   * @param {boolean} [fromCache=false] - Whether result was from cache
   * @private
   */
  updateToolUsageStats(toolName, duration, success, fromCache = false) {
    const stats = this.requestMetrics.toolUsageStats.get(toolName) || {
      count: 0,
      successes: 0,
      totalTime: 0,
      averageTime: 0,
      lastUsed: null
    };

    stats.count++;
    if (success) stats.successes++;
    if (!fromCache) {
      stats.totalTime += duration;
      stats.averageTime = stats.totalTime / stats.count;
    }
    stats.lastUsed = Date.now();

    this.requestMetrics.toolUsageStats.set(toolName, stats);
  }

  /**
   * Get request metrics summary
   * @returns {Object}
   * @private
   */
  getRequestMetrics() {
    const successRate = this.requestMetrics.totalRequests > 0
      ? (this.requestMetrics.successfulRequests / this.requestMetrics.totalRequests * 100).toFixed(1)
      : '0.0';

    return {
      total: this.requestMetrics.totalRequests,
      successful: this.requestMetrics.successfulRequests,
      failed: this.requestMetrics.failedRequests,
      successRate: `${successRate}%`,
      averageResponseTime: Math.round(this.requestMetrics.averageResponseTime)
    };
  }

  /**
   * Get detailed metrics including tool usage
   * @returns {Object}
   * @private
   */
  getDetailedMetrics() {
    const toolStats = {};
    for (const [toolName, stats] of this.requestMetrics.toolUsageStats) {
      toolStats[toolName] = {
        ...stats,
        successRate: `${(stats.successes / stats.count * 100).toFixed(1)}%`
      };
    }

    return {
      requests: this.getRequestMetrics(),
      tools: toolStats,
      memory: process.memoryUsage(),
      uptime: process.uptime()
    };
  }

  /**
   * Format error for client consumption
   * @param {unknown} error - Error to format
   * @returns {string}
   * @private
   */
  formatError(error) {
    if (error instanceof Error) {
      return `${error.name}: ${error.message}`;
    } else if (typeof error === 'string') {
      return error;
    } else {
      return 'Unknown error occurred';
    }
  }

  /**
   * Get server information
   * @returns {import('../types.js').ServerInfo}
   */
  getServerInfo() {
    return { ...this.serverInfo };
  }

  /**
   * Get server capabilities
   * @returns {import('../types.js').ServerCapabilities}
   */
  getCapabilities() {
    return { ...this.capabilities };
  }

  /**
   * Update server capabilities
   * @param {Partial<import('../types.js').ServerCapabilities>} newCapabilities - New capabilities
   */
  updateCapabilities(newCapabilities) {
    this.capabilities = { ...this.capabilities, ...newCapabilities };
  }
}