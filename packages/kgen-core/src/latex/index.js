/**
 * KGEN LaTeX Integration - Main Entry Point
 * Complete LaTeX document generation system for KGEN
 * 
 * This module provides a comprehensive LaTeX document generation system with:
 * - Intelligent template selection and rendering
 * - Advanced LaTeX parsing and semantic analysis
 * - Secure compilation with Docker support
 * - Comprehensive syntax validation
 * - Academic paper workflow automation
 * - Enterprise-grade error handling and logging
 */

// Core LaTeX components
export { LaTeXTemplateSelector, LATEX_TEMPLATES } from './selector.js';
export { LaTeXParser, LaTeXTokenizer, LaTeXToken, LaTeXNode, LaTeXAnalyzer, LaTeXConstructs } from './parser.js';
export { LaTeXCompiler, LATEX_ENGINES } from './compiler.js';

// Validation system
export { LaTeXSyntaxValidator } from './validators/syntax.js';

// Template rendering
export { LaTeXTemplateRenderer } from './renderers/nunjucks.js';

// Workflows
export { AcademicPaperWorkflow } from './workflows/academic.js';

/**
 * KGEN LaTeX Integration Manager
 * High-level interface for LaTeX document generation
 */
export class KGENLaTeXIntegration {
  constructor(options = {}) {
    this.options = {
      templatesDir: options.templatesDir || './templates/latex',
      outputDir: options.outputDir || './dist/latex',
      validateOutput: options.validateOutput !== false,
      autoCompile: options.autoCompile || false,
      securityMode: options.securityMode || 'strict',
      ...options
    };
    
    this.initialized = false;
    this.components = {};
  }
  
  /**
   * Initialize all LaTeX components
   */
  async initialize() {
    if (this.initialized) return;
    
    // Initialize core components
    const { LaTeXTemplateSelector } = await import('./selector.js');
    this.components.selector = new LaTeXTemplateSelector({
      templatesDir: this.options.templatesDir
    });
    
    const { LaTeXTemplateRenderer } = await import('./renderers/nunjucks.js');
    this.components.renderer = new LaTeXTemplateRenderer({
      templatesDir: this.options.templatesDir,
      validateOutput: this.options.validateOutput
    });
    
    const { LaTeXCompiler } = await import('./compiler.js');
    this.components.compiler = new LaTeXCompiler({
      outputDir: this.options.outputDir,
      security: {
        enabled: this.options.securityMode !== 'disabled',
        strictMode: this.options.securityMode === 'strict'
      }
    });
    
    const { LaTeXSyntaxValidator } = await import('./validators/syntax.js');
    this.components.validator = new LaTeXSyntaxValidator({
      strictMode: this.options.securityMode === 'strict'
    });
    
    const { AcademicPaperWorkflow } = await import('./workflows/academic.js');
    this.components.workflow = new AcademicPaperWorkflow({
      outputDir: this.options.outputDir,
      templatesDir: this.options.templatesDir,
      autoCompile: this.options.autoCompile
    });
    
    // Initialize async components
    await this.components.renderer.initialize();
    await this.components.compiler.initialize();
    await this.components.workflow.initialize();
    
    this.initialized = true;
  }
  
  /**
   * Generate LaTeX document from high-level specification
   */
  async generateDocument(specification, options = {}) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    const { type, data, template, compile = this.options.autoCompile } = specification;
    const mergedOptions = { ...this.options, ...options };
    
    try {
      // Select appropriate template if not specified
      let templateSelection;
      if (template) {
        templateSelection = { templateId: template, template: this.components.selector.getTemplateInfo(template) };
      } else {
        templateSelection = this.components.selector.selectTemplate({ type, data });
      }
      
      // Render document
      const renderResult = await this.components.renderer.render(
        templateSelection.template.file,
        data,
        mergedOptions
      );
      
      // Validate if enabled
      let validationResult = null;
      if (mergedOptions.validateOutput) {
        validationResult = await this.components.validator.validate(renderResult.content);
        
        if (!validationResult.valid && mergedOptions.strictValidation) {
          throw new Error(`Document validation failed: ${validationResult.summary.errors} errors`);
        }
      }
      
      // Save document
      const outputPath = options.outputPath || this.generateOutputPath(data.title || 'document');
      await this.components.renderer.renderToFile(
        templateSelection.template.file,
        outputPath,
        data,
        mergedOptions
      );
      
      // Compile if requested
      let compilationResult = null;
      if (compile) {
        compilationResult = await this.components.compiler.compile(outputPath);
      }
      
      return {
        success: true,
        document: {
          path: outputPath,
          content: renderResult.content
        },
        template: templateSelection,
        validation: validationResult,
        compilation: compilationResult,
        metadata: {
          generatedAt: this.getDeterministicDate().toISOString(),
          kgenVersion: process.env.KGEN_VERSION || '1.0.0'
        }
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        specification
      };
    }
  }
  
  /**
   * Generate academic paper using workflow
   */
  async generateAcademicPaper(paperConfig, options = {}) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    return this.components.workflow.generatePaper(paperConfig, options);
  }
  
  /**
   * Parse and analyze LaTeX document
   */
  parseDocument(latexContent, options = {}) {
    const parser = new LaTeXParser(latexContent, {
      semanticAnalysis: true,
      ...options
    });
    
    return parser.parse();
  }
  
  /**
   * Validate LaTeX document
   */
  async validateDocument(latexContent, options = {}) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    return this.components.validator.validate(latexContent, options);
  }
  
  /**
   * Compile LaTeX document to PDF
   */
  async compileDocument(inputPath, options = {}) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    return this.components.compiler.compile(inputPath, options);
  }
  
  /**
   * List available templates
   */
  listTemplates(category = null) {
    return this.components.selector?.listTemplates(category) || [];
  }
  
  /**
   * Get document types for academic workflow
   */
  getAcademicDocumentTypes() {
    return this.components.workflow?.getDocumentTypes() || [];
  }
  
  /**
   * Generate output path for document
   */
  generateOutputPath(title) {
    const sanitizedTitle = title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 50);
    
    const timestamp = this.getDeterministicDate().toISOString().split('T')[0];
    return `${this.options.outputDir}/${sanitizedTitle}-${timestamp}.tex`;
  }
  
  /**
   * Get system statistics
   */
  getStatistics() {
    return {
      initialized: this.initialized,
      components: Object.keys(this.components).length,
      options: this.options,
      templates: this.components.selector?.listTemplates()?.length || 0,
      documentTypes: this.components.workflow?.getDocumentTypes()?.length || 0
    };
  }
  
  /**
   * Cleanup resources
   */
  async cleanup() {
    if (this.components.compiler?.watchMode) {
      await this.components.compiler.stopWatchMode();
    }
    
    // Clear template caches
    if (this.components.renderer) {
      this.components.renderer.clearCache();
    }
  }
}

/**
 * Convenience factory function
 */
export function createKGENLaTeX(options = {}) {
  return new KGENLaTeXIntegration(options);
}

/**
 * Default export for easy importing
 */
export default KGENLaTeXIntegration;

/**
 * Version information
 */
export const VERSION = '1.0.0';

/**
 * Feature capabilities
 */
export const FEATURES = {
  templateSelection: true,
  nunjucksRendering: true,
  syntaxValidation: true,
  pdfCompilation: true,
  dockerSupport: true,
  academicWorkflow: true,
  semanticAnalysis: true,
  securityValidation: true,
  watchMode: true,
  batchProcessing: true
};

/**
 * Supported LaTeX engines
 */
export const SUPPORTED_ENGINES = ['pdflatex', 'xelatex', 'lualatex', 'latex'];

/**
 * Supported template categories
 */
export const TEMPLATE_CATEGORIES = ['academic', 'professional', 'resume', 'presentation'];

/**
 * Quick start helper
 */
export async function quickStart(specification) {
  const kgenLatex = new KGENLaTeXIntegration();
  await kgenLatex.initialize();
  return kgenLatex.generateDocument(specification);
}
