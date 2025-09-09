#!/bin/bash

# GitHub Workflows Organization Script
# Creates disabled/ folder and moves redundant workflows while keeping core ones active

set -euo pipefail

WORKFLOWS_DIR=".github/workflows"
DISABLED_DIR="$WORKFLOWS_DIR/disabled"
BACKUP_DIR="workflows-backup-$(date +%Y%m%d_%H%M%S)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}📁 GitHub Workflows Organization Script${NC}"
echo -e "${BLUE}=====================================\n${NC}"

# Create directories
mkdir -p "$DISABLED_DIR"
mkdir -p "$BACKUP_DIR"

# Copy all workflows to backup first
echo -e "${YELLOW}📦 Creating backup...${NC}"
cp -r "$WORKFLOWS_DIR"/*.yml "$BACKUP_DIR/" 2>/dev/null || true
echo -e "${GREEN}✅ Backup created in $BACKUP_DIR${NC}\n"

# Define core workflows to keep active
CORE_WORKFLOWS=(
    "optimized-ci.yml"
    "security.yml" 
    "deployment.yml"
    "release.yml"
    "docker-unified.yml"
)

# Define workflows to create new (will be created separately)
NEW_WORKFLOWS=(
    "pr-checks.yml"
)

echo -e "${BLUE}📋 Core workflows that will remain active:${NC}"
for workflow in "${CORE_WORKFLOWS[@]}"; do
    echo -e "  ${GREEN}• $workflow${NC}"
done
echo

echo -e "${BLUE}📋 New workflows to be created:${NC}"
for workflow in "${NEW_WORKFLOWS[@]}"; do
    echo -e "  ${YELLOW}• $workflow${NC}"
done
echo

# Create consolidation mapping comments
cat > "$DISABLED_DIR/README.md" << 'EOF'
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
EOF

# Function to move workflow with explanation
move_workflow() {
    local workflow="$1"
    local reason="$2"
    
    if [[ -f "$WORKFLOWS_DIR/$workflow" ]]; then
        echo -e "${YELLOW}📦 Moving $workflow${NC}"
        echo -e "   Reason: $reason"
        mv "$WORKFLOWS_DIR/$workflow" "$DISABLED_DIR/"
        
        # Add explanation comment to the moved file
        cat > "$DISABLED_DIR/${workflow}.disabled-reason" << EOF
# $workflow - DISABLED

**Disabled on:** $(date -u '+%Y-%m-%d %H:%M:%S UTC')
**Reason:** $reason

**Consolidated into:** See README.md in this directory

To re-enable:
1. Move back to .github/workflows/
2. Remove this .disabled-reason file
3. Update any outdated syntax
4. Test thoroughly
EOF
    fi
}

echo -e "${BLUE}🚚 Moving redundant workflows to disabled/...${NC}\n"

# CI/CD Workflows (consolidated into optimized-ci.yml)
move_workflow "ci.yml" "Consolidated into optimized-ci.yml - basic CI functionality"
move_workflow "ci-main.yml" "Consolidated into optimized-ci.yml - main branch CI"
move_workflow "nodejs-ci.yml" "Consolidated into optimized-ci.yml - Node.js CI"
move_workflow "cross-platform-ci.yml" "Consolidated into optimized-ci.yml - cross-platform testing"
move_workflow "comprehensive-testing.yml" "Consolidated into optimized-ci.yml - comprehensive testing"
move_workflow "checks.yml" "Consolidated into optimized-ci.yml - general checks"
move_workflow "status-checks.yml" "Consolidated into optimized-ci.yml - status validation"
move_workflow "test-status-badges.yml" "Consolidated into optimized-ci.yml - badge generation"
move_workflow "performance.yml" "Consolidated into optimized-ci.yml - performance testing"
move_workflow "performance-benchmarks.yml" "Consolidated into optimized-ci.yml - benchmarks"
move_workflow "code-quality.yml" "Consolidated into optimized-ci.yml - code quality"

# Act-based workflows
move_workflow "act-ci.yml" "Consolidated into optimized-ci.yml - Act local CI testing"
move_workflow "act-build-validation.yml" "Consolidated into optimized-ci.yml - Act build validation"
move_workflow "act-core-cicd.yml" "Consolidated into optimized-ci.yml - Act core CI/CD"
move_workflow "act-core-cicd-simple.yml" "Consolidated into optimized-ci.yml - simplified Act CI/CD"

# Security workflows (consolidated into security.yml)
move_workflow "security-scanning.yml" "Consolidated into security.yml - security scanning"
move_workflow "act-security.yml" "Consolidated into security.yml - Act security testing"
move_workflow "act-enterprise-security.yml" "Consolidated into security.yml - enterprise security"
move_workflow "enterprise-security.yml" "Consolidated into security.yml - enterprise features"

# Deployment workflows (consolidated into deployment.yml)
move_workflow "deployment-production.yml" "Consolidated into deployment.yml - production deployment"
move_workflow "deployment-validation.yml" "Consolidated into deployment.yml - deployment validation"
move_workflow "environment-deployment.yml" "Consolidated into deployment.yml - environment deployment"
move_workflow "docker-deployment.yml" "Consolidated into deployment.yml - Docker deployment"

# Release workflows (consolidated into release.yml)
move_workflow "release-automation.yml" "Consolidated into release.yml - release automation"
move_workflow "enterprise-release.yml" "Consolidated into release.yml - enterprise release"
move_workflow "auto-build-publish.yml" "Consolidated into release.yml - auto build/publish"
move_workflow "npm-publish.yml" "Consolidated into release.yml - NPM publishing"

# Docker workflows (consolidated into docker-unified.yml)
move_workflow "docker-validation.yml" "Consolidated into docker-unified.yml - Docker validation"
move_workflow "act-performance.yml" "Consolidated into docker-unified.yml - performance testing"

# Special purpose workflows (disabled but available)
move_workflow "deploy-book.yml" "Special purpose - documentation deployment (disabled for cleanup)"
move_workflow "pages-config.yml" "Special purpose - GitHub Pages (disabled for cleanup)"
move_workflow "latex-ci.yml" "Special purpose - LaTeX processing (disabled for cleanup)"
move_workflow "latex-validation.yml" "Special purpose - LaTeX validation (disabled for cleanup)"
move_workflow "repo-size-monitor.yml" "Monitoring - repository size (disabled for cleanup)"
move_workflow "production-validation.yml" "Validation - production specific (consolidated into deployment.yml)"
move_workflow "autofix.yml" "Automation - auto-fixes (disabled for cleanup)"
move_workflow "ci-cd-validation.yml" "Validation - CI/CD pipeline (consolidated into optimized-ci.yml)"
move_workflow "validate-swarm-improvements.yml" "Validation - swarm specific (disabled for cleanup)"
move_workflow "pr-validation.yml" "Validation - PR specific (will be replaced by pr-checks.yml)"
move_workflow "unified-quality-gate.yml" "Quality - unified gate (replaced by optimized-ci.yml)"
move_workflow "workflow-optimizer.yml" "Meta - workflow optimization (disabled after optimization)"
move_workflow "core-cicd.yml" "Core - CI/CD (replaced by optimized-ci.yml)"
move_workflow "intelligent-issue-automation.yml" "Automation - issue management (disabled for cleanup)"
move_workflow "quality-dashboard.yml" "Quality - dashboard (disabled for cleanup)"
move_workflow "branch-protection-setup.yml" "Setup - branch protection (manual setup preferred)"
move_workflow "enterprise-monitoring.yml" "Monitoring - enterprise (disabled for cleanup)"

echo -e "\n${GREEN}✅ Workflow organization completed!${NC}\n"

# Summary
echo -e "${BLUE}📊 Summary:${NC}"
echo -e "   ${GREEN}• Core workflows active: ${#CORE_WORKFLOWS[@]}${NC}"
echo -e "   ${YELLOW}• Workflows moved to disabled/: $(find "$DISABLED_DIR" -name "*.yml" | wc -l)${NC}"
echo -e "   ${BLUE}• Backup created: $BACKUP_DIR${NC}"

echo -e "\n${BLUE}🔄 Next steps:${NC}"
echo -e "   1. Review core workflows for any missing functionality"
echo -e "   2. Create pr-checks.yml for lightweight PR validation"
echo -e "   3. Test the optimized workflow setup"
echo -e "   4. Update documentation if needed"

echo -e "\n${GREEN}🎉 GitHub Workflows successfully organized!${NC}"
echo -e "${BLUE}   • Redundant workflows moved to .github/workflows/disabled/"
echo -e "   • Core workflows remain active with consolidated functionality"
echo -e "   • Backup available in $BACKUP_DIR${NC}"

# Make the script report what's still active
echo -e "\n${BLUE}📋 Active workflows:${NC}"
for workflow in "$WORKFLOWS_DIR"/*.yml; do
    if [[ -f "$workflow" ]]; then
        basename_workflow=$(basename "$workflow")
        echo -e "   ${GREEN}• $basename_workflow${NC}"
    fi
done

echo -e "\n${YELLOW}⚠️  Remember to create pr-checks.yml for PR-specific validation!${NC}"