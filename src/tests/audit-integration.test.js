/**
 * Integration Tests for Enhanced Audit Integration
 * 
 * Tests the complete audit integration system including:
 * - Enhanced observability integration
 * - Audit event factory
 * - Health monitoring
 * - OpenTelemetry correlation
 * - End-to-end audit streaming
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { 
  IntegratedKGenObservability,
  EnhancedIntegratedObservability,
  AuditEventFactory,
  AuditStreamHealthMonitor,
  addAuditMetadata,
  withAuditSpan,
  getCurrentAuditURI
} from '../observability/audit-integration.js';
import { AuditStreamCoordinator } from '../observability/audit-stream-coordinator.js';

// Mock OpenTelemetry API
const mockSpan = {
  spanContext: () => ({
    traceId: 'mock-trace-123',
    spanId: 'mock-span-456',
    traceFlags: 1
  }),
  setAttributes: jest.fn(),
  addEvent: jest.fn(),
  recordException: jest.fn(),
  setStatus: jest.fn(),
  end: jest.fn()
};

const mockTrace = {
  getActiveSpan: jest.fn(() => mockSpan)
};

jest.mock('@opentelemetry/api', () => ({
  trace: mockTrace
}));

// Mock KGEN tracer
const mockTracer = {
  initialized: true,
  tracer: {
    startActiveSpan: jest.fn((name, fn) => fn(mockSpan))
  },
  auditExporter: {
    export: jest.fn()
  },
  getMetrics: jest.fn(() => ({
    spansCreated: 10,
    spansExported: 10
  }))
};

jest.mock('../observability/kgen-tracer.js', () => ({
  getKGenTracer: () => mockTracer,
  initializeTracing: jest.fn(() => mockTracer),
  shutdownTracing: jest.fn()
}));

// Mock performance validator
const mockPerformanceValidator = {
  runComprehensiveValidation: jest.fn(() => ({
    passed: true,
    coverage: 0.95,
    performance: 4.2
  })),
  getValidationSummary: jest.fn(() => ({
    overallScore: 95
  }))
};

jest.mock('../observability/performance-validator.js', () => ({
  KGenPerformanceValidator: jest.fn(() => mockPerformanceValidator)
}));

describe('Integrated KGEN Observability', () => {
  let auditDir;
  let observability;

  beforeEach(() => {
    auditDir = join(tmpdir(), `audit-obs-test-${this.getDeterministicTimestamp()}-${Math.random().toString(36).substr(2, 8)}`);
    mkdirSync(auditDir, { recursive: true });

    observability = new IntegratedKGenObservability({
      serviceName: 'test-service',
      serviceVersion: '1.0.0',
      auditDir,
      enableAuditStreaming: true,
      enableWebhooks: false
    });

    // Reset mocks
    jest.clearAllMocks();
  });

  afterEach(async () => {
    if (observability) {
      await observability.shutdown();
    }
    
    if (existsSync(auditDir)) {
      rmSync(auditDir, { recursive: true, force: true });
    }
  });

  describe('Initialization', () => {
    it('should initialize with all components', async () => {
      const initPromise = new Promise((resolve) => {
        observability.on('initialized', (data) => {
          expect(data.serviceName).toBe('test-service');
          expect(data.auditStreaming).toBe(true);
          expect(data.governanceIntegration).toBe(true);
          expect(data.immutableTrails).toBe(true);
          expect(data.openTelemetryCorrelation).toBe(true);
          resolve();
        });
      });

      await observability.initialize();
      await initPromise;

      expect(observability.initialized).toBe(true);
      expect(observability.auditCoordinator).toBeDefined();
      expect(observability.performanceValidator).toBeDefined();
    });

    it('should integrate with existing KGEN tracer', async () => {
      await observability.initialize();

      // Should have modified the audit exporter
      expect(mockTracer.auditExporter.export).toBeDefined();
      
      // Simulate span processing
      const mockSpans = [{
        spanContext: () => ({ traceId: 'test-123', spanId: 'span-456' }),
        name: 'test.operation',
        attributes: { 'test.key': 'test.value' },
        events: [],
        duration: [0, 50000000], // 50ms in nanoseconds
        status: { code: 1 }
      }];

      await mockTracer.auditExporter.export(mockSpans);

      expect(observability.integrationMetrics.totalSpansProcessed).toBe(1);
    });

    it('should handle initialization errors gracefully', async () => {
      // Mock initialization failure
      const failingObservability = new IntegratedKGenObservability({
        auditDir: '/invalid/path/that/cannot/be/created'
      });

      const errorPromise = new Promise((resolve) => {
        failingObservability.on('error', (error) => {
          expect(error).toBeDefined();
          resolve();
        });
      });

      await expect(failingObservability.initialize()).rejects.toThrow();
      await errorPromise;
    });
  });

  describe('Audit Event Processing', () => {
    beforeEach(async () => {
      await observability.initialize();
    });

    it('should process audit events with correlation', async () => {
      const auditEvent = {
        timestamp: this.getDeterministicDate().toISOString(),
        traceId: 'test-trace-123',
        spanId: 'test-span-456',
        operation: 'test.processing.operation',
        status: 'ok'
      };

      await observability._processAuditEventSafely(auditEvent);

      expect(observability.integrationMetrics.auditEventsGenerated).toBe(1);
    });

    it('should add OpenTelemetry correlation', async () => {
      const auditEvent = {
        timestamp: this.getDeterministicDate().toISOString(),
        operation: 'test.correlation.operation'
      };

      await observability._processAuditEventSafely(auditEvent);

      // Should have correlation from mock span
      expect(observability.integrationMetrics.auditEventsGenerated).toBe(1);
    });

    it('should handle processing errors and create error events', async () => {
      // Mock audit coordinator to throw error
      observability.auditCoordinator._processAuditEvent = jest.fn()
        .mockRejectedValue(new Error('Processing failed'));

      const auditEvent = {
        timestamp: this.getDeterministicDate().toISOString(),
        operation: 'failing.operation'
      };

      // Should not throw despite internal error
      await expect(observability._processAuditEventSafely(auditEvent)).resolves.not.toThrow();
      
      expect(observability.integrationMetrics.integrationErrors).toBe(1);
    });
  });

  describe('Enhanced Audit API', () => {
    beforeEach(async () => {
      await observability.initialize();
    });

    it('should query audit events through integration', async () => {
      // Mock the audit coordinator query
      observability.auditCoordinator.queryEvents = jest.fn().mockResolvedValue([
        { operation: 'test.query.operation', timestamp: this.getDeterministicDate().toISOString() }
      ]);

      const results = await observability.queryAuditEvents({
        operation: 'test.query.operation'
      });

      expect(results).toHaveLength(1);
      expect(observability.integrationMetrics.queryRequests).toBe(1);
    });

    it('should create audit streams', async () => {
      observability.auditCoordinator.createStream = jest.fn()
        .mockResolvedValue('audit://streams/test-stream-123');

      const streamURI = await observability.createAuditStream('test-stream', {
        filters: [{ operation: 'test.*' }]
      });

      expect(streamURI).toBe('audit://streams/test-stream-123');
    });

    it('should replay audit sessions', async () => {
      const mockReplayData = {
        sessionId: 'test-session-123',
        eventCount: 50,
        operations: { 'test.operation': { count: 25 } }
      };

      observability.auditCoordinator.replaySession = jest.fn()
        .mockResolvedValue(mockReplayData);

      const result = await observability.replayAuditSession(
        'test-session-123',
        this.getDeterministicDate().toISOString()
      );

      expect(result.sessionId).toBe('test-session-123');
      expect(observability.integrationMetrics.replaySessions).toBe(1);
    });

    it('should register audit webhooks', async () => {
      const webhookConfig = {
        url: 'https://example.com/webhook',
        filters: [{ operation: 'important.*' }]
      };

      observability.auditCoordinator.webhookStreamer = {
        registerWebhook: jest.fn().mockReturnValue('audit://webhooks/webhook-123')
      };

      const webhookURI = observability.registerAuditWebhook(webhookConfig);
      expect(webhookURI).toBe('audit://webhooks/webhook-123');
    });
  });

  describe('Comprehensive Metrics', () => {
    beforeEach(async () => {
      await observability.initialize();
    });

    it('should provide comprehensive observability metrics', () => {
      const metrics = observability.getObservabilityMetrics();

      expect(metrics.integration).toBeDefined();
      expect(metrics.tracing).toBeDefined();
      expect(metrics.audit).toBeDefined();
      expect(metrics.governance).toBeDefined();
      expect(metrics.system).toBeDefined();

      // Integration metrics
      expect(metrics.integration.totalSpansProcessed).toBeGreaterThanOrEqual(0);
      expect(metrics.integration.auditEventsGenerated).toBeGreaterThanOrEqual(0);
      
      // System metrics
      expect(metrics.system.initialized).toBe(true);
      expect(metrics.system.uptime).toBeGreaterThan(0);
      expect(metrics.system.memoryUsage).toBeDefined();
    });

    it('should calculate streaming health', () => {
      // Simulate some errors
      observability.integrationMetrics.integrationErrors = 1;
      observability.integrationMetrics.auditEventsGenerated = 100;

      const metrics = observability.getObservabilityMetrics();
      
      expect(metrics.audit.streamingHealth).toBeDefined();
      expect(metrics.audit.streamingHealth.errorRate).toBeDefined();
      expect(metrics.audit.streamingHealth.status).toBeDefined();
    });

    it('should calculate correlation efficiency', () => {
      observability.integrationMetrics.correlationIdsMapped = 80;
      observability.integrationMetrics.auditEventsGenerated = 100;

      const metrics = observability.getObservabilityMetrics();
      
      expect(metrics.audit.correlationEfficiency).toBeDefined();
      expect(metrics.audit.correlationEfficiency.correlationRate).toBe('80.00%');
      expect(metrics.audit.correlationEfficiency.status).toBe('good');
    });
  });

  describe('Health Status', () => {
    beforeEach(async () => {
      await observability.initialize();
    });

    it('should provide comprehensive health status', () => {
      const health = observability.getHealthStatus();

      expect(health.status).toBe('healthy');
      expect(health.checks.initialized).toBe(true);
      expect(health.checks.auditStreaming).toBeDefined();
      expect(health.checks.immutableTrails).toBeDefined();
      expect(health.checks.governanceIntegration).toBeDefined();
      expect(health.checks.openTelemetryCorrelation).toBeDefined();

      expect(health.metrics.spansProcessed).toBeGreaterThanOrEqual(0);
      expect(health.metrics.auditEvents).toBeGreaterThanOrEqual(0);
      expect(health.metrics.governanceEvents).toBeGreaterThanOrEqual(0);

      expect(health.audit.streamingHealth).toBeDefined();
      expect(health.audit.trailIntegrity).toBeDefined();
      expect(health.audit.correlationEfficiency).toBeDefined();
    });

    it('should detect unhealthy states', () => {
      // Simulate high error rate
      observability.integrationMetrics.integrationErrors = 50;
      observability.integrationMetrics.totalSpansProcessed = 100;

      const health = observability.getHealthStatus();

      expect(health.checks.errorRate).toBe(false); // Above 1% threshold
      expect(health.metrics.errorRate).toBe('50.00%');
    });
  });
});

describe('Enhanced Integrated Observability', () => {
  let auditDir;
  let enhancedObs;

  beforeEach(() => {
    auditDir = join(tmpdir(), `enhanced-obs-test-${this.getDeterministicTimestamp()}`);
    mkdirSync(auditDir, { recursive: true });

    enhancedObs = new EnhancedIntegratedObservability({
      serviceName: 'enhanced-test-service',
      serviceVersion: '2.0.0',
      auditDir,
      enableAuditStreaming: true
    });
  });

  afterEach(async () => {
    if (enhancedObs) {
      await enhancedObs.shutdown();
    }
    
    if (existsSync(auditDir)) {
      rmSync(auditDir, { recursive: true, force: true });
    }
  });

  describe('Enhanced Features', () => {
    it('should initialize with event factory and health monitor', async () => {
      await enhancedObs.initialize();

      expect(enhancedObs.eventFactory).toBeDefined();
      expect(enhancedObs.healthMonitor).toBeDefined();
    });

    it('should emit audit events through factory', async () => {
      await enhancedObs.initialize();

      const auditEvent = await enhancedObs.emitAuditEvent('test.factory.operation', {
        'test.attribute': 'test.value'
      });

      expect(auditEvent.operation).toBe('test.factory.operation');
      expect(auditEvent.attributes['kgen.service.name']).toBe('enhanced-test-service');
      expect(auditEvent.attributes['test.attribute']).toBe('test.value');
    });

    it('should provide comprehensive health check', async () => {
      await enhancedObs.initialize();

      // Mock health monitor
      enhancedObs.healthMonitor.runHealthCheck = jest.fn().mockResolvedValue({
        healthy: true,
        checks: {
          auditCoordinator: { healthy: true },
          webhookStreamer: { healthy: true },
          jsonlWriter: { healthy: true },
          queryEngine: { healthy: true },
          systemResources: { healthy: true }
        },
        summary: {
          overallScore: '100.0%',
          status: 'excellent'
        }
      });

      const health = await enhancedObs.getComprehensiveHealth();

      expect(health.status).toBe('healthy');
      expect(health.auditStreaming).toBeDefined();
      expect(health.auditStreaming.healthy).toBe(true);
      expect(health.auditStreaming.summary.status).toBe('excellent');
    });
  });
});

describe('Audit Event Factory', () => {
  let factory;

  beforeEach(() => {
    factory = new AuditEventFactory('test-service', '1.0.0');
  });

  it('should create standardized audit events', () => {
    const event = factory.createEvent('test.operation', {
      'custom.attribute': 'custom.value'
    });

    expect(event.operation).toBe('test.operation');
    expect(event.status).toBe('ok');
    expect(event.attributes['kgen.service.name']).toBe('test-service');
    expect(event.attributes['kgen.service.version']).toBe('1.0.0');
    expect(event.attributes['custom.attribute']).toBe('custom.value');
    expect(event.traceId).toBe('mock-trace-123');
    expect(event.spanId).toBe('mock-span-456');
  });

  it('should create governance events with special attributes', () => {
    const event = factory.createGovernanceEvent(
      'data.access',
      'personal',
      'high',
      { 'user.id': '12345' }
    );

    expect(event.operation).toBe('data.access');
    expect(event.attributes['kgen.governance.dataType']).toBe('personal');
    expect(event.attributes['kgen.governance.riskLevel']).toBe('high');
    expect(event.attributes['kgen.governance.event']).toBe(true);
    expect(event.attributes['user.id']).toBe('12345');
  });

  it('should create performance events', () => {
    const metrics = {
      duration: 150,
      memory: 1024000,
      cpu: 0.75
    };

    const event = factory.createPerformanceEvent('performance.test', metrics);

    expect(event.attributes['kgen.performance.duration']).toBe(150);
    expect(event.attributes['kgen.performance.memory']).toBe(1024000);
    expect(event.attributes['kgen.performance.cpu']).toBe(0.75);
    expect(event.attributes['kgen.performance.event']).toBe(true);
  });

  it('should create security events with appropriate status', () => {
    const highSeverityEvent = factory.createSecurityEvent(
      'security.breach',
      'high',
      { 'attack.type': 'injection' }
    );

    expect(highSeverityEvent.status).toBe('error');
    expect(highSeverityEvent.attributes['kgen.security.severity']).toBe('high');

    const lowSeverityEvent = factory.createSecurityEvent(
      'security.warning',
      'low'
    );

    expect(lowSeverityEvent.status).toBe('ok');
    expect(lowSeverityEvent.attributes['kgen.security.severity']).toBe('low');
  });
});

describe('Audit Stream Health Monitor', () => {
  let healthMonitor;
  let mockCoordinator;

  beforeEach(() => {
    mockCoordinator = {
      initialized: true,
      getMetrics: jest.fn(() => ({
        coordinator: { 
          eventsProcessed: 1000,
          integrationErrors: 5
        }
      })),
      webhookStreamer: {
        metrics: {
          eventsStreamed: 500,
          activeConnections: 10,
          errors: 2
        }
      },
      jsonlWriter: {
        eventCount: 1000,
        sequenceNumber: 1000
      },
      queryEngine: {
        metricsCollector: {
          getMetricsSummary: jest.fn(() => ({
            queriesExecuted: 100,
            averageQueryTime: 50,
            cacheHitRate: 0.8,
            errorRate: 0.5
          }))
        }
      }
    };

    healthMonitor = new AuditStreamHealthMonitor(mockCoordinator);
  });

  it('should run comprehensive health check', async () => {
    const health = await healthMonitor.runHealthCheck();

    expect(health.healthy).toBe(true);
    expect(health.checks.auditCoordinator).toBeDefined();
    expect(health.checks.webhookStreamer).toBeDefined();
    expect(health.checks.jsonlWriter).toBeDefined();
    expect(health.checks.queryEngine).toBeDefined();
    expect(health.checks.systemResources).toBeDefined();

    expect(health.summary.overallScore).toBeDefined();
    expect(health.summary.status).toBeDefined();
  });

  it('should detect high error rates', async () => {
    // Simulate high error rate
    mockCoordinator.getMetrics = jest.fn(() => ({
      coordinator: { 
        eventsProcessed: 100,
        integrationErrors: 10 // 10% error rate
      }
    }));

    const health = await healthMonitor.runHealthCheck();

    expect(health.checks.auditCoordinator.healthy).toBe(false);
    expect(health.checks.auditCoordinator.message).toContain('High error rate');
    expect(health.alerts).toContainEqual(
      expect.objectContaining({
        component: 'auditCoordinator',
        severity: 'medium'
      })
    );
  });

  it('should check webhook streamer health', async () => {
    const health = await healthMonitor.runHealthCheck();

    expect(health.checks.webhookStreamer.healthy).toBe(true);
    expect(health.checks.webhookStreamer.activeConnections).toBe(10);
    expect(health.checks.webhookStreamer.eventsStreamed).toBe(500);
  });

  it('should monitor system resources', async () => {
    const health = await healthMonitor.runHealthCheck();

    expect(health.checks.systemResources.healthy).toBe(true);
    expect(health.checks.systemResources.memoryUsage).toBeDefined();
    expect(health.checks.systemResources.cpuUsage).toBeDefined();
    expect(health.checks.systemResources.uptime).toBeDefined();
  });

  it('should generate appropriate alerts for unhealthy components', async () => {
    // Simulate unhealthy coordinator
    mockCoordinator.initialized = false;

    const health = await healthMonitor.runHealthCheck();

    expect(health.healthy).toBe(false);
    expect(health.alerts.length).toBeGreaterThan(0);
    
    const coordinatorAlert = health.alerts.find(a => a.component === 'auditCoordinator');
    expect(coordinatorAlert).toBeDefined();
    expect(coordinatorAlert.severity).toBeDefined();
  });
});

describe('Audit Metadata Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('addAuditMetadata', () => {
    it('should add audit metadata to active span', () => {
      const metadata = {
        'operation.type': 'test',
        'data.size': '1024'
      };

      const correlationId = addAuditMetadata(metadata);

      expect(mockSpan.setAttributes).toHaveBeenCalledWith(
        expect.objectContaining({
          'kgen.audit.uri': 'audit://events/mock-trace-123/mock-span-456',
          'kgen.audit.enhanced': true,
          'kgen.audit.correlationId': correlationId,
          'kgen.audit.operation.type': 'test',
          'kgen.audit.data.size': '1024'
        })
      );

      expect(mockSpan.addEvent).toHaveBeenCalledWith(
        'audit-metadata-added',
        expect.objectContaining({
          'audit.correlationId': correlationId,
          'audit.metadataCount': 2
        })
      );
    });

    it('should add governance metadata when provided', () => {
      const metadata = { 'test.key': 'test.value' };
      const options = {
        governance: {
          riskLevel: 'high',
          dataType: 'personal',
          complianceFlags: ['gdpr', 'ccpa']
        }
      };

      addAuditMetadata(metadata, options);

      expect(mockSpan.setAttributes).toHaveBeenCalledWith(
        expect.objectContaining({
          'kgen.governance.riskLevel': 'high',
          'kgen.governance.dataType': 'personal',
          'kgen.governance.complianceFlags': JSON.stringify(['gdpr', 'ccpa'])
        })
      );
    });

    it('should add performance metadata when provided', () => {
      const metadata = {};
      const options = {
        performance: {
          duration: 250,
          memory: { heap: 1024000 },
          cpu: { user: 100, system: 50 }
        }
      };

      addAuditMetadata(metadata, options);

      expect(mockSpan.setAttributes).toHaveBeenCalledWith(
        expect.objectContaining({
          'kgen.performance.duration': 250,
          'kgen.performance.memory': JSON.stringify({ heap: 1024000 }),
          'kgen.performance.cpu': JSON.stringify({ user: 100, system: 50 })
        })
      );
    });

    it('should return correlation ID', () => {
      const correlationId = addAuditMetadata({});
      
      expect(correlationId).toBeDefined();
      expect(correlationId).toMatch(/^corr-\d+-[a-z0-9]{8}$/);
    });

    it('should handle case when no active span exists', () => {
      mockTrace.getActiveSpan.mockReturnValueOnce(null);

      const correlationId = addAuditMetadata({});
      
      expect(correlationId).toBeUndefined();
      expect(mockSpan.setAttributes).not.toHaveBeenCalled();
    });
  });

  describe('withAuditSpan', () => {
    it('should create audit-aware span and execute function', async () => {
      const auditMetadata = {
        'operation.type': 'test',
        governance: { riskLevel: 'low' }
      };

      let spanReceived = null;
      let correlationReceived = null;

      const result = await withAuditSpan('test.audit.span', auditMetadata, (span, correlationId) => {
        spanReceived = span;
        correlationReceived = correlationId;
        return 'test-result';
      });

      expect(result).toBe('test-result');
      expect(spanReceived).toBe(mockSpan);
      expect(correlationReceived).toBeDefined();
      expect(mockSpan.setStatus).toHaveBeenCalledWith({ code: 1 }); // OK status
      expect(mockSpan.end).toHaveBeenCalled();
    });

    it('should handle errors in audit span', async () => {
      const auditMetadata = { 'operation.type': 'failing' };
      const testError = new Error('Test error');

      await expect(withAuditSpan('failing.span', auditMetadata, () => {
        throw testError;
      })).rejects.toThrow('Test error');

      expect(mockSpan.recordException).toHaveBeenCalledWith(testError);
      expect(mockSpan.setStatus).toHaveBeenCalledWith({ 
        code: 2, 
        message: 'Test error' 
      });
      expect(mockSpan.end).toHaveBeenCalled();
    });

    it('should work without tracer available', async () => {
      // Mock no tracer available
      const { getKGenTracer } = require('../observability/kgen-tracer.js');
      getKGenTracer.mockReturnValueOnce(null);

      const result = await withAuditSpan('no.tracer.span', {}, () => {
        return 'no-tracer-result';
      });

      expect(result).toBe('no-tracer-result');
    });
  });

  describe('getCurrentAuditURI', () => {
    it('should return audit URI for active span', () => {
      const auditURI = getCurrentAuditURI();
      
      expect(auditURI).toBe('audit://events/mock-trace-123/mock-span-456');
    });

    it('should return null when no active span', () => {
      mockTrace.getActiveSpan.mockReturnValueOnce(null);
      
      const auditURI = getCurrentAuditURI();
      
      expect(auditURI).toBeNull();
    });

    it('should return null when no tracer available', () => {
      const { getKGenTracer } = require('../observability/kgen-tracer.js');
      getKGenTracer.mockReturnValueOnce(null);

      const auditURI = getCurrentAuditURI();
      
      expect(auditURI).toBeNull();
    });
  });
});

describe('End-to-End Integration', () => {
  let auditDir;
  let observability;

  beforeEach(() => {
    auditDir = join(tmpdir(), `e2e-audit-test-${this.getDeterministicTimestamp()}`);
    mkdirSync(auditDir, { recursive: true });
  });

  afterEach(async () => {
    if (observability) {
      await observability.shutdown();
    }
    
    if (existsSync(auditDir)) {
      rmSync(auditDir, { recursive: true, force: true });
    }
  });

  it('should handle complete audit lifecycle with all features', async () => {
    observability = new EnhancedIntegratedObservability({
      serviceName: 'e2e-test-service',
      serviceVersion: '1.0.0',
      auditDir,
      enableAuditStreaming: true,
      enableWebhooks: false
    });

    await observability.initialize();

    // Simulate various types of operations
    const operations = [
      { operation: 'user.authentication', attributes: { 'user.id': '12345' } },
      { operation: 'data.access', attributes: { 'data.personal': true, 'resource.id': 'user-data-67890' } },
      { operation: 'system.configuration', attributes: { 'config.key': 'security.policy' } },
      { operation: 'performance.benchmark', attributes: { 'duration': 150, 'memory.used': 1024000 } }
    ];

    // Process all operations
    for (const op of operations) {
      await observability.emitAuditEvent(op.operation, op.attributes);
    }

    // Verify comprehensive metrics
    const metrics = observability.getObservabilityMetrics();
    
    expect(metrics.integration.auditEventsGenerated).toBe(4);
    expect(metrics.audit.streamingHealth).toBeDefined();
    expect(metrics.audit.correlationEfficiency).toBeDefined();
    expect(metrics.governance.totalEvents).toBeGreaterThanOrEqual(0);

    // Verify health status
    const health = await observability.getComprehensiveHealth();
    
    expect(health.status).toBe('healthy');
    expect(health.auditStreaming.healthy).toBe(true);
    
    // Query back the events
    const queryResults = await observability.queryAuditEvents({
      attributes: { 'data.personal': true }
    });
    
    expect(queryResults).toBeDefined();
    expect(observability.integrationMetrics.queryRequests).toBeGreaterThanOrEqual(1);
  });

  it('should maintain performance under load', async () => {
    observability = new IntegratedKGenObservability({
      serviceName: 'load-test-service',
      auditDir,
      enableAuditStreaming: true
    });

    await observability.initialize();

    const startTime = this.getDeterministicTimestamp();
    const eventCount = 1000;
    
    // Generate many events concurrently
    const eventPromises = Array.from({ length: eventCount }, (_, i) => 
      observability._processAuditEventSafely({
        timestamp: this.getDeterministicDate().toISOString(),
        traceId: `load-test-trace-${i}`,
        spanId: `load-test-span-${i}`,
        operation: 'load.test.operation',
        attributes: { 'event.number': i }
      })
    );

    await Promise.allSettled(eventPromises);
    
    const processingTime = this.getDeterministicTimestamp() - startTime;
    const throughput = eventCount / (processingTime / 1000); // events per second

    console.log(`Processed ${eventCount} events in ${processingTime}ms (${throughput.toFixed(2)} events/sec)`);

    // Verify all events were processed
    expect(observability.integrationMetrics.auditEventsGenerated).toBe(eventCount);
    expect(throughput).toBeGreaterThan(10); // At least 10 events per second
    
    // System should remain healthy
    const health = observability.getHealthStatus();
    expect(health.status).toBe('healthy');
  });
});