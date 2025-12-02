/**
 * Tests for Git-First Config Loader
 * 
 * Validates:
 * - Project root only resolution (no cascading)
 * - Environment-aware configuration merging
 * - Path resolution and validation
 * - Configuration caching and invalidation
 * - Error handling and edge cases
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { tmpdir } from 'os';
import { ConfigLoader, loadConfig } from '../../src/config/config-loader.js';

describe('ConfigLoader', () => {
  let testDir;
  let loader;

  beforeEach(() => {
    // Create temporary test directory
    testDir = join(tmpdir(), `kgen-config-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    
    loader = new ConfigLoader({ cwd: testDir });
  });

  afterEach(() => {
    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('Project Root Resolution', () => {
    it('should find config in project root only', async () => {
      const config = {
        directories: {
          out: './custom-dist'
        }
      };
      
      writeFileSync(join(testDir, 'kgen.config.json'), JSON.stringify(config));
      
      const result = await loader.load();
      expect(result.directories.out).toContain('custom-dist');
      expect(result._meta.projectRoot).toBe(testDir);
    });

    it('should not cascade from parent directories', async () => {
      const parentDir = testDir;
      const childDir = join(testDir, 'child');
      mkdirSync(childDir);
      
      // Parent config
      writeFileSync(join(parentDir, 'kgen.config.json'), JSON.stringify({
        directories: { out: './parent-dist' }
      }));
      
      // Child should not inherit parent config
      const childLoader = new ConfigLoader({ cwd: childDir });
      
      await expect(childLoader.load()).rejects.toThrow(
        'No kgen configuration file found'
      );
    });

    it('should prioritize config file types correctly', async () => {
      // Create multiple config files
      writeFileSync(join(testDir, 'kgen.config.json'), JSON.stringify({
        source: 'json'
      }));
      
      writeFileSync(join(testDir, 'kgen.config.js'), `
        export default {
          source: 'js'
        };
      `);
      
      const result = await loader.load();
      // .js should take priority over .json
      expect(result.source).toBe('js');
    });
  });

  describe('Environment Configuration', () => {
    it('should merge environment-specific config', async () => {
      const config = {
        cache: { enabled: true },
        environments: {
          test: {
            cache: { enabled: false },
            dev: { debug: true }
          }
        }
      };
      
      writeFileSync(join(testDir, 'kgen.config.json'), JSON.stringify(config));
      
      const testLoader = new ConfigLoader({ cwd: testDir, env: 'test' });
      const result = await testLoader.load();
      
      expect(result.cache.enabled).toBe(false);
      expect(result.dev.debug).toBe(true);
    });

    it('should use development as default environment', async () => {
      const config = {
        environments: {
          development: {
            dev: { debug: true }
          }
        }
      };
      
      writeFileSync(join(testDir, 'kgen.config.json'), JSON.stringify(config));
      
      const result = await loader.load();
      expect(result.dev.debug).toBe(true);
    });
  });

  describe('Path Resolution', () => {
    it('should resolve relative paths to absolute', async () => {
      const config = {
        directories: {
          out: './dist',
          templates: '../templates'
        }
      };
      
      writeFileSync(join(testDir, 'kgen.config.json'), JSON.stringify(config));
      
      const result = await loader.load();
      
      expect(result.directories.out).toBe(resolve(testDir, 'dist'));
      expect(result.directories.templates).toBe(resolve(testDir, '../templates'));
    });

    it('should leave absolute paths unchanged', async () => {
      const absolutePath = resolve('/tmp/absolute-path');
      const config = {
        directories: {
          out: absolutePath
        }
      };
      
      writeFileSync(join(testDir, 'kgen.config.json'), JSON.stringify(config));
      
      const result = await loader.load();
      expect(result.directories.out).toBe(absolutePath);
    });
  });

  describe('Configuration Validation', () => {
    it('should validate required configuration structure', () => {
      const validConfig = {
        directories: {
          out: './dist'
        }
      };
      
      const validation = loader.validate(validConfig);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect missing required fields', () => {
      const invalidConfig = {};
      
      const validation = loader.validate(invalidConfig);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Missing required "directories" configuration');
    });

    it('should validate drift configuration values', () => {
      const invalidConfig = {
        directories: { out: './dist' },
        drift: { onDrift: 'invalid-value' }
      };
      
      const validation = loader.validate(invalidConfig);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain(
        'drift.onDrift must be one of: warn, error, ignore'
      );
    });

    it('should validate directory path types', () => {
      const invalidConfig = {
        directories: {
          out: 123 // Should be string
        }
      };
      
      const validation = loader.validate(invalidConfig);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('directories.out must be a string path');
    });
  });

  describe('Caching', () => {
    it('should cache loaded configuration', async () => {
      const config = { directories: { out: './dist' } };
      writeFileSync(join(testDir, 'kgen.config.json'), JSON.stringify(config));
      
      const result1 = await loader.load();
      const result2 = await loader.load();
      
      // Should return same object reference (cached)
      expect(result1).toBe(result2);
    });

    it('should respect cache key with environment', async () => {
      const config = {
        directories: { out: './dist' },
        environments: {
          test: { dev: { debug: true } }
        }
      };
      
      writeFileSync(join(testDir, 'kgen.config.json'), JSON.stringify(config));
      
      const devLoader = new ConfigLoader({ cwd: testDir, env: 'development' });
      const testLoader = new ConfigLoader({ cwd: testDir, env: 'test' });
      
      const devResult = await devLoader.load();
      const testResult = await testLoader.load();
      
      expect(devResult).not.toBe(testResult);
      expect(testResult.dev.debug).toBe(true);
      expect(devResult.dev?.debug).toBeUndefined();
    });

    it('should clear cache when requested', async () => {
      const config = { directories: { out: './dist' } };
      writeFileSync(join(testDir, 'kgen.config.json'), JSON.stringify(config));
      
      const result1 = await loader.load();
      loader.clearCache();
      const result2 = await loader.load();
      
      // Should be different object references after cache clear
      expect(result1).not.toBe(result2);
      expect(result1).toEqual(result2); // But same content
    });
  });

  describe('Configuration Metadata', () => {
    it('should include metadata in loaded config', async () => {
      const config = { directories: { out: './dist' } };
      writeFileSync(join(testDir, 'kgen.config.json'), JSON.stringify(config));
      
      const result = await loader.load();
      
      expect(result._meta).toBeDefined();
      expect(result._meta.projectRoot).toBe(testDir);
      expect(result._meta.configPath).toBe(join(testDir, 'kgen.config.json'));
      expect(result._meta.environment).toBe('development');
      expect(result._meta.hash).toBeDefined();
      expect(result._meta.loadedAt).toBeDefined();
    });

    it('should generate consistent hashes for same config', async () => {
      const config = { directories: { out: './dist' } };
      writeFileSync(join(testDir, 'kgen.config.json'), JSON.stringify(config));
      
      const result1 = await loader.load();
      loader.clearCache();
      const result2 = await loader.load();
      
      expect(result1._meta.hash).toBe(result2._meta.hash);
    });

    it('should generate different hashes for different configs', async () => {
      const config1 = { directories: { out: './dist1' } };
      const config2 = { directories: { out: './dist2' } };
      
      const hash1 = loader.getConfigHash(config1);
      const hash2 = loader.getConfigHash(config2);
      
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing config file gracefully', async () => {
      await expect(loader.load()).rejects.toThrow(
        'No kgen configuration file found'
      );
    });

    it('should handle malformed JSON config', async () => {
      writeFileSync(join(testDir, 'kgen.config.json'), '{ invalid json }');
      
      await expect(loader.load()).rejects.toThrow(
        'Failed to load config'
      );
    });

    it('should handle JavaScript config loading errors', async () => {
      writeFileSync(join(testDir, 'kgen.config.js'), 'throw new Error("Config error");');
      
      await expect(loader.load()).rejects.toThrow(
        'Failed to load config'
      );
    });
  });

  describe('Deep Merge Functionality', () => {
    it('should perform deep merge of nested objects', () => {
      const target = {
        a: { x: 1, y: 2 },
        b: 3
      };
      
      const source = {
        a: { y: 20, z: 30 },
        c: 4
      };
      
      const result = loader.deepMerge(target, source);
      
      expect(result).toEqual({
        a: { x: 1, y: 20, z: 30 },
        b: 3,
        c: 4
      });
    });

    it('should handle array values without merging', () => {
      const target = { arr: [1, 2, 3] };
      const source = { arr: [4, 5] };
      
      const result = loader.deepMerge(target, source);
      expect(result.arr).toEqual([4, 5]);
    });

    it('should handle null and undefined values', () => {
      const target = { a: 1, b: null };
      const source = { b: 2, c: undefined };
      
      const result = loader.deepMerge(target, source);
      expect(result).toEqual({ a: 1, b: 2, c: undefined });
    });
  });

  describe('File Statistics', () => {
    it('should provide config file statistics', async () => {
      const config = { directories: { out: './dist' } };
      writeFileSync(join(testDir, 'kgen.config.json'), JSON.stringify(config));
      
      const stats = loader.getConfigStats(testDir);
      
      expect(stats).toBeDefined();
      expect(stats.path).toBe(join(testDir, 'kgen.config.json'));
      expect(stats.size).toBeGreaterThan(0);
      expect(stats.modified).toBeDefined();
      expect(stats.created).toBeDefined();
    });

    it('should return null for missing config file', () => {
      const stats = loader.getConfigStats(testDir);
      expect(stats).toBeNull();
    });
  });
});

describe('loadConfig convenience function', () => {
  let testDir;

  beforeEach(() => {
    testDir = join(tmpdir(), `kgen-config-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should load config with custom options', async () => {
    const config = { directories: { out: './dist' } };
    writeFileSync(join(testDir, 'kgen.config.json'), JSON.stringify(config));
    
    const result = await loadConfig({ cwd: testDir, env: 'test' });
    
    expect(result.directories.out).toContain('dist');
    expect(result._meta.environment).toBe('test');
  });
});
