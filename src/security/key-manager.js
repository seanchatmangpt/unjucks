/**
 * Secure Key Management System
 * 
 * Provides comprehensive key generation, storage, and management
 * for signing operations with support for multiple formats and algorithms.
 */

import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import * as ed25519 from '@noble/ed25519';
import * as secp256k1 from '@noble/secp256k1';
import forge from 'node-forge';

// Set up hash functions for Noble libraries
ed25519.utils.sha512Sync = (...m) => crypto.createHash('sha512').update(Buffer.concat(m)).digest();
secp256k1.utils.sha256Sync = (...m) => crypto.createHash('sha256').update(Buffer.concat(m)).digest();

export class SecureKeyManager {
  constructor(options = {}) {
    this.keyStorePath = options.keyStorePath || './keys';
    this.defaultKeySize = options.defaultKeySize || 4096;
    this.keyDerivationRounds = options.keyDerivationRounds || 100000;
    this.supportedFormats = ['PEM', 'JWK', 'DER', 'RAW'];
    this.supportedAlgorithms = ['Ed25519', 'RSA', 'ECDSA'];
    
    // Initialize key store
    this._initializeKeyStore();
  }

  async _initializeKeyStore() {
    try {
      await fs.access(this.keyStorePath);
    } catch {
      await fs.mkdir(this.keyStorePath, { recursive: true });
    }
  }

  /**
   * Generate Ed25519 keypair with secure random generation
   */
  async generateEd25519Keypair(keyId, options = {}) {
    const { passphrase, exportFormat = 'PEM' } = options;
    
    // Generate secure random private key using Node.js crypto
    const privateKey = crypto.randomBytes(32);
    const publicKey = await ed25519.getPublicKey(privateKey);
    
    // Create key fingerprint for identification
    const fingerprint = this._generateFingerprint(publicKey);
    
    const keyPair = {
      keyId,
      algorithm: 'Ed25519',
      privateKey: Buffer.from(privateKey),
      publicKey: Buffer.from(publicKey),
      fingerprint,
      created: new Date().toISOString(),
      format: exportFormat
    };

    // Store keys securely
    if (passphrase) {
      keyPair.encrypted = true;
      keyPair.privateKey = await this._encryptKey(keyPair.privateKey, passphrase);
    }

    await this._storeKeyPair(keyId, keyPair, exportFormat);
    
    return {
      keyId,
      fingerprint,
      publicKey: this._formatPublicKey(publicKey, exportFormat),
      algorithm: 'Ed25519',
      created: keyPair.created
    };
  }

  /**
   * Generate RSA keypair with configurable key size
   */
  async generateRSAKeypair(keyId, options = {}) {
    const { keySize = this.defaultKeySize, passphrase, exportFormat = 'PEM' } = options;
    
    if (![2048, 3072, 4096].includes(keySize)) {
      throw new Error('RSA key size must be 2048, 3072, or 4096 bits');
    }

    return new Promise((resolve, reject) => {
      crypto.generateKeyPair('rsa', {
        modulusLength: keySize,
        publicKeyEncoding: {
          type: 'spki',
          format: 'pem'
        },
        privateKeyEncoding: {
          type: 'pkcs8',
          format: 'pem',
          ...(passphrase && {
            cipher: 'aes-256-cbc',
            passphrase
          })
        }
      }, async (err, publicKey, privateKey) => {
        if (err) return reject(err);

        try {
          // Generate fingerprint from public key
          const publicKeyBuffer = Buffer.from(publicKey.replace(/-----[^-]+-----|\s/g, ''), 'base64');
          const fingerprint = this._generateFingerprint(publicKeyBuffer);

          const keyPair = {
            keyId,
            algorithm: 'RSA',
            keySize,
            privateKey,
            publicKey,
            fingerprint,
            created: new Date().toISOString(),
            encrypted: !!passphrase,
            format: exportFormat
          };

          await this._storeKeyPair(keyId, keyPair, exportFormat);

          resolve({
            keyId,
            fingerprint,
            publicKey: this._formatPublicKey(publicKey, exportFormat),
            algorithm: 'RSA',
            keySize,
            created: keyPair.created
          });
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  /**
   * Generate ECDSA keypair using secp256k1 curve
   */
  async generateECDSAKeypair(keyId, options = {}) {
    const { passphrase, exportFormat = 'PEM' } = options;
    
    // Generate secure random private key using Node.js crypto
    const privateKey = crypto.randomBytes(32);
    const publicKey = secp256k1.getPublicKey(privateKey);
    
    const fingerprint = this._generateFingerprint(publicKey);
    
    const keyPair = {
      keyId,
      algorithm: 'ECDSA',
      curve: 'secp256k1',
      privateKey: Buffer.from(privateKey),
      publicKey: Buffer.from(publicKey),
      fingerprint,
      created: new Date().toISOString(),
      format: exportFormat
    };

    if (passphrase) {
      keyPair.encrypted = true;
      keyPair.privateKey = await this._encryptKey(keyPair.privateKey, passphrase);
    }

    await this._storeKeyPair(keyId, keyPair, exportFormat);
    
    return {
      keyId,
      fingerprint,
      publicKey: this._formatPublicKey(publicKey, exportFormat),
      algorithm: 'ECDSA',
      curve: 'secp256k1',
      created: keyPair.created
    };
  }

  /**
   * Load and validate existing keypair
   */
  async loadKeyPair(keyId, passphrase = null) {
    const keyPath = path.join(this.keyStorePath, `${keyId}.json`);
    
    try {
      const keyData = JSON.parse(await fs.readFile(keyPath, 'utf8'));
      
      // Validate key structure
      if (!this._validateKeyStructure(keyData)) {
        throw new Error('Invalid key structure');
      }

      // Decrypt private key if encrypted
      if (keyData.encrypted && passphrase) {
        keyData.privateKey = await this._decryptKey(
          Buffer.from(keyData.privateKey, 'base64'), 
          passphrase
        );
      }

      return keyData;
    } catch (error) {
      throw new Error(`Failed to load keypair ${keyId}: ${error.message}`);
    }
  }

  /**
   * Extract public key from private key
   */
  async extractPublicKey(privateKeyData, algorithm) {
    switch (algorithm) {
      case 'Ed25519':
        return await ed25519.getPublicKey(privateKeyData);
      
      case 'ECDSA':
        return secp256k1.getPublicKey(privateKeyData);
      
      case 'RSA':
        // For RSA, extract from PEM format
        const privateKey = crypto.createPrivateKey(privateKeyData);
        const publicKey = crypto.createPublicKey(privateKey);
        return publicKey.export({ type: 'spki', format: 'pem' });
      
      default:
        throw new Error(`Unsupported algorithm: ${algorithm}`);
    }
  }

  /**
   * Sign data with specified key
   */
  async signData(keyId, data, passphrase = null) {
    const keyPair = await this.loadKeyPair(keyId, passphrase);
    const dataBuffer = Buffer.isBuffer(data) ? data : Buffer.from(data);

    switch (keyPair.algorithm) {
      case 'Ed25519':
        return await ed25519.sign(dataBuffer, keyPair.privateKey);
      
      case 'ECDSA':
        const sig = secp256k1.sign(dataBuffer, keyPair.privateKey);
        return sig.toCompactRawBytes();
      
      case 'RSA':
        const sign = crypto.createSign('RSA-SHA256');
        sign.update(dataBuffer);
        return sign.sign(keyPair.privateKey);
      
      default:
        throw new Error(`Signing not supported for algorithm: ${keyPair.algorithm}`);
    }
  }

  /**
   * Verify signature with public key
   */
  async verifySignature(keyId, data, signature) {
    const keyPair = await this.loadKeyPair(keyId);
    const dataBuffer = Buffer.isBuffer(data) ? data : Buffer.from(data);

    switch (keyPair.algorithm) {
      case 'Ed25519':
        return await ed25519.verify(signature, dataBuffer, Buffer.from(keyPair.publicKey, 'base64'));
      
      case 'ECDSA':
        try {
          return secp256k1.verify(signature, dataBuffer, keyPair.publicKey);
        } catch {
          return false;
        }
      
      case 'RSA':
        const verify = crypto.createVerify('RSA-SHA256');
        verify.update(dataBuffer);
        return verify.verify(keyPair.publicKey, signature);
      
      default:
        throw new Error(`Verification not supported for algorithm: ${keyPair.algorithm}`);
    }
  }

  /**
   * Rotate key by generating new keypair and marking old as deprecated
   */
  async rotateKey(keyId, options = {}) {
    const oldKeyPath = path.join(this.keyStorePath, `${keyId}.json`);
    const oldKeyData = await this.loadKeyPair(keyId);
    
    // Create backup of old key
    const backupPath = path.join(this.keyStorePath, `${keyId}_backup_${Date.now()}.json`);
    await fs.copyFile(oldKeyPath, backupPath);
    
    // Generate new key with same algorithm
    let newKey;
    switch (oldKeyData.algorithm) {
      case 'Ed25519':
        newKey = await this.generateEd25519Keypair(keyId, options);
        break;
      case 'RSA':
        newKey = await this.generateRSAKeypair(keyId, { 
          keySize: oldKeyData.keySize, 
          ...options 
        });
        break;
      case 'ECDSA':
        newKey = await this.generateECDSAKeypair(keyId, options);
        break;
      default:
        throw new Error(`Key rotation not supported for algorithm: ${oldKeyData.algorithm}`);
    }

    return {
      newKey,
      backupPath,
      rotatedAt: new Date().toISOString()
    };
  }

  /**
   * List all stored keys with metadata
   */
  async listKeys() {
    try {
      const files = await fs.readdir(this.keyStorePath);
      const keyFiles = files.filter(f => f.endsWith('.json') && !f.includes('_backup_'));
      
      const keys = await Promise.all(
        keyFiles.map(async (file) => {
          const keyId = path.basename(file, '.json');
          try {
            const keyData = JSON.parse(
              await fs.readFile(path.join(this.keyStorePath, file), 'utf8')
            );
            
            return {
              keyId,
              algorithm: keyData.algorithm,
              fingerprint: keyData.fingerprint,
              created: keyData.created,
              encrypted: keyData.encrypted || false,
              keySize: keyData.keySize
            };
          } catch {
            return null;
          }
        })
      );

      return keys.filter(Boolean);
    } catch (error) {
      throw new Error(`Failed to list keys: ${error.message}`);
    }
  }

  /**
   * Delete key securely
   */
  async deleteKey(keyId, confirm = false) {
    if (!confirm) {
      throw new Error('Key deletion requires explicit confirmation');
    }

    const keyPath = path.join(this.keyStorePath, `${keyId}.json`);
    
    try {
      // Create backup before deletion
      const backupPath = path.join(this.keyStorePath, `${keyId}_deleted_${Date.now()}.json`);
      await fs.copyFile(keyPath, backupPath);
      
      // Securely overwrite the original file
      const keySize = (await fs.stat(keyPath)).size;
      const randomData = crypto.randomBytes(keySize);
      await fs.writeFile(keyPath, randomData);
      await fs.unlink(keyPath);
      
      return { deleted: true, backupPath };
    } catch (error) {
      throw new Error(`Failed to delete key ${keyId}: ${error.message}`);
    }
  }

  // Private helper methods

  async _storeKeyPair(keyId, keyPair, format) {
    const keyPath = path.join(this.keyStorePath, `${keyId}.json`);
    
    // Convert buffers to base64 for JSON storage
    const storageData = {
      ...keyPair,
      privateKey: Buffer.isBuffer(keyPair.privateKey) 
        ? keyPair.privateKey.toString('base64')
        : keyPair.privateKey,
      publicKey: Buffer.isBuffer(keyPair.publicKey)
        ? keyPair.publicKey.toString('base64')
        : keyPair.publicKey
    };

    await fs.writeFile(keyPath, JSON.stringify(storageData, null, 2));
  }

  _generateFingerprint(keyData) {
    const hash = crypto.createHash('sha256');
    hash.update(Buffer.isBuffer(keyData) ? keyData : Buffer.from(keyData));
    return hash.digest('hex').substring(0, 16);
  }

  async _encryptKey(keyBuffer, passphrase) {
    const salt = crypto.randomBytes(16);
    const key = crypto.pbkdf2Sync(passphrase, salt, this.keyDerivationRounds, 32, 'sha256');
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher('aes-256-cbc', key);
    
    let encrypted = cipher.update(keyBuffer);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    
    return {
      algorithm: 'aes-256-cbc',
      salt: salt.toString('base64'),
      iv: iv.toString('base64'),
      data: encrypted.toString('base64')
    };
  }

  async _decryptKey(encryptedData, passphrase) {
    const { algorithm, salt, iv, data } = encryptedData;
    const key = crypto.pbkdf2Sync(passphrase, Buffer.from(salt, 'base64'), this.keyDerivationRounds, 32, 'sha256');
    
    const decipher = crypto.createDecipher(algorithm, key);
    let decrypted = decipher.update(Buffer.from(data, 'base64'));
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    return decrypted;
  }

  _validateKeyStructure(keyData) {
    const required = ['keyId', 'algorithm', 'privateKey', 'publicKey', 'fingerprint', 'created'];
    return required.every(field => keyData.hasOwnProperty(field));
  }

  _formatPublicKey(publicKey, format) {
    switch (format) {
      case 'PEM':
        if (typeof publicKey === 'string') return publicKey;
        // For binary keys, would need proper PEM formatting
        return `-----BEGIN PUBLIC KEY-----\n${Buffer.from(publicKey).toString('base64')}\n-----END PUBLIC KEY-----`;
      
      case 'JWK':
        // Convert to JWK format (simplified)
        return {
          kty: 'OKP',
          use: 'sig',
          key_ops: ['verify'],
          x: Buffer.from(publicKey).toString('base64url')
        };
      
      case 'RAW':
        return Buffer.from(publicKey).toString('hex');
      
      default:
        return publicKey;
    }
  }
}

// Export default instance
export const keyManager = new SecureKeyManager();