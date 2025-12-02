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
import initCommand from './commands/init.ts';
import artifactCommands from './commands/artifact/index.js';
import graphCommands from './commands/graph/index.js';
import projectCommands from './commands/project/index.js';
import cacheCommands from './commands/cache/index.js';
import templatesCommands from './commands/templates.js';
import rulesCommands from './commands/rules/index.js';
import metricsCommands from './commands/metrics/index.js';
import validateCommands from './commands/validate/index.js';
import driftCommands from './commands/drift/index.js';
import marketplaceCommands from './commands/marketplace/index.js';
import exploreCommands from './commands/explore/index.js';
import receiptCommands from './commands/receipt/index.ts';
import lintCommand from './commands/lint.js';

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
    init: initCommand,
    artifact: artifactCommands,
    graph: graphCommands,
    project: projectCommands,
    cache: cacheCommands,
    templates: templatesCommands,
    rules: rulesCommands,
    metrics: metricsCommands,
    validate: validateCommands,
    drift: driftCommands,
    marketplace: marketplaceCommands,
    explore: exploreCommands,
    receipt: receiptCommands,
    lint: lintCommand
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
            name: 'init',
            description: 'Initialize new KGEN project with configuration',
            verbs: ['(default)']
          },
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
            name: 'validate',
            description: 'Validate graphs and artifacts with SHACL',
            verbs: ['graph', 'artifact']
          },
          {
            name: 'marketplace',
            description: 'Publish, search, and install knowledge packages',
            verbs: ['publish', 'search', 'install']
          },
          {
            name: 'explore',
            description: 'Interactive exploration with persona views',
            verbs: ['execute-view', 'list-views']
          },
          {
            name: 'receipt',
            description: 'Display attestation and provenance information',
            verbs: ['show']
          },
          {
            name: 'cache',
            description: 'Manage content-addressed cache',
            verbs: ['gc', 'ls', 'purge', 'show']
          },
          {
            name: 'templates',
            description: 'Comprehensive template management system',
            verbs: ['ls', 'show', 'validate']
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
          }
        ],
        usage: 'kgen <tool> <verb> [options]',
        examples: [
          'kgen init --name my-project --template enterprise',
          'kgen artifact generate --graph api-model.ttl --template api-service --attest',
          'kgen graph hash --input knowledge.ttl',
          'kgen artifact drift --check dist/',
          'kgen validate graph --input schema.ttl --shacl validation.ttl',
          'kgen marketplace search --query "financial api" --dim domain=Finance',
          'kgen marketplace publish --package ./dist --sign',
          'kgen explore execute-view --persona architect --graph project.ttl',
          'kgen receipt show --file generated-api.js --verify'
        ]
      },
      timestamp: this.getDeterministicDate().toISOString()
    };

    console.log(JSON.stringify(result, null, 2));
  }
});