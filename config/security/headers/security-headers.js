/**
 * Security Headers Configuration
 * Comprehensive security headers including CSP, HSTS, and others
 */

class SecurityHeaders {
  constructor() {
    this.config = {
      // Content Security Policy
      csp: {
        reportOnly: false,
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: [
            "'self'",
            "'strict-dynamic'",
            "'nonce-{nonce}'",
            "https://cdnjs.cloudflare.com",
            "https://cdn.jsdelivr.net"
          ],
          styleSrc: [
            "'self'",
            "'unsafe-inline'",
            "https://fonts.googleapis.com",
            "https://cdnjs.cloudflare.com"
          ],
          imgSrc: [
            "'self'",
            "data:",
            "https:",
            "blob:"
          ],
          fontSrc: [
            "'self'",
            "https://fonts.gstatic.com",
            "https://cdnjs.cloudflare.com"
          ],
          connectSrc: [
            "'self'",
            "https://api.github.com",
            "https://api.npm.js",
            "wss:"
          ],
          mediaSrc: ["'self'"],
          objectSrc: ["'none'"],
          childSrc: ["'none'"],
          frameSrc: ["'none'"],
          workerSrc: ["'self'"],
          manifestSrc: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
          baseUri: ["'self'"],
          upgradeInsecureRequests: [],
          blockAllMixedContent: []
        },
        reportUri: '/api/security/csp-report'
      },

      // HTTP Strict Transport Security
      hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true
      },

      // Feature Policy / Permissions Policy
      permissionsPolicy: {
        camera: ["'none'"],
        microphone: ["'none'"],
        geolocation: ["'none'"],
        gyroscope: ["'none'"],
        magnetometer: ["'none'"],
        payment: ["'none'"],
        usb: ["'none'"],
        accelerometer: ["'none'"],
        ambient_light_sensor: ["'none'"],
        autoplay: ["'self'"],
        clipboard_read: ["'self'"],
        clipboard_write: ["'self'"],
        display_capture: ["'none'"],
        document_domain: ["'none'"],
        encrypted_media: ["'none'"],
        fullscreen: ["'self'"],
        gamepad: ["'none'"],
        speaker_selection: ["'none'"],
        sync_xhr: ["'none'"],
        web_share: ["'self'"]
      },

      // Cross-Origin policies
      crossOrigin: {
        embedderPolicy: {
          policy: 'require-corp'
        },
        openerPolicy: {
          policy: 'same-origin'
        },
        resourcePolicy: {
          policy: 'cross-origin'
        }
      },

      // Additional security headers
      additional: {
        xFrameOptions: 'DENY',
        xContentTypeOptions: 'nosniff',
        xXssProtection: '1; mode=block',
        referrerPolicy: 'no-referrer',
        xDownloadOptions: 'noopen',
        xPermittedCrossDomainPolicies: 'none',
        expectCT: {
          maxAge: 86400,
          enforce: true,
          reportUri: '/api/security/ct-report'
        }
      }
    };
  }

  // Generate CSP header value
  generateCSP() {
    const directives = [];
    
    for (const [directive, values] of Object.entries(this.config.csp.directives)) {
      if (Array.isArray(values) && values.length > 0) {
        const kebabCase = directive.replace(/([A-Z])/g, '-$1').toLowerCase();
        directives.push(`${kebabCase} ${values.join(' ')}`);
      } else if (Array.isArray(values) && values.length === 0) {
        // For directives like upgrade-insecure-requests
        const kebabCase = directive.replace(/([A-Z])/g, '-$1').toLowerCase();
        directives.push(kebabCase);
      }
    }
    
    return directives.join('; ');
  }

  // Generate Permissions Policy header value
  generatePermissionsPolicy() {
    const policies = [];
    
    for (const [feature, allowList] of Object.entries(this.config.permissionsPolicy)) {
      const allowListStr = allowList.map(origin => 
        origin === "'self'" ? 'self' : 
        origin === "'none'" ? '' : origin
      ).join(' ') || '';
      
      if (allowListStr === '') {
        policies.push(`${feature}=()`);
      } else {
        policies.push(`${feature}=(${allowListStr})`);
      }
    }
    
    return policies.join(', ');
  }

  // Generate nonce for CSP
  generateNonce() {
    const crypto = require('crypto');
    return crypto.randomBytes(16).toString('base64');
  }

  // CSP Report Handler
  handleCSPReport(req, res) {
    const report = req.body;
    
    // Log CSP violation
    console.warn('CSP Violation:', {
      timestamp: new Date().toISOString(),
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      report: report
    });

    // Store in security monitoring system
    this.logSecurityEvent({
      type: 'csp_violation',
      severity: 'medium',
      data: report,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.status(204).end();
  }

  // Certificate Transparency Report Handler
  handleCTReport(req, res) {
    const report = req.body;
    
    console.warn('CT Report:', {
      timestamp: new Date().toISOString(),
      report: report
    });

    this.logSecurityEvent({
      type: 'ct_report',
      severity: 'low',
      data: report
    });

    res.status(204).end();
  }

  // Security headers middleware
  getSecurityHeadersMiddleware() {
    return (req, res, next) => {
      const nonce = this.generateNonce();
      
      // Store nonce for template rendering
      req.nonce = nonce;
      res.locals.nonce = nonce;

      // Content Security Policy
      const csp = this.generateCSP().replace('{nonce}', nonce);
      if (this.config.csp.reportOnly) {
        res.setHeader('Content-Security-Policy-Report-Only', csp);
      } else {
        res.setHeader('Content-Security-Policy', csp);
      }

      // HTTP Strict Transport Security
      const { maxAge, includeSubDomains, preload } = this.config.hsts;
      let hstsValue = `max-age=${maxAge}`;
      if (includeSubDomains) hstsValue += '; includeSubDomains';
      if (preload) hstsValue += '; preload';
      res.setHeader('Strict-Transport-Security', hstsValue);

      // Permissions Policy
      res.setHeader('Permissions-Policy', this.generatePermissionsPolicy());

      // Cross-Origin Policies
      res.setHeader('Cross-Origin-Embedder-Policy', this.config.crossOrigin.embedderPolicy.policy);
      res.setHeader('Cross-Origin-Opener-Policy', this.config.crossOrigin.openerPolicy.policy);
      res.setHeader('Cross-Origin-Resource-Policy', this.config.crossOrigin.resourcePolicy.policy);

      // Additional Security Headers
      res.setHeader('X-Frame-Options', this.config.additional.xFrameOptions);
      res.setHeader('X-Content-Type-Options', this.config.additional.xContentTypeOptions);
      res.setHeader('X-XSS-Protection', this.config.additional.xXssProtection);
      res.setHeader('Referrer-Policy', this.config.additional.referrerPolicy);
      res.setHeader('X-Download-Options', this.config.additional.xDownloadOptions);
      res.setHeader('X-Permitted-Cross-Domain-Policies', this.config.additional.xPermittedCrossDomainPolicies);

      // Expect-CT Header
      const { maxAge: ctMaxAge, enforce, reportUri } = this.config.additional.expectCT;
      let expectCTValue = `max-age=${ctMaxAge}`;
      if (enforce) expectCTValue += ', enforce';
      if (reportUri) expectCTValue += `, report-uri="${reportUri}"`;
      res.setHeader('Expect-CT', expectCTValue);

      // Remove identifying headers
      res.removeHeader('X-Powered-By');
      res.removeHeader('Server');

      next();
    };
  }

  // Environment-specific configurations
  getEnvironmentConfig(env) {
    const configs = {
      development: {
        csp: {
          ...this.config.csp,
          reportOnly: true,
          directives: {
            ...this.config.csp.directives,
            scriptSrc: [
              ...this.config.csp.directives.scriptSrc,
              "'unsafe-eval'", // For development tools
              "localhost:*",
              "127.0.0.1:*"
            ],
            connectSrc: [
              ...this.config.csp.directives.connectSrc,
              "ws://localhost:*",
              "ws://127.0.0.1:*",
              "http://localhost:*",
              "http://127.0.0.1:*"
            ]
          }
        },
        hsts: {
          ...this.config.hsts,
          maxAge: 0 // Disable HSTS in development
        }
      },

      staging: {
        csp: {
          ...this.config.csp,
          reportOnly: true // Still testing CSP
        }
      },

      production: {
        // Use default strict configuration
        ...this.config
      }
    };

    return configs[env] || configs.production;
  }

  // Update CSP directives dynamically
  updateCSPDirective(directive, values) {
    this.config.csp.directives[directive] = Array.isArray(values) ? values : [values];
  }

  // Add allowed source to CSP directive
  addCSPSource(directive, source) {
    if (!this.config.csp.directives[directive]) {
      this.config.csp.directives[directive] = [];
    }
    
    if (!this.config.csp.directives[directive].includes(source)) {
      this.config.csp.directives[directive].push(source);
    }
  }

  // Security event logging
  logSecurityEvent(event) {
    // Implementation would integrate with security monitoring system
    const securityLog = {
      timestamp: new Date().toISOString(),
      ...event
    };

    // Log to file, SIEM, or monitoring service
    console.log('Security Event:', securityLog);
    
    // Could integrate with services like:
    // - Splunk
    // - ELK Stack
    // - DataDog
    // - Sumo Logic
  }

  // Validate CSP configuration
  validateCSP() {
    const errors = [];
    
    // Check for unsafe directives
    const unsafeDirectives = ['unsafe-inline', 'unsafe-eval'];
    for (const [directive, values] of Object.entries(this.config.csp.directives)) {
      for (const value of values) {
        if (unsafeDirectives.some(unsafe => value.includes(unsafe))) {
          errors.push(`Unsafe directive '${value}' found in ${directive}`);
        }
      }
    }

    // Check for wildcard sources
    for (const [directive, values] of Object.entries(this.config.csp.directives)) {
      if (values.includes('*')) {
        errors.push(`Wildcard source found in ${directive} - consider being more specific`);
      }
    }

    return errors;
  }

  // Initialize security headers
  initialize(app, environment = 'production') {
    // Apply environment-specific configuration
    const envConfig = this.getEnvironmentConfig(environment);
    this.config = { ...this.config, ...envConfig };

    // Validate configuration
    const cspErrors = this.validateCSP();
    if (cspErrors.length > 0) {
      console.warn('CSP Configuration Warnings:', cspErrors);
    }

    // Apply middleware
    app.use(this.getSecurityHeadersMiddleware());

    // Add report endpoints
    app.post('/api/security/csp-report', 
      express.json({ type: 'application/csp-report' }),
      this.handleCSPReport.bind(this)
    );

    app.post('/api/security/ct-report',
      express.json(),
      this.handleCTReport.bind(this)
    );

    console.log(`Security headers initialized for ${environment} environment`);
  }
}

module.exports = SecurityHeaders;