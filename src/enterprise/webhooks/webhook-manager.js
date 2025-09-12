/**
 * KGEN Enterprise Webhook Manager
 * Real-time event notification system with delivery guarantees
 */

import crypto from 'crypto';
import axios from 'axios';
import { EventEmitter } from 'events';
import { Queue } from 'bullmq';
import Redis from 'ioredis';

// Webhook event types
export const WEBHOOK_EVENTS = {
    GRAPH_CREATED: 'graph.created',
    GRAPH_UPDATED: 'graph.updated', 
    GRAPH_DELETED: 'graph.deleted',
    JOB_CREATED: 'job.created',
    JOB_STARTED: 'job.started',
    JOB_COMPLETED: 'job.completed',
    JOB_FAILED: 'job.failed',
    TEMPLATE_CREATED: 'template.created',
    TEMPLATE_UPDATED: 'template.updated',
    INTEGRATION_CONNECTED: 'integration.connected',
    ETL_EXECUTION_STARTED: 'etl.execution.started',
    ETL_EXECUTION_COMPLETED: 'etl.execution.completed'
};

export class WebhookManager extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.config = {
            redis: {
                host: process.env.REDIS_HOST || 'localhost',
                port: process.env.REDIS_PORT || 6379,
                password: process.env.REDIS_PASSWORD,
                db: process.env.REDIS_WEBHOOK_DB || 5
            },
            delivery: {
                maxRetries: 5,
                initialDelay: 1000, // 1 second
                maxDelay: 300000,   // 5 minutes
                backoffFactor: 2
            },
            timeout: 30000, // 30 seconds
            userAgent: 'KGEN-Webhook/1.0',
            ...options
        };

        this.redis = new Redis(this.config.redis);
        this.webhookQueue = new Queue('webhook-delivery', {
            connection: this.redis,
            defaultJobOptions: {
                removeOnComplete: 100,
                removeOnFail: 50,
                attempts: this.config.delivery.maxRetries,
                backoff: {
                    type: 'exponential',
                    settings: {
                        delay: this.config.delivery.initialDelay,
                        factor: this.config.delivery.backoffFactor
                    }
                }
            }
        });

        this.webhooks = new Map();
        this.deliveryStats = new Map();
        
        this.setupEventHandlers();
        this.setupQueueProcessors();
    }

    setupEventHandlers() {
        // Listen for application events
        this.on('webhook:trigger', this.handleWebhookTrigger.bind(this));
        this.on('webhook:delivery:success', this.handleDeliverySuccess.bind(this));
        this.on('webhook:delivery:failure', this.handleDeliveryFailure.bind(this));
    }

    setupQueueProcessors() {
        this.webhookQueue.process('deliver', async (job) => {
            const { webhookId, event, payload, attempt = 1 } = job.data;
            
            try {
                const webhook = await this.getWebhook(webhookId);
                if (!webhook || !webhook.active) {
                    throw new Error(`Webhook ${webhookId} not found or inactive`);
                }

                const result = await this.deliverWebhook(webhook, event, payload);
                
                this.emit('webhook:delivery:success', {
                    webhookId,
                    event,
                    attempt,
                    response: result
                });

                return result;
            } catch (error) {
                this.emit('webhook:delivery:failure', {
                    webhookId,
                    event,
                    attempt,
                    error: error.message
                });

                throw error;
            }
        });
    }

    async registerWebhook(webhookData) {
        const webhook = {
            id: this.generateId(),
            url: webhookData.url,
            events: webhookData.events || [],
            secret: webhookData.secret || this.generateSecret(),
            active: webhookData.active !== false,
            createdAt: new Date().toISOString(),
            headers: webhookData.headers || {},
            retryPolicy: webhookData.retryPolicy || this.config.delivery,
            metadata: webhookData.metadata || {}
        };

        // Validate webhook URL
        await this.validateWebhookUrl(webhook.url);

        // Store webhook
        await this.storeWebhook(webhook);
        this.webhooks.set(webhook.id, webhook);

        // Initialize delivery stats
        this.deliveryStats.set(webhook.id, {
            totalDeliveries: 0,
            successfulDeliveries: 0,
            failedDeliveries: 0,
            lastDelivery: null,
            averageResponseTime: 0
        });

        return webhook;
    }

    async updateWebhook(webhookId, updates) {
        const webhook = await this.getWebhook(webhookId);
        if (!webhook) {
            throw new Error(`Webhook ${webhookId} not found`);
        }

        // Validate URL if being updated
        if (updates.url && updates.url !== webhook.url) {
            await this.validateWebhookUrl(updates.url);
        }

        const updatedWebhook = {
            ...webhook,
            ...updates,
            updatedAt: new Date().toISOString()
        };

        await this.storeWebhook(updatedWebhook);
        this.webhooks.set(webhookId, updatedWebhook);

        return updatedWebhook;
    }

    async deleteWebhook(webhookId) {
        const webhook = await this.getWebhook(webhookId);
        if (!webhook) {
            return false;
        }

        // Remove from storage
        await this.redis.del(`webhook:${webhookId}`);
        
        // Remove from memory
        this.webhooks.delete(webhookId);
        this.deliveryStats.delete(webhookId);

        // Cancel any pending deliveries
        await this.webhookQueue.removeJobs('webhook-delivery', {
            webhookId
        });

        return true;
    }

    async triggerWebhook(event, payload, options = {}) {
        const webhooks = await this.getWebhooksForEvent(event);
        
        const deliveries = webhooks.map(async (webhook) => {
            try {
                const enrichedPayload = {
                    event,
                    timestamp: new Date().toISOString(),
                    data: payload,
                    webhook: {
                        id: webhook.id,
                        deliveryId: this.generateId()
                    },
                    ...options.additionalData
                };

                // Add to delivery queue
                await this.webhookQueue.add('deliver', {
                    webhookId: webhook.id,
                    event,
                    payload: enrichedPayload
                }, {
                    priority: options.priority || 0,
                    delay: options.delay || 0
                });

                this.emit('webhook:queued', {
                    webhookId: webhook.id,
                    event,
                    deliveryId: enrichedPayload.webhook.deliveryId
                });

            } catch (error) {
                console.error(`Failed to queue webhook ${webhook.id}:`, error);
            }
        });

        await Promise.allSettled(deliveries);
        return webhooks.length;
    }

    async deliverWebhook(webhook, event, payload) {
        const startTime = Date.now();
        const deliveryId = payload.webhook?.deliveryId || this.generateId();

        try {
            // Create signature
            const signature = this.createSignature(payload, webhook.secret);
            
            // Prepare headers
            const headers = {
                'Content-Type': 'application/json',
                'User-Agent': this.config.userAgent,
                'X-KGEN-Event': event,
                'X-KGEN-Delivery': deliveryId,
                'X-KGEN-Signature-256': signature,
                'X-KGEN-Webhook-ID': webhook.id,
                'X-KGEN-Timestamp': payload.timestamp,
                ...webhook.headers
            };

            // Make HTTP request
            const response = await axios({
                method: 'POST',
                url: webhook.url,
                data: payload,
                headers,
                timeout: this.config.timeout,
                validateStatus: (status) => status >= 200 && status < 300,
                maxRedirects: 3
            });

            const responseTime = Date.now() - startTime;

            // Update statistics
            await this.updateDeliveryStats(webhook.id, true, responseTime);

            // Store delivery record
            await this.storeDeliveryRecord({
                id: deliveryId,
                webhookId: webhook.id,
                event,
                status: 'success',
                statusCode: response.status,
                responseTime,
                deliveredAt: new Date().toISOString(),
                response: {
                    headers: response.headers,
                    statusText: response.statusText
                }
            });

            return {
                deliveryId,
                status: 'delivered',
                statusCode: response.status,
                responseTime
            };

        } catch (error) {
            const responseTime = Date.now() - startTime;
            
            // Update statistics
            await this.updateDeliveryStats(webhook.id, false, responseTime);

            // Store delivery record
            await this.storeDeliveryRecord({
                id: deliveryId,
                webhookId: webhook.id,
                event,
                status: 'failed',
                statusCode: error.response?.status || 0,
                responseTime,
                error: error.message,
                deliveredAt: new Date().toISOString(),
                response: error.response ? {
                    headers: error.response.headers,
                    data: error.response.data,
                    statusText: error.response.statusText
                } : null
            });

            throw error;
        }
    }

    async testWebhook(webhookId, event = 'test') {
        const webhook = await this.getWebhook(webhookId);
        if (!webhook) {
            throw new Error(`Webhook ${webhookId} not found`);
        }

        const testPayload = {
            event,
            timestamp: new Date().toISOString(),
            data: {
                message: 'This is a test webhook delivery',
                webhook: {
                    id: webhookId,
                    url: webhook.url
                }
            },
            webhook: {
                id: webhookId,
                deliveryId: this.generateId()
            }
        };

        try {
            const result = await this.deliverWebhook(webhook, event, testPayload);
            return {
                success: true,
                result
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    async getWebhook(webhookId) {
        // Try memory cache first
        if (this.webhooks.has(webhookId)) {
            return this.webhooks.get(webhookId);
        }

        // Load from Redis
        const webhookData = await this.redis.get(`webhook:${webhookId}`);
        if (webhookData) {
            const webhook = JSON.parse(webhookData);
            this.webhooks.set(webhookId, webhook);
            return webhook;
        }

        return null;
    }

    async getWebhooksForEvent(event) {
        const webhookKeys = await this.redis.keys('webhook:*');
        const webhooks = [];

        for (const key of webhookKeys) {
            const webhookData = await this.redis.get(key);
            if (webhookData) {
                const webhook = JSON.parse(webhookData);
                if (webhook.active && 
                    (webhook.events.includes(event) || webhook.events.includes('*'))) {
                    webhooks.push(webhook);
                }
            }
        }

        return webhooks;
    }

    async getWebhookDeliveries(webhookId, options = {}) {
        const { limit = 50, offset = 0 } = options;
        
        const deliveryKeys = await this.redis.keys(`delivery:${webhookId}:*`);
        const deliveries = [];

        for (const key of deliveryKeys.slice(offset, offset + limit)) {
            const deliveryData = await this.redis.get(key);
            if (deliveryData) {
                deliveries.push(JSON.parse(deliveryData));
            }
        }

        // Sort by delivery time (most recent first)
        deliveries.sort((a, b) => 
            new Date(b.deliveredAt) - new Date(a.deliveredAt)
        );

        return deliveries;
    }

    async getWebhookStats(webhookId) {
        const stats = this.deliveryStats.get(webhookId) || {
            totalDeliveries: 0,
            successfulDeliveries: 0,
            failedDeliveries: 0,
            lastDelivery: null,
            averageResponseTime: 0
        };

        // Get recent delivery history
        const recentDeliveries = await this.getWebhookDeliveries(webhookId, { limit: 10 });

        return {
            ...stats,
            successRate: stats.totalDeliveries > 0 ? 
                (stats.successfulDeliveries / stats.totalDeliveries) * 100 : 0,
            recentDeliveries
        };
    }

    async validateWebhookUrl(url) {
        try {
            new URL(url); // Basic URL validation
            
            // Optional: Test connectivity
            if (process.env.NODE_ENV !== 'test') {
                await axios.head(url, { timeout: 5000 });
            }
            
            return true;
        } catch (error) {
            throw new Error(`Invalid webhook URL: ${error.message}`);
        }
    }

    createSignature(payload, secret) {
        if (!secret) return '';
        
        const payloadString = JSON.stringify(payload);
        return crypto
            .createHmac('sha256', secret)
            .update(payloadString)
            .digest('hex');
    }

    generateId() {
        return crypto.randomBytes(16).toString('hex');
    }

    generateSecret() {
        return crypto.randomBytes(32).toString('hex');
    }

    async storeWebhook(webhook) {
        await this.redis.set(
            `webhook:${webhook.id}`,
            JSON.stringify(webhook),
            'EX',
            86400 * 30 // 30 days TTL
        );
    }

    async storeDeliveryRecord(delivery) {
        await this.redis.set(
            `delivery:${delivery.webhookId}:${delivery.id}`,
            JSON.stringify(delivery),
            'EX',
            86400 * 7 // 7 days TTL
        );
    }

    async updateDeliveryStats(webhookId, success, responseTime) {
        const stats = this.deliveryStats.get(webhookId) || {
            totalDeliveries: 0,
            successfulDeliveries: 0,
            failedDeliveries: 0,
            lastDelivery: null,
            averageResponseTime: 0
        };

        stats.totalDeliveries++;
        if (success) {
            stats.successfulDeliveries++;
        } else {
            stats.failedDeliveries++;
        }
        
        // Update average response time
        stats.averageResponseTime = 
            ((stats.averageResponseTime * (stats.totalDeliveries - 1)) + responseTime) 
            / stats.totalDeliveries;
        
        stats.lastDelivery = new Date().toISOString();
        
        this.deliveryStats.set(webhookId, stats);

        // Also store in Redis for persistence
        await this.redis.set(
            `webhook:stats:${webhookId}`,
            JSON.stringify(stats),
            'EX',
            86400 * 30
        );
    }

    handleWebhookTrigger(data) {
        console.log(`Webhook triggered: ${data.event} for ${data.webhookCount} webhooks`);
    }

    handleDeliverySuccess(data) {
        console.log(`Webhook delivery successful: ${data.webhookId} (attempt ${data.attempt})`);
    }

    handleDeliveryFailure(data) {
        console.error(`Webhook delivery failed: ${data.webhookId} (attempt ${data.attempt}): ${data.error}`);
    }

    // Graceful shutdown
    async shutdown() {
        console.log('Shutting down Webhook Manager...');
        
        await this.webhookQueue.close();
        await this.redis.quit();
        
        console.log('Webhook Manager shut down successfully');
    }
}

// Webhook event helpers
export class WebhookEventEmitter {
    constructor(webhookManager) {
        this.webhookManager = webhookManager;
    }

    async emitGraphCreated(graph) {
        return this.webhookManager.triggerWebhook(WEBHOOK_EVENTS.GRAPH_CREATED, {
            id: graph.id,
            name: graph.name,
            rdfFormat: graph.rdfFormat,
            tripleCount: graph.tripleCount,
            createdAt: graph.createdAt
        });
    }

    async emitGraphUpdated(graph) {
        return this.webhookManager.triggerWebhook(WEBHOOK_EVENTS.GRAPH_UPDATED, {
            id: graph.id,
            name: graph.name,
            updatedAt: graph.updatedAt,
            changes: graph.changes || []
        });
    }

    async emitJobCompleted(job) {
        return this.webhookManager.triggerWebhook(WEBHOOK_EVENTS.JOB_COMPLETED, {
            id: job.id,
            graphId: job.graphId,
            status: job.status,
            artifactCount: job.results?.length || 0,
            completedAt: job.completedAt,
            duration: job.completedAt && job.startedAt ? 
                new Date(job.completedAt) - new Date(job.startedAt) : null
        });
    }

    async emitJobFailed(job, error) {
        return this.webhookManager.triggerWebhook(WEBHOOK_EVENTS.JOB_FAILED, {
            id: job.id,
            graphId: job.graphId,
            status: job.status,
            error: error.message,
            failedAt: new Date().toISOString()
        });
    }

    async emitIntegrationConnected(integration) {
        return this.webhookManager.triggerWebhook(WEBHOOK_EVENTS.INTEGRATION_CONNECTED, {
            id: integration.id,
            type: integration.type,
            name: integration.name,
            connectedAt: integration.connectedAt
        });
    }

    async emitETLExecutionCompleted(execution) {
        return this.webhookManager.triggerWebhook(WEBHOOK_EVENTS.ETL_EXECUTION_COMPLETED, {
            id: execution.id,
            pipelineId: execution.pipelineId,
            status: execution.status,
            recordsProcessed: execution.recordsProcessed,
            completedAt: execution.completedAt,
            duration: execution.completedAt && execution.startedAt ?
                new Date(execution.completedAt) - new Date(execution.startedAt) : null
        });
    }
}

export default WebhookManager;