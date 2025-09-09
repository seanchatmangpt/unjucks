#!/usr/bin/env node

/**
 * Production Validation Script
 * Comprehensive validation for production deployments
 */

import { execSync } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';

class ProductionValidator {
  constructor() {
    this.validationResults = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      validations: {},
      errors: [],
      warnings: []
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
    
    if (level === 'error') this.validationResults.errors.push(logEntry);
    if (level === 'warning') this.validationResults.warnings.push(logEntry);
  }

  async validateCodeIntegrity() {
    this.log('info', 'Validating code integrity...');
    
    try {
      // Check for mock implementations in production code
      const mockCheck = execSync(
        'grep -r "mock\\|fake\\|stub" src/ --exclude-dir=tests --exclude="*.test.*" --exclude="*.spec.*" || true',
        { encoding: 'utf8' }
      );
      
      if (mockCheck.trim()) {
        this.log('error', 'Mock implementations found in production code', mockCheck);
        return false;
      }
      
      // Check for TODO/FIXME in critical paths
      const todoCheck = execSync(
        'grep -r "TODO\\|FIXME" src/ --exclude-dir=tests || true',
        { encoding: 'utf8' }
      );
      
      if (todoCheck.trim()) {
        this.log('warning', 'TODO/FIXME items found in production code', todoCheck);
      }
      
      // Check for console.log statements
      const consoleCheck = execSync(
        'grep -r "console\\." src/ --exclude-dir=tests || true',
        { encoding: 'utf8' }
      );
      
      if (consoleCheck.trim()) {
        this.log('warning', 'Console statements found in production code', consoleCheck);
      }
      
      this.log('success', 'Code integrity validation passed');
      this.validationResults.validations.codeIntegrity = true;
      return true;
    } catch (error) {
      this.log('error', 'Code integrity validation failed', error.message);
      this.validationResults.validations.codeIntegrity = false;
      return false;
    }
  }

  async validateEnvironment() {
    this.log('info', 'Validating environment configuration...');
    
    try {
      const requiredEnvVars = [
        'NODE_ENV',
        'LOG_LEVEL'
      ];
      
      const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
      
      if (missingVars.length > 0) {
        this.log('warning', `Missing environment variables: ${missingVars.join(', ')}`);
      }
      
      // Validate NODE_ENV is appropriate
      if (process.env.NODE_ENV === 'development') {
        this.log('warning', 'NODE_ENV is set to development');
      }
      
      // Check for development-only settings
      if (process.env.DEBUG === 'true') {
        this.log('warning', 'DEBUG mode is enabled');
      }
      
      this.log('success', 'Environment validation completed');
      this.validationResults.validations.environment = true;
      return true;
    } catch (error) {
      this.log('error', 'Environment validation failed', error.message);
      this.validationResults.validations.environment = false;
      return false;
    }
  }

  async validateSecurity() {
    this.log('info', 'Running security validation...');
    
    try {
      // Run npm audit
      const auditResult = execSync('npm audit --audit-level=critical --json', { 
        encoding: 'utf8',
        stdio: 'pipe'
      });
      
      const audit = JSON.parse(auditResult);
      
      if (audit.metadata.vulnerabilities.critical > 0) {
        this.log('error', `Critical vulnerabilities found: ${audit.metadata.vulnerabilities.critical}`);
        return false;
      }
      
      if (audit.metadata.vulnerabilities.high > 5) {
        this.log('warning', `High vulnerabilities found: ${audit.metadata.vulnerabilities.high}`);
      }
      
      // Check for hardcoded secrets (basic patterns)
      const secretsCheck = execSync(
        'grep -r "password\\|secret\\|token\\|api_key" src/ --include="*.js" | grep -v "process.env" || true',
        { encoding: 'utf8' }
      );
      
      if (secretsCheck.trim()) {
        this.log('warning', 'Potential hardcoded credentials found', secretsCheck);
      }
      
      this.log('success', 'Security validation passed');
      this.validationResults.validations.security = true;
      return true;
    } catch (error) {
      this.log('error', 'Security validation failed', error.message);
      this.validationResults.validations.security = false;
      return false;
    }
  }

  async validatePerformance() {
    this.log('info', 'Running performance validation...');
    
    try {
      // Check package size
      const packageJson = await fs.readJson('package.json');
      const packageSize = await this.getPackageSize();
      
      if (packageSize > 2 * 1024 * 1024) { // 2MB
        this.log('warning', `Package size exceeds 2MB: ${(packageSize / 1024 / 1024).toFixed(2)}MB`);
      }
      
      // Test build performance
      const buildStart = Date.now();
      execSync('npm run build:validate', { stdio: 'pipe' });
      const buildTime = Date.now() - buildStart;
      
      if (buildTime > 60000) { // 1 minute
        this.log('warning', `Build time exceeds 1 minute: ${(buildTime / 1000).toFixed(2)}s`);
      }
      
      // Run performance benchmarks if available
      try {
        execSync('npm run benchmark:quick', { stdio: 'pipe' });
        this.log('success', 'Performance benchmarks completed');
      } catch (error) {
        this.log('info', 'Performance benchmarks not available');
      }
      
      this.log('success', 'Performance validation completed');
      this.validationResults.validations.performance = true;
      return true;
    } catch (error) {
      this.log('error', 'Performance validation failed', error.message);
      this.validationResults.validations.performance = false;
      return false;
    }
  }

  async validateFunctionality() {
    this.log('info', 'Running functionality validation...');
    
    try {
      // Run core tests
      execSync('npm run test:minimal', { stdio: 'pipe' });
      
      // Test CLI functionality
      execSync('node bin/unjucks.cjs --version', { stdio: 'pipe' });
      execSync('node bin/unjucks.cjs list', { stdio: 'pipe' });
      execSync('node bin/unjucks.cjs --help', { stdio: 'pipe' });
      
      // Run smoke tests
      execSync('npm run test:smoke', { stdio: 'pipe' });
      
      this.log('success', 'Functionality validation passed');
      this.validationResults.validations.functionality = true;
      return true;
    } catch (error) {
      this.log('error', 'Functionality validation failed', error.message);
      this.validationResults.validations.functionality = false;
      return false;
    }
  }

  async validateDeployment() {
    this.log('info', 'Running deployment validation...');
    
    try {
      // Validate package.json
      const packageJson = await fs.readJson('package.json');
      
      if (!packageJson.main) {
        this.log('error', 'package.json missing main entry point');
        return false;
      }
      
      if (!packageJson.bin) {
        this.log('error', 'package.json missing bin configuration');
        return false;
      }
      
      // Check required files exist
      const requiredFiles = [
        packageJson.main,
        Object.values(packageJson.bin)[0]
      ];
      
      for (const file of requiredFiles) {
        if (!await fs.pathExists(file)) {
          this.log('error', `Required file not found: ${file}`);
          return false;
        }
      }
      
      // Validate build artifacts
      if (await fs.pathExists('dist')) {
        const distFiles = await fs.readdir('dist');
        if (distFiles.length === 0) {
          this.log('warning', 'dist directory is empty');
        }
      }
      
      this.log('success', 'Deployment validation passed');
      this.validationResults.validations.deployment = true;
      return true;
    } catch (error) {
      this.log('error', 'Deployment validation failed', error.message);
      this.validationResults.validations.deployment = false;
      return false;
    }
  }

  async getPackageSize() {
    try {
      execSync('npm pack', { stdio: 'pipe' });
      const files = await fs.readdir('.');
      const tgzFile = files.find(f => f.endsWith('.tgz'));
      
      if (tgzFile) {
        const stats = await fs.stat(tgzFile);
        await fs.remove(tgzFile); // Cleanup
        return stats.size;
      }
      
      return 0;
    } catch (error) {
      return 0;
    }
  }

  async generateReport() {
    const reportPath = 'tests/production-validation-report.json';
    await fs.ensureDir(path.dirname(reportPath));
    await fs.writeJson(reportPath, this.validationResults, { spaces: 2 });
    
    // Generate markdown report
    const mdReportPath = 'tests/production-validation-report.md';
    const mdReport = this.generateMarkdownReport();
    await fs.writeFile(mdReportPath, mdReport);
    
    this.log('info', `Reports generated: ${reportPath}, ${mdReportPath}`);
  }

  generateMarkdownReport() {
    const { validations, errors, warnings, timestamp } = this.validationResults;
    
    const passCount = Object.values(validations).filter(Boolean).length;
    const totalCount = Object.keys(validations).length;
    const passRate = totalCount > 0 ? ((passCount / totalCount) * 100).toFixed(1) : 0;
    
    return `# Production Validation Report

**Timestamp:** ${timestamp}
**Environment:** ${this.validationResults.environment}
**Pass Rate:** ${passRate}% (${passCount}/${totalCount})

## Summary

| Validation | Status |
|------------|--------|
${Object.entries(validations).map(([name, passed]) => 
  `| ${name} | ${passed ? '✅ PASSED' : '❌ FAILED'} |`
).join('\n')}

## Errors (${errors.length})

${errors.length > 0 ? errors.map(error => 
  `- **${error.timestamp}**: ${error.message}${error.details ? `\n  \`\`\`\n  ${error.details}\n  \`\`\`` : ''}`
).join('\n') : 'No errors found.'}

## Warnings (${warnings.length})

${warnings.length > 0 ? warnings.map(warning => 
  `- **${warning.timestamp}**: ${warning.message}${warning.details ? `\n  \`\`\`\n  ${warning.details}\n  \`\`\`` : ''}`
).join('\n') : 'No warnings found.'}

## Recommendations

${passRate === 100 ? 
  '🎉 All validations passed! The application is ready for production deployment.' :
  '⚠️ Some validations failed or have warnings. Review the issues above before deploying to production.'
}

---
*Generated by Unjucks Production Validator*`;
  }

  async run() {
    this.log('info', 'Starting production validation...');
    
    const validations = [
      { name: 'Code Integrity', fn: () => this.validateCodeIntegrity() },
      { name: 'Environment', fn: () => this.validateEnvironment() },
      { name: 'Security', fn: () => this.validateSecurity() },
      { name: 'Performance', fn: () => this.validatePerformance() },
      { name: 'Functionality', fn: () => this.validateFunctionality() },
      { name: 'Deployment', fn: () => this.validateDeployment() }
    ];
    
    let allPassed = true;
    
    for (const validation of validations) {
      this.log('info', `Running ${validation.name} validation...`);
      
      try {
        const passed = await validation.fn();
        if (!passed) {
          allPassed = false;
        }
      } catch (error) {
        this.log('error', `${validation.name} validation failed with exception`, error.message);
        allPassed = false;
      }
    }
    
    await this.generateReport();
    
    if (allPassed) {
      this.log('success', 'All production validations passed! 🎉');
      process.exit(0);
    } else {
      this.log('error', 'Some production validations failed! ❌');
      process.exit(1);
    }
  }
}

// Run validation if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const validator = new ProductionValidator();
  validator.run().catch(error => {
    console.error(chalk.red('Production validation failed:'), error);
    process.exit(1);
  });
}

export default ProductionValidator;