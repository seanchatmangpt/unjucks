#!/usr/bin/env node

const fs = require('fs-extra');
const path = require('path');
const { program } = require('commander');
const { format } = require('date-fns');

program
  .option('--report-type <type>', 'Report type', 'daily')
  .option('--output-format <format>', 'Output format', 'html')
  .parse();

const options = program.opts();

class DashboardGenerator {
  constructor() {
    this.reportDir = path.join(process.cwd(), '.github/monitoring-reports');
    this.dashboardDir = path.join(this.reportDir, 'dashboard');
  }

  async generateDashboard() {
    console.log('📊 Generating monitoring dashboard');

    try {
      await fs.ensureDir(this.dashboardDir);

      const latestMetrics = await this.loadLatestMetrics();
      const latestAnalysis = await this.loadLatestAnalysis();
      const alerts = await this.loadAlerts();

      const dashboardData = this.prepareDashboardData(latestMetrics, latestAnalysis, alerts);

      if (options.outputFormat === 'html') {
        await this.generateHTMLDashboard(dashboardData);
      }

      await this.generateJSONDashboard(dashboardData);
      await this.copyStaticAssets();

      console.log('✅ Dashboard generated successfully');

    } catch (error) {
      console.error('❌ Error generating dashboard:', error);
      throw error;
    }
  }

  async loadLatestMetrics() {
    const latestPath = path.join(this.reportDir, 'latest-metrics.json');
    
    if (await fs.pathExists(latestPath)) {
      return await fs.readJSON(latestPath);
    }
    
    return null;
  }

  async loadLatestAnalysis() {
    const analysisDir = path.join(this.reportDir, 'analysis');
    
    if (await fs.pathExists(analysisDir)) {
      const files = await fs.readdir(analysisDir);
      const analysisFiles = files
        .filter(f => f.startsWith('trends-') && f.endsWith('.json'))
        .sort()
        .reverse();
      
      if (analysisFiles.length > 0) {
        const latestAnalysisPath = path.join(analysisDir, analysisFiles[0]);
        return await fs.readJSON(latestAnalysisPath);
      }
    }
    
    return null;
  }

  async loadAlerts() {
    const alertsPath = path.join(this.reportDir, 'alerts.json');
    
    if (await fs.pathExists(alertsPath)) {
      return await fs.readJSON(alertsPath);
    }
    
    return [];
  }

  prepareDashboardData(metrics, analysis, alerts) {
    const now = this.getDeterministicDate();
    
    return {
      generated_at: now.toISOString(),
      generated_at_formatted: format(now, 'PPpp'),
      metrics: metrics || {},
      analysis: analysis || {},
      alerts: alerts || [],
      summary: this.generateSummary(metrics, analysis, alerts),
      charts: this.prepareChartData(metrics, analysis),
      status: this.calculateOverallStatus(metrics, analysis, alerts)
    };
  }

  generateSummary(metrics, analysis, alerts) {
    const summary = {
      total_workflows: 0,
      total_runs: 0,
      success_rate: 0,
      average_duration: 0,
      active_alerts: alerts.length,
      critical_alerts: alerts.filter(a => a.severity === 'critical').length,
      trends: {
        success_rate: 'stable',
        duration: 'stable',
        failure_rate: 'stable'
      }
    };

    if (metrics) {
      summary.total_workflows = Object.keys(metrics.workflows || {}).length;
      summary.total_runs = metrics.summary?.total_runs || 0;
      summary.success_rate = parseFloat(metrics.summary?.success_rate || 0);
      summary.average_duration = parseFloat(metrics.summary?.average_duration_minutes || 0);
    }

    if (analysis?.trends) {
      summary.trends.success_rate = analysis.trends.success_rate?.trend || 'stable';
      summary.trends.duration = analysis.trends.average_duration?.trend || 'stable';
      summary.trends.failure_rate = analysis.trends.failure_rate?.trend || 'stable';
    }

    return summary;
  }

  prepareChartData(metrics, analysis) {
    const charts = {
      success_rate_trend: [],
      duration_trend: [],
      workflow_performance: [],
      daily_runs: [],
      hourly_distribution: []
    };

    // Success rate trend
    if (analysis?.trends?.success_rate?.values) {
      charts.success_rate_trend = analysis.trends.success_rate.values.map((value, index) => ({
        day: index + 1,
        value: parseFloat(value)
      }));
    }

    // Duration trend
    if (analysis?.trends?.average_duration?.values) {
      charts.duration_trend = analysis.trends.average_duration.values.map((value, index) => ({
        day: index + 1,
        value: parseFloat(value)
      }));
    }

    // Workflow performance comparison
    if (metrics?.workflows) {
      charts.workflow_performance = Object.entries(metrics.workflows).map(([name, data]) => ({
        workflow: name,
        success_rate: parseFloat(data.success_rate || 0),
        avg_duration: parseFloat(data.average_duration_minutes || 0),
        total_runs: data.total_runs || 0
      }));
    }

    return charts;
  }

  calculateOverallStatus(metrics, analysis, alerts) {
    const criticalAlerts = alerts.filter(a => a.severity === 'critical').length;
    const warningAlerts = alerts.filter(a => a.severity === 'warning').length;
    
    if (criticalAlerts > 0) {
      return {
        level: 'critical',
        message: `${criticalAlerts} critical issues require immediate attention`,
        color: '#dc3545'
      };
    }
    
    if (warningAlerts > 0) {
      return {
        level: 'warning',
        message: `${warningAlerts} performance warnings detected`,
        color: '#ffc107'
      };
    }
    
    const successRate = parseFloat(metrics?.summary?.success_rate || 100);
    if (successRate < 90) {
      return {
        level: 'warning',
        message: `Success rate (${successRate.toFixed(1)}%) below optimal`,
        color: '#ffc107'
      };
    }
    
    return {
      level: 'healthy',
      message: 'All workflows performing within normal parameters',
      color: '#28a745'
    };
  }

  async generateHTMLDashboard(dashboardData) {
    const htmlContent = this.generateHTMLContent(dashboardData);
    const indexPath = path.join(this.dashboardDir, 'index.html');
    
    await fs.writeFile(indexPath, htmlContent);
    console.log(`📄 HTML dashboard saved to: ${indexPath}`);
  }

  generateHTMLContent(data) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Workflow Monitoring Dashboard</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        .status-healthy { border-left: 4px solid #28a745; }
        .status-warning { border-left: 4px solid #ffc107; }
        .status-critical { border-left: 4px solid #dc3545; }
        .metric-card { transition: transform 0.2s; }
        .metric-card:hover { transform: translateY(-2px); }
        .trend-up { color: #28a745; }
        .trend-down { color: #dc3545; }
        .trend-stable { color: #6c757d; }
        .chart-container { position: relative; height: 300px; }
    </style>
</head>
<body class="bg-light">
    <nav class="navbar navbar-dark bg-primary">
        <div class="container-fluid">
            <span class="navbar-brand mb-0 h1">
                <i class="fas fa-chart-line me-2"></i>
                Workflow Monitoring Dashboard
            </span>
            <span class="navbar-text">
                Last updated: ${data.generated_at_formatted}
            </span>
        </div>
    </nav>

    <div class="container-fluid py-4">
        <!-- Status Overview -->
        <div class="row mb-4">
            <div class="col-12">
                <div class="card status-${data.status.level}">
                    <div class="card-body">
                        <div class="d-flex align-items-center">
                            <div class="flex-grow-1">
                                <h5 class="card-title mb-1">Overall Status</h5>
                                <p class="card-text">${data.status.message}</p>
                            </div>
                            <div class="ms-3">
                                <i class="fas fa-circle" style="color: ${data.status.color}; font-size: 2rem;"></i>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Key Metrics -->
        <div class="row mb-4">
            <div class="col-md-3 mb-3">
                <div class="card metric-card h-100">
                    <div class="card-body text-center">
                        <i class="fas fa-tasks fa-2x text-primary mb-2"></i>
                        <h3 class="card-title">${data.summary.total_workflows}</h3>
                        <p class="card-text text-muted">Total Workflows</p>
                    </div>
                </div>
            </div>
            <div class="col-md-3 mb-3">
                <div class="card metric-card h-100">
                    <div class="card-body text-center">
                        <i class="fas fa-play fa-2x text-info mb-2"></i>
                        <h3 class="card-title">${data.summary.total_runs}</h3>
                        <p class="card-text text-muted">Total Runs</p>
                    </div>
                </div>
            </div>
            <div class="col-md-3 mb-3">
                <div class="card metric-card h-100">
                    <div class="card-body text-center">
                        <i class="fas fa-check-circle fa-2x ${data.summary.success_rate > 90 ? 'text-success' : 'text-warning'} mb-2"></i>
                        <h3 class="card-title">${data.summary.success_rate.toFixed(1)}%</h3>
                        <p class="card-text text-muted">
                            Success Rate
                            <i class="fas fa-arrow-${this.getTrendIcon(data.summary.trends.success_rate)} ms-1 trend-${data.summary.trends.success_rate}"></i>
                        </p>
                    </div>
                </div>
            </div>
            <div class="col-md-3 mb-3">
                <div class="card metric-card h-100">
                    <div class="card-body text-center">
                        <i class="fas fa-clock fa-2x text-secondary mb-2"></i>
                        <h3 class="card-title">${data.summary.average_duration.toFixed(1)}m</h3>
                        <p class="card-text text-muted">
                            Avg Duration
                            <i class="fas fa-arrow-${this.getTrendIcon(data.summary.trends.duration)} ms-1 trend-${data.summary.trends.duration}"></i>
                        </p>
                    </div>
                </div>
            </div>
        </div>

        <!-- Alerts Section -->
        ${data.alerts.length > 0 ? `
        <div class="row mb-4">
            <div class="col-12">
                <div class="card">
                    <div class="card-header">
                        <h5 class="mb-0">
                            <i class="fas fa-exclamation-triangle me-2"></i>
                            Active Alerts (${data.alerts.length})
                        </h5>
                    </div>
                    <div class="card-body">
                        ${data.alerts.map(alert => `
                            <div class="alert alert-${alert.severity === 'critical' ? 'danger' : 'warning'} mb-2">
                                <div class="d-flex justify-content-between align-items-start">
                                    <div>
                                        <strong>${alert.title}</strong>
                                        <p class="mb-1">${alert.description}</p>
                                        <small class="text-muted">${new Date(alert.timestamp).toLocaleString()}</small>
                                    </div>
                                    <span class="badge bg-${alert.severity === 'critical' ? 'danger' : 'warning'}">${alert.severity}</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        </div>
        ` : ''}

        <!-- Charts Section -->
        <div class="row">
            <div class="col-md-6 mb-4">
                <div class="card">
                    <div class="card-header">
                        <h5 class="mb-0">Success Rate Trend</h5>
                    </div>
                    <div class="card-body">
                        <div class="chart-container">
                            <canvas id="successRateChart"></canvas>
                        </div>
                    </div>
                </div>
            </div>
            <div class="col-md-6 mb-4">
                <div class="card">
                    <div class="card-header">
                        <h5 class="mb-0">Duration Trend</h5>
                    </div>
                    <div class="card-body">
                        <div class="chart-container">
                            <canvas id="durationChart"></canvas>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Workflow Performance -->
        <div class="row">
            <div class="col-12">
                <div class="card">
                    <div class="card-header">
                        <h5 class="mb-0">Workflow Performance</h5>
                    </div>
                    <div class="card-body">
                        <div class="table-responsive">
                            <table class="table table-hover">
                                <thead>
                                    <tr>
                                        <th>Workflow</th>
                                        <th>Success Rate</th>
                                        <th>Avg Duration</th>
                                        <th>Total Runs</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${data.charts.workflow_performance.map(workflow => `
                                        <tr>
                                            <td><strong>${workflow.workflow}</strong></td>
                                            <td>
                                                <div class="d-flex align-items-center">
                                                    ${workflow.success_rate.toFixed(1)}%
                                                    <div class="progress ms-2" style="width: 100px; height: 8px;">
                                                        <div class="progress-bar ${workflow.success_rate > 90 ? 'bg-success' : workflow.success_rate > 70 ? 'bg-warning' : 'bg-danger'}" 
                                                             style="width: ${workflow.success_rate}%"></div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>${workflow.avg_duration.toFixed(1)}m</td>
                                            <td>${workflow.total_runs}</td>
                                            <td>
                                                <span class="badge bg-${workflow.success_rate > 90 ? 'success' : workflow.success_rate > 70 ? 'warning' : 'danger'}">
                                                    ${workflow.success_rate > 90 ? 'Healthy' : workflow.success_rate > 70 ? 'Warning' : 'Critical'}
                                                </span>
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script>
        // Success Rate Chart
        const successCtx = document.getElementById('successRateChart').getContext('2d');
        new Chart(successCtx, {
            type: 'line',
            data: {
                labels: ${JSON.stringify(data.charts.success_rate_trend.map(d => `Day ${d.day}`))},
                datasets: [{
                    label: 'Success Rate (%)',
                    data: ${JSON.stringify(data.charts.success_rate_trend.map(d => d.value))},
                    borderColor: '#28a745',
                    backgroundColor: 'rgba(40, 167, 69, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100
                    }
                }
            }
        });

        // Duration Chart
        const durationCtx = document.getElementById('durationChart').getContext('2d');
        new Chart(durationCtx, {
            type: 'line',
            data: {
                labels: ${JSON.stringify(data.charts.duration_trend.map(d => `Day ${d.day}`))},
                datasets: [{
                    label: 'Average Duration (minutes)',
                    data: ${JSON.stringify(data.charts.duration_trend.map(d => d.value))},
                    borderColor: '#007bff',
                    backgroundColor: 'rgba(0, 123, 255, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });

        // Auto-refresh every 5 minutes
        setTimeout(() => {
            window.location.reload();
        }, 300000);
    </script>
</body>
</html>`;
  }

  getTrendIcon(trend) {
    switch (trend) {
      case 'increasing': return 'up';
      case 'decreasing': return 'down';
      default: return 'right';
    }
  }

  async generateJSONDashboard(dashboardData) {
    const jsonPath = path.join(this.dashboardDir, 'dashboard.json');
    await fs.writeJSON(jsonPath, dashboardData, { spaces: 2 });
    console.log(`📊 JSON dashboard saved to: ${jsonPath}`);
  }

  async copyStaticAssets() {
    // Create a simple CSS file for additional styling
    const cssContent = `
/* Additional dashboard styles */
.metric-card {
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  border: none;
}

.status-indicator {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  display: inline-block;
  margin-right: 8px;
}

.workflow-status-healthy {
  background-color: #28a745;
}

.workflow-status-warning {
  background-color: #ffc107;
}

.workflow-status-critical {
  background-color: #dc3545;
}

@media (max-width: 768px) {
  .chart-container {
    height: 250px;
  }
}
`;

    const cssPath = path.join(this.dashboardDir, 'dashboard.css');
    await fs.writeFile(cssPath, cssContent);
  }
}

async function main() {
  try {
    const generator = new DashboardGenerator();
    await generator.generateDashboard();
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = DashboardGenerator;