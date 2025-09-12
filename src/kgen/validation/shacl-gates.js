/**
 * KGEN SHACL Gates - Build Blocking Validation
 * 
 * Implements SHACL gates that block builds on validation violations.
 * Provides deterministic build gates with proper exit codes for CI/CD integration.
 */

import { SHACLValidationEngine, SHACLValidationCodes } from './shacl-validation-engine.js';
import fs from 'fs-extra';
import path from 'path';
import consola from 'consola';

/**
 * SHACL Gate configuration for different build stages
 */
export const SHACLGateConfig = {
  // Pre-build validation - strict requirements
  PRE_BUILD: {
    name: 'pre-build',
    blockOnViolations: true,
    blockOnWarnings: false,
    timeout: 30000,
    required: true
  },
  
  // Artifact generation - moderate requirements  
  ARTIFACT_GENERATION: {
    name: 'artifact-generation',
    blockOnViolations: true,
    blockOnWarnings: false,
    timeout: 60000,
    required: true
  },
  
  // Post-build validation - informational
  POST_BUILD: {
    name: 'post-build',
    blockOnViolations: false,
    blockOnWarnings: false,
    timeout: 30000,
    required: false
  },
  
  // Release validation - strictest requirements
  RELEASE: {
    name: 'release',
    blockOnViolations: true,
    blockOnWarnings: true,
    timeout: 120000,
    required: true
  }
};

/**
 * SHACL validation gates for build pipeline integration
 */
export class SHACLGates {
  constructor(options = {}) {
    this.options = {
      logger: options.logger || consola,
      reportPath: options.reportPath || './shacl-validation-reports',
      shapesPath: options.shapesPath || './shapes',
      exitOnFailure: options.exitOnFailure !== false,
      ...options
    };
    
    this.validationEngine = new SHACLValidationEngine({
      logger: this.options.logger,
      ...options.engineOptions
    });
    
    this.gateResults = new Map();
  }

  /**
   * Initialize SHACL gates with shapes
   * @param {string} shapesPath - Path to SHACL shapes
   */
  async initialize(shapesPath = null) {
    const shapesLocation = shapesPath || this.options.shapesPath;
    
    try {
      await this.validationEngine.loadShapes(shapesLocation);
      this.options.logger.success(`SHACL gates initialized with shapes from ${shapesLocation}`);
    } catch (error) {
      this.options.logger.error(`Failed to initialize SHACL gates: ${error.message}`);
      throw error;
    }
  }

  /**
   * Run validation gate for specific build stage
   * @param {string} gateName - Gate name (pre-build, artifact-generation, etc.)
   * @param {string|Array} dataGraph - RDF data to validate
   * @param {Object} options - Gate options
   * @returns {Promise<Object>} Gate result with exit code
   */
  async runGate(gateName, dataGraph, options = {}) {
    const gateConfig = this._getGateConfig(gateName, options);
    const startTime = this.getDeterministicTimestamp();
    
    this.options.logger.info(`🚪 Running SHACL gate: ${gateConfig.name}`);
    
    try {
      // Run validation with timeout
      const validationReport = await this._validateWithTimeout(
        dataGraph, 
        gateConfig.timeout
      );
      
      // Determine gate result
      const gateResult = this._evaluateGateResult(validationReport, gateConfig);
      
      // Save validation report
      await this._saveValidationReport(gateConfig.name, validationReport, gateResult);
      
      // Store gate result
      this.gateResults.set(gateName, gateResult);
      
      // Log gate result
      this._logGateResult(gateResult, this.getDeterministicTimestamp() - startTime);
      
      // Handle gate failure
      if (gateResult.blocked && this.options.exitOnFailure) {
        this.options.logger.error(`🚫 SHACL gate ${gateConfig.name} BLOCKED the build`);
        process.exit(gateResult.exitCode);
      }
      
      return gateResult;
      
    } catch (error) {
      const gateResult = {
        gateName: gateConfig.name,
        blocked: true,
        passed: false,
        exitCode: SHACLValidationCodes.ERRORS,
        error: error.message,
        timestamp: this.getDeterministicDate().toISOString()
      };
      
      this.gateResults.set(gateName, gateResult);
      
      this.options.logger.error(`❌ SHACL gate ${gateConfig.name} failed: ${error.message}`);
      
      if (this.options.exitOnFailure) {
        process.exit(gateResult.exitCode);
      }
      
      return gateResult;
    }
  }

  /**
   * Run all gates in sequence
   * @param {Object} dataGraphs - Map of gate names to data graphs
   * @param {Object} options - Global gate options
   * @returns {Promise<Object>} Overall gates result
   */
  async runAllGates(dataGraphs, options = {}) {
    const gateOrder = ['PRE_BUILD', 'ARTIFACT_GENERATION', 'POST_BUILD'];
    const results = {};
    let overallPassed = true;
    let criticalFailure = false;
    
    this.options.logger.info('🚪 Running all SHACL gates in sequence');
    
    for (const gateKey of gateOrder) {
      const gateName = gateKey.toLowerCase().replace('_', '-');
      const dataGraph = dataGraphs[gateName] || dataGraphs[gateKey] || dataGraphs.default;
      
      if (!dataGraph) {
        this.options.logger.warn(`⚠️ No data graph provided for gate: ${gateName}`);
        continue;
      }
      
      try {
        const gateResult = await this.runGate(gateName, dataGraph, {
          ...options,
          exitOnFailure: false // Handle exit after all gates
        });
        
        results[gateName] = gateResult;
        
        if (gateResult.blocked) {
          overallPassed = false;
          if (SHACLGateConfig[gateKey].required) {
            criticalFailure = true;
          }
        }
        
      } catch (error) {
        this.options.logger.error(`Gate ${gateName} failed: ${error.message}`);
        overallPassed = false;
        criticalFailure = true;
      }
    }
    
    // Generate overall result
    const overallResult = {
      passed: overallPassed,
      criticalFailure,
      exitCode: criticalFailure ? SHACLValidationCodes.VIOLATIONS : 
                overallPassed ? SHACLValidationCodes.SUCCESS : SHACLValidationCodes.WARNINGS,
      gates: results,
      summary: this._generateGatesSummary(results),
      timestamp: this.getDeterministicDate().toISOString()
    };
    
    // Save overall report
    await this._saveOverallReport(overallResult);
    
    // Log final result
    this._logOverallResult(overallResult);
    
    // Exit if requested and critical failure
    if (this.options.exitOnFailure && criticalFailure) {
      process.exit(overallResult.exitCode);
    }
    
    return overallResult;
  }

  /**
   * Get gate status for specific gate
   * @param {string} gateName - Gate name
   * @returns {Object|null} Gate result or null if not run
   */
  getGateStatus(gateName) {
    return this.gateResults.get(gateName) || null;
  }

  /**
   * Clear all gate results
   */
  clearGateResults() {
    this.gateResults.clear();
  }

  /**
   * Get gate configuration
   * @private
   */
  _getGateConfig(gateName, options) {
    const configKey = gateName.toUpperCase().replace('-', '_');
    const baseConfig = SHACLGateConfig[configKey];
    
    if (!baseConfig) {
      throw new Error(`Unknown gate configuration: ${gateName}`);
    }
    
    return {
      ...baseConfig,
      ...options
    };
  }

  /**
   * Validate with timeout
   * @private
   */
  async _validateWithTimeout(dataGraph, timeout) {
    return Promise.race([
      this.validationEngine.validate(dataGraph),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error(`Validation timeout after ${timeout}ms`)), timeout)
      )
    ]);
  }

  /**
   * Evaluate gate result based on validation report
   * @private
   */
  _evaluateGateResult(validationReport, gateConfig) {
    const hasViolations = validationReport.violations.some(v => v.severity === 'Violation');
    const hasWarnings = validationReport.violations.some(v => v.severity === 'Warning');
    
    const shouldBlock = 
      (hasViolations && gateConfig.blockOnViolations) ||
      (hasWarnings && gateConfig.blockOnWarnings);
    
    const exitCode = this.validationEngine.getExitCode(validationReport);
    
    return {
      gateName: gateConfig.name,
      blocked: shouldBlock,
      passed: validationReport.conforms && !shouldBlock,
      conforms: validationReport.conforms,
      violations: validationReport.violations.length,
      violationsBySeverity: validationReport.summary.violationsBySeverity,
      exitCode: shouldBlock ? exitCode : SHACLValidationCodes.SUCCESS,
      performance: validationReport.summary.performance,
      timestamp: this.getDeterministicDate().toISOString()
    };
  }

  /**
   * Save validation report to file
   * @private
   */
  async _saveValidationReport(gateName, validationReport, gateResult) {
    try {
      await fs.ensureDir(this.options.reportPath);
      
      const reportFile = path.join(
        this.options.reportPath,
        `${gateName}-${this.getDeterministicTimestamp()}.json`
      );
      
      const fullReport = {
        gate: gateResult,
        validation: validationReport
      };
      
      await fs.writeJson(reportFile, fullReport, { spaces: 2 });
      
      // Also save latest report
      const latestFile = path.join(this.options.reportPath, `${gateName}-latest.json`);
      await fs.writeJson(latestFile, fullReport, { spaces: 2 });
      
    } catch (error) {
      this.options.logger.warn(`Failed to save validation report: ${error.message}`);
    }
  }

  /**
   * Save overall gates report
   * @private
   */
  async _saveOverallReport(overallResult) {
    try {
      await fs.ensureDir(this.options.reportPath);
      
      const reportFile = path.join(
        this.options.reportPath,
        `gates-overall-${this.getDeterministicTimestamp()}.json`
      );
      
      await fs.writeJson(reportFile, overallResult, { spaces: 2 });
      
      // Also save latest overall report
      const latestFile = path.join(this.options.reportPath, 'gates-overall-latest.json');
      await fs.writeJson(latestFile, overallResult, { spaces: 2 });
      
    } catch (error) {
      this.options.logger.warn(`Failed to save overall gates report: ${error.message}`);
    }
  }

  /**
   * Generate gates summary
   * @private
   */
  _generateGatesSummary(results) {
    const summary = {
      totalGates: Object.keys(results).length,
      passedGates: 0,
      blockedGates: 0,
      totalViolations: 0,
      totalWarnings: 0
    };
    
    for (const result of Object.values(results)) {
      if (result.passed) summary.passedGates++;
      if (result.blocked) summary.blockedGates++;
      if (result.violationsBySeverity) {
        summary.totalViolations += result.violationsBySeverity.Violation || 0;
        summary.totalWarnings += result.violationsBySeverity.Warning || 0;
      }
    }
    
    return summary;
  }

  /**
   * Log gate result
   * @private
   */
  _logGateResult(gateResult, duration) {
    const symbol = gateResult.passed ? '✅' : gateResult.blocked ? '🚫' : '⚠️';
    const status = gateResult.passed ? 'PASSED' : gateResult.blocked ? 'BLOCKED' : 'FAILED';
    
    this.options.logger.info(
      `${symbol} Gate ${gateResult.gateName}: ${status} (${duration}ms, ${gateResult.violations} violations)`
    );
    
    if (gateResult.violations > 0) {
      const { violationsBySeverity } = gateResult;
      this.options.logger.info(
        `   Violations: ${violationsBySeverity.Violation || 0}, Warnings: ${violationsBySeverity.Warning || 0}`
      );
    }
  }

  /**
   * Log overall gates result
   * @private
   */
  _logOverallResult(overallResult) {
    const symbol = overallResult.passed ? '🎉' : '❌';
    const status = overallResult.passed ? 'ALL GATES PASSED' : 'GATES FAILED';
    
    this.options.logger.info(`${symbol} ${status}`);
    this.options.logger.info(
      `   Summary: ${overallResult.summary.passedGates}/${overallResult.summary.totalGates} gates passed, ` +
      `${overallResult.summary.totalViolations} violations, ${overallResult.summary.totalWarnings} warnings`
    );
  }
}

export default SHACLGates;