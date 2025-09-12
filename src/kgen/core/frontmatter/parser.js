/**
 * KGEN Enhanced Frontmatter Parser
 * 
 * Advanced frontmatter parser with YAML validation, schema support, and
 * deterministic processing for KGEN template system. Handles complex
 * frontmatter scenarios including dynamic path generation, conditional
 * processing, and metadata extraction.
 */

import yaml from 'yaml';
import { EventEmitter } from 'events';
import { Logger } from 'consola';

export class FrontmatterParser extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      delimiter: '---',
      enableValidation: true,
      enableSemanticValidation: false,
      strictMode: false,
      maxErrors: 100,
      timeout: 5000,
      enableVariableExtraction: true,
      enableProvenance: true,
      ...options
    };
    
    this.logger = new Logger({ tag: 'kgen-frontmatter-parser' });
    this.parseCache = new Map();
    this.validationCache = new Map();
  }

  /**
   * Parse template content with frontmatter and comprehensive validation
   * @param {string} templateContent - Template content to parse
   * @param {boolean} enableSemanticValidation - Enable semantic validation
   * @param {Object} parseOptions - Additional parsing options
   * @returns {Promise<Object>} Parse result with frontmatter, content, and validation
   */
  async parse(templateContent, enableSemanticValidation = false, parseOptions = {}) {
    // Generate cache key for deterministic caching
    const cacheKey = this._generateCacheKey(templateContent, enableSemanticValidation, parseOptions);
    
    // Check cache if enabled
    if (parseOptions.useCache !== false && this.parseCache.has(cacheKey)) {
      return this.parseCache.get(cacheKey);
    }
    
    try {
      // Handle empty or invalid content
      if (!templateContent || typeof templateContent !== 'string') {
        const result = {
          frontmatter: {},
          content: templateContent || '',
          hasValidFrontmatter: false,
          parseMetadata: {
            parseTime: 0,
            cacheHit: false,
            errors: [],
            warnings: []
          }
        };
        
        if (parseOptions.useCache !== false) {
          this.parseCache.set(cacheKey, result);
        }
        
        return result;
      }
      
      const startTime = Date.now();
      
      // Enhanced frontmatter regex that handles edge cases
      const frontmatterRegex = /^---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n|$)([\s\S]*)$/;
      const match = templateContent.match(frontmatterRegex);
      
      if (!match) {
        const result = {
          frontmatter: {},
          content: templateContent,
          hasValidFrontmatter: false,
          parseMetadata: {
            parseTime: Date.now() - startTime,
            cacheHit: false,
            errors: [],
            warnings: ['No frontmatter delimiter found']
          }
        };
        
        if (parseOptions.useCache !== false) {
          this.parseCache.set(cacheKey, result);
        }
        
        return result;
      }
      
      const rawFrontmatter = match[1];
      const templateBody = match[2];
      
      // Pre-process frontmatter for KGEN-specific features
      const processedFrontmatter = this._preprocessFrontmatter(rawFrontmatter);
      
      // Parse YAML with error handling
      const yamlParseResult = await this._parseYAML(processedFrontmatter, parseOptions);
      
      if (!yamlParseResult.success) {
        const result = {
          frontmatter: {},
          content: templateContent,
          hasValidFrontmatter: false,
          parseMetadata: {
            parseTime: Date.now() - startTime,
            cacheHit: false,
            errors: yamlParseResult.errors,
            warnings: []
          }
        };
        
        if (parseOptions.useCache !== false) {
          this.parseCache.set(cacheKey, result);
        }
        
        return result;
      }
      
      // Post-process parsed frontmatter
      const frontmatter = this._postprocessFrontmatter(yamlParseResult.data);
      
      // Validate frontmatter structure
      const validationResult = await this._validateFrontmatter(
        frontmatter, 
        enableSemanticValidation || this.options.enableSemanticValidation,
        parseOptions
      );
      
      // Extract variables if enabled
      let variableExtraction = null;
      if (this.options.enableVariableExtraction) {
        variableExtraction = this._extractVariables(frontmatter, templateBody);
      }
      
      const result = {
        frontmatter,
        content: templateBody.trim(),
        hasValidFrontmatter: true,
        validationResult,
        variableExtraction,
        parseMetadata: {
          parseTime: Date.now() - startTime,
          cacheHit: false,
          errors: validationResult.errors || [],
          warnings: validationResult.warnings || [],
          rawFrontmatterSize: rawFrontmatter.length,
          processedFrontmatterSize: JSON.stringify(frontmatter).length
        }
      };
      
      // Cache result if enabled
      if (parseOptions.useCache !== false) {
        this.parseCache.set(cacheKey, result);
      }
      
      // Emit parse event for provenance tracking
      if (this.options.enableProvenance) {
        this.emit('frontmatter:parsed', {
          cacheKey,
          result,
          timestamp: new Date()
        });
      }
      
      return result;
      
    } catch (error) {
      const result = {
        frontmatter: {},
        content: templateContent,
        hasValidFrontmatter: false,
        parseMetadata: {
          parseTime: Date.now() - (Date.now() - 1),
          cacheHit: false,
          errors: [`Parse error: ${error.message}`],
          warnings: []
        }
      };
      
      this.emit('frontmatter:error', {
        error,
        templateContent,
        result
      });
      
      return result;
    }
  }

  /**
   * Pre-process frontmatter to handle KGEN-specific features
   * @param {string} rawFrontmatter - Raw YAML frontmatter content
   * @returns {string} Processed frontmatter
   */
  _preprocessFrontmatter(rawFrontmatter) {
    let processed = rawFrontmatter;
    
    // Handle dynamic path expressions in 'to' field
    processed = processed.replace(
      /^(\s*to:\s*)(.*?)$/gm,
      (match, prefix, path) => {
        // Preserve template expressions in paths
        if (path.includes('{{') || path.includes('{%')) {
          return prefix + `"${path.replace(/"/g, '\\"')}"`;
        }
        return match;
      }
    );
    
    // Handle shell command arrays
    processed = processed.replace(
      /^(\s*sh:\s*)([\s\S]*?)(?=^\s*\w|\s*$)/gm,
      (match, prefix, commands) => {
        // If commands are not in array format, convert to array
        if (!commands.trim().startsWith('[')) {
          const commandLines = commands
            .split('\n')
            .map(line => line.trim())
            .filter(line => line && !line.startsWith('#'))
            .map(line => `  - "${line.replace(/"/g, '\\"')}"`);
          
          if (commandLines.length > 0) {
            return prefix + '\n' + commandLines.join('\n');
          }
        }
        return match;
      }
    );
    
    // Handle conditional expressions
    processed = processed.replace(
      /^(\s*skipIf:\s*)(.*?)$/gm,
      (match, prefix, condition) => {
        // Ensure condition is properly quoted if it contains special characters
        if (condition && !condition.startsWith('"') && !condition.startsWith("'")) {
          const hasSpecialChars = /[<>=!&|]/.test(condition);
          if (hasSpecialChars) {
            return prefix + `"${condition.replace(/"/g, '\\"')}"`;
          }
        }
        return match;
      }
    );
    
    return processed;
  }

  /**
   * Parse YAML with comprehensive error handling
   * @param {string} yamlContent - YAML content to parse
   * @param {Object} parseOptions - Parsing options
   * @returns {Promise<Object>} Parse result with success status and data/errors
   */
  async _parseYAML(yamlContent, parseOptions = {}) {
    try {
      const yamlOptions = {
        keepUndefined: true,
        strict: this.options.strictMode,
        maxAliasCount: parseOptions.maxAliasCount || 100,
        ...parseOptions.yamlOptions
      };
      
      const data = yaml.parse(yamlContent, yamlOptions);
      
      return {
        success: true,
        data: data || {},
        errors: [],
        warnings: []
      };
      
    } catch (error) {
      return {
        success: false,
        data: {},
        errors: [`YAML parse error: ${error.message}`],
        warnings: []
      };
    }
  }

  /**
   * Post-process parsed frontmatter for KGEN normalization
   * @param {Object} frontmatter - Parsed YAML frontmatter
   * @returns {Object} Normalized frontmatter
   */
  _postprocessFrontmatter(frontmatter) {
    if (!frontmatter || typeof frontmatter !== 'object') {
      return {};
    }
    
    const processed = { ...frontmatter };
    
    // Normalize output path field
    if (processed.to) {
      processed.outputPath = processed.to;
    }
    
    // Normalize operation mode fields
    if (processed.inject === true || processed.inject === 'true') {
      processed.operationMode = 'inject';
    } else if (processed.append === true || processed.append === 'true') {
      processed.operationMode = 'append';
    } else if (processed.prepend === true || processed.prepend === 'true') {
      processed.operationMode = 'prepend';
    } else if (processed.lineAt !== undefined) {
      processed.operationMode = 'lineAt';
      processed.lineNumber = parseInt(processed.lineAt, 10);
    } else {
      processed.operationMode = 'write';
    }
    
    // Normalize chmod permissions
    if (processed.chmod !== undefined) {
      processed.chmod = this._normalizeChmod(processed.chmod);
    }
    
    // Normalize shell commands
    if (processed.sh) {
      if (typeof processed.sh === 'string') {
        processed.sh = [processed.sh];
      } else if (!Array.isArray(processed.sh)) {
        delete processed.sh;
      }
    }
    
    // Normalize variables configuration
    if (processed.variables && typeof processed.variables === 'object') {
      processed.variableDefinitions = this._normalizeVariableDefinitions(processed.variables);
    }
    
    return processed;
  }

  /**
   * Validate frontmatter structure and content
   * @param {Object} frontmatter - Frontmatter to validate
   * @param {boolean} enableSemanticValidation - Enable semantic validation
   * @param {Object} parseOptions - Parsing options
   * @returns {Promise<Object>} Validation result
   */
  async _validateFrontmatter(frontmatter, enableSemanticValidation = false, parseOptions = {}) {
    const errors = [];
    const warnings = [];
    
    try {
      // Basic structural validation
      if (!frontmatter || typeof frontmatter !== 'object') {
        errors.push('Frontmatter must be a valid YAML object');
        return { valid: false, errors, warnings };
      }
      
      // Validate mutually exclusive operation modes
      const operationModes = [
        frontmatter.inject,
        frontmatter.append,
        frontmatter.prepend,
        frontmatter.lineAt !== undefined
      ].filter(Boolean);
      
      if (operationModes.length > 1) {
        errors.push('Only one operation mode allowed: inject, append, prepend, or lineAt');
      }
      
      // Validate injection requirements
      if ((frontmatter.before || frontmatter.after) && !frontmatter.inject) {
        errors.push('before/after markers require inject: true');
      }
      
      // Validate lineAt value
      if (frontmatter.lineAt !== undefined) {
        const lineAt = parseInt(frontmatter.lineAt, 10);
        if (isNaN(lineAt) || lineAt < 1) {
          errors.push('lineAt must be a positive number (1-based line numbers)');
        }
      }
      
      // Validate output path
      if (frontmatter.to && typeof frontmatter.to !== 'string') {
        errors.push('Output path (to) must be a string');
      }
      
      // Validate chmod permissions
      if (frontmatter.chmod !== undefined) {
        const chmodValidation = this._validateChmod(frontmatter.chmod);
        if (!chmodValidation.valid) {
          errors.push(...chmodValidation.errors);
        }
      }
      
      // Validate shell commands
      if (frontmatter.sh) {
        const shValidation = this._validateShellCommands(frontmatter.sh);
        if (!shValidation.valid) {
          errors.push(...shValidation.errors);
        } else if (shValidation.warnings) {
          warnings.push(...shValidation.warnings);
        }
      }
      
      // Validate skipIf condition
      if (frontmatter.skipIf !== undefined) {
        const skipIfValidation = this._validateSkipIfCondition(frontmatter.skipIf);
        if (!skipIfValidation.valid) {
          errors.push(...skipIfValidation.errors);
        } else if (skipIfValidation.warnings) {
          warnings.push(...skipIfValidation.warnings);
        }
      }
      
      // Validate variable definitions
      if (frontmatter.variables) {
        const variableValidation = this._validateVariableDefinitions(frontmatter.variables);
        if (!variableValidation.valid) {
          errors.push(...variableValidation.errors);
        } else if (variableValidation.warnings) {
          warnings.push(...variableValidation.warnings);
        }
      }
      
      // Semantic validation if enabled
      if (enableSemanticValidation) {
        const semanticValidation = await this._performSemanticValidation(frontmatter, parseOptions);
        errors.push(...semanticValidation.errors);
        warnings.push(...semanticValidation.warnings);
      }
      
      return {
        valid: errors.length === 0,
        errors,
        warnings
      };
      
    } catch (error) {
      return {
        valid: false,
        errors: [`Validation error: ${error.message}`],
        warnings
      };
    }
  }

  /**
   * Extract variables from frontmatter and template content
   * @param {Object} frontmatter - Parsed frontmatter
   * @param {string} templateContent - Template body content
   * @returns {Object} Variable extraction result
   */
  _extractVariables(frontmatter, templateContent) {
    const variables = new Set();
    const variableDefinitions = {};
    
    // Extract variables from frontmatter values
    this._extractVariablesFromObject(frontmatter, variables);
    
    // Extract variables from template content
    const templateVariables = this._extractTemplateVariables(templateContent);
    templateVariables.forEach(v => variables.add(v));
    
    // Process variable definitions from frontmatter
    if (frontmatter.variables && typeof frontmatter.variables === 'object') {
      Object.entries(frontmatter.variables).forEach(([name, definition]) => {
        variables.add(name);
        variableDefinitions[name] = this._normalizeVariableDefinition(definition);
      });
    }
    
    return {
      allVariables: Array.from(variables).sort(),
      frontmatterVariables: this._getVariablesFromObject(frontmatter),
      templateVariables,
      variableDefinitions
    };
  }

  /**
   * Extract template variables using multiple patterns
   * @param {string} content - Template content
   * @returns {Array} Array of variable names
   */
  _extractTemplateVariables(content) {
    const variables = new Set();
    
    // Nunjucks/Jinja2 style: {{ variable }}
    const nunjucksRegex = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_.]*)\s*(?:\|.*?)?\}\}/g;
    let match;
    
    while ((match = nunjucksRegex.exec(content)) !== null) {
      const variable = match[1].split('.')[0]; // Get root variable
      variables.add(variable);
    }
    
    // Control structures: {% if variable %}
    const controlRegex = /\{%\s*(?:if|unless|for|set)\s+([a-zA-Z_][a-zA-Z0-9_.]*)/g;
    while ((match = controlRegex.exec(content)) !== null) {
      const variable = match[1].split('.')[0];
      variables.add(variable);
    }
    
    // Assignment structures: {% set variable = value %}
    const setRegex = /\{%\s*set\s+([a-zA-Z_][a-zA-Z0-9_.]*)\s*=/g;
    while ((match = setRegex.exec(content)) !== null) {
      variables.add(match[1]);
    }
    
    return Array.from(variables).sort();
  }

  /**
   * Recursively extract variables from object values
   * @param {Object} obj - Object to scan
   * @param {Set} variables - Set to collect variables
   */
  _extractVariablesFromObject(obj, variables) {
    if (!obj || typeof obj !== 'object') return;
    
    for (const value of Object.values(obj)) {
      if (typeof value === 'string') {
        const stringVariables = this._extractTemplateVariables(value);
        stringVariables.forEach(v => variables.add(v));
      } else if (Array.isArray(value)) {
        value.forEach(item => {
          if (typeof item === 'string') {
            const stringVariables = this._extractTemplateVariables(item);
            stringVariables.forEach(v => variables.add(v));
          } else if (typeof item === 'object') {
            this._extractVariablesFromObject(item, variables);
          }
        });
      } else if (typeof value === 'object') {
        this._extractVariablesFromObject(value, variables);
      }
    }
  }

  /**
   * Get variables specifically from frontmatter object
   * @param {Object} frontmatter - Frontmatter object
   * @returns {Array} Array of variables found in frontmatter
   */
  _getVariablesFromObject(frontmatter) {
    const variables = new Set();
    this._extractVariablesFromObject(frontmatter, variables);
    return Array.from(variables).sort();
  }

  /**
   * Normalize variable definitions
   * @param {Object} variables - Raw variable definitions
   * @returns {Object} Normalized variable definitions
   */
  _normalizeVariableDefinitions(variables) {
    const normalized = {};
    
    for (const [name, definition] of Object.entries(variables)) {
      normalized[name] = this._normalizeVariableDefinition(definition);
    }
    
    return normalized;
  }

  /**
   * Normalize individual variable definition
   * @param {*} definition - Variable definition
   * @returns {Object} Normalized definition
   */
  _normalizeVariableDefinition(definition) {
    if (typeof definition === 'string') {
      return {
        type: 'string',
        description: definition,
        required: false
      };
    }
    
    if (typeof definition === 'object' && definition !== null) {
      return {
        type: definition.type || 'string',
        description: definition.description || '',
        required: definition.required === true,
        default: definition.default,
        choices: Array.isArray(definition.choices) ? definition.choices : undefined,
        validation: definition.validation
      };
    }
    
    return {
      type: 'string',
      description: '',
      required: false
    };
  }

  /**
   * Validate chmod permissions
   * @param {*} chmod - Chmod value to validate
   * @returns {Object} Validation result
   */
  _validateChmod(chmod) {
    if (typeof chmod === 'string') {
      if (!/^[0-7]{3,4}$/.test(chmod)) {
        return {
          valid: false,
          errors: ['chmod string must be octal format (e.g., "755", "0644")']
        };
      }
    } else if (typeof chmod === 'number') {
      if (chmod < 0 || chmod > 0o777) {
        return {
          valid: false,
          errors: ['chmod number must be between 0 and 0o777']
        };
      }
    } else {
      return {
        valid: false,
        errors: ['chmod must be a string or number']
      };
    }
    
    return { valid: true, errors: [] };
  }

  /**
   * Validate shell commands
   * @param {*} sh - Shell commands to validate
   * @returns {Object} Validation result
   */
  _validateShellCommands(sh) {
    const warnings = [];
    
    if (typeof sh === 'string') {
      if (sh.includes('rm -rf /') || sh.includes('sudo')) {
        warnings.push('Shell command contains potentially dangerous operations');
      }
      return { valid: true, errors: [], warnings };
    }
    
    if (Array.isArray(sh)) {
      const errors = [];
      
      sh.forEach((command, index) => {
        if (typeof command !== 'string') {
          errors.push(`Shell command at index ${index} must be a string`);
        } else if (command.includes('rm -rf /') || command.includes('sudo')) {
          warnings.push(`Shell command at index ${index} contains potentially dangerous operations`);
        }
      });
      
      return { valid: errors.length === 0, errors, warnings };
    }
    
    return {
      valid: false,
      errors: ['Shell commands (sh) must be a string or array of strings']
    };
  }

  /**
   * Validate skipIf condition
   * @param {*} skipIf - SkipIf condition to validate
   * @returns {Object} Validation result
   */
  _validateSkipIfCondition(skipIf) {
    if (typeof skipIf !== 'string') {
      return {
        valid: false,
        errors: ['skipIf condition must be a string']
      };
    }
    
    const warnings = [];
    
    // Check for complex expressions that might not be supported
    if (skipIf.includes('&&') || skipIf.includes('||')) {
      warnings.push('Complex skipIf expressions with && or || may not be fully supported');
    }
    
    return { valid: true, errors: [], warnings };
  }

  /**
   * Validate variable definitions
   * @param {*} variables - Variable definitions to validate
   * @returns {Object} Validation result
   */
  _validateVariableDefinitions(variables) {
    if (typeof variables !== 'object' || variables === null) {
      return {
        valid: false,
        errors: ['variables must be an object']
      };
    }
    
    const errors = [];
    const warnings = [];
    
    for (const [name, definition] of Object.entries(variables)) {
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
        errors.push(`Variable name "${name}" must be a valid identifier`);
      }
      
      if (typeof definition === 'object' && definition !== null) {
        if (definition.type && !['string', 'number', 'boolean', 'array', 'object'].includes(definition.type)) {
          warnings.push(`Unknown variable type "${definition.type}" for variable "${name}"`);
        }
      }
    }
    
    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Perform semantic validation (placeholder for extension)
   * @param {Object} frontmatter - Frontmatter to validate
   * @param {Object} options - Validation options
   * @returns {Promise<Object>} Semantic validation result
   */
  async _performSemanticValidation(frontmatter, options = {}) {
    // This is a placeholder for more advanced semantic validation
    // Could be extended to validate against schemas, check path conflicts, etc.
    return {
      errors: [],
      warnings: []
    };
  }

  /**
   * Normalize chmod value to octal number
   * @param {string|number} chmod - Chmod value to normalize
   * @returns {number} Normalized chmod as octal number
   */
  _normalizeChmod(chmod) {
    if (typeof chmod === 'number') {
      return chmod;
    }
    
    if (typeof chmod === 'string') {
      return chmod.startsWith('0') 
        ? parseInt(chmod, 8)
        : parseInt(chmod, 8);
    }
    
    return 0o644; // Default permissions
  }

  /**
   * Generate cache key for deterministic caching
   * @param {string} content - Template content
   * @param {boolean} enableSemanticValidation - Semantic validation flag
   * @param {Object} options - Parse options
   * @returns {string} Cache key
   */
  _generateCacheKey(content, enableSemanticValidation, options) {
    const keyData = {
      contentHash: this._simpleHash(content),
      semanticValidation: enableSemanticValidation,
      options: JSON.stringify(options || {})
    };
    
    return this._simpleHash(JSON.stringify(keyData));
  }

  /**
   * Simple hash function for cache keys
   * @param {string} str - String to hash
   * @returns {string} Hash value
   */
  _simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Clear parser caches
   */
  clearCache() {
    this.parseCache.clear();
    this.validationCache.clear();
    this.emit('cache:cleared');
  }

  /**
   * Get parser statistics
   */
  getStatistics() {
    return {
      cacheSize: this.parseCache.size,
      validationCacheSize: this.validationCache.size,
      options: this.options
    };
  }
}

export default FrontmatterParser;