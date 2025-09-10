/**
 * Template Processor
 * 
 * Main orchestrator that combines all template processing components
 * into a unified pipeline for complete template-to-file generation.
 */

import { Logger } from '../utils/logger.js';
import { TemplateDiscovery } from './template-discovery.js';
import { FrontmatterParser } from './frontmatter-parser.js';
import { VariableExtractor } from './variable-extractor.js';
import { NunjucksEngine } from './nunjucks-engine.js';
import { InjectionSystem } from './injection-system.js';
import { FileWriter } from './file-writer.js';

/**
 * Template Processor
 * 
 * Orchestrates the complete template processing pipeline from
 * discovery through rendering to file output with comprehensive
 * error handling and performance monitoring.
 */
export class TemplateProcessor {
  /**
   * Initialize the template processor
   * @param {Object} options - Configuration options
   * @param {string} options.templatesDir - Templates directory path
   * @param {Object} options.logger - Logger instance
   * @param {boolean} options.enableCaching - Enable template caching
   * @param {boolean} options.createBackups - Enable automatic backups
   */
  constructor(options = {}) {
    this.templatesDir = options.templatesDir || '_templates';
    this.logger = options.logger || new Logger();
    this.enableCaching = options.enableCaching !== false;
    this.createBackups = options.createBackups !== false;

    // Initialize core components
    this.discovery = new TemplateDiscovery({
      templatesDir: this.templatesDir,
      logger: this.logger
    });

    this.frontmatterParser = new FrontmatterParser({
      logger: this.logger
    });

    this.variableExtractor = new VariableExtractor({
      logger: this.logger
    });

    this.renderEngine = new NunjucksEngine({
      templatesDir: this.templatesDir,
      logger: this.logger
    });

    this.injectionSystem = new InjectionSystem({
      logger: this.logger,
      createBackups: this.createBackups
    });

    this.fileWriter = new FileWriter({
      logger: this.logger,
      createBackups: this.createBackups
    });

    this.processingCache = new Map();
    this.initialized = false;
  }

  /**
   * Initialize the template processor
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.initialized) return;

    this.logger.info('Initializing template processor', {
      templatesDir: this.templatesDir
    });

    try {
      // Initialize discovery engine
      await this.discovery.initialize();

      this.initialized = true;

      this.logger.info('Template processor initialized successfully', {
        templates: this.discovery.getStatistics().templates,
        categories: this.discovery.getStatistics().categories
      });

    } catch (error) {
      this.logger.error('Failed to initialize template processor', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Process template and generate output files
   * @param {string} category - Template category
   * @param {string} templateName - Template name
   * @param {Object} variables - Template variables
   * @param {Object} options - Processing options
   * @param {boolean} options.dryRun - Perform dry run without writing files
   * @param {boolean} options.force - Force overwrite existing files
   * @param {string} options.outputDir - Output directory override
   * @returns {Promise<Object>} Processing result
   */
  async process(category, templateName, variables = {}, options = {}) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      this.logger.info('Starting template processing', {
        category,
        templateName,
        variableCount: Object.keys(variables).length,
        dryRun: options.dryRun
      });

      const startTime = Date.now();

      // Step 1: Discover and load template
      const template = await this.loadTemplate(category, templateName);

      // Step 2: Parse frontmatter and validate
      const { frontmatter, content } = this.frontmatterParser.parse(
        template.content,
        template.path
      );

      // Step 3: Extract and validate variables
      const extractionResult = this.variableExtractor.extract(
        content,
        frontmatter,
        template.path
      );

      // Step 4: Merge and validate variables
      const processedVariables = await this.mergeVariables(
        variables,
        extractionResult.variables,
        options
      );

      // Step 5: Check skip condition
      if (this.frontmatterParser.shouldSkip(frontmatter, processedVariables)) {
        this.logger.info('Template processing skipped due to condition', {
          category,
          templateName,
          condition: frontmatter.skipIf
        });

        return {
          success: true,
          skipped: true,
          reason: 'Skip condition met',
          condition: frontmatter.skipIf
        };
      }

      // Step 6: Render template content
      const renderedContent = await this.renderEngine.render(
        template.file,
        processedVariables,
        { noCache: !this.enableCaching }
      );

      // Step 7: Process output path
      const outputPath = await this.processOutputPath(
        frontmatter.to,
        processedVariables,
        options.outputDir
      );

      // Step 8: Write or inject content
      const writeResult = await this.writeOutput(
        outputPath,
        renderedContent,
        frontmatter,
        processedVariables,
        options
      );

      const executionTime = Date.now() - startTime;

      const result = {
        success: true,
        template: {
          category,
          name: templateName,
          path: template.path
        },
        variables: processedVariables,
        output: {
          path: outputPath,
          length: renderedContent.length,
          lines: renderedContent.split('\n').length
        },
        frontmatter,
        writeResult,
        executionTime,
        dryRun: options.dryRun
      };

      this.logger.info('Template processing completed successfully', {
        category,
        templateName,
        outputPath,
        executionTime: `${executionTime}ms`
      });

      return result;

    } catch (error) {
      this.logger.error('Template processing failed', {
        category,
        templateName,
        error: error.message
      });

      return {
        success: false,
        error: error.message,
        category,
        templateName,
        variables
      };
    }
  }

  /**
   * Process multiple templates in batch
   * @param {Array<Object>} templates - Array of template processing requests
   * @param {Object} options - Batch processing options
   * @returns {Promise<Object>} Batch processing result
   */
  async processBatch(templates, options = {}) {
    const results = [];
    const errors = [];

    this.logger.info('Starting batch template processing', {
      templateCount: templates.length,
      parallel: options.parallel
    });

    if (options.parallel) {
      // Parallel processing
      const promises = templates.map(async (template, index) => {
        try {
          const result = await this.process(
            template.category,
            template.name,
            template.variables || {},
            template.options || {}
          );
          return { index, result, error: null };
        } catch (error) {
          return { index, result: null, error };
        }
      });

      const batchResults = await Promise.all(promises);
      
      batchResults.forEach(({ index, result, error }) => {
        if (error) {
          errors.push({ index, template: templates[index], error });
        } else {
          results.push(result);
        }
      });

    } else {
      // Sequential processing
      for (let i = 0; i < templates.length; i++) {
        const template = templates[i];
        try {
          const result = await this.process(
            template.category,
            template.name,
            template.variables || {},
            template.options || {}
          );
          results.push(result);
        } catch (error) {
          errors.push({ index: i, template, error });
          
          if (!options.continueOnError) {
            break;
          }
        }
      }
    }

    return {
      results,
      errors,
      successful: results.length,
      failed: errors.length,
      total: templates.length
    };
  }

  /**
   * Load template by category and name
   * @param {string} category - Template category
   * @param {string} templateName - Template name
   * @returns {Promise<Object>} Template object
   */
  async loadTemplate(category, templateName) {
    const template = this.discovery.resolveTemplate(category, templateName);

    if (!template) {
      throw new Error(`Template not found: ${category}/${templateName}`);
    }

    this.logger.debug('Template loaded', {
      category,
      templateName,
      variables: template.variables.length
    });

    return template;
  }

  /**
   * Merge provided variables with template requirements
   * @param {Object} providedVariables - User-provided variables
   * @param {Array} requiredVariables - Template variable requirements
   * @param {Object} options - Processing options
   * @returns {Promise<Object>} Merged variables
   */
  async mergeVariables(providedVariables, requiredVariables, options = {}) {
    const merged = { ...providedVariables };
    const missing = [];

    // Check required variables
    requiredVariables.forEach(variable => {
      if (variable.required && !(variable.name in merged)) {
        if (variable.default !== undefined) {
          merged[variable.name] = variable.default;
        } else {
          missing.push(variable.name);
        }
      }
    });

    if (missing.length > 0 && !options.allowMissingVariables) {
      throw new Error(`Missing required variables: ${missing.join(', ')}`);
    }

    // Type conversion and validation
    requiredVariables.forEach(variable => {
      if (variable.name in merged) {
        merged[variable.name] = this.convertVariableType(
          merged[variable.name],
          variable.type
        );
      }
    });

    this.logger.debug('Variables merged and validated', {
      provided: Object.keys(providedVariables).length,
      required: requiredVariables.filter(v => v.required).length,
      total: Object.keys(merged).length,
      missing: missing.length
    });

    return merged;
  }

  /**
   * Convert variable to expected type
   * @param {any} value - Variable value
   * @param {string} type - Expected type
   * @returns {any} Converted value
   */
  convertVariableType(value, type) {
    switch (type) {
      case 'boolean':
        if (typeof value === 'string') {
          return value.toLowerCase() === 'true' || value === '1';
        }
        return Boolean(value);

      case 'number':
        if (typeof value === 'string') {
          const num = parseFloat(value);
          if (isNaN(num)) {
            throw new Error(`Cannot convert "${value}" to number`);
          }
          return num;
        }
        return Number(value);

      case 'array':
        if (typeof value === 'string') {
          try {
            return JSON.parse(value);
          } catch {
            return value.split(',').map(s => s.trim());
          }
        }
        return Array.isArray(value) ? value : [value];

      case 'object':
        if (typeof value === 'string') {
          try {
            return JSON.parse(value);
          } catch {
            throw new Error(`Cannot parse object: ${value}`);
          }
        }
        return value;

      default:
        return String(value);
    }
  }

  /**
   * Process output path template
   * @param {string} pathTemplate - Output path template
   * @param {Object} variables - Template variables
   * @param {string} outputDir - Output directory override
   * @returns {Promise<string>} Processed output path
   */
  async processOutputPath(pathTemplate, variables, outputDir) {
    let outputPath = await this.renderEngine.renderString(pathTemplate, variables);

    // Apply output directory override
    if (outputDir) {
      const path = require('path');
      outputPath = path.join(outputDir, outputPath);
    }

    // Normalize path separators
    outputPath = outputPath.replace(/\\/g, '/');

    this.logger.debug('Output path processed', {
      template: pathTemplate,
      processed: outputPath,
      outputDir
    });

    return outputPath;
  }

  /**
   * Write output content to file or inject into existing file
   * @param {string} outputPath - Output file path
   * @param {string} content - Rendered content
   * @param {Object} frontmatter - Template frontmatter
   * @param {Object} variables - Template variables
   * @param {Object} options - Processing options
   * @returns {Promise<Object>} Write result
   */
  async writeOutput(outputPath, content, frontmatter, variables, options) {
    if (frontmatter.inject) {
      // Injection mode
      const injectionOptions = {
        mode: frontmatter._injectionMode,
        lineAt: frontmatter.lineAt,
        before: frontmatter.before ? 
          await this.renderEngine.renderString(frontmatter.before, variables) : undefined,
        after: frontmatter.after ? 
          await this.renderEngine.renderString(frontmatter.after, variables) : undefined,
        replace: frontmatter.replace ? 
          await this.renderEngine.renderString(frontmatter.replace, variables) : undefined,
        force: options.force,
        dryRun: options.dryRun
      };

      return await this.injectionSystem.inject(outputPath, content, injectionOptions);

    } else {
      // Standard file write
      const writeOptions = {
        force: options.force,
        dryRun: options.dryRun,
        chmod: frontmatter.chmod,
        sh: frontmatter.sh ? 
          await this.renderEngine.renderString(frontmatter.sh, variables) : undefined,
        createDirs: true
      };

      return await this.fileWriter.writeFile(outputPath, content, writeOptions);
    }
  }

  /**
   * List available templates
   * @param {Object} filters - Filtering options
   * @returns {Promise<Array>} Available templates
   */
  async listTemplates(filters = {}) {
    if (!this.initialized) {
      await this.initialize();
    }

    return this.discovery.listTemplates(filters);
  }

  /**
   * Get template help information
   * @param {string} category - Template category
   * @param {string} templateName - Template name
   * @returns {Promise<Object>} Template help information
   */
  async getTemplateHelp(category, templateName) {
    if (!this.initialized) {
      await this.initialize();
    }

    const template = await this.loadTemplate(category, templateName);
    const { frontmatter, content } = this.frontmatterParser.parse(
      template.content,
      template.path
    );
    const extractionResult = this.variableExtractor.extract(
      content,
      frontmatter,
      template.path
    );

    return {
      template: {
        category,
        name: templateName,
        description: frontmatter.meta?.description || '',
        file: template.file
      },
      variables: extractionResult.variables,
      cliFlags: extractionResult.cliFlags,
      examples: frontmatter.meta?.examples || [],
      directives: this.frontmatterParser.getActiveDirectives(frontmatter)
    };
  }

  /**
   * Search templates
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Search results
   */
  async searchTemplates(query, options = {}) {
    if (!this.initialized) {
      await this.initialize();
    }

    return this.discovery.searchTemplates(query, options);
  }

  /**
   * Get processor statistics
   * @returns {Object} Statistics object
   */
  getStatistics() {
    return {
      discovery: this.discovery.getStatistics(),
      renderEngine: this.renderEngine.getStatistics(),
      injectionSystem: this.injectionSystem.getStatistics(),
      fileWriter: this.fileWriter.getStatistics(),
      frontmatterParser: this.frontmatterParser.getStatistics(),
      variableExtractor: this.variableExtractor.getStatistics(),
      processingCache: this.processingCache.size,
      initialized: this.initialized
    };
  }

  /**
   * Clear all caches
   */
  clearCaches() {
    this.processingCache.clear();
    this.renderEngine.clearCache();
    this.frontmatterParser.clearCache();
    this.variableExtractor.clearCache();
  }

  /**
   * Refresh template discovery
   * @returns {Promise<void>}
   */
  async refresh() {
    await this.discovery.refresh();
    this.clearCaches();
  }
}