import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { CASManager } from '../../src/cas/manager.js';

describe('CASManager', () => {
  let manager: CASManager;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `cas-manager-test-${Date.now()}-${Math.random().toString(36)}`);
    await fs.mkdir(tempDir, { recursive: true });
    
    manager = new CASManager({
      cacheDir: tempDir,
      compression: false,
      maxFileSize: 1024 * 1024 // 1MB for tests
    });
    
    await manager.initialize();
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('initialization', () => {
    it('should initialize cache structure', async () => {
      const structure = manager.getCacheStructure();
      
      // Check that all directories exist
      for (const dir of Object.values(structure)) {
        expect(await fs.access(dir).then(() => true).catch(() => false)).toBe(true);
      }
    });

    it('should provide configuration access', () => {
      const config = manager.getConfig();
      
      expect(config.cacheDir).toBe(tempDir);
      expect(config.compression).toBe(false);
      expect(config.maxFileSize).toBe(1024 * 1024);
    });
  });

  describe('store operations', () => {
    it('should store and retrieve content', async () => {
      const content = 'Hello, CAS Manager!';
      
      const hash = await manager.store(content, 'templates');
      const retrieved = await manager.retrieveText(hash, 'templates');
      
      expect(retrieved).toBe(content);
      expect(await manager.exists(hash, 'templates')).toBe(true);
    });

    it('should store files', async () => {
      const testFile = join(tempDir, 'test.txt');
      const content = 'File content for CAS';
      await fs.writeFile(testFile, content);
      
      const hash = await manager.storeFile(testFile, 'artifacts', 'test.txt');
      const retrieved = await manager.retrieveText(hash, 'artifacts');
      
      expect(retrieved).toBe(content);
    });

    it('should store and retrieve packs', async () => {
      const files = {
        'config.json': JSON.stringify({ version: '1.0.0' }),
        'src/main.ts': 'export const version = "1.0.0";',
        'README.md': '# Test Package'
      };
      
      const packHash = await manager.storePack(files, 'test-package');
      const retrieved = await manager.retrievePack(packHash);
      
      expect(retrieved).toBeTruthy();
      expect(Object.keys(retrieved!)).toHaveLength(3);
      expect(retrieved!['config.json'].toString('utf8')).toBe(files['config.json']);
      expect(retrieved!['src/main.ts'].toString('utf8')).toBe(files['src/main.ts']);
      expect(retrieved!['README.md'].toString('utf8')).toBe(files['README.md']);
    });

    it('should retrieve specific file from pack', async () => {
      const files = {
        'file1.txt': 'Content 1',
        'file2.txt': 'Content 2'
      };
      
      const packHash = await manager.storePack(files, 'multi-file');
      const file1Content = await manager.retrieveFromPack(packHash, 'file1.txt');
      const nonExistent = await manager.retrieveFromPack(packHash, 'missing.txt');
      
      expect(file1Content?.toString('utf8')).toBe('Content 1');
      expect(nonExistent).toBeNull();
    });
  });

  describe('reference counting', () => {
    it('should track references', async () => {
      const content = 'reference tracking test';
      const hash = await manager.store(content, 'templates');
      
      expect(manager.getRefCount(hash)).toBe(1);
      
      manager.addReference(hash);
      expect(manager.getRefCount(hash)).toBe(2);
      
      manager.removeReference(hash);
      expect(manager.getRefCount(hash)).toBe(1);
    });

    it('should mark content as accessed during retrieval', async () => {
      const content = 'access tracking test';
      const hash = await manager.store(content, 'templates');
      
      // Access tracking is internal, but we can verify retrieval works
      const retrieved = await manager.retrieve(hash, 'templates');
      expect(retrieved?.toString('utf8')).toBe(content);
      
      const retrievedText = await manager.retrieveText(hash, 'templates');
      expect(retrievedText).toBe(content);
    });
  });

  describe('integrity verification', () => {
    it('should verify content integrity', async () => {
      const content = 'integrity test content';
      const hash = await manager.store(content, 'templates');
      
      const isValid = await manager.verifyIntegrity(hash, 'templates');
      expect(isValid).toBe(true);
    });

    it('should detect integrity issues', async () => {
      const content = 'corruption test';
      const hash = await manager.store(content, 'templates');
      
      // Manually corrupt the stored content
      const storage = (manager as any).storage;
      const storagePath = storage.getStoragePath('templates', hash);
      await fs.writeFile(storagePath, 'corrupted content');
      
      const isValid = await manager.verifyIntegrity(hash, 'templates');
      expect(isValid).toBe(false);
    });
  });

  describe('export functionality', () => {
    it('should export content to external file', async () => {
      const content = 'export test content';
      const hash = await manager.store(content, 'templates');
      
      const exportPath = join(tempDir, 'exported.txt');
      const success = await manager.export(hash, 'templates', exportPath);
      
      expect(success).toBe(true);
      
      const exportedContent = await fs.readFile(exportPath, 'utf8');
      expect(exportedContent).toBe(content);
    });
  });

  describe('garbage collection', () => {
    it('should find orphaned content', async () => {
      const content = 'orphan test';
      const hash = await manager.store(content, 'templates');
      
      // Remove reference to make it an orphan
      manager.removeReference(hash);
      
      const orphans = await manager.findOrphans();
      expect(orphans).toHaveLength(1);
      expect(orphans[0].hash).toBe(hash);
    });

    it('should run garbage collection', async () => {
      const content = 'gc test content';
      const hash = await manager.store(content, 'templates');
      
      // Make it an orphan
      manager.removeReference(hash);
      
      const stats = await manager.runGC({ 
        dryRun: true, 
        minRefCount: 1,
        verbose: false 
      });
      
      expect(stats.totalItems).toBe(1);
      expect(stats.deletedItems).toBe(1);
    });

    it('should get cache size information', async () => {
      const content1 = 'content 1';
      const content2 = 'content 2 with more text';
      
      await manager.store(content1, 'templates');
      await manager.store(content2, 'graphs');
      
      const cacheSize = await manager.getCacheSize();
      
      expect(cacheSize.itemCount).toBe(2);
      expect(cacheSize.totalSize).toBe(
        Buffer.from(content1).length + Buffer.from(content2).length
      );
      expect(cacheSize.sizeByType.templates).toBe(Buffer.from(content1).length);
      expect(cacheSize.sizeByType.graphs).toBe(Buffer.from(content2).length);
    });

    it('should cleanup by cache size', async () => {
      const largeContent = 'X'.repeat(1000);
      await manager.store(largeContent, 'templates');
      
      const stats = await manager.cleanupByCacheSize(500, { dryRun: true, verbose: false });
      
      expect(stats.deletedItems).toBeGreaterThan(0);
      expect(stats.bytesFreed).toBeGreaterThan(0);
    });
  });

  describe('health check', () => {
    it('should perform health check on healthy cache', async () => {
      const content = 'health check test';
      await manager.store(content, 'templates');
      
      const health = await manager.healthCheck();
      
      expect(health.healthy).toBe(true);
      expect(health.issues).toEqual([]);
      expect(health.stats.totalItems).toBe(1);
      expect(health.stats.orphanedItems).toBe(0);
      expect(health.stats.corruptedItems).toBe(0);
    });

    it('should detect orphaned content in health check', async () => {
      const content = 'orphan health test';
      const hash = await manager.store(content, 'templates');
      
      // Make it an orphan
      manager.removeReference(hash);
      
      const health = await manager.healthCheck();
      
      expect(health.stats.orphanedItems).toBe(1);
    });
  });

  describe('optimization', () => {
    it('should optimize cache', async () => {
      const content = 'optimization test';
      const hash = await manager.store(content, 'templates');
      
      // Make it an orphan
      manager.removeReference(hash);
      
      const result = await manager.optimize({ 
        dryRun: true, 
        verbose: false,
        minRefCount: 1 
      });
      
      expect(result.gcStats).toBeTruthy();
      expect(result.optimizationApplied).toEqual([]);
    });

    it('should apply cache size optimization', async () => {
      const largeContent = 'Y'.repeat(1000);
      await manager.store(largeContent, 'templates');
      
      const result = await manager.optimize({ 
        dryRun: true, 
        verbose: false,
        maxCacheSize: 500 
      });
      
      expect(result.optimizationApplied).toContain('cache size limit');
    });

    it('should apply age-based optimization', async () => {
      const content = 'age test';
      await manager.store(content, 'templates');
      
      const result = await manager.optimize({ 
        dryRun: true, 
        verbose: false,
        maxAge: 30 
      });
      
      expect(result.optimizationApplied).toContain('age-based cleanup');
    });
  });

  describe('listing operations', () => {
    it('should list all content', async () => {
      await manager.store('content 1', 'templates');
      await manager.store('content 2', 'graphs');
      await manager.store('content 3', 'artifacts');
      
      const allContent = await manager.list();
      
      expect(allContent).toHaveLength(3);
      
      const types = allContent.map(c => c.type);
      expect(types).toContain('templates');
      expect(types).toContain('graphs');
      expect(types).toContain('artifacts');
    });

    it('should list content by type', async () => {
      await manager.store('template 1', 'templates');
      await manager.store('template 2', 'templates');
      await manager.store('graph 1', 'graphs');
      
      const templates = await manager.list('templates');
      
      expect(templates).toHaveLength(2);
      expect(templates.every(c => c.type === 'templates')).toBe(true);
    });
  });

  describe('metadata operations', () => {
    it('should get content metadata', async () => {
      const content = 'metadata test';
      const hash = await manager.store(content, 'templates');
      
      const metadata = await manager.getMetadata(hash);
      
      expect(metadata).toBeTruthy();
      expect(metadata!.hash).toBe(hash);
      expect(metadata!.type).toBe('templates');
      expect(metadata!.size).toBe(Buffer.from(content).length);
      expect(metadata!.createdAt).toBeInstanceOf(Date);
    });
  });

  describe('error handling', () => {
    it('should handle storage errors gracefully', async () => {
      const largeContent = Buffer.alloc(2 * 1024 * 1024); // 2MB, exceeds limit
      
      await expect(manager.store(largeContent, 'artifacts'))
        .rejects.toThrow('Content size');
    });

    it('should handle retrieval of non-existent content', async () => {
      const fakeHash = 'a'.repeat(64);
      
      const retrieved = await manager.retrieve(fakeHash, 'templates');
      const retrievedText = await manager.retrieveText(fakeHash, 'templates');
      
      expect(retrieved).toBeNull();
      expect(retrievedText).toBeNull();
    });
  });

  describe('backup and restore (not implemented)', () => {
    it('should throw for backup functionality', async () => {
      await expect(manager.backup('/tmp/backup.tar'))
        .rejects.toThrow('Backup functionality not yet implemented');
    });

    it('should throw for restore functionality', async () => {
      await expect(manager.restore('/tmp/backup.tar'))
        .rejects.toThrow('Restore functionality not yet implemented');
    });
  });
});