/**
 * Templates Command Group
 * 
 * Comprehensive template management system for Nunjucks/Jinja2 templates.
 * Provides discovery, analysis, validation, and metadata extraction capabilities.
 */

import { defineCommand } from 'citty';

// Import all subcommands
import lsCommand from './templates/ls.js';
import showCommand from './templates/show.js';
import validateCommand from './templates/validate.js';

export default defineCommand({
  meta: {
    name: 'templates',
    description: 'Comprehensive template management system'
  },
  subCommands: {
    ls: lsCommand,
    list: lsCommand, // Alias for ls
    show: showCommand,
    info: showCommand, // Alias for show
    validate: validateCommand,
    check: validateCommand // Alias for validate
  },
  async run({ args }) {
    try {
      // When called without subcommand, show help and available operations
      const result = {
        success: true,
        data: {
          tool: 'templates',
          description: 'Comprehensive template management system',
          usage: 'kgen templates <command> [options]',
          commands: [
            {
              name: 'ls',
              aliases: ['list'],
              description: 'List available templates with metadata and filtering',
              usage: 'kgen templates ls --pattern "api-*" --type njk --details',
              examples: [
                'kgen templates ls',
                'kgen templates ls --pattern "api-*"',
                'kgen templates ls --type njk --details',
                'kgen templates ls --sort modified --limit 10'
              ]
            },
            {
              name: 'show',
              aliases: ['info'],
              description: 'Show detailed information about specific template',
              usage: 'kgen templates show --name <template> [options]',
              examples: [
                'kgen templates show --name api-service',
                'kgen templates show --name api-service --content',
                'kgen templates show --name api-service --dependencies'
              ]
            },
            {
              name: 'validate',
              aliases: ['check'],
              description: 'Validate template frontmatter against schemas',
              usage: 'kgen templates validate [--name <template>] [options]',
              examples: [
                'kgen templates validate',
                'kgen templates validate --name api-service',
                'kgen templates validate --schema kgen --strict',
                'kgen templates validate --pattern "api-*" --format table'
              ]
            }
          ],
          features: [
            'Template discovery and indexing',
            'Frontmatter parsing and validation',
            'Dependency graph analysis',
            'Variable and block extraction',
            'Multiple template formats (njk, j2, ejs)',
            'Schema-based validation',
            'Performance metrics and caching',
            'Filtering and pagination'
          ],
          supportedFormats: ['njk', 'j2', 'ejs'],
          schemas: ['kgen', 'hygen', 'custom']
        },
        metadata: {
          version: '1.0.0',
          timestamp: this.getDeterministicDate().toISOString()
        }
      };

      console.log(JSON.stringify(result, null, 2));
      
    } catch (err) {
      const errorResult = {
        success: false,
        error: {
          code: 'TEMPLATES_COMMAND_ERROR',
          message: err.message,
          timestamp: this.getDeterministicDate().toISOString()
        }
      };
      
      console.error(JSON.stringify(errorResult, null, 2));
      process.exit(1);
    }
  }
});