/**
 * Unjucks Core Module Exports
 * 
 * Main entry point for the core template processing engine
 * providing unified access to all template processing components.
 */

// Core template processing components
export { TemplateDiscovery } from './template-discovery.js';
export { FrontmatterParser } from './frontmatter-parser.js';
export { VariableExtractor } from './variable-extractor.js';
export { NunjucksEngine } from './nunjucks-engine.js';
export { InjectionSystem } from './injection-system.js';
export { FileWriter } from './file-writer.js';

// Main template processor orchestrator
export { TemplateProcessor } from './template-processor.js';

// Core application framework
export { UnjucksApp } from './app.js';

/**
 * Create a new template processor instance with default configuration
 * @param {Object} options - Configuration options
 * @returns {TemplateProcessor} Configured template processor
 */
export function createTemplateProcessor(options = {}) {
  const { TemplateProcessor } = require('./template-processor.js');
  return new TemplateProcessor(options);
}

/**
 * Create a new Unjucks application instance
 * @param {Object} options - Application configuration options
 * @returns {UnjucksApp} Configured application instance
 */
export function createApp(options = {}) {
  const { UnjucksApp } = require('./app.js');
  return new UnjucksApp(options);
}

/**
 * Template processor factory with common configurations
 */
export const Processors = {
  /**
   * Create development processor with caching disabled
   * @param {Object} options - Additional options
   * @returns {TemplateProcessor} Development processor
   */
  development(options = {}) {
    return createTemplateProcessor({
      enableCaching: false,
      createBackups: true,
      ...options
    });
  },

  /**
   * Create production processor with optimizations enabled
   * @param {Object} options - Additional options
   * @returns {TemplateProcessor} Production processor
   */
  production(options = {}) {
    return createTemplateProcessor({
      enableCaching: true,
      createBackups: false,
      ...options
    });
  },

  /**
   * Create testing processor with safe defaults
   * @param {Object} options - Additional options
   * @returns {TemplateProcessor} Testing processor
   */
  testing(options = {}) {
    return createTemplateProcessor({
      enableCaching: false,
      createBackups: false,
      templatesDir: 'test/fixtures/templates',
      ...options
    });
  }
};

/**
 * Utility functions for template processing
 */
export const Utils = {
  /**
   * Validate template structure
   * @param {Object} template - Template object to validate
   * @returns {boolean} True if valid
   */
  isValidTemplate(template) {
    return (
      template &&
      typeof template === 'object' &&
      typeof template.content === 'string' &&
      typeof template.frontmatter === 'object'
    );
  },

  /**
   * Normalize template path
   * @param {string} path - Template path to normalize
   * @returns {string} Normalized path
   */
  normalizePath(path) {
    return path.replace(/\\/g, '/').replace(/\/+/g, '/');
  },

  /**
   * Extract template category and name from path
   * @param {string} templatePath - Template file path
   * @returns {Object} Category and name
   */
  parseTemplatePath(templatePath) {
    const normalized = this.normalizePath(templatePath);
    const parts = normalized.split('/');
    const fileName = parts.pop().replace(/\.njk$/, '');
    const category = parts.length > 0 ? parts[parts.length - 1] : 'root';
    
    return { category, name: fileName };
  },

  /**
   * Generate CLI flag name from variable name
   * @param {string} variableName - Variable name
   * @returns {string} CLI flag name
   */
  generateCliFlag(variableName) {
    return variableName.replace(/([A-Z])/g, '-$1').toLowerCase();
  },

  /**
   * Merge template variables with defaults
   * @param {Object} provided - Provided variables
   * @param {Array} required - Required variable definitions
   * @returns {Object} Merged variables
   */
  mergeVariables(provided, required) {
    const merged = { ...provided };
    
    required.forEach(variable => {
      if (!(variable.name in merged) && variable.default !== undefined) {
        merged[variable.name] = variable.default;
      }
    });
    
    return merged;
  }
};

/**
 * Constants used throughout the template processing system
 */
export const Constants = {
  // Supported template file extensions
  TEMPLATE_EXTENSIONS: ['.njk', '.nunjucks'],
  
  // Frontmatter directives
  DIRECTIVES: {
    CORE: ['to', 'inject', 'skipIf', 'chmod', 'sh'],
    INJECTION: ['append', 'prepend', 'lineAt', 'before', 'after', 'replace']
  },
  
  // Variable types
  VARIABLE_TYPES: ['string', 'boolean', 'number', 'array', 'object'],
  
  // Injection modes
  INJECTION_MODES: ['append', 'prepend', 'lineAt', 'before', 'after', 'replace'],
  
  // Default file permissions
  DEFAULT_FILE_MODE: '644',
  DEFAULT_EXEC_MODE: '755',
  
  // Template discovery patterns
  DISCOVERY_PATTERNS: {
    templates: '**/*.njk',
    metadata: '**/meta.yml',
    config: 'config.yml'
  }
};

/**
 * Error classes for template processing
 */
export class TemplateError extends Error {
  constructor(message, templatePath, cause) {
    super(message);
    this.name = 'TemplateError';
    this.templatePath = templatePath;
    this.cause = cause;
  }
}

export class VariableError extends Error {
  constructor(message, variableName, templatePath) {
    super(message);
    this.name = 'VariableError';
    this.variableName = variableName;
    this.templatePath = templatePath;
  }
}

export class FrontmatterError extends Error {
  constructor(message, directive, templatePath) {
    super(message);
    this.name = 'FrontmatterError';
    this.directive = directive;
    this.templatePath = templatePath;
  }
}

export class InjectionError extends Error {
  constructor(message, filePath, mode) {
    super(message);
    this.name = 'InjectionError';
    this.filePath = filePath;
    this.mode = mode;
  }
}

/**
 * Version information
 */
export const VERSION = '3.0.0';
export const CORE_VERSION = '1.0.0';