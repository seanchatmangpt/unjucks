/**
 * KGEN-Unjucks Template Integration Bridge
 * 
 * Comprehensive integration system that connects unjucks template discovery
 * and processing with KGEN's frontmatter workflow engine, enabling seamless
 * template-driven artifact generation with full provenance tracking.
 */

import { EventEmitter } from 'events';
import { Consola } from 'consola';
import { Generator } from '../../lib/generator.js';
import { TemplateScanner } from '../../lib/template-scanner.js';
import { FrontmatterParser } from '../../lib/frontmatter-parser.js';
import { FrontmatterWorkflowEngine } from '../core/frontmatter/workflow-engine.js';
import { MetadataExtractor } from '../core/frontmatter/metadata-extractor.js';
import { KGenErrorHandler } from '../utils/error-handler.js';
import path from 'node:path';
import fs from 'fs-extra';
import crypto from 'crypto';

export class UnjucksTemplateBridge extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      // Template discovery configuration
      templatesDir: config.templatesDir || '_templates',
      baseDir: config.baseDir || process.cwd(),
      enableScan: config.enableScan !== false,
      
      // KGEN integration configuration
      enableFrontmatterWorkflow: config.enableFrontmatterWorkflow !== false,
      enableProvenance: config.enableProvenance !== false,
      enableSemanticProcessing: config.enableSemanticProcessing !== false,
      
      // Content addressing for deterministic output
      enableContentAddressing: config.enableContentAddressing !== false,
      hashAlgorithm: config.hashAlgorithm || 'sha256',
      
      // Processing settings
      maxConcurrentTemplates: config.maxConcurrentTemplates || 5,
      enableCache: config.enableCache !== false,
      cacheDirectory: config.cacheDirectory || '.kgen-cache',
      
      // Error handling
      errorHandling: {
        enableRecovery: true,
        maxRetryAttempts: 3,
        retryDelay: 1000,
        ...config.errorHandling
      },
      
      ...config
    };
    
    this.logger = new Consola({ tag: 'kgen-unjucks-bridge' });
    this.state = 'initialized';
    
    // Initialize error handler
    this.errorHandler = new KGenErrorHandler(this.config.errorHandling);
    
    // Initialize core components
    this.generator = new Generator({
      templatesDir: this.config.templatesDir,
      baseDir: this.config.baseDir
    });
    
    this.templateScanner = new TemplateScanner({
      templatesDir: this.config.templatesDir,
      baseDir: this.config.baseDir
    });
    
    this.frontmatterParser = new FrontmatterParser(
      this.config.enableSemanticProcessing
    );
    
    this.frontmatterWorkflow = new FrontmatterWorkflowEngine({
      enableProvenance: this.config.enableProvenance,
      enableValidation: true,
      enableConditionalProcessing: true,
      enableSchemaValidation: this.config.enableSemanticProcessing,
      deterministic: this.config.enableContentAddressing,
      maxConcurrentOperations: this.config.maxConcurrentTemplates
    });
    
    this.metadataExtractor = new MetadataExtractor({
      enableProvenance: this.config.enableProvenance
    });
    
    // Template and variable caches
    this.templateCache = new Map();
    this.variableCache = new Map();
    this.generatorCache = new Map();
    
    // Content addressing system
    this.contentAddressCache = new Map();
    
    this._setupEventHandlers();
  }

  /**
   * Initialize the template bridge and all components
   */
  async initialize() {
    try {
      this.logger.info('Initializing KGEN-Unjucks template bridge...');
      
      // Initialize components in dependency order
      if (this.config.enableFrontmatterWorkflow) {
        await this.frontmatterWorkflow.initialize();
      }
      
      // Create cache directory if needed
      if (this.config.enableCache) {
        await fs.ensureDir(path.join(this.config.baseDir, this.config.cacheDirectory));
      }
      
      this.state = 'ready';
      this.emit('bridge:ready');
      
      this.logger.success('KGEN-Unjucks template bridge initialized successfully');
      return { status: 'success', version: this.getVersion() };
      
    } catch (error) {
      const operationId = 'bridge:initialize';
      const errorContext = {
        component: 'unjucks-template-bridge',
        operation: 'initialization',
        state: this.state
      };
      
      await this.errorHandler.handleError(operationId, error, errorContext);
      this.state = 'error';
      this.emit('bridge:error', { operationId, error, errorContext });
      
      throw error;
    }
  }

  /**
   * Discover all available generators with enhanced metadata
   * @param {Object} options - Discovery options
   * @returns {Promise<Array>} Array of enhanced generator objects
   */
  async discoverGenerators(options = {}) {
    const operationId = this._generateOperationId();
    
    try {
      this.logger.info(`Discovering generators with operation ${operationId}`);
      
      // Get base generators from unjucks scanner
      const baseGenerators = await this.generator.listGenerators();
      
      // Enhance generators with KGEN metadata
      const enhancedGenerators = [];
      
      for (const generator of baseGenerators) {
        try {
          const enhancement = await this._enhanceGeneratorMetadata(generator, {
            operationId,
            includeTemplateAnalysis: options.includeTemplateAnalysis !== false,
            includeVariableExtraction: options.includeVariableExtraction !== false,
            enableContentAddressing: options.enableContentAddressing !== false
          });
          
          enhancedGenerators.push({
            ...generator,
            ...enhancement,
            kgenMetadata: {
              operationId,
              discoveredAt: this.getDeterministicDate().toISOString(),
              bridgeVersion: this.getVersion(),
              contentAddress: enhancement.contentAddress
            }
          });
          
        } catch (error) {
          this.logger.warn(`Failed to enhance generator ${generator.name}:`, error.message);
          // Include generator with basic info only
          enhancedGenerators.push({
            ...generator,
            kgenMetadata: {
              operationId,
              discoveredAt: this.getDeterministicDate().toISOString(),
              bridgeVersion: this.getVersion(),
              enhancementFailed: true,
              enhancementError: error.message
            }
          });
        }
      }
      
      this.emit('generators:discovered', { 
        operationId, 
        count: enhancedGenerators.length,
        generators: enhancedGenerators 
      });
      
      this.logger.success(`Discovered ${enhancedGenerators.length} generators`);
      return enhancedGenerators;
      
    } catch (error) {
      const errorContext = {
        component: 'unjucks-template-bridge',
        operation: 'generator_discovery',
        options
      };
      
      await this.errorHandler.handleError(operationId, error, errorContext);
      this.emit('generators:discovery_error', { operationId, error });
      throw error;
    }
  }

  /**
   * Discover templates for a specific generator with enhanced metadata
   * @param {string} generatorName - Name of the generator
   * @param {Object} options - Discovery options
   * @returns {Promise<Array>} Array of enhanced template objects
   */
  async discoverTemplates(generatorName, options = {}) {
    const operationId = this._generateOperationId();
    
    try {
      this.logger.info(`Discovering templates for generator ${generatorName}`);
      
      // Get base templates from unjucks generator
      const baseTemplates = await this.generator.listTemplates(generatorName);
      
      // Enhance templates with KGEN metadata and frontmatter analysis
      const enhancedTemplates = [];
      
      for (const template of baseTemplates) {
        try {
          const enhancement = await this._enhanceTemplateMetadata(
            generatorName, 
            template, 
            {
              operationId,
              includeVariableExtraction: options.includeVariableExtraction !== false,
              includeFrontmatterAnalysis: options.includeFrontmatterAnalysis !== false,
              enableContentAddressing: options.enableContentAddressing !== false
            }
          );
          
          enhancedTemplates.push({
            ...template,
            ...enhancement,
            kgenMetadata: {
              operationId,
              generatorName,
              discoveredAt: this.getDeterministicDate().toISOString(),
              bridgeVersion: this.getVersion(),
              contentAddress: enhancement.contentAddress
            }
          });
          
        } catch (error) {
          this.logger.warn(`Failed to enhance template ${template.name}:`, error.message);
          enhancedTemplates.push({
            ...template,
            kgenMetadata: {
              operationId,
              generatorName,
              discoveredAt: this.getDeterministicDate().toISOString(),
              bridgeVersion: this.getVersion(),
              enhancementFailed: true,
              enhancementError: error.message
            }
          });
        }
      }
      
      this.emit('templates:discovered', {
        operationId,
        generatorName,
        count: enhancedTemplates.length,
        templates: enhancedTemplates
      });
      
      this.logger.success(`Discovered ${enhancedTemplates.length} templates for ${generatorName}`);
      return enhancedTemplates;
      
    } catch (error) {
      const errorContext = {
        component: 'unjucks-template-bridge',
        operation: 'template_discovery',
        generatorName,
        options
      };
      
      await this.errorHandler.handleError(operationId, error, errorContext);
      this.emit('templates:discovery_error', { operationId, generatorName, error });
      throw error;
    }
  }

  /**
   * Generate artifacts using KGEN frontmatter workflow integration
   * @param {Object} generationRequest - Generation request with template and context
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} Generation result with artifacts and provenance
   */
  async generateArtifacts(generationRequest, options = {}) {
    const operationId = this._generateOperationId();
    
    try {
      const { 
        generator: generatorName, 
        template: templateName, 
        context = {}, 
        destination = '.', 
        variables = {} 
      } = generationRequest;
      
      this.logger.info(`Starting artifact generation ${operationId} for ${generatorName}/${templateName}`);
      
      // Load template content with frontmatter analysis
      const templateContent = await this._loadTemplateContent(generatorName, templateName);
      
      // Parse frontmatter and extract metadata
      const parseResult = await this.frontmatterParser.parse(templateContent, true);
      
      // Create enhanced context with KGEN integration
      const enhancedContext = {
        ...context,
        ...variables,
        _kgen: {
          operationId,
          generatorName,
          templateName,
          bridgeVersion: this.getVersion(),
          timestamp: this.getDeterministicDate().toISOString()
        },
        _unjucks: {
          generator: generatorName,
          template: templateName,
          context,
          variables
        }
      };
      
      // Process through KGEN frontmatter workflow if enabled
      let workflowResult = null;
      if (this.config.enableFrontmatterWorkflow && parseResult.hasValidFrontmatter) {
        workflowResult = await this.frontmatterWorkflow.processTemplate(
          templateContent,
          enhancedContext,
          {
            ...options,
            operationId,
            generatorName,
            templateName,
            destination,
            enableProvenance: this.config.enableProvenance
          }
        );
      }
      
      // Fall back to standard unjucks generation if workflow not used
      let unjucksResult = null;
      if (!workflowResult || workflowResult.status === 'skipped') {
        unjucksResult = await this.generator.generate({
          generator: generatorName,
          template: templateName,
          dest: destination,
          variables: { ...context, ...variables },
          dry: options.dry || false,
          force: options.force || false
        });
      }
      
      // Merge results and create unified artifact structure
      const artifacts = await this._createUnifiedArtifacts({
        workflowResult,
        unjucksResult,
        operationId,
        generatorName,
        templateName,
        context: enhancedContext
      });
      
      // Generate content addresses for deterministic tracking
      if (this.config.enableContentAddressing) {
        for (const artifact of artifacts) {
          artifact.contentAddress = this._generateContentAddress(artifact.content || '');
        }
      }
      
      this.emit('artifacts:generated', {
        operationId,
        generatorName,
        templateName,
        artifactCount: artifacts.length,
        artifacts
      });
      
      this.logger.success(`Generated ${artifacts.length} artifacts for ${generatorName}/${templateName}`);
      
      return {
        operationId,
        status: 'success',
        generatorName,
        templateName,
        artifacts,
        metadata: {
          workflowUsed: !!workflowResult,
          workflowStatus: workflowResult?.status,
          unjucksUsed: !!unjucksResult,
          unjucksStatus: unjucksResult?.success ? 'success' : 'failed',
          contentAddressing: this.config.enableContentAddressing,
          bridgeVersion: this.getVersion()
        }
      };
      
    } catch (error) {
      const errorContext = {
        component: 'unjucks-template-bridge',
        operation: 'artifact_generation',
        request: {
          generator: generationRequest.generator,
          template: generationRequest.template,
          hasContext: !!generationRequest.context,
          hasVariables: !!generationRequest.variables
        }
      };
      
      await this.errorHandler.handleError(operationId, error, errorContext);
      this.emit('artifacts:generation_error', { operationId, error, request: generationRequest });
      throw error;
    }
  }

  /**
   * Extract variables from template with enhanced analysis
   * @param {string} generatorName - Generator name
   * @param {string} templateName - Template name
   * @param {Object} options - Extraction options
   * @returns {Promise<Object>} Variable extraction result
   */
  async extractTemplateVariables(generatorName, templateName, options = {}) {
    const operationId = this._generateOperationId();
    
    try {
      this.logger.debug(`Extracting variables from ${generatorName}/${templateName}`);
      
      // Check cache first
      const cacheKey = `${generatorName}:${templateName}:variables`;
      if (this.config.enableCache && this.variableCache.has(cacheKey)) {
        return this.variableCache.get(cacheKey);
      }
      
      // Load template content
      const templateContent = await this._loadTemplateContent(generatorName, templateName);
      
      // Parse frontmatter
      const parseResult = await this.frontmatterParser.parse(templateContent, true);
      
      // Extract variables using metadata extractor
      const extractionResult = await this.metadataExtractor.extractVariables(
        parseResult.frontmatter,
        parseResult.content
      );
      
      // Enhance with unjucks generator variable extraction
      const unjucksVariables = await this.generator.extractTemplateVariables(
        path.join(this.config.baseDir, this.config.templatesDir, generatorName, templateName)
      );
      
      // Merge and deduplicate variables
      const mergedResult = {
        ...extractionResult,
        unjucksVariables,
        allVariables: [
          ...new Set([
            ...extractionResult.allVariables || [],
            ...unjucksVariables || []
          ])
        ],
        kgenMetadata: {
          operationId,
          generatorName,
          templateName,
          extractedAt: this.getDeterministicDate().toISOString(),
          hasFrontmatter: parseResult.hasValidFrontmatter,
          bridgeVersion: this.getVersion()
        }
      };
      
      // Cache the result
      if (this.config.enableCache) {
        this.variableCache.set(cacheKey, mergedResult);
      }
      
      this.emit('variables:extracted', {
        operationId,
        generatorName,
        templateName,
        variableCount: mergedResult.allVariables.length,
        result: mergedResult
      });
      
      return mergedResult;
      
    } catch (error) {
      const errorContext = {
        component: 'unjucks-template-bridge',
        operation: 'variable_extraction',
        generatorName,
        templateName
      };
      
      await this.errorHandler.handleError(operationId, error, errorContext);
      this.emit('variables:extraction_error', { operationId, generatorName, templateName, error });
      throw error;
    }
  }

  /**
   * Get bridge status and metrics
   */
  getStatus() {
    return {
      state: this.state,
      version: this.getVersion(),
      config: this.config,
      components: {
        generator: 'active',
        templateScanner: 'active',
        frontmatterParser: 'active',
        frontmatterWorkflow: this.frontmatterWorkflow.getStatus(),
        metadataExtractor: 'active'
      },
      cache: {
        templates: this.templateCache.size,
        variables: this.variableCache.size,
        generators: this.generatorCache.size,
        contentAddresses: this.contentAddressCache.size
      },
      uptime: process.uptime()
    };
  }

  /**
   * Clear all caches
   */
  clearCache() {
    this.templateCache.clear();
    this.variableCache.clear();
    this.generatorCache.clear();
    this.contentAddressCache.clear();
    
    this.logger.info('All caches cleared');
    this.emit('cache:cleared');
  }

  /**
   * Shutdown the bridge gracefully
   */
  async shutdown() {
    try {
      this.logger.info('Shutting down KGEN-Unjucks template bridge...');
      
      this.state = 'shutting_down';
      
      // Shutdown components
      if (this.frontmatterWorkflow) {
        await this.frontmatterWorkflow.shutdown();
      }
      
      // Clear caches
      this.clearCache();
      
      this.state = 'shutdown';
      this.emit('bridge:shutdown');
      
      this.logger.success('KGEN-Unjucks template bridge shutdown completed');
      
    } catch (error) {
      this.logger.error('Error during bridge shutdown:', error);
      throw error;
    }
  }

  // Private methods

  _generateOperationId() {
    return `utb_${this.getDeterministicTimestamp()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async _enhanceGeneratorMetadata(generator, options) {
    const enhancement = {
      templateAnalysis: null,
      variableAnalysis: null,
      contentAddress: null
    };
    
    try {
      if (options.includeTemplateAnalysis) {
        const templates = await this.generator.listTemplates(generator.name);
        enhancement.templateAnalysis = {
          templateCount: templates.length,
          hasComplexTemplates: templates.some(t => t.files && t.files.length > 1),
          supportsFrontmatter: false // Will be determined by template analysis
        };
      }
      
      if (options.includeVariableExtraction && generator.templates) {
        const allVariables = new Set();
        for (const template of generator.templates) {
          const vars = await this.generator.extractTemplateVariables(
            path.join(this.config.baseDir, this.config.templatesDir, generator.name, template.name)
          );
          vars.forEach(v => allVariables.add(v));
        }
        enhancement.variableAnalysis = {
          uniqueVariables: Array.from(allVariables),
          variableCount: allVariables.size
        };
      }
      
      if (options.enableContentAddressing) {
        const generatorSignature = JSON.stringify({
          name: generator.name,
          path: generator.path,
          templates: generator.templates?.map(t => t.name).sort()
        });
        enhancement.contentAddress = this._generateContentAddress(generatorSignature);
      }
      
    } catch (error) {
      this.logger.warn(`Enhancement failed for generator ${generator.name}:`, error.message);
    }
    
    return enhancement;
  }

  async _enhanceTemplateMetadata(generatorName, template, options) {
    const enhancement = {
      frontmatterAnalysis: null,
      variableAnalysis: null,
      contentAddress: null
    };
    
    try {
      if (options.includeFrontmatterAnalysis) {
        const templateContent = await this._loadTemplateContent(generatorName, template.name);
        const parseResult = await this.frontmatterParser.parse(templateContent, true);
        
        enhancement.frontmatterAnalysis = {
          hasFrontmatter: parseResult.hasValidFrontmatter,
          frontmatterKeys: parseResult.hasValidFrontmatter 
            ? Object.keys(parseResult.frontmatter) 
            : [],
          supportsConditionals: parseResult.frontmatter?.skipIf || 
                                parseResult.frontmatter?.if ||
                                parseResult.frontmatter?.unless,
          supportsInjection: parseResult.frontmatter?.inject ||
                            parseResult.frontmatter?.append ||
                            parseResult.frontmatter?.prepend ||
                            parseResult.frontmatter?.lineAt,
          hasRDFConfig: this.frontmatterParser.hasRDFConfig(parseResult.frontmatter)
        };
      }
      
      if (options.includeVariableExtraction) {
        const variables = await this.extractTemplateVariables(generatorName, template.name);
        enhancement.variableAnalysis = {
          frontmatterVariables: variables.frontmatterVariables || [],
          templateVariables: variables.templateVariables || [],
          uniqueVariables: variables.allVariables || [],
          variableCount: (variables.allVariables || []).length
        };
      }
      
      if (options.enableContentAddressing) {
        const templateContent = await this._loadTemplateContent(generatorName, template.name);
        enhancement.contentAddress = this._generateContentAddress(templateContent);
      }
      
    } catch (error) {
      this.logger.warn(`Enhancement failed for template ${template.name}:`, error.message);
    }
    
    return enhancement;
  }

  async _loadTemplateContent(generatorName, templateName) {
    const cacheKey = `${generatorName}:${templateName}:content`;
    
    if (this.config.enableCache && this.templateCache.has(cacheKey)) {
      return this.templateCache.get(cacheKey);
    }
    
    const templatePath = path.join(
      this.config.baseDir, 
      this.config.templatesDir, 
      generatorName, 
      templateName
    );
    
    // Find the actual template file (could be in subdirectory)
    let actualPath = templatePath;
    if (!await fs.pathExists(templatePath)) {
      // Look for template files in the template directory
      const templateDir = path.dirname(templatePath);
      const templateFiles = await this._findTemplateFiles(templateDir);
      
      if (templateFiles.length > 0) {
        actualPath = templateFiles[0]; // Use first template file found
      } else {
        throw new Error(`Template file not found: ${templatePath}`);
      }
    }
    
    const content = await fs.readFile(actualPath, 'utf8');
    
    if (this.config.enableCache) {
      this.templateCache.set(cacheKey, content);
    }
    
    return content;
  }

  async _findTemplateFiles(directory) {
    const files = [];
    
    try {
      const items = await fs.readdir(directory, { withFileTypes: true });
      
      for (const item of items) {
        const itemPath = path.join(directory, item.name);
        
        if (item.isDirectory()) {
          const subFiles = await this._findTemplateFiles(itemPath);
          files.push(...subFiles);
        } else if (item.isFile() && this._isTemplateFile(item.name)) {
          files.push(itemPath);
        }
      }
    } catch (error) {
      this.logger.warn(`Error scanning directory ${directory}:`, error.message);
    }
    
    return files;
  }

  _isTemplateFile(filename) {
    return filename.endsWith('.njk') || 
           filename.endsWith('.hbs') || 
           filename.endsWith('.j2') ||
           filename.endsWith('.ejs.t');
  }

  async _createUnifiedArtifacts({ workflowResult, unjucksResult, operationId, generatorName, templateName, context }) {
    const artifacts = [];
    
    // Process KGEN frontmatter workflow results
    if (workflowResult && workflowResult.status === 'success' && workflowResult.artifacts) {
      for (const artifact of workflowResult.artifacts) {
        artifacts.push({
          id: `${operationId}_fw_${artifacts.length}`,
          type: 'frontmatter_workflow',
          path: artifact.path,
          content: artifact.content,
          size: artifact.size || 0,
          operationType: artifact.operationType || 'write',
          metadata: {
            generatedBy: 'kgen_frontmatter_workflow',
            operationId,
            generatorName,
            templateName,
            workflowMetadata: workflowResult.metadata,
            pathResolution: workflowResult.pathResolution,
            conditionalResult: workflowResult.conditionalResult,
            generatedAt: this.getDeterministicDate().toISOString()
          }
        });
      }
    }
    
    // Process unjucks generator results
    if (unjucksResult && unjucksResult.success && unjucksResult.files) {
      for (const file of unjucksResult.files) {
        artifacts.push({
          id: `${operationId}_uj_${artifacts.length}`,
          type: 'unjucks_generator',
          path: file.path,
          content: file.content,
          size: file.size || 0,
          operationType: file.exists ? 'overwrite' : 'write',
          metadata: {
            generatedBy: 'unjucks_generator',
            operationId,
            generatorName,
            templateName,
            existed: file.exists,
            frontmatter: file.frontmatter,
            generatedAt: this.getDeterministicDate().toISOString()
          }
        });
      }
    }
    
    return artifacts;
  }

  _generateContentAddress(content) {
    const hash = crypto.createHash(this.config.hashAlgorithm);
    hash.update(content);
    return hash.digest('hex');
  }

  _setupEventHandlers() {
    // Component error propagation
    if (this.frontmatterWorkflow) {
      this.frontmatterWorkflow.on('error', (error) => {
        this.emit('component:error', { component: 'frontmatter_workflow', error });
      });
      
      this.frontmatterWorkflow.on('workflow:complete', (event) => {
        this.emit('workflow:complete', event);
      });
    }
    
    // Error handler events
    if (this.errorHandler) {
      this.errorHandler.on('error:recovered', (event) => {
        this.emit('error:recovered', event);
      });
    }
  }

  getVersion() {
    return '1.0.0';
  }
}

export default UnjucksTemplateBridge;