/**
 * DDoS Protection and Rate Limiting
 * Implements comprehensive protection against distributed denial of service attacks
 */

import { ProtectionConfig, SecurityEvent, SecurityEventType, SecuritySeverity } from '../types'

export class DDoSProtection {
  private requestCounts = new Map<string, RequestCounter>()
  private blockedIPs = new Map<string, BlockedIP>()
  private rateLimiters = new Map<string, RateLimiter>()
  private geoBlockedCountries = new Set<string>()
  private suspiciousPatterns = new Map<string, SuspiciousActivity>()

  constructor(private config: ProtectionConfig) {}

  async initialize(): Promise<void> {
    // Start cleanup interval for expired entries
    this.startCleanupInterval()
    
    // Initialize geoblocking if configured
    await this.initializeGeoBlocking()
    
    // Load threat intelligence feeds
    await this.loadThreatIntelligence()
  }

  /**
   * Check if request should be allowed
   */
  async checkRequest(request: any): Promise<boolean> {
    const clientIP = this.getClientIP(request)
    
    // Check if IP is blocked
    if (this.isIPBlocked(clientIP)) {
      await this.logSecurityEvent({
        type: SecurityEventType.RATE_LIMIT_EXCEEDED,
        severity: SecuritySeverity.HIGH,
        source: clientIP,
        description: 'Request from blocked IP',
        metadata: { userAgent: request.headers['user-agent'] }
      })
      return false
    }

    // Check geo-blocking
    if (await this.isGeoBlocked(clientIP)) {
      await this.blockIP(clientIP, 'geo-blocked', 24 * 60 * 60) // 24 hours
      return false
    }

    // Check rate limits
    if (!await this.checkRateLimit(clientIP, request)) {
      return false
    }

    // Check for suspicious patterns
    if (await this.detectSuspiciousActivity(clientIP, request)) {
      return false
    }

    // Update request counters
    this.updateRequestCounters(clientIP, request)

    return true
  }

  /**
   * Extract client IP from request
   */
  private getClientIP(request: any): string {
    // Check various headers for real IP
    const headers = [
      'cf-connecting-ip',      // Cloudflare
      'x-forwarded-for',       // Standard proxy header
      'x-real-ip',            // Nginx
      'x-cluster-client-ip',   // Cluster
      'x-forwarded',          // Alternative
      'forwarded-for',        // Alternative
      'forwarded'             // RFC 7239
    ]

    for (const header of headers) {
      const value = request.headers[header]
      if (value) {
        // Handle comma-separated list (first IP is usually the real client)
        const ip = value.split(',')[0].trim()
        if (this.isValidIP(ip)) {
          return ip
        }
      }
    }

    return request.connection?.remoteAddress || request.socket?.remoteAddress || 'unknown'
  }

  /**
   * Check if IP is currently blocked
   */
  private isIPBlocked(ip: string): boolean {
    const blocked = this.blockedIPs.get(ip)
    if (!blocked) return false

    if (blocked.expiresAt < new Date()) {
      this.blockedIPs.delete(ip)
      return false
    }

    return true
  }

  /**
   * Check rate limits for IP
   */
  private async checkRateLimit(ip: string, request: any): Promise<boolean> {
    const rateLimiter = this.getRateLimiter(ip)
    
    // Check per-minute limit
    if (!rateLimiter.checkMinuteLimit()) {
      await this.handleRateLimitExceeded(ip, 'per-minute', request)
      return false
    }

    // Check per-hour limit
    if (!rateLimiter.checkHourLimit()) {
      await this.handleRateLimitExceeded(ip, 'per-hour', request)
      return false
    }

    return true
  }

  /**
   * Get or create rate limiter for IP
   */
  private getRateLimiter(ip: string): RateLimiter {
    if (!this.rateLimiters.has(ip)) {
      this.rateLimiters.set(ip, new RateLimiter(
        this.config.ddos.maxRequestsPerMinute,
        this.config.ddos.maxRequestsPerHour
      ))
    }
    return this.rateLimiters.get(ip)!
  }

  /**
   * Handle rate limit exceeded
   */
  private async handleRateLimitExceeded(ip: string, limitType: string, request: any): Promise<void> {
    const blockDuration = this.calculateBlockDuration(ip)
    
    await this.blockIP(ip, `rate-limit-${limitType}`, blockDuration)
    
    await this.logSecurityEvent({
      type: SecurityEventType.RATE_LIMIT_EXCEEDED,
      severity: SecuritySeverity.HIGH,
      source: ip,
      description: `Rate limit exceeded: ${limitType}`,
      metadata: {
        limitType,
        blockDuration,
        userAgent: request.headers['user-agent'],
        endpoint: request.path
      }
    })
  }

  /**
   * Calculate block duration based on offense history
   */
  private calculateBlockDuration(ip: string): number {
    const counter = this.requestCounts.get(ip)
    if (!counter) return this.config.ddos.blockDuration

    // Exponential backoff based on violations
    const violations = counter.violations || 0
    return this.config.ddos.blockDuration * Math.pow(2, violations)
  }

  /**
   * Block IP address
   */
  async blockIP(ip: string, reason: string, duration: number): Promise<void> {
    const expiresAt = new Date(Date.now() + duration * 1000)
    
    this.blockedIPs.set(ip, {
      ip,
      reason,
      blockedAt: new Date(),
      expiresAt,
      violations: (this.blockedIPs.get(ip)?.violations || 0) + 1
    })

    // Update violation counter
    const counter = this.requestCounts.get(ip) || this.createRequestCounter()
    counter.violations = (counter.violations || 0) + 1
    this.requestCounts.set(ip, counter)

    await this.logSecurityEvent({
      type: SecurityEventType.SUSPICIOUS_REQUEST,
      severity: SecuritySeverity.HIGH,
      source: ip,
      description: `IP blocked: ${reason}`,
      metadata: { reason, duration, expiresAt: expiresAt.toISOString() }
    })
  }

  /**
   * Unblock IP address
   */
  async unblockIP(ip: string): Promise<boolean> {
    const blocked = this.blockedIPs.get(ip)
    if (!blocked) return false

    this.blockedIPs.delete(ip)

    await this.logSecurityEvent({
      type: SecurityEventType.CONFIGURATION_CHANGE,
      severity: SecuritySeverity.MEDIUM,
      source: 'admin',
      description: `IP unblocked: ${ip}`,
      metadata: { ip, originalReason: blocked.reason }
    })

    return true
  }

  /**
   * Check if request is from geo-blocked country
   */
  private async isGeoBlocked(ip: string): Promise<boolean> {
    if (this.geoBlockedCountries.size === 0) return false

    try {
      const country = await this.getCountryFromIP(ip)
      return this.geoBlockedCountries.has(country)
    } catch {
      return false
    }
  }

  /**
   * Get country from IP address
   */
  private async getCountryFromIP(ip: string): Promise<string> {
    // In production, use a geolocation service or database
    // This is a placeholder implementation
    return 'US'
  }

  /**
   * Detect suspicious activity patterns
   */
  private async detectSuspiciousActivity(ip: string, request: any): Promise<boolean> {
    const activity = this.getSuspiciousActivity(ip)
    
    // Check for rapid requests
    const now = Date.now()
    if (activity.lastRequestTime && (now - activity.lastRequestTime) < 100) {
      activity.rapidRequests++
      if (activity.rapidRequests > 10) {
        await this.blockIP(ip, 'rapid-requests', 300) // 5 minutes
        return true
      }
    } else {
      activity.rapidRequests = 0
    }
    
    activity.lastRequestTime = now

    // Check for suspicious user agents
    const userAgent = request.headers['user-agent'] || ''
    if (this.isSuspiciousUserAgent(userAgent)) {
      activity.suspiciousUA++
      if (activity.suspiciousUA > 5) {
        await this.blockIP(ip, 'suspicious-user-agent', 1800) // 30 minutes
        return true
      }
    }

    // Check for path traversal attempts
    if (this.hasPathTraversalAttempt(request.path)) {
      activity.pathTraversal++
      await this.blockIP(ip, 'path-traversal', 3600) // 1 hour
      return true
    }

    // Check for scanning patterns
    if (this.isScanningPattern(activity, request)) {
      await this.blockIP(ip, 'scanning-pattern', 1800) // 30 minutes
      return true
    }

    this.suspiciousPatterns.set(ip, activity)
    return false
  }

  /**
   * Get or create suspicious activity tracker
   */
  private getSuspiciousActivity(ip: string): SuspiciousActivity {
    if (!this.suspiciousPatterns.has(ip)) {
      this.suspiciousPatterns.set(ip, {
        rapidRequests: 0,
        suspiciousUA: 0,
        pathTraversal: 0,
        scanning: 0,
        lastRequestTime: 0,
        requestedPaths: new Set()
      })
    }
    return this.suspiciousPatterns.get(ip)!
  }

  /**
   * Check if user agent is suspicious
   */
  private isSuspiciousUserAgent(userAgent: string): boolean {
    const suspiciousPatterns = [
      /bot/i,
      /crawler/i,
      /spider/i,
      /scraper/i,
      /python/i,
      /curl/i,
      /wget/i,
      /nikto/i,
      /nmap/i,
      /sqlmap/i
    ]

    return suspiciousPatterns.some(pattern => pattern.test(userAgent))
  }

  /**
   * Check for path traversal attempts
   */
  private hasPathTraversalAttempt(path: string): boolean {
    const traversalPatterns = [
      /\.\.\//,
      /\.\.\\/,
      /%2e%2e%2f/i,
      /%2e%2e%5c/i,
      /\.\.%2f/i,
      /\.\.%5c/i
    ]

    return traversalPatterns.some(pattern => pattern.test(path))
  }

  /**
   * Detect scanning patterns
   */
  private isScanningPattern(activity: SuspiciousActivity, request: any): boolean {
    activity.requestedPaths.add(request.path)
    
    // If accessing many different paths quickly, likely scanning
    if (activity.requestedPaths.size > 20) {
      activity.scanning++
      return true
    }

    return false
  }

  /**
   * Update request counters
   */
  private updateRequestCounters(ip: string, request: any): void {
    const counter = this.requestCounts.get(ip) || this.createRequestCounter()
    
    counter.totalRequests++
    counter.lastRequestTime = new Date()
    
    // Update endpoint specific counters
    const endpoint = request.path
    counter.endpointCounts.set(endpoint, (counter.endpointCounts.get(endpoint) || 0) + 1)
    
    this.requestCounts.set(ip, counter)
  }

  /**
   * Create new request counter
   */
  private createRequestCounter(): RequestCounter {
    return {
      totalRequests: 0,
      lastRequestTime: new Date(),
      endpointCounts: new Map(),
      violations: 0
    }
  }

  /**
   * Start cleanup interval for expired entries
   */
  private startCleanupInterval(): void {
    setInterval(() => {
      this.cleanupExpiredEntries()
    }, 60 * 1000) // Clean every minute
  }

  /**
   * Clean up expired entries
   */
  private cleanupExpiredEntries(): void {
    const now = new Date()

    // Clean expired blocked IPs
    for (const [ip, blocked] of this.blockedIPs.entries()) {
      if (blocked.expiresAt < now) {
        this.blockedIPs.delete(ip)
      }
    }

    // Clean old request counters (older than 1 hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
    for (const [ip, counter] of this.requestCounts.entries()) {
      if (counter.lastRequestTime < oneHourAgo) {
        this.requestCounts.delete(ip)
      }
    }

    // Clean old rate limiters
    for (const [ip, limiter] of this.rateLimiters.entries()) {
      if (limiter.isExpired()) {
        this.rateLimiters.delete(ip)
      }
    }

    // Clean old suspicious activity trackers
    for (const [ip, activity] of this.suspiciousPatterns.entries()) {
      if (Date.now() - activity.lastRequestTime > 60 * 60 * 1000) {
        this.suspiciousPatterns.delete(ip)
      }
    }
  }

  /**
   * Initialize geo-blocking
   */
  private async initializeGeoBlocking(): Promise<void> {
    // Load geo-blocked countries from configuration
    const blockedCountries = ['CN', 'RU', 'KP'] // Example
    blockedCountries.forEach(country => this.geoBlockedCountries.add(country))
  }

  /**
   * Load threat intelligence feeds
   */
  private async loadThreatIntelligence(): Promise<void> {
    // In production, load from threat intelligence feeds
    // For now, just placeholder
    console.log('Threat intelligence loaded')
  }

  /**
   * Validate IP address format
   */
  private isValidIP(ip: string): boolean {
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/
    const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/
    
    return ipv4Regex.test(ip) || ipv6Regex.test(ip)
  }

  /**
   * Get current protection statistics
   */
  getStatistics(): any {
    return {
      blockedIPs: this.blockedIPs.size,
      activeRateLimiters: this.rateLimiters.size,
      requestCounters: this.requestCounts.size,
      suspiciousActivities: this.suspiciousPatterns.size,
      geoBlockedCountries: this.geoBlockedCountries.size
    }
  }

  /**
   * Get health status
   */
  async getHealth(): Promise<any> {
    const stats = this.getStatistics()
    
    return {
      ddosProtection: {
        enabled: this.config.ddos.enabled,
        maxRequestsPerMinute: this.config.ddos.maxRequestsPerMinute,
        maxRequestsPerHour: this.config.ddos.maxRequestsPerHour,
        blockDuration: this.config.ddos.blockDuration
      },
      rateLimit: {
        enabled: this.config.rateLimit.enabled,
        windowMs: this.config.rateLimit.windowMs,
        maxRequests: this.config.rateLimit.maxRequests
      },
      statistics: stats,
      recentBlocks: Array.from(this.blockedIPs.values()).slice(-10)
    }
  }

  /**
   * Log security event
   */
  private async logSecurityEvent(event: Omit<SecurityEvent, 'id' | 'timestamp'>): Promise<void> {
    // Implementation would send to centralized logging
    console.warn(`DDoS Protection Event: ${event.type} - ${event.description}`)
  }
}

/**
 * Rate Limiter class
 */
class RateLimiter {
  private minuteRequests: number[] = []
  private hourRequests: number[] = []

  constructor(
    private maxPerMinute: number,
    private maxPerHour: number
  ) {}

  checkMinuteLimit(): boolean {
    const now = Date.now()
    const oneMinuteAgo = now - 60 * 1000

    // Remove old requests
    this.minuteRequests = this.minuteRequests.filter(time => time > oneMinuteAgo)
    
    // Check limit
    if (this.minuteRequests.length >= this.maxPerMinute) {
      return false
    }

    // Add current request
    this.minuteRequests.push(now)
    return true
  }

  checkHourLimit(): boolean {
    const now = Date.now()
    const oneHourAgo = now - 60 * 60 * 1000

    // Remove old requests
    this.hourRequests = this.hourRequests.filter(time => time > oneHourAgo)
    
    // Check limit
    if (this.hourRequests.length >= this.maxPerHour) {
      return false
    }

    // Add current request
    this.hourRequests.push(now)
    return true
  }

  isExpired(): boolean {
    const now = Date.now()
    const oneHourAgo = now - 60 * 60 * 1000
    
    return this.minuteRequests.length === 0 && 
           this.hourRequests.every(time => time < oneHourAgo)
  }
}

interface RequestCounter {
  totalRequests: number
  lastRequestTime: Date
  endpointCounts: Map<string, number>
  violations: number
}

interface BlockedIP {
  ip: string
  reason: string
  blockedAt: Date
  expiresAt: Date
  violations: number
}

interface SuspiciousActivity {
  rapidRequests: number
  suspiciousUA: number
  pathTraversal: number
  scanning: number
  lastRequestTime: number
  requestedPaths: Set<string>
}