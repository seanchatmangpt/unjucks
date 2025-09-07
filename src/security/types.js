/**
 * Security Configuration Types and Interfaces
 */

/**
 * Security event types enum
 */
const SecurityEventType = {
  AUTHENTICATION_FAILURE: 'AUTHENTICATION_FAILURE',
  AUTHORIZATION_FAILURE: 'AUTHORIZATION_FAILURE',
  SUSPICIOUS_REQUEST: 'SUSPICIOUS_REQUEST',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  INJECTION_ATTEMPT: 'INJECTION_ATTEMPT',
  VULNERABILITY_DETECTED: 'VULNERABILITY_DETECTED',
  CERTIFICATE_EXPIRING: 'CERTIFICATE_EXPIRING',
  CONFIGURATION_CHANGE: 'CONFIGURATION_CHANGE'
}

/**
 * Security severity levels enum
 */
const SecuritySeverity = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL'
}

/**
 * Referrer Policy types
 */
const ReferrerPolicyTypes = [
  'no-referrer',
  'no-referrer-when-downgrade', 
  'origin',
  'origin-when-cross-origin',
  'same-origin',
  'strict-origin',
  'strict-origin-when-cross-origin',
  'unsafe-url'
]

export {
  SecurityEventType,
  SecuritySeverity,
  ReferrerPolicyTypes
};

/**
 * @typedef {Object} SecurityConfig
 * @property {ZeroTrustConfig} zeroTrust
 * @property {EncryptionConfig} encryption
 * @property {VaultConfig} vault
 * @property {SecurityHeadersConfig} headers
 * @property {ProtectionConfig} protection
 * @property {ScanningConfig} scanning
 */

/**
 * @typedef {Object} ZeroTrustConfig
 * @property {boolean} enabled
 * @property {boolean} strictMode
 * @property {Object} mTLS
 * @property {boolean} mTLS.enabled
 * @property {string} mTLS.certPath
 * @property {string} mTLS.keyPath
 * @property {string} mTLS.caPath
 * @property {boolean} mTLS.verifyClient
 * @property {Object} deviceTrust
 * @property {boolean} deviceTrust.enabled
 * @property {boolean} deviceTrust.fingerprintValidation
 * @property {boolean} deviceTrust.deviceRegistration
 * @property {Object} networkSegmentation
 * @property {boolean} networkSegmentation.enabled
 * @property {string[]} networkSegmentation.allowedNetworks
 * @property {boolean} networkSegmentation.denyByDefault
 */

/**
 * @typedef {Object} EncryptionConfig
 * @property {boolean} fipsCompliant
 * @property {'AES-256-GCM'|'ChaCha20-Poly1305'} algorithm
 * @property {number} keyRotationInterval
 * @property {boolean} encryptionAtRest
 * @property {boolean} encryptionInTransit
 */

/**
 * @typedef {Object} VaultConfig
 * @property {boolean} enabled
 * @property {string} url
 * @property {string} [roleId]
 * @property {string} [secretId]
 * @property {string} [namespace]
 * @property {string} mountPath
 * @property {Object} keyRotation
 * @property {boolean} keyRotation.enabled
 * @property {number} keyRotation.interval
 */

/**
 * @typedef {Object} SecurityHeadersConfig
 * @property {Object} hsts
 * @property {boolean} hsts.enabled
 * @property {number} hsts.maxAge
 * @property {boolean} hsts.includeSubDomains
 * @property {boolean} hsts.preload
 * @property {Object} csp
 * @property {boolean} csp.enabled
 * @property {boolean} csp.reportOnly
 * @property {CSPPolicy} csp.policy
 * @property {'DENY'|'SAMEORIGIN'|'ALLOW-FROM'} frameOptions
 * @property {boolean} contentTypeOptions
 * @property {string} referrerPolicy
 * @property {PermissionsPolicy} permissionsPolicy
 */

/**
 * @typedef {Object} CSPPolicy
 * @property {string[]} defaultSrc
 * @property {string[]} scriptSrc
 * @property {string[]} styleSrc
 * @property {string[]} imgSrc
 * @property {string[]} connectSrc
 * @property {string[]} fontSrc
 * @property {string[]} objectSrc
 * @property {string[]} mediaSrc
 * @property {string[]} frameSrc
 * @property {string} [reportUri]
 */

/**
 * @typedef {Object} PermissionsPolicy
 * @property {'self'|'none'|string[]} geolocation
 * @property {'self'|'none'|string[]} camera
 * @property {'self'|'none'|string[]} microphone
 * @property {'self'|'none'|string[]} notifications
 */

/**
 * @typedef {Object} ProtectionConfig
 * @property {Object} ddos
 * @property {boolean} ddos.enabled
 * @property {number} ddos.maxRequestsPerMinute
 * @property {number} ddos.maxRequestsPerHour
 * @property {number} ddos.blockDuration
 * @property {Object} rateLimit
 * @property {boolean} rateLimit.enabled
 * @property {number} rateLimit.windowMs
 * @property {number} rateLimit.maxRequests
 * @property {boolean} rateLimit.skipSuccessfulRequests
 * @property {Object} injectionPrevention
 * @property {boolean} injectionPrevention.sqlInjection
 * @property {boolean} injectionPrevention.xssProtection
 * @property {boolean} injectionPrevention.commandInjection
 * @property {boolean} injectionPrevention.pathTraversal
 */

/**
 * @typedef {Object} ScanningConfig
 * @property {Object} vulnerability
 * @property {boolean} vulnerability.enabled
 * @property {boolean} vulnerability.realTimeScanning
 * @property {boolean} vulnerability.scheduledScans
 * @property {number} vulnerability.scanInterval
 * @property {Object} malware
 * @property {boolean} malware.enabled
 * @property {boolean} malware.scanUploads
 * @property {number} malware.quarantineThreshold
 * @property {Object} compliance
 * @property {boolean} compliance.fips140
 * @property {boolean} compliance.sox
 * @property {boolean} compliance.pci
 * @property {boolean} compliance.gdpr
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

/**
 * @typedef {Object} SecurityMetrics
 * @property {number} requestsBlocked
 * @property {number} vulnerabilitiesDetected
 * @property {'VALID'|'EXPIRING'|'EXPIRED'} certificateStatus
 * @property {number} encryptionStrength
 * @property {number} complianceScore
 * @property {string} threatLevel
 */

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
 * @typedef {Object} TrustDevice
 * @property {string} id
 * @property {string} fingerprint
 * @property {Date} lastSeen
 * @property {number} trustScore
 * @property {string} ipAddress
 * @property {string} userAgent
 * @property {boolean} isRegistered
 */