#!/usr/bin/env node

/**
 * Performance Alerting System
 * Sends notifications when performance issues are detected
 */

const fs = require('fs').promises;
const https = require('https');
const http = require('http');
const url = require('url');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

class PerformanceAlerting {
  constructor(options = {}) {
    this.options = {
      webhookUrl: null,
      severity: 'medium',
      includeDetails: true,
      retryAttempts: 3,
      retryDelay: 5000,
      ...options
    };

    this.alert = {
      timestamp: new Date().toISOString(),
      severity: this.options.severity,
      source: 'unjucks-performance-monitor',
      environment: process.env.NODE_ENV || 'unknown',
      details: {}
    };
  }

  async loadReport(reportPath) {
    try {
      const content = await fs.readFile(reportPath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      throw new Error(`Failed to load report from ${reportPath}: ${error.message}`);
    }
  }

  generateAlertMessage(report) {
    const message = {
      alert: this.alert,
      summary: this.extractSummary(report),
      details: this.options.includeDetails ? this.extractDetails(report) : null,
      recommendations: this.extractRecommendations(report),
      metadata: this.extractMetadata(report)
    };

    return message;
  }

  extractSummary(report) {
    const summary = {
      title: 'Performance Issue Detected',
      description: 'Performance monitoring has detected issues that require attention',
      issueCount: 0,
      criticalIssues: 0,
      affectedComponents: []
    };

    // Regression report format
    if (report.regression) {
      const regression = report.regression;
      summary.title = `Performance Regression Detected (${regression.severity})`;
      summary.issueCount = regression.details.length;
      summary.criticalIssues = regression.details.filter(d => d.severity === 'critical').length;
      summary.description = `${regression.details.length} performance regressions detected with severity: ${regression.severity}`;
      
      const groups = [...new Set(regression.details.map(d => d.group))];
      summary.affectedComponents = groups;
    }

    // Memory analysis format
    if (report.analysis) {
      const analysis = report.analysis;
      summary.title = 'Memory Performance Issue';
      
      if (analysis.indicators) {
        const indicators = analysis.indicators;
        const issues = Object.entries(indicators).filter(([_, value]) => value === true);
        summary.issueCount = issues.length;
        summary.description = `Memory analysis detected ${issues.length} issues: ${issues.map(([key]) => key).join(', ')}`;
      }
    }

    // Load test results format
    if (report.metrics && report.metrics.errors) {
      summary.title = 'Load Testing Performance Issue';
      summary.issueCount = report.metrics.errors.length;
      summary.description = `Load testing detected ${report.metrics.errors.length} error types`;
      summary.affectedComponents = report.metrics.errors.map(e => e.type);
    }

    // Cache validation format
    if (report.validation) {
      const validation = report.validation;
      summary.title = 'Cache Performance Issue';
      summary.issueCount = validation.issues.length;
      summary.criticalIssues = validation.issues.filter(i => i.severity === 'high').length;
      summary.description = `Cache validation failed with ${validation.issues.length} issues`;
    }

    return summary;
  }

  extractDetails(report) {
    const details = {};

    // Extract performance metrics
    if (report.regression && report.regression.details) {
      details.regressions = report.regression.details.map(r => ({
        metric: r.metric,
        group: r.group,
        change: `${r.change.toFixed(1)}%`,
        severity: r.severity,
        baseline: r.baseline,
        current: r.current
      }));
    }

    // Extract memory details
    if (report.analysis && report.analysis.memory) {
      const memory = report.analysis.memory;
      details.memory = {
        heapGrowth: memory.growth ? `${(memory.growth / 1024 / 1024).toFixed(2)} MB` : null,
        growthRate: memory.growthRate ? `${(memory.growthRate / 1024).toFixed(2)} KB/s` : null,
        peakUsage: memory.peak ? `${(memory.peak / 1024 / 1024).toFixed(2)} MB` : null,
        volatility: memory.volatility ? `${(memory.volatility * 100).toFixed(1)}%` : null
      };
    }

    // Extract load test details
    if (report.metrics) {
      const metrics = report.metrics;
      details.loadTest = {
        successRate: metrics.requests?.successRate ? `${metrics.requests.successRate.toFixed(1)}%` : null,
        averageLatency: metrics.latency?.average ? `${metrics.latency.average.toFixed(2)}ms` : null,
        p95Latency: metrics.latency?.p95 ? `${metrics.latency.p95.toFixed(2)}ms` : null,
        throughput: metrics.throughput?.requestsPerSecond ? `${metrics.throughput.requestsPerSecond.toFixed(2)} RPS` : null
      };
    }

    // Extract cache details
    if (report.validation && report.validation.summary) {
      const summary = report.validation.summary;
      details.cache = {
        hitRatio: `${summary.cacheHitRatio.toFixed(1)}%`,
        speedup: `${summary.cacheSpeedup.toFixed(2)}x`,
        missPenalty: `${summary.cacheMissPenalty.toFixed(2)}x`,
        consistency: `${(summary.consistencyScore * 100).toFixed(1)}%`
      };
    }

    return details;
  }

  extractRecommendations(report) {
    let recommendations = [];

    // Extract from various report formats
    if (report.regression && report.regression.recommendations) {
      recommendations = recommendations.concat(
        report.regression.recommendations.map(r => ({
          type: r.type,
          priority: r.priority,
          title: r.title,
          description: r.description,
          actions: r.actions.slice(0, 3) // Limit to top 3 actions
        }))
      );
    }

    if (report.summary && report.summary.recommendations) {
      recommendations = recommendations.concat(
        report.summary.recommendations.map(r => ({
          type: r.type,
          priority: r.severity,
          title: r.message,
          actions: [r.action]
        }))
      );
    }

    if (report.validation && report.validation.recommendations) {
      recommendations = recommendations.concat(
        report.validation.recommendations.map(r => ({
          type: r.type,
          priority: r.priority,
          title: r.title,
          actions: r.actions.slice(0, 3)
        }))
      );
    }

    // Sort by priority and limit
    const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
    recommendations.sort((a, b) => (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0));
    
    return recommendations.slice(0, 5); // Top 5 recommendations
  }

  extractMetadata(report) {
    const metadata = {
      reportType: this.detectReportType(report),
      timestamp: report.timestamp || new Date().toISOString(),
      environment: this.alert.environment,
      source: this.alert.source
    };

    // Add specific metadata based on report type
    if (report.metadata) {
      metadata.nodeVersion = report.metadata.nodeVersion;
      metadata.platform = report.metadata.platform;
      metadata.duration = report.metadata.duration;
    }

    if (report.configuration) {
      metadata.configuration = report.configuration;
    }

    return metadata;
  }

  detectReportType(report) {
    if (report.regression) return 'regression-analysis';
    if (report.analysis && report.analysis.memory) return 'memory-analysis';
    if (report.metrics && report.metrics.latency) return 'load-test';
    if (report.validation && report.validation.summary) return 'cache-validation';
    return 'unknown';
  }

  formatSlackMessage(alertMessage) {
    const { summary, details, recommendations } = alertMessage;
    
    const color = {
      critical: '#FF0000',
      high: '#FF6600',
      medium: '#FFCC00',
      low: '#00CC00'
    }[this.options.severity] || '#CCCCCC';

    const message = {
      username: 'Unjucks Performance Monitor',
      icon_emoji: ':warning:',
      attachments: [
        {
          color: color,
          title: summary.title,
          text: summary.description,
          fields: [
            {
              title: 'Issues Detected',
              value: summary.issueCount.toString(),
              short: true
            },
            {
              title: 'Critical Issues',
              value: summary.criticalIssues.toString(),
              short: true
            },
            {
              title: 'Affected Components',
              value: summary.affectedComponents.join(', ') || 'None specified',
              short: false
            }
          ],
          ts: Math.floor(Date.now() / 1000)
        }
      ]
    };

    // Add details if available
    if (details && Object.keys(details).length > 0) {
      const detailsText = Object.entries(details)
        .map(([key, value]) => {
          if (typeof value === 'object') {
            const subDetails = Object.entries(value)
              .filter(([_, v]) => v !== null)
              .map(([k, v]) => `${k}: ${v}`)
              .join(', ');
            return `*${key}*: ${subDetails}`;
          }
          return `*${key}*: ${value}`;
        })
        .join('\n');

      message.attachments.push({
        color: color,
        title: 'Performance Details',
        text: detailsText,
        mrkdwn_in: ['text']
      });
    }

    // Add recommendations
    if (recommendations && recommendations.length > 0) {
      const recText = recommendations
        .slice(0, 3) // Top 3 recommendations
        .map((rec, index) => 
          `${index + 1}. *[${rec.priority.toUpperCase()}]* ${rec.title}\n${rec.actions[0] || ''}`
        )
        .join('\n\n');

      message.attachments.push({
        color: color,
        title: 'Recommended Actions',
        text: recText,
        mrkdwn_in: ['text']
      });
    }

    return message;
  }

  formatGenericWebhook(alertMessage) {
    return {
      alert_type: 'performance_issue',
      severity: this.options.severity,
      timestamp: alertMessage.alert.timestamp,
      environment: alertMessage.alert.environment,
      summary: alertMessage.summary,
      details: alertMessage.details,
      recommendations: alertMessage.recommendations,
      metadata: alertMessage.metadata
    };
  }

  async sendWebhookAlert(webhookUrl, payload) {
    return new Promise((resolve, reject) => {
      const parsedUrl = url.parse(webhookUrl);
      const isHttps = parsedUrl.protocol === 'https:';
      const client = isHttps ? https : http;

      const postData = JSON.stringify(payload);
      
      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          'User-Agent': 'Unjucks-Performance-Monitor/1.0'
        }
      };

      const req = client.request(options, (res) => {
        let responseData = '';
        
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({
              success: true,
              statusCode: res.statusCode,
              response: responseData
            });
          } else {
            reject(new Error(`Webhook request failed with status ${res.statusCode}: ${responseData}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`Webhook request error: ${error.message}`));
      });

      req.write(postData);
      req.end();
    });
  }

  async sendAlert(reportPath) {
    if (!this.options.webhookUrl) {
      console.log('No webhook URL configured - skipping alert');
      return;
    }

    console.log(`Sending performance alert from report: ${reportPath}`);
    
    const report = await this.loadReport(reportPath);
    const alertMessage = this.generateAlertMessage(report);
    
    // Format message based on webhook type
    let payload;
    if (this.options.webhookUrl.includes('slack.com')) {
      payload = this.formatSlackMessage(alertMessage);
    } else {
      payload = this.formatGenericWebhook(alertMessage);
    }

    // Send with retries
    let lastError;
    for (let attempt = 1; attempt <= this.options.retryAttempts; attempt++) {
      try {
        const result = await this.sendWebhookAlert(this.options.webhookUrl, payload);
        console.log(`Alert sent successfully on attempt ${attempt}`);
        console.log(`Response: ${result.statusCode} - ${result.response}`);
        return result;
      } catch (error) {
        lastError = error;
        console.error(`Alert attempt ${attempt} failed: ${error.message}`);
        
        if (attempt < this.options.retryAttempts) {
          console.log(`Waiting ${this.options.retryDelay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, this.options.retryDelay));
        }
      }
    }

    throw new Error(`Failed to send alert after ${this.options.retryAttempts} attempts. Last error: ${lastError.message}`);
  }

  async saveAlert(outputFile) {
    if (outputFile) {
      const alertData = {
        alert: this.alert,
        timestamp: new Date().toISOString(),
        configuration: this.options
      };
      
      await fs.writeFile(outputFile, JSON.stringify(alertData, null, 2));
      console.log(`Alert data saved to: ${outputFile}`);
    }
  }
}

// CLI Interface
async function main() {
  const argv = yargs(hideBin(process.argv))
    .option('webhook-url', {
      alias: 'w',
      type: 'string',
      describe: 'Webhook URL for sending alerts (Slack, Discord, etc.)'
    })
    .option('report', {
      alias: 'r',
      type: 'string',
      required: true,
      describe: 'Path to performance report file'
    })
    .option('severity', {
      alias: 's',
      type: 'string',
      choices: ['low', 'medium', 'high', 'critical'],
      default: 'medium',
      describe: 'Alert severity level'
    })
    .option('include-details', {
      type: 'boolean',
      default: true,
      describe: 'Include detailed metrics in alert'
    })
    .option('retry-attempts', {
      type: 'number',
      default: 3,
      describe: 'Number of retry attempts for failed alerts'
    })
    .option('retry-delay', {
      type: 'number',
      default: 5000,
      describe: 'Delay between retry attempts (ms)'
    })
    .option('output', {
      alias: 'o',
      type: 'string',
      describe: 'Save alert data to file'
    })
    .help()
    .argv;

  try {
    const alerting = new PerformanceAlerting({
      webhookUrl: argv.webhookUrl || process.env.PERFORMANCE_WEBHOOK_URL,
      severity: argv.severity,
      includeDetails: argv.includeDetails,
      retryAttempts: argv.retryAttempts,
      retryDelay: argv.retryDelay
    });

    await alerting.sendAlert(argv.report);
    await alerting.saveAlert(argv.output);

    console.log('Performance alert processing completed');

  } catch (error) {
    console.error('Failed to send performance alert:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { PerformanceAlerting };