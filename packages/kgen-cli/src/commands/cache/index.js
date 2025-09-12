import { defineCommand } from 'citty'
import gcCommand from './gc.js'
import lsCommand from './ls.js'
import purgeCommand from './purge.js'
import showCommand from './show.js'
import statsCommand from './stats.js'

export default defineCommand({
  meta: {
    name: 'cache',
    description: 'Manage content-addressed cache'
  },
  subCommands: {
    gc: gcCommand,
    ls: lsCommand,
    purge: purgeCommand,
    show: showCommand,
    stats: statsCommand
  },
  async run({ args }) {
    const { createStandardOutput } = await import('../../../../../src/kgen/cli/standardized-output.js');
    const output = createStandardOutput();
    
    return output.success('cache:help', {
      tool: 'cache',
      description: 'Manage content-addressed cache',
      verbs: ['gc', 'ls', 'purge', 'show', 'stats'],
      usage: 'kgen cache <verb> [options]',
      examples: [
        'kgen cache ls',
        'kgen cache stats --detailed',
        'kgen cache gc --maxAge 30d',
        'kgen cache show <cache-key>',
        'kgen cache purge --force'
      ]
    });
  }
})