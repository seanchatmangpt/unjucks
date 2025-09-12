/**
 * Key Validation and Format Detection Utilities
 * 
 * Provides comprehensive validation for various key formats
 * and secure parsing of key files.
 */

import crypto from 'crypto';
import fs from 'fs/promises';
import forge from 'node-forge';

export class KeyValidator {
  constructor() {
    this.supportedFormats = ['PEM', 'JWK', 'DER', 'OPENSSH'];
    this.supportedAlgorithms = ['RSA', 'Ed25519', 'ECDSA', 'DSA'];
  }

  /**
   * Detect key format from key data
   */
  detectKeyFormat(keyData) {
    const keyString = Buffer.isBuffer(keyData) ? keyData.toString() : keyData;
    
    // PEM format detection
    if (keyString.includes('-----BEGIN') && keyString.includes('-----END')) {
      if (keyString.includes('RSA PRIVATE KEY')) return { format: 'PEM', type: 'private', algorithm: 'RSA' };
      if (keyString.includes('RSA PUBLIC KEY')) return { format: 'PEM', type: 'public', algorithm: 'RSA' };
      if (keyString.includes('PRIVATE KEY')) return { format: 'PEM', type: 'private', algorithm: 'PKCS8' };
      if (keyString.includes('PUBLIC KEY')) return { format: 'PEM', type: 'public', algorithm: 'SPKI' };
      if (keyString.includes('OPENSSH PRIVATE KEY')) return { format: 'PEM', type: 'private', algorithm: 'OpenSSH' };
    }
    
    // JWK format detection
    try {
      const parsed = JSON.parse(keyString);
      if (parsed.kty && (parsed.n || parsed.x || parsed.y)) {
        return { format: 'JWK', type: this._detectJWKType(parsed), algorithm: this._detectJWKAlgorithm(parsed) };
      }
    } catch {
      // Not JSON
    }
    
    // OpenSSH public key format
    if (keyString.startsWith('ssh-') || keyString.startsWith('ecdsa-') || keyString.startsWith('ssh-ed25519')) {
      return { format: 'OPENSSH', type: 'public', algorithm: this._detectOpenSSHAlgorithm(keyString) };
    }
    
    // DER format (binary)
    if (Buffer.isBuffer(keyData) || keyData.length > 100) {
      try {
        // Try to parse as DER
        const asn1 = forge.asn1.fromDer(keyData.toString('binary'));
        return { format: 'DER', type: 'unknown', algorithm: 'ASN.1' };
      } catch {
        // Not DER
      }
    }
    
    return { format: 'UNKNOWN', type: 'unknown', algorithm: 'unknown' };
  }

  /**
   * Validate key strength and security properties
   */
  async validateKeyStrength(keyData, algorithm) {
    const validation = {
      valid: true,
      warnings: [],
      errors: [],
      strength: 'unknown',
      recommendations: []
    };

    try {
      switch (algorithm) {
        case 'RSA':
          return this._validateRSAKey(keyData, validation);
        
        case 'Ed25519':
          return this._validateEd25519Key(keyData, validation);
        
        case 'ECDSA':
          return this._validateECDSAKey(keyData, validation);
        
        default:
          validation.errors.push(`Unsupported algorithm: ${algorithm}`);
          validation.valid = false;
      }
    } catch (error) {
      validation.errors.push(`Validation error: ${error.message}`);
      validation.valid = false;
    }

    return validation;
  }

  /**
   * Parse key file safely with format detection
   */
  async parseKeyFile(filePath, passphrase = null) {
    try {
      const keyData = await fs.readFile(filePath);
      const formatInfo = this.detectKeyFormat(keyData);
      
      if (formatInfo.format === 'UNKNOWN') {
        throw new Error('Unsupported or unrecognized key format');
      }

      const parsedKey = await this._parseKeyByFormat(keyData, formatInfo, passphrase);
      
      // Validate the parsed key
      const validation = await this.validateKeyStrength(parsedKey, formatInfo.algorithm);
      
      return {
        ...parsedKey,
        format: formatInfo,
        validation,
        filePath
      };
    } catch (error) {
      throw new Error(`Failed to parse key file ${filePath}: ${error.message}`);
    }
  }

  /**
   * Extract public key fingerprint from various formats
   */
  generateFingerprint(publicKeyData, algorithm, hashAlgorithm = 'sha256') {
    try {
      let keyBuffer;
      
      switch (algorithm) {
        case 'RSA':
          if (typeof publicKeyData === 'string' && publicKeyData.includes('-----BEGIN')) {
            // PEM format
            const publicKey = crypto.createPublicKey(publicKeyData);
            keyBuffer = publicKey.export({ type: 'spki', format: 'der' });
          } else {
            keyBuffer = Buffer.from(publicKeyData);
          }
          break;
        
        case 'Ed25519':
        case 'ECDSA':
          keyBuffer = Buffer.isBuffer(publicKeyData) ? publicKeyData : Buffer.from(publicKeyData, 'hex');
          break;
        
        default:
          throw new Error(`Fingerprint generation not supported for ${algorithm}`);
      }

      const hash = crypto.createHash(hashAlgorithm);
      hash.update(keyBuffer);
      return hash.digest('hex');
    } catch (error) {
      throw new Error(`Failed to generate fingerprint: ${error.message}`);
    }
  }

  /**
   * Convert between key formats
   */
  async convertKeyFormat(keyData, fromFormat, toFormat, options = {}) {
    if (fromFormat === toFormat) {
      return keyData;
    }

    try {
      // First parse the key in the source format
      const parsed = await this._parseKeyByFormat(keyData, { format: fromFormat }, options.passphrase);
      
      // Then convert to target format
      return this._formatKey(parsed, toFormat, options);
    } catch (error) {
      throw new Error(`Format conversion failed: ${error.message}`);
    }
  }

  /**
   * Validate key pair consistency (public key matches private key)
   */
  async validateKeyPairConsistency(privateKeyData, publicKeyData, algorithm) {
    try {
      let derivedPublicKey;
      
      switch (algorithm) {
        case 'RSA':
          const privateKey = crypto.createPrivateKey(privateKeyData);
          derivedPublicKey = crypto.createPublicKey(privateKey);
          const providedPublicKey = crypto.createPublicKey(publicKeyData);
          
          // Compare the key components
          const privateParts = privateKey.asymmetricKeyDetails;
          const publicParts = providedPublicKey.asymmetricKeyDetails;
          
          return privateParts.mgf === publicParts.mgf && 
                 privateParts.modulusLength === publicParts.modulusLength;
        
        case 'Ed25519':
          // For Ed25519, derive public key from private and compare
          const ed25519 = await import('@noble/ed25519');
          derivedPublicKey = await ed25519.getPublicKey(privateKeyData);
          return Buffer.compare(Buffer.from(derivedPublicKey), Buffer.from(publicKeyData)) === 0;
        
        case 'ECDSA':
          // For ECDSA, derive public key from private and compare
          const secp256k1 = await import('@noble/secp256k1');
          derivedPublicKey = secp256k1.getPublicKey(privateKeyData);
          return Buffer.compare(Buffer.from(derivedPublicKey), Buffer.from(publicKeyData)) === 0;
        
        default:
          throw new Error(`Key pair validation not supported for ${algorithm}`);
      }
    } catch (error) {
      throw new Error(`Key pair validation failed: ${error.message}`);
    }
  }

  // Private helper methods

  _detectJWKType(jwk) {
    if (jwk.d) return 'private';
    if (jwk.n || jwk.x || jwk.y) return 'public';
    return 'unknown';
  }

  _detectJWKAlgorithm(jwk) {
    switch (jwk.kty) {
      case 'RSA': return 'RSA';
      case 'EC': return 'ECDSA';
      case 'OKP': 
        if (jwk.crv === 'Ed25519') return 'Ed25519';
        if (jwk.crv === 'X25519') return 'X25519';
        return 'OKP';
      default: return 'unknown';
    }
  }

  _detectOpenSSHAlgorithm(keyString) {
    if (keyString.startsWith('ssh-rsa')) return 'RSA';
    if (keyString.startsWith('ssh-ed25519')) return 'Ed25519';
    if (keyString.startsWith('ecdsa-sha2-')) return 'ECDSA';
    if (keyString.startsWith('ssh-dss')) return 'DSA';
    return 'unknown';
  }

  _validateRSAKey(keyData, validation) {
    try {
      const key = crypto.createPublicKey(keyData);
      const keyDetails = key.asymmetricKeyDetails;
      const keySize = keyDetails.modulusLength;
      
      if (keySize < 2048) {
        validation.errors.push('RSA key size below 2048 bits is considered insecure');
        validation.valid = false;
        validation.strength = 'weak';
      } else if (keySize === 2048) {
        validation.strength = 'adequate';
        validation.warnings.push('Consider using 3072+ bit keys for long-term security');
      } else if (keySize >= 3072) {
        validation.strength = 'strong';
      }

      // Check public exponent
      if (keyDetails.publicExponent && keyDetails.publicExponent < 65537) {
        validation.warnings.push('Public exponent below 65537 may be vulnerable to attacks');
      }

    } catch (error) {
      validation.errors.push(`RSA key validation failed: ${error.message}`);
      validation.valid = false;
    }

    return validation;
  }

  _validateEd25519Key(keyData, validation) {
    try {
      // Ed25519 keys are always 32 bytes and considered cryptographically strong
      const keyBuffer = Buffer.isBuffer(keyData) ? keyData : Buffer.from(keyData, 'hex');
      
      if (keyBuffer.length !== 32) {
        validation.errors.push('Ed25519 key must be exactly 32 bytes');
        validation.valid = false;
        validation.strength = 'invalid';
      } else {
        validation.strength = 'strong';
        validation.recommendations.push('Ed25519 provides excellent security and performance');
      }
    } catch (error) {
      validation.errors.push(`Ed25519 key validation failed: ${error.message}`);
      validation.valid = false;
    }

    return validation;
  }

  _validateECDSAKey(keyData, validation) {
    try {
      // Most ECDSA implementations use secp256k1 or P-256
      const keyBuffer = Buffer.isBuffer(keyData) ? keyData : Buffer.from(keyData, 'hex');
      
      if (keyBuffer.length === 32) {
        validation.strength = 'strong';
        validation.recommendations.push('ECDSA with 256-bit curve provides good security');
      } else if (keyBuffer.length < 32) {
        validation.warnings.push('ECDSA key appears to be using a smaller curve');
        validation.strength = 'adequate';
      } else {
        validation.strength = 'strong';
      }
    } catch (error) {
      validation.errors.push(`ECDSA key validation failed: ${error.message}`);
      validation.valid = false;
    }

    return validation;
  }

  async _parseKeyByFormat(keyData, formatInfo, passphrase) {
    switch (formatInfo.format) {
      case 'PEM':
        return this._parsePEMKey(keyData, passphrase);
      
      case 'JWK':
        return this._parseJWKKey(keyData);
      
      case 'DER':
        return this._parseDERKey(keyData);
      
      case 'OPENSSH':
        return this._parseOpenSSHKey(keyData);
      
      default:
        throw new Error(`Parsing not supported for format: ${formatInfo.format}`);
    }
  }

  _parsePEMKey(keyData, passphrase) {
    try {
      const keyString = Buffer.isBuffer(keyData) ? keyData.toString() : keyData;
      
      if (keyString.includes('PRIVATE KEY')) {
        const privateKey = crypto.createPrivateKey({
          key: keyString,
          ...(passphrase && { passphrase })
        });
        
        const publicKey = crypto.createPublicKey(privateKey);
        
        return {
          privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }),
          publicKey: publicKey.export({ type: 'spki', format: 'pem' }),
          algorithm: privateKey.asymmetricKeyType.toUpperCase(),
          keyDetails: privateKey.asymmetricKeyDetails
        };
      } else {
        const publicKey = crypto.createPublicKey(keyString);
        
        return {
          publicKey: publicKey.export({ type: 'spki', format: 'pem' }),
          algorithm: publicKey.asymmetricKeyType.toUpperCase(),
          keyDetails: publicKey.asymmetricKeyDetails
        };
      }
    } catch (error) {
      throw new Error(`PEM parsing failed: ${error.message}`);
    }
  }

  _parseJWKKey(keyData) {
    try {
      const jwk = typeof keyData === 'string' ? JSON.parse(keyData) : keyData;
      
      // Convert JWK to PEM for Node.js crypto compatibility
      if (jwk.kty === 'RSA') {
        const key = crypto.createPublicKey({ format: 'jwk', key: jwk });
        return {
          publicKey: key.export({ type: 'spki', format: 'pem' }),
          algorithm: 'RSA',
          keyDetails: key.asymmetricKeyDetails,
          jwk
        };
      }
      
      // For other key types, return raw JWK data
      return {
        jwk,
        algorithm: this._detectJWKAlgorithm(jwk),
        publicKey: jwk
      };
    } catch (error) {
      throw new Error(`JWK parsing failed: ${error.message}`);
    }
  }

  _parseDERKey(keyData) {
    try {
      // Convert DER to PEM for easier handling
      const keyBuffer = Buffer.isBuffer(keyData) ? keyData : Buffer.from(keyData, 'binary');
      const base64Key = keyBuffer.toString('base64');
      const pemKey = `-----BEGIN PUBLIC KEY-----\n${base64Key}\n-----END PUBLIC KEY-----`;
      
      return this._parsePEMKey(pemKey);
    } catch (error) {
      throw new Error(`DER parsing failed: ${error.message}`);
    }
  }

  _parseOpenSSHKey(keyData) {
    try {
      const keyString = Buffer.isBuffer(keyData) ? keyData.toString() : keyData;
      const parts = keyString.trim().split(' ');
      
      if (parts.length < 2) {
        throw new Error('Invalid OpenSSH key format');
      }
      
      const algorithm = this._detectOpenSSHAlgorithm(keyString);
      const keyBlob = Buffer.from(parts[1], 'base64');
      
      return {
        algorithm,
        publicKey: keyBlob,
        format: 'OPENSSH',
        comment: parts[2] || ''
      };
    } catch (error) {
      throw new Error(`OpenSSH parsing failed: ${error.message}`);
    }
  }

  _formatKey(parsedKey, targetFormat, options = {}) {
    switch (targetFormat) {
      case 'PEM':
        return parsedKey.publicKey || parsedKey.privateKey;
      
      case 'JWK':
        if (parsedKey.jwk) return JSON.stringify(parsedKey.jwk, null, 2);
        throw new Error('JWK conversion not available for this key type');
      
      case 'DER':
        if (parsedKey.publicKey && typeof parsedKey.publicKey === 'string') {
          const key = crypto.createPublicKey(parsedKey.publicKey);
          return key.export({ type: 'spki', format: 'der' });
        }
        throw new Error('DER conversion not available');
      
      default:
        throw new Error(`Target format ${targetFormat} not supported`);
    }
  }
}

// Export default instance
export const keyValidator = new KeyValidator();