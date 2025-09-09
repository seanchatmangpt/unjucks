#!/usr/bin/env node
/**
 * Entry point for the Unjucks MCP server with enhanced stability
 */

import { main } from './mcp/enhanced-server.js';

// Configuration options
const serverOptions = {
  startupTimeout: 15000, // 15 seconds for startup
  requestTimeout: 60000, // 60 seconds for requests
  enableHealthMonitoring: true,
  healthOptions: {
    heartbeatInterval: 10000, // 10 seconds
    timeoutThreshold: 30000, // 30 seconds
    maxRetries: 3,
    retryDelay: 2000 // 2 seconds
  }
};

// Start the enhanced MCP server
main(serverOptions).catch((error) => {
  console.error('[MCP] Fatal error:', error);
  process.exit(1);
});