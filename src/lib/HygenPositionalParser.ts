/**
 * Enhanced Hygen-style positional parameter parser
 * Provides comprehensive support for Hygen CLI parity
 */

import { TemplateVariable } from './template-scanner.js';

export interface HygenParseResult {
  generator: string;
  template: string;
  variables: Record<string, any>;
  originalArgs: string[];
  parseStrategy: 'hygen-positional' | 'mixed' | 'traditional';
}

export interface HygenParserConfig {
  enableTypeInference: boolean;
  enableSpecialPatterns: boolean; // new, add, etc.
  maxPositionalArgs: number;
  strictMode: boolean;
}

export class HygenPositionalParser {
  private config: HygenParserConfig;
  
  // Common Hygen patterns
  private specialPatterns = new Set(['new', 'add', 'with', 'from']);
  
  // Variable name priority for positional mapping
  private variablePriority = [
    'name', 'title', 'type', 'id', 'key', 
    'path', 'component', 'entity', 'model'
  ];

  constructor(config?: Partial<HygenParserConfig>) {
    this.config = {
      enableTypeInference: true,
      enableSpecialPatterns: true,
      maxPositionalArgs: 10,
      strictMode: false,
      ...config
    };
  }

  /**
   * Parse Hygen-style command into structured result
   * Examples:
   * - unjucks component react MyComponent -> { generator: 'component', template: 'react', variables: { name: 'MyComponent' } }
   * - unjucks component new UserProfile --withTests -> { generator: 'component', template: 'new', variables: { name: 'UserProfile', withTests: true } }
   */
  parse(args: string[], templateVariables: TemplateVariable[] = []): HygenParseResult {
    if (args.length < 2) {
      throw new Error('Hygen-style parsing requires at least generator and template');
    }

    const [generator, template, ...remainingArgs] = args;
    
    // Separate positional args from flags
    const { positionalArgs, flagArgs } = this.separateArgsAndFlags(remainingArgs);
    
    // Map positional arguments to template variables
    const positionalVariables = this.mapPositionalArgsToVariables(
      positionalArgs, 
      templateVariables
    );
    
    // Parse flag arguments
    const flagVariables = this.parseFlagArguments(flagArgs);
    
    // Merge variables with positional taking precedence
    const variables = {
      ...flagVariables,
      ...positionalVariables
    };

    return {
      generator,
      template,
      variables,
      originalArgs: args,
      parseStrategy: this.determineParseStrategy(args, flagArgs.length > 0)
    };
  }

  /**
   * Separate positional arguments from flag arguments
   */
  private separateArgsAndFlags(args: string[]): { positionalArgs: string[]; flagArgs: string[] } {
    const positionalArgs: string[] = [];
    const flagArgs: string[] = [];
    
    let i = 0;
    while (i < args.length) {
      const arg = args[i];
      
      if (this.isFlag(arg)) {
        flagArgs.push(arg);
        
        // Check if next arg is the flag's value
        const nextArg = args[i + 1];
        if (nextArg && !this.isFlag(nextArg) && !arg.includes('=')) {
          flagArgs.push(nextArg);
          i += 2;
        } else {
          i += 1;
        }
      } else {
        positionalArgs.push(arg);
        i += 1;
      }
    }
    
    return { positionalArgs, flagArgs };
  }

  /**
   * Map positional arguments to template variables intelligently
   */
  private mapPositionalArgsToVariables(
    positionalArgs: string[], 
    templateVariables: TemplateVariable[]
  ): Record<string, any> {
    const variables: Record<string, any> = {};
    
    if (positionalArgs.length === 0) {
      return variables;
    }
    
    // Create priority-ordered list of template variables
    const orderedVariables = this.orderVariablesByPriority(templateVariables);
    
    // Map positional args to variables
    positionalArgs.forEach((arg, index) => {
      const targetVariable = orderedVariables[index];
      
      if (targetVariable) {
        // Use template variable name and type
        const value = this.config.enableTypeInference 
          ? this.inferType(arg, targetVariable.type)
          : arg;
        variables[targetVariable.name] = value;
      } else {
        // No specific template variable, use generic name
        variables[`arg${index + 1}`] = this.config.enableTypeInference 
          ? this.inferType(arg)
          : arg;
      }
    });
    
    // Handle special case: if first positional arg and no specific mapping, use 'name'
    if (positionalArgs.length > 0 && !variables.name && orderedVariables.length === 0) {
      variables.name = positionalArgs[0];
      
      // Map remaining args with generic names
      positionalArgs.slice(1).forEach((arg, index) => {
        variables[`arg${index + 2}`] = this.config.enableTypeInference 
          ? this.inferType(arg)
          : arg;
      });
    }
    
    return variables;
  }

  /**
   * Order template variables by priority for positional mapping
   */
  private orderVariablesByPriority(variables: TemplateVariable[]): TemplateVariable[] {
    return [...variables].sort((a, b) => {
      // Required variables first
      if (a.required && !b.required) return -1;
      if (!a.required && b.required) return 1;
      
      // Then by priority list
      const aPriority = this.variablePriority.indexOf(a.name.toLowerCase());
      const bPriority = this.variablePriority.indexOf(b.name.toLowerCase());
      
      if (aPriority !== -1 && bPriority !== -1) {
        return aPriority - bPriority;
      }
      if (aPriority !== -1) return -1;
      if (bPriority !== -1) return 1;
      
      // Finally alphabetical
      return a.name.localeCompare(b.name);
    });
  }

  /**
   * Parse flag arguments into variables
   */
  private parseFlagArguments(flagArgs: string[]): Record<string, any> {
    const variables: Record<string, any> = {};
    
    let i = 0;
    while (i < flagArgs.length) {
      const arg = flagArgs[i];
      
      if (this.isFlag(arg)) {
        const { key, value, consumed } = this.parseFlag(arg, flagArgs[i + 1]);
        variables[key] = value;
        i += consumed;
      } else {
        i += 1;
      }
    }
    
    return variables;
  }

  /**
   * Parse a single flag argument
   */
  private parseFlag(arg: string, nextArg?: string): { key: string; value: any; consumed: number } {
    if (arg.includes('=')) {
      // Format: --key=value
      const [key, ...valueParts] = arg.split('=');
      const value = valueParts.join('=');
      return {
        key: this.normalizeKey(key),
        value: this.config.enableTypeInference ? this.inferType(value) : value,
        consumed: 1
      };
    } else {
      // Format: --key value or boolean flag
      const key = this.normalizeKey(arg);
      
      if (nextArg && !this.isFlag(nextArg)) {
        // Has value
        return {
          key,
          value: this.config.enableTypeInference ? this.inferType(nextArg) : nextArg,
          consumed: 2
        };
      } else {
        // Boolean flag
        return {
          key,
          value: true,
          consumed: 1
        };
      }
    }
  }

  /**
   * Check if argument is a flag
   */
  private isFlag(arg: string): boolean {
    return arg.startsWith('--') || arg.startsWith('-');
  }

  /**
   * Normalize flag key (remove dashes)
   */
  private normalizeKey(key: string): string {
    return key.replace(/^--?/, '');
  }

  /**
   * Infer type of string value
   */
  private inferType(value: string, expectedType?: string): any {
    // Use expected type if provided
    if (expectedType) {
      switch (expectedType) {
        case 'boolean':
          return this.parseBoolean(value);
        case 'number':
          return this.parseNumber(value);
        case 'string':
        default:
          return value;
      }
    }
    
    // Auto-infer type
    if (this.looksLikeBoolean(value)) {
      return this.parseBoolean(value);
    }
    
    if (this.looksLikeNumber(value)) {
      return this.parseNumber(value);
    }
    
    return value;
  }

  /**
   * Check if value looks like a boolean
   */
  private looksLikeBoolean(value: string): boolean {
    const lowerValue = value.toLowerCase();
    return ['true', 'false', 'yes', 'no', '1', '0', 'on', 'off'].includes(lowerValue);
  }

  /**
   * Parse boolean value
   */
  private parseBoolean(value: string): boolean {
    const lowerValue = value.toLowerCase();
    return ['true', 'yes', '1', 'on'].includes(lowerValue);
  }

  /**
   * Check if value looks like a number
   */
  private looksLikeNumber(value: string): boolean {
    return !isNaN(Number(value)) && value.trim() !== '';
  }

  /**
   * Parse numeric value
   */
  private parseNumber(value: string): number {
    return Number(value);
  }

  /**
   * Determine parsing strategy used
   */
  private determineParseStrategy(args: string[], hasFlags: boolean): 'hygen-positional' | 'mixed' | 'traditional' {
    if (!hasFlags && args.length >= 2) {
      return 'hygen-positional';
    } else if (hasFlags) {
      return 'mixed';
    } else {
      return 'traditional';
    }
  }

  /**
   * Generate usage examples for given generator/template
   */
  generateUsageExamples(
    generator: string, 
    template: string, 
    templateVariables: TemplateVariable[]
  ): string[] {
    const examples: string[] = [];
    
    // Basic positional example
    const firstVar = templateVariables.find(v => 
      this.variablePriority.includes(v.name.toLowerCase())
    );
    
    if (firstVar) {
      const exampleValue = this.getExampleValue(firstVar);
      examples.push(`unjucks ${generator} ${template} ${exampleValue}`);
    }
    
    // Mixed example with flags
    if (templateVariables.length > 1) {
      const positionalVar = firstVar || templateVariables[0];
      const flagVar = templateVariables.find(v => v !== positionalVar);
      
      if (flagVar) {
        const positionalValue = this.getExampleValue(positionalVar);
        const flagValue = this.getExampleValue(flagVar);
        examples.push(`unjucks ${generator} ${template} ${positionalValue} --${flagVar.name}=${flagValue}`);
      }
    }
    
    return examples;
  }

  /**
   * Get example value for template variable
   */
  private getExampleValue(variable: TemplateVariable): string {
    switch (variable.type) {
      case 'boolean':
        return 'true';
      case 'number':
        return '42';
      default:
        if (variable.name.toLowerCase().includes('name')) {
          return 'MyComponent';
        }
        return `example${variable.name.charAt(0).toUpperCase()}${variable.name.slice(1)}`;
    }
  }

  /**
   * Validate parsed arguments
   */
  validate(result: HygenParseResult, templateVariables: TemplateVariable[]): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Check required variables
    for (const variable of templateVariables) {
      if (variable.required && !(variable.name in result.variables)) {
        errors.push(`Required variable '${variable.name}' is missing`);
      }
    }
    
    // Check positional argument count in strict mode
    if (this.config.strictMode) {
      const positionalCount = result.originalArgs.length - 2; // Subtract generator and template
      if (positionalCount > this.config.maxPositionalArgs) {
        errors.push(`Too many positional arguments (${positionalCount} > ${this.config.maxPositionalArgs})`);
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
}