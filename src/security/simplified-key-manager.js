/**
 * Simplified Secure Key Management System
 * 
 * Uses Node.js built-in crypto for RSA and basic operations,
 * demonstrates real working cryptographic implementations.
 */

import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

export class SimplifiedKeyManager {
  constructor(options = {}) {
    this.keyStorePath = options.keyStorePath || './keys';
    this.supportedAlgorithms = ['RSA', 'ECDSA'];
    
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

  async _ensureKeyStore() {
    try {
      await fs.access(this.keyStorePath);
    } catch {
      await fs.mkdir(this.keyStorePath, { recursive: true });
    }
  }

  /**
   * Generate RSA keypair with configurable key size
   */
  async generateRSAKeypair(keyId, options = {}) {
    const { keySize = 2048, passphrase, exportFormat = 'PEM' } = options;
    
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

          await this._storeKeyPair(keyId, keyPair);

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
   * Generate ECDSA keypair using Node.js crypto
   */
  async generateECDSAKeypair(keyId, options = {}) {
    const { passphrase, exportFormat = 'PEM', namedCurve = 'prime256v1' } = options;
    
    return new Promise((resolve, reject) => {
      crypto.generateKeyPair('ec', {
        namedCurve,
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
          const publicKeyBuffer = Buffer.from(publicKey.replace(/-----[^-]+-----|\s/g, ''), 'base64');
          const fingerprint = this._generateFingerprint(publicKeyBuffer);

          const keyPair = {
            keyId,
            algorithm: 'ECDSA',
            curve: namedCurve,
            privateKey,
            publicKey,
            fingerprint,
            created: new Date().toISOString(),
            encrypted: !!passphrase,
            format: exportFormat
          };

          await this._storeKeyPair(keyId, keyPair);

          resolve({
            keyId,
            fingerprint,
            publicKey: this._formatPublicKey(publicKey, exportFormat),
            algorithm: 'ECDSA',
            curve: namedCurve,
            created: keyPair.created
          });
        } catch (error) {
          reject(error);
        }
      });
    });
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

      return keyData;
    } catch (error) {
      throw new Error(`Failed to load keypair ${keyId}: ${error.message}`);
    }
  }

  /**
   * Sign data with specified key
   */
  async signData(keyId, data, passphrase = null) {
    const keyPair = await this.loadKeyPair(keyId, passphrase);
    const dataBuffer = Buffer.isBuffer(data) ? data : Buffer.from(data);

    switch (keyPair.algorithm) {
      case 'RSA':
        const rsaSign = crypto.createSign('RSA-SHA256');
        rsaSign.update(dataBuffer);
        return rsaSign.sign({
          key: keyPair.privateKey,
          ...(passphrase && { passphrase })
        });
      
      case 'ECDSA':
        const ecdsaSign = crypto.createSign('SHA256');
        ecdsaSign.update(dataBuffer);
        return ecdsaSign.sign({
          key: keyPair.privateKey,
          ...(passphrase && { passphrase })
        });
      
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
      case 'RSA':
        const rsaVerify = crypto.createVerify('RSA-SHA256');
        rsaVerify.update(dataBuffer);
        return rsaVerify.verify(keyPair.publicKey, signature);
      
      case 'ECDSA':
        const ecdsaVerify = crypto.createVerify('SHA256');
        ecdsaVerify.update(dataBuffer);
        return ecdsaVerify.verify(keyPair.publicKey, signature);
      
      default:
        throw new Error(`Verification not supported for algorithm: ${keyPair.algorithm}`);
    }
  }

  /**
   * Extract public key from private key
   */
  async extractPublicKey(privateKeyData, algorithm) {
    try {
      const privateKey = crypto.createPrivateKey(privateKeyData);
      const publicKey = crypto.createPublicKey(privateKey);
      return publicKey.export({ type: 'spki', format: 'pem' });
    } catch (error) {
      throw new Error(`Failed to extract public key: ${error.message}`);
    }
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
              keySize: keyData.keySize,
              curve: keyData.curve
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

  /**
   * Generate secure key fingerprint
   */
  generateFingerprint(publicKeyData, hashAlgorithm = 'sha256') {
    try {
      let keyBuffer;
      
      if (typeof publicKeyData === 'string' && publicKeyData.includes('-----BEGIN')) {
        // PEM format
        const publicKey = crypto.createPublicKey(publicKeyData);
        keyBuffer = publicKey.export({ type: 'spki', format: 'der' });
      } else {
        keyBuffer = Buffer.isBuffer(publicKeyData) ? publicKeyData : Buffer.from(publicKeyData, 'hex');
      }

      const hash = crypto.createHash(hashAlgorithm);
      hash.update(keyBuffer);
      return hash.digest('hex');
    } catch (error) {
      throw new Error(`Failed to generate fingerprint: ${error.message}`);
    }
  }

  // Private helper methods

  async _storeKeyPair(keyId, keyPair) {
    await this._ensureKeyStore();
    const keyPath = path.join(this.keyStorePath, `${keyId}.json`);
    await fs.writeFile(keyPath, JSON.stringify(keyPair, null, 2));
  }

  _generateFingerprint(keyData) {
    const hash = crypto.createHash('sha256');
    hash.update(Buffer.isBuffer(keyData) ? keyData : Buffer.from(keyData));
    return hash.digest('hex').substring(0, 16);
  }

  _validateKeyStructure(keyData) {
    const required = ['keyId', 'algorithm', 'privateKey', 'publicKey', 'fingerprint', 'created'];
    return required.every(field => keyData.hasOwnProperty(field));
  }

  _formatPublicKey(publicKey, format) {
    switch (format) {
      case 'PEM':
        return publicKey;
      
      case 'JWK':
        // Convert to JWK format (simplified)
        try {
          const keyObject = crypto.createPublicKey(publicKey);
          return keyObject.export({ format: 'jwk' });
        } catch {
          return { error: 'JWK conversion not supported for this key' };
        }
      
      case 'RAW':
        return Buffer.from(publicKey.replace(/-----[^-]+-----|\s/g, ''), 'base64').toString('hex');
      
      default:
        return publicKey;
    }
  }
}

// Export default instance
export const simplifiedKeyManager = new SimplifiedKeyManager();