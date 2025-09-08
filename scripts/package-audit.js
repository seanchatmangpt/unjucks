#!/usr/bin/env node

/**
 * Production Package Audit Script
 * Comprehensive validation for npm package production readiness
 */

import { promises as fs } from 'fs';
import { execSync } from 'child_process';
import path from 'path';
import chalk from 'chalk';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

class PackageAuditor {
  constructor() {
    this.results = {
      packageSize: 0,
      fileCount: 0,
      securityIssues: [],
      dependencyCount: { prod: 0, dev: 0 },
      validations: {},
      recommendations: []
    };
  }

  log(message, type = 'info') {
    const colors = {
      info: chalk.blue,
      success: chalk.green,
      warning: chalk.yellow,
      error: chalk.red
    };
    console.log(colors[type](`[AUDIT] ${message}`));
  }

  async analyzePackageSize() {
    try {
      this.log('Analyzing package size and contents...', 'info');
      
      // Get tarball size
      const tarballFiles = await fs.readdir(rootDir);
      const tarball = tarballFiles.find(f => f.endsWith('.tgz'));
      
      if (tarball) {
        const stats = await fs.stat(path.resolve(rootDir, tarball));
        this.results.packageSize = (stats.size / 1024 / 1024).toFixed(2); // MB
        
        // Count files in tarball
        try {
          const output = execSync(`tar -tzf ${tarball} | wc -l`, { cwd: rootDir, encoding: 'utf-8' });
          this.results.fileCount = parseInt(output.trim());
        } catch (error) {
          this.log('Could not analyze tarball contents', 'warning');
        }
      }

      // Size recommendations
      if (this.results.packageSize > 10) {
        this.results.recommendations.push('⚠️  Package size is large (>10MB). Consider excluding unnecessary files.');
      } else if (this.results.packageSize < 1) {
        this.log(`✅ Package size is optimal: ${this.results.packageSize}MB`, 'success');
      } else {
        this.log(`📦 Package size: ${this.results.packageSize}MB (${this.results.fileCount} files)`, 'info');
      }

    } catch (error) {
      this.log(`Size analysis failed: ${error.message}`, 'warning');
    }
  }

  async auditDependencies() {
    try {
      this.log('Auditing dependencies...', 'info');
      
      const packagePath = path.resolve(rootDir, 'package.json');
      const packageContent = await fs.readFile(packagePath, 'utf-8');
      const packageJson = JSON.parse(packageContent);
      
      // Count dependencies
      this.results.dependencyCount.prod = Object.keys(packageJson.dependencies || {}).length;
      this.results.dependencyCount.dev = Object.keys(packageJson.devDependencies || {}).length;
      
      this.log(`📊 Dependencies: ${this.results.dependencyCount.prod} production, ${this.results.dependencyCount.dev} development`, 'info');
      
      // Check for problematic dependencies
      const prodDeps = Object.keys(packageJson.dependencies || {});
      const problematicPatterns = [
        'test', 'spec', 'mock', 'fixture', 'example', 
        'webpack', 'babel', 'eslint', 'typescript'
      ];
      
      const problematicDeps = prodDeps.filter(dep => 
        problematicPatterns.some(pattern => dep.toLowerCase().includes(pattern))
      );
      
      if (problematicDeps.length > 0) {
        this.results.recommendations.push(
          `⚠️  Consider moving these dependencies to devDependencies: ${problematicDeps.join(', ')}`
        );
      }
      
    } catch (error) {
      this.log(`Dependency audit failed: ${error.message}`, 'error');
    }
  }

  async runSecurityScan() {
    try {
      this.log('Running security scan...', 'info');
      
      // Run npm audit
      try {
        execSync('npm audit --audit-level high', { 
          cwd: rootDir, 
          stdio: 'pipe' 
        });
        this.log('✅ No high-severity security issues found', 'success');
      } catch (error) {
        const output = error.stdout?.toString() || error.stderr?.toString() || '';
        if (output.includes('found 0 vulnerabilities')) {
          this.log('✅ No security vulnerabilities found', 'success');
        } else {
          this.results.securityIssues.push('High-severity vulnerabilities detected');
          this.log('❌ Security vulnerabilities found - run "npm audit" for details', 'error');
        }
      }
      
      // Check for common security anti-patterns
      const securityChecks = [
        { file: '.env', message: 'Environment file should not be in package' },
        { file: 'config/secrets.js', message: 'Secrets file detected' },
        { file: 'private.key', message: 'Private key file detected' }
      ];
      
      for (const check of securityChecks) {
        try {
          await fs.access(path.resolve(rootDir, check.file));
          this.results.securityIssues.push(check.message);
          this.log(`❌ ${check.message}`, 'error');
        } catch {
          // File doesn't exist, which is good
        }
      }
      
    } catch (error) {
      this.log(`Security scan failed: ${error.message}`, 'warning');
    }
  }

  async validatePackageStructure() {
    try {
      this.log('Validating package structure...', 'info');
      
      const requiredFiles = [
        { file: 'package.json', required: true },
        { file: 'README.md', required: true },
        { file: 'LICENSE', required: true },
        { file: 'bin/unjucks.cjs', required: true },
        { file: 'src/cli/index.js', required: true }
      ];
      
      const optionalFiles = [
        { file: '.npmignore', message: 'Helps control what gets published' },
        { file: 'CHANGELOG.md', message: 'Good for tracking changes' }
      ];
      
      let allRequired = true;
      
      for (const { file, required } of requiredFiles) {
        try {
          await fs.access(path.resolve(rootDir, file));
          this.log(`✅ ${file} present`, 'success');
          this.results.validations[file] = true;
        } catch {
          if (required) {
            this.log(`❌ Missing required file: ${file}`, 'error');
            this.results.validations[file] = false;
            allRequired = false;
          }
        }
      }
      
      for (const { file, message } of optionalFiles) {
        try {
          await fs.access(path.resolve(rootDir, file));
          this.log(`✅ ${file} present - ${message}`, 'success');
        } catch {
          this.results.recommendations.push(`💡 Consider adding ${file} - ${message}`);
        }
      }
      
      return allRequired;
      
    } catch (error) {
      this.log(`Structure validation failed: ${error.message}`, 'error');
      return false;
    }
  }

  async validateExecutables() {
    try {
      this.log('Validating executable files...', 'info');
      
      const executables = ['bin/unjucks.cjs', 'src/cli/index.js'];
      
      for (const exec of executables) {
        try {
          const fullPath = path.resolve(rootDir, exec);
          const stats = await fs.stat(fullPath);
          const isExecutable = (stats.mode & parseInt('111', 8)) !== 0;
          
          if (isExecutable) {
            this.log(`✅ ${exec} is executable`, 'success');
          } else {
            this.log(`⚠️  ${exec} is not executable - fixing...`, 'warning');
            await fs.chmod(fullPath, 0o755);
            this.log(`✅ ${exec} made executable`, 'success');
          }
        } catch (error) {
          this.log(`❌ Cannot validate ${exec}: ${error.message}`, 'error');
        }
      }
      
    } catch (error) {
      this.log(`Executable validation failed: ${error.message}`, 'error');
    }
  }

  async generateReport() {
    console.log('\n' + '='.repeat(80));
    console.log(chalk.cyan.bold('📋 PRODUCTION PACKAGE AUDIT REPORT'));
    console.log('='.repeat(80));
    
    // Package Metrics
    console.log(chalk.yellow.bold('\n📦 Package Metrics:'));
    console.log(`   Size: ${this.results.packageSize}MB`);
    console.log(`   Files: ${this.results.fileCount}`);
    console.log(`   Production Dependencies: ${this.results.dependencyCount.prod}`);
    console.log(`   Development Dependencies: ${this.results.dependencyCount.dev}`);
    
    // Security Status
    console.log(chalk.yellow.bold('\n🔒 Security Status:'));
    if (this.results.securityIssues.length === 0) {
      console.log(chalk.green('   ✅ No security issues detected'));
    } else {
      console.log(chalk.red('   ❌ Security issues found:'));
      this.results.securityIssues.forEach(issue => 
        console.log(chalk.red(`      • ${issue}`))
      );
    }
    
    // Validation Results
    console.log(chalk.yellow.bold('\n✅ Validation Results:'));
    Object.entries(this.results.validations).forEach(([file, passed]) => {
      const icon = passed ? '✅' : '❌';
      const color = passed ? chalk.green : chalk.red;
      console.log(color(`   ${icon} ${file}`));
    });
    
    // Recommendations
    if (this.results.recommendations.length > 0) {
      console.log(chalk.yellow.bold('\n💡 Recommendations:'));
      this.results.recommendations.forEach(rec => 
        console.log(`   ${rec}`)
      );
    }
    
    // Production Readiness Score
    const totalValidations = Object.keys(this.results.validations).length;
    const passedValidations = Object.values(this.results.validations).filter(Boolean).length;
    const securityScore = this.results.securityIssues.length === 0 ? 100 : 60;
    const structureScore = totalValidations > 0 ? (passedValidations / totalValidations) * 100 : 0;
    const sizeScore = this.results.packageSize < 5 ? 100 : this.results.packageSize < 10 ? 80 : 60;
    
    const overallScore = Math.round((securityScore + structureScore + sizeScore) / 3);
    
    console.log(chalk.yellow.bold('\n🎯 Production Readiness Score:'));
    console.log(`   Security: ${securityScore}/100`);
    console.log(`   Structure: ${Math.round(structureScore)}/100`);
    console.log(`   Size: ${sizeScore}/100`);
    console.log(chalk.cyan.bold(`   Overall: ${overallScore}/100`));
    
    if (overallScore >= 90) {
      console.log(chalk.green.bold('\n🎉 Package is ready for production!'));
    } else if (overallScore >= 70) {
      console.log(chalk.yellow.bold('\n⚠️  Package is mostly ready - address recommendations above'));
    } else {
      console.log(chalk.red.bold('\n❌ Package needs work before production'));
    }
    
    console.log('='.repeat(80));
    
    return overallScore >= 70;
  }

  async runFullAudit() {
    this.log('🔍 Starting comprehensive package audit...', 'info');
    
    await this.analyzePackageSize();
    await this.auditDependencies();
    await this.runSecurityScan();
    await this.validatePackageStructure();
    await this.validateExecutables();
    
    return await this.generateReport();
  }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const auditor = new PackageAuditor();
  
  auditor.runFullAudit()
    .then(isReady => {
      process.exit(isReady ? 0 : 1);
    })
    .catch(error => {
      console.error(chalk.red(`Fatal audit error: ${error.message}`));
      process.exit(1);
    });
}

export { PackageAuditor };