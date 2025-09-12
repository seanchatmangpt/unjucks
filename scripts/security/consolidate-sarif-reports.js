#!/usr/bin/env node

/**
 * SARIF Report Consolidator
 * Merges multiple SARIF reports into a single consolidated report
 */

const fs = require('fs');
const path = require('path');

class SarifConsolidator {
  constructor() {
    this.consolidatedReport = {
      version: "2.1.0",
      $schema: "https://json.schemastore.org/sarif-2.1.0.json",
      runs: []
    };
  }

  async consolidateReports() {
    console.log('📊 Consolidating SARIF security reports...');

    const sarifFiles = this.findSarifFiles();
    
    for (const file of sarifFiles) {
      try {
        await this.processSarifFile(file);
      } catch (error) {
        console.warn(`⚠️  Failed to process SARIF file ${file}: ${error.message}`);
      }
    }

    // Add summary information
    this.addConsolidationSummary();

    // Write consolidated report
    fs.writeFileSync('consolidated-security-report.sarif', JSON.stringify(this.consolidatedReport, null, 2));
    
    console.log(`✅ Consolidated ${sarifFiles.length} SARIF reports`);
    console.log(`📈 Total findings: ${this.getTotalFindings()}`);
  }

  findSarifFiles() {
    const sarifFiles = [];
    const patterns = [
      'eslint-security-results.sarif',
      'semgrep.sarif',
      'snyk-results.sarif',
      'reports/dependency-check-report.sarif',
      '**/security-scan-results/**/*.sarif',
      '**/unjucks-security-results/**/*.sarif'
    ];

    // Search for SARIF files
    const searchDirs = ['.', 'reports', 'security-scan-results', 'unjucks-security-results'];
    
    for (const dir of searchDirs) {
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir, { recursive: true });
        for (const file of files) {
          if (typeof file === 'string' && file.endsWith('.sarif')) {
            const fullPath = path.join(dir, file);
            if (fs.existsSync(fullPath)) {
              sarifFiles.push(fullPath);
            }
          }
        }
      }
    }

    // Also check specific file patterns
    for (const pattern of patterns) {
      if (!pattern.includes('*') && fs.existsSync(pattern)) {
        sarifFiles.push(pattern);
      }
    }

    return [...new Set(sarifFiles)]; // Remove duplicates
  }

  async processSarifFile(filePath) {
    console.log(`📄 Processing SARIF file: ${filePath}`);
    
    const sarifContent = fs.readFileSync(filePath, 'utf8');
    const sarifReport = JSON.parse(sarifContent);

    // Validate SARIF structure
    if (!sarifReport.runs || !Array.isArray(sarifReport.runs)) {
      throw new Error('Invalid SARIF format: missing or invalid runs array');
    }

    // Process each run in the SARIF file
    for (const run of sarifReport.runs) {
      // Enhance run with source information
      const enhancedRun = {
        ...run,
        tool: {
          ...run.tool,
          driver: {
            ...run.tool?.driver,
            // Add source file information
            properties: {
              ...run.tool?.driver?.properties,
              sourceFile: filePath,
              processedAt: this.getDeterministicDate().toISOString()
            }
          }
        }
      };

      // Process results to add security classifications
      if (enhancedRun.results) {
        enhancedRun.results = enhancedRun.results.map(result => this.enhanceResult(result, filePath));
      }

      this.consolidatedReport.runs.push(enhancedRun);
    }
  }

  enhanceResult(result, sourceFile) {
    const enhanced = { ...result };

    // Add security classifications
    enhanced.properties = {
      ...enhanced.properties,
      sourceScanner: this.getSourceScanner(sourceFile),
      securityCategory: this.classifySecurityIssue(result),
      severity: this.normalizeSeverity(result),
      cweId: this.extractCweId(result),
      owaspCategory: this.getOwaspCategory(result)
    };

    // Add remediation guidance
    if (this.hasSecurityImplications(result)) {
      enhanced.fixes = enhanced.fixes || [];
      enhanced.fixes.push({
        description: {
          text: this.getRemediationGuidance(result)
        }
      });
    }

    return enhanced;
  }

  getSourceScanner(filePath) {
    if (filePath.includes('eslint')) return 'ESLint Security';
    if (filePath.includes('semgrep')) return 'Semgrep';
    if (filePath.includes('snyk')) return 'Snyk';
    if (filePath.includes('dependency-check')) return 'OWASP Dependency Check';
    if (filePath.includes('codeql')) return 'CodeQL';
    return 'Unknown';
  }

  classifySecurityIssue(result) {
    const ruleId = result.ruleId || '';
    const message = result.message?.text || '';

    // Template injection detection
    if (ruleId.includes('template') || message.includes('template injection')) {
      return 'Template Injection';
    }

    // Path traversal detection
    if (ruleId.includes('path-traversal') || message.includes('path traversal')) {
      return 'Path Traversal';
    }

    // Input validation
    if (ruleId.includes('validation') || message.includes('input validation')) {
      return 'Input Validation';
    }

    // Dependency vulnerabilities
    if (ruleId.includes('dependency') || message.includes('vulnerable dependency')) {
      return 'Dependency Vulnerability';
    }

    // Secret detection
    if (ruleId.includes('secret') || message.includes('exposed secret')) {
      return 'Secret Exposure';
    }

    // XSS
    if (ruleId.includes('xss') || message.includes('cross-site scripting')) {
      return 'Cross-Site Scripting';
    }

    // Injection attacks
    if (ruleId.includes('injection') || message.includes('injection')) {
      return 'Injection Attack';
    }

    return 'General Security';
  }

  normalizeSeverity(result) {
    const level = result.level || 'info';
    const properties = result.properties || {};
    
    // Map various severity formats to standard levels
    const severityMappings = {
      'critical': 'error',
      'high': 'error',
      'medium': 'warning',
      'moderate': 'warning',
      'low': 'note',
      'info': 'note',
      'error': 'error',
      'warning': 'warning',
      'note': 'note'
    };

    // Check various places severity might be stored
    const severity = properties.severity || properties.impact || level;
    return severityMappings[severity.toLowerCase()] || level;
  }

  extractCweId(result) {
    const helpUri = result.helpUri || '';
    const message = result.message?.text || '';
    const ruleId = result.ruleId || '';

    // Extract CWE ID from various sources
    const cwePattern = /CWE[-_]?(\d+)/i;
    
    let match = helpUri.match(cwePattern);
    if (match) return `CWE-${match[1]}`;

    match = message.match(cwePattern);
    if (match) return `CWE-${match[1]}`;

    match = ruleId.match(cwePattern);
    if (match) return `CWE-${match[1]}`;

    // Map common security issues to CWE IDs
    const cweMapping = {
      'template-injection': 'CWE-94',
      'path-traversal': 'CWE-22',
      'xss': 'CWE-79',
      'sql-injection': 'CWE-89',
      'command-injection': 'CWE-78',
      'secret-exposure': 'CWE-200',
      'weak-crypto': 'CWE-327'
    };

    const category = this.classifySecurityIssue(result).toLowerCase().replace(/\s+/g, '-');
    return cweMapping[category] || null;
  }

  getOwaspCategory(result) {
    const category = this.classifySecurityIssue(result);
    
    const owaspMapping = {
      'Template Injection': 'A03:2021 – Injection',
      'Path Traversal': 'A01:2021 – Broken Access Control',
      'Input Validation': 'A03:2021 – Injection',
      'Dependency Vulnerability': 'A06:2021 – Vulnerable and Outdated Components',
      'Secret Exposure': 'A02:2021 – Cryptographic Failures',
      'Cross-Site Scripting': 'A03:2021 – Injection',
      'Injection Attack': 'A03:2021 – Injection'
    };

    return owaspMapping[category] || 'A10:2021 – Server-Side Request Forgery';
  }

  hasSecurityImplications(result) {
    const securityKeywords = [
      'security', 'vulnerability', 'exploit', 'attack', 'injection',
      'traversal', 'xss', 'csrf', 'secret', 'password', 'token'
    ];

    const text = `${result.ruleId || ''} ${result.message?.text || ''}`.toLowerCase();
    return securityKeywords.some(keyword => text.includes(keyword));
  }

  getRemediationGuidance(result) {
    const category = this.classifySecurityIssue(result);
    
    const guidance = {
      'Template Injection': 'Sanitize user input and use safe template rendering with restricted context.',
      'Path Traversal': 'Validate and sanitize file paths. Use allowlists for permitted paths.',
      'Input Validation': 'Implement comprehensive input validation and sanitization.',
      'Dependency Vulnerability': 'Update vulnerable dependencies to latest secure versions.',
      'Secret Exposure': 'Remove secrets from code and use secure secret management.',
      'Cross-Site Scripting': 'Encode output and implement Content Security Policy.',
      'Injection Attack': 'Use parameterized queries and input validation.'
    };

    return guidance[category] || 'Review and address the security issue according to best practices.';
  }

  addConsolidationSummary() {
    const summary = {
      version: this.consolidatedReport.version,
      runs: [{
        tool: {
          driver: {
            name: "Unjucks Security Consolidator",
            version: "1.0.0",
            informationUri: "https://github.com/unjucks/unjucks",
            properties: {
              consolidatedAt: this.getDeterministicDate().toISOString(),
              totalRuns: this.consolidatedReport.runs.length,
              totalFindings: this.getTotalFindings(),
              severityBreakdown: this.getSeverityBreakdown(),
              categoryBreakdown: this.getCategoryBreakdown()
            }
          }
        },
        results: []
      }]
    };

    // Prepend summary run
    this.consolidatedReport.runs.unshift(summary.runs[0]);
  }

  getTotalFindings() {
    return this.consolidatedReport.runs.reduce((total, run) => {
      return total + (run.results?.length || 0);
    }, 0);
  }

  getSeverityBreakdown() {
    const breakdown = { error: 0, warning: 0, note: 0 };
    
    this.consolidatedReport.runs.forEach(run => {
      if (run.results) {
        run.results.forEach(result => {
          const severity = this.normalizeSeverity(result);
          breakdown[severity] = (breakdown[severity] || 0) + 1;
        });
      }
    });

    return breakdown;
  }

  getCategoryBreakdown() {
    const breakdown = {};
    
    this.consolidatedReport.runs.forEach(run => {
      if (run.results) {
        run.results.forEach(result => {
          const category = this.classifySecurityIssue(result);
          breakdown[category] = (breakdown[category] || 0) + 1;
        });
      }
    });

    return breakdown;
  }
}

// Run the consolidator
if (require.main === module) {
  const consolidator = new SarifConsolidator();
  consolidator.consolidateReports().catch(error => {
    console.error('Failed to consolidate SARIF reports:', error);
    process.exit(1);
  });
}

module.exports = SarifConsolidator;