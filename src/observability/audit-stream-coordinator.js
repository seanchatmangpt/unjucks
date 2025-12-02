/**
 * KGEN Audit Stream Coordinator
 * 
 * Comprehensive audit trail system with audit:// URI scheme for event addressability,
 * JSONL append-only logging, real-time webhook streaming, and event replay capabilities.
 * 
 * Integrates with existing KGEN observability system while adding dark-matter resolver
 * capabilities for complete observability and state reconstruction.
 */

import { EventEmitter } from 'events';
import { createWriteStream, createReadStream, existsSync, mkdirSync, readFileSync, statSync, appendFileSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { createHash, randomUUID, createHmac } from 'crypto';
import { performance } from 'perf_hooks';
import { getKGenTracer } from './kgen-tracer.js';
import { createServer } from 'http';
import { URL } from 'url';
import { pipeline } from 'stream/promises';
import { Transform } from 'stream';

/**
 * Audit URI Scheme Handler
 * Implements audit:// URIs for event addressability and retrieval
 */
export class AuditURIScheme {
  constructor(coordinator) {
    this.coordinator = coordinator;
    this.schemes = new Map();
    
    // Register standard audit URI schemes
    this._registerDefaultSchemes();
  }

  _registerDefaultSchemes() {
    // audit://events/[traceId]/[spanId] - Individual span events
    this.schemes.set('events', this._resolveEventURI.bind(this));
    
    // audit://streams/[streamId] - Event streams
    this.schemes.set('streams', this._resolveStreamURI.bind(this));
    
    // audit://queries/[queryId] - Stored query results
    this.schemes.set('queries', this._resolveQueryURI.bind(this));
    
    // audit://replay/[sessionId]/[timestamp] - State reconstruction
    this.schemes.set('replay', this._resolveReplayURI.bind(this));
    
    // audit://webhooks/[endpointId] - Webhook configurations
    this.schemes.set('webhooks', this._resolveWebhookURI.bind(this));
  }

  /**
   * Resolve audit:// URI to actual resource
   * @param {string} auditURI - The audit:// URI to resolve
   * @returns {Promise<Object>} Resolved resource or null
   */
  async resolve(auditURI) {
    try {
      const url = new URL(auditURI);
      if (url.protocol !== 'audit:') {
        throw new Error(`Invalid audit URI protocol: ${url.protocol}`);
      }

      const scheme = url.hostname;
      const resolver = this.schemes.get(scheme);
      
      if (!resolver) {
        throw new Error(`Unsupported audit URI scheme: ${scheme}`);
      }

      const pathSegments = url.pathname.split('/').filter(s => s);
      const queryParams = Object.fromEntries(url.searchParams);
      
      return await resolver(pathSegments, queryParams, auditURI);
      
    } catch (error) {
      console.error('[AUDIT-URI] Resolution failed:', error.message);
      return null;
    }
  }

  /**
   * Create audit URI for an event
   * @param {Object} event - The audit event
   * @returns {string} Generated audit:// URI
   */
  createEventURI(event) {
    return `audit://events/${event.traceId}/${event.spanId}`;
  }

  /**
   * Create audit URI for a stream
   * @param {string} streamId - Stream identifier
   * @returns {string} Generated audit:// URI
   */
  createStreamURI(streamId) {
    return `audit://streams/${streamId}`;
  }

  async _resolveEventURI(pathSegments, queryParams, originalURI) {
    const [traceId, spanId] = pathSegments;
    if (!traceId) {
      throw new Error('Event URI requires traceId');
    }

    return await this.coordinator.queryEvents({
      traceId,
      spanId,
      limit: queryParams.limit || 1,
      format: queryParams.format || 'json'
    });
  }

  async _resolveStreamURI(pathSegments, queryParams, originalURI) {
    const [streamId] = pathSegments;
    if (!streamId) {
      throw new Error('Stream URI requires streamId');
    }

    return await this.coordinator.getStream(streamId, {
      since: queryParams.since,
      until: queryParams.until,
      filter: queryParams.filter
    });
  }

  async _resolveQueryURI(pathSegments, queryParams, originalURI) {
    const [queryId] = pathSegments;
    return await this.coordinator.getStoredQueryResult(queryId);
  }

  async _resolveReplayURI(pathSegments, queryParams, originalURI) {
    const [sessionId, timestamp] = pathSegments;
    return await this.coordinator.replaySession(sessionId, timestamp, queryParams);
  }

  async _resolveWebhookURI(pathSegments, queryParams, originalURI) {
    const [endpointId] = pathSegments;
    return await this.coordinator.getWebhookConfig(endpointId);
  }
}

/**
 * Real-time Event Streaming via Webhooks
 */
export class AuditWebhookStreamer extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      port: options.port || 0, // Auto-assign port
      timeout: options.timeout || 30000,
      maxConnections: options.maxConnections || 100,
      rateLimitWindow: options.rateLimitWindow || 60000,
      rateLimitMax: options.rateLimitMax || 1000,
      ...options
    };
    
    this.server = null;
    this.connections = new Map();
    this.webhooks = new Map();
    this.rateLimiter = new Map();
    this.metrics = {
      totalConnections: 0,
      activeConnections: 0,
      eventsStreamed: 0,
      rateLimitViolations: 0,
      errors: 0
    };
  }

  async start() {
    if (this.server) {
      throw new Error('Webhook streamer already running');
    }

    this.server = createServer(this._handleRequest.bind(this));
    
    return new Promise((resolve, reject) => {
      this.server.listen(this.options.port, (error) => {
        if (error) {
          reject(error);
        } else {
          const address = this.server.address();
          console.log(`[AUDIT-WEBHOOKS] Started on port ${address.port}`);
          resolve(address);
        }
      });
    });
  }

  async stop() {
    if (!this.server) return;

    return new Promise((resolve) => {
      this.server.close(() => {
        console.log('[AUDIT-WEBHOOKS] Stopped');
        this.server = null;
        resolve();
      });
    });
  }

  /**
   * Register webhook endpoint
   * @param {string} endpointId - Unique endpoint identifier
   * @param {Object} config - Webhook configuration
   */
  registerWebhook(endpointId, config) {
    this.webhooks.set(endpointId, {
      id: endpointId,
      url: config.url,
      headers: config.headers || {},
      filters: config.filters || [],
      retries: config.retries || 3,
      timeout: config.timeout || 5000,
      created: this.getDeterministicDate().toISOString(),
      active: true,
      ...config
    });
    
    console.log(`[AUDIT-WEBHOOKS] Registered webhook: ${endpointId}`);
    return `audit://webhooks/${endpointId}`;
  }

  /**
   * Stream audit event to registered webhooks
   * @param {Object} auditEvent - The audit event to stream
   */
  async streamEvent(auditEvent) {
    const streamingPromises = [];

    for (const [endpointId, webhook] of this.webhooks.entries()) {
      if (!webhook.active) continue;

      // Apply filters
      if (webhook.filters.length > 0) {
        const passesFilter = webhook.filters.some(filter => 
          this._eventMatchesFilter(auditEvent, filter)
        );
        if (!passesFilter) continue;
      }

      // Stream to webhook
      streamingPromises.push(
        this._sendToWebhook(webhook, auditEvent).catch(error => {
          console.error(`[AUDIT-WEBHOOKS] Failed to send to ${endpointId}:`, error.message);
          this.metrics.errors++;
        })
      );
    }

    // Stream to active connections
    for (const [connectionId, connection] of this.connections.entries()) {
      if (connection.filters && !this._eventMatchesFilter(auditEvent, connection.filters)) {
        continue;
      }

      streamingPromises.push(
        this._sendToConnection(connection, auditEvent).catch(error => {
          console.error(`[AUDIT-WEBHOOKS] Failed to send to connection ${connectionId}:`, error.message);
          this.connections.delete(connectionId);
          this.metrics.activeConnections--;
        })
      );
    }

    await Promise.allSettled(streamingPromises);
    this.metrics.eventsStreamed++;
  }

  _handleRequest(req, res) {
    const url = new URL(req.url, `http://localhost`);
    const path = url.pathname;

    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // Rate limiting
    const clientIP = req.connection.remoteAddress;
    if (!this._checkRateLimit(clientIP)) {
      res.writeHead(429, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Rate limit exceeded' }));
      return;
    }

    try {
      if (path === '/stream') {
        this._handleStreamConnection(req, res);
      } else if (path === '/metrics') {
        this._handleMetricsRequest(req, res);
      } else if (path === '/webhooks' && req.method === 'POST') {
        this._handleWebhookRegistration(req, res);
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
      }
    } catch (error) {
      console.error('[AUDIT-WEBHOOKS] Request error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  }

  _handleStreamConnection(req, res) {
    if (this.connections.size >= this.options.maxConnections) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Max connections reached' }));
      return;
    }

    const connectionId = randomUUID();
    const url = new URL(req.url, `http://localhost`);
    const filters = url.searchParams.get('filter');

    // Setup Server-Sent Events
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });

    const connection = {
      id: connectionId,
      response: res,
      filters: filters ? JSON.parse(filters) : null,
      created: this.getDeterministicTimestamp()
    };

    this.connections.set(connectionId, connection);
    this.metrics.totalConnections++;
    this.metrics.activeConnections++;

    // Send initial connection message
    res.write(`data: ${JSON.stringify({ type: 'connected', connectionId })}\n\n`);

    // Handle client disconnect
    req.on('close', () => {
      this.connections.delete(connectionId);
      this.metrics.activeConnections--;
      console.log(`[AUDIT-WEBHOOKS] Client disconnected: ${connectionId}`);
    });

    // Connection timeout
    setTimeout(() => {
      if (this.connections.has(connectionId)) {
        connection.response.end();
        this.connections.delete(connectionId);
        this.metrics.activeConnections--;
      }
    }, this.options.timeout);
  }

  _handleMetricsRequest(req, res) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      metrics: this.metrics,
      webhooks: this.webhooks.size,
      connections: this.connections.size,
      uptime: process.uptime(),
      timestamp: this.getDeterministicDate().toISOString()
    }));
  }

  _handleWebhookRegistration(req, res) {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
      try {
        const config = JSON.parse(body);
        const endpointId = randomUUID();
        const auditURI = this.registerWebhook(endpointId, config);
        
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ endpointId, auditURI }));
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
  }

  _checkRateLimit(clientIP) {
    const now = this.getDeterministicTimestamp();
    const windowStart = now - this.options.rateLimitWindow;

    if (!this.rateLimiter.has(clientIP)) {
      this.rateLimiter.set(clientIP, []);
    }

    const requests = this.rateLimiter.get(clientIP);
    
    // Remove old requests
    while (requests.length > 0 && requests[0] < windowStart) {
      requests.shift();
    }

    if (requests.length >= this.options.rateLimitMax) {
      this.metrics.rateLimitViolations++;
      return false;
    }

    requests.push(now);
    return true;
  }

  async _sendToWebhook(webhook, event) {
    const payload = JSON.stringify({
      timestamp: this.getDeterministicDate().toISOString(),
      auditURI: `audit://events/${event.traceId}/${event.spanId}`,
      event
    });

    // In a real implementation, use fetch or http client
    console.log(`[AUDIT-WEBHOOKS] Would send to ${webhook.url}:`, payload.slice(0, 100) + '...');
  }

  async _sendToConnection(connection, event) {
    const data = JSON.stringify({
      type: 'audit-event',
      timestamp: this.getDeterministicDate().toISOString(),
      auditURI: `audit://events/${event.traceId}/${event.spanId}`,
      event
    });

    connection.response.write(`data: ${data}\n\n`);
  }

  _eventMatchesFilter(event, filter) {
    if (!filter || typeof filter !== 'object') return true;

    for (const [key, value] of Object.entries(filter)) {
      const eventValue = this._getNestedValue(event, key);
      if (eventValue !== value) return false;
    }

    return true;
  }

  _getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }
}

/**
 * JSONL Stream Writer for Immutable Audit Trails
 */
export class ImmutableJSONLWriter {
  constructor(baseDir, options = {}) {
    this.baseDir = baseDir;
    this.options = {
      rotationSize: options.rotationSize || 100 * 1024 * 1024, // 100MB
      compressionEnabled: options.compressionEnabled || false,
      checksumAlgorithm: options.checksumAlgorithm || 'sha256',
      tamperEvidence: options.tamperEvidence !== false,
      ...options
    };
    
    this.currentStream = null;
    this.currentFile = null;
    this.currentSize = 0;
    this.eventCount = 0;
    this.checksums = new Map();
    this.sequenceNumber = 0;
  }

  /**
   * Write audit event to immutable JSONL stream
   */
  async writeAuditEvent(auditEvent) {
    const enhancedEvent = this._addImmutableMetadata(auditEvent);
    const jsonLine = JSON.stringify(enhancedEvent) + '\n';
    const checksum = this._calculateChecksum(jsonLine);
    
    // Add tamper evidence
    if (this.options.tamperEvidence) {
      enhancedEvent.audit = {
        ...enhancedEvent.audit || {},
        sequenceNumber: this.sequenceNumber++,
        checksum,
        previousChecksum: this._getPreviousChecksum(),
        tamperSeal: this._generateTamperSeal(enhancedEvent, checksum)
      };
    }
    
    await this._ensureCurrentStream();
    
    const finalJsonLine = JSON.stringify(enhancedEvent) + '\n';
    await this._writeToStream(finalJsonLine);
    
    this.checksums.set(enhancedEvent.audit.sequenceNumber, checksum);
    this.eventCount++;
    
    return {
      written: true,
      sequenceNumber: enhancedEvent.audit.sequenceNumber,
      checksum,
      auditURI: enhancedEvent.auditURI
    };
  }

  _addImmutableMetadata(event) {
    return {
      ...event,
      immutable: {
        wroteAt: this.getDeterministicDate().toISOString(),
        processId: process.pid,
        nodeVersion: process.version,
        writerVersion: '1.0.0',
        platform: `${process.platform}-${process.arch}`
      }
    };
  }

  _calculateChecksum(data) {
    return createHash(this.options.checksumAlgorithm)
      .update(data, 'utf8')
      .digest('hex');
  }

  _getPreviousChecksum() {
    if (this.checksums.size === 0) return null;
    return Array.from(this.checksums.values()).slice(-1)[0];
  }

  _generateTamperSeal(event, checksum) {
    const sealData = `${event.timestamp}:${event.traceId}:${event.spanId}:${checksum}`;
    return createHmac('sha256', 'kgen-audit-seal')
      .update(sealData)
      .digest('hex');
  }

  async _ensureCurrentStream() {
    if (!this.currentStream || this.currentSize >= this.options.rotationSize) {
      if (this.currentStream) {
        await this._rotateStream();
      }
      await this._createNewStream();
    }
  }

  async _createNewStream() {
    const timestamp = this.getDeterministicDate().toISOString().replace(/[:.]/g, '-');
    const filename = `audit-${timestamp}-${randomUUID().slice(0, 8)}.jsonl`;
    this.currentFile = join(this.baseDir, filename);
    
    if (!existsSync(this.baseDir)) {
      mkdirSync(this.baseDir, { recursive: true });
    }
    
    this.currentStream = createWriteStream(this.currentFile, { flags: 'a' });
    this.currentSize = 0;
    
    // Write stream metadata header
    const headerEvent = {
      type: 'audit-stream-header',
      timestamp: this.getDeterministicDate().toISOString(),
      streamId: randomUUID(),
      version: '1.0.0',
      checksumAlgorithm: this.options.checksumAlgorithm,
      tamperEvidence: this.options.tamperEvidence
    };
    
    await this._writeToStream(JSON.stringify(headerEvent) + '\n');
  }

  async _writeToStream(data) {
    return new Promise((resolve, reject) => {
      this.currentStream.write(data, 'utf8', (error) => {
        if (error) {
          reject(error);
        } else {
          this.currentSize += Buffer.byteLength(data, 'utf8');
          resolve();
        }
      });
    });
  }

  async _rotateStream() {
    if (this.currentStream) {
      await new Promise(resolve => this.currentStream.end(resolve));
      
      // Write rotation metadata
      const metadataFile = this.currentFile.replace('.jsonl', '.metadata.json');
      const metadata = {
        filename: this.currentFile,
        eventCount: this.eventCount,
        size: this.currentSize,
        rotatedAt: this.getDeterministicDate().toISOString(),
        checksums: Array.from(this.checksums.entries()),
        integrity: this._calculateFileIntegrity()
      };
      
      appendFileSync(metadataFile, JSON.stringify(metadata, null, 2));
    }
  }

  _calculateFileIntegrity() {
    if (!existsSync(this.currentFile)) return null;
    
    const content = readFileSync(this.currentFile, 'utf8');
    return createHash('sha256').update(content).digest('hex');
  }

  async close() {
    if (this.currentStream) {
      await this._rotateStream();
      this.currentStream = null;
      this.currentFile = null;
    }
  }
}

/**
 * OpenTelemetry Span Injection for Correlation
 */
export class OpenTelemetrySpanInjector {
  constructor() {
    this.correlationMap = new Map();
  }

  /**
   * Inject OpenTelemetry span context into audit event
   */
  injectSpanContext(auditEvent, spanContext) {
    const injectedEvent = {
      ...auditEvent,
      openTelemetry: {
        traceId: spanContext.traceId,
        spanId: spanContext.spanId,
        traceFlags: spanContext.traceFlags,
        traceState: spanContext.traceState?.toString() || '',
        injectedAt: this.getDeterministicDate().toISOString()
      }
    };
    
    // Store correlation for later retrieval
    this.correlationMap.set(`${spanContext.traceId}:${spanContext.spanId}`, {
      auditEvent: injectedEvent,
      injectedAt: this.getDeterministicTimestamp()
    });
    
    return injectedEvent;
  }

  /**
   * Extract span context from audit event
   */
  extractSpanContext(auditEvent) {
    if (!auditEvent.openTelemetry) return null;
    
    return {
      traceId: auditEvent.openTelemetry.traceId,
      spanId: auditEvent.openTelemetry.spanId,
      traceFlags: auditEvent.openTelemetry.traceFlags,
      traceState: auditEvent.openTelemetry.traceState
    };
  }

  /**
   * Get correlated audit events for a span
   */
  getCorrelatedEvents(traceId, spanId) {
    const key = `${traceId}:${spanId}`;
    return this.correlationMap.get(key)?.auditEvent || null;
  }

  /**
   * Clean up old correlations
   */
  cleanupOldCorrelations(maxAge = 3600000) { // 1 hour
    const now = this.getDeterministicTimestamp();
    for (const [key, data] of this.correlationMap.entries()) {
      if (now - data.injectedAt > maxAge) {
        this.correlationMap.delete(key);
      }
    }
  }
}

/**
 * Event Query and Replay System
 */
export class AuditQueryEngine {
  constructor(auditDir) {
    this.auditDir = auditDir;
    this.queryCache = new Map();
    this.indexCache = new Map();
    this.metricsCollector = new AuditMetricsCollector();
    this.performanceTracker = new AuditPerformanceTracker();
  }

  /**
   * Query audit events with flexible filtering
   * @param {Object} query - Query parameters
   * @returns {Promise<Array>} Matching audit events
   */
  async queryEvents(query = {}) {
    const {
      traceId,
      spanId,
      operation,
      component,
      timeRange,
      attributes,
      limit = 100,
      offset = 0,
      sortBy = 'timestamp',
      sortOrder = 'desc'
    } = query;

    const queryHash = this._generateQueryHash(query);
    
    // Check cache
    if (this.queryCache.has(queryHash)) {
      const cached = this.queryCache.get(queryHash);
      if (this.getDeterministicTimestamp() - cached.timestamp < 60000) { // 1 minute cache
        return cached.results.slice(offset, offset + limit);
      }
    }

    const results = [];
    const files = await this._getAuditFiles(timeRange);

    for (const file of files) {
      const events = await this._parseAuditFile(file);
      
      for (const event of events) {
        if (this._eventMatchesQuery(event, query)) {
          results.push(event);
        }
      }
    }

    // Sort results
    results.sort((a, b) => {
      const aValue = a[sortBy] || 0;
      const bValue = b[sortBy] || 0;
      return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
    });

    // Cache results
    this.queryCache.set(queryHash, {
      results,
      timestamp: this.getDeterministicTimestamp()
    });

    return results.slice(offset, offset + limit);
  }

  /**
   * Replay session state from audit log
   * @param {string} sessionId - Session identifier
   * @param {string} targetTimestamp - Target point in time
   * @param {Object} options - Replay options
   * @returns {Promise<Object>} Reconstructed state
   */
  async replaySession(sessionId, targetTimestamp, options = {}) {
    const events = await this.queryEvents({
      attributes: { 'kgen.session.id': sessionId },
      timeRange: { end: targetTimestamp },
      sortBy: 'timestamp',
      sortOrder: 'asc',
      limit: 10000 // Large limit for complete replay
    });

    const state = {
      sessionId,
      targetTimestamp,
      reconstructedAt: this.getDeterministicDate().toISOString(),
      eventCount: events.length,
      operations: {},
      resources: {},
      errors: [],
      performance: {
        totalDuration: 0,
        operationCounts: {}
      }
    };

    // Reconstruct state from events
    for (const event of events) {
      try {
        this._applyEventToState(state, event);
      } catch (error) {
        state.errors.push({
          event: event.spanId,
          error: error.message,
          timestamp: event.timestamp
        });
      }
    }

    return state;
  }

  /**
   * Create persistent audit stream
   * @param {string} streamId - Stream identifier
   * @param {Object} config - Stream configuration
   * @returns {Promise<string>} Stream audit URI
   */
  async createStream(streamId, config) {
    const streamConfig = {
      id: streamId,
      created: this.getDeterministicDate().toISOString(),
      filters: config.filters || [],
      retention: config.retention || '30d',
      format: config.format || 'jsonl',
      compression: config.compression || false,
      ...config
    };

    const streamFile = resolve(this.auditDir, 'streams', `${streamId}.json`);
    const streamDir = dirname(streamFile);
    
    if (!existsSync(streamDir)) {
      mkdirSync(streamDir, { recursive: true });
    }

    await this._writeFile(streamFile, JSON.stringify(streamConfig, null, 2));
    
    return `audit://streams/${streamId}`;
  }

  async _getAuditFiles(timeRange) {
    const files = [];
    
    if (!existsSync(this.auditDir)) {
      return files;
    }

    const entries = await this._readDir(this.auditDir);
    
    for (const entry of entries) {
      if (entry.endsWith('.jsonl')) {
        const filePath = resolve(this.auditDir, entry);
        
        if (timeRange) {
          const stats = statSync(filePath);
          if (timeRange.start && stats.mtime < new Date(timeRange.start)) continue;
          if (timeRange.end && stats.mtime > new Date(timeRange.end)) continue;
        }
        
        files.push(filePath);
      }
    }

    return files.sort();
  }

  async _parseAuditFile(filePath) {
    const events = [];
    const parseStartTime = performance.now();
    
    try {
      // Verify file integrity first
      await this._verifyFileIntegrity(filePath);
      
      const content = readFileSync(filePath, 'utf8');
      const lines = content.split('\n').filter(line => line.trim());
      
      const sequenceErrors = 0;
      let checksumErrors = 0;
      
      for (const line of lines) {
        try {
          const event = JSON.parse(line);
          
          // Verify tamper evidence if present
          if (event.audit?.tamperSeal) {
            const isValid = this._verifyTamperSeal(event);
            if (!isValid) {
              checksumErrors++;
              console.warn(`[AUDIT-QUERY] Tamper evidence failed for event ${event.audit.sequenceNumber}`);
              continue;
            }
          }
          
          events.push(event);
        } catch (parseError) {
          // Skip invalid JSON lines but track errors
          this.metricsCollector.incrementParseErrors();
        }
      }
      
      const parseTime = performance.now() - parseStartTime;
      this.performanceTracker.recordParseOperation(filePath, parseTime, events.length);
      
      if (sequenceErrors > 0 || checksumErrors > 0) {
        console.warn(`[AUDIT-QUERY] File integrity issues in ${filePath}: ${sequenceErrors} sequence errors, ${checksumErrors} checksum errors`);
      }
      
    } catch (error) {
      console.error(`[AUDIT-QUERY] Failed to parse ${filePath}:`, error.message);
      this.metricsCollector.incrementFileErrors();
    }

    return events;
  }

  async _verifyFileIntegrity(filePath) {
    const metadataFile = filePath.replace('.jsonl', '.metadata.json');
    if (!existsSync(metadataFile)) return true; // No metadata to verify
    
    try {
      const metadata = JSON.parse(readFileSync(metadataFile, 'utf8'));
      const currentHash = this._calculateFileHash(filePath);
      
      if (metadata.integrity && metadata.integrity !== currentHash) {
        throw new Error(`File integrity check failed: expected ${metadata.integrity}, got ${currentHash}`);
      }
      
      return true;
    } catch (error) {
      console.error(`[AUDIT-QUERY] Integrity verification failed for ${filePath}:`, error.message);
      this.metricsCollector.incrementIntegrityErrors();
      return false;
    }
  }

  _calculateFileHash(filePath) {
    const content = readFileSync(filePath, 'utf8');
    return createHash('sha256').update(content).digest('hex');
  }

  _verifyTamperSeal(event) {
    if (!event.audit?.tamperSeal) return true;
    
    const sealData = `${event.timestamp}:${event.traceId}:${event.spanId}:${event.audit.checksum}`;
    const expectedSeal = createHmac('sha256', 'kgen-audit-seal')
      .update(sealData)
      .digest('hex');
    
    return event.audit.tamperSeal === expectedSeal;
  }

  _eventMatchesQuery(event, query) {
    if (query.traceId && event.traceId !== query.traceId) return false;
    if (query.spanId && event.spanId !== query.spanId) return false;
    if (query.operation && event.operation !== query.operation) return false;
    if (query.component && event.attributes?.['kgen.component'] !== query.component) return false;
    
    if (query.timeRange) {
      const eventTime = new Date(event.timestamp);
      if (query.timeRange.start && eventTime < new Date(query.timeRange.start)) return false;
      if (query.timeRange.end && eventTime > new Date(query.timeRange.end)) return false;
    }

    if (query.attributes) {
      for (const [key, value] of Object.entries(query.attributes)) {
        const eventValue = this._getNestedValue(event.attributes, key);
        if (eventValue !== value) return false;
      }
    }

    return true;
  }

  _applyEventToState(state, event) {
    // Record operation
    if (event.operation) {
      if (!state.operations[event.operation]) {
        state.operations[event.operation] = { count: 0, totalDuration: 0 };
      }
      state.operations[event.operation].count++;
      
      if (event.duration) {
        state.operations[event.operation].totalDuration += event.duration;
        state.performance.totalDuration += event.duration;
      }
      
      state.performance.operationCounts[event.operation] = 
        (state.performance.operationCounts[event.operation] || 0) + 1;
    }

    // Track resources
    if (event.attributes?.['kgen.resource.hash']) {
      state.resources[event.attributes['kgen.resource.hash']] = {
        operation: event.operation,
        timestamp: event.timestamp,
        attributes: event.attributes
      };
    }
  }

  _generateQueryHash(query) {
    return createHash('sha256')
      .update(JSON.stringify(query))
      .digest('hex');
  }

  _getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  async _readDir(dirPath) {
    const fs = await import('fs');
    return new Promise((resolve, reject) => {
      fs.readdir(dirPath, (error, files) => {
        if (error) reject(error);
        else resolve(files);
      });
    });
  }

  async _writeFile(filePath, content) {
    const fs = await import('fs');
    return new Promise((resolve, reject) => {
      fs.writeFile(filePath, content, 'utf8', (error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }
}

/**
 * Main Audit Stream Coordinator
 * Integrates with existing KGEN observability system
 */
export class AuditStreamCoordinator extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      auditDir: options.auditDir || resolve(process.cwd(), '.kgen/audit'),
      enableWebhooks: options.enableWebhooks !== false,
      webhookPort: options.webhookPort || 0,
      enableRealTimeStreaming: options.enableRealTimeStreaming !== false,
      queryEngine: options.queryEngine !== false,
      enableGovernanceIntegration: options.enableGovernanceIntegration !== false,
      immutableTrails: options.immutableTrails !== false,
      openTelemetryIntegration: options.openTelemetryIntegration !== false,
      ...options
    };
    
    this.initialized = false;
    this.auditFiles = new Map();
    this.sessions = new Map();
    this.governanceEventBuffer = [];
    
    // Initialize components
    this.uriScheme = new AuditURIScheme(this);
    this.queryEngine = new AuditQueryEngine(this.options.auditDir);
    this.jsonlWriter = new ImmutableJSONLWriter(this.options.auditDir, {
      tamperEvidence: this.options.immutableTrails
    });
    this.spanInjector = new OpenTelemetrySpanInjector();
    
    if (this.options.enableWebhooks) {
      this.webhookStreamer = new AuditWebhookStreamer({
        port: this.options.webhookPort
      });
    }
    
    this.metrics = {
      eventsProcessed: 0,
      streamsCreated: 0,
      queriesExecuted: 0,
      webhooksDelivered: 0,
      replaySessionsCreated: 0,
      governanceEventsProcessed: 0,
      immutableEventsWritten: 0,
      correlationIdsMapped: 0
    };
  }

  async initialize() {
    if (this.initialized) return;

    // Ensure audit directory exists
    if (!existsSync(this.options.auditDir)) {
      mkdirSync(this.options.auditDir, { recursive: true });
    }

    // Start webhook streamer
    if (this.webhookStreamer) {
      await this.webhookStreamer.start();
    }

    // Integrate with existing KGEN tracer
    const kgenTracer = getKGenTracer();
    if (kgenTracer && kgenTracer.auditExporter) {
      // Hook into existing audit exporter
      const originalExport = kgenTracer.auditExporter.export.bind(kgenTracer.auditExporter);
      kgenTracer.auditExporter.export = async (spans) => {
        // Call original export
        await originalExport(spans);
        
        // Process spans through our audit stream coordinator
        for (const span of spans) {
          await this._processAuditEvent(this._spanToAuditEvent(span));
        }
      };
    }

    this.initialized = true;
    console.log('[AUDIT-STREAM] Coordinator initialized');
    
    this.emit('initialized', {
      auditDir: this.options.auditDir,
      webhooksEnabled: !!this.webhookStreamer,
      queryEngineEnabled: !!this.queryEngine
    });
  }

  async shutdown() {
    if (!this.initialized) return;

    if (this.webhookStreamer) {
      await this.webhookStreamer.stop();
    }

    this.initialized = false;
    console.log('[AUDIT-STREAM] Coordinator shutdown');
    this.emit('shutdown');
  }

  /**
   * Process incoming audit event with full audit trail
   */
  async _processAuditEvent(auditEvent) {
    const processingStartTime = performance.now();
    
    try {
      // Generate audit URI for the event
      const auditURI = this.uriScheme.createEventURI(auditEvent);
      auditEvent.auditURI = auditURI;

      // Inject OpenTelemetry span context if available
      if (this.options.openTelemetryIntegration && auditEvent.traceId && auditEvent.spanId) {
        const spanContext = {
          traceId: auditEvent.traceId,
          spanId: auditEvent.spanId,
          traceFlags: auditEvent.traceFlags || 0
        };
        auditEvent = this.spanInjector.injectSpanContext(auditEvent, spanContext);
        this.metrics.correlationIdsMapped++;
      }

      // Write to immutable JSONL stream
      if (this.options.immutableTrails) {
        const writeResult = await this.jsonlWriter.writeAuditEvent(auditEvent);
        auditEvent.immutableWriteResult = writeResult;
        this.metrics.immutableEventsWritten++;
      }

      // Process governance events
      if (this.options.enableGovernanceIntegration) {
        await this._processGovernanceEvent(auditEvent);
      }

      // Stream to webhooks
      if (this.webhookStreamer) {
        await this.webhookStreamer.streamEvent(auditEvent);
      }

      // Record performance metrics
      const processingTime = performance.now() - processingStartTime;
      this.queryEngine.metricsCollector.recordEventProcessed(auditEvent, processingTime);
      
      // Update coordinator metrics
      this.metrics.eventsProcessed++;
      
      // Emit event for other integrations
      this.emit('audit-event', auditEvent);
      
    } catch (error) {
      console.error('[AUDIT-STREAM] Event processing failed:', error);
      this.queryEngine.metricsCollector.incrementFileErrors();
    }
  }

  /**
   * Process governance-related events
   */
  async _processGovernanceEvent(auditEvent) {
    const governanceTypes = [
      'data.access',
      'data.modification', 
      'user.authentication',
      'user.authorization',
      'system.configuration',
      'security.violation',
      'compliance.check'
    ];
    
    const isGovernanceEvent = governanceTypes.some(type => 
      auditEvent.operation?.includes(type) || 
      auditEvent.attributes?.['kgen.governance']?.type === type
    );
    
    if (isGovernanceEvent) {
      const governanceEvent = {
        ...auditEvent,
        governance: {
          classifiedAt: this.getDeterministicDate().toISOString(),
          riskLevel: this._assessRiskLevel(auditEvent),
          complianceFlags: this._checkComplianceFlags(auditEvent),
          retentionPolicy: this._determineRetentionPolicy(auditEvent)
        }
      };
      
      this.governanceEventBuffer.push(governanceEvent);
      this.metrics.governanceEventsProcessed++;
      
      // Emit governance-specific event
      this.emit('governance-event', governanceEvent);
      
      // Trigger immediate compliance checks if high risk
      if (governanceEvent.governance.riskLevel === 'high') {
        this.emit('high-risk-event', governanceEvent);
      }
    }
  }

  _assessRiskLevel(auditEvent) {
    // Risk assessment logic
    if (auditEvent.status === 'error' || auditEvent.attributes?.['security.violation']) {
      return 'high';
    }
    if (auditEvent.operation?.includes('authentication') || auditEvent.operation?.includes('authorization')) {
      return 'medium';
    }
    return 'low';
  }

  _checkComplianceFlags(auditEvent) {
    const flags = [];
    
    // GDPR compliance
    if (auditEvent.attributes?.['data.personal']) {
      flags.push('gdpr');
    }
    
    // SOX compliance
    if (auditEvent.attributes?.['financial.data']) {
      flags.push('sox');
    }
    
    // HIPAA compliance
    if (auditEvent.attributes?.['health.data']) {
      flags.push('hipaa');
    }
    
    return flags;
  }

  _determineRetentionPolicy(auditEvent) {
    const complianceFlags = this._checkComplianceFlags(auditEvent);
    
    if (complianceFlags.includes('sox')) {
      return { years: 7, reason: 'sox_compliance' };
    }
    if (complianceFlags.includes('gdpr')) {
      return { years: 6, reason: 'gdpr_compliance' };
    }
    if (complianceFlags.includes('hipaa')) {
      return { years: 6, reason: 'hipaa_compliance' };
    }
    
    return { years: 3, reason: 'default_retention' };
  }

  /**
   * Convert OpenTelemetry span to audit event format
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
      status: span.status?.code === 1 ? 'ok' : 'error', // SpanStatusCode.OK = 1
      attributes: span.attributes || {},
      events: span.events?.map(event => ({
        name: event.name,
        timestamp: event.time,
        attributes: event.attributes
      })) || [],
      kgen: {
        version: '1.0.0',
        auditVersion: 'v1.0',
        component: 'audit-stream-coordinator'
      }
    };
  }

  /**
   * Public API Methods
   */

  async queryEvents(query) {
    this.metrics.queriesExecuted++;
    return await this.queryEngine.queryEvents(query);
  }

  async replaySession(sessionId, timestamp, options) {
    this.metrics.replaySessionsCreated++;
    return await this.queryEngine.replaySession(sessionId, timestamp, options);
  }

  async createStream(streamId, config) {
    this.metrics.streamsCreated++;
    return await this.queryEngine.createStream(streamId, config);
  }

  async getStream(streamId, options) {
    return await this.queryEngine.queryEvents({
      attributes: { 'kgen.stream.id': streamId },
      ...options
    });
  }

  async resolveAuditURI(auditURI) {
    return await this.uriScheme.resolve(auditURI);
  }

  registerWebhook(endpointId, config) {
    if (!this.webhookStreamer) {
      throw new Error('Webhook streaming not enabled');
    }
    return this.webhookStreamer.registerWebhook(endpointId, config);
  }

  /**
   * Get comprehensive audit streaming metrics
   */
  getMetrics() {
    return {
      coordinator: this.metrics,
      webhooks: this.webhookStreamer?.metrics,
      queryEngine: this.queryEngine?.metricsCollector?.getMetricsSummary() || {},
      performance: this.queryEngine?.performanceTracker?.getPerformanceReport() || {},
      bottlenecks: this.queryEngine?.performanceTracker?.getBottlenecks() || [],
      governance: {
        bufferSize: this.governanceEventBuffer.length,
        eventsProcessed: this.metrics.governanceEventsProcessed,
        lastEvent: this.governanceEventBuffer.slice(-1)[0]?.timestamp || null
      },
      immutableTrails: {
        eventsWritten: this.metrics.immutableEventsWritten,
        currentSequence: this.jsonlWriter?.sequenceNumber || 0,
        tamperEvidence: this.options.immutableTrails
      },
      openTelemetry: {
        correlationsMapped: this.metrics.correlationIdsMapped,
        enabled: this.options.openTelemetryIntegration
      },
      system: {
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage()
      }
    };
  }

  /**
   * Get governance events from buffer
   */
  getGovernanceEvents(options = {}) {
    const { limit = 100, riskLevel, since } = options;
    
    let events = [...this.governanceEventBuffer];
    
    if (riskLevel) {
      events = events.filter(event => event.governance.riskLevel === riskLevel);
    }
    
    if (since) {
      const sinceDate = new Date(since);
      events = events.filter(event => new Date(event.timestamp) > sinceDate);
    }
    
    return events.slice(-limit);
  }

  /**
   * Get correlated events for OpenTelemetry span
   */
  getCorrelatedEvents(traceId, spanId) {
    if (!this.options.openTelemetryIntegration) {
      throw new Error('OpenTelemetry integration not enabled');
    }
    
    return this.spanInjector.getCorrelatedEvents(traceId, spanId);
  }

  /**
   * Export governance report
   */
  async exportGovernanceReport(format = 'json') {
    const report = {
      generatedAt: this.getDeterministicDate().toISOString(),
      totalEvents: this.metrics.governanceEventsProcessed,
      riskDistribution: this._calculateRiskDistribution(),
      complianceStatus: this._calculateComplianceStatus(),
      retentionSummary: this._calculateRetentionSummary(),
      highRiskEvents: this.getGovernanceEvents({ riskLevel: 'high', limit: 50 })
    };
    
    if (format === 'csv') {
      return this._convertReportToCSV(report);
    }
    
    return report;
  }

  _calculateRiskDistribution() {
    const distribution = { high: 0, medium: 0, low: 0 };
    
    for (const event of this.governanceEventBuffer) {
      distribution[event.governance.riskLevel]++;
    }
    
    return distribution;
  }

  _calculateComplianceStatus() {
    const compliance = {};
    
    for (const event of this.governanceEventBuffer) {
      for (const flag of event.governance.complianceFlags) {
        compliance[flag] = (compliance[flag] || 0) + 1;
      }
    }
    
    return compliance;
  }

  _calculateRetentionSummary() {
    const retention = {};
    
    for (const event of this.governanceEventBuffer) {
      const policy = event.governance.retentionPolicy.reason;
      retention[policy] = (retention[policy] || 0) + 1;
    }
    
    return retention;
  }

  _convertReportToCSV(report) {
    // Simple CSV conversion for governance events
    const headers = ['timestamp', 'traceId', 'operation', 'riskLevel', 'complianceFlags', 'retentionYears'];
    const rows = report.highRiskEvents.map(event => [
      event.timestamp,
      event.traceId,
      event.operation,
      event.governance.riskLevel,
      event.governance.complianceFlags.join(';'),
      event.governance.retentionPolicy.years
    ]);
    
    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }

  /**
   * Cleanup old correlations and governance events periodically
   */
  startPeriodicCleanup(intervalMs = 3600000) { // 1 hour
    setInterval(() => {
      try {
        // Cleanup span correlations
        if (this.spanInjector) {
          this.spanInjector.cleanupOldCorrelations();
        }
        
        // Cleanup old governance events (keep last 10,000)
        if (this.governanceEventBuffer.length > 10000) {
          this.governanceEventBuffer = this.governanceEventBuffer.slice(-10000);
        }
        
        console.log('[AUDIT-STREAM] Periodic cleanup completed');
      } catch (error) {
        console.error('[AUDIT-STREAM] Cleanup error:', error);
      }
    }, intervalMs);
  }

  /**
   * Shutdown with proper cleanup
   */
  async shutdown() {
    if (!this.initialized) return;

    try {
      // Close immutable JSONL writer
      if (this.jsonlWriter) {
        await this.jsonlWriter.close();
      }
      
      // Stop webhook streamer
      if (this.webhookStreamer) {
        await this.webhookStreamer.stop();
      }

      this.initialized = false;
      console.log('[AUDIT-STREAM] Coordinator shutdown complete');
      this.emit('shutdown');
    } catch (error) {
      console.error('[AUDIT-STREAM] Shutdown error:', error);
    }
  }

  getStoredQueryResult(queryId) {
    // Implementation for stored query results
    return this.queryEngine.queryCache.get(queryId)?.results || null;
  }

  getWebhookConfig(endpointId) {
    return this.webhookStreamer?.webhooks.get(endpointId) || null;
  }
}

/**
 * Comprehensive Audit Metrics Collector
 */
export class AuditMetricsCollector {
  constructor() {
    this.metrics = {
      // Event metrics
      totalEventsProcessed: 0,
      eventsPerSecond: 0,
      eventTypeCounts: new Map(),
      
      // Performance metrics
      averageProcessingTime: 0,
      peakProcessingTime: 0,
      totalProcessingTime: 0,
      
      // Error metrics
      parseErrors: 0,
      fileErrors: 0,
      integrityErrors: 0,
      webhookErrors: 0,
      
      // System metrics
      memoryUsage: { heap: 0, external: 0, rss: 0 },
      cpuUsage: { user: 0, system: 0 },
      
      // Audit trail metrics
      totalAuditFiles: 0,
      totalAuditSize: 0,
      oldestEvent: null,
      newestEvent: null,
      
      // Query metrics
      queriesExecuted: 0,
      averageQueryTime: 0,
      cacheHitRate: 0
    };
    
    this.startTime = this.getDeterministicTimestamp();
    this.lastUpdate = this.getDeterministicTimestamp();
  }

  recordEventProcessed(event, processingTime) {
    this.metrics.totalEventsProcessed++;
    this.metrics.totalProcessingTime += processingTime;
    this.metrics.averageProcessingTime = this.metrics.totalProcessingTime / this.metrics.totalEventsProcessed;
    
    if (processingTime > this.metrics.peakProcessingTime) {
      this.metrics.peakProcessingTime = processingTime;
    }
    
    // Track event types
    const eventType = event.operation || 'unknown';
    this.metrics.eventTypeCounts.set(
      eventType, 
      (this.metrics.eventTypeCounts.get(eventType) || 0) + 1
    );
    
    // Update event timeline
    if (!this.metrics.oldestEvent || event.timestamp < this.metrics.oldestEvent) {
      this.metrics.oldestEvent = event.timestamp;
    }
    if (!this.metrics.newestEvent || event.timestamp > this.metrics.newestEvent) {
      this.metrics.newestEvent = event.timestamp;
    }
    
    // Calculate events per second
    const now = this.getDeterministicTimestamp();
    const elapsed = (now - this.startTime) / 1000;
    this.metrics.eventsPerSecond = this.metrics.totalEventsProcessed / elapsed;
  }

  recordQueryExecuted(queryTime, cacheHit = false) {
    this.metrics.queriesExecuted++;
    this.metrics.averageQueryTime = 
      (this.metrics.averageQueryTime * (this.metrics.queriesExecuted - 1) + queryTime) / 
      this.metrics.queriesExecuted;
    
    // Update cache hit rate
    if (cacheHit) {
      this.metrics.cacheHitRate = 
        ((this.metrics.cacheHitRate * (this.metrics.queriesExecuted - 1)) + 1) / 
        this.metrics.queriesExecuted;
    } else {
      this.metrics.cacheHitRate = 
        (this.metrics.cacheHitRate * (this.metrics.queriesExecuted - 1)) / 
        this.metrics.queriesExecuted;
    }
  }

  incrementParseErrors() {
    this.metrics.parseErrors++;
  }

  incrementFileErrors() {
    this.metrics.fileErrors++;
  }

  incrementIntegrityErrors() {
    this.metrics.integrityErrors++;
  }

  incrementWebhookErrors() {
    this.metrics.webhookErrors++;
  }

  updateSystemMetrics() {
    this.metrics.memoryUsage = process.memoryUsage();
    this.metrics.cpuUsage = process.cpuUsage();
    this.lastUpdate = this.getDeterministicTimestamp();
  }

  updateAuditTrailMetrics(fileCount, totalSize) {
    this.metrics.totalAuditFiles = fileCount;
    this.metrics.totalAuditSize = totalSize;
  }

  getMetricsSummary() {
    this.updateSystemMetrics();
    
    return {
      ...this.metrics,
      eventTypeCounts: Object.fromEntries(this.metrics.eventTypeCounts),
      uptime: this.getDeterministicTimestamp() - this.startTime,
      lastUpdate: this.lastUpdate,
      errorRate: this.calculateErrorRate(),
      throughput: this.calculateThroughput()
    };
  }

  calculateErrorRate() {
    const totalErrors = this.metrics.parseErrors + 
                       this.metrics.fileErrors + 
                       this.metrics.integrityErrors + 
                       this.metrics.webhookErrors;
    
    return this.metrics.totalEventsProcessed > 0 ? 
           (totalErrors / this.metrics.totalEventsProcessed) * 100 : 0;
  }

  calculateThroughput() {
    const elapsed = (this.getDeterministicTimestamp() - this.startTime) / 1000;
    return elapsed > 0 ? this.metrics.totalEventsProcessed / elapsed : 0;
  }
}

/**
 * Audit Performance Tracker
 */
export class AuditPerformanceTracker {
  constructor() {
    this.operations = new Map();
    this.performanceThresholds = {
      parsing: 100, // ms
      querying: 1000, // ms
      streaming: 50, // ms
      webhooks: 2000 // ms
    };
  }

  recordParseOperation(filePath, duration, eventCount) {
    this._recordOperation('parsing', {
      filePath,
      duration,
      eventCount,
      eventsPerMs: eventCount / duration
    });
  }

  recordQueryOperation(query, duration, resultCount) {
    this._recordOperation('querying', {
      query: JSON.stringify(query),
      duration,
      resultCount,
      resultsPerMs: resultCount / duration
    });
  }

  recordStreamingOperation(eventCount, duration) {
    this._recordOperation('streaming', {
      eventCount,
      duration,
      eventsPerMs: eventCount / duration
    });
  }

  recordWebhookOperation(webhookId, duration, success) {
    this._recordOperation('webhooks', {
      webhookId,
      duration,
      success
    });
  }

  _recordOperation(type, data) {
    if (!this.operations.has(type)) {
      this.operations.set(type, []);
    }
    
    const operations = this.operations.get(type);
    operations.push({
      ...data,
      timestamp: this.getDeterministicTimestamp(),
      aboveThreshold: data.duration > this.performanceThresholds[type]
    });
    
    // Keep only last 1000 operations per type
    if (operations.length > 1000) {
      operations.splice(0, operations.length - 1000);
    }
  }

  getPerformanceReport() {
    const report = {};
    
    for (const [type, operations] of this.operations.entries()) {
      if (operations.length === 0) continue;
      
      const durations = operations.map(op => op.duration);
      const aboveThreshold = operations.filter(op => op.aboveThreshold);
      
      report[type] = {
        totalOperations: operations.length,
        averageDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
        minDuration: Math.min(...durations),
        maxDuration: Math.max(...durations),
        threshold: this.performanceThresholds[type],
        aboveThresholdCount: aboveThreshold.length,
        aboveThresholdPercentage: (aboveThreshold.length / operations.length) * 100,
        recentOperations: operations.slice(-10)
      };
    }
    
    return report;
  }

  getBottlenecks() {
    const report = this.getPerformanceReport();
    const bottlenecks = [];
    
    for (const [type, metrics] of Object.entries(report)) {
      if (metrics.aboveThresholdPercentage > 10) { // More than 10% above threshold
        bottlenecks.push({
          operation: type,
          severity: metrics.aboveThresholdPercentage > 50 ? 'high' : 'medium',
          averageDuration: metrics.averageDuration,
          threshold: metrics.threshold,
          suggestion: this._getOptimizationSuggestion(type, metrics)
        });
      }
    }
    
    return bottlenecks;
  }

  _getOptimizationSuggestion(operationType, metrics) {
    const suggestions = {
      parsing: 'Consider file size limits, parallel parsing, or streaming parsers',
      querying: 'Add indexes, optimize query conditions, or implement query caching',
      streaming: 'Reduce event payload size or implement batched streaming',
      webhooks: 'Check network latency, implement timeouts, or use async delivery'
    };
    
    return suggestions[operationType] || 'Review implementation for performance optimizations';
  }
}

export default AuditStreamCoordinator;