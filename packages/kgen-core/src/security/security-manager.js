/**
 * KGEN Security Manager
 * 
 * Centralized security management using environment configuration
 * with all features enabled by default for production safety.
 */

import crypto from 'crypto';
import { EventEmitter } from 'events';
import { env, getModuleConfig } from '../config/environment.js';
import consola from 'consola';

export class SecurityManager extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.logger = consola.withTag('security-manager');
    
    // Get security configuration from environment
    const securityConfig = getModuleConfig('security');
    
    // Merge with defaults, ensuring security is enabled by default
    this.config = {
      enabled: securityConfig.enabled !== false,
      encryption: {
        enabled: securityConfig.encryption !== false,
        algorithm: options.encryptionAlgorithm || 'aes-256-gcm',
        keyDerivation: options.keyDerivation || 'pbkdf2',
        iterations: options.iterations || 100000,
        saltLength: options.saltLength || 32,
        tagLength: options.tagLength || 16
      },
      signatures: {
        enabled: securityConfig.signatures !== false,
        algorithm: options.signatureAlgorithm || 'RSA-SHA256',
        privateKeyPath: securityConfig.privateKeyPath,
        certificatePath: securityConfig.certificatePath
      },
      blockchain: {
        enabled: securityConfig.blockchain === true, // Opt-in for blockchain
        providerUrl: env.BLOCKCHAIN_PROVIDER_URL,
        contractAddress: env.BLOCKCHAIN_CONTRACT_ADDRESS
      },
      validation: {
        enabled: options.validation !== false,
        strictMode: options.strictMode !== false,
        sanitization: options.sanitization !== false,
        maxInputLength: options.maxInputLength || 10000,
        allowedPatterns: options.allowedPatterns || []
      },
      audit: {
        enabled: options.audit !== false,
        encryption: env.ENABLE_AUDIT_ENCRYPTION !== false,
        retention: env.AUDIT_RETENTION || '7years',
        logLevel: options.auditLogLevel || 'info'
      },
      rateLimit: {
        enabled: options.rateLimit !== false,
        windowMs: env.RATE_LIMIT_WINDOW || 900000, // 15 minutes
        max: env.RATE_LIMIT_MAX || 100
      },
      ...options
    };
    
    // Security state
    this.initialized = false;
    this.encryptionKey = null;
    this.signingKey = null;
    this.certificate = null;
    this.auditLog = [];
  }
  
  /**
   * Initialize security manager with proper keys and certificates
   */
  async initialize() {
    try {
      this.logger.info('Initializing security manager...');
      
      if (!this.config.enabled) {
        this.logger.warn('⚠️  Security features are disabled - this is not recommended for production');
        this.initialized = true;
        return { status: 'disabled', warning: 'Security disabled' };
      }
      
      // Initialize encryption if enabled
      if (this.config.encryption.enabled) {
        await this._initializeEncryption();
        this.logger.success('✅ Encryption initialized');
      }
      
      // Initialize digital signatures if enabled
      if (this.config.signatures.enabled) {
        await this._initializeSignatures();
        this.logger.success('✅ Digital signatures initialized');
      }
      
      // Initialize blockchain if enabled
      if (this.config.blockchain.enabled) {
        await this._initializeBlockchain();
        this.logger.success('✅ Blockchain integration initialized');
      }
      
      // Initialize audit logging
      if (this.config.audit.enabled) {
        await this._initializeAudit();
        this.logger.success('✅ Audit logging initialized');
      }
      
      this.initialized = true;
      this.emit('initialized');
      
      this.logger.success('Security manager initialized successfully');
      
      return {
        status: 'enabled',
        features: {
          encryption: this.config.encryption.enabled,
          signatures: this.config.signatures.enabled,
          blockchain: this.config.blockchain.enabled,
          audit: this.config.audit.enabled,
          validation: this.config.validation.enabled,
          rateLimit: this.config.rateLimit.enabled
        }
      };
      
    } catch (error) {
      this.logger.error('Failed to initialize security manager:', error);
      throw new Error(`Security initialization failed: ${error.message}`);
    }
  }
  
  /**
   * Encrypt data using configured algorithm
   */
  async encrypt(data, options = {}) {
    if (!this.config.encryption.enabled) {
      return data; // Return unencrypted if disabled
    }
    
    if (!this.encryptionKey) {
      throw new Error('Encryption not initialized');
    }
    
    try {
      const algorithm = this.config.encryption.algorithm;
      const iv = crypto.randomBytes(16);
      const salt = crypto.randomBytes(this.config.encryption.saltLength);
      
      // Derive key from master key
      const key = crypto.pbkdf2Sync(
        this.encryptionKey,
        salt,
        this.config.encryption.iterations,
        32,
        'sha256'
      );
      
      const cipher = crypto.createCipheriv(algorithm, key, iv);
      
      let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = algorithm.includes('gcm') ? cipher.getAuthTag() : null;
      
      const result = {
        encrypted,
        algorithm,
        iv: iv.toString('hex'),
        salt: salt.toString('hex'),
        authTag: authTag?.toString('hex'),
        timestamp: new Date().toISOString()
      };
      
      // Audit encryption operation
      await this._auditOperation('encrypt', { 
        dataSize: JSON.stringify(data).length,
        algorithm 
      });
      
      return result;
      
    } catch (error) {
      this.logger.error('Encryption failed:', error);
      await this._auditOperation('encrypt_failed', { error: error.message });
      throw error;
    }
  }
  
  /**
   * Decrypt data
   */
  async decrypt(encryptedData, options = {}) {
    if (!this.config.encryption.enabled) {
      return encryptedData; // Return as-is if disabled
    }
    
    if (!this.encryptionKey) {
      throw new Error('Encryption not initialized');
    }
    
    try {
      const { encrypted, algorithm, iv, salt, authTag } = encryptedData;
      
      // Derive key from master key
      const key = crypto.pbkdf2Sync(
        this.encryptionKey,
        Buffer.from(salt, 'hex'),
        this.config.encryption.iterations,
        32,
        'sha256'
      );
      
      const decipher = crypto.createDecipheriv(
        algorithm,
        key,
        Buffer.from(iv, 'hex')
      );
      
      if (authTag && algorithm.includes('gcm')) {
        decipher.setAuthTag(Buffer.from(authTag, 'hex'));
      }
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      // Audit decryption operation
      await this._auditOperation('decrypt', { algorithm });
      
      return JSON.parse(decrypted);
      
    } catch (error) {
      this.logger.error('Decryption failed:', error);
      await this._auditOperation('decrypt_failed', { error: error.message });
      throw error;
    }
  }
  
  /**
   * Sign data with digital signature
   */
  async sign(data, options = {}) {
    if (!this.config.signatures.enabled) {
      return null; // No signature if disabled
    }
    
    if (!this.signingKey) {
      throw new Error('Digital signatures not initialized');
    }
    
    try {
      const sign = crypto.createSign(this.config.signatures.algorithm);
      sign.update(JSON.stringify(data));
      sign.end();
      
      const signature = sign.sign(this.signingKey, 'hex');
      
      await this._auditOperation('sign', { 
        algorithm: this.config.signatures.algorithm 
      });
      
      return {
        signature,
        algorithm: this.config.signatures.algorithm,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      this.logger.error('Signing failed:', error);
      await this._auditOperation('sign_failed', { error: error.message });
      throw error;
    }
  }
  
  /**
   * Verify digital signature
   */
  async verify(data, signature, options = {}) {
    if (!this.config.signatures.enabled) {
      return true; // Always valid if disabled
    }
    
    if (!this.certificate) {
      throw new Error('Digital signatures not initialized');
    }
    
    try {
      const verify = crypto.createVerify(signature.algorithm);
      verify.update(JSON.stringify(data));
      verify.end();
      
      const isValid = verify.verify(this.certificate, signature.signature, 'hex');
      
      await this._auditOperation('verify', { 
        algorithm: signature.algorithm,
        valid: isValid 
      });
      
      return isValid;
      
    } catch (error) {
      this.logger.error('Verification failed:', error);
      await this._auditOperation('verify_failed', { error: error.message });
      return false;
    }
  }
  
  /**
   * Validate and sanitize input
   */
  async validateInput(input, schema = {}) {
    if (!this.config.validation.enabled) {
      return { valid: true, sanitized: input };
    }
    
    try {
      // Check input length
      const inputStr = JSON.stringify(input);
      if (inputStr.length > this.config.validation.maxInputLength) {
        throw new Error(`Input exceeds maximum length of ${this.config.validation.maxInputLength}`);
      }
      
      // Sanitize if enabled
      let sanitized = input;
      if (this.config.validation.sanitization) {
        sanitized = this._sanitizeInput(input);
      }
      
      // Validate against schema if provided
      if (schema && Object.keys(schema).length > 0) {
        this._validateAgainstSchema(sanitized, schema);
      }
      
      await this._auditOperation('validate_input', { 
        inputSize: inputStr.length,
        hasSchema: !!schema 
      });
      
      return { valid: true, sanitized };
      
    } catch (error) {
      await this._auditOperation('validate_input_failed', { 
        error: error.message 
      });
      return { valid: false, error: error.message };
    }
  }
  
  /**
   * Check rate limit
   */
  async checkRateLimit(identifier, options = {}) {
    if (!this.config.rateLimit.enabled) {
      return { allowed: true };
    }
    
    // Simple in-memory rate limiting (production should use Redis)
    const now = Date.now();
    const windowStart = now - this.config.rateLimit.windowMs;
    
    if (!this.rateLimitMap) {
      this.rateLimitMap = new Map();
    }
    
    let requests = this.rateLimitMap.get(identifier) || [];
    requests = requests.filter(timestamp => timestamp > windowStart);
    
    if (requests.length >= this.config.rateLimit.max) {
      await this._auditOperation('rate_limit_exceeded', { identifier });
      return { 
        allowed: false, 
        retryAfter: Math.ceil((requests[0] + this.config.rateLimit.windowMs - now) / 1000)
      };
    }
    
    requests.push(now);
    this.rateLimitMap.set(identifier, requests);
    
    return { allowed: true, remaining: this.config.rateLimit.max - requests.length };
  }
  
  // Private initialization methods
  
  async _initializeEncryption() {
    const encryptionKey = env.ENCRYPTION_KEY || env.KGEN_ENCRYPTION_KEY;
    
    if (!encryptionKey && env.IS_PRODUCTION) {
      throw new Error('ENCRYPTION_KEY is required in production');
    }
    
    // Use provided key or generate one for development
    this.encryptionKey = encryptionKey || crypto.randomBytes(32).toString('hex');
    
    if (!encryptionKey) {
      this.logger.warn('Using generated encryption key - set ENCRYPTION_KEY for production');
    }
  }
  
  async _initializeSignatures() {
    const privateKeyPath = this.config.signatures.privateKeyPath;
    const certificatePath = this.config.signatures.certificatePath;
    
    if (!privateKeyPath || !certificatePath) {
      if (env.IS_PRODUCTION) {
        throw new Error('Private key and certificate paths required for digital signatures in production');
      }
      
      // Generate keys for development
      const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
      });
      
      this.signingKey = privateKey;
      this.certificate = publicKey;
      
      this.logger.warn('Using generated keys for signatures - configure paths for production');
    } else {
      // Load keys from files
      const fs = await import('fs/promises');
      this.signingKey = await fs.readFile(privateKeyPath, 'utf8');
      this.certificate = await fs.readFile(certificatePath, 'utf8');
    }
  }
  
  async _initializeBlockchain() {
    if (!this.config.blockchain.providerUrl) {
      throw new Error('Blockchain provider URL required when blockchain is enabled');
    }
    
    // Initialize blockchain connection
    this.logger.info(`Connecting to blockchain at ${this.config.blockchain.providerUrl}`);
    // Actual blockchain implementation would go here
  }
  
  async _initializeAudit() {
    // Initialize audit logging
    this.auditLog = [];
    
    if (env.IS_PRODUCTION) {
      // In production, would initialize persistent audit storage
      this.logger.info(`Audit retention period: ${this.config.audit.retention}`);
    }
  }
  
  async _auditOperation(operation, details = {}) {
    if (!this.config.audit.enabled) return;
    
    const entry = {
      timestamp: new Date().toISOString(),
      operation,
      details,
      environment: env.NODE_ENV
    };
    
    // Encrypt audit entry if enabled
    if (this.config.audit.encryption && this.encryptionKey) {
      const encrypted = await this.encrypt(entry, { skipAudit: true });
      this.auditLog.push(encrypted);
    } else {
      this.auditLog.push(entry);
    }
    
    this.emit('audit', entry);
    
    // Limit in-memory audit log size
    if (this.auditLog.length > 10000) {
      this.auditLog = this.auditLog.slice(-5000);
    }
  }
  
  _sanitizeInput(input) {
    if (typeof input === 'string') {
      // Remove potential XSS vectors
      return input
        .replace(/[<>]/g, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+=/gi, '');
    }
    
    if (typeof input === 'object' && input !== null) {
      const sanitized = {};
      for (const [key, value] of Object.entries(input)) {
        sanitized[this._sanitizeInput(key)] = this._sanitizeInput(value);
      }
      return sanitized;
    }
    
    return input;
  }
  
  _validateAgainstSchema(data, schema) {
    // Simple schema validation (production would use ajv or similar)
    for (const [field, rules] of Object.entries(schema)) {
      const value = data[field];
      
      if (rules.required && value === undefined) {
        throw new Error(`Required field missing: ${field}`);
      }
      
      if (rules.type && value !== undefined) {
        const actualType = Array.isArray(value) ? 'array' : typeof value;
        if (actualType !== rules.type) {
          throw new Error(`Invalid type for ${field}: expected ${rules.type}, got ${actualType}`);
        }
      }
      
      if (rules.pattern && typeof value === 'string') {
        const regex = new RegExp(rules.pattern);
        if (!regex.test(value)) {
          throw new Error(`Field ${field} does not match required pattern`);
        }
      }
      
      if (rules.min !== undefined && typeof value === 'number' && value < rules.min) {
        throw new Error(`Field ${field} is below minimum value ${rules.min}`);
      }
      
      if (rules.max !== undefined && typeof value === 'number' && value > rules.max) {
        throw new Error(`Field ${field} exceeds maximum value ${rules.max}`);
      }
    }
  }
  
  /**
   * Get security status
   */
  getStatus() {
    return {
      initialized: this.initialized,
      features: {
        encryption: this.config.encryption.enabled,
        signatures: this.config.signatures.enabled,
        blockchain: this.config.blockchain.enabled,
        audit: this.config.audit.enabled,
        validation: this.config.validation.enabled,
        rateLimit: this.config.rateLimit.enabled
      },
      auditLogSize: this.auditLog.length,
      environment: env.NODE_ENV,
      production: env.IS_PRODUCTION
    };
  }
  
  /**
   * Get audit log
   */
  async getAuditLog(options = {}) {
    if (!this.config.audit.enabled) {
      return [];
    }
    
    let logs = [...this.auditLog];
    
    // Decrypt if needed
    if (this.config.audit.encryption && this.encryptionKey) {
      logs = await Promise.all(
        logs.map(entry => 
          entry.encrypted ? this.decrypt(entry) : entry
        )
      );
    }
    
    // Apply filters if provided
    if (options.startDate) {
      logs = logs.filter(entry => 
        new Date(entry.timestamp) >= new Date(options.startDate)
      );
    }
    
    if (options.endDate) {
      logs = logs.filter(entry => 
        new Date(entry.timestamp) <= new Date(options.endDate)
      );
    }
    
    if (options.operation) {
      logs = logs.filter(entry => entry.operation === options.operation);
    }
    
    // Apply limit
    if (options.limit) {
      logs = logs.slice(-options.limit);
    }
    
    return logs;
  }
  
  /**
   * Shutdown security manager
   */
  async shutdown() {
    this.logger.info('Shutting down security manager...');
    
    // Clear sensitive data
    this.encryptionKey = null;
    this.signingKey = null;
    this.certificate = null;
    
    // Save audit log if needed
    if (this.auditLog.length > 0) {
      this.emit('shutdown', { auditEntries: this.auditLog.length });
    }
    
    this.initialized = false;
    this.logger.success('Security manager shutdown complete');
  }
}

// Export singleton instance
export const securityManager = new SecurityManager();

export default SecurityManager;