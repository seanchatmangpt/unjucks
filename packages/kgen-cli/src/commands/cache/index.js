import { defineCommand } from 'citty'
import gcCommand from './gc.js'
import lsCommand from './ls.js'
import purgeCommand from './purge.js'
import showCommand from './show.js'

export default defineCommand({
  meta: {
    name: 'cache',
    description: 'Manage content-addressed cache'
  },
  subCommands: {
    gc: gcCommand,
    ls: lsCommand,
    purge: purgeCommand,
    show: showCommand
  },
  async run({ args }) {
    const result = {
      success: true,
      data: {
        tool: 'cache',
        description: 'Manage content-addressed cache',
        verbs: ['gc', 'ls', 'purge', 'show'],
        usage: 'kgen cache <verb> [options]',
        examples: [
          'kgen cache ls',
          'kgen cache gc --maxAge 30d',
          'kgen cache show <cache-key>',
          'kgen cache purge --force'
        ]
      },
      timestamp: new Date().toISOString()
    }
    
    console.log(JSON.stringify(result, null, 2))
  }
})