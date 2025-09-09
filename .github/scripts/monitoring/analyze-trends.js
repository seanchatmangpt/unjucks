#!/usr/bin/env node

const fs = require('fs-extra');
const path = require('path');
const { program } = require('commander');
const { subDays, format, parseISO } = require('date-fns');

program
  .option('--report-type <type>', 'Report type', 'daily')
  .option('--lookback-days <days>', 'Days to look back for trend analysis', '14')
  .parse();

const options = program.opts();

class TrendAnalyzer {
  constructor() {
    this.reportDir = path.join(process.cwd(), '.github/monitoring-reports');
    this.config = this.loadConfig();
  }

  loadConfig() {
    try {
      return require('./config.json');
    } catch (error) {
      console.error('Failed to load config:', error);
      return { monitoring: { metrics: {} } };
    }
  }

  async analyzeTrends() {
    console.log('📊 Analyzing workflow performance trends');

    try {
      const historicalData = await this.loadHistoricalData();
      const trends = this.calculateTrends(historicalData);
      const anomalies = this.detectAnomalies(historicalData, trends);
      const alerts = this.generateAlerts(trends, anomalies);

      const analysis = {
        analysis_time: new Date().toISOString(),
        period_analyzed: {
          days: options.lookbackDays,
          from: subDays(new Date(), parseInt(options.lookbackDays)).toISOString(),
          to: new Date().toISOString()
        },
        trends,
        anomalies,
        alerts,
        recommendations: this.generateRecommendations(trends, anomalies)
      };

      await this.saveAnalysis(analysis);

      const alertsTriggered = alerts.length > 0;
      console.log(`::set-output name=success::true`);
      console.log(`::set-output name=alerts::${alertsTriggered}`);

      console.log(`✅ Trend analysis completed. ${alerts.length} alerts generated.`);
      return analysis;

    } catch (error) {
      console.error('❌ Error analyzing trends:', error);
      console.log(`::set-output name=success::false`);
      throw error;
    }
  }

  async loadHistoricalData() {
    const reportType = options.reportType;
    const lookbackDays = parseInt(options.lookbackDays);
    const reportPath = path.join(this.reportDir, reportType);
    
    const historicalData = [];

    for (let i = 0; i < lookbackDays; i++) {
      const date = subDays(new Date(), i);
      const dateStr = format(date, 'yyyy-MM-dd');
      const filePath = path.join(reportPath, `metrics-${dateStr}.json`);

      if (await fs.pathExists(filePath)) {
        try {
          const data = await fs.readJSON(filePath);
          historicalData.push({
            date: dateStr,
            ...data
          });
        } catch (error) {
          console.warn(`⚠️ Failed to load data for ${dateStr}:`, error.message);
        }
      }
    }

    console.log(`📚 Loaded ${historicalData.length} days of historical data`);
    return historicalData.reverse(); // Sort chronologically
  }

  calculateTrends(historicalData) {
    if (historicalData.length < 2) {
      return { insufficient_data: true };
    }

    const trends = {
      success_rate: this.calculateTrend(historicalData, 'summary.success_rate'),
      average_duration: this.calculateTrend(historicalData, 'summary.average_duration_minutes'),
      total_runs: this.calculateTrend(historicalData, 'summary.total_runs'),
      failure_rate: this.calculateFailureRateTrend(historicalData),
      workflow_trends: this.calculateWorkflowTrends(historicalData)
    };

    return trends;
  }

  calculateTrend(data, property) {
    const values = data.map(d => this.getNestedProperty(d, property)).filter(v => v !== undefined);
    
    if (values.length < 2) {
      return { trend: 'insufficient_data', values: values.length };
    }

    const recent = values.slice(-3).reduce((sum, v) => sum + parseFloat(v), 0) / Math.min(3, values.length);
    const older = values.slice(0, -3).reduce((sum, v) => sum + parseFloat(v), 0) / Math.max(1, values.length - 3);
    
    const change = ((recent - older) / older) * 100;
    
    return {
      current: recent.toFixed(2),
      previous: older.toFixed(2),
      change_percent: change.toFixed(2),
      trend: Math.abs(change) < 5 ? 'stable' : change > 0 ? 'increasing' : 'decreasing',
      values: values
    };
  }

  calculateFailureRateTrend(data) {
    const failureRates = data.map(d => {
      const total = d.summary?.total_runs || 0;
      const failed = d.summary?.failed_runs || 0;
      return total > 0 ? (failed / total) * 100 : 0;
    });

    return this.calculateTrendFromValues(failureRates, 'failure_rate');
  }

  calculateTrendFromValues(values, name) {
    if (values.length < 2) {
      return { trend: 'insufficient_data', name };
    }

    const recent = values.slice(-3).reduce((sum, v) => sum + v, 0) / Math.min(3, values.length);
    const older = values.slice(0, -3).reduce((sum, v) => sum + v, 0) / Math.max(1, values.length - 3);
    
    const change = older === 0 ? 0 : ((recent - older) / older) * 100;
    
    return {
      current: recent.toFixed(2),
      previous: older.toFixed(2),
      change_percent: change.toFixed(2),
      trend: Math.abs(change) < 5 ? 'stable' : change > 0 ? 'increasing' : 'decreasing',
      values
    };
  }

  calculateWorkflowTrends(data) {
    const workflowTrends = {};
    
    // Get all unique workflow names
    const allWorkflows = new Set();
    data.forEach(d => {
      if (d.workflows) {
        Object.keys(d.workflows).forEach(name => allWorkflows.add(name));
      }
    });

    // Calculate trends for each workflow
    allWorkflows.forEach(workflowName => {
      const workflowData = data.map(d => d.workflows?.[workflowName]).filter(Boolean);
      
      if (workflowData.length >= 2) {
        workflowTrends[workflowName] = {
          success_rate: this.calculateTrendFromValues(
            workflowData.map(w => parseFloat(w.success_rate) || 0),
            'success_rate'
          ),
          avg_duration: this.calculateTrendFromValues(
            workflowData.map(w => parseFloat(w.average_duration_minutes) || 0),
            'duration'
          ),
          total_runs: this.calculateTrendFromValues(
            workflowData.map(w => w.total_runs || 0),
            'runs'
          )
        };
      }
    });

    return workflowTrends;
  }

  detectAnomalies(historicalData, trends) {
    const anomalies = [];

    // Detect success rate anomalies
    if (trends.success_rate?.trend === 'decreasing') {
      const changePercent = Math.abs(parseFloat(trends.success_rate.change_percent));
      if (changePercent > 10) {
        anomalies.push({
          type: 'success_rate_drop',
          severity: changePercent > 20 ? 'critical' : 'warning',
          description: `Success rate decreased by ${changePercent.toFixed(1)}%`,
          current_value: trends.success_rate.current,
          previous_value: trends.success_rate.previous
        });
      }
    }

    // Detect duration anomalies
    if (trends.average_duration?.trend === 'increasing') {
      const changePercent = parseFloat(trends.average_duration.change_percent);
      if (changePercent > 30) {
        anomalies.push({
          type: 'duration_increase',
          severity: changePercent > 50 ? 'critical' : 'warning',
          description: `Average duration increased by ${changePercent.toFixed(1)}%`,
          current_value: `${trends.average_duration.current} min`,
          previous_value: `${trends.average_duration.previous} min`
        });
      }
    }

    // Detect failure rate spikes
    if (trends.failure_rate?.trend === 'increasing') {
      const currentFailureRate = parseFloat(trends.failure_rate.current);
      if (currentFailureRate > 15) {
        anomalies.push({
          type: 'failure_rate_spike',
          severity: currentFailureRate > 25 ? 'critical' : 'warning',
          description: `Failure rate spiked to ${currentFailureRate.toFixed(1)}%`,
          current_value: `${currentFailureRate.toFixed(1)}%`,
          threshold: '15%'
        });
      }
    }

    // Detect workflow-specific anomalies
    Object.entries(trends.workflow_trends || {}).forEach(([workflowName, workflowTrends]) => {
      if (workflowTrends.success_rate?.trend === 'decreasing') {
        const changePercent = Math.abs(parseFloat(workflowTrends.success_rate.change_percent));
        if (changePercent > 15) {
          anomalies.push({
            type: 'workflow_degradation',
            workflow: workflowName,
            severity: changePercent > 30 ? 'critical' : 'warning',
            description: `Workflow "${workflowName}" success rate decreased by ${changePercent.toFixed(1)}%`,
            current_value: workflowTrends.success_rate.current,
            previous_value: workflowTrends.success_rate.previous
          });
        }
      }
    });

    return anomalies;
  }

  generateAlerts(trends, anomalies) {
    const alerts = [];

    anomalies.forEach(anomaly => {
      if (anomaly.severity === 'critical' || anomaly.severity === 'warning') {
        alerts.push({
          id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          title: this.getAlertTitle(anomaly),
          description: anomaly.description,
          severity: anomaly.severity,
          type: anomaly.type,
          workflow: anomaly.workflow,
          timestamp: new Date().toISOString(),
          metrics: this.getAlertMetrics(anomaly),
          recommendations: this.getAlertRecommendations(anomaly)
        });
      }
    });

    return alerts;
  }

  getAlertTitle(anomaly) {
    const titleMap = {
      success_rate_drop: '🔻 Workflow Success Rate Declining',
      duration_increase: '⏱️ Workflow Duration Increasing',
      failure_rate_spike: '🚨 High Failure Rate Detected',
      workflow_degradation: `⚠️ Workflow Performance Degradation: ${anomaly.workflow}`
    };

    return titleMap[anomaly.type] || '⚠️ Performance Alert';
  }

  getAlertMetrics(anomaly) {
    const metrics = [];

    if (anomaly.current_value) {
      metrics.push(`Current: ${anomaly.current_value}`);
    }
    if (anomaly.previous_value) {
      metrics.push(`Previous: ${anomaly.previous_value}`);
    }
    if (anomaly.threshold) {
      metrics.push(`Threshold: ${anomaly.threshold}`);
    }

    return metrics;
  }

  getAlertRecommendations(anomaly) {
    const recommendationMap = {
      success_rate_drop: [
        'Review recent workflow changes and commits',
        'Check for infrastructure issues or dependency changes',
        'Analyze failure patterns in workflow logs'
      ],
      duration_increase: [
        'Profile workflow jobs to identify bottlenecks',
        'Check for resource contention or queue delays',
        'Consider workflow optimization or parallelization'
      ],
      failure_rate_spike: [
        'Investigate common failure patterns',
        'Review test stability and flakiness',
        'Check external dependencies and services'
      ],
      workflow_degradation: [
        'Focus investigation on the specific workflow',
        'Review workflow-specific changes and dependencies',
        'Consider workflow rollback if critical'
      ]
    };

    return recommendationMap[anomaly.type] || ['Investigate the root cause of the performance issue'];
  }

  generateRecommendations(trends, anomalies) {
    const recommendations = [];

    // General performance recommendations
    if (trends.average_duration?.trend === 'increasing') {
      recommendations.push({
        priority: 'medium',
        category: 'performance',
        title: 'Optimize Workflow Duration',
        description: 'Consider parallelizing jobs, caching dependencies, or optimizing test suites'
      });
    }

    if (trends.failure_rate?.current > 5) {
      recommendations.push({
        priority: 'high',
        category: 'reliability',
        title: 'Improve Workflow Reliability',
        description: 'Investigate and fix common failure patterns to improve overall reliability'
      });
    }

    // Anomaly-based recommendations
    const criticalAnomalies = anomalies.filter(a => a.severity === 'critical');
    if (criticalAnomalies.length > 0) {
      recommendations.push({
        priority: 'critical',
        category: 'urgent',
        title: 'Address Critical Performance Issues',
        description: `${criticalAnomalies.length} critical performance issues detected requiring immediate attention`
      });
    }

    return recommendations;
  }

  getNestedProperty(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  async saveAnalysis(analysis) {
    const analysisDir = path.join(this.reportDir, 'analysis');
    await fs.ensureDir(analysisDir);

    const timestamp = format(new Date(), 'yyyy-MM-dd-HH-mm');
    const analysisPath = path.join(analysisDir, `trends-${timestamp}.json`);
    
    await fs.writeJSON(analysisPath, analysis, { spaces: 2 });

    // Save alerts separately for easier access
    if (analysis.alerts.length > 0) {
      const alertsPath = path.join(this.reportDir, 'alerts.json');
      await fs.writeJSON(alertsPath, analysis.alerts, { spaces: 2 });
    }

    console.log(`💾 Analysis saved to: ${analysisPath}`);
  }
}

async function main() {
  try {
    const analyzer = new TrendAnalyzer();
    await analyzer.analyzeTrends();
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = TrendAnalyzer;