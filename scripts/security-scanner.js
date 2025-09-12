#!/usr/bin/env node

/**
 * Comprehensive Security Scanner for Unjucks Production Environment
 * Performs automated security scanning including SAST, dependency audit, and configuration review
 */

const fs = require('fs').promises;
const path = require('path');
const { execSync, spawn } = require('child_process');
const crypto = require('crypto');

class SecurityScanner {
  constructor(options = {}) {
    this.options = {
      outputDir: options.outputDir || './security-reports',
      verbose: options.verbose || false,
      failOnHigh: options.failOnHigh !== false,
      skipSlowScans: options.skipSlowScans || false,
      includeCompliance: options.includeCompliance !== false,
      ...options
    };

    this.results = {
      timestamp: this.getDeterministicDate().toISOString(),
      scanId: crypto.randomUUID(),
      findings: {},
      summary: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        info: 0
      },
      compliance: {},
      recommendations: []
    };

    this.scanners = [
      'staticAnalysis',
      'dependencyAudit',
      'configurationReview',
      'secretsDetection',
      'dockerSecurity',
      'infrastructureSecurity'
    ];

    if (this.options.includeCompliance) {
      this.scanners.push('complianceCheck');
    }
  }

  async init() {
    console.log('🔒 Security Scanner Initializing...');
    console.log(`📊 Scan ID: ${this.results.scanId}`);
    console.log(`📁 Output Directory: ${this.options.outputDir}`);
    
    await fs.mkdir(this.options.outputDir, { recursive: true });
    
    // Create scan-specific subdirectory
    this.scanPath = path.join(this.options.outputDir, `scan-${this.getDeterministicTimestamp()}`);
    await fs.mkdir(this.scanPath, { recursive: true });
    
    console.log(`🔍 Scan Results: ${this.scanPath}`);
  }

  async executeCommand(command, options = {}) {
    return new Promise((resolve) => {
      const child = spawn('sh', ['-c', command], {
        stdio: options.capture ? ['pipe', 'pipe', 'pipe'] : 'inherit',
        timeout: options.timeout || 300000
      });
      
      let stdout = '';
      let stderr = '';
      
      if (options.capture) {
        child.stdout.on('data', (data) => {
          stdout += data.toString();
        });
        
        child.stderr.on('data', (data) => {
          stderr += data.toString();
        });
      }
      
      child.on('close', (code) => {
        resolve({
          success: code === 0,
          output: stdout,
          error: stderr,
          exitCode: code
        });
      });
      
      child.on('error', (error) => {
        resolve({
          success: false,
          error: error.message,
          exitCode: -1
        });
      });
    });
  }

  async staticAnalysis() {
    console.log('\n🔍 Running Static Code Analysis...');
    
    const findings = {
      eslint: [],
      semgrep: [],
      codeql: []
    };

    try {
      // ESLint security analysis
      const eslintResult = await this.executeCommand(
        'npx eslint src/ --config .eslintrc.security.js --format json',
        { capture: true }
      );

      if (eslintResult.output) {
        try {
          const eslintFindings = JSON.parse(eslintResult.output);
          findings.eslint = this.processEslintFindings(eslintFindings);
        } catch (e) {
          console.warn('⚠️ Failed to parse ESLint output');
        }
      }

      // Semgrep SAST scanning
      if (!this.options.skipSlowScans) {
        console.log('   📡 Running Semgrep SAST...');
        const semgrepResult = await this.executeCommand(
          'npx semgrep --config=auto --json src/',
          { capture: true, timeout: 600000 }
        );

        if (semgrepResult.output) {
          try {
            const semgrepData = JSON.parse(semgrepResult.output);
            findings.semgrep = this.processSemgrepFindings(semgrepData);
          } catch (e) {
            console.warn('⚠️ Failed to parse Semgrep output');
          }
        }
      }

      // CodeQL analysis (if available)
      if (await this.checkCommandExists('codeql')) {
        console.log('   🔬 Running CodeQL analysis...');
        const codeqlResult = await this.executeCommand(
          'codeql database analyze --format=json --output=codeql-results.json',
          { capture: true, timeout: 900000 }
        );

        if (codeqlResult.success) {
          try {
            const codeqlData = JSON.parse(await fs.readFile('codeql-results.json', 'utf8'));
            findings.codeql = this.processCodeQLFindings(codeqlData);
          } catch (e) {
            console.warn('⚠️ Failed to parse CodeQL output');
          }
        }
      }

    } catch (error) {
      console.error('❌ Static analysis failed:', error.message);
    }

    this.results.findings.staticAnalysis = findings;
    this.updateSummary(findings);
    
    console.log(`   ✅ Static analysis complete: ${this.getFindingsCount(findings)} findings`);
  }

  processEslintFindings(eslintResults) {
    const findings = [];
    
    for (const file of eslintResults) {
      for (const message of file.messages || []) {
        if (message.ruleId && message.ruleId.startsWith('security/')) {
          findings.push({
            type: 'security',
            severity: this.mapEslintSeverity(message.severity),
            rule: message.ruleId,
            message: message.message,
            file: file.filePath,
            line: message.line,
            column: message.column
          });
        }
      }
    }
    
    return findings;
  }

  processSemgrepFindings(semgrepData) {
    const findings = [];
    
    for (const result of semgrepData.results || []) {
      findings.push({
        type: 'sast',
        severity: this.mapSemgrepSeverity(result.extra.severity),
        rule: result.check_id,
        message: result.extra.message,
        file: result.path,
        line: result.start.line,
        column: result.start.col,
        cwe: result.extra.metadata?.cwe,
        owasp: result.extra.metadata?.owasp
      });
    }
    
    return findings;
  }

  processCodeQLFindings(codeqlData) {
    const findings = [];
    
    for (const result of codeqlData.runs?.[0]?.results || []) {
      findings.push({
        type: 'codeql',
        severity: this.mapCodeQLSeverity(result.level),
        rule: result.ruleId,
        message: result.message.text,
        file: result.locations?.[0]?.physicalLocation?.artifactLocation?.uri,
        line: result.locations?.[0]?.physicalLocation?.region?.startLine
      });
    }
    
    return findings;
  }

  async dependencyAudit() {
    console.log('\n🔍 Running Dependency Security Audit...');
    
    const findings = {
      npm: [],
      yarn: [],
      outdated: []
    };

    try {
      // NPM audit
      const npmAuditResult = await this.executeCommand(
        'npm audit --audit-level=low --json',
        { capture: true }
      );

      if (npmAuditResult.output) {
        try {
          const auditData = JSON.parse(npmAuditResult.output);
          findings.npm = this.processNpmAuditFindings(auditData);
        } catch (e) {
          console.warn('⚠️ Failed to parse NPM audit output');
        }
      }

      // Check for outdated dependencies
      const outdatedResult = await this.executeCommand(
        'npm outdated --json',
        { capture: true }
      );

      if (outdatedResult.output) {
        try {
          const outdatedData = JSON.parse(outdatedResult.output);
          findings.outdated = this.processOutdatedFindings(outdatedData);
        } catch (e) {
          // npm outdated returns non-zero exit code when outdated packages exist
          if (outdatedResult.error) {
            try {
              const outdatedData = JSON.parse(outdatedResult.error);
              findings.outdated = this.processOutdatedFindings(outdatedData);
            } catch (e2) {
              console.warn('⚠️ Failed to parse outdated dependencies output');
            }
          }
        }
      }

      // License compliance check
      const licenseResult = await this.executeCommand(
        'npx license-checker --json',
        { capture: true }
      );

      if (licenseResult.output) {
        try {
          const licenseData = JSON.parse(licenseResult.output);
          findings.licenses = this.processLicenseFindings(licenseData);
        } catch (e) {
          console.warn('⚠️ Failed to parse license checker output');
        }
      }

    } catch (error) {
      console.error('❌ Dependency audit failed:', error.message);
    }

    this.results.findings.dependencyAudit = findings;
    this.updateSummary(findings);
    
    console.log(`   ✅ Dependency audit complete: ${this.getFindingsCount(findings)} findings`);
  }

  processNpmAuditFindings(auditData) {
    const findings = [];
    
    for (const [name, vuln] of Object.entries(auditData.vulnerabilities || {})) {
      findings.push({
        type: 'vulnerability',
        severity: vuln.severity,
        package: name,
        title: vuln.title,
        description: vuln.overview,
        cwe: vuln.cwe,
        cvss: vuln.cvss,
        range: vuln.range,
        fixAvailable: !!vuln.fixAvailable,
        url: vuln.url
      });
    }
    
    return findings;
  }

  processOutdatedFindings(outdatedData) {
    const findings = [];
    
    for (const [name, info] of Object.entries(outdatedData)) {
      const isSecurityUpdate = this.isSecurityUpdate(info.current, info.latest);
      
      findings.push({
        type: 'outdated',
        severity: isSecurityUpdate ? 'medium' : 'low',
        package: name,
        current: info.current,
        wanted: info.wanted,
        latest: info.latest,
        location: info.location,
        securityUpdate: isSecurityUpdate
      });
    }
    
    return findings;
  }

  processLicenseFindings(licenseData) {
    const findings = [];
    const prohibitedLicenses = ['GPL-2.0', 'GPL-3.0', 'AGPL-1.0', 'AGPL-3.0'];
    
    for (const [name, info] of Object.entries(licenseData)) {
      const license = info.licenses;
      
      if (prohibitedLicenses.some(prohibited => 
        license?.toLowerCase().includes(prohibited.toLowerCase()))) {
        findings.push({
          type: 'license',
          severity: 'high',
          package: name,
          license: license,
          reason: 'Prohibited license for commercial use'
        });
      }
    }
    
    return findings;
  }

  async configurationReview() {
    console.log('\n🔍 Running Configuration Security Review...');
    
    const findings = {
      environment: [],
      docker: [],
      kubernetes: [],
      nginx: []
    };

    try {
      // Environment configuration review
      findings.environment = await this.reviewEnvironmentConfig();
      
      // Docker configuration review
      if (await this.fileExists('Dockerfile')) {
        findings.docker = await this.reviewDockerConfig();
      }
      
      // Kubernetes configuration review
      if (await this.fileExists('k8s/') || await this.fileExists('kubernetes/')) {
        findings.kubernetes = await this.reviewKubernetesConfig();
      }
      
      // NGINX configuration review
      if (await this.fileExists('nginx.conf') || await this.fileExists('nginx/')) {
        findings.nginx = await this.reviewNginxConfig();
      }

    } catch (error) {
      console.error('❌ Configuration review failed:', error.message);
    }

    this.results.findings.configurationReview = findings;
    this.updateSummary(findings);
    
    console.log(`   ✅ Configuration review complete: ${this.getFindingsCount(findings)} findings`);
  }

  async reviewEnvironmentConfig() {
    const findings = [];
    
    // Check for hardcoded secrets in package.json
    try {
      const packageJson = JSON.parse(await fs.readFile('package.json', 'utf8'));
      
      if (packageJson.scripts) {
        for (const [scriptName, script] of Object.entries(packageJson.scripts)) {
          if (this.containsSecrets(script)) {
            findings.push({
              type: 'hardcoded_secret',
              severity: 'high',
              location: `package.json:scripts.${scriptName}`,
              message: 'Potential hardcoded secret in npm script'
            });
          }
        }
      }
    } catch (e) {
      // package.json not found or invalid
    }
    
    // Check environment variable usage
    const envFiles = ['.env', '.env.example', '.env.local', '.env.production'];
    
    for (const envFile of envFiles) {
      if (await this.fileExists(envFile)) {
        try {
          const content = await fs.readFile(envFile, 'utf8');
          const lines = content.split('\n');
          
          lines.forEach((line, index) => {
            if (line.includes('=') && !line.startsWith('#')) {
              const [key, value] = line.split('=', 2);
              
              if (this.isWeakSecret(value)) {
                findings.push({
                  type: 'weak_secret',
                  severity: 'medium',
                  location: `${envFile}:${index + 1}`,
                  message: `Weak or default secret value for ${key}`
                });
              }
            }
          });
        } catch (e) {
          // File read error
        }
      }
    }
    
    return findings;
  }

  async reviewDockerConfig() {
    const findings = [];
    
    try {
      const dockerfileContent = await fs.readFile('Dockerfile', 'utf8');
      const lines = dockerfileContent.split('\n');
      
      lines.forEach((line, index) => {
        const trimmedLine = line.trim();
        
        // Check for running as root
        if (trimmedLine.startsWith('USER root') || 
            (trimmedLine.startsWith('USER') && trimmedLine.includes('0'))) {
          findings.push({
            type: 'docker_security',
            severity: 'high',
            location: `Dockerfile:${index + 1}`,
            message: 'Container running as root user'
          });
        }
        
        // Check for exposed secrets
        if (trimmedLine.startsWith('ENV') || trimmedLine.startsWith('ARG')) {
          if (this.containsSecrets(trimmedLine)) {
            findings.push({
              type: 'docker_secret',
              severity: 'high',
              location: `Dockerfile:${index + 1}`,
              message: 'Potential secret exposed in Dockerfile'
            });
          }
        }
        
        // Check for security best practices
        if (trimmedLine.startsWith('ADD ') && trimmedLine.includes('http')) {
          findings.push({
            type: 'docker_security',
            severity: 'medium',
            location: `Dockerfile:${index + 1}`,
            message: 'Using ADD with URL, prefer COPY and explicit download'
          });
        }
      });
      
    } catch (e) {
      // Dockerfile not found or read error
    }
    
    return findings;
  }

  async secretsDetection() {
    console.log('\n🔍 Running Secrets Detection...');
    
    const findings = [];

    try {
      // Use git-secrets if available
      if (await this.checkCommandExists('git-secrets')) {
        const secretsResult = await this.executeCommand(
          'git secrets --scan',
          { capture: true }
        );
        
        if (!secretsResult.success && secretsResult.output) {
          // git-secrets found secrets (returns non-zero)
          const secretLines = secretsResult.output.split('\n');
          
          for (const line of secretLines) {
            if (line.includes(':')) {
              const [location, ...messageParts] = line.split(':');
              findings.push({
                type: 'secret_detected',
                severity: 'critical',
                location: location,
                message: messageParts.join(':').trim()
              });
            }
          }
        }
      } else {
        // Manual secrets detection
        findings.push(...await this.manualSecretsDetection());
      }

    } catch (error) {
      console.error('❌ Secrets detection failed:', error.message);
    }

    this.results.findings.secretsDetection = findings;
    this.updateSummary({ secretsDetection: findings });
    
    console.log(`   ✅ Secrets detection complete: ${findings.length} findings`);
  }

  async manualSecretsDetection() {
    const findings = [];
    const secretPatterns = [
      { name: 'AWS Access Key', pattern: /AKIA[0-9A-Z]{16}/g, severity: 'critical' },
      { name: 'AWS Secret Key', pattern: /[0-9a-zA-Z/+]{40}/g, severity: 'critical' },
      { name: 'Private Key', pattern: /-----BEGIN (RSA |DSA |EC )?PRIVATE KEY-----/g, severity: 'critical' },
      { name: 'API Key', pattern: /api[_-]?key[_-]?[=:]\s*['""][a-zA-Z0-9]{20,}['"]/gi, severity: 'high' },
      { name: 'JWT Token', pattern: /eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, severity: 'high' },
      { name: 'Database URL', pattern: /(postgres|mysql|mongodb):\/\/[^:\s]+:[^@\s]+@/gi, severity: 'high' }
    ];

    const filesToScan = await this.getFilesToScan();
    
    for (const filePath of filesToScan) {
      try {
        const content = await fs.readFile(filePath, 'utf8');
        const lines = content.split('\n');
        
        lines.forEach((line, lineNumber) => {
          for (const pattern of secretPatterns) {
            const matches = line.matchAll(pattern.pattern);
            
            for (const match of matches) {
              findings.push({
                type: 'secret_pattern',
                severity: pattern.severity,
                location: `${filePath}:${lineNumber + 1}`,
                pattern: pattern.name,
                message: `Potential ${pattern.name} detected`
              });
            }
          }
        });
        
      } catch (e) {
        // Skip files that can't be read
      }
    }
    
    return findings;
  }

  async dockerSecurity() {
    console.log('\n🔍 Running Docker Security Scan...');
    
    const findings = [];

    try {
      // Trivy container scan
      if (await this.checkCommandExists('trivy')) {
        const trivyResult = await this.executeCommand(
          'trivy image --format json --output trivy-results.json unjucks:latest',
          { capture: true, timeout: 600000 }
        );

        if (trivyResult.success && await this.fileExists('trivy-results.json')) {
          try {
            const trivyData = JSON.parse(await fs.readFile('trivy-results.json', 'utf8'));
            findings.push(...this.processTrivyFindings(trivyData));
          } catch (e) {
            console.warn('⚠️ Failed to parse Trivy output');
          }
        }
      }

      // Docker Bench Security
      if (await this.checkCommandExists('docker-bench-security')) {
        const benchResult = await this.executeCommand(
          'docker-bench-security -j',
          { capture: true, timeout: 300000 }
        );

        if (benchResult.output) {
          try {
            const benchData = JSON.parse(benchResult.output);
            findings.push(...this.processBenchFindings(benchData));
          } catch (e) {
            console.warn('⚠️ Failed to parse Docker Bench output');
          }
        }
      }

    } catch (error) {
      console.error('❌ Docker security scan failed:', error.message);
    }

    this.results.findings.dockerSecurity = findings;
    this.updateSummary({ dockerSecurity: findings });
    
    console.log(`   ✅ Docker security scan complete: ${findings.length} findings`);
  }

  async infrastructureSecurity() {
    console.log('\n🔍 Running Infrastructure Security Review...');
    
    const findings = [];

    try {
      // Terraform security scan
      if (await this.checkCommandExists('tfsec')) {
        const tfsecResult = await this.executeCommand(
          'tfsec --format json --out tfsec-results.json .',
          { capture: true }
        );

        if (await this.fileExists('tfsec-results.json')) {
          try {
            const tfsecData = JSON.parse(await fs.readFile('tfsec-results.json', 'utf8'));
            findings.push(...this.processTfsecFindings(tfsecData));
          } catch (e) {
            console.warn('⚠️ Failed to parse tfsec output');
          }
        }
      }

      // Kubernetes security scan
      if (await this.checkCommandExists('kubesec')) {
        const k8sFiles = await this.getKubernetesFiles();
        
        for (const file of k8sFiles) {
          const kubesecResult = await this.executeCommand(
            `kubesec scan ${file}`,
            { capture: true }
          );

          if (kubesecResult.output) {
            try {
              const kubesecData = JSON.parse(kubesecResult.output);
              findings.push(...this.processKubesecFindings(kubesecData, file));
            } catch (e) {
              console.warn(`⚠️ Failed to parse kubesec output for ${file}`);
            }
          }
        }
      }

    } catch (error) {
      console.error('❌ Infrastructure security scan failed:', error.message);
    }

    this.results.findings.infrastructureSecurity = findings;
    this.updateSummary({ infrastructureSecurity: findings });
    
    console.log(`   ✅ Infrastructure security scan complete: ${findings.length} findings`);
  }

  async complianceCheck() {
    console.log('\n🔍 Running Compliance Checks...');
    
    const compliance = {
      gdpr: await this.checkGDPRCompliance(),
      sox: await this.checkSOXCompliance(),
      hipaa: await this.checkHIPAACompliance(),
      iso27001: await this.checkISO27001Compliance()
    };

    this.results.compliance = compliance;
    
    console.log(`   ✅ Compliance checks complete`);
  }

  async checkGDPRCompliance() {
    return {
      dataMinimization: await this.checkDataMinimization(),
      consentManagement: await this.checkConsentManagement(),
      rightToBeForgotten: await this.checkRightToBeForgotten(),
      dataPortability: await this.checkDataPortability(),
      privacyByDesign: await this.checkPrivacyByDesign()
    };
  }

  async generateReport() {
    console.log('\n📊 Generating Security Report...');
    
    // Calculate final summary
    this.results.summary.total = Object.values(this.results.summary).reduce((a, b) => a + b, 0);
    this.results.summary.riskScore = this.calculateRiskScore();
    
    // Generate recommendations
    this.results.recommendations = this.generateRecommendations();
    
    // Save detailed JSON report
    const jsonReport = path.join(this.scanPath, 'security-report.json');
    await fs.writeFile(jsonReport, JSON.stringify(this.results, null, 2));
    
    // Generate HTML report
    const htmlReport = path.join(this.scanPath, 'security-report.html');
    await fs.writeFile(htmlReport, this.generateHTMLReport());
    
    // Generate executive summary
    const execSummary = path.join(this.scanPath, 'executive-summary.md');
    await fs.writeFile(execSummary, this.generateExecutiveSummary());
    
    console.log(`📄 JSON Report: ${jsonReport}`);
    console.log(`📊 HTML Report: ${htmlReport}`);
    console.log(`📋 Executive Summary: ${execSummary}`);
    
    return this.results;
  }

  calculateRiskScore() {
    const { critical, high, medium, low } = this.results.summary;
    return (critical * 10) + (high * 7) + (medium * 4) + (low * 1);
  }

  generateRecommendations() {
    const recommendations = [];
    const { summary } = this.results;
    
    if (summary.critical > 0) {
      recommendations.push({
        priority: 'critical',
        category: 'immediate_action',
        title: 'Address Critical Security Issues',
        description: `${summary.critical} critical security issues require immediate attention`,
        impact: 'high',
        effort: 'medium'
      });
    }
    
    if (summary.high > 5) {
      recommendations.push({
        priority: 'high',
        category: 'security_hardening',
        title: 'Implement Security Hardening Measures',
        description: 'Multiple high-severity issues indicate need for comprehensive security review',
        impact: 'high',
        effort: 'high'
      });
    }
    
    // Add specific recommendations based on findings
    if (this.results.findings.dependencyAudit?.npm?.length > 0) {
      recommendations.push({
        priority: 'high',
        category: 'dependency_management',
        title: 'Update Vulnerable Dependencies',
        description: 'Update or replace dependencies with known vulnerabilities',
        impact: 'medium',
        effort: 'low'
      });
    }
    
    return recommendations;
  }

  generateHTMLReport() {
    const { summary, findings, compliance, recommendations } = this.results;
    
    return `
<!DOCTYPE html>
<html>
<head>
    <title>Security Scan Report - ${this.results.scanId}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin: 20px 0; }
        .metric { background: white; border: 2px solid #ddd; padding: 15px; border-radius: 8px; text-align: center; }
        .critical { border-color: #dc3545; color: #dc3545; }
        .high { border-color: #fd7e14; color: #fd7e14; }
        .medium { border-color: #ffc107; color: #e09900; }
        .low { border-color: #28a745; color: #28a745; }
        .finding { margin: 10px 0; padding: 15px; border-left: 4px solid #ddd; background: #f8f9fa; }
        .finding.critical { border-left-color: #dc3545; }
        .finding.high { border-left-color: #fd7e14; }
        .finding.medium { border-left-color: #ffc107; }
        .finding.low { border-left-color: #28a745; }
        .section { margin: 30px 0; }
        .recommendations { background: #e7f3ff; padding: 20px; border-radius: 8px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🔒 Security Scan Report</h1>
        <p><strong>Scan ID:</strong> ${this.results.scanId}</p>
        <p><strong>Timestamp:</strong> ${this.results.timestamp}</p>
        <p><strong>Risk Score:</strong> ${summary.riskScore}/100</p>
    </div>
    
    <div class="summary">
        <div class="metric critical">
            <h3>${summary.critical}</h3>
            <p>Critical</p>
        </div>
        <div class="metric high">
            <h3>${summary.high}</h3>
            <p>High</p>
        </div>
        <div class="metric medium">
            <h3>${summary.medium}</h3>
            <p>Medium</p>
        </div>
        <div class="metric low">
            <h3>${summary.low}</h3>
            <p>Low</p>
        </div>
    </div>
    
    <div class="recommendations">
        <h2>🎯 Key Recommendations</h2>
        ${recommendations.map(rec => `
            <div class="recommendation">
                <h4>${rec.title}</h4>
                <p>${rec.description}</p>
                <small><strong>Impact:</strong> ${rec.impact} | <strong>Effort:</strong> ${rec.effort}</small>
            </div>
        `).join('')}
    </div>
    
    <div class="section">
        <h2>🔍 Detailed Findings</h2>
        ${Object.entries(findings).map(([category, categoryFindings]) => `
            <h3>${category.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</h3>
            ${this.renderCategoryFindings(categoryFindings)}
        `).join('')}
    </div>
    
    ${compliance ? `
        <div class="section">
            <h2>📋 Compliance Status</h2>
            ${Object.entries(compliance).map(([framework, status]) => `
                <h4>${framework.toUpperCase()}</h4>
                <p>Status: ${JSON.stringify(status, null, 2)}</p>
            `).join('')}
        </div>
    ` : ''}
</body>
</html>
    `.trim();
  }

  renderCategoryFindings(categoryFindings) {
    if (Array.isArray(categoryFindings)) {
      return categoryFindings.map(finding => `
        <div class="finding ${finding.severity}">
            <strong>${finding.type || 'Security Finding'}</strong>
            <p>${finding.message || finding.description}</p>
            ${finding.file ? `<small><strong>Location:</strong> ${finding.file}:${finding.line || ''}</small>` : ''}
            ${finding.rule ? `<small><strong>Rule:</strong> ${finding.rule}</small>` : ''}
        </div>
      `).join('');
    } else {
      return Object.entries(categoryFindings).map(([subcat, findings]) => `
        <h4>${subcat}</h4>
        ${this.renderCategoryFindings(findings)}
      `).join('');
    }
  }

  generateExecutiveSummary() {
    const { summary, recommendations } = this.results;
    const riskLevel = this.getRiskLevel(summary.riskScore);
    
    return `
# Security Scan Executive Summary

**Scan ID:** ${this.results.scanId}  
**Date:** ${new Date(this.results.timestamp).toLocaleDateString()}  
**Risk Score:** ${summary.riskScore}/100 (${riskLevel})

## Summary

This security scan identified **${summary.total}** total findings across multiple categories:

- 🔴 **Critical:** ${summary.critical}
- 🟠 **High:** ${summary.high}  
- 🟡 **Medium:** ${summary.medium}
- 🟢 **Low:** ${summary.low}

## Risk Assessment

**Overall Risk Level:** ${riskLevel}

${this.getRiskDescription(riskLevel)}

## Key Recommendations

${recommendations.slice(0, 5).map(rec => 
  `1. **${rec.title}** - ${rec.description}`
).join('\n')}

## Next Steps

${summary.critical > 0 ? '🚨 **Immediate action required** for critical findings.' : ''}
${summary.high > 0 ? '⚠️ **Schedule remediation** for high-severity issues within 7 days.' : ''}
${summary.medium > 0 ? '📋 **Plan improvements** for medium-severity findings.' : ''}

---
*Generated by Unjucks Security Scanner*
    `.trim();
  }

  getRiskLevel(score) {
    if (score >= 50) return 'CRITICAL';
    if (score >= 30) return 'HIGH';
    if (score >= 15) return 'MEDIUM';
    if (score >= 5) return 'LOW';
    return 'MINIMAL';
  }

  getRiskDescription(riskLevel) {
    const descriptions = {
      'CRITICAL': '🚨 Critical security vulnerabilities require immediate attention. Production deployment not recommended.',
      'HIGH': '⚠️ Significant security issues detected. Address before production deployment.',
      'MEDIUM': '📋 Some security improvements needed. Review and address systematically.',
      'LOW': '✅ Minor security findings. Address during normal maintenance cycles.',
      'MINIMAL': '🎉 Excellent security posture. Continue monitoring and maintenance.'
    };
    return descriptions[riskLevel] || '';
  }

  // Helper methods
  mapEslintSeverity(severity) {
    return severity === 2 ? 'high' : 'medium';
  }

  mapSemgrepSeverity(severity) {
    const mapping = {
      'ERROR': 'high',
      'WARNING': 'medium',
      'INFO': 'low'
    };
    return mapping[severity] || 'medium';
  }

  mapCodeQLSeverity(level) {
    const mapping = {
      'error': 'high',
      'warning': 'medium',
      'note': 'low'
    };
    return mapping[level] || 'medium';
  }

  updateSummary(findings) {
    const flatFindings = this.flattenFindings(findings);
    
    for (const finding of flatFindings) {
      const severity = finding.severity || 'medium';
      if (this.results.summary.hasOwnProperty(severity)) {
        this.results.summary[severity]++;
      }
    }
  }

  flattenFindings(findings) {
    const flat = [];
    
    if (Array.isArray(findings)) {
      flat.push(...findings);
    } else if (typeof findings === 'object') {
      for (const value of Object.values(findings)) {
        flat.push(...this.flattenFindings(value));
      }
    }
    
    return flat;
  }

  getFindingsCount(findings) {
    return this.flattenFindings(findings).length;
  }

  containsSecrets(text) {
    const secretPatterns = [
      /password/i,
      /secret/i,
      /key/i,
      /token/i,
      /api.?key/i,
      /access.?key/i
    ];
    
    return secretPatterns.some(pattern => pattern.test(text));
  }

  isWeakSecret(value) {
    if (!value) return false;
    
    const weakPatterns = [
      'password',
      '123456',
      'admin',
      'secret',
      'changeme',
      'default'
    ];
    
    return weakPatterns.some(weak => 
      value.toLowerCase().includes(weak.toLowerCase()));
  }

  isSecurityUpdate(current, latest) {
    // Simple heuristic: check if major version changed
    const currentMajor = current.split('.')[0];
    const latestMajor = latest.split('.')[0];
    return currentMajor !== latestMajor;
  }

  async checkCommandExists(command) {
    try {
      await this.executeCommand(`which ${command}`, { capture: true });
      return true;
    } catch {
      return false;
    }
  }

  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async getFilesToScan() {
    const extensions = ['.js', '.ts', '.json', '.yml', '.yaml', '.env'];
    const files = [];
    
    const walk = async (dir) => {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          if (!['node_modules', '.git', 'dist', 'build'].includes(entry.name)) {
            await walk(fullPath);
          }
        } else {
          if (extensions.some(ext => entry.name.endsWith(ext))) {
            files.push(fullPath);
          }
        }
      }
    };
    
    await walk('.');
    return files;
  }

  async getKubernetesFiles() {
    const files = [];
    const k8sDirs = ['k8s', 'kubernetes', 'manifests'];
    
    for (const dir of k8sDirs) {
      if (await this.fileExists(dir)) {
        const entries = await fs.readdir(dir);
        for (const entry of entries) {
          if (entry.endsWith('.yaml') || entry.endsWith('.yml')) {
            files.push(path.join(dir, entry));
          }
        }
      }
    }
    
    return files;
  }

  async run() {
    try {
      await this.init();
      
      console.log(`\n🔒 Starting security scan with ${this.scanners.length} scanners...`);
      
      for (const scanner of this.scanners) {
        try {
          await this[scanner]();
        } catch (error) {
          console.error(`❌ Scanner ${scanner} failed:`, error.message);
        }
      }
      
      const results = await this.generateReport();
      
      console.log(`\n🎯 Security Scan Complete:`);
      console.log(`   🔴 Critical: ${results.summary.critical}`);
      console.log(`   🟠 High: ${results.summary.high}`);
      console.log(`   🟡 Medium: ${results.summary.medium}`);
      console.log(`   🟢 Low: ${results.summary.low}`);
      console.log(`   📊 Risk Score: ${results.summary.riskScore}/100`);
      
      // Exit with appropriate code
      if (results.summary.critical > 0) {
        console.log('❌ CRITICAL issues found - deployment not recommended');
        process.exit(2);
      } else if (results.summary.high > 0 && this.options.failOnHigh) {
        console.log('⚠️ HIGH severity issues found');
        process.exit(1);
      } else {
        console.log('✅ Security scan completed successfully');
        process.exit(0);
      }
      
    } catch (error) {
      console.error('💥 Security scan failed:', error);
      process.exit(3);
    }
  }
}

// CLI Interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {};
  
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--output-dir':
        options.outputDir = args[++i];
        break;
      case '--verbose':
        options.verbose = true;
        break;
      case '--no-fail-on-high':
        options.failOnHigh = false;
        break;
      case '--skip-slow-scans':
        options.skipSlowScans = true;
        break;
      case '--no-compliance':
        options.includeCompliance = false;
        break;
      case '--help':
        console.log(`
Security Scanner for Unjucks Production Environment

Usage: node scripts/security-scanner.js [options]

Options:
  --output-dir <path>     Directory for scan reports (default: ./security-reports)
  --verbose              Enable verbose logging
  --no-fail-on-high     Don't fail on high severity findings
  --skip-slow-scans     Skip time-intensive scans (Semgrep, CodeQL)
  --no-compliance       Skip compliance checks
  --help                Show this help message

Examples:
  node scripts/security-scanner.js
  node scripts/security-scanner.js --verbose --output-dir ./reports
  node scripts/security-scanner.js --skip-slow-scans --no-compliance
        `);
        process.exit(0);
        break;
    }
  }
  
  const scanner = new SecurityScanner(options);
  scanner.run();
}

module.exports = SecurityScanner;