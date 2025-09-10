/**
 * Unjucks v3.0 - Main Library Entry Point
 * 
 * Next-generation template scaffolding with semantic web capabilities
 * JavaScript ES2023 native architecture for optimal performance
 */

// Core application exports
export { UnjucksApp, UnjucksEngine } from './core/index.js';
export { createApp, createEngine, generate, list } from './core/index.js';
export { TemplateEngine } from './lib/template-engine.js';
export { TemplateScanner } from './lib/template-scanner.js';
export { FrontmatterParser } from './lib/frontmatter-parser.js';

// Error handling system
export { 
  ErrorHandler,
  UnjucksError,
  CommandParseError,
  TemplateNotFoundError,
  TemplateSyntaxError,
  MissingVariablesError,
  FilterError,
  RenderError,
  PathSecurityError,
  FileConflictError,
  PermissionError
} from './core/errors.js';
export {
  CLIErrorIntegration,
  TemplateErrorIntegration,
  FileSystemErrorIntegration,
  ValidationErrorIntegration,
  ErrorRecoveryUtils,
  ErrorContextBuilder
} from './core/error-integration.js';

// RDF/Semantic Web capabilities
export { RDFProcessor, createRDFProcessor, processRDFForTemplate } from './core/rdf.js';
export { RDFTemplateIntegration, createRDFTemplateIntegration } from './core/rdf-template-integration.js';
export { RDFDataLoader } from './lib/rdf-data-loader.js';
export { RDFFilters, createRDFFilters, registerRDFFilters } from './lib/rdf-filters.js';
export { TurtleParser } from './lib/turtle-parser.js';
export { SemanticValidator } from './lib/semantic-validator.js';

// Filter Pipeline System
export { FilterPipeline, createFilterPipeline, registerFiltersWithNunjucks } from './core/filters.js';
export { createTemplateEngine, createEnhancedTemplateEngine } from './lib/template-engine.js';

// Utilities and constants
export { CONSTANTS } from './utils/constants.js';
export { Logger } from './utils/logger.js';
export { PerformanceMonitor } from './utils/performance-monitor.js';

// Command implementations
export { ListCommand } from './commands/list.js';
export { GenerateCommand } from './commands/generate.js';
export { HelpCommand } from './commands/help.js';
export { InitCommand } from './commands/init.js';
export { VersionCommand } from './commands/version.js';

// Type definitions (JSDoc types)
/**
 * @typedef {Object} UnjucksConfig
 * @property {string} [templatesDir='_templates'] - Templates directory path
 * @property {string} [outputDir='.'] - Output directory for generated files
 * @property {boolean} [dry=false] - Dry run mode (no file writes)
 * @property {boolean} [force=false] - Force overwrite existing files
 * @property {boolean} [verbose=false] - Verbose logging
 * @property {Object} [rdf] - RDF configuration
 * @property {boolean} [semanticValidation=false] - Enable semantic validation
 */

/**
 * @typedef {Object} TemplateConfig
 * @property {string} name - Template name
 * @property {string} path - Template file path
 * @property {Object} frontmatter - Parsed frontmatter configuration
 * @property {string[]} variables - Required template variables
 * @property {Object} [rdf] - RDF data sources
 * @property {string[]} [compliance] - Compliance frameworks
 */

/**
 * @typedef {Object} GenerationResult
 * @property {boolean} success - Generation success status
 * @property {string[]} files - Generated file paths
 * @property {Object} [errors] - Error details if any
 * @property {Object} [performance] - Performance metrics
 * @property {Object} [audit] - Audit trail information
 */