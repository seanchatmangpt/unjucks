#!/usr/bin/env node

const fs = require('fs-extra');
const path = require('path');
const { program } = require('commander');

program
  .option('--threshold-failure-rate <rate>', 'Failure rate threshold percentage', '15')
  .option('--threshold-duration-increase <percent>', 'Duration increase threshold percentage', '50')
  .option('--threshold-cost-increase <percent>', 'Cost increase threshold percentage', '25')
  .parse();

const options = program.opts();

class DegradationChecker {
  constructor() {
    this.reportDir = path.join(process.cwd(), '.github/monitoring-reports');
    this.thresholds = {
      failureRate: parseFloat(options.thresholdFailureRate),
      durationIncrease: parseFloat(options.thresholdDurationIncrease),
      costIncrease: parseFloat(options.thresholdCostIncrease)
    };
  }

  async checkDegradation() {
    console.log('🔍 Checking for performance degradation');

    try {
      const latestMetrics = await this.loadLatestMetrics();
      const analysisData = await this.loadLatestAnalysis();
      
      const degradationIssues = this.detectDegradation(latestMetrics, analysisData);
      const criticalIssues = degradationIssues.filter(issue => issue.severity === 'critical');
      
      await this.saveDegradationReport(degradationIssues);

      if (criticalIssues.length > 0) {
        console.log(`🚨 Found ${criticalIssues.length} critical performance degradation issues`);
        await this.createEmergencyAlert(criticalIssues);
      } else if (degradationIssues.length > 0) {
        console.log(`⚠️ Found ${degradationIssues.length} performance degradation warnings`);
      } else {
        console.log('✅ No significant performance degradation detected');
      }

      console.log(`::set-output name=degradation_detected::${degradationIssues.length > 0}`);
      console.log(`::set-output name=critical_issues::${criticalIssues.length}`);

      return degradationIssues;

    } catch (error) {
      console.error('❌ Error checking degradation:', error);
      throw error;
    }
  }

  async loadLatestMetrics() {
    const latestPath = path.join(this.reportDir, 'latest-metrics.json');
    
    if (await fs.pathExists(latestPath)) {
      return await fs.readJSON(latestPath);
    }
    
    throw new Error('No latest metrics found');
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

  detectDegradation(metrics, analysis) {
    const issues = [];

    // Check overall failure rate
    const overallFailureRate = this.calculateFailureRate(metrics.summary);
    if (overallFailureRate > this.thresholds.failureRate) {
      issues.push({
        type: 'high_failure_rate',
        severity: overallFailureRate > this.thresholds.failureRate * 1.5 ? 'critical' : 'warning',
        description: `Overall failure rate (${overallFailureRate.toFixed(1)}%) exceeds threshold (${this.thresholds.failureRate}%)`,
        current_value: `${overallFailureRate.toFixed(1)}%`,
        threshold: `${this.thresholds.failureRate}%`,
        impact: 'high',
        category: 'reliability'
      });
    }

    // Check for significant duration increases
    if (analysis?.trends?.average_duration) {
      const durationChange = parseFloat(analysis.trends.average_duration.change_percent);
      if (durationChange > this.thresholds.durationIncrease) {
        issues.push({
          type: 'duration_degradation',
          severity: durationChange > this.thresholds.durationIncrease * 1.5 ? 'critical' : 'warning',
          description: `Average workflow duration increased by ${durationChange.toFixed(1)}%`,
          current_value: `${analysis.trends.average_duration.current} min`,
          previous_value: `${analysis.trends.average_duration.previous} min`,
          change: `+${durationChange.toFixed(1)}%`,
          threshold: `${this.thresholds.durationIncrease}%`,
          impact: 'medium',
          category: 'performance'
        });
      }
    }

    // Check individual workflow degradation
    Object.entries(metrics.workflows || {}).forEach(([workflowName, workflowData]) => {
      const workflowFailureRate = this.calculateFailureRate(workflowData);
      
      if (workflowFailureRate > this.thresholds.failureRate) {
        issues.push({
          type: 'workflow_failure_rate',
          workflow: workflowName,
          severity: workflowFailureRate > this.thresholds.failureRate * 2 ? 'critical' : 'warning',
          description: `Workflow "${workflowName}" failure rate (${workflowFailureRate.toFixed(1)}%) exceeds threshold`,
          current_value: `${workflowFailureRate.toFixed(1)}%`,
          threshold: `${this.thresholds.failureRate}%`,
          impact: 'medium',
          category: 'reliability'
        });
      }

      // Check for workflows with zero success rate (critical)
      if (workflowData.total_runs > 0 && workflowData.successful_runs === 0) {
        issues.push({
          type: 'workflow_complete_failure',
          workflow: workflowName,
          severity: 'critical',
          description: `Workflow "${workflowName}" has 0% success rate with ${workflowData.total_runs} attempts`,
          current_value: '0%',
          total_runs: workflowData.total_runs,
          impact: 'critical',
          category: 'reliability'
        });
      }
    });

    // Check for resource consumption anomalies
    const resourceIssues = this.checkResourceConsumption(metrics, analysis);
    issues.push(...resourceIssues);

    return issues.sort((a, b) => {
      const severityOrder = { critical: 3, warning: 1 };
      return (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0);
    });
  }

  calculateFailureRate(data) {
    if (!data || data.total_runs === 0) return 0;
    return (data.failed_runs / data.total_runs) * 100;
  }

  checkResourceConsumption(metrics, analysis) {
    const issues = [];

    // Estimate cost based on duration (simplified calculation)
    if (metrics.summary.total_duration_minutes) {
      const totalHours = parseFloat(metrics.summary.total_duration_minutes) / 60;
      const estimatedCost = totalHours * 0.008; // Approximate GitHub Actions cost per hour
      
      // Check if we have historical cost data for comparison
      if (analysis?.trends?.average_duration) {
        const previousDuration = parseFloat(analysis.trends.average_duration.previous);
        const currentDuration = parseFloat(analysis.trends.average_duration.current);
        const costIncrease = ((currentDuration - previousDuration) / previousDuration) * 100;
        
        if (costIncrease > this.thresholds.costIncrease) {
          issues.push({
            type: 'cost_increase',
            severity: costIncrease > this.thresholds.costIncrease * 2 ? 'critical' : 'warning',
            description: `Estimated CI/CD costs increased by ${costIncrease.toFixed(1)}% due to longer execution times`,
            change: `+${costIncrease.toFixed(1)}%`,
            threshold: `${this.thresholds.costIncrease}%`,
            estimated_cost: `$${estimatedCost.toFixed(2)}`,
            impact: 'low',
            category: 'cost'
          });
        }
      }
    }

    return issues;
  }

  async saveDegradationReport(issues) {
    const report = {
      check_time: this.getDeterministicDate().toISOString(),
      thresholds_used: this.thresholds,
      degradation_issues: issues,
      summary: {
        total_issues: issues.length,
        critical_issues: issues.filter(i => i.severity === 'critical').length,
        warning_issues: issues.filter(i => i.severity === 'warning').length,
        categories: this.categorizeIssues(issues)
      }
    };

    const reportPath = path.join(this.reportDir, 'degradation-report.json');
    await fs.writeJSON(reportPath, report, { spaces: 2 });

    console.log(`💾 Degradation report saved to: ${reportPath}`);
  }

  categorizeIssues(issues) {
    const categories = {};
    
    issues.forEach(issue => {
      if (!categories[issue.category]) {
        categories[issue.category] = { total: 0, critical: 0, warning: 0 };
      }
      
      categories[issue.category].total++;
      if (issue.severity === 'critical') {
        categories[issue.category].critical++;
      } else if (issue.severity === 'warning') {
        categories[issue.category].warning++;
      }
    });

    return categories;
  }

  async createEmergencyAlert(criticalIssues) {
    const emergencyAlert = {
      alert_type: 'emergency',
      created_at: this.getDeterministicDate().toISOString(),
      title: '🚨 CRITICAL: Workflow Performance Emergency',
      description: `${criticalIssues.length} critical performance issues detected requiring immediate attention`,
      critical_issues: criticalIssues,
      recommended_actions: [
        'Immediately review and potentially disable failing workflows',
        'Check for infrastructure issues or recent changes',
        'Alert the development team and DevOps engineers',
        'Consider rolling back recent changes if applicable',
        'Monitor system closely for recovery'
      ],
      escalation_required: true
    };

    const emergencyPath = path.join(this.reportDir, 'emergency-alert.json');
    await fs.writeJSON(emergencyPath, emergencyAlert, { spaces: 2 });

    // Also create a simple flag file that can be easily checked
    await fs.writeFile(path.join(this.reportDir, 'EMERGENCY'), 'CRITICAL PERFORMANCE ISSUES DETECTED');

    console.log(`🚨 Emergency alert created: ${emergencyPath}`);
  }
}

async function main() {
  try {
    const checker = new DegradationChecker();
    await checker.checkDegradation();
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = DegradationChecker;