/**
 * Advanced Rate Limiter and DDoS Protection
 * Multi-tier rate limiting with adaptive algorithms and attack mitigation
 */

import { EventEmitter } from 'events';
import consola from 'consola';
import { createHash } from 'crypto';

export class RateLimiter extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      // Basic rate limiting
      globalRateLimit: 1000, // requests per minute
      userRateLimit: 100,    // requests per minute per user
      ipRateLimit: 200,      // requests per minute per IP
      
      // Burst protection
      burstLimit: 20,        // max burst requests
      burstWindow: 1000,     // burst window in ms
      
      // DDoS protection
      enableDDoSProtection: true,
      attackThreshold: 500,  // requests per minute to trigger DDoS detection
      blockDuration: 300000, // 5 minutes
      
      // Adaptive rate limiting
      enableAdaptive: true,
      adaptiveFactor: 0.5,   // Factor to reduce limits during attacks
      recoveryRate: 0.1,     // Rate at which limits recover
      
      // Whitelisting
      enableWhitelist: true,
      whitelistedIPs: [],
      whitelistedUsers: [],
      
      // Circuit breaker
      enableCircuitBreaker: true,
      circuitBreakerThreshold: 0.8, // Error rate threshold
      circuitBreakerTimeout: 30000,  // Reset timeout
      
      ...config
    };
    
    this.logger = consola.withTag('rate-limiter');
    
    // Rate limiting stores
    this.globalCounter = { count: 0, resetTime: this.getDeterministicTimestamp() + 60000 };
    this.userCounters = new Map();
    this.ipCounters = new Map();
    this.burstCounters = new Map();
    
    // DDoS protection
    this.blockedIPs = new Map();
    this.blockedUsers = new Map();
    this.suspiciousActivities = new Map();
    
    // Adaptive limiting
    this.adaptiveMultipliers = new Map();
    this.systemLoad = 0;
    
    // Circuit breaker
    this.circuitBreakers = new Map();
    
    // Metrics
    this.metrics = {
      totalRequests: 0,
      blockedRequests: 0,
      burstBlocks: 0,
      ddosBlocks: 0,
      adaptiveAdjustments: 0,
      circuitBreakerTrips: 0
    };
  }

  /**
   * Initialize rate limiter
   */
  async initialize() {
    try {
      this.logger.info('Initializing rate limiter and DDoS protection...');
      
      // Setup cleanup intervals
      this.cleanupInterval = setInterval(() => {
        this._cleanupCounters();
        this._updateAdaptiveLimits();
        this._updateCircuitBreakers();
      }, 60000); // Every minute
      
      // Setup system monitoring
      this.monitoringInterval = setInterval(() => {
        this._monitorSystemLoad();
      }, 5000); // Every 5 seconds
      
      this.logger.success('Rate limiter initialized');
      
    } catch (error) {
      this.logger.error('Failed to initialize rate limiter:', error);
      throw error;
    }
  }

  /**
   * Check if request should be allowed
   * @param {object} request - Request details
   * @returns {Promise<object>} Rate limit decision
   */
  async checkRateLimit(request) {
    try {
      this.metrics.totalRequests++;
      
      const decision = {
        allowed: true,
        reason: '',
        retryAfter: 0,
        remainingRequests: 0,
        metadata: {
          timestamp: this.getDeterministicTimestamp(),
          ip: request.ip,
          userId: request.userId,
          endpoint: request.endpoint
        }
      };
      
      // Check whitelist first
      if (this._isWhitelisted(request)) {
        decision.reason = 'Whitelisted';
        return decision;
      }
      
      // Check if IP is blocked for DDoS
      if (this.blockedIPs.has(request.ip)) {
        const blockInfo = this.blockedIPs.get(request.ip);
        if (this.getDeterministicTimestamp() < blockInfo.expiresAt) {
          decision.allowed = false;
          decision.reason = 'IP blocked for DDoS protection';
          decision.retryAfter = Math.ceil((blockInfo.expiresAt - this.getDeterministicTimestamp()) / 1000);
          this.metrics.ddosBlocks++;
          return decision;
        } else {
          this.blockedIPs.delete(request.ip);
        }
      }
      
      // Check if user is blocked
      if (request.userId && this.blockedUsers.has(request.userId)) {
        const blockInfo = this.blockedUsers.get(request.userId);
        if (this.getDeterministicTimestamp() < blockInfo.expiresAt) {
          decision.allowed = false;
          decision.reason = 'User blocked for suspicious activity';
          decision.retryAfter = Math.ceil((blockInfo.expiresAt - this.getDeterministicTimestamp()) / 1000);
          return decision;
        } else {
          this.blockedUsers.delete(request.userId);
        }
      }
      
      // Check circuit breaker
      if (this.config.enableCircuitBreaker) {
        const circuitBreakerResult = this._checkCircuitBreaker(request.endpoint);
        if (!circuitBreakerResult.allowed) {
          decision.allowed = false;
          decision.reason = 'Circuit breaker open';
          decision.retryAfter = circuitBreakerResult.retryAfter;
          return decision;
        }
      }
      
      // Check burst limits
      const burstCheck = this._checkBurstLimit(request);
      if (!burstCheck.allowed) {
        decision.allowed = false;
        decision.reason = 'Burst limit exceeded';
        decision.retryAfter = burstCheck.retryAfter;
        this.metrics.burstBlocks++;
        return decision;
      }
      
      // Check global rate limit
      const globalCheck = this._checkGlobalLimit();
      if (!globalCheck.allowed) {
        decision.allowed = false;
        decision.reason = 'Global rate limit exceeded';
        decision.retryAfter = globalCheck.retryAfter;
        this.metrics.blockedRequests++;
        return decision;
      }
      decision.remainingRequests = globalCheck.remaining;
      
      // Check IP rate limit
      const ipCheck = this._checkIPLimit(request.ip);
      if (!ipCheck.allowed) {
        decision.allowed = false;
        decision.reason = 'IP rate limit exceeded';
        decision.retryAfter = ipCheck.retryAfter;
        this.metrics.blockedRequests++;
        
        // Check if this might be a DDoS attack
        if (this.config.enableDDoSProtection) {
          this._checkForDDoSAttack(request.ip);
        }
        
        return decision;
      }
      decision.remainingRequests = Math.min(decision.remainingRequests, ipCheck.remaining);
      
      // Check user rate limit
      if (request.userId) {
        const userCheck = this._checkUserLimit(request.userId);
        if (!userCheck.allowed) {
          decision.allowed = false;
          decision.reason = 'User rate limit exceeded';
          decision.retryAfter = userCheck.retryAfter;
          this.metrics.blockedRequests++;
          return decision;
        }
        decision.remainingRequests = Math.min(decision.remainingRequests, userCheck.remaining);
      }
      
      // Update counters if request is allowed
      if (decision.allowed) {
        this._updateCounters(request);
      }
      
      // Check for suspicious activity
      this._trackActivity(request);
      
      return decision;
      
    } catch (error) {
      this.logger.error('Rate limit check failed:', error);
      
      // Fail closed for security
      return {
        allowed: false,
        reason: 'Rate limit check error',
        retryAfter: 60,
        remainingRequests: 0,
        metadata: {
          timestamp: this.getDeterministicTimestamp(),
          error: error.message
        }
      };
    }
  }

  /**
   * Record request result for circuit breaker
   * @param {string} endpoint - Endpoint identifier
   * @param {boolean} success - Whether request was successful
   */
  recordRequestResult(endpoint, success) {
    if (!this.config.enableCircuitBreaker) return;
    
    const circuitBreaker = this._getCircuitBreaker(endpoint);
    
    circuitBreaker.totalRequests++;
    if (!success) {
      circuitBreaker.failures++;
    }
    
    // Calculate error rate
    const errorRate = circuitBreaker.failures / circuitBreaker.totalRequests;
    
    // Check if circuit breaker should trip
    if (errorRate > this.config.circuitBreakerThreshold && 
        circuitBreaker.totalRequests >= 10) {
      circuitBreaker.state = 'open';
      circuitBreaker.openedAt = this.getDeterministicTimestamp();
      this.metrics.circuitBreakerTrips++;
      
      this.emit('circuit-breaker-open', {
        endpoint,
        errorRate,
        totalRequests: circuitBreaker.totalRequests,
        failures: circuitBreaker.failures
      });
    }
  }

  /**
   * Manually block IP address
   * @param {string} ip - IP address to block
   * @param {number} duration - Block duration in milliseconds
   * @param {string} reason - Reason for blocking
   */
  blockIP(ip, duration = this.config.blockDuration, reason = 'Manual block') {
    this.blockedIPs.set(ip, {
      blockedAt: this.getDeterministicTimestamp(),
      expiresAt: this.getDeterministicTimestamp() + duration,
      reason
    });
    
    this.emit('ip-blocked', { ip, duration, reason });
    this.logger.warn(`IP blocked: ${ip} (${reason})`);
  }

  /**
   * Manually block user
   * @param {string} userId - User ID to block
   * @param {number} duration - Block duration in milliseconds
   * @param {string} reason - Reason for blocking
   */
  blockUser(userId, duration = this.config.blockDuration, reason = 'Manual block') {
    this.blockedUsers.set(userId, {
      blockedAt: this.getDeterministicTimestamp(),
      expiresAt: this.getDeterministicTimestamp() + duration,
      reason
    });
    
    this.emit('user-blocked', { userId, duration, reason });
    this.logger.warn(`User blocked: ${userId} (${reason})`);
  }

  /**
   * Add IP to whitelist
   * @param {string} ip - IP address to whitelist
   */
  whitelistIP(ip) {
    if (!this.config.whitelistedIPs.includes(ip)) {
      this.config.whitelistedIPs.push(ip);
      this.logger.info(`IP whitelisted: ${ip}`);
    }
  }

  /**
   * Get rate limiter metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      blockedIPs: this.blockedIPs.size,
      blockedUsers: this.blockedUsers.size,
      activeCircuitBreakers: Array.from(this.circuitBreakers.values())
        .filter(cb => cb.state === 'open').length,
      systemLoad: this.systemLoad,
      adaptiveMultipliers: Object.fromEntries(this.adaptiveMultipliers)
    };
  }

  /**
   * Get current rate limit status
   * @param {string} identifier - IP or user ID
   * @returns {object} Current status
   */
  getStatus(identifier) {
    const status = {
      identifier,
      blocked: false,
      remainingRequests: 0,
      resetTime: 0,
      burstRemaining: 0
    };
    
    // Check if blocked
    if (this.blockedIPs.has(identifier) || this.blockedUsers.has(identifier)) {
      status.blocked = true;
      const blockInfo = this.blockedIPs.get(identifier) || this.blockedUsers.get(identifier);
      status.resetTime = blockInfo.expiresAt;
      return status;
    }
    
    // Get counter info
    const ipCounter = this.ipCounters.get(identifier);
    const userCounter = this.userCounters.get(identifier);
    const burstCounter = this.burstCounters.get(identifier);
    
    if (ipCounter) {
      const ipLimit = this._getEffectiveIPLimit();
      status.remainingRequests = Math.max(0, ipLimit - ipCounter.count);
      status.resetTime = ipCounter.resetTime;
    }
    
    if (userCounter) {
      const userLimit = this._getEffectiveUserLimit();
      const userRemaining = Math.max(0, userLimit - userCounter.count);
      status.remainingRequests = Math.min(status.remainingRequests, userRemaining);
    }
    
    if (burstCounter) {
      status.burstRemaining = Math.max(0, this.config.burstLimit - burstCounter.count);
    } else {
      status.burstRemaining = this.config.burstLimit;
    }
    
    return status;
  }

  /**
   * Shutdown rate limiter
   */
  async shutdown() {
    try {
      this.logger.info('Shutting down rate limiter...');
      
      // Clear intervals
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
      }
      if (this.monitoringInterval) {
        clearInterval(this.monitoringInterval);
      }
      
      // Clear all stores
      this.userCounters.clear();
      this.ipCounters.clear();
      this.burstCounters.clear();
      this.blockedIPs.clear();
      this.blockedUsers.clear();
      this.circuitBreakers.clear();
      
      this.logger.success('Rate limiter shutdown completed');
      
    } catch (error) {
      this.logger.error('Error during rate limiter shutdown:', error);
      throw error;
    }
  }

  // Private methods

  _isWhitelisted(request) {
    if (!this.config.enableWhitelist) return false;
    
    if (this.config.whitelistedIPs.includes(request.ip)) {
      return true;
    }
    
    if (request.userId && this.config.whitelistedUsers.includes(request.userId)) {
      return true;
    }
    
    return false;
  }

  _checkBurstLimit(request) {
    const identifier = request.ip;
    const now = this.getDeterministicTimestamp();
    
    if (!this.burstCounters.has(identifier)) {
      this.burstCounters.set(identifier, {
        count: 1,
        startTime: now
      });
      return { allowed: true };
    }
    
    const counter = this.burstCounters.get(identifier);
    
    // Reset if outside burst window
    if (now - counter.startTime > this.config.burstWindow) {
      counter.count = 1;
      counter.startTime = now;
      return { allowed: true };
    }
    
    // Check burst limit
    if (counter.count >= this.config.burstLimit) {
      return {
        allowed: false,
        retryAfter: Math.ceil((this.config.burstWindow - (now - counter.startTime)) / 1000)
      };
    }
    
    counter.count++;
    return { allowed: true };
  }

  _checkGlobalLimit() {
    const now = this.getDeterministicTimestamp();
    
    // Reset if needed
    if (now >= this.globalCounter.resetTime) {
      this.globalCounter.count = 0;
      this.globalCounter.resetTime = now + 60000; // Next minute
    }
    
    const effectiveLimit = this._getEffectiveGlobalLimit();
    
    if (this.globalCounter.count >= effectiveLimit) {
      return {
        allowed: false,
        retryAfter: Math.ceil((this.globalCounter.resetTime - now) / 1000),
        remaining: 0
      };
    }
    
    return {
      allowed: true,
      remaining: effectiveLimit - this.globalCounter.count
    };
  }

  _checkIPLimit(ip) {
    const now = this.getDeterministicTimestamp();
    
    if (!this.ipCounters.has(ip)) {
      this.ipCounters.set(ip, {
        count: 0,
        resetTime: now + 60000
      });
    }
    
    const counter = this.ipCounters.get(ip);
    
    // Reset if needed
    if (now >= counter.resetTime) {
      counter.count = 0;
      counter.resetTime = now + 60000;
    }
    
    const effectiveLimit = this._getEffectiveIPLimit();
    
    if (counter.count >= effectiveLimit) {
      return {
        allowed: false,
        retryAfter: Math.ceil((counter.resetTime - now) / 1000),
        remaining: 0
      };
    }
    
    return {
      allowed: true,
      remaining: effectiveLimit - counter.count
    };
  }

  _checkUserLimit(userId) {
    const now = this.getDeterministicTimestamp();
    
    if (!this.userCounters.has(userId)) {
      this.userCounters.set(userId, {
        count: 0,
        resetTime: now + 60000
      });
    }
    
    const counter = this.userCounters.get(userId);
    
    // Reset if needed
    if (now >= counter.resetTime) {
      counter.count = 0;
      counter.resetTime = now + 60000;
    }
    
    const effectiveLimit = this._getEffectiveUserLimit();
    
    if (counter.count >= effectiveLimit) {
      return {
        allowed: false,
        retryAfter: Math.ceil((counter.resetTime - now) / 1000),
        remaining: 0
      };
    }
    
    return {
      allowed: true,
      remaining: effectiveLimit - counter.count
    };
  }

  _checkCircuitBreaker(endpoint) {
    const circuitBreaker = this._getCircuitBreaker(endpoint);
    
    if (circuitBreaker.state === 'closed') {
      return { allowed: true };
    }
    
    if (circuitBreaker.state === 'open') {
      const now = this.getDeterministicTimestamp();
      if (now - circuitBreaker.openedAt > this.config.circuitBreakerTimeout) {
        circuitBreaker.state = 'half-open';
        circuitBreaker.halfOpenRequests = 0;
        return { allowed: true };
      }
      
      return {
        allowed: false,
        retryAfter: Math.ceil((circuitBreaker.openedAt + this.config.circuitBreakerTimeout - now) / 1000)
      };
    }
    
    if (circuitBreaker.state === 'half-open') {
      if (circuitBreaker.halfOpenRequests < 5) {
        circuitBreaker.halfOpenRequests++;
        return { allowed: true };
      }
      return { allowed: false, retryAfter: 10 };
    }
    
    return { allowed: true };
  }

  _getCircuitBreaker(endpoint) {
    if (!this.circuitBreakers.has(endpoint)) {
      this.circuitBreakers.set(endpoint, {
        state: 'closed',
        totalRequests: 0,
        failures: 0,
        openedAt: 0,
        halfOpenRequests: 0
      });
    }
    
    return this.circuitBreakers.get(endpoint);
  }

  _updateCounters(request) {
    // Update global counter
    this.globalCounter.count++;
    
    // Update IP counter
    const ipCounter = this.ipCounters.get(request.ip);
    if (ipCounter) {
      ipCounter.count++;
    }
    
    // Update user counter
    if (request.userId) {
      const userCounter = this.userCounters.get(request.userId);
      if (userCounter) {
        userCounter.count++;
      }
    }
  }

  _trackActivity(request) {
    const identifier = request.ip;
    
    if (!this.suspiciousActivities.has(identifier)) {
      this.suspiciousActivities.set(identifier, {
        requests: [],
        firstSeen: this.getDeterministicTimestamp()
      });
    }
    
    const activity = this.suspiciousActivities.get(identifier);
    activity.requests.push({
      timestamp: this.getDeterministicTimestamp(),
      endpoint: request.endpoint,
      userId: request.userId
    });
    
    // Keep only last hour of activity
    const oneHour = 60 * 60 * 1000;
    activity.requests = activity.requests.filter(
      req => this.getDeterministicTimestamp() - req.timestamp < oneHour
    );
  }

  _checkForDDoSAttack(ip) {
    const activity = this.suspiciousActivities.get(ip);
    if (!activity) return;
    
    // Check request rate in last minute
    const lastMinute = this.getDeterministicTimestamp() - 60000;
    const recentRequests = activity.requests.filter(
      req => req.timestamp > lastMinute
    );
    
    if (recentRequests.length > this.config.attackThreshold) {
      this.blockIP(ip, this.config.blockDuration, 'DDoS attack detected');
      
      this.emit('ddos-attack-detected', {
        ip,
        requestCount: recentRequests.length,
        timeWindow: '1 minute'
      });
    }
  }

  _getEffectiveGlobalLimit() {
    if (!this.config.enableAdaptive) {
      return this.config.globalRateLimit;
    }
    
    const multiplier = this.adaptiveMultipliers.get('global') || 1;
    return Math.floor(this.config.globalRateLimit * multiplier);
  }

  _getEffectiveIPLimit() {
    if (!this.config.enableAdaptive) {
      return this.config.ipRateLimit;
    }
    
    const multiplier = this.adaptiveMultipliers.get('ip') || 1;
    return Math.floor(this.config.ipRateLimit * multiplier);
  }

  _getEffectiveUserLimit() {
    if (!this.config.enableAdaptive) {
      return this.config.userRateLimit;
    }
    
    const multiplier = this.adaptiveMultipliers.get('user') || 1;
    return Math.floor(this.config.userRateLimit * multiplier);
  }

  _updateAdaptiveLimits() {
    if (!this.config.enableAdaptive) return;
    
    const now = this.getDeterministicTimestamp();
    const blockedRatio = this.metrics.blockedRequests / (this.metrics.totalRequests || 1);
    
    // Adjust limits based on system load and blocked requests
    let adjustment = 0;
    
    if (blockedRatio > 0.2) {
      // High block rate - reduce limits
      adjustment = -this.config.adaptiveFactor;
    } else if (blockedRatio < 0.05 && this.systemLoad < 0.7) {
      // Low block rate and load - increase limits
      adjustment = this.config.recoveryRate;
    }
    
    if (adjustment !== 0) {
      ['global', 'ip', 'user'].forEach(type => {
        const currentMultiplier = this.adaptiveMultipliers.get(type) || 1;
        const newMultiplier = Math.max(0.1, Math.min(2.0, currentMultiplier + adjustment));
        
        if (newMultiplier !== currentMultiplier) {
          this.adaptiveMultipliers.set(type, newMultiplier);
          this.metrics.adaptiveAdjustments++;
          
          this.emit('adaptive-limit-adjusted', {
            type,
            oldMultiplier: currentMultiplier,
            newMultiplier,
            reason: adjustment > 0 ? 'recovery' : 'load-reduction'
          });
        }
      });
    }
  }

  _updateCircuitBreakers() {
    const now = this.getDeterministicTimestamp();
    
    for (const [endpoint, circuitBreaker] of this.circuitBreakers.entries()) {
      if (circuitBreaker.state === 'half-open') {
        // Check if we should close or reopen the circuit
        if (circuitBreaker.halfOpenRequests >= 5) {
          const errorRate = circuitBreaker.failures / circuitBreaker.totalRequests;
          if (errorRate < this.config.circuitBreakerThreshold) {
            circuitBreaker.state = 'closed';
            circuitBreaker.totalRequests = 0;
            circuitBreaker.failures = 0;
            
            this.emit('circuit-breaker-closed', { endpoint });
          } else {
            circuitBreaker.state = 'open';
            circuitBreaker.openedAt = now;
          }
        }
      }
      
      // Reset counters periodically
      if (circuitBreaker.state === 'closed' && circuitBreaker.totalRequests > 1000) {
        circuitBreaker.totalRequests = Math.floor(circuitBreaker.totalRequests * 0.9);
        circuitBreaker.failures = Math.floor(circuitBreaker.failures * 0.9);
      }
    }
  }

  _monitorSystemLoad() {
    // Simple system load approximation based on active connections
    const activeConnections = this.ipCounters.size + this.userCounters.size;
    const maxConnections = 1000; // Configurable threshold
    
    this.systemLoad = Math.min(1.0, activeConnections / maxConnections);
  }

  _cleanupCounters() {
    const now = this.getDeterministicTimestamp();
    
    // Cleanup expired IP counters
    for (const [ip, counter] of this.ipCounters.entries()) {
      if (now >= counter.resetTime + 60000) { // 1 minute grace period
        this.ipCounters.delete(ip);
      }
    }
    
    // Cleanup expired user counters
    for (const [userId, counter] of this.userCounters.entries()) {
      if (now >= counter.resetTime + 60000) {
        this.userCounters.delete(userId);
      }
    }
    
    // Cleanup expired burst counters
    for (const [identifier, counter] of this.burstCounters.entries()) {
      if (now - counter.startTime > this.config.burstWindow * 2) {
        this.burstCounters.delete(identifier);
      }
    }
    
    // Cleanup expired blocks
    for (const [ip, blockInfo] of this.blockedIPs.entries()) {
      if (now >= blockInfo.expiresAt) {
        this.blockedIPs.delete(ip);
      }
    }
    
    for (const [userId, blockInfo] of this.blockedUsers.entries()) {
      if (now >= blockInfo.expiresAt) {
        this.blockedUsers.delete(userId);
      }
    }
    
    // Cleanup old suspicious activities
    const oneHour = 60 * 60 * 1000;
    for (const [identifier, activity] of this.suspiciousActivities.entries()) {
      if (now - activity.firstSeen > oneHour && activity.requests.length === 0) {
        this.suspiciousActivities.delete(identifier);
      }
    }
  }
}

export default RateLimiter;