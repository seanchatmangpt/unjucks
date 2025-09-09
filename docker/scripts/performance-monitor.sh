#!/bin/bash
set -euo pipefail

# Performance monitoring script for Docker containers
echo "⚡ Starting Performance Monitoring"
echo "================================="

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPORT_DIR="/app/performance-logs"
LOG_FILE="${REPORT_DIR}/performance.log"

# Create directories
mkdir -p "${REPORT_DIR}"
exec 1> >(tee -a "${LOG_FILE}")
exec 2> >(tee -a "${LOG_FILE}" >&2)

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Performance monitoring functions
monitor_system_resources() {
    log_info "Monitoring system resources..."
    
    # Create resource monitoring output
    cat > "${REPORT_DIR}/system-resources.txt" <<EOF
# System Resource Monitoring
Generated: $(date -u +%Y-%m-%dT%H:%M:%SZ)

## Memory Information
EOF
    
    # Memory info
    if command -v free >/dev/null 2>&1; then
        echo "### Free Memory" >> "${REPORT_DIR}/system-resources.txt"
        free -h >> "${REPORT_DIR}/system-resources.txt"
        echo "" >> "${REPORT_DIR}/system-resources.txt"
    fi
    
    # Process memory
    echo "### Process Memory Usage" >> "${REPORT_DIR}/system-resources.txt"
    ps aux --sort=-%mem | head -20 >> "${REPORT_DIR}/system-resources.txt" 2>/dev/null || true
    echo "" >> "${REPORT_DIR}/system-resources.txt"
    
    # CPU info
    echo "## CPU Information" >> "${REPORT_DIR}/system-resources.txt"
    if [[ -f /proc/cpuinfo ]]; then
        grep "model name\|cpu cores\|processor" /proc/cpuinfo | head -20 >> "${REPORT_DIR}/system-resources.txt" || true
    fi
    echo "" >> "${REPORT_DIR}/system-resources.txt"
    
    # Load average
    echo "### Load Average" >> "${REPORT_DIR}/system-resources.txt"
    uptime >> "${REPORT_DIR}/system-resources.txt" 2>/dev/null || true
    echo "" >> "${REPORT_DIR}/system-resources.txt"
    
    # Disk usage
    echo "## Disk Usage" >> "${REPORT_DIR}/system-resources.txt"
    df -h >> "${REPORT_DIR}/system-resources.txt" 2>/dev/null || true
    
    log_success "System resource monitoring completed"
}

monitor_node_performance() {
    log_info "Monitoring Node.js performance..."
    
    # Node.js memory usage
    node -e "
        const used = process.memoryUsage();
        const data = {
            timestamp: new Date().toISOString(),
            memory: {
                rss: Math.round(used.rss / 1024 / 1024 * 100) / 100,
                heapTotal: Math.round(used.heapTotal / 1024 / 1024 * 100) / 100,
                heapUsed: Math.round(used.heapUsed / 1024 / 1024 * 100) / 100,
                external: Math.round(used.external / 1024 / 1024 * 100) / 100,
                arrayBuffers: Math.round(used.arrayBuffers / 1024 / 1024 * 100) / 100
            },
            process: {
                pid: process.pid,
                uptime: process.uptime(),
                version: process.version,
                platform: process.platform,
                arch: process.arch
            }
        };
        console.log(JSON.stringify(data, null, 2));
    " > "${REPORT_DIR}/node-performance.json"
    
    log_success "Node.js performance monitoring completed"
}

run_performance_benchmarks() {
    log_info "Running performance benchmarks..."
    
    # CPU benchmark
    log_info "Running CPU benchmark..."
    start_time=$(date +%s%N)
    
    node -e "
        const start = process.hrtime.bigint();
        let sum = 0;
        for (let i = 0; i < 10000000; i++) {
            sum += Math.sqrt(i) * Math.sin(i);
        }
        const end = process.hrtime.bigint();
        const duration = Number(end - start) / 1000000; // Convert to milliseconds
        
        const result = {
            test: 'cpu_intensive',
            iterations: 10000000,
            duration_ms: duration,
            ops_per_second: Math.round(10000000 / (duration / 1000)),
            result: sum
        };
        
        console.log(JSON.stringify(result, null, 2));
    " > "${REPORT_DIR}/cpu-benchmark.json"
    
    # Memory benchmark
    log_info "Running memory benchmark..."
    node -e "
        const start = process.hrtime.bigint();
        const arrays = [];
        
        // Allocate memory
        for (let i = 0; i < 1000; i++) {
            arrays.push(new Array(1000).fill(Math.random()));
        }
        
        // Force garbage collection if available
        if (global.gc) {
            global.gc();
        }
        
        const end = process.hrtime.bigint();
        const duration = Number(end - start) / 1000000;
        const memUsage = process.memoryUsage();
        
        const result = {
            test: 'memory_allocation',
            arrays_created: 1000,
            array_size: 1000,
            duration_ms: duration,
            memory_usage: {
                heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024 * 100) / 100,
                heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024 * 100) / 100
            }
        };
        
        console.log(JSON.stringify(result, null, 2));
    " > "${REPORT_DIR}/memory-benchmark.json"
    
    # I/O benchmark
    log_info "Running I/O benchmark..."
    node -e "
        const fs = require('fs');
        const path = require('path');
        
        const start = process.hrtime.bigint();
        const testFile = '/tmp/io-test.txt';
        const testData = 'x'.repeat(1024); // 1KB of data
        
        // Write test
        for (let i = 0; i < 1000; i++) {
            fs.writeFileSync(testFile + i, testData);
        }
        
        // Read test
        for (let i = 0; i < 1000; i++) {
            fs.readFileSync(testFile + i);
        }
        
        // Cleanup
        for (let i = 0; i < 1000; i++) {
            fs.unlinkSync(testFile + i);
        }
        
        const end = process.hrtime.bigint();
        const duration = Number(end - start) / 1000000;
        
        const result = {
            test: 'io_operations',
            files_written: 1000,
            files_read: 1000,
            file_size_bytes: 1024,
            total_io_mb: 2, // 1MB read + 1MB write
            duration_ms: duration,
            io_ops_per_second: Math.round(2000 / (duration / 1000))
        };
        
        console.log(JSON.stringify(result, null, 2));
    " > "${REPORT_DIR}/io-benchmark.json"
    
    log_success "Performance benchmarks completed"
}

run_stress_tests() {
    log_info "Running stress tests..."
    
    # Memory stress test
    log_info "Running memory stress test..."
    timeout 30 node -e "
        console.log('Starting memory stress test...');
        const arrays = [];
        let iteration = 0;
        
        const interval = setInterval(() => {
            try {
                // Allocate 10MB chunks
                for (let i = 0; i < 10; i++) {
                    arrays.push(new Array(1024 * 1024).fill(Math.random()));
                }
                iteration++;
                
                const memUsage = process.memoryUsage();
                console.log(\`Iteration \${iteration}: Heap used: \${Math.round(memUsage.heapUsed / 1024 / 1024)}MB\`);
                
                // Keep only last 50 arrays to prevent unlimited growth
                if (arrays.length > 500) {
                    arrays.splice(0, 100);
                }
                
            } catch (error) {
                console.log('Memory allocation failed:', error.message);
                clearInterval(interval);
            }
        }, 100);
        
        setTimeout(() => {
            clearInterval(interval);
            console.log('Memory stress test completed');
        }, 25000);
    " > "${REPORT_DIR}/memory-stress.log" 2>&1 || log_warning "Memory stress test timed out (expected)"
    
    # CPU stress test
    log_info "Running CPU stress test..."
    timeout 20 node -e "
        console.log('Starting CPU stress test...');
        const workers = [];
        const numWorkers = require('os').cpus().length;
        
        for (let w = 0; w < numWorkers; w++) {
            setTimeout(() => {
                console.log(\`Starting worker \${w + 1}/\${numWorkers}\`);
                let counter = 0;
                const start = Date.now();
                
                while (Date.now() - start < 15000) { // Run for 15 seconds
                    Math.sqrt(Math.random() * 1000000);
                    counter++;
                    
                    if (counter % 1000000 === 0) {
                        console.log(\`Worker \${w + 1}: \${counter} operations\`);
                    }
                }
                
                console.log(\`Worker \${w + 1} completed: \${counter} operations\`);
            }, w * 100);
        }
    " > "${REPORT_DIR}/cpu-stress.log" 2>&1 || log_warning "CPU stress test completed"
    
    log_success "Stress tests completed"
}

monitor_application_performance() {
    log_info "Monitoring application performance..."
    
    # Test application startup time
    if [[ -f "/app/bin/unjucks.cjs" ]]; then
        log_info "Testing application startup time..."
        
        start_time=$(date +%s%N)
        timeout 10 node /app/bin/unjucks.cjs --version >/dev/null 2>&1 || true
        end_time=$(date +%s%N)
        startup_time=$(((end_time - start_time) / 1000000))
        
        echo "{\"startup_time_ms\": $startup_time}" > "${REPORT_DIR}/app-startup.json"
        log_info "Application startup time: ${startup_time}ms"
    fi
    
    # Test template rendering performance if possible
    if npm run benchmark:template-rendering >/dev/null 2>&1; then
        log_success "Template rendering benchmark completed"
    else
        log_info "Template rendering benchmark not available"
    fi
    
    log_success "Application performance monitoring completed"
}

generate_performance_report() {
    log_info "Generating performance report..."
    
    # Collect all benchmark results
    cat > "${REPORT_DIR}/performance-summary.json" <<EOF
{
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "system_info": $(cat "${REPORT_DIR}/node-performance.json" | jq '.process' 2>/dev/null || echo '{}'),
    "benchmarks": {
        "cpu": $(cat "${REPORT_DIR}/cpu-benchmark.json" 2>/dev/null || echo '{}'),
        "memory": $(cat "${REPORT_DIR}/memory-benchmark.json" 2>/dev/null || echo '{}'),
        "io": $(cat "${REPORT_DIR}/io-benchmark.json" 2>/dev/null || echo '{}'),
        "application": $(cat "${REPORT_DIR}/app-startup.json" 2>/dev/null || echo '{}')
    },
    "resource_usage": $(cat "${REPORT_DIR}/node-performance.json" | jq '.memory' 2>/dev/null || echo '{}'),
    "status": "completed"
}
EOF
    
    # Generate markdown report
    cat > "${REPORT_DIR}/performance-summary.md" <<EOF
# Performance Monitoring Report

**Generated:** $(date -u +%Y-%m-%dT%H:%M:%SZ)

## System Information
- Node.js Version: $(node --version)
- Platform: $(node -e "console.log(process.platform)")
- Architecture: $(node -e "console.log(process.arch)")

## Benchmark Results
$(if [[ -f "${REPORT_DIR}/cpu-benchmark.json" ]]; then
    echo "### CPU Performance"
    echo "- Duration: $(jq -r '.duration_ms' "${REPORT_DIR}/cpu-benchmark.json")ms"
    echo "- Operations/sec: $(jq -r '.ops_per_second' "${REPORT_DIR}/cpu-benchmark.json")"
    echo ""
fi)

$(if [[ -f "${REPORT_DIR}/memory-benchmark.json" ]]; then
    echo "### Memory Performance"
    echo "- Duration: $(jq -r '.duration_ms' "${REPORT_DIR}/memory-benchmark.json")ms"
    echo "- Heap Used: $(jq -r '.memory_usage.heapUsed' "${REPORT_DIR}/memory-benchmark.json")MB"
    echo ""
fi)

$(if [[ -f "${REPORT_DIR}/io-benchmark.json" ]]; then
    echo "### I/O Performance"
    echo "- Duration: $(jq -r '.duration_ms' "${REPORT_DIR}/io-benchmark.json")ms"
    echo "- I/O Ops/sec: $(jq -r '.io_ops_per_second' "${REPORT_DIR}/io-benchmark.json")"
    echo ""
fi)

## Stress Test Results
- Memory stress test: $(if [[ -f "${REPORT_DIR}/memory-stress.log" ]]; then echo "Completed"; else echo "Skipped"; fi)
- CPU stress test: $(if [[ -f "${REPORT_DIR}/cpu-stress.log" ]]; then echo "Completed"; else echo "Skipped"; fi)

See detailed logs and data in individual report files.
EOF
    
    log_success "Performance report generated"
}

# Main performance monitoring sequence
main() {
    log_info "Starting comprehensive performance monitoring..."
    
    monitor_system_resources
    monitor_node_performance
    run_performance_benchmarks
    run_stress_tests
    monitor_application_performance
    generate_performance_report
    
    log_success "⚡ Performance monitoring completed!"
    log_info "Reports available in: ${REPORT_DIR}"
}

# Run main function
main "$@"