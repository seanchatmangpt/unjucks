#!/bin/bash
# Test Results Collector Script
# Aggregates test results from all testing services

set -euo pipefail

# Configuration
RESULTS_DIR="/test-results"
COVERAGE_DIR="/coverage"
OUTPUT_DIR="/test-results/aggregated"
TIMESTAMP=$(date -u +"%Y%m%d_%H%M%S")

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Initialize collection log
COLLECTION_LOG="$OUTPUT_DIR/collection-$TIMESTAMP.log"
echo "Test Results Collection Started at $(date)" > "$COLLECTION_LOG"

# Collection functions
collect_unit_test_results() {
    echo "Collecting unit test results..." | tee -a "$COLLECTION_LOG"
    
    if [[ -d "$RESULTS_DIR/unit" ]]; then
        cp -r "$RESULTS_DIR/unit" "$OUTPUT_DIR/unit-tests-$TIMESTAMP"
        echo "Unit test results collected" | tee -a "$COLLECTION_LOG"
    else
        echo "No unit test results found" | tee -a "$COLLECTION_LOG"
    fi
}

collect_integration_test_results() {
    echo "Collecting integration test results..." | tee -a "$COLLECTION_LOG"
    
    if [[ -d "$RESULTS_DIR/integration" ]]; then
        cp -r "$RESULTS_DIR/integration" "$OUTPUT_DIR/integration-tests-$TIMESTAMP"
        echo "Integration test results collected" | tee -a "$COLLECTION_LOG"
    else
        echo "No integration test results found" | tee -a "$COLLECTION_LOG"
    fi
}

collect_e2e_test_results() {
    echo "Collecting E2E test results..." | tee -a "$COLLECTION_LOG"
    
    if [[ -d "$RESULTS_DIR/e2e" ]]; then
        cp -r "$RESULTS_DIR/e2e" "$OUTPUT_DIR/e2e-tests-$TIMESTAMP"
        echo "E2E test results collected" | tee -a "$COLLECTION_LOG"
    else
        echo "No E2E test results found" | tee -a "$COLLECTION_LOG"
    fi
}

collect_performance_test_results() {
    echo "Collecting performance test results..." | tee -a "$COLLECTION_LOG"
    
    if [[ -d "$RESULTS_DIR/performance" ]]; then
        cp -r "$RESULTS_DIR/performance" "$OUTPUT_DIR/performance-tests-$TIMESTAMP"
        echo "Performance test results collected" | tee -a "$COLLECTION_LOG"
    else
        echo "No performance test results found" | tee -a "$COLLECTION_LOG"
    fi
}

collect_security_test_results() {
    echo "Collecting security test results..." | tee -a "$COLLECTION_LOG"
    
    if [[ -d "$RESULTS_DIR/security" ]]; then
        cp -r "$RESULTS_DIR/security" "$OUTPUT_DIR/security-tests-$TIMESTAMP"
        echo "Security test results collected" | tee -a "$COLLECTION_LOG"
    else
        echo "No security test results found" | tee -a "$COLLECTION_LOG"
    fi
}

collect_coverage_reports() {
    echo "Collecting coverage reports..." | tee -a "$COLLECTION_LOG"
    
    if [[ -d "$COVERAGE_DIR" ]]; then
        cp -r "$COVERAGE_DIR" "$OUTPUT_DIR/coverage-$TIMESTAMP"
        echo "Coverage reports collected" | tee -a "$COLLECTION_LOG"
    else
        echo "No coverage reports found" | tee -a "$COLLECTION_LOG"
    fi
}

# Generate summary report
generate_summary_report() {
    echo "Generating summary report..." | tee -a "$COLLECTION_LOG"
    
    local summary_file="$OUTPUT_DIR/test-summary-$TIMESTAMP.json"
    local html_report="$OUTPUT_DIR/test-report-$TIMESTAMP.html"
    
    # Count test files and results
    local unit_tests=$(find "$OUTPUT_DIR" -name "*unit*" -type f | wc -l)
    local integration_tests=$(find "$OUTPUT_DIR" -name "*integration*" -type f | wc -l)
    local e2e_tests=$(find "$OUTPUT_DIR" -name "*e2e*" -type f | wc -l)
    local performance_tests=$(find "$OUTPUT_DIR" -name "*performance*" -type f | wc -l)
    local security_tests=$(find "$OUTPUT_DIR" -name "*security*" -type f | wc -l)
    
    # Extract test statistics (basic parsing)
    local total_tests=0
    local passed_tests=0
    local failed_tests=0
    local skipped_tests=0
    
    # Parse JSON test results if available
    for result_file in $(find "$OUTPUT_DIR" -name "*.json" | head -10); do
        if [[ -f "$result_file" ]] && jq empty "$result_file" 2>/dev/null; then
            local file_total=$(jq -r '.stats.total // 0' "$result_file" 2>/dev/null || echo 0)
            local file_passed=$(jq -r '.stats.passed // 0' "$result_file" 2>/dev/null || echo 0)
            local file_failed=$(jq -r '.stats.failed // 0' "$result_file" 2>/dev/null || echo 0)
            local file_skipped=$(jq -r '.stats.skipped // 0' "$result_file" 2>/dev/null || echo 0)
            
            total_tests=$((total_tests + file_total))
            passed_tests=$((passed_tests + file_passed))
            failed_tests=$((failed_tests + file_failed))
            skipped_tests=$((skipped_tests + file_skipped))
        fi
    done
    
    # Calculate success rate
    local success_rate=0
    if [[ $total_tests -gt 0 ]]; then
        success_rate=$(echo "scale=2; $passed_tests * 100 / $total_tests" | bc -l 2>/dev/null || echo "0")
    fi
    
    # Generate JSON summary
    cat > "$summary_file" <<EOF
{
  "collection_timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "collection_id": "$TIMESTAMP",
  "test_files": {
    "unit_tests": $unit_tests,
    "integration_tests": $integration_tests,
    "e2e_tests": $e2e_tests,
    "performance_tests": $performance_tests,
    "security_tests": $security_tests
  },
  "test_statistics": {
    "total": $total_tests,
    "passed": $passed_tests,
    "failed": $failed_tests,
    "skipped": $skipped_tests,
    "success_rate": "$success_rate%"
  },
  "coverage": {
    "reports_available": $([ -d "$OUTPUT_DIR/coverage-$TIMESTAMP" ] && echo "true" || echo "false"),
    "report_path": "coverage-$TIMESTAMP"
  },
  "collection_status": "completed",
  "output_directory": "$OUTPUT_DIR"
}
EOF

    # Generate HTML report
    cat > "$html_report" <<EOF
<!DOCTYPE html>
<html>
<head>
    <title>Test Results Summary - $TIMESTAMP</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f4f4f4; padding: 20px; border-radius: 5px; }
        .summary { margin: 20px 0; }
        .success { color: #28a745; }
        .failure { color: #dc3545; }
        .warning { color: #ffc107; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Test Results Summary</h1>
        <p><strong>Collection Time:</strong> $(date)</p>
        <p><strong>Collection ID:</strong> $TIMESTAMP</p>
    </div>
    
    <div class="summary">
        <h2>Test Statistics</h2>
        <table>
            <tr><th>Metric</th><th>Value</th></tr>
            <tr><td>Total Tests</td><td>$total_tests</td></tr>
            <tr><td class="success">Passed</td><td>$passed_tests</td></tr>
            <tr><td class="failure">Failed</td><td>$failed_tests</td></tr>
            <tr><td class="warning">Skipped</td><td>$skipped_tests</td></tr>
            <tr><td><strong>Success Rate</strong></td><td><strong>$success_rate%</strong></td></tr>
        </table>
    </div>
    
    <div class="summary">
        <h2>Test File Counts</h2>
        <table>
            <tr><th>Test Type</th><th>Files Collected</th></tr>
            <tr><td>Unit Tests</td><td>$unit_tests</td></tr>
            <tr><td>Integration Tests</td><td>$integration_tests</td></tr>
            <tr><td>E2E Tests</td><td>$e2e_tests</td></tr>
            <tr><td>Performance Tests</td><td>$performance_tests</td></tr>
            <tr><td>Security Tests</td><td>$security_tests</td></tr>
        </table>
    </div>
</body>
</html>
EOF

    echo "Summary report generated: $summary_file" | tee -a "$COLLECTION_LOG"
    echo "HTML report generated: $html_report" | tee -a "$COLLECTION_LOG"
}

# Main collection process
main() {
    echo "Starting test results collection..." | tee -a "$COLLECTION_LOG"
    
    # Wait for test services to complete
    echo "Waiting for test services to complete..." | tee -a "$COLLECTION_LOG"
    sleep 30
    
    # Collect all test results
    collect_unit_test_results
    collect_integration_test_results
    collect_e2e_test_results
    collect_performance_test_results
    collect_security_test_results
    collect_coverage_reports
    
    # Generate summary
    generate_summary_report
    
    # Create final archive
    local archive_file="$OUTPUT_DIR/test-results-$TIMESTAMP.tar.gz"
    tar -czf "$archive_file" -C "$OUTPUT_DIR" . 2>/dev/null || true
    
    echo "Test results collection completed successfully" | tee -a "$COLLECTION_LOG"
    echo "Archive created: $archive_file" | tee -a "$COLLECTION_LOG"
    
    # Output final status
    echo "Collection Summary:"
    echo "- Output Directory: $OUTPUT_DIR"
    echo "- Archive File: $archive_file"
    echo "- Collection Log: $COLLECTION_LOG"
    
    # Keep container running for result inspection
    echo "Results collection complete. Container will remain running for inspection."
    tail -f "$COLLECTION_LOG"
}

# Run main function
main "$@"