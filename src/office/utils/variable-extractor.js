/**
 * @fileoverview Comprehensive Variable Extraction System
 * Analyzes templates for various variable syntaxes, patterns, and dependencies
 * @author Claude Code
 * @version 1.0.0
 */

/**
 * @typedef {Object} VariableInfo
 * @property {string} name - Variable name
 * @property {string} type - Variable type (simple, object, array, loop, conditional, filter)
 * @property {string} syntax - Original syntax found
 * @property {string} path - Full path for nested variables
 * @property {number} line - Line number where found
 * @property {number} column - Column position
 * @property {string[]} dependencies - Other variables this depends on
 * @property {Object} metadata - Additional information
 */

/**
 * @typedef {Object} SyntaxDefinition
 * @property {RegExp} pattern - Regex pattern to match
 * @property {string} type - Syntax type identifier
 * @property {Function} extractor - Function to extract variable info
 */

/**
 * @typedef {Object} ExtractionResult
 * @property {VariableInfo[]} variables - All extracted variables
 * @property {Map<string, VariableInfo[]>} byType - Variables grouped by type
 * @property {Map<string, string[]>} dependencies - Dependency graph
 * @property {Object} statistics - Extraction statistics
 * @property {string[]} errors - Parsing errors
 * @property {string[]} warnings - Parsing warnings
 */

class VariableExtractor {
  constructor(options = {}) {
    this.options = {
      includeLineNumbers: true,
      validateNames: true,
      trackDependencies: true,
      customSyntax: [],
      ignoreComments: true,
      ...options
    };

    this.syntaxDefinitions = this._initializeSyntaxDefinitions();
    this.customSyntax = new Map();
    
    // Add custom syntax definitions
    if (this.options.customSyntax.length > 0) {
      this._addCustomSyntax(this.options.customSyntax);
    }
  }

  /**
   * Extract all variables from template content
   * @param {string} content - Template content to analyze
   * @param {Object} options - Extraction options
   * @returns {ExtractionResult} Comprehensive extraction results
   */
  extract(content, options = {}) {
    const config = { ...this.options, ...options };
    const result = {
      variables: [],
      byType: new Map(),
      dependencies: new Map(),
      statistics: {
        totalVariables: 0,
        uniqueVariables: 0,
        byType: {},
        complexityScore: 0
      },
      errors: [],
      warnings: []
    };

    try {
      // Preprocess content
      const processedContent = this._preprocessContent(content, config);
      
      // Extract variables using all syntax definitions
      for (const [syntaxType, definition] of this.syntaxDefinitions) {
        this._extractWithSyntax(processedContent, definition, result, config);
      }

      // Process custom syntax
      for (const [name, definition] of this.customSyntax) {
        this._extractWithSyntax(processedContent, definition, result, config);
      }

      // Post-process results
      this._postProcessResults(result, config);
      this._calculateStatistics(result);
      this._buildDependencyGraph(result);

    } catch (error) {
      result.errors.push(`Extraction failed: ${error.message}`);
    }

    return result;
  }

  /**
   * Extract variables of specific type
   * @param {string} content - Template content
   * @param {string} type - Variable type to extract
   * @returns {VariableInfo[]} Variables of specified type
   */
  extractByType(content, type) {
    const result = this.extract(content);
    return result.byType.get(type) || [];
  }

  /**
   * Get variable dependencies for a specific variable
   * @param {string} content - Template content
   * @param {string} variableName - Variable to analyze
   * @returns {string[]} Array of dependency variable names
   */
  getDependencies(content, variableName) {
    const result = this.extract(content);
    return result.dependencies.get(variableName) || [];
  }

  /**
   * Validate variable names and paths
   * @param {VariableInfo[]} variables - Variables to validate
   * @returns {Object} Validation results
   */
  validateVariables(variables) {
    const validation = {
      valid: [],
      invalid: [],
      warnings: []
    };

    for (const variable of variables) {
      const validationResult = this._validateVariableName(variable);
      
      if (validationResult.isValid) {
        validation.valid.push(variable);
      } else {
        validation.invalid.push({
          variable,
          errors: validationResult.errors
        });
      }

      if (validationResult.warnings.length > 0) {
        validation.warnings.push({
          variable,
          warnings: validationResult.warnings
        });
      }
    }

    return validation;
  }

  /**
   * Generate documentation for extracted variables
   * @param {ExtractionResult} extractionResult - Extraction results
   * @param {Object} options - Documentation options
   * @returns {string} Generated documentation
   */
  generateDocumentation(extractionResult, options = {}) {
    const config = {
      format: 'markdown',
      includeExamples: true,
      includeTypes: true,
      includeDependencies: true,
      ...options
    };

    if (config.format === 'markdown') {
      return this._generateMarkdownDocs(extractionResult, config);
    } else if (config.format === 'json') {
      return this._generateJsonDocs(extractionResult, config);
    } else if (config.format === 'html') {
      return this._generateHtmlDocs(extractionResult, config);
    }

    throw new Error(`Unsupported documentation format: ${config.format}`);
  }

  /**
   * Add custom syntax definition
   * @param {string} name - Syntax name
   * @param {SyntaxDefinition} definition - Syntax definition
   */
  addCustomSyntax(name, definition) {
    if (!definition.pattern || !definition.extractor) {
      throw new Error('Custom syntax must have pattern and extractor');
    }

    this.customSyntax.set(name, {
      type: definition.type || name,
      pattern: definition.pattern,
      extractor: definition.extractor
    });
  }

  /**
   * Initialize built-in syntax definitions
   * @private
   * @returns {Map<string, SyntaxDefinition>} Syntax definitions map
   */
  _initializeSyntaxDefinitions() {
    const definitions = new Map();

    // Handlebars/Mustache syntax {{var}}
    definitions.set('handlebars', {
      type: 'handlebars',
      pattern: /\{\{([^}]+)\}\}/g,
      extractor: (match, content, line, column) => {
        const expression = match[1].trim();
        return this._parseHandlebarsExpression(expression, match[0], line, column);
      }
    });

    // Single brace syntax {var}
    definitions.set('single-brace', {
      type: 'single-brace',
      pattern: /\{([^{}]+)\}/g,
      extractor: (match, content, line, column) => {
        const expression = match[1].trim();
        return this._parseSimpleExpression(expression, match[0], line, column, 'single-brace');
      }
    });

    // Template literal syntax ${var}
    definitions.set('template-literal', {
      type: 'template-literal',
      pattern: /\$\{([^}]+)\}/g,
      extractor: (match, content, line, column) => {
        const expression = match[1].trim();
        return this._parseJavaScriptExpression(expression, match[0], line, column);
      }
    });

    // Angular syntax <var>
    definitions.set('angular', {
      type: 'angular',
      pattern: /<([a-zA-Z][a-zA-Z0-9._-]*)>/g,
      extractor: (match, content, line, column) => {
        const expression = match[1].trim();
        return this._parseSimpleExpression(expression, match[0], line, column, 'angular');
      }
    });

    // PHP-style syntax <?= $var ?>
    definitions.set('php', {
      type: 'php',
      pattern: /<\?=\s*\$([^?]+)\s*\?>/g,
      extractor: (match, content, line, column) => {
        const expression = match[1].trim();
        return this._parseSimpleExpression(expression, match[0], line, column, 'php');
      }
    });

    // ERB-style syntax <%= var %>
    definitions.set('erb', {
      type: 'erb',
      pattern: /<%=\s*([^%]+)\s*%>/g,
      extractor: (match, content, line, column) => {
        const expression = match[1].trim();
        return this._parseSimpleExpression(expression, match[0], line, column, 'erb');
      }
    });

    // Jinja2/Django syntax {{ var }}
    definitions.set('jinja2', {
      type: 'jinja2',
      pattern: /\{\{\s*([^}]+)\s*\}\}/g,
      extractor: (match, content, line, column) => {
        const expression = match[1].trim();
        return this._parseJinja2Expression(expression, match[0], line, column);
      }
    });

    return definitions;
  }

  /**
   * Parse Handlebars/Mustache expressions
   * @private
   * @param {string} expression - Expression to parse
   * @param {string} syntax - Original syntax
   * @param {number} line - Line number
   * @param {number} column - Column position
   * @returns {VariableInfo[]} Parsed variable information
   */
  _parseHandlebarsExpression(expression, syntax, line, column) {
    const variables = [];

    // Handle different Handlebars patterns
    if (expression.startsWith('#each ')) {
      // Loop: {{#each items}}
      const loopVar = expression.replace('#each ', '').trim();
      variables.push({
        name: loopVar,
        type: 'loop',
        syntax,
        path: loopVar,
        line,
        column,
        dependencies: [],
        metadata: {
          loopType: 'each',
          iteratorVar: this._extractIteratorVar(expression)
        }
      });
    } else if (expression.startsWith('#if ')) {
      // Conditional: {{#if condition}}
      const condition = expression.replace('#if ', '').trim();
      const conditionVars = this._extractVariablesFromCondition(condition);
      
      for (const varName of conditionVars) {
        variables.push({
          name: varName,
          type: 'conditional',
          syntax,
          path: varName,
          line,
          column,
          dependencies: [],
          metadata: {
            conditionType: 'if',
            fullCondition: condition
          }
        });
      }
    } else if (expression.startsWith('#unless ')) {
      // Negative conditional: {{#unless condition}}
      const condition = expression.replace('#unless ', '').trim();
      const conditionVars = this._extractVariablesFromCondition(condition);
      
      for (const varName of conditionVars) {
        variables.push({
          name: varName,
          type: 'conditional',
          syntax,
          path: varName,
          line,
          column,
          dependencies: [],
          metadata: {
            conditionType: 'unless',
            fullCondition: condition
          }
        });
      }
    } else if (expression.includes('|')) {
      // Filter/pipe: {{value|currency}}
      const [varPart, ...filterParts] = expression.split('|');
      const varName = varPart.trim();
      const filters = filterParts.map(f => f.trim());

      variables.push({
        name: varName,
        type: 'filter',
        syntax,
        path: varName,
        line,
        column,
        dependencies: this._extractFilterDependencies(filters),
        metadata: {
          filters,
          rawFilters: filterParts
        }
      });
    } else {
      // Simple variable or object path
      const varInfo = this._parseVariablePath(expression, syntax, line, column);
      variables.push(varInfo);
    }

    return variables;
  }

  /**
   * Parse simple expressions (single brace, angular, etc.)
   * @private
   * @param {string} expression - Expression to parse
   * @param {string} syntax - Original syntax
   * @param {number} line - Line number
   * @param {number} column - Column position
   * @param {string} syntaxType - Type of syntax
   * @returns {VariableInfo[]} Parsed variable information
   */
  _parseSimpleExpression(expression, syntax, line, column, syntaxType) {
    const varInfo = this._parseVariablePath(expression, syntax, line, column);
    varInfo.metadata = { ...varInfo.metadata, syntaxType };
    return [varInfo];
  }

  /**
   * Parse JavaScript template literal expressions
   * @private
   * @param {string} expression - Expression to parse
   * @param {string} syntax - Original syntax
   * @param {number} line - Line number
   * @param {number} column - Column position
   * @returns {VariableInfo[]} Parsed variable information
   */
  _parseJavaScriptExpression(expression, syntax, line, column) {
    const variables = [];
    
    // Handle complex JavaScript expressions
    const varMatches = expression.match(/\b[a-zA-Z_$][a-zA-Z0-9_$]*(?:\.[a-zA-Z_$][a-zA-Z0-9_$]*|\[[^\]]+\])*/g);
    
    if (varMatches) {
      for (const varName of varMatches) {
        // Skip JavaScript keywords
        if (!this._isJavaScriptKeyword(varName)) {
          const varInfo = this._parseVariablePath(varName, syntax, line, column);
          varInfo.metadata = { 
            ...varInfo.metadata, 
            syntaxType: 'template-literal',
            fullExpression: expression
          };
          variables.push(varInfo);
        }
      }
    }

    return variables;
  }

  /**
   * Parse Jinja2/Django template expressions
   * @private
   * @param {string} expression - Expression to parse
   * @param {string} syntax - Original syntax
   * @param {number} line - Line number
   * @param {number} column - Column position
   * @returns {VariableInfo[]} Parsed variable information
   */
  _parseJinja2Expression(expression, syntax, line, column) {
    const variables = [];

    // Handle Jinja2 filters
    if (expression.includes('|')) {
      const [varPart, ...filterParts] = expression.split('|');
      const varName = varPart.trim();
      const filters = filterParts.map(f => f.trim());

      variables.push({
        name: varName,
        type: 'filter',
        syntax,
        path: varName,
        line,
        column,
        dependencies: this._extractFilterDependencies(filters),
        metadata: {
          filters,
          syntaxType: 'jinja2'
        }
      });
    } else {
      // Simple variable
      const varInfo = this._parseVariablePath(expression, syntax, line, column);
      varInfo.metadata = { ...varInfo.metadata, syntaxType: 'jinja2' };
      variables.push(varInfo);
    }

    return variables;
  }

  /**
   * Parse variable path (object notation, array access)
   * @private
   * @param {string} path - Variable path
   * @param {string} syntax - Original syntax
   * @param {number} line - Line number
   * @param {number} column - Column position
   * @returns {VariableInfo} Variable information
   */
  _parseVariablePath(path, syntax, line, column) {
    const cleanPath = path.trim();
    const parts = this._splitVariablePath(cleanPath);
    const name = parts[0];
    
    let type = 'simple';
    if (parts.length > 1) {
      type = cleanPath.includes('[') ? 'array' : 'object';
    }

    return {
      name,
      type,
      syntax,
      path: cleanPath,
      line,
      column,
      dependencies: this._extractPathDependencies(parts),
      metadata: {
        parts,
        isNested: parts.length > 1,
        hasArrayAccess: cleanPath.includes('['),
        hasObjectAccess: cleanPath.includes('.')
      }
    };
  }

  /**
   * Split variable path into components
   * @private
   * @param {string} path - Variable path
   * @returns {string[]} Path components
   */
  _splitVariablePath(path) {
    const parts = [];
    let current = '';
    let inBrackets = false;
    let inQuotes = false;
    let quoteChar = '';

    for (let i = 0; i < path.length; i++) {
      const char = path[i];
      
      if ((char === '"' || char === "'") && !inBrackets) {
        if (!inQuotes) {
          inQuotes = true;
          quoteChar = char;
        } else if (char === quoteChar) {
          inQuotes = false;
          quoteChar = '';
        }
      } else if (char === '[' && !inQuotes) {
        if (current) {
          parts.push(current);
          current = '';
        }
        inBrackets = true;
        current += char;
      } else if (char === ']' && !inQuotes) {
        inBrackets = false;
        current += char;
        parts.push(current);
        current = '';
      } else if (char === '.' && !inBrackets && !inQuotes) {
        if (current) {
          parts.push(current);
          current = '';
        }
      } else {
        current += char;
      }
    }

    if (current) {
      parts.push(current);
    }

    return parts.filter(part => part.length > 0);
  }

  /**
   * Extract variables from conditional expressions
   * @private
   * @param {string} condition - Conditional expression
   * @returns {string[]} Variable names found in condition
   */
  _extractVariablesFromCondition(condition) {
    const variables = [];
    
    // Remove operators and extract variable names
    const cleaned = condition
      .replace(/[()]/g, ' ')
      .replace(/\s*(&&|\|\||and|or|not|!|==|!=|<=|>=|<|>)\s*/g, ' ')
      .split(/\s+/)
      .filter(part => part.length > 0);

    for (const part of cleaned) {
      if (this._isValidVariableName(part) && !this._isLiteral(part)) {
        variables.push(part);
      }
    }

    return [...new Set(variables)]; // Remove duplicates
  }

  /**
   * Extract dependencies from filters
   * @private
   * @param {string[]} filters - Filter expressions
   * @returns {string[]} Dependencies found in filters
   */
  _extractFilterDependencies(filters) {
    const dependencies = [];
    
    for (const filter of filters) {
      // Extract variables from filter parameters
      const paramMatches = filter.match(/:\s*([a-zA-Z][a-zA-Z0-9._]*)/g);
      if (paramMatches) {
        for (const match of paramMatches) {
          const varName = match.replace(':', '').trim();
          if (this._isValidVariableName(varName)) {
            dependencies.push(varName);
          }
        }
      }
    }

    return dependencies;
  }

  /**
   * Extract dependencies from variable path
   * @private
   * @param {string[]} parts - Path parts
   * @returns {string[]} Dependencies
   */
  _extractPathDependencies(parts) {
    const dependencies = [];
    
    for (let i = 1; i < parts.length; i++) {
      const part = parts[i];
      if (part.includes('[')) {
        // Extract variables from array access
        const indexMatches = part.match(/\[([^\]]+)\]/g);
        if (indexMatches) {
          for (const match of indexMatches) {
            const index = match.slice(1, -1).trim();
            if (this._isValidVariableName(index) && !this._isLiteral(index)) {
              dependencies.push(index);
            }
          }
        }
      }
    }

    return dependencies;
  }

  /**
   * Extract with specific syntax definition
   * @private
   * @param {string} content - Content to parse
   * @param {SyntaxDefinition} definition - Syntax definition
   * @param {ExtractionResult} result - Result object to populate
   * @param {Object} config - Configuration options
   */
  _extractWithSyntax(content, definition, result, config) {
    const lines = content.split('\n');
    
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      let match;
      
      // Reset regex lastIndex
      definition.pattern.lastIndex = 0;
      
      while ((match = definition.pattern.exec(line)) !== null) {
        try {
          const column = match.index;
          const lineNumber = lineIndex + 1;
          
          const variables = definition.extractor(match, content, lineNumber, column);
          
          for (const variable of variables) {
            // Validate variable if enabled
            if (config.validateNames) {
              const validation = this._validateVariableName(variable);
              if (!validation.isValid) {
                result.warnings.push(`Invalid variable '${variable.name}' at line ${lineNumber}`);
                continue;
              }
            }

            result.variables.push(variable);
            
            // Group by type
            if (!result.byType.has(variable.type)) {
              result.byType.set(variable.type, []);
            }
            result.byType.get(variable.type).push(variable);
          }
        } catch (error) {
          result.errors.push(`Error parsing line ${lineIndex + 1}: ${error.message}`);
        }
      }
    }
  }

  /**
   * Preprocess content before extraction
   * @private
   * @param {string} content - Raw content
   * @param {Object} config - Configuration
   * @returns {string} Processed content
   */
  _preprocessContent(content, config) {
    let processed = content;

    if (config.ignoreComments) {
      // Remove HTML comments
      processed = processed.replace(/<!--[\s\S]*?-->/g, '');
      
      // Remove JavaScript comments
      processed = processed.replace(/\/\*[\s\S]*?\*\//g, '');
      processed = processed.replace(/\/\/.*$/gm, '');
      
      // Remove CSS comments
      processed = processed.replace(/\/\*[\s\S]*?\*\//g, '');
    }

    return processed;
  }

  /**
   * Post-process extraction results
   * @private
   * @param {ExtractionResult} result - Extraction result
   * @param {Object} config - Configuration
   */
  _postProcessResults(result, config) {
    // Remove duplicates
    const seen = new Set();
    result.variables = result.variables.filter(variable => {
      const key = `${variable.name}:${variable.type}:${variable.syntax}:${variable.line}:${variable.column}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });

    // Rebuild type grouping after deduplication
    result.byType.clear();
    for (const variable of result.variables) {
      if (!result.byType.has(variable.type)) {
        result.byType.set(variable.type, []);
      }
      result.byType.get(variable.type).push(variable);
    }
  }

  /**
   * Calculate extraction statistics
   * @private
   * @param {ExtractionResult} result - Extraction result
   */
  _calculateStatistics(result) {
    result.statistics.totalVariables = result.variables.length;
    
    const uniqueNames = new Set(result.variables.map(v => v.name));
    result.statistics.uniqueVariables = uniqueNames.size;

    // Count by type
    for (const [type, variables] of result.byType) {
      result.statistics.byType[type] = variables.length;
    }

    // Calculate complexity score
    let complexityScore = 0;
    for (const variable of result.variables) {
      complexityScore += this._calculateVariableComplexity(variable);
    }
    result.statistics.complexityScore = complexityScore;
  }

  /**
   * Calculate complexity score for a variable
   * @private
   * @param {VariableInfo} variable - Variable to score
   * @returns {number} Complexity score
   */
  _calculateVariableComplexity(variable) {
    let score = 1; // Base score

    // Add complexity for nested paths
    if (variable.metadata && variable.metadata.parts) {
      score += variable.metadata.parts.length - 1;
    }

    // Add complexity for dependencies
    score += variable.dependencies.length;

    // Add complexity for filters
    if (variable.type === 'filter' && variable.metadata.filters) {
      score += variable.metadata.filters.length;
    }

    // Add complexity for conditionals and loops
    if (variable.type === 'conditional' || variable.type === 'loop') {
      score += 2;
    }

    return score;
  }

  /**
   * Build dependency graph
   * @private
   * @param {ExtractionResult} result - Extraction result
   */
  _buildDependencyGraph(result) {
    for (const variable of result.variables) {
      if (variable.dependencies.length > 0) {
        result.dependencies.set(variable.name, variable.dependencies);
      }
    }
  }

  /**
   * Validate variable name
   * @private
   * @param {VariableInfo} variable - Variable to validate
   * @returns {Object} Validation result
   */
  _validateVariableName(variable) {
    const result = {
      isValid: true,
      errors: [],
      warnings: []
    };

    const name = variable.name;

    // Check if name is valid identifier
    if (!this._isValidVariableName(name)) {
      result.isValid = false;
      result.errors.push(`Invalid variable name: ${name}`);
    }

    // Check for reserved words
    if (this._isReservedWord(name)) {
      result.warnings.push(`Variable name '${name}' is a reserved word`);
    }

    // Check naming conventions
    if (name.length > 50) {
      result.warnings.push(`Variable name '${name}' is very long`);
    }

    if (name.includes('__')) {
      result.warnings.push(`Variable name '${name}' contains double underscores`);
    }

    return result;
  }

  /**
   * Check if string is valid variable name
   * @private
   * @param {string} name - Name to check
   * @returns {boolean} Is valid
   */
  _isValidVariableName(name) {
    return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name);
  }

  /**
   * Check if string is a JavaScript keyword
   * @private
   * @param {string} word - Word to check
   * @returns {boolean} Is keyword
   */
  _isJavaScriptKeyword(word) {
    const keywords = [
      'abstract', 'arguments', 'await', 'boolean', 'break', 'byte', 'case',
      'catch', 'char', 'class', 'const', 'continue', 'debugger', 'default',
      'delete', 'do', 'double', 'else', 'enum', 'eval', 'export', 'extends',
      'false', 'final', 'finally', 'float', 'for', 'function', 'goto', 'if',
      'implements', 'import', 'in', 'instanceof', 'int', 'interface', 'let',
      'long', 'native', 'new', 'null', 'package', 'private', 'protected',
      'public', 'return', 'short', 'static', 'super', 'switch', 'synchronized',
      'this', 'throw', 'throws', 'transient', 'true', 'try', 'typeof', 'var',
      'void', 'volatile', 'while', 'with', 'yield'
    ];
    return keywords.includes(word);
  }

  /**
   * Check if string is a reserved word
   * @private
   * @param {string} word - Word to check
   * @returns {boolean} Is reserved
   */
  _isReservedWord(word) {
    return this._isJavaScriptKeyword(word);
  }

  /**
   * Check if string is a literal value
   * @private
   * @param {string} value - Value to check
   * @returns {boolean} Is literal
   */
  _isLiteral(value) {
    // Number literal
    if (/^\d+(\.\d+)?$/.test(value)) {
      return true;
    }

    // String literal
    if (/^(['"])(.*)\1$/.test(value)) {
      return true;
    }

    // Boolean literal
    if (value === 'true' || value === 'false') {
      return true;
    }

    // Null/undefined
    if (value === 'null' || value === 'undefined') {
      return true;
    }

    return false;
  }

  /**
   * Extract iterator variable from loop expression
   * @private
   * @param {string} expression - Loop expression
   * @returns {string|null} Iterator variable name
   */
  _extractIteratorVar(expression) {
    // For expressions like "item in items"
    const inMatch = expression.match(/(\w+)\s+in\s+(\w+)/);
    if (inMatch) {
      return inMatch[1];
    }

    // For expressions like "items as item"
    const asMatch = expression.match(/(\w+)\s+as\s+(\w+)/);
    if (asMatch) {
      return asMatch[2];
    }

    return null;
  }

  /**
   * Add custom syntax definitions
   * @private
   * @param {Array} syntaxArray - Array of custom syntax definitions
   */
  _addCustomSyntax(syntaxArray) {
    for (const syntax of syntaxArray) {
      this.addCustomSyntax(syntax.name, syntax);
    }
  }

  /**
   * Generate Markdown documentation
   * @private
   * @param {ExtractionResult} result - Extraction result
   * @param {Object} config - Documentation config
   * @returns {string} Markdown documentation
   */
  _generateMarkdownDocs(result, config) {
    let docs = '# Template Variables Documentation\n\n';

    // Statistics
    docs += '## Summary\n\n';
    docs += `- **Total Variables**: ${result.statistics.totalVariables}\n`;
    docs += `- **Unique Variables**: ${result.statistics.uniqueVariables}\n`;
    docs += `- **Complexity Score**: ${result.statistics.complexityScore}\n\n`;

    // Variables by type
    docs += '## Variables by Type\n\n';
    for (const [type, variables] of result.byType) {
      docs += `### ${type.charAt(0).toUpperCase() + type.slice(1)} Variables\n\n`;
      
      for (const variable of variables) {
        docs += `- **${variable.name}**`;
        if (config.includeTypes && variable.path !== variable.name) {
          docs += ` (${variable.path})`;
        }
        docs += `\n  - Syntax: \`${variable.syntax}\`\n`;
        docs += `  - Location: Line ${variable.line}, Column ${variable.column}\n`;
        
        if (config.includeDependencies && variable.dependencies.length > 0) {
          docs += `  - Dependencies: ${variable.dependencies.join(', ')}\n`;
        }
        
        if (variable.metadata && Object.keys(variable.metadata).length > 0) {
          docs += `  - Metadata: ${JSON.stringify(variable.metadata)}\n`;
        }
        
        docs += '\n';
      }
    }

    // Dependencies
    if (config.includeDependencies && result.dependencies.size > 0) {
      docs += '## Dependency Graph\n\n';
      for (const [variable, deps] of result.dependencies) {
        docs += `- **${variable}** depends on: ${deps.join(', ')}\n`;
      }
      docs += '\n';
    }

    // Errors and warnings
    if (result.errors.length > 0) {
      docs += '## Errors\n\n';
      for (const error of result.errors) {
        docs += `- ${error}\n`;
      }
      docs += '\n';
    }

    if (result.warnings.length > 0) {
      docs += '## Warnings\n\n';
      for (const warning of result.warnings) {
        docs += `- ${warning}\n`;
      }
      docs += '\n';
    }

    return docs;
  }

  /**
   * Generate JSON documentation
   * @private
   * @param {ExtractionResult} result - Extraction result
   * @param {Object} config - Documentation config
   * @returns {string} JSON documentation
   */
  _generateJsonDocs(result, config) {
    const docs = {
      summary: result.statistics,
      variables: result.variables,
      byType: Object.fromEntries(result.byType),
      dependencies: Object.fromEntries(result.dependencies),
      errors: result.errors,
      warnings: result.warnings
    };

    return JSON.stringify(docs, null, 2);
  }

  /**
   * Generate HTML documentation
   * @private
   * @param {ExtractionResult} result - Extraction result
   * @param {Object} config - Documentation config
   * @returns {string} HTML documentation
   */
  _generateHtmlDocs(result, config) {
    let html = `
<!DOCTYPE html>
<html>
<head>
    <title>Template Variables Documentation</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .variable { margin: 10px 0; padding: 10px; border: 1px solid #ddd; }
        .type-${result.byType.keys().join(', .type-')} { border-left: 4px solid #007cba; }
        .metadata { font-size: 0.9em; color: #666; }
        .dependencies { color: #d73027; }
        .warnings { color: #fc8d59; }
        .errors { color: #d73027; font-weight: bold; }
    </style>
</head>
<body>
    <h1>Template Variables Documentation</h1>
    
    <h2>Summary</h2>
    <ul>
        <li>Total Variables: ${result.statistics.totalVariables}</li>
        <li>Unique Variables: ${result.statistics.uniqueVariables}</li>
        <li>Complexity Score: ${result.statistics.complexityScore}</li>
    </ul>
`;

    // Variables by type
    for (const [type, variables] of result.byType) {
      html += `<h2>${type.charAt(0).toUpperCase() + type.slice(1)} Variables</h2>`;
      
      for (const variable of variables) {
        html += `<div class="variable type-${type}">`;
        html += `<strong>${variable.name}</strong>`;
        if (variable.path !== variable.name) {
          html += ` <span class="metadata">(${variable.path})</span>`;
        }
        html += `<br>Syntax: <code>${variable.syntax}</code>`;
        html += `<br>Location: Line ${variable.line}, Column ${variable.column}`;
        
        if (variable.dependencies.length > 0) {
          html += `<br><span class="dependencies">Dependencies: ${variable.dependencies.join(', ')}</span>`;
        }
        
        html += '</div>';
      }
    }

    // Errors and warnings
    if (result.errors.length > 0) {
      html += '<h2>Errors</h2><ul>';
      for (const error of result.errors) {
        html += `<li class="errors">${error}</li>`;
      }
      html += '</ul>';
    }

    if (result.warnings.length > 0) {
      html += '<h2>Warnings</h2><ul>';
      for (const warning of result.warnings) {
        html += `<li class="warnings">${warning}</li>`;
      }
      html += '</ul>';
    }

    html += '</body></html>';
    return html;
  }
}

export default VariableExtractor;