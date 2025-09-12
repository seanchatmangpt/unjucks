#!/usr/bin/env node

/**
 * Enterprise Prometheus Metrics Collector
 * Collects comprehensive workflow and system metrics for observability
 */

import { register, Gauge, Counter, Histogram, pushGateway } from 'prom-client';
import { Octokit } from '@octokit/rest';
import fs from 'fs-extra';
import path from 'path';
import consola from 'consola';

// Prometheus metric definitions
const workflowDurationGauge = new Gauge({
  name: 'github_workflow_duration_seconds',
  help: 'Duration of GitHub workflow runs in seconds',
  labelNames: ['workflow', 'status', 'branch', 'repository']
});

const workflowRunCounter = new Counter({
  name: 'github_workflow_runs_total',
  help: 'Total number of workflow runs',
  labelNames: ['workflow', 'status', 'trigger', 'branch']
});

const actionExecutionHistogram = new Histogram({
  name: 'github_action_execution_seconds',
  help: 'Time spent executing GitHub Actions',
  labelNames: ['action', 'workflow', 'step'],
  buckets: [0.1, 0.5, 1, 5, 10, 30, 60, 300, 600, 1800, 3600]
});

const resourceUtilizationGauge = new Gauge({
  name: 'github_runner_resource_utilization',
  help: 'Resource utilization of GitHub runners',
  labelNames: ['resource_type', 'runner_os', 'workflow']
});

const errorRateGauge = new Gauge({
  name: 'github_workflow_error_rate',
  help: 'Error rate of workflows (percentage)',
  labelNames: ['workflow', 'time_window']
});

const sloComplianceGauge = new Gauge({
  name: 'github_workflow_slo_compliance',
  help: 'SLO compliance score (0-1)',
  labelNames: ['metric_type', 'workflow']
});

class PrometheusCollector {
  constructor(options = {}) {
    this.sessionId = options.sessionId;
    this.traceId = options.traceId;
    this.jobName = options.jobName || 'github-actions';
    this.timeWindow = parseInt(options.timeWindow) || 24;
    this.repository = process.env.GITHUB_REPOSITORY;
    
    this.octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN
    });

    this.gateway = new pushGateway(
      process.env.PROMETHEUS_GATEWAY || 'http://localhost:9091',
      [],
      register
    );
  }

  async collectWorkflowMetrics() {
    consola.info(`🔍 Collecting workflow metrics for ${this.repository}`);
    
    try {
      const [owner, repo] = this.repository.split('/');
      const since = this.getDeterministicDate();
      since.setHours(since.getHours() - this.timeWindow);

      // Get workflow runs
      const { data: workflowRuns } = await this.octokit.rest.actions.listWorkflowRunsForRepo({
        owner,
        repo,
        per_page: 100,
        created: `>=${since.toISOString()}`
      });

      // Process each workflow run
      for (const run of workflowRuns.workflow_runs) {
        await this.processWorkflowRun(owner, repo, run);
      }

      consola.success(`✅ Collected metrics for ${workflowRuns.workflow_runs.length} workflow runs`);
      return { success: true, runsProcessed: workflowRuns.workflow_runs.length };

    } catch (error) {
      consola.error('Failed to collect workflow metrics:', error);
      throw error;
    }
  }

  async processWorkflowRun(owner, repo, run) {
    const duration = run.updated_at 
      ? (new Date(run.updated_at) - new Date(run.created_at)) / 1000
      : 0;

    // Record workflow duration
    workflowDurationGauge
      .labels(run.name, run.conclusion || 'in_progress', run.head_branch, this.repository)
      .set(duration);

    // Count workflow runs
    workflowRunCounter
      .labels(run.name, run.conclusion || 'in_progress', run.event, run.head_branch)
      .inc();

    // Get job details for more granular metrics
    try {
      const { data: jobs } = await this.octokit.rest.actions.listJobsForWorkflowRun({
        owner,
        repo,
        run_id: run.id
      });

      for (const job of jobs.jobs) {
        await this.processJob(run, job);
      }
    } catch (error) {
      consola.warn(`Could not fetch jobs for run ${run.id}:`, error.message);
    }
  }

  async processJob(workflowRun, job) {
    const jobDuration = job.completed_at 
      ? (new Date(job.completed_at) - new Date(job.started_at)) / 1000
      : 0;

    // Process individual steps
    for (const step of job.steps || []) {
      const stepDuration = step.completed_at 
        ? (new Date(step.completed_at) - new Date(step.started_at)) / 1000
        : 0;

      actionExecutionHistogram
        .labels(step.name, workflowRun.name, step.number.toString())
        .observe(stepDuration);
    }

    // Estimate resource utilization based on job duration and runner type
    const estimatedCpu = this.estimateResourceUsage(job, 'cpu');
    const estimatedMemory = this.estimateResourceUsage(job, 'memory');

    resourceUtilizationGauge
      .labels('cpu', job.runner_name || 'ubuntu-latest', workflowRun.name)
      .set(estimatedCpu);

    resourceUtilizationGauge
      .labels('memory', job.runner_name || 'ubuntu-latest', workflowRun.name)
      .set(estimatedMemory);
  }

  estimateResourceUsage(job, resourceType) {
    // Simple heuristic-based resource usage estimation
    const duration = job.completed_at 
      ? (new Date(job.completed_at) - new Date(job.started_at)) / 1000
      : 0;

    if (resourceType === 'cpu') {
      // Estimate CPU usage based on job duration and complexity
      return Math.min(100, duration / 60 * 20); // Rough estimate
    } else if (resourceType === 'memory') {
      // Estimate memory usage
      return Math.min(100, duration / 60 * 15); // Rough estimate
    }
    
    return 0;
  }

  async calculateSLOMetrics() {
    consola.info('📊 Calculating SLO metrics');

    try {
      const [owner, repo] = this.repository.split('/');
      const since = this.getDeterministicDate();
      since.setDate(since.getDate() - 7); // Last 7 days for SLO calculation

      const { data: workflowRuns } = await this.octokit.rest.actions.listWorkflowRunsForRepo({
        owner,
        repo,
        per_page: 100,
        created: `>=${since.toISOString()}`
      });

      // Calculate availability (success rate)
      const totalRuns = workflowRuns.workflow_runs.length;
      const successfulRuns = workflowRuns.workflow_runs.filter(run => 
        run.conclusion === 'success'
      ).length;
      
      const availability = totalRuns > 0 ? successfulRuns / totalRuns : 1;

      // Calculate error rate
      const failedRuns = workflowRuns.workflow_runs.filter(run => 
        run.conclusion === 'failure' || run.conclusion === 'cancelled'
      ).length;
      
      const errorRate = totalRuns > 0 ? (failedRuns / totalRuns) * 100 : 0;

      // Calculate latency (average duration)
      const completedRuns = workflowRuns.workflow_runs.filter(run => run.conclusion);
      const avgLatency = completedRuns.length > 0 
        ? completedRuns.reduce((sum, run) => {
            const duration = (new Date(run.updated_at) - new Date(run.created_at)) / 1000;
            return sum + duration;
          }, 0) / completedRuns.length
        : 0;

      // Record SLO metrics
      sloComplianceGauge.labels('availability', 'all').set(availability);
      sloComplianceGauge.labels('error_rate', 'all').set(errorRate);
      sloComplianceGauge.labels('latency_avg', 'all').set(avgLatency);

      errorRateGauge.labels('all', '7d').set(errorRate);

      consola.success(`SLO Metrics - Availability: ${(availability * 100).toFixed(2)}%, Error Rate: ${errorRate.toFixed(2)}%, Avg Latency: ${avgLatency.toFixed(0)}s`);

      return {
        availability,
        errorRate,
        avgLatency,
        totalRuns,
        successfulRuns,
        failedRuns
      };

    } catch (error) {
      consola.error('Failed to calculate SLO metrics:', error);
      throw error;
    }
  }

  async exportMetrics() {
    consola.info('📤 Exporting metrics to Prometheus');

    try {
      await this.gateway.push({
        jobName: this.jobName,
        groupings: {
          session_id: this.sessionId,
          trace_id: this.traceId,
          repository: this.repository
        }
      });

      // Also save metrics locally
      const metricsData = {
        timestamp: this.getDeterministicDate().toISOString(),
        sessionId: this.sessionId,
        traceId: this.traceId,
        metrics: await register.getMetricsAsJSON()
      };

      const metricsPath = '.github/observability-data/metrics';
      await fs.ensureDir(metricsPath);
      await fs.writeJson(
        path.join(metricsPath, `prometheus-${this.sessionId}.json`), 
        metricsData, 
        { spaces: 2 }
      );

      consola.success('✅ Metrics exported successfully');
      return { success: true, metricsCount: metricsData.metrics.length };

    } catch (error) {
      consola.error('Failed to export metrics:', error);
      throw error;
    }
  }

  async collectCustomMetrics() {
    consola.info('🔧 Collecting custom workflow metrics');

    try {
      // Workflow file count and complexity
      const workflowFiles = await fs.readdir('.github/workflows');
      const ymlFiles = workflowFiles.filter(file => file.endsWith('.yml') || file.endsWith('.yaml'));
      
      const workflowComplexity = new Gauge({
        name: 'github_workflow_complexity_score',
        help: 'Complexity score of workflow files',
        labelNames: ['workflow_file']
      });

      for (const file of ymlFiles) {
        const content = await fs.readFile(path.join('.github/workflows', file), 'utf8');
        const lines = content.split('\n').length;
        const steps = (content.match(/- name:/g) || []).length;
        const complexity = lines + (steps * 2); // Simple complexity score
        
        workflowComplexity.labels(file).set(complexity);
      }

      // Repository health metrics
      const repoHealthGauge = new Gauge({
        name: 'github_repository_health_score',
        help: 'Repository health score based on various factors',
        labelNames: ['metric']
      });

      // Check for essential files
      const essentialFiles = [
        'package.json',
        'README.md',
        '.gitignore',
        'LICENSE',
        '.github/workflows'
      ];

      let healthScore = 0;
      for (const file of essentialFiles) {
        if (await fs.pathExists(file)) {
          healthScore += 20;
        }
      }

      repoHealthGauge.labels('overall').set(healthScore);

      consola.success(`Custom metrics collected - Workflow files: ${ymlFiles.length}, Health score: ${healthScore}`);

      return {
        workflowCount: ymlFiles.length,
        healthScore,
        customMetricsCount: 2 + ymlFiles.length
      };

    } catch (error) {
      consola.error('Failed to collect custom metrics:', error);
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

  const collector = new PrometheusCollector(options);

  try {
    consola.info('🚀 Starting Prometheus metrics collection');

    const workflowMetrics = await collector.collectWorkflowMetrics();
    const sloMetrics = await collector.calculateSLOMetrics();
    const customMetrics = await collector.collectCustomMetrics();
    const exportResult = await collector.exportMetrics();

    // Set output for GitHub Actions
    if (process.env.GITHUB_OUTPUT) {
      const outputs = [
        `success=true`,
        `custom_metrics=${customMetrics.customMetricsCount}`,
        `workflow_runs=${workflowMetrics.runsProcessed}`,
        `slo_availability=${sloMetrics.availability}`,
        `slo_error_rate=${sloMetrics.errorRate}`
      ];
      
      await fs.appendFile(process.env.GITHUB_OUTPUT, outputs.join('\n') + '\n');
    }

    consola.success('🎉 Prometheus metrics collection completed successfully');
    process.exit(0);

  } catch (error) {
    consola.error('💥 Metrics collection failed:', error);
    
    if (process.env.GITHUB_OUTPUT) {
      await fs.appendFile(process.env.GITHUB_OUTPUT, 'success=false\n');
    }
    
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { PrometheusCollector };