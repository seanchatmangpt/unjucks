#!/usr/bin/env node

/**
 * KGEN Reproducibility Real-Time Monitoring System
 * 
 * Provides continuous monitoring of reproducibility metrics with:
 * - Real-time drift detection
 * - Performance impact measurement
 * - Non-deterministic behavior analysis
 * - Automated alerting and reporting
 * 
 * Agent 11: Reproducibility Validation Engineer
 */

import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import { createHash } from 'crypto';
import { promises as fs, existsSync } from 'fs';
import { resolve, join } from 'path';
import { spawn } from 'child_process';

class ReproducibilityMonitor extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      monitoringInterval: 60000, // 1 minute
      alertThreshold: 95.0, // Alert if reproducibility drops below 95%
      performanceThreshold: 15, // Alert if performance degrades > 15%
      maxHistorySize: 1000,
      enableRealTimeAlerts: true,
      enableTrendAnalysis: true,
      enablePerformanceTracking: true,
      outputDirectory: './tests/reproducibility/reports',
      ...options
    };

    this.isMonitoring = false;
    this.monitoringTimer = null;
    this.metrics = {
      history: [],
      current: null,
      trends: {
        reproducibility: [],
        performance: [],
        errorRate: []
      },
      alerts: []
    };

    this.baseline = null;
    this.kgenOperations = [
      'graph hash',
      'graph index', 
      'artifact generate',
      'deterministic render',
      'project lock'
    ];
  }

  /**
   * Start continuous reproducibility monitoring
   */
  async startMonitoring() {
    if (this.isMonitoring) {
      throw new Error('Monitoring is already active');
    }

    try {
      // Initialize monitoring environment
      await this.initializeMonitoring();
      
      // Establish baseline if not exists
      if (!this.baseline) {
        this.baseline = await this.establishBaseline();
      }

      this.isMonitoring = true;
      
      // Start monitoring loop
      this.monitoringTimer = setInterval(() => {
        this.performMonitoringCycle().catch(error => {
          this.emit('monitoring-error', error);
        });
      }, this.options.monitoringInterval);

      // Initial monitoring cycle
      await this.performMonitoringCycle();

      this.emit('monitoring-started', {
        interval: this.options.monitoringInterval,
        baseline: this.baseline,
        operations: this.kgenOperations.length
      });

      return { success: true, message: 'Monitoring started successfully' };

    } catch (error) {
      this.emit('monitoring-failed', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Stop continuous monitoring
   */
  async stopMonitoring() {
    if (!this.isMonitoring) {
      return { success: true, message: 'Monitoring was not active' };
    }

    this.isMonitoring = false;
    
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = null;
    }

    // Generate final report
    const finalReport = await this.generateMonitoringReport();

    this.emit('monitoring-stopped', {
      duration: this.getMonitoringDuration(),
      totalCycles: this.metrics.history.length,
      finalReport
    });

    return { 
      success: true, 
      message: 'Monitoring stopped',
      report: finalReport
    };
  }

  /**
   * Initialize monitoring environment
   */
  async initializeMonitoring() {
    // Ensure output directory exists
    await fs.mkdir(this.options.outputDirectory, { recursive: true });

    // Create monitoring state file
    this.stateFile = join(this.options.outputDirectory, 'monitoring-state.json');
    
    // Load previous state if exists
    if (existsSync(this.stateFile)) {
      try {
        const state = JSON.parse(await fs.readFile(this.stateFile, 'utf8'));
        this.baseline = state.baseline;
        this.metrics.history = state.history?.slice(-this.options.maxHistorySize) || [];
      } catch (error) {
        // Ignore state loading errors, will create new state
      }
    }
  }

  /**
   * Establish baseline reproducibility metrics
   */
  async establishBaseline() {
    this.emit('baseline-establishing');

    const baseline = {
      timestamp: this.getDeterministicDate().toISOString(),
      environment: this.captureEnvironmentSnapshot(),
      operations: {},
      overallScore: 0,
      avgExecutionTime: 0
    };

    let totalScore = 0;
    let totalTime = 0;
    let operationCount = 0;

    // Test each core operation
    for (const operation of this.kgenOperations) {
      try {
        const operationBaseline = await this.measureOperationBaseline(operation);
        baseline.operations[operation] = operationBaseline;
        
        if (operationBaseline.reproducibilityScore !== null) {
          totalScore += operationBaseline.reproducibilityScore;
          totalTime += operationBaseline.avgExecutionTime;
          operationCount++;
        }
        
      } catch (error) {
        baseline.operations[operation] = {
          error: error.message,
          reproducibilityScore: null,
          avgExecutionTime: null
        };
      }
    }

    baseline.overallScore = operationCount > 0 ? totalScore / operationCount : 0;
    baseline.avgExecutionTime = operationCount > 0 ? totalTime / operationCount : 0;

    this.emit('baseline-established', baseline);

    return baseline;
  }

  /**
   * Measure baseline metrics for a specific operation
   */
  async measureOperationBaseline(operation) {
    const iterations = 5; // Quick baseline measurement
    const results = [];
    const executionTimes = [];

    // Create temporary test environment
    const testEnv = await this.createQuickTestEnvironment();

    try {
      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();
        
        const result = await this.executeOperation(operation, testEnv);
        
        const executionTime = performance.now() - startTime;
        executionTimes.push(executionTime);

        if (result.success) {
          results.push(this.calculateOutputHash(result.output));
        }
      }

      // Calculate reproducibility score
      const uniqueHashes = new Set(results);
      const reproducibilityScore = results.length > 0 
        ? (1 - (uniqueHashes.size - 1) / Math.max(1, results.length - 1)) * 100
        : null;

      const avgExecutionTime = executionTimes.length > 0
        ? executionTimes.reduce((a, b) => a + b) / executionTimes.length
        : null;

      return {
        reproducibilityScore,
        avgExecutionTime,
        iterations,
        uniqueHashes: uniqueHashes.size,
        executionTimes
      };

    } finally {
      // Cleanup test environment
      await this.cleanupQuickTestEnvironment(testEnv);
    }
  }

  /**
   * Perform a single monitoring cycle
   */
  async performMonitoringCycle() {
    const cycleStartTime = performance.now();
    
    this.emit('cycle-started', { 
      timestamp: this.getDeterministicDate().toISOString(),
      cycle: this.metrics.history.length + 1 
    });

    const cycle = {
      timestamp: this.getDeterministicDate().toISOString(),
      cycleNumber: this.metrics.history.length + 1,
      environment: this.captureEnvironmentSnapshot(),
      operations: {},
      metrics: {
        overallReproducibility: 0,
        avgExecutionTime: 0,
        errorRate: 0,
        performanceDelta: 0
      },
      alerts: [],
      duration: 0
    };

    let totalScore = 0;
    let totalTime = 0;
    let successCount = 0;
    let errorCount = 0;

    // Test each operation
    for (const operation of this.kgenOperations) {
      try {
        const operationMetrics = await this.measureOperationMetrics(operation);
        cycle.operations[operation] = operationMetrics;

        if (operationMetrics.success) {
          totalScore += operationMetrics.reproducibilityScore;
          totalTime += operationMetrics.avgExecutionTime;
          successCount++;
        } else {
          errorCount++;
        }

      } catch (error) {
        cycle.operations[operation] = {
          success: false,
          error: error.message,
          reproducibilityScore: 0,
          avgExecutionTime: 0
        };
        errorCount++;
      }
    }

    // Calculate cycle metrics
    cycle.metrics.overallReproducibility = successCount > 0 ? totalScore / successCount : 0;
    cycle.metrics.avgExecutionTime = successCount > 0 ? totalTime / successCount : 0;
    cycle.metrics.errorRate = (errorCount / this.kgenOperations.length) * 100;

    // Calculate performance delta from baseline
    if (this.baseline?.avgExecutionTime) {
      cycle.metrics.performanceDelta = 
        ((cycle.metrics.avgExecutionTime - this.baseline.avgExecutionTime) / this.baseline.avgExecutionTime) * 100;
    }

    cycle.duration = performance.now() - cycleStartTime;

    // Check for alerts
    cycle.alerts = this.checkForAlerts(cycle);

    // Update current metrics
    this.metrics.current = cycle;

    // Add to history
    this.metrics.history.push(cycle);
    if (this.metrics.history.length > this.options.maxHistorySize) {
      this.metrics.history.shift();
    }

    // Update trends
    this.updateTrends(cycle);

    // Save state
    await this.saveMonitoringState();

    // Emit events
    this.emit('cycle-completed', cycle);

    if (cycle.alerts.length > 0) {
      this.emit('alerts-triggered', cycle.alerts);
    }

    return cycle;
  }

  /**
   * Measure metrics for a specific operation
   */
  async measureOperationMetrics(operation) {
    const iterations = 3; // Quick monitoring measurement
    const results = [];
    const executionTimes = [];
    
    const testEnv = await this.createQuickTestEnvironment();

    try {
      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();
        
        const result = await this.executeOperation(operation, testEnv);
        
        const executionTime = performance.now() - startTime;
        executionTimes.push(executionTime);

        if (result.success) {
          results.push(this.calculateOutputHash(result.output));
        } else {
          throw new Error(result.error);
        }
      }

      // Calculate metrics
      const uniqueHashes = new Set(results);
      const reproducibilityScore = results.length > 0 
        ? (1 - (uniqueHashes.size - 1) / Math.max(1, results.length - 1)) * 100
        : 0;

      const avgExecutionTime = executionTimes.reduce((a, b) => a + b) / executionTimes.length;

      return {
        success: true,
        reproducibilityScore,
        avgExecutionTime,
        iterations,
        uniqueHashes: uniqueHashes.size,
        executionTimeVariance: this.calculateVariance(executionTimes)
      };

    } finally {
      await this.cleanupQuickTestEnvironment(testEnv);
    }
  }

  /**
   * Execute a KGEN operation for monitoring
   */
  async executeOperation(operation, testEnv) {
    const commands = {
      'graph hash': ['graph', 'hash', testEnv.testFile],
      'graph index': ['graph', 'index', testEnv.testFile],
      'artifact generate': ['artifact', 'generate', '-g', testEnv.testFile, '-t', 'test'],
      'deterministic render': ['deterministic', 'render', testEnv.templateFile],
      'project lock': ['project', 'lock', testEnv.directory]
    };

    const args = commands[operation];
    if (!args) {
      throw new Error(`Unknown operation: ${operation}`);
    }

    return new Promise((resolve) => {
      const child = spawn('node', ['./bin/kgen.mjs', ...args], {
        cwd: testEnv.directory,
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 10000 // 10s timeout for monitoring
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        resolve({
          success: code === 0,
          output: stdout,
          error: stderr || (code !== 0 ? `Exit code: ${code}` : null),
          exitCode: code
        });
      });

      child.on('error', (error) => {
        resolve({
          success: false,
          output: stdout,
          error: error.message,
          exitCode: -1
        });
      });
    });
  }

  /**
   * Create quick test environment for monitoring
   */
  async createQuickTestEnvironment() {
    const envId = `monitor-${this.getDeterministicTimestamp()}-${Math.random().toString(36).substr(2, 5)}`;
    const envDir = join(this.options.outputDirectory, 'temp', envId);
    
    await fs.mkdir(envDir, { recursive: true });

    // Create minimal test files
    const testFile = join(envDir, 'test.ttl');
    const templateFile = join(envDir, 'test.njk');
    const templatesDir = join(envDir, '_templates');
    
    await fs.mkdir(templatesDir, { recursive: true });

    // Simple test RDF
    const testRDF = `@prefix ex: <http://example.org/> .
ex:test ex:property "test-value" .`;
    
    await fs.writeFile(testFile, testRDF);

    // Simple test template
    const testTemplate = `Test output at {{ timestamp | default('2024-01-01T00:00:00.000Z') }}`;
    
    await fs.writeFile(templateFile, testTemplate);
    await fs.writeFile(join(templatesDir, 'test.njk'), testTemplate);

    return {
      directory: envDir,
      testFile,
      templateFile,
      cleanup: () => this.cleanupQuickTestEnvironment({ directory: envDir })
    };
  }

  /**
   * Cleanup quick test environment
   */
  async cleanupQuickTestEnvironment(testEnv) {
    try {
      await fs.rm(testEnv.directory, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  }

  /**
   * Check for alert conditions
   */
  checkForAlerts(cycle) {
    const alerts = [];

    // Reproducibility threshold alert
    if (cycle.metrics.overallReproducibility < this.options.alertThreshold) {
      alerts.push({
        type: 'reproducibility-degradation',
        severity: 'high',
        message: `Reproducibility dropped to ${cycle.metrics.overallReproducibility.toFixed(2)}% (threshold: ${this.options.alertThreshold}%)`,
        value: cycle.metrics.overallReproducibility,
        threshold: this.options.alertThreshold
      });
    }

    // Performance degradation alert
    if (Math.abs(cycle.metrics.performanceDelta) > this.options.performanceThreshold) {
      alerts.push({
        type: 'performance-degradation',
        severity: cycle.metrics.performanceDelta > 0 ? 'medium' : 'low',
        message: `Performance changed by ${cycle.metrics.performanceDelta.toFixed(2)}% (threshold: ±${this.options.performanceThreshold}%)`,
        value: cycle.metrics.performanceDelta,
        threshold: this.options.performanceThreshold
      });
    }

    // Error rate alert
    if (cycle.metrics.errorRate > 10) {
      alerts.push({
        type: 'high-error-rate',
        severity: 'high',
        message: `Error rate is ${cycle.metrics.errorRate.toFixed(2)}%`,
        value: cycle.metrics.errorRate,
        threshold: 10
      });
    }

    // Individual operation alerts
    Object.keys(cycle.operations).forEach(operation => {
      const opMetrics = cycle.operations[operation];
      if (opMetrics.success && opMetrics.reproducibilityScore < 90) {
        alerts.push({
          type: 'operation-reproducibility-issue',
          severity: 'medium',
          message: `Operation '${operation}' reproducibility: ${opMetrics.reproducibilityScore.toFixed(2)}%`,
          operation: operation,
          value: opMetrics.reproducibilityScore
        });
      }
    });

    // Add to alerts history
    this.metrics.alerts.push(...alerts);
    if (this.metrics.alerts.length > 100) {
      this.metrics.alerts = this.metrics.alerts.slice(-100);
    }

    return alerts;
  }

  /**
   * Update trend analysis
   */
  updateTrends(cycle) {
    const maxTrendSize = 50;

    // Update reproducibility trend
    this.metrics.trends.reproducibility.push({
      timestamp: cycle.timestamp,
      value: cycle.metrics.overallReproducibility
    });
    if (this.metrics.trends.reproducibility.length > maxTrendSize) {
      this.metrics.trends.reproducibility.shift();
    }

    // Update performance trend
    this.metrics.trends.performance.push({
      timestamp: cycle.timestamp,
      value: cycle.metrics.avgExecutionTime
    });
    if (this.metrics.trends.performance.length > maxTrendSize) {
      this.metrics.trends.performance.shift();
    }

    // Update error rate trend
    this.metrics.trends.errorRate.push({
      timestamp: cycle.timestamp,
      value: cycle.metrics.errorRate
    });
    if (this.metrics.trends.errorRate.length > maxTrendSize) {
      this.metrics.trends.errorRate.shift();
    }
  }

  /**
   * Generate comprehensive monitoring report
   */
  async generateMonitoringReport() {
    const report = {
      summary: {
        monitoringPeriod: this.getMonitoringPeriod(),
        totalCycles: this.metrics.history.length,
        avgReproducibility: this.calculateAverageReproducibility(),
        avgPerformance: this.calculateAveragePerformance(),
        totalAlerts: this.metrics.alerts.length,
        criticalAlerts: this.metrics.alerts.filter(a => a.severity === 'high').length
      },
      currentMetrics: this.metrics.current,
      trends: this.analyzeTrends(),
      alerts: {
        recent: this.metrics.alerts.slice(-20),
        bySeverity: this.groupAlertsBySeverity(),
        byType: this.groupAlertsByType()
      },
      operationAnalysis: this.analyzeOperationPerformance(),
      recommendations: this.generateRecommendations(),
      baseline: this.baseline,
      timestamp: this.getDeterministicDate().toISOString()
    };

    // Save report
    const reportPath = join(this.options.outputDirectory, `monitoring-report-${this.getDeterministicTimestamp()}.json`);
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

    // Generate dashboard
    const dashboardPath = join(this.options.outputDirectory, `monitoring-dashboard-${this.getDeterministicTimestamp()}.html`);
    await this.generateHTMLDashboard(report, dashboardPath);

    report.reportPath = reportPath;
    report.dashboardPath = dashboardPath;

    return report;
  }

  /**
   * Analyze trends for insights
   */
  analyzeTrends() {
    const trends = {};

    // Reproducibility trend analysis
    if (this.metrics.trends.reproducibility.length > 5) {
      const values = this.metrics.trends.reproducibility.map(point => point.value);
      trends.reproducibility = {
        direction: this.calculateTrendDirection(values),
        stability: this.calculateStability(values),
        recent: values.slice(-5),
        average: values.reduce((a, b) => a + b) / values.length
      };
    }

    // Performance trend analysis
    if (this.metrics.trends.performance.length > 5) {
      const values = this.metrics.trends.performance.map(point => point.value);
      trends.performance = {
        direction: this.calculateTrendDirection(values),
        stability: this.calculateStability(values),
        recent: values.slice(-5),
        average: values.reduce((a, b) => a + b) / values.length
      };
    }

    return trends;
  }

  /**
   * Calculate trend direction
   */
  calculateTrendDirection(values) {
    if (values.length < 3) return 'insufficient-data';
    
    const recent = values.slice(-5);
    const older = values.slice(-10, -5);
    
    if (older.length === 0) return 'insufficient-data';
    
    const recentAvg = recent.reduce((a, b) => a + b) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b) / older.length;
    
    const change = ((recentAvg - olderAvg) / olderAvg) * 100;
    
    if (Math.abs(change) < 2) return 'stable';
    return change > 0 ? 'improving' : 'degrading';
  }

  /**
   * Calculate stability metric
   */
  calculateStability(values) {
    if (values.length < 3) return 'insufficient-data';
    
    const variance = this.calculateVariance(values);
    const mean = values.reduce((a, b) => a + b) / values.length;
    const coefficientOfVariation = (Math.sqrt(variance) / mean) * 100;
    
    if (coefficientOfVariation < 5) return 'stable';
    if (coefficientOfVariation < 15) return 'moderate';
    return 'unstable';
  }

  /**
   * Analyze operation performance patterns
   */
  analyzeOperationPerformance() {
    const analysis = {};
    
    this.kgenOperations.forEach(operation => {
      const operationData = this.metrics.history
        .map(cycle => cycle.operations[operation])
        .filter(op => op && op.success);

      if (operationData.length > 0) {
        const scores = operationData.map(op => op.reproducibilityScore);
        const times = operationData.map(op => op.avgExecutionTime);

        analysis[operation] = {
          avgReproducibility: scores.reduce((a, b) => a + b) / scores.length,
          minReproducibility: Math.min(...scores),
          maxReproducibility: Math.max(...scores),
          avgExecutionTime: times.reduce((a, b) => a + b) / times.length,
          executionTimeVariance: this.calculateVariance(times),
          reliability: (operationData.length / this.metrics.history.length) * 100
        };
      }
    });

    return analysis;
  }

  /**
   * Generate monitoring recommendations
   */
  generateRecommendations() {
    const recommendations = [];
    
    // Check current reproducibility
    if (this.metrics.current?.metrics.overallReproducibility < 99) {
      recommendations.push({
        type: 'reproducibility-improvement',
        priority: 'high',
        message: 'Current reproducibility below 99%. Review non-deterministic sources.',
        action: 'Run full reproducibility validation to identify specific issues'
      });
    }

    // Check for performance trends
    const trends = this.analyzeTrends();
    if (trends.performance?.direction === 'degrading') {
      recommendations.push({
        type: 'performance-optimization',
        priority: 'medium',
        message: 'Performance showing degrading trend',
        action: 'Review recent changes and optimize slow operations'
      });
    }

    // Check for unstable operations
    const operationAnalysis = this.analyzeOperationPerformance();
    Object.keys(operationAnalysis).forEach(operation => {
      const analysis = operationAnalysis[operation];
      if (analysis.reliability < 90) {
        recommendations.push({
          type: 'operation-reliability',
          priority: 'high',
          message: `Operation '${operation}' has low reliability (${analysis.reliability.toFixed(1)}%)`,
          action: `Investigate and fix reliability issues with ${operation}`
        });
      }
    });

    return recommendations;
  }

  /**
   * Generate HTML dashboard
   */
  async generateHTMLDashboard(report, dashboardPath) {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>KGEN Reproducibility Monitor Dashboard</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { background: #2c3e50; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 20px; }
        .metric-card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .metric-value { font-size: 2em; font-weight: bold; color: #3498db; }
        .alert { padding: 10px; margin: 5px 0; border-radius: 4px; }
        .alert-high { background-color: #ffebee; border-left: 4px solid #f44336; }
        .alert-medium { background-color: #fff3e0; border-left: 4px solid #ff9800; }
        .alert-low { background-color: #e8f5e8; border-left: 4px solid #4caf50; }
        .trend-up { color: #4caf50; }
        .trend-down { color: #f44336; }
        .trend-stable { color: #2196f3; }
        table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔍 KGEN Reproducibility Monitor Dashboard</h1>
            <p>Real-time monitoring of KGEN reproducibility and performance metrics</p>
            <p><strong>Last Update:</strong> ${report.timestamp}</p>
        </div>

        <div class="metrics-grid">
            <div class="metric-card">
                <h3>Overall Reproducibility</h3>
                <div class="metric-value ${report.summary.avgReproducibility >= 99 ? 'trend-up' : 'trend-down'}">
                    ${report.summary.avgReproducibility.toFixed(1)}%
                </div>
                <p>Target: ≥99.9%</p>
            </div>
            <div class="metric-card">
                <h3>Average Performance</h3>
                <div class="metric-value trend-stable">
                    ${report.summary.avgPerformance.toFixed(0)}ms
                </div>
                <p>Execution time</p>
            </div>
            <div class="metric-card">
                <h3>Total Cycles</h3>
                <div class="metric-value trend-stable">
                    ${report.summary.totalCycles}
                </div>
                <p>Monitoring cycles</p>
            </div>
            <div class="metric-card">
                <h3>Active Alerts</h3>
                <div class="metric-value ${report.summary.criticalAlerts > 0 ? 'trend-down' : 'trend-up'}">
                    ${report.summary.totalAlerts}
                </div>
                <p>${report.summary.criticalAlerts} critical</p>
            </div>
        </div>

        <div class="metric-card">
            <h3>Recent Alerts</h3>
            ${report.alerts.recent.length === 0 ? '<p>No recent alerts</p>' : 
              report.alerts.recent.map(alert => `
                <div class="alert alert-${alert.severity}">
                    <strong>${alert.type}:</strong> ${alert.message}
                </div>
              `).join('')}
        </div>

        <div class="metric-card">
            <h3>Operation Performance</h3>
            <table>
                <thead>
                    <tr>
                        <th>Operation</th>
                        <th>Avg Reproducibility</th>
                        <th>Avg Execution Time</th>
                        <th>Reliability</th>
                    </tr>
                </thead>
                <tbody>
                    ${Object.keys(report.operationAnalysis).map(operation => {
                      const analysis = report.operationAnalysis[operation];
                      return `
                        <tr>
                            <td>${operation}</td>
                            <td class="${analysis.avgReproducibility >= 99 ? 'trend-up' : 'trend-down'}">
                                ${analysis.avgReproducibility.toFixed(1)}%
                            </td>
                            <td>${analysis.avgExecutionTime.toFixed(0)}ms</td>
                            <td class="${analysis.reliability >= 95 ? 'trend-up' : 'trend-down'}">
                                ${analysis.reliability.toFixed(1)}%
                            </td>
                        </tr>
                      `;
                    }).join('')}
                </tbody>
            </table>
        </div>

        <div class="metric-card">
            <h3>Recommendations</h3>
            ${report.recommendations.length === 0 ? '<p>No recommendations at this time</p>' : 
              report.recommendations.map(rec => `
                <div class="alert alert-${rec.priority === 'high' ? 'high' : 'medium'}">
                    <strong>${rec.type}:</strong> ${rec.message}<br>
                    <em>Action:</em> ${rec.action}
                </div>
              `).join('')}
        </div>

        <div class="metric-card">
            <h3>Environment Information</h3>
            <p><strong>Node Version:</strong> ${process.version}</p>
            <p><strong>Platform:</strong> ${process.platform}</p>
            <p><strong>Monitoring Interval:</strong> ${this.options.monitoringInterval / 1000}s</p>
            <p><strong>Alert Threshold:</strong> ${this.options.alertThreshold}%</p>
        </div>
    </div>

    <script>
        // Auto-refresh every 5 minutes
        setTimeout(() => location.reload(), 300000);
    </script>
</body>
</html>`;

    await fs.writeFile(dashboardPath, html);
  }

  /**
   * Utility functions
   */
  
  captureEnvironmentSnapshot() {
    return {
      timestamp: this.getDeterministicDate().toISOString(),
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      memory: process.memoryUsage(),
      uptime: process.uptime()
    };
  }

  calculateOutputHash(output) {
    return createHash('sha256').update(output || '').digest('hex');
  }

  calculateVariance(numbers) {
    if (numbers.length === 0) return 0;
    const mean = numbers.reduce((a, b) => a + b) / numbers.length;
    const squaredDiffs = numbers.map(x => Math.pow(x - mean, 2));
    return squaredDiffs.reduce((a, b) => a + b) / numbers.length;
  }

  getMonitoringDuration() {
    if (this.metrics.history.length < 2) return 0;
    const start = new Date(this.metrics.history[0].timestamp);
    const end = new Date(this.metrics.history[this.metrics.history.length - 1].timestamp);
    return end - start;
  }

  getMonitoringPeriod() {
    if (this.metrics.history.length === 0) return null;
    return {
      start: this.metrics.history[0].timestamp,
      end: this.metrics.history[this.metrics.history.length - 1].timestamp,
      duration: this.getMonitoringDuration()
    };
  }

  calculateAverageReproducibility() {
    if (this.metrics.history.length === 0) return 0;
    const scores = this.metrics.history.map(cycle => cycle.metrics.overallReproducibility);
    return scores.reduce((a, b) => a + b) / scores.length;
  }

  calculateAveragePerformance() {
    if (this.metrics.history.length === 0) return 0;
    const times = this.metrics.history.map(cycle => cycle.metrics.avgExecutionTime);
    return times.reduce((a, b) => a + b) / times.length;
  }

  groupAlertsBySeverity() {
    const groups = { high: [], medium: [], low: [] };
    this.metrics.alerts.forEach(alert => {
      groups[alert.severity] = groups[alert.severity] || [];
      groups[alert.severity].push(alert);
    });
    return groups;
  }

  groupAlertsByType() {
    const groups = {};
    this.metrics.alerts.forEach(alert => {
      groups[alert.type] = groups[alert.type] || [];
      groups[alert.type].push(alert);
    });
    return groups;
  }

  async saveMonitoringState() {
    const state = {
      baseline: this.baseline,
      history: this.metrics.history.slice(-this.options.maxHistorySize),
      lastUpdate: this.getDeterministicDate().toISOString()
    };
    
    try {
      await fs.writeFile(this.stateFile, JSON.stringify(state, null, 2));
    } catch (error) {
      // Ignore save errors
    }
  }
}

export default ReproducibilityMonitor;

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const monitor = new ReproducibilityMonitor({
    monitoringInterval: parseInt(process.argv[2]) || 60000,
    alertThreshold: parseFloat(process.argv[3]) || 95.0
  });

  // Set up event handlers
  monitor.on('monitoring-started', (data) => {
    console.log('🚀 Reproducibility monitoring started');
    console.log(`   Interval: ${data.interval / 1000}s`);
    console.log(`   Baseline: ${data.baseline.overallScore.toFixed(2)}%`);
  });

  monitor.on('cycle-completed', (cycle) => {
    console.log(`📊 Cycle ${cycle.cycleNumber}: ${cycle.metrics.overallReproducibility.toFixed(2)}% reproducibility, ${cycle.metrics.avgExecutionTime.toFixed(0)}ms avg time`);
  });

  monitor.on('alerts-triggered', (alerts) => {
    console.log(`🚨 ${alerts.length} alerts triggered:`);
    alerts.forEach(alert => {
      console.log(`   [${alert.severity.toUpperCase()}] ${alert.message}`);
    });
  });

  monitor.on('monitoring-error', (error) => {
    console.error('❌ Monitoring error:', error.message);
  });

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down monitoring...');
    const result = await monitor.stopMonitoring();
    if (result.report) {
      console.log(`📈 Final report: ${result.report.reportPath}`);
    }
    process.exit(0);
  });

  // Start monitoring
  try {
    await monitor.startMonitoring();
    console.log('Monitor is running. Press Ctrl+C to stop.');
  } catch (error) {
    console.error('Failed to start monitoring:', error);
    process.exit(1);
  }
}