/**
 * Command Routing and Dispatch System
 * 
 * Routes parsed commands to appropriate handlers and manages command execution flow
 */

import { z } from 'zod';
import chalk from 'chalk';
import { argumentParser } from './parser.js';
import { CLIErrorIntegration, ErrorRecoveryUtils } from '../core/error-integration.js';
import { ErrorHandler } from '../core/errors.js';

// Route configuration schema
const RouteConfigSchema = z.object({
  command: z.string(),
  handler: z.function(),
  aliases: z.array(z.string()).optional(),
  description: z.string(),
  examples: z.array(z.string()).optional(),
  flags: z.record(z.object({
    type: z.enum(['string', 'boolean', 'number']),
    description: z.string(),
    default: z.any().optional(),
    required: z.boolean().optional()
  })).optional()
});

export class CommandRouter {
  constructor() {
    this.routes = new Map();
    this.middleware = [];
    this.errorHandlers = [];
    this.setupDefaultRoutes();
  }

  /**
   * Register a command route
   * @param {Object} config - Route configuration
   */
  register(config) {
    try {
      const validConfig = RouteConfigSchema.parse(config);
      this.routes.set(validConfig.command, validConfig);
      
      // Register aliases
      if (validConfig.aliases) {
        validConfig.aliases.forEach(alias => {
          this.routes.set(alias, { ...validConfig, isAlias: true, aliasFor: validConfig.command });
        });
      }
    } catch (error) {
      throw new Error(`Invalid route configuration for ${config.command}: ${error.message}`);
    }
  }

  /**
   * Add middleware function
   * @param {Function} middleware - Middleware function
   */
  use(middleware) {
    if (typeof middleware !== 'function') {
      throw new Error('Middleware must be a function');
    }
    this.middleware.push(middleware);
  }

  /**
   * Add error handler
   * @param {Function} handler - Error handler function
   */
  onError(handler) {
    if (typeof handler !== 'function') {
      throw new Error('Error handler must be a function');
    }
    this.errorHandlers.push(handler);
  }

  /**
   * Route and execute a command
   * @param {string[]} args - Command line arguments
   * @returns {Promise<Object>} Execution result
   */
  async route(args) {
    return await CLIErrorIntegration.wrapCommand(async () => {
      // Parse arguments
      const parsed = argumentParser.parse(args);
      
      // Validate parsed command
      const validation = argumentParser.validate(parsed);
      if (!validation.isValid) {
        const enhancedError = CLIErrorIntegration.enhanceParseError(
          new Error(`Invalid command: ${validation.errors.join(', ')}`),
          Array.from(this.routes.keys()).filter(cmd => !this.routes.get(cmd).isAlias)
        );
        throw enhancedError;
      }

      // Apply middleware
      for (const middleware of this.middleware) {
        const result = await middleware(parsed);
        if (result === false) {
          return { success: false, message: 'Command blocked by middleware' };
        }
      }

      // Find route
      const route = this.findRoute(parsed.command);
      if (!route) {
        return this.handleUnknownCommand(parsed);
      }

      // Execute command with retry and recovery
      const context = this.createExecutionContext(parsed, route);
      const result = await ErrorRecoveryUtils.retryWithBackoff(
        () => this.executeCommand(route, context),
        2, // max retries
        500 // base delay
      );
      
      return {
        success: true,
        result,
        command: parsed.command,
        parsed
      };
      
    }, {
      command: args[0],
      args: args.slice(1),
      nonInteractive: process.env.CI === 'true' || process.argv.includes('--non-interactive'),
      continueOnError: process.argv.includes('--continue-on-error')
    });
  }

  /**
   * Find route by command name
   * @param {string} command - Command name
   * @returns {Object|null} Route configuration
   */
  findRoute(command) {
    const route = this.routes.get(command);
    
    if (route && route.isAlias) {
      return this.routes.get(route.aliasFor);
    }
    
    return route || null;
  }

  /**
   * Create execution context for command
   * @param {Object} parsed - Parsed command
   * @param {Object} route - Route configuration
   * @returns {Object} Execution context
   */
  createExecutionContext(parsed, route) {
    return {
      command: parsed.command,
      subcommand: parsed.subcommand,
      generator: parsed.generator,
      template: parsed.template,
      name: parsed.name,
      flags: this.processFlags(parsed.flags, route.flags),
      positionalArgs: parsed.positionalArgs,
      originalArgs: parsed.originalArgs,
      route,
      router: this
    };
  }

  /**
   * Process and validate flags against route configuration
   * @param {Object} inputFlags - Input flags
   * @param {Object} routeFlags - Route flag definitions
   * @returns {Object} Processed flags
   */
  processFlags(inputFlags, routeFlags) {
    if (!routeFlags) {
      return inputFlags;
    }

    const processed = {};
    
    // Process each defined flag
    Object.entries(routeFlags).forEach(([flagName, flagConfig]) => {
      const value = inputFlags[flagName];
      
      if (value !== undefined) {
        // Type conversion
        switch (flagConfig.type) {
          case 'number':
            processed[flagName] = Number(value);
            break;
          case 'boolean':
            processed[flagName] = Boolean(value);
            break;
          default:
            processed[flagName] = String(value);
        }
      } else if (flagConfig.default !== undefined) {
        processed[flagName] = flagConfig.default;
      } else if (flagConfig.required) {
        throw new Error(`Required flag --${flagName} is missing`);
      }
    });

    // Add any additional flags not defined in route
    Object.entries(inputFlags).forEach(([flagName, value]) => {
      if (!(flagName in processed)) {
        processed[flagName] = value;
      }
    });

    return processed;
  }

  /**
   * Execute command handler
   * @param {Object} route - Route configuration
   * @param {Object} context - Execution context
   * @returns {Promise<any>} Command result
   */
  async executeCommand(route, context) {
    try {
      return await route.handler(context);
    } catch (error) {
      error.command = context.command;
      error.context = context;
      throw error;
    }
  }

  /**
   * Handle unknown command with enhanced error reporting
   * @param {Object} parsed - Parsed command
   * @returns {Object} Error result
   */
  async handleUnknownCommand(parsed) {
    const availableCommands = Array.from(this.routes.keys()).filter(cmd => !this.routes.get(cmd).isAlias);
    const suggestions = CLIErrorIntegration.generateCommandSuggestions(parsed.command, availableCommands);
    
    // Use error handler for consistent reporting
    const { CommandParseError } = await import('../core/errors.js');
    const error = new CommandParseError(parsed.command, suggestions, {
      availableCommands,
      originalArgs: parsed.originalArgs
    });
    
    return this.handleError(error, parsed.originalArgs);
  }

  /**
   * Suggest similar command
   * @param {string} command - Unknown command
   * @returns {string|null} Suggested command
   */
  suggestCommand(command) {
    const commands = Array.from(this.routes.keys()).filter(cmd => !this.routes.get(cmd).isAlias);
    
    // Simple Levenshtein distance for suggestion
    let bestMatch = null;
    let bestDistance = Infinity;
    
    commands.forEach(cmd => {
      const distance = this.levenshteinDistance(command, cmd);
      if (distance < bestDistance && distance <= 2) {
        bestDistance = distance;
        bestMatch = cmd;
      }
    });
    
    return bestMatch;
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
   * Handle execution errors with comprehensive error handling
   * @param {Error} error - Error object
   * @param {string[]} args - Original arguments
   * @returns {Object} Error result
   */
  async handleError(error, args) {
    // Apply custom error handlers first
    for (const handler of this.errorHandlers) {
      try {
        const result = await handler(error, args);
        if (result) {
          return result;
        }
      } catch (handlerError) {
        console.error(chalk.red(`Error handler failed: ${handlerError.message}`));
      }
    }

    // Use comprehensive error handler
    try {
      const result = await ErrorHandler.handle(error, {
        interactive: !process.env.CI && !process.argv.includes('--non-interactive'),
        exitOnError: false // Router should not exit, let caller decide
      });
      
      if (result.recovered) {
        return {
          success: true,
          recovered: true,
          recoveryData: result.data || result.action,
          message: 'Error recovered successfully'
        };
      }
    } catch (handlingError) {
      console.error(chalk.red(`Error handling failed: ${handlingError.message}`));
    }

    // Fallback error response
    return {
      success: false,
      error: error.name || error.constructor.name || 'CommandError',
      message: error.message,
      code: error.code,
      details: error.details,
      stack: process.env.DEBUG ? error.stack : undefined
    };
  }

  /**
   * Get all registered routes
   * @returns {Map} Routes map
   */
  getRoutes() {
    return new Map(this.routes);
  }

  /**
   * Get route information for command
   * @param {string} command - Command name
   * @returns {Object|null} Route info
   */
  getRouteInfo(command) {
    const route = this.findRoute(command);
    if (!route) {
      return null;
    }

    return {
      command: route.command,
      description: route.description,
      examples: route.examples || [],
      flags: route.flags || {},
      aliases: route.aliases || []
    };
  }

  /**
   * Generate help text for all commands
   * @returns {string} Help text
   */
  generateHelp() {
    const commands = Array.from(this.routes.entries())
      .filter(([, route]) => !route.isAlias)
      .sort(([a], [b]) => a.localeCompare(b));

    let help = chalk.blue.bold('Available Commands:\n\n');

    commands.forEach(([command, route]) => {
      help += chalk.yellow(`  ${command.padEnd(12)}`);
      help += chalk.gray(route.description);
      
      if (route.aliases && route.aliases.length > 0) {
        help += chalk.dim(` (aliases: ${route.aliases.join(', ')})`);
      }
      
      help += '\n';
    });

    help += '\n' + chalk.blue.bold('Usage:\n');
    help += chalk.gray('  unjucks <command> [options]\n');
    help += chalk.gray('  unjucks <generator> <template> [name] [options]  # Hygen-style\n\n');
    help += chalk.gray('Use "unjucks help <command>" for detailed information about a command.\n');

    return help;
  }

  /**
   * Setup default middleware and error handlers
   */
  setupDefaultRoutes() {
    // Default error handler
    this.onError((error, args) => {
      if (error.message.includes('Unknown command')) {
        console.log(chalk.yellow('\nDid you mean one of these?'));
        console.log(this.generateHelp());
        return { success: false, showedHelp: true };
      }
      return null;
    });

    // Default middleware for logging
    this.use(async (parsed) => {
      if (process.env.DEBUG) {
        console.log(chalk.dim(`Executing: ${parsed.command}`), parsed);
      }
      return true;
    });
  }
}

// Export singleton instance
export const commandRouter = new CommandRouter();

// Export class for testing
export { RouteConfigSchema };