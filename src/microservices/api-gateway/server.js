#!/usr/bin/env node

/**
 * KGEN API Gateway Service
 * 
 * Multi-tenant cloud-native API gateway with:
 * - Tenant-aware routing and isolation
 * - Authentication and authorization (JWT + mTLS)
 * - Rate limiting and DDoS protection
 * - Request/response transformation
 * - Load balancing and circuit breaking
 * - Comprehensive observability
 */

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import httpProxy from 'http-proxy-middleware';
import jwt from 'jsonwebtoken';
import Redis from 'ioredis';
import prometheus from 'prom-client';
import opentelemetry from '@opentelemetry/api';
import { v4 as uuidv4 } from 'uuid';
import consola from 'consola';
import { config } from './config/index.js';
import { CircuitBreaker } from './utils/circuit-breaker.js';
import { TenantResolver } from './middleware/tenant-resolver.js';
import { AuthenticationHandler } from './middleware/authentication.js';
import { AuthorizationHandler } from './middleware/authorization.js';
import { MetricsCollector } from './utils/metrics.js';
import { HealthChecker } from './utils/health-checker.js';

// Initialize application
const app = express();
const logger = consola.withTag('api-gateway');

// Initialize Redis for caching and session management
const redis = new Redis(config.redis.url, {
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  maxmemoryPolicy: 'allkeys-lru'
});

// Initialize metrics collection
const metricsCollector = new MetricsCollector();
const register = new prometheus.register();
prometheus.collectDefaultMetrics({ register });

// Custom metrics
const httpRequestDuration = new prometheus.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code', 'tenant_id', 'service'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]
});

const httpRequestsTotal = new prometheus.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code', 'tenant_id', 'service']
});

const activeConnections = new prometheus.Gauge({
  name: 'active_connections',
  help: 'Number of active connections',
  labelNames: ['tenant_id']
});

const rateLimitHits = new prometheus.Counter({
  name: 'rate_limit_hits_total',
  help: 'Total number of rate limit hits',
  labelNames: ['tenant_id', 'limit_type']
});

register.registerMetric(httpRequestDuration);
register.registerMetric(httpRequestsTotal);
register.registerMetric(activeConnections);
register.registerMetric(rateLimitHits);

// Initialize circuit breakers for backend services
const circuitBreakers = {
  templateProcessor: new CircuitBreaker('template-processor', {
    failureThreshold: 5,
    recoveryTimeout: 30000,
    monitoringPeriod: 60000
  }),
  knowledgeGraph: new CircuitBreaker('knowledge-graph', {
    failureThreshold: 3,
    recoveryTimeout: 45000,
    monitoringPeriod: 60000
  }),
  artifactGenerator: new CircuitBreaker('artifact-generator', {
    failureThreshold: 5,
    recoveryTimeout: 30000,
    monitoringPeriod: 60000
  }),
  tenantManager: new CircuitBreaker('tenant-manager', {
    failureThreshold: 2,
    recoveryTimeout: 60000,
    monitoringPeriod: 120000
  })
};

// Initialize tenant resolver
const tenantResolver = new TenantResolver(redis, {
  cacheTimeout: 300, // 5 minutes
  defaultTenant: 'default'
});

// Initialize authentication and authorization handlers
const authHandler = new AuthenticationHandler({
  jwtSecret: config.auth.jwtSecret,
  redis: redis,
  mtlsEnabled: config.security.mtls.enabled
});

const authzHandler = new AuthorizationHandler(redis, {
  rbacEnabled: config.security.rbac.enabled,
  permissionCacheTtl: 300
});

// Initialize health checker
const healthChecker = new HealthChecker({
  redis: redis,
  services: Object.keys(circuitBreakers)
});

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// CORS configuration with tenant awareness
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests from tenant-specific domains
    const allowedOrigins = [
      /^https:\/\/.*\.kgen\.io$/,
      /^https:\/\/kgen\.io$/,
      'http://localhost:3000' // Development only
    ];
    
    if (!origin || allowedOrigins.some(pattern => 
      typeof pattern === 'string' ? pattern === origin : pattern.test(origin)
    )) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type',
    'Authorization', 
    'X-Tenant-ID',
    'X-API-Key',
    'X-Request-ID',
    'X-Forwarded-For',
    'User-Agent'
  ]
}));

// Compression middleware
app.use(compression({
  level: 6,
  threshold: 1024,
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  }
}));

// Body parsing middleware
app.use(express.json({ 
  limit: config.api.maxPayloadSize || '10mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request ID middleware
app.use((req, res, next) => {
  req.id = req.headers['x-request-id'] || uuidv4();
  res.set('X-Request-ID', req.id);
  next();
});

// Request logging and metrics middleware
app.use((req, res, next) => {
  const startTime = this.getDeterministicTimestamp();
  
  logger.info({
    requestId: req.id,
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip
  }, 'Request started');
  
  res.on('finish', () => {
    const duration = (this.getDeterministicTimestamp() - startTime) / 1000;
    const tenantId = req.tenant?.id || 'unknown';
    const route = req.route?.path || req.url;
    
    httpRequestDuration
      .labels(req.method, route, res.statusCode, tenantId, 'api-gateway')
      .observe(duration);
      
    httpRequestsTotal
      .labels(req.method, route, res.statusCode, tenantId, 'api-gateway')
      .inc();
    
    logger.info({
      requestId: req.id,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}s`,
      tenantId: tenantId
    }, 'Request completed');
  });
  
  next();
});

// Tenant resolution middleware
app.use(tenantResolver.resolve.bind(tenantResolver));

// Rate limiting with tenant awareness
const createRateLimiter = (windowMs, max, keyGenerator, skipSuccessfulRequests = false) => {
  return rateLimit({
    windowMs,
    max: (req) => {
      const tenant = req.tenant;
      if (!tenant) return 10; // Conservative default
      
      // Apply tier-based limits
      const tierMultipliers = {
        'free': 1,
        'premium': 5,
        'enterprise': 20
      };
      
      return max * (tierMultipliers[tenant.tier] || 1);
    },
    keyGenerator: keyGenerator || ((req) => `${req.tenant?.id || 'unknown'}:${req.ip}`),
    skipSuccessfulRequests,
    handler: (req, res) => {
      const tenantId = req.tenant?.id || 'unknown';
      rateLimitHits.labels(tenantId, 'request_limit').inc();
      
      logger.warn({
        requestId: req.id,
        tenantId: tenantId,
        ip: req.ip,
        limit: 'request_rate'
      }, 'Rate limit exceeded');
      
      res.status(429).json({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: Math.ceil(windowMs / 1000)
      });
    },
    standardHeaders: true,
    legacyHeaders: false
  });
};

// Apply different rate limits for different endpoints
app.use('/api/v1/auth', createRateLimiter(15 * 60 * 1000, 5)); // 5 requests per 15 minutes for auth
app.use('/api/v1/templates', createRateLimiter(60 * 1000, 100)); // 100 requests per minute for templates
app.use('/api/v1/artifacts', createRateLimiter(60 * 1000, 50)); // 50 requests per minute for artifacts
app.use('/api/v1/graphs', createRateLimiter(60 * 1000, 30)); // 30 requests per minute for graphs
app.use('/', createRateLimiter(60 * 1000, 200)); // General rate limit

// Slow down middleware for additional DDoS protection
app.use(slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 100, // Allow first 100 requests per 15 minutes at full speed
  delayMs: 500, // Add 500ms delay to subsequent requests
  maxDelayMs: 20000, // Maximum delay of 20 seconds
  keyGenerator: (req) => `${req.tenant?.id || 'unknown'}:${req.ip}`
}));

// Authentication middleware (applied to all protected routes)
app.use('/api/v1', authHandler.authenticate.bind(authHandler));

// Authorization middleware (applied after authentication)
app.use('/api/v1', authzHandler.authorize.bind(authzHandler));

// Service routing configuration
const serviceRoutes = {
  '/api/v1/templates': {
    target: config.services.templateProcessor.url,
    circuitBreaker: circuitBreakers.templateProcessor,
    timeout: 30000
  },
  '/api/v1/graphs': {
    target: config.services.knowledgeGraph.url,
    circuitBreaker: circuitBreakers.knowledgeGraph,
    timeout: 60000
  },
  '/api/v1/artifacts': {
    target: config.services.artifactGenerator.url,
    circuitBreaker: circuitBreakers.artifactGenerator,
    timeout: 120000
  },
  '/api/v1/tenants': {
    target: config.services.tenantManager.url,
    circuitBreaker: circuitBreakers.tenantManager,
    timeout: 15000
  }
};

// Create proxy middleware for each service
Object.entries(serviceRoutes).forEach(([route, serviceConfig]) => {
  const { target, circuitBreaker, timeout } = serviceConfig;
  
  const proxyMiddleware = httpProxy.createProxyMiddleware({
    target,
    changeOrigin: true,
    timeout,
    proxyTimeout: timeout,
    
    // Add tenant context to upstream requests
    onProxyReq: (proxyReq, req, res) => {
      // Add tenant information to headers
      if (req.tenant) {
        proxyReq.setHeader('X-Tenant-ID', req.tenant.id);
        proxyReq.setHeader('X-Tenant-Tier', req.tenant.tier);
        proxyReq.setHeader('X-Tenant-Limits', JSON.stringify(req.tenant.limits));
      }
      
      // Add request context
      proxyReq.setHeader('X-Request-ID', req.id);
      proxyReq.setHeader('X-Gateway-Version', '1.0.0');
      
      // Add tracing headers
      const span = opentelemetry.trace.getActiveSpan();
      if (span) {
        const traceId = span.spanContext().traceId;
        const spanId = span.spanContext().spanId;
        proxyReq.setHeader('X-Trace-ID', traceId);
        proxyReq.setHeader('X-Span-ID', spanId);
      }
    },
    
    // Handle proxy responses
    onProxyRes: (proxyRes, req, res) => {
      // Add security headers
      proxyRes.headers['X-Content-Type-Options'] = 'nosniff';
      proxyRes.headers['X-Frame-Options'] = 'DENY';
      proxyRes.headers['X-XSS-Protection'] = '1; mode=block';
      
      // Remove sensitive headers
      delete proxyRes.headers['x-powered-by'];
      delete proxyRes.headers['server'];
    },
    
    // Handle proxy errors
    onError: (err, req, res) => {
      const tenantId = req.tenant?.id || 'unknown';
      
      logger.error({
        requestId: req.id,
        tenantId: tenantId,
        service: target,
        error: err.message
      }, 'Proxy error');
      
      // Record circuit breaker failure
      circuitBreaker.recordFailure();
      
      if (!res.headersSent) {
        res.status(502).json({
          error: 'Bad Gateway',
          message: 'Service temporarily unavailable',
          requestId: req.id
        });
      }
    }
  });
  
  // Wrap proxy with circuit breaker
  app.use(route, (req, res, next) => {
    circuitBreaker.call(() => {
      return new Promise((resolve, reject) => {
        proxyMiddleware(req, res, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }).catch((err) => {
      logger.error({
        requestId: req.id,
        tenantId: req.tenant?.id || 'unknown',
        service: target,
        error: err.message,
        circuitBreakerState: circuitBreaker.state
      }, 'Circuit breaker triggered');
      
      if (!res.headersSent) {
        res.status(503).json({
          error: 'Service Unavailable',
          message: 'Service is temporarily down. Please try again later.',
          requestId: req.id,
          retryAfter: 30
        });
      }
    });
  });
});

// Health check endpoints
app.get('/health', async (req, res) => {
  try {
    const health = await healthChecker.check();
    const statusCode = health.status === 'healthy' ? 200 : 503;
    
    res.status(statusCode).json({
      status: health.status,
      timestamp: this.getDeterministicDate().toISOString(),
      version: '1.0.0',
      checks: health.checks
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Health check failed');
    res.status(503).json({
      status: 'unhealthy',
      error: 'Health check failed',
      timestamp: this.getDeterministicDate().toISOString()
    });
  }
});

app.get('/health/ready', async (req, res) => {
  try {
    const ready = await healthChecker.readinessCheck();
    res.status(ready ? 200 : 503).json({
      ready,
      timestamp: this.getDeterministicDate().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      ready: false,
      error: error.message,
      timestamp: this.getDeterministicDate().toISOString()
    });
  }
});

app.get('/health/live', (req, res) => {
  res.status(200).json({
    alive: true,
    timestamp: this.getDeterministicDate().toISOString()
  });
});

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.send(await register.metrics());
});

// Circuit breaker status endpoint
app.get('/circuit-breakers', (req, res) => {
  const status = Object.entries(circuitBreakers).reduce((acc, [name, cb]) => {
    acc[name] = {
      state: cb.state,
      failureCount: cb.failureCount,
      nextAttempt: cb.nextAttempt,
      lastFailureTime: cb.lastFailureTime
    };
    return acc;
  }, {});
  
  res.json(status);
});

// Error handling middleware
app.use((err, req, res, next) => {
  const tenantId = req.tenant?.id || 'unknown';
  
  logger.error({
    requestId: req.id,
    tenantId: tenantId,
    error: err.message,
    stack: err.stack
  }, 'Unhandled error');
  
  if (!res.headersSent) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An unexpected error occurred',
      requestId: req.id
    });
  }
});

// 404 handler
app.use((req, res) => {
  logger.warn({
    requestId: req.id,
    method: req.method,
    url: req.url,
    ip: req.ip
  }, 'Not found');
  
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested resource was not found',
    requestId: req.id
  });
});

// Graceful shutdown handling
const server = app.listen(config.port, config.host, () => {
  logger.info(`KGEN API Gateway listening on ${config.host}:${config.port}`);
  logger.info(`Environment: ${process.env.NODE_ENV}`);
  logger.info(`Multi-tenancy: ${config.multiTenancy.enabled ? 'enabled' : 'disabled'}`);
  logger.info(`Circuit breakers: ${Object.keys(circuitBreakers).length} services`);
});

const shutdown = async (signal) => {
  logger.info(`Received ${signal}, starting graceful shutdown`);
  
  // Stop accepting new requests
  server.close(async () => {
    logger.info('HTTP server closed');
    
    try {
      // Close Redis connection
      await redis.disconnect();
      logger.info('Redis connection closed');
      
      // Close other resources
      await Promise.all(
        Object.values(circuitBreakers).map(cb => cb.destroy())
      );
      
      logger.info('Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      logger.error({ error: error.message }, 'Error during shutdown');
      process.exit(1);
    }
  });
  
  // Force close after timeout
  setTimeout(() => {
    logger.error('Forceful shutdown after timeout');
    process.exit(1);
  }, 30000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default app;