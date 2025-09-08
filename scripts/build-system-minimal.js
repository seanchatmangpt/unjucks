#!/usr/bin/env node

/**
 * Unjucks Minimal Build System - No external dependencies
 * Basic validation and preparation for publishing
 */

import { promises as fs } from 'fs';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

class MinimalBuildSystem {
  constructor() {
    this.errors = [];
    this.warnings = [];
  }

  log(message, type = 'info') {
    const prefixes = {
      info: '[BUILD]',
      success: '[BUILD] ✅',
      warning: '[BUILD] ⚠️ ',
      error: '[BUILD] ❌'
    };
    console.log(`${prefixes[type]} ${message}`);
  }

  async validateFileExists(filePath, description) {
    try {
      const fullPath = path.resolve(rootDir, filePath);
      await fs.access(fullPath);
      this.log(`${description}: ${filePath}`, 'success');
      return true;
    } catch (error) {
      const message = `Missing ${description}: ${filePath}`;
      this.errors.push(message);
      this.log(message, 'error');
      return false;
    }
  }

  async makeExecutable(filePath, description) {
    try {
      const fullPath = path.resolve(rootDir, filePath);
      const stats = await fs.stat(fullPath);
      const isExecutable = (stats.mode & parseInt('111', 8)) !== 0;
      
      if (!isExecutable) {
        this.log(`Making ${description} executable: ${filePath}`, 'warning');
        await fs.chmod(fullPath, 0o755);
        this.log(`${description} is now executable`, 'success');
      } else {
        this.log(`${description} is executable: ${filePath}`, 'success');
      }
      
      return true;
    } catch (error) {
      const message = `Cannot make ${description} executable: ${filePath} - ${error.message}`;
      this.errors.push(message);
      this.log(message, 'error');
      return false;
    }
  }

  async validatePackageJson() {
    try {
      const packagePath = path.resolve(rootDir, 'package.json');
      const packageContent = await fs.readFile(packagePath, 'utf-8');
      const packageJson = JSON.parse(packageContent);
      
      const requiredFields = ['name', 'version', 'description', 'main', 'bin'];
      const missingFields = requiredFields.filter(field => !packageJson[field]);
      
      if (missingFields.length > 0) {
        const message = `Missing required package.json fields: ${missingFields.join(', ')}`;
        this.errors.push(message);
        this.log(message, 'error');
        return false;
      }

      // Validate bin configuration
      if (!packageJson.bin || !packageJson.bin.unjucks) {
        const message = 'Missing or invalid bin configuration in package.json';
        this.errors.push(message);
        this.log(message, 'error');
        return false;
      }

      // Validate files array
      if (!packageJson.files || !Array.isArray(packageJson.files)) {
        this.warnings.push('No files array in package.json - all files will be included');
        this.log('No files array in package.json - all files will be included', 'warning');
      }

      this.log('package.json validation passed', 'success');
      return true;
    } catch (error) {
      const message = `Package.json validation failed: ${error.message}`;
      this.errors.push(message);
      this.log(message, 'error');
      return false;
    }
  }

  async runBasicValidation() {
    this.log('🚀 Starting minimal build validation...', 'info');
    console.log('='.repeat(60));
    
    const validations = [
      // File existence checks
      () => this.validateFileExists('package.json', 'Package configuration'),
      () => this.validateFileExists('src/cli/index.js', 'Main CLI entry point'),
      () => this.validateFileExists('bin/unjucks.cjs', 'Binary executable'),
      
      // Make files executable
      () => this.makeExecutable('bin/unjucks.cjs', 'Main binary'),
      () => this.makeExecutable('src/cli/index.js', 'CLI entry point'),
      
      // Configuration validation
      () => this.validatePackageJson()
    ];

    let allPassed = true;
    for (const validation of validations) {
      const result = await validation();
      if (!result) {
        allPassed = false;
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    if (allPassed && this.errors.length === 0) {
      this.log('🎉 Minimal validation passed! Basic package structure is correct.', 'success');
    } else {
      this.log(`❌ ${this.errors.length} validation error(s) found:`, 'error');
      this.errors.forEach(error => this.log(error, 'error'));
      allPassed = false;
    }
    
    if (this.warnings.length > 0) {
      console.log('\n📋 Warnings:');
      this.warnings.forEach(warning => console.log(`  ⚠️  ${warning}`));
    }
    
    console.log('='.repeat(60));
    
    return allPassed;
  }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const buildSystem = new MinimalBuildSystem();
  
  buildSystem.runBasicValidation()
    .then(success => {
      if (success) {
        console.log('\n💡 To run full validation once dependencies are installed:');
        console.log('   npm run build:validate');
        console.log('\n💡 To run smoke tests:');
        console.log('   npm run test:smoke');
      }
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error(`Fatal error during minimal build validation: ${error.message}`);
      process.exit(1);
    });
}

export { MinimalBuildSystem };