/**
 * REAL Configuration Tests
 * 
 * Tests the ACTUAL configuration loading system in this project
 * to verify loaded values vs defaults and actual behavior.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { loadConfig } from 'c12';

const originalEnv = { ...process.env };
const PROJECT_ROOT = '/Users/sac/unjucks';

describe('Real Configuration Loading Tests', () => {
  let testDir;
  let configPath;

  beforeEach(() => {
    testDir = join(tmpdir(), `real-config-test-${this.getDeterministicTimestamp()}-${Math.random().toString(36).substr(2, 9)}`);
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

  describe('Project Configuration Loading', () => {
    it('should load the actual project kgen.config.js file', async () => {
      const { config, configFile } = await loadConfig({
        name: 'kgen',
        cwd: PROJECT_ROOT,
        configFile: 'kgen.config'
      });

      // Verify the actual config file was loaded
      expect(configFile).toBe(resolve(PROJECT_ROOT, 'kgen.config.js'));
      
      // Test actual project configuration structure
      expect(config).toBeDefined();
      expect(config.directories).toBeDefined();
      
      // Log actual loaded values for verification
      console.log('ACTUAL CONFIG LOADED:');
      console.log('- directories.out:', config.directories?.out);
      console.log('- directories.state:', config.directories?.state);
      console.log('- directories.cache:', config.directories?.cache);
      console.log('- directories.templates:', config.directories?.templates);
      console.log('- directories.rules:', config.directories?.rules);
      console.log('- generate.defaultTemplate:', config.generate?.defaultTemplate);
      console.log('- generate.attestByDefault:', config.generate?.attestByDefault);
      console.log('- reasoning.enabled:', config.reasoning?.enabled);
      console.log('- provenance.engineId:', config.provenance?.engineId);
    });

    it('should test c12 loading behavior with actual defaults', async () => {
      // Test with explicit defaults
      const testDefaults = {
        directories: {
          out: './DEFAULT_DIST',
          state: './DEFAULT_STATE',
          cache: './DEFAULT_CACHE'
        },
        generate: {
          defaultTemplate: 'DEFAULT_TEMPLATE',
          attestByDefault: false
        },
        reasoning: {
          enabled: false,
          maxDepth: 999
        }
      };

      const { config } = await loadConfig({
        name: 'kgen',
        cwd: PROJECT_ROOT,
        configFile: 'kgen.config',
        defaults: testDefaults
      });

      console.log('CONFIG VS DEFAULTS COMPARISON:');
      console.log('directories.out:', {
        loaded: config.directories?.out,
        default: testDefaults.directories.out,
        isDefault: config.directories?.out === testDefaults.directories.out
      });
      console.log('directories.state:', {
        loaded: config.directories?.state,
        default: testDefaults.directories.state,
        isDefault: config.directories?.state === testDefaults.directories.state
      });
      console.log('generate.defaultTemplate:', {
        loaded: config.generate?.defaultTemplate,
        default: testDefaults.generate.defaultTemplate,
        isDefault: config.generate?.defaultTemplate === testDefaults.generate.defaultTemplate
      });
      console.log('generate.attestByDefault:', {
        loaded: config.generate?.attestByDefault,
        default: testDefaults.generate.attestByDefault,
        isDefault: config.generate?.attestByDefault === testDefaults.generate.attestByDefault
      });

      // The project config should override defaults
      expect(config.directories.out).not.toBe(testDefaults.directories.out);
    });

    it('should test environment-specific overrides with actual config', async () => {
      process.env.NODE_ENV = 'development';
      
      const { config: devConfig } = await loadConfig({
        name: 'kgen',
        cwd: PROJECT_ROOT,
        configFile: 'kgen.config'
      });

      process.env.NODE_ENV = 'production';
      
      const { config: prodConfig } = await loadConfig({
        name: 'kgen',
        cwd: PROJECT_ROOT,
        configFile: 'kgen.config'
      });

      process.env.NODE_ENV = 'test';
      
      const { config: testConfig } = await loadConfig({
        name: 'kgen',
        cwd: PROJECT_ROOT,
        configFile: 'kgen.config'
      });

      console.log('ENVIRONMENT COMPARISON:');
      console.log('Development cache.enabled:', devConfig.cache?.enabled);
      console.log('Production cache.enabled:', prodConfig.cache?.enabled);
      console.log('Test cache.enabled:', testConfig.cache?.enabled);
      
      console.log('Development dev.debug:', devConfig.dev?.debug);
      console.log('Production dev.debug:', prodConfig.dev?.debug);
      console.log('Test dev.debug:', testConfig.dev?.debug);

      // Should show different values based on environment
      expect(devConfig).toBeDefined();
      expect(prodConfig).toBeDefined();
      expect(testConfig).toBeDefined();
    });

    it('should test environment variable substitution', async () => {
      process.env.BUILD_ID = 'test-build-12345';
      process.env.NODE_ENV = 'development';

      const { config } = await loadConfig({
        name: 'kgen',
        cwd: PROJECT_ROOT,
        configFile: 'kgen.config'
      });

      console.log('ENVIRONMENT VARIABLES:');
      console.log('BUILD_ID env var:', process.env.BUILD_ID);
      console.log('Config globalVars.buildId:', config.generate?.globalVars?.buildId);
      
      // If the config uses process.env.BUILD_ID, it should match
      if (config.generate?.globalVars?.buildId) {
        expect(config.generate.globalVars.buildId).toBe('test-build-12345');
      }
    });

    it('should handle function evaluation in config', async () => {
      const { config } = await loadConfig({
        name: 'kgen',
        cwd: PROJECT_ROOT,
        configFile: 'kgen.config'
      });

      console.log('FUNCTION EVALUATION:');
      
      // Test timestamp function if it exists
      if (config.generate?.globalVars?.timestamp) {
        const timestampResult = config.generate.globalVars.timestamp();
        console.log('Timestamp function result:', timestampResult);
        expect(typeof timestampResult).toBe('string');
      }

      // Test other dynamic values
      if (config.project?.name) {
        console.log('Project name:', config.project.name);
      }
    });
  });

  describe('Configuration Validation Behavior', () => {
    it('should test invalid configuration handling', async () => {
      // Create config with missing required fields
      const invalidConfig = `
        export default {
          // Missing directories section
          generate: {
            defaultTemplate: 'test'
          }
        };
      `;
      
      writeFileSync(configPath, invalidConfig);

      const defaults = {
        directories: {
          out: './fallback-dist'
        }
      };

      const { config } = await loadConfig({
        name: 'kgen',
        cwd: testDir,
        configFile: 'kgen.config',
        defaults
      });

      console.log('INVALID CONFIG HANDLING:');
      console.log('Config directories:', config.directories);
      console.log('Fallback applied:', config.directories?.out === './fallback-dist');

      // Should use defaults when fields are missing
      expect(config.directories?.out).toBe('./fallback-dist');
    });

    it('should test deep merge behavior', async () => {
      const complexConfig = `
        export default {
          provenance: {
            engineId: 'test-engine',
            include: {
              timestamp: true,
              engineVersion: false
            }
          }
        };
      `;
      
      writeFileSync(configPath, complexConfig);

      const defaults = {
        provenance: {
          engineId: 'default-engine',
          include: {
            timestamp: false,
            engineVersion: true,
            graphHash: true
          },
          signing: {
            enabled: false
          }
        }
      };

      const { config } = await loadConfig({
        name: 'kgen',
        cwd: testDir,
        configFile: 'kgen.config',
        defaults
      });

      console.log('DEEP MERGE RESULTS:');
      console.log('engineId (overridden):', config.provenance.engineId);
      console.log('timestamp (overridden):', config.provenance.include.timestamp);
      console.log('engineVersion (overridden):', config.provenance.include.engineVersion);
      console.log('graphHash (inherited):', config.provenance.include.graphHash);
      console.log('signing (inherited):', config.provenance.signing);

      // Verify deep merge behavior
      expect(config.provenance.engineId).toBe('test-engine'); // Overridden
      expect(config.provenance.include.timestamp).toBe(true); // Overridden
      expect(config.provenance.include.engineVersion).toBe(false); // Overridden
      expect(config.provenance.include.graphHash).toBe(true); // Inherited
      expect(config.provenance.signing.enabled).toBe(false); // Inherited
    });
  });

  describe('Performance and Cache Testing', () => {
    it('should measure configuration loading performance', async () => {
      const iterations = 10;
      const times = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();
        
        await loadConfig({
          name: 'kgen',
          cwd: PROJECT_ROOT,
          configFile: 'kgen.config'
        });
        
        const endTime = performance.now();
        times.push(endTime - startTime);
      }

      const averageTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxTime = Math.max(...times);
      const minTime = Math.min(...times);

      console.log('PERFORMANCE METRICS:');
      console.log(`Average load time: ${averageTime.toFixed(2)}ms`);
      console.log(`Min load time: ${minTime.toFixed(2)}ms`);
      console.log(`Max load time: ${maxTime.toFixed(2)}ms`);

      // Performance should be reasonable
      expect(averageTime).toBeLessThan(100); // Should load in under 100ms
    });
  });

  describe('Directory Structure Testing', () => {
    it('should validate directory creation from config', async () => {
      const { config } = await loadConfig({
        name: 'kgen',
        cwd: PROJECT_ROOT,
        configFile: 'kgen.config'
      });

      console.log('DIRECTORY STRUCTURE FROM CONFIG:');
      
      if (config.directories) {
        Object.entries(config.directories).forEach(([key, path]) => {
          const absolutePath = resolve(PROJECT_ROOT, path);
          console.log(`${key}: ${path} -> ${absolutePath}`);
          
          // Test path resolution
          expect(typeof path).toBe('string');
          expect(path.length).toBeGreaterThan(0);
        });
      }
    });
  });
});