#!/usr/bin/env node
/**
 * Entry point for the Unjucks MCP server
 */

import { main } from './mcp/server.js';

// Start the MCP server
main().catch((error) => {
  console.error('[MCP] Fatal error:', error);
  process.exit(1);
});