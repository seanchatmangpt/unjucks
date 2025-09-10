/**
 * Dynamic Help System
 * 
 * Generates contextual help, examples, and documentation for commands and templates
 */

import chalk from 'chalk';
import { z } from 'zod';
import { TemplateScanner } from '../lib/template-scanner.js';
import { FrontmatterParser } from '../lib/frontmatter-parser.js';
import { argumentParser } from './parser.js';

// Help configuration schema
const HelpConfigSchema = z.object({
  command: z.string(),
  description: z.string(),
  usage: z.array(z.string()),
  examples: z.array(z.object({
    command: z.string(),
    description: z.string()
  })),
  flags: z.record(z.object({
    description: z.string(),
    type: z.string().optional(),
    default: z.any().optional(),
    required: z.boolean().optional()
  })).optional(),
  aliases: z.array(z.string()).optional(),
  notes: z.array(z.string()).optional()
});

export class HelpSystem {
  constructor() {
    this.templateScanner = new TemplateScanner();
    this.frontmatterParser = new FrontmatterParser();
    this.helpConfigs = new Map();
    this.setupDefaultHelp();
  }

  /**
   * Register help configuration for a command
   * @param {Object} config - Help configuration
   */
  register(config) {
    try {
      const validConfig = HelpConfigSchema.parse(config);
      this.helpConfigs.set(validConfig.command, validConfig);
    } catch (error) {
      throw new Error(`Invalid help configuration for ${config.command}: ${error.message}`);
    }
  }

  /**
   * Show help for a specific command
   * @param {string} command - Command name
   * @param {Object} context - Additional context
   * @returns {Promise<string>} Help text
   */
  async showHelp(command, context = {}) {
    if (command === 'template' && context.generator && context.template) {
      return this.showTemplateHelp(context.generator, context.template);
    }

    const config = this.helpConfigs.get(command);
    if (!config) {
      return this.showUnknownCommandHelp(command);
    }

    return this.formatCommandHelp(config);
  }

  /**
   * Show help for a specific template
   * @param {string} generator - Generator name
   * @param {string} template - Template name
   * @returns {Promise<string>} Template help text
   */
  async showTemplateHelp(generator, template) {
    try {
      const templatePath = await this.templateScanner.getTemplatePath(generator, template);
      const frontmatter = await this.frontmatterParser.parse(templatePath);
      const variables = await this.extractTemplateVariables(templatePath);

      return this.formatTemplateHelp(generator, template, frontmatter, variables);
    } catch (error) {
      return chalk.red(`Error loading template help: ${error.message}`);
    }
  }

  /**
   * Show contextual help based on current arguments
   * @param {string[]} args - Current arguments
   * @returns {Promise<string>} Contextual help
   */
  async showContextualHelp(args) {
    const parsed = argumentParser.parse(args);

    if (parsed.generator && !parsed.template) {
      return this.showGeneratorHelp(parsed.generator);
    }

    if (parsed.generator && parsed.template) {
      return this.showTemplateHelp(parsed.generator, parsed.template);
    }

    if (parsed.command && parsed.command !== 'help') {
      return this.showHelp(parsed.command);
    }

    return this.showGeneralHelp();
  }

  /**
   * Show help for a generator (list its templates)
   * @param {string} generator - Generator name
   * @returns {Promise<string>} Generator help text
   */
  async showGeneratorHelp(generator) {
    try {
      const templates = await this.templateScanner.getTemplatesForGenerator(generator);
      
      if (templates.length === 0) {
        return chalk.yellow(`No templates found for generator: ${generator}`);
      }

      let help = chalk.blue.bold(`📁 Generator: ${generator}\n\n`);
      help += chalk.yellow('Available templates:\n');

      for (const template of templates) {
        try {
          const frontmatter = await this.frontmatterParser.parse(template.path);
          const description = frontmatter?.description || 'No description';
          
          help += chalk.cyan(`  ${template.name.padEnd(20)}`);
          help += chalk.gray(description) + '\n';
        } catch (error) {
          help += chalk.cyan(`  ${template.name.padEnd(20)}`);
          help += chalk.gray('Template description unavailable') + '\n';
        }
      }

      help += '\n' + chalk.yellow('Usage:\n');
      help += chalk.gray(`  unjucks ${generator} <template> [name] [options]\n`);
      help += chalk.gray(`  unjucks generate ${generator} <template> --name=<name> [options]\n\n`);
      help += chalk.yellow('Examples:\n');
      help += chalk.gray(`  unjucks ${generator} ${templates[0].name} MyComponent\n`);
      help += chalk.gray(`  unjucks ${generator} ${templates[0].name} MyComponent --withTests\n\n`);
      help += chalk.dim('Use "unjucks help template ' + generator + ' <template>" for template-specific help.\n');

      return help;
    } catch (error) {
      return chalk.red(`Error loading generator help: ${error.message}`);
    }
  }

  /**
   * Show general help (overview of all commands)
   * @returns {string} General help text
   */
  showGeneralHelp() {
    let help = chalk.blue.bold('🌆 Unjucks CLI - Template Scaffolding Tool\n\n');
    
    help += chalk.yellow('USAGE:\n');
    help += chalk.gray('  unjucks <generator> <template> [name] [options]  # Hygen-style (recommended)\n');
    help += chalk.gray('  unjucks generate <generator> <template> [options]  # Explicit syntax\n');
    help += chalk.gray('  unjucks <command> [options]                      # Direct commands\n\n');

    help += chalk.yellow('QUICK START:\n');
    help += chalk.gray('  unjucks list                    # Show available generators\n');
    help += chalk.gray('  unjucks component react Button  # Generate a React component\n');
    help += chalk.gray('  unjucks help component          # Help for component generator\n\n');

    help += chalk.yellow('MAIN COMMANDS:\n');
    const mainCommands = [
      ['generate', 'Generate files from templates'],
      ['list', 'List available generators and templates'],
      ['help', 'Show help for commands or templates'],
      ['init', 'Initialize project with templates'],
      ['interactive', 'Start interactive mode']
    ];

    mainCommands.forEach(([cmd, desc]) => {
      help += chalk.cyan(`  ${cmd.padEnd(12)}`);
      help += chalk.gray(desc) + '\n';
    });

    help += '\n' + chalk.yellow('COMMON FLAGS:\n');
    const commonFlags = [
      ['--dest <path>', 'Output destination directory'],
      ['--force', 'Overwrite existing files'],
      ['--dry', 'Preview without writing files'],
      ['--help, -h', 'Show help'],
      ['--version, -v', 'Show version']
    ];

    commonFlags.forEach(([flag, desc]) => {
      help += chalk.cyan(`  ${flag.padEnd(15)}`);
      help += chalk.gray(desc) + '\n';
    });

    help += '\n' + chalk.yellow('EXAMPLES:\n');
    const examples = [
      'unjucks component react MyButton',
      'unjucks component react MyButton --withTests --dest=./src/components',
      'unjucks api endpoint users --withAuth',
      'unjucks page dashboard AdminPage --typescript',
      'unjucks list',
      'unjucks help component react'
    ];

    examples.forEach(example => {
      help += chalk.gray(`  ${example}\n`);
    });

    help += '\n' + chalk.dim('For more help: unjucks help <command> or unjucks help <generator> <template>\n');

    return help;
  }

  /**
   * Format command help
   * @param {Object} config - Help configuration
   * @returns {string} Formatted help text
   */
  formatCommandHelp(config) {
    let help = chalk.blue.bold(`📖 Command: ${config.command}\n\n`);
    
    help += chalk.gray(config.description) + '\n\n';

    if (config.usage && config.usage.length > 0) {
      help += chalk.yellow('USAGE:\n');
      config.usage.forEach(usage => {
        help += chalk.gray(`  ${usage}\n`);
      });
      help += '\n';
    }

    if (config.flags && Object.keys(config.flags).length > 0) {
      help += chalk.yellow('OPTIONS:\n');
      Object.entries(config.flags).forEach(([flag, flagConfig]) => {
        const flagDisplay = `--${flag}`;
        const typeDisplay = flagConfig.type ? ` <${flagConfig.type}>` : '';
        const defaultDisplay = flagConfig.default ? ` (default: ${flagConfig.default})` : '';
        const requiredDisplay = flagConfig.required ? chalk.red(' *required') : '';
        
        help += chalk.cyan(`  ${(flagDisplay + typeDisplay).padEnd(20)}`);
        help += chalk.gray(flagConfig.description + defaultDisplay + requiredDisplay) + '\n';
      });
      help += '\n';
    }

    if (config.examples && config.examples.length > 0) {
      help += chalk.yellow('EXAMPLES:\n');
      config.examples.forEach(example => {
        help += chalk.gray(`  ${example.command}\n`);
        if (example.description) {
          help += chalk.dim(`    ${example.description}\n`);
        }
      });
      help += '\n';
    }

    if (config.aliases && config.aliases.length > 0) {
      help += chalk.yellow('ALIASES:\n');
      help += chalk.gray(`  ${config.aliases.join(', ')}\n\n`);
    }

    if (config.notes && config.notes.length > 0) {
      help += chalk.yellow('NOTES:\n');
      config.notes.forEach(note => {
        help += chalk.dim(`  • ${note}\n`);
      });
      help += '\n';
    }

    return help;
  }

  /**
   * Format template help
   * @param {string} generator - Generator name
   * @param {string} template - Template name
   * @param {Object} frontmatter - Template frontmatter
   * @param {string[]} variables - Template variables
   * @returns {string} Formatted template help
   */
  formatTemplateHelp(generator, template, frontmatter, variables) {
    let help = chalk.blue.bold(`📄 Template: ${generator}/${template}\n\n`);
    
    if (frontmatter.description) {
      help += chalk.gray(frontmatter.description) + '\n\n';
    }

    help += chalk.yellow('USAGE:\n');
    help += chalk.gray(`  unjucks ${generator} ${template} <name> [options]\n`);
    help += chalk.gray(`  unjucks generate ${generator} ${template} --name=<name> [options]\n\n`);

    if (variables.length > 0) {
      help += chalk.yellow('TEMPLATE VARIABLES:\n');
      variables.forEach(variable => {
        const varConfig = frontmatter.variables?.[variable] || {};
        const type = varConfig.type || 'string';
        const description = varConfig.description || `${variable} value`;
        const defaultValue = varConfig.default ? ` (default: ${varConfig.default})` : '';
        const required = varConfig.required !== false ? chalk.red(' *required') : '';
        
        help += chalk.cyan(`  ${variable.padEnd(15)}`);
        help += chalk.gray(`${type} - ${description}${defaultValue}${required}\n`);
      });
      help += '\n';
    }

    if (frontmatter.flags) {
      help += chalk.yellow('SUPPORTED FLAGS:\n');
      Object.entries(frontmatter.flags).forEach(([flag, flagConfig]) => {
        const description = typeof flagConfig === 'string' ? flagConfig : flagConfig.description;
        help += chalk.cyan(`  --${flag.padEnd(15)}`);
        help += chalk.gray(description) + '\n';
      });
      help += '\n';
    }

    help += chalk.yellow('EXAMPLES:\n');
    help += chalk.gray(`  unjucks ${generator} ${template} MyComponent\n`);
    if (variables.length > 0) {
      const exampleVar = variables[0];
      help += chalk.gray(`  unjucks ${generator} ${template} MyComponent --${exampleVar}=someValue\n`);
    }
    help += chalk.gray(`  unjucks ${generator} ${template} MyComponent --dest=./src --force\n\n`);

    if (frontmatter.notes) {
      help += chalk.yellow('NOTES:\n');
      const notes = Array.isArray(frontmatter.notes) ? frontmatter.notes : [frontmatter.notes];
      notes.forEach(note => {
        help += chalk.dim(`  • ${note}\n`);
      });
      help += '\n';
    }

    return help;
  }

  /**
   * Show help for unknown command
   * @param {string} command - Unknown command
   * @returns {string} Unknown command help
   */
  showUnknownCommandHelp(command) {
    let help = chalk.red(`Unknown command: ${command}\n\n`);
    
    // Try to suggest similar commands
    const suggestions = this.findSimilarCommands(command);
    if (suggestions.length > 0) {
      help += chalk.yellow('Did you mean:\n');
      suggestions.forEach(suggestion => {
        help += chalk.gray(`  ${suggestion}\n`);
      });
      help += '\n';
    }

    help += chalk.yellow('Available commands:\n');
    Array.from(this.helpConfigs.keys()).forEach(cmd => {
      const config = this.helpConfigs.get(cmd);
      help += chalk.cyan(`  ${cmd.padEnd(12)}`);
      help += chalk.gray(config.description) + '\n';
    });

    help += '\n' + chalk.dim('Use "unjucks help <command>" for detailed information.\n');

    return help;
  }

  /**
   * Find similar commands using fuzzy matching
   * @param {string} command - Target command
   * @returns {string[]} Similar commands
   */
  findSimilarCommands(command) {
    const commands = Array.from(this.helpConfigs.keys());
    const suggestions = [];

    commands.forEach(cmd => {
      const distance = this.levenshteinDistance(command.toLowerCase(), cmd.toLowerCase());
      if (distance <= 2 && distance > 0) {
        suggestions.push(cmd);
      }
    });

    return suggestions.slice(0, 3); // Limit to top 3 suggestions
  }

  /**
   * Calculate Levenshtein distance between two strings
   * @param {string} a - First string
   * @param {string} b - Second string
   * @returns {number} Distance
   */
  levenshteinDistance(a, b) {
    const matrix = [];
    
    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[b.length][a.length];
  }

  /**
   * Extract variables from template content
   * @param {string} templatePath - Template file path
   * @returns {Promise<string[]>} Variables found in template
   */
  async extractTemplateVariables(templatePath) {
    try {
      const content = await this.templateScanner.readTemplate(templatePath);
      const variables = new Set();
      
      // Extract Nunjucks variables: {{ variable }}
      const variableMatches = content.match(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g);
      if (variableMatches) {
        variableMatches.forEach(match => {
          const variable = match.replace(/\{\{\s*|\s*\}\}/g, '');
          variables.add(variable);
        });
      }
      
      return Array.from(variables);
    } catch (error) {
      console.warn(chalk.yellow(`Warning: Could not extract variables from ${templatePath}`));
      return [];
    }
  }

  /**
   * Setup default help configurations
   */
  setupDefaultHelp() {
    // Generate command help
    this.register({
      command: 'generate',
      description: 'Generate files from templates using Hygen-style syntax',
      usage: [
        'unjucks generate <generator> <template> [options]',
        'unjucks <generator> <template> [name] [options]'
      ],
      examples: [
        {
          command: 'unjucks generate component react --name=Button',
          description: 'Generate a React component named Button'
        },
        {
          command: 'unjucks component react Button --withTests',
          description: 'Generate React component with tests (Hygen-style)'
        }
      ],
      flags: {
        name: {
          description: 'Component or file name',
          type: 'string',
          required: true
        },
        dest: {
          description: 'Output destination directory',
          type: 'string',
          default: './'
        },
        force: {
          description: 'Overwrite existing files',
          type: 'boolean',
          default: false
        },
        dry: {
          description: 'Preview without writing files',
          type: 'boolean',
          default: false
        }
      },
      aliases: ['gen', 'g']
    });

    // List command help
    this.register({
      command: 'list',
      description: 'List available generators and templates',
      usage: [
        'unjucks list',
        'unjucks list <generator>'
      ],
      examples: [
        {
          command: 'unjucks list',
          description: 'Show all generators and their templates'
        },
        {
          command: 'unjucks list component',
          description: 'Show templates for component generator'
        }
      ],
      aliases: ['ls', 'l']
    });

    // Help command help
    this.register({
      command: 'help',
      description: 'Show help for commands or templates',
      usage: [
        'unjucks help',
        'unjucks help <command>',
        'unjucks help template <generator> <template>'
      ],
      examples: [
        {
          command: 'unjucks help generate',
          description: 'Show help for generate command'
        },
        {
          command: 'unjucks help template component react',
          description: 'Show help for React component template'
        }
      ],
      aliases: ['h', '?']
    });
  }

  /**
   * Generate quick reference card
   * @returns {string} Quick reference text
   */
  generateQuickReference() {
    return `
${chalk.blue.bold('🚀 Unjucks Quick Reference')}

${chalk.yellow('Basic Usage:')}
  unjucks <generator> <template> [name]     ${chalk.gray('# Hygen-style')}
  unjucks generate <generator> <template>   ${chalk.gray('# Explicit')}

${chalk.yellow('Common Commands:')}
  unjucks list                              ${chalk.gray('# List generators')}
  unjucks component react Button            ${chalk.gray('# Generate component')}
  unjucks help component react              ${chalk.gray('# Template help')}

${chalk.yellow('Common Flags:')}
  --dest ./src        ${chalk.gray('# Output directory')}
  --force            ${chalk.gray('# Overwrite files')}
  --dry              ${chalk.gray('# Preview only')}
  --help             ${chalk.gray('# Show help')}

${chalk.gray('💡 Tip: Use "unjucks help" for full documentation')}
    `;
  }
}

// Export singleton instance
export const helpSystem = new HelpSystem();

// Export for testing
export { HelpConfigSchema };