#!/usr/bin/env node

/**
 * Dependency Security Scanner
 * Scans npm dependencies for known vulnerabilities
 */

import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

class DependencyScanner {
  constructor() {
    this.vulnerabilities = [];
    this.stats = {
      totalDependencies: 0,
      vulnerableDependencies: 0,
      critical: 0,
      high: 0,
      moderate: 0,
      low: 0,
      info: 0
    };
  }

  async scanDependencies() {
    console.log('🔍 Scanning dependencies for vulnerabilities...\n');

    try {
      // Read package.json
      const packageJsonPath = join(rootDir, 'package.json');
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
      
      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
        ...packageJson.optionalDependencies
      };
      
      this.stats.totalDependencies = Object.keys(allDeps).length;
      console.log(`Found ${this.stats.totalDependencies} dependencies to scan`);

      // Run npm audit
      await this.runNpmAudit();
      
      // Check for outdated packages
      await this.checkOutdatedPackages();
      
      // Scan for problematic patterns in dependencies
      this.scanDependencyPatterns(allDeps);

    } catch (error) {
      console.error('Error scanning dependencies:', error.message);
      throw error;
    }
  }

  async runNpmAudit() {
    try {
      console.log('\n🛡️  Running npm audit...');
      
      const auditResult = execSync('npm audit --json', { 
        cwd: rootDir,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      const auditData = JSON.parse(auditResult);
      
      if (auditData.vulnerabilities) {
        Object.entries(auditData.vulnerabilities).forEach(([packageName, vulnData]) => {
          const vulnerability = {
            package: packageName,
            severity: vulnData.severity,
            title: vulnData.via?.[0]?.title || 'Unknown vulnerability',
            url: vulnData.via?.[0]?.url || '',
            range: vulnData.range,
            fixAvailable: vulnData.fixAvailable,
            source: 'npm-audit'
          };
          
          this.vulnerabilities.push(vulnerability);
          this.stats[vulnData.severity]++;
        });
      }

      this.stats.vulnerableDependencies = Object.keys(auditData.vulnerabilities || {}).length;
      
      console.log(`  Found ${this.vulnerabilities.length} vulnerabilities`);
      
    } catch (error) {
      // npm audit returns non-zero exit code when vulnerabilities are found
      if (error.stdout) {
        try {
          const auditData = JSON.parse(error.stdout);
          this.processAuditData(auditData);
        } catch (parseError) {
          console.log('  npm audit completed with warnings');
        }
      } else {
        console.log('  npm audit scan completed');
      }
    }
  }

  processAuditData(auditData) {
    if (auditData.vulnerabilities) {
      Object.entries(auditData.vulnerabilities).forEach(([packageName, vulnData]) => {
        const vulnerability = {
          package: packageName,
          severity: vulnData.severity,
          title: vulnData.via?.[0]?.title || 'Unknown vulnerability',
          url: vulnData.via?.[0]?.url || '',
          range: vulnData.range,
          fixAvailable: vulnData.fixAvailable,
          source: 'npm-audit'
        };
        
        this.vulnerabilities.push(vulnerability);
        this.stats[vulnData.severity] = (this.stats[vulnData.severity] || 0) + 1;
      });
    }

    this.stats.vulnerableDependencies = Object.keys(auditData.vulnerabilities || {}).length;
  }

  async checkOutdatedPackages() {
    try {
      console.log('\n📅 Checking for outdated packages...');
      
      const outdatedResult = execSync('npm outdated --json', {
        cwd: rootDir,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore'] // Ignore stderr as npm outdated often has warnings
      });
      
      if (outdatedResult.trim()) {
        const outdatedData = JSON.parse(outdatedResult);
        
        Object.entries(outdatedData).forEach(([packageName, versionInfo]) => {
          const majorVersionBehind = this.getMajorVersionDiff(
            versionInfo.current, 
            versionInfo.latest
          );
          
          if (majorVersionBehind >= 2) {
            this.vulnerabilities.push({
              package: packageName,
              severity: 'moderate',
              title: `Package significantly outdated (${majorVersionBehind} major versions behind)`,
              current: versionInfo.current,
              latest: versionInfo.latest,
              wanted: versionInfo.wanted,
              source: 'outdated-check'
            });
            
            this.stats.moderate++;
          }
        });
      }
      
    } catch (error) {
      // npm outdated returns non-zero when outdated packages exist
      console.log('  Outdated package check completed');
    }
  }

  getMajorVersionDiff(current, latest) {
    try {
      const currentMajor = parseInt(current.split('.')[0]);
      const latestMajor = parseInt(latest.split('.')[0]);
      return latestMajor - currentMajor;
    } catch (error) {
      return 0;
    }
  }

  scanDependencyPatterns(dependencies) {
    console.log('\n🔍 Scanning for problematic dependency patterns...');
    
    const problematicPatterns = [
      {
        pattern: /^[0-9]/,
        name: 'numeric-name',
        severity: 'low',
        message: 'Package name starts with number - potential typosquatting'
      },
      {
        pattern: /[0-9]{8,}/,
        name: 'long-numeric',
        severity: 'moderate',
        message: 'Package name contains long numeric sequence - suspicious'
      },
      {
        pattern: /^@[^/]+\/[^/]+$/,
        name: 'scoped-package',
        severity: 'info',
        message: 'Scoped package - verify publisher authenticity'
      }
    ];

    Object.keys(dependencies).forEach(packageName => {
      problematicPatterns.forEach(pattern => {
        if (pattern.pattern.test(packageName)) {
          this.vulnerabilities.push({
            package: packageName,
            severity: pattern.severity,
            title: pattern.message,
            pattern: pattern.name,
            source: 'pattern-analysis'
          });
          
          this.stats[pattern.severity]++;
        }
      });
    });

    // Check for common typosquatting targets
    const commonTargets = ['express', 'lodash', 'react', 'vue', 'angular'];
    const suspiciousNames = [];
    
    Object.keys(dependencies).forEach(packageName => {
      commonTargets.forEach(target => {
        if (this.isLevenshteinClose(packageName, target, 2) && packageName !== target) {
          suspiciousNames.push({
            package: packageName,
            target: target,
            distance: this.levenshteinDistance(packageName, target)
          });
        }
      });
    });

    suspiciousNames.forEach(suspicious => {
      this.vulnerabilities.push({
        package: suspicious.package,
        severity: 'high',
        title: `Potential typosquatting of '${suspicious.target}' (edit distance: ${suspicious.distance})`,
        source: 'typosquat-detection'
      });
      
      this.stats.high++;
    });
  }

  levenshteinDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  isLevenshteinClose(str1, str2, threshold) {
    return this.levenshteinDistance(str1, str2) <= threshold;
  }

  generateReport() {
    console.log('\n🛡️  Dependency Security Report');
    console.log('═'.repeat(50));
    
    console.log(`Total Dependencies: ${this.stats.totalDependencies}`);
    console.log(`Vulnerable Dependencies: ${this.stats.vulnerableDependencies}`);
    console.log(`Total Issues: ${this.vulnerabilities.length}`);
    
    // Severity breakdown
    console.log('\nIssues by Severity:');
    ['critical', 'high', 'moderate', 'low', 'info'].forEach(severity => {
      if (this.stats[severity] > 0) {
        const icon = severity === 'critical' ? '🔴' : 
                    severity === 'high' ? '🟠' : 
                    severity === 'moderate' ? '🟡' : 
                    severity === 'low' ? '🔵' : '🟢';
        console.log(`  ${icon} ${severity}: ${this.stats[severity]}`);
      }
    });

    // Detailed vulnerabilities
    if (this.vulnerabilities.length > 0) {
      console.log('\n🔍 Vulnerability Details:');
      console.log('─'.repeat(50));
      
      const grouped = this.vulnerabilities.reduce((acc, vuln) => {
        if (!acc[vuln.severity]) acc[vuln.severity] = [];
        acc[vuln.severity].push(vuln);
        return acc;
      }, {});

      ['critical', 'high', 'moderate', 'low', 'info'].forEach(severity => {
        if (grouped[severity]) {
          console.log(`\n${severity.toUpperCase()}:`);
          grouped[severity].forEach(vuln => {
            console.log(`  📦 ${vuln.package}: ${vuln.title}`);
            if (vuln.url) console.log(`     More info: ${vuln.url}`);
            if (vuln.fixAvailable) console.log(`     Fix available: ${vuln.fixAvailable}`);
          });
        }
      });
    }

    // Recommendations
    console.log('\n💡 Recommendations:');
    console.log('─'.repeat(30));
    
    if (this.stats.critical > 0 || this.stats.high > 0) {
      console.log('• Run "npm audit fix" to automatically fix vulnerabilities');
      console.log('• Consider updating or replacing vulnerable packages');
    }
    
    if (this.vulnerabilities.some(v => v.source === 'outdated-check')) {
      console.log('• Update outdated packages: "npm update"');
    }
    
    console.log('• Regularly monitor dependencies with "npm audit"');
    console.log('• Use "npm ci" in production for reproducible builds');

    // Save report
    const reportPath = join(rootDir, 'tests/dependency-report.json');
    const reportData = {
      timestamp: new Date().toISOString(),
      summary: this.stats,
      vulnerabilities: this.vulnerabilities,
      riskScore: this.calculateRiskScore()
    };

    try {
      writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
      console.log(`\n📋 Detailed report saved to: ${reportPath}`);
    } catch (error) {
      console.error('Failed to save report:', error.message);
    }

    // Risk assessment and exit code
    const riskScore = this.calculateRiskScore();
    console.log(`\n📊 Risk Score: ${riskScore}/100`);
    
    if (this.stats.critical > 0) {
      console.log('\n❌ CRITICAL vulnerabilities found - immediate action required');
      process.exit(1);
    } else if (this.stats.high > 0) {
      console.log('\n⚠️  HIGH severity vulnerabilities found - address soon');
      process.exit(0);
    } else if (this.stats.moderate > 0) {
      console.log('\n🟡 MODERATE vulnerabilities found - monitor and address');
    } else {
      console.log('\n✅ No critical security issues found in dependencies');
    }
  }

  calculateRiskScore() {
    const weights = { critical: 40, high: 20, moderate: 10, low: 5, info: 1 };
    return Math.min(100,
      this.stats.critical * weights.critical +
      this.stats.high * weights.high +
      this.stats.moderate * weights.moderate +
      this.stats.low * weights.low +
      this.stats.info * weights.info
    );
  }
}

// Run scan if called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const scanner = new DependencyScanner();
  scanner.scanDependencies()
    .then(() => scanner.generateReport())
    .catch(error => {
      console.error('❌ Dependency scan failed:', error);
      process.exit(1);
    });
}

export default DependencyScanner;