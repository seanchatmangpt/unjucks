import assert from 'assert';

/**
 * Unit Tests for Office Injector
 * Tests content injection functionality for Office documents
 */

// Mock OfficeInjector class for testing
class MockOfficeInjector {
  constructor(options = {}) {
    this.options = {
      preserveFormatting: true,
      createBackup: false,
      validateXml: true,
      ...options
    };
    this.supportedFormats = ['.docx', '.xlsx', '.pptx', '.doc', '.xls', '.ppt'];
  }

  async injectContent(filePath, injections) {
    if (!filePath) throw new Error('File path is required');
    if (!Array.isArray(injections)) throw new Error('Injections must be an array');

    const results = [];
    for (const injection of injections) {
      const result = await this.performInjection(filePath, injection);
      results.push(result);
    }

    return {
      success: true,
      filePath,
      injectionsApplied: results.length,
      results
    };
  }

  async performInjection(filePath, injection) {
    const { target, content, mode = 'replace' } = injection;
    
    if (!target) throw new Error('Target is required for injection');
    if (!content) throw new Error('Content is required for injection');

    // Simulate different injection modes
    switch (mode) {
      case 'replace':
        return { target, content, mode, applied: true };
      case 'append':
        return { target, content: content + ' [appended]', mode, applied: true };
      case 'prepend':
        return { target, content: '[prepended] ' + content, mode, applied: true };
      case 'insert':
        return { target, content, mode, position: injection.position || 0, applied: true };
      default:
        throw new Error(`Unknown injection mode: ${mode}`);
    }
  }

  async batchInject(operations) {
    if (!Array.isArray(operations)) throw new Error('Operations must be an array');

    const results = [];
    for (const operation of operations) {
      try {
        const result = await this.injectContent(operation.filePath, operation.injections);
        results.push({ ...result, status: 'success' });
      } catch (error) {
        results.push({ 
          filePath: operation.filePath, 
          status: 'error', 
          error: error.message 
        });
      }
    }

    return {
      totalOperations: operations.length,
      successful: results.filter(r => r.status === 'success').length,
      failed: results.filter(r => r.status === 'error').length,
      results
    };
  }

  supportsFormat(filePath) {
    const ext = filePath.toLowerCase().slice(filePath.lastIndexOf('.'));
    return this.supportedFormats.includes(ext);
  }

  async validateInjection(injection) {
    const errors = [];

    if (!injection.target) errors.push('Target is required');
    if (!injection.content) errors.push('Content is required');
    if (injection.mode && !['replace', 'append', 'prepend', 'insert'].includes(injection.mode)) {
      errors.push('Invalid injection mode');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

// Test suites
export const testSuites = [
  {
    name: 'Office Injector Construction',
    tests: [
      {
        name: 'should create injector with default options',
        test: async () => {
          const injector = new MockOfficeInjector();
          assert.strictEqual(injector.options.preserveFormatting, true);
          assert.strictEqual(injector.options.createBackup, false);
          assert.strictEqual(injector.options.validateXml, true);
          assert.ok(Array.isArray(injector.supportedFormats));
        }
      },
      {
        name: 'should create injector with custom options',
        test: async () => {
          const options = {
            preserveFormatting: false,
            createBackup: true,
            validateXml: false
          };
          const injector = new MockOfficeInjector(options);
          assert.strictEqual(injector.options.preserveFormatting, false);
          assert.strictEqual(injector.options.createBackup, true);
          assert.strictEqual(injector.options.validateXml, false);
        }
      }
    ]
  },
  
  {
    name: 'Content Injection',
    tests: [
      {
        name: 'should inject content with replace mode',
        test: async () => {
          const injector = new MockOfficeInjector();
          const injections = [{
            target: '{{title}}',
            content: 'Annual Report 2024',
            mode: 'replace'
          }];
          
          const result = await injector.injectContent('document.docx', injections);
          assert.strictEqual(result.success, true);
          assert.strictEqual(result.injectionsApplied, 1);
          assert.strictEqual(result.results[0].content, 'Annual Report 2024');
        }
      },
      {
        name: 'should inject content with append mode',
        test: async () => {
          const injector = new MockOfficeInjector();
          const injections = [{
            target: '{{content}}',
            content: 'New content',
            mode: 'append'
          }];
          
          const result = await injector.injectContent('document.docx', injections);
          assert.strictEqual(result.results[0].content, 'New content [appended]');
        }
      },
      {
        name: 'should inject content with prepend mode',
        test: async () => {
          const injector = new MockOfficeInjector();
          const injections = [{
            target: '{{header}}',
            content: 'Important',
            mode: 'prepend'
          }];
          
          const result = await injector.injectContent('document.docx', injections);
          assert.strictEqual(result.results[0].content, '[prepended] Important');
        }
      },
      {
        name: 'should handle multiple injections',
        test: async () => {
          const injector = new MockOfficeInjector();
          const injections = [
            { target: '{{title}}', content: 'Title', mode: 'replace' },
            { target: '{{subtitle}}', content: 'Subtitle', mode: 'replace' },
            { target: '{{footer}}', content: 'Footer', mode: 'append' }
          ];
          
          const result = await injector.injectContent('document.docx', injections);
          assert.strictEqual(result.injectionsApplied, 3);
          assert.strictEqual(result.results.length, 3);
        }
      }
    ]
  },

  {
    name: 'Batch Operations',
    tests: [
      {
        name: 'should process batch injections successfully',
        test: async () => {
          const injector = new MockOfficeInjector();
          const operations = [
            {
              filePath: 'doc1.docx',
              injections: [{ target: '{{title}}', content: 'Doc 1' }]
            },
            {
              filePath: 'doc2.docx', 
              injections: [{ target: '{{title}}', content: 'Doc 2' }]
            }
          ];
          
          const result = await injector.batchInject(operations);
          assert.strictEqual(result.totalOperations, 2);
          assert.strictEqual(result.successful, 2);
          assert.strictEqual(result.failed, 0);
        }
      },
      {
        name: 'should handle mixed success/failure in batch',
        test: async () => {
          const injector = new MockOfficeInjector();
          const operations = [
            {
              filePath: 'valid.docx',
              injections: [{ target: '{{title}}', content: 'Valid' }]
            },
            {
              filePath: '', // Invalid path
              injections: [{ target: '{{title}}', content: 'Invalid' }]
            }
          ];
          
          const result = await injector.batchInject(operations);
          assert.strictEqual(result.totalOperations, 2);
          assert.strictEqual(result.successful, 1);
          assert.strictEqual(result.failed, 1);
        }
      }
    ]
  },

  {
    name: 'Format Support',
    tests: [
      {
        name: 'should support Word formats',
        test: async () => {
          const injector = new MockOfficeInjector();
          assert.strictEqual(injector.supportsFormat('document.docx'), true);
          assert.strictEqual(injector.supportsFormat('document.doc'), true);
          assert.strictEqual(injector.supportsFormat('template.dotx'), false);
        }
      },
      {
        name: 'should support Excel formats', 
        test: async () => {
          const injector = new MockOfficeInjector();
          assert.strictEqual(injector.supportsFormat('spreadsheet.xlsx'), true);
          assert.strictEqual(injector.supportsFormat('spreadsheet.xls'), true);
          assert.strictEqual(injector.supportsFormat('template.xltx'), false);
        }
      },
      {
        name: 'should support PowerPoint formats',
        test: async () => {
          const injector = new MockOfficeInjector();
          assert.strictEqual(injector.supportsFormat('presentation.pptx'), true);
          assert.strictEqual(injector.supportsFormat('presentation.ppt'), true);
          assert.strictEqual(injector.supportsFormat('template.potx'), false);
        }
      },
      {
        name: 'should reject unsupported formats',
        test: async () => {
          const injector = new MockOfficeInjector();
          assert.strictEqual(injector.supportsFormat('document.pdf'), false);
          assert.strictEqual(injector.supportsFormat('image.jpg'), false);
          assert.strictEqual(injector.supportsFormat('text.txt'), false);
        }
      }
    ]
  },

  {
    name: 'Validation',
    tests: [
      {
        name: 'should validate correct injection',
        test: async () => {
          const injector = new MockOfficeInjector();
          const injection = {
            target: '{{variable}}',
            content: 'New value',
            mode: 'replace'
          };
          
          const result = await injector.validateInjection(injection);
          assert.strictEqual(result.valid, true);
          assert.strictEqual(result.errors.length, 0);
        }
      },
      {
        name: 'should detect missing target',
        test: async () => {
          const injector = new MockOfficeInjector();
          const injection = {
            content: 'New value',
            mode: 'replace'
          };
          
          const result = await injector.validateInjection(injection);
          assert.strictEqual(result.valid, false);
          assert.ok(result.errors.includes('Target is required'));
        }
      },
      {
        name: 'should detect missing content',
        test: async () => {
          const injector = new MockOfficeInjector();
          const injection = {
            target: '{{variable}}',
            mode: 'replace'
          };
          
          const result = await injector.validateInjection(injection);
          assert.strictEqual(result.valid, false);
          assert.ok(result.errors.includes('Content is required'));
        }
      },
      {
        name: 'should detect invalid injection mode',
        test: async () => {
          const injector = new MockOfficeInjector();
          const injection = {
            target: '{{variable}}',
            content: 'New value',
            mode: 'invalid'
          };
          
          const result = await injector.validateInjection(injection);
          assert.strictEqual(result.valid, false);
          assert.ok(result.errors.includes('Invalid injection mode'));
        }
      }
    ]
  },

  {
    name: 'Error Handling',
    tests: [
      {
        name: 'should throw error for missing file path',
        test: async () => {
          const injector = new MockOfficeInjector();
          const injections = [{ target: '{{var}}', content: 'value' }];
          
          try {
            await injector.injectContent('', injections);
            assert.fail('Should have thrown error');
          } catch (error) {
            assert.strictEqual(error.message, 'File path is required');
          }
        }
      },
      {
        name: 'should throw error for invalid injections parameter',
        test: async () => {
          const injector = new MockOfficeInjector();
          
          try {
            await injector.injectContent('file.docx', 'not-an-array');
            assert.fail('Should have thrown error');
          } catch (error) {
            assert.strictEqual(error.message, 'Injections must be an array');
          }
        }
      },
      {
        name: 'should throw error for missing injection target',
        test: async () => {
          const injector = new MockOfficeInjector();
          const injections = [{ content: 'value' }]; // Missing target
          
          try {
            await injector.injectContent('file.docx', injections);
            assert.fail('Should have thrown error');
          } catch (error) {
            assert.strictEqual(error.message, 'Target is required for injection');
          }
        }
      },
      {
        name: 'should throw error for unknown injection mode',
        test: async () => {
          const injector = new MockOfficeInjector();
          const injection = {
            target: '{{var}}',
            content: 'value',
            mode: 'unknown'
          };
          
          try {
            await injector.performInjection('file.docx', injection);
            assert.fail('Should have thrown error');
          } catch (error) {
            assert.strictEqual(error.message, 'Unknown injection mode: unknown');
          }
        }
      }
    ]
  }
];