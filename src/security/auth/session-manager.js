/**
 * Secure Session Management
 * Implements secure session handling with secure cookies and session fixation protection
 */

import { createHash, randomBytes, createHmac } from 'crypto';
import { SecurityEventType, SecuritySeverity } from '../types.js';

/**
 * Secure Session Manager
 * @class
 */
class SessionManager {
  /**
   * @param {Partial<SessionConfig>} [config={}] - Session configuration
   */
  constructor(config = {}) {
    /** @private @type {SessionConfig} */
    this.sessionConfig = {
      name: 'secure_session',
      secret: this.validateSessionSecret(),
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'strict',
      domain: undefined,
      path: '/',
      regenerateOnAuth: true,
      maxSessions: 5,
      idleTimeout: 30 * 60 * 1000, // 30 minutes
      absoluteTimeout: 8 * 60 * 60 * 1000, // 8 hours
      ...config
    }
    
    /** @private @type {Map<string, SessionData>} */
    this.sessions = new Map()
    /** @private @type {Map<string, CSRFToken>} */
    this.csrfTokens = new Map()
  }

  /**
   * Validate session secret configuration
   * @private
   * @returns {string}
   */
  validateSessionSecret() {
    const secret = process.env.SESSION_SECRET;
    
    if (!secret) {
      throw new Error('SESSION_SECRET environment variable is required and must be at least 32 characters');
    }

    if (secret.length < 32) {
      throw new Error('SESSION_SECRET must be at least 32 characters for security');
    }

    // Warn if using development-like secrets
    if (secret.includes('dev') || secret.includes('test') || secret.includes('example') || secret.includes('change-me')) {
      console.warn('WARNING: SESSION_SECRET appears to be a development secret. Use a cryptographically secure secret in production.');
    }

    return secret;
  }

  /**
   * Initialize session manager
   * @returns {Promise<void>}
   */
  async initialize() {
    // Start session cleanup interval
    this.startSessionCleanup()
    
    // Start CSRF token cleanup
    this.startCSRFCleanup()
  }

  /**
   * Create new session
   * @param {string} userId - User ID
   * @param {any} request - Request object
   * @returns {Promise<string>}
   */
  async createSession(userId, request) {
    // Check for existing sessions and enforce limits
    await this.enforceSessionLimits(userId)

    const sessionId = this.generateSessionId()
    const session = {
      id: sessionId,
      userId,
      createdAt: new Date(),
      lastAccessTime: new Date(),
      ipAddress: this.getClientIP(request),
      userAgent: request.headers['user-agent'] || '',
      data: {},
      isActive: true,
      csrfToken: this.generateCSRFToken(sessionId),
      fingerprint: this.generateFingerprint(request)
    }

    this.sessions.set(sessionId, session)

    await this.logSecurityEvent({
      type: SecurityEventType.AUTHENTICATION_FAILURE,
      severity: SecuritySeverity.LOW,
      source: session.ipAddress,
      description: `Session created for user ${userId}`,
      metadata: { sessionId, userId }
    })

    return sessionId
  }

  /**
   * Validate and retrieve session
   * @param {string} sessionId - Session ID
   * @param {any} request - Request object
   * @returns {Promise<SessionValidationResult>}
   */
  async validateSession(sessionId, request) {
    const session = this.sessions.get(sessionId)
    
    if (!session) {
      return { isValid: false, reason: 'session_not_found' }
    }

    if (!session.isActive) {
      return { isValid: false, reason: 'session_inactive' }
    }

    // Check idle timeout
    const now = new Date()
    const idleTime = now.getTime() - session.lastAccessTime.getTime()
    if (idleTime > this.sessionConfig.idleTimeout) {
      await this.destroySession(sessionId)
      return { isValid: false, reason: 'session_expired' }
    }

    // Check absolute timeout
    const absoluteTime = now.getTime() - session.createdAt.getTime()
    if (absoluteTime > this.sessionConfig.absoluteTimeout) {
      await this.destroySession(sessionId)
      return { isValid: false, reason: 'session_expired' }
    }

    // Validate session fingerprint
    const currentFingerprint = this.generateFingerprint(request)
    if (session.fingerprint !== currentFingerprint) {
      await this.destroySession(sessionId)
      await this.logSecurityEvent({
        type: SecurityEventType.SUSPICIOUS_REQUEST,
        severity: SecuritySeverity.HIGH,
        source: this.getClientIP(request),
        description: 'Session fingerprint mismatch - possible session hijacking',
        metadata: { 
          sessionId, 
          userId: session.userId,
          originalFingerprint: session.fingerprint,
          currentFingerprint
        }
      })
      return { isValid: false, reason: 'fingerprint_mismatch' }
    }

    // Validate IP address (optional - can be configured)
    const currentIP = this.getClientIP(request)
    if (session.ipAddress !== currentIP) {
      await this.logSecurityEvent({
        type: SecurityEventType.SUSPICIOUS_REQUEST,
        severity: SecuritySeverity.MEDIUM,
        source: currentIP,
        description: 'Session IP address changed',
        metadata: { 
          sessionId, 
          userId: session.userId,
          originalIP: session.ipAddress,
          currentIP
        }
      })
      
      // For strict security, uncomment to invalidate session on IP change
      // await this.destroySession(sessionId)
      // return { isValid: false, reason: 'ip_mismatch' }
    }

    // Update last access time
    session.lastAccessTime = now

    return {
      isValid: true,
      session: session,
      csrfToken: session.csrfToken
    }
  }

  /**
   * Regenerate session ID (prevent session fixation)
   * @param {string} oldSessionId - Old session ID
   * @returns {Promise<string|null>}
   */
  async regenerateSession(oldSessionId) {
    const oldSession = this.sessions.get(oldSessionId)
    if (!oldSession) return null

    // Create new session with same data
    const newSessionId = this.generateSessionId()
    const newSession = {
      ...oldSession,
      id: newSessionId,
      createdAt: new Date(),
      lastAccessTime: new Date(),
      csrfToken: this.generateCSRFToken(newSessionId)
    }

    // Replace old session with new one
    this.sessions.delete(oldSessionId)
    this.sessions.set(newSessionId, newSession)

    await this.logSecurityEvent({
      type: SecurityEventType.CONFIGURATION_CHANGE,
      severity: SecuritySeverity.LOW,
      source: oldSession.ipAddress,
      description: 'Session ID regenerated',
      metadata: { oldSessionId, newSessionId, userId: oldSession.userId }
    })

    return newSessionId
  }

  /**
   * Destroy session
   * @param {string} sessionId - Session ID
   * @returns {Promise<boolean>}
   */
  async destroySession(sessionId) {
    const session = this.sessions.get(sessionId)
    if (!session) return false

    this.sessions.delete(sessionId)

    // Clean up CSRF token
    this.csrfTokens.delete(session.csrfToken)

    await this.logSecurityEvent({
      type: SecurityEventType.AUTHENTICATION_FAILURE,
      severity: SecuritySeverity.LOW,
      source: session.ipAddress,
      description: `Session destroyed for user ${session.userId}`,
      metadata: { sessionId, userId: session.userId }
    })

    return true
  }

  /**
   * Destroy all sessions for a user
   * @param {string} userId - User ID
   * @returns {Promise<number>}
   */
  async destroyAllUserSessions(userId) {
    let destroyedCount = 0
    
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.userId === userId) {
        await this.destroySession(sessionId)
        destroyedCount++
      }
    }

    return destroyedCount
  }

  /**
   * Set session data
   * @param {string} sessionId - Session ID
   * @param {string} key - Data key
   * @param {any} value - Data value
   * @returns {boolean}
   */
  setSessionData(sessionId, key, value) {
    const session = this.sessions.get(sessionId)
    if (!session) return false

    session.data[key] = value
    session.lastAccessTime = new Date()
    return true
  }

  /**
   * Get session data
   * @param {string} sessionId - Session ID
   * @param {string} [key] - Optional specific key
   * @returns {any}
   */
  getSessionData(sessionId, key) {
    const session = this.sessions.get(sessionId)
    if (!session) return null

    if (key) {
      return session.data[key]
    }
    
    return session.data
  }

  /**
   * Generate secure cookie options
   * @returns {any}
   */
  getCookieOptions() {
    return {
      maxAge: this.sessionConfig.maxAge,
      secure: this.sessionConfig.secure,
      httpOnly: this.sessionConfig.httpOnly,
      sameSite: this.sessionConfig.sameSite,
      domain: this.sessionConfig.domain,
      path: this.sessionConfig.path
    }
  }

  /**
   * Validate CSRF token
   * @param {string} sessionId - Session ID
   * @param {string} token - CSRF token
   * @returns {boolean}
   */
  validateCSRFToken(sessionId, token) {
    const session = this.sessions.get(sessionId)
    if (!session) return false

    return session.csrfToken === token
  }

  /**
   * Generate session ID
   * @private
   * @returns {string}
   */
  generateSessionId() {
    return randomBytes(32).toString('hex')
  }

  /**
   * Generate CSRF token
   * @private
   * @param {string} sessionId - Session ID
   * @returns {string}
   */
  generateCSRFToken(sessionId) {
    const token = randomBytes(32).toString('hex')
    
    this.csrfTokens.set(token, {
      sessionId,
      token,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + this.sessionConfig.maxAge)
    })
    
    return token
  }

  /**
   * Generate session fingerprint
   * @private
   * @param {any} request - Request object
   * @returns {string}
   */
  generateFingerprint(request) {
    const components = [
      request.headers['user-agent'] || '',
      request.headers['accept-language'] || '',
      request.headers['accept-encoding'] || '',
      request.headers['accept'] || ''
    ].join('|')

    return createHash('sha256').update(components).digest('hex')
  }

  /**
   * Get client IP address
   * @private
   * @param {any} request - Request object
   * @returns {string}
   */
  getClientIP(request) {
    return request.headers['x-forwarded-for']?.split(',')[0] ||
           request.headers['x-real-ip'] ||
           request.connection?.remoteAddress ||
           request.socket?.remoteAddress ||
           'unknown'
  }

  /**
   * Enforce session limits per user
   * @private
   * @param {string} userId - User ID
   * @returns {Promise<void>}
   */
  async enforceSessionLimits(userId) {
    const userSessions = Array.from(this.sessions.values())
      .filter(session => session.userId === userId && session.isActive)
      .sort((a, b) => a.lastAccessTime.getTime() - b.lastAccessTime.getTime())

    if (userSessions.length >= this.sessionConfig.maxSessions) {
      // Remove oldest sessions
      const sessionsToRemove = userSessions.slice(0, userSessions.length - this.sessionConfig.maxSessions + 1)
      
      for (const session of sessionsToRemove) {
        await this.destroySession(session.id)
      }
    }
  }

  /**
   * Start session cleanup interval
   * @private
   */
  startSessionCleanup() {
    setInterval(() => {
      this.cleanupExpiredSessions()
    }, 5 * 60 * 1000) // Every 5 minutes
  }

  /**
   * Cleanup expired sessions
   * @private
   */
  cleanupExpiredSessions() {
    const now = new Date()
    const expiredSessions = []

    for (const [sessionId, session] of this.sessions.entries()) {
      const idleTime = now.getTime() - session.lastAccessTime.getTime()
      const absoluteTime = now.getTime() - session.createdAt.getTime()

      if (idleTime > this.sessionConfig.idleTimeout || 
          absoluteTime > this.sessionConfig.absoluteTimeout) {
        expiredSessions.push(sessionId)
      }
    }

    for (const sessionId of expiredSessions) {
      this.destroySession(sessionId)
    }

    if (expiredSessions.length > 0) {
      console.log(`Cleaned up ${expiredSessions.length} expired sessions`)
    }
  }

  /**
   * Start CSRF token cleanup
   * @private
   */
  startCSRFCleanup() {
    setInterval(() => {
      this.cleanupExpiredCSRFTokens()
    }, 10 * 60 * 1000) // Every 10 minutes
  }

  /**
   * Cleanup expired CSRF tokens
   * @private
   */
  cleanupExpiredCSRFTokens() {
    const now = new Date()
    const expiredTokens = []

    for (const [token, csrfData] of this.csrfTokens.entries()) {
      if (csrfData.expiresAt < now) {
        expiredTokens.push(token)
      }
    }

    for (const token of expiredTokens) {
      this.csrfTokens.delete(token)
    }
  }

  /**
   * Get session statistics
   * @returns {SessionStatistics}
   */
  getStatistics() {
    const now = new Date()
    const sessions = Array.from(this.sessions.values())
    
    return {
      totalSessions: sessions.length,
      activeSessions: sessions.filter(s => s.isActive).length,
      expiredSessions: sessions.filter(s => {
        const idleTime = now.getTime() - s.lastAccessTime.getTime()
        return idleTime > this.sessionConfig.idleTimeout
      }).length,
      uniqueUsers: new Set(sessions.map(s => s.userId)).size,
      csrfTokens: this.csrfTokens.size
    }
  }

  /**
   * Get session health
   * @returns {Promise<any>}
   */
  async getHealth() {
    const stats = this.getStatistics()
    
    return {
      sessionConfig: {
        maxAge: this.sessionConfig.maxAge,
        secure: this.sessionConfig.secure,
        httpOnly: this.sessionConfig.httpOnly,
        sameSite: this.sessionConfig.sameSite,
        maxSessions: this.sessionConfig.maxSessions
      },
      statistics: stats,
      memoryUsage: {
        sessions: this.sessions.size,
        csrfTokens: this.csrfTokens.size
      }
    }
  }

  /**
   * Log security event
   * @private
   * @param {Omit<SecurityEvent, 'id' | 'timestamp'>} event - Event data
   * @returns {Promise<void>}
   */
  async logSecurityEvent(event) {
    // Implementation would send to centralized logging
    console.warn(`Session Security Event: ${event.type} - ${event.description}`)
  }
}

export { SessionManager };

/**
 * @typedef {Object} SessionConfig
 * @property {string} name
 * @property {string} secret
 * @property {number} maxAge
 * @property {boolean} secure
 * @property {boolean} httpOnly
 * @property {'strict'|'lax'|'none'} sameSite
 * @property {string} [domain]
 * @property {string} path
 * @property {boolean} regenerateOnAuth
 * @property {number} maxSessions
 * @property {number} idleTimeout
 * @property {number} absoluteTimeout
 */

/**
 * @typedef {Object} SessionData
 * @property {string} id
 * @property {string} userId
 * @property {Date} createdAt
 * @property {Date} lastAccessTime
 * @property {string} ipAddress
 * @property {string} userAgent
 * @property {Record<string, any>} data
 * @property {boolean} isActive
 * @property {string} csrfToken
 * @property {string} fingerprint
 */

/**
 * @typedef {Object} SessionValidationResult
 * @property {boolean} isValid
 * @property {string} [reason]
 * @property {SessionData} [session]
 * @property {string} [csrfToken]
 */

/**
 * @typedef {Object} CSRFToken
 * @property {string} sessionId
 * @property {string} token
 * @property {Date} createdAt
 * @property {Date} expiresAt
 */

/**
 * @typedef {Object} SessionStatistics
 * @property {number} totalSessions
 * @property {number} activeSessions
 * @property {number} expiredSessions
 * @property {number} uniqueUsers
 * @property {number} csrfTokens
 */

/**
 * @typedef {Object} SecurityEvent
 * @property {string} id
 * @property {Date} timestamp
 * @property {string} type
 * @property {string} severity
 * @property {string} source
 * @property {string} description
 * @property {Record<string, any>} metadata
 */