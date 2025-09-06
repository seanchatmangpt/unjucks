# Enterprise Encryption Guide

## Overview

This guide covers the FIPS 140-2 compliant encryption implementation, providing comprehensive data protection for data at rest, in transit, and in processing.

## Encryption Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                 Encryption Architecture                      │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Master    │  │    Key      │  │    Encryption       │  │
│  │    Key      │  │ Derivation  │  │     Service         │  │
│  │ Management  │  │             │  │                     │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │    FIPS     │  │  Hardware   │  │     Compliance      │  │
│  │ Validation  │  │ Security    │  │    Monitoring       │  │
│  │             │  │   Module    │  │                     │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## FIPS 140-2 Compliance

### Approved Algorithms

#### Symmetric Encryption
- **AES-256-GCM**: Primary encryption algorithm
- **AES-192-GCM**: Alternative for specific use cases
- **AES-128-GCM**: Minimum acceptable strength

#### Hash Functions
- **SHA-256**: Standard hash function
- **SHA-384**: Enhanced security applications
- **SHA-512**: Maximum security requirements
- **SHA-3**: Quantum-resistant alternative

#### Key Derivation
- **PBKDF2**: Password-based key derivation
- **HKDF**: HMAC-based key derivation
- **SP 800-108**: Counter mode KDF

#### Digital Signatures
- **RSA-PSS**: RSA with PSS padding
- **ECDSA**: Elliptic curve signatures
- **EdDSA**: Edwards curve signatures

## Implementation Guide

### Basic Encryption Service Setup

```typescript
import { EncryptionService } from '../src/security/crypto/encryption'

const encryptionConfig = {
  fipsCompliant: true,
  algorithm: 'AES-256-GCM',
  keyRotationInterval: 86400, // 24 hours
  encryptionAtRest: true,
  encryptionInTransit: true
}

const encryption = new EncryptionService(encryptionConfig)
await encryption.initialize()

// Encrypt sensitive data
const encrypted = await encryption.encrypt('sensitive data', 'user-data')
console.log('Encrypted:', encrypted.ciphertext)

// Decrypt data
const decrypted = await encryption.decrypt(encrypted)
console.log('Decrypted:', decrypted.toString())
```

### FIPS Crypto Provider

```typescript
import { FIPSCryptoProvider } from '../src/security/crypto/fips-compliant'

const fips = FIPSCryptoProvider.getInstance()
await fips.initialize()

// Verify FIPS mode
if (!fips.isFIPSMode()) {
  console.warn('FIPS mode not enabled - compliance may be affected')
}

// Generate secure random data
const randomData = fips.generateSecureRandom(32)

// Create secure hash
const hash = fips.createSecureHash(Buffer.from('data'), 'SHA-256')

// Generate key pair
const keyPair = fips.generateRSAKeyPair(2048)
```

## Key Management

### Master Key Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Key Hierarchy                             │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                 Master Key (HSM)                        │ │
│  └─────────────────────────────────────────────────────────┘ │
│                              │                               │
│      ┌───────────────────────┼───────────────────────┐       │
│      │                       │                       │       │
│  ┌───▼────┐            ┌─────▼─────┐           ┌─────▼─────┐ │
│  │  Data  │            │   HMAC    │           │  Session  │ │
│  │   Key  │            │    Key    │           │    Key    │ │
│  └────────┘            └───────────┘           └───────────┘ │
│      │                       │                       │       │
│  ┌───▼────┐            ┌─────▼─────┐           ┌─────▼─────┐ │
│  │ Field  │            │ Integrity │           │   Auth    │ │
│  │  KEKs  │            │   Keys    │           │  Tokens   │ │
│  └────────┘            └───────────┘           └───────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Key Derivation Implementation

```typescript
// Derive application-specific keys
const dataKey = await encryption.deriveKey('data-encryption', 'context1')
const hmacKey = await encryption.deriveKey('integrity-protection', 'context1')
const sessionKey = await encryption.deriveKey('session-encryption', 'user-123')

// Key rotation
setInterval(async () => {
  await encryption.rotateKeys()
  console.log('Keys rotated successfully')
}, 24 * 60 * 60 * 1000) // Daily rotation
```

### Hardware Security Module Integration

```typescript
interface HSMConfig {
  provider: 'pkcs11' | 'azure-keyvault' | 'aws-hsm' | 'google-hsm'
  connection: {
    endpoint: string
    credentials: any
    partition?: string
  }
  keyPolicy: {
    extractable: boolean
    keySize: number
    algorithm: string
  }
}

const hsmConfig: HSMConfig = {
  provider: 'pkcs11',
  connection: {
    endpoint: '/usr/lib/pkcs11/libCryptoki2_64.so',
    credentials: {
      pin: process.env.HSM_PIN,
      slot: 0
    }
  },
  keyPolicy: {
    extractable: false,
    keySize: 256,
    algorithm: 'AES'
  }
}
```

## Data Protection Strategies

### Data at Rest Encryption

```typescript
// Database field encryption
class EncryptedField {
  constructor(
    private encryption: EncryptionService,
    private context: string
  ) {}

  async encrypt(plaintext: string): Promise<string> {
    const encrypted = await this.encryption.encrypt(plaintext, this.context)
    return JSON.stringify(encrypted)
  }

  async decrypt(ciphertext: string): Promise<string> {
    const encryptedData = JSON.parse(ciphertext)
    const decrypted = await this.encryption.decrypt(encryptedData)
    return decrypted.toString()
  }
}

// Usage example
const emailField = new EncryptedField(encryption, 'user-email')
const encryptedEmail = await emailField.encrypt('user@example.com')

// File encryption
const encryptedFile = await encryption.encryptAtRest(
  fileContent,
  `file:${filename}`
)
```

### Data in Transit Protection

```typescript
// TLS configuration
const tlsConfig = {
  cert: fs.readFileSync('server.crt'),
  key: fs.readFileSync('server.key'),
  ca: fs.readFileSync('ca.crt'),
  
  // FIPS-approved cipher suites
  ciphers: [
    'ECDHE-RSA-AES256-GCM-SHA384',
    'ECDHE-RSA-AES128-GCM-SHA256',
    'ECDHE-ECDSA-AES256-GCM-SHA384',
    'ECDHE-ECDSA-AES128-GCM-SHA256'
  ].join(':'),
  
  secureProtocol: 'TLSv1_2_method',
  honorCipherOrder: true,
  
  // Client certificate validation
  requestCert: true,
  rejectUnauthorized: true
}

const server = https.createServer(tlsConfig, app)
```

### Application-Level Encryption

```typescript
// API payload encryption
class APIEncryption {
  constructor(private encryption: EncryptionService) {}

  async encryptRequest(payload: any, endpoint: string): Promise<any> {
    const serialized = JSON.stringify(payload)
    const encrypted = await this.encryption.encrypt(serialized, `api:${endpoint}`)
    
    return {
      encrypted: true,
      payload: encrypted.ciphertext,
      iv: encrypted.iv,
      tag: encrypted.authTag,
      timestamp: new Date().toISOString()
    }
  }

  async decryptResponse(encryptedResponse: any): Promise<any> {
    const decrypted = await this.encryption.decrypt({
      ciphertext: encryptedResponse.payload,
      iv: encryptedResponse.iv,
      authTag: encryptedResponse.tag,
      algorithm: 'AES-256-GCM',
      keyDerivationContext: encryptedResponse.context
    })
    
    return JSON.parse(decrypted.toString())
  }
}
```

## Advanced Encryption Features

### Format Preserving Encryption (FPE)

```typescript
class FormatPreservingEncryption {
  constructor(private encryption: EncryptionService) {}

  // Preserve credit card number format
  async encryptCreditCard(cardNumber: string): Promise<string> {
    // Implementation would use FF1/FF3-1 algorithms
    // This is a simplified example
    const digits = cardNumber.replace(/\D/g, '')
    const encrypted = await this.encryption.encrypt(digits, 'credit-card')
    
    // Map back to numeric format
    return this.mapToNumericFormat(encrypted.ciphertext, digits.length)
  }

  private mapToNumericFormat(ciphertext: string, length: number): string {
    // Convert ciphertext to numeric format preserving length
    const hash = createHash('sha256').update(ciphertext).digest('hex')
    const numeric = BigInt('0x' + hash) % (BigInt(10) ** BigInt(length))
    return numeric.toString().padStart(length, '0')
  }
}
```

### Searchable Encryption

```typescript
class SearchableEncryption {
  constructor(private encryption: EncryptionService) {}

  async createSearchableIndex(plaintext: string, context: string): Promise<string[]> {
    const keywords = this.extractKeywords(plaintext)
    const searchTokens: string[] = []

    for (const keyword of keywords) {
      const token = await this.encryption.createHMAC(
        keyword,
        await this.encryption.deriveKey('search', context),
        'HMAC-SHA-256'
      )
      searchTokens.push(token.toString('hex'))
    }

    return searchTokens
  }

  async generateSearchToken(keyword: string, context: string): Promise<string> {
    const token = await this.encryption.createHMAC(
      keyword,
      await this.encryption.deriveKey('search', context),
      'HMAC-SHA-256'
    )
    return token.toString('hex')
  }

  private extractKeywords(text: string): string[] {
    return text.toLowerCase()
      .split(/\W+/)
      .filter(word => word.length > 2)
      .slice(0, 10) // Limit keywords for performance
  }
}
```

### Homomorphic Encryption

```typescript
// Placeholder for homomorphic encryption
class HomomorphicEncryption {
  // This would integrate with libraries like SEAL, HElib, or PALISADE
  // for performing computations on encrypted data
  
  async encryptNumber(value: number, context: string): Promise<any> {
    // Implementation would use homomorphic encryption schemes
    // such as BFV, BGV, or CKKS
    throw new Error('Homomorphic encryption not implemented')
  }
  
  async addEncrypted(a: any, b: any): Promise<any> {
    // Perform addition on encrypted values
    throw new Error('Homomorphic addition not implemented')
  }
}
```

## Performance Optimization

### Encryption Caching

```typescript
class EncryptionCache {
  private cache = new Map<string, CachedEncryption>()
  private readonly TTL = 5 * 60 * 1000 // 5 minutes

  async getCachedEncryption(key: string): Promise<any | null> {
    const cached = this.cache.get(key)
    if (!cached || Date.now() > cached.expiresAt) {
      this.cache.delete(key)
      return null
    }
    return cached.data
  }

  setCachedEncryption(key: string, data: any): void {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + this.TTL
    })
  }
}

interface CachedEncryption {
  data: any
  expiresAt: number
}
```

### Batch Operations

```typescript
class BatchEncryption {
  constructor(private encryption: EncryptionService) {}

  async encryptBatch(
    items: Array<{ data: string; context: string }>
  ): Promise<Array<any>> {
    const promises = items.map(item =>
      this.encryption.encrypt(item.data, item.context)
    )
    
    return Promise.all(promises)
  }

  async decryptBatch(encryptedItems: Array<any>): Promise<Array<string>> {
    const promises = encryptedItems.map(item =>
      this.encryption.decrypt(item).then(buf => buf.toString())
    )
    
    return Promise.all(promises)
  }
}
```

## Compliance and Auditing

### Encryption Audit Trail

```typescript
interface EncryptionAuditLog {
  timestamp: Date
  operation: 'encrypt' | 'decrypt' | 'key-derivation' | 'key-rotation'
  algorithm: string
  keyId: string
  context?: string
  success: boolean
  error?: string
  metadata: {
    dataSize?: number
    performance?: number
    fipsCompliant: boolean
  }
}

class EncryptionAuditor {
  private auditLog: EncryptionAuditLog[] = []

  logOperation(log: EncryptionAuditLog): void {
    this.auditLog.push(log)
    
    // Send to external audit system
    this.sendToAuditSystem(log)
  }

  private sendToAuditSystem(log: EncryptionAuditLog): void {
    // Integration with SIEM, Splunk, etc.
    console.log('Audit Log:', JSON.stringify(log))
  }

  getAuditReport(timeRange: { start: Date; end: Date }): EncryptionAuditLog[] {
    return this.auditLog.filter(log =>
      log.timestamp >= timeRange.start && log.timestamp <= timeRange.end
    )
  }
}
```

### Compliance Verification

```typescript
class ComplianceChecker {
  async verifyFIPSCompliance(): Promise<ComplianceReport> {
    const report: ComplianceReport = {
      fipsMode: this.checkFIPSMode(),
      approvedAlgorithms: this.verifyAlgorithms(),
      keyStrength: this.verifyKeyStrength(),
      randomGeneration: await this.testRandomGeneration(),
      selfTests: await this.runSelfTests(),
      overallCompliance: false
    }

    report.overallCompliance = this.calculateCompliance(report)
    return report
  }

  private checkFIPSMode(): boolean {
    try {
      const crypto = require('crypto')
      return crypto.getFips && crypto.getFips() === 1
    } catch {
      return false
    }
  }

  private verifyAlgorithms(): boolean {
    const approvedAlgorithms = [
      'aes-256-gcm', 'sha256', 'sha384', 'sha512',
      'rsa-pss', 'ecdsa', 'pbkdf2'
    ]
    
    // Verify all used algorithms are approved
    return true // Simplified for example
  }

  private calculateCompliance(report: ComplianceReport): boolean {
    return report.fipsMode &&
           report.approvedAlgorithms &&
           report.keyStrength &&
           report.randomGeneration &&
           report.selfTests
  }
}

interface ComplianceReport {
  fipsMode: boolean
  approvedAlgorithms: boolean
  keyStrength: boolean
  randomGeneration: boolean
  selfTests: boolean
  overallCompliance: boolean
}
```

## Best Practices

### Key Management Best Practices

1. **Key Separation**: Different keys for different purposes
2. **Key Rotation**: Regular automated key rotation
3. **Key Escrow**: Secure key backup and recovery
4. **Access Control**: Strict key access policies
5. **Audit Trail**: Complete key usage logging

### Implementation Best Practices

1. **Fail Secure**: Default to secure state on errors
2. **Input Validation**: Validate all cryptographic inputs
3. **Constant Time**: Use constant-time operations
4. **Memory Safety**: Secure memory handling
5. **Error Handling**: Avoid information leakage

### Operational Best Practices

1. **Regular Testing**: Periodic encryption/decryption testing
2. **Performance Monitoring**: Track encryption overhead
3. **Compliance Audits**: Regular FIPS compliance verification
4. **Incident Response**: Plan for cryptographic incidents
5. **Staff Training**: Cryptographic security awareness

## Troubleshooting

### Common Issues

1. **FIPS Mode Not Enabled**: Node.js not compiled with FIPS support
2. **Certificate Errors**: Invalid or expired certificates
3. **Key Derivation Failures**: Incorrect parameters or context
4. **Performance Issues**: Encryption overhead too high
5. **Compliance Violations**: Non-approved algorithms in use

### Resolution Steps

```typescript
// Diagnostic utilities
class EncryptionDiagnostics {
  async runDiagnostics(): Promise<DiagnosticReport> {
    return {
      fipsStatus: await this.checkFIPSStatus(),
      algorithmSupport: await this.checkAlgorithmSupport(),
      keyHealth: await this.checkKeyHealth(),
      performance: await this.measurePerformance(),
      compliance: await this.verifyCompliance()
    }
  }

  private async checkFIPSStatus(): Promise<any> {
    const fips = FIPSCryptoProvider.getInstance()
    return {
      enabled: fips.isFIPSMode(),
      approvedAlgorithms: fips.getApprovedAlgorithms(),
      nodeVersion: process.version,
      opensslVersion: process.versions.openssl
    }
  }

  private async measurePerformance(): Promise<any> {
    const encryption = new EncryptionService({
      fipsCompliant: true,
      algorithm: 'AES-256-GCM',
      keyRotationInterval: 0,
      encryptionAtRest: true,
      encryptionInTransit: true
    })

    await encryption.initialize()

    const testData = Buffer.alloc(1024 * 1024) // 1MB
    const iterations = 100

    const start = Date.now()
    for (let i = 0; i < iterations; i++) {
      const encrypted = await encryption.encrypt(testData, 'performance-test')
      await encryption.decrypt(encrypted)
    }
    const end = Date.now()

    return {
      iterations,
      totalTime: end - start,
      avgTime: (end - start) / iterations,
      throughput: (testData.length * iterations * 2) / ((end - start) / 1000) // bytes per second
    }
  }
}
```

For detailed troubleshooting steps and error codes, see the implementation in `src/security/crypto/`.