import type { TemplateVariable } from "./template-scanner.js";
import chalk from "chalk";

export interface PositionalParameter {
  name: string;
  position: number;
  required: boolean;
  type: "string" | "boolean" | "number";
  description?: string;
  defaultValue?: any;
}

export interface ParsedArguments {
  positional: Record<string, any>;
  flags: Record<string, any>;
  generator?: string;
  template?: string;
}

export interface ArgumentParserOptions {
  primaryParameters?: string[];
  supportedFlags?: Record<string, any>;
  templateVariables?: TemplateVariable[];
}

/**
 * ArgumentParser handles positional parameter parsing for CLI commands
 * Supports the pattern: unjucks generate <generator> <action> [name] [additional-params]
 */
export class ArgumentParser {
  constructor(private options: ArgumentParserOptions = {}) {}

  /**
   * Parse command line arguments into positional and flag-based parameters
   */
  parseArguments(args: any): ParsedArguments {
    const result: ParsedArguments = {
      positional: {},
      flags: {},
      generator: args.generator,
      template: args.template,
    };

    // Extract positional parameters from template variables
    const positionalParams = this.extractPositionalParameters();
    
    // Map positional arguments to template variables
    this.mapPositionalArguments(args, result, positionalParams);
    
    // Extract flag-based arguments
    this.extractFlagArguments(args, result);

    return result;
  }

  /**
   * Extract positional parameters from template variables
   * Prioritizes common parameters like 'name', 'componentName', etc.
   */
  extractPositionalParameters(): PositionalParameter[] {
    if (!this.options.templateVariables) {
      return [];
    }

    const positionalParams: PositionalParameter[] = [];
    const priorityOrder = [
      'name', 'componentName', 'commandName', 'fileName', 'className',
      'title', 'description', 'type', 'path', 'url'
    ];

    // Add primary parameters from options
    if (this.options.primaryParameters) {
      this.options.primaryParameters.forEach((name, index) => {
        const variable = this.options.templateVariables!.find(v => v.name === name);
        if (variable) {
          positionalParams.push({
            name,
            position: index + 2, // Start after generator and template
            required: variable.required || false,
            type: variable.type,
            description: variable.description,
            defaultValue: variable.defaultValue,
          });
        }
      });
    } else {
      // Auto-detect primary parameters based on priority
      let position = 2; // Start after generator and template
      
      for (const priorityName of priorityOrder) {
        const variable = this.options.templateVariables!.find(v => 
          v.name === priorityName || 
          v.name.toLowerCase().includes(priorityName.toLowerCase())
        );
        
        if (variable && !positionalParams.find(p => p.name === variable.name)) {
          positionalParams.push({
            name: variable.name,
            position: position++,
            required: variable.required || false,
            type: variable.type,
            description: variable.description,
            defaultValue: variable.defaultValue,
          });
          
          // Only add the first 3-4 most important parameters as positional
          if (position >= 6) break;
        }
      }
    }

    return positionalParams.sort((a, b) => a.position - b.position);
  }

  /**
   * Map positional arguments to template variables
   */
  private mapPositionalArguments(
    args: any,
    result: ParsedArguments,
    positionalParams: PositionalParameter[]
  ): void {
    // Check if we have stored original positional args in environment
    let commandArgs: string[] = [];
    
    if (process.env.UNJUCKS_POSITIONAL_ARGS) {
      try {
        const originalArgs = JSON.parse(process.env.UNJUCKS_POSITIONAL_ARGS);
        // Skip generator and template (first 2 args), get the rest as positional values
        commandArgs = originalArgs.slice(2).filter((arg: string) => !arg.startsWith('-'));
      } catch (e) {
        // Fallback to citty's _ array
        commandArgs = (args._ || []).filter((arg: string) => arg !== 'generate');
      }
    } else {
      // Fallback: use citty's parsed arguments
      const rawArgs = args._ || [];
      commandArgs = rawArgs.filter((arg: string) => arg !== 'generate');
    }
    
    // Map positional parameters to their values
    for (let i = 0; i < positionalParams.length; i++) {
      const param = positionalParams[i];
      
      if (i < commandArgs.length) {
        const value = commandArgs[i];
        result.positional[param.name] = this.parseValue(value, param.type);
      } else if (param.defaultValue !== undefined) {
        result.positional[param.name] = param.defaultValue;
      }
    }
  }

  /**
   * Extract flag-based arguments
   */
  private extractFlagArguments(args: any, result: ParsedArguments): void {
    const reservedKeys = ['generator', 'template', '_', 'dest', 'force', 'dry'];
    
    for (const [key, value] of Object.entries(args)) {
      if (!reservedKeys.includes(key) && !result.positional.hasOwnProperty(key)) {
        result.flags[key] = value;
      }
    }
  }

  /**
   * Parse string value to appropriate type
   */
  private parseValue(value: string, type: "string" | "boolean" | "number"): any {
    switch (type) {
      case "boolean":
        return value === "true" || value === "1" || value === "yes";
      case "number":
        const num = Number(value);
        return isNaN(num) ? 0 : num;
      case "string":
      default:
        return value;
    }
  }

  /**
   * Validate required positional parameters
   */
  validateArguments(parsed: ParsedArguments, positionalParams: PositionalParameter[]): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const param of positionalParams) {
      if (param.required && 
          parsed.positional[param.name] === undefined && 
          parsed.flags[param.name] === undefined) {
        errors.push(`Missing required parameter: ${param.name} (position ${param.position})`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Generate usage examples for positional parameters
   */
  generateUsageExamples(
    generator: string,
    template: string,
    positionalParams: PositionalParameter[]
  ): string[] {
    const examples: string[] = [];
    
    if (positionalParams.length === 0) {
      examples.push(`unjucks ${generator} ${template}`); // Hygen-style first
      examples.push(`unjucks generate ${generator} ${template}`);
      return examples;
    }

    // Hygen-style usage examples (preferred)
    const requiredParams = positionalParams.filter(p => p.required);
    if (requiredParams.length > 0) {
      const paramNames = requiredParams.map(p => `<${p.name}>`).join(' ');
      examples.push(`unjucks ${generator} ${template} ${paramNames}`); // Hygen-style
      examples.push(`unjucks generate ${generator} ${template} ${paramNames}`);
    }

    // Full usage with all parameters
    if (positionalParams.length > requiredParams.length) {
      const allParams = positionalParams.map(p => 
        p.required ? `<${p.name}>` : `[${p.name}]`
      ).join(' ');
      examples.push(`unjucks ${generator} ${template} ${allParams}`); // Hygen-style
      examples.push(`unjucks generate ${generator} ${template} ${allParams}`);
    }

    // Real-world example (Hygen-style preferred)
    const exampleValues = positionalParams.map(p => {
      switch (p.name.toLowerCase()) {
        case 'name': case 'componentname': return 'MyComponent';
        case 'commandname': return 'myCommand';
        case 'filename': return 'myFile';
        case 'classname': return 'MyClass';
        case 'title': return 'MyTitle';
        case 'description': return '"A description"';
        default: return p.defaultValue || 'value';
      }
    }).join(' ');
    
    if (exampleValues) {
      examples.push(`unjucks ${generator} ${template} ${exampleValues}`); // Hygen-style
    }

    return examples;
  }

  /**
   * Generate help text for positional parameters
   */
  generateHelpText(positionalParams: PositionalParameter[]): string {
    if (positionalParams.length === 0) {
      return chalk.gray("No positional parameters available for this template.");
    }

    let help = chalk.blue.bold("Positional Parameters:") + "\n";
    
    for (const param of positionalParams) {
      const required = param.required ? chalk.red(" (required)") : "";
      const type = chalk.gray(`[${param.type}]`);
      const position = chalk.yellow(`pos ${param.position}`);
      
      help += chalk.green(`  ${param.name}`) + ` ${type} ${position}${required}\n`;
      
      if (param.description) {
        help += chalk.gray(`    ${param.description}`) + "\n";
      }
      
      if (param.defaultValue !== undefined) {
        help += chalk.gray(`    Default: ${param.defaultValue}`) + "\n";
      }
      help += "\n";
    }

    return help;
  }
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Helper function to merge positional and flag arguments
 */
export function mergeArguments(
  positional: Record<string, any>,
  flags: Record<string, any>
): Record<string, any> {
  return { ...flags, ...positional }; // Positional takes precedence
}

/**
 * Helper function to detect if arguments contain positional parameters
 */
export function hasPositionalArguments(args: any): boolean {
  // Check if we have positional args stored in environment (Hygen-style syntax)
  if (process.env.UNJUCKS_POSITIONAL_ARGS) {
    try {
      const originalArgs = JSON.parse(process.env.UNJUCKS_POSITIONAL_ARGS);
      return originalArgs.length > 2; // More than just generator and template
    } catch (e) {
      // Fallback to citty's _ array
    }
  }
  
  return args._ && Array.isArray(args._) && args._.length > 0;
}