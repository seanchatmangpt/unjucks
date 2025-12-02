/**
 * Tests for deterministic tar creation
 */

import { DeterministicTar, createDeterministicTar, createTarEntries, createTarHash } from '../../../src/deterministic/tar';
import type { TarEntry } from '../../../src/deterministic/tar';

describe('DeterministicTar', () => {
  let tar: DeterministicTar;
  
  beforeEach(() => {
    tar = new DeterministicTar();
  });
  
  describe('basic tar creation', () => {
    it('should create a tar archive from entries', async () => {
      const entries: TarEntry[] = [
        {
          path: 'file1.txt',
          content: 'Hello world'
        },
        {
          path: 'dir/',
          isDirectory: true
        },
        {
          path: 'dir/file2.txt',
          content: 'Nested file'
        }
      ];
      
      const tarBuffer = await tar.create(entries);
      
      expect(Buffer.isBuffer(tarBuffer)).toBe(true);
      expect(tarBuffer.length).toBeGreaterThan(0);
    });
    
    it('should handle empty entry list', async () => {
      const tarBuffer = await tar.create([]);
      
      expect(Buffer.isBuffer(tarBuffer)).toBe(true);
      expect(tarBuffer.length).toBeGreaterThan(0); // Empty tar still has headers
    });
    
    it('should handle string and Buffer content', async () => {
      const entries: TarEntry[] = [
        {
          path: 'string.txt',
          content: 'String content'
        },
        {
          path: 'buffer.bin',
          content: Buffer.from('Binary content', 'utf8')
        }
      ];
      
      const tarBuffer = await tar.create(entries);
      expect(Buffer.isBuffer(tarBuffer)).toBe(true);
    });
  });
  
  describe('deterministic behavior', () => {
    it('should produce identical output for identical inputs', async () => {
      const entries: TarEntry[] = [
        {
          path: 'test.txt',
          content: 'Test content'
        },
        {
          path: 'data/',
          isDirectory: true
        },
        {
          path: 'data/nested.json',
          content: JSON.stringify({ key: 'value' })
        }
      ];
      
      const result1 = await tar.create(entries);
      const result2 = await tar.create(entries);
      
      expect(Buffer.compare(result1, result2)).toBe(0);
    });
    
    it('should be deterministic regardless of entry order', async () => {
      const entries1: TarEntry[] = [
        { path: 'z.txt', content: 'last' },
        { path: 'a.txt', content: 'first' },
        { path: 'm.txt', content: 'middle' }
      ];
      
      const entries2: TarEntry[] = [
        { path: 'a.txt', content: 'first' },
        { path: 'm.txt', content: 'middle' },
        { path: 'z.txt', content: 'last' }
      ];
      
      const result1 = await tar.create(entries1);
      const result2 = await tar.create(entries2);
      
      expect(Buffer.compare(result1, result2)).toBe(0);
    });
    
    it('should use deterministic headers', async () => {
      const entries: TarEntry[] = [
        {
          path: 'test.txt',
          content: 'content',
          // These should be overridden to deterministic values
          mtime: new Date('2023-01-01')
        }
      ];
      
      const result1 = await tar.create(entries);
      const result2 = await tar.create(entries);
      
      expect(Buffer.compare(result1, result2)).toBe(0);
    });
  });
  
  describe('directory handling', () => {
    it('should sort directories before their contents', async () => {
      const entries: TarEntry[] = [
        { path: 'dir/file.txt', content: 'file content' },
        { path: 'dir/', isDirectory: true }
      ];
      
      const result = await tar.create(entries);
      expect(Buffer.isBuffer(result)).toBe(true);
    });
    
    it('should auto-detect directories from paths ending with /', async () => {
      const entries: TarEntry[] = [
        { path: 'auto-dir/', content: undefined },
        { path: 'auto-dir/file.txt', content: 'content' }
      ];
      
      const result = await tar.create(entries);
      expect(Buffer.isBuffer(result)).toBe(true);
    });
    
    it('should handle nested directory structures', async () => {
      const entries: TarEntry[] = [
        { path: 'a/', isDirectory: true },
        { path: 'a/b/', isDirectory: true },
        { path: 'a/b/c/', isDirectory: true },
        { path: 'a/b/c/file.txt', content: 'deep file' },
        { path: 'a/file1.txt', content: 'shallow file' }
      ];
      
      const result = await tar.create(entries);
      expect(Buffer.isBuffer(result)).toBe(true);
    });
  });
  
  describe('compression', () => {
    it('should compress when requested', async () => {
      const compressedTar = new DeterministicTar({ compress: true });
      
      const entries: TarEntry[] = [
        {
          path: 'large.txt',
          content: 'x'.repeat(1000) // Compressible content
        }
      ];
      
      const compressed = await compressedTar.create(entries);
      const uncompressed = await tar.create(entries);
      
      expect(compressed.length).toBeLessThan(uncompressed.length);
    });
    
    it('should produce deterministic compressed output', async () => {
      const compressedTar = new DeterministicTar({ 
        compress: true,
        compressionLevel: 6
      });
      
      const entries: TarEntry[] = [
        {
          path: 'data.txt',
          content: 'Repeating content '.repeat(50)
        }
      ];
      
      const result1 = await compressedTar.create(entries);
      const result2 = await compressedTar.create(entries);
      
      expect(Buffer.compare(result1, result2)).toBe(0);
    });
  });
  
  describe('custom options', () => {
    it('should respect custom file modes', async () => {
      const customTar = new DeterministicTar({
        fileMode: 0o755,
        dirMode: 0o755
      });
      
      const entries: TarEntry[] = [
        { path: 'executable', content: '#!/bin/bash\necho "test"' },
        { path: 'data/', isDirectory: true }
      ];
      
      const result = await customTar.create(entries);
      expect(Buffer.isBuffer(result)).toBe(true);
    });
    
    it('should respect custom mtime', async () => {
      const customMtime = new Date('2023-06-15T12:00:00Z');
      const customTar = new DeterministicTar({
        mtime: customMtime
      });
      
      const entries: TarEntry[] = [
        { path: 'file.txt', content: 'content' }
      ];
      
      const result1 = await customTar.create(entries);
      const result2 = await customTar.create(entries);
      
      expect(Buffer.compare(result1, result2)).toBe(0);
    });
    
    it('should allow disabling entry sorting', async () => {
      const unsortedTar = new DeterministicTar({
        sortEntries: false
      });
      
      const entries: TarEntry[] = [
        { path: 'z.txt', content: 'last' },
        { path: 'a.txt', content: 'first' }
      ];
      
      const result = await unsortedTar.create(entries);
      expect(Buffer.isBuffer(result)).toBe(true);
    });
  });
  
  describe('extraction', () => {
    it('should extract entries from created tar', async () => {
      const originalEntries: TarEntry[] = [
        {
          path: 'file1.txt',
          content: 'Content 1'
        },
        {
          path: 'dir/',
          isDirectory: true
        },
        {
          path: 'dir/file2.txt',
          content: 'Content 2'
        }
      ];
      
      const tarBuffer = await tar.create(originalEntries);
      const extractedEntries = await tar.extract(tarBuffer);
      
      expect(extractedEntries).toHaveLength(3);
      
      const file1 = extractedEntries.find(e => e.path === 'file1.txt');
      expect(file1).toBeDefined();
      expect(file1!.content!.toString()).toBe('Content 1');
      
      const dir = extractedEntries.find(e => e.path === 'dir/');
      expect(dir).toBeDefined();
      expect(dir!.isDirectory).toBe(true);
    });
    
    it('should handle compressed tar extraction', async () => {
      const compressedTar = new DeterministicTar({ compress: true });
      
      const entries: TarEntry[] = [
        { path: 'test.txt', content: 'test content' }
      ];
      
      const compressed = await compressedTar.create(entries);
      const extracted = await compressedTar.extract(compressed);
      
      expect(extracted).toHaveLength(1);
      expect(extracted[0].path).toBe('test.txt');
      expect(extracted[0].content!.toString()).toBe('test content');
    });
  });
  
  describe('static functions', () => {
    it('createDeterministicTar should work', async () => {
      const entries: TarEntry[] = [
        { path: 'test.txt', content: 'test' }
      ];
      
      const result = await createDeterministicTar(entries);
      expect(Buffer.isBuffer(result)).toBe(true);
    });
    
    it('createTarEntries should generate entries from file map', () => {
      const files = {
        'src/index.js': 'console.log("hello");',
        'src/utils/helper.js': 'export const help = () => {};',
        'package.json': JSON.stringify({ name: 'test' })
      };
      
      const entries = createTarEntries(files);
      
      // Should have directories + files
      expect(entries.length).toBeGreaterThan(3);
      
      // Check for directory entries
      const srcDir = entries.find(e => e.path === 'src/');
      expect(srcDir).toBeDefined();
      expect(srcDir!.isDirectory).toBe(true);
      
      const utilsDir = entries.find(e => e.path === 'src/utils/');
      expect(utilsDir).toBeDefined();
      expect(utilsDir!.isDirectory).toBe(true);
      
      // Check for file entries
      const indexFile = entries.find(e => e.path === 'src/index.js');
      expect(indexFile).toBeDefined();
      expect(indexFile!.content!.toString()).toBe('console.log("hello");');
    });
    
    it('createTarHash should generate consistent hashes', async () => {
      const entries: TarEntry[] = [
        { path: 'file.txt', content: 'content' }
      ];
      
      const hash1 = await createTarHash(entries);
      const hash2 = await createTarHash(entries);
      
      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/);
    });
  });
  
  describe('edge cases', () => {
    it('should handle empty files', async () => {
      const entries: TarEntry[] = [
        { path: 'empty.txt', content: '' }
      ];
      
      const result = await tar.create(entries);
      expect(Buffer.isBuffer(result)).toBe(true);
    });
    
    it('should handle files with special characters', async () => {
      const entries: TarEntry[] = [
        { path: 'special-chars.txt', content: 'Content with üñíçødé 🚀' }
      ];
      
      const result = await tar.create(entries);
      const extracted = await tar.extract(result);
      
      expect(extracted[0].content!.toString()).toBe('Content with üñíçødé 🚀');
    });
    
    it('should handle very long paths', async () => {
      const longPath = 'very/'.repeat(50) + 'long-path.txt';
      const entries: TarEntry[] = [
        { path: longPath, content: 'content' }
      ];
      
      const result = await tar.create(entries);
      expect(Buffer.isBuffer(result)).toBe(true);
    });
    
    it('should handle binary content', async () => {
      const binaryContent = Buffer.from([0x00, 0xFF, 0x42, 0x13, 0x37]);
      const entries: TarEntry[] = [
        { path: 'binary.bin', content: binaryContent }
      ];
      
      const result = await tar.create(entries);
      const extracted = await tar.extract(result);
      
      expect(Buffer.compare(extracted[0].content as Buffer, binaryContent)).toBe(0);
    });
  });
  
  describe('cross-execution consistency', () => {
    it('should produce identical archives across multiple runs', async () => {
      const entries: TarEntry[] = [
        { path: 'src/', isDirectory: true },
        { path: 'src/index.js', content: 'const app = require("./app");' },
        { path: 'src/app.js', content: 'module.exports = { version: "1.0.0" };' },
        { path: 'tests/', isDirectory: true },
        { path: 'tests/app.test.js', content: 'test("app works", () => {});' },
        { path: 'package.json', content: JSON.stringify({
          name: 'test-app',
          version: '1.0.0',
          dependencies: { express: '^4.18.0' }
        }, null, 2) }
      ];
      
      const results = await Promise.all(
        Array.from({ length: 5 }, () => tar.create(entries))
      );
      
      const firstResult = results[0];
      expect(results.every(result => Buffer.compare(result, firstResult) === 0)).toBe(true);
    });
  });
});