#!/usr/bin/env node

/**
 * Unjucks Pre-Publish Script
 * Comprehensive validation before npm publish
 */

import { BuildSystem } from './build-system.js';
import { SmokeTestRunner } from './smoke-tests.js';
import chalk from 'chalk';
import { execSync } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

class PrePublishValidator {
  constructor() {
    this.buildSystem = new BuildSystem();
    this.smokeTestRunner = new SmokeTestRunner();
    this.errors = [];
    this.warnings = [];
  }

  log(message, type = 'info') {
    const colors = {
      info: chalk.blue,
      success: chalk.green,
      warning: chalk.yellow,
      error: chalk.red
    };
    console.log(colors[type](`[PRE-PUBLISH] ${message}`));
  }

  async checkGitStatus() {
    try {
      this.log('Checking git status...', 'info');
      
      const status = execSync('git status --porcelain', { 
        cwd: rootDir,
        encoding: 'utf-8' 
      });
      
      if (status.trim()) {
        this.warnings.push('Git working directory is not clean');
        this.log('⚠️  Git working directory has uncommitted changes', 'warning');
        this.log('   Consider committing changes before publishing', 'warning');
      } else {
        this.log('✅ Git working directory is clean', 'success');
      }
      
      return true;
    } catch (error) {
      this.log('⚠️  Could not check git status (not in a git repo?)', 'warning');
      return true; // Don't fail for non-git projects
    }
  }

  async validateNpmLogin() {
    try {
      this.log('Checking npm authentication...', 'info');
      
      const whoami = execSync('npm whoami', { 
        cwd: rootDir,
        encoding: 'utf-8' 
      });
      
      if (whoami.trim()) {
        this.log(`✅ Authenticated as: ${whoami.trim()}`, 'success');
      } else {
        this.errors.push('Not logged into npm');
        this.log('❌ Not logged into npm. Run: npm login', 'error');
        return false;
      }
      
      return true;
    } catch (error) {
      this.errors.push('npm authentication check failed');
      this.log('❌ npm authentication check failed. Run: npm login', 'error');
      return false;
    }
  }

  async checkPublishRegistry() {
    try {
      this.log('Checking npm registry...', 'info');
      
      const registry = execSync('npm config get registry', { 
        cwd: rootDir,
        encoding: 'utf-8' 
      }).trim();
      
      this.log(`📡 Registry: ${registry}`, 'info');
      
      // Check if it's npmjs.org for public packages
      if (registry.includes('npmjs.org')) {
        this.log('✅ Using npmjs.org registry', 'success');
      } else {
        this.log('⚠️  Using custom registry - ensure this is intended', 'warning');
        this.warnings.push(`Using custom registry: ${registry}`);
      }
      
      return true;
    } catch (error) {
      this.log('⚠️  Could not check npm registry', 'warning');
      return true;
    }
  }

  async validatePackageSize() {
    try {
      this.log('Checking package size...', 'info');
      
      const packageInfo = execSync('npm pack --dry-run --json', { 
        cwd: rootDir,
        encoding: 'utf-8' 
      });
      
      const packInfo = JSON.parse(packageInfo);
      const sizeBytes = packInfo[0]?.size || 0;
      const sizeMB = (sizeBytes / 1024 / 1024).toFixed(2);
      
      this.log(`📦 Package size: ${sizeMB} MB`, 'info');
      
      if (sizeBytes > 10 * 1024 * 1024) { // 10MB
        this.warnings.push(`Package size is large: ${sizeMB} MB`);
        this.log(`⚠️  Package size is large: ${sizeMB} MB`, 'warning');
      } else {
        this.log('✅ Package size is reasonable', 'success');
      }
      
      return true;
    } catch (error) {
      this.log('⚠️  Could not check package size', 'warning');
      return true;
    }
  }

  async checkForSensitiveFiles() {
    try {
      this.log('Checking for sensitive files...', 'info');
      
      const sensitivePatterns = [
        '.env',
        '.env.local',
        '.env.production',
        '*.key',
        '*.pem',
        '.aws/',
        '.ssh/',
        'id_rsa*',
        'secrets.json',
        'credentials.json'
      ];
      
      const packageJson = JSON.parse(
        await fs.readFile(path.resolve(rootDir, 'package.json'), 'utf-8')
      );
      
      const files = packageJson.files || ['src', 'bin', 'README.md', 'LICENSE'];
      let foundSensitive = false;
      
      for (const pattern of sensitivePatterns) {
        // This is a basic check - in a real implementation you might use glob
        if (files.some(file => file.includes(pattern.replace('*', '')))) {
          this.errors.push(`Potentially sensitive file pattern in package: ${pattern}`);
          foundSensitive = true;
        }
      }
      
      if (!foundSensitive) {
        this.log('✅ No obvious sensitive files detected', 'success');
      }
      
      return !foundSensitive;
    } catch (error) {
      this.log('⚠️  Could not check for sensitive files', 'warning');
      return true;
    }
  }

  async runPrePublishChecks() {
    this.log('🚀 Starting pre-publish validation...', 'info');
    console.log('='.repeat(60));
    
    const checks = [
      // Git and environment checks
      () => this.checkGitStatus(),
      
      // Build system validation
      () => this.buildSystem.runFullValidation(),
      
      // Functional testing
      () => this.smokeTestRunner.runAllTests(),
      
      // Publishing prerequisites
      () => this.validateNpmLogin(),
      () => this.checkPublishRegistry(),
      () => this.validatePackageSize(),
      () => this.checkForSensitiveFiles()
    ];

    let allPassed = true;
    
    for (const check of checks) {
      const result = await check();
      if (!result) {
        allPassed = false;
      }
      console.log(''); // Spacing between checks
    }

    // Collect all errors and warnings
    this.errors.push(...this.buildSystem.errors);
    this.warnings.push(...this.buildSystem.warnings);

    // Final summary
    console.log('='.repeat(60));
    if (allPassed && this.errors.length === 0) {
      this.log('🎉 All pre-publish checks passed!', 'success');
      this.log('✅ Package is ready for publishing.', 'success');
      
      if (this.warnings.length > 0) {
        console.log('\n⚠️  Warnings (non-blocking):');
        this.warnings.forEach(warning => this.log(warning, 'warning'));
      }
      
      console.log('\n🚀 You can now run: npm publish');
    } else {
      this.log(`❌ Pre-publish validation failed with ${this.errors.length} error(s)`, 'error');
      
      if (this.errors.length > 0) {
        console.log('\n❌ Errors that must be fixed:');
        this.errors.forEach(error => this.log(error, 'error'));
      }
      
      if (this.warnings.length > 0) {
        console.log('\n⚠️  Warnings:');
        this.warnings.forEach(warning => this.log(warning, 'warning'));
      }
    }
    
    console.log('='.repeat(60));
    
    return allPassed && this.errors.length === 0;
  }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const validator = new PrePublishValidator();
  
  validator.runPrePublishChecks()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error(chalk.red(`Fatal error during pre-publish validation: ${error.message}`));
      process.exit(1);
    });
}

export { PrePublishValidator };