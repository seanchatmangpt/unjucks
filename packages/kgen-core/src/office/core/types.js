/**
 * Core types and interfaces for Office document template processing in KGEN
 * 
 * This module defines the fundamental types, interfaces, and enums used throughout
 * the Office document processing system. It provides type safety and consistency
 * across all document processors.
 * 
 * @module office/core/types
 * @version 1.0.0
 */

/**
 * Supported document types (LaTeX-based and legacy)
 * @enum {string}
 */
export const DocumentType = {
  // Legacy Office types (now LaTeX-based)
  WORD: 'word',
  EXCEL: 'excel',
  POWERPOINT: 'powerpoint',
  PDF: 'pdf',
  
  // Native LaTeX types
  LATEX: 'latex',
  LATEX_TABLE: 'latex-table',
  LATEX_PRESENTATION: 'latex-presentation',
  LATEX_ACADEMIC: 'latex-academic',
  LATEX_REPORT: 'latex-report',
  LATEX_ARTICLE: 'latex-article',
  LATEX_BOOK: 'latex-book',
  LATEX_LETTER: 'latex-letter',
  LATEX_CV: 'latex-cv'
};

/**
 * Variable syntax patterns supported in templates
 * @enum {string}
 */
export const VariableSyntax = {
  NUNJUCKS: 'nunjucks', // {{variable}}
  SIMPLE: 'simple',     // {variable}
  MUSTACHE: 'mustache', // {{variable}}
  HANDLEBARS: 'handlebars' // {{variable}}
};

/**
 * Processing modes for document templates
 * @enum {string}
 */
export const ProcessingMode = {
  REPLACE: 'replace',   // Replace variables in-place
  INJECT: 'inject',     // Inject content at markers
  APPEND: 'append',     // Append content to document
  PREPEND: 'prepend',   // Prepend content to document
  MERGE: 'merge'        // Merge multiple templates
};

/**
 * Error severity levels
 * @enum {string}
 */
export const ErrorSeverity = {
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
  CRITICAL: 'critical'
};

/**
 * Template variable information
 * @typedef {Object} TemplateVariable
 * @property {string} name - Variable name
 * @property {'string'|'number'|'boolean'|'date'|'object'|'array'} type - Variable type
 * @property {*} [defaultValue] - Default value
 * @property {boolean} required - Whether the variable is required
 * @property {string} [description] - Variable description
 * @property {VariableValidation} [validation] - Validation rules
 * @property {VariableLocation} [location] - Location in document
 */

/**
 * Variable validation rules
 * @typedef {Object} VariableValidation
 * @property {number} [min] - Minimum value/length
 * @property {number} [max] - Maximum value/length
 * @property {string} [pattern] - Regular expression pattern
 * @property {Array<*>} [enum] - Allowed values
 * @property {Function} [custom] - Custom validation function
 */

/**
 * Variable location in document
 * @typedef {Object} VariableLocation
 * @property {string} section - Document section
 * @property {number} [page] - Page number (for paginated documents)
 * @property {string} [reference] - Paragraph or cell reference
 * @property {number} [position] - Character position
 */

/**
 * Template frontmatter configuration
 * @typedef {Object} TemplateFrontmatter
 * @property {string} [name] - Template name
 * @property {string} [description] - Template description
 * @property {string} type - Document type
 * @property {string} [syntax] - Variable syntax to use
 * @property {string} [mode] - Processing mode
 * @property {TemplateVariable[]} [variables] - Template variables
 * @property {InjectionPoint[]} [injectionPoints] - Injection points
 * @property {Object} [metadata] - Template metadata
 * @property {OutputConfiguration} [output] - Output configuration
 * @property {ValidationRules} [validation] - Validation rules
 */

/**
 * Injection point for content insertion
 * @typedef {Object} InjectionPoint
 * @property {string} id - Unique identifier
 * @property {string} name - Display name
 * @property {string} marker - Location marker in template
 * @property {'text'|'html'|'markdown'|'table'|'image'|'chart'} type - Content type
 * @property {boolean} required - Whether content is required
 * @property {string} [defaultContent] - Default content
 * @property {ProcessingInstructions} [processing] - Processing instructions
 */

/**
 * Processing instructions for injection points
 * @typedef {Object} ProcessingInstructions
 * @property {TextFormat} [format] - Text formatting
 * @property {'before'|'after'|'replace'} [position] - Position relative to marker
 * @property {boolean} [preserveFormatting] - Whether to preserve formatting
 * @property {string} [processor] - Custom processing function
 */

/**
 * Text formatting options
 * @typedef {Object} TextFormat
 * @property {string} [fontFamily] - Font family
 * @property {number} [fontSize] - Font size
 * @property {boolean} [bold] - Bold text
 * @property {boolean} [italic] - Italic text
 * @property {boolean} [underline] - Underline text
 * @property {string} [color] - Text color
 * @property {string} [backgroundColor] - Background color
 * @property {'left'|'center'|'right'|'justify'} [alignment] - Text alignment
 */

/**
 * Output configuration
 * @typedef {Object} OutputConfiguration
 * @property {string} [extension] - Output file extension
 * @property {string} [directory] - Output directory
 * @property {string} [naming] - File naming pattern
 * @property {boolean} [preserveFormatting] - Whether to preserve original formatting
 * @property {CompressionSettings} [compression] - Compression settings
 * @property {string[]} [formats] - Export formats
 */

/**
 * Compression settings
 * @typedef {Object} CompressionSettings
 * @property {boolean} enabled - Enable compression
 * @property {number} [level] - Compression level (1-9)
 * @property {'gzip'|'deflate'|'brotli'} [algorithm] - Compression algorithm
 */

/**
 * Validation rules for templates
 * @typedef {Object} ValidationRules
 * @property {boolean} [strictVariables] - Require all variables to be defined
 * @property {boolean} [allowUnknownVariables] - Allow unknown variables
 * @property {ValidationFunction[]} [customValidators] - Custom validation functions
 * @property {*} [schema] - Schema validation
 */

/**
 * Custom validation function
 * @typedef {Object} ValidationFunction
 * @property {string} name - Function name
 * @property {Function} fn - Function implementation
 * @property {string} [description] - Function description
 */

/**
 * Processing context passed to processors and validators
 * @typedef {Object} ProcessingContext
 * @property {TemplateInfo} template - Template being processed
 * @property {Object} data - Input data
 * @property {ProcessingOptions} options - Processing options
 * @property {*} [document] - Current document state
 * @property {ProcessingStats} [stats] - Processing statistics
 */

/**
 * Template information
 * @typedef {Object} TemplateInfo
 * @property {string} path - Template file path
 * @property {string} name - Template name
 * @property {string} type - Document type
 * @property {number} size - Template size in bytes
 * @property {Date} lastModified - Last modified date
 * @property {string} [hash] - Template hash
 * @property {TemplateFrontmatter} [frontmatter] - Frontmatter
 */

/**
 * Processing options
 * @typedef {Object} ProcessingOptions
 * @property {string} [syntax] - Variable syntax to use
 * @property {string} [mode] - Processing mode
 * @property {OutputConfiguration} [output] - Output configuration
 * @property {boolean} [debug] - Enable debug mode
 * @property {boolean} [dryRun] - Dry run mode
 * @property {boolean} [force] - Force overwrite existing files
 * @property {ValidationOptions} [validation] - Validation options
 * @property {Object} [processors] - Custom processors
 */

/**
 * Validation options
 * @typedef {Object} ValidationOptions
 * @property {boolean} enabled - Enable validation
 * @property {boolean} [failFast] - Stop on first error
 * @property {'strict'|'moderate'|'lenient'} [level] - Validation level
 * @property {ValidationFunction[]} [validators] - Custom validators
 */

/**
 * Processing statistics
 * @typedef {Object} ProcessingStats
 * @property {Date} startTime - Start time
 * @property {Date} [endTime] - End time
 * @property {number} [duration] - Duration in milliseconds
 * @property {number} variablesProcessed - Number of variables processed
 * @property {number} injectionsPerformed - Number of injections performed
 * @property {number} errors - Number of errors encountered
 * @property {number} warnings - Number of warnings
 * @property {MemoryUsage} [memoryUsage] - Memory usage
 */

/**
 * Memory usage statistics
 * @typedef {Object} MemoryUsage
 * @property {number} used - Used heap size
 * @property {number} total - Total heap size
 * @property {number} max - Maximum heap size
 */

/**
 * Validation result
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - Whether validation passed
 * @property {ValidationError[]} errors - Error messages
 * @property {ValidationWarning[]} warnings - Warning messages
 */

/**
 * Validation error
 * @typedef {Object} ValidationError
 * @property {string} message - Error message
 * @property {string} code - Error code
 * @property {string} [field] - Field that caused the error
 * @property {string} severity - Error severity
 * @property {*} [context] - Additional context
 */

/**
 * Validation warning
 * @typedef {Object} ValidationWarning
 * @property {string} message - Warning message
 * @property {string} code - Warning code
 * @property {string} [field] - Field that caused the warning
 * @property {*} [context] - Additional context
 */

/**
 * Processing result
 * @typedef {Object} ProcessingResult
 * @property {boolean} success - Whether processing was successful
 * @property {string} [outputPath] - Output file path
 * @property {ProcessingStats} stats - Processing statistics
 * @property {ValidationResult} validation - Validation result
 * @property {Buffer|string} [content] - Generated content
 * @property {DocumentMetadata} [metadata] - Document metadata
 */

/**
 * Document metadata
 * @typedef {Object} DocumentMetadata
 * @property {string} [title] - Document title
 * @property {string} [author] - Document author
 * @property {string} [subject] - Document subject
 * @property {string[]} [keywords] - Document keywords
 * @property {Date} [created] - Creation date
 * @property {Date} [modified] - Last modified date
 * @property {Object} [properties] - Document properties
 */

/**
 * Batch processing configuration
 * @typedef {Object} BatchProcessingConfig
 * @property {string[]} templates - Templates to process
 * @property {Object[]} data - Input data for each template
 * @property {string} outputDir - Output directory
 * @property {ProcessingOptions} options - Processing options
 * @property {boolean} [parallel] - Parallel processing
 * @property {number} [maxConcurrency] - Maximum concurrent processes
 * @property {Function} [onProgress] - Progress callback
 */

/**
 * Batch processing progress
 * @typedef {Object} BatchProgress
 * @property {number} total - Total number of templates
 * @property {number} completed - Number of completed templates
 * @property {number} failed - Number of failed templates
 * @property {string} [current] - Current template being processed
 * @property {number} percentage - Processing percentage
 * @property {number} [estimatedTimeRemaining] - Estimated time remaining
 */

/**
 * Plugin interface for extending functionality
 * @typedef {Object} OfficePlugin
 * @property {string} name - Plugin name
 * @property {string} version - Plugin version
 * @property {string[]} supportedTypes - Supported document types
 * @property {Function} [initialize] - Plugin initialization
 * @property {Function} [process] - Process hook
 * @property {Function} [validate] - Validation hook
 * @property {Function} [cleanup] - Cleanup hook
 */

/**
 * Plugin context
 * @typedef {Object} PluginContext
 * @property {Object} config - Plugin configuration
 * @property {*} logger - Logger instance
 * @property {Object} utils - Utility functions
 */

/**
 * Template discovery result
 * @typedef {Object} TemplateDiscoveryResult
 * @property {TemplateInfo[]} templates - Found templates
 * @property {DiscoveryStats} stats - Search statistics
 * @property {ValidationError[]} errors - Errors encountered during discovery
 */

/**
 * Discovery statistics
 * @typedef {Object} DiscoveryStats
 * @property {number} filesScanned - Total files scanned
 * @property {number} templatesFound - Templates found
 * @property {number} directoriesSearched - Directories searched
 * @property {number} duration - Search duration
 * @property {Object} typeDistribution - File types distribution
 */