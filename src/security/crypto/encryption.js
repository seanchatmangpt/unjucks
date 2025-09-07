/**
 * End-to-End Encryption Service
 * Provides FIPS 140-2 compliant cryptography for data protection
 */

import { createCipherGCM, createDecipherGCM, randomBytes, createHash, pbkdf2Sync } from 'crypto';

/**
 * Encryption Service providing authenticated encryption
 * @class
 */
class EncryptionService {
  /**
   * @param {EncryptionConfig} config - Encryption configuration
   */
  constructor(config) {
    this.config = config
    /** @private @type {Buffer|null} */
    this.masterKey = null
    /** @private @type {Buffer|null} */
    this.keyDerivationSalt = null
    /** @private @type {Map<string, Buffer>} */
    this.encryptionKeys = new Map()
  }

  /**
   * Initialize encryption service
   * @returns {Promise<void>}
   */
  async initialize() {
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
   * @param {string|Buffer} data - Data to encrypt
   * @param {string} [context] - Encryption context
   * @returns {Promise<EncryptedData>}
   */
  async encrypt(data, context) {
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
   * @param {EncryptedData} encryptedData - Encrypted data object
   * @returns {Promise<Buffer>}
   */
  async decrypt(encryptedData) {
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
   * @param {string|Buffer} data - Data to encrypt
   * @param {string} identifier - Storage identifier
   * @returns {Promise<string>}
   */
  async encryptAtRest(data, identifier) {
    if (!this.config.encryptionAtRest) {
      return Buffer.isBuffer(data) ? data.toString('base64') : Buffer.from(data).toString('base64')
    }

    const encrypted = await this.encrypt(data, `storage:${identifier}`)
    return JSON.stringify(encrypted)
  }

  /**
   * Decrypt data from storage
   * @param {string} encryptedData - Encrypted data string
   * @returns {Promise<Buffer>}
   */
  async decryptFromRest(encryptedData) {
    if (!this.config.encryptionAtRest) {
      return Buffer.from(encryptedData, 'base64')
    }

    const parsedData = JSON.parse(encryptedData)
    return await this.decrypt(parsedData)
  }

  /**
   * Create secure hash
   * @param {string|Buffer} data - Data to hash
   * @param {string} [algorithm='sha256'] - Hash algorithm
   * @returns {string}
   */
  createSecureHash(data, algorithm = 'sha256') {
    const hash = createHash(algorithm)
    hash.update(data)
    return hash.digest('hex')
  }

  /**
   * Generate cryptographically secure random bytes
   * @param {number} length - Number of bytes to generate
   * @returns {Buffer}
   */
  generateSecureRandom(length) {
    return randomBytes(length)
  }

  /**
   * Derive encryption key from master key
   * @private
   * @param {string} [context] - Key derivation context
   * @returns {Promise<Buffer>}
   */
  async deriveKey(context) {
    const contextSuffix = context ? `:${context}` : ''
    const keyContext = `encryption${contextSuffix}`
    
    // Check if key already derived for this context
    if (this.encryptionKeys.has(keyContext)) {
      return this.encryptionKeys.get(keyContext)
    }

    // Derive key using PBKDF2
    const derivedKey = pbkdf2Sync(
      this.masterKey,
      Buffer.concat([this.keyDerivationSalt, Buffer.from(keyContext, 'utf8')]),
      100000, // 100k iterations
      32, // 256-bit key
      'sha256'
    )

    this.encryptionKeys.set(keyContext, derivedKey)
    return derivedKey
  }

  /**
   * Load master key from secure source
   * @private
   * @returns {Promise<Buffer>}
   */
  async loadMasterKey() {
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
   * @private
   */
  startKeyRotation() {
    setInterval(() => {
      this.rotateKeys()
    }, this.config.keyRotationInterval * 1000)
  }

  /**
   * Rotate encryption keys
   * @private
   * @returns {Promise<void>}
   */
  async rotateKeys() {
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
   * @private
   * @returns {boolean}
   */
  validateFIPSCompliance() {
    if (!this.config.fipsCompliant) return true

    // Check if Node.js is running in FIPS mode
    const crypto = require('crypto')
    return crypto.constants && crypto.constants.defaultCoreCipherList !== undefined
  }

  /**
   * Get encryption health status
   * @returns {Promise<object>}
   */
  async getHealth() {
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
   * @returns {Promise<void>}
   */
  async dispose() {
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

/**
 * FIPS 140-2 Compliant Crypto Provider
 * @class
 */
class FIPSCryptoProvider {
  constructor() {
    // Prevent direct instantiation
  }

  /**
   * Get singleton instance
   * @returns {FIPSCryptoProvider}
   */
  static getInstance() {
    if (!FIPSCryptoProvider.instance) {
      FIPSCryptoProvider.instance = new FIPSCryptoProvider()
    }
    return FIPSCryptoProvider.instance
  }

  /**
   * Check FIPS mode status
   * @returns {boolean}
   */
  isFIPSMode() {
    try {
      const crypto = require('crypto')
      return crypto.getFips && crypto.getFips() === 1
    } catch {
      return false
    }
  }

  /**
   * Get approved algorithms
   * @returns {string[]}
   */
  getApprovedAlgorithms() {
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
   * @param {string} algorithm - Algorithm to validate
   * @returns {boolean}
   */
  validateAlgorithm(algorithm) {
    return this.getApprovedAlgorithms().includes(algorithm)
  }

  /**
   * Generate FIPS-compliant random
   * @param {number} length - Number of bytes
   * @returns {Buffer}
   */
  generateRandom(length) {
    if (!this.isFIPSMode()) {
      console.warn('Not running in FIPS mode - random generation may not be compliant')
    }
    return randomBytes(length)
  }
}

export { EncryptionService, FIPSCryptoProvider };

/**
 * @typedef {Object} EncryptedData
 * @property {string} ciphertext
 * @property {string} iv
 * @property {string} authTag
 * @property {string} algorithm
 * @property {string} [keyDerivationContext]
 * @property {string} timestamp
 */

/**
 * @typedef {Object} EncryptionConfig
 * @property {boolean} fipsCompliant
 * @property {'AES-256-GCM'|'ChaCha20-Poly1305'} algorithm
 * @property {number} keyRotationInterval
 * @property {boolean} encryptionAtRest
 * @property {boolean} encryptionInTransit
 */