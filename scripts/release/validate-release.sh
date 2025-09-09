#!/bin/bash

# Enterprise Release Validation Script
# Comprehensive validation for releases before publishing

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
VALIDATION_LEVEL="full"  # basic, standard, full
FAIL_ON_WARNINGS=false
GENERATE_REPORT=true
REPORT_FORMAT="markdown"  # markdown, json, html

usage() {
    cat << EOF
🔍 Unjucks Release Validation Tool

Usage: $0 [OPTIONS]

Validate a release package before publishing to catch issues early.

OPTIONS:
    -l, --level LEVEL       Validation level: basic, standard, full (default: full)
    -w, --fail-on-warnings  Fail validation if warnings are found
    -r, --report           Generate validation report (default: true)
    -f, --format FORMAT    Report format: markdown, json, html (default: markdown)
    -h, --help             Show this help message

VALIDATION LEVELS:
    basic     - Essential checks (package.json, build, basic tests)
    standard  - Standard checks + security scan + performance
    full      - All checks + compliance + documentation + advanced security

EXAMPLES:
    $0                           # Full validation with markdown report
    $0 -l standard              # Standard validation
    $0 --fail-on-warnings       # Fail on any warnings
    $0 -f json -r               # Generate JSON report

EOF
}

log() {
    echo -e "${GREEN}[$(date +'%H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%H:%M:%S')] ERROR: $1${NC}"
}

info() {
    echo -e "${BLUE}[$(date +'%H:%M:%S')] INFO: $1${NC}"
}

# Validation results tracking
VALIDATION_ERRORS=0
VALIDATION_WARNINGS=0
VALIDATION_RESULTS=()

add_result() {
    local level=$1
    local category=$2
    local message=$3
    local details=${4:-""}
    
    VALIDATION_RESULTS+=("$level|$category|$message|$details")
    
    case $level in
        ERROR)
            ((VALIDATION_ERRORS++))
            error "$category: $message"
            ;;
        WARNING)
            ((VALIDATION_WARNINGS++))
            warn "$category: $message"
            ;;
        INFO)
            info "$category: $message"
            ;;
    esac
}

validate_environment() {
    log "🔍 Validating environment..."
    
    # Check Node.js version
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        NODE_MAJOR=$(echo $NODE_VERSION | cut -d. -f1 | sed 's/v//')
        if (( NODE_MAJOR >= 18 )); then
            add_result "INFO" "Environment" "Node.js version: $NODE_VERSION ✅"
        else
            add_result "ERROR" "Environment" "Node.js version too old: $NODE_VERSION (requires >=18)"
        fi
    else
        add_result "ERROR" "Environment" "Node.js not found"
    fi
    
    # Check npm version
    if command -v npm &> /dev/null; then
        NPM_VERSION=$(npm --version)
        add_result "INFO" "Environment" "npm version: $NPM_VERSION ✅"
    else
        add_result "ERROR" "Environment" "npm not found"
    fi
    
    # Check git status
    if git rev-parse --git-dir > /dev/null 2>&1; then
        if git diff --quiet && git diff --cached --quiet; then
            add_result "INFO" "Environment" "Git working directory clean ✅"
        else
            add_result "WARNING" "Environment" "Uncommitted changes detected"
        fi
        
        # Check if on main/master branch for stable releases
        CURRENT_BRANCH=$(git branch --show-current)
        if [[ $CURRENT_BRANCH == "main" || $CURRENT_BRANCH == "master" ]]; then
            add_result "INFO" "Environment" "On main branch: $CURRENT_BRANCH ✅"
        else
            add_result "WARNING" "Environment" "Not on main branch: $CURRENT_BRANCH"
        fi
    else
        add_result "ERROR" "Environment" "Not in a git repository"
    fi
}

validate_package_json() {
    log "📦 Validating package.json..."
    
    if [[ ! -f package.json ]]; then
        add_result "ERROR" "Package" "package.json not found"
        return 1
    fi
    
    # Parse package.json
    local name=$(node -p "require('./package.json').name" 2>/dev/null || echo "")
    local version=$(node -p "require('./package.json').version" 2>/dev/null || echo "")
    local description=$(node -p "require('./package.json').description" 2>/dev/null || echo "")
    local main=$(node -p "require('./package.json').main" 2>/dev/null || echo "")
    local license=$(node -p "require('./package.json').license" 2>/dev/null || echo "")
    local repository=$(node -p "JSON.stringify(require('./package.json').repository)" 2>/dev/null || echo "{}")
    
    # Validate required fields
    [[ -n "$name" ]] && add_result "INFO" "Package" "Name: $name ✅" || add_result "ERROR" "Package" "Missing name field"
    [[ -n "$version" ]] && add_result "INFO" "Package" "Version: $version ✅" || add_result "ERROR" "Package" "Missing version field"
    [[ -n "$description" ]] && add_result "INFO" "Package" "Description: $description ✅" || add_result "WARNING" "Package" "Missing description field"
    [[ -n "$license" ]] && add_result "INFO" "Package" "License: $license ✅" || add_result "WARNING" "Package" "Missing license field"
    
    # Validate version format
    if [[ $version =~ ^[0-9]+\.[0-9]+\.[0-9]+ ]]; then
        add_result "INFO" "Package" "Version format valid ✅"
    else
        add_result "ERROR" "Package" "Invalid version format: $version"
    fi
    
    # Check if main entry point exists
    if [[ -n "$main" && -f "$main" ]]; then
        add_result "INFO" "Package" "Main entry point exists: $main ✅"
    elif [[ -n "$main" ]]; then
        add_result "ERROR" "Package" "Main entry point not found: $main"
    fi
    
    # Validate bin entries if present
    if node -p "require('./package.json').bin" 2>/dev/null | grep -q '{'; then
        local bin_files=$(node -p "Object.values(require('./package.json').bin).join(' ')" 2>/dev/null || echo "")
        for bin_file in $bin_files; do
            if [[ -f "$bin_file" ]]; then
                add_result "INFO" "Package" "Binary exists: $bin_file ✅"
                if [[ -x "$bin_file" ]]; then
                    add_result "INFO" "Package" "Binary is executable: $bin_file ✅"
                else
                    add_result "WARNING" "Package" "Binary not executable: $bin_file"
                fi
            else
                add_result "ERROR" "Package" "Binary not found: $bin_file"
            fi
        done
    fi
    
    # Check files field
    if node -p "require('./package.json').files" 2>/dev/null | grep -q '\['; then
        add_result "INFO" "Package" "Files field defined ✅"
    else
        add_result "WARNING" "Package" "No files field - entire directory will be published"
    fi
}

validate_dependencies() {
    log "🔗 Validating dependencies..."
    
    # Check if package-lock.json exists
    if [[ -f package-lock.json ]]; then
        add_result "INFO" "Dependencies" "package-lock.json exists ✅"
    else
        add_result "WARNING" "Dependencies" "package-lock.json missing - consider running 'npm install'"
    fi
    
    # Check for node_modules
    if [[ -d node_modules ]]; then
        add_result "INFO" "Dependencies" "node_modules directory exists ✅"
    else
        add_result "WARNING" "Dependencies" "node_modules missing - run 'npm install'"
        return 0
    fi
    
    # Run npm audit
    if npm audit --audit-level moderate > /tmp/audit.json 2>/dev/null; then
        add_result "INFO" "Dependencies" "No high/critical vulnerabilities found ✅"
    else
        local vulnerabilities=$(npm audit --json 2>/dev/null | jq -r '.metadata.vulnerabilities.total // 0' 2>/dev/null || echo "unknown")
        add_result "WARNING" "Dependencies" "Security vulnerabilities found: $vulnerabilities"
    fi
    
    # Check for outdated packages
    if npm outdated --json > /tmp/outdated.json 2>/dev/null; then
        if [[ -s /tmp/outdated.json ]]; then
            local outdated_count=$(jq -r 'length' /tmp/outdated.json 2>/dev/null || echo "0")
            if (( outdated_count > 0 )); then
                add_result "INFO" "Dependencies" "Outdated packages: $outdated_count (consider updating)"
            fi
        else
            add_result "INFO" "Dependencies" "All packages up to date ✅"
        fi
    fi
}

validate_build() {
    log "🔨 Validating build process..."
    
    # Check if build script exists
    if npm run build --silent 2>/dev/null; then
        add_result "INFO" "Build" "Build script found ✅"
        
        # Run build
        if npm run build > /tmp/build.log 2>&1; then
            add_result "INFO" "Build" "Build completed successfully ✅"
        else
            add_result "ERROR" "Build" "Build failed - check logs"
        fi
    else
        add_result "INFO" "Build" "No build script found (may not be needed)"
    fi
    
    # Test package creation
    if npm pack --dry-run > /tmp/pack.log 2>&1; then
        local package_size=$(npm pack --dry-run 2>/dev/null | tail -1 | awk '{print $NF}' | sed 's/[^0-9.]//g')
        add_result "INFO" "Build" "Package can be created ✅ (size: ${package_size:-unknown})"
    else
        add_result "ERROR" "Build" "Failed to create package"
    fi
}

validate_tests() {
    log "🧪 Validating tests..."
    
    # Check if test script exists
    if npm run test --silent 2>/dev/null; then
        add_result "INFO" "Tests" "Test script found ✅"
        
        # Run tests
        if timeout 300 npm test > /tmp/test.log 2>&1; then
            add_result "INFO" "Tests" "Tests passed ✅"
        else
            add_result "ERROR" "Tests" "Tests failed - check logs"
        fi
    else
        add_result "WARNING" "Tests" "No test script found"
    fi
    
    # Check for common test files
    local test_files=$(find . -name "*.test.js" -o -name "*.spec.js" -o -name "test*.js" | grep -v node_modules | wc -l)
    if (( test_files > 0 )); then
        add_result "INFO" "Tests" "Test files found: $test_files ✅"
    else
        add_result "WARNING" "Tests" "No test files found"
    fi
    
    # Check test coverage if available
    if [[ -d coverage ]]; then
        add_result "INFO" "Tests" "Coverage reports found ✅"
    fi
}

validate_cli() {
    log "⚡ Validating CLI functionality..."
    
    # Check binary files
    if [[ -f bin/unjucks.cjs ]]; then
        add_result "INFO" "CLI" "CLI binary found: bin/unjucks.cjs ✅"
        
        # Test CLI execution
        if chmod +x bin/unjucks.cjs && ./bin/unjucks.cjs --version > /tmp/cli-version.log 2>&1; then
            local cli_version=$(cat /tmp/cli-version.log)
            add_result "INFO" "CLI" "CLI version check passed: $cli_version ✅"
        else
            add_result "ERROR" "CLI" "CLI version check failed"
        fi
        
        # Test help command
        if ./bin/unjucks.cjs --help > /tmp/cli-help.log 2>&1; then
            add_result "INFO" "CLI" "CLI help command works ✅"
        else
            add_result "WARNING" "CLI" "CLI help command failed"
        fi
        
        # Test basic functionality
        if ./bin/unjucks.cjs list > /tmp/cli-list.log 2>&1; then
            add_result "INFO" "CLI" "CLI list command works ✅"
        else
            add_result "WARNING" "CLI" "CLI list command failed (may be expected if no templates)"
        fi
    else
        add_result "WARNING" "CLI" "CLI binary not found: bin/unjucks.cjs"
    fi
}

validate_security() {
    log "🛡️ Validating security..."
    
    if [[ $VALIDATION_LEVEL == "basic" ]]; then
        return 0
    fi
    
    # Check for sensitive files
    local sensitive_files=(".env" ".env.local" ".env.production" "*.pem" "*.key" "id_rsa" "id_dsa")
    for pattern in "${sensitive_files[@]}"; do
        if ls $pattern &> /dev/null; then
            add_result "ERROR" "Security" "Sensitive file found: $pattern"
        fi
    done
    
    # Check for hardcoded secrets (basic patterns)
    if grep -r "password\s*=" --include="*.js" --include="*.json" . | grep -v node_modules | grep -q .; then
        add_result "WARNING" "Security" "Potential hardcoded credentials found"
    fi
    
    if grep -r "api[_-]key\s*=" --include="*.js" --include="*.json" . | grep -v node_modules | grep -q .; then
        add_result "WARNING" "Security" "Potential API keys found"
    fi
    
    # Check for eval usage
    if grep -r "eval(" --include="*.js" . | grep -v node_modules | grep -q .; then
        add_result "WARNING" "Security" "eval() usage detected - potential security risk"
    fi
    
    # Check file permissions
    local world_writable=$(find . -type f -perm -002 | grep -v node_modules | head -5)
    if [[ -n "$world_writable" ]]; then
        add_result "WARNING" "Security" "World-writable files found"
    fi
}

validate_performance() {
    log "⚡ Validating performance..."
    
    if [[ $VALIDATION_LEVEL == "basic" ]]; then
        return 0
    fi
    
    # Check package size
    local package_size=$(npm pack --dry-run 2>/dev/null | tail -1 | awk '{print $2}' | sed 's/[^0-9]//g')
    if [[ -n "$package_size" ]]; then
        if (( package_size > 10000000 )); then  # 10MB
            add_result "WARNING" "Performance" "Package size large: ${package_size}B"
        elif (( package_size > 50000000 )); then  # 50MB
            add_result "ERROR" "Performance" "Package size too large: ${package_size}B"
        else
            add_result "INFO" "Performance" "Package size acceptable: ${package_size}B ✅"
        fi
    fi
    
    # Check for performance test script
    if npm run test:performance --silent 2>/dev/null; then
        if timeout 60 npm run test:performance > /tmp/perf.log 2>&1; then
            add_result "INFO" "Performance" "Performance tests passed ✅"
        else
            add_result "WARNING" "Performance" "Performance tests failed or timed out"
        fi
    fi
    
    # Check startup time
    if [[ -x bin/unjucks.cjs ]]; then
        local start_time=$(date +%s%N)
        if timeout 10 ./bin/unjucks.cjs --version > /dev/null 2>&1; then
            local end_time=$(date +%s%N)
            local duration_ms=$(( (end_time - start_time) / 1000000 ))
            if (( duration_ms > 5000 )); then
                add_result "WARNING" "Performance" "CLI startup slow: ${duration_ms}ms"
            else
                add_result "INFO" "Performance" "CLI startup time: ${duration_ms}ms ✅"
            fi
        fi
    fi
}

validate_documentation() {
    log "📖 Validating documentation..."
    
    if [[ $VALIDATION_LEVEL == "basic" ]]; then
        return 0
    fi
    
    # Check for README
    if [[ -f README.md ]]; then
        add_result "INFO" "Documentation" "README.md exists ✅"
        
        # Check README content
        local readme_size=$(wc -c < README.md)
        if (( readme_size > 500 )); then
            add_result "INFO" "Documentation" "README has substantial content ✅"
        else
            add_result "WARNING" "Documentation" "README is quite short ($readme_size chars)"
        fi
    else
        add_result "WARNING" "Documentation" "README.md not found"
    fi
    
    # Check for LICENSE
    if [[ -f LICENSE ]] || [[ -f LICENSE.md ]] || [[ -f LICENSE.txt ]]; then
        add_result "INFO" "Documentation" "LICENSE file exists ✅"
    else
        add_result "WARNING" "Documentation" "LICENSE file not found"
    fi
    
    # Check for CHANGELOG
    if [[ -f CHANGELOG.md ]] || [[ -f HISTORY.md ]]; then
        add_result "INFO" "Documentation" "Changelog exists ✅"
    else
        add_result "WARNING" "Documentation" "No changelog found"
    fi
    
    # Check for API documentation
    if [[ -d docs ]] || [[ -f API.md ]]; then
        add_result "INFO" "Documentation" "API documentation found ✅"
    else
        add_result "INFO" "Documentation" "No dedicated API docs (may not be needed)"
    fi
}

generate_report() {
    if [[ $GENERATE_REPORT != true ]]; then
        return 0
    fi
    
    log "📊 Generating validation report..."
    
    local timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)
    local report_file="validation-report-$(date +%Y%m%d-%H%M%S).$REPORT_FORMAT"
    
    case $REPORT_FORMAT in
        markdown)
            generate_markdown_report "$report_file" "$timestamp"
            ;;
        json)
            generate_json_report "$report_file" "$timestamp"
            ;;
        html)
            generate_html_report "$report_file" "$timestamp"
            ;;
    esac
    
    add_result "INFO" "Report" "Validation report generated: $report_file"
}

generate_markdown_report() {
    local report_file=$1
    local timestamp=$2
    
    cat > "$report_file" << EOF
# Release Validation Report

**Generated:** $timestamp  
**Validation Level:** $VALIDATION_LEVEL  
**Project:** $(node -p "require('./package.json').name" 2>/dev/null || echo "Unknown")  
**Version:** $(node -p "require('./package.json').version" 2>/dev/null || echo "Unknown")

## Summary

- ✅ **Passed:** $(( ${#VALIDATION_RESULTS[@]} - VALIDATION_WARNINGS - VALIDATION_ERRORS ))
- ⚠️  **Warnings:** $VALIDATION_WARNINGS
- ❌ **Errors:** $VALIDATION_ERRORS

## Results

| Category | Level | Message |
|----------|--------|---------|
EOF

    for result in "${VALIDATION_RESULTS[@]}"; do
        IFS='|' read -r level category message details <<< "$result"
        local icon=""
        case $level in
            ERROR) icon="❌" ;;
            WARNING) icon="⚠️" ;;
            INFO) icon="✅" ;;
        esac
        echo "| $category | $icon $level | $message |" >> "$report_file"
    done
    
    cat >> "$report_file" << EOF

## Recommendations

EOF
    
    if (( VALIDATION_ERRORS > 0 )); then
        echo "🚨 **Critical Issues Found** - Fix all errors before releasing" >> "$report_file"
        echo "" >> "$report_file"
    fi
    
    if (( VALIDATION_WARNINGS > 0 )); then
        echo "⚠️ **Warnings Found** - Consider addressing before release" >> "$report_file"
        echo "" >> "$report_file"
    fi
    
    if (( VALIDATION_ERRORS == 0 && VALIDATION_WARNINGS == 0 )); then
        echo "🎉 **All checks passed!** - Ready for release" >> "$report_file"
    fi
}

generate_json_report() {
    local report_file=$1
    local timestamp=$2
    
    local json_results="[]"
    for result in "${VALIDATION_RESULTS[@]}"; do
        IFS='|' read -r level category message details <<< "$result"
        json_results=$(echo "$json_results" | jq --arg level "$level" --arg category "$category" --arg message "$message" --arg details "$details" '. += [{"level": $level, "category": $category, "message": $message, "details": $details}]')
    done
    
    jq -n \
        --arg timestamp "$timestamp" \
        --arg level "$VALIDATION_LEVEL" \
        --arg project "$(node -p "require('./package.json').name" 2>/dev/null || echo "Unknown")" \
        --arg version "$(node -p "require('./package.json').version" 2>/dev/null || echo "Unknown")" \
        --argjson errors "$VALIDATION_ERRORS" \
        --argjson warnings "$VALIDATION_WARNINGS" \
        --argjson results "$json_results" \
        '{
            "timestamp": $timestamp,
            "validation_level": $level,
            "project": $project,
            "version": $version,
            "summary": {
                "errors": $errors,
                "warnings": $warnings,
                "total_checks": ($results | length)
            },
            "results": $results
        }' > "$report_file"
}

main() {
    echo "🚀 Unjucks Release Validation"
    echo "Validation Level: $VALIDATION_LEVEL"
    echo "Report Format: $REPORT_FORMAT"
    echo ""
    
    # Core validations (always run)
    validate_environment
    validate_package_json
    validate_dependencies
    validate_build
    validate_tests
    validate_cli
    
    # Additional validations based on level
    if [[ $VALIDATION_LEVEL != "basic" ]]; then
        validate_security
        validate_performance
    fi
    
    if [[ $VALIDATION_LEVEL == "full" ]]; then
        validate_documentation
    fi
    
    # Generate report
    generate_report
    
    # Final summary
    echo ""
    echo "📊 Validation Summary:"
    echo "  Total Checks: ${#VALIDATION_RESULTS[@]}"
    echo "  Errors: $VALIDATION_ERRORS"
    echo "  Warnings: $VALIDATION_WARNINGS"
    echo "  Passed: $(( ${#VALIDATION_RESULTS[@]} - VALIDATION_WARNINGS - VALIDATION_ERRORS ))"
    
    # Exit with appropriate code
    if (( VALIDATION_ERRORS > 0 )); then
        error "Validation failed with $VALIDATION_ERRORS errors"
        exit 1
    elif (( VALIDATION_WARNINGS > 0 )) && [[ $FAIL_ON_WARNINGS == true ]]; then
        warn "Validation failed with $VALIDATION_WARNINGS warnings (fail-on-warnings enabled)"
        exit 1
    else
        log "✅ Validation completed successfully!"
        exit 0
    fi
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -l|--level)
            VALIDATION_LEVEL="$2"
            shift 2
            ;;
        -w|--fail-on-warnings)
            FAIL_ON_WARNINGS=true
            shift
            ;;
        -r|--report)
            GENERATE_REPORT=true
            shift
            ;;
        -f|--format)
            REPORT_FORMAT="$2"
            shift 2
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            error "Unknown option: $1"
            usage
            exit 1
            ;;
    esac
done

# Validate arguments
if [[ ! $VALIDATION_LEVEL =~ ^(basic|standard|full)$ ]]; then
    error "Invalid validation level: $VALIDATION_LEVEL"
    usage
    exit 1
fi

if [[ ! $REPORT_FORMAT =~ ^(markdown|json|html)$ ]]; then
    error "Invalid report format: $REPORT_FORMAT"
    usage
    exit 1
fi

# Check dependencies
if ! command -v node &> /dev/null; then
    error "Node.js is required but not installed"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    error "npm is required but not installed"
    exit 1
fi

# Run main validation
main "$@"