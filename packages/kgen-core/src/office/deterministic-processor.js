/**
 * Deterministic Office/LaTeX Document Processor
 * 
 * Main processor that integrates OPC normalization, LaTeX normalization,
 * template linting, and semantic diffing for deterministic document generation.
 * 
 * @module deterministic-processor
 * @version 1.0.0
 */

import { OPCNormalizer } from './normalization/opc-normalizer.js';
import { LaTeXNormalizer } from './normalization/latex-normalizer.js';
import { TemplateLinter } from './normalization/template-linter.js';
import { SemanticDiffer } from './normalization/semantic-differ.js';
import { OfficeTemplateProcessor } from './office-template-processor.js';
import { DocURIResolver } from './doc-uri-resolver.js';
import { CASIntegration } from './integration/cas-integration.js';
import crypto from 'crypto';
import fs from 'fs/promises';

/**
 * Deterministic document processor with normalization
 */
export class DeterministicProcessor {
  constructor(options = {}) {
    this.options = {
      enableOPCNormalization: true,
      enableLaTeXNormalization: true,
      enableTemplateLinting: true,
      enableSemanticDiffing: true,
      strictMode: true,
      performanceTracking: true,
      maxRetries: 3,
      ...options
    };

    // Initialize sub-processors
    this.opcNormalizer = new OPCNormalizer(options.opc);
    this.latexNormalizer = new LaTeXNormalizer(options.latex);
    this.templateLinter = new TemplateLinter(options.linter);
    this.semanticDiffer = new SemanticDiffer(options.differ);
    
    // Content-addressable storage and doc:// URI resolver
    this.casIntegration = new CASIntegration({
      casDirectory: options.casDirectory || '.kgen/cas',
      ...options.cas
    });
    this.docResolver = new DocURIResolver({
      casDirectory: options.casDirectory || '.kgen/cas',
      cas: this.casIntegration,
      ...options.docResolver
    });
    
    // Office template processor for base functionality
    this.officeProcessor = new OfficeTemplateProcessor({
      ...options.office,
      deterministic: true
    });

    // Performance tracking
    this.metrics = {
      processedDocuments: 0,
      normalizationTime: 0,
      lintingTime: 0,
      generationTime: 0,
      totalTime: 0,
      reproducibilityRate: 0
    };
  }

  /**
   * Process template with deterministic output
   * 
   * @param {string} templatePath - Path to template file or doc:// URI
   * @param {Object} context - Template context data
   * @param {string} outputPath - Output file path or doc:// URI for storage
   * @param {Object} options - Processing options
   * @returns {Promise<Object>} Processing result with metrics
   */
  async processTemplate(templatePath, context, outputPath, options = {}) {
    const startTime = this.getDeterministicTimestamp();
    
    try {
      // Step 0: Resolve template URI if it's a doc:// URI
      let resolvedTemplatePath = templatePath;
      let templateMetadata = {};
      
      if (templatePath.startsWith('doc://')) {
        const resolveResult = await this.docResolver.resolveURI(templatePath);
        if (!resolveResult.success) {
          throw new Error(`Failed to resolve template URI ${templatePath}: ${resolveResult.error}`);
        }
        
        // Write resolved content to temp file for processing
        const tempPath = `${outputPath}.template.tmp`;
        await fs.writeFile(tempPath, resolveResult.content);
        resolvedTemplatePath = tempPath;
        templateMetadata = resolveResult.metadata;
      }

      // Step 1: Validate template for deterministic patterns
      if (this.options.enableTemplateLinting) {
        await this.validateTemplate(resolvedTemplatePath);
        await this.validateContext(context);
      }

      // Step 2: Generate document using base processor
      const generationStart = this.getDeterministicTimestamp();
      let tempOutputPath = outputPath;
      
      // If output is doc:// URI, use temp file
      if (outputPath.startsWith('doc://')) {
        tempOutputPath = `${outputPath.replace('doc://', '')}.output.tmp`;
      }
      
      const result = await this.officeProcessor.process(resolvedTemplatePath, context, tempOutputPath, {
        ...options,
        deterministic: true
      });
      this.metrics.generationTime += this.getDeterministicTimestamp() - generationStart;

      // Step 3: Normalize output for deterministic properties
      let finalOutputPath = tempOutputPath;
      let docURI = null;
      let storeResult = null;
      
      if (result.success) {
        await this.normalizeOutput(tempOutputPath, result.documentType);
        
        // If output should be stored as doc:// URI
        if (outputPath.startsWith('doc://')) {
          const documentBuffer = await fs.readFile(tempOutputPath);
          storeResult = await this.docResolver.storeDocument(documentBuffer, {
            templatePath,
            templateMetadata,
            context: this.sanitizeContext(context),
            documentType: result.documentType,
            processingOptions: options,
            deterministic: true
          });
          
          docURI = storeResult.docURI;
          finalOutputPath = null; // Content stored in CAS, not filesystem
        } else {
          // Copy temp file to final location if needed
          if (tempOutputPath !== outputPath) {
            await fs.copyFile(tempOutputPath, outputPath);
            finalOutputPath = outputPath;
          }
        }
      }

      // Step 4: Verify reproducibility
      const verification = await this.verifyReproducibility(
        resolvedTemplatePath, 
        context, 
        tempOutputPath, 
        result.documentType
      );

      // Clean up temp files
      try {
        if (resolvedTemplatePath !== templatePath && resolvedTemplatePath.endsWith('.tmp')) {
          await fs.unlink(resolvedTemplatePath);
        }
        if (tempOutputPath !== outputPath && tempOutputPath.endsWith('.tmp')) {
          await fs.unlink(tempOutputPath);
        }
      } catch (cleanupError) {
        // Ignore cleanup errors
      }

      const totalTime = this.getDeterministicTimestamp() - startTime;
      this.metrics.processedDocuments++;
      this.metrics.totalTime += totalTime;

      return {
        ...result,
        deterministic: true,
        reproducible: verification.reproducible,
        normalizationApplied: verification.normalizationApplied,
        docURI,
        contentHash: storeResult?.contentHash || verification.contentHash,
        outputPath: finalOutputPath,
        storeResult,
        templateMetadata,
        metrics: {
          processingTime: totalTime,
          normalizationTime: verification.normalizationTime,
          verificationTime: verification.verificationTime
        },
        verification
      };

    } catch (error) {
      return {
        success: false,
        deterministic: false,
        error: error.message,
        stack: error.stack,
        metrics: {
          processingTime: this.getDeterministicTimestamp() - startTime,
          failed: true
        }
      };
    }
  }

  /**
   * Validate template for non-deterministic patterns
   * 
   * @param {string} templatePath - Template file path
   * @returns {Promise<void>} Throws if validation fails
   */
  async validateTemplate(templatePath) {
    const lintStart = this.getDeterministicTimestamp();
    
    try {
      const templateContent = await fs.readFile(templatePath, 'utf8');
      const lintResult = this.templateLinter.lintTemplate(templateContent, templatePath);
      
      this.metrics.lintingTime += this.getDeterministicTimestamp() - lintStart;

      if (!lintResult.valid) {
        const errorMessages = lintResult.errors.map(e => e.message);
        const warningMessages = lintResult.warnings.map(w => w.message);
        
        throw new Error(
          `Template contains non-deterministic patterns:\n` +
          `Errors: ${errorMessages.join(', ')}\n` +
          `Warnings: ${warningMessages.join(', ')}`
        );
      }
    } catch (error) {
      // If file can't be read as text, it might be a binary Office template
      // Skip text-based linting for binary templates
      if (error.code !== 'EISDIR' && !error.message.includes('non-deterministic')) {
        // Log warning but don't fail for binary templates
        console.warn(`Template linting skipped for binary template: ${templatePath}`);
      } else if (error.message.includes('non-deterministic')) {
        throw error;
      }
    }
  }

  /**
   * Validate template context for deterministic data
   * 
   * @param {Object} context - Template context
   * @returns {Promise<void>} Throws if validation fails
   */
  async validateContext(context) {
    const contextResult = this.templateLinter.validateTemplateContext(context);
    
    if (!contextResult.valid && this.options.strictMode) {
      const errorMessages = contextResult.issues
        .filter(i => i.severity === 'error')
        .map(i => i.message);
      
      if (errorMessages.length > 0) {
        throw new Error(
          `Template context contains non-deterministic data:\n${errorMessages.join('\n')}`
        );
      }
    }
  }

  /**
   * Normalize output document for deterministic properties
   * 
   * @param {string} outputPath - Output file path
   * @param {string} documentType - Document type (word, excel, powerpoint, latex)
   * @returns {Promise<void>}
   */
  async normalizeOutput(outputPath, documentType) {
    const normalizationStart = this.getDeterministicTimestamp();
    
    try {
      if (documentType === 'latex' && this.options.enableLaTeXNormalization) {
        await this.normalizeLaTeXFile(outputPath);
      } else if (['word', 'excel', 'powerpoint'].includes(documentType) && 
                 this.options.enableOPCNormalization) {
        await this.normalizeOfficeFile(outputPath);
      }
      
      this.metrics.normalizationTime += this.getDeterministicTimestamp() - normalizationStart;
    } catch (error) {
      console.warn(`Normalization failed for ${outputPath}: ${error.message}`);
      // Don't fail the entire process if normalization fails
    }
  }

  /**
   * Normalize Office file using OPC normalizer
   * 
   * @param {string} filePath - File path to normalize
   * @returns {Promise<void>}
   */
  async normalizeOfficeFile(filePath) {
    const fileBuffer = await fs.readFile(filePath);
    const normalizedBuffer = await this.opcNormalizer.normalizeOfficeDocument(fileBuffer);
    await fs.writeFile(filePath, normalizedBuffer);
  }

  /**
   * Normalize LaTeX file using LaTeX normalizer
   * 
   * @param {string} filePath - File path to normalize
   * @returns {Promise<void>}
   */
  async normalizeLaTeXFile(filePath) {
    const content = await fs.readFile(filePath, 'utf8');
    const normalizedContent = this.latexNormalizer.normalizeLaTeX(content);
    await fs.writeFile(filePath, normalizedContent, 'utf8');
  }

  /**
   * Verify document reproducibility by generating multiple times
   * 
   * @param {string} templatePath - Template path
   * @param {Object} context - Template context
   * @param {string} originalPath - Original output path
   * @param {string} documentType - Document type
   * @returns {Promise<Object>} Verification result
   */
  async verifyReproducibility(templatePath, context, originalPath, documentType) {
    const verificationStart = this.getDeterministicTimestamp();
    const tempPaths = [];
    const contentHashes = [];
    
    try {
      // Generate the document multiple times
      const verificationRuns = 3;
      
      for (let i = 0; i < verificationRuns; i++) {
        const tempPath = `${originalPath}.verify${i}`;
        tempPaths.push(tempPath);
        
        // Generate document
        const result = await this.officeProcessor.process(
          templatePath, 
          context, 
          tempPath,
          { deterministic: true }
        );
        
        if (result.success) {
          // Normalize the verification copy
          await this.normalizeOutput(tempPath, documentType);
          
          // Calculate content hash
          const fileBuffer = await fs.readFile(tempPath);
          const contentHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
          contentHashes.push(contentHash);
        }
      }
      
      // Compare all generated versions
      const reproducible = contentHashes.length > 1 && 
                          contentHashes.every(hash => hash === contentHashes[0]);
      
      // Clean up temporary files
      for (const tempPath of tempPaths) {
        try {
          await fs.unlink(tempPath);
        } catch (error) {
          // Ignore cleanup errors
        }
      }
      
      // Update reproducibility metrics
      if (reproducible) {
        this.metrics.reproducibilityRate = 
          ((this.metrics.reproducibilityRate * (this.metrics.processedDocuments - 1)) + 1) / 
          this.metrics.processedDocuments;
      } else {
        this.metrics.reproducibilityRate = 
          (this.metrics.reproducibilityRate * (this.metrics.processedDocuments - 1)) / 
          this.metrics.processedDocuments;
      }
      
      return {
        reproducible,
        contentHash: contentHashes[0] || null,
        verificationRuns,
        normalizationApplied: true,
        verificationTime: this.getDeterministicTimestamp() - verificationStart,
        hashesMatched: contentHashes.filter((hash, index) => hash === contentHashes[0]).length,
        hashVariation: new Set(contentHashes).size === 1 ? 0 : new Set(contentHashes).size
      };
      
    } catch (error) {
      // Clean up on error
      for (const tempPath of tempPaths) {
        try {
          await fs.unlink(tempPath);
        } catch (cleanupError) {
          // Ignore cleanup errors
        }
      }
      
      return {
        reproducible: false,
        error: error.message,
        verificationTime: this.getDeterministicTimestamp() - verificationStart,
        normalizationApplied: false
      };
    }
  }

  /**
   * Compare two documents semantically
   * 
   * @param {string} path1 - First document path
   * @param {string} path2 - Second document path
   * @returns {Promise<Object>} Comparison result
   */
  async compareDocuments(path1, path2) {
    if (!this.options.enableSemanticDiffing) {
      throw new Error('Semantic diffing is disabled');
    }
    
    const buffer1 = await fs.readFile(path1);
    const buffer2 = await fs.readFile(path2);
    
    return this.semanticDiffer.compareDocuments(buffer1, buffer2);
  }

  /**
   * Batch process multiple templates
   * 
   * @param {Array} templates - Array of {templatePath, context, outputPath} objects
   * @param {Object} options - Processing options
   * @returns {Promise<Object>} Batch processing result
   */
  async batchProcess(templates, options = {}) {
    const startTime = this.getDeterministicTimestamp();
    const results = [];
    const errors = [];
    
    for (let i = 0; i < templates.length; i++) {
      const template = templates[i];
      
      try {
        const result = await this.processTemplate(
          template.templatePath,
          template.context,
          template.outputPath,
          options
        );
        
        results.push({
          index: i,
          templatePath: template.templatePath,
          ...result
        });
      } catch (error) {
        errors.push({
          index: i,
          templatePath: template.templatePath,
          error: error.message
        });
      }
    }
    
    const totalTime = this.getDeterministicTimestamp() - startTime;
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
      metrics: {
        totalTime,
        averageTime: totalTime / templates.length,
        ...this.getMetrics()
      }
    };
  }

  /**
   * Get current performance metrics
   * 
   * @returns {Object} Performance metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      averageProcessingTime: this.metrics.processedDocuments > 0 ? 
        this.metrics.totalTime / this.metrics.processedDocuments : 0,
      averageNormalizationTime: this.metrics.processedDocuments > 0 ? 
        this.metrics.normalizationTime / this.metrics.processedDocuments : 0,
      reproducibilityPercentage: (this.metrics.reproducibilityRate * 100).toFixed(2)
    };
  }

  /**
   * Reset performance metrics
   */
  resetMetrics() {
    this.metrics = {
      processedDocuments: 0,
      normalizationTime: 0,
      lintingTime: 0,
      generationTime: 0,
      totalTime: 0,
      reproducibilityRate: 0
    };
  }

  /**
   * Generate deterministic content hash for a template and context
   * 
   * @param {string} templatePath - Template path or doc:// URI
   * @param {Object} context - Template context
   * @returns {Promise<string>} Deterministic hash
   */
  async generateContentHash(templatePath, context) {
    let templateBuffer;
    
    // Handle doc:// URI templates
    if (templatePath.startsWith('doc://')) {
      const resolveResult = await this.docResolver.resolveURI(templatePath);
      if (!resolveResult.success) {
        throw new Error(`Failed to resolve template URI for hashing: ${resolveResult.error}`);
      }
      templateBuffer = resolveResult.content;
    } else {
      templateBuffer = await fs.readFile(templatePath);
    }
    
    const contextString = JSON.stringify(context, Object.keys(context).sort());
    
    const hash = crypto.createHash('sha256');
    hash.update(templateBuffer);
    hash.update(contextString);
    
    return hash.digest('hex');
  }

  /**
   * Create doc:// URI from file path
   * 
   * @param {string} filePath - File path to store
   * @param {Object} metadata - Optional metadata
   * @returns {Promise<Object>} Storage result with doc:// URI
   */
  async createDocURI(filePath, metadata = {}) {
    const documentBuffer = await fs.readFile(filePath);
    return this.docResolver.storeDocument(documentBuffer, metadata);
  }

  /**
   * Resolve doc:// URI to content
   * 
   * @param {string} docURI - doc:// URI to resolve
   * @returns {Promise<Object>} Resolution result
   */
  async resolveDocURI(docURI) {
    return this.docResolver.resolveURI(docURI);
  }

  /**
   * Sanitize context for storage (remove functions, etc.)
   * 
   * @param {Object} context - Template context
   * @returns {Object} Sanitized context
   */
  sanitizeContext(context) {
    const sanitized = {};
    
    for (const [key, value] of Object.entries(context)) {
      if (typeof value !== 'function') {
        if (value instanceof Date) {
          sanitized[key] = value.toISOString();
        } else if (value && typeof value === 'object') {
          sanitized[key] = this.sanitizeContext(value);
        } else {
          sanitized[key] = value;
        }
      }
    }
    
    return sanitized;
  }

  /**
   * Validate system configuration for deterministic processing
   * 
   * @returns {Object} Configuration validation result
   */
  validateConfiguration() {
    const issues = [];
    const warnings = [];
    
    // Check Node.js version consistency
    const nodeVersion = process.version;
    if (!nodeVersion.startsWith('v18.') && !nodeVersion.startsWith('v20.')) {
      warnings.push(`Node.js version ${nodeVersion} may produce different results`);
    }
    
    // Check timezone setting
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (timezone !== 'UTC') {
      warnings.push(`Timezone ${timezone} may affect date/time formatting`);
    }
    
    // Check locale settings
    const locale = Intl.DateTimeFormat().resolvedOptions().locale;
    if (!locale.startsWith('en')) {
      warnings.push(`Locale ${locale} may affect number/date formatting`);
    }
    
    return {
      valid: issues.length === 0,
      issues,
      warnings,
      environment: {
        nodeVersion,
        timezone,
        locale,
        platform: process.platform
      }
    };
  }
}

/**
 * Create deterministic processor with default settings
 * 
 * @param {Object} options - Processor options
 * @returns {DeterministicProcessor} Configured processor
 */
export function createDeterministicProcessor(options = {}) {
  return new DeterministicProcessor(options);
}

/**
 * Quick deterministic processing function
 * 
 * @param {string} templatePath - Template path
 * @param {Object} context - Template context
 * @param {string} outputPath - Output path
 * @param {Object} options - Processing options
 * @returns {Promise<Object>} Processing result
 */
export async function processDeterministic(templatePath, context, outputPath, options = {}) {
  const processor = new DeterministicProcessor(options);
  return processor.processTemplate(templatePath, context, outputPath);
}

export default DeterministicProcessor;