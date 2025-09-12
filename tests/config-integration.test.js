/**
 * Configuration Integration Tests
 * 
 * Tests configuration loading with real CLI integration,
 * environment setup, and directory creation behavior.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { mkdirSync, writeFileSync, rmSync, existsSync, statSync } from 'fs';
import { spawn } from 'child_process';
import { loadConfig } from 'c12';

const originalEnv = { ...process.env };

describe('Configuration Integration Tests', () => {
  let testDir;
  let configPath;

  beforeEach(() => {
    testDir = join(tmpdir(), `kgen-integration-test-${this.getDeterministicTimestamp()}-${Math.random().toString(36).substr(2, 9)}`);
    mkdirSync(testDir, { recursive: true });
    configPath = join(testDir, 'kgen.config.js');
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    process.env = { ...originalEnv };
  });

  describe('Real Configuration Loading Integration', () => {
    it('should load configuration and create directory structure', async () => {
      const configContent = `
        export default {
          directories: {
            out: './integration-dist',
            state: './.kgen/integration-state',
            cache: './.kgen/integration-cache',
            templates: './integration-templates',
            rules: './integration-rules',
            logs: './.kgen/integration-logs'
          },
          generate: {
            defaultTemplate: 'integration-template',
            globalVars: {
              testVar: 'integration-value',
              timestamp: () => this.getDeterministicDate().toISOString()
            }
          }
        };
      `;
      
      writeFileSync(configPath, configContent);
      
      // Load config and verify structure
      const { config, configFile } = await loadConfig({
        name: 'kgen',
        cwd: testDir,
        configFile: 'kgen.config'
      });

      expect(configFile).toBe(configPath);
      expect(config.directories.out).toBe('./integration-dist');
      expect(config.generate.defaultTemplate).toBe('integration-template');
      expect(config.generate.globalVars.testVar).toBe('integration-value');
      expect(typeof config.generate.globalVars.timestamp).toBe('function');
      
      // Test directory paths are correctly resolved relative to config
      const resolvedPaths = {
        out: resolve(testDir, config.directories.out),
        state: resolve(testDir, config.directories.state),
        cache: resolve(testDir, config.directories.cache),
        templates: resolve(testDir, config.directories.templates),
        rules: resolve(testDir, config.directories.rules),
        logs: resolve(testDir, config.directories.logs)
      };
      
      // Create directories as KGEN would
      Object.values(resolvedPaths).forEach(dir => {
        mkdirSync(dir, { recursive: true });
      });

      // Verify all directories exist
      Object.entries(resolvedPaths).forEach(([name, path]) => {
        expect(existsSync(path), `Directory ${name} should exist at ${path}`).toBe(true);
        expect(statSync(path).isDirectory(), `${name} should be a directory`).toBe(true);
      });
    });

    it('should handle configuration validation errors gracefully', async () => {
      const invalidConfigContent = `
        export default {
          directories: {
            out: null, // Invalid value
            state: 123  // Invalid type
          },
          generate: {
            maxConcurrency: -1, // Invalid negative value
            parallel: "maybe"   // Invalid type
          }
        };
      `;
      
      writeFileSync(configPath, invalidConfigContent);
      
      const { config } = await loadConfig({
        name: 'kgen',
        cwd: testDir,
        configFile: 'kgen.config',
        defaults: {
          directories: {
            out: './dist',
            state: './.kgen/state'
          },
          generate: {
            maxConcurrency: 4,
            parallel: true
          }
        }
      });

      // c12 loads the config as-is, validation would be done by the application
      expect(config.directories.out).toBe(null);
      expect(config.directories.state).toBe(123);
      expect(config.generate.maxConcurrency).toBe(-1);
      expect(config.generate.parallel).toBe("maybe");
    });
  });

  describe('Environment-Specific Integration', () => {
    it('should handle complex environment inheritance in production', async () => {
      process.env.NODE_ENV = 'production';
      process.env.KGEN_MAX_MEMORY = '2GB';
      process.env.KGEN_SIGNING_KEY = '/prod/keys/signing.key';
      
      const configContent = `
        export default {
          security: {
            sandbox: false,
            maxMemory: '512MB'
          },
          provenance: {
            signing: {
              enabled: false,
              keyPath: null
            }
          },
          cache: {
            maxSize: '100MB',
            ttl: 3600000
          },
          production: {
            security: {
              sandbox: true,
              maxMemory: process.env.KGEN_MAX_MEMORY || '1GB'
            },
            provenance: {
              signing: {
                enabled: true,
                keyPath: process.env.KGEN_SIGNING_KEY
              }
            },
            cache: {
              maxSize: '1GB',
              ttl: 7200000
            }
          }
        };
      `;
      
      writeFileSync(configPath, configContent);
      
      const { config } = await loadConfig({
        name: 'kgen',
        cwd: testDir,
        configFile: 'kgen.config'
      });

      // Verify production overrides with environment variables
      expect(config.security.sandbox).toBe(true); // Overridden by production
      expect(config.security.maxMemory).toBe('2GB'); // Environment variable used
      expect(config.provenance.signing.enabled).toBe(true); // Overridden by production
      expect(config.provenance.signing.keyPath).toBe('/prod/keys/signing.key'); // Environment variable
      expect(config.cache.maxSize).toBe('1GB'); // Overridden by production
      expect(config.cache.ttl).toBe(7200000); // Overridden by production
    });

    it('should handle missing environment variables gracefully', async () => {
      process.env.NODE_ENV = 'development';
      // Explicitly unset environment variables
      delete process.env.KGEN_DEBUG;
      delete process.env.KGEN_CACHE_DIR;
      
      const configContent = `
        export default {
          dev: {
            debugMode: process.env.KGEN_DEBUG === 'true' || false,
            verbose: false
          },
          directories: {
            cache: process.env.KGEN_CACHE_DIR || './.kgen/cache'
          },
          development: {
            dev: {
              verbose: true
            }
          }
        };
      `;
      
      writeFileSync(configPath, configContent);
      
      const { config } = await loadConfig({
        name: 'kgen',
        cwd: testDir,
        configFile: 'kgen.config'
      });

      expect(config.dev.debugMode).toBe(false); // Default when env var not set
      expect(config.dev.verbose).toBe(true); // Overridden by development config
      expect(config.directories.cache).toBe('./.kgen/cache'); // Default when env var not set
    });
  });

  describe('Configuration File Priority and Loading', () => {
    it('should respect configuration file priority order', async () => {
      // Create multiple config files
      const jsConfigPath = join(testDir, 'kgen.config.js');
      const mjsConfigPath = join(testDir, 'kgen.config.mjs');
      const jsonConfigPath = join(testDir, 'kgen.config.json');
      
      writeFileSync(jsConfigPath, `
        export default {
          source: 'js-config',
          generate: { defaultTemplate: 'js-template' }
        };
      `);
      
      writeFileSync(mjsConfigPath, `
        export default {
          source: 'mjs-config',
          generate: { defaultTemplate: 'mjs-template' }
        };
      `);
      
      writeFileSync(jsonConfigPath, JSON.stringify({
        source: 'json-config',
        generate: { defaultTemplate: 'json-template' }
      }));
      
      const { config, configFile } = await loadConfig({
        name: 'kgen',
        cwd: testDir,
        configFile: 'kgen.config'
      });

      // Should prioritize .js over .mjs over .json
      expect(config.source).toBe('js-config');
      expect(configFile).toBe(jsConfigPath);
    });

    it('should fall back to next available config format', async () => {
      // Only create JSON config
      const jsonConfigPath = join(testDir, 'kgen.config.json');
      writeFileSync(jsonConfigPath, JSON.stringify({
        source: 'json-fallback',
        directories: { out: './json-dist' }
      }));
      
      const { config, configFile } = await loadConfig({
        name: 'kgen',
        cwd: testDir,
        configFile: 'kgen.config'
      });

      expect(config.source).toBe('json-fallback');
      expect(config.directories.out).toBe('./json-dist');
      expect(configFile).toBe(jsonConfigPath);
    });
  });

  describe('Configuration Schema and Type Safety', () => {
    it('should preserve function types in configuration', async () => {
      const configContent = `
        export default {
          generate: {
            globalVars: {
              timestamp: () => this.getDeterministicDate().toISOString(),
              random: () => Math.random(),
              complex: function(input) { return input.toUpperCase(); }
            }
          }
        };
      `;
      
      writeFileSync(configPath, configContent);
      
      const { config } = await loadConfig({
        name: 'kgen',
        cwd: testDir,
        configFile: 'kgen.config'
      });

      expect(typeof config.generate.globalVars.timestamp).toBe('function');
      expect(typeof config.generate.globalVars.random).toBe('function');
      expect(typeof config.generate.globalVars.complex).toBe('function');
      
      // Test function execution
      const timestampResult = config.generate.globalVars.timestamp();
      expect(typeof timestampResult).toBe('string');
      expect(timestampResult).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);
      
      const randomResult = config.generate.globalVars.random();
      expect(typeof randomResult).toBe('number');
      expect(randomResult).toBeGreaterThanOrEqual(0);
      expect(randomResult).toBeLessThan(1);
      
      const complexResult = config.generate.globalVars.complex('hello');
      expect(complexResult).toBe('HELLO');
    });

    it('should handle nested object configurations correctly', async () => {
      const configContent = `
        export default {
          provenance: {
            include: {
              timestamp: true,
              engineVersion: true,
              graphHash: false,
              templatePath: true,
              rulesUsed: false,
              environment: {
                nodeVersion: true,
                platform: true,
                arch: false
              }
            },
            signing: {
              enabled: true,
              algorithm: 'RS256',
              options: {
                keySize: 2048,
                padding: 'PKCS1',
                hash: 'SHA256'
              }
            }
          }
        };
      `;
      
      writeFileSync(configPath, configContent);
      
      const { config } = await loadConfig({
        name: 'kgen',
        cwd: testDir,
        configFile: 'kgen.config'
      });

      // Verify nested structure preservation
      expect(config.provenance.include.timestamp).toBe(true);
      expect(config.provenance.include.engineVersion).toBe(true);
      expect(config.provenance.include.graphHash).toBe(false);
      expect(config.provenance.include.templatePath).toBe(true);
      expect(config.provenance.include.rulesUsed).toBe(false);
      
      expect(config.provenance.include.environment.nodeVersion).toBe(true);
      expect(config.provenance.include.environment.platform).toBe(true);
      expect(config.provenance.include.environment.arch).toBe(false);
      
      expect(config.provenance.signing.enabled).toBe(true);
      expect(config.provenance.signing.algorithm).toBe('RS256');
      expect(config.provenance.signing.options.keySize).toBe(2048);
      expect(config.provenance.signing.options.padding).toBe('PKCS1');
      expect(config.provenance.signing.options.hash).toBe('SHA256');
    });
  });

  describe('Configuration Performance and Caching', () => {
    it('should measure configuration loading performance', async () => {
      const largeConfigContent = `
        export default {
          ${Array.from({ length: 100 }, (_, i) => `
            section${i}: {
              enabled: true,
              options: {
                ${Array.from({ length: 10 }, (_, j) => `option${j}: 'value${j}'`).join(',\n                ')}
              }
            }
          `).join(',\n          ')}
        };
      `;
      
      writeFileSync(configPath, largeConfigContent);
      
      const startTime = this.getDeterministicTimestamp();
      const { config } = await loadConfig({
        name: 'kgen',
        cwd: testDir,
        configFile: 'kgen.config'
      });
      const loadTime = this.getDeterministicTimestamp() - startTime;
      
      // Verify large config loaded correctly
      expect(config.section0.enabled).toBe(true);
      expect(config.section0.options.option0).toBe('value0');
      expect(config.section99.enabled).toBe(true);
      expect(config.section99.options.option9).toBe('value9');
      
      // Performance should be reasonable (under 100ms for large config)
      expect(loadTime).toBeLessThan(100);
      
      // Second load should be faster due to Node.js module caching
      const secondStartTime = this.getDeterministicTimestamp();
      const { config: config2 } = await loadConfig({
        name: 'kgen',
        cwd: testDir,
        configFile: 'kgen.config'
      });
      const secondLoadTime = this.getDeterministicTimestamp() - secondStartTime;
      
      expect(secondLoadTime).toBeLessThanOrEqual(loadTime);
      expect(config2.section0.enabled).toBe(true);
    });
  });

  describe('Configuration Error Handling', () => {
    it('should handle JavaScript syntax errors in config files', async () => {
      const invalidConfigContent = `
        export default {
          directories: {
            out: './dist',
            // Missing closing brace
          generate: {
            defaultTemplate: 'test'
          }
        // Missing closing brace for main object
      `;
      
      writeFileSync(configPath, invalidConfigContent);
      
      // This should throw a syntax error
      await expect(loadConfig({
        name: 'kgen',
        cwd: testDir,
        configFile: 'kgen.config'
      })).rejects.toThrow();
    });

    it('should handle missing import/require statements gracefully', async () => {
      const configWithMissingImport = `
        import { nonExistentFunction } from './non-existent-module';
        
        export default {
          directories: {
            out: nonExistentFunction() || './dist'
          }
        };
      `;
      
      writeFileSync(configPath, configWithMissingImport);
      
      // Should throw module not found error
      await expect(loadConfig({
        name: 'kgen',
        cwd: testDir,
        configFile: 'kgen.config'
      })).rejects.toThrow();
    });
  });
});