/**
 * Security Headers Management
 * Implements comprehensive HTTP security headers and CSP policies
 */

import { SecurityHeadersConfig, CSPPolicy, PermissionsPolicy, ReferrerPolicy } from '../types'

export class SecurityHeadersManager {
  private cspNonce = new Map<string, string>()
  
  constructor(private config: SecurityHeadersConfig) {}

  async initialize(): Promise<void> {
    // Initialize CSP reporting endpoint if configured
    if (this.config.csp.enabled && this.config.csp.policy.reportUri) {
      await this.setupCSPReporting()
    }
  }

  /**
   * Generate security headers middleware
   */
  createHeadersMiddleware() {
    return (req: any, res: any, next: any) => {
      this.applySecurityHeaders(req, res)
      next()
    }
  }

  /**
   * Apply all security headers to response
   */
  applySecurityHeaders(req: any, res: any): void {
    // HTTP Strict Transport Security (HSTS)
    this.applyHSTSHeader(res)

    // Content Security Policy (CSP)
    this.applyCSPHeader(req, res)

    // X-Frame-Options
    this.applyFrameOptionsHeader(res)

    // X-Content-Type-Options
    this.applyContentTypeOptionsHeader(res)

    // Referrer Policy
    this.applyReferrerPolicyHeader(res)

    // Permissions Policy
    this.applyPermissionsPolicyHeader(res)

    // Additional security headers
    this.applyAdditionalSecurityHeaders(res)
  }

  /**
   * Apply HSTS header
   */
  private applyHSTSHeader(res: any): void {
    if (!this.config.hsts.enabled) return

    let hstsValue = `max-age=${this.config.hsts.maxAge}`
    
    if (this.config.hsts.includeSubDomains) {
      hstsValue += '; includeSubDomains'
    }
    
    if (this.config.hsts.preload) {
      hstsValue += '; preload'
    }

    res.setHeader('Strict-Transport-Security', hstsValue)
  }

  /**
   * Apply Content Security Policy header
   */
  private applyCSPHeader(req: any, res: any): void {
    if (!this.config.csp.enabled) return

    const nonce = this.generateCSPNonce()
    this.cspNonce.set(req.id || req.ip, nonce)

    const cspDirectives = this.buildCSPDirectives(nonce)
    const headerName = this.config.csp.reportOnly 
      ? 'Content-Security-Policy-Report-Only' 
      : 'Content-Security-Policy'

    res.setHeader(headerName, cspDirectives)
    
    // Make nonce available to templates
    res.locals = res.locals || {}
    res.locals.cspNonce = nonce
  }

  /**
   * Build CSP directive string
   */
  private buildCSPDirectives(nonce: string): string {
    const directives: string[] = []
    const policy = this.config.csp.policy

    // Default source
    if (policy.defaultSrc.length > 0) {
      directives.push(`default-src ${policy.defaultSrc.join(' ')}`)
    }

    // Script source with nonce
    if (policy.scriptSrc.length > 0) {
      const scriptSources = [...policy.scriptSrc, `'nonce-${nonce}'`]
      directives.push(`script-src ${scriptSources.join(' ')}`)
    }

    // Style source with nonce
    if (policy.styleSrc.length > 0) {
      const styleSources = [...policy.styleSrc, `'nonce-${nonce}'`]
      directives.push(`style-src ${styleSources.join(' ')}`)
    }

    // Other directives
    const directiveMap = {
      'img-src': policy.imgSrc,
      'connect-src': policy.connectSrc,
      'font-src': policy.fontSrc,
      'object-src': policy.objectSrc,
      'media-src': policy.mediaSrc,
      'frame-src': policy.frameSrc
    }

    for (const [directive, sources] of Object.entries(directiveMap)) {
      if (sources.length > 0) {
        directives.push(`${directive} ${sources.join(' ')}`)
      }
    }

    // Report URI
    if (policy.reportUri) {
      directives.push(`report-uri ${policy.reportUri}`)
    }

    return directives.join('; ')
  }

  /**
   * Apply X-Frame-Options header
   */
  private applyFrameOptionsHeader(res: any): void {
    res.setHeader('X-Frame-Options', this.config.frameOptions)
  }

  /**
   * Apply X-Content-Type-Options header
   */
  private applyContentTypeOptionsHeader(res: any): void {
    if (this.config.contentTypeOptions) {
      res.setHeader('X-Content-Type-Options', 'nosniff')
    }
  }

  /**
   * Apply Referrer-Policy header
   */
  private applyReferrerPolicyHeader(res: any): void {
    res.setHeader('Referrer-Policy', this.config.referrerPolicy)
  }

  /**
   * Apply Permissions-Policy header
   */
  private applyPermissionsPolicyHeader(res: any): void {
    const policies: string[] = []
    const permissions = this.config.permissionsPolicy

    for (const [feature, policy] of Object.entries(permissions)) {
      if (typeof policy === 'string') {
        if (policy === 'self') {
          policies.push(`${feature}=(self)`)
        } else if (policy === 'none') {
          policies.push(`${feature}=()`)
        }
      } else if (Array.isArray(policy)) {
        policies.push(`${feature}=(${policy.join(' ')})`)
      }
    }

    if (policies.length > 0) {
      res.setHeader('Permissions-Policy', policies.join(', '))
    }
  }

  /**
   * Apply additional security headers
   */
  private applyAdditionalSecurityHeaders(res: any): void {
    // X-XSS-Protection (deprecated but still useful for older browsers)
    res.setHeader('X-XSS-Protection', '1; mode=block')

    // X-DNS-Prefetch-Control
    res.setHeader('X-DNS-Prefetch-Control', 'off')

    // Cross-Origin-Embedder-Policy
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp')

    // Cross-Origin-Opener-Policy
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')

    // Cross-Origin-Resource-Policy
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin')

    // Cache-Control for sensitive resources
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')

    // Pragma
    res.setHeader('Pragma', 'no-cache')

    // Server header removal
    res.removeHeader('X-Powered-By')
    res.removeHeader('Server')
  }

  /**
   * Generate CSP nonce
   */
  private generateCSPNonce(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let nonce = ''
    
    for (let i = 0; i < 16; i++) {
      nonce += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    
    return nonce
  }

  /**
   * Get CSP nonce for request
   */
  getCSPNonce(requestId: string): string | undefined {
    return this.cspNonce.get(requestId)
  }

  /**
   * Clean up old nonces
   */
  private cleanupNonces(): void {
    // Clean up nonces older than 1 hour
    setInterval(() => {
      this.cspNonce.clear()
    }, 60 * 60 * 1000)
  }

  /**
   * Setup CSP reporting endpoint
   */
  private async setupCSPReporting(): Promise<void> {
    // Implementation would set up endpoint to receive CSP violation reports
    console.log(`CSP reporting enabled: ${this.config.csp.policy.reportUri}`)
  }

  /**
   * Validate CSP policy
   */
  validateCSPPolicy(policy: CSPPolicy): string[] {
    const issues: string[] = []

    // Check for unsafe-inline and unsafe-eval
    if (policy.scriptSrc.includes("'unsafe-inline'")) {
      issues.push("script-src contains 'unsafe-inline' which reduces security")
    }

    if (policy.scriptSrc.includes("'unsafe-eval'")) {
      issues.push("script-src contains 'unsafe-eval' which reduces security")
    }

    if (policy.styleSrc.includes("'unsafe-inline'")) {
      issues.push("style-src contains 'unsafe-inline' which reduces security")
    }

    // Check for wildcard sources
    if (policy.defaultSrc.includes('*')) {
      issues.push("default-src contains wildcard '*' which reduces security")
    }

    // Check for data: URLs in script-src
    if (policy.scriptSrc.includes('data:')) {
      issues.push("script-src contains 'data:' which can be unsafe")
    }

    return issues
  }

  /**
   * Create secure CSP policy template
   */
  createSecureCSPPolicy(): CSPPolicy {
    return {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
      reportUri: '/csp-report'
    }
  }

  /**
   * Update CSP policy
   */
  updateCSPPolicy(newPolicy: Partial<CSPPolicy>): void {
    this.config.csp.policy = { ...this.config.csp.policy, ...newPolicy }
  }

  /**
   * Enable/disable security header
   */
  toggleSecurityHeader(header: string, enabled: boolean): void {
    switch (header) {
      case 'hsts':
        this.config.hsts.enabled = enabled
        break
      case 'csp':
        this.config.csp.enabled = enabled
        break
      case 'contentTypeOptions':
        this.config.contentTypeOptions = enabled
        break
    }
  }

  /**
   * Get security headers health status
   */
  async getHealth(): Promise<any> {
    const cspIssues = this.validateCSPPolicy(this.config.csp.policy)
    
    return {
      hsts: {
        enabled: this.config.hsts.enabled,
        maxAge: this.config.hsts.maxAge,
        includeSubDomains: this.config.hsts.includeSubDomains,
        preload: this.config.hsts.preload
      },
      csp: {
        enabled: this.config.csp.enabled,
        reportOnly: this.config.csp.reportOnly,
        issues: cspIssues,
        activeNonces: this.cspNonce.size
      },
      frameOptions: this.config.frameOptions,
      contentTypeOptions: this.config.contentTypeOptions,
      referrerPolicy: this.config.referrerPolicy,
      securityScore: this.calculateSecurityScore(cspIssues)
    }
  }

  /**
   * Calculate security score based on configuration
   */
  private calculateSecurityScore(cspIssues: string[]): number {
    let score = 100

    // Deduct points for disabled features
    if (!this.config.hsts.enabled) score -= 20
    if (!this.config.csp.enabled) score -= 30
    if (!this.config.contentTypeOptions) score -= 10

    // Deduct points for CSP issues
    score -= cspIssues.length * 5

    // Deduct points for insecure settings
    if (this.config.frameOptions !== 'DENY' && this.config.frameOptions !== 'SAMEORIGIN') {
      score -= 10
    }

    return Math.max(0, score)
  }
}

/**
 * CSP Policy Builder
 */
export class CSPPolicyBuilder {
  private policy: CSPPolicy

  constructor() {
    this.policy = {
      defaultSrc: [],
      scriptSrc: [],
      styleSrc: [],
      imgSrc: [],
      connectSrc: [],
      fontSrc: [],
      objectSrc: [],
      mediaSrc: [],
      frameSrc: []
    }
  }

  defaultSrc(...sources: string[]): CSPPolicyBuilder {
    this.policy.defaultSrc.push(...sources)
    return this
  }

  scriptSrc(...sources: string[]): CSPPolicyBuilder {
    this.policy.scriptSrc.push(...sources)
    return this
  }

  styleSrc(...sources: string[]): CSPPolicyBuilder {
    this.policy.styleSrc.push(...sources)
    return this
  }

  imgSrc(...sources: string[]): CSPPolicyBuilder {
    this.policy.imgSrc.push(...sources)
    return this
  }

  connectSrc(...sources: string[]): CSPPolicyBuilder {
    this.policy.connectSrc.push(...sources)
    return this
  }

  fontSrc(...sources: string[]): CSPPolicyBuilder {
    this.policy.fontSrc.push(...sources)
    return this
  }

  objectSrc(...sources: string[]): CSPPolicyBuilder {
    this.policy.objectSrc.push(...sources)
    return this
  }

  mediaSrc(...sources: string[]): CSPPolicyBuilder {
    this.policy.mediaSrc.push(...sources)
    return this
  }

  frameSrc(...sources: string[]): CSPPolicyBuilder {
    this.policy.frameSrc.push(...sources)
    return this
  }

  reportUri(uri: string): CSPPolicyBuilder {
    this.policy.reportUri = uri
    return this
  }

  build(): CSPPolicy {
    return { ...this.policy }
  }
}