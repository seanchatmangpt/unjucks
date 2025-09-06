/**
 * FIPS 140-2 Compliant Cryptography
 * Implements Federal Information Processing Standard compliant cryptographic operations
 */

import { createCipherGCM, createDecipherGCM, createHash, createHmac, randomBytes, pbkdf2Sync, generateKeyPairSync, sign, verify } from 'crypto'

export class FIPSCryptoProvider {
  private static instance: FIPSCryptoProvider
  private fipsMode: boolean = false
  private approvedAlgorithms: Set<string>
  private keyStore = new Map<string, CryptoKey>()

  private constructor() {
    this.approvedAlgorithms = new Set([
      'AES-256-GCM',
      'AES-192-GCM',
      'AES-128-GCM',
      'AES-256-CBC',
      'AES-192-CBC',
      'AES-128-CBC',
      'SHA-256',
      'SHA-384',
      'SHA-512',
      'SHA3-256',
      'SHA3-384',
      'SHA3-512',
      'HMAC-SHA-256',
      'HMAC-SHA-384',
      'HMAC-SHA-512',
      'RSA-PSS',
      'RSA-OAEP',
      'ECDSA',
      'ECDH',
      'PBKDF2'
    ])
  }

  static getInstance(): FIPSCryptoProvider {
    if (!FIPSCryptoProvider.instance) {
      FIPSCryptoProvider.instance = new FIPSCryptoProvider()
    }
    return FIPSCryptoProvider.instance
  }

  async initialize(): Promise<void> {
    this.fipsMode = this.checkFIPSMode()
    
    if (this.fipsMode) {
      console.log('FIPS 140-2 mode enabled')
      await this.validateFIPSCompliance()
    } else {
      console.warn('FIPS 140-2 mode not enabled - cryptographic operations may not be compliant')
    }

    // Generate master keys for different purposes
    await this.generateMasterKeys()
  }

  /**
   * Check if Node.js is running in FIPS mode
   */
  private checkFIPSMode(): boolean {
    try {
      const crypto = require('crypto')
      return crypto.getFips && crypto.getFips() === 1
    } catch (error) {
      return false
    }
  }

  /**
   * Validate FIPS compliance
   */
  private async validateFIPSCompliance(): Promise<void> {
    const validationTests = [
      () => this.testAESEncryption(),
      () => this.testHashing(),
      () => this.testHMAC(),
      () => this.testKeyDerivation(),
      () => this.testDigitalSignatures(),
      () => this.testRandomGeneration()
    ]

    for (const test of validationTests) {
      try {
        await test()
      } catch (error) {
        throw new Error(`FIPS compliance validation failed: ${error.message}`)
      }
    }

    console.log('FIPS 140-2 compliance validation passed')
  }

  /**
   * Generate cryptographically secure random data
   */
  generateSecureRandom(length: number): Buffer {
    if (length <= 0 || length > 1048576) { // Max 1MB
      throw new Error('Invalid random data length')
    }

    return randomBytes(length)
  }

  /**
   * Create secure hash using FIPS-approved algorithms
   */
  createSecureHash(data: Buffer | string, algorithm: 'SHA-256' | 'SHA-384' | 'SHA-512' = 'SHA-256'): Buffer {
    this.validateAlgorithm(algorithm)
    
    const hash = createHash(algorithm.toLowerCase().replace('-', ''))
    hash.update(data)
    return hash.digest()
  }

  /**
   * Create HMAC using FIPS-approved algorithms
   */
  createHMAC(data: Buffer | string, key: Buffer, algorithm: 'HMAC-SHA-256' | 'HMAC-SHA-384' | 'HMAC-SHA-512' = 'HMAC-SHA-256'): Buffer {
    this.validateAlgorithm(algorithm)
    
    const hashAlgorithm = algorithm.toLowerCase().replace('hmac-', '').replace('-', '')
    const hmac = createHmac(hashAlgorithm, key)
    hmac.update(data)
    return hmac.digest()
  }

  /**
   * Derive key using PBKDF2 (FIPS-approved)
   */
  deriveKey(password: Buffer | string, salt: Buffer, iterations: number, keyLength: number, digest: 'sha256' | 'sha384' | 'sha512' = 'sha256'): Buffer {
    if (iterations < 100000) {
      throw new Error('PBKDF2 iteration count must be at least 100,000 for FIPS compliance')
    }

    if (keyLength < 16) {
      throw new Error('Key length must be at least 128 bits for FIPS compliance')
    }

    return pbkdf2Sync(password, salt, iterations, keyLength, digest)
  }

  /**
   * Encrypt data using AES-GCM (FIPS-approved)
   */
  async encryptAESGCM(plaintext: Buffer, key: Buffer, aad?: Buffer): Promise<AESGCMResult> {
    if (key.length !== 16 && key.length !== 24 && key.length !== 32) {
      throw new Error('AES key must be 128, 192, or 256 bits')
    }

    const algorithm = `aes-${key.length * 8}-gcm`
    this.validateAlgorithm(algorithm.toUpperCase().replace(/-/g, '-'))

    const iv = this.generateSecureRandom(12) // 96-bit IV for GCM
    const cipher = createCipherGCM(algorithm)
    
    cipher.setKey(key)
    cipher.setIV(iv)
    
    if (aad) {
      cipher.setAAD(aad)
    }

    let encrypted = cipher.update(plaintext)
    cipher.final()
    
    const authTag = cipher.getAuthTag()

    return {
      ciphertext: encrypted,
      iv,
      authTag,
      algorithm
    }
  }

  /**
   * Decrypt data using AES-GCM
   */
  async decryptAESGCM(encryptedData: AESGCMResult, key: Buffer, aad?: Buffer): Promise<Buffer> {
    if (key.length !== 16 && key.length !== 24 && key.length !== 32) {
      throw new Error('AES key must be 128, 192, or 256 bits')
    }

    const decipher = createDecipherGCM(encryptedData.algorithm)
    decipher.setKey(key)
    decipher.setIV(encryptedData.iv)
    decipher.setAuthTag(encryptedData.authTag)
    
    if (aad) {
      decipher.setAAD(aad)
    }

    let decrypted = decipher.update(encryptedData.ciphertext)
    decipher.final()
    
    return decrypted
  }

  /**
   * Generate RSA key pair (FIPS-approved)
   */
  generateRSAKeyPair(keySize: 2048 | 3072 | 4096 = 2048): RSAKeyPair {
    if (keySize < 2048) {
      throw new Error('RSA key size must be at least 2048 bits for FIPS compliance')
    }

    const { publicKey, privateKey } = generateKeyPairSync('rsa', {
      modulusLength: keySize,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    })

    return { publicKey, privateKey, keySize }
  }

  /**
   * Generate ECDSA key pair (FIPS-approved curves)
   */
  generateECDSAKeyPair(curve: 'prime256v1' | 'secp384r1' | 'secp521r1' = 'prime256v1'): ECDSAKeyPair {
    const approvedCurves = ['prime256v1', 'secp384r1', 'secp521r1']
    if (!approvedCurves.includes(curve)) {
      throw new Error(`Curve ${curve} is not FIPS-approved`)
    }

    const { publicKey, privateKey } = generateKeyPairSync('ec', {
      namedCurve: curve,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    })

    return { publicKey, privateKey, curve }
  }

  /**
   * Sign data using RSA-PSS (FIPS-approved)
   */
  signRSAPSS(data: Buffer, privateKey: string, hashAlgorithm: 'sha256' | 'sha384' | 'sha512' = 'sha256'): Buffer {
    return sign(`rsa-pss`, data, {
      key: privateKey,
      saltLength: -1, // Use hash length as salt length
      mgf: 1, // MGF1
      hashAlgorithm
    })
  }

  /**
   * Verify RSA-PSS signature
   */
  verifyRSAPSS(data: Buffer, signature: Buffer, publicKey: string, hashAlgorithm: 'sha256' | 'sha384' | 'sha512' = 'sha256'): boolean {
    return verify(`rsa-pss`, data, {
      key: publicKey,
      saltLength: -1,
      mgf: 1,
      hashAlgorithm
    }, signature)
  }

  /**
   * Sign data using ECDSA (FIPS-approved)
   */
  signECDSA(data: Buffer, privateKey: string, hashAlgorithm: 'sha256' | 'sha384' | 'sha512' = 'sha256'): Buffer {
    return sign(`sha${hashAlgorithm.slice(-3)}`, data, privateKey)
  }

  /**
   * Verify ECDSA signature
   */
  verifyECDSA(data: Buffer, signature: Buffer, publicKey: string, hashAlgorithm: 'sha256' | 'sha384' | 'sha512' = 'sha256'): boolean {
    return verify(`sha${hashAlgorithm.slice(-3)}`, data, publicKey, signature)
  }

  /**
   * Generate and store cryptographic keys
   */
  private async generateMasterKeys(): Promise<void> {
    // Generate AES master key for data encryption
    const aesKey = this.generateSecureRandom(32) // 256-bit key
    this.keyStore.set('master-aes', { 
      key: aesKey, 
      algorithm: 'AES-256-GCM', 
      purpose: 'data-encryption',
      createdAt: new Date()
    })

    // Generate HMAC key for integrity protection
    const hmacKey = this.generateSecureRandom(64) // 512-bit key
    this.keyStore.set('master-hmac', {
      key: hmacKey,
      algorithm: 'HMAC-SHA-512',
      purpose: 'integrity-protection',
      createdAt: new Date()
    })

    // Generate RSA key pair for asymmetric operations
    const rsaKeys = this.generateRSAKeyPair(2048)
    this.keyStore.set('master-rsa-public', {
      key: Buffer.from(rsaKeys.publicKey),
      algorithm: 'RSA-2048',
      purpose: 'asymmetric-encryption',
      createdAt: new Date()
    })
    this.keyStore.set('master-rsa-private', {
      key: Buffer.from(rsaKeys.privateKey),
      algorithm: 'RSA-2048',
      purpose: 'asymmetric-decryption',
      createdAt: new Date()
    })

    console.log('FIPS-compliant master keys generated')
  }

  /**
   * Validate algorithm is FIPS-approved
   */
  private validateAlgorithm(algorithm: string): void {
    if (this.fipsMode && !this.approvedAlgorithms.has(algorithm)) {
      throw new Error(`Algorithm ${algorithm} is not FIPS 140-2 approved`)
    }
  }

  /**
   * Test AES encryption compliance
   */
  private async testAESEncryption(): Promise<void> {
    const key = this.generateSecureRandom(32)
    const plaintext = Buffer.from('FIPS compliance test data')
    
    const encrypted = await this.encryptAESGCM(plaintext, key)
    const decrypted = await this.decryptAESGCM(encrypted, key)
    
    if (!plaintext.equals(decrypted)) {
      throw new Error('AES encryption/decryption test failed')
    }
  }

  /**
   * Test hashing compliance
   */
  private testHashing(): void {
    const data = Buffer.from('test data')
    const hash = this.createSecureHash(data, 'SHA-256')
    
    if (hash.length !== 32) { // SHA-256 produces 256 bits = 32 bytes
      throw new Error('Hash length validation failed')
    }
  }

  /**
   * Test HMAC compliance
   */
  private testHMAC(): void {
    const data = Buffer.from('test data')
    const key = this.generateSecureRandom(32)
    const hmac = this.createHMAC(data, key, 'HMAC-SHA-256')
    
    if (hmac.length !== 32) {
      throw new Error('HMAC length validation failed')
    }
  }

  /**
   * Test key derivation compliance
   */
  private testKeyDerivation(): void {
    const password = Buffer.from('test password')
    const salt = this.generateSecureRandom(16)
    const key = this.deriveKey(password, salt, 100000, 32)
    
    if (key.length !== 32) {
      throw new Error('Key derivation length validation failed')
    }
  }

  /**
   * Test digital signatures compliance
   */
  private testDigitalSignatures(): void {
    const data = Buffer.from('test signature data')
    
    // Test RSA-PSS
    const rsaKeys = this.generateRSAKeyPair(2048)
    const rsaSignature = this.signRSAPSS(data, rsaKeys.privateKey)
    const rsaValid = this.verifyRSAPSS(data, rsaSignature, rsaKeys.publicKey)
    
    if (!rsaValid) {
      throw new Error('RSA-PSS signature validation failed')
    }

    // Test ECDSA
    const ecKeys = this.generateECDSAKeyPair('prime256v1')
    const ecSignature = this.signECDSA(data, ecKeys.privateKey)
    const ecValid = this.verifyECDSA(data, ecSignature, ecKeys.publicKey)
    
    if (!ecValid) {
      throw new Error('ECDSA signature validation failed')
    }
  }

  /**
   * Test random generation compliance
   */
  private testRandomGeneration(): void {
    const random1 = this.generateSecureRandom(32)
    const random2 = this.generateSecureRandom(32)
    
    // Random data should not be identical (extremely unlikely)
    if (random1.equals(random2)) {
      throw new Error('Random generation produced identical results')
    }
  }

  /**
   * Get FIPS compliance status
   */
  getComplianceStatus(): FIPSComplianceStatus {
    return {
      fipsMode: this.fipsMode,
      approvedAlgorithms: Array.from(this.approvedAlgorithms),
      keyStoreSize: this.keyStore.size,
      nodeJSVersion: process.version,
      opensslVersion: process.versions.openssl || 'unknown',
      complianceLevel: this.fipsMode ? 'Level 1' : 'Not Compliant'
    }
  }

  /**
   * Get stored key information (without exposing actual keys)
   */
  getKeyInventory(): KeyInventory[] {
    const inventory: KeyInventory[] = []
    
    for (const [keyId, keyData] of this.keyStore.entries()) {
      inventory.push({
        keyId,
        algorithm: keyData.algorithm,
        purpose: keyData.purpose,
        createdAt: keyData.createdAt,
        keyLength: keyData.key.length * 8 // Convert to bits
      })
    }
    
    return inventory
  }

  /**
   * Rotate cryptographic keys
   */
  async rotateKeys(): Promise<void> {
    console.log('Starting FIPS-compliant key rotation...')
    
    // Clear existing keys
    this.keyStore.clear()
    
    // Generate new master keys
    await this.generateMasterKeys()
    
    console.log('FIPS-compliant key rotation completed')
  }

  /**
   * Securely dispose of keys
   */
  dispose(): void {
    // Clear all keys from memory
    for (const [keyId, keyData] of this.keyStore.entries()) {
      keyData.key.fill(0) // Overwrite with zeros
    }
    
    this.keyStore.clear()
    console.log('FIPS crypto provider disposed')
  }
}

interface AESGCMResult {
  ciphertext: Buffer
  iv: Buffer
  authTag: Buffer
  algorithm: string
}

interface RSAKeyPair {
  publicKey: string
  privateKey: string
  keySize: number
}

interface ECDSAKeyPair {
  publicKey: string
  privateKey: string
  curve: string
}

interface CryptoKey {
  key: Buffer
  algorithm: string
  purpose: string
  createdAt: Date
}

interface FIPSComplianceStatus {
  fipsMode: boolean
  approvedAlgorithms: string[]
  keyStoreSize: number
  nodeJSVersion: string
  opensslVersion: string
  complianceLevel: string
}

interface KeyInventory {
  keyId: string
  algorithm: string
  purpose: string
  createdAt: Date
  keyLength: number
}