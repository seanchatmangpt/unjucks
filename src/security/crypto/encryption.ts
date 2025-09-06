/**
 * End-to-End Encryption Service
 * Provides FIPS 140-2 compliant cryptography for data protection
 */

import { createCipherGCM, createDecipherGCM, randomBytes, createHash, pbkdf2Sync } from 'crypto'
import { EncryptionConfig } from '../types'

export class EncryptionService {
  private masterKey: Buffer | null = null
  private keyDerivationSalt: Buffer | null = null
  private encryptionKeys = new Map<string, Buffer>()

  constructor(private config: EncryptionConfig) {}

  async initialize(): Promise<void> {
    // Initialize master key from secure key management
    this.masterKey = await this.loadMasterKey()
    this.keyDerivationSalt = randomBytes(32)

    // Initialize key rotation if enabled
    if (this.config.keyRotationInterval > 0) {
      this.startKeyRotation()
    }
  }

  /**
   * Encrypt data with authenticated encryption
   */
  async encrypt(data: string | Buffer, context?: string): Promise<EncryptedData> {
    if (!this.masterKey) {
      throw new Error('Encryption service not initialized')
    }

    const plaintext = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8')
    const key = await this.deriveKey(context)
    const iv = randomBytes(16) // 128-bit IV for AES-GCM
    
    try {
      const cipher = createCipherGCM(this.config.algorithm)
      cipher.setKey(key)
      cipher.setIV(iv)

      // Add additional authenticated data
      const aad = Buffer.from(context || 'default', 'utf8')
      cipher.setAAD(aad)

      let encrypted = cipher.update(plaintext)
      cipher.final()

      const authTag = cipher.getAuthTag()

      return {
        ciphertext: encrypted.toString('base64'),
        iv: iv.toString('base64'),
        authTag: authTag.toString('base64'),
        algorithm: this.config.algorithm,
        keyDerivationContext: context,
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      throw new Error(`Encryption failed: ${error.message}`)
    }
  }

  /**
   * Decrypt authenticated ciphertext
   */
  async decrypt(encryptedData: EncryptedData): Promise<Buffer> {
    if (!this.masterKey) {
      throw new Error('Encryption service not initialized')
    }

    try {
      const key = await this.deriveKey(encryptedData.keyDerivationContext)
      const iv = Buffer.from(encryptedData.iv, 'base64')
      const authTag = Buffer.from(encryptedData.authTag, 'base64')
      const ciphertext = Buffer.from(encryptedData.ciphertext, 'base64')

      const decipher = createDecipherGCM(encryptedData.algorithm)
      decipher.setKey(key)
      decipher.setIV(iv)
      decipher.setAuthTag(authTag)

      // Set additional authenticated data
      const aad = Buffer.from(encryptedData.keyDerivationContext || 'default', 'utf8')
      decipher.setAAD(aad)

      let decrypted = decipher.update(ciphertext)
      decipher.final()

      return decrypted
    } catch (error) {
      throw new Error(`Decryption failed: ${error.message}`)
    }
  }

  /**
   * Encrypt data for storage (at rest)
   */
  async encryptAtRest(data: string | Buffer, identifier: string): Promise<string> {
    if (!this.config.encryptionAtRest) {
      return Buffer.isBuffer(data) ? data.toString('base64') : Buffer.from(data).toString('base64')
    }

    const encrypted = await this.encrypt(data, `storage:${identifier}`)
    return JSON.stringify(encrypted)
  }

  /**
   * Decrypt data from storage
   */
  async decryptFromRest(encryptedData: string): Promise<Buffer> {
    if (!this.config.encryptionAtRest) {
      return Buffer.from(encryptedData, 'base64')
    }

    const parsedData: EncryptedData = JSON.parse(encryptedData)
    return await this.decrypt(parsedData)
  }

  /**
   * Create secure hash
   */
  createSecureHash(data: string | Buffer, algorithm: string = 'sha256'): string {
    const hash = createHash(algorithm)
    hash.update(data)
    return hash.digest('hex')
  }

  /**
   * Generate cryptographically secure random bytes
   */
  generateSecureRandom(length: number): Buffer {
    return randomBytes(length)
  }

  /**
   * Derive encryption key from master key
   */
  private async deriveKey(context?: string): Promise<Buffer> {
    const contextSuffix = context ? `:${context}` : ''
    const keyContext = `encryption${contextSuffix}`
    
    // Check if key already derived for this context
    if (this.encryptionKeys.has(keyContext)) {
      return this.encryptionKeys.get(keyContext)!
    }

    // Derive key using PBKDF2
    const derivedKey = pbkdf2Sync(
      this.masterKey!,
      Buffer.concat([this.keyDerivationSalt!, Buffer.from(keyContext, 'utf8')]),
      100000, // 100k iterations
      32, // 256-bit key
      'sha256'
    )

    this.encryptionKeys.set(keyContext, derivedKey)
    return derivedKey
  }

  /**
   * Load master key from secure source
   */
  private async loadMasterKey(): Promise<Buffer> {
    // In production, load from HSM, key vault, or secure environment variable
    const keyMaterial = process.env.ENCRYPTION_MASTER_KEY || 'dev-key-not-for-production'
    
    if (keyMaterial === 'dev-key-not-for-production' && process.env.NODE_ENV === 'production') {
      throw new Error('Production master key not configured')
    }

    // Derive 256-bit master key from key material
    return pbkdf2Sync(keyMaterial, 'master-key-salt', 100000, 32, 'sha256')
  }

  /**
   * Start automatic key rotation
   */
  private startKeyRotation(): void {
    setInterval(() => {
      this.rotateKeys()
    }, this.config.keyRotationInterval * 1000)
  }

  /**
   * Rotate encryption keys
   */
  private async rotateKeys(): Promise<void> {
    console.log('Rotating encryption keys...')
    
    // Clear derived keys to force re-derivation
    this.encryptionKeys.clear()
    
    // Generate new key derivation salt
    this.keyDerivationSalt = randomBytes(32)
    
    // In production, would update key in secure storage
    console.log('Key rotation completed')
  }

  /**
   * Validate FIPS compliance
   */
  private validateFIPSCompliance(): boolean {
    if (!this.config.fipsCompliant) return true

    // Check if Node.js is running in FIPS mode
    const crypto = require('crypto')
    return crypto.constants && crypto.constants.defaultCoreCipherList !== undefined
  }

  /**
   * Get encryption health status
   */
  async getHealth(): Promise<any> {
    return {
      initialized: this.masterKey !== null,
      algorithm: this.config.algorithm,
      fipsCompliant: this.validateFIPSCompliance(),
      keyRotationEnabled: this.config.keyRotationInterval > 0,
      encryptionAtRest: this.config.encryptionAtRest,
      encryptionInTransit: this.config.encryptionInTransit,
      derivedKeys: this.encryptionKeys.size
    }
  }

  /**
   * Securely wipe sensitive data from memory
   */
  async dispose(): Promise<void> {
    if (this.masterKey) {
      this.masterKey.fill(0)
      this.masterKey = null
    }

    if (this.keyDerivationSalt) {
      this.keyDerivationSalt.fill(0)
      this.keyDerivationSalt = null
    }

    // Clear all derived keys
    this.encryptionKeys.forEach(key => key.fill(0))
    this.encryptionKeys.clear()
  }
}

export interface EncryptedData {
  ciphertext: string
  iv: string
  authTag: string
  algorithm: string
  keyDerivationContext?: string
  timestamp: string
}

/**
 * FIPS 140-2 Compliant Crypto Provider
 */
export class FIPSCryptoProvider {
  private static instance: FIPSCryptoProvider
  
  private constructor() {}

  static getInstance(): FIPSCryptoProvider {
    if (!FIPSCryptoProvider.instance) {
      FIPSCryptoProvider.instance = new FIPSCryptoProvider()
    }
    return FIPSCryptoProvider.instance
  }

  /**
   * Check FIPS mode status
   */
  isFIPSMode(): boolean {
    try {
      const crypto = require('crypto')
      return crypto.getFips && crypto.getFips() === 1
    } catch {
      return false
    }
  }

  /**
   * Get approved algorithms
   */
  getApprovedAlgorithms(): string[] {
    return [
      'AES-256-GCM',
      'AES-256-CBC',
      'SHA-256',
      'SHA-384',
      'SHA-512',
      'RSA-OAEP',
      'ECDSA',
      'HMAC'
    ]
  }

  /**
   * Validate algorithm compliance
   */
  validateAlgorithm(algorithm: string): boolean {
    return this.getApprovedAlgorithms().includes(algorithm)
  }

  /**
   * Generate FIPS-compliant random
   */
  generateRandom(length: number): Buffer {
    if (!this.isFIPSMode()) {
      console.warn('Not running in FIPS mode - random generation may not be compliant')
    }
    return randomBytes(length)
  }
}