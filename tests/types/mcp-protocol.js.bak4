/**
 * MCP Protocol Type Definitions
 * Standard JSON-RPC 2.0 and MCP-specific types
 * 
 * These are used as JSDoc type definitions for JavaScript files.
 */

/**
 * @typedef {Object} McpMessage
 * @property {'2.0'} jsonrpc - JSON-RPC version
 * @property {string | number} [id] - Request/response ID
 */

/**
 * @typedef {Object} McpRequest
 * @property {'2.0'} jsonrpc - JSON-RPC version
 * @property {string | number} [id] - Request ID
 * @property {string} method - Method name
 * @property {any} [params] - Method parameters
 */

/**
 * @typedef {Object} McpResponse
 * @property {'2.0'} jsonrpc - JSON-RPC version
 * @property {string | number} [id] - Response ID
 * @property {any} [result] - Response result
 * @property {Object} [error] - Error object
 * @property {number} error.code - Error code
 * @property {string} error.message - Error message
 * @property {any} [error.data] - Additional error data
 */

/**
 * @typedef {Object} McpTool
 * @property {string} name - Tool name
 * @property {string} description - Tool description
 * @property {Object} inputSchema - Input schema
 * @property {string} inputSchema.type - Schema type
 * @property {Record<string, any>} [inputSchema.properties] - Schema properties
 * @property {string[]} [inputSchema.required] - Required properties
 */

/**
 * @typedef {Object} McpToolCall
 * @property {string} name - Tool name
 * @property {Record<string, any>} arguments - Tool arguments
 */

/**
 * @typedef {Object} McpToolResult
 * @property {Array<{type: 'text' | 'json', text?: string, json?: any}>} content - Result content
 * @property {boolean} [isError] - Whether result is an error
 * @property {Record<string, any>} [_meta] - Metadata
 */

/**
 * Claude Flow specific types
 */

/**
 * @typedef {Object} SwarmConfig
 * @property {'mesh' | 'hierarchical' | 'ring' | 'star'} topology - Swarm topology
 * @property {number} [maxAgents] - Maximum number of agents
 * @property {'balanced' | 'specialized' | 'adaptive'} [strategy] - Agent distribution strategy
 */

/**
 * @typedef {Object} AgentConfig
 * @property {'researcher' | 'coder' | 'analyst' | 'optimizer' | 'coordinator'} type - Agent type
 * @property {string} [name] - Agent name
 * @property {string[]} [capabilities] - Agent capabilities
 */

/**
 * @typedef {Object} TaskConfig
 * @property {string} task - Task description
 * @property {number} [maxAgents] - Maximum agents to use
 * @property {'low' | 'medium' | 'high' | 'critical'} [priority] - Task priority
 * @property {'parallel' | 'sequential' | 'adaptive'} [strategy] - Execution strategy
 */

/**
 * @typedef {Object} MemoryOperation
 * @property {'store' | 'retrieve' | 'list' | 'delete' | 'search'} action - Memory operation type
 * @property {string} [key] - Memory key
 * @property {string} [value] - Memory value
 * @property {string} [namespace] - Memory namespace
 * @property {number} [ttl] - Time to live
 */

/**
 * @typedef {Object} NeuralConfig
 * @property {number} [iterations] - Training iterations
 * @property {'coordination' | 'optimization' | 'prediction'} [pattern_type] - Pattern type
 * @property {string} [training_data] - Training data
 */

// Export for CommonJS compatibility
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {};
}