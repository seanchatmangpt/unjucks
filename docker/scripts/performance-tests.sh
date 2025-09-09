#!/bin/bash
# Performance Testing Script
# Comprehensive performance testing for Unjucks application

set -euo pipefail

# Configuration
TARGET_URL=${TARGET_URL:-"http://app-test:3000"}
CONCURRENT_USERS=${CONCURRENT_USERS:-50}
TEST_DURATION=${TEST_DURATION:-60}
RESULTS_DIR="/app/test-results/performance"
TIMESTAMP=$(date -u +"%Y%m%d_%H%M%S")

# Create results directory
mkdir -p "$RESULTS_DIR"

# Performance test log
PERF_LOG="$RESULTS_DIR/performance-$TIMESTAMP.log"
echo "Performance Testing Started at $(date)" > "$PERF_LOG"

# Test functions
load_test_autocannon() {
    echo "Running load test with autocannon..." | tee -a "$PERF_LOG"
    
    local output_file="$RESULTS_DIR/autocannon-$TIMESTAMP.json"
    
    autocannon \
        --connections "$CONCURRENT_USERS" \
        --duration "$TEST_DURATION" \
        --json \
        --output "$output_file" \
        "$TARGET_URL" 2>&1 | tee -a "$PERF_LOG"
    
    echo "Autocannon test completed: $output_file" | tee -a "$PERF_LOG"
}

load_test_loadtest() {
    echo "Running load test with loadtest..." | tee -a "$PERF_LOG"
    
    local output_file="$RESULTS_DIR/loadtest-$TIMESTAMP.json"
    
    loadtest \
        --rps 100 \
        --concurrent "$CONCURRENT_USERS" \
        --duration "${TEST_DURATION}s" \
        --json \
        --output "$output_file" \
        "$TARGET_URL" 2>&1 | tee -a "$PERF_LOG"
    
    echo "Loadtest completed: $output_file" | tee -a "$PERF_LOG"
}

memory_profiling() {
    echo "Running memory profiling..." | tee -a "$PERF_LOG"
    
    local output_dir="$RESULTS_DIR/memory-profile-$TIMESTAMP"
    mkdir -p "$output_dir"
    
    # Memory usage monitoring during load
    monitor_memory &
    local monitor_pid=$!
    
    # Run a lighter load test for profiling
    autocannon \
        --connections 10 \
        --duration 30 \
        "$TARGET_URL" > /dev/null 2>&1
    
    # Stop monitoring
    kill $monitor_pid 2>/dev/null || true
    
    echo "Memory profiling completed: $output_dir" | tee -a "$PERF_LOG"
}

monitor_memory() {
    local memory_log="$RESULTS_DIR/memory-usage-$TIMESTAMP.csv"
    echo "timestamp,memory_rss,memory_heap,memory_external" > "$memory_log"
    
    while true; do
        local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
        local memory_info=$(curl -s "$TARGET_URL/health" | jq -r '.memory // empty' 2>/dev/null || echo '{}')
        
        if [[ -n "$memory_info" && "$memory_info" != "{}" ]]; then
            local rss=$(echo "$memory_info" | jq -r '.rss // 0')
            local heap=$(echo "$memory_info" | jq -r '.heapUsed // 0')
            local external=$(echo "$memory_info" | jq -r '.external // 0')
            echo "$timestamp,$rss,$heap,$external" >> "$memory_log"
        fi
        
        sleep 1
    done
}

cpu_profiling() {
    echo "Running CPU profiling..." | tee -a "$PERF_LOG"
    
    local output_dir="$RESULTS_DIR/cpu-profile-$TIMESTAMP"
    mkdir -p "$output_dir"
    
    # CPU profiling using clinic
    clinic doctor --on-port="autocannon --connections 20 --duration 30 $TARGET_URL" \
        --dest "$output_dir" \
        node /app/bin/unjucks.cjs 2>&1 | tee -a "$PERF_LOG" || true
    
    echo "CPU profiling completed: $output_dir" | tee -a "$PERF_LOG"
}

endpoint_specific_tests() {
    echo "Running endpoint-specific performance tests..." | tee -a "$PERF_LOG"
    
    local endpoints=(
        "/health"
        "/api/templates"
        "/api/generators"
        "/api/generate"
    )
    
    for endpoint in "${endpoints[@]}"; do
        local endpoint_name=$(echo "$endpoint" | sed 's/[^a-zA-Z0-9]/_/g')
        local output_file="$RESULTS_DIR/endpoint-${endpoint_name}-$TIMESTAMP.json"
        
        echo "Testing endpoint: $endpoint" | tee -a "$PERF_LOG"
        
        autocannon \
            --connections 20 \
            --duration 30 \
            --json \
            --output "$output_file" \
            "${TARGET_URL}${endpoint}" 2>&1 | tee -a "$PERF_LOG" || true
    done
}

stress_test() {
    echo "Running stress test..." | tee -a "$PERF_LOG"
    
    local output_file="$RESULTS_DIR/stress-test-$TIMESTAMP.json"
    
    # Gradually increase load
    local max_connections=200
    local step=20
    local duration_per_step=15
    
    for ((connections=step; connections<=max_connections; connections+=step)); do
        echo "Stress testing with $connections connections..." | tee -a "$PERF_LOG"
        
        autocannon \
            --connections "$connections" \
            --duration "$duration_per_step" \
            --json \
            "$TARGET_URL" >> "$output_file" 2>&1 || true
        
        # Brief pause between steps
        sleep 5
    done
    
    echo "Stress test completed: $output_file" | tee -a "$PERF_LOG"
}

generate_performance_report() {
    echo "Generating performance report..." | tee -a "$PERF_LOG"
    
    local report_file="$RESULTS_DIR/performance-report-$TIMESTAMP.json"
    local html_report="$RESULTS_DIR/performance-report-$TIMESTAMP.html"
    
    # Aggregate results from all test files
    local total_requests=0
    local total_errors=0
    local avg_latency=0
    local max_latency=0
    local throughput=0
    
    # Parse autocannon results
    for result_file in "$RESULTS_DIR"/autocannon-*.json; do
        if [[ -f "$result_file" ]]; then
            local requests=$(jq -r '.requests.total // 0' "$result_file" 2>/dev/null || echo 0)
            local errors=$(jq -r '.errors // 0' "$result_file" 2>/dev/null || echo 0)
            local latency=$(jq -r '.latency.mean // 0' "$result_file" 2>/dev/null || echo 0)
            local max_lat=$(jq -r '.latency.max // 0' "$result_file" 2>/dev/null || echo 0)
            local tps=$(jq -r '.throughput.mean // 0' "$result_file" 2>/dev/null || echo 0)
            
            total_requests=$((total_requests + requests))
            total_errors=$((total_errors + errors))
            avg_latency=$(echo "scale=2; ($avg_latency + $latency) / 2" | bc -l 2>/dev/null || echo 0)
            
            if (( $(echo "$max_lat > $max_latency" | bc -l 2>/dev/null || echo 0) )); then
                max_latency=$max_lat
            fi
            
            throughput=$(echo "scale=2; ($throughput + $tps) / 2" | bc -l 2>/dev/null || echo 0)
        fi
    done
    
    # Calculate error rate
    local error_rate=0
    if [[ $total_requests -gt 0 ]]; then
        error_rate=$(echo "scale=4; $total_errors * 100 / $total_requests" | bc -l 2>/dev/null || echo 0)
    fi
    
    # Generate JSON report
    cat > "$report_file" <<EOF
{
  "test_timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "test_id": "$TIMESTAMP",
  "configuration": {
    "target_url": "$TARGET_URL",
    "concurrent_users": $CONCURRENT_USERS,
    "test_duration": $TEST_DURATION
  },
  "results": {
    "total_requests": $total_requests,
    "total_errors": $total_errors,
    "error_rate": "$error_rate%",
    "average_latency_ms": $avg_latency,
    "max_latency_ms": $max_latency,
    "throughput_rps": $throughput
  },
  "test_types": [
    "load_test",
    "stress_test",
    "memory_profiling",
    "cpu_profiling",
    "endpoint_testing"
  ],
  "status": "completed"
}
EOF

    # Generate HTML report
    cat > "$html_report" <<EOF
<!DOCTYPE html>
<html>
<head>
    <title>Performance Test Report - $TIMESTAMP</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f4f4f4; padding: 20px; border-radius: 5px; }
        .metric { margin: 10px 0; }
        .good { color: #28a745; }
        .warning { color: #ffc107; }
        .error { color: #dc3545; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Performance Test Report</h1>
        <p><strong>Test Time:</strong> $(date)</p>
        <p><strong>Test ID:</strong> $TIMESTAMP</p>
        <p><strong>Target:</strong> $TARGET_URL</p>
    </div>
    
    <h2>Performance Metrics</h2>
    <table>
        <tr><th>Metric</th><th>Value</th><th>Status</th></tr>
        <tr><td>Total Requests</td><td>$total_requests</td><td>-</td></tr>
        <tr><td>Total Errors</td><td>$total_errors</td><td class="$([ "$total_errors" -eq 0 ] && echo 'good' || echo 'error')">$([ "$total_errors" -eq 0 ] && echo 'Good' || echo 'Needs Attention')</td></tr>
        <tr><td>Error Rate</td><td>$error_rate%</td><td class="$(echo "$error_rate < 1" | bc -l >/dev/null 2>&1 && echo 'good' || echo 'warning')">$(echo "$error_rate < 1" | bc -l >/dev/null 2>&1 && echo 'Good' || echo 'High')</td></tr>
        <tr><td>Average Latency</td><td>${avg_latency}ms</td><td class="$(echo "$avg_latency < 100" | bc -l >/dev/null 2>&1 && echo 'good' || echo 'warning')">$(echo "$avg_latency < 100" | bc -l >/dev/null 2>&1 && echo 'Good' || echo 'High')</td></tr>
        <tr><td>Max Latency</td><td>${max_latency}ms</td><td>-</td></tr>
        <tr><td>Throughput</td><td>${throughput} req/s</td><td>-</td></tr>
    </table>
    
    <h2>Test Configuration</h2>
    <ul>
        <li>Concurrent Users: $CONCURRENT_USERS</li>
        <li>Test Duration: ${TEST_DURATION}s</li>
        <li>Target URL: $TARGET_URL</li>
    </ul>
</body>
</html>
EOF

    echo "Performance report generated: $report_file" | tee -a "$PERF_LOG"
    echo "HTML report generated: $html_report" | tee -a "$PERF_LOG"
}

# Wait for application to be ready
wait_for_app() {
    echo "Waiting for application to be ready..." | tee -a "$PERF_LOG"
    
    local max_attempts=30
    local attempt=1
    
    while [[ $attempt -le $max_attempts ]]; do
        if curl -sf "$TARGET_URL/health" >/dev/null 2>&1; then
            echo "Application is ready!" | tee -a "$PERF_LOG"
            return 0
        fi
        
        echo "Attempt $attempt/$max_attempts: Application not ready, waiting..." | tee -a "$PERF_LOG"
        sleep 10
        ((attempt++))
    done
    
    echo "Application failed to become ready after $max_attempts attempts" | tee -a "$PERF_LOG"
    exit 1
}

# Main performance testing function
main() {
    echo "Starting performance testing suite..." | tee -a "$PERF_LOG"
    
    # Wait for application
    wait_for_app
    
    # Run all performance tests
    load_test_autocannon
    load_test_loadtest
    endpoint_specific_tests
    memory_profiling
    stress_test
    
    # Generate final report
    generate_performance_report
    
    echo "Performance testing completed successfully" | tee -a "$PERF_LOG"
    echo "Results available in: $RESULTS_DIR"
}

# Run main function
main "$@"