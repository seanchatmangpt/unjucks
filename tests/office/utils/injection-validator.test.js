import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { InjectionValidator } from '../../../src/office/utils/injection-validator.js';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('InjectionValidator', () => {
  let validator;
  let testFile;

  beforeEach(async () => {
    validator = new InjectionValidator();
    
    // Create a temporary test file
    testFile = path.join(__dirname, 'temp_test.docx');
    await fs.writeFile(testFile, Buffer.alloc(0));
  });

  describe('validateInjectionConfig', () => {
    it('should validate a valid configuration', async () => {
      const config = {
        filePath: testFile,
        injections: [
          {
            target: 'bookmark:test',
            content: 'Test content',
            mode: 'replace',
            type: 'text'
          }
        ],
        outputPath: testFile
      };

      const result = await validator.validateInjectionConfig(config);
      
      assert.strictEqual(result.valid, true);
      assert.ok(Array.isArray(result.warnings));
      assert.strictEqual(result.config, config);
    });

    it('should reject config with missing filePath', async () => {
      const config = {
        injections: [
          {
            target: 'bookmark:test',
            content: 'Test content'
          }
        ]
      };

      try {
        await validator.validateInjectionConfig(config);
        assert.fail('Should have thrown validation error');
      } catch (error) {
        assert.ok(error.message.includes('filePath is required'));
      }
    });

    it('should reject config with non-string filePath', async () => {
      const config = {
        filePath: 12345,
        injections: [
          {
            target: 'bookmark:test',
            content: 'Test content'
          }
        ]
      };

      try {
        await validator.validateInjectionConfig(config);
        assert.fail('Should have thrown validation error');
      } catch (error) {
        assert.ok(error.message.includes('filePath must be a string'));
      }
    });

    it('should reject config with missing injections', async () => {
      const config = {
        filePath: testFile
      };

      try {
        await validator.validateInjectionConfig(config);
        assert.fail('Should have thrown validation error');
      } catch (error) {
        assert.ok(error.message.includes('injections array is required'));
      }
    });

    it('should reject config with non-array injections', async () => {
      const config = {
        filePath: testFile,
        injections: 'not an array'
      };

      try {
        await validator.validateInjectionConfig(config);
        assert.fail('Should have thrown validation error');
      } catch (error) {
        assert.ok(error.message.includes('injections must be an array'));
      }
    });

    it('should warn about empty injections array', async () => {
      const config = {
        filePath: testFile,
        injections: []
      };

      const result = await validator.validateInjectionConfig(config);
      
      assert.strictEqual(result.valid, true);
      assert.ok(result.warnings.some(w => w.includes('empty')));
    });

    it('should warn about unsupported file extension', async () => {
      const txtFile = testFile.replace('.docx', '.txt');
      await fs.writeFile(txtFile, 'test');
      
      const config = {
        filePath: txtFile,
        injections: [
          {
            target: 'line:1',
            content: 'Test'
          }
        ]
      };

      const result = await validator.validateInjectionConfig(config);
      
      assert.strictEqual(result.valid, true);
      assert.ok(result.warnings.some(w => w.includes('may not be supported')));
      
      await fs.remove(txtFile);
    });

    it('should handle non-object config', async () => {
      try {
        await validator.validateInjectionConfig('not an object');
        assert.fail('Should have thrown validation error');
      } catch (error) {
        assert.ok(error.message.includes('must be an object'));
      }
    });

    it('should validate outputPath if provided', async () => {
      const config = {
        filePath: testFile,
        injections: [
          {
            target: 'bookmark:test',
            content: 'Test'
          }
        ],
        outputPath: 123 // Invalid type
      };

      try {
        await validator.validateInjectionConfig(config);
        assert.fail('Should have thrown validation error');
      } catch (error) {
        assert.ok(error.message.includes('outputPath must be a string'));
      }
    });
  });

  describe('validateInjection', () => {
    it('should validate a valid injection', async () => {
      const injection = {
        target: 'bookmark:test',
        content: 'Test content',
        mode: 'replace',
        type: 'text',
        formatting: { bold: true },
        skipIf: 'false'
      };

      const errors = await validator.validateInjection(injection, 0);
      
      assert.strictEqual(errors.length, 0);
    });

    it('should reject injection with missing target', async () => {
      const injection = {
        content: 'Test content'
      };

      const errors = await validator.validateInjection(injection, 0);
      
      assert.ok(errors.some(e => e.includes('target is required')));
    });

    it('should reject injection with non-string target', async () => {
      const injection = {
        target: 123,
        content: 'Test content'
      };

      const errors = await validator.validateInjection(injection, 0);
      
      assert.ok(errors.some(e => e.includes('target must be a string')));
    });

    it('should reject injection with missing content', async () => {
      const injection = {
        target: 'bookmark:test'
      };

      const errors = await validator.validateInjection(injection, 0);
      
      assert.ok(errors.some(e => e.includes('content is required')));
    });

    it('should accept injection with content value 0', async () => {
      const injection = {
        target: 'bookmark:test',
        content: 0
      };

      const errors = await validator.validateInjection(injection, 0);
      
      assert.ok(!errors.some(e => e.includes('content is required')));
    });

    it('should reject injection with invalid mode', async () => {
      const injection = {
        target: 'bookmark:test',
        content: 'Test',
        mode: 'invalid_mode'
      };

      const errors = await validator.validateInjection(injection, 0);
      
      assert.ok(errors.some(e => e.includes('mode must be one of')));
    });

    it('should reject injection with invalid type', async () => {
      const injection = {
        target: 'bookmark:test',
        content: 'Test',
        type: 'invalid_type'
      };

      const errors = await validator.validateInjection(injection, 0);
      
      assert.ok(errors.some(e => e.includes('type must be one of')));
    });

    it('should reject injection with non-object formatting', async () => {
      const injection = {
        target: 'bookmark:test',
        content: 'Test',
        formatting: 'not an object'
      };

      const errors = await validator.validateInjection(injection, 0);
      
      assert.ok(errors.some(e => e.includes('formatting must be an object')));
    });

    it('should reject injection with invalid skipIf type', async () => {
      const injection = {
        target: 'bookmark:test',
        content: 'Test',
        skipIf: 123
      };

      const errors = await validator.validateInjection(injection, 0);
      
      assert.ok(errors.some(e => e.includes('skipIf must be a string or function')));
    });

    it('should handle non-object injection', async () => {
      const errors = await validator.validateInjection('not an object', 0);
      
      assert.ok(errors.some(e => e.includes('must be an object')));
    });
  });

  describe('validateTarget', () => {
    it('should validate Word bookmark target', () => {
      const errors = validator.validateTarget('bookmark:intro', 0);
      assert.strictEqual(errors.length, 0);
    });

    it('should reject empty bookmark name', () => {
      const errors = validator.validateTarget('bookmark:', 0);
      assert.ok(errors.some(e => e.includes('bookmark name cannot be empty')));
    });

    it('should validate Word paragraph target', () => {
      const errors = validator.validateTarget('paragraph:5', 0);
      assert.strictEqual(errors.length, 0);
    });

    it('should reject invalid paragraph number', () => {
      const errors = validator.validateTarget('paragraph:abc', 0);
      assert.ok(errors.some(e => e.includes('paragraph number must be a valid integer')));
    });

    it('should validate Word table cell target', () => {
      const errors = validator.validateTarget('table:1:cell:2,3', 0);
      assert.strictEqual(errors.length, 0);
    });

    it('should reject invalid table cell format', () => {
      const errors = validator.validateTarget('table:cell:invalid', 0);
      assert.ok(errors.some(e => e.includes('table cell format must be')));
    });

    it('should validate Excel named range target', () => {
      const errors = validator.validateTarget('namedRange:SalesData', 0);
      assert.strictEqual(errors.length, 0);
    });

    it('should reject empty named range name', () => {
      const errors = validator.validateTarget('namedRange:', 0);
      assert.ok(errors.some(e => e.includes('named range name cannot be empty')));
    });

    it('should validate PowerPoint slide target', () => {
      const errors = validator.validateTarget('slide:1', 0);
      assert.strictEqual(errors.length, 0);
    });

    it('should validate PowerPoint new slide target', () => {
      const errors = validator.validateTarget('slide:new', 0);
      assert.strictEqual(errors.length, 0);
    });

    it('should reject invalid slide reference', () => {
      const errors = validator.validateTarget('slide:invalid', 0);
      assert.ok(errors.some(e => e.includes('slide reference must be a number or')));
    });

    it('should validate PowerPoint placeholder target', () => {
      const errors = validator.validateTarget('slide:1:placeholder:title', 0);
      assert.strictEqual(errors.length, 0);
    });

    it('should reject invalid placeholder format', () => {
      const errors = validator.validateTarget('slide:placeholder:title', 0);
      assert.ok(errors.some(e => e.includes('placeholder format must be')));
    });
  });

  describe('isExcelCellReference', () => {
    it('should recognize valid Excel cell references', () => {
      assert.strictEqual(validator.isExcelCellReference('Sheet1:A1'), true);
      assert.strictEqual(validator.isExcelCellReference('A1'), true);
      assert.strictEqual(validator.isExcelCellReference('Sheet1:A1:C3'), true);
      assert.strictEqual(validator.isExcelCellReference('Data:B5'), true);
    });

    it('should reject invalid Excel cell references', () => {
      assert.strictEqual(validator.isExcelCellReference('invalid'), false);
      assert.strictEqual(validator.isExcelCellReference('1A'), false);
      assert.strictEqual(validator.isExcelCellReference(''), false);
    });
  });

  describe('validateBatchConfigurations', () => {
    it('should validate multiple configurations', async () => {
      const batchConfigs = [
        {
          filePath: testFile,
          injections: [
            {
              target: 'bookmark:test1',
              content: 'Test 1'
            }
          ]
        },
        {
          filePath: testFile,
          injections: [
            {
              target: 'bookmark:test2',
              content: 'Test 2'
            }
          ]
        }
      ];

      const result = await validator.validateBatchConfigurations(batchConfigs);
      
      assert.strictEqual(result.valid.length, 2);
      assert.strictEqual(result.invalid.length, 0);
      assert.strictEqual(result.totalConfigs, 2);
      assert.strictEqual(result.totalInjections, 2);
    });

    it('should handle mixed valid and invalid configurations', async () => {
      const batchConfigs = [
        {
          filePath: testFile,
          injections: [
            {
              target: 'bookmark:test1',
              content: 'Test 1'
            }
          ]
        },
        {
          // Missing filePath
          injections: [
            {
              target: 'bookmark:test2',
              content: 'Test 2'
            }
          ]
        }
      ];

      const result = await validator.validateBatchConfigurations(batchConfigs);
      
      assert.strictEqual(result.valid.length, 1);
      assert.strictEqual(result.invalid.length, 1);
    });

    it('should reject non-array input', async () => {
      try {
        await validator.validateBatchConfigurations('not an array');
        assert.fail('Should have thrown error');
      } catch (error) {
        assert.ok(error.message.includes('must be an array'));
      }
    });
  });

  describe('validateFilePermissions', () => {
    it('should validate existing readable file', async () => {
      const result = await validator.validateFilePermissions(testFile);
      
      assert.strictEqual(result.exists, true);
      assert.strictEqual(result.isFile, true);
      assert.strictEqual(result.readable, true);
      assert.strictEqual(result.size, 0);
      assert.strictEqual(result.errors.length, 0);
    });

    it('should handle non-existent file', async () => {
      const result = await validator.validateFilePermissions('/nonexistent/file.docx');
      
      assert.strictEqual(result.exists, false);
      assert.ok(result.warnings.some(w => w.includes('does not exist')));
    });

    it('should warn about large files', async () => {
      // Create a large test file (simulate by modifying the result)
      const largeFile = path.join(__dirname, 'large_test.docx');
      await fs.writeFile(largeFile, Buffer.alloc(60 * 1024 * 1024)); // 60MB
      
      const result = await validator.validateFilePermissions(largeFile);
      
      assert.ok(result.warnings.some(w => w.includes('large')));
      
      await fs.remove(largeFile);
    });
  });

  describe('validateContentSafety', () => {
    it('should validate safe text content', () => {
      const result = validator.validateContentSafety('Hello, this is safe content!');
      
      assert.strictEqual(result.safe, true);
      assert.strictEqual(result.issues.length, 0);
    });

    it('should detect script tags', () => {
      const result = validator.validateContentSafety('<script>alert("danger")</script>');
      
      assert.strictEqual(result.safe, false);
      assert.ok(result.issues.some(i => i.includes('script tags')));
    });

    it('should detect JavaScript protocol', () => {
      const result = validator.validateContentSafety('javascript:alert("danger")');
      
      assert.strictEqual(result.safe, false);
      assert.ok(result.issues.some(i => i.includes('JavaScript protocol')));
    });

    it('should detect VBScript protocol', () => {
      const result = validator.validateContentSafety('vbscript:MsgBox("danger")');
      
      assert.strictEqual(result.safe, false);
      assert.ok(result.issues.some(i => i.includes('VBScript protocol')));
    });

    it('should detect event handlers', () => {
      const result = validator.validateContentSafety('<div onclick="danger()">Click me</div>');
      
      assert.strictEqual(result.safe, false);
      assert.ok(result.issues.some(i => i.includes('event handlers')));
    });

    it('should detect template expressions', () => {
      const result = validator.validateContentSafety('User: ${user.name}');
      
      assert.strictEqual(result.safe, false);
      assert.ok(result.issues.some(i => i.includes('template expressions')));
    });

    it('should warn about very long content', () => {
      const longContent = 'a'.repeat(150000);
      const result = validator.validateContentSafety(longContent);
      
      assert.ok(result.warnings.some(w => w.includes('very long')));
    });

    it('should warn about unusual control characters', () => {
      const result = validator.validateContentSafety('Hello\x00World');
      
      assert.ok(result.warnings.some(w => w.includes('unusual control characters')));
    });

    it('should handle non-string content', () => {
      const result = validator.validateContentSafety(12345);
      
      assert.strictEqual(result.safe, true);
      assert.strictEqual(result.issues.length, 0);
    });
  });

  describe('validateFormatting', () => {
    it('should validate valid formatting', () => {
      const formatting = {
        fontSize: 12,
        color: 'red',
        bold: true
      };
      
      const result = validator.validateFormatting(formatting, 'word');
      
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.errors.length, 0);
    });

    it('should reject invalid fontSize', () => {
      const formatting = {
        fontSize: 'twelve' // Should be number
      };
      
      const result = validator.validateFormatting(formatting, 'word');
      
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('fontSize must be a number')));
    });

    it('should reject fontSize out of range', () => {
      const formatting = {
        fontSize: 500 // Too large
      };
      
      const result = validator.validateFormatting(formatting, 'word');
      
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('fontSize must be a number between')));
    });

    it('should reject non-string color', () => {
      const formatting = {
        color: 12345
      };
      
      const result = validator.validateFormatting(formatting, 'word');
      
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('color must be a string')));
    });

    it('should handle null/undefined formatting', () => {
      let result = validator.validateFormatting(null, 'word');
      assert.strictEqual(result.valid, true);
      
      result = validator.validateFormatting(undefined, 'word');
      assert.strictEqual(result.valid, true);
    });

    it('should warn about Word-specific alignment values', () => {
      const formatting = {
        alignment: 'invalid_alignment'
      };
      
      const result = validator.validateFormatting(formatting, 'word');
      
      assert.ok(result.warnings.some(w => w.includes('alignment should be one of')));
    });
  });

  // Cleanup after each test
  afterEach(async () => {
    try {
      await fs.remove(testFile);
    } catch (error) {
      // Ignore cleanup errors
    }
  });
});