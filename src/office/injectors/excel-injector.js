import ExcelJS from 'exceljs';
import fs from 'fs-extra';
import path from 'path';
import consola from 'consola';

/**
 * Excel workbook content injector
 * Handles content injection into Excel files at cells, ranges, and named locations
 * @class ExcelInjector
 */
export class ExcelInjector {
  /**
   * Creates an instance of ExcelInjector
   * @param {Object} options - Configuration options
   * @param {boolean} options.preserveFormatting - Whether to preserve original formatting
   * @param {boolean} options.dryRun - Whether to run in dry-run mode
   */
  constructor(options = {}) {
    this.options = {
      preserveFormatting: true,
      dryRun: false,
      ...options
    };
    
    this.logger = consola.create({ tag: 'ExcelInjector' });
    this.processedFiles = 0;
    this.stats = {
      attempted: 0,
      successful: 0,
      failed: 0,
      skipped: 0
    };
  }

  /**
   * Injects content into an Excel workbook
   * @param {Object} config - Injection configuration
   * @param {string} config.filePath - Path to the Excel file
   * @param {Array<Object>} config.injections - Array of injection specifications
   * @param {string} config.outputPath - Output file path
   * @param {boolean} config.dryRun - Whether to run in dry-run mode
   * @returns {Promise<Object>} - Injection results
   */
  async inject(config) {
    const { filePath, injections, outputPath, dryRun = this.options.dryRun } = config;
    
    const results = {
      injections: [],
      skipped: [],
      errors: []
    };

    try {
      // Load the workbook
      const workbook = new ExcelJS.Workbook();
      
      if (await fs.pathExists(filePath)) {
        const stats = await fs.stat(filePath);
        if (stats.size > 0) {
          // Only try to read non-empty files
          try {
            await workbook.xlsx.readFile(filePath);
            this.logger.info(`Loaded existing Excel file: ${path.basename(filePath)}`);
          } catch (error) {
            // If file is corrupted or not a valid Excel file, create new workbook
            this.logger.warn(`Could not read existing file, creating new workbook: ${error.message}`);
            workbook.addWorksheet('Sheet1');
          }
        } else {
          // Empty file - create new workbook
          workbook.addWorksheet('Sheet1');
          this.logger.info(`File is empty, created new Excel workbook: ${path.basename(filePath)}`);
        }
      } else {
        // Create new workbook with default worksheet
        workbook.addWorksheet('Sheet1');
        this.logger.info(`Created new Excel workbook: ${path.basename(filePath)}`);
      }
      
      this.logger.info(`Processing ${injections.length} injections for ${path.basename(filePath)}`);

      // Process each injection
      for (const injection of injections) {
        this.stats.attempted++;
        
        try {
          // Check skipIf condition
          if (await this.shouldSkipInjection(injection, workbook)) {
            this.logger.debug(`Skipping injection ${injection.id || 'unnamed'} due to skipIf condition`);
            results.skipped.push({
              injection: injection.id || 'unnamed',
              reason: 'skipIf condition met',
              target: injection.target
            });
            this.stats.skipped++;
            continue;
          }

          // Perform the injection based on target type
          const injectionResult = await this.performInjection(workbook, injection);
          
          if (injectionResult.success) {
            results.injections.push({
              injection: injection.id || 'unnamed',
              target: injection.target,
              mode: injection.mode,
              content: injection.content,
              result: injectionResult
            });
            this.stats.successful++;
          } else {
            results.errors.push({
              injection: injection.id || 'unnamed',
              target: injection.target,
              error: injectionResult.error
            });
            this.stats.failed++;
          }
        } catch (error) {
          this.logger.error(`Error processing injection ${injection.id || 'unnamed'}: ${error.message}`);
          results.errors.push({
            injection: injection.id || 'unnamed',
            target: injection.target,
            error: error.message
          });
          this.stats.failed++;
        }
      }

      // Save the workbook if not in dry-run mode
      if (!dryRun && results.injections.length > 0) {
        await workbook.xlsx.writeFile(outputPath);
        this.processedFiles++;
        this.logger.success(`Saved workbook with ${results.injections.length} injections to ${path.basename(outputPath)}`);
      } else if (dryRun) {
        this.logger.info(`Dry run: Would have saved ${results.injections.length} injections to ${path.basename(outputPath)}`);
      }

      return results;
      
    } catch (error) {
      this.logger.error(`Failed to process Excel workbook ${path.basename(filePath)}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Performs the actual content injection
   * @private
   * @param {Object} workbook - ExcelJS workbook object
   * @param {Object} injection - Injection specification
   * @returns {Promise<Object>} - Injection result
   */
  async performInjection(workbook, injection) {
    const { target, content, mode, type, formatting } = injection;
    
    try {
      const targetType = this.getTargetType(target);
      
      switch (targetType) {
        case 'cell':
          return await this.injectAtCell(workbook, target, content, mode, formatting);
        case 'range':
          return await this.injectAtRange(workbook, target, content, mode, formatting);
        case 'namedRange':
          return await this.injectAtNamedRange(workbook, target, content, mode, formatting);
        case 'column':
          return await this.injectAtColumn(workbook, target, content, mode, formatting);
        case 'row':
          return await this.injectAtRow(workbook, target, content, mode, formatting);
        case 'worksheet':
          return await this.injectAtWorksheet(workbook, target, content, mode, formatting);
        default:
          throw new Error(`Unknown target type: ${targetType} for target: ${target}`);
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
        target,
        mode
      };
    }
  }

  /**
   * Injects content at a specific cell
   * @private
   * @param {Object} workbook - ExcelJS workbook
   * @param {string} target - Cell reference (e.g., "Sheet1:A1" or "A1")
   * @param {*} content - Content to inject
   * @param {string} mode - Injection mode
   * @param {Object} formatting - Formatting options
   * @returns {Promise<Object>} - Injection result
   */
  async injectAtCell(workbook, target, content, mode, formatting) {
    const { worksheetName, cellRef } = this.parseCellTarget(target);
    
    // Get or create worksheet
    let worksheet = workbook.getWorksheet(worksheetName);
    if (!worksheet) {
      worksheet = workbook.addWorksheet(worksheetName);
      this.logger.debug(`Created new worksheet: ${worksheetName}`);
    }

    const cell = worksheet.getCell(cellRef);
    const originalValue = cell.value;

    // Apply injection based on mode
    switch (mode) {
      case 'replace':
        cell.value = content;
        break;
      case 'append':
        cell.value = (originalValue || '') + content;
        break;
      case 'prepend':
        cell.value = content + (originalValue || '');
        break;
      case 'before':
      case 'after':
        // For cells, before/after behaves like prepend/append
        cell.value = mode === 'before' 
          ? content + (originalValue || '')
          : (originalValue || '') + content;
        break;
      default:
        cell.value = content;
    }

    // Apply formatting if provided
    if (formatting && this.options.preserveFormatting) {
      this.applyCellFormatting(cell, formatting);
    }

    return {
      success: true,
      target: `${worksheetName}:${cellRef}`,
      mode,
      location: 'cell',
      originalValue,
      newValue: cell.value,
      injectedContent: content
    };
  }

  /**
   * Injects content into a range of cells
   * @private
   * @param {Object} workbook - ExcelJS workbook
   * @param {string} target - Range reference (e.g., "Sheet1:A1:C3")
   * @param {*} content - Content to inject (array for multiple cells)
   * @param {string} mode - Injection mode
   * @param {Object} formatting - Formatting options
   * @returns {Promise<Object>} - Injection result
   */
  async injectAtRange(workbook, target, content, mode, formatting) {
    const { worksheetName, rangeRef } = this.parseRangeTarget(target);
    
    let worksheet = workbook.getWorksheet(worksheetName);
    if (!worksheet) {
      worksheet = workbook.addWorksheet(worksheetName);
    }

    // Get the range
    const range = worksheet.getCell(rangeRef);
    const cellsModified = [];

    // Handle different content types
    if (Array.isArray(content)) {
      // Content is a 2D array
      const startCell = worksheet.getCell(rangeRef.split(':')[0]);
      const startRow = startCell.row;
      const startCol = startCell.col;

      for (let rowIndex = 0; rowIndex < content.length; rowIndex++) {
        const rowData = content[rowIndex];
        if (Array.isArray(rowData)) {
          for (let colIndex = 0; colIndex < rowData.length; colIndex++) {
            const cell = worksheet.getCell(startRow + rowIndex, startCol + colIndex);
            const originalValue = cell.value;
            
            // Apply injection mode
            cell.value = this.applyInjectionMode(originalValue, rowData[colIndex], mode);
            
            // Apply formatting
            if (formatting && this.options.preserveFormatting) {
              this.applyCellFormatting(cell, formatting);
            }
            
            cellsModified.push({
              cell: cell.address,
              originalValue,
              newValue: cell.value
            });
          }
        }
      }
    } else {
      // Single value for entire range
      worksheet.eachRow((row, rowNumber) => {
        row.eachCell((cell, colNumber) => {
          if (this.cellInRange(cell.address, rangeRef)) {
            const originalValue = cell.value;
            cell.value = this.applyInjectionMode(originalValue, content, mode);
            
            if (formatting && this.options.preserveFormatting) {
              this.applyCellFormatting(cell, formatting);
            }
            
            cellsModified.push({
              cell: cell.address,
              originalValue,
              newValue: cell.value
            });
          }
        });
      });
    }

    return {
      success: true,
      target: `${worksheetName}:${rangeRef}`,
      mode,
      location: 'range',
      cellsModified,
      injectedContent: content
    };
  }

  /**
   * Injects content at a named range
   * @private
   * @param {Object} workbook - ExcelJS workbook
   * @param {string} target - Named range reference
   * @param {*} content - Content to inject
   * @param {string} mode - Injection mode
   * @param {Object} formatting - Formatting options
   * @returns {Promise<Object>} - Injection result
   */
  async injectAtNamedRange(workbook, target, content, mode, formatting) {
    const rangeName = target.replace('namedRange:', '');
    
    // Find the named range
    const definedNames = workbook.definedNames;
    const namedRange = definedNames.getModel(rangeName);
    
    if (!namedRange) {
      throw new Error(`Named range '${rangeName}' not found`);
    }

    // Extract worksheet and range from the named range
    const { worksheetName, rangeRef } = this.parseNamedRange(namedRange);
    
    // Delegate to range injection
    return await this.injectAtRange(workbook, `${worksheetName}:${rangeRef}`, content, mode, formatting);
  }

  /**
   * Injects content into an entire column
   * @private
   * @param {Object} workbook - ExcelJS workbook
   * @param {string} target - Column reference (e.g., "Sheet1:A" or "A")
   * @param {*} content - Content to inject
   * @param {string} mode - Injection mode
   * @param {Object} formatting - Formatting options
   * @returns {Promise<Object>} - Injection result
   */
  async injectAtColumn(workbook, target, content, mode, formatting) {
    const { worksheetName, columnRef } = this.parseColumnTarget(target);
    
    let worksheet = workbook.getWorksheet(worksheetName);
    if (!worksheet) {
      worksheet = workbook.addWorksheet(worksheetName);
    }

    const column = worksheet.getColumn(columnRef);
    const cellsModified = [];

    if (Array.isArray(content)) {
      // Inject array values into column cells
      content.forEach((value, index) => {
        const cell = worksheet.getCell(index + 1, column.number);
        const originalValue = cell.value;
        cell.value = this.applyInjectionMode(originalValue, value, mode);
        
        if (formatting && this.options.preserveFormatting) {
          this.applyCellFormatting(cell, formatting);
        }
        
        cellsModified.push({
          cell: cell.address,
          originalValue,
          newValue: cell.value
        });
      });
    } else {
      // Single value for all non-empty cells in column
      column.eachCell((cell) => {
        const originalValue = cell.value;
        cell.value = this.applyInjectionMode(originalValue, content, mode);
        
        if (formatting && this.options.preserveFormatting) {
          this.applyCellFormatting(cell, formatting);
        }
        
        cellsModified.push({
          cell: cell.address,
          originalValue,
          newValue: cell.value
        });
      });
    }

    return {
      success: true,
      target: `${worksheetName}:${columnRef}`,
      mode,
      location: 'column',
      cellsModified,
      injectedContent: content
    };
  }

  /**
   * Injects content into an entire row
   * @private
   * @param {Object} workbook - ExcelJS workbook
   * @param {string} target - Row reference (e.g., "Sheet1:1" or "1")
   * @param {*} content - Content to inject
   * @param {string} mode - Injection mode
   * @param {Object} formatting - Formatting options
   * @returns {Promise<Object>} - Injection result
   */
  async injectAtRow(workbook, target, content, mode, formatting) {
    const { worksheetName, rowNumber } = this.parseRowTarget(target);
    
    let worksheet = workbook.getWorksheet(worksheetName);
    if (!worksheet) {
      worksheet = workbook.addWorksheet(worksheetName);
    }

    const row = worksheet.getRow(rowNumber);
    const cellsModified = [];

    if (Array.isArray(content)) {
      // Inject array values into row cells
      content.forEach((value, index) => {
        const cell = row.getCell(index + 1);
        const originalValue = cell.value;
        cell.value = this.applyInjectionMode(originalValue, value, mode);
        
        if (formatting && this.options.preserveFormatting) {
          this.applyCellFormatting(cell, formatting);
        }
        
        cellsModified.push({
          cell: cell.address,
          originalValue,
          newValue: cell.value
        });
      });
    } else {
      // Single value for all non-empty cells in row
      row.eachCell((cell) => {
        const originalValue = cell.value;
        cell.value = this.applyInjectionMode(originalValue, content, mode);
        
        if (formatting && this.options.preserveFormatting) {
          this.applyCellFormatting(cell, formatting);
        }
        
        cellsModified.push({
          cell: cell.address,
          originalValue,
          newValue: cell.value
        });
      });
    }

    return {
      success: true,
      target: `${worksheetName}:${rowNumber}`,
      mode,
      location: 'row',
      cellsModified,
      injectedContent: content
    };
  }

  /**
   * Injects content into worksheet (adds new rows/data)
   * @private
   * @param {Object} workbook - ExcelJS workbook
   * @param {string} target - Worksheet name
   * @param {*} content - Content to inject
   * @param {string} mode - Injection mode
   * @param {Object} formatting - Formatting options
   * @returns {Promise<Object>} - Injection result
   */
  async injectAtWorksheet(workbook, target, content, mode, formatting) {
    const worksheetName = target.replace('worksheet:', '');
    
    let worksheet = workbook.getWorksheet(worksheetName);
    if (!worksheet) {
      worksheet = workbook.addWorksheet(worksheetName);
    }

    const rowsAdded = [];

    if (Array.isArray(content)) {
      // Add multiple rows of data
      content.forEach((rowData) => {
        const newRow = worksheet.addRow(rowData);
        
        if (formatting && this.options.preserveFormatting) {
          newRow.eachCell((cell) => {
            this.applyCellFormatting(cell, formatting);
          });
        }
        
        rowsAdded.push({
          rowNumber: newRow.number,
          data: rowData
        });
      });
    } else {
      // Add single row
      const newRow = worksheet.addRow([content]);
      
      if (formatting && this.options.preserveFormatting) {
        newRow.eachCell((cell) => {
          this.applyCellFormatting(cell, formatting);
        });
      }
      
      rowsAdded.push({
        rowNumber: newRow.number,
        data: content
      });
    }

    return {
      success: true,
      target: worksheetName,
      mode,
      location: 'worksheet',
      rowsAdded,
      injectedContent: content
    };
  }

  /**
   * Determines the target type from target string
   * @private
   * @param {string} target - Target identifier
   * @returns {string} - Target type
   */
  getTargetType(target) {
    if (target.includes('namedRange:')) return 'namedRange';
    if (target.includes('worksheet:')) return 'worksheet';
    if (target.includes('column:') || /^[A-Z]+$/.test(target.split(':').pop())) return 'column';
    if (target.includes('row:') || /^\d+$/.test(target.split(':').pop())) return 'row';
    if (target.includes(':') && target.split(':')[1].includes(':')) return 'range'; // Contains range like A1:C3
    return 'cell'; // Default to cell
  }

  /**
   * Parses cell target string
   * @private
   * @param {string} target - Cell target (e.g., "Sheet1:A1" or "A1")
   * @returns {Object} - Parsed cell reference
   */
  parseCellTarget(target) {
    const parts = target.split(':');
    if (parts.length === 1) {
      return { worksheetName: 'Sheet1', cellRef: parts[0] };
    }
    return { worksheetName: parts[0], cellRef: parts[1] };
  }

  /**
   * Parses range target string
   * @private
   * @param {string} target - Range target (e.g., "Sheet1:A1:C3")
   * @returns {Object} - Parsed range reference
   */
  parseRangeTarget(target) {
    const parts = target.split(':');
    if (parts.length === 2) {
      return { worksheetName: 'Sheet1', rangeRef: target };
    }
    const worksheetName = parts[0];
    const rangeRef = parts.slice(1).join(':');
    return { worksheetName, rangeRef };
  }

  /**
   * Parses column target string
   * @private
   * @param {string} target - Column target (e.g., "Sheet1:A" or "A")
   * @returns {Object} - Parsed column reference
   */
  parseColumnTarget(target) {
    const parts = target.split(':');
    if (parts.length === 1) {
      return { worksheetName: 'Sheet1', columnRef: parts[0] };
    }
    return { worksheetName: parts[0], columnRef: parts[1] };
  }

  /**
   * Parses row target string
   * @private
   * @param {string} target - Row target (e.g., "Sheet1:1" or "1")
   * @returns {Object} - Parsed row reference
   */
  parseRowTarget(target) {
    const parts = target.split(':');
    const rowNumber = parseInt(parts.length === 1 ? parts[0] : parts[1], 10);
    const worksheetName = parts.length === 1 ? 'Sheet1' : parts[0];
    return { worksheetName, rowNumber };
  }

  /**
   * Parses named range definition
   * @private
   * @param {Object} namedRange - Named range object
   * @returns {Object} - Parsed named range
   */
  parseNamedRange(namedRange) {
    // This would parse the actual named range definition
    // For now, return a simplified structure
    return {
      worksheetName: 'Sheet1',
      rangeRef: 'A1:C3' // placeholder
    };
  }

  /**
   * Checks if a cell is within a range
   * @private
   * @param {string} cellAddress - Cell address (e.g., "A1")
   * @param {string} rangeRef - Range reference (e.g., "A1:C3")
   * @returns {boolean} - Whether cell is in range
   */
  cellInRange(cellAddress, rangeRef) {
    // Simplified implementation
    // In a real implementation, you'd use ExcelJS utilities
    return true;
  }

  /**
   * Applies injection mode to content
   * @private
   * @param {*} originalValue - Original cell value
   * @param {*} newContent - New content to inject
   * @param {string} mode - Injection mode
   * @returns {*} - Final value
   */
  applyInjectionMode(originalValue, newContent, mode) {
    switch (mode) {
      case 'replace':
        return newContent;
      case 'append':
        return (originalValue || '') + newContent;
      case 'prepend':
        return newContent + (originalValue || '');
      case 'before':
        return newContent + (originalValue || '');
      case 'after':
        return (originalValue || '') + newContent;
      default:
        return newContent;
    }
  }

  /**
   * Applies formatting to a cell
   * @private
   * @param {Object} cell - ExcelJS cell object
   * @param {Object} formatting - Formatting options
   */
  applyCellFormatting(cell, formatting) {
    if (formatting.font) {
      cell.font = {
        name: formatting.font.name || 'Calibri',
        size: formatting.font.size || 11,
        bold: formatting.font.bold || false,
        italic: formatting.font.italic || false,
        underline: formatting.font.underline || false,
        color: formatting.font.color ? { argb: formatting.font.color } : undefined
      };
    }

    if (formatting.alignment) {
      cell.alignment = {
        horizontal: formatting.alignment.horizontal || 'left',
        vertical: formatting.alignment.vertical || 'top',
        wrapText: formatting.alignment.wrapText || false
      };
    }

    if (formatting.border) {
      cell.border = formatting.border;
    }

    if (formatting.fill) {
      cell.fill = formatting.fill;
    }

    if (formatting.numFmt) {
      cell.numFmt = formatting.numFmt;
    }
  }

  /**
   * Checks if injection should be skipped
   * @private
   * @param {Object} injection - Injection specification
   * @param {Object} workbook - ExcelJS workbook object
   * @returns {Promise<boolean>} - Whether to skip injection
   */
  async shouldSkipInjection(injection, workbook) {
    if (!injection.skipIf) {
      return false;
    }

    if (typeof injection.skipIf === 'string') {
      // Simple condition checking
      return injection.skipIf === 'true' || injection.skipIf === '1';
    }

    if (typeof injection.skipIf === 'function') {
      return await injection.skipIf(workbook, injection);
    }

    return false;
  }

  /**
   * Gets injection statistics
   * @returns {Object} - Statistics object
   */
  getStatistics() {
    return { ...this.stats };
  }

  /**
   * Resets statistics
   */
  resetStatistics() {
    this.stats = {
      attempted: 0,
      successful: 0,
      failed: 0,
      skipped: 0
    };
    this.processedFiles = 0;
  }
}

export default ExcelInjector;