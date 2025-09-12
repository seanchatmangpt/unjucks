/**
 * @fileoverview Unit tests for Excel processor functionality
 * Tests Excel workbook processing, cell operations, formula handling, and data injection
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import path from 'path';
import { TestUtils } from '../test-runner.js';

/**
 * Mock Excel Processor class for testing
 */
class ExcelProcessor {
  constructor(options = {}) {
    this.options = {
      preserveFormulas: true,
      autoCalculate: true,
      preserveFormatting: true,
      strictMode: false,
      ...options
    };
    
    this.stats = {
      processed: 0,
      worksheetsProcessed: 0,
      cellsModified: 0,
      formulasEvaluated: 0,
      chartsUpdated: 0,
      errors: []
    };
  }

  /**
   * Check if file is supported Excel format
   */
  isSupported(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return ['.xlsx', '.xls', '.xlsm', '.xltx', '.xlt', '.csv'].includes(ext);
  }

  /**
   * Get supported file extensions
   */
  getSupportedExtensions() {
    return ['.xlsx', '.xls', '.xlsm', '.xltx', '.xlt', '.csv'];
  }

  /**
   * Process Excel template with data
   */
  async processTemplate(templatePath, data, outputPath) {
    this.stats.processed++;

    await TestUtils.assertFileExists(templatePath);
    
    const workbook = await this._loadWorkbook(templatePath);
    const processedWorkbook = await this._populateData(workbook, data);
    
    if (outputPath) {
      await this._saveWorkbook(processedWorkbook, outputPath);
    }

    return {
      success: true,
      templatePath,
      outputPath,
      worksheets: processedWorkbook.worksheets.length,
      cellsModified: this.stats.cellsModified,
      formulasEvaluated: this.stats.formulasEvaluated,
      processingTime: Math.random() * 200
    };
  }

  /**
   * Extract data structure from Excel file
   */
  async extractData(filePath, options = {}) {
    await TestUtils.assertFileExists(filePath);
    
    const workbook = await this._loadWorkbook(filePath);
    const extractedData = {};
    
    for (const worksheet of workbook.worksheets) {
      extractedData[worksheet.name] = await this._extractWorksheetData(worksheet, options);
    }
    
    return {
      filePath,
      worksheets: extractedData,
      charts: workbook.charts || [],
      namedRanges: workbook.namedRanges || [],
      metadata: await this._extractMetadata(workbook)
    };
  }

  /**
   * Inject data into Excel workbook
   */
  async injectData(filePath, injections) {
    await TestUtils.assertFileExists(filePath);
    
    const workbook = await this._loadWorkbook(filePath);
    const results = [];
    
    for (const injection of injections) {
      try {
        const result = await this._performDataInjection(workbook, injection);
        results.push(result);
        this.stats.cellsModified += result.cellsAffected || 0;
      } catch (error) {
        this.stats.errors.push(error.message);
        results.push({
          success: false,
          injection,
          error: error.message
        });
      }
    }
    
    await this._saveWorkbook(workbook, filePath);
    
    return {
      success: true,
      filePath,
      injections: results.filter(r => r.success),
      failures: results.filter(r => !r.success),
      totalCellsModified: this.stats.cellsModified
    };
  }

  /**
   * Validate Excel template structure
   */
  async validateTemplate(templatePath) {
    await TestUtils.assertFileExists(templatePath);
    
    const workbook = await this._loadWorkbook(templatePath);
    const issues = [];
    
    // Validate worksheets
    if (workbook.worksheets.length === 0) {
      issues.push('Workbook contains no worksheets');
    }
    
    // Check for circular references
    for (const worksheet of workbook.worksheets) {
      const circularRefs = await this._detectCircularReferences(worksheet);
      if (circularRefs.length > 0) {
        issues.push(`Circular references detected in ${worksheet.name}: ${circularRefs.join(', ')}`);
      }
    }
    
    // Validate named ranges
    const invalidRanges = workbook.namedRanges?.filter(range => !this._isValidRange(range)) || [];
    if (invalidRanges.length > 0) {
      issues.push(`Invalid named ranges: ${invalidRanges.map(r => r.name).join(', ')}`);
    }
    
    // Check for broken formulas
    const brokenFormulas = await this._findBrokenFormulas(workbook);
    if (brokenFormulas.length > 0) {
      issues.push(`Broken formulas found: ${brokenFormulas.length} formulas`);
    }
    
    return {
      valid: issues.length === 0,
      issues,
      worksheets: workbook.worksheets.map(ws => ({
        name: ws.name,
        cells: ws.cells?.length || 0,
        formulas: ws.formulas?.length || 0,
        charts: ws.charts?.length || 0
      })),
      namedRanges: workbook.namedRanges?.map(r => r.name) || [],
      variables: await this._extractTemplateVariables(workbook)
    };
  }

  /**
   * Manipulate worksheet cells
   */
  async manipulateCells(filePath, operations) {
    await TestUtils.assertFileExists(filePath);
    
    const workbook = await this._loadWorkbook(filePath);
    const results = [];
    
    for (const operation of operations) {
      try {
        const result = await this._performCellOperation(workbook, operation);
        results.push(result);
      } catch (error) {
        this.stats.errors.push(error.message);
        results.push({
          success: false,
          operation,
          error: error.message
        });
      }
    }
    
    await this._saveWorkbook(workbook, filePath);
    
    return {
      success: true,
      filePath,
      operations: results.filter(r => r.success),
      failures: results.filter(r => !r.success)
    };
  }

  /**
   * Handle formula operations
   */
  async processFormulas(filePath, formulaOperations) {
    await TestUtils.assertFileExists(filePath);
    
    const workbook = await this._loadWorkbook(filePath);
    const results = [];
    
    for (const operation of formulaOperations) {
      try {
        const result = await this._processFormula(workbook, operation);
        results.push(result);
        this.stats.formulasEvaluated++;
      } catch (error) {
        this.stats.errors.push(error.message);
        results.push({
          success: false,
          operation,
          error: error.message
        });
      }
    }
    
    return {
      success: true,
      filePath,
      formulaResults: results.filter(r => r.success),
      failures: results.filter(r => !r.success)
    };
  }

  /**
   * Get processing statistics
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      processed: 0,
      worksheetsProcessed: 0,
      cellsModified: 0,
      formulasEvaluated: 0,
      chartsUpdated: 0,
      errors: []
    };
  }

  // Private helper methods

  async _loadWorkbook(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    
    if (ext === '.csv') {
      return this._loadCSVAsWorkbook(filePath);
    }
    
    // Simulate loading Excel workbook
    return {
      path: filePath,
      worksheets: [
        {
          name: 'Sheet1',
          cells: [
            { address: 'A1', value: '{{header_1}}', type: 'string' },
            { address: 'B1', value: '{{header_2}}', type: 'string' },
            { address: 'A2', value: '{{data_1}}', type: 'string' },
            { address: 'B2', value: '{{data_2}}', type: 'number' },
            { address: 'C2', value: '=A2+B2', type: 'formula' }
          ],
          formulas: [
            { address: 'C2', formula: '=A2+B2' },
            { address: 'D2', formula: '=SUM(A2:C2)' }
          ]
        }
      ],
      namedRanges: [
        { name: 'DataRange', range: 'Sheet1!A1:C10' },
        { name: 'HeaderRow', range: 'Sheet1!A1:C1' }
      ],
      charts: []
    };
  }

  async _loadCSVAsWorkbook(filePath) {
    return {
      path: filePath,
      worksheets: [{
        name: 'CSV_Data',
        cells: [
          { address: 'A1', value: 'Header1', type: 'string' },
          { address: 'B1', value: 'Header2', type: 'string' },
          { address: 'A2', value: 'Data1', type: 'string' },
          { address: 'B2', value: 'Data2', type: 'string' }
        ]
      }],
      namedRanges: [],
      charts: []
    };
  }

  async _saveWorkbook(workbook, filePath) {
    // Simulate saving workbook
    return true;
  }

  async _populateData(workbook, data) {
    const processedWorkbook = { ...workbook };
    
    for (const worksheet of processedWorkbook.worksheets) {
      for (const cell of worksheet.cells) {
        if (typeof cell.value === 'string' && cell.value.includes('{{')) {
          // Replace template variables
          let newValue = cell.value;
          for (const [key, value] of Object.entries(data)) {
            newValue = newValue.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g'), String(value));
          }
          cell.value = newValue;
          this.stats.cellsModified++;
        }
      }
      this.stats.worksheetsProcessed++;
    }
    
    return processedWorkbook;
  }

  async _extractWorksheetData(worksheet, options) {
    const data = {
      name: worksheet.name,
      cells: {},
      formulas: [],
      charts: worksheet.charts || []
    };
    
    // Extract cell data
    for (const cell of worksheet.cells || []) {
      data.cells[cell.address] = {
        value: cell.value,
        type: cell.type,
        format: cell.format
      };
    }
    
    // Extract formulas
    for (const formula of worksheet.formulas || []) {
      data.formulas.push({
        address: formula.address,
        formula: formula.formula,
        result: formula.result
      });
    }
    
    return data;
  }

  async _extractMetadata(workbook) {
    return {
      filename: path.basename(workbook.path),
      format: path.extname(workbook.path).toLowerCase(),
      worksheetCount: workbook.worksheets.length,
      namedRangeCount: workbook.namedRanges?.length || 0,
      chartCount: workbook.charts?.length || 0,
      created: this.getDeterministicDate(),
      modified: this.getDeterministicDate()
    };
  }

  async _performDataInjection(workbook, injection) {
    const { target, data, mode = 'replace' } = injection;
    let cellsAffected = 0;
    
    // Parse target (e.g., "Sheet1:A1", "Sheet1:A1:C5", "namedRange:DataRange")
    if (target.startsWith('namedRange:')) {
      const rangeName = target.replace('namedRange:', '');
      const namedRange = workbook.namedRanges?.find(r => r.name === rangeName);
      if (!namedRange) {
        throw new Error(`Named range '${rangeName}' not found`);
      }
      cellsAffected = this._injectToRange(workbook, namedRange.range, data, mode);
    } else {
      // Sheet and cell reference
      const [sheetName, cellRange] = target.split(':');
      const worksheet = workbook.worksheets.find(ws => ws.name === sheetName);
      if (!worksheet) {
        throw new Error(`Worksheet '${sheetName}' not found`);
      }
      cellsAffected = this._injectToCells(worksheet, cellRange, data, mode);
    }
    
    return {
      success: true,
      target,
      cellsAffected,
      mode,
      timestamp: this.getDeterministicDate().toISOString()
    };
  }

  _injectToCells(worksheet, cellRange, data, mode) {
    let cellsAffected = 0;
    
    if (cellRange.includes(':')) {
      // Range like A1:C5
      cellsAffected = this._injectToRange(worksheet, cellRange, data, mode);
    } else {
      // Single cell like A1
      this._injectToSingleCell(worksheet, cellRange, data, mode);
      cellsAffected = 1;
    }
    
    return cellsAffected;
  }

  _injectToSingleCell(worksheet, cellAddress, data, mode) {
    let cell = worksheet.cells.find(c => c.address === cellAddress);
    
    if (!cell) {
      cell = { address: cellAddress, value: '', type: 'string' };
      worksheet.cells.push(cell);
    }
    
    switch (mode) {
      case 'replace':
        cell.value = data;
        break;
      case 'append':
        cell.value = String(cell.value) + String(data);
        break;
      case 'prepend':
        cell.value = String(data) + String(cell.value);
        break;
    }
    
    // Update cell type based on data
    if (typeof data === 'number') {
      cell.type = 'number';
    } else if (typeof data === 'boolean') {
      cell.type = 'boolean';
    } else {
      cell.type = 'string';
    }
  }

  _injectToRange(worksheet, range, data, mode) {
    // Simplified range injection for testing
    // In reality, this would parse the range and inject to multiple cells
    const cellsInRange = this._parseCellRange(range);
    
    if (Array.isArray(data)) {
      // Inject array data to range
      for (let i = 0; i < Math.min(data.length, cellsInRange.length); i++) {
        this._injectToSingleCell(worksheet, cellsInRange[i], data[i], mode);
      }
      return Math.min(data.length, cellsInRange.length);
    } else {
      // Inject single value to first cell in range
      if (cellsInRange.length > 0) {
        this._injectToSingleCell(worksheet, cellsInRange[0], data, mode);
        return 1;
      }
    }
    
    return 0;
  }

  _parseCellRange(range) {
    // Simplified range parsing for testing
    // Returns array of cell addresses in the range
    if (range === 'A1:C1') {
      return ['A1', 'B1', 'C1'];
    } else if (range === 'A1:B2') {
      return ['A1', 'B1', 'A2', 'B2'];
    } else if (range.includes(':')) {
      return [range.split(':')[0]]; // Return first cell for simplicity
    }
    return [range];
  }

  async _performCellOperation(workbook, operation) {
    const { type, target, data } = operation;
    
    switch (type) {
      case 'setValue':
        return this._setCellValue(workbook, target, data);
      case 'setFormula':
        return this._setCellFormula(workbook, target, data);
      case 'setFormat':
        return this._setCellFormat(workbook, target, data);
      case 'clear':
        return this._clearCell(workbook, target);
      default:
        throw new Error(`Unknown cell operation: ${type}`);
    }
  }

  _setCellValue(workbook, target, value) {
    const [sheetName, cellAddress] = target.split(':');
    const worksheet = workbook.worksheets.find(ws => ws.name === sheetName);
    
    if (!worksheet) {
      throw new Error(`Worksheet '${sheetName}' not found`);
    }
    
    this._injectToSingleCell(worksheet, cellAddress, value, 'replace');
    
    return {
      success: true,
      operation: 'setValue',
      target,
      value
    };
  }

  _setCellFormula(workbook, target, formula) {
    const [sheetName, cellAddress] = target.split(':');
    const worksheet = workbook.worksheets.find(ws => ws.name === sheetName);
    
    if (!worksheet) {
      throw new Error(`Worksheet '${sheetName}' not found`);
    }
    
    // Add or update formula
    let formulaObj = worksheet.formulas?.find(f => f.address === cellAddress);
    if (!formulaObj) {
      formulaObj = { address: cellAddress, formula: '', result: null };
      worksheet.formulas = worksheet.formulas || [];
      worksheet.formulas.push(formulaObj);
    }
    
    formulaObj.formula = formula;
    
    return {
      success: true,
      operation: 'setFormula',
      target,
      formula
    };
  }

  _setCellFormat(workbook, target, format) {
    const [sheetName, cellAddress] = target.split(':');
    const worksheet = workbook.worksheets.find(ws => ws.name === sheetName);
    
    if (!worksheet) {
      throw new Error(`Worksheet '${sheetName}' not found`);
    }
    
    let cell = worksheet.cells.find(c => c.address === cellAddress);
    if (!cell) {
      cell = { address: cellAddress, value: '', type: 'string' };
      worksheet.cells.push(cell);
    }
    
    cell.format = format;
    
    return {
      success: true,
      operation: 'setFormat',
      target,
      format
    };
  }

  _clearCell(workbook, target) {
    const [sheetName, cellAddress] = target.split(':');
    const worksheet = workbook.worksheets.find(ws => ws.name === sheetName);
    
    if (!worksheet) {
      throw new Error(`Worksheet '${sheetName}' not found`);
    }
    
    // Remove cell
    worksheet.cells = worksheet.cells.filter(c => c.address !== cellAddress);
    
    // Remove associated formula
    if (worksheet.formulas) {
      worksheet.formulas = worksheet.formulas.filter(f => f.address !== cellAddress);
    }
    
    return {
      success: true,
      operation: 'clear',
      target
    };
  }

  async _processFormula(workbook, operation) {
    const { type, formula, context } = operation;
    
    switch (type) {
      case 'evaluate':
        return this._evaluateFormula(formula, workbook, context);
      case 'validate':
        return this._validateFormula(formula);
      case 'parse':
        return this._parseFormula(formula);
      default:
        throw new Error(`Unknown formula operation: ${type}`);
    }
  }

  _evaluateFormula(formula, workbook, context) {
    // Simplified formula evaluation for testing
    let result = 0;
    
    if (formula.startsWith('=SUM(')) {
      // Extract range and simulate sum
      const range = formula.match(/=SUM\(([^)]+)\)/)?.[1];
      result = Math.floor(Math.random() * 1000); // Mock result
    } else if (formula.includes('+')) {
      // Simple addition
      const parts = formula.replace('=', '').split('+');
      result = parts.reduce((sum, part) => sum + (parseFloat(part.trim()) || 0), 0);
    } else if (formula.includes('*')) {
      // Simple multiplication
      const parts = formula.replace('=', '').split('*');
      result = parts.reduce((product, part) => product * (parseFloat(part.trim()) || 1), 1);
    }
    
    return {
      success: true,
      formula,
      result,
      type: typeof result
    };
  }

  _validateFormula(formula) {
    const issues = [];
    
    if (!formula.startsWith('=')) {
      issues.push('Formula must start with =');
    }
    
    // Check for balanced parentheses
    const openParens = (formula.match(/\(/g) || []).length;
    const closeParens = (formula.match(/\)/g) || []).length;
    if (openParens !== closeParens) {
      issues.push('Unbalanced parentheses in formula');
    }
    
    // Check for common functions
    const unsupportedFunctions = formula.match(/[A-Z]+\(/g)?.filter(func => 
      !['SUM', 'AVG', 'COUNT', 'MAX', 'MIN', 'IF'].includes(func.replace('(', ''))
    ) || [];
    
    if (unsupportedFunctions.length > 0) {
      issues.push(`Unsupported functions: ${unsupportedFunctions.join(', ')}`);
    }
    
    return {
      success: true,
      formula,
      valid: issues.length === 0,
      issues
    };
  }

  _parseFormula(formula) {
    const tokens = [];
    const cellReferences = formula.match(/[A-Z]+\d+/g) || [];
    const functions = formula.match(/[A-Z]+\(/g)?.map(f => f.replace('(', '')) || [];
    const operators = formula.match(/[+\-*/]/g) || [];
    
    return {
      success: true,
      formula,
      tokens,
      cellReferences,
      functions,
      operators
    };
  }

  async _detectCircularReferences(worksheet) {
    // Simplified circular reference detection
    const circularRefs = [];
    
    for (const formula of worksheet.formulas || []) {
      if (formula.formula.includes(formula.address)) {
        circularRefs.push(formula.address);
      }
    }
    
    return circularRefs;
  }

  _isValidRange(namedRange) {
    // Basic validation of named range format
    return namedRange.range && namedRange.range.match(/^[A-Z]+\d+:[A-Z]+\d+$/);
  }

  async _findBrokenFormulas(workbook) {
    const brokenFormulas = [];
    
    for (const worksheet of workbook.worksheets) {
      for (const formula of worksheet.formulas || []) {
        const validation = this._validateFormula(formula.formula);
        if (!validation.valid) {
          brokenFormulas.push({
            worksheet: worksheet.name,
            address: formula.address,
            formula: formula.formula,
            issues: validation.issues
          });
        }
      }
    }
    
    return brokenFormulas;
  }

  async _extractTemplateVariables(workbook) {
    const variables = [];
    const variableSet = new Set();
    
    for (const worksheet of workbook.worksheets) {
      for (const cell of worksheet.cells || []) {
        if (typeof cell.value === 'string' && cell.value.includes('{{')) {
          const matches = cell.value.match(/\{\{\s*([^}]+)\s*\}\}/g) || [];
          for (const match of matches) {
            const varName = match.replace(/[{}]/g, '').trim();
            if (!variableSet.has(varName)) {
              variables.push({
                name: varName,
                type: 'string',
                location: `${worksheet.name}:${cell.address}`,
                required: true
              });
              variableSet.add(varName);
            }
          }
        }
      }
    }
    
    return variables;
  }
}

/**
 * Register Excel processor tests
 */
export function registerTests(testRunner) {
  testRunner.registerSuite('Excel Processor Unit Tests', async () => {
    let processor;
    let testData;
    
    beforeEach(() => {
      processor = new ExcelProcessor();
      testData = {
        header_1: 'Name',
        header_2: 'Value',
        data_1: 'Item A',
        data_2: 100,
        total: 500,
        ...TestUtils.createTestVariables()
      };
    });
    
    describe('Excel Processor Construction', () => {
      test('should create processor with default options', () => {
        const defaultProcessor = new ExcelProcessor();
        assert.strictEqual(defaultProcessor.options.preserveFormulas, true);
        assert.strictEqual(defaultProcessor.options.autoCalculate, true);
        assert.strictEqual(defaultProcessor.options.preserveFormatting, true);
        assert.strictEqual(defaultProcessor.options.strictMode, false);
      });
      
      test('should create processor with custom options', () => {
        const customProcessor = new ExcelProcessor({
          preserveFormulas: false,
          autoCalculate: false,
          strictMode: true
        });
        
        assert.strictEqual(customProcessor.options.preserveFormulas, false);
        assert.strictEqual(customProcessor.options.autoCalculate, false);
        assert.strictEqual(customProcessor.options.strictMode, true);
      });
    });

    describe('File Format Support', () => {
      test('should support XLSX files', () => {
        assert.strictEqual(processor.isSupported('/path/to/workbook.xlsx'), true);
        assert.strictEqual(processor.isSupported('/path/to/workbook.XLSX'), true);
      });
      
      test('should support XLS files', () => {
        assert.strictEqual(processor.isSupported('/path/to/workbook.xls'), true);
        assert.strictEqual(processor.isSupported('/path/to/workbook.XLS'), true);
      });
      
      test('should support CSV files', () => {
        assert.strictEqual(processor.isSupported('/path/to/data.csv'), true);
        assert.strictEqual(processor.isSupported('/path/to/data.CSV'), true);
      });
      
      test('should support Excel template files', () => {
        assert.strictEqual(processor.isSupported('/path/to/template.xltx'), true);
        assert.strictEqual(processor.isSupported('/path/to/template.xlt'), true);
      });
      
      test('should support macro-enabled files', () => {
        assert.strictEqual(processor.isSupported('/path/to/workbook.xlsm'), true);
      });
      
      test('should not support non-Excel files', () => {
        assert.strictEqual(processor.isSupported('/path/to/document.docx'), false);
        assert.strictEqual(processor.isSupported('/path/to/presentation.pptx'), false);
        assert.strictEqual(processor.isSupported('/path/to/document.pdf'), false);
      });
    });

    describe('Template Processing', () => {
      test('should process Excel template with data', async () => {
        const templatePath = TestUtils.getTestDataPath('spreadsheet.xlsx');
        const outputPath = TestUtils.getTempPath('output.xlsx');
        
        const result = await processor.processTemplate(templatePath, testData, outputPath);
        
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.templatePath, templatePath);
        assert.strictEqual(result.outputPath, outputPath);
        assert.ok(result.worksheets > 0);
        assert.ok(result.cellsModified >= 0);
        assert.ok(result.processingTime >= 0);
      });
      
      test('should handle CSV file processing', async () => {
        const csvPath = TestUtils.getTestDataPath('data.csv');
        await TestUtils.createTempFile('data.csv', 'Header1,Header2\nData1,Data2');
        
        const result = await processor.processTemplate(csvPath, testData);
        
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.worksheets, 1);
      });
      
      test('should process template without output path', async () => {
        const templatePath = TestUtils.getTestDataPath('spreadsheet.xlsx');
        
        const result = await processor.processTemplate(templatePath, testData);
        
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.outputPath, undefined);
      });
      
      test('should handle missing template file', async () => {
        const templatePath = '/nonexistent/template.xlsx';
        
        try {
          await processor.processTemplate(templatePath, testData);
          assert.fail('Should have thrown error for missing file');
        } catch (error) {
          assert.ok(error.message.includes('does not exist'));
        }
      });
    });

    describe('Data Extraction', () => {
      test('should extract data from Excel workbook', async () => {
        const filePath = TestUtils.getTestDataPath('spreadsheet.xlsx');
        
        const result = await processor.extractData(filePath);
        
        assert.strictEqual(typeof result, 'object');
        assert.strictEqual(result.filePath, filePath);
        assert.ok(typeof result.worksheets === 'object');
        assert.ok(Array.isArray(result.charts));
        assert.ok(Array.isArray(result.namedRanges));
        assert.ok(result.metadata);
      });
      
      test('should extract worksheet data with cells and formulas', async () => {
        const filePath = TestUtils.getTestDataPath('spreadsheet.xlsx');
        
        const result = await processor.extractData(filePath);
        const worksheet = result.worksheets.Sheet1;
        
        assert.ok(worksheet);
        assert.ok(worksheet.cells);
        assert.ok(Array.isArray(worksheet.formulas));
        assert.strictEqual(worksheet.name, 'Sheet1');
      });
      
      test('should extract metadata information', async () => {
        const filePath = TestUtils.getTestDataPath('spreadsheet.xlsx');
        
        const result = await processor.extractData(filePath);
        const metadata = result.metadata;
        
        assert.ok(metadata.filename);
        assert.ok(metadata.format);
        assert.ok(typeof metadata.worksheetCount === 'number');
        assert.ok(typeof metadata.namedRangeCount === 'number');
        assert.ok(metadata.created instanceof Date);
      });
    });

    describe('Data Injection', () => {
      test('should inject data into single cell', async () => {
        const filePath = TestUtils.getTestDataPath('spreadsheet.xlsx');
        const injections = [
          {
            target: 'Sheet1:A1',
            data: 'New Value',
            mode: 'replace'
          }
        ];
        
        const result = await processor.injectData(filePath, injections);
        
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.filePath, filePath);
        assert.strictEqual(result.injections.length, 1);
        assert.strictEqual(result.failures.length, 0);
        assert.ok(result.totalCellsModified > 0);
      });
      
      test('should inject data into cell range', async () => {
        const filePath = TestUtils.getTestDataPath('spreadsheet.xlsx');
        const injections = [
          {
            target: 'Sheet1:A1:C1',
            data: ['Header 1', 'Header 2', 'Header 3'],
            mode: 'replace'
          }
        ];
        
        const result = await processor.injectData(filePath, injections);
        
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.injections.length, 1);
        assert.ok(result.injections[0].cellsAffected > 0);
      });
      
      test('should inject data using named range', async () => {
        const filePath = TestUtils.getTestDataPath('spreadsheet.xlsx');
        const injections = [
          {
            target: 'namedRange:DataRange',
            data: [['A1', 'B1'], ['A2', 'B2']],
            mode: 'replace'
          }
        ];
        
        const result = await processor.injectData(filePath, injections);
        
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.injections.length, 1);
      });
      
      test('should handle invalid worksheet reference', async () => {
        const filePath = TestUtils.getTestDataPath('spreadsheet.xlsx');
        const injections = [
          {
            target: 'NonexistentSheet:A1',
            data: 'Test Value',
            mode: 'replace'
          }
        ];
        
        const result = await processor.injectData(filePath, injections);
        
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.injections.length, 0);
        assert.strictEqual(result.failures.length, 1);
        assert.ok(result.failures[0].error.includes('not found'));
      });
      
      test('should support different injection modes', async () => {
        const filePath = TestUtils.getTestDataPath('spreadsheet.xlsx');
        const injections = [
          {
            target: 'Sheet1:A1',
            data: 'Replace',
            mode: 'replace'
          },
          {
            target: 'Sheet1:A2',
            data: 'Append',
            mode: 'append'
          },
          {
            target: 'Sheet1:A3',
            data: 'Prepend',
            mode: 'prepend'
          }
        ];
        
        const result = await processor.injectData(filePath, injections);
        
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.injections.length, 3);
        
        // Check modes are preserved
        assert.strictEqual(result.injections[0].mode, 'replace');
        assert.strictEqual(result.injections[1].mode, 'append');
        assert.strictEqual(result.injections[2].mode, 'prepend');
      });
    });

    describe('Cell Operations', () => {
      test('should set cell values', async () => {
        const filePath = TestUtils.getTestDataPath('spreadsheet.xlsx');
        const operations = [
          {
            type: 'setValue',
            target: 'Sheet1:A1',
            data: 'New Value'
          },
          {
            type: 'setValue',
            target: 'Sheet1:B1',
            data: 42
          }
        ];
        
        const result = await processor.manipulateCells(filePath, operations);
        
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.operations.length, 2);
        assert.strictEqual(result.failures.length, 0);
      });
      
      test('should set cell formulas', async () => {
        const filePath = TestUtils.getTestDataPath('spreadsheet.xlsx');
        const operations = [
          {
            type: 'setFormula',
            target: 'Sheet1:C1',
            data: '=A1+B1'
          }
        ];
        
        const result = await processor.manipulateCells(filePath, operations);
        
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.operations.length, 1);
        assert.strictEqual(result.operations[0].formula, '=A1+B1');
      });
      
      test('should set cell formatting', async () => {
        const filePath = TestUtils.getTestDataPath('spreadsheet.xlsx');
        const operations = [
          {
            type: 'setFormat',
            target: 'Sheet1:A1',
            data: { numFmt: '$#,##0.00', font: { bold: true } }
          }
        ];
        
        const result = await processor.manipulateCells(filePath, operations);
        
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.operations.length, 1);
        assert.deepStrictEqual(result.operations[0].format, { numFmt: '$#,##0.00', font: { bold: true } });
      });
      
      test('should clear cell content', async () => {
        const filePath = TestUtils.getTestDataPath('spreadsheet.xlsx');
        const operations = [
          {
            type: 'clear',
            target: 'Sheet1:A1'
          }
        ];
        
        const result = await processor.manipulateCells(filePath, operations);
        
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.operations.length, 1);
        assert.strictEqual(result.operations[0].operation, 'clear');
      });
      
      test('should handle invalid operation type', async () => {
        const filePath = TestUtils.getTestDataPath('spreadsheet.xlsx');
        const operations = [
          {
            type: 'invalidOperation',
            target: 'Sheet1:A1',
            data: 'Test'
          }
        ];
        
        const result = await processor.manipulateCells(filePath, operations);
        
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.operations.length, 0);
        assert.strictEqual(result.failures.length, 1);
      });
    });

    describe('Formula Processing', () => {
      test('should evaluate simple formula', async () => {
        const filePath = TestUtils.getTestDataPath('spreadsheet.xlsx');
        const operations = [
          {
            type: 'evaluate',
            formula: '=5+3',
            context: {}
          }
        ];
        
        const result = await processor.processFormulas(filePath, operations);
        
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.formulaResults.length, 1);
        assert.strictEqual(result.formulaResults[0].result, 8);
      });
      
      test('should evaluate SUM formula', async () => {
        const filePath = TestUtils.getTestDataPath('spreadsheet.xlsx');
        const operations = [
          {
            type: 'evaluate',
            formula: '=SUM(A1:A5)',
            context: { range: 'A1:A5' }
          }
        ];
        
        const result = await processor.processFormulas(filePath, operations);
        
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.formulaResults.length, 1);
        assert.ok(typeof result.formulaResults[0].result === 'number');
      });
      
      test('should validate formula syntax', async () => {
        const filePath = TestUtils.getTestDataPath('spreadsheet.xlsx');
        const operations = [
          {
            type: 'validate',
            formula: '=SUM(A1:A5)',
          },
          {
            type: 'validate',
            formula: 'INVALID_FORMULA',
          }
        ];
        
        const result = await processor.processFormulas(filePath, operations);
        
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.formulaResults.length, 2);
        assert.strictEqual(result.formulaResults[0].valid, true);
        assert.strictEqual(result.formulaResults[1].valid, false);
      });
      
      test('should parse formula components', async () => {
        const filePath = TestUtils.getTestDataPath('spreadsheet.xlsx');
        const operations = [
          {
            type: 'parse',
            formula: '=SUM(A1:A5)+B1*C1',
          }
        ];
        
        const result = await processor.processFormulas(filePath, operations);
        
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.formulaResults.length, 1);
        
        const parsed = result.formulaResults[0];
        assert.ok(Array.isArray(parsed.cellReferences));
        assert.ok(Array.isArray(parsed.functions));
        assert.ok(Array.isArray(parsed.operators));
      });
    });

    describe('Template Validation', () => {
      test('should validate correct Excel template', async () => {
        const templatePath = TestUtils.getTestDataPath('spreadsheet.xlsx');
        
        const result = await processor.validateTemplate(templatePath);
        
        assert.strictEqual(result.valid, true);
        assert.strictEqual(result.issues.length, 0);
        assert.ok(Array.isArray(result.worksheets));
        assert.ok(Array.isArray(result.namedRanges));
        assert.ok(Array.isArray(result.variables));
      });
      
      test('should detect circular references', async () => {
        // This would require a custom workbook with circular references
        // For now, we'll mock the validation
        const templatePath = TestUtils.getTestDataPath('spreadsheet.xlsx');
        
        // Mock circular reference detection
        const originalMethod = processor._detectCircularReferences;
        processor._detectCircularReferences = async () => ['A1'];
        
        const result = await processor.validateTemplate(templatePath);
        
        assert.strictEqual(result.valid, false);
        assert.ok(result.issues.some(issue => issue.includes('Circular references')));
        
        // Restore original method
        processor._detectCircularReferences = originalMethod;
      });
      
      test('should validate named ranges', async () => {
        const templatePath = TestUtils.getTestDataPath('spreadsheet.xlsx');
        
        const result = await processor.validateTemplate(templatePath);
        
        if (result.namedRanges.length > 0) {
          // Should have valid named ranges
          assert.ok(result.valid);
        }
      });
      
      test('should extract template variables during validation', async () => {
        const templatePath = TestUtils.getTestDataPath('spreadsheet.xlsx');
        
        const result = await processor.validateTemplate(templatePath);
        
        assert.ok(Array.isArray(result.variables));
        if (result.variables.length > 0) {
          result.variables.forEach(variable => {
            assert.ok(variable.name);
            assert.ok(variable.type);
            assert.ok(variable.location);
            assert.ok(typeof variable.required === 'boolean');
          });
        }
      });
    });

    describe('Statistics and Performance', () => {
      test('should track processing statistics', async () => {
        const filePath = TestUtils.getTestDataPath('spreadsheet.xlsx');
        
        // Perform operations
        await processor.processTemplate(filePath, testData);
        await processor.injectData(filePath, [{ target: 'Sheet1:A1', data: 'Test', mode: 'replace' }]);
        await processor.processFormulas(filePath, [{ type: 'evaluate', formula: '=1+1' }]);
        
        const stats = processor.getStats();
        
        assert.strictEqual(stats.processed, 1);
        assert.ok(stats.worksheetsProcessed > 0);
        assert.ok(stats.cellsModified > 0);
        assert.ok(stats.formulasEvaluated > 0);
      });
      
      test('should reset statistics', () => {
        // Set some stats
        processor.stats.processed = 5;
        processor.stats.cellsModified = 20;
        processor.stats.formulasEvaluated = 3;
        
        processor.resetStats();
        
        const stats = processor.getStats();
        assert.strictEqual(stats.processed, 0);
        assert.strictEqual(stats.cellsModified, 0);
        assert.strictEqual(stats.formulasEvaluated, 0);
      });
    });

    describe('Error Handling and Edge Cases', () => {
      test('should handle empty operations array', async () => {
        const filePath = TestUtils.getTestDataPath('spreadsheet.xlsx');
        
        const result = await processor.manipulateCells(filePath, []);
        
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.operations.length, 0);
        assert.strictEqual(result.failures.length, 0);
      });
      
      test('should handle null data injection', async () => {
        const filePath = TestUtils.getTestDataPath('spreadsheet.xlsx');
        const injections = [
          {
            target: 'Sheet1:A1',
            data: null,
            mode: 'replace'
          }
        ];
        
        const result = await processor.injectData(filePath, injections);
        
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.injections.length, 1);
      });
      
      test('should handle large data values', async () => {
        const filePath = TestUtils.getTestDataPath('spreadsheet.xlsx');
        const largeData = {
          data_1: 'Very '.repeat(1000) + 'long text',
          data_2: Number.MAX_SAFE_INTEGER
        };
        
        const result = await processor.processTemplate(filePath, largeData);
        
        assert.strictEqual(result.success, true);
      });
      
      test('should handle special characters in cell values', async () => {
        const filePath = TestUtils.getTestDataPath('spreadsheet.xlsx');
        const injections = [
          {
            target: 'Sheet1:A1',
            data: 'Content with "quotes" and <tags> and émojis 🚀',
            mode: 'replace'
          }
        ];
        
        const result = await processor.injectData(filePath, injections);
        
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.injections.length, 1);
      });
    });
  });
}