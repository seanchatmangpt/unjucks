#!/usr/bin/env node

/**
 * Continuous Quality Monitoring and Alerting System
 * Monitors quality metrics and sends alerts when thresholds are breached
 */

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

class QualityMonitor {
  constructor(config = {}) {
    this.config = {
      checkInterval: 300000, // 5 minutes
      thresholds: {
        coverageStatements: 80,
        coverageBranches: 75,
        performanceThreshold: 5000, // 5 seconds
        qualityScore: 70,
        mutationScore: 60,
        criticalVulnerabilities: 0,
        highVulnerabilities: 2
      },
      alerts: {
        email: null, // Email address for alerts
        webhook: null, // Webhook URL for alerts
        slack: null // Slack webhook for alerts
      },
      retention: {
        metrics: 100, // Keep last 100 metric entries
        alerts: 50   // Keep last 50 alerts
      },
      ...config
    };
    
    this.reportsDir = path.join(projectRoot, 'tests/reports');
    this.monitoringData = {
      metrics: [],
      alerts: [],
      lastCheck: null,
      isMonitoring: false
    };
    
    this.alertTypes = {
      COVERAGE_DROP: 'Coverage dropped below threshold',
      PERFORMANCE_REGRESSION: 'Performance regression detected',
      QUALITY_SCORE_LOW: 'Quality score below threshold',
      MUTATION_SCORE_LOW: 'Mutation testing score low',
      SECURITY_VULNERABILITIES: 'Security vulnerabilities detected',
      TEST_FAILURES: 'Critical tests are failing',
      BUILD_FAILURE: 'Build process failed'
    };
  }

  async startMonitoring() {
    console.log('📏 Starting Continuous Quality Monitoring...');
    console.log(`   Check interval: ${this.config.checkInterval / 1000}s`);
    console.log(`   Thresholds: Coverage ${this.config.thresholds.coverageStatements}%, Performance ${this.config.thresholds.performanceThreshold}ms`);
    
    await fs.ensureDir(this.reportsDir);
    
    this.monitoringData.isMonitoring = true;
    
    // Load existing data
    await this.loadMonitoringData();
    
    // Start monitoring loop
    this.monitoringLoop();
    
    // Setup graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n🚫 Stopping quality monitoring...');
      await this.stopMonitoring();
      process.exit(0);
    });
    
    console.log('🌐 Quality monitoring is now running. Press Ctrl+C to stop.');
  }

  async monitoringLoop() {
    while (this.monitoringData.isMonitoring) {
      try {
        await this.performQualityCheck();
        
        // Wait for next check
        await this.sleep(this.config.checkInterval);
      } catch (error) {
        console.error('💥 Error in monitoring loop:', error.message);
        
        // Create error alert
        await this.createAlert({
          type: 'MONITORING_ERROR',
          severity: 'medium',
          message: `Monitoring error: ${error.message}`,
          details: { error: error.message }
        });
        
        // Wait before retrying
        await this.sleep(30000); // 30 seconds
      }
    }
  }

  async performQualityCheck() {
    const timestamp = this.getDeterministicDate().toISOString();
    console.log(`\n🔍 Quality check at ${new Date(timestamp).toLocaleString()}`);
    
    const metrics = await this.collectCurrentMetrics();
    
    // Store metrics
    this.monitoringData.metrics.push({
      timestamp,
      ...metrics
    });
    
    // Trim old metrics
    if (this.monitoringData.metrics.length > this.config.retention.metrics) {
      this.monitoringData.metrics = this.monitoringData.metrics.slice(-this.config.retention.metrics);
    }
    
    // Check for alert conditions
    const alerts = await this.checkAlertConditions(metrics);
    
    if (alerts.length > 0) {
      console.log(`⚠️  ${alerts.length} alert(s) detected`);
      
      for (const alert of alerts) {
        await this.handleAlert(alert);
      }
    } else {
      console.log('✅ All quality metrics within acceptable ranges');
    }
    
    // Save monitoring data
    await this.saveMonitoringData();
    
    this.monitoringData.lastCheck = timestamp;
  }

  async collectCurrentMetrics() {
    console.log('   📊 Collecting quality metrics...');
    
    const metrics = {
      coverage: await this.getCoverageMetrics(),
      performance: await this.getPerformanceMetrics(),
      workflows: await this.getWorkflowMetrics(),
      security: await this.getSecurityMetrics(),
      build: await this.getBuildStatus(),
      qualityScore: 0
    };
    
    // Calculate overall quality score
    metrics.qualityScore = this.calculateQualityScore(metrics);
    
    return metrics;
  }

  async getCoverageMetrics() {
    const coverageFile = path.join(this.reportsDir, 'coverage-report.json');
    
    if (!await fs.pathExists(coverageFile)) {
      return { statements: 0, branches: 0, available: false };
    }
    
    try {
      const coverage = await fs.readJSON(coverageFile);
      return {
        statements: coverage.coverage?.statements || 0,
        branches: coverage.coverage?.branches || 0,
        functions: coverage.coverage?.functions || 0,
        lines: coverage.coverage?.lines || 0,
        available: true
      };
    } catch (error) {
      return { statements: 0, branches: 0, available: false, error: error.message };
    }
  }

  async getPerformanceMetrics() {
    const perfFile = path.join(this.reportsDir, 'performance-report.json');
    
    if (!await fs.pathExists(perfFile)) {
      return { avgDuration: 0, maxDuration: 0, available: false };
    }
    
    try {
      const perf = await fs.readJSON(perfFile);
      
      const durations = perf.results?.map(r => r.metrics?.avgDuration || 0) || [];
      const avgDuration = durations.length > 0 ? durations.reduce((a, b) => a + b) / durations.length : 0;
      const maxDuration = Math.max(...durations, 0);
      
      return {
        avgDuration: Math.round(avgDuration),
        maxDuration: Math.round(maxDuration),
        benchmarks: perf.totalBenchmarks || 0,
        passed: perf.passed || 0,
        failed: perf.failed || 0,
        available: true
      };
    } catch (error) {
      return { avgDuration: 0, maxDuration: 0, available: false, error: error.message };
    }
  }

  async getWorkflowMetrics() {
    const workflowFile = path.join(this.reportsDir, 'workflow-validation.json');
    
    if (!await fs.pathExists(workflowFile)) {
      return { passed: 0, failed: 0, criticalFailed: 0, available: false };
    }
    
    try {
      const workflow = await fs.readJSON(workflowFile);
      return {
        total: workflow.totalWorkflows || 0,
        passed: workflow.passed || 0,
        failed: workflow.failed || 0,
        criticalFailed: workflow.criticalFailed || 0,
        available: true
      };
    } catch (error) {
      return { passed: 0, failed: 0, criticalFailed: 0, available: false, error: error.message };
    }
  }

  async getSecurityMetrics() {
    const securityFile = path.join(this.reportsDir, 'security-report.json');
    
    if (!await fs.pathExists(securityFile)) {
      return { critical: 0, high: 0, medium: 0, low: 0, available: false };
    }
    
    try {
      const security = await fs.readJSON(securityFile);
      
      const vulnerabilities = security.vulnerabilities || [];
      const counts = {
        critical: vulnerabilities.filter(v => v.severity === 'critical').length,
        high: vulnerabilities.filter(v => v.severity === 'high').length,
        medium: vulnerabilities.filter(v => v.severity === 'medium').length,
        low: vulnerabilities.filter(v => v.severity === 'low').length,
        available: true
      };
      
      return counts;
    } catch (error) {
      return { critical: 0, high: 0, medium: 0, low: 0, available: false, error: error.message };
    }
  }

  async getBuildStatus() {
    try {
      // Test if build command works
      const result = await this.executeCommand('npm run build:validate', { timeout: 30000 });
      
      return {
        success: result.code === 0,
        duration: result.duration || 0,
        available: true
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        available: true
      };
    }
  }

  calculateQualityScore(metrics) {
    let score = 0;
    let maxScore = 0;
    
    // Coverage contribution (40%)
    if (metrics.coverage.available) {
      score += (metrics.coverage.statements / 100) * 40;
    }
    maxScore += 40;
    
    // Performance contribution (20%)
    if (metrics.performance.available) {
      const perfScore = metrics.performance.maxDuration < this.config.thresholds.performanceThreshold ? 20 : 10;
      score += perfScore;
    }
    maxScore += 20;
    
    // Workflow contribution (20%)
    if (metrics.workflows.available && metrics.workflows.total > 0) {
      const workflowScore = (metrics.workflows.passed / metrics.workflows.total) * 20;
      score += workflowScore;
      
      // Penalty for critical failures
      if (metrics.workflows.criticalFailed > 0) {
        score -= metrics.workflows.criticalFailed * 5;
      }
    }
    maxScore += 20;
    
    // Security contribution (15%)
    if (metrics.security.available) {
      let securityScore = 15;
      securityScore -= metrics.security.critical * 5; // Heavy penalty for critical
      securityScore -= metrics.security.high * 2;     // Medium penalty for high
      securityScore -= metrics.security.medium * 0.5; // Light penalty for medium
      
      score += Math.max(0, securityScore);
    }
    maxScore += 15;
    
    // Build contribution (5%)
    if (metrics.build.available) {
      score += metrics.build.success ? 5 : 0;
    }
    maxScore += 5;
    
    return Math.max(0, Math.round((score / maxScore) * 100));
  }

  async checkAlertConditions(metrics) {
    const alerts = [];
    
    // Coverage alerts
    if (metrics.coverage.available) {
      if (metrics.coverage.statements < this.config.thresholds.coverageStatements) {
        alerts.push({
          type: 'COVERAGE_DROP',
          severity: 'high',
          message: `Code coverage dropped to ${metrics.coverage.statements.toFixed(1)}%`,
          threshold: this.config.thresholds.coverageStatements,
          actual: metrics.coverage.statements,
          details: metrics.coverage
        });
      }
    }
    
    // Performance alerts
    if (metrics.performance.available) {
      if (metrics.performance.maxDuration > this.config.thresholds.performanceThreshold) {
        alerts.push({
          type: 'PERFORMANCE_REGRESSION',
          severity: 'medium',
          message: `Performance regression detected: ${metrics.performance.maxDuration}ms`,
          threshold: this.config.thresholds.performanceThreshold,
          actual: metrics.performance.maxDuration,
          details: metrics.performance
        });
      }
    }
    
    // Quality score alerts
    if (metrics.qualityScore < this.config.thresholds.qualityScore) {
      alerts.push({
        type: 'QUALITY_SCORE_LOW',
        severity: 'medium',
        message: `Quality score dropped to ${metrics.qualityScore}%`,
        threshold: this.config.thresholds.qualityScore,
        actual: metrics.qualityScore,
        details: { score: metrics.qualityScore }
      });
    }
    
    // Security alerts
    if (metrics.security.available) {
      if (metrics.security.critical > this.config.thresholds.criticalVulnerabilities) {
        alerts.push({
          type: 'SECURITY_VULNERABILITIES',
          severity: 'critical',
          message: `${metrics.security.critical} critical security vulnerabilities detected`,
          threshold: this.config.thresholds.criticalVulnerabilities,
          actual: metrics.security.critical,
          details: metrics.security
        });
      }
      
      if (metrics.security.high > this.config.thresholds.highVulnerabilities) {
        alerts.push({
          type: 'SECURITY_VULNERABILITIES',
          severity: 'high',
          message: `${metrics.security.high} high-severity security vulnerabilities detected`,
          threshold: this.config.thresholds.highVulnerabilities,
          actual: metrics.security.high,
          details: metrics.security
        });
      }
    }
    
    // Workflow alerts
    if (metrics.workflows.available && metrics.workflows.criticalFailed > 0) {
      alerts.push({
        type: 'TEST_FAILURES',
        severity: 'critical',
        message: `${metrics.workflows.criticalFailed} critical workflow tests are failing`,
        actual: metrics.workflows.criticalFailed,
        details: metrics.workflows
      });
    }
    
    // Build alerts
    if (metrics.build.available && !metrics.build.success) {
      alerts.push({
        type: 'BUILD_FAILURE',
        severity: 'critical',
        message: 'Build process is failing',
        details: metrics.build
      });
    }
    
    return alerts;
  }

  async handleAlert(alert) {
    const alertData = {
      ...alert,
      id: `${this.getDeterministicTimestamp()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: this.getDeterministicDate().toISOString()
    };
    
    // Store alert
    this.monitoringData.alerts.push(alertData);
    
    // Trim old alerts
    if (this.monitoringData.alerts.length > this.config.retention.alerts) {
      this.monitoringData.alerts = this.monitoringData.alerts.slice(-this.config.retention.alerts);
    }
    
    // Log alert
    const severityIcon = this.getSeverityIcon(alert.severity);
    console.log(`   ${severityIcon} ALERT: ${alert.message}`);
    
    // Send notifications
    await this.sendNotifications(alertData);
    
    return alertData;
  }

  async sendNotifications(alert) {
    const notifications = [];
    
    // Console notification (always)
    notifications.push(this.sendConsoleNotification(alert));
    
    // Email notification
    if (this.config.alerts.email) {
      notifications.push(this.sendEmailNotification(alert));
    }
    
    // Webhook notification
    if (this.config.alerts.webhook) {
      notifications.push(this.sendWebhookNotification(alert));
    }
    
    // Slack notification
    if (this.config.alerts.slack) {
      notifications.push(this.sendSlackNotification(alert));
    }
    
    await Promise.allSettled(notifications);
  }

  async sendConsoleNotification(alert) {
    // Already logged in handleAlert
    return true;
  }

  async sendEmailNotification(alert) {
    // Email implementation would go here
    // For now, just log that it would be sent
    console.log(`   📧 Email alert would be sent to: ${this.config.alerts.email}`);
    return true;
  }

  async sendWebhookNotification(alert) {
    try {
      // Webhook implementation would go here
      console.log(`   🔗 Webhook alert would be sent to: ${this.config.alerts.webhook}`);
      return true;
    } catch (error) {
      console.error(`   ❌ Webhook notification failed: ${error.message}`);
      return false;
    }
  }

  async sendSlackNotification(alert) {
    try {
      // Slack implementation would go here
      console.log(`   💬 Slack alert would be sent to: ${this.config.alerts.slack}`);
      return true;
    } catch (error) {
      console.error(`   ❌ Slack notification failed: ${error.message}`);
      return false;
    }
  }

  getSeverityIcon(severity) {
    const icons = {
      critical: '🚨',
      high: '🔴',
      medium: '🟡',
      low: '🟢'
    };
    return icons[severity] || 'ℹ️';
  }

  async executeCommand(command, options = {}) {
    const { timeout = 30000 } = options;
    
    return new Promise((resolve, reject) => {
      const startTime = this.getDeterministicTimestamp();
      const [cmd, ...args] = command.split(' ');
      
      const process = spawn(cmd, args, {
        cwd: projectRoot,
        stdio: ['ignore', 'pipe', 'pipe']
      });
      
      let stdout = '';
      let stderr = '';
      let timeoutId;
      
      if (timeout) {
        timeoutId = setTimeout(() => {
          process.kill('SIGKILL');
          reject(new Error('Command timeout'));
        }, timeout);
      }
      
      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      process.on('close', (code) => {
        if (timeoutId) clearTimeout(timeoutId);
        
        resolve({
          code,
          stdout,
          stderr,
          duration: this.getDeterministicTimestamp() - startTime
        });
      });
      
      process.on('error', (error) => {
        if (timeoutId) clearTimeout(timeoutId);
        reject(error);
      });
    });
  }

  async loadMonitoringData() {
    const dataFile = path.join(this.reportsDir, 'monitoring-data.json');
    
    if (await fs.pathExists(dataFile)) {
      try {
        const data = await fs.readJSON(dataFile);
        this.monitoringData = {
          ...this.monitoringData,
          ...data,
          isMonitoring: true // Always reset this to true
        };
      } catch (error) {
        console.warn('Could not load monitoring data:', error.message);
      }
    }
  }

  async saveMonitoringData() {
    const dataFile = path.join(this.reportsDir, 'monitoring-data.json');
    
    try {
      await fs.writeJSON(dataFile, this.monitoringData, { spaces: 2 });
    } catch (error) {
      console.error('Could not save monitoring data:', error.message);
    }
  }

  async stopMonitoring() {
    this.monitoringData.isMonitoring = false;
    await this.saveMonitoringData();
    console.log('🚫 Quality monitoring stopped');
  }

  async generateMonitoringReport() {
    const report = {
      timestamp: this.getDeterministicDate().toISOString(),
      summary: {
        totalChecks: this.monitoringData.metrics.length,
        totalAlerts: this.monitoringData.alerts.length,
        lastCheck: this.monitoringData.lastCheck,
        alertsByType: this.getAlertsByType(),
        alertsBySeverity: this.getAlertsBySeverity()
      },
      recentMetrics: this.monitoringData.metrics.slice(-10),
      recentAlerts: this.monitoringData.alerts.slice(-10),
      trends: this.calculateTrends()
    };
    
    await fs.writeJSON(
      path.join(this.reportsDir, 'monitoring-report.json'),
      report,
      { spaces: 2 }
    );
    
    return report;
  }

  getAlertsByType() {
    const counts = {};
    this.monitoringData.alerts.forEach(alert => {
      counts[alert.type] = (counts[alert.type] || 0) + 1;
    });
    return counts;
  }

  getAlertsBySeverity() {
    const counts = {};
    this.monitoringData.alerts.forEach(alert => {
      counts[alert.severity] = (counts[alert.severity] || 0) + 1;
    });
    return counts;
  }

  calculateTrends() {
    if (this.monitoringData.metrics.length < 2) {
      return { message: 'Insufficient data for trend analysis' };
    }
    
    const recent = this.monitoringData.metrics.slice(-10);
    const current = recent[recent.length - 1];
    const previous = recent[recent.length - 2];
    
    return {
      qualityScore: {
        current: current.qualityScore,
        previous: previous.qualityScore,
        trend: current.qualityScore > previous.qualityScore ? 'improving' : 
               current.qualityScore < previous.qualityScore ? 'declining' : 'stable'
      },
      coverage: {
        current: current.coverage?.statements || 0,
        previous: previous.coverage?.statements || 0,
        trend: (current.coverage?.statements || 0) > (previous.coverage?.statements || 0) ? 'improving' : 
               (current.coverage?.statements || 0) < (previous.coverage?.statements || 0) ? 'declining' : 'stable'
      }
    };
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Execute if run directly
if (import.meta.url === `file://${__filename}`) {
  const config = {
    checkInterval: 60000, // 1 minute for demo
    thresholds: {
      coverageStatements: 80,
      performanceThreshold: 5000,
      qualityScore: 70
    }
  };
  
  const monitor = new QualityMonitor(config);
  
  monitor.startMonitoring().catch(error => {
    console.error('Quality monitoring failed:', error);
    process.exit(1);
  });
}

export { QualityMonitor };
