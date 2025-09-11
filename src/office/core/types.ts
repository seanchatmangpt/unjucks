/**
 * Core types and interfaces for Office document template processing in Unjucks
 * 
 * This module defines the fundamental types, interfaces, and enums used throughout
 * the Office document processing system. It provides type safety and consistency
 * across all document processors.
 * 
 * @module office/core/types
 * @version 1.0.0
 */

/**
 * Supported Office document types
 */
export enum DocumentType {
  WORD = 'word',
  EXCEL = 'excel',
  POWERPOINT = 'powerpoint',
  PDF = 'pdf'
}

/**
 * Variable syntax patterns supported in templates
 */
export enum VariableSyntax {
  NUNJUCKS = 'nunjucks', // {{variable}}
  SIMPLE = 'simple',     // {variable}
  MUSTACHE = 'mustache', // {{variable}}
  HANDLEBARS = 'handlebars' // {{variable}}
}

/**
 * Processing modes for document templates
 */
export enum ProcessingMode {
  REPLACE = 'replace',   // Replace variables in-place
  INJECT = 'inject',     // Inject content at markers
  APPEND = 'append',     // Append content to document
  PREPEND = 'prepend',   // Prepend content to document
  MERGE = 'merge'        // Merge multiple templates
}

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

/**
 * Template variable information
 */
export interface TemplateVariable {
  /** Variable name */
  name: string;
  /** Variable type */
  type: 'string' | 'number' | 'boolean' | 'date' | 'object' | 'array';
  /** Default value */
  defaultValue?: any;
  /** Whether the variable is required */
  required: boolean;
  /** Variable description */
  description?: string;
  /** Validation rules */
  validation?: VariableValidation;
  /** Location in document */
  location?: VariableLocation;
}

/**
 * Variable validation rules
 */
export interface VariableValidation {
  /** Minimum value/length */
  min?: number;
  /** Maximum value/length */
  max?: number;
  /** Regular expression pattern */
  pattern?: string;
  /** Allowed values */
  enum?: any[];
  /** Custom validation function */
  custom?: (value: any) => boolean | string;
}

/**
 * Variable location in document
 */
export interface VariableLocation {
  /** Document section */
  section: string;
  /** Page number (for paginated documents) */
  page?: number;
  /** Paragraph or cell reference */
  reference?: string;
  /** Character position */
  position?: number;
}

/**
 * Template frontmatter configuration
 */
export interface TemplateFrontmatter {
  /** Template name */
  name?: string;
  /** Template description */
  description?: string;
  /** Document type */
  type: DocumentType;
  /** Variable syntax to use */
  syntax?: VariableSyntax;
  /** Processing mode */
  mode?: ProcessingMode;
  /** Template variables */
  variables?: TemplateVariable[];
  /** Injection points */
  injectionPoints?: InjectionPoint[];
  /** Template metadata */
  metadata?: Record<string, any>;
  /** Output configuration */
  output?: OutputConfiguration;
  /** Validation rules */
  validation?: ValidationRules;
}

/**
 * Injection point for content insertion
 */
export interface InjectionPoint {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Location marker in template */
  marker: string;
  /** Content type */
  type: 'text' | 'html' | 'markdown' | 'table' | 'image' | 'chart';
  /** Whether content is required */
  required: boolean;
  /** Default content */
  defaultContent?: string;
  /** Processing instructions */
  processing?: ProcessingInstructions;
}

/**
 * Processing instructions for injection points
 */
export interface ProcessingInstructions {
  /** Text formatting */
  format?: TextFormat;
  /** Position relative to marker */
  position?: 'before' | 'after' | 'replace';
  /** Whether to preserve formatting */
  preserveFormatting?: boolean;
  /** Custom processing function */
  processor?: string;
}

/**
 * Text formatting options
 */
export interface TextFormat {
  /** Font family */
  fontFamily?: string;
  /** Font size */
  fontSize?: number;
  /** Bold text */
  bold?: boolean;
  /** Italic text */
  italic?: boolean;
  /** Underline text */
  underline?: boolean;
  /** Text color */
  color?: string;
  /** Background color */
  backgroundColor?: string;
  /** Text alignment */
  alignment?: 'left' | 'center' | 'right' | 'justify';
}

/**
 * Output configuration
 */
export interface OutputConfiguration {
  /** Output file extension */
  extension?: string;
  /** Output directory */
  directory?: string;
  /** File naming pattern */
  naming?: string;
  /** Whether to preserve original formatting */
  preserveFormatting?: boolean;
  /** Compression settings */
  compression?: CompressionSettings;
  /** Export formats */
  formats?: string[];
}

/**
 * Compression settings
 */
export interface CompressionSettings {
  /** Enable compression */
  enabled: boolean;
  /** Compression level (1-9) */
  level?: number;
  /** Compression algorithm */
  algorithm?: 'gzip' | 'deflate' | 'brotli';
}

/**
 * Validation rules for templates
 */
export interface ValidationRules {
  /** Require all variables to be defined */
  strictVariables?: boolean;
  /** Allow unknown variables */
  allowUnknownVariables?: boolean;
  /** Custom validation functions */
  customValidators?: ValidationFunction[];
  /** Schema validation */
  schema?: any;
}

/**
 * Custom validation function
 */
export interface ValidationFunction {
  /** Function name */
  name: string;
  /** Function implementation */
  fn: (data: any, context: ProcessingContext) => ValidationResult;
  /** Function description */
  description?: string;
}

/**
 * Processing context passed to processors and validators
 */
export interface ProcessingContext {
  /** Template being processed */
  template: TemplateInfo;
  /** Input data */
  data: Record<string, any>;
  /** Processing options */
  options: ProcessingOptions;
  /** Current document state */
  document?: any;
  /** Processing statistics */
  stats?: ProcessingStats;
}

/**
 * Template information
 */
export interface TemplateInfo {
  /** Template file path */
  path: string;
  /** Template name */
  name: string;
  /** Template type */
  type: DocumentType;
  /** Template size in bytes */
  size: number;
  /** Last modified date */
  lastModified: Date;
  /** Template hash */
  hash?: string;
  /** Frontmatter */
  frontmatter?: TemplateFrontmatter;
}

/**
 * Processing options
 */
export interface ProcessingOptions {
  /** Variable syntax to use */
  syntax?: VariableSyntax;
  /** Processing mode */
  mode?: ProcessingMode;
  /** Output configuration */
  output?: OutputConfiguration;
  /** Enable debug mode */
  debug?: boolean;
  /** Dry run mode */
  dryRun?: boolean;
  /** Force overwrite existing files */
  force?: boolean;
  /** Validation options */
  validation?: ValidationOptions;
  /** Custom processors */
  processors?: Record<string, any>;
}

/**
 * Validation options
 */
export interface ValidationOptions {
  /** Enable validation */
  enabled: boolean;
  /** Stop on first error */
  failFast?: boolean;
  /** Validation level */
  level?: 'strict' | 'moderate' | 'lenient';
  /** Custom validators */
  validators?: ValidationFunction[];
}

/**
 * Processing statistics
 */
export interface ProcessingStats {
  /** Start time */
  startTime: Date;
  /** End time */
  endTime?: Date;
  /** Duration in milliseconds */
  duration?: number;
  /** Number of variables processed */
  variablesProcessed: number;
  /** Number of injections performed */
  injectionsPerformed: number;
  /** Number of errors encountered */
  errors: number;
  /** Number of warnings */
  warnings: number;
  /** Memory usage */
  memoryUsage?: MemoryUsage;
}

/**
 * Memory usage statistics
 */
export interface MemoryUsage {
  /** Used heap size */
  used: number;
  /** Total heap size */
  total: number;
  /** Maximum heap size */
  max: number;
}

/**
 * Validation result
 */
export interface ValidationResult {
  /** Whether validation passed */
  valid: boolean;
  /** Error messages */
  errors: ValidationError[];
  /** Warning messages */
  warnings: ValidationWarning[];
}

/**
 * Validation error
 */
export interface ValidationError {
  /** Error message */
  message: string;
  /** Error code */
  code: string;
  /** Field that caused the error */
  field?: string;
  /** Error severity */
  severity: ErrorSeverity;
  /** Additional context */
  context?: any;
}

/**
 * Validation warning
 */
export interface ValidationWarning {
  /** Warning message */
  message: string;
  /** Warning code */
  code: string;
  /** Field that caused the warning */
  field?: string;
  /** Additional context */
  context?: any;
}

/**
 * Processing result
 */
export interface ProcessingResult {
  /** Whether processing was successful */
  success: boolean;
  /** Output file path */
  outputPath?: string;
  /** Processing statistics */
  stats: ProcessingStats;
  /** Validation result */
  validation: ValidationResult;
  /** Generated content */
  content?: Buffer | string;
  /** Metadata about the processed document */
  metadata?: DocumentMetadata;
}

/**
 * Document metadata
 */
export interface DocumentMetadata {
  /** Document title */
  title?: string;
  /** Document author */
  author?: string;
  /** Document subject */
  subject?: string;
  /** Document keywords */
  keywords?: string[];
  /** Creation date */
  created?: Date;
  /** Last modified date */
  modified?: Date;
  /** Document properties */
  properties?: Record<string, any>;
}

/**
 * Batch processing configuration
 */
export interface BatchProcessingConfig {
  /** Templates to process */
  templates: string[];
  /** Input data for each template */
  data: Record<string, any>[];
  /** Output directory */
  outputDir: string;
  /** Processing options */
  options: ProcessingOptions;
  /** Parallel processing */
  parallel?: boolean;
  /** Maximum concurrent processes */
  maxConcurrency?: number;
  /** Progress callback */
  onProgress?: (progress: BatchProgress) => void;
}

/**
 * Batch processing progress
 */
export interface BatchProgress {
  /** Total number of templates */
  total: number;
  /** Number of completed templates */
  completed: number;
  /** Number of failed templates */
  failed: number;
  /** Current template being processed */
  current?: string;
  /** Processing percentage */
  percentage: number;
  /** Estimated time remaining */
  estimatedTimeRemaining?: number;
}

/**
 * Plugin interface for extending functionality
 */
export interface OfficePlugin {
  /** Plugin name */
  name: string;
  /** Plugin version */
  version: string;
  /** Supported document types */
  supportedTypes: DocumentType[];
  /** Plugin initialization */
  initialize?(context: PluginContext): Promise<void>;
  /** Process hook */
  process?(context: ProcessingContext): Promise<ProcessingResult>;
  /** Validation hook */
  validate?(context: ProcessingContext): Promise<ValidationResult>;
  /** Cleanup hook */
  cleanup?(): Promise<void>;
}

/**
 * Plugin context
 */
export interface PluginContext {
  /** Plugin configuration */
  config: Record<string, any>;
  /** Logger instance */
  logger: any;
  /** Utility functions */
  utils: Record<string, any>;
}

/**
 * Template discovery result
 */
export interface TemplateDiscoveryResult {
  /** Found templates */
  templates: TemplateInfo[];
  /** Search statistics */
  stats: DiscoveryStats;
  /** Errors encountered during discovery */
  errors: ValidationError[];
}

/**
 * Discovery statistics
 */
export interface DiscoveryStats {
  /** Total files scanned */
  filesScanned: number;
  /** Templates found */
  templatesFound: number;
  /** Directories searched */
  directoriesSearched: number;
  /** Search duration */
  duration: number;
  /** File types distribution */
  typeDistribution: Record<DocumentType, number>;
}
