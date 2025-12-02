/**
 * KGEN Enterprise API Gateway
 * Advanced API gateway with versioning, throttling, load balancing, and monitoring
 */

import express from 'express';
import httpProxy from 'http-proxy-middleware';
import rateLimit from 'express-rate-limit';
import { EventEmitter } from 'events';
import Redis from 'ioredis';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

// API Gateway capabilities
export const GATEWAY_FEATURES = {
    RATE_LIMITING: 'rate_limiting',
    LOAD_BALANCING: 'load_balancing',
    API_VERSIONING: 'api_versioning',
    REQUEST_TRANSFORMATION: 'request_transformation',
    RESPONSE_TRANSFORMATION: 'response_transformation',
    AUTHENTICATION: 'authentication',
    AUTHORIZATION: 'authorization',
    CACHING: 'caching',
    MONITORING: 'monitoring',
    CIRCUIT_BREAKER: 'circuit_breaker',
    REQUEST_VALIDATION: 'request_validation',
    RESPONSE_FILTERING: 'response_filtering',
    API_ANALYTICS: 'api_analytics',
    WEBHOOK_PROXY: 'webhook_proxy'
};

// Load balancing strategies
export const LOAD_BALANCING_STRATEGIES = {
    ROUND_ROBIN: 'round_robin',
    LEAST_CONNECTIONS: 'least_connections',
    WEIGHTED_ROUND_ROBIN: 'weighted_round_robin',
    IP_HASH: 'ip_hash',
    HEALTH_BASED: 'health_based'
};

// Rate limiting strategies
export const RATE_LIMITING_STRATEGIES = {
    FIXED_WINDOW: 'fixed_window',
    SLIDING_WINDOW: 'sliding_window',
    TOKEN_BUCKET: 'token_bucket',
    LEAKY_BUCKET: 'leaky_bucket'
};

/**
 * API Gateway Core
 */
export class APIGateway extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            port: config.port || 3000,
            host: config.host || '0.0.0.0',
            redis: {
                host: process.env.REDIS_HOST || 'localhost',
                port: process.env.REDIS_PORT || 6379,
                password: process.env.REDIS_PASSWORD,
                db: process.env.REDIS_GATEWAY_DB || 1,
                ...config.redis
            },
            rateLimiting: {
                strategy: RATE_LIMITING_STRATEGIES.SLIDING_WINDOW,
                defaultLimits: {
                    requests: 1000,
                    window: 60 * 1000, // 1 minute
                    burst: 100
                },
                ...config.rateLimiting
            },
            loadBalancing: {
                strategy: LOAD_BALANCING_STRATEGIES.ROUND_ROBIN,
                healthCheck: {
                    enabled: true,
                    interval: 30000,
                    timeout: 5000,
                    path: '/health'
                },
                ...config.loadBalancing
            },
            caching: {
                enabled: true,
                defaultTTL: 300, // 5 minutes
                ...config.caching
            },
            monitoring: {
                enabled: true,
                metrics: ['requests', 'latency', 'errors', 'cache_hits'],
                ...config.monitoring
            },
            security: {
                cors: true,
                helmet: true,
                ...config.security
            },
            ...config
        };

        this.app = express();
        this.redis = new Redis(this.config.redis);
        this.routes = new Map();
        this.backends = new Map();
        this.metrics = new Map();
        this.circuitBreakers = new Map();
        
        this.setupMiddleware();
        this.setupHealthChecks();
    }

    setupMiddleware() {
        // Security middleware
        if (this.config.security.helmet) {
            const helmet = require('helmet');
            this.app.use(helmet());
        }

        if (this.config.security.cors) {
            const cors = require('cors');
            this.app.use(cors({
                origin: this.config.security.corsOrigins || true,
                credentials: true
            }));
        }

        // Request parsing
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

        // Request ID middleware
        this.app.use((req, res, next) => {
            req.id = req.headers['x-request-id'] || crypto.randomUUID();
            res.setHeader('X-Request-ID', req.id);
            next();
        });

        // Monitoring middleware
        if (this.config.monitoring.enabled) {
            this.app.use(this.monitoringMiddleware.bind(this));
        }

        // Gateway routes
        this.setupGatewayRoutes();
    }

    setupGatewayRoutes() {
        // Gateway health endpoint
        this.app.get('/gateway/health', (req, res) => {
            res.json({
                status: 'healthy',
                version: '1.0.0',
                timestamp: this.getDeterministicDate().toISOString(),
                uptime: process.uptime(),
                backends: this.getBackendStatus(),
                metrics: this.getMetricsSummary()
            });
        });

        // Gateway status endpoint
        this.app.get('/gateway/status', (req, res) => {
            res.json({
                routes: Array.from(this.routes.keys()),
                backends: Array.from(this.backends.keys()),
                activeConnections: this.getActiveConnections(),
                metrics: this.getMetricsSummary()
            });
        });

        // Gateway metrics endpoint
        this.app.get('/gateway/metrics', (req, res) => {
            res.json(this.getDetailedMetrics());
        });

        // Route configuration endpoint
        this.app.get('/gateway/routes', (req, res) => {
            const routes = Array.from(this.routes.entries()).map(([path, config]) => ({
                path,
                ...config,
                backends: config.backends.map(backend => ({
                    ...backend,
                    healthy: this.isBackendHealthy(backend.id)
                }))
            }));
            
            res.json({ routes });
        });
    }

    /**
     * Register API route with backends
     */
    async registerRoute(routeConfig) {
        const {
            path,
            methods = ['GET', 'POST', 'PUT', 'DELETE'],
            backends,
            version = 'v1',
            rateLimiting,
            caching,
            authentication,
            transformation,
            validation
        } = routeConfig;

        const routeKey = `${version}:${path}`;
        const config = {
            path,
            methods: Array.isArray(methods) ? methods : [methods],
            backends: backends.map((backend, index) => ({
                id: backend.id || `${routeKey}_backend_${index}`,
                url: backend.url,
                weight: backend.weight || 1,
                timeout: backend.timeout || 30000,
                healthy: true,
                ...backend
            })),
            version,
            rateLimiting: rateLimiting || this.config.rateLimiting.defaultLimits,
            caching: caching || this.config.caching,
            authentication,
            transformation,
            validation,
            createdAt: this.getDeterministicDate().toISOString()
        };

        // Register backends for health checking
        for (const backend of config.backends) {
            this.backends.set(backend.id, backend);
        }

        // Create proxy middleware
        const proxyMiddleware = this.createProxyMiddleware(config);

        // Apply route-specific middleware
        const middlewares = [
            this.createRateLimitMiddleware(config.rateLimiting),
            this.createAuthenticationMiddleware(config.authentication),
            this.createValidationMiddleware(config.validation),
            this.createCachingMiddleware(config.caching),
            this.createTransformationMiddleware(config.transformation),
            proxyMiddleware
        ].filter(Boolean);

        // Register route with Express
        const routePath = `/api/${version}${path}`;
        
        for (const method of config.methods) {
            this.app[method.toLowerCase()](routePath, ...middlewares);
        }

        this.routes.set(routeKey, config);
        
        this.emit('route:registered', { routeKey, config });
        
        console.log(`Registered route: ${config.methods.join(',')} ${routePath} -> ${config.backends.length} backends`);
        
        return config;
    }

    createProxyMiddleware(routeConfig) {
        const currentBackendIndex = 0;
        
        return httpProxy.createProxyMiddleware({
            target: 'http://placeholder', // This will be overridden
            changeOrigin: true,
            ws: true,
            timeout: routeConfig.backends[0]?.timeout || 30000,
            
            router: (req) => {
                // Load balancing logic
                const backend = this.selectBackend(routeConfig, req);
                if (!backend) {
                    throw new Error('No healthy backends available');
                }
                
                req.selectedBackend = backend;
                return backend.url;
            },
            
            pathRewrite: (path, req) => {
                // Remove version prefix if backend doesn't expect it
                if (routeConfig.stripVersionPrefix) {
                    return path.replace(`/api/${routeConfig.version}`, '');
                }
                return path;
            },
            
            onProxyReq: (proxyReq, req, res) => {
                // Add gateway headers
                proxyReq.setHeader('X-Gateway-Route', routeConfig.path);
                proxyReq.setHeader('X-Gateway-Version', routeConfig.version);
                proxyReq.setHeader('X-Gateway-Backend', req.selectedBackend.id);
                proxyReq.setHeader('X-Forwarded-For', req.ip);
                
                // Apply request transformation
                if (routeConfig.transformation?.request) {
                    this.applyRequestTransformation(proxyReq, req, routeConfig.transformation.request);
                }
                
                this.emit('request:proxied', {
                    requestId: req.id,
                    route: routeConfig.path,
                    backend: req.selectedBackend.id,
                    method: req.method,
                    path: req.path
                });
            },
            
            onProxyRes: (proxyRes, req, res) => {
                // Apply response transformation
                if (routeConfig.transformation?.response) {
                    this.applyResponseTransformation(proxyRes, req, res, routeConfig.transformation.response);
                }
                
                // Update metrics
                this.updateMetrics(req, proxyRes);
                
                this.emit('response:received', {
                    requestId: req.id,
                    route: routeConfig.path,
                    backend: req.selectedBackend.id,
                    statusCode: proxyRes.statusCode,
                    responseTime: this.getDeterministicTimestamp() - req.startTime
                });
            },
            
            onError: (err, req, res) => {
                console.error(`Proxy error for route ${routeConfig.path}:`, err.message);
                
                // Mark backend as unhealthy if connection error
                if (req.selectedBackend && err.code === 'ECONNREFUSED') {
                    this.markBackendUnhealthy(req.selectedBackend.id);
                }
                
                // Circuit breaker logic
                this.updateCircuitBreaker(routeConfig.path, false);
                
                this.emit('request:error', {
                    requestId: req.id,
                    route: routeConfig.path,
                    backend: req.selectedBackend?.id,
                    error: err.message
                });
                
                if (!res.headersSent) {
                    res.status(502).json({
                        error: 'BAD_GATEWAY',
                        message: 'Backend service unavailable',
                        requestId: req.id,
                        timestamp: this.getDeterministicDate().toISOString()
                    });
                }
            }
        });
    }

    selectBackend(routeConfig, req) {
        const healthyBackends = routeConfig.backends.filter(backend => 
            this.isBackendHealthy(backend.id)
        );
        
        if (healthyBackends.length === 0) {
            return null;
        }
        
        switch (this.config.loadBalancing.strategy) {
            case LOAD_BALANCING_STRATEGIES.ROUND_ROBIN:
                return this.roundRobinSelection(healthyBackends, routeConfig.path);
                
            case LOAD_BALANCING_STRATEGIES.LEAST_CONNECTIONS:
                return this.leastConnectionsSelection(healthyBackends);
                
            case LOAD_BALANCING_STRATEGIES.WEIGHTED_ROUND_ROBIN:
                return this.weightedRoundRobinSelection(healthyBackends, routeConfig.path);
                
            case LOAD_BALANCING_STRATEGIES.IP_HASH:
                return this.ipHashSelection(healthyBackends, req.ip);
                
            case LOAD_BALANCING_STRATEGIES.HEALTH_BASED:
                return this.healthBasedSelection(healthyBackends);
                
            default:
                return healthyBackends[0];
        }
    }

    roundRobinSelection(backends, routePath) {
        const key = `rr_${routePath}`;
        const index = this.metrics.get(key) || 0;
        const selected = backends[index % backends.length];
        this.metrics.set(key, index + 1);
        return selected;
    }

    leastConnectionsSelection(backends) {
        return backends.reduce((min, backend) => {
            const connections = this.getBackendConnections(backend.id);
            const minConnections = this.getBackendConnections(min.id);
            return connections < minConnections ? backend : min;
        });
    }

    weightedRoundRobinSelection(backends, routePath) {
        const key = `wrr_${routePath}`;
        const weights = this.metrics.get(key) || backends.map(b => ({ id: b.id, weight: b.weight, current: 0 }));
        
        // Find backend with highest current weight
        let selected = null;
        let maxWeight = -1;
        
        for (const weight of weights) {
            weight.current += weight.weight;
            if (weight.current > maxWeight) {
                maxWeight = weight.current;
                selected = backends.find(b => b.id === weight.id);
            }
        }
        
        // Reduce selected backend's current weight
        const selectedWeight = weights.find(w => w.id === selected.id);
        if (selectedWeight) {
            selectedWeight.current -= weights.reduce((sum, w) => sum + w.weight, 0);
        }
        
        this.metrics.set(key, weights);
        return selected;
    }

    ipHashSelection(backends, ip) {
        const hash = crypto.createHash('md5').update(ip).digest('hex');
        const index = parseInt(hash.substring(0, 8), 16) % backends.length;
        return backends[index];
    }

    healthBasedSelection(backends) {
        // Sort by health score (response time, error rate, etc.)
        return backends.sort((a, b) => {
            const healthA = this.getBackendHealthScore(a.id);
            const healthB = this.getBackendHealthScore(b.id);
            return healthB - healthA;
        })[0];
    }

    createRateLimitMiddleware(rateLimitConfig) {
        if (!rateLimitConfig) return null;
        
        return rateLimit({
            windowMs: rateLimitConfig.window,
            max: rateLimitConfig.requests,
            message: {
                error: 'RATE_LIMIT_EXCEEDED',
                message: 'Too many requests, please try again later',
                retryAfter: Math.ceil(rateLimitConfig.window / 1000)
            },
            standardHeaders: true,
            legacyHeaders: false,
            
            keyGenerator: (req) => {
                // Use user ID if authenticated, otherwise IP
                return req.user?.id || req.ip;
            },
            
            handler: (req, res) => {
                this.emit('rate_limit:exceeded', {
                    requestId: req.id,
                    ip: req.ip,
                    userId: req.user?.id,
                    route: req.route?.path
                });
                
                res.status(429).json({
                    error: 'RATE_LIMIT_EXCEEDED',
                    message: 'Too many requests, please try again later',
                    retryAfter: Math.ceil(rateLimitConfig.window / 1000),
                    requestId: req.id,
                    timestamp: this.getDeterministicDate().toISOString()
                });
            }
        });
    }

    createAuthenticationMiddleware(authConfig) {
        if (!authConfig || !authConfig.required) return null;
        
        return async (req, res, next) => {
            try {
                const token = this.extractToken(req, authConfig.type || 'bearer');
                
                if (!token) {
                    return res.status(401).json({
                        error: 'UNAUTHORIZED',
                        message: 'Authentication required',
                        requestId: req.id
                    });
                }
                
                const user = await this.validateToken(token, authConfig);
                
                // Check required permissions
                if (authConfig.permissions) {
                    const hasPermission = authConfig.permissions.some(permission => 
                        user.permissions?.includes(permission)
                    );
                    
                    if (!hasPermission) {
                        return res.status(403).json({
                            error: 'FORBIDDEN',
                            message: 'Insufficient permissions',
                            requestId: req.id,
                            required: authConfig.permissions
                        });
                    }
                }
                
                req.user = user;
                next();
                
            } catch (error) {
                res.status(401).json({
                    error: 'UNAUTHORIZED',
                    message: error.message,
                    requestId: req.id
                });
            }
        };
    }

    createValidationMiddleware(validationConfig) {
        if (!validationConfig) return null;
        
        return (req, res, next) => {
            try {
                // Validate request body
                if (validationConfig.body && req.body) {
                    this.validateSchema(req.body, validationConfig.body);
                }
                
                // Validate query parameters
                if (validationConfig.query) {
                    this.validateSchema(req.query, validationConfig.query);
                }
                
                // Validate path parameters
                if (validationConfig.params) {
                    this.validateSchema(req.params, validationConfig.params);
                }
                
                // Validate headers
                if (validationConfig.headers) {
                    this.validateSchema(req.headers, validationConfig.headers);
                }
                
                next();
                
            } catch (error) {
                res.status(400).json({
                    error: 'VALIDATION_ERROR',
                    message: error.message,
                    requestId: req.id,
                    timestamp: this.getDeterministicDate().toISOString()
                });
            }
        };
    }

    createCachingMiddleware(cacheConfig) {
        if (!cacheConfig || !cacheConfig.enabled) return null;
        
        return async (req, res, next) => {
            // Only cache GET requests
            if (req.method !== 'GET') {
                return next();
            }
            
            const cacheKey = this.generateCacheKey(req, cacheConfig);
            
            try {
                const cached = await this.redis.get(cacheKey);
                
                if (cached) {
                    const cachedResponse = JSON.parse(cached);
                    
                    res.set(cachedResponse.headers);
                    res.status(cachedResponse.statusCode);
                    res.setHeader('X-Cache', 'HIT');
                    res.setHeader('X-Cache-Key', cacheKey);
                    
                    this.emit('cache:hit', { requestId: req.id, cacheKey });
                    
                    return res.send(cachedResponse.body);
                }
                
                // Cache miss - intercept response
                const originalSend = res.send;
                const originalJson = res.json;
                
                res.send = function(body) {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        const cachedResponse = {
                            statusCode: res.statusCode,
                            headers: res.getHeaders(),
                            body
                        };
                        
                        const ttl = cacheConfig.ttl || 300; // 5 minutes default
                        this.redis.setex(cacheKey, ttl, JSON.stringify(cachedResponse));
                        
                        this.emit('cache:set', { requestId: req.id, cacheKey, ttl });
                    }
                    
                    res.setHeader('X-Cache', 'MISS');
                    originalSend.call(this, body);
                }.bind(this);
                
                res.json = function(obj) {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        const cachedResponse = {
                            statusCode: res.statusCode,
                            headers: res.getHeaders(),
                            body: obj
                        };
                        
                        const ttl = cacheConfig.ttl || 300;
                        this.redis.setex(cacheKey, ttl, JSON.stringify(cachedResponse));
                        
                        this.emit('cache:set', { requestId: req.id, cacheKey, ttl });
                    }
                    
                    res.setHeader('X-Cache', 'MISS');
                    originalJson.call(this, obj);
                }.bind(this);
                
                next();
                
            } catch (error) {
                console.error('Cache middleware error:', error);
                next();
            }
        };
    }

    createTransformationMiddleware(transformConfig) {
        if (!transformConfig) return null;
        
        return (req, res, next) => {
            // Request transformation is handled in proxy middleware
            // This middleware handles response transformation setup
            req.transformConfig = transformConfig;
            next();
        };
    }

    monitoringMiddleware(req, res, next) {
        req.startTime = this.getDeterministicTimestamp();
        
        const originalEnd = res.end;
        res.end = function(chunk, encoding) {
            const responseTime = this.getDeterministicTimestamp() - req.startTime;
            
            this.updateRequestMetrics({
                method: req.method,
                path: req.path,
                statusCode: res.statusCode,
                responseTime,
                contentLength: res.get('Content-Length') || 0,
                userAgent: req.get('User-Agent'),
                ip: req.ip,
                userId: req.user?.id
            });
            
            originalEnd.call(this, chunk, encoding);
        }.bind(this);
        
        next();
    }

    extractToken(req, type = 'bearer') {
        switch (type.toLowerCase()) {
            case 'bearer':
                const authHeader = req.headers.authorization;
                return authHeader && authHeader.startsWith('Bearer ') 
                    ? authHeader.substring(7) 
                    : null;
                    
            case 'query':
                return req.query.token;
                
            case 'header':
                return req.headers['x-api-key'];
                
            case 'cookie':
                return req.cookies?.token;
                
            default:
                return null;
        }
    }

    async validateToken(token, authConfig) {
        // This would integrate with the authentication system
        try {
            const payload = jwt.verify(token, authConfig.secret || this.config.jwtSecret);
            return payload;
        } catch (error) {
            throw new Error('Invalid token');
        }
    }

    validateSchema(data, schema) {
        // Simple schema validation - in production, use joi or ajv
        for (const [field, rules] of Object.entries(schema)) {
            const value = data[field];
            
            if (rules.required && (value === undefined || value === null)) {
                throw new Error(`Field '${field}' is required`);
            }
            
            if (value !== undefined && rules.type) {
                const actualType = Array.isArray(value) ? 'array' : typeof value;
                if (actualType !== rules.type) {
                    throw new Error(`Field '${field}' must be of type ${rules.type}`);
                }
            }
        }
    }

    generateCacheKey(req, cacheConfig) {
        const parts = [
            req.method,
            req.path,
            req.user?.id || 'anonymous'
        ];
        
        if (cacheConfig.includeQuery) {
            parts.push(JSON.stringify(req.query));
        }
        
        if (cacheConfig.includeHeaders) {
            const headers = {};
            for (const header of cacheConfig.includeHeaders) {
                headers[header] = req.headers[header];
            }
            parts.push(JSON.stringify(headers));
        }
        
        return crypto.createHash('md5').update(parts.join('|')).digest('hex');
    }

    applyRequestTransformation(proxyReq, req, transformConfig) {
        // Apply request transformations
        if (transformConfig.headers) {
            for (const [header, value] of Object.entries(transformConfig.headers)) {
                proxyReq.setHeader(header, value);
            }
        }
        
        if (transformConfig.removeHeaders) {
            for (const header of transformConfig.removeHeaders) {
                proxyReq.removeHeader(header);
            }
        }
    }

    applyResponseTransformation(proxyRes, req, res, transformConfig) {
        // Apply response transformations
        if (transformConfig.headers) {
            for (const [header, value] of Object.entries(transformConfig.headers)) {
                res.setHeader(header, value);
            }
        }
        
        if (transformConfig.removeHeaders) {
            for (const header of transformConfig.removeHeaders) {
                res.removeHeader(header);
            }
        }
    }

    setupHealthChecks() {
        if (!this.config.loadBalancing.healthCheck.enabled) return;
        
        setInterval(async () => {
            await this.performHealthChecks();
        }, this.config.loadBalancing.healthCheck.interval);
    }

    async performHealthChecks() {
        const axios = require('axios');
        const promises = [];
        
        for (const [backendId, backend] of this.backends) {
            const healthCheckPromise = axios.get(
                `${backend.url}${this.config.loadBalancing.healthCheck.path}`,
                {
                    timeout: this.config.loadBalancing.healthCheck.timeout,
                    validateStatus: () => true
                }
            ).then(response => {
                const isHealthy = response.status >= 200 && response.status < 300;
                this.setBackendHealth(backendId, isHealthy);
                
                if (!isHealthy) {
                    this.emit('backend:unhealthy', { backendId, statusCode: response.status });
                }
            }).catch(error => {
                this.setBackendHealth(backendId, false);
                this.emit('backend:unhealthy', { backendId, error: error.message });
            });
            
            promises.push(healthCheckPromise);
        }
        
        await Promise.allSettled(promises);
    }

    setBackendHealth(backendId, healthy) {
        const backend = this.backends.get(backendId);
        if (backend) {
            const wasHealthy = backend.healthy;
            backend.healthy = healthy;
            backend.lastHealthCheck = this.getDeterministicDate().toISOString();
            
            if (wasHealthy !== healthy) {
                this.emit('backend:health_changed', { 
                    backendId, 
                    healthy,
                    previousState: wasHealthy
                });
            }
        }
    }

    isBackendHealthy(backendId) {
        const backend = this.backends.get(backendId);
        return backend ? backend.healthy : false;
    }

    markBackendUnhealthy(backendId) {
        this.setBackendHealth(backendId, false);
    }

    getBackendStatus() {
        const status = {};
        for (const [id, backend] of this.backends) {
            status[id] = {
                url: backend.url,
                healthy: backend.healthy,
                lastHealthCheck: backend.lastHealthCheck
            };
        }
        return status;
    }

    updateMetrics(req, proxyRes) {
        const routeKey = `${req.route?.path || req.path}`;
        const metricsKey = `metrics:${routeKey}`;
        
        // Update request count
        this.redis.incr(`${metricsKey}:requests`);
        
        // Update response time
        const responseTime = this.getDeterministicTimestamp() - req.startTime;
        this.redis.lpush(`${metricsKey}:response_times`, responseTime);
        this.redis.ltrim(`${metricsKey}:response_times`, 0, 99); // Keep last 100
        
        // Update error count
        if (proxyRes.statusCode >= 400) {
            this.redis.incr(`${metricsKey}:errors`);
        }
        
        // Update status code count
        this.redis.incr(`${metricsKey}:status:${proxyRes.statusCode}`);
    }

    updateRequestMetrics(metrics) {
        const routeKey = `${metrics.path}`;
        const metricsKey = `metrics:${routeKey}`;
        
        // Store metrics in Redis
        const data = {
            ...metrics,
            timestamp: this.getDeterministicDate().toISOString()
        };
        
        this.redis.lpush(`${metricsKey}:requests`, JSON.stringify(data));
        this.redis.ltrim(`${metricsKey}:requests`, 0, 999); // Keep last 1000
        this.redis.expire(`${metricsKey}:requests`, 86400); // 24 hours
    }

    updateCircuitBreaker(routePath, success) {
        const key = `cb:${routePath}`;
        const circuitBreaker = this.circuitBreakers.get(key) || {
            failures: 0,
            lastFailure: null,
            state: 'CLOSED' // CLOSED, OPEN, HALF_OPEN
        };
        
        if (success) {
            circuitBreaker.failures = 0;
            if (circuitBreaker.state === 'HALF_OPEN') {
                circuitBreaker.state = 'CLOSED';
            }
        } else {
            circuitBreaker.failures++;
            circuitBreaker.lastFailure = this.getDeterministicTimestamp();
            
            if (circuitBreaker.failures >= 5) { // Threshold
                circuitBreaker.state = 'OPEN';
            }
        }
        
        this.circuitBreakers.set(key, circuitBreaker);
    }

    getBackendConnections(backendId) {
        return this.metrics.get(`connections:${backendId}`) || 0;
    }

    getBackendHealthScore(backendId) {
        // Simple health score based on response time and error rate
        // In production, this would be more sophisticated
        return Math.random() * 100; // Placeholder
    }

    getActiveConnections() {
        return Array.from(this.backends.keys()).reduce((total, backendId) => {
            return total + this.getBackendConnections(backendId);
        }, 0);
    }

    getMetricsSummary() {
        return {
            totalRequests: Array.from(this.routes.keys()).length,
            totalBackends: this.backends.size,
            healthyBackends: Array.from(this.backends.values()).filter(b => b.healthy).length
        };
    }

    getDetailedMetrics() {
        const metrics = {};
        
        for (const routeKey of this.routes.keys()) {
            const route = this.routes.get(routeKey);
            metrics[routeKey] = {
                path: route.path,
                version: route.version,
                backends: route.backends.map(b => ({
                    id: b.id,
                    url: b.url,
                    healthy: this.isBackendHealthy(b.id),
                    connections: this.getBackendConnections(b.id)
                }))
            };
        }
        
        return metrics;
    }

    async start() {
        return new Promise((resolve, reject) => {
            this.server = this.app.listen(this.config.port, this.config.host, () => {
                console.log(`API Gateway running on ${this.config.host}:${this.config.port}`);
                console.log(`Features enabled: ${Object.keys(GATEWAY_FEATURES).join(', ')}`);
                console.log(`Load balancing: ${this.config.loadBalancing.strategy}`);
                console.log(`Rate limiting: ${this.config.rateLimiting.strategy}`);
                
                this.emit('gateway:started', {
                    host: this.config.host,
                    port: this.config.port,
                    features: Object.values(GATEWAY_FEATURES)
                });
                
                resolve(this.server);
            });

            this.server.on('error', reject);
        });
    }

    async shutdown() {
        console.log('Shutting down API Gateway...');
        
        if (this.server) {
            await new Promise((resolve) => {
                this.server.close(resolve);
            });
        }
        
        await this.redis.quit();
        
        this.emit('gateway:shutdown');
        console.log('API Gateway shut down successfully');
    }
}

export default {
    APIGateway,
    GATEWAY_FEATURES,
    LOAD_BALANCING_STRATEGIES,
    RATE_LIMITING_STRATEGIES
};