/**
 * Excel document processor for Office template processing in KGEN
 * 
 * This module provides comprehensive Excel document processing capabilities including:
 * - XLSX file reading and writing
 * - Worksheet and cell template processing
 * - Named ranges and formula handling
 * - Chart and pivot table support
 * - Dynamic data population
 * 
 * @module office/processors/excel-processor
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
 * Excel document processor implementation
 * 
 * Extends the base processor to provide Excel-specific functionality for
 * reading, processing, and writing XLSX files with template capabilities.
 */
export class ExcelProcessor extends BaseOfficeProcessor {
  static SUPPORTED_EXTENSIONS = ['.xlsx', '.xls'];
  static FRONTMATTER_PROPERTY = 'unjucks:frontmatter';
  
  /**
   * Gets the document type supported by this processor
   * 
   * @returns {string} Excel document type
   */
  getSupportedType() {
    return DocumentType.EXCEL;
  }

  /**
   * Gets supported file extensions
   * 
   * @returns {string[]} Array of supported extensions
   */
  getSupportedExtensions() {
    return [...ExcelProcessor.SUPPORTED_EXTENSIONS];
  }

  /**
   * Loads an Excel template from file path
   * 
   * @param {string} templatePath - Path to the Excel template file
   * @returns {Promise<TemplateInfo>} Promise resolving to template info
   */
  async loadTemplate(templatePath) {
    this.logger.debug(`Loading Excel template: ${templatePath}`);
    
    try {
      await fs.access(templatePath, fs.constants.R_OK);
      const stats = await fs.stat(templatePath);
      
      const extension = this.getFileExtension(templatePath);
      if (!this.getSupportedExtensions().includes(extension)) {
        throw new Error(`Unsupported file extension: ${extension}`);
      }
      
      const templateInfo = {
        path: templatePath,
        name: path.basename(templatePath, extension),
        type: DocumentType.EXCEL,
        size: stats.size,
        lastModified: stats.mtime
      };
      
      templateInfo.hash = await this.calculateFileHash(templatePath);
      
      this.logger.info(`Excel template loaded successfully: ${templateInfo.name}`);
      return templateInfo;
      
    } catch (error) {
      this.logger.error(`Failed to load Excel template: ${templatePath}`, error);
      throw new Error(`Failed to load Excel template: ${error.message}`);
    }
  }

  /**
   * Parses frontmatter from Excel document properties
   * 
   * @param {TemplateInfo} template - Template info
   * @returns {Promise<TemplateFrontmatter|null>} Promise resolving to frontmatter or null
   */
  async parseFrontmatter(template) {
    this.logger.debug(`Parsing frontmatter from Excel template: ${template.name}`);
    
    try {
      const document = await this.loadExcelDocument(template.path);
      
      // Check for frontmatter in custom document properties
      const frontmatterData = document.properties.custom?.[ExcelProcessor.FRONTMATTER_PROPERTY];
      
      if (frontmatterData) {
        if (typeof frontmatterData === 'string') {
          return JSON.parse(frontmatterData);
        } else if (typeof frontmatterData === 'object') {
          return frontmatterData;
        }
      }
      
      // Try to parse from a specific named range or cell
      const frontmatterRange = document.namedRanges['UnjucksFrontmatter'];
      if (frontmatterRange && frontmatterRange.value) {
        const frontmatter = await this.parseFrontmatterFromText(frontmatterRange.value);
        if (frontmatter) {
          return frontmatter;
        }
      }
      
      // Check cell A1 in first worksheet
      if (document.worksheets.length > 0) {
        const firstSheet = document.worksheets[0];
        const cell = firstSheet.cells['A1'];
        if (cell && typeof cell.value === 'string') {
          const frontmatter = await this.parseFrontmatterFromText(cell.value);
          if (frontmatter) {
            return frontmatter;
          }
        }
      }
      
      this.logger.debug('No frontmatter found in Excel template');
      return null;
      
    } catch (error) {
      this.logger.warn(`Failed to parse frontmatter from Excel template: ${error.message}`);
      return null;
    }
  }

  /**
   * Extracts variables from Excel document content
   * 
   * @param {TemplateInfo} template - Template info
   * @param {TemplateFrontmatter} [frontmatter] - Template frontmatter
   * @returns {Promise<VariableLocation[]>} Promise resolving to variable locations
   */
  async extractVariables(template, frontmatter) {
    this.logger.debug(`Extracting variables from Excel template: ${template.name}`);
    
    try {
      const document = await this.loadExcelDocument(template.path);
      const variables = this.variableExtractor.extractFromDocument(document, 'excel');
      
      this.logger.info(`Extracted ${variables.length} variables from Excel template`);
      return variables;
      
    } catch (error) {
      this.logger.error(`Failed to extract variables from Excel template: ${error.message}`);
      throw error;
    }
  }

  /**
   * Processes the Excel template with provided data
   * 
   * @param {TemplateInfo} template - Template info
   * @param {Object} data - Data for variable replacement
   * @param {TemplateFrontmatter} [frontmatter] - Template frontmatter
   * @returns {Promise<ProcessingResult>} Promise resolving to processing result
   */
  async processTemplate(template, data, frontmatter) {
    this.logger.debug(`Processing Excel template: ${template.name}`);
    
    try {
      const document = await this.loadExcelDocument(template.path);
      
      // Process variables in worksheets
      await this.processVariablesInDocument(document, data, frontmatter);
      
      // Process data tables if defined
      await this.processDataTables(document, data, frontmatter);
      
      // Process charts with dynamic data
      await this.processCharts(document, data, frontmatter);
      
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
      
      this.logger.info(`Excel template processed successfully: ${template.name}`);
      return result;
      
    } catch (error) {
      this.incrementErrorCount();
      this.logger.error(`Failed to process Excel template: ${error.message}`);
      
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
   * Saves the processed Excel document to file
   * 
   * @param {ProcessingResult} result - Processing result
   * @param {string} outputPath - Output file path
   * @returns {Promise<string>} Promise resolving to saved file path
   */
  async saveDocument(result, outputPath) {
    this.logger.debug(`Saving Excel document to: ${outputPath}`);
    
    try {
      const outputDir = path.dirname(outputPath);
      await fs.mkdir(outputDir, { recursive: true });
      
      if (result.content instanceof Buffer) {
        await fs.writeFile(outputPath, result.content);
      } else {
        throw new Error('Invalid document content format for Excel document');
      }
      
      this.logger.info(`Excel document saved successfully: ${outputPath}`);
      return outputPath;
      
    } catch (error) {
      this.logger.error(`Failed to save Excel document: ${error.message}`);
      throw error;
    }
  }

  /**
   * Validates Excel template structure
   * 
   * @param {TemplateInfo} template - Template info
   * @returns {Promise<ValidationResult>} Promise resolving to validation result
   */
  async validateTemplate(template) {
    this.logger.debug(`Validating Excel template: ${template.name}`);
    
    const errors = [];
    const warnings = [];
    
    try {
      await fs.access(template.path, fs.constants.R_OK);
      const document = await this.loadExcelDocument(template.path);
      
      // Check if document has worksheets
      if (!document.worksheets || document.worksheets.length === 0) {
        errors.push({
          message: 'Excel template has no worksheets',
          code: 'NO_WORKSHEETS',
          severity: ErrorSeverity.ERROR
        });
      }
      
      // Validate each worksheet
      for (const worksheet of document.worksheets) {
        if (!worksheet.name) {
          warnings.push({
            message: `Worksheet at index ${worksheet.index} has no name`,
            code: 'UNNAMED_WORKSHEET',
            severity: ErrorSeverity.WARNING
          });
        }
        
        // Check for empty worksheets
        if (!worksheet.cells || Object.keys(worksheet.cells).length === 0) {
          warnings.push({
            message: `Worksheet '${worksheet.name}' appears to be empty`,
            code: 'EMPTY_WORKSHEET',
            severity: ErrorSeverity.WARNING
          });
        }
      }
      
      // Validate named ranges
      for (const [name, range] of Object.entries(document.namedRanges)) {
        if (!range.reference) {
          errors.push({
            message: `Named range '${name}' has no reference`,
            code: 'INVALID_NAMED_RANGE',
            severity: ErrorSeverity.ERROR
          });
        }
      }
      
      this.logger.info(`Excel template validation completed: ${errors.length} errors, ${warnings.length} warnings`);
      
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
   * Loads Excel document from file path
   * 
   * @param {string} filePath - Path to Excel document
   * @returns {Promise<Object>} Promise resolving to Excel document structure
   */
  async loadExcelDocument(filePath) {
    try {
      // In a real implementation, you would use a library like 'exceljs' or 'xlsx'
      // to parse the XLSX file. This is a simplified placeholder implementation.
      
      const fileContent = await fs.readFile(filePath);
      
      // Placeholder implementation
      const document = {
        worksheets: [
          {
            name: 'Sheet1',
            index: 0,
            cells: {
              'A1': { value: 'Name', type: 'string' },
              'B1': { value: 'Value', type: 'string' },
              'A2': { value: '{{userName}}', type: 'string' },
              'B2': { value: '{{userValue}}', type: 'string' }
            },
            mergedCells: [],
            columns: [
              { index: 0, letter: 'A', width: 100 },
              { index: 1, letter: 'B', width: 100 }
            ],
            rows: [
              { index: 1 },
              { index: 2 }
            ],
            properties: {},
            charts: [],
            tables: []
          }
        ],
        properties: {
          title: 'Sample Excel Template',
          author: 'Template System',
          created: this.getDeterministicDate(),
          modified: this.getDeterministicDate()
        },
        namedRanges: {},
        charts: [],
        pivotTables: [],
        styles: []
      };
      
      return document;
      
    } catch (error) {
      throw new Error(`Failed to load Excel document: ${error.message}`);
    }
  }

  /**
   * Processes variables in Excel document
   * 
   * @param {Object} document - Excel document
   * @param {Object} data - Replacement data
   * @param {TemplateFrontmatter} [frontmatter] - Template frontmatter
   */
  async processVariablesInDocument(document, data, frontmatter) {
    for (const worksheet of document.worksheets) {
      for (const [cellRef, cell] of Object.entries(worksheet.cells)) {
        if (typeof cell.value === 'string') {
          cell.value = this.variableExtractor.replaceVariables(cell.value, data);
          this.incrementVariableCount();
        }
        
        // Also process formulas
        if (cell.formula && typeof cell.formula === 'string') {
          cell.formula = this.variableExtractor.replaceVariables(cell.formula, data);
        }
        
        // Process comments
        if (cell.comment && typeof cell.comment === 'string') {
          cell.comment = this.variableExtractor.replaceVariables(cell.comment, data);
        }
      }
    }
    
    // Process named ranges
    for (const [name, range] of Object.entries(document.namedRanges)) {
      if (range.value && typeof range.value === 'string') {
        range.value = this.variableExtractor.replaceVariables(range.value, data);
        this.incrementVariableCount();
      }
    }
  }

  /**
   * Processes data tables with dynamic content
   * 
   * @param {Object} document - Excel document
   * @param {Object} data - Data for tables
   * @param {TemplateFrontmatter} [frontmatter] - Template frontmatter
   */
  async processDataTables(document, data, frontmatter) {
    // Process tables defined in frontmatter
    const tableConfigs = frontmatter?.metadata?.tables;
    if (!tableConfigs || !Array.isArray(tableConfigs)) {
      return;
    }
    
    for (const tableConfig of tableConfigs) {
      const tableData = data[tableConfig.dataSource];
      if (Array.isArray(tableData)) {
        await this.populateTableData(document, tableConfig, tableData);
      }
    }
  }

  /**
   * Populates table data in worksheet
   * 
   * @param {Object} document - Excel document
   * @param {Object} tableConfig - Table configuration
   * @param {Array} tableData - Data to populate
   */
  async populateTableData(document, tableConfig, tableData) {
    const worksheetName = tableConfig.worksheet || document.worksheets[0]?.name;
    const worksheet = document.worksheets.find(ws => ws.name === worksheetName);
    
    if (!worksheet) {
      this.logger.warn(`Worksheet '${worksheetName}' not found for table population`);
      return;
    }
    
    const startRow = tableConfig.startRow || 1;
    const startCol = tableConfig.startCol || 0;
    
    // Populate data rows
    for (let rowIndex = 0; rowIndex < tableData.length; rowIndex++) {
      const rowData = tableData[rowIndex];
      const excelRow = startRow + rowIndex;
      
      if (Array.isArray(rowData)) {
        // Data is already an array
        for (let colIndex = 0; colIndex < rowData.length; colIndex++) {
          const cellRef = this.getCellReference(excelRow, startCol + colIndex);
          worksheet.cells[cellRef] = {
            value: rowData[colIndex],
            type: this.inferCellType(rowData[colIndex])
          };
        }
      } else if (typeof rowData === 'object') {
        // Data is an object, use column mapping
        const columns = tableConfig.columns || Object.keys(rowData);
        for (let colIndex = 0; colIndex < columns.length; colIndex++) {
          const columnKey = columns[colIndex];
          const cellRef = this.getCellReference(excelRow, startCol + colIndex);
          worksheet.cells[cellRef] = {
            value: rowData[columnKey],
            type: this.inferCellType(rowData[columnKey])
          };
        }
      }
    }
    
    this.incrementInjectionCount();
  }

  /**
   * Processes charts with dynamic data
   * 
   * @param {Object} document - Excel document
   * @param {Object} data - Data for charts
   * @param {TemplateFrontmatter} [frontmatter] - Template frontmatter
   */
  async processCharts(document, data, frontmatter) {
    for (const chart of document.charts) {
      // Update chart data series with dynamic ranges
      for (const series of chart.series) {
        if (series.xValues) {
          series.xValues = this.variableExtractor.replaceVariables(series.xValues, data);
        }
        series.yValues = this.variableExtractor.replaceVariables(series.yValues, data);
      }
      
      // Update chart title
      if (chart.title) {
        chart.title = this.variableExtractor.replaceVariables(chart.title, data);
      }
    }
  }

  /**
   * Processes injection points in Excel document
   * 
   * @param {Object} document - Excel document
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
   * @param {Object} document - Excel document
   * @param {string} marker - Marker string to find
   * @param {string} content - Content to inject
   * @param {InjectionPoint} injectionPoint - Injection point configuration
   */
  async injectContentAtMarker(document, marker, content, injectionPoint) {
    for (const worksheet of document.worksheets) {
      for (const [cellRef, cell] of Object.entries(worksheet.cells)) {
        if (typeof cell.value === 'string' && cell.value.includes(marker)) {
          const position = injectionPoint.processing?.position || 'replace';
          
          switch (position) {
            case 'replace':
              cell.value = cell.value.replace(marker, content);
              break;
            case 'before':
              cell.value = cell.value.replace(marker, content + marker);
              break;
            case 'after':
              cell.value = cell.value.replace(marker, marker + content);
              break;
          }
          
          // Update cell type if needed
          cell.type = this.inferCellType(cell.value);
        }
      }
    }
  }

  /**
   * Generates document content from Excel document structure
   * 
   * @param {Object} document - Excel document
   * @returns {Promise<Buffer>} Promise resolving to document content buffer
   */
  async generateDocumentContent(document) {
    // In a real implementation, you would use a library like 'exceljs'
    // to generate the XLSX file from the document structure
    
    // Placeholder implementation
    const content = JSON.stringify(document, null, 2);
    return Buffer.from(content, 'utf-8');
  }

  /**
   * Extracts metadata from Excel document
   * 
   * @param {Object} document - Excel document
   * @returns {DocumentMetadata} Document metadata
   */
  extractDocumentMetadata(document) {
    const totalCells = document.worksheets.reduce(
      (total, ws) => total + Object.keys(ws.cells).length, 
      0
    );
    
    return {
      title: document.properties.title,
      author: document.properties.author,
      subject: document.properties.subject,
      keywords: document.properties.keywords ? [document.properties.keywords] : undefined,
      created: document.properties.created,
      modified: document.properties.modified,
      properties: {
        worksheetCount: document.worksheets.length,
        cellCount: totalCells,
        namedRangeCount: Object.keys(document.namedRanges).length,
        chartCount: document.charts.length,
        pivotTableCount: document.pivotTables.length
      }
    };
  }

  /**
   * Gets cell reference from row and column indices
   * 
   * @param {number} row - Row index (1-based)
   * @param {number} col - Column index (0-based)
   * @returns {string} Cell reference (e.g., 'A1')
   */
  getCellReference(row, col) {
    let columnName = '';
    let columnNumber = col;
    
    while (columnNumber >= 0) {
      columnName = String.fromCharCode(65 + (columnNumber % 26)) + columnName;
      columnNumber = Math.floor(columnNumber / 26) - 1;
      
      if (columnNumber < 0) break;
    }
    
    return `${columnName}${row}`;
  }

  /**
   * Infers cell type from value
   * 
   * @param {*} value - Cell value
   * @returns {string} Inferred cell type
   */
  inferCellType(value) {
    if (typeof value === 'number') {
      return 'number';
    } else if (typeof value === 'boolean') {
      return 'boolean';
    } else if (value instanceof Date) {
      return 'date';
    } else if (typeof value === 'string' && value.startsWith('=')) {
      return 'formula';
    } else {
      return 'string';
    }
  }

  /**
   * Parses frontmatter from text content
   * 
   * @param {string} text - Text content to parse
   * @returns {Promise<TemplateFrontmatter|null>} Parsed frontmatter or null
   */
  async parseFrontmatterFromText(text) {
    try {
      if (text.trim().startsWith('{')) {
        return JSON.parse(text);
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
    const stats = await fs.stat(filePath);
    return `${stats.size}-${stats.mtime.getTime()}`;
  }
}