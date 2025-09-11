/**
 * Cache Command Group
 * 
 * Commands for managing content-addressed cache.
 */

import { defineCommand } from 'citty';

import gcCommand from './gc.js';
import lsCommand from './ls.js';
import purgeCommand from './purge.js';
import showCommand from './show.js';

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
  async run() {
    const result = {
      success: true,
      data: {
        tool: 'cache',
        description: 'Manage content-addressed cache',
        verbs: [
          {
            name: 'gc',
            description: 'Run garbage collection to clean old cache entries',
            usage: 'kgen cache gc --max-age 90d'
          },
          {
            name: 'ls',
            description: 'List cache contents and statistics',
            usage: 'kgen cache ls --sort size'
          },
          {
            name: 'purge',
            description: 'Clear entire cache or specific entries',
            usage: 'kgen cache purge --all'
          },
          {
            name: 'show',
            description: 'Show detailed information about cache entry',
            usage: 'kgen cache show --hash <hash>'
          }
        ]
      },
      timestamp: new Date().toISOString()
    };

    console.log(JSON.stringify(result, null, 2));
  }
});