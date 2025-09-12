/**
 * Security Headers and Content Security Policy Manager
 * Implements comprehensive HTTP security headers and CSP policies
 */

export class SecurityHeadersManager {
  constructor() {
    this.cspNonce = null;
    this.refreshNonce();
    
    // Default CSP directives
    this.defaultCSP = {
      'default-src': ["'self'"],
      'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      'style-src': ["'self'", "'unsafe-inline'"],
      'img-src': ["'self'", 'data:', 'https:'],
      'font-src': ["'self'"],
      'connect-src': ["'self'"],
      'media-src': ["'self'"],
      'object-src': ["'none'"],
      'child-src': ["'self'"],
      'worker-src': ["'self'"],
      'frame-src': ["'none'"],
      'form-action': ["'self'"],
      'base-uri': ["'self'"],
      'manifest-src': ["'self'"],
      'upgrade-insecure-requests': []
    };

    // Security headers configuration
    this.securityHeaders = {
      // Content Security Policy
      'Content-Security-Policy': this.buildCSPHeader(this.defaultCSP),
      
      // HTTP Strict Transport Security
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
      
      // Prevent MIME type sniffing
      'X-Content-Type-Options': 'nosniff',
      
      // XSS Protection
      'X-XSS-Protection': '1; mode=block',
      
      // Frame Options
      'X-Frame-Options': 'DENY',
      
      // Referrer Policy
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      
      // Feature Policy
      'Permissions-Policy': this.buildFeaturePolicyHeader(),
      
      // Cross-Origin Policies
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Resource-Policy': 'same-origin',
      
      // Cache Control for sensitive content
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    };
  }

  /**
   * Get all security headers for HTTP response
   */
  getSecurityHeaders(options = {}) {
    const headers = { ...this.securityHeaders };
    
    // Customize CSP if needed
    if (options.csp) {
      const customCSP = { ...this.defaultCSP, ...options.csp };
      headers['Content-Security-Policy'] = this.buildCSPHeader(customCSP);
    }

    // Add nonce to CSP if using inline scripts
    if (options.useNonce) {
      headers['Content-Security-Policy'] = headers['Content-Security-Policy']
        .replace("'unsafe-inline'", `'nonce-${this.cspNonce}'`);
    }

    // Customize HSTS for development
    if (options.development) {
      delete headers['Strict-Transport-Security'];
    }

    // Allow framing for specific cases
    if (options.allowFraming) {
      if (options.allowFraming === 'sameorigin') {
        headers['X-Frame-Options'] = 'SAMEORIGIN';
      } else if (typeof options.allowFraming === 'string') {
        headers['X-Frame-Options'] = `ALLOW-FROM ${options.allowFraming}`;
      }
    }

    return headers;
  }

  /**
   * Build Content Security Policy header string
   */
  buildCSPHeader(directives) {
    const cspParts = [];
    
    for (const [directive, values] of Object.entries(directives)) {
      if (values.length === 0) {
        cspParts.push(directive);
      } else {
        cspParts.push(`${directive} ${values.join(' ')}`);
      }
    }
    
    return cspParts.join('; ');
  }

  /**
   * Build Feature Policy header string
   */
  buildFeaturePolicyHeader() {
    const policies = [
      'accelerometer=()',
      'ambient-light-sensor=()',
      'autoplay=()',
      'battery=()',
      'camera=()',
      'cross-origin-isolated=()',
      'display-capture=()',
      'document-domain=()',
      'encrypted-media=()',
      'execution-while-not-rendered=()',
      'execution-while-out-of-viewport=()',
      'fullscreen=()',
      'geolocation=()',
      'gyroscope=()',
      'keyboard-map=()',
      'magnetometer=()',
      'microphone=()',
      'midi=()',
      'navigation-override=()',
      'payment=()',
      'picture-in-picture=()',
      'publickey-credentials-get=()',
      'screen-wake-lock=()',
      'sync-xhr=()',
      'usb=()',
      'web-share=()',
      'xr-spatial-tracking=()'
    ];
    
    return policies.join(', ');
  }

  /**
   * Create restrictive CSP for admin/sensitive pages
   */
  getRestrictiveCSP() {
    return {
      'default-src': ["'none'"],
      'script-src': ["'self'"],
      'style-src': ["'self'"],
      'img-src': ["'self'"],
      'font-src': ["'self'"],
      'connect-src': ["'self'"],
      'form-action': ["'self'"],
      'base-uri': ["'none'"],
      'object-src': ["'none'"],
      'frame-src': ["'none'"],
      'child-src': ["'none'"],
      'worker-src': ["'none'"],
      'media-src': ["'none'"],
      'manifest-src': ["'none'"],
      'upgrade-insecure-requests': []
    };
  }

  /**
   * Create permissive CSP for development
   */
  getDevelopmentCSP() {
    return {
      'default-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'localhost:*', '127.0.0.1:*'],
      'style-src': ["'self'", "'unsafe-inline'"],
      'img-src': ["'self'", 'data:', 'https:', 'http:'],
      'font-src': ["'self'", 'https:', 'data:'],
      'connect-src': ["'self'", 'ws:', 'wss:', 'localhost:*', '127.0.0.1:*'],
      'media-src': ["'self'"],
      'object-src': ["'none'"],
      'child-src': ["'self'"],
      'worker-src': ["'self'"],
      'frame-src': ["'self'"],
      'form-action': ["'self'"],
      'base-uri': ["'self'"],
      'manifest-src': ["'self'"]
    };
  }

  /**
   * Generate new CSP nonce
   */
  refreshNonce() {
    this.cspNonce = require('crypto').randomBytes(16).toString('base64');
    return this.cspNonce;
  }

  /**
   * Get current CSP nonce
   */
  getNonce() {
    return this.cspNonce;
  }

  /**
   * Express.js middleware for security headers
   */
  expressMiddleware(options = {}) {
    return (req, res, next) => {
      const headers = this.getSecurityHeaders(options);
      
      // Set all security headers
      for (const [name, value] of Object.entries(headers)) {
        res.set(name, value);
      }
      
      // Refresh nonce for each request if using nonces
      if (options.useNonce) {
        this.refreshNonce();
        res.locals.nonce = this.cspNonce;
      }
      
      next();
    };
  }

  /**
   * Validate CSP configuration
   */
  validateCSP(csp) {
    const errors = [];
    const warnings = [];
    
    // Check for unsafe directives
    const unsafePatterns = ['unsafe-inline', 'unsafe-eval', '*'];
    
    for (const [directive, values] of Object.entries(csp)) {
      for (const value of values) {
        if (unsafePatterns.some(pattern => value.includes(pattern))) {
          warnings.push(`${directive} contains potentially unsafe directive: ${value}`);
        }
      }
    }
    
    // Check for required directives
    const requiredDirectives = ['default-src', 'script-src', 'object-src'];
    for (const required of requiredDirectives) {
      if (!csp[required]) {
        errors.push(`Missing required CSP directive: ${required}`);
      }
    }
    
    // Check for deprecated directives
    const deprecatedDirectives = ['report-uri'];
    for (const deprecated of deprecatedDirectives) {
      if (csp[deprecated]) {
        warnings.push(`CSP directive ${deprecated} is deprecated, use report-to instead`);
      }
    }
    
    return { errors, warnings, isValid: errors.length === 0 };
  }

  /**
   * Get security headers for API responses
   */
  getAPISecurityHeaders() {
    return {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Cross-Origin-Resource-Policy': 'same-origin'
    };
  }

  /**
   * Get security headers for file downloads
   */
  getDownloadSecurityHeaders() {
    return {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Content-Disposition': 'attachment',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    };
  }

  /**
   * Generate security report
   */
  generateSecurityReport() {
    return {
      timestamp: this.getDeterministicDate().toISOString(),
      headers: this.securityHeaders,
      csp: {
        policy: this.defaultCSP,
        nonce: this.cspNonce,
        validation: this.validateCSP(this.defaultCSP)
      },
      recommendations: this.getSecurityRecommendations()
    };
  }

  /**
   * Get security recommendations
   */
  getSecurityRecommendations() {
    const recommendations = [];
    
    // Check for common issues
    if (this.defaultCSP['script-src'].includes("'unsafe-inline'")) {
      recommendations.push({
        severity: 'medium',
        issue: 'CSP allows unsafe inline scripts',
        recommendation: 'Use nonces or hashes instead of unsafe-inline for script-src'
      });
    }
    
    if (this.defaultCSP['script-src'].includes("'unsafe-eval'")) {
      recommendations.push({
        severity: 'high',
        issue: 'CSP allows unsafe eval',
        recommendation: 'Remove unsafe-eval from script-src directive'
      });
    }
    
    if (!this.securityHeaders['Strict-Transport-Security']) {
      recommendations.push({
        severity: 'high',
        issue: 'Missing HSTS header',
        recommendation: 'Add Strict-Transport-Security header for HTTPS sites'
      });
    }
    
    return recommendations;
  }
}

/**
 * CORS Security Configuration
 */
export class CORSSecurityManager {
  constructor() {
    this.allowedOrigins = new Set(['http://localhost:3000', 'http://127.0.0.1:3000']);
    this.allowedMethods = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'];
    this.allowedHeaders = ['Content-Type', 'Authorization', 'X-Requested-With'];
    this.maxAge = 86400; // 24 hours
  }

  /**
   * Add allowed origin
   */
  addAllowedOrigin(origin) {
    this.allowedOrigins.add(origin);
  }

  /**
   * Remove allowed origin
   */
  removeAllowedOrigin(origin) {
    this.allowedOrigins.delete(origin);
  }

  /**
   * Check if origin is allowed
   */
  isOriginAllowed(origin) {
    return this.allowedOrigins.has(origin) || this.allowedOrigins.has('*');
  }

  /**
   * Get CORS headers for response
   */
  getCORSHeaders(requestOrigin) {
    if (!this.isOriginAllowed(requestOrigin)) {
      return {};
    }

    return {
      'Access-Control-Allow-Origin': requestOrigin,
      'Access-Control-Allow-Methods': this.allowedMethods.join(', '),
      'Access-Control-Allow-Headers': this.allowedHeaders.join(', '),
      'Access-Control-Max-Age': this.maxAge.toString(),
      'Access-Control-Allow-Credentials': 'true'
    };
  }

  /**
   * Express.js CORS middleware
   */
  corsMiddleware() {
    return (req, res, next) => {
      const origin = req.headers.origin;
      const corsHeaders = this.getCORSHeaders(origin);
      
      for (const [name, value] of Object.entries(corsHeaders)) {
        res.set(name, value);
      }

      // Handle preflight requests
      if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
      }

      next();
    };
  }
}

// Export singleton instances
export const securityHeaders = new SecurityHeadersManager();
export const corsManager = new CORSSecurityManager();