/**
 * LaTeX-based table processor replacing Excel document processing
 * 
 * This module provides comprehensive LaTeX table generation capabilities including:
 * - LaTeX table template processing with Nunjucks
 * - Semantic table parsing and generation
 * - PDF compilation via LaTeX engines
 * - Advanced table layouts (tabular, longtable, booktabs)
 * - Data-driven table generation from CSV/JSON
 * 
 * @module office/processors/latex-table-processor
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
 * LaTeX-based table processor implementation
 * 
 * Extends the base processor to provide LaTeX table generation functionality
 * for creating professional tables, reports, and data presentations via LaTeX.
 */
export class LaTeXTableProcessor extends BaseOfficeProcessor {
  static SUPPORTED_EXTENSIONS = ['.tex', '.latex', '.ltx'];
  static FRONTMATTER_PROPERTY = 'unjucks:frontmatter';

  /**
   * Gets the document type supported by this processor
   * 
   * @returns {string} LaTeX table document type
   */
  getSupportedType() {
    return DocumentType.LATEX_TABLE;
  }

  /**
   * Gets supported file extensions
   * 
   * @returns {string[]} Array of supported extensions
   */
  getSupportedExtensions() {
    return [...LaTeXTableProcessor.SUPPORTED_EXTENSIONS];
  }

  /**
   * Initialize LaTeX components
   */
  async initialize() {
    if (this.initialized) return;

    this.compiler = new LaTeXCompiler({
      outputDir: this.options.outputDir || './dist/latex-tables',
      tempDir: this.options.tempDir || './temp/latex-tables',
      enableSyncTeX: true,
      security: {
        enabled: true,
        strictMode: this.options.strictMode || true
      }
    });

    this.renderer = new LaTeXTemplateRenderer({
      templatesDir: this.options.templatesDir || './templates/latex/tables'
    });

    this.validator = new LaTeXSyntaxValidator({
      strictMode: this.options.strictMode || true
    });

    await this.compiler.initialize();
    await this.renderer.initialize();

    this.initialized = true;
  }

  /**
   * Loads a LaTeX table template from file path
   * 
   * @param {string} templatePath - Path to the LaTeX template file
   * @returns {Promise<TemplateInfo>} Promise resolving to template info
   */
  async loadTemplate(templatePath) {
    this.logger.debug(`Loading LaTeX table template: ${templatePath}`);
    
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      await fs.access(templatePath, fs.constants.R_OK);
      const stats = await fs.stat(templatePath);
      
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
        type: DocumentType.LATEX_TABLE,
        size: stats.size,
        lastModified: stats.mtime,
        content,
        parseResult,
        tableInfo: this.extractTableInfo(parseResult)
      };
      
      templateInfo.hash = await this.calculateFileHash(templatePath);
      
      this.logger.info(`LaTeX table template loaded successfully: ${templateInfo.name}`);
      return templateInfo;
      
    } catch (error) {
      this.logger.error(`Failed to load LaTeX table template: ${templatePath}`, error);
      throw new Error(`Failed to load LaTeX table template: ${error.message}`);
    }
  }

  /**
   * Parses frontmatter from LaTeX table template comments
   * 
   * @param {TemplateInfo} template - Template info
   * @returns {Promise<TemplateFrontmatter|null>} Promise resolving to frontmatter or null
   */
  async parseFrontmatter(template) {
    this.logger.debug(`Parsing frontmatter from LaTeX table template: ${template.name}`);
    
    try {
      const content = template.content || await fs.readFile(template.path, 'utf8');
      
      // Look for table-specific frontmatter
      const frontmatterMatch = content.match(/^%\s*TABLE-CONFIG\s*:\s*({[\s\S]*?})\s*$/m);
      if (frontmatterMatch) {
        try {
          const frontmatter = JSON.parse(frontmatterMatch[1]);
          this.logger.debug(`Found table configuration frontmatter`);
          return frontmatter;
        } catch (jsonError) {
          this.logger.warn(`Failed to parse table configuration: ${jsonError.message}`);
        }
      }
      
      // Fallback to standard frontmatter
      const standardMatch = content.match(/^%\s*---\s*([\s\S]*?)%\s*---\s*/m);
      if (standardMatch) {
        const frontmatterYaml = standardMatch[1];
        try {
          const frontmatter = this.parseYamlFrontmatter(frontmatterYaml);
          return frontmatter;
        } catch (yamlError) {
          this.logger.warn(`Failed to parse YAML frontmatter: ${yamlError.message}`);
        }
      }
      
      return null;
      
    } catch (error) {
      this.logger.warn(`Failed to parse frontmatter: ${error.message}`);
      return null;
    }
  }

  /**
   * Extracts variables from LaTeX table template content
   * 
   * @param {TemplateInfo} template - Template info
   * @param {TemplateFrontmatter} [frontmatter] - Template frontmatter
   * @returns {Promise<VariableLocation[]>} Promise resolving to variable locations
   */
  async extractVariables(template, frontmatter) {
    this.logger.debug(`Extracting variables from LaTeX table template: ${template.name}`);
    
    try {
      const content = template.content || await fs.readFile(template.path, 'utf8');
      const variables = this.extractNunjucksVariables(content);
      
      // Add table-specific variable extraction
      const tableVariables = this.extractTableVariables(content);
      variables.push(...tableVariables);
      
      this.logger.info(`Extracted ${variables.length} variables from LaTeX table template`);
      return variables;
      
    } catch (error) {
      this.logger.error(`Failed to extract variables: ${error.message}`);
      throw error;
    }
  }

  /**
   * Extract table-specific variables (loops for rows, columns)
   */
  extractTableVariables(content) {
    const variables = [];
    
    // Extract table row loops
    const rowLoopPattern = /{%\s*for\s+(\w+)\s+in\s+([^%]+)\s*%}/g;
    let match;
    
    while ((match = rowLoopPattern.exec(content)) !== null) {
      variables.push({
        name: match[2].trim(),
        type: 'table-data',
        loopVariable: match[1],
        position: match.index,
        fullMatch: match[0],
        location: 'table-loop'
      });
    }
    
    // Extract cell variables
    const cellPattern = /{{\\s*([^}]+\\.(?:cell|value|data)[^}]*)\\s*}}/g;
    while ((match = cellPattern.exec(content)) !== null) {
      variables.push({
        name: match[1].trim(),
        type: 'table-cell',
        position: match.index,
        fullMatch: match[0],
        location: 'table-cell'
      });
    }
    
    return variables;
  }

  /**
   * Processes the LaTeX table template with provided data
   * 
   * @param {TemplateInfo} template - Template info
   * @param {Object} data - Data for variable replacement
   * @param {TemplateFrontmatter} [frontmatter] - Template frontmatter
   * @returns {Promise<ProcessingResult>} Promise resolving to processing result
   */
  async processTemplate(template, data, frontmatter) {
    this.logger.debug(`Processing LaTeX table template: ${template.name}`);
    
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      // Pre-process table data
      const processedData = await this.preprocessTableData(data, frontmatter);

      // Convert template path to relative path for Nunjucks renderer
      const templatesDir = this.options.templatesDir || './templates/latex';
      const relativePath = path.relative(templatesDir, template.path);
      
      // Render LaTeX table template with Nunjucks
      const renderResult = await this.renderer.render(relativePath, processedData);
      
      // Validate generated LaTeX
      const validationResult = await this.validator.validate(renderResult.content);
      
      // Process injection points if defined
      let finalContent = renderResult.content;
      if (frontmatter?.injectionPoints) {
        finalContent = await this.processInjectionPoints(finalContent, processedData, frontmatter.injectionPoints);
      }
      
      // Parse the generated LaTeX for metadata extraction
      const parseResult = this.parseLatexContent(finalContent);
      
      const result = {
        success: true,
        content: finalContent,
        latexContent: finalContent,
        metadata: this.extractTableMetadata(parseResult, processedData),
        stats: this.getStats(),
        validation: validationResult,
        parseResult,
        tableData: processedData
      };
      
      this.logger.info(`LaTeX table template processed successfully: ${template.name}`);
      return result;
      
    } catch (error) {
      this.incrementErrorCount();
      this.logger.error(`Failed to process LaTeX table template: ${error.message}`);
      
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
   * Pre-process table data for LaTeX generation
   */
  async preprocessTableData(data, frontmatter) {
    const processed = { ...data };

    // Convert CSV data if provided
    if (data.csvData && typeof data.csvData === 'string') {
      processed.tableRows = this.parseCsvData(data.csvData);
    }

    // Process array data into table format
    if (data.tableData && Array.isArray(data.tableData)) {
      processed.tableRows = data.tableData;
      processed.columnCount = data.tableData.length > 0 
        ? Object.keys(data.tableData[0]).length 
        : 0;
      processed.rowCount = data.tableData.length;
    }

    // Generate column specifications if not provided
    if (!processed.columnSpec && processed.columnCount) {
      processed.columnSpec = 'l'.repeat(processed.columnCount);
    }

    // Add table formatting helpers
    processed.formatters = {
      escapeLatex: (str) => this.escapeLatexSpecialChars(String(str)),
      formatNumber: (num) => typeof num === 'number' ? num.toFixed(2) : num,
      formatCurrency: (num) => typeof num === 'number' ? `\\$${num.toFixed(2)}` : num,
      formatPercent: (num) => typeof num === 'number' ? `${(num * 100).toFixed(1)}\\%` : num
    };

    return processed;
  }

  /**
   * Parse CSV data into table rows
   */
  parseCsvData(csvString) {
    const lines = csvString.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    const rows = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      rows.push(row);
    }

    return rows;
  }

  /**
   * Extract table information from parsed LaTeX
   */
  extractTableInfo(parseResult) {
    const tableInfo = {
      tables: [],
      totalTables: 0,
      tableTypes: new Set()
    };

    if (parseResult.ast) {
      const tableNodes = this.findNodesByType(parseResult.ast, 'environment')
        .filter(node => ['tabular', 'longtable', 'array', 'matrix'].includes(node.value));

      tableInfo.tables = tableNodes.map(node => ({
        type: node.value,
        id: node.id,
        semantic: node.semantic
      }));

      tableInfo.totalTables = tableNodes.length;
      tableNodes.forEach(node => tableInfo.tableTypes.add(node.value));
    }

    return tableInfo;
  }

  /**
   * Extract metadata from processed table
   */
  extractTableMetadata(parseResult, tableData) {
    return {
      title: parseResult.metadata?.title || 'LaTeX Table Document',
      author: parseResult.metadata?.author || 'Table Generator',
      date: this.getDeterministicDate().toISOString(),
      documentClass: parseResult.metadata?.documentClass || 'article',
      tableCount: tableData.rowCount || 0,
      columnCount: tableData.columnCount || 0,
      dataSource: tableData.csvData ? 'CSV' : 'JSON',
      packages: this.extractRequiredPackages(parseResult),
      processingTime: parseResult.statistics?.processingTime || 0,
      errors: parseResult.errors?.length || 0,
      warnings: parseResult.warnings?.length || 0
    };
  }

  /**
   * Extract required LaTeX packages from content
   */
  extractRequiredPackages(parseResult) {
    const packages = ['booktabs', 'array', 'longtable', 'multirow', 'hhline'];
    
    if (parseResult.documentStructure?.preamble) {
      const usedPackages = parseResult.documentStructure.preamble
        .filter(node => node.type === 'command' && node.value === 'usepackage')
        .map(node => node.children?.[0]?.value || 'unknown');
      
      packages.push(...usedPackages);
    }
    
    return [...new Set(packages)];
  }

  /**
   * Escape LaTeX special characters in table data
   */
  escapeLatexSpecialChars(str) {
    return str
      .replace(/\\/g, '\\textbackslash{}')
      .replace(/\{/g, '\\{')
      .replace(/\}/g, '\\}')
      .replace(/\$/g, '\\$')
      .replace(/&/g, '\\&')
      .replace(/%/g, '\\%')
      .replace(/#/g, '\\#')
      .replace(/\^/g, '\\textasciicircum{}')
      .replace(/_/g, '\\_')
      .replace(/~/g, '\\textasciitilde{}');
  }

  /**
   * Saves the processed LaTeX table document to file and optionally compiles to PDF
   */
  async saveDocument(result, outputPath, options = {}) {
    this.logger.debug(`Saving LaTeX table document to: ${outputPath}`);
    
    try {
      const outputDir = path.dirname(outputPath);
      await fs.mkdir(outputDir, { recursive: true });
      
      if (typeof result.content === 'string' || result.latexContent) {
        const content = result.latexContent || result.content;
        await fs.writeFile(outputPath, content, 'utf8');
      } else {
        throw new Error('Invalid document content format for LaTeX table document');
      }
      
      let pdfPath = null;
      
      // Compile to PDF if requested
      if (options.compileToPdf !== false && this.compiler) {
        try {
          const compilationResult = await this.compiler.compile(outputPath);
          if (compilationResult.success) {
            pdfPath = compilationResult.outputPath;
            this.logger.info(`LaTeX table compiled to PDF: ${pdfPath}`);
          }
        } catch (compileError) {
          this.logger.warn(`PDF compilation failed: ${compileError.message}`);
        }
      }
      
      this.logger.info(`LaTeX table document saved successfully: ${outputPath}`);
      return {
        texPath: outputPath,
        pdfPath,
        success: true
      };
      
    } catch (error) {
      this.logger.error(`Failed to save LaTeX table document: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate a complete standalone table document
   */
  async generateStandaloneTable(tableData, options = {}) {
    const {
      documentClass = 'article',
      packages = ['booktabs', 'array', 'geometry'],
      title = 'Data Table',
      author = 'LaTeX Table Generator',
      tableType = 'longtable'
    } = options;

    // Process the table data
    const processedData = await this.preprocessTableData({ tableData }, null);
    
    const latexDocument = this.generateTableDocument(processedData, {
      documentClass,
      packages,
      title,
      author,
      tableType
    });

    return {
      success: true,
      content: latexDocument,
      latexContent: latexDocument,
      metadata: {
        title,
        author,
        rowCount: processedData.rowCount,
        columnCount: processedData.columnCount,
        tableType,
        packages
      }
    };
  }

  /**
   * Generate complete LaTeX document with table
   */
  generateTableDocument(tableData, options) {
    const {
      documentClass,
      packages,
      title,
      author,
      tableType
    } = options;

    let latex = `\\documentclass{${documentClass}}\n\n`;
    
    // Add packages
    packages.forEach(pkg => {
      latex += `\\usepackage{${pkg}}\n`;
    });
    
    latex += `\n\\title{${title}}\n`;
    latex += `\\author{${author}}\n`;
    latex += `\\date{\\today}\n\n`;
    
    latex += `\\begin{document}\n\n`;
    latex += `\\maketitle\n\n`;
    
    // Generate table
    if (tableData.tableRows && tableData.tableRows.length > 0) {
      const headers = Object.keys(tableData.tableRows[0]);
      const columnSpec = tableData.columnSpec || 'l'.repeat(headers.length);
      
      latex += `\\begin{${tableType}}{${columnSpec}}\n`;
      latex += `\\toprule\n`;
      
      // Headers
      latex += headers.map(h => this.escapeLatexSpecialChars(h)).join(' & ');
      latex += ' \\\\\n\\midrule\n';
      
      // Rows
      for (const row of tableData.tableRows) {
        const values = headers.map(h => this.escapeLatexSpecialChars(String(row[h] || '')));
        latex += values.join(' & ') + ' \\\\\n';
      }
      
      latex += `\\bottomrule\n`;
      latex += `\\end{${tableType}}\n\n`;
    }
    
    latex += `\\end{document}\n`;
    
    return latex;
  }

  // Utility methods from LaTeXWordProcessor
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

  extractNunjucksVariables(content) {
    const variables = [];
    const variablePattern = /{{\\s*([^}\\s]+(?:\\.[^}\\s]+)*)\\s*}}/g;
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

  parseYamlFrontmatter(yamlContent) {
    const result = {};
    const lines = yamlContent.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('%')) {
        const colonIndex = trimmed.indexOf(':');
        if (colonIndex > 0) {
          const key = trimmed.substring(0, colonIndex).trim();
          let value = trimmed.substring(colonIndex + 1).trim();
          
          if ((value.startsWith('"') && value.endsWith('"')) ||
              (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }
          
          if (value === 'true') value = true;
          else if (value === 'false') value = false;
          else if (/^\\d+$/.test(value)) value = parseInt(value);
          else if (/^\\d+\\.\\d+$/.test(value)) value = parseFloat(value);
          
          result[key] = value;
        }
      }
    }
    
    return result;
  }

  findNodesByType(node, type) {
    const results = [];
    
    if (node.type === type) {
      results.push(node);
    }
    
    if (node.children) {
      node.children.forEach(child => {
        results.push(...this.findNodesByType(child, type));
      });
    }
    
    return results;
  }

  async calculateFileHash(filePath) {
    const stats = await fs.stat(filePath);
    return `${stats.size}-${stats.mtime.getTime()}`;
  }
}

// Export both old and new names for compatibility
export const ExcelProcessor = LaTeXTableProcessor;