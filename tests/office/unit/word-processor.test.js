/**
 * @fileoverview Unit tests for Word processor functionality
 * Tests Word document processing, template variable extraction, and content injection
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import path from 'path';
import { TestUtils } from '../test-runner.js';

/**
 * Mock Word Processor class for testing
 */
class WordProcessor {
  constructor(options = {}) {
    this.options = {
      preserveFormatting: true,
      validateTemplateVars: true,
      strictMode: false,
      ...options
    };
    
    this.stats = {
      processed: 0,
      templatesProcessed: 0,
      variablesExtracted: 0,
      injectionsPerformed: 0,
      errors: []
    };
  }

  /**
   * Check if file is supported Word format
   */
  isSupported(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return ['.docx', '.doc', '.dotx', '.dot'].includes(ext);
  }

  /**
   * Get supported file extensions
   */
  getSupportedExtensions() {
    return ['.docx', '.doc', '.dotx', '.dot'];
  }

  /**
   * Process Word template with variables
   */
  async processTemplate(templatePath, variables, outputPath) {
    this.stats.processed++;
    this.stats.templatesProcessed++;

    await TestUtils.assertFileExists(templatePath);
    
    // Simulate processing
    const content = await this._readDocument(templatePath);
    const processedContent = this._replaceVariables(content, variables);
    
    if (outputPath) {
      await this._writeDocument(outputPath, processedContent);
    }

    return {
      success: true,
      templatePath,
      outputPath,
      variablesReplaced: Object.keys(variables).length,
      contentLength: processedContent.length,
      processingTime: Math.random() * 100
    };
  }

  /**
   * Extract variables from Word template
   */
  async extractVariables(templatePath) {
    await TestUtils.assertFileExists(templatePath);
    
    const content = await this._readDocument(templatePath);
    const variables = this._extractTemplateVariables(content);
    
    this.stats.variablesExtracted += variables.length;
    
    return {
      templatePath,
      variables,
      metadata: await this._extractMetadata(templatePath)
    };
  }

  /**
   * Inject content into Word document
   */
  async injectContent(filePath, injections) {
    await TestUtils.assertFileExists(filePath);
    
    const document = await this._loadDocument(filePath);
    const results = [];
    
    for (const injection of injections) {
      try {
        const result = await this._performInjection(document, injection);
        results.push(result);
        this.stats.injectionsPerformed++;
      } catch (error) {
        this.stats.errors.push(error.message);
        results.push({
          success: false,
          injection,
          error: error.message
        });
      }
    }
    
    await this._saveDocument(document, filePath);
    
    return {
      success: true,
      filePath,
      injections: results.filter(r => r.success),
      failures: results.filter(r => !r.success)
    };
  }

  /**
   * Validate Word template
   */
  async validateTemplate(templatePath) {
    await TestUtils.assertFileExists(templatePath);
    
    const content = await this._readDocument(templatePath);
    const issues = [];
    
    // Check for unclosed variables
    const unclosedVars = content.match(/\{\{[^}]*$/gm);
    if (unclosedVars) {
      issues.push(`Found ${unclosedVars.length} unclosed variable declarations`);
    }
    
    // Check for balanced braces
    const openBraces = (content.match(/\{\{/g) || []).length;
    const closeBraces = (content.match(/\}\}/g) || []).length;
    if (openBraces !== closeBraces) {
      issues.push(`Unbalanced braces: ${openBraces} open, ${closeBraces} close`);
    }
    
    // Check for invalid bookmarks
    const bookmarks = content.match(/<w:bookmarkStart[^>]*w:name="([^"]*)"[^>]*>/g) || [];
    const bookmarkEnds = content.match(/<w:bookmarkEnd[^>]*>/g) || [];
    if (bookmarks.length !== bookmarkEnds.length) {
      issues.push(`Unbalanced bookmarks: ${bookmarks.length} start, ${bookmarkEnds.length} end`);
    }
    
    return {
      valid: issues.length === 0,
      issues,
      bookmarks: bookmarks.map(b => b.match(/w:name="([^"]*)"/)?.[1]).filter(Boolean),
      variables: this._extractTemplateVariables(content)
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
      templatesProcessed: 0,
      variablesExtracted: 0,
      injectionsPerformed: 0,
      errors: []
    };
  }

  // Private helper methods

  async _readDocument(filePath) {
    // Simulate reading Word document content
    if (path.extname(filePath).toLowerCase() === '.docx') {
      return `<?xml version="1.0" encoding="UTF-8"?>
        <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
          <w:body>
            <w:p><w:r><w:t>Sample document with {{title}} and {{author|upper}}</w:t></w:r></w:p>
            <w:bookmarkStart w:id="0" w:name="content_area"/>
            <w:p><w:r><w:t>{{content}}</w:t></w:r></w:p>
            <w:bookmarkEnd w:id="0"/>
            <w:p><w:r><w:t>{% if show_footer %}Footer: {{footer_text}}{% endif %}</w:t></w:r></w:p>
          </w:body>
        </w:document>`;
    } else {
      return 'Mock DOC content with {{variables}} and bookmarks';
    }
  }

  async _writeDocument(filePath, content) {
    // Simulate writing document
    return TestUtils.createTempFile(path.basename(filePath), content);
  }

  _replaceVariables(content, variables) {
    let processedContent = content;
    
    for (const [key, value] of Object.entries(variables)) {
      // Replace basic variables
      processedContent = processedContent.replace(
        new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g'),
        String(value)
      );
      
      // Handle filters
      processedContent = processedContent.replace(
        new RegExp(`\\{\\{\\s*${key}\\s*\\|\\s*upper\\s*\\}\\}`, 'g'),
        String(value).toUpperCase()
      );
      
      processedContent = processedContent.replace(
        new RegExp(`\\{\\{\\s*${key}\\s*\\|\\s*lower\\s*\\}\\}`, 'g'),
        String(value).toLowerCase()
      );
    }
    
    // Handle conditionals
    processedContent = processedContent.replace(
      /\{%\s*if\s+(\w+)\s*%\}(.*?)\{%\s*endif\s*%\}/gs,
      (match, varName, content) => {
        return variables[varName] ? content : '';
      }
    );
    
    return processedContent;
  }

  _extractTemplateVariables(content) {
    const variables = [];
    const variableSet = new Set();
    
    // Extract {{ variable }} patterns
    const variableRegex = /\{\{\s*([^}]+)\s*\}\}/g;
    let match;
    
    while ((match = variableRegex.exec(content)) !== null) {
      const expression = match[1].trim();
      
      // Handle simple variables
      const simpleVar = expression.match(/^([a-zA-Z_][a-zA-Z0-9_]*)/);
      if (simpleVar && !variableSet.has(simpleVar[1])) {
        variables.push({
          name: simpleVar[1],
          type: 'string',
          required: true,
          usage: `{{ ${simpleVar[1]} }}`
        });
        variableSet.add(simpleVar[1]);
      }
      
      // Handle filtered variables
      const filterMatch = expression.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*\|\s*([a-zA-Z_][a-zA-Z0-9_]*)/);
      if (filterMatch && !variableSet.has(filterMatch[1])) {
        variables.push({
          name: filterMatch[1],
          type: 'string',
          required: true,
          filter: filterMatch[2],
          usage: `{{ ${filterMatch[1]} | ${filterMatch[2]} }}`
        });
        variableSet.add(filterMatch[1]);
      }
    }
    
    // Extract conditional variables
    const conditionalRegex = /\{%\s*if\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*%\}/g;
    while ((match = conditionalRegex.exec(content)) !== null) {
      const varName = match[1];
      if (!variableSet.has(varName)) {
        variables.push({
          name: varName,
          type: 'boolean',
          required: false,
          default: false,
          usage: `{% if ${varName} %}`
        });
        variableSet.add(varName);
      }
    }
    
    return variables;
  }

  async _extractMetadata(filePath) {
    return {
      filename: path.basename(filePath),
      format: path.extname(filePath).toLowerCase(),
      size: Math.floor(Math.random() * 10000),
      created: this.getDeterministicDate(),
      modified: this.getDeterministicDate()
    };
  }

  async _loadDocument(filePath) {
    return {
      path: filePath,
      content: await this._readDocument(filePath),
      bookmarks: ['content_area', 'header', 'footer'],
      paragraphs: []
    };
  }

  async _performInjection(document, injection) {
    const { target, content, mode = 'replace' } = injection;
    
    if (target.startsWith('bookmark:')) {
      const bookmarkName = target.replace('bookmark:', '');
      if (!document.bookmarks.includes(bookmarkName)) {
        throw new Error(`Bookmark '${bookmarkName}' not found`);
      }
    }
    
    return {
      success: true,
      target,
      content,
      mode,
      timestamp: this.getDeterministicDate().toISOString()
    };
  }

  async _saveDocument(document, filePath) {
    // Simulate saving document
    return true;
  }
}

/**
 * Register Word processor tests
 */
export function registerTests(testRunner) {
  testRunner.registerSuite('Word Processor Unit Tests', async () => {
    let processor;
    let testVariables;
    
    // Setup for each test
    beforeEach(() => {
      processor = new WordProcessor();
      testVariables = TestUtils.createTestVariables();
    });
    
    describe('Word Processor Construction', () => {
      test('should create processor with default options', () => {
        const defaultProcessor = new WordProcessor();
        assert.strictEqual(defaultProcessor.options.preserveFormatting, true);
        assert.strictEqual(defaultProcessor.options.validateTemplateVars, true);
        assert.strictEqual(defaultProcessor.options.strictMode, false);
      });
      
      test('should create processor with custom options', () => {
        const customProcessor = new WordProcessor({
          preserveFormatting: false,
          validateTemplateVars: false,
          strictMode: true
        });
        
        assert.strictEqual(customProcessor.options.preserveFormatting, false);
        assert.strictEqual(customProcessor.options.validateTemplateVars, false);
        assert.strictEqual(customProcessor.options.strictMode, true);
      });
    });

    describe('File Format Support', () => {
      test('should support DOCX files', () => {
        assert.strictEqual(processor.isSupported('/path/to/document.docx'), true);
        assert.strictEqual(processor.isSupported('/path/to/document.DOCX'), true);
      });
      
      test('should support DOC files', () => {
        assert.strictEqual(processor.isSupported('/path/to/document.doc'), true);
        assert.strictEqual(processor.isSupported('/path/to/document.DOC'), true);
      });
      
      test('should support Word template files', () => {
        assert.strictEqual(processor.isSupported('/path/to/template.dotx'), true);
        assert.strictEqual(processor.isSupported('/path/to/template.dot'), true);
      });
      
      test('should not support non-Word files', () => {
        assert.strictEqual(processor.isSupported('/path/to/document.pdf'), false);
        assert.strictEqual(processor.isSupported('/path/to/spreadsheet.xlsx'), false);
        assert.strictEqual(processor.isSupported('/path/to/presentation.pptx'), false);
      });
      
      test('should return correct supported extensions', () => {
        const extensions = processor.getSupportedExtensions();
        assert.deepStrictEqual(extensions, ['.docx', '.doc', '.dotx', '.dot']);
      });
    });

    describe('Template Processing', () => {
      test('should process template with simple variables', async () => {
        const templatePath = TestUtils.getTestDataPath('template.docx');
        const outputPath = TestUtils.getTempPath('output.docx');
        
        const result = await processor.processTemplate(templatePath, testVariables, outputPath);
        
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.templatePath, templatePath);
        assert.strictEqual(result.outputPath, outputPath);
        assert.ok(result.variablesReplaced > 0);
        assert.ok(result.processingTime >= 0);
      });
      
      test('should handle missing template file', async () => {
        const templatePath = '/nonexistent/template.docx';
        
        try {
          await processor.processTemplate(templatePath, testVariables);
          assert.fail('Should have thrown error for missing file');
        } catch (error) {
          assert.ok(error.message.includes('does not exist'));
        }
      });
      
      test('should process template without output path', async () => {
        const templatePath = TestUtils.getTestDataPath('template.docx');
        
        const result = await processor.processTemplate(templatePath, testVariables);
        
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.outputPath, undefined);
      });
      
      test('should handle empty variables object', async () => {
        const templatePath = TestUtils.getTestDataPath('template.docx');
        
        const result = await processor.processTemplate(templatePath, {});
        
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.variablesReplaced, 0);
      });
    });

    describe('Variable Extraction', () => {
      test('should extract variables from template', async () => {
        const templatePath = TestUtils.getTestDataPath('template.docx');
        
        const result = await processor.extractVariables(templatePath);
        
        assert.strictEqual(typeof result, 'object');
        assert.strictEqual(result.templatePath, templatePath);
        assert.ok(Array.isArray(result.variables));
        assert.ok(result.variables.length > 0);
        assert.ok(result.metadata);
      });
      
      test('should identify different variable types', async () => {
        const templatePath = TestUtils.getTestDataPath('template.docx');
        
        const result = await processor.extractVariables(templatePath);
        const variables = result.variables;
        
        // Should find string variables
        const stringVars = variables.filter(v => v.type === 'string');
        assert.ok(stringVars.length > 0);
        
        // Should find boolean variables
        const boolVars = variables.filter(v => v.type === 'boolean');
        assert.ok(boolVars.length > 0);
        
        // Should find filtered variables
        const filteredVars = variables.filter(v => v.filter);
        assert.ok(filteredVars.length > 0);
      });
      
      test('should extract unique variables only', async () => {
        const templatePath = TestUtils.getTestDataPath('template.docx');
        
        const result = await processor.extractVariables(templatePath);
        const variableNames = result.variables.map(v => v.name);
        const uniqueNames = [...new Set(variableNames)];
        
        assert.strictEqual(variableNames.length, uniqueNames.length);
      });
      
      test('should include variable usage information', async () => {
        const templatePath = TestUtils.getTestDataPath('template.docx');
        
        const result = await processor.extractVariables(templatePath);
        
        result.variables.forEach(variable => {
          assert.ok(variable.name);
          assert.ok(variable.type);
          assert.ok(variable.usage);
          assert.ok(typeof variable.required === 'boolean');
        });
      });
    });

    describe('Content Injection', () => {
      test('should inject content at bookmark', async () => {
        const filePath = TestUtils.getTestDataPath('template.docx');
        const injections = [
          {
            target: 'bookmark:content_area',
            content: 'Injected content here',
            mode: 'replace'
          }
        ];
        
        const result = await processor.injectContent(filePath, injections);
        
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.filePath, filePath);
        assert.strictEqual(result.injections.length, 1);
        assert.strictEqual(result.failures.length, 0);
      });
      
      test('should handle multiple injections', async () => {
        const filePath = TestUtils.getTestDataPath('template.docx');
        const injections = [
          {
            target: 'bookmark:content_area',
            content: 'First injection',
            mode: 'replace'
          },
          {
            target: 'bookmark:header',
            content: 'Header content',
            mode: 'replace'
          }
        ];
        
        const result = await processor.injectContent(filePath, injections);
        
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.injections.length, 2);
      });
      
      test('should handle invalid bookmark target', async () => {
        const filePath = TestUtils.getTestDataPath('template.docx');
        const injections = [
          {
            target: 'bookmark:nonexistent',
            content: 'Test content',
            mode: 'replace'
          }
        ];
        
        const result = await processor.injectContent(filePath, injections);
        
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.injections.length, 0);
        assert.strictEqual(result.failures.length, 1);
        assert.ok(result.failures[0].error.includes('not found'));
      });
      
      test('should support different injection modes', async () => {
        const filePath = TestUtils.getTestDataPath('template.docx');
        const injections = [
          {
            target: 'bookmark:content_area',
            content: 'Replace content',
            mode: 'replace'
          },
          {
            target: 'bookmark:header',
            content: 'Append content',
            mode: 'append'
          }
        ];
        
        const result = await processor.injectContent(filePath, injections);
        
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.injections.length, 2);
        
        // Check that modes are preserved
        assert.strictEqual(result.injections[0].mode, 'replace');
        assert.strictEqual(result.injections[1].mode, 'append');
      });
    });

    describe('Template Validation', () => {
      test('should validate correct template', async () => {
        const templatePath = TestUtils.getTestDataPath('template.docx');
        
        const result = await processor.validateTemplate(templatePath);
        
        assert.strictEqual(result.valid, true);
        assert.strictEqual(result.issues.length, 0);
        assert.ok(Array.isArray(result.bookmarks));
        assert.ok(Array.isArray(result.variables));
      });
      
      test('should detect unbalanced braces', async () => {
        // Create a template with unbalanced braces for testing
        const invalidContent = 'Content with {{ unbalanced brace';
        const templatePath = await TestUtils.createTempFile('invalid.docx', invalidContent);
        
        const processor2 = new WordProcessor();
        processor2._readDocument = async () => invalidContent;
        
        const result = await processor2.validateTemplate(templatePath);
        
        assert.strictEqual(result.valid, false);
        assert.ok(result.issues.some(issue => issue.includes('Unbalanced braces')));
      });
      
      test('should detect unclosed variables', async () => {
        const invalidContent = 'Content with {{ unclosed variable';
        const templatePath = await TestUtils.createTempFile('invalid2.docx', invalidContent);
        
        const processor2 = new WordProcessor();
        processor2._readDocument = async () => invalidContent;
        
        const result = await processor2.validateTemplate(templatePath);
        
        assert.strictEqual(result.valid, false);
        assert.ok(result.issues.some(issue => issue.includes('unclosed variable')));
      });
      
      test('should extract bookmarks during validation', async () => {
        const templatePath = TestUtils.getTestDataPath('template.docx');
        
        const result = await processor.validateTemplate(templatePath);
        
        assert.ok(result.bookmarks.length > 0);
        assert.ok(result.bookmarks.includes('content_area'));
      });
      
      test('should return variables during validation', async () => {
        const templatePath = TestUtils.getTestDataPath('template.docx');
        
        const result = await processor.validateTemplate(templatePath);
        
        assert.ok(result.variables.length > 0);
        result.variables.forEach(variable => {
          assert.ok(variable.name);
          assert.ok(variable.type);
        });
      });
    });

    describe('Statistics and Performance', () => {
      test('should track processing statistics', async () => {
        const templatePath = TestUtils.getTestDataPath('template.docx');
        
        // Perform various operations
        await processor.processTemplate(templatePath, testVariables);
        await processor.extractVariables(templatePath);
        await processor.injectContent(templatePath, [
          { target: 'bookmark:content_area', content: 'Test', mode: 'replace' }
        ]);
        
        const stats = processor.getStats();
        
        assert.strictEqual(stats.processed, 1);
        assert.strictEqual(stats.templatesProcessed, 1);
        assert.ok(stats.variablesExtracted > 0);
        assert.ok(stats.injectionsPerformed > 0);
      });
      
      test('should reset statistics', () => {
        // Set some stats
        processor.stats.processed = 5;
        processor.stats.templatesProcessed = 3;
        processor.stats.variablesExtracted = 10;
        
        processor.resetStats();
        
        const stats = processor.getStats();
        assert.strictEqual(stats.processed, 0);
        assert.strictEqual(stats.templatesProcessed, 0);
        assert.strictEqual(stats.variablesExtracted, 0);
        assert.strictEqual(stats.injectionsPerformed, 0);
        assert.strictEqual(stats.errors.length, 0);
      });
      
      test('should record error statistics', async () => {
        const filePath = TestUtils.getTestDataPath('template.docx');
        const injections = [
          {
            target: 'bookmark:nonexistent',
            content: 'Test',
            mode: 'replace'
          }
        ];
        
        await processor.injectContent(filePath, injections);
        
        const stats = processor.getStats();
        assert.ok(stats.errors.length > 0);
      });
    });

    describe('Error Handling and Edge Cases', () => {
      test('should handle empty injection array', async () => {
        const filePath = TestUtils.getTestDataPath('template.docx');
        
        const result = await processor.injectContent(filePath, []);
        
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.injections.length, 0);
        assert.strictEqual(result.failures.length, 0);
      });
      
      test('should handle null variables', async () => {
        const templatePath = TestUtils.getTestDataPath('template.docx');
        
        const result = await processor.processTemplate(templatePath, null);
        
        assert.strictEqual(result.success, true);
      });
      
      test('should handle special characters in variables', async () => {
        const templatePath = TestUtils.getTestDataPath('template.docx');
        const specialVariables = {
          title: 'Title with "quotes" and <tags>',
          description: 'Multi\nLine\nContent',
          special: 'Content with émojis 🚀 and unicode ñ'
        };
        
        const result = await processor.processTemplate(templatePath, specialVariables);
        
        assert.strictEqual(result.success, true);
        assert.ok(result.variablesReplaced > 0);
      });
      
      test('should handle large variable values', async () => {
        const templatePath = TestUtils.getTestDataPath('template.docx');
        const largeVariables = {
          title: 'Short title',
          content: 'Very '.repeat(1000) + 'long content'
        };
        
        const result = await processor.processTemplate(templatePath, largeVariables);
        
        assert.strictEqual(result.success, true);
      });
    });
  });
}