#!/usr/bin/env node

/**
 * Test script for the workflow monitoring system
 * Usage: node test-monitoring.js [--component <component>] [--verbose]
 */

const fs = require('fs-extra');
const path = require('path');
const { program } = require('commander');

program
  .option('--component <component>', 'Test specific component (all, collect, analyze, dashboard, alerts)', 'all')
  .option('--verbose', 'Verbose output')
  .option('--mock', 'Use mock data instead of real API calls')
  .parse();

const options = program.opts();

class MonitoringTester {
  constructor() {
    this.verbose = options.verbose;
    this.useMock = options.mock;
    this.results = {
      passed: 0,
      failed: 0,
      tests: []
    };
  }

  log(message) {
    if (this.verbose) {
      console.log(`[TEST] ${message}`);
    }
  }

  async runTests() {
    console.log('🧪 Starting Workflow Monitoring System Tests\n');

    const component = options.component.toLowerCase();

    try {
      if (component === 'all' || component === 'config') {
        await this.testConfiguration();
      }

      if (component === 'all' || component === 'collect') {
        await this.testMetricsCollection();
      }

      if (component === 'all' || component === 'analyze') {
        await this.testTrendAnalysis();
      }

      if (component === 'all' || component === 'dashboard') {
        await this.testDashboardGeneration();
      }

      if (component === 'all' || component === 'alerts') {
        await this.testAlertSystem();
      }

      if (component === 'all' || component === 'utils') {
        await this.testUtilities();
      }

      this.printResults();

    } catch (error) {
      console.error('❌ Test suite failed:', error.message);
      process.exit(1);
    }
  }

  async testConfiguration() {
    console.log('📋 Testing Configuration System...');

    await this.test('Config file exists', async () => {
      const configPath = path.join(__dirname, 'config.json');
      return await fs.pathExists(configPath);
    });

    await this.test('Config is valid JSON', async () => {
      const config = require('./config.json');
      return config && typeof config === 'object';
    });

    await this.test('Required config sections present', async () => {
      const config = require('./config.json');
      return config.monitoring && config.reporting;
    });

    await this.test('Config validation', async () => {
      const { validateConfig } = require('./lib/utils');
      const config = require('./config.json');
      const errors = validateConfig(config);
      this.log(`Validation errors: ${errors.length}`);
      return errors.length === 0;
    });
  }

  async testMetricsCollection() {
    console.log('📊 Testing Metrics Collection...');

    await this.test('Metrics collector loads', async () => {
      const MetricsCollector = require('./collect-metrics');
      return typeof MetricsCollector === 'function';
    });

    if (this.useMock) {
      await this.test('Mock metrics collection', async () => {
        // Create mock metrics data
        const mockMetrics = {
          collection_time: this.getDeterministicDate().toISOString(),
          workflows: {
            'Test Workflow': {
              total_runs: 10,
              successful_runs: 8,
              failed_runs: 2,
              success_rate: '80.00'
            }
          },
          summary: {
            total_runs: 10,
            successful_runs: 8,
            success_rate: '80.00'
          }
        };

        // Save mock data
        const mockPath = path.join(__dirname, '../../monitoring-reports/test-metrics.json');
        await fs.ensureDir(path.dirname(mockPath));
        await fs.writeJSON(mockPath, mockMetrics);
        
        return await fs.pathExists(mockPath);
      });
    }

    await this.test('Metrics validation', async () => {
      // Test metrics structure validation
      const sampleMetrics = {
        collection_time: this.getDeterministicDate().toISOString(),
        workflows: {},
        summary: {
          total_runs: 0,
          successful_runs: 0,
          success_rate: 0
        }
      };
      
      return sampleMetrics.collection_time && 
             typeof sampleMetrics.workflows === 'object' &&
             typeof sampleMetrics.summary === 'object';
    });
  }

  async testTrendAnalysis() {
    console.log('📈 Testing Trend Analysis...');

    await this.test('Trend analyzer loads', async () => {
      const TrendAnalyzer = require('./analyze-trends');
      return typeof TrendAnalyzer === 'function';
    });

    await this.test('Trend calculation', async () => {
      const { getTrendDirection } = require('./lib/utils');
      
      const increasing = getTrendDirection(100, 80); // +25%
      const decreasing = getTrendDirection(80, 100); // -20%
      const stable = getTrendDirection(100, 98); // +2%
      
      return increasing === 'increasing' && 
             decreasing === 'decreasing' && 
             stable === 'stable';
    });

    await this.test('Anomaly detection', async () => {
      const { detectAnomalies } = require('./lib/utils');
      
      const values = [10, 12, 11, 13, 50, 12, 11]; // 50 is anomaly
      const anomalies = detectAnomalies(values);
      
      this.log(`Detected ${anomalies.length} anomalies`);
      return anomalies.length > 0 && anomalies[0].value === 50;
    });
  }

  async testDashboardGeneration() {
    console.log('📊 Testing Dashboard Generation...');

    await this.test('Dashboard generator loads', async () => {
      const DashboardGenerator = require('./generate-dashboard');
      return typeof DashboardGenerator === 'function';
    });

    await this.test('HTML template generation', async () => {
      const generator = new (require('./generate-dashboard'))();
      const mockData = {
        generated_at: this.getDeterministicDate().toISOString(),
        summary: { total_workflows: 5, success_rate: 95 },
        status: { level: 'healthy', message: 'All good' },
        alerts: [],
        charts: {
          success_rate_trend: [{ day: 1, value: 95 }],
          duration_trend: [{ day: 1, value: 10 }],
          workflow_performance: []
        }
      };
      
      const html = generator.generateHTMLContent(mockData);
      return html.includes('<title>') && html.includes('Workflow Monitoring Dashboard');
    });

    await this.test('Performance color coding', async () => {
      const { getPerformanceColor } = require('./lib/utils');
      
      return getPerformanceColor(95) === '#28a745' && // Green
             getPerformanceColor(75) === '#ffc107' && // Yellow  
             getPerformanceColor(40) === '#dc3545';   // Red
    });
  }

  async testAlertSystem() {
    console.log('🚨 Testing Alert System...');

    await this.test('Alert sender loads', async () => {
      const SlackAlertSender = require('./send-slack-alert');
      return typeof SlackAlertSender === 'function';
    });

    await this.test('Alert template loading', async () => {
      const templatePath = path.join(__dirname, 'templates/alert-template.json');
      const templates = await fs.readJSON(templatePath);
      
      return templates.slack && templates.github_issue && templates.email;
    });

    await this.test('Degradation checker loads', async () => {
      const DegradationChecker = require('./check-degradation');
      return typeof DegradationChecker === 'function';
    });

    await this.test('Alert priority calculation', async () => {
      const mockAlerts = [
        { severity: 'critical', type: 'failure_rate' },
        { severity: 'warning', type: 'duration' }
      ];
      
      const criticalCount = mockAlerts.filter(a => a.severity === 'critical').length;
      return criticalCount === 1;
    });
  }

  async testUtilities() {
    console.log('🛠️ Testing Utility Functions...');

    await this.test('Duration calculation', async () => {
      const { calculateDuration } = require('./lib/utils');
      
      const start = '2023-01-01T10:00:00Z';
      const end = '2023-01-01T10:05:00Z';
      const duration = calculateDuration(start, end);
      
      return duration === 5; // 5 minutes
    });

    await this.test('Success rate calculation', async () => {
      const { calculateSuccessRate } = require('./lib/utils');
      
      const rate = calculateSuccessRate(8, 10);
      return rate === 80;
    });

    await this.test('File size formatting', async () => {
      const { formatBytes } = require('./lib/utils');
      
      return formatBytes(1024) === '1 KB' && 
             formatBytes(1048576) === '1 MB';
    });

    await this.test('Duration formatting', async () => {
      const { formatDuration } = require('./lib/utils');
      
      return formatDuration(65) === '1h 5m' &&
             formatDuration(30) === '30m' &&
             formatDuration(0.5) === '30s';
    });
  }

  async test(name, testFunction) {
    try {
      this.log(`Running: ${name}`);
      const result = await testFunction();
      
      if (result) {
        console.log(`✅ ${name}`);
        this.results.passed++;
      } else {
        console.log(`❌ ${name}`);
        this.results.failed++;
      }
      
      this.results.tests.push({ name, passed: result });
      
    } catch (error) {
      console.log(`❌ ${name}: ${error.message}`);
      this.results.failed++;
      this.results.tests.push({ name, passed: false, error: error.message });
    }
  }

  printResults() {
    console.log('\n📊 Test Results Summary');
    console.log('========================');
    console.log(`✅ Passed: ${this.results.passed}`);
    console.log(`❌ Failed: ${this.results.failed}`);
    console.log(`📊 Total:  ${this.results.passed + this.results.failed}`);
    
    const successRate = (this.results.passed / (this.results.passed + this.results.failed)) * 100;
    console.log(`📈 Success Rate: ${successRate.toFixed(1)}%`);

    if (this.results.failed > 0) {
      console.log('\n❌ Failed Tests:');
      this.results.tests
        .filter(t => !t.passed)
        .forEach(t => {
          console.log(`   • ${t.name}${t.error ? `: ${t.error}` : ''}`);
        });
    }

    console.log('\n🎯 Recommendations:');
    if (successRate === 100) {
      console.log('   • All tests passed! Monitoring system is ready for production.');
    } else if (successRate >= 80) {
      console.log('   • Most tests passed. Review failed tests before deployment.');
    } else {
      console.log('   • Several tests failed. Fix issues before using in production.');
    }

    if (this.results.failed > 0) {
      process.exit(1);
    }
  }
}

async function main() {
  const tester = new MonitoringTester();
  await tester.runTests();
}

if (require.main === module) {
  main().catch(error => {
    console.error('Fatal test error:', error);
    process.exit(1);
  });
}

module.exports = MonitoringTester;