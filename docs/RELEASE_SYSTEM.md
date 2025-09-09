# Enterprise Release Automation System

## 🎯 Overview

Complete enterprise-grade release automation system with semantic versioning, automated changelog generation, multi-channel publishing, provenance attestation, and safe rollback capabilities.

## 🏗️ Architecture

### Core Components

1. **Main Release Workflow** (`release.yml`)
   - Enterprise-grade release pipeline with semantic versioning
   - Supports manual and automatic triggers
   - Multi-platform testing matrix
   - Comprehensive rollback system

2. **Reusable Workflows**
   - `semantic-version.yml` - Calculate versions from conventional commits
   - `generate-changelog.yml` - Create rich changelogs from commits and PRs
   - `artifact-management.yml` - Build, sign, and publish with provenance

3. **Release Scripts**
   - `rollback.sh` - Safe rollback with validation and audit trail
   - `validate-release.sh` - Comprehensive pre-release validation

4. **Testing Workflow**
   - `act-release.yml` - Local testing with GitHub Actions simulation

## 🚀 Key Features

### ✅ Semantic Versioning
- **Auto-detection** from conventional commits
- **Conventional commit parsing** (feat, fix, BREAKING CHANGE)
- **Version calculation** with safety checks
- **Git tag creation** with rich metadata

### ✅ Release Channels
- **Stable** - Production releases (`latest` tag)
- **RC** - Release candidates for testing
- **Beta** - Beta releases for early adopters  
- **Alpha** - Development releases with timestamp suffixes

### ✅ Automated Changelog
- **Conventional changelog** generation
- **PR integration** with GitHub API
- **Breaking changes** detection and highlighting
- **Multiple formats** (markdown, JSON, HTML)

### ✅ Multi-Package Support
- **Monorepo ready** architecture
- **Independent versioning** capability
- **Parallel package publishing**

### ✅ Artifact Management
- **NPM publishing** with provenance attestation
- **Docker image building** (optional)
- **SBOM generation** for supply chain security
- **Keyless signing** with Sigstore integration

### ✅ Rollback System
- **Automatic rollback** on failure
- **Safety validation** before rollback
- **Audit trail** documentation
- **NPM dist-tag** management

## 📋 Usage Guide

### Manual Release

```bash
# Trigger via GitHub UI or CLI
gh workflow run release.yml \
  --field release-type=auto \
  --field release-channel=stable \
  --field dry-run=false
```

### Release Channels

```bash
# Alpha release
gh workflow run release.yml --field release-channel=alpha

# Beta release  
gh workflow run release.yml --field release-channel=beta

# Release candidate
gh workflow run release.yml --field release-channel=rc

# Production release
gh workflow run release.yml --field release-channel=stable
```

### Dry Run Testing

```bash
# Test release without publishing
gh workflow run release.yml --field dry-run=true
```

### Local Validation

```bash
# Full validation
chmod +x scripts/release/validate-release.sh
./scripts/release/validate-release.sh --level full

# Basic validation
./scripts/release/validate-release.sh --level basic
```

### Emergency Rollback

```bash
# Safe rollback to previous version
chmod +x scripts/release/rollback.sh
./scripts/release/rollback.sh 2.0.7 \
  --reason "Critical security vulnerability" \
  --dry-run  # Remove for actual rollback
```

## 🧪 Testing

### Local Testing with Act

```bash
# Install act: https://github.com/nektos/act

# Test dry run
act workflow_dispatch \
  -W .github/workflows/act-release.yml \
  --input test-type=dry-run

# Test rollback system
act workflow_dispatch \
  -W .github/workflows/act-release.yml \
  --input test-type=rollback

# Test validation
act workflow_dispatch \
  -W .github/workflows/act-release.yml \
  --input test-type=validation
```

### Validation Levels

- **Basic** - Essential checks (package.json, build, tests)
- **Standard** - + security scan + performance 
- **Full** - + compliance + documentation + advanced security

## 🛡️ Security Features

### Supply Chain Security
- **SLSA provenance** attestation
- **SBOM generation** (Software Bill of Materials)
- **Keyless signing** with Sigstore
- **Vulnerability scanning** with npm audit

### Security Validation
- **Credential detection** (hardcoded passwords, API keys)
- **Code pattern analysis** (eval usage, unsafe patterns)  
- **Dependency scanning** (known vulnerabilities)
- **File permission checks**

## 📊 Workflow Triggers

### Automatic Triggers
```yaml
on:
  push:
    branches: [main, 'release/*']
    tags: ['v*']
  pull_request:
    types: [closed]
    branches: [main]
```

### Manual Triggers
```yaml
workflow_dispatch:
  inputs:
    release-type: [auto, patch, minor, major, prerelease]
    release-channel: [alpha, beta, rc, stable]
    dry-run: [true, false]
    force-publish: [true, false]
```

## 📈 Monitoring & Notifications

### Release Metrics
- **Success/failure rates**
- **Release frequency**
- **Rollback frequency**
- **Validation time**

### Notifications
- **Slack integration** (success/failure)
- **GitHub releases** with rich descriptions
- **NPM package** publication
- **Documentation updates**

## 🔄 Rollback Process

### Automatic Rollback
1. **Failure detection** during release
2. **Target version** identification (last successful)
3. **Safety validation** (version exists, is older)
4. **Git operations** (branch creation, version reset)
5. **NPM handling** (deprecation warnings)
6. **Documentation** (audit trail creation)

### Manual Rollback
1. **Emergency assessment**
2. **Rollback script execution** with safety checks
3. **Validation testing**
4. **Communication** (team/user notification)

## 📚 Configuration

### Required Secrets
```bash
# NPM publishing
NPM_TOKEN=npm_xxxx

# Notifications (optional)
SLACK_WEBHOOK_URL=https://hooks.slack.com/...
DOCS_WEBHOOK_URL=https://your-docs-site.com/webhook

# GitHub token (auto-provided)
GITHUB_TOKEN=ghp_xxxx
```

### Package.json Scripts
```json
{
  "scripts": {
    "build": "...",
    "test": "...",
    "test:smoke": "...",
    "test:cli": "...",
    "security:scan": "npm audit --audit-level moderate",
    "prepublishOnly": "npm run build && npm test"
  }
}
```

## 🎉 Benefits

### For Developers
- **One-click releases** with full automation
- **Safe rollback** in case of issues  
- **Comprehensive validation** before publishing
- **Rich changelogs** generated automatically

### For Operations
- **Supply chain security** with provenance
- **Audit trails** for all releases
- **Monitoring** and alerting integration
- **Emergency procedures** well-defined

### For Users
- **Reliable releases** with testing across platforms
- **Clear changelogs** with breaking change highlights
- **Multiple channels** (stable, beta, alpha)
- **Quick fixes** with rollback capability

## 🔗 Related Files

- `.github/workflows/release.yml` - Main release workflow
- `.github/workflows/reusable/semantic-version.yml` - Version calculation
- `.github/workflows/reusable/generate-changelog.yml` - Changelog generation
- `.github/workflows/reusable/artifact-management.yml` - Artifact publishing
- `.github/workflows/act-release.yml` - Local testing workflow
- `scripts/release/rollback.sh` - Rollback script
- `scripts/release/validate-release.sh` - Validation script

---

**🎯 Ready for enterprise-grade releases with confidence!**