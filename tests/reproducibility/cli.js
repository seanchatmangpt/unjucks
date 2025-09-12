#!/usr/bin/env node

/**
 * KGEN Reproducibility CLI
 * 
 * Command-line interface for reproducibility validation and monitoring
 * 
 * Commands:
 *   validate - Run comprehensive reproducibility validation
 *   monitor - Start real-time monitoring
 *   report - Generate reproducibility reports
 *   test - Run specific reproducibility tests
 * 
 * Agent 11: Reproducibility Validation Engineer
 */

import { Command } from 'commander';
import { resolve, join } from 'path';
import { existsSync } from 'fs';
import { promises as fs } from 'fs';
import ReproducibilityTestFramework from './framework.js';
import ReproducibilityMonitor from './monitor.js';

const program = new Command();

program
  .name('kgen-repro')
  .description('KGEN Reproducibility Validation CLI')
  .version('1.0.0');

/**
 * Validate command - Run comprehensive reproducibility validation
 */
program
  .command('validate')
  .description('Run comprehensive reproducibility validation')
  .option('-t, --target <percentage>', 'Target reproducibility percentage', '99.9')
  .option('-i, --iterations <number>', 'Number of test iterations', '10')
  .option('-p, --parallel <number>', 'Parallel test processes', '4')
  .option('-o, --output <directory>', 'Output directory for reports', './tests/reproducibility/reports')
  .option('--timeout <ms>', 'Test timeout in milliseconds', '30000')
  .option('--isolation <level>', 'Environment isolation level (strict|moderate|basic)', 'strict')
  .option('--kgen-path <path>', 'Path to KGEN binary', './bin/kgen.mjs')
  .option('--include <suites>', 'Comma-separated test suites to include')
  .option('--exclude <suites>', 'Comma-separated test suites to exclude')
  .option('--json', 'Output results in JSON format')
  .option('--verbose', 'Enable verbose output')
  .option('--debug', 'Enable debug mode')
  .action(async (options) => {
    console.log('🔍 KGEN Reproducibility Validation');
    console.log('=====================================\n');

    try {
      // Parse options
      const config = {
        targetReproducibility: parseFloat(options.target),
        minIterations: parseInt(options.iterations),
        parallelTests: parseInt(options.parallel),
        testTimeout: parseInt(options.timeout),
        isolationLevel: options.isolation,
        kgenPath: resolve(options.kgenPath),
        tempDir: join(resolve(options.output), 'temp'),
        verbose: options.verbose,
        debug: options.debug
      };

      // Validate KGEN path
      if (!existsSync(config.kgenPath)) {
        throw new Error(`KGEN binary not found at: ${config.kgenPath}`);
      }

      // Create output directory
      await fs.mkdir(options.output, { recursive: true });

      // Initialize framework
      const framework = new ReproducibilityTestFramework(config);

      // Set up progress reporting
      if (!options.json) {
        framework.on('initialized', () => {
          console.log('✅ Framework initialized');
        });

        framework.on('validation-started', (data) => {
          console.log(`🚀 Starting validation with ${data.suites} test suites`);
          console.log(`   Target: ${data.target}% reproducibility`);
          console.log(`   Iterations per test: ${data.iterations}`);
          console.log('');
        });

        framework.on('suite-started', (data) => {
          console.log(`📋 Running suite: ${data.name} (${data.tests} tests)`);
        });

        framework.on('test-progress', (data) => {
          const progress = ((data.completed / data.total) * 100).toFixed(1);
          process.stdout.write(`\r   ${data.operation}: ${data.completed}/${data.total} (${progress}%) - Current score: ${data.currentScore.toFixed(1)}%`);
        });

        framework.on('test-completed', (data) => {
          console.log(`\n   ✓ ${data.test}: ${data.score.toFixed(2)}%`);
        });

        framework.on('suite-completed', (data) => {
          const status = data.score >= config.targetReproducibility ? '✅' : '❌';
          console.log(`   ${status} Suite '${data.name}': ${data.score.toFixed(2)}% (${(data.duration / 1000).toFixed(1)}s)`);
          console.log('');
        });

        framework.on('critical-failure', (data) => {
          console.log(`🚨 CRITICAL: Suite '${data.suite}' scored ${data.score.toFixed(2)}%`);
        });
      }

      // Initialize and run validation
      const initResult = await framework.initialize();
      if (!initResult.success) {
        throw new Error(initResult.error);
      }

      // Generate test suites based on include/exclude options
      let testSuites = await framework.generateDefaultTestSuites();
      
      if (options.include) {
        const includeSuites = options.include.split(',').map(s => s.trim());
        testSuites = testSuites.filter(suite => includeSuites.includes(suite.name));
      }

      if (options.exclude) {
        const excludeSuites = options.exclude.split(',').map(s => s.trim());
        testSuites = testSuites.filter(suite => !excludeSuites.includes(suite.name));
      }

      // Run validation
      const result = await framework.runReproducibilityValidation(testSuites);

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log('=====================================');
        console.log('🎯 VALIDATION RESULTS');
        console.log('=====================================\n');
        
        console.log(`Overall Reproducibility: ${result.reproducibilityScore.toFixed(2)}%`);
        console.log(`Target Reproducibility:  ${config.targetReproducibility}%`);
        console.log(`Status: ${result.passed ? '✅ PASSED' : '❌ FAILED'}`);
        console.log(`Duration: ${(result.duration / 1000).toFixed(1)}s`);
        console.log(`Report: ${result.report.reportPath}`);
        console.log(`Summary: ${result.report.summaryPath}`);

        if (!result.passed) {
          console.log('\n🚨 REPRODUCIBILITY TARGET NOT MET');
          console.log('Review the detailed report for specific issues and recommendations.');
        }

        if (result.report.issues.nonDeterministicSources.length > 0) {
          console.log('\n⚠️  Non-deterministic sources detected:');
          result.report.issues.nonDeterministicSources.forEach(source => {
            console.log(`   • ${source}`);
          });
        }

        if (result.report.recommendations.length > 0) {
          console.log('\n💡 Recommendations:');
          result.report.recommendations.forEach(rec => {
            console.log(`   ${rec.type === 'critical' ? '🚨' : '⚠️'} ${rec.title}: ${rec.action}`);
          });
        }
      }

      // Cleanup
      await framework.shutdown();

      process.exit(result.passed ? 0 : 1);

    } catch (error) {
      if (options.json) {
        console.error(JSON.stringify({ success: false, error: error.message }, null, 2));
      } else {
        console.error(`❌ Validation failed: ${error.message}`);
      }
      process.exit(1);
    }
  });

/**
 * Monitor command - Start real-time monitoring
 */
program
  .command('monitor')
  .description('Start real-time reproducibility monitoring')
  .option('-i, --interval <ms>', 'Monitoring interval in milliseconds', '60000')
  .option('-t, --threshold <percentage>', 'Alert threshold percentage', '95.0')
  .option('-o, --output <directory>', 'Output directory for reports', './tests/reproducibility/reports')
  .option('--performance-threshold <percentage>', 'Performance alert threshold', '15')
  .option('--max-history <number>', 'Maximum history size', '1000')
  .option('--kgen-path <path>', 'Path to KGEN binary', './bin/kgen.mjs')
  .option('--no-alerts', 'Disable real-time alerts')
  .option('--dashboard-port <port>', 'HTTP port for dashboard (if available)', '3000')
  .option('--json', 'Output in JSON format')
  .action(async (options) => {
    if (!options.json) {
      console.log('📊 KGEN Reproducibility Monitor');
      console.log('================================\n');
    }

    try {
      const config = {
        monitoringInterval: parseInt(options.interval),
        alertThreshold: parseFloat(options.threshold),
        performanceThreshold: parseFloat(options.performanceThreshold),
        maxHistorySize: parseInt(options.maxHistory),
        outputDirectory: resolve(options.output),
        enableRealTimeAlerts: !options.noAlerts,
        kgenPath: resolve(options.kgenPath)
      };

      // Validate KGEN path
      if (!existsSync(config.kgenPath)) {
        throw new Error(`KGEN binary not found at: ${config.kgenPath}`);
      }

      const monitor = new ReproducibilityMonitor(config);

      // Set up event handlers
      if (!options.json) {
        monitor.on('monitoring-started', (data) => {
          console.log('🚀 Monitoring started');
          console.log(`   Interval: ${data.interval / 1000}s`);
          console.log(`   Baseline: ${data.baseline?.overallScore?.toFixed(2) || 'N/A'}%`);
          console.log(`   Alert threshold: ${config.alertThreshold}%`);
          console.log('   Press Ctrl+C to stop\n');
        });

        monitor.on('cycle-completed', (cycle) => {
          const timestamp = new Date(cycle.timestamp).toLocaleTimeString();
          console.log(`[${timestamp}] Cycle ${cycle.cycleNumber}: ${cycle.metrics.overallReproducibility.toFixed(2)}% (${cycle.metrics.avgExecutionTime.toFixed(0)}ms avg)`);
        });

        monitor.on('alerts-triggered', (alerts) => {
          console.log(`\n🚨 ${alerts.length} ALERT${alerts.length > 1 ? 'S' : ''} TRIGGERED:`);
          alerts.forEach(alert => {
            const emoji = alert.severity === 'high' ? '🚨' : alert.severity === 'medium' ? '⚠️' : 'ℹ️';
            console.log(`   ${emoji} [${alert.severity.toUpperCase()}] ${alert.message}`);
          });
          console.log('');
        });

        monitor.on('monitoring-error', (error) => {
          console.error(`❌ Monitoring error: ${error.message}`);
        });

        monitor.on('baseline-establishing', () => {
          console.log('🔄 Establishing baseline metrics...');
        });

        monitor.on('baseline-established', (baseline) => {
          console.log(`✅ Baseline established: ${baseline.overallScore.toFixed(2)}%\n`);
        });
      }

      // Handle graceful shutdown
      process.on('SIGINT', async () => {
        if (!options.json) {
          console.log('\n🛑 Stopping monitoring...');
        }
        
        const result = await monitor.stopMonitoring();
        
        if (!options.json) {
          if (result.report) {
            console.log(`📈 Final report generated: ${result.report.reportPath}`);
            if (result.report.dashboardPath) {
              console.log(`🎨 Dashboard: ${result.report.dashboardPath}`);
            }
          }
          console.log('Monitoring stopped.');
        } else {
          console.log(JSON.stringify(result, null, 2));
        }
        
        process.exit(0);
      });

      // Start monitoring
      const result = await monitor.startMonitoring();
      if (!result.success) {
        throw new Error(result.error);
      }

      if (options.json) {
        // For JSON mode, output periodic updates
        monitor.on('cycle-completed', (cycle) => {
          console.log(JSON.stringify({
            type: 'cycle-completed',
            cycle: cycle
          }));
        });
      }

      // Keep process alive
      await new Promise(() => {});

    } catch (error) {
      if (options.json) {
        console.error(JSON.stringify({ success: false, error: error.message }, null, 2));
      } else {
        console.error(`❌ Monitoring failed: ${error.message}`);
      }
      process.exit(1);
    }
  });

/**
 * Report command - Generate reproducibility reports
 */
program
  .command('report')
  .description('Generate reproducibility reports from monitoring data')
  .option('-i, --input <file>', 'Input monitoring state file')
  .option('-o, --output <directory>', 'Output directory', './tests/reproducibility/reports')
  .option('-f, --format <format>', 'Output format (json|html|markdown)', 'html')
  .option('--period <period>', 'Report period (24h|7d|30d|all)', '7d')
  .option('--include-trends', 'Include trend analysis')
  .option('--include-recommendations', 'Include recommendations')
  .action(async (options) => {
    console.log('📊 Generating Reproducibility Report');
    console.log('=====================================\n');

    try {
      const outputDir = resolve(options.output);
      await fs.mkdir(outputDir, { recursive: true });

      // Find monitoring state file
      let stateFile = options.input;
      if (!stateFile) {
        stateFile = join(outputDir, 'monitoring-state.json');
      }

      if (!existsSync(stateFile)) {
        throw new Error(`Monitoring state file not found: ${stateFile}`);
      }

      // Load monitoring data
      console.log('📂 Loading monitoring data...');
      const stateData = JSON.parse(await fs.readFile(stateFile, 'utf8'));

      if (!stateData.history || stateData.history.length === 0) {
        throw new Error('No monitoring history found in state file');
      }

      // Filter data by period
      let filteredHistory = stateData.history;
      if (options.period !== 'all') {
        const periodMs = {
          '24h': 24 * 60 * 60 * 1000,
          '7d': 7 * 24 * 60 * 60 * 1000,
          '30d': 30 * 24 * 60 * 60 * 1000
        };

        const cutoffTime = new Date(this.getDeterministicTimestamp() - periodMs[options.period]);
        filteredHistory = stateData.history.filter(cycle => 
          new Date(cycle.timestamp) >= cutoffTime
        );
      }

      console.log(`📈 Analyzing ${filteredHistory.length} monitoring cycles...`);

      // Generate report data
      const reportData = {
        metadata: {
          generatedAt: this.getDeterministicDate().toISOString(),
          period: options.period,
          totalCycles: filteredHistory.length,
          dateRange: {
            start: filteredHistory[0]?.timestamp,
            end: filteredHistory[filteredHistory.length - 1]?.timestamp
          }
        },
        summary: generateSummary(filteredHistory),
        trends: options.includeTrends ? generateTrends(filteredHistory) : null,
        operations: generateOperationAnalysis(filteredHistory),
        alerts: generateAlertAnalysis(filteredHistory),
        recommendations: options.includeRecommendations ? generateRecommendations(filteredHistory) : null,
        baseline: stateData.baseline
      };

      // Generate output based on format
      const timestamp = this.getDeterministicDate().toISOString().replace(/[:.]/g, '-');
      
      if (options.format === 'json' || options.format === 'all') {
        const jsonPath = join(outputDir, `reproducibility-report-${timestamp}.json`);
        await fs.writeFile(jsonPath, JSON.stringify(reportData, null, 2));
        console.log(`✅ JSON report: ${jsonPath}`);
      }

      if (options.format === 'html' || options.format === 'all') {
        const htmlPath = join(outputDir, `reproducibility-report-${timestamp}.html`);
        await generateHTMLReport(reportData, htmlPath);
        console.log(`✅ HTML report: ${htmlPath}`);
      }

      if (options.format === 'markdown' || options.format === 'all') {
        const mdPath = join(outputDir, `reproducibility-report-${timestamp}.md`);
        await generateMarkdownReport(reportData, mdPath);
        console.log(`✅ Markdown report: ${mdPath}`);
      }

      console.log('\n🎉 Report generation completed');

    } catch (error) {
      console.error(`❌ Report generation failed: ${error.message}`);
      process.exit(1);
    }
  });

/**
 * Test command - Run specific reproducibility tests
 */
program
  .command('test')
  .description('Run specific reproducibility tests')
  .option('-o, --operation <operation>', 'Specific operation to test')
  .option('-i, --iterations <number>', 'Number of iterations', '5')
  .option('-t, --threshold <percentage>', 'Pass/fail threshold', '95.0')
  .option('--kgen-path <path>', 'Path to KGEN binary', './bin/kgen.mjs')
  .option('--json', 'Output in JSON format')
  .option('--verbose', 'Verbose output')
  .action(async (options) => {
    const operations = [
      'graph hash',
      'graph index',
      'artifact generate',
      'deterministic render',
      'project lock'
    ];

    if (!options.json) {
      console.log('🧪 KGEN Reproducibility Quick Test');
      console.log('===================================\n');
    }

    try {
      const testOperation = options.operation || 'graph hash';
      const iterations = parseInt(options.iterations);
      const threshold = parseFloat(options.threshold);

      if (!operations.includes(testOperation)) {
        throw new Error(`Unknown operation: ${testOperation}. Available: ${operations.join(', ')}`);
      }

      // Simple test implementation
      const framework = new ReproducibilityTestFramework({
        targetReproducibility: threshold,
        minIterations: iterations,
        kgenPath: resolve(options.kgenPath)
      });

      await framework.initialize();

      const testSuite = {
        name: 'Quick Test',
        tests: [{
          operation: testOperation,
          args: ['{{testFile}}'],
          type: 'hash-comparison'
        }]
      };

      const result = await framework.runTestSuite(testSuite);
      
      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(`Operation: ${testOperation}`);
        console.log(`Iterations: ${result.totalRuns}`);
        console.log(`Reproducibility: ${result.reproducibilityScore.toFixed(2)}%`);
        console.log(`Threshold: ${threshold}%`);
        console.log(`Status: ${result.reproducibilityScore >= threshold ? '✅ PASSED' : '❌ FAILED'}`);
        
        if (result.issues.length > 0) {
          console.log('\nIssues detected:');
          result.issues.forEach(issue => {
            console.log(`  • ${issue.type}: ${issue.description || issue.error}`);
          });
        }
      }

      await framework.shutdown();

      process.exit(result.reproducibilityScore >= threshold ? 0 : 1);

    } catch (error) {
      if (options.json) {
        console.error(JSON.stringify({ success: false, error: error.message }, null, 2));
      } else {
        console.error(`❌ Test failed: ${error.message}`);
      }
      process.exit(1);
    }
  });

// Helper functions for report generation

function generateSummary(history) {
  if (history.length === 0) return null;

  const scores = history.map(cycle => cycle.metrics.overallReproducibility);
  const times = history.map(cycle => cycle.metrics.avgExecutionTime);
  const errorRates = history.map(cycle => cycle.metrics.errorRate);

  return {
    avgReproducibility: scores.reduce((a, b) => a + b) / scores.length,
    minReproducibility: Math.min(...scores),
    maxReproducibility: Math.max(...scores),
    avgExecutionTime: times.reduce((a, b) => a + b) / times.length,
    avgErrorRate: errorRates.reduce((a, b) => a + b) / errorRates.length,
    totalCycles: history.length,
    timespan: new Date(history[history.length - 1].timestamp) - new Date(history[0].timestamp)
  };
}

function generateTrends(history) {
  // Implementation for trend analysis
  return {
    reproducibility: 'stable', // Placeholder
    performance: 'stable',
    reliability: 'stable'
  };
}

function generateOperationAnalysis(history) {
  const operations = {};
  
  history.forEach(cycle => {
    Object.keys(cycle.operations).forEach(operation => {
      if (!operations[operation]) {
        operations[operation] = { scores: [], times: [], errors: 0 };
      }
      
      const opData = cycle.operations[operation];
      if (opData.success) {
        operations[operation].scores.push(opData.reproducibilityScore);
        operations[operation].times.push(opData.avgExecutionTime);
      } else {
        operations[operation].errors++;
      }
    });
  });

  // Calculate averages
  Object.keys(operations).forEach(operation => {
    const op = operations[operation];
    op.avgScore = op.scores.length > 0 ? op.scores.reduce((a, b) => a + b) / op.scores.length : 0;
    op.avgTime = op.times.length > 0 ? op.times.reduce((a, b) => a + b) / op.times.length : 0;
    op.reliability = ((op.scores.length / (op.scores.length + op.errors)) * 100) || 0;
  });

  return operations;
}

function generateAlertAnalysis(history) {
  const alerts = history.flatMap(cycle => cycle.alerts || []);
  
  const bySeverity = alerts.reduce((acc, alert) => {
    acc[alert.severity] = (acc[alert.severity] || 0) + 1;
    return acc;
  }, {});

  const byType = alerts.reduce((acc, alert) => {
    acc[alert.type] = (acc[alert.type] || 0) + 1;
    return acc;
  }, {});

  return {
    total: alerts.length,
    bySeverity,
    byType,
    recent: alerts.slice(-10)
  };
}

function generateRecommendations(history) {
  const recommendations = [];
  
  if (history.length === 0) return recommendations;

  const latest = history[history.length - 1];
  
  if (latest.metrics.overallReproducibility < 99) {
    recommendations.push({
      type: 'reproducibility',
      priority: 'high',
      message: 'Current reproducibility below 99%',
      action: 'Review non-deterministic sources and implement fixes'
    });
  }

  return recommendations;
}

async function generateHTMLReport(data, outputPath) {
  // Simple HTML report template
  const html = `<!DOCTYPE html>
<html>
<head>
    <title>KGEN Reproducibility Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .metric { background: #f5f5f5; padding: 20px; margin: 10px 0; border-radius: 5px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 8px; border: 1px solid #ddd; text-align: left; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <h1>KGEN Reproducibility Report</h1>
    <p>Generated: ${data.metadata.generatedAt}</p>
    <p>Period: ${data.metadata.period}</p>
    
    <div class="metric">
        <h3>Summary</h3>
        <p>Average Reproducibility: ${data.summary.avgReproducibility.toFixed(2)}%</p>
        <p>Average Execution Time: ${data.summary.avgExecutionTime.toFixed(0)}ms</p>
        <p>Total Cycles: ${data.summary.totalCycles}</p>
    </div>

    <h3>Operation Analysis</h3>
    <table>
        <thead>
            <tr><th>Operation</th><th>Avg Score</th><th>Avg Time</th><th>Reliability</th></tr>
        </thead>
        <tbody>
            ${Object.keys(data.operations).map(op => `
                <tr>
                    <td>${op}</td>
                    <td>${data.operations[op].avgScore.toFixed(2)}%</td>
                    <td>${data.operations[op].avgTime.toFixed(0)}ms</td>
                    <td>${data.operations[op].reliability.toFixed(2)}%</td>
                </tr>
            `).join('')}
        </tbody>
    </table>
</body>
</html>`;

  await fs.writeFile(outputPath, html);
}

async function generateMarkdownReport(data, outputPath) {
  const markdown = `# KGEN Reproducibility Report

**Generated:** ${data.metadata.generatedAt}
**Period:** ${data.metadata.period}

## Summary

- **Average Reproducibility:** ${data.summary.avgReproducibility.toFixed(2)}%
- **Average Execution Time:** ${data.summary.avgExecutionTime.toFixed(0)}ms
- **Total Cycles:** ${data.summary.totalCycles}

## Operation Analysis

| Operation | Avg Score | Avg Time | Reliability |
|-----------|-----------|----------|-------------|
${Object.keys(data.operations).map(op => 
  `| ${op} | ${data.operations[op].avgScore.toFixed(2)}% | ${data.operations[op].avgTime.toFixed(0)}ms | ${data.operations[op].reliability.toFixed(2)}% |`
).join('\n')}

## Alert Summary

- **Total Alerts:** ${data.alerts.total}
- **High Severity:** ${data.alerts.bySeverity.high || 0}
- **Medium Severity:** ${data.alerts.bySeverity.medium || 0}
- **Low Severity:** ${data.alerts.bySeverity.low || 0}
`;

  await fs.writeFile(outputPath, markdown);
}

// Parse command line
program.parse();

export { program };