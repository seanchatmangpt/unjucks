/**
 * KGEN Enterprise Message Queue System
 * Robust message processing with Redis/BullMQ and RabbitMQ support
 */

import { Queue, Worker, QueueEvents } from 'bullmq';
import Redis from 'ioredis';
import amqplib from 'amqplib';
import { EventEmitter } from 'events';

// Message types for different operations
export const MESSAGE_TYPES = {
    GRAPH_PROCESS: 'graph.process',
    CODE_GENERATE: 'code.generate',
    WEBHOOK_DELIVER: 'webhook.deliver',
    ETL_EXECUTE: 'etl.execute',
    INTEGRATION_SYNC: 'integration.sync',
    TEMPLATE_COMPILE: 'template.compile',
    NOTIFICATION_SEND: 'notification.send',
    BATCH_PROCESS: 'batch.process'
};

// Queue priorities
export const PRIORITIES = {
    CRITICAL: 10,
    HIGH: 8,
    NORMAL: 5,
    LOW: 2,
    BACKGROUND: 1
};

/**
 * Redis-based Message Queue using BullMQ
 */
export class RedisMessageQueue extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.config = {
            redis: {
                host: process.env.REDIS_HOST || 'localhost',
                port: process.env.REDIS_PORT || 6379,
                password: process.env.REDIS_PASSWORD,
                db: process.env.REDIS_QUEUE_DB || 0,
                maxRetriesPerRequest: 3,
                ...options.redis
            },
            defaultJobOptions: {
                removeOnComplete: 100,
                removeOnFail: 50,
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    settings: {
                        delay: 2000,
                        factor: 2
                    }
                },
                ...options.defaultJobOptions
            },
            concurrency: options.concurrency || 10,
            ...options
        };

        this.redis = new Redis(this.config.redis);
        this.queues = new Map();
        this.workers = new Map();
        this.queueEvents = new Map();
        this.processors = new Map();
        
        this.setupEventHandlers();
    }

    setupEventHandlers() {
        this.redis.on('connect', () => {
            console.log('Redis connected for message queue');
            this.emit('redis:connected');
        });

        this.redis.on('error', (error) => {
            console.error('Redis connection error:', error);
            this.emit('redis:error', error);
        });
    }

    async createQueue(name, options = {}) {
        if (this.queues.has(name)) {
            return this.queues.get(name);
        }

        const queue = new Queue(name, {
            connection: this.redis,
            defaultJobOptions: {
                ...this.config.defaultJobOptions,
                ...options.defaultJobOptions
            }
        });

        // Set up queue events
        const queueEvents = new QueueEvents(name, {
            connection: this.redis
        });

        queueEvents.on('waiting', ({ jobId, name: queueName }) => {
            this.emit('job:waiting', { jobId, queue: queueName });
        });

        queueEvents.on('active', ({ jobId, name: queueName }) => {
            this.emit('job:active', { jobId, queue: queueName });
        });

        queueEvents.on('completed', ({ jobId, returnvalue, name: queueName }) => {
            this.emit('job:completed', { jobId, result: returnvalue, queue: queueName });
        });

        queueEvents.on('failed', ({ jobId, failedReason, name: queueName }) => {
            this.emit('job:failed', { jobId, error: failedReason, queue: queueName });
        });

        queueEvents.on('progress', ({ jobId, data, name: queueName }) => {
            this.emit('job:progress', { jobId, progress: data, queue: queueName });
        });

        this.queues.set(name, queue);
        this.queueEvents.set(name, queueEvents);

        return queue;
    }

    async registerProcessor(queueName, messageType, processor) {
        if (!this.processors.has(queueName)) {
            this.processors.set(queueName, new Map());
        }
        
        this.processors.get(queueName).set(messageType, processor);
        
        // Create worker if it doesn't exist
        if (!this.workers.has(queueName)) {
            await this.createWorker(queueName);
        }
    }

    async createWorker(queueName, options = {}) {
        if (this.workers.has(queueName)) {
            return this.workers.get(queueName);
        }

        const worker = new Worker(queueName, async (job) => {
            const { type, payload, metadata = {} } = job.data;
            
            // Update job progress
            await job.updateProgress(0);
            
            try {
                // Find processor for this message type
                const queueProcessors = this.processors.get(queueName);
                const processor = queueProcessors?.get(type);
                
                if (!processor) {
                    throw new Error(`No processor found for message type: ${type}`);
                }
                
                // Execute processor with context
                const context = {
                    jobId: job.id,
                    queueName,
                    messageType: type,
                    metadata,
                    updateProgress: (progress) => job.updateProgress(progress),
                    log: (message) => job.log(message)
                };
                
                const result = await processor(payload, context);
                
                await job.updateProgress(100);
                return result;
                
            } catch (error) {
                await job.log(`Error processing message: ${error.message}`);
                throw error;
            }
        }, {
            connection: this.redis,
            concurrency: options.concurrency || this.config.concurrency
        });

        // Worker event handlers
        worker.on('completed', (job, result) => {
            console.log(`Job ${job.id} completed with result:`, result);
        });

        worker.on('failed', (job, error) => {
            console.error(`Job ${job.id} failed:`, error.message);
        });

        worker.on('error', (error) => {
            console.error(`Worker error in queue ${queueName}:`, error);
            this.emit('worker:error', { queue: queueName, error });
        });

        this.workers.set(queueName, worker);
        return worker;
    }

    async addMessage(queueName, messageType, payload, options = {}) {
        const queue = await this.createQueue(queueName);
        
        const jobData = {
            type: messageType,
            payload,
            metadata: {
                timestamp: this.getDeterministicDate().toISOString(),
                source: options.source || 'api',
                ...options.metadata
            }
        };

        const jobOptions = {
            priority: options.priority || PRIORITIES.NORMAL,
            delay: options.delay || 0,
            attempts: options.attempts || this.config.defaultJobOptions.attempts,
            ...options.jobOptions
        };

        const job = await queue.add(messageType, jobData, jobOptions);
        
        this.emit('message:added', {
            jobId: job.id,
            queue: queueName,
            type: messageType,
            priority: jobOptions.priority
        });

        return job;
    }

    async addBulkMessages(queueName, messages, options = {}) {
        const queue = await this.createQueue(queueName);
        
        const jobs = messages.map((message, index) => ({
            name: message.type,
            data: {
                type: message.type,
                payload: message.payload,
                metadata: {
                    timestamp: this.getDeterministicDate().toISOString(),
                    batchId: options.batchId || crypto.randomUUID(),
                    batchIndex: index,
                    ...message.metadata
                }
            },
            opts: {
                priority: message.priority || PRIORITIES.NORMAL,
                delay: message.delay || 0,
                ...options.jobOptions
            }
        }));

        const addedJobs = await queue.addBulk(jobs);
        
        this.emit('batch:added', {
            queue: queueName,
            count: addedJobs.length,
            batchId: options.batchId
        });

        return addedJobs;
    }

    async getQueueStatus(queueName) {
        const queue = this.queues.get(queueName);
        if (!queue) {
            throw new Error(`Queue ${queueName} not found`);
        }

        const waiting = await queue.getWaiting();
        const active = await queue.getActive();
        const completed = await queue.getCompleted();
        const failed = await queue.getFailed();

        return {
            name: queueName,
            waiting: waiting.length,
            active: active.length,
            completed: completed.length,
            failed: failed.length,
            total: waiting.length + active.length + completed.length + failed.length
        };
    }

    async getAllQueuesStatus() {
        const status = {};
        for (const queueName of this.queues.keys()) {
            status[queueName] = await this.getQueueStatus(queueName);
        }
        return status;
    }

    async pauseQueue(queueName) {
        const queue = this.queues.get(queueName);
        if (queue) {
            await queue.pause();
            this.emit('queue:paused', { queue: queueName });
        }
    }

    async resumeQueue(queueName) {
        const queue = this.queues.get(queueName);
        if (queue) {
            await queue.resume();
            this.emit('queue:resumed', { queue: queueName });
        }
    }

    async drainQueue(queueName) {
        const queue = this.queues.get(queueName);
        if (queue) {
            await queue.drain();
            this.emit('queue:drained', { queue: queueName });
        }
    }

    async getJob(queueName, jobId) {
        const queue = this.queues.get(queueName);
        if (!queue) {
            throw new Error(`Queue ${queueName} not found`);
        }
        return await queue.getJob(jobId);
    }

    async retryJob(queueName, jobId) {
        const job = await this.getJob(queueName, jobId);
        if (job) {
            await job.retry();
            this.emit('job:retried', { jobId, queue: queueName });
        }
    }

    async shutdown() {
        console.log('Shutting down Redis Message Queue...');
        
        // Close all workers
        for (const [name, worker] of this.workers) {
            console.log(`Closing worker for queue: ${name}`);
            await worker.close();
        }
        
        // Close all queue events
        for (const [name, queueEvents] of this.queueEvents) {
            console.log(`Closing queue events for: ${name}`);
            await queueEvents.close();
        }
        
        // Close Redis connection
        await this.redis.quit();
        
        console.log('Redis Message Queue shutdown complete');
    }
}

/**
 * RabbitMQ Message Queue
 */
export class RabbitMQMessageQueue extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.config = {
            url: process.env.RABBITMQ_URL || 'amqp://localhost',
            exchangeType: 'topic',
            durable: true,
            ...options
        };

        this.connection = null;
        this.channel = null;
        this.exchanges = new Set();
        this.queues = new Map();
        this.consumers = new Map();
    }

    async connect() {
        try {
            this.connection = await amqplib.connect(this.config.url);
            this.channel = await this.connection.createChannel();
            
            // Set prefetch to control concurrent processing
            await this.channel.prefetch(10);
            
            this.connection.on('error', (error) => {
                console.error('RabbitMQ connection error:', error);
                this.emit('connection:error', error);
            });

            this.connection.on('close', () => {
                console.log('RabbitMQ connection closed');
                this.emit('connection:closed');
            });

            console.log('Connected to RabbitMQ');
            this.emit('connected');
            
        } catch (error) {
            console.error('Failed to connect to RabbitMQ:', error);
            throw error;
        }
    }

    async createExchange(exchangeName, type = 'topic') {
        if (!this.channel) {
            throw new Error('Not connected to RabbitMQ');
        }

        await this.channel.assertExchange(exchangeName, type, {
            durable: this.config.durable
        });
        
        this.exchanges.add(exchangeName);
        return exchangeName;
    }

    async createQueue(queueName, options = {}) {
        if (!this.channel) {
            throw new Error('Not connected to RabbitMQ');
        }

        const queueOptions = {
            durable: this.config.durable,
            arguments: {
                'x-max-priority': 10, // Support message priorities
                ...options.arguments
            },
            ...options
        };

        const result = await this.channel.assertQueue(queueName, queueOptions);
        this.queues.set(queueName, result.queue);
        
        return result.queue;
    }

    async bindQueue(queueName, exchangeName, routingKey = '#') {
        if (!this.channel) {
            throw new Error('Not connected to RabbitMQ');
        }

        await this.channel.bindQueue(queueName, exchangeName, routingKey);
    }

    async publishMessage(exchangeName, routingKey, messageType, payload, options = {}) {
        if (!this.channel) {
            throw new Error('Not connected to RabbitMQ');
        }

        const message = {
            type: messageType,
            payload,
            metadata: {
                timestamp: this.getDeterministicDate().toISOString(),
                source: options.source || 'api',
                messageId: crypto.randomUUID(),
                ...options.metadata
            }
        };

        const publishOptions = {
            persistent: true,
            priority: options.priority || PRIORITIES.NORMAL,
            timestamp: this.getDeterministicTimestamp(),
            messageId: message.metadata.messageId,
            type: messageType,
            headers: options.headers || {}
        };

        const published = this.channel.publish(
            exchangeName,
            routingKey,
            Buffer.from(JSON.stringify(message)),
            publishOptions
        );

        if (!published) {
            throw new Error('Failed to publish message to exchange');
        }

        this.emit('message:published', {
            exchange: exchangeName,
            routingKey,
            messageType,
            messageId: message.metadata.messageId
        });

        return message.metadata.messageId;
    }

    async consumeMessages(queueName, processor, options = {}) {
        if (!this.channel) {
            throw new Error('Not connected to RabbitMQ');
        }

        const consumerTag = await this.channel.consume(queueName, async (msg) => {
            if (!msg) return;

            try {
                const message = JSON.parse(msg.content.toString());
                const { type, payload, metadata } = message;

                const context = {
                    messageId: metadata.messageId,
                    queueName,
                    messageType: type,
                    metadata,
                    deliveryTag: msg.fields.deliveryTag,
                    redelivered: msg.fields.redelivered
                };

                // Process the message
                const result = await processor(payload, context);

                // Acknowledge successful processing
                this.channel.ack(msg);

                this.emit('message:processed', {
                    messageId: metadata.messageId,
                    queue: queueName,
                    result
                });

            } catch (error) {
                console.error(`Error processing message from ${queueName}:`, error);

                if (options.requeue !== false && !msg.fields.redelivered) {
                    // Requeue for retry
                    this.channel.nack(msg, false, true);
                } else {
                    // Dead letter or discard
                    this.channel.nack(msg, false, false);
                }

                this.emit('message:failed', {
                    queue: queueName,
                    error: error.message,
                    redelivered: msg.fields.redelivered
                });
            }
        }, {
            noAck: false,
            ...options
        });

        this.consumers.set(queueName, consumerTag);
        return consumerTag;
    }

    async getQueueInfo(queueName) {
        if (!this.channel) {
            throw new Error('Not connected to RabbitMQ');
        }

        const info = await this.channel.checkQueue(queueName);
        return {
            name: queueName,
            messageCount: info.messageCount,
            consumerCount: info.consumerCount
        };
    }

    async purgeQueue(queueName) {
        if (!this.channel) {
            throw new Error('Not connected to RabbitMQ');
        }

        const result = await this.channel.purgeQueue(queueName);
        this.emit('queue:purged', { queue: queueName, messageCount: result.messageCount });
        return result.messageCount;
    }

    async shutdown() {
        console.log('Shutting down RabbitMQ Message Queue...');

        // Cancel all consumers
        for (const [queueName, consumerTag] of this.consumers) {
            try {
                await this.channel.cancel(consumerTag);
                console.log(`Cancelled consumer for queue: ${queueName}`);
            } catch (error) {
                console.error(`Error cancelling consumer for ${queueName}:`, error);
            }
        }

        // Close channel and connection
        if (this.channel) {
            await this.channel.close();
        }
        
        if (this.connection) {
            await this.connection.close();
        }

        console.log('RabbitMQ Message Queue shutdown complete');
    }
}

/**
 * Unified Message Queue Manager
 */
export class MessageQueueManager extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.provider = options.provider || 'redis'; // 'redis' or 'rabbitmq'
        this.queue = null;
        
        this.processors = {
            [MESSAGE_TYPES.GRAPH_PROCESS]: this.processGraph.bind(this),
            [MESSAGE_TYPES.CODE_GENERATE]: this.processCodeGeneration.bind(this),
            [MESSAGE_TYPES.WEBHOOK_DELIVER]: this.processWebhookDelivery.bind(this),
            [MESSAGE_TYPES.ETL_EXECUTE]: this.processETLExecution.bind(this),
            [MESSAGE_TYPES.INTEGRATION_SYNC]: this.processIntegrationSync.bind(this),
            [MESSAGE_TYPES.TEMPLATE_COMPILE]: this.processTemplateCompilation.bind(this),
            [MESSAGE_TYPES.NOTIFICATION_SEND]: this.processNotification.bind(this),
            [MESSAGE_TYPES.BATCH_PROCESS]: this.processBatch.bind(this)
        };

        this.initialize(options);
    }

    async initialize(options) {
        if (this.provider === 'rabbitmq') {
            this.queue = new RabbitMQMessageQueue(options.rabbitmq);
            await this.queue.connect();
            
            // Set up RabbitMQ topology
            await this.setupRabbitMQTopology();
            
        } else {
            this.queue = new RedisMessageQueue(options.redis);
            
            // Register processors for Redis queues
            for (const [messageType, processor] of Object.entries(this.processors)) {
                await this.queue.registerProcessor('default', messageType, processor);
                await this.queue.registerProcessor('high-priority', messageType, processor);
            }
        }

        // Forward events
        this.queue.on('message:added', (data) => this.emit('message:queued', data));
        this.queue.on('job:completed', (data) => this.emit('message:completed', data));
        this.queue.on('job:failed', (data) => this.emit('message:failed', data));
    }

    async setupRabbitMQTopology() {
        // Create exchanges
        await this.queue.createExchange('kgen.direct', 'direct');
        await this.queue.createExchange('kgen.topic', 'topic');
        
        // Create queues
        await this.queue.createQueue('kgen.default');
        await this.queue.createQueue('kgen.high-priority');
        await this.queue.createQueue('kgen.notifications');
        
        // Bind queues
        await this.queue.bindQueue('kgen.default', 'kgen.topic', '*');
        await this.queue.bindQueue('kgen.high-priority', 'kgen.topic', '*.high');
        await this.queue.bindQueue('kgen.notifications', 'kgen.topic', 'notification.*');
        
        // Set up consumers
        for (const [messageType, processor] of Object.entries(this.processors)) {
            await this.queue.consumeMessages('kgen.default', processor);
            await this.queue.consumeMessages('kgen.high-priority', processor);
        }
    }

    async queueMessage(messageType, payload, options = {}) {
        const queueName = options.priority >= PRIORITIES.HIGH ? 'high-priority' : 'default';
        
        if (this.provider === 'rabbitmq') {
            const routingKey = options.priority >= PRIORITIES.HIGH ? `${messageType}.high` : messageType;
            return await this.queue.publishMessage('kgen.topic', routingKey, messageType, payload, options);
        } else {
            return await this.queue.addMessage(queueName, messageType, payload, options);
        }
    }

    async queueBatch(messages, options = {}) {
        if (this.provider === 'rabbitmq') {
            const results = [];
            for (const message of messages) {
                const result = await this.queueMessage(message.type, message.payload, {
                    ...options,
                    ...message.options
                });
                results.push(result);
            }
            return results;
        } else {
            const queueName = options.priority >= PRIORITIES.HIGH ? 'high-priority' : 'default';
            return await this.queue.addBulkMessages(queueName, messages, options);
        }
    }

    // Message processors
    async processGraph(payload, context) {
        const { graphId, operation } = payload;
        context.log(`Processing graph ${graphId} with operation: ${operation}`);
        
        // Implement graph processing logic
        await context.updateProgress(50);
        
        return { processed: true, graphId, operation };
    }

    async processCodeGeneration(payload, context) {
        const { graphId, templateIds, variables } = payload;
        context.log(`Generating code for graph ${graphId} with ${templateIds.length} templates`);
        
        // Implement code generation logic
        await context.updateProgress(75);
        
        return { generated: true, artifactCount: templateIds.length };
    }

    async processWebhookDelivery(payload, context) {
        const { webhookId, event, data } = payload;
        context.log(`Delivering webhook ${webhookId} for event: ${event}`);
        
        // Implement webhook delivery logic
        await context.updateProgress(100);
        
        return { delivered: true, webhookId, event };
    }

    async processETLExecution(payload, context) {
        const { pipelineId, sourceData } = payload;
        context.log(`Executing ETL pipeline ${pipelineId}`);
        
        // Implement ETL execution logic
        await context.updateProgress(90);
        
        return { processed: true, recordCount: sourceData?.length || 0 };
    }

    async processIntegrationSync(payload, context) {
        const { integrationId, syncType } = payload;
        context.log(`Syncing integration ${integrationId} with type: ${syncType}`);
        
        // Implement integration sync logic
        await context.updateProgress(100);
        
        return { synced: true, integrationId, syncType };
    }

    async processTemplateCompilation(payload, context) {
        const { templateId, variables } = payload;
        context.log(`Compiling template ${templateId}`);
        
        // Implement template compilation logic
        await context.updateProgress(100);
        
        return { compiled: true, templateId };
    }

    async processNotification(payload, context) {
        const { recipients, message, channel } = payload;
        context.log(`Sending notification via ${channel} to ${recipients.length} recipients`);
        
        // Implement notification sending logic
        await context.updateProgress(100);
        
        return { sent: true, recipientCount: recipients.length };
    }

    async processBatch(payload, context) {
        const { batchId, operations } = payload;
        context.log(`Processing batch ${batchId} with ${operations.length} operations`);
        
        // Implement batch processing logic
        let completed = 0;
        for (const operation of operations) {
            // Process each operation
            completed++;
            await context.updateProgress((completed / operations.length) * 100);
        }
        
        return { processed: true, batchId, operationCount: operations.length };
    }

    async getStatus() {
        if (this.provider === 'rabbitmq') {
            return {
                provider: 'rabbitmq',
                queues: {
                    default: await this.queue.getQueueInfo('kgen.default'),
                    highPriority: await this.queue.getQueueInfo('kgen.high-priority'),
                    notifications: await this.queue.getQueueInfo('kgen.notifications')
                }
            };
        } else {
            return {
                provider: 'redis',
                queues: await this.queue.getAllQueuesStatus()
            };
        }
    }

    async shutdown() {
        if (this.queue) {
            await this.queue.shutdown();
        }
    }
}

export default {
    RedisMessageQueue,
    RabbitMQMessageQueue,
    MessageQueueManager,
    MESSAGE_TYPES,
    PRIORITIES
};