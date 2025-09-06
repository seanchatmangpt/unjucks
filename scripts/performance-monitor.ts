#!/usr/bin/env tsx

/**
 * Real-time Performance Monitor for Unjucks CLI
 * Provides continuous monitoring and regression detection
 */

import { performance, PerformanceObserver } from 'node:perf_hooks';
import { execSync, spawn } from 'node:child_process';
import fs from 'fs-extra';
import path from 'path';
import { EventEmitter } from 'node:events';

interface PerformanceAlert {
  type: 'regression' | 'threshold' | 'error';
  metric: string;
  current: number;
  baseline: number;
  threshold: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: string;
  details: Record<string, any>;
}

interface MonitoringConfig {
  thresholds: {
    startupTime: number;
    memoryUsage: number;
    templateGeneration: number;
    errorRate: number;
  };
  alerting: {
    enabled: boolean;
    webhookUrl?: string;
    emailTo?: string[];
  };
  sampling: {
    interval: number; // minutes
    operations: string[];
  };
}

class PerformanceMonitor extends EventEmitter {
  private config: MonitoringConfig;
  private cliPath: string;
  private projectRoot: string;
  private alerts: PerformanceAlert[] = [];
  private baselines: Map<string, number> = new Map();
  private isMonitoring = false;

  constructor(config: Partial<MonitoringConfig> = {}) {
    super();
    
    this.projectRoot = process.cwd();
    this.cliPath = path.join(this.projectRoot, 'dist/cli.mjs');
    
    this.config = {
      thresholds: {
        startupTime: 300,     // ms
        memoryUsage: 100,     // MB
        templateGeneration: 1000, // ms
        errorRate: 5          // %
      },
      alerting: {
        enabled: true
      },
      sampling: {
        interval: 5,          // minutes
        operations: ['--version', 'list', 'help command citty']
      },
      ...config
    };

    this.loadBaselines();
  }

  /**
   * Load performance baselines from historical data
   */
  private async loadBaselines(): Promise<void> {
    try {
      const baselinePath = path.join(this.projectRoot, 'docs', 'performance-baselines.json');
      if (await fs.pathExists(baselinePath)) {
        const baselines = await fs.readJSON(baselinePath);
        Object.entries(baselines).forEach(([key, value]) => {
          this.baselines.set(key, value as number);
        });
        console.log(`📊 Loaded ${this.baselines.size} performance baselines`);
      }
    } catch (error) {
      console.log('⚠️  No performance baselines found, will establish new ones');
    }
  }

  /**
   * Save current baselines
   */
  private async saveBaselines(): Promise<void> {
    const baselines: Record<string, number> = {};
    this.baselines.forEach((value, key) => {
      baselines[key] = value;
    });

    const baselinePath = path.join(this.projectRoot, 'docs', 'performance-baselines.json');
    await fs.ensureDir(path.dirname(baselinePath));
    await fs.writeJSON(baselinePath, baselines, { spaces: 2 });
  }

  /**
   * Measure CLI operation performance
   */
  private async measureOperation(operation: string): Promise<{
    executionTime: number;
    memoryUsage: number;
    success: boolean;
    error?: string;
  }> {
    const initialMemory = process.memoryUsage();
    const startTime = performance.now();
    
    try {
      execSync(`node ${this.cliPath} ${operation}`, {
        stdio: 'pipe',
        timeout: 10000,
        cwd: this.projectRoot
      });

      const endTime = performance.now();
      const finalMemory = process.memoryUsage();
      
      return {
        executionTime: endTime - startTime,
        memoryUsage: (finalMemory.rss - initialMemory.rss) / 1024 / 1024,
        success: true
      };
    } catch (error: any) {
      const endTime = performance.now();
      return {
        executionTime: endTime - startTime,
        memoryUsage: 0,
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Check if metric exceeds thresholds
   */
  private checkThresholds(metric: string, value: number): PerformanceAlert | null {
    let threshold = 0;
    let baseline = this.baselines.get(metric) || 0;

    switch (metric) {
      case 'startupTime':
        threshold = this.config.thresholds.startupTime;
        break;
      case 'memoryUsage':
        threshold = this.config.thresholds.memoryUsage;
        break;
      case 'templateGeneration':
        threshold = this.config.thresholds.templateGeneration;
        break;
      default:
        return null;
    }

    // Check absolute threshold
    if (value > threshold) {
      return {
        type: 'threshold',
        metric,
        current: value,
        baseline,
        threshold,
        severity: value > threshold * 2 ? 'critical' : value > threshold * 1.5 ? 'high' : 'medium',
        timestamp: new Date().toISOString(),
        details: { thresholdType: 'absolute' }
      };
    }

    // Check regression (>20% worse than baseline)
    if (baseline > 0 && value > baseline * 1.2) {
      return {
        type: 'regression',
        metric,
        current: value,
        baseline,
        threshold,
        severity: value > baseline * 2 ? 'critical' : value > baseline * 1.5 ? 'high' : 'medium',
        timestamp: new Date().toISOString(),
        details: { regressionPercentage: ((value - baseline) / baseline * 100).toFixed(2) }
      };
    }

    return null;
  }

  /**
   * Process performance alert
   */
  private async handleAlert(alert: PerformanceAlert): Promise<void> {
    this.alerts.push(alert);
    this.emit('alert', alert);

    console.log(`🚨 PERFORMANCE ALERT [${alert.severity.toUpperCase()}]`);
    console.log(`   Metric: ${alert.metric}`);
    console.log(`   Current: ${alert.current.toFixed(2)} (Baseline: ${alert.baseline.toFixed(2)}, Threshold: ${alert.threshold.toFixed(2)})`);
    
    if (alert.details.regressionPercentage) {
      console.log(`   Regression: ${alert.details.regressionPercentage}%`);
    }

    // Save alert to file
    const alertPath = path.join(this.projectRoot, 'reports', 'performance-alerts.json');
    await fs.ensureDir(path.dirname(alertPath));
    await fs.writeJSON(alertPath, this.alerts, { spaces: 2 });

    // TODO: Implement webhook/email notifications
    if (this.config.alerting.enabled && alert.severity === 'critical') {
      console.log('📧 Critical alert would trigger notification (not implemented)');
    }
  }

  /**
   * Update performance baselines with current measurements
   */
  private updateBaselines(metric: string, value: number): void {
    const currentBaseline = this.baselines.get(metric) || value;
    
    // Use exponential moving average to smooth baseline updates
    const alpha = 0.1; // Smoothing factor
    const newBaseline = alpha * value + (1 - alpha) * currentBaseline;
    
    this.baselines.set(metric, newBaseline);
  }

  /**
   * Run a single monitoring cycle
   */
  private async runMonitoringCycle(): Promise<void> {
    console.log('🔍 Running monitoring cycle...');
    
    for (const operation of this.config.sampling.operations) {
      try {
        const result = await this.measureOperation(operation);
        
        if (result.success) {
          // Check startup time
          const alert = this.checkThresholds('startupTime', result.executionTime);
          if (alert) {
            await this.handleAlert(alert);
          } else {
            this.updateBaselines('startupTime', result.executionTime);
          }

          // Check memory usage
          if (Math.abs(result.memoryUsage) > 0) {
            const memAlert = this.checkThresholds('memoryUsage', Math.abs(result.memoryUsage));
            if (memAlert) {
              await this.handleAlert(memAlert);
            } else {
              this.updateBaselines('memoryUsage', Math.abs(result.memoryUsage));
            }
          }

          console.log(`   ✅ ${operation}: ${result.executionTime.toFixed(2)}ms, ${Math.abs(result.memoryUsage).toFixed(2)}MB`);
        } else {
          console.log(`   ❌ ${operation}: Failed - ${result.error}`);
          
          // Track error rate (simplified)
          await this.handleAlert({
            type: 'error',
            metric: 'errorRate',
            current: 100,
            baseline: 0,
            threshold: this.config.thresholds.errorRate,
            severity: 'high',
            timestamp: new Date().toISOString(),
            details: { operation, error: result.error }
          });
        }
      } catch (error) {
        console.error(`   💥 Failed to monitor operation '${operation}':`, error);
      }

      // Brief delay between operations
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Save updated baselines
    await this.saveBaselines();
  }

  /**
   * Start continuous monitoring
   */
  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) {
      console.log('⚠️  Monitoring already running');
      return;
    }

    console.log('🚀 Starting performance monitoring...');
    console.log(`📊 Sampling every ${this.config.sampling.interval} minutes`);
    console.log(`🎯 Monitoring operations: ${this.config.sampling.operations.join(', ')}`);
    
    this.isMonitoring = true;

    // Run initial cycle
    await this.runMonitoringCycle();

    // Schedule periodic monitoring
    const intervalMs = this.config.sampling.interval * 60 * 1000;
    const intervalId = setInterval(async () => {
      if (!this.isMonitoring) {
        clearInterval(intervalId);
        return;
      }
      await this.runMonitoringCycle();
    }, intervalMs);

    console.log('✅ Performance monitoring started');
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    this.isMonitoring = false;
    console.log('🛑 Performance monitoring stopped');
  }

  /**
   * Generate monitoring report
   */
  async generateReport(): Promise<void> {
    const report = {
      timestamp: new Date().toISOString(),
      baselines: Object.fromEntries(this.baselines),
      alerts: this.alerts,
      config: this.config,
      summary: {
        totalAlerts: this.alerts.length,
        criticalAlerts: this.alerts.filter(a => a.severity === 'critical').length,
        highAlerts: this.alerts.filter(a => a.severity === 'high').length,
        mediumAlerts: this.alerts.filter(a => a.severity === 'medium').length,
        lowAlerts: this.alerts.filter(a => a.severity === 'low').length
      }
    };

    const reportPath = path.join(this.projectRoot, 'reports', `performance-monitoring-${Date.now()}.json`);
    await fs.ensureDir(path.dirname(reportPath));
    await fs.writeJSON(reportPath, report, { spaces: 2 });

    console.log(`📋 Monitoring report saved to: ${reportPath}`);
  }

  /**
   * Establish performance baselines from multiple measurements
   */
  async establishBaselines(iterations = 10): Promise<void> {
    console.log('📏 Establishing performance baselines...');
    
    const measurements: Record<string, number[]> = {};

    for (let i = 0; i < iterations; i++) {
      console.log(`   📊 Baseline measurement ${i + 1}/${iterations}`);
      
      for (const operation of this.config.sampling.operations) {
        if (!measurements[operation]) {
          measurements[operation] = [];
        }

        const result = await this.measureOperation(operation);
        if (result.success) {
          measurements[operation].push(result.executionTime);
        }

        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    // Calculate and store baselines
    Object.entries(measurements).forEach(([operation, times]) => {
      if (times.length > 0) {
        const average = times.reduce((a, b) => a + b, 0) / times.length;
        this.baselines.set(`${operation}_baseline`, average);
        console.log(`   📊 ${operation}: ${average.toFixed(2)}ms baseline established`);
      }
    });

    await this.saveBaselines();
    console.log('✅ Performance baselines established');
  }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2] || 'monitor';
  
  const monitor = new PerformanceMonitor({
    sampling: {
      interval: 1, // 1 minute for testing
      operations: ['--version', 'list', 'help command citty']
    }
  });

  // Handle alerts
  monitor.on('alert', (alert: PerformanceAlert) => {
    console.log(`🔔 Alert emitted: ${alert.type} for ${alert.metric}`);
  });

  switch (command) {
    case 'baseline':
      monitor.establishBaselines(5).catch(console.error);
      break;
    
    case 'monitor':
      monitor.startMonitoring().catch(console.error);
      
      // Run for a specific duration in test mode
      if (process.argv.includes('--test')) {
        setTimeout(() => {
          monitor.stopMonitoring();
          monitor.generateReport().then(() => process.exit(0));
        }, 10000); // 10 seconds for testing
      }
      break;
    
    case 'report':
      monitor.generateReport().catch(console.error);
      break;
      
    default:
      console.log('Usage: tsx performance-monitor.ts [baseline|monitor|report] [--test]');
      break;
  }
}

export { PerformanceMonitor };