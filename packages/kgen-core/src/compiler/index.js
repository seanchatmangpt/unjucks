/**
 * KGEN Knowledge Compiler
 * Main entry point for knowledge compilation system
 * 
 * Exports:
 * - KnowledgeCompiler: Core compilation engine
 * - SemanticProcessorBridge: Integration with existing semantic processor
 * - Examples and benchmarks for testing and demonstration
 */

// Core compiler
export { KnowledgeCompiler, default as KnowledgeCompilerDefault } from './knowledge-compiler.js';

// Integration bridge
export { SemanticProcessorBridge } from './integration/semantic-processor-bridge.js';

// Examples
export {
  compileAPIDocumentationContext,
  compileReactComponentContext,
  compileDatabaseSchemaContext,
  runKnowledgeCompilerExamples
} from './examples/knowledge-compilation-example.js';

// Benchmarks
export {
  benchmarkCompilationPerformance,
  benchmarkMemoryUsage,
  benchmarkConcurrentCompilation,
  generateSyntheticGraph,
  generateSyntheticRules
} from './benchmarks/knowledge-compiler-benchmark.js';

/**
 * Create a new knowledge compiler instance with default configuration
 */
export function createKnowledgeCompiler(config = {}) {
  const { KnowledgeCompiler } = await import('./knowledge-compiler.js');
  return new KnowledgeCompiler(config);
}

/**
 * Create a semantic processor bridge for migration
 */
export function createSemanticBridge(config = {}) {
  const { SemanticProcessorBridge } = await import('./integration/semantic-processor-bridge.js');
  return new SemanticProcessorBridge(config);
}

/**
 * Quick compilation function for simple use cases
 * @param {Object} rdfGraph - RDF knowledge graph
 * @param {Array} n3Rules - N3 reasoning rules
 * @param {Object} options - Compilation options
 * @returns {Promise<Object>} Compiled template context
 */
export async function compileKnowledge(rdfGraph, n3Rules = [], options = {}) {
  const compiler = await createKnowledgeCompiler(options);
  await compiler.initialize();
  return compiler.compileContext(rdfGraph, n3Rules, options);
}

/**
 * Migrate semantic processor data to knowledge compiler format
 * @param {string} inputPath - Path to semantic data
 * @param {string} outputPath - Path for compiled contexts
 * @param {Object} options - Migration options
 * @returns {Promise<Object>} Migration report
 */
export async function migrateSemanticData(inputPath, outputPath, options = {}) {
  const bridge = await createSemanticBridge(options);
  await bridge.initialize();
  return bridge.migrateSemanticData(inputPath, outputPath);
}

/**
 * Default configuration for different use cases
 */
export const configs = {
  // High-performance configuration for production
  production: {
    enableCaching: true,
    optimizeForTemplates: true,
    compactOutput: true,
    includeMetadata: false,
    maxRuleIterations: 100,
    reasoningTimeout: 60000
  },
  
  // Development configuration with debugging
  development: {
    enableCaching: false,
    optimizeForTemplates: true,
    compactOutput: false,
    includeMetadata: true,
    maxRuleIterations: 20,
    reasoningTimeout: 10000
  },
  
  // Testing configuration for unit tests
  testing: {
    enableCaching: false,
    optimizeForTemplates: false,
    compactOutput: false,
    includeMetadata: true,
    maxRuleIterations: 10,
    reasoningTimeout: 5000
  },
  
  // High-throughput configuration for batch processing
  batch: {
    enableCaching: true,
    optimizeForTemplates: true,
    compactOutput: true,
    includeMetadata: false,
    maxRuleIterations: 50,
    reasoningTimeout: 30000,
    enableParallelProcessing: true
  }
};

// Version information
export const version = '1.0.0';
export const description = 'KGEN Knowledge Compiler - Transform RDF graphs + N3 rules into template contexts';

// Export default compiler class
export default KnowledgeCompiler;