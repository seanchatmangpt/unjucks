/**
 * @file Core Engine - Orchestration and Workflow
 * @module unjucks-v4/core/engine
 * @description Main orchestration engine coordinating template processing pipeline
 */

import { EventEmitter } from 'events';
import { HygenGenerator } from '../template/hygen-generator.mjs';
import { TemplateEngine } from '../template/index.mjs';
import { RDFEngine } from '../rdf/index.mjs';
import { FileOperations } from '../file-ops/index.mjs';
import { KnowledgeSubstrateCore } from '../knowledge-substrate/core.mjs';
import { PerformanceOptimizer } from '../performance/index.mjs';

/**
 * Core Engine - Orchestrates template processing pipeline
 * 
 * @class CoreEngine
 * @extends EventEmitter
 */
export class CoreEngine extends EventEmitter {
  /**
   * Create a new CoreEngine instance
   * @param {Object} options - Engine configuration
   * @param {string} options.templatesDir - Templates directory path
   * @param {boolean} options.dryRun - Dry run mode
   * @param {boolean} options.force - Force overwrite
   * @param {boolean} options.enableRDF - Enable RDF support
   * @param {boolean} options.enableDarkMatter - Enable Dark Matter optimization
   */
  constructor(options = {}) {
    super();
    
    this.config = {
      templatesDir: options.templatesDir || '_templates',
      dryRun: options.dryRun || false,
      force: options.force || false,
      enableRDF: options.enableRDF !== false,
      enableDarkMatter: options.enableDarkMatter !== false,
      ...options
    };

    this.initialized = false;
    this.hygenGenerator = null;
    this.templateEngine = null;
    this.rdfEngine = null;
    this.fileOps = null;
    this.knowledgeSubstrate = null;
    this.performanceOptimizer = null;
  }

  /**
   * Initialize the engine and all components
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    this.emit('engine:initializing');

    // Initialize Knowledge Substrate Core (80/20 framework)
    if (this.config.enableDarkMatter) {
      this.knowledgeSubstrate = new KnowledgeSubstrateCore({
        enableTransactionManager: true,
        enableKnowledgeHookManager: true,
        enableEffectSandbox: true,
        enableObservability: true,
        enablePerformanceOptimizer: true,
        enableLockchainWriter: true
      });
      await this.knowledgeSubstrate.initialize();
    }

    // Initialize Performance Optimizer
    this.performanceOptimizer = new PerformanceOptimizer({
      enableCaching: true,
      enableBatchProcessing: true,
      enablePathOptimization: true
    });

    // Initialize RDF Engine
    if (this.config.enableRDF) {
      this.rdfEngine = new RDFEngine();
      await this.rdfEngine.initialize();
    }

    // Initialize Template Engine
    this.templateEngine = new TemplateEngine({
      templatesDir: this.config.templatesDir,
      rdfEngine: this.rdfEngine,
      performanceOptimizer: this.performanceOptimizer
    });
    await this.templateEngine.initialize();

    // Initialize Hygen Generator
    this.hygenGenerator = new HygenGenerator({
      templatesDir: this.config.templatesDir
    });

    // Initialize File Operations
    this.fileOps = new FileOperations({
      dryRun: this.config.dryRun,
      force: this.config.force
    });

    this.initialized = true;
    this.emit('engine:initialized');
  }

  /**
   * Generate artifacts from templates
   * @param {string} generator - Generator name
   * @param {string} action - Action name
   * @param {Object} context - Template context variables
   * @returns {Promise<Object>} Generation result
   */
  async generate(generator, action, context = {}) {
    if (!this.initialized) {
      await this.initialize();
    }

    const operationId = this._generateOperationId();
    this.emit('generation:start', { operationId, generator, action, context });

    try {
      // Discover templates using Hygen pattern
      const templates = await this.hygenGenerator.discoverTemplates(generator, action);
      
      if (templates.length === 0) {
        throw new Error(`No templates found for ${generator}/${action}`);
      }

      const artifacts = [];
      const errors = [];

      // Process each template
      for (const template of templates) {
        try {
          const result = await this.templateEngine.processTemplate(template, context, {
            operationId,
            generator,
            action
          });

          if (result.artifacts && result.artifacts.length > 0) {
            // Execute file operations
            for (const artifact of result.artifacts) {
              const fileResult = await this.fileOps.execute(artifact);
              artifacts.push(fileResult);
            }
          }
        } catch (error) {
          errors.push({ template: template.path, error: error.message });
          this.emit('generation:error', { template: template.path, error });
        }
      }

      const result = {
        success: errors.length === 0,
        operationId,
        artifacts,
        errors,
        stats: {
          templatesProcessed: templates.length,
          artifactsGenerated: artifacts.length,
          errors: errors.length
        }
      };

      this.emit('generation:complete', result);
      return result;

    } catch (error) {
      this.emit('generation:error', { operationId, error });
      return {
        success: false,
        operationId,
        error: error.message,
        artifacts: []
      };
    }
  }

  /**
   * Generate operation ID
   * @private
   * @returns {string} Operation ID
   */
  _generateOperationId() {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}


