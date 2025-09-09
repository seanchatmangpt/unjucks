#!/bin/bash
set -e

# Performance CI/CD Pipeline Script for Fortune 5 Scale
# This script runs comprehensive performance tests and regression detection

echo "🚀 Starting Fortune 5 Scale Performance CI Pipeline"
echo "================================================="

# Configuration
REPORTS_DIR="reports/performance"
BASELINES_DIR="tests/performance/baselines"
CI_THRESHOLD_REGRESSION=10  # 10% regression tolerance in CI
LOAD_TEST_DURATION=300      # 5 minutes for CI load tests
PERFORMANCE_GATE_ENABLED=${PERFORMANCE_GATE_ENABLED:-true}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Create necessary directories
mkdir -p "$REPORTS_DIR" "$BASELINES_DIR"

# Check prerequisites
log_info "Checking prerequisites..."

# Check if k6 is available for load testing
if command -v k6 &> /dev/null; then
    log_success "k6 load testing tool found"
    K6_AVAILABLE=true
else
    log_warning "k6 not found. Load testing will be skipped."
    log_info "Install k6: https://k6.io/docs/getting-started/installation/"
    K6_AVAILABLE=false
fi

# Check if vitest is available
if npm list vitest &> /dev/null; then
    log_success "Vitest found"
else
    log_error "Vitest not found. Installing..."
    npm install --save-dev vitest
fi

# Check Node.js version
NODE_VERSION=$(node --version)
log_info "Node.js version: $NODE_VERSION"

# Environment information
log_info "Environment Information:"
echo "  - OS: $(uname -s)"
echo "  - Arch: $(uname -m)"
echo "  - CPU Cores: $(nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 'unknown')"
echo "  - Memory: $(free -h 2>/dev/null | grep Mem | awk '{print $2}' || system_profiler SPHardwareDataType | grep Memory | awk '{print $2, $3}' || echo 'unknown')"
echo "  - Date: $(date)"

# Step 1: Run Performance Benchmarks
log_info "Step 1: Running Performance Benchmarks"
echo "======================================="

BENCHMARK_START=$(date +%s)

# Run Vitest benchmarks
log_info "Running Vitest performance benchmarks..."
npx vitest run --config config/performance/vitest-performance.config.js --reporter=json --outputFile="$REPORTS_DIR/benchmark-results.json" tests/performance/*.bench.js

BENCHMARK_EXIT_CODE=$?
BENCHMARK_END=$(date +%s)
BENCHMARK_DURATION=$((BENCHMARK_END - BENCHMARK_START))

if [ $BENCHMARK_EXIT_CODE -eq 0 ]; then
    log_success "Performance benchmarks completed in ${BENCHMARK_DURATION}s"
else
    log_error "Performance benchmarks failed (exit code: $BENCHMARK_EXIT_CODE)"
    if [ "$PERFORMANCE_GATE_ENABLED" = "true" ]; then
        exit $BENCHMARK_EXIT_CODE
    fi
fi

# Step 2: Run Memory Usage Tests
log_info "Step 2: Running Memory Usage Tests"
echo "=================================="

MEMORY_START=$(date +%s)

# Run memory usage tests with detailed reporting
log_info "Running memory usage and leak detection tests..."
npx vitest run --config config/performance/vitest-performance.config.js --reporter=verbose tests/performance/memory-usage.test.js

MEMORY_EXIT_CODE=$?
MEMORY_END=$(date +%s)
MEMORY_DURATION=$((MEMORY_END - MEMORY_START))

if [ $MEMORY_EXIT_CODE -eq 0 ]; then
    log_success "Memory usage tests completed in ${MEMORY_DURATION}s"
else
    log_error "Memory usage tests failed (exit code: $MEMORY_EXIT_CODE)"
    if [ "$PERFORMANCE_GATE_ENABLED" = "true" ]; then
        exit $MEMORY_EXIT_CODE
    fi
fi

# Step 3: Run Load Tests (if k6 available)
if [ "$K6_AVAILABLE" = true ]; then
    log_info "Step 3: Running Load Tests"
    echo "=========================="
    
    LOAD_START=$(date +%s)
    
    # Check if service is running (for load testing)
    SERVICE_URL=${SERVICE_URL:-"http://localhost:3000"}
    if curl -s "$SERVICE_URL/health" > /dev/null 2>&1; then
        log_success "Service is running at $SERVICE_URL"
        
        # Run load tests with CI-friendly duration
        log_info "Running load tests for ${LOAD_TEST_DURATION} seconds..."
        k6 run \
            --duration="${LOAD_TEST_DURATION}s" \
            --vus=100 \
            --out json="$REPORTS_DIR/load-test-results.json" \
            tests/load/k6-load-test.js
        
        LOAD_EXIT_CODE=$?
        LOAD_END=$(date +%s)
        LOAD_DURATION=$((LOAD_END - LOAD_START))
        
        if [ $LOAD_EXIT_CODE -eq 0 ]; then
            log_success "Load tests completed in ${LOAD_DURATION}s"
        else
            log_error "Load tests failed (exit code: $LOAD_EXIT_CODE)"
            if [ "$PERFORMANCE_GATE_ENABLED" = "true" ]; then
                exit $LOAD_EXIT_CODE
            fi
        fi
    else
        log_warning "Service not available at $SERVICE_URL. Skipping load tests."
        log_info "To run load tests, start the service and set SERVICE_URL environment variable"
    fi
else
    log_warning "Step 3: Load Tests Skipped (k6 not available)"
fi

# Step 4: Run Regression Detection
log_info "Step 4: Running Regression Detection"
echo "==================================="

REGRESSION_START=$(date +%s)

# Run regression detection tests
log_info "Running performance regression detection..."
npx vitest run --config config/performance/vitest-performance.config.js --reporter=verbose tests/performance/regression-detection.test.js

REGRESSION_EXIT_CODE=$?
REGRESSION_END=$(date +%s)
REGRESSION_DURATION=$((REGRESSION_END - REGRESSION_START))

if [ $REGRESSION_EXIT_CODE -eq 0 ]; then
    log_success "Regression detection completed in ${REGRESSION_DURATION}s"
else
    log_error "Regression detection failed (exit code: $REGRESSION_EXIT_CODE)"
    if [ "$PERFORMANCE_GATE_ENABLED" = "true" ]; then
        exit $REGRESSION_EXIT_CODE
    fi
fi

# Step 5: Generate Performance Report
log_info "Step 5: Generating Performance Report"
echo "====================================="

REPORT_FILE="$REPORTS_DIR/ci-performance-report-$(date +%Y%m%d-%H%M%S).json"
SUMMARY_FILE="$REPORTS_DIR/performance-summary.txt"

# Aggregate all results
cat > "$REPORT_FILE" << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "ciPipeline": {
    "commit": "${GITHUB_SHA:-${GIT_COMMIT:-unknown}}",
    "branch": "${GITHUB_REF_NAME:-${GIT_BRANCH:-unknown}}",
    "buildNumber": "${GITHUB_RUN_NUMBER:-${BUILD_NUMBER:-unknown}}"
  },
  "environment": {
    "nodeVersion": "$NODE_VERSION",
    "platform": "$(uname -s)",
    "architecture": "$(uname -m)",
    "cpuCores": $(nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 'null'),
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  },
  "testResults": {
    "benchmarks": {
      "exitCode": $BENCHMARK_EXIT_CODE,
      "duration": $BENCHMARK_DURATION,
      "status": "$([ $BENCHMARK_EXIT_CODE -eq 0 ] && echo 'passed' || echo 'failed')"
    },
    "memoryTests": {
      "exitCode": $MEMORY_EXIT_CODE,
      "duration": $MEMORY_DURATION,
      "status": "$([ $MEMORY_EXIT_CODE -eq 0 ] && echo 'passed' || echo 'failed')"
    },
    "loadTests": {
      "exitCode": ${LOAD_EXIT_CODE:-null},
      "duration": ${LOAD_DURATION:-null},
      "status": "$(if [ -n "$LOAD_EXIT_CODE" ]; then [ $LOAD_EXIT_CODE -eq 0 ] && echo 'passed' || echo 'failed'; else echo 'skipped'; fi)"
    },
    "regressionDetection": {
      "exitCode": $REGRESSION_EXIT_CODE,
      "duration": $REGRESSION_DURATION,
      "status": "$([ $REGRESSION_EXIT_CODE -eq 0 ] && echo 'passed' || echo 'failed')"
    }
  },
  "performanceGate": {
    "enabled": $PERFORMANCE_GATE_ENABLED,
    "passed": $([ $BENCHMARK_EXIT_CODE -eq 0 ] && [ $MEMORY_EXIT_CODE -eq 0 ] && [ $REGRESSION_EXIT_CODE -eq 0 ] && echo 'true' || echo 'false')
  }
}
EOF

# Generate human-readable summary
cat > "$SUMMARY_FILE" << EOF
Performance CI Pipeline Summary
==============================
Date: $(date)
Commit: ${GITHUB_SHA:-${GIT_COMMIT:-unknown}}
Branch: ${GITHUB_REF_NAME:-${GIT_BRANCH:-unknown}}

Test Results:
- Benchmarks: $([ $BENCHMARK_EXIT_CODE -eq 0 ] && echo '✅ PASSED' || echo '❌ FAILED') (${BENCHMARK_DURATION}s)
- Memory Tests: $([ $MEMORY_EXIT_CODE -eq 0 ] && echo '✅ PASSED' || echo '❌ FAILED') (${MEMORY_DURATION}s)
- Load Tests: $(if [ -n "$LOAD_EXIT_CODE" ]; then [ $LOAD_EXIT_CODE -eq 0 ] && echo '✅ PASSED' || echo '❌ FAILED'; else echo '⏭️  SKIPPED'; fi) (${LOAD_DURATION:-N/A}s)
- Regression Detection: $([ $REGRESSION_EXIT_CODE -eq 0 ] && echo '✅ PASSED' || echo '❌ FAILED') (${REGRESSION_DURATION}s)

Performance Gate: $([ $BENCHMARK_EXIT_CODE -eq 0 ] && [ $MEMORY_EXIT_CODE -eq 0 ] && [ $REGRESSION_EXIT_CODE -eq 0 ] && echo '✅ PASSED' || echo '❌ FAILED')

Reports available in: $REPORTS_DIR/
EOF

log_success "Performance report generated: $REPORT_FILE"
log_success "Summary report generated: $SUMMARY_FILE"

# Display summary
echo ""
echo "Performance CI Pipeline Summary"
echo "==============================="
cat "$SUMMARY_FILE"

# Step 6: Performance Gate Decision
echo ""
log_info "Step 6: Performance Gate Decision"
echo "================================="

OVERALL_EXIT_CODE=0

if [ $BENCHMARK_EXIT_CODE -ne 0 ]; then
    log_error "Benchmark tests failed"
    OVERALL_EXIT_CODE=1
fi

if [ $MEMORY_EXIT_CODE -ne 0 ]; then
    log_error "Memory tests failed"
    OVERALL_EXIT_CODE=1
fi

if [ $REGRESSION_EXIT_CODE -ne 0 ]; then
    log_error "Regression detection failed"
    OVERALL_EXIT_CODE=1
fi

if [ -n "$LOAD_EXIT_CODE" ] && [ $LOAD_EXIT_CODE -ne 0 ]; then
    log_warning "Load tests failed (not blocking in CI)"
    # Load test failures are warnings in CI, not blockers
fi

# Final decision
if [ "$PERFORMANCE_GATE_ENABLED" = "true" ]; then
    if [ $OVERALL_EXIT_CODE -eq 0 ]; then
        log_success "🎉 Performance gate PASSED! All tests completed successfully."
        echo ""
        echo "✅ Your changes meet Fortune 5 scale performance requirements"
        echo "✅ No significant performance regressions detected"
        echo "✅ Memory usage is within acceptable limits"
    else
        log_error "💥 Performance gate FAILED! Some tests did not pass."
        echo ""
        echo "❌ Performance issues detected that need attention"
        echo "❌ Review the detailed reports in $REPORTS_DIR/"
        echo "❌ Fix performance regressions before merging"
        
        # Provide helpful troubleshooting information
        echo ""
        echo "Troubleshooting Tips:"
        echo "- Check regression detection reports for specific issues"
        echo "- Review memory usage patterns for potential leaks"
        echo "- Compare current metrics with baseline performance"
        echo "- Run tests locally with: npm run test:performance"
    fi
else
    log_warning "Performance gate is disabled. Results are informational only."
fi

# Archive results for CI systems
if [ -n "$CI" ]; then
    log_info "Archiving performance results for CI system..."
    tar -czf "performance-results-$(date +%Y%m%d-%H%M%S).tar.gz" "$REPORTS_DIR"
    log_success "Performance results archived"
fi

echo ""
echo "Performance CI Pipeline completed in $(($(date +%s) - BENCHMARK_START)) seconds"
echo "================================================="

exit $OVERALL_EXIT_CODE