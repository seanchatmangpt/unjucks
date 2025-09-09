/**
 * Secret Rotation Service
 * Automated secret rotation with scheduling and notification capabilities
 */

import cron from 'node-cron';
import crypto from 'crypto';
import dayjs from 'dayjs';
import consola from 'consola';
import SecretManager from './secret-manager.js';

class SecretRotationService {
  constructor(options = {}) {
    this.secretManager = options.secretManager || new SecretManager();
    this.logger = consola.withTag('SECRET-ROTATION');
    this.isRunning = false;
    this.rotationTasks = new Map();
    this.notificationHandlers = [];
    
    // Default rotation schedules
    this.schedules = {
      // Critical secrets - daily check
      critical: '0 2 * * *', // 2 AM daily
      // High priority - every 8 hours
      high: '0 */8 * * *',
      // Normal priority - daily
      normal: '0 4 * * *', // 4 AM daily
      // Low priority - weekly
      low: '0 6 * * 0' // 6 AM Sunday
    };
    
    this.rotationStrategies = {
      api_key: this.rotateApiKey.bind(this),
      jwt: this.rotateJwtSecret.bind(this),
      database: this.rotateDatabasePassword.bind(this),
      encryption: this.rotateEncryptionKey.bind(this),
      oauth: this.rotateOAuthSecret.bind(this),
      saml: this.rotateSamlCertificate.bind(this)
    };
  }

  /**
   * Start the rotation service
   */
  async start() {
    if (this.isRunning) {
      this.logger.warn('Rotation service is already running');
      return;
    }

    this.logger.info('Starting secret rotation service...');
    
    // Schedule rotation checks
    this.scheduleRotationChecks();
    
    // Schedule emergency rotation monitoring
    this.scheduleEmergencyChecks();
    
    this.isRunning = true;
    
    await this.secretManager.auditLog('ROTATION_SERVICE_STARTED', {
      schedules: Object.keys(this.schedules)
    });
    
    this.logger.success('Secret rotation service started');
  }

  /**
   * Stop the rotation service
   */
  async stop() {
    if (!this.isRunning) {
      this.logger.warn('Rotation service is not running');
      return;
    }

    this.logger.info('Stopping secret rotation service...');
    
    // Stop all scheduled tasks
    for (const [name, task] of this.rotationTasks) {
      task.stop();
      this.logger.info(`Stopped rotation task: ${name}`);
    }
    
    this.rotationTasks.clear();
    this.isRunning = false;
    
    await this.secretManager.auditLog('ROTATION_SERVICE_STOPPED');
    
    this.logger.success('Secret rotation service stopped');
  }

  /**
   * Schedule rotation checks
   */
  scheduleRotationChecks() {
    // Critical secrets check
    this.rotationTasks.set('critical', cron.schedule(this.schedules.critical, async () => {
      await this.checkAndRotateSecrets('critical');
    }, {
      scheduled: false,
      timezone: 'UTC'
    }));

    // High priority check
    this.rotationTasks.set('high', cron.schedule(this.schedules.high, async () => {
      await this.checkAndRotateSecrets('high');
    }, {
      scheduled: false,
      timezone: 'UTC'
    }));

    // Normal priority check
    this.rotationTasks.set('normal', cron.schedule(this.schedules.normal, async () => {
      await this.checkAndRotateSecrets('normal');
    }, {
      scheduled: false,
      timezone: 'UTC'
    }));

    // Low priority check
    this.rotationTasks.set('low', cron.schedule(this.schedules.low, async () => {
      await this.checkAndRotateSecrets('low');
    }, {
      scheduled: false,
      timezone: 'UTC'
    }));

    // Start all tasks
    for (const [name, task] of this.rotationTasks) {
      task.start();
      this.logger.info(`Scheduled rotation check: ${name} (${this.schedules[name]})`);
    }
  }

  /**
   * Schedule emergency rotation monitoring
   */
  scheduleEmergencyChecks() {
    // Check for critically overdue secrets every hour
    this.rotationTasks.set('emergency', cron.schedule('0 * * * *', async () => {
      await this.checkEmergencyRotation();
    }, {
      scheduled: true,
      timezone: 'UTC'
    }));
  }

  /**
   * Check and rotate secrets based on priority
   */
  async checkAndRotateSecrets(priority = 'normal') {
    try {
      this.logger.info(`Checking ${priority} priority secrets for rotation...`);
      
      const needsRotation = await this.secretManager.checkRotationNeeded();
      const prioritySecrets = this.filterSecretsByPriority(needsRotation, priority);
      
      if (prioritySecrets.length === 0) {
        this.logger.info(`No ${priority} priority secrets need rotation`);
        return;
      }
      
      this.logger.info(`Found ${prioritySecrets.length} ${priority} priority secrets needing rotation`);
      
      const results = [];
      
      for (const secret of prioritySecrets) {
        try {
          const result = await this.rotateSecret(secret.id, secret.category);
          results.push({ secretId: secret.id, status: 'success', ...result });
          
          // Send notification
          await this.sendNotification('rotation_success', {
            secretId: secret.id,
            category: secret.category,
            priority,
            overdueDays: secret.overdueDays
          });
          
        } catch (error) {
          this.logger.error(`Failed to rotate secret ${secret.id}:`, error);
          results.push({ secretId: secret.id, status: 'failed', error: error.message });
          
          // Send failure notification
          await this.sendNotification('rotation_failed', {
            secretId: secret.id,
            category: secret.category,
            priority,
            error: error.message
          });
        }
      }
      
      await this.secretManager.auditLog('ROTATION_BATCH_COMPLETED', {
        priority,
        totalSecrets: prioritySecrets.length,
        successful: results.filter(r => r.status === 'success').length,
        failed: results.filter(r => r.status === 'failed').length,
        results
      });
      
    } catch (error) {
      this.logger.error(`Rotation check failed for ${priority} priority:`, error);
      
      await this.sendNotification('rotation_check_failed', {
        priority,
        error: error.message
      });
    }
  }

  /**
   * Check for emergency rotation (critically overdue secrets)
   */
  async checkEmergencyRotation() {
    try {
      const needsRotation = await this.secretManager.checkRotationNeeded();
      const criticallyOverdue = needsRotation.filter(secret => secret.overdueDays > 30); // 30+ days overdue
      
      if (criticallyOverdue.length > 0) {
        this.logger.error(`EMERGENCY: ${criticallyOverdue.length} secrets are critically overdue for rotation`);
        
        await this.sendNotification('emergency_rotation_needed', {
          count: criticallyOverdue.length,
          secrets: criticallyOverdue.map(s => ({
            id: s.id,
            category: s.category,
            overdueDays: s.overdueDays
          }))
        });
        
        // Auto-rotate critical secrets if configured
        if (process.env.AUTO_ROTATE_CRITICAL === 'true') {
          for (const secret of criticallyOverdue) {
            await this.rotateSecret(secret.id, secret.category);
          }
        }
      }
      
    } catch (error) {
      this.logger.error('Emergency rotation check failed:', error);
    }
  }

  /**
   * Filter secrets by priority based on category and overdue status
   */
  filterSecretsByPriority(secrets, priority) {
    const priorityMap = {
      critical: ['jwt', 'encryption', 'database'],
      high: ['api_key', 'oauth', 'saml'],
      normal: ['ldap', 'session'],
      low: ['monitoring', 'logging']
    };
    
    const categories = priorityMap[priority] || [];
    
    return secrets.filter(secret => {
      // Include if category matches priority
      if (categories.includes(secret.category)) {
        return true;
      }
      
      // Include if severely overdue regardless of category
      if (priority === 'critical' && secret.overdueDays > 7) {
        return true;
      }
      
      return false;
    });
  }

  /**
   * Rotate a specific secret
   */
  async rotateSecret(secretId, category) {
    this.logger.info(`Rotating secret: ${secretId} (${category})`);
    
    const strategy = this.rotationStrategies[category];
    if (!strategy) {
      throw new Error(`No rotation strategy found for category: ${category}`);
    }
    
    const newValue = await strategy(secretId);
    const rotatedSecret = await this.secretManager.rotateSecret(secretId, newValue);
    
    this.logger.success(`Successfully rotated secret: ${secretId}`);
    
    return {
      newValue: '[REDACTED]',
      rotatedAt: rotatedSecret.lastRotated,
      expiresAt: rotatedSecret.expiresAt
    };
  }

  /**
   * Generate new API key
   */
  async rotateApiKey(secretId) {
    // Generate cryptographically secure API key
    const prefix = secretId.includes('test') ? 'test_' : 'live_';
    const keyData = crypto.randomBytes(32).toString('hex');
    return `${prefix}${keyData}`;
  }

  /**
   * Generate new JWT secret
   */
  async rotateJwtSecret(secretId) {
    // Generate strong JWT secret
    return crypto.randomBytes(64).toString('hex');
  }

  /**
   * Generate new database password
   */
  async rotateDatabasePassword(secretId) {
    // Generate strong database password with mixed characters
    const length = 32;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
    let password = '';
    
    // Ensure at least one character from each category
    const categories = [
      'abcdefghijklmnopqrstuvwxyz',
      'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      '0123456789',
      '!@#$%^&*()_+-=[]{}|;:,.<>?'
    ];
    
    // Add one character from each category
    for (const category of categories) {
      const randomIndex = crypto.randomInt(0, category.length);
      password += category[randomIndex];
    }
    
    // Fill remaining length with random characters
    for (let i = password.length; i < length; i++) {
      const randomIndex = crypto.randomInt(0, charset.length);
      password += charset[randomIndex];
    }
    
    // Shuffle the password
    return password.split('').sort(() => crypto.randomInt(0, 3) - 1).join('');
  }

  /**
   * Generate new encryption key
   */
  async rotateEncryptionKey(secretId) {
    // Generate new encryption key
    return crypto.randomBytes(64).toString('hex');
  }

  /**
   * Generate new OAuth secret
   */
  async rotateOAuthSecret(secretId) {
    // Generate OAuth client secret
    return crypto.randomBytes(48).toString('base64url');
  }

  /**
   * Generate new SAML certificate
   */
  async rotateSamlCertificate(secretId) {
    // For SAML certificates, this would typically involve:
    // 1. Generating new private key
    // 2. Creating new certificate
    // 3. Updating IdP configuration
    // For now, return a placeholder that indicates manual rotation needed
    
    this.logger.warn(`SAML certificate rotation for ${secretId} requires manual intervention`);
    
    await this.sendNotification('manual_rotation_required', {
      secretId,
      category: 'saml',
      reason: 'SAML certificate rotation requires manual key generation and IdP coordination'
    });
    
    throw new Error('SAML certificate rotation requires manual intervention');
  }

  /**
   * Add notification handler
   */
  addNotificationHandler(handler) {
    this.notificationHandlers.push(handler);
  }

  /**
   * Send notification
   */
  async sendNotification(type, data) {
    const notification = {
      type,
      timestamp: new Date().toISOString(),
      environment: this.secretManager.environment,
      data
    };
    
    for (const handler of this.notificationHandlers) {
      try {
        await handler(notification);
      } catch (error) {
        this.logger.error('Notification handler failed:', error);
      }
    }
    
    await this.secretManager.auditLog('NOTIFICATION_SENT', notification);
  }

  /**
   * Force rotate specific secret
   */
  async forceRotate(secretId) {
    const secret = await this.secretManager.getSecret(secretId);
    await this.rotateSecret(secretId, secret.category);
    
    await this.sendNotification('force_rotation_completed', {
      secretId,
      category: secret.category
    });
  }

  /**
   * Get rotation status
   */
  async getRotationStatus() {
    const needsRotation = await this.secretManager.checkRotationNeeded();
    const allSecrets = await this.secretManager.listSecrets();
    
    const statusByCategory = {};
    for (const secret of allSecrets) {
      if (!statusByCategory[secret.category]) {
        statusByCategory[secret.category] = {
          total: 0,
          needsRotation: 0,
          overdue: 0
        };
      }
      
      statusByCategory[secret.category].total++;
      
      const needsRotationSecret = needsRotation.find(s => s.id === secret.id);
      if (needsRotationSecret) {
        statusByCategory[secret.category].needsRotation++;
        if (needsRotationSecret.overdueDays > 0) {
          statusByCategory[secret.category].overdue++;
        }
      }
    }
    
    return {
      isRunning: this.isRunning,
      totalSecrets: allSecrets.length,
      needsRotation: needsRotation.length,
      criticallyOverdue: needsRotation.filter(s => s.overdueDays > 30).length,
      statusByCategory,
      nextScheduledCheck: this.getNextScheduledCheck(),
      rotationTasks: Array.from(this.rotationTasks.keys())
    };
  }

  /**
   * Get next scheduled check time
   */
  getNextScheduledCheck() {
    // Calculate next run time for each schedule
    const nextRuns = {};
    
    for (const [name, schedule] of Object.entries(this.schedules)) {
      try {
        // Parse cron expression to get next run time
        // This is a simplified calculation - in production use a proper cron parser
        nextRuns[name] = 'Next calculation requires cron parser library';
      } catch (error) {
        nextRuns[name] = 'Invalid schedule';
      }
    }
    
    return nextRuns;
  }

  /**
   * Update rotation schedule
   */
  updateSchedule(priority, cronExpression) {
    if (!cron.validate(cronExpression)) {
      throw new Error(`Invalid cron expression: ${cronExpression}`);
    }
    
    // Stop existing task
    if (this.rotationTasks.has(priority)) {
      this.rotationTasks.get(priority).stop();
    }
    
    // Create new task
    const task = cron.schedule(cronExpression, async () => {
      await this.checkAndRotateSecrets(priority);
    }, {
      scheduled: this.isRunning,
      timezone: 'UTC'
    });
    
    this.rotationTasks.set(priority, task);
    this.schedules[priority] = cronExpression;
    
    this.logger.info(`Updated rotation schedule for ${priority}: ${cronExpression}`);
  }
}

export default SecretRotationService;