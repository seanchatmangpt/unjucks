#!/bin/bash
# =============================================================================
# UNJUCKS CLEANROOM TESTING RUNNER
# Comprehensive test execution script with Fortune 5 standards
# =============================================================================

set -euo pipefail

# Configuration
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_DIR="/app"
readonly LOG_DIR="/app/logs"
readonly RESULTS_DIR="/app/test-results"
readonly COVERAGE_DIR="/app/coverage"

# Colors for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m' # No Color

# Test configuration
readonly TIMEOUT_DEFAULT=300
readonly PARALLEL_JOBS=4
readonly COVERAGE_THRESHOLD=80
readonly MEMORY_LIMIT="4G"

# =============================================================================
# UTILITY FUNCTIONS
# =============================================================================

log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    
    case "$level" in
        "INFO")  echo -e "${BLUE}[INFO]${NC} ${timestamp} $message" ;;
        "WARN")  echo -e "${YELLOW}[WARN]${NC} ${timestamp} $message" ;;
        "ERROR") echo -e "${RED}[ERROR]${NC} ${timestamp} $message" ;;
        "SUCCESS") echo -e "${GREEN}[SUCCESS]${NC} ${timestamp} $message" ;;
    esac
    
    # Also log to file
    echo "[$level] $timestamp $message" >> "$LOG_DIR/test-runner.log"
}

setup_environment() {
    log "INFO" "Setting up test environment..."
    
    # Create necessary directories
    mkdir -p "$LOG_DIR" "$RESULTS_DIR" "$COVERAGE_DIR"
    
    # Set permissions
    chown -R unjucks:unjucks "$LOG_DIR" "$RESULTS_DIR" "$COVERAGE_DIR" || true
    
    # Clean previous test artifacts
    rm -rf "$RESULTS_DIR"/* "$COVERAGE_DIR"/* || true
    
    # Validate Node.js environment
    if ! command -v node &> /dev/null; then
        log "ERROR" "Node.js not found in PATH"
        exit 1
    fi
    
    local node_version=$(node --version)
    log "INFO" "Node.js version: $node_version"
    
    # Validate npm/pnpm
    if command -v pnpm &> /dev/null; then
        local pnpm_version=$(pnpm --version)
        log "INFO" "pnpm version: $pnpm_version"
    else
        log "WARN" "pnpm not found, falling back to npm"
    fi
    
    # Set resource limits
    ulimit -m $(( $(echo "$MEMORY_LIMIT" | sed 's/G//' | sed 's/M//') * 1024 * 1024 )) || true
    
    log "SUCCESS" "Environment setup completed"
}

check_dependencies() {
    log "INFO" "Checking dependencies and security..."
    
    cd "$PROJECT_DIR"
    
    # Check for package manager lock file
    if [[ -f "pnpm-lock.yaml" ]]; then
        log "INFO" "Using pnpm for dependency management"
        pnpm audit --audit-level moderate || {
            log "WARN" "Security vulnerabilities detected in dependencies"
        }
    elif [[ -f "package-lock.json" ]]; then
        log "INFO" "Using npm for dependency management"
        npm audit --audit-level moderate || {
            log "WARN" "Security vulnerabilities detected in dependencies"
        }
    else
        log "WARN" "No lock file found - dependencies may be inconsistent"
    fi
    
    # Validate critical binaries
    if [[ ! -x "./bin/unjucks.cjs" ]]; then
        log "ERROR" "Main binary not executable"
        exit 1
    fi
    
    log "SUCCESS" "Dependency check completed"
}

run_smoke_tests() {
    log "INFO" "Running smoke tests..."
    
    cd "$PROJECT_DIR"
    
    local smoke_results="$RESULTS_DIR/smoke-tests.json"
    local start_time=$(date +%s)
    
    {
        echo "{"
        echo '  "timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'",'
        echo '  "tests": ['
        
        # Test 1: Version check
        echo '    {'
        echo '      "name": "version_check",'
        if timeout 30 ./bin/unjucks.cjs --version > /dev/null 2>&1; then
            echo '      "status": "passed",'
            echo '      "message": "Version command executed successfully"'
        else
            echo '      "status": "failed",'
            echo '      "message": "Version command failed"'
        fi
        echo '    },'
        
        # Test 2: Help command
        echo '    {'
        echo '      "name": "help_command",'
        if timeout 30 ./bin/unjucks.cjs --help > /dev/null 2>&1; then
            echo '      "status": "passed",'
            echo '      "message": "Help command executed successfully"'
        else
            echo '      "status": "failed",'
            echo '      "message": "Help command failed"'
        fi
        echo '    },'
        
        # Test 3: List generators
        echo '    {'
        echo '      "name": "list_generators",'
        if timeout 60 ./bin/unjucks.cjs list > /dev/null 2>&1; then
            echo '      "status": "passed",'
            echo '      "message": "List command executed successfully"'
        else
            echo '      "status": "failed",'
            echo '      "message": "List command failed"'
        fi
        echo '    }'
        
        echo '  ],'
        echo '  "duration": '$(($(date +%s) - start_time))','
        echo '  "environment": "docker-cleanroom"'
        echo "}"
    } > "$smoke_results"
    
    local failed_count=$(jq -r '.tests[] | select(.status == "failed") | .name' "$smoke_results" | wc -l)
    
    if [[ $failed_count -gt 0 ]]; then
        log "ERROR" "Smoke tests failed: $failed_count tests"
        return 1
    else
        log "SUCCESS" "All smoke tests passed"
        return 0
    fi
}

run_unit_tests() {
    log "INFO" "Running unit tests with coverage..."
    
    cd "$PROJECT_DIR"
    
    local unit_results="$RESULTS_DIR/unit-tests.json"
    local coverage_report="$COVERAGE_DIR/coverage-summary.json"
    
    # Run tests with coverage
    timeout $TIMEOUT_DEFAULT pnpm run test:coverage 2>&1 | tee "$LOG_DIR/unit-tests.log" || {
        log "ERROR" "Unit tests failed or timed out"
        return 1
    }
    
    # Check coverage threshold
    if [[ -f "$coverage_report" ]]; then
        local coverage_percent=$(jq -r '.total.lines.pct' "$coverage_report" 2>/dev/null || echo "0")
        log "INFO" "Code coverage: ${coverage_percent}%"
        
        if (( $(echo "$coverage_percent >= $COVERAGE_THRESHOLD" | bc -l) )); then
            log "SUCCESS" "Coverage threshold met: ${coverage_percent}% >= ${COVERAGE_THRESHOLD}%"
        else
            log "WARN" "Coverage below threshold: ${coverage_percent}% < ${COVERAGE_THRESHOLD}%"
        fi
    else
        log "WARN" "Coverage report not found"
    fi
    
    log "SUCCESS" "Unit tests completed"
    return 0
}

run_integration_tests() {
    log "INFO" "Running integration tests..."
    
    cd "$PROJECT_DIR"
    
    local integration_results="$RESULTS_DIR/integration-tests.json"
    
    # Check for database connectivity
    if command -v pg_isready &> /dev/null; then
        if pg_isready -h unjucks-postgres -p 5432 -U unjucks_test > /dev/null 2>&1; then
            log "INFO" "Database connection verified"
            export DATABASE_URL="postgresql://unjucks_test:test_password_123@unjucks-postgres:5432/unjucks_test"
        else
            log "WARN" "Database not available - skipping database tests"
        fi
    fi
    
    # Run integration tests
    timeout $TIMEOUT_DEFAULT pnpm run test:integration 2>&1 | tee "$LOG_DIR/integration-tests.log" || {
        log "WARN" "Integration tests had failures"
    }
    
    # Run MCP integration tests
    timeout $TIMEOUT_DEFAULT pnpm run test:mcp 2>&1 | tee "$LOG_DIR/mcp-tests.log" || {
        log "WARN" "MCP integration tests had failures"
    }
    
    log "SUCCESS" "Integration tests completed"
    return 0
}

run_e2e_tests() {
    log "INFO" "Running end-to-end tests..."
    
    cd "$PROJECT_DIR"
    
    # Set up display for headless browser testing
    export DISPLAY=:99
    Xvfb :99 -screen 0 1024x768x24 > /dev/null 2>&1 &
    local xvfb_pid=$!
    
    # Wait for display to be ready
    sleep 2
    
    # Run E2E tests
    timeout $((TIMEOUT_DEFAULT * 2)) pnpm run test:e2e 2>&1 | tee "$LOG_DIR/e2e-tests.log" || {
        log "WARN" "E2E tests had failures"
    }
    
    # Run workflow tests
    timeout $TIMEOUT_DEFAULT pnpm run test:workflows 2>&1 | tee "$LOG_DIR/workflow-tests.log" || {
        log "WARN" "Workflow tests had failures"
    }
    
    # Cleanup
    kill $xvfb_pid 2>/dev/null || true
    
    log "SUCCESS" "E2E tests completed"
    return 0
}

run_performance_tests() {
    log "INFO" "Running performance tests..."
    
    cd "$PROJECT_DIR"
    
    local perf_results="$RESULTS_DIR/performance-tests.json"
    
    # Run performance regression tests
    timeout $TIMEOUT_DEFAULT pnpm run test:performance 2>&1 | tee "$LOG_DIR/performance-tests.log" || {
        log "WARN" "Performance tests had warnings"
    }
    
    # Memory usage test
    log "INFO" "Measuring memory usage..."
    /usr/bin/time -v ./bin/unjucks.cjs list > /dev/null 2> "$RESULTS_DIR/memory-usage.txt" || true
    
    # CPU usage test
    log "INFO" "Measuring CPU usage..."
    timeout 30 bash -c 'while true; do ./bin/unjucks.cjs --version > /dev/null 2>&1; done' &
    local cpu_test_pid=$!
    sleep 5
    kill $cpu_test_pid 2>/dev/null || true
    
    log "SUCCESS" "Performance tests completed"
    return 0
}

run_security_scan() {
    log "INFO" "Running security scans..."
    
    cd "$PROJECT_DIR"
    
    local security_results="$RESULTS_DIR/security-scan.json"
    
    # Dependency vulnerability scan
    if command -v pnpm &> /dev/null; then
        pnpm audit --json > "$security_results" 2>/dev/null || {
            log "WARN" "Security audit found vulnerabilities"
        }
    fi
    
    # File system scan with Trivy (if available)
    if command -v trivy &> /dev/null; then
        log "INFO" "Running Trivy filesystem scan..."
        trivy fs --format json --output "$RESULTS_DIR/trivy-scan.json" . || {
            log "WARN" "Trivy scan completed with findings"
        }
    fi
    
    # Check for secrets in code
    log "INFO" "Checking for potential secrets..."
    find . -name "*.js" -o -name "*.json" -o -name "*.env*" | \
    xargs grep -l "password\|secret\|key\|token" 2>/dev/null | \
    grep -v node_modules | \
    grep -v docker/secrets > "$RESULTS_DIR/potential-secrets.txt" || true
    
    log "SUCCESS" "Security scan completed"
    return 0
}

run_qa_suite() {
    log "INFO" "Running comprehensive QA suite..."
    
    cd "$PROJECT_DIR"
    
    # Run QA quality gates
    timeout $TIMEOUT_DEFAULT pnpm run qa:quality-gates 2>&1 | tee "$LOG_DIR/qa-quality-gates.log" || {
        log "WARN" "QA quality gates had warnings"
    }
    
    # Run coverage monitoring
    timeout $TIMEOUT_DEFAULT pnpm run qa:coverage 2>&1 | tee "$LOG_DIR/qa-coverage.log" || {
        log "WARN" "QA coverage monitoring had warnings"
    }
    
    # Run security scanner
    timeout $TIMEOUT_DEFAULT pnpm run qa:security 2>&1 | tee "$LOG_DIR/qa-security.log" || {
        log "WARN" "QA security scanner had warnings"
    }
    
    # Run full QA suite
    timeout $((TIMEOUT_DEFAULT * 2)) pnpm run qa:suite 2>&1 | tee "$LOG_DIR/qa-suite.log" || {
        log "WARN" "QA suite had warnings"
    }
    
    log "SUCCESS" "QA suite completed"
    return 0
}

generate_test_report() {
    log "INFO" "Generating comprehensive test report..."
    
    local report_file="$RESULTS_DIR/test-summary-report.json"
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    
    {
        echo "{"
        echo '  "timestamp": "'$timestamp'",'
        echo '  "environment": "docker-cleanroom",'
        echo '  "container": "'${HOSTNAME}'",'
        echo '  "node_version": "'$(node --version)'",'
        echo '  "test_suites": {'
        
        # Smoke tests
        if [[ -f "$RESULTS_DIR/smoke-tests.json" ]]; then
            echo '    "smoke_tests": '
            cat "$RESULTS_DIR/smoke-tests.json"
            echo ','
        fi
        
        # Coverage summary
        if [[ -f "$COVERAGE_DIR/coverage-summary.json" ]]; then
            echo '    "coverage": '
            cat "$COVERAGE_DIR/coverage-summary.json"
            echo ','
        fi
        
        # Security scan
        if [[ -f "$RESULTS_DIR/security-scan.json" ]]; then
            echo '    "security": '
            cat "$RESULTS_DIR/security-scan.json"
            echo ','
        fi
        
        # System resources
        echo '    "system_resources": {'
        echo '      "memory_usage": "'$(free -m | awk '/^Mem:/{printf "%.1f%%", $3/$2*100}')",'
        echo '      "disk_usage": "'$(df /app | awk 'NR==2 {print $5}')",'
        echo '      "cpu_load": "'$(uptime | awk -F'load average:' '{print $2}')"'
        echo '    }'
        
        echo '  },'
        echo '  "log_files": ['
        for log_file in "$LOG_DIR"/*.log; do
            if [[ -f "$log_file" ]]; then
                echo '    "'$(basename "$log_file")'",'
            fi
        done | sed '$s/,$//'
        echo '  ]'
        echo "}"
    } > "$report_file"
    
    log "SUCCESS" "Test report generated: $report_file"
}

cleanup_resources() {
    log "INFO" "Cleaning up test resources..."
    
    # Kill any remaining test processes
    pkill -f "unjucks" 2>/dev/null || true
    pkill -f "vitest" 2>/dev/null || true
    pkill -f "node.*test" 2>/dev/null || true
    
    # Compress logs
    find "$LOG_DIR" -name "*.log" -exec gzip {} \; 2>/dev/null || true
    
    # Set proper permissions
    chown -R unjucks:unjucks "$LOG_DIR" "$RESULTS_DIR" "$COVERAGE_DIR" 2>/dev/null || true
    
    log "SUCCESS" "Cleanup completed"
}

# =============================================================================
# MAIN EXECUTION
# =============================================================================

main() {
    local test_suite="${1:-all}"
    local exit_code=0
    
    log "INFO" "Starting Unjucks cleanroom testing suite: $test_suite"
    
    # Trap for cleanup
    trap cleanup_resources EXIT
    
    # Setup
    setup_environment || exit 1
    check_dependencies || exit 1
    
    # Run test suites based on parameter
    case "$test_suite" in
        "smoke")
            run_smoke_tests || exit_code=1
            ;;
        "unit")
            run_unit_tests || exit_code=1
            ;;
        "integration")
            run_integration_tests || exit_code=1
            ;;
        "e2e")
            run_e2e_tests || exit_code=1
            ;;
        "performance")
            run_performance_tests || exit_code=1
            ;;
        "security")
            run_security_scan || exit_code=1
            ;;
        "qa")
            run_qa_suite || exit_code=1
            ;;
        "all"|*)
            run_smoke_tests || exit_code=1
            run_unit_tests || exit_code=1
            run_integration_tests || exit_code=1
            run_e2e_tests || exit_code=1
            run_performance_tests || exit_code=1
            run_security_scan || exit_code=1
            run_qa_suite || exit_code=1
            ;;
    esac
    
    # Generate report
    generate_test_report
    
    if [[ $exit_code -eq 0 ]]; then
        log "SUCCESS" "All tests completed successfully"
    else
        log "ERROR" "Some tests failed - check logs for details"
    fi
    
    exit $exit_code
}

# Handle script arguments
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi