/**
 * Core JOSE/JWS Operations for kgen-core Provenance
 * 
 * Provides low-level JOSE operations for the attestation system:
 * - JWS token creation and verification
 * - Key format conversions and utilities
 * - RFC 7515 compliant implementations
 * - Performance optimizations for high-volume operations
 */

import { 
  SignJWT, 
  jwtVerify, 
  importJWK, 
  exportJWK,
  generateKeyPair as joseGenerateKeyPair
} from 'jose';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

export class JOSEOperations {
  constructor(config = {}) {
    this.config = {
      // Default JWT claims
      defaultIssuer: config.defaultIssuer || 'urn:kgen:provenance-system',
      defaultAudience: config.defaultAudience || ['urn:kgen:verifiers'],
      defaultExpiry: config.defaultExpiry || '1y', // 1 year
      
      // Clock tolerance for verification
      clockTolerance: config.clockTolerance || '5m',
      
      // Performance options
      enableCaching: config.enableCaching !== false,
      cacheSize: config.cacheSize || 1000,
      cacheTTL: config.cacheTTL || 300000, // 5 minutes
      
      // Security options  
      strictVerification: config.strictVerification !== false,
      requireKeyId: config.requireKeyId !== false,
      
      ...config
    };
    
    this.signatureCache = new Map();
    this.verificationCache = new Map();
    this.keyCache = new Map();
    this.initialized = false;
    
    this.metrics = {
      tokensCreated: 0,
      tokensVerified: 0,
      cacheHits: 0,
      cacheMisses: 0,
      errors: 0
    };
  }

  /**
   * Initialize JOSE operations
   */
  async initialize() {
    if (this.initialized) return;
    
    // Pre-warm caches if needed
    if (this.config.enableCaching) {
      this._startCacheCleanup();
    }
    
    this.initialized = true;
  }

  /**
   * Create a JWS token with the given payload and key
   * @param {Object} payload - JWT payload
   * @param {Object} keyData - Key metadata with keyPair
   * @param {string} algorithm - Signing algorithm
   * @param {Object} options - Additional options
   * @returns {Promise<string>} JWS token
   */
  async signPayload(payload, keyData, algorithm, options = {}) {
    if (!keyData.keyPair?.privateKey) {
      throw new Error('Private key not available for signing');
    }
    
    try {
      // Prepare headers
      const headers = {
        alg: algorithm,
        typ: 'JWT',
        kid: keyData.keyId,
        ...options.headers
      };
      
      // Prepare payload with standard claims
      const now = Math.floor(Date.now() / 1000);
      const enhancedPayload = {
        // Standard JWT claims
        iss: options.issuer || this.config.defaultIssuer,
        aud: options.audience || this.config.defaultAudience,
        iat: now,
        exp: now + this._parseExpiry(options.expiry || this.config.defaultExpiry),
        jti: options.jti || uuidv4(),
        
        // Custom payload
        ...payload
      };
      
      // Create and sign the JWT
      const jwt = await new SignJWT(enhancedPayload)
        .setProtectedHeader(headers)
        .sign(keyData.keyPair.privateKey);
      
      this.metrics.tokensCreated++;
      
      // Cache the result if enabled
      if (this.config.enableCaching && options.cacheKey) {
        this._cacheSignature(options.cacheKey, jwt);
      }
      
      return jwt;
      
    } catch (error) {
      this.metrics.errors++;
      throw new Error(`Failed to create JWS token: ${error.message}`);
    }
  }

  /**
   * Verify a JWS token
   * @param {string} jwsToken - JWS token to verify
   * @param {Object} keyData - Key metadata with keyPair or publicJWK
   * @param {Object} options - Verification options
   * @returns {Promise<Object>} Verification result
   */
  async verifyToken(jwsToken, keyData, options = {}) {
    try {
      // Check cache first
      const cacheKey = this._generateCacheKey('verify', jwsToken, keyData.keyId);
      if (this.config.enableCaching && this.verificationCache.has(cacheKey)) {
        const cached = this.verificationCache.get(cacheKey);
        if (Date.now() - cached.timestamp < this.config.cacheTTL) {
          this.metrics.cacheHits++;
          return { ...cached.result, fromCache: true };
        }
      }
      
      this.metrics.cacheMisses++;
      
      // Get the public key for verification
      let publicKey;
      if (keyData.keyPair?.publicKey) {
        publicKey = keyData.keyPair.publicKey;
      } else if (keyData.publicJWK) {
        publicKey = await importJWK(keyData.publicJWK, keyData.publicJWK.alg);
      } else {
        throw new Error('No public key available for verification');
      }
      
      // Prepare verification options
      const verifyOptions = {
        issuer: options.issuer || this.config.defaultIssuer,
        audience: options.audience || this.config.defaultAudience,
        clockTolerance: options.clockTolerance || this.config.clockTolerance,
        ...options.joseOptions
      };
      
      // Verify the token
      const { payload, protectedHeader } = await jwtVerify(jwsToken, publicKey, verifyOptions);
      
      const result = {
        valid: true,
        payload,
        header: protectedHeader,
        keyId: protectedHeader.kid,
        algorithm: protectedHeader.alg,
        verifiedAt: new Date().toISOString(),
        
        // Additional verification metadata
        claims: {
          issuer: payload.iss,
          audience: Array.isArray(payload.aud) ? payload.aud : [payload.aud],
          subject: payload.sub,
          issuedAt: payload.iat ? new Date(payload.iat * 1000).toISOString() : null,
          expiresAt: payload.exp ? new Date(payload.exp * 1000).toISOString() : null,
          notBefore: payload.nbf ? new Date(payload.nbf * 1000).toISOString() : null,
          jwtId: payload.jti
        }
      };
      
      this.metrics.tokensVerified++;
      
      // Cache the result
      if (this.config.enableCaching) {
        this._cacheVerification(cacheKey, result);
      }
      
      return result;
      
    } catch (error) {
      this.metrics.errors++;
      
      const result = {
        valid: false,
        error: error.message,
        errorCode: error.code,
        verifiedAt: new Date().toISOString()
      };
      
      return result;
    }
  }

  /**
   * Extract and parse JWT header without verification
   * @param {string} jwsToken - JWS token
   * @returns {Object} Parsed header
   */
  parseHeader(jwsToken) {
    try {
      const [headerB64] = jwsToken.split('.');
      if (!headerB64) {
        throw new Error('Invalid JWT format');
      }
      
      const headerJson = Buffer.from(headerB64, 'base64url').toString('utf8');
      return JSON.parse(headerJson);
      
    } catch (error) {
      throw new Error(`Failed to parse JWT header: ${error.message}`);
    }
  }

  /**
   * Extract and parse JWT payload without verification
   * WARNING: Use only for inspection, not for trusted operations
   * @param {string} jwsToken - JWS token
   * @returns {Object} Parsed payload
   */
  parsePayload(jwsToken) {
    try {
      const parts = jwsToken.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid JWT format');
      }
      
      const [, payloadB64] = parts;
      const payloadJson = Buffer.from(payloadB64, 'base64url').toString('utf8');
      return JSON.parse(payloadJson);
      
    } catch (error) {
      throw new Error(`Failed to parse JWT payload: ${error.message}`);
    }
  }

  /**
   * Validate JWT structure without cryptographic verification
   * @param {string} jwsToken - JWS token
   * @returns {Object} Validation result
   */
  validateStructure(jwsToken) {
    const result = {
      valid: true,
      errors: [],
      warnings: []
    };
    
    try {
      // Check basic structure
      const parts = jwsToken.split('.');
      if (parts.length !== 3) {
        result.valid = false;
        result.errors.push('JWT must have exactly 3 parts separated by dots');
        return result;
      }
      
      const [headerB64, payloadB64, signatureB64] = parts;
      
      // Validate base64url encoding
      if (!this._isValidBase64Url(headerB64)) {
        result.valid = false;
        result.errors.push('Header is not valid base64url');
      }
      
      if (!this._isValidBase64Url(payloadB64)) {
        result.valid = false;
        result.errors.push('Payload is not valid base64url');
      }
      
      if (!this._isValidBase64Url(signatureB64)) {
        result.valid = false;
        result.errors.push('Signature is not valid base64url');
      }
      
      if (!result.valid) return result;
      
      // Parse and validate header
      try {
        const header = this.parseHeader(jwsToken);
        
        if (!header.alg) {
          result.valid = false;
          result.errors.push('Header missing required "alg" field');
        }
        
        if (header.typ && header.typ !== 'JWT') {
          result.warnings.push(`Non-standard "typ" value: ${header.typ}`);
        }
        
        if (this.config.requireKeyId && !header.kid) {
          result.warnings.push('Header missing "kid" field');
        }
        
      } catch (error) {
        result.valid = false;
        result.errors.push(`Invalid header JSON: ${error.message}`);
      }
      
      // Parse and validate payload
      try {
        const payload = this.parsePayload(jwsToken);
        
        // Check for required claims
        const now = Math.floor(Date.now() / 1000);
        
        if (payload.exp && payload.exp <= now) {
          result.warnings.push('Token appears to be expired');
        }
        
        if (payload.nbf && payload.nbf > now) {
          result.warnings.push('Token not yet valid (nbf claim)');
        }
        
        if (payload.iat && payload.iat > now + 60) {
          result.warnings.push('Token issued in the future');
        }
        
      } catch (error) {
        result.valid = false;
        result.errors.push(`Invalid payload JSON: ${error.message}`);
      }
      
    } catch (error) {
      result.valid = false;
      result.errors.push(`Structure validation failed: ${error.message}`);
    }
    
    return result;
  }

  /**
   * Generate a compact JWS token for embedding
   * @param {Object} minimalPayload - Minimal payload for size optimization
   * @param {Object} keyData - Key data
   * @param {string} algorithm - Algorithm
   * @param {Object} options - Options
   * @returns {Promise<string>} Compact JWS token
   */
  async createCompactToken(minimalPayload, keyData, algorithm, options = {}) {
    // Create minimal header
    const compactHeaders = {
      alg: algorithm,
      ...(options.includeKeyId && { kid: keyData.keyId })
    };
    
    // Create minimal payload
    const now = Math.floor(Date.now() / 1000);
    const compactPayload = {
      iss: options.issuer || this.config.defaultIssuer,
      iat: now,
      exp: now + (options.shortExpiry || 3600), // 1 hour default
      ...minimalPayload
    };
    
    return await this.signPayload(compactPayload, keyData, algorithm, {
      ...options,
      headers: compactHeaders
    });
  }

  /**
   * Batch sign multiple payloads efficiently
   * @param {Array} payloads - Array of payloads to sign
   * @param {Object} keyData - Key data
   * @param {string} algorithm - Algorithm
   * @param {Object} options - Options
   * @returns {Promise<Array>} Array of JWS tokens
   */
  async batchSign(payloads, keyData, algorithm, options = {}) {
    const tokens = [];
    const batchId = uuidv4();
    
    for (let i = 0; i < payloads.length; i++) {
      const payload = payloads[i];
      const tokenOptions = {
        ...options,
        jti: `${batchId}-${i}`,
        headers: {
          ...options.headers,
          batch: batchId,
          batch_index: i,
          batch_total: payloads.length
        }
      };
      
      try {
        const token = await this.signPayload(payload, keyData, algorithm, tokenOptions);
        tokens.push({ index: i, token, error: null });
      } catch (error) {
        tokens.push({ index: i, token: null, error: error.message });
      }
    }
    
    return tokens;
  }

  /**
   * Convert between key formats
   * @param {Object} key - Key in any supported format
   * @param {string} targetFormat - Target format (jwk, pem, der)
   * @param {Object} options - Conversion options
   * @returns {Promise<Object>} Converted key
   */
  async convertKeyFormat(key, targetFormat, options = {}) {
    // This is a placeholder - full implementation would handle:
    // - JWK ↔ PEM conversion
    // - Different key types (RSA, Ed25519, ECDSA)
    // - Public/private key extraction
    
    switch (targetFormat.toLowerCase()) {
      case 'jwk':
        if (key.kty) return key; // Already JWK
        // Convert from other formats to JWK
        throw new Error('Key format conversion not yet implemented');
        
      case 'pem':
        // Convert to PEM format
        throw new Error('PEM conversion not yet implemented');
        
      case 'der':
        // Convert to DER format  
        throw new Error('DER conversion not yet implemented');
        
      default:
        throw new Error(`Unsupported target format: ${targetFormat}`);
    }
  }

  /**
   * Get JOSE operations status and metrics
   */
  getStatus() {
    return {
      initialized: this.initialized,
      metrics: this.metrics,
      
      caching: {
        enabled: this.config.enableCaching,
        signatureCache: this.signatureCache.size,
        verificationCache: this.verificationCache.size,
        keyCache: this.keyCache.size,
        maxSize: this.config.cacheSize,
        ttl: this.config.cacheTTL,
        hitRate: this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses) || 0
      },
      
      configuration: {
        defaultIssuer: this.config.defaultIssuer,
        defaultExpiry: this.config.defaultExpiry,
        clockTolerance: this.config.clockTolerance,
        strictVerification: this.config.strictVerification
      },
      
      performance: {
        avgTokenCreationTime: 0, // Would track in production
        avgVerificationTime: 0,   // Would track in production
        errorRate: this.metrics.errors / (this.metrics.tokensCreated + this.metrics.tokensVerified) || 0
      }
    };
  }

  // Private methods

  _parseExpiry(expiry) {
    if (typeof expiry === 'number') return expiry;
    if (typeof expiry === 'string') {
      const match = expiry.match(/^(\d+)([smhdy])$/);
      if (match) {
        const [, num, unit] = match;
        const multipliers = { s: 1, m: 60, h: 3600, d: 86400, y: 31536000 };
        return parseInt(num) * multipliers[unit];
      }
    }
    return 31536000; // Default to 1 year
  }

  _isValidBase64Url(str) {
    try {
      Buffer.from(str, 'base64url');
      return true;
    } catch {
      return false;
    }
  }

  _generateCacheKey(operation, token, keyId) {
    const data = `${operation}:${keyId}:${crypto.createHash('md5').update(token).digest('hex')}`;
    return crypto.createHash('md5').update(data).digest('hex');
  }

  _cacheSignature(key, signature) {
    if (this.signatureCache.size >= this.config.cacheSize) {
      const firstKey = this.signatureCache.keys().next().value;
      this.signatureCache.delete(firstKey);
    }
    
    this.signatureCache.set(key, {
      signature,
      timestamp: Date.now()
    });
  }

  _cacheVerification(key, result) {
    if (this.verificationCache.size >= this.config.cacheSize) {
      const firstKey = this.verificationCache.keys().next().value;
      this.verificationCache.delete(firstKey);
    }
    
    this.verificationCache.set(key, {
      result,
      timestamp: Date.now()
    });
  }

  _startCacheCleanup() {
    // Clean expired cache entries every 5 minutes
    setInterval(() => {
      this._cleanupCache();
    }, 300000);
  }

  _cleanupCache() {
    const now = Date.now();
    const ttl = this.config.cacheTTL;
    
    // Clean signature cache
    for (const [key, entry] of this.signatureCache.entries()) {
      if (now - entry.timestamp > ttl) {
        this.signatureCache.delete(key);
      }
    }
    
    // Clean verification cache
    for (const [key, entry] of this.verificationCache.entries()) {
      if (now - entry.timestamp > ttl) {
        this.verificationCache.delete(key);
      }
    }
  }
}

export default JOSEOperations;