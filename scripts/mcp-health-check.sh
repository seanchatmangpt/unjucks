#!/bin/bash
# MCP Health Check Script
# Based on real-world nuxt-mcp integration analysis

set -e

LOG_FILE="logs/mcp-health-$(date +%Y%m%d).log"
ENDPOINT="http://localhost:3000/__mcp/sse"
TIMEOUT=30

# Ensure logs directory exists
mkdir -p logs

echo "$(date): Starting MCP Health Check" | tee -a "$LOG_FILE"

# Function to log with timestamp
log() {
    echo "$(date): $1" | tee -a "$LOG_FILE"
}

# Function to check if service is running
check_service() {
    local service_name="$1"
    local pid=$(pgrep -f "$service_name")
    
    if [ -n "$pid" ]; then
        log "✅ $service_name: Running (PID: $pid)"
        return 0
    else
        log "❌ $service_name: Not running"
        return 1
    fi
}

# Function to check HTTP endpoint
check_endpoint() {
    local url="$1"
    local timeout="$2"
    
    if curl -s -f --max-time "$timeout" "$url" > /dev/null 2>&1; then
        log "✅ MCP Endpoint: Healthy ($url)"
        return 0
    else
        log "❌ MCP Endpoint: Unhealthy ($url)"
        return 1
    fi
}

# Function to check for errors in recent logs
check_logs() {
    local error_count=0
    
    # Check for MCP-specific errors (last 100 lines)
    if [ -f ".nuxt/dev.log" ]; then
        error_count=$(tail -100 .nuxt/dev.log | grep -i "mcp.*error" | wc -l)
    elif [ -f "nuxt.log" ]; then
        error_count=$(tail -100 nuxt.log | grep -i "mcp.*error" | wc -l)
    fi
    
    if [ "$error_count" -gt 0 ]; then
        log "⚠️  MCP Errors detected: $error_count errors in recent logs"
        # Show last 5 errors
        if [ -f ".nuxt/dev.log" ]; then
            tail -100 .nuxt/dev.log | grep -i "mcp.*error" | tail -5 | while read line; do
                log "   ERROR: $line"
            done
        fi
        return 1
    else
        log "✅ MCP Logs: No errors detected"
        return 0
    fi
}

# Function to check system resources
check_resources() {
    local memory_usage=$(ps aux | grep -E "(nuxt|node)" | grep -v grep | awk '{sum+=$6} END {print sum/1024}' 2>/dev/null || echo "0")
    local cpu_usage=$(ps aux | grep -E "(nuxt|node)" | grep -v grep | awk '{sum+=$3} END {print sum}' 2>/dev/null || echo "0")
    
    log "📊 Resource Usage: Memory: ${memory_usage}MB, CPU: ${cpu_usage}%"
    
    # Check if memory usage is excessive (> 1GB)
    if [ $(echo "$memory_usage > 1024" | bc -l 2>/dev/null || echo 0) -eq 1 ]; then
        log "⚠️  High memory usage detected: ${memory_usage}MB"
        return 1
    fi
    
    return 0
}

# Function to verify MCP configuration
check_config() {
    if [ -f "nuxt.config.ts" ]; then
        if grep -q "nuxt-mcp" nuxt.config.ts; then
            log "✅ Configuration: nuxt-mcp found in nuxt.config.ts"
        else
            log "❌ Configuration: nuxt-mcp not found in nuxt.config.ts"
            return 1
        fi
    else
        log "❌ Configuration: nuxt.config.ts not found"
        return 1
    fi
    
    # Check if MCP config file was created
    if [ -f "$HOME/.codeium/windsurf/mcp_config.json" ]; then
        log "✅ MCP Config: Auto-generated config file exists"
    else
        log "⚠️  MCP Config: Auto-generated config file not found (may be normal on first run)"
    fi
    
    return 0
}

# Main health check sequence
main() {
    local exit_code=0
    
    log "=== MCP Health Check Started ==="
    
    # Environment information
    log "Environment: Node $(node --version 2>/dev/null || echo 'NOT_FOUND'), Nuxt $(npx nuxt --version 2>/dev/null || echo 'NOT_FOUND')"
    
    # Check 1: Verify Nuxt process is running
    if ! check_service "nuxt.*dev"; then
        log "🚨 Critical: Nuxt development server not running"
        exit_code=2
    fi
    
    # Check 2: Verify MCP endpoint accessibility
    if ! check_endpoint "$ENDPOINT" "$TIMEOUT"; then
        log "🚨 Critical: MCP endpoint not accessible"
        exit_code=2
    fi
    
    # Check 3: Configuration validation
    if ! check_config; then
        log "⚠️  Warning: Configuration issues detected"
        if [ $exit_code -eq 0 ]; then exit_code=1; fi
    fi
    
    # Check 4: Log analysis
    if ! check_logs; then
        log "⚠️  Warning: Error patterns found in logs"
        if [ $exit_code -eq 0 ]; then exit_code=1; fi
    fi
    
    # Check 5: Resource monitoring
    if ! check_resources; then
        log "⚠️  Warning: Resource usage concerns"
        if [ $exit_code -eq 0 ]; then exit_code=1; fi
    fi
    
    # Summary
    case $exit_code in
        0)
            log "🎉 Health Check: PASSED - All systems healthy"
            ;;
        1)
            log "⚠️  Health Check: WARNING - Minor issues detected"
            ;;
        2)
            log "🚨 Health Check: FAILED - Critical issues detected"
            ;;
    esac
    
    log "=== MCP Health Check Completed ==="
    exit $exit_code
}

# Handle script interruption
trap 'log "Health check interrupted"; exit 130' INT TERM

# Run main function
main "$@"