# Docker Workflow Migration Guide

This guide helps migrate from the existing separate Docker workflows to the new unified Docker workflow.

## 🔄 Migration Overview

### Before: Separate Workflows
- `docker-validation.yml` - Security scanning and validation
- `docker-deployment.yml` - Build and deployment pipeline
- Multiple duplicate configurations
- Inconsistent security scanning
- Manual registry management

### After: Unified Workflow
- `docker-unified.yml` - Single comprehensive pipeline
- Integrated security scanning across all stages
- Automated registry management and cleanup
- Consistent multi-arch builds with layer caching
- Comprehensive reporting and monitoring

## 📋 Migration Steps

### Step 1: Backup Existing Workflows
```bash
# Create backup directory
mkdir -p .github/workflows/backup

# Backup existing workflows
cp .github/workflows/docker-validation.yml .github/workflows/backup/
cp .github/workflows/docker-deployment.yml .github/workflows/backup/

# Document current state
echo "Backup created on $(date)" > .github/workflows/backup/README.md
```

### Step 2: Review Configuration Changes

#### Environment Variables
```yaml
# Old configuration (multiple files)
env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

# New unified configuration
env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}
  DOCKER_BUILDKIT: 1
  COMPOSE_DOCKER_CLI_BUILD: 1
```

#### Workflow Triggers
```yaml
# Enhanced trigger configuration
on:
  push:
    branches: [main, develop]
    tags: ['v*', '[0-9]*']
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 2 * * *'  # Daily validation
  workflow_dispatch:
    inputs:
      deployment_environment:
        description: 'Target deployment environment'
        required: true
        default: 'staging'
        type: choice
        options:
          - staging
          - production
          - testing
```

### Step 3: Update Secrets and Permissions

#### Required Secrets
```bash
# GitHub Container Registry (automatic)
GITHUB_TOKEN (automatic)

# Optional: Enhanced security scanning
SNYK_TOKEN (for Snyk scanning)

# Optional: Slack/Teams notifications
SLACK_WEBHOOK_URL
TEAMS_WEBHOOK_URL
```

#### Repository Permissions
```yaml
permissions:
  contents: read
  packages: write
  security-events: write
  actions: read
```

### Step 4: Deploy Unified Workflow

#### A. Gradual Migration (Recommended)
```bash
# 1. Deploy unified workflow alongside existing ones
cp docker-unified.yml .github/workflows/
git add .github/workflows/docker-unified.yml
git commit -m "Add unified Docker workflow for testing"

# 2. Test unified workflow on feature branch
git checkout -b test-unified-docker
# Make a small change to trigger workflow
git push origin test-unified-docker

# 3. Validate results and performance
# Check GitHub Actions tab for workflow execution

# 4. After validation, disable old workflows
# Rename old workflows to prevent execution
mv .github/workflows/docker-validation.yml .github/workflows/docker-validation.yml.disabled
mv .github/workflows/docker-deployment.yml .github/workflows/docker-deployment.yml.disabled
```

#### B. Direct Migration (Advanced)
```bash
# Replace existing workflows directly
rm .github/workflows/docker-validation.yml
rm .github/workflows/docker-deployment.yml
cp docker-unified.yml .github/workflows/
git add .github/workflows/
git commit -m "Migrate to unified Docker workflow"
```

### Step 5: Update Documentation

#### Update README.md
```markdown
## 🐳 Docker Workflow

This project uses a unified Docker workflow that provides:

- Multi-architecture builds (linux/amd64, linux/arm64)
- Comprehensive security scanning (Trivy, Snyk, Grype, Hadolint)
- Automated registry management and cleanup
- Docker Compose testing across multiple environments
- Performance testing and optimization
- Zero-downtime deployment strategies

### Workflow Triggers

- **Push to main/develop**: Full build and security scan
- **Pull Request**: Validation and testing
- **Tags**: Production deployment
- **Scheduled**: Daily comprehensive validation
- **Manual**: Custom deployment with environment selection

### Available Image Types

- `production`: Optimized for production deployment
- `testing`: Includes testing tools and utilities
- `performance`: Performance testing and monitoring
- `coordination`: Multi-agent coordination capabilities
```

#### Update Contributing Guidelines
```markdown
## Docker Development

### Local Testing
```bash
# Test unified workflow components
./scripts/docker-performance-optimizer.sh --benchmark
./scripts/registry-cleanup.sh --dry-run --report-only

# Security validation
docker build -f docker/Dockerfile.production -t test:latest .
docker run --rm test:latest unjucks --version
```

### CI/CD Pipeline
The unified Docker workflow automatically:
1. Builds multi-architecture images
2. Runs security scans
3. Tests Docker Compose configurations
4. Performs registry cleanup
5. Deploys to appropriate environments
```

## 📊 Feature Comparison

| Feature | Old Workflows | Unified Workflow |
|---------|---------------|------------------|
| **Multi-arch builds** | ❌ Limited | ✅ Full support |
| **Layer caching** | ❌ Basic | ✅ Advanced (GHA + Registry) |
| **Security scanning** | ⚠️ Basic | ✅ Comprehensive (4 scanners) |
| **Registry management** | ❌ Manual | ✅ Automated cleanup |
| **Compose testing** | ❌ Limited | ✅ 4 environments |
| **Performance testing** | ❌ None | ✅ Integrated |
| **Monitoring** | ❌ Basic | ✅ Comprehensive reporting |
| **Zero-downtime deploy** | ❌ None | ✅ Rolling updates |

## 🚨 Breaking Changes

### Build Context Changes
```bash
# Old: Multiple build contexts
docker build -f docker/Dockerfile.production .
docker build -f docker/Dockerfile.testing .

# New: Unified with build args
docker buildx build \
  --file docker/Dockerfile.production \
  --platform linux/amd64,linux/arm64 \
  --build-arg VERSION=v1.0.0 \
  .
```

### Environment Variables
```bash
# Removed (no longer needed)
COMPOSE_PROJECT_NAME=unjucks-old

# Added (required)
DOCKER_BUILDKIT=1
COMPOSE_DOCKER_CLI_BUILD=1
```

### Image Tags
```yaml
# Old tagging format
ghcr.io/unjucks/unjucks:latest
ghcr.io/unjucks/unjucks:main-abc123

# New tagging format  
ghcr.io/unjucks/unjucks-production:latest-production
ghcr.io/unjucks/unjucks-testing:main-abc123-testing
```

## 🔧 Troubleshooting Migration

### Common Issues

#### 1. Build Failures
```bash
# Issue: Missing buildx builder
Error: builder "unjucks-builder" not found

# Solution: Initialize builder
docker buildx create --name unjucks-builder --use
```

#### 2. Registry Authentication
```bash
# Issue: Registry login failures
Error: authentication required

# Solution: Check GitHub token permissions
# Ensure GITHUB_TOKEN has packages:write scope
```

#### 3. Cache Misses
```bash
# Issue: Cache not being used
Cache miss for build-production-main

# Solution: Check cache scope configuration
# Verify GITHUB_TOKEN has actions:read permission
```

#### 4. Security Scan Failures
```bash
# Issue: Snyk scan failures
Error: SNYK_TOKEN not found

# Solution: Add Snyk token or disable Snyk scanner
# Either add SNYK_TOKEN secret or remove Snyk from matrix
```

### Validation Commands
```bash
# Test unified workflow locally
act -W .github/workflows/docker-unified.yml

# Validate Docker configurations
docker-compose -f docker/docker-compose.testing.yml config

# Check security settings
./scripts/docker-performance-optimizer.sh
```

### Rollback Procedure
```bash
# Emergency rollback to old workflows
mv .github/workflows/docker-unified.yml .github/workflows/docker-unified.yml.backup
mv .github/workflows/backup/docker-validation.yml .github/workflows/
mv .github/workflows/backup/docker-deployment.yml .github/workflows/
git add .github/workflows/
git commit -m "Emergency rollback to old Docker workflows"
```

## 📈 Performance Expectations

### Build Time Improvements
- **Initial builds**: 20-30% faster due to BuildKit optimizations
- **Cached builds**: 50-70% faster with advanced layer caching
- **Multi-arch builds**: Parallel execution reduces overall time

### Resource Usage
- **CPU**: More efficient with parallel builds
- **Memory**: Optimized with staged dependencies
- **Storage**: Reduced with automated cleanup

### Security Improvements
- **Vulnerability detection**: 4x more comprehensive
- **Container hardening**: Production-ready security
- **Runtime protection**: Advanced monitoring

## 🎯 Success Metrics

### Pre-Migration Baseline
- Build time: ~45 minutes
- Security scans: 1 scanner (basic)
- Cache hit ratio: ~30%
- Manual registry cleanup: Weekly

### Post-Migration Targets
- Build time: ~30 minutes (33% improvement)
- Security scans: 4 scanners (comprehensive)
- Cache hit ratio: ~80% (150% improvement) 
- Automated registry cleanup: Daily

### Validation Checklist
- [ ] All image types build successfully
- [ ] Security scans complete without errors
- [ ] Multi-architecture images are created
- [ ] Registry cleanup executes properly
- [ ] Deployment to staging/production works
- [ ] Performance metrics meet targets
- [ ] Documentation is updated
- [ ] Team is trained on new workflow

## 📞 Support

### Getting Help
1. **GitHub Issues**: Report bugs or feature requests
2. **Documentation**: Check this guide and security hardening docs
3. **Team Chat**: Reach out in development channels
4. **Logs**: Check GitHub Actions logs for detailed errors

### Additional Resources
- [Docker Security Hardening Guide](docs/docker-security-hardening.md)
- [Performance Optimization Script](scripts/docker-performance-optimizer.sh)
- [Registry Cleanup Documentation](scripts/registry-cleanup.sh)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)

---

**Note**: This migration should be performed during a maintenance window or when the development team can monitor the transition closely.