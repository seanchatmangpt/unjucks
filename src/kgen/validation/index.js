/**
 * KGEN Validation System - Main Entry Point
 * 
 * Comprehensive validation system that combines SHACL validation, policy resolution,
 * SPARQL rule execution, drift detection, and CLI integration with deterministic
 * performance (≤20ms for standard operations).
 * 
 * Features:
 * - SHACL shape validation with detailed execution reports
 * - Policy:// URI resolution for machine-executable governance
 * - SPARQL rule engine for complex governance logic
 * - Semantic drift detection with auto-remediation
 * - Build gates integration (pre-build, post-build, release)
 * - JSON Schema validation for CLI outputs
 * - Non-zero exit codes on validation failures
 * - Performance monitoring and warnings
 */

// Core validation engines
export { 
  SHACLValidationEngine, 
  SHACLValidationCodes 
} from './shacl-validation-engine.js';

export { 
  PolicyURIResolver, 
  PolicyURISchemes, 
  PolicyVerdict 
} from './policy-resolver.js';

export { 
  SPARQLRuleEngine, 
  SPARQLRuleResult, 
  RulePriority 
} from './sparql-rule-engine.js';

export { 
  SemanticDriftAnalyzer, 
  DriftSeverity, 
  DriftAnalysisType 
} from './drift-analyzer.js';

// Validation gates and CLI
export { 
  SHACLGates, 
  SHACLGateConfig 
} from './shacl-gates.js';

export { 
  CLIValidator, 
  CLIValidationCodes 
} from './cli-validator.js';

// Legacy validation engine (backward compatibility) - commented out for now
// export { 
//   KGenValidationEngine, 
//   ValidationExitCodes 
// } from '../../../packages/kgen-core/src/validation/index.js';

import { CLIValidator, CLIValidationCodes } from './cli-validator.js';
import { SHACLValidationEngine } from './shacl-validation-engine.js';
import { PolicyURIResolver } from './policy-resolver.js';
import { SPARQLRuleEngine } from './sparql-rule-engine.js';
import { SemanticDriftAnalyzer } from './drift-analyzer.js';
import consola from 'consola';

/**
 * Comprehensive KGEN validation orchestrator
 * 
 * Provides a high-level interface for all validation operations with
 * automatic engine selection and performance optimization.
 */
export class KGenValidator {
  constructor(options = {}) {
    this.options = {
      logger: options.logger || consola,
      performanceTarget: options.performanceTarget || 20, // ms
      enablePerformanceWarnings: options.enablePerformanceWarnings !== false,
      autoOptimize: options.autoOptimize !== false,
      cacheEnabled: options.cacheEnabled !== false,
      ...options
    };
    
    this.cliValidator = new CLIValidator({
      logger: this.options.logger,
      maxPerformanceTime: this.options.performanceTarget,
      enablePerformanceWarnings: this.options.enablePerformanceWarnings
    });
    
    this.performanceMetrics = {
      totalValidations: 0,
      averageExecutionTime: 0,
      slowValidations: 0,
      cacheHits: 0,
      cacheMisses: 0
    };
    
    this.initialized = false;
  }

  /**
   * Initialize the complete validation system
   * @param {Object} config - Validation configuration
   * @returns {Promise<Object>} Initialization result
   */
  async initialize(config = {}) {
    const startTime = performance.now();
    
    try {
      this.options.logger.info('🚀 Initializing KGEN Validation System...');
      
      // Initialize CLI validator with all engines
      const initResult = await this.cliValidator.initialize({
        shapesPath: config.shapesPath || './src/kgen/validation/shapes',
        rulesPath: config.rulesPath || './src/kgen/validation/rules',
        policiesPath: config.policiesPath || './policies',
        auditPath: config.auditPath || './.kgen/audit',
        enableSHACL: config.enableSHACL !== false,
        enablePolicies: config.enablePolicies !== false,
        enableSPARQL: config.enableSPARQL !== false,
        enableGates: config.enableGates !== false,
        ...config
      });
      
      this.initialized = true;
      
      const initTime = performance.now() - startTime;
      
      this.options.logger.success(
        `✅ KGEN Validation System initialized in ${initTime.toFixed(2)}ms`
      );
      
      // Log enabled features
      const features = initResult.enginesInitialized;
      const enabledFeatures = Object.entries(features)
        .filter(([_, enabled]) => enabled)
        .map(([name, _]) => name.toUpperCase());
      
      this.options.logger.info(
        `📋 Enabled features: ${enabledFeatures.join(', ')}`
      );
      
      return {
        success: true,
        initializationTime: initTime,
        features: initResult.enginesInitialized,
        performanceTarget: this.options.performanceTarget
      };
      
    } catch (error) {
      this.options.logger.error(`❌ Validation system initialization failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Run comprehensive validation with automatic optimization
   * @param {Object} options - Validation options
   * @returns {Promise<Object>} Validation result with performance metrics
   */
  async validate(options = {}) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    const startTime = performance.now();
    const validationId = `validation-${this.getDeterministicTimestamp()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Optimize validation based on input size and complexity
      const optimizedOptions = this.options.autoOptimize ? 
        this.optimizeValidationOptions(options) : options;
      
      // Run validation
      const result = await this.cliValidator.validate({
        validationId,
        ...optimizedOptions
      });
      
      const executionTime = performance.now() - startTime;
      
      // Update performance metrics
      this.updatePerformanceMetrics(executionTime);
      
      // Add performance analysis to result
      result.performance = {
        executionTime,
        performanceTarget: this.options.performanceTarget,
        withinTarget: executionTime <= this.options.performanceTarget,
        cacheMetrics: {
          hits: this.performanceMetrics.cacheHits,
          misses: this.performanceMetrics.cacheMisses,
          hitRate: this.performanceMetrics.cacheHits / 
                   (this.performanceMetrics.cacheHits + this.performanceMetrics.cacheMisses) * 100 || 0
        }
      };
      
      // Performance warnings
      if (executionTime > this.options.performanceTarget && this.options.enablePerformanceWarnings) {
        result.performanceWarnings = result.performanceWarnings || [];
        result.performanceWarnings.push({
          type: 'slow_validation',
          message: `Validation took ${executionTime.toFixed(2)}ms (target: ≤${this.options.performanceTarget}ms)`,
          actualTime: executionTime,
          targetTime: this.options.performanceTarget,
          recommendations: this.generatePerformanceRecommendations(executionTime, options)
        });
      }
      
      return result;
      
    } catch (error) {
      const executionTime = performance.now() - startTime;
      this.updatePerformanceMetrics(executionTime, true);
      
      return {
        validationId,
        success: false,
        error: error.message,
        exitCode: CLIValidationCodes.SYSTEM_ERRORS,
        timestamp: this.getDeterministicDate().toISOString(),
        performance: {
          executionTime,
          error: true
        }
      };
    }
  }

  /**
   * Quick SHACL validation with performance optimization
   * @param {string} dataPath - Path to RDF data
   * @param {string} shapesPath - Path to SHACL shapes (optional)
   * @param {Object} options - Validation options
   * @returns {Promise<Object>} Validation result
   */
  async validateSHACL(dataPath, shapesPath = null, options = {}) {
    return this.validate({
      dataPath,
      shapesPath,
      validationType: 'shacl',
      enablePolicies: false,
      enableSPARQL: false,
      enableGates: false,
      ...options
    });
  }

  /**
   * Policy validation with machine verdicts
   * @param {string} policyURI - Policy URI to resolve
   * @param {Object} context - Validation context
   * @param {Object} options - Validation options
   * @returns {Promise<Object>} Policy resolution result
   */
  async validatePolicy(policyURI, context = {}, options = {}) {
    return this.validate({
      policies: [policyURI],
      context,
      validationType: 'policy',
      enableSHACL: false,
      enableSPARQL: false,
      enableGates: false,
      ...options
    });
  }

  /**
   * SPARQL rule validation
   * @param {string} dataPath - Path to RDF data
   * @param {Array} rules - Rule names to execute
   * @param {Object} context - Execution context
   * @param {Object} options - Validation options
   * @returns {Promise<Object>} Rule execution result
   */
  async validateSPARQL(dataPath, rules, context = {}, options = {}) {
    return this.validate({
      dataPath,
      rules,
      context,
      validationType: 'sparql',
      enableSHACL: false,
      enablePolicies: false,
      enableGates: false,
      ...options
    });
  }

  /**
   * Drift detection with semantic analysis
   * @param {string} artifactPath - Path to artifact
   * @param {string} expectedContent - Expected content (optional)
   * @param {Object} options - Analysis options
   * @returns {Promise<Object>} Drift analysis result
   */
  async detectDrift(artifactPath, expectedContent = null, options = {}) {
    const driftAnalyzer = new SemanticDriftAnalyzer({
      logger: this.options.logger,
      ...options
    });
    
    await driftAnalyzer.initialize();
    
    const analysis = await driftAnalyzer.analyzeDrift(artifactPath, expectedContent, options);
    
    return {
      success: !analysis.driftDetected,
      drift: analysis,
      exitCode: analysis.driftDetected ? CLIValidationCodes.VIOLATIONS : CLIValidationCodes.SUCCESS,
      timestamp: this.getDeterministicDate().toISOString(),
      validationType: 'drift'
    };
  }

  /**
   * Validation gates for build pipeline
   * @param {Object} gateData - Gate data configurations
   * @param {Object} options - Gate options
   * @returns {Promise<Object>} Gates result
   */
  async runGates(gateData, options = {}) {
    return this.validate({
      gates: gateData,
      validationType: 'gates',
      enableSHACL: true, // Gates use SHACL
      enablePolicies: false,
      enableSPARQL: false,
      ...options
    });
  }

  /**
   * Performance optimization based on validation input
   * @private
   */
  optimizeValidationOptions(options) {
    const optimized = { ...options };
    
    // Estimate complexity based on file sizes and types
    let estimatedComplexity = 'low';
    
    if (options.dataPath) {
      // Could check file size here in real implementation
      estimatedComplexity = 'medium';
    }
    
    if (options.rules && options.rules.length > 5) {
      estimatedComplexity = 'high';
    }
    
    // Apply optimizations based on complexity
    switch (estimatedComplexity) {
      case 'high':
        optimized.exitOnFirstViolation = true;
        optimized.includeDetails = false;
        break;
      
      case 'medium':
        optimized.includeDetails = false;
        break;
      
      case 'low':
      default:
        // Keep all options for comprehensive reporting
        break;
    }
    
    return optimized;
  }

  /**
   * Generate performance improvement recommendations
   * @private
   */
  generatePerformanceRecommendations(executionTime, options) {
    const recommendations = [];
    
    if (executionTime > 100) {
      recommendations.push('Consider using exitOnFirstViolation for faster failure detection');
      recommendations.push('Disable includeDetails for faster execution');
    }
    
    if (executionTime > 50) {
      recommendations.push('Enable caching for repeated validations');
      recommendations.push('Consider splitting large datasets');
    }
    
    if (options.rules && options.rules.length > 10) {
      recommendations.push('Reduce number of SPARQL rules or run them in parallel');
    }
    
    return recommendations;
  }

  /**
   * Update performance metrics
   * @private
   */
  updatePerformanceMetrics(executionTime, isError = false) {
    this.performanceMetrics.totalValidations++;
    
    if (!isError) {
      this.performanceMetrics.averageExecutionTime = 
        (this.performanceMetrics.averageExecutionTime + executionTime) / 2;
      
      if (executionTime > this.options.performanceTarget) {
        this.performanceMetrics.slowValidations++;
      }
    }
  }

  /**
   * Get comprehensive system statistics
   * @returns {Object} System performance and usage statistics
   */
  getStatistics() {
    return {
      performance: {
        ...this.performanceMetrics,
        slowValidationRate: this.performanceMetrics.totalValidations > 0 ?
          (this.performanceMetrics.slowValidations / this.performanceMetrics.totalValidations) * 100 : 0,
        performanceTarget: this.options.performanceTarget
      },
      system: {
        initialized: this.initialized,
        autoOptimize: this.options.autoOptimize,
        cacheEnabled: this.options.cacheEnabled
      },
      cli: this.cliValidator.getStatistics()
    };
  }

  /**
   * Create command-line interface
   * @returns {Command} Commander.js program
   */
  createCLI() {
    return this.cliValidator.createCLI();
  }

  /**
   * Health check for the validation system
   * @returns {Promise<Object>} Health status
   */
  async healthCheck() {
    const checks = [];
    
    try {
      // Check if system is initialized
      checks.push({
        name: 'System Initialization',
        status: this.initialized ? 'PASS' : 'FAIL',
        message: this.initialized ? 'System initialized' : 'System not initialized'
      });
      
      // Performance check
      const avgTime = this.performanceMetrics.averageExecutionTime;
      checks.push({
        name: 'Performance Target',
        status: avgTime <= this.options.performanceTarget ? 'PASS' : 'WARN',
        message: `Average execution time: ${avgTime.toFixed(2)}ms (target: ≤${this.options.performanceTarget}ms)`
      });
      
      // Cache efficiency check
      const cacheHitRate = this.performanceMetrics.cacheHits / 
        (this.performanceMetrics.cacheHits + this.performanceMetrics.cacheMisses) * 100 || 0;
      
      checks.push({
        name: 'Cache Efficiency',
        status: cacheHitRate > 50 ? 'PASS' : cacheHitRate > 0 ? 'WARN' : 'INFO',
        message: `Cache hit rate: ${cacheHitRate.toFixed(1)}%`
      });
      
      const overallStatus = checks.every(c => c.status === 'PASS') ? 'HEALTHY' :
                           checks.some(c => c.status === 'FAIL') ? 'UNHEALTHY' : 'DEGRADED';
      
      return {
        status: overallStatus,
        timestamp: this.getDeterministicDate().toISOString(),
        checks,
        statistics: this.getStatistics()
      };
      
    } catch (error) {
      return {
        status: 'ERROR',
        timestamp: this.getDeterministicDate().toISOString(),
        error: error.message,
        checks
      };
    }
  }
}

// Create default instance for convenience
export const defaultValidator = new KGenValidator();

// Convenience functions that use the default instance
export async function validateSHACL(dataPath, shapesPath, options = {}) {
  return defaultValidator.validateSHACL(dataPath, shapesPath, options);
}

export async function validatePolicy(policyURI, context = {}, options = {}) {
  return defaultValidator.validatePolicy(policyURI, context, options);
}

export async function detectDrift(artifactPath, expectedContent, options = {}) {
  return defaultValidator.detectDrift(artifactPath, expectedContent, options);
}

export async function runValidationGates(gateData, options = {}) {
  return defaultValidator.runGates(gateData, options);
}

// Export the main class as default
export default KGenValidator;