/**
 * KGEN Core - Main Entry Point
 * 
 * Provides the complete KGEN engine with all subsystems integrated
 * Exports both the orchestration engine and individual modules
 */

// Core engine orchestration
export { KGenEngine, createKGenEngine } from './engine.js';

// Core modules
export { RDFProcessor } from './rdf/index.js';
export { QueryEngine } from './query/index.js';
export { SemanticProcessor } from './semantic/processor.js';
export { ValidationEngine } from './validation/index.js';
export { ProvenanceTracker } from './provenance/tracker.js';

// Templating and rendering
export { TemplateRenderer } from './templating/renderer.js';
export { FrontmatterParser } from './templating/frontmatter.js';

// Document generation systems
export { LaTeXCompiler } from './latex/compiler.js';
export { OfficeProcessor } from './office/processors/index.js';

// Utilities and types
export { CacheManager } from './cache/index.js';
export { SecurityManager } from './security/index.js';

/**
 * Factory function to create a complete KGEN system
 * @param {Object} config - Configuration options
 * @returns {Promise<KGenEngine>} Initialized KGEN engine
 */
export async function createKGen(config = {}) {
  const engine = createKGenEngine(config);
  await engine.initialize();
  return engine;
}

/**
 * Default configuration for KGEN
 */
export const defaultConfig = {
  directories: {
    out: './dist/generated',
    state: '.kgen/state',
    cache: '.kgen/cache',
    templates: './templates',
    rules: './rules'
  },
  generate: {
    attestByDefault: true,
    engineOptions: {
      autoescape: false,
      trimBlocks: true,
      lstripBlocks: true
    }
  },
  reasoning: {
    enabled: true
  },
  drift: {
    onDrift: 'fail',
    exitCode: 3
  },
  cache: {
    gc: {
      strategy: 'lru',
      maxAge: '90d',
      maxSize: '5GB'
    }
  },
  metrics: {
    enabled: true,
    logFields: [
      'timestamp',
      'command', 
      'graphHash',
      'template',
      'filesGenerated',
      'durationMs'
    ]
  }
};