# Workflow Monitoring & Reporting System

A comprehensive GitHub Actions workflow monitoring system that tracks performance, detects degradation, and generates actionable reports.

## Features

- 📊 **Daily Metrics Collection** - Automated collection of workflow performance data
- 📈 **Trend Analysis** - Detect performance trends and anomalies
- 🚨 **Real-time Alerts** - Slack, GitHub Issues, and email notifications
- 📋 **Weekly Reports** - Comprehensive performance summaries
- 🎯 **Performance Dashboard** - Interactive HTML dashboard
- 🔍 **Degradation Detection** - Automated performance issue identification
- 📱 **Multi-channel Notifications** - Flexible alert delivery options

## Quick Start

1. **Enable the monitoring workflow:**
   ```yaml
   # The monitoring.yml workflow is automatically enabled
   # It runs daily at 6:00 AM UTC and weekly on Mondays
   ```

2. **Configure alerts (optional):**
   ```bash
   # Add Slack webhook URL to repository secrets
   gh secret set SLACK_WEBHOOK_URL --body "https://hooks.slack.com/services/..."
   ```

3. **View the dashboard:**
   - Dashboard is automatically deployed to GitHub Pages
   - Access at: `https://your-username.github.io/your-repo/monitoring`

## Architecture

### Core Components

```
monitoring/
├── collect-metrics.js      # Metrics collection from GitHub API
├── analyze-trends.js       # Trend analysis and anomaly detection
├── check-degradation.js    # Performance degradation checker
├── generate-dashboard.js   # HTML dashboard generator
├── generate-weekly-report.js # Weekly report generator
├── send-slack-alert.js     # Slack notification sender
├── config.json            # System configuration
└── lib/
    └── utils.js           # Utility functions
```

### Workflow Jobs

1. **collect-metrics** - Gathers workflow performance data
2. **analyze-trends** - Detects performance trends and anomalies
3. **generate-reports** - Creates dashboard and weekly reports
4. **send-alerts** - Sends notifications for critical issues
5. **cleanup** - Maintains data retention policies

## Configuration

### Basic Configuration (`config.json`)

```json
{
  "monitoring": {
    "enabled": true,
    "workflows_to_monitor": [
      "ci.yml",
      "cd.yml",
      "test.yml"
    ],
    "metrics": {
      "success_rate": {
        "threshold_warning": 90,
        "threshold_critical": 80
      },
      "execution_time": {
        "threshold_warning_increase": 30,
        "threshold_critical_increase": 50
      }
    },
    "alerts": {
      "slack": {
        "enabled": false,
        "severity_levels": ["warning", "critical"]
      },
      "github_issues": {
        "enabled": true,
        "create_for_critical": true
      }
    }
  }
}
```

### Advanced Configuration

#### Workflow Patterns
```json
{
  "workflows_to_monitor": [
    "*.yml",
    "ci/*",
    "!test-*.yml"
  ]
}
```

#### Alert Thresholds
```json
{
  "metrics": {
    "success_rate": {
      "enabled": true,
      "threshold_warning": 90,
      "threshold_critical": 80
    },
    "execution_time": {
      "enabled": true,
      "threshold_warning_increase": 30,
      "threshold_critical_increase": 50
    },
    "resource_usage": {
      "enabled": true,
      "cost_threshold_warning": 20,
      "cost_threshold_critical": 35
    }
  }
}
```

## Metrics Collected

### Workflow Metrics
- **Success Rate** - Percentage of successful workflow runs
- **Execution Time** - Average, min, max duration per workflow
- **Failure Patterns** - Common failure reasons and frequency
- **Resource Usage** - Runner minutes and estimated costs
- **Trends** - Daily and hourly execution patterns

### System Metrics
- **Overall Performance** - Repository-wide success rates
- **Degradation Detection** - Performance regression alerts  
- **Cost Analysis** - CI/CD usage and cost trends
- **Reliability Scores** - Workflow stability ratings

## Reports Generated

### Daily Reports
- JSON format with detailed metrics
- Stored in `.github/monitoring-reports/daily/`
- Includes trend analysis and alerts

### Weekly Reports
- Comprehensive performance summary
- Both JSON and Markdown formats
- Includes recommendations and insights
- Executive summary for stakeholders

### Dashboard
- Interactive HTML dashboard
- Real-time status indicators
- Performance charts and visualizations
- Mobile-responsive design

## Alert Types

### Critical Alerts
- Success rate < 80%
- Duration increase > 50%
- Complete workflow failures
- System degradation detected

### Warning Alerts
- Success rate 80-90%
- Duration increase 30-50%
- Increasing failure rates
- Performance trends

### Alert Channels

#### Slack Integration
```bash
# Set up Slack webhook
gh secret set SLACK_WEBHOOK_URL --body "https://hooks.slack.com/..."

# Test Slack integration
node .github/scripts/monitoring/send-slack-alert.js --test
```

#### GitHub Issues
- Automatically created for critical alerts
- Includes metrics, trends, and recommendations
- Tagged with `monitoring`, `performance`, `alert` labels

#### Email Notifications
```json
{
  "alerts": {
    "email": {
      "enabled": true,
      "recipients": ["devops@company.com"]
    }
  }
}
```

## Usage Examples

### Manual Report Generation
```bash
# Generate daily report
node .github/scripts/monitoring/collect-metrics.js \
  --repo "owner/repo" \
  --token "$GITHUB_TOKEN" \
  --days-back 7

# Generate weekly report
node .github/scripts/monitoring/generate-weekly-report.js

# Create dashboard
node .github/scripts/monitoring/generate-dashboard.js \
  --output-format html
```

### Custom Metrics Collection
```bash
# Collect specific time period
node .github/scripts/monitoring/collect-metrics.js \
  --days-back 30 \
  --report-type monthly

# Check degradation with custom thresholds
node .github/scripts/monitoring/check-degradation.js \
  --threshold-failure-rate 10 \
  --threshold-duration-increase 25
```

### Trend Analysis
```bash
# Analyze trends with custom lookback
node .github/scripts/monitoring/analyze-trends.js \
  --lookback-days 21 \
  --report-type weekly
```

## Dashboard Features

### Overview Page
- System status indicator
- Key performance metrics
- Active alerts summary
- Trend visualizations

### Workflow Details
- Individual workflow performance
- Success rate trends
- Duration analysis
- Failure pattern breakdown

### Historical Data
- Performance over time
- Comparative analysis
- Seasonal patterns
- Cost tracking

## API Integration

### GitHub API Usage
- Workflow runs endpoint
- Repository workflows
- Job details and logs
- Rate limiting handled automatically

### Data Export
```javascript
// Access collected metrics
const metrics = require('.github/monitoring-reports/latest-metrics.json');

// Export to external systems
const dashboard = require('.github/monitoring-reports/dashboard/dashboard.json');
```

## Troubleshooting

### Common Issues

#### No Data Collected
```bash
# Check permissions
gh api repos/owner/repo/actions/workflows --jq '.workflows[].name'

# Verify token scope
gh auth status
```

#### Dashboard Not Loading
```bash
# Check file generation
ls -la .github/monitoring-reports/dashboard/

# Verify GitHub Pages settings
gh repo view --web
```

#### Alerts Not Sent
```bash
# Test Slack integration
node .github/scripts/monitoring/send-slack-alert.js --test

# Check webhook URL
echo $SLACK_WEBHOOK_URL
```

### Debug Mode
```bash
# Enable debug logging
DEBUG=monitoring:* node .github/scripts/monitoring/collect-metrics.js

# Verbose output
node .github/scripts/monitoring/analyze-trends.js --verbose
```

## Data Retention

### Automatic Cleanup
- Daily reports: 30 days
- Weekly reports: 12 weeks  
- Monthly reports: 6 months
- Analysis data: 90 days

### Manual Cleanup
```bash
# Clean old reports
find .github/monitoring-reports/daily -name "*.json" -mtime +30 -delete

# Archive data
tar -czf monitoring-archive-$(date +%Y%m%d).tar.gz .github/monitoring-reports/
```

## Security Considerations

### Token Permissions
Required GitHub token scopes:
- `actions:read` - Access workflow data
- `contents:write` - Update reports
- `issues:write` - Create alert issues

### Data Privacy
- No sensitive data stored in reports
- Logs are not collected or stored
- Only metadata and performance metrics

### Access Control
- Reports stored in repository
- Dashboard publicly accessible (GitHub Pages)
- Configure repository permissions as needed

## Contributing

### Adding New Metrics
1. Extend `collect-metrics.js` with new data collection
2. Update `analyze-trends.js` for trend analysis
3. Modify dashboard templates in `generate-dashboard.js`
4. Update configuration schema in `config.json`

### Custom Alert Channels
1. Create new sender in `lib/`
2. Add configuration options
3. Integrate with main alert workflow
4. Update documentation

## Support

### Resources
- [GitHub Actions API Documentation](https://docs.github.com/en/rest/actions)
- [Slack Webhook Integration](https://api.slack.com/messaging/webhooks)
- [Chart.js Documentation](https://www.chartjs.org/docs/)

### Getting Help
- Check troubleshooting section
- Review GitHub Actions logs
- Open issue with debug information
- Contact DevOps team for configuration help