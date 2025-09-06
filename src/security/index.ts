/**
 * Enterprise Security Module
 * Implements zero-trust security model with comprehensive security features
 */

export * from './auth/zero-trust'
export * from './auth/mtls'
export * from './auth/session-manager'
export * from './crypto/encryption'
export * from './crypto/fips-compliant'
export * from './vault/secrets-manager'
export * from './headers/security-headers'
export * from './headers/csp-policies'
export * from './protection/ddos-protection'
export * from './protection/rate-limiter'
export * from './protection/injection-prevention'
export * from './scanning/vulnerability-detector'
export * from './scanning/security-scanner'

import { SecurityConfig } from './types'
import { ZeroTrustManager } from './auth/zero-trust'
import { EncryptionService } from './crypto/encryption'
import { SecretsManager } from './vault/secrets-manager'
import { SecurityHeadersManager } from './headers/security-headers'
import { DDoSProtection } from './protection/ddos-protection'
import { VulnerabilityDetector } from './scanning/vulnerability-detector'

/**
 * Central security orchestrator implementing enterprise security patterns
 */
export class EnterpriseSecurityManager {
  private zeroTrust: ZeroTrustManager
  private encryption: EncryptionService
  private secrets: SecretsManager
  private headers: SecurityHeadersManager
  private ddosProtection: DDoSProtection
  private vulnerabilityDetector: VulnerabilityDetector

  constructor(private config: SecurityConfig) {
    this.zeroTrust = new ZeroTrustManager(config.zeroTrust)
    this.encryption = new EncryptionService(config.encryption)
    this.secrets = new SecretsManager(config.vault)
    this.headers = new SecurityHeadersManager(config.headers)
    this.ddosProtection = new DDoSProtection(config.protection)
    this.vulnerabilityDetector = new VulnerabilityDetector(config.scanning)
  }

  /**
   * Initialize all security components
   */
  async initialize(): Promise<void> {
    await Promise.all([
      this.zeroTrust.initialize(),
      this.encryption.initialize(),
      this.secrets.initialize(),
      this.headers.initialize(),
      this.ddosProtection.initialize(),
      this.vulnerabilityDetector.initialize()
    ])
  }

  /**
   * Validate request through zero-trust pipeline
   */
  async validateRequest(request: any): Promise<boolean> {
    const checks = await Promise.all([
      this.zeroTrust.validateRequest(request),
      this.ddosProtection.checkRequest(request),
      this.vulnerabilityDetector.scanRequest(request)
    ])
    
    return checks.every(check => check)
  }

  /**
   * Get security health status
   */
  async getSecurityHealth(): Promise<any> {
    return {
      zeroTrust: await this.zeroTrust.getHealth(),
      encryption: await this.encryption.getHealth(),
      secrets: await this.secrets.getHealth(),
      protection: await this.ddosProtection.getHealth(),
      vulnerabilities: await this.vulnerabilityDetector.getHealth()
    }
  }
}