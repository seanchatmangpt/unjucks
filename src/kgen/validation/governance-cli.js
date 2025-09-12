#!/usr/bin/env node
/**
 * KGEN Governance CLI - Policy Management and Gate Execution
 * 
 * Command-line interface for managing governance policies, executing gates,
 * and monitoring compliance across development workflows.
 * 
 * Usage:
 *   kgen-governance [command] [options]
 * 
 * Commands:
 *   validate <path>          Validate artifacts against governance rules
 *   gates <workflow>         Execute governance gates workflow  
 *   policies list           List available policies
 *   policies test <uri>     Test specific policy URI
 *   rules list              List SPARQL rules
 *   rules validate <rule>   Validate SPARQL rule syntax
 *   monitor                 Start real-time governance monitoring
 *   report <execution-id>   Generate compliance report
 *   init                    Initialize governance configuration
 */

import { Command } from 'commander';
import { GovernanceOrchestrator, GovernanceStrategy, GovernanceContext } from './governance-orchestrator.js';
import { CICDIntegration, PipelineMode, CICDExitCodes } from './cicd-integration.js';
import { PolicyURIResolver, PolicyURISchemes } from './policy-resolver.js';
import { SPARQLRuleEngine } from './sparql-rule-engine.js';
import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import Table from 'cli-table3';
import consola from 'consola';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * CLI Configuration
 */
class GovernanceCLI {
  constructor() {
    this.program = new Command();
    this.orchestrator = null;
    this.cicdIntegration = null;
    this.policyResolver = null;
    this.sparqlEngine = null;
    
    // CLI options
    this.globalOptions = {
      verbose: false,
      quiet: false,
      context: 'development',
      strategy: 'staged',
      configPath: './governance.config.json'
    };
    
    this.setupCommands();
  }

  /**
   * Setup CLI commands and options
   */
  setupCommands() {
    this.program
      .name('kgen-governance')
      .description('KGEN Governance CLI - Automated governance enforcement')
      .version('1.0.0')
      .option('-v, --verbose', 'Enable verbose logging')
      .option('-q, --quiet', 'Suppress non-essential output')
      .option('-c, --context <type>', 'Execution context (development|staging|production)', 'development')
      .option('-s, --strategy <type>', 'Execution strategy (sequential|parallel|staged)', 'staged')
      .option('--config <path>', 'Path to governance configuration file', './governance.config.json')
      .hook('preAction', (thisCommand, actionCommand) => {
        const opts = thisCommand.opts();
        this.globalOptions = { ...this.globalOptions, ...opts };
        this.setupLogging();
      });

    // Validation commands
    this.program
      .command('validate <path>')
      .description('Validate artifacts against governance rules')
      .option('--workflow <id>', 'Specific workflow to execute')
      .option('--format <type>', 'Output format (json|table|junit)', 'table')
      .option('--output <path>', 'Output file path')
      .option('--fail-fast', 'Stop on first failure')
      .action((artifactPath, options) => this.validateArtifacts(artifactPath, options));

    // Gate execution commands
    this.program
      .command('gates')
      .description('Execute governance gates')
      .addCommand(
        new Command('run')
          .argument('<workflow>', 'Workflow to execute')
          .option('--context <type>', 'Execution context override')
          .option('--data <path>', 'Path to RDF data file')
          .option('--timeout <ms>', 'Execution timeout in milliseconds', '300000')
          .description('Run governance gates workflow')
          .action((workflow, options) => this.runGatesWorkflow(workflow, options))
      )
      .addCommand(
        new Command('list')
          .description('List available gate workflows')
          .action(() => this.listGateWorkflows())
      )
      .addCommand(
        new Command('status')
          .argument('[execution-id]', 'Specific execution to check')
          .description('Check gate execution status')
          .action((executionId) => this.checkGateStatus(executionId))
      );

    // Policy management commands
    this.program
      .command('policies')
      .description('Manage governance policies')
      .addCommand(
        new Command('list')
          .option('--category <type>', 'Filter by category')
          .description('List available policies')
          .action((options) => this.listPolicies(options))
      )
      .addCommand(
        new Command('test')
          .argument('<uri>', 'Policy URI to test')
          .option('--context <path>', 'Context data file')
          .description('Test specific policy URI')
          .action((uri, options) => this.testPolicy(uri, options))
      )
      .addCommand(
        new Command('validate')
          .argument('<path>', 'Path to validate against policies')
          .option('--policies <uris...>', 'Specific policies to check')
          .description('Validate against specific policies')
          .action((artifactPath, options) => this.validatePolicies(artifactPath, options))
      );

    // SPARQL rule management
    this.program
      .command('rules')
      .description('Manage SPARQL governance rules')
      .addCommand(
        new Command('list')
          .option('--category <type>', 'Filter by category')
          .option('--priority <level>', 'Filter by priority')
          .description('List available SPARQL rules')
          .action((options) => this.listSparqlRules(options))
      )
      .addCommand(
        new Command('validate')
          .argument('<rule>', 'Rule ID to validate')
          .description('Validate SPARQL rule syntax')
          .action((ruleId) => this.validateSparqlRule(ruleId))
      )
      .addCommand(
        new Command('test')
          .argument('<rule>', 'Rule ID to test')
          .option('--data <path>', 'Test data file')
          .description('Test SPARQL rule execution')
          .action((ruleId, options) => this.testSparqlRule(ruleId, options))
      )
      .addCommand(
        new Command('create')
          .argument('<name>', 'Rule name')
          .option('--template <type>', 'Rule template to use')
          .description('Create new SPARQL rule')
          .action((name, options) => this.createSparqlRule(name, options))
      );

    // CI/CD integration commands
    this.program
      .command('cicd')
      .description('CI/CD pipeline integration')
      .addCommand(
        new Command('run')
          .option('--mode <type>', 'Pipeline mode (gate|advisory|selective)', 'gate')
          .option('--timeout <ms>', 'Execution timeout', '600000')
          .option('--reports-path <path>', 'Reports output path', './governance-reports')
          .description('Execute governance for CI/CD pipeline')
          .action((options) => this.runCICDGovernance(options))
      )
      .addCommand(
        new Command('setup')
          .option('--provider <type>', 'CI/CD provider (github|azure|gitlab)')
          .description('Setup CI/CD integration')
          .action((options) => this.setupCICDIntegration(options))
      );

    // Monitoring commands
    this.program
      .command('monitor')
      .description('Start real-time governance monitoring')
      .option('--interval <seconds>', 'Monitoring interval', '30')
      .option('--dashboard', 'Launch web dashboard')
      .action((options) => this.startMonitoring(options));

    // Reporting commands  
    this.program
      .command('report')
      .argument('[execution-id]', 'Specific execution ID')
      .option('--format <type>', 'Report format (json|html|pdf)', 'json')
      .option('--output <path>', 'Output file path')
      .option('--template <path>', 'Report template path')
      .description('Generate compliance report')
      .action((executionId, options) => this.generateReport(executionId, options));

    // Initialization command
    this.program
      .command('init')
      .description('Initialize governance configuration')
      .option('--interactive', 'Interactive setup')
      .option('--template <type>', 'Configuration template')
      .action((options) => this.initializeGovernance(options));

    // Statistics command
    this.program
      .command('stats')
      .description('Show governance statistics')
      .option('--period <timespan>', 'Time period (1d|7d|30d)', '7d')
      .action((options) => this.showStatistics(options));
  }

  /**
   * Setup logging based on CLI options
   */
  setupLogging() {
    if (this.globalOptions.quiet) {
      consola.level = 0;
    } else if (this.globalOptions.verbose) {
      consola.level = 4;
    }
  }

  /**
   * Initialize governance components
   */
  async initializeComponents() {
    const spinner = ora('Initializing governance components...').start();
    
    try {
      // Load configuration
      const config = await this.loadConfiguration();
      
      // Initialize orchestrator
      this.orchestrator = new GovernanceOrchestrator({
        context: this.globalOptions.context,
        strategy: this.globalOptions.strategy,
        ...config.orchestrator
      });
      
      // Initialize CI/CD integration
      this.cicdIntegration = new CICDIntegration({
        context: this.globalOptions.context,
        ...config.cicd
      });
      
      // Initialize policy resolver
      this.policyResolver = new PolicyURIResolver(config.policies);
      
      // Initialize SPARQL engine
      this.sparqlEngine = new SPARQLRuleEngine(config.sparql);
      
      spinner.succeed('Components initialized successfully');
      
    } catch (error) {
      spinner.fail(`Initialization failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Load governance configuration
   */
  async loadConfiguration() {
    const configPath = this.globalOptions.configPath;
    
    if (await fs.pathExists(configPath)) {
      return await fs.readJson(configPath);
    }
    
    // Return default configuration
    return {
      orchestrator: {
        shapesPath: './src/kgen/validation/shapes',
        rulesPath: './src/kgen/validation/rules',
        auditPath: './.kgen/audit',
        reportsPath: './governance-reports'
      },
      cicd: {
        mode: 'gate',
        enableJUnitOutput: true,
        enableSarifOutput: true
      },
      policies: {
        shapesPath: './src/kgen/validation/shapes',
        rulesPath: './src/kgen/validation/rules'
      },
      sparql: {
        rulesPath: './src/kgen/validation/rules',
        enableCaching: true
      }
    };
  }

  /**
   * Validate artifacts command
   */
  async validateArtifacts(artifactPath, options) {
    try {
      await this.initializeComponents();
      
      consola.info(`🔍 Validating artifacts: ${artifactPath}`);
      
      const context = {
        artifactPath: path.resolve(artifactPath),
        name: path.basename(artifactPath)
      };
      
      const workflowId = options.workflow || this.globalOptions.context;
      const results = await this.orchestrator.executeWorkflow(workflowId, context);
      
      // Format and output results
      await this.outputResults(results, options.format, options.output);
      
      if (!results.passed && options.failFast) {
        process.exit(1);
      }
      
    } catch (error) {
      consola.error('Validation failed:', error.message);
      process.exit(1);
    }
  }

  /**
   * Run gates workflow command
   */
  async runGatesWorkflow(workflowId, options) {
    try {
      await this.initializeComponents();
      
      consola.info(`🚪 Running gates workflow: ${workflowId}`);
      
      const context = {
        workflow: workflowId,
        environment: options.context || this.globalOptions.context
      };
      
      if (options.data) {
        context.dataGraph = await fs.readFile(options.data, 'utf8');
      }
      
      const results = await this.orchestrator.executeWorkflow(workflowId, context, {
        timeout: parseInt(options.timeout)
      });
      
      this.displayWorkflowResults(results);
      
      if (!results.passed) {
        process.exit(1);
      }
      
    } catch (error) {
      consola.error('Workflow execution failed:', error.message);
      process.exit(1);
    }
  }

  /**
   * List available gate workflows
   */
  async listGateWorkflows() {
    try {
      await this.initializeComponents();
      
      const workflows = [
        { id: 'development', name: 'Development Governance', gates: 3 },
        { id: 'staging', name: 'Staging Governance', gates: 5 },
        { id: 'production', name: 'Production Governance', gates: 7 }
      ];
      
      const table = new Table({
        head: ['Workflow ID', 'Name', 'Gates', 'Context'],
        colWidths: [15, 25, 8, 15]
      });
      
      workflows.forEach(workflow => {
        table.push([
          workflow.id,
          workflow.name,
          workflow.gates,
          workflow.id
        ]);
      });
      
      console.log('\n' + chalk.bold('Available Gate Workflows:'));
      console.log(table.toString());
      
    } catch (error) {
      consola.error('Failed to list workflows:', error.message);
      process.exit(1);
    }
  }

  /**
   * Check gate execution status
   */
  async checkGateStatus(executionId) {
    try {
      await this.initializeComponents();
      
      if (executionId) {
        // Check specific execution
        consola.info(`📊 Checking execution status: ${executionId}`);
        // Implementation would query audit logs
      } else {
        // Show recent executions
        const stats = this.orchestrator.getStatistics();
        this.displayOrchestrationStats(stats);
      }
      
    } catch (error) {
      consola.error('Failed to check status:', error.message);
      process.exit(1);
    }
  }

  /**
   * List available policies
   */
  async listPolicies(options) {
    try {
      const policies = Object.values(PolicyURISchemes).map(scheme => ({
        scheme,
        uri: `policy://${scheme}/pass`,
        category: this.getPolicyCategory(scheme)
      }));
      
      let filteredPolicies = policies;
      if (options.category) {
        filteredPolicies = policies.filter(p => p.category === options.category);
      }
      
      const table = new Table({
        head: ['Policy Scheme', 'Example URI', 'Category'],
        colWidths: [25, 35, 20]
      });
      
      filteredPolicies.forEach(policy => {
        table.push([
          policy.scheme,
          policy.uri,
          policy.category
        ]);
      });
      
      console.log('\n' + chalk.bold('Available Policies:'));
      console.log(table.toString());
      
    } catch (error) {
      consola.error('Failed to list policies:', error.message);
      process.exit(1);
    }
  }

  /**
   * Test specific policy URI
   */
  async testPolicy(policyURI, options) {
    try {
      await this.initializeComponents();
      
      consola.info(`🔍 Testing policy: ${policyURI}`);
      
      let context = {};
      if (options.context) {
        context = JSON.parse(await fs.readFile(options.context, 'utf8'));
      }
      
      const result = await this.policyResolver.resolvePolicyURI(policyURI, context);
      
      this.displayPolicyResult(result);
      
      if (!result.passed) {
        process.exit(1);
      }
      
    } catch (error) {
      consola.error('Policy test failed:', error.message);
      process.exit(1);
    }
  }

  /**
   * List SPARQL rules
   */
  async listSparqlRules(options) {
    try {
      await this.initializeComponents();
      
      const rules = [
        { id: 'security-compliance', category: 'security', priority: 'critical' },
        { id: 'data-governance', category: 'data-governance', priority: 'high' },
        { id: 'change-management', category: 'change-management', priority: 'critical' }
      ];
      
      let filteredRules = rules;
      if (options.category) {
        filteredRules = rules.filter(r => r.category === options.category);
      }
      if (options.priority) {
        filteredRules = filteredRules.filter(r => r.priority === options.priority);
      }
      
      const table = new Table({
        head: ['Rule ID', 'Category', 'Priority'],
        colWidths: [25, 20, 15]
      });
      
      filteredRules.forEach(rule => {
        table.push([
          rule.id,
          rule.category,
          rule.priority
        ]);
      });
      
      console.log('\n' + chalk.bold('Available SPARQL Rules:'));
      console.log(table.toString());
      
    } catch (error) {
      consola.error('Failed to list rules:', error.message);
      process.exit(1);
    }
  }

  /**
   * Run CI/CD governance
   */
  async runCICDGovernance(options) {
    try {
      await this.initializeComponents();
      
      consola.info('🚀 Running CI/CD governance validation');
      
      const cicd = new CICDIntegration({
        mode: options.mode,
        context: this.globalOptions.context,
        timeout: parseInt(options.timeout),
        reportsPath: options.reportsPath
      });
      
      await cicd.initialize();
      
      const results = await cicd.executeGovernance();
      
      this.displayCICDResults(results);
      
      process.exit(results.cicd.exitCode);
      
    } catch (error) {
      consola.error('CI/CD governance failed:', error.message);
      process.exit(CICDExitCodes.ERROR);
    }
  }

  /**
   * Initialize governance configuration
   */
  async initializeGovernance(options) {
    try {
      consola.info('🔧 Initializing governance configuration...');
      
      let config;
      
      if (options.interactive) {
        config = await this.interactiveSetup();
      } else {
        config = await this.createDefaultConfiguration(options.template);
      }
      
      await fs.writeJson(this.globalOptions.configPath, config, { spaces: 2 });
      
      // Create directory structure
      await this.createDirectoryStructure(config);
      
      consola.success(`✅ Governance configuration initialized: ${this.globalOptions.configPath}`);
      
    } catch (error) {
      consola.error('Initialization failed:', error.message);
      process.exit(1);
    }
  }

  /**
   * Interactive setup for governance configuration
   */
  async interactiveSetup() {
    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'context',
        message: 'Default execution context:',
        choices: Object.values(GovernanceContext),
        default: 'development'
      },
      {
        type: 'list',
        name: 'strategy',
        message: 'Default execution strategy:',
        choices: Object.values(GovernanceStrategy),
        default: 'staged'
      },
      {
        type: 'checkbox',
        name: 'features',
        message: 'Enable features:',
        choices: [
          { name: 'CI/CD Integration', value: 'cicd' },
          { name: 'Real-time Monitoring', value: 'monitoring' },
          { name: 'JUnit Output', value: 'junit' },
          { name: 'SARIF Output', value: 'sarif' }
        ],
        default: ['cicd', 'junit']
      },
      {
        type: 'input',
        name: 'shapesPath',
        message: 'SHACL shapes directory:',
        default: './src/kgen/validation/shapes'
      },
      {
        type: 'input',
        name: 'rulesPath',
        message: 'SPARQL rules directory:',
        default: './src/kgen/validation/rules'
      }
    ]);
    
    return this.buildConfigFromAnswers(answers);
  }

  /**
   * Display workflow execution results
   */
  displayWorkflowResults(results) {
    console.log('\n' + chalk.bold('🏗️  Workflow Execution Results'));
    console.log(`Workflow: ${results.workflowId}`);
    console.log(`Status: ${results.passed ? chalk.green('✅ PASSED') : 
                                           results.blocked ? chalk.red('🚫 BLOCKED') : 
                                           chalk.yellow('⚠️ FAILED')}`);
    console.log(`Execution Time: ${results.executionTime.toFixed(2)}ms\n`);
    
    if (results.gateResults.length > 0) {
      const table = new Table({
        head: ['Gate', 'Type', 'Status', 'Time'],
        colWidths: [20, 12, 12, 12]
      });
      
      results.gateResults.forEach(gate => {
        const status = gate.passed ? chalk.green('✅ PASS') :
                      gate.blocked ? chalk.red('🚫 BLOCK') :
                      chalk.yellow('⚠️ FAIL');
        
        table.push([
          gate.gateId,
          gate.type,
          status,
          `${gate.executionTime?.toFixed(2) || 'N/A'}ms`
        ]);
      });
      
      console.log(table.toString());
    }
  }

  /**
   * Display CI/CD results
   */
  displayCICDResults(results) {
    console.log('\n' + chalk.bold('🚀 CI/CD Governance Results'));
    console.log(`Status: ${results.passed ? chalk.green('✅ PASSED') : 
                                           results.blocked ? chalk.red('🚫 BLOCKED') : 
                                           chalk.yellow('⚠️ FAILED')}`);
    console.log(`Action: ${results.cicd.action.toUpperCase()}`);
    console.log(`Exit Code: ${results.cicd.exitCode}`);
    console.log(`Message: ${results.cicd.message}\n`);
  }

  /**
   * Display policy test result
   */
  displayPolicyResult(result) {
    console.log('\n' + chalk.bold('📋 Policy Test Result'));
    console.log(`Policy URI: ${result.policyURI}`);
    console.log(`Status: ${result.passed ? chalk.green('✅ PASSED') : chalk.red('❌ FAILED')}`);
    console.log(`Expected: ${result.expectedVerdict}`);
    console.log(`Actual: ${result.actualVerdict}`);
    console.log(`Resolution Time: ${result.metadata.resolutionTime.toFixed(2)}ms\n`);
  }

  /**
   * Output results in specified format
   */
  async outputResults(results, format, outputPath) {
    let output;
    
    switch (format) {
      case 'json':
        output = JSON.stringify(results, null, 2);
        break;
      case 'junit':
        output = this.generateJUnitOutput(results);
        break;
      case 'table':
      default:
        this.displayWorkflowResults(results);
        return;
    }
    
    if (outputPath) {
      await fs.writeFile(outputPath, output);
      consola.success(`Results written to: ${outputPath}`);
    } else {
      console.log(output);
    }
  }

  /**
   * Utility methods
   */
  getPolicyCategory(scheme) {
    if (scheme.includes('security')) return 'security';
    if (scheme.includes('data')) return 'data';
    if (scheme.includes('compliance')) return 'compliance';
    return 'general';
  }

  buildConfigFromAnswers(answers) {
    return {
      context: answers.context,
      strategy: answers.strategy,
      orchestrator: {
        shapesPath: answers.shapesPath,
        rulesPath: answers.rulesPath,
        auditPath: './.kgen/audit',
        reportsPath: './governance-reports'
      },
      cicd: {
        mode: 'gate',
        enableJUnitOutput: answers.features.includes('junit'),
        enableSarifOutput: answers.features.includes('sarif')
      },
      monitoring: {
        enabled: answers.features.includes('monitoring')
      }
    };
  }

  async createDefaultConfiguration(template) {
    return {
      context: 'development',
      strategy: 'staged',
      orchestrator: {
        shapesPath: './src/kgen/validation/shapes',
        rulesPath: './src/kgen/validation/rules',
        auditPath: './.kgen/audit',
        reportsPath: './governance-reports'
      },
      cicd: {
        mode: 'gate',
        enableJUnitOutput: true,
        enableSarifOutput: true
      }
    };
  }

  async createDirectoryStructure(config) {
    await fs.ensureDir(config.orchestrator.shapesPath);
    await fs.ensureDir(config.orchestrator.rulesPath);
    await fs.ensureDir(config.orchestrator.auditPath);
    await fs.ensureDir(config.orchestrator.reportsPath);
  }

  generateJUnitOutput(results) {
    // Simple JUnit XML generation
    return `<?xml version="1.0" encoding="UTF-8"?>
<testsuite name="KGEN Governance" tests="${results.gateResults.length}">
${results.gateResults.map(gate => 
  `  <testcase name="${gate.gateId}" classname="governance.${gate.type}" time="${(gate.executionTime / 1000).toFixed(3)}">
${!gate.passed ? `    <failure message="Gate failed">${gate.error || 'Gate validation failed'}</failure>` : ''}
  </testcase>`
).join('\n')}
</testsuite>`;
  }

  displayOrchestrationStats(stats) {
    console.log('\n' + chalk.bold('📊 Governance Statistics'));
    console.log(`Context: ${stats.context}`);
    console.log(`Strategy: ${stats.strategy}`);
    console.log(`Gates Registered: ${stats.gatesRegistered}`);
    console.log(`Active Executions: ${stats.activeExecutions}`);
    console.log(`Total Executions: ${stats.executionHistory}\n`);
  }

  /**
   * Run the CLI
   */
  async run() {
    try {
      await this.program.parseAsync(process.argv);
    } catch (error) {
      consola.error('CLI execution failed:', error.message);
      process.exit(1);
    }
  }

  // Placeholder implementations for remaining commands
  async validatePolicies(artifactPath, options) {
    consola.info('📋 Validating against policies...');
    // Implementation for policy validation
  }

  async validateSparqlRule(ruleId) {
    consola.info(`🔍 Validating SPARQL rule: ${ruleId}`);
    // Implementation for SPARQL rule validation
  }

  async testSparqlRule(ruleId, options) {
    consola.info(`🧪 Testing SPARQL rule: ${ruleId}`);
    // Implementation for SPARQL rule testing
  }

  async createSparqlRule(name, options) {
    consola.info(`📝 Creating SPARQL rule: ${name}`);
    // Implementation for SPARQL rule creation
  }

  async setupCICDIntegration(options) {
    consola.info('🔧 Setting up CI/CD integration...');
    // Implementation for CI/CD setup
  }

  async startMonitoring(options) {
    consola.info('📡 Starting governance monitoring...');
    // Implementation for monitoring
  }

  async generateReport(executionId, options) {
    consola.info('📄 Generating compliance report...');
    // Implementation for report generation
  }

  async showStatistics(options) {
    consola.info('📊 Loading governance statistics...');
    // Implementation for statistics display
  }
}

// Export for use as module or run as CLI
export default GovernanceCLI;

// Run CLI if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const cli = new GovernanceCLI();
  cli.run();
}