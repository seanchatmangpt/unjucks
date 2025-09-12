/**
 * KGEN Instrumentation Utilities
 * 
 * Provides decorators and utilities for adding OpenTelemetry instrumentation
 * to existing KGEN operations with minimal code changes
 */

import { getKGenTracer } from './kgen-tracer.js';
import { SpanStatusCode } from '@opentelemetry/api';
import { performance } from 'perf_hooks';
import crypto from 'crypto';

/**
 * Decorator to automatically instrument async functions
 */
export function traced(options = {}) {
  return function(target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function(...args) {
      const tracer = getKGenTracer();
      const spanName = options.name || `${target.constructor.name}.${propertyKey}`;
      
      const span = tracer.startSpan(spanName, {
        component: options.component || 'instrumented',
        operationType: options.operationType || propertyKey,
        attributes: {
          'kgen.method': propertyKey,
          'kgen.class': target.constructor.name,
          ...options.attributes
        }
      });
      
      try {
        const result = await originalMethod.apply(this, args);
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
        span.recordException(error);
        throw error;
      } finally {
        span.end();
      }
    };
    
    return descriptor;
  };
}

/**
 * Instrument RDF graph hash operations
 */
export function instrumentGraphHash(graphHashFn) {
  return async function(graphPath) {
    const tracer = getKGenTracer();
    
    return await tracer.traceGraphOperation('hash', graphPath, async (span) => {
      const startTime = performance.now();
      
      const result = await graphHashFn.call(this, graphPath);
      
      const duration = performance.now() - startTime;
      
      span.setAttributes({
        'kgen.graph.size': result.size || 0,
        'kgen.graph.hash': result.hash,
        'kgen.performance.duration': duration,
        'kgen.graph.semantic_mode': result._semantic ? 'enhanced' : 'fallback'
      });
      
      return result;
    });
  };
}

/**
 * Instrument RDF graph diff operations
 */
export function instrumentGraphDiff(graphDiffFn) {
  return async function(graph1, graph2) {
    const tracer = getKGenTracer();
    
    return await tracer.traceGraphOperation('diff', `${graph1}|${graph2}`, async (span) => {
      const startTime = performance.now();
      
      const result = await graphDiffFn.call(this, graph1, graph2);
      
      const duration = performance.now() - startTime;
      
      span.setAttributes({
        'kgen.graph.file1': graph1,
        'kgen.graph.file2': graph2, 
        'kgen.graph.differences': result.differences || 0,
        'kgen.graph.identical': result.identical || false,
        'kgen.performance.duration': duration
      });
      
      return result;
    });
  };
}

/**
 * Instrument RDF graph index operations
 */
export function instrumentGraphIndex(graphIndexFn) {
  return async function(graphPath) {
    const tracer = getKGenTracer();
    
    return await tracer.traceGraphOperation('index', graphPath, async (span) => {
      const startTime = performance.now();
      
      const result = await graphIndexFn.call(this, graphPath);
      
      const duration = performance.now() - startTime;
      
      span.setAttributes({
        'kgen.graph.triples': result.triples || 0,
        'kgen.graph.subjects': result.subjects || 0,
        'kgen.graph.predicates': result.predicates || 0,
        'kgen.graph.objects': result.objects || 0,
        'kgen.performance.duration': duration,
        'kgen.indexing.complexity': (result.subjects || 0) + (result.predicates || 0) + (result.objects || 0)
      });
      
      return result;
    });
  };
}

/**
 * Instrument artifact generation operations
 */
export function instrumentArtifactGenerate(artifactGenerateFn) {
  return async function(graphFile, template, options = {}) {
    const tracer = getKGenTracer();
    
    return await tracer.traceArtifactGeneration(template, options.output, async (span) => {
      const startTime = performance.now();
      
      span.setAttributes({
        'kgen.artifact.graph_file': graphFile,
        'kgen.artifact.template': template,
        'kgen.artifact.output_dir': options.output,
        'kgen.artifact.dry_run': options.dryRun || false
      });
      
      const result = await artifactGenerateFn.call(this, graphFile, template, options);
      
      const duration = performance.now() - startTime;
      
      span.setAttributes({
        'kgen.artifact.success': result.success,
        'kgen.artifact.output_path': result.outputPath,
        'kgen.artifact.content_hash': result.contentHash,
        'kgen.artifact.attested': !!result.attestationPath,
        'kgen.performance.duration': duration,
        'kgen.context.keys': result.context ? result.context.length : 0
      });
      
      // Add traceId to result for .attest.json integration
      if (result.success && result.attestationPath) {
        result.traceId = span.spanContext().traceId;
      }
      
      return result;
    });
  };
}

/**
 * Instrument template rendering operations
 */
export function instrumentTemplateRender(renderFn) {
  return async function(templatePath, context, options = {}) {
    const tracer = getKGenTracer();
    
    return await tracer.traceTemplateRender(templatePath, async (span) => {
      const startTime = performance.now();
      
      const contextHash = crypto
        .createHash('sha256')
        .update(JSON.stringify(context || {}))
        .digest('hex');
      
      span.setAttributes({
        'kgen.template.path': templatePath,
        'kgen.template.context_hash': contextHash,
        'kgen.template.context_size': JSON.stringify(context || {}).length,
        'kgen.template.rdf_content': !!options.rdfContent
      });
      
      const result = await renderFn.call(this, templatePath, context, options);
      
      const duration = performance.now() - startTime;
      
      span.setAttributes({
        'kgen.template.success': result.success,
        'kgen.template.content_hash': result.contentHash,
        'kgen.template.deterministic': result.metadata?.deterministic,
        'kgen.template.cached': result.cached || false,
        'kgen.performance.duration': duration,
        'kgen.template.output_size': result.content ? result.content.length : 0
      });
      
      return result;
    });
  };
}

/**
 * Instrument cache operations
 */
export function instrumentCacheOperation(operationType) {
  return function(cacheFn) {
    return async function(key, ...args) {
      const tracer = getKGenTracer();
      
      return await tracer.traceCacheOperation(operationType, key, async (span) => {
        const startTime = performance.now();
        
        span.setAttributes({
          'kgen.cache.key': key,
          'kgen.cache.args_count': args.length
        });
        
        const result = await cacheFn.call(this, key, ...args);
        
        const duration = performance.now() - startTime;
        const hit = operationType === 'get' && result !== undefined;
        
        span.setAttributes({
          'kgen.cache.hit': hit,
          'kgen.cache.result_size': result ? JSON.stringify(result).length : 0,
          'kgen.performance.duration': duration,
          'kgen.cache.fast_path': duration < 1 // Sub-millisecond operations
        });
        
        return result;
      });
    };
  };
}

/**
 * Instrument Git operations
 */
export function instrumentGitOperation(operationType) {
  return function(gitFn) {
    return async function(...args) {
      const tracer = getKGenTracer();
      
      return await tracer.traceGitOperation(operationType, async (span) => {
        const startTime = performance.now();
        
        span.setAttributes({
          'kgen.git.operation': operationType,
          'kgen.git.args_count': args.length
        });
        
        const result = await gitFn.call(this, ...args);
        
        const duration = performance.now() - startTime;
        
        span.setAttributes({
          'kgen.git.success': result?.success !== false,
          'kgen.performance.duration': duration,
          'kgen.git.result_type': typeof result
        });
        
        return result;
      });
    };
  };
}

/**
 * Instrument file validation operations
 */
export function instrumentValidation(validationType) {
  return function(validationFn) {
    return async function(filePath, ...args) {
      const tracer = getKGenTracer();
      
      const span = tracer.startSpan(`kgen.validation.${validationType}`, {
        component: 'validator',
        operationType: validationType,
        attributes: {
          'kgen.validation.type': validationType,
          'kgen.validation.file': filePath,
          'kgen.operation.type': 'validation'
        }
      });
      
      try {
        const startTime = performance.now();
        
        const result = await validationFn.call(this, filePath, ...args);
        
        const duration = performance.now() - startTime;
        
        span.setAttributes({
          'kgen.validation.success': result.success !== false,
          'kgen.validation.errors': result.errors ? result.errors.length : 0,
          'kgen.performance.duration': duration
        });
        
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
        
      } catch (error) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
        span.recordException(error);
        throw error;
      } finally {
        span.end();
      }
    };
  };
}

/**
 * Auto-instrument a class with all its methods
 */
export function instrumentClass(Class, options = {}) {
  const originalMethods = {};
  
  // Get all method names
  const methodNames = Object.getOwnPropertyNames(Class.prototype)
    .filter(name => {
      return name !== 'constructor' && 
             typeof Class.prototype[name] === 'function' &&
             !name.startsWith('_') && // Skip private methods
             !(options.exclude || []).includes(name);
    });
  
  // Instrument each method
  for (const methodName of methodNames) {
    originalMethods[methodName] = Class.prototype[methodName];
    
    Class.prototype[methodName] = function(...args) {
      const tracer = getKGenTracer();
      const spanName = `${Class.name}.${methodName}`;
      
      const span = tracer.startSpan(spanName, {
        component: options.component || Class.name.toLowerCase(),
        operationType: methodName,
        attributes: {
          'kgen.class': Class.name,
          'kgen.method': methodName,
          ...options.attributes
        }
      });
      
      try {
        const result = originalMethods[methodName].apply(this, args);
        
        // Handle async methods
        if (result && typeof result.then === 'function') {
          return result
            .then(value => {
              span.setStatus({ code: SpanStatusCode.OK });
              return value;
            })
            .catch(error => {
              span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
              span.recordException(error);
              throw error;
            })
            .finally(() => span.end());
        } else {
          span.setStatus({ code: SpanStatusCode.OK });
          span.end();
          return result;
        }
      } catch (error) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
        span.recordException(error);
        span.end();
        throw error;
      }
    };
  }
  
  return Class;
}

/**
 * Create span context for external systems
 */
export function createSpanContext() {
  const tracer = getKGenTracer();
  if (!tracer.tracer) return null;
  
  return tracer.tracer.startSpan('kgen.context').spanContext();
}

/**
 * Performance validation utility
 */
export function validateTracingPerformance() {
  const tracer = getKGenTracer();
  return tracer.validatePerformance();
}

/**
 * Get comprehensive tracing metrics
 */
export function getTracingMetrics() {
  const tracer = getKGenTracer();
  return tracer.getMetrics();
}