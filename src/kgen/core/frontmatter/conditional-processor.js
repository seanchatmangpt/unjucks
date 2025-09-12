/**
 * KGEN Conditional Processor
 * 
 * Handles skipIf condition evaluation for frontmatter-driven templates.
 * Supports complex expressions, variable evaluation, and provenance tracking
 * of conditional decisions for audit trails.
 */

import { EventEmitter } from 'events';
import { Consola } from 'consola';

export class ConditionalProcessor extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      enableProvenance: true,
      enableComplexExpressions: true,
      maxExpressionLength: 500,
      allowedOperators: ['==', '!=', '===', '!==', '<', '>', '<=', '>=', '&&', '||', '!'],
      allowedFunctions: ['exists', 'empty', 'length', 'includes', 'startsWith', 'endsWith'],
      enableContextValidation: true,
      safeMode: true,
      ...options
    };
    
    this.logger = new Consola({ tag: 'kgen-conditional-processor' });
    this.evaluationHistory = [];
    this.expressionCache = new Map();
  }

  /**
   * Evaluate conditional logic from frontmatter
   * @param {Object} frontmatter - Parsed frontmatter
   * @param {Object} context - Template rendering context
   * @param {Object} options - Evaluation options
   * @returns {Promise<Object>} Evaluation result
   */
  async evaluate(frontmatter, context = {}, options = {}) {
    const operationId = options.operationId || this._generateOperationId();
    const startTime = this.getDeterministicTimestamp();
    
    try {
      // Extract skip condition from frontmatter
      const skipCondition = this._extractSkipCondition(frontmatter);
      
      if (!skipCondition) {
        // No skip condition, proceed with processing
        return {
          operationId,
          skip: false,
          reason: 'No skip condition specified',
          condition: null,
          evaluationResult: null,
          evaluationMetadata: {
            evaluationTime: this.getDeterministicTimestamp() - startTime,
            cacheHit: false
          }
        };
      }
      
      // Validate skip condition
      const conditionValidation = this._validateCondition(skipCondition);
      if (!conditionValidation.valid) {
        throw new Error(`Invalid skip condition: ${conditionValidation.errors.join(', ')}`);
      }
      
      // Generate cache key for deterministic evaluation
      const cacheKey = this._generateCacheKey(skipCondition, context);
      
      // Check cache if enabled
      if (options.useCache !== false && this.expressionCache.has(cacheKey)) {
        const cached = this.expressionCache.get(cacheKey);
        return {
          ...cached,
          operationId,
          evaluationMetadata: {
            ...cached.evaluationMetadata,
            cacheHit: true
          }
        };
      }
      
      // Evaluate the skip condition
      const evaluationResult = await this._evaluateExpression(skipCondition, context, options);
      
      // Determine if processing should be skipped
      const shouldSkip = this._interpretResult(evaluationResult);
      
      // Create evaluation metadata
      const evaluationMetadata = {
        evaluationTime: this.getDeterministicTimestamp() - startTime,
        cacheHit: false,
        expressionComplexity: this._calculateComplexity(skipCondition),
        usedVariables: evaluationResult.usedVariables || [],
        warnings: conditionValidation.warnings || []
      };
      
      const result = {
        operationId,
        skip: shouldSkip,
        reason: shouldSkip ? `Skip condition evaluated to true: ${skipCondition}` : 'Skip condition evaluated to false',
        condition: skipCondition,
        evaluationResult,
        evaluationMetadata
      };
      
      // Cache result if enabled
      if (options.useCache !== false) {
        this.expressionCache.set(cacheKey, result);
      }
      
      // Record in evaluation history for provenance
      if (this.options.enableProvenance) {
        this.evaluationHistory.push({
          operationId,
          timestamp: this.getDeterministicDate(),
          condition: skipCondition,
          context: this._sanitizeContext(context),
          result: shouldSkip,
          evaluationTime: evaluationMetadata.evaluationTime
        });
      }
      
      // Emit evaluation event
      this.emit('condition:evaluated', result);
      
      return result;
      
    } catch (error) {
      const errorResult = {
        operationId,
        skip: false,
        reason: `Condition evaluation failed: ${error.message}`,
        condition: frontmatter.skipIf || null,
        evaluationResult: null,
        evaluationMetadata: {
          evaluationTime: this.getDeterministicTimestamp() - startTime,
          cacheHit: false,
          errors: [error.message]
        }
      };
      
      this.emit('condition:error', { operationId, error, result: errorResult });
      
      // In safe mode, continue processing on evaluation errors
      if (this.options.safeMode) {
        this.logger.warn(`Condition evaluation failed, continuing: ${error.message}`);
        return errorResult;
      } else {
        throw error;
      }
    }
  }

  /**
   * Extract skip condition from frontmatter
   * @param {Object} frontmatter - Parsed frontmatter
   * @returns {string|null} Skip condition or null if not found
   */
  _extractSkipCondition(frontmatter) {
    if (!frontmatter || typeof frontmatter !== 'object') {
      return null;
    }
    
    // Support various skip condition formats
    const skipIf = frontmatter.skipIf || frontmatter.skip_if || frontmatter.when === false;
    
    if (!skipIf) {
      return null;
    }
    
    // Convert boolean to string expression
    if (typeof skipIf === 'boolean') {
      return skipIf.toString();
    }
    
    // Handle string conditions
    if (typeof skipIf === 'string') {
      return skipIf.trim();
    }
    
    return null;
  }

  /**
   * Validate skip condition syntax and security
   * @param {string} condition - Condition to validate
   * @returns {Object} Validation result
   */
  _validateCondition(condition) {
    const errors = [];
    const warnings = [];
    
    try {
      // Check condition length
      if (condition.length > this.options.maxExpressionLength) {
        errors.push(`Condition too long (${condition.length} > ${this.options.maxExpressionLength})`);
      }
      
      // Check for dangerous patterns in safe mode
      if (this.options.safeMode) {
        const dangerousPatterns = [
          /eval\s*\(/,
          /Function\s*\(/,
          /require\s*\(/,
          /import\s*\(/,
          /process\./,
          /global\./,
          /__proto__/,
          /constructor/,
          /prototype/
        ];
        
        for (const pattern of dangerousPatterns) {
          if (pattern.test(condition)) {
            errors.push(`Dangerous pattern detected: ${pattern.source}`);
          }
        }
      }
      
      // Check for complex expressions if disabled
      if (!this.options.enableComplexExpressions) {
        const complexPatterns = [/&&/, /\|\|/, /\(.*\)/, /\[.*\]/];
        for (const pattern of complexPatterns) {
          if (pattern.test(condition)) {
            errors.push(`Complex expressions not allowed: ${pattern.source}`);
          }
        }
      }
      
      // Validate operators
      const operatorRegex = new RegExp(`(${this.options.allowedOperators.map(op => 
        op.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      ).join('|')})`, 'g');
      
      const foundOperators = condition.match(/[=!<>]+|&&|\|\|/g) || [];
      for (const operator of foundOperators) {
        if (!this.options.allowedOperators.includes(operator)) {
          warnings.push(`Unknown operator: ${operator}`);
        }
      }
      
      // Check for function usage
      const functionRegex = /(\w+)\s*\(/g;
      let match;
      while ((match = functionRegex.exec(condition)) !== null) {
        const functionName = match[1];
        if (!this.options.allowedFunctions.includes(functionName)) {
          warnings.push(`Unknown function: ${functionName}`);
        }
      }
      
      return {
        valid: errors.length === 0,
        errors,
        warnings
      };
      
    } catch (error) {
      return {
        valid: false,
        errors: [`Validation failed: ${error.message}`],
        warnings
      };
    }
  }

  /**
   * Evaluate expression with context
   * @param {string} expression - Expression to evaluate
   * @param {Object} context - Evaluation context
   * @param {Object} options - Evaluation options
   * @returns {Promise<Object>} Evaluation result
   */
  async _evaluateExpression(expression, context, options = {}) {
    const usedVariables = new Set();
    
    try {
      // Create safe evaluation context
      const safeContext = this._createSafeContext(context, usedVariables);
      
      // Parse and evaluate expression
      const result = this._evaluateWithContext(expression, safeContext);
      
      return {
        success: true,
        value: result,
        usedVariables: Array.from(usedVariables),
        expression
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        usedVariables: Array.from(usedVariables),
        expression
      };
    }
  }

  /**
   * Create safe evaluation context with variable tracking
   * @param {Object} context - Original context
   * @param {Set} usedVariables - Set to track used variables
   * @returns {Object} Safe evaluation context
   */
  _createSafeContext(context, usedVariables) {
    const safeContext = {};
    
    // Add context variables with tracking
    for (const [key, value] of Object.entries(context)) {
      Object.defineProperty(safeContext, key, {
        get() {
          usedVariables.add(key);
          return value;
        },
        enumerable: true
      });
    }
    
    // Add utility functions
    safeContext.exists = (value) => {
      return value !== undefined && value !== null;
    };
    
    safeContext.empty = (value) => {
      if (value === undefined || value === null) return true;
      if (typeof value === 'string') return value.trim().length === 0;
      if (Array.isArray(value)) return value.length === 0;
      if (typeof value === 'object') return Object.keys(value).length === 0;
      return false;
    };
    
    safeContext.length = (value) => {
      if (typeof value === 'string' || Array.isArray(value)) return value.length;
      if (typeof value === 'object' && value !== null) return Object.keys(value).length;
      return 0;
    };
    
    safeContext.includes = (collection, item) => {
      if (typeof collection === 'string') return collection.includes(item);
      if (Array.isArray(collection)) return collection.includes(item);
      return false;
    };
    
    safeContext.startsWith = (str, prefix) => {
      return typeof str === 'string' && str.startsWith(prefix);
    };
    
    safeContext.endsWith = (str, suffix) => {
      return typeof str === 'string' && str.endsWith(suffix);
    };
    
    return safeContext;
  }

  /**
   * Evaluate expression with safe context
   * @param {string} expression - Expression to evaluate
   * @param {Object} context - Safe evaluation context
   * @returns {*} Evaluation result
   */
  _evaluateWithContext(expression, context) {
    // Handle simple cases first
    if (expression === 'true') return true;
    if (expression === 'false') return false;
    
    // Handle simple variable access
    if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(expression)) {
      return context[expression];
    }
    
    // Handle negation
    if (expression.startsWith('!') && /^![a-zA-Z_][a-zA-Z0-9_]*$/.test(expression)) {
      const varName = expression.slice(1);
      return !context[varName];
    }
    
    // Handle simple equality comparisons
    const eqMatch = expression.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*(==|!=|===|!==)\s*(.+)$/);
    if (eqMatch) {
      const [, varName, operator, value] = eqMatch;
      const actualValue = context[varName];
      const expectedValue = this._parseValue(value);
      
      switch (operator) {
        case '==': return actualValue == expectedValue;
        case '!=': return actualValue != expectedValue;
        case '===': return actualValue === expectedValue;
        case '!==': return actualValue !== expectedValue;
      }
    }
    
    // Handle function calls
    const funcMatch = expression.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*\(\s*([^)]*)\s*\)$/);
    if (funcMatch) {
      const [, functionName, args] = funcMatch;
      if (context[functionName] && typeof context[functionName] === 'function') {
        const argValues = args ? args.split(',').map(arg => this._parseValue(arg.trim(), context)) : [];
        return context[functionName](...argValues);
      }
    }
    
    // Handle complex expressions (limited support for safety)
    if (this.options.enableComplexExpressions) {
      return this._evaluateComplexExpression(expression, context);
    }
    
    // Fallback: treat as variable name
    return context[expression];
  }

  /**
   * Parse value from string representation
   * @param {string} value - String value to parse
   * @param {Object} context - Context for variable resolution
   * @returns {*} Parsed value
   */
  _parseValue(value, context = {}) {
    const trimmed = value.trim();
    
    // Handle quoted strings
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
        (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
      return trimmed.slice(1, -1);
    }
    
    // Handle numbers
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
      return parseFloat(trimmed);
    }
    
    // Handle booleans
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;
    if (trimmed === 'null') return null;
    if (trimmed === 'undefined') return undefined;
    
    // Handle variable references
    if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(trimmed)) {
      return context[trimmed];
    }
    
    // Return as string by default
    return trimmed;
  }

  /**
   * Evaluate complex expressions (basic implementation for safety)
   * @param {string} expression - Complex expression
   * @param {Object} context - Evaluation context
   * @returns {*} Evaluation result
   */
  _evaluateComplexExpression(expression, context) {
    // This is a simplified implementation for basic complex expressions
    // A full implementation would use a proper expression parser/evaluator
    
    // Handle AND operations
    if (expression.includes('&&')) {
      const parts = expression.split('&&').map(part => part.trim());
      return parts.every(part => this._evaluateWithContext(part, context));
    }
    
    // Handle OR operations
    if (expression.includes('||')) {
      const parts = expression.split('||').map(part => part.trim());
      return parts.some(part => this._evaluateWithContext(part, context));
    }
    
    // Fallback to simple evaluation
    return this._evaluateWithContext(expression, context);
  }

  /**
   * Interpret evaluation result as boolean
   * @param {Object} evaluationResult - Result from expression evaluation
   * @returns {boolean} Whether to skip processing
   */
  _interpretResult(evaluationResult) {
    if (!evaluationResult.success) {
      // On evaluation failure, don't skip (safe default)
      return false;
    }
    
    // Convert result to boolean
    return Boolean(evaluationResult.value);
  }

  /**
   * Calculate expression complexity for metadata
   * @param {string} expression - Expression to analyze
   * @returns {number} Complexity score
   */
  _calculateComplexity(expression) {
    let complexity = 1;
    
    // Add complexity for operators
    const operators = expression.match(/[=!<>]+|&&|\|\|/g) || [];
    complexity += operators.length;
    
    // Add complexity for function calls
    const functions = expression.match(/\w+\s*\(/g) || [];
    complexity += functions.length * 2;
    
    // Add complexity for parentheses groups
    const groups = expression.match(/\([^)]*\)/g) || [];
    complexity += groups.length;
    
    return complexity;
  }

  /**
   * Sanitize context for logging/provenance (remove sensitive data)
   * @param {Object} context - Original context
   * @returns {Object} Sanitized context
   */
  _sanitizeContext(context) {
    const sanitized = {};
    
    for (const [key, value] of Object.entries(context)) {
      // Skip potentially sensitive data
      if (key.toLowerCase().includes('password') || 
          key.toLowerCase().includes('secret') ||
          key.toLowerCase().includes('token') ||
          key.toLowerCase().includes('key')) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'function') {
        sanitized[key] = '[FUNCTION]';
      } else {
        sanitized[key] = value;
      }
    }
    
    return sanitized;
  }

  /**
   * Generate cache key for expression evaluation
   * @param {string} expression - Expression
   * @param {Object} context - Context
   * @returns {string} Cache key
   */
  _generateCacheKey(expression, context) {
    const keyData = {
      expression,
      contextKeys: Object.keys(context).sort(),
      contextValues: JSON.stringify(context)
    };
    
    return this._simpleHash(JSON.stringify(keyData));
  }

  /**
   * Simple hash function
   * @param {string} str - String to hash
   * @returns {string} Hash value
   */
  _simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Generate operation ID
   * @returns {string} Operation ID
   */
  _generateOperationId() {
    return `cond_${this.getDeterministicTimestamp()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Clear caches and history
   */
  clearCache() {
    this.expressionCache.clear();
    this.evaluationHistory.length = 0;
    this.emit('cache:cleared');
  }

  /**
   * Get evaluation statistics
   */
  getStatistics() {
    return {
      cacheSize: this.expressionCache.size,
      evaluationHistory: this.evaluationHistory.length,
      options: this.options
    };
  }

  /**
   * Get evaluation history for provenance
   * @param {Object} filters - Optional filters
   * @returns {Array} Filtered evaluation history
   */
  getEvaluationHistory(filters = {}) {
    let history = [...this.evaluationHistory];
    
    if (filters.operationId) {
      history = history.filter(entry => entry.operationId === filters.operationId);
    }
    
    if (filters.since) {
      const sinceDate = new Date(filters.since);
      history = history.filter(entry => entry.timestamp >= sinceDate);
    }
    
    if (filters.result !== undefined) {
      history = history.filter(entry => entry.result === filters.result);
    }
    
    return history;
  }
}

export default ConditionalProcessor;