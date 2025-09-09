/**
 * Enterprise Integration Hub
 * Central orchestrator for all enterprise integration capabilities
 */

import { EventEmitter } from 'events';
import SSOProvider from './auth/sso-provider.js';
import RestApiVersioning from './api/rest-api-versioning.js';
import GraphQLFederation from './api/graphql-federation.js';
import WebhookStreaming from './events/webhook-streaming.js';
import MessageQueueIntegration from './messaging/message-queue.js';
import OpenAPIGenerator from './docs/openapi-generator.js';
import logger from '../lib/observability/logger.js';

export class EnterpriseIntegrationHub extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = {
      enableSSO: true,
      enableRestAPI: true,
      enableGraphQL: true,
      enableWebhooks: true,
      enableMessageQueue: true,
      enableDocumentation: true,
      enableHealthChecks: true,
      healthCheckInterval: 30000, // 30 seconds
      enableMetrics: true,
      metricsInterval: 60000, // 1 minute
      ...config
    };

    this.integrations = new Map();
    this.healthStatus = new Map();
    this.metrics = new Map();
    this.startupTime = new Date();
    
    this.initializeIntegrations();
    this.setupHealthChecks();
    this.setupMetricsCollection();
  }

  async initializeIntegrations() {
    try {
      // Initialize SSO/SAML Provider
      if (this.config.enableSSO) {
        this.integrations.set('sso', new SSOProvider(this.config.sso));
        logger.info('SSO Provider initialized');
      }

      // Initialize REST API Versioning
      if (this.config.enableRestAPI) {
        this.integrations.set('restAPI', new RestApiVersioning(this.config.restAPI));
        logger.info('REST API Versioning initialized');
      }

      // Initialize GraphQL Federation
      if (this.config.enableGraphQL) {
        this.integrations.set('graphql', new GraphQLFederation(this.config.graphql));
        logger.info('GraphQL Federation initialized');
      }

      // Initialize Webhook & Event Streaming
      if (this.config.enableWebhooks) {
        this.integrations.set('webhooks', new WebhookStreaming(this.config.webhooks));
        logger.info('Webhook & Event Streaming initialized');
      }

      // Initialize Message Queue Integration
      if (this.config.enableMessageQueue) {
        this.integrations.set('messageQueue', new MessageQueueIntegration(this.config.messageQueue));
        logger.info('Message Queue Integration initialized');
      }

      // Initialize OpenAPI Documentation Generator
      if (this.config.enableDocumentation) {
        this.integrations.set('documentation', new OpenAPIGenerator(this.config.documentation));
        logger.info('OpenAPI Documentation Generator initialized');
      }

      // Setup integration event forwarding
      this.setupEventForwarding();
      
      this.emit('integrations:initialized', {
        count: this.integrations.size,
        services: Array.from(this.integrations.keys())
      });

      logger.info(`Enterprise Integration Hub initialized with ${this.integrations.size} services`);

    } catch (error) {
      logger.error('Failed to initialize integrations', error);
      throw error;
    }
  }

  setupEventForwarding() {
    // Forward events from individual integrations to the hub
    for (const [name, integration] of this.integrations) {
      if (integration instanceof EventEmitter) {
        integration.on('*', (eventName, ...args) => {
          this.emit(`${name}:${eventName}`, ...args);
        });
      }
    }
  }

  setupHealthChecks() {
    if (!this.config.enableHealthChecks) return;

    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthChecks();
    }, this.config.healthCheckInterval);

    logger.info('Health checks enabled');
  }

  setupMetricsCollection() {
    if (!this.config.enableMetrics) return;

    this.metricsInterval = setInterval(async () => {
      await this.collectMetrics();
    }, this.config.metricsInterval);

    logger.info('Metrics collection enabled');
  }

  // Integration Access Methods
  getSSO() {
    return this.integrations.get('sso');
  }

  getRestAPI() {
    return this.integrations.get('restAPI');
  }

  getGraphQL() {
    return this.integrations.get('graphql');
  }

  getWebhooks() {
    return this.integrations.get('webhooks');
  }

  getMessageQueue() {
    return this.integrations.get('messageQueue');
  }

  getDocumentation() {
    return this.integrations.get('documentation');
  }

  // High-level Integration Operations
  async authenticateUser(provider, credentials, context) {
    const sso = this.getSSO();
    if (!sso) {
      throw new Error('SSO integration not available');
    }

    return await sso.authenticate(provider, credentials, context);
  }

  async publishEvent(eventType, payload, metadata) {
    const webhooks = this.getWebhooks();
    const messageQueue = this.getMessageQueue();
    
    const results = [];

    // Publish to webhooks
    if (webhooks) {
      try {
        const webhookResult = await webhooks.publishEvent(eventType, payload, metadata);
        results.push({ service: 'webhooks', success: true, result: webhookResult });
      } catch (error) {
        results.push({ service: 'webhooks', success: false, error: error.message });
      }
    }

    // Publish to message queue
    if (messageQueue) {
      try {
        const queueName = metadata.queue || eventType.replace('.', '_');
        const messageResult = await messageQueue.publish(queueName, { eventType, payload, metadata });
        results.push({ service: 'messageQueue', success: true, result: messageResult });
      } catch (error) {
        results.push({ service: 'messageQueue', success: false, error: error.message });
      }
    }

    return results;
  }

  async generateDocumentation(expressApp) {
    const documentation = this.getDocumentation();
    if (!documentation) {
      throw new Error('Documentation integration not available');
    }

    if (expressApp) {
      documentation.analyzeExpressApp(expressApp);
    }

    return await documentation.generate();
  }

  // Health Checks
  async performHealthChecks() {
    const health = {
      timestamp: new Date(),
      status: 'healthy',
      services: {}
    };

    for (const [name, integration] of this.integrations) {
      try {
        const serviceHealth = await this.checkServiceHealth(name, integration);
        health.services[name] = serviceHealth;
        
        if (serviceHealth.status !== 'healthy') {
          health.status = 'degraded';
        }
      } catch (error) {
        health.services[name] = {
          status: 'unhealthy',
          error: error.message,
          lastCheck: new Date()
        };
        health.status = 'unhealthy';
      }
    }

    this.healthStatus.set('latest', health);
    this.emit('health:check', health);

    return health;
  }

  async checkServiceHealth(name, integration) {
    const health = {
      status: 'healthy',
      lastCheck: new Date(),
      uptime: Date.now() - this.startupTime.getTime()
    };

    // Service-specific health checks
    switch (name) {
      case 'sso':
        health.activeSessions = integration.getActiveSessionsCount();
        health.providers = integration.getProviders().length;
        break;
        
      case 'restAPI':
        health.supportedVersions = integration.getVersionInfo().supportedVersions.length;
        health.deprecatedVersions = Object.keys(integration.getVersionInfo().deprecatedVersions).length;
        break;
        
      case 'graphql':
        health.metrics = integration.getMetrics();
        break;
        
      case 'webhooks':
        health.stats = integration.getDeliveryStats();
        if (health.stats.failedDeliveries > health.stats.activeWebhooks * 0.1) {
          health.status = 'degraded';
        }
        break;
        
      case 'messageQueue':
        health.queues = Object.keys(integration.getMetrics()).length;
        break;
        
      case 'documentation':
        health.metrics = integration.getMetrics();
        break;
    }

    return health;
  }

  // Metrics Collection
  async collectMetrics() {
    const metrics = {
      timestamp: new Date(),
      integrations: {},
      overall: {
        uptime: Date.now() - this.startupTime.getTime(),
        activeIntegrations: this.integrations.size,
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage()
      }
    };

    for (const [name, integration] of this.integrations) {
      try {
        metrics.integrations[name] = await this.collectServiceMetrics(name, integration);
      } catch (error) {
        logger.error(`Failed to collect metrics for ${name}`, error);
        metrics.integrations[name] = { error: error.message };
      }
    }

    this.metrics.set(Date.now(), metrics);
    this.emit('metrics:collected', metrics);

    // Cleanup old metrics (keep last 100 entries)
    const metricKeys = Array.from(this.metrics.keys()).sort((a, b) => b - a);
    if (metricKeys.length > 100) {
      metricKeys.slice(100).forEach(key => this.metrics.delete(key));
    }

    return metrics;
  }

  async collectServiceMetrics(name, integration) {
    switch (name) {
      case 'sso':
        return {
          activeSessions: integration.getActiveSessionsCount(),
          providers: integration.getProviders().length
        };
        
      case 'restAPI':
        return integration.getMetrics();
        
      case 'graphql':
        return integration.getMetrics();
        
      case 'webhooks':
        return integration.getDeliveryStats();
        
      case 'messageQueue':
        return integration.getMetrics();
        
      case 'documentation':
        return integration.getMetrics();
        
      default:
        return {};
    }
  }

  // Status and Information
  getIntegrationStatus() {
    const status = {
      initialized: this.integrations.size > 0,
      services: {},
      uptime: Date.now() - this.startupTime.getTime(),
      version: process.env.npm_package_version || '1.0.0'
    };

    for (const [name] of this.integrations) {
      status.services[name] = {
        enabled: true,
        initialized: true
      };
    }

    return status;
  }

  getHealthStatus() {
    return this.healthStatus.get('latest') || { status: 'unknown' };
  }

  getMetrics(limit = 10) {
    const metricKeys = Array.from(this.metrics.keys()).sort((a, b) => b - a);
    const recentKeys = metricKeys.slice(0, limit);
    
    return recentKeys.map(key => this.metrics.get(key));
  }

  // Express.js Integration
  setupExpressIntegration(app) {
    // Add authentication middleware
    const sso = this.getSSO();
    if (sso) {
      app.use('/api', async (req, res, next) => {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (token) {
          const validation = await sso.validateSession(token);
          if (validation.valid) {
            req.user = validation.user;
            req.session = validation.session;
          }
        }
        next();
      });
    }

    // Add REST API versioning
    const restAPI = this.getRestAPI();
    if (restAPI) {
      app.use('/api', restAPI.getRouter());
    }

    // Add GraphQL endpoint
    const graphql = this.getGraphQL();
    if (graphql) {
      // GraphQL endpoint setup would go here
    }

    // Add health check endpoint
    app.get('/health', async (req, res) => {
      const health = await this.performHealthChecks();
      const statusCode = health.status === 'healthy' ? 200 : 
                        health.status === 'degraded' ? 200 : 503;
      res.status(statusCode).json(health);
    });

    // Add metrics endpoint
    app.get('/metrics', (req, res) => {
      const metrics = this.getMetrics(1)[0] || {};
      res.json(metrics);
    });

    logger.info('Express integration configured');
  }

  // Cleanup
  async stop() {
    logger.info('Stopping Enterprise Integration Hub...');

    // Clear intervals
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }

    // Stop all integrations
    for (const [name, integration] of this.integrations) {
      try {
        if (typeof integration.stop === 'function') {
          await integration.stop();
        }
        logger.info(`${name} integration stopped`);
      } catch (error) {
        logger.error(`Error stopping ${name} integration`, error);
      }
    }

    this.integrations.clear();
    this.emit('integrations:stopped');
    
    logger.info('Enterprise Integration Hub stopped');
  }
}

// Individual exports for direct use
export {
  SSOProvider,
  RestApiVersioning,
  GraphQLFederation,
  WebhookStreaming,
  MessageQueueIntegration,
  OpenAPIGenerator
};

export default EnterpriseIntegrationHub;