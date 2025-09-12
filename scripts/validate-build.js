#!/usr/bin/env node

/**
 * Build Validation Script
 * Validates build artifacts and deployment readiness
 */

import { readFileSync, existsSync, statSync } from 'fs';
import { glob } from 'glob';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

class BuildValidator {
  constructor() {
    this.validationResults = {
      timestamp: this.getDeterministicDate().toISOString(),
      passed: true,
      issues: [],
      checks: {
        packageJson: { passed: false, issues: [] },
        buildArtifacts: { passed: false, issues: [] },
        dependencies: { passed: false, issues: [] },
        scripts: { passed: false, issues: [] },
        exports: { passed: false, issues: [] },
        filePermissions: { passed: false, issues: [] }
      }
    };
  }

  validatePackageJson() {
    console.log('📦 Validating package.json...');
    
    try {
      const packageJsonPath = join(rootDir, 'package.json');
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
      
      // Required fields validation
      const requiredFields = ['name', 'version', 'main', 'bin', 'scripts'];
      requiredFields.forEach(field => {
        if (!packageJson[field]) {
          this.addIssue('packageJson', 'error', `Missing required field: ${field}`);
        }
      });
      
      // Version format validation
      const versionRegex = /^\d+\.\d+\.\d+/;
      if (!versionRegex.test(packageJson.version)) {
        this.addIssue('packageJson', 'warning', `Version format unusual: ${packageJson.version}`);
      }
      
      // Scripts validation
      const requiredScripts = ['build', 'test', 'lint'];
      requiredScripts.forEach(script => {
        if (!packageJson.scripts[script]) {
          this.addIssue('packageJson', 'warning', `Missing recommended script: ${script}`);
        }
      });
      
      // Dependencies validation
      if (packageJson.dependencies) {
        Object.keys(packageJson.dependencies).forEach(dep => {
          if (dep.includes(' ') || dep.includes('/') && !dep.startsWith('@')) {
            this.addIssue('packageJson', 'error', `Invalid dependency name: ${dep}`);
          }
        });
      }
      
      // Files field validation
      if (packageJson.files) {
        packageJson.files.forEach(file => {
          if (!existsSync(join(rootDir, file))) {
            this.addIssue('packageJson', 'error', `Listed file does not exist: ${file}`);
          }
        });
      }
      
      this.validationResults.checks.packageJson.passed = 
        this.validationResults.checks.packageJson.issues.length === 0;
      
      console.log(`  ✅ package.json validation completed`);
      
    } catch (error) {
      this.addIssue('packageJson', 'error', `Failed to validate package.json: ${error.message}`);
    }
  }

  validateBuildArtifacts() {
    console.log('🔧 Validating build artifacts...');
    
    try {
      const packageJson = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf8'));
      
      // Check main entry point
      if (packageJson.main && !existsSync(join(rootDir, packageJson.main))) {
        this.addIssue('buildArtifacts', 'error', `Main entry point not found: ${packageJson.main}`);
      }
      
      // Check bin files
      if (packageJson.bin) {
        Object.entries(packageJson.bin).forEach(([binName, binPath]) => {
          const fullPath = join(rootDir, binPath);
          if (!existsSync(fullPath)) {
            this.addIssue('buildArtifacts', 'error', `Binary not found: ${binPath}`);
          } else {
            // Check if executable
            try {
              const stats = statSync(fullPath);
              if (!(stats.mode & parseInt('100', 8))) {
                this.addIssue('buildArtifacts', 'warning', `Binary not executable: ${binPath}`);
              }
            } catch (e) {
              this.addIssue('buildArtifacts', 'error', `Cannot check binary permissions: ${binPath}`);
            }
          }
        });
      }
      
      // Check exports
      if (packageJson.exports) {
        Object.values(packageJson.exports).forEach(exportPath => {
          if (typeof exportPath === 'object') {
            Object.values(exportPath).forEach(path => {
              if (typeof path === 'string' && !existsSync(join(rootDir, path))) {
                this.addIssue('buildArtifacts', 'error', `Export path not found: ${path}`);
              }
            });
          } else if (typeof exportPath === 'string' && !existsSync(join(rootDir, exportPath))) {
            this.addIssue('buildArtifacts', 'error', `Export path not found: ${exportPath}`);
          }
        });
      }
      
      // Check for common build outputs
      const expectedDirs = ['src', 'templates'];
      expectedDirs.forEach(dir => {
        if (!existsSync(join(rootDir, dir))) {
          this.addIssue('buildArtifacts', 'warning', `Expected directory not found: ${dir}`);
        }
      });
      
      this.validationResults.checks.buildArtifacts.passed = 
        this.validationResults.checks.buildArtifacts.issues.filter(i => i.level === 'error').length === 0;
      
      console.log(`  ✅ Build artifacts validation completed`);
      
    } catch (error) {
      this.addIssue('buildArtifacts', 'error', `Failed to validate build artifacts: ${error.message}`);
    }
  }

  validateDependencies() {
    console.log('📚 Validating dependencies...');
    
    try {
      // Check if node_modules exists
      if (!existsSync(join(rootDir, 'node_modules'))) {
        this.addIssue('dependencies', 'error', 'node_modules directory not found - run npm install');
        return;
      }
      
      const packageJson = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf8'));
      
      // Check critical dependencies
      const criticalDeps = ['nunjucks', 'glob', 'gray-matter'];
      criticalDeps.forEach(dep => {
        if (packageJson.dependencies && packageJson.dependencies[dep]) {
          const depPath = join(rootDir, 'node_modules', dep);
          if (!existsSync(depPath)) {
            this.addIssue('dependencies', 'error', `Critical dependency not installed: ${dep}`);
          }
        }
      });
      
      // Check package-lock.json
      if (existsSync(join(rootDir, 'package-lock.json'))) {
        try {
          const lockFile = JSON.parse(readFileSync(join(rootDir, 'package-lock.json'), 'utf8'));
          if (lockFile.name !== packageJson.name) {
            this.addIssue('dependencies', 'warning', 'Package-lock name mismatch');
          }
        } catch (e) {
          this.addIssue('dependencies', 'error', 'Invalid package-lock.json format');
        }
      }
      
      this.validationResults.checks.dependencies.passed = 
        this.validationResults.checks.dependencies.issues.filter(i => i.level === 'error').length === 0;
      
      console.log(`  ✅ Dependencies validation completed`);
      
    } catch (error) {
      this.addIssue('dependencies', 'error', `Failed to validate dependencies: ${error.message}`);
    }
  }

  validateScripts() {
    console.log('📜 Validating scripts...');
    
    try {
      const packageJson = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf8'));
      
      if (!packageJson.scripts) {
        this.addIssue('scripts', 'error', 'No scripts section found in package.json');
        return;
      }
      
      // Test critical scripts
      const criticalScripts = ['build', 'test'];
      criticalScripts.forEach(scriptName => {
        if (packageJson.scripts[scriptName]) {
          try {
            console.log(`    Testing script: ${scriptName}`);
            execSync(`npm run ${scriptName}`, { 
              cwd: rootDir, 
              stdio: ['pipe', 'pipe', 'pipe'],
              timeout: 60000 // 1 minute timeout
            });
            console.log(`    ✅ Script '${scriptName}' executed successfully`);
          } catch (error) {
            this.addIssue('scripts', 'error', `Script '${scriptName}' failed: ${error.message.split('\n')[0]}`);
          }
        } else {
          this.addIssue('scripts', 'warning', `Missing critical script: ${scriptName}`);
        }
      });
      
      // Check for script syntax issues
      Object.entries(packageJson.scripts).forEach(([name, script]) => {
        if (script.includes('&&') && !script.includes('||')) {
          // Check for potentially fragile script chains
          if (script.split('&&').length > 3) {
            this.addIssue('scripts', 'info', `Complex script chain in '${name}' - consider error handling`);
          }
        }
      });
      
      this.validationResults.checks.scripts.passed = 
        this.validationResults.checks.scripts.issues.filter(i => i.level === 'error').length === 0;
      
      console.log(`  ✅ Scripts validation completed`);
      
    } catch (error) {
      this.addIssue('scripts', 'error', `Failed to validate scripts: ${error.message}`);
    }
  }

  async validateFilePermissions() {
    console.log('🔐 Validating file permissions...');
    
    try {
      const packageJson = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf8'));
      
      // Check bin file permissions
      if (packageJson.bin) {
        Object.entries(packageJson.bin).forEach(([binName, binPath]) => {
          const fullPath = join(rootDir, binPath);
          if (existsSync(fullPath)) {
            try {
              const stats = statSync(fullPath);
              if (!(stats.mode & parseInt('100', 8))) {
                this.addIssue('filePermissions', 'error', `Binary not executable: ${binPath}`);
              }
            } catch (e) {
              this.addIssue('filePermissions', 'warning', `Cannot check permissions: ${binPath}`);
            }
          }
        });
      }
      
      // Check script files
      const scriptFiles = await glob('scripts/*.js', { cwd: rootDir });
      scriptFiles.forEach(scriptFile => {
        const fullPath = join(rootDir, scriptFile);
        try {
          const stats = statSync(fullPath);
          if (!(stats.mode & parseInt('100', 8))) {
            this.addIssue('filePermissions', 'warning', `Script not executable: ${scriptFile}`);
          }
        } catch (e) {
          // Ignore permission check failures on some systems
        }
      });
      
      this.validationResults.checks.filePermissions.passed = 
        this.validationResults.checks.filePermissions.issues.filter(i => i.level === 'error').length === 0;
      
      console.log(`  ✅ File permissions validation completed`);
      
    } catch (error) {
      this.addIssue('filePermissions', 'error', `Failed to validate file permissions: ${error.message}`);
    }
  }

  addIssue(category, level, message) {
    const issue = { category, level, message, timestamp: this.getDeterministicDate().toISOString() };
    this.validationResults.issues.push(issue);
    this.validationResults.checks[category].issues.push(issue);
    
    if (level === 'error') {
      this.validationResults.passed = false;
    }
  }

  async runAllValidations() {
    console.log('🔍 Starting build validation...\n');
    
    this.validatePackageJson();
    this.validateBuildArtifacts();
    this.validateDependencies();
    this.validateScripts();
    await this.validateFilePermissions();
    
    this.generateReport();
    return this.validationResults;
  }

  generateReport() {
    console.log('\n📊 Build Validation Results');
    console.log('═'.repeat(50));
    
    const totalIssues = this.validationResults.issues.length;
    const errors = this.validationResults.issues.filter(i => i.level === 'error').length;
    const warnings = this.validationResults.issues.filter(i => i.level === 'warning').length;
    const info = this.validationResults.issues.filter(i => i.level === 'info').length;
    
    console.log(`Overall Status: ${this.validationResults.passed ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Total Issues: ${totalIssues}`);
    console.log(`Errors: ${errors}`);
    console.log(`Warnings: ${warnings}`);
    console.log(`Info: ${info}`);
    
    // Check results by category
    console.log('\nValidation Categories:');
    Object.entries(this.validationResults.checks).forEach(([category, result]) => {
      const icon = result.passed ? '✅' : '❌';
      console.log(`  ${icon} ${category}: ${result.issues.length} issues`);
    });
    
    // Detailed issues
    if (totalIssues > 0) {
      console.log('\n🔍 Issue Details:');
      console.log('─'.repeat(50));
      
      ['error', 'warning', 'info'].forEach(level => {
        const levelIssues = this.validationResults.issues.filter(i => i.level === level);
        if (levelIssues.length > 0) {
          const icon = level === 'error' ? '🔴' : level === 'warning' ? '🟡' : '🔵';
          console.log(`\n${icon} ${level.toUpperCase()}:`);
          
          levelIssues.forEach(issue => {
            console.log(`  [${issue.category}] ${issue.message}`);
          });
        }
      });
    }
    
    // Deployment readiness assessment
    console.log('\n📦 Deployment Readiness:');
    console.log('─'.repeat(30));
    
    if (this.validationResults.passed) {
      console.log('✅ Package is ready for deployment');
      console.log('• All critical validations passed');
      console.log('• Build artifacts are present and valid');
      console.log('• Dependencies are properly configured');
    } else {
      console.log('❌ Package is NOT ready for deployment');
      console.log('• Critical issues must be resolved');
      console.log('• Review error messages above');
    }
    
    // Exit with appropriate code
    if (errors > 0) {
      console.log('\n❌ Build validation failed due to errors');
      process.exit(1);
    } else if (warnings > 0) {
      console.log('\n⚠️  Build validation passed with warnings');
    } else {
      console.log('\n✅ Build validation passed successfully');
    }
  }
}

// Run validation if called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const validator = new BuildValidator();
  validator.runAllValidations().catch(error => {
    console.error('❌ Build validation failed:', error);
    process.exit(1);
  });
}

export default BuildValidator;