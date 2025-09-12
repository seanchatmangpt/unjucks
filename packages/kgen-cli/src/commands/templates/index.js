/**
 * Templates Command Group
 * 
 * Commands for managing Nunjucks templates.
 */

import { defineCommand } from 'citty';

import lsCommand from './ls.js';
import showCommand from './show.js';
import showEnhancedCommand from './show-enhanced.js';
import validateCommand from './validate.js';

export default defineCommand({
  meta: {
    name: 'templates',
    description: 'Manage Nunjucks templates'
  },
  subCommands: {
    ls: lsCommand,
    show: showCommand,
    'show-enhanced': showEnhancedCommand,
    validate: validateCommand
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
          },
          {
            name: 'show-enhanced',
            description: 'Show enhanced template analysis with frontmatter metadata',
            usage: 'kgen templates show-enhanced --name api-service --validate --security'
          },
          {
            name: 'validate',
            description: 'Validate template frontmatter against schemas',
            usage: 'kgen templates validate --name api-service --schema kgen'
          }
        ]
      },
      timestamp: new Date().toISOString()
    };

    console.log(JSON.stringify(result, null, 2));
  }
});