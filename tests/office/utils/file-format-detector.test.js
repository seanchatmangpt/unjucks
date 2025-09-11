import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { FileFormatDetector } from '../../../src/office/utils/file-format-detector.js';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('FileFormatDetector', () => {
  let detector;
  let testDir;

  beforeEach(async () => {
    detector = new FileFormatDetector();
    testDir = path.join(__dirname, 'temp_test_files');
    await fs.ensureDir(testDir);
  });

  afterEach(async () => {
    await fs.remove(testDir);
  });

  describe('Constructor', () => {
    it('should initialize with file signatures', () => {
      assert.ok(detector.signatures);
      assert.ok(detector.signatures.zip);
      assert.ok(detector.signatures.ole2);
      assert.ok(detector.signatures.pdf);
    });

    it('should initialize with extension mappings', () => {
      assert.ok(detector.extensionMap);
      assert.strictEqual(detector.extensionMap['.docx'], 'word');
      assert.strictEqual(detector.extensionMap['.xlsx'], 'excel');
      assert.strictEqual(detector.extensionMap['.pptx'], 'powerpoint');
    });

    it('should initialize with content type mappings', () => {
      assert.ok(detector.contentTypes);
      assert.ok(detector.contentTypes['application/vnd.openxmlformats-officedocument.wordprocessingml.document']);
    });
  });

  describe('detectFormat', () => {
    it('should detect Word format by extension', async () => {
      const testFile = path.join(testDir, 'test.docx');
      await fs.writeFile(testFile, Buffer.alloc(10));
      
      const format = await detector.detectFormat(testFile);
      assert.strictEqual(format, 'word');
    });

    it('should detect Excel format by extension', async () => {
      const testFile = path.join(testDir, 'test.xlsx');
      await fs.writeFile(testFile, Buffer.alloc(10));
      
      const format = await detector.detectFormat(testFile);
      assert.strictEqual(format, 'excel');
    });

    it('should detect PowerPoint format by extension', async () => {
      const testFile = path.join(testDir, 'test.pptx');
      await fs.writeFile(testFile, Buffer.alloc(10));
      
      const format = await detector.detectFormat(testFile);
      assert.strictEqual(format, 'powerpoint');
    });

    it('should handle file not found', async () => {
      try {
        await detector.detectFormat('/nonexistent/file.docx');
        assert.fail('Should have thrown error for non-existent file');
      } catch (error) {
        assert.ok(error.message.includes('File not found'));
      }
    });

    it('should handle directory instead of file', async () => {
      const testDir2 = path.join(testDir, 'subdirectory');
      await fs.ensureDir(testDir2);
      
      try {
        await detector.detectFormat(testDir2);
        assert.fail('Should have thrown error for directory');
      } catch (error) {
        assert.ok(error.message.includes('Path is not a file'));
      }
    });

    it('should handle unsupported file extension', async () => {
      const testFile = path.join(testDir, 'test.unknown');
      await fs.writeFile(testFile, Buffer.alloc(10));
      
      try {
        await detector.detectFormat(testFile);
        assert.fail('Should have thrown error for unknown format');
      } catch (error) {
        assert.ok(error.message.includes('Unable to detect file format'));
      }
    });

    it('should detect legacy Word format', async () => {
      const testFile = path.join(testDir, 'test.doc');
      await fs.writeFile(testFile, Buffer.alloc(10));
      
      const format = await detector.detectFormat(testFile);
      assert.strictEqual(format, 'word');
    });

    it('should detect legacy Excel format', async () => {
      const testFile = path.join(testDir, 'test.xls');
      await fs.writeFile(testFile, Buffer.alloc(10));
      
      const format = await detector.detectFormat(testFile);
      assert.strictEqual(format, 'excel');
    });

    it('should detect legacy PowerPoint format', async () => {
      const testFile = path.join(testDir, 'test.ppt');
      await fs.writeFile(testFile, Buffer.alloc(10));
      
      const format = await detector.detectFormat(testFile);
      assert.strictEqual(format, 'powerpoint');
    });
  });

  describe('detectBySignature', () => {
    it('should detect ZIP signature', async () => {
      const testFile = path.join(testDir, 'test.zip');
      const zipSignature = Buffer.from([0x50, 0x4B, 0x03, 0x04, 0x00, 0x00, 0x00, 0x00]);
      await fs.writeFile(testFile, zipSignature);
      
      const format = await detector.detectBySignature(testFile);
      assert.strictEqual(format, 'zip');
    });

    it('should detect OLE2 signature', async () => {
      const testFile = path.join(testDir, 'test.ole2');
      const ole2Signature = Buffer.from([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]);
      await fs.writeFile(testFile, ole2Signature);
      
      const format = await detector.detectBySignature(testFile);
      assert.strictEqual(format, 'ole2');
    });

    it('should detect PDF signature', async () => {
      const testFile = path.join(testDir, 'test.pdf');
      const pdfSignature = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34]);
      await fs.writeFile(testFile, pdfSignature);
      
      const format = await detector.detectBySignature(testFile);
      assert.strictEqual(format, 'pdf');
    });

    it('should return null for unknown signature', async () => {
      const testFile = path.join(testDir, 'test.unknown');
      await fs.writeFile(testFile, Buffer.from([0x00, 0x01, 0x02, 0x03]));
      
      const format = await detector.detectBySignature(testFile);
      assert.strictEqual(format, null);
    });

    it('should handle read errors gracefully', async () => {
      const format = await detector.detectBySignature('/nonexistent/file.test');
      assert.strictEqual(format, null);
    });
  });

  describe('matchesSignature', () => {
    it('should match exact signature', () => {
      const buffer = Buffer.from([0x50, 0x4B, 0x03, 0x04, 0x05, 0x06]);
      const signature = [0x50, 0x4B, 0x03, 0x04];
      
      const matches = detector.matchesSignature(buffer, signature);
      assert.strictEqual(matches, true);
    });

    it('should not match different signature', () => {
      const buffer = Buffer.from([0x50, 0x4B, 0x03, 0x05, 0x05, 0x06]);
      const signature = [0x50, 0x4B, 0x03, 0x04];
      
      const matches = detector.matchesSignature(buffer, signature);
      assert.strictEqual(matches, false);
    });

    it('should handle buffer shorter than signature', () => {
      const buffer = Buffer.from([0x50, 0x4B]);
      const signature = [0x50, 0x4B, 0x03, 0x04];
      
      const matches = detector.matchesSignature(buffer, signature);
      assert.strictEqual(matches, false);
    });

    it('should handle empty buffer', () => {
      const buffer = Buffer.alloc(0);
      const signature = [0x50, 0x4B, 0x03, 0x04];
      
      const matches = detector.matchesSignature(buffer, signature);
      assert.strictEqual(matches, false);
    });

    it('should handle empty signature', () => {
      const buffer = Buffer.from([0x50, 0x4B, 0x03, 0x04]);
      const signature = [];
      
      const matches = detector.matchesSignature(buffer, signature);
      assert.strictEqual(matches, true);
    });
  });

  describe('getFileInfo', () => {
    it('should return detailed file info for existing file', async () => {
      const testFile = path.join(testDir, 'test.docx');
      await fs.writeFile(testFile, Buffer.from('test content'));
      
      const info = await detector.getFileInfo(testFile);
      
      assert.strictEqual(info.exists, true);
      assert.strictEqual(info.isFile, true);
      assert.strictEqual(info.basename, 'test.docx');
      assert.strictEqual(info.extension, '.docx');
      assert.strictEqual(info.extensionFormat, 'word');
      assert.strictEqual(info.detectedFormat, 'word');
      assert.strictEqual(info.isSupported, true);
      assert.ok(info.size > 0);
      assert.ok(info.lastModified instanceof Date);
    });

    it('should return info for non-existent file', async () => {
      const info = await detector.getFileInfo('/nonexistent/file.docx');
      
      assert.strictEqual(info.exists, false);
      assert.strictEqual(info.isFile, false);
      assert.strictEqual(info.basename, 'file.docx');
      assert.strictEqual(info.extension, '.docx');
      assert.strictEqual(info.extensionFormat, 'word');
    });

    it('should handle detection errors', async () => {
      const testFile = path.join(testDir, 'test.unknown');
      await fs.writeFile(testFile, 'content');
      
      const info = await detector.getFileInfo(testFile);
      
      assert.strictEqual(info.exists, true);
      assert.strictEqual(info.isFile, true);
      assert.ok(info.error); // Should contain error message
    });
  });

  describe('isFormatSupported', () => {
    it('should return true for supported formats', () => {
      assert.strictEqual(detector.isFormatSupported('word'), true);
      assert.strictEqual(detector.isFormatSupported('excel'), true);
      assert.strictEqual(detector.isFormatSupported('powerpoint'), true);
      assert.strictEqual(detector.isFormatSupported('Word'), true); // Case insensitive
      assert.strictEqual(detector.isFormatSupported('EXCEL'), true);
    });

    it('should return false for unsupported formats', () => {
      assert.strictEqual(detector.isFormatSupported('pdf'), false);
      assert.strictEqual(detector.isFormatSupported('txt'), false);
      assert.strictEqual(detector.isFormatSupported('html'), false);
      assert.strictEqual(detector.isFormatSupported(''), false);
      assert.strictEqual(detector.isFormatSupported(null), false);
      assert.strictEqual(detector.isFormatSupported(undefined), false);
    });
  });

  describe('getSupportedExtensions', () => {
    it('should return all supported extensions', () => {
      const extensions = detector.getSupportedExtensions();
      
      assert.ok(Array.isArray(extensions));
      assert.ok(extensions.includes('.docx'));
      assert.ok(extensions.includes('.xlsx'));
      assert.ok(extensions.includes('.pptx'));
      assert.ok(extensions.includes('.doc'));
      assert.ok(extensions.includes('.xls'));
      assert.ok(extensions.includes('.ppt'));
      
      // Should not include unsupported formats
      assert.ok(!extensions.includes('.pdf'));
      assert.ok(!extensions.includes('.txt'));
    });

    it('should return unique extensions', () => {
      const extensions = detector.getSupportedExtensions();
      const uniqueExtensions = [...new Set(extensions)];
      
      assert.strictEqual(extensions.length, uniqueExtensions.length);
    });
  });

  describe('getFormatInfo', () => {
    it('should return comprehensive format information', () => {
      const info = detector.getFormatInfo();
      
      assert.ok(Array.isArray(info.supportedFormats));
      assert.ok(info.supportedFormats.includes('word'));
      assert.ok(info.supportedFormats.includes('excel'));
      assert.ok(info.supportedFormats.includes('powerpoint'));
      
      assert.ok(Array.isArray(info.supportedExtensions));
      assert.ok(info.supportedExtensions.includes('.docx'));
      
      assert.ok(Array.isArray(info.detectionMethods));
      assert.ok(info.detectionMethods.includes('extension'));
      assert.ok(info.detectionMethods.includes('signature'));
      assert.ok(info.detectionMethods.includes('contentType'));
      
      assert.ok(info.capabilities);
      assert.ok(Array.isArray(info.capabilities.word));
      assert.ok(Array.isArray(info.capabilities.excel));
      assert.ok(Array.isArray(info.capabilities.powerpoint));
    });
  });

  describe('validateFile', () => {
    it('should validate supported Office file', async () => {
      const testFile = path.join(testDir, 'test.docx');
      await fs.writeFile(testFile, Buffer.from('test content'));
      
      const result = await detector.validateFile(testFile);
      
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.format, 'word');
      assert.strictEqual(result.errors.length, 0);
      assert.ok(result.info);
    });

    it('should reject non-existent file', async () => {
      const result = await detector.validateFile('/nonexistent/file.docx');
      
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('does not exist')));
    });

    it('should reject directory', async () => {
      const result = await detector.validateFile(testDir);
      
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('not a file')));
    });

    it('should warn about empty file', async () => {
      const testFile = path.join(testDir, 'empty.docx');
      await fs.writeFile(testFile, Buffer.alloc(0));
      
      const result = await detector.validateFile(testFile);
      
      assert.ok(result.warnings.some(w => w.includes('empty')));
    });

    it('should warn about large file', async () => {
      const testFile = path.join(testDir, 'large.docx');
      // Create a large file (simulate by writing 101MB)
      const largeBuffer = Buffer.alloc(101 * 1024 * 1024);
      await fs.writeFile(testFile, largeBuffer);
      
      const result = await detector.validateFile(testFile);
      
      assert.ok(result.warnings.some(w => w.includes('very large')));
    });

    it('should reject unsupported format', async () => {
      const testFile = path.join(testDir, 'test.txt');
      await fs.writeFile(testFile, 'text content');
      
      const result = await detector.validateFile(testFile);
      
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('not supported for injection')));
    });

    it('should handle validation errors gracefully', async () => {
      // Create a file with invalid permissions (simulate by using invalid path)
      const result = await detector.validateFile('\x00invalid\x00path');
      
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('Validation error')));
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle files with no extension', async () => {
      const testFile = path.join(testDir, 'noextension');
      await fs.writeFile(testFile, Buffer.alloc(10));
      
      try {
        await detector.detectFormat(testFile);
        assert.fail('Should have thrown error for file without extension');
      } catch (error) {
        assert.ok(error.message.includes('Unable to detect file format'));
      }
    });

    it('should handle files with multiple extensions', async () => {
      const testFile = path.join(testDir, 'test.backup.docx');
      await fs.writeFile(testFile, Buffer.alloc(10));
      
      const format = await detector.detectFormat(testFile);
      assert.strictEqual(format, 'word');
    });

    it('should handle case variations in extensions', async () => {
      const testFile = path.join(testDir, 'test.DOCX');
      await fs.writeFile(testFile, Buffer.alloc(10));
      
      const format = await detector.detectFormat(testFile);
      assert.strictEqual(format, 'word');
    });

    it('should handle very short files', async () => {
      const testFile = path.join(testDir, 'tiny.docx');
      await fs.writeFile(testFile, Buffer.from([0x01]));
      
      const format = await detector.detectFormat(testFile);
      assert.strictEqual(format, 'word'); // Should still detect by extension
    });

    it('should handle concurrent detection requests', async () => {
      const testFiles = [];
      for (let i = 0; i < 5; i++) {
        const testFile = path.join(testDir, `concurrent_${i}.docx`);
        await fs.writeFile(testFile, Buffer.alloc(10));
        testFiles.push(testFile);
      }
      
      const promises = testFiles.map(file => detector.detectFormat(file));
      const results = await Promise.all(promises);
      
      results.forEach(result => {
        assert.strictEqual(result, 'word');
      });
    });
  });
});