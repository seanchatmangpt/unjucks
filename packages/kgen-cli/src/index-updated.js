/**
 * KGEN CLI Main Entry Point
 * 
 * Defines the citty command structure with noun-verb pattern:
 * kgen <tool> <verb> [options]
 * 
 * All commands output JSON for autonomous agent consumption.
 */

import { defineCommand } from 'citty';

// Import command groups
import artifactCommands from './commands/artifact/index.js';
import graphCommands from './commands/graph/index.js';
import projectCommands from './commands/project/index.js';
import cacheCommands from './commands/cache/index.js';
import templatesCommands from './commands/templates/index.js';
import rulesCommands from './commands/rules/index.js';
import metricsCommands from './commands/metrics/index.js';
import validateCommands from './commands/validate/citty-index.js';
import driftCommands from './commands/drift/citty-index.js';

export const main = defineCommand({
  meta: {
    name: 'kgen',
    version: '1.0.0',
    description: 'Knowledge Graph to Artifact Compilation Tool for Autonomous Agents'
  },
  args: {
    config: {
      type: 'string',
      description: 'Path to kgen.config.js file',
      alias: 'c'
    },
    verbose: {
      type: 'boolean',
      description: 'Enable verbose output for debugging',
      alias: 'v'
    },
    format: {
      type: 'string',
      description: 'Output format (json|yaml)',
      default: 'json',
      alias: 'f'
    }
  },
  subCommands: {
    artifact: artifactCommands,
    graph: graphCommands,
    project: projectCommands,
    cache: cacheCommands,
    templates: templatesCommands,
    rules: rulesCommands,
    metrics: metricsCommands,
    validate: validateCommands,
    drift: driftCommands
  },
  async run({ args }) {
    // Global help output in JSON format
    const result = {
      success: true,
      data: {
        name: 'kgen',
        version: '1.0.0',
        description: 'Knowledge Graph to Artifact Compilation Tool for Autonomous Agents',
        tools: [
          {
            name: 'artifact',
            description: 'Generate, validate, and explain artifacts from knowledge graphs',
            verbs: ['generate', 'drift', 'explain']
          },
          {
            name: 'graph',
            description: 'Process and analyze knowledge graphs',
            verbs: ['hash', 'diff', 'index']
          },
          {
            name: 'project',
            description: 'Project-level operations for reproducible builds',
            verbs: ['lock', 'attest']
          },
          {
            name: 'cache',
            description: 'Manage content-addressed cache',
            verbs: ['gc', 'ls', 'purge', 'show']
          },
          {
            name: 'templates',
            description: 'Manage Nunjucks templates',
            verbs: ['ls', 'show']
          },
          {
            name: 'rules',
            description: 'Manage N3.js rule packs',
            verbs: ['ls', 'show']
          },
          {
            name: 'metrics',
            description: 'Performance and usage metrics',
            verbs: ['export', 'report', 'baseline']
          },
          {
            name: 'validate',
            description: 'Comprehensive validation for artifacts, graphs, configs, templates, and provenance',
            verbs: ['artifacts', 'graph', 'config', 'templates', 'provenance']
          },
          {
            name: 'drift',
            description: 'Detect and analyze artifact drift with 100% accuracy',
            verbs: ['detect', 'report', 'baseline']
          }
        ],
        usage: 'kgen <tool> <verb> [options]',
        examples: [
          'kgen artifact generate --graph api-model.ttl --template api-service',
          'kgen graph hash --input knowledge.ttl',
          'kgen drift detect --verbose',
          'kgen validate artifacts --recursive --strict',
          'kgen project lock --output project.lock'
        ]
      },
      timestamp: new Date().toISOString()
    };

    console.log(JSON.stringify(result, null, 2));
  }
});