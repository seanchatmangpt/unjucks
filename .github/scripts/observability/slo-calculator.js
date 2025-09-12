#!/usr/bin/env node

/**
 * SLO (Service Level Objective) Calculator and Tracker
 * Monitors and calculates SLO compliance for CI/CD pipeline operations
 */

import { Octokit } from '@octokit/rest';
import fs from 'fs-extra';
import path from 'path';
import consola from 'consola';

class SLOCalculator {
  constructor(options = {}) {
    this.availabilityTarget = parseFloat(options.availabilityTarget) || 99.9;
    this.latencyTarget = parseInt(options.latencyTarget) || 5000; // milliseconds
    this.errorRateTarget = parseFloat(options.errorRateTarget) || 0.1; // percentage
    this.throughputTarget = parseInt(options.throughputTarget) || 10; // runs per hour
    this.timeWindow = options.timeWindow || '24h';
    
    this.repository = process.env.GITHUB_REPOSITORY;
    this.octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
    
    this.sloMetrics = {
      availability: { current: 0, target: this.availabilityTarget, status: 'unknown' },
      latency: { current: 0, target: this.latencyTarget, status: 'unknown' },
      errorRate: { current: 0, target: this.errorRateTarget, status: 'unknown' },
      throughput: { current: 0, target: this.throughputTarget, status: 'unknown' }
    };
  }

  parseTimeWindow(timeWindow) {
    const match = timeWindow.match(/^(\d+)([hdm])$/);
    if (!match) throw new Error(`Invalid time window format: ${timeWindow}`);
    
    const [, amount, unit] = match;
    const multipliers = { m: 60000, h: 3600000, d: 86400000 };
    
    return parseInt(amount) * multipliers[unit];
  }

  async calculateAvailability() {
    consola.info(`📊 Calculating availability SLO (target: ${this.availabilityTarget}%)`);
    
    try {
      const [owner, repo] = this.repository.split('/');
      const since = this.getDeterministicDate();
      const windowMs = this.parseTimeWindow(this.timeWindow);
      since.setTime(since.getTime() - windowMs);

      // Get workflow runs in the time window
      const { data: workflowRuns } = await this.octokit.rest.actions.listWorkflowRunsForRepo({
        owner,
        repo,
        per_page: 100,
        created: `>=${since.toISOString()}`
      });

      const totalRuns = workflowRuns.workflow_runs.length;
      const successfulRuns = workflowRuns.workflow_runs.filter(run => 
        run.conclusion === 'success'
      ).length;
      
      const availability = totalRuns > 0 ? (successfulRuns / totalRuns) * 100 : 100;
      const isHealthy = availability >= this.availabilityTarget;

      this.sloMetrics.availability = {
        current: parseFloat(availability.toFixed(3)),
        target: this.availabilityTarget,
        status: isHealthy ? 'healthy' : 'breached',
        totalRuns,
        successfulRuns,
        failedRuns: totalRuns - successfulRuns,
        errorBudgetRemaining: this.calculateErrorBudget(availability, this.availabilityTarget),
        lastCalculated: this.getDeterministicDate().toISOString()
      };

      consola.success(`Availability: ${availability.toFixed(2)}% (${isHealthy ? '✅ Healthy' : '❌ Breached'})`);
      return this.sloMetrics.availability;

    } catch (error) {
      consola.error('Failed to calculate availability SLO:', error);
      this.sloMetrics.availability.status = 'error';
      throw error;
    }
  }

  async calculateLatency() {
    consola.info(`⏱️ Calculating latency SLO (target: ${this.latencyTarget}ms)`);

    try {
      const [owner, repo] = this.repository.split('/');
      const since = this.getDeterministicDate();
      const windowMs = this.parseTimeWindow(this.timeWindow);
      since.setTime(since.getTime() - windowMs);

      const { data: workflowRuns } = await this.octokit.rest.actions.listWorkflowRunsForRepo({
        owner,
        repo,
        per_page: 100,
        created: `>=${since.toISOString()}`
      });

      // Calculate latency metrics
      const completedRuns = workflowRuns.workflow_runs.filter(run => 
        run.conclusion && run.created_at && run.updated_at
      );

      if (completedRuns.length === 0) {
        this.sloMetrics.latency = {
          current: 0,
          target: this.latencyTarget,
          status: 'no_data',
          lastCalculated: this.getDeterministicDate().toISOString()
        };
        return this.sloMetrics.latency;
      }

      const durations = completedRuns.map(run => {
        const start = new Date(run.created_at).getTime();
        const end = new Date(run.updated_at).getTime();
        return end - start;
      });

      // Calculate percentiles
      const sortedDurations = durations.sort((a, b) => a - b);
      const p50 = this.calculatePercentile(sortedDurations, 50);
      const p95 = this.calculatePercentile(sortedDurations, 95);
      const p99 = this.calculatePercentile(sortedDurations, 99);
      const average = durations.reduce((sum, d) => sum + d, 0) / durations.length;

      // Use P95 latency for SLO compliance
      const isHealthy = p95 <= this.latencyTarget;

      this.sloMetrics.latency = {
        current: parseFloat(p95.toFixed(0)),
        target: this.latencyTarget,
        status: isHealthy ? 'healthy' : 'breached',
        percentiles: {
          p50: parseFloat(p50.toFixed(0)),
          p95: parseFloat(p95.toFixed(0)),
          p99: parseFloat(p99.toFixed(0))
        },
        average: parseFloat(average.toFixed(0)),
        totalMeasurements: durations.length,
        errorBudgetRemaining: this.calculateErrorBudget(
          (durations.filter(d => d <= this.latencyTarget).length / durations.length) * 100,
          95 // 95% of requests should be under target latency
        ),
        lastCalculated: this.getDeterministicDate().toISOString()
      };

      consola.success(`P95 Latency: ${p95.toFixed(0)}ms (${isHealthy ? '✅ Healthy' : '❌ Breached'})`);
      return this.sloMetrics.latency;

    } catch (error) {
      consola.error('Failed to calculate latency SLO:', error);
      this.sloMetrics.latency.status = 'error';
      throw error;
    }
  }

  async calculateErrorRate() {
    consola.info(`🚨 Calculating error rate SLO (target: <${this.errorRateTarget}%)`);

    try {
      const [owner, repo] = this.repository.split('/');
      const since = this.getDeterministicDate();
      const windowMs = this.parseTimeWindow(this.timeWindow);
      since.setTime(since.getTime() - windowMs);

      const { data: workflowRuns } = await this.octokit.rest.actions.listWorkflowRunsForRepo({
        owner,
        repo,
        per_page: 100,
        created: `>=${since.toISOString()}`
      });

      const totalRuns = workflowRuns.workflow_runs.length;
      const errorRuns = workflowRuns.workflow_runs.filter(run => 
        run.conclusion === 'failure' || run.conclusion === 'cancelled' || run.conclusion === 'timed_out'
      ).length;
      
      const errorRate = totalRuns > 0 ? (errorRuns / totalRuns) * 100 : 0;
      const isHealthy = errorRate <= this.errorRateTarget;

      // Categorize errors
      const errorBreakdown = {
        failures: workflowRuns.workflow_runs.filter(run => run.conclusion === 'failure').length,
        cancellations: workflowRuns.workflow_runs.filter(run => run.conclusion === 'cancelled').length,
        timeouts: workflowRuns.workflow_runs.filter(run => run.conclusion === 'timed_out').length
      };

      this.sloMetrics.errorRate = {
        current: parseFloat(errorRate.toFixed(3)),
        target: this.errorRateTarget,
        status: isHealthy ? 'healthy' : 'breached',
        totalRuns,
        errorRuns,
        errorBreakdown,
        errorBudgetRemaining: this.calculateErrorBudget(100 - errorRate, 100 - this.errorRateTarget),
        lastCalculated: this.getDeterministicDate().toISOString()
      };

      consola.success(`Error Rate: ${errorRate.toFixed(2)}% (${isHealthy ? '✅ Healthy' : '❌ Breached'})`);
      return this.sloMetrics.errorRate;

    } catch (error) {
      consola.error('Failed to calculate error rate SLO:', error);
      this.sloMetrics.errorRate.status = 'error';
      throw error;
    }
  }

  async calculateThroughput() {
    consola.info(`🚀 Calculating throughput SLO (target: >${this.throughputTarget} runs/hour)`);

    try {
      const [owner, repo] = this.repository.split('/');
      const since = this.getDeterministicDate();
      const windowMs = this.parseTimeWindow(this.timeWindow);
      since.setTime(since.getTime() - windowMs);

      const { data: workflowRuns } = await this.octokit.rest.actions.listWorkflowRunsForRepo({
        owner,
        repo,
        per_page: 100,
        created: `>=${since.toISOString()}`
      });

      const totalRuns = workflowRuns.workflow_runs.length;
      const windowHours = windowMs / (1000 * 60 * 60);
      const throughput = totalRuns / windowHours;
      
      const isHealthy = throughput >= this.throughputTarget;

      // Calculate hourly breakdown
      const hourlyBreakdown = this.calculateHourlyThroughput(workflowRuns.workflow_runs);

      this.sloMetrics.throughput = {
        current: parseFloat(throughput.toFixed(2)),
        target: this.throughputTarget,
        status: isHealthy ? 'healthy' : 'breached',
        totalRuns,
        windowHours: parseFloat(windowHours.toFixed(2)),
        hourlyBreakdown,
        errorBudgetRemaining: this.calculateErrorBudget(throughput, this.throughputTarget),
        lastCalculated: this.getDeterministicDate().toISOString()
      };

      consola.success(`Throughput: ${throughput.toFixed(2)} runs/hour (${isHealthy ? '✅ Healthy' : '❌ Breached'})`);
      return this.sloMetrics.throughput;

    } catch (error) {
      consola.error('Failed to calculate throughput SLO:', error);
      this.sloMetrics.throughput.status = 'error';
      throw error;
    }
  }

  calculatePercentile(sortedArray, percentile) {
    if (sortedArray.length === 0) return 0;
    
    const index = (percentile / 100) * (sortedArray.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index % 1;

    if (upper >= sortedArray.length) return sortedArray[sortedArray.length - 1];
    if (lower === upper) return sortedArray[lower];

    return sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight;
  }

  calculateErrorBudget(current, target) {
    if (current >= target) return 100;
    const consumed = ((target - current) / target) * 100;
    return Math.max(0, 100 - consumed);
  }

  calculateHourlyThroughput(workflowRuns) {
    const hourlyData = {};
    
    for (const run of workflowRuns) {
      const hour = new Date(run.created_at).toISOString().slice(0, 13) + ':00:00.000Z';
      hourlyData[hour] = (hourlyData[hour] || 0) + 1;
    }

    return Object.entries(hourlyData)
      .map(([hour, count]) => ({ hour, count }))
      .sort((a, b) => a.hour.localeCompare(b.hour));
  }

  async calculateOverallSLOHealth() {
    const metrics = Object.values(this.sloMetrics);
    const healthyCount = metrics.filter(m => m.status === 'healthy').length;
    const totalCount = metrics.filter(m => m.status !== 'unknown').length;
    
    let overallStatus = 'unknown';
    if (totalCount === 0) {
      overallStatus = 'no_data';
    } else if (healthyCount === totalCount) {
      overallStatus = 'healthy';
    } else if (healthyCount === 0) {
      overallStatus = 'critical';
    } else {
      overallStatus = 'degraded';
    }

    // Calculate composite error budget
    const validBudgets = metrics
      .filter(m => typeof m.errorBudgetRemaining === 'number')
      .map(m => m.errorBudgetRemaining);
    
    const averageErrorBudget = validBudgets.length > 0 
      ? validBudgets.reduce((sum, budget) => sum + budget, 0) / validBudgets.length
      : 100;

    return {
      status: overallStatus,
      healthyMetrics: healthyCount,
      totalMetrics: totalCount,
      healthPercentage: totalCount > 0 ? (healthyCount / totalCount) * 100 : 0,
      averageErrorBudgetRemaining: parseFloat(averageErrorBudget.toFixed(2)),
      lastCalculated: this.getDeterministicDate().toISOString()
    };
  }

  async generateSLOReport() {
    const report = {
      timestamp: this.getDeterministicDate().toISOString(),
      timeWindow: this.timeWindow,
      repository: this.repository,
      sloTargets: {
        availability: `${this.availabilityTarget}%`,
        latency: `${this.latencyTarget}ms (P95)`,
        errorRate: `<${this.errorRateTarget}%`,
        throughput: `>${this.throughputTarget} runs/hour`
      },
      metrics: this.sloMetrics,
      overallHealth: await this.calculateOverallSLOHealth(),
      recommendations: this.generateRecommendations()
    };

    return report;
  }

  generateRecommendations() {
    const recommendations = [];
    
    // Availability recommendations
    if (this.sloMetrics.availability.status === 'breached') {
      recommendations.push({
        type: 'availability',
        priority: 'high',
        message: `Availability is below target (${this.sloMetrics.availability.current}% < ${this.availabilityTarget}%)`,
        actions: [
          'Investigate recent workflow failures',
          'Review error patterns and root causes',
          'Consider improving test reliability',
          'Implement better error handling'
        ]
      });
    }

    // Latency recommendations
    if (this.sloMetrics.latency.status === 'breached') {
      recommendations.push({
        type: 'latency',
        priority: 'medium',
        message: `P95 latency exceeds target (${this.sloMetrics.latency.current}ms > ${this.latencyTarget}ms)`,
        actions: [
          'Optimize workflow steps and dependencies',
          'Consider parallel job execution',
          'Review resource allocation',
          'Implement caching strategies'
        ]
      });
    }

    // Error rate recommendations
    if (this.sloMetrics.errorRate.status === 'breached') {
      recommendations.push({
        type: 'error_rate',
        priority: 'high',
        message: `Error rate exceeds target (${this.sloMetrics.errorRate.current}% > ${this.errorRateTarget}%)`,
        actions: [
          'Analyze error patterns and categories',
          'Improve input validation and error handling',
          'Review deployment processes',
          'Enhance monitoring and alerting'
        ]
      });
    }

    // Throughput recommendations
    if (this.sloMetrics.throughput.status === 'breached') {
      recommendations.push({
        type: 'throughput',
        priority: 'low',
        message: `Throughput below target (${this.sloMetrics.throughput.current} < ${this.throughputTarget} runs/hour)`,
        actions: [
          'Analyze workflow trigger patterns',
          'Consider if low throughput is expected',
          'Review development team activity',
          'Optimize workflow scheduling'
        ]
      });
    }

    return recommendations;
  }

  async saveSLOData(report) {
    const sloPath = '.github/observability-data/slo';
    await fs.ensureDir(sloPath);

    // Save detailed report
    const timestamp = this.getDeterministicDate().toISOString().replace(/[:.]/g, '-');
    await fs.writeJson(
      path.join(sloPath, `slo-report-${timestamp}.json`),
      report,
      { spaces: 2 }
    );

    // Save current status for dashboards
    const currentStatus = {
      timestamp: report.timestamp,
      status: report.overallHealth.status,
      metrics: Object.fromEntries(
        Object.entries(report.metrics).map(([key, value]) => [key, {
          current: value.current,
          target: value.target,
          status: value.status,
          errorBudgetRemaining: value.errorBudgetRemaining
        }])
      ),
      errorBudgetRemaining: report.overallHealth.averageErrorBudgetRemaining
    };

    await fs.writeJson(
      path.join(sloPath, 'current-slo-status.json'),
      currentStatus,
      { spaces: 2 }
    );

    consola.success(`SLO data saved to ${sloPath}`);
  }

  async calculateAllSLOs() {
    consola.info('🎯 Calculating all SLO metrics');

    try {
      await Promise.all([
        this.calculateAvailability(),
        this.calculateLatency(),
        this.calculateErrorRate(),
        this.calculateThroughput()
      ]);

      const report = await this.generateSLOReport();
      await this.saveSLOData(report);

      return report;

    } catch (error) {
      consola.error('Failed to calculate SLOs:', error);
      throw error;
    }
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const options = {};
  
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace('--', '');
    const value = args[i + 1];
    options[key.replace(/-([a-z])/g, (g) => g[1].toUpperCase())] = value;
  }

  const calculator = new SLOCalculator(options);

  try {
    consola.info('🎯 Starting SLO calculation');

    const report = await calculator.calculateAllSLOs();

    // Set GitHub Actions outputs
    if (process.env.GITHUB_OUTPUT) {
      const outputs = [
        `status=${report.overallHealth.status}`,
        `availability=${report.metrics.availability.current}`,
        `error_budget=${report.overallHealth.averageErrorBudgetRemaining}`
      ];
      
      await fs.appendFile(process.env.GITHUB_OUTPUT, outputs.join('\n') + '\n');
    }

    // Display summary
    console.log('\n📊 SLO Summary:');
    console.log(`Overall Status: ${report.overallHealth.status.toUpperCase()}`);
    console.log(`Healthy Metrics: ${report.overallHealth.healthyMetrics}/${report.overallHealth.totalMetrics}`);
    console.log(`Average Error Budget: ${report.overallHealth.averageErrorBudgetRemaining.toFixed(1)}%`);

    consola.success('🎉 SLO calculation completed successfully');

    // Exit code based on SLO health
    switch (report.overallHealth.status) {
      case 'critical':
        process.exit(2);
      case 'degraded':
        process.exit(1);
      default:
        process.exit(0);
    }

  } catch (error) {
    consola.error('💥 SLO calculation failed:', error);
    
    if (process.env.GITHUB_OUTPUT) {
      await fs.appendFile(process.env.GITHUB_OUTPUT, 'status=error\n');
    }
    
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { SLOCalculator };