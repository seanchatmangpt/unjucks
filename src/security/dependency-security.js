/**
 * Dependency Security Scanner and Manager
 * Scans for vulnerable dependencies, validates package integrity, and enforces security policies
 */

import { execSync } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import { createHash } from 'crypto';
import { SecurityError } from './input-validator.js';

export class DependencySecurityManager {
  constructor() {
    this.vulnerabilityCache = new Map();
    this.packageIntegrityCache = new Map();
    this.cacheTimeout = 3600000; // 1 hour
    this.maxVulnerabilityAge = 7 * 24 * 60 * 60 * 1000; // 7 days
    
    // Known malicious package patterns
    this.maliciousPatterns = [
      /^event-stream$/,
      /^getcookies$/,
      /^flatmap-stream$/,
      /bitcoin.*miner/i,
      /crypto.*miner/i,
      /malware/i,
      /backdoor/i,
      /trojan/i
    ];

    // High-risk dependency patterns
    this.highRiskPatterns = [
      /^lodash@[0-4]\./,  // Old lodash versions
      /^jquery@[1-2]\./,   // Old jQuery versions
      /^moment@.*$/,       // Moment.js (deprecated)
      /^request@.*$/       // Request (deprecated)
    ];

    // Trusted package registries
    this.trustedRegistries = new Set([
      'https://registry.npmjs.org/',
      'https://npm.pkg.github.com/'
    ]);
  }

  /**
   * Comprehensive security audit of dependencies
   */
  async auditDependencies(projectPath = process.cwd()) {
    const auditResults = {
      vulnerabilities: [],
      maliciousPackages: [],
      highRiskPackages: [],
      integrityIssues: [],
      outdatedPackages: [],
      summary: {
        totalPackages: 0,
        vulnerablePackages: 0,
        criticalVulns: 0,
        highVulns: 0,
        mediumVulns: 0,
        lowVulns: 0,
        riskScore: 0
      }
    };

    try {
      // Step 1: Run npm audit
      const npmAuditResults = await this.runNpmAudit(projectPath);
      auditResults.vulnerabilities = npmAuditResults.vulnerabilities;
      
      // Step 2: Check for malicious packages
      const maliciousPackages = await this.scanForMaliciousPackages(projectPath);
      auditResults.maliciousPackages = maliciousPackages;
      
      // Step 3: Check for high-risk packages
      const highRiskPackages = await this.scanForHighRiskPackages(projectPath);
      auditResults.highRiskPackages = highRiskPackages;
      
      // Step 4: Verify package integrity
      const integrityIssues = await this.verifyPackageIntegrity(projectPath);
      auditResults.integrityIssues = integrityIssues;
      
      // Step 5: Check for outdated packages
      const outdatedPackages = await this.checkOutdatedPackages(projectPath);
      auditResults.outdatedPackages = outdatedPackages;
      
      // Step 6: Calculate summary and risk score
      this.calculateSecuritySummary(auditResults);
      
      return auditResults;
      
    } catch (error) {
      throw new SecurityError(`Dependency audit failed: ${error.message}`);
    }
  }

  /**
   * Run npm audit and parse results
   */
  async runNpmAudit(projectPath) {
    const cacheKey = `npm-audit:${projectPath}`;
    const cached = this.vulnerabilityCache.get(cacheKey);
    
    if (cached && this.getDeterministicTimestamp() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    try {
      const auditOutput = execSync('npm audit --json --audit-level=info', {
        cwd: projectPath,
        encoding: 'utf8',
        timeout: 30000
      });

      const auditData = JSON.parse(auditOutput);
      const vulnerabilities = this.parseNpmAuditResults(auditData);
      
      this.vulnerabilityCache.set(cacheKey, {
        data: { vulnerabilities },
        timestamp: this.getDeterministicTimestamp()
      });
      
      return { vulnerabilities };
      
    } catch (error) {
      // npm audit returns non-zero exit code when vulnerabilities found
      if (error.stdout) {
        try {
          const auditData = JSON.parse(error.stdout);
          const vulnerabilities = this.parseNpmAuditResults(auditData);
          return { vulnerabilities };
        } catch (parseError) {
          console.warn('Failed to parse npm audit output:', parseError.message);
        }
      }
      
      console.warn('npm audit failed:', error.message);
      return { vulnerabilities: [] };
    }
  }

  /**
   * Parse npm audit results into standardized format
   */
  parseNpmAuditResults(auditData) {
    const vulnerabilities = [];
    
    if (auditData.vulnerabilities) {
      for (const [packageName, vulnData] of Object.entries(auditData.vulnerabilities)) {
        vulnerabilities.push({
          package: packageName,
          severity: vulnData.severity,
          title: vulnData.title,
          overview: vulnData.overview,
          recommendations: vulnData.recommendation,
          references: vulnData.references || [],
          vulnerable_versions: vulnData.vulnerable_versions,
          patched_versions: vulnData.patched_versions,
          cves: vulnData.cves || [],
          source: 'npm-audit'
        });
      }
    }
    
    return vulnerabilities;
  }

  /**
   * Scan for known malicious packages
   */
  async scanForMaliciousPackages(projectPath) {
    const maliciousPackages = [];
    const packageJsonPath = path.join(projectPath, 'package.json');
    const lockFilePath = path.join(projectPath, 'package-lock.json');
    
    if (!(await fs.pathExists(packageJsonPath))) {
      return maliciousPackages;
    }

    try {
      const packageJson = await fs.readJson(packageJsonPath);
      const allDependencies = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
        ...packageJson.peerDependencies,
        ...packageJson.optionalDependencies
      };

      // Check direct dependencies
      for (const [packageName, version] of Object.entries(allDependencies)) {
        if (this.isMaliciousPackage(packageName, version)) {
          maliciousPackages.push({
            package: packageName,
            version: version,
            reason: 'Known malicious package',
            severity: 'critical',
            type: 'direct'
          });
        }
      }

      // Check transitive dependencies from lock file
      if (await fs.pathExists(lockFilePath)) {
        const lockFile = await fs.readJson(lockFilePath);
        if (lockFile.dependencies) {
          for (const [packageName, packageData] of Object.entries(lockFile.dependencies)) {
            if (this.isMaliciousPackage(packageName, packageData.version)) {
              maliciousPackages.push({
                package: packageName,
                version: packageData.version,
                reason: 'Known malicious package (transitive)',
                severity: 'critical',
                type: 'transitive'
              });
            }
          }
        }
      }

    } catch (error) {
      console.warn('Failed to scan for malicious packages:', error.message);
    }

    return maliciousPackages;
  }

  /**
   * Check if package matches malicious patterns
   */
  isMaliciousPackage(packageName, version) {
    const packageWithVersion = `${packageName}@${version}`;
    
    // Check against known malicious patterns
    for (const pattern of this.maliciousPatterns) {
      if (pattern.test(packageName) || pattern.test(packageWithVersion)) {
        return true;
      }
    }

    // Additional heuristic checks
    if (packageName.includes('bitcoin') && packageName.includes('miner')) {
      return true;
    }

    if (packageName.includes('crypto') && packageName.includes('miner')) {
      return true;
    }

    return false;
  }

  /**
   * Scan for high-risk packages
   */
  async scanForHighRiskPackages(projectPath) {
    const highRiskPackages = [];
    const packageJsonPath = path.join(projectPath, 'package.json');
    
    if (!(await fs.pathExists(packageJsonPath))) {
      return highRiskPackages;
    }

    try {
      const packageJson = await fs.readJson(packageJsonPath);
      const allDependencies = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies
      };

      for (const [packageName, version] of Object.entries(allDependencies)) {
        const packageWithVersion = `${packageName}@${version}`;
        
        for (const pattern of this.highRiskPatterns) {
          if (pattern.test(packageWithVersion)) {
            highRiskPackages.push({
              package: packageName,
              version: version,
              reason: this.getHighRiskReason(packageName),
              severity: 'high',
              recommendation: this.getHighRiskRecommendation(packageName)
            });
            break;
          }
        }
      }

    } catch (error) {
      console.warn('Failed to scan for high-risk packages:', error.message);
    }

    return highRiskPackages;
  }

  /**
   * Get reason for high-risk classification
   */
  getHighRiskReason(packageName) {
    if (packageName === 'lodash') {
      return 'Old version with known vulnerabilities';
    }
    if (packageName === 'jquery') {
      return 'Legacy version with security issues';
    }
    if (packageName === 'moment') {
      return 'Deprecated package, use date-fns or dayjs instead';
    }
    if (packageName === 'request') {
      return 'Deprecated package, use axios or fetch instead';
    }
    return 'High-risk package detected';
  }

  /**
   * Get recommendation for high-risk package
   */
  getHighRiskRecommendation(packageName) {
    if (packageName === 'lodash') {
      return 'Upgrade to lodash@^4.17.21 or higher';
    }
    if (packageName === 'jquery') {
      return 'Upgrade to jquery@^3.6.0 or consider modern alternatives';
    }
    if (packageName === 'moment') {
      return 'Replace with date-fns or dayjs for better performance';
    }
    if (packageName === 'request') {
      return 'Replace with axios, node-fetch, or native fetch API';
    }
    return 'Review and update package to latest secure version';
  }

  /**
   * Verify package integrity
   */
  async verifyPackageIntegrity(projectPath) {
    const integrityIssues = [];
    const nodeModulesPath = path.join(projectPath, 'node_modules');
    
    if (!(await fs.pathExists(nodeModulesPath))) {
      return integrityIssues;
    }

    try {
      // Check for suspicious files in node_modules
      const suspiciousFiles = await this.findSuspiciousFiles(nodeModulesPath);
      integrityIssues.push(...suspiciousFiles);

      // Check for modified core files
      const modifiedFiles = await this.checkForModifiedFiles(nodeModulesPath);
      integrityIssues.push(...modifiedFiles);

    } catch (error) {
      console.warn('Failed to verify package integrity:', error.message);
    }

    return integrityIssues;
  }

  /**
   * Find suspicious files in node_modules
   */
  async findSuspiciousFiles(nodeModulesPath) {
    const suspiciousFiles = [];
    const suspiciousExtensions = ['.exe', '.bat', '.cmd', '.sh'];
    const suspiciousNames = ['bitcoin', 'miner', 'crypto-miner', 'malware'];

    try {
      const walkDir = async (dir) => {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          
          if (entry.isDirectory()) {
            await walkDir(fullPath);
          } else {
            // Check file extension
            const ext = path.extname(entry.name).toLowerCase();
            if (suspiciousExtensions.includes(ext)) {
              suspiciousFiles.push({
                file: fullPath,
                reason: `Suspicious executable file: ${ext}`,
                severity: 'high',
                type: 'suspicious-file'
              });
            }

            // Check filename
            const filename = entry.name.toLowerCase();
            for (const suspiciousName of suspiciousNames) {
              if (filename.includes(suspiciousName)) {
                suspiciousFiles.push({
                  file: fullPath,
                  reason: `Suspicious filename: ${suspiciousName}`,
                  severity: 'high',
                  type: 'suspicious-file'
                });
                break;
              }
            }
          }
        }
      };

      await walkDir(nodeModulesPath);

    } catch (error) {
      console.warn('Failed to scan for suspicious files:', error.message);
    }

    return suspiciousFiles;
  }

  /**
   * Check for modified core files
   */
  async checkForModifiedFiles(nodeModulesPath) {
    const modifiedFiles = [];
    
    // This would typically involve checking file hashes against known good hashes
    // For now, we'll check for common indicators of tampering
    
    try {
      const corePackages = ['npm', 'node-gyp', 'semver', 'tar', 'fs-extra'];
      
      for (const packageName of corePackages) {
        const packagePath = path.join(nodeModulesPath, packageName);
        
        if (await fs.pathExists(packagePath)) {
          // Check for unusual files in core packages
          const packageJson = path.join(packagePath, 'package.json');
          
          if (await fs.pathExists(packageJson)) {
            const packageData = await fs.readJson(packageJson);
            
            // Check for suspicious scripts
            if (packageData.scripts) {
              for (const [scriptName, scriptContent] of Object.entries(packageData.scripts)) {
                if (this.isSuspiciousScript(scriptContent)) {
                  modifiedFiles.push({
                    file: packageJson,
                    package: packageName,
                    reason: `Suspicious script in ${scriptName}: ${scriptContent}`,
                    severity: 'medium',
                    type: 'modified-file'
                  });
                }
              }
            }
          }
        }
      }

    } catch (error) {
      console.warn('Failed to check for modified files:', error.message);
    }

    return modifiedFiles;
  }

  /**
   * Check if script content is suspicious
   */
  isSuspiciousScript(scriptContent) {
    const suspiciousPatterns = [
      /curl.*\|.*sh/i,
      /wget.*\|.*sh/i,
      /bitcoin/i,
      /miner/i,
      /crypto.*mine/i,
      /eval\(/i,
      /child_process/i,
      /execSync/i
    ];

    return suspiciousPatterns.some(pattern => pattern.test(scriptContent));
  }

  /**
   * Check for outdated packages
   */
  async checkOutdatedPackages(projectPath) {
    try {
      const outdatedOutput = execSync('npm outdated --json', {
        cwd: projectPath,
        encoding: 'utf8',
        timeout: 30000
      });

      const outdatedData = JSON.parse(outdatedOutput);
      const outdatedPackages = [];

      for (const [packageName, packageData] of Object.entries(outdatedData)) {
        outdatedPackages.push({
          package: packageName,
          current: packageData.current,
          wanted: packageData.wanted,
          latest: packageData.latest,
          location: packageData.location,
          severity: this.getOutdatedSeverity(packageData)
        });
      }

      return outdatedPackages;

    } catch (error) {
      // npm outdated returns non-zero when packages are outdated
      if (error.stdout) {
        try {
          const outdatedData = JSON.parse(error.stdout);
          const outdatedPackages = [];

          for (const [packageName, packageData] of Object.entries(outdatedData)) {
            outdatedPackages.push({
              package: packageName,
              current: packageData.current,
              wanted: packageData.wanted,
              latest: packageData.latest,
              location: packageData.location,
              severity: this.getOutdatedSeverity(packageData)
            });
          }

          return outdatedPackages;
        } catch (parseError) {
          console.warn('Failed to parse npm outdated output:', parseError.message);
        }
      }

      console.warn('npm outdated failed:', error.message);
      return [];
    }
  }

  /**
   * Determine severity of outdated package
   */
  getOutdatedSeverity(packageData) {
    const current = packageData.current;
    const latest = packageData.latest;

    // Simple version comparison
    const currentParts = current.split('.').map(Number);
    const latestParts = latest.split('.').map(Number);

    // Major version behind
    if (latestParts[0] > currentParts[0]) {
      return 'high';
    }

    // Minor version behind by more than 5
    if (latestParts[1] - currentParts[1] > 5) {
      return 'medium';
    }

    // Patch version behind by more than 10
    if (latestParts[2] - currentParts[2] > 10) {
      return 'low';
    }

    return 'info';
  }

  /**
   * Calculate security summary and risk score
   */
  calculateSecuritySummary(auditResults) {
    const summary = auditResults.summary;
    
    summary.totalPackages = auditResults.vulnerabilities.length + 
                           auditResults.maliciousPackages.length + 
                           auditResults.highRiskPackages.length;

    summary.vulnerablePackages = auditResults.vulnerabilities.length;

    // Count vulnerabilities by severity
    for (const vuln of auditResults.vulnerabilities) {
      switch (vuln.severity.toLowerCase()) {
        case 'critical':
          summary.criticalVulns++;
          break;
        case 'high':
          summary.highVulns++;
          break;
        case 'medium':
        case 'moderate':
          summary.mediumVulns++;
          break;
        case 'low':
          summary.lowVulns++;
          break;
      }
    }

    // Calculate risk score (0-100)
    summary.riskScore = Math.min(100, 
      (summary.criticalVulns * 25) +
      (auditResults.maliciousPackages.length * 30) +
      (summary.highVulns * 10) +
      (auditResults.highRiskPackages.length * 15) +
      (summary.mediumVulns * 5) +
      (auditResults.integrityIssues.length * 20) +
      (summary.lowVulns * 2)
    );
  }

  /**
   * Generate security report
   */
  generateSecurityReport(auditResults, format = 'json') {
    const timestamp = this.getDeterministicDate().toISOString();
    
    const report = {
      timestamp,
      summary: auditResults.summary,
      vulnerabilities: auditResults.vulnerabilities,
      maliciousPackages: auditResults.maliciousPackages,
      highRiskPackages: auditResults.highRiskPackages,
      integrityIssues: auditResults.integrityIssues,
      outdatedPackages: auditResults.outdatedPackages,
      recommendations: this.generateRecommendations(auditResults)
    };

    if (format === 'console') {
      return this.formatConsoleReport(report);
    }

    return report;
  }

  /**
   * Generate security recommendations
   */
  generateRecommendations(auditResults) {
    const recommendations = [];

    if (auditResults.maliciousPackages.length > 0) {
      recommendations.push({
        priority: 'critical',
        action: 'Remove malicious packages immediately',
        packages: auditResults.maliciousPackages.map(p => p.package)
      });
    }

    if (auditResults.summary.criticalVulns > 0) {
      recommendations.push({
        priority: 'critical',
        action: 'Update packages with critical vulnerabilities',
        details: 'Run npm audit fix to automatically fix issues'
      });
    }

    if (auditResults.highRiskPackages.length > 0) {
      recommendations.push({
        priority: 'high',
        action: 'Replace or update high-risk packages',
        packages: auditResults.highRiskPackages.map(p => ({
          package: p.package,
          recommendation: p.recommendation
        }))
      });
    }

    if (auditResults.outdatedPackages.length > 5) {
      recommendations.push({
        priority: 'medium',
        action: 'Update outdated packages',
        details: 'Run npm update to update packages to latest versions'
      });
    }

    return recommendations;
  }

  /**
   * Format console report
   */
  formatConsoleReport(report) {
    const lines = [];
    
    lines.push('=== DEPENDENCY SECURITY AUDIT ===');
    lines.push(`Timestamp: ${report.timestamp}`);
    lines.push(`Risk Score: ${report.summary.riskScore}/100`);
    lines.push('');

    if (report.maliciousPackages.length > 0) {
      lines.push('🚨 MALICIOUS PACKAGES:');
      report.maliciousPackages.forEach(pkg => {
        lines.push(`  - ${pkg.package}@${pkg.version}: ${pkg.reason}`);
      });
      lines.push('');
    }

    if (report.summary.criticalVulns > 0) {
      lines.push('🔴 CRITICAL VULNERABILITIES:');
      report.vulnerabilities
        .filter(v => v.severity === 'critical')
        .forEach(vuln => {
          lines.push(`  - ${vuln.package}: ${vuln.title}`);
        });
      lines.push('');
    }

    if (report.recommendations.length > 0) {
      lines.push('💡 RECOMMENDATIONS:');
      report.recommendations.forEach(rec => {
        lines.push(`  [${rec.priority.toUpperCase()}] ${rec.action}`);
      });
      lines.push('');
    }

    return lines.join('\n');
  }
}

// Export singleton instance
export const dependencySecurityManager = new DependencySecurityManager();