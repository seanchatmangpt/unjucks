/**
 * Unjucks Configuration System
 * 
 * Comprehensive configuration management using c12/confbox with Zod validation.
 * Supports multiple config sources, environment-specific overrides, and type safety.
 * 
 * Features:
 * - c12-based configuration loading from multiple sources
 * - Zod schema validation with TypeScript types
 * - Environment-specific configuration
 * - Template directory discovery
 * - Security and performance settings
 * - Semantic web configuration
 * - Plugin system configuration
 */

import { z } from 'zod';
import { loadConfig } from 'c12';
import { join, resolve } from 'path';
import { existsSync } from 'fs';
import consola from 'consola';

// =============================================================================
// ZOD SCHEMAS
// =============================================================================

// Base template directory schema
const TemplateDirSchema = z.object({
  path: z.string(),
  enabled: z.boolean().default(true),
  priority: z.number().min(0).max(100).default(50),
  description: z.string().optional()
});

// Security configuration schema
const SecurityConfigSchema = z.object({
  enableAuth: z.boolean().default(false),
  secretKey: z.string().optional(),
  rateLimiting: z.boolean().default(true),
  maxRequestsPerMinute: z.number().positive().default(100),
  enableCors: z.boolean().default(false),
  allowedOrigins: z.array(z.string()).default([]),
  pathTraversalProtection: z.boolean().default(true),
  sanitizeInputs: z.boolean().default(true)
});

// Performance configuration schema
const PerformanceConfigSchema = z.object({
  cacheEnabled: z.boolean().default(true),
  cacheTTL: z.number().positive().default(300), // 5 minutes
  parallelProcessing: z.boolean().default(true),
  maxConcurrency: z.number().positive().default(10),
  templateCacheSize: z.number().positive().default(100),
  memoryLimit: z.string().default('512MB'),
  enableMetrics: z.boolean().default(false)
});

// Semantic web configuration schema
const SemanticConfigSchema = z.object({
  enableRDF: z.boolean().default(false),
  cacheOntologies: z.boolean().default(true),
  ontologyCacheTTL: z.number().positive().default(3600), // 1 hour
  sparqlEndpoint: z.string().url().optional(),
  defaultNamespaces: z.record(z.string()).default({
    rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
    rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
    owl: 'http://www.w3.org/2002/07/owl#',
    xsd: 'http://www.w3.org/2001/XMLSchema#',
    skos: 'http://www.w3.org/2004/02/skos/core#'
  }),
  enableInference: z.boolean().default(false),
  maxTriples: z.number().positive().default(100000)
});

// Template engine configuration schema
const TemplateEngineConfigSchema = z.object({
  engine: z.enum(['nunjucks', 'handlebars', 'mustache']).default('nunjucks'),
  autoescape: z.boolean().default(true),
  throwOnUndefined: z.boolean().default(false),
  trimBlocks: z.boolean().default(true),
  lstripBlocks: z.boolean().default(true),
  customFilters: z.array(z.string()).default([]),
  extensionPattern: z.string().default('\\.njk$'),
  watchForChanges: z.boolean().default(false)
});

// CLI configuration schema
const CLIConfigSchema = z.object({
  name: z.string().default('unjucks'),
  description: z.string().default('Next-generation template scaffolding'),
  version: z.string().default('3.0.0'),
  defaultCommand: z.string().default('help'),
  enableAutocompletion: z.boolean().default(true),
  colorOutput: z.boolean().default(true),
  verboseLogging: z.boolean().default(false),
  progressIndicators: z.boolean().default(true)
});

// File operations configuration schema
const FileOpsConfigSchema = z.object({
  defaultPermissions: z.string().default('644'),
  backupOnOverwrite: z.boolean().default(false),
  atomicWrites: z.boolean().default(true),
  validatePaths: z.boolean().default(true),
  allowAbsolutePaths: z.boolean().default(false),
  ignoredPatterns: z.array(z.string()).default([
    'node_modules/**',
    '.git/**',
    '*.log',
    '.DS_Store'
  ])
});

// Plugin system configuration schema
const PluginConfigSchema = z.object({
  enablePlugins: z.boolean().default(true),
  pluginDirs: z.array(z.string()).default(['plugins', 'node_modules']),
  autoloadPlugins: z.boolean().default(true),
  pluginTimeout: z.number().positive().default(30000), // 30 seconds
  allowNativeModules: z.boolean().default(false)
});

// Main configuration schema
const ConfigSchema = z.object({
  // Core settings
  projectRoot: z.string().default(process.cwd()),
  configFile: z.string().default('unjucks.config'),
  
  // Template directories (supports multiple sources with priorities)
  templateDirs: z.array(z.union([
    z.string(), // Simple string path
    TemplateDirSchema // Full configuration object
  ])).default(['_templates', 'templates']),
  
  // Output configuration
  outputDir: z.string().default('.'),
  defaultFileExtension: z.string().default('js'),
  
  // Environment
  environment: z.enum(['development', 'production', 'test']).default('development'),
  nodeEnv: z.string().default('development'),
  
  // Component configurations
  security: SecurityConfigSchema.default({}),
  performance: PerformanceConfigSchema.default({}),
  semantic: SemanticConfigSchema.default({}),
  templateEngine: TemplateEngineConfigSchema.default({}),
  cli: CLIConfigSchema.default({}),
  fileOps: FileOpsConfigSchema.default({}),
  plugins: PluginConfigSchema.default({}),
  
  // Logging configuration
  logging: z.object({
    level: z.enum(['error', 'warn', 'info', 'debug', 'trace']).default('info'),
    format: z.enum(['json', 'pretty', 'simple']).default('pretty'),
    enableTimestamps: z.boolean().default(true),
    logToFile: z.boolean().default(false),
    logFile: z.string().default('unjucks.log')
  }).default({}),
  
  // Development mode settings
  development: z.object({
    hotReload: z.boolean().default(false),
    debugMode: z.boolean().default(false),
    enableProfiler: z.boolean().default(false),
    mockData: z.boolean().default(false)
  }).default({})
});

// =============================================================================
// TYPESCRIPT TYPES
// =============================================================================

/** Core Unjucks configuration type derived from Zod schema */
// TypeScript type definition - for JSDoc reference only
// export type UnjucksConfig = z.infer<typeof ConfigSchema>;

/** Template directory configuration */
// TypeScript type definition - for JSDoc reference only
// export type TemplateDirConfig = z.infer<typeof TemplateDirSchema>;

/** Security configuration */
// TypeScript type definition - for JSDoc reference only
// export type SecurityConfig = z.infer<typeof SecurityConfigSchema>;

/** Performance configuration */
// TypeScript type definition - for JSDoc reference only
// export type PerformanceConfig = z.infer<typeof PerformanceConfigSchema>;

/** Semantic web configuration */
// TypeScript type definition - for JSDoc reference only
// export type SemanticConfig = z.infer<typeof SemanticConfigSchema>;

/** Template engine configuration */
// TypeScript type definition - for JSDoc reference only
// // TypeScript type definition - for JSDoc reference only
// export type TemplateEngineConfig = z.infer<typeof TemplateEngineConfigSchema>;

/** CLI configuration */
// TypeScript type definition - for JSDoc reference only
// // TypeScript type definition - for JSDoc reference only
// export type CLIConfig = z.infer<typeof CLIConfigSchema>;

/** File operations configuration */
// TypeScript type definition - for JSDoc reference only
// // TypeScript type definition - for JSDoc reference only
// export type FileOpsConfig = z.infer<typeof FileOpsConfigSchema>;

/** Plugin system configuration */
// TypeScript type definition - for JSDoc reference only
// export type PluginConfig = z.infer<typeof PluginConfigSchema>;

// =============================================================================
// CONFIGURATION LOADER CLASS
// =============================================================================

/**
 * Unjucks Configuration Manager
 * 
 * Handles loading, validation, and management of configuration from multiple sources
 * using c12/confbox with Zod schema validation.
 */
export class ConfigManager {
  constructor() {
    this.config = null;
    this.configSources = [];
    this.validationErrors = [];
    this.logger = consola.withTag('config');
  }

  /**
   * Load configuration from multiple sources with environment-specific overrides
   * @param {Object} options - Configuration loading options
   * @param {string} options.configName - Configuration file name (without extension)
   * @param {string} options.cwd - Working directory to search for config
   * @param {Object} options.defaults - Default configuration values
   * @param {Object} options.overrides - Override configuration values
   * @returns {Promise<UnjucksConfig>} Validated configuration object
   */
  async loadConfig(options = {}) {
    const {
      configName = 'unjucks.config',
      cwd = process.cwd(),
      defaults = {},
      overrides = {}
    } = options;

    try {
      this.logger.debug('Loading configuration...', { configName, cwd });

      // Load configuration using c12
      const result = await loadConfig({
        name: configName,
        cwd,
        packageJson: 'unjucks', // Load from package.json unjucks field
        globalRc: true, // Load from global config
        envName: 'UNJUCKS',
        defaults: {
          ...this.getEnvironmentDefaults(),
          ...defaults
        },
        extend: { overrides }
      });

      const rawConfig = result.config || {};
      this.configSources = result.sources || [];
      
      // Debug logging
      this.logger.debug('Raw config from c12:', JSON.stringify(rawConfig, null, 2));
      this.logger.debug('Environment defaults:', JSON.stringify(this.getEnvironmentDefaults(), null, 2));
      
      // Log configuration sources
      this.logger.debug('Configuration sources:', this.configSources.map(s => ({
        source: s.source || 'unknown',
        configFile: s.configFile || s.path || 'unknown'
      })));

      // Validate configuration with Zod schema
      const validationResult = ConfigSchema.safeParse(rawConfig);
      
      if (!validationResult.success) {
        this.validationErrors = validationResult.error.errors;
        this.logger.error('Configuration validation failed:', this.validationErrors);
        
        // Throw detailed error
        const errorMessages = validationResult.error.errors.map(err => 
          `${err.path.join('.')}: ${err.message}`
        );
        throw new Error(`Configuration validation failed:\n${errorMessages.join('\n')}`);
      }

      this.config = validationResult.data;
      
      // Post-process configuration
      await this.postProcessConfig();
      
      this.logger.info('Configuration loaded successfully', {
        environment: this.config.environment,
        templateDirs: this.config.templateDirs.length,
        sourcesCount: this.configSources.length
      });

      return this.config;

    } catch (error) {
      this.logger.error('Failed to load configuration:', error.message);
      throw error;
    }
  }

  /**
   * Get environment-specific default values
   * @returns {Object} Environment defaults
   */
  getEnvironmentDefaults() {
    const nodeEnv = process.env.NODE_ENV || 'development';
    const environment = process.env.UNJUCKS_ENV || nodeEnv;

    const baseDefaults = {
      environment,
      nodeEnv,
      projectRoot: process.cwd()
    };

    // Environment-specific defaults
    switch (environment) {
      case 'production':
        return {
          ...baseDefaults,
          logging: { level: 'warn' },
          performance: { cacheEnabled: true, enableMetrics: true },
          security: { rateLimiting: true, pathTraversalProtection: true },
          development: { hotReload: false, debugMode: false }
        };
      
      case 'test':
        return {
          ...baseDefaults,
          logging: { level: 'error' },
          performance: { cacheEnabled: false },
          development: { mockData: true }
        };
      
      case 'development':
      default:
        return {
          ...baseDefaults,
          logging: { level: 'info' },
          development: { hotReload: true, debugMode: true }
        };
    }
  }

  /**
   * Post-process configuration after loading and validation
   */
  async postProcessConfig() {
    // Resolve template directory paths
    this.config.templateDirs = this.config.templateDirs.map(dir => {
      if (typeof dir === 'string') {
        return {
          path: resolve(this.config.projectRoot, dir),
          enabled: true,
          priority: 50
        };
      }
      return {
        ...dir,
        path: resolve(this.config.projectRoot, dir.path)
      };
    });

    // Validate template directories exist
    const existingDirs = this.config.templateDirs.filter(dir => {
      const exists = existsSync(dir.path);
      if (!exists) {
        this.logger.warn(`Template directory does not exist: ${dir.path}`);
      }
      return exists && dir.enabled;
    });

    if (existingDirs.length === 0) {
      this.logger.warn('No valid template directories found');
    }

    // Sort template directories by priority (higher priority first)
    this.config.templateDirs = existingDirs.sort((a, b) => b.priority - a.priority);

    // Resolve output directory
    this.config.outputDir = resolve(this.config.projectRoot, this.config.outputDir);

    // Apply environment-specific overrides
    this.applyEnvironmentOverrides();

    this.logger.debug('Configuration post-processing complete', {
      templateDirs: this.config.templateDirs.length,
      outputDir: this.config.outputDir
    });
  }

  /**
   * Apply environment-specific configuration overrides
   */
  applyEnvironmentOverrides() {
    // Apply production optimizations
    if (this.config.environment === 'production') {
      this.config.performance.cacheEnabled = true;
      this.config.security.pathTraversalProtection = true;
      this.config.templateEngine.watchForChanges = false;
    }

    // Apply development conveniences
    if (this.config.environment === 'development') {
      this.config.cli.verboseLogging = true;
      this.config.templateEngine.watchForChanges = true;
    }

    // Apply test environment settings
    if (this.config.environment === 'test') {
      this.config.performance.cacheEnabled = false;
      this.config.logging.level = 'error';
    }
  }

  /**
   * Get current configuration
   * @returns {UnjucksConfig|null} Current configuration or null if not loaded
   */
  getConfig() {
    return this.config;
  }

  /**
   * Get configuration validation errors
   * @returns {Array} Array of validation errors
   */
  getValidationErrors() {
    return this.validationErrors;
  }

  /**
   * Get configuration sources information
   * @returns {Array} Array of configuration sources
   */
  getConfigSources() {
    return this.configSources;
  }

  /**
   * Validate a partial configuration object
   * @param {Object} partialConfig - Partial configuration to validate
   * @returns {Object} Validation result with success and errors
   */
  validatePartialConfig(partialConfig) {
    const result = ConfigSchema.partial().safeParse(partialConfig);
    return {
      success: result.success,
      errors: result.success ? [] : result.error.errors,
      data: result.success ? result.data : null
    };
  }

  /**
   * Store configuration schema in memory for external access
   * @param {Object} memoryStore - Memory store instance to use
   */
  storeSchemaInMemory(memoryStore) {
    if (!memoryStore || typeof memoryStore.set !== 'function') {
      this.logger.warn('Invalid memory store provided for schema storage');
      return;
    }

    const schemaInfo = {
      schema: ConfigSchema,
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      components: {
        security: SecurityConfigSchema,
        performance: PerformanceConfigSchema,
        semantic: SemanticConfigSchema,
        templateEngine: TemplateEngineConfigSchema,
        cli: CLIConfigSchema,
        fileOps: FileOpsConfigSchema,
        plugins: PluginConfigSchema
      },
      exampleConfig: this.getExampleConfig()
    };

    memoryStore.set('hive/config/system', schemaInfo);
    this.logger.debug('Configuration schema stored in memory');
  }

  /**
   * Generate example configuration for documentation
   * @returns {Object} Example configuration object
   */
  getExampleConfig() {
    return {
      templateDirs: [
        '_templates',
        { path: 'custom-templates', priority: 80 }
      ],
      outputDir: './generated',
      environment: 'development',
      security: {
        enableAuth: false,
        rateLimiting: true,
        pathTraversalProtection: true
      },
      performance: {
        cacheEnabled: true,
        parallelProcessing: true,
        maxConcurrency: 5
      },
      semantic: {
        enableRDF: true,
        cacheOntologies: true,
        defaultNamespaces: {
          ex: 'http://example.org/'
        }
      },
      logging: {
        level: 'info',
        format: 'pretty'
      }
    };
  }
}

// =============================================================================
// CONFIGURATION DEFINITION HELPER
// =============================================================================

/**
 * Define a configuration object with TypeScript support
 * @param {UnjucksConfig} config - Configuration object
 * @returns {UnjucksConfig} The same configuration object (for type inference)
 */
export function defineConfig(config) {
  return config;
}

// =============================================================================
// SINGLETON INSTANCE AND CONVENIENCE FUNCTIONS
// =============================================================================

/** Global configuration manager instance */
const configManager = new ConfigManager();

/**
 * Load and get the global Unjucks configuration
 * @param {Object} options - Configuration loading options
 * @returns {Promise<UnjucksConfig>} Validated configuration
 */
export async function loadUnjucksConfig(options = {}) {
  return await configManager.loadConfig(options);
}

/**
 * Get the current configuration (must be loaded first)
 * @returns {UnjucksConfig|null} Current configuration
 */
export function getConfig() {
  return configManager.getConfig();
}

/**
 * Validate configuration against schema
 * @param {Object} config - Configuration to validate
 * @returns {Object} Validation result
 */
export function validateConfig(config) {
  return configManager.validatePartialConfig(config);
}

/**
 * Store configuration schema in memory
 * @param {Object} memoryStore - Memory store instance
 */
export function storeConfigSchema(memoryStore) {
  return configManager.storeSchemaInMemory(memoryStore);
}

// Export schemas for external use
export {
  ConfigSchema,
  SecurityConfigSchema,
  PerformanceConfigSchema,
  SemanticConfigSchema,
  TemplateEngineConfigSchema,
  CLIConfigSchema,
  FileOpsConfigSchema,
  PluginConfigSchema
};

// Export the manager instance
export { configManager };