#!/usr/bin/env node

const { Octokit } = require('@octokit/rest');
const fs = require('fs-extra');
const path = require('path');
const { program } = require('commander');
const { subDays, format, parseISO } = require('date-fns');

program
  .option('--repo <repo>', 'Repository in owner/repo format')
  .option('--token <token>', 'GitHub token')
  .option('--days-back <days>', 'Number of days to analyze', '7')
  .option('--report-type <type>', 'Report type', 'daily')
  .parse();

const options = program.opts();
const [owner, repo] = options.repo.split('/');

const octokit = new Octokit({
  auth: options.token
});

class WorkflowMetricsCollector {
  constructor(owner, repo, octokit) {
    this.owner = owner;
    this.repo = repo;
    this.octokit = octokit;
    this.config = this.loadConfig();
  }

  loadConfig() {
    try {
      return require('./config.json');
    } catch (error) {
      console.error('Failed to load config:', error);
      return { monitoring: { workflows_to_monitor: [] } };
    }
  }

  async collectMetrics() {
    console.log(`🔍 Collecting workflow metrics for ${this.owner}/${this.repo}`);
    
    const daysBack = parseInt(options.daysBack);
    const since = subDays(new Date(), daysBack);
    const metrics = {
      collection_time: new Date().toISOString(),
      period: {
        days_back: daysBack,
        since: since.toISOString(),
        until: new Date().toISOString()
      },
      workflows: {},
      summary: {
        total_runs: 0,
        successful_runs: 0,
        failed_runs: 0,
        cancelled_runs: 0,
        total_duration_minutes: 0,
        average_duration_minutes: 0,
        success_rate: 0
      }
    };

    try {
      // Get all workflows
      const { data: workflows } = await this.octokit.rest.actions.listRepoWorkflows({
        owner: this.owner,
        repo: this.repo
      });

      console.log(`📋 Found ${workflows.workflows.length} workflows`);

      // Collect metrics for each workflow
      for (const workflow of workflows.workflows) {
        if (this.shouldMonitorWorkflow(workflow.path)) {
          console.log(`📊 Analyzing workflow: ${workflow.name}`);
          const workflowMetrics = await this.collectWorkflowMetrics(workflow.id, since);
          metrics.workflows[workflow.name] = {
            id: workflow.id,
            path: workflow.path,
            state: workflow.state,
            ...workflowMetrics
          };
        }
      }

      // Calculate summary metrics
      this.calculateSummaryMetrics(metrics);

      // Save metrics
      await this.saveMetrics(metrics);
      
      console.log('✅ Metrics collection completed successfully');
      console.log(`::set-output name=success::true`);
      console.log(`::set-output name=report_path::${this.getReportPath()}`);

      return metrics;

    } catch (error) {
      console.error('❌ Error collecting metrics:', error);
      console.log(`::set-output name=success::false`);
      throw error;
    }
  }

  shouldMonitorWorkflow(workflowPath) {
    const monitoredWorkflows = this.config.monitoring?.workflows_to_monitor || [];
    if (monitoredWorkflows.length === 0) return true;
    
    return monitoredWorkflows.some(pattern => {
      if (pattern.includes('*')) {
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        return regex.test(workflowPath);
      }
      return workflowPath.includes(pattern);
    });
  }

  async collectWorkflowMetrics(workflowId, since) {
    const runs = [];
    let page = 1;
    const perPage = 100;

    // Collect all workflow runs since the specified date
    while (true) {
      const { data } = await this.octokit.rest.actions.listWorkflowRuns({
        owner: this.owner,
        repo: this.repo,
        workflow_id: workflowId,
        page,
        per_page: perPage,
        created: `>=${since.toISOString()}`
      });

      runs.push(...data.workflow_runs);

      if (data.workflow_runs.length < perPage) break;
      page++;
    }

    console.log(`  📈 Collected ${runs.length} workflow runs`);

    return this.analyzeWorkflowRuns(runs);
  }

  analyzeWorkflowRuns(runs) {
    const metrics = {
      total_runs: runs.length,
      successful_runs: 0,
      failed_runs: 0,
      cancelled_runs: 0,
      in_progress_runs: 0,
      durations: [],
      run_details: [],
      failure_reasons: {},
      trends: {
        daily_runs: {},
        hourly_distribution: {}
      }
    };

    for (const run of runs) {
      const duration = this.calculateDuration(run);
      const runDate = format(parseISO(run.created_at), 'yyyy-MM-dd');
      const runHour = format(parseISO(run.created_at), 'HH');

      // Count by status
      switch (run.conclusion) {
        case 'success':
          metrics.successful_runs++;
          break;
        case 'failure':
          metrics.failed_runs++;
          this.trackFailureReason(run, metrics.failure_reasons);
          break;
        case 'cancelled':
          metrics.cancelled_runs++;
          break;
        default:
          if (run.status === 'in_progress') {
            metrics.in_progress_runs++;
          }
      }

      // Track durations for completed runs
      if (duration > 0) {
        metrics.durations.push(duration);
      }

      // Track daily trends
      if (!metrics.trends.daily_runs[runDate]) {
        metrics.trends.daily_runs[runDate] = 0;
      }
      metrics.trends.daily_runs[runDate]++;

      // Track hourly distribution
      if (!metrics.trends.hourly_distribution[runHour]) {
        metrics.trends.hourly_distribution[runHour] = 0;
      }
      metrics.trends.hourly_distribution[runHour]++;

      // Store run details
      metrics.run_details.push({
        id: run.id,
        status: run.status,
        conclusion: run.conclusion,
        created_at: run.created_at,
        updated_at: run.updated_at,
        duration_minutes: duration,
        head_branch: run.head_branch,
        head_commit: run.head_commit?.id?.substring(0, 7),
        triggering_actor: run.triggering_actor?.login,
        event: run.event
      });
    }

    // Calculate statistics
    metrics.success_rate = metrics.total_runs > 0 
      ? (metrics.successful_runs / metrics.total_runs * 100).toFixed(2)
      : 0;

    if (metrics.durations.length > 0) {
      metrics.average_duration_minutes = (
        metrics.durations.reduce((sum, duration) => sum + duration, 0) / metrics.durations.length
      ).toFixed(2);
      metrics.min_duration_minutes = Math.min(...metrics.durations).toFixed(2);
      metrics.max_duration_minutes = Math.max(...metrics.durations).toFixed(2);
      metrics.total_duration_minutes = metrics.durations.reduce((sum, duration) => sum + duration, 0).toFixed(2);
    }

    return metrics;
  }

  calculateDuration(run) {
    if (!run.updated_at || !run.created_at) return 0;
    
    const created = new Date(run.created_at);
    const updated = new Date(run.updated_at);
    return Math.max(0, (updated - created) / (1000 * 60)); // Duration in minutes
  }

  trackFailureReason(run, failureReasons) {
    // This is a simplified failure categorization
    // In practice, you might want to fetch job logs for more detailed analysis
    const reason = run.conclusion === 'failure' ? 'test_failure' : run.conclusion;
    if (!failureReasons[reason]) {
      failureReasons[reason] = 0;
    }
    failureReasons[reason]++;
  }

  calculateSummaryMetrics(metrics) {
    let totalRuns = 0;
    let successfulRuns = 0;
    let failedRuns = 0;
    let cancelledRuns = 0;
    let totalDuration = 0;
    let totalDurations = [];

    for (const [workflowName, workflowMetrics] of Object.entries(metrics.workflows)) {
      totalRuns += workflowMetrics.total_runs || 0;
      successfulRuns += workflowMetrics.successful_runs || 0;
      failedRuns += workflowMetrics.failed_runs || 0;
      cancelledRuns += workflowMetrics.cancelled_runs || 0;
      
      if (workflowMetrics.durations) {
        totalDurations.push(...workflowMetrics.durations);
      }
    }

    metrics.summary = {
      total_runs: totalRuns,
      successful_runs: successfulRuns,
      failed_runs: failedRuns,
      cancelled_runs: cancelledRuns,
      success_rate: totalRuns > 0 ? (successfulRuns / totalRuns * 100).toFixed(2) : 0,
      total_duration_minutes: totalDurations.reduce((sum, d) => sum + d, 0).toFixed(2),
      average_duration_minutes: totalDurations.length > 0 
        ? (totalDurations.reduce((sum, d) => sum + d, 0) / totalDurations.length).toFixed(2) 
        : 0
    };
  }

  async saveMetrics(metrics) {
    const reportDir = path.join(process.cwd(), '.github/monitoring-reports');
    const reportType = options.reportType;
    const timestamp = format(new Date(), 'yyyy-MM-dd');
    
    await fs.ensureDir(path.join(reportDir, reportType));
    
    const reportPath = path.join(reportDir, reportType, `metrics-${timestamp}.json`);
    await fs.writeJSON(reportPath, metrics, { spaces: 2 });
    
    // Also save as latest
    const latestPath = path.join(reportDir, 'latest-metrics.json');
    await fs.writeJSON(latestPath, metrics, { spaces: 2 });
    
    console.log(`💾 Metrics saved to: ${reportPath}`);
  }

  getReportPath() {
    const timestamp = format(new Date(), 'yyyy-MM-dd');
    return `.github/monitoring-reports/${options.reportType}/metrics-${timestamp}.json`;
  }
}

async function main() {
  try {
    const collector = new WorkflowMetricsCollector(owner, repo, octokit);
    await collector.collectMetrics();
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = WorkflowMetricsCollector;