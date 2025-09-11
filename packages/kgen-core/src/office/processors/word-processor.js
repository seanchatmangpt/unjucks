/**
 * LaTeX-based document processor replacing Word document processing
 * 
 * This module provides comprehensive LaTeX document generation capabilities including:
 * - LaTeX template processing with Nunjucks
 * - Semantic document parsing and generation
 * - PDF compilation via LaTeX engines
 * - Template variable extraction and replacement
 * - Content injection and document structure management
 * 
 * @module office/processors/latex-word-processor
 * @version 2.0.0
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import {
  DocumentType,
  ErrorSeverity
} from '../core/types.js';
import { BaseOfficeProcessor } from '../core/base-processor.js';
import { LaTeXCompiler } from '../../latex/compiler.js';
import { LaTeXParser } from '../../latex/parser.js';
import { LaTeXTemplateRenderer } from '../../latex/renderers/nunjucks.js';
import { LaTeXSyntaxValidator } from '../../latex/validators/syntax.js';

/**
 * LaTeX-based document processor implementation
 * 
 * Extends the base processor to provide LaTeX document generation functionality
 * for creating professional documents, reports, and academic papers via LaTeX.
 */
export class LaTeXWordProcessor extends BaseOfficeProcessor {
  static SUPPORTED_EXTENSIONS = ['.tex', '.latex', '.ltx'];
  static FRONTMATTER_PROPERTY = 'unjucks:frontmatter';
  
  /**
   * Gets the document type supported by this processor
   * 
   * @returns {string} LaTeX document type
   */
  getSupportedType() {
    return DocumentType.LATEX;
  }

  /**
   * Gets supported file extensions
   * 
   * @returns {string[]} Array of supported extensions
   */
  getSupportedExtensions() {
    return [...LaTeXWordProcessor.SUPPORTED_EXTENSIONS];
  }

  /**
   * Initialize LaTeX components
   */
  async initialize() {
    if (this.initialized) return;

    this.compiler = new LaTeXCompiler({
      outputDir: this.options.outputDir || './dist/latex',
      tempDir: this.options.tempDir || './temp/latex',
      enableSyncTeX: true,
      security: {
        enabled: true,
        strictMode: this.options.strictMode || true
      }
    });

    this.renderer = new LaTeXTemplateRenderer({
      templatesDir: this.options.templatesDir || './templates/latex'
    });

    this.validator = new LaTeXSyntaxValidator({
      strictMode: this.options.strictMode || true
    });

    await this.compiler.initialize();
    await this.renderer.initialize();

    this.initialized = true;
  }

  /**
   * Loads a LaTeX template from file path
   * 
   * @param {string} templatePath - Path to the LaTeX template file
   * @returns {Promise<TemplateInfo>} Promise resolving to template info
   */
  async loadTemplate(templatePath) {
    this.logger.debug(`Loading LaTeX template: ${templatePath}`);
    
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      // Check if file exists and is readable
      await fs.access(templatePath, fs.constants.R_OK);
      
      // Get file stats
      const stats = await fs.stat(templatePath);
      
      // Validate file extension
      const extension = this.getFileExtension(templatePath);
      if (!this.getSupportedExtensions().includes(extension)) {
        throw new Error(`Unsupported file extension: ${extension}`);
      }
      
      // Read and parse LaTeX content
      const content = await fs.readFile(templatePath, 'utf8');
      const parseResult = this.parseLatexContent(content);
      
      const templateInfo = {
        path: templatePath,
        name: path.basename(templatePath, extension),
        type: DocumentType.LATEX,
        size: stats.size,
        lastModified: stats.mtime,
        content,
        parseResult
      };
      
      // Calculate file hash for caching
      templateInfo.hash = await this.calculateFileHash(templatePath);
      
      this.logger.info(`LaTeX template loaded successfully: ${templateInfo.name}`);
      return templateInfo;
      
    } catch (error) {
      this.logger.error(`Failed to load LaTeX template: ${templatePath}`, error);
      throw new Error(`Failed to load LaTeX template: ${error.message}`);
    }
  }

  /**
   * Parses frontmatter from LaTeX template comments
   * 
   * @param {TemplateInfo} template - Template info
   * @returns {Promise<TemplateFrontmatter|null>} Promise resolving to frontmatter or null
   */
  async parseFrontmatter(template) {
    this.logger.debug(`Parsing frontmatter from LaTeX template: ${template.name}`);
    
    try {
      const content = template.content || await fs.readFile(template.path, 'utf8');
      
      // Look for frontmatter in LaTeX comments at the beginning of file
      const frontmatterMatch = content.match(/^%\s*---\s*([\s\S]*?)%\s*---\s*/m);
      if (frontmatterMatch) {
        const frontmatterYaml = frontmatterMatch[1];
        // Parse YAML frontmatter (simplified - in production use yaml library)
        try {
          const frontmatter = this.parseYamlFrontmatter(frontmatterYaml);
          this.logger.debug(`Found frontmatter in LaTeX template: ${Object.keys(frontmatter).length} keys`);
          return frontmatter;
        } catch (yamlError) {
          this.logger.warn(`Failed to parse YAML frontmatter: ${yamlError.message}`);
        }
      }
      
      // Look for JSON frontmatter in comments
      const jsonMatch = content.match(/^%\s*({[\s\S]*?})\s*$/m);
      if (jsonMatch) {
        try {
          const frontmatter = JSON.parse(jsonMatch[1]);
          this.logger.debug(`Found JSON frontmatter in LaTeX template`);
          return frontmatter;
        } catch (jsonError) {
          this.logger.warn(`Failed to parse JSON frontmatter: ${jsonError.message}`);
        }
      }
      
      this.logger.debug('No frontmatter found in LaTeX template');
      return null;
      
    } catch (error) {
      this.logger.warn(`Failed to parse frontmatter from LaTeX template: ${error.message}`);
      return null;
    }
  }

  /**
   * Extracts variables from LaTeX template content
   * 
   * @param {TemplateInfo} template - Template info
   * @param {TemplateFrontmatter} [frontmatter] - Template frontmatter
   * @returns {Promise<VariableLocation[]>} Promise resolving to variable locations
   */
  async extractVariables(template, frontmatter) {
    this.logger.debug(`Extracting variables from LaTeX template: ${template.name}`);
    
    try {
      const content = template.content || await fs.readFile(template.path, 'utf8');
      const variables = this.extractNunjucksVariables(content);
      
      this.logger.info(`Extracted ${variables.length} variables from LaTeX template`);
      return variables;
      
    } catch (error) {
      this.logger.error(`Failed to extract variables from LaTeX template: ${error.message}`);
      throw error;
    }
  }

  /**
   * Extract Nunjucks variables from LaTeX content
   */
  extractNunjucksVariables(content) {
    const variables = [];
    const variablePattern = /{{\s*([^}\s]+(?:\.[^}\s]+)*)\s*}}/g;
    let match;
    
    while ((match = variablePattern.exec(content)) !== null) {
      const variableName = match[1].trim();
      variables.push({
        name: variableName,
        type: 'nunjucks',
        position: match.index,
        fullMatch: match[0],
        location: 'latex-content'
      });
    }
    
    return variables;
  }

  /**
   * Processes the LaTeX template with provided data
   * 
   * @param {TemplateInfo} template - Template info
   * @param {Object} data - Data for variable replacement
   * @param {TemplateFrontmatter} [frontmatter] - Template frontmatter
   * @returns {Promise<ProcessingResult>} Promise resolving to processing result
   */
  async processTemplate(template, data, frontmatter) {
    this.logger.debug(`Processing LaTeX template: ${template.name}`);
    
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      // Convert template path to relative path for Nunjucks renderer
      const templatesDir = this.options.templatesDir || './templates/latex';
      const relativePath = path.relative(templatesDir, template.path);
      
      // Render LaTeX template with Nunjucks
      const renderResult = await this.renderer.render(relativePath, data);
      
      // Validate generated LaTeX
      const validationResult = await this.validator.validate(renderResult.content);
      
      // Process injection points if defined
      let finalContent = renderResult.content;
      if (frontmatter?.injectionPoints) {
        finalContent = await this.processInjectionPoints(finalContent, data, frontmatter.injectionPoints);
      }
      
      // Parse the generated LaTeX for metadata extraction
      const parseResult = this.parseLatexContent(finalContent);
      
      const result = {
        success: true,
        content: finalContent,
        latexContent: finalContent,
        metadata: this.extractLatexMetadata(parseResult),
        stats: this.getStats(),
        validation: validationResult,
        parseResult
      };
      
      this.logger.info(`LaTeX template processed successfully: ${template.name}`);
      return result;
      
    } catch (error) {
      this.incrementErrorCount();
      this.logger.error(`Failed to process LaTeX template: ${error.message}`);
      
      return {
        success: false,
        stats: this.getStats(),
        validation: {
          valid: false,
          errors: [{
            message: error.message,
            code: 'PROCESSING_ERROR',
            severity: ErrorSeverity.ERROR
          }],
          warnings: []
        }
      };
    }
  }

  /**
   * Saves the processed LaTeX document to file and optionally compiles to PDF
   * 
   * @param {ProcessingResult} result - Processing result
   * @param {string} outputPath - Output file path
   * @param {Object} options - Save options
   * @returns {Promise<string>} Promise resolving to saved file path
   */
  async saveDocument(result, outputPath, options = {}) {
    this.logger.debug(`Saving LaTeX document to: ${outputPath}`);
    
    try {
      // Ensure output directory exists
      const outputDir = path.dirname(outputPath);
      await fs.mkdir(outputDir, { recursive: true });
      
      // Write LaTeX content to file
      if (typeof result.content === 'string' || result.latexContent) {
        const content = result.latexContent || result.content;
        await fs.writeFile(outputPath, content, 'utf8');
      } else {
        throw new Error('Invalid document content format for LaTeX document');
      }
      
      let pdfPath = null;
      
      // Compile to PDF if requested
      if (options.compileToPdf !== false && this.compiler) {
        try {
          const compilationResult = await this.compiler.compile(outputPath);
          if (compilationResult.success) {
            pdfPath = compilationResult.outputPath;
            this.logger.info(`LaTeX document compiled to PDF: ${pdfPath}`);
          }
        } catch (compileError) {
          this.logger.warn(`PDF compilation failed: ${compileError.message}`);
        }
      }
      
      this.logger.info(`LaTeX document saved successfully: ${outputPath}`);
      return {
        texPath: outputPath,
        pdfPath,
        success: true
      };
      
    } catch (error) {
      this.logger.error(`Failed to save LaTeX document: ${error.message}`);
      throw error;
    }
  }

  /**
   * Validates Word template structure
   * 
   * @param {TemplateInfo} template - Template info
   * @returns {Promise<ValidationResult>} Promise resolving to validation result
   */
  async validateTemplate(template) {
    this.logger.debug(`Validating Word template: ${template.name}`);
    
    const errors = [];
    const warnings = [];
    
    try {
      // Basic file validation
      await fs.access(template.path, fs.constants.R_OK);
      
      // Load and validate document structure
      const document = await this.loadWordDocument(template.path);
      
      // Check if document has content
      if (!document.paragraphs || document.paragraphs.length === 0) {
        warnings.push({
          message: 'Word template appears to be empty',
          code: 'EMPTY_TEMPLATE',
          severity: ErrorSeverity.WARNING
        });
      }
      
      // Validate document structure
      if (!this.isValidWordDocument(document)) {
        errors.push({
          message: 'Invalid Word document structure',
          code: 'INVALID_DOCUMENT_STRUCTURE',
          severity: ErrorSeverity.ERROR
        });
      }
      
      this.logger.info(`Word template validation completed: ${errors.length} errors, ${warnings.length} warnings`);
      
    } catch (error) {
      errors.push({
        message: `Template validation failed: ${error.message}`,
        code: 'VALIDATION_ERROR',
        severity: ErrorSeverity.ERROR
      });
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Parse LaTeX content using LaTeX parser
   * 
   * @param {string} content - LaTeX content to parse
   * @returns {Object} Parse result with AST and metadata
   */
  parseLatexContent(content) {
    try {
      const parser = new LaTeXParser(content, {
        semanticAnalysis: true,
        strictMode: false
      });
      
      return parser.parse();
      
    } catch (error) {
      this.logger.warn(`LaTeX parsing failed: ${error.message}`);
      return {
        type: 'document',
        ast: null,
        errors: [{ message: error.message, type: 'parse_error' }],
        warnings: [],
        metadata: {}
      };
    }
  }

  /**
   * Processes variables in Word document
   * 
   * @param {Object} document - Word document
   * @param {Object} data - Replacement data
   * @param {TemplateFrontmatter} [frontmatter] - Template frontmatter
   */
  async processVariablesInDocument(document, data, frontmatter) {
    // This method is no longer needed as Nunjucks handles variable processing
    // Keeping for compatibility but implementation moved to processTemplate
    this.logger.debug('Variable processing delegated to Nunjucks renderer');
  }

  // Injection points processing moved to main processTemplate method

  // Content injection moved to processInjectionPoints method above

  /**
   * Extract metadata from parsed LaTeX document
   * 
   * @param {Object} parseResult - LaTeX parse result
   * @returns {Object} Document metadata
   */
  extractLatexMetadata(parseResult) {
    return {
      title: parseResult.metadata?.title || 'Untitled Document',
      author: parseResult.metadata?.author || 'Unknown Author',
      date: parseResult.metadata?.date || new Date().toISOString(),
      documentClass: parseResult.metadata?.documentClass || 'article',
      packages: parseResult.documentStructure?.preamble?.filter(node => 
        node.type === 'command' && node.value === 'usepackage'
      )?.length || 0,
      sections: parseResult.documentStructure?.metadata?.sectionCount || 0,
      citations: parseResult.documentStructure?.metadata?.citationCount || 0,
      mathElements: parseResult.documentStructure?.metadata?.mathElementCount || 0,
      processingTime: parseResult.statistics?.processingTime || 0,
      errors: parseResult.errors?.length || 0,
      warnings: parseResult.warnings?.length || 0
    };
  }

  // Metadata extraction moved to extractLatexMetadata method above

  /**
   * Validates LaTeX document structure
   * 
   * @param {Object} parseResult - LaTeX parse result to validate
   * @returns {boolean} Whether document structure is valid
   */
  isValidLatexDocument(parseResult) {
    return (
      parseResult &&
      parseResult.type === 'document' &&
      parseResult.ast &&
      Array.isArray(parseResult.errors) &&
      Array.isArray(parseResult.warnings)
    );
  }

  // Frontmatter parsing moved to parseYamlFrontmatter method above

  /**
   * Process injection points in LaTeX content
   * 
   * @param {string} content - LaTeX content
   * @param {Object} data - Injection data
   * @param {Array} injectionPoints - Injection point definitions
   * @returns {string} Processed content
   */
  async processInjectionPoints(content, data, injectionPoints) {
    let processedContent = content;
    
    for (const injectionPoint of injectionPoints) {
      const injectionData = data[injectionPoint.id] || injectionPoint.defaultContent || '';
      
      if (injectionData && injectionPoint.marker) {
        const position = injectionPoint.processing?.position || 'replace';
        
        switch (position) {
          case 'replace':
            processedContent = processedContent.replace(injectionPoint.marker, injectionData);
            break;
          case 'before':
            processedContent = processedContent.replace(injectionPoint.marker, injectionData + injectionPoint.marker);
            break;
          case 'after':
            processedContent = processedContent.replace(injectionPoint.marker, injectionPoint.marker + injectionData);
            break;
        }
        
        this.incrementInjectionCount();
      }
    }
    
    return processedContent;
  }

  /**
   * Parse simplified YAML frontmatter
   * 
   * @param {string} yamlContent - YAML content
   * @returns {Object} Parsed YAML object
   */
  parseYamlFrontmatter(yamlContent) {
    // Simplified YAML parser - in production use proper YAML library
    const result = {};
    const lines = yamlContent.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('%')) {
        const colonIndex = trimmed.indexOf(':');
        if (colonIndex > 0) {
          const key = trimmed.substring(0, colonIndex).trim();
          let value = trimmed.substring(colonIndex + 1).trim();
          
          // Handle quoted strings
          if ((value.startsWith('"') && value.endsWith('"')) ||
              (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }
          
          // Handle boolean and number values
          if (value === 'true') value = true;
          else if (value === 'false') value = false;
          else if (/^\d+$/.test(value)) value = parseInt(value);
          else if (/^\d+\.\d+$/.test(value)) value = parseFloat(value);
          
          result[key] = value;
        }
      }
    }
    
    return result;
  }

  /**
   * Calculates hash of file for caching
   * 
   * @param {string} filePath - File path
   * @returns {Promise<string>} Promise resolving to file hash
   */
  async calculateFileHash(filePath) {
    // In a real implementation, you would calculate MD5 or SHA hash
    // This is a placeholder
    const stats = await fs.stat(filePath);
    return `${stats.size}-${stats.mtime.getTime()}`;
  }
}

// Export both old and new names for compatibility
export const WordProcessor = LaTeXWordProcessor;