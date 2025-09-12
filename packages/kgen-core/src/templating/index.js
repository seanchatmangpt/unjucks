/**
 * KGEN Templating Module - Main Entry Point
 * 
 * Simplified template engine with direct RDF graph integration
 * Replaces complex legacy templating with focused, deterministic pipeline
 */

import { TemplateRenderer, createRenderer } from './renderer.js';
import { FrontmatterParser } from './frontmatter.js';
import { TemplateContext } from './context.js';

export { TemplateRenderer, createRenderer, FrontmatterParser, TemplateContext };

/**
 * Create a complete template engine with all components
 */
export function createTemplateEngine(options = {}) {
  const renderer = new TemplateRenderer(options);
  
  return {
    renderer,
    
    // Direct methods for easy access
    render: (templatePath, context, rdfData) => 
      renderer.render(templatePath, context, rdfData),
    
    generate: (templatePath, context, rdfData) => 
      renderer.generate(templatePath, context, rdfData),
    
    writeOutput: (renderResult) => 
      renderer.writeOutput(renderResult),
    
    templateExists: (templatePath) => 
      renderer.templateExists(templatePath),
    
    listTemplates: () => 
      renderer.listTemplates(),
    
    getStats: () => 
      renderer.getStats(),
    
    reset: () => 
      renderer.reset()
  };
}

/**
 * Quick start - render template with minimal setup
 */
export async function renderTemplate(templatePath, context = {}, options = {}) {
  const engine = createTemplateEngine(options);
  return await engine.render(templatePath, context);
}

/**
 * Quick start - generate file from template
 */
export async function generateFromTemplate(templatePath, context = {}, options = {}) {
  const engine = createTemplateEngine(options);
  return await engine.generate(templatePath, context);
}

export default createTemplateEngine;