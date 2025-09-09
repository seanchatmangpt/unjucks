#!/usr/bin/env node

/**
 * Security Dashboard Generator
 * Consolidates all security scan results into a comprehensive dashboard
 */

const fs = require('fs');
const path = require('path');

class SecurityDashboardGenerator {
  constructor() {
    this.results = {
      dependencies: { status: 'unknown', issues: 0, details: [] },
      sast: { status: 'unknown', issues: 0, details: [] },
      secrets: { status: 'unknown', issues: 0, details: [] },
      licenses: { status: 'unknown', issues: 0, details: [] },
      unjucks: { status: 'unknown', issues: 0, details: [] }
    };
    this.overallScore = 0;
  }

  async generateDashboard() {
    console.log('🛡️  Generating security dashboard...');

    // Process all security scan results
    await this.processDependencyResults();
    await this.processSASTResults();
    await this.processSecretsResults();
    await this.processLicenseResults();
    await this.processUnjucksSecurityResults();

    // Calculate overall security score
    this.calculateOverallScore();

    // Generate HTML dashboard
    await this.generateHTMLDashboard();

    // Generate metrics JSON
    await this.generateMetricsJSON();

    console.log(`✅ Security dashboard generated with score: ${this.overallScore}%`);
  }

  async processDependencyResults() {
    try {
      // Process npm audit results
      if (fs.existsSync('dependency-scan-results/npm-audit-results.json')) {
        const npmAudit = JSON.parse(fs.readFileSync('dependency-scan-results/npm-audit-results.json', 'utf8'));
        const vulnCount = Object.keys(npmAudit.vulnerabilities || {}).length;
        this.results.dependencies.issues += vulnCount;
        this.results.dependencies.details.push({
          source: 'npm-audit',
          vulnerabilities: vulnCount,
          critical: this.countVulnsBySeverity(npmAudit, 'critical'),
          high: this.countVulnsBySeverity(npmAudit, 'high'),
          medium: this.countVulnsBySeverity(npmAudit, 'moderate'),
          low: this.countVulnsBySeverity(npmAudit, 'low')
        });
      }

      // Process Snyk results
      if (fs.existsSync('dependency-scan-results/snyk-results.json')) {
        const snykResults = JSON.parse(fs.readFileSync('dependency-scan-results/snyk-results.json', 'utf8'));
        const snykVulns = snykResults.vulnerabilities?.length || 0;
        this.results.dependencies.issues += snykVulns;
        this.results.dependencies.details.push({
          source: 'snyk',
          vulnerabilities: snykVulns
        });
      }

      // Determine status
      this.results.dependencies.status = this.results.dependencies.issues === 0 ? 'pass' : 
        this.results.dependencies.issues < 5 ? 'warning' : 'fail';

    } catch (error) {
      console.error('Error processing dependency results:', error.message);
      this.results.dependencies.status = 'error';
    }
  }

  async processSASTResults() {
    try {
      // Process ESLint security results
      if (fs.existsSync('eslint-security-results.sarif')) {
        const eslintSarif = JSON.parse(fs.readFileSync('eslint-security-results.sarif', 'utf8'));
        const eslintIssues = this.countSarifIssues(eslintSarif);
        this.results.sast.issues += eslintIssues;
        this.results.sast.details.push({
          source: 'eslint-security',
          issues: eslintIssues
        });
      }

      // Process Semgrep results
      if (fs.existsSync('semgrep.sarif')) {
        const semgrepSarif = JSON.parse(fs.readFileSync('semgrep.sarif', 'utf8'));
        const semgrepIssues = this.countSarifIssues(semgrepSarif);
        this.results.sast.issues += semgrepIssues;
        this.results.sast.details.push({
          source: 'semgrep',
          issues: semgrepIssues
        });
      }

      this.results.sast.status = this.results.sast.issues === 0 ? 'pass' : 
        this.results.sast.issues < 10 ? 'warning' : 'fail';

    } catch (error) {
      console.error('Error processing SAST results:', error.message);
      this.results.sast.status = 'error';
    }
  }

  async processSecretsResults() {
    try {
      // Process TruffleHog results
      if (fs.existsSync('secrets-scan-results/trufflehog-results.json')) {
        const truffleResults = fs.readFileSync('secrets-scan-results/trufflehog-results.json', 'utf8');
        const lines = truffleResults.trim().split('\n').filter(line => line.trim());
        this.results.secrets.issues = lines.length;
        this.results.secrets.details.push({
          source: 'trufflehog',
          secrets_found: lines.length
        });
      }

      // Process GitLeaks results
      if (fs.existsSync('secrets-scan-results/gitleaks-report.json')) {
        const gitleaksResults = JSON.parse(fs.readFileSync('secrets-scan-results/gitleaks-report.json', 'utf8'));
        const gitleaksIssues = gitleaksResults.length || 0;
        this.results.secrets.issues += gitleaksIssues;
        this.results.secrets.details.push({
          source: 'gitleaks',
          secrets_found: gitleaksIssues
        });
      }

      this.results.secrets.status = this.results.secrets.issues === 0 ? 'pass' : 'fail';

    } catch (error) {
      console.error('Error processing secrets results:', error.message);
      this.results.secrets.status = 'error';
    }
  }

  async processLicenseResults() {
    try {
      if (fs.existsSync('license-compliance-results/license-report.json')) {
        const licenseReport = JSON.parse(fs.readFileSync('license-compliance-results/license-report.json', 'utf8'));
        
        // Check for problematic licenses
        const problematicLicenses = ['GPL', 'AGPL', 'LGPL', 'CPAL', 'EPL', 'MPL', 'Ms-PL', 'Ms-RL', 'CC-BY-NC'];
        let licenseIssues = 0;

        Object.entries(licenseReport).forEach(([pkg, info]) => {
          const license = info.licenses || '';
          if (problematicLicenses.some(prob => license.includes(prob))) {
            licenseIssues++;
          }
        });

        this.results.licenses.issues = licenseIssues;
        this.results.licenses.details.push({
          source: 'license-checker',
          total_packages: Object.keys(licenseReport).length,
          problematic_licenses: licenseIssues
        });
      }

      this.results.licenses.status = this.results.licenses.issues === 0 ? 'pass' : 'warning';

    } catch (error) {
      console.error('Error processing license results:', error.message);
      this.results.licenses.status = 'error';
    }
  }

  async processUnjucksSecurityResults() {
    try {
      // Check for Unjucks security test results
      const securityTestDirs = [
        'unjucks-security-results/coverage/security/',
        'unjucks-security-results/tests/security/results/'
      ];

      let securityIssues = 0;
      let testsPassed = 0;
      let totalTests = 0;

      for (const dir of securityTestDirs) {
        if (fs.existsSync(dir)) {
          const files = fs.readdirSync(dir);
          for (const file of files) {
            if (file.endsWith('.json')) {
              try {
                const testResults = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
                if (testResults.tests) {
                  totalTests += testResults.tests.length;
                  testsPassed += testResults.tests.filter(t => t.passed).length;
                  securityIssues += testResults.tests.filter(t => !t.passed).length;
                }
              } catch (e) {
                console.warn(`Could not parse test results file: ${file}`);
              }
            }
          }
        }
      }

      this.results.unjucks.issues = securityIssues;
      this.results.unjucks.details.push({
        source: 'unjucks-security-tests',
        total_tests: totalTests,
        passed_tests: testsPassed,
        failed_tests: securityIssues,
        coverage: totalTests > 0 ? Math.round((testsPassed / totalTests) * 100) : 0
      });

      this.results.unjucks.status = securityIssues === 0 ? 'pass' : 'fail';

    } catch (error) {
      console.error('Error processing Unjucks security results:', error.message);
      this.results.unjucks.status = 'error';
    }
  }

  calculateOverallScore() {
    const weights = {
      dependencies: 25,
      sast: 25,
      secrets: 30,
      licenses: 10,
      unjucks: 10
    };

    let totalScore = 0;
    let totalWeight = 0;

    Object.entries(this.results).forEach(([category, result]) => {
      if (weights[category]) {
        let categoryScore = 0;
        if (result.status === 'pass') categoryScore = 100;
        else if (result.status === 'warning') categoryScore = 70;
        else if (result.status === 'fail') categoryScore = 0;
        else categoryScore = 50; // error state

        totalScore += categoryScore * weights[category];
        totalWeight += weights[category];
      }
    });

    this.overallScore = totalWeight > 0 ? Math.round(totalScore / totalWeight) : 0;
  }

  async generateHTMLDashboard() {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Unjucks Security Dashboard</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .dashboard { max-width: 1200px; margin: 0 auto; }
        .header { background: white; padding: 30px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .score { font-size: 48px; font-weight: bold; color: ${this.getScoreColor()}; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
        .card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .status-pass { color: #28a745; }
        .status-warning { color: #ffc107; }
        .status-fail { color: #dc3545; }
        .status-error { color: #6c757d; }
        .metric { display: flex; justify-content: space-between; margin: 10px 0; }
        .details { margin-top: 15px; font-size: 14px; color: #666; }
        .timestamp { color: #888; font-size: 14px; }
    </style>
</head>
<body>
    <div class="dashboard">
        <div class="header">
            <h1>🛡️ Unjucks Security Dashboard</h1>
            <div class="score">${this.overallScore}%</div>
            <p>Overall Security Score</p>
            <div class="timestamp">Generated: ${new Date().toISOString()}</div>
        </div>
        
        <div class="grid">
            ${this.generateCategoryCards()}
        </div>
        
        <div class="card" style="margin-top: 20px;">
            <h3>Security Recommendations</h3>
            ${this.generateRecommendations()}
        </div>
    </div>
</body>
</html>`;

    fs.writeFileSync('security-dashboard.html', html);
  }

  generateCategoryCards() {
    return Object.entries(this.results).map(([category, result]) => `
        <div class="card">
            <h3>${this.getCategoryTitle(category)}</h3>
            <div class="metric">
                <span>Status:</span>
                <span class="status-${result.status}">${result.status.toUpperCase()}</span>
            </div>
            <div class="metric">
                <span>Issues:</span>
                <span>${result.issues}</span>
            </div>
            <div class="details">
                ${result.details.map(detail => `
                    <div><strong>${detail.source}:</strong> ${JSON.stringify(detail, null, 2)}</div>
                `).join('')}
            </div>
        </div>
    `).join('');
  }

  generateRecommendations() {
    const recommendations = [];
    
    if (this.results.dependencies.status === 'fail') {
      recommendations.push('🔴 Update vulnerable dependencies immediately');
    }
    if (this.results.sast.status === 'fail') {
      recommendations.push('🔴 Fix static analysis security issues');
    }
    if (this.results.secrets.status === 'fail') {
      recommendations.push('🔴 Remove exposed secrets from repository');
    }
    if (this.results.licenses.status === 'warning') {
      recommendations.push('🟡 Review problematic license dependencies');
    }
    if (this.results.unjucks.status === 'fail') {
      recommendations.push('🔴 Fix Unjucks-specific security vulnerabilities');
    }

    if (recommendations.length === 0) {
      recommendations.push('✅ All security checks passed!');
    }

    return recommendations.map(rec => `<p>${rec}</p>`).join('');
  }

  async generateMetricsJSON() {
    const metrics = {
      overallScore: this.overallScore,
      timestamp: new Date().toISOString(),
      dashboardUrl: 'security-dashboard.html',
      ...this.results
    };

    fs.writeFileSync('security-metrics.json', JSON.stringify(metrics, null, 2));
  }

  // Helper methods
  countVulnsBySeverity(npmAudit, severity) {
    if (!npmAudit.vulnerabilities) return 0;
    return Object.values(npmAudit.vulnerabilities).filter(v => v.severity === severity).length;
  }

  countSarifIssues(sarif) {
    if (!sarif.runs || !Array.isArray(sarif.runs)) return 0;
    return sarif.runs.reduce((total, run) => {
      return total + (run.results?.length || 0);
    }, 0);
  }

  getCategoryTitle(category) {
    const titles = {
      dependencies: 'Dependencies',
      sast: 'Static Analysis',
      secrets: 'Secrets Detection',
      licenses: 'License Compliance',
      unjucks: 'Unjucks Security'
    };
    return titles[category] || category;
  }

  getScoreColor() {
    if (this.overallScore >= 90) return '#28a745';
    if (this.overallScore >= 70) return '#ffc107';
    return '#dc3545';
  }
}

// Run the dashboard generator
if (require.main === module) {
  const generator = new SecurityDashboardGenerator();
  generator.generateDashboard().catch(error => {
    console.error('Failed to generate security dashboard:', error);
    process.exit(1);
  });
}

module.exports = SecurityDashboardGenerator;