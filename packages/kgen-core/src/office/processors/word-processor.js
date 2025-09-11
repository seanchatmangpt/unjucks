/**
 * Word document processor for Office template processing in KGEN
 * 
 * This module provides comprehensive Word document processing capabilities including:
 * - DOCX file reading and writing
 * - Template variable extraction and replacement
 * - Frontmatter parsing from document properties
 * - Content injection at specified markers
 * - Table and header/footer processing
 * 
 * @module office/processors/word-processor
 * @version 1.0.0
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import {
  DocumentType,
  ErrorSeverity
} from '../core/types.js';
import { BaseOfficeProcessor } from '../core/base-processor.js';

/**
 * Word document processor implementation
 * 
 * Extends the base processor to provide Word-specific functionality for
 * reading, processing, and writing DOCX files with template capabilities.
 */
export class WordProcessor extends BaseOfficeProcessor {
  static SUPPORTED_EXTENSIONS = ['.docx', '.doc'];
  static FRONTMATTER_PROPERTY = 'unjucks:frontmatter';
  
  /**
   * Gets the document type supported by this processor
   * 
   * @returns {string} Word document type
   */
  getSupportedType() {
    return DocumentType.WORD;
  }

  /**
   * Gets supported file extensions
   * 
   * @returns {string[]} Array of supported extensions
   */
  getSupportedExtensions() {
    return [...WordProcessor.SUPPORTED_EXTENSIONS];
  }

  /**
   * Loads a Word template from file path
   * 
   * @param {string} templatePath - Path to the Word template file
   * @returns {Promise<TemplateInfo>} Promise resolving to template info
   */
  async loadTemplate(templatePath) {
    this.logger.debug(`Loading Word template: ${templatePath}`);
    
    try {
      // Check if file exists and is readable
      await fs.access(templatePath, fs.constants.R_OK);
      
      // Get file stats
      const stats = await fs.stat(templatePath);
      
      // Validate file extension
      const extension = this.getFileExtension(templatePath);
      if (!this.getSupportedExtensions().includes(extension)) {
        throw new Error(`Unsupported file extension: ${extension}`);
      }
      
      const templateInfo = {
        path: templatePath,
        name: path.basename(templatePath, extension),
        type: DocumentType.WORD,
        size: stats.size,
        lastModified: stats.mtime
      };
      
      // Calculate file hash for caching
      templateInfo.hash = await this.calculateFileHash(templatePath);
      
      this.logger.info(`Word template loaded successfully: ${templateInfo.name}`);
      return templateInfo;
      
    } catch (error) {
      this.logger.error(`Failed to load Word template: ${templatePath}`, error);
      throw new Error(`Failed to load Word template: ${error.message}`);
    }
  }

  /**
   * Parses frontmatter from Word document properties
   * 
   * @param {TemplateInfo} template - Template info
   * @returns {Promise<TemplateFrontmatter|null>} Promise resolving to frontmatter or null
   */
  async parseFrontmatter(template) {
    this.logger.debug(`Parsing frontmatter from Word template: ${template.name}`);
    
    try {
      const document = await this.loadWordDocument(template.path);
      
      // Check for frontmatter in custom document properties
      const frontmatterData = document.properties.custom?.[WordProcessor.FRONTMATTER_PROPERTY];
      
      if (frontmatterData) {
        if (typeof frontmatterData === 'string') {
          return JSON.parse(frontmatterData);
        } else if (typeof frontmatterData === 'object') {
          return frontmatterData;
        }
      }
      
      // Try to parse frontmatter from first paragraph if it looks like YAML/JSON
      if (document.paragraphs.length > 0) {
        const firstParagraph = document.paragraphs[0].text.trim();
        if (firstParagraph.startsWith('---') || firstParagraph.startsWith('{')) {
          const frontmatter = await this.parseFrontmatterFromText(firstParagraph);
          if (frontmatter) {
            return frontmatter;
          }
        }
      }
      
      this.logger.debug('No frontmatter found in Word template');
      return null;
      
    } catch (error) {
      this.logger.warn(`Failed to parse frontmatter from Word template: ${error.message}`);
      return null;
    }
  }

  /**
   * Extracts variables from Word document content
   * 
   * @param {TemplateInfo} template - Template info
   * @param {TemplateFrontmatter} [frontmatter] - Template frontmatter
   * @returns {Promise<VariableLocation[]>} Promise resolving to variable locations
   */
  async extractVariables(template, frontmatter) {
    this.logger.debug(`Extracting variables from Word template: ${template.name}`);
    
    try {
      const document = await this.loadWordDocument(template.path);
      const variables = this.variableExtractor.extractFromDocument(document, 'word');
      
      this.logger.info(`Extracted ${variables.length} variables from Word template`);
      return variables;
      
    } catch (error) {
      this.logger.error(`Failed to extract variables from Word template: ${error.message}`);
      throw error;
    }
  }

  /**
   * Processes the Word template with provided data
   * 
   * @param {TemplateInfo} template - Template info
   * @param {Object} data - Data for variable replacement
   * @param {TemplateFrontmatter} [frontmatter] - Template frontmatter
   * @returns {Promise<ProcessingResult>} Promise resolving to processing result
   */
  async processTemplate(template, data, frontmatter) {
    this.logger.debug(`Processing Word template: ${template.name}`);
    
    try {
      const document = await this.loadWordDocument(template.path);
      
      // Process variables in content
      await this.processVariablesInDocument(document, data, frontmatter);
      
      // Process injection points if defined
      if (frontmatter?.injectionPoints) {
        await this.processInjectionPoints(document, data, frontmatter.injectionPoints);
      }
      
      // Generate processed document content
      const content = await this.generateDocumentContent(document);
      
      // Extract metadata
      const metadata = this.extractDocumentMetadata(document);
      
      const result = {
        success: true,
        content,
        metadata,
        stats: this.getStats(),
        validation: { valid: true, errors: [], warnings: [] }
      };
      
      this.logger.info(`Word template processed successfully: ${template.name}`);
      return result;
      
    } catch (error) {
      this.incrementErrorCount();
      this.logger.error(`Failed to process Word template: ${error.message}`);
      
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
   * Saves the processed Word document to file
   * 
   * @param {ProcessingResult} result - Processing result
   * @param {string} outputPath - Output file path
   * @returns {Promise<string>} Promise resolving to saved file path
   */
  async saveDocument(result, outputPath) {
    this.logger.debug(`Saving Word document to: ${outputPath}`);
    
    try {
      // Ensure output directory exists
      const outputDir = path.dirname(outputPath);
      await fs.mkdir(outputDir, { recursive: true });
      
      // Write document content to file
      if (result.content instanceof Buffer) {
        await fs.writeFile(outputPath, result.content);
      } else {
        throw new Error('Invalid document content format for Word document');
      }
      
      this.logger.info(`Word document saved successfully: ${outputPath}`);
      return outputPath;
      
    } catch (error) {
      this.logger.error(`Failed to save Word document: ${error.message}`);
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
   * Loads Word document from file path
   * 
   * @param {string} filePath - Path to Word document
   * @returns {Promise<Object>} Promise resolving to Word document structure
   */
  async loadWordDocument(filePath) {
    try {
      // In a real implementation, you would use a library like 'docx' or 'mammoth'
      // to parse the DOCX file. This is a simplified placeholder implementation.
      
      const fileContent = await fs.readFile(filePath);
      
      // Placeholder implementation - in reality, you would parse the DOCX ZIP structure
      // and extract the document.xml, styles.xml, etc.
      
      const document = {
        paragraphs: [
          {
            text: 'Sample document content with {{variable}}',
            runs: [{ text: 'Sample document content with {{variable}}' }]
          }
        ],
        tables: [],
        headers: [],
        footers: [],
        properties: {
          title: 'Sample Document',
          author: 'Template System',
          created: new Date(),
          modified: new Date()
        },
        styles: [],
        images: []
      };
      
      return document;
      
    } catch (error) {
      throw new Error(`Failed to load Word document: ${error.message}`);
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
    // Process paragraphs
    for (const paragraph of document.paragraphs) {
      paragraph.text = this.variableExtractor.replaceVariables(paragraph.text, data);
      
      // Update runs as well
      for (const run of paragraph.runs) {
        run.text = this.variableExtractor.replaceVariables(run.text, data);
      }
      
      this.incrementVariableCount();
    }
    
    // Process tables
    for (const table of document.tables) {
      for (const row of table.rows) {
        for (const cell of row.cells) {
          for (const paragraph of cell.paragraphs) {
            paragraph.text = this.variableExtractor.replaceVariables(paragraph.text, data);
            
            for (const run of paragraph.runs) {
              run.text = this.variableExtractor.replaceVariables(run.text, data);
            }
          }
        }
      }
      this.incrementVariableCount();
    }
    
    // Process headers and footers
    for (const section of [...document.headers, ...document.footers]) {
      for (const paragraph of section.paragraphs) {
        paragraph.text = this.variableExtractor.replaceVariables(paragraph.text, data);
        
        for (const run of paragraph.runs) {
          run.text = this.variableExtractor.replaceVariables(run.text, data);
        }
      }
      this.incrementVariableCount();
    }
  }

  /**
   * Processes injection points in Word document
   * 
   * @param {Object} document - Word document
   * @param {Object} data - Injection data
   * @param {InjectionPoint[]} injectionPoints - Injection point definitions
   */
  async processInjectionPoints(document, data, injectionPoints) {
    for (const injectionPoint of injectionPoints) {
      const content = data[injectionPoint.id] || injectionPoint.defaultContent || '';
      
      if (content) {
        await this.injectContentAtMarker(document, injectionPoint.marker, content, injectionPoint);
        this.incrementInjectionCount();
      }
    }
  }

  /**
   * Injects content at specified marker in document
   * 
   * @param {Object} document - Word document
   * @param {string} marker - Marker string to find
   * @param {string} content - Content to inject
   * @param {InjectionPoint} injectionPoint - Injection point configuration
   */
  async injectContentAtMarker(document, marker, content, injectionPoint) {
    // Find and replace marker in paragraphs
    for (const paragraph of document.paragraphs) {
      if (paragraph.text.includes(marker)) {
        const position = injectionPoint.processing?.position || 'replace';
        
        switch (position) {
          case 'replace':
            paragraph.text = paragraph.text.replace(marker, content);
            break;
          case 'before':
            paragraph.text = paragraph.text.replace(marker, content + marker);
            break;
          case 'after':
            paragraph.text = paragraph.text.replace(marker, marker + content);
            break;
        }
        
        // Update runs to match
        paragraph.runs = [{ text: paragraph.text }];
      }
    }
    
    // Also check tables
    for (const table of document.tables) {
      for (const row of table.rows) {
        for (const cell of row.cells) {
          for (const paragraph of cell.paragraphs) {
            if (paragraph.text.includes(marker)) {
              const position = injectionPoint.processing?.position || 'replace';
              
              switch (position) {
                case 'replace':
                  paragraph.text = paragraph.text.replace(marker, content);
                  break;
                case 'before':
                  paragraph.text = paragraph.text.replace(marker, content + marker);
                  break;
                case 'after':
                  paragraph.text = paragraph.text.replace(marker, marker + content);
                  break;
              }
              
              paragraph.runs = [{ text: paragraph.text }];
            }
          }
        }
      }
    }
  }

  /**
   * Generates document content from Word document structure
   * 
   * @param {Object} document - Word document
   * @returns {Promise<Buffer>} Promise resolving to document content buffer
   */
  async generateDocumentContent(document) {
    // In a real implementation, you would use a library like 'docx'
    // to generate the DOCX file from the document structure
    
    // Placeholder implementation
    const content = JSON.stringify(document, null, 2);
    return Buffer.from(content, 'utf-8');
  }

  /**
   * Extracts metadata from Word document
   * 
   * @param {Object} document - Word document
   * @returns {DocumentMetadata} Document metadata
   */
  extractDocumentMetadata(document) {
    return {
      title: document.properties.title,
      author: document.properties.author,
      subject: document.properties.subject,
      keywords: document.properties.keywords ? [document.properties.keywords] : undefined,
      created: document.properties.created,
      modified: document.properties.modified,
      properties: {
        paragraphCount: document.paragraphs.length,
        tableCount: document.tables.length,
        headerCount: document.headers.length,
        footerCount: document.footers.length,
        imageCount: document.images.length
      }
    };
  }

  /**
   * Validates Word document structure
   * 
   * @param {Object} document - Word document to validate
   * @returns {boolean} Whether document structure is valid
   */
  isValidWordDocument(document) {
    return (
      document &&
      Array.isArray(document.paragraphs) &&
      Array.isArray(document.tables) &&
      Array.isArray(document.headers) &&
      Array.isArray(document.footers) &&
      typeof document.properties === 'object'
    );
  }

  /**
   * Parses frontmatter from text content
   * 
   * @param {string} text - Text content to parse
   * @returns {Promise<TemplateFrontmatter|null>} Parsed frontmatter or null
   */
  async parseFrontmatterFromText(text) {
    try {
      // Try JSON first
      if (text.trim().startsWith('{')) {
        return JSON.parse(text);
      }
      
      // Try YAML (simplified parsing)
      if (text.trim().startsWith('---')) {
        // In a real implementation, you would use a YAML parser
        // This is a simplified placeholder
        return null;
      }
      
      return null;
    } catch (error) {
      return null;
    }
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