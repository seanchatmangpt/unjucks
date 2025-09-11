/**
 * Templates Command Group
 * 
 * Commands for managing Nunjucks templates.
 */

import { defineCommand } from 'citty';

import lsCommand from './ls.js';
import showCommand from './show.js';

export default defineCommand({
  meta: {
    name: 'templates',
    description: 'Manage Nunjucks templates'
  },
  subCommands: {
    ls: lsCommand,
    show: showCommand
  },
  async run() {
    const result = {
      success: true,
      data: {
        tool: 'templates',
        description: 'Manage Nunjucks templates',
        verbs: [
          {
            name: 'ls',
            description: 'List available templates and their metadata',
            usage: 'kgen templates ls --pattern api-*'
          },
          {
            name: 'show',
            description: 'Show detailed information about specific template',
            usage: 'kgen templates show --name api-service'
          }
        ]
      },
      timestamp: new Date().toISOString()
    };

    console.log(JSON.stringify(result, null, 2));
  }
});