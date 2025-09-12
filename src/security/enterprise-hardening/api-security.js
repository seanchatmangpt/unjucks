/**
 * API Security & Rate Limiting
 * Enterprise-grade API protection with intelligent rate limiting and threat detection
 */

import { EventEmitter } from 'events';
import consola from 'consola';
import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';

class APISecurityManager extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      // Rate Limiting Configuration
      rateLimiting: {
        enabled: true,
        defaultRpm: 100, // Requests per minute
        burstLimit: 20, // Burst capacity
        windowMs: 60000, // 1 minute window
        keyGenerator: 'ip', // 'ip', 'user', 'api-key'
        skipSuccessfulRequests: false,
        skipFailedRequests: false
      },
      
      // Tier-based Limits
      tierLimits: {
        free: { rpm: 60, burst: 10, concurrent: 5 },
        basic: { rpm: 300, burst: 30, concurrent: 20 },
        premium: { rpm: 1000, burst: 100, concurrent: 50 },
        enterprise: { rpm: 5000, burst: 500, concurrent: 200 }
      },
      
      // Endpoint-specific Limits
      endpointLimits: {
        '/api/auth/login': { rpm: 10, burst: 3 },
        '/api/auth/register': { rpm: 5, burst: 2 },
        '/api/data/bulk': { rpm: 20, burst: 5 },
        '/api/admin/*': { rpm: 200, burst: 20 }
      },
      
      // Throttling Configuration
      throttling: {
        enabled: true,
        algorithm: 'sliding-window', // 'fixed-window', 'sliding-window', 'token-bucket'
        backoffStrategy: 'exponential', // 'linear', 'exponential', 'fibonacci'
        maxBackoffMs: 300000, // 5 minutes
        throttleHeaders: true
      },
      
      // API Key Management
      apiKeys: {
        enabled: true,
        requireApiKey: false, // For public APIs
        keyFormats: ['header', 'query', 'bearer'],
        headerName: 'X-API-Key',
        queryParam: 'api_key',
        keyLength: 32,
        keyPrefix: 'kgen_',
        rotationDays: 90
      },
      
      // Request Validation
      validation: {
        maxRequestSize: 10 * 1024 * 1024, // 10MB
        allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
        allowedContentTypes: [
          'application/json',
          'application/xml',
          'text/plain',
          'multipart/form-data'
        ],
        maxHeaderSize: 8192,
        maxUrlLength: 2048
      },
      
      // Security Headers
      securityHeaders: {
        enabled: true,
        headers: {
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'DENY',
          'X-XSS-Protection': '1; mode=block',
          'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
          'Content-Security-Policy': "default-src 'self'",
          'Referrer-Policy': 'strict-origin-when-cross-origin'
        }
      },
      
      // CORS Configuration
      cors: {
        enabled: true,
        origins: ['https://app.kgen.dev'],
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
        credentials: true,
        maxAge: 86400 // 24 hours
      },
      
      // IP Filtering
      ipFiltering: {
        enabled: false,
        whitelist: [],
        blacklist: [],
        autoBlockEnabled: true,
        autoBlockThreshold: 100, // Requests per minute
        autoBlockDuration: 3600000 // 1 hour
      },
      
      // Monitoring & Alerting
      monitoring: {
        enabled: true,
        metricsInterval: 60000, // 1 minute
        alertThresholds: {
          errorRate: 0.05, // 5%
          responseTime: 5000, // 5 seconds
          rateLimit: 0.8 // 80% of limit
        }
      },
      
      ...config
    };
    
    this.logger = consola.withTag('api-security');
    this.state = 'initialized';
    
    // Rate Limiting State
    this.rateLimitStore = new Map();
    this.slidingWindows = new Map();
    this.tokenBuckets = new Map();
    
    // API Key Management
    this.apiKeys = new Map();
    this.keyMetrics = new Map();
    
    // Security State
    this.blockedIPs = new Set();
    this.suspiciousRequests = new Map();
    this.requestMetrics = new Map();
    
    // Monitoring
    this.metrics = {
      totalRequests: 0,
      blockedRequests: 0,
      rateLimitedRequests: 0,
      errorRequests: 0,
      avgResponseTime: 0,
      apiKeyRequests: 0,
      ipBlockedRequests: 0
    };
  }
  
  /**
   * Initialize API security system
   */
  async initialize() {
    try {
      this.logger.info('🔐 Initializing API Security Manager...');
      
      // Load existing API keys
      await this._loadAPIKeys();
      
      // Load IP filtering rules
      await this._loadIPFilteringRules();
      
      // Start monitoring and cleanup processes
      this._startMonitoring();
      
      this.state = 'ready';
      this.logger.success('✅ API Security Manager initialized');
      
      return { 
        status: 'ready', 
        apiKeys: this.apiKeys.size,
        blockedIPs: this.blockedIPs.size
      };
      
    } catch (error) {
      this.state = 'error';
      this.logger.error('❌ Failed to initialize API Security Manager:', error);
      throw error;
    }
  }
  
  /**
   * Apply rate limiting middleware
   */
  rateLimitMiddleware() {
    return async (req, res, next) => {
      try {
        const rateLimitResult = await this.checkRateLimit(req);
        
        if (rateLimitResult.blocked) {
          this.metrics.rateLimitedRequests++;
          
          // Add rate limit headers
          if (this.config.throttling.throttleHeaders) {
            res.set({
              'X-RateLimit-Limit': rateLimitResult.limit,
              'X-RateLimit-Remaining': rateLimitResult.remaining,
              'X-RateLimit-Reset': rateLimitResult.resetTime,
              'Retry-After': Math.ceil(rateLimitResult.retryAfter / 1000)
            });
          }
          
          return res.status(429).json({
            error: 'Too Many Requests',
            message: 'Rate limit exceeded',
            retryAfter: rateLimitResult.retryAfter
          });
        }
        
        // Add rate limit info to headers
        if (this.config.throttling.throttleHeaders) {
          res.set({
            'X-RateLimit-Limit': rateLimitResult.limit,
            'X-RateLimit-Remaining': rateLimitResult.remaining,
            'X-RateLimit-Reset': rateLimitResult.resetTime
          });
        }
        
        next();
        
      } catch (error) {
        this.logger.error('Rate limiting middleware error:', error);
        next(error);
      }
    };
  }
  
  /**
   * Apply security headers middleware
   */
  securityHeadersMiddleware() {
    return (req, res, next) => {
      if (this.config.securityHeaders.enabled) {
        res.set(this.config.securityHeaders.headers);
      }
      next();
    };
  }
  
  /**
   * Apply CORS middleware
   */
  corsMiddleware() {
    return (req, res, next) => {
      if (!this.config.cors.enabled) {
        return next();
      }
      
      const origin = req.headers.origin;
      const isOriginAllowed = this.config.cors.origins.includes('*') ||
                             this.config.cors.origins.includes(origin);
      
      if (isOriginAllowed) {
        res.set('Access-Control-Allow-Origin', origin);
      }
      
      res.set({
        'Access-Control-Allow-Methods': this.config.cors.methods.join(', '),
        'Access-Control-Allow-Headers': this.config.cors.allowedHeaders.join(', '),
        'Access-Control-Allow-Credentials': this.config.cors.credentials,
        'Access-Control-Max-Age': this.config.cors.maxAge
      });
      
      if (req.method === 'OPTIONS') {
        return res.status(200).end();
      }
      
      next();
    };
  }
  
  /**
   * Apply API key validation middleware
   */
  apiKeyMiddleware(required = false) {
    return async (req, res, next) => {
      try {
        if (!this.config.apiKeys.enabled) {
          return next();
        }
        
        const apiKey = this._extractAPIKey(req);
        
        if (!apiKey) {
          if (required || this.config.apiKeys.requireApiKey) {
            return res.status(401).json({
              error: 'Unauthorized',
              message: 'API key required'
            });
          }
          return next();
        }
        
        const keyInfo = await this.validateAPIKey(apiKey);
        
        if (!keyInfo.valid) {
          return res.status(401).json({
            error: 'Unauthorized',
            message: 'Invalid API key'
          });
        }
        
        // Attach key info to request
        req.apiKey = keyInfo;
        
        // Update key metrics
        this._updateKeyMetrics(apiKey);
        this.metrics.apiKeyRequests++;
        
        next();
        
      } catch (error) {
        this.logger.error('API key middleware error:', error);
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'API key validation failed'
        });
      }
    };
  }
  
  /**
   * Apply request validation middleware
   */
  requestValidationMiddleware() {
    return (req, res, next) => {
      try {
        // Validate HTTP method
        if (!this.config.validation.allowedMethods.includes(req.method)) {
          return res.status(405).json({
            error: 'Method Not Allowed',
            message: `Method ${req.method} is not allowed`
          });
        }
        
        // Validate content type
        const contentType = req.headers['content-type'];
        if (contentType && !this._isContentTypeAllowed(contentType)) {
          return res.status(415).json({
            error: 'Unsupported Media Type',
            message: 'Content type not allowed'
          });
        }
        
        // Validate request size
        const contentLength = parseInt(req.headers['content-length'] || '0');
        if (contentLength > this.config.validation.maxRequestSize) {
          return res.status(413).json({
            error: 'Payload Too Large',
            message: 'Request size exceeds maximum allowed'
          });
        }
        
        // Validate URL length
        if (req.url.length > this.config.validation.maxUrlLength) {
          return res.status(414).json({
            error: 'URI Too Long',
            message: 'URL exceeds maximum allowed length'
          });
        }
        
        next();
        
      } catch (error) {
        this.logger.error('Request validation middleware error:', error);
        next(error);
      }
    };
  }
  
  /**
   * Apply IP filtering middleware
   */
  ipFilteringMiddleware() {
    return (req, res, next) => {
      try {
        const clientIP = this._getClientIP(req);
        
        // Check blocked IPs
        if (this.blockedIPs.has(clientIP)) {
          this.metrics.ipBlockedRequests++;
          
          return res.status(403).json({
            error: 'Forbidden',
            message: 'IP address is blocked'
          });
        }
        
        // Check whitelist (if configured)
        if (this.config.ipFiltering.whitelist.length > 0 &&
            !this.config.ipFiltering.whitelist.includes(clientIP)) {
          return res.status(403).json({
            error: 'Forbidden',
            message: 'IP address not whitelisted'
          });
        }
        
        // Check blacklist
        if (this.config.ipFiltering.blacklist.includes(clientIP)) {
          return res.status(403).json({
            error: 'Forbidden',
            message: 'IP address is blacklisted'
          });
        }
        
        // Auto-blocking check
        if (this.config.ipFiltering.autoBlockEnabled) {
          this._checkAutoBlock(clientIP);
        }
        
        next();
        
      } catch (error) {
        this.logger.error('IP filtering middleware error:', error);
        next(error);
      }
    };
  }
  
  /**
   * Check rate limit for request
   */
  async checkRateLimit(req) {
    try {
      const key = this._generateRateLimitKey(req);
      const limits = this._getRateLimits(req);
      
      switch (this.config.throttling.algorithm) {
        case 'sliding-window':
          return this._checkSlidingWindow(key, limits);
        case 'token-bucket':
          return this._checkTokenBucket(key, limits);
        case 'fixed-window':
        default:
          return this._checkFixedWindow(key, limits);
      }
      
    } catch (error) {
      this.logger.error('Rate limit check error:', error);
      return { blocked: false, limit: 0, remaining: 0, resetTime: this.getDeterministicTimestamp() };
    }
  }
  
  /**
   * Create new API key
   */
  async createAPIKey(userId, tier = 'free', metadata = {}) {
    try {
      const keyId = this._generateKeyId();
      const apiKey = `${this.config.apiKeys.keyPrefix}${keyId}`;
      
      const keyData = {
        keyId,
        apiKey,
        userId,
        tier,
        metadata,
        createdAt: this.getDeterministicDate(),
        expiresAt: new Date(this.getDeterministicTimestamp() + (this.config.apiKeys.rotationDays * 24 * 60 * 60 * 1000)),
        lastUsed: null,
        usageCount: 0,
        active: true
      };
      
      this.apiKeys.set(apiKey, keyData);
      this.keyMetrics.set(apiKey, {
        requests: 0,
        errors: 0,
        lastRequest: null
      });
      
      await this._saveAPIKeys();
      
      this.emit('api-key:created', { userId, keyId, tier });
      
      return {
        apiKey,
        keyId,
        tier,
        expiresAt: keyData.expiresAt
      };
      
    } catch (error) {
      this.logger.error('Failed to create API key:', error);
      throw error;
    }
  }
  
  /**
   * Validate API key
   */
  async validateAPIKey(apiKey) {
    try {
      const keyData = this.apiKeys.get(apiKey);
      
      if (!keyData) {
        return { valid: false, reason: 'Key not found' };
      }
      
      if (!keyData.active) {
        return { valid: false, reason: 'Key deactivated' };
      }
      
      if (this.getDeterministicTimestamp() > keyData.expiresAt.getTime()) {
        return { valid: false, reason: 'Key expired' };
      }
      
      // Update usage stats
      keyData.lastUsed = this.getDeterministicDate();
      keyData.usageCount++;
      
      return {
        valid: true,
        keyData,
        tier: keyData.tier,
        userId: keyData.userId,
        limits: this.config.tierLimits[keyData.tier] || this.config.tierLimits.free
      };
      
    } catch (error) {
      this.logger.error('API key validation error:', error);
      return { valid: false, reason: 'Validation error' };
    }
  }
  
  /**
   * Revoke API key
   */
  async revokeAPIKey(apiKey) {
    try {
      const keyData = this.apiKeys.get(apiKey);
      
      if (!keyData) {
        throw new Error('API key not found');
      }
      
      keyData.active = false;
      keyData.revokedAt = this.getDeterministicDate();
      
      await this._saveAPIKeys();
      
      this.emit('api-key:revoked', { 
        keyId: keyData.keyId, 
        userId: keyData.userId 
      });
      
      return { success: true, revokedAt: keyData.revokedAt };
      
    } catch (error) {
      this.logger.error('Failed to revoke API key:', error);
      throw error;
    }
  }
  
  /**
   * Block IP address
   */
  blockIP(ipAddress, duration = null) {
    try {
      this.blockedIPs.add(ipAddress);
      
      if (duration) {
        setTimeout(() => {
          this.blockedIPs.delete(ipAddress);
          this.logger.info(`IP ${ipAddress} unblocked after timeout`);
        }, duration);
      }
      
      this.emit('ip:blocked', { ipAddress, duration });
      this.logger.warn(`IP address blocked: ${ipAddress}`);
      
    } catch (error) {
      this.logger.error('Failed to block IP:', error);
    }
  }
  
  /**
   * Unblock IP address
   */
  unblockIP(ipAddress) {
    try {
      const wasBlocked = this.blockedIPs.delete(ipAddress);
      
      if (wasBlocked) {
        this.emit('ip:unblocked', { ipAddress });
        this.logger.info(`IP address unblocked: ${ipAddress}`);
      }
      
      return wasBlocked;
      
    } catch (error) {
      this.logger.error('Failed to unblock IP:', error);
      return false;
    }
  }
  
  /**
   * Get security metrics
   */
  getMetrics() {
    const rateLimitMetrics = {
      totalKeys: this.rateLimitStore.size,
      activeWindows: this.slidingWindows.size,
      tokenBuckets: this.tokenBuckets.size
    };
    
    const apiKeyMetrics = {
      totalKeys: this.apiKeys.size,
      activeKeys: Array.from(this.apiKeys.values()).filter(k => k.active).length,
      expiredKeys: Array.from(this.apiKeys.values()).filter(k => 
        this.getDeterministicTimestamp() > k.expiresAt.getTime()).length
    };
    
    return {
      ...this.metrics,
      rateLimiting: rateLimitMetrics,
      apiKeys: apiKeyMetrics,
      blockedIPs: this.blockedIPs.size,
      suspiciousRequests: this.suspiciousRequests.size
    };
  }
  
  /**
   * Get security status
   */
  getStatus() {
    return {
      state: this.state,
      configuration: {
        rateLimitingEnabled: this.config.rateLimiting.enabled,
        apiKeysEnabled: this.config.apiKeys.enabled,
        ipFilteringEnabled: this.config.ipFiltering.enabled,
        corsEnabled: this.config.cors.enabled
      },
      metrics: this.getMetrics()
    };
  }
  
  // Private methods
  
  _generateRateLimitKey(req) {
    switch (this.config.rateLimiting.keyGenerator) {
      case 'user':
        return req.user?.id || req.apiKey?.userId || this._getClientIP(req);
      case 'api-key':
        return req.apiKey?.keyId || this._getClientIP(req);
      case 'ip':
      default:
        return this._getClientIP(req);
    }
  }
  
  _getRateLimits(req) {
    // Check endpoint-specific limits first
    const endpoint = req.path || req.url;
    for (const [pattern, limits] of Object.entries(this.config.endpointLimits)) {
      if (this._matchEndpoint(endpoint, pattern)) {
        return limits;
      }
    }
    
    // Check tier-based limits
    if (req.apiKey?.tier) {
      return this.config.tierLimits[req.apiKey.tier] || this.config.tierLimits.free;
    }
    
    // Default limits
    return {
      rpm: this.config.rateLimiting.defaultRpm,
      burst: this.config.rateLimiting.burstLimit
    };
  }
  
  _checkFixedWindow(key, limits) {
    const now = this.getDeterministicTimestamp();
    const windowStart = Math.floor(now / this.config.rateLimiting.windowMs) * this.config.rateLimiting.windowMs;
    const windowKey = `${key}:${windowStart}`;
    
    const current = this.rateLimitStore.get(windowKey) || 0;
    const remaining = Math.max(0, limits.rpm - current - 1);
    
    if (current >= limits.rpm) {
      return {
        blocked: true,
        limit: limits.rpm,
        remaining: 0,
        resetTime: windowStart + this.config.rateLimiting.windowMs,
        retryAfter: windowStart + this.config.rateLimiting.windowMs - now
      };
    }
    
    this.rateLimitStore.set(windowKey, current + 1);
    
    // Set expiration for cleanup
    setTimeout(() => {
      this.rateLimitStore.delete(windowKey);
    }, this.config.rateLimiting.windowMs * 2);
    
    return {
      blocked: false,
      limit: limits.rpm,
      remaining,
      resetTime: windowStart + this.config.rateLimiting.windowMs
    };
  }
  
  _checkSlidingWindow(key, limits) {
    const now = this.getDeterministicTimestamp();
    const window = this.slidingWindows.get(key) || [];
    
    // Remove old requests outside the window
    const validRequests = window.filter(timestamp => 
      timestamp > now - this.config.rateLimiting.windowMs
    );
    
    if (validRequests.length >= limits.rpm) {
      const oldestRequest = Math.min(...validRequests);
      const retryAfter = oldestRequest + this.config.rateLimiting.windowMs - now;
      
      return {
        blocked: true,
        limit: limits.rpm,
        remaining: 0,
        resetTime: oldestRequest + this.config.rateLimiting.windowMs,
        retryAfter
      };
    }
    
    // Add current request
    validRequests.push(now);
    this.slidingWindows.set(key, validRequests);
    
    return {
      blocked: false,
      limit: limits.rpm,
      remaining: limits.rpm - validRequests.length,
      resetTime: now + this.config.rateLimiting.windowMs
    };
  }
  
  _checkTokenBucket(key, limits) {
    const now = this.getDeterministicTimestamp();
    const bucket = this.tokenBuckets.get(key) || {
      tokens: limits.burst,
      lastRefill: now
    };
    
    // Refill tokens based on time elapsed
    const timeSinceRefill = now - bucket.lastRefill;
    const tokensToAdd = Math.floor(timeSinceRefill / this.config.rateLimiting.windowMs * limits.rpm);
    
    bucket.tokens = Math.min(limits.burst, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;
    
    if (bucket.tokens < 1) {
      return {
        blocked: true,
        limit: limits.rpm,
        remaining: 0,
        resetTime: now + (1000 / (limits.rpm / 60)), // Next token availability
        retryAfter: 1000 / (limits.rpm / 60)
      };
    }
    
    bucket.tokens--;
    this.tokenBuckets.set(key, bucket);
    
    return {
      blocked: false,
      limit: limits.rpm,
      remaining: bucket.tokens,
      resetTime: now + (1000 / (limits.rpm / 60))
    };
  }
  
  _extractAPIKey(req) {
    // Check header
    if (this.config.apiKeys.keyFormats.includes('header')) {
      const headerKey = req.headers[this.config.apiKeys.headerName.toLowerCase()];
      if (headerKey) return headerKey;
    }
    
    // Check query parameter
    if (this.config.apiKeys.keyFormats.includes('query')) {
      const queryKey = req.query?.[this.config.apiKeys.queryParam];
      if (queryKey) return queryKey;
    }
    
    // Check bearer token
    if (this.config.apiKeys.keyFormats.includes('bearer')) {
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        return authHeader.substring(7);
      }
    }
    
    return null;
  }
  
  _isContentTypeAllowed(contentType) {
    const baseType = contentType.split(';')[0].trim();
    return this.config.validation.allowedContentTypes.includes(baseType);
  }
  
  _getClientIP(req) {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
           req.headers['x-real-ip'] ||
           req.connection?.remoteAddress ||
           req.socket?.remoteAddress ||
           req.ip ||
           '0.0.0.0';
  }
  
  _checkAutoBlock(clientIP) {
    const now = this.getDeterministicTimestamp();
    const requestHistory = this.suspiciousRequests.get(clientIP) || [];
    
    // Remove old entries
    const recentRequests = requestHistory.filter(timestamp => 
      timestamp > now - 60000 // Last minute
    );
    
    // Add current request
    recentRequests.push(now);
    this.suspiciousRequests.set(clientIP, recentRequests);
    
    // Check if threshold exceeded
    if (recentRequests.length > this.config.ipFiltering.autoBlockThreshold) {
      this.blockIP(clientIP, this.config.ipFiltering.autoBlockDuration);
    }
  }
  
  _generateKeyId() {
    const bytes = new Uint8Array(this.config.apiKeys.keyLength / 2);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  }
  
  _updateKeyMetrics(apiKey) {
    const metrics = this.keyMetrics.get(apiKey) || {
      requests: 0,
      errors: 0,
      lastRequest: null
    };
    
    metrics.requests++;
    metrics.lastRequest = this.getDeterministicDate();
    
    this.keyMetrics.set(apiKey, metrics);
  }
  
  _matchEndpoint(endpoint, pattern) {
    if (pattern === endpoint) return true;
    if (pattern.endsWith('*')) {
      const prefix = pattern.slice(0, -1);
      return endpoint.startsWith(prefix);
    }
    return false;
  }
  
  async _loadAPIKeys() {
    try {
      const keysPath = path.join(process.cwd(), 'config', 'security', 'api-keys.json');
      const data = await fs.readFile(keysPath, 'utf8');
      const keysData = JSON.parse(data);
      
      if (keysData.keys) {
        for (const [apiKey, keyData] of Object.entries(keysData.keys)) {
          this.apiKeys.set(apiKey, keyData);
        }
      }
      
      if (keysData.metrics) {
        for (const [apiKey, metrics] of Object.entries(keysData.metrics)) {
          this.keyMetrics.set(apiKey, metrics);
        }
      }
      
    } catch (error) {
      if (error.code !== 'ENOENT') {
        this.logger.warn('Failed to load API keys:', error.message);
      }
    }
  }
  
  async _saveAPIKeys() {
    try {
      const keysPath = path.join(process.cwd(), 'config', 'security', 'api-keys.json');
      await fs.mkdir(path.dirname(keysPath), { recursive: true });
      
      const keysData = {
        keys: Object.fromEntries(this.apiKeys.entries()),
        metrics: Object.fromEntries(this.keyMetrics.entries()),
        lastUpdated: this.getDeterministicDate()
      };
      
      await fs.writeFile(keysPath, JSON.stringify(keysData, null, 2));
      
    } catch (error) {
      this.logger.error('Failed to save API keys:', error);
    }
  }
  
  async _loadIPFilteringRules() {
    try {
      const rulesPath = path.join(process.cwd(), 'config', 'security', 'ip-rules.json');
      const data = await fs.readFile(rulesPath, 'utf8');
      const rulesData = JSON.parse(data);
      
      if (rulesData.blocked) {
        rulesData.blocked.forEach(ip => this.blockedIPs.add(ip));
      }
      
      if (rulesData.whitelist) {
        this.config.ipFiltering.whitelist = rulesData.whitelist;
      }
      
      if (rulesData.blacklist) {
        this.config.ipFiltering.blacklist = rulesData.blacklist;
      }
      
    } catch (error) {
      if (error.code !== 'ENOENT') {
        this.logger.warn('Failed to load IP filtering rules:', error.message);
      }
    }
  }
  
  _startMonitoring() {
    if (!this.config.monitoring.enabled) return;
    
    // Metrics collection interval
    setInterval(() => {
      this._collectMetrics();
      this._checkAlerts();
    }, this.config.monitoring.metricsInterval);
    
    // Cleanup expired entries every 5 minutes
    setInterval(() => {
      this._cleanupExpiredEntries();
    }, 300000);
  }
  
  _collectMetrics() {
    // Update API key metrics
    for (const [apiKey, keyData] of this.apiKeys.entries()) {
      const metrics = this.keyMetrics.get(apiKey);
      if (metrics) {
        // Calculate rates, etc.
      }
    }
    
    this.emit('metrics:collected', this.getMetrics());
  }
  
  _checkAlerts() {
    const metrics = this.getMetrics();
    
    // Error rate alert
    const errorRate = metrics.totalRequests > 0 ? 
      metrics.errorRequests / metrics.totalRequests : 0;
    
    if (errorRate > this.config.monitoring.alertThresholds.errorRate) {
      this.emit('alert:high-error-rate', { errorRate, threshold: this.config.monitoring.alertThresholds.errorRate });
    }
    
    // Rate limit alert
    const rateLimitRate = metrics.totalRequests > 0 ? 
      metrics.rateLimitedRequests / metrics.totalRequests : 0;
    
    if (rateLimitRate > this.config.monitoring.alertThresholds.rateLimit) {
      this.emit('alert:high-rate-limiting', { rateLimitRate, threshold: this.config.monitoring.alertThresholds.rateLimit });
    }
  }
  
  _cleanupExpiredEntries() {
    const now = this.getDeterministicTimestamp();
    
    // Clean up sliding windows
    for (const [key, requests] of this.slidingWindows.entries()) {
      const validRequests = requests.filter(timestamp => 
        timestamp > now - this.config.rateLimiting.windowMs
      );
      
      if (validRequests.length === 0) {
        this.slidingWindows.delete(key);
      } else {
        this.slidingWindows.set(key, validRequests);
      }
    }
    
    // Clean up suspicious request tracking
    for (const [ip, requests] of this.suspiciousRequests.entries()) {
      const recentRequests = requests.filter(timestamp => 
        timestamp > now - 60000
      );
      
      if (recentRequests.length === 0) {
        this.suspiciousRequests.delete(ip);
      } else {
        this.suspiciousRequests.set(ip, recentRequests);
      }
    }
  }
  
  /**
   * Shutdown API security system
   */
  async shutdown() {
    try {
      this.logger.info('Shutting down API Security Manager...');
      
      // Save current state
      await this._saveAPIKeys();
      
      // Clear sensitive data
      this.rateLimitStore.clear();
      this.slidingWindows.clear();
      this.tokenBuckets.clear();
      this.apiKeys.clear();
      this.keyMetrics.clear();
      this.suspiciousRequests.clear();
      
      this.state = 'shutdown';
      this.logger.success('API Security Manager shutdown complete');
      
    } catch (error) {
      this.logger.error('Error during API Security Manager shutdown:', error);
      throw error;
    }
  }
}

export default APISecurityManager;