/**
 * KGEN Configuration System
 * Main entry point for configuration loading and management
 */

export { 
  loadKgenConfig, 
  defaultConfig, 
  mergeConfigs, 
  getEnvConfig, 
  watchConfig, 
  exportConfig 
} from './loader.js';

export { 
  KgenConfigSchema, 
  validateConfig, 
  createSectionSchema, 
  getSectionDefaults, 
  validateSection, 
  generateTypes 
} from './schema.js';

export { 
  validateConfig as validateConfigAdvanced, 
  createValidationReport 
} from './validator.js';

export { 
  generateLockfile, 
  verifyLockfile, 
  updateLockfile 
} from '../project/lockfile.js';

/**
 * Convenience function to load and validate configuration
 * @param {Object} options - Loading options
 * @returns {Promise<Object>} Loaded and validated configuration
 */
export async function loadConfig(options = {}) {
  const { loadKgenConfig } = await import('./loader.js');
  const { validateConfig: validate } = await import('./validator.js');
  
  const result = await loadKgenConfig({
    validate: false, // We'll do advanced validation
    ...options
  });
  
  if (!result.config) {
    throw new Error('Failed to load configuration');
  }
  
  // Perform advanced validation
  const validation = await validate(result.config, options.validation || {});
  
  if (!validation.success) {
    const { createValidationReport } = await import('./validator.js');
    const report = createValidationReport(validation);
    throw new Error(`Configuration validation failed:\n${report}`);
  }
  
  return {
    ...result,
    validation
  };
}

/**
 * Initialize configuration system
 * @param {Object} options - Initialization options
 * @returns {Promise<Object>} Initialization result
 */
export async function initConfig(options = {}) {
  const {
    cwd = process.cwd(),
    createDirectories = true,
    generateLockfile: generateLock = true,
    validate = true
  } = options;
  
  try {
    // Load configuration
    const configResult = await loadConfig({
      cwd,
      validate
    });
    
    // Create directories if requested
    if (createDirectories) {
      const mkdirp = (await import('mkdirp')).default;
      const { join } = await import('node:path');
      
      for (const [key, dir] of Object.entries(configResult.config.directories)) {
        if (dir && typeof dir === 'string') {
          const fullPath = join(cwd, dir);
          await mkdirp(fullPath);
        }
      }
    }
    
    // Generate lockfile if requested
    let lockfileResult = null;
    if (generateLock) {
      const { generateLockfile } = await import('../project/lockfile.js');
      lockfileResult = await generateLockfile({
        cwd,
        config: configResult.config
      });
    }
    
    return {
      success: true,
      config: configResult.config,
      configFile: configResult.configFile,
      validation: configResult.validation,
      lockfile: lockfileResult,
      directories: Object.values(configResult.config.directories)
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get configuration schema as JSON Schema
 * @returns {Object} JSON Schema representation
 */
export function getConfigJsonSchema() {
  // This would be implemented to convert Zod schema to JSON Schema
  // For now, return a basic representation
  return {
    type: 'object',
    properties: {
      directories: {
        type: 'object',
        properties: {
          out: { type: 'string', default: './dist' },
          state: { type: 'string', default: './.kgen/state' },
          cache: { type: 'string', default: './.kgen/cache' },
          templates: { type: 'string', default: './templates' },
          rules: { type: 'string', default: './rules' }
        }
      },
      generate: {
        type: 'object',
        properties: {
          defaultTemplate: { type: 'string', default: 'basic' },
          globalVars: { type: 'object', default: {} },
          attestByDefault: { type: 'boolean', default: true },
          cleanOutput: { type: 'boolean', default: false },
          parallel: { type: 'boolean', default: true },
          maxConcurrency: { type: 'number', minimum: 1, maximum: 32, default: 4 }
        }
      },
      reasoning: {
        type: 'object',
        properties: {
          enabled: { type: 'boolean', default: true },
          defaultRules: { type: 'array', items: { type: 'string' }, default: ['basic', 'validation'] },
          maxDepth: { type: 'number', minimum: 1, maximum: 100, default: 10 },
          timeout: { type: 'number', minimum: 1000, default: 30000 }
        }
      }
    }
  };
}
