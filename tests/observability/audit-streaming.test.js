/**
 * KGEN Audit Stream Integration Tests
 * 
 * Comprehensive test suite for audit:// URI scheme, JSONL event streaming,
 * webhook integration, and event replay capabilities.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'fs';
import { EventEmitter } from 'events';

// Import modules under test
import { AuditStreamCoordinator, AuditURIScheme, AuditWebhookStreamer, AuditQueryEngine } from '../../src/observability/audit-stream-coordinator.js';
import { IntegratedKGenObservability, initializeIntegratedObservability, shutdownIntegratedObservability } from '../../src/observability/audit-integration.js';

describe('Audit Stream Integration', () => {
  let tempDir;
  let auditCoordinator;
  let integratedObservability;
  let testWebhookPort;
  
  beforeAll(async () => {
    // Create temporary directory for audit files
    tempDir = mkdtempSync(join(tmpdir(), 'kgen-audit-test-'));
    testWebhookPort = 0; // Auto-assign port for testing
    
    console.log('🔧 Test audit directory:', tempDir);
  });

  afterAll(async () => {
    // Cleanup
    if (integratedObservability) {
      await shutdownIntegratedObservability();
    }
    
    if (auditCoordinator) {
      await auditCoordinator.shutdown();
    }
    
    // Remove temp directory
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    // Reset any shared state between tests
  });

  describe('AuditURIScheme', () => {
    let uriScheme;
    let mockCoordinator;

    beforeEach(() => {
      mockCoordinator = {
        queryEvents: vitest.fn().mockResolvedValue([{ id: 'test-event' }]),
        getStream: vitest.fn().mockResolvedValue({ id: 'test-stream' }),
        getStoredQueryResult: vitest.fn().mockResolvedValue({ id: 'test-query' }),
        replaySession: vitest.fn().mockResolvedValue({ id: 'test-replay' }),
        getWebhookConfig: vitest.fn().mockResolvedValue({ id: 'test-webhook' })
      };
      
      uriScheme = new AuditURIScheme(mockCoordinator);
    });

    it('should resolve audit://events URIs correctly', async () => {
      const traceId = 'trace123';
      const spanId = 'span456';
      const auditURI = `audit://events/${traceId}/${spanId}`;
      
      const result = await uriScheme.resolve(auditURI);
      
      expect(result).toBeDefined();
      expect(mockCoordinator.queryEvents).toHaveBeenCalledWith({
        traceId,
        spanId,
        limit: 1,
        format: 'json'
      });
    });

    it('should resolve audit://streams URIs with parameters', async () => {
      const streamId = 'stream789';
      const auditURI = `audit://streams/${streamId}?since=2023-01-01&filter=component:graph`;
      
      const result = await uriScheme.resolve(auditURI);
      
      expect(result).toBeDefined();
      expect(mockCoordinator.getStream).toHaveBeenCalledWith(streamId, {
        since: '2023-01-01',
        filter: 'component:graph'
      });
    });

    it('should create event URIs correctly', () => {
      const event = {
        traceId: 'trace123',
        spanId: 'span456'
      };
      
      const auditURI = uriScheme.createEventURI(event);
      
      expect(auditURI).toBe('audit://events/trace123/span456');
    });

    it('should create stream URIs correctly', () => {
      const streamId = 'my-stream';
      const auditURI = uriScheme.createStreamURI(streamId);
      
      expect(auditURI).toBe('audit://streams/my-stream');
    });

    it('should handle invalid URIs gracefully', async () => {
      const invalidURI = 'http://invalid/uri';
      
      const result = await uriScheme.resolve(invalidURI);
      
      expect(result).toBeNull();
    });

    it('should handle unsupported schemes gracefully', async () => {
      const unsupportedURI = 'audit://unsupported/scheme';
      
      const result = await uriScheme.resolve(unsupportedURI);
      
      expect(result).toBeNull();
    });
  });

  describe('AuditWebhookStreamer', () => {
    let webhookStreamer;

    beforeEach(async () => {
      webhookStreamer = new AuditWebhookStreamer({
        port: 0, // Auto-assign
        rateLimitMax: 100,
        rateLimitWindow: 1000
      });
    });

    afterEach(async () => {
      if (webhookStreamer) {
        await webhookStreamer.stop();
      }
    });

    it('should start and stop webhook server correctly', async () => {
      const address = await webhookStreamer.start();
      
      expect(address).toBeDefined();
      expect(address.port).toBeGreaterThan(0);
      expect(webhookStreamer.server).toBeDefined();
      
      await webhookStreamer.stop();
      expect(webhookStreamer.server).toBeNull();
    });

    it('should register webhooks and return audit URIs', async () => {
      const config = {
        url: 'https://example.com/webhook',
        filters: [{ component: 'graph' }],
        headers: { 'Authorization': 'Bearer token123' }
      };
      
      const auditURI = webhookStreamer.registerWebhook('test-endpoint', config);
      
      expect(auditURI).toBe('audit://webhooks/test-endpoint');
      expect(webhookStreamer.webhooks.has('test-endpoint')).toBe(true);
      
      const registeredWebhook = webhookStreamer.webhooks.get('test-endpoint');
      expect(registeredWebhook.url).toBe(config.url);
      expect(registeredWebhook.filters).toEqual(config.filters);
    });

    it('should stream events to registered webhooks', async () => {
      // Mock the actual HTTP request
      const originalSendToWebhook = webhookStreamer._sendToWebhook;
      const mockSendToWebhook = vitest.fn().mockResolvedValue(true);
      webhookStreamer._sendToWebhook = mockSendToWebhook;
      
      // Register webhook
      webhookStreamer.registerWebhook('test-endpoint', {
        url: 'https://example.com/webhook',
        filters: []
      });
      
      // Stream test event
      const testEvent = {
        traceId: 'trace123',
        spanId: 'span456',
        operation: 'test.operation',
        attributes: { component: 'graph' }
      };
      
      await webhookStreamer.streamEvent(testEvent);
      
      expect(mockSendToWebhook).toHaveBeenCalledWith(
        expect.objectContaining({ url: 'https://example.com/webhook' }),
        testEvent
      );
      
      // Restore original method
      webhookStreamer._sendToWebhook = originalSendToWebhook;
    });

    it('should filter events based on webhook configuration', async () => {
      const mockSendToWebhook = vitest.fn().mockResolvedValue(true);
      webhookStreamer._sendToWebhook = mockSendToWebhook;
      
      // Register webhook with filter
      webhookStreamer.registerWebhook('filtered-endpoint', {
        url: 'https://example.com/webhook',
        filters: [{ 'attributes.component': 'cache' }]
      });
      
      // Test event that should NOT match filter
      const testEvent1 = {
        traceId: 'trace123',
        spanId: 'span456',
        operation: 'test.operation',
        attributes: { component: 'graph' }
      };
      
      await webhookStreamer.streamEvent(testEvent1);
      expect(mockSendToWebhook).not.toHaveBeenCalled();
      
      // Test event that SHOULD match filter
      const testEvent2 = {
        traceId: 'trace789',
        spanId: 'span012',
        operation: 'cache.operation',
        attributes: { component: 'cache' }
      };
      
      await webhookStreamer.streamEvent(testEvent2);
      expect(mockSendToWebhook).toHaveBeenCalledWith(
        expect.objectContaining({ url: 'https://example.com/webhook' }),
        testEvent2
      );
    });

    it('should track metrics correctly', async () => {
      await webhookStreamer.start();
      
      // Register webhook
      webhookStreamer.registerWebhook('metrics-test', {
        url: 'https://example.com/webhook'
      });
      
      const initialMetrics = { ...webhookStreamer.metrics };
      
      // Stream multiple events
      const mockSendToWebhook = vitest.fn().mockResolvedValue(true);
      webhookStreamer._sendToWebhook = mockSendToWebhook;
      
      for (let i = 0; i < 5; i++) {
        await webhookStreamer.streamEvent({
          traceId: `trace${i}`,
          spanId: `span${i}`,
          operation: 'test.operation'
        });
      }
      
      expect(webhookStreamer.metrics.eventsStreamed).toBe(initialMetrics.eventsStreamed + 5);
    });
  });

  describe('AuditQueryEngine', () => {
    let queryEngine;

    beforeEach(() => {
      queryEngine = new AuditQueryEngine(tempDir);
    });

    it('should create audit streams with proper configuration', async () => {
      const streamConfig = {
        filters: [{ component: 'graph' }],
        retention: '30d',
        format: 'jsonl'
      };
      
      const auditURI = await queryEngine.createStream('test-stream', streamConfig);
      
      expect(auditURI).toBe('audit://streams/test-stream');
      
      // Verify stream configuration file was created
      const streamFile = join(tempDir, 'streams', 'test-stream.json');
      expect(existsSync(streamFile)).toBe(true);
      
      const savedConfig = JSON.parse(readFileSync(streamFile, 'utf8'));
      expect(savedConfig.id).toBe('test-stream');
      expect(savedConfig.filters).toEqual(streamConfig.filters);
    });

    it('should query events with filtering', async () => {
      // Mock audit data - in real test would create actual JSONL files
      const mockParseAuditFile = vitest.fn().mockResolvedValue([
        {
          timestamp: '2023-01-01T10:00:00Z',
          traceId: 'trace1',
          spanId: 'span1',
          operation: 'graph.hash',
          attributes: { 'kgen.component': 'graph' }
        },
        {
          timestamp: '2023-01-01T10:01:00Z',
          traceId: 'trace2',
          spanId: 'span2',
          operation: 'template.render',
          attributes: { 'kgen.component': 'template' }
        }
      ]);
      
      queryEngine._parseAuditFile = mockParseAuditFile;
      queryEngine._getAuditFiles = vitest.fn().mockResolvedValue(['test.jsonl']);
      
      // Query for graph operations only
      const results = await queryEngine.queryEvents({
        component: 'graph',
        limit: 10
      });
      
      expect(results).toHaveLength(1);
      expect(results[0].operation).toBe('graph.hash');
      expect(results[0].attributes['kgen.component']).toBe('graph');
    });

    it('should replay session state correctly', async () => {
      // Mock audit events for session replay
      const mockQueryEvents = vitest.fn().mockResolvedValue([
        {
          timestamp: '2023-01-01T10:00:00Z',
          traceId: 'trace1',
          spanId: 'span1',
          operation: 'session.start',
          attributes: { 'kgen.session.id': 'session123' }
        },
        {
          timestamp: '2023-01-01T10:01:00Z',
          traceId: 'trace1',
          spanId: 'span2',
          operation: 'graph.hash',
          duration: 150,
          attributes: { 
            'kgen.session.id': 'session123',
            'kgen.resource.hash': 'abc123'
          }
        }
      ]);
      
      queryEngine.queryEvents = mockQueryEvents;
      
      const state = await queryEngine.replaySession('session123', '2023-01-01T10:02:00Z');
      
      expect(state.sessionId).toBe('session123');
      expect(state.eventCount).toBe(2);
      expect(state.operations['session.start']).toBeDefined();
      expect(state.operations['graph.hash']).toBeDefined();
      expect(state.operations['graph.hash'].totalDuration).toBe(150);
      expect(state.resources['abc123']).toBeDefined();
    });

    it('should generate query hash for caching', () => {
      const query1 = { traceId: 'trace1', component: 'graph' };
      const query2 = { traceId: 'trace1', component: 'graph' };
      const query3 = { traceId: 'trace2', component: 'graph' };
      
      const hash1 = queryEngine._generateQueryHash(query1);
      const hash2 = queryEngine._generateQueryHash(query2);
      const hash3 = queryEngine._generateQueryHash(query3);
      
      expect(hash1).toBe(hash2); // Same queries should have same hash
      expect(hash1).not.toBe(hash3); // Different queries should have different hashes
      expect(hash1).toMatch(/^[a-f0-9]{64}$/); // Should be SHA-256 hex
    });
  });

  describe('AuditStreamCoordinator Integration', () => {
    beforeEach(async () => {
      auditCoordinator = new AuditStreamCoordinator({
        auditDir: tempDir,
        enableWebhooks: true,
        enableRealTimeStreaming: true,
        webhookPort: 0
      });
      
      await auditCoordinator.initialize();
    });

    afterEach(async () => {
      if (auditCoordinator) {
        await auditCoordinator.shutdown();
        auditCoordinator = null;
      }
    });

    it('should initialize all components correctly', async () => {
      expect(auditCoordinator.initialized).toBe(true);
      expect(auditCoordinator.uriScheme).toBeInstanceOf(AuditURIScheme);
      expect(auditCoordinator.queryEngine).toBeInstanceOf(AuditQueryEngine);
      expect(auditCoordinator.webhookStreamer).toBeDefined();
    });

    it('should process audit events and emit them', async () => {
      const eventEmitted = new Promise((resolve) => {
        auditCoordinator.once('audit-event', resolve);
      });
      
      const mockSpan = {
        spanContext: () => ({
          traceId: 'trace123',
          spanId: 'span456'
        }),
        name: 'test.operation',
        duration: [0, 150000000], // 150ms in [seconds, nanoseconds]
        status: { code: 1 }, // OK
        attributes: { 'kgen.component': 'test' },
        events: []
      };
      
      await auditCoordinator._processAuditEvent(
        auditCoordinator._spanToAuditEvent(mockSpan)
      );
      
      const emittedEvent = await eventEmitted;
      expect(emittedEvent.traceId).toBe('trace123');
      expect(emittedEvent.auditURI).toBe('audit://events/trace123/span456');
    });

    it('should resolve audit URIs through coordinator', async () => {
      // Mock the query engine
      auditCoordinator.queryEngine.queryEvents = vitest.fn().mockResolvedValue([
        { id: 'test-event', traceId: 'trace123' }
      ]);
      
      const result = await auditCoordinator.resolveAuditURI('audit://events/trace123/span456');
      
      expect(result).toEqual([{ id: 'test-event', traceId: 'trace123' }]);
      expect(auditCoordinator.queryEngine.queryEvents).toHaveBeenCalledWith({
        traceId: 'trace123',
        spanId: 'span456',
        limit: 1,
        format: 'json'
      });
    });

    it('should track metrics correctly', async () => {
      const initialMetrics = auditCoordinator.getMetrics();
      
      // Process some audit events
      const mockSpan = {
        spanContext: () => ({ traceId: 'trace1', spanId: 'span1' }),
        name: 'test.operation',
        status: { code: 1 },
        attributes: {},
        events: []
      };
      
      await auditCoordinator._processAuditEvent(
        auditCoordinator._spanToAuditEvent(mockSpan)
      );
      
      const updatedMetrics = auditCoordinator.getMetrics();
      expect(updatedMetrics.coordinator.eventsProcessed).toBe(
        initialMetrics.coordinator.eventsProcessed + 1
      );
    });
  });

  describe('IntegratedKGenObservability', () => {
    beforeEach(async () => {
      integratedObservability = new IntegratedKGenObservability({
        serviceName: 'test-service',
        auditDir: tempDir,
        enableAuditStreaming: true,
        enableWebhooks: true,
        webhookPort: 0
      });
    });

    afterEach(async () => {
      if (integratedObservability?.initialized) {
        await integratedObservability.shutdown();
      }
    });

    it('should initialize integrated observability system', async () => {
      await integratedObservability.initialize();
      
      expect(integratedObservability.initialized).toBe(true);
      expect(integratedObservability.auditCoordinator).toBeDefined();
      expect(integratedObservability.performanceValidator).toBeDefined();
    });

    it('should provide health status information', async () => {
      await integratedObservability.initialize();
      
      const health = integratedObservability.getHealthStatus();
      
      expect(health.status).toBe('healthy');
      expect(health.checks.initialized).toBe(true);
      expect(health.checks.auditCoordinator).toBe(true);
      expect(health.metrics).toBeDefined();
      expect(health.timestamp).toBeDefined();
    });

    it('should provide comprehensive metrics', async () => {
      await integratedObservability.initialize();
      
      const metrics = integratedObservability.getObservabilityMetrics();
      
      expect(metrics.integration).toBeDefined();
      expect(metrics.tracing).toBeDefined();
      expect(metrics.audit).toBeDefined();
      expect(metrics.system).toBeDefined();
      expect(metrics.system.sessionId).toBeDefined();
    });

    it('should handle initialization errors gracefully', async () => {
      // Force initialization error by using invalid audit directory
      const badObservability = new IntegratedKGenObservability({
        auditDir: '/invalid/path/that/does/not/exist/and/cannot/be/created'
      });
      
      const errorEmitted = new Promise((resolve) => {
        badObservability.once('error', resolve);
      });
      
      await expect(badObservability.initialize()).rejects.toThrow();
      
      const error = await errorEmitted;
      expect(error).toBeInstanceOf(Error);
    });

    it('should provide audit functionality through public API', async () => {
      await integratedObservability.initialize();
      
      // Mock the audit coordinator query
      integratedObservability.auditCoordinator.queryEvents = vitest.fn()
        .mockResolvedValue([{ id: 'test' }]);
      
      const results = await integratedObservability.queryAuditEvents({ 
        traceId: 'trace123' 
      });
      
      expect(results).toEqual([{ id: 'test' }]);
      expect(integratedObservability.integrationMetrics.queryRequests).toBe(1);
    });

    it('should register webhooks through public API', async () => {
      await integratedObservability.initialize();
      
      const webhookConfig = {
        url: 'https://example.com/audit-webhook',
        filters: [{ component: 'graph' }]
      };
      
      const auditURI = integratedObservability.registerAuditWebhook(webhookConfig);
      
      expect(auditURI).toMatch(/^audit:\/\/webhooks\/endpoint-/);
    });
  });

  describe('End-to-End Integration', () => {
    it('should handle complete audit event lifecycle', async () => {
      // Initialize system
      const observability = new IntegratedKGenObservability({
        auditDir: tempDir,
        enableAuditStreaming: true,
        enableWebhooks: true,
        webhookPort: 0
      });
      
      await observability.initialize();
      
      // Register webhook
      const webhookURI = observability.registerAuditWebhook({
        url: 'https://example.com/test-webhook',
        filters: []
      });
      
      expect(webhookURI).toMatch(/^audit:\/\/webhooks\//);
      
      // Create audit stream
      const streamURI = await observability.createAuditStream('test-stream', {
        filters: [{ component: 'test' }],
        retention: '7d'
      });
      
      expect(streamURI).toBe('audit://streams/test-stream');
      
      // Resolve audit URI
      const resolved = await observability.resolveAuditURI(streamURI);
      expect(resolved).toBeDefined();
      
      // Get metrics
      const metrics = observability.getObservabilityMetrics();
      expect(metrics.integration.streamsCreated).toBe(1);
      
      // Cleanup
      await observability.shutdown();
    });

    it('should maintain audit event ordering and consistency', async () => {
      const observability = new IntegratedKGenObservability({
        auditDir: tempDir,
        enableAuditStreaming: true
      });
      
      await observability.initialize();
      
      // Collect emitted events
      const emittedEvents = [];
      observability.auditCoordinator.on('audit-event', (event) => {
        emittedEvents.push(event);
      });
      
      // Simulate multiple concurrent audit events
      const mockSpans = Array.from({ length: 5 }, (_, i) => ({
        spanContext: () => ({
          traceId: `trace${i}`,
          spanId: `span${i}`
        }),
        name: `operation${i}`,
        status: { code: 1 },
        attributes: { 'kgen.sequence': i },
        events: []
      }));
      
      // Process spans concurrently
      await Promise.all(
        mockSpans.map(span =>
          observability.auditCoordinator._processAuditEvent(
            observability.auditCoordinator._spanToAuditEvent(span)
          )
        )
      );
      
      // Wait for all events to be emitted
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(emittedEvents).toHaveLength(5);
      emittedEvents.forEach((event, i) => {
        expect(event.traceId).toBe(`trace${i}`);
        expect(event.auditURI).toBe(`audit://events/trace${i}/span${i}`);
      });
      
      await observability.shutdown();
    });
  });
});