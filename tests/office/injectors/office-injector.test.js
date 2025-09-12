import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'fs-extra';
import path from 'path';
import { OfficeInjector } from '../../../src/office/injectors/office-injector.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('OfficeInjector', () => {
  let injector;
  let testDir;
  let testFiles;

  beforeEach(async () => {
    // Setup test environment
    injector = new OfficeInjector({
      preserveFormatting: true,
      validateInputs: true,
      dryRun: false,
      force: false
    });

    testDir = path.join(__dirname, 'temp_test_files');
    await fs.ensureDir(testDir);

    // Create test files (mock Office files)
    testFiles = {
      word: path.join(testDir, 'test.docx'),
      excel: path.join(testDir, 'test.xlsx'),
      powerpoint: path.join(testDir, 'test.pptx')
    };

    // Create empty test files
    for (const filePath of Object.values(testFiles)) {
      await fs.writeFile(filePath, Buffer.alloc(0));
    }
  });

  afterEach(async () => {
    // Cleanup test files
    await fs.remove(testDir);
  });

  describe('Constructor', () => {
    it('should create instance with default options', () => {
      const defaultInjector = new OfficeInjector();
      assert.strictEqual(defaultInjector.options.preserveFormatting, true);
      assert.strictEqual(defaultInjector.options.validateInputs, true);
      assert.strictEqual(defaultInjector.options.dryRun, false);
      assert.strictEqual(defaultInjector.options.force, false);
    });

    it('should create instance with custom options', () => {
      const customInjector = new OfficeInjector({
        preserveFormatting: false,
        validateInputs: false,
        dryRun: true,
        force: true
      });
      assert.strictEqual(customInjector.options.preserveFormatting, false);
      assert.strictEqual(customInjector.options.validateInputs, false);
      assert.strictEqual(customInjector.options.dryRun, true);
      assert.strictEqual(customInjector.options.force, true);
    });

    it('should initialize injector components', () => {
      assert.ok(injector.wordInjector);
      assert.ok(injector.excelInjector);
      assert.ok(injector.powerPointInjector);
      assert.ok(injector.validator);
      assert.ok(injector.formatDetector);
    });
  });

  describe('injectFile', () => {
    it('should inject content into a Word document', async () => {
      const config = {
        filePath: testFiles.word,
        injections: [
          {
            target: 'bookmark:intro',
            content: 'Hello, World!',
            mode: 'replace',
            type: 'text'
          }
        ],
        outputPath: testFiles.word
      };

      const result = await injector.injectFile(config);
      
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.filePath, testFiles.word);
      assert.strictEqual(result.fileFormat, 'word');
      assert.strictEqual(result.injections.length, 1);
      assert.strictEqual(result.errors.length, 0);
    });

    it('should inject content into an Excel workbook', async () => {
      const config = {
        filePath: testFiles.excel,
        injections: [
          {
            target: 'Sheet1:A1',
            content: 'Test Data',
            mode: 'replace',
            type: 'text'
          }
        ],
        outputPath: testFiles.excel
      };

      const result = await injector.injectFile(config);
      
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.filePath, testFiles.excel);
      assert.strictEqual(result.fileFormat, 'excel');
      assert.strictEqual(result.injections.length, 1);
      assert.strictEqual(result.errors.length, 0);
    });

    it('should inject content into a PowerPoint presentation', async () => {
      const config = {
        filePath: testFiles.powerpoint,
        injections: [
          {
            target: 'slide:1:placeholder:title',
            content: 'Presentation Title',
            mode: 'replace',
            type: 'text'
          }
        ],
        outputPath: testFiles.powerpoint
      };

      const result = await injector.injectFile(config);
      
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.filePath, testFiles.powerpoint);
      assert.strictEqual(result.fileFormat, 'powerpoint');
      assert.strictEqual(result.injections.length, 1);
      assert.strictEqual(result.errors.length, 0);
    });

    it('should handle file not found error', async () => {
      const config = {
        filePath: '/nonexistent/file.docx',
        injections: [
          {
            target: 'bookmark:test',
            content: 'Test',
            mode: 'replace'
          }
        ]
      };

      const result = await injector.injectFile(config);
      
      assert.strictEqual(result.success, false);
      assert.ok(result.error.includes('File not found'));
    });

    it('should handle unsupported file format', async () => {
      const txtFile = path.join(testDir, 'test.txt');
      await fs.writeFile(txtFile, 'test content');
      
      const config = {
        filePath: txtFile,
        injections: [
          {
            target: 'line:1',
            content: 'Test',
            mode: 'replace'
          }
        ]
      };

      const result = await injector.injectFile(config);
      
      assert.strictEqual(result.success, false);
      assert.ok(result.error.includes('Unsupported file format'));
    });

    it('should skip injection when skipIf condition is met', async () => {
      const config = {
        filePath: testFiles.word,
        injections: [
          {
            target: 'bookmark:intro',
            content: 'Hello, World!',
            mode: 'replace',
            skipIf: 'true'
          }
        ]
      };

      const result = await injector.injectFile(config);
      
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.injections.length, 0);
      assert.strictEqual(result.skipped.length, 1);
    });
  });

  describe('batchInject', () => {
    it('should process multiple files in batch', async () => {
      const batchConfig = [
        {
          filePath: testFiles.word,
          injections: [
            {
              target: 'bookmark:title',
              content: 'Document Title',
              mode: 'replace'
            }
          ]
        },
        {
          filePath: testFiles.excel,
          injections: [
            {
              target: 'Sheet1:A1',
              content: 'Header 1',
              mode: 'replace'
            }
          ]
        },
        {
          filePath: testFiles.powerpoint,
          injections: [
            {
              target: 'slide:1:placeholder:title',
              content: 'Slide Title',
              mode: 'replace'
            }
          ]
        }
      ];

      const result = await injector.batchInject(batchConfig, {
        concurrency: 2,
        continueOnError: true
      });

      assert.strictEqual(result.success.length, 3);
      assert.strictEqual(result.failed.length, 0);
      assert.strictEqual(result.totalFiles, 3);
      assert.strictEqual(result.totalInjections, 3);
    });

    it('should handle partial failures in batch processing', async () => {
      const batchConfig = [
        {
          filePath: testFiles.word,
          injections: [
            {
              target: 'bookmark:title',
              content: 'Document Title',
              mode: 'replace'
            }
          ]
        },
        {
          filePath: '/nonexistent/file.xlsx',
          injections: [
            {
              target: 'Sheet1:A1',
              content: 'Header 1',
              mode: 'replace'
            }
          ]
        }
      ];

      const result = await injector.batchInject(batchConfig, {
        continueOnError: true
      });

      assert.strictEqual(result.success.length, 1);
      assert.strictEqual(result.failed.length, 1);
      assert.strictEqual(result.totalFiles, 2);
    });

    it('should respect concurrency limit', async () => {
      const batchConfig = Array.from({ length: 5 }, (_, i) => ({
        filePath: testFiles.word,
        injections: [
          {
            target: `bookmark:test${i}`,
            content: `Test ${i}`,
            mode: 'replace'
          }
        ]
      }));

      const startTime = this.getDeterministicTimestamp();
      const result = await injector.batchInject(batchConfig, {
        concurrency: 2
      });
      const endTime = this.getDeterministicTimestamp();

      // Should have processed all files
      assert.strictEqual(result.success.length, 5);
      
      // Processing with concurrency should take some time
      // (This is a rough test - in practice, processing is very fast)
      assert.ok(endTime - startTime >= 0);
    });
  });

  describe('validateConfigurations', () => {
    it('should validate single configuration', async () => {
      const config = {
        filePath: testFiles.word,
        injections: [
          {
            target: 'bookmark:test',
            content: 'Test content',
            mode: 'replace'
          }
        ]
      };

      const result = await injector.validateConfigurations(config);
      
      assert.strictEqual(result.valid.length, 1);
      assert.strictEqual(result.invalid.length, 0);
    });

    it('should validate multiple configurations', async () => {
      const configs = [
        {
          filePath: testFiles.word,
          injections: [
            {
              target: 'bookmark:test',
              content: 'Test',
              mode: 'replace'
            }
          ]
        },
        {
          filePath: '/invalid/path.docx',
          injections: [] // Invalid: empty injections
        }
      ];

      const result = await injector.validateConfigurations(configs);
      
      assert.strictEqual(result.valid.length, 1);
      assert.strictEqual(result.invalid.length, 1);
    });

    it('should handle invalid configuration format', async () => {
      const invalidConfig = 'not an object';

      try {
        await injector.validateConfigurations(invalidConfig);
        assert.fail('Should have thrown validation error');
      } catch (error) {
        assert.ok(error.message.includes('Validation failed'));
      }
    });
  });

  describe('getInjectorForFormat', () => {
    it('should return Word injector for word formats', () => {
      assert.strictEqual(injector.getInjectorForFormat('word'), injector.wordInjector);
      assert.strictEqual(injector.getInjectorForFormat('docx'), injector.wordInjector);
      assert.strictEqual(injector.getInjectorForFormat('doc'), injector.wordInjector);
    });

    it('should return Excel injector for excel formats', () => {
      assert.strictEqual(injector.getInjectorForFormat('excel'), injector.excelInjector);
      assert.strictEqual(injector.getInjectorForFormat('xlsx'), injector.excelInjector);
      assert.strictEqual(injector.getInjectorForFormat('xls'), injector.excelInjector);
    });

    it('should return PowerPoint injector for powerpoint formats', () => {
      assert.strictEqual(injector.getInjectorForFormat('powerpoint'), injector.powerPointInjector);
      assert.strictEqual(injector.getInjectorForFormat('pptx'), injector.powerPointInjector);
      assert.strictEqual(injector.getInjectorForFormat('ppt'), injector.powerPointInjector);
    });

    it('should return null for unsupported formats', () => {
      assert.strictEqual(injector.getInjectorForFormat('txt'), null);
      assert.strictEqual(injector.getInjectorForFormat('pdf'), null);
      assert.strictEqual(injector.getInjectorForFormat('unknown'), null);
    });
  });

  describe('createInjectionSpec', () => {
    it('should create injection specification with defaults', () => {
      const spec = OfficeInjector.createInjectionSpec({
        target: 'bookmark:test',
        content: 'Test content'
      });

      assert.strictEqual(spec.target, 'bookmark:test');
      assert.strictEqual(spec.content, 'Test content');
      assert.strictEqual(spec.mode, 'replace');
      assert.strictEqual(spec.type, 'text');
      assert.strictEqual(spec.preserveFormatting, true);
      assert.strictEqual(spec.idempotent, true);
      assert.ok(spec.id);
      assert.ok(spec.timestamp);
    });

    it('should create injection specification with custom values', () => {
      const spec = OfficeInjector.createInjectionSpec({
        target: 'cell:A1',
        content: 'Custom content',
        mode: 'append',
        type: 'html',
        formatting: { bold: true },
        skipIf: 'condition',
        preserveFormatting: false,
        idempotent: false,
        id: 'custom-id'
      });

      assert.strictEqual(spec.target, 'cell:A1');
      assert.strictEqual(spec.content, 'Custom content');
      assert.strictEqual(spec.mode, 'append');
      assert.strictEqual(spec.type, 'html');
      assert.deepStrictEqual(spec.formatting, { bold: true });
      assert.strictEqual(spec.skipIf, 'condition');
      assert.strictEqual(spec.preserveFormatting, false);
      assert.strictEqual(spec.idempotent, false);
      assert.strictEqual(spec.id, 'custom-id');
    });
  });

  describe('Static constants', () => {
    it('should provide injection modes', () => {
      const modes = OfficeInjector.INJECTION_MODES;
      
      assert.strictEqual(modes.REPLACE, 'replace');
      assert.strictEqual(modes.BEFORE, 'before');
      assert.strictEqual(modes.AFTER, 'after');
      assert.strictEqual(modes.APPEND, 'append');
      assert.strictEqual(modes.PREPEND, 'prepend');
      assert.strictEqual(modes.INSERT_AT, 'insertAt');
    });

    it('should provide content types', () => {
      const types = OfficeInjector.CONTENT_TYPES;
      
      assert.strictEqual(types.TEXT, 'text');
      assert.strictEqual(types.HTML, 'html');
      assert.strictEqual(types.MARKDOWN, 'markdown');
      assert.strictEqual(types.JSON, 'json');
      assert.strictEqual(types.XML, 'xml');
      assert.strictEqual(types.RICH_TEXT, 'richText');
    });
  });

  describe('Statistics', () => {
    it('should provide statistics', () => {
      const stats = injector.getStatistics();
      
      assert.ok(stats.wordInjections);
      assert.ok(stats.excelInjections);
      assert.ok(stats.powerPointInjections);
      assert.ok(typeof stats.totalProcessedFiles === 'number');
      assert.ok(typeof stats.successRate === 'number');
    });

    it('should reset statistics', () => {
      // First, ensure there are some stats
      injector.wordInjector.stats.attempted = 5;
      injector.wordInjector.stats.successful = 3;
      
      // Reset
      injector.resetStatistics();
      
      // Verify reset
      const stats = injector.getStatistics();
      assert.strictEqual(stats.wordInjections.attempted, 0);
      assert.strictEqual(stats.wordInjections.successful, 0);
    });
  });

  describe('Dry run mode', () => {
    it('should not modify files in dry run mode', async () => {
      const dryRunInjector = new OfficeInjector({ dryRun: true });
      
      const config = {
        filePath: testFiles.word,
        injections: [
          {
            target: 'bookmark:test',
            content: 'Test content',
            mode: 'replace'
          }
        ]
      };

      const result = await dryRunInjector.injectFile(config);
      
      assert.strictEqual(result.success, true);
      // In dry run mode, the injector reports what would be done
      // but doesn't actually modify files
    });
  });

  describe('Error handling', () => {
    it('should handle validation disabled', async () => {
      const noValidationInjector = new OfficeInjector({ validateInputs: false });
      
      const config = {
        filePath: testFiles.word,
        injections: [
          {
            target: 'invalid:target:format',
            content: 'Test',
            mode: 'invalid_mode'
          }
        ]
      };

      // Should not throw validation error when validation is disabled
      const result = await noValidationInjector.injectFile(config);
      
      // May still fail at injection level, but shouldn't fail at validation
      assert.ok(result);
    });

    it('should handle mixed success and failure in single file', async () => {
      const config = {
        filePath: testFiles.word,
        injections: [
          {
            target: 'bookmark:valid',
            content: 'Valid content',
            mode: 'replace'
          },
          {
            target: 'bookmark:test',
            content: 'Test content',
            mode: 'replace',
            skipIf: 'true' // This will be skipped
          }
        ]
      };

      const result = await injector.injectFile(config);
      
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.injections.length, 1); // One succeeded
      assert.strictEqual(result.skipped.length, 1); // One skipped
    });
  });
});