# Disabled GitHub Workflows

This directory contains workflows that have been disabled to reduce redundancy and improve CI/CD efficiency.

## Consolidation Strategy

The following workflows have been consolidated into core workflows:

### Consolidated into `optimized-ci.yml`:
- `ci.yml` - Basic CI functionality
- `ci-main.yml` - Main branch CI
- `nodejs-ci.yml` - Node.js specific CI
- `cross-platform-ci.yml` - Cross-platform testing
- `comprehensive-testing.yml` - Comprehensive test suite
- `checks.yml` - General checks
- `status-checks.yml` - Status validation
- `test-status-badges.yml` - Badge generation
- `performance.yml` - Performance testing (integrated)
- `performance-benchmarks.yml` - Benchmark testing
- `code-quality.yml` - Code quality checks
- `act-ci.yml` - Act local testing
- `act-build-validation.yml` - Act build validation
- `act-core-cicd.yml` - Act core CI/CD
- `act-core-cicd-simple.yml` - Simplified Act CI/CD

### Consolidated into `security.yml`:
- `security-scanning.yml` - Security scanning
- `act-security.yml` - Act security testing
- `act-enterprise-security.yml` - Enterprise security
- `enterprise-security.yml` - Enterprise security features

### Consolidated into `deployment.yml` (renamed from deployment.yml):
- `deployment-production.yml` - Production deployment
- `deployment-validation.yml` - Deployment validation
- `environment-deployment.yml` - Environment-specific deployment
- `docker-deployment.yml` - Docker deployment

### Consolidated into `release.yml`:
- `release-automation.yml` - Release automation
- `enterprise-release.yml` - Enterprise release features
- `auto-build-publish.yml` - Auto build and publish
- `npm-publish.yml` - NPM publishing

### Consolidated into `docker-unified.yml`:
- `docker-validation.yml` - Docker validation
- `act-performance.yml` - Act performance testing

### Special Purpose (Disabled but Available):
- `deploy-book.yml` - Documentation deployment
- `pages-config.yml` - GitHub Pages configuration
- `latex-ci.yml` - LaTeX document processing
- `latex-validation.yml` - LaTeX validation
- `repo-size-monitor.yml` - Repository size monitoring
- `production-validation.yml` - Production validation
- `autofix.yml` - Automated fixes
- `ci-cd-validation.yml` - CI/CD pipeline validation
- `validate-swarm-improvements.yml` - Swarm validation
- `pr-validation.yml` - PR-specific validation
- `unified-quality-gate.yml` - Quality gate (replaced by optimized-ci.yml)
- `workflow-optimizer.yml` - Workflow optimization
- `core-cicd.yml` - Core CI/CD (replaced by optimized-ci.yml)
- `intelligent-issue-automation.yml` - Issue automation
- `quality-dashboard.yml` - Quality dashboard
- `branch-protection-setup.yml` - Branch protection
- `enterprise-monitoring.yml` - Enterprise monitoring

## Re-enabling Workflows

To re-enable a workflow:
1. Copy it from this `disabled/` directory back to `.github/workflows/`
2. Update any outdated syntax or dependencies
3. Ensure it doesn't conflict with core workflows
4. Test thoroughly before committing

## Workflow Execution Strategy

The core workflows use intelligent triggers and conditional execution to avoid redundant runs:

- **optimized-ci.yml**: Main CI/CD pipeline with smart matrix and conditional jobs
- **security.yml**: Comprehensive security scanning on relevant changes
- **deployment.yml**: Multi-environment deployment with proper gating
- **release.yml**: Release automation with proper versioning
- **pr-checks.yml**: Lightweight PR validation (to be created)
- **docker-unified.yml**: Container builds with multi-arch support

Last updated: $(date -u '+%Y-%m-%d %H:%M:%S UTC')
