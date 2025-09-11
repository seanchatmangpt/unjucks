/**
 * KGEN Office Document Processing System
 * 
 * Complete solution for processing Office document templates including Word, Excel, 
 * and PowerPoint files with variable replacement, content injection, and deterministic 
 * document generation capabilities.
 * 
 * @module office
 * @version 1.0.0
 */

// Core types and constants
export * from './core/types.js';

// Base processor
export { BaseOfficeProcessor } from './core/base-processor.js';

// Document processors
export { WordProcessor } from './processors/word-processor.js';
export { ExcelProcessor } from './processors/excel-processor.js';
export { PowerPointProcessor } from './processors/powerpoint-processor.js';

// Content injection system
export { OfficeInjector } from './injectors/office-injector.js';

// Utilities
export { VariableExtractor } from './utils/variable-extractor.js';
export { ValidationEngine } from './utils/validation-engine.js';
export { Logger, LogLevel } from './utils/logger.js';
export { InjectionValidator } from './utils/injection-validator.js';
export { FileFormatDetector } from './utils/file-format-detector.js';

// Main template processor factory
export { OfficeTemplateProcessor } from './office-template-processor.js';

/**
 * Office document processing system version
 */
export const VERSION = '1.0.0';

/**
 * Quick access to commonly used functionality
 */
export const Office = {
  // Document type constants
  DocumentType: {
    WORD: 'word',
    EXCEL: 'excel', 
    POWERPOINT: 'powerpoint',
    PDF: 'pdf'
  },

  // Variable syntax options
  VariableSyntax: {
    NUNJUCKS: 'nunjucks',
    SIMPLE: 'simple',
    MUSTACHE: 'mustache',
    HANDLEBARS: 'handlebars'
  },

  // Processing modes
  ProcessingMode: {
    REPLACE: 'replace',
    INJECT: 'inject',
    APPEND: 'append',
    PREPEND: 'prepend',
    MERGE: 'merge'
  },

  // Error severity levels
  ErrorSeverity: {
    INFO: 'info',
    WARNING: 'warning',
    ERROR: 'error',
    CRITICAL: 'critical'
  }
};

/**
 * Creates a new Office template processor with default configuration
 * 
 * @param {ProcessingOptions} [options={}] - Processing options
 * @returns {OfficeTemplateProcessor} Configured template processor
 * 
 * @example
 * ```javascript
 * import { createOfficeProcessor } from '@kgen/office';
 * 
 * const processor = createOfficeProcessor({
 *   syntax: 'nunjucks',
 *   debug: true,
 *   validation: { enabled: true }
 * });
 * 
 * const result = await processor.processTemplate(
 *   './templates/report.docx',
 *   { userName: 'John Doe', date: new Date() },
 *   './output/report.docx'
 * );
 * ```
 */
export function createOfficeProcessor(options = {}) {
  const { OfficeTemplateProcessor } = await import('./office-template-processor.js');
  return new OfficeTemplateProcessor(options);
}

/**
 * Creates a new Office content injector with default configuration
 * 
 * @param {Object} [options={}] - Injector options
 * @returns {OfficeInjector} Configured content injector
 * 
 * @example
 * ```javascript
 * import { createOfficeInjector } from '@kgen/office';
 * 
 * const injector = createOfficeInjector({
 *   preserveFormatting: true,
 *   validateInputs: true
 * });
 * 
 * const result = await injector.injectFile({
 *   filePath: './templates/document.docx',
 *   injections: [
 *     { target: 'bookmark:title', content: 'My Document Title' },
 *     { target: 'bookmark:content', content: 'Document content here...' }
 *   ],
 *   outputPath: './output/document.docx'
 * });
 * ```
 */
export function createOfficeInjector(options = {}) {
  const { OfficeInjector } = await import('./injectors/office-injector.js');
  return new OfficeInjector(options);
}

/**
 * Utility function to detect Office document format
 * 
 * @param {string} filePath - Path to the document file
 * @returns {Promise<string>} Detected format (word, excel, powerpoint, pdf, unknown)
 * 
 * @example
 * ```javascript
 * import { detectDocumentFormat } from '@kgen/office';
 * 
 * const format = await detectDocumentFormat('./document.docx');
 * console.log(format); // 'word'
 * ```
 */
export async function detectDocumentFormat(filePath) {
  const { FileFormatDetector } = await import('./utils/file-format-detector.js');
  const detector = new FileFormatDetector();
  return detector.detectFormat(filePath);
}

/**
 * Utility function to extract variables from Office documents
 * 
 * @param {string} filePath - Path to the template file
 * @param {string} [syntax='nunjucks'] - Variable syntax to use
 * @returns {Promise<TemplateVariable[]>} Extracted template variables
 * 
 * @example
 * ```javascript
 * import { extractTemplateVariables } from '@kgen/office';
 * 
 * const variables = await extractTemplateVariables('./template.docx');
 * console.log(variables);
 * // [{ name: 'userName', type: 'string', required: true }, ...]
 * ```
 */
export async function extractTemplateVariables(filePath, syntax = 'nunjucks') {
  const processor = await createOfficeProcessor({ syntax });
  const format = await detectDocumentFormat(filePath);
  
  // Get the appropriate processor for the detected format
  const documentProcessor = processor.getProcessorForType(format);
  if (!documentProcessor) {
    throw new Error(`Unsupported document format: ${format}`);
  }
  
  // Load template and extract variables
  const template = await documentProcessor.loadTemplate(filePath);
  const frontmatter = await documentProcessor.parseFrontmatter(template);
  const variables = await documentProcessor.extractVariables(template, frontmatter);
  
  // Analyze and return structured variable information
  return documentProcessor.variableExtractor.analyzeVariables(variables, frontmatter);
}

/**
 * Utility function to validate template data
 * 
 * @param {Object} data - Data to validate
 * @param {string} filePath - Path to the template file
 * @param {ValidationOptions} [options] - Validation options
 * @returns {Promise<ValidationResult>} Validation result
 * 
 * @example
 * ```javascript
 * import { validateTemplateData } from '@kgen/office';
 * 
 * const result = await validateTemplateData(
 *   { userName: 'John', age: 30 },
 *   './template.docx'
 * );
 * 
 * if (!result.valid) {
 *   console.error('Validation errors:', result.errors);
 * }
 * ```
 */
export async function validateTemplateData(data, filePath, options = {}) {
  const processor = await createOfficeProcessor({ validation: options });
  const format = await detectDocumentFormat(filePath);
  
  const documentProcessor = processor.getProcessorForType(format);
  if (!documentProcessor) {
    throw new Error(`Unsupported document format: ${format}`);
  }
  
  const template = await documentProcessor.loadTemplate(filePath);
  const frontmatter = await documentProcessor.parseFrontmatter(template);
  
  return documentProcessor.validateData(data, frontmatter);
}

/**
 * Quick processing function for simple template operations
 * 
 * @param {string} templatePath - Path to template file
 * @param {Object} data - Template data
 * @param {string} [outputPath] - Output file path
 * @param {ProcessingOptions} [options] - Processing options
 * @returns {Promise<ProcessingResult>} Processing result
 * 
 * @example
 * ```javascript
 * import { processTemplate } from '@kgen/office';
 * 
 * const result = await processTemplate(
 *   './templates/report.docx',
 *   { title: 'Q4 Report', date: '2024-01-01' },
 *   './output/report.docx'
 * );
 * 
 * if (result.success) {
 *   console.log('Template processed successfully:', result.outputPath);
 * }
 * ```
 */
export async function processTemplate(templatePath, data, outputPath, options = {}) {
  const processor = await createOfficeProcessor(options);
  return processor.process(templatePath, data, outputPath);
}

/**
 * Batch processing function for multiple templates
 * 
 * @param {Array<{templatePath: string, data: Object, outputPath?: string}>} templates - Templates to process
 * @param {ProcessingOptions} [options] - Processing options
 * @returns {Promise<BatchProcessingResult>} Batch processing results
 * 
 * @example
 * ```javascript
 * import { batchProcessTemplates } from '@kgen/office';
 * 
 * const results = await batchProcessTemplates([
 *   { templatePath: './template1.docx', data: { name: 'John' }, outputPath: './output1.docx' },
 *   { templatePath: './template2.xlsx', data: { value: 100 }, outputPath: './output2.xlsx' }
 * ]);
 * 
 * console.log(`Processed ${results.completed} of ${results.total} templates`);
 * ```
 */
export async function batchProcessTemplates(templates, options = {}) {
  const processor = await createOfficeProcessor(options);
  return processor.batchProcess(templates);
}

// Default export for convenience
export default {
  // Main classes
  OfficeTemplateProcessor: () => import('./office-template-processor.js').then(m => m.OfficeTemplateProcessor),
  OfficeInjector: () => import('./injectors/office-injector.js').then(m => m.OfficeInjector),
  
  // Document processors
  WordProcessor: () => import('./processors/word-processor.js').then(m => m.WordProcessor),
  ExcelProcessor: () => import('./processors/excel-processor.js').then(m => m.ExcelProcessor),
  PowerPointProcessor: () => import('./processors/powerpoint-processor.js').then(m => m.PowerPointProcessor),
  
  // Utilities
  VariableExtractor: () => import('./utils/variable-extractor.js').then(m => m.VariableExtractor),
  ValidationEngine: () => import('./utils/validation-engine.js').then(m => m.ValidationEngine),
  Logger: () => import('./utils/logger.js').then(m => m.Logger),
  
  // Factory functions
  createOfficeProcessor,
  createOfficeInjector,
  
  // Utility functions
  detectDocumentFormat,
  extractTemplateVariables,
  validateTemplateData,
  processTemplate,
  batchProcessTemplates,
  
  // Constants
  Office,
  VERSION
};