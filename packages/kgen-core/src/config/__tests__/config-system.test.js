/**
 * KGEN Configuration System Tests
 * Comprehensive tests for configuration loading, validation, and lockfile generation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm, writeFile, readFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Import modules under test
import { 
  loadKgenConfig, 
  defaultConfig, 
  mergeConfigs, 
  getEnvConfig,
  exportConfig 
} from '../loader.js';

import { 
  validateConfig, 
  validateSection, 
  createSectionSchema, 
  getSectionDefaults 
} from '../schema.js';

import { 
  validateConfig as validateConfigAdvanced, 
  createValidationReport 
} from '../validator.js';

import { 
  generateLockfile, 
  verifyLockfile, 
  updateLockfile 
} from '../../project/lockfile.js';

describe('Configuration Loader', () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'kgen-config-test-'));
  });

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('should load default configuration', async () => {
    const result = await loadKgenConfig({ cwd: tempDir });
    
    expect(result).toHaveProperty('config');
    expect(result).toHaveProperty('configFile');
    expect(result).toHaveProperty('meta');
    expect(result.config).toMatchObject(defaultConfig);
  });

  it('should load configuration from kgen.config.js', async () => {
    const configContent = `
export default {
  directories: {
    out: './custom-output'
  },
  generate: {
    defaultTemplate: 'custom'
  }
};
    `;
    
    await writeFile(join(tempDir, 'kgen.config.js'), configContent);
    
    const result = await loadKgenConfig({ cwd: tempDir });
    
    expect(result.config.directories.out).toBe('./custom-output');
    expect(result.config.generate.defaultTemplate).toBe('custom');
    expect(result.configFile).toContain('kgen.config.js');
  });

  it('should merge configurations correctly', () => {
    const base = {
      directories: { out: './dist', cache: './.cache' },
      generate: { parallel: true }
    };
    
    const override = {
      directories: { out: './build' },
      reasoning: { enabled: false }
    };
    
    const merged = mergeConfigs(base, override);
    
    expect(merged.directories.out).toBe('./build');
    expect(merged.directories.cache).toBe('./.cache');
    expect(merged.generate.parallel).toBe(true);
    expect(merged.reasoning.enabled).toBe(false);
  });

  it('should get environment-specific configuration', () => {
    const config = {
      cache: { enabled: true },
      development: {
        cache: { enabled: false },
        dev: { debugMode: true }
      }
    };
    
    const devConfig = getEnvConfig(config, 'development');
    
    expect(devConfig.cache.enabled).toBe(false);
    expect(devConfig.dev.debugMode).toBe(true);
    expect(devConfig).not.toHaveProperty('development');
  });

  it('should export configuration in different formats', async () => {
    const config = { directories: { out: './dist' } };
    
    const jsonExport = await exportConfig(config, 'json');
    expect(jsonExport).toContain('"out": "./dist"');
    
    const jsExport = await exportConfig(config, 'js');
    expect(jsExport).toContain('export default');
  });
});

describe('Configuration Schema Validation', () => {
  it('should validate valid configuration', () => {
    const validConfig = {
      directories: {
        out: './dist',
        state: './.kgen/state',
        cache: './.kgen/cache',
        templates: './templates',
        rules: './rules'
      },
      generate: {
        defaultTemplate: 'basic',
        attestByDefault: true,
        maxConcurrency: 4
      }
    };
    
    const result = validateConfig(validConfig);
    
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.errors).toEqual([]);
  });

  it('should reject invalid configuration', () => {
    const invalidConfig = {
      generate: {
        maxConcurrency: -1 // Invalid: must be >= 1
      },
      cache: {
        strategy: 'invalid' // Invalid: must be lru, fifo, or ttl
      }
    };
    
    const result = validateConfig(invalidConfig);
    
    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should validate specific sections', () => {
    const cacheConfig = {
      enabled: true,
      ttl: 3600000,
      strategy: 'lru'
    };
    
    const result = validateSection('cache', cacheConfig);
    
    expect(result.success).toBe(true);
    expect(result.data).toMatchObject(cacheConfig);
  });

  it('should get section defaults', () => {
    const defaults = getSectionDefaults('generate');
    
    expect(defaults).toHaveProperty('defaultTemplate');
    expect(defaults).toHaveProperty('attestByDefault');
    expect(defaults).toHaveProperty('maxConcurrency');
  });

  it('should create section schemas', () => {
    const schema = createSectionSchema('directories');
    
    expect(schema).toBeDefined();
    // Schema should be able to parse valid directory config
    const result = schema.safeParse({
      out: './dist',
      state: './.kgen/state'
    });
    expect(result.success).toBe(true);
  });
});

describe('Advanced Configuration Validation', () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'kgen-validation-test-'));
    
    // Create directory structure
    await mkdir(join(tempDir, 'templates'), { recursive: true });
    await mkdir(join(tempDir, 'rules'), { recursive: true });
    await mkdir(join(tempDir, 'templates', 'basic'), { recursive: true });
    
    // Create template config
    await writeFile(
      join(tempDir, 'templates', 'basic', 'template.json'),
      JSON.stringify({ name: 'basic', version: '1.0.0' })
    );
    
    // Create rule file
    await writeFile(
      join(tempDir, 'rules', 'basic.ttl'),
      '@prefix : <http://example.org/> . :rule1 :type :ValidationRule .'
    );
  });

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('should validate paths and permissions', async () => {
    const config = {
      directories: {
        out: join(tempDir, 'dist'),
        templates: join(tempDir, 'templates'),
        rules: join(tempDir, 'rules')
      },
      reasoning: {
        defaultRules: ['basic']
      }
    };
    
    const result = await validateConfigAdvanced(config, {
      checkPaths: true,
      validateTemplates: true,
      validateRules: true
    });
    
    expect(result.success).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('should detect missing default rules', async () => {
    const config = {
      directories: {
        rules: join(tempDir, 'rules')
      },
      reasoning: {
        defaultRules: ['basic', 'nonexistent']
      }
    };
    
    const result = await validateConfigAdvanced(config, {
      validateRules: true
    });
    
    expect(result.success).toBe(false);
    expect(result.errors.some(e => e.code === 'MISSING_DEFAULT_RULE')).toBe(true);
  });

  it('should create validation report', async () => {
    const result = {
      success: false,
      errors: [
        { path: 'cache.strategy', message: 'Invalid strategy', code: 'INVALID_STRATEGY' }
      ],
      warnings: [
        { path: 'generate.maxConcurrency', message: 'High concurrency', code: 'HIGH_CONCURRENCY' }
      ]
    };
    
    const report = createValidationReport(result);
    
    expect(report).toContain('❌ **Configuration has errors**');
    expect(report).toContain('## Errors');
    expect(report).toContain('## Warnings');
    expect(report).toContain('Invalid strategy');
    expect(report).toContain('High concurrency');
  });
});

describe('Project Lockfile Generation', () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'kgen-lockfile-test-'));
    
    // Create project structure
    await mkdir(join(tempDir, 'templates'), { recursive: true });
    await mkdir(join(tempDir, 'rules'), { recursive: true });
    
    // Create package.json
    await writeFile(
      join(tempDir, 'package.json'),
      JSON.stringify({
        name: 'test-project',
        version: '1.0.0',
        dependencies: {
          'n3': '^1.17.2'
        }
      })
    );
    
    // Create some files
    await writeFile(
      join(tempDir, 'templates', 'basic.ttl'),
      '@prefix : <http://example.org/> . :template1 :type :Template .'
    );
    
    await writeFile(
      join(tempDir, 'rules', 'validation.n3'),
      '@prefix : <http://example.org/> . :rule1 :type :Rule .'
    );
  });

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('should generate project lockfile', async () => {
    const result = await generateLockfile({
      cwd: tempDir,
      outputPath: 'project.lock'
    });
    
    expect(result.success).toBe(true);
    expect(result.lockfile).toBeDefined();
    expect(result.lockfile.version).toBe('1.0.0');
    expect(result.lockfile.project.name).toBe('test-project');
    expect(result.lockfile.files).toBeDefined();
    expect(result.stats.totalFiles).toBeGreaterThan(0);
    
    // Check that lockfile was written
    const lockfileContent = await readFile(join(tempDir, 'project.lock'), 'utf8');
    const lockfileData = JSON.parse(lockfileContent);
    expect(lockfileData.version).toBe('1.0.0');
  });

  it('should verify lockfile against project', async () => {
    // First generate lockfile
    await generateLockfile({
      cwd: tempDir,
      outputPath: 'project.lock'
    });
    
    // Then verify
    const result = await verifyLockfile({
      cwd: tempDir,
      lockfilePath: 'project.lock'
    });
    
    expect(result.success).toBe(true);
    expect(result.verified).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it('should detect file modifications', async () => {
    // Generate initial lockfile
    await generateLockfile({
      cwd: tempDir,
      outputPath: 'project.lock'
    });
    
    // Modify a file
    await writeFile(
      join(tempDir, 'templates', 'basic.ttl'),
      '@prefix : <http://example.org/> . :template1 :type :ModifiedTemplate .'
    );
    
    // Verify should detect modification
    const result = await verifyLockfile({
      cwd: tempDir,
      lockfilePath: 'project.lock'
    });
    
    expect(result.success).toBe(false);
    expect(result.verified).toBe(false);
    expect(result.issues.some(issue => issue.type === 'files_modified')).toBe(true);
  });

  it('should update existing lockfile', async () => {
    // Generate initial lockfile
    const initialResult = await generateLockfile({
      cwd: tempDir,
      outputPath: 'project.lock'
    });
    
    // Add a new file
    await writeFile(
      join(tempDir, 'rules', 'new-rule.ttl'),
      '@prefix : <http://example.org/> . :newRule :type :Rule .'
    );
    
    // Update lockfile
    const updateResult = await updateLockfile({
      cwd: tempDir,
      lockfilePath: 'project.lock'
    });
    
    expect(updateResult.success).toBe(true);
    expect(updateResult.updated).toBe(true);
    
    // Verify new lockfile includes the new file
    const lockfileContent = await readFile(join(tempDir, 'project.lock'), 'utf8');
    const lockfileData = JSON.parse(lockfileContent);
    expect(lockfileData.files['rules/new-rule.ttl']).toBeDefined();
  });

  it('should handle missing lockfile gracefully', async () => {
    const result = await verifyLockfile({
      cwd: tempDir,
      lockfilePath: 'nonexistent.lock'
    });
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('Failed to verify lockfile');
  });
});

describe('Configuration Integration', () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'kgen-integration-test-'));
  });

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('should integrate configuration loading with lockfile generation', async () => {
    // Create config file
    const configContent = `
export default {
  directories: {
    out: './dist',
    templates: './templates'
  },
  generate: {
    defaultTemplate: 'integration-test'
  }
};
    `;
    await writeFile(join(tempDir, 'kgen.config.js'), configContent);
    
    // Create some project files
    await mkdir(join(tempDir, 'templates'), { recursive: true });
    await writeFile(
      join(tempDir, 'templates', 'test.ttl'),
      '@prefix : <http://example.org/> . :test :type :Template .'
    );
    
    // Load configuration
    const configResult = await loadKgenConfig({ cwd: tempDir });
    expect(configResult.config.generate.defaultTemplate).toBe('integration-test');
    
    // Generate lockfile with config
    const lockfileResult = await generateLockfile({
      cwd: tempDir,
      config: configResult.config
    });
    
    expect(lockfileResult.success).toBe(true);
    expect(lockfileResult.lockfile.config).toBeDefined();
    expect(lockfileResult.lockfile.files['templates/test.ttl']).toBeDefined();
  });

  it('should validate configuration before lockfile generation', async () => {
    const invalidConfig = {
      generate: {
        maxConcurrency: -1 // Invalid
      }
    };
    
    // This should fail validation
    await expect(
      loadKgenConfig({ 
        cwd: tempDir,
        overrides: invalidConfig,
        validate: true
      })
    ).rejects.toThrow('Configuration validation failed');
  });
});