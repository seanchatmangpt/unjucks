import { ParsedArguments, PositionalParserConfig } from './PositionalParser.js';
import { Generator } from '../generator.js';
import { TemplateVariable } from '../template-scanner.js';

export interface CompatibilityOptions {
  enableLegacySupport: boolean;
  enableMigrationHints: boolean;
  allowBothFormats: boolean;
  strictCompatibility: boolean;
  autoMigrate: boolean;
  warnOnLegacyUsage: boolean;
}

export interface LegacyCommand {
  command: string[];
  format: 'unjucks-v1' | 'hygen' | 'custom';
  modernEquivalent: string[];
  migrationPath: MigrationStep[];
  deprecated?: boolean;
  removeInVersion?: string;
}

export interface MigrationStep {
  description: string;
  from: string;
  to: string;
  automatic: boolean;
  examples: string[];
}

export interface CompatibilityResult {
  isLegacyFormat: boolean;
  modernArgs: ParsedArguments;
  migrationHints: string[];
  warnings: string[];
  originalFormat: string;
}

export class BackwardCompatibility {
  private options: CompatibilityOptions;
  private generator: Generator;
  private legacyCommands: Map<string, LegacyCommand>;

  // Default compatibility options
  private static readonly DEFAULT_OPTIONS: CompatibilityOptions = {
    enableLegacySupport: true,
    enableMigrationHints: true,
    allowBothFormats: true,
    strictCompatibility: false,
    autoMigrate: false,
    warnOnLegacyUsage: true,
  };

  constructor(options?: Partial<CompatibilityOptions>, generator?: Generator) {
    this.options = { ...BackwardCompatibility.DEFAULT_OPTIONS, ...options };
    this.generator = generator || new Generator();
    this.legacyCommands = new Map();
    
    this.initializeLegacyCommands();
  }

  /**
   * Check if command uses legacy format and convert if needed
   */
  async processLegacyCommand(args: string[]): Promise<CompatibilityResult> {
    const result: CompatibilityResult = {
      isLegacyFormat: false,
      modernArgs: this.createModernArgs(args),
      migrationHints: [],
      warnings: [],
      originalFormat: 'modern'
    };

    // Check for legacy patterns
    const legacyPattern = this.detectLegacyPattern(args);
    
    if (legacyPattern) {
      result.isLegacyFormat = true;
      result.originalFormat = legacyPattern.format;
      
      if (this.options.enableLegacySupport) {
        // Convert to modern format
        result.modernArgs = await this.convertLegacyToModern(args, legacyPattern);
      }
      
      if (this.options.enableMigrationHints) {
        result.migrationHints = this.generateMigrationHints(legacyPattern);
      }
      
      if (this.options.warnOnLegacyUsage) {
        result.warnings = this.generateDeprecationWarnings(legacyPattern);
      }
    }

    return result;
  }

  /**
   * Convert legacy command format to modern ParsedArguments
   */
  async convertLegacyToModern(args: string[], legacyCommand: LegacyCommand): Promise<ParsedArguments> {
    switch (legacyCommand.format) {
      case 'unjucks-v1':
        return await this.convertUnjucksV1ToModern(args);
      case 'hygen':
        return await this.convertHygenToModern(args);
      case 'custom':
        return await this.convertCustomToModern(args, legacyCommand);
      default:
        return this.createModernArgs(args);
    }
  }

  /**
   * Convert old Unjucks v1 format to modern format
   */
  private async convertUnjucksV1ToModern(args: string[]): Promise<ParsedArguments> {
    const modernArgs = this.createModernArgs();
    
    // Old format: unjucks generate generator template --flags
    if (args.length >= 3 && args[0] === 'generate') {
      const [, generator, template, ...remainingArgs] = args;
      
      modernArgs.positionals = [generator, template];
      modernArgs.metadata.source = 'positional';
      modernArgs.metadata.precedence = 1;
      
      // Parse remaining arguments
      const { flags, additionalPositionals } = this.parseFlags(remainingArgs);
      modernArgs.flags = flags;
      modernArgs.positionals.push(...additionalPositionals);
      
      // Load template variables and map
      try {
        const { variables } = await this.generator.scanTemplateForVariables(generator, template);
        modernArgs.variables = this.mapArgsToVariables(flags, variables);
      } catch (error) {
        // Template not found, continue with raw arguments
        modernArgs.variables = flags;
      }
    }

    return modernArgs;
  }

  /**
   * Convert Hygen format to modern format
   */
  private async convertHygenToModern(args: string[]): Promise<ParsedArguments> {
    const modernArgs = this.createModernArgs();
    
    // Hygen format: generator template --flags
    if (args.length >= 2) {
      const [generator, template, ...remainingArgs] = args;
      
      modernArgs.positionals = [generator, template];
      modernArgs.metadata.source = 'positional';
      modernArgs.metadata.precedence = 1;
      
      // Parse remaining arguments
      const { flags, additionalPositionals } = this.parseFlags(remainingArgs);
      modernArgs.flags = flags;
      modernArgs.positionals.push(...additionalPositionals);
      
      // Load template variables and map
      try {
        const { variables } = await this.generator.scanTemplateForVariables(generator, template);
        modernArgs.variables = this.mapArgsToVariables(flags, variables, additionalPositionals);
      } catch (error) {
        // Template not found, continue with raw arguments
        modernArgs.variables = { ...flags };
        additionalPositionals.forEach((arg, index) => {
          modernArgs.variables[`arg${index + 1}`] = arg;
        });
      }
    }

    return modernArgs;
  }

  /**
   * Convert custom legacy format to modern format
   */
  private async convertCustomToModern(args: string[], legacyCommand: LegacyCommand): Promise<ParsedArguments> {
    const modernArgs = this.createModernArgs();
    
    // Apply custom conversion logic based on the legacy command definition
    // This would be implemented based on specific legacy formats encountered
    
    // For now, default to basic conversion
    modernArgs.positionals = args.filter(arg => !arg.startsWith('-'));
    const { flags } = this.parseFlags(args);
    modernArgs.flags = flags;
    modernArgs.variables = flags;
    
    return modernArgs;
  }

  /**
   * Detect if arguments match a legacy pattern
   */
  detectLegacyPattern(args: string[]): LegacyCommand | null {
    // Check for exact command matches
    const commandKey = args.slice(0, 3).join(' ');
    if (this.legacyCommands.has(commandKey)) {
      return this.legacyCommands.get(commandKey)!;
    }

    // Check for pattern matches
    for (const [, legacyCmd] of this.legacyCommands) {
      if (this.matchesPattern(args, legacyCmd)) {
        return legacyCmd;
      }
    }

    // Check for general legacy patterns
    if (this.isLegacyUnjucksV1(args)) {
      return {
        command: args,
        format: 'unjucks-v1',
        modernEquivalent: args,
        migrationPath: this.getUnjucksV1MigrationPath()
      };
    }

    if (this.isLegacyHygen(args)) {
      return {
        command: args,
        format: 'hygen',
        modernEquivalent: args,
        migrationPath: this.getHygenMigrationPath()
      };
    }

    return null;
  }

  /**
   * Check if command matches legacy Unjucks v1 format
   */
  private isLegacyUnjucksV1(args: string[]): boolean {
    // Old format patterns that we want to support
    return (
      args.length >= 3 &&
      args[0] === 'generate' &&
      !args[1].startsWith('-') &&
      !args[2].startsWith('-')
    );
  }

  /**
   * Check if command matches legacy Hygen format
   */
  private isLegacyHygen(args: string[]): boolean {
    // Hygen patterns: generator template [args...]
    return (
      args.length >= 2 &&
      !args[0].startsWith('-') &&
      !args[1].startsWith('-') &&
      args[0] !== 'generate' &&
      args[0] !== 'list' &&
      args[0] !== 'init' &&
      args[0] !== 'version' &&
      args[0] !== 'help'
    );
  }

  /**
   * Check if arguments match a specific legacy command pattern
   */
  private matchesPattern(args: string[], legacyCommand: LegacyCommand): boolean {
    const pattern = legacyCommand.command;
    
    if (args.length < pattern.length) {
      return false;
    }

    return pattern.every((patternPart, index) => {
      if (patternPart === '*') {
        return true; // Wildcard matches anything
      }
      return args[index] === patternPart;
    });
  }

  /**
   * Generate migration hints for legacy commands
   */
  generateMigrationHints(legacyCommand: LegacyCommand): string[] {
    const hints: string[] = [];
    
    hints.push(`Legacy ${legacyCommand.format} format detected.`);
    
    if (legacyCommand.modernEquivalent.length > 0) {
      hints.push(`Modern equivalent: ${legacyCommand.modernEquivalent.join(' ')}`);
    }

    legacyCommand.migrationPath.forEach(step => {
      if (step.automatic) {
        hints.push(`✓ ${step.description}`);
      } else {
        hints.push(`• ${step.description}`);
        if (step.examples.length > 0) {
          hints.push(`  Example: ${step.examples[0]}`);
        }
      }
    });

    if (this.options.autoMigrate) {
      hints.push('Automatically converted to modern format.');
    } else {
      hints.push('Consider migrating to the modern format for better performance.');
    }

    return hints;
  }

  /**
   * Generate deprecation warnings
   */
  generateDeprecationWarnings(legacyCommand: LegacyCommand): string[] {
    const warnings: string[] = [];
    
    if (legacyCommand.deprecated) {
      warnings.push(`⚠️  Command format '${legacyCommand.format}' is deprecated.`);
      
      if (legacyCommand.removeInVersion) {
        warnings.push(`⚠️  Support will be removed in version ${legacyCommand.removeInVersion}.`);
      }
    }

    if (!this.options.strictCompatibility) {
      warnings.push('💡 Enable strict compatibility mode for more rigorous legacy support.');
    }

    return warnings;
  }

  /**
   * Show migration hint to user
   */
  showMigrationHint(legacyCommand: string[], modernEquivalent: string[]): void {
    if (!this.options.enableMigrationHints) return;

    console.log('\n💡 Migration Hint:');
    console.log(`   Legacy: ${legacyCommand.join(' ')}`);
    console.log(`   Modern: ${modernEquivalent.join(' ')}`);
    console.log('   The modern format provides better performance and more features.\n');
  }

  /**
   * Initialize known legacy command patterns
   */
  private initializeLegacyCommands(): void {
    // Unjucks v1 patterns
    this.legacyCommands.set('generate * *', {
      command: ['generate', '*', '*'],
      format: 'unjucks-v1',
      modernEquivalent: ['generate', '*', '*'],
      migrationPath: this.getUnjucksV1MigrationPath()
    });

    // Common Hygen patterns
    this.legacyCommands.set('component new', {
      command: ['component', 'new'],
      format: 'hygen',
      modernEquivalent: ['generate', 'component', 'new'],
      migrationPath: this.getHygenMigrationPath()
    });

    this.legacyCommands.set('generator add', {
      command: ['generator', 'add'],
      format: 'hygen',
      modernEquivalent: ['generate', 'generator', 'add'],
      migrationPath: this.getHygenMigrationPath()
    });
  }

  /**
   * Get migration path for Unjucks v1
   */
  private getUnjucksV1MigrationPath(): MigrationStep[] {
    return [
      {
        description: 'Command structure remains the same',
        from: 'unjucks generate component citty',
        to: 'unjucks generate component citty',
        automatic: true,
        examples: ['unjucks generate component citty --name MyComponent']
      },
      {
        description: 'Enhanced positional arguments now supported',
        from: 'unjucks generate component citty --name MyComponent',
        to: 'unjucks component citty MyComponent',
        automatic: false,
        examples: ['unjucks component citty MyComponent --type button']
      }
    ];
  }

  /**
   * Get migration path for Hygen
   */
  private getHygenMigrationPath(): MigrationStep[] {
    return [
      {
        description: 'Direct Hygen-style commands now supported',
        from: 'hygen component new',
        to: 'unjucks component new',
        automatic: true,
        examples: ['unjucks component new MyComponent']
      },
      {
        description: 'All Hygen features available in Unjucks',
        from: 'hygen component new --name MyComponent',
        to: 'unjucks component new MyComponent',
        automatic: false,
        examples: ['unjucks component new MyComponent --type functional']
      }
    ];
  }

  /**
   * Parse flags from argument list
   */
  private parseFlags(args: string[]): { flags: Record<string, any>; additionalPositionals: string[] } {
    const flags: Record<string, any> = {};
    const additionalPositionals: string[] = [];
    
    let i = 0;
    while (i < args.length) {
      const arg = args[i];
      
      if (arg.startsWith('--') || arg.startsWith('-')) {
        if (arg.includes('=')) {
          const [key, ...valueParts] = arg.split('=');
          flags[key.replace(/^--?/, '')] = valueParts.join('=');
          i++;
        } else {
          const key = arg.replace(/^--?/, '');
          const nextArg = args[i + 1];
          
          if (nextArg && !nextArg.startsWith('-')) {
            flags[key] = nextArg;
            i += 2;
          } else {
            flags[key] = true;
            i++;
          }
        }
      } else {
        additionalPositionals.push(arg);
        i++;
      }
    }

    return { flags, additionalPositionals };
  }

  /**
   * Map arguments to template variables
   */
  private mapArgsToVariables(
    flags: Record<string, any>, 
    variables: TemplateVariable[],
    additionalPositionals: string[] = []
  ): Record<string, any> {
    const result: Record<string, any> = { ...flags };
    
    // Map additional positional arguments to variables
    additionalPositionals.forEach((arg, index) => {
      if (variables[index]) {
        const variable = variables[index];
        if (!result[variable.name]) {
          result[variable.name] = this.convertToType(arg, variable.type);
        }
      } else {
        result[`arg${index + 1}`] = arg;
      }
    });

    return result;
  }

  /**
   * Convert string value to appropriate type
   */
  private convertToType(value: string, type: 'string' | 'boolean' | 'number'): any {
    switch (type) {
      case 'boolean':
        return value === 'true' || value === '1' || value === 'yes';
      case 'number':
        const num = Number(value);
        return isNaN(num) ? value : num;
      case 'string':
      default:
        return value;
    }
  }

  /**
   * Create base modern args structure
   */
  private createModernArgs(originalArgs?: string[]): ParsedArguments {
    return {
      positionals: originalArgs ? originalArgs.filter(arg => !arg.startsWith('-')) : [],
      flags: {},
      variables: {},
      metadata: {
        source: 'positional',
        precedence: 1,
        isValid: true,
        errors: [],
        parseStrategy: 'mixed'
      }
    };
  }

  /**
   * Update compatibility options
   */
  updateOptions(newOptions: Partial<CompatibilityOptions>): void {
    this.options = { ...this.options, ...newOptions };
  }

  /**
   * Get current compatibility options
   */
  getOptions(): CompatibilityOptions {
    return { ...this.options };
  }

  /**
   * Add custom legacy command pattern
   */
  addLegacyCommand(key: string, command: LegacyCommand): void {
    this.legacyCommands.set(key, command);
  }

  /**
   * Remove legacy command pattern
   */
  removeLegacyCommand(key: string): boolean {
    return this.legacyCommands.delete(key);
  }

  /**
   * Get all registered legacy commands
   */
  getLegacyCommands(): Map<string, LegacyCommand> {
    return new Map(this.legacyCommands);
  }
}