#!/bin/bash

# Resource Stress Testing Script for Performance Docker Container
# Used to simulate load and measure performance metrics

set -euo pipefail

# Default configuration
CPU_STRESS_DURATION=${CPU_STRESS_DURATION:-60}
MEMORY_STRESS_SIZE=${MEMORY_STRESS_SIZE:-256M}
IO_STRESS_DURATION=${IO_STRESS_DURATION:-30}
LOG_FILE=${LOG_FILE:-/app/performance-logs/stress-test.log}

# Ensure log directory exists
mkdir -p "$(dirname "$LOG_FILE")"

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

# CPU stress test
cpu_stress() {
    log "Starting CPU stress test for ${CPU_STRESS_DURATION}s..."
    
    # CPU intensive operation using dd and /dev/zero
    timeout "${CPU_STRESS_DURATION}s" bash -c '
        while true; do
            dd if=/dev/zero of=/dev/null bs=1M count=100 2>/dev/null
        done
    ' || true
    
    log "CPU stress test completed"
}

# Memory stress test
memory_stress() {
    log "Starting memory stress test with ${MEMORY_STRESS_SIZE}..."
    
    # Allocate memory using dd
    timeout 30s bash -c "
        dd if=/dev/zero of=/tmp/memory-stress bs=1M count=\$(echo ${MEMORY_STRESS_SIZE} | sed 's/M//') 2>/dev/null || true
        sleep 10
        rm -f /tmp/memory-stress
    " || true
    
    log "Memory stress test completed"
}

# I/O stress test
io_stress() {
    log "Starting I/O stress test for ${IO_STRESS_DURATION}s..."
    
    # I/O intensive operations
    timeout "${IO_STRESS_DURATION}s" bash -c '
        for i in {1..100}; do
            dd if=/dev/zero of=/tmp/io-test-$i bs=1M count=10 2>/dev/null
            sync
            rm -f /tmp/io-test-$i
        done
    ' || true
    
    log "I/O stress test completed"
}

# Network stress simulation
network_stress() {
    log "Starting network stress simulation..."
    
    # Simulate network requests
    for i in {1..50}; do
        curl -s http://httpbin.org/delay/1 >/dev/null 2>&1 || true
        sleep 0.1
    done
    
    log "Network stress simulation completed"
}

# System resource monitoring
monitor_resources() {
    log "System resource monitoring:"
    
    # CPU and memory usage
    log "CPU Usage: $(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1 || echo 'N/A')"
    log "Memory Usage: $(free -m | awk 'NR==2{printf "%.1f%%", $3*100/$2}' || echo 'N/A')"
    
    # Disk usage
    log "Disk Usage: $(df -h /app | awk 'NR==2 {print $5}' || echo 'N/A')"
    
    # Process count
    log "Process Count: $(ps aux | wc -l || echo 'N/A')"
}

# Main stress test function
run_stress_tests() {
    log "=== Resource Stress Test Started ==="
    
    # Initial resource state
    monitor_resources
    
    # Run stress tests
    case "${1:-all}" in
        "cpu")
            cpu_stress
            ;;
        "memory")
            memory_stress
            ;;
        "io")
            io_stress
            ;;
        "network")
            network_stress
            ;;
        "all"|*)
            cpu_stress &
            memory_stress &
            io_stress &
            wait
            network_stress
            ;;
    esac
    
    # Final resource state
    monitor_resources
    
    log "=== Resource Stress Test Completed ==="
}

# Performance benchmark for unjucks CLI
benchmark_unjucks() {
    log "=== Unjucks Performance Benchmark ==="
    
    # Benchmark CLI operations
    local operations=(
        "unjucks --version"
        "unjucks list"
        "unjucks help"
        "unjucks generate component test --dry"
    )
    
    for op in "${operations[@]}"; do
        log "Benchmarking: $op"
        
        # Run operation multiple times and measure
        local total_time=0
        local iterations=5
        
        for ((i=1; i<=iterations; i++)); do
            start_time=$(date +%s%N)
            eval "$op" >/dev/null 2>&1 || true
            end_time=$(date +%s%N)
            
            duration=$(( (end_time - start_time) / 1000000 )) # Convert to milliseconds
            total_time=$((total_time + duration))
        done
        
        avg_time=$((total_time / iterations))
        log "Average time for '$op': ${avg_time}ms"
    done
    
    log "=== Unjucks Benchmark Completed ==="
}

# Usage information
usage() {
    echo "Usage: $0 [OPTIONS] [TEST_TYPE]"
    echo ""
    echo "Test Types:"
    echo "  all      - Run all stress tests (default)"
    echo "  cpu      - CPU stress test only"
    echo "  memory   - Memory stress test only"
    echo "  io       - I/O stress test only"
    echo "  network  - Network stress test only"
    echo "  unjucks  - Unjucks CLI benchmark only"
    echo ""
    echo "Environment Variables:"
    echo "  CPU_STRESS_DURATION - CPU stress duration in seconds (default: 60)"
    echo "  MEMORY_STRESS_SIZE  - Memory stress size (default: 256M)"
    echo "  IO_STRESS_DURATION  - I/O stress duration in seconds (default: 30)"
    echo "  LOG_FILE            - Log file path (default: /app/performance-logs/stress-test.log)"
    echo ""
    echo "Examples:"
    echo "  $0 cpu"
    echo "  CPU_STRESS_DURATION=30 $0 all"
    echo "  $0 unjucks"
}

# Main execution
main() {
    case "${1:-all}" in
        "help"|"-h"|"--help")
            usage
            exit 0
            ;;
        "unjucks")
            benchmark_unjucks
            ;;
        *)
            run_stress_tests "$1"
            ;;
    esac
}

# Execute main function with all arguments
main "$@"