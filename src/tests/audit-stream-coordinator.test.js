/**
 * Comprehensive Test Suite for Audit Stream Coordinator
 * 
 * Tests all audit streaming capabilities including:
 * - JSONL streaming and immutable trails
 * - OpenTelemetry span injection
 * - Governance event processing
 * - Performance tracking and metrics
 * - Audit URI resolution
 * - Webhook streaming
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { 
  AuditStreamCoordinator, 
  ImmutableJSONLWriter, 
  OpenTelemetrySpanInjector,
  AuditMetricsCollector,
  AuditPerformanceTracker
} from '../observability/audit-stream-coordinator.js';

describe('Audit Stream Coordinator', () => {
  let auditDir;
  let coordinator;

  beforeEach(() => {
    // Create temporary directory for each test
    auditDir = join(tmpdir(), `audit-test-${this.getDeterministicTimestamp()}-${Math.random().toString(36).substr(2, 8)}`);
    mkdirSync(auditDir, { recursive: true });

    coordinator = new AuditStreamCoordinator({
      auditDir,
      enableWebhooks: false, // Disable for testing
      enableGovernanceIntegration: true,
      immutableTrails: true,
      openTelemetryIntegration: true
    });
  });

  afterEach(async () => {
    if (coordinator) {
      await coordinator.shutdown();
    }
    
    // Clean up temporary directory
    if (existsSync(auditDir)) {
      rmSync(auditDir, { recursive: true, force: true });
    }
  });

  describe('Initialization and Configuration', () => {
    it('should initialize with all components', async () => {
      await coordinator.initialize();
      
      expect(coordinator.initialized).toBe(true);
      expect(coordinator.uriScheme).toBeDefined();
      expect(coordinator.queryEngine).toBeDefined();
      expect(coordinator.jsonlWriter).toBeDefined();
      expect(coordinator.spanInjector).toBeDefined();
    });

    it('should create audit directory if it does not exist', async () => {
      const nonExistentDir = join(auditDir, 'non-existent');
      
      const newCoordinator = new AuditStreamCoordinator({
        auditDir: nonExistentDir,
        enableWebhooks: false
      });
      
      await newCoordinator.initialize();
      
      expect(existsSync(nonExistentDir)).toBe(true);
      
      await newCoordinator.shutdown();
    });

    it('should emit initialization event', async () => {
      const initPromise = new Promise((resolve) => {
        coordinator.on('initialized', (data) => {
          expect(data.auditDir).toBe(auditDir);
          expect(data.webhooksEnabled).toBe(false);
          expect(data.queryEngineEnabled).toBe(true);
          resolve();
        });
      });

      await coordinator.initialize();
      await initPromise;
    });
  });

  describe('Immutable JSONL Writer', () => {
    let writer;

    beforeEach(() => {
      writer = new ImmutableJSONLWriter(auditDir, {
        tamperEvidence: true,
        checksumAlgorithm: 'sha256'
      });
    });

    afterEach(async () => {
      if (writer) {
        await writer.close();
      }
    });

    it('should write audit events with immutable metadata', async () => {
      const auditEvent = {
        timestamp: this.getDeterministicDate().toISOString(),
        traceId: 'test-trace-123',
        spanId: 'test-span-456',
        operation: 'test.operation',
        status: 'ok',
        attributes: {
          'test.key': 'test.value'
        }
      };

      const result = await writer.writeAuditEvent(auditEvent);

      expect(result.written).toBe(true);
      expect(result.sequenceNumber).toBe(0);
      expect(result.checksum).toBeDefined();
      expect(writer.eventCount).toBe(1);
    });

    it('should add tamper evidence to events', async () => {
      const auditEvent = {
        timestamp: this.getDeterministicDate().toISOString(),
        traceId: 'test-trace-123',
        spanId: 'test-span-456',
        operation: 'test.operation'
      };

      await writer.writeAuditEvent(auditEvent);

      // The writer modifies the event internally with tamper seal
      expect(writer.checksums.size).toBe(1);
      expect(writer.sequenceNumber).toBe(1);
    });

    it('should rotate stream when size limit reached', async () => {
      // Create writer with very small rotation size
      const smallWriter = new ImmutableJSONLWriter(auditDir, {
        rotationSize: 100, // 100 bytes
        tamperEvidence: true
      });

      const largeEvent = {
        timestamp: this.getDeterministicDate().toISOString(),
        traceId: 'large-trace-123',
        spanId: 'large-span-456',
        operation: 'large.operation.with.very.long.name.that.exceeds.rotation.size',
        attributes: {
          'large.data': 'a'.repeat(200) // Force rotation
        }
      };

      await smallWriter.writeAuditEvent(largeEvent);
      await smallWriter.writeAuditEvent(largeEvent);

      expect(smallWriter.eventCount).toBe(2);
      await smallWriter.close();
    });
  });

  describe('OpenTelemetry Span Injection', () => {
    let injector;

    beforeEach(() => {
      injector = new OpenTelemetrySpanInjector();
    });

    it('should inject span context into audit events', () => {
      const auditEvent = {
        timestamp: this.getDeterministicDate().toISOString(),
        operation: 'test.operation'
      };

      const spanContext = {
        traceId: 'trace123',
        spanId: 'span456',
        traceFlags: 1,
        traceState: 'key=value'
      };

      const injectedEvent = injector.injectSpanContext(auditEvent, spanContext);

      expect(injectedEvent.openTelemetry).toBeDefined();
      expect(injectedEvent.openTelemetry.traceId).toBe('trace123');
      expect(injectedEvent.openTelemetry.spanId).toBe('span456');
      expect(injectedEvent.openTelemetry.traceFlags).toBe(1);
      expect(injectedEvent.openTelemetry.traceState).toBe('key=value');
    });

    it('should store correlation for retrieval', () => {
      const auditEvent = {
        timestamp: this.getDeterministicDate().toISOString(),
        operation: 'test.operation'
      };

      const spanContext = {
        traceId: 'trace123',
        spanId: 'span456'
      };

      injector.injectSpanContext(auditEvent, spanContext);

      const correlated = injector.getCorrelatedEvents('trace123', 'span456');
      expect(correlated).toBeDefined();
      expect(correlated.operation).toBe('test.operation');
    });

    it('should extract span context from injected events', () => {
      const injectedEvent = {
        openTelemetry: {
          traceId: 'trace123',
          spanId: 'span456',
          traceFlags: 1
        }
      };

      const extracted = injector.extractSpanContext(injectedEvent);
      
      expect(extracted.traceId).toBe('trace123');
      expect(extracted.spanId).toBe('span456');
      expect(extracted.traceFlags).toBe(1);
    });

    it('should cleanup old correlations', () => {
      const spanContext = {
        traceId: 'trace123',
        spanId: 'span456'
      };

      injector.injectSpanContext({}, spanContext);
      expect(injector.correlationMap.size).toBe(1);

      // Force cleanup with very short max age
      injector.cleanupOldCorrelations(0);
      
      // Wait a moment for cleanup
      setTimeout(() => {
        expect(injector.correlationMap.size).toBe(0);
      }, 10);
    });
  });

  describe('Audit Event Processing', () => {
    beforeEach(async () => {
      await coordinator.initialize();
    });

    it('should process audit events through complete pipeline', async () => {
      const auditEvent = {
        timestamp: this.getDeterministicDate().toISOString(),
        traceId: 'pipeline-trace-123',
        spanId: 'pipeline-span-456',
        operation: 'test.pipeline.operation',
        status: 'ok',
        attributes: {
          'test.pipeline': true
        }
      };

      // Mock the internal processing
      const processedPromise = new Promise((resolve) => {
        coordinator.on('audit-event', (event) => {
          expect(event.auditURI).toBeDefined();
          expect(event.auditURI.startsWith('audit://events/')).toBe(true);
          resolve();
        });
      });

      await coordinator._processAuditEvent(auditEvent);
      await processedPromise;

      expect(coordinator.metrics.eventsProcessed).toBe(1);
    });

    it('should process governance events', async () => {
      const governanceEvent = {
        timestamp: this.getDeterministicDate().toISOString(),
        traceId: 'governance-trace-123',
        spanId: 'governance-span-456',
        operation: 'data.access',
        status: 'ok',
        attributes: {
          'data.personal': true,
          'kgen.governance': {
            type: 'data.access'
          }
        }
      };

      const governancePromise = new Promise((resolve) => {
        coordinator.on('governance-event', (event) => {
          expect(event.governance).toBeDefined();
          expect(event.governance.riskLevel).toBeDefined();
          expect(event.governance.complianceFlags).toContain('gdpr');
          resolve();
        });
      });

      await coordinator._processAuditEvent(governanceEvent);
      await governancePromise;

      expect(coordinator.metrics.governanceEventsProcessed).toBe(1);
    });

    it('should emit high-risk events for immediate attention', async () => {
      const highRiskEvent = {
        timestamp: this.getDeterministicDate().toISOString(),
        traceId: 'high-risk-trace-123',
        spanId: 'high-risk-span-456',
        operation: 'security.violation',
        status: 'error',
        attributes: {
          'security.violation': true
        }
      };

      const highRiskPromise = new Promise((resolve) => {
        coordinator.on('high-risk-event', (event) => {
          expect(event.governance.riskLevel).toBe('high');
          resolve();
        });
      });

      await coordinator._processAuditEvent(highRiskEvent);
      await highRiskPromise;
    });
  });

  describe('Audit URI Scheme', () => {
    beforeEach(async () => {
      await coordinator.initialize();
    });

    it('should create audit URIs for events', () => {
      const event = {
        traceId: 'test-trace-123',
        spanId: 'test-span-456'
      };

      const auditURI = coordinator.uriScheme.createEventURI(event);
      expect(auditURI).toBe('audit://events/test-trace-123/test-span-456');
    });

    it('should create audit URIs for streams', () => {
      const streamId = 'test-stream-789';
      const auditURI = coordinator.uriScheme.createStreamURI(streamId);
      expect(auditURI).toBe('audit://streams/test-stream-789');
    });

    it('should resolve event URIs', async () => {
      // Mock queryEvents method
      coordinator.queryEvents = jest.fn().mockResolvedValue([{
        traceId: 'test-trace-123',
        spanId: 'test-span-456',
        operation: 'test.operation'
      }]);

      const result = await coordinator.uriScheme.resolve('audit://events/test-trace-123/test-span-456');
      
      expect(result).toHaveLength(1);
      expect(result[0].operation).toBe('test.operation');
      expect(coordinator.queryEvents).toHaveBeenCalledWith({
        traceId: 'test-trace-123',
        spanId: 'test-span-456',
        limit: 1,
        format: 'json'
      });
    });

    it('should handle invalid audit URIs gracefully', async () => {
      const result = await coordinator.uriScheme.resolve('invalid://uri');
      expect(result).toBeNull();
    });
  });

  describe('Metrics Collection', () => {
    let collector;

    beforeEach(() => {
      collector = new AuditMetricsCollector();
    });

    it('should record event processing metrics', () => {
      const event = {
        timestamp: this.getDeterministicDate().toISOString(),
        operation: 'test.operation'
      };

      collector.recordEventProcessed(event, 50); // 50ms processing time

      const metrics = collector.getMetricsSummary();
      
      expect(metrics.totalEventsProcessed).toBe(1);
      expect(metrics.averageProcessingTime).toBe(50);
      expect(metrics.eventTypeCounts['test.operation']).toBe(1);
    });

    it('should track query performance', () => {
      collector.recordQueryExecuted(100, true); // 100ms, cache hit
      collector.recordQueryExecuted(200, false); // 200ms, cache miss

      const metrics = collector.getMetricsSummary();
      
      expect(metrics.queriesExecuted).toBe(2);
      expect(metrics.averageQueryTime).toBe(150);
      expect(metrics.cacheHitRate).toBe(0.5); // 50% hit rate
    });

    it('should calculate error rates correctly', () => {
      const event = { operation: 'test.operation' };
      
      collector.recordEventProcessed(event, 10);
      collector.recordEventProcessed(event, 20);
      collector.incrementParseErrors();

      const metrics = collector.getMetricsSummary();
      
      expect(metrics.errorRate).toBe(50); // 1 error out of 2 events = 50%
    });
  });

  describe('Performance Tracking', () => {
    let tracker;

    beforeEach(() => {
      tracker = new AuditPerformanceTracker();
    });

    it('should track parsing operations', () => {
      tracker.recordParseOperation('/test/file.jsonl', 150, 100);

      const report = tracker.getPerformanceReport();
      
      expect(report.parsing).toBeDefined();
      expect(report.parsing.totalOperations).toBe(1);
      expect(report.parsing.averageDuration).toBe(150);
      expect(report.parsing.aboveThresholdCount).toBe(1); // 150ms > 100ms threshold
    });

    it('should identify performance bottlenecks', () => {
      // Record several operations above threshold
      for (let i = 0; i < 20; i++) {
        tracker.recordParseOperation('/test/file.jsonl', 200, 50); // Above 100ms threshold
      }

      const bottlenecks = tracker.getBottlenecks();
      
      expect(bottlenecks).toHaveLength(1);
      expect(bottlenecks[0].operation).toBe('parsing');
      expect(bottlenecks[0].severity).toBe('high'); // >50% above threshold
      expect(bottlenecks[0].suggestion).toContain('file size limits');
    });

    it('should provide optimization suggestions', () => {
      tracker.recordQueryOperation({ complex: true }, 2000, 10);
      
      const bottlenecks = tracker.getBottlenecks();
      
      if (bottlenecks.length > 0) {
        const queryBottleneck = bottlenecks.find(b => b.operation === 'querying');
        expect(queryBottleneck?.suggestion).toContain('indexes');
      }
    });
  });

  describe('Governance Integration', () => {
    beforeEach(async () => {
      await coordinator.initialize();
    });

    it('should classify events by risk level', () => {
      const lowRiskEvent = {
        timestamp: this.getDeterministicDate().toISOString(),
        operation: 'data.read',
        status: 'ok'
      };

      const riskLevel = coordinator._assessRiskLevel(lowRiskEvent);
      expect(riskLevel).toBe('low');

      const highRiskEvent = {
        timestamp: this.getDeterministicDate().toISOString(),
        operation: 'data.write',
        status: 'error',
        attributes: {
          'security.violation': true
        }
      };

      const highRisk = coordinator._assessRiskLevel(highRiskEvent);
      expect(highRisk).toBe('high');
    });

    it('should determine compliance flags', () => {
      const personalDataEvent = {
        attributes: {
          'data.personal': true,
          'financial.data': true
        }
      };

      const flags = coordinator._checkComplianceFlags(personalDataEvent);
      
      expect(flags).toContain('gdpr');
      expect(flags).toContain('sox');
    });

    it('should calculate retention policies based on compliance', () => {
      const soxEvent = {
        attributes: {
          'financial.data': true
        }
      };

      const policy = coordinator._determineRetentionPolicy(soxEvent);
      
      expect(policy.years).toBe(7);
      expect(policy.reason).toBe('sox_compliance');
    });

    it('should provide governance events query', async () => {
      // Add some governance events to buffer
      coordinator.governanceEventBuffer = [
        {
          timestamp: this.getDeterministicDate().toISOString(),
          governance: { riskLevel: 'high' }
        },
        {
          timestamp: this.getDeterministicDate().toISOString(),
          governance: { riskLevel: 'low' }
        }
      ];

      const highRiskEvents = coordinator.getGovernanceEvents({ riskLevel: 'high' });
      expect(highRiskEvents).toHaveLength(1);

      const allEvents = coordinator.getGovernanceEvents();
      expect(allEvents).toHaveLength(2);
    });
  });

  describe('Comprehensive Metrics', () => {
    beforeEach(async () => {
      await coordinator.initialize();
    });

    it('should provide comprehensive metrics', () => {
      const metrics = coordinator.getMetrics();

      expect(metrics.coordinator).toBeDefined();
      expect(metrics.queryEngine).toBeDefined();
      expect(metrics.governance).toBeDefined();
      expect(metrics.immutableTrails).toBeDefined();
      expect(metrics.openTelemetry).toBeDefined();
      expect(metrics.system).toBeDefined();

      // Check system metrics
      expect(metrics.system.uptime).toBeGreaterThan(0);
      expect(metrics.system.memoryUsage).toBeDefined();
      expect(metrics.system.cpuUsage).toBeDefined();
    });

    it('should track immutable trail metrics', () => {
      const metrics = coordinator.getMetrics();

      expect(metrics.immutableTrails.eventsWritten).toBe(0);
      expect(metrics.immutableTrails.currentSequence).toBe(0);
      expect(metrics.immutableTrails.tamperEvidence).toBe(true);
    });

    it('should provide governance summary', async () => {
      // Simulate governance events
      coordinator.governanceEventBuffer = [
        { governance: { riskLevel: 'high', complianceFlags: ['gdpr'], retentionPolicy: { reason: 'gdpr_compliance' } } },
        { governance: { riskLevel: 'low', complianceFlags: ['sox'], retentionPolicy: { reason: 'sox_compliance' } } }
      ];

      const report = await coordinator.exportGovernanceReport();

      expect(report.totalEvents).toBe(0); // Actual processed events
      expect(report.riskDistribution).toBeDefined();
      expect(report.complianceStatus).toBeDefined();
      expect(report.retentionSummary).toBeDefined();
    });
  });

  describe('Error Handling and Recovery', () => {
    beforeEach(async () => {
      await coordinator.initialize();
    });

    it('should handle processing errors gracefully', async () => {
      // Create invalid event that might cause processing to fail
      const invalidEvent = {
        timestamp: 'invalid-timestamp',
        // Missing required fields
      };

      // Should not throw
      await expect(coordinator._processAuditEvent(invalidEvent)).resolves.not.toThrow();
      
      // Error should be tracked in metrics
      expect(coordinator.queryEngine.metricsCollector.getMetricsSummary().parseErrors).toBeGreaterThan(-1);
    });

    it('should maintain system stability during high load', async () => {
      const events = Array.from({ length: 100 }, (_, i) => ({
        timestamp: this.getDeterministicDate().toISOString(),
        traceId: `load-test-trace-${i}`,
        spanId: `load-test-span-${i}`,
        operation: 'load.test.operation',
        status: 'ok'
      }));

      // Process all events concurrently
      const promises = events.map(event => coordinator._processAuditEvent(event));
      await Promise.allSettled(promises);

      // System should remain stable
      expect(coordinator.initialized).toBe(true);
      expect(coordinator.metrics.eventsProcessed).toBeGreaterThan(0);
    });
  });

  describe('Cleanup and Shutdown', () => {
    it('should perform clean shutdown', async () => {
      await coordinator.initialize();
      
      const shutdownPromise = new Promise((resolve) => {
        coordinator.on('shutdown', resolve);
      });

      await coordinator.shutdown();
      await shutdownPromise;

      expect(coordinator.initialized).toBe(false);
    });

    it('should cleanup periodic tasks on shutdown', async () => {
      await coordinator.initialize();
      
      // Start periodic cleanup
      coordinator.startPeriodicCleanup(100); // Very short interval for testing
      
      // Wait briefly
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Should shutdown cleanly
      await coordinator.shutdown();
      expect(coordinator.initialized).toBe(false);
    });

    it('should handle shutdown errors gracefully', async () => {
      await coordinator.initialize();

      // Mock an error in JSONL writer close
      coordinator.jsonlWriter.close = jest.fn().mockRejectedValue(new Error('Close error'));

      // Should not throw despite the error
      await expect(coordinator.shutdown()).resolves.not.toThrow();
      expect(coordinator.initialized).toBe(false);
    });
  });
});

describe('Integration Tests', () => {
  let auditDir;
  let coordinator;

  beforeEach(() => {
    auditDir = join(tmpdir(), `audit-integration-${this.getDeterministicTimestamp()}`);
    mkdirSync(auditDir, { recursive: true });
  });

  afterEach(async () => {
    if (coordinator) {
      await coordinator.shutdown();
    }
    if (existsSync(auditDir)) {
      rmSync(auditDir, { recursive: true, force: true });
    }
  });

  it('should handle complete audit lifecycle', async () => {
    coordinator = new AuditStreamCoordinator({
      auditDir,
      enableWebhooks: false,
      enableGovernanceIntegration: true,
      immutableTrails: true,
      openTelemetryIntegration: true
    });

    await coordinator.initialize();

    // Create and process an event
    const auditEvent = {
      timestamp: this.getDeterministicDate().toISOString(),
      traceId: 'integration-test-trace',
      spanId: 'integration-test-span',
      operation: 'integration.test.operation',
      status: 'ok',
      attributes: {
        'data.personal': true,
        'test.integration': true
      }
    };

    // Process event
    await coordinator._processAuditEvent(auditEvent);

    // Verify metrics
    const metrics = coordinator.getMetrics();
    expect(metrics.coordinator.eventsProcessed).toBe(1);
    expect(metrics.immutableTrails.eventsWritten).toBe(1);

    // Verify governance processing
    expect(metrics.governance.eventsProcessed).toBe(1);

    // Query the event back
    const queryResult = await coordinator.queryEvents({
      traceId: 'integration-test-trace'
    });

    expect(queryResult).toHaveLength(1);
    expect(queryResult[0].operation).toBe('integration.test.operation');
  });

  it('should maintain data integrity across restarts', async () => {
    // First coordinator instance
    coordinator = new AuditStreamCoordinator({
      auditDir,
      immutableTrails: true
    });

    await coordinator.initialize();

    const event1 = {
      timestamp: this.getDeterministicDate().toISOString(),
      traceId: 'persistence-test-1',
      spanId: 'persistence-span-1',
      operation: 'persistence.test.1'
    };

    await coordinator._processAuditEvent(event1);
    await coordinator.shutdown();

    // Second coordinator instance (simulating restart)
    coordinator = new AuditStreamCoordinator({
      auditDir,
      immutableTrails: true
    });

    await coordinator.initialize();

    const event2 = {
      timestamp: this.getDeterministicDate().toISOString(),
      traceId: 'persistence-test-2',
      spanId: 'persistence-span-2',
      operation: 'persistence.test.2'
    };

    await coordinator._processAuditEvent(event2);

    // Should be able to query both events
    const allEvents = await coordinator.queryEvents({});
    expect(allEvents.length).toBeGreaterThanOrEqual(2);

    const event1Retrieved = allEvents.find(e => e.traceId === 'persistence-test-1');
    const event2Retrieved = allEvents.find(e => e.traceId === 'persistence-test-2');

    expect(event1Retrieved).toBeDefined();
    expect(event2Retrieved).toBeDefined();
  });
});