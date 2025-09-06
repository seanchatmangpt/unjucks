import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FileInjector, type InjectionOptions } from '../../src/lib/file-injector.js';
import { FrontmatterParser, type FrontmatterConfig } from '../../src/lib/frontmatter-parser.js';
import fs from 'fs-extra';
import path from 'node:path';
import os from 'node:os';

describe('FileInjector - All 6 Operation Modes Integration Tests', () => {
  let injector: FileInjector;
  let parser: FrontmatterParser;
  let tempDir: string;
  let testFilePath: string;

  beforeEach(async () => {
    injector = new FileInjector();
    parser = new FrontmatterParser();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'unjucks-file-ops-'));
    await fs.ensureDir(tempDir); // Ensure directory exists
    testFilePath = path.join(tempDir, 'test.ts');
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  describe('Mode 1: Write - Create new files', () => {
    it('should write new file atomically', async () => {
      const content = 'export const greeting = "Hello World";';
      const frontmatter: FrontmatterConfig = { to: 'test.ts' };
      const options: InjectionOptions = { force: false, dry: false };

      const result = await injector.processFile(testFilePath, content, frontmatter, options);

      expect(result.success).toBe(true);
      expect(result.message).toContain('File written');
      expect(result.changes).toHaveLength(1);
      expect(result.changes[0]).toContain('write:');

      const written = await fs.readFile(testFilePath, 'utf8');
      expect(written).toBe(content);
    });

    it('should fail to overwrite existing file without force', async () => {
      await fs.writeFile(testFilePath, 'existing content');
      const content = 'new content';
      const frontmatter: FrontmatterConfig = {};

      const result = await injector.processFile(testFilePath, content, frontmatter, { force: false, dry: false });

      expect(result.success).toBe(false);
      expect(result.message).toContain('already exists');
      expect(result.message).toContain('--force');
    });

    it('should overwrite existing file with force option', async () => {
      await fs.writeFile(testFilePath, 'existing content');
      const content = 'new content';
      const frontmatter: FrontmatterConfig = {};

      const result = await injector.processFile(testFilePath, content, frontmatter, { force: true, dry: false });

      expect(result.success).toBe(true);
      const written = await fs.readFile(testFilePath, 'utf8');
      expect(written).toBe(content);
    });

    it('should create backup when writing with backup option', async () => {
      const originalContent = 'original content';
      await fs.writeFile(testFilePath, originalContent);
      
      const newContent = 'new content';
      const frontmatter: FrontmatterConfig = {};
      
      const result = await injector.processFile(testFilePath, newContent, frontmatter, { 
        force: true, 
        dry: false, 
        backup: true 
      });

      expect(result.success).toBe(true);
      
      // Check new content was written
      const written = await fs.readFile(testFilePath, 'utf8');
      expect(written).toBe(newContent);

      // Check backup was created
      const backupFiles = await fs.readdir(tempDir);
      const backupFile = backupFiles.find(f => f.startsWith('test.ts.bak.'));
      expect(backupFile).toBeDefined();
      
      if (backupFile) {
        const backupPath = path.join(tempDir, backupFile);
        const backupContent = await fs.readFile(backupPath, 'utf8');
        expect(backupContent).toBe(originalContent);
      }
    });

    it('should handle dry-run mode for write operations', async () => {
      const content = 'test content';
      const frontmatter: FrontmatterConfig = {};

      const result = await injector.processFile(testFilePath, content, frontmatter, { force: false, dry: true });

      expect(result.success).toBe(true);
      expect(result.message).toContain('Would write file');
      expect(result.changes).toHaveLength(1);
      expect(result.changes[0]).toContain('write:');

      // File should not actually exist
      const exists = await fs.pathExists(testFilePath);
      expect(exists).toBe(false);
    });
  });

  describe('Mode 2: Inject - Insert into existing files', () => {
    it('should inject content after target marker', async () => {
      const existingContent = `const config = {
  name: 'app',
  // inject-point
  version: '1.0.0'
};`;
      await fs.writeFile(testFilePath, existingContent);

      const injectContent = '  description: "Test app",';
      const frontmatter: FrontmatterConfig = { inject: true, after: '// inject-point' };

      const result = await injector.processFile(testFilePath, injectContent, frontmatter, { force: false, dry: false });

      expect(result.success).toBe(true);
      expect(result.message).toContain('Content injected');
      
      const finalContent = await fs.readFile(testFilePath, 'utf8');
      expect(finalContent).toContain('// inject-point');
      expect(finalContent).toContain('description: "Test app"');
      
      const lines = finalContent.split('\n');
      const injectPointIndex = lines.findIndex(line => line.includes('// inject-point'));
      expect(lines[injectPointIndex + 1].trim()).toBe('description: "Test app",');
    });

    it('should inject content before target marker', async () => {
      const existingContent = `const config = {
  name: 'app',
  // inject-point
  version: '1.0.0'
};`;
      await fs.writeFile(testFilePath, existingContent);

      const injectContent = '  description: "Test app",';
      const frontmatter: FrontmatterConfig = { inject: true, before: '// inject-point' };

      const result = await injector.processFile(testFilePath, injectContent, frontmatter, { force: false, dry: false });

      expect(result.success).toBe(true);
      
      const finalContent = await fs.readFile(testFilePath, 'utf8');
      const lines = finalContent.split('\n');
      const injectPointIndex = lines.findIndex(line => line.includes('// inject-point'));
      expect(lines[injectPointIndex - 1].trim()).toBe('description: "Test app",');
    });

    it('should be idempotent - not inject duplicate content', async () => {
      const existingContent = `const config = {
  name: 'app',
  description: "Test app",
  version: '1.0.0'
};`;
      await fs.writeFile(testFilePath, existingContent);

      const injectContent = 'description: "Test app",';
      const frontmatter: FrontmatterConfig = { inject: true };

      const result = await injector.processFile(testFilePath, injectContent, frontmatter, { force: false, dry: false });

      expect(result.success).toBe(true);
      expect(result.skipped).toBe(true);
      expect(result.message).toContain('already exists');
      
      // Content should remain unchanged
      const finalContent = await fs.readFile(testFilePath, 'utf8');
      expect(finalContent).toBe(existingContent);
    });

    it('should fail when target marker not found', async () => {
      await fs.writeFile(testFilePath, 'some content without marker');

      const injectContent = 'new content';
      const frontmatter: FrontmatterConfig = { inject: true, after: 'non-existent-marker' };

      const result = await injector.processFile(testFilePath, injectContent, frontmatter, { force: false, dry: false });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Target not found');
    });

    it('should handle dry-run mode for inject operations', async () => {
      await fs.writeFile(testFilePath, 'existing content\n// marker\nmore content');

      const injectContent = 'injected content';
      const frontmatter: FrontmatterConfig = { inject: true, after: '// marker' };

      const result = await injector.processFile(testFilePath, injectContent, frontmatter, { force: false, dry: true });

      expect(result.success).toBe(true);
      expect(result.message).toContain('Would inject content');
      expect(result.changes[0]).toContain('inject:');
      
      // Original content should remain unchanged
      const originalContent = await fs.readFile(testFilePath, 'utf8');
      expect(originalContent).toBe('existing content\n// marker\nmore content');
    });
  });

  describe('Mode 3: Append - Add to end of file', () => {
    it('should append content to end of file', async () => {
      const existingContent = 'First line\nSecond line';
      await fs.writeFile(testFilePath, existingContent);

      const appendContent = 'Third line';
      const frontmatter: FrontmatterConfig = { append: true };

      const result = await injector.processFile(testFilePath, appendContent, frontmatter, { force: false, dry: false });

      expect(result.success).toBe(true);
      expect(result.message).toContain('Content appended');
      
      const finalContent = await fs.readFile(testFilePath, 'utf8');
      expect(finalContent).toBe('First line\nSecond line\nThird line');
    });

    it('should be idempotent - not append duplicate content', async () => {
      const existingContent = 'First line\nSecond line\nThird line';
      await fs.writeFile(testFilePath, existingContent);

      const appendContent = 'Third line';
      const frontmatter: FrontmatterConfig = { append: true };

      const result = await injector.processFile(testFilePath, appendContent, frontmatter, { force: false, dry: false });

      expect(result.success).toBe(true);
      expect(result.skipped).toBe(true);
      expect(result.message).toContain('already at end');
      
      const finalContent = await fs.readFile(testFilePath, 'utf8');
      expect(finalContent).toBe(existingContent);
    });

    it('should handle files without trailing newline', async () => {
      await fs.writeFile(testFilePath, 'Line without newline');

      const appendContent = 'New line';
      const frontmatter: FrontmatterConfig = { append: true };

      const result = await injector.processFile(testFilePath, appendContent, frontmatter, { force: false, dry: false });

      expect(result.success).toBe(true);
      
      const finalContent = await fs.readFile(testFilePath, 'utf8');
      expect(finalContent).toBe('Line without newline\nNew line');
    });

    it('should handle dry-run mode for append operations', async () => {
      await fs.writeFile(testFilePath, 'existing content');

      const appendContent = 'appended content';
      const frontmatter: FrontmatterConfig = { append: true };

      const result = await injector.processFile(testFilePath, appendContent, frontmatter, { force: false, dry: true });

      expect(result.success).toBe(true);
      expect(result.message).toContain('Would append content');
      expect(result.changes[0]).toContain('append:');
      
      const originalContent = await fs.readFile(testFilePath, 'utf8');
      expect(originalContent).toBe('existing content');
    });
  });

  describe('Mode 4: Prepend - Add to beginning of file', () => {
    it('should prepend content to beginning of file', async () => {
      const existingContent = 'Second line\nThird line';
      await fs.writeFile(testFilePath, existingContent);

      const prependContent = 'First line';
      const frontmatter: FrontmatterConfig = { prepend: true };

      const result = await injector.processFile(testFilePath, prependContent, frontmatter, { force: false, dry: false });

      expect(result.success).toBe(true);
      expect(result.message).toContain('Content prepended');
      
      const finalContent = await fs.readFile(testFilePath, 'utf8');
      expect(finalContent).toBe('First line\nSecond line\nThird line');
    });

    it('should be idempotent - not prepend duplicate content', async () => {
      const existingContent = 'First line\nSecond line\nThird line';
      await fs.writeFile(testFilePath, existingContent);

      const prependContent = 'First line';
      const frontmatter: FrontmatterConfig = { prepend: true };

      const result = await injector.processFile(testFilePath, prependContent, frontmatter, { force: false, dry: false });

      expect(result.success).toBe(true);
      expect(result.skipped).toBe(true);
      expect(result.message).toContain('already at beginning');
      
      const finalContent = await fs.readFile(testFilePath, 'utf8');
      expect(finalContent).toBe(existingContent);
    });

    it('should handle content without trailing newline', async () => {
      await fs.writeFile(testFilePath, 'Existing content');

      const prependContent = 'New first line';
      const frontmatter: FrontmatterConfig = { prepend: true };

      const result = await injector.processFile(testFilePath, prependContent, frontmatter, { force: false, dry: false });

      expect(result.success).toBe(true);
      
      const finalContent = await fs.readFile(testFilePath, 'utf8');
      expect(finalContent).toBe('New first line\nExisting content');
    });

    it('should handle dry-run mode for prepend operations', async () => {
      await fs.writeFile(testFilePath, 'existing content');

      const prependContent = 'prepended content';
      const frontmatter: FrontmatterConfig = { prepend: true };

      const result = await injector.processFile(testFilePath, prependContent, frontmatter, { force: false, dry: true });

      expect(result.success).toBe(true);
      expect(result.message).toContain('Would prepend content');
      expect(result.changes[0]).toContain('prepend:');
      
      const originalContent = await fs.readFile(testFilePath, 'utf8');
      expect(originalContent).toBe('existing content');
    });
  });

  describe('Mode 5: LineAt - Insert at specific line number', () => {
    it('should insert content at specific line number', async () => {
      const existingContent = 'Line 1\nLine 2\nLine 4\nLine 5';
      await fs.writeFile(testFilePath, existingContent);

      const insertContent = 'Line 3';
      const frontmatter: FrontmatterConfig = { lineAt: 3 };

      const result = await injector.processFile(testFilePath, insertContent, frontmatter, { force: false, dry: false });

      expect(result.success).toBe(true);
      expect(result.message).toContain('Content injected at line 3');
      
      const finalContent = await fs.readFile(testFilePath, 'utf8');
      const lines = finalContent.split('\n');
      expect(lines[0]).toBe('Line 1');
      expect(lines[1]).toBe('Line 2');
      expect(lines[2]).toBe('Line 3');
      expect(lines[3]).toBe('Line 4');
      expect(lines[4]).toBe('Line 5');
    });

    it('should insert at beginning when lineAt is 1', async () => {
      const existingContent = 'Original first line\nSecond line';
      await fs.writeFile(testFilePath, existingContent);

      const insertContent = 'New first line';
      const frontmatter: FrontmatterConfig = { lineAt: 1 };

      const result = await injector.processFile(testFilePath, insertContent, frontmatter, { force: false, dry: false });

      expect(result.success).toBe(true);
      
      const finalContent = await fs.readFile(testFilePath, 'utf8');
      const lines = finalContent.split('\n');
      expect(lines[0]).toBe('New first line');
      expect(lines[1]).toBe('Original first line');
      expect(lines[2]).toBe('Second line');
    });

    it('should be idempotent - not insert duplicate content at same line', async () => {
      const existingContent = 'Line 1\nLine 2\nLine 3\nLine 4';
      await fs.writeFile(testFilePath, existingContent);

      const insertContent = 'Line 2';
      const frontmatter: FrontmatterConfig = { lineAt: 2 };

      const result = await injector.processFile(testFilePath, insertContent, frontmatter, { force: false, dry: false });

      expect(result.success).toBe(true);
      expect(result.skipped).toBe(true);
      expect(result.message).toContain('already at line 2');
      
      const finalContent = await fs.readFile(testFilePath, 'utf8');
      expect(finalContent).toBe(existingContent);
    });

    it('should fail when line number exceeds file length', async () => {
      await fs.writeFile(testFilePath, 'Line 1\nLine 2');

      const insertContent = 'Line 10';
      const frontmatter: FrontmatterConfig = { lineAt: 10 };

      const result = await injector.processFile(testFilePath, insertContent, frontmatter, { force: false, dry: false });

      expect(result.success).toBe(false);
      expect(result.message).toContain('exceeds file length');
    });

    it('should handle dry-run mode for lineAt operations', async () => {
      await fs.writeFile(testFilePath, 'Line 1\nLine 2\nLine 3');

      const insertContent = 'New Line 2';
      const frontmatter: FrontmatterConfig = { lineAt: 2 };

      const result = await injector.processFile(testFilePath, insertContent, frontmatter, { force: false, dry: true });

      expect(result.success).toBe(true);
      expect(result.message).toContain('Would inject content at line 2');
      expect(result.changes[0]).toContain('lineAt:');
      
      const originalContent = await fs.readFile(testFilePath, 'utf8');
      expect(originalContent).toBe('Line 1\nLine 2\nLine 3');
    });
  });

  describe('Mode 6: Conditional - Smart conditional operations', () => {
    it('should perform conditional injection with skipIf evaluation', async () => {
      const existingContent = 'const config = {\n  name: "app"\n};';
      await fs.writeFile(testFilePath, existingContent);

      const injectContent = '  version: "1.0.0",';
      const frontmatter: FrontmatterConfig = { 
        inject: true, 
        after: 'name: "app"',
        skipIf: 'hasVersion' // This should be false, so injection should proceed
      };

      // Test the conditional injection method directly
      const result = await injector['conditionalInject'](testFilePath, injectContent, frontmatter, { force: false, dry: false });

      expect(result.success).toBe(true);
      
      const finalContent = await fs.readFile(testFilePath, 'utf8');
      expect(finalContent).toContain('version: "1.0.0"');
    });

    it('should skip injection when skipIf condition is met', async () => {
      const existingContent = 'const config = {\n  name: "app",\n  version: "1.0.0"\n};';
      await fs.writeFile(testFilePath, existingContent);

      const injectContent = 'version: "1.0.0",';
      const frontmatter: FrontmatterConfig = { 
        inject: true,
        skipIf: 'version' // Content already contains version, so should skip
      };

      // Since content already contains the injection text, it should be skipped
      const result = await injector['conditionalInject'](testFilePath, injectContent, frontmatter, { force: false, dry: false });

      expect(result.success).toBe(true);
      expect(result.skipped).toBe(true);
      
      const finalContent = await fs.readFile(testFilePath, 'utf8');
      expect(finalContent).toBe(existingContent); // Should remain unchanged
    });

    it('should detect conditional mode correctly', async () => {
      const frontmatter: FrontmatterConfig = { 
        inject: true,
        skipIf: 'someCondition'
      };

      const operationMode = injector['getOperationMode'](frontmatter);
      expect(operationMode.mode).toBe('conditional');
    });
  });

  describe('Atomic operations and backups', () => {
    it('should create backups for all modification operations', async () => {
      const originalContent = 'original content';
      await fs.writeFile(testFilePath, originalContent);

      const operations = [
        { frontmatter: { inject: true }, content: 'injected' },
        { frontmatter: { append: true }, content: 'appended' },
        { frontmatter: { prepend: true }, content: 'prepended' },
        { frontmatter: { lineAt: 1 }, content: 'at line 1' }
      ];

      for (const { frontmatter, content } of operations) {
        // Reset file content
        await fs.writeFile(testFilePath, originalContent);
        
        const result = await injector.processFile(testFilePath, content, frontmatter, { 
          force: false, 
          dry: false, 
          backup: true 
        });

        expect(result.success).toBe(true);
        
        // Check backup was created
        const backupFiles = await fs.readdir(tempDir);
        const backupFile = backupFiles.find(f => f.startsWith('test.ts.bak.'));
        expect(backupFile).toBeDefined();
        
        if (backupFile) {
          const backupPath = path.join(tempDir, backupFile);
          const backupContent = await fs.readFile(backupPath, 'utf8');
          expect(backupContent).toBe(originalContent);
          
          // Clean up backup for next test
          await fs.remove(backupPath);
        }
      }
    });

    it('should handle file permission errors gracefully', async () => {
      const readOnlyPath = path.join(tempDir, 'readonly.ts');
      await fs.writeFile(readOnlyPath, 'readonly content');
      
      // Make file read-only (won't work on all systems, but test should handle it)
      try {
        await fs.chmod(readOnlyPath, 0o444);
      } catch {
        // Skip this test if we can't change permissions
        return;
      }

      const result = await injector.processFile(readOnlyPath, 'new content', {}, { force: true, dry: false });
      
      // Should either succeed or fail gracefully
      if (!result.success) {
        expect(result.message).toContain('Error processing file');
      }
    });
  });

  describe('Error scenarios and edge cases', () => {
    it('should handle non-existent files for injection modes', async () => {
      const nonExistentPath = path.join(tempDir, 'nonexistent.ts');
      const frontmatter: FrontmatterConfig = { inject: true };

      const result = await injector.processFile(nonExistentPath, 'content', frontmatter, { force: false, dry: false });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Cannot inject into non-existent file');
    });

    it('should handle invalid operation modes gracefully', async () => {
      await fs.writeFile(testFilePath, 'existing content');
      
      // Force an unknown mode by manipulating the getOperationMode method
      const originalMethod = injector['getOperationMode'];
      injector['getOperationMode'] = () => ({ mode: 'unknown' as any });

      const result = await injector.processFile(testFilePath, 'content', {}, { force: false, dry: false });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Unknown operation mode');

      // Restore original method
      injector['getOperationMode'] = originalMethod;
    });

    it('should handle empty content gracefully', async () => {
      await fs.writeFile(testFilePath, 'existing content');

      const result = await injector.processFile(testFilePath, '', { append: true }, { force: false, dry: false });

      expect(result.success).toBe(true);
      
      const finalContent = await fs.readFile(testFilePath, 'utf8');
      expect(finalContent).toBe('existing content\n');
    });

    it('should handle very long file paths', async () => {
      const longDirPath = path.join(tempDir, 'a'.repeat(100), 'b'.repeat(100));
      await fs.ensureDir(longDirPath);
      const longFilePath = path.join(longDirPath, 'test.ts');

      const result = await injector.processFile(longFilePath, 'content', {}, { force: false, dry: false });

      expect(result.success).toBe(true);
      
      const written = await fs.readFile(longFilePath, 'utf8');
      expect(written).toBe('content');
    });
  });

  describe('Performance and concurrency', () => {
    it('should handle multiple concurrent operations', async () => {
      const operations = Array.from({ length: 10 }, (_, i) => ({
        path: path.join(tempDir, `concurrent-${i}.ts`),
        content: `export const value${i} = ${i};`,
        frontmatter: {}
      }));

      const promises = operations.map(({ path: filePath, content, frontmatter }) =>
        injector.processFile(filePath, content, frontmatter, { force: false, dry: false })
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);
      results.forEach((result, i) => {
        expect(result.success).toBe(true);
        expect(result.message).toContain('File written');
      });

      // Verify all files were created
      for (let i = 0; i < 10; i++) {
        const content = await fs.readFile(path.join(tempDir, `concurrent-${i}.ts`), 'utf8');
        expect(content).toBe(`export const value${i} = ${i};`);
      }
    });

    it('should handle large file content efficiently', async () => {
      const largeContent = 'A'.repeat(1024 * 1024); // 1MB of content
      const frontmatter: FrontmatterConfig = {};

      const start = Date.now();
      const result = await injector.processFile(testFilePath, largeContent, frontmatter, { force: false, dry: false });
      const duration = Date.now() - start;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      
      const written = await fs.readFile(testFilePath, 'utf8');
      expect(written).toBe(largeContent);
    });
  });

  describe('Integration with frontmatter parser', () => {
    it('should correctly parse and execute all operation modes from frontmatter', async () => {
      const testCases = [
        { frontmatter: {}, expectedMode: 'write' },
        { frontmatter: { inject: true }, expectedMode: 'inject' },
        { frontmatter: { append: true }, expectedMode: 'append' },
        { frontmatter: { prepend: true }, expectedMode: 'prepend' },
        { frontmatter: { lineAt: 5 }, expectedMode: 'lineAt' },
        { frontmatter: { inject: true, skipIf: 'condition' }, expectedMode: 'conditional' }
      ];

      testCases.forEach(({ frontmatter, expectedMode }) => {
        const mode = injector['getOperationMode'](frontmatter as FrontmatterConfig);
        expect(mode.mode).toBe(expectedMode);
      });
    });

    it('should validate frontmatter correctly for all modes', async () => {
      const validConfigs = [
        { inject: true, after: 'marker' },
        { append: true },
        { prepend: true },
        { lineAt: 5 },
        { inject: true, skipIf: 'condition' }
      ];

      validConfigs.forEach(config => {
        const validation = parser.validate(config);
        expect(validation.valid).toBe(true);
        expect(validation.errors).toHaveLength(0);
      });
    });
  });
});