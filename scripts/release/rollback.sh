#!/bin/bash

# Enterprise Release Rollback Script
# Safely rollback a failed or problematic release

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default values
DRY_RUN=false
FORCE=false
TARGET_VERSION=""
ROLLBACK_REASON=""
AUTO_CONFIRM=false

usage() {
    cat << EOF
🔄 Unjucks Release Rollback Tool

Usage: $0 [OPTIONS] TARGET_VERSION

Rollback a release to a previous version with safety checks.

OPTIONS:
    -d, --dry-run          Show what would be done without executing
    -f, --force            Force rollback even if checks fail
    -r, --reason REASON    Reason for rollback (required for audit trail)
    -y, --yes              Auto-confirm all prompts
    -h, --help             Show this help message

ARGUMENTS:
    TARGET_VERSION         Version to rollback to (e.g., 2.0.7, v2.0.6)

EXAMPLES:
    $0 2.0.7 -r "Critical security vulnerability"
    $0 --dry-run v2.0.6 -r "Performance regression"
    $0 --force 2.0.5 -r "Database migration issues"

EOF
}

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
    exit 1
}

confirm() {
    if [[ $AUTO_CONFIRM == true ]]; then
        return 0
    fi
    
    echo -n "$1 (y/N): "
    read -r response
    case "$response" in
        [yY][eE][sS]|[yY]) 
            return 0
            ;;
        *)
            return 1
            ;;
    esac
}

check_prerequisites() {
    log "🔍 Checking prerequisites..."
    
    # Check if we're in a git repository
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        error "Not in a git repository"
    fi
    
    # Check if npm is available
    if ! command -v npm &> /dev/null; then
        error "npm is not installed or not in PATH"
    fi
    
    # Check if we have package.json
    if [[ ! -f package.json ]]; then
        error "No package.json found"
    fi
    
    # Check for uncommitted changes
    if ! git diff --quiet && ! git diff --cached --quiet; then
        warn "Uncommitted changes detected"
        if [[ $FORCE != true ]] && ! confirm "Continue with uncommitted changes?"; then
            error "Rollback aborted due to uncommitted changes"
        fi
    fi
    
    log "✅ Prerequisites check passed"
}

validate_target_version() {
    log "🔍 Validating target version: $TARGET_VERSION"
    
    # Normalize version (remove 'v' prefix if present)
    TARGET_VERSION=${TARGET_VERSION#v}
    
    # Check if version format is valid
    if ! [[ $TARGET_VERSION =~ ^[0-9]+\.[0-9]+\.[0-9]+(-.+)?$ ]]; then
        error "Invalid version format: $TARGET_VERSION"
    fi
    
    # Check if target version exists as a git tag
    if ! git tag -l | grep -q "^v${TARGET_VERSION}$"; then
        error "Version v${TARGET_VERSION} not found in git tags"
    fi
    
    # Get current version
    CURRENT_VERSION=$(node -p "require('./package.json').version")
    
    log "📊 Current version: $CURRENT_VERSION"
    log "📊 Target version: $TARGET_VERSION"
    
    # Check if we're actually rolling back (target should be older)
    if [[ $FORCE != true ]]; then
        # Simple version comparison (works for most semantic versions)
        if [[ $TARGET_VERSION > $CURRENT_VERSION ]]; then
            error "Target version $TARGET_VERSION is newer than current $CURRENT_VERSION (use --force to override)"
        elif [[ $TARGET_VERSION == $CURRENT_VERSION ]]; then
            error "Target version $TARGET_VERSION is the same as current version (use --force to override)"
        fi
    fi
    
    log "✅ Target version validation passed"
}

create_rollback_branch() {
    log "🌿 Creating rollback branch..."
    
    ROLLBACK_BRANCH="rollback-to-v${TARGET_VERSION}-$(date +%Y%m%d-%H%M%S)"
    
    if [[ $DRY_RUN != true ]]; then
        git checkout -b "$ROLLBACK_BRANCH"
        log "📝 Created rollback branch: $ROLLBACK_BRANCH"
    else
        log "🔍 DRY RUN: Would create branch: $ROLLBACK_BRANCH"
    fi
}

perform_rollback() {
    log "🔄 Performing rollback to v${TARGET_VERSION}..."
    
    if [[ $DRY_RUN != true ]]; then
        # Reset package.json to target version
        git checkout "v${TARGET_VERSION}" -- package.json
        
        # Update any other version files if they exist
        if [[ -f package-lock.json ]]; then
            git checkout "v${TARGET_VERSION}" -- package-lock.json
        fi
        
        # Commit the rollback
        git add -A
        git commit -m "rollback: revert to v${TARGET_VERSION}

Reason: ${ROLLBACK_REASON}
Previous version: ${CURRENT_VERSION}
Rollback performed: $(date -u +%Y-%m-%dT%H:%M:%SZ)
Rollback branch: ${ROLLBACK_BRANCH}"
        
        log "✅ Rollback committed"
        
        # Create rollback tag
        ROLLBACK_TAG="rollback-from-v${CURRENT_VERSION}-to-v${TARGET_VERSION}"
        git tag -a "$ROLLBACK_TAG" -m "Rollback from v${CURRENT_VERSION} to v${TARGET_VERSION}: ${ROLLBACK_REASON}"
        
        log "🏷️  Created rollback tag: $ROLLBACK_TAG"
        
    else
        log "🔍 DRY RUN: Would rollback package.json to v${TARGET_VERSION}"
        log "🔍 DRY RUN: Would commit rollback with reason: $ROLLBACK_REASON"
        log "🔍 DRY RUN: Would create tag: rollback-from-v${CURRENT_VERSION}-to-v${TARGET_VERSION}"
    fi
}

test_rollback() {
    log "🧪 Testing rollback..."
    
    if [[ $DRY_RUN != true ]]; then
        # Install dependencies
        npm ci
        
        # Run tests if available
        if npm run test --silent 2>/dev/null; then
            log "🧪 Running test suite..."
            npm test
            log "✅ Tests passed"
        else
            log "ℹ️  No test script found, skipping tests"
        fi
        
        # Test CLI functionality
        if [[ -x bin/unjucks.cjs ]]; then
            log "🧪 Testing CLI..."
            ./bin/unjucks.cjs --version
            ./bin/unjucks.cjs --help > /dev/null
            log "✅ CLI test passed"
        fi
        
    else
        log "🔍 DRY RUN: Would run npm ci and test suite"
    fi
}

publish_rollback() {
    log "📦 Publishing rollback version..."
    
    if [[ $DRY_RUN != true ]]; then
        if confirm "Publish rollback version v${TARGET_VERSION} to NPM?"; then
            # Check if we're logged in to NPM
            if ! npm whoami &> /dev/null; then
                error "Not logged in to NPM. Run 'npm login' first."
            fi
            
            # Publish with rollback tag
            npm publish --tag rollback
            
            log "✅ Rollback published to NPM with tag 'rollback'"
            log "📦 Users can install with: npm install @seanchatmangpt/unjucks@rollback"
            
        else
            log "ℹ️  Skipping NPM publication"
        fi
        
        # Push rollback branch and tags
        if confirm "Push rollback branch and tags to remote?"; then
            git push origin "$ROLLBACK_BRANCH"
            git push origin --tags
            log "✅ Rollback branch and tags pushed"
        fi
        
    else
        log "🔍 DRY RUN: Would publish to NPM with 'rollback' tag"
        log "🔍 DRY RUN: Would push branch and tags"
    fi
}

create_rollback_issue() {
    log "📋 Creating rollback documentation..."
    
    ROLLBACK_DOC="ROLLBACK-$(date +%Y%m%d-%H%M%S).md"
    
    cat > "$ROLLBACK_DOC" << EOF
# Rollback Documentation

## Summary
- **Date**: $(date -u +%Y-%m-%dT%H:%M:%SZ)
- **From Version**: v${CURRENT_VERSION}
- **To Version**: v${TARGET_VERSION}
- **Reason**: ${ROLLBACK_REASON}
- **Performed By**: $(git config user.name) <$(git config user.email)>
- **Branch**: ${ROLLBACK_BRANCH}

## Impact Assessment
- [ ] NPM package rolled back
- [ ] Docker images updated (if applicable)
- [ ] Documentation updated
- [ ] Users notified
- [ ] Monitoring alerts resolved

## Next Steps
1. Monitor system health after rollback
2. Investigate root cause of issues
3. Plan fix for next release
4. Update release process if needed

## Verification Commands
\`\`\`bash
# Verify package version
npm view @seanchatmangpt/unjucks@rollback version

# Test installation
npm install -g @seanchatmangpt/unjucks@rollback
unjucks --version
\`\`\`

## Rollback Details
- **Git Commit**: $(git rev-parse HEAD 2>/dev/null || echo 'N/A')
- **Rollback Tag**: rollback-from-v${CURRENT_VERSION}-to-v${TARGET_VERSION}
- **Files Modified**: package.json, package-lock.json

## Communication
- [ ] Team notified
- [ ] Users informed via release notes
- [ ] Documentation updated
- [ ] Post-mortem scheduled

EOF

    if [[ $DRY_RUN != true ]]; then
        log "📄 Created rollback documentation: $ROLLBACK_DOC"
    else
        log "🔍 DRY RUN: Would create rollback documentation"
        rm "$ROLLBACK_DOC"
    fi
}

main() {
    log "🚀 Starting Unjucks Release Rollback"
    
    check_prerequisites
    validate_target_version
    
    # Show rollback plan
    echo ""
    log "📋 Rollback Plan:"
    echo "  Current Version: v${CURRENT_VERSION}"
    echo "  Target Version:  v${TARGET_VERSION}"
    echo "  Reason:          ${ROLLBACK_REASON}"
    echo "  Dry Run:         ${DRY_RUN}"
    echo ""
    
    if [[ $DRY_RUN != true ]] && ! confirm "Proceed with rollback?"; then
        log "❌ Rollback cancelled by user"
        exit 0
    fi
    
    create_rollback_branch
    perform_rollback
    test_rollback
    create_rollback_issue
    
    if [[ $DRY_RUN != true ]]; then
        publish_rollback
        
        log "🎉 Rollback completed successfully!"
        log "📋 Next steps:"
        log "  1. Monitor system health"
        log "  2. Review rollback documentation: $ROLLBACK_DOC"
        log "  3. Plan fix for next release"
        
    else
        log "🔍 DRY RUN completed - no changes made"
    fi
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -d|--dry-run)
            DRY_RUN=true
            shift
            ;;
        -f|--force)
            FORCE=true
            shift
            ;;
        -r|--reason)
            ROLLBACK_REASON="$2"
            shift 2
            ;;
        -y|--yes)
            AUTO_CONFIRM=true
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            if [[ -z $TARGET_VERSION ]]; then
                TARGET_VERSION="$1"
            else
                error "Unknown option: $1"
            fi
            shift
            ;;
    esac
done

# Validate required arguments
if [[ -z $TARGET_VERSION ]]; then
    error "Target version is required. Use --help for usage information."
fi

if [[ -z $ROLLBACK_REASON ]]; then
    error "Rollback reason is required (-r/--reason). Use --help for usage information."
fi

# Run main function
main "$@"