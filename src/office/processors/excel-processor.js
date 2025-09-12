/**
 * Complete Excel Document Processor for Unjucks Template Processing
 * 
 * This module provides comprehensive Excel document processing capabilities using
 * the ExcelJS library for full XLSX file manipulation including:
 * - Template reading and variable replacement
 * - Formula processing with variable substitution  
 * - Named ranges and chart data population
 * - Worksheet duplication and modification
 * - Conditional formatting based on data
 * - Pivot table support and manipulation
 * - Batch processing for multiple files
 * - Complete error handling and validation
 * 
 * @module office/processors/excel-processor
 * @version 2.0.0
 * @author Unjucks Team
 * @requires exceljs
 */

import ExcelJS from 'exceljs';
import { promises as fs } from 'fs';
import * as path from 'path';
import { performance } from 'perf_hooks';

/**
 * Comprehensive Excel Document Processor
 * 
 * Handles all aspects of Excel template processing including reading templates,
 * replacing variables, manipulating charts and pivot tables, and generating
 * final documents with full formatting preservation.
 */
export class ExcelProcessor {
  /**
   * Initialize Excel processor with configuration options
   * 
   * @param {Object} options - Configuration options
   * @param {Object} [options.logger] - Logger instance for debugging
   * @param {boolean} [options.validateFormulas=true] - Whether to validate formulas
   * @param {boolean} [options.preserveFormatting=true] - Whether to preserve cell formatting
   * @param {boolean} [options.enableCharts=true] - Whether to process charts
   * @param {boolean} [options.enablePivotTables=true] - Whether to process pivot tables
   * @param {number} [options.maxFileSize=100*1024*1024] - Maximum file size in bytes
   */
  constructor(options = {}) {
    this.logger = options.logger || console;
    this.options = {
      validateFormulas: options.validateFormulas !== false,
      preserveFormatting: options.preserveFormatting !== false,
      enableCharts: options.enableCharts !== false,
      enablePivotTables: options.enablePivotTables !== false,
      maxFileSize: options.maxFileSize || 100 * 1024 * 1024, // 100MB
      ...options
    };
    
    // Statistics tracking
    this.stats = {
      templatesProcessed: 0,
      variablesReplaced: 0,
      formulasProcessed: 0,
      chartsUpdated: 0,
      pivotTablesProcessed: 0,
      worksheetsDuplicated: 0,
      conditionalsApplied: 0,
      namedRangesProcessed: 0,
      errorsEncountered: 0,
      processingTimeMs: 0
    };
    
    // Variable replacement patterns
    this.variablePatterns = {
      simple: /\{\{\s*([a-zA-Z_][a-zA-Z0-9_\.]*)\s*\}\}/g,
      conditional: /\{\{\s*if\s+([^}]+)\s*\}\}(.*?)\{\{\s*endif\s*\}\}/gs,
      loop: /\{\{\s*for\s+(\w+)\s+in\s+([^}]+)\s*\}\}(.*?)\{\{\s*endfor\s*\}\}/gs,
      filter: /\{\{\s*([^}]+?)\s*\|\s*([^}]+?)\s*\}\}/g
    };
    
    // Supported chart types mapping
    this.chartTypeMapping = {
      'line': 'line',
      'column': 'column',
      'bar': 'bar',
      'pie': 'pie',
      'scatter': 'scatter',
      'area': 'area',
      'doughnut': 'doughnut',
      'radar': 'radar'
    };
  }

  /**
   * Load and parse an Excel template file
   * 
   * @param {string} templatePath - Path to the Excel template file
   * @returns {Promise<ExcelJS.Workbook>} Loaded workbook instance
   * @throws {Error} If file cannot be loaded or is invalid
   */
  async loadTemplate(templatePath) {
    const startTime = performance.now();
    
    try {
      // Validate file path and existence
      await this.validateFile(templatePath);
      
      // Create workbook instance
      const workbook = new ExcelJS.Workbook();
      
      // Load the Excel file
      this.logger.info(`Loading Excel template: ${templatePath}`);
      await workbook.xlsx.readFile(templatePath);
      
      // Validate workbook structure
      await this.validateWorkbook(workbook);
      
      this.logger.info(`Template loaded successfully: ${workbook.worksheets.length} worksheets found`);
      return workbook;
      
    } catch (error) {
      this.stats.errorsEncountered++;
      this.logger.error(`Failed to load Excel template: ${error.message}`);
      throw new Error(`Excel template loading failed: ${error.message}`);
    } finally {
      this.stats.processingTimeMs += performance.now() - startTime;
    }
  }

  /**
   * Process template with provided data and return processed workbook
   * 
   * @param {ExcelJS.Workbook|string} template - Workbook instance or file path
   * @param {Object} data - Data object for variable replacement
   * @param {Object} [options={}] - Processing options
   * @param {string[]} [options.worksheetsToProcess] - Specific worksheets to process
   * @param {boolean} [options.duplicateWorksheets=false] - Whether to duplicate worksheets
   * @param {Object} [options.conditionalFormatting] - Conditional formatting rules
   * @param {Object} [options.chartDataSources] - Chart data source mappings
   * @returns {Promise<ExcelJS.Workbook>} Processed workbook
   */
  async processTemplate(template, data, options = {}) {
    const startTime = performance.now();
    
    try {
      // Load template if path string provided
      const workbook = typeof template === 'string' ? await this.loadTemplate(template) : template;
      
      // Process all worksheets or specific ones
      const worksheetsToProcess = options.worksheetsToProcess || 
        workbook.worksheets.map(ws => ws.name);
      
      this.logger.info(`Processing ${worksheetsToProcess.length} worksheets with template data`);
      
      // Process each worksheet
      for (const worksheetName of worksheetsToProcess) {
        const worksheet = workbook.getWorksheet(worksheetName);
        if (!worksheet) {
          this.logger.warn(`Worksheet '${worksheetName}' not found, skipping`);
          continue;
        }
        
        await this.processWorksheet(worksheet, data, options);
      }
      
      // Process named ranges
      await this.processNamedRanges(workbook, data);
      
      // Process charts if enabled
      if (this.options.enableCharts && options.chartDataSources) {
        await this.processCharts(workbook, data, options.chartDataSources);
      }
      
      // Process pivot tables if enabled  
      if (this.options.enablePivotTables) {
        await this.processPivotTables(workbook, data, options);
      }
      
      // Apply conditional formatting
      if (options.conditionalFormatting) {
        await this.applyConditionalFormatting(workbook, data, options.conditionalFormatting);
      }
      
      // Duplicate worksheets if requested
      if (options.duplicateWorksheets) {
        await this.duplicateWorksheets(workbook, data, options);
      }
      
      this.stats.templatesProcessed++;
      this.logger.info('Template processing completed successfully');
      
      return workbook;
      
    } catch (error) {
      this.stats.errorsEncountered++;
      this.logger.error(`Template processing failed: ${error.message}`);
      throw error;
    } finally {
      this.stats.processingTimeMs += performance.now() - startTime;
    }
  }

  /**
   * Process individual worksheet with data replacement
   * 
   * @private
   * @param {ExcelJS.Worksheet} worksheet - Worksheet to process
   * @param {Object} data - Data for replacement
   * @param {Object} options - Processing options
   */
  async processWorksheet(worksheet, data, options) {
    this.logger.debug(`Processing worksheet: ${worksheet.name}`);
    
    // Process all cells in the worksheet
    worksheet.eachRow((row, rowNumber) => {
      row.eachCell((cell, colNumber) => {
        this.processCell(cell, data, { worksheet, rowNumber, colNumber });
      });
    });
    
    // Process merged cells
    await this.processMergedCells(worksheet, data);
    
    // Process data tables if configured
    if (options.dataTables) {
      await this.processDataTables(worksheet, data, options.dataTables);
    }
    
    this.logger.debug(`Worksheet '${worksheet.name}' processing completed`);
  }

  /**
   * Process individual cell with variable replacement and formula handling
   * 
   * @private
   * @param {ExcelJS.Cell} cell - Cell to process
   * @param {Object} data - Replacement data
   * @param {Object} context - Processing context
   */
  processCell(cell, data, context) {
    try {
      // Process cell value
      if (cell.value !== null && cell.value !== undefined) {
        if (typeof cell.value === 'string') {
          const newValue = this.replaceVariables(cell.value, data, context);
          if (newValue !== cell.value) {
            cell.value = this.parseValueType(newValue);
            this.stats.variablesReplaced++;
          }
        }
        
        // Process hyperlinks
        if (cell.value && typeof cell.value === 'object' && cell.value.hyperlink) {
          const hyperlink = cell.value.hyperlink;
          if (typeof hyperlink === 'string') {
            cell.value.hyperlink = this.replaceVariables(hyperlink, data, context);
          }
        }
      }
      
      // Process formulas
      if (cell.formula && typeof cell.formula === 'string') {
        const newFormula = this.replaceVariables(cell.formula, data, context);
        if (newFormula !== cell.formula) {
          cell.formula = newFormula;
          this.stats.formulasProcessed++;
        }
      }
      
      // Process comments
      if (cell.note && typeof cell.note === 'string') {
        cell.note = this.replaceVariables(cell.note, data, context);
      }
      
    } catch (error) {
      this.logger.warn(`Error processing cell ${context.rowNumber},${context.colNumber}: ${error.message}`);
      this.stats.errorsEncountered++;
    }
  }

  /**
   * Replace variables in text using various patterns and filters
   * 
   * @private
   * @param {string} text - Text containing variables
   * @param {Object} data - Replacement data
   * @param {Object} context - Processing context
   * @returns {string} Text with variables replaced
   */
  replaceVariables(text, data, context) {
    let result = text;
    
    // Handle conditional statements
    result = result.replace(this.variablePatterns.conditional, (match, condition, content) => {
      if (this.evaluateCondition(condition, data)) {
        return this.replaceVariables(content, data, context);
      }
      return '';
    });
    
    // Handle loops
    result = result.replace(this.variablePatterns.loop, (match, itemVar, collectionExpr, content) => {
      const collection = this.getValueFromPath(data, collectionExpr.trim());
      if (Array.isArray(collection)) {
        return collection.map(item => {
          const loopData = { ...data, [itemVar]: item };
          return this.replaceVariables(content, loopData, context);
        }).join('');
      }
      return '';
    });
    
    // Handle filtered variables
    result = result.replace(this.variablePatterns.filter, (match, variable, filter) => {
      const value = this.getValueFromPath(data, variable.trim());
      return this.applyFilter(value, filter.trim());
    });
    
    // Handle simple variables
    result = result.replace(this.variablePatterns.simple, (match, variable) => {
      const value = this.getValueFromPath(data, variable);
      return value !== undefined ? String(value) : match;
    });
    
    return result;
  }

  /**
   * Process named ranges in workbook
   * 
   * @private
   * @param {ExcelJS.Workbook} workbook - Workbook to process
   * @param {Object} data - Replacement data
   */
  async processNamedRanges(workbook, data) {
    if (!workbook.definedNames) return;
    
    this.logger.debug('Processing named ranges');
    
    workbook.definedNames.each((name, value) => {
      if (typeof value === 'string' && this.containsVariables(value)) {
        const newValue = this.replaceVariables(value, data, { type: 'namedRange', name });
        workbook.definedNames.add(name, newValue);
        this.stats.namedRangesProcessed++;
      }
    });
  }

  /**
   * Process charts with dynamic data sources
   * 
   * @private
   * @param {ExcelJS.Workbook} workbook - Workbook containing charts
   * @param {Object} data - Chart data
   * @param {Object} chartDataSources - Chart data source mappings
   */
  async processCharts(workbook, data, chartDataSources) {
    this.logger.debug('Processing charts with dynamic data');
    
    // Note: ExcelJS has limited chart support for reading/writing
    // This is a conceptual implementation for chart data processing
    workbook.worksheets.forEach(worksheet => {
      if (worksheet.chartObjects) {
        worksheet.chartObjects.forEach(chart => {
          const chartId = chart.id || chart.name;
          if (chartDataSources[chartId]) {
            this.updateChartData(chart, data, chartDataSources[chartId]);
            this.stats.chartsUpdated++;
          }
        });
      }
    });
  }

  /**
   * Update chart data series with new data
   * 
   * @private
   * @param {Object} chart - Chart object
   * @param {Object} data - Data object
   * @param {Object} dataSource - Chart data source configuration
   */
  updateChartData(chart, data, dataSource) {
    try {
      // Update chart title if specified
      if (dataSource.title && this.containsVariables(dataSource.title)) {
        chart.title = this.replaceVariables(dataSource.title, data);
      }
      
      // Update data series
      if (dataSource.series && Array.isArray(dataSource.series)) {
        dataSource.series.forEach((seriesConfig, index) => {
          if (chart.series && chart.series[index]) {
            // Update series data ranges
            if (seriesConfig.xValues) {
              chart.series[index].xValues = this.replaceVariables(seriesConfig.xValues, data);
            }
            if (seriesConfig.yValues) {
              chart.series[index].yValues = this.replaceVariables(seriesConfig.yValues, data);
            }
            if (seriesConfig.name) {
              chart.series[index].name = this.replaceVariables(seriesConfig.name, data);
            }
          }
        });
      }
      
    } catch (error) {
      this.logger.warn(`Error updating chart data: ${error.message}`);
      this.stats.errorsEncountered++;
    }
  }

  /**
   * Process pivot tables in workbook
   * 
   * @private
   * @param {ExcelJS.Workbook} workbook - Workbook to process
   * @param {Object} data - Data for pivot tables
   * @param {Object} options - Processing options
   */
  async processPivotTables(workbook, data, options) {
    this.logger.debug('Processing pivot tables');
    
    // Note: ExcelJS has limited pivot table support
    // This is a conceptual implementation
    workbook.worksheets.forEach(worksheet => {
      if (worksheet.pivotTables) {
        worksheet.pivotTables.forEach(pivotTable => {
          this.updatePivotTable(pivotTable, data, options);
          this.stats.pivotTablesProcessed++;
        });
      }
    });
  }

  /**
   * Update pivot table data source and configuration
   * 
   * @private
   * @param {Object} pivotTable - Pivot table object
   * @param {Object} data - Data object
   * @param {Object} options - Processing options
   */
  updatePivotTable(pivotTable, data, options) {
    try {
      // Update data source range
      if (pivotTable.sourceRange && this.containsVariables(pivotTable.sourceRange)) {
        pivotTable.sourceRange = this.replaceVariables(pivotTable.sourceRange, data);
      }
      
      // Update field configurations
      if (pivotTable.fields) {
        pivotTable.fields.forEach(field => {
          if (field.name && this.containsVariables(field.name)) {
            field.name = this.replaceVariables(field.name, data);
          }
        });
      }
      
    } catch (error) {
      this.logger.warn(`Error updating pivot table: ${error.message}`);
      this.stats.errorsEncountered++;
    }
  }

  /**
   * Apply conditional formatting based on data values
   * 
   * @private
   * @param {ExcelJS.Workbook} workbook - Workbook to apply formatting
   * @param {Object} data - Data for condition evaluation
   * @param {Object} formattingRules - Conditional formatting rules
   */
  async applyConditionalFormatting(workbook, data, formattingRules) {
    this.logger.debug('Applying conditional formatting');
    
    for (const rule of formattingRules) {
      const worksheet = workbook.getWorksheet(rule.worksheet);
      if (!worksheet) continue;
      
      try {
        // Add conditional formatting rule
        worksheet.addConditionalFormatting({
          ref: rule.range,
          rules: [{
            type: rule.type || 'cellIs',
            operator: rule.operator || 'greaterThan',
            formula: [this.replaceVariables(rule.formula, data)],
            style: this.parseFormattingStyle(rule.style)
          }]
        });
        
        this.stats.conditionalsApplied++;
        
      } catch (error) {
        this.logger.warn(`Error applying conditional formatting: ${error.message}`);
        this.stats.errorsEncountered++;
      }
    }
  }

  /**
   * Duplicate worksheets with different data sets
   * 
   * @private
   * @param {ExcelJS.Workbook} workbook - Workbook to modify
   * @param {Object} data - Base data object
   * @param {Object} options - Duplication options
   */
  async duplicateWorksheets(workbook, data, options) {
    if (!options.duplicateWorksheets || !Array.isArray(options.duplicateWorksheets)) {
      return;
    }
    
    this.logger.debug('Duplicating worksheets');
    
    for (const duplicationRule of options.duplicateWorksheets) {
      const sourceWorksheet = workbook.getWorksheet(duplicationRule.source);
      if (!sourceWorksheet) continue;
      
      try {
        // Get data collection for duplication
        const dataCollection = this.getValueFromPath(data, duplicationRule.dataPath);
        if (!Array.isArray(dataCollection)) continue;
        
        // Create duplicate worksheets
        for (let i = 0; i < dataCollection.length; i++) {
          const itemData = { ...data, ...dataCollection[i] };
          const newWorksheetName = this.replaceVariables(
            duplicationRule.nameTemplate || `${duplicationRule.source}_${i + 1}`,
            itemData
          );
          
          // Clone worksheet
          const newWorksheet = workbook.addWorksheet(newWorksheetName);
          this.copyWorksheetContent(sourceWorksheet, newWorksheet);
          
          // Process the new worksheet with item-specific data
          await this.processWorksheet(newWorksheet, itemData, options);
          
          this.stats.worksheetsDuplicated++;
        }
        
      } catch (error) {
        this.logger.warn(`Error duplicating worksheet: ${error.message}`);
        this.stats.errorsEncountered++;
      }
    }
  }

  /**
   * Copy content from source worksheet to target worksheet
   * 
   * @private
   * @param {ExcelJS.Worksheet} source - Source worksheet
   * @param {ExcelJS.Worksheet} target - Target worksheet
   */
  copyWorksheetContent(source, target) {
    // Copy column definitions
    source.columns.forEach((col, index) => {
      target.getColumn(index + 1).width = col.width;
    });
    
    // Copy row data and formatting
    source.eachRow((row, rowNumber) => {
      const targetRow = target.getRow(rowNumber);
      targetRow.height = row.height;
      
      row.eachCell((cell, colNumber) => {
        const targetCell = targetRow.getCell(colNumber);
        
        // Copy value and formula
        targetCell.value = cell.value;
        if (cell.formula) {
          targetCell.formula = cell.formula;
        }
        
        // Copy formatting if preservation is enabled
        if (this.options.preserveFormatting) {
          targetCell.style = { ...cell.style };
        }
        
        // Copy comments
        if (cell.note) {
          targetCell.note = cell.note;
        }
      });
    });
    
    // Copy merged cells
    source.mergedCells.forEach(range => {
      target.mergeCells(range);
    });
  }

  /**
   * Process data tables within worksheets
   * 
   * @private
   * @param {ExcelJS.Worksheet} worksheet - Worksheet to process
   * @param {Object} data - Data object
   * @param {Array} dataTables - Data table configurations
   */
  async processDataTables(worksheet, data, dataTables) {
    for (const tableConfig of dataTables) {
      const tableData = this.getValueFromPath(data, tableConfig.dataPath);
      if (!Array.isArray(tableData)) continue;
      
      try {
        await this.populateTable(worksheet, tableConfig, tableData);
      } catch (error) {
        this.logger.warn(`Error processing data table: ${error.message}`);
        this.stats.errorsEncountered++;
      }
    }
  }

  /**
   * Populate table data in worksheet at specified location
   * 
   * @private
   * @param {ExcelJS.Worksheet} worksheet - Target worksheet
   * @param {Object} tableConfig - Table configuration
   * @param {Array} tableData - Data to populate
   */
  async populateTable(worksheet, tableConfig, tableData) {
    const startRow = tableConfig.startRow || 1;
    const startCol = tableConfig.startCol || 1;
    const headers = tableConfig.headers || [];
    
    // Add headers if specified
    if (headers.length > 0) {
      headers.forEach((header, index) => {
        const cell = worksheet.getCell(startRow, startCol + index);
        cell.value = header;
        if (tableConfig.headerStyle) {
          cell.style = this.parseFormattingStyle(tableConfig.headerStyle);
        }
      });
    }
    
    // Add data rows
    tableData.forEach((row, rowIndex) => {
      const currentRow = startRow + (headers.length > 0 ? 1 : 0) + rowIndex;
      
      if (Array.isArray(row)) {
        // Row is already an array
        row.forEach((cellValue, colIndex) => {
          const cell = worksheet.getCell(currentRow, startCol + colIndex);
          cell.value = this.parseValueType(cellValue);
        });
      } else if (typeof row === 'object') {
        // Row is an object, use headers or keys
        const keys = headers.length > 0 ? headers : Object.keys(row);
        keys.forEach((key, colIndex) => {
          const cell = worksheet.getCell(currentRow, startCol + colIndex);
          cell.value = this.parseValueType(row[key]);
        });
      }
    });
    
    // Apply table styling if specified
    if (tableConfig.tableStyle) {
      const endRow = startRow + (headers.length > 0 ? 1 : 0) + tableData.length - 1;
      const endCol = startCol + Math.max(headers.length, 
        Math.max(...tableData.map(row => Array.isArray(row) ? row.length : Object.keys(row).length))) - 1;
      
      const tableRange = `${this.getCellAddress(startRow, startCol)}:${this.getCellAddress(endRow, endCol)}`;
      this.applyTableStyle(worksheet, tableRange, tableConfig.tableStyle);
    }
  }

  /**
   * Process merged cells with variable replacement
   * 
   * @private
   * @param {ExcelJS.Worksheet} worksheet - Worksheet to process
   * @param {Object} data - Replacement data
   */
  async processMergedCells(worksheet, data) {
    // Process merged cell ranges
    worksheet.mergedCells.forEach(range => {
      const topLeftCell = worksheet.getCell(range.split(':')[0]);
      if (topLeftCell.value && typeof topLeftCell.value === 'string') {
        topLeftCell.value = this.replaceVariables(topLeftCell.value, data);
      }
    });
  }

  /**
   * Batch process multiple Excel files
   * 
   * @param {string[]} templatePaths - Array of template file paths
   * @param {Object|Object[]} data - Data for processing (single object or array matching templates)
   * @param {Object} [options={}] - Processing options
   * @param {string} [options.outputDir] - Directory for output files
   * @param {string} [options.outputNameTemplate] - Template for output filenames
   * @param {boolean} [options.parallel=false] - Process files in parallel
   * @returns {Promise<string[]>} Array of output file paths
   */
  async batchProcess(templatePaths, data, options = {}) {
    const startTime = performance.now();
    
    try {
      this.logger.info(`Starting batch processing of ${templatePaths.length} Excel files`);
      
      const dataArray = Array.isArray(data) ? data : new Array(templatePaths.length).fill(data);
      const outputPaths = [];
      
      if (options.parallel) {
        // Process files in parallel
        const promises = templatePaths.map((templatePath, index) =>
          this.processAndSave(templatePath, dataArray[index] || data, options, index)
        );
        
        const results = await Promise.allSettled(promises);
        results.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            outputPaths.push(result.value);
          } else {
            this.logger.error(`Failed to process file ${templatePaths[index]}: ${result.reason}`);
            this.stats.errorsEncountered++;
          }
        });
        
      } else {
        // Process files sequentially
        for (let i = 0; i < templatePaths.length; i++) {
          try {
            const outputPath = await this.processAndSave(
              templatePaths[i], 
              dataArray[i] || data, 
              options, 
              i
            );
            outputPaths.push(outputPath);
          } catch (error) {
            this.logger.error(`Failed to process file ${templatePaths[i]}: ${error.message}`);
            this.stats.errorsEncountered++;
          }
        }
      }
      
      this.logger.info(`Batch processing completed: ${outputPaths.length} files processed successfully`);
      return outputPaths;
      
    } catch (error) {
      this.logger.error(`Batch processing failed: ${error.message}`);
      throw error;
    } finally {
      this.stats.processingTimeMs += performance.now() - startTime;
    }
  }

  /**
   * Process single file and save to output
   * 
   * @private
   * @param {string} templatePath - Template file path
   * @param {Object} data - Processing data
   * @param {Object} options - Processing options
   * @param {number} index - File index for naming
   * @returns {Promise<string>} Output file path
   */
  async processAndSave(templatePath, data, options, index) {
    const workbook = await this.processTemplate(templatePath, data, options);
    
    // Generate output path
    const outputPath = this.generateOutputPath(templatePath, data, options, index);
    
    // Save processed workbook
    await this.saveWorkbook(workbook, outputPath);
    
    return outputPath;
  }

  /**
   * Generate output file path based on options and data
   * 
   * @private
   * @param {string} templatePath - Original template path
   * @param {Object} data - Processing data
   * @param {Object} options - Processing options
   * @param {number} index - File index
   * @returns {string} Generated output path
   */
  generateOutputPath(templatePath, data, options, index) {
    const dir = options.outputDir || path.dirname(templatePath);
    const ext = path.extname(templatePath);
    const baseName = path.basename(templatePath, ext);
    
    let fileName;
    if (options.outputNameTemplate) {
      fileName = this.replaceVariables(options.outputNameTemplate, { 
        ...data, 
        originalName: baseName, 
        index: index + 1 
      });
    } else {
      fileName = `${baseName}_processed_${this.getDeterministicTimestamp()}`;
    }
    
    return path.join(dir, fileName + ext);
  }

  /**
   * Save workbook to file
   * 
   * @param {ExcelJS.Workbook} workbook - Workbook to save
   * @param {string} outputPath - Output file path
   * @returns {Promise<void>}
   */
  async saveWorkbook(workbook, outputPath) {
    try {
      // Ensure output directory exists
      const outputDir = path.dirname(outputPath);
      await fs.mkdir(outputDir, { recursive: true });
      
      // Save workbook
      await workbook.xlsx.writeFile(outputPath);
      
      this.logger.info(`Excel file saved: ${outputPath}`);
      
    } catch (error) {
      this.logger.error(`Failed to save Excel file: ${error.message}`);
      throw error;
    }
  }

  /**
   * Validate Excel file before processing
   * 
   * @private
   * @param {string} filePath - File path to validate
   * @throws {Error} If validation fails
   */
  async validateFile(filePath) {
    // Check file existence
    try {
      await fs.access(filePath, fs.constants.R_OK);
    } catch (error) {
      throw new Error(`File not accessible: ${filePath}`);
    }
    
    // Check file size
    const stats = await fs.stat(filePath);
    if (stats.size > this.options.maxFileSize) {
      throw new Error(`File too large: ${stats.size} bytes (max: ${this.options.maxFileSize})`);
    }
    
    // Check file extension
    const ext = path.extname(filePath).toLowerCase();
    if (!['.xlsx', '.xlsm'].includes(ext)) {
      throw new Error(`Unsupported file type: ${ext}`);
    }
  }

  /**
   * Validate workbook structure
   * 
   * @private
   * @param {ExcelJS.Workbook} workbook - Workbook to validate
   * @throws {Error} If validation fails
   */
  async validateWorkbook(workbook) {
    if (!workbook.worksheets || workbook.worksheets.length === 0) {
      throw new Error('Workbook contains no worksheets');
    }
    
    // Check for circular references in formulas if validation enabled
    if (this.options.validateFormulas) {
      await this.validateFormulas(workbook);
    }
  }

  /**
   * Validate formulas in workbook
   * 
   * @private
   * @param {ExcelJS.Workbook} workbook - Workbook to validate
   */
  async validateFormulas(workbook) {
    const formulaCells = [];
    
    workbook.worksheets.forEach(worksheet => {
      worksheet.eachRow((row, rowNumber) => {
        row.eachCell((cell, colNumber) => {
          if (cell.formula) {
            formulaCells.push({
              worksheet: worksheet.name,
              address: cell.address,
              formula: cell.formula
            });
          }
        });
      });
    });
    
    // Basic formula validation (could be enhanced)
    for (const formulaCell of formulaCells) {
      if (this.hasCircularReference(formulaCell.formula, formulaCell.address)) {
        this.logger.warn(`Potential circular reference detected in ${formulaCell.address}: ${formulaCell.formula}`);
      }
    }
  }

  // Helper methods

  /**
   * Check if text contains template variables
   * 
   * @private
   * @param {string} text - Text to check
   * @returns {boolean} True if contains variables
   */
  containsVariables(text) {
    return this.variablePatterns.simple.test(text) ||
           this.variablePatterns.conditional.test(text) ||
           this.variablePatterns.loop.test(text) ||
           this.variablePatterns.filter.test(text);
  }

  /**
   * Get value from object using dot notation path
   * 
   * @private
   * @param {Object} obj - Source object
   * @param {string} path - Dot notation path
   * @returns {*} Retrieved value
   */
  getValueFromPath(obj, path) {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }

  /**
   * Parse value to appropriate type
   * 
   * @private
   * @param {*} value - Value to parse
   * @returns {*} Parsed value
   */
  parseValueType(value) {
    if (value === null || value === undefined) return value;
    
    if (typeof value === 'string') {
      // Try to parse as number
      if (/^\d+\.?\d*$/.test(value)) {
        const num = parseFloat(value);
        return isNaN(num) ? value : num;
      }
      
      // Try to parse as boolean
      if (value.toLowerCase() === 'true') return true;
      if (value.toLowerCase() === 'false') return false;
      
      // Try to parse as date
      const date = new Date(value);
      if (!isNaN(date.getTime()) && value.match(/\d{4}-\d{2}-\d{2}/)) {
        return date;
      }
    }
    
    return value;
  }

  /**
   * Evaluate conditional expression
   * 
   * @private
   * @param {string} condition - Condition to evaluate
   * @param {Object} data - Data context
   * @returns {boolean} Condition result
   */
  evaluateCondition(condition, data) {
    try {
      // Simple condition evaluation (could be enhanced)
      const cleanCondition = condition.replace(/\{\{|\}\}/g, '');
      
      // Replace variables in condition
      const processedCondition = this.replaceVariables(`{{${cleanCondition}}}`, data);
      
      // Basic evaluation (extend as needed)
      if (processedCondition.includes('==')) {
        const [left, right] = processedCondition.split('==').map(s => s.trim());
        return left === right;
      }
      if (processedCondition.includes('!=')) {
        const [left, right] = processedCondition.split('!=').map(s => s.trim());
        return left !== right;
      }
      
      return Boolean(this.getValueFromPath(data, cleanCondition.trim()));
      
    } catch (error) {
      this.logger.warn(`Error evaluating condition '${condition}': ${error.message}`);
      return false;
    }
  }

  /**
   * Apply filter to value
   * 
   * @private
   * @param {*} value - Value to filter
   * @param {string} filter - Filter name
   * @returns {*} Filtered value
   */
  applyFilter(value, filter) {
    switch (filter.toLowerCase()) {
      case 'upper':
        return String(value).toUpperCase();
      case 'lower':
        return String(value).toLowerCase();
      case 'capitalize':
        return String(value).charAt(0).toUpperCase() + String(value).slice(1).toLowerCase();
      case 'currency':
        return new Intl.NumberFormat('en-US', { 
          style: 'currency', 
          currency: 'USD' 
        }).format(Number(value) || 0);
      case 'date':
        return new Date(value).toLocaleDateString();
      case 'datetime':
        return new Date(value).toLocaleString();
      default:
        return value;
    }
  }

  /**
   * Parse formatting style object
   * 
   * @private
   * @param {Object} style - Style configuration
   * @returns {Object} ExcelJS style object
   */
  parseFormattingStyle(style) {
    const excelStyle = {};
    
    if (style.font) {
      excelStyle.font = {
        name: style.font.name || 'Arial',
        size: style.font.size || 11,
        bold: style.font.bold || false,
        italic: style.font.italic || false,
        underline: style.font.underline || false,
        color: style.font.color ? { argb: style.font.color } : undefined
      };
    }
    
    if (style.fill) {
      excelStyle.fill = {
        type: 'pattern',
        pattern: style.fill.pattern || 'solid',
        fgColor: style.fill.fgColor ? { argb: style.fill.fgColor } : undefined,
        bgColor: style.fill.bgColor ? { argb: style.fill.bgColor } : undefined
      };
    }
    
    if (style.border) {
      excelStyle.border = {
        top: style.border.top ? { style: style.border.top.style || 'thin' } : undefined,
        left: style.border.left ? { style: style.border.left.style || 'thin' } : undefined,
        bottom: style.border.bottom ? { style: style.border.bottom.style || 'thin' } : undefined,
        right: style.border.right ? { style: style.border.right.style || 'thin' } : undefined
      };
    }
    
    if (style.alignment) {
      excelStyle.alignment = {
        horizontal: style.alignment.horizontal || 'left',
        vertical: style.alignment.vertical || 'top',
        wrapText: style.alignment.wrapText || false,
        indent: style.alignment.indent || 0
      };
    }
    
    return excelStyle;
  }

  /**
   * Apply table style to range
   * 
   * @private
   * @param {ExcelJS.Worksheet} worksheet - Worksheet
   * @param {string} range - Cell range
   * @param {Object} tableStyle - Style configuration
   */
  applyTableStyle(worksheet, range, tableStyle) {
    try {
      const parsedStyle = this.parseFormattingStyle(tableStyle);
      
      // Apply style to range
      const cells = worksheet.getRange(range);
      cells.forEach(row => {
        row.forEach(cell => {
          cell.style = parsedStyle;
        });
      });
      
    } catch (error) {
      this.logger.warn(`Error applying table style: ${error.message}`);
    }
  }

  /**
   * Get cell address from row and column numbers
   * 
   * @private
   * @param {number} row - Row number (1-based)
   * @param {number} col - Column number (1-based)
   * @returns {string} Cell address (e.g., 'A1')
   */
  getCellAddress(row, col) {
    let columnName = '';
    let columnNumber = col - 1;
    
    while (columnNumber >= 0) {
      columnName = String.fromCharCode(65 + (columnNumber % 26)) + columnName;
      columnNumber = Math.floor(columnNumber / 26) - 1;
    }
    
    return `${columnName}${row}`;
  }

  /**
   * Check for potential circular references
   * 
   * @private
   * @param {string} formula - Formula to check
   * @param {string} cellAddress - Cell address containing formula
   * @returns {boolean} True if potential circular reference detected
   */
  hasCircularReference(formula, cellAddress) {
    // Basic circular reference detection
    return formula.includes(cellAddress);
  }

  /**
   * Get processing statistics
   * 
   * @returns {Object} Processing statistics
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * Reset statistics counters
   */
  resetStats() {
    Object.keys(this.stats).forEach(key => {
      this.stats[key] = 0;
    });
  }

  /**
   * Get supported file extensions
   * 
   * @returns {string[]} Array of supported extensions
   */
  getSupportedExtensions() {
    return ['.xlsx', '.xlsm'];
  }

  /**
   * Validate template structure and content
   * 
   * @param {string} templatePath - Path to template file
   * @returns {Promise<Object>} Validation result
   */
  async validateTemplate(templatePath) {
    const errors = [];
    const warnings = [];
    
    try {
      const workbook = await this.loadTemplate(templatePath);
      
      // Check worksheets
      if (workbook.worksheets.length === 0) {
        errors.push('No worksheets found in template');
      }
      
      // Check for variables
      let variableCount = 0;
      workbook.worksheets.forEach(worksheet => {
        worksheet.eachRow((row) => {
          row.eachCell((cell) => {
            if (cell.value && typeof cell.value === 'string' && this.containsVariables(cell.value)) {
              variableCount++;
            }
          });
        });
      });
      
      if (variableCount === 0) {
        warnings.push('No template variables found in template');
      }
      
      return {
        valid: errors.length === 0,
        errors,
        warnings,
        info: {
          worksheetCount: workbook.worksheets.length,
          variableCount
        }
      };
      
    } catch (error) {
      return {
        valid: false,
        errors: [`Template validation failed: ${error.message}`],
        warnings: []
      };
    }
  }
}

// Export default instance for convenience
export default ExcelProcessor;