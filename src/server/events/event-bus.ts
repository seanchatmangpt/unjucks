import { EventEmitter } from 'events';
import { dbManager } from '../config/database.js';
import { env } from '../config/environment.js';
import amqp from 'amqplib';
import { Kafka, Producer, Consumer } from 'kafkajs';

export interface EventPayload {
  type: string;
  source: string;
  data: any;
  metadata: {
    tenantId?: string;
    userId?: string;
    timestamp: Date;
    version: string;
    correlationId?: string;
    causationId?: string;
  };
  retryCount?: number;
  maxRetries?: number;
}

export interface EventHandler {
  handle(event: EventPayload): Promise<void>;
}

export interface EventSubscription {
  eventType: string;
  handler: EventHandler;
  retryPolicy?: {
    maxRetries: number;
    backoffMs: number;
    exponentialBackoff: boolean;
  };
  deadLetterQueue?: boolean;
}

abstract class EventBusAdapter {
  abstract publish(event: EventPayload): Promise<void>;
  abstract subscribe(subscription: EventSubscription): Promise<void>;
  abstract unsubscribe(eventType: string): Promise<void>;
  abstract start(): Promise<void>;
  abstract stop(): Promise<void>;
  abstract getHealth(): Promise<{ status: string; details: any }>;
}

// Redis-based event bus
class RedisEventBus extends EventBusAdapter {
  private subscriber: any;
  private publisher: any;
  private subscriptions = new Map<string, EventSubscription>();

  async start(): Promise<void> {
    this.publisher = dbManager.redis.duplicate();
    this.subscriber = dbManager.redis.duplicate();

    await Promise.all([
      this.publisher.connect(),
      this.subscriber.connect(),
    ]);

    // Setup message handler
    this.subscriber.on('message', this.handleMessage.bind(this));
    
    console.log('Redis EventBus started');
  }

  async stop(): Promise<void> {
    if (this.subscriber) {
      await this.subscriber.quit();
    }
    if (this.publisher) {
      await this.publisher.quit();
    }
  }

  async publish(event: EventPayload): Promise<void> {
    const channel = `events:${event.type}`;
    const message = JSON.stringify({
      ...event,
      metadata: {
        ...event.metadata,
        timestamp: event.metadata.timestamp.toISOString(),
      },
    });

    await this.publisher.publish(channel, message);
    
    // Also store in database for persistence and replay
    await this.storeEvent(event);
  }

  async subscribe(subscription: EventSubscription): Promise<void> {
    const channel = `events:${subscription.eventType}`;
    
    this.subscriptions.set(subscription.eventType, subscription);
    await this.subscriber.subscribe(channel);
  }

  async unsubscribe(eventType: string): Promise<void> {
    const channel = `events:${eventType}`;
    
    this.subscriptions.delete(eventType);
    await this.subscriber.unsubscribe(channel);
  }

  private async handleMessage(channel: string, message: string): Promise<void> {
    try {
      const eventType = channel.replace('events:', '');
      const subscription = this.subscriptions.get(eventType);
      
      if (!subscription) {
        return;
      }

      const event: EventPayload = JSON.parse(message);
      event.metadata.timestamp = new Date(event.metadata.timestamp);

      await this.processEvent(event, subscription);
    } catch (error) {
      console.error('Redis message handling error:', error);
    }
  }

  async getHealth(): Promise<{ status: string; details: any }> {
    try {
      await this.publisher.ping();
      return {
        status: 'healthy',
        details: {
          type: 'redis',
          subscriptions: this.subscriptions.size,
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          type: 'redis',
          error: error.message,
        },
      };
    }
  }

  private async processEvent(event: EventPayload, subscription: EventSubscription): Promise<void> {
    const retryPolicy = subscription.retryPolicy || {
      maxRetries: 3,
      backoffMs: 1000,
      exponentialBackoff: true,
    };

    try {
      await subscription.handler.handle(event);
    } catch (error) {
      console.error(`Event handler error for ${event.type}:`, error);
      
      const currentRetries = event.retryCount || 0;
      
      if (currentRetries < retryPolicy.maxRetries) {
        await this.scheduleRetry(event, subscription, currentRetries + 1, retryPolicy);
      } else if (subscription.deadLetterQueue) {
        await this.sendToDeadLetterQueue(event, error);
      }
    }
  }

  private async scheduleRetry(
    event: EventPayload,
    subscription: EventSubscription,
    retryCount: number,
    retryPolicy: any
  ): Promise<void> {
    const delay = retryPolicy.exponentialBackoff 
      ? retryPolicy.backoffMs * Math.pow(2, retryCount - 1)
      : retryPolicy.backoffMs;

    setTimeout(async () => {
      const retryEvent = {
        ...event,
        retryCount,
        metadata: {
          ...event.metadata,
          retryAttempt: retryCount,
        },
      };

      await this.processEvent(retryEvent, subscription);
    }, delay);
  }

  private async sendToDeadLetterQueue(event: EventPayload, error: any): Promise<void> {
    const dlqChannel = `dlq:${event.type}`;
    const dlqMessage = JSON.stringify({
      ...event,
      error: {
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
      },
    });

    await this.publisher.publish(dlqChannel, dlqMessage);
  }

  private async storeEvent(event: EventPayload): Promise<void> {
    await dbManager.postgres.query(`
      INSERT INTO events (type, source, data, metadata, tenant_id, user_id, timestamp)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      event.type,
      event.source,
      JSON.stringify(event.data),
      JSON.stringify(event.metadata),
      event.metadata.tenantId,
      event.metadata.userId,
      event.metadata.timestamp,
    ]);
  }
}

// RabbitMQ-based event bus
class RabbitMQEventBus extends EventBusAdapter {
  private connection?: amqp.Connection;
  private channel?: amqp.Channel;
  private subscriptions = new Map<string, EventSubscription>();

  async start(): Promise<void> {
    this.connection = await amqp.connect(env.RABBITMQ_URL!);
    this.channel = await this.connection.createChannel();

    // Create dead letter exchange
    await this.channel.assertExchange('dlx', 'direct', { durable: true });
    await this.channel.assertQueue('dlq', {
      durable: true,
      arguments: { 'x-message-ttl': 86400000 }, // 24 hours
    });
    await this.channel.bindQueue('dlq', 'dlx', 'dlq');

    console.log('RabbitMQ EventBus started');
  }

  async stop(): Promise<void> {
    if (this.channel) {
      await this.channel.close();
    }
    if (this.connection) {
      await this.connection.close();
    }
  }

  async publish(event: EventPayload): Promise<void> {
    if (!this.channel) {
      throw new Error('EventBus not started');
    }

    const exchange = 'events';
    const routingKey = event.type;

    await this.channel.assertExchange(exchange, 'topic', { durable: true });

    const message = Buffer.from(JSON.stringify({
      ...event,
      metadata: {
        ...event.metadata,
        timestamp: event.metadata.timestamp.toISOString(),
      },
    }));

    await this.channel.publish(exchange, routingKey, message, {
      persistent: true,
      timestamp: Date.now(),
      messageId: event.metadata.correlationId,
    });

    await this.storeEvent(event);
  }

  async subscribe(subscription: EventSubscription): Promise<void> {
    if (!this.channel) {
      throw new Error('EventBus not started');
    }

    const exchange = 'events';
    const queue = `queue.${subscription.eventType}`;

    await this.channel.assertExchange(exchange, 'topic', { durable: true });

    const queueOptions: any = {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': subscription.deadLetterQueue ? 'dlx' : undefined,
        'x-dead-letter-routing-key': subscription.deadLetterQueue ? 'dlq' : undefined,
      },
    };

    await this.channel.assertQueue(queue, queueOptions);
    await this.channel.bindQueue(queue, exchange, subscription.eventType);

    this.subscriptions.set(subscription.eventType, subscription);

    await this.channel.consume(queue, async (msg) => {
      if (!msg) return;

      try {
        const event: EventPayload = JSON.parse(msg.content.toString());
        event.metadata.timestamp = new Date(event.metadata.timestamp);

        await subscription.handler.handle(event);
        this.channel!.ack(msg);
      } catch (error) {
        console.error(`RabbitMQ event handler error:`, error);
        
        const retryCount = (msg.properties.headers?.['x-retry-count'] || 0) + 1;
        const maxRetries = subscription.retryPolicy?.maxRetries || 3;

        if (retryCount <= maxRetries) {
          // Requeue with retry count
          await this.channel!.publish('events', subscription.eventType, msg.content, {
            ...msg.properties,
            headers: {
              ...msg.properties.headers,
              'x-retry-count': retryCount,
            },
          });
          this.channel!.ack(msg);
        } else {
          // Send to DLQ
          this.channel!.nack(msg, false, false);
        }
      }
    });
  }

  async unsubscribe(eventType: string): Promise<void> {
    if (!this.channel) {
      return;
    }

    const queue = `queue.${eventType}`;
    await this.channel.deleteQueue(queue);
    this.subscriptions.delete(eventType);
  }

  async getHealth(): Promise<{ status: string; details: any }> {
    try {
      if (!this.connection || !this.channel) {
        throw new Error('Connection not established');
      }

      return {
        status: 'healthy',
        details: {
          type: 'rabbitmq',
          subscriptions: this.subscriptions.size,
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          type: 'rabbitmq',
          error: error.message,
        },
      };
    }
  }

  private async storeEvent(event: EventPayload): Promise<void> {
    await dbManager.postgres.query(`
      INSERT INTO events (type, source, data, metadata, tenant_id, user_id, timestamp)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      event.type,
      event.source,
      JSON.stringify(event.data),
      JSON.stringify(event.metadata),
      event.metadata.tenantId,
      event.metadata.userId,
      event.metadata.timestamp,
    ]);
  }
}

// Kafka-based event bus
class KafkaEventBus extends EventBusAdapter {
  private kafka?: Kafka;
  private producer?: Producer;
  private consumers = new Map<string, Consumer>();
  private subscriptions = new Map<string, EventSubscription>();

  async start(): Promise<void> {
    this.kafka = new Kafka({
      clientId: 'unjucks-enterprise',
      brokers: env.KAFKA_BROKERS!.split(','),
    });

    this.producer = this.kafka.producer({
      maxInFlightRequests: 1,
      idempotent: true,
      transactionTimeout: 30000,
    });

    await this.producer.connect();
    
    console.log('Kafka EventBus started');
  }

  async stop(): Promise<void> {
    if (this.producer) {
      await this.producer.disconnect();
    }

    for (const consumer of this.consumers.values()) {
      await consumer.disconnect();
    }
  }

  async publish(event: EventPayload): Promise<void> {
    if (!this.producer) {
      throw new Error('EventBus not started');
    }

    const topic = `events.${event.type}`;

    await this.producer.send({
      topic,
      messages: [{
        key: event.metadata.tenantId || 'default',
        value: JSON.stringify({
          ...event,
          metadata: {
            ...event.metadata,
            timestamp: event.metadata.timestamp.toISOString(),
          },
        }),
        timestamp: event.metadata.timestamp.getTime().toString(),
        headers: {
          correlationId: event.metadata.correlationId || '',
          causationId: event.metadata.causationId || '',
          version: event.metadata.version,
        },
      }],
    });

    await this.storeEvent(event);
  }

  async subscribe(subscription: EventSubscription): Promise<void> {
    if (!this.kafka) {
      throw new Error('EventBus not started');
    }

    const topic = `events.${subscription.eventType}`;
    const groupId = `unjucks-${subscription.eventType}-handler`;

    const consumer = this.kafka.consumer({
      groupId,
      sessionTimeout: 30000,
      rebalanceTimeout: 60000,
    });

    await consumer.connect();
    await consumer.subscribe({ topic, fromBeginning: false });

    this.consumers.set(subscription.eventType, consumer);
    this.subscriptions.set(subscription.eventType, subscription);

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          if (!message.value) return;

          const event: EventPayload = JSON.parse(message.value.toString());
          event.metadata.timestamp = new Date(event.metadata.timestamp);

          await subscription.handler.handle(event);
        } catch (error) {
          console.error(`Kafka event handler error:`, error);
          
          // Kafka has built-in retry mechanisms and dead letter topics
          // that can be configured at the topic level
        }
      },
    });
  }

  async unsubscribe(eventType: string): Promise<void> {
    const consumer = this.consumers.get(eventType);
    if (consumer) {
      await consumer.disconnect();
      this.consumers.delete(eventType);
    }
    this.subscriptions.delete(eventType);
  }

  async getHealth(): Promise<{ status: string; details: any }> {
    try {
      if (!this.producer) {
        throw new Error('Producer not connected');
      }

      return {
        status: 'healthy',
        details: {
          type: 'kafka',
          subscriptions: this.subscriptions.size,
          consumers: this.consumers.size,
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          type: 'kafka',
          error: error.message,
        },
      };
    }
  }

  private async storeEvent(event: EventPayload): Promise<void> {
    await dbManager.postgres.query(`
      INSERT INTO events (type, source, data, metadata, tenant_id, user_id, timestamp)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      event.type,
      event.source,
      JSON.stringify(event.data),
      JSON.stringify(event.metadata),
      event.metadata.tenantId,
      event.metadata.userId,
      event.metadata.timestamp,
    ]);
  }
}

// Main EventBus class
class EventBus extends EventEmitter {
  private adapter: EventBusAdapter;
  private eventHandlers = new Map<string, Set<EventHandler>>();

  constructor() {
    super();
    
    // Choose adapter based on configuration
    switch (env.EVENT_BUS_TYPE) {
      case 'rabbitmq':
        if (!env.RABBITMQ_URL) {
          throw new Error('RABBITMQ_URL required for RabbitMQ event bus');
        }
        this.adapter = new RabbitMQEventBus();
        break;
      
      case 'kafka':
        if (!env.KAFKA_BROKERS) {
          throw new Error('KAFKA_BROKERS required for Kafka event bus');
        }
        this.adapter = new KafkaEventBus();
        break;
      
      default:
        this.adapter = new RedisEventBus();
    }
  }

  async start(): Promise<void> {
    await this.adapter.start();
    console.log(`EventBus started with ${env.EVENT_BUS_TYPE} adapter`);
  }

  async stop(): Promise<void> {
    await this.adapter.stop();
    this.eventHandlers.clear();
  }

  async publish(event: Omit<EventPayload, 'metadata'> & { metadata?: Partial<EventPayload['metadata']> }): Promise<void> {
    const fullEvent: EventPayload = {
      ...event,
      metadata: {
        timestamp: new Date(),
        version: '1.0.0',
        ...event.metadata,
      },
    };

    // Emit locally first
    this.emit(event.type, fullEvent);
    
    // Then publish to adapter
    await this.adapter.publish(fullEvent);
  }

  async subscribe(eventType: string, handler: EventHandler, options?: {
    retryPolicy?: EventSubscription['retryPolicy'];
    deadLetterQueue?: boolean;
  }): Promise<void> {
    // Add local handler
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, new Set());
    }
    this.eventHandlers.get(eventType)!.add(handler);
    
    // Local event handling
    this.on(eventType, async (event: EventPayload) => {
      try {
        await handler.handle(event);
      } catch (error) {
        console.error(`Local event handler error for ${eventType}:`, error);
        this.emit('error', error, event);
      }
    });

    // Subscribe via adapter for distributed events
    await this.adapter.subscribe({
      eventType,
      handler,
      retryPolicy: options?.retryPolicy,
      deadLetterQueue: options?.deadLetterQueue,
    });
  }

  async unsubscribe(eventType: string, handler?: EventHandler): Promise<void> {
    if (handler) {
      const handlers = this.eventHandlers.get(eventType);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          this.eventHandlers.delete(eventType);
        }
      }
      this.removeListener(eventType, handler.handle);
    } else {
      // Remove all handlers for event type
      this.eventHandlers.delete(eventType);
      this.removeAllListeners(eventType);
      await this.adapter.unsubscribe(eventType);
    }
  }

  async getHealth(): Promise<{ status: string; details: any }> {
    const adapterHealth = await this.adapter.getHealth();
    
    return {
      status: adapterHealth.status,
      details: {
        ...adapterHealth.details,
        localHandlers: this.eventHandlers.size,
        listenerCount: this.listenerCount,
      },
    };
  }

  // Event replay functionality
  async replayEvents(criteria: {
    tenantId?: string;
    eventType?: string;
    fromDate?: Date;
    toDate?: Date;
    limit?: number;
  }): Promise<void> {
    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (criteria.tenantId) {
      conditions.push(`tenant_id = $${paramIndex}`);
      values.push(criteria.tenantId);
      paramIndex++;
    }

    if (criteria.eventType) {
      conditions.push(`type = $${paramIndex}`);
      values.push(criteria.eventType);
      paramIndex++;
    }

    if (criteria.fromDate) {
      conditions.push(`timestamp >= $${paramIndex}`);
      values.push(criteria.fromDate);
      paramIndex++;
    }

    if (criteria.toDate) {
      conditions.push(`timestamp <= $${paramIndex}`);
      values.push(criteria.toDate);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = criteria.limit ? `LIMIT ${criteria.limit}` : '';

    const query = `
      SELECT * FROM events 
      ${whereClause}
      ORDER BY timestamp ASC
      ${limit}
    `;

    const result = await dbManager.postgres.query(query, values);

    for (const row of result.rows) {
      const event: EventPayload = {
        type: row.type,
        source: row.source,
        data: row.data,
        metadata: {
          ...row.metadata,
          timestamp: row.timestamp,
          replay: true,
        },
      };

      // Emit as local event only (don't republish)
      this.emit(event.type, event);
    }
  }
}

// Export singleton instance
export const eventBus = new EventBus();
export { EventBus, EventBusAdapter, EventPayload, EventHandler, EventSubscription };