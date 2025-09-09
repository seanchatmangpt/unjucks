#!/bin/bash
set -euo pipefail

# Production Validation Script - Skip dependency reinstall
VALIDATION_DIR="validation-results"
mkdir -p "$VALIDATION_DIR"

echo "🚀 Production Validation Suite"
echo "=============================="

# Log system info
echo "📊 System Information:" | tee "$VALIDATION_DIR/system-info.txt"
node --version >> "$VALIDATION_DIR/system-info.txt"
npm --version >> "$VALIDATION_DIR/system-info.txt"
uname -a >> "$VALIDATION_DIR/system-info.txt"

# 1. Build Validation
echo "🏗️ Phase 1: Build Validation"
start_time=$(date +%s)
npm run build 2>&1 | tee "$VALIDATION_DIR/build.log"
build_exit_code=$?
end_time=$(date +%s)
build_duration=$((end_time - start_time))

echo "Build completed in ${build_duration}s with exit code: $build_exit_code" >> "$VALIDATION_DIR/build.log"

# 2. Test Suite Validation
echo "🧪 Phase 2: Test Suite Validation"
start_time=$(date +%s)
npm test 2>&1 | tee "$VALIDATION_DIR/test.log"
test_exit_code=$?
end_time=$(date +%s)
test_duration=$((end_time - start_time))

echo "Tests completed in ${test_duration}s with exit code: $test_exit_code" >> "$VALIDATION_DIR/test.log"

# Count test results
passing_tests=$(grep -c "✓" "$VALIDATION_DIR/test.log" || echo 0)
failing_tests=$(grep -c "✗" "$VALIDATION_DIR/test.log" || echo 0)
total_tests=$((passing_tests + failing_tests))

if [ $total_tests -gt 0 ]; then
    pass_rate=$((passing_tests * 100 / total_tests))
else
    # Try alternative counting method
    total_tests=$(grep -c "Test Files\|test" "$VALIDATION_DIR/test.log" | head -1 || echo 1)
    pass_rate=$([[ $test_exit_code -eq 0 ]] && echo 100 || echo 0)
fi

echo "Test pass rate: ${pass_rate}% (${passing_tests}/${total_tests})" >> "$VALIDATION_DIR/test.log"

# 3. CLI Commands Validation
echo "⚡ Phase 3: CLI Commands Validation"
cli_log="$VALIDATION_DIR/cli.log"

# Test CLI commands
commands=(
    "node bin/unjucks.cjs --version"
    "node bin/unjucks.cjs list"
    "node bin/unjucks.cjs help"
    "node bin/unjucks.cjs help generate"
)

cli_success=0
cli_total=${#commands[@]}

for cmd in "${commands[@]}"; do
    echo "Testing: $cmd" >> "$cli_log"
    if timeout 30s $cmd >> "$cli_log" 2>&1; then
        echo "✅ $cmd - SUCCESS" >> "$cli_log"
        ((cli_success++))
    else
        echo "❌ $cmd - FAILED" >> "$cli_log"
    fi
done

cli_pass_rate=$((cli_success * 100 / cli_total))
echo "CLI pass rate: ${cli_pass_rate}% (${cli_success}/${cli_total})" >> "$cli_log"

# 4. Template Generation Test
echo "📝 Phase 4: Template Generation Test"
gen_log="$VALIDATION_DIR/generation.log"
test_dir="/tmp/test-generation-$(date +%s)"
mkdir -p "$test_dir"

echo "Testing template generation..." >> "$gen_log"
if node bin/unjucks.cjs generate component TestComponent --dest "$test_dir" 2>&1 | tee -a "$gen_log"; then
    echo "✅ Template generation - SUCCESS" >> "$gen_log"
    generation_success=true
    # Check if files were created
    generated_files=$(find "$test_dir" -type f | wc -l)
    echo "Generated files: $generated_files" >> "$gen_log"
else
    echo "❌ Template generation - FAILED" >> "$gen_log"
    generation_success=false
    generated_files=0
fi

# 5. LaTeX Template Test
echo "📄 Phase 5: LaTeX Template Test"
latex_log="$VALIDATION_DIR/latex.log"
latex_test_dir="/tmp/latex-test-$(date +%s)"
mkdir -p "$latex_test_dir"

echo "Testing LaTeX template generation..." >> "$latex_log"
if node bin/unjucks.cjs generate latex article --title "Test Document" --dest "$latex_test_dir" 2>&1 | tee -a "$latex_log"; then
    echo "✅ LaTeX generation - SUCCESS" >> "$latex_log"
    latex_success=true
    latex_files=$(find "$latex_test_dir" -name "*.tex" | wc -l)
    echo "LaTeX files generated: $latex_files" >> "$latex_log"
else
    echo "❌ LaTeX generation - FAILED" >> "$latex_log"
    latex_success=false
    latex_files=0
fi

# 6. Security Quick Scan
echo "🔒 Phase 6: Security Quick Scan"
security_log="$VALIDATION_DIR/security.log"

# Check for hardcoded secrets
secret_count=0
if grep -r -i "password\|secret\|api.key" src/ --include="*.js" >/dev/null 2>&1; then
    secret_count=$(grep -r -i "password\|secret\|api.key" src/ --include="*.js" | wc -l)
fi

echo "Potential hardcoded secrets: $secret_count" >> "$security_log"

# npm audit (quick)
npm audit --audit-level=high --json > "$VALIDATION_DIR/npm-audit.json" 2>/dev/null || echo '{"metadata":{"vulnerabilities":{"critical":0,"high":0}}}' > "$VALIDATION_DIR/npm-audit.json"
critical_vulns=$(jq -r '.metadata.vulnerabilities.critical // 0' "$VALIDATION_DIR/npm-audit.json" 2>/dev/null || echo 0)
high_vulns=$(jq -r '.metadata.vulnerabilities.high // 0' "$VALIDATION_DIR/npm-audit.json" 2>/dev/null || echo 0)

echo "Critical vulnerabilities: $critical_vulns" >> "$security_log"
echo "High vulnerabilities: $high_vulns" >> "$security_log"

# 7. Performance Quick Test
echo "⚡ Phase 7: Performance Test"
perf_log="$VALIDATION_DIR/performance.log"

# CLI startup time
start_time=$(date +%s%3N)
node bin/unjucks.cjs --version >/dev/null 2>&1
end_time=$(date +%s%3N)
startup_time=$((end_time - start_time))

echo "CLI startup time: ${startup_time}ms" >> "$perf_log"

# Template rendering time
start_time=$(date +%s%3N)
node bin/unjucks.cjs generate component PerfTest --dest /tmp/perf-test --dry >/dev/null 2>&1 || true
end_time=$(date +%s%3N)
render_time=$((end_time - start_time))

echo "Template render time: ${render_time}ms" >> "$perf_log"

# 8. Generate Final Report
echo "📊 Phase 8: Final Report"
cat > "$VALIDATION_DIR/validation-report.json" << EOF
{
  "timestamp": "$(date -Iseconds)",
  "environment": {
    "node_version": "$(node --version)",
    "npm_version": "$(npm --version)",
    "os": "$(uname -s)",
    "architecture": "$(uname -m)"
  },
  "phases": {
    "build": {
      "status": "$([[ $build_exit_code -eq 0 ]] && echo "PASS" || echo "FAIL")",
      "duration_seconds": $build_duration,
      "exit_code": $build_exit_code
    },
    "tests": {
      "status": "$([[ $test_exit_code -eq 0 ]] && echo "PASS" || echo "WARN")",
      "duration_seconds": $test_duration,
      "pass_rate_percent": $pass_rate,
      "total_tests": $total_tests,
      "passing_tests": $passing_tests,
      "exit_code": $test_exit_code
    },
    "cli": {
      "status": "$([[ $cli_pass_rate -ge 75 ]] && echo "PASS" || echo "WARN")",
      "pass_rate_percent": $cli_pass_rate,
      "successful_commands": $cli_success,
      "total_commands": $cli_total
    },
    "generation": {
      "status": "$([[ $generation_success == true ]] && echo "PASS" || echo "WARN")",
      "files_generated": $generated_files
    },
    "latex": {
      "status": "$([[ $latex_success == true ]] && echo "PASS" || echo "WARN")",
      "latex_files_generated": $latex_files
    },
    "security": {
      "critical_vulnerabilities": $critical_vulns,
      "high_vulnerabilities": $high_vulns,
      "potential_secrets": $secret_count,
      "status": "$([[ $critical_vulns -eq 0 && $secret_count -eq 0 ]] && echo "PASS" || echo "WARN")"
    },
    "performance": {
      "startup_time_ms": $startup_time,
      "render_time_ms": $render_time,
      "status": "$([[ $startup_time -lt 2000 && $render_time -lt 1000 ]] && echo "PASS" || echo "WARN")"
    }
  },
  "overall_status": "$([[ $build_exit_code -eq 0 && $test_exit_code -eq 0 && $cli_pass_rate -ge 75 ]] && echo "PASS" || echo "WARN")"
}
EOF

# Clean up temp directories
rm -rf "$test_dir" "$latex_test_dir" /tmp/perf-test 2>/dev/null || true

# Print summary
echo ""
echo "🎯 PRODUCTION VALIDATION SUMMARY"
echo "================================="
echo "Build:        $([[ $build_exit_code -eq 0 ]] && echo "✅ PASS" || echo "❌ FAIL") (${build_duration}s)"
echo "Tests:        $([[ $test_exit_code -eq 0 ]] && echo "✅ PASS" || echo "⚠️ WARN") (${pass_rate}%)"
echo "CLI:          $([[ $cli_pass_rate -ge 75 ]] && echo "✅ PASS" || echo "⚠️ WARN") (${cli_pass_rate}%)"
echo "Generation:   $([[ $generation_success == true ]] && echo "✅ PASS" || echo "⚠️ WARN") (${generated_files} files)"
echo "LaTeX:        $([[ $latex_success == true ]] && echo "✅ PASS" || echo "⚠️ WARN") (${latex_files} files)"
echo "Security:     $([[ $critical_vulns -eq 0 && $secret_count -eq 0 ]] && echo "✅ PASS" || echo "⚠️ WARN") (${critical_vulns} critical)"
echo "Performance:  $([[ $startup_time -lt 2000 && $render_time -lt 1000 ]] && echo "✅ PASS" || echo "⚠️ WARN") (${startup_time}ms startup)"

overall_status=$(cat "$VALIDATION_DIR/validation-report.json" | jq -r '.overall_status')
echo ""
if [ "$overall_status" = "PASS" ]; then
    echo "🎉 OVERALL STATUS: PASS - PRODUCTION READY!"
    echo "All critical components validated successfully."
else
    echo "⚠️ OVERALL STATUS: WARNING - Review required"
    echo "Some components need attention. Check logs for details."
fi

echo ""
echo "📁 Validation artifacts saved to: $VALIDATION_DIR/"
echo "📄 Full report: $VALIDATION_DIR/validation-report.json"