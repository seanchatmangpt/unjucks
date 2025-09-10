/**
 * Hygen-style Argument Parser
 * 
 * Transforms Hygen-style positional arguments into structured command objects
 * Example: "unjucks component react Button --withTests" -> { generator: 'component', template: 'react', name: 'Button', flags: { withTests: true } }
 */

import { z } from 'zod';
import chalk from 'chalk';
import { CLIErrorIntegration } from '../core/error-integration.js';
import { CommandParseError } from '../core/errors.js';

// Validation schemas
const HygenStyleArgsSchema = z.object({
  generator: z.string().min(1),
  template: z.string().min(1),
  name: z.string().optional(),
  flags: z.record(z.any()).optional(),
  positionalArgs: z.array(z.string()).optional()
});

const ParsedCommandSchema = z.object({
  command: z.string(),
  subcommand: z.string().optional(),
  generator: z.string().optional(),
  template: z.string().optional(),
  name: z.string().optional(),
  flags: z.record(z.any()),
  positionalArgs: z.array(z.string()),
  originalArgs: z.array(z.string())
});

export class HygenArgumentParser {
  constructor() {
    this.supportedCommands = [
      'generate', 'new', 'preview', 'help', 'list', 'init', 'inject', 
      'version', 'semantic', 'swarm', 'workflow', 'perf', 'github', 
      'knowledge', 'neural', 'migrate'
    ];
  }

  /**
   * Parse command line arguments with Hygen-style positional support
   * @param {string[]} args - Raw command line arguments
   * @returns {Object} Parsed command structure
   */
  parse(args) {
    try {
      const originalArgs = [...args];
      
      if (args.length === 0) {
        return this.createParsedCommand('help', null, null, null, null, {}, [], originalArgs);
      }

      // Check if first argument is a known command
      const firstArg = args[0];
      if (this.supportedCommands.includes(firstArg)) {
        return this.parseExplicitCommand(args, originalArgs);
      }

      // Check for flags only (--help, --version, etc.)
      if (firstArg.startsWith('-')) {
        return this.parseFlagsOnly(args, originalArgs);
      }

      // Parse as Hygen-style positional arguments
      return this.parseHygenStyle(args, originalArgs);
    } catch (error) {
      // Use enhanced error handling
      const enhancedError = CLIErrorIntegration.enhanceParseError(error, this.supportedCommands);
      throw enhancedError;
    }
  }

  /**
   * Parse explicit command syntax: "unjucks generate component react"
   */
  parseExplicitCommand(args, originalArgs) {
    const command = args[0];
    const remaining = args.slice(1);
    
    if (command === 'generate' && remaining.length >= 2) {
      const [generator, template, ...rest] = remaining;
      const { name, flags, positionalArgs } = this.parseRestArgs(rest);
      
      return this.createParsedCommand(
        'generate', null, generator, template, name, flags, positionalArgs, originalArgs
      );
    }
    
    if (command === 'help' && remaining.length >= 2) {
      const [generator, template] = remaining;
      return this.createParsedCommand(
        'help', null, generator, template, null, {}, [], originalArgs
      );
    }

    // Other explicit commands
    const { flags, positionalArgs } = this.parseFlags(remaining);
    return this.createParsedCommand(
      command, null, null, null, null, flags, positionalArgs, originalArgs
    );
  }

  /**
   * Parse Hygen-style positional syntax: "unjucks component react Button"
   */
  parseHygenStyle(args, originalArgs) {
    if (args.length < 2) {
      throw new CommandParseError(
        args.join(' '), 
        ['unjucks <generator> <template> [name]', 'unjucks help', 'unjucks list'],
        { 
          reason: 'Hygen-style syntax requires at least generator and template',
          provided: args
        }
      );
    }

    const [generator, template, ...rest] = args;
    const { name, flags, positionalArgs } = this.parseRestArgs(rest);

    // Validate the parsed structure
    try {
      HygenStyleArgsSchema.parse({ generator, template, name, flags, positionalArgs });
    } catch (validationError) {
      throw new CommandParseError(
        args.join(' '),
        ['unjucks <generator> <template> [name]', `unjucks ${generator} <template> [name]`],
        {
          reason: `Invalid Hygen-style arguments: ${validationError.message}`,
          validationErrors: validationError.errors
        }
      );
    }

    return this.createParsedCommand(
      'generate', 'hygen-style', generator, template, name, flags, positionalArgs, originalArgs
    );
  }

  /**
   * Parse flags-only arguments: "--help", "--version"
   */
  parseFlagsOnly(args, originalArgs) {
    const { flags, positionalArgs } = this.parseFlags(args);
    
    if (flags.help || flags.h) {
      return this.createParsedCommand('help', null, null, null, null, flags, positionalArgs, originalArgs);
    }
    
    if (flags.version || flags.v) {
      return this.createParsedCommand('version', null, null, null, null, flags, positionalArgs, originalArgs);
    }

    return this.createParsedCommand('unknown', null, null, null, null, flags, positionalArgs, originalArgs);
  }

  /**
   * Parse remaining arguments after generator/template to extract name, flags, and additional args
   */
  parseRestArgs(args) {
    let name = null;
    const flags = {};
    const positionalArgs = [];
    
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      
      if (arg.startsWith('--')) {
        // Long flag: --withTests, --dest=./src
        const [flagName, flagValue] = arg.slice(2).split('=');
        flags[flagName] = flagValue || true;
      } else if (arg.startsWith('-')) {
        // Short flag: -f, -d ./src
        const flagName = arg.slice(1);
        const nextArg = args[i + 1];
        
        if (nextArg && !nextArg.startsWith('-')) {
          flags[flagName] = nextArg;
          i++; // Skip next argument
        } else {
          flags[flagName] = true;
        }
      } else if (name === null && !this.isLikelyFlag(arg)) {
        // First non-flag argument is the name
        name = arg;
      } else {
        // Additional positional arguments
        positionalArgs.push(arg);
      }
    }

    return { name, flags, positionalArgs };
  }

  /**
   * Parse flags from argument array
   */
  parseFlags(args) {
    const flags = {};
    const positionalArgs = [];

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      
      if (arg.startsWith('--')) {
        const [flagName, flagValue] = arg.slice(2).split('=');
        flags[flagName] = flagValue || true;
      } else if (arg.startsWith('-')) {
        const flagName = arg.slice(1);
        const nextArg = args[i + 1];
        
        if (nextArg && !nextArg.startsWith('-')) {
          flags[flagName] = nextArg;
          i++;
        } else {
          flags[flagName] = true;
        }
      } else {
        positionalArgs.push(arg);
      }
    }

    return { flags, positionalArgs };
  }

  /**
   * Check if argument looks like a flag value rather than a name
   */
  isLikelyFlag(arg) {
    // Could be expanded with more heuristics
    return arg.includes('=') || arg.includes('/') || arg.includes('.');
  }

  /**
   * Create standardized parsed command object
   */
  createParsedCommand(command, subcommand, generator, template, name, flags, positionalArgs, originalArgs) {
    const result = {
      command,
      subcommand,
      generator,
      template,
      name,
      flags: flags || {},
      positionalArgs: positionalArgs || [],
      originalArgs: originalArgs || []
    };

    try {
      return ParsedCommandSchema.parse(result);
    } catch (validationError) {
      console.warn(chalk.yellow(`Warning: Parsed command validation failed: ${validationError.message}`));
      return result; // Return anyway for graceful degradation
    }
  }

  /**
   * Create error result object
   */
  createErrorResult(args, error) {
    return {
      command: 'error',
      error: error.message,
      originalArgs: args,
      suggestion: this.generateSuggestion(args)
    };
  }

  /**
   * Generate helpful suggestions for malformed commands
   */
  generateSuggestion(args) {
    if (args.length === 1) {
      return `Did you mean: unjucks ${args[0]} <template> [name]?`;
    }
    
    if (args.length === 0) {
      return 'Try: unjucks list to see available generators';
    }

    return 'Use: unjucks help for usage information';
  }

  /**
   * Transform arguments from one style to another
   * @param {string[]} args - Original arguments
   * @param {string} targetStyle - 'explicit' or 'hygen'
   * @returns {string[]} Transformed arguments
   */
  transformStyle(args, targetStyle) {
    const parsed = this.parse(args);
    
    if (targetStyle === 'explicit' && parsed.generator && parsed.template) {
      const result = ['generate', parsed.generator, parsed.template];
      
      if (parsed.name) {
        result.push('--name', parsed.name);
      }
      
      // Add flags
      Object.entries(parsed.flags).forEach(([key, value]) => {
        if (value === true) {
          result.push(`--${key}`);
        } else {
          result.push(`--${key}=${value}`);
        }
      });
      
      return result;
    }
    
    if (targetStyle === 'hygen' && parsed.generator && parsed.template) {
      const result = [parsed.generator, parsed.template];
      
      if (parsed.name) {
        result.push(parsed.name);
      }
      
      // Add flags
      Object.entries(parsed.flags).forEach(([key, value]) => {
        if (value === true) {
          result.push(`--${key}`);
        } else {
          result.push(`--${key}=${value}`);
        }
      });
      
      return result;
    }

    return args; // Return original if transformation not possible
  }

  /**
   * Validate parsed command structure
   */
  validate(parsed) {
    const errors = [];
    
    if (parsed.command === 'generate' || parsed.subcommand === 'hygen-style') {
      if (!parsed.generator) {
        errors.push('Generator is required');
      }
      
      if (!parsed.template) {
        errors.push('Template is required');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Get help text for argument parsing
   */
  getHelpText() {
    return `
${chalk.blue.bold('Argument Parsing Styles:')}

${chalk.yellow('Hygen-style (recommended):')}
  unjucks component react Button --withTests
  unjucks api endpoint users --withAuth
  unjucks page dashboard AdminDashboard --typescript

${chalk.yellow('Explicit style:')}
  unjucks generate component react --name=Button --withTests
  unjucks generate api endpoint --name=users --withAuth

${chalk.yellow('Mixed style:')}
  unjucks component react --name=Button --withTests
  unjucks api endpoint --name=users --withAuth

${chalk.blue.bold('Supported Flags:')}
  --name=<value>     Component/file name
  --dest=<path>      Output destination
  --force           Overwrite existing files
  --dry             Dry run (preview only)
  --help, -h        Show help
  --version, -v     Show version

${chalk.blue.bold('Examples:')}
  unjucks component react MyButton
  unjucks component react MyButton --withTests --dest=./src/components
  unjucks generate component react --name=MyButton --withTests
    `;
  }
}

// Export singleton instance
export const argumentParser = new HygenArgumentParser();

// Export for testing
export { HygenStyleArgsSchema, ParsedCommandSchema };