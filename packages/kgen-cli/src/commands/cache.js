import { defineCommand } from 'citty'
import { getDeterministicISOString } from '../../../src/utils/deterministic-time.js'
import gcCommand from './cache/gc.js'
import lsCommand from './cache/ls.js'
import purgeCommand from './cache/purge.js'
import showCommand from './cache/show.js'
import statsCommand from './cache/stats.js'

export default defineCommand({
  meta: {
    name: 'cache',
    description: 'Manage content-addressed cache system'
  },
  subCommands: {
    gc: gcCommand,
    ls: lsCommand,
    purge: purgeCommand,
    show: showCommand,
    stats: statsCommand
  },
  async run({ args }) {
    const result = {
      success: true,
      data: {
        tool: 'cache',
        description: 'Manage content-addressed cache system',
        subcommands: ['gc', 'ls', 'purge', 'show', 'stats'],
        usage: 'kgen cache <subcommand> [options]',
        examples: [
          'kgen cache ls',
          'kgen cache stats --detailed',
          'kgen cache gc --maxAge 30d',
          'kgen cache show <cache-key>',
          'kgen cache purge --force'
        ]
      },
      timestamp: getDeterministicISOString()
    }
    
    console.log(JSON.stringify(result, null, 2))
  }
})