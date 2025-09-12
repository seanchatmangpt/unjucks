/**
 * Cryptographic Security Service
 * 
 * Enterprise-grade cryptographic service providing encryption, decryption,
 * key management, and data classification for sensitive information.
 */

import { EventEmitter } from 'events';
import crypto from 'crypto';
import consola from 'consola';

export class CryptoService extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      // Encryption Configuration
      defaultAlgorithm: 'aes-256-gcm',
      keyDerivationFunction: 'pbkdf2',
      keyDerivationIterations: 100000,
      saltLength: 32,
      ivLength: 16,
      tagLength: 16,
      
      // Key Management
      enableKeyRotation: true,
      keyRotationInterval: 30 * 24 * 60 * 60 * 1000, // 30 days
      maxKeyAge: 90 * 24 * 60 * 60 * 1000, // 90 days
      keyBackupEnabled: true,
      
      // Data Classification
      enableDataClassification: true,
      autoClassification: true,
      classificationLevels: ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED'],
      
      // Security Features
      enableIntegrityChecks: true,
      enableSecureErase: true,
      enableAuditLogging: true,
      
      // Performance
      enableCaching: false, // Disabled for security
      maxConcurrentOperations: 10,
      
      ...config
    };
    
    this.logger = consola.withTag('crypto-service');
    this.status = 'uninitialized';
    
    // Key management
    this.masterKeys = new Map();
    this.dataKeys = new Map();
    this.keyMetadata = new Map();
    this.keyRotationSchedule = new Map();
    
    // Data classification
    this.classificationRules = new Map();
    this.sensitiveDataPatterns = new Map();
    
    // Operation tracking
    this.activeOperations = new Set();
    
    // Metrics
    this.metrics = {
      encryptionOperations: 0,
      decryptionOperations: 0,
      keyGenerations: 0,
      keyRotations: 0,
      classificationOperations: 0,
      integrityViolations: 0,
      secureEraseOperations: 0
    };
  }

  /**
   * Initialize crypto service
   */
  async initialize() {
    try {
      this.logger.info('Initializing crypto service...');
      this.status = 'initializing';
      
      // Generate master keys
      await this._generateMasterKeys();
      
      // Load data classification rules
      await this._loadClassificationRules();
      
      // Setup key rotation
      if (this.config.enableKeyRotation) {
        this._setupKeyRotation();
      }
      
      this.status = 'ready';
      this.logger.success('Crypto service initialized successfully');
      
      this.emit('crypto:initialized', {
        masterKeys: this.masterKeys.size,
        classificationRules: this.classificationRules.size,
        timestamp: this.getDeterministicDate()
      });
      
      return {
        status: 'success',
        masterKeys: this.masterKeys.size,
        supportedAlgorithms: this._getSupportedAlgorithms()
      };
      
    } catch (error) {
      this.status = 'error';
      this.logger.error('Crypto service initialization failed:', error);
      throw error;
    }
  }

  /**
   * Encrypt sensitive data
   */
  async encryptSensitiveData(data, options = {}) {
    try {
      this.metrics.encryptionOperations++;
      
      const operationId = this._generateOperationId();
      this.activeOperations.add(operationId);
      
      this.logger.debug(`Encrypting data (operation: ${operationId})`);
      
      try {
        // Validate input
        if (!data) {
          throw new Error('Data to encrypt cannot be empty');
        }
        
        // Classify data if auto-classification is enabled
        let classification = options.classification;
        if (this.config.autoClassification && !classification) {
          const classificationResult = await this.classifyData(data);
          classification = classificationResult.level;
        }
        
        // Get or generate data encryption key
        const keyId = options.keyId || await this._generateDataKey(classification);
        const encryptionKey = await this._getDataKey(keyId);
        
        // Generate unique IV
        const iv = crypto.randomBytes(this.config.ivLength);
        
        // Create cipher with proper IV
        const algorithm = options.algorithm || this.config.defaultAlgorithm;
        const cipher = crypto.createCipherGCM(algorithm, encryptionKey, iv);
        cipher.setAAD(Buffer.from(JSON.stringify({
          keyId,
          classification,
          timestamp: this.getDeterministicDate().toISOString()
        })));
        
        // Encrypt data
        const dataBuffer = Buffer.from(typeof data === 'string' ? data : JSON.stringify(data));
        let encrypted = cipher.update(dataBuffer);
        encrypted = Buffer.concat([encrypted, cipher.final()]);
        
        // Get authentication tag
        const authTag = cipher.getAuthTag();
        
        // Create encrypted data object
        const encryptedData = {
          data: encrypted.toString('base64'),
          iv: iv.toString('base64'),
          authTag: authTag.toString('base64'),
          algorithm,
          keyId,
          classification,
          timestamp: this.getDeterministicDate().toISOString(),
          integrity: null // Will be calculated
        };
        
        // Calculate integrity hash
        if (this.config.enableIntegrityChecks) {
          encryptedData.integrity = this._calculateIntegrityHash(encryptedData);
        }
        
        this.emit('crypto:data_encrypted', {
          operationId,
          keyId,
          classification,
          algorithm,
          dataSize: dataBuffer.length
        });
        
        return {
          encrypted: encryptedData,
          metadata: {
            operationId,
            encryptedAt: this.getDeterministicDate(),
            dataSize: dataBuffer.length,
            classification
          }
        };
        
      } finally {
        this.activeOperations.delete(operationId);
      }
      
    } catch (error) {
      this.logger.error('Data encryption failed:', error);
      throw error;
    }
  }

  /**
   * Decrypt sensitive data
   */
  async decryptSensitiveData(encryptedData, options = {}) {
    try {
      this.metrics.decryptionOperations++;
      
      const operationId = this._generateOperationId();
      this.activeOperations.add(operationId);
      
      this.logger.debug(`Decrypting data (operation: ${operationId})`);
      
      try {
        // Validate encrypted data structure
        this._validateEncryptedDataStructure(encryptedData);
        
        // Check integrity
        if (this.config.enableIntegrityChecks && encryptedData.integrity) {
          const expectedIntegrity = this._calculateIntegrityHash({
            ...encryptedData,
            integrity: null
          });
          
          if (encryptedData.integrity !== expectedIntegrity) {
            this.metrics.integrityViolations++;
            throw new Error('Data integrity check failed');
          }
        }
        
        // Get decryption key
        const decryptionKey = await this._getDataKey(encryptedData.keyId);
        
        // Create decipher with proper IV
        const iv = Buffer.from(encryptedData.iv, 'base64');
        const decipher = crypto.createDecipherGCM(encryptedData.algorithm, decryptionKey, iv);
        decipher.setAAD(Buffer.from(JSON.stringify({
          keyId: encryptedData.keyId,
          classification: encryptedData.classification,
          timestamp: encryptedData.timestamp
        })));
        decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'base64'));
        
        // Decrypt data
        let decrypted = decipher.update(Buffer.from(encryptedData.data, 'base64'));
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        
        // Convert back to original format
        const decryptedData = decrypted.toString('utf8');
        
        let result;
        try {
          result = JSON.parse(decryptedData);
        } catch {
          result = decryptedData;
        }
        
        this.emit('crypto:data_decrypted', {
          operationId,
          keyId: encryptedData.keyId,
          classification: encryptedData.classification,
          dataSize: decrypted.length
        });
        
        return {
          data: result,
          metadata: {
            operationId,
            decryptedAt: this.getDeterministicDate(),
            originalClassification: encryptedData.classification,
            originalTimestamp: encryptedData.timestamp
          }
        };
        
      } finally {
        this.activeOperations.delete(operationId);
      }
      
    } catch (error) {
      this.logger.error('Data decryption failed:', error);
      throw error;
    }
  }

  /**
   * Classify data sensitivity
   */
  async classifyData(data) {
    try {
      this.metrics.classificationOperations++;
      
      this.logger.debug('Classifying data sensitivity');
      
      const classification = {
        level: this.config.classificationLevels[0], // Default to PUBLIC
        categories: [],
        confidence: 0,
        reasons: [],
        sensitiveFields: []
      };
      
      const dataString = typeof data === 'string' ? data : JSON.stringify(data);
      
      // Apply classification rules
      for (const [ruleId, rule] of this.classificationRules.entries()) {
        const ruleResult = await this._applyClassificationRule(rule, data, dataString);
        
        if (ruleResult.match) {
          // Update classification level if higher
          const currentLevel = this.config.classificationLevels.indexOf(classification.level);
          const ruleLevel = this.config.classificationLevels.indexOf(ruleResult.level);
          
          if (ruleLevel > currentLevel) {
            classification.level = ruleResult.level;
          }
          
          classification.categories.push(ruleResult.category);
          classification.reasons.push(ruleResult.reason);
          classification.confidence = Math.max(classification.confidence, ruleResult.confidence);
          
          if (ruleResult.sensitiveFields) {
            classification.sensitiveFields.push(...ruleResult.sensitiveFields);
          }
        }
      }
      
      // Remove duplicates
      classification.categories = [...new Set(classification.categories)];
      classification.sensitiveFields = [...new Set(classification.sensitiveFields)];
      
      this.emit('crypto:data_classified', {
        level: classification.level,
        categories: classification.categories.length,
        confidence: classification.confidence
      });
      
      return classification;
      
    } catch (error) {
      this.logger.error('Data classification failed:', error);
      throw error;
    }
  }

  /**
   * Scan for sensitive data patterns
   */
  async scanForSensitiveData(data) {
    try {
      this.logger.debug('Scanning for sensitive data patterns');
      
      const scanResult = {
        containsSensitiveData: false,
        sensitiveFields: [],
        patterns: [],
        confidence: 0
      };
      
      const dataString = typeof data === 'string' ? data : JSON.stringify(data);
      
      // Scan for sensitive patterns
      for (const [patternId, pattern] of this.sensitiveDataPatterns.entries()) {
        const matches = dataString.match(pattern.regex);
        
        if (matches && matches.length > 0) {
          scanResult.containsSensitiveData = true;
          scanResult.patterns.push({
            id: patternId,
            name: pattern.name,
            matches: matches.length,
            confidence: pattern.confidence
          });
          
          scanResult.confidence = Math.max(scanResult.confidence, pattern.confidence);
          
          if (pattern.fieldNames) {
            scanResult.sensitiveFields.push(...pattern.fieldNames);
          }
        }
      }
      
      // Scan object fields if data is an object
      if (typeof data === 'object' && data !== null) {
        const objectScan = this._scanObjectForSensitiveFields(data);
        if (objectScan.containsSensitiveData) {
          scanResult.containsSensitiveData = true;
          scanResult.sensitiveFields.push(...objectScan.sensitiveFields);
        }
      }
      
      // Remove duplicates
      scanResult.sensitiveFields = [...new Set(scanResult.sensitiveFields)];
      
      return scanResult;
      
    } catch (error) {
      this.logger.error('Sensitive data scan failed:', error);
      throw error;
    }
  }

  /**
   * Encrypt sensitive fields in object
   */
  async encryptSensitiveFields(data, sensitiveFields, options = {}) {
    try {
      this.logger.debug(`Encrypting ${sensitiveFields.length} sensitive fields`);
      
      const result = { ...data };
      const encryptionResults = [];
      
      for (const field of sensitiveFields) {
        if (result[field] !== undefined) {
          const fieldValue = result[field];
          
          const encryptedField = await this.encryptSensitiveData(fieldValue, {
            ...options,
            classification: 'CONFIDENTIAL'
          });
          
          result[field] = encryptedField.encrypted;
          encryptionResults.push({
            field,
            encrypted: true,
            keyId: encryptedField.encrypted.keyId
          });
        }
      }
      
      return {
        data: result,
        encryptionResults,
        metadata: {
        fieldsEncrypted: encryptionResults.length,
          timestamp: this.getDeterministicDate()
        }
      };
      
    } catch (error) {
      this.logger.error('Sensitive field encryption failed:', error);
      throw error;
    }
  }

  /**
   * Generate new encryption key
   */
  async generateKey(keyType = 'data', options = {}) {
    try {
      this.metrics.keyGenerations++;
      
      this.logger.debug(`Generating ${keyType} key`);
      
      const keyId = this._generateKeyId();
      const keyMaterial = crypto.randomBytes(32); // 256-bit key
      
      const keyMetadata = {
        id: keyId,
        type: keyType,
        algorithm: options.algorithm || this.config.defaultAlgorithm,
        createdAt: this.getDeterministicDate(),
        expiresAt: options.expiresAt || new Date(this.getDeterministicTimestamp() + this.config.maxKeyAge),
        classification: options.classification || 'INTERNAL',
        usage: options.usage || 'encryption',
        rotationScheduled: false
      };
      
      // Store key and metadata
      this.dataKeys.set(keyId, keyMaterial);
      this.keyMetadata.set(keyId, keyMetadata);
      
      // Schedule rotation if enabled
      if (this.config.enableKeyRotation) {
        this._scheduleKeyRotation(keyId);
      }
      
      this.emit('crypto:key_generated', {
        keyId,
        keyType,
        algorithm: keyMetadata.algorithm,
        classification: keyMetadata.classification
      });
      
      return {
        keyId,
        metadata: keyMetadata
      };
      
    } catch (error) {
      this.logger.error('Key generation failed:', error);
      throw error;
    }
  }

  /**
   * Rotate encryption key
   */
  async rotateKey(keyId, options = {}) {
    try {
      this.metrics.keyRotations++;
      
      this.logger.info(`Rotating key: ${keyId}`);
      
      const oldMetadata = this.keyMetadata.get(keyId);
      if (!oldMetadata) {
        throw new Error(`Key not found: ${keyId}`);
      }
      
      // Generate new key
      const newKeyResult = await this.generateKey(oldMetadata.type, {
        algorithm: oldMetadata.algorithm,
        classification: oldMetadata.classification,
        usage: oldMetadata.usage
      });
      
      // Mark old key for deprecation
      oldMetadata.deprecated = true;
      oldMetadata.deprecatedAt = this.getDeterministicDate();
      oldMetadata.replacedBy = newKeyResult.keyId;
      
      // Schedule secure deletion of old key
      setTimeout(() => {
        this._secureDeleteKey(keyId);
      }, options.gracePeriod || 24 * 60 * 60 * 1000); // 24 hours
      
      this.emit('crypto:key_rotated', {
        oldKeyId: keyId,
        newKeyId: newKeyResult.keyId,
        rotatedAt: this.getDeterministicDate()
      });
      
      return newKeyResult;
      
    } catch (error) {
      this.logger.error(`Key rotation failed for ${keyId}:`, error);
      throw error;
    }
  }

  /**
   * Get crypto service status
   */
  getStatus() {
    return {
      status: this.status,
      metrics: { ...this.metrics },
      configuration: {
        defaultAlgorithm: this.config.defaultAlgorithm,
        enableKeyRotation: this.config.enableKeyRotation,
        enableDataClassification: this.config.enableDataClassification,
        classificationLevels: this.config.classificationLevels
      },
      keys: {
        masterKeys: this.masterKeys.size,
        dataKeys: this.dataKeys.size,
        activeOperations: this.activeOperations.size
      },
      classification: {
        rules: this.classificationRules.size,
        patterns: this.sensitiveDataPatterns.size
      }
    };
  }

  /**
   * Shutdown crypto service
   */
  async shutdown() {
    try {
      this.logger.info('Shutting down crypto service...');
      
      // Wait for active operations to complete
      while (this.activeOperations.size > 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Clear key rotation intervals
      for (const intervalId of this.keyRotationSchedule.values()) {
        clearInterval(intervalId);
      }
      
      // Secure erase all keys if enabled
      if (this.config.enableSecureErase) {
        await this._secureEraseAllKeys();
      }
      
      this.removeAllListeners();
      this.status = 'shutdown';
      
      this.logger.success('Crypto service shutdown completed');
      
    } catch (error) {
      this.logger.error('Crypto service shutdown failed:', error);
      throw error;
    }
  }

  // Private methods

  async _generateMasterKeys() {
    // Generate master key for key encryption
    const masterKeyId = 'master_key';
    const masterKey = crypto.randomBytes(32);
    
    this.masterKeys.set(masterKeyId, masterKey);
    this.keyMetadata.set(masterKeyId, {
      id: masterKeyId,
      type: 'master',
      createdAt: this.getDeterministicDate(),
      usage: 'key_encryption'
    });
    
    this.logger.info('Master keys generated');
  }

  async _loadClassificationRules() {
    const rules = [
      {
        id: 'pii_detection',
        name: 'Personally Identifiable Information',
        patterns: [
          /\b\d{3}-\d{2}-\d{4}\b/, // SSN
          /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Email
          /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/ // Credit card
        ],
        level: 'CONFIDENTIAL',
        category: 'PII',
        confidence: 0.9
      },
      {
        id: 'financial_data',
        name: 'Financial Information',
        patterns: [
          /\b(account|routing|iban|swift)\s*[:=]\s*\d+/i,
          /\b(balance|amount|transaction)\s*[:=]\s*\$?\d+/i
        ],
        level: 'RESTRICTED',
        category: 'FINANCIAL',
        confidence: 0.8
      },
      {
        id: 'health_data',
        name: 'Health Information',
        patterns: [
          /\b(diagnosis|treatment|medication|patient)\b/i,
          /\b(medical|health|hospital|doctor)\s+\w+/i
        ],
        level: 'RESTRICTED',
        category: 'HEALTH',
        confidence: 0.8
      },
      {
        id: 'authentication_data',
        name: 'Authentication Information',
        patterns: [
          /\b(password|secret|key|token)\s*[:=]\s*[^\s]+/i,
          /\b(api[_-]?key|access[_-]?token)\s*[:=]\s*[^\s]+/i
        ],
        level: 'RESTRICTED',
        category: 'AUTH',
        confidence: 0.95
      }
    ];
    
    for (const rule of rules) {
      this.classificationRules.set(rule.id, rule);
    }
    
    // Load sensitive data patterns
    const patterns = [
      {
        id: 'ssn_pattern',
        name: 'Social Security Number',
        regex: /\b\d{3}-\d{2}-\d{4}\b/g,
        confidence: 0.95,
        fieldNames: ['ssn', 'socialSecurityNumber']
      },
      {
        id: 'email_pattern',
        name: 'Email Address',
        regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
        confidence: 0.9,
        fieldNames: ['email', 'emailAddress']
      },
      {
        id: 'credit_card_pattern',
        name: 'Credit Card Number',
        regex: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
        confidence: 0.9,
        fieldNames: ['creditCard', 'cardNumber']
      },
      {
        id: 'phone_pattern',
        name: 'Phone Number',
        regex: /\b\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})\b/g,
        confidence: 0.8,
        fieldNames: ['phone', 'phoneNumber', 'telephone']
      }
    ];
    
    for (const pattern of patterns) {
      this.sensitiveDataPatterns.set(pattern.id, pattern);
    }
  }

  _setupKeyRotation() {
    // Setup automatic key rotation checking
    const rotationCheckInterval = setInterval(() => {
      this._checkForKeyRotation();
    }, 60 * 60 * 1000); // Check every hour
    
    this.keyRotationSchedule.set('rotation_check', rotationCheckInterval);
  }

  async _checkForKeyRotation() {
    const now = this.getDeterministicTimestamp();
    
    for (const [keyId, metadata] of this.keyMetadata.entries()) {
      if (metadata.type === 'data' && !metadata.deprecated) {
        const keyAge = now - metadata.createdAt.getTime();
        
        if (keyAge > this.config.keyRotationInterval) {
          try {
            await this.rotateKey(keyId);
          } catch (error) {
            this.logger.error(`Automatic key rotation failed for ${keyId}:`, error);
          }
        }
      }
    }
  }

  _scheduleKeyRotation(keyId) {
    const rotationTime = this.config.keyRotationInterval;
    
    setTimeout(async () => {
      try {
        await this.rotateKey(keyId);
      } catch (error) {
        this.logger.error(`Scheduled key rotation failed for ${keyId}:`, error);
      }
    }, rotationTime);
  }

  async _generateDataKey(classification) {
    const keyResult = await this.generateKey('data', {
      classification,
      usage: 'data_encryption'
    });
    
    return keyResult.keyId;
  }

  async _getDataKey(keyId) {
    const key = this.dataKeys.get(keyId);
    if (!key) {
      throw new Error(`Data key not found: ${keyId}`);
    }
    
    const metadata = this.keyMetadata.get(keyId);
    if (metadata?.deprecated) {
      this.logger.warn(`Using deprecated key: ${keyId}`);
    }
    
    return key;
  }

  async _applyClassificationRule(rule, data, dataString) {
    const result = {
      match: false,
      level: rule.level,
      category: rule.category,
      confidence: 0,
      reason: '',
      sensitiveFields: []
    };
    
    // Check patterns
    for (const pattern of rule.patterns) {
      if (pattern.test(dataString)) {
        result.match = true;
        result.confidence = rule.confidence;
        result.reason = `Matched pattern: ${rule.name}`;
        break;
      }
    }
    
    // Check object fields if data is an object
    if (typeof data === 'object' && data !== null) {
      const fieldCheck = this._checkObjectFieldsForRule(data, rule);
      if (fieldCheck.match) {
        result.match = true;
        result.confidence = Math.max(result.confidence, fieldCheck.confidence);
        result.sensitiveFields.push(...fieldCheck.sensitiveFields);
      }
    }
    
    return result;
  }

  _checkObjectFieldsForRule(data, rule) {
    const result = {
      match: false,
      confidence: 0,
      sensitiveFields: []
    };
    
    const sensitiveFieldNames = [
      'password', 'secret', 'key', 'token', 'ssn', 'socialSecurityNumber',
      'creditCard', 'cardNumber', 'email', 'phone', 'address'
    ];
    
    for (const [key, value] of Object.entries(data)) {
      if (sensitiveFieldNames.some(fieldName => 
          key.toLowerCase().includes(fieldName.toLowerCase()))) {
        result.match = true;
        result.confidence = 0.8;
        result.sensitiveFields.push(key);
      }
    }
    
    return result;
  }

  _scanObjectForSensitiveFields(data) {
    const result = {
      containsSensitiveData: false,
      sensitiveFields: []
    };
    
    const sensitiveFieldNames = [
      'password', 'pwd', 'pass', 'secret', 'key', 'token', 'auth',
      'ssn', 'socialSecurityNumber', 'social', 'creditCard', 'cardNumber',
      'email', 'mail', 'phone', 'telephone', 'address', 'location'
    ];
    
    for (const key of Object.keys(data)) {
      const lowerKey = key.toLowerCase();
      
      if (sensitiveFieldNames.some(fieldName => lowerKey.includes(fieldName))) {
        result.containsSensitiveData = true;
        result.sensitiveFields.push(key);
      }
    }
    
    return result;
  }

  _validateEncryptedDataStructure(encryptedData) {
    const requiredFields = ['data', 'iv', 'authTag', 'algorithm', 'keyId'];
    
    for (const field of requiredFields) {
      if (!encryptedData[field]) {
        throw new Error(`Missing required field in encrypted data: ${field}`);
      }
    }
  }

  _calculateIntegrityHash(data) {
    const dataString = JSON.stringify({
      data: data.data,
      iv: data.iv,
      authTag: data.authTag,
      algorithm: data.algorithm,
      keyId: data.keyId,
      classification: data.classification,
      timestamp: data.timestamp
    });
    
    return crypto.createHash('sha256').update(dataString).digest('hex');
  }

  async _secureDeleteKey(keyId) {
    this.metrics.secureEraseOperations++;
    
    // Get key buffer
    const keyBuffer = this.dataKeys.get(keyId);
    if (keyBuffer) {
      // Overwrite with random data multiple times
      for (let i = 0; i < 3; i++) {
        crypto.randomFillSync(keyBuffer);
      }
      
      // Remove from maps
      this.dataKeys.delete(keyId);
      this.keyMetadata.delete(keyId);
      
      this.logger.info(`Key securely deleted: ${keyId}`);
    }
  }

  async _secureEraseAllKeys() {
    for (const keyId of this.dataKeys.keys()) {
      await this._secureDeleteKey(keyId);
    }
    
    // Clear master keys
    for (const [keyId, keyBuffer] of this.masterKeys.entries()) {
      for (let i = 0; i < 3; i++) {
        crypto.randomFillSync(keyBuffer);
      }
    }
    
    this.masterKeys.clear();
    this.logger.info('All keys securely erased');
  }

  _generateOperationId() {
    return `crypto_${this.getDeterministicTimestamp()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  _generateKeyId() {
    return `key_${this.getDeterministicTimestamp()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  _getSupportedAlgorithms() {
    return [
      'aes-256-gcm',
      'aes-256-cbc',
      'aes-192-gcm',
      'aes-192-cbc',
      'chacha20-poly1305'
    ];
  }
}

export default CryptoService;