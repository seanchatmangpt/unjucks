/**
 * Core Security Manager
 * 
 * Enhanced version of the original security manager with enterprise features,
 * better integration, and advanced threat detection capabilities.
 */

import { EventEmitter } from 'events';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import consola from 'consola';

export class SecurityManager extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      // JWT Configuration
      jwt: {
        secret: config.jwt?.secret || process.env.KGEN_JWT_SECRET || crypto.randomBytes(64).toString('hex'),
        expiresIn: '24h',
        issuer: 'kgen-security',
        audience: 'kgen-api',
        algorithm: 'HS256'
      },
      
      // Password Policy
      passwordPolicy: {
        minLength: 12,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSpecialChars: true,
        maxAge: 90 * 24 * 60 * 60 * 1000, // 90 days
        preventReuse: 10,
        lockoutThreshold: 5,
        lockoutDuration: 30 * 60 * 1000 // 30 minutes
      },
      
      // Session Management
      session: {
        timeout: 3600000, // 1 hour
        maxConcurrentSessions: 5,
        requireReauthentication: true
      },
      
      // Rate Limiting
      rateLimiting: {
        enabled: true,
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxRequests: 100,
        authWindowMs: 15 * 60 * 1000,
        maxAuthAttempts: 5
      },
      
      // Security Features
      features: {
        enableMFA: false,
        enableSessionRotation: true,
        enableThreatDetection: true,
        enableIPWhitelisting: false,
        enableDeviceFingerprinting: false
      },
      
      // Enterprise Integration
      enterprise: {
        enableSSO: false,
        enableLDAP: false,
        enableActiveDirectory: false,
        enableSAML: false
      },
      
      ...config
    };
    
    this.logger = consola.withTag('security-manager');
    this.status = 'uninitialized';
    
    // Security state
    this.sessions = new Map();
    this.blacklistedTokens = new Set();
    this.failedAttempts = new Map();
    this.suspiciousActivity = new Map();
    this.deviceFingerprints = new Map();
    this.securityEvents = [];
    
    // Security metrics
    this.metrics = {
      authAttempts: 0,
      authSuccesses: 0,
      authFailures: 0,
      sessionsCreated: 0,
      sessionsTerminated: 0,
      threatsDetected: 0,
      suspiciousActivities: 0,
      tokenBlacklisted: 0
    };
  }

  /**
   * Initialize security manager
   */
  async initialize() {
    try {
      this.logger.info('Initializing security manager...');
      this.status = 'initializing';
      
      // Validate configuration
      this._validateConfiguration();
      
      // Setup security policies
      this._setupSecurityPolicies();
      
      // Initialize threat detection
      if (this.config.features.enableThreatDetection) {
        this._initializeThreatDetection();
      }
      
      // Setup cleanup tasks
      this._setupCleanupTasks();
      
      // Setup security monitoring
      this._setupSecurityMonitoring();
      
      this.status = 'ready';
      this.logger.success('Security manager initialized successfully');
      
      this.emit('security:initialized', {
        timestamp: new Date(),
        config: this._getSafeConfig()
      });
      
      return { status: 'success', features: this.config.features };
      
    } catch (error) {
      this.status = 'error';
      this.logger.error('Security manager initialization failed:', error);
      throw error;
    }
  }

  /**
   * Authenticate user with enhanced security
   */
  async authenticate(credentials, context = {}) {
    try {
      this.metrics.authAttempts++;
      
      this.logger.info(`Authentication attempt for: ${credentials.username || credentials.email}`);
      
      const userId = credentials.username || credentials.email;
      const clientInfo = {
        ip: context.ip,
        userAgent: context.userAgent,
        deviceFingerprint: context.deviceFingerprint
      };
      
      // Check for account lockout
      if (this._isAccountLocked(userId)) {
        this.metrics.authFailures++;
        await this._recordSecurityEvent('auth_blocked_lockout', { userId, ...clientInfo });
        throw new Error('Account temporarily locked due to repeated failed attempts');
      }
      
      // Check for suspicious activity
      if (this._isSuspiciousActivity(userId, clientInfo)) {
        this.metrics.suspiciousActivities++;
        await this._recordSecurityEvent('auth_suspicious_activity', { userId, ...clientInfo });
        
        if (this.config.features.enableThreatDetection) {
          // Additional verification required
          throw new Error('Additional verification required due to suspicious activity');
        }
      }
      
      // Validate credentials
      const user = await this._validateCredentials(credentials);
      if (!user) {
        await this._recordFailedAttempt(userId, clientInfo);
        this.metrics.authFailures++;
        throw new Error('Invalid credentials');
      }
      
      // Check user status and security requirements
      await this._validateUserSecurity(user, context);
      
      // Device fingerprinting
      if (this.config.features.enableDeviceFingerprinting) {
        await this._validateDeviceFingerprint(user, clientInfo);
      }
      
      // Multi-factor authentication
      if (this.config.features.enableMFA && user.mfaEnabled) {
        await this._validateMFA(user, credentials.mfaToken);
      }
      
      // Create secure session
      const authResult = await this._createSecureSession(user, clientInfo);
      
      // Clear failed attempts
      this.failedAttempts.delete(userId);
      this.metrics.authSuccesses++;
      
      await this._recordSecurityEvent('auth_success', {
        userId: user.id,
        sessionId: authResult.sessionId,
        ...clientInfo
      });
      
      this.logger.success(`User authenticated successfully: ${user.id}`);
      
      return authResult;
      
    } catch (error) {
      this.logger.error('Authentication failed:', error);
      throw error;
    }
  }

  /**
   * Authorize user access with enhanced RBAC
   */
  async authorize(user, resource, operation, context = {}) {
    try {
      this.logger.info(`Authorization check: ${user.id} -> ${operation} on ${resource.type}/${resource.id}`);
      
      // Validate session
      const session = this.sessions.get(user.sessionId);
      if (!session || this._isSessionExpired(session)) {
        throw new Error('Session expired or invalid');
      }
      
      // Check if session requires rotation
      if (this.config.features.enableSessionRotation && this._shouldRotateSession(session)) {
        await this._rotateSession(session);
      }
      
      // Create authorization context
      const authContext = {
        user,
        resource,
        operation,
        session,
        clientInfo: context.clientInfo || {},
        timestamp: new Date()
      };
      
      // Role-based authorization
      const rbacResult = await this._checkRBACAuthorization(authContext);
      if (!rbacResult.authorized) {
        await this._recordSecurityEvent('auth_denied_rbac', {
          userId: user.id,
          resource: resource.type,
          operation,
          reason: rbacResult.reason
        });
        return { authorized: false, reason: rbacResult.reason };
      }
      
      // Attribute-based authorization (if configured)
      if (this.config.features.enableABAC) {
        const abacResult = await this._checkABACAuthorization(authContext);
        if (!abacResult.authorized) {
          await this._recordSecurityEvent('auth_denied_abac', {
            userId: user.id,
            resource: resource.type,
            operation,
            reason: abacResult.reason
          });
          return { authorized: false, reason: abacResult.reason };
        }
      }
      
      // Time-based access control
      const timeBasedResult = await this._checkTimeBasedAccess(authContext);
      if (!timeBasedResult.authorized) {
        await this._recordSecurityEvent('auth_denied_time', {
          userId: user.id,
          resource: resource.type,
          operation,
          reason: timeBasedResult.reason
        });
        return { authorized: false, reason: timeBasedResult.reason };
      }
      
      // Update session activity
      this._updateSessionActivity(session);
      
      await this._recordSecurityEvent('auth_granted', {
        userId: user.id,
        resource: resource.type,
        operation,
        sessionId: session.sessionId
      });
      
      return {
        authorized: true,
        permissions: rbacResult.permissions,
        restrictions: rbacResult.restrictions
      };
      
    } catch (error) {
      this.logger.error('Authorization failed:', error);
      throw error;
    }
  }

  /**
   * Generate secure JWT token with enhanced claims
   */
  generateToken(payload, options = {}) {
    try {
      const now = Math.floor(Date.now() / 1000);
      
      const tokenPayload = {
        ...payload,
        iat: now,
        jti: crypto.randomUUID(), // Unique token ID
        sessionId: payload.sessionId
      };
      
      const tokenOptions = {
        expiresIn: options.expiresIn || this.config.jwt.expiresIn,
        issuer: this.config.jwt.issuer,
        audience: this.config.jwt.audience,
        algorithm: this.config.jwt.algorithm
      };
      
      const token = jwt.sign(tokenPayload, this.config.jwt.secret, tokenOptions);
      
      // Store token metadata
      this.sessions.set(token, {
        tokenId: tokenPayload.jti,
        sessionId: payload.sessionId,
        userId: payload.userId || payload.sub,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + this._parseTimeToMs(tokenOptions.expiresIn)),
        lastUsed: new Date()
      });
      
      return token;
      
    } catch (error) {
      this.logger.error('Token generation failed:', error);
      throw error;
    }
  }

  /**
   * Verify JWT token with enhanced validation
   */
  verifyToken(token, options = {}) {
    try {
      // Check blacklist
      if (this.blacklistedTokens.has(token)) {
        throw new Error('Token has been revoked');
      }
      
      // Verify JWT
      const decoded = jwt.verify(token, this.config.jwt.secret, {
        issuer: this.config.jwt.issuer,
        audience: this.config.jwt.audience,
        algorithms: [this.config.jwt.algorithm]
      });
      
      // Additional security checks
      const session = this.sessions.get(token);
      if (!session) {
        throw new Error('Token session not found');
      }
      
      if (this._isSessionExpired(session)) {
        this.sessions.delete(token);
        throw new Error('Token session expired');
      }
      
      // Update last used
      session.lastUsed = new Date();
      
      return decoded;
      
    } catch (error) {
      this.logger.error('Token verification failed:', error);
      throw error;
    }
  }

  /**
   * Revoke token and blacklist
   */
  revokeToken(token, reason = 'user_logout') {
    try {
      this.blacklistedTokens.add(token);
      this.sessions.delete(token);
      this.metrics.tokenBlacklisted++;
      
      this._recordSecurityEvent('token_revoked', {
        tokenId: token.substring(0, 10) + '...',
        reason,
        timestamp: new Date()
      });
      
      this.logger.info(`Token revoked: ${reason}`);
      
    } catch (error) {
      this.logger.error('Token revocation failed:', error);
      throw error;
    }
  }

  /**
   * Terminate session
   */
  async terminateSession(sessionId, reason = 'user_logout') {
    try {
      const session = this.sessions.get(sessionId);
      if (session) {
        // Revoke associated tokens
        for (const [token, tokenSession] of this.sessions.entries()) {
          if (tokenSession.sessionId === sessionId) {
            this.revokeToken(token, reason);
          }
        }
        
        this.metrics.sessionsTerminated++;
        
        await this._recordSecurityEvent('session_terminated', {
          sessionId,
          reason,
          timestamp: new Date()
        });
      }
      
    } catch (error) {
      this.logger.error('Session termination failed:', error);
      throw error;
    }
  }

  /**
   * Get security metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      activeSessions: this.sessions.size,
      blacklistedTokens: this.blacklistedTokens.size,
      suspiciousIPs: this.suspiciousActivity.size,
      recentEvents: this.securityEvents.slice(-10)
    };
  }

  /**
   * Get security status
   */
  getStatus() {
    return {
      status: this.status,
      metrics: this.getMetrics(),
      configuration: this._getSafeConfig(),
      features: this.config.features
    };
  }

  /**
   * Shutdown security manager
   */
  async shutdown() {
    try {
      this.logger.info('Shutting down security manager...');
      this.status = 'shutting-down';
      
      // Clear intervals
      if (this.cleanupInterval) clearInterval(this.cleanupInterval);
      if (this.monitoringInterval) clearInterval(this.monitoringInterval);
      
      // Clear sensitive data
      this.sessions.clear();
      this.blacklistedTokens.clear();
      this.failedAttempts.clear();
      this.suspiciousActivity.clear();
      this.deviceFingerprints.clear();
      this.securityEvents = [];
      
      this.removeAllListeners();
      this.status = 'shutdown';
      
      this.logger.success('Security manager shutdown completed');
      
    } catch (error) {
      this.logger.error('Security manager shutdown failed:', error);
      throw error;
    }
  }

  // Private methods

  _validateConfiguration() {
    if (!this.config.jwt?.secret || this.config.jwt.secret.length < 32) {
      throw new Error('JWT secret must be at least 32 characters long');
    }
    
    if (process.env.NODE_ENV === 'production' && 
        this.config.jwt.secret === 'your-super-secret-jwt-key-change-in-production') {
      throw new Error('Default JWT secret detected in production');
    }
  }

  _setupSecurityPolicies() {
    this.logger.info('Setting up security policies');
    // Security policies are now configured via config
  }

  _initializeThreatDetection() {
    this.logger.info('Initializing threat detection system');
    this.threatDetection = {
      enabled: true,
      patterns: {
        bruteForce: { threshold: 10, window: 300000 }, // 10 attempts in 5 minutes
        suspiciousIP: { threshold: 5, window: 900000 }, // 5 failures in 15 minutes
        rapidRequests: { threshold: 100, window: 60000 } // 100 requests in 1 minute
      }
    };
  }

  _setupCleanupTasks() {
    this.cleanupInterval = setInterval(() => {
      this._cleanupExpiredSessions();
      this._cleanupBlacklistedTokens();
      this._cleanupSecurityEvents();
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  _setupSecurityMonitoring() {
    this.monitoringInterval = setInterval(() => {
      this._monitorSecurityMetrics();
    }, 30 * 1000); // Every 30 seconds
  }

  _isAccountLocked(userId) {
    const attempts = this.failedAttempts.get(userId);
    if (!attempts) return false;
    
    return attempts.count >= this.config.passwordPolicy.lockoutThreshold &&
           (Date.now() - attempts.lastAttempt) < this.config.passwordPolicy.lockoutDuration;
  }

  _isSuspiciousActivity(userId, clientInfo) {
    // Check for suspicious patterns
    const userActivity = this.suspiciousActivity.get(userId) || [];
    
    // Check for rapid location changes
    if (clientInfo.ip && userActivity.length > 0) {
      const lastActivity = userActivity[userActivity.length - 1];
      if (lastActivity.ip !== clientInfo.ip && 
          (Date.now() - lastActivity.timestamp) < 60000) { // 1 minute
        return true;
      }
    }
    
    // Check for unusual user agent changes
    if (clientInfo.userAgent && userActivity.length > 0) {
      const lastActivity = userActivity[userActivity.length - 1];
      if (lastActivity.userAgent !== clientInfo.userAgent &&
          (Date.now() - lastActivity.timestamp) < 300000) { // 5 minutes
        return true;
      }
    }
    
    return false;
  }

  async _validateCredentials(credentials) {
    // This is a placeholder - implement actual credential validation
    // against your user database
    if (credentials.username === 'admin' && 
        await bcrypt.compare(credentials.password, '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj5bxbw8DvI6')) {
      return {
        id: 'admin',
        username: 'admin',
        email: 'admin@kgen.local',
        roles: ['admin'],
        permissions: ['*'],
        status: 'active',
        mfaEnabled: false,
        clearanceLevel: 'RESTRICTED'
      };
    }
    
    return null;
  }

  async _validateUserSecurity(user, context) {
    // Check user status
    if (user.status !== 'active') {
      throw new Error(`User account is ${user.status}`);
    }
    
    // Check password age (if applicable)
    if (user.passwordAge && user.passwordAge > this.config.passwordPolicy.maxAge) {
      throw new Error('Password has expired and must be changed');
    }
    
    // Check for concurrent session limits
    const userSessions = Array.from(this.sessions.values())
      .filter(session => session.userId === user.id);
    
    if (userSessions.length >= this.config.session.maxConcurrentSessions) {
      throw new Error('Maximum concurrent sessions exceeded');
    }
  }

  async _validateDeviceFingerprint(user, clientInfo) {
    if (!clientInfo.deviceFingerprint) return;
    
    const knownDevices = this.deviceFingerprints.get(user.id) || [];
    const isKnownDevice = knownDevices.some(device => 
      device.fingerprint === clientInfo.deviceFingerprint
    );
    
    if (!isKnownDevice) {
      // New device - require additional verification
      this.logger.warn(`New device detected for user ${user.id}`);
      
      // Store device fingerprint
      knownDevices.push({
        fingerprint: clientInfo.deviceFingerprint,
        firstSeen: new Date(),
        ip: clientInfo.ip,
        userAgent: clientInfo.userAgent
      });
      this.deviceFingerprints.set(user.id, knownDevices);
      
      // For now, just log - in production, might require email verification
    }
  }

  async _validateMFA(user, mfaToken) {
    if (!mfaToken) {
      throw new Error('MFA token required');
    }
    
    // Placeholder MFA validation - implement TOTP/SMS/etc.
    if (mfaToken !== '123456') {
      throw new Error('Invalid MFA token');
    }
  }

  async _createSecureSession(user, clientInfo) {
    const sessionId = crypto.randomUUID();
    const session = {
      sessionId,
      userId: user.id,
      user: { ...user, password: undefined }, // Don't store password in session
      createdAt: new Date(),
      lastActivity: new Date(),
      expiresAt: new Date(Date.now() + this.config.session.timeout),
      clientInfo,
      securityLevel: user.clearanceLevel || 'INTERNAL'
    };
    
    this.sessions.set(sessionId, session);
    this.metrics.sessionsCreated++;
    
    // Generate access token
    const token = this.generateToken({
      userId: user.id,
      sessionId,
      roles: user.roles,
      permissions: user.permissions
    });
    
    return {
      sessionId,
      token,
      user: session.user,
      expiresAt: session.expiresAt
    };
  }

  _isSessionExpired(session) {
    return Date.now() > session.expiresAt.getTime();
  }

  _shouldRotateSession(session) {
    // Rotate session every hour
    const rotationInterval = 60 * 60 * 1000; // 1 hour
    return (Date.now() - session.createdAt.getTime()) > rotationInterval;
  }

  async _rotateSession(session) {
    // Create new session with same user
    const newSession = await this._createSecureSession(session.user, session.clientInfo);
    
    // Revoke old session
    await this.terminateSession(session.sessionId, 'session_rotation');
    
    return newSession;
  }

  async _checkRBACAuthorization(authContext) {
    const { user, resource, operation } = authContext;
    
    // Check if user has required role/permission
    const hasPermission = user.permissions?.includes('*') ||
                         user.permissions?.includes(operation) ||
                         user.permissions?.includes(`${resource.type}:${operation}`);
    
    if (!hasPermission) {
      return {
        authorized: false,
        reason: 'Insufficient permissions',
        permissions: user.permissions
      };
    }
    
    return {
      authorized: true,
      permissions: user.permissions,
      restrictions: this._getResourceRestrictions(user, resource)
    };
  }

  async _checkABACAuthorization(authContext) {
    // Placeholder for Attribute-Based Access Control
    return { authorized: true, reason: 'ABAC authorized' };
  }

  async _checkTimeBasedAccess(authContext) {
    const { user, operation } = authContext;
    
    // Check if operation is allowed at current time
    const now = new Date();
    const hour = now.getHours();
    
    // Example: Restrict sensitive operations during non-business hours
    const sensitiveOperations = ['delete', 'modify', 'export'];
    if (sensitiveOperations.includes(operation) && (hour < 6 || hour > 22)) {
      return {
        authorized: false,
        reason: 'Operation not allowed outside business hours'
      };
    }
    
    return { authorized: true };
  }

  _getResourceRestrictions(user, resource) {
    // Define restrictions based on user clearance level
    const restrictions = [];
    
    if (resource.classification === 'RESTRICTED' && user.clearanceLevel !== 'RESTRICTED') {
      restrictions.push('read_only');
    }
    
    return restrictions;
  }

  _updateSessionActivity(session) {
    session.lastActivity = new Date();
  }

  async _recordFailedAttempt(userId, clientInfo) {
    const attempts = this.failedAttempts.get(userId) || { count: 0, attempts: [] };
    attempts.count++;
    attempts.lastAttempt = Date.now();
    attempts.attempts.push({
      timestamp: Date.now(),
      ip: clientInfo.ip,
      userAgent: clientInfo.userAgent
    });
    
    this.failedAttempts.set(userId, attempts);
    
    await this._recordSecurityEvent('auth_failed', {
      userId,
      attemptCount: attempts.count,
      ...clientInfo
    });
  }

  async _recordSecurityEvent(eventType, eventData) {
    const event = {
      type: eventType,
      timestamp: new Date(),
      data: eventData
    };
    
    this.securityEvents.push(event);
    
    // Keep only last 1000 events
    if (this.securityEvents.length > 1000) {
      this.securityEvents = this.securityEvents.slice(-1000);
    }
    
    this.emit('security:event', event);
  }

  _cleanupExpiredSessions() {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [sessionId, session] of this.sessions.entries()) {
      if (this._isSessionExpired(session)) {
        this.sessions.delete(sessionId);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      this.logger.info(`Cleaned up ${cleaned} expired sessions`);
    }
  }

  _cleanupBlacklistedTokens() {
    // Keep blacklist manageable
    if (this.blacklistedTokens.size > 10000) {
      const tokensArray = Array.from(this.blacklistedTokens);
      const toKeep = tokensArray.slice(-5000);
      
      this.blacklistedTokens.clear();
      toKeep.forEach(token => this.blacklistedTokens.add(token));
      
      this.logger.info('Cleaned up blacklisted tokens');
    }
  }

  _cleanupSecurityEvents() {
    // Keep only events from last 24 hours
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    this.securityEvents = this.securityEvents.filter(
      event => event.timestamp.getTime() > oneDayAgo
    );
  }

  _monitorSecurityMetrics() {
    // Check for security anomalies
    const recentEvents = this.securityEvents.filter(
      event => event.timestamp.getTime() > Date.now() - 300000 // Last 5 minutes
    );
    
    const failedAuths = recentEvents.filter(event => event.type === 'auth_failed').length;
    if (failedAuths > 10) {
      this.metrics.threatsDetected++;
      this.emit('security:threat_detected', {
        type: 'high_failure_rate',
        count: failedAuths,
        timestamp: new Date()
      });
    }
  }

  _parseTimeToMs(timeStr) {
    const units = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
    const match = timeStr.match(/(\d+)([smhd])/);
    
    if (!match) return 86400000; // Default 24h
    
    return parseInt(match[1]) * units[match[2]];
  }

  _getSafeConfig() {
    return {
      passwordPolicy: this.config.passwordPolicy,
      features: this.config.features,
      enterprise: this.config.enterprise,
      rateLimiting: this.config.rateLimiting
    };
  }
}

export default SecurityManager;