/**
 * Core Unjucks Engine - Main Orchestration Layer
 * 
 * Coordinates all subsystems: discovery, processing, rendering, and writing
 * Implements the complete data transformation pipeline from input to output
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { EventEmitter } from 'events';

// Core dependencies - lazy loaded for performance
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Main Unjucks Engine class that orchestrates the complete pipeline
 */
export class UnjucksEngine extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      templatesDir: '_templates',
      outputDir: '.',
      dry: false,
      force: false,
      verbose: false,
      semanticValidation: false,
      rdf: {},
      ...config
    };
    
    // Lazy-loaded subsystems
    this._templateDiscovery = null;
    this._templateEngine = null;
    this._fileInjector = null;
    this._frontmatterParser = null;
    this._rdfLoader = null;
    this._variableExtractor = null;
    
    // Pipeline state
    this.pipeline = {
      discovered: false,
      processed: false,
      rendered: false,
      written: false
    };
    
    // Performance monitoring
    this.metrics = {
      startTime: null,
      discovery: null,
      processing: null,
      rendering: null,
      writing: null,
      total: null
    };
  }

  /**
   * Main orchestration method - runs the complete pipeline
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} Generation result
   */
  async generate(options = {}) {
    this.metrics.startTime = Date.now();
    this.emit('pipeline:start', { options });
    
    try {
      // Phase 1: Discovery - Find and index templates
      const discoveryResult = await this._runDiscoveryPhase(options);
      this.emit('pipeline:discovery', discoveryResult);
      
      // Phase 2: Processing - Extract variables and build context
      const processingResult = await this._runProcessingPhase(discoveryResult, options);
      this.emit('pipeline:processing', processingResult);
      
      // Phase 3: Rendering - Apply templates with context
      const renderingResult = await this._runRenderingPhase(processingResult, options);
      this.emit('pipeline:rendering', renderingResult);
      
      // Phase 4: Writing - Output files with injection logic
      const writingResult = await this._runWritingPhase(renderingResult, options);
      this.emit('pipeline:writing', writingResult);
      
      // Complete pipeline
      this.metrics.total = Date.now() - this.metrics.startTime;
      const result = this._buildFinalResult(writingResult);
      
      this.emit('pipeline:complete', result);
      return result;
      
    } catch (error) {
      this.emit('pipeline:error', error);
      throw this._enhanceError(error);
    }
  }

  /**
   * Phase 1: Template Discovery
   * Discovers templates, parses frontmatter, builds registry
   */
  async _runDiscoveryPhase(options) {
    const startTime = Date.now();
    this.emit('phase:discovery:start');
    
    try {
      const discovery = await this._getTemplateDiscovery();
      
      // Discover templates in the specified directory
      const templatePath = options.generator && options.template 
        ? path.join(this.config.templatesDir, options.generator, options.template)
        : this.config.templatesDir;
        
      const templates = await discovery.discoverTemplates(templatePath, {
        pattern: options.pattern,
        recursive: true,
        includeHidden: false
      });
      
      // Parse frontmatter for each template
      const frontmatterParser = await this._getFrontmatterParser();
      const templatesWithMeta = await Promise.all(
        templates.map(async (template) => {
          const { frontmatter, content } = await frontmatterParser.parse(template.content);
          return {
            ...template,
            frontmatter,
            content,
            variables: this._extractTemplateVariables(content)
          };
        })
      );
      
      this.metrics.discovery = Date.now() - startTime;
      this.pipeline.discovered = true;
      
      const result = {
        templates: templatesWithMeta,
        count: templatesWithMeta.length,
        registry: this._buildTemplateRegistry(templatesWithMeta)
      };
      
      this.emit('phase:discovery:complete', result);
      return result;
      
    } catch (error) {
      this.emit('phase:discovery:error', error);
      throw error;
    }
  }

  /**
   * Phase 2: Processing
   * Extracts variables, loads RDF data, builds template context
   */
  async _runProcessingPhase(discoveryResult, options) {
    const startTime = Date.now();
    this.emit('phase:processing:start');
    
    try {
      const variableExtractor = await this._getVariableExtractor();
      
      // Extract all variables from templates
      const allVariables = new Set();
      discoveryResult.templates.forEach(template => {
        template.variables.forEach(variable => allVariables.add(variable));
      });
      
      // Build context from CLI options and extracted variables
      const templateContext = await this._buildTemplateContext(
        Array.from(allVariables),
        options,
        discoveryResult
      );
      
      // Load RDF data if configured
      let rdfContext = null;
      if (this._hasRdfConfiguration(discoveryResult.templates)) {
        rdfContext = await this._loadRdfData(discoveryResult.templates, templateContext);
      }
      
      this.metrics.processing = Date.now() - startTime;
      this.pipeline.processed = true;
      
      const result = {
        context: templateContext,
        rdfContext,
        variables: Array.from(allVariables),
        templates: discoveryResult.templates
      };
      
      this.emit('phase:processing:complete', result);
      return result;
      
    } catch (error) {
      this.emit('phase:processing:error', error);
      throw error;
    }
  }

  /**
   * Phase 3: Rendering
   * Applies Nunjucks templates with context and filters
   */
  async _runRenderingPhase(processingResult, options) {
    const startTime = Date.now();
    this.emit('phase:rendering:start');
    
    try {
      const templateEngine = await this._getTemplateEngine();
      
      // Setup template engine with context and RDF filters
      await templateEngine.configure({
        context: processingResult.context,
        rdfContext: processingResult.rdfContext,
        templatesDir: this.config.templatesDir
      });
      
      // Render each template
      const renderedTemplates = await Promise.all(
        processingResult.templates.map(async (template) => {
          try {
            // Render the template content
            const renderedContent = await templateEngine.render(
              template.content,
              processingResult.context
            );
            
            // Render the output path from frontmatter
            const outputPath = template.frontmatter.to 
              ? await templateEngine.renderString(template.frontmatter.to, processingResult.context)
              : this._generateDefaultOutputPath(template, processingResult.context);
            
            return {
              ...template,
              renderedContent,
              outputPath,
              shouldSkip: await this._evaluateSkipCondition(template, processingResult.context, templateEngine)
            };
            
          } catch (error) {
            this.emit('template:render:error', { template, error });
            throw new Error(`Failed to render template ${template.path}: ${error.message}`);
          }
        })
      );
      
      this.metrics.rendering = Date.now() - startTime;
      this.pipeline.rendered = true;
      
      const result = {
        templates: renderedTemplates,
        context: processingResult.context,
        rdfContext: processingResult.rdfContext
      };
      
      this.emit('phase:rendering:complete', result);
      return result;
      
    } catch (error) {
      this.emit('phase:rendering:error', error);
      throw error;
    }
  }

  /**
   * Phase 4: Writing
   * Writes files with injection logic and post-processing
   */
  async _runWritingPhase(renderingResult, options) {
    const startTime = Date.now();
    this.emit('phase:writing:start');
    
    try {
      const fileInjector = await this._getFileInjector();
      const validTemplates = renderingResult.templates.filter(t => !t.shouldSkip);
      
      // Process each template for writing
      const writeResults = await Promise.all(
        validTemplates.map(async (template) => {
          try {
            const outputPath = path.resolve(this.config.outputDir, template.outputPath);
            
            // Determine write mode from frontmatter
            const writeMode = this._determineWriteMode(template.frontmatter);
            
            // Execute write operation
            const result = await fileInjector.write(outputPath, template.renderedContent, {
              mode: writeMode,
              force: this.config.force || options.force,
              dry: this.config.dry || options.dry,
              frontmatter: template.frontmatter,
              template: template
            });
            
            // Execute post-write commands if specified
            if (template.frontmatter.sh && !this.config.dry) {
              await this._executePostWriteCommands(template.frontmatter.sh, {
                outputPath: result.outputPath,
                context: renderingResult.context
              });
            }
            
            return result;
            
          } catch (error) {
            this.emit('template:write:error', { template, error });
            throw new Error(`Failed to write template ${template.path}: ${error.message}`);
          }
        })
      );
      
      this.metrics.writing = Date.now() - startTime;
      this.pipeline.written = true;
      
      const result = {
        files: writeResults,
        written: writeResults.filter(r => r.success).length,
        skipped: renderingResult.templates.filter(t => t.shouldSkip).length,
        errors: writeResults.filter(r => !r.success)
      };
      
      this.emit('phase:writing:complete', result);
      return result;
      
    } catch (error) {
      this.emit('phase:writing:error', error);
      throw error;
    }
  }

  /**
   * Lazy-load template discovery module
   */
  async _getTemplateDiscovery() {
    if (!this._templateDiscovery) {
      const { TemplateDiscovery } = await import('../lib/template/template-discovery.js');
      this._templateDiscovery = new TemplateDiscovery(this.config);
    }
    return this._templateDiscovery;
  }

  /**
   * Lazy-load template engine module
   */
  async _getTemplateEngine() {
    if (!this._templateEngine) {
      const { TemplateEngine } = await import('../lib/template/template-engine.js');
      this._templateEngine = new TemplateEngine(this.config);
    }
    return this._templateEngine;
  }

  /**
   * Lazy-load file injector module
   */
  async _getFileInjector() {
    if (!this._fileInjector) {
      const { FileInjector } = await import('../lib/file/file-injector.js');
      this._fileInjector = new FileInjector(this.config);
    }
    return this._fileInjector;
  }

  /**
   * Lazy-load frontmatter parser module
   */
  async _getFrontmatterParser() {
    if (!this._frontmatterParser) {
      const { FrontmatterParser } = await import('../lib/template/frontmatter-parser.js');
      this._frontmatterParser = new FrontmatterParser();
    }
    return this._frontmatterParser;
  }

  /**
   * Lazy-load variable extractor module
   */
  async _getVariableExtractor() {
    if (!this._variableExtractor) {
      const { VariableExtractor } = await import('../lib/template/variable-extractor.js');
      this._variableExtractor = new VariableExtractor();
    }
    return this._variableExtractor;
  }

  /**
   * Lazy-load RDF loader module
   */
  async _getRdfLoader() {
    if (!this._rdfLoader) {
      const { RDFLoader } = await import('../lib/semantic/rdf-loader.js');
      this._rdfLoader = new RDFLoader(this.config);
    }
    return this._rdfLoader;
  }

  /**
   * Extract template variables using regex patterns
   */
  _extractTemplateVariables(content) {
    const variablePattern = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*(?:\|[^}]*)?\}\}/g;
    const variables = new Set();
    let match;
    
    while ((match = variablePattern.exec(content)) !== null) {
      variables.add(match[1]);
    }
    
    return Array.from(variables);
  }

  /**
   * Build template registry for discovery results
   */
  _buildTemplateRegistry(templates) {
    const registry = {
      generators: {},
      totalTemplates: templates.length
    };
    
    templates.forEach(template => {
      const pathParts = template.relativePath.split(path.sep);
      if (pathParts.length >= 2) {
        const generator = pathParts[0];
        const templateName = pathParts[1];
        
        if (!registry.generators[generator]) {
          registry.generators[generator] = {
            name: generator,
            description: `${generator} generator`,
            templates: []
          };
        }
        
        registry.generators[generator].templates.push({
          name: templateName,
          path: template.path,
          variables: template.variables,
          frontmatter: template.frontmatter
        });
      }
    });
    
    return registry;
  }

  /**
   * Build template context from variables and options
   */
  async _buildTemplateContext(variables, options, discoveryResult) {
    const context = {
      // CLI provided variables
      ...options,
      
      // Utility variables
      name: options.name || 'Unnamed',
      generator: options.generator || 'default',
      template: options.template || 'default',
      
      // Timestamps
      timestamp: new Date().toISOString(),
      date: new Date().toDateString(),
      
      // File system helpers
      outputDir: this.config.outputDir,
      templatesDir: this.config.templatesDir
    };
    
    // Add extracted variables with defaults
    variables.forEach(variable => {
      if (!(variable in context)) {
        context[variable] = this._getDefaultValue(variable);
      }
    });
    
    return context;
  }

  /**
   * Check if templates have RDF configuration
   */
  _hasRdfConfiguration(templates) {
    return templates.some(template => 
      template.frontmatter && template.frontmatter.rdf
    );
  }

  /**
   * Load RDF data for templates that require it
   */
  async _loadRdfData(templates, context) {
    const rdfLoader = await this._getRdfLoader();
    const rdfSources = new Set();
    
    // Collect all RDF sources
    templates.forEach(template => {
      if (template.frontmatter && template.frontmatter.rdf) {
        const rdfConfig = template.frontmatter.rdf;
        if (rdfConfig.source) {
          rdfSources.add(rdfConfig.source);
        }
      }
    });
    
    // Load and merge RDF data
    const rdfData = {};
    for (const source of rdfSources) {
      try {
        const data = await rdfLoader.load(source, context);
        Object.assign(rdfData, data);
      } catch (error) {
        this.emit('rdf:load:error', { source, error });
        if (this.config.semanticValidation) {
          throw error;
        }
      }
    }
    
    return rdfData;
  }

  /**
   * Evaluate skip condition from frontmatter
   */
  async _evaluateSkipCondition(template, context, templateEngine) {
    if (!template.frontmatter || !template.frontmatter.skipIf) {
      return false;
    }
    
    try {
      const condition = await templateEngine.renderString(
        `{% if ${template.frontmatter.skipIf} %}true{% else %}false{% endif %}`,
        context
      );
      return condition.trim() === 'true';
    } catch (error) {
      this.emit('skip:condition:error', { template, error });
      return false;
    }
  }

  /**
   * Generate default output path for template
   */
  _generateDefaultOutputPath(template, context) {
    const ext = path.extname(template.path).replace('.njk', '');
    const basename = path.basename(template.path, '.njk');
    
    if (context.name && context.name !== 'Unnamed') {
      return `${context.name}${ext}`;
    }
    
    return `${basename}${ext}`;
  }

  /**
   * Determine write mode from frontmatter
   */
  _determineWriteMode(frontmatter) {
    if (frontmatter.inject) return 'inject';
    if (frontmatter.append) return 'append';
    if (frontmatter.prepend) return 'prepend';
    if (frontmatter.lineAt) return 'lineAt';
    return 'write';
  }

  /**
   * Execute post-write shell commands
   */
  async _executePostWriteCommands(commands, context) {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    
    for (const command of commands) {
      try {
        this.emit('command:execute', { command, context });
        await execAsync(command, { 
          cwd: path.dirname(context.outputPath)
        });
      } catch (error) {
        this.emit('command:error', { command, error });
        throw error;
      }
    }
  }

  /**
   * Get default value for a variable
   */
  _getDefaultValue(variable) {
    const defaults = {
      name: 'Unnamed',
      className: 'DefaultClass',
      fileName: 'default',
      description: 'Generated file',
      author: 'Unjucks',
      version: '1.0.0'
    };
    
    return defaults[variable] || '';
  }

  /**
   * Build final generation result
   */
  _buildFinalResult(writingResult) {
    return {
      success: writingResult.errors.length === 0,
      files: writingResult.files.map(f => f.outputPath),
      written: writingResult.written,
      skipped: writingResult.skipped,
      errors: writingResult.errors,
      performance: this.metrics,
      pipeline: this.pipeline
    };
  }

  /**
   * Enhance error with context
   */
  _enhanceError(error) {
    error.engine = 'UnjucksEngine';
    error.pipeline = this.pipeline;
    error.metrics = this.metrics;
    error.config = this.config;
    return error;
  }

  /**
   * Get engine status and health
   */
  getStatus() {
    return {
      pipeline: this.pipeline,
      metrics: this.metrics,
      config: this.config,
      subsystems: {
        templateDiscovery: !!this._templateDiscovery,
        templateEngine: !!this._templateEngine,
        fileInjector: !!this._fileInjector,
        frontmatterParser: !!this._frontmatterParser,
        rdfLoader: !!this._rdfLoader,
        variableExtractor: !!this._variableExtractor
      }
    };
  }

  /**
   * Reset engine state
   */
  reset() {
    this.pipeline = {
      discovered: false,
      processed: false,
      rendered: false,
      written: false
    };
    
    this.metrics = {
      startTime: null,
      discovery: null,
      processing: null,
      rendering: null,
      writing: null,
      total: null
    };
    
    this.emit('engine:reset');
  }
}

export default UnjucksEngine;