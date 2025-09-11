/**
 * Enterprise Secret Management System
 * Fortune 5 compliant with AES-256-GCM encryption, rotation, and audit logging
 */

import crypto from 'crypto';
import fs from 'fs-extra';
import path from 'path';
import { z } from 'zod';
import dayjs from 'dayjs';
import consola from 'consola';

// Secret validation schemas
const SecretSchema = z.object({
  id: z.string().min(1),
  value: z.string().min(1),
  environment: z.enum(['development', 'staging', 'production']),
  category: z.enum(['database', 'api_key', 'jwt', 'oauth', 'encryption', 'saml', 'ldap']),
  rotationInterval: z.number().min(1).max(365), // days
  lastRotated: z.string().datetime(),
  expiresAt: z.string().datetime().optional(),
  tags: z.array(z.string()).default([]),
  compliance: z.object({
    pci: z.boolean().default(false),
    hipaa: z.boolean().default(false),
    sox: z.boolean().default(false),
    gdpr: z.boolean().default(false)
  }).default({})
});

const EnvironmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production']),
  SECRET_ENCRYPTION_KEY: z.string().min(32),
  SECRET_STORE_PATH: z.string().optional(),
  AUDIT_LOG_ENABLED: z.boolean().default(true),
  ROTATION_CHECK_INTERVAL: z.number().min(3600).default(86400) // seconds
});

class SecretManager {
  constructor(options = {}) {
    this.encryptionKey = options.encryptionKey || process.env.SECRET_ENCRYPTION_KEY;
    this.storePath = options.storePath || process.env.SECRET_STORE_PATH || './config/secrets';
    this.auditLogPath = options.auditLogPath || './logs/secret-audit.log';
    this.environment = options.environment || process.env.NODE_ENV || 'development';
    
    if (!this.encryptionKey || this.encryptionKey.length < 32) {
      throw new Error('SECRET_ENCRYPTION_KEY must be at least 32 characters');
    }
    
    this.algorithm = 'aes-256-gcm';
    this.keyDerivation = 'pbkdf2';
    this.iterations = 100000;
    this.saltLength = 16;
    this.ivLength = 12;
    this.tagLength = 16;
    
    this.init();
  }

  async init() {
    // Ensure directories exist
    await fs.ensureDir(this.storePath);
    await fs.ensureDir(path.dirname(this.auditLogPath));
    
    // Initialize audit logging
    this.auditLogger = consola.withTag('SECRET-AUDIT');
    
    // Log initialization
    await this.auditLog('SYSTEM_INIT', {
      environment: this.environment,
      storePath: this.storePath,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Derive encryption key from master key and salt
   */
  deriveKey(salt) {
    return crypto.pbkdf2Sync(this.encryptionKey, salt, this.iterations, 32, 'sha256');
  }

  /**
   * Encrypt secret value using AES-256-GCM
   */
  encrypt(value) {
    const salt = crypto.randomBytes(this.saltLength);
    const iv = crypto.randomBytes(this.ivLength);
    const key = this.deriveKey(salt);
    
    const cipher = crypto.createCipherGCM(this.algorithm, key, iv);
    cipher.setAAD(Buffer.from(this.environment));
    
    let encrypted = cipher.update(value, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const tag = cipher.getAuthTag();
    
    return {
      encrypted,
      salt: salt.toString('hex'),
      iv: iv.toString('hex'),
      tag: tag.toString('hex'),
      algorithm: this.algorithm
    };
  }

  /**
   * Decrypt secret value
   */
  decrypt(encryptedData) {
    const { encrypted, salt, iv, tag, algorithm } = encryptedData;
    
    if (algorithm !== this.algorithm) {
      throw new Error(`Unsupported encryption algorithm: ${algorithm}`);
    }
    
    const key = this.deriveKey(Buffer.from(salt, 'hex'));
    const ivBuffer = Buffer.from(iv, 'hex');
    const decipher = crypto.createDecipherGCM(algorithm, key, ivBuffer);
    
    decipher.setAuthTag(Buffer.from(tag, 'hex'));
    decipher.setAAD(Buffer.from(this.environment));
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * Store encrypted secret
   */
  async storeSecret(secretData) {
    const validated = SecretSchema.parse(secretData);
    const encryptedValue = this.encrypt(validated.value);
    
    const secretRecord = {
      ...validated,
      value: encryptedValue,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    const secretPath = path.join(this.storePath, this.environment, `${validated.id}.json`);
    await fs.ensureDir(path.dirname(secretPath));
    await fs.writeJson(secretPath, secretRecord, { spaces: 2 });
    
    await this.auditLog('SECRET_STORED', {
      secretId: validated.id,
      category: validated.category,
      environment: validated.environment,
      rotationInterval: validated.rotationInterval
    });
    
    return secretRecord;
  }

  /**
   * Retrieve and decrypt secret
   */
  async getSecret(secretId) {
    const secretPath = path.join(this.storePath, this.environment, `${secretId}.json`);
    
    if (!await fs.pathExists(secretPath)) {
      await this.auditLog('SECRET_NOT_FOUND', { secretId, environment: this.environment });
      throw new Error(`Secret not found: ${secretId}`);
    }
    
    const secretRecord = await fs.readJson(secretPath);
    const decryptedValue = this.decrypt(secretRecord.value);
    
    await this.auditLog('SECRET_ACCESSED', {
      secretId,
      category: secretRecord.category,
      environment: this.environment
    });
    
    return {
      ...secretRecord,
      value: decryptedValue
    };
  }

  /**
   * List all secrets (without values)
   */
  async listSecrets() {
    const secretsDir = path.join(this.storePath, this.environment);
    
    if (!await fs.pathExists(secretsDir)) {
      return [];
    }
    
    const files = await fs.readdir(secretsDir);
    const secrets = [];
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        const secretPath = path.join(secretsDir, file);
        const secretRecord = await fs.readJson(secretPath);
        
        secrets.push({
          id: secretRecord.id,
          category: secretRecord.category,
          environment: secretRecord.environment,
          rotationInterval: secretRecord.rotationInterval,
          lastRotated: secretRecord.lastRotated,
          expiresAt: secretRecord.expiresAt,
          tags: secretRecord.tags,
          compliance: secretRecord.compliance,
          createdAt: secretRecord.createdAt,
          updatedAt: secretRecord.updatedAt
        });
      }
    }
    
    await this.auditLog('SECRETS_LISTED', {
      count: secrets.length,
      environment: this.environment
    });
    
    return secrets;
  }

  /**
   * Rotate secret (generate new value)
   */
  async rotateSecret(secretId, newValue) {
    const existingSecret = await this.getSecret(secretId);
    
    const updatedSecret = {
      ...existingSecret,
      value: newValue,
      lastRotated: new Date().toISOString(),
      expiresAt: dayjs().add(existingSecret.rotationInterval, 'days').toISOString()
    };
    
    await this.storeSecret(updatedSecret);
    
    await this.auditLog('SECRET_ROTATED', {
      secretId,
      previousRotation: existingSecret.lastRotated,
      newRotation: updatedSecret.lastRotated
    });
    
    return updatedSecret;
  }

  /**
   * Check for secrets needing rotation
   */
  async checkRotationNeeded() {
    const secrets = await this.listSecrets();
    const needsRotation = [];
    
    for (const secret of secrets) {
      const daysSinceRotation = dayjs().diff(dayjs(secret.lastRotated), 'days');
      
      if (daysSinceRotation >= secret.rotationInterval) {
        needsRotation.push({
          ...secret,
          daysSinceRotation,
          overdueDays: daysSinceRotation - secret.rotationInterval
        });
      }
    }
    
    if (needsRotation.length > 0) {
      await this.auditLog('ROTATION_CHECK', {
        needsRotationCount: needsRotation.length,
        secrets: needsRotation.map(s => ({
          id: s.id,
          overdueDays: s.overdueDays
        }))
      });
    }
    
    return needsRotation;
  }

  /**
   * Delete secret
   */
  async deleteSecret(secretId) {
    const secretPath = path.join(this.storePath, this.environment, `${secretId}.json`);
    
    if (!await fs.pathExists(secretPath)) {
      throw new Error(`Secret not found: ${secretId}`);
    }
    
    await fs.remove(secretPath);
    
    await this.auditLog('SECRET_DELETED', {
      secretId,
      environment: this.environment
    });
  }

  /**
   * Validate environment configuration
   */
  validateEnvironment(env = process.env) {
    try {
      return EnvironmentSchema.parse(env);
    } catch (error) {
      throw new Error(`Environment validation failed: ${error.message}`);
    }
  }

  /**
   * Audit logging
   */
  async auditLog(action, details = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      action,
      environment: this.environment,
      details,
      pid: process.pid,
      hostname: require('os').hostname()
    };
    
    // Console logging
    this.auditLogger.info(`${action}:`, details);
    
    // File logging
    const logLine = JSON.stringify(logEntry) + '\n';
    await fs.appendFile(this.auditLogPath, logLine);
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport() {
    const secrets = await this.listSecrets();
    const rotationNeeded = await this.checkRotationNeeded();
    
    const complianceStats = {
      pci: secrets.filter(s => s.compliance.pci).length,
      hipaa: secrets.filter(s => s.compliance.hipaa).length,
      sox: secrets.filter(s => s.compliance.sox).length,
      gdpr: secrets.filter(s => s.compliance.gdpr).length
    };
    
    const report = {
      generatedAt: new Date().toISOString(),
      environment: this.environment,
      totalSecrets: secrets.length,
      secretsNeedingRotation: rotationNeeded.length,
      complianceStats,
      securityMetrics: {
        encryptionAlgorithm: this.algorithm,
        keyDerivation: this.keyDerivation,
        iterations: this.iterations,
        auditLoggingEnabled: true
      },
      recommendations: []
    };
    
    // Add recommendations
    if (rotationNeeded.length > 0) {
      report.recommendations.push(`${rotationNeeded.length} secrets need rotation`);
    }
    
    if (secrets.some(s => s.rotationInterval > 90)) {
      report.recommendations.push('Some secrets have rotation intervals > 90 days (not recommended for production)');
    }
    
    await this.auditLog('COMPLIANCE_REPORT_GENERATED', {
      totalSecrets: report.totalSecrets,
      secretsNeedingRotation: report.secretsNeedingRotation,
      complianceStats: report.complianceStats
    });
    
    return report;
  }
}

export default SecretManager;