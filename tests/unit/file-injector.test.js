import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FileInjector } from '../../src/lib/file-injector.js';
import { FileTestHelper } from '../helpers/file-test-helper.js';
import fs from 'fs-extra';

// Create a mock for fs module
const mockFs = {
  readFile: vi.fn(),
  writeFile: vi.fn(),
  pathExists: vi.fn(),
  ensureFile: vi.fn()
};

vi.mock('fs-extra', () => mockFs);

describe('FileInjector', () => {
  let injector;
  let helper;

  beforeEach(() => {
    helper = new FileTestHelper();
    injector = new FileInjector();
    
    // Reset all mocks
    vi.clearAllMocks();
    
    // Default mock implementations
    mockFs.pathExists.mockResolvedValue(true);
    mockFs.ensureFile.mockResolvedValue();
    mockFs.readFile.mockResolvedValue('existing content');
    mockFs.writeFile.mockResolvedValue();
  });

  afterEach(async () => {
    await helper.cleanup();
    vi.resetAllMocks();
  });

  describe('inject', () => {
    it('should inject content at the end of file by default', async () => {
      const testFile = helper.createTempFile('test.js', 'console.log("hello");');
      
      mockFs.readFile.mockResolvedValue(testFile.content);
      mockFs.writeFile.mockResolvedValue();

      const result = await injector.inject(testFile.path, 'console.log("world");');

      expect(result.success).toBe(true);
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        testFile.path,
        'console.log("hello");\nconsole.log("world");',
        'utf-8'
      );
    });

    it('should inject content at specific line', async () => {
      const content = 'line 1\nline 2\nline 3';
      const testFile = helper.createTempFile('test.txt', content);
      
      mockFs.readFile.mockResolvedValue(content);
      mockFs.writeFile.mockResolvedValue();

      const result = await injector.inject(
        testFile.path,
        'inserted line',
        { lineAt: 2 }
      );

      expect(result.success).toBe(true);
      expect(result.modifiedContent).toContain('inserted line');
    });

    it('should inject content before marker', async () => {
      const content = 'start\n// MARKER\nend';
      const testFile = helper.createTempFile('test.js', content);
      
      mockFs.readFile.mockResolvedValue(content);
      mockFs.writeFile.mockResolvedValue();

      const result = await injector.inject(
        testFile.path,
        'before marker',
        { before: '// MARKER' }
      );

      expect(result.success).toBe(true);
      expect(result.modifiedContent).toContain('before marker\n// MARKER');
    });

    it('should inject content after marker', async () => {
      const content = 'start\n// MARKER\nend';
      const testFile = helper.createTempFile('test.js', content);
      
      mockFs.readFile.mockResolvedValue(content);
      mockFs.writeFile.mockResolvedValue();

      const result = await injector.inject(
        testFile.path,
        'after marker',
        { after: '// MARKER' }
      );

      expect(result.success).toBe(true);
      expect(result.modifiedContent).toContain('// MARKER\nafter marker');
    });

    it('should prepend content', async () => {
      const testFile = helper.createTempFile('test.js', 'existing content');
      
      mockFs.readFile.mockResolvedValue('existing content');
      mockFs.writeFile.mockResolvedValue();

      const result = await injector.inject(
        testFile.path,
        'prepended content',
        { prepend: true }
      );

      expect(result.success).toBe(true);
      expect(result.modifiedContent).toBe('prepended content\nexisting content');
    });

    it('should append content', async () => {
      const testFile = helper.createTempFile('test.js', 'existing content');
      
      mockFs.readFile.mockResolvedValue('existing content');
      mockFs.writeFile.mockResolvedValue();

      const result = await injector.inject(
        testFile.path,
        'appended content',
        { append: true }
      );

      expect(result.success).toBe(true);
      expect(result.modifiedContent).toBe('existing content\nappended content');
    });

    it('should handle skipIf condition', async () => {
      const content = 'existing content\nalready exists';
      const testFile = helper.createTempFile('test.js', content);
      
      mockFs.readFile.mockResolvedValue(content);

      const result = await injector.inject(
        testFile.path,
        'already exists',
        { skipIf: 'already exists' }
      );

      expect(result.success).toBe(true);
      expect(result.skipped).toBe(true);
      expect(mockFs.writeFile).not.toHaveBeenCalled();
    });

    it('should handle force flag', async () => {
      mockFs.pathExists.mockResolvedValue(false);
      mockFs.ensureFile.mockResolvedValue();
      mockFs.readFile.mockResolvedValue('');
      mockFs.writeFile.mockResolvedValue();

      const result = await injector.inject(
        'nonexistent.js',
        'new content',
        { force: true }
      );

      expect(result.success).toBe(true);
      expect(mockFs.ensureFile).toHaveBeenCalledWith('nonexistent.js');
    });

    it('should handle dry run', async () => {
      const testFile = helper.createTempFile('test.js', 'existing');
      
      mockFs.readFile.mockResolvedValue('existing');

      const result = await injector.inject(
        testFile.path,
        'new content',
        { dry: true }
      );

      expect(result.success).toBe(true);
      expect(result.dry).toBe(true);
      expect(mockFs.writeFile).not.toHaveBeenCalled();
    });

    it('should handle file not found error', async () => {
      mockFs.pathExists.mockResolvedValue(false);

      const result = await injector.inject('nonexistent.js', 'content');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should optimize repeated marker searches', async () => {
      const largeContent = Array.from({ length: 1000 }, (_, i) => 
        `line ${i}`
      ).join('\n');

      const marker = 'line 500';
      
      mockFs.readFile.mockResolvedValue(largeContent);
      mockFs.writeFile.mockResolvedValue();

      const startTime = Date.now();
      
      const results = await Promise.all(
        Array.from({ length: 20 }, () =>
          injector.inject('test.txt', 'injected', { before: marker })
        )
      );
      
      const endTime = Date.now();

      expect(results).toHaveLength(20);
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
      expect(endTime - startTime).toBeLessThan(500); // Should complete quickly
    });

    it('should handle factory-generated file system scenarios', async () => {
      const scenarios = FileFactory.createFileSystemScenarios();

      // Test with nested structure
      const nestedScenario = scenarios.nestedStructure;
      const testFile = nestedScenario.files[0];

      mockFs.readFile.mockResolvedValue(testFile.content);
      mockFs.writeFile.mockResolvedValue();

      const result = await injector.inject(
        testFile.path,
        'injected content',
        { append: true }
      );

      expect(result.success).toBe(true);
      expect(result.modifiedContent).toContain('injected content');
    });
  });
});