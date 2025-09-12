#!/usr/bin/env node

/**
 * @fileoverview Office functionality test runner
 * Comprehensive test runner for all Office-related functionality
 * using Node.js built-in test module with assert
 */

import { test, describe, beforeEach, afterEach, before, after } from 'node:test';
import assert from 'node:assert';
import { spawn } from 'node:child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test configuration
const TEST_CONFIG = {
  timeout: 30000,
  maxConcurrency: 4,
  retryAttempts: 2,
  testDataDir: path.join(__dirname, 'test-data'),
  tempDir: path.join(__dirname, 'temp'),
  verbose: process.env.TEST_VERBOSE === 'true'
};

// Test statistics
let testStats = {
  total: 0,
  passed: 0,
  failed: 0,
  skipped: 0,
  duration: 0,
  errors: []
};

/**
 * Test utilities class
 */
export class TestUtils {
  /**
   * Setup test environment
   */
  static async setupTestEnvironment() {
    console.log('🔧 Setting up Office test environment...');
    
    // Create test directories
    await fs.mkdir(TEST_CONFIG.testDataDir, { recursive: true });
    await fs.mkdir(TEST_CONFIG.tempDir, { recursive: true });
    
    // Initialize mock office files
    await this.createMockOfficeFiles();
    
    console.log('✅ Test environment ready');
  }

  /**
   * Cleanup test environment
   */
  static async cleanupTestEnvironment() {
    console.log('🧹 Cleaning up test environment...');
    
    try {
      await fs.rm(TEST_CONFIG.tempDir, { recursive: true, force: true });
      console.log('✅ Test environment cleaned');
    } catch (error) {
      console.warn('⚠️ Cleanup warning:', error.message);
    }
  }

  /**
   * Create mock Office files for testing
   */
  static async createMockOfficeFiles() {
    const mockFiles = {
      // Word documents
      'template.docx': this.createMockDocxBuffer(),
      'contract.docx': this.createMockDocxBuffer(),
      'report.docx': this.createMockDocxBuffer(),
      
      // Excel workbooks
      'spreadsheet.xlsx': this.createMockXlsxBuffer(),
      'financial.xlsx': this.createMockXlsxBuffer(),
      'analytics.xlsx': this.createMockXlsxBuffer(),
      
      // PowerPoint presentations
      'presentation.pptx': this.createMockPptxBuffer(),
      'training.pptx': this.createMockPptxBuffer(),
      'quarterly.pptx': this.createMockPptxBuffer(),
      
      // Legacy formats
      'legacy.doc': this.createMockDocBuffer(),
      'legacy.xls': this.createMockXlsBuffer(),
      'legacy.ppt': this.createMockPptBuffer()
    };

    for (const [filename, buffer] of Object.entries(mockFiles)) {
      const filePath = path.join(TEST_CONFIG.testDataDir, filename);
      await fs.writeFile(filePath, buffer);
    }
    
    console.log(`📄 Created ${Object.keys(mockFiles).length} mock Office files`);
  }

  /**
   * Create mock DOCX buffer (simplified ZIP structure)
   */
  static createMockDocxBuffer() {
    // This is a minimal valid DOCX structure for testing
    const docContent = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:r>
        <w:t>Sample document with {{variable}} and {{another_var|upper}}</w:t>
      </w:r>
    </w:p>
    <w:bookmarkStart w:id="0" w:name="bookmark1"/>
    <w:p>
      <w:r>
        <w:t>Content at bookmark</w:t>
      </w:r>
    </w:p>
    <w:bookmarkEnd w:id="0"/>
  </w:body>
</w:document>`;
    
    return Buffer.from(docContent, 'utf8');
  }

  /**
   * Create mock XLSX buffer (simplified structure)
   */
  static createMockXlsxBuffer() {
    const xlsxContent = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    <row r="1">
      <c r="A1" t="inlineStr">
        <is><t>{{header_1}}</t></is>
      </c>
      <c r="B1" t="inlineStr">
        <is><t>{{header_2}}</t></is>
      </c>
    </row>
    <row r="2">
      <c r="A2" t="inlineStr">
        <is><t>{{data_1}}</t></is>
      </c>
      <c r="B2" t="inlineStr">
        <is><t>{{data_2}}</t></is>
      </c>
    </row>
  </sheetData>
</worksheet>`;
    
    return Buffer.from(xlsxContent, 'utf8');
  }

  /**
   * Create mock PPTX buffer (simplified structure)
   */
  static createMockPptxBuffer() {
    const pptxContent = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:sp>
        <p:txBody>
          <a:p>
            <a:r>
              <a:t>{{slide_title}}</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>
      <p:sp>
        <p:txBody>
          <a:p>
            <a:r>
              <a:t>{{slide_content}}</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sld>`;
    
    return Buffer.from(pptxContent, 'utf8');
  }

  /**
   * Create mock legacy DOC buffer
   */
  static createMockDocBuffer() {
    return Buffer.from('Mock DOC content with {{variables}}', 'utf8');
  }

  /**
   * Create mock legacy XLS buffer
   */
  static createMockXlsBuffer() {
    return Buffer.from('Mock XLS content with {{data}}', 'utf8');
  }

  /**
   * Create mock legacy PPT buffer
   */
  static createMockPptBuffer() {
    return Buffer.from('Mock PPT content with {{slides}}', 'utf8');
  }

  /**
   * Create temporary test file
   */
  static async createTempFile(filename, content) {
    const filePath = path.join(TEST_CONFIG.tempDir, filename);
    await fs.writeFile(filePath, content);
    return filePath;
  }

  /**
   * Get test data file path
   */
  static getTestDataPath(filename) {
    return path.join(TEST_CONFIG.testDataDir, filename);
  }

  /**
   * Get temporary file path
   */
  static getTempPath(filename) {
    return path.join(TEST_CONFIG.tempDir, filename);
  }

  /**
   * Assert file exists
   */
  static async assertFileExists(filePath, message) {
    try {
      await fs.access(filePath);
    } catch (error) {
      throw new Error(message || `File does not exist: ${filePath}`);
    }
  }

  /**
   * Assert file contains content
   */
  static async assertFileContains(filePath, content, message) {
    const fileContent = await fs.readFile(filePath, 'utf8');
    assert.ok(
      fileContent.includes(content),
      message || `File ${filePath} does not contain: ${content}`
    );
  }

  /**
   * Run command and capture output
   */
  static async runCommand(command, args = [], options = {}) {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        ...options
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        resolve({
          code,
          stdout,
          stderr,
          success: code === 0
        });
      });

      child.on('error', reject);
    });
  }

  /**
   * Measure function execution time
   */
  static async measureTime(fn) {
    const start = process.hrtime.bigint();
    const result = await fn();
    const end = process.hrtime.bigint();
    const duration = Number(end - start) / 1000000; // Convert to milliseconds
    
    return { result, duration };
  }

  /**
   * Sleep for specified milliseconds
   */
  static sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Generate random test data
   */
  static generateRandomData(type = 'string', length = 10) {
    switch (type) {
      case 'string':
        return Math.random().toString(36).substring(2, length + 2);
      case 'number':
        return Math.floor(Math.random() * 1000);
      case 'boolean':
        return Math.random() > 0.5;
      case 'array':
        return Array.from({ length }, (_, i) => `item_${i}`);
      case 'object':
        return {
          id: this.generateRandomData('number'),
          name: this.generateRandomData('string'),
          active: this.generateRandomData('boolean')
        };
      default:
        return this.generateRandomData('string');
    }
  }

  /**
   * Create test variables object
   */
  static createTestVariables() {
    return {
      // Basic variables
      title: 'Test Document Title',
      author: 'Test Author',
      date: this.getDeterministicDate().toISOString().split('T')[0],
      
      // Content variables
      content: 'This is test content for the document.',
      description: 'A comprehensive test document for validation.',
      
      // Numeric variables
      revenue: 1250000,
      growth: 15.5,
      target: 1000000,
      
      // Array variables
      items: ['Item 1', 'Item 2', 'Item 3'],
      categories: ['Sales', 'Marketing', 'Development'],
      
      // Boolean variables
      isActive: true,
      showDetails: false,
      
      // Complex objects
      company: {
        name: 'Test Corp',
        address: '123 Test St',
        phone: '555-0123'
      },
      
      // Financial data
      quarterly_data: [
        { quarter: 'Q1', sales: 950000, profit: 142500 },
        { quarter: 'Q2', sales: 1080000, profit: 162000 },
        { quarter: 'Q3', sales: 1250000, profit: 187500 }
      ]
    };
  }

  /**
   * Validate Office file structure
   */
  static async validateOfficeFile(filePath, expectedType) {
    await this.assertFileExists(filePath);
    
    const stats = await fs.stat(filePath);
    assert.ok(stats.size > 0, `File ${filePath} is empty`);
    
    const ext = path.extname(filePath).toLowerCase();
    const validExtensions = {
      word: ['.docx', '.doc'],
      excel: ['.xlsx', '.xls'],
      powerpoint: ['.pptx', '.ppt']
    };
    
    if (expectedType && validExtensions[expectedType]) {
      assert.ok(
        validExtensions[expectedType].includes(ext),
        `File ${filePath} has invalid extension for ${expectedType}`
      );
    }
  }

  /**
   * Log test progress
   */
  static logProgress(message, type = 'info') {
    if (TEST_CONFIG.verbose || type === 'error') {
      const timestamp = this.getDeterministicDate().toISOString();
      const prefix = {
        info: '📘',
        success: '✅',
        warning: '⚠️',
        error: '❌'
      }[type] || '📘';
      
      console.log(`${prefix} [${timestamp}] ${message}`);
    }
  }
}

/**
 * Test suite runner
 */
export class TestSuiteRunner {
  constructor() {
    this.suites = new Map();
    this.hooks = {
      beforeAll: [],
      afterAll: [],
      beforeEach: [],
      afterEach: []
    };
  }

  /**
   * Register test suite
   */
  registerSuite(name, suiteFn) {
    this.suites.set(name, suiteFn);
  }

  /**
   * Add hook
   */
  addHook(type, fn) {
    if (this.hooks[type]) {
      this.hooks[type].push(fn);
    }
  }

  /**
   * Run all test suites
   */
  async runAllSuites() {
    const startTime = this.getDeterministicTimestamp();
    
    console.log('🚀 Starting Office functionality tests...');
    console.log(`📊 Running ${this.suites.size} test suites`);
    
    // Run beforeAll hooks
    for (const hook of this.hooks.beforeAll) {
      await hook();
    }

    let passedSuites = 0;
    let failedSuites = 0;

    for (const [suiteName, suiteFn] of this.suites) {
      try {
        console.log(`\n🔍 Running suite: ${suiteName}`);
        
        await suiteFn();
        passedSuites++;
        
        TestUtils.logProgress(`Suite ${suiteName} passed`, 'success');
      } catch (error) {
        failedSuites++;
        testStats.errors.push({ suite: suiteName, error: error.message });
        
        TestUtils.logProgress(`Suite ${suiteName} failed: ${error.message}`, 'error');
      }
    }

    // Run afterAll hooks
    for (const hook of this.hooks.afterAll) {
      await hook();
    }

    const endTime = this.getDeterministicTimestamp();
    const duration = endTime - startTime;

    // Print summary
    console.log('\n📊 Test Results Summary');
    console.log('========================');
    console.log(`Total Suites: ${this.suites.size}`);
    console.log(`Passed: ${passedSuites}`);
    console.log(`Failed: ${failedSuites}`);
    console.log(`Duration: ${duration}ms`);
    
    if (testStats.errors.length > 0) {
      console.log('\n❌ Errors:');
      testStats.errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error.suite}: ${error.error}`);
      });
    }

    const success = failedSuites === 0;
    console.log(`\n${success ? '✅' : '❌'} Tests ${success ? 'PASSED' : 'FAILED'}`);
    
    return success;
  }
}

// Global test runner instance
export const testRunner = new TestSuiteRunner();

// Setup and teardown hooks
testRunner.addHook('beforeAll', async () => {
  await TestUtils.setupTestEnvironment();
});

testRunner.addHook('afterAll', async () => {
  await TestUtils.cleanupTestEnvironment();
});

/**
 * Main test execution
 */
async function runTests() {
  try {
    // Import all test suites
    const testModules = [
      './unit/word-processor.test.js',
      './unit/excel-processor.test.js',
      './unit/powerpoint-processor.test.js',
      './unit/office-parser.test.js',
      './unit/office-injector.test.js',
      './integration/office-workflows.test.js',
      './integration/template-processing.test.js',
      './integration/batch-operations.test.js',
      './cli/office-commands.test.js',
      './performance/batch-performance.test.js'
    ];

    // Register test suites
    for (const moduleFile of testModules) {
      try {
        const module = await import(moduleFile);
        if (module.default || module.registerTests) {
          const registerFn = module.registerTests || module.default;
          await registerFn(testRunner);
        }
      } catch (error) {
        if (!error.message.includes('Cannot resolve module')) {
          console.warn(`⚠️ Failed to load test module ${moduleFile}: ${error.message}`);
        }
      }
    }

    // Run all tests
    const success = await testRunner.runAllSuites();
    
    process.exit(success ? 0 : 1);
  } catch (error) {
    console.error('❌ Test runner failed:', error);
    process.exit(1);
  }
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests();
}

export { TEST_CONFIG, testStats };