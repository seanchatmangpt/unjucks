/**
 * Enterprise Audit Trail Enhancements
 * 
 * Addresses critical compliance gaps identified in Agent 11 audit review:
 * 1. JSONL format compliance
 * 2. Webhook reliability with retry mechanisms  
 * 3. OpenTelemetry trace integration
 * 4. Performance monitoring enhancements
 */

import { createWriteStream, createReadStream } from 'fs';
import { createHash, createHmac } from 'crypto';
import { performance } from 'perf_hooks';
import { EventEmitter } from 'events';
import { trace, context } from '@opentelemetry/api';

/**
 * Enterprise-Grade JSONL Audit Logger
 * Fixes: JSONL format compliance violations
 */
export class JSONLAuditLogger extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      logFile: options.logFile || '/var/log/audit/enterprise-audit.jsonl',
      bufferSize: options.bufferSize || 1000,
      flushInterval: options.flushInterval || 5000,
      enableCompression: options.enableCompression || true,
      enableEncryption: options.enableEncryption || true,
      ...options
    };
    
    this.buffer = [];
    this.writeStream = null;
    this.flushTimer = null;
    this.metrics = {
      eventsLogged: 0,
      bytesWritten: 0,
      flushCount: 0,
      errors: 0
    };
    
    this._initialize();
  }

  _initialize() {
    this.writeStream = createWriteStream(this.options.logFile, { flags: 'a' });
    
    this.writeStream.on('error', (error) => {
      this.metrics.errors++;
      this.emit('error', error);
    });

    // Start periodic flush
    this.flushTimer = setInterval(() => {
      this._flushBuffer();
    }, this.options.flushInterval);
  }

  /**
   * Log audit event in proper JSONL format
   * @param {Object} event - Audit event to log
   */
  async logEvent(event) {
    const enhancedEvent = this._enhanceEvent(event);
    
    // Add OpenTelemetry trace context
    const activeSpan = trace.getActiveSpan();
    if (activeSpan) {
      const spanContext = activeSpan.spanContext();
      enhancedEvent.trace_id = spanContext.traceId;
      enhancedEvent.span_id = spanContext.spanId;
      enhancedEvent.trace_flags = spanContext.traceFlags;
    }
    
    // Generate proper JSONL line (single line, no pretty printing)
    const jsonLine = JSON.stringify(enhancedEvent) + '\n';
    
    this.buffer.push(jsonLine);
    this.metrics.eventsLogged++;
    
    // Flush if buffer is full
    if (this.buffer.length >= this.options.bufferSize) {
      await this._flushBuffer();
    }
    
    this.emit('event-logged', enhancedEvent);
  }

  _enhanceEvent(event) {
    return {
      ...event,
      timestamp: event.timestamp || this.getDeterministicDate().toISOString(),
      event_id: event.event_id || this._generateEventId(),
      process_id: process.pid,
      node_version: process.version,
      audit_version: '2.0',
      compliance_enhanced: true
    };
  }

  async _flushBuffer() {
    if (this.buffer.length === 0) return;
    
    const lines = this.buffer.splice(0);
    const content = lines.join('');
    
    try {
      await this._writeContent(content);
      this.metrics.bytesWritten += Buffer.byteLength(content);
      this.metrics.flushCount++;
      this.emit('buffer-flushed', { lines: lines.length, bytes: content.length });
    } catch (error) {
      // Re-add lines to buffer for retry
      this.buffer.unshift(...lines);
      this.metrics.errors++;
      this.emit('error', error);
    }
  }

  _writeContent(content) {
    return new Promise((resolve, reject) => {
      this.writeStream.write(content, 'utf8', (error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }

  _generateEventId() {
    return `audit-${this.getDeterministicTimestamp()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  async shutdown() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    
    await this._flushBuffer();
    
    return new Promise((resolve) => {
      this.writeStream.end(() => {
        resolve();
      });
    });
  }

  getMetrics() {
    return {
      ...this.metrics,
      bufferSize: this.buffer.length,
      uptime: process.uptime()
    };
  }
}

/**
 * Reliable Webhook Delivery System
 * Fixes: Webhook failure handling and retry mechanisms
 */
export class ReliableWebhookDelivery extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      maxRetries: options.maxRetries || 3,
      initialDelay: options.initialDelay || 1000,
      maxDelay: options.maxDelay || 30000,
      exponentialBase: options.exponentialBase || 2,
      deadLetterQueue: options.deadLetterQueue || '/var/log/audit/webhook-dlq.jsonl',
      circuitBreakerThreshold: options.circuitBreakerThreshold || 5,
      circuitBreakerTimeout: options.circuitBreakerTimeout || 60000,
      ...options
    };
    
    this.webhooks = new Map();
    this.circuitBreakers = new Map();
    this.retryQueues = new Map();
    this.deadLetterLogger = new JSONLAuditLogger({ 
      logFile: this.options.deadLetterQueue 
    });
    
    this.metrics = {
      deliveryAttempts: 0,
      successfulDeliveries: 0,
      failedDeliveries: 0,
      retriedDeliveries: 0,
      circuitBreakerTrips: 0,
      deadLetterEvents: 0
    };
  }

  registerWebhook(endpointId, config) {
    this.webhooks.set(endpointId, {
      id: endpointId,
      url: config.url,
      headers: config.headers || {},
      secret: config.secret,
      filters: config.filters || [],
      timeout: config.timeout || 30000,
      active: true,
      ...config
    });
    
    // Initialize circuit breaker
    this.circuitBreakers.set(endpointId, {
      state: 'closed', // closed, open, half-open
      failures: 0,
      lastFailure: null,
      nextAttempt: null
    });
    
    // Initialize retry queue
    this.retryQueues.set(endpointId, []);
    
    return `audit://webhooks/${endpointId}`;
  }

  async deliverEvent(auditEvent) {
    const deliveryPromises = [];
    
    for (const [endpointId, webhook] of this.webhooks.entries()) {
      if (!webhook.active) continue;
      
      // Apply filters
      if (!this._eventPassesFilters(auditEvent, webhook.filters)) {
        continue;
      }
      
      // Check circuit breaker
      if (!this._checkCircuitBreaker(endpointId)) {
        continue;
      }
      
      deliveryPromises.push(
        this._deliverToWebhook(endpointId, webhook, auditEvent)
      );
    }
    
    const results = await Promise.allSettled(deliveryPromises);
    
    // Process retry queue
    await this._processRetryQueues();
    
    return results;
  }

  async _deliverToWebhook(endpointId, webhook, event) {
    const circuitBreaker = this.circuitBreakers.get(endpointId);
    
    try {
      this.metrics.deliveryAttempts++;
      
      const payload = this._createWebhookPayload(event, webhook);
      const response = await this._sendWebhookRequest(webhook, payload);
      
      if (response.ok) {
        this.metrics.successfulDeliveries++;
        this._resetCircuitBreaker(endpointId);
        this.emit('webhook-delivered', { endpointId, event: event.event_id });
        return { success: true, endpointId };
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
    } catch (error) {
      this.metrics.failedDeliveries++;
      this._recordFailure(endpointId, error);
      
      // Add to retry queue
      await this._addToRetryQueue(endpointId, webhook, event);
      
      this.emit('webhook-failed', { endpointId, error: error.message });
      throw error;
    }
  }

  async _addToRetryQueue(endpointId, webhook, event) {
    const retryQueue = this.retryQueues.get(endpointId);
    const attempt = (event._retryAttempt || 0) + 1;
    
    if (attempt <= this.options.maxRetries) {
      const delay = Math.min(
        this.options.initialDelay * Math.pow(this.options.exponentialBase, attempt - 1),
        this.options.maxDelay
      );
      
      retryQueue.push({
        webhook,
        event: { ...event, _retryAttempt: attempt },
        scheduledFor: this.getDeterministicTimestamp() + delay
      });
      
      this.metrics.retriedDeliveries++;
      this.emit('webhook-retry-scheduled', { endpointId, attempt, delay });
    } else {
      // Send to dead letter queue
      await this._sendToDeadLetterQueue(endpointId, webhook, event);
    }
  }

  async _processRetryQueues() {
    const now = this.getDeterministicTimestamp();
    
    for (const [endpointId, retryQueue] of this.retryQueues.entries()) {
      const readyItems = retryQueue.filter(item => item.scheduledFor <= now);
      
      if (readyItems.length === 0) continue;
      
      // Remove processed items from queue
      this.retryQueues.set(
        endpointId,
        retryQueue.filter(item => item.scheduledFor > now)
      );
      
      // Process ready retry items
      for (const { webhook, event } of readyItems) {
        try {
          await this._deliverToWebhook(endpointId, webhook, event);
        } catch (error) {
          // Error already handled in _deliverToWebhook
        }
      }
    }
  }

  async _sendToDeadLetterQueue(endpointId, webhook, event) {
    const deadLetterEvent = {
      type: 'webhook_delivery_failed',
      timestamp: this.getDeterministicDate().toISOString(),
      webhook_endpoint: endpointId,
      webhook_url: webhook.url,
      original_event: event,
      failure_reason: 'Max retries exceeded',
      retry_attempts: this.options.maxRetries
    };
    
    await this.deadLetterLogger.logEvent(deadLetterEvent);
    this.metrics.deadLetterEvents++;
    this.emit('dead-letter-queued', { endpointId, event: event.event_id });
  }

  _checkCircuitBreaker(endpointId) {
    const circuitBreaker = this.circuitBreakers.get(endpointId);
    const now = this.getDeterministicTimestamp();
    
    switch (circuitBreaker.state) {
      case 'closed':
        return true;
        
      case 'open':
        if (now >= circuitBreaker.nextAttempt) {
          circuitBreaker.state = 'half-open';
          return true;
        }
        return false;
        
      case 'half-open':
        return true;
        
      default:
        return false;
    }
  }

  _recordFailure(endpointId, error) {
    const circuitBreaker = this.circuitBreakers.get(endpointId);
    circuitBreaker.failures++;
    circuitBreaker.lastFailure = error.message;
    
    if (circuitBreaker.failures >= this.options.circuitBreakerThreshold) {
      circuitBreaker.state = 'open';
      circuitBreaker.nextAttempt = this.getDeterministicTimestamp() + this.options.circuitBreakerTimeout;
      this.metrics.circuitBreakerTrips++;
      this.emit('circuit-breaker-opened', { endpointId, failures: circuitBreaker.failures });
    }
  }

  _resetCircuitBreaker(endpointId) {
    const circuitBreaker = this.circuitBreakers.get(endpointId);
    circuitBreaker.state = 'closed';
    circuitBreaker.failures = 0;
    circuitBreaker.lastFailure = null;
  }

  _createWebhookPayload(event, webhook) {
    const payload = {
      timestamp: this.getDeterministicDate().toISOString(),
      webhook_id: webhook.id,
      event_type: event.type,
      event_data: event
    };
    
    // Add signature if webhook has secret
    if (webhook.secret) {
      const signature = createHmac('sha256', webhook.secret)
        .update(JSON.stringify(payload))
        .digest('hex');
      payload.signature = signature;
    }
    
    return payload;
  }

  async _sendWebhookRequest(webhook, payload) {
    // In production, use fetch or http client
    // This is a mock implementation
    console.log(`[WEBHOOK] Delivering to ${webhook.url}:`, JSON.stringify(payload).slice(0, 100) + '...');
    
    // Simulate network call
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        // Simulate 95% success rate
        if (Math.random() > 0.05) {
          resolve({ ok: true, status: 200 });
        } else {
          reject(new Error('Network timeout'));
        }
      }, Math.random() * 100);
    });
  }

  _eventPassesFilters(event, filters) {
    if (!filters || filters.length === 0) return true;
    
    return filters.some(filter => {
      for (const [key, value] of Object.entries(filter)) {
        const eventValue = this._getNestedValue(event, key);
        if (eventValue !== value) return false;
      }
      return true;
    });
  }

  _getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  getMetrics() {
    return {
      ...this.metrics,
      activeWebhooks: this.webhooks.size,
      circuitBreakersOpen: Array.from(this.circuitBreakers.values())
        .filter(cb => cb.state === 'open').length,
      queuedRetries: Array.from(this.retryQueues.values())
        .reduce((total, queue) => total + queue.length, 0)
    };
  }

  async shutdown() {
    // Process remaining retry queues
    await this._processRetryQueues();
    
    // Shutdown dead letter logger
    await this.deadLetterLogger.shutdown();
  }
}

/**
 * Performance Impact Monitor
 * Fixes: Real-time performance monitoring gaps
 */
export class AuditPerformanceMonitor extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      monitoringInterval: options.monitoringInterval || 5000,
      performanceThresholds: {
        maxLatency: options.maxLatency || 100, // ms
        maxMemoryUsage: options.maxMemoryUsage || 100, // MB
        maxCpuUsage: options.maxCpuUsage || 10, // %
        maxEventRate: options.maxEventRate || 10000 // events/second
      },
      alertCooldown: options.alertCooldown || 60000, // 1 minute
      ...options
    };
    
    this.metrics = {
      eventCount: 0,
      totalLatency: 0,
      maxLatency: 0,
      minLatency: Infinity,
      errorCount: 0,
      lastResetTime: this.getDeterministicTimestamp()
    };
    
    this.lastAlerts = new Map();
    this.monitoringTimer = null;
    this.performanceEntries = [];
    
    this.startMonitoring();
  }

  startMonitoring() {
    this.monitoringTimer = setInterval(() => {
      this._checkPerformanceThresholds();
      this._resetMetrics();
    }, this.options.monitoringInterval);
  }

  recordEventLatency(latency) {
    this.metrics.eventCount++;
    this.metrics.totalLatency += latency;
    this.metrics.maxLatency = Math.max(this.metrics.maxLatency, latency);
    this.metrics.minLatency = Math.min(this.metrics.minLatency, latency);
    
    this.performanceEntries.push({
      timestamp: this.getDeterministicTimestamp(),
      latency,
      type: 'event_processing'
    });
    
    // Keep only last 1000 entries
    if (this.performanceEntries.length > 1000) {
      this.performanceEntries = this.performanceEntries.slice(-1000);
    }
  }

  recordError(error) {
    this.metrics.errorCount++;
    this.emit('audit-error', { error: error.message, timestamp: this.getDeterministicTimestamp() });
  }

  _checkPerformanceThresholds() {
    const currentMetrics = this.getCurrentMetrics();
    const thresholds = this.options.performanceThresholds;
    
    // Check latency threshold
    if (currentMetrics.averageLatency > thresholds.maxLatency) {
      this._triggerAlert('high_latency', {
        current: currentMetrics.averageLatency,
        threshold: thresholds.maxLatency,
        severity: 'warning'
      });
    }
    
    // Check memory usage
    const memoryUsage = process.memoryUsage();
    const memoryMB = memoryUsage.heapUsed / (1024 * 1024);
    if (memoryMB > thresholds.maxMemoryUsage) {
      this._triggerAlert('high_memory', {
        current: memoryMB,
        threshold: thresholds.maxMemoryUsage,
        severity: 'warning'
      });
    }
    
    // Check event rate
    const eventRate = this.metrics.eventCount / (this.options.monitoringInterval / 1000);
    if (eventRate > thresholds.maxEventRate) {
      this._triggerAlert('high_event_rate', {
        current: eventRate,
        threshold: thresholds.maxEventRate,
        severity: 'critical'
      });
    }
    
    // Check error rate
    const errorRate = this.metrics.errorCount / Math.max(this.metrics.eventCount, 1);
    if (errorRate > 0.01) { // 1% error rate threshold
      this._triggerAlert('high_error_rate', {
        current: errorRate * 100,
        threshold: 1,
        severity: 'critical'
      });
    }
  }

  _triggerAlert(alertType, data) {
    const now = this.getDeterministicTimestamp();
    const lastAlert = this.lastAlerts.get(alertType);
    
    // Check cooldown
    if (lastAlert && (now - lastAlert) < this.options.alertCooldown) {
      return;
    }
    
    this.lastAlerts.set(alertType, now);
    
    const alert = {
      type: alertType,
      timestamp: now,
      message: `Audit performance threshold exceeded: ${alertType}`,
      data,
      processId: process.pid
    };
    
    this.emit('performance-alert', alert);
    
    // Log alert as audit event
    this.emit('audit-event', {
      type: 'performance_alert',
      category: 'system',
      severity: data.severity,
      details: alert
    });
  }

  getCurrentMetrics() {
    const timeWindow = this.getDeterministicTimestamp() - this.metrics.lastResetTime;
    const memoryUsage = process.memoryUsage();
    
    return {
      eventCount: this.metrics.eventCount,
      eventRate: this.metrics.eventCount / (timeWindow / 1000),
      averageLatency: this.metrics.eventCount > 0 
        ? this.metrics.totalLatency / this.metrics.eventCount 
        : 0,
      maxLatency: this.metrics.maxLatency,
      minLatency: this.metrics.minLatency === Infinity ? 0 : this.metrics.minLatency,
      errorCount: this.metrics.errorCount,
      errorRate: this.metrics.errorCount / Math.max(this.metrics.eventCount, 1),
      memoryUsage: {
        heapUsed: memoryUsage.heapUsed / (1024 * 1024), // MB
        heapTotal: memoryUsage.heapTotal / (1024 * 1024), // MB
        external: memoryUsage.external / (1024 * 1024) // MB
      },
      cpuUsage: process.cpuUsage(),
      uptime: process.uptime(),
      timestamp: this.getDeterministicTimestamp()
    };
  }

  _resetMetrics() {
    this.metrics = {
      eventCount: 0,
      totalLatency: 0,
      maxLatency: 0,
      minLatency: Infinity,
      errorCount: 0,
      lastResetTime: this.getDeterministicTimestamp()
    };
  }

  stopMonitoring() {
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = null;
    }
  }
}

/**
 * Integration Example: Enhanced Audit System
 */
export class EnhancedAuditSystem {
  constructor(options = {}) {
    this.logger = new JSONLAuditLogger(options.logger);
    this.webhookDelivery = new ReliableWebhookDelivery(options.webhooks);
    this.performanceMonitor = new AuditPerformanceMonitor(options.performance);
    
    this._setupEventHandlers();
  }

  _setupEventHandlers() {
    // Connect performance monitoring to audit logging
    this.performanceMonitor.on('audit-event', async (event) => {
      await this.logger.logEvent(event);
    });
    
    // Connect logger to webhook delivery
    this.logger.on('event-logged', async (event) => {
      const startTime = performance.now();
      
      try {
        await this.webhookDelivery.deliverEvent(event);
        const latency = performance.now() - startTime;
        this.performanceMonitor.recordEventLatency(latency);
      } catch (error) {
        this.performanceMonitor.recordError(error);
      }
    });
    
    // Handle performance alerts
    this.performanceMonitor.on('performance-alert', (alert) => {
      console.warn('[AUDIT-PERFORMANCE]', alert);
    });
  }

  async logAuditEvent(event) {
    return await this.logger.logEvent(event);
  }

  registerWebhook(endpointId, config) {
    return this.webhookDelivery.registerWebhook(endpointId, config);
  }

  getSystemMetrics() {
    return {
      logger: this.logger.getMetrics(),
      webhooks: this.webhookDelivery.getMetrics(),
      performance: this.performanceMonitor.getCurrentMetrics()
    };
  }

  async shutdown() {
    this.performanceMonitor.stopMonitoring();
    await this.webhookDelivery.shutdown();
    await this.logger.shutdown();
  }
}

export default EnhancedAuditSystem;