/**
 * Build Optimization Configuration
 * High-performance build system with intelligent caching and monitoring
 */

import os from 'node:os';
import path from 'node:path';

const CPU_COUNT = os.cpus().length;
const MEMORY_GB = Math.round(os.totalmem() / (1024 ** 3));

export const buildConfig = {
  // ==========================================
  // CACHING STRATEGY (80/20 OPTIMIZATION)
  // ==========================================
  cache: {
    // Multi-layer caching for maximum performance
    enabled: true,
    strategy: 'intelligent', // adaptive, aggressive, conservative, intelligent
    
    // Cache directories optimized for different content types
    directories: {
      build: '.build-cache',
      dependencies: '.deps-cache',
      tests: '.test-cache',
      lint: '.lint-cache',
      assets: '.asset-cache',
      templates: '.template-cache'
    },
    
    // Cache retention policies
    retention: {
      build: 7 * 24 * 60 * 60 * 1000,      // 7 days
      dependencies: 30 * 24 * 60 * 60 * 1000, // 30 days
      tests: 3 * 24 * 60 * 60 * 1000,      // 3 days
      lint: 24 * 60 * 60 * 1000,           // 1 day
      assets: 14 * 24 * 60 * 60 * 1000,    // 14 days
      templates: 7 * 24 * 60 * 60 * 1000   // 7 days
    },
    
    // Cache invalidation triggers
    invalidation: {
      onPackageChange: true,
      onConfigChange: true,
      onSourceChange: true,
      onDependencyChange: true,
      checkInterval: 5 * 60 * 1000 // 5 minutes
    },
    
    // Compression for cache storage efficiency
    compression: {
      enabled: true,
      algorithm: 'brotli', // gzip, deflate, brotli
      level: 6 // Balance between compression ratio and speed
    }
  },

  // ==========================================
  // INCREMENTAL BUILD SYSTEM
  // ==========================================
  incremental: {
    enabled: true,
    
    // Change detection mechanisms
    changeDetection: {
      method: 'hash+mtime', // hash, mtime, hash+mtime
      hashAlgorithm: 'xxhash64', // Fast hashing for build files
      granularity: 'file', // file, directory, module
      excludePatterns: [
        '**/*.log',
        '**/*.tmp',
        '**/node_modules/**',
        '**/.git/**',
        '**/coverage/**'
      ]
    },
    
    // Build graph for dependency tracking
    dependencyGraph: {
      enabled: true,
      maxDepth: 10,
      cycleDetection: true,
      cacheGraphPath: '.build-cache/dependency-graph.json'
    },
    
    // Parallel execution limits
    parallelism: {
      maxWorkers: Math.min(CPU_COUNT - 1, 8), // Leave 1 CPU for OS
      memoryLimit: Math.floor(MEMORY_GB * 0.8), // Use 80% of available memory
      taskTimeout: 5 * 60 * 1000 // 5 minutes per task
    }
  },

  // ==========================================
  // DEPENDENCY OPTIMIZATION
  // ==========================================
  dependencies: {
    // Smart dependency loading
    loading: {
      strategy: 'lazy', // eager, lazy, dynamic
      bundling: 'split', // bundle, split, hybrid
      treeShaking: true,
      minification: process.env.NODE_ENV === 'production'
    },
    
    // Dependency analysis and optimization
    analysis: {
      unusedDependencies: true,
      duplicateDependencies: true,
      outdatedDependencies: true,
      vulnerabilityScanning: true
    },
    
    // Preloading strategies
    preload: {
      criticalDependencies: [
        'nunjucks',
        'chalk',
        'citty',
        'fs-extra',
        'glob'
      ],
      lazyLoadThreshold: 100 * 1024, // 100KB
      preloadWorkerCount: 2
    }
  },

  // ==========================================
  // PERFORMANCE MONITORING
  // ==========================================
  monitoring: {
    enabled: true,
    
    // Metrics collection
    metrics: {
      buildTime: true,
      memoryUsage: true,
      cpuUsage: true,
      diskIO: true,
      cacheHitRate: true,
      dependencyLoadTime: true,
      testExecutionTime: true
    },
    
    // Performance thresholds (will alert if exceeded)
    thresholds: {
      totalBuildTime: 120000, // 2 minutes
      memoryUsage: MEMORY_GB * 0.5 * 1024 * 1024 * 1024, // 50% of RAM
      cpuUsage: 80, // 80% CPU usage
      cacheHitRate: 0.70 // 70% cache hit rate minimum
    },
    
    // Reporting configuration
    reporting: {
      format: 'json', // json, text, html
      outputPath: 'reports/build-performance.json',
      includeHistorical: true,
      retentionDays: 30
    }
  },

  // ==========================================
  // BUILD PIPELINE OPTIMIZATION
  // ==========================================
  pipeline: {
    // Stage configuration for optimal parallelization
    stages: {
      prepare: {
        parallel: false,
        tasks: ['validate-environment', 'setup-cache', 'check-dependencies']
      },
      analyze: {
        parallel: true,
        tasks: ['lint', 'type-check', 'dependency-analysis']
      },
      build: {
        parallel: true,
        tasks: ['compile-source', 'process-templates', 'generate-assets']
      },
      test: {
        parallel: true,
        tasks: ['unit-tests', 'integration-tests', 'smoke-tests']
      },
      package: {
        parallel: false,
        tasks: ['bundle', 'compress', 'generate-manifest']
      }
    },
    
    // Failure handling
    failFast: false,
    retryCount: 2,
    retryDelay: 1000
  },

  // ==========================================
  // DEVELOPMENT OPTIMIZATION
  // ==========================================
  development: {
    // Hot reloading for faster development cycles
    hotReload: {
      enabled: true,
      port: 3000,
      watchPatterns: [
        'src/**/*.js',
        'templates/**/*',
        '_templates/**/*'
      ],
      debounceMs: 300,
      excludePatterns: [
        '**/*.test.js',
        '**/*.log',
        '**/node_modules/**'
      ]
    },
    
    // Development server optimization
    devServer: {
      compression: true,
      caching: true,
      sourceMap: true,
      liveReload: true
    }
  },

  // ==========================================
  // PRODUCTION OPTIMIZATION
  // ==========================================
  production: {
    // Asset optimization
    assets: {
      minification: true,
      compression: 'brotli',
      bundling: 'optimal',
      inlining: 'critical'
    },
    
    // Code splitting for better loading
    codeSplitting: {
      enabled: true,
      strategy: 'dynamic',
      chunkSize: 250 * 1024 // 250KB
    }
  }
};

export default buildConfig;