#!/bin/bash
set -euo pipefail

# Security: Validate environment
if [[ $EUID -eq 0 ]]; then
    echo "ERROR: Running as root is not allowed"
    exit 1
fi

echo "🚀 Starting Unjucks Cleanroom Test Environment"
echo "=============================================="
echo "Container: $(hostname)"
echo "User: $(whoami)"
echo "Date: $(date -u +%Y-%m-%dT%H:%M:%SZ)"

# Start Verdaccio in background with security
echo "Starting Verdaccio registry..."
verdaccio --config /app/verdaccio.yaml --listen 0.0.0.0:4873 &
VERDACCIO_PID=$!

# Enhanced health check for Verdaccio
echo "Waiting for Verdaccio to start..."
timeout=60
count=0
while ! curl -sf http://localhost:4873 >/dev/null 2>&1; do
    if [ $count -ge $timeout ]; then
        echo "ERROR: Verdaccio failed to start within $timeout seconds"
        kill $VERDACCIO_PID 2>/dev/null || true
        exit 1
    fi
    sleep 1
    ((count++))
done

echo "✅ Verdaccio started successfully"

# Configure npm with security settings
npm config set registry http://localhost:4873/
npm config set audit-level moderate
npm config set fund false

# Run comprehensive test suite
echo "🔍 Running comprehensive cleanroom tests..."
TEST_RESULT=0

# 1. Security scan
echo "📊 Running security scan..."
if /app/security-scan.sh; then
    echo "✅ Security scan passed"
else
    echo "⚠️  Security scan found issues"
    TEST_RESULT=1
fi

# 2. Performance monitoring
echo "⚡ Running performance tests..."
if /app/performance-monitor.sh; then
    echo "✅ Performance tests passed"
else
    echo "⚠️  Performance tests found issues"
    TEST_RESULT=1
fi

# 3. Validation checklist
echo "📋 Running validation checklist..."
if node /app/validation-checklist.js; then
    echo "✅ Validation checklist passed"
else
    echo "⚠️  Validation checklist found issues"
    TEST_RESULT=1
fi

# 4. CLI functionality tests
echo "🔧 Testing CLI functionality..."
if [[ -f /app/cleanroom-test.sh ]]; then
    if /app/cleanroom-test.sh docker; then
        echo "✅ CLI tests passed"
    else
        echo "❌ CLI tests failed"
        TEST_RESULT=1
    fi
else
    echo "⚠️  Cleanroom test script not found, running basic tests..."
    if node /app/bin/unjucks.cjs --help >/dev/null 2>&1; then
        echo "✅ Basic CLI test passed"
    else
        echo "❌ Basic CLI test failed"
        TEST_RESULT=1
    fi
fi

# Generate comprehensive report
echo "📊 Generating comprehensive report..."
mkdir -p /app/cleanroom-output
cat > /app/cleanroom-output/test-summary.json << EOJ
{
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "container": "$(hostname)",
    "environment": {
        "node_version": "$(node --version)",
        "npm_version": "$(npm --version)",
        "verdaccio_running": $(curl -sf http://localhost:4873 >/dev/null && echo true || echo false)
    },
    "test_results": {
        "security_scan": "$([ -f /app/security-reports/security-summary.json ] && echo 'completed' || echo 'failed')",
        "performance_tests": "$([ -f /app/performance-reports/performance-summary.json ] && echo 'completed' || echo 'failed')", 
        "validation_checklist": "completed",
        "cli_functionality": "$([ $TEST_RESULT -eq 0 ] && echo 'passed' || echo 'failed')"
    },
    "overall_result": "$([ $TEST_RESULT -eq 0 ] && echo 'PASSED' || echo 'FAILED')",
    "exit_code": $TEST_RESULT
}
EOJ

# Cleanup
echo "🧹 Cleaning up..."
kill $VERDACCIO_PID 2>/dev/null || true

# Copy results to output volume
if mountpoint -q /output 2>/dev/null; then
    echo "📁 Copying results to /output..."
    cp -r /app/cleanroom-output/* /output/ 2>/dev/null || true
    cp -r /app/security-reports/* /output/ 2>/dev/null || true
    cp -r /app/performance-reports/* /output/ 2>/dev/null || true
    cp /app/validation-reports/* /output/ 2>/dev/null || true
    echo "✅ Results copied to /output/"
else
    echo "📁 Output directory not mounted, results available at /app/cleanroom-output/"
fi

if [ $TEST_RESULT -eq 0 ]; then
    echo "🎉 All cleanroom tests PASSED!"
else
    echo "💥 Some cleanroom tests FAILED!"
fi

exit $TEST_RESULT