/**
 * Enterprise Secret Management System - Main Export
 * Provides unified interface for Fortune 5 compliant secret management
 */

import SecretManager from './secret-manager.js';
import EnvironmentValidator from './environment-validator.js';
import SecretRotationService from './secret-rotation.js';
import ConfigManager from './config-manager.js';
import ComplianceAuditor from './compliance-auditor.js';
import crypto from 'crypto';
import consola from 'consola';

/**
 * Enterprise Secret Management Service
 * Orchestrates all secret management components for Fortune 5 compliance
 */
class EnterpriseSecretService {
  constructor(options = {}) {
    this.environment = options.environment || process.env.NODE_ENV || 'development';
    this.logger = consola.withTag('ENTERPRISE-SECRETS');
    
    // Initialize components
    this.secretManager = new SecretManager(options.secretManager);
    this.validator = new EnvironmentValidator(options.validator);
    this.configManager = new ConfigManager({
      ...options.configManager,
      secretManager: this.secretManager,
      validator: this.validator
    });
    this.rotationService = new SecretRotationService({
      ...options.rotationService,
      secretManager: this.secretManager
    });
    this.complianceAuditor = new ComplianceAuditor({
      ...options.complianceAuditor,
      environment: this.environment
    });
    
    this.isInitialized = false;
    this.healthStatus = {
      secretManager: false,
      configManager: false,
      rotationService: false,
      complianceAuditor: false,
      lastHealthCheck: null
    };
  }

  /**
   * Initialize the entire secret management system
   */
  async initialize() {
    if (this.isInitialized) {
      this.logger.warn('Enterprise Secret Service already initialized');
      return;
    }

    this.logger.info('Initializing Enterprise Secret Management System...');
    
    try {
      // Step 1: Validate environment
      this.logger.info('Step 1: Validating environment configuration...');
      const envValidation = this.validator.validate();
      if (!envValidation.isValid) {
        throw new Error(`Environment validation failed: ${envValidation.error}`);
      }
      this.logger.success(`Environment validated (${envValidation.securityLevel} security level)`);

      // Step 2: Initialize secret manager
      this.logger.info('Step 2: Initializing secret manager...');
      await this.secretManager.init();
      this.healthStatus.secretManager = true;

      // Step 3: Initialize configuration manager
      this.logger.info('Step 3: Initializing configuration manager...');
      await this.configManager.init();
      this.healthStatus.configManager = true;

      // Step 4: Initialize compliance auditor
      this.logger.info('Step 4: Initializing compliance auditor...');
      await this.complianceAuditor.init();
      this.healthStatus.complianceAuditor = true;

      // Step 5: Setup secret rotation (but don't start yet)
      this.logger.info('Step 5: Setting up secret rotation service...');
      // Add notification handlers for rotation events
      this.rotationService.addNotificationHandler(this.handleRotationNotification.bind(this));
      this.healthStatus.rotationService = true;

      // Step 6: Perform initial compliance audit
      this.logger.info('Step 6: Running initial compliance audit...');
      const auditResults = await this.complianceAuditor.runFullAudit(this.secretManager, this.configManager);
      
      if (auditResults.overallScore < 70) {
        this.logger.warn(`Compliance score ${auditResults.overallScore}% is below recommended threshold`);
      }

      // Step 7: Generate missing secrets for environment
      this.logger.info('Step 7: Checking and generating required secrets...');
      await this.ensureRequiredSecrets();

      this.isInitialized = true;
      this.healthStatus.lastHealthCheck = new Date().toISOString();
      
      this.logger.success(`Enterprise Secret Management System initialized successfully`);
      this.logger.info(`Compliance Score: ${auditResults.overallScore}%`);
      
      return {
        initialized: true,
        complianceScore: auditResults.overallScore,
        environment: this.environment,
        securityLevel: envValidation.securityLevel
      };

    } catch (error) {
      this.logger.error('Failed to initialize Enterprise Secret Management System:', error);
      throw error;
    }
  }

  /**
   * Start secret rotation service
   */
  async startRotationService() {
    if (!this.isInitialized) {
      throw new Error('System must be initialized before starting rotation service');
    }

    await this.rotationService.start();
    this.logger.info('Secret rotation service started');
  }

  /**
   * Stop secret rotation service
   */
  async stopRotationService() {
    await this.rotationService.stop();
    this.logger.info('Secret rotation service stopped');
  }

  /**
   * Ensure all required secrets exist for the current environment
   */
  async ensureRequiredSecrets() {
    const requiredSecrets = this.getRequiredSecretsForEnvironment();
    const existingSecrets = await this.secretManager.listSecrets();
    const existingIds = existingSecrets.map(s => s.id);

    for (const secretConfig of requiredSecrets) {
      if (!existingIds.includes(secretConfig.id)) {
        this.logger.info(`Generating missing secret: ${secretConfig.id}`);
        
        const secretValue = this.generateSecretValue(secretConfig.category, secretConfig.strength);
        
        await this.secretManager.storeSecret({
          ...secretConfig,
          value: secretValue,
          lastRotated: new Date().toISOString()
        });
        
        this.logger.success(`Generated secret: ${secretConfig.id}`);
      }
    }
  }

  /**
   * Get required secrets configuration for current environment
   */
  getRequiredSecretsForEnvironment() {
    const baseSecrets = [
      {
        id: 'jwt_secret',
        category: 'jwt',
        environment: this.environment,
        rotationInterval: this.environment === 'production' ? 30 : 90,
        tags: ['authentication', 'required'],
        compliance: { pci: true, sox: true },
        strength: this.environment === 'production' ? 'maximum' : 'high'
      },
      {
        id: 'encryption_key',
        category: 'encryption',
        environment: this.environment,
        rotationInterval: this.environment === 'production' ? 90 : 180,
        tags: ['encryption', 'required'],
        compliance: { pci: true, hipaa: true, sox: true },
        strength: 'maximum'
      },
      {
        id: 'session_secret',
        category: 'encryption',
        environment: this.environment,
        rotationInterval: 60,
        tags: ['session', 'required'],
        compliance: { pci: true },
        strength: 'high'
      },
      {
        id: 'db_password',
        category: 'database',
        environment: this.environment,
        rotationInterval: this.environment === 'production' ? 60 : 120,
        tags: ['database', 'required'],
        compliance: { pci: true, hipaa: true, sox: true },
        strength: 'maximum'
      }
    ];

    // Add environment-specific secrets
    if (this.environment === 'production') {
      baseSecrets.push(
        {
          id: 'api_signing_key',
          category: 'api_key',
          environment: this.environment,
          rotationInterval: 30,
          tags: ['api', 'signing', 'critical'],
          compliance: { pci: true, sox: true },
          strength: 'maximum'
        },
        {
          id: 'backup_encryption_key',
          category: 'encryption',
          environment: this.environment,
          rotationInterval: 180,
          tags: ['backup', 'encryption'],
          compliance: { hipaa: true, sox: true },
          strength: 'maximum'
        }
      );
    }

    return baseSecrets;
  }

  /**
   * Generate secret value based on category and strength
   */
  generateSecretValue(category, strength = 'high') {
    const strengthConfig = {
      basic: { length: 32, complexity: 'alphanumeric' },
      high: { length: 64, complexity: 'mixed' },
      maximum: { length: 128, complexity: 'full' }
    };

    const config = strengthConfig[strength] || strengthConfig.high;

    switch (category) {
      case 'jwt':
      case 'encryption':
        return crypto.randomBytes(config.length / 2).toString('hex');
      
      case 'database':
        return this.generateComplexPassword(config.length);
      
      case 'api_key':
        const prefix = this.environment === 'production' ? 'live_' : 'test_';
        return prefix + crypto.randomBytes((config.length - prefix.length) / 2).toString('hex');
      
      default:
        return crypto.randomBytes(config.length / 2).toString('hex');
    }
  }

  /**
   * Generate complex password for database access
   */
  generateComplexPassword(length = 32) {
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    
    const categories = [lowercase, uppercase, numbers, symbols];
    let password = '';
    
    // Ensure at least one character from each category
    for (const category of categories) {
      password += category[crypto.randomInt(0, category.length)];
    }
    
    // Fill remaining length
    const allChars = lowercase + uppercase + numbers + symbols;
    for (let i = password.length; i < length; i++) {
      password += allChars[crypto.randomInt(0, allChars.length)];
    }
    
    // Shuffle password
    return password.split('').sort(() => crypto.randomInt(0, 3) - 1).join('');
  }

  /**
   * Handle rotation notifications
   */
  async handleRotationNotification(notification) {
    this.logger.info(`Rotation notification: ${notification.type}`, notification.data);
    
    // For critical notifications, run compliance audit
    if (notification.type === 'emergency_rotation_needed' || notification.type === 'rotation_failed') {
      this.logger.warn('Running emergency compliance audit due to rotation issue');
      await this.complianceAuditor.runFullAudit(this.secretManager, this.configManager);
    }
  }

  /**
   * Get system health status
   */
  async getHealthStatus() {
    const status = {
      ...this.healthStatus,
      lastHealthCheck: new Date().toISOString(),
      isInitialized: this.isInitialized,
      environment: this.environment
    };

    if (this.isInitialized) {
      try {
        // Check secret manager
        const secrets = await this.secretManager.listSecrets();
        status.secretCount = secrets.length;
        
        // Check rotation status
        const rotationStatus = await this.rotationService.getRotationStatus();
        status.rotationService = rotationStatus.isRunning;
        status.secretsNeedingRotation = rotationStatus.needsRotation;
        
        // Check compliance score
        const auditResults = await this.complianceAuditor.runFullAudit(this.secretManager, this.configManager);
        status.complianceScore = auditResults.overallScore;
        status.criticalIssues = auditResults.criticalIssues.length;
        
      } catch (error) {
        status.healthCheckError = error.message;
      }
    }

    return status;
  }

  /**
   * Get compliance report
   */
  async getComplianceReport() {
    if (!this.isInitialized) {
      throw new Error('System must be initialized to generate compliance report');
    }

    return await this.complianceAuditor.runFullAudit(this.secretManager, this.configManager);
  }

  /**
   * Force secret rotation
   */
  async rotateSecret(secretId) {
    if (!this.isInitialized) {
      throw new Error('System must be initialized to rotate secrets');
    }

    return await this.rotationService.forceRotate(secretId);
  }

  /**
   * Get configuration with secrets
   */
  async getConfiguration() {
    if (!this.isInitialized) {
      throw new Error('System must be initialized to get configuration');
    }

    return await this.configManager.loadConfig();
  }

  /**
   * Export configuration without secrets (for deployment)
   */
  async exportConfiguration() {
    if (!this.isInitialized) {
      throw new Error('System must be initialized to export configuration');
    }

    return await this.configManager.exportConfig(false);
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    this.logger.info('Shutting down Enterprise Secret Management System...');
    
    if (this.rotationService) {
      await this.rotationService.stop();
    }
    
    if (this.configManager) {
      await this.configManager.stopWatching();
    }
    
    this.isInitialized = false;
    this.logger.success('Enterprise Secret Management System shut down successfully');
  }
}

// Export all components
export {
  SecretManager,
  EnvironmentValidator,
  SecretRotationService,
  ConfigManager,
  ComplianceAuditor,
  EnterpriseSecretService
};

export default EnterpriseSecretService;