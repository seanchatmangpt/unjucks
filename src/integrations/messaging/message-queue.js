/**
 * Enterprise Message Queue Integration
 * Supports multiple message brokers (Kafka, RabbitMQ, Redis) with enterprise features
 */

import { EventEmitter } from 'events';
import crypto from 'crypto';
import logger from '../../lib/observability/logger.js';

export class MessageQueueIntegration extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = {
      defaultBroker: 'redis',
      enableDeadLetterQueue: true,
      enablePoisonMessageHandling: true,
      maxRetries: 3,
      retryBackoffMs: 1000,
      messageTimeoutMs: 30000,
      enableBatching: true,
      batchSize: 10,
      batchTimeoutMs: 5000,
      enableCompression: false,
      enableEncryption: false,
      encryptionKey: process.env.MQ_ENCRYPTION_KEY,
      ...config
    };

    this.brokers = new Map();
    this.queues = new Map();
    this.consumers = new Map();
    this.producers = new Map();
    this.deadLetterQueues = new Map();
    this.messageHandlers = new Map();
    this.metrics = new Map();
    
    this.setupBrokers();
  }

  setupBrokers() {
    // Redis broker setup
    this.registerBroker('redis', {
      type: 'redis',
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD,
      db: process.env.REDIS_DB || 0,
      keyPrefix: 'unjucks:mq:',
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100
    });

    // Kafka broker setup
    this.registerBroker('kafka', {
      type: 'kafka',
      brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
      clientId: process.env.KAFKA_CLIENT_ID || 'unjucks-enterprise',
      groupId: process.env.KAFKA_GROUP_ID || 'unjucks-consumers',
      ssl: process.env.KAFKA_SSL === 'true',
      sasl: process.env.KAFKA_SASL ? {
        mechanism: 'plain',
        username: process.env.KAFKA_USERNAME,
        password: process.env.KAFKA_PASSWORD
      } : undefined
    });

    // RabbitMQ broker setup
    this.registerBroker('rabbitmq', {
      type: 'rabbitmq',
      url: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
      heartbeat: 60,
      vhost: process.env.RABBITMQ_VHOST || '/',
      exchange: process.env.RABBITMQ_EXCHANGE || 'unjucks',
      exchangeType: 'topic'
    });
  }

  registerBroker(name, config) {
    this.brokers.set(name, {
      name,
      ...config,
      connected: false,
      connection: null,
      createdAt: this.getDeterministicDate()
    });
    
    logger.info(`Message broker registered: ${name}`, { type: config.type });
  }

  async connectBroker(brokerName) {
    const broker = this.brokers.get(brokerName);
    if (!broker) {
      throw new Error(`Unknown broker: ${brokerName}`);
    }

    if (broker.connected) {
      return broker.connection;
    }

    try {
      broker.connection = await this.createConnection(broker);
      broker.connected = true;
      broker.connectedAt = this.getDeterministicDate();
      
      this.emit('broker:connected', { brokerName, broker });
      logger.info(`Connected to message broker: ${brokerName}`);
      
      return broker.connection;
    } catch (error) {
      logger.error(`Failed to connect to broker: ${brokerName}`, error);
      throw error;
    }
  }

  async createConnection(broker) {
    switch (broker.type) {
      case 'redis':
        return this.createRedisConnection(broker);
      case 'kafka':
        return this.createKafkaConnection(broker);
      case 'rabbitmq':
        return this.createRabbitMQConnection(broker);
      default:
        throw new Error(`Unsupported broker type: ${broker.type}`);
    }
  }

  async createRedisConnection(broker) {
    // Mock Redis connection - replace with actual Redis client
    return {
      type: 'redis',
      publish: async (channel, message) => {
        logger.debug('Redis publish', { channel, message: message.substring(0, 100) });
      },
      subscribe: async (channel, handler) => {
        logger.debug('Redis subscribe', { channel });
      },
      lpush: async (queue, message) => {
        logger.debug('Redis lpush', { queue, message: message.substring(0, 100) });
      },
      brpop: async (queue, timeout) => {
        // Mock message retrieval
        return ['test-queue', JSON.stringify({ id: crypto.randomUUID(), data: 'test' })];
      },
      disconnect: async () => {
        logger.debug('Redis disconnected');
      }
    };
  }

  async createKafkaConnection(broker) {
    // Mock Kafka connection - replace with actual Kafka client
    return {
      type: 'kafka',
      producer: {
        send: async ({ topic, messages }) => {
          logger.debug('Kafka produce', { topic, messageCount: messages.length });
        },
        disconnect: async () => {
          logger.debug('Kafka producer disconnected');
        }
      },
      consumer: {
        subscribe: async ({ topic }) => {
          logger.debug('Kafka subscribe', { topic });
        },
        run: async ({ eachMessage }) => {
          // Mock message consumption
          setInterval(() => {
            eachMessage({
              topic: 'test-topic',
              partition: 0,
              message: {
                key: 'test-key',
                value: JSON.stringify({ id: crypto.randomUUID(), data: 'test' })
              }
            });
          }, 5000);
        },
        disconnect: async () => {
          logger.debug('Kafka consumer disconnected');
        }
      },
      admin: {
        createTopics: async (topics) => {
          logger.debug('Kafka create topics', { topics });
        },
        disconnect: async () => {
          logger.debug('Kafka admin disconnected');
        }
      }
    };
  }

  async createRabbitMQConnection(broker) {
    // Mock RabbitMQ connection - replace with actual AMQP client
    return {
      type: 'rabbitmq',
      channel: {
        assertExchange: async (exchange, type) => {
          logger.debug('RabbitMQ assert exchange', { exchange, type });
        },
        assertQueue: async (queue, options) => {
          logger.debug('RabbitMQ assert queue', { queue, options });
        },
        publish: async (exchange, routingKey, message) => {
          logger.debug('RabbitMQ publish', { exchange, routingKey });
        },
        consume: async (queue, handler) => {
          logger.debug('RabbitMQ consume', { queue });
        },
        ack: (message) => {
          logger.debug('RabbitMQ ack', { messageId: message.properties?.messageId });
        },
        nack: (message, allUpTo, requeue) => {
          logger.debug('RabbitMQ nack', { messageId: message.properties?.messageId, requeue });
        },
        close: async () => {
          logger.debug('RabbitMQ channel closed');
        }
      },
      connection: {
        close: async () => {
          logger.debug('RabbitMQ connection closed');
        }
      }
    };
  }

  // Queue Management
  async createQueue(name, options = {}) {
    const queueConfig = {
      name,
      broker: options.broker || this.config.defaultBroker,
      durable: options.durable !== false,
      autoDelete: options.autoDelete === true,
      exclusive: options.exclusive === true,
      deadLetterQueue: options.deadLetterQueue !== false && this.config.enableDeadLetterQueue,
      maxRetries: options.maxRetries || this.config.maxRetries,
      messageTimeout: options.messageTimeout || this.config.messageTimeoutMs,
      routingKey: options.routingKey || name,
      ...options
    };

    const broker = await this.connectBroker(queueConfig.broker);
    
    // Create queue based on broker type
    switch (broker.type) {
      case 'redis':
        await this.createRedisQueue(broker, queueConfig);
        break;
      case 'kafka':
        await this.createKafkaTopic(broker, queueConfig);
        break;
      case 'rabbitmq':
        await this.createRabbitMQQueue(broker, queueConfig);
        break;
    }

    this.queues.set(name, queueConfig);
    
    // Create dead letter queue if enabled
    if (queueConfig.deadLetterQueue) {
      const dlqName = `${name}.dlq`;
      await this.createDeadLetterQueue(dlqName, queueConfig);
    }

    this.emit('queue:created', queueConfig);
    logger.info(`Queue created: ${name}`, { broker: queueConfig.broker });
    
    return queueConfig;
  }

  async createRedisQueue(broker, config) {
    // Redis doesn't require explicit queue creation
    // Queues are created implicitly when messages are sent
    return true;
  }

  async createKafkaTopic(broker, config) {
    await broker.admin.createTopics([{
      topic: config.name,
      numPartitions: config.partitions || 1,
      replicationFactor: config.replicationFactor || 1
    }]);
  }

  async createRabbitMQQueue(broker, config) {
    await broker.channel.assertExchange(
      process.env.RABBITMQ_EXCHANGE || 'unjucks',
      'topic',
      { durable: true }
    );
    
    await broker.channel.assertQueue(config.name, {
      durable: config.durable,
      autoDelete: config.autoDelete,
      exclusive: config.exclusive
    });
  }

  async createDeadLetterQueue(dlqName, originalConfig) {
    const dlqConfig = {
      ...originalConfig,
      name: dlqName,
      deadLetterQueue: false, // Prevent infinite recursion
      isDeadLetterQueue: true
    };

    await this.createQueue(dlqName, dlqConfig);
    this.deadLetterQueues.set(originalConfig.name, dlqName);
  }

  // Message Publishing
  async publish(queueName, message, options = {}) {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue not found: ${queueName}`);
    }

    const broker = this.brokers.get(queue.broker);
    if (!broker?.connected) {
      throw new Error(`Broker not connected: ${queue.broker}`);
    }

    const messagePayload = await this.prepareMessage(message, options);
    
    try {
      await this.publishToBoker(broker, queue, messagePayload, options);
      
      this.updateMetrics(queueName, 'published', 1);
      this.emit('message:published', { queueName, messageId: messagePayload.id });
      
      return messagePayload.id;
    } catch (error) {
      this.updateMetrics(queueName, 'publish_errors', 1);
      logger.error('Failed to publish message', { queueName, error: error.message });
      throw error;
    }
  }

  async prepareMessage(message, options) {
    const messagePayload = {
      id: crypto.randomUUID(),
      timestamp: this.getDeterministicDate().toISOString(),
      data: message,
      headers: options.headers || {},
      priority: options.priority || 0,
      retryCount: 0,
      maxRetries: options.maxRetries || this.config.maxRetries
    };

    // Compression
    if (this.config.enableCompression) {
      messagePayload.data = await this.compressData(messagePayload.data);
      messagePayload.compressed = true;
    }

    // Encryption
    if (this.config.enableEncryption && this.config.encryptionKey) {
      messagePayload.data = await this.encryptData(messagePayload.data);
      messagePayload.encrypted = true;
    }

    return messagePayload;
  }

  async publishToBoker(broker, queue, message, options) {
    const messageString = JSON.stringify(message);
    
    switch (broker.type) {
      case 'redis':
        if (options.pattern === 'pubsub') {
          await broker.connection.publish(queue.name, messageString);
        } else {
          await broker.connection.lpush(queue.name, messageString);
        }
        break;
        
      case 'kafka':
        await broker.connection.producer.send({
          topic: queue.name,
          messages: [{
            key: options.key || message.id,
            value: messageString,
            headers: message.headers
          }]
        });
        break;
        
      case 'rabbitmq':
        await broker.connection.channel.publish(
          process.env.RABBITMQ_EXCHANGE || 'unjucks',
          queue.routingKey,
          Buffer.from(messageString),
          {
            persistent: true,
            messageId: message.id,
            timestamp: this.getDeterministicTimestamp(),
            headers: message.headers
          }
        );
        break;
    }
  }

  // Message Consumption
  async subscribe(queueName, handler, options = {}) {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue not found: ${queueName}`);
    }

    const broker = this.brokers.get(queue.broker);
    if (!broker?.connected) {
      throw new Error(`Broker not connected: ${queue.broker}`);
    }

    const consumer = {
      id: crypto.randomUUID(),
      queueName,
      handler,
      options,
      active: true,
      messageCount: 0,
      errorCount: 0,
      createdAt: this.getDeterministicDate()
    };

    this.consumers.set(consumer.id, consumer);
    
    await this.startConsumer(broker, queue, consumer);
    
    this.emit('consumer:started', consumer);
    logger.info(`Consumer started for queue: ${queueName}`, { consumerId: consumer.id });
    
    return consumer.id;
  }

  async startConsumer(broker, queue, consumer) {
    const wrappedHandler = async (rawMessage) => {
      try {
        const message = await this.processIncomingMessage(rawMessage, queue);
        
        if (message) {
          await this.executeMessageHandler(consumer, message, queue);
          consumer.messageCount++;
          this.updateMetrics(queue.name, 'consumed', 1);
        }
      } catch (error) {
        consumer.errorCount++;
        this.updateMetrics(queue.name, 'consume_errors', 1);
        await this.handleMessageError(error, rawMessage, queue, consumer);
      }
    };

    switch (broker.type) {
      case 'redis':
        if (consumer.options.pattern === 'pubsub') {
          await broker.connection.subscribe(queue.name, wrappedHandler);
        } else {
          this.startRedisPolling(broker, queue, wrappedHandler);
        }
        break;
        
      case 'kafka':
        await broker.connection.consumer.subscribe({ topic: queue.name });
        await broker.connection.consumer.run({
          eachMessage: async ({ topic, partition, message }) => {
            await wrappedHandler({
              topic,
              partition,
              offset: message.offset,
              key: message.key?.toString(),
              value: message.value?.toString(),
              headers: message.headers
            });
          }
        });
        break;
        
      case 'rabbitmq':
        await broker.connection.channel.consume(queue.name, async (message) => {
          if (message) {
            await wrappedHandler({
              content: message.content.toString(),
              properties: message.properties,
              fields: message.fields,
              ack: () => broker.connection.channel.ack(message),
              nack: (requeue = false) => broker.connection.channel.nack(message, false, requeue)
            });
          }
        });
        break;
    }
  }

  startRedisPolling(broker, queue, handler) {
    const poll = async () => {
      if (!broker.connected) return;
      
      try {
        const result = await broker.connection.brpop(queue.name, 1);
        if (result) {
          const [queueName, message] = result;
          await handler({
            queue: queueName,
            content: message
          });
        }
      } catch (error) {
        logger.error('Redis polling error', { queue: queue.name, error: error.message });
      } finally {
        setTimeout(poll, 100); // Poll every 100ms
      }
    };
    
    poll();
  }

  async processIncomingMessage(rawMessage, queue) {
    let messageContent;
    
    // Extract message content based on broker type
    if (rawMessage.content) {
      messageContent = rawMessage.content;
    } else if (rawMessage.value) {
      messageContent = rawMessage.value;
    } else {
      messageContent = rawMessage;
    }

    try {
      const message = JSON.parse(messageContent);
      
      // Decrypt if necessary
      if (message.encrypted && this.config.enableEncryption && this.config.encryptionKey) {
        message.data = await this.decryptData(message.data);
      }
      
      // Decompress if necessary
      if (message.compressed && this.config.enableCompression) {
        message.data = await this.decompressData(message.data);
      }
      
      return message;
    } catch (error) {
      logger.error('Failed to process incoming message', { error: error.message });
      return null;
    }
  }

  async executeMessageHandler(consumer, message, queue) {
    const context = {
      messageId: message.id,
      queueName: queue.name,
      timestamp: message.timestamp,
      retryCount: message.retryCount,
      headers: message.headers
    };

    await consumer.handler(message.data, context);
  }

  async handleMessageError(error, rawMessage, queue, consumer) {
    logger.error('Message handler error', {
      queueName: queue.name,
      consumerId: consumer.id,
      error: error.message
    });

    const message = await this.processIncomingMessage(rawMessage, queue);
    
    if (message && message.retryCount < message.maxRetries) {
      // Retry the message
      message.retryCount++;
      await this.retryMessage(message, queue);
    } else if (this.config.enableDeadLetterQueue) {
      // Send to dead letter queue
      await this.sendToDeadLetterQueue(message, queue, error);
    }
  }

  async retryMessage(message, queue) {
    const delay = this.config.retryBackoffMs * Math.pow(2, message.retryCount - 1);
    
    setTimeout(async () => {
      await this.publish(queue.name, message.data, {
        headers: { ...message.headers, retryCount: message.retryCount }
      });
    }, delay);
  }

  async sendToDeadLetterQueue(message, queue, error) {
    const dlqName = this.deadLetterQueues.get(queue.name);
    if (dlqName) {
      const dlqMessage = {
        originalQueue: queue.name,
        originalMessage: message,
        error: error.message,
        failedAt: this.getDeterministicDate().toISOString()
      };
      
      await this.publish(dlqName, dlqMessage);
      logger.info('Message sent to dead letter queue', { 
        messageId: message?.id, 
        dlqName 
      });
    }
  }

  // Data processing utilities
  async compressData(data) {
    // Mock compression - implement with actual compression library
    return Buffer.from(JSON.stringify(data)).toString('base64');
  }

  async decompressData(data) {
    // Mock decompression
    return JSON.parse(Buffer.from(data, 'base64').toString());
  }

  async encryptData(data) {
    // Secure encryption for message queue using AES-256-GCM
    const encryptionKey = this.config.encryptionKey;
    
    if (!encryptionKey || encryptionKey.length < 32) {
      throw new Error('Encryption key must be at least 32 characters long');
    }
    
    // Generate random IV for each encryption
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipherGCM('aes-256-gcm', encryptionKey, iv);
    cipher.setAAD(Buffer.from('message-queue', 'utf8'));
    
    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    // Return IV + authTag + encrypted data for secure decryption
    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
  }

  async decryptData(encryptedData) {
    const parts = encryptedData.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format');
    }
    
    const [ivHex, authTagHex, encrypted] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    const decipher = crypto.createDecipherGCM('aes-256-gcm', this.config.encryptionKey, iv);
    decipher.setAAD(Buffer.from('message-queue', 'utf8'));
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return JSON.parse(decrypted);
  }

  // Metrics and monitoring
  updateMetrics(queueName, metric, value) {
    if (!this.metrics.has(queueName)) {
      this.metrics.set(queueName, {
        published: 0,
        consumed: 0,
        publish_errors: 0,
        consume_errors: 0
      });
    }
    
    const queueMetrics = this.metrics.get(queueName);
    queueMetrics[metric] = (queueMetrics[metric] || 0) + value;
  }

  getMetrics(queueName = null) {
    if (queueName) {
      return this.metrics.get(queueName) || {};
    }
    
    return Object.fromEntries(this.metrics);
  }

  getQueueInfo(queueName) {
    const queue = this.queues.get(queueName);
    if (!queue) return null;

    const metrics = this.metrics.get(queueName) || {};
    const consumers = Array.from(this.consumers.values())
      .filter(c => c.queueName === queueName);

    return {
      ...queue,
      metrics,
      consumerCount: consumers.length,
      activeConsumers: consumers.filter(c => c.active).length
    };
  }

  async unsubscribe(consumerId) {
    const consumer = this.consumers.get(consumerId);
    if (consumer) {
      consumer.active = false;
      this.consumers.delete(consumerId);
      this.emit('consumer:stopped', consumer);
      logger.info(`Consumer stopped: ${consumerId}`);
    }
  }

  async stop() {
    // Stop all consumers
    for (const consumer of this.consumers.values()) {
      consumer.active = false;
    }
    this.consumers.clear();

    // Disconnect all brokers
    for (const broker of this.brokers.values()) {
      if (broker.connected && broker.connection) {
        try {
          switch (broker.type) {
            case 'redis':
              await broker.connection.disconnect();
              break;
            case 'kafka':
              await broker.connection.producer.disconnect();
              await broker.connection.consumer.disconnect();
              await broker.connection.admin.disconnect();
              break;
            case 'rabbitmq':
              await broker.connection.channel.close();
              await broker.connection.connection.close();
              break;
          }
          broker.connected = false;
        } catch (error) {
          logger.error(`Error disconnecting broker: ${broker.name}`, error);
        }
      }
    }

    logger.info('Message queue integration stopped');
  }
}

export default MessageQueueIntegration;