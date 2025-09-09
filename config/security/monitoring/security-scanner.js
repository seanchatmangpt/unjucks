/**
 * Comprehensive Security Scanner
 * Integrates dependency scanning, SAST, DAST, and vulnerability monitoring
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

class SecurityScanner {
  constructor(config = {}) {
    this.config = {
      projectRoot: config.projectRoot || process.cwd(),
      tools: {
        snyk: config.snyk || { enabled: true, org: process.env.SNYK_ORG },
        npmAudit: config.npmAudit || { enabled: true },
        retireJs: config.retireJs || { enabled: true },
        eslintSecurity: config.eslintSecurity || { enabled: true },
        semgrep: config.semgrep || { enabled: true },
        bandit: config.bandit || { enabled: false }, // Python
        safety: config.safety || { enabled: false }, // Python
        gosec: config.gosec || { enabled: false }, // Go
        brakeman: config.brakeman || { enabled: false } // Ruby
      },
      thresholds: {
        critical: 0,
        high: 2,
        medium: 10,
        low: 50
      },
      reporting: {
        formats: ['json', 'sarif', 'html'],
        outputDir: config.outputDir || './security-reports',
        webhook: config.webhook || null
      },
      scheduling: {
        enabled: config.scheduling?.enabled || true,
        interval: config.scheduling?.interval || 24 * 60 * 60 * 1000, // 24 hours
        onPush: config.scheduling?.onPush || true,
        onPR: config.scheduling?.onPR || true
      }
    };

    this.results = {
      dependencies: [],
      staticAnalysis: [],
      secrets: [],
      containers: [],
      infrastructure: [],
      summary: null
    };
  }

  // Main scan orchestrator
  async runFullScan() {
    console.log('Starting comprehensive security scan...');
    
    try {
      await this.setupOutputDirectory();
      
      const scanPromises = [
        this.scanDependencies(),
        this.runStaticAnalysis(),
        this.scanForSecrets(),
        this.scanContainers(),
        this.scanInfrastructure()
      ];

      const results = await Promise.allSettled(scanPromises);
      
      // Process results
      this.processScanResults(results);
      
      // Generate reports
      await this.generateReports();
      
      // Check thresholds and fail if necessary
      const compliance = this.checkComplianceThresholds();
      
      console.log('Security scan completed');
      return {
        results: this.results,
        compliance,
        reports: `${this.config.reporting.outputDir}`
      };

    } catch (error) {
      console.error('Security scan failed:', error);
      throw error;
    }
  }

  // Dependency vulnerability scanning
  async scanDependencies() {
    const dependencyResults = [];

    // NPM Audit
    if (this.config.tools.npmAudit.enabled) {
      try {
        const npmAuditResult = await this.runNpmAudit();
        dependencyResults.push(npmAuditResult);
      } catch (error) {
        console.error('NPM Audit failed:', error.message);
      }
    }

    // Snyk
    if (this.config.tools.snyk.enabled) {
      try {
        const snykResult = await this.runSnyk();
        dependencyResults.push(snykResult);
      } catch (error) {
        console.error('Snyk scan failed:', error.message);
      }
    }

    // Retire.js
    if (this.config.tools.retireJs.enabled) {
      try {
        const retireResult = await this.runRetireJs();
        dependencyResults.push(retireResult);
      } catch (error) {
        console.error('Retire.js scan failed:', error.message);
      }
    }

    this.results.dependencies = dependencyResults;
    return dependencyResults;
  }

  async runNpmAudit() {
    try {
      const output = execSync('npm audit --json', { 
        cwd: this.config.projectRoot,
        encoding: 'utf8'
      });
      
      const auditData = JSON.parse(output);
      
      return {
        tool: 'npm-audit',
        timestamp: new Date().toISOString(),
        vulnerabilities: auditData.vulnerabilities || {},
        metadata: auditData.metadata || {},
        advisories: auditData.advisories || {}
      };
    } catch (error) {
      // NPM audit returns non-zero exit code when vulnerabilities found
      if (error.stdout) {
        const auditData = JSON.parse(error.stdout);
        return {
          tool: 'npm-audit',
          timestamp: new Date().toISOString(),
          vulnerabilities: auditData.vulnerabilities || {},
          metadata: auditData.metadata || {},
          advisories: auditData.advisories || {}
        };
      }
      throw error;
    }
  }

  async runSnyk() {
    try {
      const snykArgs = ['test', '--json'];
      if (this.config.tools.snyk.org) {
        snykArgs.push('--org', this.config.tools.snyk.org);
      }

      const output = execSync(`snyk ${snykArgs.join(' ')}`, {
        cwd: this.config.projectRoot,
        encoding: 'utf8'
      });

      return {
        tool: 'snyk',
        timestamp: new Date().toISOString(),
        result: JSON.parse(output)
      };
    } catch (error) {
      if (error.stdout) {
        return {
          tool: 'snyk',
          timestamp: new Date().toISOString(),
          result: JSON.parse(error.stdout)
        };
      }
      throw error;
    }
  }

  async runRetireJs() {
    try {
      const output = execSync('retire --outputformat json', {
        cwd: this.config.projectRoot,
        encoding: 'utf8'
      });

      return {
        tool: 'retire-js',
        timestamp: new Date().toISOString(),
        vulnerabilities: JSON.parse(output)
      };
    } catch (error) {
      if (error.stdout) {
        return {
          tool: 'retire-js',
          timestamp: new Date().toISOString(),
          vulnerabilities: JSON.parse(error.stdout)
        };
      }
      throw error;
    }
  }

  // Static Application Security Testing (SAST)
  async runStaticAnalysis() {
    const sastResults = [];

    // ESLint Security Plugin
    if (this.config.tools.eslintSecurity.enabled) {
      try {
        const eslintResult = await this.runESLintSecurity();
        sastResults.push(eslintResult);
      } catch (error) {
        console.error('ESLint Security scan failed:', error.message);
      }
    }

    // Semgrep
    if (this.config.tools.semgrep.enabled) {
      try {
        const semgrepResult = await this.runSemgrep();
        sastResults.push(semgrepResult);
      } catch (error) {
        console.error('Semgrep scan failed:', error.message);
      }
    }

    this.results.staticAnalysis = sastResults;
    return sastResults;
  }

  async runESLintSecurity() {
    try {
      const output = execSync('npx eslint . --format json --ext .js,.ts,.jsx,.tsx', {
        cwd: this.config.projectRoot,
        encoding: 'utf8'
      });

      const eslintResults = JSON.parse(output);
      
      // Filter for security-related rules
      const securityIssues = eslintResults.map(file => ({
        ...file,
        messages: file.messages.filter(msg => 
          msg.ruleId && (
            msg.ruleId.includes('security') ||
            msg.ruleId.includes('xss') ||
            msg.ruleId.includes('injection') ||
            msg.ruleId.includes('crypto')
          )
        )
      })).filter(file => file.messages.length > 0);

      return {
        tool: 'eslint-security',
        timestamp: new Date().toISOString(),
        issues: securityIssues
      };
    } catch (error) {
      if (error.stdout) {
        const eslintResults = JSON.parse(error.stdout);
        return {
          tool: 'eslint-security',
          timestamp: new Date().toISOString(),
          issues: eslintResults
        };
      }
      throw error;
    }
  }

  async runSemgrep() {
    try {
      const output = execSync('semgrep --config auto --json --no-git-ignore', {
        cwd: this.config.projectRoot,
        encoding: 'utf8'
      });

      return {
        tool: 'semgrep',
        timestamp: new Date().toISOString(),
        findings: JSON.parse(output)
      };
    } catch (error) {
      if (error.stdout) {
        return {
          tool: 'semgrep',
          timestamp: new Date().toISOString(),
          findings: JSON.parse(error.stdout)
        };
      }
      throw error;
    }
  }

  // Secret scanning
  async scanForSecrets() {
    try {
      const secretsResult = await this.runTruffleHog();
      this.results.secrets = [secretsResult];
      return [secretsResult];
    } catch (error) {
      console.error('Secret scanning failed:', error.message);
      return [];
    }
  }

  async runTruffleHog() {
    try {
      const output = execSync('trufflehog filesystem . --json', {
        cwd: this.config.projectRoot,
        encoding: 'utf8'
      });

      const secrets = output.split('\n')
        .filter(line => line.trim())
        .map(line => JSON.parse(line));

      return {
        tool: 'trufflehog',
        timestamp: new Date().toISOString(),
        secrets: secrets
      };
    } catch (error) {
      if (error.stdout) {
        const secrets = error.stdout.split('\n')
          .filter(line => line.trim())
          .map(line => {
            try {
              return JSON.parse(line);
            } catch {
              return null;
            }
          })
          .filter(Boolean);

        return {
          tool: 'trufflehog',
          timestamp: new Date().toISOString(),
          secrets: secrets
        };
      }
      throw error;
    }
  }

  // Container security scanning
  async scanContainers() {
    const containerResults = [];

    try {
      // Check if Dockerfile exists
      const dockerfilePath = path.join(this.config.projectRoot, 'Dockerfile');
      const dockerfileExists = await fs.access(dockerfilePath).then(() => true).catch(() => false);

      if (dockerfileExists) {
        // Trivy scan
        const trivyResult = await this.runTrivy();
        containerResults.push(trivyResult);

        // Hadolint (Dockerfile linting)
        const hadolintResult = await this.runHadolint();
        containerResults.push(hadolintResult);
      }

      this.results.containers = containerResults;
      return containerResults;
    } catch (error) {
      console.error('Container scanning failed:', error.message);
      return containerResults;
    }
  }

  async runTrivy() {
    try {
      const output = execSync('trivy fs --format json .', {
        cwd: this.config.projectRoot,
        encoding: 'utf8'
      });

      return {
        tool: 'trivy',
        timestamp: new Date().toISOString(),
        results: JSON.parse(output)
      };
    } catch (error) {
      throw error;
    }
  }

  async runHadolint() {
    try {
      const output = execSync('hadolint Dockerfile --format json', {
        cwd: this.config.projectRoot,
        encoding: 'utf8'
      });

      return {
        tool: 'hadolint',
        timestamp: new Date().toISOString(),
        issues: JSON.parse(output)
      };
    } catch (error) {
      if (error.stdout) {
        return {
          tool: 'hadolint',
          timestamp: new Date().toISOString(),
          issues: JSON.parse(error.stdout)
        };
      }
      throw error;
    }
  }

  // Infrastructure as Code scanning
  async scanInfrastructure() {
    const infraResults = [];

    try {
      // Checkov for Terraform, Kubernetes, etc.
      const checkovResult = await this.runCheckov();
      infraResults.push(checkovResult);

      // Kube-score for Kubernetes manifests
      const kubeScoreResult = await this.runKubeScore();
      if (kubeScoreResult) {
        infraResults.push(kubeScoreResult);
      }

      this.results.infrastructure = infraResults;
      return infraResults;
    } catch (error) {
      console.error('Infrastructure scanning failed:', error.message);
      return infraResults;
    }
  }

  async runCheckov() {
    try {
      const output = execSync('checkov -d . --framework all --output json', {
        cwd: this.config.projectRoot,
        encoding: 'utf8'
      });

      return {
        tool: 'checkov',
        timestamp: new Date().toISOString(),
        results: JSON.parse(output)
      };
    } catch (error) {
      if (error.stdout) {
        return {
          tool: 'checkov',
          timestamp: new Date().toISOString(),
          results: JSON.parse(error.stdout)
        };
      }
      throw error;
    }
  }

  async runKubeScore() {
    try {
      // Check for Kubernetes manifests
      const k8sFiles = await this.findK8sManifests();
      if (k8sFiles.length === 0) {
        return null;
      }

      const output = execSync(`kube-score score ${k8sFiles.join(' ')} --output-format json`, {
        cwd: this.config.projectRoot,
        encoding: 'utf8'
      });

      return {
        tool: 'kube-score',
        timestamp: new Date().toISOString(),
        results: JSON.parse(output)
      };
    } catch (error) {
      return null;
    }
  }

  async findK8sManifests() {
    const k8sFiles = [];
    const extensions = ['.yaml', '.yml'];
    
    // Common Kubernetes directories
    const searchDirs = ['k8s', 'kubernetes', 'manifests', '.'];
    
    for (const dir of searchDirs) {
      try {
        const dirPath = path.join(this.config.projectRoot, dir);
        const files = await fs.readdir(dirPath);
        
        for (const file of files) {
          if (extensions.some(ext => file.endsWith(ext))) {
            const filePath = path.join(dirPath, file);
            const content = await fs.readFile(filePath, 'utf8');
            
            // Simple check for Kubernetes resources
            if (content.includes('apiVersion:') && content.includes('kind:')) {
              k8sFiles.push(path.relative(this.config.projectRoot, filePath));
            }
          }
        }
      } catch (error) {
        // Directory doesn't exist, continue
      }
    }
    
    return k8sFiles;
  }

  // Process and normalize scan results
  processScanResults(results) {
    const summary = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
      total: 0
    };

    // Process each scan result
    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        const scanData = Array.isArray(result.value) ? result.value : [result.value];
        
        scanData.forEach(scan => {
          if (scan.vulnerabilities) {
            this.countVulnerabilities(scan.vulnerabilities, summary);
          }
          if (scan.issues) {
            this.countIssues(scan.issues, summary);
          }
          if (scan.findings) {
            this.countFindings(scan.findings, summary);
          }
        });
      }
    });

    summary.total = summary.critical + summary.high + summary.medium + summary.low + summary.info;
    this.results.summary = summary;
  }

  countVulnerabilities(vulnerabilities, summary) {
    for (const vuln of Object.values(vulnerabilities)) {
      switch (vuln.severity?.toLowerCase()) {
        case 'critical':
          summary.critical++;
          break;
        case 'high':
          summary.high++;
          break;
        case 'medium':
        case 'moderate':
          summary.medium++;
          break;
        case 'low':
          summary.low++;
          break;
        default:
          summary.info++;
      }
    }
  }

  countIssues(issues, summary) {
    for (const issue of issues) {
      const severity = issue.severity || issue.level || 'info';
      switch (severity.toLowerCase()) {
        case 'critical':
        case 'error':
          summary.critical++;
          break;
        case 'high':
        case 'warning':
          summary.high++;
          break;
        case 'medium':
          summary.medium++;
          break;
        case 'low':
          summary.low++;
          break;
        default:
          summary.info++;
      }
    }
  }

  countFindings(findings, summary) {
    if (findings.results) {
      for (const result of findings.results) {
        const severity = result.extra?.severity || 'info';
        switch (severity.toLowerCase()) {
          case 'critical':
            summary.critical++;
            break;
          case 'high':
            summary.high++;
            break;
          case 'medium':
            summary.medium++;
            break;
          case 'low':
            summary.low++;
            break;
          default:
            summary.info++;
        }
      }
    }
  }

  // Check compliance against thresholds
  checkComplianceThresholds() {
    const summary = this.results.summary;
    const thresholds = this.config.thresholds;
    
    const compliance = {
      passed: true,
      violations: []
    };

    if (summary.critical > thresholds.critical) {
      compliance.passed = false;
      compliance.violations.push(`Critical vulnerabilities: ${summary.critical} (threshold: ${thresholds.critical})`);
    }

    if (summary.high > thresholds.high) {
      compliance.passed = false;
      compliance.violations.push(`High vulnerabilities: ${summary.high} (threshold: ${thresholds.high})`);
    }

    if (summary.medium > thresholds.medium) {
      compliance.passed = false;
      compliance.violations.push(`Medium vulnerabilities: ${summary.medium} (threshold: ${thresholds.medium})`);
    }

    if (summary.low > thresholds.low) {
      compliance.passed = false;
      compliance.violations.push(`Low vulnerabilities: ${summary.low} (threshold: ${thresholds.low})`);
    }

    return compliance;
  }

  // Generate reports
  async generateReports() {
    await this.setupOutputDirectory();

    const reportPromises = this.config.reporting.formats.map(format => {
      switch (format) {
        case 'json':
          return this.generateJSONReport();
        case 'sarif':
          return this.generateSARIFReport();
        case 'html':
          return this.generateHTMLReport();
        default:
          return Promise.resolve();
      }
    });

    await Promise.all(reportPromises);
  }

  async setupOutputDirectory() {
    try {
      await fs.mkdir(this.config.reporting.outputDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create output directory:', error);
    }
  }

  async generateJSONReport() {
    const reportPath = path.join(this.config.reporting.outputDir, 'security-report.json');
    const report = {
      timestamp: new Date().toISOString(),
      summary: this.results.summary,
      results: this.results
    };

    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    console.log(`JSON report generated: ${reportPath}`);
  }

  async generateSARIFReport() {
    const reportPath = path.join(this.config.reporting.outputDir, 'security-report.sarif');
    
    const sarifReport = {
      version: '2.1.0',
      $schema: 'https://schemastore.azurewebsites.net/schemas/json/sarif-2.1.0.json',
      runs: []
    };

    // Convert results to SARIF format
    this.results.staticAnalysis.forEach(scan => {
      if (scan.findings && scan.findings.results) {
        const run = {
          tool: {
            driver: {
              name: scan.tool,
              version: '1.0.0'
            }
          },
          results: scan.findings.results.map(finding => ({
            ruleId: finding.check_id,
            level: this.mapSeverityToLevel(finding.extra?.severity),
            message: {
              text: finding.extra?.message || 'Security finding'
            },
            locations: [{
              physicalLocation: {
                artifactLocation: {
                  uri: finding.path
                },
                region: {
                  startLine: finding.start?.line || 1
                }
              }
            }]
          }))
        };
        sarifReport.runs.push(run);
      }
    });

    await fs.writeFile(reportPath, JSON.stringify(sarifReport, null, 2));
    console.log(`SARIF report generated: ${reportPath}`);
  }

  async generateHTMLReport() {
    const reportPath = path.join(this.config.reporting.outputDir, 'security-report.html');
    
    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Security Scan Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .summary { background: #f5f5f5; padding: 15px; border-radius: 5px; }
        .critical { color: #d32f2f; }
        .high { color: #f57c00; }
        .medium { color: #fbc02d; }
        .low { color: #388e3c; }
        table { border-collapse: collapse; width: 100%; margin-top: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <h1>Security Scan Report</h1>
    <div class="summary">
        <h2>Summary</h2>
        <p><span class="critical">Critical: ${this.results.summary?.critical || 0}</span></p>
        <p><span class="high">High: ${this.results.summary?.high || 0}</span></p>
        <p><span class="medium">Medium: ${this.results.summary?.medium || 0}</span></p>
        <p><span class="low">Low: ${this.results.summary?.low || 0}</span></p>
        <p>Total: ${this.results.summary?.total || 0}</p>
    </div>
    
    <h2>Scan Results</h2>
    <p>Generated: ${new Date().toISOString()}</p>
    <p>For detailed results, see the JSON report.</p>
</body>
</html>`;

    await fs.writeFile(reportPath, html);
    console.log(`HTML report generated: ${reportPath}`);
  }

  mapSeverityToLevel(severity) {
    switch (severity?.toLowerCase()) {
      case 'critical':
        return 'error';
      case 'high':
        return 'error';
      case 'medium':
        return 'warning';
      case 'low':
        return 'note';
      default:
        return 'note';
    }
  }

  // Schedule automated scans
  setupScheduledScans() {
    if (!this.config.scheduling.enabled) {
      return;
    }

    setInterval(async () => {
      try {
        console.log('Running scheduled security scan...');
        await this.runFullScan();
      } catch (error) {
        console.error('Scheduled security scan failed:', error);
      }
    }, this.config.scheduling.interval);
  }
}

module.exports = SecurityScanner;