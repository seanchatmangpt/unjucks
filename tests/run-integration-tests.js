#!/usr/bin/env node

/**
 * Integration Test Runner
 * 
 * Main entry point for running the complete Fortune 5 integration test strategy.
 * Provides CLI interface with various execution modes and reporting options.
 */

import { program } from 'commander';
import chalk from 'chalk';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import IntegrationTestOrchestrator from './integration-strategy/integration-test-orchestrator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// CLI Configuration
program
  .name('run-integration-tests')
  .description('Fortune 5 Enterprise Integration Test Suite')
  .version('1.0.0');

program
  .option('-p, --parallel', 'Run tests in parallel (faster but more resource intensive)')
  .option('-s, --skip-long-running', 'Skip long-running tests (endurance, stress tests)')
  .option('-r, --report-dir <dir>', 'Custom directory for test reports', './tests/reports/integration')
  .option('-c, --coverage-threshold <number>', 'Coverage threshold percentage', '85')
  .option('-t, --timeout <number>', 'Test timeout in milliseconds', '300000')
  .option('--uptime-target <number>', 'Target uptime percentage (0-1)', '0.9999')
  .option('--max-latency <number>', 'Maximum acceptable latency in ms', '200')
  .option('--min-throughput <number>', 'Minimum throughput ops/s', '100')
  .option('--standards <standards>', 'Compliance standards (comma-separated)', 'SOC2,PCI-DSS,HIPAA,GDPR')
  .option('--verbose', 'Verbose output')
  .option('--json-output', 'Output results in JSON format');

// Main integration test command
program
  .command('all', { isDefault: true })
  .description('Run complete Fortune 5 integration test strategy')
  .action(async (options) => {
    try {
      await runIntegrationTests(program.opts());
    } catch (error) {
      console.error(chalk.red.bold('❌ Integration tests failed:'), error.message);
      process.exit(1);
    }
  });

// Individual test phase commands
program
  .command('boundaries')
  .description('Run system boundary tests only')
  .action(async () => {
    await runSpecificPhase('system_boundaries');
  });

program
  .command('contracts')
  .description('Run API contract validation only')
  .action(async () => {
    await runSpecificPhase('api_contracts');
  });

program
  .command('data-flow')
  .description('Run data flow integrity tests only')
  .action(async () => {
    await runSpecificPhase('data_flow');
  });

program
  .command('user-journeys')
  .description('Run critical user journey tests only')
  .action(async () => {
    await runSpecificPhase('user_journeys');
  });

program
  .command('performance')
  .description('Run performance & reliability tests only')
  .action(async () => {
    await runSpecificPhase('performance');
  });

program
  .command('quality')
  .description('Run quality monitoring & coverage tests only')
  .action(async () => {
    await runSpecificPhase('quality');
  });

// Utility commands
program
  .command('validate-setup')
  .description('Validate test environment setup')
  .action(async () => {
    await validateTestSetup();
  });

program
  .command('generate-report')
  .description('Generate comprehensive test report from existing data')
  .action(async () => {
    await generateTestReport();
  });

program
  .command('clean')
  .description('Clean test artifacts and reports')
  .action(async () => {
    await cleanTestArtifacts();
  });

/**
 * Run complete integration test strategy
 */
async function runIntegrationTests(options) {
  console.log(chalk.blue.bold('🏢 Fortune 5 Enterprise Integration Test Strategy'));
  console.log(chalk.blue('   Comprehensive System Integration & Reliability Testing\n'));

  // Display configuration
  displayConfiguration(options);

  // Create orchestrator with options
  const orchestrator = new IntegrationTestOrchestrator({
    projectRoot: process.cwd(),
    reportDir: options.reportDir,
    concurrentExecution: options.parallel,
    skipLongRunning: options.skipLongRunning,
    
    // Fortune 5 requirements
    targetUptime: parseFloat(options.uptimeTarget),
    maxLatencyMs: parseInt(options.maxLatency),
    minThroughput: parseInt(options.minThroughput),
    complianceStandards: options.standards.split(','),
    
    // Test configuration
    testTimeout: parseInt(options.timeout),
    requiredCoverage: {
      statements: parseInt(options.coverageThreshold),
      branches: parseInt(options.coverageThreshold) - 5,
      functions: parseInt(options.coverageThreshold),
      lines: parseInt(options.coverageThreshold)
    }
  });

  // Execute integration tests
  const startTime = Date.now();
  const results = await orchestrator.executeIntegrationStrategy();
  const duration = Date.now() - startTime;

  // Display results
  displayResults(results, duration, options);

  // Exit with appropriate code
  const exitCode = results.enterpriseReadiness === 'ENTERPRISE_READY' ? 0 : 1;
  process.exit(exitCode);
}

/**
 * Run specific test phase
 */
async function runSpecificPhase(phaseName) {
  console.log(chalk.yellow(`🔍 Running ${phaseName} tests only\n`));
  
  // Import specific framework based on phase
  let TestFramework;
  let frameworkPath;
  
  switch (phaseName) {
    case 'system_boundaries':
      frameworkPath = './system-boundaries/boundary-test-framework.js';
      break;
    case 'api_contracts':
      frameworkPath = './api-contracts/api-contract-validator.js';
      break;
    case 'data_flow':
      frameworkPath = './integration-strategy/data-flow-integrity-tester.js';
      break;
    case 'user_journeys':
      frameworkPath = './integration-strategy/critical-user-journey-tester.js';
      break;
    case 'performance':
      frameworkPath = './integration-strategy/performance-reliability-tester.js';
      break;
    case 'quality':
      frameworkPath = './integration-strategy/coverage-quality-monitor.js';
      break;
    default:
      throw new Error(`Unknown phase: ${phaseName}`);
  }

  try {
    const module = await import(frameworkPath);
    TestFramework = module.default;
    
    const framework = new TestFramework({
      projectRoot: process.cwd()
    });

    let result;
    switch (phaseName) {
      case 'system_boundaries':
        result = await framework.testAllBoundaries();
        break;
      case 'api_contracts':
        result = await framework.validateAllContracts();
        break;
      case 'data_flow':
        result = await framework.testAllDataFlows();
        break;
      case 'user_journeys':
        result = await framework.testAllUserJourneys();
        break;
      case 'performance':
        result = await framework.executePerformanceReliabilityTests();
        break;
      case 'quality':
        result = await framework.executeQualityMonitoring();
        break;
    }

    console.log(chalk.green.bold(`✅ ${phaseName} tests completed successfully`));
    console.log(chalk.white(`📊 Results saved to test reports directory`));
    
  } catch (error) {
    console.error(chalk.red.bold(`❌ ${phaseName} tests failed:`), error.message);
    process.exit(1);
  }
}

/**
 * Validate test environment setup
 */
async function validateTestSetup() {
  console.log(chalk.yellow('🔍 Validating Test Environment Setup\n'));

  const checks = [
    {
      name: 'Node.js Version',
      check: () => {
        const version = process.version;
        const major = parseInt(version.substring(1).split('.')[0]);
        return { passed: major >= 18, message: `Node.js ${version} (requires >= 18.0.0)` };
      }
    },
    {
      name: 'NPM Dependencies',
      check: async () => {
        try {
          const packageJson = await import(path.join(process.cwd(), 'package.json'), { assert: { type: 'json' } });
          const hasVitest = packageJson.default.devDependencies?.vitest || packageJson.default.dependencies?.vitest;
          return { passed: !!hasVitest, message: hasVitest ? 'Vitest available' : 'Vitest not found' };
        } catch {
          return { passed: false, message: 'Cannot read package.json' };
        }
      }
    },
    {
      name: 'Test Directories',
      check: async () => {
        const fs = await import('fs-extra');
        const testDirs = ['tests', 'tests/integration', 'tests/unit'];
        const existing = [];
        
        for (const dir of testDirs) {
          if (await fs.pathExists(dir)) {
            existing.push(dir);
          }
        }
        
        return { 
          passed: existing.length > 0, 
          message: `Found directories: ${existing.join(', ') || 'none'}` 
        };
      }
    },
    {
      name: 'CLI Executable',
      check: async () => {
        const fs = await import('fs-extra');
        const cliPath = path.join(process.cwd(), 'bin/unjucks.cjs');
        const exists = await fs.pathExists(cliPath);
        
        if (exists) {
          const stats = await fs.stat(cliPath);
          const executable = !!(stats.mode & parseInt('111', 8));
          return { 
            passed: executable, 
            message: executable ? 'CLI executable found' : 'CLI file not executable' 
          };
        }
        
        return { passed: false, message: 'CLI file not found' };
      }
    },
    {
      name: 'Source Code Structure',
      check: async () => {
        const fs = await import('fs-extra');
        const srcPath = path.join(process.cwd(), 'src');
        const exists = await fs.pathExists(srcPath);
        
        if (exists) {
          const files = await fs.readdir(srcPath);
          return { 
            passed: files.length > 0, 
            message: `Source directory contains ${files.length} items` 
          };
        }
        
        return { passed: false, message: 'src directory not found' };
      }
    }
  ];

  let passedChecks = 0;
  
  for (const check of checks) {
    try {
      const result = await check.check();
      const status = result.passed ? chalk.green('✅ PASS') : chalk.red('❌ FAIL');
      console.log(`${status} ${check.name}: ${result.message}`);
      
      if (result.passed) passedChecks++;
      
    } catch (error) {
      console.log(`${chalk.red('❌ FAIL')} ${check.name}: ${error.message}`);
    }
  }

  console.log(`\n📊 Environment Check: ${passedChecks}/${checks.length} passed`);
  
  if (passedChecks === checks.length) {
    console.log(chalk.green.bold('🎉 Test environment is ready for Fortune 5 integration testing!'));
  } else {
    console.log(chalk.yellow.bold('⚠️  Some environment issues detected. Tests may not run optimally.'));
  }
}

/**
 * Generate test report from existing data
 */
async function generateTestReport() {
  console.log(chalk.yellow('📊 Generating Comprehensive Test Report\n'));
  
  try {
    const fs = await import('fs-extra');
    const reportDir = './tests/reports/integration';
    
    if (!(await fs.pathExists(reportDir))) {
      console.log(chalk.red('❌ No test reports found. Run tests first.'));
      return;
    }

    // Find latest reports
    const files = await fs.readdir(reportDir);
    const reportFiles = files.filter(f => f.endsWith('.json'));
    
    if (reportFiles.length === 0) {
      console.log(chalk.red('❌ No test report data found.'));
      return;
    }

    console.log(chalk.green(`✅ Found ${reportFiles.length} report files`));
    console.log(chalk.white(`📁 Reports available in: ${reportDir}`));
    
    // List available reports
    reportFiles.forEach(file => {
      console.log(chalk.blue(`   • ${file}`));
    });

  } catch (error) {
    console.error(chalk.red('❌ Failed to generate report:'), error.message);
  }
}

/**
 * Clean test artifacts and reports
 */
async function cleanTestArtifacts() {
  console.log(chalk.yellow('🧹 Cleaning Test Artifacts\n'));
  
  try {
    const fs = await import('fs-extra');
    const cleanDirs = [
      './tests/reports',
      './tests/workspace',
      './tests/temp',
      './coverage',
      './.nyc_output'
    ];

    for (const dir of cleanDirs) {
      if (await fs.pathExists(dir)) {
        await fs.remove(dir);
        console.log(chalk.green(`✅ Cleaned: ${dir}`));
      } else {
        console.log(chalk.gray(`⚪ Not found: ${dir}`));
      }
    }

    console.log(chalk.green.bold('\n🎉 Test artifacts cleaned successfully!'));

  } catch (error) {
    console.error(chalk.red('❌ Failed to clean artifacts:'), error.message);
  }
}

/**
 * Display configuration
 */
function displayConfiguration(options) {
  console.log(chalk.cyan('🔧 Test Configuration:'));
  console.log(chalk.white(`   • Execution Mode: ${options.parallel ? 'Parallel' : 'Sequential'}`));
  console.log(chalk.white(`   • Long Running Tests: ${options.skipLongRunning ? 'Skipped' : 'Enabled'}`));
  console.log(chalk.white(`   • Coverage Threshold: ${options.coverageThreshold}%`));
  console.log(chalk.white(`   • Target Uptime: ${(parseFloat(options.uptimeTarget) * 100).toFixed(2)}%`));
  console.log(chalk.white(`   • Max Latency: ${options.maxLatency}ms`));
  console.log(chalk.white(`   • Min Throughput: ${options.minThroughput} ops/s`));
  console.log(chalk.white(`   • Compliance Standards: ${options.standards}`));
  console.log(chalk.white(`   • Test Timeout: ${parseInt(options.timeout) / 1000}s`));
  console.log(chalk.white(`   • Report Directory: ${options.reportDir}`));
  console.log('');
}

/**
 * Display test results
 */
function displayResults(results, duration, options) {
  console.log(chalk.blue.bold('\n🎯 INTEGRATION TEST RESULTS'));
  console.log(chalk.blue('====================================='));

  if (options.jsonOutput) {
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  // Overall status
  const statusColor = results.enterpriseReadiness === 'ENTERPRISE_READY' ? chalk.green : chalk.yellow;
  console.log(chalk.white(`🏢 Enterprise Readiness: ${statusColor.bold(results.enterpriseReadiness)}`));
  console.log(chalk.white(`⏱️  Total Duration: ${chalk.cyan((duration / 1000).toFixed(2) + 's')}`));
  console.log(chalk.white(`📊 Tests Executed: ${chalk.cyan(results.totalTests)}`));
  console.log(chalk.white(`✅ Tests Passed: ${chalk.green(results.passedTests)}`));
  console.log(chalk.white(`❌ Tests Failed: ${chalk.red(results.failedTests)}`));
  console.log(chalk.white(`📈 Success Rate: ${chalk.cyan(((results.passedTests / results.totalTests) * 100).toFixed(2) + '%')}`));

  // Fortune 5 compliance
  if (results.fortune5Compliance) {
    console.log(chalk.blue('\n🏆 Fortune 5 Compliance Status:'));
    console.log(chalk.white(`   • Overall Status: ${getComplianceColor(results.fortune5Compliance.overallStatus)}`));
    console.log(chalk.white(`   • Compliance Score: ${chalk.cyan(results.fortune5Compliance.complianceScore + '%')}`));
    console.log(chalk.white(`   • Performance: ${getComplianceColor(results.fortune5Compliance.performanceCompliance)}`));
    console.log(chalk.white(`   • Security: ${getComplianceColor(results.fortune5Compliance.securityCompliance)}`));
    console.log(chalk.white(`   • Reliability: ${getComplianceColor(results.fortune5Compliance.reliabilityCompliance)}`));
  }

  // Phase results
  if (results.phases && Object.keys(results.phases).length > 0) {
    console.log(chalk.blue('\n📋 Test Phase Results:'));
    Object.values(results.phases).forEach(phase => {
      const statusIcon = phase.status === 'COMPLETED' ? '✅' : '❌';
      const durationText = `(${Math.round(phase.duration)}ms)`;
      console.log(chalk.white(`   ${statusIcon} ${phase.name}: ${phase.status} ${chalk.gray(durationText)}`));
    });
  }

  // Recommendations
  console.log(chalk.blue('\n💡 Next Steps:'));
  if (results.enterpriseReadiness === 'ENTERPRISE_READY') {
    console.log(chalk.green('   🎉 System is ready for Fortune 5 production deployment!'));
    console.log(chalk.white('   • All quality gates passed'));
    console.log(chalk.white('   • Performance meets enterprise requirements'));
    console.log(chalk.white('   • System reliability exceeds 99.99% target'));
  } else {
    console.log(chalk.yellow('   ⚠️  System requires improvements before deployment:'));
    console.log(chalk.white('   • Review failed test results in detailed reports'));
    console.log(chalk.white('   • Address critical issues identified'));
    console.log(chalk.white('   • Re-run tests after fixes'));
  }

  console.log(chalk.blue(`\n📁 Detailed reports available in: ${chalk.cyan(options.reportDir)}`));
}

/**
 * Get compliance status color
 */
function getComplianceColor(status) {
  switch (status) {
    case 'COMPLIANT':
    case 'ENTERPRISE_READY':
    case 'FULLY_COMPLIANT':
      return chalk.green.bold(status);
    case 'PARTIALLY_COMPLIANT':
    case 'MINOR_ISSUES_NEED_RESOLUTION':
      return chalk.yellow.bold(status);
    default:
      return chalk.red.bold(status);
  }
}

// Parse CLI arguments
program.parse(process.argv);

// Show help if no arguments provided
if (process.argv.length === 2) {
  program.help();
}

export { runIntegrationTests, validateTestSetup, generateTestReport, cleanTestArtifacts };