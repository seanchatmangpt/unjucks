/**
 * Index file for all MCP tools
 */

export { unjucksList } from './unjucks-list.js';
export { unjucksGenerate } from './unjucks-generate.js';
export { unjucksHelp } from './unjucks-help.js';
export { unjucksDryRun } from './unjucks-dry-run.js';
export { unjucksInject } from './unjucks-inject.js';

// Enterprise tools
export { unjucksEnterpriseAuth } from './unjucks-enterprise-auth.js';
export { unjucksTemplateMarketplace } from './unjucks-template-marketplace.js';
export { unjucksRealtimeCollab } from './unjucks-realtime-collab.js';
export { unjucksE2ESwarm } from '../swarm/e2e-orchestrator.js';

// Tool registry mapping tool names to implementations
export const TOOL_IMPLEMENTATIONS = {
  unjucks_list: unjucksList,
  unjucks_generate: unjucksGenerate, 
  unjucks_help: unjucksHelp,
  unjucks_dry_run: unjucksDryRun,
  unjucks_inject: unjucksInject,
  // Enterprise tools
  unjucks_enterprise_auth: unjucksEnterpriseAuth,
  unjucks_template_marketplace: unjucksTemplateMarketplace,
  unjucks_realtime_collab: unjucksRealtimeCollab,
  unjucks_e2e_swarm: unjucksE2ESwarm
} as const;

export type ToolName = keyof typeof TOOL_IMPLEMENTATIONS;