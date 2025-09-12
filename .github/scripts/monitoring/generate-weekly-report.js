#!/usr/bin/env node

const fs = require('fs-extra');
const path = require('path');
const { subDays, format, startOfWeek, endOfWeek } = require('date-fns');

class WeeklyReportGenerator {
  constructor() {
    this.reportDir = path.join(process.cwd(), '.github/monitoring-reports');
    this.weeklyDir = path.join(this.reportDir, 'weekly');
  }

  async generateWeeklyReport() {
    console.log('📈 Generating weekly workflow report');

    try {
      await fs.ensureDir(this.weeklyDir);

      const weekData = await this.collectWeeklyData();
      const report = this.generateReport(weekData);
      
      await this.saveReport(report);
      await this.generateMarkdownReport(report);

      console.log('✅ Weekly report generated successfully');
      return report;

    } catch (error) {
      console.error('❌ Error generating weekly report:', error);
      throw error;
    }
  }

  async collectWeeklyData() {
    const now = this.getDeterministicDate();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 }); // Monday
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 }); // Sunday
    
    const weeklyData = [];
    const alertsData = [];
    
    // Collect daily metrics for the past week
    for (let i = 0; i < 7; i++) {
      const date = subDays(now, i);
      const dateStr = format(date, 'yyyy-MM-dd');
      const dailyPath = path.join(this.reportDir, 'daily', `metrics-${dateStr}.json`);
      
      if (await fs.pathExists(dailyPath)) {
        try {
          const dailyData = await fs.readJSON(dailyPath);
          weeklyData.push({
            date: dateStr,
            dayOfWeek: format(date, 'EEEE'),
            ...dailyData
          });
        } catch (error) {
          console.warn(`⚠️ Failed to load data for ${dateStr}:`, error.message);
        }
      }
    }

    // Collect alerts from the past week
    const analysisDir = path.join(this.reportDir, 'analysis');
    if (await fs.pathExists(analysisDir)) {
      const analysisFiles = await fs.readdir(analysisDir);
      
      for (const file of analysisFiles) {
        if (file.startsWith('trends-') && file.endsWith('.json')) {
          try {
            const analysisData = await fs.readJSON(path.join(analysisDir, file));
            if (analysisData.alerts) {
              alertsData.push(...analysisData.alerts);
            }
          } catch (error) {
            console.warn(`⚠️ Failed to load analysis file ${file}:`, error.message);
          }
        }
      }
    }

    return {
      period: {
        start: format(weekStart, 'yyyy-MM-dd'),
        end: format(weekEnd, 'yyyy-MM-dd'),
        start_formatted: format(weekStart, 'PPP'),
        end_formatted: format(weekEnd, 'PPP')
      },
      daily_data: weeklyData.reverse(), // Chronological order
      alerts: alertsData.filter(alert => {
        const alertDate = new Date(alert.timestamp);
        return alertDate >= weekStart && alertDate <= weekEnd;
      })
    };
  }

  generateReport(weekData) {
    const report = {
      generated_at: this.getDeterministicDate().toISOString(),
      report_type: 'weekly',
      period: weekData.period,
      summary: this.generateSummary(weekData.daily_data),
      trends: this.analyzeTrends(weekData.daily_data),
      alerts_summary: this.analyzeAlerts(weekData.alerts),
      workflow_insights: this.generateWorkflowInsights(weekData.daily_data),
      recommendations: this.generateRecommendations(weekData),
      key_metrics: this.calculateKeyMetrics(weekData.daily_data)
    };

    return report;
  }

  generateSummary(dailyData) {
    if (dailyData.length === 0) {
      return { no_data: true };
    }

    const totalMetrics = dailyData.reduce((acc, day) => {
      const summary = day.summary || {};
      return {
        total_runs: acc.total_runs + (summary.total_runs || 0),
        successful_runs: acc.successful_runs + (summary.successful_runs || 0),
        failed_runs: acc.failed_runs + (summary.failed_runs || 0),
        cancelled_runs: acc.cancelled_runs + (summary.cancelled_runs || 0),
        total_duration: acc.total_duration + parseFloat(summary.total_duration_minutes || 0)
      };
    }, { total_runs: 0, successful_runs: 0, failed_runs: 0, cancelled_runs: 0, total_duration: 0 });

    const avgSuccessRate = dailyData.reduce((sum, day) => {
      return sum + parseFloat(day.summary?.success_rate || 0);
    }, 0) / dailyData.length;

    const avgDuration = dailyData.reduce((sum, day) => {
      return sum + parseFloat(day.summary?.average_duration_minutes || 0);
    }, 0) / dailyData.length;

    return {
      days_with_data: dailyData.length,
      total_workflow_runs: totalMetrics.total_runs,
      overall_success_rate: avgSuccessRate.toFixed(2),
      total_duration_hours: (totalMetrics.total_duration / 60).toFixed(2),
      average_daily_runs: Math.round(totalMetrics.total_runs / dailyData.length),
      average_duration_minutes: avgDuration.toFixed(2),
      failure_analysis: {
        total_failures: totalMetrics.failed_runs,
        failure_rate: totalMetrics.total_runs > 0 ? 
          ((totalMetrics.failed_runs / totalMetrics.total_runs) * 100).toFixed(2) : 0,
        cancelled_runs: totalMetrics.cancelled_runs
      }
    };
  }

  analyzeTrends(dailyData) {
    if (dailyData.length < 2) {
      return { insufficient_data: true };
    }

    const firstHalf = dailyData.slice(0, Math.floor(dailyData.length / 2));
    const secondHalf = dailyData.slice(Math.floor(dailyData.length / 2));

    const getAverage = (data, property) => {
      const values = data.map(d => parseFloat(d.summary?.[property] || 0));
      return values.reduce((sum, v) => sum + v, 0) / values.length;
    };

    const trends = {
      success_rate: {
        first_half: getAverage(firstHalf, 'success_rate').toFixed(2),
        second_half: getAverage(secondHalf, 'success_rate').toFixed(2),
        direction: 'stable'
      },
      duration: {
        first_half: getAverage(firstHalf, 'average_duration_minutes').toFixed(2),
        second_half: getAverage(secondHalf, 'average_duration_minutes').toFixed(2),
        direction: 'stable'
      },
      volume: {
        first_half: Math.round(getAverage(firstHalf, 'total_runs')),
        second_half: Math.round(getAverage(secondHalf, 'total_runs')),
        direction: 'stable'
      }
    };

    // Determine trend directions
    Object.keys(trends).forEach(key => {
      const first = parseFloat(trends[key].first_half);
      const second = parseFloat(trends[key].second_half);
      const change = ((second - first) / first) * 100;
      
      if (Math.abs(change) > 10) {
        trends[key].direction = change > 0 ? 'increasing' : 'decreasing';
        trends[key].change_percent = change.toFixed(1);
      }
    });

    return trends;
  }

  analyzeAlerts(alerts) {
    const alertsByType = {};
    const alertsBySeverity = { critical: 0, warning: 0 };
    const alertsByDay = {};

    alerts.forEach(alert => {
      // By type
      if (!alertsByType[alert.type]) {
        alertsByType[alert.type] = 0;
      }
      alertsByType[alert.type]++;

      // By severity
      if (alertsBySeverity.hasOwnProperty(alert.severity)) {
        alertsBySeverity[alert.severity]++;
      }

      // By day
      const day = format(new Date(alert.timestamp), 'yyyy-MM-dd');
      if (!alertsByDay[day]) {
        alertsByDay[day] = 0;
      }
      alertsByDay[day]++;
    });

    return {
      total_alerts: alerts.length,
      by_severity: alertsBySeverity,
      by_type: alertsByType,
      by_day: alertsByDay,
      most_common_type: Object.keys(alertsByType).reduce((a, b) => 
        alertsByType[a] > alertsByType[b] ? a : b, Object.keys(alertsByType)[0] || 'none'
      )
    };
  }

  generateWorkflowInsights(dailyData) {
    const workflowStats = {};
    
    dailyData.forEach(day => {
      if (day.workflows) {
        Object.entries(day.workflows).forEach(([workflowName, workflowData]) => {
          if (!workflowStats[workflowName]) {
            workflowStats[workflowName] = {
              total_runs: 0,
              successful_runs: 0,
              failed_runs: 0,
              total_duration: 0,
              days_active: 0
            };
          }
          
          workflowStats[workflowName].total_runs += workflowData.total_runs || 0;
          workflowStats[workflowName].successful_runs += workflowData.successful_runs || 0;
          workflowStats[workflowName].failed_runs += workflowData.failed_runs || 0;
          workflowStats[workflowName].total_duration += parseFloat(workflowData.total_duration_minutes || 0);
          workflowStats[workflowName].days_active++;
        });
      }
    });

    // Calculate insights for each workflow
    const insights = Object.entries(workflowStats).map(([name, stats]) => {
      const successRate = stats.total_runs > 0 ? 
        ((stats.successful_runs / stats.total_runs) * 100) : 0;
      const avgDuration = stats.total_runs > 0 ? 
        (stats.total_duration / stats.total_runs) : 0;
      
      return {
        workflow: name,
        success_rate: successRate.toFixed(2),
        average_duration_minutes: avgDuration.toFixed(2),
        total_runs: stats.total_runs,
        days_active: stats.days_active,
        reliability_score: this.calculateReliabilityScore(successRate, stats.days_active),
        performance_rating: this.getPerformanceRating(successRate, avgDuration)
      };
    }).sort((a, b) => b.total_runs - a.total_runs);

    return {
      total_workflows: insights.length,
      most_active: insights[0]?.workflow || 'none',
      best_performer: insights.reduce((best, current) => 
        parseFloat(current.success_rate) > parseFloat(best?.success_rate || 0) ? current : best, null
      ),
      workflows: insights.slice(0, 10) // Top 10 most active workflows
    };
  }

  calculateReliabilityScore(successRate, daysActive) {
    // Simple reliability score based on success rate and consistency
    const consistencyBonus = daysActive >= 5 ? 10 : (daysActive / 5) * 10;
    return Math.min(100, successRate + consistencyBonus).toFixed(1);
  }

  getPerformanceRating(successRate, avgDuration) {
    if (successRate >= 95 && avgDuration <= 10) return 'Excellent';
    if (successRate >= 90 && avgDuration <= 20) return 'Good';
    if (successRate >= 80 && avgDuration <= 30) return 'Fair';
    return 'Needs Improvement';
  }

  generateRecommendations(weekData) {
    const recommendations = [];
    const summary = this.generateSummary(weekData.daily_data);
    const alerts = this.analyzeAlerts(weekData.alerts);

    // Success rate recommendations
    const successRate = parseFloat(summary.overall_success_rate);
    if (successRate < 90) {
      recommendations.push({
        type: 'reliability',
        priority: successRate < 80 ? 'high' : 'medium',
        title: 'Improve Workflow Reliability',
        description: `Overall success rate (${successRate}%) is below optimal. Consider investigating common failure patterns.`,
        actions: [
          'Review failed workflow logs for common issues',
          'Implement retry mechanisms for transient failures',
          'Consider splitting complex workflows into smaller, more reliable parts'
        ]
      });
    }

    // Duration recommendations
    const avgDuration = parseFloat(summary.average_duration_minutes);
    if (avgDuration > 15) {
      recommendations.push({
        type: 'performance',
        priority: 'medium',
        title: 'Optimize Workflow Duration',
        description: `Average workflow duration (${avgDuration} min) could be optimized.`,
        actions: [
          'Implement caching for dependencies and build artifacts',
          'Parallelize independent jobs where possible',
          'Consider using faster runner types for critical workflows'
        ]
      });
    }

    // Alert-based recommendations
    if (alerts.total_alerts > 5) {
      recommendations.push({
        type: 'monitoring',
        priority: 'high',
        title: 'Address Recurring Performance Issues',
        description: `${alerts.total_alerts} alerts generated this week, indicating recurring issues.`,
        actions: [
          'Investigate and fix root causes of recurring alerts',
          'Consider adjusting alert thresholds if they are too sensitive',
          'Implement automated remediation for common issues'
        ]
      });
    }

    // Cost optimization
    const totalHours = parseFloat(summary.total_duration_hours);
    if (totalHours > 100) {
      recommendations.push({
        type: 'cost',
        priority: 'low',
        title: 'Consider Cost Optimization',
        description: `High CI/CD usage (${totalHours} hours) this week may impact costs.`,
        actions: [
          'Review workflow triggers to avoid unnecessary runs',
          'Optimize workflows to reduce execution time',
          'Consider using self-hosted runners for cost savings'
        ]
      });
    }

    return recommendations;
  }

  calculateKeyMetrics(dailyData) {
    if (dailyData.length === 0) {
      return {};
    }

    const latestDay = dailyData[dailyData.length - 1];
    const previousDay = dailyData[dailyData.length - 2];

    return {
      current_success_rate: parseFloat(latestDay.summary?.success_rate || 0),
      previous_success_rate: parseFloat(previousDay?.summary?.success_rate || 0),
      success_rate_change: previousDay ? 
        (parseFloat(latestDay.summary?.success_rate || 0) - parseFloat(previousDay.summary?.success_rate || 0)).toFixed(2) : 0,
      
      current_avg_duration: parseFloat(latestDay.summary?.average_duration_minutes || 0),
      previous_avg_duration: parseFloat(previousDay?.summary?.average_duration_minutes || 0),
      duration_change: previousDay ? 
        (parseFloat(latestDay.summary?.average_duration_minutes || 0) - parseFloat(previousDay.summary?.average_duration_minutes || 0)).toFixed(2) : 0,
      
      total_workflows_monitored: Object.keys(latestDay.workflows || {}).length,
      most_active_day: this.findMostActiveDay(dailyData)
    };
  }

  findMostActiveDay(dailyData) {
    let mostActiveDay = null;
    let maxRuns = 0;

    dailyData.forEach(day => {
      const runs = day.summary?.total_runs || 0;
      if (runs > maxRuns) {
        maxRuns = runs;
        mostActiveDay = {
          date: day.date,
          day_name: day.dayOfWeek || format(new Date(day.date), 'EEEE'),
          total_runs: runs
        };
      }
    });

    return mostActiveDay;
  }

  async saveReport(report) {
    const timestamp = format(this.getDeterministicDate(), 'yyyy-MM-dd');
    const reportPath = path.join(this.weeklyDir, `weekly-report-${timestamp}.json`);
    
    await fs.writeJSON(reportPath, report, { spaces: 2 });
    
    // Also save as latest
    const latestPath = path.join(this.weeklyDir, 'latest-weekly-report.json');
    await fs.writeJSON(latestPath, report, { spaces: 2 });
    
    console.log(`💾 Weekly report saved to: ${reportPath}`);
  }

  async generateMarkdownReport(report) {
    const markdown = this.generateMarkdownContent(report);
    const timestamp = format(this.getDeterministicDate(), 'yyyy-MM-dd');
    const markdownPath = path.join(this.weeklyDir, `weekly-report-${timestamp}.md`);
    
    await fs.writeFile(markdownPath, markdown);
    console.log(`📄 Markdown report saved to: ${markdownPath}`);
  }

  generateMarkdownContent(report) {
    const { summary, trends, alerts_summary, workflow_insights, recommendations, key_metrics } = report;
    
    return `# Weekly Workflow Report

**Period:** ${report.period.start_formatted} - ${report.period.end_formatted}  
**Generated:** ${format(new Date(report.generated_at), 'PPpp')}

## Executive Summary

- **Total Workflow Runs:** ${summary.total_workflow_runs}
- **Overall Success Rate:** ${summary.overall_success_rate}%
- **Total Duration:** ${summary.total_duration_hours} hours
- **Active Alerts:** ${alerts_summary.total_alerts}

## Key Metrics

| Metric | Current | Previous | Change |
|--------|---------|----------|---------|
| Success Rate | ${key_metrics.current_success_rate}% | ${key_metrics.previous_success_rate}% | ${key_metrics.success_rate_change > 0 ? '+' : ''}${key_metrics.success_rate_change}% |
| Avg Duration | ${key_metrics.current_avg_duration}min | ${key_metrics.previous_avg_duration}min | ${key_metrics.duration_change > 0 ? '+' : ''}${key_metrics.duration_change}min |

## Performance Trends

### Success Rate
- **First Half of Week:** ${trends.success_rate?.first_half}%
- **Second Half of Week:** ${trends.success_rate?.second_half}%
- **Trend:** ${trends.success_rate?.direction} ${trends.success_rate?.change_percent ? `(${trends.success_rate.change_percent}%)` : ''}

### Duration
- **First Half of Week:** ${trends.duration?.first_half} minutes
- **Second Half of Week:** ${trends.duration?.second_half} minutes
- **Trend:** ${trends.duration?.direction} ${trends.duration?.change_percent ? `(${trends.duration.change_percent}%)` : ''}

## Alert Summary

${alerts_summary.total_alerts > 0 ? `
- **Total Alerts:** ${alerts_summary.total_alerts}
- **Critical:** ${alerts_summary.by_severity.critical}
- **Warning:** ${alerts_summary.by_severity.warning}
- **Most Common Type:** ${alerts_summary.most_common_type}

### Alerts by Day
${Object.entries(alerts_summary.by_day).map(([day, count]) => `- **${day}:** ${count} alerts`).join('\n')}
` : 'No alerts generated this week. ✅'}

## Workflow Performance

**Total Workflows Monitored:** ${workflow_insights.total_workflows}  
**Most Active Workflow:** ${workflow_insights.most_active}  
**Best Performer:** ${workflow_insights.best_performer?.workflow} (${workflow_insights.best_performer?.success_rate}% success rate)

### Top Workflows

| Workflow | Success Rate | Avg Duration | Total Runs | Performance |
|----------|--------------|--------------|------------|-------------|
${workflow_insights.workflows.slice(0, 5).map(w => 
  `| ${w.workflow} | ${w.success_rate}% | ${w.average_duration_minutes}min | ${w.total_runs} | ${w.performance_rating} |`
).join('\n')}

## Recommendations

${recommendations.length > 0 ? recommendations.map(rec => `
### ${rec.title} (${rec.priority} priority)

${rec.description}

**Recommended Actions:**
${rec.actions.map(action => `- ${action}`).join('\n')}
`).join('\n') : 'No specific recommendations this week. Keep up the good work! ✅'}

## Most Active Day

${key_metrics.most_active_day ? 
  `**${key_metrics.most_active_day.day_name}, ${key_metrics.most_active_day.date}** with ${key_metrics.most_active_day.total_runs} workflow runs` : 
  'Data not available'
}

---

*This report was automatically generated by the Workflow Monitoring System.*
`;
  }
}

async function main() {
  try {
    const generator = new WeeklyReportGenerator();
    await generator.generateWeeklyReport();
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = WeeklyReportGenerator;