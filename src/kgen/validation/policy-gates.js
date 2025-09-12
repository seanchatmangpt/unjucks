/**
 * KGEN Policy Gates - Machine-Executable Governance System
 * 
 * Integrates policy:// URI resolver with SHACL gates for automated compliance.
 * Provides machine verdicts for governance rules with audit trails.
 */

import { PolicyURIResolver, PolicyURISchemes, PolicyVerdict } from './policy-resolver.js';
import { SHACLGates, SHACLGateConfig } from './shacl-gates.js';
import { SHACLValidationEngine, SHACLValidationCodes } from './shacl-validation-engine.js';
import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';
import consola from 'consola';
import { EventEmitter } from 'events';

/**
 * Policy gate configuration for different governance levels
 */
export const PolicyGateConfig = {
  // Development - lenient policies
  DEVELOPMENT: {
    name: 'development',
    strictMode: false,
    blockOnPolicyFailure: false,
    blockOnSecurityViolations: true,
    auditLevel: 'basic',
    requiredPolicies: [
      'policy://template-security/pass'
    ]
  },
  
  // Staging - moderate policies
  STAGING: {
    name: 'staging',
    strictMode: true,
    blockOnPolicyFailure: true,
    blockOnSecurityViolations: true,
    auditLevel: 'detailed',
    requiredPolicies: [
      'policy://template-security/pass',
      'policy://attestation-integrity/pass',
      'policy://shacl-validation/pass'
    ]
  },
  
  // Production - strict policies
  PRODUCTION: {
    name: 'production',
    strictMode: true,
    blockOnPolicyFailure: true,
    blockOnSecurityViolations: true,
    blockOnAnyViolations: true,
    auditLevel: 'comprehensive',
    requiredPolicies: [
      'policy://template-security/pass',
      'policy://attestation-integrity/pass',
      'policy://shacl-validation/pass',
      'policy://compliance-audit/pass',
      'policy://provenance-chain/pass'
    ]
  },
  
  // Compliance - regulatory policies
  COMPLIANCE: {
    name: 'compliance',
    strictMode: true,
    blockOnPolicyFailure: true,
    blockOnSecurityViolations: true,
    blockOnAnyViolations: true,
    auditLevel: 'forensic',
    requiredPolicies: [
      'policy://template-security/pass',
      'policy://attestation-integrity/pass',
      'policy://shacl-validation/pass',
      'policy://compliance-audit/pass',
      'policy://provenance-chain/pass',
      'policy://governance-rules/pass'
    ],
    requireCryptographicAttestation: true,
    requireImmutableAuditTrail: true
  }
};

/**
 * Policy Gates - Automated governance system with machine verdicts
 */
export class PolicyGates extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      logger: options.logger || consola,
      environment: options.environment || 'development',
      policyResolver: options.policyResolver || null,
      shaclGates: options.shaclGates || null,
      auditPath: options.auditPath || './.kgen/audit/policy-gates',
      reportsPath: options.reportsPath || './policy-gate-reports',
      exitOnFailure: options.exitOnFailure !== false,
      enableMachineVerdicts: options.enableMachineVerdicts !== false,
      enableAuditTrail: options.enableAuditTrail !== false,
      ...options
    };
    
    this.policyResolver = null;
    this.shaclGates = null;
    this.gateResults = new Map();
    this.policyVerdicts = new Map();
    this.auditTrail = [];
    this.initialized = false;
  }

  /**
   * Initialize policy gates system
   */
  async initialize() {
    try {
      this.options.logger.info('🚪 Initializing Policy Gates system...');
      
      // Initialize policy resolver
      this.policyResolver = this.options.policyResolver || new PolicyURIResolver({
        logger: this.options.logger,
        auditPath: this.options.auditPath
      });
      
      await this.policyResolver.initialize();
      
      // Initialize SHACL gates
      this.shaclGates = this.options.shaclGates || new SHACLGates({
        logger: this.options.logger,
        reportPath: path.join(this.options.reportsPath, 'shacl'),
        exitOnFailure: false // We handle exits manually
      });
      
      await this.shaclGates.initialize();
      
      // Setup audit directories
      await fs.ensureDir(this.options.auditPath);
      await fs.ensureDir(this.options.reportsPath);
      
      // Setup event listeners
      this.setupEventListeners();
      
      this.initialized = true;
      this.options.logger.success('✅ Policy Gates system initialized successfully');
      
      this.emit('initialized', {
        environment: this.options.environment,
        auditPath: this.options.auditPath,
        enableMachineVerdicts: this.options.enableMachineVerdicts
      });
      
    } catch (error) {
      this.options.logger.error('Failed to initialize Policy Gates:', error.message);
      throw new Error(`Policy Gates initialization failed: ${error.message}`);
    }
  }

  /**
   * Execute policy gate with machine verdicts
   * @param {string} gateName - Gate name or policy URI
   * @param {Object} context - Execution context
   * @param {Object} options - Gate options
   * @returns {Promise<Object>} Gate execution result with policy verdicts
   */
  async executeGate(gateName, context, options = {}) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    const startTime = performance.now();
    const gateConfig = this.getGateConfiguration();
    
    this.options.logger.info(`🚪 Executing policy gate: ${gateName}`);
    
    try {
      const gateResult = {
        gateName,
        environment: this.options.environment,
        passed: false,
        blocked: false,
        policyVerdicts: [],
        shaclResults: null,
        auditEntry: null,
        metadata: {
          executedAt: this.getDeterministicDate().toISOString(),
          executionTime: 0,
          gateConfig: gateConfig.name
        }
      };
      
      // Execute SHACL validation if data provided
      if (context.dataGraph || context.dataPath) {
        gateResult.shaclResults = await this.executeSHACLValidation(context, gateConfig);
      }
      
      // Execute required policies
      const policyResults = await this.executePolicies(gateConfig.requiredPolicies, context);
      gateResult.policyVerdicts = policyResults;
      
      // Determine overall gate result
      const gateDecision = this.evaluateGateDecision(gateResult, gateConfig);
      gateResult.passed = gateDecision.passed;
      gateResult.blocked = gateDecision.blocked;
      gateResult.decision = gateDecision;
      
      // Record execution time
      gateResult.metadata.executionTime = performance.now() - startTime;
      
      // Create audit entry
      if (this.options.enableAuditTrail) {
        gateResult.auditEntry = await this.createAuditEntry(gateResult);
      }
      
      // Store results
      this.gateResults.set(gateName, gateResult);
      
      // Save gate report
      await this.saveGateReport(gateResult);
      
      // Log results
      this.logGateResults(gateResult);
      
      // Handle gate failure
      if (gateResult.blocked && this.options.exitOnFailure) {
        this.options.logger.error(`🚫 Policy gate BLOCKED: ${gateName}`);
        this.emit('gateBlocked', gateResult);
        
        if (this.options.exitOnFailure) {
          process.exit(gateDecision.exitCode || SHACLValidationCodes.VIOLATIONS);
        }
      }
      
      this.emit('gateExecuted', gateResult);
      
      return gateResult;
      
    } catch (error) {
      const errorResult = {
        gateName,
        passed: false,
        blocked: true,
        error: error.message,
        metadata: {
          executedAt: this.getDeterministicDate().toISOString(),
          executionTime: performance.now() - startTime,
          gateConfig: gateConfig.name
        }
      };
      
      this.options.logger.error(`❌ Policy gate failed: ${gateName} - ${error.message}`);
      this.emit('gateError', errorResult);
      
      if (this.options.exitOnFailure) {
        process.exit(SHACLValidationCodes.ERRORS);
      }
      
      return errorResult;
    }
  }

  /**
   * Execute multiple policies and collect verdicts
   */
  async executePolicies(policyURIs, context) {
    const policyResults = [];
    
    for (const policyURI of policyURIs) {
      try {
        const policyResult = await this.policyResolver.resolvePolicyURI(policyURI, context);
        policyResults.push(policyResult);
        
        // Cache policy verdict
        this.policyVerdicts.set(policyURI, policyResult);
        
      } catch (error) {
        policyResults.push({
          policyURI,
          passed: false,
          actualVerdict: PolicyVerdict.ERROR,
          error: error.message
        });
      }
    }
    
    return policyResults;
  }

  /**
   * Execute SHACL validation through gates
   */
  async executeSHACLValidation(context, gateConfig) {
    const dataContent = context.dataGraph || await fs.readFile(context.dataPath, 'utf8');
    
    // Determine appropriate SHACL gate based on environment
    const shaclGateName = this.mapEnvironmentToSHACLGate(gateConfig.name);
    
    const shaclResult = await this.shaclGates.runGate(shaclGateName, dataContent, {
      exitOnFailure: false
    });
    
    return shaclResult;
  }

  /**
   * Evaluate overall gate decision based on policy verdicts and SHACL results
   */
  evaluateGateDecision(gateResult, gateConfig) {
    const decision = {
      passed: true,
      blocked: false,
      exitCode: SHACLValidationCodes.SUCCESS,
      reasons: [],
      policyFailures: [],
      shaclFailures: []
    };
    
    // Check policy verdicts
    for (const policyResult of gateResult.policyVerdicts) {
      if (!policyResult.passed) {
        decision.passed = false;
        decision.policyFailures.push(policyResult);
        decision.reasons.push(`Policy failed: ${policyResult.policyURI}`);
        
        if (gateConfig.blockOnPolicyFailure) {
          decision.blocked = true;
          decision.exitCode = SHACLValidationCodes.VIOLATIONS;
        }
      }
    }
    
    // Check SHACL results
    if (gateResult.shaclResults && !gateResult.shaclResults.passed) {
      decision.passed = false;
      decision.shaclFailures.push(gateResult.shaclResults);
      decision.reasons.push(`SHACL validation failed: ${gateResult.shaclResults.violations} violations`);
      
      if (gateConfig.blockOnAnyViolations || 
          (gateConfig.blockOnSecurityViolations && this.hasSecurityViolations(gateResult.shaclResults))) {
        decision.blocked = true;
        decision.exitCode = SHACLValidationCodes.VIOLATIONS;
      }
    }
    
    // Strict mode evaluation
    if (gateConfig.strictMode && !decision.passed) {
      decision.blocked = true;
      decision.exitCode = SHACLValidationCodes.VIOLATIONS;
    }
    
    return decision;
  }

  /**
   * Create audit entry for gate execution
   */
  async createAuditEntry(gateResult) {
    const auditEntry = {
      id: crypto.randomUUID(),
      timestamp: this.getDeterministicDate().toISOString(),
      gateName: gateResult.gateName,
      environment: this.options.environment,
      passed: gateResult.passed,
      blocked: gateResult.blocked,
      executionTime: gateResult.metadata.executionTime,
      policyVerdicts: gateResult.policyVerdicts.map(p => ({
        policyURI: p.policyURI,
        verdict: p.actualVerdict,
        passed: p.passed
      })),
      shaclSummary: gateResult.shaclResults ? {
        passed: gateResult.shaclResults.passed,
        violations: gateResult.shaclResults.violations || 0
      } : null,
      machineReadable: {
        gateName: gateResult.gateName,
        verdict: gateResult.passed ? 'PASS' : 'FAIL',
        blocked: gateResult.blocked,
        timestamp: gateResult.metadata.executedAt
      }
    };
    
    // Store in audit trail
    this.auditTrail.push(auditEntry);
    
    // Persist audit entry
    const auditFile = path.join(this.options.auditPath, `gate-${this.getDeterministicTimestamp()}.json`);
    await fs.writeJson(auditFile, auditEntry, { spaces: 2 });
    
    return auditEntry;
  }

  /**
   * Save comprehensive gate report
   */
  async saveGateReport(gateResult) {
    const reportPath = path.join(
      this.options.reportsPath,
      `gate-${gateResult.gateName}-${this.getDeterministicTimestamp()}.json`
    );
    
    const report = {
      ...gateResult,
      reportMetadata: {
        generatedAt: this.getDeterministicDate().toISOString(),
        reportVersion: '1.0.0',
        generator: 'KGEN Policy Gates',
        environment: this.options.environment
      },
      machineVerdicts: this.extractMachineVerdicts(gateResult)
    };
    
    await fs.writeJson(reportPath, report, { spaces: 2 });
    
    // Also save latest report
    const latestPath = path.join(
      this.options.reportsPath,
      `gate-${gateResult.gateName}-latest.json`
    );
    await fs.writeJson(latestPath, report, { spaces: 2 });
    
    return reportPath;
  }

  /**
   * Extract machine-readable verdicts
   */
  extractMachineVerdicts(gateResult) {
    const verdicts = {
      gate: {
        name: gateResult.gateName,
        verdict: gateResult.passed ? 'PASS' : 'FAIL',
        blocked: gateResult.blocked,
        timestamp: gateResult.metadata.executedAt
      },
      policies: gateResult.policyVerdicts.map(p => ({
        uri: p.policyURI,
        verdict: p.actualVerdict,
        passed: p.passed
      })),
      shacl: gateResult.shaclResults ? {
        verdict: gateResult.shaclResults.passed ? 'PASS' : 'FAIL',
        violations: gateResult.shaclResults.violations || 0
      } : null
    };
    
    return verdicts;
  }

  /**
   * Get gate configuration based on environment
   */
  getGateConfiguration() {
    const env = this.options.environment.toUpperCase();
    return PolicyGateConfig[env] || PolicyGateConfig.DEVELOPMENT;
  }

  /**
   * Map environment to SHACL gate type
   */
  mapEnvironmentToSHACLGate(environment) {
    const mapping = {
      'development': 'pre-build',
      'staging': 'artifact-generation',
      'production': 'release',
      'compliance': 'release'
    };
    
    return mapping[environment] || 'pre-build';
  }

  /**
   * Check if SHACL results contain security violations
   */
  hasSecurityViolations(shaclResults) {
    if (!shaclResults.violations) return false;
    
    // Check for security-related shape violations
    return shaclResults.violations.some(v => 
      v.sourceShape && (
        v.sourceShape.includes('Security') ||
        v.sourceShape.includes('Template') && v.message.toLowerCase().includes('security')
      )
    );
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    this.policyResolver.on('policyResolved', (result) => {
      this.options.logger.debug(`Policy resolved: ${result.policyURI} -> ${result.actualVerdict}`);
    });
    
    this.policyResolver.on('policyError', (result) => {
      this.options.logger.warn(`Policy error: ${result.policyURI} - ${result.error}`);
    });
  }

  /**
   * Log gate results
   */
  logGateResults(gateResult) {
    const symbol = gateResult.passed ? '✅' : gateResult.blocked ? '🚫' : '⚠️';
    const status = gateResult.passed ? 'PASSED' : gateResult.blocked ? 'BLOCKED' : 'FAILED';
    
    this.options.logger.info(
      `${symbol} Policy Gate ${gateResult.gateName}: ${status} ` +
      `(${Math.round(gateResult.metadata.executionTime)}ms)`
    );
    
    // Log policy verdicts
    for (const policy of gateResult.policyVerdicts) {
      const policySymbol = policy.passed ? '✓' : '✗';
      this.options.logger.info(
        `   ${policySymbol} ${policy.policyURI} -> ${policy.actualVerdict.toUpperCase()}`
      );
    }
    
    // Log SHACL results
    if (gateResult.shaclResults) {
      const shaclSymbol = gateResult.shaclResults.passed ? '✓' : '✗';
      this.options.logger.info(
        `   ${shaclSymbol} SHACL Validation: ${gateResult.shaclResults.violations || 0} violations`
      );
    }
  }

  /**
   * Get gate execution statistics
   */
  getStatistics() {
    const stats = {
      totalGatesExecuted: this.gateResults.size,
      passedGates: 0,
      blockedGates: 0,
      averageExecutionTime: 0,
      policyVerdictStats: this.policyResolver ? this.policyResolver.getVerdictStatistics() : null,
      environmentConfig: this.getGateConfiguration(),
      recentExecutions: Array.from(this.gateResults.entries()).slice(-5)
    };
    
    let totalExecutionTime = 0;
    
    for (const [, result] of this.gateResults) {
      if (result.passed) stats.passedGates++;
      if (result.blocked) stats.blockedGates++;
      if (result.metadata?.executionTime) {
        totalExecutionTime += result.metadata.executionTime;
      }
    }
    
    if (stats.totalGatesExecuted > 0) {
      stats.averageExecutionTime = totalExecutionTime / stats.totalGatesExecuted;
    }
    
    return stats;
  }

  /**
   * Export comprehensive audit report
   */
  async exportAuditReport(format = 'json') {
    const reportData = {
      exportedAt: this.getDeterministicDate().toISOString(),
      system: 'KGEN Policy Gates',
      environment: this.options.environment,
      statistics: this.getStatistics(),
      auditTrail: this.auditTrail,
      gateResults: Object.fromEntries(this.gateResults),
      policyVerdicts: Object.fromEntries(this.policyVerdicts)
    };
    
    const reportPath = path.join(
      this.options.auditPath,
      `comprehensive-audit-${this.getDeterministicTimestamp()}.${format}`
    );
    
    if (format === 'json') {
      await fs.writeJson(reportPath, reportData, { spaces: 2 });
    }
    
    return reportPath;
  }
}

export default PolicyGates;
