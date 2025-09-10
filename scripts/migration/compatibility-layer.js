/**
 * V2 to V3 Compatibility Layer
 * 
 * Provides backwards compatibility for v2 command syntax and patterns
 * Enables gradual migration without breaking existing workflows
 */

import chalk from 'chalk';
import { UnjucksEngine } from '../../src/core/engine.js';

/**
 * Compatibility layer that translates v2 commands to v3 equivalents
 */
export class CompatibilityLayer {
  constructor(options = {}) {
    this.options = {
      showDeprecationWarnings: true,
      enableLegacyCommands: true,
      strictMode: false,
      ...options
    };
    
    // Map v2 commands to v3 equivalents
    this.commandMappings = {
      'new': 'generate',
      'create': 'generate',
      'scaffold': 'generate',
      'make': 'generate'
    };
    
    // Map v2 argument patterns to v3 patterns
    this.argumentMappings = {
      // v2: unjucks new component react MyComponent
      // v3: unjucks generate component react --name MyComponent
      v2Pattern: /^(new|create|scaffold|make)\s+(\w+)\s+(\w+)\s+(.+)$/,
      v3Transform: (match) => {
        const [, command, generator, template, name] = match;
        return {
          command: 'generate',
          generator,
          template,
          args: { name: name.trim() }
        };
      }
    };
    
    this.deprecationWarnings = new Set();
  }

  /**
   * Process v2 command and convert to v3 format
   */
  processCommand(rawCommand, args = []) {
    // Handle string commands (CLI input)
    if (typeof rawCommand === 'string') {
      return this.processStringCommand(rawCommand);
    }
    
    // Handle object commands (programmatic input)
    return this.processObjectCommand(rawCommand, args);
  }

  /**
   * Process string-based commands from CLI
   */
  processStringCommand(commandString) {
    const trimmed = commandString.trim();
    
    // Check if this matches v2 pattern
    const match = trimmed.match(this.argumentMappings.v2Pattern);
    if (match) {
      const transformed = this.argumentMappings.v3Transform(match);
      
      // Show deprecation warning
      this.showDeprecationWarning(match[1], 'generate');
      
      return {
        isLegacy: true,
        originalCommand: commandString,
        transformedCommand: transformed,
        command: transformed.command,
        generator: transformed.generator,
        template: transformed.template,
        args: transformed.args
      };
    }
    
    // Check for simple command mapping
    const parts = trimmed.split(/\s+/);
    const [command, ...rest] = parts;
    
    if (this.commandMappings[command]) {
      this.showDeprecationWarning(command, this.commandMappings[command]);
      
      return {
        isLegacy: true,
        originalCommand: commandString,
        command: this.commandMappings[command],
        args: rest
      };
    }
    
    // No transformation needed
    return {
      isLegacy: false,
      command: command,
      args: rest
    };
  }

  /**
   * Process object-based commands from programmatic usage
   */
  processObjectCommand(commandObj, additionalArgs = []) {
    const { command, ...args } = commandObj;
    
    // Check if command needs mapping
    if (this.commandMappings[command]) {
      this.showDeprecationWarning(command, this.commandMappings[command]);
      
      return {
        isLegacy: true,
        originalCommand: commandObj,
        command: this.commandMappings[command],
        args: { ...args, ...this.parseAdditionalArgs(additionalArgs) }
      };
    }
    
    return {
      isLegacy: false,
      command,
      args: { ...args, ...this.parseAdditionalArgs(additionalArgs) }
    };
  }

  /**
   * Parse additional arguments into key-value pairs
   */
  parseAdditionalArgs(args) {
    const parsed = {};
    
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      
      if (arg.startsWith('--')) {
        const key = arg.slice(2);
        const nextArg = args[i + 1];
        
        if (nextArg && !nextArg.startsWith('--')) {
          parsed[key] = this.inferArgumentType(nextArg);
          i++; // Skip next argument as it's the value
        } else {
          parsed[key] = true; // Boolean flag
        }
      } else if (arg.startsWith('-')) {
        const key = arg.slice(1);
        parsed[key] = true;
      }
    }
    
    return parsed;
  }

  /**
   * Infer the type of an argument value
   */
  inferArgumentType(value) {
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (/^\d+$/.test(value)) return parseInt(value, 10);
    if (/^\d*\.\d+$/.test(value)) return parseFloat(value);
    return value;
  }

  /**
   * Show deprecation warning for v2 commands
   */
  showDeprecationWarning(oldCommand, newCommand) {
    if (!this.options.showDeprecationWarnings) return;
    
    const warningKey = `${oldCommand}->${newCommand}`;
    if (this.deprecationWarnings.has(warningKey)) return;
    
    this.deprecationWarnings.add(warningKey);
    
    console.warn(chalk.yellow('⚠️  DEPRECATION WARNING:'));
    console.warn(chalk.yellow(`   Command '${oldCommand}' is deprecated.`));
    console.warn(chalk.blue(`   Use '${newCommand}' instead.`));
    console.warn(chalk.gray(`   Example: unjucks ${newCommand} component react MyComponent`));
    console.warn();
  }

  /**
   * Create a backwards-compatible wrapper for the v3 engine
   */
  createV2CompatibleEngine(v3Engine) {
    return {
      // V2-style generate method
      async generate(generator, template, name, options = {}) {
        const transformed = this.processObjectCommand({
          command: 'generate',
          generator,
          template,
          name,
          ...options
        });
        
        return await v3Engine.generate({
          generator: transformed.args.generator || generator,
          template: transformed.args.template || template,
          ...transformed.args,
          ...options
        });
      },
      
      // V2-style new method (deprecated)
      async new(generator, template, name, options = {}) {
        this.showDeprecationWarning('new', 'generate');
        return this.generate(generator, template, name, options);
      },
      
      // V2-style create method (deprecated)
      async create(generator, template, name, options = {}) {
        this.showDeprecationWarning('create', 'generate');
        return this.generate(generator, template, name, options);
      },
      
      // Forward all other methods to v3 engine
      list: v3Engine.list?.bind(v3Engine),
      help: v3Engine.help?.bind(v3Engine),
      init: v3Engine.init?.bind(v3Engine),
      version: v3Engine.version?.bind(v3Engine)
    };
  }

  /**
   * Wrap v3 CLI to accept v2 commands
   */
  wrapV3CLI(v3CLIHandler) {
    return async (args) => {
      const commandString = args.join(' ');
      const processed = this.processStringCommand(commandString);
      
      if (processed.isLegacy) {
        // Convert back to args array for v3 CLI
        const newArgs = [processed.command];
        
        if (processed.generator) newArgs.push(processed.generator);
        if (processed.template) newArgs.push(processed.template);
        
        // Add transformed arguments
        if (processed.args) {
          Object.entries(processed.args).forEach(([key, value]) => {
            if (typeof value === 'boolean' && value) {
              newArgs.push(`--${key}`);
            } else if (typeof value !== 'boolean') {
              newArgs.push(`--${key}`, String(value));
            }
          });
        }
        
        return await v3CLIHandler(newArgs);
      }
      
      // Pass through unchanged
      return await v3CLIHandler(args);
    };
  }

  /**
   * Create migration report showing v2 → v3 equivalents
   */
  generateMigrationReport() {
    const report = {
      commandMappings: this.commandMappings,
      examples: [
        {
          v2: 'unjucks new component react MyButton',
          v3: 'unjucks generate component react --name MyButton',
          description: 'Generate a React component'
        },
        {
          v2: 'unjucks create api endpoint users',
          v3: 'unjucks generate api endpoint --name users',
          description: 'Generate an API endpoint'
        },
        {
          v2: 'unjucks scaffold model User',
          v3: 'unjucks generate model basic --name User',
          description: 'Generate a data model'
        }
      ],
      migrationSteps: [
        'Update command names: new/create/scaffold → generate',
        'Convert positional arguments to named flags',
        'Update template structure if needed',
        'Test with --dry-run flag',
        'Update documentation and scripts'
      ],
      compatibilityFeatures: [
        'Automatic command translation',
        'Deprecation warnings with suggestions',
        'Backwards-compatible API wrappers',
        'Migration validation tools'
      ]
    };
    
    return report;
  }

  /**
   * Validate v2 project for migration readiness
   */
  async validateV2Project(projectPath) {
    const validation = {
      isV2Project: false,
      readyForMigration: false,
      issues: [],
      recommendations: []
    };
    
    try {
      // Check for v2 indicators
      const packageJsonPath = path.join(projectPath, 'package.json');
      if (await fs.pathExists(packageJsonPath)) {
        const packageJson = await fs.readJson(packageJsonPath);
        
        // Look for v2 patterns
        const v2Indicators = [
          packageJson.scripts?.typecheck?.includes('tsc'),
          packageJson.devDependencies?.typescript,
          packageJson.scripts?.build?.includes('tsc')
        ];
        
        if (v2Indicators.some(Boolean)) {
          validation.isV2Project = true;
        }
      }
      
      // Check file structure
      const v2Paths = [
        'src/cli/commands',
        'src/lib/types',
        'config/vitest.config.js',
        'tsconfig.json'
      ];
      
      const existingPaths = [];
      for (const checkPath of v2Paths) {
        if (await fs.pathExists(path.join(projectPath, checkPath))) {
          existingPaths.push(checkPath);
        }
      }
      
      if (existingPaths.length > 0) {
        validation.isV2Project = true;
        validation.readyForMigration = existingPaths.length >= 2;
      }
      
      if (!validation.isV2Project) {
        validation.issues.push('Project does not appear to be Unjucks v2');
        validation.recommendations.push('Verify project structure and dependencies');
      }
      
      if (validation.isV2Project && !validation.readyForMigration) {
        validation.issues.push('Project structure is incomplete for migration');
        validation.recommendations.push('Ensure all v2 components are properly set up');
      }
      
    } catch (error) {
      validation.issues.push(`Validation failed: ${error.message}`);
    }
    
    return validation;
  }

  /**
   * Get compatibility status
   */
  getStatus() {
    return {
      enabledFeatures: {
        legacyCommands: this.options.enableLegacyCommands,
        deprecationWarnings: this.options.showDeprecationWarnings,
        strictMode: this.options.strictMode
      },
      commandMappings: this.commandMappings,
      warningsShown: Array.from(this.deprecationWarnings),
      statistics: {
        v2CommandsProcessed: this.deprecationWarnings.size,
        compatibilityEnabled: this.options.enableLegacyCommands
      }
    };
  }
}

// Export default instance for common usage
export const defaultCompatibilityLayer = new CompatibilityLayer();

// Helper functions for easy integration
export function createV2CompatibleEngine(v3Engine, options = {}) {
  const compatibility = new CompatibilityLayer(options);
  return compatibility.createV2CompatibleEngine(v3Engine);
}

export function wrapV3CLI(v3CLIHandler, options = {}) {
  const compatibility = new CompatibilityLayer(options);
  return compatibility.wrapV3CLI(v3CLIHandler);
}

export function processLegacyCommand(command, args = []) {
  return defaultCompatibilityLayer.processCommand(command, args);
}