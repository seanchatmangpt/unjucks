/**
 * Tests for Lock File Manager
 * 
 * Validates:
 * - Lock file generation with deterministic hashes
 * - Update semantics (generation-only, no user prompts)
 * - Baseline comparison and drift detection
 * - Git integration and tracking
 * - File scanning and categorization
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { LockManager, generateLockFile, updateLockFile } from '../../src/config/lock-manager.js';

// Mock child_process
vi.mock('child_process', () => ({
  exec: vi.fn((cmd, options, callback) => {
    // Mock Git commands
    if (cmd.includes('git rev-parse HEAD')) {
      callback(null, { stdout: 'abc123def456\n', stderr: '' });
    } else if (cmd.includes('git rev-parse --abbrev-ref HEAD')) {
      callback(null, { stdout: 'main\n', stderr: '' });
    } else if (cmd.includes('git status --porcelain')) {
      callback(null, { stdout: '', stderr: '' });
    } else {
      callback(new Error('Git command not found'));
    }
  })
}));

describe('LockManager', () => {
  let testDir;
  let manager;
  
  beforeEach(() => {
    testDir = join(tmpdir(), `kgen-lock-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    
    manager = new LockManager({ projectRoot: testDir });
    
    // Mock SOURCE_DATE_EPOCH for deterministic timestamps
    process.env.SOURCE_DATE_EPOCH = '1640995200'; // 2022-01-01T00:00:00Z
  });
  
  afterEach(() => {
    delete process.env.SOURCE_DATE_EPOCH;
    
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('Lock File Generation', () => {
    it('should generate lock file with required structure', async () => {
      // Create test files
      mkdirSync(join(testDir, 'templates'), { recursive: true });
      writeFileSync(join(testDir, 'templates', 'basic.njk'), 'Template content');
      writeFileSync(join(testDir, 'test.ttl'), '@prefix ex: <http://example.org/> .');
      
      const lockFile = await manager.generate();
      
      expect(lockFile.version).toBe('2.0.0');
      expect(lockFile.timestamp).toBeDefined();
      expect(lockFile.project).toBeDefined();
      expect(lockFile.git).toBeDefined();
      expect(lockFile.integrity).toBeDefined();
      expect(lockFile.templates).toBeDefined();
      expect(lockFile.graphs).toBeDefined();
    });

    it('should include file hashes and metadata', async () => {
      mkdirSync(join(testDir, 'templates'), { recursive: true });
      const templateContent = 'Hello {{ name }}';
      writeFileSync(join(testDir, 'templates', 'hello.njk'), templateContent);
      
      const lockFile = await manager.generate();
      
      const templateFile = lockFile.templates['templates/hello.njk'];
      expect(templateFile).toBeDefined();
      expect(templateFile.hash).toBeDefined();
      expect(templateFile.size).toBe(templateContent.length);
      expect(templateFile.modified).toBeDefined();
    });

    it('should generate deterministic timestamps', async () => {
      const lockFile1 = await manager.generate();
      const lockFile2 = await manager.generate();
      
      expect(lockFile1.timestamp).toBe(lockFile2.timestamp);
      expect(lockFile1.timestamp).toBe('2022-01-01T00:00:00.000Z');
    });

    it('should calculate integrity hashes', async () => {
      mkdirSync(join(testDir, 'templates'), { recursive: true });
      writeFileSync(join(testDir, 'templates', 'test.njk'), 'content');
      
      const lockFile = await manager.generate();
      
      expect(lockFile.integrity.combined).toBeDefined();
      expect(lockFile.integrity.components.templates).toBeDefined();
      expect(lockFile.integrity.components.rules).toBeDefined();
      expect(lockFile.integrity.components.graphs).toBeDefined();
    });

    it('should categorize files correctly', async () => {
      // Create files in different categories
      mkdirSync(join(testDir, 'templates'), { recursive: true });
      mkdirSync(join(testDir, 'rules'), { recursive: true });
      
      writeFileSync(join(testDir, 'templates', 'page.njk'), 'template');
      writeFileSync(join(testDir, 'rules', 'validation.n3'), 'rule');
      writeFileSync(join(testDir, 'data.ttl'), 'graph');
      
      const lockFile = await manager.generate();
      
      expect(Object.keys(lockFile.templates)).toContain('templates/page.njk');
      expect(Object.keys(lockFile.rules)).toContain('rules/validation.n3');
      expect(Object.keys(lockFile.graphs)).toContain('data.ttl');
    });
  });

  describe('Lock File Updates', () => {
    it('should update lock file atomically', async () => {
      const lockContent = {
        version: '2.0.0',
        timestamp: '2022-01-01T00:00:00.000Z',
        project: { name: 'test', version: '1.0.0' },
        integrity: { combined: 'hash123' }
      };
      
      await manager.update(lockContent);
      
      expect(existsSync(manager.lockPath)).toBe(true);
      
      const saved = JSON.parse(readFileSync(manager.lockPath, 'utf8'));
      expect(saved.project.name).toBe('test');
    });

    it('should create backup before update', async () => {
      // Create existing lock file
      const existingContent = { version: '1.0.0', old: true };
      writeFileSync(manager.lockPath, JSON.stringify(existingContent));
      
      const newContent = {
        version: '2.0.0',
        timestamp: '2022-01-01T00:00:00.000Z',
        project: { name: 'test', version: '1.0.0' },
        integrity: { combined: 'hash123' }
      };
      
      await manager.update(newContent, { backup: true });
      
      // Check backup was created
      const files = require('fs').readdirSync(testDir);
      const backupFiles = files.filter(f => f.startsWith('kgen.lock.json.backup.'));
      expect(backupFiles.length).toBe(1);
    });

    it('should skip backup when disabled', async () => {
      const existingContent = { version: '1.0.0', old: true };
      writeFileSync(manager.lockPath, JSON.stringify(existingContent));
      
      const newContent = {
        version: '2.0.0',
        timestamp: '2022-01-01T00:00:00.000Z',
        project: { name: 'test', version: '1.0.0' },
        integrity: { combined: 'hash123' }
      };
      
      await manager.update(newContent, { backup: false });
      
      const files = require('fs').readdirSync(testDir);
      const backupFiles = files.filter(f => f.startsWith('kgen.lock.json.backup.'));
      expect(backupFiles.length).toBe(0);
    });
  });

  describe('Lock File Loading', () => {
    it('should load existing lock file', async () => {
      const lockContent = {
        version: '2.0.0',
        timestamp: '2022-01-01T00:00:00.000Z',
        project: { name: 'test', version: '1.0.0' },
        integrity: { combined: 'hash123' }
      };
      
      writeFileSync(manager.lockPath, JSON.stringify(lockContent));
      
      const loaded = await manager.load();
      expect(loaded.project.name).toBe('test');
      expect(loaded.version).toBe('2.0.0');
    });

    it('should return null for missing lock file', async () => {
      const loaded = await manager.load();
      expect(loaded).toBeNull();
    });

    it('should validate lock file version compatibility', async () => {
      const incompatibleLock = {
        version: '3.0.0', // Future version
        project: { name: 'test' }
      };
      
      writeFileSync(manager.lockPath, JSON.stringify(incompatibleLock));
      
      await expect(manager.load()).rejects.toThrow(
        'Incompatible lock file version: 3.0.0'
      );
    });

    it('should handle malformed lock file', async () => {
      writeFileSync(manager.lockPath, '{ invalid json }');
      
      await expect(manager.load()).rejects.toThrow(
        'Failed to load lock file'
      );
    });
  });

  describe('File Scanning', () => {
    it('should scan files according to patterns', async () => {
      mkdirSync(join(testDir, 'templates'), { recursive: true });
      mkdirSync(join(testDir, 'custom'), { recursive: true });
      
      writeFileSync(join(testDir, 'templates', 'page.njk'), 'template');
      writeFileSync(join(testDir, 'custom', 'widget.njk'), 'widget');
      writeFileSync(join(testDir, 'data.ttl'), 'graph');
      
      // Custom patterns
      const customManager = new LockManager({
        projectRoot: testDir,
        patterns: {
          templates: ['templates/**/*', 'custom/**/*'],
          graphs: ['**/*.ttl']
        }
      });
      
      const files = await customManager.scanProjectFiles();
      
      const filePaths = Array.from(files.keys());
      expect(filePaths).toContain(join(testDir, 'templates', 'page.njk'));
      expect(filePaths).toContain(join(testDir, 'custom', 'widget.njk'));
      expect(filePaths).toContain(join(testDir, 'data.ttl'));
    });

    it('should ignore common build directories', async () => {
      mkdirSync(join(testDir, 'node_modules', 'pkg'), { recursive: true });
      mkdirSync(join(testDir, 'dist'), { recursive: true });
      
      writeFileSync(join(testDir, 'node_modules', 'pkg', 'file.js'), 'ignored');
      writeFileSync(join(testDir, 'dist', 'build.js'), 'ignored');
      writeFileSync(join(testDir, 'source.ttl'), 'included');
      
      const files = await manager.scanProjectFiles();
      const filePaths = Array.from(files.keys());
      
      expect(filePaths).not.toContain(join(testDir, 'node_modules', 'pkg', 'file.js'));
      expect(filePaths).not.toContain(join(testDir, 'dist', 'build.js'));
      expect(filePaths).toContain(join(testDir, 'source.ttl'));
    });

    it('should handle files in multiple categories', async () => {
      writeFileSync(join(testDir, 'combined.ttl'), 'content');
      
      // Configure overlapping patterns
      const customManager = new LockManager({
        projectRoot: testDir,
        patterns: {
          graphs: ['**/*.ttl'],
          validation: ['**/*.ttl'] // Same file, different category
        }
      });
      
      const files = await customManager.scanProjectFiles();
      const fileInfo = files.get(join(testDir, 'combined.ttl'));
      
      expect(fileInfo.categories.has('graphs')).toBe(true);
      expect(fileInfo.categories.has('validation')).toBe(true);
    });
  });

  describe('Comparison and Drift Detection', () => {
    it('should detect clean state when no changes', async () => {
      // Create initial state
      writeFileSync(join(testDir, 'data.ttl'), 'content');
      const initialLock = await manager.generate();
      await manager.update(initialLock);
      
      // Compare with same state
      const comparison = await manager.compare();
      
      expect(comparison.status).toBe('clean');
      expect(comparison.message).toBe('No changes detected');
      expect(comparison.changes).toHaveLength(0);
    });

    it('should detect added files', async () => {
      // Create initial state with empty lock
      const emptyLock = {
        version: '2.0.0',
        timestamp: '2022-01-01T00:00:00.000Z',
        project: { name: 'test', version: '1.0.0' },
        integrity: { combined: 'empty', components: {} },
        templates: {},
        rules: {},
        graphs: {}
      };
      await manager.update(emptyLock);
      
      // Add new file
      writeFileSync(join(testDir, 'new.ttl'), 'new content');
      
      const comparison = await manager.compare();
      
      expect(comparison.status).toBe('drift');
      expect(comparison.changes).toContainEqual(
        expect.objectContaining({
          type: 'added',
          file: 'new.ttl'
        })
      );
    });

    it('should detect modified files', async () => {
      // Create initial state
      writeFileSync(join(testDir, 'data.ttl'), 'original content');
      const initialLock = await manager.generate();
      await manager.update(initialLock);
      
      // Modify file
      writeFileSync(join(testDir, 'data.ttl'), 'modified content');
      
      const comparison = await manager.compare();
      
      expect(comparison.status).toBe('drift');
      expect(comparison.changes).toContainEqual(
        expect.objectContaining({
          type: 'modified',
          file: 'data.ttl'
        })
      );
    });

    it('should detect removed files', async () => {
      // Create initial state
      writeFileSync(join(testDir, 'temp.ttl'), 'temporary content');
      const initialLock = await manager.generate();
      await manager.update(initialLock);
      
      // Remove file
      rmSync(join(testDir, 'temp.ttl'));
      
      const comparison = await manager.compare();
      
      expect(comparison.status).toBe('drift');
      expect(comparison.changes).toContainEqual(
        expect.objectContaining({
          type: 'removed',
          file: 'temp.ttl'
        })
      );
    });

    it('should handle missing baseline lock file', async () => {
      const comparison = await manager.compare();
      
      expect(comparison.status).toBe('no-lock');
      expect(comparison.message).toBe('No lock file found');
    });
  });

  describe('Validation', () => {
    it('should validate complete lock file structure', () => {
      const validLock = {
        version: '2.0.0',
        timestamp: '2022-01-01T00:00:00.000Z',
        project: { name: 'test', version: '1.0.0' },
        integrity: { combined: 'hash123' }
      };
      
      expect(() => manager.validateLockFile(validLock)).not.toThrow();
    });

    it('should reject lock file missing required fields', () => {
      const invalidLock = {
        version: '2.0.0'
        // Missing timestamp, project, integrity
      };
      
      expect(() => manager.validateLockFile(invalidLock)).toThrow(
        'Lock file missing required field: timestamp'
      );
    });

    it('should reject invalid version', () => {
      const invalidLock = {
        version: 'invalid',
        timestamp: '2022-01-01T00:00:00.000Z',
        project: { name: 'test' },
        integrity: { combined: 'hash' }
      };
      
      expect(() => manager.validateLockFile(invalidLock)).toThrow(
        'Invalid lock file version: invalid'
      );
    });
  });

  describe('Version Compatibility', () => {
    it('should accept compatible major versions', () => {
      expect(manager.isCompatibleVersion('2.0.0')).toBe(true);
      expect(manager.isCompatibleVersion('2.1.0')).toBe(true);
      expect(manager.isCompatibleVersion('2.99.99')).toBe(true);
    });

    it('should reject incompatible major versions', () => {
      expect(manager.isCompatibleVersion('1.0.0')).toBe(false);
      expect(manager.isCompatibleVersion('3.0.0')).toBe(false);
      expect(manager.isCompatibleVersion('0.1.0')).toBe(false);
    });
  });

  describe('Git Information', () => {
    it('should include Git information in lock file', async () => {
      writeFileSync(join(testDir, 'test.ttl'), 'content');
      
      const lockFile = await manager.generate();
      
      expect(lockFile.git).toBeDefined();
      expect(lockFile.git.commit).toBe('abc123def456');
      expect(lockFile.git.branch).toBe('main');
      expect(lockFile.git.dirty).toBe(false);
      expect(lockFile.git.timestamp).toBeDefined();
    });
  });
});

describe('Convenience Functions', () => {
  let testDir;
  
  beforeEach(() => {
    testDir = join(tmpdir(), `kgen-lock-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    process.env.SOURCE_DATE_EPOCH = '1640995200';
  });
  
  afterEach(() => {
    delete process.env.SOURCE_DATE_EPOCH;
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should generate lock file with generateLockFile function', async () => {
    writeFileSync(join(testDir, 'test.ttl'), 'content');
    
    const lockFile = await generateLockFile({ projectRoot: testDir });
    
    expect(lockFile.version).toBe('2.0.0');
    expect(lockFile.project).toBeDefined();
  });

  it('should update lock file with updateLockFile function', async () => {
    const lockContent = {
      version: '2.0.0',
      timestamp: '2022-01-01T00:00:00.000Z',
      project: { name: 'test', version: '1.0.0' },
      integrity: { combined: 'hash123' }
    };
    
    await updateLockFile(lockContent, { projectRoot: testDir });
    
    const lockPath = join(testDir, 'kgen.lock.json');
    expect(existsSync(lockPath)).toBe(true);
    
    const saved = JSON.parse(readFileSync(lockPath, 'utf8'));
    expect(saved.project.name).toBe('test');
  });
});
