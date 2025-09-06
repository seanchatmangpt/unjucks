import { ParsedArguments, ParseContext } from '../parsers/PositionalParser.js';
import { TemplateVariable } from '../template-scanner.js';

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  suggestions: ValidationSuggestion[];
  metadata: ValidationMetadata;
}

export interface ValidationError {
  type: 'missing-required' | 'invalid-type' | 'invalid-value' | 'conflicting-args' | 'unknown-arg';
  field: string;
  message: string;
  severity: 'error' | 'warning';
  suggestion?: string;
  context?: any;
}

export interface ValidationWarning {
  type: 'deprecated' | 'unused-arg' | 'type-mismatch' | 'performance';
  field?: string;
  message: string;
  suggestion?: string;
}

export interface ValidationSuggestion {
  type: 'correction' | 'completion' | 'optimization';
  field?: string;
  suggestion: string;
  confidence: number; // 0-1
  example?: string;
}

export interface ValidationMetadata {
  validatedAt: Date;
  validationTime: number;
  rulesApplied: string[];
  skipReasons: string[];
  context: string;
}

export interface ArgumentValidationRule {
  name: string;
  priority: number;
  enabled: boolean;
  validate(args: ParsedArguments, context?: ParseContext): ValidationResult;
  canSkip?(args: ParsedArguments, context?: ParseContext): boolean;
}

export interface ValidationConfig {
  strict: boolean;
  failFast: boolean;
  enableSuggestions: boolean;
  enableWarnings: boolean;
  enableTypeCoercion: boolean;
  maxSuggestions: number;
  customRules: ValidationRule[];
}

export class ArgumentValidator {
  private config: ValidationConfig;
  private rules: Map<string, ValidationRule>;
  private customValidators: Map<string, CustomValidator>;

  // Default validation configuration
  private static readonly DEFAULT_CONFIG: ValidationConfig = {
    strict: false,
    failFast: false,
    enableSuggestions: true,
    enableWarnings: true,
    enableTypeCoercion: true,
    maxSuggestions: 5,
    customRules: [],
  };

  constructor(config?: Partial<ValidationConfig>) {
    this.config = { ...ArgumentValidator.DEFAULT_CONFIG, ...config };
    this.rules = new Map();
    this.customValidators = new Map();
    
    this.initializeBuiltInRules();
    this.registerCustomRules();
  }

  /**
   * Main validation entry point
   */
  async validate(args: ParsedArguments, context?: ParseContext): Promise<ValidationResult> {
    const startTime = performance.now();
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      suggestions: [],
      metadata: {
        validatedAt: new Date(),
        validationTime: 0,
        rulesApplied: [],
        skipReasons: [],
        context: context ? `${context.generator}/${context.template}` : 'unknown',
      },
    };

    try {
      // Get applicable rules
      const applicableRules = this.getApplicableRules(args, context);

      // Execute validation rules
      for (const rule of applicableRules) {
        if (this.config.failFast && result.errors.length > 0) {
          break;
        }

        // Check if rule can be skipped
        if (rule.canSkip && rule.canSkip(args, context)) {
          result.metadata.skipReasons.push(`Skipped ${rule.name}`);
          continue;
        }

        try {
          const ruleResult = await rule.validate(args, context);
          this.mergeValidationResults(result, ruleResult);
          result.metadata.rulesApplied.push(rule.name);
        } catch (error) {
          result.errors.push({
            type: 'unknown-arg',
            field: 'validation',
            message: `Validation rule '${rule.name}' failed: ${error}`,
            severity: 'error',
          });
        }
      }

      // Generate suggestions if enabled
      if (this.config.enableSuggestions && result.errors.length > 0) {
        const suggestions = await this.generateSuggestions(args, result.errors, context);
        result.suggestions.push(...suggestions.slice(0, this.config.maxSuggestions));
      }

      // Determine overall validity
      result.isValid = result.errors.filter(e => e.severity === 'error').length === 0;

    } catch (error) {
      result.isValid = false;
      result.errors.push({
        type: 'unknown-arg',
        field: 'validation',
        message: `Validation failed: ${error}`,
        severity: 'error',
      });
    }

    result.metadata.validationTime = performance.now() - startTime;
    return result;
  }

  /**
   * Validate specific field with custom rules
   */
  async validateField(
    fieldName: string,
    value: any,
    rules: string[],
    context?: any
  ): Promise<ValidationResult> {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      suggestions: [],
      metadata: {
        validatedAt: new Date(),
        validationTime: 0,
        rulesApplied: rules,
        skipReasons: [],
        context: `field:${fieldName}`,
      },
    };

    for (const ruleName of rules) {
      const validator = this.customValidators.get(ruleName);
      if (validator) {
        const ruleResult = await validator.validate(value, context);
        if (!ruleResult.isValid) {
          result.errors.push({
            type: 'invalid-value',
            field: fieldName,
            message: ruleResult.message,
            severity: 'error',
            suggestion: ruleResult.suggestion,
          });
        }
      }
    }

    result.isValid = result.errors.length === 0;
    return result;
  }

  /**
   * Validate template variables against their definitions
   */
  async validateVariables(
    variables: Record<string, any>,
    templateVariables: TemplateVariable[]
  ): Promise<ValidationResult> {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      suggestions: [],
      metadata: {
        validatedAt: new Date(),
        validationTime: 0,
        rulesApplied: ['variable-validation'],
        skipReasons: [],
        context: 'template-variables',
      },
    };

    // Check required variables
    for (const templateVar of templateVariables) {
      if (templateVar.required && variables[templateVar.name] === undefined) {
        result.errors.push({
          type: 'missing-required',
          field: templateVar.name,
          message: `Required variable '${templateVar.name}' is missing`,
          severity: 'error',
          suggestion: `Add --${templateVar.name}="value" to your command`,
        });
      }
    }

    // Check variable types
    for (const [varName, value] of Object.entries(variables)) {
      const templateVar = templateVariables.find(v => v.name === varName);
      if (templateVar) {
        const typeValidation = this.validateVariableType(varName, value, templateVar.type);
        if (!typeValidation.isValid) {
          result.errors.push({
            type: 'invalid-type',
            field: varName,
            message: typeValidation.message,
            severity: this.config.enableTypeCoercion ? 'warning' : 'error',
            suggestion: typeValidation.suggestion,
          });
        }
      } else {
        // Unknown variable
        if (this.config.strict) {
          result.errors.push({
            type: 'unknown-arg',
            field: varName,
            message: `Unknown variable '${varName}' - not defined in template`,
            severity: 'warning',
          });
        }
      }
    }

    result.isValid = result.errors.filter(e => e.severity === 'error').length === 0;
    return result;
  }

  /**
   * Initialize built-in validation rules
   */
  private initializeBuiltInRules(): void {
    // Required arguments validation
    this.addRule({
      name: 'required-args',
      priority: 100,
      enabled: true,
      validate: async (args: ParsedArguments, context?: ParseContext) => {
        const result = this.createEmptyResult();
        
        // Check for generator and template in positional args
        if (args.positionals.length < 2) {
          result.errors.push({
            type: 'missing-required',
            field: 'positionals',
            message: 'Generator and template names are required',
            severity: 'error',
            suggestion: 'Usage: unjucks <generator> <template> [args...]',
          });
        }

        return result;
      },
    });

    // Type validation rule
    this.addRule({
      name: 'type-validation',
      priority: 90,
      enabled: true,
      validate: async (args: ParsedArguments, context?: ParseContext) => {
        const result = this.createEmptyResult();
        
        if (context?.variables) {
          const variableValidation = await this.validateVariables(args.variables, context.variables);
          this.mergeValidationResults(result, variableValidation);
        }

        return result;
      },
    });

    // Conflicting arguments rule
    this.addRule({
      name: 'conflicting-args',
      priority: 80,
      enabled: true,
      validate: async (args: ParsedArguments) => {
        const result = this.createEmptyResult();
        
        // Check for conflicting flags
        const conflicts = [
          ['force', 'dry'],
          ['quiet', 'verbose'],
        ];

        for (const [flag1, flag2] of conflicts) {
          if (args.flags[flag1] && args.flags[flag2]) {
            result.errors.push({
              type: 'conflicting-args',
              field: `${flag1},${flag2}`,
              message: `Conflicting arguments: --${flag1} and --${flag2} cannot be used together`,
              severity: 'error',
              suggestion: `Choose either --${flag1} or --${flag2}`,
            });
          }
        }

        return result;
      },
    });

    // Performance warning rule
    this.addRule({
      name: 'performance-warnings',
      priority: 10,
      enabled: this.config.enableWarnings,
      validate: async (args: ParsedArguments) => {
        const result = this.createEmptyResult();
        
        // Warn about potentially slow operations
        if (args.flags.force && !args.flags.backup) {
          result.warnings.push({
            type: 'performance',
            message: 'Using --force without --backup can be risky',
            suggestion: 'Consider adding --backup for safety',
          });
        }

        return result;
      },
    });
  }

  /**
   * Register custom validation rules from config
   */
  private registerCustomRules(): void {
    for (const customRule of this.config.customRules) {
      this.addRule(customRule);
    }
  }

  /**
   * Get rules applicable to the current arguments and context
   */
  private getApplicableRules(args: ParsedArguments, context?: ParseContext): ValidationRule[] {
    return Array.from(this.rules.values())
      .filter(rule => rule.enabled)
      .sort((a, b) => b.priority - a.priority); // Higher priority first
  }

  /**
   * Validate variable type
   */
  private validateVariableType(
    name: string,
    value: any,
    expectedType: 'string' | 'boolean' | 'number'
  ): { isValid: boolean; message: string; suggestion?: string } {
    const actualType = typeof value;

    switch (expectedType) {
      case 'boolean':
        if (actualType === 'boolean') return { isValid: true, message: '' };
        if (typeof value === 'string') {
          const boolValues = ['true', 'false', '1', '0', 'yes', 'no', 'on', 'off'];
          if (boolValues.includes(value.toLowerCase())) {
            return { isValid: true, message: '' };
          }
        }
        return {
          isValid: false,
          message: `Variable '${name}' expects boolean, got ${actualType}`,
          suggestion: `Use true/false, 1/0, yes/no, or on/off for ${name}`,
        };

      case 'number':
        if (actualType === 'number') return { isValid: true, message: '' };
        if (typeof value === 'string' && !isNaN(Number(value))) {
          return { isValid: true, message: '' };
        }
        return {
          isValid: false,
          message: `Variable '${name}' expects number, got ${actualType}`,
          suggestion: `Use a numeric value for ${name}`,
        };

      case 'string':
        if (actualType === 'string') return { isValid: true, message: '' };
        return {
          isValid: false,
          message: `Variable '${name}' expects string, got ${actualType}`,
          suggestion: `Use a string value for ${name}`,
        };

      default:
        return { isValid: true, message: '' };
    }
  }

  /**
   * Generate helpful suggestions based on validation errors
   */
  private async generateSuggestions(
    args: ParsedArguments,
    errors: ValidationError[],
    context?: ParseContext
  ): Promise<ValidationSuggestion[]> {
    const suggestions: ValidationSuggestion[] = [];

    for (const error of errors) {
      switch (error.type) {
        case 'missing-required':
          suggestions.push({
            type: 'completion',
            field: error.field,
            suggestion: `Add the missing required argument: --${error.field}="value"`,
            confidence: 0.9,
            example: `unjucks ${args.positionals.join(' ')} --${error.field}="example"`,
          });
          break;

        case 'invalid-type':
          if (error.suggestion) {
            suggestions.push({
              type: 'correction',
              field: error.field,
              suggestion: error.suggestion,
              confidence: 0.8,
            });
          }
          break;

        case 'unknown-arg':
          // Suggest similar argument names
          const similar = this.findSimilarArguments(error.field, context?.variables || []);
          if (similar.length > 0) {
            suggestions.push({
              type: 'correction',
              field: error.field,
              suggestion: `Did you mean: ${similar.join(', ')}?`,
              confidence: 0.7,
            });
          }
          break;
      }
    }

    return suggestions;
  }

  /**
   * Find similar argument names using fuzzy matching
   */
  private findSimilarArguments(target: string, variables: TemplateVariable[]): string[] {
    const candidates = variables.map(v => v.name);
    
    return candidates
      .map(candidate => ({
        name: candidate,
        similarity: this.calculateSimilarity(target.toLowerCase(), candidate.toLowerCase()),
      }))
      .filter(item => item.similarity > 0.6)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 3)
      .map(item => item.name);
  }

  /**
   * Calculate string similarity using Levenshtein distance
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,      // deletion
          matrix[j - 1][i] + 1,      // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }

    const maxLen = Math.max(str1.length, str2.length);
    return maxLen === 0 ? 1 : 1 - matrix[str2.length][str1.length] / maxLen;
  }

  /**
   * Merge validation results
   */
  private mergeValidationResults(target: ValidationResult, source: ValidationResult): void {
    target.errors.push(...source.errors);
    target.warnings.push(...source.warnings);
    target.suggestions.push(...source.suggestions);
    target.metadata.rulesApplied.push(...source.metadata.rulesApplied);
  }

  /**
   * Create empty validation result
   */
  private createEmptyResult(): ValidationResult {
    return {
      isValid: true,
      errors: [],
      warnings: [],
      suggestions: [],
      metadata: {
        validatedAt: new Date(),
        validationTime: 0,
        rulesApplied: [],
        skipReasons: [],
        context: '',
      },
    };
  }

  /**
   * Add validation rule
   */
  addRule(rule: ValidationRule): void {
    this.rules.set(rule.name, rule);
  }

  /**
   * Remove validation rule
   */
  removeRule(name: string): boolean {
    return this.rules.delete(name);
  }

  /**
   * Add custom validator
   */
  addCustomValidator(name: string, validator: CustomValidator): void {
    this.customValidators.set(name, validator);
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<ValidationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Update rule states based on new config
    const performanceRule = this.rules.get('performance-warnings');
    if (performanceRule) {
      performanceRule.enabled = this.config.enableWarnings;
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): ValidationConfig {
    return { ...this.config };
  }
}

/**
 * Custom validator interface for extensible validation
 */
export interface CustomValidator {
  name: string;
  description: string;
  validate(value: any, context?: any): Promise<{ isValid: boolean; message: string; suggestion?: string }>;
}

/**
 * Built-in custom validators
 */
export class BuiltInValidators {
  static readonly nameValidator: CustomValidator = {
    name: 'validName',
    description: 'Validates that a name is a valid identifier',
    async validate(value: any): Promise<{ isValid: boolean; message: string; suggestion?: string }> {
      if (typeof value !== 'string') {
        return {
          isValid: false,
          message: 'Name must be a string',
        };
      }

      const namePattern = /^[A-Za-z][A-Za-z0-9_]*$/;
      if (!namePattern.test(value)) {
        return {
          isValid: false,
          message: 'Name must start with a letter and contain only letters, numbers, and underscores',
          suggestion: 'Use PascalCase or camelCase format',
        };
      }

      return { isValid: true, message: '' };
    },
  };

  static readonly pathValidator: CustomValidator = {
    name: 'validPath',
    description: 'Validates that a path is safe and well-formed',
    async validate(value: any): Promise<{ isValid: boolean; message: string; suggestion?: string }> {
      if (typeof value !== 'string') {
        return {
          isValid: false,
          message: 'Path must be a string',
        };
      }

      // Check for dangerous path patterns
      const dangerousPatterns = ['../', '../', '~/', '/etc/', '/usr/', '/var/'];
      if (dangerousPatterns.some(pattern => value.includes(pattern))) {
        return {
          isValid: false,
          message: 'Path contains potentially dangerous patterns',
          suggestion: 'Use relative paths within the project directory',
        };
      }

      return { isValid: true, message: '' };
    },
  };
}