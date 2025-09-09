#!/usr/bin/env node

/**
 * Notification and Escalation System
 * Manages intelligent notifications and escalation procedures for automated issue tracking
 */

import { writeFileSync, readFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';

class NotificationSystem {
  constructor(options = {}) {
    this.configPath = options.configPath || '.github/notification-config.json';
    this.escalationRules = options.escalationRules || this.getDefaultEscalationRules();
    this.notificationChannels = options.notificationChannels || [];
  }

  /**
   * Send notifications based on issue type and severity
   */
  async sendNotification(issueData, notificationType = 'issue_created') {
    console.log(`📢 Sending ${notificationType} notification for ${issueData.type || 'unknown'} issue`);
    
    try {
      // Load notification configuration
      const config = this.loadNotificationConfig();
      
      // Determine notification priority and channels
      const notificationPlan = this.createNotificationPlan(issueData, notificationType, config);
      
      // Send notifications through appropriate channels
      const results = await this.executeNotificationPlan(notificationPlan);
      
      // Log notification results
      await this.logNotificationResults(issueData, notificationPlan, results);
      
      console.log(`✅ Notifications sent for ${issueData.type} issue`);
      return results;
      
    } catch (error) {
      console.error('❌ Notification sending failed:', error.message);
      // Don't throw - notifications are non-critical for core functionality
      return { success: false, error: error.message };
    }
  }

  /**
   * Handle critical issue escalation
   */
  async escalateCriticalIssue(issueData) {
    console.log(`🚨 Escalating critical issue: ${issueData.id || 'unknown'}`);
    
    try {
      const escalationPlan = this.createEscalationPlan(issueData);
      
      // Execute immediate notifications
      await this.sendImmediateAlerts(escalationPlan);
      
      // Create escalation tracking
      await this.trackEscalation(issueData, escalationPlan);
      
      // Schedule follow-up notifications
      await this.scheduleFollowups(escalationPlan);
      
      console.log(`✅ Critical issue escalation completed for ${issueData.id}`);
      return escalationPlan;
      
    } catch (error) {
      console.error('❌ Critical escalation failed:', error.message);
      // Fallback to basic notification
      await this.sendFallbackAlert(issueData, error);
      throw error;
    }
  }

  /**
   * Load notification configuration from file or use defaults
   */
  loadNotificationConfig() {
    try {
      if (existsSync(this.configPath)) {
        return JSON.parse(readFileSync(this.configPath, 'utf8'));
      }
      
      // Create default configuration
      const defaultConfig = this.getDefaultNotificationConfig();
      writeFileSync(this.configPath, JSON.stringify(defaultConfig, null, 2));
      return defaultConfig;
      
    } catch (error) {
      console.warn('Failed to load notification config, using defaults:', error.message);
      return this.getDefaultNotificationConfig();
    }
  }

  /**
   * Create notification plan based on issue characteristics
   */
  createNotificationPlan(issueData, notificationType, config) {
    const { type, severity, priority } = issueData;
    
    const plan = {
      issue_id: issueData.id,
      notification_type: notificationType,
      priority: this.determineNotificationPriority(issueData),
      channels: [],
      escalation_rules: [],
      timing: this.determineNotificationTiming(issueData),
      recipients: this.determineRecipients(issueData, config)
    };

    // Determine notification channels based on severity and type
    if (severity === 'critical' || type === 'security-vulnerability') {
      plan.channels = ['github-issue', 'github-discussion', 'action-summary'];
      plan.escalation_rules = this.escalationRules.critical;
    } else if (severity === 'high' || type === 'ci-failure') {
      plan.channels = ['github-issue', 'action-summary'];
      plan.escalation_rules = this.escalationRules.high;
    } else {
      plan.channels = ['github-issue'];
      plan.escalation_rules = this.escalationRules.standard;
    }

    return plan;
  }

  /**
   * Execute the notification plan across all channels
   */
  async executeNotificationPlan(plan) {
    const results = {
      success: true,
      channels: {},
      errors: []
    };

    for (const channel of plan.channels) {
      try {
        const channelResult = await this.sendToChannel(channel, plan);
        results.channels[channel] = {
          success: true,
          result: channelResult,
          timestamp: new Date().toISOString()
        };
      } catch (error) {
        results.success = false;
        results.channels[channel] = {
          success: false,
          error: error.message,
          timestamp: new Date().toISOString()
        };
        results.errors.push(`${channel}: ${error.message}`);
      }
    }

    return results;
  }

  /**
   * Send notification to specific channel
   */
  async sendToChannel(channel, plan) {
    const message = this.formatMessageForChannel(channel, plan);
    
    switch (channel) {
      case 'github-issue':
        return await this.sendGitHubIssueNotification(message, plan);
        
      case 'github-discussion':
        return await this.sendGitHubDiscussion(message, plan);
        
      case 'action-summary':
        return await this.sendActionSummary(message, plan);
        
      case 'webhook':
        return await this.sendWebhook(message, plan);
        
      default:
        throw new Error(`Unknown notification channel: ${channel}`);
    }
  }

  /**
   * Send GitHub issue comment notification
   */
  async sendGitHubIssueNotification(message, plan) {
    // This would typically post a comment to the created issue
    console.log(`📝 GitHub Issue notification: ${message.title}`);
    
    // In a real implementation, this would use GitHub API to post comments
    return {
      type: 'github-issue',
      status: 'sent',
      message_id: `issue-comment-${Date.now()}`
    };
  }

  /**
   * Send GitHub discussion notification
   */
  async sendGitHubDiscussion(message, plan) {
    console.log(`💬 GitHub Discussion notification: ${message.title}`);
    
    // In a real implementation, this would create/update discussions
    return {
      type: 'github-discussion',
      status: 'sent',
      discussion_id: `discussion-${Date.now()}`
    };
  }

  /**
   * Send action summary notification
   */
  async sendActionSummary(message, plan) {
    console.log(`📊 Action Summary notification: ${message.title}`);
    
    // Add to GitHub Actions job summary
    const summary = `## ${message.title}\n\n${message.body}\n\n---\n*Automated notification sent at ${new Date().toISOString()}*`;
    
    try {
      execSync(`echo "${summary}" >> $GITHUB_STEP_SUMMARY`, { stdio: 'pipe' });
      return {
        type: 'action-summary',
        status: 'sent',
        summary_length: summary.length
      };
    } catch (error) {
      console.warn('Could not write to GitHub Step Summary:', error.message);
      return {
        type: 'action-summary',
        status: 'fallback',
        error: error.message
      };
    }
  }

  /**
   * Send webhook notification
   */
  async sendWebhook(message, plan) {
    console.log(`🔗 Webhook notification: ${message.title}`);
    
    // In a real implementation, this would send HTTP POST to configured webhooks
    return {
      type: 'webhook',
      status: 'sent',
      webhook_count: plan.recipients?.webhooks?.length || 0
    };
  }

  /**
   * Format message for specific channel
   */
  formatMessageForChannel(channel, plan) {
    const baseMessage = {
      title: this.generateNotificationTitle(plan),
      body: this.generateNotificationBody(plan),
      priority: plan.priority,
      timestamp: new Date().toISOString()
    };

    switch (channel) {
      case 'github-issue':
        return {
          ...baseMessage,
          format: 'markdown',
          labels: this.generateNotificationLabels(plan)
        };
        
      case 'github-discussion':
        return {
          ...baseMessage,
          format: 'markdown',
          category: 'announcements'
        };
        
      case 'action-summary':
        return {
          ...baseMessage,
          format: 'github-flavored-markdown'
        };
        
      case 'webhook':
        return {
          ...baseMessage,
          format: 'json',
          metadata: plan
        };
        
      default:
        return baseMessage;
    }
  }

  /**
   * Generate notification title
   */
  generateNotificationTitle(plan) {
    const { notification_type, priority } = plan;
    
    const titles = {
      issue_created: `🤖 Automated Issue Created (${priority})`,
      issue_updated: `📊 Issue Update (${priority})`,
      issue_resolved: `✅ Issue Resolved (${priority})`,
      escalation: `🚨 Issue Escalated (${priority})`,
      health_alert: `📈 Workflow Health Alert (${priority})`
    };
    
    return titles[notification_type] || `🔔 Notification (${priority})`;
  }

  /**
   * Generate notification body
   */
  generateNotificationBody(plan) {
    const { notification_type, issue_id, timing } = plan;
    
    let body = `**Notification Type**: ${notification_type}\n`;
    body += `**Issue ID**: ${issue_id || 'Unknown'}\n`;
    body += `**Priority**: ${plan.priority}\n`;
    body += `**Timing**: ${timing}\n\n`;
    
    body += `**Automated Tracking System**\n`;
    body += `This notification was generated by the automated issue tracking and management system.\n\n`;
    
    if (plan.escalation_rules && plan.escalation_rules.length > 0) {
      body += `**Escalation Rules Active**\n`;
      body += `- Follow-up in: ${plan.escalation_rules[0]?.follow_up_time || 'Unknown'}\n`;
      body += `- Escalation threshold: ${plan.escalation_rules[0]?.escalation_threshold || 'Unknown'}\n\n`;
    }
    
    body += `*Generated at: ${new Date().toISOString()}*`;
    
    return body;
  }

  /**
   * Generate notification labels
   */
  generateNotificationLabels(plan) {
    const labels = ['automated-notification'];
    
    if (plan.priority) {
      labels.push(`priority-${plan.priority}`);
    }
    
    if (plan.notification_type) {
      labels.push(`type-${plan.notification_type}`);
    }
    
    return labels;
  }

  /**
   * Determine notification priority
   */
  determineNotificationPriority(issueData) {
    const { type, severity, priority } = issueData;
    
    if (severity === 'critical' || type === 'security-vulnerability') {
      return 'critical';
    }
    
    if (severity === 'high' || type === 'ci-failure' || priority === 'high') {
      return 'high';
    }
    
    if (severity === 'medium' || priority === 'medium') {
      return 'medium';
    }
    
    return 'low';
  }

  /**
   * Determine notification timing
   */
  determineNotificationTiming(issueData) {
    const { type, severity } = issueData;
    
    if (severity === 'critical' || type === 'security-vulnerability') {
      return 'immediate';
    }
    
    if (severity === 'high' || type === 'ci-failure') {
      return 'urgent';
    }
    
    return 'standard';
  }

  /**
   * Determine notification recipients
   */
  determineRecipients(issueData, config) {
    const { type, severity } = issueData;
    
    const recipients = {
      assignees: [],
      teams: [],
      webhooks: []
    };

    // Map issue types to teams/assignees
    const typeMapping = config.type_mapping || {};
    const severityMapping = config.severity_mapping || {};
    
    if (typeMapping[type]) {
      recipients.assignees.push(...(typeMapping[type].assignees || []));
      recipients.teams.push(...(typeMapping[type].teams || []));
    }
    
    if (severityMapping[severity]) {
      recipients.assignees.push(...(severityMapping[severity].assignees || []));
      recipients.teams.push(...(severityMapping[severity].teams || []));
    }
    
    // Remove duplicates
    recipients.assignees = [...new Set(recipients.assignees)];
    recipients.teams = [...new Set(recipients.teams)];
    
    return recipients;
  }

  /**
   * Create escalation plan for critical issues
   */
  createEscalationPlan(issueData) {
    return {
      issue_id: issueData.id,
      escalation_level: 1,
      escalation_time: new Date().toISOString(),
      escalation_reason: 'Critical issue severity',
      immediate_actions: [
        'Send high-priority notifications',
        'Assign to on-call team',
        'Create incident tracking',
        'Schedule follow-up checks'
      ],
      follow_up_schedule: [
        { time: '+15m', action: 'Check resolution progress' },
        { time: '+1h', action: 'Escalate to senior team' },
        { time: '+4h', action: 'Executive notification' }
      ],
      escalation_contacts: this.getCriticalEscalationContacts()
    };
  }

  /**
   * Send immediate alerts for critical issues
   */
  async sendImmediateAlerts(escalationPlan) {
    console.log(`🚨 Sending immediate alerts for escalation: ${escalationPlan.issue_id}`);
    
    // Send high-priority notifications
    const alertResults = await Promise.allSettled([
      this.sendActionSummary({
        title: '🚨 CRITICAL ISSUE ESCALATION',
        body: `Critical issue ${escalationPlan.issue_id} has been escalated.\n\nEscalation Level: ${escalationPlan.escalation_level}\nReason: ${escalationPlan.escalation_reason}\n\nImmediate attention required.`
      }, escalationPlan),
      
      // Additional alert mechanisms would go here
      // this.sendSlackAlert(escalationPlan),
      // this.sendEmailAlert(escalationPlan),
      // this.sendPagerDutyAlert(escalationPlan)
    ]);
    
    return alertResults.map(result => ({
      status: result.status,
      value: result.value,
      reason: result.reason
    }));
  }

  /**
   * Track escalation for follow-up
   */
  async trackEscalation(issueData, escalationPlan) {
    const trackingData = {
      ...escalationPlan,
      issue_data: issueData,
      tracking_id: `escalation-${Date.now()}`,
      status: 'active',
      created_at: new Date().toISOString()
    };
    
    // Store escalation tracking data
    const trackingPath = `temp/escalations/${trackingData.tracking_id}.json`;
    writeFileSync(trackingPath, JSON.stringify(trackingData, null, 2));
    
    console.log(`📊 Escalation tracking created: ${trackingData.tracking_id}`);
    return trackingData;
  }

  /**
   * Schedule follow-up notifications
   */
  async scheduleFollowups(escalationPlan) {
    console.log(`📅 Scheduling follow-ups for escalation: ${escalationPlan.issue_id}`);
    
    // In a real implementation, this would schedule future notifications
    // using GitHub Actions workflows, cron jobs, or external scheduling systems
    
    for (const followUp of escalationPlan.follow_up_schedule) {
      console.log(`📝 Scheduled: ${followUp.action} at ${followUp.time}`);
    }
    
    return {
      scheduled_count: escalationPlan.follow_up_schedule.length,
      next_followup: escalationPlan.follow_up_schedule[0]?.time
    };
  }

  /**
   * Send fallback alert when escalation fails
   */
  async sendFallbackAlert(issueData, error) {
    console.log(`🆘 Sending fallback alert for failed escalation`);
    
    try {
      await this.sendActionSummary({
        title: '🆘 ESCALATION SYSTEM FAILURE',
        body: `Critical issue escalation failed for ${issueData.id || 'unknown issue'}.\n\nError: ${error.message}\n\nManual intervention required immediately.`
      }, { priority: 'critical' });
    } catch (fallbackError) {
      console.error('❌ Fallback alert also failed:', fallbackError.message);
    }
  }

  /**
   * Log notification results for monitoring
   */
  async logNotificationResults(issueData, plan, results) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      issue_id: issueData.id,
      notification_plan: plan,
      results: results,
      success: results.success,
      error_count: results.errors?.length || 0
    };
    
    const logPath = `temp/notification-logs/${Date.now()}.json`;
    writeFileSync(logPath, JSON.stringify(logEntry, null, 2));
  }

  /**
   * Get default notification configuration
   */
  getDefaultNotificationConfig() {
    return {
      channels: {
        github_issue: { enabled: true, priority_threshold: 'low' },
        github_discussion: { enabled: true, priority_threshold: 'medium' },
        action_summary: { enabled: true, priority_threshold: 'low' },
        webhook: { enabled: false, priority_threshold: 'high' }
      },
      type_mapping: {
        'ci-failure': { assignees: ['sac'], teams: ['ci-team'] },
        'security-vulnerability': { assignees: ['sac'], teams: ['security-team'] },
        'performance-regression': { assignees: ['sac'], teams: ['performance-team'] },
        'quality-gate-failure': { assignees: ['sac'], teams: ['quality-team'] },
        'workflow-health': { assignees: ['sac'], teams: ['devops-team'] }
      },
      severity_mapping: {
        critical: { assignees: ['sac'], teams: ['on-call'] },
        high: { assignees: ['sac'], teams: ['senior-team'] },
        medium: { assignees: [], teams: ['dev-team'] },
        low: { assignees: [], teams: [] }
      },
      escalation_timeouts: {
        critical: '15m',
        high: '1h',
        medium: '4h',
        low: '24h'
      }
    };
  }

  /**
   * Get default escalation rules
   */
  getDefaultEscalationRules() {
    return {
      critical: [
        { follow_up_time: '15m', escalation_threshold: 'immediate' },
        { follow_up_time: '1h', escalation_threshold: 'senior' },
        { follow_up_time: '4h', escalation_threshold: 'executive' }
      ],
      high: [
        { follow_up_time: '1h', escalation_threshold: 'team' },
        { follow_up_time: '4h', escalation_threshold: 'senior' }
      ],
      standard: [
        { follow_up_time: '24h', escalation_threshold: 'team' }
      ]
    };
  }

  /**
   * Get critical escalation contacts
   */
  getCriticalEscalationContacts() {
    return {
      on_call: ['sac'],
      senior_team: ['sac'],
      security_team: ['sac'],
      executive: ['sac']
    };
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const action = args[0];
  const options = {};
  
  for (let i = 1; i < args.length; i += 2) {
    const key = args[i].replace('--', '').replace(/-/g, '_');
    const value = args[i + 1];
    try {
      options[key] = JSON.parse(value);
    } catch {
      options[key] = value;
    }
  }
  
  const notificationSystem = new NotificationSystem(options);
  
  switch (action) {
    case 'send':
      if (options.issue_data) {
        notificationSystem.sendNotification(options.issue_data, options.type).catch(console.error);
      }
      break;
    case 'escalate':
      if (options.issue_data) {
        notificationSystem.escalateCriticalIssue(options.issue_data).catch(console.error);
      }
      break;
    default:
      console.log('Usage: notification-system.js <send|escalate> --issue-data <json> [options]');
  }
}

export { NotificationSystem };