#!/usr/bin/env node

/**
 * Unjucks Build System - Comprehensive validation and preparation
 * Ensures package is properly prepared for publishing
 */

import { promises as fs } from 'fs';
import { execSync } from 'child_process';
import path from 'path';
import chalk from 'chalk';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

class BuildSystem {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.results = {
      validations: {},
      smokeTests: {},
      permissions: {},
      packageValidation: {}
    };
  }

  log(message, type = 'info') {
    const colors = {
      info: chalk.blue,
      success: chalk.green,
      warning: chalk.yellow,
      error: chalk.red
    };
    console.log(colors[type](`[BUILD] ${message}`));
  }

  async validateFileExists(filePath, description) {
    try {
      const fullPath = path.resolve(rootDir, filePath);
      await fs.access(fullPath);
      this.log(`✅ ${description}: ${filePath}`, 'success');
      return true;
    } catch (error) {
      const message = `❌ Missing ${description}: ${filePath}`;
      this.errors.push(message);
      this.log(message, 'error');
      return false;
    }
  }

  async validateExecutable(filePath, description) {
    try {
      const fullPath = path.resolve(rootDir, filePath);
      const stats = await fs.stat(fullPath);
      const isExecutable = (stats.mode & parseInt('111', 8)) !== 0;
      
      if (!isExecutable) {
        this.log(`🔧 Making ${description} executable: ${filePath}`, 'warning');
        await fs.chmod(fullPath, 0o755);
        this.log(`✅ ${description} is now executable`, 'success');
      } else {
        this.log(`✅ ${description} is executable: ${filePath}`, 'success');
      }
      
      this.results.permissions[filePath] = true;
      return true;
    } catch (error) {
      const message = `❌ Cannot make ${description} executable: ${filePath} - ${error.message}`;
      this.errors.push(message);
      this.log(message, 'error');
      this.results.permissions[filePath] = false;
      return false;
    }
  }

  async validatePackageJson() {
    try {
      const packagePath = path.resolve(rootDir, 'package.json');
      const packageContent = await fs.readFile(packagePath, 'utf-8');
      const packageJson = JSON.parse(packageContent);
      
      const requiredFields = ['name', 'version', 'description', 'main', 'bin', 'exports'];
      const missingFields = requiredFields.filter(field => !packageJson[field]);
      
      if (missingFields.length > 0) {
        const message = `❌ Missing required package.json fields: ${missingFields.join(', ')}`;
        this.errors.push(message);
        this.log(message, 'error');
        return false;
      }

      // Validate bin configuration
      if (!packageJson.bin || !packageJson.bin.unjucks) {
        const message = '❌ Missing or invalid bin configuration in package.json';
        this.errors.push(message);
        this.log(message, 'error');
        return false;
      }

      // Validate files array
      if (!packageJson.files || !Array.isArray(packageJson.files) || packageJson.files.length === 0) {
        const message = '❌ Missing or invalid files array in package.json';
        this.errors.push(message);
        this.log(message, 'error');
        return false;
      }

      // Check Node.js version requirement
      if (!packageJson.engines || !packageJson.engines.node) {
        this.warnings.push('⚠️  No Node.js version requirement specified');
        this.log('⚠️  No Node.js version requirement specified', 'warning');
      }

      this.log('✅ package.json validation passed', 'success');
      this.results.packageValidation.valid = true;
      return true;
    } catch (error) {
      const message = `❌ Package.json validation failed: ${error.message}`;
      this.errors.push(message);
      this.log(message, 'error');
      this.results.packageValidation.valid = false;
      return false;
    }
  }

  async runSmokeTests() {
    const tests = [
      {
        name: 'CLI Help Command',
        command: 'node bin/unjucks.cjs --help',
        expectedPattern: /Hygen-style CLI generator|unjucks|USAGE/i
      },
      {
        name: 'CLI Version Command',
        command: 'node bin/unjucks.cjs --version',
        expectedPattern: /\d+\.\d+\./
      },
      {
        name: 'List Command',
        command: 'node bin/unjucks.cjs list',
        expectedPattern: /Available|generators|templates/i
      },
      {
        name: 'Main CLI Entry Point',
        command: 'node src/cli/index.js --help',
        expectedPattern: /Hygen-style CLI generator|unjucks|USAGE/i
      }
    ];

    let passedTests = 0;
    let totalTests = tests.length;

    for (const test of tests) {
      try {
        this.log(`Running smoke test: ${test.name}`, 'info');
        const output = execSync(test.command, { 
          cwd: rootDir,
          encoding: 'utf-8',
          timeout: 10000
        });
        
        if (test.expectedPattern.test(output)) {
          this.log(`✅ ${test.name} passed`, 'success');
          this.results.smokeTests[test.name] = { passed: true, output: output.substring(0, 100) };
          passedTests++;
        } else {
          const message = `❌ ${test.name} failed - unexpected output`;
          this.errors.push(message);
          this.log(message, 'error');
          this.results.smokeTests[test.name] = { passed: false, output };
        }
      } catch (error) {
        const message = `❌ ${test.name} failed with error: ${error.message}`;
        this.errors.push(message);
        this.log(message, 'error');
        this.results.smokeTests[test.name] = { passed: false, error: error.message };
      }
    }

    this.log(`Smoke tests completed: ${passedTests}/${totalTests} passed`, passedTests === totalTests ? 'success' : 'warning');
    return passedTests === totalTests;
  }

  async validateDependencies() {
    try {
      this.log('Validating dependencies...', 'info');
      
      // Check if node_modules exists
      const nodeModulesPath = path.resolve(rootDir, 'node_modules');
      await fs.access(nodeModulesPath);
      
      // Run npm ls to check for missing dependencies
      execSync('npm ls --depth=0', { 
        cwd: rootDir,
        encoding: 'utf-8',
        stdio: 'pipe'
      });
      
      this.log('✅ All dependencies are installed', 'success');
      this.results.validations.dependencies = true;
      return true;
    } catch (error) {
      if (error.message.includes('missing')) {
        const message = '❌ Missing dependencies detected. Run npm install.';
        this.errors.push(message);
        this.log(message, 'error');
      } else {
        this.log('⚠️  Could not validate dependencies, but continuing...', 'warning');
        this.results.validations.dependencies = 'warning';
        return true; // Don't fail build for this
      }
      return false;
    }
  }

  async validateTemplateStructure() {
    try {
      this.log('Validating template structure...', 'info');
      
      const templateDirs = ['_templates', 'templates'];
      let foundTemplates = false;
      
      for (const dir of templateDirs) {
        const templatePath = path.resolve(rootDir, dir);
        try {
          await fs.access(templatePath);
          const entries = await fs.readdir(templatePath);
          if (entries.length > 0) {
            foundTemplates = true;
            this.log(`✅ Found templates in ${dir}/`, 'success');
          }
        } catch (error) {
          // Directory doesn't exist, that's okay
        }
      }
      
      if (!foundTemplates) {
        this.log('⚠️  No template directories found - this is okay for a fresh installation', 'warning');
        this.warnings.push('No template directories found');
      }
      
      this.results.validations.templates = foundTemplates;
      return true;
    } catch (error) {
      this.log(`⚠️  Template structure validation warning: ${error.message}`, 'warning');
      return true; // Don't fail for template issues
    }
  }

  async runFullValidation() {
    this.log('🚀 Starting Unjucks build validation...', 'info');
    
    const validations = [
      // File existence checks
      () => this.validateFileExists('package.json', 'Package configuration'),
      () => this.validateFileExists('src/cli/index.js', 'Main CLI entry point'),
      () => this.validateFileExists('bin/unjucks.cjs', 'Binary executable'),
      
      // Executable permissions
      () => this.validateExecutable('bin/unjucks.cjs', 'Main binary'),
      () => this.validateExecutable('src/cli/index.js', 'CLI entry point'),
      
      // Configuration validation
      () => this.validatePackageJson(),
      () => this.validateDependencies(),
      () => this.validateTemplateStructure(),
      
      // Functional testing
      () => this.runSmokeTests()
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
      this.log('🎉 All validations passed! Package is ready for publishing.', 'success');
    } else if (this.errors.length === 0 && this.warnings.length > 0) {
      this.log('✅ Validations passed with warnings. Package should be okay to publish.', 'warning');
      this.warnings.forEach(warning => this.log(warning, 'warning'));
    } else {
      this.log(`❌ ${this.errors.length} validation error(s) found:`, 'error');
      this.errors.forEach(error => this.log(error, 'error'));
      allPassed = false;
    }
    
    if (this.warnings.length > 0 && this.errors.length === 0) {
      console.log('\n📋 Warnings:');
      this.warnings.forEach(warning => console.log(`  ${warning}`));
    }
    
    console.log('='.repeat(60));
    
    return allPassed;
  }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const buildSystem = new BuildSystem();
  
  buildSystem.runFullValidation()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error(chalk.red(`Fatal error during build validation: ${error.message}`));
      process.exit(1);
    });
}

export { BuildSystem };