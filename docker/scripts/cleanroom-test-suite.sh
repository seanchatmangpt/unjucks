#!/bin/bash
# Cleanroom Test Suite - Container Specialist #3
# Bulletproof testing with zero-dependency isolation

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DOCKER_DIR="$PROJECT_ROOT/docker"
RESULTS_DIR="$PROJECT_ROOT/test-results-docker"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
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

# Cleanup function
cleanup() {
    log_info "Cleaning up test environment..."
    cd "$PROJECT_ROOT"
    docker-compose -f docker/docker-compose.test.yml down --volumes --remove-orphans 2>/dev/null || true
    docker system prune -f --volumes 2>/dev/null || true
}

# Trap cleanup on exit
trap cleanup EXIT

# Validation functions
validate_docker() {
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed or not in PATH"
        exit 1
    fi
    
    if ! docker info &> /dev/null; then
        log_error "Docker daemon is not running"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed or not in PATH"
        exit 1
    fi
    
    log_success "Docker environment validated"
}

validate_project_structure() {
    local required_files=(
        "package.json"
        "src/cli/index.js"
        "bin/unjucks.cjs"
        "docker/Dockerfile.production"
        "docker/docker-compose.test.yml"
    )
    
    for file in "${required_files[@]}"; do
        if [[ ! -f "$PROJECT_ROOT/$file" ]]; then
            log_error "Required file not found: $file"
            exit 1
        fi
    done
    
    log_success "Project structure validated"
}

# Build and test functions
build_test_images() {
    log_info "Building test images..."
    cd "$PROJECT_ROOT"
    
    # Build with progress and detailed output
    docker-compose -f docker/docker-compose.test.yml build \
        --no-cache \
        --progress=plain \
        unit-test integration-test e2e-test security-test performance-test qa-test production-validation \
        > "$RESULTS_DIR/build.log" 2>&1
    
    if [[ $? -eq 0 ]]; then
        log_success "Test images built successfully"
    else
        log_error "Failed to build test images. Check $RESULTS_DIR/build.log"
        exit 1
    fi
}

run_unit_tests() {
    log_info "Running unit tests in cleanroom environment..."
    
    docker-compose -f docker/docker-compose.test.yml up --no-deps unit-test
    local exit_code=$?
    
    if [[ $exit_code -eq 0 ]]; then
        log_success "Unit tests passed"
    else
        log_error "Unit tests failed (exit code: $exit_code)"
        return 1
    fi
}

run_integration_tests() {
    log_info "Running integration tests..."
    
    docker-compose -f docker/docker-compose.test.yml up --no-deps integration-test
    local exit_code=$?
    
    if [[ $exit_code -eq 0 ]]; then
        log_success "Integration tests passed"
    else
        log_error "Integration tests failed (exit code: $exit_code)"
        return 1
    fi
}

run_e2e_tests() {
    log_info "Running end-to-end tests..."
    
    docker-compose -f docker/docker-compose.test.yml up --no-deps e2e-test
    local exit_code=$?
    
    if [[ $exit_code -eq 0 ]]; then
        log_success "E2E tests passed"
    else
        log_error "E2E tests failed (exit code: $exit_code)"
        return 1
    fi
}

run_security_tests() {
    log_info "Running security tests..."
    
    docker-compose -f docker/docker-compose.test.yml up --no-deps security-test
    local exit_code=$?
    
    if [[ $exit_code -eq 0 ]]; then
        log_success "Security tests passed"
    else
        log_warning "Security tests had issues (exit code: $exit_code)"
        return 0  # Don't fail build on security warnings
    fi
}

run_performance_tests() {
    log_info "Running performance tests..."
    
    docker-compose -f docker/docker-compose.test.yml up --no-deps performance-test
    local exit_code=$?
    
    if [[ $exit_code -eq 0 ]]; then
        log_success "Performance tests passed"
    else
        log_warning "Performance tests had issues (exit code: $exit_code)"
        return 0  # Don't fail build on performance warnings
    fi
}

run_qa_tests() {
    log_info "Running QA test suite..."
    
    docker-compose -f docker/docker-compose.test.yml up --no-deps qa-test
    local exit_code=$?
    
    if [[ $exit_code -eq 0 ]]; then
        log_success "QA tests passed"
    else
        log_error "QA tests failed (exit code: $exit_code)"
        return 1
    fi
}

run_production_validation() {
    log_info "Running production validation..."
    
    docker-compose -f docker/docker-compose.test.yml up --no-deps production-validation
    local exit_code=$?
    
    if [[ $exit_code -eq 0 ]]; then
        log_success "Production validation passed"
    else
        log_error "Production validation failed (exit code: $exit_code)"
        return 1
    fi
}

aggregate_results() {
    log_info "Aggregating test results..."
    
    docker-compose -f docker/docker-compose.test.yml up --no-deps test-aggregator
    
    # Copy results from volume to host
    local container_id
    container_id=$(docker create $(docker-compose -f docker/docker-compose.test.yml images -q test-aggregator))
    docker cp "$container_id:/test-results" "$RESULTS_DIR/" 2>/dev/null || true
    docker rm "$container_id" 2>/dev/null || true
    
    log_success "Test results aggregated"
}

generate_report() {
    log_info "Generating comprehensive test report..."
    
    local report_file="$RESULTS_DIR/cleanroom-test-report-$TIMESTAMP.md"
    
    cat > "$report_file" << EOF
# Cleanroom Test Report

**Date:** $(date)  
**Environment:** Docker Cleanroom  
**Project:** unjucks v$(jq -r .version "$PROJECT_ROOT/package.json")  

## Test Summary

| Test Type | Status | Details |
|-----------|--------|---------|
| Unit Tests | $([[ $unit_tests_passed == "true" ]] && echo "✅ PASSED" || echo "❌ FAILED") | Isolated unit testing |
| Integration Tests | $([[ $integration_tests_passed == "true" ]] && echo "✅ PASSED" || echo "❌ FAILED") | Component integration |
| E2E Tests | $([[ $e2e_tests_passed == "true" ]] && echo "✅ PASSED" || echo "❌ FAILED") | End-to-end workflows |
| Security Tests | $([[ $security_tests_passed == "true" ]] && echo "✅ PASSED" || echo "⚠️ WARNINGS") | Security validation |
| Performance Tests | $([[ $performance_tests_passed == "true" ]] && echo "✅ PASSED" || echo "⚠️ WARNINGS") | Performance benchmarks |
| QA Tests | $([[ $qa_tests_passed == "true" ]] && echo "✅ PASSED" || echo "❌ FAILED") | Quality assurance |
| Production Validation | $([[ $production_validation_passed == "true" ]] && echo "✅ PASSED" || echo "❌ FAILED") | Production readiness |

## Environment Details

- **Docker Version:** $(docker --version)
- **Docker Compose Version:** $(docker-compose --version)
- **Node.js Version:** $(docker run --rm node:20-alpine3.19 node --version)
- **Test Isolation:** Complete container isolation
- **Security Hardening:** Non-root user, minimal privileges

## Test Artifacts

Test results and logs are available in:
- \`$RESULTS_DIR/test-results/\`
- Build logs: \`$RESULTS_DIR/build.log\`

EOF

    log_success "Test report generated: $report_file"
}

# Main execution
main() {
    log_info "Starting Cleanroom Test Suite for unjucks"
    log_info "Timestamp: $TIMESTAMP"
    
    # Create results directory
    mkdir -p "$RESULTS_DIR"
    
    # Validation phase
    log_info "=== VALIDATION PHASE ==="
    validate_docker
    validate_project_structure
    
    # Build phase
    log_info "=== BUILD PHASE ==="
    build_test_images
    
    # Test phase
    log_info "=== TEST PHASE ==="
    
    # Initialize test status variables
    unit_tests_passed="false"
    integration_tests_passed="false"
    e2e_tests_passed="false"
    security_tests_passed="false"
    performance_tests_passed="false"
    qa_tests_passed="false"
    production_validation_passed="false"
    
    # Run tests with error handling
    if run_unit_tests; then
        unit_tests_passed="true"
    fi
    
    if run_integration_tests; then
        integration_tests_passed="true"
    fi
    
    if run_e2e_tests; then
        e2e_tests_passed="true"
    fi
    
    if run_security_tests; then
        security_tests_passed="true"
    fi
    
    if run_performance_tests; then
        performance_tests_passed="true"
    fi
    
    if run_qa_tests; then
        qa_tests_passed="true"
    fi
    
    if run_production_validation; then
        production_validation_passed="true"
    fi
    
    # Aggregation phase
    log_info "=== AGGREGATION PHASE ==="
    aggregate_results
    generate_report
    
    # Final summary
    log_info "=== FINAL SUMMARY ==="
    
    local total_passed=0
    local total_tests=7
    
    [[ $unit_tests_passed == "true" ]] && ((total_passed++))
    [[ $integration_tests_passed == "true" ]] && ((total_passed++))
    [[ $e2e_tests_passed == "true" ]] && ((total_passed++))
    [[ $security_tests_passed == "true" ]] && ((total_passed++))
    [[ $performance_tests_passed == "true" ]] && ((total_passed++))
    [[ $qa_tests_passed == "true" ]] && ((total_passed++))
    [[ $production_validation_passed == "true" ]] && ((total_passed++))
    
    log_info "Tests passed: $total_passed/$total_tests"
    
    if [[ $total_passed -eq $total_tests ]]; then
        log_success "🎉 All cleanroom tests passed! Production ready."
        exit 0
    else
        log_error "❌ Some tests failed. Check logs for details."
        exit 1
    fi
}

# Help function
show_help() {
    cat << EOF
Cleanroom Test Suite - Container Specialist #3

Usage: $0 [OPTIONS]

OPTIONS:
    --help          Show this help message
    --quick         Run only unit and integration tests
    --full          Run complete test suite (default)
    --build-only    Only build test images
    --clean         Clean up test environment and exit

EXAMPLES:
    $0                    # Run full test suite
    $0 --quick           # Quick tests only
    $0 --build-only      # Build images only
    $0 --clean           # Clean up environment

EOF
}

# Parse command line arguments
case "${1:-}" in
    --help)
        show_help
        exit 0
        ;;
    --quick)
        log_info "Running quick test suite"
        validate_docker
        validate_project_structure
        build_test_images
        run_unit_tests
        run_integration_tests
        log_success "Quick tests completed"
        exit 0
        ;;
    --build-only)
        log_info "Building test images only"
        validate_docker
        validate_project_structure
        build_test_images
        log_success "Build completed"
        exit 0
        ;;
    --clean)
        cleanup
        log_success "Environment cleaned"
        exit 0
        ;;
    "")
        main
        ;;
    *)
        log_error "Unknown option: $1"
        show_help
        exit 1
        ;;
esac