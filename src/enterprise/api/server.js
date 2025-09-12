/**
 * KGEN Enterprise API Server
 * High-performance REST API with authentication, rate limiting, and monitoring
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import { expressjwt } from 'express-jwt';
import { graphqlHTTP } from 'express-graphql';
import swaggerUi from 'swagger-ui-express';
import yaml from 'yaml';
import fs from 'fs-extra';
import path from 'path';

// Import route handlers
import { graphRoutes } from './routes/graphs.js';
import { templateRoutes } from './routes/templates.js';
import { webhookRoutes } from './routes/webhooks.js';
import { jobRoutes } from './routes/jobs.js';
import { integrationRoutes } from './routes/integrations.js';
import { etlRoutes } from './routes/etl.js';

// Import middleware
import { authMiddleware } from './middleware/auth.js';
import { validationMiddleware } from './middleware/validation.js';
import { errorMiddleware } from './middleware/error.js';
import { loggingMiddleware } from './middleware/logging.js';
import { metricsMiddleware } from './middleware/metrics.js';

// Import GraphQL schema
import { schema } from '../graphql/schema.js';
import { rootResolver } from '../graphql/resolvers.js';

// Import configuration
import { config } from './config/server.js';

class EnterpriseAPIServer {
    constructor(options = {}) {
        this.app = express();
        this.config = { ...config, ...options };
        this.server = null;
        
        this.setupMiddleware();
        this.setupRoutes();
        this.setupErrorHandling();
    }

    setupMiddleware() {
        // Security middleware
        this.app.use(helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    styleSrc: ["'self'", "'unsafe-inline'"],
                    scriptSrc: ["'self'"],
                    imgSrc: ["'self'", "data:", "https:"]
                }
            }
        }));

        // CORS configuration
        this.app.use(cors({
            origin: this.config.cors.origins,
            credentials: true,
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
        }));

        // Compression
        this.app.use(compression({
            filter: (req, res) => {
                if (req.headers['x-no-compression']) return false;
                return compression.filter(req, res);
            }
        }));

        // Body parsing
        this.app.use(express.json({ limit: this.config.limits.requestSize }));
        this.app.use(express.urlencoded({ extended: true, limit: this.config.limits.requestSize }));

        // Rate limiting
        const createRateLimit = (windowMs, max, message) => 
            rateLimit({
                windowMs,
                max,
                message: { error: 'RATE_LIMIT_EXCEEDED', message },
                standardHeaders: true,
                legacyHeaders: false,
                handler: (req, res) => {
                    res.status(429).json({
                        error: 'RATE_LIMIT_EXCEEDED',
                        message,
                        retryAfter: Math.ceil(windowMs / 1000)
                    });
                }
            });

        // Different rate limits for different endpoints
        this.app.use('/api/v1/auth', createRateLimit(
            15 * 60 * 1000, // 15 minutes
            5, // 5 requests per window
            'Too many authentication attempts'
        ));

        this.app.use('/api/v1', createRateLimit(
            15 * 60 * 1000, // 15 minutes
            this.config.rateLimit.requests, // configurable limit
            'API rate limit exceeded'
        ));

        // Logging and metrics
        this.app.use(loggingMiddleware());
        this.app.use(metricsMiddleware());

        // JWT Authentication
        this.app.use('/api/v1', expressjwt({
            secret: this.config.jwt.secret,
            algorithms: ['HS256'],
            credentialsRequired: true,
            getToken: (req) => {
                if (req.headers.authorization && req.headers.authorization.split(' ')[0] === 'Bearer') {
                    return req.headers.authorization.split(' ')[1];
                }
                if (req.headers['x-api-key']) {
                    // Handle API key authentication
                    return this.validateApiKey(req.headers['x-api-key']);
                }
                return null;
            }
        }).unless({
            path: [
                '/api/v1/health',
                '/api/v1/docs',
                '/api/v1/auth/login',
                '/api/v1/auth/register',
                { url: /^\/api\/v1\/webhooks\/.*/, methods: ['POST'] } // Webhook endpoints
            ]
        }));

        // Custom authentication middleware
        this.app.use('/api/v1', authMiddleware(this.config.auth));

        // Request validation middleware
        this.app.use('/api/v1', validationMiddleware());
    }

    setupRoutes() {
        // Health check endpoint
        this.app.get('/api/v1/health', (req, res) => {
            res.json({
                status: 'healthy',
                version: process.env.npm_package_version || '1.0.0',
                timestamp: this.getDeterministicDate().toISOString(),
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                environment: process.env.NODE_ENV || 'development'
            });
        });

        // API Documentation
        this.setupApiDocs();

        // GraphQL endpoint
        this.app.use('/api/v1/graphql', graphqlHTTP((req, res) => ({
            schema,
            rootValue: rootResolver,
            graphiql: this.config.graphql.graphiql,
            context: {
                user: req.user,
                req,
                res
            },
            customFormatErrorFn: (error) => ({
                message: error.message,
                locations: error.locations,
                path: error.path,
                extensions: {
                    code: error.extensions?.code || 'INTERNAL_ERROR',
                    timestamp: this.getDeterministicDate().toISOString()
                }
            })
        })));

        // REST API routes
        this.app.use('/api/v1/graphs', graphRoutes);
        this.app.use('/api/v1/templates', templateRoutes);
        this.app.use('/api/v1/webhooks', webhookRoutes);
        this.app.use('/api/v1/jobs', jobRoutes);
        this.app.use('/api/v1/integrations', integrationRoutes);
        this.app.use('/api/v1/etl', etlRoutes);

        // Webhook receiver endpoint
        this.app.post('/api/v1/webhooks/:id/receive', async (req, res) => {
            try {
                const { id } = req.params;
                const webhook = await this.getWebhookById(id);
                
                if (!webhook || !webhook.active) {
                    return res.status(404).json({
                        error: 'WEBHOOK_NOT_FOUND',
                        message: 'Webhook not found or inactive'
                    });
                }

                // Validate webhook signature
                if (webhook.secret) {
                    const signature = req.headers['x-hub-signature-256'];
                    if (!this.validateWebhookSignature(req.body, webhook.secret, signature)) {
                        return res.status(401).json({
                            error: 'INVALID_SIGNATURE',
                            message: 'Webhook signature validation failed'
                        });
                    }
                }

                // Process webhook payload
                await this.processWebhookPayload(webhook, req.body);

                res.status(200).json({ received: true });
            } catch (error) {
                res.status(500).json({
                    error: 'WEBHOOK_PROCESSING_ERROR',
                    message: error.message
                });
            }
        });

        // 404 handler for API routes
        this.app.use('/api/v1/*', (req, res) => {
            res.status(404).json({
                error: 'NOT_FOUND',
                message: 'API endpoint not found',
                path: req.path,
                method: req.method
            });
        });
    }

    setupApiDocs() {
        try {
            const openApiSpec = yaml.parse(
                fs.readFileSync(path.resolve('docs/api/openapi.yaml'), 'utf8')
            );

            // Serve Swagger UI
            this.app.use('/api/v1/docs', swaggerUi.serve);
            this.app.get('/api/v1/docs', swaggerUi.setup(openApiSpec, {
                customCss: '.swagger-ui .topbar { display: none }',
                customSiteTitle: 'KGEN Enterprise API Documentation'
            }));

            // Serve OpenAPI spec as JSON
            this.app.get('/api/v1/openapi.json', (req, res) => {
                res.json(openApiSpec);
            });

        } catch (error) {
            console.warn('Could not load OpenAPI specification:', error.message);
        }
    }

    setupErrorHandling() {
        // Global error handler
        this.app.use(errorMiddleware());

        // Unhandled promise rejection
        process.on('unhandledRejection', (reason, promise) => {
            console.error('Unhandled Rejection at:', promise, 'reason:', reason);
        });

        // Uncaught exception
        process.on('uncaughtException', (error) => {
            console.error('Uncaught Exception:', error);
            this.shutdown();
        });

        // Graceful shutdown
        process.on('SIGTERM', () => this.shutdown());
        process.on('SIGINT', () => this.shutdown());
    }

    validateApiKey(apiKey) {
        // Implement API key validation logic
        // This would typically check against a database or external service
        const validApiKeys = this.config.auth.apiKeys || [];
        return validApiKeys.includes(apiKey) ? apiKey : null;
    }

    validateWebhookSignature(payload, secret, signature) {
        const crypto = require('crypto');
        const expectedSignature = 'sha256=' + crypto
            .createHmac('sha256', secret)
            .update(JSON.stringify(payload))
            .digest('hex');
        
        return crypto.timingSafeEqual(
            Buffer.from(signature || ''),
            Buffer.from(expectedSignature)
        );
    }

    async getWebhookById(id) {
        // Implement webhook lookup logic
        // This would typically query a database
        return null;
    }

    async processWebhookPayload(webhook, payload) {
        // Implement webhook payload processing
        // This would handle different webhook events
    }

    start() {
        return new Promise((resolve, reject) => {
            try {
                this.server = this.app.listen(this.config.port, this.config.host, () => {
                    console.log(`KGEN Enterprise API Server running on ${this.config.host}:${this.config.port}`);
                    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
                    console.log(`API Documentation: http://${this.config.host}:${this.config.port}/api/v1/docs`);
                    console.log(`GraphQL Playground: http://${this.config.host}:${this.config.port}/api/v1/graphql`);
                    resolve(this.server);
                });

                this.server.on('error', (error) => {
                    if (error.code === 'EADDRINUSE') {
                        console.error(`Port ${this.config.port} is already in use`);
                    }
                    reject(error);
                });

            } catch (error) {
                reject(error);
            }
        });
    }

    shutdown() {
        return new Promise((resolve) => {
            console.log('Shutting down Enterprise API Server...');
            
            if (this.server) {
                this.server.close(() => {
                    console.log('Server closed');
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }
}

// Server configuration
const serverConfig = {
    port: process.env.PORT || 8080,
    host: process.env.HOST || '0.0.0.0',
    cors: {
        origins: process.env.CORS_ORIGINS ? 
            process.env.CORS_ORIGINS.split(',') : 
            ['http://localhost:3000', 'http://localhost:8080']
    },
    jwt: {
        secret: process.env.JWT_SECRET || 'your-jwt-secret-change-in-production',
        expiresIn: '24h'
    },
    auth: {
        apiKeys: process.env.API_KEYS ? process.env.API_KEYS.split(',') : []
    },
    rateLimit: {
        requests: parseInt(process.env.RATE_LIMIT_REQUESTS) || 100
    },
    limits: {
        requestSize: '10mb'
    },
    graphql: {
        graphiql: process.env.NODE_ENV !== 'production'
    }
};

// Export server class and create instance
export { EnterpriseAPIServer };

// Start server if this module is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const server = new EnterpriseAPIServer(serverConfig);
    
    server.start().catch((error) => {
        console.error('Failed to start server:', error);
        process.exit(1);
    });
}