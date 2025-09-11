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
    hash: () => import('./hash.js').then(m => m.default),
    diff: () => import('./diff.js').then(m => m.default),
    index: () => import('./index-cmd.js').then(m => m.default)
  },
  async run() {
    console.log('Available graph commands: hash, diff, index');
    console.log('Use: kgen graph <command> --help for specific help');
  }
});