#!/bin/bash
# Cleanroom Validation Script - Container Specialist #3
# Zero-dependency isolation verification

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
VALIDATION_REPORT="$PROJECT_ROOT/validation-report.json"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Validation results
VALIDATIONS=()
PASSED=0
FAILED=0
WARNINGS=0

log() {
    echo -e "${BLUE}[VALIDATE]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
    ((PASSED++))
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
    ((WARNINGS++))
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    ((FAILED++))
}

add_validation() {
    local name="$1"
    local status="$2"
    local message="$3"
    local details="${4:-}"
    
    VALIDATIONS+=("$(cat <<EOF
{
  "name": "$name",
  "status": "$status",
  "message": "$message",
  "details": "$details",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF
)")
}

validate_docker_environment() {
    log "Validating Docker environment..."
    
    if ! command -v docker &> /dev/null; then
        error "Docker not installed"
        add_validation "Docker Installation" "FAIL" "Docker command not found" ""
        return 1
    fi
    
    if ! docker info &> /dev/null; then
        error "Docker daemon not running"
        add_validation "Docker Daemon" "FAIL" "Docker daemon is not accessible" ""
        return 1
    fi
    
    local docker_version
    docker_version=$(docker --version)
    success "Docker environment ready: $docker_version"
    add_validation "Docker Environment" "PASS" "Docker is installed and running" "$docker_version"
    
    # Check Docker Compose
    if command -v docker-compose &> /dev/null; then
        local compose_version
        compose_version=$(docker-compose --version)
        success "Docker Compose available: $compose_version"
        add_validation "Docker Compose" "PASS" "Docker Compose is available" "$compose_version"
    else
        warning "Docker Compose not found"
        add_validation "Docker Compose" "WARN" "Docker Compose not available" ""
    fi
}

validate_project_structure() {
    log "Validating project structure..."
    
    local required_files=(
        "package.json"
        "src/cli/index.js"
        "bin/unjucks.cjs"
        "docker/Dockerfile.production"
        "docker/docker-compose.test.yml"
        "docker/scripts/cleanroom-test-suite.sh"
    )
    
    local missing_files=()
    
    for file in "${required_files[@]}"; do
        if [[ ! -f "$PROJECT_ROOT/$file" ]]; then
            missing_files+=("$file")
        fi
    done
    
    if [[ ${#missing_files[@]} -eq 0 ]]; then
        success "All required files present"
        add_validation "Project Structure" "PASS" "All required files found" "$(printf '%s, ' "${required_files[@]}")"
    else
        error "Missing required files: ${missing_files[*]}"
        add_validation "Project Structure" "FAIL" "Missing required files" "$(printf '%s, ' "${missing_files[@]}")"
        return 1
    fi
}

validate_dockerfile() {
    log "Validating Dockerfile..."
    
    local dockerfile="$PROJECT_ROOT/docker/Dockerfile.production"
    
    if [[ ! -f "$dockerfile" ]]; then
        error "Dockerfile not found"
        add_validation "Dockerfile" "FAIL" "Dockerfile.production not found" ""
        return 1
    fi
    
    # Check for multi-stage build
    if grep -q "FROM.*AS" "$dockerfile"; then
        success "Multi-stage Dockerfile detected"
    else
        warning "Single-stage Dockerfile - multi-stage recommended"
    fi
    
    # Check for security practices
    local security_checks=(
        "USER.*unjucks:Running as non-root user"
        "COPY.*--chown:Proper file ownership"
        "apk.*upgrade:Security updates applied"
        "npm audit:Security audit performed"
    )
    
    local security_score=0
    local total_checks=${#security_checks[@]}
    
    for check in "${security_checks[@]}"; do
        IFS=':' read -r pattern description <<< "$check"
        if grep -q "$pattern" "$dockerfile"; then
            success "Security check passed: $description"
            ((security_score++))
        else
            warning "Security check missing: $description"
        fi
    done
    
    local security_percentage=$((security_score * 100 / total_checks))
    
    if [[ $security_percentage -ge 75 ]]; then
        success "Dockerfile security: $security_percentage% ($security_score/$total_checks)"
        add_validation "Dockerfile Security" "PASS" "Good security practices" "$security_percentage% compliance"
    else
        warning "Dockerfile security: $security_percentage% - improvement needed"
        add_validation "Dockerfile Security" "WARN" "Security practices need improvement" "$security_percentage% compliance"
    fi
}

validate_docker_compose() {
    log "Validating Docker Compose configuration..."
    
    local compose_file="$PROJECT_ROOT/docker/docker-compose.test.yml"
    
    if [[ ! -f "$compose_file" ]]; then
        error "Docker Compose file not found"
        add_validation "Docker Compose File" "FAIL" "docker-compose.test.yml not found" ""
        return 1
    fi
    
    # Validate YAML syntax
    if command -v docker-compose &> /dev/null; then
        if docker-compose -f "$compose_file" config > /dev/null 2>&1; then
            success "Docker Compose syntax valid"
            add_validation "Compose Syntax" "PASS" "YAML syntax is valid" ""
        else
            error "Docker Compose syntax invalid"
            add_validation "Compose Syntax" "FAIL" "YAML syntax errors detected" ""
            return 1
        fi
    fi
    
    # Check for required services
    local required_services=(
        "unit-test"
        "integration-test"
        "e2e-test"
        "security-test"
        "production-validation"
    )
    
    local missing_services=()
    
    for service in "${required_services[@]}"; do
        if ! grep -q "^  $service:" "$compose_file"; then
            missing_services+=("$service")
        fi
    done
    
    if [[ ${#missing_services[@]} -eq 0 ]]; then
        success "All test services defined"
        add_validation "Test Services" "PASS" "All required test services found" "$(printf '%s, ' "${required_services[@]}")"
    else
        error "Missing test services: ${missing_services[*]}"
        add_validation "Test Services" "FAIL" "Missing test services" "$(printf '%s, ' "${missing_services[@]}")"
    fi
    
    # Check for health checks
    if grep -q "healthcheck:" "$compose_file"; then
        success "Health checks configured"
        add_validation "Health Checks" "PASS" "Health checks are configured" ""
    else
        warning "No health checks found"
        add_validation "Health Checks" "WARN" "Health checks not configured" ""
    fi
}

validate_test_isolation() {
    log "Validating test isolation setup..."
    
    # Check for network isolation
    local compose_file="$PROJECT_ROOT/docker/docker-compose.test.yml"
    
    if grep -q "networks:" "$compose_file"; then
        success "Network isolation configured"
        add_validation "Network Isolation" "PASS" "Custom networks defined" ""
    else
        warning "Default network - isolation not guaranteed"
        add_validation "Network Isolation" "WARN" "Using default Docker network" ""
    fi
    
    # Check for volume isolation
    if grep -q "volumes:" "$compose_file"; then
        success "Volume isolation configured"
        add_validation "Volume Isolation" "PASS" "Named volumes defined" ""
    else
        warning "No named volumes - data persistence unclear"
        add_validation "Volume Isolation" "WARN" "No named volumes defined" ""
    fi
    
    # Check for resource limits
    if grep -q "mem_limit:\|cpus:" "$compose_file"; then
        success "Resource limits configured"
        add_validation "Resource Limits" "PASS" "Memory and CPU limits set" ""
    else
        warning "No resource limits - containers may consume excessive resources"
        add_validation "Resource Limits" "WARN" "No resource limits configured" ""
    fi
}

validate_security_hardening() {
    log "Validating security hardening..."
    
    local dockerfile="$PROJECT_ROOT/docker/Dockerfile.production"
    local security_features=0
    
    # Check for non-root user
    if grep -q "USER unjucks" "$dockerfile"; then
        success "Non-root user configured"
        ((security_features++))
    else
        warning "Running as root user"
    fi
    
    # Check for minimal base image
    if grep -q "alpine" "$dockerfile"; then
        success "Minimal Alpine base image"
        ((security_features++))
    else
        warning "Not using minimal base image"
    fi
    
    # Check for security updates
    if grep -q "apk upgrade" "$dockerfile"; then
        success "Security updates applied"
        ((security_features++))
    else
        warning "Security updates not explicitly applied"
    fi
    
    # Check for dependency security
    if grep -q "npm audit" "$dockerfile"; then
        success "Dependency security audit"
        ((security_features++))
    else
        warning "No dependency security audit"
    fi
    
    local security_score=$((security_features * 100 / 4))
    
    if [[ $security_score -ge 75 ]]; then
        success "Security hardening: $security_score%"
        add_validation "Security Hardening" "PASS" "Good security hardening" "$security_score% features implemented"
    else
        warning "Security hardening: $security_score% - needs improvement"
        add_validation "Security Hardening" "WARN" "Security hardening incomplete" "$security_score% features implemented"
    fi
}

validate_monitoring_setup() {
    log "Validating monitoring setup..."
    
    # Check for monitoring scripts
    local monitoring_files=(
        "docker/health/healthcheck.js"
        "docker/monitoring/metrics-collector.js"
    )
    
    local found_files=0
    
    for file in "${monitoring_files[@]}"; do
        if [[ -f "$PROJECT_ROOT/$file" ]]; then
            success "Monitoring component found: $file"
            ((found_files++))
        else
            warning "Monitoring component missing: $file"
        fi
    done
    
    if [[ $found_files -eq ${#monitoring_files[@]} ]]; then
        add_validation "Monitoring Setup" "PASS" "All monitoring components present" "$found_files/${#monitoring_files[@]} components"
    else
        add_validation "Monitoring Setup" "WARN" "Some monitoring components missing" "$found_files/${#monitoring_files[@]} components"
    fi
}

test_docker_build() {
    log "Testing Docker build (dry run)..."
    
    cd "$PROJECT_ROOT"
    
    # Test if Dockerfile can be parsed
    if docker build --no-cache --dry-run -f docker/Dockerfile.production . > /dev/null 2>&1; then
        success "Dockerfile build test passed"
        add_validation "Docker Build Test" "PASS" "Dockerfile can be built successfully" ""
    else
        error "Dockerfile build test failed"
        add_validation "Docker Build Test" "FAIL" "Dockerfile has build errors" ""
    fi
}

generate_report() {
    log "Generating validation report..."
    
    # Create JSON report
    cat > "$VALIDATION_REPORT" << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "environment": {
    "os": "$(uname -s)",
    "arch": "$(uname -m)",
    "docker": "$(docker --version 2>/dev/null || echo 'Not available')",
    "dockerCompose": "$(docker-compose --version 2>/dev/null || echo 'Not available')"
  },
  "summary": {
    "total": $((PASSED + FAILED + WARNINGS)),
    "passed": $PASSED,
    "failed": $FAILED,
    "warnings": $WARNINGS,
    "status": "$([ $FAILED -eq 0 ] && echo 'PASS' || echo 'FAIL')"
  },
  "validations": [
$(IFS=','; echo "${VALIDATIONS[*]}")
  ]
}
EOF

    success "Validation report generated: $VALIDATION_REPORT"
}

print_summary() {
    echo
    echo "═══════════════════════════════════════════"
    echo "         CLEANROOM VALIDATION SUMMARY"
    echo "═══════════════════════════════════════════"
    echo
    echo "✅ Passed:    $PASSED"
    echo "⚠️  Warnings: $WARNINGS"
    echo "❌ Failed:    $FAILED"
    echo "📊 Total:     $((PASSED + FAILED + WARNINGS))"
    echo
    
    if [[ $FAILED -eq 0 ]]; then
        echo -e "${GREEN}🎉 VALIDATION PASSED${NC}"
        echo "Cleanroom environment is ready for testing!"
    else
        echo -e "${RED}❌ VALIDATION FAILED${NC}"
        echo "Issues must be resolved before testing."
    fi
    
    echo
    echo "📄 Report: $VALIDATION_REPORT"
    echo "═══════════════════════════════════════════"
}

main() {
    echo "🔍 Cleanroom Validation Starting..."
    echo "Project: $(basename "$PROJECT_ROOT")"
    echo "Time: $(date)"
    echo "─────────────────────────────────────────"
    
    validate_docker_environment
    validate_project_structure
    validate_dockerfile
    validate_docker_compose
    validate_test_isolation
    validate_security_hardening
    validate_monitoring_setup
    
    # Only run build test if Docker is available
    if command -v docker &> /dev/null && docker info &> /dev/null; then
        test_docker_build
    fi
    
    generate_report
    print_summary
    
    # Exit with appropriate code
    exit $FAILED
}

# Run validation
main "$@"