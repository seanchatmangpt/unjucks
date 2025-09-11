/**
 * Security Manager
 * Handles authentication, authorization, input validation, and security policies
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { body, param, query, validationResult } from 'express-validator';
import rateLimit from 'express-rate-limit';
import consola from 'consola';
import { EventEmitter } from 'events';
import crypto from 'crypto';

export class SecurityManager extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = config;
    this.status = 'uninitialized';
    
    // Security metrics
    this.metrics = {
      authAttempts: 0,
      authSuccesses: 0,
      authFailures: 0,
      validationErrors: 0,
      suspiciousActivity: 0,
      blockedRequests: 0
    };
    
    // In-memory stores (in production, use Redis/database)
    this.sessions = new Map();
    this.blacklistedTokens = new Set();
    this.rateLimitStore = new Map();
    this.suspiciousIPs = new Map();
  }

  /**
   * Initialize security manager
   */
  async initialize() {
    try {
      this.status = 'initializing';
      
      // Validate configuration
      this.validateConfig();
      
      // Setup security policies
      this.setupSecurityPolicies();
      
      // Setup cleanup tasks
      this.setupCleanupTasks();
      
      this.status = 'ready';
      consola.success('✅ Security Manager initialized');
      
      this.emit('initialized');
    } catch (error) {
      this.status = 'error';
      consola.error('❌ Security Manager initialization failed:', error);
      throw error;
    }
  }

  /**
   * Validate configuration
   */
  validateConfig() {
    if (!this.config.jwt?.secret || this.config.jwt.secret.length < 32) {
      throw new Error('JWT secret must be at least 32 characters long');
    }
    
    if (process.env.NODE_ENV === 'production' && this.config.jwt.secret === 'your-super-secret-jwt-key-change-in-production') {
      throw new Error('Default JWT secret detected in production. Change JWT secret immediately!');
    }
  }

  /**
   * Setup security policies
   */
  setupSecurityPolicies() {
    // Password policy
    this.passwordPolicy = {
      minLength: 8,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: true,
      maxAge: 90 * 24 * 60 * 60 * 1000, // 90 days
      preventReuse: 5 // last 5 passwords
    };
    
    // Rate limiting policies
    this.rateLimitPolicies = {
      auth: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxAttempts: 5,
        blockDuration: 30 * 60 * 1000 // 30 minutes
      },
      api: {
        windowMs: 15 * 60 * 1000,
        maxRequests: 100
      },
      query: {
        windowMs: 60 * 1000, // 1 minute
        maxRequests: 10
      }
    };
  }

  /**
   * Setup cleanup tasks
   */
  setupCleanupTasks() {
    // Cleanup expired sessions and tokens
    setInterval(() => {
      this.cleanupExpiredSessions();
      this.cleanupBlacklistedTokens();
      this.cleanupRateLimitStore();
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  /**
   * Hash password
   */
  async hashPassword(password) {
    if (!this.validatePasswordStrength(password)) {
      throw new Error('Password does not meet security requirements');
    }
    
    const rounds = this.config.bcrypt?.rounds || 12;
    return bcrypt.hash(password, rounds);
  }

  /**
   * Verify password
   */
  async verifyPassword(password, hash) {
    return bcrypt.compare(password, hash);
  }

  /**
   * Validate password strength
   */
  validatePasswordStrength(password) {
    const policy = this.passwordPolicy;
    
    if (password.length < policy.minLength) return false;
    if (policy.requireUppercase && !/[A-Z]/.test(password)) return false;
    if (policy.requireLowercase && !/[a-z]/.test(password)) return false;
    if (policy.requireNumbers && !/\d/.test(password)) return false;
    if (policy.requireSpecialChars && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) return false;
    
    // Check for common weak passwords
    const weakPasswords = ['password', '123456', 'qwerty', 'admin', 'letmein'];
    if (weakPasswords.includes(password.toLowerCase())) return false;
    
    return true;
  }

  /**
   * Generate JWT token
   */
  generateToken(payload, options = {}) {
    const tokenOptions = {
      expiresIn: options.expiresIn || this.config.jwt.expiresIn || '24h',
      issuer: this.config.jwt.issuer,
      audience: this.config.jwt.audience,
      algorithm: 'HS256'
    };

    const token = jwt.sign(payload, this.config.jwt.secret, tokenOptions);
    
    // Store token metadata for tracking
    this.sessions.set(token, {
      payload,
      createdAt: Date.now(),
      expiresAt: Date.now() + this.parseTimeToMs(tokenOptions.expiresIn),
      lastUsed: Date.now()
    });
    
    this.metrics.authSuccesses++;
    this.emit('token-generated', { payload: payload.userId || payload.sub });
    
    return token;
  }

  /**
   * Verify JWT token
   */
  verifyToken(token) {
    try {
      // Check if token is blacklisted
      if (this.blacklistedTokens.has(token)) {
        throw new Error('Token is blacklisted');
      }
      
      const decoded = jwt.verify(token, this.config.jwt.secret, {
        issuer: this.config.jwt.issuer,
        audience: this.config.jwt.audience,
        algorithms: ['HS256']
      });
      
      // Update last used timestamp
      const session = this.sessions.get(token);
      if (session) {
        session.lastUsed = Date.now();
      }
      
      this.emit('token-verified', { userId: decoded.userId || decoded.sub });
      return decoded;
    } catch (error) {
      this.metrics.authFailures++;
      this.emit('token-verification-failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Blacklist token (for logout/revocation)
   */
  blacklistToken(token) {
    this.blacklistedTokens.add(token);
    this.sessions.delete(token);
    
    this.emit('token-blacklisted', { token: token.substring(0, 10) + '...' });
  }

  /**
   * Generate API key
   */
  generateAPIKey() {
    const key = crypto.randomBytes(32).toString('hex');
    const keyId = crypto.randomUUID();
    
    return {
      id: keyId,
      key: `kgen_${key}`,
      createdAt: Date.now()
    };
  }

  /**
   * Authentication middleware
   */
  authenticateToken() {
    return (req, res, next) => {
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
      
      if (!token) {
        this.metrics.authFailures++;
        return res.status(401).json({ 
          error: 'Authentication required',
          message: 'No token provided'
        });
      }
      
      try {
        const decoded = this.verifyToken(token);
        req.user = decoded;
        next();
      } catch (error) {
        this.metrics.authFailures++;
        return res.status(401).json({ 
          error: 'Authentication failed',
          message: error.message
        });
      }
    };
  }

  /**
   * API Key authentication middleware
   */
  authenticateAPIKey() {
    return (req, res, next) => {
      if (!this.config.apiKeys?.enabled) {
        return next(); // Skip if API keys are disabled
      }
      
      const headerName = this.config.apiKeys.headerName || 'X-API-Key';
      const queryParam = this.config.apiKeys.queryParam || 'api_key';
      
      const apiKey = req.headers[headerName.toLowerCase()] || req.query[queryParam];
      
      if (!apiKey) {
        this.metrics.authFailures++;
        return res.status(401).json({
          error: 'API key required',
          message: `Provide API key in ${headerName} header or ${queryParam} query parameter`
        });
      }
      
      // In production, validate against database
      const isValidKey = this.validateAPIKey(apiKey);
      if (!isValidKey) {
        this.metrics.authFailures++;
        this.recordSuspiciousActivity(req.ip, 'invalid_api_key');
        return res.status(401).json({
          error: 'Invalid API key',
          message: 'The provided API key is not valid'
        });
      }
      
      req.apiKey = apiKey;
      next();
    };
  }

  /**
   * Validate API key (simplified - use database in production)
   */
  validateAPIKey(apiKey) {
    // Simple validation - in production, check against database
    return apiKey.startsWith('kgen_') && apiKey.length === 69;
  }

  /**
   * Authorization middleware (role-based)
   */
  authorize(requiredRoles = []) {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          error: 'Authentication required',
          message: 'No user context found'
        });
      }
      
      const userRoles = req.user.roles || [];
      const hasRequiredRole = requiredRoles.length === 0 || 
        requiredRoles.some(role => userRoles.includes(role));
      
      if (!hasRequiredRole) {
        this.metrics.authFailures++;
        return res.status(403).json({
          error: 'Insufficient permissions',
          message: `Required roles: ${requiredRoles.join(', ')}`
        });
      }
      
      next();
    };
  }

  /**
   * Input validation middleware
   */
  validateInput(validationRules) {
    return [
      ...validationRules,
      (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          this.metrics.validationErrors++;
          
          // Log suspicious patterns
          const errorTypes = errors.array().map(e => e.msg);
          this.checkForSuspiciousValidationErrors(req.ip, errorTypes);
          
          return res.status(400).json({
            error: 'Validation Error',
            message: 'Request validation failed',
            details: errors.array()
          });
        }
        next();
      }
    ];
  }

  /**
   * Rate limiting middleware
   */
  rateLimitMiddleware(type = 'api') {
    const policy = this.rateLimitPolicies[type];
    if (!policy) {
      throw new Error(`Unknown rate limit policy: ${type}`);
    }
    
    return rateLimit({
      windowMs: policy.windowMs,
      max: policy.maxRequests || policy.maxAttempts,
      message: {
        error: 'Rate limit exceeded',
        message: `Too many requests. Try again in ${Math.round(policy.windowMs / 1000)} seconds.`,
        retryAfter: Math.round(policy.windowMs / 1000)
      },
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req, res) => {
        this.metrics.blockedRequests++;
        this.recordSuspiciousActivity(req.ip, 'rate_limit_exceeded');
        
        res.status(429).json({
          error: 'Rate limit exceeded',
          message: `Too many requests. Try again in ${Math.round(policy.windowMs / 1000)} seconds.`,
          retryAfter: Math.round(policy.windowMs / 1000)
        });
      }
    });
  }

  /**
   * SPARQL query security middleware
   */
  secureSPARQLQuery() {
    return (req, res, next) => {
      const query = req.body.query || req.query.query;
      
      if (!query) {
        return next();
      }
      
      // Check for dangerous SPARQL patterns
      const dangerousPatterns = [
        /DELETE\s+WHERE/i,
        /DROP\s+GRAPH/i,
        /CLEAR\s+GRAPH/i,
        /LOAD\s+</i,
        /SERVICE\s+</i,
        /CONSTRUCT.*\{\s*\?/i, // Overly broad CONSTRUCT
        /VALUES.*\(\s*\?.*\)\s*\{\s*\(/i // VALUES injection
      ];
      
      for (const pattern of dangerousPatterns) {
        if (pattern.test(query)) {
          this.metrics.suspiciousActivity++;
          this.recordSuspiciousActivity(req.ip, 'dangerous_sparql_pattern');
          
          return res.status(400).json({
            error: 'Unsafe SPARQL query',
            message: 'The query contains potentially dangerous patterns and has been blocked'
          });
        }
      }
      
      // Limit query complexity (basic check)
      const complexityScore = this.calculateQueryComplexity(query);
      if (complexityScore > 1000) {
        return res.status(400).json({
          error: 'Query too complex',
          message: 'The query exceeds complexity limits'
        });
      }
      
      next();
    };
  }

  /**
   * Calculate SPARQL query complexity
   */
  calculateQueryComplexity(query) {
    let score = 0;
    
    // Count patterns, joins, optional clauses, etc.
    score += (query.match(/\?\w+/g) || []).length * 2; // Variables
    score += (query.match(/OPTIONAL/gi) || []).length * 10; // Optional clauses
    score += (query.match(/UNION/gi) || []).length * 15; // Union clauses
    score += (query.match(/FILTER/gi) || []).length * 5; // Filters
    score += (query.match(/\{.*\}/g) || []).length * 3; // Graph patterns
    
    return score;
  }

  /**
   * Record suspicious activity
   */
  recordSuspiciousActivity(ip, activityType) {
    if (!this.suspiciousIPs.has(ip)) {
      this.suspiciousIPs.set(ip, {
        activities: [],
        firstSeen: Date.now(),
        lastSeen: Date.now(),
        count: 0
      });
    }
    
    const record = this.suspiciousIPs.get(ip);
    record.activities.push({
      type: activityType,
      timestamp: Date.now()
    });
    record.lastSeen = Date.now();
    record.count++;
    
    this.metrics.suspiciousActivity++;
    
    // Check if IP should be temporarily blocked
    if (record.count > 10) {
      this.emit('suspicious-ip', { ip, activities: record.activities.length });
    }
    
    this.emit('suspicious-activity', { ip, type: activityType });
  }

  /**
   * Check for suspicious validation errors
   */
  checkForSuspiciousValidationErrors(ip, errorTypes) {
    const suspiciousErrors = [
      'SQL injection detected',
      'Script injection detected',
      'Path traversal detected',
      'Command injection detected'
    ];
    
    const hasSuspiciousError = errorTypes.some(error => 
      suspiciousErrors.some(suspicious => error.includes(suspicious))
    );
    
    if (hasSuspiciousError) {
      this.recordSuspiciousActivity(ip, 'injection_attempt');
    }
  }

  /**
   * Security headers middleware
   */
  securityHeaders() {
    return (req, res, next) => {
      // Additional security headers beyond Helmet
      res.setHeader('X-API-Version', '2.0.8');
      res.setHeader('X-Rate-Limit-Policy', 'strict');
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Surrogate-Control', 'no-store');
      
      next();
    };
  }

  /**
   * Data sanitization
   */
  sanitizeInput(input, type = 'string') {
    if (input === null || input === undefined) {
      return input;
    }
    
    switch (type) {
      case 'string':
        return String(input).trim()
          .replace(/[<>'"&]/g, (match) => {
            const entities = { '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;', '&': '&amp;' };
            return entities[match];
          });
      
      case 'uri':
        try {
          new URL(input);
          return input;
        } catch {
          throw new Error('Invalid URI format');
        }
      
      case 'sparql':
        // Basic SPARQL sanitization
        return String(input).replace(/[\\]/g, '\\\\').replace(/["]/g, '\\"');
      
      default:
        return input;
    }
  }

  /**
   * Cleanup expired sessions
   */
  cleanupExpiredSessions() {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [token, session] of this.sessions.entries()) {
      if (session.expiresAt < now) {
        this.sessions.delete(token);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      consola.info(`🧹 Cleaned up ${cleaned} expired sessions`);
    }
  }

  /**
   * Cleanup blacklisted tokens
   */
  cleanupBlacklistedTokens() {
    // Keep blacklist size manageable (in production, use time-based cleanup)
    if (this.blacklistedTokens.size > 10000) {
      const tokensArray = Array.from(this.blacklistedTokens);
      const toKeep = tokensArray.slice(-5000); // Keep last 5000
      
      this.blacklistedTokens.clear();
      toKeep.forEach(token => this.blacklistedTokens.add(token));
      
      consola.info('🧹 Cleaned up blacklisted tokens');
    }
  }

  /**
   * Cleanup rate limit store
   */
  cleanupRateLimitStore() {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    
    for (const [key, data] of this.rateLimitStore.entries()) {
      if (data.resetTime < now - oneHour) {
        this.rateLimitStore.delete(key);
      }
    }
  }

  /**
   * Parse time string to milliseconds
   */
  parseTimeToMs(timeStr) {
    const units = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
    const match = timeStr.match(/(\d+)([smhd])/);
    
    if (!match) return 86400000; // Default 24h
    
    return parseInt(match[1]) * units[match[2]];
  }

  /**
   * Get security metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      activeSessions: this.sessions.size,
      blacklistedTokens: this.blacklistedTokens.size,
      suspiciousIPs: this.suspiciousIPs.size
    };
  }

  /**
   * Health check
   */
  async healthCheck() {
    return {
      status: this.status,
      metrics: this.getMetrics(),
      policies: {
        passwordPolicy: this.passwordPolicy,
        rateLimitPolicies: Object.keys(this.rateLimitPolicies)
      }
    };
  }

  /**
   * Shutdown security manager
   */
  async shutdown() {
    this.status = 'shutting-down';
    
    // Clear all stores
    this.sessions.clear();
    this.blacklistedTokens.clear();
    this.rateLimitStore.clear();
    this.suspiciousIPs.clear();
    
    this.removeAllListeners();
    this.status = 'shutdown';
    
    consola.info('🛑 Security Manager shutdown complete');
  }
}