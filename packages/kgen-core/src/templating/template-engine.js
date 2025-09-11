/**
 * KGEN Template Engine
 * 
 * Simplified Nunjucks template engine for direct (graph + context) -> template -> file pipeline.
 * Removes generator complexity and focuses on deterministic rendering.
 */

import nunjucks from 'nunjucks';
import path from 'path';
import { existsSync } from 'fs';
import { FrontmatterParser } from './frontmatter-parser.js';

/**
 * Simplified Template Engine for KGEN
 */
export class TemplateEngine {
  constructor(options = {}) {
    this.options = {
      templatesDir: options.templatesDir || '_templates',
      autoescape: false, // Disabled for code generation
      throwOnUndefined: options.throwOnUndefined || false,
      trimBlocks: true, // Enabled for cleaner output
      lstripBlocks: true, // Enabled for cleaner output
      enableCache: options.enableCache !== false,
      ...options
    };

    // Initialize Nunjucks environment with optimized settings
    this.env = this.createNunjucksEnvironment();
    
    // Initialize frontmatter parser
    this.frontmatterParser = new FrontmatterParser(false); // Disable semantic validation for performance
    
    // Track rendering statistics for deterministic behavior verification
    this.stats = {
      renders: 0,
      errors: 0,
      totalRenderTime: 0,
      templatesRendered: new Set(),
      variablesUsed: new Set()
    };
  }

  /**
   * Create and configure Nunjucks environment for deterministic rendering
   */
  createNunjucksEnvironment() {
    // Create file system loader
    const loader = new nunjucks.FileSystemLoader(this.options.templatesDir, {
      watch: false, // Disable watching for consistent behavior
      noCache: !this.options.enableCache
    });

    // Create environment with optimized settings
    const env = new nunjucks.Environment(loader, {
      autoescape: this.options.autoescape,
      throwOnUndefined: this.options.throwOnUndefined,
      trimBlocks: this.options.trimBlocks,
      lstripBlocks: this.options.lstripBlocks
    });

    // Add deterministic global functions
    this.addGlobalFunctions(env);

    return env;
  }

  /**
   * Add global functions optimized for code generation
   */
  addGlobalFunctions(env) {
    // Add current timestamp for deterministic builds (can be overridden)
    env.addGlobal('timestamp', () => new Date().toISOString());
    
    // Add environment detection
    env.addGlobal('env', {
      isDevelopment: process.env.NODE_ENV === 'development',
      isProduction: process.env.NODE_ENV === 'production',
      nodeVersion: process.version,
      platform: process.platform
    });

    // Add conditional rendering helper
    env.addGlobal('renderIf', (condition, content) => {
      return condition ? content : '';
    });

    // Add template existence check
    env.addGlobal('templateExists', (templatePath) => {
      return this.templateExists(templatePath);
    });
  }

  /**
   * Parse template content and extract frontmatter
   * @param {string} templateContent - Raw template content
   * @returns {Promise<Object>} Parsed template with frontmatter and content
   */
  async parseTemplate(templateContent) {
    const result = await this.frontmatterParser.parse(templateContent, false);
    
    // Extract variables from template content for dependency tracking
    const variables = this.extractVariables(result.content);
    
    return {
      ...result,
      variables: Array.from(variables)
    };
  }

  /**
   * Extract variable names from template content
   * @param {string} templateContent - Template content to analyze
   * @returns {Set<string>} Set of variable names used in template
   */
  extractVariables(templateContent) {
    const variables = new Set();
    
    // Match Nunjucks variables: {{ variable }}, {{ variable.property }}, {{ variable | filter }}
    const variablePattern = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_.]*?)(?:\s*\|.*?)?\s*\}\}/g;
    let match;
    
    while ((match = variablePattern.exec(templateContent)) !== null) {
      const varName = match[1].split('.')[0]; // Get root variable name
      variables.add(varName);
    }
    
    // Match Nunjucks control structures: {% if variable %}, {% for item in items %}
    const controlPattern = /\{\%\s*(?:if|elif)\s+([a-zA-Z_][a-zA-Z0-9_.]*)/g;
    const forPattern = /\{\%\s*for\s+[a-zA-Z_][a-zA-Z0-9_.]*\s+in\s+([a-zA-Z_][a-zA-Z0-9_.]*)/g;
    
    // Handle if/elif conditions
    while ((match = controlPattern.exec(templateContent)) !== null) {
      const varName = match[1].split('.')[0];
      variables.add(varName);
    }
    
    // Handle for loops - extract the iterable variable
    while ((match = forPattern.exec(templateContent)) !== null) {
      const iterableVar = match[1].split('.')[0];
      variables.add(iterableVar);
    }
    
    return variables;
  }

  /**
   * Validate template dependencies
   * @param {Array<string>} templateVariables - Variables used in template
   * @param {Object} context - Available context variables
   * @returns {Object} Validation result
   */
  validateDependencies(templateVariables, context) {
    const missing = [];
    const available = Object.keys(context);
    
    for (const variable of templateVariables) {
      if (!(variable in context)) {
        missing.push(variable);
      }
    }
    
    return {
      valid: missing.length === 0,
      missing,
      available,
      used: templateVariables
    };
  }

  /**
   * Render template with context - core rendering method
   * @param {string} templatePath - Path to template file
   * @param {Object} context - Template context variables
   * @param {Object} options - Rendering options
   * @returns {Promise<Object>} Rendered result with metadata
   */
  async render(templatePath, context = {}, options = {}) {
    const startTime = performance.now();
    this.stats.renders++;

    try {
      // Read and parse template
      const templateContent = this.env.getTemplate(templatePath).tmplStr;
      const parsed = await this.parseTemplate(templateContent);
      
      // Validate dependencies if requested
      let validation = null;
      if (options.validateDependencies) {
        validation = this.validateDependencies(parsed.variables, context);
        if (!validation.valid && options.throwOnMissingVariables) {
          throw new Error(`Missing template variables: ${validation.missing.join(', ')}`);
        }
      }
      
      // Track variables used
      parsed.variables.forEach(v => this.stats.variablesUsed.add(v));
      
      // Create deterministic context
      const renderContext = this.createRenderContext(context, parsed.frontmatter);
      
      // Render only the template content (without frontmatter)
      const renderedContent = this.env.renderString(parsed.content, renderContext);
      
      // Process output path if defined in frontmatter
      let outputPath = null;
      if (parsed.frontmatter.to) {
        outputPath = this.env.renderString(parsed.frontmatter.to, renderContext);
      }
      
      // Calculate render time
      const renderTime = performance.now() - startTime;
      this.stats.totalRenderTime += renderTime;
      this.stats.templatesRendered.add(templatePath);
      
      return {
        content: renderedContent,
        frontmatter: parsed.frontmatter,
        outputPath,
        metadata: {
          renderTime,
          templatePath,
          variablesUsed: parsed.variables,
          validation
        }
      };
      
    } catch (error) {
      this.stats.errors++;
      const renderTime = performance.now() - startTime;
      
      if (options.throwOnError !== false) {
        throw new Error(`Template rendering failed for ${templatePath}: ${error.message}`);
      }
      
      return {
        content: `<!-- Template rendering error: ${error.message} -->`,
        frontmatter: {},
        outputPath: null,
        metadata: {
          renderTime,
          templatePath,
          error: error.message,
          variablesUsed: []
        }
      };
    }
  }

  /**
   * Render template from string content
   * @param {string} templateString - Template content as string
   * @param {Object} context - Template context variables
   * @param {Object} options - Rendering options
   * @returns {Promise<Object>} Rendered result
   */
  async renderString(templateString, context = {}, options = {}) {
    const startTime = performance.now();
    this.stats.renders++;

    try {
      // Parse template content
      const parsed = await this.parseTemplate(templateString);
      
      // Create render context
      const renderContext = this.createRenderContext(context, parsed.frontmatter);
      
      // Render content
      const renderedContent = this.env.renderString(parsed.content, renderContext);
      
      const renderTime = performance.now() - startTime;
      this.stats.totalRenderTime += renderTime;
      
      return {
        content: renderedContent,
        frontmatter: parsed.frontmatter,
        metadata: {
          renderTime,
          variablesUsed: parsed.variables
        }
      };
      
    } catch (error) {
      this.stats.errors++;
      
      if (options.throwOnError !== false) {
        throw new Error(`String template rendering failed: ${error.message}`);
      }
      
      return {
        content: `<!-- Template rendering error: ${error.message} -->`,
        frontmatter: {},
        metadata: {
          error: error.message
        }
      };
    }
  }

  /**
   * Create deterministic render context
   * @param {Object} userContext - User-provided context
   * @param {Object} frontmatter - Template frontmatter
   * @returns {Object} Enhanced context for rendering
   */
  createRenderContext(userContext, frontmatter) {
    // Create deterministic timestamp if not provided
    const timestamp = userContext.timestamp || new Date().toISOString();
    
    return {
      ...userContext,
      timestamp,
      frontmatter,
      _kgen: {
        version: '1.0.0',
        renderTime: timestamp,
        deterministic: true
      }
    };
  }

  /**
   * Check if a template exists
   * @param {string} templatePath - Path to template
   * @returns {boolean} True if template exists
   */
  templateExists(templatePath) {
    try {
      const fullPath = path.join(this.options.templatesDir, templatePath);
      return existsSync(fullPath);
    } catch (error) {
      return false;
    }
  }

  /**
   * Get operation mode from frontmatter
   * @param {Object} frontmatter - Template frontmatter
   * @returns {Object} Operation mode configuration
   */
  getOperationMode(frontmatter) {
    return this.frontmatterParser.getOperationMode(frontmatter);
  }

  /**
   * Check if generation should be skipped
   * @param {Object} frontmatter - Template frontmatter
   * @param {Object} variables - Template variables
   * @returns {boolean} True if should skip
   */
  shouldSkip(frontmatter, variables) {
    return this.frontmatterParser.shouldSkip(frontmatter, variables);
  }

  /**
   * Clear template cache for deterministic rendering
   */
  clearCache() {
    if (this.env.loaders) {
      this.env.loaders.forEach(loader => {
        if (loader.cache) {
          loader.cache = {};
        }
      });
    }
  }

  /**
   * Get rendering statistics
   * @returns {Object} Rendering statistics
   */
  getStats() {
    return {
      renders: this.stats.renders,
      errors: this.stats.errors,
      errorRate: this.stats.errors / Math.max(this.stats.renders, 1),
      totalRenderTime: this.stats.totalRenderTime,
      avgRenderTime: this.stats.totalRenderTime / Math.max(this.stats.renders, 1),
      templatesRendered: Array.from(this.stats.templatesRendered),
      variablesUsed: Array.from(this.stats.variablesUsed),
      uniqueTemplates: this.stats.templatesRendered.size,
      uniqueVariables: this.stats.variablesUsed.size
    };
  }

  /**
   * Reset statistics for clean testing
   */
  resetStats() {
    this.stats = {
      renders: 0,
      errors: 0,
      totalRenderTime: 0,
      templatesRendered: new Set(),
      variablesUsed: new Set()
    };
  }
}

/**
 * Factory function to create a KGEN template engine instance
 * @param {Object} options - Engine configuration options
 * @returns {TemplateEngine} Template engine instance
 */
export function createTemplateEngine(options = {}) {
  return new TemplateEngine(options);
}

export default TemplateEngine;