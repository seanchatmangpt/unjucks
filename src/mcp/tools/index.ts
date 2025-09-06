/**
 * Index file for all MCP tools
 */

export { unjucksList } from './unjucks-list.js';
export { unjucksGenerate } from './unjucks-generate.js';
export { unjucksHelp } from './unjucks-help.js';
export { unjucksDryRun } from './unjucks-dry-run.js';
export { unjucksInject } from './unjucks-inject.js';

// Tool registry mapping tool names to implementations
export const TOOL_IMPLEMENTATIONS = {
  unjucks_list: unjucksList,
  unjucks_generate: unjucksGenerate, 
  unjucks_help: unjucksHelp,
  unjucks_dry_run: unjucksDryRun,
  unjucks_inject: unjucksInject
} as const;

export type ToolName = keyof typeof TOOL_IMPLEMENTATIONS;