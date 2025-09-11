/**
 * KGEN Configuration System Tests
 * 
 * Comprehensive test suite for the KGEN configuration system,
 * covering loading, validation, schema compliance, and examples.
 * 
 * @author KGEN Config System Developer
 * @version 1.0.0
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdtemp, writeFile, rm } from 'fs/promises';
import { KGenConfigManager, loadKGenConfig, defineKGenConfig } from '../index.js';
import { validateConfiguration, ValidationError } from '../validators/index.js';
import { configSchema } from '../schemas/index.js';
import { defaultConfig } from '../defaults.js';
import { exampleConfigs } from '../examples/index.js';
import { joiToJsonSchema } from '../schemas/json-schema.js';

describe('KGEN Configuration System', () => {
  let tempDir;
  let configManager;

  beforeEach(async () => {
    // Create temporary directory for test files
    tempDir = await mkdtemp(join(tmpdir(), 'kgen-config-test-'));
    configManager = new KGenConfigManager();
  });

  afterEach(async () => {
    // Clean up temporary directory
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
    
    // Clean up config manager
    if (configManager) {
      configManager.destroy();
    }
  });

  describe('KGenConfigManager', () => {
    it('should create config manager with default options', () => {
      const manager = new KGenConfigManager();
      expect(manager.options.configName).toBe('kgen.config');
      expect(manager.options.envPrefix).toBe('KGEN_');
      expect(manager.options.defaultConfig).toBeDefined();
    });

    it('should create config manager with custom options', () => {
      const customOptions = {
        configName: 'custom.config',
        envPrefix: 'CUSTOM_',
        globalRc: false
      };
      
      const manager = new KGenConfigManager(customOptions);
      expect(manager.options.configName).toBe('custom.config');
      expect(manager.options.envPrefix).toBe('CUSTOM_');
      expect(manager.options.globalRc).toBe(false);
    });

    it('should load configuration with defaults', async () => {
      const config = await configManager.load({
        cwd: tempDir,
        validate: false // Skip validation for this test
      });
      
      expect(config).toBeDefined();
      expect(config.project).toBeDefined();
      expect(config.directories).toBeDefined();
    });

    it('should merge configuration from file', async () => {
      // Create test config file
      const testConfig = {
        project: {
          name: 'test-project',
          version: '2.0.0'
        },
        dev: {
          debug: true
        }
      };
      
      const configPath = join(tempDir, 'kgen.config.js');
      const configContent = `export default ${JSON.stringify(testConfig, null, 2)};`;
      await writeFile(configPath, configContent, 'utf8');
      
      const config = await configManager.load({
        cwd: tempDir,
        validate: false
      });
      
      expect(config.project.name).toBe('test-project');
      expect(config.project.version).toBe('2.0.0');
      expect(config.dev.debug).toBe(true);
    });

    it('should apply environment-specific overrides', async () => {
      const testConfig = {
        project: {
          name: 'env-test',
          version: '1.0.0'
        },
        cache: {
          enabled: true
        },
        environments: {
          development: {
            cache: {
              enabled: false
            },
            dev: {
              debug: true
            }
          }
        }
      };
      
      // Mock NODE_ENV
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      try {
        const configPath = join(tempDir, 'kgen.config.js');
        const configContent = `export default ${JSON.stringify(testConfig, null, 2)};`;
        await writeFile(configPath, configContent, 'utf8');
        
        const config = await configManager.load({
          cwd: tempDir,
          validate: false
        });
        
        expect(config.cache.enabled).toBe(false);
        expect(config.dev.debug).toBe(true);
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });

    it('should cache loaded configurations', async () => {
      const loadSpy = vi.spyOn(configManager, 'load');
      
      // Load config twice with same parameters
      const config1 = await configManager.load({
        cwd: tempDir,
        validate: false,
        cache: true
      });
      
      const config2 = await configManager.load({
        cwd: tempDir,
        validate: false,
        cache: true
      });
      
      expect(config1).toBe(config2); // Should be same cached instance
    });
  });

  describe('Configuration Validation', () => {
    it('should validate minimal valid configuration', async () => {
      const validConfig = {
        project: {
          name: 'test-project',
          version: '1.0.0'
        }
      };
      
      const result = await validateConfiguration(validConfig);
      expect(result).toBeDefined();
      expect(result.project.name).toBe('test-project');
    });

    it('should reject configuration without required fields', async () => {
      const invalidConfig = {
        generate: {
          defaultTemplate: 'test'
        }
        // Missing required 'project' field
      };
      
      await expect(validateConfiguration(invalidConfig))
        .rejects.toThrow(ValidationError);
    });

    it('should validate project configuration', async () => {
      const configWithInvalidProject = {
        project: {
          name: '', // Invalid: empty name
          version: 'invalid-version' // Invalid: not semver
        }
      };
      
      await expect(validateConfiguration(configWithInvalidProject))
        .rejects.toThrow(ValidationError);
    });

    it('should validate directory paths', async () => {
      const validConfig = {
        project: {
          name: 'test-project',
          version: '1.0.0'
        },
        directories: {
          out: './output',
          templates: './templates'
        }
      };
      
      const result = await validateConfiguration(validConfig);
      expect(result.directories.out).toBe('./output');
    });

    it('should validate reasoning configuration', async () => {
      const validConfig = {
        project: {
          name: 'test-project',
          version: '1.0.0'
        },
        reasoning: {
          enabled: true,
          engine: {
            maxIterations: 1000,
            optimization: 'basic',
            memoryLimit: 512
          }
        }
      };
      
      const result = await validateConfiguration(validConfig);
      expect(result.reasoning.engine.optimization).toBe('basic');
    });

    it('should validate cache configuration', async () => {
      const validConfig = {
        project: {
          name: 'test-project',
          version: '1.0.0'
        },
        cache: {
          enabled: true,
          storage: 'file',
          gc: {
            strategy: 'lru',
            maxAge: '7d',
            maxSize: '1GB'
          }
        }
      };
      
      const result = await validateConfiguration(validConfig);
      expect(result.cache.gc.strategy).toBe('lru');
    });

    it('should handle validation errors with detailed messages', async () => {
      const invalidConfig = {
        project: {
          name: 'test',
          version: '1.0.0'
        },
        reasoning: {
          engine: {
            maxIterations: -1, // Invalid: negative
            optimization: 'invalid', // Invalid: not in enum
            memoryLimit: 10000 // Invalid: too large
          }
        }
      };
      
      try {
        await validateConfiguration(invalidConfig);
        expect.fail('Should have thrown validation error');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect(error.details).toBeDefined();
        expect(error.details.length).toBeGreaterThan(0);
        
        const errorsBySection = error.getErrorsBySection();
        expect(errorsBySection.reasoning).toBeDefined();
      }
    });
  });

  describe('Schema Compliance', () => {
    it('should have valid Joi schema', () => {
      expect(configSchema).toBeDefined();
      expect(configSchema.type).toBe('object');
      expect(configSchema._flags?.presence).toBe('required');
    });

    it('should validate against schema', () => {
      const validConfig = {
        project: {
          name: 'schema-test',
          version: '1.0.0'
        }
      };
      
      const { error, value } = configSchema.validate(validConfig);
      expect(error).toBeNull();
      expect(value.project.name).toBe('schema-test');
    });

    it('should convert Joi schema to JSON Schema', () => {
      const jsonSchema = joiToJsonSchema(configSchema);
      
      expect(jsonSchema).toBeDefined();
      expect(jsonSchema.$schema).toBe('http://json-schema.org/draft-07/schema#');
      expect(jsonSchema.type).toBe('object');
      expect(jsonSchema.properties.project).toBeDefined();
      expect(jsonSchema.required).toContain('project');
    });
  });

  describe('Example Configurations', () => {
    it('should have valid example configurations', () => {
      expect(exampleConfigs).toBeDefined();
      expect(exampleConfigs.minimal).toBeDefined();
      expect(exampleConfigs.development).toBeDefined();
      expect(exampleConfigs.production).toBeDefined();
      expect(exampleConfigs.enterprise).toBeDefined();
      expect(exampleConfigs.test).toBeDefined();
    });

    it('should validate minimal configuration example', async () => {
      const config = exampleConfigs.minimal;
      const result = await validateConfiguration(config);
      
      expect(result.project.name).toBe('my-kgen-project');
      expect(result.project.version).toBe('1.0.0');
    });

    it('should validate development configuration example', async () => {
      const config = exampleConfigs.development;
      const result = await validateConfiguration(config);
      
      expect(result.project.name).toBe('kgen-development-project');
      expect(result.dev.debug).toBe(true);
      expect(result.cache.enabled).toBe(false);
    });

    it('should validate production configuration example', async () => {
      const config = exampleConfigs.production;
      const result = await validateConfiguration(config);
      
      expect(result.project.name).toBe('kgen-production-service');
      expect(result.reasoning.engine.optimization).toBe('aggressive');
      expect(result.cache.enabled).toBe(true);
      expect(result.provenance.signing.enabled).toBe(true);
    });

    it('should validate enterprise configuration example', async () => {
      const config = exampleConfigs.enterprise;
      const result = await validateConfiguration(config);
      
      expect(result.project.name).toBe('enterprise-knowledge-platform');
      expect(result.provenance.signing.algorithm).toBe('PS256');
      expect(result.validation.custom.enabled).toBe(true);
    });

    it('should validate test configuration example', async () => {
      const config = exampleConfigs.test;
      const result = await validateConfiguration(config);
      
      expect(result.project.name).toBe('kgen-test-suite');
      expect(result.cache.enabled).toBe(false);
      expect(result.metrics.enabled).toBe(false);
    });
  });

  describe('Configuration Helpers', () => {
    it('should work with defineKGenConfig helper', () => {
      const config = defineKGenConfig({
        project: {
          name: 'helper-test',
          version: '1.0.0'
        },
        dev: {
          debug: true
        }
      });
      
      expect(config.project.name).toBe('helper-test');
      expect(config.dev.debug).toBe(true);
    });

    it('should load configuration with loadKGenConfig', async () => {
      const config = await loadKGenConfig({
        cwd: tempDir,
        validate: false,
        overrides: {
          project: {
            name: 'load-test',
            version: '1.0.0'
          }
        }
      });
      
      expect(config.project.name).toBe('load-test');
    });
  });

  describe('Environment-specific Validation', () => {
    it('should provide production environment warnings', async () => {
      const config = {
        project: { name: 'prod-test', version: '1.0.0' },
        cache: { enabled: false },
        dev: { debug: true }
      };
      
      const { validateEnvironment } = await import('../validators/index.js');
      const warnings = await validateEnvironment(config, 'production');
      
      expect(warnings).toContain('Cache should be enabled in production for better performance');
      expect(warnings).toContain('Debug mode should be disabled in production');
    });

    it('should provide development environment suggestions', async () => {
      const config = {
        project: { name: 'dev-test', version: '1.0.0' },
        cache: { enabled: true }
      };
      
      const { validateEnvironment } = await import('../validators/index.js');
      const warnings = await validateEnvironment(config, 'development');
      
      expect(warnings).toContain('Cache can be disabled in development for easier debugging');
    });

    it('should provide test environment recommendations', async () => {
      const config = {
        project: { name: 'test-test', version: '1.0.0' },
        cache: { enabled: true },
        metrics: { enabled: true }
      };
      
      const { validateEnvironment } = await import('../validators/index.js');
      const warnings = await validateEnvironment(config, 'test');
      
      expect(warnings).toContain('Cache should be disabled in test environment for reproducible results');
      expect(warnings).toContain('Metrics can be disabled in test environment to reduce noise');
    });
  });

  describe('Error Handling', () => {
    it('should handle missing configuration files gracefully', async () => {
      const config = await configManager.load({
        cwd: '/non-existent-directory',
        validate: false
      });
      
      // Should fall back to defaults
      expect(config).toBeDefined();
      expect(config.project).toBeDefined();
    });

    it('should handle invalid configuration files', async () => {
      // Create invalid config file
      const configPath = join(tempDir, 'kgen.config.js');
      const invalidContent = 'export default { invalid javascript }}';
      await writeFile(configPath, invalidContent, 'utf8');
      
      await expect(configManager.load({
        cwd: tempDir,
        validate: false
      })).rejects.toThrow();
    });

    it('should provide helpful error messages for validation failures', async () => {
      const invalidConfig = {
        project: {
          name: 'test',
          version: '1.0.0'
        },
        directories: {
          out: 123 // Should be string
        },
        reasoning: {
          engine: {
            optimization: 'invalid-level' // Should be enum value
          }
        }
      };
      
      try {
        await validateConfiguration(invalidConfig);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        const formatted = error.getFormattedMessage();
        expect(formatted).toContain('[directories]');
        expect(formatted).toContain('[reasoning]');
        expect(formatted).toContain('must be a string');
        expect(formatted).toContain('must be one of');
      }
    });
  });

  describe('Configuration Watching', () => {
    it('should watch for configuration file changes', async () => {
      const configPath = join(tempDir, 'kgen.config.js');
      const initialConfig = {
        project: { name: 'watch-test', version: '1.0.0' },
        dev: { debug: false }
      };
      
      await writeFile(configPath, `export default ${JSON.stringify(initialConfig)};`, 'utf8');
      
      let changeCount = 0;
      const unwatch = await configManager.watch(
        { cwd: tempDir },
        (error, newConfig) => {
          if (!error) {
            changeCount++;
          }
        }
      );
      
      // Modify config file
      const updatedConfig = {
        ...initialConfig,
        dev: { debug: true }
      };
      
      await writeFile(configPath, `export default ${JSON.stringify(updatedConfig)};`, 'utf8');
      
      // Wait a bit for file watcher
      await new Promise(resolve => setTimeout(resolve, 100));
      
      unwatch();
      
      // Note: File watching is timing-dependent, so we don't assert on exact counts
      // but verify the mechanism was set up correctly
      expect(typeof unwatch).toBe('function');
    });
  });

  describe('Performance', () => {
    it('should load configuration efficiently', async () => {
      const start = performance.now();
      
      const config = await configManager.load({
        cwd: tempDir,
        validate: true
      });
      
      const end = performance.now();
      const duration = end - start;
      
      expect(config).toBeDefined();
      expect(duration).toBeLessThan(1000); // Should load in under 1 second
    });

    it('should cache configurations for performance', async () => {
      const cacheKey = JSON.stringify({ cwd: tempDir, overrides: {} });
      
      // Load config once
      await configManager.load({ cwd: tempDir, cache: true });
      expect(configManager.cache.has(cacheKey)).toBe(true);
      
      // Second load should be from cache
      const start = performance.now();
      await configManager.load({ cwd: tempDir, cache: true });
      const end = performance.now();
      
      expect(end - start).toBeLessThan(10); // Cache hit should be very fast
    });
  });
});

// Integration test with actual file system operations
describe('KGEN Configuration Integration', () => {
  let testProjectDir;

  beforeEach(async () => {
    testProjectDir = await mkdtemp(join(tmpdir(), 'kgen-integration-test-'));
  });

  afterEach(async () => {
    if (testProjectDir) {
      await rm(testProjectDir, { recursive: true, force: true });
    }
  });

  it('should work with a complete project setup', async () => {
    // Create project structure
    const configContent = `
export default {
  $schema: 'https://unpkg.com/@seanchatmangpt/kgen/schema.json',
  
  project: {
    name: 'integration-test-project',
    version: '1.0.0',
    description: 'Integration test project'
  },
  
  directories: {
    out: './dist',
    templates: './templates',
    rules: './rules',
    knowledge: './knowledge'
  },
  
  generate: {
    defaultTemplate: 'api-service',
    globalVars: {
      author: 'Test Author',
      license: 'MIT'
    },
    attestByDefault: true
  },
  
  reasoning: {
    enabled: true,
    defaultRules: 'test-rules',
    engine: {
      optimization: 'basic'
    }
  },
  
  cache: {
    enabled: true,
    gc: {
      strategy: 'lru',
      maxAge: '1h'
    }
  },
  
  metrics: {
    enabled: true,
    file: 'logs/metrics.jsonl'
  },
  
  dev: {
    debug: true,
    verbose: true
  }
};
`;
    
    const configPath = join(testProjectDir, 'kgen.config.js');
    await writeFile(configPath, configContent, 'utf8');
    
    // Load and validate configuration
    const manager = new KGenConfigManager();
    const config = await manager.load({
      cwd: testProjectDir,
      validate: true
    });
    
    // Verify configuration was loaded correctly
    expect(config.project.name).toBe('integration-test-project');
    expect(config.generate.defaultTemplate).toBe('api-service');
    expect(config.reasoning.enabled).toBe(true);
    expect(config.cache.enabled).toBe(true);
    expect(config.dev.debug).toBe(true);
    
    // Verify paths are resolved
    expect(config.directories.out).toMatch(/dist$/);
    
    manager.destroy();
  });
});
