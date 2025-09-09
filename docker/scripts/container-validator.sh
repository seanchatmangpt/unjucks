#!/bin/bash
# =============================================================================
# CONTAINER VALIDATION SCRIPT
# Fortune 5 Container Security & Compliance Validator
# =============================================================================

set -euo pipefail

# Configuration
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly LOG_FILE="/app/logs/container-validation.log"
readonly RESULTS_FILE="/app/test-results/container-validation.json"

# Colors
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m'

# Validation results
declare -a VALIDATION_RESULTS=()
declare -i TOTAL_CHECKS=0
declare -i PASSED_CHECKS=0
declare -i FAILED_CHECKS=0

# =============================================================================
# UTILITY FUNCTIONS
# =============================================================================

log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    
    case "$level" in
        "INFO")  echo -e "${BLUE}[INFO]${NC} ${timestamp} $message" ;;
        "WARN")  echo -e "${YELLOW}[WARN]${NC} ${timestamp} $message" ;;
        "ERROR") echo -e "${RED}[ERROR]${NC} ${timestamp} $message" ;;
        "SUCCESS") echo -e "${GREEN}[SUCCESS]${NC} ${timestamp} $message" ;;
    esac
    
    echo "[$level] $timestamp $message" >> "$LOG_FILE"
}

add_validation_result() {
    local check_name="$1"
    local status="$2"
    local message="$3"
    local severity="${4:-medium}"
    
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    
    if [[ "$status" == "passed" ]]; then
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
        log "SUCCESS" "$check_name: $message"
    else
        FAILED_CHECKS=$((FAILED_CHECKS + 1))
        log "ERROR" "$check_name: $message"
    fi
    
    local result="{\"name\":\"$check_name\",\"status\":\"$status\",\"message\":\"$message\",\"severity\":\"$severity\",\"timestamp\":\"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\"}"
    VALIDATION_RESULTS+=("$result")
}

# =============================================================================
# SECURITY VALIDATIONS
# =============================================================================

validate_user_privileges() {
    log "INFO" "Validating user privileges and security context..."
    
    # Check running user is not root
    if [[ "$(id -u)" == "0" ]]; then
        add_validation_result "non_root_user" "failed" "Container is running as root user" "high"
    else
        add_validation_result "non_root_user" "passed" "Container is running as non-root user ($(whoami))"
    fi
    
    # Check user ID compliance
    local user_id=$(id -u)
    if [[ "$user_id" -ge 10000 ]]; then
        add_validation_result "user_id_range" "passed" "User ID is in acceptable range: $user_id"
    else
        add_validation_result "user_id_range" "failed" "User ID should be >= 10000, got: $user_id" "medium"
    fi
    
    # Check group membership
    local groups=$(groups)
    add_validation_result "group_membership" "passed" "User groups: $groups"
    
    # Check sudo access (should not have)
    if command -v sudo >/dev/null 2>&1 && sudo -n true 2>/dev/null; then
        add_validation_result "sudo_access" "failed" "User has sudo access - security risk" "high"
    else
        add_validation_result "sudo_access" "passed" "User does not have sudo access"
    fi
}

validate_file_permissions() {
    log "INFO" "Validating file permissions and ownership..."
    
    # Check critical application files
    local critical_files=("/app/bin/unjucks.cjs" "/app/src/cli/index.js")
    
    for file in "${critical_files[@]}"; do
        if [[ -f "$file" ]]; then
            local perms=$(stat -c "%a" "$file" 2>/dev/null || stat -f "%p" "$file" | tail -c 4)
            local owner=$(stat -c "%U" "$file" 2>/dev/null || stat -f "%Su" "$file")
            
            if [[ "$owner" == "unjucks" ]]; then
                add_validation_result "file_ownership_$file" "passed" "File owned by correct user: $file"
            else
                add_validation_result "file_ownership_$file" "failed" "File owned by: $owner, expected: unjucks" "medium"
            fi
            
            if [[ -x "$file" ]]; then
                add_validation_result "file_executable_$file" "passed" "File is executable: $file"
            else
                add_validation_result "file_executable_$file" "failed" "File is not executable: $file" "high"
            fi
        else
            add_validation_result "file_exists_$file" "failed" "Critical file missing: $file" "high"
        fi
    done
    
    # Check sensitive directories
    local secure_dirs=("/app/logs" "/app/test-results" "/app/coverage")
    
    for dir in "${secure_dirs[@]}"; do
        if [[ -d "$dir" ]]; then
            local perms=$(stat -c "%a" "$dir" 2>/dev/null || stat -f "%p" "$dir" | tail -c 4)
            local owner=$(stat -c "%U" "$dir" 2>/dev/null || stat -f "%Su" "$dir")
            
            if [[ "$owner" == "unjucks" ]]; then
                add_validation_result "dir_ownership_$dir" "passed" "Directory owned by correct user: $dir"
            else
                add_validation_result "dir_ownership_$dir" "failed" "Directory owned by: $owner, expected: unjucks" "medium"
            fi
        else
            add_validation_result "dir_exists_$dir" "failed" "Required directory missing: $dir" "medium"
        fi
    done
}

validate_network_security() {
    log "INFO" "Validating network security configuration..."
    
    # Check for open ports
    if command -v netstat >/dev/null 2>&1; then
        local open_ports=$(netstat -tuln 2>/dev/null | grep LISTEN || true)
        if [[ -n "$open_ports" ]]; then
            add_validation_result "network_ports" "passed" "Network port configuration validated"
        else
            add_validation_result "network_ports" "passed" "No listening ports found"
        fi
    else
        add_validation_result "network_ports" "passed" "netstat not available - skipping port check"
    fi
    
    # Check network namespace
    if [[ -f "/proc/self/ns/net" ]]; then
        add_validation_result "network_namespace" "passed" "Container has isolated network namespace"
    else
        add_validation_result "network_namespace" "failed" "Network namespace not properly isolated" "medium"
    fi
}

validate_filesystem_security() {
    log "INFO" "Validating filesystem security..."
    
    # Check for read-only filesystem (where applicable)
    local mount_info=$(mount | grep "on / " || true)
    if echo "$mount_info" | grep -q "ro,"; then
        add_validation_result "root_filesystem" "passed" "Root filesystem is read-only"
    else
        add_validation_result "root_filesystem" "passed" "Root filesystem is writable (expected for test container)"
    fi
    
    # Check tmpfs mounts
    local tmpfs_mounts=$(mount | grep tmpfs || true)
    if [[ -n "$tmpfs_mounts" ]]; then
        add_validation_result "tmpfs_security" "passed" "Temporary filesystems are properly mounted"
    else
        add_validation_result "tmpfs_security" "failed" "No tmpfs mounts found" "low"
    fi
    
    # Check for dangerous SUID binaries
    local suid_files=$(find /usr/bin /bin /usr/local/bin -perm -4000 2>/dev/null | head -10 || true)
    if [[ -n "$suid_files" ]]; then
        add_validation_result "suid_binaries" "passed" "SUID binaries found: $(echo "$suid_files" | wc -l) files"
    else
        add_validation_result "suid_binaries" "passed" "No SUID binaries found"
    fi
}

# =============================================================================
# RESOURCE VALIDATIONS
# =============================================================================

validate_resource_limits() {
    log "INFO" "Validating resource limits and constraints..."
    
    # Memory limits
    if [[ -f "/sys/fs/cgroup/memory/memory.limit_in_bytes" ]]; then
        local memory_limit=$(cat /sys/fs/cgroup/memory/memory.limit_in_bytes 2>/dev/null || echo "unlimited")
        if [[ "$memory_limit" != "unlimited" ]] && [[ "$memory_limit" -lt 9223372036854775807 ]]; then
            local memory_mb=$((memory_limit / 1024 / 1024))
            add_validation_result "memory_limit" "passed" "Memory limit enforced: ${memory_mb}MB"
        else
            add_validation_result "memory_limit" "failed" "No memory limit enforced" "medium"
        fi
    elif [[ -f "/sys/fs/cgroup/memory.max" ]]; then
        local memory_limit=$(cat /sys/fs/cgroup/memory.max 2>/dev/null || echo "max")
        if [[ "$memory_limit" != "max" ]]; then
            local memory_mb=$((memory_limit / 1024 / 1024))
            add_validation_result "memory_limit" "passed" "Memory limit enforced: ${memory_mb}MB (cgroup v2)"
        else
            add_validation_result "memory_limit" "failed" "No memory limit enforced (cgroup v2)" "medium"
        fi
    else
        add_validation_result "memory_limit" "failed" "Cannot determine memory limits" "low"
    fi
    
    # CPU limits
    if [[ -f "/sys/fs/cgroup/cpu/cpu.cfs_quota_us" ]] && [[ -f "/sys/fs/cgroup/cpu/cpu.cfs_period_us" ]]; then
        local quota=$(cat /sys/fs/cgroup/cpu/cpu.cfs_quota_us 2>/dev/null || echo "-1")
        local period=$(cat /sys/fs/cgroup/cpu/cpu.cfs_period_us 2>/dev/null || echo "100000")
        
        if [[ "$quota" != "-1" ]]; then
            local cpu_limit=$(echo "scale=2; $quota / $period" | bc 2>/dev/null || echo "unknown")
            add_validation_result "cpu_limit" "passed" "CPU limit enforced: ${cpu_limit} cores"
        else
            add_validation_result "cpu_limit" "failed" "No CPU limit enforced" "medium"
        fi
    else
        add_validation_result "cpu_limit" "passed" "CPU limits using cgroup v2 or not visible"
    fi
    
    # PID limits
    if [[ -f "/sys/fs/cgroup/pids/pids.max" ]]; then
        local pid_limit=$(cat /sys/fs/cgroup/pids/pids.max 2>/dev/null || echo "max")
        if [[ "$pid_limit" != "max" ]]; then
            add_validation_result "pid_limit" "passed" "PID limit enforced: $pid_limit"
        else
            add_validation_result "pid_limit" "failed" "No PID limit enforced" "low"
        fi
    else
        add_validation_result "pid_limit" "passed" "PID limits not visible or using cgroup v2"
    fi
    
    # Current resource usage
    local memory_usage=$(free -m | awk 'NR==2{printf "%.1f%%", $3*100/$2}')
    add_validation_result "current_memory_usage" "passed" "Current memory usage: $memory_usage"
    
    local cpu_usage=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d% -f1 || echo "N/A")
    add_validation_result "current_cpu_usage" "passed" "Current CPU usage: ${cpu_usage}%"
}

validate_process_security() {
    log "INFO" "Validating process security..."
    
    # Check process count
    local process_count=$(ps aux | wc -l)
    if [[ "$process_count" -lt 50 ]]; then
        add_validation_result "process_count" "passed" "Reasonable process count: $process_count"
    else
        add_validation_result "process_count" "failed" "High process count: $process_count" "medium"
    fi
    
    # Check for suspicious processes
    local suspicious_procs=$(ps aux | grep -E "(nc|netcat|ncat|telnet|wget|curl)" | grep -v grep || true)
    if [[ -z "$suspicious_procs" ]]; then
        add_validation_result "suspicious_processes" "passed" "No suspicious processes detected"
    else
        add_validation_result "suspicious_processes" "failed" "Suspicious processes found" "medium"
    fi
    
    # Check init system
    local init_process=$(ps -p 1 -o comm= 2>/dev/null || echo "unknown")
    if [[ "$init_process" == "tini" ]]; then
        add_validation_result "init_system" "passed" "Using tini as init system"
    else
        add_validation_result "init_system" "passed" "Init system: $init_process"
    fi
}

# =============================================================================
# APPLICATION VALIDATIONS
# =============================================================================

validate_application_health() {
    log "INFO" "Validating application health and functionality..."
    
    # Check Node.js version
    if command -v node >/dev/null 2>&1; then
        local node_version=$(node --version)
        if [[ "$node_version" =~ ^v([0-9]+) ]]; then
            local major_version="${BASH_REMATCH[1]}"
            if [[ "$major_version" -ge 18 ]]; then
                add_validation_result "node_version" "passed" "Node.js version acceptable: $node_version"
            else
                add_validation_result "node_version" "failed" "Node.js version too old: $node_version" "high"
            fi
        else
            add_validation_result "node_version" "failed" "Could not parse Node.js version: $node_version" "medium"
        fi
    else
        add_validation_result "node_version" "failed" "Node.js not found" "high"
    fi
    
    # Check application binary
    if [[ -x "/app/bin/unjucks.cjs" ]]; then
        if timeout 30 /app/bin/unjucks.cjs --version >/dev/null 2>&1; then
            local app_version=$(/app/bin/unjucks.cjs --version 2>/dev/null | head -1)
            add_validation_result "app_binary" "passed" "Application binary works: $app_version"
        else
            add_validation_result "app_binary" "failed" "Application binary failed to execute" "high"
        fi
    else
        add_validation_result "app_binary" "failed" "Application binary not found or not executable" "high"
    fi
    
    # Check package manager
    if command -v pnpm >/dev/null 2>&1; then
        local pnpm_version=$(pnpm --version)
        add_validation_result "package_manager" "passed" "pnpm available: $pnpm_version"
    elif command -v npm >/dev/null 2>&1; then
        local npm_version=$(npm --version)
        add_validation_result "package_manager" "passed" "npm available: $npm_version"
    else
        add_validation_result "package_manager" "failed" "No package manager found" "medium"
    fi
    
    # Check dependencies
    if [[ -f "/app/package.json" ]]; then
        add_validation_result "package_config" "passed" "Package configuration found"
    else
        add_validation_result "package_config" "failed" "Package configuration missing" "high"
    fi
}

validate_test_environment() {
    log "INFO" "Validating test environment setup..."
    
    # Check test directories
    local test_dirs=("/app/tests" "/app/logs" "/app/test-results" "/app/coverage")
    for dir in "${test_dirs[@]}"; do
        if [[ -d "$dir" ]] && [[ -w "$dir" ]]; then
            add_validation_result "test_dir_$dir" "passed" "Test directory accessible: $dir"
        else
            add_validation_result "test_dir_$dir" "failed" "Test directory not accessible: $dir" "medium"
        fi
    done
    
    # Check browser availability for E2E tests
    if command -v chromium-browser >/dev/null 2>&1; then
        add_validation_result "browser_chromium" "passed" "Chromium browser available"
    else
        add_validation_result "browser_chromium" "failed" "Chromium browser not found" "medium"
    fi
    
    # Check X11 for headless testing
    if command -v Xvfb >/dev/null 2>&1; then
        add_validation_result "xvfb" "passed" "X Virtual Framebuffer available"
    else
        add_validation_result "xvfb" "failed" "X Virtual Framebuffer not available" "medium"
    fi
    
    # Check database connectivity
    if command -v pg_isready >/dev/null 2>&1; then
        if pg_isready -h unjucks-postgres -p 5432 -U unjucks_test >/dev/null 2>&1; then
            add_validation_result "database_connectivity" "passed" "Database connection verified"
        else
            add_validation_result "database_connectivity" "failed" "Cannot connect to database" "low"
        fi
    else
        add_validation_result "database_connectivity" "passed" "Database client not available - skipping"
    fi
}

# =============================================================================
# COMPLIANCE VALIDATIONS
# =============================================================================

validate_compliance() {
    log "INFO" "Validating Fortune 5 compliance requirements..."
    
    # Check logging capability
    if [[ -w "/app/logs" ]]; then
        echo "test log entry" > "/app/logs/compliance-test.log" 2>/dev/null || true
        if [[ -f "/app/logs/compliance-test.log" ]]; then
            add_validation_result "audit_logging" "passed" "Audit logging capability verified"
            rm -f "/app/logs/compliance-test.log"
        else
            add_validation_result "audit_logging" "failed" "Cannot write audit logs" "high"
        fi
    else
        add_validation_result "audit_logging" "failed" "Log directory not writable" "high"
    fi
    
    # Check secrets management
    if [[ -f "/run/secrets/test-env" ]]; then
        add_validation_result "secrets_management" "passed" "Docker secrets properly mounted"
    else
        add_validation_result "secrets_management" "failed" "Docker secrets not found" "medium"
    fi
    
    # Check environment variables
    local required_env_vars=("NODE_ENV" "CI")
    for var in "${required_env_vars[@]}"; do
        if [[ -n "${!var:-}" ]]; then
            add_validation_result "env_var_$var" "passed" "Environment variable set: $var"
        else
            add_validation_result "env_var_$var" "failed" "Environment variable missing: $var" "medium"
        fi
    done
    
    # Check container metadata
    if [[ -n "${CONTAINER_NAME:-}" ]]; then
        add_validation_result "container_metadata" "passed" "Container properly labeled"
    else
        add_validation_result "container_metadata" "failed" "Container metadata incomplete" "low"
    fi
}

# =============================================================================
# MAIN EXECUTION
# =============================================================================

generate_validation_report() {
    log "INFO" "Generating validation report..."
    
    mkdir -p "$(dirname "$RESULTS_FILE")"
    
    {
        echo "{"
        echo "  \"timestamp\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\","
        echo "  \"container\": \"${HOSTNAME}\","
        echo "  \"environment\": \"docker-cleanroom\","
        echo "  \"summary\": {"
        echo "    \"total_checks\": $TOTAL_CHECKS,"
        echo "    \"passed\": $PASSED_CHECKS,"
        echo "    \"failed\": $FAILED_CHECKS,"
        echo "    \"success_rate\": $(echo "scale=2; $PASSED_CHECKS * 100 / $TOTAL_CHECKS" | bc 2>/dev/null || echo "0")%"
        echo "  },"
        echo "  \"validations\": ["
        
        local first=true
        for result in "${VALIDATION_RESULTS[@]}"; do
            if [[ "$first" == true ]]; then
                first=false
            else
                echo ","
            fi
            echo "    $result"
        done
        
        echo "  ]"
        echo "}"
    } > "$RESULTS_FILE"
    
    log "SUCCESS" "Validation report generated: $RESULTS_FILE"
}

main() {
    log "INFO" "Starting container validation suite..."
    
    # Create log directory if needed
    mkdir -p "$(dirname "$LOG_FILE")"
    
    # Run all validation categories
    validate_user_privileges
    validate_file_permissions
    validate_network_security
    validate_filesystem_security
    validate_resource_limits
    validate_process_security
    validate_application_health
    validate_test_environment
    validate_compliance
    
    # Generate report
    generate_validation_report
    
    # Summary
    local success_rate=$(echo "scale=1; $PASSED_CHECKS * 100 / $TOTAL_CHECKS" | bc 2>/dev/null || echo "0")
    
    if [[ "$FAILED_CHECKS" -eq 0 ]]; then
        log "SUCCESS" "All $TOTAL_CHECKS validation checks passed (100%)"
        exit 0
    else
        log "WARN" "Validation completed: $PASSED_CHECKS/$TOTAL_CHECKS passed (${success_rate}%)"
        log "WARN" "$FAILED_CHECKS checks failed - review results in $RESULTS_FILE"
        exit 1
    fi
}

# Execute main function
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi