# GitHub Actions CI/CD Deployment Guide

## 🚀 Overview

This guide documents the comprehensive CI/CD pipeline setup for the Unjucks project, featuring automated deployment workflows for NPM publishing, Docker container builds, and environment-specific deployments.

## 📋 Workflow Architecture

### 1. Production Deployment Pipeline (`deployment-production.yml`)

**Triggers:**
- Push to tags (`v*`, `[0-9]*`)
- Manual dispatch with environment selection

**Key Features:**
- ✅ Pre-deployment validation with 73%+ test pass rate requirement
- ✅ Multi-architecture Docker builds (AMD64, ARM64)
- ✅ Blue-green and canary deployment strategies
- ✅ Automated NPM publishing
- ✅ Health monitoring and rollback capabilities
- ✅ Environment-specific safety checks

**Environments:**
- `staging` - Automatic deployment from main branch
- `production` - Tag-based deployment with enhanced validation

### 2. NPM Publishing Workflow (`npm-publish.yml`)

**Triggers:**
- Push to tags (`v*`, `[0-9]*`)
- Manual dispatch with tag selection (latest, beta, alpha, next)

**Key Features:**
- ✅ Pre-publication validation and security scanning
- ✅ Multi-environment installation testing
- ✅ Package size validation and optimization
- ✅ Dry-run capability for testing
- ✅ Automatic publication verification
- ✅ Post-publication metadata updates

**NPM Distribution:**
- Package: `@seanchatmangpt/unjucks`
- Registry: `https://registry.npmjs.org`
- Access: Public with configurable restriction

### 3. Docker Deployment Pipeline (`docker-deployment.yml`)

**Triggers:**
- Push to branches (main, develop)
- Pull requests to main
- Manual dispatch with build type selection

**Key Features:**
- ✅ Multi-image build matrix (production, testing, performance, coordination, matrix)
- ✅ Multi-platform support (linux/amd64, linux/arm64)
- ✅ Container vulnerability scanning with Trivy
- ✅ Docker Compose configuration testing
- ✅ Performance benchmarking
- ✅ Automated cleanup of old images

**Container Registry:**
- Registry: `ghcr.io` (GitHub Container Registry)
- Images: `ghcr.io/unjucks/unjucks-{type}`
- Tags: Branch-based, SHA-based, and timestamp-based

### 4. Environment-Specific Deployments (`environment-deployment.yml`)

**Triggers:**
- Push to main, develop, release/* branches
- Push to tags
- Manual dispatch with environment and strategy selection

**Key Features:**
- ✅ Dynamic environment detection (development, staging, production, preview)
- ✅ Multiple deployment strategies (rolling, blue-green, canary, recreate)
- ✅ Environment-specific validation and safety checks
- ✅ Automated rollback on failure
- ✅ Extended monitoring and health checks
- ✅ Preview environment for PRs

**Deployment Strategies:**
- **Rolling**: Zero-downtime updates by gradually replacing instances
- **Blue-Green**: Deploy to parallel environment then switch traffic
- **Canary**: Gradual rollout with monitoring (10% → 100%)
- **Recreate**: Stop old, start new (for development)

## 🔧 Configuration Requirements

### Required Secrets

```yaml
# GitHub Repository Secrets
GITHUB_TOKEN: # Automatic GitHub token (pre-configured)
NPM_TOKEN: # NPM authentication token for publishing
```

### Required Environments

GitHub Environments should be configured with protection rules:

```yaml
# Production Environment
production:
  - Required reviewers: 2
  - Deployment branches: tags only
  - Environment secrets: NPM_TOKEN

# Staging Environment  
staging:
  - Required reviewers: 1
  - Deployment branches: main only

# NPM Publish Environment
npm-publish:
  - Required reviewers: 1
  - Environment secrets: NPM_TOKEN
```

### Environment Variables

```bash
# Docker Configuration
REGISTRY=ghcr.io
IMAGE_NAME=${{ github.repository }}
DOCKER_BUILDKIT=1

# Node.js Configuration
NODE_OPTIONS=--max-old-space-size=8192
CI=true

# Deployment Configuration
DEPLOYMENT_TIMEOUT=600
HEALTH_CHECK_RETRIES=10
```

## 🐳 Docker Images

### Image Types

1. **Production** (`Dockerfile.production`)
   - Optimized for production deployment
   - Security hardened with non-root user
   - Health checks and monitoring
   - Size optimized with multi-stage build

2. **Testing** (`Dockerfile.testing`)
   - Includes testing frameworks and tools
   - Development dependencies included
   - Used for CI/CD pipeline testing

3. **Performance** (`Dockerfile.performance`)
   - Performance monitoring tools (clinic, 0x, autocannon)
   - Resource stress testing capabilities
   - Profiling and benchmarking utilities

4. **Coordination** (`Dockerfile.coordination`)
   - Swarm coordination capabilities
   - Inter-service communication tools

5. **Matrix** (`Dockerfile.matrix`)
   - Matrix testing configurations
   - Cross-platform compatibility testing

### Docker Compose Configurations

```yaml
# Development
generated/docker-compose.development.yml

# Testing
docker/docker-compose.testing.yml

# Validation
docker/docker-compose.validation.yml

# Production
generated/docker-compose.production.yml
```

## 🚀 Deployment Workflows

### Development Deployment

```bash
# Triggered by: Push to develop branch
# Strategy: Recreate
# Environment: development
# URL: https://dev.unjucks.local

git push origin develop
```

### Staging Deployment

```bash
# Triggered by: Push to main branch
# Strategy: Rolling
# Environment: staging  
# URL: https://staging.unjucks.dev

git push origin main
```

### Production Deployment

```bash
# Triggered by: Tag creation
# Strategy: Blue-green
# Environment: production
# URL: https://unjucks.dev

git tag v2025.9.9
git push origin v2025.9.9
```

### Preview Deployment

```bash
# Triggered by: Push to release/* branches
# Strategy: Rolling
# Environment: preview
# URL: https://pr-{run_number}.preview.unjucks.dev

git checkout -b release/v2025.9.9
git push origin release/v2025.9.9
```

## 📊 Monitoring and Validation

### Health Checks

All deployments include comprehensive health monitoring:

```bash
# Basic health endpoint
curl -f https://{environment}.unjucks.dev/health

# API status endpoint
curl -f https://{environment}.unjucks.dev/api/status

# CLI functionality
docker exec {container} unjucks --version
docker exec {container} unjucks list
```

### Performance Validation

```bash
# Response time monitoring
curl -w "%{time_total}" https://unjucks.dev/health

# Resource utilization
docker stats --no-stream

# Stress testing
docker exec {container} /usr/local/bin/resource-stress.sh
```

### Rollback Procedures

Automatic rollback triggers:
- Health check failures (3+ consecutive)
- Response time > 2 seconds
- Container startup failures
- Manual rollback flag enabled

```bash
# Manual rollback
gh workflow run environment-deployment.yml \
  -f target_environment=production \
  -f rollback_on_failure=true
```

## 🧪 Local Testing

### Workflow Validation

```bash
# Validate workflow syntax
node scripts/validate-workflows.js --new

# Test workflow components locally
node scripts/test-workflows-locally.js
```

### Docker Testing

```bash
# Build and test Docker images
docker build -f docker/Dockerfile.production -t unjucks:production .
docker run --rm unjucks:production unjucks --version

# Test Docker Compose
docker-compose -f docker/docker-compose.testing.yml config --quiet
docker-compose -f docker/docker-compose.testing.yml up -d
```

### Package Testing

```bash
# Test package creation
npm pack --dry-run

# Test global installation
npm install -g ./unjucks-*.tgz
unjucks --version
```

## 🔐 Security Features

### Container Security

- ✅ Non-root user execution
- ✅ Read-only root filesystem where possible
- ✅ Security scanning with Trivy
- ✅ Minimal base images (Alpine Linux)
- ✅ Multi-stage builds to reduce attack surface

### Deployment Security

- ✅ Environment protection rules
- ✅ Secret management with GitHub Secrets
- ✅ Branch protection for production deployments
- ✅ Required reviewers for sensitive environments
- ✅ Audit logging for all deployments

### Code Security

- ✅ Automated security scanning (npm audit)
- ✅ Dependency vulnerability detection
- ✅ Hadolint for Dockerfile best practices
- ✅ SARIF security report uploads

## 📈 Performance Optimizations

### Build Optimization

- ✅ Docker layer caching
- ✅ Multi-platform builds with Buildx
- ✅ Parallel job execution
- ✅ Artifact caching for Node.js dependencies

### Deployment Optimization

- ✅ Blue-green deployments for zero downtime
- ✅ Health check optimization
- ✅ Resource limit configuration
- ✅ Load balancing considerations

### Monitoring Optimization

- ✅ Efficient health check intervals
- ✅ Resource usage monitoring
- ✅ Performance baseline tracking
- ✅ Alert thresholds configuration

## 🎯 Best Practices

### Workflow Design

1. **Fail Fast**: Early validation to catch issues quickly
2. **Parallel Execution**: Run independent jobs concurrently
3. **Environment Parity**: Consistent environments across stages
4. **Rollback Ready**: Always plan for rollback scenarios
5. **Monitor Everything**: Comprehensive monitoring and alerting

### Container Best Practices

1. **Security First**: Non-root users, minimal privileges
2. **Size Matters**: Optimize image size with multi-stage builds
3. **Health Checks**: Always include health check endpoints
4. **Logging**: Structured logging for better debugging
5. **Resource Limits**: Set appropriate CPU and memory limits

### Deployment Best Practices

1. **Gradual Rollouts**: Use canary or blue-green strategies
2. **Health Validation**: Extensive health checking
3. **Rollback Plans**: Automated rollback on failure
4. **Documentation**: Keep deployment docs updated
5. **Testing**: Test deployment procedures regularly

## 🚨 Troubleshooting

### Common Issues

1. **Build Failures**
   ```bash
   # Check Docker build logs
   docker build --no-cache -f Dockerfile.production .
   
   # Validate package.json
   npm run package:validate
   ```

2. **Deployment Failures**
   ```bash
   # Check container logs
   docker logs {container_name}
   
   # Verify health endpoints
   curl -v https://{environment}.unjucks.dev/health
   ```

3. **NPM Publishing Issues**
   ```bash
   # Test publication
   npm publish --dry-run
   
   # Check package availability
   npm view @seanchatmangpt/unjucks
   ```

### Support Resources

- **GitHub Actions Documentation**: https://docs.github.com/en/actions
- **Docker Documentation**: https://docs.docker.com/
- **NPM Publishing Guide**: https://docs.npmjs.com/
- **Project Issues**: https://github.com/unjucks/unjucks/issues

## 📝 Maintenance

### Regular Tasks

1. **Weekly**: Review deployment metrics and performance
2. **Monthly**: Update dependencies and security patches
3. **Quarterly**: Review and optimize workflow configurations
4. **Annually**: Security audit and infrastructure review

### Monitoring

- **Deployment Success Rate**: Target 95%+
- **Build Time**: Target <10 minutes
- **Test Pass Rate**: Maintain 73%+ for releases
- **Health Check Response**: Target <2 seconds

---

**Last Updated**: September 9, 2025  
**Version**: 1.0.0  
**Maintainer**: CI/CD Engineering Team