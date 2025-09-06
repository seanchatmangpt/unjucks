#!/bin/bash
# MCP Integration Diagnostics Script
# Comprehensive diagnostics for nuxt-mcp integration issues

set -e

REPORT_FILE="diagnostics/mcp-diagnostics-$(date +%Y%m%d-%H%M%S).txt"

# Ensure diagnostics directory exists
mkdir -p diagnostics

# Function to log to both console and report
report() {
    echo "$1" | tee -a "$REPORT_FILE"
}

# Function to run command and capture output
run_diagnostic() {
    local title="$1"
    local command="$2"
    
    report ""
    report "=== $title ==="
    
    if eval "$command" 2>&1 | tee -a "$REPORT_FILE"; then
        return 0
    else
        report "❌ Command failed: $command"
        return 1
    fi
}

# Function to check file and report status
check_file() {
    local file="$1"
    local description="$2"
    
    if [ -f "$file" ]; then
        report "✅ $description: EXISTS ($file)"
        return 0
    else
        report "❌ $description: NOT FOUND ($file)"
        return 1
    fi
}

main() {
    report "=== MCP INTEGRATION DIAGNOSTICS ==="
    report "Date: $(date)"
    report "Working Directory: $(pwd)"
    report "User: $(whoami)"
    report "Host: $(hostname)"
    report ""
    
    # System Environment
    run_diagnostic "System Environment" "uname -a"
    
    report ""
    report "Environment Versions:"
    report "   Node.js: $(node --version 2>/dev/null || echo 'NOT_INSTALLED')"
    report "   NPM: $(npm --version 2>/dev/null || echo 'NOT_INSTALLED')"
    report "   PNPM: $(pnpm --version 2>/dev/null || echo 'NOT_INSTALLED')"
    report "   Yarn: $(yarn --version 2>/dev/null || echo 'NOT_INSTALLED')"
    report "   Nuxt: $(npx nuxt --version 2>/dev/null || echo 'NOT_INSTALLED')"
    
    # Package Information
    report ""
    report "Package Information:"
    if [ -f "package.json" ]; then
        local nuxt_version=$(grep '"nuxt"' package.json | sed 's/.*"nuxt": "\([^"]*\)".*/\1/' || echo "NOT_FOUND")
        local mcp_version=$(grep '"nuxt-mcp"' package.json | sed 's/.*"nuxt-mcp": "\([^"]*\)".*/\1/' || echo "NOT_FOUND")
        report "   Nuxt version in package.json: $nuxt_version"
        report "   nuxt-mcp version in package.json: $mcp_version"
        
        # Check if nuxt-mcp is in dependencies
        if grep -q '"nuxt-mcp"' package.json; then
            report "✅ nuxt-mcp found in package.json dependencies"
        else
            report "❌ nuxt-mcp NOT found in package.json dependencies"
        fi
    else
        report "❌ package.json not found in current directory"
    fi
    
    # Installed packages check
    if command -v pnpm > /dev/null 2>&1; then
        run_diagnostic "PNPM Package List (nuxt-mcp)" "pnpm list nuxt-mcp 2>/dev/null || echo 'Package not found in pnpm list'"
    elif command -v npm > /dev/null 2>&1; then
        run_diagnostic "NPM Package List (nuxt-mcp)" "npm list nuxt-mcp 2>/dev/null || echo 'Package not found in npm list'"
    fi
    
    # Configuration Files
    report ""
    report "Configuration File Status:"
    check_file "nuxt.config.ts" "Nuxt TypeScript Config"
    check_file "nuxt.config.js" "Nuxt JavaScript Config"
    check_file "tsconfig.json" "TypeScript Config"
    check_file ".nuxt/nuxt.d.ts" "Generated Nuxt Types"
    check_file "$HOME/.codeium/windsurf/mcp_config.json" "MCP Auto-generated Config"
    
    # Nuxt configuration analysis
    if [ -f "nuxt.config.ts" ]; then
        report ""
        run_diagnostic "Nuxt Configuration Analysis" "cat nuxt.config.ts | grep -A 20 -B 5 modules"
        
        if grep -q "nuxt-mcp" nuxt.config.ts; then
            report "✅ nuxt-mcp module found in nuxt.config.ts"
            
            # Check module order
            local mcp_line=$(grep -n "nuxt-mcp" nuxt.config.ts | cut -d: -f1)
            report "   nuxt-mcp found at line: $mcp_line"
            
            # Show surrounding modules
            report "   Modules context:"
            sed -n "$((mcp_line-3)),$((mcp_line+3))p" nuxt.config.ts | sed 's/^/      /' | tee -a "$REPORT_FILE"
        else
            report "❌ nuxt-mcp module NOT found in nuxt.config.ts"
        fi
    elif [ -f "nuxt.config.js" ]; then
        run_diagnostic "Nuxt Configuration Analysis" "cat nuxt.config.js | grep -A 20 -B 5 modules"
    fi
    
    # Process Information
    report ""
    report "Process Information:"
    local nuxt_processes=$(pgrep -f "nuxt.*dev" | wc -l)
    local node_processes=$(pgrep -f "node.*nuxt" | wc -l)
    
    report "   Nuxt dev processes: $nuxt_processes"
    report "   Node nuxt processes: $node_processes"
    
    if [ "$nuxt_processes" -gt 0 ]; then
        report "✅ Nuxt development server is running"
        run_diagnostic "Nuxt Process Details" "ps aux | grep -E 'nuxt.*dev' | grep -v grep"
    else
        report "❌ No Nuxt development server processes found"
    fi
    
    # Port and Network Status
    report ""
    report "Network Status:"
    local port_3000=$(lsof -ti:3000 2>/dev/null | wc -l)
    report "   Processes on port 3000: $port_3000"
    
    if [ "$port_3000" -gt 0 ]; then
        report "✅ Port 3000 is in use"
        run_diagnostic "Port 3000 Process Details" "lsof -i:3000"
    else
        report "❌ Port 3000 is not in use"
    fi
    
    # Network connectivity test
    if command -v nc > /dev/null 2>&1; then
        if nc -z localhost 3000 2>/dev/null; then
            report "✅ Can connect to localhost:3000"
        else
            report "❌ Cannot connect to localhost:3000"
        fi
    fi
    
    # MCP Endpoint Test
    report ""
    report "MCP Endpoint Testing:"
    if command -v curl > /dev/null 2>&1; then
        if curl -s -f --max-time 5 "http://localhost:3000/__mcp/sse" > /dev/null 2>&1; then
            report "✅ MCP endpoint http://localhost:3000/__mcp/sse is accessible"
        else
            report "❌ MCP endpoint http://localhost:3000/__mcp/sse is not accessible"
            
            # Try to get more details about the failure
            curl_output=$(curl -s --max-time 5 "http://localhost:3000/__mcp/sse" 2>&1 || echo "Curl failed")
            report "   Curl output: $curl_output"
        fi
    else
        report "⚠️  curl command not available for endpoint testing"
    fi
    
    # Log Analysis
    report ""
    report "Log Analysis:"
    
    # Check various log locations
    local log_locations=(
        ".nuxt/dev.log"
        ".output/server/chunks/nitro/node-server.mjs"
        "logs/nuxt.log"
        "nuxt.log"
    )
    
    local logs_found=0
    for log_file in "${log_locations[@]}"; do
        if [ -f "$log_file" ]; then
            report "✅ Found log file: $log_file"
            logs_found=$((logs_found + 1))
            
            # Look for MCP-related entries
            local mcp_entries=$(grep -i "mcp" "$log_file" 2>/dev/null | wc -l || echo 0)
            report "   MCP-related log entries: $mcp_entries"
            
            if [ "$mcp_entries" -gt 0 ]; then
                report "   Recent MCP log entries:"
                grep -i "mcp" "$log_file" 2>/dev/null | tail -5 | sed 's/^/      /' | tee -a "$REPORT_FILE"
            fi
            
            # Look for errors
            local error_entries=$(grep -i "error.*mcp\|mcp.*error" "$log_file" 2>/dev/null | wc -l || echo 0)
            if [ "$error_entries" -gt 0 ]; then
                report "❌ MCP-related errors found: $error_entries"
                grep -i "error.*mcp\|mcp.*error" "$log_file" 2>/dev/null | tail -3 | sed 's/^/      ERROR: /' | tee -a "$REPORT_FILE"
            fi
        fi
    done
    
    if [ "$logs_found" -eq 0 ]; then
        report "⚠️  No log files found in common locations"
    fi
    
    # Dependency Tree Analysis
    if command -v pnpm > /dev/null 2>&1 && [ -f "pnpm-lock.yaml" ]; then
        run_diagnostic "PNPM Dependency Tree (nuxt-mcp)" "pnpm why nuxt-mcp 2>/dev/null || echo 'nuxt-mcp not found in dependency tree'"
    elif command -v npm > /dev/null 2>&1 && [ -f "package-lock.json" ]; then
        run_diagnostic "NPM Dependency Tree (nuxt-mcp)" "npm ls nuxt-mcp 2>/dev/null || echo 'nuxt-mcp not found in dependency tree'"
    fi
    
    # TypeScript Compilation
    if [ -f "tsconfig.json" ] && command -v npx > /dev/null 2>&1; then
        report ""
        report "TypeScript Compilation Test:"
        if npx tsc --noEmit --skipLibCheck 2>&1 | tee -a "$REPORT_FILE"; then
            report "✅ TypeScript compilation successful"
        else
            report "❌ TypeScript compilation errors detected"
        fi
    fi
    
    # Build Test
    report ""
    report "Build Test:"
    if [ -f "package.json" ]; then
        local build_script=$(grep '"build"' package.json | grep -o '"[^"]*"$' | tr -d '"')
        if [ -n "$build_script" ]; then
            report "Build script found: $build_script"
            report "Note: Actual build test requires manual execution due to time constraints"
        else
            report "⚠️  No build script found in package.json"
        fi
    fi
    
    # Memory and Performance
    report ""
    report "Resource Usage:"
    if command -v ps > /dev/null 2>&1; then
        local memory_usage=$(ps aux | grep -E "(nuxt|node)" | grep -v grep | awk '{sum+=$6} END {print sum/1024}' 2>/dev/null || echo "0")
        local cpu_usage=$(ps aux | grep -E "(nuxt|node)" | grep -v grep | awk '{sum+=$3} END {print sum}' 2>/dev/null || echo "0")
        
        report "   Total Node/Nuxt Memory Usage: ${memory_usage} MB"
        report "   Total Node/Nuxt CPU Usage: ${cpu_usage}%"
        
        if [ $(echo "$memory_usage > 1024" | bc -l 2>/dev/null || echo 0) -eq 1 ]; then
            report "⚠️  High memory usage detected (>1GB)"
        fi
    fi
    
    # Recommendations
    report ""
    report "=== DIAGNOSTIC RECOMMENDATIONS ==="
    
    # Check for common issues and provide recommendations
    if ! grep -q "nuxt-mcp" nuxt.config.ts 2>/dev/null; then
        report "🔧 RECOMMENDATION: Add 'nuxt-mcp' to the modules array in nuxt.config.ts"
    fi
    
    if [ ! -f "pnpm-lock.yaml" ] && [ ! -f "package-lock.json" ]; then
        report "🔧 RECOMMENDATION: Run 'pnpm install' or 'npm install' to install dependencies"
    fi
    
    if [ "$nuxt_processes" -eq 0 ]; then
        report "🔧 RECOMMENDATION: Start the development server with 'pnpm dev' or 'npm run dev'"
    fi
    
    if ! curl -s -f --max-time 5 "http://localhost:3000/__mcp/sse" > /dev/null 2>&1; then
        report "🔧 RECOMMENDATION: Check if MCP module is properly configured and server is running"
    fi
    
    report ""
    report "=== DIAGNOSTIC COMPLETE ==="
    report "Report saved to: $REPORT_FILE"
    report "Total lines in report: $(wc -l < "$REPORT_FILE")"
}

# Execute main function
main "$@"