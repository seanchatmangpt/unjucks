/**
 * KGEN Document-Specific Frontmatter Processor
 * 
 * Extends the base frontmatter parser with document-specific frontmatter
 * capabilities including Office document injection points, LaTeX compilation
 * settings, and semantic data binding.
 * 
 * @module documents/frontmatter-processor
 * @version 1.0.0
 */

import { FrontmatterParser } from '../templating/frontmatter-parser.js';
import { DocumentType, DocumentMode } from './document-engine.js';

/**
 * Document-specific frontmatter fields
 */
export const DocumentFrontmatterFields = {
  // Document metadata
  DOCUMENT_TYPE: 'documentType',
  DOCUMENT_MODE: 'documentMode',
  OUTPUT_FORMAT: 'outputFormat',
  
  // Office document specific
  INJECTION_POINTS: 'injectionPoints',
  OFFICE_TEMPLATE: 'officeTemplate',
  PRESERVE_FORMATTING: 'preserveFormatting',
  VARIABLE_SYNTAX: 'variableSyntax',
  
  // LaTeX specific
  LATEX_TEMPLATE: 'latexTemplate',
  LATEX_COMPILER: 'latexCompiler',
  LATEX_PACKAGES: 'latexPackages',
  BIBLIOGRAPHY: 'bibliography',
  
  // PDF specific
  PDF_OPTIONS: 'pdfOptions',
  COMPILE_TO_PDF: 'compileToPdf',
  
  // Semantic integration
  KNOWLEDGE_GRAPH: 'knowledgeGraph',
  REASONING_RULES: 'reasoningRules',
  SEMANTIC_BINDINGS: 'semanticBindings',
  
  // Hybrid processing
  HYBRID_STEPS: 'hybridSteps',
  PIPELINE_MODE: 'pipelineMode',
  
  // Security and compliance
  SECURITY_LEVEL: 'securityLevel',
  COMPLIANCE_TAGS: 'complianceTags',
  ATTESTATION_REQUIRED: 'attestationRequired'
};

/**
 * Document Frontmatter Processor
 * 
 * Processes document-specific frontmatter with validation and normalization
 * for deterministic document generation workflows.
 */
export class DocumentFrontmatterProcessor extends FrontmatterParser {
  constructor(options = {}) {
    super(options);
    
    this.documentOptions = {
      defaultDocumentType: options.defaultDocumentType || DocumentType.WORD,
      defaultDocumentMode: options.defaultDocumentMode || DocumentMode.TEMPLATE,
      validateInjectionPoints: options.validateInjectionPoints !== false,
      enableSemanticValidation: options.enableSemanticValidation !== false,
      strictValidation: options.strictValidation || false,
      ...options
    };

    // Register document-specific validators
    this.registerDocumentValidators();
  }

  /**
   * Parse document frontmatter with document-specific validation
   * 
   * @param {string} content - Template content with frontmatter
   * @param {boolean} enableSemanticValidation - Enable semantic validation
   * @returns {Promise<Object>} Parsed frontmatter with document metadata
   */
  async parseDocumentFrontmatter(content, enableSemanticValidation = true) {
    // Parse base frontmatter
    const result = await this.parse(content, enableSemanticValidation);
    
    // Process document-specific fields
    const documentMetadata = this.processDocumentFields(result.frontmatter);
    
    // Validate document configuration
    const validation = await this.validateDocumentConfiguration(documentMetadata);
    
    return {
      ...result,
      documentMetadata,
      validation,
      isDocumentTemplate: this.isDocumentTemplate(documentMetadata)
    };
  }

  /**
   * Process document-specific frontmatter fields
   * 
   * @param {Object} frontmatter - Raw frontmatter data
   * @returns {Object} Processed document metadata
   */
  processDocumentFields(frontmatter) {
    const documentMetadata = {
      // Core document settings
      documentType: this.processDocumentType(frontmatter),
      documentMode: this.processDocumentMode(frontmatter),
      outputFormat: frontmatter[DocumentFrontmatterFields.OUTPUT_FORMAT],
      
      // Office document settings
      officeSettings: this.processOfficeSettings(frontmatter),
      
      // LaTeX settings
      latexSettings: this.processLatexSettings(frontmatter),
      
      // PDF settings
      pdfSettings: this.processPdfSettings(frontmatter),
      
      // Semantic integration
      semanticSettings: this.processSemanticSettings(frontmatter),
      
      // Hybrid processing
      hybridSettings: this.processHybridSettings(frontmatter),
      
      // Security and compliance
      securitySettings: this.processSecuritySettings(frontmatter)
    };

    return documentMetadata;
  }

  /**
   * Process document type with validation and defaults
   */
  processDocumentType(frontmatter) {
    const docType = frontmatter[DocumentFrontmatterFields.DOCUMENT_TYPE];
    
    if (!docType) {
      return this.documentOptions.defaultDocumentType;
    }

    // Validate document type
    const validTypes = Object.values(DocumentType);
    if (!validTypes.includes(docType)) {
      throw new Error(`Invalid document type: ${docType}. Valid types: ${validTypes.join(', ')}`);
    }

    return docType;
  }

  /**
   * Process document generation mode
   */
  processDocumentMode(frontmatter) {
    const docMode = frontmatter[DocumentFrontmatterFields.DOCUMENT_MODE];
    
    if (!docMode) {
      return this.documentOptions.defaultDocumentMode;
    }

    // Validate document mode
    const validModes = Object.values(DocumentMode);
    if (!validModes.includes(docMode)) {
      throw new Error(`Invalid document mode: ${docMode}. Valid modes: ${validModes.join(', ')}`);
    }

    return docMode;
  }

  /**
   * Process Office document settings
   */
  processOfficeSettings(frontmatter) {
    const settings = {
      template: frontmatter[DocumentFrontmatterFields.OFFICE_TEMPLATE],
      preserveFormatting: frontmatter[DocumentFrontmatterFields.PRESERVE_FORMATTING] !== false,
      variableSyntax: frontmatter[DocumentFrontmatterFields.VARIABLE_SYNTAX] || 'nunjucks',
      injectionPoints: this.processInjectionPoints(frontmatter)
    };

    return settings;
  }

  /**
   * Process injection points for Office documents
   */
  processInjectionPoints(frontmatter) {
    const injectionPoints = frontmatter[DocumentFrontmatterFields.INJECTION_POINTS];
    
    if (!injectionPoints || !Array.isArray(injectionPoints)) {
      return [];
    }

    return injectionPoints.map((point, index) => {
      // Validate injection point structure
      if (!point.id) {
        throw new Error(`Injection point ${index} missing required 'id' field`);
      }
      
      if (!point.target) {
        throw new Error(`Injection point ${point.id} missing required 'target' field`);
      }

      return {
        id: point.id,
        target: point.target,
        content: point.content || '',
        type: point.type || 'text',
        required: point.required !== false,
        formatting: point.formatting || {},
        conditions: point.conditions || {},
        metadata: point.metadata || {}
      };
    });
  }

  /**
   * Process LaTeX compilation settings
   */
  processLatexSettings(frontmatter) {
    const settings = {
      template: frontmatter[DocumentFrontmatterFields.LATEX_TEMPLATE] || 'professional-classic',
      compiler: frontmatter[DocumentFrontmatterFields.LATEX_COMPILER] || 'pdflatex',
      packages: frontmatter[DocumentFrontmatterFields.LATEX_PACKAGES] || [],
      bibliography: frontmatter[DocumentFrontmatterFields.BIBLIOGRAPHY],
      compileToPdf: frontmatter[DocumentFrontmatterFields.COMPILE_TO_PDF] !== false
    };

    // Validate LaTeX compiler
    const validCompilers = ['pdflatex', 'xelatex', 'lualatex'];
    if (!validCompilers.includes(settings.compiler)) {
      throw new Error(`Invalid LaTeX compiler: ${settings.compiler}. Valid compilers: ${validCompilers.join(', ')}`);
    }

    return settings;
  }

  /**
   * Process PDF generation settings
   */
  processPdfSettings(frontmatter) {
    const pdfOptions = frontmatter[DocumentFrontmatterFields.PDF_OPTIONS] || {};
    
    return {
      quality: pdfOptions.quality || 'high',
      compression: pdfOptions.compression !== false,
      metadata: pdfOptions.metadata || {},
      security: pdfOptions.security || {},
      optimization: pdfOptions.optimization || 'balanced'
    };
  }

  /**
   * Process semantic integration settings
   */
  processSemanticSettings(frontmatter) {
    const settings = {
      knowledgeGraph: frontmatter[DocumentFrontmatterFields.KNOWLEDGE_GRAPH],
      reasoningRules: frontmatter[DocumentFrontmatterFields.REASONING_RULES] || [],
      semanticBindings: frontmatter[DocumentFrontmatterFields.SEMANTIC_BINDINGS] || {},
      enableInference: true
    };

    // Validate semantic bindings
    if (settings.semanticBindings && typeof settings.semanticBindings !== 'object') {
      throw new Error('Semantic bindings must be an object mapping template variables to RDF properties');
    }

    return settings;
  }

  /**
   * Process hybrid processing settings
   */
  processHybridSettings(frontmatter) {
    const hybridSteps = frontmatter[DocumentFrontmatterFields.HYBRID_STEPS];
    
    if (!hybridSteps || !Array.isArray(hybridSteps)) {
      return { enabled: false, steps: [] };
    }

    const processedSteps = hybridSteps.map((step, index) => {
      if (!step.mode) {
        throw new Error(`Hybrid step ${index} missing required 'mode' field`);
      }

      const validModes = Object.values(DocumentMode);
      if (!validModes.includes(step.mode)) {
        throw new Error(`Invalid mode in hybrid step ${index}: ${step.mode}`);
      }

      return {
        mode: step.mode,
        template: step.template,
        options: step.options || {},
        conditions: step.conditions || {},
        outputPath: step.outputPath
      };
    });

    return {
      enabled: true,
      steps: processedSteps,
      pipelineMode: frontmatter[DocumentFrontmatterFields.PIPELINE_MODE] || 'sequential'
    };
  }

  /**
   * Process security and compliance settings
   */
  processSecuritySettings(frontmatter) {
    return {
      securityLevel: frontmatter[DocumentFrontmatterFields.SECURITY_LEVEL] || 'standard',
      complianceTags: frontmatter[DocumentFrontmatterFields.COMPLIANCE_TAGS] || [],
      attestationRequired: frontmatter[DocumentFrontmatterFields.ATTESTATION_REQUIRED] !== false,
      encryptionRequired: frontmatter.encryptionRequired || false,
      accessControl: frontmatter.accessControl || {}
    };
  }

  /**
   * Validate complete document configuration
   */
  async validateDocumentConfiguration(documentMetadata) {
    const errors = [];
    const warnings = [];

    // Validate document type compatibility
    this.validateDocumentTypeCompatibility(documentMetadata, errors);
    
    // Validate Office settings
    if (this.isOfficeDocument(documentMetadata.documentType)) {
      this.validateOfficeSettings(documentMetadata.officeSettings, errors, warnings);
    }

    // Validate LaTeX settings
    if (documentMetadata.documentType === DocumentType.LATEX || 
        documentMetadata.documentType === DocumentType.PDF) {
      this.validateLatexSettings(documentMetadata.latexSettings, errors, warnings);
    }

    // Validate semantic settings
    if (this.documentOptions.enableSemanticValidation && documentMetadata.semanticSettings.knowledgeGraph) {
      this.validateSemanticSettings(documentMetadata.semanticSettings, errors, warnings);
    }

    // Validate hybrid settings
    if (documentMetadata.hybridSettings.enabled) {
      this.validateHybridSettings(documentMetadata.hybridSettings, errors, warnings);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      strictValidation: this.documentOptions.strictValidation
    };
  }

  /**
   * Validate document type compatibility with mode and settings
   */
  validateDocumentTypeCompatibility(documentMetadata, errors) {
    const { documentType, documentMode } = documentMetadata;

    // Check mode compatibility
    const incompatibleCombinations = [
      { type: DocumentType.MARKDOWN, mode: DocumentMode.INJECTION },
      { type: DocumentType.HTML, mode: DocumentMode.INJECTION },
      { type: DocumentType.PDF, mode: DocumentMode.INJECTION }
    ];

    for (const combo of incompatibleCombinations) {
      if (documentType === combo.type && documentMode === combo.mode) {
        errors.push(`Document type ${documentType} is not compatible with mode ${documentMode}`);
      }
    }
  }

  /**
   * Validate Office document settings
   */
  validateOfficeSettings(officeSettings, errors, warnings) {
    // Validate injection points
    if (this.documentOptions.validateInjectionPoints) {
      for (const point of officeSettings.injectionPoints) {
        if (!point.target.match(/^(bookmark|table|paragraph|cell):/)) {
          warnings.push(`Injection point ${point.id} target format may not be valid: ${point.target}`);
        }
      }
    }

    // Validate variable syntax
    const validSyntaxes = ['nunjucks', 'mustache', 'handlebars', 'simple'];
    if (!validSyntaxes.includes(officeSettings.variableSyntax)) {
      errors.push(`Invalid variable syntax: ${officeSettings.variableSyntax}`);
    }
  }

  /**
   * Validate LaTeX settings
   */
  validateLatexSettings(latexSettings, errors, warnings) {
    // Validate packages
    if (latexSettings.packages && !Array.isArray(latexSettings.packages)) {
      errors.push('LaTeX packages must be an array');
    }

    // Check for common package conflicts
    if (latexSettings.packages) {
      const conflictingPackages = [
        ['inputenc', 'fontenc'], // Common with XeLaTeX/LuaLaTeX
        ['babel', 'polyglossia']  // Language package conflicts
      ];

      for (const [pkg1, pkg2] of conflictingPackages) {
        if (latexSettings.packages.includes(pkg1) && latexSettings.packages.includes(pkg2)) {
          warnings.push(`Potentially conflicting LaTeX packages: ${pkg1} and ${pkg2}`);
        }
      }
    }
  }

  /**
   * Validate semantic settings
   */
  validateSemanticSettings(semanticSettings, errors, warnings) {
    // Validate knowledge graph format
    if (semanticSettings.knowledgeGraph && 
        typeof semanticSettings.knowledgeGraph === 'string' &&
        !semanticSettings.knowledgeGraph.match(/\.(ttl|n3|rdf|jsonld)$/i)) {
      warnings.push('Knowledge graph file extension not recognized');
    }

    // Validate reasoning rules
    if (semanticSettings.reasoningRules.length > 0) {
      for (const [index, rule] of semanticSettings.reasoningRules.entries()) {
        if (typeof rule === 'string' && !rule.match(/\.(n3|pl)$/i)) {
          warnings.push(`Reasoning rule ${index} file extension not recognized`);
        }
      }
    }
  }

  /**
   * Validate hybrid processing settings
   */
  validateHybridSettings(hybridSettings, errors, warnings) {
    const { steps } = hybridSettings;

    // Check for logical step ordering
    for (let i = 1; i < steps.length; i++) {
      const prevStep = steps[i - 1];
      const currentStep = steps[i];

      // PDF compilation should typically be last
      if (prevStep.mode === DocumentMode.COMPILATION && 
          currentStep.mode !== DocumentMode.COMPILATION) {
        warnings.push(`PDF compilation step ${i - 1} followed by non-compilation step may cause issues`);
      }
    }

    // Validate pipeline mode
    const validPipelineModes = ['sequential', 'parallel', 'conditional'];
    if (!validPipelineModes.includes(hybridSettings.pipelineMode)) {
      errors.push(`Invalid pipeline mode: ${hybridSettings.pipelineMode}`);
    }
  }

  /**
   * Register document-specific validators
   */
  registerDocumentValidators() {
    // Add custom validator for document templates
    this.addCustomValidator({
      name: 'documentTemplate',
      validate: (frontmatter) => {
        const documentType = frontmatter[DocumentFrontmatterFields.DOCUMENT_TYPE];
        if (!documentType) return { valid: true };

        const requiredFields = this.getRequiredFieldsForDocumentType(documentType);
        const missing = requiredFields.filter(field => !frontmatter[field]);

        return {
          valid: missing.length === 0,
          errors: missing.map(field => `Required field missing for ${documentType}: ${field}`)
        };
      }
    });
  }

  /**
   * Get required fields for specific document type
   */
  getRequiredFieldsForDocumentType(documentType) {
    const requiredFields = {
      [DocumentType.WORD]: ['to'],
      [DocumentType.EXCEL]: ['to'],
      [DocumentType.POWERPOINT]: ['to'],
      [DocumentType.LATEX]: ['to'],
      [DocumentType.PDF]: ['to'],
      [DocumentType.MARKDOWN]: ['to'],
      [DocumentType.HTML]: ['to']
    };

    return requiredFields[documentType] || [];
  }

  /**
   * Check if frontmatter represents a document template
   */
  isDocumentTemplate(documentMetadata) {
    return documentMetadata.documentType && 
           Object.values(DocumentType).includes(documentMetadata.documentType);
  }

  /**
   * Check if document type is an Office document
   */
  isOfficeDocument(documentType) {
    return [DocumentType.WORD, DocumentType.EXCEL, DocumentType.POWERPOINT].includes(documentType);
  }

  /**
   * Extract document generation requirements from frontmatter
   */
  extractGenerationRequirements(documentMetadata) {
    const requirements = {
      processors: [],
      dependencies: [],
      outputFormats: [],
      securityLevel: documentMetadata.securitySettings.securityLevel
    };

    // Determine required processors
    if (this.isOfficeDocument(documentMetadata.documentType)) {
      requirements.processors.push('office');
    }

    if (documentMetadata.documentType === DocumentType.LATEX || 
        documentMetadata.latexSettings.compileToPdf) {
      requirements.processors.push('latex');
    }

    if (documentMetadata.documentType === DocumentType.PDF) {
      requirements.processors.push('pdf');
    }

    if (documentMetadata.semanticSettings.knowledgeGraph) {
      requirements.processors.push('semantic');
    }

    if (documentMetadata.hybridSettings.enabled) {
      requirements.processors.push('hybrid');
    }

    // Determine dependencies
    if (documentMetadata.latexSettings.packages?.length > 0) {
      requirements.dependencies.push(...documentMetadata.latexSettings.packages);
    }

    if (documentMetadata.semanticSettings.knowledgeGraph) {
      requirements.dependencies.push(documentMetadata.semanticSettings.knowledgeGraph);
    }

    // Output formats
    requirements.outputFormats.push(documentMetadata.documentType);
    if (documentMetadata.outputFormat) {
      requirements.outputFormats.push(documentMetadata.outputFormat);
    }

    return requirements;
  }

  /**
   * Generate document processing pipeline from frontmatter
   */
  generateProcessingPipeline(documentMetadata) {
    const pipeline = {
      steps: [],
      mode: documentMetadata.hybridSettings.pipelineMode || 'sequential',
      requirements: this.extractGenerationRequirements(documentMetadata)
    };

    if (documentMetadata.hybridSettings.enabled) {
      // Use explicit hybrid steps
      pipeline.steps = documentMetadata.hybridSettings.steps;
    } else {
      // Generate pipeline from document configuration
      const step = {
        mode: documentMetadata.documentMode,
        documentType: documentMetadata.documentType,
        options: {
          officeSettings: documentMetadata.officeSettings,
          latexSettings: documentMetadata.latexSettings,
          pdfSettings: documentMetadata.pdfSettings,
          semanticSettings: documentMetadata.semanticSettings,
          securitySettings: documentMetadata.securitySettings
        }
      };
      pipeline.steps.push(step);
    }

    return pipeline;
  }
}

/**
 * Factory function to create a document frontmatter processor
 */
export function createDocumentFrontmatterProcessor(options = {}) {
  return new DocumentFrontmatterProcessor(options);
}

export default DocumentFrontmatterProcessor;