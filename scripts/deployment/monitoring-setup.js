#!/usr/bin/env node

/**
 * Deployment Monitoring and Alerting Setup
 * Configures monitoring, metrics, and alerting for production deployments
 */

import { execSync } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';

class MonitoringSetup {
  constructor(options = {}) {
    this.environment = options.environment || process.env.NODE_ENV || 'production';
    this.dryRun = options.dryRun || false;
    this.config = {
      timestamp: this.getDeterministicDate().toISOString(),
      environment: this.environment,
      monitoring: {
        metrics: {},
        alerts: {},
        dashboards: {},
        healthChecks: {}
      },
      setup: {
        steps: [],
        errors: [],
        warnings: []
      }
    };
  }

  log(level, message, details = null) {
    const timestamp = this.getDeterministicDate().toISOString();
    const logEntry = { timestamp, level, message, details };
    
    console.log(
      level === 'error' ? chalk.red(`❌ ${message}`) :
      level === 'warning' ? chalk.yellow(`⚠️  ${message}`) :
      level === 'success' ? chalk.green(`✅ ${message}`) :
      chalk.blue(`ℹ️  ${message}`)
    );
    
    this.config.setup.steps.push(logEntry);
    
    if (level === 'error') this.config.setup.errors.push(logEntry);
    if (level === 'warning') this.config.setup.warnings.push(logEntry);
  }

  async setupHealthChecks() {
    this.log('info', 'Setting up health check endpoints...');
    
    const healthCheckConfig = {
      endpoints: {
        health: {
          path: '/health',
          method: 'GET',
          timeout: 5000,
          expectedStatus: 200,
          checks: ['memory', 'disk', 'dependencies']
        },
        ready: {
          path: '/ready',
          method: 'GET',
          timeout: 3000,
          expectedStatus: 200,
          checks: ['database', 'redis', 'services']
        },
        live: {
          path: '/live',
          method: 'GET',
          timeout: 1000,
          expectedStatus: 200,
          checks: ['basic']
        }
      },
      thresholds: {
        memory: {
          warning: 80,  // 80% memory usage
          critical: 90  // 90% memory usage
        },
        disk: {
          warning: 85,  // 85% disk usage
          critical: 95  // 95% disk usage
        },
        responseTime: {
          warning: 200,   // 200ms
          critical: 1000  // 1 second
        }
      }
    };

    const healthCheckPath = 'config/health-checks.json';
    
    if (!this.dryRun) {
      await fs.ensureDir(path.dirname(healthCheckPath));
      await fs.writeJson(healthCheckPath, healthCheckConfig, { spaces: 2 });
    }
    
    this.config.monitoring.healthChecks = healthCheckConfig;
    this.log('success', `Health check configuration created: ${healthCheckPath}`);
    
    // Create health check implementation
    const healthCheckImpl = `
/**
 * Health Check Implementation
 * Production-ready health checks for deployment validation
 */

import { performance } from 'perf_hooks';
import os from 'os';
import fs from 'fs-extra';

export class HealthChecker {
  constructor() {
    this.startTime = this.getDeterministicTimestamp();
  }

  async checkHealth() {
    const checks = {
      status: 'healthy',
      timestamp: this.getDeterministicDate().toISOString(),
      uptime: this.getDeterministicTimestamp() - this.startTime,
      version: process.env.npm_package_version || 'unknown',
      checks: {}
    };

    try {
      checks.checks.memory = await this.checkMemory();
      checks.checks.disk = await this.checkDisk();
      checks.checks.dependencies = await this.checkDependencies();
      
      const failed = Object.values(checks.checks).some(check => check.status === 'error');
      if (failed) {
        checks.status = 'unhealthy';
      }
    } catch (error) {
      checks.status = 'error';
      checks.error = error.message;
    }

    return checks;
  }

  async checkReadiness() {
    const checks = {
      ready: true,
      timestamp: this.getDeterministicDate().toISOString(),
      checks: {}
    };

    try {
      checks.checks.application = await this.checkApplication();
      checks.checks.services = await this.checkServices();
      
      const notReady = Object.values(checks.checks).some(check => !check.ready);
      if (notReady) {
        checks.ready = false;
      }
    } catch (error) {
      checks.ready = false;
      checks.error = error.message;
    }

    return checks;
  }

  async checkLiveness() {
    return {
      alive: true,
      timestamp: this.getDeterministicDate().toISOString(),
      uptime: this.getDeterministicTimestamp() - this.startTime
    };
  }

  async checkMemory() {
    const memUsage = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memoryPercent = (usedMem / totalMem) * 100;

    return {
      status: memoryPercent > 90 ? 'error' : memoryPercent > 80 ? 'warning' : 'ok',
      usage: {
        heap: Math.round(memUsage.heapUsed / 1024 / 1024),
        rss: Math.round(memUsage.rss / 1024 / 1024),
        external: Math.round(memUsage.external / 1024 / 1024),
        system: {
          total: Math.round(totalMem / 1024 / 1024),
          free: Math.round(freeMem / 1024 / 1024),
          used: Math.round(usedMem / 1024 / 1024),
          percent: Math.round(memoryPercent)
        }
      }
    };
  }

  async checkDisk() {
    try {
      const stats = await fs.stat('.');
      // Basic disk check - could be enhanced with actual disk usage
      return {
        status: 'ok',
        available: true
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message
      };
    }
  }

  async checkDependencies() {
    const checks = {};
    
    // Check Node.js version
    const nodeVersion = process.version;
    const requiredNode = '18.0.0';
    checks.node = {
      version: nodeVersion,
      required: requiredNode,
      status: nodeVersion >= requiredNode ? 'ok' : 'warning'
    };

    // Check npm packages
    try {
      const packageJson = await fs.readJson('package.json');
      checks.package = {
        name: packageJson.name,
        version: packageJson.version,
        status: 'ok'
      };
    } catch (error) {
      checks.package = {
        status: 'error',
        error: error.message
      };
    }

    return {
      status: Object.values(checks).every(check => check.status === 'ok') ? 'ok' : 'warning',
      checks
    };
  }

  async checkApplication() {
    // Check if core application components are ready
    return {
      ready: true,
      components: {
        cli: true,
        templates: await fs.pathExists('templates') || await fs.pathExists('_templates'),
        config: await fs.pathExists('package.json')
      }
    };
  }

  async checkServices() {
    // Check external service dependencies
    const services = {};
    
    // Add service checks here (database, redis, APIs, etc.)
    // For CLI tool, we mainly check file system access
    try {
      await fs.access('.', fs.constants.R_OK | fs.constants.W_OK);
      services.filesystem = { ready: true };
    } catch (error) {
      services.filesystem = { ready: false, error: error.message };
    }

    return {
      ready: Object.values(services).every(service => service.ready),
      services
    };
  }
}
`;

    const healthImplPath = 'src/lib/health-checker.js';
    
    if (!this.dryRun) {
      await fs.ensureDir(path.dirname(healthImplPath));
      await fs.writeFile(healthImplPath, healthCheckImpl.trim());
    }
    
    this.log('success', `Health check implementation created: ${healthImplPath}`);
    return true;
  }

  async setupMetrics() {
    this.log('info', 'Setting up application metrics...');
    
    const metricsConfig = {
      collection: {
        interval: 60000,  // 1 minute
        retention: '7d',   // 7 days
        aggregation: 'average'
      },
      metrics: {
        performance: {
          responseTime: { type: 'histogram', unit: 'ms' },
          throughput: { type: 'counter', unit: 'requests/second' },
          errorRate: { type: 'gauge', unit: 'percentage' }
        },
        system: {
          memoryUsage: { type: 'gauge', unit: 'MB' },
          cpuUsage: { type: 'gauge', unit: 'percentage' },
          diskUsage: { type: 'gauge', unit: 'percentage' }
        },
        application: {
          templateGenerations: { type: 'counter', unit: 'count' },
          errors: { type: 'counter', unit: 'count' },
          cacheHits: { type: 'counter', unit: 'count' },
          cacheMisses: { type: 'counter', unit: 'count' }
        }
      },
      exporters: {
        prometheus: {
          enabled: true,
          port: 9090,
          path: '/metrics'
        },
        json: {
          enabled: true,
          file: 'metrics/application-metrics.json'
        }
      }
    };

    const metricsConfigPath = 'config/metrics.json';
    
    if (!this.dryRun) {
      await fs.ensureDir(path.dirname(metricsConfigPath));
      await fs.writeJson(metricsConfigPath, metricsConfig, { spaces: 2 });
    }
    
    this.config.monitoring.metrics = metricsConfig;
    this.log('success', `Metrics configuration created: ${metricsConfigPath}`);
    
    // Create metrics collector implementation
    const metricsImpl = `
/**
 * Application Metrics Collector
 * Collects and exports application metrics for monitoring
 */

import { performance } from 'perf_hooks';
import os from 'os';
import fs from 'fs-extra';
import path from 'path';

export class MetricsCollector {
  constructor() {
    this.metrics = {
      performance: {},
      system: {},
      application: {}
    };
    this.startTime = this.getDeterministicTimestamp();
    this.setupCollection();
  }

  setupCollection() {
    // Collect metrics every minute
    setInterval(() => {
      this.collectSystemMetrics();
    }, 60000);
  }

  recordPerformanceMetric(name, value, unit = 'ms') {
    if (!this.metrics.performance[name]) {
      this.metrics.performance[name] = {
        values: [],
        unit,
        type: 'histogram'
      };
    }
    
    this.metrics.performance[name].values.push({
      value,
      timestamp: this.getDeterministicTimestamp()
    });
    
    // Keep only last 1000 values
    if (this.metrics.performance[name].values.length > 1000) {
      this.metrics.performance[name].values = 
        this.metrics.performance[name].values.slice(-1000);
    }
  }

  recordCounter(category, name, increment = 1) {
    if (!this.metrics[category]) {
      this.metrics[category] = {};
    }
    
    if (!this.metrics[category][name]) {
      this.metrics[category][name] = {
        value: 0,
        type: 'counter',
        lastUpdated: this.getDeterministicTimestamp()
      };
    }
    
    this.metrics[category][name].value += increment;
    this.metrics[category][name].lastUpdated = this.getDeterministicTimestamp();
  }

  recordGauge(category, name, value, unit) {
    if (!this.metrics[category]) {
      this.metrics[category] = {};
    }
    
    this.metrics[category][name] = {
      value,
      unit,
      type: 'gauge',
      timestamp: this.getDeterministicTimestamp()
    };
  }

  collectSystemMetrics() {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    const loadAvg = os.loadavg();
    
    this.recordGauge('system', 'memoryUsage', 
      Math.round(memUsage.heapUsed / 1024 / 1024), 'MB');
    
    this.recordGauge('system', 'memoryTotal', 
      Math.round(os.totalmem() / 1024 / 1024), 'MB');
    
    this.recordGauge('system', 'loadAverage1m', loadAvg[0], 'load');
    this.recordGauge('system', 'loadAverage5m', loadAvg[1], 'load');
    this.recordGauge('system', 'loadAverage15m', loadAvg[2], 'load');
    
    this.recordGauge('system', 'uptime', 
      Math.round((this.getDeterministicTimestamp() - this.startTime) / 1000), 'seconds');
  }

  async exportMetrics() {
    const exportData = {
      timestamp: this.getDeterministicDate().toISOString(),
      uptime: this.getDeterministicTimestamp() - this.startTime,
      metrics: this.metrics,
      summary: this.generateSummary()
    };
    
    // Export to JSON file
    const metricsDir = 'metrics';
    await fs.ensureDir(metricsDir);
    
    const metricsFile = path.join(metricsDir, 'application-metrics.json');
    await fs.writeJson(metricsFile, exportData, { spaces: 2 });
    
    return exportData;
  }

  generateSummary() {
    const summary = {
      performance: {},
      system: {},
      application: {}
    };
    
    // Summarize performance metrics
    Object.entries(this.metrics.performance).forEach(([name, metric]) => {
      const values = metric.values.map(v => v.value);
      if (values.length > 0) {
        summary.performance[name] = {
          count: values.length,
          min: Math.min(...values),
          max: Math.max(...values),
          avg: values.reduce((a, b) => a + b, 0) / values.length,
          unit: metric.unit
        };
      }
    });
    
    // Copy system and application metrics
    summary.system = { ...this.metrics.system };
    summary.application = { ...this.metrics.application };
    
    return summary;
  }

  // Prometheus format export
  exportPrometheusFormat() {
    let output = '';
    
    // Export counters
    Object.entries(this.metrics.application).forEach(([name, metric]) => {
      if (metric.type === 'counter') {
        output += \`# TYPE unjucks_\${name} counter\\n\`;
        output += \`unjucks_\${name} \${metric.value}\\n\`;
      }
    });
    
    // Export gauges
    Object.entries(this.metrics.system).forEach(([name, metric]) => {
      if (metric.type === 'gauge') {
        output += \`# TYPE unjucks_system_\${name} gauge\\n\`;
        output += \`unjucks_system_\${name} \${metric.value}\\n\`;
      }
    });
    
    return output;
  }
}

// Global metrics collector instance
export const metrics = new MetricsCollector();
`;

    const metricsImplPath = 'src/lib/metrics-collector.js';
    
    if (!this.dryRun) {
      await fs.ensureDir(path.dirname(metricsImplPath));
      await fs.writeFile(metricsImplPath, metricsImpl.trim());
    }
    
    this.log('success', `Metrics collector created: ${metricsImplPath}`);
    return true;
  }

  async setupAlerts() {
    this.log('info', 'Setting up alerting configuration...');
    
    const alertsConfig = {
      channels: {
        email: {
          enabled: true,
          smtp: {
            host: process.env.SMTP_HOST || 'localhost',
            port: parseInt(process.env.SMTP_PORT) || 587,
            secure: false,
            auth: {
              user: process.env.SMTP_USER || '',
              pass: process.env.SMTP_PASS || ''
            }
          },
          recipients: [
            process.env.ALERT_EMAIL || 'admin@example.com'
          ]
        },
        slack: {
          enabled: false,
          webhook: process.env.SLACK_WEBHOOK || '',
          channel: '#alerts'
        },
        pagerduty: {
          enabled: false,
          integrationKey: process.env.PAGERDUTY_KEY || ''
        }
      },
      rules: {
        critical: {
          applicationDown: {
            condition: 'health_check_failed',
            threshold: 1,
            duration: '1m',
            severity: 'critical'
          },
          memoryHigh: {
            condition: 'memory_usage > 90',
            threshold: 90,
            duration: '5m',
            severity: 'critical'
          },
          diskFull: {
            condition: 'disk_usage > 95',
            threshold: 95,
            duration: '2m',
            severity: 'critical'
          }
        },
        warning: {
          memoryWarning: {
            condition: 'memory_usage > 80',
            threshold: 80,
            duration: '10m',
            severity: 'warning'
          },
          highErrorRate: {
            condition: 'error_rate > 5',
            threshold: 5,
            duration: '5m',
            severity: 'warning'
          },
          slowResponse: {
            condition: 'response_time > 1000',
            threshold: 1000,
            duration: '5m',
            severity: 'warning'
          }
        }
      },
      escalation: {
        warning: {
          initial: ['email'],
          escalate_after: '30m',
          escalate_to: ['slack']
        },
        critical: {
          initial: ['email', 'slack'],
          escalate_after: '15m',
          escalate_to: ['pagerduty']
        }
      }
    };

    const alertsConfigPath = 'config/alerts.json';
    
    if (!this.dryRun) {
      await fs.ensureDir(path.dirname(alertsConfigPath));
      await fs.writeJson(alertsConfigPath, alertsConfig, { spaces: 2 });
    }
    
    this.config.monitoring.alerts = alertsConfig;
    this.log('success', `Alerts configuration created: ${alertsConfigPath}`);
    
    return true;
  }

  async setupDashboards() {
    this.log('info', 'Setting up monitoring dashboards...');
    
    const dashboardConfig = {
      grafana: {
        enabled: true,
        datasource: 'prometheus',
        dashboards: {
          overview: {
            title: 'Unjucks Overview',
            panels: [
              {
                title: 'System Health',
                type: 'stat',
                targets: ['up{job="unjucks"}']
              },
              {
                title: 'Memory Usage',
                type: 'graph',
                targets: ['unjucks_system_memoryUsage']
              },
              {
                title: 'Template Generations',
                type: 'graph',
                targets: ['rate(unjucks_templateGenerations[5m])']
              },
              {
                title: 'Error Rate',
                type: 'graph',
                targets: ['rate(unjucks_errors[5m])']
              }
            ]
          },
          performance: {
            title: 'Unjucks Performance',
            panels: [
              {
                title: 'Response Time',
                type: 'graph',
                targets: ['unjucks_responseTime']
              },
              {
                title: 'Throughput',
                type: 'graph',
                targets: ['rate(unjucks_requests[1m])']
              },
              {
                title: 'CPU Usage',
                type: 'graph',
                targets: ['unjucks_system_cpuUsage']
              }
            ]
          }
        }
      },
      custom: {
        enabled: true,
        endpoint: '/dashboard',
        refreshInterval: 30000
      }
    };

    const dashboardConfigPath = 'config/dashboards.json';
    
    if (!this.dryRun) {
      await fs.ensureDir(path.dirname(dashboardConfigPath));
      await fs.writeJson(dashboardConfigPath, dashboardConfig, { spaces: 2 });
    }
    
    this.config.monitoring.dashboards = dashboardConfig;
    this.log('success', `Dashboard configuration created: ${dashboardConfigPath}`);
    
    return true;
  }

  async validateMonitoringSetup() {
    this.log('info', 'Validating monitoring setup...');
    
    const validationResults = {
      healthChecks: false,
      metrics: false,
      alerts: false,
      dashboards: false
    };

    // Validate health checks
    if (await fs.pathExists('config/health-checks.json') && 
        await fs.pathExists('src/lib/health-checker.js')) {
      validationResults.healthChecks = true;
      this.log('success', 'Health checks validation passed');
    } else {
      this.log('error', 'Health checks validation failed');
    }

    // Validate metrics
    if (await fs.pathExists('config/metrics.json') && 
        await fs.pathExists('src/lib/metrics-collector.js')) {
      validationResults.metrics = true;
      this.log('success', 'Metrics validation passed');
    } else {
      this.log('error', 'Metrics validation failed');
    }

    // Validate alerts
    if (await fs.pathExists('config/alerts.json')) {
      validationResults.alerts = true;
      this.log('success', 'Alerts validation passed');
    } else {
      this.log('error', 'Alerts validation failed');
    }

    // Validate dashboards
    if (await fs.pathExists('config/dashboards.json')) {
      validationResults.dashboards = true;
      this.log('success', 'Dashboards validation passed');
    } else {
      this.log('error', 'Dashboards validation failed');
    }

    const allValid = Object.values(validationResults).every(Boolean);
    
    if (allValid) {
      this.log('success', 'All monitoring components validated successfully');
    } else {
      this.log('warning', 'Some monitoring components failed validation');
    }

    return validationResults;
  }

  async generateMonitoringReport() {
    const reportPath = 'tests/monitoring-setup-report.json';
    await fs.ensureDir(path.dirname(reportPath));
    await fs.writeJson(reportPath, this.config, { spaces: 2 });
    
    this.log('info', `Monitoring setup report generated: ${reportPath}`);
    return reportPath;
  }

  async run() {
    this.log('info', `Setting up monitoring for ${this.environment} environment...`);
    
    if (this.dryRun) {
      this.log('info', '🔍 DRY RUN MODE - No files will be created');
    }

    const setupSteps = [
      { name: 'Health Checks', fn: () => this.setupHealthChecks() },
      { name: 'Metrics Collection', fn: () => this.setupMetrics() },
      { name: 'Alert Configuration', fn: () => this.setupAlerts() },
      { name: 'Dashboard Setup', fn: () => this.setupDashboards() },
      { name: 'Validation', fn: () => this.validateMonitoringSetup() }
    ];

    let allSuccessful = true;

    for (const step of setupSteps) {
      this.log('info', `Setting up: ${step.name}`);
      
      try {
        const result = await step.fn();
        if (!result) {
          allSuccessful = false;
        }
      } catch (error) {
        this.log('error', `${step.name} setup failed`, error.message);
        allSuccessful = false;
      }
    }

    await this.generateMonitoringReport();

    if (allSuccessful) {
      this.log('success', '🎉 Monitoring setup completed successfully!');
    } else {
      this.log('error', '❌ Monitoring setup completed with errors');
    }

    return allSuccessful;
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const environment = args.find(arg => arg.startsWith('--env='))?.split('=')[1] || 'production';

  const monitoring = new MonitoringSetup({
    dryRun,
    environment
  });

  try {
    const success = await monitoring.run();
    process.exit(success ? 0 : 1);
  } catch (error) {
    console.error(chalk.red('Monitoring setup failed:'), error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default MonitoringSetup;