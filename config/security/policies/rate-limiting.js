/**
 * Advanced Rate Limiting and DDoS Protection
 * Multi-layer protection with adaptive algorithms and ML-based detection
 */

const redis = require('redis');
const crypto = require('crypto');

class RateLimitingManager {
  constructor(config = {}) {
    this.config = {
      redis: {
        url: config.redis?.url || process.env.REDIS_URL || 'redis://localhost:6379',
        keyPrefix: config.redis?.keyPrefix || 'rl:',
        db: config.redis?.db || 0
      },
      layers: {
        // Layer 1: Basic IP-based rate limiting
        basic: {
          windowMs: 60 * 1000, // 1 minute
          maxRequests: 100,
          skipSuccessfulRequests: false,
          skipFailedRequests: false
        },
        
        // Layer 2: Endpoint-specific limits
        endpoint: {
          '/api/auth/login': { windowMs: 15 * 60 * 1000, maxRequests: 5 }, // 5 login attempts per 15 minutes
          '/api/auth/register': { windowMs: 60 * 60 * 1000, maxRequests: 3 }, // 3 registrations per hour
          '/api/auth/forgot-password': { windowMs: 60 * 60 * 1000, maxRequests: 3 },
          '/api/upload': { windowMs: 60 * 1000, maxRequests: 10 },
          '/api/search': { windowMs: 60 * 1000, maxRequests: 50 },
          '/api/data/export': { windowMs: 60 * 60 * 1000, maxRequests: 5 }
        },
        
        // Layer 3: User-based limits (authenticated requests)
        user: {
          windowMs: 60 * 1000, // 1 minute
          maxRequests: 200,
          premium: {
            windowMs: 60 * 1000,
            maxRequests: 500
          }
        },
        
        // Layer 4: API key limits
        apiKey: {
          basic: { windowMs: 60 * 60 * 1000, maxRequests: 1000 }, // 1000/hour
          premium: { windowMs: 60 * 60 * 1000, maxRequests: 10000 }, // 10k/hour
          enterprise: { windowMs: 60 * 60 * 1000, maxRequests: 100000 } // 100k/hour
        }
      },
      
      // DDoS Protection
      ddos: {
        enabled: true,
        burst: 10, // Allow burst of 10 requests
        limit: 1000, // Requests per window
        checkInterval: 1000, // Check every second
        whitelist: [], // IP whitelist
        blacklist: [], // IP blacklist
        maxWeight: 10000, // Max weight before triggering protection
        
        // Circuit breaker settings
        circuitBreaker: {
          enabled: true,
          threshold: 50, // Error threshold percentage
          timeout: 60000, // 1 minute circuit open time
          monitoringWindow: 30000 // 30 seconds monitoring window
        }
      },
      
      // Adaptive protection
      adaptive: {
        enabled: true,
        learningPeriod: 24 * 60 * 60 * 1000, // 24 hours
        anomalyThreshold: 2.5, // Standard deviations
        autoBlock: true,
        autoBlockDuration: 60 * 60 * 1000 // 1 hour
      },
      
      // Response strategies
      response: {
        strategy: 'progressive', // 'block', 'delay', 'progressive'
        delays: [100, 500, 1000, 2000, 5000], // Progressive delay ms
        captcha: {
          enabled: true,
          provider: 'recaptcha', // 'recaptcha', 'hcaptcha'
          threshold: 0.5
        }
      }
    };

    this.redisClient = null;
    this.circuitBreakers = new Map();
    this.requestPatterns = new Map();
    this.anomalyDetector = new AnomalyDetector();
  }

  // Initialize rate limiting system
  async initialize() {
    try {
      // Connect to Redis
      this.redisClient = redis.createClient({
        url: this.config.redis.url,
        database: this.config.redis.db
      });

      await this.redisClient.connect();
      
      // Setup cleanup intervals
      this.setupCleanupIntervals();
      
      // Start anomaly detection if adaptive protection is enabled
      if (this.config.adaptive.enabled) {
        this.startAnomalyDetection();
      }

      console.log('Rate limiting system initialized');
      return true;
    } catch (error) {
      console.error('Failed to initialize rate limiting:', error);
      throw error;
    }
  }

  // Main rate limiting middleware
  getRateLimitMiddleware() {
    return async (req, res, next) => {
      try {
        const identifier = this.getIdentifier(req);
        const endpoint = this.normalizeEndpoint(req.path);
        
        // Check blacklist first
        if (await this.isBlacklisted(identifier.ip)) {
          return this.handleBlocked(res, 'IP blacklisted');
        }

        // Check whitelist
        if (await this.isWhitelisted(identifier.ip)) {
          return next();
        }

        // Apply multiple rate limiting layers
        const checks = await Promise.all([
          this.checkBasicRateLimit(identifier.ip),
          this.checkEndpointRateLimit(identifier.ip, endpoint),
          this.checkUserRateLimit(identifier.user, req.user),
          this.checkAPIKeyRateLimit(identifier.apiKey, req.apiKeyTier),
          this.checkDDoSProtection(identifier.ip, req),
          this.checkCircuitBreaker(endpoint)
        ]);

        // Find the most restrictive limit
        const restrictiveCheck = checks.find(check => !check.allowed);
        
        if (restrictiveCheck) {
          return this.handleRateLimit(res, restrictiveCheck);
        }

        // Record successful request
        await this.recordRequest(identifier, endpoint, req);
        
        // Set rate limit headers
        this.setRateLimitHeaders(res, checks);
        
        next();
      } catch (error) {
        console.error('Rate limiting error:', error);
        // Fail open - allow request if rate limiting fails
        next();
      }
    };
  }

  // Get request identifier
  getIdentifier(req) {
    const ip = this.getClientIP(req);
    const user = req.user?.id || null;
    const apiKey = req.headers['x-api-key'] || null;
    const userAgent = req.headers['user-agent'] || '';
    
    return {
      ip,
      user,
      apiKey,
      userAgent,
      fingerprint: this.generateFingerprint(req)
    };
  }

  getClientIP(req) {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
           req.headers['x-real-ip'] ||
           req.connection.remoteAddress ||
           req.socket.remoteAddress ||
           req.ip;
  }

  generateFingerprint(req) {
    const data = [
      req.headers['user-agent'],
      req.headers['accept-language'],
      req.headers['accept-encoding']
    ].join('|');
    
    return crypto.createHash('sha256').update(data).digest('hex').substring(0, 16);
  }

  normalizeEndpoint(path) {
    // Remove parameters and normalize similar endpoints
    return path
      .replace(/\/\d+/g, '/:id') // Replace numbers with :id
      .replace(/\/[a-f0-9]{24}/g, '/:id') // Replace ObjectIds with :id
      .replace(/\/[a-f0-9\-]{36}/g, '/:uuid') // Replace UUIDs with :uuid
      .toLowerCase();
  }

  // Basic IP-based rate limiting
  async checkBasicRateLimit(ip) {
    const key = `${this.config.redis.keyPrefix}basic:${ip}`;
    const { windowMs, maxRequests } = this.config.layers.basic;
    
    return await this.checkRateLimit(key, windowMs, maxRequests, 'basic');
  }

  // Endpoint-specific rate limiting
  async checkEndpointRateLimit(ip, endpoint) {
    const endpointConfig = this.config.layers.endpoint[endpoint];
    if (!endpointConfig) {
      return { allowed: true, type: 'endpoint' };
    }

    const key = `${this.config.redis.keyPrefix}endpoint:${ip}:${endpoint}`;
    const { windowMs, maxRequests } = endpointConfig;
    
    return await this.checkRateLimit(key, windowMs, maxRequests, 'endpoint');
  }

  // User-based rate limiting
  async checkUserRateLimit(userId, user) {
    if (!userId) {
      return { allowed: true, type: 'user' };
    }

    const userConfig = user?.premium ? 
      this.config.layers.user.premium : 
      this.config.layers.user;
    
    const key = `${this.config.redis.keyPrefix}user:${userId}`;
    const { windowMs, maxRequests } = userConfig;
    
    return await this.checkRateLimit(key, windowMs, maxRequests, 'user');
  }

  // API key rate limiting
  async checkAPIKeyRateLimit(apiKey, tier) {
    if (!apiKey) {
      return { allowed: true, type: 'apiKey' };
    }

    const keyConfig = this.config.layers.apiKey[tier] || this.config.layers.apiKey.basic;
    const key = `${this.config.redis.keyPrefix}apikey:${apiKey}`;
    const { windowMs, maxRequests } = keyConfig;
    
    return await this.checkRateLimit(key, windowMs, maxRequests, 'apiKey');
  }

  // Generic rate limit check using sliding window
  async checkRateLimit(key, windowMs, maxRequests, type) {
    const now = Date.now();
    const window = Math.floor(now / windowMs);
    const windowKey = `${key}:${window}`;
    
    try {
      // Use Redis pipeline for atomic operations
      const pipeline = this.redisClient.multi();
      
      // Increment counter
      pipeline.incr(windowKey);
      pipeline.expire(windowKey, Math.ceil(windowMs / 1000) + 1);
      
      // Also check previous window for sliding effect
      const prevWindow = window - 1;
      const prevWindowKey = `${key}:${prevWindow}`;
      pipeline.get(prevWindowKey);
      
      const results = await pipeline.exec();
      
      const currentCount = results[0][1] || 0;
      const prevCount = parseInt(results[2][1]) || 0;
      
      // Calculate sliding window count
      const windowProgress = (now % windowMs) / windowMs;
      const slidingCount = Math.floor(prevCount * (1 - windowProgress) + currentCount);
      
      const allowed = slidingCount <= maxRequests;
      
      return {
        allowed,
        type,
        count: slidingCount,
        limit: maxRequests,
        windowMs,
        resetTime: (window + 1) * windowMs
      };
    } catch (error) {
      console.error('Rate limit check failed:', error);
      return { allowed: true, type, error: error.message };
    }
  }

  // DDoS Protection
  async checkDDoSProtection(ip, req) {
    if (!this.config.ddos.enabled) {
      return { allowed: true, type: 'ddos' };
    }

    const key = `${this.config.redis.keyPrefix}ddos:${ip}`;
    
    try {
      // Calculate request weight based on various factors
      const weight = this.calculateRequestWeight(req);
      
      // Check current weight
      const currentWeight = await this.redisClient.get(key) || 0;
      const newWeight = parseInt(currentWeight) + weight;
      
      if (newWeight > this.config.ddos.maxWeight) {
        // Trigger DDoS protection
        await this.triggerDDoSProtection(ip);
        return {
          allowed: false,
          type: 'ddos',
          reason: 'DDoS protection triggered',
          weight: newWeight,
          maxWeight: this.config.ddos.maxWeight
        };
      }

      // Update weight with decay
      await this.redisClient.setex(key, 60, newWeight); // Decay over 1 minute
      
      return { allowed: true, type: 'ddos', weight: newWeight };
    } catch (error) {
      console.error('DDoS check failed:', error);
      return { allowed: true, type: 'ddos', error: error.message };
    }
  }

  calculateRequestWeight(req) {
    let weight = 1;
    
    // Increase weight for suspicious patterns
    if (req.headers['user-agent']?.includes('bot')) weight += 2;
    if (!req.headers['referer']) weight += 1;
    if (req.method === 'POST') weight += 1;
    if (req.body && Object.keys(req.body).length > 10) weight += 2;
    
    // Decrease weight for authenticated users
    if (req.user) weight -= 1;
    if (req.headers['authorization']) weight -= 1;
    
    return Math.max(1, weight);
  }

  async triggerDDoSProtection(ip) {
    // Add to temporary blacklist
    const blacklistKey = `${this.config.redis.keyPrefix}blacklist:${ip}`;
    await this.redisClient.setex(blacklistKey, 3600, 'ddos'); // 1 hour blacklist
    
    // Log security event
    console.warn(`DDoS protection triggered for IP: ${ip}`);
    
    // Could integrate with external services like Cloudflare
    await this.notifySecurityTeam('ddos', { ip, timestamp: new Date().toISOString() });
  }

  // Circuit breaker for endpoints
  async checkCircuitBreaker(endpoint) {
    if (!this.config.ddos.circuitBreaker.enabled) {
      return { allowed: true, type: 'circuit' };
    }

    const breaker = this.getCircuitBreaker(endpoint);
    
    if (breaker.state === 'OPEN') {
      return {
        allowed: false,
        type: 'circuit',
        reason: 'Circuit breaker open',
        state: breaker.state
      };
    }

    return { allowed: true, type: 'circuit', state: breaker.state };
  }

  getCircuitBreaker(endpoint) {
    if (!this.circuitBreakers.has(endpoint)) {
      this.circuitBreakers.set(endpoint, {
        state: 'CLOSED',
        failures: 0,
        lastFailureTime: null,
        nextAttempt: 0
      });
    }
    
    return this.circuitBreakers.get(endpoint);
  }

  // Record successful request for pattern analysis
  async recordRequest(identifier, endpoint, req) {
    const pattern = {
      ip: identifier.ip,
      endpoint,
      timestamp: Date.now(),
      userAgent: identifier.userAgent,
      method: req.method,
      size: req.get('content-length') || 0
    };

    // Store for anomaly detection
    if (this.config.adaptive.enabled) {
      await this.anomalyDetector.recordPattern(pattern);
    }

    // Update request patterns for this IP
    const ipPatterns = this.requestPatterns.get(identifier.ip) || [];
    ipPatterns.push(pattern);
    
    // Keep only recent patterns (last hour)
    const recentPatterns = ipPatterns.filter(p => 
      Date.now() - p.timestamp < 60 * 60 * 1000
    );
    
    this.requestPatterns.set(identifier.ip, recentPatterns);
  }

  // Handle rate limit exceeded
  async handleRateLimit(res, check) {
    const strategy = this.config.response.strategy;
    
    switch (strategy) {
      case 'block':
        return this.handleBlocked(res, `Rate limit exceeded: ${check.type}`);
        
      case 'delay':
        await this.delayResponse(check);
        return this.handleBlocked(res, `Rate limit exceeded: ${check.type}`);
        
      case 'progressive':
        return this.handleProgressive(res, check);
        
      default:
        return this.handleBlocked(res, `Rate limit exceeded: ${check.type}`);
    }
  }

  async handleProgressive(res, check) {
    const delayIndex = Math.min(check.count - check.limit, this.config.response.delays.length - 1);
    const delay = this.config.response.delays[delayIndex] || 5000;
    
    await this.delayResponse({ delay });
    
    if (this.config.response.captcha.enabled && delayIndex > 2) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        type: check.type,
        captcha_required: true,
        retry_after: Math.ceil(delay / 1000)
      });
    }
    
    return this.handleBlocked(res, `Rate limit exceeded: ${check.type}`);
  }

  async delayResponse(options) {
    const delay = options.delay || 1000;
    return new Promise(resolve => setTimeout(resolve, delay));
  }

  handleBlocked(res, reason) {
    return res.status(429).json({
      error: reason,
      timestamp: new Date().toISOString(),
      retry_after: 60
    });
  }

  // Set rate limit headers
  setRateLimitHeaders(res, checks) {
    const basicCheck = checks.find(c => c.type === 'basic');
    if (basicCheck) {
      res.set({
        'X-RateLimit-Limit': basicCheck.limit,
        'X-RateLimit-Remaining': Math.max(0, basicCheck.limit - basicCheck.count),
        'X-RateLimit-Reset': new Date(basicCheck.resetTime).toISOString()
      });
    }
  }

  // Whitelist/Blacklist management
  async isWhitelisted(ip) {
    return this.config.ddos.whitelist.includes(ip) ||
           await this.redisClient.exists(`${this.config.redis.keyPrefix}whitelist:${ip}`);
  }

  async isBlacklisted(ip) {
    return this.config.ddos.blacklist.includes(ip) ||
           await this.redisClient.exists(`${this.config.redis.keyPrefix}blacklist:${ip}`);
  }

  async addToWhitelist(ip, duration = null) {
    const key = `${this.config.redis.keyPrefix}whitelist:${ip}`;
    if (duration) {
      await this.redisClient.setex(key, duration, 'manual');
    } else {
      await this.redisClient.set(key, 'manual');
    }
  }

  async addToBlacklist(ip, duration = 3600, reason = 'manual') {
    const key = `${this.config.redis.keyPrefix}blacklist:${ip}`;
    await this.redisClient.setex(key, duration, reason);
  }

  // Cleanup and monitoring
  setupCleanupIntervals() {
    // Clean up old circuit breaker data
    setInterval(() => {
      const now = Date.now();
      for (const [endpoint, breaker] of this.circuitBreakers.entries()) {
        if (breaker.state === 'OPEN' && now > breaker.nextAttempt) {
          breaker.state = 'HALF_OPEN';
        }
      }
    }, 60000); // Check every minute

    // Clean up request patterns
    setInterval(() => {
      const cutoff = Date.now() - 60 * 60 * 1000; // 1 hour ago
      for (const [ip, patterns] of this.requestPatterns.entries()) {
        const recent = patterns.filter(p => p.timestamp > cutoff);
        if (recent.length === 0) {
          this.requestPatterns.delete(ip);
        } else {
          this.requestPatterns.set(ip, recent);
        }
      }
    }, 5 * 60 * 1000); // Clean every 5 minutes
  }

  startAnomalyDetection() {
    // This would integrate with ML-based anomaly detection
    setInterval(async () => {
      try {
        const anomalies = await this.anomalyDetector.detectAnomalies();
        for (const anomaly of anomalies) {
          await this.handleAnomaly(anomaly);
        }
      } catch (error) {
        console.error('Anomaly detection failed:', error);
      }
    }, 60000); // Check every minute
  }

  async handleAnomaly(anomaly) {
    console.warn('Anomaly detected:', anomaly);
    
    if (this.config.adaptive.autoBlock && anomaly.severity > this.config.adaptive.anomalyThreshold) {
      await this.addToBlacklist(
        anomaly.ip, 
        this.config.adaptive.autoBlockDuration / 1000, 
        'anomaly'
      );
    }
  }

  async notifySecurityTeam(type, data) {
    // Implementation would send alerts to security team
    console.log(`Security alert [${type}]:`, data);
  }

  // Graceful shutdown
  async shutdown() {
    if (this.redisClient) {
      await this.redisClient.quit();
    }
    console.log('Rate limiting system shutdown complete');
  }
}

// Simple anomaly detector class
class AnomalyDetector {
  constructor() {
    this.patterns = [];
    this.baselines = new Map();
  }

  async recordPattern(pattern) {
    this.patterns.push(pattern);
    
    // Keep only recent patterns
    const cutoff = Date.now() - 24 * 60 * 60 * 1000; // 24 hours
    this.patterns = this.patterns.filter(p => p.timestamp > cutoff);
  }

  async detectAnomalies() {
    // Simple statistical anomaly detection
    // In production, this would use more sophisticated ML algorithms
    const anomalies = [];
    
    // Group patterns by IP
    const ipPatterns = new Map();
    for (const pattern of this.patterns) {
      if (!ipPatterns.has(pattern.ip)) {
        ipPatterns.set(pattern.ip, []);
      }
      ipPatterns.get(pattern.ip).push(pattern);
    }

    // Detect IPs with unusual request patterns
    for (const [ip, patterns] of ipPatterns.entries()) {
      const requestRate = patterns.length / 24; // requests per hour
      const uniqueEndpoints = new Set(patterns.map(p => p.endpoint)).size;
      
      // Simple heuristics for anomaly detection
      if (requestRate > 100) { // More than 100 requests/hour
        anomalies.push({
          ip,
          type: 'high_request_rate',
          severity: Math.min(requestRate / 100, 10),
          data: { requestRate, patterns: patterns.length }
        });
      }
      
      if (uniqueEndpoints > 50) { // Accessing more than 50 different endpoints
        anomalies.push({
          ip,
          type: 'endpoint_scanning',
          severity: Math.min(uniqueEndpoints / 50, 5),
          data: { uniqueEndpoints }
        });
      }
    }

    return anomalies;
  }
}

module.exports = RateLimitingManager;