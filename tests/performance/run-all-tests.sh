#!/bin/bash

# KGEN Performance Test Suite Runner
# Executes all performance tests and generates comprehensive reports

echo "🚀 KGEN Performance Test Suite"
echo "=============================="
echo "Running comprehensive performance analysis..."
echo ""

# Set up results directory
RESULTS_DIR="tests/performance/results"
mkdir -p "$RESULTS_DIR"

# Record system info
echo "💻 System Information:"
echo "Platform: $(uname -s) $(uname -m)"
echo "CPU: $(sysctl -n machdep.cpu.brand_string 2>/dev/null || grep 'model name' /proc/cpuinfo | head -1 | cut -d: -f2 | xargs)"
echo "Memory: $(echo "$(sysctl -n hw.memsize 2>/dev/null || grep MemTotal /proc/meminfo | awk '{print $2}') / 1024 / 1024 / 1024" | bc)GB"
echo "Node.js: $(node --version)"
echo ""

# Run performance benchmark
echo "⏱️ Running performance benchmarks..."
if node tests/performance/performance-benchmark.mjs --iterations=3; then
    echo "✅ Performance benchmark completed"
else
    echo "❌ Performance benchmark failed"
fi
echo ""

# Run memory profiler  
echo "🧠 Running memory profiler..."
if node tests/performance/memory-profiler.mjs; then
    echo "✅ Memory profiling completed"
else
    echo "❌ Memory profiling failed"
fi
echo ""

# List generated reports
echo "📊 Generated Reports:"
echo "===================="
ls -la "$RESULTS_DIR"/*.json "$RESULTS_DIR"/*.md 2>/dev/null | while read -r line; do
    echo "  $line"
done

echo ""
echo "📋 Performance Analysis Reports:"
echo "  - tests/performance/performance-analysis-report.md"
echo "  - tests/performance/final-performance-report.md"
echo ""

# Show latest results summary
if [ -f "$RESULTS_DIR/performance-report-latest.json" ]; then
    echo "🔍 Latest Performance Summary:"
    node -e "
        const report = require('./tests/performance/results/performance-report-latest.json');
        console.log('  Overall Status:', report.summary.overallStatus);
        console.log('  Key Findings:');
        report.summary.keyFindings.forEach(finding => console.log('    •', finding));
        if (report.summary.performanceIssues.length > 0) {
            console.log('  Performance Issues:');
            report.summary.performanceIssues.forEach(issue => console.log('    •', issue));
        }
    " 2>/dev/null || echo "  (Could not parse latest results)"
fi

echo ""
echo "✅ Performance testing completed!"
echo "📖 View detailed analysis in the markdown reports above."