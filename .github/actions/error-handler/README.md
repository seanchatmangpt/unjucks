# Error Handler Action

A comprehensive error handling framework for GitHub Actions that provides retry logic, diagnostics collection, notifications, and recovery strategies.

## Features

- 🔄 **Intelligent Retry Logic** - Configurable retry attempts with exponential backoff
- 📊 **Diagnostic Collection** - Automatic collection of system and environment diagnostics on failures
- 📢 **Multi-Channel Notifications** - Support for webhooks and Slack notifications
- 🛡️ **Error Classification** - Automatic classification of error types for better handling
- 🔧 **Recovery Strategies** - Multiple recovery options including retry, fallback, skip, and fail
- 🎯 **Graceful Degradation** - Continue workflows on non-critical failures
- ⏱️ **Timeout Protection** - Configurable command timeouts to prevent hanging
- 📝 **Comprehensive Logging** - Detailed logging with timestamps and severity levels

## Usage

### Basic Usage

```yaml
- name: Run Command with Error Handling
  uses: ./.github/actions/error-handler
  with:
    command: 'npm test'
    max-retries: 3
    retry-delay: 5
    error-classification: 'critical'
```

### Advanced Usage

```yaml
- name: Deploy with Error Handling
  uses: ./.github/actions/error-handler
  with:
    command: 'npm run deploy'
    max-retries: 5
    retry-delay: 10
    exponential-backoff: true
    timeout: 15
    error-classification: 'critical'
    collect-diagnostics: true
    graceful-degradation: false
    recovery-strategy: 'retry'
    notification-webhook: ${{ secrets.ERROR_WEBHOOK_URL }}
    slack-webhook: ${{ secrets.SLACK_WEBHOOK_URL }}
    working-directory: './app'
    environment: '{"NODE_ENV": "production", "API_URL": "https://api.example.com"}'
```

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `command` | Command to execute with error handling | Yes | - |
| `max-retries` | Maximum number of retry attempts | No | `3` |
| `retry-delay` | Initial retry delay in seconds | No | `5` |
| `exponential-backoff` | Use exponential backoff for retries | No | `true` |
| `timeout` | Command timeout in minutes | No | `30` |
| `error-classification` | Error classification level (critical, warning, info) | No | `warning` |
| `notification-webhook` | Webhook URL for error notifications | No | - |
| `slack-webhook` | Slack webhook URL for notifications | No | - |
| `collect-diagnostics` | Collect diagnostic information on failure | No | `true` |
| `graceful-degradation` | Continue workflow on non-critical failures | No | `false` |
| `recovery-strategy` | Recovery strategy (retry, fallback, skip, fail) | No | `retry` |
| `working-directory` | Working directory for command execution | No | `.` |
| `environment` | Environment variables (JSON format) | No | `{}` |

## Outputs

| Output | Description |
|--------|-------------|
| `success` | Whether the command succeeded |
| `exit-code` | Final exit code |
| `attempts` | Number of attempts made |
| `error-type` | Type of error encountered |
| `diagnostics` | Diagnostic information collected (base64 encoded) |
| `recovery-action` | Recovery action taken |

## Error Classification

The action automatically classifies errors into the following types:

- `success` - Command completed successfully
- `general_error` - General error (exit code 1)
- `network_error` - Network connectivity issues
- `permission_error` - Permission or access denied errors
- `disk_space_error` - Disk space related errors
- `memory_error` - Memory related errors
- `authentication_error` - Authentication or credential errors
- `rate_limit_error` - Rate limiting or quota errors
- `command_not_found` - Command not found (exit code 127)
- `segmentation_fault` - Segmentation fault (exit code 139)
- `unknown_error` - Other unclassified errors

## Recovery Strategies

### Retry (default)
Continues the retry loop according to the configured retry settings.

### Fallback
Attempts to execute an alternative approach (customizable).

### Skip
Treats the failure as non-critical and continues the workflow.

### Fail
Stops execution immediately on the first failure.

## Notification Format

### Webhook Notification
```json
{
  "title": "GitHub Actions Error: critical",
  "message": "Command 'npm test' failed after 3 attempts. Error type: network_error",
  "severity": "critical",
  "timestamp": "2025-01-09T12:00:00Z",
  "workflow": "CI/CD Pipeline",
  "job": "test",
  "run_id": "123456789",
  "repository": "owner/repo"
}
```

### Slack Notification
Rich formatted message with:
- Color-coded severity (red for critical, yellow for warning, green for info)
- Repository, workflow, job, and run ID details
- Timestamp and GitHub Actions footer

## Examples

### CI Pipeline with Error Handling

```yaml
name: CI Pipeline with Error Handling

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: ./.github/actions/error-handler
        with:
          command: 'node --version && npm --version'
          max-retries: 2
          error-classification: 'critical'
          
      - name: Install Dependencies
        uses: ./.github/actions/error-handler
        with:
          command: 'npm ci'
          max-retries: 3
          retry-delay: 10
          error-classification: 'critical'
          notification-webhook: ${{ secrets.ERROR_WEBHOOK_URL }}
          
      - name: Run Tests
        uses: ./.github/actions/error-handler
        with:
          command: 'npm test'
          max-retries: 2
          error-classification: 'critical'
          collect-diagnostics: true
          slack-webhook: ${{ secrets.SLACK_WEBHOOK_URL }}
          
      - name: Build Project
        uses: ./.github/actions/error-handler
        with:
          command: 'npm run build'
          max-retries: 3
          timeout: 20
          error-classification: 'warning'
          graceful-degradation: true
```

### Deployment with Fallback Strategy

```yaml
      - name: Deploy to Production
        id: deploy
        uses: ./.github/actions/error-handler
        with:
          command: './deploy.sh production'
          max-retries: 3
          retry-delay: 30
          exponential-backoff: true
          timeout: 45
          error-classification: 'critical'
          recovery-strategy: 'fallback'
          notification-webhook: ${{ secrets.DEPLOYMENT_WEBHOOK }}
          environment: '{"ENV": "production", "DEPLOY_KEY": "${{ secrets.DEPLOY_KEY }}"}'
          
      - name: Check Deployment Status
        if: steps.deploy.outputs.success == 'true'
        run: |
          echo "Deployment succeeded after ${{ steps.deploy.outputs.attempts }} attempts"
          echo "Recovery action: ${{ steps.deploy.outputs.recovery-action }}"
```

## Best Practices

1. **Use appropriate error classifications** - Set `critical` for deployment failures, `warning` for optional steps
2. **Configure timeouts** - Set reasonable timeouts to prevent hanging workflows
3. **Enable diagnostics for critical steps** - Helps with debugging production issues
4. **Use exponential backoff** - Reduces load on external services during retries
5. **Set up notifications** - Configure webhooks or Slack for critical failure alerts
6. **Consider graceful degradation** - Enable for non-essential steps that shouldn't block the workflow
7. **Monitor retry patterns** - Use the outputs to understand failure patterns and optimize retry settings

## Troubleshooting

### Common Issues

1. **Command not found errors** - Ensure the command is available in the runner environment
2. **Permission errors** - Check file permissions and runner capabilities
3. **Network timeouts** - Increase timeout values for network-dependent operations
4. **Rate limiting** - Use exponential backoff and consider implementing jitter
5. **Memory issues** - Monitor resource usage and adjust runner specifications

### Debugging

Enable comprehensive logging by setting the error classification to a higher level and enabling diagnostic collection. The diagnostics output includes:

- System information (OS, disk space, memory)
- Environment variables
- Git repository status
- Network connectivity
- Process information

Decode the base64 diagnostics output:
```bash
echo "$DIAGNOSTICS" | base64 -d
```