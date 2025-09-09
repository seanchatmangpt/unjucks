/**
 * Enterprise Webhook and Event Streaming System
 * Supports reliable delivery, retries, and real-time event streaming
 */

import { EventEmitter } from 'events';
import crypto from 'crypto';
import { setTimeout } from 'timers/promises';
import logger from '../../lib/observability/logger.js';

export class WebhookStreaming extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = {
      maxRetries: 3,
      retryDelayMs: 1000,
      timeoutMs: 30000,
      maxConcurrentDeliveries: 10,
      enableSigning: true,
      signingSecret: process.env.WEBHOOK_SIGNING_SECRET || 'default-secret',
      signingAlgorithm: 'sha256',
      enableReplay: true,
      replayWindowHours: 24,
      enableFiltering: true,
      enableBatching: false,
      batchSize: 10,
      batchTimeoutMs: 5000,
      ...config
    };

    this.webhooks = new Map();
    this.eventStreams = new Map();
    this.deliveryQueue = [];
    this.activeDeliveries = new Set();
    this.failedDeliveries = new Map();
    this.eventHistory = new Map();
    this.subscriptions = new Map();
    
    this.setupEventProcessing();
  }

  setupEventProcessing() {
    // Start delivery worker
    this.deliveryWorker = setInterval(() => {
      this.processDeliveryQueue();
    }, 100);

    // Cleanup old events periodically
    this.cleanupWorker = setInterval(() => {
      this.cleanupOldEvents();
    }, 60000); // 1 minute
  }

  // Webhook Management
  registerWebhook(id, config) {
    const webhook = {
      id,
      url: config.url,
      events: config.events || ['*'],
      secret: config.secret || this.generateSecret(),
      active: config.active !== false,
      retryPolicy: {
        maxRetries: config.maxRetries || this.config.maxRetries,
        delayMs: config.retryDelayMs || this.config.retryDelayMs
      },
      filters: config.filters || {},
      headers: config.headers || {},
      createdAt: new Date(),
      lastDelivery: null,
      deliveryCount: 0,
      errorCount: 0,
      ...config
    };

    this.webhooks.set(id, webhook);
    logger.info(`Webhook registered: ${id}`, { url: webhook.url, events: webhook.events });
    
    this.emit('webhook:registered', webhook);
    return webhook;
  }

  updateWebhook(id, updates) {
    const webhook = this.webhooks.get(id);
    if (!webhook) {
      throw new Error(`Webhook not found: ${id}`);
    }

    Object.assign(webhook, updates, { updatedAt: new Date() });
    this.webhooks.set(id, webhook);
    
    this.emit('webhook:updated', webhook);
    return webhook;
  }

  removeWebhook(id) {
    const webhook = this.webhooks.get(id);
    if (webhook) {
      this.webhooks.delete(id);
      this.emit('webhook:removed', { id, webhook });
      logger.info(`Webhook removed: ${id}`);
    }
  }

  // Event Streaming
  createEventStream(id, config) {
    const stream = {
      id,
      name: config.name,
      description: config.description,
      events: config.events || ['*'],
      filters: config.filters || {},
      active: config.active !== false,
      subscribers: new Set(),
      messageCount: 0,
      createdAt: new Date(),
      ...config
    };

    this.eventStreams.set(id, stream);
    logger.info(`Event stream created: ${id}`, { events: stream.events });
    
    this.emit('stream:created', stream);
    return stream;
  }

  subscribeToStream(streamId, subscriber) {
    const stream = this.eventStreams.get(streamId);
    if (!stream) {
      throw new Error(`Event stream not found: ${streamId}`);
    }

    const subscription = {
      id: crypto.randomUUID(),
      streamId,
      subscriber,
      subscribedAt: new Date(),
      messageCount: 0
    };

    stream.subscribers.add(subscription);
    this.subscriptions.set(subscription.id, subscription);
    
    this.emit('stream:subscribed', { streamId, subscription });
    return subscription;
  }

  unsubscribeFromStream(subscriptionId) {
    const subscription = this.subscriptions.get(subscriptionId);
    if (subscription) {
      const stream = this.eventStreams.get(subscription.streamId);
      if (stream) {
        stream.subscribers.delete(subscription);
      }
      this.subscriptions.delete(subscriptionId);
      
      this.emit('stream:unsubscribed', subscription);
    }
  }

  // Event Publishing
  async publishEvent(eventType, payload, metadata = {}) {
    const event = {
      id: crypto.randomUUID(),
      type: eventType,
      payload,
      metadata: {
        source: 'unjucks-enterprise',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        correlationId: metadata.correlationId || crypto.randomUUID(),
        ...metadata
      },
      publishedAt: new Date()
    };

    // Store event for replay capability
    if (this.config.enableReplay) {
      this.eventHistory.set(event.id, event);
    }

    // Deliver to webhooks
    await this.deliverToWebhooks(event);
    
    // Stream to event streams
    await this.streamToSubscribers(event);
    
    this.emit('event:published', event);
    return event;
  }

  async deliverToWebhooks(event) {
    const relevantWebhooks = this.findRelevantWebhooks(event);
    
    for (const webhook of relevantWebhooks) {
      if (!this.shouldDeliverToWebhook(webhook, event)) {
        continue;
      }

      const delivery = {
        id: crypto.randomUUID(),
        webhookId: webhook.id,
        eventId: event.id,
        event,
        webhook,
        attempts: 0,
        status: 'pending',
        createdAt: new Date()
      };

      this.deliveryQueue.push(delivery);
    }
  }

  async streamToSubscribers(event) {
    const relevantStreams = this.findRelevantStreams(event);
    
    for (const stream of relevantStreams) {
      if (!this.shouldStreamEvent(stream, event)) {
        continue;
      }

      for (const subscription of stream.subscribers) {
        try {
          await this.deliverToSubscriber(subscription, event);
          subscription.messageCount++;
        } catch (error) {
          logger.error('Failed to deliver to subscriber', {
            subscriptionId: subscription.id,
            eventId: event.id,
            error: error.message
          });
        }
      }
      
      stream.messageCount++;
    }
  }

  async deliverToSubscriber(subscription, event) {
    if (typeof subscription.subscriber === 'function') {
      // Function subscriber
      await subscription.subscriber(event);
    } else if (subscription.subscriber.write) {
      // Stream subscriber
      subscription.subscriber.write(JSON.stringify(event) + '\n');
    } else if (subscription.subscriber.send) {
      // WebSocket subscriber
      subscription.subscriber.send(JSON.stringify(event));
    }
  }

  async processDeliveryQueue() {
    if (this.deliveryQueue.length === 0 || 
        this.activeDeliveries.size >= this.config.maxConcurrentDeliveries) {
      return;
    }

    const delivery = this.deliveryQueue.shift();
    this.activeDeliveries.add(delivery.id);
    
    try {
      await this.attemptDelivery(delivery);
    } catch (error) {
      logger.error('Delivery processing failed', {
        deliveryId: delivery.id,
        error: error.message
      });
    } finally {
      this.activeDeliveries.delete(delivery.id);
    }
  }

  async attemptDelivery(delivery) {
    delivery.attempts++;
    delivery.status = 'delivering';
    delivery.lastAttempt = new Date();

    try {
      const signature = this.generateSignature(delivery.event, delivery.webhook.secret);
      const headers = {
        'Content-Type': 'application/json',
        'User-Agent': 'Unjucks-Enterprise-Webhook/1.0',
        'X-Event-Type': delivery.event.type,
        'X-Event-ID': delivery.event.id,
        'X-Delivery-ID': delivery.id,
        'X-Signature': signature,
        ...delivery.webhook.headers
      };

      const response = await this.makeHttpRequest(
        delivery.webhook.url,
        {
          method: 'POST',
          headers,
          body: JSON.stringify(delivery.event),
          timeout: this.config.timeoutMs
        }
      );

      if (response.status >= 200 && response.status < 300) {
        delivery.status = 'delivered';
        delivery.deliveredAt = new Date();
        delivery.webhook.lastDelivery = new Date();
        delivery.webhook.deliveryCount++;
        
        this.emit('delivery:success', delivery);
        logger.info('Webhook delivery successful', {
          deliveryId: delivery.id,
          webhookId: delivery.webhook.id,
          status: response.status
        });
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      delivery.status = 'failed';
      delivery.error = error.message;
      delivery.webhook.errorCount++;
      
      if (delivery.attempts < delivery.webhook.retryPolicy.maxRetries) {
        // Schedule retry
        const retryDelay = this.calculateRetryDelay(delivery.attempts, delivery.webhook.retryPolicy);
        setTimeout(() => {
          this.deliveryQueue.push(delivery);
        }, retryDelay);
        
        logger.warn('Webhook delivery failed, retrying', {
          deliveryId: delivery.id,
          attempt: delivery.attempts,
          retryDelay,
          error: error.message
        });
      } else {
        // Max retries exceeded
        this.failedDeliveries.set(delivery.id, delivery);
        this.emit('delivery:failed', delivery);
        
        logger.error('Webhook delivery failed after max retries', {
          deliveryId: delivery.id,
          attempts: delivery.attempts,
          error: error.message
        });
      }
    }
  }

  generateSignature(event, secret) {
    if (!this.config.enableSigning) {
      return '';
    }

    const payload = JSON.stringify(event);
    const hmac = crypto.createHmac(this.config.signingAlgorithm, secret);
    hmac.update(payload);
    return `${this.config.signingAlgorithm}=${hmac.digest('hex')}`;
  }

  verifySignature(payload, signature, secret) {
    const expectedSignature = this.generateSignature(payload, secret);
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  calculateRetryDelay(attempt, retryPolicy) {
    // Exponential backoff with jitter
    const baseDelay = retryPolicy.delayMs;
    const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
    const jitter = Math.random() * 0.1 * exponentialDelay;
    return Math.min(exponentialDelay + jitter, 30000); // Max 30 seconds
  }

  findRelevantWebhooks(event) {
    const relevant = [];
    
    for (const webhook of this.webhooks.values()) {
      if (!webhook.active) continue;
      
      if (webhook.events.includes('*') || webhook.events.includes(event.type)) {
        relevant.push(webhook);
      }
    }
    
    return relevant;
  }

  findRelevantStreams(event) {
    const relevant = [];
    
    for (const stream of this.eventStreams.values()) {
      if (!stream.active) continue;
      
      if (stream.events.includes('*') || stream.events.includes(event.type)) {
        relevant.push(stream);
      }
    }
    
    return relevant;
  }

  shouldDeliverToWebhook(webhook, event) {
    if (!webhook.filters || Object.keys(webhook.filters).length === 0) {
      return true;
    }

    return this.matchesFilters(event, webhook.filters);
  }

  shouldStreamEvent(stream, event) {
    if (!stream.filters || Object.keys(stream.filters).length === 0) {
      return true;
    }

    return this.matchesFilters(event, stream.filters);
  }

  matchesFilters(event, filters) {
    for (const [field, expectedValue] of Object.entries(filters)) {
      const actualValue = this.getNestedValue(event, field);
      
      if (Array.isArray(expectedValue)) {
        if (!expectedValue.includes(actualValue)) {
          return false;
        }
      } else if (actualValue !== expectedValue) {
        return false;
      }
    }
    
    return true;
  }

  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  async makeHttpRequest(url, options) {
    // Mock HTTP request - replace with actual implementation (fetch, axios, etc.)
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          status: 200,
          statusText: 'OK'
        });
      }, 100);
    });
  }

  generateSecret() {
    return crypto.randomBytes(32).toString('hex');
  }

  cleanupOldEvents() {
    if (!this.config.enableReplay) return;
    
    const cutoffTime = new Date(Date.now() - (this.config.replayWindowHours * 60 * 60 * 1000));
    let cleaned = 0;
    
    for (const [id, event] of this.eventHistory) {
      if (event.publishedAt < cutoffTime) {
        this.eventHistory.delete(id);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      logger.info(`Cleaned up ${cleaned} old events`);
    }
  }

  // Event Replay
  async replayEvents(webhookId, fromTime, toTime = new Date()) {
    const webhook = this.webhooks.get(webhookId);
    if (!webhook) {
      throw new Error(`Webhook not found: ${webhookId}`);
    }

    const events = Array.from(this.eventHistory.values())
      .filter(event => 
        event.publishedAt >= fromTime && 
        event.publishedAt <= toTime &&
        this.shouldDeliverToWebhook(webhook, event)
      )
      .sort((a, b) => a.publishedAt - b.publishedAt);

    logger.info(`Replaying ${events.length} events to webhook ${webhookId}`);
    
    for (const event of events) {
      await this.deliverToWebhooks(event);
    }
    
    return events.length;
  }

  // Management and Monitoring
  getWebhooks() {
    return Array.from(this.webhooks.values());
  }

  getEventStreams() {
    return Array.from(this.eventStreams.values());
  }

  getDeliveryStats() {
    const stats = {
      queueSize: this.deliveryQueue.length,
      activeDeliveries: this.activeDeliveries.size,
      failedDeliveries: this.failedDeliveries.size,
      totalWebhooks: this.webhooks.size,
      activeWebhooks: 0,
      totalStreams: this.eventStreams.size,
      activeStreams: 0,
      totalSubscriptions: this.subscriptions.size
    };

    for (const webhook of this.webhooks.values()) {
      if (webhook.active) stats.activeWebhooks++;
    }

    for (const stream of this.eventStreams.values()) {
      if (stream.active) stats.activeStreams++;
    }

    return stats;
  }

  getWebhookMetrics(webhookId) {
    const webhook = this.webhooks.get(webhookId);
    if (!webhook) return null;

    return {
      id: webhook.id,
      url: webhook.url,
      active: webhook.active,
      deliveryCount: webhook.deliveryCount,
      errorCount: webhook.errorCount,
      lastDelivery: webhook.lastDelivery,
      successRate: webhook.deliveryCount > 0 ? 
        ((webhook.deliveryCount - webhook.errorCount) / webhook.deliveryCount) * 100 : 0
    };
  }

  async stop() {
    if (this.deliveryWorker) {
      clearInterval(this.deliveryWorker);
    }
    
    if (this.cleanupWorker) {
      clearInterval(this.cleanupWorker);
    }
    
    // Wait for active deliveries to complete
    while (this.activeDeliveries.size > 0) {
      await setTimeout(100);
    }
    
    logger.info('Webhook and event streaming system stopped');
  }
}

export default WebhookStreaming;