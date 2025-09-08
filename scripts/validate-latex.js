#!/usr/bin/env node

/**
 * LaTeX Security & Performance Validation Script
 * Validates LaTeX templates for security vulnerabilities and performance issues
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { glob } from 'glob';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

class LaTeXValidator {
  constructor() {
    this.securityIssues = [];
    this.performanceIssues = [];
    this.validationResults = {
      security: { passed: 0, failed: 0, issues: [] },
      performance: { passed: 0, failed: 0, issues: [] },
      compliance: { passed: 0, failed: 0, issues: [] }
    };
  }

  // Security validation patterns
  getSecurityPatterns() {
    return [
      // Command injection patterns
      { pattern: /\\input\s*\{[^}]*\|\s*/, severity: 'high', message: 'Potential command injection via \\input' },
      { pattern: /\\write18\s*\{/, severity: 'critical', message: 'Shell escape detected - \\write18' },
      { pattern: /\\immediate\\write18/, severity: 'critical', message: 'Immediate shell execution detected' },
      
      // Path traversal
      { pattern: /\\input\s*\{[^}]*\.\.\//g, severity: 'high', message: 'Path traversal in \\input command' },
      { pattern: /\\include\s*\{[^}]*\.\.\//g, severity: 'high', message: 'Path traversal in \\include command' },
      
      // Unsafe file operations
      { pattern: /\\openin\s*[0-9]+\s*=\s*\|/g, severity: 'high', message: 'Unsafe file input with pipe' },
      { pattern: /\\openout\s*[0-9]+\s*=\s*\|/g, severity: 'high', message: 'Unsafe file output with pipe' },
      
      // Dynamic code execution
      { pattern: /\\csname.*\\endcsname/g, severity: 'medium', message: 'Dynamic command construction detected' },
      { pattern: /\\expandafter.*\\csname/g, severity: 'medium', message: 'Complex macro expansion pattern' },
      
      // Nunjucks template vulnerabilities
      { pattern: /\{\{\s*[^}]*\|\s*safe\s*\}\}/g, severity: 'high', message: 'Unsafe filter usage - potential XSS' },
      { pattern: /\{\{\s*[^}]*\|\s*raw\s*\}\}/g, severity: 'medium', message: 'Raw filter usage - verify sanitization' },
      
      // Environment-based attacks
      { pattern: /\\begin\{verbatim\*?\}[\s\S]*?\\write18/gi, severity: 'high', message: 'Shell command in verbatim environment' }
    ];
  }

  // Performance validation patterns
  getPerformancePatterns() {
    return [
      // Infinite loop patterns
      { pattern: /\\loop\s+(?!.*\\repeat)/g, severity: 'high', message: 'Potential infinite loop - missing \\repeat' },
      { pattern: /\\def\\.*\\.*\{.*\\.*\}/g, severity: 'medium', message: 'Recursive macro definition detected' },
      
      // Memory-intensive operations
      { pattern: /\\newcount\\[a-zA-Z@]+/g, severity: 'low', message: 'Counter allocation - monitor memory usage' },
      { pattern: /\\newdimen\\[a-zA-Z@]+/g, severity: 'low', message: 'Dimension allocation - monitor memory usage' },
      
      // Complex computations
      { pattern: /\\numexpr.*\*.*\*.*\*/g, severity: 'medium', message: 'Complex numeric expression - potential performance impact' },
      { pattern: /\\dimexpr.*\+.*\+.*\+/g, severity: 'medium', message: 'Complex dimension calculation' }
    ];
  }

  async validateFile(filePath) {
    try {
      const content = readFileSync(filePath, 'utf8');
      const fileName = filePath.replace(rootDir, '');
      
      console.log(`Validating: ${fileName}`);
      
      // Security validation
      const securityResults = this.validateSecurity(content, fileName);
      
      // Performance validation
      const performanceResults = this.validatePerformance(content, fileName);
      
      // Template compliance validation
      const complianceResults = this.validateCompliance(content, fileName);
      
      return {
        file: fileName,
        security: securityResults,
        performance: performanceResults,
        compliance: complianceResults
      };
      
    } catch (error) {
      console.error(`Error validating ${filePath}:`, error.message);
      return null;
    }
  }

  validateSecurity(content, fileName) {
    const issues = [];
    const patterns = this.getSecurityPatterns();
    
    patterns.forEach(({ pattern, severity, message }) => {
      const matches = content.match(pattern);
      if (matches) {
        matches.forEach(match => {
          const lineNumber = this.getLineNumber(content, match);
          issues.push({
            file: fileName,
            line: lineNumber,
            severity,
            message,
            pattern: match.trim(),
            type: 'security'
          });
        });
      }
    });

    // Check for unescaped user input
    const nunjucksVars = content.match(/\{\{\s*[^}|]*\s*\}\}/g);
    if (nunjucksVars) {
      nunjucksVars.forEach(variable => {
        if (!variable.includes('|')) {
          const lineNumber = this.getLineNumber(content, variable);
          issues.push({
            file: fileName,
            line: lineNumber,
            severity: 'medium',
            message: 'Unfiltered template variable - potential security risk',
            pattern: variable,
            type: 'security'
          });
        }
      });
    }

    this.validationResults.security.issues.push(...issues);
    if (issues.length === 0) {
      this.validationResults.security.passed++;
    } else {
      this.validationResults.security.failed++;
    }

    return issues;
  }

  validatePerformance(content, fileName) {
    const issues = [];
    const patterns = this.getPerformancePatterns();
    
    patterns.forEach(({ pattern, severity, message }) => {
      const matches = content.match(pattern);
      if (matches) {
        matches.forEach(match => {
          const lineNumber = this.getLineNumber(content, match);
          issues.push({
            file: fileName,
            line: lineNumber,
            severity,
            message,
            pattern: match.trim(),
            type: 'performance'
          });
        });
      }
    });

    // Check file size and complexity
    const lines = content.split('\n').length;
    const complexityScore = this.calculateComplexity(content);
    
    if (lines > 1000) {
      issues.push({
        file: fileName,
        line: 1,
        severity: 'medium',
        message: `Large template file (${lines} lines) - consider splitting`,
        pattern: 'file-size',
        type: 'performance'
      });
    }

    if (complexityScore > 50) {
      issues.push({
        file: fileName,
        line: 1,
        severity: 'medium',
        message: `High complexity score (${complexityScore}) - consider refactoring`,
        pattern: 'complexity',
        type: 'performance'
      });
    }

    this.validationResults.performance.issues.push(...issues);
    if (issues.length === 0) {
      this.validationResults.performance.passed++;
    } else {
      this.validationResults.performance.failed++;
    }

    return issues;
  }

  validateCompliance(content, fileName) {
    const issues = [];
    
    // Check for required frontmatter
    if (!content.startsWith('---')) {
      issues.push({
        file: fileName,
        line: 1,
        severity: 'medium',
        message: 'Missing frontmatter header',
        pattern: 'frontmatter',
        type: 'compliance'
      });
    }

    // Validate LaTeX document structure
    if (content.includes('\\documentclass') && !content.includes('\\begin{document}')) {
      issues.push({
        file: fileName,
        line: this.getLineNumber(content, '\\documentclass'),
        severity: 'high',
        message: 'Document class without document environment',
        pattern: 'document-structure',
        type: 'compliance'
      });
    }

    // Check for proper encoding declarations
    if (!content.includes('\\usepackage[utf8]') && !content.includes('\\usepackage[T1]')) {
      issues.push({
        file: fileName,
        line: 1,
        severity: 'low',
        message: 'Missing encoding packages for international support',
        pattern: 'encoding',
        type: 'compliance'
      });
    }

    this.validationResults.compliance.issues.push(...issues);
    if (issues.length === 0) {
      this.validationResults.compliance.passed++;
    } else {
      this.validationResults.compliance.failed++;
    }

    return issues;
  }

  calculateComplexity(content) {
    let score = 0;
    
    // Count various LaTeX constructs that add complexity
    const complexPatterns = [
      /\\newcommand/g,
      /\\renewcommand/g,
      /\\def\\/g,
      /\\if[a-zA-Z]*/g,
      /\\loop/g,
      /\\foreach/g,
      /\\begin\{[^}]+\}/g,
      /\{\{.*\}\}/g // Nunjucks variables
    ];

    complexPatterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        score += matches.length;
      }
    });

    // Add score for nesting depth
    const maxNesting = this.calculateMaxNesting(content);
    score += maxNesting * 2;

    return score;
  }

  calculateMaxNesting(content) {
    let maxDepth = 0;
    let currentDepth = 0;
    
    const lines = content.split('\n');
    lines.forEach(line => {
      const beginMatches = (line.match(/\\begin\{/g) || []).length;
      const endMatches = (line.match(/\\end\{/g) || []).length;
      
      currentDepth += beginMatches - endMatches;
      maxDepth = Math.max(maxDepth, currentDepth);
    });

    return maxDepth;
  }

  getLineNumber(content, searchString) {
    const lines = content.substring(0, content.indexOf(searchString)).split('\n');
    return lines.length;
  }

  async validateAll() {
    console.log('🔍 Starting LaTeX template validation...\n');
    
    // Find all LaTeX template files
    const latexFiles = await glob('templates/latex/**/*.{tex,njk}', { cwd: rootDir });
    const templateFiles = await glob('templates/**/*.njk', { cwd: rootDir });
    
    const allFiles = [...new Set([...latexFiles, ...templateFiles])];
    
    if (allFiles.length === 0) {
      console.log('❌ No LaTeX template files found');
      process.exit(1);
    }

    console.log(`Found ${allFiles.length} template files to validate\n`);

    const results = [];
    for (const file of allFiles) {
      const filePath = join(rootDir, file);
      const result = await this.validateFile(filePath);
      if (result) {
        results.push(result);
      }
    }

    this.generateReport(results);
    return this.validationResults;
  }

  generateReport(results) {
    console.log('\n📊 Validation Results Summary');
    console.log('═'.repeat(50));
    
    const totalIssues = this.validationResults.security.issues.length + 
                       this.validationResults.performance.issues.length + 
                       this.validationResults.compliance.issues.length;

    console.log(`Security: ${this.validationResults.security.passed} passed, ${this.validationResults.security.failed} failed`);
    console.log(`Performance: ${this.validationResults.performance.passed} passed, ${this.validationResults.performance.failed} failed`);
    console.log(`Compliance: ${this.validationResults.compliance.passed} passed, ${this.validationResults.compliance.failed} failed`);
    console.log(`Total Issues: ${totalIssues}`);

    // Group issues by severity
    const allIssues = [
      ...this.validationResults.security.issues,
      ...this.validationResults.performance.issues,
      ...this.validationResults.compliance.issues
    ];

    const issuesBySeverity = allIssues.reduce((acc, issue) => {
      acc[issue.severity] = (acc[issue.severity] || 0) + 1;
      return acc;
    }, {});

    console.log('\nIssues by Severity:');
    Object.entries(issuesBySeverity).forEach(([severity, count]) => {
      const icon = severity === 'critical' ? '🔴' : severity === 'high' ? '🟠' : severity === 'medium' ? '🟡' : '🟢';
      console.log(`  ${icon} ${severity}: ${count}`);
    });

    // Detailed issue report
    if (totalIssues > 0) {
      console.log('\n🔍 Detailed Issues:');
      console.log('─'.repeat(50));
      
      allIssues.forEach(issue => {
        const icon = issue.severity === 'critical' ? '🔴' : issue.severity === 'high' ? '🟠' : 
                    issue.severity === 'medium' ? '🟡' : '🟢';
        console.log(`${icon} ${issue.file}:${issue.line}`);
        console.log(`   ${issue.message}`);
        console.log(`   Pattern: ${issue.pattern}`);
        console.log('');
      });
    }

    // Save detailed report
    const reportPath = join(rootDir, 'tests/security-report.json');
    const reportData = {
      timestamp: new Date().toISOString(),
      summary: this.validationResults,
      issues: allIssues,
      files: results.map(r => r.file)
    };

    try {
      writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
      console.log(`📋 Detailed report saved to: ${reportPath}`);
    } catch (error) {
      console.error('❌ Failed to save report:', error.message);
    }

    // Exit with error code if critical or high severity issues found
    const criticalIssues = allIssues.filter(issue => 
      issue.severity === 'critical' || issue.severity === 'high'
    );

    if (criticalIssues.length > 0) {
      console.log(`\n❌ Validation failed: ${criticalIssues.length} critical/high severity issues found`);
      process.exit(1);
    } else {
      console.log('\n✅ Validation passed: No critical security issues found');
    }
  }
}

// Run validation if called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const validator = new LaTeXValidator();
  validator.validateAll().catch(error => {
    console.error('❌ Validation failed:', error);
    process.exit(1);
  });
}

export default LaTeXValidator;