/**
 * Graph command group - Knowledge graph operations
 * Commands: kgen graph hash|diff|index
 */

import { defineCommand } from 'citty';

export default defineCommand({
  meta: {
    name: 'graph',
    description: 'Knowledge graph operations (hash, diff, index)'
  },
  subCommands: {
    hash: () => import('./hash.ts').then(m => m.default),
    diff: () => import('./diff.js').then(m => m.default),
    index: () => import('./index-cmd.js').then(m => m.default)
  },
  async run() {
    // Default help for graph tool - JSON output
    const result = {
      success: true,
      data: {
        tool: 'graph',
        description: 'Knowledge graph operations (hash, diff, index)',
        verbs: [
          {
            name: 'hash',
            description: 'Generate canonical CID hash of a knowledge graph',
            usage: 'kgen graph hash <file.ttl> [options]'
          },
          {
            name: 'diff',
            description: 'Compare two knowledge graphs and show differences',
            usage: 'kgen graph diff <file1.ttl> <file2.ttl> [options]'
          },
          {
            name: 'index',
            description: 'Index knowledge graph for fast querying',
            usage: 'kgen graph index <file.ttl> [options]'
          }
        ]
      },
      timestamp: this.getDeterministicDate().toISOString()
    };

    console.log(JSON.stringify(result, null, 2));
  }
});