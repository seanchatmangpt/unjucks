#!/usr/bin/env node

/**
 * Security Threshold Checker
 * Validates security metrics against defined thresholds and fails CI if thresholds are exceeded
 */

const fs = require('fs');

class SecurityThresholdChecker {
  constructor() {
    this.thresholds = {
      dependencies: {
        critical: 0,
        high: 0,
        medium: 2,
        low: 10
      },
      sast: {
        error: 0,
        warning: 10,
        note: 50
      },
      secrets: {
        total: 0
      },
      licenses: {
        problematic: 0
      },
      unjucks: {
        failed_tests: 0,
        min_coverage: 95
      },
      overall: {
        min_score: 90
      }
    };

    this.exitCode = 0;
    this.violations = [];
  }

  async checkThresholds() {
    console.log('🔍 Checking security thresholds...');

    try {
      // Load security metrics
      const metrics = this.loadSecurityMetrics();
      
      // Check each category
      this.checkDependencyThresholds(metrics);
      this.checkSASTThresholds(metrics);
      this.checkSecretsThresholds(metrics);
      this.checkLicenseThresholds(metrics);
      this.checkUnjucksThresholds(metrics);
      this.checkOverallThreshold(metrics);

      // Report results
      this.reportResults(metrics);

    } catch (error) {
      console.error('❌ Failed to check security thresholds:', error.message);
      this.exitCode = 1;
    }

    process.exit(this.exitCode);
  }

  loadSecurityMetrics() {
    if (!fs.existsSync('security-metrics.json')) {
      throw new Error('Security metrics file not found. Run security scans first.');
    }

    return JSON.parse(fs.readFileSync('security-metrics.json', 'utf8'));
  }

  checkDependencyThresholds(metrics) {
    console.log('📦 Checking dependency vulnerability thresholds...');

    const depResults = metrics.dependencies;
    if (!depResults || !depResults.details) {
      this.addViolation('dependencies', 'No dependency scan results found');
      return;
    }

    // Aggregate vulnerability counts by severity
    const vulnCounts = { critical: 0, high: 0, medium: 0, low: 0 };

    depResults.details.forEach(detail => {
      if (detail.critical) vulnCounts.critical += detail.critical;
      if (detail.high) vulnCounts.high += detail.high;
      if (detail.medium) vulnCounts.medium += detail.medium;
      if (detail.low) vulnCounts.low += detail.low;
    });

    // Check against thresholds
    Object.entries(vulnCounts).forEach(([severity, count]) => {
      const threshold = this.thresholds.dependencies[severity];
      if (count > threshold) {
        this.addViolation(
          'dependencies',
          `${count} ${severity} vulnerabilities found (threshold: ${threshold})`
        );
      }
    });

    console.log(`   Critical: ${vulnCounts.critical}/${this.thresholds.dependencies.critical}`);
    console.log(`   High: ${vulnCounts.high}/${this.thresholds.dependencies.high}`);
    console.log(`   Medium: ${vulnCounts.medium}/${this.thresholds.dependencies.medium}`);
    console.log(`   Low: ${vulnCounts.low}/${this.thresholds.dependencies.low}`);
  }

  checkSASTThresholds(metrics) {
    console.log('🔍 Checking SAST finding thresholds...');

    const sastResults = metrics.sast;
    if (!sastResults) {
      this.addViolation('sast', 'No SAST scan results found');
      return;
    }

    // Load consolidated SARIF for detailed analysis
    try {
      if (fs.existsSync('consolidated-security-report.sarif')) {
        const sarif = JSON.parse(fs.readFileSync('consolidated-security-report.sarif', 'utf8'));
        const severityCounts = this.analyzeSarifSeverities(sarif);

        Object.entries(severityCounts).forEach(([severity, count]) => {
          const threshold = this.thresholds.sast[severity];
          if (threshold !== undefined && count > threshold) {
            this.addViolation(
              'sast',
              `${count} ${severity} SAST findings (threshold: ${threshold})`
            );
          }
        });

        console.log(`   Errors: ${severityCounts.error || 0}/${this.thresholds.sast.error}`);
        console.log(`   Warnings: ${severityCounts.warning || 0}/${this.thresholds.sast.warning}`);
        console.log(`   Notes: ${severityCounts.note || 0}/${this.thresholds.sast.note}`);
      }
    } catch (error) {
      console.warn('⚠️  Could not analyze SARIF details:', error.message);
    }
  }

  checkSecretsThresholds(metrics) {
    console.log('🔐 Checking secrets detection thresholds...');

    const secretsResults = metrics.secrets;
    if (!secretsResults) {
      this.addViolation('secrets', 'No secrets scan results found');
      return;
    }

    const secretCount = secretsResults.issues || 0;
    const threshold = this.thresholds.secrets.total;

    if (secretCount > threshold) {
      this.addViolation(
        'secrets',
        `${secretCount} secrets detected (threshold: ${threshold})`
      );
    }

    console.log(`   Secrets found: ${secretCount}/${threshold}`);
  }

  checkLicenseThresholds(metrics) {
    console.log('📜 Checking license compliance thresholds...');

    const licenseResults = metrics.licenses;
    if (!licenseResults) {
      this.addViolation('licenses', 'No license scan results found');
      return;
    }

    const licenseIssues = licenseResults.issues || 0;
    const threshold = this.thresholds.licenses.problematic;

    if (licenseIssues > threshold) {
      this.addViolation(
        'licenses',
        `${licenseIssues} problematic licenses found (threshold: ${threshold})`
      );
    }

    console.log(`   Problematic licenses: ${licenseIssues}/${threshold}`);
  }

  checkUnjucksThresholds(metrics) {
    console.log('🎯 Checking Unjucks security thresholds...');

    const unjucksResults = metrics.unjucks;
    if (!unjucksResults) {
      this.addViolation('unjucks', 'No Unjucks security test results found');
      return;
    }

    // Check failed tests
    const failedTests = unjucksResults.issues || 0;
    const failedThreshold = this.thresholds.unjucks.failed_tests;

    if (failedTests > failedThreshold) {
      this.addViolation(
        'unjucks',
        `${failedTests} Unjucks security tests failed (threshold: ${failedThreshold})`
      );
    }

    // Check security test coverage
    const details = unjucksResults.details || [];
    const coverageDetail = details.find(d => d.source === 'unjucks-security-tests');
    
    if (coverageDetail && coverageDetail.coverage !== undefined) {
      const coverage = coverageDetail.coverage;
      const minCoverage = this.thresholds.unjucks.min_coverage;

      if (coverage < minCoverage) {
        this.addViolation(
          'unjucks',
          `Security test coverage ${coverage}% below threshold (${minCoverage}%)`
        );
      }

      console.log(`   Failed tests: ${failedTests}/${failedThreshold}`);
      console.log(`   Security coverage: ${coverage}%/${minCoverage}%`);
    }
  }

  checkOverallThreshold(metrics) {
    console.log('📊 Checking overall security score threshold...');

    const overallScore = metrics.overallScore || 0;
    const minScore = this.thresholds.overall.min_score;

    if (overallScore < minScore) {
      this.addViolation(
        'overall',
        `Overall security score ${overallScore}% below threshold (${minScore}%)`
      );
    }

    console.log(`   Overall score: ${overallScore}%/${minScore}%`);
  }

  analyzeSarifSeverities(sarif) {
    const counts = { error: 0, warning: 0, note: 0 };

    if (sarif.runs) {
      sarif.runs.forEach(run => {
        if (run.results) {
          run.results.forEach(result => {
            const level = result.level || 'note';
            counts[level] = (counts[level] || 0) + 1;
          });
        }
      });
    }

    return counts;
  }

  addViolation(category, message) {
    this.violations.push({ category, message });
    this.exitCode = 1;
  }

  reportResults(metrics) {
    console.log('\n' + '='.repeat(60));
    console.log('🛡️  SECURITY THRESHOLD CHECK RESULTS');
    console.log('='.repeat(60));

    if (this.violations.length === 0) {
      console.log('✅ All security thresholds passed!');
      console.log(`📊 Overall Security Score: ${metrics.overallScore || 0}%`);
    } else {
      console.log('❌ Security threshold violations detected:');
      console.log('');

      this.violations.forEach((violation, index) => {
        console.log(`${index + 1}. [${violation.category.toUpperCase()}] ${violation.message}`);
      });

      console.log('');
      console.log(`📊 Overall Security Score: ${metrics.overallScore || 0}%`);
      console.log('');
      console.log('🔧 Remediation Required:');
      console.log('   1. Address all critical and high severity issues');
      console.log('   2. Review and fix security test failures');
      console.log('   3. Remove any exposed secrets');
      console.log('   4. Update vulnerable dependencies');
      console.log('   5. Re-run security scans after fixes');
    }

    console.log('='.repeat(60));

    // Generate threshold check report
    this.generateThresholdReport(metrics);
  }

  generateThresholdReport(metrics) {
    const report = {
      timestamp: this.getDeterministicDate().toISOString(),
      passed: this.violations.length === 0,
      overallScore: metrics.overallScore || 0,
      thresholds: this.thresholds,
      violations: this.violations,
      summary: {
        totalViolations: this.violations.length,
        categoriesWithViolations: [...new Set(this.violations.map(v => v.category))],
        exitCode: this.exitCode
      }
    };

    fs.writeFileSync('security-threshold-report.json', JSON.stringify(report, null, 2));
    console.log('📄 Threshold check report saved to: security-threshold-report.json');
  }
}

// Run the threshold checker
if (require.main === module) {
  const checker = new SecurityThresholdChecker();
  checker.checkThresholds();
}

module.exports = SecurityThresholdChecker;