/**
 * Frontmatter Parser
 * 
 * Parses and validates template frontmatter directives for
 * template processing, injection modes, and file operations.
 */

import matter from 'gray-matter';
import { z } from 'zod';

import { Logger } from '../utils/logger.js';

// Frontmatter schema definitions
const FrontmatterSchema = z.object({
  // Required fields
  to: z.string().min(1, 'Output path is required'),
  
  // Core directives
  inject: z.boolean().default(false),
  skipIf: z.union([z.string(), z.boolean()]).optional(),
  chmod: z.string().optional(),
  sh: z.string().optional(),
  
  // Injection directives
  append: z.boolean().default(false),
  prepend: z.boolean().default(false),
  lineAt: z.number().int().positive().optional(),
  before: z.string().optional(),
  after: z.string().optional(),
  replace: z.string().optional(),
  
  // Metadata
  meta: z.object({
    description: z.string().optional(),
    category: z.string().optional(),
    tags: z.array(z.string()).default([]),
    variables: z.array(z.object({
      name: z.string(),
      type: z.enum(['string', 'boolean', 'number', 'array', 'object']).default('string'),
      required: z.boolean().default(true),
      default: z.any().optional(),
      description: z.string().optional()
    })).default([])
  }).optional(),
  
  // Semantic web metadata
  rdf: z.object({
    type: z.string().optional(),
    name: z.string().optional(),
    describes: z.string().optional(),
    implements: z.array(z.string()).default([])
  }).optional()
});

/**
 * Frontmatter Parser and Validator
 * 
 * Handles parsing, validation, and processing of template frontmatter
 * with comprehensive directive support and semantic validation.
 */
export class FrontmatterParser {
  /**
   * Initialize the frontmatter parser
   * @param {Object} options - Configuration options
   * @param {Object} options.logger - Logger instance
   * @param {boolean} options.strict - Enable strict validation mode
   */
  constructor(options = {}) {
    this.logger = options.logger || new Logger();
    this.strict = options.strict !== false;
    this.validationCache = new Map();
  }

  /**
   * Parse template content and extract frontmatter
   * @param {string} content - Template content with frontmatter
   * @param {string} templatePath - Template file path for context
   * @returns {Object} Parsed frontmatter and content
   */
  parse(content, templatePath = '') {
    try {
      this.logger.debug('Parsing frontmatter', { templatePath });

      // Parse using gray-matter
      const { data: rawFrontmatter, content: templateBody } = matter(content);

      // Validate and normalize frontmatter
      const frontmatter = this.validate(rawFrontmatter, templatePath);

      // Process dynamic directives
      const processedFrontmatter = this.processDirectives(frontmatter, templatePath);

      return {
        frontmatter: processedFrontmatter,
        content: templateBody,
        raw: rawFrontmatter
      };

    } catch (error) {
      this.logger.error('Failed to parse frontmatter', {
        templatePath,
        error: error.message
      });
      throw new Error(`Frontmatter parsing failed: ${error.message}`);
    }
  }

  /**
   * Validate frontmatter against schema
   * @param {Object} frontmatter - Raw frontmatter object
   * @param {string} templatePath - Template path for error context
   * @returns {Object} Validated frontmatter
   */
  validate(frontmatter, templatePath = '') {
    try {
      // Check cache first
      const cacheKey = JSON.stringify(frontmatter) + templatePath;
      if (this.validationCache.has(cacheKey)) {
        return this.validationCache.get(cacheKey);
      }

      // Validate against schema
      const validatedFrontmatter = FrontmatterSchema.parse(frontmatter);

      // Additional validation rules
      this.validateInjectionMode(validatedFrontmatter, templatePath);
      this.validateConditionalLogic(validatedFrontmatter, templatePath);
      this.validatePathTemplate(validatedFrontmatter, templatePath);

      // Cache the result
      this.validationCache.set(cacheKey, validatedFrontmatter);

      this.logger.debug('Frontmatter validation successful', {
        templatePath,
        inject: validatedFrontmatter.inject,
        directives: this.getActiveDirectives(validatedFrontmatter)
      });

      return validatedFrontmatter;

    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationErrors = error.errors.map(err => 
          `${err.path.join('.')}: ${err.message}`
        ).join(', ');
        
        this.logger.error('Frontmatter validation failed', {
          templatePath,
          errors: validationErrors
        });
        
        throw new Error(`Invalid frontmatter in ${templatePath}: ${validationErrors}`);
      }
      
      throw error;
    }
  }

  /**
   * Validate injection mode configuration
   * @param {Object} frontmatter - Validated frontmatter
   * @param {string} templatePath - Template path for error context
   */
  validateInjectionMode(frontmatter, templatePath) {
    if (!frontmatter.inject) return;

    const injectionModes = [
      frontmatter.append,
      frontmatter.prepend,
      frontmatter.lineAt,
      frontmatter.before,
      frontmatter.after,
      frontmatter.replace
    ].filter(Boolean);

    if (injectionModes.length === 0) {
      throw new Error(
        `Injection mode enabled but no injection directive specified in ${templatePath}`
      );
    }

    if (injectionModes.length > 1) {
      this.logger.warn('Multiple injection directives specified', {
        templatePath,
        modes: this.getActiveDirectives(frontmatter)
      });
    }
  }

  /**
   * Validate conditional logic syntax
   * @param {Object} frontmatter - Validated frontmatter
   * @param {string} templatePath - Template path for error context
   */
  validateConditionalLogic(frontmatter, templatePath) {
    if (!frontmatter.skipIf) return;

    if (typeof frontmatter.skipIf === 'string') {
      // Basic template syntax validation
      const templatePattern = /\{\{[^}]+\}\}/;
      if (frontmatter.skipIf.includes('{{') && !templatePattern.test(frontmatter.skipIf)) {
        throw new Error(
          `Invalid template syntax in skipIf condition: ${frontmatter.skipIf} in ${templatePath}`
        );
      }
    }
  }

  /**
   * Validate output path template
   * @param {Object} frontmatter - Validated frontmatter
   * @param {string} templatePath - Template path for error context
   */
  validatePathTemplate(frontmatter, templatePath) {
    if (!frontmatter.to) return;

    // Check for balanced template syntax
    const openBraces = (frontmatter.to.match(/\{\{/g) || []).length;
    const closeBraces = (frontmatter.to.match(/\}\}/g) || []).length;

    if (openBraces !== closeBraces) {
      throw new Error(
        `Unbalanced template braces in output path: ${frontmatter.to} in ${templatePath}`
      );
    }

    // Validate path safety
    if (frontmatter.to.includes('..') || frontmatter.to.startsWith('/')) {
      this.logger.warn('Potentially unsafe output path', {
        templatePath,
        outputPath: frontmatter.to
      });
    }
  }

  /**
   * Process dynamic directives and resolve templates
   * @param {Object} frontmatter - Validated frontmatter
   * @param {string} templatePath - Template path for context
   * @returns {Object} Processed frontmatter
   */
  processDirectives(frontmatter, templatePath) {
    const processed = { ...frontmatter };

    // Process shell command templates
    if (processed.sh && processed.sh.includes('{{')) {
      processed._hasShellTemplate = true;
    }

    // Process chmod template
    if (processed.chmod && processed.chmod.includes('{{')) {
      processed._hasChmodTemplate = true;
    }

    // Process injection patterns
    if (processed.inject) {
      processed._injectionMode = this.determineInjectionMode(processed);
    }

    // Add processing metadata
    processed._processed = {
      templatePath,
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    };

    return processed;
  }

  /**
   * Determine primary injection mode
   * @param {Object} frontmatter - Frontmatter object
   * @returns {string} Primary injection mode
   */
  determineInjectionMode(frontmatter) {
    if (frontmatter.append) return 'append';
    if (frontmatter.prepend) return 'prepend';
    if (frontmatter.lineAt) return 'lineAt';
    if (frontmatter.before) return 'before';
    if (frontmatter.after) return 'after';
    if (frontmatter.replace) return 'replace';
    return 'append'; // default
  }

  /**
   * Get list of active directives
   * @param {Object} frontmatter - Frontmatter object
   * @returns {Array<string>} Active directive names
   */
  getActiveDirectives(frontmatter) {
    const directives = [];
    
    if (frontmatter.inject) directives.push('inject');
    if (frontmatter.append) directives.push('append');
    if (frontmatter.prepend) directives.push('prepend');
    if (frontmatter.lineAt) directives.push('lineAt');
    if (frontmatter.before) directives.push('before');
    if (frontmatter.after) directives.push('after');
    if (frontmatter.replace) directives.push('replace');
    if (frontmatter.skipIf) directives.push('skipIf');
    if (frontmatter.chmod) directives.push('chmod');
    if (frontmatter.sh) directives.push('sh');

    return directives;
  }

  /**
   * Check if template should be skipped based on condition
   * @param {Object} frontmatter - Frontmatter object
   * @param {Object} variables - Template variables for condition evaluation
   * @returns {boolean} True if template should be skipped
   */
  shouldSkip(frontmatter, variables = {}) {
    if (!frontmatter.skipIf) return false;

    try {
      if (typeof frontmatter.skipIf === 'boolean') {
        return frontmatter.skipIf;
      }

      if (typeof frontmatter.skipIf === 'string') {
        // Simple template evaluation
        const condition = frontmatter.skipIf;
        
        // Handle simple variable conditions
        if (condition.startsWith('{{ ') && condition.endsWith(' }}')) {
          const expression = condition.slice(3, -3).trim();
          
          // Handle negation
          if (expression.startsWith('!')) {
            const varName = expression.slice(1);
            return !variables[varName];
          }
          
          return Boolean(variables[expression]);
        }
        
        // For complex conditions, defer to template engine
        return false;
      }

      return false;

    } catch (error) {
      this.logger.error('Error evaluating skipIf condition', {
        condition: frontmatter.skipIf,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Extract variable requirements from frontmatter
   * @param {Object} frontmatter - Frontmatter object
   * @returns {Array<Object>} Required variables
   */
  extractVariableRequirements(frontmatter) {
    const requirements = [];
    
    // Variables from metadata
    if (frontmatter.meta?.variables) {
      requirements.push(...frontmatter.meta.variables);
    }

    // Variables from path template
    if (frontmatter.to) {
      const pathVars = this.extractTemplateVariables(frontmatter.to);
      pathVars.forEach(varName => {
        if (!requirements.find(req => req.name === varName)) {
          requirements.push({
            name: varName,
            type: 'string',
            required: true,
            description: `Path variable: ${varName}`,
            source: 'path'
          });
        }
      });
    }

    // Variables from conditional logic
    if (frontmatter.skipIf && typeof frontmatter.skipIf === 'string') {
      const condVars = this.extractTemplateVariables(frontmatter.skipIf);
      condVars.forEach(varName => {
        if (!requirements.find(req => req.name === varName)) {
          requirements.push({
            name: varName,
            type: 'boolean',
            required: false,
            description: `Condition variable: ${varName}`,
            source: 'condition'
          });
        }
      });
    }

    return requirements;
  }

  /**
   * Extract variable names from template string
   * @param {string} template - Template string
   * @returns {Array<string>} Variable names
   */
  extractTemplateVariables(template) {
    const variables = [];
    const regex = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;
    let match;

    while ((match = regex.exec(template)) !== null) {
      const varName = match[1];
      if (!variables.includes(varName)) {
        variables.push(varName);
      }
    }

    return variables;
  }

  /**
   * Generate frontmatter schema documentation
   * @returns {Object} Schema documentation
   */
  getSchemaDocumentation() {
    return {
      name: 'Unjucks Frontmatter Schema',
      version: '1.0.0',
      description: 'Template frontmatter directive schema for Unjucks',
      
      required: ['to'],
      
      properties: {
        to: {
          type: 'string',
          description: 'Output file path (supports template variables)',
          example: 'src/{{ name }}.js'
        },
        inject: {
          type: 'boolean',
          description: 'Enable injection mode for file modification',
          default: false
        },
        skipIf: {
          type: 'string|boolean',
          description: 'Condition to skip template processing',
          example: '{{ !withTests }}'
        },
        chmod: {
          type: 'string',
          description: 'File permissions to set after creation',
          example: '755'
        },
        sh: {
          type: 'string',
          description: 'Shell command to execute after processing',
          example: 'npm install {{ package }}'
        }
      },
      
      injectionModes: {
        append: 'Append content to end of file',
        prepend: 'Prepend content to start of file',
        lineAt: 'Insert at specific line number',
        before: 'Insert before matching pattern',
        after: 'Insert after matching pattern',
        replace: 'Replace matching pattern'
      }
    };
  }

  /**
   * Clear validation cache
   */
  clearCache() {
    this.validationCache.clear();
  }

  /**
   * Get validation statistics
   * @returns {Object} Validation statistics
   */
  getStatistics() {
    return {
      cacheSize: this.validationCache.size,
      strict: this.strict
    };
  }
}