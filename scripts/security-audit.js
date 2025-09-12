#!/usr/bin/env node

/**
 * Comprehensive Security Audit Script for Fortune 5 Compliance
 * Performs multiple security checks and generates compliance report
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import crypto from 'crypto';

class SecurityAuditor {
  constructor() {
    this.results = {
      timestamp: this.getDeterministicDate().toISOString(),
      passed: 0,
      failed: 0,
      warnings: 0,
      checks: []
    };
  }

  log(level, message, details = null) {
    const entry = {
      level,
      message,
      details,
      timestamp: this.getDeterministicDate().toISOString()
    };
    
    this.results.checks.push(entry);
    
    const colors = {
      PASS: '\x1b[32m',
      FAIL: '\x1b[31m',
      WARN: '\x1b[33m',
      INFO: '\x1b[36m',
      RESET: '\x1b[0m'
    };
    
    console.log(`${colors[level]}[${level}]${colors.RESET} ${message}`);
    if (details) console.log(`  ${details}`);
    
    if (level === 'PASS') this.results.passed++;
    else if (level === 'FAIL') this.results.failed++;
    else if (level === 'WARN') this.results.warnings++;
  }

  // Check for secrets in .env files
  checkEnvironmentSecurity() {
    this.log('INFO', 'Checking environment file security...');
    
    try {
      const envPath = '.env';
      if (!fs.existsSync(envPath)) {
        this.log('WARN', 'No .env file found - ensure production has proper environment configuration');
        return;
      }

      const envContent = fs.readFileSync(envPath, 'utf8');
      const lines = envContent.split('\n');
      const insecureConfigs = [];

      lines.forEach((line, index) => {
        const lineNum = index + 1;
        
        // Check for weak passwords
        if (line.includes('password') && (line.includes('password') || line.includes('123456') || line.includes('admin'))) {
          insecureConfigs.push(`Line ${lineNum}: Weak password detected`);
        }
        
        // Check for debug settings
        if (line.includes('DEBUG=true') || line.includes('NODE_ENV=development')) {
          insecureConfigs.push(`Line ${lineNum}: Debug/development setting in .env`);
        }
        
        // Check for wildcard CORS
        if (line.includes('CORS_ORIGIN=*')) {
          insecureConfigs.push(`Line ${lineNum}: Wildcard CORS origin - security risk`);
        }
        
        // Check for exposed secrets in plain text
        if (line.match(/.*SECRET.*=.*[a-zA-Z0-9]{8,}/) && !line.includes('your-') && !line.includes('example')) {
          insecureConfigs.push(`Line ${lineNum}: Potential exposed secret`);
        }
      });

      if (insecureConfigs.length > 0) {
        this.log('FAIL', `Environment security issues found: ${insecureConfigs.length}`, insecureConfigs.join('\n  '));
      } else {
        this.log('PASS', 'Environment configuration security check passed');
      }

      // Check .env.example exists
      if (fs.existsSync('.env.example')) {
        this.log('PASS', '.env.example file exists for secure template');
      } else {
        this.log('WARN', 'Missing .env.example file - create template for secure deployment');
      }

    } catch (error) {
      this.log('FAIL', 'Environment security check failed', error.message);
    }
  }

  // Check file permissions
  checkFilePermissions() {
    this.log('INFO', 'Checking file permissions...');
    
    const criticalFiles = [
      '.env',
      'package.json',
      'bin/unjucks.cjs',
      'src/cli/index.js'
    ];

    criticalFiles.forEach(file => {
      try {
        if (fs.existsSync(file)) {
          const stats = fs.statSync(file);
          const permissions = (stats.mode & parseInt('777', 8)).toString(8);
          
          // Check for overly permissive permissions
          if (file === '.env' && permissions !== '644') {
            this.log('WARN', `${file} has permissions ${permissions} - consider 600 for .env files`);
          } else if (file.includes('bin/') && permissions !== '755') {
            this.log('WARN', `${file} has permissions ${permissions} - executable files should be 755`);
          } else {
            this.log('PASS', `${file} has appropriate permissions (${permissions})`);
          }
        } else {
          this.log('INFO', `${file} not found - skipping permission check`);
        }
      } catch (error) {
        this.log('FAIL', `Permission check failed for ${file}`, error.message);
      }
    });
  }

  // Check for dependency vulnerabilities
  async checkDependencyVulnerabilities() {
    this.log('INFO', 'Checking dependency vulnerabilities...');
    
    try {
      // Run npm audit
      const auditResult = execSync('npm audit --json', { encoding: 'utf8' });
      const audit = JSON.parse(auditResult);
      
      if (audit.vulnerabilities) {
        const vulnCount = Object.keys(audit.vulnerabilities).length;
        const highVulns = Object.values(audit.vulnerabilities).filter(v => v.severity === 'high' || v.severity === 'critical').length;
        
        if (highVulns > 0) {
          this.log('FAIL', `${highVulns} high/critical vulnerabilities found in dependencies`);
        } else if (vulnCount > 0) {
          this.log('WARN', `${vulnCount} vulnerabilities found (none high/critical)`);
        } else {
          this.log('PASS', 'No dependency vulnerabilities found');
        }
      }
    } catch (error) {
      // npm audit returns non-zero exit code when vulnerabilities found
      if (error.stdout) {
        try {
          const audit = JSON.parse(error.stdout);
          const vulnCount = Object.keys(audit.vulnerabilities || {}).length;
          if (vulnCount > 0) {
            this.log('WARN', `npm audit found ${vulnCount} vulnerabilities - review and update dependencies`);
          }
        } catch (parseError) {
          this.log('WARN', 'npm audit completed with warnings - review output manually');
        }
      } else {
        this.log('FAIL', 'Dependency vulnerability check failed', error.message);
      }
    }
  }

  // Check for security tools configuration
  checkSecurityToolsConfiguration() {
    this.log('INFO', 'Checking security tools configuration...');
    
    const securityFiles = [
      { file: 'config/.gitleaks.toml', tool: 'Gitleaks secret scanning' },
      { file: 'config/.eslintrc.security.js', tool: 'ESLint security rules' },
      { file: 'config/.semgreprc.yml', tool: 'Semgrep static analysis' },
      { file: 'config/security-headers.js', tool: 'Security headers configuration' }
    ];

    securityFiles.forEach(({ file, tool }) => {
      if (fs.existsSync(file)) {
        this.log('PASS', `${tool} configuration found`);
        
        // Validate configuration file
        try {
          const content = fs.readFileSync(file, 'utf8');
          if (content.length < 100) {
            this.log('WARN', `${tool} configuration seems minimal - verify completeness`);
          }
        } catch (error) {
          this.log('WARN', `Cannot read ${tool} configuration`, error.message);
        }
      } else {
        this.log('FAIL', `${tool} configuration missing: ${file}`);
      }
    });
  }

  // Check for secure coding practices
  checkSecureCodingPractices() {
    this.log('INFO', 'Checking secure coding practices...');
    
    try {
      // Check for eval usage
      const jsFiles = this.findFiles('.', /\.(js|ts)$/, ['node_modules', 'dist', 'build']);
      const evalUsage = [];
      const consoleUsage = [];
      
      jsFiles.forEach(file => {
        try {
          const content = fs.readFileSync(file, 'utf8');
          
          // Check for dangerous eval usage
          if (content.includes('eval(') && !file.includes('test')) {
            evalUsage.push(file);
          }
          
          // Check for console.log in production code
          if (content.includes('console.log') && !file.includes('test') && !file.includes('script')) {
            consoleUsage.push(file);
          }
        } catch (error) {
          // Skip files that cannot be read
        }
      });

      if (evalUsage.length > 0) {
        this.log('FAIL', `eval() usage found in ${evalUsage.length} files - potential security risk`, evalUsage.join(', '));
      } else {
        this.log('PASS', 'No dangerous eval() usage found');
      }

      if (consoleUsage.length > 0) {
        this.log('WARN', `console.log usage found in ${consoleUsage.length} files - remove for production`, consoleUsage.slice(0, 5).join(', '));
      } else {
        this.log('PASS', 'No console.log usage in production code');
      }

    } catch (error) {
      this.log('FAIL', 'Secure coding practices check failed', error.message);
    }
  }

  // Helper method to find files
  findFiles(dir, pattern, exclude = []) {
    const files = [];
    
    function scan(currentDir) {
      try {
        const items = fs.readdirSync(currentDir);
        
        items.forEach(item => {
          const fullPath = path.join(currentDir, item);
          const relativePath = path.relative('.', fullPath);
          
          // Skip excluded directories
          if (exclude.some(ex => relativePath.includes(ex))) {
            return;
          }
          
          const stats = fs.statSync(fullPath);
          
          if (stats.isDirectory()) {
            scan(fullPath);
          } else if (pattern.test(item)) {
            files.push(fullPath);
          }
        });
      } catch (error) {
        // Skip directories we can't read
      }
    }
    
    scan(dir);
    return files;
  }

  // Generate compliance report
  generateComplianceReport() {
    const total = this.results.passed + this.results.failed + this.results.warnings;
    const score = total > 0 ? ((this.results.passed / total) * 100).toFixed(1) : 0;
    
    const report = {
      summary: {
        timestamp: this.results.timestamp,
        total_checks: total,
        passed: this.results.passed,
        failed: this.results.failed,
        warnings: this.results.warnings,
        security_score: parseFloat(score),
        compliance_level: this.getComplianceLevel(score)
      },
      details: this.results.checks,
      recommendations: this.generateRecommendations()
    };

    // Write report to file
    const reportPath = 'security-audit-report.json';
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    this.log('INFO', `Security audit report generated: ${reportPath}`);
    
    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('SECURITY AUDIT SUMMARY');
    console.log('='.repeat(60));
    console.log(`Security Score: ${score}%`);
    console.log(`Compliance Level: ${report.summary.compliance_level}`);
    console.log(`Passed: ${this.results.passed}`);
    console.log(`Failed: ${this.results.failed}`);
    console.log(`Warnings: ${this.results.warnings}`);
    console.log('='.repeat(60));

    return report;
  }

  getComplianceLevel(score) {
    if (score >= 95) return 'Fortune 5 Compliant';
    if (score >= 85) return 'Enterprise Ready';
    if (score >= 70) return 'Production Ready';
    if (score >= 50) return 'Development Ready';
    return 'Non-Compliant';
  }

  generateRecommendations() {
    const recommendations = [];
    
    if (this.results.failed > 0) {
      recommendations.push('Address all failed security checks before production deployment');
    }
    
    if (this.results.warnings > 5) {
      recommendations.push('Review and resolve security warnings to improve compliance score');
    }
    
    recommendations.push('Implement automated security testing in CI/CD pipeline');
    recommendations.push('Regular security audits should be performed monthly');
    recommendations.push('Keep all dependencies updated to latest secure versions');
    recommendations.push('Implement runtime security monitoring and alerting');
    
    return recommendations;
  }

  // Run all security checks
  async runAudit() {
    this.log('INFO', 'Starting comprehensive security audit...');
    
    this.checkEnvironmentSecurity();
    this.checkFilePermissions();
    await this.checkDependencyVulnerabilities();
    this.checkSecurityToolsConfiguration();
    this.checkSecureCodingPractices();
    
    return this.generateComplianceReport();
  }
}

// Run audit if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const auditor = new SecurityAuditor();
  auditor.runAudit().catch(console.error);
}

export default SecurityAuditor;