/**
 * Secure Session Management
 * Implements secure session handling with secure cookies and session fixation protection
 */

import { createHash, randomBytes, createHmac } from 'crypto'
import { SecurityEvent, SecurityEventType, SecuritySeverity } from '../types'

export class SessionManager {
  private sessions = new Map<string, SessionData>()
  private sessionConfig: SessionConfig
  private csrfTokens = new Map<string, CSRFToken>()

  constructor(config: Partial<SessionConfig> = {}) {
    this.sessionConfig = {
      name: 'secure_session',
      secret: process.env.SESSION_SECRET || 'change-me-in-production',
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
  }

  async initialize(): Promise<void> {
    // Start session cleanup interval
    this.startSessionCleanup()
    
    // Start CSRF token cleanup
    this.startCSRFCleanup()
  }

  /**
   * Create new session
   */
  async createSession(userId: string, request: any): Promise<string> {
    // Check for existing sessions and enforce limits
    await this.enforceSessionLimits(userId)

    const sessionId = this.generateSessionId()
    const session: SessionData = {
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
   */
  async validateSession(sessionId: string, request: any): Promise<SessionValidationResult> {
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
   */
  async regenerateSession(oldSessionId: string): Promise<string | null> {
    const oldSession = this.sessions.get(oldSessionId)
    if (!oldSession) return null

    // Create new session with same data
    const newSessionId = this.generateSessionId()
    const newSession: SessionData = {
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
   */
  async destroySession(sessionId: string): Promise<boolean> {
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
   */
  async destroyAllUserSessions(userId: string): Promise<number> {
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
   */
  setSessionData(sessionId: string, key: string, value: any): boolean {
    const session = this.sessions.get(sessionId)
    if (!session) return false

    session.data[key] = value
    session.lastAccessTime = new Date()
    return true
  }

  /**
   * Get session data
   */
  getSessionData(sessionId: string, key?: string): any {
    const session = this.sessions.get(sessionId)
    if (!session) return null

    if (key) {
      return session.data[key]
    }
    
    return session.data
  }

  /**
   * Generate secure cookie options
   */
  getCookieOptions(): any {
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
   */
  validateCSRFToken(sessionId: string, token: string): boolean {
    const session = this.sessions.get(sessionId)
    if (!session) return false

    return session.csrfToken === token
  }

  /**
   * Generate session ID
   */
  private generateSessionId(): string {
    return randomBytes(32).toString('hex')
  }

  /**
   * Generate CSRF token
   */
  private generateCSRFToken(sessionId: string): string {
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
   */
  private generateFingerprint(request: any): string {
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
   */
  private getClientIP(request: any): string {
    return request.headers['x-forwarded-for']?.split(',')[0] ||
           request.headers['x-real-ip'] ||
           request.connection?.remoteAddress ||
           request.socket?.remoteAddress ||
           'unknown'
  }

  /**
   * Enforce session limits per user
   */
  private async enforceSessionLimits(userId: string): Promise<void> {
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
   */
  private startSessionCleanup(): void {
    setInterval(() => {
      this.cleanupExpiredSessions()
    }, 5 * 60 * 1000) // Every 5 minutes
  }

  /**
   * Cleanup expired sessions
   */
  private cleanupExpiredSessions(): void {
    const now = new Date()
    const expiredSessions: string[] = []

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
   */
  private startCSRFCleanup(): void {
    setInterval(() => {
      this.cleanupExpiredCSRFTokens()
    }, 10 * 60 * 1000) // Every 10 minutes
  }

  /**
   * Cleanup expired CSRF tokens
   */
  private cleanupExpiredCSRFTokens(): void {
    const now = new Date()
    const expiredTokens: string[] = []

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
   */
  getStatistics(): SessionStatistics {
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
   */
  async getHealth(): Promise<any> {
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
   */
  private async logSecurityEvent(event: Omit<SecurityEvent, 'id' | 'timestamp'>): Promise<void> {
    // Implementation would send to centralized logging
    console.warn(`Session Security Event: ${event.type} - ${event.description}`)
  }
}

interface SessionConfig {
  name: string
  secret: string
  maxAge: number
  secure: boolean
  httpOnly: boolean
  sameSite: 'strict' | 'lax' | 'none'
  domain?: string
  path: string
  regenerateOnAuth: boolean
  maxSessions: number
  idleTimeout: number
  absoluteTimeout: number
}

interface SessionData {
  id: string
  userId: string
  createdAt: Date
  lastAccessTime: Date
  ipAddress: string
  userAgent: string
  data: Record<string, any>
  isActive: boolean
  csrfToken: string
  fingerprint: string
}

interface SessionValidationResult {
  isValid: boolean
  reason?: string
  session?: SessionData
  csrfToken?: string
}

interface CSRFToken {
  sessionId: string
  token: string
  createdAt: Date
  expiresAt: Date
}

interface SessionStatistics {
  totalSessions: number
  activeSessions: number
  expiredSessions: number
  uniqueUsers: number
  csrfTokens: number
}