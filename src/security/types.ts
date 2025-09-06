/**
 * Security Configuration Types and Interfaces
 */

export interface SecurityConfig {
  zeroTrust: ZeroTrustConfig
  encryption: EncryptionConfig
  vault: VaultConfig
  headers: SecurityHeadersConfig
  protection: ProtectionConfig
  scanning: ScanningConfig
}

export interface ZeroTrustConfig {
  enabled: boolean
  strictMode: boolean
  mTLS: {
    enabled: boolean
    certPath: string
    keyPath: string
    caPath: string
    verifyClient: boolean
  }
  deviceTrust: {
    enabled: boolean
    fingerprintValidation: boolean
    deviceRegistration: boolean
  }
  networkSegmentation: {
    enabled: boolean
    allowedNetworks: string[]
    denyByDefault: boolean
  }
}

export interface EncryptionConfig {
  fipsCompliant: boolean
  algorithm: 'AES-256-GCM' | 'ChaCha20-Poly1305'
  keyRotationInterval: number
  encryptionAtRest: boolean
  encryptionInTransit: boolean
}

export interface VaultConfig {
  enabled: boolean
  url: string
  roleId?: string
  secretId?: string
  namespace?: string
  mountPath: string
  keyRotation: {
    enabled: boolean
    interval: number
  }
}

export interface SecurityHeadersConfig {
  hsts: {
    enabled: boolean
    maxAge: number
    includeSubDomains: boolean
    preload: boolean
  }
  csp: {
    enabled: boolean
    reportOnly: boolean
    policy: CSPPolicy
  }
  frameOptions: 'DENY' | 'SAMEORIGIN' | 'ALLOW-FROM'
  contentTypeOptions: boolean
  referrerPolicy: ReferrerPolicy
  permissionsPolicy: PermissionsPolicy
}

export interface CSPPolicy {
  defaultSrc: string[]
  scriptSrc: string[]
  styleSrc: string[]
  imgSrc: string[]
  connectSrc: string[]
  fontSrc: string[]
  objectSrc: string[]
  mediaSrc: string[]
  frameSrc: string[]
  reportUri?: string
}

export interface PermissionsPolicy {
  geolocation: 'self' | 'none' | string[]
  camera: 'self' | 'none' | string[]
  microphone: 'self' | 'none' | string[]
  notifications: 'self' | 'none' | string[]
}

export type ReferrerPolicy = 
  | 'no-referrer'
  | 'no-referrer-when-downgrade' 
  | 'origin'
  | 'origin-when-cross-origin'
  | 'same-origin'
  | 'strict-origin'
  | 'strict-origin-when-cross-origin'
  | 'unsafe-url'

export interface ProtectionConfig {
  ddos: {
    enabled: boolean
    maxRequestsPerMinute: number
    maxRequestsPerHour: number
    blockDuration: number
  }
  rateLimit: {
    enabled: boolean
    windowMs: number
    maxRequests: number
    skipSuccessfulRequests: boolean
  }
  injectionPrevention: {
    sqlInjection: boolean
    xssProtection: boolean
    commandInjection: boolean
    pathTraversal: boolean
  }
}

export interface ScanningConfig {
  vulnerability: {
    enabled: boolean
    realTimeScanning: boolean
    scheduledScans: boolean
    scanInterval: number
  }
  malware: {
    enabled: boolean
    scanUploads: boolean
    quarantineThreshold: number
  }
  compliance: {
    fips140: boolean
    sox: boolean
    pci: boolean
    gdpr: boolean
  }
}

export interface SecurityEvent {
  id: string
  timestamp: Date
  type: SecurityEventType
  severity: SecuritySeverity
  source: string
  description: string
  metadata: Record<string, any>
}

export enum SecurityEventType {
  AUTHENTICATION_FAILURE = 'AUTHENTICATION_FAILURE',
  AUTHORIZATION_FAILURE = 'AUTHORIZATION_FAILURE',
  SUSPICIOUS_REQUEST = 'SUSPICIOUS_REQUEST',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  INJECTION_ATTEMPT = 'INJECTION_ATTEMPT',
  VULNERABILITY_DETECTED = 'VULNERABILITY_DETECTED',
  CERTIFICATE_EXPIRING = 'CERTIFICATE_EXPIRING',
  CONFIGURATION_CHANGE = 'CONFIGURATION_CHANGE'
}

export enum SecuritySeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export interface SecurityMetrics {
  requestsBlocked: number
  vulnerabilitiesDetected: number
  certificateStatus: 'VALID' | 'EXPIRING' | 'EXPIRED'
  encryptionStrength: number
  complianceScore: number
  threatLevel: SecuritySeverity
}

export interface Certificate {
  subject: string
  issuer: string
  validFrom: Date
  validTo: Date
  serialNumber: string
  fingerprint: string
  isValid: boolean
}

export interface TrustDevice {
  id: string
  fingerprint: string
  lastSeen: Date
  trustScore: number
  ipAddress: string
  userAgent: string
  isRegistered: boolean
}