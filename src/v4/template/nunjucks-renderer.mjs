/**
 * @file Nunjucks Renderer
 * @module unjucks-v4/template/nunjucks-renderer
 * @description Nunjucks template rendering with context and filters
 */

import nunjucks from 'nunjucks';
import { EventEmitter } from 'events';
import { FilterRegistry } from './filter-registry.mjs';

/**
 * Nunjucks Renderer - Renders Nunjucks templates with context and filters
 * 
 * @class NunjucksRenderer
 * @extends EventEmitter
 */
export class NunjucksRenderer extends EventEmitter {
  /**
   * Create a new NunjucksRenderer instance
   * @param {Object} options - Renderer options
   * @param {string} options.templatesDir - Templates directory
   * @param {FilterRegistry} options.filterRegistry - Filter registry instance
   * @param {Object} options.nunjucksConfig - Nunjucks configuration
   */
  constructor(options = {}) {
    super();
    
    this.config = {
      templatesDir: options.templatesDir || '_templates',
      autoescape: false, // Disabled for code generation
      throwOnUndefined: options.throwOnUndefined || false,
      trimBlocks: true,
      lstripBlocks: true,
      ...options.nunjucksConfig
    };

    this.filterRegistry = options.filterRegistry || new FilterRegistry();
    this.env = this._createEnvironment();
  }

  /**
   * Create Nunjucks environment
   * @private
   * @returns {nunjucks.Environment} Nunjucks environment
   */
  _createEnvironment() {
    const loader = new nunjucks.FileSystemLoader(this.config.templatesDir, {
      watch: false,
      noCache: false
    });

    const env = new nunjucks.Environment(loader, {
      autoescape: this.config.autoescape,
      throwOnUndefined: this.config.throwOnUndefined,
      trimBlocks: this.config.trimBlocks,
      lstripBlocks: this.config.lstripBlocks
    });

    // Register filters
    this.filterRegistry.registerAll(env);

    return env;
  }

  /**
   * Render template string with context
   * @param {string} template - Template content
   * @param {Object} context - Template context
   * @param {Object} options - Rendering options
   * @returns {Promise<string>} Rendered content
   */
  async render(template, context = {}, options = {}) {
    try {
      this.emit('render:start', { template: template.substring(0, 100), context });

      // Enhance context with utilities
      const enhancedContext = {
        ...context,
        _now: new Date(),
        _timestamp: Date.now()
      };

      const rendered = this.env.renderString(template, enhancedContext);

      this.emit('render:complete', { length: rendered.length });
      return rendered;

    } catch (error) {
      this.emit('render:error', { error });
      throw new Error(`Template rendering failed: ${error.message}`);
    }
  }

  /**
   * Render template file
   * @param {string} templatePath - Path to template file
   * @param {Object} context - Template context
   * @param {Object} options - Rendering options
   * @returns {Promise<string>} Rendered content
   */
  async renderFile(templatePath, context = {}, options = {}) {
    try {
      this.emit('render:start', { templatePath, context });

      const enhancedContext = {
        ...context,
        _now: new Date(),
        _timestamp: Date.now()
      };

      const rendered = await new Promise((resolve, reject) => {
        this.env.render(templatePath, enhancedContext, (err, result) => {
          if (err) reject(err);
          else resolve(result);
        });
      });

      this.emit('render:complete', { templatePath, length: rendered.length });
      return rendered;

    } catch (error) {
      this.emit('render:error', { templatePath, error });
      throw new Error(`Template file rendering failed: ${error.message}`);
    }
  }
}


