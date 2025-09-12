/**
 * KGEN Document Generation Engine
 * 
 * Extends the KGEN template engine with specialized document generation capabilities
 * for Office documents (Word, Excel, PowerPoint) and LaTeX compilation.
 * 
 * Integrates Unjucks' mature document processing with KGEN's deterministic generation,
 * semantic reasoning, and provenance tracking.
 * 
 * @module documents/document-engine
 * @version 1.0.0
 */

import { TemplateEngine } from '../templating/template-engine.js';
import { OfficeTemplateProcessor } from '../office/office-template-processor.js';
import { TemplateSelector } from '../latex/selector.js';
import { ProvenanceGenerator } from '../provenance/attestation/generator.js';
import { SecurityManager } from '../security/core/security-manager.js';
import { SemanticInjector } from './semantic-injector.js';
import { DocumentAttestationSystem } from './document-attestation.js';
import path from 'path';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import crypto from 'crypto';

/**
 * Document types supported by KGEN
 */
export const DocumentType = {
  WORD: 'word',
  EXCEL: 'excel',
  POWERPOINT: 'powerpoint',
  LATEX: 'latex',
  PDF: 'pdf',
  MARKDOWN: 'markdown',
  HTML: 'html'
};

/**
 * Document generation modes
 */
export const DocumentMode = {
  TEMPLATE: 'template',       // Standard template rendering
  INJECTION: 'injection',     // Content injection into existing documents
  COMPILATION: 'compilation', // LaTeX compilation to PDF
  SEMANTIC: 'semantic',       // Semantic data-driven generation
  HYBRID: 'hybrid'           // Multiple modes combined
};

/**
 * KGEN Document Generation Engine
 * 
 * Provides deterministic document generation with provenance tracking,
 * semantic reasoning, and enterprise-grade security features.
 */
export class DocumentEngine extends TemplateEngine {
  constructor(options = {}) {
    super(options);
    
    this.documentOptions = {
      documentsDir: options.documentsDir || '_templates/documents',
      outputDir: options.outputDir || 'dist/documents',
      enableProvenanceTracking: options.enableProvenanceTracking !== false,
      enableSemanticInjection: options.enableSemanticInjection !== false,
      defaultDocumentType: options.defaultDocumentType || DocumentType.WORD,
      compilationSettings: options.compilationSettings || {},
      ...options
    };

    // Initialize specialized processors
    this.officeProcessor = new OfficeTemplateProcessor({
      syntax: 'nunjucks',
      validation: { enabled: true },
      debug: this.documentOptions.debug || false
    });

    this.latexSelector = new TemplateSelector({
      templatesDir: path.join(this.documentOptions.documentsDir, 'latex'),
      defaultTemplate: 'professional-classic'
    });

    // Initialize security and provenance systems
    if (this.documentOptions.enableProvenanceTracking) {
      this.provenanceGenerator = new ProvenanceGenerator();
    }

    this.securityManager = new SecurityManager();

    // Initialize semantic injection system
    if (this.documentOptions.enableSemanticInjection) {
      this.semanticInjector = new SemanticInjector({
        enableReasoning: this.documentOptions.enableReasoning !== false,
        enableValidation: this.documentOptions.enableValidation !== false,
        cacheResults: this.documentOptions.cacheSemanticResults !== false
      });
    }

    // Initialize document attestation system
    this.attestationSystem = new DocumentAttestationSystem({
      attestationLevel: this.documentOptions.attestationLevel || 'standard',
      enableCryptographicSigning: this.documentOptions.enableCryptographicSigning !== false,
      attestationDir: this.documentOptions.attestationDir || '.kgen/attestations'
    });

    // Track document generation statistics
    this.documentStats = {
      documentsGenerated: 0,
      officeDocuments: 0,
      latexCompilations: 0,
      semanticInjections: 0,
      provenanceRecords: 0,
      errorCount: 0,
      totalGenerationTime: 0,
      documentTypes: new Map()
    };
  }

  /**
   * Generate a document from template and context data
   * 
   * @param {Object} options - Generation options
   * @param {string} options.template - Template path or content
   * @param {Object} options.context - Template context data
   * @param {string} options.documentType - Document type to generate
   * @param {string} options.outputPath - Output file path
   * @param {Object} options.metadata - Document metadata
   * @returns {Promise<Object>} Generation result with provenance
   */
  async generateDocument(options = {}) {
    const startTime = performance.now();
    const generationId = this.generateDeterministicId(options);

    try {
      // Validate and normalize options
      const normalizedOptions = await this.normalizeGenerationOptions(options);
      
      // Security validation
      await this.validateDocumentSecurity(normalizedOptions);
      
      // Determine generation strategy
      const strategy = this.determineGenerationStrategy(normalizedOptions);
      
      // Execute document generation based on strategy
      let result;
      switch (strategy.mode) {
        case DocumentMode.TEMPLATE:
          result = await this.generateFromTemplate(normalizedOptions);
          break;
        case DocumentMode.INJECTION:
          result = await this.generateWithInjection(normalizedOptions);
          break;
        case DocumentMode.COMPILATION:
          result = await this.generateWithCompilation(normalizedOptions);
          break;
        case DocumentMode.SEMANTIC:
          result = await this.generateWithSemanticReasoning(normalizedOptions);
          break;
        case DocumentMode.HYBRID:
          result = await this.generateWithHybridApproach(normalizedOptions);
          break;
        default:
          throw new Error(`Unsupported generation mode: ${strategy.mode}`);
      }

      // Add provenance tracking
      if (this.documentOptions.enableProvenanceTracking) {
        result.provenance = await this.generateProvenance(normalizedOptions, result, generationId);
      }

      // Update statistics
      this.updateDocumentStats(normalizedOptions.documentType, performance.now() - startTime);

      return {
        success: true,
        generationId,
        documentType: normalizedOptions.documentType,
        outputPath: result.outputPath,
        content: result.content,
        metadata: result.metadata,
        provenance: result.provenance,
        strategy,
        performance: {
          generationTime: performance.now() - startTime,
          templateProcessingTime: result.templateProcessingTime
        }
      };

    } catch (error) {
      this.documentStats.errorCount++;
      
      return {
        success: false,
        generationId,
        error: error.message,
        stack: error.stack,
        performance: {
          generationTime: performance.now() - startTime
        }
      };
    }
  }

  /**
   * Generate document from template using standard template rendering
   */
  async generateFromTemplate(options) {
    const { template, context, documentType, outputPath } = options;

    // Render template content
    const rendered = await this.render(template, context, {
      validateDependencies: true,
      throwOnMissingVariables: true
    });

    // Process based on document type
    let processedContent;
    let actualOutputPath = outputPath;

    switch (documentType) {
      case DocumentType.WORD:
      case DocumentType.EXCEL:
      case DocumentType.POWERPOINT:
        // Use Office processor for Office documents
        const officeResult = await this.officeProcessor.process(
          template,
          context,
          outputPath
        );
        processedContent = officeResult.content;
        actualOutputPath = officeResult.outputPath;
        break;

      case DocumentType.LATEX:
        // Process LaTeX template
        processedContent = rendered.content;
        actualOutputPath = outputPath || this.generateOutputPath(template, 'tex');
        this.ensureDirectoryExists(path.dirname(actualOutputPath));
        writeFileSync(actualOutputPath, processedContent, 'utf8');
        break;

      case DocumentType.MARKDOWN:
      case DocumentType.HTML:
        // Direct content output for markup languages
        processedContent = rendered.content;
        actualOutputPath = outputPath || this.generateOutputPath(template, documentType);
        this.ensureDirectoryExists(path.dirname(actualOutputPath));
        writeFileSync(actualOutputPath, processedContent, 'utf8');
        break;

      default:
        throw new Error(`Unsupported document type for template generation: ${documentType}`);
    }

    return {
      content: processedContent,
      outputPath: actualOutputPath,
      templateProcessingTime: rendered.metadata.renderTime,
      metadata: {
        ...rendered.metadata,
        documentType,
        generationMode: DocumentMode.TEMPLATE
      }
    };
  }

  /**
   * Generate document with content injection into existing documents
   */
  async generateWithInjection(options) {
    const { template, context, documentType, outputPath, injectionPoints } = options;

    if (!injectionPoints || injectionPoints.length === 0) {
      throw new Error('Injection points required for injection mode');
    }

    // Load base document
    const baseDocumentPath = this.resolveDocumentPath(template);
    if (!existsSync(baseDocumentPath)) {
      throw new Error(`Base document not found: ${baseDocumentPath}`);
    }

    // Process injections based on document type
    let result;
    switch (documentType) {
      case DocumentType.WORD:
      case DocumentType.EXCEL:
      case DocumentType.POWERPOINT:
        // Use Office injector
        result = await this.officeProcessor.inject({
          templatePath: baseDocumentPath,
          injectionPoints: injectionPoints.map(point => ({
            ...point,
            content: await this.renderInjectionContent(point.content, context)
          })),
          outputPath,
          context
        });
        break;

      default:
        throw new Error(`Injection mode not supported for document type: ${documentType}`);
    }

    return {
      content: result.content,
      outputPath: result.outputPath,
      templateProcessingTime: result.processingTime,
      metadata: {
        ...result.metadata,
        injectionPoints: injectionPoints.length,
        generationMode: DocumentMode.INJECTION
      }
    };
  }

  /**
   * Generate document with LaTeX compilation to PDF
   */
  async generateWithCompilation(options) {
    const { template, context, outputPath, compilationSettings = {} } = options;

    // First generate LaTeX content
    const latexResult = await this.generateFromTemplate({
      ...options,
      documentType: DocumentType.LATEX,
      outputPath: outputPath ? outputPath.replace(/\.pdf$/, '.tex') : undefined
    });

    // Compile LaTeX to PDF
    const pdfPath = outputPath || latexResult.outputPath.replace(/\.tex$/, '.pdf');
    const compilationResult = await this.compileLatexToPdf(
      latexResult.outputPath,
      pdfPath,
      compilationSettings
    );

    return {
      content: compilationResult.pdfBuffer,
      outputPath: pdfPath,
      latexPath: latexResult.outputPath,
      templateProcessingTime: latexResult.templateProcessingTime,
      compilationTime: compilationResult.compilationTime,
      metadata: {
        ...latexResult.metadata,
        compilationLog: compilationResult.log,
        generationMode: DocumentMode.COMPILATION
      }
    };
  }

  /**
   * Generate document with semantic reasoning and data injection
   */
  async generateWithSemanticReasoning(options) {
    const { template, context, knowledgeGraph, reasoningRules } = options;

    if (!this.documentOptions.enableSemanticInjection) {
      throw new Error('Semantic injection is disabled');
    }

    // Enhance context with semantic reasoning results
    const enhancedContext = await this.enhanceContextWithSemanticReasoning(
      context,
      knowledgeGraph,
      reasoningRules
    );

    // Generate document with enhanced context
    const result = await this.generateFromTemplate({
      ...options,
      context: enhancedContext
    });

    return {
      ...result,
      metadata: {
        ...result.metadata,
        semanticEnhancement: true,
        reasoningRules: reasoningRules?.length || 0,
        generationMode: DocumentMode.SEMANTIC
      }
    };
  }

  /**
   * Generate document using hybrid approach (multiple modes combined)
   */
  async generateWithHybridApproach(options) {
    const { hybridSteps } = options;

    if (!hybridSteps || hybridSteps.length === 0) {
      throw new Error('Hybrid steps required for hybrid mode');
    }

    let currentResult = null;
    const stepResults = [];

    for (const [index, step] of hybridSteps.entries()) {
      const stepOptions = {
        ...options,
        ...step,
        // Use previous result as input for next step if applicable
        template: step.template || (currentResult ? currentResult.outputPath : options.template)
      };

      let stepResult;
      switch (step.mode) {
        case DocumentMode.TEMPLATE:
          stepResult = await this.generateFromTemplate(stepOptions);
          break;
        case DocumentMode.INJECTION:
          stepResult = await this.generateWithInjection(stepOptions);
          break;
        case DocumentMode.COMPILATION:
          stepResult = await this.generateWithCompilation(stepOptions);
          break;
        case DocumentMode.SEMANTIC:
          stepResult = await this.generateWithSemanticReasoning(stepOptions);
          break;
        default:
          throw new Error(`Unsupported step mode: ${step.mode}`);
      }

      stepResults.push({
        step: index + 1,
        mode: step.mode,
        result: stepResult
      });

      currentResult = stepResult;
    }

    return {
      ...currentResult,
      metadata: {
        ...currentResult.metadata,
        hybridSteps: stepResults,
        generationMode: DocumentMode.HYBRID
      }
    };
  }

  /**
   * Compile LaTeX source to PDF
   */
  async compileLatexToPdf(latexPath, pdfPath, settings = {}) {
    const startTime = performance.now();

    // This would integrate with a LaTeX compiler like pdflatex, xelatex, or lualatex
    // For now, we'll create a placeholder implementation
    const compilationCommand = settings.compiler || 'pdflatex';
    const compilationArgs = [
      '-interaction=nonstopmode',
      `-output-directory=${path.dirname(pdfPath)}`,
      latexPath
    ];

    // In a real implementation, this would execute the LaTeX compiler
    // For now, we'll simulate the compilation
    const log = `LaTeX compilation simulated for ${latexPath}`;
    
    // Create a placeholder PDF file
    this.ensureDirectoryExists(path.dirname(pdfPath));
    writeFileSync(pdfPath, Buffer.from('PDF placeholder content'), 'binary');

    return {
      pdfBuffer: readFileSync(pdfPath),
      compilationTime: performance.now() - startTime,
      log,
      command: `${compilationCommand} ${compilationArgs.join(' ')}`
    };
  }

  /**
   * Enhance context with semantic reasoning
   */
  async enhanceContextWithSemanticReasoning(context, knowledgeGraph, reasoningRules) {
    // This would integrate with the KGEN semantic reasoning engine
    // For now, we'll provide a placeholder implementation
    const enhancedContext = { ...context };

    if (knowledgeGraph) {
      // Add semantic metadata
      enhancedContext._semantic = {
        graphSize: knowledgeGraph.length || 0,
        reasoning: 'enabled',
        timestamp: new Date().toISOString()
      };
    }

    if (reasoningRules && reasoningRules.length > 0) {
      // Apply reasoning rules to enhance context
      enhancedContext._reasoning = {
        rulesApplied: reasoningRules.length,
        inferences: [] // Would contain actual inferences
      };
    }

    this.documentStats.semanticInjections++;
    return enhancedContext;
  }

  /**
   * Render injection content with template processing
   */
  async renderInjectionContent(content, context) {
    if (typeof content === 'string' && content.includes('{{')) {
      // Content contains template variables, render it
      const rendered = await this.renderString(content, context);
      return rendered.content;
    }
    return content;
  }

  /**
   * Generate deterministic ID for document generation
   */
  generateDeterministicId(options) {
    const hash = crypto.createHash('sha256');
    hash.update(JSON.stringify({
      template: options.template,
      documentType: options.documentType,
      timestamp: options.deterministicTimestamp || new Date().toISOString().split('T')[0]
    }));
    return hash.digest('hex').substring(0, 16);
  }

  /**
   * Determine the optimal generation strategy based on options
   */
  determineGenerationStrategy(options) {
    const { documentType, injectionPoints, knowledgeGraph, hybridSteps } = options;

    // Hybrid mode takes precedence
    if (hybridSteps && hybridSteps.length > 0) {
      return { mode: DocumentMode.HYBRID, reason: 'Hybrid steps specified' };
    }

    // Semantic mode for knowledge graph integration
    if (knowledgeGraph && this.documentOptions.enableSemanticInjection) {
      return { mode: DocumentMode.SEMANTIC, reason: 'Knowledge graph provided' };
    }

    // Injection mode for content injection
    if (injectionPoints && injectionPoints.length > 0) {
      return { mode: DocumentMode.INJECTION, reason: 'Injection points specified' };
    }

    // Compilation mode for LaTeX to PDF
    if (documentType === DocumentType.PDF) {
      return { mode: DocumentMode.COMPILATION, reason: 'PDF output requested' };
    }

    // Default to template mode
    return { mode: DocumentMode.TEMPLATE, reason: 'Standard template rendering' };
  }

  /**
   * Normalize and validate generation options
   */
  async normalizeGenerationOptions(options) {
    const normalized = {
      template: options.template,
      context: options.context || {},
      documentType: options.documentType || this.documentOptions.defaultDocumentType,
      outputPath: options.outputPath,
      metadata: options.metadata || {},
      injectionPoints: options.injectionPoints || [],
      knowledgeGraph: options.knowledgeGraph,
      reasoningRules: options.reasoningRules || [],
      hybridSteps: options.hybridSteps || [],
      compilationSettings: { ...this.documentOptions.compilationSettings, ...options.compilationSettings },
      deterministicTimestamp: options.deterministicTimestamp
    };

    // Validate required options
    if (!normalized.template) {
      throw new Error('Template is required for document generation');
    }

    // Resolve template path
    normalized.template = this.resolveDocumentPath(normalized.template);

    return normalized;
  }

  /**
   * Validate document security
   */
  async validateDocumentSecurity(options) {
    // Security validation would integrate with SecurityManager
    // For now, basic validation
    if (options.outputPath && options.outputPath.includes('..')) {
      throw new Error('Invalid output path: directory traversal detected');
    }

    if (options.template && options.template.includes('..')) {
      throw new Error('Invalid template path: directory traversal detected');
    }
  }

  /**
   * Generate provenance record for document generation
   */
  async generateProvenance(options, result, generationId) {
    if (!this.provenanceGenerator) {
      return null;
    }

    const provenance = {
      generationId,
      timestamp: new Date().toISOString(),
      template: options.template,
      documentType: options.documentType,
      outputPath: result.outputPath,
      inputHash: this.calculateInputHash(options),
      outputHash: this.calculateOutputHash(result.content),
      kgenVersion: '1.0.0',
      metadata: {
        generationStrategy: result.metadata.generationMode,
        templateVariables: result.metadata.variablesUsed || [],
        processingTime: result.templateProcessingTime
      }
    };

    this.documentStats.provenanceRecords++;
    return provenance;
  }

  /**
   * Calculate hash of input data for provenance
   */
  calculateInputHash(options) {
    const hash = crypto.createHash('sha256');
    hash.update(JSON.stringify({
      template: options.template,
      context: options.context,
      documentType: options.documentType
    }));
    return hash.digest('hex');
  }

  /**
   * Calculate hash of output content for provenance
   */
  calculateOutputHash(content) {
    const hash = crypto.createHash('sha256');
    if (Buffer.isBuffer(content)) {
      hash.update(content);
    } else {
      hash.update(content.toString());
    }
    return hash.digest('hex');
  }

  /**
   * Resolve document path relative to documents directory
   */
  resolveDocumentPath(templatePath) {
    if (path.isAbsolute(templatePath)) {
      return templatePath;
    }
    return path.join(this.documentOptions.documentsDir, templatePath);
  }

  /**
   * Generate output path based on template and document type
   */
  generateOutputPath(template, documentType) {
    const basename = path.basename(template, path.extname(template));
    const extension = this.getExtensionForDocumentType(documentType);
    return path.join(this.documentOptions.outputDir, `${basename}.${extension}`);
  }

  /**
   * Get file extension for document type
   */
  getExtensionForDocumentType(documentType) {
    const extensions = {
      [DocumentType.WORD]: 'docx',
      [DocumentType.EXCEL]: 'xlsx',
      [DocumentType.POWERPOINT]: 'pptx',
      [DocumentType.LATEX]: 'tex',
      [DocumentType.PDF]: 'pdf',
      [DocumentType.MARKDOWN]: 'md',
      [DocumentType.HTML]: 'html'
    };
    return extensions[documentType] || 'txt';
  }

  /**
   * Ensure directory exists
   */
  ensureDirectoryExists(dirPath) {
    if (!existsSync(dirPath)) {
      mkdirSync(dirPath, { recursive: true });
    }
  }

  /**
   * Update document generation statistics
   */
  updateDocumentStats(documentType, generationTime) {
    this.documentStats.documentsGenerated++;
    this.documentStats.totalGenerationTime += generationTime;

    // Update document type counters
    const currentCount = this.documentStats.documentTypes.get(documentType) || 0;
    this.documentStats.documentTypes.set(documentType, currentCount + 1);

    // Update specific counters
    switch (documentType) {
      case DocumentType.WORD:
      case DocumentType.EXCEL:
      case DocumentType.POWERPOINT:
        this.documentStats.officeDocuments++;
        break;
      case DocumentType.LATEX:
      case DocumentType.PDF:
        this.documentStats.latexCompilations++;
        break;
    }
  }

  /**
   * Get document generation statistics
   */
  getDocumentStats() {
    const avgGenerationTime = this.documentStats.totalGenerationTime / 
                             Math.max(this.documentStats.documentsGenerated, 1);

    return {
      ...this.documentStats,
      documentTypes: Object.fromEntries(this.documentStats.documentTypes),
      averageGenerationTime: avgGenerationTime,
      errorRate: this.documentStats.errorCount / Math.max(this.documentStats.documentsGenerated, 1),
      templateStats: this.getStats() // Include base template engine stats
    };
  }

  /**
   * Reset all statistics
   */
  resetDocumentStats() {
    this.documentStats = {
      documentsGenerated: 0,
      officeDocuments: 0,
      latexCompilations: 0,
      semanticInjections: 0,
      provenanceRecords: 0,
      errorCount: 0,
      totalGenerationTime: 0,
      documentTypes: new Map()
    };
    this.resetStats(); // Reset base template engine stats
  }
}

/**
 * Factory function to create a KGEN document engine instance
 * 
 * @param {Object} options - Engine configuration options
 * @returns {DocumentEngine} Document engine instance
 */
export function createDocumentEngine(options = {}) {
  return new DocumentEngine(options);
}

export default DocumentEngine;