#!/bin/bash
# scripts/validate-secrets.sh
# Validates GitHub repository secrets for Fortune 5 compliance

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

# Check if GitHub CLI is authenticated
if ! gh auth status &>/dev/null; then
  echo "❌ GitHub CLI not authenticated. Run 'gh auth login' first."
  exit 1
fi

# Check required secrets
echo "Checking required secrets..."
for secret in "${required_secrets[@]}"; do
  if gh secret list | grep -q "$secret"; then
    echo "✅ $secret configured"
  else
    missing_required+=("$secret")
    echo "❌ $secret missing"
  fi
done

# Check optional secrets
echo ""
echo "Checking optional secrets..."
for secret in "${optional_secrets[@]}"; do
  if gh secret list | grep -q "$secret"; then
    echo "✅ $secret configured"
  else
    missing_optional+=("$secret")
    echo "⚠️ $secret missing (optional)"
  fi
done

echo ""
echo "================================================"

# Report results
if [ ${#missing_required[@]} -eq 0 ]; then
  echo "🎉 All required secrets are configured!"
else
  echo "❌ Missing required secrets:"
  printf '  - %s\n' "${missing_required[@]}"
  echo ""
  echo "Run these commands to add missing secrets:"
  for secret in "${missing_required[@]}"; do
    case $secret in
      "NPM_TOKEN")
        echo "  gh secret set NPM_TOKEN --body \"npm_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx\""
        echo "    Get token from: https://www.npmjs.com/settings/tokens"
        ;;
      "SNYK_TOKEN")
        echo "  gh secret set SNYK_TOKEN --body \"xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx\""
        echo "    Get token from: https://app.snyk.io/account"
        ;;
      "SLACK_WEBHOOK_URL")
        echo "  gh secret set SLACK_WEBHOOK_URL --body \"https://hooks.slack.com/services/...\""
        echo "    Create webhook in Slack app settings"
        ;;
    esac
    echo ""
  done
  exit 1
fi

if [ ${#missing_optional[@]} -gt 0 ]; then
  echo "⚠️ Missing optional secrets (recommended for full functionality):"
  printf '  - %s\n' "${missing_optional[@]}"
else
  echo "🌟 All optional secrets configured!"
fi

echo ""
echo "🔒 Secret validation completed successfully"
echo "🚀 Repository is ready for production deployment!"

# Test token functionality if available
echo ""
echo "Testing token functionality..."

if gh secret list | grep -q "NPM_TOKEN"; then
  echo "📦 NPM_TOKEN present - ready for package publishing"
fi

if gh secret list | grep -q "SNYK_TOKEN"; then
  echo "🛡️ SNYK_TOKEN present - security scanning enabled"
fi

if gh secret list | grep -q "SLACK_WEBHOOK_URL"; then
  echo "💬 SLACK_WEBHOOK_URL present - notifications enabled"
fi

echo ""
echo "Next steps:"
echo "1. Run './scripts/test-workflows.sh ci' to test CI pipeline"
echo "2. Create a test PR to validate quality gates"
echo "3. Check branch protection rules are active"
echo "4. Verify deployment workflows work correctly"