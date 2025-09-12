#!/usr/bin/env node

/**
 * Secret Migration Script
 * Migrates hardcoded secrets from .env to encrypted secret management system
 */

import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';
import consola from 'consola';
import { EnterpriseSecretService } from '../src/security/secrets/index.js';

const logger = consola.withTag('SECRET-MIGRATION');

class SecretMigrator {
  constructor() {
    this.environment = process.env.NODE_ENV || 'development';
    this.envPath = '.env';
    this.backupPath = `.env.backup.${this.getDeterministicTimestamp()}`;
    this.secretService = new EnterpriseSecretService({
      environment: this.environment
    });
  }

  async migrate() {
    logger.info('Starting secret migration process...');
    
    try {
      // Step 1: Initialize secret management system
      logger.info('Initializing Enterprise Secret Management System...');
      await this.secretService.initialize();

      // Step 2: Parse current .env file
      logger.info('Parsing current environment configuration...');
      const envConfig = await this.parseEnvFile();

      // Step 3: Identify secrets to migrate
      logger.info('Identifying secrets for migration...');
      const secretsToMigrate = this.identifySecrets(envConfig);

      if (secretsToMigrate.length === 0) {
        logger.info('No secrets found to migrate');
        return;
      }

      logger.info(`Found ${secretsToMigrate.length} secrets to migrate`);

      // Step 4: Create backup
      logger.info('Creating backup of current .env file...');
      await this.createBackup();

      // Step 5: Migrate secrets
      logger.info('Migrating secrets to encrypted storage...');
      const migrationResults = await this.migrateSecrets(secretsToMigrate);

      // Step 6: Update .env file
      logger.info('Updating .env file with secret manager references...');
      await this.updateEnvFile(envConfig, secretsToMigrate);

      // Step 7: Generate migration report
      logger.info('Generating migration report...');
      await this.generateMigrationReport(migrationResults);

      // Step 8: Run compliance audit
      logger.info('Running post-migration compliance audit...');
      const auditResults = await this.secretService.getComplianceReport();

      logger.success('Secret migration completed successfully!');
      logger.info(`Compliance score: ${auditResults.overallScore}%`);
      logger.info(`Backup created: ${this.backupPath}`);

    } catch (error) {
      logger.error('Secret migration failed:', error);
      
      // Restore backup if it exists
      if (await fs.pathExists(this.backupPath)) {
        logger.info('Restoring backup...');
        await fs.copy(this.backupPath, this.envPath);
        logger.info('Backup restored');
      }
      
      throw error;
    }
  }

  async parseEnvFile() {
    if (!await fs.pathExists(this.envPath)) {
      throw new Error('.env file not found');
    }

    const envContent = await fs.readFile(this.envPath, 'utf8');
    const envConfig = {};

    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      
      // Skip comments and empty lines
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        envConfig[key.trim()] = valueParts.join('=').trim();
      }
    }

    return envConfig;
  }

  identifySecrets(envConfig) {
    const secretPatterns = [
      { pattern: /password/i, category: 'database' },
      { pattern: /secret/i, category: 'encryption' },
      { pattern: /key$/i, category: 'encryption' },
      { pattern: /token/i, category: 'api_key' },
      { pattern: /jwt/i, category: 'jwt' },
      { pattern: /private_key/i, category: 'encryption' },
      { pattern: /cert/i, category: 'saml' },
      { pattern: /credentials/i, category: 'ldap' },
      { pattern: /oauth.*secret/i, category: 'oauth' }
    ];

    const secrets = [];

    for (const [key, value] of Object.entries(envConfig)) {
      // Skip if value looks like a placeholder
      if (value.includes('CHANGE_ME') || 
          value.includes('your-') || 
          value.includes('MANAGED_BY_SECRET_MANAGER') ||
          value.length < 8) {
        continue;
      }

      // Check if key matches secret patterns
      for (const { pattern, category } of secretPatterns) {
        if (pattern.test(key)) {
          secrets.push({
            envKey: key,
            secretId: this.generateSecretId(key),
            value,
            category,
            rotationInterval: this.getRotationInterval(category),
            tags: [category, 'migrated'],
            compliance: this.getComplianceFlags(category)
          });
          break;
        }
      }
    }

    return secrets;
  }

  generateSecretId(envKey) {
    return envKey.toLowerCase()
      .replace(/_/g, '_')
      .replace(/^(oauth_|saml_|ldap_)/, '')
      .replace(/_secret$/, '_secret')
      .replace(/_key$/, '_key')
      .replace(/_password$/, '_password');
  }

  getRotationInterval(category) {
    const intervals = {
      database: 60,
      jwt: 30,
      encryption: 90,
      api_key: 60,
      oauth: 90,
      saml: 180,
      ldap: 120
    };

    return intervals[category] || 90;
  }

  getComplianceFlags(category) {
    const complianceMap = {
      database: { pci: true, hipaa: true, sox: true },
      jwt: { pci: true, sox: true },
      encryption: { pci: true, hipaa: true, sox: true, gdpr: true },
      api_key: { pci: true },
      oauth: { gdpr: true },
      saml: { sox: true },
      ldap: { sox: true }
    };

    return complianceMap[category] || {};
  }

  async createBackup() {
    await fs.copy(this.envPath, this.backupPath);
    logger.info(`Backup created: ${this.backupPath}`);
  }

  async migrateSecrets(secrets) {
    const results = [];

    for (const secret of secrets) {
      try {
        const secretData = {
          id: secret.secretId,
          value: secret.value,
          environment: this.environment,
          category: secret.category,
          rotationInterval: secret.rotationInterval,
          lastRotated: this.getDeterministicDate().toISOString(),
          tags: secret.tags,
          compliance: secret.compliance
        };

        await this.secretService.secretManager.storeSecret(secretData);
        
        results.push({
          envKey: secret.envKey,
          secretId: secret.secretId,
          status: 'success',
          category: secret.category
        });

        logger.success(`Migrated: ${secret.envKey} -> ${secret.secretId}`);

      } catch (error) {
        logger.error(`Failed to migrate ${secret.envKey}:`, error);
        
        results.push({
          envKey: secret.envKey,
          secretId: secret.secretId,
          status: 'failed',
          error: error.message
        });
      }
    }

    return results;
  }

  async updateEnvFile(envConfig, secrets) {
    const envContent = await fs.readFile(this.envPath, 'utf8');
    let updatedContent = envContent;

    // Add header comment about secret management
    const header = `# ENTERPRISE SECRET MANAGEMENT SYSTEM
# Secrets have been migrated to encrypted storage
# Use EnterpriseSecretService to access secrets programmatically
# 
# Migration completed: ${this.getDeterministicDate().toISOString()}
# Environment: ${this.environment}
#
# To access secrets in your application:
# import { EnterpriseSecretService } from './src/security/secrets/index.js';
# const secretService = new EnterpriseSecretService();
# await secretService.initialize();
# const config = await secretService.getConfiguration();
#
# IMPORTANT: Set SECRET_ENCRYPTION_KEY environment variable for secret decryption
#

`;

    updatedContent = header + updatedContent;

    // Replace migrated secrets with comments
    for (const secret of secrets) {
      const oldLine = new RegExp(`^${secret.envKey}=.*$`, 'gm');
      const newLine = `# ${secret.envKey}=MIGRATED_TO_SECRET_MANAGER:${secret.secretId}`;
      updatedContent = updatedContent.replace(oldLine, newLine);
    }

    // Add secret manager configuration
    const secretManagerConfig = `
# SECRET MANAGER CONFIGURATION
SECRET_ENCRYPTION_KEY=${crypto.randomBytes(64).toString('hex')}
SECRET_STORE_PATH=./config/secrets
AUDIT_LOG_ENABLED=true
ROTATION_CHECK_INTERVAL=86400

`;

    updatedContent += secretManagerConfig;

    await fs.writeFile(this.envPath, updatedContent);
    logger.success('Updated .env file with secret manager references');
  }

  async generateMigrationReport(results) {
    const reportPath = `./config/secret-migration-report-${this.getDeterministicTimestamp()}.json`;
    
    const report = {
      migrationId: crypto.randomUUID(),
      timestamp: this.getDeterministicDate().toISOString(),
      environment: this.environment,
      totalSecrets: results.length,
      successfulMigrations: results.filter(r => r.status === 'success').length,
      failedMigrations: results.filter(r => r.status === 'failed').length,
      results,
      recommendations: this.generateRecommendations(results),
      nextSteps: [
        'Set SECRET_ENCRYPTION_KEY in production environment',
        'Update application code to use EnterpriseSecretService',
        'Schedule regular compliance audits',
        'Configure secret rotation service',
        'Test secret access in all environments',
        'Remove backup file after validation'
      ]
    };

    await fs.writeJson(reportPath, report, { spaces: 2 });
    logger.info(`Migration report saved: ${reportPath}`);

    return report;
  }

  generateRecommendations(results) {
    const recommendations = [];

    const failedMigrations = results.filter(r => r.status === 'failed');
    if (failedMigrations.length > 0) {
      recommendations.push({
        priority: 'high',
        title: 'Address failed migrations',
        description: `${failedMigrations.length} secrets failed to migrate. Review errors and re-run migration.`
      });
    }

    if (this.environment === 'production') {
      recommendations.push({
        priority: 'critical',
        title: 'Production secret security',
        description: 'Ensure SECRET_ENCRYPTION_KEY is stored securely and backed up in production.'
      });
    }

    recommendations.push({
      priority: 'medium',
      title: 'Start secret rotation service',
      description: 'Configure and start the secret rotation service for automated secret management.'
    });

    recommendations.push({
      priority: 'low',
      title: 'Application integration',
      description: 'Update application code to use EnterpriseSecretService instead of process.env for secrets.'
    });

    return recommendations;
  }
}

// CLI interface
async function main() {
  const migrator = new SecretMigrator();
  
  try {
    await migrator.migrate();
    process.exit(0);
  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default SecretMigrator;