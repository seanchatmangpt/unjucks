#!/usr/bin/env node

/**
 * Intelligent Alerting System with ML-based Decision Making
 * Processes anomaly detection results and SLO breaches to generate smart alerts
 */

import fs from 'fs-extra';
import path from 'path';
import consola from 'consola';

class IntelligentAlerting {
  constructor(options = {}) {
    this.anomalyConfidence = parseFloat(options.anomalyConfidence) || 0;
    this.sloStatus = options.sloStatus || 'healthy';
    this.errorBudget = parseFloat(options.errorBudget) || 100;
    this.escalationRulesPath = options.escalationRules || '.github/scripts/observability/escalation-matrix.json';
    
    this.alertLevels = {
      info: 0,
      warning: 1,
      high: 2,
      critical: 3
    };

    this.alertThresholds = {
      anomalyConfidence: {
        warning: 0.6,
        high: 0.8,
        critical: 0.9
      },
      errorBudget: {
        warning: 25,
        high: 10,
        critical: 5
      }
    };
  }

  async loadEscalationRules() {
    try {
      if (await fs.pathExists(this.escalationRulesPath)) {
        const rules = await fs.readJson(this.escalationRulesPath);
        return rules;
      } else {
        return this.getDefaultEscalationRules();
      }
    } catch (error) {
      consola.warn('Could not load escalation rules, using defaults:', error.message);
      return this.getDefaultEscalationRules();
    }
  }

  getDefaultEscalationRules() {
    return {
      levels: {
        info: {
          channels: ['slack'],
          escalation_delay: 0,
          suppress_duration: '1h',
          notification_template: 'info'
        },
        warning: {
          channels: ['slack', 'email'],
          escalation_delay: 300, // 5 minutes
          suppress_duration: '30m',
          notification_template: 'warning'
        },
        high: {
          channels: ['slack', 'email', 'github_issue'],
          escalation_delay: 180, // 3 minutes
          suppress_duration: '15m',
          notification_template: 'high',
          assignees: ['@team-lead', '@on-call']
        },
        critical: {
          channels: ['slack', 'email', 'pagerduty', 'github_issue'],
          escalation_delay: 60, // 1 minute
          suppress_duration: '5m',
          notification_template: 'critical',
          assignees: ['@team-lead', '@on-call', '@engineering-manager'],
          immediate_escalation: true
        }
      },
      routing: {
        slo_breach: 'high',
        anomaly_detected: 'warning',
        error_budget_critical: 'critical',
        system_down: 'critical'
      }
    };
  }

  calculateAlertLevel() {
    let maxLevel = 'info';
    const reasons = [];

    // Check anomaly confidence
    if (this.anomalyConfidence >= this.alertThresholds.anomalyConfidence.critical) {
      maxLevel = 'critical';
      reasons.push(`Critical anomaly detected (confidence: ${(this.anomalyConfidence * 100).toFixed(1)}%)`);
    } else if (this.anomalyConfidence >= this.alertThresholds.anomalyConfidence.high) {
      maxLevel = this.alertLevels[maxLevel] < this.alertLevels.high ? 'high' : maxLevel;
      reasons.push(`High confidence anomaly (confidence: ${(this.anomalyConfidence * 100).toFixed(1)}%)`);
    } else if (this.anomalyConfidence >= this.alertThresholds.anomalyConfidence.warning) {
      maxLevel = this.alertLevels[maxLevel] < this.alertLevels.warning ? 'warning' : maxLevel;
      reasons.push(`Anomaly detected (confidence: ${(this.anomalyConfidence * 100).toFixed(1)}%)`);
    }

    // Check SLO status
    if (this.sloStatus === 'critical') {
      maxLevel = 'critical';
      reasons.push('Critical SLO breach detected');
    } else if (this.sloStatus === 'degraded') {
      maxLevel = this.alertLevels[maxLevel] < this.alertLevels.high ? 'high' : maxLevel;
      reasons.push('SLO degradation detected');
    }

    // Check error budget
    if (this.errorBudget <= this.alertThresholds.errorBudget.critical) {
      maxLevel = 'critical';
      reasons.push(`Critical error budget depletion (${this.errorBudget.toFixed(1)}% remaining)`);
    } else if (this.errorBudget <= this.alertThresholds.errorBudget.high) {
      maxLevel = this.alertLevels[maxLevel] < this.alertLevels.high ? 'high' : maxLevel;
      reasons.push(`Low error budget (${this.errorBudget.toFixed(1)}% remaining)`);
    } else if (this.errorBudget <= this.alertThresholds.errorBudget.warning) {
      maxLevel = this.alertLevels[maxLevel] < this.alertLevels.warning ? 'warning' : maxLevel;
      reasons.push(`Error budget warning (${this.errorBudget.toFixed(1)}% remaining)`);
    }

    return {
      level: maxLevel,
      reasons,
      score: this.calculateAlertScore()
    };
  }

  calculateAlertScore() {
    // Combined score based on multiple factors
    let score = 0;

    // Anomaly confidence contributes 0-40 points
    score += this.anomalyConfidence * 40;

    // SLO status contributes 0-30 points
    const sloScores = {
      healthy: 0,
      degraded: 20,
      critical: 30
    };
    score += sloScores[this.sloStatus] || 0;

    // Error budget contributes 0-30 points (inverse relationship)
    score += (100 - this.errorBudget) * 0.3;

    return Math.min(100, Math.round(score));
  }

  generateAlertMessage(alertLevel, reasons, escalationRules) {
    const templates = {
      info: {
        title: '💡 Observability Info',
        color: '#36a64f',
        emoji: '💡'
      },
      warning: {
        title: '⚠️ Observability Warning',
        color: '#ff9800',
        emoji: '⚠️'
      },
      high: {
        title: '🚨 High Priority Alert',
        color: '#ff5722',
        emoji: '🚨'
      },
      critical: {
        title: '🔥 CRITICAL ALERT',
        color: '#f44336',
        emoji: '🔥'
      }
    };

    const template = templates[alertLevel] || templates.info;
    
    const message = {
      title: template.title,
      level: alertLevel.toUpperCase(),
      emoji: template.emoji,
      color: template.color,
      timestamp: this.getDeterministicDate().toISOString(),
      summary: this.generateSummary(alertLevel, reasons),
      details: {
        anomaly_confidence: `${(this.anomalyConfidence * 100).toFixed(1)}%`,
        slo_status: this.sloStatus,
        error_budget_remaining: `${this.errorBudget.toFixed(1)}%`,
        alert_score: this.calculateAlertScore()
      },
      reasons,
      recommendations: this.generateRecommendations(alertLevel),
      escalation: {
        channels: escalationRules.levels[alertLevel]?.channels || ['slack'],
        delay: escalationRules.levels[alertLevel]?.escalation_delay || 0,
        assignees: escalationRules.levels[alertLevel]?.assignees || []
      },
      metadata: {
        repository: process.env.GITHUB_REPOSITORY,
        workflow: process.env.GITHUB_WORKFLOW,
        run_id: process.env.GITHUB_RUN_ID,
        actor: process.env.GITHUB_ACTOR
      }
    };

    return message;
  }

  generateSummary(level, reasons) {
    const summaries = {
      info: 'System operating normally with minor observations.',
      warning: 'Potential issues detected that require monitoring.',
      high: 'Significant issues detected that require immediate attention.',
      critical: 'Critical issues detected that require URGENT action.'
    };

    let summary = summaries[level] || summaries.info;
    
    if (reasons.length > 0) {
      summary += ` Primary concerns: ${reasons.slice(0, 2).join(', ')}.`;
    }

    return summary;
  }

  generateRecommendations(level) {
    const baseRecommendations = {
      info: [
        'Continue monitoring metrics',
        'No immediate action required'
      ],
      warning: [
        'Review recent changes and deployments',
        'Monitor trends over the next hour',
        'Check workflow logs for patterns'
      ],
      high: [
        'Investigate root cause immediately',
        'Review recent deployments and rollback if necessary',
        'Check system resources and dependencies',
        'Notify team leads and stakeholders'
      ],
      critical: [
        'IMMEDIATE ACTION REQUIRED',
        'Investigate and resolve within 15 minutes',
        'Consider emergency rollback procedures',
        'Escalate to on-call engineer immediately',
        'Implement incident response procedures',
        'Begin post-incident review preparation'
      ]
    };

    let recommendations = [...(baseRecommendations[level] || baseRecommendations.info)];

    // Add specific recommendations based on alert reasons
    if (this.anomalyConfidence > 0.8) {
      recommendations.push('Review ML anomaly detection results for specific metrics');
      recommendations.push('Validate anomaly against known system changes');
    }

    if (this.sloStatus !== 'healthy') {
      recommendations.push('Review SLO dashboard for specific SLI breaches');
      recommendations.push('Check error budget burn rate');
    }

    if (this.errorBudget < 25) {
      recommendations.push('Implement error budget protection measures');
      recommendations.push('Consider freezing non-critical deployments');
    }

    return recommendations;
  }

  async shouldSuppress(alertLevel, escalationRules) {
    // Check if we should suppress this alert due to recent similar alerts
    const suppressPath = '.github/observability-data/alert-suppression.json';
    
    try {
      let suppressionData = {};
      if (await fs.pathExists(suppressPath)) {
        suppressionData = await fs.readJson(suppressPath);
      }

      const suppressKey = `${alertLevel}_${this.sloStatus}_${Math.floor(this.anomalyConfidence * 10)}`;
      const suppressDuration = escalationRules.levels[alertLevel]?.suppress_duration || '30m';
      const suppressMs = this.parseDuration(suppressDuration);

      if (suppressionData[suppressKey]) {
        const lastAlert = new Date(suppressionData[suppressKey]);
        const timeSince = this.getDeterministicTimestamp() - lastAlert.getTime();
        
        if (timeSince < suppressMs) {
          consola.info(`Alert suppressed (${suppressKey}), last alert ${Math.round(timeSince / 1000)}s ago`);
          return true;
        }
      }

      // Update suppression data
      suppressionData[suppressKey] = this.getDeterministicDate().toISOString();
      await fs.writeJson(suppressPath, suppressionData, { spaces: 2 });

      return false;

    } catch (error) {
      consola.warn('Could not check alert suppression:', error.message);
      return false; // Don't suppress on error
    }
  }

  parseDuration(duration) {
    const match = duration.match(/^(\d+)([smhd])$/);
    if (!match) return 30 * 60 * 1000; // Default 30 minutes
    
    const [, amount, unit] = match;
    const multipliers = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000
    };
    
    return parseInt(amount) * (multipliers[unit] || multipliers.m);
  }

  async saveAlertData(alertMessage) {
    const alertsPath = '.github/observability-data/alerts';
    await fs.ensureDir(alertsPath);

    const timestamp = this.getDeterministicDate().toISOString().replace(/[:.]/g, '-');
    const alertFile = path.join(alertsPath, `alert-${timestamp}.json`);
    
    await fs.writeJson(alertFile, alertMessage, { spaces: 2 });

    // Update current alerts for dashboard
    const currentAlertsPath = '.github/observability-data/current-alerts.json';
    let currentAlerts = [];
    
    if (await fs.pathExists(currentAlertsPath)) {
      currentAlerts = await fs.readJson(currentAlertsPath);
    }

    // Add new alert
    currentAlerts.unshift({
      id: timestamp,
      level: alertMessage.level,
      title: alertMessage.title,
      timestamp: alertMessage.timestamp,
      summary: alertMessage.summary,
      score: alertMessage.details.alert_score
    });

    // Keep only last 50 alerts
    currentAlerts = currentAlerts.slice(0, 50);
    
    await fs.writeJson(currentAlertsPath, currentAlerts, { spaces: 2 });

    consola.success(`Alert data saved: ${alertFile}`);
  }

  async processAlert() {
    consola.info('🤖 Processing intelligent alert');

    try {
      // Load escalation rules
      const escalationRules = await this.loadEscalationRules();

      // Calculate alert level
      const alertAnalysis = this.calculateAlertLevel();
      
      consola.info(`Alert level: ${alertAnalysis.level} (score: ${alertAnalysis.score})`);
      consola.info(`Reasons: ${alertAnalysis.reasons.join(', ')}`);

      // Check if alert should be suppressed
      const shouldSuppress = await this.shouldSuppress(alertAnalysis.level, escalationRules);
      if (shouldSuppress) {
        return {
          sent: false,
          level: alertAnalysis.level,
          suppressed: true,
          reason: 'Alert suppressed due to recent similar alert'
        };
      }

      // Generate alert message
      const alertMessage = this.generateAlertMessage(
        alertAnalysis.level, 
        alertAnalysis.reasons, 
        escalationRules
      );

      // Save alert data
      await this.saveAlertData(alertMessage);

      return {
        sent: true,
        level: alertAnalysis.level,
        score: alertAnalysis.score,
        channels: alertMessage.escalation.channels,
        message: alertMessage,
        suppressed: false
      };

    } catch (error) {
      consola.error('Failed to process alert:', error);
      throw error;
    }
  }
}

// Create default escalation rules if they don't exist
async function createDefaultEscalationRules() {
  const rulesPath = '.github/scripts/observability/escalation-matrix.json';
  
  if (!(await fs.pathExists(rulesPath))) {
    await fs.ensureDir(path.dirname(rulesPath));
    
    const defaultRules = {
      levels: {
        info: {
          channels: ['slack'],
          escalation_delay: 0,
          suppress_duration: '1h',
          notification_template: 'info'
        },
        warning: {
          channels: ['slack', 'email'],
          escalation_delay: 300,
          suppress_duration: '30m',
          notification_template: 'warning'
        },
        high: {
          channels: ['slack', 'email', 'github_issue'],
          escalation_delay: 180,
          suppress_duration: '15m',
          notification_template: 'high',
          assignees: ['@team-lead', '@on-call']
        },
        critical: {
          channels: ['slack', 'email', 'pagerduty', 'github_issue'],
          escalation_delay: 60,
          suppress_duration: '5m',
          notification_template: 'critical',
          assignees: ['@team-lead', '@on-call', '@engineering-manager'],
          immediate_escalation: true
        }
      },
      routing: {
        slo_breach: 'high',
        anomaly_detected: 'warning',
        error_budget_critical: 'critical',
        system_down: 'critical'
      },
      contact_methods: {
        slack: {
          webhook_url: "${SLACK_WEBHOOK_URL}",
          mention_groups: {
            critical: ["@channel", "@here"],
            high: ["@team-lead"],
            warning: [],
            info: []
          }
        },
        email: {
          smtp_server: "${SMTP_SERVER}",
          recipients: {
            critical: ["oncall@company.com", "engineering@company.com"],
            high: ["team-lead@company.com"],
            warning: ["alerts@company.com"],
            info: ["alerts@company.com"]
          }
        },
        pagerduty: {
          integration_key: "${PAGERDUTY_INTEGRATION_KEY}",
          escalation_policy: "default"
        }
      }
    };

    await fs.writeJson(rulesPath, defaultRules, { spaces: 2 });
    consola.success(`Created default escalation rules: ${rulesPath}`);
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

  // Create default escalation rules if needed
  await createDefaultEscalationRules();

  const alerting = new IntelligentAlerting(options);

  try {
    consola.info('🤖 Starting intelligent alerting analysis');

    const result = await alerting.processAlert();

    // Set GitHub Actions outputs
    if (process.env.GITHUB_OUTPUT) {
      const outputs = [
        `sent=${result.sent}`,
        `level=${result.level}`,
        `suppressed=${result.suppressed}`
      ];
      
      if (result.score !== undefined) {
        outputs.push(`score=${result.score}`);
      }
      
      await fs.appendFile(process.env.GITHUB_OUTPUT, outputs.join('\n') + '\n');
    }

    if (result.sent) {
      console.log(`\n🚨 Alert Generated:`);
      console.log(`Level: ${result.level.toUpperCase()}`);
      console.log(`Score: ${result.score}`);
      console.log(`Channels: ${result.channels.join(', ')}`);
    } else {
      console.log(`\n✅ No alert generated (suppressed: ${result.suppressed})`);
    }

    consola.success('🎉 Intelligent alerting completed successfully');
    process.exit(0);

  } catch (error) {
    consola.error('💥 Intelligent alerting failed:', error);
    
    if (process.env.GITHUB_OUTPUT) {
      await fs.appendFile(process.env.GITHUB_OUTPUT, 'sent=false\nlevel=error\n');
    }
    
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { IntelligentAlerting };