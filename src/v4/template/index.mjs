/**
 * @file Template Engine Module Exports
 * @module unjucks-v4/template
 */

import { FrontmatterParser } from './frontmatter-parser.mjs';
import { NunjucksRenderer } from './nunjucks-renderer.mjs';
import { HygenGenerator } from './hygen-generator.mjs';
import { VariableExtractor } from './variable-extractor.mjs';
import { PathResolver } from './path-resolver.mjs';
import { OperationEngine } from './operation-engine.mjs';
import { FilterRegistry } from './filter-registry.mjs';
import { ConditionalProcessor } from './conditional-processor.mjs';
import { RDFIntegration } from './rdf-integration.mjs';

/**
 * Template Engine - Main template processing engine
 * 
 * @class TemplateEngine
 */
export class TemplateEngine {
  /**
   * Create a new TemplateEngine instance
   * @param {Object} options - Engine options
   */
  constructor(options = {}) {
    this.config = {
      templatesDir: options.templatesDir || '_templates',
      ...options
    };

    // Initialize components
    this.filterRegistry = new FilterRegistry();
    this.frontmatterParser = new FrontmatterParser();
    this.nunjucksRenderer = new NunjucksRenderer({
      templatesDir: this.config.templatesDir,
      filterRegistry: this.filterRegistry
    });
    this.hygenGenerator = new HygenGenerator({
      templatesDir: this.config.templatesDir
    });
    this.variableExtractor = new VariableExtractor();
    this.pathResolver = new PathResolver({
      renderer: this.nunjucksRenderer
    });
    this.conditionalProcessor = new ConditionalProcessor({
      renderer: this.nunjucksRenderer
    });
    this.rdfIntegration = new RDFIntegration({
      rdfEngine: options.rdfEngine
    });
    this.operationEngine = new OperationEngine({
      pathResolver: this.pathResolver,
      fileOps: options.fileOps
    });
  }

  /**
   * Initialize the template engine
   * @returns {Promise<void>}
   */
  async initialize() {
    // Initialization complete in constructor
  }

  /**
   * Process a template file
   * @param {Object} template - Template file object
   * @param {Object} context - Template context
   * @param {Object} options - Processing options
   * @returns {Promise<Object>} Processing result
   */
  async processTemplate(template, context = {}, options = {}) {
    const { readFile } = await import('fs/promises');
    
    try {
      // Read template content
      const content = await readFile(template.path, 'utf-8');

      // Parse frontmatter
      const parsed = this.frontmatterParser.parse(content);

      // Evaluate skipIf condition
      const conditional = await this.conditionalProcessor.evaluate(
        parsed.frontmatter.skipIf,
        context
      );

      if (conditional.skip) {
        return {
          skipped: true,
          reason: conditional.reason || 'skipIf condition met',
          artifacts: []
        };
      }

      // Integrate RDF data if configured
      let enhancedContext = context;
      if (parsed.frontmatter._rdfConfig) {
        enhancedContext = await this.rdfIntegration.integrate(
          parsed.frontmatter._rdfConfig,
          context
        );
      }

      // Render template
      const rendered = await this.nunjucksRenderer.render(
        parsed.content,
        enhancedContext
      );

      // Execute file operation
      const operationResult = await this.operationEngine.execute(
        parsed.frontmatter,
        rendered,
        enhancedContext
      );

      return {
        success: true,
        artifacts: [operationResult],
        metadata: {
          template: template.path,
          operation: operationResult.operation,
          path: operationResult.path
        }
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        artifacts: []
      };
    }
  }
}

// Export all components
export {
  FrontmatterParser,
  NunjucksRenderer,
  HygenGenerator,
  VariableExtractor,
  PathResolver,
  OperationEngine,
  FilterRegistry,
  ConditionalProcessor,
  RDFIntegration
};


