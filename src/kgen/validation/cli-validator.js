/**
 * KGEN CLI Validation Interface
 * 
 * Comprehensive validation interface that combines SHACL, policy, and SPARQL validations
 * with proper CLI integration, exit codes, and JSON Schema output validation.
 * 
 * Performance Target: ≤20ms for standard operations
 */

import { SHACLValidationEngine, SHACLValidationCodes } from './shacl-validation-engine.js';
import { SHACLGates, SHACLGateConfig } from './shacl-gates.js';
import { PolicyURIResolver, PolicyVerdict } from './policy-resolver.js';
import { SPARQLRuleEngine, SPARQLRuleResult } from './sparql-rule-engine.js';
import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import consola from 'consola';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

/**
 * CLI validation exit codes
 */
export const CLIValidationCodes = {
  SUCCESS: 0,
  WARNINGS: 0,
  VIOLATIONS: 3,
  POLICY_FAILURES: 4,
  RULE_FAILURES: 5,
  SYSTEM_ERRORS: 1,
  PERFORMANCE_ISSUES: 6
};

/**
 * JSON Schema for CLI output validation
 */
const CLI_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    timestamp: { type: 'string', format: 'date-time' },
    validationType: { type: 'string', enum: ['shacl', 'policy', 'sparql', 'comprehensive'] },
    summary: {
      type: 'object',
      properties: {
        totalViolations: { type: 'number', minimum: 0 },
        totalWarnings: { type: 'number', minimum: 0 },
        executionTime: { type: 'number', minimum: 0 },
        passed: { type: 'boolean' }
      },
      required: ['totalViolations', 'executionTime', 'passed']
    },
    results: { type: 'object' },
    exitCode: { type: 'number', minimum: 0, maximum: 10 }
  },
  required: ['success', 'timestamp', 'validationType', 'summary', 'exitCode']
};

/**
 * Comprehensive CLI validation orchestrator
 */
export class CLIValidator {
  constructor(options = {}) {
    this.options = {
      logger: options.logger || consola,
      timeout: options.timeout || 60000,
      maxPerformanceTime: options.maxPerformanceTime || 20,
      enablePerformanceWarnings: options.enablePerformanceWarnings !== false,
      outputFormat: options.outputFormat || 'json',
      exitOnFailure: options.exitOnFailure !== false,
      enableJSONValidation: options.enableJSONValidation !== false,
      ...options
    };
    
    // Initialize validation engines
    this.shaclEngine = null;
    this.shaclGates = null;
    this.policyResolver = null;
    this.sparqlEngine = null;
    
    // Initialize JSON Schema validator
    this.jsonValidator = new Ajv();
    addFormats(this.jsonValidator);
    this.outputValidator = this.jsonValidator.compile(CLI_OUTPUT_SCHEMA);
    
    this.validationStats = {
      totalValidations: 0,
      successfulValidations: 0,
      failedValidations: 0,
      averageExecutionTime: 0
    };
  }

  /**
   * Initialize all validation engines
   */
  async initialize(config = {}) {
    const startTime = performance.now();
    
    try {
      this.options.logger.info('🔧 Initializing KGEN CLI Validator...');
      
      // Initialize SHACL validation engine
      if (config.enableSHACL !== false) {
        this.shaclEngine = new SHACLValidationEngine({
          logger: this.options.logger,
          timeout: this.options.timeout
        });
        
        if (config.shapesPath) {
          await this.shaclEngine.loadShapes(config.shapesPath);
        }
      }
      
      // Initialize SHACL gates
      if (config.enableGates !== false) {
        this.shaclGates = new SHACLGates({
          logger: this.options.logger,
          shapesPath: config.shapesPath,
          exitOnFailure: false // We handle exits
        });
        
        if (config.shapesPath) {
          await this.shaclGates.initialize(config.shapesPath);
        }
      }
      
      // Initialize policy resolver
      if (config.enablePolicies !== false) {
        this.policyResolver = new PolicyURIResolver({
          logger: this.options.logger,
          shapesPath: config.shapesPath,
          rulesPath: config.rulesPath,
          auditPath: config.auditPath
        });
        
        await this.policyResolver.initialize();
      }
      
      // Initialize SPARQL rule engine
      if (config.enableSPARQL !== false) {
        this.sparqlEngine = new SPARQLRuleEngine({
          logger: this.options.logger,
          rulesPath: config.rulesPath,
          auditPath: config.auditPath
        });
        
        await this.sparqlEngine.initialize();
      }
      
      const initTime = performance.now() - startTime;
      this.options.logger.success(
        `✅ CLI Validator initialized in ${initTime.toFixed(2)}ms`
      );
      
      return {
        success: true,
        initializationTime: initTime,
        enginesInitialized: {
          shacl: !!this.shaclEngine,
          gates: !!this.shaclGates,
          policies: !!this.policyResolver,
          sparql: !!this.sparqlEngine
        }
      };
      
    } catch (error) {
      this.options.logger.error(`❌ CLI Validator initialization failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Run comprehensive validation
   * @param {Object} options - Validation options
   * @returns {Promise<Object>} Validation result with proper CLI structure
   */
  async validate(options = {}) {
    const startTime = performance.now();
    const validationId = crypto.randomUUID?.() || this.getDeterministicTimestamp().toString();
    
    const result = {
      validationId,
      success: false,
      timestamp: this.getDeterministicDate().toISOString(),
      validationType: 'comprehensive',
      summary: {
        totalViolations: 0,
        totalWarnings: 0,
        executionTime: 0,
        passed: false
      },
      results: {},
      exitCode: CLIValidationCodes.SUCCESS
    };
    
    try {
      this.validationStats.totalValidations++;
      
      // Run SHACL validation if enabled and data provided
      if (this.shaclEngine && (options.dataGraph || options.dataPath)) {
        this.options.logger.info('🔍 Running SHACL validation...');
        
        const dataContent = options.dataGraph || 
          await fs.readFile(options.dataPath, 'utf8');
          
        const shaclResult = await this.shaclEngine.validate(dataContent, {
          includeDetails: true,
          exitOnFirstViolation: options.exitOnFirstViolation
        });
        
        result.results.shacl = shaclResult;
        result.summary.totalViolations += shaclResult.violations.length;
        
        // Check for performance issues
        if (shaclResult.summary?.performance?.validationTime) {
          const timeMs = parseFloat(shaclResult.summary.performance.validationTime);
          if (timeMs > this.options.maxPerformanceTime && this.options.enablePerformanceWarnings) {
            result.summary.totalWarnings++;
            result.results.performanceWarnings = result.results.performanceWarnings || [];
            result.results.performanceWarnings.push({
              type: 'shacl_performance',
              message: `SHACL validation took ${timeMs}ms (target: ≤${this.options.maxPerformanceTime}ms)`,
              actualTime: timeMs,
              targetTime: this.options.maxPerformanceTime
            });
          }
        }
      }
      
      // Run policy validation if enabled
      if (this.policyResolver && options.policies) {
        this.options.logger.info('📋 Running policy validation...');
        
        const policyResults = [];
        for (const policyURI of options.policies) {
          const policyResult = await this.policyResolver.resolvePolicyURI(
            policyURI, 
            options.context || {}
          );
          policyResults.push(policyResult);
          
          if (!policyResult.passed) {
            result.summary.totalViolations++;
          }
        }
        
        result.results.policies = policyResults;
      }
      
      // Run SPARQL rule validation if enabled
      if (this.sparqlEngine && options.rules) {
        this.options.logger.info('⚡ Running SPARQL rule validation...');
        
        const dataContent = options.dataGraph || 
          await fs.readFile(options.dataPath, 'utf8');
          
        const sparqlResult = await this.sparqlEngine.executeBatch(
          options.rules,
          dataContent,
          options.context || {}
        );
        
        result.results.sparql = sparqlResult;
        result.summary.totalViolations += sparqlResult.failed;
        result.summary.totalWarnings += sparqlResult.errors;
      }
      
      // Run validation gates if enabled
      if (this.shaclGates && options.gates) {
        this.options.logger.info('🚪 Running validation gates...');
        
        const gateResults = await this.shaclGates.runAllGates(
          options.gates,
          { exitOnFailure: false }
        );
        
        result.results.gates = gateResults;
        if (gateResults.criticalFailure) {
          result.summary.totalViolations += gateResults.summary.totalViolations;
        }
      }
      
      // Calculate overall result
      result.summary.executionTime = performance.now() - startTime;
      result.summary.passed = result.summary.totalViolations === 0;
      result.success = result.summary.passed;
      
      // Determine exit code
      result.exitCode = this.determineExitCode(result);
      
      // Update statistics
      if (result.success) {
        this.validationStats.successfulValidations++;
      } else {
        this.validationStats.failedValidations++;
      }
      
      this.validationStats.averageExecutionTime = 
        (this.validationStats.averageExecutionTime + result.summary.executionTime) / 2;
      
      // Validate output format if enabled
      if (this.options.enableJSONValidation) {
        this.validateOutput(result);
      }
      
      // Log final result
      this.logValidationResult(result);
      
      return result;
      
    } catch (error) {
      result.success = false;
      result.exitCode = CLIValidationCodes.SYSTEM_ERRORS;
      result.error = error.message;
      result.summary.executionTime = performance.now() - startTime;
      
      this.validationStats.failedValidations++;
      
      this.options.logger.error(`❌ Validation failed: ${error.message}`);
      
      return result;
    }
  }

  /**
   * Validate SHACL data with gates integration
   */
  async validateSHACL(dataPath, shapesPath, options = {}) {
    const result = await this.validate({
      dataPath,
      validationType: 'shacl',
      ...options
    });
    
    if (this.options.exitOnFailure && !result.success) {
      process.exit(result.exitCode);
    }
    
    return result;
  }

  /**
   * Resolve policy URI and return CLI-friendly result
   */
  async validatePolicy(policyURI, context = {}, options = {}) {
    const result = await this.validate({
      policies: [policyURI],
      context,
      validationType: 'policy',
      ...options
    });
    
    if (this.options.exitOnFailure && !result.success) {
      process.exit(result.exitCode);
    }
    
    return result;
  }

  /**
   * Execute SPARQL rules and return CLI-friendly result
   */
  async validateSPARQL(dataPath, rules, context = {}, options = {}) {
    const result = await this.validate({
      dataPath,
      rules,
      context,
      validationType: 'sparql',
      ...options
    });
    
    if (this.options.exitOnFailure && !result.success) {
      process.exit(result.exitCode);
    }
    
    return result;
  }

  /**
   * Run validation gates
   */
  async validateGates(gateData, options = {}) {
    const result = await this.validate({
      gates: gateData,
      validationType: 'gates',
      ...options
    });
    
    if (this.options.exitOnFailure && !result.success) {
      process.exit(result.exitCode);
    }
    
    return result;
  }

  /**
   * Determine appropriate exit code based on validation result
   */
  determineExitCode(result) {
    if (result.error) {
      return CLIValidationCodes.SYSTEM_ERRORS;
    }
    
    if (result.summary.executionTime > this.options.maxPerformanceTime * 10) {
      return CLIValidationCodes.PERFORMANCE_ISSUES;
    }
    
    // Check for policy failures
    if (result.results.policies) {
      const policyFailures = result.results.policies.filter(p => !p.passed);
      if (policyFailures.length > 0) {
        return CLIValidationCodes.POLICY_FAILURES;
      }
    }
    
    // Check for SPARQL rule failures
    if (result.results.sparql && result.results.sparql.failed > 0) {
      return CLIValidationCodes.RULE_FAILURES;
    }
    
    // Check for SHACL violations
    if (result.summary.totalViolations > 0) {
      return CLIValidationCodes.VIOLATIONS;
    }
    
    // Check for warnings only
    if (result.summary.totalWarnings > 0) {
      return CLIValidationCodes.WARNINGS;
    }
    
    return CLIValidationCodes.SUCCESS;
  }

  /**
   * Validate CLI output against JSON Schema
   */
  validateOutput(result) {
    if (!this.outputValidator(result)) {
      const errors = this.outputValidator.errors;
      this.options.logger.warn('⚠️ CLI output validation failed:', errors);
      
      result.outputValidation = {
        valid: false,
        errors: errors.map(err => ({
          path: err.instancePath,
          message: err.message,
          value: err.data
        }))
      };
    } else {
      result.outputValidation = { valid: true };
    }
  }

  /**
   * Log validation result in appropriate format
   */
  logValidationResult(result) {
    const symbol = result.success ? '✅' : '❌';
    const status = result.success ? 'PASSED' : 'FAILED';
    
    this.options.logger.info(
      `${symbol} Validation ${status} (${result.summary.executionTime.toFixed(2)}ms)`
    );
    
    if (result.summary.totalViolations > 0) {
      this.options.logger.info(`   Violations: ${result.summary.totalViolations}`);
    }
    
    if (result.summary.totalWarnings > 0) {
      this.options.logger.info(`   Warnings: ${result.summary.totalWarnings}`);
    }
    
    this.options.logger.info(`   Exit Code: ${result.exitCode}`);
    
    // Performance warnings
    if (result.results.performanceWarnings) {
      for (const warning of result.results.performanceWarnings) {
        this.options.logger.warn(`⚠️ ${warning.message}`);
      }
    }
  }

  /**
   * Get validation statistics
   */
  getStatistics() {
    return {
      ...this.validationStats,
      successRate: this.validationStats.totalValidations > 0 ?
        (this.validationStats.successfulValidations / this.validationStats.totalValidations) * 100 : 0,
      engines: {
        shacl: !!this.shaclEngine,
        gates: !!this.shaclGates,
        policies: !!this.policyResolver,
        sparql: !!this.sparqlEngine
      }
    };
  }

  /**
   * Create Commander.js CLI interface
   */
  createCLI() {
    const program = new Command();
    
    program
      .name('kgen-validate')
      .description('KGEN Validation System CLI')
      .version('1.0.0');
    
    // SHACL validation command
    program
      .command('shacl')
      .description('Validate RDF data against SHACL shapes')
      .requiredOption('-d, --data <path>', 'Path to RDF data file')
      .requiredOption('-s, --shapes <path>', 'Path to SHACL shapes file/directory')
      .option('-o, --output <path>', 'Output report file path')
      .option('--exit-on-violation', 'Exit immediately on first violation')
      .option('--include-details', 'Include detailed shape execution info')
      .action(async (options) => {
        const result = await this.validateSHACL(options.data, options.shapes, options);
        
        if (options.output) {
          await fs.writeJson(options.output, result, { spaces: 2 });
        } else {
          console.log(JSON.stringify(result, null, 2));
        }
        
        process.exit(result.exitCode);
      });
    
    // Policy validation command
    program
      .command('policy')
      .description('Resolve policy URI and validate')
      .requiredOption('-u, --uri <uri>', 'Policy URI (e.g., policy://template-security/pass)')
      .option('-c, --context <path>', 'Context JSON file path')
      .option('-o, --output <path>', 'Output report file path')
      .action(async (options) => {
        let context = {};
        if (options.context) {
          context = await fs.readJson(options.context);
        }
        
        const result = await this.validatePolicy(options.uri, context, options);
        
        if (options.output) {
          await fs.writeJson(options.output, result, { spaces: 2 });
        } else {
          console.log(JSON.stringify(result, null, 2));
        }
        
        process.exit(result.exitCode);
      });
    
    // SPARQL rules command
    program
      .command('sparql')
      .description('Execute SPARQL validation rules')
      .requiredOption('-d, --data <path>', 'Path to RDF data file')
      .requiredOption('-r, --rules <rules>', 'Comma-separated rule names')
      .option('-c, --context <path>', 'Context JSON file path')
      .option('-o, --output <path>', 'Output report file path')
      .action(async (options) => {
        let context = {};
        if (options.context) {
          context = await fs.readJson(options.context);
        }
        
        const rules = options.rules.split(',').map(r => r.trim());
        const result = await this.validateSPARQL(options.data, rules, context, options);
        
        if (options.output) {
          await fs.writeJson(options.output, result, { spaces: 2 });
        } else {
          console.log(JSON.stringify(result, null, 2));
        }
        
        process.exit(result.exitCode);
      });
    
    // Statistics command
    program
      .command('stats')
      .description('Show validation statistics')
      .action(() => {
        const stats = this.getStatistics();
        console.log(JSON.stringify(stats, null, 2));
      });
    
    return program;
  }
}

export default CLIValidator;