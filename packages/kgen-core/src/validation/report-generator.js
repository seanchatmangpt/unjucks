/**
 * KGEN Validation Report Generator
 * Comprehensive reporting for validation results, drift detection, and compliance
 */

import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';
import consola from 'consola';

/**
 * Report generation methods for validation results
 */
export const ReportGeneratorMethods = {
  
  /**
   * Generate comprehensive validation report
   */
  async generateReport(results) {
    try {
      const reportId = results.validationId || crypto.randomUUID();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const reportFileName = `validation-report-${reportId.slice(0, 8)}-${timestamp}`;
      
      const reportPath = path.join(
        this.config.reporting.outputPath,
        `${reportFileName}.json`
      );
      
      // Generate comprehensive report data
      const report = {
        metadata: {
          reportId,
          generatedAt: new Date().toISOString(),
          engine: 'KGEN Enhanced Validation Engine',
          version: '2.0.0',
          validationId: results.validationId,
          reportFormat: this.config.reporting.format
        },
        summary: {
          success: results.success,
          exitCode: results.exitCode,
          validationTime: results.validationTime,
          totalViolations: results.summary.totalViolations,
          totalWarnings: results.summary.totalWarnings,
          driftDetected: results.summary.driftDetected,
          fixesApplied: results.summary.fixesApplied
        },
        validation: results.validation,
        drift: results.drift,
        error: results.error,
        configuration: {
          driftDetection: {
            enabled: this.config.driftDetection.enabled,
            autoFix: this.config.driftDetection.autoFix,
            tolerance: this.config.driftDetection.tolerance,
            failMode: this.config.driftDetection.failMode
          },
          validation: {
            enableSHACL: this.config.validation.enableSHACL,
            enableOWL: this.config.validation.enableOWL,
            enableCustomRules: this.config.validation.enableCustomRules,
            strictMode: this.config.validation.strictMode
          }
        }
      };
      
      // Add statistics if enabled
      if (this.config.reporting.includeStatistics) {
        report.statistics = this.getStats();
      }
      
      // Add human-readable summary
      if (this.config.reporting.humanReadable) {
        report.humanReadable = this.generateHumanReadableSummary(results);
      }
      
      // Write JSON report
      await fs.writeJson(reportPath, report, { spaces: 2 });
      
      // Generate text report if requested
      if (this.config.reporting.humanReadable) {
        const textReportPath = reportPath.replace('.json', '.txt');
        const textReport = this.generateTextReport(report);
        await fs.writeFile(textReportPath, textReport, 'utf8');
      }
      
      consola.success(`📋 Report generated: ${reportPath}`);
      return reportPath;
      
    } catch (error) {
      consola.error(`❌ Failed to generate report: ${error.message}`);
      throw error;
    }
  },
  
  /**
   * Generate human-readable summary
   */
  generateHumanReadableSummary(results) {
    const summary = {
      overallStatus: results.success ? 'PASSED' : 'FAILED',
      keyFindings: [],
      recommendations: []
    };
    
    // Add key findings
    if (results.summary.totalViolations > 0) {
      summary.keyFindings.push(`Found ${results.summary.totalViolations} validation violations`);
    }
    
    if (results.summary.driftDetected) {
      summary.keyFindings.push('Drift detected in monitored files');
    }
    
    if (results.summary.fixesApplied > 0) {
      summary.keyFindings.push(`Applied ${results.summary.fixesApplied} automatic fixes`);
    }
    
    // Add recommendations
    if (results.summary.totalViolations > 0) {
      summary.recommendations.push('Review and fix validation violations');
      summary.recommendations.push('Run validation in strict mode for comprehensive checking');
    }
    
    if (results.summary.driftDetected && !results.summary.fixesApplied) {
      summary.recommendations.push('Consider enabling auto-fix for drift detection');
      summary.recommendations.push('Update baseline files after reviewing changes');
    }
    
    if (!results.summary.driftDetected && results.summary.totalViolations === 0) {
      summary.recommendations.push('All validations passed - consider updating test coverage');
    }
    
    return summary;
  },
  
  /**
   * Generate text report
   */
  generateTextReport(report) {
    const lines = [];
    
    lines.push('='.repeat(80));
    lines.push('KGEN VALIDATION REPORT');
    lines.push('='.repeat(80));
    lines.push('');
    
    // Header information
    lines.push(`Report ID: ${report.metadata.reportId}`);
    lines.push(`Generated: ${report.metadata.generatedAt}`);
    lines.push(`Validation ID: ${report.metadata.validationId}`);
    lines.push('');
    
    // Overall status
    const statusIcon = report.summary.success ? '✅' : '❌';
    lines.push(`${statusIcon} OVERALL STATUS: ${report.summary.success ? 'PASSED' : 'FAILED'}`);
    lines.push(`Exit Code: ${report.summary.exitCode}`);
    lines.push(`Validation Time: ${report.summary.validationTime}ms`);
    lines.push('');
    
    lines.push('='.repeat(80));
    lines.push('Report generated by KGEN Enhanced Validation Engine');
    lines.push('='.repeat(80));
    
    return lines.join('\\n');
  },
  
  /**
   * Health check for validation engine
   */
  async healthCheck() {
    return {
      status: this.status,
      validationId: this.validationId,
      activeValidations: Array.from(this.activeValidations.keys()),
      stats: this.getStats(),
      capabilities: {
        shaclValidation: true,
        owlValidation: true,
        customRules: this.customRules?.size || 0,
        n3Rules: this.n3Rules?.size || 0,
        owlRules: this.owlRules?.size || 0,
        driftDetection: this.config.driftDetection.enabled,
        autoFix: this.config.driftDetection.autoFix,
        stateConsistency: this.config.driftDetection.stateConsistency
      },
      drift: {
        baselineEntries: this.driftBaseline?.size || 0,
        detectionMode: this.config.driftDetection.failMode
      }
    };
  },
  
  /**
   * Enhanced shutdown method
   */
  async shutdown() {
    this.status = 'shutting-down';
    
    try {
      // Save drift baseline
      if (this.saveDriftBaseline) {
        await this.saveDriftBaseline();
      }
      
      // Shutdown drift engine
      if (this.driftEngine?.shutdown) {
        await this.driftEngine.shutdown();
      }
      
      // Clear caches and maps
      this.cachedValidators?.clear();
      this.customRules?.clear();
      this.n3Rules?.clear();
      this.owlRules?.clear();
      this.activeValidations?.clear();
      
      this.removeAllListeners();
      this.status = 'shutdown';
      
      consola.info('🛑 KGEN Enhanced Validation Engine shutdown complete');
      
    } catch (error) {
      consola.error(`❌ Shutdown error: ${error.message}`);
      this.status = 'error';
    }
  }
};

export default ReportGeneratorMethods;