#!/bin/bash
# Security Scanning Script
# Comprehensive security testing for Unjucks application

set -euo pipefail

# Configuration
SCAN_TARGET=${SCAN_TARGET:-"http://app-test:3000"}
SECURITY_LEVEL=${SECURITY_LEVEL:-"comprehensive"}
RESULTS_DIR="/app/security-reports"
TIMESTAMP=$(date -u +"%Y%m%d_%H%M%S")

# Create results directory
mkdir -p "$RESULTS_DIR"

# Security scan log
SECURITY_LOG="$RESULTS_DIR/security-scan-$TIMESTAMP.log"
echo "Security Scanning Started at $(date)" > "$SECURITY_LOG"

# Dependency vulnerability scanning
scan_dependencies() {
    echo "Scanning dependencies for vulnerabilities..." | tee -a "$SECURITY_LOG"
    
    local output_file="$RESULTS_DIR/dependency-scan-$TIMESTAMP.json"
    
    # NPM audit
    echo "Running npm audit..." | tee -a "$SECURITY_LOG"
    npm audit --json > "$output_file" 2>&1 || true
    
    # Snyk scan if available
    if command -v snyk >/dev/null 2>&1; then
        echo "Running Snyk scan..." | tee -a "$SECURITY_LOG"
        snyk test --json > "$RESULTS_DIR/snyk-scan-$TIMESTAMP.json" 2>&1 || true
    fi
    
    echo "Dependency scan completed: $output_file" | tee -a "$SECURITY_LOG"
}

# Static code analysis
static_code_analysis() {
    echo "Running static code analysis..." | tee -a "$SECURITY_LOG"
    
    local output_dir="$RESULTS_DIR/static-analysis-$TIMESTAMP"
    mkdir -p "$output_dir"
    
    # ESLint security rules
    if [[ -f "/app/.eslintrc.security.js" ]]; then
        echo "Running ESLint security analysis..." | tee -a "$SECURITY_LOG"
        eslint /app/src --config /app/.eslintrc.security.js \
            --format json \
            --output-file "$output_dir/eslint-security.json" 2>&1 || true
    fi
    
    # Semgrep security scan if available
    if command -v semgrep >/dev/null 2>&1; then
        echo "Running Semgrep security scan..." | tee -a "$SECURITY_LOG"
        semgrep --config=auto --json --output="$output_dir/semgrep-security.json" /app/src 2>&1 || true
    fi
    
    echo "Static code analysis completed: $output_dir" | tee -a "$SECURITY_LOG"
}

# Web application security testing
web_security_scan() {
    echo "Running web application security scan..." | tee -a "$SECURITY_LOG"
    
    local output_dir="$RESULTS_DIR/web-security-$TIMESTAMP"
    mkdir -p "$output_dir"
    
    # Wait for application to be ready
    wait_for_app
    
    # Basic security headers check
    echo "Checking security headers..." | tee -a "$SECURITY_LOG"
    curl -I "$SCAN_TARGET" > "$output_dir/headers.txt" 2>&1 || true
    
    # Common vulnerability checks
    check_common_vulnerabilities "$output_dir"
    
    # SSL/TLS configuration check (if HTTPS)
    if [[ "$SCAN_TARGET" == https* ]]; then
        echo "Checking SSL/TLS configuration..." | tee -a "$SECURITY_LOG"
        check_ssl_configuration "$output_dir"
    fi
    
    echo "Web security scan completed: $output_dir" | tee -a "$SECURITY_LOG"
}

check_common_vulnerabilities() {
    local output_dir="$1"
    local vulns_file="$output_dir/vulnerability-checks.json"
    
    # Initialize results
    cat > "$vulns_file" <<EOF
{
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "target": "$SCAN_TARGET",
  "checks": {}
}
EOF

    # XSS Protection
    echo "Checking XSS protection..." | tee -a "$SECURITY_LOG"
    local xss_header=$(curl -s -I "$SCAN_TARGET" | grep -i "x-xss-protection" || echo "missing")
    jq --arg xss "$xss_header" '.checks.xss_protection = $xss' "$vulns_file" > "$vulns_file.tmp" && mv "$vulns_file.tmp" "$vulns_file"
    
    # Content Security Policy
    echo "Checking Content Security Policy..." | tee -a "$SECURITY_LOG"
    local csp_header=$(curl -s -I "$SCAN_TARGET" | grep -i "content-security-policy" || echo "missing")
    jq --arg csp "$csp_header" '.checks.content_security_policy = $csp' "$vulns_file" > "$vulns_file.tmp" && mv "$vulns_file.tmp" "$vulns_file"
    
    # HSTS
    echo "Checking HSTS..." | tee -a "$SECURITY_LOG"
    local hsts_header=$(curl -s -I "$SCAN_TARGET" | grep -i "strict-transport-security" || echo "missing")
    jq --arg hsts "$hsts_header" '.checks.hsts = $hsts' "$vulns_file" > "$vulns_file.tmp" && mv "$vulns_file.tmp" "$vulns_file"
    
    # X-Frame-Options
    echo "Checking X-Frame-Options..." | tee -a "$SECURITY_LOG"
    local frame_header=$(curl -s -I "$SCAN_TARGET" | grep -i "x-frame-options" || echo "missing")
    jq --arg frame "$frame_header" '.checks.x_frame_options = $frame' "$vulns_file" > "$vulns_file.tmp" && mv "$vulns_file.tmp" "$vulns_file"
    
    # X-Content-Type-Options
    echo "Checking X-Content-Type-Options..." | tee -a "$SECURITY_LOG"
    local content_type_header=$(curl -s -I "$SCAN_TARGET" | grep -i "x-content-type-options" || echo "missing")
    jq --arg ct "$content_type_header" '.checks.x_content_type_options = $ct' "$vulns_file" > "$vulns_file.tmp" && mv "$vulns_file.tmp" "$vulns_file"
    
    # Information disclosure
    echo "Checking for information disclosure..." | tee -a "$SECURITY_LOG"
    local server_header=$(curl -s -I "$SCAN_TARGET" | grep -i "server:" || echo "not disclosed")
    jq --arg server "$server_header" '.checks.server_disclosure = $server' "$vulns_file" > "$vulns_file.tmp" && mv "$vulns_file.tmp" "$vulns_file"
    
    # Try common paths for sensitive files
    local sensitive_paths=(
        "/.env"
        "/package.json"
        "/.git/config"
        "/admin"
        "/api/admin"
        "/debug"
    )
    
    local accessible_paths=()
    for path in "${sensitive_paths[@]}"; do
        local status_code=$(curl -s -o /dev/null -w "%{http_code}" "$SCAN_TARGET$path" || echo "000")
        if [[ "$status_code" == "200" ]]; then
            accessible_paths+=("$path")
        fi
    done
    
    local accessible_json=$(printf '%s\n' "${accessible_paths[@]}" | jq -R . | jq -s .)
    jq --argjson paths "$accessible_json" '.checks.accessible_sensitive_paths = $paths' "$vulns_file" > "$vulns_file.tmp" && mv "$vulns_file.tmp" "$vulns_file"
}

check_ssl_configuration() {
    local output_dir="$1"
    local ssl_file="$output_dir/ssl-check.txt"
    
    # Extract hostname from URL
    local hostname=$(echo "$SCAN_TARGET" | sed 's|https://||' | sed 's|/.*||')
    
    # Basic SSL check using openssl
    echo "Checking SSL certificate..." | tee -a "$SECURITY_LOG"
    echo | openssl s_client -connect "$hostname:443" -servername "$hostname" 2>&1 > "$ssl_file" || true
    
    # Check for weak ciphers
    echo "Checking for weak ciphers..." | tee -a "$SECURITY_LOG"
    openssl s_client -connect "$hostname:443" -cipher 'LOW:EXPORT' < /dev/null 2>&1 | grep -E "(Cipher|Protocol)" >> "$ssl_file" || true
}

# License compliance check
license_compliance_check() {
    echo "Checking license compliance..." | tee -a "$SECURITY_LOG"
    
    local output_file="$RESULTS_DIR/license-compliance-$TIMESTAMP.json"
    
    # Use licensee if available
    if command -v licensee >/dev/null 2>&1; then
        echo "Running licensee scan..." | tee -a "$SECURITY_LOG"
        licensee detect /app --json > "$output_file" 2>&1 || true
    else
        # Basic license check
        echo "Basic license check..." | tee -a "$SECURITY_LOG"
        cat > "$output_file" <<EOF
{
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "status": "basic_check",
  "licenses_found": []
}
EOF
        
        # Look for LICENSE files
        find /app -name "LICENSE*" -o -name "COPYING*" | while read -r license_file; do
            if [[ -f "$license_file" ]]; then
                local license_content=$(head -10 "$license_file" | tr '\n' ' ')
                jq --arg file "$license_file" --arg content "$license_content" \
                   '.licenses_found += [{"file": $file, "content": $content}]' \
                   "$output_file" > "$output_file.tmp" && mv "$output_file.tmp" "$output_file"
            fi
        done
    fi
    
    echo "License compliance check completed: $output_file" | tee -a "$SECURITY_LOG"
}

# Generate security report
generate_security_report() {
    echo "Generating security report..." | tee -a "$SECURITY_LOG"
    
    local report_file="$RESULTS_DIR/security-report-$TIMESTAMP.json"
    local html_report="$RESULTS_DIR/security-report-$TIMESTAMP.html"
    
    # Count vulnerabilities from dependency scan
    local dependency_vulns=0
    local dep_scan_file="$RESULTS_DIR/dependency-scan-$TIMESTAMP.json"
    if [[ -f "$dep_scan_file" ]]; then
        dependency_vulns=$(jq -r '.metadata.vulnerabilities.total // 0' "$dep_scan_file" 2>/dev/null || echo 0)
    fi
    
    # Check security headers
    local security_score=100
    local issues=()
    
    local vuln_check_file="$RESULTS_DIR/web-security-$TIMESTAMP/vulnerability-checks.json"
    if [[ -f "$vuln_check_file" ]]; then
        # Check each security header
        local checks=(
            "xss_protection"
            "content_security_policy"
            "hsts"
            "x_frame_options"
            "x_content_type_options"
        )
        
        for check in "${checks[@]}"; do
            local result=$(jq -r ".checks.$check // \"missing\"" "$vuln_check_file" 2>/dev/null)
            if [[ "$result" == "missing" ]]; then
                security_score=$((security_score - 15))
                issues+=("Missing $check header")
            fi
        done
        
        # Check for accessible sensitive paths
        local accessible_paths=$(jq -r '.checks.accessible_sensitive_paths | length' "$vuln_check_file" 2>/dev/null || echo 0)
        if [[ $accessible_paths -gt 0 ]]; then
            security_score=$((security_score - accessible_paths * 10))
            issues+=("$accessible_paths sensitive paths accessible")
        fi
    fi
    
    # Determine overall security status
    local security_status="high"
    if [[ $security_score -lt 80 ]]; then
        security_status="medium"
    fi
    if [[ $security_score -lt 60 ]]; then
        security_status="low"
    fi
    if [[ $dependency_vulns -gt 0 ]]; then
        security_status="low"
    fi
    
    # Generate JSON report
    local issues_json=$(printf '%s\n' "${issues[@]}" | jq -R . | jq -s .)
    cat > "$report_file" <<EOF
{
  "scan_timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "scan_id": "$TIMESTAMP",
  "target": "$SCAN_TARGET",
  "security_level": "$SECURITY_LEVEL",
  "results": {
    "overall_status": "$security_status",
    "security_score": $security_score,
    "dependency_vulnerabilities": $dependency_vulns,
    "issues_found": $issues_json
  },
  "scans_performed": [
    "dependency_vulnerability_scan",
    "static_code_analysis",
    "web_security_scan",
    "license_compliance_check"
  ],
  "status": "completed"
}
EOF

    # Generate HTML report
    cat > "$html_report" <<EOF
<!DOCTYPE html>
<html>
<head>
    <title>Security Scan Report - $TIMESTAMP</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f4f4f4; padding: 20px; border-radius: 5px; }
        .status-high { color: #28a745; font-weight: bold; }
        .status-medium { color: #ffc107; font-weight: bold; }
        .status-low { color: #dc3545; font-weight: bold; }
        .issue { background: #f8d7da; padding: 10px; margin: 5px 0; border-radius: 3px; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Security Scan Report</h1>
        <p><strong>Scan Time:</strong> $(date)</p>
        <p><strong>Scan ID:</strong> $TIMESTAMP</p>
        <p><strong>Target:</strong> $SCAN_TARGET</p>
        <p><strong>Security Level:</strong> $SECURITY_LEVEL</p>
    </div>
    
    <h2>Security Assessment</h2>
    <table>
        <tr><th>Metric</th><th>Value</th></tr>
        <tr><td>Overall Status</td><td class="status-$security_status">$(echo $security_status | tr '[:lower:]' '[:upper:]')</td></tr>
        <tr><td>Security Score</td><td>$security_score/100</td></tr>
        <tr><td>Dependency Vulnerabilities</td><td>$dependency_vulns</td></tr>
        <tr><td>Issues Found</td><td>${#issues[@]}</td></tr>
    </table>
    
    <h2>Issues Identified</h2>
EOF

    # Add issues to HTML report
    if [[ ${#issues[@]} -gt 0 ]]; then
        for issue in "${issues[@]}"; do
            echo "    <div class=\"issue\">$issue</div>" >> "$html_report"
        done
    else
        echo "    <p>No security issues identified.</p>" >> "$html_report"
    fi
    
    cat >> "$html_report" <<EOF
    
    <h2>Scans Performed</h2>
    <ul>
        <li>Dependency Vulnerability Scan</li>
        <li>Static Code Analysis</li>
        <li>Web Security Scan</li>
        <li>License Compliance Check</li>
    </ul>
</body>
</html>
EOF

    echo "Security report generated: $report_file" | tee -a "$SECURITY_LOG"
    echo "HTML report generated: $html_report" | tee -a "$SECURITY_LOG"
}

# Wait for application to be ready
wait_for_app() {
    echo "Waiting for application to be ready..." | tee -a "$SECURITY_LOG"
    
    local max_attempts=30
    local attempt=1
    
    while [[ $attempt -le $max_attempts ]]; do
        if curl -sf "$SCAN_TARGET/health" >/dev/null 2>&1; then
            echo "Application is ready!" | tee -a "$SECURITY_LOG"
            return 0
        fi
        
        echo "Attempt $attempt/$max_attempts: Application not ready, waiting..." | tee -a "$SECURITY_LOG"
        sleep 10
        ((attempt++))
    done
    
    echo "WARNING: Application not responding, proceeding with available scans" | tee -a "$SECURITY_LOG"
}

# Main security scanning function
main() {
    echo "Starting security scanning suite..." | tee -a "$SECURITY_LOG"
    
    # Run dependency scans (don't require running app)
    scan_dependencies
    static_code_analysis
    license_compliance_check
    
    # Run web security scans (require running app)
    web_security_scan
    
    # Generate final report
    generate_security_report
    
    echo "Security scanning completed" | tee -a "$SECURITY_LOG"
    echo "Results available in: $RESULTS_DIR"
}

# Run main function
main "$@"