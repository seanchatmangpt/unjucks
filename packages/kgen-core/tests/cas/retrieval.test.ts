import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { ContentAddressedStorage } from '../../src/cas/storage.js';
import { ContentRetrieval } from '../../src/cas/retrieval.js';
import { createBLAKE3 } from 'hash-wasm';

describe('ContentRetrieval', () => {
  let storage: ContentAddressedStorage;
  let retrieval: ContentRetrieval;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `cas-retrieval-test-${Date.now()}-${Math.random().toString(36)}`);
    await fs.mkdir(tempDir, { recursive: true });
    
    storage = new ContentAddressedStorage({
      cacheDir: tempDir,
      compression: false
    });
    
    retrieval = new ContentRetrieval(storage);
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('retrieve', () => {
    it('should retrieve stored content', async () => {
      const content = 'Hello, retrieval!';
      const hash = await storage.store(content, 'templates');
      
      const retrieved = await retrieval.retrieve(hash, 'templates');
      
      expect(retrieved).toBeTruthy();
      expect(retrieved?.toString('utf8')).toBe(content);
    });

    it('should return null for non-existent content', async () => {
      const fakeHash = 'a'.repeat(64);
      
      const retrieved = await retrieval.retrieve(fakeHash, 'templates');
      
      expect(retrieved).toBeNull();
    });

    it('should verify integrity by default', async () => {
      const content = 'integrity test';
      const hash = await storage.store(content, 'templates');
      
      // Corrupt the stored file
      const storagePath = storage.getStoragePath('templates', hash);
      await fs.writeFile(storagePath, 'corrupted content');
      
      const retrieved = await retrieval.retrieve(hash, 'templates', { verifyIntegrity: true });
      
      expect(retrieved).toBeNull();
    });

    it('should skip integrity verification when disabled', async () => {
      const content = 'integrity skip test';
      const hash = await storage.store(content, 'templates');
      
      // Corrupt the stored file
      const storagePath = storage.getStoragePath('templates', hash);
      const corruptedContent = 'corrupted content';
      await fs.writeFile(storagePath, corruptedContent);
      
      const retrieved = await retrieval.retrieve(hash, 'templates', { verifyIntegrity: false });
      
      expect(retrieved).toBeTruthy();
      expect(retrieved?.toString('utf8')).toBe(corruptedContent);
    });
  });

  describe('retrieveText', () => {
    it('should retrieve content as text', async () => {
      const content = 'Text retrieval test';
      const hash = await storage.store(content, 'templates');
      
      const retrieved = await retrieval.retrieveText(hash, 'templates');
      
      expect(retrieved).toBe(content);
    });

    it('should support different encodings', async () => {
      const content = Buffer.from('UTF-8 content with émojis 🚀', 'utf8');
      const hash = await storage.store(content, 'artifacts');
      
      const retrieved = await retrieval.retrieveText(hash, 'artifacts', 'utf8');
      
      expect(retrieved).toBe('UTF-8 content with émojis 🚀');
    });

    it('should return null for non-existent content', async () => {
      const fakeHash = 'b'.repeat(64);
      
      const retrieved = await retrieval.retrieveText(fakeHash, 'templates');
      
      expect(retrieved).toBeNull();
    });
  });

  describe('pack operations', () => {
    it('should retrieve pack contents', async () => {
      const files = {
        'file1.txt': 'Content 1',
        'file2.json': JSON.stringify({ test: true }),
        'dir/file3.md': '# Markdown content'
      };
      
      const packHash = await storage.storePack(files, 'test-pack');
      const retrieved = await retrieval.retrievePack(packHash);
      
      expect(retrieved).toBeTruthy();
      expect(Object.keys(retrieved!)).toHaveLength(3);
      expect(retrieved!['file1.txt'].toString('utf8')).toBe('Content 1');
      expect(retrieved!['file2.json'].toString('utf8')).toBe(JSON.stringify({ test: true }));
      expect(retrieved!['dir/file3.md'].toString('utf8')).toBe('# Markdown content');
    });

    it('should get pack entries without full extraction', async () => {
      const files = {
        'small.txt': 'Small content',
        'large.txt': 'X'.repeat(1000)
      };
      
      const packHash = await storage.storePack(files, 'test-pack');
      const entries = await retrieval.getPackEntries(packHash);
      
      expect(entries).toBeTruthy();
      expect(entries).toHaveLength(2);
      
      const smallEntry = entries!.find(e => e.filename === 'small.txt');
      const largeEntry = entries!.find(e => e.filename === 'large.txt');
      
      expect(smallEntry).toBeTruthy();
      expect(smallEntry!.content.toString('utf8')).toBe('Small content');
      
      expect(largeEntry).toBeTruthy();
      expect(largeEntry!.content.length).toBe(1000);
    });

    it('should retrieve specific file from pack', async () => {
      const files = {
        'config.json': JSON.stringify({ version: '1.0.0' }),
        'readme.md': '# Package README',
        'src/main.ts': 'export default function() {}'
      };
      
      const packHash = await storage.storePack(files, 'package');
      
      const configContent = await retrieval.retrieveFromPack(packHash, 'config.json');
      const srcContent = await retrieval.retrieveFromPack(packHash, 'src/main.ts');
      const nonExistent = await retrieval.retrieveFromPack(packHash, 'non-existent.txt');
      
      expect(configContent?.toString('utf8')).toBe(JSON.stringify({ version: '1.0.0' }));
      expect(srcContent?.toString('utf8')).toBe('export default function() {}');
      expect(nonExistent).toBeNull();
    });

    it('should return null for non-existent pack', async () => {
      const fakeHash = 'c'.repeat(64);
      
      const retrieved = await retrieval.retrievePack(fakeHash);
      
      expect(retrieved).toBeNull();
    });
  });

  describe('exists', () => {
    it('should check content existence', async () => {
      const content = 'existence test';
      const hash = await storage.store(content, 'templates');
      
      expect(await retrieval.exists(hash, 'templates')).toBe(true);
      expect(await retrieval.exists(hash, 'graphs')).toBe(false);
      
      const fakeHash = 'd'.repeat(64);
      expect(await retrieval.exists(fakeHash, 'templates')).toBe(false);
    });

    it('should check existence with integrity verification', async () => {
      const content = 'integrity existence test';
      const hash = await storage.store(content, 'templates');
      
      expect(await retrieval.exists(hash, 'templates', true)).toBe(true);
      
      // Corrupt the content
      const storagePath = storage.getStoragePath('templates', hash);
      await fs.writeFile(storagePath, 'corrupted');
      
      expect(await retrieval.exists(hash, 'templates', true)).toBe(false);
      expect(await retrieval.exists(hash, 'templates', false)).toBe(true);
    });
  });

  describe('verifyIntegrity', () => {
    it('should verify content integrity', async () => {
      const content = 'integrity verification test';
      const buffer = Buffer.from(content, 'utf8');
      const hasher = await createBLAKE3();
      hasher.init();
      hasher.update(buffer);
      const hash = hasher.digest('hex');
      
      const isValid = await retrieval.verifyIntegrity(buffer, hash);
      
      expect(isValid).toBe(true);
    });

    it('should detect corrupted content', async () => {
      const content = Buffer.from('original content', 'utf8');
      const hasher = await createBLAKE3();
      hasher.init();
      hasher.update(content);
      const hash = hasher.digest('hex');
      const corruptedContent = Buffer.from('corrupted content', 'utf8');
      
      const isValid = await retrieval.verifyIntegrity(corruptedContent, hash);
      
      expect(isValid).toBe(false);
    });
  });

  describe('export', () => {
    it('should export content to external file', async () => {
      const content = 'export test content';
      const hash = await storage.store(content, 'templates');
      
      const exportPath = join(tempDir, 'exported.txt');
      const success = await retrieval.export(hash, 'templates', exportPath);
      
      expect(success).toBe(true);
      
      const exportedContent = await fs.readFile(exportPath, 'utf8');
      expect(exportedContent).toBe(content);
    });

    it('should return false for non-existent content', async () => {
      const fakeHash = 'e'.repeat(64);
      const exportPath = join(tempDir, 'non-existent.txt');
      
      const success = await retrieval.export(fakeHash, 'templates', exportPath);
      
      expect(success).toBe(false);
    });
  });

  describe('compare', () => {
    it('should compare identical content', async () => {
      const content = 'comparison test';
      const hash1 = await storage.store(content, 'templates');
      const hash2 = await storage.store(content, 'graphs');
      
      const comparison = await retrieval.compare(hash1, 'templates', hash2, 'graphs');
      
      expect(comparison.identical).toBe(true);
      expect(comparison.sizeDiff).toBe(0);
      expect(comparison.hashDiff).toBe(false); // Same content = same hash
    });

    it('should compare different content', async () => {
      const content1 = 'first content';
      const content2 = 'second content with more text';
      
      const hash1 = await storage.store(content1, 'templates');
      const hash2 = await storage.store(content2, 'templates');
      
      const comparison = await retrieval.compare(hash1, 'templates', hash2, 'templates');
      
      expect(comparison.identical).toBe(false);
      expect(comparison.sizeDiff).toBe(Buffer.from(content2).length - Buffer.from(content1).length);
      expect(comparison.hashDiff).toBe(true);
    });

    it('should handle non-existent content in comparison', async () => {
      const content = 'real content';
      const hash1 = await storage.store(content, 'templates');
      const fakeHash = 'f'.repeat(64);
      
      const comparison = await retrieval.compare(hash1, 'templates', fakeHash, 'templates');
      
      expect(comparison.identical).toBe(false);
      expect(comparison.hashDiff).toBe(true);
      expect(comparison.sizeDiff).toBeUndefined();
    });
  });

  describe('findByPartialHash', () => {
    it('should find content by partial hash', async () => {
      const content = 'partial hash test';
      const hash = await storage.store(content, 'templates');
      
      const partialHash = hash.substring(0, 8);
      const found = await retrieval.findByPartialHash(partialHash);
      
      expect(found).toHaveLength(1);
      expect(found[0].hash).toBe(hash);
    });

    it('should filter by content type', async () => {
      const content = 'type filter test';
      await storage.store(content, 'templates');
      await storage.store(content, 'graphs');
      
      const hasher = await createBLAKE3();
      hasher.init();
      hasher.update(Buffer.from(content, 'utf8'));
      const hash = hasher.digest('hex');
      const partialHash = hash.substring(0, 8);
      
      const allFound = await retrieval.findByPartialHash(partialHash);
      const templatesFound = await retrieval.findByPartialHash(partialHash, 'templates');
      
      expect(allFound).toHaveLength(2);
      expect(templatesFound).toHaveLength(1);
      expect(templatesFound[0].type).toBe('templates');
    });

    it('should return empty array for no matches', async () => {
      const found = await retrieval.findByPartialHash('nonexistent');
      
      expect(found).toEqual([]);
    });
  });
});