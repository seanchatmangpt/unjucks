/**
 * Advanced Cryptographic Security System
 * Implements secure encryption, hashing, key management, and digital signatures
 */

import { createHash, createHmac, randomBytes, createCipher, createDecipher, pbkdf2, scrypt, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import fs from 'fs-extra';
import path from 'path';
import { SecurityError } from './input-validator.js';

const pbkdf2Async = promisify(pbkdf2);
const scryptAsync = promisify(scrypt);

export class CryptographicSecurityManager {
  constructor() {
    this.keyCache = new Map();
    this.sessionKeys = new Map();
    this.keyRotationInterval = 24 * 60 * 60 * 1000; // 24 hours
    this.maxKeyAge = 7 * 24 * 60 * 60 * 1000; // 7 days
    
    // Cryptographic constants
    this.algorithms = {
      symmetric: 'aes-256-gcm',
      hash: 'sha512',
      hmac: 'sha256',
      kdf: 'scrypt'
    };
    
    this.keyLengths = {
      symmetric: 32, // 256 bits
      hmac: 32,      // 256 bits
      salt: 16,      // 128 bits
      iv: 12,        // 96 bits for GCM
      tag: 16        // 128 bits for GCM
    };

    // Initialize master key rotation
    this.setupKeyRotation();
  }

  /**
   * Generate cryptographically secure random bytes
   */
  generateSecureRandom(length = 32) {
    return randomBytes(length);
  }

  /**
   * Generate cryptographically secure random string
   */
  generateSecureRandomString(length = 32, encoding = 'hex') {
    return this.generateSecureRandom(Math.ceil(length / 2)).toString(encoding).slice(0, length);
  }

  /**
   * Secure hash function with salt
   */
  async secureHash(data, salt = null) {
    if (typeof data !== 'string' && !Buffer.isBuffer(data)) {
      throw new SecurityError('Data must be string or Buffer');
    }

    salt = salt || this.generateSecureRandom(this.keyLengths.salt);
    
    const hash = createHash(this.algorithms.hash);
    hash.update(salt);
    hash.update(data);
    
    return {
      hash: hash.digest('hex'),
      salt: salt.toString('hex'),
      algorithm: this.algorithms.hash
    };
  }

  /**
   * Verify hash with timing-safe comparison
   */
  async verifyHash(data, expectedHash, salt) {
    const computed = await this.secureHash(data, Buffer.from(salt, 'hex'));
    
    // Use timing-safe comparison to prevent timing attacks
    const expectedBuffer = Buffer.from(expectedHash, 'hex');
    const computedBuffer = Buffer.from(computed.hash, 'hex');
    
    if (expectedBuffer.length !== computedBuffer.length) {
      return false;
    }
    
    return timingSafeEqual(expectedBuffer, computedBuffer);
  }

  /**
   * Password-based key derivation (PBKDF2)
   */
  async deriveKeyPBKDF2(password, salt = null, iterations = 100000) {
    salt = salt || this.generateSecureRandom(this.keyLengths.salt);
    
    const derivedKey = await pbkdf2Async(
      password,
      salt,
      iterations,
      this.keyLengths.symmetric,
      this.algorithms.hash
    );

    return {
      key: derivedKey,
      salt: salt,
      iterations,
      algorithm: 'pbkdf2'
    };
  }

  /**
   * Modern key derivation using scrypt
   */
  async deriveKeyScrypt(password, salt = null) {
    salt = salt || this.generateSecureRandom(this.keyLengths.salt);
    
    const derivedKey = await scryptAsync(
      password,
      salt,
      this.keyLengths.symmetric,
      {
        N: 16384,  // CPU/memory cost parameter
        r: 8,      // Block size parameter  
        p: 1       // Parallelization parameter
      }
    );

    return {
      key: derivedKey,
      salt: salt,
      algorithm: 'scrypt'
    };
  }

  /**
   * Encrypt data using AES-256-GCM
   */
  async encryptData(data, key = null) {
    if (typeof data !== 'string' && !Buffer.isBuffer(data)) {
      throw new SecurityError('Data must be string or Buffer');
    }

    // Use provided key or generate new one
    if (!key) {
      key = this.generateSecureRandom(this.keyLengths.symmetric);
    }

    const iv = this.generateSecureRandom(this.keyLengths.iv);
    const cipher = require('crypto').createCipherGCM(this.algorithms.symmetric, key, iv);
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const tag = cipher.getAuthTag();

    return {
      encrypted,
      iv: iv.toString('hex'),
      tag: tag.toString('hex'),
      algorithm: this.algorithms.symmetric,
      keyId: this.getKeyId(key)
    };
  }

  /**
   * Decrypt data using AES-256-GCM
   */
  async decryptData(encryptedData, key, iv, tag) {
    try {
      const decipher = require('crypto').createDecipherGCM(
        this.algorithms.symmetric,
        key,
        Buffer.from(iv, 'hex')
      );
      
      decipher.setAuthTag(Buffer.from(tag, 'hex'));
      
      let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
      
    } catch (error) {
      throw new SecurityError(`Decryption failed: ${error.message}`);
    }
  }

  /**
   * Create HMAC for message authentication
   */
  createHMAC(data, key = null) {
    if (!key) {
      key = this.generateSecureRandom(this.keyLengths.hmac);
    }

    const hmac = createHmac(this.algorithms.hmac, key);
    hmac.update(data);
    
    return {
      hmac: hmac.digest('hex'),
      keyId: this.getKeyId(key),
      algorithm: this.algorithms.hmac
    };
  }

  /**
   * Verify HMAC with timing-safe comparison
   */
  verifyHMAC(data, expectedHmac, key) {
    const computed = this.createHMAC(data, key);
    
    const expectedBuffer = Buffer.from(expectedHmac, 'hex');
    const computedBuffer = Buffer.from(computed.hmac, 'hex');
    
    if (expectedBuffer.length !== computedBuffer.length) {
      return false;
    }
    
    return timingSafeEqual(expectedBuffer, computedBuffer);
  }

  /**
   * Encrypt and authenticate data (Encrypt-then-MAC)
   */
  async encryptAndAuthenticate(data, encryptionKey = null, macKey = null) {
    encryptionKey = encryptionKey || this.generateSecureRandom(this.keyLengths.symmetric);
    macKey = macKey || this.generateSecureRandom(this.keyLengths.hmac);

    // First encrypt
    const encrypted = await this.encryptData(data, encryptionKey);
    
    // Then authenticate the ciphertext
    const payload = `${encrypted.encrypted}:${encrypted.iv}:${encrypted.tag}`;
    const mac = this.createHMAC(payload, macKey);

    return {
      ...encrypted,
      mac: mac.hmac,
      macKeyId: mac.keyId
    };
  }

  /**
   * Verify authentication then decrypt
   */
  async verifyAndDecrypt(encryptedPayload, encryptionKey, macKey) {
    const { encrypted, iv, tag, mac } = encryptedPayload;
    
    // First verify authentication
    const payload = `${encrypted}:${iv}:${tag}`;
    const isValid = this.verifyHMAC(payload, mac, macKey);
    
    if (!isValid) {
      throw new SecurityError('MAC verification failed');
    }

    // Then decrypt
    return await this.decryptData(encrypted, encryptionKey, iv, tag);
  }

  /**
   * Generate session token with embedded metadata
   */
  generateSessionToken(userId, expiresIn = 3600) {
    const sessionId = this.generateSecureRandomString(32);
    const expiresAt = Date.now() + (expiresIn * 1000);
    
    const sessionData = {
      sessionId,
      userId,
      expiresAt,
      createdAt: Date.now(),
      version: 1
    };

    const key = this.generateSecureRandom(this.keyLengths.symmetric);
    const encrypted = this.encryptData(JSON.stringify(sessionData), key);
    
    // Store session key for later verification
    this.sessionKeys.set(sessionId, {
      key,
      userId,
      expiresAt
    });

    return {
      token: `${sessionId}:${encrypted.encrypted}:${encrypted.iv}:${encrypted.tag}`,
      expiresAt
    };
  }

  /**
   * Verify and decode session token
   */
  async verifySessionToken(token) {
    try {
      const [sessionId, encrypted, iv, tag] = token.split(':');
      
      if (!sessionId || !encrypted || !iv || !tag) {
        throw new SecurityError('Invalid token format');
      }

      const sessionKey = this.sessionKeys.get(sessionId);
      if (!sessionKey) {
        throw new SecurityError('Invalid session');
      }

      if (Date.now() > sessionKey.expiresAt) {
        this.sessionKeys.delete(sessionId);
        throw new SecurityError('Session expired');
      }

      const decrypted = await this.decryptData(encrypted, sessionKey.key, iv, tag);
      const sessionData = JSON.parse(decrypted);

      if (sessionData.sessionId !== sessionId) {
        throw new SecurityError('Session ID mismatch');
      }

      if (Date.now() > sessionData.expiresAt) {
        throw new SecurityError('Session expired');
      }

      return sessionData;

    } catch (error) {
      throw new SecurityError(`Token verification failed: ${error.message}`);
    }
  }

  /**
   * Secure password hashing for storage
   */
  async hashPassword(password) {
    if (typeof password !== 'string' || password.length < 8) {
      throw new SecurityError('Password must be at least 8 characters');
    }

    // Use scrypt for password hashing
    const keyData = await this.deriveKeyScrypt(password);
    
    return {
      hash: keyData.key.toString('hex'),
      salt: keyData.salt.toString('hex'),
      algorithm: keyData.algorithm
    };
  }

  /**
   * Verify password against stored hash
   */
  async verifyPassword(password, storedHash, salt) {
    try {
      const keyData = await this.deriveKeyScrypt(password, Buffer.from(salt, 'hex'));
      const computedHash = keyData.key.toString('hex');
      
      return timingSafeEqual(
        Buffer.from(storedHash, 'hex'),
        Buffer.from(computedHash, 'hex')
      );

    } catch (error) {
      return false;
    }
  }

  /**
   * Secure file encryption
   */
  async encryptFile(filePath, outputPath = null, key = null) {
    if (!(await fs.pathExists(filePath))) {
      throw new SecurityError('Input file does not exist');
    }

    outputPath = outputPath || `${filePath}.encrypted`;
    key = key || this.generateSecureRandom(this.keyLengths.symmetric);

    const data = await fs.readFile(filePath);
    const encrypted = await this.encryptData(data, key);
    
    const encryptedFile = {
      version: 1,
      algorithm: encrypted.algorithm,
      encrypted: encrypted.encrypted,
      iv: encrypted.iv,
      tag: encrypted.tag,
      originalSize: data.length,
      timestamp: Date.now()
    };

    await fs.writeFile(outputPath, JSON.stringify(encryptedFile, null, 2));
    
    return {
      outputPath,
      keyId: this.getKeyId(key),
      key: key.toString('hex') // Return key for caller to store securely
    };
  }

  /**
   * Secure file decryption
   */
  async decryptFile(encryptedFilePath, outputPath, keyHex) {
    if (!(await fs.pathExists(encryptedFilePath))) {
      throw new SecurityError('Encrypted file does not exist');
    }

    const encryptedContent = await fs.readFile(encryptedFilePath, 'utf8');
    const encryptedFile = JSON.parse(encryptedContent);
    
    if (encryptedFile.version !== 1) {
      throw new SecurityError('Unsupported encrypted file version');
    }

    const key = Buffer.from(keyHex, 'hex');
    const decrypted = await this.decryptData(
      encryptedFile.encrypted,
      key,
      encryptedFile.iv,
      encryptedFile.tag
    );

    await fs.writeFile(outputPath, decrypted);
    
    return {
      originalSize: encryptedFile.originalSize,
      decryptedSize: decrypted.length,
      timestamp: encryptedFile.timestamp
    };
  }

  /**
   * Generate cryptographic key ID for tracking
   */
  getKeyId(key) {
    return createHash('sha256').update(key).digest('hex').slice(0, 16);
  }

  /**
   * Setup automatic key rotation
   */
  setupKeyRotation() {
    setInterval(() => {
      this.rotateKeys();
    }, this.keyRotationInterval);
  }

  /**
   * Rotate expired keys
   */
  rotateKeys() {
    const now = Date.now();
    let rotatedKeys = 0;

    // Rotate session keys
    for (const [sessionId, sessionData] of this.sessionKeys.entries()) {
      if (now > sessionData.expiresAt) {
        this.sessionKeys.delete(sessionId);
        rotatedKeys++;
      }
    }

    // Rotate cached keys
    for (const [keyId, keyData] of this.keyCache.entries()) {
      if (now - keyData.createdAt > this.maxKeyAge) {
        this.keyCache.delete(keyId);
        rotatedKeys++;
      }
    }

    if (rotatedKeys > 0) {
      console.log(`Rotated ${rotatedKeys} expired cryptographic keys`);
    }
  }

  /**
   * Generate digital signature (simplified RSA alternative using HMAC)
   */
  async createDigitalSignature(data, signingKey = null) {
    signingKey = signingKey || this.generateSecureRandom(this.keyLengths.hmac);
    
    // Create timestamp and nonce for replay protection
    const timestamp = Date.now();
    const nonce = this.generateSecureRandomString(16);
    
    // Create signature payload
    const payload = `${timestamp}:${nonce}:${data}`;
    const signature = this.createHMAC(payload, signingKey);
    
    return {
      signature: signature.hmac,
      timestamp,
      nonce,
      keyId: signature.keyId,
      algorithm: signature.algorithm
    };
  }

  /**
   * Verify digital signature
   */
  async verifyDigitalSignature(data, signatureData, signingKey, maxAge = 300000) {
    const { signature, timestamp, nonce } = signatureData;
    
    // Check timestamp to prevent replay attacks
    if (Date.now() - timestamp > maxAge) {
      throw new SecurityError('Signature expired');
    }

    // Reconstruct payload
    const payload = `${timestamp}:${nonce}:${data}`;
    
    // Verify signature
    return this.verifyHMAC(payload, signature, signingKey);
  }

  /**
   * Secure data wiping from memory
   */
  secureWipe(buffer) {
    if (Buffer.isBuffer(buffer)) {
      buffer.fill(0);
    }
  }

  /**
   * Generate integrity checksum for data
   */
  generateIntegrityChecksum(data) {
    const hash = createHash('sha512');
    hash.update(data);
    
    return {
      checksum: hash.digest('hex'),
      algorithm: 'sha512',
      timestamp: Date.now()
    };
  }

  /**
   * Verify data integrity
   */
  verifyIntegrity(data, expectedChecksum) {
    const computed = this.generateIntegrityChecksum(data);
    
    return timingSafeEqual(
      Buffer.from(expectedChecksum, 'hex'),
      Buffer.from(computed.checksum, 'hex')
    );
  }

  /**
   * Get cryptographic security status
   */
  getSecurityStatus() {
    return {
      algorithms: this.algorithms,
      keyLengths: this.keyLengths,
      activeSessions: this.sessionKeys.size,
      cachedKeys: this.keyCache.size,
      keyRotationInterval: this.keyRotationInterval,
      maxKeyAge: this.maxKeyAge,
      lastRotation: this.lastRotation || null
    };
  }

  /**
   * Clean up all cryptographic materials
   */
  cleanup() {
    // Clear session keys
    for (const [sessionId, sessionData] of this.sessionKeys.entries()) {
      this.secureWipe(sessionData.key);
    }
    this.sessionKeys.clear();

    // Clear key cache
    for (const [keyId, keyData] of this.keyCache.entries()) {
      if (keyData.key) {
        this.secureWipe(keyData.key);
      }
    }
    this.keyCache.clear();

    console.log('Cryptographic materials cleaned up');
  }
}

/**
 * Secure Key Management System
 */
export class SecureKeyManager {
  constructor() {
    this.keyStore = new Map();
    this.keyMetadata = new Map();
    this.keyUsageTracking = new Map();
  }

  /**
   * Store key securely with metadata
   */
  storeKey(keyId, key, metadata = {}) {
    this.keyStore.set(keyId, key);
    this.keyMetadata.set(keyId, {
      createdAt: Date.now(),
      lastUsed: Date.now(),
      usageCount: 0,
      algorithm: metadata.algorithm || 'unknown',
      purpose: metadata.purpose || 'general',
      expiresAt: metadata.expiresAt || null
    });
    
    this.keyUsageTracking.set(keyId, []);
    
    return keyId;
  }

  /**
   * Retrieve key with usage tracking
   */
  getKey(keyId, purpose = null) {
    const key = this.keyStore.get(keyId);
    if (!key) {
      throw new SecurityError('Key not found');
    }

    const metadata = this.keyMetadata.get(keyId);
    
    // Check if key has expired
    if (metadata.expiresAt && Date.now() > metadata.expiresAt) {
      this.deleteKey(keyId);
      throw new SecurityError('Key expired');
    }

    // Update usage tracking
    metadata.lastUsed = Date.now();
    metadata.usageCount++;
    
    const usage = this.keyUsageTracking.get(keyId);
    usage.push({
      timestamp: Date.now(),
      purpose: purpose || 'unknown'
    });

    return key;
  }

  /**
   * Delete key securely
   */
  deleteKey(keyId) {
    const key = this.keyStore.get(keyId);
    if (key && Buffer.isBuffer(key)) {
      key.fill(0); // Secure wipe
    }
    
    this.keyStore.delete(keyId);
    this.keyMetadata.delete(keyId);
    this.keyUsageTracking.delete(keyId);
    
    return true;
  }

  /**
   * List all stored keys with metadata
   */
  listKeys() {
    const keys = [];
    
    for (const [keyId, metadata] of this.keyMetadata.entries()) {
      keys.push({
        keyId,
        ...metadata,
        hasKey: this.keyStore.has(keyId)
      });
    }
    
    return keys;
  }

  /**
   * Clean up expired keys
   */
  cleanupExpiredKeys() {
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [keyId, metadata] of this.keyMetadata.entries()) {
      if (metadata.expiresAt && now > metadata.expiresAt) {
        this.deleteKey(keyId);
        cleanedCount++;
      }
    }
    
    return cleanedCount;
  }
}

// Export singleton instances
export const cryptoManager = new CryptographicSecurityManager();
export const keyManager = new SecureKeyManager();

// Cleanup on process exit
process.on('exit', () => {
  cryptoManager.cleanup();
});

process.on('SIGINT', () => {
  cryptoManager.cleanup();
  process.exit(0);
});

process.on('SIGTERM', () => {
  cryptoManager.cleanup();
  process.exit(0);
});