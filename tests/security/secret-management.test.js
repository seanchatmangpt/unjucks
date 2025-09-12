/**
 * Enterprise Secret Management System - Test Suite
 * Comprehensive tests for Fortune 5 compliance validation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';
import {
  SecretManager,
  EnvironmentValidator,
  SecretRotationService,
  ConfigManager,
  ComplianceAuditor,
  EnterpriseSecretService
} from '../../src/security/secrets/index.js';

describe('Enterprise Secret Management System', () => {
  let testDir;
  let secretManager;
  let environmentValidator;
  let configManager;
  let complianceAuditor;
  let rotationService;
  let enterpriseService;

  beforeEach(async () => {
    // Create temporary test directory
    testDir = path.join(process.cwd(), 'test-secrets-' + this.getDeterministicTimestamp());
    await fs.ensureDir(testDir);

    // Set test encryption key
    process.env.SECRET_ENCRYPTION_KEY = crypto.randomBytes(64).toString('hex');
    process.env.NODE_ENV = 'development';

    // Initialize components
    secretManager = new SecretManager({
      storePath: path.join(testDir, 'secrets'),
      auditLogPath: path.join(testDir, 'audit.log')
    });

    environmentValidator = new EnvironmentValidator({
      strictMode: false
    });

    configManager = new ConfigManager({
      configDir: path.join(testDir, 'config'),
      secretManager
    });

    complianceAuditor = new ComplianceAuditor({
      auditPath: path.join(testDir, 'audits'),
      reportsPath: path.join(testDir, 'reports')
    });

    rotationService = new SecretRotationService({
      secretManager
    });

    enterpriseService = new EnterpriseSecretService({
      environment: 'development',
      secretManager: { storePath: path.join(testDir, 'secrets') },
      configManager: { configDir: path.join(testDir, 'config') },
      complianceAuditor: { auditPath: path.join(testDir, 'audits') }
    });
  });

  afterEach(async () => {
    // Cleanup
    await fs.remove(testDir);
    delete process.env.SECRET_ENCRYPTION_KEY;
  });

  describe('SecretManager', () => {
    it('should encrypt and decrypt secrets correctly', async () => {
      await secretManager.init();

      const testSecret = {
        id: 'test_secret',
        value: 'super-secret-value-12345',
        environment: 'development',
        category: 'api_key',
        rotationInterval: 30,
        lastRotated: this.getDeterministicDate().toISOString(),
        tags: ['test'],
        compliance: { pci: true }
      };

      // Store secret
      const stored = await secretManager.storeSecret(testSecret);
      expect(stored.id).toBe(testSecret.id);
      expect(stored.value).not.toBe(testSecret.value); // Should be encrypted

      // Retrieve secret
      const retrieved = await secretManager.getSecret('test_secret');
      expect(retrieved.value).toBe(testSecret.value); // Should be decrypted
      expect(retrieved.category).toBe('api_key');
    });

    it('should list secrets without exposing values', async () => {
      await secretManager.init();

      const secrets = [
        {
          id: 'secret1',
          value: 'value1',
          environment: 'development',
          category: 'jwt',
          rotationInterval: 30,
          lastRotated: this.getDeterministicDate().toISOString(),
          tags: [],
          compliance: {}
        },
        {
          id: 'secret2',
          value: 'value2',
          environment: 'development',
          category: 'database',
          rotationInterval: 60,
          lastRotated: this.getDeterministicDate().toISOString(),
          tags: [],
          compliance: {}
        }
      ];

      for (const secret of secrets) {
        await secretManager.storeSecret(secret);
      }

      const list = await secretManager.listSecrets();
      expect(list).toHaveLength(2);
      expect(list[0]).not.toHaveProperty('value');
      expect(list[0]).toHaveProperty('id');
      expect(list[0]).toHaveProperty('category');
    });

    it('should detect secrets needing rotation', async () => {
      await secretManager.init();

      // Create an old secret (simulate overdue rotation)
      const oldDate = this.getDeterministicDate();
      oldDate.setDate(oldDate.getDate() - 35); // 35 days ago

      const oldSecret = {
        id: 'old_secret',
        value: 'old-value',
        environment: 'development',
        category: 'jwt',
        rotationInterval: 30, // Should rotate every 30 days
        lastRotated: oldDate.toISOString(),
        tags: [],
        compliance: {}
      };

      await secretManager.storeSecret(oldSecret);

      const needsRotation = await secretManager.checkRotationNeeded();
      expect(needsRotation).toHaveLength(1);
      expect(needsRotation[0].id).toBe('old_secret');
      expect(needsRotation[0].overdueDays).toBeGreaterThan(0);
    });

    it('should generate compliance reports', async () => {
      await secretManager.init();

      const secrets = [
        {
          id: 'pci_secret',
          value: 'pci-value',
          environment: 'development',
          category: 'database',
          rotationInterval: 30,
          lastRotated: this.getDeterministicDate().toISOString(),
          tags: ['pci'],
          compliance: { pci: true }
        },
        {
          id: 'hipaa_secret',
          value: 'hipaa-value',
          environment: 'development',
          category: 'encryption',
          rotationInterval: 60,
          lastRotated: this.getDeterministicDate().toISOString(),
          tags: ['hipaa'],
          compliance: { hipaa: true }
        }
      ];

      for (const secret of secrets) {
        await secretManager.storeSecret(secret);
      }

      const report = await secretManager.generateComplianceReport();
      expect(report.totalSecrets).toBe(2);
      expect(report.complianceStats.pci).toBe(1);
      expect(report.complianceStats.hipaa).toBe(1);
      expect(report.securityMetrics.encryptionAlgorithm).toBe('aes-256-gcm');
    });
  });

  describe('EnvironmentValidator', () => {
    it('should validate production environment strictly', () => {
      const productionEnv = {
        NODE_ENV: 'production',
        SECRET_ENCRYPTION_KEY: crypto.randomBytes(64).toString('hex'),
        JWT_SECRET: crypto.randomBytes(64).toString('hex'),
        SESSION_SECRET: crypto.randomBytes(64).toString('hex'),
        ENCRYPTION_KEY: crypto.randomBytes(64).toString('hex'),
        DB_PASSWORD: 'ComplexP@ssw0rd123!',
        BCRYPT_ROUNDS: '12',
        DB_SSL_ENABLED: 'true',
        AUDIT_LOG_ENABLED: 'true',
        RATE_LIMIT_ENABLED: 'true',
        CORS_ORIGIN: 'https://app.example.com',
        GRAPHQL_PLAYGROUND: 'false',
        GRAPHQL_INTROSPECTION: 'false',
        // Common config
        DB_HOST: 'localhost',
        DB_PORT: '5432',
        DB_NAME: 'test',
        DB_USER: 'test'
      };

      const result = environmentValidator.validate(productionEnv);
      expect(result.isValid).toBe(true);
      expect(result.securityLevel).toBe('MAXIMUM');
    });

    it('should reject weak secrets in production', () => {
      const weakProductionEnv = {
        NODE_ENV: 'production',
        SECRET_ENCRYPTION_KEY: 'weak', // Too short
        JWT_SECRET: 'weak',
        SESSION_SECRET: 'weak',
        ENCRYPTION_KEY: 'weak',
        DB_PASSWORD: 'weak',
        BCRYPT_ROUNDS: '8', // Too low for production
        DB_SSL_ENABLED: 'false', // Must be true in production
        CORS_ORIGIN: '*', // Not allowed in production
        // Common config
        DB_HOST: 'localhost',
        DB_PORT: '5432',
        DB_NAME: 'test',
        DB_USER: 'test'
      };

      expect(() => {
        environmentValidator.validate(weakProductionEnv);
      }).toThrow();
    });

    it('should generate secure defaults', () => {
      const defaults = environmentValidator.generateSecureDefaults('production');
      
      expect(defaults.SECRET_ENCRYPTION_KEY).toHaveLength(128); // 64 bytes hex
      expect(defaults.JWT_SECRET).toHaveLength(128);
      expect(defaults.SESSION_SECRET).toHaveLength(128);
      expect(defaults.ENCRYPTION_KEY).toHaveLength(128);
    });

    it('should validate secret strength', () => {
      const strongSecret = 'Th1s1sAV3ryStr0ngS3cr3tW1thM1x3dCh@r@ct3rs!';
      const weakSecret = 'password123';

      const strongResult = environmentValidator.validateSecretStrength(strongSecret, 'production');
      const weakResult = environmentValidator.validateSecretStrength(weakSecret, 'production');

      expect(strongResult.isStrong).toBe(true);
      expect(weakResult.isStrong).toBe(false);
      expect(weakResult.recommendations).toContain('Increase length to at least 64 characters');
    });
  });

  describe('SecretRotationService', () => {
    it('should identify secrets needing rotation by priority', async () => {
      await secretManager.init();

      // Create secrets with different priorities
      const criticalSecret = {
        id: 'critical_jwt',
        value: 'jwt-value',
        environment: 'development',
        category: 'jwt', // Critical priority
        rotationInterval: 30,
        lastRotated: new Date(this.getDeterministicTimestamp() - 35 * 24 * 60 * 60 * 1000).toISOString(), // 35 days ago
        tags: [],
        compliance: {}
      };

      const normalSecret = {
        id: 'normal_ldap',
        value: 'ldap-value',
        environment: 'development',
        category: 'ldap', // Normal priority
        rotationInterval: 30,
        lastRotated: new Date(this.getDeterministicTimestamp() - 35 * 24 * 60 * 60 * 1000).toISOString(),
        tags: [],
        compliance: {}
      };

      await secretManager.storeSecret(criticalSecret);
      await secretManager.storeSecret(normalSecret);

      const needsRotation = await secretManager.checkRotationNeeded();
      const criticalSecrets = rotationService.filterSecretsByPriority(needsRotation, 'critical');
      const normalSecrets = rotationService.filterSecretsByPriority(needsRotation, 'normal');

      expect(criticalSecrets).toHaveLength(1);
      expect(criticalSecrets[0].id).toBe('critical_jwt');
      expect(normalSecrets).toHaveLength(1);
      expect(normalSecrets[0].id).toBe('normal_ldap');
    });

    it('should generate strong rotation values', async () => {
      const apiKey = await rotationService.rotateApiKey('test_api_key');
      const jwtSecret = await rotationService.rotateJwtSecret('test_jwt');
      const dbPassword = await rotationService.rotateDatabasePassword('test_db');
      const encryptionKey = await rotationService.rotateEncryptionKey('test_encryption');

      expect(apiKey).toMatch(/^(test_|live_)[a-f0-9]{64}$/);
      expect(jwtSecret).toHaveLength(128); // 64 bytes hex
      expect(dbPassword).toHaveLength(32);
      expect(encryptionKey).toHaveLength(128);

      // Validate database password complexity
      const passwordValidation = environmentValidator.validateSecretStrength(dbPassword, 'database');
      expect(passwordValidation.isStrong).toBe(true);
    });
  });

  describe('ComplianceAuditor', () => {
    it('should run comprehensive compliance audit', async () => {
      await secretManager.init();
      await configManager.init();
      await complianceAuditor.init();

      // Add some test secrets
      await secretManager.storeSecret({
        id: 'test_secret',
        value: 'test-value',
        environment: 'development',
        category: 'jwt',
        rotationInterval: 30,
        lastRotated: this.getDeterministicDate().toISOString(),
        tags: [],
        compliance: { pci: true }
      });

      const auditResults = await complianceAuditor.runFullAudit(secretManager, configManager);

      expect(auditResults).toHaveProperty('auditId');
      expect(auditResults).toHaveProperty('overallScore');
      expect(auditResults).toHaveProperty('frameworks');
      expect(auditResults).toHaveProperty('secretsAudit');
      expect(auditResults).toHaveProperty('configurationAudit');
      expect(auditResults.overallScore).toBeGreaterThanOrEqual(0);
      expect(auditResults.overallScore).toBeLessThanOrEqual(100);
    });

    it('should identify critical compliance issues', async () => {
      await complianceAuditor.init();

      // Mock audit results with critical issues
      const mockAuditResults = {
        environment: 'production',
        frameworks: {
          pci: { score: 60 } // Below 80% threshold
        },
        secretsAudit: {
          encryption: false // Critical issue
        },
        configurationAudit: {
          auditLogging: false // Critical issue
        }
      };

      const criticalIssues = complianceAuditor.identifyCriticalIssues(mockAuditResults);

      expect(criticalIssues.length).toBeGreaterThan(0);
      expect(criticalIssues.some(issue => issue.framework === 'Security')).toBe(true);
      expect(criticalIssues.some(issue => issue.impact === 'CRITICAL')).toBe(true);
    });
  });

  describe('EnterpriseSecretService Integration', () => {
    it('should initialize complete secret management system', async () => {
      const result = await enterpriseService.initialize();

      expect(result.initialized).toBe(true);
      expect(result.environment).toBe('development');
      expect(result.complianceScore).toBeGreaterThanOrEqual(0);
      expect(result.securityLevel).toBe('BASIC');
    });

    it('should generate required secrets for environment', async () => {
      await enterpriseService.initialize();

      const secrets = await enterpriseService.secretManager.listSecrets();
      const secretIds = secrets.map(s => s.id);

      expect(secretIds).toContain('jwt_secret');
      expect(secretIds).toContain('encryption_key');
      expect(secretIds).toContain('session_secret');
      expect(secretIds).toContain('db_password');
    });

    it('should provide configuration with secrets', async () => {
      await enterpriseService.initialize();

      const config = await enterpriseService.getConfiguration();

      expect(config).toHaveProperty('security');
      expect(config.security).toHaveProperty('jwtSecret');
      expect(config.security).toHaveProperty('encryptionKey');
      expect(config.security.jwtSecret).toBeTruthy();
      expect(config.security.encryptionKey).toBeTruthy();
    });

    it('should export configuration without secrets', async () => {
      await enterpriseService.initialize();

      const exportedConfig = await enterpriseService.exportConfiguration();

      expect(exportedConfig).toHaveProperty('security');
      expect(exportedConfig.security).not.toHaveProperty('jwtSecret');
      expect(exportedConfig.security).not.toHaveProperty('encryptionKey');
      expect(exportedConfig.database).not.toHaveProperty('password');
    });

    it('should provide health status', async () => {
      await enterpriseService.initialize();

      const health = await enterpriseService.getHealthStatus();

      expect(health.isInitialized).toBe(true);
      expect(health.environment).toBe('development');
      expect(health.secretCount).toBeGreaterThan(0);
      expect(health.complianceScore).toBeGreaterThanOrEqual(0);
    });

    it('should handle graceful shutdown', async () => {
      await enterpriseService.initialize();
      await enterpriseService.shutdown();

      expect(enterpriseService.isInitialized).toBe(false);
    });
  });

  describe('Security Compliance Tests', () => {
    it('should meet Fortune 5 encryption standards', async () => {
      await secretManager.init();

      const testSecret = {
        id: 'fortune5_test',
        value: 'sensitive-fortune5-data',
        environment: 'production',
        category: 'encryption',
        rotationInterval: 90,
        lastRotated: this.getDeterministicDate().toISOString(),
        tags: ['fortune5'],
        compliance: { pci: true, hipaa: true, sox: true }
      };

      await secretManager.storeSecret(testSecret);

      // Verify encryption details
      const secretPath = path.join(testDir, 'secrets', 'production', 'fortune5_test.json');
      const encryptedData = await fs.readJson(secretPath);

      expect(encryptedData.value.algorithm).toBe('aes-256-gcm');
      expect(encryptedData.value.encrypted).toBeTruthy();
      expect(encryptedData.value.salt).toBeTruthy();
      expect(encryptedData.value.iv).toBeTruthy();
      expect(encryptedData.value.tag).toBeTruthy();
    });

    it('should enforce production security requirements', () => {
      const productionValidator = new EnvironmentValidator({ strictMode: true });

      const invalidProductionEnv = {
        NODE_ENV: 'production',
        SECRET_ENCRYPTION_KEY: 'short', // Invalid
        CORS_ORIGIN: '*', // Invalid for production
        DB_SSL_ENABLED: 'false', // Invalid for production
        // Missing required fields...
      };

      expect(() => {
        productionValidator.validate(invalidProductionEnv);
      }).toThrow();
    });

    it('should audit secret access', async () => {
      await secretManager.init();

      const secret = {
        id: 'audit_test',
        value: 'audit-value',
        environment: 'development',
        category: 'jwt',
        rotationInterval: 30,
        lastRotated: this.getDeterministicDate().toISOString(),
        tags: [],
        compliance: {}
      };

      await secretManager.storeSecret(secret);
      await secretManager.getSecret('audit_test');

      // Check audit log
      const auditLogPath = path.join(testDir, 'audit.log');
      const auditLog = await fs.readFile(auditLogPath, 'utf8');

      expect(auditLog).toContain('SECRET_STORED');
      expect(auditLog).toContain('SECRET_ACCESSED');
      expect(auditLog).toContain('audit_test');
    });
  });
});

describe('Secret Migration Integration', () => {
  let testDir;

  beforeEach(async () => {
    testDir = path.join(process.cwd(), 'test-migration-' + this.getDeterministicTimestamp());
    await fs.ensureDir(testDir);
  });

  afterEach(async () => {
    await fs.remove(testDir);
  });

  it('should identify secrets from environment variables', async () => {
    const { SecretMigrator } = await import('../../scripts/migrate-secrets.js');
    
    const migrator = new SecretMigrator();
    
    const mockEnvConfig = {
      DB_PASSWORD: 'strong-database-password-123',
      JWT_SECRET: 'jwt-secret-key-value',
      API_TOKEN: 'api-token-value',
      ENCRYPTION_KEY: 'encryption-key-value',
      REGULAR_CONFIG: 'not-a-secret'
    };

    const secrets = migrator.identifySecrets(mockEnvConfig);

    expect(secrets.length).toBeGreaterThan(0);
    expect(secrets.some(s => s.envKey === 'DB_PASSWORD')).toBe(true);
    expect(secrets.some(s => s.envKey === 'JWT_SECRET')).toBe(true);
    expect(secrets.some(s => s.envKey === 'REGULAR_CONFIG')).toBe(false);
  });
});