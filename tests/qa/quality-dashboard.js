#!/usr/bin/env node

/**
 * Quality Metrics Dashboard
 * Collects, aggregates, and reports quality metrics
 */

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

class QualityDashboard {
  constructor() {
    this.reportsDir = path.join(projectRoot, 'tests/reports');
    this.metricsFile = path.join(this.reportsDir, 'quality-metrics.json');
    this.dashboardFile = path.join(this.reportsDir, 'quality-dashboard.html');
  }

  async collectMetrics() {
    console.log('📊 Collecting Quality Metrics...');
    
    await fs.ensureDir(this.reportsDir);
    
    const metrics = {
      timestamp: this.getDeterministicDate().toISOString(),
      coverage: await this.getCoverageMetrics(),
      performance: await this.getPerformanceMetrics(),
      workflows: await this.getWorkflowMetrics(),
      e2e: await this.getE2EMetrics(),
      qualityGates: await this.getQualityGateMetrics(),
      trends: await this.calculateTrends(),
      score: 0 // Will be calculated
    };
    
    metrics.score = this.calculateQualityScore(metrics);
    
    await this.saveMetrics(metrics);
    await this.generateDashboard(metrics);
    
    return metrics;
  }

  async getCoverageMetrics() {
    const coverageFile = path.join(this.reportsDir, 'coverage-report.json');
    
    if (!await fs.pathExists(coverageFile)) {
      return {
        statements: 0,
        branches: 0,
        functions: 0,
        lines: 0,
        passed: false,
        available: false
      };
    }
    
    const coverage = await fs.readJSON(coverageFile);
    
    return {
      statements: coverage.coverage?.statements || 0,
      branches: coverage.coverage?.branches || 0,
      functions: coverage.coverage?.functions || 0,
      lines: coverage.coverage?.lines || 0,
      passed: coverage.passed?.overall || false,
      filesAnalyzed: coverage.files?.length || 0,
      available: true
    };
  }

  async getPerformanceMetrics() {
    const perfFile = path.join(this.reportsDir, 'performance-report.json');
    
    if (!await fs.pathExists(perfFile)) {
      return {
        benchmarks: 0,
        passed: 0,
        failed: 0,
        avgDuration: 0,
        available: false
      };
    }
    
    const perf = await fs.readJSON(perfFile);
    
    const avgDuration = perf.results?.reduce((sum, r) => {
      return sum + (r.metrics?.avgDuration || 0);
    }, 0) / (perf.results?.length || 1);
    
    return {
      benchmarks: perf.totalBenchmarks || 0,
      passed: perf.passed || 0,
      failed: perf.failed || 0,
      avgDuration: Math.round(avgDuration),
      available: true
    };
  }

  async getWorkflowMetrics() {
    const workflowFile = path.join(this.reportsDir, 'workflow-validation.json');
    
    if (!await fs.pathExists(workflowFile)) {
      return {
        total: 0,
        passed: 0,
        failed: 0,
        critical: 0,
        criticalFailed: 0,
        available: false
      };
    }
    
    const workflow = await fs.readJSON(workflowFile);
    
    return {
      total: workflow.totalWorkflows || 0,
      passed: workflow.passed || 0,
      failed: workflow.failed || 0,
      critical: workflow.results?.filter(r => r.critical).length || 0,
      criticalFailed: workflow.criticalFailed || 0,
      available: true
    };
  }

  async getE2EMetrics() {
    const e2eFile = path.join(this.reportsDir, 'e2e-report.json');
    
    if (!await fs.pathExists(e2eFile)) {
      return {
        journeys: 0,
        passed: 0,
        failed: 0,
        avgSteps: 0,
        available: false
      };
    }
    
    const e2e = await fs.readJSON(e2eFile);
    
    const avgSteps = e2e.results?.reduce((sum, r) => {
      return sum + (r.totalSteps || 0);
    }, 0) / (e2e.results?.length || 1);
    
    return {
      journeys: e2e.totalJourneys || 0,
      passed: e2e.passed || 0,
      failed: e2e.failed || 0,
      avgSteps: Math.round(avgSteps),
      available: true
    };
  }

  async getQualityGateMetrics() {
    const gatesFile = path.join(this.reportsDir, 'quality-gates.json');
    
    if (!await fs.pathExists(gatesFile)) {
      return {
        gates: 0,
        passed: 0,
        failed: 0,
        status: 'unknown',
        available: false
      };
    }
    
    const gates = await fs.readJSON(gatesFile);
    
    return {
      gates: gates.totalGates || 0,
      passed: gates.passedGates || 0,
      failed: gates.failedGates || 0,
      status: gates.status || 'unknown',
      duration: gates.totalDuration || 0,
      available: true
    };
  }

  async calculateTrends() {
    const historyFiles = [
      'coverage-history.json',
      'performance-history.json'
    ];
    
    const trends = {};
    
    for (const file of historyFiles) {
      const filepath = path.join(this.reportsDir, file);
      
      if (await fs.pathExists(filepath)) {
        const history = await fs.readJSON(filepath);
        
        if (history.length >= 2) {
          const recent = history.slice(-5);
          const category = file.replace('-history.json', '');
          
          trends[category] = this.calculateTrend(recent, category);
        }
      }
    }
    
    return trends;
  }

  calculateTrend(data, category) {
    if (data.length < 2) return { trend: 'insufficient-data', change: 0 };
    
    const current = data[data.length - 1];
    const previous = data[data.length - 2];
    
    let metricValue, previousValue;
    
    if (category === 'coverage') {
      metricValue = current.coverage?.statements || 0;
      previousValue = previous.coverage?.statements || 0;
    } else if (category === 'performance') {
      metricValue = current.summary?.reduce((sum, s) => sum + (s.avgDuration || 0), 0) / current.summary?.length || 0;
      previousValue = previous.summary?.reduce((sum, s) => sum + (s.avgDuration || 0), 0) / previous.summary?.length || 0;
    }
    
    const change = metricValue - previousValue;
    const percentChange = previousValue !== 0 ? (change / previousValue) * 100 : 0;
    
    let trend = 'stable';
    if (percentChange > 2) trend = 'improving';
    else if (percentChange < -2) trend = 'declining';
    
    return {
      trend,
      change: Math.round(percentChange * 100) / 100,
      current: metricValue,
      previous: previousValue
    };
  }

  calculateQualityScore(metrics) {
    let score = 0;
    let maxScore = 0;
    
    // Coverage Score (30 points max)
    if (metrics.coverage.available) {
      score += Math.min(30, (metrics.coverage.statements / 100) * 30);
    }
    maxScore += 30;
    
    // Performance Score (20 points max)
    if (metrics.performance.available) {
      const passRate = metrics.performance.passed / metrics.performance.benchmarks;
      score += Math.min(20, passRate * 20);
    }
    maxScore += 20;
    
    // Workflow Score (25 points max)
    if (metrics.workflows.available) {
      const passRate = metrics.workflows.passed / metrics.workflows.total;
      score += Math.min(25, passRate * 25);
      
      // Penalty for critical failures
      if (metrics.workflows.criticalFailed > 0) {
        score -= metrics.workflows.criticalFailed * 5;
      }
    }
    maxScore += 25;
    
    // E2E Score (15 points max)
    if (metrics.e2e.available) {
      const passRate = metrics.e2e.passed / metrics.e2e.journeys;
      score += Math.min(15, passRate * 15);
    }
    maxScore += 15;
    
    // Quality Gates Score (10 points max)
    if (metrics.qualityGates.available) {
      const passRate = metrics.qualityGates.passed / metrics.qualityGates.gates;
      score += Math.min(10, passRate * 10);
    }
    maxScore += 10;
    
    return Math.max(0, Math.round((score / maxScore) * 100));
  }

  async saveMetrics(metrics) {
    await fs.writeJSON(this.metricsFile, metrics, { spaces: 2 });
    
    // Save to history
    const historyFile = path.join(this.reportsDir, 'quality-history.json');
    let history = [];
    
    if (await fs.pathExists(historyFile)) {
      history = await fs.readJSON(historyFile);
    }
    
    history.push({
      timestamp: metrics.timestamp,
      score: metrics.score,
      coverage: metrics.coverage.statements,
      performance: metrics.performance.passed,
      workflows: metrics.workflows.passed
    });
    
    // Keep last 50 entries
    if (history.length > 50) {
      history = history.slice(-50);
    }
    
    await fs.writeJSON(historyFile, history, { spaces: 2 });
  }

  async generateDashboard(metrics) {
    const html = this.generateDashboardHTML(metrics);
    await fs.writeFile(this.dashboardFile, html);
    console.log(`🌎 Dashboard generated: ${this.dashboardFile}`);
  }

  generateDashboardHTML(metrics) {
    const scoreColor = this.getScoreColor(metrics.score);
    const timestamp = new Date(metrics.timestamp).toLocaleString();
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Unjucks Quality Dashboard</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background: #f5f5f5;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .score {
            font-size: 3em;
            font-weight: bold;
            color: ${scoreColor};
            margin: 10px 0;
        }
        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            padding: 20px;
        }
        .card {
            background: white;
            border: 1px solid #e0e0e0;
            border-radius: 8px;
            padding: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }
        .card h3 {
            margin-top: 0;
            color: #333;
        }
        .metric {
            display: flex;
            justify-content: space-between;
            margin: 10px 0;
            padding: 8px 0;
            border-bottom: 1px solid #f0f0f0;
        }
        .metric:last-child {
            border-bottom: none;
        }
        .metric-value {
            font-weight: bold;
        }
        .status-pass {
            color: #4CAF50;
        }
        .status-fail {
            color: #f44336;
        }
        .status-warning {
            color: #ff9800;
        }
        .progress-bar {
            width: 100%;
            height: 20px;
            background: #e0e0e0;
            border-radius: 10px;
            overflow: hidden;
            margin: 5px 0;
        }
        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #4CAF50, #8BC34A);
            transition: width 0.3s ease;
        }
        .trend {
            display: inline-block;
            padding: 2px 6px;
            border-radius: 12px;
            font-size: 0.8em;
            font-weight: bold;
        }
        .trend-improving {
            background: #E8F5E8;
            color: #4CAF50;
        }
        .trend-declining {
            background: #FFEBEE;
            color: #f44336;
        }
        .trend-stable {
            background: #E3F2FD;
            color: #2196F3;
        }
        .footer {
            text-align: center;
            padding: 20px;
            background: #f9f9f9;
            color: #666;
            font-size: 0.9em;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Unjucks Quality Dashboard</h1>
            <div class="score">${metrics.score}%</div>
            <p>Quality Score • Last updated: ${timestamp}</p>
        </div>
        
        <div class="grid">
            ${this.generateCoverageCard(metrics.coverage)}
            ${this.generatePerformanceCard(metrics.performance)}
            ${this.generateWorkflowCard(metrics.workflows)}
            ${this.generateE2ECard(metrics.e2e)}
            ${this.generateQualityGatesCard(metrics.qualityGates)}
            ${this.generateTrendsCard(metrics.trends)}
        </div>
        
        <div class="footer">
            Generated by Unjucks Quality Assurance System • 
            <a href="./quality-metrics.json">Raw Data</a>
        </div>
    </div>
</body>
</html>`;
  }

  generateCoverageCard(coverage) {
    if (!coverage.available) {
      return '<div class="card"><h3>📊 Code Coverage</h3><p>No coverage data available</p></div>';
    }
    
    const statusClass = coverage.passed ? 'status-pass' : 'status-fail';
    
    return `<div class="card">
        <h3>📊 Code Coverage</h3>
        <div class="metric">
            <span>Statements</span>
            <span class="metric-value ${statusClass}">${coverage.statements.toFixed(1)}%</span>
        </div>
        <div class="progress-bar">
            <div class="progress-fill" style="width: ${coverage.statements}%"></div>
        </div>
        <div class="metric">
            <span>Branches</span>
            <span class="metric-value">${coverage.branches.toFixed(1)}%</span>
        </div>
        <div class="metric">
            <span>Functions</span>
            <span class="metric-value">${coverage.functions.toFixed(1)}%</span>
        </div>
        <div class="metric">
            <span>Files Analyzed</span>
            <span class="metric-value">${coverage.filesAnalyzed}</span>
        </div>
    </div>`;
  }

  generatePerformanceCard(performance) {
    if (!performance.available) {
      return '<div class="card"><h3>⏱️ Performance</h3><p>No performance data available</p></div>';
    }
    
    const passRate = (performance.passed / performance.benchmarks) * 100;
    const statusClass = performance.failed === 0 ? 'status-pass' : 'status-fail';
    
    return `<div class="card">
        <h3>⏱️ Performance</h3>
        <div class="metric">
            <span>Benchmarks Passed</span>
            <span class="metric-value ${statusClass}">${performance.passed}/${performance.benchmarks}</span>
        </div>
        <div class="progress-bar">
            <div class="progress-fill" style="width: ${passRate}%"></div>
        </div>
        <div class="metric">
            <span>Average Duration</span>
            <span class="metric-value">${performance.avgDuration}ms</span>
        </div>
        <div class="metric">
            <span>Failed Benchmarks</span>
            <span class="metric-value ${performance.failed > 0 ? 'status-fail' : ''}">${performance.failed}</span>
        </div>
    </div>`;
  }

  generateWorkflowCard(workflows) {
    if (!workflows.available) {
      return '<div class="card"><h3>🛑 Workflows</h3><p>No workflow data available</p></div>';
    }
    
    const passRate = (workflows.passed / workflows.total) * 100;
    const statusClass = workflows.criticalFailed === 0 ? 'status-pass' : 'status-fail';
    
    return `<div class="card">
        <h3>🛑 Workflows</h3>
        <div class="metric">
            <span>Workflows Passed</span>
            <span class="metric-value ${statusClass}">${workflows.passed}/${workflows.total}</span>
        </div>
        <div class="progress-bar">
            <div class="progress-fill" style="width: ${passRate}%"></div>
        </div>
        <div class="metric">
            <span>Critical Tests</span>
            <span class="metric-value">${workflows.critical}</span>
        </div>
        <div class="metric">
            <span>Critical Failures</span>
            <span class="metric-value ${workflows.criticalFailed > 0 ? 'status-fail' : 'status-pass'}">${workflows.criticalFailed}</span>
        </div>
    </div>`;
  }

  generateE2ECard(e2e) {
    if (!e2e.available) {
      return '<div class="card"><h3>🌍 End-to-End</h3><p>No E2E data available</p></div>';
    }
    
    const passRate = (e2e.passed / e2e.journeys) * 100;
    const statusClass = e2e.failed === 0 ? 'status-pass' : 'status-fail';
    
    return `<div class="card">
        <h3>🌍 End-to-End</h3>
        <div class="metric">
            <span>Journeys Passed</span>
            <span class="metric-value ${statusClass}">${e2e.passed}/${e2e.journeys}</span>
        </div>
        <div class="progress-bar">
            <div class="progress-fill" style="width: ${passRate}%"></div>
        </div>
        <div class="metric">
            <span>Average Steps</span>
            <span class="metric-value">${e2e.avgSteps}</span>
        </div>
        <div class="metric">
            <span>Failed Journeys</span>
            <span class="metric-value ${e2e.failed > 0 ? 'status-fail' : ''}">${e2e.failed}</span>
        </div>
    </div>`;
  }

  generateQualityGatesCard(gates) {
    if (!gates.available) {
      return '<div class="card"><h3>🚪 Quality Gates</h3><p>No quality gates data available</p></div>';
    }
    
    const passRate = (gates.passed / gates.gates) * 100;
    const statusClass = gates.status === 'PASSED' ? 'status-pass' : 'status-fail';
    
    return `<div class="card">
        <h3>🚪 Quality Gates</h3>
        <div class="metric">
            <span>Gates Passed</span>
            <span class="metric-value ${statusClass}">${gates.passed}/${gates.gates}</span>
        </div>
        <div class="progress-bar">
            <div class="progress-fill" style="width: ${passRate}%"></div>
        </div>
        <div class="metric">
            <span>Overall Status</span>
            <span class="metric-value ${statusClass}">${gates.status}</span>
        </div>
        <div class="metric">
            <span>Total Duration</span>
            <span class="metric-value">${gates.duration}ms</span>
        </div>
    </div>`;
  }

  generateTrendsCard(trends) {
    if (!trends || Object.keys(trends).length === 0) {
      return '<div class="card"><h3>📈 Trends</h3><p>No trend data available</p></div>';
    }
    
    let trendsHTML = '<div class="card"><h3>📈 Trends</h3>';
    
    Object.entries(trends).forEach(([category, trend]) => {
      const trendClass = `trend-${trend.trend}`;
      const trendIcon = trend.trend === 'improving' ? '↗️' : 
                       trend.trend === 'declining' ? '↘️' : '➡️';
      
      trendsHTML += `<div class="metric">
          <span>${category.charAt(0).toUpperCase() + category.slice(1)}</span>
          <span class="trend ${trendClass}">${trendIcon} ${trend.trend}</span>
      </div>`;
    });
    
    trendsHTML += '</div>';
    return trendsHTML;
  }

  getScoreColor(score) {
    if (score >= 90) return '#4CAF50';
    if (score >= 80) return '#8BC34A';
    if (score >= 70) return '#FFC107';
    if (score >= 60) return '#FF9800';
    return '#f44336';
  }

  displayMetrics(metrics) {
    console.log('\n📊 Quality Metrics Summary:');
    console.log('=' * 40);
    console.log(`🏆 Overall Score: ${metrics.score}%`);
    
    if (metrics.coverage.available) {
      console.log(`📊 Coverage: ${metrics.coverage.statements.toFixed(1)}% statements`);
    }
    
    if (metrics.performance.available) {
      console.log(`⏱️  Performance: ${metrics.performance.passed}/${metrics.performance.benchmarks} passed`);
    }
    
    if (metrics.workflows.available) {
      console.log(`🛑 Workflows: ${metrics.workflows.passed}/${metrics.workflows.total} passed`);
    }
    
    if (metrics.e2e.available) {
      console.log(`🌍 E2E: ${metrics.e2e.passed}/${metrics.e2e.journeys} journeys passed`);
    }
    
    if (metrics.qualityGates.available) {
      console.log(`🚪 Quality Gates: ${metrics.qualityGates.status}`);
    }
    
    console.log(`\n📋 Reports saved to: ${this.reportsDir}`);
    console.log(`🌎 Dashboard: ${this.dashboardFile}`);
  }
}

// Execute if run directly
if (import.meta.url === `file://${__filename}`) {
  const dashboard = new QualityDashboard();
  
  dashboard.collectMetrics().then(metrics => {
    dashboard.displayMetrics(metrics);
    
    if (metrics.score < 70) {
      console.log('\n⚠️  Quality score is below 70% - improvement needed!');
      process.exit(1);
    } else {
      console.log('\n🎉 Quality metrics collected successfully!');
      process.exit(0);
    }
  }).catch(error => {
    console.error('Quality dashboard generation failed:', error);
    process.exit(1);
  });
}

export { QualityDashboard };
