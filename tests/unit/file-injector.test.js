/**
 * Tests for FileInjector - File injection utilities
 * Tests all injection modes: append, prepend, lineAt, before/after
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FileInjector } from '../../src/lib/file-injector.js';
import fs from 'fs-extra';
import path from 'node:path';
import os from 'node:os';

describe('FileInjector', () => {
  let injector;
  let tempDir;
  let testFilePath;

  beforeEach(async () => {
    injector = new FileInjector();
    tempDir = path.join(os.tmpdir(), 'unjucks-test-' + this.getDeterministicTimestamp());
    await fs.ensureDir(tempDir);
    testFilePath = path.join(tempDir, 'test.txt');
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  describe('File Existence Handling', () => {
    it('should handle non-existent file without force', async () => {
      const result = await injector.processFile(
        testFilePath,
        'new content',
        {},
        { force: false }
      );

      expect(result.success).toBe(false);
      expect(result.action).toBe('skip');
      expect(result.message).toContain('File does not exist and force option not set');
    });

    it('should create new file when force is true', async () => {
      const result = await injector.processFile(
        testFilePath,
        'new content',
        {},
        { force: true, dry: false }
      );

      expect(result.success).toBe(true);
      expect(result.action).toBe('create');
      expect(result.message).toContain('New file created with content');

      const fileExists = await fs.pathExists(testFilePath);
      expect(fileExists).toBe(true);

      const content = await fs.readFile(testFilePath, 'utf8');
      expect(content).toBe('new content');
    });

    it('should read existing file successfully', async () => {
      await fs.writeFile(testFilePath, 'existing content');

      const result = await injector.processFile(
        testFilePath,
        'new content',
        { append: true },
        { dry: false }
      );

      expect(result.success).toBe(true);
      expect(result.action).toBe('update');
    });

    it('should handle read errors gracefully', async () => {
      // Create a file with restrictive permissions (if possible)
      await fs.writeFile(testFilePath, 'content');
      
      // Mock fs.readFile to simulate read error
      const originalReadFile = fs.readFile;
      fs.readFile = async () => {
        throw new Error('Permission denied');
      };

      const result = await injector.processFile(
        testFilePath,
        'new content',
        {},
        { dry: false }
      );

      expect(result.success).toBe(false);
      expect(result.action).toBe('error');
      expect(result.message).toContain('Failed to read existing file');

      // Restore original function
      fs.readFile = originalReadFile;
    });
  });

  describe('Backup Creation', () => {
    it('should create backup when requested and not dry run', async () => {
      await fs.writeFile(testFilePath, 'original content');

      const result = await injector.processFile(
        testFilePath,
        'new content',
        { append: true },
        { backup: true, dry: false }
      );

      expect(result.success).toBe(true);
      expect(result.backupPath).toBeDefined();
      expect(result.backupPath).toContain('.backup.');

      const backupExists = await fs.pathExists(result.backupPath);
      expect(backupExists).toBe(true);

      const backupContent = await fs.readFile(result.backupPath, 'utf8');
      expect(backupContent).toBe('original content');
    });

    it('should not create backup during dry run', async () => {
      await fs.writeFile(testFilePath, 'original content');

      const result = await injector.processFile(
        testFilePath,
        'new content',
        { append: true },
        { backup: true, dry: true }
      );

      expect(result.success).toBe(true);
      expect(result.backupPath).toBeUndefined();
    });

    it('should not create backup when backup option is false', async () => {
      await fs.writeFile(testFilePath, 'original content');

      const result = await injector.processFile(
        testFilePath,
        'new content',
        { append: true },
        { backup: false, dry: false }
      );

      expect(result.success).toBe(true);
      expect(result.backupPath).toBeUndefined();
    });
  });

  describe('Dry Run Mode', () => {
    it('should not write files during dry run', async () => {
      await fs.writeFile(testFilePath, 'original content');

      const result = await injector.processFile(
        testFilePath,
        'new content',
        { append: true },
        { dry: true }
      );

      expect(result.success).toBe(true);
      expect(result.action).toBe('update');

      const content = await fs.readFile(testFilePath, 'utf8');
      expect(content).toBe('original content'); // Should be unchanged
    });

    it('should still detect content changes during dry run', async () => {
      await fs.writeFile(testFilePath, 'original content');

      const result = await injector.processFile(
        testFilePath,
        'new content',
        { append: true },
        { dry: true }
      );

      expect(result.success).toBe(true);
      expect(result.skipped).toBe(false);
      expect(result.action).toBe('update');
    });
  });

  describe('Content Change Detection', () => {
    it('should skip when content would not change', async () => {
      await fs.writeFile(testFilePath, 'existing content');

      const result = await injector.processFile(
        testFilePath,
        '', // Empty injection with default mode
        {},
        { dry: false }
      );

      expect(result.success).toBe(true);
      expect(result.skipped).toBe(true);
      expect(result.action).toBe('skip');
      expect(result.message).toContain('Content would not change');
    });

    it('should proceed when content would change', async () => {
      await fs.writeFile(testFilePath, 'existing content');

      const result = await injector.processFile(
        testFilePath,
        'new content',
        { append: true },
        { dry: false }
      );

      expect(result.success).toBe(true);
      expect(result.skipped).toBe(false);
      expect(result.action).toBe('update');
    });
  });

  describe('Injection Modes', () => {
    beforeEach(async () => {
      await fs.writeFile(testFilePath, 'line 1\nline 2\nline 3');
    });

    describe('Append Mode', () => {
      it('should append content to end of file', async () => {
        const result = await injector.processFile(
          testFilePath,
          'appended content',
          { append: true },
          { dry: false }
        );

        expect(result.success).toBe(true);

        const content = await fs.readFile(testFilePath, 'utf8');
        expect(content).toBe('line 1\nline 2\nline 3\nappended content');
      });

      it('should handle file without trailing newline', async () => {
        await fs.writeFile(testFilePath, 'content without newline');

        const result = await injector.processFile(
          testFilePath,
          'appended',
          { append: true },
          { dry: false }
        );

        expect(result.success).toBe(true);

        const content = await fs.readFile(testFilePath, 'utf8');
        expect(content).toBe('content without newline\nappended');
      });

      it('should handle file with trailing newline', async () => {
        await fs.writeFile(testFilePath, 'content with newline\n');

        const result = await injector.processFile(
          testFilePath,
          'appended',
          { append: true },
          { dry: false }
        );

        expect(result.success).toBe(true);

        const content = await fs.readFile(testFilePath, 'utf8');
        expect(content).toBe('content with newline\nappended');
      });
    });

    describe('Prepend Mode', () => {
      it('should prepend content to beginning of file', async () => {
        const result = await injector.processFile(
          testFilePath,
          'prepended content',
          { prepend: true },
          { dry: false }
        );

        expect(result.success).toBe(true);

        const content = await fs.readFile(testFilePath, 'utf8');
        expect(content).toBe('prepended content\nline 1\nline 2\nline 3');
      });
    });

    describe('LineAt Mode', () => {
      it('should insert content at specified line number', async () => {
        const result = await injector.processFile(
          testFilePath,
          'inserted content',
          { lineAt: 2 },
          { dry: false }
        );

        expect(result.success).toBe(true);

        const content = await fs.readFile(testFilePath, 'utf8');
        const lines = content.split('\n');
        expect(lines[0]).toBe('line 1');
        expect(lines[1]).toBe('inserted content');
        expect(lines[2]).toBe('line 2');
        expect(lines[3]).toBe('line 3');
      });

      it('should handle line number at beginning (line 1)', async () => {
        const result = await injector.processFile(
          testFilePath,
          'first line',
          { lineAt: 1 },
          { dry: false }
        );

        expect(result.success).toBe(true);

        const content = await fs.readFile(testFilePath, 'utf8');
        const lines = content.split('\n');
        expect(lines[0]).toBe('first line');
        expect(lines[1]).toBe('line 1');
      });

      it('should handle line number beyond file length', async () => {
        const result = await injector.processFile(
          testFilePath,
          'last line',
          { lineAt: 10 },
          { dry: false }
        );

        expect(result.success).toBe(true);

        const content = await fs.readFile(testFilePath, 'utf8');
        const lines = content.split('\n');
        expect(lines[lines.length - 1]).toBe('last line');
      });

      it('should handle zero or negative line numbers', async () => {
        const result = await injector.processFile(
          testFilePath,
          'zero line',
          { lineAt: 0 },
          { dry: false }
        );

        expect(result.success).toBe(true);

        const content = await fs.readFile(testFilePath, 'utf8');
        const lines = content.split('\n');
        expect(lines[0]).toBe('zero line');
      });
    });

    describe('Before Mode', () => {
      beforeEach(async () => {
        await fs.writeFile(testFilePath, 'import fs from "fs";\nimport path from "path";\n// MARKER\nexport default function() {}');
      });

      it('should insert content before matching line', async () => {
        const result = await injector.processFile(
          testFilePath,
          'import os from "os";',
          { inject: true, before: '// MARKER' },
          { dry: false }
        );

        expect(result.success).toBe(true);

        const content = await fs.readFile(testFilePath, 'utf8');
        const lines = content.split('\n');
        expect(lines[0]).toBe('import fs from "fs";');
        expect(lines[1]).toBe('import path from "path";');
        expect(lines[2]).toBe('import os from "os";');
        expect(lines[3]).toBe('// MARKER');
      });

      it('should handle case when marker is not found', async () => {
        const result = await injector.processFile(
          testFilePath,
          'new content',
          { inject: true, before: 'NON_EXISTENT_MARKER' },
          { dry: false }
        );

        expect(result.success).toBe(true);

        const content = await fs.readFile(testFilePath, 'utf8');
        // Should not insert anything if marker not found
        expect(content).not.toContain('new content');
      });

      it('should insert before first occurrence of marker', async () => {
        await fs.writeFile(testFilePath, 'line 1\n// MARKER\nline 3\n// MARKER\nline 5');

        const result = await injector.processFile(
          testFilePath,
          'inserted',
          { inject: true, before: '// MARKER' },
          { dry: false }
        );

        expect(result.success).toBe(true);

        const content = await fs.readFile(testFilePath, 'utf8');
        const lines = content.split('\n');
        expect(lines[1]).toBe('inserted');
        expect(lines[2]).toBe('// MARKER');
        expect(lines[4]).toBe('// MARKER'); // Second marker should be unchanged
      });
    });

    describe('After Mode', () => {
      beforeEach(async () => {
        await fs.writeFile(testFilePath, 'import fs from "fs";\n// IMPORTS\nimport path from "path";\nexport default function() {}');
      });

      it('should insert content after matching line', async () => {
        const result = await injector.processFile(
          testFilePath,
          'import os from "os";',
          { inject: true, after: '// IMPORTS' },
          { dry: false }
        );

        expect(result.success).toBe(true);

        const content = await fs.readFile(testFilePath, 'utf8');
        const lines = content.split('\n');
        expect(lines[0]).toBe('import fs from "fs";');
        expect(lines[1]).toBe('// IMPORTS');
        expect(lines[2]).toBe('import os from "os";');
        expect(lines[3]).toBe('import path from "path";');
      });

      it('should handle case when marker is not found', async () => {
        const result = await injector.processFile(
          testFilePath,
          'new content',
          { inject: true, after: 'NON_EXISTENT_MARKER' },
          { dry: false }
        );

        expect(result.success).toBe(true);

        const content = await fs.readFile(testFilePath, 'utf8');
        // Should not insert anything if marker not found
        expect(content).not.toContain('new content');
      });

      it('should insert after first occurrence of marker', async () => {
        await fs.writeFile(testFilePath, 'line 1\n// MARKER\nline 3\n// MARKER\nline 5');

        const result = await injector.processFile(
          testFilePath,
          'inserted',
          { inject: true, after: '// MARKER' },
          { dry: false }
        );

        expect(result.success).toBe(true);

        const content = await fs.readFile(testFilePath, 'utf8');
        const lines = content.split('\n');
        expect(lines[1]).toBe('// MARKER');
        expect(lines[2]).toBe('inserted');
        expect(lines[4]).toBe('// MARKER'); // Second marker should be unchanged
      });
    });

    describe('Default Mode (Append)', () => {
      it('should default to append when no specific mode is set', async () => {
        const result = await injector.processFile(
          testFilePath,
          'default content',
          {}, // No specific injection mode
          { dry: false }
        );

        expect(result.success).toBe(true);

        const content = await fs.readFile(testFilePath, 'utf8');
        expect(content).toBe('line 1\nline 2\nline 3\ndefault content');
      });
    });
  });

  describe('Directory Creation', () => {
    it('should create parent directories when they do not exist', async () => {
      const nestedPath = path.join(tempDir, 'nested', 'deep', 'file.txt');

      const result = await injector.processFile(
        nestedPath,
        'content in nested directory',
        {},
        { force: true, dry: false }
      );

      expect(result.success).toBe(true);
      expect(result.action).toBe('create');

      const fileExists = await fs.pathExists(nestedPath);
      expect(fileExists).toBe(true);

      const content = await fs.readFile(nestedPath, 'utf8');
      expect(content).toBe('content in nested directory');
    });
  });

  describe('performInjection Method', () => {
    it('should handle empty existing content', () => {
      const result = injector.performInjection('', 'new content', { append: true });
      expect(result).toBe('\nnew content');
    });

    it('should handle empty injection content', () => {
      const result = injector.performInjection('existing content', '', { append: true });
      expect(result).toBe('existing content\n');
    });

    it('should handle multiple injection modes correctly', () => {
      const existingContent = 'line 1\nline 2\nline 3';

      // Test prepend
      const prependResult = injector.performInjection(existingContent, 'prepended', { prepend: true });
      expect(prependResult).toBe('prepended\nline 1\nline 2\nline 3');

      // Test append
      const appendResult = injector.performInjection(existingContent, 'appended', { append: true });
      expect(appendResult).toBe('line 1\nline 2\nline 3\nappended');

      // Test lineAt
      const lineAtResult = injector.performInjection(existingContent, 'inserted', { lineAt: 2 });
      expect(lineAtResult).toBe('line 1\ninserted\nline 2\nline 3');
    });
  });

  describe('Error Handling', () => {
    it('should handle general processing errors', async () => {
      // Mock fs.ensureDir to throw an error
      const originalEnsureDir = fs.ensureDir;
      fs.ensureDir = async () => {
        throw new Error('Permission denied');
      };

      const result = await injector.processFile(
        testFilePath,
        'content',
        {},
        { force: true, dry: false }
      );

      expect(result.success).toBe(false);
      expect(result.action).toBe('error');
      expect(result.message).toContain('Injection failed');

      // Restore original function
      fs.ensureDir = originalEnsureDir;
    });

    it('should handle writeFile errors', async () => {
      await fs.writeFile(testFilePath, 'existing content');

      // Mock fs.writeFile to throw an error
      const originalWriteFile = fs.writeFile;
      fs.writeFile = async () => {
        throw new Error('Disk full');
      };

      const result = await injector.processFile(
        testFilePath,
        'new content',
        { append: true },
        { dry: false }
      );

      expect(result.success).toBe(false);
      expect(result.action).toBe('error');
      expect(result.message).toContain('Injection failed');

      // Restore original function
      fs.writeFile = originalWriteFile;
    });
  });

  describe('Complex Injection Scenarios', () => {
    it('should handle multiple lines of content', async () => {
      await fs.writeFile(testFilePath, 'existing line 1\nexisting line 2');

      const multiLineContent = 'new line 1\nnew line 2\nnew line 3';

      const result = await injector.processFile(
        testFilePath,
        multiLineContent,
        { lineAt: 2 },
        { dry: false }
      );

      expect(result.success).toBe(true);

      const content = await fs.readFile(testFilePath, 'utf8');
      const lines = content.split('\n');
      expect(lines[0]).toBe('existing line 1');
      expect(lines[1]).toBe('new line 1\nnew line 2\nnew line 3');
      expect(lines[2]).toBe('existing line 2');
    });

    it('should handle special characters in content', async () => {
      await fs.writeFile(testFilePath, 'existing content');

      const specialContent = 'Content with "quotes" and \'apostrophes\' and $variables and \n newlines';

      const result = await injector.processFile(
        testFilePath,
        specialContent,
        { append: true },
        { dry: false }
      );

      expect(result.success).toBe(true);

      const content = await fs.readFile(testFilePath, 'utf8');
      expect(content).toContain('Content with "quotes" and \'apostrophes\'');
      expect(content).toContain('$variables');
    });

    it('should handle Unicode content', async () => {
      await fs.writeFile(testFilePath, 'existing content');

      const unicodeContent = 'Unicode: 🚀 émojis ñáéíóú';

      const result = await injector.processFile(
        testFilePath,
        unicodeContent,
        { append: true },
        { dry: false }
      );

      expect(result.success).toBe(true);

      const content = await fs.readFile(testFilePath, 'utf8');
      expect(content).toContain('Unicode: 🚀 émojis ñáéíóú');
    });

    it('should handle very large content', async () => {
      await fs.writeFile(testFilePath, 'existing content');

      const largeContent = 'Large content line\n'.repeat(10000);

      const result = await injector.processFile(
        testFilePath,
        largeContent,
        { append: true },
        { dry: false }
      );

      expect(result.success).toBe(true);

      const content = await fs.readFile(testFilePath, 'utf8');
      expect(content).toContain('existing content');
      expect(content.split('\n')).toHaveLength(10002); // Original + 10000 + final empty line
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty files', async () => {
      await fs.writeFile(testFilePath, '');

      const result = await injector.processFile(
        testFilePath,
        'new content',
        { append: true },
        { dry: false }
      );

      expect(result.success).toBe(true);

      const content = await fs.readFile(testFilePath, 'utf8');
      expect(content).toBe('\nnew content');
    });

    it('should handle files with only whitespace', async () => {
      await fs.writeFile(testFilePath, '   \n  \n  ');

      const result = await injector.processFile(
        testFilePath,
        'new content',
        { lineAt: 2 },
        { dry: false }
      );

      expect(result.success).toBe(true);

      const content = await fs.readFile(testFilePath, 'utf8');
      const lines = content.split('\n');
      expect(lines[1]).toBe('new content');
    });

    it('should handle single line files', async () => {
      await fs.writeFile(testFilePath, 'single line');

      const result = await injector.processFile(
        testFilePath,
        'inserted',
        { lineAt: 1 },
        { dry: false }
      );

      expect(result.success).toBe(true);

      const content = await fs.readFile(testFilePath, 'utf8');
      const lines = content.split('\n');
      expect(lines[0]).toBe('inserted');
      expect(lines[1]).toBe('single line');
    });
  });

  describe('Performance', () => {
    it('should handle large files efficiently', async () => {
      const largeContent = 'Line content\n'.repeat(50000);
      await fs.writeFile(testFilePath, largeContent);

      const startTime = this.getDeterministicTimestamp();
      const result = await injector.processFile(
        testFilePath,
        'injected content',
        { lineAt: 25000 },
        { dry: false }
      );
      const endTime = this.getDeterministicTimestamp();

      expect(result.success).toBe(true);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second

      const content = await fs.readFile(testFilePath, 'utf8');
      const lines = content.split('\n');
      expect(lines[24999]).toBe('injected content');
    });
  });
});