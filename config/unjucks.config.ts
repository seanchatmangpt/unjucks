/**
 * Unjucks Configuration File
 * 
 * TypeScript configuration file with type safety and environment-specific overrides.
 * This file serves as the default configuration for Unjucks projects.
 */

import { defineConfig } from '../src/core/config.js';
import { join } from 'path';

export default defineConfig({
  // Core settings
  projectRoot: process.cwd(),
  
  // Template directories with priorities
  templateDirs: [
    // High priority custom templates
    { 
      path: '_templates', 
      priority: 90,
      description: 'Project-specific templates'
    },
    // Medium priority shared templates
    { 
      path: 'templates', 
      priority: 70,
      description: 'Shared team templates'
    },
    // Low priority global templates
    { 
      path: join(__dirname, '../_templates'), 
      priority: 50,
      description: 'Built-in Unjucks templates'
    }
  ],
  
  // Output configuration
  outputDir: '.',
  defaultFileExtension: 'js',
  
  // Environment (overridden by NODE_ENV or UNJUCKS_ENV)
  environment: 'development',
  
  // Security configuration
  security: {
    enableAuth: false,
    rateLimiting: true,
    maxRequestsPerMinute: 100,
    pathTraversalProtection: true,
    sanitizeInputs: true,
    allowedOrigins: []
  },
  
  // Performance settings
  performance: {
    cacheEnabled: true,
    cacheTTL: 300, // 5 minutes
    parallelProcessing: true,
    maxConcurrency: 8,
    templateCacheSize: 100,
    memoryLimit: '512MB',
    enableMetrics: process.env.NODE_ENV === 'production'
  },
  
  // Semantic web configuration
  semantic: {
    enableRDF: true,
    cacheOntologies: true,
    ontologyCacheTTL: 3600, // 1 hour
    sparqlEndpoint: process.env.SPARQL_ENDPOINT,
    defaultNamespaces: {
      rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
      rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
      owl: 'http://www.w3.org/2002/07/owl#',
      xsd: 'http://www.w3.org/2001/XMLSchema#',
      skos: 'http://www.w3.org/2004/02/skos/core#',
      schema: 'https://schema.org/',
      unjucks: 'https://unjucks.dev/ontology/',
      ex: 'http://example.org/'
    },
    enableInference: false,
    maxTriples: 50000
  },
  
  // Template engine settings
  templateEngine: {
    engine: 'nunjucks',
    autoescape: true,
    throwOnUndefined: false,
    trimBlocks: true,
    lstripBlocks: true,
    extensionPattern: '\\.njk$',
    watchForChanges: process.env.NODE_ENV === 'development',
    customFilters: []
  },
  
  // CLI configuration
  cli: {
    name: 'unjucks',
    description: 'Next-generation template scaffolding with semantic web capabilities',
    version: '3.0.0',
    defaultCommand: 'help',
    enableAutocompletion: true,
    colorOutput: true,
    verboseLogging: process.env.DEBUG === 'true',
    progressIndicators: true
  },
  
  // File operations
  fileOps: {
    defaultPermissions: '644',
    backupOnOverwrite: false,
    atomicWrites: true,
    validatePaths: true,
    allowAbsolutePaths: false,
    ignoredPatterns: [
      'node_modules/**',
      '.git/**',
      '*.log',
      '.DS_Store',
      'coverage/**',
      'dist/**',
      'build/**'
    ]
  },
  
  // Plugin system
  plugins: {
    enablePlugins: true,
    pluginDirs: ['plugins', 'node_modules'],
    autoloadPlugins: true,
    pluginTimeout: 30000,
    allowNativeModules: false
  },
  
  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: 'pretty',
    enableTimestamps: true,
    logToFile: false,
    logFile: 'unjucks.log'
  },
  
  // Development mode settings
  development: {
    hotReload: true,
    debugMode: process.env.DEBUG === 'true',
    enableProfiler: false,
    mockData: false
  }
});

// Environment-specific configurations

/** Production configuration overrides */
export const productionConfig = defineConfig({
  environment: 'production',
  security: {
    enableAuth: true,
    rateLimiting: true,
    maxRequestsPerMinute: 50
  },
  performance: {
    cacheEnabled: true,
    parallelProcessing: true,
    enableMetrics: true
  },
  logging: {
    level: 'warn',
    format: 'json',
    logToFile: true
  },
  development: {
    hotReload: false,
    debugMode: false,
    enableProfiler: false
  }
});

/** Test configuration overrides */
export const testConfig = defineConfig({
  environment: 'test',
  performance: {
    cacheEnabled: false,
    parallelProcessing: false
  },
  logging: {
    level: 'error',
    format: 'simple'
  },
  development: {
    mockData: true,
    debugMode: true
  },
  semantic: {
    enableRDF: false // Disable RDF in tests unless specifically needed
  }
});

/** Development configuration overrides */
export const developmentConfig = defineConfig({
  environment: 'development',
  security: {
    enableAuth: false,
    rateLimiting: false
  },
  performance: {
    enableMetrics: false
  },
  logging: {
    level: 'debug',
    format: 'pretty'
  },
  development: {
    hotReload: true,
    debugMode: true,
    enableProfiler: true
  },
  templateEngine: {
    watchForChanges: true
  }
});