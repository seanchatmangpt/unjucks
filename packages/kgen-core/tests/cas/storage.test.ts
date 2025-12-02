import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { ContentAddressedStorage } from '../../src/cas/storage.js';
import { createBLAKE3 } from 'hash-wasm';

describe('ContentAddressedStorage', () => {
  let storage: ContentAddressedStorage;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `cas-test-${Date.now()}-${Math.random().toString(36)}`);
    await fs.mkdir(tempDir, { recursive: true });
    
    storage = new ContentAddressedStorage({
      cacheDir: tempDir,
      compression: false,
      maxFileSize: 1024 * 1024 // 1MB for tests
    });
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('store', () => {
    it('should store string content and return hash', async () => {
      const content = 'Hello, World!';
      const hasher = await createBLAKE3();
      hasher.init();
      hasher.update(Buffer.from(content, 'utf8'));
      const expectedHash = hasher.digest('hex');
      
      const hash = await storage.store(content, 'templates');
      
      expect(hash).toBe(expectedHash);
      expect(await storage.exists(hash, 'templates')).toBe(true);
    });

    it('should store buffer content and return hash', async () => {
      const content = Buffer.from('Binary content', 'utf8');
      const hasher = await createBLAKE3();
      hasher.init();
      hasher.update(content);
      const expectedHash = hasher.digest('hex');
      
      const hash = await storage.store(content, 'artifacts');
      
      expect(hash).toBe(expectedHash);
      expect(await storage.exists(hash, 'artifacts')).toBe(true);
    });

    it('should create proper storage path for different content types', async () => {
      const content = 'test content';
      
      const graphHash = await storage.store(content, 'graphs');
      const templateHash = await storage.store(content, 'templates');
      const artifactHash = await storage.store(content, 'artifacts');
      
      const graphPath = storage.getStoragePath('graphs', graphHash);
      const templatePath = storage.getStoragePath('templates', templateHash);
      const artifactPath = storage.getStoragePath('artifacts', artifactHash);
      
      expect(graphPath).toContain('/graphs/');
      expect(graphPath).toEndWith('/graph.nq');
      expect(templatePath).toContain('/templates/');
      expect(templatePath).toEndWith('/template.njk');
      expect(artifactPath).toContain('/artifacts/');
    });

    it('should not store duplicate content', async () => {
      const content = 'duplicate content';
      
      const hash1 = await storage.store(content, 'templates');
      const hash2 = await storage.store(content, 'templates');
      
      expect(hash1).toBe(hash2);
      expect(storage.getRefCount(hash1)).toBe(2);
    });

    it('should reject content exceeding max file size', async () => {
      const largeContent = Buffer.alloc(2 * 1024 * 1024); // 2MB
      
      await expect(storage.store(largeContent, 'artifacts'))
        .rejects.toThrow('Content size');
    });
  });

  describe('storeFile', () => {
    it('should store file by path', async () => {
      const testFilePath = join(tempDir, 'test-file.txt');
      const content = 'File content';
      await fs.writeFile(testFilePath, content);
      
      const hash = await storage.storeFile(testFilePath, 'artifacts', 'test-file.txt');
      
      expect(await storage.exists(hash, 'artifacts')).toBe(true);
      
      const storedPath = storage.getStoragePath('artifacts', hash, 'test-file.txt');
      const storedContent = await fs.readFile(storedPath, 'utf8');
      expect(storedContent).toBe(content);
    });

    it('should reject large files', async () => {
      const testFilePath = join(tempDir, 'large-file.bin');
      const largeContent = Buffer.alloc(2 * 1024 * 1024); // 2MB
      await fs.writeFile(testFilePath, largeContent);
      
      await expect(storage.storeFile(testFilePath, 'artifacts'))
        .rejects.toThrow('File size');
    });
  });

  describe('storePack', () => {
    it('should store multiple files as a pack', async () => {
      const files = {
        'file1.txt': 'Content 1',
        'file2.txt': Buffer.from('Content 2'),
        'subdir/file3.json': JSON.stringify({ test: true })
      };
      
      const hash = await storage.storePack(files, 'test-pack');
      
      expect(await storage.exists(hash, 'packs')).toBe(true);
      
      const packPath = storage.getStoragePath('packs', hash, 'test-pack.tar');
      expect(await fs.access(packPath).then(() => true).catch(() => false)).toBe(true);
    });
  });

  describe('getStoragePath', () => {
    it('should generate correct paths for different content types', () => {
      const hash = 'a'.repeat(64); // Mock hash
      
      expect(storage.getStoragePath('graphs', hash))
        .toBe(join(tempDir, 'graphs', hash, 'graph.nq'));
      
      expect(storage.getStoragePath('templates', hash))
        .toBe(join(tempDir, 'templates', hash, 'template.njk'));
      
      expect(storage.getStoragePath('artifacts', hash, 'custom.txt'))
        .toBe(join(tempDir, 'artifacts', hash, 'custom.txt'));
      
      expect(storage.getStoragePath('packs', hash, 'pack.tar'))
        .toBe(join(tempDir, 'packs', hash, 'pack.tar'));
    });

    it('should throw for unknown content type', () => {
      const hash = 'a'.repeat(64);
      
      expect(() => storage.getStoragePath('unknown' as any, hash))
        .toThrow('Unknown content type');
    });
  });

  describe('metadata operations', () => {
    it('should store and retrieve metadata', async () => {
      const content = 'metadata test';
      const hash = await storage.store(content, 'templates');
      
      const metadata = await storage.getMetadata(hash);
      
      expect(metadata).toBeTruthy();
      expect(metadata?.hash).toBe(hash);
      expect(metadata?.type).toBe('templates');
      expect(metadata?.size).toBe(Buffer.from(content).length);
      expect(metadata?.createdAt).toBeInstanceOf(Date);
    });

    it('should return null for non-existent metadata', async () => {
      const fakeHash = 'b'.repeat(64);
      const metadata = await storage.getMetadata(fakeHash);
      
      expect(metadata).toBeNull();
    });
  });

  describe('list operations', () => {
    it('should list all stored content', async () => {
      await storage.store('content 1', 'templates');
      await storage.store('content 2', 'graphs');
      await storage.store('content 3', 'artifacts');
      
      const allContent = await storage.list();
      
      expect(allContent).toHaveLength(3);
      expect(allContent.map(c => c.type)).toContain('templates');
      expect(allContent.map(c => c.type)).toContain('graphs');
      expect(allContent.map(c => c.type)).toContain('artifacts');
    });

    it('should filter by content type', async () => {
      await storage.store('template 1', 'templates');
      await storage.store('template 2', 'templates');
      await storage.store('graph 1', 'graphs');
      
      const templates = await storage.list('templates');
      
      expect(templates).toHaveLength(2);
      expect(templates.every(c => c.type === 'templates')).toBe(true);
    });

    it('should return empty array for empty cache', async () => {
      const content = await storage.list();
      
      expect(content).toEqual([]);
    });
  });

  describe('reference counting', () => {
    it('should track reference counts', async () => {
      const content = 'reference test';
      
      const hash1 = await storage.store(content, 'templates');
      expect(storage.getRefCount(hash1)).toBe(1);
      
      const hash2 = await storage.store(content, 'templates'); // Same content
      expect(hash1).toBe(hash2);
      expect(storage.getRefCount(hash1)).toBe(2);
    });

    it('should increment and decrement references manually', async () => {
      const content = 'ref count test';
      const hash = await storage.store(content, 'templates');
      
      expect(storage.getRefCount(hash)).toBe(1);
      
      storage.incrementRef(hash);
      expect(storage.getRefCount(hash)).toBe(2);
      
      storage.decrementRef(hash);
      expect(storage.getRefCount(hash)).toBe(1);
      
      storage.decrementRef(hash);
      expect(storage.getRefCount(hash)).toBe(0);
      
      // Should not go below 0
      storage.decrementRef(hash);
      expect(storage.getRefCount(hash)).toBe(0);
    });
  });

  describe('exists', () => {
    it('should return true for existing content', async () => {
      const content = 'exists test';
      const hash = await storage.store(content, 'templates');
      
      expect(await storage.exists(hash, 'templates')).toBe(true);
    });

    it('should return false for non-existent content', async () => {
      const fakeHash = 'c'.repeat(64);
      
      expect(await storage.exists(fakeHash, 'templates')).toBe(false);
    });
  });
});