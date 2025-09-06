/**
 * Mutual TLS (mTLS) Authentication Implementation
 * Provides certificate-based authentication and validation
 */

import { readFileSync } from 'fs'
import { createSecureContext, TLSSocket } from 'tls'
import { Certificate, SecurityEvent, SecurityEventType, SecuritySeverity } from '../types'

export class MTLSManager {
  private caCertificates: string[] = []
  private serverCert: string = ''
  private serverKey: string = ''
  private clientCertificates = new Map<string, Certificate>()

  constructor(
    private certPath: string,
    private keyPath: string,
    private caPath: string,
    private verifyClient: boolean = true
  ) {}

  async initialize(): Promise<void> {
    try {
      // Load server certificate and key
      this.serverCert = readFileSync(this.certPath, 'utf8')
      this.serverKey = readFileSync(this.keyPath, 'utf8')

      // Load CA certificates
      const caContent = readFileSync(this.caPath, 'utf8')
      this.caCertificates = this.parseCertificateBundle(caContent)

      await this.validateCertificates()
    } catch (error) {
      throw new Error(`Failed to initialize mTLS: ${error.message}`)
    }
  }

  /**
   * Create secure TLS context
   */
  createSecureContext(): any {
    return createSecureContext({
      cert: this.serverCert,
      key: this.serverKey,
      ca: this.caCertificates,
      requestCert: this.verifyClient,
      rejectUnauthorized: this.verifyClient,
      checkServerIdentity: this.checkServerIdentity.bind(this)
    })
  }

  /**
   * Verify client certificate
   */
  async verifyClientCertificate(socket: TLSSocket): Promise<boolean> {
    if (!this.verifyClient) return true

    const peerCert = socket.getPeerCertificate(true)
    if (!peerCert || Object.keys(peerCert).length === 0) {
      await this.logSecurityEvent({
        type: SecurityEventType.AUTHENTICATION_FAILURE,
        severity: SecuritySeverity.HIGH,
        source: socket.remoteAddress || 'unknown',
        description: 'Client certificate missing',
        metadata: { remotePort: socket.remotePort }
      })
      return false
    }

    // Parse certificate details
    const certificate: Certificate = {
      subject: peerCert.subject.CN || peerCert.subject.O || 'Unknown',
      issuer: peerCert.issuer.CN || peerCert.issuer.O || 'Unknown',
      validFrom: new Date(peerCert.valid_from),
      validTo: new Date(peerCert.valid_to),
      serialNumber: peerCert.serialNumber,
      fingerprint: peerCert.fingerprint,
      isValid: socket.authorized
    }

    // Validate certificate
    const isValid = await this.validateCertificate(certificate, socket)
    
    if (isValid) {
      this.clientCertificates.set(certificate.fingerprint, certificate)
    }

    return isValid
  }

  /**
   * Validate certificate against policies
   */
  private async validateCertificate(cert: Certificate, socket: TLSSocket): Promise<boolean> {
    const validations = await Promise.all([
      this.checkCertificateExpiry(cert),
      this.checkCertificateRevocation(cert),
      this.checkCertificateChain(cert, socket),
      this.checkCertificatePolicies(cert)
    ])

    const isValid = validations.every(v => v)

    if (!isValid) {
      await this.logSecurityEvent({
        type: SecurityEventType.AUTHENTICATION_FAILURE,
        severity: SecuritySeverity.HIGH,
        source: socket.remoteAddress || 'unknown',
        description: 'Client certificate validation failed',
        metadata: {
          subject: cert.subject,
          issuer: cert.issuer,
          serialNumber: cert.serialNumber,
          fingerprint: cert.fingerprint
        }
      })
    }

    return isValid
  }

  /**
   * Check certificate expiry
   */
  private async checkCertificateExpiry(cert: Certificate): Promise<boolean> {
    const now = new Date()
    const isValid = cert.validFrom <= now && cert.validTo > now

    if (!isValid) {
      const daysToExpiry = Math.ceil((cert.validTo.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      
      await this.logSecurityEvent({
        type: SecurityEventType.CERTIFICATE_EXPIRING,
        severity: daysToExpiry < 0 ? SecuritySeverity.CRITICAL : SecuritySeverity.MEDIUM,
        source: 'certificate-monitor',
        description: `Certificate ${daysToExpiry < 0 ? 'expired' : 'expiring'} (${daysToExpiry} days)`,
        metadata: {
          subject: cert.subject,
          validTo: cert.validTo.toISOString(),
          daysToExpiry
        }
      })
    }

    return isValid
  }

  /**
   * Check certificate revocation status
   */
  private async checkCertificateRevocation(cert: Certificate): Promise<boolean> {
    try {
      // In production, implement OCSP/CRL checking
      // This is a simplified implementation
      return await this.queryRevocationStatus(cert.serialNumber)
    } catch (error) {
      console.warn(`Failed to check revocation status: ${error.message}`)
      return true // Fail open for availability
    }
  }

  /**
   * Validate certificate chain
   */
  private async checkCertificateChain(cert: Certificate, socket: TLSSocket): Promise<boolean> {
    return socket.authorized
  }

  /**
   * Check certificate against organizational policies
   */
  private async checkCertificatePolicies(cert: Certificate): Promise<boolean> {
    // Implement organizational certificate policies
    // Example: Check if issuer is in allowed list
    const allowedIssuers = [
      'Internal CA',
      'Enterprise Root CA',
      'Trusted Partner CA'
    ]

    return allowedIssuers.some(issuer => cert.issuer.includes(issuer))
  }

  /**
   * Query certificate revocation status
   */
  private async queryRevocationStatus(serialNumber: string): Promise<boolean> {
    // Implement OCSP/CRL lookup
    // This is a placeholder implementation
    return true
  }

  /**
   * Parse certificate bundle
   */
  private parseCertificateBundle(bundle: string): string[] {
    const certs: string[] = []
    const certRegex = /-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g
    let match

    while ((match = certRegex.exec(bundle)) !== null) {
      certs.push(match[0])
    }

    return certs
  }

  /**
   * Custom server identity check
   */
  private checkServerIdentity(hostname: string, cert: any): Error | undefined {
    // Implement custom hostname verification logic
    if (!cert.subject.CN && !cert.subjectaltname) {
      return new Error('Certificate has no subject CN or SAN')
    }

    // Check if hostname matches CN or SAN
    const validNames = [cert.subject.CN]
    if (cert.subjectaltname) {
      const sanNames = cert.subjectaltname.split(', ').map((san: string) => 
        san.replace(/^DNS:/, '').replace(/^IP Address:/, '')
      )
      validNames.push(...sanNames)
    }

    const isValid = validNames.some(name => 
      name === hostname || (name.startsWith('*.') && hostname.endsWith(name.slice(1)))
    )

    return isValid ? undefined : new Error(`Hostname ${hostname} does not match certificate`)
  }

  /**
   * Validate loaded certificates
   */
  private async validateCertificates(): Promise<void> {
    // Validate server certificate
    const serverCert = this.parseCertificateInfo(this.serverCert)
    const now = new Date()

    if (serverCert.validTo < now) {
      throw new Error('Server certificate has expired')
    }

    if (serverCert.validTo.getTime() - now.getTime() < 30 * 24 * 60 * 60 * 1000) {
      console.warn('Server certificate expires in less than 30 days')
    }
  }

  /**
   * Parse certificate information
   */
  private parseCertificateInfo(certPem: string): Certificate {
    // In production, use a proper X.509 parser
    // This is a simplified implementation
    return {
      subject: 'Server Certificate',
      issuer: 'Internal CA',
      validFrom: new Date(),
      validTo: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      serialNumber: 'placeholder',
      fingerprint: 'placeholder',
      isValid: true
    }
  }

  /**
   * Get certificate information
   */
  getCertificateInfo(fingerprint: string): Certificate | undefined {
    return this.clientCertificates.get(fingerprint)
  }

  /**
   * List all client certificates
   */
  getClientCertificates(): Certificate[] {
    return Array.from(this.clientCertificates.values())
  }

  /**
   * Revoke client certificate
   */
  async revokeCertificate(fingerprint: string): Promise<boolean> {
    const cert = this.clientCertificates.get(fingerprint)
    if (!cert) return false

    cert.isValid = false

    await this.logSecurityEvent({
      type: SecurityEventType.CONFIGURATION_CHANGE,
      severity: SecuritySeverity.HIGH,
      source: 'admin',
      description: 'Client certificate revoked',
      metadata: {
        subject: cert.subject,
        serialNumber: cert.serialNumber,
        fingerprint: cert.fingerprint
      }
    })

    return true
  }

  /**
   * Get mTLS health status
   */
  async getHealth(): Promise<any> {
    const serverCert = this.parseCertificateInfo(this.serverCert)
    const now = new Date()
    const daysToExpiry = Math.ceil((serverCert.validTo.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

    return {
      serverCertificate: {
        subject: serverCert.subject,
        validTo: serverCert.validTo,
        daysToExpiry,
        isExpiring: daysToExpiry < 30
      },
      clientCertificates: this.clientCertificates.size,
      caCertificates: this.caCertificates.length,
      verificationEnabled: this.verifyClient
    }
  }

  /**
   * Log security event
   */
  private async logSecurityEvent(event: Omit<SecurityEvent, 'id' | 'timestamp'>): Promise<void> {
    // Implementation would send to centralized logging
    console.warn(`mTLS Security Event: ${event.type} - ${event.description}`)
  }
}