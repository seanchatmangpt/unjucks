import { describe, it, expect } from 'vitest';
import { TestHelper, setupTestEnvironment, cleanupTestEnvironment } from '../helpers/test-helper.js';
import { FileTestHelper } from '../helpers/file-test-helper.js';
import { FileSystemHelper } from '../support/helpers.js';
import { FileSystemHelper as EnhancedFileSystemHelper } from '../support/helpers/filesystem.js';

describe('Test Helper Validation', () => {
  describe('TestHelper imports and basic functionality', () => {
    it('should import TestHelper successfully', () => {
      expect(TestHelper).toBeDefined();
      expect(typeof TestHelper).toBe('function');
    });

    it('should import setupTestEnvironment and cleanupTestEnvironment', () => {
      expect(setupTestEnvironment).toBeDefined();
      expect(cleanupTestEnvironment).toBeDefined();
      expect(typeof setupTestEnvironment).toBe('function');
      expect(typeof cleanupTestEnvironment).toBe('function');
    });

    it('should create TestHelper instance', async () => {
      const helper = new TestHelper();
      expect(helper).toBeDefined();
      expect(helper.tempDir).toBeNull();
      expect(helper.originalCwd).toBeDefined();
      expect(Array.isArray(helper.cleanup)).toBe(true);
    });
  });

  describe('FileTestHelper functionality', () => {
    it('should import FileTestHelper successfully', () => {
      expect(FileTestHelper).toBeDefined();
      expect(typeof FileTestHelper).toBe('function');
    });

    it('should create FileTestHelper instance', () => {
      const helper = new FileTestHelper();
      expect(helper).toBeDefined();
      expect(Array.isArray(helper.tempFiles)).toBe(true);
      expect(Array.isArray(helper.tempDirs)).toBe(true);
      expect(helper.originalFiles).toBeInstanceOf(Map);
    });

    it('should create temp file', async () => {
      const helper = new FileTestHelper();
      const filePath = await helper.createTempFile('test content', '.txt');
      expect(filePath).toBeDefined();
      expect(filePath.endsWith('.txt')).toBe(true);
      
      const content = await helper.readFile(filePath);
      expect(content).toBe('test content');
      
      await helper.cleanup();
    });
  });

  describe('FileSystemHelper functionality', () => {
    it('should import FileSystemHelper successfully', () => {
      expect(FileSystemHelper).toBeDefined();
      expect(typeof FileSystemHelper).toBe('function');
    });

    it('should create FileSystemHelper instance', () => {
      const helper = new FileSystemHelper();
      expect(helper).toBeDefined();
      expect(helper.basePath).toBeDefined();
      expect(Array.isArray(helper.tempPaths)).toBe(true);
      expect(helper.originalFiles).toBeInstanceOf(Map);
    });
  });

  describe('Enhanced FileSystemHelper functionality', () => {
    it('should import EnhancedFileSystemHelper successfully', () => {
      expect(EnhancedFileSystemHelper).toBeDefined();
      expect(typeof EnhancedFileSystemHelper).toBe('function');
    });

    it('should create EnhancedFileSystemHelper instance', () => {
      const helper = new EnhancedFileSystemHelper();
      expect(helper).toBeDefined();
      expect(helper.fixtures).toBeInstanceOf(Map);
      expect(helper.snapshots).toBeInstanceOf(Map);
    });

    it('should create temp workspace', async () => {
      const helper = new EnhancedFileSystemHelper();
      const workspace = await helper.createTestWorkspace();
      expect(workspace).toBeDefined();
      expect(workspace.includes('unjucks-fs-test-')).toBe(true);
      
      // Clean up
      await helper.cleanup();
    });
  });

  describe('Integration - helpers working together', () => {
    it('should work together without conflicts', async () => {
      const testHelper = new TestHelper();
      const fileHelper = new FileTestHelper();
      const fsHelper = new FileSystemHelper();
      const enhancedFsHelper = new EnhancedFileSystemHelper();

      // Test that all helpers can be instantiated together
      expect(testHelper).toBeDefined();
      expect(fileHelper).toBeDefined();
      expect(fsHelper).toBeDefined();
      expect(enhancedFsHelper).toBeDefined();

      // Test basic operations
      const tempFile = await fileHelper.createTempFile('integration test');
      expect(tempFile).toBeDefined();

      const workspace = await enhancedFsHelper.createTestWorkspace();
      expect(workspace).toBeDefined();

      // Clean up all helpers
      await fileHelper.cleanup();
      await fsHelper.cleanup();
      await enhancedFsHelper.cleanup();
      await testHelper.destroy();
    });
  });
});