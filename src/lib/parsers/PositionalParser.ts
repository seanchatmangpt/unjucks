import { TemplateScanner, TemplateVariable } from '../template-scanner.js';
import { Generator } from '../generator.js';
import { BackwardCompatibility } from './BackwardCompatibility.js';
import { ArgumentValidator, ValidationResult } from '../validation/ArgumentValidator.js';

export interface PositionalParserConfig {
  strict: boolean;
  maxPositionals: number;
  allowMixed: boolean;
  autoPrompt: boolean;
  validationMode: 'eager' | 'lazy';
  hygenCompatible: boolean;
  debugMode: boolean;
}

export interface ParsedArguments {
  positionals: string[];
  flags: Record<string, any>;
  variables: Record<string, any>;
  metadata: {
    source: 'positional' | 'flag' | 'interactive' | 'config' | 'default';
    precedence: number;
    isValid: boolean;
    errors: string[];
    parseStrategy: 'unjucks' | 'hygen' | 'mixed';
  };
}

export interface ParseContext {
  generator?: string;
  template?: string;
  templatePath?: string;
  variables: TemplateVariable[];
  isHygenMode: boolean;
  strictMode: boolean;
  originalArgs: string[];
}

export interface PositionMapping {
  position: number;
  variableName: string;
  required: boolean;
  type: 'string' | 'boolean' | 'number';
  validator?: (value: string) => boolean;
  transformer?: (value: string) => any;
  description?: string;
}

export class PositionalParser {
  private config: PositionalParserConfig;
  private templateScanner: TemplateScanner;
  private validator: ArgumentValidator;
  private compatibilityLayer: BackwardCompatibility;
  private generator: Generator;

  // Default configuration
  private static readonly DEFAULT_CONFIG: PositionalParserConfig = {
    strict: false,
    maxPositionals: 10,
    allowMixed: true,
    autoPrompt: true,
    validationMode: 'lazy',
    hygenCompatible: true,
    debugMode: false,
  };

  constructor(config?: Partial<PositionalParserConfig>, generator?: Generator) {
    this.config = { ...PositionalParser.DEFAULT_CONFIG, ...config };
    this.templateScanner = new TemplateScanner();
    this.validator = new ArgumentValidator();
    this.compatibilityLayer = new BackwardCompatibility();
    this.generator = generator || new Generator();
  }

  /**
   * Main parsing entry point - determines strategy and parses arguments
   */
  async parse(args: string[], context: ParseContext): Promise<ParsedArguments> {
    try {
      // Determine parsing strategy
      const strategy = this.determineParsingStrategy(args, context);
      
      if (this.config.debugMode) {
        console.debug(`[PositionalParser] Using strategy: ${strategy}`);
        console.debug(`[PositionalParser] Input args:`, args);
        console.debug(`[PositionalParser] Context:`, context);
      }

      let result: ParsedArguments;

      // Parse based on determined strategy
      switch (strategy) {
        case 'hygen':
          result = await this.parseHygenStyle(args, context);
          break;
        case 'unjucks':
          result = await this.parseUnjucksStyle(args, context);
          break;
        case 'mixed':
          result = await this.parseMixedStyle(args, context);
          break;
        default:
          throw new Error(`Unknown parsing strategy: ${strategy}`);
      }

      result.metadata.parseStrategy = strategy;

      // Validate if in eager mode
      if (this.config.validationMode === 'eager') {
        const validation = await this.validateArguments(result, context);
        result.metadata.isValid = validation.isValid;
        result.metadata.errors = validation.errors;
      }

      return result;
    } catch (error) {
      return this.createErrorResult(error, args);
    }
  }

  /**
   * Parse Hygen-style commands: unjucks component new --name Button
   */
  async parseHygenStyle(args: string[], context?: ParseContext): Promise<ParsedArguments> {
    const result: ParsedArguments = this.createBaseResult();
    
    if (args.length < 2) {
      throw new Error('Hygen-style parsing requires at least generator and template');
    }

    const [generator, template, ...remainingArgs] = args;
    
    result.positionals = [generator, template];
    result.metadata.source = 'positional';
    result.metadata.precedence = 1; // Highest precedence

    // Parse remaining arguments as flags or additional positionals
    const { flags, additionalPositionals } = this.parseRemainingArgs(remainingArgs);
    
    result.flags = flags;
    result.positionals.push(...additionalPositionals);

    // Load template variables for mapping
    if (context?.variables || (generator && template)) {
      const variables = context?.variables || 
        await this.loadTemplateVariables(generator, template);
      
      result.variables = await this.mapPositionalArgsToVariables(
        additionalPositionals, 
        variables,
        flags
      );
    }

    return result;
  }

  /**
   * Parse Unjucks-style commands: unjucks generate component citty --name Button
   */
  async parseUnjucksStyle(args: string[], context?: ParseContext): Promise<ParsedArguments> {
    const result: ParsedArguments = this.createBaseResult();
    
    // Skip the 'generate' command if present
    const actualArgs = args[0] === 'generate' ? args.slice(1) : args;
    
    if (actualArgs.length < 2) {
      throw new Error('Unjucks-style parsing requires at least generator and template');
    }

    const [generator, template, ...remainingArgs] = actualArgs;
    
    result.positionals = [generator, template];
    result.metadata.source = 'positional';
    result.metadata.precedence = 1;

    // Parse flags
    const { flags, additionalPositionals } = this.parseRemainingArgs(remainingArgs);
    
    result.flags = flags;
    result.positionals.push(...additionalPositionals);

    // Load template variables for mapping
    if (context?.variables || (generator && template)) {
      const variables = context?.variables || 
        await this.loadTemplateVariables(generator, template);
      
      result.variables = await this.mapPositionalArgsToVariables(
        additionalPositionals,
        variables, 
        flags
      );
    }

    return result;
  }

  /**
   * Parse mixed-style commands with intelligent detection
   */
  async parseMixedStyle(args: string[], context?: ParseContext): Promise<ParsedArguments> {
    const result: ParsedArguments = this.createBaseResult();
    
    // Intelligent parsing based on argument patterns
    const parsedPositionals: string[] = [];
    const parsedFlags: Record<string, any> = {};
    
    let i = 0;
    while (i < args.length) {
      const arg = args[i];
      
      if (this.isFlag(arg)) {
        // Parse flag
        const { key, value, nextIndex } = this.parseFlag(args, i);
        parsedFlags[key] = value;
        i = nextIndex;
      } else {
        // Treat as positional
        parsedPositionals.push(arg);
        i++;
      }
    }

    result.positionals = parsedPositionals;
    result.flags = parsedFlags;
    result.metadata.source = 'positional';
    result.metadata.precedence = 1;

    // Map to template variables
    if (parsedPositionals.length >= 2) {
      const [generator, template, ...additionalPositionals] = parsedPositionals;
      
      if (context?.variables || (generator && template)) {
        const variables = context?.variables || 
          await this.loadTemplateVariables(generator, template);
        
        result.variables = await this.mapPositionalArgsToVariables(
          additionalPositionals,
          variables,
          parsedFlags
        );
      }
    }

    return result;
  }

  /**
   * Validate parsed arguments
   */
  async validateArguments(parsed: ParsedArguments, context?: ParseContext): Promise<ValidationResult> {
    return this.validator.validate(parsed, context);
  }

  /**
   * Transform parsed arguments to template variables
   */
  transformToVariables(parsed: ParsedArguments): Record<string, any> {
    const variables: Record<string, any> = {};
    
    // Merge variables from different sources with precedence
    Object.assign(variables, parsed.variables);  // From positional mapping
    Object.assign(variables, parsed.flags);      // From flags (higher precedence)
    
    return variables;
  }

  /**
   * Create position mappings for template variables
   */
  createPositionalMappings(variables: TemplateVariable[]): PositionMapping[] {
    const mappings: PositionMapping[] = [];
    
    // Sort variables by priority for positional mapping
    const sortedVariables = this.sortVariablesByPriority(variables);
    
    sortedVariables.forEach((variable, index) => {
      mappings.push({
        position: index,
        variableName: variable.name,
        required: variable.required || false,
        type: variable.type,
        validator: this.createValidator(variable),
        transformer: this.createTransformer(variable),
        description: variable.description,
      });
    });

    return mappings;
  }

  /**
   * Map positional arguments to template variables
   */
  private async mapPositionalArgsToVariables(
    positionalArgs: string[],
    variables: TemplateVariable[],
    flags: Record<string, any> = {}
  ): Promise<Record<string, any>> {
    const mappings = this.createPositionalMappings(variables);
    const result: Record<string, any> = {};

    // First, add all flags (they have precedence)
    Object.assign(result, flags);

    // Then map positional arguments
    positionalArgs.forEach((arg, index) => {
      const mapping = mappings[index];
      if (mapping && !result[mapping.variableName]) { // Don't override flags
        try {
          const transformedValue = mapping.transformer ? 
            mapping.transformer(arg) : 
            this.transformByType(arg, mapping.type);
          
          // Validate if validator exists
          if (mapping.validator && !mapping.validator(arg)) {
            throw new Error(`Invalid value for ${mapping.variableName}: ${arg}`);
          }
          
          result[mapping.variableName] = transformedValue;
        } catch (error) {
          // Log error but continue processing
          if (this.config.debugMode) {
            console.warn(`[PositionalParser] Error mapping ${mapping.variableName}:`, error);
          }
          result[mapping.variableName] = arg; // Fallback to raw value
        }
      } else if (!mapping) {
        // No specific mapping, use generic arg name
        const argName = `arg${index + 1}`;
        if (!result[argName]) {
          result[argName] = arg;
        }
      }
    });

    return result;
  }

  /**
   * Determine which parsing strategy to use
   */
  private determineParsingStrategy(args: string[], context?: ParseContext): 'hygen' | 'unjucks' | 'mixed' {
    // Check for explicit Unjucks commands
    if (args[0] === 'generate' || args[0] === 'list' || args[0] === 'init' || args[0] === 'version' || args[0] === 'help') {
      return 'unjucks';
    }

    // Check for Hygen-style pattern (generator template)
    if (args.length >= 2 && !this.isFlag(args[0]) && !this.isFlag(args[1])) {
      // Could be hygen style, check if mixed with flags
      const hasFlags = args.some(arg => this.isFlag(arg));
      if (hasFlags && this.config.allowMixed) {
        return 'mixed';
      }
      return 'hygen';
    }

    // Default to mixed if we allow it, otherwise unjucks
    return this.config.allowMixed ? 'mixed' : 'unjucks';
  }

  /**
   * Parse remaining arguments into flags and additional positionals
   */
  private parseRemainingArgs(args: string[]): { flags: Record<string, any>; additionalPositionals: string[] } {
    const flags: Record<string, any> = {};
    const additionalPositionals: string[] = [];
    
    let i = 0;
    while (i < args.length) {
      const arg = args[i];
      
      if (this.isFlag(arg)) {
        const { key, value, nextIndex } = this.parseFlag(args, i);
        flags[key] = value;
        i = nextIndex;
      } else {
        additionalPositionals.push(arg);
        i++;
      }
    }

    return { flags, additionalPositionals };
  }

  /**
   * Check if argument is a flag
   */
  private isFlag(arg: string): boolean {
    return arg.startsWith('--') || arg.startsWith('-');
  }

  /**
   * Parse a flag and its value
   */
  private parseFlag(args: string[], index: number): { key: string; value: any; nextIndex: number } {
    const arg = args[index];
    
    if (arg.includes('=')) {
      // Format: --key=value
      const [key, ...valueParts] = arg.split('=');
      const value = valueParts.join('=');
      return {
        key: this.normalizeKey(key),
        value: this.parseValue(value),
        nextIndex: index + 1
      };
    } else {
      // Format: --key value or boolean flag
      const key = this.normalizeKey(arg);
      const nextArg = args[index + 1];
      
      if (nextArg && !this.isFlag(nextArg)) {
        // Has value
        return {
          key,
          value: this.parseValue(nextArg),
          nextIndex: index + 2
        };
      } else {
        // Boolean flag
        return {
          key,
          value: true,
          nextIndex: index + 1
        };
      }
    }
  }

  /**
   * Normalize flag key
   */
  private normalizeKey(key: string): string {
    return key.replace(/^--?/, '');
  }

  /**
   * Parse and convert string values to appropriate types
   */
  private parseValue(value: string): any {
    // Try boolean
    if (value === 'true') return true;
    if (value === 'false') return false;
    
    // Try number
    const numValue = Number(value);
    if (!isNaN(numValue) && value !== '') return numValue;
    
    // Return as string
    return value;
  }

  /**
   * Load template variables for a given generator/template
   */
  private async loadTemplateVariables(generator: string, template: string): Promise<TemplateVariable[]> {
    try {
      const { variables } = await this.generator.scanTemplateForVariables(generator, template);
      return variables;
    } catch (error) {
      if (this.config.debugMode) {
        console.warn(`[PositionalParser] Could not load variables for ${generator}/${template}:`, error);
      }
      return [];
    }
  }

  /**
   * Sort variables by priority for positional mapping
   */
  private sortVariablesByPriority(variables: TemplateVariable[]): TemplateVariable[] {
    return [...variables].sort((a, b) => {
      // Required variables first
      if (a.required && !b.required) return -1;
      if (!a.required && b.required) return 1;
      
      // Then by common naming patterns
      const aPriority = this.getVariablePriority(a.name);
      const bPriority = this.getVariablePriority(b.name);
      
      if (aPriority !== bPriority) return bPriority - aPriority;
      
      // Finally by alphabetical order
      return a.name.localeCompare(b.name);
    });
  }

  /**
   * Get priority score for variable name (higher is more important)
   */
  private getVariablePriority(name: string): number {
    const lowerName = name.toLowerCase();
    
    if (lowerName === 'name') return 100;
    if (lowerName === 'type') return 90;
    if (lowerName === 'title') return 80;
    if (lowerName.includes('name')) return 70;
    if (lowerName.includes('path')) return 60;
    if (lowerName.includes('id')) return 50;
    
    return 0;
  }

  /**
   * Transform value by type
   */
  private transformByType(value: string, type: 'string' | 'boolean' | 'number'): any {
    switch (type) {
      case 'boolean':
        return value === 'true' || value === '1' || value === 'yes' || value === 'on';
      case 'number':
        const num = Number(value);
        return isNaN(num) ? value : num;
      case 'string':
      default:
        return value;
    }
  }

  /**
   * Create validator for variable
   */
  private createValidator(variable: TemplateVariable): ((value: string) => boolean) | undefined {
    if (variable.type === 'number') {
      return (value: string) => !isNaN(Number(value));
    }
    
    if (variable.type === 'boolean') {
      return (value: string) => ['true', 'false', '1', '0', 'yes', 'no', 'on', 'off'].includes(value.toLowerCase());
    }
    
    // String type or default - no specific validation
    return undefined;
  }

  /**
   * Create transformer for variable
   */
  private createTransformer(variable: TemplateVariable): ((value: string) => any) | undefined {
    return (value: string) => this.transformByType(value, variable.type);
  }

  /**
   * Create base result structure
   */
  private createBaseResult(): ParsedArguments {
    return {
      positionals: [],
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
   * Create error result
   */
  private createErrorResult(error: any, args: string[]): ParsedArguments {
    const result = this.createBaseResult();
    result.metadata.isValid = false;
    result.metadata.errors = [error.message || String(error)];
    result.positionals = args; // Include original args for debugging
    return result;
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<PositionalParserConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): PositionalParserConfig {
    return { ...this.config };
  }
}