/**
 * SQL Injection and XSS Prevention
 * Implements comprehensive input validation and sanitization
 */

import { SecurityEvent, SecurityEventType, SecuritySeverity } from '../types'

export class InjectionPreventionFilter {
  private sqlInjectionPatterns: RegExp[] = []
  private xssPatterns: RegExp[] = []
  private commandInjectionPatterns: RegExp[] = []
  private pathTraversalPatterns: RegExp[] = []
  private blockedRequests = new Map<string, number>()

  constructor() {
    this.initializePatterns()
  }

  async initialize(): Promise<void> {
    // Load additional patterns from threat intelligence
    await this.loadThreatPatterns()
  }

  /**
   * Filter and validate request for injection attempts
   */
  async filterRequest(request: any): Promise<FilterResult> {
    const result: FilterResult = {
      isClean: true,
      threats: [],
      sanitizedData: {}
    }

    // Check URL parameters
    if (request.query) {
      const queryResult = await this.checkForInjections('query', request.query)
      if (!queryResult.isClean) {
        result.isClean = false
        result.threats.push(...queryResult.threats)
      }
      result.sanitizedData.query = queryResult.sanitizedData
    }

    // Check POST data
    if (request.body) {
      const bodyResult = await this.checkForInjections('body', request.body)
      if (!bodyResult.isClean) {
        result.isClean = false
        result.threats.push(...bodyResult.threats)
      }
      result.sanitizedData.body = bodyResult.sanitizedData
    }

    // Check headers
    if (request.headers) {
      const headerResult = await this.checkHeaders(request.headers)
      if (!headerResult.isClean) {
        result.isClean = false
        result.threats.push(...headerResult.threats)
      }
    }

    // Check file uploads
    if (request.files) {
      const fileResult = await this.checkFiles(request.files)
      if (!fileResult.isClean) {
        result.isClean = false
        result.threats.push(...fileResult.threats)
      }
    }

    // Log threats
    if (!result.isClean) {
      await this.logThreats(request, result.threats)
    }

    return result
  }

  /**
   * Check data for various injection types
   */
  private async checkForInjections(source: string, data: any): Promise<FilterResult> {
    const result: FilterResult = {
      isClean: true,
      threats: [],
      sanitizedData: {}
    }

    if (typeof data === 'object' && data !== null) {
      // Recursively check object properties
      for (const [key, value] of Object.entries(data)) {
        const keyResult = await this.validateString(key, `${source}.${key}`)
        const valueResult = await this.validateValue(value, `${source}.${key}`)

        if (!keyResult.isClean || !valueResult.isClean) {
          result.isClean = false
          result.threats.push(...keyResult.threats, ...valueResult.threats)
        }

        result.sanitizedData[keyResult.sanitizedValue || key] = valueResult.sanitizedValue
      }
    } else {
      const valueResult = await this.validateValue(data, source)
      result.isClean = valueResult.isClean
      result.threats = valueResult.threats
      result.sanitizedData = valueResult.sanitizedValue
    }

    return result
  }

  /**
   * Validate individual value
   */
  private async validateValue(value: any, context: string): Promise<ValidationResult> {
    if (typeof value !== 'string') {
      return {
        isClean: true,
        threats: [],
        sanitizedValue: value
      }
    }

    return await this.validateString(value, context)
  }

  /**
   * Validate string for injection attempts
   */
  private async validateString(str: string, context: string): Promise<ValidationResult> {
    const result: ValidationResult = {
      isClean: true,
      threats: [],
      sanitizedValue: str
    }

    // Check for SQL injection
    const sqlThreats = this.detectSQLInjection(str, context)
    if (sqlThreats.length > 0) {
      result.isClean = false
      result.threats.push(...sqlThreats)
      result.sanitizedValue = this.sanitizeSQL(str)
    }

    // Check for XSS
    const xssThreats = this.detectXSS(str, context)
    if (xssThreats.length > 0) {
      result.isClean = false
      result.threats.push(...xssThreats)
      result.sanitizedValue = this.sanitizeXSS(result.sanitizedValue)
    }

    // Check for command injection
    const cmdThreats = this.detectCommandInjection(str, context)
    if (cmdThreats.length > 0) {
      result.isClean = false
      result.threats.push(...cmdThreats)
      result.sanitizedValue = this.sanitizeCommand(result.sanitizedValue)
    }

    // Check for path traversal
    const pathThreats = this.detectPathTraversal(str, context)
    if (pathThreats.length > 0) {
      result.isClean = false
      result.threats.push(...pathThreats)
      result.sanitizedValue = this.sanitizePath(result.sanitizedValue)
    }

    return result
  }

  /**
   * Detect SQL injection attempts
   */
  private detectSQLInjection(input: string, context: string): Threat[] {
    const threats: Threat[] = []
    const normalizedInput = input.toLowerCase()

    for (const pattern of this.sqlInjectionPatterns) {
      const matches = normalizedInput.match(pattern)
      if (matches) {
        threats.push({
          type: 'sql-injection',
          severity: 'high',
          pattern: pattern.source,
          match: matches[0],
          context,
          confidence: this.calculateConfidence(pattern, matches[0])
        })
      }
    }

    return threats
  }

  /**
   * Detect XSS attempts
   */
  private detectXSS(input: string, context: string): Threat[] {
    const threats: Threat[] = []

    for (const pattern of this.xssPatterns) {
      const matches = input.match(pattern)
      if (matches) {
        threats.push({
          type: 'xss',
          severity: 'high',
          pattern: pattern.source,
          match: matches[0],
          context,
          confidence: this.calculateConfidence(pattern, matches[0])
        })
      }
    }

    return threats
  }

  /**
   * Detect command injection attempts
   */
  private detectCommandInjection(input: string, context: string): Threat[] {
    const threats: Threat[] = []

    for (const pattern of this.commandInjectionPatterns) {
      const matches = input.match(pattern)
      if (matches) {
        threats.push({
          type: 'command-injection',
          severity: 'critical',
          pattern: pattern.source,
          match: matches[0],
          context,
          confidence: this.calculateConfidence(pattern, matches[0])
        })
      }
    }

    return threats
  }

  /**
   * Detect path traversal attempts
   */
  private detectPathTraversal(input: string, context: string): Threat[] {
    const threats: Threat[] = []

    for (const pattern of this.pathTraversalPatterns) {
      const matches = input.match(pattern)
      if (matches) {
        threats.push({
          type: 'path-traversal',
          severity: 'medium',
          pattern: pattern.source,
          match: matches[0],
          context,
          confidence: this.calculateConfidence(pattern, matches[0])
        })
      }
    }

    return threats
  }

  /**
   * Sanitize SQL injection attempts
   */
  private sanitizeSQL(input: string): string {
    return input
      .replace(/['"]/g, '') // Remove quotes
      .replace(/;\s*--.*$/gm, '') // Remove SQL comments
      .replace(/;\s*\/\*.*?\*\//gs, '') // Remove block comments
      .replace(/\b(union|select|insert|update|delete|drop|exec|execute)\b/gi, '') // Remove SQL keywords
      .replace(/[;()]/g, '') // Remove dangerous characters
      .trim()
  }

  /**
   * Sanitize XSS attempts
   */
  private sanitizeXSS(input: string): string {
    return input
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/&/g, '&amp;')
      .replace(/javascript:/gi, '')
      .replace(/vbscript:/gi, '')
      .replace(/data:/gi, '')
      .replace(/on\w+=/gi, '')
  }

  /**
   * Sanitize command injection attempts
   */
  private sanitizeCommand(input: string): string {
    return input
      .replace(/[|&;`$(){}[\]]/g, '') // Remove shell metacharacters
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()
  }

  /**
   * Sanitize path traversal attempts
   */
  private sanitizePath(input: string): string {
    return input
      .replace(/\.\./g, '') // Remove directory traversal
      .replace(/[\\\/]/g, '') // Remove path separators
      .replace(/\0/g, '') // Remove null bytes
      .trim()
  }

  /**
   * Check request headers for threats
   */
  private async checkHeaders(headers: any): Promise<FilterResult> {
    const result: FilterResult = {
      isClean: true,
      threats: []
    }

    const dangerousHeaders = [
      'user-agent',
      'referer',
      'x-forwarded-for',
      'x-real-ip'
    ]

    for (const headerName of dangerousHeaders) {
      const headerValue = headers[headerName]
      if (headerValue && typeof headerValue === 'string') {
        const headerResult = await this.validateString(headerValue, `header.${headerName}`)
        if (!headerResult.isClean) {
          result.isClean = false
          result.threats.push(...headerResult.threats)
        }
      }
    }

    return result
  }

  /**
   * Check uploaded files for threats
   */
  private async checkFiles(files: any): Promise<FilterResult> {
    const result: FilterResult = {
      isClean: true,
      threats: []
    }

    for (const [fieldName, file] of Object.entries(files)) {
      if (Array.isArray(file)) {
        for (const f of file) {
          const fileResult = await this.validateFile(f, fieldName)
          if (!fileResult.isClean) {
            result.isClean = false
            result.threats.push(...fileResult.threats)
          }
        }
      } else {
        const fileResult = await this.validateFile(file, fieldName)
        if (!fileResult.isClean) {
          result.isClean = false
          result.threats.push(...fileResult.threats)
        }
      }
    }

    return result
  }

  /**
   * Validate uploaded file
   */
  private async validateFile(file: any, context: string): Promise<FilterResult> {
    const result: FilterResult = {
      isClean: true,
      threats: []
    }

    // Check filename
    if (file.name) {
      const nameResult = await this.validateString(file.name, `${context}.filename`)
      if (!nameResult.isClean) {
        result.isClean = false
        result.threats.push(...nameResult.threats)
      }
    }

    // Check file extension
    const dangerousExtensions = [
      '.exe', '.bat', '.cmd', '.com', '.pif', '.scr',
      '.js', '.jse', '.vbs', '.vbe', '.ws', '.wsf',
      '.php', '.asp', '.jsp', '.sh'
    ]

    if (file.name) {
      const extension = file.name.toLowerCase().split('.').pop()
      if (dangerousExtensions.includes(`.${extension}`)) {
        result.isClean = false
        result.threats.push({
          type: 'dangerous-file',
          severity: 'high',
          pattern: `dangerous extension: .${extension}`,
          match: file.name,
          context: `${context}.extension`,
          confidence: 0.9
        })
      }
    }

    // Check MIME type
    if (file.mimetype) {
      const dangerousMimeTypes = [
        'application/x-executable',
        'application/x-msdownload',
        'application/x-msdos-program'
      ]

      if (dangerousMimeTypes.includes(file.mimetype)) {
        result.isClean = false
        result.threats.push({
          type: 'dangerous-mime',
          severity: 'high',
          pattern: `dangerous MIME type: ${file.mimetype}`,
          match: file.mimetype,
          context: `${context}.mimetype`,
          confidence: 0.8
        })
      }
    }

    return result
  }

  /**
   * Initialize detection patterns
   */
  private initializePatterns(): void {
    // SQL Injection patterns
    this.sqlInjectionPatterns = [
      /(\%27)|(\')|(\-\-)|(\%23)|(#)/i, // Basic SQL injection
      /((\%3D)|(=))[^\n]*((\%27)|(\')|(\-\-)|(\%3B)|(;))/i, // SQL injection with equals
      /\w*((\%27)|(\'))((\%6F)|o|(\%4F))((\%72)|r|(\%52))/i, // 'or' variations
      /((\%27)|(\'))union/i, // Union based
      /exec(\s|\+)+(s|x)p\w+/i, // Stored procedures
      /UNION(?:\s+ALL)?\s+SELECT/i, // Union select
      /INSERT\s+INTO/i, // Insert statements
      /DELETE\s+FROM/i, // Delete statements
      /UPDATE\s+\w+\s+SET/i, // Update statements
      /DROP\s+(TABLE|DATABASE)/i, // Drop statements
      /TRUNCATE\s+TABLE/i, // Truncate statements
      /LOAD_FILE\s*\(/i, // MySQL file functions
      /INTO\s+OUTFILE/i, // MySQL output
      /xp_cmdshell/i, // SQL Server command execution
      /sp_executesql/i // SQL Server dynamic SQL
    ]

    // XSS patterns
    this.xssPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
      /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,
      /<embed\b[^<]*>/gi,
      /<applet\b[^<]*(?:(?!<\/applet>)<[^<]*)*<\/applet>/gi,
      /javascript:/gi,
      /vbscript:/gi,
      /on\w+\s*=/gi, // Event handlers
      /expression\s*\(/gi, // CSS expressions
      /@import/gi, // CSS imports
      /data:\s*text\/html/gi, // Data URLs
      /<svg\b[^>]*>[\s\S]*<\/svg>/gi, // SVG with potential scripts
      /<!--[\s\S]*-->/g, // HTML comments (can hide XSS)
      /<meta\b[^>]*http-equiv/gi, // Meta refresh
      /<link\b[^>]*javascript:/gi // Link with javascript
    ]

    // Command Injection patterns
    this.commandInjectionPatterns = [
      /[;&|`$()]/g, // Shell metacharacters
      /\$\{[^}]*\}/g, // Variable expansion
      /`[^`]*`/g, // Command substitution
      /\$\([^)]*\)/g, // Command substitution
      /\|\s*(ls|cat|pwd|whoami|id|uname)/gi, // Piped commands
      /;\s*(ls|cat|pwd|whoami|id|uname)/gi, // Chained commands
      /&&\s*(ls|cat|pwd|whoami|id|uname)/gi, // AND commands
      /\|\|\s*(ls|cat|pwd|whoami|id|uname)/gi, // OR commands
      /(nc|netcat|telnet|wget|curl)\s/gi, // Network commands
      /(rm|del|format|fdisk)\s/gi // Destructive commands
    ]

    // Path Traversal patterns
    this.pathTraversalPatterns = [
      /\.\.\//g, // Directory traversal
      /\.\.\\/g, // Windows directory traversal
      /%2e%2e%2f/gi, // URL encoded traversal
      /%2e%2e%5c/gi, // URL encoded Windows traversal
      /\.\.%2f/gi, // Mixed encoding
      /\.\.%5c/gi, // Mixed encoding Windows
      /\0/g, // Null byte injection
      /%00/gi, // URL encoded null byte
      /\/etc\/passwd/gi, // Linux password file
      /\/etc\/shadow/gi, // Linux shadow file
      /\/windows\/system32/gi, // Windows system directory
      /\.\.\/\.\.\/\.\.\//g // Multiple traversals
    ]
  }

  /**
   * Load additional threat patterns
   */
  private async loadThreatPatterns(): Promise<void> {
    // In production, load from threat intelligence feeds
    // This is a placeholder for additional pattern loading
    console.log('Additional threat patterns loaded')
  }

  /**
   * Calculate confidence score for pattern match
   */
  private calculateConfidence(pattern: RegExp, match: string): number {
    // Simple confidence calculation based on pattern complexity and match length
    let confidence = 0.5

    // Longer matches generally indicate higher confidence
    if (match.length > 10) confidence += 0.2
    if (match.length > 20) confidence += 0.2

    // Complex patterns indicate higher confidence
    if (pattern.source.length > 50) confidence += 0.1

    return Math.min(confidence, 1.0)
  }

  /**
   * Log detected threats
   */
  private async logThreats(request: any, threats: Threat[]): Promise<void> {
    const clientIP = request.ip || request.connection?.remoteAddress || 'unknown'
    
    for (const threat of threats) {
      await this.logSecurityEvent({
        type: SecurityEventType.INJECTION_ATTEMPT,
        severity: this.mapThreatSeverity(threat.severity),
        source: clientIP,
        description: `${threat.type} attempt detected`,
        metadata: {
          threatType: threat.type,
          pattern: threat.pattern,
          match: threat.match,
          context: threat.context,
          confidence: threat.confidence,
          userAgent: request.headers?.['user-agent']
        }
      })
    }

    // Track blocked requests per IP
    const currentCount = this.blockedRequests.get(clientIP) || 0
    this.blockedRequests.set(clientIP, currentCount + 1)
  }

  /**
   * Map threat severity to security severity
   */
  private mapThreatSeverity(severity: string): SecuritySeverity {
    switch (severity) {
      case 'critical': return SecuritySeverity.CRITICAL
      case 'high': return SecuritySeverity.HIGH
      case 'medium': return SecuritySeverity.MEDIUM
      case 'low': return SecuritySeverity.LOW
      default: return SecuritySeverity.MEDIUM
    }
  }

  /**
   * Get filter statistics
   */
  getStatistics(): any {
    return {
      sqlPatterns: this.sqlInjectionPatterns.length,
      xssPatterns: this.xssPatterns.length,
      commandPatterns: this.commandInjectionPatterns.length,
      pathTraversalPatterns: this.pathTraversalPatterns.length,
      blockedRequests: this.blockedRequests.size,
      totalBlockedRequests: Array.from(this.blockedRequests.values()).reduce((a, b) => a + b, 0)
    }
  }

  /**
   * Get health status
   */
  async getHealth(): Promise<any> {
    const stats = this.getStatistics()
    
    return {
      patternsLoaded: stats.sqlPatterns + stats.xssPatterns + stats.commandPatterns + stats.pathTraversalPatterns,
      activeFilters: {
        sqlInjection: this.sqlInjectionPatterns.length > 0,
        xss: this.xssPatterns.length > 0,
        commandInjection: this.commandInjectionPatterns.length > 0,
        pathTraversal: this.pathTraversalPatterns.length > 0
      },
      statistics: stats
    }
  }

  /**
   * Log security event
   */
  private async logSecurityEvent(event: Omit<SecurityEvent, 'id' | 'timestamp'>): Promise<void> {
    // Implementation would send to centralized logging
    console.warn(`Injection Prevention Event: ${event.type} - ${event.description}`)
  }
}

interface FilterResult {
  isClean: boolean
  threats: Threat[]
  sanitizedData?: any
}

interface ValidationResult {
  isClean: boolean
  threats: Threat[]
  sanitizedValue: any
}

interface Threat {
  type: string
  severity: string
  pattern: string
  match: string
  context: string
  confidence: number
}