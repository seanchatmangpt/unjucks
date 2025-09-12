/**
 * Zero-Trust Security Model Implementation
 * Never trust, always verify principle
 */

import { createHash } from 'crypto';
import { SecurityEventType, SecuritySeverity } from '../types.js';

/**
 * Zero Trust Security Manager
 * @class
 */
class ZeroTrustManager {
  /**
   * @param {import('../types').ZeroTrustConfig} config - Zero trust configuration
   */
  constructor(config) {
    this.config = config
    /** @private @type {Map<string, TrustDevice>} */
    this.trustedDevices = new Map()
    /** @private @type {Set<string>} */
    this.networkPolicies = new Set()
    /** @private @type {SecurityEvent[]} */
    this.securityEvents = []
  }

  /**
   * Initialize zero trust manager
   * @returns {Promise<void>}
   */
  async initialize() {
    if (!this.config.enabled) return

    // Initialize network policies
    this.config.networkSegmentation.allowedNetworks.forEach(network => {
      this.networkPolicies.add(network)
    })

    // Load trusted devices from secure storage
    await this.loadTrustedDevices()
  }

  /**
   * Validate request against zero-trust policies
   * @param {any} request - Request to validate
   * @returns {Promise<boolean>}
   */
  async validateRequest(request) {
    if (!this.config.enabled) return true

    const validations = await Promise.all([
      this.validateNetwork(request.ip),
      this.validateDevice(request),
      this.validateCertificate(request),
      this.validateBehavior(request)
    ])

    const isValid = validations.every(v => v)
    
    if (!isValid) {
      await this.logSecurityEvent({
        type: SecurityEventType.AUTHORIZATION_FAILURE,
        severity: SecuritySeverity.HIGH,
        source: request.ip,
        description: 'Zero-trust validation failed',
        metadata: { request: this.sanitizeRequest(request) }
      })
    }

    return isValid
  }

  /**
   * Validate network access
   * @private
   * @param {string} ip - IP address to validate
   * @returns {Promise<boolean>}
   */
  async validateNetwork(ip) {
    if (!this.config.networkSegmentation.enabled) return true

    const isAllowed = Array.from(this.networkPolicies).some(network => {
      return this.isIPInNetwork(ip, network)
    })

    return this.config.networkSegmentation.denyByDefault ? isAllowed : true
  }

  /**
   * Validate device trust
   * @private
   * @param {any} request - Request object
   * @returns {Promise<boolean>}
   */
  async validateDevice(request) {
    if (!this.config.deviceTrust.enabled) return true

    const deviceFingerprint = this.generateDeviceFingerprint(request)
    const trustedDevice = this.trustedDevices.get(deviceFingerprint)

    if (!trustedDevice) {
      if (this.config.deviceTrust.deviceRegistration) {
        await this.registerDevice(request)
        return false // Require explicit approval for new devices
      }
      return !this.config.strictMode
    }

    // Update last seen
    trustedDevice.lastSeen = this.getDeterministicDate()
    trustedDevice.ipAddress = request.ip

    return trustedDevice.trustScore > 0.5
  }

  /**
   * Validate mTLS certificate
   * @private
   * @param {any} request - Request object
   * @returns {Promise<boolean>}
   */
  async validateCertificate(request) {
    if (!this.config.mTLS.enabled) return true

    const clientCert = request.certificate
    if (!clientCert) return false

    // Verify certificate chain
    const isValidChain = await this.verifyCertificateChain(clientCert)
    
    // Check certificate expiry
    const now = this.getDeterministicDate()
    const isNotExpired = new Date(clientCert.validTo) > now

    // Check certificate revocation
    const isNotRevoked = await this.checkCertificateRevocation(clientCert)

    return isValidChain && isNotExpired && isNotRevoked
  }

  /**
   * Validate behavioral patterns
   * @private
   * @param {any} request - Request object
   * @returns {Promise<boolean>}
   */
  async validateBehavior(request) {
    const behaviorScore = await this.calculateBehaviorScore(request)
    return behaviorScore > 0.7
  }

  /**
   * Generate device fingerprint
   * @private
   * @param {any} request - Request object
   * @returns {string}
   */
  generateDeviceFingerprint(request) {
    const fingerprint = [
      request.userAgent,
      request.acceptLanguage,
      request.acceptEncoding,
      request.dnt,
      request.connection
    ].join('|')

    return createHash('sha256').update(fingerprint).digest('hex')
  }

  /**
   * Register new device
   * @private
   * @param {any} request - Request object
   * @returns {Promise<void>}
   */
  async registerDevice(request) {
    const fingerprint = this.generateDeviceFingerprint(request)
    
    const device = {
      id: fingerprint,
      fingerprint,
      lastSeen: this.getDeterministicDate(),
      trustScore: 0.1, // Low initial trust
      ipAddress: request.ip,
      userAgent: request.userAgent,
      isRegistered: false
    }

    this.trustedDevices.set(fingerprint, device)

    await this.logSecurityEvent({
      type: SecurityEventType.AUTHENTICATION_FAILURE,
      severity: SecuritySeverity.MEDIUM,
      source: request.ip,
      description: 'New device registration required',
      metadata: { deviceFingerprint: fingerprint }
    })
  }

  /**
   * Check if IP is in network range
   * @private
   * @param {string} ip - IP address
   * @param {string} network - Network range
   * @returns {boolean}
   */
  isIPInNetwork(ip, network) {
    // Comprehensive CIDR range validation with IPv4/IPv6 support and proper subnet calculations
    try {
      if (!network || typeof network !== 'string') {
        throw new Error('Network must be a valid string');
      }
      
      if (!network.includes('/')) {
        // Direct IP comparison for single host
        return this.normalizeIP(ip) === this.normalizeIP(network);
      }
      
      const [networkIP, prefixLength] = network.split('/');
      const prefix = parseInt(prefixLength, 10);
      
      // Validate prefix length
      if (isNaN(prefix) || prefix < 0) {
        throw new Error(`Invalid prefix length: ${prefixLength}`);
      }
      
      // Detect IP version and validate accordingly
      if (this.isIPv4(ip) && this.isIPv4(networkIP)) {
        if (prefix > 32) {
          throw new Error(`Invalid IPv4 prefix length: ${prefix} (max 32)`);
        }
        return this.isIPv4InCIDR(ip, networkIP, prefix);
      } else if (this.isIPv6(ip) && this.isIPv6(networkIP)) {
        if (prefix > 128) {
          throw new Error(`Invalid IPv6 prefix length: ${prefix} (max 128)`);
        }
        return this.isIPv6InCIDR(ip, networkIP, prefix);
      } else {
        throw new Error('IP version mismatch between client IP and network range');
      }
      
    } catch (error) {
      consola.error('CIDR validation error:', {
        clientIP: ip,
        network,
        error: error.message,
        timestamp: this.getDeterministicDate().toISOString()
      });
      return false; // Fail secure
    }
  }

  /**
   * Verify certificate chain
   * @private
   * @param {any} cert - Certificate to verify
   * @returns {Promise<boolean>}
   */
  async verifyCertificateChain(cert) {
    // Implementation would verify against CA certificates
    return cert && cert.verified === true
  }

  /**
   * Check certificate revocation
   * @private
   * @param {any} cert - Certificate to check
   * @returns {Promise<boolean>}
   */
  async checkCertificateRevocation(cert) {
    // Implementation would check CRL/OCSP
    return true
  }

  /**
   * Calculate behavioral score
   * @private
   * @param {any} request - Request object
   * @returns {Promise<number>}
   */
  async calculateBehaviorScore(request) {
    let score = 1.0

    // Check request patterns
    const requestFrequency = await this.getRequestFrequency(request.ip)
    if (requestFrequency > 100) score -= 0.3

    // Check geographic consistency
    const geoConsistency = await this.checkGeographicConsistency(request.ip)
    if (!geoConsistency) score -= 0.2

    // Check time-based patterns
    const timePattern = await this.checkTimePatterns(request)
    if (!timePattern) score -= 0.1

    return Math.max(0, score)
  }

  /**
   * Get request frequency for IP
   * @private
   * @param {string} ip - IP address
   * @returns {Promise<number>}
   */
  async getRequestFrequency(ip) {
    const oneHourAgo = new Date(this.getDeterministicTimestamp() - 60 * 60 * 1000)
    return this.securityEvents.filter(event => 
      event.source === ip && event.timestamp > oneHourAgo
    ).length
  }

  /**
   * Check geographic consistency
   * @private
   * @param {string} ip - IP address
   * @returns {Promise<boolean>}
   */
  async checkGeographicConsistency(ip) {
    // Implementation would check if IP geolocation is consistent with user patterns
    return true
  }

  /**
   * Check time-based access patterns
   * @private
   * @param {any} request - Request object
   * @returns {Promise<boolean>}
   */
  async checkTimePatterns(request) {
    // Implementation would analyze if access time matches user patterns
    return true
  }

  /**
   * Load trusted devices from secure storage
   * @private
   * @returns {Promise<void>}
   */
  async loadTrustedDevices() {
    // Implementation would load from encrypted storage
  }

  /**
   * Log security event
   * @private
   * @param {Omit<SecurityEvent, 'id' | 'timestamp'>} event - Event data
   * @returns {Promise<void>}
   */
  async logSecurityEvent(event) {
    const securityEvent = {
      id: createHash('sha256').update(JSON.stringify(event) + this.getDeterministicTimestamp()).digest('hex'),
      timestamp: this.getDeterministicDate(),
      ...event
    }

    this.securityEvents.push(securityEvent)

    // In production, would send to SIEM/logging system
    console.warn(`Security Event: ${event.type} - ${event.description}`)
  }

  /**
   * Sanitize request for logging
   * @private
   * @param {any} request - Request object
   * @returns {any}
   */
  sanitizeRequest(request) {
    const { password, authorization, cookie, ...sanitized } = request
    return sanitized
  }

  /**
   * Get security health status
   * @returns {Promise<any>}
   */
  async getHealth() {
    return {
      enabled: this.config.enabled,
      trustedDevices: this.trustedDevices.size,
      securityEvents: this.securityEvents.length,
      recentEvents: this.securityEvents.slice(-10).map(e => ({
        type: e.type,
        severity: e.severity,
        timestamp: e.timestamp
      }))
    }
  }

  /**
   * Approve device registration
   * @param {string} fingerprint - Device fingerprint
   * @returns {Promise<boolean>}
   */
  async approveDevice(fingerprint) {
    const device = this.trustedDevices.get(fingerprint)
    if (!device) return false

    device.isRegistered = true
    device.trustScore = 0.8
    
    return true
  }

  /**
   * Revoke device trust
   * @param {string} fingerprint - Device fingerprint
   * @returns {Promise<boolean>}
   */
  async revokeDevice(fingerprint) {
    const device = this.trustedDevices.get(fingerprint)
    if (!device) return false

    device.trustScore = 0
    device.isRegistered = false

    await this.logSecurityEvent({
      type: SecurityEventType.CONFIGURATION_CHANGE,
      severity: SecuritySeverity.HIGH,
      source: 'system',
      description: `Device trust revoked: ${fingerprint}`,
      metadata: { deviceFingerprint: fingerprint }
    })

    return true
  }
}

export { ZeroTrustManager };

/**
 * @typedef {Object} TrustDevice
 * @property {string} id
 * @property {string} fingerprint
 * @property {Date} lastSeen
 * @property {number} trustScore
 * @property {string} ipAddress
 * @property {string} userAgent
 * @property {boolean} isRegistered
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