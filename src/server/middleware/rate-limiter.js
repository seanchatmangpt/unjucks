import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { dbManager } from '../config/database.js';
import { env } from '../config/environment.js';
import { auditLogger } from '../services/audit-logger.js';

/**
 * @typedef {Object} RateLimitConfig
 * @property {number} windowMs
 * @property {number} max
 * @property {string} [message]
 * @property {boolean} [standardHeaders]
 * @property {boolean} [legacyHeaders]
 * @property {boolean} [skipSuccessfulRequests]
 * @property {boolean} [skipFailedRequests]
 * @property {function(import('express').Request): string} [keyGenerator]
 * @property {function(import('express').Request): boolean} [skip]
 * @property {function(import('express').Request, import('express').Response): void} [onLimitReached]
 */

/**
 * @typedef {Object} QuotaConfig
 * @property {number} apiCallsPerHour
 * @property {number} requestsPerMinute
 * @property {number} concurrentRequests
 * @property {number} uploadSizeMB
 * @property {number} downloadSizeMB
 */

class EnterpriseRateLimiter {
  constructor() {
    this.redisStore = new RedisStore({
      sendCommand: (...args) => dbManager.redis.sendCommand(args),
    });
    /** @type {Map<string, QuotaConfig>} */
    this.quotaCache = new Map();
    /** @type {Map<string, Set<string>>} */
    this.activeRequests = new Map(); // tenantId -> Set<requestId>
  }

  /**
   * Create basic rate limiting middleware
   * @param {RateLimitConfig} config - Rate limit configuration
   * @returns {import('express').RequestHandler}
   */
  createBasicLimiter(config) {
    return rateLimit({
      store: this.redisStore,
      windowMs: config.windowMs,
      max: config.max,
      message: config.message || 'Too many requests from this IP',
      standardHeaders: config.standardHeaders !== false,
      legacyHeaders: config.legacyHeaders !== false,
      skipSuccessfulRequests: config.skipSuccessfulRequests || false,
      skipFailedRequests: config.skipFailedRequests || false,
      keyGenerator: config.keyGenerator || this.defaultKeyGenerator,
      skip: config.skip || (() => false),
      onLimitReached: config.onLimitReached || this.defaultOnLimitReached,
    });
  }

  /**
   * Create tenant-aware rate limiting middleware
   * @param {RateLimitConfig} defaultConfig - Default configuration
   * @returns {import('express').RequestHandler}
   */
  createTenantLimiter(defaultConfig) {
    return async (req, res, next) => {
      if (!req.tenant) {
        return next();
      }

      const tenantId = req.tenant.tenantId;
      const quotas = req.tenant.quotas;
      
      try {
        // Check API quota
        const currentHourKey = `api_calls:${tenantId}:${this.getCurrentHour()}`;
        const currentApiCalls = await dbManager.redis.get(currentHourKey);
        
        if (currentApiCalls && parseInt(currentApiCalls) >= quotas.apiCallsPerHour) {
          await this.handleQuotaExceeded(req, res, 'api_calls_per_hour', quotas.apiCallsPerHour);
          return;
        }

        // Check concurrent request limits
        const activeRequestsForTenant = this.activeRequests.get(tenantId) || new Set();
        const maxConcurrent = this.getConcurrentLimit(req.user?.roles || []);
        
        if (activeRequestsForTenant.size >= maxConcurrent) {
          await this.handleQuotaExceeded(req, res, 'concurrent_requests', maxConcurrent);
          return;
        }

        // Track this request
        const requestId = this.generateRequestId();
        activeRequestsForTenant.add(requestId);
        this.activeRequests.set(tenantId, activeRequestsForTenant);

        // Increment counters
        await Promise.all([
          dbManager.redis.incr(currentHourKey),
          dbManager.redis.expire(currentHourKey, 3600), // 1 hour
        ]);

        // Cleanup on response finish
        const cleanup = () => {
          const requests = this.activeRequests.get(tenantId);
          if (requests) {
            requests.delete(requestId);
            if (requests.size === 0) {
              this.activeRequests.delete(tenantId);
            }
          }
        };

        res.on('finish', cleanup);
        res.on('close', cleanup);

        // Add quota headers
        res.set({
          'X-RateLimit-Tenant': tenantId,
          'X-RateLimit-API-Limit': quotas.apiCallsPerHour.toString(),
          'X-RateLimit-API-Remaining': Math.max(0, quotas.apiCallsPerHour - (parseInt(currentApiCalls || '0') + 1)).toString(),
          'X-RateLimit-Concurrent-Limit': maxConcurrent.toString(),
          'X-RateLimit-Concurrent-Active': activeRequestsForTenant.size.toString(),
        });

        next();
      } catch (error) {
        console.error('Tenant rate limiting error:', error);
        next();
      }
    };
  }

  /**
   * Create role-based rate limiting middleware
   * @param {Object<string, RateLimitConfig>} roleLimits - Role-based limits
   * @returns {import('express').RequestHandler}
   */
  createRoleLimiter(roleLimits) {
    return (req, res, next) => {
      if (!req.user) {
        return next();
      }

      const userRoles = req.user.roles;
      let config = roleLimits.default || roleLimits.user;

      // Find the most permissive role
      for (const role of userRoles) {
        const roleConfig = roleLimits[role];
        if (roleConfig && roleConfig.max > config.max) {
          config = roleConfig;
        }
      }

      const limiter = this.createBasicLimiter({
        ...config,
        keyGenerator: (req) => `role:${req.user.id}`,
      });

      limiter(req, res, next);
    };
  }

  /**
   * Create API endpoint specific limiting
   * @param {string} endpoint - Endpoint name
   * @param {RateLimitConfig} config - Rate limit configuration
   * @returns {import('express').RequestHandler}
   */
  createEndpointLimiter(endpoint, config) {
    return this.createBasicLimiter({
      ...config,
      keyGenerator: (req) => {
        const base = req.tenant ? `tenant:${req.tenant.tenantId}` : this.defaultKeyGenerator(req);
        return `endpoint:${endpoint}:${base}`;
      },
    });
  }

  /**
   * Create GraphQL operation limiting
   * @param {Object<string, RateLimitConfig>} operationLimits - Operation-based limits
   * @returns {import('express').RequestHandler}
   */
  createGraphQLLimiter(operationLimits) {
    return async (req, res, next) => {
      if (req.method !== 'POST' || !req.body?.query) {
        return next();
      }

      try {
        const query = req.body.query;
        const operationType = this.extractGraphQLOperation(query);
        
        if (!operationType) {
          return next();
        }

        const config = operationLimits[operationType] || operationLimits.default;
        if (!config) {
          return next();
        }

        const limiter = this.createBasicLimiter({
          ...config,
          keyGenerator: (req) => {
            const base = req.user ? `user:${req.user.id}` : this.defaultKeyGenerator(req);
            return `graphql:${operationType}:${base}`;
          },
        });

        limiter(req, res, next);
      } catch (error) {
        console.error('GraphQL rate limiting error:', error);
        next();
      }
    };
  }

  /**
   * Create upload size limiting middleware
   * @returns {import('express').RequestHandler}
   */
  createUploadLimiter() {
    return async (req, res, next) => {
      if (!req.tenant) {
        return next();
      }

      const contentLength = parseInt(req.get('content-length') || '0');
      const maxUploadSize = this.getUploadLimit(req.user?.roles || []) * 1024 * 1024; // Convert MB to bytes

      if (contentLength > maxUploadSize) {
        await this.handleQuotaExceeded(req, res, 'upload_size', maxUploadSize);
        return;
      }

      next();
    };
  }

  /**
   * Create burst limiting for expensive operations
   * @param {Object} burstConfig - Burst configuration
   * @param {number} burstConfig.burstSize - Token bucket size
   * @param {number} burstConfig.refillRate - Tokens per second
   * @param {function(import('express').Request): number} [burstConfig.costFunction] - Cost calculation function
   * @returns {import('express').RequestHandler}
   */
  createBurstLimiter(burstConfig) {
    return async (req, res, next) => {
      const key = req.user ? `user:${req.user.id}` : this.defaultKeyGenerator(req);
      const bucketKey = `burst:${key}`;
      const cost = burstConfig.costFunction ? burstConfig.costFunction(req) : 1;

      try {
        const bucket = await this.getTokenBucket(bucketKey, burstConfig);
        
        if (bucket.tokens < cost) {
          res.status(429).json({
            error: 'BURST_LIMIT_EXCEEDED',
            message: 'Too many expensive operations',
            retryAfter: Math.ceil((cost - bucket.tokens) / burstConfig.refillRate),
            code: 'E_BURST_429',
          });
          return;
        }

        // Consume tokens
        await this.consumeTokens(bucketKey, cost, burstConfig);
        
        res.set({
          'X-RateLimit-Burst-Remaining': Math.max(0, bucket.tokens - cost).toString(),
          'X-RateLimit-Burst-Capacity': burstConfig.burstSize.toString(),
        });

        next();
      } catch (error) {
        console.error('Burst limiting error:', error);
        next();
      }
    };
  }

  // Helper methods
  /**
   * Default key generator for rate limiting
   * @param {import('express').Request} req - Express request
   * @returns {string} Rate limit key
   */
  defaultKeyGenerator(req) {
    return req.ip || req.connection.remoteAddress || 'unknown';
  }

  /**
   * Default handler when rate limit is reached
   * @param {import('express').Request} req - Express request
   * @param {import('express').Response} res - Express response
   */
  async defaultOnLimitReached(req, res) {
    if (req.user && req.tenant) {
      await auditLogger.logSecurityEvent(
        req.tenant.tenantId,
        req.user.id,
        req,
        'rate_limit_exceeded',
        {
          endpoint: req.originalUrl,
          method: req.method,
          userAgent: req.get('User-Agent'),
        },
        'medium'
      );
    }
  }

  /**
   * Handle quota exceeded scenarios
   * @param {import('express').Request} req - Express request
   * @param {import('express').Response} res - Express response
   * @param {string} quotaType - Type of quota exceeded
   * @param {number} limit - Quota limit
   */
  async handleQuotaExceeded(req, res, quotaType, limit) {
    const retryAfter = this.getRetryAfter(quotaType);
    
    res.status(429).json({
      error: 'QUOTA_EXCEEDED',
      message: `${quotaType} quota exceeded`,
      limit,
      retryAfter,
      code: 'E_QUOTA_429',
    });

    // Log quota exceeded event
    if (req.user && req.tenant) {
      await auditLogger.logSecurityEvent(
        req.tenant.tenantId,
        req.user.id,
        req,
        'quota_exceeded',
        {
          quotaType,
          limit,
          endpoint: req.originalUrl,
        },
        'high'
      );
    }
  }

  /**
   * Get concurrent request limit based on user roles
   * @param {string[]} roles - User roles
   * @returns {number} Concurrent limit
   */
  getConcurrentLimit(roles) {
    if (roles.includes('admin')) return 50;
    if (roles.includes('premium')) return 20;
    return 10; // default
  }

  /**
   * Get upload limit based on user roles
   * @param {string[]} roles - User roles
   * @returns {number} Upload limit in MB
   */
  getUploadLimit(roles) {
    if (roles.includes('admin')) return 100; // 100MB
    if (roles.includes('premium')) return 50;  // 50MB
    return 10; // 10MB
  }

  /**
   * Get current hour as string
   * @returns {string} Current hour in format YYYY-MM-DDTHH
   */
  getCurrentHour() {
    return new Date().toISOString().substr(0, 13); // YYYY-MM-DDTHH
  }

  /**
   * Generate unique request ID
   * @returns {string} Request ID
   */
  generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get retry after time based on quota type
   * @param {string} quotaType - Type of quota
   * @returns {number} Retry after time in seconds
   */
  getRetryAfter(quotaType) {
    switch (quotaType) {
      case 'api_calls_per_hour':
        return 3600; // 1 hour
      case 'concurrent_requests':
        return 60; // 1 minute
      case 'upload_size':
        return 300; // 5 minutes
      default:
        return 900; // 15 minutes
    }
  }

  /**
   * Extract GraphQL operation from query string
   * @param {string} query - GraphQL query
   * @returns {string|null} Operation name or type
   */
  extractGraphQLOperation(query) {
    const operationMatch = query.match(/^\s*(query|mutation|subscription)\s+(\w+)?/i);
    if (operationMatch) {
      return operationMatch[2] || operationMatch[1].toLowerCase();
    }
    return null;
  }

  /**
   * Get token bucket state
   * @param {string} bucketKey - Redis key for bucket
   * @param {Object} config - Burst configuration
   * @returns {Promise<{tokens: number, lastRefill: number}>} Bucket state
   */
  async getTokenBucket(bucketKey, config) {
    const bucketData = await dbManager.redis.hmget(bucketKey, 'tokens', 'lastRefill');
    const now = Date.now();
    
    let tokens = parseFloat(bucketData[0] || config.burstSize.toString());
    const lastRefill = parseInt(bucketData[1] || now.toString());

    // Refill tokens based on time passed
    const timePassed = (now - lastRefill) / 1000; // seconds
    const tokensToAdd = timePassed * config.refillRate;
    tokens = Math.min(config.burstSize, tokens + tokensToAdd);

    return { tokens, lastRefill: now };
  }

  /**
   * Consume tokens from bucket
   * @param {string} bucketKey - Redis key for bucket
   * @param {number} cost - Number of tokens to consume
   * @param {Object} config - Burst configuration
   */
  async consumeTokens(bucketKey, cost, config) {
    const bucket = await this.getTokenBucket(bucketKey, config);
    const newTokens = bucket.tokens - cost;

    await dbManager.redis.hmset(bucketKey, {
      tokens: newTokens.toString(),
      lastRefill: bucket.lastRefill.toString(),
    });
    
    await dbManager.redis.expire(bucketKey, 3600); // Expire in 1 hour
  }

  /**
   * Cleanup method for graceful shutdown
   */
  cleanup() {
    this.activeRequests.clear();
    this.quotaCache.clear();
  }
}

// Pre-configured limiters
export const rateLimiter = new EnterpriseRateLimiter();

// Standard API limiter
export const apiLimiter = rateLimiter.createBasicLimiter({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  skipSuccessfulRequests: env.RATE_LIMIT_SKIP_SUCCESS,
});

// Tenant-aware limiter
export const tenantLimiter = rateLimiter.createTenantLimiter({
  windowMs: 60000, // 1 minute
  max: 100, // fallback limit
});

// Authentication limiter
export const authLimiter = rateLimiter.createBasicLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 login attempts per 15 minutes
  skipSuccessfulRequests: true,
  message: 'Too many authentication attempts, please try again later',
  keyGenerator: (req) => `auth:${req.ip}:${req.body?.email || 'unknown'}`,
});

// GraphQL limiter
export const graphqlLimiter = rateLimiter.createGraphQLLimiter({
  default: { windowMs: 60000, max: 100 },
  createTemplate: { windowMs: 3600000, max: 10 }, // 10 per hour
  createProject: { windowMs: 3600000, max: 5 },   // 5 per hour
  generate: { windowMs: 60000, max: 20 },         // 20 per minute
});

// Upload limiter
export const uploadLimiter = rateLimiter.createUploadLimiter();

// Burst limiter for expensive operations
export const burstLimiter = rateLimiter.createBurstLimiter({
  burstSize: 10,
  refillRate: 0.1, // 1 token per 10 seconds
  costFunction: (req) => {
    if (req.originalUrl.includes('/generate')) return 5;
    if (req.originalUrl.includes('/upload')) return 3;
    return 1;
  },
});

export { EnterpriseRateLimiter };