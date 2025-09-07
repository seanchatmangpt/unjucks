/**
 * Index file for all MCP tools
 * 
 * Only includes the core tools that are implemented in JavaScript.
 * Enterprise and semantic tools are not included in this JavaScript conversion
 * to ensure compatibility and avoid dependencies on TypeScript-specific features.
 */

// Import core tools first
import { unjucksList } from './unjucks-list.js';
import { unjucksGenerate } from './unjucks-generate.js';
import { unjucksHelp } from './unjucks-help.js';
import { unjucksDryRun } from './unjucks-dry-run.js';
import { unjucksInject } from './unjucks-inject.js';

// Export core tools - these are the only tools implemented in JavaScript
export { unjucksList, unjucksGenerate, unjucksHelp, unjucksDryRun, unjucksInject };

// Tool registry mapping tool names to implementations
// Only includes the implemented JavaScript tools
export const TOOL_IMPLEMENTATIONS = {
  unjucks_list: unjucksList,
  unjucks_generate: unjucksGenerate, 
  unjucks_help: unjucksHelp,
  unjucks_dry_run: unjucksDryRun,
  unjucks_inject: unjucksInject
};

/**
 * Get all available tool names
 * @returns {string[]} Array of tool names
 */
export function getAvailableToolNames() {
  return Object.keys(TOOL_IMPLEMENTATIONS);
}

/**
 * Check if a tool is available
 * @param {string} toolName - Name of the tool to check
 * @returns {boolean} True if tool is available
 */
export function isToolAvailable(toolName) {
  return toolName in TOOL_IMPLEMENTATIONS;
}

/**
 * Get tool implementation
 * @param {string} toolName - Name of the tool
 * @returns {Function|undefined} Tool implementation function
 */
export function getToolImplementation(toolName) {
  return TOOL_IMPLEMENTATIONS[toolName];
}

/**
 * @typedef {keyof typeof TOOL_IMPLEMENTATIONS} ToolName
 */