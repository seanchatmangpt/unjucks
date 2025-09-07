/**
 * Main index file for the Unjucks MCP server
 * Exports all public APIs and types
 */

// Server exports
export { UnjucksMCPServer, createUnjucksMCPServer, main } from './server.js';

// Handler exports
export { MCPRequestHandler } from './handlers/index.js';

// Tool exports
export { 
  unjucksList,
  unjucksGenerate,
  unjucksHelp,
  unjucksDryRun,
  unjucksInject,
  TOOL_IMPLEMENTATIONS
} from './tools/index.js';

// Utility exports
export {
  createMCPError,
  createMCPResponse,
  createTextToolResult,
  createJSONToolResult,
  validateRequiredParams,
  sanitizeFilePath,
  validateDestination,
  validateGeneratorName,
  validateTemplateName,
  formatFileSize,
  formatDuration,
  withTimeout,
  handleToolError,
  logPerformance
} from './utils.js';
export { MCPErrorCode, TOOL_SCHEMAS } from './types.js';

// Version info
export const VERSION = '1.0.0';
export const PROTOCOL_VERSION = '2024-11-05';

/**
 * Default configuration for the MCP server
 */
export const DEFAULT_CONFIG = {
  name: 'unjucks-mcp-server',
  version: VERSION,
  protocolVersion: PROTOCOL_VERSION,
  timeout: 60000, // 60 seconds
  debug: process.env.DEBUG_UNJUCKS === 'true'
};