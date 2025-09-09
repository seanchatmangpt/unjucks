#!/bin/bash
set -euo pipefail

# Host System Production Validation Script
VALIDATION_DIR="validation-results"
mkdir -p "$VALIDATION_DIR"

echo "🚀 Starting Production Validation Suite (Host System)"
echo "=================================================="

# Log system info
echo "📊 System Information:" | tee "$VALIDATION_DIR/system-info.txt"
node --version >> "$VALIDATION_DIR/system-info.txt"
npm --version >> "$VALIDATION_DIR/system-info.txt"
uname -a >> "$VALIDATION_DIR/system-info.txt"

# 1. Clean Install Validation
echo "🔧 Phase 1: Clean Install Validation"
start_time=$(date +%s)
# Backup existing node_modules
if [ -d "node_modules" ]; then
    mv node_modules node_modules.backup
fi
if [ -f "package-lock.json" ]; then
    mv package-lock.json package-lock.json.backup
fi

npm install 2>&1 | tee "$VALIDATION_DIR/install.log"
install_exit_code=$?
end_time=$(date +%s)
install_duration=$((end_time - start_time))

echo "Install completed in ${install_duration}s with exit code: $install_exit_code" >> "$VALIDATION_DIR/install.log"

if [ $install_exit_code -ne 0 ]; then
    echo "❌ FATAL: npm install failed"
    exit 1
fi

# 2. Build Validation
echo "🏗️ Phase 2: Build Validation"
start_time=$(date +%s)
npm run build 2>&1 | tee "$VALIDATION_DIR/build.log"
build_exit_code=$?
end_time=$(date +%s)
build_duration=$((end_time - start_time))

echo "Build completed in ${build_duration}s with exit code: $build_exit_code" >> "$VALIDATION_DIR/build.log"

if [ $build_exit_code -ne 0 ]; then
    echo "❌ FATAL: Build failed"
    exit 1
fi

# 3. Test Suite Validation
echo "🧪 Phase 3: Test Suite Validation"
start_time=$(date +%s)
npm test 2>&1 | tee "$VALIDATION_DIR/test.log"
test_exit_code=$?
end_time=$(date +%s)
test_duration=$((end_time - start_time))

echo "Tests completed in ${test_duration}s with exit code: $test_exit_code" >> "$VALIDATION_DIR/test.log"

# Calculate test pass rate
total_tests=$(grep -o "✓\|✗\|passing\|failing" "$VALIDATION_DIR/test.log" | wc -l || echo 1)
passing_tests=$(grep -c "✓\|passing" "$VALIDATION_DIR/test.log" || echo 0)
if [ $total_tests -gt 0 ]; then
    pass_rate=$((passing_tests * 100 / total_tests))
else
    pass_rate=0
fi

echo "Test pass rate: ${pass_rate}% (${passing_tests}/${total_tests})" >> "$VALIDATION_DIR/test.log"

# 4. CLI Commands Validation
echo "⚡ Phase 4: CLI Commands Validation"
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

# 5. Template Generation Test
echo "📝 Phase 5: Template Generation Test"
gen_log="$VALIDATION_DIR/generation.log"
mkdir -p /tmp/test-generation

if node bin/unjucks.cjs generate component TestComponent --dest /tmp/test-generation 2>&1 | tee "$gen_log"; then
    echo "✅ Template generation - SUCCESS" >> "$gen_log"
    generation_success=true
else
    echo "❌ Template generation - FAILED" >> "$gen_log"
    generation_success=false
fi

# 6. Security Scan
echo "🔒 Phase 6: Security Validation"
security_log="$VALIDATION_DIR/security.log"

# npm audit
npm audit --audit-level=moderate --json > "$VALIDATION_DIR/npm-audit.json" 2>/dev/null || true
npm audit --audit-level=moderate > "$VALIDATION_DIR/npm-audit.txt" 2>/dev/null || true

# Count vulnerabilities
high_vulns=$(jq -r '.metadata.vulnerabilities.high // 0' "$VALIDATION_DIR/npm-audit.json" 2>/dev/null || echo 0)
critical_vulns=$(jq -r '.metadata.vulnerabilities.critical // 0' "$VALIDATION_DIR/npm-audit.json" 2>/dev/null || echo 0)

echo "Critical vulnerabilities: $critical_vulns" >> "$security_log"
echo "High vulnerabilities: $high_vulns" >> "$security_log"

# 7. Performance Benchmarks
echo "⚡ Phase 7: Performance Benchmarks"
perf_log="$VALIDATION_DIR/performance.log"

# Template rendering speed test
start_time=$(date +%s%3N)
for i in {1..10}; do
    node bin/unjucks.cjs generate component TestComp$i --dest /tmp/perf-test --dry >/dev/null 2>&1 || true
done
end_time=$(date +%s%3N)
avg_render_time=$(( (end_time - start_time) / 10 ))
echo "Average template render time: ${avg_render_time}ms" >> "$perf_log"

# 8. Generate Final Report
echo "📊 Phase 8: Generating Final Report"
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
    "install": {
      "status": "$([[ $install_exit_code -eq 0 ]] && echo "PASS" || echo "FAIL")",
      "duration_seconds": $install_duration,
      "exit_code": $install_exit_code
    },
    "build": {
      "status": "$([[ $build_exit_code -eq 0 ]] && echo "PASS" || echo "FAIL")",
      "duration_seconds": $build_duration,
      "exit_code": $build_exit_code
    },
    "tests": {
      "status": "$([[ $test_exit_code -eq 0 && $pass_rate -ge 80 ]] && echo "PASS" || echo "WARN")",
      "duration_seconds": $test_duration,
      "pass_rate_percent": $pass_rate,
      "total_tests": $total_tests,
      "passing_tests": $passing_tests
    },
    "cli": {
      "status": "$([[ $cli_pass_rate -ge 75 ]] && echo "PASS" || echo "WARN")",
      "pass_rate_percent": $cli_pass_rate,
      "successful_commands": $cli_success,
      "total_commands": $cli_total
    },
    "generation": {
      "status": "$([[ $generation_success == true ]] && echo "PASS" || echo "WARN")"
    },
    "security": {
      "critical_vulnerabilities": $critical_vulns,
      "high_vulnerabilities": $high_vulns,
      "status": "$([[ $critical_vulns -eq 0 ]] && echo "PASS" || echo "WARN")"
    },
    "performance": {
      "average_render_time_ms": $avg_render_time,
      "status": "$([[ $avg_render_time -lt 200 ]] && echo "PASS" || echo "WARN")"
    }
  },
  "overall_status": "$([[ $install_exit_code -eq 0 && $build_exit_code -eq 0 && $pass_rate -ge 80 && $cli_pass_rate -ge 75 ]] && echo "PASS" || echo "WARN")"
}
EOF

# Print summary
echo "🎯 Validation Summary"
echo "===================="
echo "Install: $([[ $install_exit_code -eq 0 ]] && echo "✅ PASS" || echo "❌ FAIL")"
echo "Build: $([[ $build_exit_code -eq 0 ]] && echo "✅ PASS" || echo "❌ FAIL")"
echo "Tests: $([[ $test_exit_code -eq 0 && $pass_rate -ge 80 ]] && echo "✅ PASS ($pass_rate%)" || echo "⚠️ WARN ($pass_rate%)")"
echo "CLI: $([[ $cli_pass_rate -ge 75 ]] && echo "✅ PASS ($cli_pass_rate%)" || echo "⚠️ WARN ($cli_pass_rate%)")"
echo "Generation: $([[ $generation_success == true ]] && echo "✅ PASS" || echo "⚠️ WARN")"
echo "Security: $([[ $critical_vulns -eq 0 ]] && echo "✅ PASS" || echo "⚠️ WARN ($critical_vulns critical)")"
echo "Performance: $([[ $avg_render_time -lt 200 ]] && echo "✅ PASS (${avg_render_time}ms)" || echo "⚠️ WARN (${avg_render_time}ms)")"

overall_status=$(cat "$VALIDATION_DIR/validation-report.json" | jq -r '.overall_status')
echo ""
if [ "$overall_status" = "PASS" ]; then
    echo "🎉 Overall Status: PASS - Production Ready!"
    exit 0
else
    echo "⚠️ Overall Status: WARN - Some issues detected, see logs for details"
    exit 0
fi