/**
 * Integrated Office Document Processing Module
 * 
 * Exports the complete integrated office document processing system including:
 * - Deterministic document processing
 * - doc:// URI resolution and storage
 * - OPC canonical normalization
 * - Content-addressed storage integration
 * 
 * @module office/integrated
 * @version 1.0.0
 */

// Main integrated components
export { DeterministicProcessor, createDeterministicProcessor, processDeterministic } from './deterministic-processor.js';
export { DocURIResolver, createDocURIResolver, resolveURI, canonicalizeURI } from './doc-uri-resolver.js';
export { IntegratedOfficeProcessor, createIntegratedOfficeProcessor, processTemplateToDocURI, canonicalizeDocument } from './integrated-office-processor.js';

// Normalization components
export { OPCNormalizer, createOPCNormalizer, normalizeOfficeDocument } from './normalization/opc-normalizer.js';
export { LaTeXNormalizer } from './normalization/latex-normalizer.js';
export { TemplateLinter } from './normalization/template-linter.js';
export { SemanticDiffer } from './normalization/semantic-differ.js';

// Content-addressed storage
export { CASIntegration, createCASIntegration } from './integration/cas-integration.js';

// Re-export base office functionality
export { OfficeTemplateProcessor } from './office-template-processor.js';
export * from './core/types.js';

// URI schemes and types
export const SUPPORTED_URI_SCHEMES = {
  DOC: 'doc',
  FILE: 'file',
  HTTP: 'http',
  HTTPS: 'https'
};

export const CONTENT_ADDRESS_TYPES = {
  SHA256: 'sha256',
  SHA512: 'sha512',
  BLAKE3: 'blake3'
};

/**
 * Quick setup function for integrated office processing
 * 
 * @param {Object} options - Configuration options
 * @returns {Object} Configured processors and utilities
 */
export function setupIntegratedOfficeProcessing(options = {}) {
  const config = {
    casDirectory: options.casDirectory || '.kgen/cas',
    enableDeterministic: options.enableDeterministic !== false,
    enableNormalization: options.enableNormalization !== false,
    enableContentAddressing: options.enableContentAddressing !== false,
    enableCache: options.enableCache !== false,
    defaultHashAlgorithm: options.defaultHashAlgorithm || 'sha256',
    ...options
  };

  return {
    // Main processor with all capabilities
    processor: new IntegratedOfficeProcessor(config),
    
    // Individual components
    deterministic: new DeterministicProcessor(config),
    docResolver: new DocURIResolver(config),
    opcNormalizer: new OPCNormalizer(config.opc),
    casIntegration: new CASIntegration(config.cas),
    
    // Configuration
    config
  };
}

/**
 * Process template with automatic format detection and optimal processing
 * 
 * @param {string} templatePath - Template path or doc:// URI
 * @param {Object} context - Template context
 * @param {Object} options - Processing options
 * @returns {Promise<Object>} Processing result
 */
export async function smartProcessTemplate(templatePath, context, options = {}) {
  const { outputType = 'auto', ...processingOptions } = options;
  const processor = new IntegratedOfficeProcessor(processingOptions);

  // Auto-detect optimal output type based on template and options
  if (outputType === 'auto') {
    // If template is already a doc:// URI, use content addressing
    if (templatePath.startsWith('doc://')) {
      return processor.processToDocURI(templatePath, context, processingOptions);
    }
    
    // If content addressing is explicitly enabled, use doc:// URIs
    if (processingOptions.enableContentAddressing !== false) {
      return processor.processToDocURI(templatePath, context, processingOptions);
    }
  }

  // Default to doc:// URI processing for integrated benefits
  return processor.processToDocURI(templatePath, context, processingOptions);
}

/**
 * Batch process templates with automatic optimization
 * 
 * @param {Array} templates - Array of template configurations
 * @param {Object} options - Processing options
 * @returns {Promise<Object>} Batch processing result
 */
export async function smartBatchProcess(templates, options = {}) {
  const processor = new IntegratedOfficeProcessor(options);
  
  // Enhance templates with smart defaults
  const enhancedTemplates = templates.map(template => ({
    outputType: 'docuri', // Default to content addressing
    ...template
  }));

  return processor.batchProcess(enhancedTemplates, {
    outputType: 'docuri',
    concurrency: Math.min(templates.length, 5), // Optimal concurrency
    ...options
  });
}

/**
 * Validate integrated system configuration
 * 
 * @param {Object} options - Configuration options
 * @returns {Object} Validation result
 */
export function validateIntegratedConfiguration(options = {}) {
  const processor = new IntegratedOfficeProcessor(options);
  return processor.validateConfiguration();
}

/**
 * Create a complete document processing pipeline
 * 
 * @param {Object} config - Pipeline configuration
 * @returns {Object} Document processing pipeline
 */
export function createDocumentPipeline(config = {}) {
  const processors = setupIntegratedOfficeProcessing(config);
  
  return {
    // Process single template
    async process(templatePath, context, options = {}) {
      return smartProcessTemplate(templatePath, context, { ...config, ...options });
    },

    // Batch process
    async batchProcess(templates, options = {}) {
      return smartBatchProcess(templates, { ...config, ...options });
    },

    // Canonicalize document
    async canonicalize(sourceURI, options = {}) {
      return processors.processor.canonicalizeDocument(sourceURI, { ...config, ...options });
    },

    // Resolve doc:// URI
    async resolve(docURI, outputPath = null, options = {}) {
      if (outputPath) {
        return processors.processor.resolveToFile(docURI, outputPath, { ...config, ...options });
      } else {
        return processors.docResolver.resolveURI(docURI, { ...config, ...options });
      }
    },

    // Compare documents
    async compare(uri1, uri2, options = {}) {
      return processors.processor.compareDocuments(uri1, uri2, { ...config, ...options });
    },

    // Get system status
    getStatus() {
      return processors.processor.getSystemStatus();
    },

    // Clear caches
    clearCaches() {
      processors.processor.clearCaches();
    },

    // Validate configuration
    validate() {
      return processors.processor.validateConfiguration();
    },

    // Access individual processors
    processors
  };
}

// Default export with most commonly used functionality
export default {
  // Main classes
  IntegratedOfficeProcessor,
  DeterministicProcessor,
  DocURIResolver,
  OPCNormalizer,
  CASIntegration,

  // Factory functions
  setupIntegratedOfficeProcessing,
  createDocumentPipeline,
  
  // Smart processing functions
  smartProcessTemplate,
  smartBatchProcess,
  
  // Utility functions
  validateIntegratedConfiguration,
  
  // Constants
  SUPPORTED_URI_SCHEMES,
  CONTENT_ADDRESS_TYPES
};