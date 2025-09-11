/**
 * Variable syntax converter for Office document templates
 * 
 * This module provides conversion between different template variable syntaxes,
 * allowing seamless interoperability between different templating systems while
 * maintaining compatibility with Office document formats.
 * 
 * @module office/templates/syntax-converter
 * @version 1.0.0
 */

import {
  VariableSyntax,
  VariableLocation,
  ValidationResult,
  ErrorSeverity
} from '../core/types.js';
import { Logger } from '../utils/logger.js';

/**
 * Syntax conversion options
 */
export interface SyntaxConversionOptions {
  /** Source syntax */
  from: VariableSyntax;
  /** Target syntax */
  to: VariableSyntax;
  /** Whether to preserve original formatting */
  preserveFormatting?: boolean;
  /** Whether to validate conversion results */
  validate?: boolean;
  /** Custom variable name transformations */
  nameTransforms?: NameTransformation[];
  /** Variables to exclude from conversion */
  excludeVariables?: string[];
}

/**
 * Name transformation rule
 */
export interface NameTransformation {
  /** Pattern to match (regex) */
  pattern: RegExp;
  /** Replacement string */
  replacement: string;
  /** Description of transformation */
  description?: string;
}

/**
 * Syntax conversion result
 */
export interface SyntaxConversionResult {
  /** Converted content */
  content: string;
  /** Number of variables converted */
  variablesConverted: number;
  /** Conversion statistics */
  stats: ConversionStats;
  /** Validation result */
  validation: ValidationResult;
  /** Conversion warnings */
  warnings: string[];
}

/**
 * Conversion statistics
 */
export interface ConversionStats {
  /** Total variables found */
  totalVariables: number;
  /** Variables successfully converted */
  converted: number;
  /** Variables skipped */
  skipped: number;
  /** Variables that failed conversion */
  failed: number;
  /** Conversion time in milliseconds */
  duration: number;
}

/**
 * Variable syntax patterns and conversion rules
 */
const SYNTAX_PATTERNS = {
  [VariableSyntax.NUNJUCKS]: {
    pattern: /\{\{\s*([a-zA-Z_][a-zA-Z0-9_.]*?)(?:\s*\|\s*([^}]+?))?\s*\}\}/g,
    template: (name: string, filters?: string) => `{{${filters ? ` ${name} | ${filters} ` : ` ${name} `}}}`,
    description: 'Nunjucks/Jinja2 style: {{ variable }}'
  },
  [VariableSyntax.SIMPLE]: {
    pattern: /\{\s*([a-zA-Z_][a-zA-Z0-9_.]*?)\s*\}/g,
    template: (name: string) => `{${name}}`,
    description: 'Simple curly braces: {variable}'
  },
  [VariableSyntax.MUSTACHE]: {
    pattern: /\{\{\s*([a-zA-Z_][a-zA-Z0-9_.]*?)\s*\}\}/g,
    template: (name: string) => `{{${name}}}`,
    description: 'Mustache style: {{variable}}'
  },
  [VariableSyntax.HANDLEBARS]: {
    pattern: /\{\{\s*([a-zA-Z_][a-zA-Z0-9_.]*?)(?:\s+([^}]+?))?\s*\}\}/g,
    template: (name: string, helpers?: string) => `{{${helpers ? `${name} ${helpers}` : name}}}`,
    description: 'Handlebars style: {{variable}} or {{helper variable}}'
  }
};

/**
 * Built-in name transformations
 */
const BUILT_IN_TRANSFORMATIONS: Record<string, NameTransformation[]> = {
  camelToSnake: [{
    pattern: /([a-z])([A-Z])/g,
    replacement: '$1_$2',
    description: 'Convert camelCase to snake_case'
  }],
  snakeToCamel: [{
    pattern: /_([a-z])/g,
    replacement: (match, letter) => letter.toUpperCase(),
    description: 'Convert snake_case to camelCase'
  }],
  kebabToCamel: [{
    pattern: /-([a-z])/g,
    replacement: (match, letter) => letter.toUpperCase(),
    description: 'Convert kebab-case to camelCase'
  }],
  upperCase: [{
    pattern: /.*/,
    replacement: (match) => match.toUpperCase(),
    description: 'Convert to UPPER_CASE'
  }],
  lowerCase: [{
    pattern: /.*/,
    replacement: (match) => match.toLowerCase(),
    description: 'Convert to lower_case'
  }]
};

/**
 * Variable syntax converter
 * 
 * Provides comprehensive conversion between different template variable syntaxes
 * with support for filters, helpers, and custom transformations.
 */
export class SyntaxConverter {
  private readonly logger: Logger;
  
  /**
   * Creates a new syntax converter
   */
  constructor() {
    this.logger = Logger.createOfficeLogger('SyntaxConverter');
  }

  /**
   * Converts content from one variable syntax to another
   * 
   * @param content - Content to convert
   * @param options - Conversion options
   * @returns Promise resolving to conversion result
   */
  async convert(content: string, options: SyntaxConversionOptions): Promise<SyntaxConversionResult> {
    const startTime = Date.now();
    this.logger.debug(`Converting syntax from ${options.from} to ${options.to}`);
    
    try {
      const stats: ConversionStats = {
        totalVariables: 0,
        converted: 0,
        skipped: 0,
        failed: 0,
        duration: 0
      };
      
      const warnings: string[] = [];
      const sourcePattern = SYNTAX_PATTERNS[options.from];
      const targetSyntax = SYNTAX_PATTERNS[options.to];
      
      if (!sourcePattern || !targetSyntax) {
        throw new Error(`Unsupported syntax conversion: ${options.from} to ${options.to}`);
      }
      
      // Find all variables in source content
      const variables = this.extractVariables(content, options.from);
      stats.totalVariables = variables.length;
      
      if (variables.length === 0) {
        this.logger.info('No variables found for conversion');
        return {
          content,
          variablesConverted: 0,
          stats: { ...stats, duration: Date.now() - startTime },
          validation: { valid: true, errors: [], warnings: [] },
          warnings
        };
      }
      
      // Perform conversion
      let convertedContent = content;
      const conversions = new Map<string, string>();
      
      // Process each unique variable
      const uniqueVariables = new Map<string, { name: string; extras?: string }>>();
      
      for (const variable of variables) {
        const match = sourcePattern.pattern.exec(variable.reference || '');
        if (match) {
          const variableName = match[1];
          const extras = match[2]; // filters, helpers, etc.
          
          if (!options.excludeVariables?.includes(variableName)) {
            uniqueVariables.set(variable.reference!, { name: variableName, extras });
          }
        }
        sourcePattern.pattern.lastIndex = 0; // Reset regex
      }
      
      // Convert each unique variable
      for (const [original, { name, extras }] of uniqueVariables) {
        try {
          const transformedName = this.applyNameTransformations(name, options.nameTransforms);
          const converted = this.convertVariable(transformedName, extras, options.from, options.to);
          
          conversions.set(original, converted);
          stats.converted++;
          
        } catch (error) {
          this.logger.warn(`Failed to convert variable '${name}': ${error.message}`);
          warnings.push(`Failed to convert variable '${name}': ${error.message}`);
          stats.failed++;
        }
      }
      
      // Apply conversions to content
      for (const [original, converted] of conversions) {
        const regex = new RegExp(this.escapeRegex(original), 'g');
        convertedContent = convertedContent.replace(regex, converted);
      }
      
      stats.duration = Date.now() - startTime;
      
      // Validate conversion if requested
      const validation = options.validate 
        ? await this.validateConversion(content, convertedContent, options)
        : { valid: true, errors: [], warnings: [] };
      
      this.logger.info(`Conversion completed: ${stats.converted}/${stats.totalVariables} variables converted`);
      
      return {
        content: convertedContent,
        variablesConverted: stats.converted,
        stats,
        validation,
        warnings
      };
      
    } catch (error) {
      this.logger.error('Syntax conversion failed', error);
      throw error;
    }
  }

  /**
   * Converts a batch of contents with the same options
   * 
   * @param contents - Array of content strings to convert
   * @param options - Conversion options
   * @returns Promise resolving to array of conversion results
   */
  async convertBatch(contents: string[], options: SyntaxConversionOptions): Promise<SyntaxConversionResult[]> {
    this.logger.debug(`Converting batch of ${contents.length} contents`);
    
    const results: SyntaxConversionResult[] = [];
    
    for (let i = 0; i < contents.length; i++) {
      try {
        const result = await this.convert(contents[i], options);
        results.push(result);
      } catch (error) {
        this.logger.error(`Failed to convert content at index ${i}`, error);
        
        // Add failed result
        results.push({
          content: contents[i],
          variablesConverted: 0,
          stats: {
            totalVariables: 0,
            converted: 0,
            skipped: 0,
            failed: 0,
            duration: 0
          },
          validation: {
            valid: false,
            errors: [{
              message: error.message,
              code: 'CONVERSION_ERROR',
              severity: ErrorSeverity.ERROR
            }],
            warnings: []
          },
          warnings: [error.message]
        });
      }
    }
    
    return results;
  }

  /**
   * Detects the variable syntax used in content
   * 
   * @param content - Content to analyze
   * @returns Detected syntax or null if none found
   */
  detectSyntax(content: string): VariableSyntax | null {
    const syntaxCounts: Record<VariableSyntax, number> = {
      [VariableSyntax.NUNJUCKS]: 0,
      [VariableSyntax.SIMPLE]: 0,
      [VariableSyntax.MUSTACHE]: 0,
      [VariableSyntax.HANDLEBARS]: 0
    };
    
    // Count matches for each syntax
    for (const [syntax, { pattern }] of Object.entries(SYNTAX_PATTERNS)) {
      const matches = content.match(pattern);
      syntaxCounts[syntax as VariableSyntax] = matches ? matches.length : 0;
      pattern.lastIndex = 0; // Reset regex
    }
    
    // Find syntax with most matches
    let maxCount = 0;
    let detectedSyntax: VariableSyntax | null = null;
    
    for (const [syntax, count] of Object.entries(syntaxCounts)) {
      if (count > maxCount) {
        maxCount = count;
        detectedSyntax = syntax as VariableSyntax;
      }
    }
    
    return maxCount > 0 ? detectedSyntax : null;
  }

  /**
   * Gets conversion suggestions for improving compatibility
   * 
   * @param fromSyntax - Source syntax
   * @param toSyntax - Target syntax
   * @returns Array of suggestions
   */
  getConversionSuggestions(fromSyntax: VariableSyntax, toSyntax: VariableSyntax): string[] {
    const suggestions: string[] = [];
    
    // Syntax-specific suggestions
    if (fromSyntax === VariableSyntax.NUNJUCKS && toSyntax !== VariableSyntax.NUNJUCKS) {
      suggestions.push('Nunjucks filters will be lost in conversion - consider manual review');
    }
    
    if (fromSyntax === VariableSyntax.HANDLEBARS && toSyntax !== VariableSyntax.HANDLEBARS) {
      suggestions.push('Handlebars helpers will be lost in conversion - consider manual review');
    }
    
    if (toSyntax === VariableSyntax.SIMPLE) {
      suggestions.push('Simple syntax does not support filters or helpers');
    }
    
    // Office-specific suggestions
    suggestions.push('Test converted templates thoroughly in target Office applications');
    suggestions.push('Consider using escaping for special characters in Office documents');
    
    return suggestions;
  }

  /**
   * Extracts variables from content using specified syntax
   * 
   * @param content - Content to extract from
   * @param syntax - Variable syntax to use
   * @returns Array of variable locations
   */
  private extractVariables(content: string, syntax: VariableSyntax): VariableLocation[] {
    const pattern = SYNTAX_PATTERNS[syntax].pattern;
    const variables: VariableLocation[] = [];
    let match;
    
    while ((match = pattern.exec(content)) !== null) {
      variables.push({
        section: 'content',
        reference: match[0],
        position: match.index
      });
    }
    
    pattern.lastIndex = 0; // Reset regex
    return variables;
  }

  /**
   * Converts a single variable to target syntax
   * 
   * @param name - Variable name
   * @param extras - Additional syntax elements (filters, helpers)
   * @param fromSyntax - Source syntax
   * @param toSyntax - Target syntax
   * @returns Converted variable string
   */
  private convertVariable(name: string, extras: string | undefined, fromSyntax: VariableSyntax, toSyntax: VariableSyntax): string {
    const targetPattern = SYNTAX_PATTERNS[toSyntax];
    
    // Handle syntax-specific conversion logic
    switch (toSyntax) {
      case VariableSyntax.NUNJUCKS:
        // Convert filters if coming from compatible syntax
        if (fromSyntax === VariableSyntax.NUNJUCKS && extras) {
          return targetPattern.template(name, extras);
        }
        return targetPattern.template(name);
        
      case VariableSyntax.HANDLEBARS:
        // Convert helpers if coming from compatible syntax
        if (fromSyntax === VariableSyntax.HANDLEBARS && extras) {
          return targetPattern.template(name, extras);
        }
        return targetPattern.template(name);
        
      case VariableSyntax.SIMPLE:
      case VariableSyntax.MUSTACHE:
        // These syntaxes don't support extras
        return targetPattern.template(name);
        
      default:
        throw new Error(`Unsupported target syntax: ${toSyntax}`);
    }
  }

  /**
   * Applies name transformations to variable name
   * 
   * @param name - Original variable name
   * @param transformations - Transformations to apply
   * @returns Transformed variable name
   */
  private applyNameTransformations(name: string, transformations?: NameTransformation[]): string {
    if (!transformations || transformations.length === 0) {
      return name;
    }
    
    let transformedName = name;
    
    for (const transform of transformations) {
      if (typeof transform.replacement === 'function') {
        transformedName = transformedName.replace(transform.pattern, transform.replacement as any);
      } else {
        transformedName = transformedName.replace(transform.pattern, transform.replacement);
      }
    }
    
    return transformedName;
  }

  /**
   * Escapes regex special characters
   * 
   * @param str - String to escape
   * @returns Escaped string
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Validates conversion result
   * 
   * @param original - Original content
   * @param converted - Converted content
   * @param options - Conversion options
   * @returns Validation result
   */
  private async validateConversion(
    original: string, 
    converted: string, 
    options: SyntaxConversionOptions
  ): Promise<ValidationResult> {
    const errors: any[] = [];
    const warnings: any[] = [];
    
    // Check if conversion actually changed the content
    if (original === converted) {
      warnings.push({
        message: 'No changes made during conversion - check if variables exist in source syntax',
        code: 'NO_CHANGES_MADE'
      });
    }
    
    // Validate that target syntax variables are properly formed
    const targetVariables = this.extractVariables(converted, options.to);
    const targetPattern = SYNTAX_PATTERNS[options.to].pattern;
    
    for (const variable of targetVariables) {
      const match = targetPattern.pattern.exec(variable.reference || '');
      if (!match) {
        errors.push({
          message: `Invalid variable syntax in converted content: ${variable.reference}`,
          code: 'INVALID_CONVERTED_SYNTAX',
          severity: ErrorSeverity.ERROR
        });
      }
      targetPattern.pattern.lastIndex = 0; // Reset regex
    }
    
    // Check for potential data loss
    const sourceVariables = this.extractVariables(original, options.from);
    const sourceCount = sourceVariables.length;
    const targetCount = targetVariables.length;
    
    if (targetCount < sourceCount) {
      warnings.push({
        message: `Possible data loss: ${sourceCount} variables in source, ${targetCount} in target`,
        code: 'POSSIBLE_DATA_LOSS'
      });
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Gets available built-in name transformations
   * 
   * @returns Map of transformation names to transformation arrays
   */
  static getBuiltInTransformations(): Record<string, NameTransformation[]> {
    return { ...BUILT_IN_TRANSFORMATIONS };
  }

  /**
   * Creates a name transformation from pattern and replacement
   * 
   * @param pattern - Regex pattern
   * @param replacement - Replacement string or function
   * @param description - Optional description
   * @returns Name transformation
   */
  static createNameTransformation(
    pattern: RegExp, 
    replacement: string | ((match: string, ...args: any[]) => string), 
    description?: string
  ): NameTransformation {
    return {
      pattern,
      replacement: replacement as string,
      description
    };
  }

  /**
   * Gets syntax information for all supported syntaxes
   * 
   * @returns Map of syntax to pattern information
   */
  static getSyntaxInfo(): Record<VariableSyntax, { description: string; example: string }> {
    return {
      [VariableSyntax.NUNJUCKS]: {
        description: SYNTAX_PATTERNS[VariableSyntax.NUNJUCKS].description,
        example: '{{ userName | upper }}'
      },
      [VariableSyntax.SIMPLE]: {
        description: SYNTAX_PATTERNS[VariableSyntax.SIMPLE].description,
        example: '{userName}'
      },
      [VariableSyntax.MUSTACHE]: {
        description: SYNTAX_PATTERNS[VariableSyntax.MUSTACHE].description,
        example: '{{userName}}'
      },
      [VariableSyntax.HANDLEBARS]: {
        description: SYNTAX_PATTERNS[VariableSyntax.HANDLEBARS].description,
        example: '{{uppercase userName}}'
      }
    };
  }

  /**
   * Checks if two syntaxes are compatible (no data loss)
   * 
   * @param from - Source syntax
   * @param to - Target syntax
   * @returns Whether syntaxes are compatible
   */
  static areCompatible(from: VariableSyntax, to: VariableSyntax): boolean {
    // Same syntax is always compatible
    if (from === to) {
      return true;
    }
    
    // Simple conversions that lose no data
    const compatiblePairs = [
      [VariableSyntax.SIMPLE, VariableSyntax.MUSTACHE],
      [VariableSyntax.MUSTACHE, VariableSyntax.SIMPLE],
      [VariableSyntax.MUSTACHE, VariableSyntax.NUNJUCKS], // Basic variables only
      [VariableSyntax.MUSTACHE, VariableSyntax.HANDLEBARS] // Basic variables only
    ];
    
    return compatiblePairs.some(([a, b]) => 
      (from === a && to === b) || (from === b && to === a)
    );
  }
}
