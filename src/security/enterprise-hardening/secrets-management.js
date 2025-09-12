/**
 * Enterprise Secrets Management System
 * Secure storage, rotation, and access control for secrets and credentials
 */

import { EventEmitter } from 'events';
import consola from 'consola';
import { createCipher, createDecipher, randomBytes, createHash, scryptSync } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';

class EnterpriseSecretsManager extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      // Encryption Configuration
      encryptionAlgorithm: 'aes-256-gcm',
      keyDerivation: 'scrypt',
      keyLength: 32,
      ivLength: 16,
      saltLength: 32,
      iterations: 100000,
      
      // Storage Configuration
      storageType: 'file', // 'file', 'memory', 'vault', 'hsm'
      storageDir: 'config/security/secrets',
      encryptAtRest: true,
      compressionEnabled: false,
      
      // Access Control
      requireAuthentication: true,
      accessLogging: true,
      roleBasedAccess: true,
      auditAllAccess: true,
      
      // Secret Lifecycle
      enableRotation: true,
      defaultRotationInterval: 2592000000, // 30 days
      rotationGracePeriod: 86400000, // 1 day
      enableVersioning: true,
      maxVersions: 5,
      
      // Monitoring and Alerts
      enableMonitoring: true,
      alertOnAccess: false,
      alertOnRotation: true,
      alertOnFailure: true,
      
      // Security Features
      enableDeadManSwitch: false,
      emergencyAccess: false,
      keyEscrow: false,
      tamperDetection: true,
      
      // Compliance
      enableCompliance: true,
      retainAuditLogs: true,
      auditRetentionDays: 90,
      
      ...config
    };
    
    this.logger = consola.withTag('secrets-mgr');
    this.state = 'initialized';
    
    // Secrets Storage
    this.secrets = new Map();
    this.secretMetadata = new Map();
    this.secretVersions = new Map();
    
    // Encryption Keys
    this.masterKey = null;
    this.encryptionKeys = new Map();
    this.keyVersions = new Map();
    
    // Access Control
    this.accessPolicies = new Map();
    this.accessLog = [];
    this.rotationSchedule = new Map();
    
    // Monitoring
    this.metrics = {
      secretsStored: 0,
      secretsAccessed: 0,
      secretsRotated: 0,
      accessFailures: 0,
      encryptionOperations: 0,
      decryptionOperations: 0
    };
    
    // Security State
    this.integrityHashes = new Map();
    this.tamperDetectionEnabled = this.config.tamperDetection;
  }
  
  /**
   * Initialize secrets manager
   */
  async initialize() {
    try {
      this.logger.info('🔐 Initializing Enterprise Secrets Manager...');
      
      // Initialize master key
      await this._initializeMasterKey();
      
      // Setup storage
      await this._initializeStorage();
      
      // Load existing secrets
      await this._loadSecrets();
      
      // Initialize access policies
      await this._initializeAccessPolicies();
      
      // Start rotation scheduler
      if (this.config.enableRotation) {
        this._startRotationScheduler();
      }
      
      // Start monitoring
      if (this.config.enableMonitoring) {
        this._startMonitoring();
      }
      
      this.state = 'ready';
      this.logger.success('✅ Enterprise Secrets Manager initialized');
      
      return {
        status: 'ready',
        secrets: this.secrets.size,
        policies: this.accessPolicies.size
      };
      
    } catch (error) {
      this.state = 'error';
      this.logger.error('❌ Failed to initialize Secrets Manager:', error);
      throw error;
    }
  }
  
  /**
   * Store a secret
   */
  async storeSecret(secretId, secretValue, options = {}) {
    try {
      const {
        description,
        tags = [],
        rotationInterval = this.config.defaultRotationInterval,
        accessPolicy,
        metadata = {},
        userId
      } = options;
      
      // Validate access
      if (this.config.requireAuthentication) {
        await this._validateAccess(userId, 'write', secretId);
      }
      
      this.logger.info(`Storing secret: ${secretId}`);
      
      // Encrypt secret value
      const encryptedValue = await this._encryptSecret(secretValue);
      
      // Create secret record
      const secret = {
        id: secretId,
        value: encryptedValue.data,
        iv: encryptedValue.iv,
        authTag: encryptedValue.authTag,
        keyVersion: encryptedValue.keyVersion,
        createdAt: new Date(),
        lastModified: new Date(),
        lastAccessed: null,
        accessCount: 0,
        version: 1
      };
      
      // Create metadata
      const secretMeta = {
        id: secretId,
        description,
        tags: new Set(tags),
        rotationInterval,
        nextRotation: new Date(Date.now() + rotationInterval),
        accessPolicy: accessPolicy || 'default',
        metadata,
        createdBy: userId,
        createdAt: new Date(),
        lastModified: new Date(),
        isActive: true
      };
      
      // Store secret and metadata
      this.secrets.set(secretId, secret);
      this.secretMetadata.set(secretId, secretMeta);
      
      // Initialize version history
      if (this.config.enableVersioning) {
        this.secretVersions.set(secretId, [{ ...secret, version: 1 }]);
      }
      
      // Schedule rotation
      if (this.config.enableRotation && rotationInterval > 0) {
        this.rotationSchedule.set(secretId, secretMeta.nextRotation);
      }
      
      // Create integrity hash
      if (this.config.tamperDetection) {
        const integrityHash = await this._createIntegrityHash(secret);
        this.integrityHashes.set(secretId, integrityHash);
      }
      
      // Save to persistent storage
      await this._saveSecret(secretId, secret, secretMeta);
      
      // Update metrics
      this.metrics.secretsStored++;
      this.metrics.encryptionOperations++;
      
      // Log access
      await this._logAccess({
        action: 'store',
        secretId,
        userId,
        timestamp: new Date(),
        success: true
      });
      
      this.emit('secret:stored', { secretId, userId });
      
      return {
        secretId,
        version: secret.version,
        nextRotation: secretMeta.nextRotation
      };
      
    } catch (error) {
      this.logger.error(`Failed to store secret '${secretId}':`, error);
      
      // Log failed access
      await this._logAccess({
        action: 'store',
        secretId,
        userId: options.userId,
        timestamp: new Date(),
        success: false,
        error: error.message
      });
      
      throw error;
    }
  }
  
  /**
   * Retrieve a secret
   */
  async getSecret(secretId, options = {}) {
    try {
      const { userId, version } = options;
      
      // Validate access
      if (this.config.requireAuthentication) {
        await this._validateAccess(userId, 'read', secretId);
      }
      
      const secret = this.secrets.get(secretId);
      if (!secret) {
        throw new Error(`Secret '${secretId}' not found`);
      }
      
      const secretMeta = this.secretMetadata.get(secretId);
      if (!secretMeta || !secretMeta.isActive) {
        throw new Error(`Secret '${secretId}' is not active`);
      }
      
      // Check tamper detection
      if (this.config.tamperDetection) {
        const isIntact = await this._verifyIntegrity(secretId, secret);
        if (!isIntact) {
          throw new Error(`Secret '${secretId}' integrity check failed`);
        }
      }
      
      // Get specific version if requested
      let targetSecret = secret;
      if (version && this.config.enableVersioning) {
        const versions = this.secretVersions.get(secretId) || [];
        const versionedSecret = versions.find(v => v.version === version);
        if (versionedSecret) {
          targetSecret = versionedSecret;
        }
      }
      
      // Decrypt secret value
      const decryptedValue = await this._decryptSecret({
        data: targetSecret.value,
        iv: targetSecret.iv,
        authTag: targetSecret.authTag,
        keyVersion: targetSecret.keyVersion
      });
      
      // Update access tracking
      secret.lastAccessed = new Date();
      secret.accessCount++;
      secretMeta.lastModified = new Date();
      
      // Update metrics
      this.metrics.secretsAccessed++;
      this.metrics.decryptionOperations++;
      
      // Log access
      await this._logAccess({
        action: 'retrieve',
        secretId,
        userId,
        version: targetSecret.version,
        timestamp: new Date(),
        success: true
      });
      
      this.emit('secret:accessed', { secretId, userId, version: targetSecret.version });
      
      return {
        secretId,
        value: decryptedValue,
        version: targetSecret.version,
        metadata: {
          description: secretMeta.description,
          tags: Array.from(secretMeta.tags),
          createdAt: secretMeta.createdAt,
          lastModified: secret.lastModified,
          accessCount: secret.accessCount,
          nextRotation: secretMeta.nextRotation
        }
      };
      
    } catch (error) {
      this.logger.error(`Failed to retrieve secret '${secretId}':`, error);
      
      this.metrics.accessFailures++;
      
      // Log failed access
      await this._logAccess({
        action: 'retrieve',
        secretId,
        userId: options.userId,
        timestamp: new Date(),
        success: false,
        error: error.message
      });
      
      throw error;
    }
  }
  
  /**
   * Update a secret (with versioning)
   */
  async updateSecret(secretId, newValue, options = {}) {
    try {
      const { userId, description, metadata } = options;
      
      // Validate access
      if (this.config.requireAuthentication) {
        await this._validateAccess(userId, 'write', secretId);
      }
      
      const existingSecret = this.secrets.get(secretId);
      const existingMeta = this.secretMetadata.get(secretId);
      
      if (!existingSecret || !existingMeta) {
        throw new Error(`Secret '${secretId}' not found`);
      }
      
      this.logger.info(`Updating secret: ${secretId}`);
      
      // Create new version
      const encryptedValue = await this._encryptSecret(newValue);
      const newVersion = existingSecret.version + 1;
      
      // Update secret
      const updatedSecret = {
        ...existingSecret,
        value: encryptedValue.data,
        iv: encryptedValue.iv,
        authTag: encryptedValue.authTag,
        keyVersion: encryptedValue.keyVersion,
        version: newVersion,
        lastModified: new Date()
      };
      
      // Update metadata
      const updatedMeta = {
        ...existingMeta,
        description: description || existingMeta.description,
        metadata: { ...existingMeta.metadata, ...metadata },
        lastModified: new Date()
      };
      
      // Store new version
      this.secrets.set(secretId, updatedSecret);
      this.secretMetadata.set(secretId, updatedMeta);
      
      // Add to version history
      if (this.config.enableVersioning) {
        const versions = this.secretVersions.get(secretId) || [];
        versions.push({ ...updatedSecret });
        
        // Limit version history
        if (versions.length > this.config.maxVersions) {
          versions.shift();
        }
        
        this.secretVersions.set(secretId, versions);
      }
      
      // Update integrity hash
      if (this.config.tamperDetection) {
        const integrityHash = await this._createIntegrityHash(updatedSecret);
        this.integrityHashes.set(secretId, integrityHash);
      }
      
      // Save to persistent storage
      await this._saveSecret(secretId, updatedSecret, updatedMeta);
      
      // Update metrics
      this.metrics.encryptionOperations++;
      
      // Log access
      await this._logAccess({
        action: 'update',
        secretId,
        userId,
        version: newVersion,
        timestamp: new Date(),
        success: true
      });
      
      this.emit('secret:updated', { secretId, userId, version: newVersion });
      
      return {
        secretId,
        version: newVersion,
        previousVersion: existingSecret.version
      };
      
    } catch (error) {
      this.logger.error(`Failed to update secret '${secretId}':`, error);
      
      // Log failed access
      await this._logAccess({
        action: 'update',
        secretId,
        userId: options.userId,
        timestamp: new Date(),
        success: false,
        error: error.message
      });
      
      throw error;
    }
  }
  
  /**
   * Delete a secret
   */
  async deleteSecret(secretId, options = {}) {
    try {
      const { userId, force = false } = options;
      
      // Validate access
      if (this.config.requireAuthentication) {
        await this._validateAccess(userId, 'delete', secretId);
      }
      
      const secret = this.secrets.get(secretId);
      const secretMeta = this.secretMetadata.get(secretId);
      
      if (!secret || !secretMeta) {
        throw new Error(`Secret '${secretId}' not found`);
      }
      
      this.logger.info(`Deleting secret: ${secretId}`);
      
      if (force) {
        // Hard delete - remove completely
        this.secrets.delete(secretId);
        this.secretMetadata.delete(secretId);
        this.secretVersions.delete(secretId);
        this.rotationSchedule.delete(secretId);
        this.integrityHashes.delete(secretId);
        
        // Remove from persistent storage
        await this._removeSecretFromStorage(secretId);
      } else {
        // Soft delete - mark as inactive
        secretMeta.isActive = false;
        secretMeta.deletedAt = new Date();
        secretMeta.deletedBy = userId;
        
        // Save updated metadata
        await this._saveSecret(secretId, secret, secretMeta);
      }
      
      // Log access
      await this._logAccess({
        action: force ? 'hard_delete' : 'soft_delete',
        secretId,
        userId,
        timestamp: new Date(),
        success: true
      });
      
      this.emit('secret:deleted', { secretId, userId, force });
      
      return {
        secretId,
        deleted: true,
        force
      };
      
    } catch (error) {
      this.logger.error(`Failed to delete secret '${secretId}':`, error);
      
      // Log failed access
      await this._logAccess({
        action: 'delete',
        secretId,
        userId: options.userId,
        timestamp: new Date(),
        success: false,
        error: error.message
      });
      
      throw error;
    }
  }
  
  /**
   * Rotate a secret
   */
  async rotateSecret(secretId, newValue, options = {}) {
    try {
      const { userId } = options;
      
      // Validate access
      if (this.config.requireAuthentication) {
        await this._validateAccess(userId, 'rotate', secretId);
      }
      
      const secretMeta = this.secretMetadata.get(secretId);
      if (!secretMeta) {
        throw new Error(`Secret '${secretId}' not found`);
      }
      
      this.logger.info(`Rotating secret: ${secretId}`);
      
      // Update secret with new value
      const updateResult = await this.updateSecret(secretId, newValue, {
        userId,
        description: `Rotated on ${new Date().toISOString()}`
      });
      
      // Update rotation schedule
      const nextRotation = new Date(Date.now() + secretMeta.rotationInterval);
      secretMeta.nextRotation = nextRotation;
      secretMeta.lastRotation = new Date();
      
      this.rotationSchedule.set(secretId, nextRotation);
      
      // Update metrics
      this.metrics.secretsRotated++;
      
      // Log rotation
      await this._logAccess({
        action: 'rotate',
        secretId,
        userId,
        version: updateResult.version,
        timestamp: new Date(),
        success: true
      });
      
      this.emit('secret:rotated', { 
        secretId, 
        userId, 
        version: updateResult.version,
        nextRotation 
      });
      
      return {
        secretId,
        version: updateResult.version,
        nextRotation
      };
      
    } catch (error) {
      this.logger.error(`Failed to rotate secret '${secretId}':`, error);
      
      // Log failed rotation
      await this._logAccess({
        action: 'rotate',
        secretId,
        userId: options.userId,
        timestamp: new Date(),
        success: false,
        error: error.message
      });
      
      throw error;
    }
  }
  
  /**
   * List secrets (metadata only)
   */
  async listSecrets(options = {}) {
    try {
      const { userId, tags, activeOnly = true } = options;
      
      // Validate access
      if (this.config.requireAuthentication) {
        await this._validateAccess(userId, 'list');
      }
      
      const secretsList = [];
      
      for (const [secretId, secretMeta] of this.secretMetadata.entries()) {
        // Filter by active status
        if (activeOnly && !secretMeta.isActive) {
          continue;
        }
        
        // Filter by tags
        if (tags && !tags.some(tag => secretMeta.tags.has(tag))) {
          continue;
        }
        
        const secret = this.secrets.get(secretId);
        
        secretsList.push({
          id: secretId,
          description: secretMeta.description,
          tags: Array.from(secretMeta.tags),
          version: secret?.version || 0,
          createdAt: secretMeta.createdAt,
          lastModified: secretMeta.lastModified,
          lastAccessed: secret?.lastAccessed,
          accessCount: secret?.accessCount || 0,
          nextRotation: secretMeta.nextRotation,
          isActive: secretMeta.isActive
        });
      }
      
      // Log access
      await this._logAccess({
        action: 'list',
        userId,
        timestamp: new Date(),
        success: true,
        count: secretsList.length
      });
      
      return secretsList;
      
    } catch (error) {
      this.logger.error('Failed to list secrets:', error);
      
      // Log failed access
      await this._logAccess({
        action: 'list',
        userId: options.userId,
        timestamp: new Date(),
        success: false,
        error: error.message
      });
      
      throw error;
    }
  }
  
  /**
   * Get secrets manager metrics
   */
  getMetrics() {
    const rotationStats = {
      totalScheduled: this.rotationSchedule.size,
      overdue: 0,
      upcomingWeek: 0
    };
    
    const now = Date.now();
    const weekFromNow = now + (7 * 24 * 60 * 60 * 1000);
    
    for (const rotationTime of this.rotationSchedule.values()) {
      if (rotationTime.getTime() < now) {
        rotationStats.overdue++;
      } else if (rotationTime.getTime() < weekFromNow) {
        rotationStats.upcomingWeek++;
      }
    }
    
    return {
      ...this.metrics,
      storage: {
        totalSecrets: this.secrets.size,
        activeSecrets: Array.from(this.secretMetadata.values())
          .filter(meta => meta.isActive).length,
        totalVersions: Array.from(this.secretVersions.values())
          .reduce((total, versions) => total + versions.length, 0)
      },
      rotation: rotationStats,
      accessLog: this.accessLog.length,
      policies: this.accessPolicies.size
    };
  }
  
  // Private methods
  
  async _initializeMasterKey() {
    // In production, retrieve from HSM or secure key management service
    const keyPath = path.join(process.cwd(), this.config.storageDir, '.master.key');
    
    try {
      const existingKey = await fs.readFile(keyPath);
      this.masterKey = existingKey;
      this.logger.info('Loaded existing master key');
    } catch (error) {
      if (error.code === 'ENOENT') {
        // Generate new master key
        this.masterKey = randomBytes(this.config.keyLength);
        await fs.mkdir(path.dirname(keyPath), { recursive: true });
        await fs.writeFile(keyPath, this.masterKey, { mode: 0o600 });
        this.logger.info('Generated new master key');
      } else {
        throw error;
      }
    }
  }
  
  async _initializeStorage() {
    const storageDir = path.join(process.cwd(), this.config.storageDir);
    await fs.mkdir(storageDir, { recursive: true });
  }
  
  async _encryptSecret(secretValue) {
    const iv = randomBytes(this.config.ivLength);
    const salt = randomBytes(this.config.saltLength);
    
    // Derive encryption key from master key
    const derivedKey = scryptSync(this.masterKey, salt, this.config.keyLength);
    
    // Create cipher
    const cipher = crypto.createCipherGCM(this.config.encryptionAlgorithm, derivedKey, iv);
    
    // Encrypt data
    let encrypted = cipher.update(secretValue, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      data: encrypted,
      iv: iv.toString('hex'),
      salt: salt.toString('hex'),
      authTag: authTag.toString('hex'),
      keyVersion: 1 // For key rotation support
    };
  }
  
  async _decryptSecret(encryptedData) {
    const { data, iv, salt, authTag, keyVersion } = encryptedData;
    
    // Derive the same encryption key
    const derivedKey = scryptSync(
      this.masterKey, 
      Buffer.from(salt, 'hex'), 
      this.config.keyLength
    );
    
    // Create decipher
    const decipher = crypto.createDecipherGCM(
      this.config.encryptionAlgorithm,
      derivedKey,
      Buffer.from(iv, 'hex')
    );
    
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));
    
    // Decrypt data
    let decrypted = decipher.update(data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
  
  async _createIntegrityHash(secret) {
    const data = JSON.stringify({
      value: secret.value,
      iv: secret.iv,
      authTag: secret.authTag,
      version: secret.version
    });
    
    return createHash('sha256').update(data).digest('hex');
  }
  
  async _verifyIntegrity(secretId, secret) {
    const currentHash = await this._createIntegrityHash(secret);
    const storedHash = this.integrityHashes.get(secretId);
    
    return currentHash === storedHash;
  }
  
  async _validateAccess(userId, action, secretId = null) {
    if (!userId) {
      throw new Error('User authentication required');
    }
    
    // Implement access control logic based on policies
    // This is a simplified version - in production use proper RBAC
    
    const policy = secretId ? 
      this.accessPolicies.get(secretId) || this.accessPolicies.get('default') :
      this.accessPolicies.get('default');
    
    if (!policy) {
      throw new Error('No access policy found');
    }
    
    // Check if user has required permissions
    const requiredPermission = `secrets:${action}`;
    if (!policy.permissions.includes(requiredPermission) && 
        !policy.permissions.includes('secrets:*')) {
      throw new Error(`Access denied: ${action} operation not permitted`);
    }
    
    return true;
  }
  
  async _logAccess(accessEvent) {
    if (this.config.accessLogging) {
      this.accessLog.push({
        ...accessEvent,
        id: randomBytes(8).toString('hex')
      });
      
      // Maintain log size
      if (this.accessLog.length > 10000) {
        this.accessLog.splice(0, 1000);
      }
      
      // Persist audit log
      if (this.config.auditAllAccess) {
        await this._persistAuditLog(accessEvent);
      }
    }
  }
  
  async _saveSecret(secretId, secret, metadata) {
    if (this.config.storageType === 'file') {
      const secretPath = path.join(
        process.cwd(), 
        this.config.storageDir, 
        'secrets',
        `${secretId}.json`
      );
      
      const metaPath = path.join(
        process.cwd(), 
        this.config.storageDir, 
        'metadata',
        `${secretId}.json`
      );
      
      await fs.mkdir(path.dirname(secretPath), { recursive: true });
      await fs.mkdir(path.dirname(metaPath), { recursive: true });
      
      // Save encrypted secret
      await fs.writeFile(secretPath, JSON.stringify(secret, null, 2), { mode: 0o600 });
      
      // Save metadata (excluding sensitive data)
      const safeMeta = {
        ...metadata,
        tags: Array.from(metadata.tags)
      };
      await fs.writeFile(metaPath, JSON.stringify(safeMeta, null, 2), { mode: 0o600 });
    }
  }
  
  async _loadSecrets() {
    if (this.config.storageType === 'file') {
      try {
        const secretsDir = path.join(process.cwd(), this.config.storageDir, 'secrets');
        const metadataDir = path.join(process.cwd(), this.config.storageDir, 'metadata');
        
        const secretFiles = await fs.readdir(secretsDir);
        
        for (const file of secretFiles) {
          if (file.endsWith('.json')) {
            const secretId = path.basename(file, '.json');
            
            // Load secret
            const secretData = await fs.readFile(path.join(secretsDir, file), 'utf8');
            const secret = JSON.parse(secretData);
            this.secrets.set(secretId, secret);
            
            // Load metadata
            const metaPath = path.join(metadataDir, file);
            try {
              const metaData = await fs.readFile(metaPath, 'utf8');
              const metadata = JSON.parse(metaData);
              metadata.tags = new Set(metadata.tags);
              this.secretMetadata.set(secretId, metadata);
              
              // Restore rotation schedule
              if (metadata.nextRotation) {
                this.rotationSchedule.set(secretId, new Date(metadata.nextRotation));
              }
            } catch (metaError) {
              this.logger.warn(`Failed to load metadata for ${secretId}:`, metaError.message);
            }
          }
        }
        
        this.logger.info(`Loaded ${this.secrets.size} secrets from storage`);
      } catch (error) {
        if (error.code !== 'ENOENT') {
          this.logger.warn('Failed to load secrets:', error.message);
        }
      }
    }
  }
  
  async _initializeAccessPolicies() {
    // Initialize default access policies
    this.accessPolicies.set('default', {
      permissions: ['secrets:read', 'secrets:list'],
      description: 'Default read-only access'
    });
    
    this.accessPolicies.set('admin', {
      permissions: ['secrets:*'],
      description: 'Full access to all secrets operations'
    });
  }
  
  _startRotationScheduler() {
    // Check for secrets needing rotation every hour
    setInterval(async () => {
      const now = Date.now();
      
      for (const [secretId, rotationTime] of this.rotationSchedule.entries()) {
        if (rotationTime.getTime() <= now) {
          try {
            // Emit rotation needed event
            this.emit('secret:rotation-needed', { 
              secretId, 
              overdue: now - rotationTime.getTime() 
            });
            
            // Auto-rotate if configured (would need callback for new value generation)
            // For now, just log and extend deadline
            this.logger.warn(`Secret '${secretId}' requires rotation`);
            
          } catch (error) {
            this.logger.error(`Automatic rotation failed for '${secretId}':`, error);
          }
        }
      }
    }, 3600000); // 1 hour
  }
  
  _startMonitoring() {
    // Monitor access patterns and emit alerts
    setInterval(() => {
      const recentAccess = this.accessLog.filter(log => 
        Date.now() - log.timestamp.getTime() < 300000 // Last 5 minutes
      );
      
      const failedAccess = recentAccess.filter(log => !log.success);
      
      if (failedAccess.length > 10) {
        this.emit('security:alert', {
          type: 'high_failure_rate',
          count: failedAccess.length,
          timeWindow: '5 minutes'
        });
      }
    }, 300000); // Every 5 minutes
  }
  
  async _persistAuditLog(accessEvent) {
    const auditPath = path.join(
      process.cwd(), 
      'logs', 
      'security',
      'secrets-audit.log'
    );
    
    await fs.mkdir(path.dirname(auditPath), { recursive: true });
    
    const logEntry = JSON.stringify({
      timestamp: accessEvent.timestamp.toISOString(),
      ...accessEvent
    }) + '\n';
    
    await fs.appendFile(auditPath, logEntry);
  }
  
  async _removeSecretFromStorage(secretId) {
    if (this.config.storageType === 'file') {
      const secretPath = path.join(
        process.cwd(), 
        this.config.storageDir, 
        'secrets',
        `${secretId}.json`
      );
      
      const metaPath = path.join(
        process.cwd(), 
        this.config.storageDir, 
        'metadata',
        `${secretId}.json`
      );
      
      try {
        await fs.unlink(secretPath);
        await fs.unlink(metaPath);
      } catch (error) {
        this.logger.warn(`Failed to remove secret files for '${secretId}':`, error.message);
      }
    }
  }
  
  /**
   * Shutdown secrets manager
   */
  async shutdown() {
    try {
      this.logger.info('Shutting down Enterprise Secrets Manager...');
      
      // Clear sensitive data from memory
      this.secrets.clear();
      this.encryptionKeys.clear();
      this.masterKey = null;
      
      this.state = 'shutdown';
      this.logger.success('Enterprise Secrets Manager shutdown complete');
      
    } catch (error) {
      this.logger.error('Error during Secrets Manager shutdown:', error);
      throw error;
    }
  }
}

export default EnterpriseSecretsManager;