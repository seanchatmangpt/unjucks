/**
 * Integrated Office Document Processor
 * 
 * Combines deterministic processing, OPC normalization, doc:// URI resolution,
 * and content-addressed storage into a unified interface.
 * 
 * @module integrated-office-processor
 * @version 1.0.0
 */

import { DeterministicProcessor } from './deterministic-processor.js';
import { DocURIResolver } from './doc-uri-resolver.js';
import { OPCNormalizer } from './normalization/opc-normalizer.js';
import { CASIntegration } from './integration/cas-integration.js';

/**
 * Integrated Office Document Processor
 * 
 * Provides a unified interface for:
 * - Deterministic document generation
 * - OPC normalization and canonicalization
 * - doc:// URI resolution and storage
 * - Content-addressed storage
 */
export class IntegratedOfficeProcessor {
  constructor(options = {}) {
    this.options = {
      casDirectory: options.casDirectory || '.kgen/cas',
      enableDeterministic: true,
      enableNormalization: true,
      enableContentAddressing: true,
      enableCache: true,
      defaultHashAlgorithm: 'sha256',
      ...options
    };

    // Initialize core components
    this.deterministicProcessor = new DeterministicProcessor({
      casDirectory: this.options.casDirectory,
      enableOPCNormalization: this.options.enableNormalization,
      enableLaTeXNormalization: this.options.enableNormalization,
      enableTemplateLinting: true,
      enableSemanticDiffing: true,
      strictMode: true,
      ...options.deterministic
    });

    this.docResolver = new DocURIResolver({
      casDirectory: this.options.casDirectory,
      enableCache: this.options.enableCache,
      enableNormalization: this.options.enableNormalization,
      defaultHashAlgorithm: this.options.defaultHashAlgorithm,
      ...options.docResolver
    });

    this.opcNormalizer = new OPCNormalizer({
      removeTimestamps: true,
      normalizeWhitespace: true,
      sortElements: true,
      removeComments: true,
      removeMetadata: true,
      compressionLevel: 6,
      ...options.opc
    });

    this.casIntegration = new CASIntegration({
      casDirectory: this.options.casDirectory,
      hashAlgorithm: this.options.defaultHashAlgorithm,
      enableDeduplication: true,
      trackProvenance: true,
      ...options.cas
    });
  }

  /**
   * Process template and return doc:// URI for result
   * 
   * @param {string} templatePath - Template path or doc:// URI
   * @param {Object} context - Template context
   * @param {Object} options - Processing options
   * @returns {Promise<Object>} Processing result with doc:// URI
   */
  async processToDocURI(templatePath, context, options = {}) {
    // Use a temporary output path, we'll store the result in CAS
    const tempOutputPath = `.tmp-${this.getDeterministicTimestamp()}-${Math.random().toString(36).slice(2)}`;
    
    try {
      // Process with deterministic processor
      const result = await this.deterministicProcessor.processTemplate(
        templatePath,
        context,
        tempOutputPath,
        {
          ...options,
          deterministic: true
        }
      );

      if (!result.success) {
        return result;
      }

      // Read the generated document
      const { readFile, unlink } = await import('fs/promises');
      const documentBuffer = await readFile(tempOutputPath);

      // Store in content-addressed storage and get doc:// URI
      const storeResult = await this.docResolver.storeDocument(documentBuffer, {
        templatePath,
        context: this.deterministicProcessor.sanitizeContext(context),
        processingResult: result,
        generatedAt: this.getDeterministicDate().toISOString()
      }, {
        algorithm: this.options.defaultHashAlgorithm,
        normalize: this.options.enableNormalization
      });

      // Clean up temp file
      try {
        await unlink(tempOutputPath);
      } catch (error) {
        // Ignore cleanup errors
      }

      return {
        ...result,
        docURI: storeResult.docURI,
        contentHash: storeResult.contentHash,
        contentAddressed: true,
        storeResult,
        outputPath: null // Content is in CAS, not filesystem
      };

    } catch (error) {
      // Clean up temp file on error
      try {
        const { unlink } = await import('fs/promises');
        await unlink(tempOutputPath);
      } catch (cleanupError) {
        // Ignore cleanup errors
      }

      return {
        success: false,
        error: error.message,
        contentAddressed: false
      };
    }
  }

  /**
   * Process template with file output
   * 
   * @param {string} templatePath - Template path or doc:// URI
   * @param {Object} context - Template context
   * @param {string} outputPath - Output file path
   * @param {Object} options - Processing options
   * @returns {Promise<Object>} Processing result
   */
  async processToFile(templatePath, context, outputPath, options = {}) {
    const result = await this.deterministicProcessor.processTemplate(
      templatePath,
      context,
      outputPath,
      options
    );

    // If content addressing is enabled, also store in CAS
    if (result.success && this.options.enableContentAddressing) {
      try {
        const { readFile } = await import('fs/promises');
        const documentBuffer = await readFile(outputPath);
        
        const storeResult = await this.docResolver.storeDocument(documentBuffer, {
          templatePath,
          context: this.deterministicProcessor.sanitizeContext(context),
          outputPath,
          processingResult: result,
          generatedAt: this.getDeterministicDate().toISOString()
        }, {
          algorithm: this.options.defaultHashAlgorithm,
          normalize: this.options.enableNormalization
        });

        result.docURI = storeResult.docURI;
        result.contentHash = storeResult.contentHash;
        result.contentAddressed = true;
        result.storeResult = storeResult;
      } catch (error) {
        // Don't fail the entire process if CAS storage fails
        result.contentAddressed = false;
        result.casError = error.message;
      }
    }

    return result;
  }

  /**
   * Resolve doc:// URI to file
   * 
   * @param {string} docURI - doc:// URI to resolve
   * @param {string} outputPath - Output file path
   * @param {Object} options - Resolution options
   * @returns {Promise<Object>} Resolution result
   */
  async resolveToFile(docURI, outputPath, options = {}) {
    try {
      const resolveResult = await this.docResolver.resolveURI(docURI, options);
      
      if (!resolveResult.success) {
        return resolveResult;
      }

      // Write resolved content to file
      const { writeFile } = await import('fs/promises');
      await writeFile(outputPath, resolveResult.content);

      return {
        ...resolveResult,
        outputPath,
        writtenToFile: true
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        docURI,
        outputPath,
        writtenToFile: false
      };
    }
  }

  /**
   * Canonicalize document from any source
   * 
   * @param {string} sourceURI - Source URI (file://, http://, doc://)
   * @param {Object} options - Canonicalization options
   * @returns {Promise<Object>} Canonicalization result
   */
  async canonicalizeDocument(sourceURI, options = {}) {
    return this.docResolver.canonicalizeURI(sourceURI, options);
  }

  /**
   * Normalize Office document
   * 
   * @param {Buffer} documentBuffer - Document buffer
   * @param {Object} options - Normalization options
   * @returns {Promise<Buffer>} Normalized document
   */
  async normalizeDocument(documentBuffer, options = {}) {
    if (!this.docResolver.isOfficeDocument(documentBuffer)) {
      throw new Error('Document is not a valid Office document');
    }

    return this.opcNormalizer.normalizeOfficeDocument(documentBuffer);
  }

  /**
   * Compare two documents for semantic equivalence
   * 
   * @param {string} uri1 - First document URI
   * @param {string} uri2 - Second document URI
   * @param {Object} options - Comparison options
   * @returns {Promise<Object>} Comparison result
   */
  async compareDocuments(uri1, uri2, options = {}) {
    try {
      // Resolve both documents
      const [result1, result2] = await Promise.all([
        this.docResolver.resolveURI(uri1, options),
        this.docResolver.resolveURI(uri2, options)
      ]);

      if (!result1.success || !result2.success) {
        return {
          success: false,
          error: `Failed to resolve documents: ${result1.error || result2.error}`,
          uri1,
          uri2
        };
      }

      // Use OPC normalizer for comparison
      const comparison = await this.opcNormalizer.verifyDocumentEquivalence(
        result1.content,
        result2.content
      );

      return {
        success: true,
        uri1,
        uri2,
        identical: comparison.identical,
        differences: comparison.differences,
        hash1: this.opcNormalizer.generateContentHash(result1.content),
        hash2: this.opcNormalizer.generateContentHash(result2.content)
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        uri1,
        uri2,
        identical: false
      };
    }
  }

  /**
   * Batch process multiple templates
   * 
   * @param {Array} templates - Array of {templatePath, context, outputType} objects
   * @param {Object} options - Processing options
   * @returns {Promise<Object>} Batch processing result
   */
  async batchProcess(templates, options = {}) {
    const { concurrency = 3, outputType = 'docuri' } = options;
    const results = [];
    const errors = [];

    // Process in batches to avoid overwhelming the system
    for (let i = 0; i < templates.length; i += concurrency) {
      const batch = templates.slice(i, i + concurrency);
      
      const batchPromises = batch.map(async (template, batchIndex) => {
        const globalIndex = i + batchIndex;
        
        try {
          let result;
          
          if (outputType === 'docuri') {
            result = await this.processToDocURI(
              template.templatePath,
              template.context,
              options
            );
          } else if (outputType === 'file' && template.outputPath) {
            result = await this.processToFile(
              template.templatePath,
              template.context,
              template.outputPath,
              options
            );
          } else {
            throw new Error(`Invalid output type or missing outputPath: ${outputType}`);
          }

          results.push({
            index: globalIndex,
            templatePath: template.templatePath,
            ...result
          });

        } catch (error) {
          errors.push({
            index: globalIndex,
            templatePath: template.templatePath,
            error: error.message
          });
        }
      });

      await Promise.all(batchPromises);
    }

    // Sort results by index to maintain order
    results.sort((a, b) => a.index - b.index);
    errors.sort((a, b) => a.index - b.index);

    const successCount = results.filter(r => r.success).length;
    const reproducibleCount = results.filter(r => r.reproducible).length;

    return {
      success: errors.length === 0,
      totalTemplates: templates.length,
      successfullyProcessed: successCount,
      reproducible: reproducibleCount,
      reproducibilityRate: successCount > 0 ? reproducibleCount / successCount : 0,
      results,
      errors,
      outputType
    };
  }

  /**
   * Get system status and metrics
   * 
   * @returns {Object} System status
   */
  getSystemStatus() {
    return {
      deterministic: this.deterministicProcessor.getMetrics(),
      docResolver: this.docResolver.getCacheStats(),
      cas: this.options.enableContentAddressing,
      normalization: this.options.enableNormalization,
      caching: this.options.enableCache
    };
  }

  /**
   * Clear all caches
   */
  clearCaches() {
    this.docResolver.clearCache();
    this.deterministicProcessor.resetMetrics();
  }

  /**
   * Validate system configuration
   * 
   * @returns {Object} Configuration validation result
   */
  validateConfiguration() {
    const deterministicValidation = this.deterministicProcessor.validateConfiguration();
    
    return {
      ...deterministicValidation,
      components: {
        deterministicProcessor: true,
        docResolver: true,
        opcNormalizer: true,
        casIntegration: this.options.enableContentAddressing
      },
      options: this.options
    };
  }
}

/**
 * Create integrated office processor with default settings
 * 
 * @param {Object} options - Processor options
 * @returns {IntegratedOfficeProcessor} Configured processor
 */
export function createIntegratedOfficeProcessor(options = {}) {
  return new IntegratedOfficeProcessor(options);
}

/**
 * Quick template processing to doc:// URI
 * 
 * @param {string} templatePath - Template path
 * @param {Object} context - Template context
 * @param {Object} options - Processing options
 * @returns {Promise<Object>} Processing result
 */
export async function processTemplateToDocURI(templatePath, context, options = {}) {
  const processor = new IntegratedOfficeProcessor(options);
  return processor.processToDocURI(templatePath, context, options);
}

/**
 * Quick document canonicalization
 * 
 * @param {string} sourceURI - Source URI
 * @param {Object} options - Canonicalization options
 * @returns {Promise<Object>} Canonicalization result
 */
export async function canonicalizeDocument(sourceURI, options = {}) {
  const processor = new IntegratedOfficeProcessor(options);
  return processor.canonicalizeDocument(sourceURI, options);
}

export default IntegratedOfficeProcessor;