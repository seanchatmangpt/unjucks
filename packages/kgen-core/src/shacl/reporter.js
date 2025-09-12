/**
 * SHACL Validation Reporter
 * Formats and outputs constraint violation reports
 */

import fs from 'fs/promises';
import path from 'path';

/**
 * SHACL Validation Reporter
 */
export class SHACLReporter {
  constructor() {
    this.formats = {
      json: this.formatJSON.bind(this),
      summary: this.formatSummary.bind(this)
    };
  }

  /**
   * Generate report in specified format
   */
  generateReport(validationResult, format = 'summary', options = {}) {
    if (!this.formats[format]) {
      throw new Error(`Unsupported report format: ${format}`);
    }

    return this.formats[format](validationResult, options);
  }

  /**
   * Format as JSON
   */
  formatJSON(result, options = {}) {
    const report = {
      summary: {
        conforms: result.conforms,
        timestamp: result.timestamp,
        engine: result.engine,
        totalViolations: result.violations.length
      },
      violations: result.violations,
      metadata: {
        generatedBy: 'KGEN SHACL Reporter',
        version: '1.0.0'
      }
    };

    return JSON.stringify(report, null, options.indent || 2);
  }

  /**
   * Format as summary
   */
  formatSummary(result, options = {}) {
    const violationsBySeverity = this.groupViolationsBySeverity(result.violations);
    
    const lines = [
      '🔍 SHACL Validation Report',
      '='.repeat(50),
      `Timestamp: ${result.timestamp}`,
      `Engine: ${result.engine}`,
      `Conforms: ${result.conforms ? '✅ YES' : '❌ NO'}`,
      '',
      '📊 Violation Summary:',
      `Total Violations: ${result.violations.length}`,
      `- Critical: ${violationsBySeverity.violation || 0}`,
      `- Warnings: ${violationsBySeverity.warning || 0}`,
      `- Info: ${violationsBySeverity.info || 0}`,
      ''
    ];

    if (!result.conforms && options.showTopViolations !== false) {
      lines.push('🚨 Top Violations:');
      const topViolations = result.violations.slice(0, options.maxViolations || 5);
      
      topViolations.forEach((violation, index) => {
        lines.push(`${index + 1}. ${violation.message}`);
        lines.push(`   Focus: ${violation.focusNode}`);
        lines.push(`   Path: ${violation.path}`);
        lines.push(`   Severity: ${violation.severity.toUpperCase()}`);
        lines.push('');
      });
      
      if (result.violations.length > (options.maxViolations || 5)) {
        lines.push(`... and ${result.violations.length - (options.maxViolations || 5)} more violations`);
        lines.push('');
      }
    }

    lines.push(`Status: ${result.conforms ? '✅ VALIDATION PASSED' : '❌ VALIDATION FAILED'}`);
    
    return lines.join('\n');
  }

  /**
   * Group violations by severity
   */
  groupViolationsBySeverity(violations) {
    return violations.reduce((groups, violation) => {
      const severity = violation.severity || 'violation';
      groups[severity] = (groups[severity] || 0) + 1;
      return groups;
    }, {});
  }

  /**
   * Save report to file
   */
  async saveReport(result, format, outputPath, options = {}) {
    const report = this.generateReport(result, format, options);
    
    // Ensure output directory exists
    const dir = path.dirname(outputPath);
    await fs.mkdir(dir, { recursive: true });
    
    await fs.writeFile(outputPath, report, 'utf-8');
  }

  /**
   * Generate multiple reports in different formats
   */
  async generateMultipleReports(result, basePath, formats = ['json', 'summary'], options = {}) {
    const generatedFiles = [];
    
    for (const format of formats) {
      const extension = this.getFileExtension(format);
      const outputPath = `${basePath}.${extension}`;
      
      await this.saveReport(result, format, outputPath, options);
      generatedFiles.push(outputPath);
    }
    
    return generatedFiles;
  }

  /**
   * Get file extension for format
   */
  getFileExtension(format) {
    const extensions = {
      json: 'json',
      summary: 'txt'
    };
    
    return extensions[format] || 'txt';
  }
}

/**
 * Create default reporter instance
 */
export function createSHACLReporter() {
  return new SHACLReporter();
}

export default SHACLReporter;