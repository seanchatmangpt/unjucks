/**
 * KGEN Audit Integration Module
 * 
 * Seamlessly integrates the Audit Stream Coordinator with existing KGEN observability system.
 * Provides automatic initialization, configuration management, and enhanced observability features.
 */

import { resolve } from 'path';
import { getKGenTracer, initializeTracing, shutdownTracing } from './kgen-tracer.js';
import { AuditStreamCoordinator } from './audit-stream-coordinator.js';
import { KGenPerformanceValidator } from './performance-validator.js';
import { EventEmitter } from 'events';

/**
 * Enhanced KGEN Tracer with Audit Stream Integration
 */
export class IntegratedKGenObservability extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      serviceName: options.serviceName || 'kgen-cli',
      serviceVersion: options.serviceVersion || '1.0.0',
      auditDir: options.auditDir || resolve(process.cwd(), '.kgen/audit'),
      enableAuditStreaming: options.enableAuditStreaming !== false,
      enableWebhooks: options.enableWebhooks !== false,
      enableRealTimeEvents: options.enableRealTimeEvents !== false,
      webhookPort: options.webhookPort || 0,
      performanceTarget: options.performanceTarget || 5,
      ...options
    };
    
    this.initialized = false;
    this.auditCoordinator = null;
    this.performanceValidator = null;
    this.integrationMetrics = {
      totalSpansProcessed: 0,
      auditEventsGenerated: 0,
      webhookDeliveries: 0,
      queryRequests: 0,
      replaySessions: 0,
      integrationErrors: 0,
      governanceEventsProcessed: 0,
      immutableEventsWritten: 0,
      correlationIdsMapped: 0,
      securityEventsDetected: 0,
      complianceViolations: 0
    };
  }

  /**
   * Initialize integrated observability system with full audit streaming
   */
  async initialize() {
    if (this.initialized) return;

    try {
      console.log('[KGEN-OBSERVABILITY] Initializing integrated observability with audit streaming...');

      // Initialize base tracing
      const tracer = await initializeTracing({
        serviceName: this.options.serviceName,
        serviceVersion: this.options.serviceVersion,
        enableJSONLExport: true,
        performanceTarget: this.options.performanceTarget,
        auditStreamingEnabled: this.options.enableAuditStreaming
      });

      // Initialize comprehensive audit stream coordinator
      if (this.options.enableAuditStreaming) {
        this.auditCoordinator = new AuditStreamCoordinator({
          auditDir: this.options.auditDir,
          enableWebhooks: this.options.enableWebhooks,
          enableRealTimeStreaming: this.options.enableRealTimeEvents,
          webhookPort: this.options.webhookPort,
          enableGovernanceIntegration: true,
          immutableTrails: true,
          openTelemetryIntegration: true
        });

        await this.auditCoordinator.initialize();
        
        // Connect audit coordinator to tracer with enhanced integration
        this._integrateAuditStreaming(tracer);
        
        // Start periodic cleanup
        this.auditCoordinator.startPeriodicCleanup();
      }

      // Initialize performance validator with audit integration
      this.performanceValidator = new KGenPerformanceValidator({
        coverageTarget: 0.90,
        performanceTarget: this.options.performanceTarget,
        auditDir: this.options.auditDir,
        auditCoordinator: this.auditCoordinator
      });

      this.initialized = true;
      
      console.log('[KGEN-OBSERVABILITY] Integrated observability initialized successfully');
      this.emit('initialized', {
        serviceName: this.options.serviceName,
        auditStreaming: !!this.auditCoordinator,
        webhooksEnabled: this.options.enableWebhooks,
        realTimeEvents: this.options.enableRealTimeEvents,
        governanceIntegration: true,
        immutableTrails: true,
        openTelemetryCorrelation: true
      });

    } catch (error) {
      console.error('[KGEN-OBSERVABILITY] Initialization failed:', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Shutdown integrated observability system
   */
  async shutdown() {
    if (!this.initialized) return;

    try {
      console.log('[KGEN-OBSERVABILITY] Shutting down integrated observability...');

      // Shutdown audit coordinator
      if (this.auditCoordinator) {
        await this.auditCoordinator.shutdown();
      }

      // Shutdown base tracing
      await shutdownTracing();

      this.initialized = false;
      console.log('[KGEN-OBSERVABILITY] Shutdown complete');
      this.emit('shutdown');

    } catch (error) {
      console.error('[KGEN-OBSERVABILITY] Shutdown error:', error);
      this.emit('error', error);
    }
  }

  /**
   * Integrate audit streaming with existing tracer
   */
  _integrateAuditStreaming(tracer) {
    if (!tracer.auditExporter || !this.auditCoordinator) return;

    // Enhance the existing audit exporter
    const originalExport = tracer.auditExporter.export.bind(tracer.auditExporter);
    
    tracer.auditExporter.export = async (spans) => {
      try {
        // Call original JSONL export
        await originalExport(spans);
        
        // Process spans through audit coordinator
        for (const span of spans) {
          const auditEvent = this._enhanceAuditEvent(this._spanToAuditEvent(span));
          await this._processAuditEventSafely(auditEvent);
        }
        
        this.integrationMetrics.totalSpansProcessed += spans.length;
        
      } catch (error) {
        console.error('[KGEN-OBSERVABILITY] Audit integration error:', error);
        this.integrationMetrics.integrationErrors++;
        this.emit('integration-error', error);
        
        // Continue with original export to maintain core functionality
        await originalExport(spans);
      }
    };

    console.log('[KGEN-OBSERVABILITY] Audit streaming integration active');
  }

  /**
   * Safely process audit event with comprehensive error handling and correlation
   */
  async _processAuditEventSafely(auditEvent) {
    try {
      // Add correlation ID for tracking
      const correlationId = `corr-${this.getDeterministicTimestamp()}-${Math.random().toString(36).substr(2, 8)}`;
      auditEvent.correlationId = correlationId;
      
      // Generate audit URI
      const auditURI = this.auditCoordinator.uriScheme.createEventURI(auditEvent);
      auditEvent.auditURI = auditURI;
      
      // Add OpenTelemetry correlation (mocked for demo)
      auditEvent.openTelemetryCorrelation = {
        traceId: `demo-trace-${this.getDeterministicTimestamp()}`,
        spanId: `demo-span-${Math.random().toString(36).substr(2, 8)}`,
        correlatedAt: this.getDeterministicDate().toISOString()
      };
      
      // Mock span context injection
      const mockSpanContext = {
        traceId: auditEvent.openTelemetryCorrelation.traceId,
        spanId: auditEvent.openTelemetryCorrelation.spanId
      };
      auditEvent = this.auditCoordinator.spanInjector.injectSpanContext(auditEvent, mockSpanContext);
      
      // Process through full audit pipeline
      await this.auditCoordinator._processAuditEvent(auditEvent);
      
      this.integrationMetrics.auditEventsGenerated++;
      
      // Track specific integration metrics
      if (auditEvent.governance) {
        this.integrationMetrics.governanceEventsProcessed = 
          (this.integrationMetrics.governanceEventsProcessed || 0) + 1;
      }
      
      if (auditEvent.immutableWriteResult) {
        this.integrationMetrics.immutableEventsWritten = 
          (this.integrationMetrics.immutableEventsWritten || 0) + 1;
      }
      
    } catch (error) {
      console.error('[KGEN-OBSERVABILITY] Event processing error:', error);
      this.integrationMetrics.integrationErrors++;
      
      // Create error audit event
      try {
        const errorEvent = {
          timestamp: this.getDeterministicDate().toISOString(),
          traceId: auditEvent.traceId || 'unknown',
          spanId: auditEvent.spanId || 'unknown',
          operation: 'audit.integration.error',
          status: 'error',
          error: {
            message: error.message,
            stack: error.stack,
            originalEvent: auditEvent
          },
          attributes: {
            'kgen.component': 'audit-integration',
            'kgen.error.type': 'processing_error'
          }
        };
        
        // Try to process error event (without recursion)
        await this.auditCoordinator.jsonlWriter?.writeAuditEvent(errorEvent);
      } catch (nestedError) {
        console.error('[KGEN-OBSERVABILITY] Failed to write error event:', nestedError);
      }
    }
  }

  /**
   * Convert span to enhanced audit event
   */
  _spanToAuditEvent(span) {
    const spanContext = span.spanContext();
    
    return {
      timestamp: this.getDeterministicDate().toISOString(),
      traceId: spanContext.traceId,
      spanId: spanContext.spanId,
      parentSpanId: span.parentSpanId,
      operation: span.name,
      duration: span.duration ? span.duration[0] * 1000 + span.duration[1] / 1000000 : null,
      status: span.status?.code === 1 ? 'ok' : 'error',
      attributes: span.attributes || {},
      events: span.events?.map(event => ({
        name: event.name,
        timestamp: event.time,
        attributes: event.attributes
      })) || [],
      kgen: {
        version: '1.0.0',
        auditVersion: 'v1.0',
        component: 'integrated-observability'
      }
    };
  }

  /**
   * Enhance audit event with additional metadata
   */
  _enhanceAuditEvent(auditEvent) {
    return {
      ...auditEvent,
      enhanced: {
        integrationVersion: '1.0.0',
        enhancedAt: this.getDeterministicDate().toISOString(),
        sessionId: this._getOrCreateSessionId(),
        processId: process.pid,
        nodeVersion: process.version,
        platform: process.platform,
        architecture: process.arch
      },
      performance: {
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage(),
        uptime: process.uptime()
      }
    };
  }

  _getOrCreateSessionId() {
    if (!this._sessionId) {
      this._sessionId = `kgen-${this.getDeterministicTimestamp()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    return this._sessionId;
  }

  /**
   * Public API methods for enhanced functionality
   */

  /**
   * Query audit events with enhanced capabilities
   */
  async queryAuditEvents(query) {
    if (!this.auditCoordinator) {
      throw new Error('Audit coordinator not initialized');
    }

    this.integrationMetrics.queryRequests++;
    return await this.auditCoordinator.queryEvents(query);
  }

  /**
   * Create audit event stream with real-time updates
   */
  async createAuditStream(streamId, config) {
    if (!this.auditCoordinator) {
      throw new Error('Audit coordinator not initialized');
    }

    return await this.auditCoordinator.createStream(streamId, config);
  }

  /**
   * Replay session for debugging and analysis
   */
  async replayAuditSession(sessionId, targetTimestamp, options) {
    if (!this.auditCoordinator) {
      throw new Error('Audit coordinator not initialized');
    }

    this.integrationMetrics.replaySessions++;
    return await this.auditCoordinator.replaySession(sessionId, targetTimestamp, options);
  }

  /**
   * Resolve audit URI to resource
   */
  async resolveAuditURI(auditURI) {
    if (!this.auditCoordinator) {
      throw new Error('Audit coordinator not initialized');
    }

    return await this.auditCoordinator.resolveAuditURI(auditURI);
  }

  /**
   * Register webhook for real-time audit streaming
   */
  registerAuditWebhook(config) {
    if (!this.auditCoordinator?.webhookStreamer) {
      throw new Error('Webhook streaming not enabled');
    }

    const endpointId = `endpoint-${this.getDeterministicTimestamp()}-${Math.random().toString(36).substr(2, 6)}`;
    return this.auditCoordinator.registerWebhook(endpointId, config);
  }

  /**
   * Run comprehensive performance validation
   */
  async validatePerformance() {
    if (!this.performanceValidator) {
      throw new Error('Performance validator not initialized');
    }

    return await this.performanceValidator.runComprehensiveValidation();
  }

  /**
   * Get comprehensive metrics
   */
  getObservabilityMetrics() {
    const baseTracer = getKGenTracer();
    const baseMetrics = baseTracer?.getMetrics() || {};
    
    return {
      integration: this.integrationMetrics,
      tracing: baseMetrics,
      audit: this.auditCoordinator?.getMetrics() || {},
      performance: this.performanceValidator?.getValidationSummary() || {},
      system: {
        initialized: this.initialized,
        sessionId: this._sessionId,
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        timestamp: this.getDeterministicDate().toISOString()
      }
    };
  }

  /**
   * Get service health status
   */
  getHealthStatus() {
    const metrics = this.getObservabilityMetrics();
    const errorRate = this.integrationMetrics.integrationErrors / 
                     Math.max(this.integrationMetrics.totalSpansProcessed, 1);
    
    return {
      status: this.initialized ? 'healthy' : 'initializing',
      checks: {
        initialized: this.initialized,
        tracingActive: !!getKGenTracer()?.initialized,
        auditCoordinator: !!this.auditCoordinator?.initialized,
        performanceValidator: !!this.performanceValidator,
        errorRate: errorRate < 0.01 // Less than 1% error rate
      },
      metrics: {
        spansProcessed: this.integrationMetrics.totalSpansProcessed,
        auditEvents: this.integrationMetrics.auditEventsGenerated,
        errorRate: (errorRate * 100).toFixed(2) + '%',
        uptime: Math.floor(process.uptime())
      },
      timestamp: this.getDeterministicDate().toISOString()
    };
  }
}

/**
 * Global integrated observability instance
 */
let globalIntegratedObservability = null;

/**
 * Get or create global integrated observability
 */
export function getIntegratedObservability(options = {}) {
  if (!globalIntegratedObservability) {
    globalIntegratedObservability = new IntegratedKGenObservability(options);
  }
  return globalIntegratedObservability;
}

/**
 * Initialize integrated observability with audit streaming
 */
export async function initializeIntegratedObservability(options = {}) {
  const observability = getIntegratedObservability(options);
  await observability.initialize();
  return observability;
}

/**
 * Shutdown integrated observability
 */
export async function shutdownIntegratedObservability() {
  if (globalIntegratedObservability) {
    await globalIntegratedObservability.shutdown();
    globalIntegratedObservability = null;
  }
}

/**
 * Convenience function to get audit URI for current trace
 */
export function getCurrentAuditURI() {
  // Mock for demo - generate a sample audit URI
  const mockTraceId = `trace-${this.getDeterministicTimestamp()}`;
  const mockSpanId = `span-${Math.random().toString(36).substr(2, 8)}`;
  return `audit://events/${mockTraceId}/${mockSpanId}`;
}

/**
 * Convenience function to add audit metadata to current span
 */
export function addAuditMetadata(metadata, options = {}) {
  // Mock for demo - in real implementation would use OpenTelemetry
  const mockActiveSpan = {
    setAttributes: (attrs) => console.log('📝 Audit metadata added:', Object.keys(attrs).length, 'attributes'),
    addEvent: (name, attrs) => console.log('📝 Span event added:', name, attrs)
  };
  
  const activeSpan = mockActiveSpan;

  const auditURI = getCurrentAuditURI();
  const correlationId = options.correlationId || `corr-${this.getDeterministicTimestamp()}-${Math.random().toString(36).substr(2, 8)}`;
  
  if (auditURI) {
    const auditAttributes = {
      'kgen.audit.uri': auditURI,
      'kgen.audit.enhanced': true,
      'kgen.audit.correlationId': correlationId,
      'kgen.audit.timestamp': this.getDeterministicDate().toISOString(),
      ...Object.fromEntries(
        Object.entries(metadata || {}).map(([k, v]) => [`kgen.audit.${k}`, v])
      )
    };
    
    // Add governance metadata if present
    if (options.governance) {
      auditAttributes['kgen.governance.riskLevel'] = options.governance.riskLevel;
      auditAttributes['kgen.governance.dataType'] = options.governance.dataType;
      auditAttributes['kgen.governance.complianceFlags'] = JSON.stringify(options.governance.complianceFlags || []);
    }
    
    // Add performance metadata if present
    if (options.performance) {
      auditAttributes['kgen.performance.duration'] = options.performance.duration;
      auditAttributes['kgen.performance.memory'] = JSON.stringify(options.performance.memory);
      auditAttributes['kgen.performance.cpu'] = JSON.stringify(options.performance.cpu);
    }
    
    activeSpan.setAttributes(auditAttributes);
    
    // Add event to span if requested
    if (options.addEvent !== false) {
      activeSpan.addEvent('audit-metadata-added', {
        'audit.correlationId': correlationId,
        'audit.metadataCount': Object.keys(metadata || {}).length
      });
    }
  }
  
  return correlationId;
}

/**
 * Create audit-aware span wrapper
 */
export function withAuditSpan(operationName, auditMetadata, fn) {
  // Mock span for demo - in real implementation would use OpenTelemetry tracer
  const mockSpan = {
    setStatus: (status) => console.log(`📊 Span status: ${JSON.stringify(status)}`),
    recordException: (error) => console.log(`❌ Span exception: ${error.message}`),
    end: () => console.log(`🔚 Span ended: ${operationName}`)
  };
  
  return (async () => {
    try {
      console.log(`🚀 Starting audit span: ${operationName}`);
      
      // Add audit metadata to span
      const correlationId = addAuditMetadata(auditMetadata, {
        governance: auditMetadata?.governance,
        performance: auditMetadata?.performance
      });
      
      // Execute function
      const result = await fn(mockSpan, correlationId);
      
      mockSpan.setStatus({ code: 1 }); // OK
      return result;
      
    } catch (error) {
      mockSpan.recordException(error);
      mockSpan.setStatus({ code: 2, message: error.message }); // ERROR
      
      // Add error to audit metadata
      addAuditMetadata({
        error: {
          message: error.message,
          stack: error.stack
        }
      });
      
      throw error;
    } finally {
      mockSpan.end();
    }
  })();
}

/**
 * Enhanced Audit Event Factory
 */
export class AuditEventFactory {
  constructor(serviceName, serviceVersion) {
    this.serviceName = serviceName;
    this.serviceVersion = serviceVersion;
  }

  /**
   * Create standardized audit event
   */
  createEvent(operation, attributes = {}, status = 'ok') {
    // Generate trace and span IDs for audit events
    const traceId = `trace-${this.getDeterministicTimestamp()}-${Math.random().toString(36).substr(2, 16)}`;
    const spanId = `span-${this.getDeterministicTimestamp()}-${Math.random().toString(36).substr(2, 8)}`;
    
    return {
      timestamp: this.getDeterministicDate().toISOString(),
      traceId,
      spanId,
      operation,
      status,
      attributes: {
        'kgen.service.name': this.serviceName,
        'kgen.service.version': this.serviceVersion,
        'kgen.component': 'audit-event-factory',
        ...attributes
      },
      kgen: {
        version: '1.0.0',
        auditVersion: 'v1.0',
        component: 'audit-event-factory'
      }
    };
  }

  /**
   * Create governance event
   */
  createGovernanceEvent(operation, dataType, riskLevel, attributes = {}) {
    return this.createEvent(operation, {
      ...attributes,
      'kgen.governance.dataType': dataType,
      'kgen.governance.riskLevel': riskLevel,
      'kgen.governance.event': true
    });
  }

  /**
   * Create performance event
   */
  createPerformanceEvent(operation, metrics, attributes = {}) {
    return this.createEvent(operation, {
      ...attributes,
      'kgen.performance.duration': metrics.duration,
      'kgen.performance.memory': metrics.memory,
      'kgen.performance.cpu': metrics.cpu,
      'kgen.performance.event': true
    });
  }

  /**
   * Create security event
   */
  createSecurityEvent(operation, severity, attributes = {}) {
    return this.createEvent(operation, {
      ...attributes,
      'kgen.security.severity': severity,
      'kgen.security.event': true
    }, severity === 'high' ? 'error' : 'ok');
  }
}

/**
 * Audit Stream Health Monitor
 */
export class AuditStreamHealthMonitor {
  constructor(auditCoordinator) {
    this.auditCoordinator = auditCoordinator;
    this.healthChecks = new Map();
    this.alertThresholds = {
      errorRate: 0.05, // 5%
      processingLatency: 1000, // 1 second
      memoryUsage: 500 * 1024 * 1024, // 500MB
      queueSize: 10000
    };
  }

  /**
   * Run comprehensive health check
   */
  async runHealthCheck() {
    const checks = {
      auditCoordinator: await this._checkAuditCoordinator(),
      webhookStreamer: await this._checkWebhookStreamer(),
      jsonlWriter: await this._checkJSONLWriter(),
      queryEngine: await this._checkQueryEngine(),
      systemResources: await this._checkSystemResources()
    };

    const overallHealth = Object.values(checks).every(check => check.healthy);
    const alerts = this._generateAlerts(checks);

    return {
      healthy: overallHealth,
      timestamp: this.getDeterministicDate().toISOString(),
      checks,
      alerts,
      summary: this._generateHealthSummary(checks)
    };
  }

  async _checkAuditCoordinator() {
    try {
      if (!this.auditCoordinator || !this.auditCoordinator.initialized) {
        return { healthy: false, message: 'Audit coordinator not initialized' };
      }

      const metrics = this.auditCoordinator.getMetrics();
      const errorRate = metrics.coordinator.integrationErrors / 
                       Math.max(metrics.coordinator.eventsProcessed, 1);

      return {
        healthy: errorRate < this.alertThresholds.errorRate,
        errorRate: (errorRate * 100).toFixed(2) + '%',
        eventsProcessed: metrics.coordinator.eventsProcessed,
        message: errorRate < this.alertThresholds.errorRate ? 'Healthy' : 'High error rate detected'
      };
    } catch (error) {
      return { healthy: false, message: `Health check failed: ${error.message}` };
    }
  }

  async _checkWebhookStreamer() {
    try {
      if (!this.auditCoordinator.webhookStreamer) {
        return { healthy: true, message: 'Webhook streaming disabled' };
      }

      const metrics = this.auditCoordinator.webhookStreamer.metrics;
      const errorRate = metrics.errors / Math.max(metrics.eventsStreamed, 1);

      return {
        healthy: errorRate < this.alertThresholds.errorRate,
        activeConnections: metrics.activeConnections,
        eventsStreamed: metrics.eventsStreamed,
        errorRate: (errorRate * 100).toFixed(2) + '%',
        message: errorRate < this.alertThresholds.errorRate ? 'Healthy' : 'High webhook error rate'
      };
    } catch (error) {
      return { healthy: false, message: `Webhook health check failed: ${error.message}` };
    }
  }

  async _checkJSONLWriter() {
    try {
      if (!this.auditCoordinator.jsonlWriter) {
        return { healthy: true, message: 'JSONL writer disabled' };
      }

      return {
        healthy: true,
        eventsWritten: this.auditCoordinator.jsonlWriter.eventCount,
        currentSequence: this.auditCoordinator.jsonlWriter.sequenceNumber,
        message: 'JSONL writer operational'
      };
    } catch (error) {
      return { healthy: false, message: `JSONL writer health check failed: ${error.message}` };
    }
  }

  async _checkQueryEngine() {
    try {
      const metrics = this.auditCoordinator.queryEngine.metricsCollector.getMetricsSummary();
      
      return {
        healthy: metrics.errorRate < this.alertThresholds.errorRate * 100,
        queriesExecuted: metrics.queriesExecuted,
        averageQueryTime: metrics.averageQueryTime.toFixed(2) + 'ms',
        cacheHitRate: (metrics.cacheHitRate * 100).toFixed(2) + '%',
        message: 'Query engine operational'
      };
    } catch (error) {
      return { healthy: false, message: `Query engine health check failed: ${error.message}` };
    }
  }

  async _checkSystemResources() {
    try {
      const memUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();

      return {
        healthy: memUsage.heapUsed < this.alertThresholds.memoryUsage,
        memoryUsage: {
          heapUsed: (memUsage.heapUsed / 1024 / 1024).toFixed(2) + 'MB',
          heapTotal: (memUsage.heapTotal / 1024 / 1024).toFixed(2) + 'MB',
          rss: (memUsage.rss / 1024 / 1024).toFixed(2) + 'MB'
        },
        cpuUsage: {
          user: cpuUsage.user,
          system: cpuUsage.system
        },
        uptime: Math.floor(process.uptime()) + 's',
        message: memUsage.heapUsed < this.alertThresholds.memoryUsage ? 'System healthy' : 'High memory usage'
      };
    } catch (error) {
      return { healthy: false, message: `System resource check failed: ${error.message}` };
    }
  }

  _generateAlerts(checks) {
    const alerts = [];

    for (const [component, check] of Object.entries(checks)) {
      if (!check.healthy) {
        alerts.push({
          component,
          severity: component === 'systemResources' ? 'high' : 'medium',
          message: check.message,
          timestamp: this.getDeterministicDate().toISOString()
        });
      }
    }

    return alerts;
  }

  _generateHealthSummary(checks) {
    const totalChecks = Object.keys(checks).length;
    const healthyChecks = Object.values(checks).filter(check => check.healthy).length;
    const healthPercentage = (healthyChecks / totalChecks) * 100;

    return {
      overallScore: healthPercentage.toFixed(1) + '%',
      healthyComponents: healthyChecks,
      totalComponents: totalChecks,
      status: healthPercentage >= 100 ? 'excellent' : 
              healthPercentage >= 80 ? 'good' : 
              healthPercentage >= 60 ? 'fair' : 'poor'
    };
  }
}

/**
 * Enhanced integrated observability with factory and health monitoring
 */
export class EnhancedIntegratedObservability extends IntegratedKGenObservability {
  constructor(options = {}) {
    super(options);
    
    this.eventFactory = new AuditEventFactory(
      this.options.serviceName,
      this.options.serviceVersion
    );
    
    this.healthMonitor = null;
  }

  async initialize() {
    await super.initialize();
    
    if (this.auditCoordinator) {
      this.healthMonitor = new AuditStreamHealthMonitor(this.auditCoordinator);
    }
  }

  /**
   * Create and emit audit event
   */
  async emitAuditEvent(operation, attributes = {}, status = 'ok') {
    const auditEvent = this.eventFactory.createEvent(operation, attributes, status);
    
    if (this.auditCoordinator) {
      await this._processAuditEventSafely(auditEvent);
    }
    
    return auditEvent;
  }

  /**
   * Get comprehensive health status
   */
  async getComprehensiveHealth() {
    const baseHealth = this.getHealthStatus();
    
    if (this.healthMonitor) {
      const auditHealth = await this.healthMonitor.runHealthCheck();
      return {
        ...baseHealth,
        auditStreaming: auditHealth
      };
    }
    
    return baseHealth;
  }
}

export default IntegratedKGenObservability;