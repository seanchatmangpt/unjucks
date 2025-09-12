/**
 * Mutual TLS (mTLS) Authentication Implementation
 * Provides certificate-based authentication and validation
 */

import { readFileSync } from 'fs';
import { createSecureContext } from 'tls';
import { SecurityEventType, SecuritySeverity } from '../types.js';

/**
 * Mutual TLS Manager
 * @class
 */
class MTLSManager {
  /**
   * @param {string} certPath - Server certificate path
   * @param {string} keyPath - Server key path  
   * @param {string} caPath - CA certificates path
   * @param {boolean} [verifyClient=true] - Whether to verify client certificates
   */
  constructor(certPath, keyPath, caPath, verifyClient = true) {
    this.certPath = certPath
    this.keyPath = keyPath
    this.caPath = caPath
    this.verifyClient = verifyClient
    
    /** @private @type {string[]} */
    this.caCertificates = []
    /** @private @type {string} */
    this.serverCert = ''
    /** @private @type {string} */
    this.serverKey = ''
    /** @private @type {Map<string, Certificate>} */
    this.clientCertificates = new Map()
  }

  /**
   * Initialize mTLS manager
   * @returns {Promise<void>}
   */
  async initialize() {
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
   * @returns {any}
   */
  createSecureContext() {
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
   * @param {any} socket - TLS socket
   * @returns {Promise<boolean>}
   */
  async verifyClientCertificate(socket) {
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
    const certificate = {
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
   * @private
   * @param {Certificate} cert - Certificate to validate
   * @param {any} socket - TLS socket
   * @returns {Promise<boolean>}
   */
  async validateCertificate(cert, socket) {
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
   * @private
   * @param {Certificate} cert - Certificate to check
   * @returns {Promise<boolean>}
   */
  async checkCertificateExpiry(cert) {
    const now = this.getDeterministicDate()
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
   * @private
   * @param {Certificate} cert - Certificate to check
   * @returns {Promise<boolean>}
   */
  async checkCertificateRevocation(cert) {
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
   * @private
   * @param {Certificate} cert - Certificate to validate
   * @param {any} socket - TLS socket
   * @returns {Promise<boolean>}
   */
  async checkCertificateChain(cert, socket) {
    return socket.authorized
  }

  /**
   * Check certificate against organizational policies
   * @private
   * @param {Certificate} cert - Certificate to check
   * @returns {Promise<boolean>}
   */
  async checkCertificatePolicies(cert) {
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
   * @private
   * @param {string} serialNumber - Certificate serial number
   * @returns {Promise<boolean>}
   */
  async queryRevocationStatus(serialNumber) {
    // Implement OCSP/CRL lookup
    // This is a placeholder implementation
    return true
  }

  /**
   * Parse certificate bundle
   * @private
   * @param {string} bundle - Certificate bundle content
   * @returns {string[]}
   */
  parseCertificateBundle(bundle) {
    const certs = []
    const certRegex = /-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g
    let match

    while ((match = certRegex.exec(bundle)) !== null) {
      certs.push(match[0])
    }

    return certs
  }

  /**
   * Custom server identity check
   * @private
   * @param {string} hostname - Hostname to verify
   * @param {any} cert - Certificate object
   * @returns {Error|undefined}
   */
  checkServerIdentity(hostname, cert) {
    // Implement custom hostname verification logic
    if (!cert.subject.CN && !cert.subjectaltname) {
      return new Error('Certificate has no subject CN or SAN')
    }

    // Check if hostname matches CN or SAN
    const validNames = [cert.subject.CN]
    if (cert.subjectaltname) {
      const sanNames = cert.subjectaltname.split(', ').map(san => 
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
   * @private
   * @returns {Promise<void>}
   */
  async validateCertificates() {
    // Validate server certificate
    const serverCert = this.parseCertificateInfo(this.serverCert)
    const now = this.getDeterministicDate()

    if (serverCert.validTo < now) {
      throw new Error('Server certificate has expired')
    }

    if (serverCert.validTo.getTime() - now.getTime() < 30 * 24 * 60 * 60 * 1000) {
      console.warn('Server certificate expires in less than 30 days')
    }
  }

  /**
   * Parse certificate information
   * @private
   * @param {string} certPem - Certificate PEM data
   * @returns {Certificate}
   */
  parseCertificateInfo(certPem) {
    // In production, use a proper X.509 parser
    // This is a simplified implementation
    return {
      subject: 'Server Certificate',
      issuer: 'Internal CA',
      validFrom: this.getDeterministicDate(),
      validTo: new Date(this.getDeterministicTimestamp() + 365 * 24 * 60 * 60 * 1000),
      serialNumber: 'placeholder',
      fingerprint: 'placeholder',
      isValid: true
    }
  }

  /**
   * Get certificate information
   * @param {string} fingerprint - Certificate fingerprint
   * @returns {Certificate|undefined}
   */
  getCertificateInfo(fingerprint) {
    return this.clientCertificates.get(fingerprint)
  }

  /**
   * List all client certificates
   * @returns {Certificate[]}
   */
  getClientCertificates() {
    return Array.from(this.clientCertificates.values())
  }

  /**
   * Revoke client certificate
   * @param {string} fingerprint - Certificate fingerprint
   * @returns {Promise<boolean>}
   */
  async revokeCertificate(fingerprint) {
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
   * @returns {Promise<any>}
   */
  async getHealth() {
    const serverCert = this.parseCertificateInfo(this.serverCert)
    const now = this.getDeterministicDate()
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
   * @private
   * @param {Omit<SecurityEvent, 'id' | 'timestamp'>} event - Event data
   * @returns {Promise<void>}
   */
  async logSecurityEvent(event) {
    // Implementation would send to centralized logging
    console.warn(`mTLS Security Event: ${event.type} - ${event.description}`)
  }
}

export { MTLSManager };

/**
 * @typedef {Object} Certificate
 * @property {string} subject
 * @property {string} issuer
 * @property {Date} validFrom
 * @property {Date} validTo
 * @property {string} serialNumber
 * @property {string} fingerprint
 * @property {boolean} isValid
 */

/**
 * @typedef {Object} SecurityEvent
 * @property {string} id
 * @property {Date} timestamp
 * @property {string} type
 * @property {string} severity
 * @property {string} source
 * @property {string} description
 * @property {Record<string, any>} metadata
 */