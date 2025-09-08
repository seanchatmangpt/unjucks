#!/usr/bin/env node

/**
 * Static Application Security Testing (SAST) Script
 * Scans for common security vulnerabilities in JavaScript and template files
 */

import { readFileSync, writeFileSync } from 'fs';
import { glob } from 'glob';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

class SecurityAnalyzer {
  constructor() {
    this.vulnerabilities = [];
    this.stats = {
      filesScanned: 0,
      vulnerabilitiesFound: 0,
      critical: 0,
      high: 0,
      medium: 0,
      low: 0
    };
  }

  getSecurityRules() {
    return [
      // Code injection vulnerabilities
      {
        pattern: /eval\s*\(/g,
        severity: 'critical',
        message: 'Use of eval() - potential code injection',
        cwe: 'CWE-94'
      },
      {
        pattern: /Function\s*\(/g,
        severity: 'high',
        message: 'Dynamic function construction - potential code injection',
        cwe: 'CWE-94'
      },
      {
        pattern: /setTimeout\s*\(\s*["'`][^"'`]*["'`]/g,
        severity: 'medium',
        message: 'setTimeout with string argument - use function instead',
        cwe: 'CWE-94'
      },

      // Command injection
      {
        pattern: /exec\s*\(/g,
        severity: 'high',
        message: 'Use of exec() - potential command injection',
        cwe: 'CWE-78'
      },
      {
        pattern: /spawn\s*\([^)]*\+/g,
        severity: 'high',
        message: 'Dynamic spawn() call - potential command injection',
        cwe: 'CWE-78'
      },

      // Path traversal
      {
        pattern: /\.\.\//g,
        severity: 'medium',
        message: 'Path traversal pattern detected',
        cwe: 'CWE-22'
      },
      {
        pattern: /readFileSync\s*\([^)]*\+/g,
        severity: 'medium',
        message: 'Dynamic file path in readFileSync - potential path traversal',
        cwe: 'CWE-22'
      },

      // Template injection
      {
        pattern: /nunjucks\.renderString\s*\([^)]*\+/g,
        severity: 'high',
        message: 'Dynamic template rendering - potential template injection',
        cwe: 'CWE-94'
      },
      {
        pattern: /\{\{\s*[^}]*\|\s*safe\s*\}\}/g,
        severity: 'high',
        message: 'Unsafe filter in template - potential XSS',
        cwe: 'CWE-79'
      },

      // Cryptographic issues
      {
        pattern: /Math\.random\(\)/g,
        severity: 'medium',
        message: 'Weak random number generation - use crypto.randomBytes()',
        cwe: 'CWE-330'
      },
      {
        pattern: /md5\s*\(/g,
        severity: 'medium',
        message: 'MD5 is cryptographically broken - use SHA-256 or better',
        cwe: 'CWE-327'
      },

      // Information disclosure
      {
        pattern: /console\.log\s*\([^)]*password/gi,
        severity: 'high',
        message: 'Potential password logging',
        cwe: 'CWE-532'
      },
      {
        pattern: /console\.log\s*\([^)]*token/gi,
        severity: 'high',
        message: 'Potential token logging',
        cwe: 'CWE-532'
      },
      {
        pattern: /process\.env\[.*\+/g,
        severity: 'medium',
        message: 'Dynamic environment variable access',
        cwe: 'CWE-20'
      },

      // Regular expression DoS
      {
        pattern: /new RegExp\([^)]*\+/g,
        severity: 'medium',
        message: 'Dynamic regex construction - potential ReDoS',
        cwe: 'CWE-1333'
      },

      // Prototype pollution
      {
        pattern: /\[.*__proto__.*\]/g,
        severity: 'high',
        message: 'Potential prototype pollution',
        cwe: 'CWE-1321'
      },
      {
        pattern: /\[.*constructor.*\]/g,
        severity: 'medium',
        message: 'Constructor property access - potential prototype pollution',
        cwe: 'CWE-1321'
      },

      // Hardcoded secrets
      {
        pattern: /password\s*[=:]\s*["'][^"']{8,}/gi,
        severity: 'critical',
        message: 'Hardcoded password detected',
        cwe: 'CWE-798'
      },
      {
        pattern: /api[_-]?key\s*[=:]\s*["'][^"']{10,}/gi,
        severity: 'critical',
        message: 'Hardcoded API key detected',
        cwe: 'CWE-798'
      },
      {
        pattern: /secret\s*[=:]\s*["'][^"']{10,}/gi,
        severity: 'critical',
        message: 'Hardcoded secret detected',
        cwe: 'CWE-798'
      },

      // Unsafe file operations
      {
        pattern: /writeFileSync\s*\([^)]*\+/g,
        severity: 'medium',
        message: 'Dynamic file write path - validate input',
        cwe: 'CWE-22'
      },
      {
        pattern: /unlinkSync\s*\([^)]*\+/g,
        severity: 'high',
        message: 'Dynamic file deletion - potential file system manipulation',
        cwe: 'CWE-22'
      }
    ];
  }

  async scanFile(filePath) {
    try {
      const content = readFileSync(filePath, 'utf8');
      const fileName = filePath.replace(rootDir, '');
      const rules = this.getSecurityRules();

      const fileVulnerabilities = [];

      for (const rule of rules) {
        const matches = [...content.matchAll(rule.pattern)];
        
        for (const match of matches) {
          const lineNumber = this.getLineNumber(content, match.index);
          const lineContent = this.getLineContent(content, match.index);
          
          const vulnerability = {
            file: fileName,
            line: lineNumber,
            column: match.index - content.lastIndexOf('\n', match.index - 1),
            severity: rule.severity,
            message: rule.message,
            cwe: rule.cwe,
            pattern: match[0],
            context: lineContent.trim(),
            rule: rule.pattern.toString()
          };

          fileVulnerabilities.push(vulnerability);
          this.vulnerabilities.push(vulnerability);
          this.stats[rule.severity]++;
        }
      }

      this.stats.filesScanned++;
      return fileVulnerabilities;

    } catch (error) {
      console.error(`Error scanning ${filePath}:`, error.message);
      return [];
    }
  }

  getLineNumber(content, index) {
    return content.substring(0, index).split('\n').length;
  }

  getLineContent(content, index) {
    const lines = content.split('\n');
    const lineNumber = this.getLineNumber(content, index) - 1;
    return lines[lineNumber] || '';
  }

  async scanAllFiles() {
    console.log('🔍 Starting security analysis...\n');

    // Scan JavaScript files
    const jsFiles = await glob('src/**/*.js', { cwd: rootDir });
    const scriptFiles = await glob('scripts/**/*.js', { cwd: rootDir });
    const templateFiles = await glob('templates/**/*.{js,njk}', { cwd: rootDir });
    const testFiles = await glob('tests/**/*.js', { cwd: rootDir });

    const allFiles = [...jsFiles, ...scriptFiles, ...templateFiles, ...testFiles];

    console.log(`Found ${allFiles.length} files to scan\n`);

    for (const file of allFiles) {
      const filePath = join(rootDir, file);
      await this.scanFile(filePath);
    }

    this.stats.vulnerabilitiesFound = this.vulnerabilities.length;
  }

  generateReport() {
    console.log('\n🛡️  Security Analysis Results');
    console.log('═'.repeat(50));
    
    console.log(`Files Scanned: ${this.stats.filesScanned}`);
    console.log(`Vulnerabilities Found: ${this.stats.vulnerabilitiesFound}`);
    console.log(`Critical: ${this.stats.critical}`);
    console.log(`High: ${this.stats.high}`);
    console.log(`Medium: ${this.stats.medium}`);
    console.log(`Low: ${this.stats.low}`);

    if (this.vulnerabilities.length > 0) {
      console.log('\n🔍 Vulnerability Details:');
      console.log('─'.repeat(50));

      // Group by severity
      const groupedVulns = this.vulnerabilities.reduce((acc, vuln) => {
        if (!acc[vuln.severity]) acc[vuln.severity] = [];
        acc[vuln.severity].push(vuln);
        return acc;
      }, {});

      ['critical', 'high', 'medium', 'low'].forEach(severity => {
        if (groupedVulns[severity]) {
          const icon = severity === 'critical' ? '🔴' : severity === 'high' ? '🟠' : 
                      severity === 'medium' ? '🟡' : '🟢';
          
          console.log(`\n${icon} ${severity.toUpperCase()} (${groupedVulns[severity].length})`);
          
          groupedVulns[severity].forEach(vuln => {
            console.log(`  📁 ${vuln.file}:${vuln.line}:${vuln.column}`);
            console.log(`     ${vuln.message} (${vuln.cwe})`);
            console.log(`     Code: ${vuln.context}`);
            console.log('');
          });
        }
      });
    }

    // Save detailed report
    const reportPath = join(rootDir, 'tests/sast-report.json');
    const reportData = {
      timestamp: new Date().toISOString(),
      summary: this.stats,
      vulnerabilities: this.vulnerabilities,
      riskScore: this.calculateRiskScore()
    };

    try {
      writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
      console.log(`📋 Detailed report saved to: ${reportPath}`);
    } catch (error) {
      console.error('❌ Failed to save report:', error.message);
    }

    // Risk assessment
    const riskScore = this.calculateRiskScore();
    console.log(`\n📊 Risk Score: ${riskScore}/100`);
    
    if (riskScore >= 80) {
      console.log('🔴 HIGH RISK - Immediate attention required');
    } else if (riskScore >= 50) {
      console.log('🟡 MEDIUM RISK - Address critical and high severity issues');
    } else if (riskScore >= 20) {
      console.log('🟢 LOW RISK - Monitor and address over time');
    } else {
      console.log('✅ MINIMAL RISK - Good security posture');
    }

    // Exit with error code if critical issues found
    if (this.stats.critical > 0) {
      console.log(`\n❌ Security scan failed: ${this.stats.critical} critical vulnerabilities found`);
      process.exit(1);
    } else if (this.stats.high > 0) {
      console.log(`\n⚠️  Security scan completed with warnings: ${this.stats.high} high severity vulnerabilities`);
      process.exit(0);
    } else {
      console.log('\n✅ Security scan passed: No critical vulnerabilities found');
    }
  }

  calculateRiskScore() {
    const weights = { critical: 25, high: 10, medium: 3, low: 1 };
    return Math.min(100, 
      this.stats.critical * weights.critical +
      this.stats.high * weights.high +
      this.stats.medium * weights.medium +
      this.stats.low * weights.low
    );
  }
}

// Run analysis if called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const analyzer = new SecurityAnalyzer();
  analyzer.scanAllFiles()
    .then(() => analyzer.generateReport())
    .catch(error => {
      console.error('❌ Security analysis failed:', error);
      process.exit(1);
    });
}

export default SecurityAnalyzer;