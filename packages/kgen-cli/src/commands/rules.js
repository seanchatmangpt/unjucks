/**
 * Rules Command Group
 * 
 * Manage N3.js rule packs for reasoning engine configuration.
 * Essential for autonomous systems that need compliance, validation, and inference capabilities.
 */

import { defineCommand } from 'citty';

// Import subcommands
import rulesIndex from './rules/index.js';

export default defineCommand({
  meta: {
    name: 'rules',
    description: 'Manage N3.js rule packs for reasoning and compliance'
  },
  subCommands: {
    // Delegate to the rules index which contains the actual subcommands
    ...rulesIndex.subCommands
  },
  async run({ args }) {
    // If no subcommand specified, show help with available operations
    const result = {
      success: true,
      data: {
        tool: 'kgen rules',
        description: 'Manage N3.js rule packs for reasoning, compliance, and validation',
        usage: 'kgen rules <command> [options]',
        commands: [
          {
            name: 'ls',
            description: 'List available rule packs with filtering and sorting',
            usage: 'kgen rules ls [--type compliance|inference|validation] [--pattern <name>]',
            examples: [
              'kgen rules ls',
              'kgen rules ls --type compliance --details',
              'kgen rules ls --pattern gdpr --sort size'
            ]
          },
          {
            name: 'show',
            description: 'Show detailed information about a specific rule pack',
            usage: 'kgen rules show --name <pack-name> [--content] [--validate]',
            examples: [
              'kgen rules show --name sox-compliance',
              'kgen rules show --name inference-basic --content --rules',
              'kgen rules show --name validation-shacl --validate --format yaml'
            ]
          }
        ],
        capabilities: {
          types: ['compliance', 'inference', 'validation'],
          formats: ['n3', 'rules'],
          features: [
            'Pattern-based filtering',
            'Type categorization', 
            'Syntax validation',
            'Rule extraction',
            'Complexity analysis',
            'Prefix and import tracking'
          ]
        },
        reasoning: {
          forwardChaining: 'Rules with => implications',
          backwardChaining: 'Rules with <= implications or :- patterns',
          builtinFunctions: 'Support for log:, math:, string:, list:, time: functions'
        }
      },
      metadata: {
        version: '1.0.0',
        timestamp: this.getDeterministicDate().toISOString()
      }
    };

    console.log(JSON.stringify(result, null, 2));
  }
});