#!/usr/bin/env node

const fs = require('fs-extra');
const path = require('path');
const fetch = require('node-fetch');

class SlackAlertSender {
  constructor() {
    this.reportDir = path.join(process.cwd(), '.github/monitoring-reports');
    this.webhookUrl = process.env.SLACK_WEBHOOK_URL;
    this.config = this.loadConfig();
  }

  loadConfig() {
    try {
      return require('./config.json');
    } catch (error) {
      console.error('Failed to load config:', error);
      return { monitoring: { alerts: { slack: {} } } };
    }
  }

  async sendAlerts() {
    console.log('📱 Sending Slack alerts');

    if (!this.webhookUrl) {
      console.warn('⚠️ SLACK_WEBHOOK_URL not configured, skipping Slack alerts');
      return;
    }

    try {
      const alerts = await this.loadAlerts();
      const degradationReport = await this.loadDegradationReport();

      if (alerts.length === 0 && !degradationReport?.degradation_issues?.length) {
        console.log('✅ No alerts to send');
        return;
      }

      const message = this.buildSlackMessage(alerts, degradationReport);
      await this.sendToSlack(message);

      console.log('✅ Slack alerts sent successfully');

    } catch (error) {
      console.error('❌ Error sending Slack alerts:', error);
      throw error;
    }
  }

  async loadAlerts() {
    const alertsPath = path.join(this.reportDir, 'alerts.json');
    
    if (await fs.pathExists(alertsPath)) {
      return await fs.readJSON(alertsPath);
    }
    
    return [];
  }

  async loadDegradationReport() {
    const reportPath = path.join(this.reportDir, 'degradation-report.json');
    
    if (await fs.pathExists(reportPath)) {
      return await fs.readJSON(reportPath);
    }
    
    return null;
  }

  buildSlackMessage(alerts, degradationReport) {
    const criticalAlerts = alerts.filter(a => a.severity === 'critical');
    const warningAlerts = alerts.filter(a => a.severity === 'warning');
    const criticalDegradation = degradationReport?.degradation_issues?.filter(i => i.severity === 'critical') || [];

    const totalCritical = criticalAlerts.length + criticalDegradation.length;
    const totalWarnings = warningAlerts.length + (degradationReport?.degradation_issues?.filter(i => i.severity === 'warning').length || 0);

    // Determine message urgency and color
    let color = '#36a64f'; // Green
    let urgency = '';
    let icon = ':white_check_mark:';

    if (totalCritical > 0) {
      color = '#d63031'; // Red
      urgency = ' :rotating_light: CRITICAL';
      icon = ':red_circle:';
    } else if (totalWarnings > 0) {
      color = '#f39c12'; // Orange
      urgency = ' :warning: WARNING';
      icon = ':warning:';
    }

    const message = {
      username: 'Workflow Monitor',
      icon_emoji: ':chart_with_upwards_trend:',
      attachments: [
        {
          color: color,
          title: `${icon} Workflow Performance Alert${urgency}`,
          title_link: this.getDashboardUrl(),
          text: this.buildAlertSummary(totalCritical, totalWarnings),
          fields: [],
          footer: 'Workflow Monitoring System',
          ts: Math.floor(this.getDeterministicTimestamp() / 1000)
        }
      ]
    };

    // Add critical alerts
    if (criticalAlerts.length > 0) {
      message.attachments[0].fields.push({
        title: ':red_circle: Critical Performance Issues',
        value: criticalAlerts.map(alert => 
          `• *${alert.title}*\n  ${alert.description}`
        ).join('\n\n'),
        short: false
      });
    }

    // Add critical degradation issues
    if (criticalDegradation.length > 0) {
      message.attachments[0].fields.push({
        title: ':rotating_light: Critical System Degradation',
        value: criticalDegradation.map(issue => 
          `• *${issue.type}*: ${issue.description}\n  Current: ${issue.current_value || 'N/A'}`
        ).join('\n\n'),
        short: false
      });
    }

    // Add warning summary if there are warnings but not too many criticals
    if (totalWarnings > 0 && totalCritical < 3) {
      const warningText = warningAlerts.slice(0, 3).map(alert => 
        `• ${alert.title}: ${alert.description}`
      ).join('\n');
      
      message.attachments[0].fields.push({
        title: `:warning: Performance Warnings (${totalWarnings})`,
        value: warningText + (warningAlerts.length > 3 ? `\n... and ${warningAlerts.length - 3} more` : ''),
        short: false
      });
    }

    // Add quick actions
    message.attachments[0].fields.push({
      title: 'Recommended Actions',
      value: this.getRecommendedActions(criticalAlerts, criticalDegradation),
      short: false
    });

    // Add metrics summary
    message.attachments[0].fields.push(
      {
        title: 'Dashboard',
        value: `<${this.getDashboardUrl()}|View Full Dashboard>`,
        short: true
      },
      {
        title: 'Repository',
        value: `<${this.getRepositoryUrl()}|View Repository>`,
        short: true
      }
    );

    return message;
  }

  buildAlertSummary(criticalCount, warningCount) {
    if (criticalCount > 0) {
      return `🚨 *${criticalCount} critical issue${criticalCount > 1 ? 's' : ''} detected* requiring immediate attention!${warningCount > 0 ? ` Additionally, ${warningCount} warning${warningCount > 1 ? 's' : ''} found.` : ''}`;
    } else if (warningCount > 0) {
      return `⚠️ *${warningCount} performance warning${warningCount > 1 ? 's' : ''} detected*. Review recommended to prevent potential issues.`;
    } else {
      return '✅ All workflows performing within normal parameters.';
    }
  }

  getRecommendedActions(criticalAlerts, criticalDegradation) {
    const actions = [];

    if (criticalAlerts.length > 0 || criticalDegradation.length > 0) {
      actions.push('1️⃣ **Immediate**: Investigate critical issues');
      actions.push('2️⃣ **Check**: Recent workflow changes and commits');
      actions.push('3️⃣ **Monitor**: System closely for recovery');
      
      if (criticalDegradation.some(d => d.type === 'workflow_complete_failure')) {
        actions.push('🔧 **Consider**: Disabling failing workflows temporarily');
      }
    } else {
      actions.push('📊 **Review**: Dashboard for trends and patterns');
      actions.push('🔍 **Monitor**: Performance metrics regularly');
    }

    return actions.join('\n');
  }

  getDashboardUrl() {
    // This would typically be your GitHub Pages URL or wherever you host the dashboard
    const repoUrl = this.getRepositoryUrl();
    return `${repoUrl}/tree/main/.github/monitoring-reports/dashboard`;
  }

  getRepositoryUrl() {
    // Extract from environment or git config
    return process.env.GITHUB_REPOSITORY 
      ? `https://github.com/${process.env.GITHUB_REPOSITORY}`
      : 'https://github.com/your-org/your-repo';
  }

  async sendToSlack(message) {
    const response = await fetch(this.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Slack API error: ${response.status} - ${errorText}`);
    }

    console.log('📱 Message sent to Slack successfully');
  }

  // Method to send a test message
  async sendTestMessage() {
    console.log('🧪 Sending test Slack message');

    const testMessage = {
      username: 'Workflow Monitor',
      icon_emoji: ':chart_with_upwards_trend:',
      text: ':white_check_mark: *Workflow Monitoring System Test*',
      attachments: [
        {
          color: '#36a64f',
          title: 'Test Alert',
          text: 'This is a test message from the workflow monitoring system. If you can see this, Slack integration is working correctly!',
          fields: [
            {
              title: 'Status',
              value: 'System Online',
              short: true
            },
            {
              title: 'Test Time',
              value: this.getDeterministicDate().toISOString(),
              short: true
            }
          ],
          footer: 'Workflow Monitoring System',
          ts: Math.floor(this.getDeterministicTimestamp() / 1000)
        }
      ]
    };

    await this.sendToSlack(testMessage);
  }
}

async function main() {
  try {
    const sender = new SlackAlertSender();
    
    // Check if this is a test run
    if (process.argv.includes('--test')) {
      await sender.sendTestMessage();
    } else {
      await sender.sendAlerts();
    }
    
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = SlackAlertSender;