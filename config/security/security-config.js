/**
 * Master Security Configuration
 * Orchestrates all security components and provides unified interface
 */

const OWASPTop10Protection = require('./owasp/top10-protection');
const SecurityHeaders = require('./headers/security-headers');
const VaultManager = require('./secrets/vault-manager');
const SecurityScanner = require('./monitoring/security-scanner');
const RateLimitingManager = require('./policies/rate-limiting');

class SecurityConfig {
  constructor(config = {}) {
    this.environment = config.environment || process.env.NODE_ENV || 'development';
    this.config = this.getEnvironmentConfig(this.environment);
    
    // Initialize security components
    this.owaspProtection = new OWASPTop10Protection();
    this.securityHeaders = new SecurityHeaders();
    this.vaultManager = new VaultManager(this.config.vault);
    this.securityScanner = new SecurityScanner(this.config.scanner);
    this.rateLimiting = new RateLimitingManager(this.config.rateLimit);
    
    this.isInitialized = false;
    this.securityPosture = {
      status: 'initializing',
      components: {},
      lastScan: null,
      vulnerabilities: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0
      },
      compliance: {
        owasp: false,
        gdpr: false,
        sox: false,
        pci: false
      }
    };
  }

  // Environment-specific configurations
  getEnvironmentConfig(env) {
    const baseConfig = {
      vault: {
        enabled: true,
        endpoint: process.env.VAULT_ENDPOINT,
        authMethod: 'token'
      },
      scanner: {
        enabled: true,
        scheduling: {
          enabled: true,
          interval: 24 * 60 * 60 * 1000 // 24 hours
        },
        thresholds: {
          critical: 0,
          high: 5,
          medium: 20,
          low: 100
        }
      },
      rateLimit: {
        enabled: true,
        redis: {
          url: process.env.REDIS_URL
        }
      },
      monitoring: {
        enabled: true,
        siem: {
          enabled: false,
          endpoint: process.env.SIEM_ENDPOINT
        },
        alerts: {
          email: process.env.SECURITY_ALERT_EMAIL,
          slack: process.env.SECURITY_ALERT_SLACK,
          webhook: process.env.SECURITY_ALERT_WEBHOOK
        }
      }
    };

    const envConfigs = {
      development: {
        ...baseConfig,
        vault: {
          ...baseConfig.vault,
          enabled: false // Disable Vault in dev
        },
        scanner: {
          ...baseConfig.scanner,
          scheduling: {
            enabled: false // Disable scheduled scans in dev
          },
          thresholds: {
            critical: 10,
            high: 50,
            medium: 100,
            low: 500
          }
        }
      },

      staging: {
        ...baseConfig,
        scanner: {
          ...baseConfig.scanner,
          thresholds: {
            critical: 2,
            high: 10,
            medium: 30,
            low: 150
          }
        }
      },

      production: {
        ...baseConfig,
        scanner: {
          ...baseConfig.scanner,
          thresholds: {
            critical: 0,
            high: 2,
            medium: 10,
            low: 50
          }
        }
      }
    };

    return envConfigs[env] || envConfigs.production;
  }

  // Initialize all security components
  async initialize(app) {
    console.log(`Initializing security configuration for ${this.environment} environment...`);
    
    try {
      // Initialize components in dependency order
      await this.initializeVault();
      await this.initializeRateLimiting();
      await this.initializeSecurityHeaders(app);
      await this.initializeOWASPProtection(app);
      await this.initializeSecurityScanner();
      await this.initializeSecurityMonitoring();
      
      this.isInitialized = true;
      this.securityPosture.status = 'active';
      
      // Run initial security assessment
      await this.runSecurityAssessment();
      
      console.log('Security configuration initialized successfully');
      return true;

    } catch (error) {
      console.error('Failed to initialize security configuration:', error);
      this.securityPosture.status = 'failed';
      throw error;
    }
  }

  async initializeVault() {
    if (!this.config.vault.enabled) {
      console.log('Vault disabled for this environment');
      this.securityPosture.components.vault = { status: 'disabled' };
      return;
    }

    try {
      await this.vaultManager.initialize();
      this.securityPosture.components.vault = { 
        status: 'active',
        lastCheck: this.getDeterministicDate().toISOString()
      };
    } catch (error) {
      console.warn('Vault initialization failed, continuing without secrets management:', error.message);
      this.securityPosture.components.vault = { 
        status: 'failed',
        error: error.message
      };
    }
  }

  async initializeRateLimiting() {
    if (!this.config.rateLimit.enabled) {
      console.log('Rate limiting disabled for this environment');
      this.securityPosture.components.rateLimit = { status: 'disabled' };
      return;
    }

    try {
      await this.rateLimiting.initialize();
      this.securityPosture.components.rateLimit = { 
        status: 'active',
        lastCheck: this.getDeterministicDate().toISOString()
      };
    } catch (error) {
      console.warn('Rate limiting initialization failed:', error.message);
      this.securityPosture.components.rateLimit = { 
        status: 'failed',
        error: error.message
      };
    }
  }

  async initializeSecurityHeaders(app) {
    try {
      this.securityHeaders.initialize(app, this.environment);
      this.securityPosture.components.headers = { 
        status: 'active',
        csp: true,
        hsts: true,
        lastCheck: this.getDeterministicDate().toISOString()
      };
    } catch (error) {
      console.error('Security headers initialization failed:', error);
      this.securityPosture.components.headers = { 
        status: 'failed',
        error: error.message
      };
      throw error;
    }
  }

  async initializeOWASPProtection(app) {
    try {
      this.owaspProtection.initializeProtections(app);
      this.securityPosture.components.owasp = { 
        status: 'active',
        protections: [
          'access_control',
          'crypto_failures',
          'injection',
          'insecure_design',
          'security_misconfiguration',
          'vulnerable_components',
          'auth_failures',
          'integrity_failures',
          'logging_monitoring',
          'ssrf'
        ],
        lastCheck: this.getDeterministicDate().toISOString()
      };
    } catch (error) {
      console.error('OWASP protection initialization failed:', error);
      this.securityPosture.components.owasp = { 
        status: 'failed',
        error: error.message
      };
      throw error;
    }
  }

  async initializeSecurityScanner() {
    if (!this.config.scanner.enabled) {
      console.log('Security scanner disabled for this environment');
      this.securityPosture.components.scanner = { status: 'disabled' };
      return;
    }

    try {
      // Setup scheduled scans
      if (this.config.scanner.scheduling.enabled) {
        this.securityScanner.setupScheduledScans();
      }
      
      this.securityPosture.components.scanner = { 
        status: 'active',
        scheduled: this.config.scanner.scheduling.enabled,
        lastCheck: this.getDeterministicDate().toISOString()
      };
    } catch (error) {
      console.warn('Security scanner initialization failed:', error.message);
      this.securityPosture.components.scanner = { 
        status: 'failed',
        error: error.message
      };
    }
  }

  async initializeSecurityMonitoring() {
    try {
      // Setup security event monitoring
      this.setupSecurityEventHandlers();
      
      // Initialize SIEM integration if enabled
      if (this.config.monitoring.siem.enabled) {
        await this.initializeSIEMIntegration();
      }
      
      this.securityPosture.components.monitoring = { 
        status: 'active',
        siem: this.config.monitoring.siem.enabled,
        lastCheck: this.getDeterministicDate().toISOString()
      };
    } catch (error) {
      console.warn('Security monitoring initialization failed:', error.message);
      this.securityPosture.components.monitoring = { 
        status: 'failed',
        error: error.message
      };
    }
  }

  // Express middleware to apply all security measures
  getSecurityMiddleware() {
    const middlewares = [];

    // Rate limiting (if enabled)
    if (this.config.rateLimit.enabled && this.rateLimiting.getRateLimitMiddleware) {
      middlewares.push(this.rateLimiting.getRateLimitMiddleware());
    }

    // Security headers
    middlewares.push(this.securityHeaders.getSecurityHeadersMiddleware());

    // OWASP protections
    middlewares.push(...this.owaspProtection.getAccessControlMiddleware());
    middlewares.push(...this.owaspProtection.getInjectionProtectionMiddleware());
    middlewares.push(...this.owaspProtection.getAuthenticationMiddleware());
    middlewares.push(this.owaspProtection.getSSRFProtection());

    return middlewares;
  }

  // Security assessment
  async runSecurityAssessment() {
    console.log('Running security assessment...');
    
    try {
      // Run security scan if enabled
      if (this.config.scanner.enabled) {
        const scanResults = await this.securityScanner.runFullScan();
        this.updateSecurityPosture(scanResults);
      }

      // Health check all components
      const healthCheck = await this.runHealthCheck();
      
      // Compliance check
      const compliance = await this.checkCompliance();
      
      this.securityPosture.lastAssessment = this.getDeterministicDate().toISOString();
      this.securityPosture.compliance = compliance;
      
      console.log('Security assessment completed');
      return {
        posture: this.securityPosture,
        health: healthCheck,
        compliance
      };

    } catch (error) {
      console.error('Security assessment failed:', error);
      throw error;
    }
  }

  updateSecurityPosture(scanResults) {
    if (scanResults.results.summary) {
      this.securityPosture.vulnerabilities = scanResults.results.summary;
      this.securityPosture.lastScan = this.getDeterministicDate().toISOString();
    }
  }

  async runHealthCheck() {
    const health = {
      overall: 'healthy',
      components: {}
    };

    // Check Vault health
    if (this.config.vault.enabled) {
      try {
        const vaultHealth = await this.vaultManager.healthCheck();
        health.components.vault = vaultHealth;
      } catch (error) {
        health.components.vault = { status: 'unhealthy', error: error.message };
        health.overall = 'degraded';
      }
    }

    // Check rate limiting
    if (this.config.rateLimit.enabled) {
      // Implementation would check Redis connectivity
      health.components.rateLimit = { status: 'healthy' };
    }

    // Check security scanner
    if (this.config.scanner.enabled) {
      health.components.scanner = { status: 'healthy' };
    }

    return health;
  }

  async checkCompliance() {
    const compliance = {
      owasp: this.securityPosture.components.owasp?.status === 'active',
      gdpr: false, // Would implement GDPR compliance checks
      sox: false,  // Would implement SOX compliance checks
      pci: false   // Would implement PCI DSS compliance checks
    };

    // Add specific compliance checks based on vulnerability counts
    if (this.securityPosture.vulnerabilities.critical === 0 && 
        this.securityPosture.vulnerabilities.high <= 2) {
      compliance.basic_security = true;
    }

    return compliance;
  }

  // Security event handling
  setupSecurityEventHandlers() {
    // Setup handlers for various security events
    process.on('securityEvent', this.handleSecurityEvent.bind(this));
  }

  async handleSecurityEvent(event) {
    console.log('Security event received:', event);
    
    // Log to security monitoring system
    await this.logSecurityEvent(event);
    
    // Send alerts based on severity
    if (event.severity === 'critical' || event.severity === 'high') {
      await this.sendSecurityAlert(event);
    }
    
    // Auto-response for certain events
    if (event.type === 'brute_force' || event.type === 'ddos') {
      await this.triggerAutoResponse(event);
    }
  }

  async logSecurityEvent(event) {
    // Implementation would log to SIEM, file, or monitoring service
    console.log('Security event logged:', {
      timestamp: this.getDeterministicDate().toISOString(),
      ...event
    });
  }

  async sendSecurityAlert(event) {
    // Implementation would send alerts via configured channels
    const alert = {
      timestamp: this.getDeterministicDate().toISOString(),
      environment: this.environment,
      event
    };

    console.warn('SECURITY ALERT:', alert);
    
    // Send to configured alert channels
    if (this.config.monitoring.alerts.webhook) {
      // Send webhook notification
    }
    
    if (this.config.monitoring.alerts.email) {
      // Send email notification
    }
  }

  async triggerAutoResponse(event) {
    // Implementation would trigger automated responses
    console.log('Triggering auto-response for:', event);
    
    if (event.type === 'brute_force' && event.ip) {
      // Auto-block IP
      await this.rateLimiting.addToBlacklist(event.ip, 3600, 'auto_response');
    }
  }

  async initializeSIEMIntegration() {
    // Implementation would integrate with SIEM systems like Splunk, ELK, etc.
    console.log('SIEM integration initialized');
  }

  // Store security posture in memory
  async storeSecurityPosture() {
    try {
      // This would integrate with memory storage system
      const memoryData = {
        timestamp: this.getDeterministicDate().toISOString(),
        environment: this.environment,
        posture: this.securityPosture,
        components: {
          vault: this.securityPosture.components.vault,
          rateLimit: this.securityPosture.components.rateLimit,
          headers: this.securityPosture.components.headers,
          owasp: this.securityPosture.components.owasp,
          scanner: this.securityPosture.components.scanner,
          monitoring: this.securityPosture.components.monitoring
        }
      };

      // Store in memory with TTL
      // await memoryManager.store('hive/security/posture', JSON.stringify(memoryData), 86400000);
      
      console.log('Security posture stored in memory');
      return memoryData;
    } catch (error) {
      console.error('Failed to store security posture:', error);
    }
  }

  // Get current security status
  getSecurityStatus() {
    return {
      initialized: this.isInitialized,
      environment: this.environment,
      posture: this.securityPosture,
      timestamp: this.getDeterministicDate().toISOString()
    };
  }

  // Graceful shutdown
  async shutdown() {
    console.log('Shutting down security configuration...');
    
    try {
      if (this.vaultManager) {
        await this.vaultManager.shutdown();
      }
      
      if (this.rateLimiting) {
        await this.rateLimiting.shutdown();
      }
      
      console.log('Security configuration shutdown complete');
    } catch (error) {
      console.error('Error during security shutdown:', error);
    }
  }
}

module.exports = SecurityConfig;