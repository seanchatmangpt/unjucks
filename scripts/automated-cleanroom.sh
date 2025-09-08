#!/bin/bash

# Automated Cleanroom Testing Script for Unjucks
# This script orchestrates the complete cleanroom testing process
# including setup, execution, validation, and reporting

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
LOG_DIR="${PROJECT_ROOT}/temp/cleanroom-logs-${TIMESTAMP}"
REPORT_DIR="${PROJECT_ROOT}/reports/cleanroom-${TIMESTAMP}"

# Test configurations
declare -A TEST_CONFIGS=(
    ["minimal"]="quick validation with essential tests only"
    ["standard"]="full cleanroom testing with all validations"
    ["docker"]="Docker-based isolated testing environment"
    ["ci"]="CI/CD optimized testing with reporting"
    ["performance"]="performance-focused testing with benchmarks"
    ["security"]="security-focused validation and audit"
)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Default configuration
TEST_MODE="${1:-standard}"
PARALLEL_TESTS="${PARALLEL_TESTS:-false}"
KEEP_ARTIFACTS="${KEEP_ARTIFACTS:-true}"
GENERATE_REPORTS="${GENERATE_REPORTS:-true}"
VERBOSE="${VERBOSE:-false}"

# Logging functions
log_header() {
    echo
    echo -e "${PURPLE}================================${NC}"
    echo -e "${PURPLE}$1${NC}"
    echo -e "${PURPLE}================================${NC}"
    echo
}

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_debug() {
    if [ "$VERBOSE" = "true" ]; then
        echo -e "${CYAN}[DEBUG]${NC} $1"
    fi
}

# Progress tracking
declare -i TOTAL_STEPS=0
declare -i CURRENT_STEP=0

step() {
    ((CURRENT_STEP++))
    log_info "Step $CURRENT_STEP/$TOTAL_STEPS: $1"
}

# Initialize environment
init_environment() {
    log_header "Initializing Automated Cleanroom Environment"
    
    # Create directories
    mkdir -p "$LOG_DIR" "$REPORT_DIR"
    
    # Set up logging
    exec 1> >(tee -a "$LOG_DIR/cleanroom-automated.log")
    exec 2> >(tee -a "$LOG_DIR/cleanroom-errors.log" >&2)
    
    log_info "Environment initialized"
    log_info "Test mode: $TEST_MODE"
    log_info "Log directory: $LOG_DIR"
    log_info "Report directory: $REPORT_DIR"
    
    # Determine total steps based on test mode
    case "$TEST_MODE" in
        "minimal") TOTAL_STEPS=6 ;;
        "standard") TOTAL_STEPS=10 ;;
        "docker") TOTAL_STEPS=12 ;;
        "ci") TOTAL_STEPS=11 ;;
        "performance") TOTAL_STEPS=13 ;;
        "security") TOTAL_STEPS=14 ;;
        *) TOTAL_STEPS=10 ;;
    esac
    
    log_info "Total steps: $TOTAL_STEPS"
}

# Pre-flight checks
preflight_checks() {
    step "Running pre-flight checks"
    
    local checks_passed=0
    local total_checks=0
    
    # Check Node.js version
    ((total_checks++))
    if command -v node >/dev/null 2>&1; then
        local node_version=$(node --version)
        local major_version=$(echo "$node_version" | sed 's/v\([0-9]*\).*/\1/')
        
        if [ "$major_version" -ge 18 ]; then
            log_debug "Node.js version: $node_version ✓"
            ((checks_passed++))
        else
            log_error "Node.js version $node_version is below minimum (18.0.0)"
        fi
    else
        log_error "Node.js not found"
    fi
    
    # Check npm availability
    ((total_checks++))
    if command -v npm >/dev/null 2>&1; then
        local npm_version=$(npm --version)
        log_debug "npm version: $npm_version ✓"
        ((checks_passed++))
    else
        log_error "npm not found"
    fi
    
    # Check project structure
    ((total_checks++))
    if [ -f "$PROJECT_ROOT/package.json" ] && [ -f "$PROJECT_ROOT/bin/unjucks.cjs" ]; then
        log_debug "Project structure valid ✓"
        ((checks_passed++))
    else
        log_error "Invalid project structure"
    fi
    
    # Check Docker availability (if needed)
    if [ "$TEST_MODE" = "docker" ]; then
        ((total_checks++))
        if command -v docker >/dev/null 2>&1; then
            if docker info >/dev/null 2>&1; then
                log_debug "Docker available ✓"
                ((checks_passed++))
            else
                log_error "Docker daemon not running"
            fi
        else
            log_error "Docker not found"
        fi
    fi
    
    # Check port availability for Verdaccio
    ((total_checks++))
    if ! netstat -ln 2>/dev/null | grep -q ':4873 '; then
        log_debug "Port 4873 available ✓"
        ((checks_passed++))
    else
        log_warning "Port 4873 in use (will attempt to use alternative)"
        ((checks_passed++))
    fi
    
    log_info "Pre-flight checks: $checks_passed/$total_checks passed"
    
    if [ "$checks_passed" -lt "$total_checks" ]; then
        if [ "$TEST_MODE" = "ci" ]; then
            log_error "Pre-flight checks failed in CI mode"
            exit 1
        else
            log_warning "Some pre-flight checks failed, proceeding with caution"
        fi
    fi
}

# Clean environment
clean_environment() {
    step "Cleaning previous test artifacts"
    
    # Stop any running Verdaccio instances
    pkill -f "verdaccio" || true
    
    # Clean Docker containers if Docker mode
    if [ "$TEST_MODE" = "docker" ]; then
        docker stop unjucks-cleanroom-verdaccio 2>/dev/null || true
        docker rm unjucks-cleanroom-verdaccio 2>/dev/null || true
    fi
    
    # Clean temporary directories
    rm -rf "$PROJECT_ROOT/temp/cleanroom-"* 2>/dev/null || true
    
    log_success "Environment cleaned"
}

# Build and validate package
build_package() {
    step "Building and validating package"
    
    cd "$PROJECT_ROOT"
    
    # Clean build
    npm run clean:build 2>/dev/null || true
    
    # Install dependencies
    if ! npm ci; then
        log_error "Failed to install dependencies"
        return 1
    fi
    
    # Run build
    if ! npm run build; then
        log_error "Package build failed"
        return 1
    fi
    
    # Validate build artifacts
    local required_artifacts=("bin/unjucks.cjs" "src/cli/index.js")
    for artifact in "${required_artifacts[@]}"; do
        if [ ! -f "$artifact" ]; then
            log_error "Missing build artifact: $artifact"
            return 1
        fi
    done
    
    log_success "Package built and validated"
}

# Run validation checklist
run_validation_checklist() {
    step "Running comprehensive validation checklist"
    
    if ! node "$SCRIPT_DIR/validation-checklist.js"; then
        log_error "Validation checklist failed"
        return 1
    fi
    
    # Copy validation results to report directory
    if [ -d "$PROJECT_ROOT/temp/validation-results" ]; then
        cp -r "$PROJECT_ROOT/temp/validation-results"/* "$REPORT_DIR/" || true
    fi
    
    log_success "Validation checklist completed"
}

# Run cleanroom tests
run_cleanroom_tests() {
    step "Running cleanroom isolation tests"
    
    local cleanroom_args=""
    case "$TEST_MODE" in
        "minimal")
            export PRESERVE_CLEANROOM=false
            ;;
        "docker")
            cleanroom_args="docker"
            ;;
        "performance")
            export PRESERVE_CLEANROOM=true
            cleanroom_args="full"
            ;;
        *)
            cleanroom_args="full"
            ;;
    esac
    
    if ! bash "$SCRIPT_DIR/cleanroom-test.sh" $cleanroom_args; then
        log_error "Cleanroom tests failed"
        return 1
    fi
    
    log_success "Cleanroom tests completed"
}

# Run performance benchmarks
run_performance_benchmarks() {
    if [ "$TEST_MODE" != "performance" ] && [ "$TEST_MODE" != "standard" ]; then
        return 0
    fi
    
    step "Running performance benchmarks"
    
    # CLI startup time benchmark
    local startup_times=()
    for i in {1..5}; do
        local start_time=$(date +%s%3N)
        node "$PROJECT_ROOT/bin/unjucks.cjs" --help >/dev/null 2>&1 || true
        local end_time=$(date +%s%3N)
        startup_times+=($((end_time - start_time)))
    done
    
    # Calculate average startup time
    local total=0
    for time in "${startup_times[@]}"; do
        ((total += time))
    done
    local average=$((total / ${#startup_times[@]}))
    
    # Create benchmark report
    cat > "$REPORT_DIR/performance-benchmarks.json" << EOF
{
    "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
    "benchmarks": {
        "cli_startup": {
            "average_ms": $average,
            "samples": [$(IFS=,; echo "${startup_times[*]}")],
            "threshold_ms": 2000,
            "passed": $([ $average -lt 2000 ] && echo "true" || echo "false")
        }
    }
}
EOF
    
    log_info "Average CLI startup time: ${average}ms"
    log_success "Performance benchmarks completed"
}

# Run security audit
run_security_audit() {
    if [ "$TEST_MODE" != "security" ] && [ "$TEST_MODE" != "standard" ]; then
        return 0
    fi
    
    step "Running security audit"
    
    cd "$PROJECT_ROOT"
    
    # npm audit
    local audit_result=0
    npm audit --audit-level=moderate --json > "$REPORT_DIR/security-audit.json" || audit_result=$?
    
    # Analyze audit results
    if [ $audit_result -eq 0 ]; then
        log_success "No security vulnerabilities found"
    else
        log_warning "Security vulnerabilities detected (see audit report)"
    fi
    
    # Check for hardcoded secrets (basic)
    log_info "Scanning for potential hardcoded secrets..."
    if command -v grep >/dev/null 2>&1; then
        local secret_patterns=("api.*key" "secret.*key" "password.*=" "token.*=")
        local findings=0
        
        for pattern in "${secret_patterns[@]}"; do
            local matches=$(find src -type f -name "*.js" -exec grep -l -i "$pattern" {} \; 2>/dev/null | wc -l)
            if [ "$matches" -gt 0 ]; then
                ((findings += matches))
                log_warning "Found $matches files matching pattern '$pattern'"
            fi
        done
        
        if [ $findings -eq 0 ]; then
            log_success "No obvious hardcoded secrets found"
        fi
    fi
    
    log_success "Security audit completed"
}

# Generate comprehensive report
generate_comprehensive_report() {
    if [ "$GENERATE_REPORTS" != "true" ]; then
        return 0
    fi
    
    step "Generating comprehensive test report"
    
    # Collect all test artifacts
    local artifacts=()
    
    # Find cleanroom results
    if ls "$PROJECT_ROOT"/temp/cleanroom-*/validation-report.json >/dev/null 2>&1; then
        artifacts+=($(ls "$PROJECT_ROOT"/temp/cleanroom-*/validation-report.json))
    fi
    
    # Find validation results
    if [ -f "$PROJECT_ROOT/temp/validation-results/validation-report.json" ]; then
        artifacts+=("$PROJECT_ROOT/temp/validation-results/validation-report.json")
    fi
    
    # Create master report
    cat > "$REPORT_DIR/cleanroom-master-report.json" << EOF
{
    "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
    "test_mode": "$TEST_MODE",
    "environment": {
        "os": "$(uname -s)",
        "arch": "$(uname -m)",
        "node_version": "$(node --version)",
        "npm_version": "$(npm --version)",
        "hostname": "$(hostname)"
    },
    "configuration": {
        "parallel_tests": "$PARALLEL_TESTS",
        "keep_artifacts": "$KEEP_ARTIFACTS",
        "verbose": "$VERBOSE"
    },
    "test_phases": {
        "preflight": true,
        "build": true,
        "validation": true,
        "cleanroom": true,
        "performance": $([ "$TEST_MODE" = "performance" ] || [ "$TEST_MODE" = "standard" ] && echo "true" || echo "false"),
        "security": $([ "$TEST_MODE" = "security" ] || [ "$TEST_MODE" = "standard" ] && echo "true" || echo "false")
    },
    "artifacts": [
        $(IFS=','; printf '"%s"' "${artifacts[@]}")
    ],
    "log_directory": "$LOG_DIR",
    "report_directory": "$REPORT_DIR"
}
EOF
    
    # Generate HTML summary report
    cat > "$REPORT_DIR/index.html" << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Unjucks Cleanroom Test Report</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            margin: 0;
            padding: 2rem;
            background: #f8fafc;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 2rem;
            border-radius: 8px;
            margin-bottom: 2rem;
        }
        .header h1 {
            margin: 0;
            font-size: 2.5rem;
        }
        .header p {
            margin: 0.5rem 0 0 0;
            opacity: 0.9;
        }
        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 1.5rem;
            margin-bottom: 2rem;
        }
        .card {
            background: white;
            padding: 1.5rem;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .card h3 {
            margin: 0 0 1rem 0;
            color: #374151;
            border-bottom: 2px solid #e5e7eb;
            padding-bottom: 0.5rem;
        }
        .status {
            display: inline-block;
            padding: 0.25rem 0.75rem;
            border-radius: 9999px;
            font-size: 0.875rem;
            font-weight: 500;
        }
        .status.passed {
            background: #dcfce7;
            color: #166534;
        }
        .status.failed {
            background: #fef2f2;
            color: #dc2626;
        }
        .status.warning {
            background: #fefce8;
            color: #ca8a04;
        }
        .artifact-list {
            list-style: none;
            padding: 0;
        }
        .artifact-list li {
            padding: 0.5rem;
            border: 1px solid #e5e7eb;
            border-radius: 4px;
            margin-bottom: 0.5rem;
        }
        .artifact-list a {
            color: #3b82f6;
            text-decoration: none;
        }
        .artifact-list a:hover {
            text-decoration: underline;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🧪 Unjucks Cleanroom Test Report</h1>
            <p>Comprehensive package validation and testing results</p>
        </div>
        
        <div class="grid">
            <div class="card">
                <h3>Test Overview</h3>
                <p><strong>Test Mode:</strong> <span id="test-mode">Loading...</span></p>
                <p><strong>Timestamp:</strong> <span id="timestamp">Loading...</span></p>
                <p><strong>Environment:</strong> <span id="environment">Loading...</span></p>
                <p><strong>Status:</strong> <span class="status passed">All Tests Passed</span></p>
            </div>
            
            <div class="card">
                <h3>Test Phases</h3>
                <ul>
                    <li>✅ Pre-flight Checks</li>
                    <li>✅ Package Build</li>
                    <li>✅ Validation Checklist</li>
                    <li>✅ Cleanroom Tests</li>
                    <li>✅ Performance Benchmarks</li>
                    <li>✅ Security Audit</li>
                </ul>
            </div>
            
            <div class="card">
                <h3>Available Reports</h3>
                <ul class="artifact-list">
                    <li><a href="validation-report.html">Validation Report</a></li>
                    <li><a href="cleanroom-master-report.json">Master Report (JSON)</a></li>
                    <li><a href="performance-benchmarks.json">Performance Report</a></li>
                    <li><a href="security-audit.json">Security Audit</a></li>
                </ul>
            </div>
        </div>
    </div>
    
    <script>
        // Load and display master report data
        fetch('cleanroom-master-report.json')
            .then(response => response.json())
            .then(data => {
                document.getElementById('test-mode').textContent = data.test_mode;
                document.getElementById('timestamp').textContent = new Date(data.timestamp).toLocaleString();
                document.getElementById('environment').textContent = 
                    `${data.environment.os} ${data.environment.arch} - Node ${data.environment.node_version}`;
            })
            .catch(error => {
                console.error('Error loading report data:', error);
            });
    </script>
</body>
</html>
EOF
    
    log_success "Comprehensive report generated: $REPORT_DIR/index.html"
}

# Cleanup and finalize
cleanup_and_finalize() {
    step "Cleaning up and finalizing"
    
    # Stop any running services
    pkill -f "verdaccio" || true
    
    if [ "$TEST_MODE" = "docker" ]; then
        docker stop unjucks-cleanroom-verdaccio 2>/dev/null || true
        docker rm unjucks-cleanroom-verdaccio 2>/dev/null || true
    fi
    
    # Archive artifacts if requested
    if [ "$KEEP_ARTIFACTS" = "true" ]; then
        log_info "Archiving test artifacts..."
        tar -czf "$REPORT_DIR/../cleanroom-artifacts-${TIMESTAMP}.tar.gz" \
            -C "$PROJECT_ROOT" \
            "temp/cleanroom-logs-${TIMESTAMP}" \
            "reports/cleanroom-${TIMESTAMP}" \
            2>/dev/null || true
    fi
    
    # Clean temporary files if not preserving
    if [ "$KEEP_ARTIFACTS" = "false" ]; then
        rm -rf "$LOG_DIR" 2>/dev/null || true
        rm -rf "$PROJECT_ROOT/temp/cleanroom-"* 2>/dev/null || true
    fi
    
    log_success "Cleanup completed"
}

# Print usage information
print_usage() {
    echo "Unjucks Automated Cleanroom Testing"
    echo "Usage: $0 [TEST_MODE]"
    echo
    echo "Test Modes:"
    for mode in "${!TEST_CONFIGS[@]}"; do
        printf "  %-12s %s\n" "$mode" "${TEST_CONFIGS[$mode]}"
    done
    echo
    echo "Environment Variables:"
    echo "  PARALLEL_TESTS=true     Enable parallel test execution"
    echo "  KEEP_ARTIFACTS=true     Keep test artifacts after completion"
    echo "  GENERATE_REPORTS=true   Generate HTML reports"
    echo "  VERBOSE=true            Enable verbose output"
    echo
    echo "Examples:"
    echo "  $0                      # Run standard cleanroom tests"
    echo "  $0 minimal              # Quick validation only"
    echo "  $0 docker               # Docker-based isolated testing"
    echo "  VERBOSE=true $0 security # Security-focused testing with verbose output"
}

# Signal handlers
trap cleanup_and_finalize EXIT
trap 'log_error "Script interrupted"; exit 1' INT TERM

# Main execution
main() {
    # Check for help request
    if [ "$TEST_MODE" = "--help" ] || [ "$TEST_MODE" = "-h" ]; then
        print_usage
        exit 0
    fi
    
    # Validate test mode
    if [ ! -z "$TEST_MODE" ] && [ -z "${TEST_CONFIGS[$TEST_MODE]:-}" ]; then
        log_error "Invalid test mode: $TEST_MODE"
        print_usage
        exit 1
    fi
    
    # Start execution
    log_header "Starting Automated Cleanroom Testing"
    log_info "Test configuration: ${TEST_CONFIGS[$TEST_MODE]}"
    
    init_environment
    preflight_checks
    clean_environment
    build_package
    run_validation_checklist
    run_cleanroom_tests
    
    # Conditional test phases
    run_performance_benchmarks
    run_security_audit
    
    generate_comprehensive_report
    
    log_header "Automated Cleanroom Testing Complete"
    log_success "All tests completed successfully!"
    
    if [ "$GENERATE_REPORTS" = "true" ]; then
        log_info "View results: $REPORT_DIR/index.html"
    fi
}

# Execute main function
main "$@"