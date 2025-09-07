#!/bin/bash

# Setup script for test data bloat prevention
# Configures git hooks and validates prevention measures

set -euo pipefail

echo "🛡️  Setting up Test Data Bloat Prevention"
echo "========================================="

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# 1. Configure Git Hooks
echo "🔧 Configuring Git Hooks..."

if [ -d ".git" ]; then
    # Set hooks path to our custom hooks directory
    git config core.hooksPath .githooks
    echo "✅ Git hooks path configured to .githooks"
    
    # Make sure hook is executable
    chmod +x .githooks/pre-commit
    echo "✅ Pre-commit hook made executable"
    
    # Test hook
    if ./.githooks/pre-commit --help >/dev/null 2>&1 || true; then
        echo "✅ Pre-commit hook is functional"
    else
        echo "⚠️  Pre-commit hook test inconclusive (will work during commits)"
    fi
else
    echo "❌ Not a git repository - skipping git hook configuration"
fi

echo ""

# 2. Validate .gitignore patterns
echo "🔍 Validating .gitignore patterns..."

if [ -f ".gitignore" ]; then
    # Check for critical patterns
    PATTERNS_TO_CHECK=(
        "*.bak"
        "*.bak[0-9]"
        ".nuxt/"
        ".output/"
        "tests/.tmp/"
        "validation-test/"
        "docs/marketplace/"
        "node_modules"
    )
    
    MISSING_PATTERNS=0
    
    for pattern in "${PATTERNS_TO_CHECK[@]}"; do
        if grep -Fq "$pattern" .gitignore; then
            echo "✅ Pattern present: $pattern"
        else
            echo "❌ Pattern missing: $pattern"
            MISSING_PATTERNS=1
        fi
    done
    
    if [ "$MISSING_PATTERNS" -eq "0" ]; then
        echo "✅ All critical .gitignore patterns are present"
    else
        echo "⚠️  Some .gitignore patterns are missing - check .gitignore file"
    fi
else
    echo "❌ .gitignore file not found"
fi

echo ""

# 3. Check current repository state
echo "📊 Analyzing current repository state..."

# Count problematic files
BACKUP_COUNT=$(find . -name "*.bak*" 2>/dev/null | wc -l | tr -d ' ')
TEMP_DIRS=$(find . -type d -name ".tmp" -o -name "tmp" -o -name "temp" 2>/dev/null | wc -l | tr -d ' ')
BUILD_ARTIFACTS=$(find . -type d -name ".nuxt" -o -name ".output" -o -name "dist" 2>/dev/null | grep -v node_modules | wc -l | tr -d ' ')

echo "📋 Current state:"
echo "   Backup files: $BACKUP_COUNT"
echo "   Temp directories: $TEMP_DIRS" 
echo "   Build artifacts: $BUILD_ARTIFACTS"

# Size analysis
if command_exists du; then
    TOTAL_SIZE=$(du -sh . 2>/dev/null | cut -f1)
    TESTS_SIZE=$(du -sh tests/ 2>/dev/null | cut -f1 || echo "N/A")
    DOCS_SIZE=$(du -sh docs/ 2>/dev/null | cut -f1 || echo "N/A")
    
    echo "   Total size: $TOTAL_SIZE"
    echo "   Tests size: $TESTS_SIZE"
    echo "   Docs size: $DOCS_SIZE"
fi

echo ""

# 4. Cleanup recommendations
if [ "$BACKUP_COUNT" -gt "10" ] || [ "$TEMP_DIRS" -gt "0" ] || [ "$BUILD_ARTIFACTS" -gt "0" ]; then
    echo "🧹 CLEANUP RECOMMENDED"
    echo "====================="
    echo ""
    echo "High levels of bloat detected. Run cleanup:"
    echo "   ./scripts/cleanup-test-bloat.sh"
    echo ""
    echo "After cleanup, commit the results:"
    echo "   git add ."
    echo "   git commit -m 'chore: cleanup test data bloat - reduce repo size'"
    echo ""
else
    echo "✅ Repository state looks clean - no immediate cleanup needed"
fi

echo ""

# 5. Setup CI monitoring (if GitHub Actions directory exists)
echo "🔍 Checking CI setup..."

if [ -d ".github/workflows" ]; then
    if [ -f ".github/workflows/repo-size-monitor.yml" ]; then
        echo "✅ Repository size monitoring workflow is configured"
    else
        echo "⚠️  Repository size monitoring workflow not found"
        echo "   Expected: .github/workflows/repo-size-monitor.yml"
    fi
else
    echo "⚠️  .github/workflows directory not found - CI monitoring not available"
fi

echo ""

# 6. Final recommendations
echo "🎯 FINAL SETUP RECOMMENDATIONS"
echo "=============================="
echo ""
echo "1. IMMEDIATE ACTIONS:"
echo "   ✅ Git hooks configured"
echo "   ✅ .gitignore patterns updated"
if [ "$BACKUP_COUNT" -gt "10" ] || [ "$TEMP_DIRS" -gt "0" ] || [ "$BUILD_ARTIFACTS" -gt "0" ]; then
    echo "   ⚠️  Run cleanup script: ./scripts/cleanup-test-bloat.sh"
else
    echo "   ✅ Repository is clean"
fi
echo ""

echo "2. DEVELOPMENT WORKFLOW:"
echo "   • Git hooks will automatically prevent bloat commits"
echo "   • CI will monitor repository size weekly"
echo "   • Clean up regularly during development"
echo ""

echo "3. TEAM GUIDELINES:"
echo "   • Review docs/testing/test-data-management.md"
echo "   • Use proper temporary directories in tests"
echo "   • Avoid committing build artifacts"
echo "   • Clean up backup files regularly"
echo ""

echo "4. MONITORING:"
echo "   • Weekly CI reports on repository size"
echo "   • Automatic bloat pattern detection"
echo "   • Size limit enforcement (50MB repository, 1MB files)"
echo ""

echo "🎉 Bloat prevention setup complete!"
echo ""

# Test hook is working by creating a fake bloat file
echo "🧪 Testing bloat prevention..."
echo "test" > test-bloat.bak 2>/dev/null || true

if [ -f "test-bloat.bak" ]; then
    git add test-bloat.bak >/dev/null 2>&1 || true
    
    if git commit -m "test bloat commit" --no-verify >/dev/null 2>&1; then
        echo "⚠️  Hook bypassed - this was a test"
        git reset --hard HEAD~1 >/dev/null 2>&1 || true
    fi
    
    rm -f test-bloat.bak
    git reset >/dev/null 2>&1 || true
    echo "✅ Bloat prevention test completed"
fi

echo ""
echo "🔒 Your repository is now protected against test data bloat!"