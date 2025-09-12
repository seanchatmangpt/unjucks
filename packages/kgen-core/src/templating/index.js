/**
 * KGEN Enhanced Templating Module
 * 
 * Main entry point for KGEN template engine functionality.
 * Provides enhanced, deterministic template rendering with filter pipeline
 * and RDF integration, migrated from UNJUCKS.
 */

import { TemplateEngine, createTemplateEngine } from './template-engine.js';
import { FrontmatterParser } from './frontmatter-parser.js';
import { TemplateRenderer, createRenderer } from './renderer.js';
import { createDeterministicFilters } from './deterministic-filters.js';
import { RDFFilters, createRDFFilters, registerRDFFilters } from './rdf-filters.js';

export { 
  TemplateEngine, 
  createTemplateEngine, 
  FrontmatterParser, 
  TemplateRenderer, 
  createRenderer,
  createDeterministicFilters,
  RDFFilters,
  createRDFFilters,
  registerRDFFilters
};

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
    
    // Enhanced capabilities
    getAvailableFilters() {
      return engine.getAvailableFilters();
    },
    
    updateRDFStore(triples) {
      return engine.updateRDFStore(triples);
    },
    
    clearRDFStore() {
      return engine.clearRDFStore();
    },
    
    addFilter(name, fn, options) {
      return engine.addFilter(name, fn, options);
    },
    
    getEnvironment() {
      return engine.getEnvironment();
    },
    
    reset() {
      engine.resetStats();
      engine.clearCache();
      renderer.reset();
    }
  };
}

/**
 * Create enhanced template engine with all features enabled
 * @param {Object} options - Engine configuration options
 * @returns {TemplateEngine} Fully featured template engine
 */
export function createEnhancedTemplateEngine(options = {}) {
  return new TemplateEngine({
    enableFilters: true,
    enableRDF: true,
    enableCache: true,
    deterministic: true,
    contentAddressing: true,
    throwOnUndefined: false,
    ...options
  });
}

export default createTemplatingSystem;
