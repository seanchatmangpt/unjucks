# GitHub Integration Documentation

This directory contains comprehensive GitHub integration configuration for the Unjucks project, implementing production-ready CI/CD validation, security scanning, and automated workflows.

## 🏗️ Architecture Overview

The GitHub integration follows a hierarchical validation structure with multiple quality gates and automated processes:

```
┌─────────────────────────────────────────────────────────────┐
│                    GitHub Integration                        │
├─────────────────────────────────────────────────────────────┤
│  Quality Gate → Core Tests → Advanced Tests → Security      │
│      ↓              ↓             ↓             ↓           │
│  Lint Check    Unit Tests    Integration   SAST Analysis    │
│  Type Check    Build Tests   Docker Tests  Dependency Scan  │
│  Build Valid   Performance   LaTeX Tests   Secrets Scan     │
│                                                             │
│  Final Validation Gate → Deployment (main branch only)     │
└─────────────────────────────────────────────────────────────┘
```

## 📋 Workflows

### 1. CI/CD Validation Pipeline (`ci-cd-validation.yml`)

**Primary workflow for comprehensive validation**

- **Triggers**: Push to main/develop, PRs, manual dispatch
- **Quality Gate**: Fast feedback with lint, type, build, security checks
- **Test Matrix**: Node.js 18, 20, 22 across multiple test suites
- **Advanced Tests**: LaTeX, templates, chaos testing
- **Docker Validation**: Container testing and resource validation
- **Performance**: Load testing and benchmarking
- **Deployment**: Automatic npm publishing on main branch success

**Status Checks Required for Merge:**
- ✅ Quality Gate
- ✅ Core Tests (Node 18, 20, 22)
- ✅ Build Validation
- ✅ Security Scan

### 2. PR Validation & Automation (`pr-validation.yml`)

**Automated PR processing and validation**

- **PR Analysis**: Size calculation, breaking change detection
- **Auto-labeling**: Size, type, and component-based labeling
- **Code Quality**: Lint and test results with PR comments
- **Auto-merge**: Dependabot PRs with small size and no breaking changes
- **PR Commands**: `/unjucks test`, `/unjucks build`, `/unjucks security`, `/unjucks help`

### 3. Status Checks & Quality Gates (`status-checks.yml`)

**Mandatory and optional status checks**

**Mandatory (blocking merge):**
- ✅ Lint Check
- ✅ Type Check  
- ✅ Unit Tests (Node 18, 20)
- ✅ Build Check
- ✅ Security Audit

**Optional (non-blocking on PRs):**
- ⚠️ Integration Tests
- ⚠️ Performance Check
- 📊 Daily Health Check (scheduled)

### 4. Security Scanning & Compliance (`security-scanning.yml`)

**Comprehensive security validation**

- **SAST Analysis**: CodeQL and custom security scanning
- **Dependency Scanning**: npm audit, vulnerability detection, SBOM generation
- **Secrets Scanning**: TruffleHog and pattern-based detection
- **License Compliance**: Prohibited license detection
- **Supply Chain Security**: Package integrity and malicious package detection
- **Security Summary**: Automated reporting and PR comments

## 🔒 Branch Protection Rules

### Main Branch Protection
- **Required Status Checks**: All mandatory checks must pass
- **Required Reviews**: 1 approving review from code owners
- **Dismiss Stale Reviews**: Enabled
- **Restrict Force Pushes**: Disabled for maintainers only
- **Linear History**: Not required (allows merge commits)
- **Conversation Resolution**: Required

### Develop Branch Protection
- **Required Status Checks**: Basic checks (lint, type, unit tests)
- **Required Reviews**: 1 approving review
- **Force Pushes**: Allowed for development flexibility
- **Less Restrictive**: Faster iteration for development

## 🏷️ Automated Labeling

### Size Labels (auto-applied)
- `size/small` - < 50 lines changed
- `size/medium` - 50-200 lines changed  
- `size/large` - > 200 lines changed

### Type Labels (auto-applied based on file changes)
- `tests` - Test file changes
- `documentation` - Documentation changes
- `templates` - Template file changes
- `enhancement` - Source code changes
- `ci/cd` - GitHub workflow changes
- `breaking-change` - Breaking changes detected
- `dependencies` - Dependabot PRs

### Priority Labels (manual)
- `priority/low` - Low priority
- `priority/medium` - Medium priority
- `priority/high` - High priority
- `priority/critical` - Critical priority

## 🤖 Automated Features

### Auto-merge Conditions
Dependabot PRs are automatically merged if:
- PR size is small (< 50 lines)
- No breaking changes detected
- All mandatory status checks pass
- Security scans pass

### PR Commands
Comment on PRs with these commands:
- `/unjucks test` - Trigger full test suite
- `/unjucks build` - Trigger build validation
- `/unjucks security` - Trigger security scan
- `/unjucks help` - Show available commands

### Automated Comments
- **Code Quality Report**: Lint and test results on every push
- **Security Summary**: Security scan results on PRs
- **Status Updates**: Progress updates for long-running workflows

## 📊 Quality Metrics

### Test Coverage Requirements
- **Minimum Coverage**: 50% for all metrics
- **Coverage Types**: Lines, functions, branches, statements
- **Coverage Reports**: Generated for Node.js 18 (primary)

### Performance Benchmarks
- **LaTeX Processing**: Performance benchmarking
- **Template Rendering**: Speed and memory usage
- **CLI Operations**: Command execution time
- **Build Performance**: Build time tracking

### Security Standards
- **Vulnerability Threshold**: No high/critical vulnerabilities
- **License Compliance**: No GPL/AGPL/LGPL licenses
- **Secret Detection**: No hardcoded secrets/tokens
- **Supply Chain**: Package integrity verification

## 🚀 Deployment Pipeline

### Production Deployment (main branch only)
1. **Validation Gate**: All tests and checks must pass
2. **Production Validation**: Final quality checks
3. **Package Preparation**: Build artifacts and metadata
4. **NPM Publishing**: Automated release to npm registry
5. **GitHub Release**: Automated release creation with changelog

### Staging Deployment (develop branch)
- **Preview Builds**: Available for testing
- **Integration Testing**: Full test suite execution
- **Performance Testing**: Benchmark comparisons

## 📁 Configuration Files

### Repository Settings
- `config/github/repository-settings.yml` - Complete repository configuration
- `config/github/branch-protection.json` - Branch protection rules and settings

### Issue Templates
- `.github/ISSUE_TEMPLATE/bug_report.yml` - Structured bug reports
- `.github/ISSUE_TEMPLATE/feature_request.yml` - Feature request template
- `.github/ISSUE_TEMPLATE/config.yml` - Issue template configuration

### PR Template
- `.github/PULL_REQUEST_TEMPLATE.md` - Comprehensive PR template with checklists

## 🔧 Setup Instructions

### 1. Repository Secrets
Configure these secrets in GitHub repository settings:
- `NPM_TOKEN` - NPM publishing token
- `CODECOV_TOKEN` - Code coverage reporting
- `SLACK_WEBHOOK` - Notification webhook (optional)
- `SENTRY_DSN` - Error tracking (optional)

### 2. Environment Configuration
Set up protected environments:
- **production** - Main branch deployments with reviewer approval
- **staging** - Development branch deployments

### 3. Branch Protection
Apply branch protection rules using GitHub API or web interface:
```bash
# Apply main branch protection
gh api repos/:owner/:repo/branches/main/protection \
  --method PUT \
  --field required_status_checks='{"strict":true,"contexts":["✓ Lint Check","✓ Type Check","✓ Unit Tests","✓ Build Check","✓ Security Audit","Status Check Summary"]}' \
  --field enforce_admins=false \
  --field required_pull_request_reviews='{"required_approving_review_count":1,"dismiss_stale_reviews":true,"require_code_owner_reviews":true}'
```

### 4. Labels Setup
Auto-create labels using the provided configuration:
```bash
# Create all labels from configuration
gh label create --repo unjucks/unjucks --file config/github/branch-protection.json
```

## 📈 Monitoring & Metrics

### Workflow Monitoring
- **Success Rates**: Track workflow success/failure rates
- **Execution Time**: Monitor workflow performance
- **Resource Usage**: GitHub Actions minutes and storage

### Quality Metrics Dashboard
- **Test Coverage Trends**: Track coverage over time
- **Security Score**: Aggregate security posture
- **Performance Benchmarks**: Speed and efficiency metrics
- **Code Quality**: Lint issues and complexity metrics

### Alerts & Notifications
- **Failed Deployments**: Immediate notifications
- **Security Vulnerabilities**: Critical security alerts
- **Performance Regressions**: Benchmark degradation alerts
- **Dependency Updates**: Weekly security update summary

## 🛠️ Troubleshooting

### Common Issues

**Status Check Failures**
- Check workflow logs for specific error details
- Verify all required status checks are configured
- Ensure branch protection rules match workflow names

**Auto-merge Not Working**
- Verify PR meets auto-merge criteria
- Check that all status checks are passing
- Confirm Dependabot permissions

**Security Scan False Positives**
- Review security scan results in workflow artifacts
- Update security configurations if needed
- Add exceptions for false positives

**Performance Test Failures**
- Check performance benchmarks against baselines
- Review performance test configuration
- Investigate resource constraints

### Debug Commands
```bash
# Check workflow status
gh run list --workflow=ci-cd-validation.yml --limit=10

# View specific workflow run
gh run view <run-id> --log

# List repository secrets
gh secret list

# Check branch protection status
gh api repos/:owner/:repo/branches/main/protection
```

## 📚 Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Branch Protection Rules](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/defining-the-mergeability-of-pull-requests/about-protected-branches)
- [Security Best Practices](https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions)
- [Workflow Optimization](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions)

---

## Support

For questions or issues with GitHub integration:
1. Check workflow logs and error messages
2. Review this documentation
3. Create an issue with the `ci/cd` label
4. Contact maintainers for urgent deployment issues