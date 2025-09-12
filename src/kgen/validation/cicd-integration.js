/**
 * KGEN CI/CD Pipeline Integration - Automated Governance Enforcement
 * 
 * Provides seamless integration with CI/CD pipelines for automated governance enforcement.
 * Implements exit codes, status reports, and pipeline controls based on governance outcomes.
 * 
 * Dark-Matter Principles:
 * - Automated blocking prevents human override of governance failures
 * - Machine-readable outputs enable pipeline automation
 * - Audit trails provide complete compliance evidence
 */

import { GovernanceOrchestrator, GovernanceStrategy, GovernanceContext } from './governance-orchestrator.js';
import fs from 'fs-extra';
import path from 'path';
import consola from 'consola';
import { EventEmitter } from 'events';

/**
 * CI/CD exit codes for governance outcomes
 */
export const CICDExitCodes = {
  SUCCESS: 0,           // All governance checks passed
  WARNING: 2,           // Non-blocking issues found
  VIOLATION: 3,         // Governance violations detected
  ERROR: 1,            // System error during execution
  BLOCKED: 4,          // Critical failure - pipeline blocked
  TIMEOUT: 124         // Execution timeout
};

/**
 * Pipeline integration modes
 */
export const PipelineMode = {
  GATE: 'gate',                    // Block pipeline on failures
  ADVISORY: 'advisory',            // Report only, don't block
  SELECTIVE: 'selective',          // Block only on critical failures
  CONDITIONAL: 'conditional'       // Block based on conditions
};

/**
 * CI/CD Pipeline Integration for Governance Enforcement
 */
export class CICDIntegration extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      // Pipeline configuration
      mode: options.mode || PipelineMode.GATE,
      context: options.context || this.detectPipelineContext(),
      strategy: options.strategy || GovernanceStrategy.STAGED,
      
      // Blocking configuration
      blockOnViolations: options.blockOnViolations !== false,
      blockOnSecurityFailures: options.blockOnSecurityFailures !== false,
      blockOnCriticalRules: options.blockOnCriticalRules !== false,
      
      // Reporting configuration
      reportsPath: options.reportsPath || './governance-reports',
      artifactsPath: options.artifactsPath || './pipeline-artifacts',
      enableJUnitOutput: options.enableJUnitOutput !== false,
      enableSarifOutput: options.enableSarifOutput !== false,
      
      // Performance settings
      timeout: options.timeout || 600000, // 10 minutes
      maxRetries: options.maxRetries || 2,
      
      // Integration settings
      enableSlackNotifications: options.enableSlackNotifications || false,
      enableGitHubActions: options.enableGitHubActions || false,
      enableAzureDevOps: options.enableAzureDevOps || false,
      
      logger: options.logger || consola,
      ...options
    };
    
    this.orchestrator = null;
    this.pipelineContext = {};
    this.executionResults = null;
  }

  /**
   * Initialize CI/CD integration with governance orchestrator
   */
  async initialize() {
    try {
      this.options.logger.info('🔧 Initializing CI/CD Governance Integration...');
      
      // Detect pipeline context
      this.pipelineContext = await this.detectPipelineEnvironment();
      
      // Initialize governance orchestrator
      this.orchestrator = new GovernanceOrchestrator({
        context: this.options.context,
        strategy: this.options.strategy,
        timeout: this.options.timeout,
        auditPath: path.join(this.options.artifactsPath, 'governance-audit'),
        reportsPath: this.options.reportsPath,
        enableCICDIntegration: true,
        exitOnCriticalFailure: false, // We handle exits ourselves
        logger: this.options.logger
      });
      
      await this.orchestrator.initialize();
      
      // Setup pipeline-specific configurations
      await this.setupPipelineConfiguration();
      
      this.options.logger.success('✅ CI/CD Governance Integration initialized');
      
      this.emit('initialized', {
        context: this.options.context,
        mode: this.options.mode,
        pipeline: this.pipelineContext
      });
      
    } catch (error) {
      this.options.logger.error('Failed to initialize CI/CD integration:', error.message);
      throw error;
    }
  }

  /**
   * Execute governance validation for CI/CD pipeline
   * @param {Object} context - Pipeline context (artifacts, branch, commit, etc.)
   * @param {Object} options - Execution options
   * @returns {Promise<Object>} Pipeline execution results
   */
  async executeGovernance(context = {}, options = {}) {
    const startTime = performance.now();
    
    try {
      this.options.logger.info('🚀 Executing governance validation in CI/CD pipeline');
      
      // Prepare execution context
      const execContext = {
        ...context,
        pipeline: this.pipelineContext,
        mode: this.options.mode,
        branch: context.branch || process.env.GITHUB_REF || process.env.BUILD_SOURCEBRANCHNAME || 'unknown',
        commit: context.commit || process.env.GITHUB_SHA || process.env.BUILD_SOURCEVERSION || 'unknown',
        pullRequest: context.pullRequest || process.env.GITHUB_EVENT_NAME === 'pull_request',
        environment: this.options.context
      };
      
      // Determine workflow based on context
      const workflowId = this.determineWorkflow(execContext);
      
      // Execute governance workflow
      const results = await this.orchestrator.executeWorkflow(workflowId, execContext, options);
      
      this.executionResults = results;
      
      // Generate CI/CD specific outputs
      await this.generateCICDOutputs(results, execContext);
      
      // Handle notifications
      await this.handleNotifications(results, execContext);
      
      // Determine exit strategy
      const exitDecision = this.determineExitStrategy(results);
      
      this.options.logger.info(
        `🏁 Governance execution completed: ${exitDecision.action} ` +
        `(${(performance.now() - startTime).toFixed(2)}ms)`
      );
      
      // Return results for programmatic use
      return {
        ...results,
        cicd: {
          exitCode: exitDecision.exitCode,
          shouldBlock: exitDecision.block,
          action: exitDecision.action,
          message: exitDecision.message
        },
        pipelineContext: execContext
      };
      
    } catch (error) {
      const errorResult = {
        passed: false,
        error: error.message,
        cicd: {
          exitCode: CICDExitCodes.ERROR,
          shouldBlock: true,
          action: 'error',
          message: `Governance execution failed: ${error.message}`
        }
      };
      
      this.options.logger.error('❌ CI/CD governance execution failed:', error.message);
      
      // Generate error outputs
      await this.generateErrorOutputs(errorResult);
      
      return errorResult;
    }
  }

  /**
   * Execute and exit with appropriate code (for CLI usage)
   * @param {Object} context - Pipeline context
   * @param {Object} options - Execution options
   */
  async executeAndExit(context = {}, options = {}) {
    const results = await this.executeGovernance(context, options);
    process.exit(results.cicd.exitCode);
  }

  /**
   * Detect pipeline environment and context
   */
  async detectPipelineEnvironment() {
    const context = {
      provider: 'unknown',
      detected: false,
      capabilities: []
    };
    
    // GitHub Actions
    if (process.env.GITHUB_ACTIONS) {
      context.provider = 'github-actions';
      context.detected = true;
      context.capabilities = ['annotations', 'job-summaries', 'artifacts'];
      context.repository = process.env.GITHUB_REPOSITORY;
      context.runId = process.env.GITHUB_RUN_ID;
      context.actor = process.env.GITHUB_ACTOR;
    }
    
    // Azure DevOps
    else if (process.env.AZURE_HTTP_USER_AGENT) {
      context.provider = 'azure-devops';
      context.detected = true;
      context.capabilities = ['logging-commands', 'artifacts'];
      context.buildId = process.env.BUILD_BUILDID;
      context.project = process.env.SYSTEM_TEAMPROJECT;
    }
    
    // GitLab CI
    else if (process.env.GITLAB_CI) {
      context.provider = 'gitlab-ci';
      context.detected = true;
      context.capabilities = ['artifacts', 'reports'];
      context.projectId = process.env.CI_PROJECT_ID;
      context.pipelineId = process.env.CI_PIPELINE_ID;
    }
    
    // Jenkins
    else if (process.env.JENKINS_URL) {
      context.provider = 'jenkins';
      context.detected = true;
      context.capabilities = ['artifacts'];
      context.buildNumber = process.env.BUILD_NUMBER;
      context.jobName = process.env.JOB_NAME;
    }
    
    return context;
  }

  /**
   * Detect pipeline context (development, staging, production)
   */
  detectPipelineContext() {
    // Check environment variables
    if (process.env.NODE_ENV) {
      switch (process.env.NODE_ENV.toLowerCase()) {
        case 'production': return GovernanceContext.PRODUCTION;
        case 'staging': return GovernanceContext.STAGING;
        case 'test': return GovernanceContext.TESTING;
        default: return GovernanceContext.DEVELOPMENT;
      }
    }
    
    // Check branch patterns
    const branch = process.env.GITHUB_REF || process.env.BUILD_SOURCEBRANCHNAME || '';
    if (branch.includes('main') || branch.includes('master')) {
      return GovernanceContext.PRODUCTION;
    } else if (branch.includes('staging') || branch.includes('release')) {
      return GovernanceContext.STAGING;
    }
    
    return GovernanceContext.DEVELOPMENT;
  }

  /**
   * Setup pipeline-specific configuration
   */
  async setupPipelineConfiguration() {
    // Ensure output directories exist
    await fs.ensureDir(this.options.reportsPath);
    await fs.ensureDir(this.options.artifactsPath);
    
    // Setup GitHub Actions integration
    if (this.options.enableGitHubActions && this.pipelineContext.provider === 'github-actions') {
      this.setupGitHubActions();
    }
    
    // Setup Azure DevOps integration
    if (this.options.enableAzureDevOps && this.pipelineContext.provider === 'azure-devops') {
      this.setupAzureDevOps();
    }
  }

  /**
   * Determine workflow based on pipeline context
   */
  determineWorkflow(context) {
    // Emergency context
    if (context.emergency || context.branch?.includes('hotfix')) {
      return GovernanceContext.EMERGENCY;
    }
    
    // Compliance audit context
    if (context.complianceAudit || context.branch?.includes('audit')) {
      return GovernanceContext.COMPLIANCE_AUDIT;
    }
    
    // Use detected context
    return this.options.context;
  }

  /**
   * Generate CI/CD specific outputs
   */
  async generateCICDOutputs(results, context) {
    const outputs = [];
    
    // Generate JUnit XML for test reporting integration
    if (this.options.enableJUnitOutput) {
      const junitPath = await this.generateJUnitOutput(results);
      outputs.push({ type: 'junit', path: junitPath });
    }
    
    // Generate SARIF for security findings
    if (this.options.enableSarifOutput) {
      const sarifPath = await this.generateSarifOutput(results);
      outputs.push({ type: 'sarif', path: sarifPath });
    }
    
    // Generate pipeline status file
    const statusPath = await this.generateStatusOutput(results, context);
    outputs.push({ type: 'status', path: statusPath });
    
    // Generate GitHub Actions annotations
    if (this.pipelineContext.provider === 'github-actions') {
      await this.generateGitHubAnnotations(results);
    }
    
    // Generate Azure DevOps logging commands
    if (this.pipelineContext.provider === 'azure-devops') {
      await this.generateAzureLoggingCommands(results);
    }
    
    this.options.logger.debug(`📄 Generated ${outputs.length} CI/CD output files`);
    
    return outputs;
  }

  /**
   * Generate JUnit XML output for test reporting
   */
  async generateJUnitOutput(results) {
    const testCases = results.gateResults.map(gate => {
      const testCase = {
        name: gate.gateId,
        classname: `governance.${gate.type}`,
        time: (gate.executionTime / 1000).toFixed(3), // Convert to seconds
        passed: gate.passed
      };
      
      if (!gate.passed) {
        testCase.failure = {
          message: gate.error || 'Governance gate failed',
          type: gate.blocked ? 'BlockingFailure' : 'Warning',
          details: JSON.stringify(gate.details, null, 2)
        };
      }
      
      return testCase;
    });
    
    const junitXml = this.generateJUnitXML({
      name: 'KGEN Governance',
      tests: testCases.length,
      failures: testCases.filter(t => !t.passed).length,
      time: (results.executionTime / 1000).toFixed(3),
      testCases
    });
    
    const junitPath = path.join(this.options.reportsPath, 'governance-junit.xml');
    await fs.writeFile(junitPath, junitXml);
    
    return junitPath;
  }

  /**
   * Generate SARIF output for security findings
   */
  async generateSarifOutput(results) {
    const runs = [{
      tool: {
        driver: {
          name: 'KGEN Governance',
          version: '1.0.0',
          informationUri: 'https://kgen.io/governance'
        }
      },
      results: []
    }];
    
    // Convert gate results to SARIF findings
    for (const gate of results.gateResults) {
      if (!gate.passed && gate.type === 'shacl' && gate.violations > 0) {
        // Add SHACL violations as security findings
        const finding = {
          ruleId: `governance.${gate.gateId}`,
          level: gate.blocked ? 'error' : 'warning',
          message: {
            text: `Governance gate ${gate.gateId} failed with ${gate.violations} violations`
          },
          locations: [{
            physicalLocation: {
              artifactLocation: {
                uri: 'artifact'
              }
            }
          }]
        };
        
        runs[0].results.push(finding);
      }
    }
    
    const sarif = {
      version: '2.1.0',
      $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
      runs
    };
    
    const sarifPath = path.join(this.options.reportsPath, 'governance-sarif.json');
    await fs.writeJson(sarifPath, sarif, { spaces: 2 });
    
    return sarifPath;
  }

  /**
   * Generate pipeline status output
   */
  async generateStatusOutput(results, context) {
    const status = {
      timestamp: this.getDeterministicDate().toISOString(),
      pipeline: {
        provider: this.pipelineContext.provider,
        context: this.options.context,
        mode: this.options.mode,
        branch: context.branch,
        commit: context.commit
      },
      governance: {
        passed: results.passed,
        blocked: results.blocked,
        executionTime: results.executionTime,
        summary: {
          totalGates: results.gateResults.length,
          passedGates: results.gateResults.filter(g => g.passed).length,
          failedGates: results.gateResults.filter(g => !g.passed).length,
          blockedGates: results.gateResults.filter(g => g.blocked).length
        }
      },
      compliance: {
        securityCompliant: results.gateResults
          .filter(g => g.gateId.includes('security'))
          .every(g => g.passed),
        overallScore: (results.gateResults.filter(g => g.passed).length / 
                      results.gateResults.length * 100).toFixed(2) + '%'
      },
      cicd: this.determineExitStrategy(results)
    };
    
    const statusPath = path.join(this.options.reportsPath, 'governance-status.json');
    await fs.writeJson(statusPath, status, { spaces: 2 });
    
    // Also set environment variables for pipeline consumption
    this.setEnvironmentVariables(status);
    
    return statusPath;
  }

  /**
   * Generate GitHub Actions annotations
   */
  async generateGitHubAnnotations(results) {
    if (!process.env.GITHUB_ACTIONS) return;
    
    for (const gate of results.gateResults) {
      if (!gate.passed) {
        const level = gate.blocked ? 'error' : 'warning';
        const message = gate.error || `Governance gate ${gate.gateId} failed`;
        
        console.log(`::${level}::${message}`);
      }
    }
    
    // Create job summary
    const summary = this.generateGitHubJobSummary(results);
    if (process.env.GITHUB_STEP_SUMMARY) {
      await fs.writeFile(process.env.GITHUB_STEP_SUMMARY, summary);
    }
  }

  /**
   * Generate GitHub job summary markdown
   */
  generateGitHubJobSummary(results) {
    const passed = results.gateResults.filter(g => g.passed).length;
    const total = results.gateResults.length;
    const status = results.passed ? '✅ PASSED' : results.blocked ? '🚫 BLOCKED' : '⚠️ FAILED';
    
    return `
# KGEN Governance Report

## Overall Status: ${status}

**Gates:** ${passed}/${total} passed  
**Execution Time:** ${results.executionTime.toFixed(2)}ms  
**Context:** ${this.options.context}

## Gate Results

| Gate | Type | Status | Time |
|------|------|--------|------|
${results.gateResults.map(gate => 
  `| ${gate.gateId} | ${gate.type} | ${gate.passed ? '✅' : gate.blocked ? '🚫' : '⚠️'} | ${gate.executionTime?.toFixed(2) || 'N/A'}ms |`
).join('\n')}

${!results.passed ? `
## Issues Found

${results.gateResults.filter(g => !g.passed).map(gate => 
  `- **${gate.gateId}**: ${gate.error || 'Gate validation failed'}`
).join('\n')}
` : ''}

---
*Generated by KGEN Governance Orchestrator*
    `.trim();
  }

  /**
   * Generate Azure DevOps logging commands
   */
  async generateAzureLoggingCommands(results) {
    if (!process.env.AZURE_HTTP_USER_AGENT) return;
    
    for (const gate of results.gateResults) {
      if (!gate.passed) {
        const level = gate.blocked ? 'error' : 'warning';
        const message = gate.error || `Governance gate ${gate.gateId} failed`;
        
        console.log(`##vso[task.logissue type=${level}]${message}`);
      }
    }
    
    // Set pipeline variables
    console.log(`##vso[task.setvariable variable=GOVERNANCE_PASSED]${results.passed}`);
    console.log(`##vso[task.setvariable variable=GOVERNANCE_BLOCKED]${results.blocked}`);
  }

  /**
   * Determine exit strategy based on results and configuration
   */
  determineExitStrategy(results) {
    const decision = {
      exitCode: CICDExitCodes.SUCCESS,
      block: false,
      action: 'continue',
      message: 'All governance checks passed'
    };
    
    if (results.error) {
      decision.exitCode = CICDExitCodes.ERROR;
      decision.block = true;
      decision.action = 'error';
      decision.message = `Governance execution error: ${results.error}`;
      return decision;
    }
    
    const hasViolations = results.gateResults.some(g => !g.passed);
    const hasBlockingFailures = results.gateResults.some(g => g.blocked);
    const hasSecurityFailures = results.gateResults.some(g => 
      !g.passed && g.gateId.includes('security')
    );
    const hasCriticalFailures = results.gateResults.some(g => 
      !g.passed && g.ruleResults?.some(r => r.rule?.priority === 'critical')
    );
    
    switch (this.options.mode) {
      case PipelineMode.GATE:
        if (hasBlockingFailures) {
          decision.exitCode = CICDExitCodes.BLOCKED;
          decision.block = true;
          decision.action = 'block';
          decision.message = 'Governance gates blocked pipeline execution';
        } else if (hasViolations) {
          decision.exitCode = CICDExitCodes.VIOLATION;
          decision.block = this.options.blockOnViolations;
          decision.action = decision.block ? 'block' : 'warn';
          decision.message = 'Governance violations detected';
        }
        break;
        
      case PipelineMode.SELECTIVE:
        if (hasSecurityFailures && this.options.blockOnSecurityFailures) {
          decision.exitCode = CICDExitCodes.BLOCKED;
          decision.block = true;
          decision.action = 'block';
          decision.message = 'Security governance failures detected';
        } else if (hasCriticalFailures && this.options.blockOnCriticalRules) {
          decision.exitCode = CICDExitCodes.BLOCKED;
          decision.block = true;
          decision.action = 'block';
          decision.message = 'Critical governance rules failed';
        } else if (hasViolations) {
          decision.exitCode = CICDExitCodes.WARNING;
          decision.action = 'warn';
          decision.message = 'Governance warnings detected';
        }
        break;
        
      case PipelineMode.ADVISORY:
        if (hasViolations) {
          decision.exitCode = CICDExitCodes.WARNING;
          decision.action = 'warn';
          decision.message = 'Governance issues detected (advisory mode)';
        }
        break;
        
      case PipelineMode.CONDITIONAL:
        // Custom logic based on conditions
        if (this.options.context === GovernanceContext.PRODUCTION && hasViolations) {
          decision.exitCode = CICDExitCodes.BLOCKED;
          decision.block = true;
          decision.action = 'block';
          decision.message = 'Production deployment blocked by governance';
        }
        break;
    }
    
    return decision;
  }

  /**
   * Handle notifications (Slack, Teams, etc.)
   */
  async handleNotifications(results, context) {
    if (!results.passed && this.options.enableSlackNotifications) {
      await this.sendSlackNotification(results, context);
    }
  }

  /**
   * Send Slack notification (placeholder implementation)
   */
  async sendSlackNotification(results, context) {
    this.options.logger.debug('📱 Sending Slack notification for governance results');
    // Implementation would depend on Slack webhook configuration
  }

  /**
   * Set environment variables for pipeline consumption
   */
  setEnvironmentVariables(status) {
    process.env.KGEN_GOVERNANCE_PASSED = status.governance.passed.toString();
    process.env.KGEN_GOVERNANCE_BLOCKED = status.governance.blocked.toString();
    process.env.KGEN_GOVERNANCE_SCORE = status.compliance.overallScore;
    process.env.KGEN_GOVERNANCE_EXIT_CODE = status.cicd.exitCode.toString();
  }

  /**
   * Generate error outputs for failed executions
   */
  async generateErrorOutputs(errorResult) {
    const errorPath = path.join(this.options.reportsPath, 'governance-error.json');
    await fs.writeJson(errorPath, errorResult, { spaces: 2 });
    
    if (this.pipelineContext.provider === 'github-actions') {
      console.log(`::error::${errorResult.error}`);
    }
  }

  /**
   * Generate JUnit XML format
   */
  generateJUnitXML({ name, tests, failures, time, testCases }) {
    const testCasesXml = testCases.map(tc => {
      let xml = `    <testcase name="${tc.name}" classname="${tc.classname}" time="${tc.time}">`;
      
      if (tc.failure) {
        xml += `\n      <failure message="${tc.failure.message}" type="${tc.failure.type}">`;
        xml += `\n        <![CDATA[${tc.failure.details}]]>`;
        xml += `\n      </failure>`;
      }
      
      xml += `\n    </testcase>`;
      return xml;
    }).join('\n');
    
    return `<?xml version="1.0" encoding="UTF-8"?>
<testsuite name="${name}" tests="${tests}" failures="${failures}" time="${time}">
${testCasesXml}
</testsuite>`;
  }

  /**
   * Setup GitHub Actions specific configuration
   */
  setupGitHubActions() {
    // GitHub Actions specific setup
    this.options.logger.debug('🔧 Setting up GitHub Actions integration');
  }

  /**
   * Setup Azure DevOps specific configuration
   */
  setupAzureDevOps() {
    // Azure DevOps specific setup
    this.options.logger.debug('🔧 Setting up Azure DevOps integration');
  }

  /**
   * Get integration statistics
   */
  getStatistics() {
    return {
      mode: this.options.mode,
      context: this.options.context,
      pipeline: this.pipelineContext,
      lastExecution: this.executionResults ? {
        passed: this.executionResults.passed,
        blocked: this.executionResults.blocked,
        executionTime: this.executionResults.executionTime
      } : null
    };
  }
}

export default CICDIntegration;