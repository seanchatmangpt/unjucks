/**
 * Configuration System Tests
 * 
 * Comprehensive tests for the Unjucks configuration system including:
 * - Zod schema validation
 * - c12/confbox loading
 * - Environment-specific overrides
 * - Error handling and validation
 * - Memory storage functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import {
  ConfigManager,
  loadUnjucksConfig,
  getConfig,
  validateConfig,
  storeConfigSchema,
  ConfigSchema,
  SecurityConfigSchema,
  PerformanceConfigSchema,
  SemanticConfigSchema
} from '../../src/core/config.js';

describe('Configuration System', () => {
  let testDir;
  let configManager;
  let mockMemoryStore;

  beforeEach(() => {
    // Create temporary test directory
    testDir = join(tmpdir(), `unjucks-config-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    
    // Create fresh config manager instance
    configManager = new ConfigManager();
    
    // Mock memory store
    mockMemoryStore = new Map();
    mockMemoryStore.set = vi.fn((key, value) => Map.prototype.set.call(mockMemoryStore, key, value));
    mockMemoryStore.get = vi.fn((key) => Map.prototype.get.call(mockMemoryStore, key));

    // Clear environment variables
    delete process.env.NODE_ENV;
    delete process.env.UNJUCKS_ENV;
    delete process.env.LOG_LEVEL;
    delete process.env.DEBUG;
  });

  afterEach(() => {
    // Cleanup test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('Zod Schema Validation', () => {
    it('should validate minimal configuration', () => {
      const minimalConfig = {};
      const result = ConfigSchema.safeParse(minimalConfig);
      
      expect(result.success).toBe(true);
      expect(result.data.templateDirs).toEqual(['_templates', 'templates']);
      expect(result.data.environment).toBe('development');
    });

    it('should validate complete configuration', () => {
      const completeConfig = {
        projectRoot: '/test/project',
        templateDirs: [
          '_templates',
          { path: 'custom', priority: 80, enabled: true }
        ],
        outputDir: './output',
        environment: 'production',
        security: {
          enableAuth: true,
          secretKey: 'test-secret',
          rateLimiting: true,
          maxRequestsPerMinute: 50
        },
        performance: {
          cacheEnabled: true,
          maxConcurrency: 5
        },
        semantic: {
          enableRDF: true,
          sparqlEndpoint: 'http://example.org/sparql'
        }
      };
      
      const result = ConfigSchema.safeParse(completeConfig);
      expect(result.success).toBe(true);
      expect(result.data.environment).toBe('production');
      expect(result.data.security.enableAuth).toBe(true);
    });

    it('should reject invalid configuration', () => {
      const invalidConfig = {
        environment: 'invalid-env',
        performance: {
          maxConcurrency: -1 // Should be positive
        },
        semantic: {
          sparqlEndpoint: 'not-a-url'
        }
      };
      
      const result = ConfigSchema.safeParse(invalidConfig);
      expect(result.success).toBe(false);
      expect(result.error.errors.length).toBeGreaterThan(0);
    });

    it('should validate security configuration', () => {
      const securityConfig = {
        enableAuth: true,
        rateLimiting: true,
        maxRequestsPerMinute: 100,
        allowedOrigins: ['http://localhost:3000', 'https://example.com']
      };
      
      const result = SecurityConfigSchema.safeParse(securityConfig);
      expect(result.success).toBe(true);
      expect(result.data.enableAuth).toBe(true);
      expect(result.data.allowedOrigins).toHaveLength(2);
    });

    it('should validate semantic configuration', () => {
      const semanticConfig = {
        enableRDF: true,
        sparqlEndpoint: 'https://dbpedia.org/sparql',
        defaultNamespaces: {
          ex: 'http://example.org/',
          custom: 'http://custom.org/'
        }
      };
      
      const result = SemanticConfigSchema.safeParse(semanticConfig);
      expect(result.success).toBe(true);
      expect(result.data.enableRDF).toBe(true);
      expect(result.data.defaultNamespaces.ex).toBe('http://example.org/');
    });
  });

  describe('Configuration Loading', () => {
    it('should load default configuration when no config file exists', async () => {
      const config = await configManager.loadConfig({
        cwd: testDir,
        configName: 'unjucks.config'
      });
      
      expect(config).toBeDefined();
      expect(config.templateDirs).toBeDefined();
      expect(config.environment).toBe('development');
      expect(config.security).toBeDefined();
      expect(config.performance).toBeDefined();
    });

    it('should load configuration from JS file', async () => {
      const configContent = `
        export default {
          templateDirs: ['custom-templates'],
          outputDir: './custom-output',
          environment: 'production',
          security: {
            enableAuth: true,
            rateLimiting: true
          }
        };
      `;
      
      writeFileSync(join(testDir, 'unjucks.config.js'), configContent);
      
      const config = await configManager.loadConfig({
        cwd: testDir,
        configName: 'unjucks.config'
      });
      
      expect(config.templateDirs[0].path).toContain('custom-templates');
      expect(config.environment).toBe('production');
      expect(config.security.enableAuth).toBe(true);
    });

    it('should load configuration from TypeScript file', async () => {
      const configContent = `
        import { defineConfig } from '../src/core/config.js';
        
        export default defineConfig({
          templateDirs: [
            { path: 'ts-templates', priority: 90 }
          ],
          semantic: {
            enableRDF: true,
            defaultNamespaces: {
              custom: 'http://custom.org/'
            }
          }
        });
      `;
      
      writeFileSync(join(testDir, 'unjucks.config.ts'), configContent);
      
      const config = await configManager.loadConfig({
        cwd: testDir,
        configName: 'unjucks.config'
      });
      
      expect(config.templateDirs[0].priority).toBe(90);
      expect(config.semantic.enableRDF).toBe(true);
    });

    it('should load configuration from package.json', async () => {
      const packageJson = {
        name: 'test-project',
        unjucks: {
          templateDirs: ['pkg-templates'],
          cli: {
            name: 'custom-cli',
            version: '2.0.0'
          }
        }
      };
      
      writeFileSync(join(testDir, 'package.json'), JSON.stringify(packageJson, null, 2));
      
      const config = await configManager.loadConfig({
        cwd: testDir,
        configName: 'unjucks.config'
      });
      
      expect(config.templateDirs[0].path).toContain('pkg-templates');
      expect(config.cli.name).toBe('custom-cli');
      expect(config.cli.version).toBe('2.0.0');
    });

    it('should handle configuration validation errors', async () => {
      const invalidConfigContent = `
        export default {
          environment: 'invalid-environment',
          performance: {
            maxConcurrency: 'not-a-number'
          }
        };
      `;
      
      writeFileSync(join(testDir, 'unjucks.config.js'), invalidConfigContent);
      
      await expect(configManager.loadConfig({
        cwd: testDir,
        configName: 'unjucks.config'
      })).rejects.toThrow('Configuration validation failed');
    });
  });

  describe('Environment-Specific Configuration', () => {
    it('should apply development environment defaults', async () => {
      process.env.NODE_ENV = 'development';
      
      const config = await configManager.loadConfig({ cwd: testDir });
      
      expect(config.environment).toBe('development');
      expect(config.development.hotReload).toBe(true);
      expect(config.development.debugMode).toBe(true);
      expect(config.logging.level).toBe('info');
    });

    it('should apply production environment defaults', async () => {
      process.env.NODE_ENV = 'production';
      
      const config = await configManager.loadConfig({ cwd: testDir });
      
      expect(config.environment).toBe('production');
      expect(config.logging.level).toBe('warn');
      expect(config.performance.enableMetrics).toBe(true);
      expect(config.security.rateLimiting).toBe(true);
      expect(config.development.hotReload).toBe(false);
    });

    it('should apply test environment defaults', async () => {
      process.env.NODE_ENV = 'test';
      
      const config = await configManager.loadConfig({ cwd: testDir });
      
      expect(config.environment).toBe('test');
      expect(config.logging.level).toBe('error');
      expect(config.performance.cacheEnabled).toBe(false);
      expect(config.development.mockData).toBe(true);
    });

    it('should respect UNJUCKS_ENV override', async () => {
      process.env.NODE_ENV = 'development';
      process.env.UNJUCKS_ENV = 'production';
      
      const config = await configManager.loadConfig({ cwd: testDir });
      
      expect(config.environment).toBe('production');
    });
  });

  describe('Template Directory Processing', () => {
    it('should process template directories with priorities', async () => {
      // Create template directories
      mkdirSync(join(testDir, '_templates'), { recursive: true });
      mkdirSync(join(testDir, 'custom-templates'), { recursive: true });
      
      const configContent = `
        export default {
          templateDirs: [
            '_templates',
            { path: 'custom-templates', priority: 90, enabled: true },
            { path: 'missing-templates', priority: 50, enabled: true }
          ]
        };
      `;
      
      writeFileSync(join(testDir, 'unjucks.config.js'), configContent);
      
      const config = await configManager.loadConfig({
        cwd: testDir,
        configName: 'unjucks.config'
      });
      
      // Should have 2 directories (missing one filtered out)
      expect(config.templateDirs).toHaveLength(2);
      
      // Should be sorted by priority (higher first)
      expect(config.templateDirs[0].priority).toBe(90);
      expect(config.templateDirs[1].priority).toBe(50);
      
      // Paths should be absolute
      expect(config.templateDirs[0].path).toContain(testDir);
    });

    it('should handle missing template directories gracefully', async () => {
      const configContent = `
        export default {
          templateDirs: ['nonexistent-dir']
        };
      `;
      
      writeFileSync(join(testDir, 'unjucks.config.js'), configContent);
      
      const config = await configManager.loadConfig({
        cwd: testDir,
        configName: 'unjucks.config'
      });
      
      expect(config.templateDirs).toHaveLength(0);
    });
  });

  describe('Memory Storage', () => {
    it('should store configuration schema in memory', async () => {
      const config = await configManager.loadConfig({ cwd: testDir });
      
      configManager.storeSchemaInMemory(mockMemoryStore);
      
      expect(mockMemoryStore.set).toHaveBeenCalledWith('hive/config/system', expect.objectContaining({
        schema: ConfigSchema,
        version: '1.0.0',
        components: expect.any(Object),
        exampleConfig: expect.any(Object)
      }));
    });

    it('should handle invalid memory store gracefully', async () => {
      const config = await configManager.loadConfig({ cwd: testDir });
      
      // Should not throw error with invalid store
      expect(() => configManager.storeSchemaInMemory(null)).not.toThrow();
      expect(() => configManager.storeSchemaInMemory({})).not.toThrow();
    });
  });

  describe('Convenience Functions', () => {
    it('should provide loadUnjucksConfig function', async () => {
      const config = await loadUnjucksConfig({ cwd: testDir });
      
      expect(config).toBeDefined();
      expect(config.templateDirs).toBeDefined();
    });

    it('should provide getConfig function', async () => {
      await loadUnjucksConfig({ cwd: testDir });
      const config = getConfig();
      
      expect(config).toBeDefined();
      expect(config.templateDirs).toBeDefined();
    });

    it('should provide validateConfig function', () => {
      const validConfig = { environment: 'development' };
      const invalidConfig = { environment: 'invalid' };
      
      const validResult = validateConfig(validConfig);
      expect(validResult.success).toBe(true);
      
      const invalidResult = validateConfig(invalidConfig);
      expect(invalidResult.success).toBe(false);
    });

    it('should provide storeConfigSchema function', async () => {
      await loadUnjucksConfig({ cwd: testDir });
      
      storeConfigSchema(mockMemoryStore);
      
      expect(mockMemoryStore.set).toHaveBeenCalledWith('hive/config/system', expect.any(Object));
    });
  });

  describe('Error Handling', () => {
    it('should handle file system errors gracefully', async () => {
      // Try to load from a directory that requires special permissions
      await expect(configManager.loadConfig({
        cwd: '/invalid/path/that/does/not/exist'
      })).rejects.toThrow();
    });

    it('should provide detailed validation errors', async () => {
      const invalidConfigContent = `
        export default {
          performance: {
            maxConcurrency: -5,
            cacheTTL: 'invalid'
          },
          semantic: {
            sparqlEndpoint: 'not-a-url',
            maxTriples: -100
          }
        };
      `;
      
      writeFileSync(join(testDir, 'unjucks.config.js'), invalidConfigContent);
      
      try {
        await configManager.loadConfig({
          cwd: testDir,
          configName: 'unjucks.config'
        });
      } catch (error) {
        expect(error.message).toContain('Configuration validation failed');
        expect(error.message).toContain('maxConcurrency');
        expect(error.message).toContain('sparqlEndpoint');
      }
    });

    it('should track validation errors', async () => {
      const invalidConfig = { environment: 'invalid' };
      const result = configManager.validatePartialConfig(invalidConfig);
      
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Performance Configuration', () => {
    it('should validate performance settings', () => {
      const performanceConfig = {
        cacheEnabled: true,
        cacheTTL: 600,
        parallelProcessing: true,
        maxConcurrency: 16,
        memoryLimit: '1GB',
        enableMetrics: true
      };
      
      const result = PerformanceConfigSchema.safeParse(performanceConfig);
      expect(result.success).toBe(true);
      expect(result.data.maxConcurrency).toBe(16);
      expect(result.data.memoryLimit).toBe('1GB');
    });

    it('should reject invalid performance settings', () => {
      const invalidConfig = {
        maxConcurrency: 0, // Should be positive
        cacheTTL: -100 // Should be positive
      };
      
      const result = PerformanceConfigSchema.safeParse(invalidConfig);
      expect(result.success).toBe(false);
    });
  });
});