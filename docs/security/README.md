# Enterprise Security Architecture

This document provides a comprehensive overview of the enterprise security features implemented in the Unjucks project, following industry best practices and compliance requirements.

## Security Overview

The security architecture implements a **Zero-Trust Security Model** with multiple layers of protection:

- **Authentication & Authorization**: mTLS, multi-factor authentication, device trust
- **Data Protection**: End-to-end encryption, FIPS 140-2 compliant cryptography
- **Secrets Management**: HashiCorp Vault integration with automatic rotation
- **Network Security**: DDoS protection, rate limiting, traffic analysis
- **Application Security**: Input validation, XSS/SQL injection prevention
- **Monitoring & Scanning**: Real-time vulnerability detection, compliance checking

## Architecture Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Security Architecture                     │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Zero-Trust  │  │   mTLS      │  │  Session Manager    │  │
│  │  Manager    │  │ Manager     │  │                     │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Encryption  │  │   Vault     │  │  Security Headers   │  │
│  │  Service    │  │ Integration │  │     Manager         │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │    DDoS     │  │ Injection   │  │   Vulnerability     │  │
│  │ Protection  │  │ Prevention  │  │     Detector        │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

### Basic Setup

```typescript
import { EnterpriseSecurityManager } from './src/security'

const securityConfig = {
  zeroTrust: {
    enabled: true,
    strictMode: true,
    mTLS: {
      enabled: true,
      certPath: '/path/to/server.crt',
      keyPath: '/path/to/server.key',
      caPath: '/path/to/ca.crt'
    }
  },
  encryption: {
    fipsCompliant: true,
    algorithm: 'AES-256-GCM',
    keyRotationInterval: 86400 // 24 hours
  },
  vault: {
    enabled: true,
    url: 'https://vault.example.com',
    roleId: process.env.VAULT_ROLE_ID,
    secretId: process.env.VAULT_SECRET_ID
  }
}

const security = new EnterpriseSecurityManager(securityConfig)
await security.initialize()
```

### Request Validation

```typescript
// Middleware example
app.use(async (req, res, next) => {
  const isValid = await security.validateRequest(req)
  
  if (!isValid) {
    return res.status(403).json({ error: 'Request blocked by security policy' })
  }
  
  next()
})
```

## Security Components

### 1. Zero-Trust Security Model

**Location**: `src/security/auth/zero-trust.ts`

Implements "never trust, always verify" principle:

- **Device Trust**: Fingerprint-based device identification
- **Network Segmentation**: IP-based access controls
- **Behavior Analysis**: Real-time threat detection
- **Certificate Validation**: Continuous certificate verification

### 2. Mutual TLS (mTLS)

**Location**: `src/security/auth/mtls.ts`

Certificate-based authentication:

- **Client Certificate Validation**: Automatic cert verification
- **Certificate Revocation**: CRL/OCSP checking
- **Key Rotation**: Automated certificate renewal
- **Chain Validation**: Full certificate chain verification

### 3. End-to-End Encryption

**Location**: `src/security/crypto/encryption.ts`

FIPS 140-2 compliant encryption:

- **AES-256-GCM**: Authenticated encryption
- **Key Derivation**: PBKDF2 with high iteration count
- **Secure Random**: Cryptographically secure PRNG
- **Key Rotation**: Automatic key lifecycle management

### 4. Secrets Management

**Location**: `src/security/vault/secrets-manager.ts`

HashiCorp Vault integration:

- **Dynamic Secrets**: Database credentials, API keys
- **Secret Rotation**: Automatic rotation policies
- **Secure Storage**: Encrypted secret storage
- **Audit Trail**: Complete access logging

### 5. Security Headers

**Location**: `src/security/headers/security-headers.ts`

HTTP security headers management:

- **HSTS**: HTTP Strict Transport Security
- **CSP**: Content Security Policy with nonces
- **Frame Protection**: X-Frame-Options, SAMEORIGIN
- **Content Type**: X-Content-Type-Options

### 6. DDoS Protection

**Location**: `src/security/protection/ddos-protection.ts`

Comprehensive attack mitigation:

- **Rate Limiting**: Per-IP request throttling
- **Geo-blocking**: Country-based blocking
- **Pattern Detection**: Behavioral analysis
- **Automatic Blocking**: IP-based blocking with TTL

### 7. Injection Prevention

**Location**: `src/security/protection/injection-prevention.ts`

Input validation and sanitization:

- **SQL Injection**: Pattern-based detection
- **XSS Protection**: HTML/JS sanitization
- **Command Injection**: Shell metacharacter filtering
- **Path Traversal**: Directory traversal prevention

### 8. Vulnerability Scanning

**Location**: `src/security/scanning/`

Comprehensive security scanning:

- **Dependency Scanning**: Known vulnerability detection
- **Code Analysis**: Static security analysis
- **Configuration Audit**: Security configuration review
- **Compliance Checking**: Regulatory compliance validation

## Configuration

### Environment Variables

```bash
# Encryption
ENCRYPTION_MASTER_KEY=your-master-key-here
SESSION_SECRET=your-session-secret-here

# Vault Integration
VAULT_ADDR=https://vault.example.com
VAULT_ROLE_ID=your-role-id
VAULT_SECRET_ID=your-secret-id
VAULT_NAMESPACE=your-namespace

# mTLS Certificates
TLS_CERT_PATH=/path/to/server.crt
TLS_KEY_PATH=/path/to/server.key
TLS_CA_PATH=/path/to/ca.crt

# Security Policies
SECURITY_STRICT_MODE=true
FIPS_MODE=true
```

### Configuration File Example

```typescript
export const securityConfig: SecurityConfig = {
  zeroTrust: {
    enabled: true,
    strictMode: process.env.NODE_ENV === 'production',
    mTLS: {
      enabled: true,
      certPath: process.env.TLS_CERT_PATH!,
      keyPath: process.env.TLS_KEY_PATH!,
      caPath: process.env.TLS_CA_PATH!,
      verifyClient: true
    },
    deviceTrust: {
      enabled: true,
      fingerprintValidation: true,
      deviceRegistration: true
    },
    networkSegmentation: {
      enabled: true,
      allowedNetworks: ['10.0.0.0/8', '192.168.0.0/16'],
      denyByDefault: true
    }
  },
  encryption: {
    fipsCompliant: process.env.FIPS_MODE === 'true',
    algorithm: 'AES-256-GCM',
    keyRotationInterval: 24 * 60 * 60, // 24 hours
    encryptionAtRest: true,
    encryptionInTransit: true
  },
  vault: {
    enabled: process.env.VAULT_ADDR !== undefined,
    url: process.env.VAULT_ADDR!,
    roleId: process.env.VAULT_ROLE_ID,
    secretId: process.env.VAULT_SECRET_ID,
    namespace: process.env.VAULT_NAMESPACE,
    mountPath: 'secret',
    keyRotation: {
      enabled: true,
      interval: 7 * 24 * 60 * 60 // 7 days
    }
  },
  headers: {
    hsts: {
      enabled: true,
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true
    },
    csp: {
      enabled: true,
      reportOnly: false,
      policy: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"]
      }
    },
    frameOptions: 'DENY',
    contentTypeOptions: true,
    referrerPolicy: 'strict-origin-when-cross-origin',
    permissionsPolicy: {
      geolocation: 'none',
      camera: 'none',
      microphone: 'none',
      notifications: 'self'
    }
  },
  protection: {
    ddos: {
      enabled: true,
      maxRequestsPerMinute: 100,
      maxRequestsPerHour: 1000,
      blockDuration: 300 // 5 minutes
    },
    rateLimit: {
      enabled: true,
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 100,
      skipSuccessfulRequests: false
    },
    injectionPrevention: {
      sqlInjection: true,
      xssProtection: true,
      commandInjection: true,
      pathTraversal: true
    }
  },
  scanning: {
    vulnerability: {
      enabled: true,
      realTimeScanning: true,
      scheduledScans: true,
      scanInterval: 24 * 60 * 60 // Daily scans
    },
    malware: {
      enabled: true,
      scanUploads: true,
      quarantineThreshold: 0.7
    },
    compliance: {
      fips140: process.env.FIPS_MODE === 'true',
      sox: false,
      pci: false,
      gdpr: true
    }
  }
}
```

## Security Monitoring

### Health Check Endpoint

```typescript
app.get('/security/health', async (req, res) => {
  const health = await security.getSecurityHealth()
  res.json(health)
})
```

### Security Metrics

```typescript
const metrics = await security.getSecurityMetrics()
// Returns:
// {
//   requestsBlocked: 45,
//   vulnerabilitiesDetected: 3,
//   certificateStatus: 'VALID',
//   encryptionStrength: 256,
//   complianceScore: 95,
//   threatLevel: 'LOW'
// }
```

## Compliance

### FIPS 140-2

The security implementation is FIPS 140-2 Level 1 compliant:

- **Approved Algorithms**: AES, SHA-2/3, HMAC, RSA, ECDSA
- **Key Management**: Secure key generation and storage
- **Random Generation**: Entropy source validation
- **Self-Testing**: Cryptographic algorithm validation

### Industry Standards

- **NIST Cybersecurity Framework**: Complete coverage
- **OWASP Top 10**: Full mitigation implemented
- **ISO 27001**: Security management alignment
- **SOC 2**: Security control implementation

## Best Practices

### Development

1. **Secrets Management**: Never commit secrets to code
2. **Input Validation**: Validate all external input
3. **Least Privilege**: Minimal permission assignment
4. **Defense in Depth**: Multiple security layers
5. **Security by Design**: Security from the start

### Operations

1. **Regular Scanning**: Automated vulnerability detection
2. **Patch Management**: Timely security updates
3. **Incident Response**: Defined response procedures
4. **Access Review**: Regular access audits
5. **Security Training**: Team security awareness

## Deployment

### Production Checklist

- [ ] FIPS mode enabled
- [ ] All certificates valid and current
- [ ] Vault integration configured
- [ ] Security headers enabled
- [ ] DDoS protection active
- [ ] Vulnerability scanning scheduled
- [ ] Monitoring and alerting configured
- [ ] Incident response plan ready

### Monitoring Setup

```typescript
// Example monitoring integration
import { SecurityScanner } from './src/security/scanning/security-scanner'

const scanner = new SecurityScanner(scanningConfig)
await scanner.initialize()

// Schedule daily security scans
const scanId = await scanner.initiateScan({
  target: {
    type: 'application',
    name: 'unjucks',
    path: process.cwd()
  },
  components: {
    dependencies: true,
    codebase: true,
    infrastructure: true,
    configuration: true
  },
  compliance: ['FIPS140', 'OWASP'],
  priority: 'high'
})

console.log(`Security scan initiated: ${scanId}`)
```

## Support and Maintenance

### Regular Updates

- **Vulnerability Database**: Daily updates
- **Certificate Rotation**: Automated renewal
- **Key Rotation**: Weekly rotation schedule
- **Compliance Checks**: Monthly assessments

### Incident Response

1. **Detection**: Automated threat detection
2. **Assessment**: Risk level determination
3. **Containment**: Immediate threat mitigation
4. **Eradication**: Root cause elimination
5. **Recovery**: Service restoration
6. **Lessons Learned**: Process improvement

For detailed implementation guides, see the individual component documentation in the `docs/security/` directory.