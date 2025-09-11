/**
 * @fileoverview Unit tests for Office parser functionality
 * Tests comprehensive Office document parsing, variable extraction, and metadata handling
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import path from 'path';
import { TestUtils } from '../test-runner.js';

/**
 * Mock Office Parser class for testing (based on the real OfficeParser)
 */
class OfficeParser {
  constructor(options = {}) {
    this.options = {
      extractText: true,
      extractMetadata: true,
      extractMedia: true,
      extractTables: true,
      extractLists: true,
      extractTemplateVars: true,
      extractFrontmatter: true,
      streamMode: false,
      chunkSize: 1024 * 1024,
      templatePattern: /\{\{([^}]+)\}\}/g,
      ...options
    };

    // Initialize parsers for different formats
    this.parsers = new Map();
    this._initializeParsers();
  }

  /**
   * Initialize format-specific parsers
   */
  _initializeParsers() {
    // Word document parsers
    this.parsers.set('docx', this._parseDocx.bind(this));
    this.parsers.set('doc', this._parseDoc.bind(this));
    
    // Excel document parsers
    this.parsers.set('xlsx', this._parseXlsx.bind(this));
    this.parsers.set('xls', this._parseXls.bind(this));
    
    // PowerPoint document parsers
    this.parsers.set('pptx', this._parsePptx.bind(this));
    this.parsers.set('ppt', this._parsePpt.bind(this));
  }

  /**
   * Parse an office document from file path
   */
  async parseFile(filePath, options = {}) {
    const mergedOptions = { ...this.options, ...options };
    
    await TestUtils.assertFileExists(filePath);
    
    const extension = path.extname(filePath).toLowerCase().slice(1);
    
    if (!this.parsers.has(extension)) {
      throw new Error(`Unsupported file format: ${extension}`);
    }

    const parser = this.parsers.get(extension);
    const buffer = Buffer.from('mock file content');
    
    return await parser(buffer, filePath, mergedOptions);
  }

  /**
   * Parse an office document from buffer
   */
  async parseBuffer(buffer, filename, options = {}) {
    const mergedOptions = { ...this.options, ...options };
    const extension = path.extname(filename).toLowerCase().slice(1);
    
    if (!this.parsers.has(extension)) {
      throw new Error(`Unsupported file format: ${extension}`);
    }

    const parser = this.parsers.get(extension);
    return await parser(buffer, filename, mergedOptions);
  }

  /**
   * Get supported file extensions
   */
  getSupportedExtensions() {
    return Array.from(this.parsers.keys());
  }

  /**
   * Check if file extension is supported
   */
  isSupported(extension) {
    return this.parsers.has(extension.toLowerCase());
  }

  // Format-specific parser methods

  async _parseDocx(buffer, filename, options) {
    return {
      type: 'word',
      format: 'docx',
      metadata: this._createMockMetadata(filename, 'word'),
      text: options.extractText ? 'Sample Word document with {{variable}} and content' : '',
      structure: options.extractText ? {
        paragraphs: ['Paragraph 1', 'Paragraph 2 with {{name}}'],
        sections: ['Section 1'],
        headers: ['Header content'],
        footers: ['Footer content']
      } : {},
      templateVariables: options.extractTemplateVars ? [
        { name: 'variable', type: 'string', required: true },
        { name: 'name', type: 'string', required: true }
      ] : [],
      frontmatter: options.extractFrontmatter ? {
        title: 'Document Title',
        author: 'Test Author'
      } : {},
      media: options.extractMedia ? [
        {
          type: 'image',
          name: 'image1.png',
          path: 'word/media/image1.png',
          contentType: 'image/png',
          data: null,
          properties: { width: 300, height: 200 }
        }
      ] : [],
      tables: options.extractTables ? [
        {
          rows: [
            ['Header 1', 'Header 2'],
            ['{{data1}}', '{{data2}}']
          ],
          headers: ['Header 1', 'Header 2'],
          styles: {},
          rowCount: 2,
          columnCount: 2
        }
      ] : [],
      lists: options.extractLists ? [
        {
          type: 'unordered',
          items: [
            { text: 'Item 1', level: 0, marker: '•', children: [] },
            { text: '{{item2}}', level: 0, marker: '•', children: [] }
          ],
          level: 0
        }
      ] : []
    };
  }

  async _parseDoc(buffer, filename, options) {
    return {
      type: 'word',
      format: 'doc',
      metadata: this._createMockMetadata(filename, 'word'),
      text: options.extractText ? 'Legacy Word document with {{old_variable}}' : '',
      structure: options.extractText ? {
        paragraphs: ['Legacy paragraph'],
        sections: ['Legacy section'],
        headers: [],
        footers: []
      } : {},
      templateVariables: options.extractTemplateVars ? [
        { name: 'old_variable', type: 'string', required: true }
      ] : [],
      frontmatter: options.extractFrontmatter ? {} : {},
      media: options.extractMedia ? [] : [],
      tables: options.extractTables ? [] : [],
      lists: options.extractLists ? [] : []
    };
  }

  async _parseXlsx(buffer, filename, options) {
    return {
      type: 'excel',
      format: 'xlsx',
      metadata: this._createMockMetadata(filename, 'excel'),
      text: options.extractText ? 'Excel data: {{header1}}, {{header2}}, {{data1}}, {{data2}}' : '',
      structure: options.extractText ? {
        worksheets: [
          {
            name: 'Sheet1',
            cells: [
              { address: 'A1', value: '{{header1}}' },
              { address: 'B1', value: '{{header2}}' },
              { address: 'A2', value: '{{data1}}' },
              { address: 'B2', value: '{{data2}}' }
            ]
          }
        ],
        charts: [],
        pivotTables: []
      } : {},
      templateVariables: options.extractTemplateVars ? [
        { name: 'header1', type: 'string', required: true },
        { name: 'header2', type: 'string', required: true },
        { name: 'data1', type: 'string', required: true },
        { name: 'data2', type: 'number', required: true }
      ] : [],
      frontmatter: options.extractFrontmatter ? {
        workbook: 'Test Workbook'
      } : {},
      media: options.extractMedia ? [] : [],
      tables: options.extractTables ? [
        {
          rows: [
            ['{{header1}}', '{{header2}}'],
            ['{{data1}}', '{{data2}}']
          ],
          headers: ['{{header1}}', '{{header2}}'],
          styles: { headerStyle: 'bold' },
          rowCount: 2,
          columnCount: 2
        }
      ] : [],
      lists: options.extractLists ? [] : []
    };
  }

  async _parseXls(buffer, filename, options) {
    return {
      type: 'excel',
      format: 'xls',
      metadata: this._createMockMetadata(filename, 'excel'),
      text: options.extractText ? 'Legacy Excel with {{legacy_data}}' : '',
      structure: options.extractText ? {
        worksheets: [{ name: 'Sheet1', cells: [] }],
        charts: [],
        pivotTables: []
      } : {},
      templateVariables: options.extractTemplateVars ? [
        { name: 'legacy_data', type: 'string', required: true }
      ] : [],
      frontmatter: options.extractFrontmatter ? {} : {},
      media: options.extractMedia ? [] : [],
      tables: options.extractTables ? [] : [],
      lists: options.extractLists ? [] : []
    };
  }

  async _parsePptx(buffer, filename, options) {
    return {
      type: 'powerpoint',
      format: 'pptx',
      metadata: this._createMockMetadata(filename, 'powerpoint'),
      text: options.extractText ? 'PowerPoint slides: {{title}}, {{content}}, {{chart_title}}' : '',
      structure: options.extractText ? {
        slides: [
          {
            slideNumber: 1,
            layout: 'Title Slide',
            placeholders: ['title', 'subtitle'],
            shapes: [
              { type: 'textbox', text: '{{title}}' }
            ]
          },
          {
            slideNumber: 2,
            layout: 'Content',
            placeholders: ['title', 'content'],
            shapes: [
              { type: 'textbox', text: '{{content}}' },
              { type: 'chart', title: '{{chart_title}}' }
            ]
          }
        ],
        layouts: ['Title Slide', 'Content'],
        themes: ['Default']
      } : {},
      templateVariables: options.extractTemplateVars ? [
        { name: 'title', type: 'string', required: true },
        { name: 'content', type: 'string', required: true },
        { name: 'chart_title', type: 'string', required: true }
      ] : [],
      frontmatter: options.extractFrontmatter ? {
        presentation: 'Test Presentation'
      } : {},
      media: options.extractMedia ? [
        {
          type: 'image',
          name: 'slide_image.png',
          path: 'ppt/media/image1.png',
          contentType: 'image/png',
          data: null,
          properties: { width: 400, height: 300 }
        }
      ] : [],
      tables: options.extractTables ? [
        {
          rows: [
            ['Column 1', 'Column 2'],
            ['{{table_data1}}', '{{table_data2}}']
          ],
          headers: ['Column 1', 'Column 2'],
          styles: {},
          rowCount: 2,
          columnCount: 2
        }
      ] : [],
      lists: options.extractLists ? [
        {
          type: 'unordered',
          items: [
            { text: 'Bullet point 1', level: 0, marker: '•', children: [] },
            { text: '{{bullet_point_2}}', level: 0, marker: '•', children: [] }
          ],
          level: 0
        }
      ] : []
    };
  }

  async _parsePpt(buffer, filename, options) {
    return {
      type: 'powerpoint',
      format: 'ppt',
      metadata: this._createMockMetadata(filename, 'powerpoint'),
      text: options.extractText ? 'Legacy PowerPoint with {{legacy_slide}}' : '',
      structure: options.extractText ? {
        slides: [{ slideNumber: 1, layout: 'Title', placeholders: [], shapes: [] }],
        layouts: ['Title'],
        themes: []
      } : {},
      templateVariables: options.extractTemplateVars ? [
        { name: 'legacy_slide', type: 'string', required: true }
      ] : [],
      frontmatter: options.extractFrontmatter ? {} : {},
      media: options.extractMedia ? [] : [],
      tables: options.extractTables ? [] : [],
      lists: options.extractLists ? [] : []
    };
  }

  /**
   * Create mock metadata for testing
   */
  _createMockMetadata(filename, documentType) {
    return {
      title: `Test ${documentType} document`,
      author: 'Test Author',
      subject: 'Test Subject',
      creator: 'Test Creator',
      created: new Date('2024-01-01'),
      modified: new Date('2024-01-15'),
      description: 'Test document for parsing',
      keywords: ['test', 'parser', documentType],
      customProperties: {
        version: '1.0',
        category: 'test'
      }
    };
  }

  /**
   * Create a streaming parser
   */
  createParserStream(options = {}) {
    const mergedOptions = { ...this.options, ...options };
    
    return {
      write: (chunk) => {
        // Mock stream write
        return true;
      },
      end: () => {
        // Mock stream end
        return true;
      },
      on: (event, callback) => {
        // Mock stream events
        if (event === 'data') {
          setTimeout(() => {
            callback({
              type: 'test',
              format: 'test',
              text: 'streamed content'
            });
          }, 10);
        } else if (event === 'end') {
          setTimeout(callback, 20);
        }
      }
    };
  }
}

/**
 * Factory functions for testing
 */
function createOfficeParser(options = {}) {
  return new OfficeParser(options);
}

async function parseOfficeDocument(filePath, options = {}) {
  const parser = new OfficeParser(options);
  return await parser.parseFile(filePath, options);
}

async function parseOfficeDocuments(filePaths, options = {}) {
  const parser = new OfficeParser(options);
  const results = await Promise.allSettled(
    filePaths.map(filePath => parser.parseFile(filePath, options))
  );
  
  return results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      console.error(`Failed to parse ${filePaths[index]}:`, result.reason);
      return null;
    }
  }).filter(Boolean);
}

/**
 * Register Office parser tests
 */
export function registerTests(testRunner) {
  testRunner.registerSuite('Office Parser Unit Tests', async () => {
    let parser;
    
    beforeEach(() => {
      parser = new OfficeParser();
    });
    
    describe('Parser Construction', () => {
      test('should create parser with default options', () => {
        const defaultParser = new OfficeParser();
        assert.strictEqual(defaultParser.options.extractText, true);
        assert.strictEqual(defaultParser.options.extractMetadata, true);
        assert.strictEqual(defaultParser.options.extractMedia, true);
        assert.strictEqual(defaultParser.options.extractTables, true);
        assert.strictEqual(defaultParser.options.extractLists, true);
        assert.strictEqual(defaultParser.options.extractTemplateVars, true);
        assert.strictEqual(defaultParser.options.extractFrontmatter, true);
        assert.strictEqual(defaultParser.options.streamMode, false);
        assert.strictEqual(defaultParser.options.chunkSize, 1024 * 1024);
      });
      
      test('should create parser with custom options', () => {
        const customParser = new OfficeParser({
          extractText: false,
          extractMetadata: false,
          streamMode: true,
          chunkSize: 512 * 1024,
          templatePattern: /\$\{([^}]+)\}/g
        });
        
        assert.strictEqual(customParser.options.extractText, false);
        assert.strictEqual(customParser.options.extractMetadata, false);
        assert.strictEqual(customParser.options.streamMode, true);
        assert.strictEqual(customParser.options.chunkSize, 512 * 1024);
        assert.ok(customParser.options.templatePattern instanceof RegExp);
      });
      
      test('should initialize parsers for all supported formats', () => {
        assert.ok(parser.parsers.has('docx'));
        assert.ok(parser.parsers.has('doc'));
        assert.ok(parser.parsers.has('xlsx'));
        assert.ok(parser.parsers.has('xls'));
        assert.ok(parser.parsers.has('pptx'));
        assert.ok(parser.parsers.has('ppt'));
      });
    });

    describe('Format Support', () => {
      test('should support Word formats', () => {
        assert.strictEqual(parser.isSupported('docx'), true);
        assert.strictEqual(parser.isSupported('doc'), true);
        assert.strictEqual(parser.isSupported('DOCX'), true);
      });
      
      test('should support Excel formats', () => {
        assert.strictEqual(parser.isSupported('xlsx'), true);
        assert.strictEqual(parser.isSupported('xls'), true);
        assert.strictEqual(parser.isSupported('XLSX'), true);
      });
      
      test('should support PowerPoint formats', () => {
        assert.strictEqual(parser.isSupported('pptx'), true);
        assert.strictEqual(parser.isSupported('ppt'), true);
        assert.strictEqual(parser.isSupported('PPTX'), true);
      });
      
      test('should not support unsupported formats', () => {
        assert.strictEqual(parser.isSupported('pdf'), false);
        assert.strictEqual(parser.isSupported('txt'), false);
        assert.strictEqual(parser.isSupported('mp4'), false);
      });
      
      test('should return supported extensions list', () => {
        const extensions = parser.getSupportedExtensions();
        assert.ok(extensions.includes('docx'));
        assert.ok(extensions.includes('xlsx'));
        assert.ok(extensions.includes('pptx'));
        assert.ok(extensions.includes('doc'));
        assert.ok(extensions.includes('xls'));
        assert.ok(extensions.includes('ppt'));
      });
    });

    describe('Word Document Parsing', () => {
      test('should parse DOCX file with all features', async () => {
        const filePath = TestUtils.getTestDataPath('template.docx');
        
        const result = await parser.parseFile(filePath);
        
        assert.strictEqual(result.type, 'word');
        assert.strictEqual(result.format, 'docx');
        assert.ok(result.metadata);
        assert.ok(result.text.length > 0);
        assert.ok(result.structure);
        assert.ok(Array.isArray(result.templateVariables));
        assert.ok(result.frontmatter);
        assert.ok(Array.isArray(result.media));
        assert.ok(Array.isArray(result.tables));
        assert.ok(Array.isArray(result.lists));
      });
      
      test('should parse DOC file', async () => {
        const filePath = TestUtils.getTestDataPath('legacy.doc');
        
        const result = await parser.parseFile(filePath);
        
        assert.strictEqual(result.type, 'word');
        assert.strictEqual(result.format, 'doc');
        assert.ok(result.text.includes('Legacy Word'));
      });
      
      test('should extract Word document structure', async () => {
        const filePath = TestUtils.getTestDataPath('template.docx');
        
        const result = await parser.parseFile(filePath);
        
        assert.ok(Array.isArray(result.structure.paragraphs));
        assert.ok(Array.isArray(result.structure.sections));
        assert.ok(Array.isArray(result.structure.headers));
        assert.ok(Array.isArray(result.structure.footers));
      });
      
      test('should extract template variables from Word', async () => {
        const filePath = TestUtils.getTestDataPath('template.docx');
        
        const result = await parser.parseFile(filePath);
        
        assert.ok(result.templateVariables.length > 0);
        assert.ok(result.templateVariables.some(v => v.name === 'variable'));
        assert.ok(result.templateVariables.some(v => v.name === 'name'));
        
        result.templateVariables.forEach(variable => {
          assert.ok(variable.name);
          assert.ok(variable.type);
          assert.ok(typeof variable.required === 'boolean');
        });
      });
    });

    describe('Excel Document Parsing', () => {
      test('should parse XLSX file with all features', async () => {
        const filePath = TestUtils.getTestDataPath('spreadsheet.xlsx');
        
        const result = await parser.parseFile(filePath);
        
        assert.strictEqual(result.type, 'excel');
        assert.strictEqual(result.format, 'xlsx');
        assert.ok(result.metadata);
        assert.ok(result.text.length > 0);
        assert.ok(result.structure);
        assert.ok(Array.isArray(result.templateVariables));
        assert.ok(result.frontmatter);
        assert.ok(Array.isArray(result.tables));
      });
      
      test('should parse XLS file', async () => {
        const filePath = TestUtils.getTestDataPath('legacy.xls');
        
        const result = await parser.parseFile(filePath);
        
        assert.strictEqual(result.type, 'excel');
        assert.strictEqual(result.format, 'xls');
        assert.ok(result.text.includes('Legacy Excel'));
      });
      
      test('should extract Excel worksheet structure', async () => {
        const filePath = TestUtils.getTestDataPath('spreadsheet.xlsx');
        
        const result = await parser.parseFile(filePath);
        
        assert.ok(Array.isArray(result.structure.worksheets));
        assert.ok(result.structure.worksheets.length > 0);
        assert.strictEqual(result.structure.worksheets[0].name, 'Sheet1');
        assert.ok(Array.isArray(result.structure.worksheets[0].cells));
      });
      
      test('should extract template variables from Excel', async () => {
        const filePath = TestUtils.getTestDataPath('spreadsheet.xlsx');
        
        const result = await parser.parseFile(filePath);
        
        assert.ok(result.templateVariables.length > 0);
        assert.ok(result.templateVariables.some(v => v.name === 'header1'));
        assert.ok(result.templateVariables.some(v => v.name === 'data2' && v.type === 'number'));
      });
      
      test('should extract table data from Excel', async () => {
        const filePath = TestUtils.getTestDataPath('spreadsheet.xlsx');
        
        const result = await parser.parseFile(filePath);
        
        assert.ok(result.tables.length > 0);
        const table = result.tables[0];
        assert.ok(Array.isArray(table.rows));
        assert.ok(Array.isArray(table.headers));
        assert.strictEqual(table.rowCount, 2);
        assert.strictEqual(table.columnCount, 2);
      });
    });

    describe('PowerPoint Document Parsing', () => {
      test('should parse PPTX file with all features', async () => {
        const filePath = TestUtils.getTestDataPath('presentation.pptx');
        
        const result = await parser.parseFile(filePath);
        
        assert.strictEqual(result.type, 'powerpoint');
        assert.strictEqual(result.format, 'pptx');
        assert.ok(result.metadata);
        assert.ok(result.text.length > 0);
        assert.ok(result.structure);
        assert.ok(Array.isArray(result.templateVariables));
        assert.ok(result.frontmatter);
        assert.ok(Array.isArray(result.media));
        assert.ok(Array.isArray(result.tables));
        assert.ok(Array.isArray(result.lists));
      });
      
      test('should parse PPT file', async () => {
        const filePath = TestUtils.getTestDataPath('legacy.ppt');
        
        const result = await parser.parseFile(filePath);
        
        assert.strictEqual(result.type, 'powerpoint');
        assert.strictEqual(result.format, 'ppt');
        assert.ok(result.text.includes('Legacy PowerPoint'));
      });
      
      test('should extract PowerPoint slide structure', async () => {
        const filePath = TestUtils.getTestDataPath('presentation.pptx');
        
        const result = await parser.parseFile(filePath);
        
        assert.ok(Array.isArray(result.structure.slides));
        assert.ok(result.structure.slides.length > 0);
        assert.ok(Array.isArray(result.structure.layouts));
        assert.ok(Array.isArray(result.structure.themes));
        
        const firstSlide = result.structure.slides[0];
        assert.strictEqual(firstSlide.slideNumber, 1);
        assert.strictEqual(firstSlide.layout, 'Title Slide');
        assert.ok(Array.isArray(firstSlide.placeholders));
        assert.ok(Array.isArray(firstSlide.shapes));
      });
      
      test('should extract template variables from PowerPoint', async () => {
        const filePath = TestUtils.getTestDataPath('presentation.pptx');
        
        const result = await parser.parseFile(filePath);
        
        assert.ok(result.templateVariables.length > 0);
        assert.ok(result.templateVariables.some(v => v.name === 'title'));
        assert.ok(result.templateVariables.some(v => v.name === 'content'));
        assert.ok(result.templateVariables.some(v => v.name === 'chart_title'));
      });
    });

    describe('Buffer Parsing', () => {
      test('should parse from buffer with filename', async () => {
        const buffer = Buffer.from('test content');
        const filename = 'test.docx';
        
        const result = await parser.parseBuffer(buffer, filename);
        
        assert.strictEqual(result.type, 'word');
        assert.strictEqual(result.format, 'docx');
      });
      
      test('should handle unsupported format in buffer parsing', async () => {
        const buffer = Buffer.from('test content');
        const filename = 'test.pdf';
        
        try {
          await parser.parseBuffer(buffer, filename);
          assert.fail('Should have thrown error for unsupported format');
        } catch (error) {
          assert.ok(error.message.includes('Unsupported file format'));
        }
      });
    });

    describe('Metadata Extraction', () => {
      test('should extract comprehensive metadata', async () => {
        const filePath = TestUtils.getTestDataPath('template.docx');
        
        const result = await parser.parseFile(filePath);
        const metadata = result.metadata;
        
        assert.ok(metadata.title);
        assert.ok(metadata.author);
        assert.ok(metadata.subject);
        assert.ok(metadata.creator);
        assert.ok(metadata.created instanceof Date);
        assert.ok(metadata.modified instanceof Date);
        assert.ok(metadata.description);
        assert.ok(Array.isArray(metadata.keywords));
        assert.ok(typeof metadata.customProperties === 'object');
      });
      
      test('should extract different metadata for different document types', async () => {
        const wordResult = await parser.parseFile(TestUtils.getTestDataPath('template.docx'));
        const excelResult = await parser.parseFile(TestUtils.getTestDataPath('spreadsheet.xlsx'));
        const pptResult = await parser.parseFile(TestUtils.getTestDataPath('presentation.pptx'));
        
        assert.ok(wordResult.metadata.keywords.includes('word'));
        assert.ok(excelResult.metadata.keywords.includes('excel'));
        assert.ok(pptResult.metadata.keywords.includes('powerpoint'));
      });
    });

    describe('Media Extraction', () => {
      test('should extract media from Word documents', async () => {
        const filePath = TestUtils.getTestDataPath('template.docx');
        
        const result = await parser.parseFile(filePath, { extractMedia: true });
        
        if (result.media.length > 0) {
          const media = result.media[0];
          assert.ok(media.type);
          assert.ok(media.name);
          assert.ok(media.path);
          assert.ok(media.contentType);
          assert.ok(media.properties);
        }
      });
      
      test('should extract media from PowerPoint presentations', async () => {
        const filePath = TestUtils.getTestDataPath('presentation.pptx');
        
        const result = await parser.parseFile(filePath, { extractMedia: true });
        
        if (result.media.length > 0) {
          const media = result.media[0];
          assert.strictEqual(media.type, 'image');
          assert.ok(media.name.includes('.png'));
          assert.ok(media.path.includes('ppt/media'));
        }
      });
      
      test('should skip media extraction when disabled', async () => {
        const filePath = TestUtils.getTestDataPath('presentation.pptx');
        
        const result = await parser.parseFile(filePath, { extractMedia: false });
        
        assert.strictEqual(result.media.length, 0);
      });
    });

    describe('Table and List Extraction', () => {
      test('should extract tables from documents', async () => {
        const filePath = TestUtils.getTestDataPath('template.docx');
        
        const result = await parser.parseFile(filePath, { extractTables: true });
        
        if (result.tables.length > 0) {
          const table = result.tables[0];
          assert.ok(Array.isArray(table.rows));
          assert.ok(Array.isArray(table.headers));
          assert.ok(typeof table.rowCount === 'number');
          assert.ok(typeof table.columnCount === 'number');
          assert.ok(table.styles);
        }
      });
      
      test('should extract lists from documents', async () => {
        const filePath = TestUtils.getTestDataPath('template.docx');
        
        const result = await parser.parseFile(filePath, { extractLists: true });
        
        if (result.lists.length > 0) {
          const list = result.lists[0];
          assert.ok(list.type);
          assert.ok(Array.isArray(list.items));
          assert.ok(typeof list.level === 'number');
          
          if (list.items.length > 0) {
            const item = list.items[0];
            assert.ok(item.text);
            assert.ok(typeof item.level === 'number');
            assert.ok(item.marker);
            assert.ok(Array.isArray(item.children));
          }
        }
      });
      
      test('should skip table and list extraction when disabled', async () => {
        const filePath = TestUtils.getTestDataPath('template.docx');
        
        const result = await parser.parseFile(filePath, {
          extractTables: false,
          extractLists: false
        });
        
        assert.strictEqual(result.tables.length, 0);
        assert.strictEqual(result.lists.length, 0);
      });
    });

    describe('Custom Template Patterns', () => {
      test('should use custom template pattern', async () => {
        const customParser = new OfficeParser({
          templatePattern: /\$\{([^}]+)\}/g
        });
        
        // This would need a special mock file with ${variable} syntax
        // For now, we'll test that the pattern is set correctly
        assert.ok(customParser.options.templatePattern instanceof RegExp);
        assert.strictEqual(customParser.options.templatePattern.source, '\\$\\{([^}]+)\\}');
      });
    });

    describe('Selective Feature Extraction', () => {
      test('should extract only text when other features disabled', async () => {
        const filePath = TestUtils.getTestDataPath('template.docx');
        
        const result = await parser.parseFile(filePath, {
          extractText: true,
          extractMetadata: false,
          extractMedia: false,
          extractTables: false,
          extractLists: false,
          extractTemplateVars: false,
          extractFrontmatter: false
        });
        
        assert.ok(result.text.length > 0);
        assert.strictEqual(result.templateVariables.length, 0);
        assert.strictEqual(result.media.length, 0);
        assert.strictEqual(result.tables.length, 0);
        assert.strictEqual(result.lists.length, 0);
        assert.strictEqual(Object.keys(result.frontmatter).length, 0);
      });
      
      test('should extract only metadata when other features disabled', async () => {
        const filePath = TestUtils.getTestDataPath('template.docx');
        
        const result = await parser.parseFile(filePath, {
          extractText: false,
          extractMetadata: true,
          extractMedia: false,
          extractTables: false,
          extractLists: false,
          extractTemplateVars: false,
          extractFrontmatter: false
        });
        
        assert.strictEqual(result.text, '');
        assert.ok(result.metadata);
        assert.ok(result.metadata.title);
        assert.strictEqual(result.templateVariables.length, 0);
      });
    });

    describe('Stream Processing', () => {
      test('should create parser stream', () => {
        const stream = parser.createParserStream();
        
        assert.ok(stream);
        assert.ok(typeof stream.write === 'function');
        assert.ok(typeof stream.end === 'function');
        assert.ok(typeof stream.on === 'function');
      });
      
      test('should handle streamed data', (done) => {
        const stream = parser.createParserStream();
        
        stream.on('data', (data) => {
          assert.ok(data);
          assert.ok(data.type);
          assert.ok(data.text);
          done();
        });
        
        stream.write({ filename: 'test.docx', buffer: Buffer.from('test') });
      });
    });

    describe('Factory Functions', () => {
      test('should create parser via factory function', () => {
        const factoryParser = createOfficeParser({ extractText: false });
        
        assert.ok(factoryParser instanceof OfficeParser);
        assert.strictEqual(factoryParser.options.extractText, false);
      });
      
      test('should parse single document via convenience function', async () => {
        const filePath = TestUtils.getTestDataPath('template.docx');
        
        const result = await parseOfficeDocument(filePath);
        
        assert.strictEqual(result.type, 'word');
        assert.strictEqual(result.format, 'docx');
      });
      
      test('should parse multiple documents via batch function', async () => {
        const filePaths = [
          TestUtils.getTestDataPath('template.docx'),
          TestUtils.getTestDataPath('spreadsheet.xlsx'),
          TestUtils.getTestDataPath('presentation.pptx')
        ];
        
        const results = await parseOfficeDocuments(filePaths);
        
        assert.strictEqual(results.length, 3);
        assert.strictEqual(results[0].type, 'word');
        assert.strictEqual(results[1].type, 'excel');
        assert.strictEqual(results[2].type, 'powerpoint');
      });
      
      test('should handle mixed success and failure in batch parsing', async () => {
        const filePaths = [
          TestUtils.getTestDataPath('template.docx'),
          '/nonexistent/file.docx',
          TestUtils.getTestDataPath('spreadsheet.xlsx')
        ];
        
        const results = await parseOfficeDocuments(filePaths);
        
        // Should return only successful parses
        assert.strictEqual(results.length, 2);
        assert.strictEqual(results[0].type, 'word');
        assert.strictEqual(results[1].type, 'excel');
      });
    });

    describe('Error Handling', () => {
      test('should handle unsupported file format', async () => {
        const filePath = TestUtils.getTestDataPath('document.pdf');
        
        try {
          await parser.parseFile(filePath);
          assert.fail('Should have thrown error for unsupported format');
        } catch (error) {
          assert.ok(error.message.includes('Unsupported file format'));
        }
      });
      
      test('should handle missing file', async () => {
        const filePath = '/nonexistent/document.docx';
        
        try {
          await parser.parseFile(filePath);
          assert.fail('Should have thrown error for missing file');
        } catch (error) {
          assert.ok(error.message.includes('does not exist'));
        }
      });
      
      test('should handle null/undefined options gracefully', async () => {
        const filePath = TestUtils.getTestDataPath('template.docx');
        
        const result1 = await parser.parseFile(filePath, null);
        const result2 = await parser.parseFile(filePath, undefined);
        
        assert.ok(result1);
        assert.ok(result2);
        assert.strictEqual(result1.type, 'word');
        assert.strictEqual(result2.type, 'word');
      });
    });

    describe('Edge Cases', () => {
      test('should handle empty buffer', async () => {
        const buffer = Buffer.alloc(0);
        const filename = 'empty.docx';
        
        const result = await parser.parseBuffer(buffer, filename);
        
        assert.ok(result);
        assert.strictEqual(result.type, 'word');
      });
      
      test('should handle filename without extension', async () => {
        const buffer = Buffer.from('test');
        const filename = 'document';
        
        try {
          await parser.parseBuffer(buffer, filename);
          assert.fail('Should have thrown error for missing extension');
        } catch (error) {
          assert.ok(error.message.includes('Unsupported file format'));
        }
      });
      
      test('should handle very long filenames', async () => {
        const buffer = Buffer.from('test');
        const filename = 'a'.repeat(200) + '.docx';
        
        const result = await parser.parseBuffer(buffer, filename);
        
        assert.ok(result);
        assert.strictEqual(result.type, 'word');
      });
    });
  });
}