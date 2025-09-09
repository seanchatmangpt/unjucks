#!/usr/bin/env node

/**
 * Automated Rollback System
 * Handles automated rollback procedures for failed deployments
 */

import { execSync } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';

class RollbackAutomation {
  constructor(options = {}) {
    this.dryRun = options.dryRun || false;
    this.environment = options.environment || process.env.NODE_ENV || 'staging';
    this.maxRollbackAttempts = 3;
    this.rollbackConfig = {
      timestamp: new Date().toISOString(),
      environment: this.environment,
      steps: [],
      errors: [],
      success: false
    };
  }

  log(level, message, details = null) {
    const timestamp = new Date().toISOString();
    const logEntry = { timestamp, level, message, details };
    
    console.log(
      level === 'error' ? chalk.red(`❌ ${message}`) :
      level === 'warning' ? chalk.yellow(`⚠️  ${message}`) :
      level === 'success' ? chalk.green(`✅ ${message}`) :
      chalk.blue(`ℹ️  ${message}`)
    );
    
    this.rollbackConfig.steps.push(logEntry);
    
    if (level === 'error') {
      this.rollbackConfig.errors.push(logEntry);
    }
  }

  async executeCommand(command, description) {
    this.log('info', `${description}...`);
    
    if (this.dryRun) {
      this.log('info', `[DRY RUN] Would execute: ${command}`);
      return true;
    }
    
    try {
      const result = execSync(command, { 
        encoding: 'utf8', 
        stdio: 'pipe',
        timeout: 60000 // 1 minute timeout
      });
      
      this.log('success', `${description} completed`);
      return true;
    } catch (error) {
      this.log('error', `${description} failed`, error.message);
      return false;
    }
  }

  async saveRollbackState() {
    this.log('info', 'Saving current deployment state for rollback...');
    
    const stateDir = '.deployment-state';
    await fs.ensureDir(stateDir);
    
    const state = {
      timestamp: new Date().toISOString(),
      environment: this.environment,
      commit: this.getCurrentCommit(),
      version: await this.getCurrentVersion(),
      deploymentId: process.env.DEPLOYMENT_ID || `deploy-${Date.now()}`,
      files: await this.captureFileState(),
      config: await this.captureConfigState()
    };
    
    const statePath = path.join(stateDir, `rollback-state-${Date.now()}.json`);
    
    if (!this.dryRun) {
      await fs.writeJson(statePath, state, { spaces: 2 });
    }
    
    this.log('success', `Rollback state saved: ${statePath}`);
    return statePath;
  }

  async restoreFromState(statePath) {
    this.log('info', `Restoring from state: ${statePath}`);
    
    if (!await fs.pathExists(statePath)) {
      this.log('error', `State file not found: ${statePath}`);
      return false;
    }
    
    const state = await fs.readJson(statePath);
    
    // Restore git commit
    if (state.commit) {
      const success = await this.executeCommand(
        `git checkout ${state.commit}`,
        'Restoring git commit'
      );
      if (!success) return false;
    }
    
    // Restore package version
    if (state.version) {
      const success = await this.executeCommand(
        `npm version ${state.version} --no-git-tag-version`,
        'Restoring package version'
      );
      if (!success) return false;
    }
    
    // Restore configuration files
    if (state.config) {
      for (const [file, content] of Object.entries(state.config)) {
        if (!this.dryRun) {
          await fs.writeFile(file, content);
        }
        this.log('info', `Restored config file: ${file}`);
      }
    }
    
    return true;
  }

  async getCurrentCommit() {
    try {
      return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
    } catch (error) {
      return null;
    }
  }

  async getCurrentVersion() {
    try {
      const packageJson = await fs.readJson('package.json');
      return packageJson.version;
    } catch (error) {
      return null;
    }
  }

  async captureFileState() {
    const importantFiles = [
      'package.json',
      'package-lock.json',
      '.env',
      'config.json'
    ];
    
    const fileState = {};
    
    for (const file of importantFiles) {
      if (await fs.pathExists(file)) {
        fileState[file] = await fs.readFile(file, 'utf8');
      }
    }
    
    return fileState;
  }

  async captureConfigState() {
    const configFiles = [
      'config/production.json',
      'config/staging.json',
      '.env.production',
      '.env.staging'
    ];
    
    const configState = {};
    
    for (const file of configFiles) {
      if (await fs.pathExists(file)) {
        configState[file] = await fs.readFile(file, 'utf8');
      }
    }
    
    return configState;
  }

  async rollbackDatabase() {
    this.log('info', 'Rolling back database changes...');
    
    // Check if there are any pending migrations to rollback
    try {
      const migrationStatus = execSync('npm run db:migration:status', { 
        encoding: 'utf8',
        stdio: 'pipe'
      });
      
      if (migrationStatus.includes('pending')) {
        const success = await this.executeCommand(
          'npm run db:migration:rollback',
          'Rolling back database migrations'
        );
        return success;
      } else {
        this.log('info', 'No database migrations to rollback');
        return true;
      }
    } catch (error) {
      this.log('warning', 'Database rollback not available or failed', error.message);
      return true; // Don't fail rollback if DB rollback is not available
    }
  }

  async rollbackFileSystem() {
    this.log('info', 'Rolling back file system changes...');
    
    // Find the most recent rollback state
    const stateDir = '.deployment-state';
    
    if (!await fs.pathExists(stateDir)) {
      this.log('warning', 'No deployment state found for rollback');
      return false;
    }
    
    const stateFiles = await fs.readdir(stateDir);
    const rollbackFiles = stateFiles
      .filter(f => f.startsWith('rollback-state-'))
      .sort()
      .reverse();
    
    if (rollbackFiles.length === 0) {
      this.log('warning', 'No rollback state files found');
      return false;
    }
    
    const latestState = path.join(stateDir, rollbackFiles[0]);
    return await this.restoreFromState(latestState);
  }

  async rollbackApplication() {
    this.log('info', 'Rolling back application deployment...');
    
    // Stop current application
    const stopSuccess = await this.executeCommand(
      'npm run stop',
      'Stopping current application'
    );
    
    // Restore previous version
    const restoreSuccess = await this.rollbackFileSystem();
    
    if (!restoreSuccess) {
      this.log('error', 'Failed to restore file system state');
      return false;
    }
    
    // Reinstall dependencies
    const installSuccess = await this.executeCommand(
      'npm ci --production',
      'Installing dependencies'
    );
    
    if (!installSuccess) {
      this.log('error', 'Failed to install dependencies');
      return false;
    }
    
    // Rebuild application
    const buildSuccess = await this.executeCommand(
      'npm run build',
      'Building application'
    );
    
    if (!buildSuccess) {
      this.log('error', 'Failed to build application');
      return false;
    }
    
    // Start application
    const startSuccess = await this.executeCommand(
      'npm run start',
      'Starting rolled back application'
    );
    
    return startSuccess;
  }

  async rollbackLoadBalancer() {
    this.log('info', 'Rolling back load balancer configuration...');
    
    // This would integrate with your load balancer (nginx, HAProxy, etc.)
    // For now, simulate the rollback
    
    if (this.environment === 'production') {
      const success = await this.executeCommand(
        'echo "Rolling back production traffic routing..."',
        'Rolling back production traffic'
      );
      return success;
    } else {
      this.log('info', 'Load balancer rollback not needed for staging');
      return true;
    }
  }

  async verifyRollback() {
    this.log('info', 'Verifying rollback success...');
    
    // Run health checks
    try {
      const healthCheck = await this.executeCommand(
        'npm run test:health',
        'Running health checks'
      );
      
      if (!healthCheck) {
        this.log('error', 'Health checks failed after rollback');
        return false;
      }
      
      // Run smoke tests
      const smokeTest = await this.executeCommand(
        'npm run test:smoke',
        'Running smoke tests'
      );
      
      if (!smokeTest) {
        this.log('error', 'Smoke tests failed after rollback');
        return false;
      }
      
      this.log('success', 'Rollback verification passed');
      return true;
    } catch (error) {
      this.log('error', 'Rollback verification failed', error.message);
      return false;
    }
  }

  async notifyStakeholders(success) {
    this.log('info', 'Notifying stakeholders...');
    
    const status = success ? 'SUCCESS' : 'FAILED';
    const message = `Rollback ${status} for ${this.environment} environment at ${new Date().toISOString()}`;
    
    // This would integrate with your notification system (Slack, email, etc.)
    if (!this.dryRun) {
      console.log(`📧 Notification: ${message}`);
    }
    
    // Save rollback report
    await this.generateRollbackReport(success);
  }

  async generateRollbackReport(success) {
    const reportPath = `tests/rollback-report-${Date.now()}.json`;
    this.rollbackConfig.success = success;
    this.rollbackConfig.completedAt = new Date().toISOString();
    
    if (!this.dryRun) {
      await fs.ensureDir(path.dirname(reportPath));
      await fs.writeJson(reportPath, this.rollbackConfig, { spaces: 2 });
    }
    
    this.log('info', `Rollback report saved: ${reportPath}`);
  }

  async performRollback() {
    this.log('info', `Starting automated rollback for ${this.environment} environment...`);
    
    if (this.dryRun) {
      this.log('info', '🔍 DRY RUN MODE - No actual changes will be made');
    }
    
    const rollbackSteps = [
      { name: 'Database Rollback', fn: () => this.rollbackDatabase() },
      { name: 'Application Rollback', fn: () => this.rollbackApplication() },
      { name: 'Load Balancer Rollback', fn: () => this.rollbackLoadBalancer() },
      { name: 'Rollback Verification', fn: () => this.verifyRollback() }
    ];
    
    let rollbackSuccess = true;
    
    for (const step of rollbackSteps) {
      this.log('info', `Executing: ${step.name}`);
      
      let attempts = 0;
      let stepSuccess = false;
      
      while (attempts < this.maxRollbackAttempts && !stepSuccess) {
        attempts++;
        
        if (attempts > 1) {
          this.log('info', `Retry attempt ${attempts} for ${step.name}`);
        }
        
        try {
          stepSuccess = await step.fn();
        } catch (error) {
          this.log('error', `${step.name} failed on attempt ${attempts}`, error.message);
        }
        
        if (!stepSuccess && attempts < this.maxRollbackAttempts) {
          this.log('info', `Waiting 5 seconds before retry...`);
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }
      
      if (!stepSuccess) {
        this.log('error', `${step.name} failed after ${this.maxRollbackAttempts} attempts`);
        rollbackSuccess = false;
        break; // Stop rollback process
      }
    }
    
    await this.notifyStakeholders(rollbackSuccess);
    
    if (rollbackSuccess) {
      this.log('success', '🎉 Automated rollback completed successfully!');
    } else {
      this.log('error', '❌ Automated rollback failed - manual intervention required');
    }
    
    return rollbackSuccess;
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const environment = args.find(arg => arg.startsWith('--env='))?.split('=')[1] || 'staging';
  
  const rollback = new RollbackAutomation({
    dryRun,
    environment
  });
  
  try {
    const success = await rollback.performRollback();
    process.exit(success ? 0 : 1);
  } catch (error) {
    console.error(chalk.red('Rollback automation failed:'), error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default RollbackAutomation;