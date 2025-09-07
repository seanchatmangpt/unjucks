/**
 * Enterprise Security Module
 * Implements zero-trust security model with comprehensive security features
 */

// Export all security components
import { ZeroTrustManager } from './auth/zero-trust.js';
import { MTLSManager } from './auth/mtls.js';
import { SessionManager } from './auth/session-manager.js';
import { EncryptionService, FIPSCryptoProvider } from './crypto/encryption.js';
import { FIPSCryptoProvider as FIPSProvider } from './crypto/fips-compliant.js';
// Note: Vault and other components would be required here when converted

/**
 * Central security orchestrator implementing enterprise security patterns
 * @class
 */
class EnterpriseSecurityManager {
  /**
   * @param {import('./types').SecurityConfig} config - Security configuration
   */
  constructor(config) {
    this.config = config
    this.zeroTrust = new ZeroTrustManager(config.zeroTrust)
    this.encryption = new EncryptionService(config.encryption)
    // Additional components will be initialized when their files are converted
    // this.secrets = new SecretsManager(config.vault)
    // this.headers = new SecurityHeadersManager(config.headers)
    // this.ddosProtection = new DDoSProtection(config.protection)
    // this.vulnerabilityDetector = new VulnerabilityDetector(config.scanning)
  }

  /**
   * Initialize all security components
   * @returns {Promise<void>}
   */
  async initialize() {
    await Promise.all([
      this.zeroTrust.initialize(),
      this.encryption.initialize()
      // Additional initializations will be added as components are converted
      // this.secrets.initialize(),
      // this.headers.initialize(),
      // this.ddosProtection.initialize(),
      // this.vulnerabilityDetector.initialize()
    ])
  }

  /**
   * Validate request through zero-trust pipeline
   * @param {any} request - Request object
   * @returns {Promise<boolean>}
   */
  async validateRequest(request) {
    const checks = await Promise.all([
      this.zeroTrust.validateRequest(request)
      // Additional checks will be added as components are converted
      // this.ddosProtection.checkRequest(request),
      // this.vulnerabilityDetector.scanRequest(request)
    ])
    
    return checks.every(check => check)
  }

  /**
   * Get security health status
   * @returns {Promise<any>}
   */
  async getSecurityHealth() {
    return {
      zeroTrust: await this.zeroTrust.getHealth(),
      encryption: await this.encryption.getHealth()
      // Additional health checks will be added as components are converted
      // secrets: await this.secrets.getHealth(),
      // protection: await this.ddosProtection.getHealth(),
      // vulnerabilities: await this.vulnerabilityDetector.getHealth()
    }
  }
}

// Import and re-export types
import { SecurityEventType, SecuritySeverity, ReferrerPolicyTypes } from './types.js';

// Export individual components
export {
  // Auth components
  ZeroTrustManager,
  MTLSManager,
  SessionManager,
  
  // Crypto components
  EncryptionService,
  FIPSCryptoProvider,
  
  // Main orchestrator
  EnterpriseSecurityManager,
  
  // Types and enums
  SecurityEventType,
  SecuritySeverity,
  ReferrerPolicyTypes
};

/**
 * @typedef {import('./types').SecurityConfig} SecurityConfig
 */