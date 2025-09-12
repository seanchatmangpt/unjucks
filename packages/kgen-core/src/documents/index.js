/**
 * KGEN Document Generation System
 * 
 * Complete document generation system integrating Unjucks' mature Office document
 * processing with KGEN's deterministic generation, semantic reasoning, and 
 * provenance tracking capabilities.
 * 
 * @module documents
 * @version 1.0.0
 */

// Core document engine
export { 
  DocumentEngine, 
  DocumentType, 
  DocumentMode, 
  createDocumentEngine 
} from './document-engine.js';

// Document-specific frontmatter processing
export { 
  DocumentFrontmatterProcessor, 
  DocumentFrontmatterFields,
  createDocumentFrontmatterProcessor 
} from './frontmatter-processor.js';

// Office document integration (re-export from office module)
export { 
  OfficeTemplateProcessor,
  createOfficeProcessor,
  createOfficeInjector,
  detectDocumentFormat,
  extractTemplateVariables,
  validateTemplateData,
  processTemplate,
  batchProcessTemplates
} from '../office/index.js';

// LaTeX integration (re-export from latex module)
export { 
  TemplateSelector as LatexTemplateSelector,
  RESUME_TEMPLATES as LATEX_RESUME_TEMPLATES
} from '../latex/selector.js';

/**
 * Document generation utilities and constants
 */
export const Documents = {
  // Document types
  Type: {
    WORD: 'word',
    EXCEL: 'excel', 
    POWERPOINT: 'powerpoint',
    LATEX: 'latex',
    PDF: 'pdf',
    MARKDOWN: 'markdown',
    HTML: 'html'
  },

  // Generation modes
  Mode: {
    TEMPLATE: 'template',
    INJECTION: 'injection',
    COMPILATION: 'compilation',
    SEMANTIC: 'semantic',
    HYBRID: 'hybrid'
  },

  // Office document formats
  OfficeFormat: {
    DOCX: 'docx',
    XLSX: 'xlsx',
    PPTX: 'pptx'
  },

  // LaTeX compilers
  LatexCompiler: {
    PDFLATEX: 'pdflatex',
    XELATEX: 'xelatex',
    LUALATEX: 'lualatex'
  }
};

/**
 * Quick document generation function
 * 
 * Simplified interface for generating documents with minimal configuration.
 * Automatically detects document type and selects appropriate generation mode.
 * 
 * @param {Object} options - Generation options
 * @param {string} options.template - Template path or content
 * @param {Object} options.data - Template data
 * @param {string} options.output - Output file path
 * @param {string} [options.type] - Document type (auto-detected if not specified)
 * @param {Object} [options.config] - Additional configuration
 * @returns {Promise<Object>} Generation result
 * 
 * @example
 * ```javascript
 * import { generateDocument } from '@kgen/documents';
 * 
 * // Generate Word document
 * const result = await generateDocument({
 *   template: './templates/report.docx',
 *   data: { title: 'Q4 Report', author: 'John Doe' },
 *   output: './output/report.docx'
 * });
 * 
 * // Generate PDF from LaTeX
 * const pdfResult = await generateDocument({
 *   template: './templates/resume.tex',
 *   data: { name: 'Jane Smith', skills: ['JavaScript', 'Python'] },
 *   output: './output/resume.pdf',
 *   type: 'pdf'
 * });
 * ```
 */
export async function generateDocument(options) {
  const { DocumentEngine } = await import('./document-engine.js');
  const engine = new DocumentEngine(options.config);

  // Auto-detect document type if not specified
  let documentType = options.type;
  if (!documentType) {
    documentType = detectDocumentTypeFromPath(options.output || options.template);
  }

  return engine.generateDocument({
    template: options.template,
    context: options.data || {},
    documentType,
    outputPath: options.output,
    ...options
  });
}

/**
 * Batch document generation function
 * 
 * Generate multiple documents in parallel with shared configuration.
 * 
 * @param {Array<Object>} documents - Array of document generation options
 * @param {Object} [sharedConfig] - Shared configuration for all documents
 * @returns {Promise<Array<Object>>} Array of generation results
 * 
 * @example
 * ```javascript
 * import { generateDocuments } from '@kgen/documents';
 * 
 * const results = await generateDocuments([
 *   { template: './templates/invoice.docx', data: { customer: 'A' }, output: './invoices/A.docx' },
 *   { template: './templates/invoice.docx', data: { customer: 'B' }, output: './invoices/B.docx' },
 *   { template: './templates/invoice.docx', data: { customer: 'C' }, output: './invoices/C.docx' }
 * ], { enableProvenanceTracking: true });
 * ```
 */
export async function generateDocuments(documents, sharedConfig = {}) {
  const { DocumentEngine } = await import('./document-engine.js');
  const engine = new DocumentEngine(sharedConfig);

  const promises = documents.map(async (doc) => {
    const documentType = doc.type || detectDocumentTypeFromPath(doc.output || doc.template);
    
    return engine.generateDocument({
      template: doc.template,
      context: doc.data || {},
      documentType,
      outputPath: doc.output,
      ...doc
    });
  });

  return Promise.all(promises);
}

/**
 * Create a document template processor
 * 
 * Factory function for creating document processors with specific configurations.
 * 
 * @param {Object} options - Processor configuration
 * @param {string} [options.type] - Default document type
 * @param {string} [options.templatesDir] - Templates directory
 * @param {string} [options.outputDir] - Output directory
 * @param {boolean} [options.enableProvenance] - Enable provenance tracking
 * @returns {DocumentEngine} Configured document engine
 * 
 * @example
 * ```javascript
 * import { createDocumentProcessor } from '@kgen/documents';
 * 
 * const processor = createDocumentProcessor({
 *   type: 'word',
 *   templatesDir: './document-templates',
 *   outputDir: './generated-documents',
 *   enableProvenance: true
 * });
 * 
 * const result = await processor.generateDocument({
 *   template: 'contract.docx',
 *   context: { clientName: 'Acme Corp', date: this.getDeterministicDate() }
 * });
 * ```
 */
export function createDocumentProcessor(options = {}) {
  const { DocumentEngine } = require('./document-engine.js');
  return new DocumentEngine({
    defaultDocumentType: options.type,
    documentsDir: options.templatesDir,
    outputDir: options.outputDir,
    enableProvenanceTracking: options.enableProvenance,
    ...options
  });
}

/**
 * Validate document template
 * 
 * Validate document template structure, frontmatter, and dependencies.
 * 
 * @param {string} templatePath - Path to template file
 * @param {Object} [options] - Validation options
 * @returns {Promise<Object>} Validation result
 * 
 * @example
 * ```javascript
 * import { validateDocumentTemplate } from '@kgen/documents';
 * 
 * const validation = await validateDocumentTemplate('./templates/report.docx', {
 *   strictValidation: true,
 *   checkDependencies: true
 * });
 * 
 * if (!validation.valid) {
 *   console.error('Template validation errors:', validation.errors);
 * }
 * ```
 */
export async function validateDocumentTemplate(templatePath, options = {}) {
  const { DocumentFrontmatterProcessor } = await import('./frontmatter-processor.js');
  const processor = new DocumentFrontmatterProcessor(options);

  try {
    // Read template content
    const { readFileSync } = await import('fs');
    const content = readFileSync(templatePath, 'utf8');

    // Parse and validate document frontmatter
    const result = await processor.parseDocumentFrontmatter(content, true);

    return {
      valid: result.validation.valid,
      errors: result.validation.errors,
      warnings: result.validation.warnings,
      documentMetadata: result.documentMetadata,
      isDocumentTemplate: result.isDocumentTemplate,
      requirements: processor.extractGenerationRequirements(result.documentMetadata),
      pipeline: processor.generateProcessingPipeline(result.documentMetadata)
    };

  } catch (error) {
    return {
      valid: false,
      errors: [error.message],
      warnings: [],
      documentMetadata: null,
      isDocumentTemplate: false
    };
  }
}

/**
 * Extract document variables
 * 
 * Extract all variables used in a document template for validation and documentation.
 * 
 * @param {string} templatePath - Path to template file
 * @param {Object} [options] - Extraction options
 * @returns {Promise<Object>} Extracted variables and metadata
 * 
 * @example
 * ```javascript
 * import { extractDocumentVariables } from '@kgen/documents';
 * 
 * const variables = await extractDocumentVariables('./templates/contract.docx');
 * console.log('Template variables:', variables.variables);
 * console.log('Required variables:', variables.required);
 * ```
 */
export async function extractDocumentVariables(templatePath, options = {}) {
  const documentType = detectDocumentTypeFromPath(templatePath);
  
  if ([Documents.Type.WORD, Documents.Type.EXCEL, Documents.Type.POWERPOINT].includes(documentType)) {
    // Use Office variable extraction
    const { extractTemplateVariables } = await import('../office/index.js');
    return extractTemplateVariables(templatePath, options.syntax || 'nunjucks');
  } else {
    // Use template engine variable extraction
    const { TemplateEngine } = await import('../templating/template-engine.js');
    const engine = new TemplateEngine(options);
    
    const { readFileSync } = await import('fs');
    const content = readFileSync(templatePath, 'utf8');
    const variables = engine.extractVariables(content);
    
    return {
      variables: Array.from(variables),
      templatePath,
      documentType,
      extractionMethod: 'template-engine'
    };
  }
}

/**
 * Get document generation statistics
 * 
 * Retrieve statistics for document generation operations.
 * 
 * @param {DocumentEngine} [engine] - Document engine instance
 * @returns {Object} Generation statistics
 */
export function getDocumentStats(engine) {
  if (!engine) {
    return {
      message: 'No document engine provided',
      globalStats: 'Not available without engine instance'
    };
  }
  
  return engine.getDocumentStats();
}

/**
 * Internal utility: Detect document type from file path
 */
function detectDocumentTypeFromPath(filePath) {
  if (!filePath) return Documents.Type.WORD; // Default
  
  const extension = filePath.toLowerCase().split('.').pop();
  
  const extensionMap = {
    'docx': Documents.Type.WORD,
    'doc': Documents.Type.WORD,
    'xlsx': Documents.Type.EXCEL,
    'xls': Documents.Type.EXCEL,
    'pptx': Documents.Type.POWERPOINT,
    'ppt': Documents.Type.POWERPOINT,
    'tex': Documents.Type.LATEX,
    'pdf': Documents.Type.PDF,
    'md': Documents.Type.MARKDOWN,
    'markdown': Documents.Type.MARKDOWN,
    'html': Documents.Type.HTML,
    'htm': Documents.Type.HTML
  };
  
  return extensionMap[extension] || Documents.Type.WORD;
}

/**
 * Document generation system version
 */
export const VERSION = '1.0.0';

/**
 * Default export for convenience
 */
export default {
  // Main classes
  DocumentEngine,
  DocumentFrontmatterProcessor,
  
  // Constants
  Documents,
  DocumentType,
  DocumentMode,
  VERSION,
  
  // Factory functions
  createDocumentEngine,
  createDocumentFrontmatterProcessor,
  createDocumentProcessor,
  
  // Utility functions
  generateDocument,
  generateDocuments,
  validateDocumentTemplate,
  extractDocumentVariables,
  getDocumentStats
};