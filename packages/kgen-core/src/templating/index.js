/**
 * KGEN Templating Module
 * 
 * Main entry point for KGEN template engine functionality.
 * Provides simplified, deterministic template rendering for code generation.
 */

import { TemplateEngine, createTemplateEngine } from './template-engine.js';
import { FrontmatterParser } from './frontmatter-parser.js';
import { TemplateRenderer, createRenderer } from './renderer.js';

export { TemplateEngine, createTemplateEngine, FrontmatterParser, TemplateRenderer, createRenderer };

/**
 * Create a complete templating system with engine and renderer
 * @param {Object} options - Configuration options
 * @returns {Object} Templating system with engine and renderer
 */
export function createTemplatingSystem(options = {}) {
  const engine = createTemplateEngine(options);
  const renderer = createRenderer(options);
  
  return {
    engine,
    renderer,
    
    // Convenience methods
    async render(templatePath, context, options) {
      return engine.render(templatePath, context, options);
    },
    
    async renderString(templateString, context, options) {
      return engine.renderString(templateString, context, options);
    },
    
    async renderToFile(templatePath, context, options) {
      return renderer.renderToFile(templatePath, context, options);
    },
    
    async renderMultiple(templates, globalContext, options) {
      return renderer.renderMultiple(templates, globalContext, options);
    },
    
    // Utility methods
    templateExists(templatePath) {
      return engine.templateExists(templatePath);
    },
    
    getStats() {
      return {
        engine: engine.getStats(),
        renderer: renderer.getStats()
      };
    },
    
    reset() {
      engine.resetStats();
      renderer.reset();
    }
  };
}

export default createTemplatingSystem;