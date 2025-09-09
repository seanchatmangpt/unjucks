#!/bin/bash
set -euo pipefail

# Security scanning script for Docker containers
echo "🔒 Starting Security Scan"
echo "========================="

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPORT_DIR="/app/security-reports"
LOG_FILE="${REPORT_DIR}/security-scan.log"

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

# Security scan functions
scan_npm_dependencies() {
    log_info "Scanning npm dependencies for vulnerabilities..."
    
    # npm audit
    if npm audit --audit-level=high --json > "${REPORT_DIR}/npm-audit.json" 2>/dev/null; then
        log_success "npm audit completed successfully"
    else
        log_warning "npm audit found vulnerabilities"
    fi
    
    # Generate human-readable report
    npm audit --audit-level=moderate > "${REPORT_DIR}/npm-audit.txt" 2>/dev/null || true
    
    log_info "npm dependency scan completed"
}

scan_file_permissions() {
    log_info "Scanning file permissions..."
    
    # Check for world-writable files
    find /app -type f -perm -002 2>/dev/null > "${REPORT_DIR}/world-writable-files.txt" || true
    
    # Check for files with setuid/setgid bits
    find /app -type f \( -perm -4000 -o -perm -2000 \) 2>/dev/null > "${REPORT_DIR}/setuid-files.txt" || true
    
    # Check for executable files
    find /app -type f -executable 2>/dev/null > "${REPORT_DIR}/executable-files.txt" || true
    
    log_success "File permission scan completed"
}

scan_sensitive_files() {
    log_info "Scanning for sensitive files..."
    
    # List of sensitive file patterns
    sensitive_patterns=(
        "*.key"
        "*.pem"
        "*.p12"
        "*.pfx"
        ".env*"
        "id_rsa*"
        "id_dsa*"
        "id_ecdsa*"
        "id_ed25519*"
        "*.crt"
        "*.cer"
        "secret*"
        "password*"
        "credential*"
        "token*"
        "api-key*"
    )
    
    echo "# Sensitive Files Found" > "${REPORT_DIR}/sensitive-files.txt"
    for pattern in "${sensitive_patterns[@]}"; do
        echo "## Pattern: $pattern" >> "${REPORT_DIR}/sensitive-files.txt"
        find /app -name "$pattern" -type f 2>/dev/null >> "${REPORT_DIR}/sensitive-files.txt" || true
        echo "" >> "${REPORT_DIR}/sensitive-files.txt"
    done
    
    log_success "Sensitive files scan completed"
}

scan_code_vulnerabilities() {
    log_info "Scanning code for vulnerabilities..."
    
    # Check for common security anti-patterns
    cat > "${REPORT_DIR}/code-security-scan.txt" <<EOF
# Code Security Scan Results

## Hardcoded Secrets Detection
EOF
    
    # Search for potential hardcoded secrets
    grep -r -i "password\s*=" /app/src/ 2>/dev/null | head -10 >> "${REPORT_DIR}/code-security-scan.txt" || echo "No hardcoded passwords found" >> "${REPORT_DIR}/code-security-scan.txt"
    grep -r -i "api[_-]?key\s*=" /app/src/ 2>/dev/null | head -10 >> "${REPORT_DIR}/code-security-scan.txt" || echo "No hardcoded API keys found" >> "${REPORT_DIR}/code-security-scan.txt"
    grep -r -i "secret\s*=" /app/src/ 2>/dev/null | head -10 >> "${REPORT_DIR}/code-security-scan.txt" || echo "No hardcoded secrets found" >> "${REPORT_DIR}/code-security-scan.txt"
    
    echo "" >> "${REPORT_DIR}/code-security-scan.txt"
    echo "## Dangerous Function Usage" >> "${REPORT_DIR}/code-security-scan.txt"
    
    # Check for dangerous functions
    grep -r "eval(" /app/src/ 2>/dev/null | head -10 >> "${REPORT_DIR}/code-security-scan.txt" || echo "No eval() usage found" >> "${REPORT_DIR}/code-security-scan.txt"
    grep -r "exec(" /app/src/ 2>/dev/null | head -10 >> "${REPORT_DIR}/code-security-scan.txt" || echo "No exec() usage found" >> "${REPORT_DIR}/code-security-scan.txt"
    grep -r "child_process" /app/src/ 2>/dev/null | head -10 >> "${REPORT_DIR}/code-security-scan.txt" || echo "No child_process usage found" >> "${REPORT_DIR}/code-security-scan.txt"
    
    log_success "Code vulnerability scan completed"
}

scan_container_security() {
    log_info "Scanning container security configuration..."
    
    cat > "${REPORT_DIR}/container-security.txt" <<EOF
# Container Security Analysis

## User Information
Current user: $(whoami)
User ID: $(id)

## Process Information
EOF
    
    # Check running processes
    ps aux >> "${REPORT_DIR}/container-security.txt" 2>/dev/null || true
    
    echo "" >> "${REPORT_DIR}/container-security.txt"
    echo "## Network Information" >> "${REPORT_DIR}/container-security.txt"
    
    # Check network configuration
    if command -v netstat >/dev/null 2>&1; then
        netstat -tulpn >> "${REPORT_DIR}/container-security.txt" 2>/dev/null || true
    fi
    
    echo "" >> "${REPORT_DIR}/container-security.txt"
    echo "## Environment Variables" >> "${REPORT_DIR}/container-security.txt"
    
    # Check environment variables (mask sensitive ones)
    env | grep -E "(PATH|NODE|npm)" >> "${REPORT_DIR}/container-security.txt" || true
    
    log_success "Container security scan completed"
}

generate_security_report() {
    log_info "Generating security report..."
    
    # Count findings
    npm_issues=$(jq '.metadata.vulnerabilities.total // 0' "${REPORT_DIR}/npm-audit.json" 2>/dev/null || echo "0")
    world_writable=$(wc -l < "${REPORT_DIR}/world-writable-files.txt" 2>/dev/null || echo "0")
    setuid_files=$(wc -l < "${REPORT_DIR}/setuid-files.txt" 2>/dev/null || echo "0")
    
    # Generate JSON report
    cat > "${REPORT_DIR}/security-summary.json" <<EOF
{
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "scan_results": {
        "npm_vulnerabilities": $npm_issues,
        "world_writable_files": $world_writable,
        "setuid_files": $setuid_files,
        "sensitive_files_checked": true,
        "code_scan_completed": true,
        "container_scan_completed": true
    },
    "security_score": $(( 100 - npm_issues - world_writable * 10 - setuid_files * 20 )),
    "status": "completed"
}
EOF
    
    # Generate Markdown report
    cat > "${REPORT_DIR}/security-summary.md" <<EOF
# Security Scan Report

**Generated:** $(date -u +%Y-%m-%dT%H:%M:%SZ)

## Summary
- npm vulnerabilities: $npm_issues
- World-writable files: $world_writable
- Setuid/setgid files: $setuid_files

## Scan Results
- ✅ npm dependency scan
- ✅ File permission scan
- ✅ Sensitive files scan
- ✅ Code vulnerability scan
- ✅ Container security scan

## Recommendations
$(if [ "$npm_issues" -gt 0 ]; then echo "- Review and fix npm vulnerabilities"; fi)
$(if [ "$world_writable" -gt 0 ]; then echo "- Fix world-writable file permissions"; fi)
$(if [ "$setuid_files" -gt 0 ]; then echo "- Review setuid/setgid files"; fi)

See detailed scan results in individual report files.
EOF
    
    log_success "Security report generated"
}

# Main security scan sequence
main() {
    log_info "Starting comprehensive security scan..."
    
    scan_npm_dependencies
    scan_file_permissions
    scan_sensitive_files
    scan_code_vulnerabilities
    scan_container_security
    generate_security_report
    
    log_success "🔒 Security scan completed!"
    log_info "Reports available in: ${REPORT_DIR}"
    
    # Display summary
    if [[ -f "${REPORT_DIR}/security-summary.json" ]]; then
        security_score=$(jq '.security_score' "${REPORT_DIR}/security-summary.json")
        log_info "Security Score: $security_score/100"
        
        if [[ $security_score -lt 80 ]]; then
            log_warning "Security score below recommended threshold (80)"
            exit 1
        else
            log_success "Security scan passed with score: $security_score"
        fi
    fi
}

# Run main function
main "$@"