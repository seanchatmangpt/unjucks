/**
 * KGEN OpenTelemetry Tracer Setup
 * 
 * High-performance tracing system with JSONL audit logging
 * Designed for ≤5ms p95 overhead and ≥90% coverage
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { trace, context, SpanStatusCode, SpanKind } from '@opentelemetry/api';
import { BatchSpanProcessor, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-node';
import { createWriteStream, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { performance } from 'perf_hooks';
import crypto from 'crypto';
import { getDeterministicDate, getDeterministicISOString } from '../utils/deterministic-time.js';

/**
 * JSONL Audit Bus Exporter
 * High-performance async JSONL logging for spans
 */
class JSONLAuditExporter {
  constructor(options = {}) {
    this.auditDir = options.auditDir || resolve(process.cwd(), '.kgen/audit');
    this.filename = options.filename || `kgen-trace-${getDeterministicISOString().split('T')[0]}.jsonl`;
    this.stream = null;
    this.metrics = {
      spansExported: 0,
      bytesWritten: 0,
      exportErrors: 0,
      avgExportTime: 0
    };
    
    this._ensureAuditDirectory();
    this._initializeStream();
  }

  _ensureAuditDirectory() {
    if (!existsSync(this.auditDir)) {
      mkdirSync(this.auditDir, { recursive: true });
    }
  }

  _initializeStream() {
    const auditPath = resolve(this.auditDir, this.filename);
    this.stream = createWriteStream(auditPath, { flags: 'a', encoding: 'utf8' });
    
    this.stream.on('error', (error) => {
      console.error('[KGEN-TRACE] JSONL export error:', error);
      this.metrics.exportErrors++;
    });
  }

  async export(spans) {
    const startTime = performance.now();
    
    try {
      for (const span of spans) {
        const auditRecord = this._createAuditRecord(span);
        const jsonLine = JSON.stringify(auditRecord) + '\n';
        
        this.stream.write(jsonLine);
        this.metrics.bytesWritten += jsonLine.length;
      }
      
      this.metrics.spansExported += spans.length;
      const exportTime = performance.now() - startTime;
      this.metrics.avgExportTime = (this.metrics.avgExportTime + exportTime) / 2;
      
    } catch (error) {
      this.metrics.exportErrors++;
      console.error('[KGEN-TRACE] Audit export failed:', error);
    }
  }

  _createAuditRecord(span) {
    const spanContext = span.spanContext();
    
    return {
      timestamp: getDeterministicISOString(),
      traceId: spanContext.traceId,
      spanId: spanContext.spanId,
      parentSpanId: span.parentSpanId,
      operation: span.name,
      duration: span.duration ? span.duration[0] * 1000 + span.duration[1] / 1000000 : null,
      status: span.status?.code === SpanStatusCode.OK ? 'ok' : 'error',
      attributes: {
        ...span.attributes,
        'kgen.component': span.attributes['kgen.component'],
        'kgen.operation.type': span.attributes['kgen.operation.type'],
        'kgen.resource.hash': span.attributes['kgen.resource.hash'],
        'kgen.cache.hit': span.attributes['kgen.cache.hit'],
        'kgen.performance.p95': span.attributes['kgen.performance.p95']
      },
      events: span.events?.map(event => ({
        name: event.name,
        timestamp: event.time,
        attributes: event.attributes
      })),
      kgen: {
        version: '1.0.0',
        auditVersion: 'v1.0',
        component: 'observability'
      }
    };
  }

  async shutdown() {
    if (this.stream) {
      return new Promise((resolve) => {
        this.stream.end(() => {
          console.log('[KGEN-TRACE] Audit stream closed. Exported', this.metrics.spansExported, 'spans');
          resolve();
        });
      });
    }
  }

  getMetrics() {
    return { ...this.metrics };
  }
}

/**
 * High-Performance KGEN Tracer
 * Optimized for <5ms p95 overhead
 */
class KGenTracer {
  constructor(options = {}) {
    this.serviceName = options.serviceName || 'kgen-cli';
    this.serviceVersion = options.serviceVersion || '1.0.0';
    this.environment = options.environment || process.env.NODE_ENV || 'development';
    this.enableJSONLExport = options.enableJSONLExport !== false;
    this.performanceTarget = options.performanceTarget || 5; // 5ms p95 target
    
    this.sdk = null;
    this.tracer = null;
    this.auditExporter = null;
    this.initialized = false;
    
    this.metrics = {
      totalSpans: 0,
      activeSpans: 0,
      avgSpanDuration: 0,
      p95SpanOverhead: 0,
      tracingOverhead: 0
    };

    this._setupGlobalErrorHandling();
  }

  async initialize() {
    if (this.initialized) return;

    try {
      // Create JSONL audit exporter
      if (this.enableJSONLExport) {
        this.auditExporter = new JSONLAuditExporter({
          auditDir: resolve(process.cwd(), '.kgen/audit')
        });
      }

      // Create resource with KGEN-specific attributes
      const resource = Resource.default().merge(
        new Resource({
          [SemanticResourceAttributes.SERVICE_NAME]: this.serviceName,
          [SemanticResourceAttributes.SERVICE_VERSION]: this.serviceVersion,
          [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: this.environment,
          'kgen.component': 'core',
          'kgen.instance.id': crypto.randomUUID(),
          'kgen.performance.target.p95': this.performanceTarget
        })
      );

      // Initialize Node SDK with performance optimizations
      this.sdk = new NodeSDK({
        resource,
        spanProcessor: new BatchSpanProcessor(this.auditExporter, {
          maxQueueSize: 1000,
          maxExportBatchSize: 100,
          exportTimeoutMillis: 1000,
          scheduledDelayMillis: 500
        }),
        instrumentations: [] // No auto-instrumentations for performance
      });

      this.sdk.start();
      
      // Get tracer instance
      this.tracer = trace.getTracer('kgen-tracer', this.serviceVersion);
      
      this.initialized = true;
      
      console.log('[KGEN-TRACE] Initialized with performance target:', this.performanceTarget + 'ms p95');
      
    } catch (error) {
      console.error('[KGEN-TRACE] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Create high-performance span with KGEN semantic context
   */
  startSpan(name, options = {}) {
    if (!this.initialized || !this.tracer) {
      return this._createNoOpSpan(name);
    }

    const startTime = performance.now();
    
    const span = this.tracer.startSpan(name, {
      kind: options.kind || SpanKind.INTERNAL,
      attributes: {
        'kgen.component': options.component || 'core',
        'kgen.operation.type': options.operationType || 'unknown',
        'kgen.operation.id': crypto.randomUUID(),
        'kgen.performance.start': startTime,
        ...options.attributes
      }
    });

    // Track metrics
    this.metrics.totalSpans++;
    this.metrics.activeSpans++;

    // Add performance tracking
    const originalEnd = span.end.bind(span);
    span.end = (endTime) => {
      const duration = (endTime || performance.now()) - startTime;
      
      span.setAttributes({
        'kgen.performance.duration': duration,
        'kgen.performance.overhead': duration > this.performanceTarget
      });
      
      this.metrics.activeSpans--;
      this.metrics.avgSpanDuration = (this.metrics.avgSpanDuration + duration) / 2;
      
      if (duration > this.performanceTarget) {
        this.metrics.p95SpanOverhead++;
      }
      
      return originalEnd(endTime);
    };

    return span;
  }

  /**
   * Instrument RDF graph processing operations
   */
  traceGraphOperation(operationType, graphPath, operation) {
    return this._traceWithErrorHandling(
      `kgen.graph.${operationType}`,
      {
        component: 'graph-processor',
        operationType,
        attributes: {
          'kgen.graph.path': graphPath,
          'kgen.graph.format': 'turtle',
          'kgen.operation.type': 'graph-processing'
        }
      },
      operation
    );
  }

  /**
   * Instrument template rendering operations
   */
  traceTemplateRender(templatePath, operation) {
    return this._traceWithErrorHandling(
      'kgen.template.render',
      {
        component: 'template-engine',
        operationType: 'render',
        attributes: {
          'kgen.template.path': templatePath,
          'kgen.template.engine': 'nunjucks',
          'kgen.operation.type': 'template-rendering'
        }
      },
      operation
    );
  }

  /**
   * Instrument artifact generation operations  
   */
  traceArtifactGeneration(templateId, outputPath, operation) {
    return this._traceWithErrorHandling(
      'kgen.artifact.generate',
      {
        component: 'artifact-generator', 
        operationType: 'generate',
        attributes: {
          'kgen.artifact.template': templateId,
          'kgen.artifact.output': outputPath,
          'kgen.operation.type': 'artifact-generation'
        }
      },
      operation
    );
  }

  /**
   * Instrument cache operations
   */
  traceCacheOperation(operationType, cacheKey, operation) {
    return this._traceWithErrorHandling(
      `kgen.cache.${operationType}`,
      {
        component: 'cache-manager',
        operationType,
        attributes: {
          'kgen.cache.key': cacheKey,
          'kgen.cache.operation': operationType,
          'kgen.operation.type': 'cache-operation'
        }
      },
      operation
    );
  }

  /**
   * Instrument Git operations
   */
  traceGitOperation(operationType, operation) {
    return this._traceWithErrorHandling(
      `kgen.git.${operationType}`,
      {
        component: 'git-handler',
        operationType,
        attributes: {
          'kgen.git.operation': operationType,
          'kgen.operation.type': 'git-operation'
        }
      },
      operation
    );
  }

  /**
   * Add traceId to .attest.json provenance data
   */
  enrichAttestation(attestationData, spanContext) {
    if (!attestationData || !spanContext) return attestationData;
    
    return {
      ...attestationData,
      observability: {
        traceId: spanContext.traceId,
        spanId: spanContext.spanId,
        tracedAt: getDeterministicISOString(),
        tracingVersion: '1.0.0'
      }
    };
  }

  /**
   * Generic trace wrapper with error handling
   */
  async _traceWithErrorHandling(spanName, spanOptions, operation) {
    const span = this.startSpan(spanName, spanOptions);
    
    try {
      const result = await operation(span);
      
      // Enrich result with tracing context if it's an attestation
      if (result && result.attestation) {
        result.attestation = this.enrichAttestation(result.attestation, span.spanContext());
      }
      
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
      
    } catch (error) {
      span.setStatus({ 
        code: SpanStatusCode.ERROR, 
        message: error.message 
      });
      
      span.recordException(error);
      span.setAttributes({
        'kgen.error.type': error.constructor.name,
        'kgen.error.message': error.message,
        'kgen.error.recovered': false
      });
      
      throw error;
    } finally {
      span.end();
    }
  }

  _createNoOpSpan(name) {
    return {
      spanContext: () => ({ traceId: 'noop', spanId: 'noop' }),
      setStatus: () => {},
      setAttributes: () => {},
      recordException: () => {},
      end: () => {}
    };
  }

  _setupGlobalErrorHandling() {
    process.on('uncaughtException', (error) => {
      if (this.tracer) {
        const span = this.startSpan('kgen.error.uncaught');
        span.recordException(error);
        span.setStatus({ code: SpanStatusCode.ERROR });
        span.end();
      }
    });
  }

  /**
   * Get comprehensive performance metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      audit: this.auditExporter?.getMetrics(),
      performance: {
        p95Target: this.performanceTarget,
        p95Violations: this.metrics.p95SpanOverhead,
        avgOverhead: this.metrics.avgSpanDuration,
        totalSpans: this.metrics.totalSpans,
        activeSpans: this.metrics.activeSpans
      }
    };
  }

  /**
   * Validate performance requirements
   */
  validatePerformance() {
    const violationRate = this.metrics.p95SpanOverhead / Math.max(this.metrics.totalSpans, 1);
    const avgOverhead = this.metrics.avgSpanDuration;
    
    return {
      p95Met: violationRate < 0.05, // Less than 5% violations
      avgOverheadMet: avgOverhead < this.performanceTarget,
      violationRate: violationRate * 100,
      avgOverhead,
      recommendation: violationRate > 0.05 
        ? 'Consider reducing span creation or increasing batch sizes'
        : 'Performance targets met'
    };
  }

  async shutdown() {
    if (this.auditExporter) {
      await this.auditExporter.shutdown();
    }
    
    if (this.sdk) {
      await this.sdk.shutdown();
    }
    
    const metrics = this.getMetrics();
    const performance = this.validatePerformance();
    
    console.log('[KGEN-TRACE] Shutdown complete:', {
      totalSpans: metrics.totalSpans,
      performance: performance.p95Met && performance.avgOverheadMet ? 'PASSED' : 'FAILED',
      avgOverhead: `${performance.avgOverhead.toFixed(2)}ms`
    });
    
    this.initialized = false;
  }
}

// Global tracer instance
let globalTracer = null;

/**
 * Get or create global KGEN tracer
 */
export function getKGenTracer(options = {}) {
  if (!globalTracer) {
    globalTracer = new KGenTracer(options);
  }
  return globalTracer;
}

/**
 * Initialize global tracing
 */
export async function initializeTracing(options = {}) {
  const tracer = getKGenTracer(options);
  await tracer.initialize();
  return tracer;
}

/**
 * Shutdown global tracing
 */
export async function shutdownTracing() {
  if (globalTracer) {
    await globalTracer.shutdown();
    globalTracer = null;
  }
}

export { KGenTracer };

/**
 * Get comprehensive tracing metrics (alias for getKGenTracer().getMetrics())
 */
export function getTracingMetrics() {
  const tracer = getKGenTracer();
  return tracer?.getMetrics() || {};
}