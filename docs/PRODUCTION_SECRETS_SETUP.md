# Production Secrets Setup Guide
**Fortune 5 Security Standards**

## Required Secrets Configuration

### 1. NPM Publishing Token
```bash
# Generate NPM token at https://www.npmjs.com/settings/tokens
# Select "Automation" token type for CI/CD
gh secret set NPM_TOKEN --body "npm_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

**Token Requirements**:
- Type: Automation token
- Scope: Publish and modify packages  
- Expiration: 1 year (with rotation reminder)

### 2. Security Scanning Token (Snyk)
```bash
# Get token from https://app.snyk.io/account
gh secret set SNYK_TOKEN --body "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

### 3. Notification Webhooks
```bash
# Slack webhook for security alerts
gh secret set SLACK_WEBHOOK_URL --body "https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX"

# Performance monitoring webhook
gh secret set PERFORMANCE_WEBHOOK_URL --body "https://your-monitoring-service.com/webhook"
```

### 4. Optional Docker Registry Token
```bash
# If using private Docker registry
gh secret set DOCKER_REGISTRY_TOKEN --body "docker_registry_token_here"
```

## Environment Variables Configuration

Add these to `.github/workflows/production.yml`:

```yaml
env:
  # Security thresholds
  CRITICAL_VULNERABILITY_THRESHOLD: 0
  HIGH_VULNERABILITY_THRESHOLD: 2
  MEDIUM_VULNERABILITY_THRESHOLD: 10
  
  # Performance thresholds  
  BUNDLE_SIZE_LIMIT: "250KB"
  COVERAGE_THRESHOLD_LINES: 85
  COVERAGE_THRESHOLD_FUNCTIONS: 90
  COVERAGE_THRESHOLD_BRANCHES: 80
  
  # Compliance settings
  AUDIT_RETENTION_DAYS: 90
  COMPLIANCE_LEVEL: "FORTUNE_5"
  
  # Node.js optimization
  NODE_OPTIONS: "--max-old-space-size=4096"
  NODE_ENV: "production"
```

## Secret Validation Script

Create this script to validate all required secrets:

```bash
#!/bin/bash
# scripts/validate-secrets.sh

echo "🔍 Validating GitHub repository secrets..."

required_secrets=(
  "NPM_TOKEN"
  "SNYK_TOKEN" 
  "SLACK_WEBHOOK_URL"
)

optional_secrets=(
  "PERFORMANCE_WEBHOOK_URL"
  "DOCKER_REGISTRY_TOKEN"
)

missing_required=()
missing_optional=()

# Check required secrets
for secret in "${required_secrets[@]}"; do
  if ! gh secret list | grep -q "$secret"; then
    missing_required+=("$secret")
  else
    echo "✅ $secret configured"
  fi
done

# Check optional secrets
for secret in "${optional_secrets[@]}"; do
  if ! gh secret list | grep -q "$secret"; then
    missing_optional+=("$secret")
  else
    echo "✅ $secret configured"
  fi
done

# Report results
if [ ${#missing_required[@]} -eq 0 ]; then
  echo "🎉 All required secrets are configured!"
else
  echo "❌ Missing required secrets:"
  printf '  - %s\n' "${missing_required[@]}"
  exit 1
fi

if [ ${#missing_optional[@]} -gt 0 ]; then
  echo "⚠️ Missing optional secrets:"
  printf '  - %s\n' "${missing_optional[@]}"
fi

echo "🔒 Secret validation completed successfully"
```

## Permissions Review

Ensure workflows use minimal required permissions:

```yaml
permissions:
  contents: read          # Read repository contents
  security-events: write  # Upload SARIF results
  actions: read          # Read workflow run data
  checks: write          # Write check results
  packages: write        # Publish packages (production only)
  pull-requests: write   # Comment on PRs (if needed)
```

## Quick Setup Commands

Run these commands to set up production secrets:

```bash
# 1. Validate GitHub CLI is authenticated
gh auth status

# 2. Set required secrets (replace with actual values)
gh secret set NPM_TOKEN --body "YOUR_NPM_TOKEN_HERE"
gh secret set SNYK_TOKEN --body "YOUR_SNYK_TOKEN_HERE" 
gh secret set SLACK_WEBHOOK_URL --body "YOUR_SLACK_WEBHOOK_URL"

# 3. Validate setup
chmod +x scripts/validate-secrets.sh
./scripts/validate-secrets.sh

# 4. Test workflows
./scripts/test-workflows.sh ci
```

## Security Best Practices

1. **Token Rotation**: Rotate tokens every 6-12 months
2. **Scope Limitation**: Use minimal token scopes required
3. **Monitoring**: Monitor token usage and access patterns
4. **Backup**: Store encrypted backup of critical tokens
5. **Audit**: Regular secret access audits

## Troubleshooting

**Common Issues**:

1. **NPM_TOKEN Invalid**:
   ```bash
   # Test token validity
   curl -H "Authorization: Bearer $NPM_TOKEN" https://registry.npmjs.org/-/whoami
   ```

2. **Snyk Token Issues**:
   ```bash
   # Test Snyk authentication
   npx snyk auth $SNYK_TOKEN
   npx snyk test --dry-run
   ```

3. **Webhook Validation**:
   ```bash
   # Test webhook endpoint
   curl -X POST -H "Content-Type: application/json" \
        -d '{"test": "message"}' \
        $SLACK_WEBHOOK_URL
   ```

## Production Deployment Checklist

- [ ] NPM_TOKEN configured and validated
- [ ] SNYK_TOKEN configured and tested
- [ ] Webhook URLs configured and tested
- [ ] Branch protection rules active
- [ ] Required status checks passing
- [ ] Artifact retention policies set
- [ ] Security scanning enabled
- [ ] Performance monitoring active
- [ ] Compliance validation passing
- [ ] Local ACT testing verified

**Ready for Production**: ✅ All items checked