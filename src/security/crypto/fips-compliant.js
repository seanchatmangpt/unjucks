/**
 * FIPS 140-2 Compliant Cryptography
 * Implements Federal Information Processing Standard compliant cryptographic operations
 */

import { createCipherGCM, createDecipherGCM, createHash, createHmac, randomBytes, pbkdf2Sync, generateKeyPairSync, sign, verify } from 'crypto';

/**
 * FIPS 140-2 Compliant Crypto Provider
 * @class
 */
class FIPSCryptoProvider {
  constructor() {
    /** @private @type {boolean} */
    this.fipsMode = false
    /** @private @type {Set<string>} */
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
    /** @private @type {Map<string, CryptoKeyData>} */
    this.keyStore = new Map()
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
   * Initialize FIPS provider
   * @returns {Promise<void>}
   */
  async initialize() {
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
   * @private
   * @returns {boolean}
   */
  checkFIPSMode() {
    try {
      const crypto = require('crypto')
      return crypto.getFips && crypto.getFips() === 1
    } catch (error) {
      return false
    }
  }

  /**
   * Validate FIPS compliance
   * @private
   * @returns {Promise<void>}
   */
  async validateFIPSCompliance() {
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
   * @param {number} length - Length of random data to generate
   * @returns {Buffer}
   */
  generateSecureRandom(length) {
    if (length <= 0 || length > 1048576) { // Max 1MB
      throw new Error('Invalid random data length')
    }

    return randomBytes(length)
  }

  /**
   * Create secure hash using FIPS-approved algorithms
   * @param {Buffer|string} data - Data to hash
   * @param {'SHA-256'|'SHA-384'|'SHA-512'} [algorithm='SHA-256'] - Hash algorithm
   * @returns {Buffer}
   */
  createSecureHash(data, algorithm = 'SHA-256') {
    this.validateAlgorithm(algorithm)
    
    const hash = createHash(algorithm.toLowerCase().replace('-', ''))
    hash.update(data)
    return hash.digest()
  }

  /**
   * Create HMAC using FIPS-approved algorithms
   * @param {Buffer|string} data - Data to HMAC
   * @param {Buffer} key - HMAC key
   * @param {'HMAC-SHA-256'|'HMAC-SHA-384'|'HMAC-SHA-512'} [algorithm='HMAC-SHA-256'] - HMAC algorithm
   * @returns {Buffer}
   */
  createHMAC(data, key, algorithm = 'HMAC-SHA-256') {
    this.validateAlgorithm(algorithm)
    
    const hashAlgorithm = algorithm.toLowerCase().replace('hmac-', '').replace('-', '')
    const hmac = createHmac(hashAlgorithm, key)
    hmac.update(data)
    return hmac.digest()
  }

  /**
   * Derive key using PBKDF2 (FIPS-approved)
   * @param {Buffer|string} password - Password to derive from
   * @param {Buffer} salt - Salt for key derivation
   * @param {number} iterations - Number of iterations
   * @param {number} keyLength - Length of derived key
   * @param {'sha256'|'sha384'|'sha512'} [digest='sha256'] - Hash function
   * @returns {Buffer}
   */
  deriveKey(password, salt, iterations, keyLength, digest = 'sha256') {
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
   * @param {Buffer} plaintext - Data to encrypt
   * @param {Buffer} key - Encryption key
   * @param {Buffer} [aad] - Additional authenticated data
   * @returns {Promise<AESGCMResult>}
   */
  async encryptAESGCM(plaintext, key, aad) {
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

    const encrypted = cipher.update(plaintext)
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
   * @param {AESGCMResult} encryptedData - Encrypted data object
   * @param {Buffer} key - Decryption key
   * @param {Buffer} [aad] - Additional authenticated data
   * @returns {Promise<Buffer>}
   */
  async decryptAESGCM(encryptedData, key, aad) {
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

    const decrypted = decipher.update(encryptedData.ciphertext)
    decipher.final()
    
    return decrypted
  }

  /**
   * Generate RSA key pair (FIPS-approved)
   * @param {2048|3072|4096} [keySize=2048] - RSA key size
   * @returns {RSAKeyPair}
   */
  generateRSAKeyPair(keySize = 2048) {
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
   * @param {'prime256v1'|'secp384r1'|'secp521r1'} [curve='prime256v1'] - ECDSA curve
   * @returns {ECDSAKeyPair}
   */
  generateECDSAKeyPair(curve = 'prime256v1') {
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
   * @param {Buffer} data - Data to sign
   * @param {string} privateKey - RSA private key
   * @param {'sha256'|'sha384'|'sha512'} [hashAlgorithm='sha256'] - Hash algorithm
   * @returns {Buffer}
   */
  signRSAPSS(data, privateKey, hashAlgorithm = 'sha256') {
    return sign(`rsa-pss`, data, {
      key: privateKey,
      saltLength: -1, // Use hash length as salt length
      mgf: 1, // MGF1
      hashAlgorithm
    })
  }

  /**
   * Verify RSA-PSS signature
   * @param {Buffer} data - Original data
   * @param {Buffer} signature - Signature to verify
   * @param {string} publicKey - RSA public key
   * @param {'sha256'|'sha384'|'sha512'} [hashAlgorithm='sha256'] - Hash algorithm
   * @returns {boolean}
   */
  verifyRSAPSS(data, signature, publicKey, hashAlgorithm = 'sha256') {
    return verify(`rsa-pss`, data, {
      key: publicKey,
      saltLength: -1,
      mgf: 1,
      hashAlgorithm
    }, signature)
  }

  /**
   * Sign data using ECDSA (FIPS-approved)
   * @param {Buffer} data - Data to sign
   * @param {string} privateKey - ECDSA private key
   * @param {'sha256'|'sha384'|'sha512'} [hashAlgorithm='sha256'] - Hash algorithm
   * @returns {Buffer}
   */
  signECDSA(data, privateKey, hashAlgorithm = 'sha256') {
    return sign(`sha${hashAlgorithm.slice(-3)}`, data, privateKey)
  }

  /**
   * Verify ECDSA signature
   * @param {Buffer} data - Original data
   * @param {Buffer} signature - Signature to verify
   * @param {string} publicKey - ECDSA public key
   * @param {'sha256'|'sha384'|'sha512'} [hashAlgorithm='sha256'] - Hash algorithm
   * @returns {boolean}
   */
  verifyECDSA(data, signature, publicKey, hashAlgorithm = 'sha256') {
    return verify(`sha${hashAlgorithm.slice(-3)}`, data, publicKey, signature)
  }

  /**
   * Generate and store cryptographic keys
   * @private
   * @returns {Promise<void>}
   */
  async generateMasterKeys() {
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
   * @private
   * @param {string} algorithm - Algorithm to validate
   */
  validateAlgorithm(algorithm) {
    if (this.fipsMode && !this.approvedAlgorithms.has(algorithm)) {
      throw new Error(`Algorithm ${algorithm} is not FIPS 140-2 approved`)
    }
  }

  /**
   * Test AES encryption compliance
   * @private
   * @returns {Promise<void>}
   */
  async testAESEncryption() {
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
   * @private
   */
  testHashing() {
    const data = Buffer.from('test data')
    const hash = this.createSecureHash(data, 'SHA-256')
    
    if (hash.length !== 32) { // SHA-256 produces 256 bits = 32 bytes
      throw new Error('Hash length validation failed')
    }
  }

  /**
   * Test HMAC compliance
   * @private
   */
  testHMAC() {
    const data = Buffer.from('test data')
    const key = this.generateSecureRandom(32)
    const hmac = this.createHMAC(data, key, 'HMAC-SHA-256')
    
    if (hmac.length !== 32) {
      throw new Error('HMAC length validation failed')
    }
  }

  /**
   * Test key derivation compliance
   * @private
   */
  testKeyDerivation() {
    const password = Buffer.from('test password')
    const salt = this.generateSecureRandom(16)
    const key = this.deriveKey(password, salt, 100000, 32)
    
    if (key.length !== 32) {
      throw new Error('Key derivation length validation failed')
    }
  }

  /**
   * Test digital signatures compliance
   * @private
   */
  testDigitalSignatures() {
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
   * @private
   */
  testRandomGeneration() {
    const random1 = this.generateSecureRandom(32)
    const random2 = this.generateSecureRandom(32)
    
    // Random data should not be identical (extremely unlikely)
    if (random1.equals(random2)) {
      throw new Error('Random generation produced identical results')
    }
  }

  /**
   * Get FIPS compliance status
   * @returns {FIPSComplianceStatus}
   */
  getComplianceStatus() {
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
   * @returns {KeyInventory[]}
   */
  getKeyInventory() {
    const inventory = []
    
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
   * @returns {Promise<void>}
   */
  async rotateKeys() {
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
  dispose() {
    // Clear all keys from memory
    for (const [keyId, keyData] of this.keyStore.entries()) {
      keyData.key.fill(0) // Overwrite with zeros
    }
    
    this.keyStore.clear()
    console.log('FIPS crypto provider disposed')
  }
}

export { FIPSCryptoProvider };

/**
 * @typedef {Object} AESGCMResult
 * @property {Buffer} ciphertext
 * @property {Buffer} iv
 * @property {Buffer} authTag
 * @property {string} algorithm
 */

/**
 * @typedef {Object} RSAKeyPair
 * @property {string} publicKey
 * @property {string} privateKey
 * @property {number} keySize
 */

/**
 * @typedef {Object} ECDSAKeyPair
 * @property {string} publicKey
 * @property {string} privateKey
 * @property {string} curve
 */

/**
 * @typedef {Object} CryptoKeyData
 * @property {Buffer} key
 * @property {string} algorithm
 * @property {string} purpose
 * @property {Date} createdAt
 */

/**
 * @typedef {Object} FIPSComplianceStatus
 * @property {boolean} fipsMode
 * @property {string[]} approvedAlgorithms
 * @property {number} keyStoreSize
 * @property {string} nodeJSVersion
 * @property {string} opensslVersion
 * @property {string} complianceLevel
 */

/**
 * @typedef {Object} KeyInventory
 * @property {string} keyId
 * @property {string} algorithm
 * @property {string} purpose
 * @property {Date} createdAt
 * @property {number} keyLength
 */