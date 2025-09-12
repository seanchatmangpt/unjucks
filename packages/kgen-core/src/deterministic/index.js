/**
 * KGEN Core Deterministic Template System - Entry Point
 * 
 * Complete deterministic template rendering system with:
 * - Nunjucks-based template engine
 * - Frontmatter parsing and validation
 * - Template discovery and loading
 * - Deterministic rendering with 1000-iteration validation
 * - Custom filters (kebabCase, pascalCase, etc.)
 * - Content addressing and hash validation
 */

import { DeterministicRenderer, createDeterministicRenderer } from './renderer.js';
import { FrontmatterParser, createFrontmatterParser, parseFrontmatter } from './frontmatter.js';
import { TemplateLoader, createTemplateLoader } from './template-loader.js';

/**
 * Main KGEN Deterministic Template System
 */
class KgenTemplateSystem {
  constructor(options = {}) {
    this.config = {
      // Renderer options
      deterministicSeed: options.deterministicSeed || 'kgen-core-v1.0.0',
      staticBuildTime: options.staticBuildTime || '2024-01-01T00:00:00.000Z',
      templatesDir: options.templatesDir || '_templates',
      
      // Enable all deterministic features by default
      validateDeterminism: options.validateDeterminism !== false,
      sortObjectKeys: options.sortObjectKeys !== false,
      useContentAddressing: options.useContentAddressing !== false,
      
      ...options
    };
    
    // Initialize components
    this.renderer = new DeterministicRenderer(this.config);
    this.frontmatterParser = new FrontmatterParser(this.config.frontmatter || {});
    this.templateLoader = new TemplateLoader({
      ...this.config,
      frontmatter: this.config.frontmatter
    });
    
    this.logger = this._createLogger('kgen-template-system');
  }
  
  _createLogger(tag) {
    return {
      debug: (msg, ...args) => this.config.debug && console.log(`[${tag}] ${msg}`, ...args),
      info: (msg, ...args) => console.log(`[${tag}] ${msg}`, ...args),
      warn: (msg, ...args) => console.warn(`[${tag}] ${msg}`, ...args),
      error: (msg, ...args) => console.error(`[${tag}] ${msg}`, ...args)
    };
  }
  
  /**
   * Render template by path
   * @param {string} templatePath - Path to template file
   * @param {Object} context - Template context
   * @param {Object} options - Rendering options
   * @returns {Promise<Object>} Render result
   */
  async render(templatePath, context = {}, options = {}) {
    return await this.renderer.render(templatePath, context, options);
  }
  
  /**
   * Render template from string
   * @param {string} templateString - Template content
   * @param {Object} context - Template context  
   * @param {Object} options - Rendering options
   * @returns {Promise<Object>} Render result
   */
  async renderString(templateString, context = {}, options = {}) {
    return await this.renderer.renderString(templateString, context, options);
  }
  
  /**
   * Load template by ID or path
   * @param {string} identifier - Template identifier
   * @returns {Promise<Object>} Template object
   */
  async loadTemplate(identifier) {
    return await this.templateLoader.getTemplate(identifier);
  }
  
  /**
   * Discover all available templates
   * @returns {Promise<Array>} Array of template metadata
   */
  async discoverTemplates() {
    return await this.templateLoader.discoverTemplates();
  }
  
  /**
   * List available templates (summary)
   * @returns {Promise<Array>} Array of template summaries
   */
  async listTemplates() {
    return await this.templateLoader.listTemplates();
  }
  
  /**
   * Parse frontmatter from content
   * @param {string} content - Content with frontmatter
   * @returns {Object} Parsed result
   */
  parseFrontmatter(content) {
    return this.frontmatterParser.parse(content);
  }
  
  /**
   * Test deterministic rendering
   * @param {string} templatePath - Template to test
   * @param {Object} context - Test context
   * @param {number} iterations - Number of iterations (default 1000)
   * @returns {Promise<Object>} Test result
   */
  async testDeterminism(templatePath, context = {}, iterations = 1000) {
    return await this.renderer.testDeterministicRendering(templatePath, context, iterations);
  }
  
  /**
   * Clear all caches
   */
  clearCache() {
    this.renderer.clearCache();
    this.templateLoader.clearCache();
    this.logger.debug('All caches cleared');
  }
  
  /**
   * Get system statistics
   * @returns {Object} Statistics object
   */
  getStatistics() {
    return {
      renderer: this.renderer.getStatistics(),
      templateLoader: this.templateLoader.getStatistics(),
      system: {
        deterministicSeed: this.config.deterministicSeed,
        templatesDir: this.config.templatesDir,
        validateDeterminism: this.config.validateDeterminism
      }
    };
  }
}

/**
 * Factory function for creating the template system
 * @param {Object} options - Configuration options
 * @returns {KgenTemplateSystem} Template system instance
 */
function createTemplateSystem(options = {}) {
  return new KgenTemplateSystem(options);
}

/**
 * Quick render function for simple use cases
 * @param {string} template - Template string
 * @param {Object} context - Template context
 * @param {Object} options - Options
 * @returns {Promise<string>} Rendered content
 */
async function render(template, context = {}, options = {}) {
  const system = createTemplateSystem(options);
  const result = await system.renderString(template, context);
  return result.content;
}

export {
  // Main system
  KgenTemplateSystem,
  createTemplateSystem,
  render,
  
  // Individual components
  DeterministicRenderer,
  createDeterministicRenderer,
  FrontmatterParser,
  createFrontmatterParser,
  parseFrontmatter,
  TemplateLoader,
  createTemplateLoader
};

export const version = "1.0.0";