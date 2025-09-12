#!/usr/bin/env node

/**
 * Security Testing and Vulnerability Scanner
 * Scans for security vulnerabilities and enforces security best practices
 */

import fs from 'fs-extra';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

class SecurityScanner {
  constructor() {
    this.vulnerabilities = [];
    this.reportsDir = path.join(projectRoot, 'tests/reports');
    this.securityPatterns = {
      // Code injection patterns
      codeInjection: [
        /eval\s*\(/gi,
        /Function\s*\(/gi,
        /setTimeout\s*\(\s*["'`][^"'`]*["'`]/gi,
        /setInterval\s*\(\s*["'`][^"'`]*["'`]/gi
      ],
      
      // File system vulnerabilities
      pathTraversal: [
        /\.\.\/\.\./g,
        /\.\.\\\.\./g,
        /path\.join\([^)]*\.\./g
      ],
      
      // Sensitive data exposure
      sensitiveData: [
        /password\s*[=:]\s*["'`][^"'`]+["'`]/gi,
        /api_key\s*[=:]\s*["'`][^"'`]+["'`]/gi,
        /secret\s*[=:]\s*["'`][^"'`]+["'`]/gi,
        /token\s*[=:]\s*["'`][^"'`]+["'`]/gi
      ],
      
      // Template injection
      templateInjection: [
        /<%-.*user.*%>/gi,
        /<%-.*req\.(query|body|params).*%>/gi,
        /<%.*eval.*%>/gi
      ],
      
      // Command injection
      commandInjection: [
        /exec\s*\(/gi,
        /execSync\s*\(/gi,
        /spawn\s*\([^)]*\$\{/gi,
        /system\s*\(/gi
      ]
    };
  }

  async scanProject() {
    console.log('🔒 Starting Security Scan...');
    
    await fs.ensureDir(this.reportsDir);
    this.vulnerabilities = [];
    
    const results = {
      timestamp: this.getDeterministicDate().toISOString(),
      scans: {
        codeAnalysis: await this.scanSourceCode(),
        dependencyCheck: await this.checkDependencies(),
        configurationAudit: await this.auditConfiguration(),
        templateSecurity: await this.scanTemplates(),
        filePermissions: await this.checkFilePermissions()
      },
      vulnerabilities: this.vulnerabilities,
      riskLevel: this.calculateRiskLevel(),
      recommendations: this.generateRecommendations()
    };
    
    await this.saveSecurityReport(results);
    this.displayResults(results);
    
    return results;
  }

  async scanSourceCode() {
    console.log('   📋 Scanning source code for vulnerabilities...');
    
    const sourceFiles = await this.findFiles(['src/**/*.js', 'tests/**/*.js', 'bin/**/*.js']);
    const findings = [];
    
    for (const file of sourceFiles) {
      const content = await fs.readFile(file, 'utf8');
      const fileFindings = this.scanFileContent(file, content);
      findings.push(...fileFindings);
    }
    
    return {
      filesScanned: sourceFiles.length,
      vulnerabilitiesFound: findings.length,
      findings
    };
  }

  scanFileContent(filePath, content) {
    const findings = [];
    const lines = content.split('\n');
    
    Object.entries(this.securityPatterns).forEach(([category, patterns]) => {
      patterns.forEach(pattern => {
        lines.forEach((line, index) => {
          const matches = line.match(pattern);
          if (matches) {
            const vulnerability = {
              type: category,
              severity: this.getSeverity(category),
              file: filePath.replace(projectRoot, ''),
              line: index + 1,
              code: line.trim(),
              pattern: pattern.toString(),
              description: this.getVulnerabilityDescription(category)
            };
            
            findings.push(vulnerability);
            this.vulnerabilities.push(vulnerability);
          }
        });
      });
    });
    
    return findings;
  }

  async checkDependencies() {
    console.log('   📦 Checking dependencies for known vulnerabilities...');
    
    try {
      const auditResult = await this.executeCommand('npm audit --json');
      const auditData = JSON.parse(auditResult.stdout);
      
      const vulnerabilities = [];
      
      if (auditData.vulnerabilities) {
        Object.entries(auditData.vulnerabilities).forEach(([packageName, vuln]) => {
          vulnerabilities.push({
            type: 'dependency',
            severity: vuln.severity || 'unknown',
            package: packageName,
            version: vuln.range,
            description: vuln.title || 'Known vulnerability in dependency',
            cve: vuln.cves || [],
            recommendation: `Update ${packageName} to a secure version`
          });
        });
      }
      
      this.vulnerabilities.push(...vulnerabilities);
      
      return {
        totalDependencies: Object.keys(auditData.vulnerabilities || {}).length,
        vulnerablePackages: vulnerabilities.length,
        vulnerabilities
      };
    } catch (error) {
      return {
        error: error.message,
        totalDependencies: 0,
        vulnerablePackages: 0,
        vulnerabilities: []
      };
    }
  }

  async auditConfiguration() {
    console.log('   ⚙️  Auditing configuration files...');
    
    const findings = [];
    const configFiles = ['package.json', '.env', '.env.example', 'config/**/*'];
    
    for (const pattern of configFiles) {
      const files = await this.findFiles([pattern]);
      
      for (const file of files) {
        if (await fs.pathExists(file)) {
          const content = await fs.readFile(file, 'utf8');
          const configFindings = this.auditConfigFile(file, content);
          findings.push(...configFindings);
        }
      }
    }
    
    return {
      filesAudited: configFiles.length,
      issues: findings.length,
      findings
    };
  }

  auditConfigFile(filePath, content) {
    const findings = [];
    
    // Check for hardcoded secrets
    const secretPatterns = [
      { pattern: /"password"\s*:\s*"[^"]+"/gi, issue: 'Hardcoded password in config' },
      { pattern: /"secret"\s*:\s*"[^"]+"/gi, issue: 'Hardcoded secret in config' },
      { pattern: /"api_key"\s*:\s*"[^"]+"/gi, issue: 'Hardcoded API key in config' },
      { pattern: /"token"\s*:\s*"[^"]+"/gi, issue: 'Hardcoded token in config' }
    ];
    
    secretPatterns.forEach(({ pattern, issue }) => {
      if (pattern.test(content)) {
        const vulnerability = {
          type: 'configuration',
          severity: 'high',
          file: filePath.replace(projectRoot, ''),
          issue,
          description: 'Sensitive data should not be hardcoded in configuration files'
        };
        
        findings.push(vulnerability);
        this.vulnerabilities.push(vulnerability);
      }
    });
    
    // Check for insecure configurations
    if (filePath.includes('package.json')) {
      try {
        const pkg = JSON.parse(content);
        
        // Check for scripts with potential security issues
        if (pkg.scripts) {
          Object.entries(pkg.scripts).forEach(([scriptName, script]) => {
            if (script.includes('curl') || script.includes('wget')) {
              findings.push({
                type: 'configuration',
                severity: 'medium',
                file: filePath.replace(projectRoot, ''),
                issue: `Script '${scriptName}' downloads content from internet`,
                description: 'Review scripts that download content for security implications'
              });
            }
          });
        }
      } catch (error) {
        // Invalid JSON, but that's not a security issue
      }
    }
    
    return findings;
  }

  async scanTemplates() {
    console.log('   🎨 Scanning templates for security issues...');
    
    const templateFiles = await this.findFiles(['_templates/**/*.ejs', 'templates/**/*.ejs']);
    const findings = [];
    
    for (const file of templateFiles) {
      const content = await fs.readFile(file, 'utf8');
      const templateFindings = this.scanTemplateContent(file, content);
      findings.push(...templateFindings);
    }
    
    return {
      templatesScanned: templateFiles.length,
      issues: findings.length,
      findings
    };
  }

  scanTemplateContent(filePath, content) {
    const findings = [];
    
    // Check for unescaped output (XSS potential)
    const unescapedOutputs = content.match(/<%-[^%]+%>/g);
    if (unescapedOutputs) {
      findings.push({
        type: 'templateSecurity',
        severity: 'high',
        file: filePath.replace(projectRoot, ''),
        issue: 'Unescaped template output detected',
        description: 'Use <%=%> instead of <%-% to prevent XSS attacks',
        examples: unescapedOutputs.slice(0, 3)
      });
    }
    
    // Check for dangerous template operations
    const dangerousPatterns = [
      { pattern: /<%.*eval.*%>/gi, issue: 'eval() usage in template' },
      { pattern: /<%.*require.*%>/gi, issue: 'require() usage in template' },
      { pattern: /<%.*import.*%>/gi, issue: 'import usage in template' }
    ];
    
    dangerousPatterns.forEach(({ pattern, issue }) => {
      if (pattern.test(content)) {
        findings.push({
          type: 'templateSecurity',
          severity: 'critical',
          file: filePath.replace(projectRoot, ''),
          issue,
          description: 'Dangerous operations in templates can lead to code injection'
        });
      }
    });
    
    this.vulnerabilities.push(...findings);
    return findings;
  }

  async checkFilePermissions() {
    console.log('   📝 Checking file permissions...');
    
    const findings = [];
    const criticalFiles = [
      'package.json',
      'bin/unjucks.cjs',
      'src/cli/index.js'
    ];
    
    for (const file of criticalFiles) {
      const filePath = path.join(projectRoot, file);
      
      if (await fs.pathExists(filePath)) {
        try {
          const stats = await fs.stat(filePath);
          const mode = stats.mode.toString(8);
          
          // Check for overly permissive permissions
          if (mode.endsWith('777') || mode.endsWith('666')) {
            findings.push({
              type: 'filePermissions',
              severity: 'medium',
              file,
              issue: `File has overly permissive permissions: ${mode}`,
              description: 'Reduce file permissions to prevent unauthorized access'
            });
          }
        } catch (error) {
          // Ignore permission check errors
        }
      }
    }
    
    this.vulnerabilities.push(...findings);
    
    return {
      filesChecked: criticalFiles.length,
      issues: findings.length,
      findings
    };
  }

  async findFiles(patterns) {
    const { glob } = await import('glob');
    const allFiles = [];
    
    for (const pattern of patterns) {
      try {
        const files = await glob(pattern, { cwd: projectRoot });
        allFiles.push(...files.map(f => path.join(projectRoot, f)));
      } catch (error) {
        // Ignore glob errors
      }
    }
    
    return [...new Set(allFiles)];
  }

  getSeverity(category) {
    const severityMap = {
      codeInjection: 'critical',
      commandInjection: 'critical',
      templateInjection: 'high',
      pathTraversal: 'high',
      sensitiveData: 'high',
      configuration: 'medium',
      filePermissions: 'medium'
    };
    
    return severityMap[category] || 'low';
  }

  getVulnerabilityDescription(category) {
    const descriptions = {
      codeInjection: 'Potential code injection vulnerability detected',
      commandInjection: 'Potential command injection vulnerability detected',
      templateInjection: 'Potential template injection vulnerability detected',
      pathTraversal: 'Potential path traversal vulnerability detected',
      sensitiveData: 'Sensitive data exposure detected',
      configuration: 'Insecure configuration detected',
      filePermissions: 'Insecure file permissions detected'
    };
    
    return descriptions[category] || 'Security issue detected';
  }

  calculateRiskLevel() {
    const severityCounts = {
      critical: this.vulnerabilities.filter(v => v.severity === 'critical').length,
      high: this.vulnerabilities.filter(v => v.severity === 'high').length,
      medium: this.vulnerabilities.filter(v => v.severity === 'medium').length,
      low: this.vulnerabilities.filter(v => v.severity === 'low').length
    };
    
    if (severityCounts.critical > 0) return 'CRITICAL';
    if (severityCounts.high > 0) return 'HIGH';
    if (severityCounts.medium > 0) return 'MEDIUM';
    if (severityCounts.low > 0) return 'LOW';
    return 'MINIMAL';
  }

  generateRecommendations() {
    const recommendations = [];
    
    const criticalVulns = this.vulnerabilities.filter(v => v.severity === 'critical');
    const highVulns = this.vulnerabilities.filter(v => v.severity === 'high');
    
    if (criticalVulns.length > 0) {
      recommendations.push('URGENT: Address all critical vulnerabilities immediately');
    }
    
    if (highVulns.length > 0) {
      recommendations.push('Address high-severity vulnerabilities in next release');
    }
    
    // Specific recommendations based on vulnerability types
    const vulnTypes = [...new Set(this.vulnerabilities.map(v => v.type))];
    
    if (vulnTypes.includes('templateInjection')) {
      recommendations.push('Review template security: use <%=%> instead of <%-% for user input');
    }
    
    if (vulnTypes.includes('sensitiveData')) {
      recommendations.push('Move sensitive data to environment variables');
    }
    
    if (vulnTypes.includes('dependency')) {
      recommendations.push('Run npm audit fix to update vulnerable dependencies');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('No critical security issues found - maintain current security practices');
    }
    
    return recommendations;
  }

  async executeCommand(command) {
    return new Promise((resolve, reject) => {
      const [cmd, ...args] = command.split(' ');
      const process = spawn(cmd, args, {
        cwd: projectRoot,
        stdio: ['ignore', 'pipe', 'pipe']
      });
      
      let stdout = '';
      let stderr = '';
      
      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      process.on('close', (code) => {
        resolve({ code, stdout, stderr });
      });
      
      process.on('error', reject);
    });
  }

  async saveSecurityReport(results) {
    await fs.writeJSON(
      path.join(this.reportsDir, 'security-report.json'),
      results,
      { spaces: 2 }
    );
    
    // Generate human-readable report
    const readableReport = this.generateReadableReport(results);
    await fs.writeFile(
      path.join(this.reportsDir, 'security-report.txt'),
      readableReport
    );
  }

  generateReadableReport(results) {
    let report = 'SECURITY SCAN REPORT\n';
    report += '='.repeat(50) + '\n\n';
    report += `Scan Date: ${new Date(results.timestamp).toLocaleString()}\n`;
    report += `Risk Level: ${results.riskLevel}\n`;
    report += `Total Vulnerabilities: ${results.vulnerabilities.length}\n\n`;
    
    // Summary by severity
    const severityCounts = {
      critical: results.vulnerabilities.filter(v => v.severity === 'critical').length,
      high: results.vulnerabilities.filter(v => v.severity === 'high').length,
      medium: results.vulnerabilities.filter(v => v.severity === 'medium').length,
      low: results.vulnerabilities.filter(v => v.severity === 'low').length
    };
    
    report += 'SEVERITY BREAKDOWN:\n';
    report += `  Critical: ${severityCounts.critical}\n`;
    report += `  High: ${severityCounts.high}\n`;
    report += `  Medium: ${severityCounts.medium}\n`;
    report += `  Low: ${severityCounts.low}\n\n`;
    
    // Scan results
    Object.entries(results.scans).forEach(([scanType, scanResult]) => {
      report += `${scanType.toUpperCase()}:\n`;
      if (scanResult.error) {
        report += `  Error: ${scanResult.error}\n`;
      } else {
        report += `  Files scanned: ${scanResult.filesScanned || scanResult.filesChecked || scanResult.filesAudited || 'N/A'}\n`;
        report += `  Issues found: ${scanResult.vulnerabilitiesFound || scanResult.issues || 0}\n`;
      }
      report += '\n';
    });
    
    // Recommendations
    if (results.recommendations.length > 0) {
      report += 'RECOMMENDATIONS:\n';
      results.recommendations.forEach((rec, index) => {
        report += `  ${index + 1}. ${rec}\n`;
      });
      report += '\n';
    }
    
    // Detailed findings
    if (results.vulnerabilities.length > 0) {
      report += 'DETAILED FINDINGS:\n';
      results.vulnerabilities.forEach((vuln, index) => {
        report += `\n${index + 1}. [${vuln.severity.toUpperCase()}] ${vuln.type}\n`;
        if (vuln.file) report += `   File: ${vuln.file}\n`;
        if (vuln.line) report += `   Line: ${vuln.line}\n`;
        report += `   Description: ${vuln.description}\n`;
        if (vuln.code) report += `   Code: ${vuln.code}\n`;
      });
    }
    
    return report;
  }

  displayResults(results) {
    console.log('\n🔒 Security Scan Results:');
    console.log('=' * 40);
    console.log(`🏁 Risk Level: ${results.riskLevel}`);
    console.log(`📊 Total Vulnerabilities: ${results.vulnerabilities.length}`);
    
    const severityCounts = {
      critical: results.vulnerabilities.filter(v => v.severity === 'critical').length,
      high: results.vulnerabilities.filter(v => v.severity === 'high').length,
      medium: results.vulnerabilities.filter(v => v.severity === 'medium').length,
      low: results.vulnerabilities.filter(v => v.severity === 'low').length
    };
    
    if (severityCounts.critical > 0) {
      console.log(`🚨 Critical: ${severityCounts.critical}`);
    }
    if (severityCounts.high > 0) {
      console.log(`🔴 High: ${severityCounts.high}`);
    }
    if (severityCounts.medium > 0) {
      console.log(`🟡 Medium: ${severityCounts.medium}`);
    }
    if (severityCounts.low > 0) {
      console.log(`🟢 Low: ${severityCounts.low}`);
    }
    
    console.log(`\n📋 Report saved to: ${this.reportsDir}`);
    
    if (results.riskLevel === 'CRITICAL' || results.riskLevel === 'HIGH') {
      console.log('\n🚨 HIGH RISK: Address vulnerabilities before deployment!');
      process.exit(1);
    } else if (results.vulnerabilities.length > 0) {
      console.log('\n⚠️  Some security issues found - review recommendations');
    } else {
      console.log('\n🎉 No security vulnerabilities detected!');
    }
  }
}

// Execute if run directly
if (import.meta.url === `file://${__filename}`) {
  const scanner = new SecurityScanner();
  
  scanner.scanProject().catch(error => {
    console.error('Security scan failed:', error);
    process.exit(1);
  });
}

export { SecurityScanner };
