/**
 * KGEN Templating System - Main Entry Point
 * 
 * Exports all templating components including the advanced optimization system,
 * dependency management, memoization, and hot reloading capabilities.
 * 
 * @author KGEN Advanced Enhancement Swarm - Agent #7
 * @version 2.0.0
 */

// Core templating components (existing)
export { TemplateEngine, createTemplateEngine as createBasicEngine } from './template-engine.js';
import { TemplateEngine } from './template-engine.js';
export { TemplateRenderer, createRenderer } from './renderer.js';
export { FrontmatterParser } from './frontmatter.js';
export { TemplateContext } from './context.js';

// Advanced optimization system (new)
export {
  TemplateCompilationOptimizer,
  TemplateJITCompiler,
  TemplateProfiler,
  OpCodes,
  ASTNodeType,
  OptimizationLevel,
  createTemplateOptimizer,
  createJITCompiler,
  createProfiler
} from './template-compiler.js';

// Import for internal use
import { OptimizationLevel, TemplateCompilationOptimizer } from './template-compiler.js';
import { TemplateOptimizationEngine, OptimizationMode, PerformanceTier } from './optimization-engine.js';
import { TemplateRenderer } from './renderer.js';
import { TemplateDependencyGraph, DependencyType } from './dependency-graph.js';
import { TemplateMemoizationSystem, CacheStrategy } from './memoization-system.js';
import { IncrementalTemplateProcessor, ProcessingState } from './incremental-processor.js';
import { HotTemplateReloader, ReloadMode } from './hot-reloader.js';
import { TemplateInheritanceOptimizer } from './inheritance-optimizer.js';

export {
  TemplateDependencyGraph,
  DependencyType,
  ChangeType,
  createDependencyGraph
} from './dependency-graph.js';

export {
  TemplateMemoizationSystem,
  CacheStrategy,
  CacheLevel,
  MemoScope,
  createMemoizationSystem
} from './memoization-system.js';

export {
  IncrementalTemplateProcessor,
  ProcessingState,
  ImpactLevel,
  Priority,
  createIncrementalProcessor
} from './incremental-processor.js';

export {
  HotTemplateReloader,
  ReloadMode,
  FileChangeType,
  ReloadStrategy,
  createHotReloader
} from './hot-reloader.js';

export {
  TemplateInheritanceOptimizer,
  InheritancePattern,
  OptimizationStrategy,
  BlockMergeStrategy,
  createInheritanceOptimizer
} from './inheritance-optimizer.js';

export {
  TemplateOptimizationEngine,
  OptimizationMode,
  PerformanceTier,
  createOptimizationEngine
} from './optimization-engine.js';

// Utility functions
export { createDeterministicFilters } from './deterministic-filters.js';
export { RDFFilters } from './rdf-filters.js';

/**
 * Create a fully-featured template system with all optimizations
 */
export function createAdvancedTemplateSystem(options = {}) {
  const engine = new TemplateOptimizationEngine({
    mode: options.mode || 'production',
    tier: options.tier || 'standard',
    templatesDir: options.templatesDir || '_templates',
    outputDir: options.outputDir || 'src',
    enableHotReloading: options.enableHotReloading || false,
    enableProfiling: options.enableProfiling || false,
    ...options
  });

  return {
    engine,
    
    // Convenience methods
    async initialize() {
      return await engine.initialize();
    },
    
    async start() {
      return await engine.start();
    },
    
    async stop() {
      return await engine.stop();
    },
    
    async optimize(templatePath, context = {}) {
      return await engine.optimizeTemplate(templatePath, context);
    },
    
    async optimizeBatch(templatePaths, context = {}) {
      return await engine.optimizeTemplates(templatePaths, context);
    },
    
    async processChanges(changes) {
      return await engine.processChanges(changes);
    },
    
    getMetrics() {
      return engine.getMetrics();
    },
    
    exportReport() {
      return engine.exportPerformanceReport();
    },
    
    async destroy() {
      return await engine.destroy();
    },

    // Component access
    get compiler() { return engine.compiler; },
    get dependencyGraph() { return engine.dependencyGraph; },
    get memoization() { return engine.memoizationSystem; },
    get incremental() { return engine.incrementalProcessor; },
    get hotReloader() { return engine.hotReloader; },
    get inheritance() { return engine.inheritanceOptimizer; }
  };
}

/**
 * Create a basic template system (existing functionality)
 */
export function createTemplateEngine(options = {}) {
  const renderer = new TemplateRenderer(options);
  
  return {
    renderer,
    
    // Direct methods for easy access
    render: (templatePath, context, rdfData) => 
      renderer.render(templatePath, context, rdfData),
    
    generate: (templatePath, context, rdfData) => 
      renderer.generate(templatePath, context, rdfData),
    
    writeOutput: (renderResult) => 
      renderer.writeOutput(renderResult),
    
    templateExists: (templatePath) => 
      renderer.templateExists(templatePath),
    
    listTemplates: () => 
      renderer.listTemplates(),
    
    getStats: () => 
      renderer.getStats(),
    
    reset: () => 
      renderer.reset()
  };
}

/**
 * Preset configurations for different use cases
 */
export const TemplatePresets = {
  // Development preset - fast compilation, hot reloading
  development: {
    mode: 'development',
    tier: 'standard',
    enableHotReloading: true,
    enableProfiling: true,
    optimizationLevel: OptimizationLevel.BASIC
  },

  // Production preset - maximum optimization
  production: {
    mode: 'production',
    tier: 'premium',
    enableHotReloading: false,
    enableProfiling: false,
    optimizationLevel: OptimizationLevel.MAXIMUM
  },

  // Testing preset - deterministic output
  testing: {
    mode: 'testing',
    tier: 'standard',
    enableHotReloading: false,
    enableProfiling: true,
    optimizationLevel: OptimizationLevel.ADVANCED
  },

  // High-performance preset - enterprise features
  enterprise: {
    mode: 'production',
    tier: 'enterprise',
    enableHotReloading: false,
    enableProfiling: true,
    optimizationLevel: OptimizationLevel.MAXIMUM,
    maxConcurrency: 16
  }
};

/**
 * Quick setup functions
 */
export function createDevelopmentTemplateSystem(options = {}) {
  return createAdvancedTemplateSystem({
    ...TemplatePresets.development,
    ...options
  });
}

export function createProductionTemplateSystem(options = {}) {
  return createAdvancedTemplateSystem({
    ...TemplatePresets.production,
    ...options
  });
}

export function createTestingTemplateSystem(options = {}) {
  return createAdvancedTemplateSystem({
    ...TemplatePresets.testing,
    ...options
  });
}

export function createEnterpriseTemplateSystem(options = {}) {
  return createAdvancedTemplateSystem({
    ...TemplatePresets.enterprise,
    ...options
  });
}

/**
 * Quick start - render template with minimal setup
 */
export async function renderTemplate(templatePath, context = {}, options = {}) {
  const engine = createTemplateEngine(options);
  return await engine.render(templatePath, context);
}

/**
 * Quick start - generate file from template
 */
export async function generateFromTemplate(templatePath, context = {}, options = {}) {
  const engine = createTemplateEngine(options);
  return await engine.generate(templatePath, context);
}

// Default export
export default {
  // Core classes
  TemplateEngine,
  TemplateRenderer,
  TemplateCompilationOptimizer,
  TemplateDependencyGraph,
  TemplateMemoizationSystem,
  IncrementalTemplateProcessor,
  HotTemplateReloader,
  TemplateInheritanceOptimizer,
  TemplateOptimizationEngine,
  
  // Factory functions
  createAdvancedTemplateSystem,
  createTemplateEngine,
  createDevelopmentTemplateSystem,
  createProductionTemplateSystem,
  createTestingTemplateSystem,
  createEnterpriseTemplateSystem,
  
  // Presets
  TemplatePresets,
  
  // Enums
  OptimizationLevel,
  OptimizationMode,
  PerformanceTier,
  CacheStrategy,
  ReloadMode,
  ProcessingState,
  DependencyType
};