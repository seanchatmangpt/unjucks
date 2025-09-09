#!/bin/bash
# Docker Testing Environment Validation Script
# Validates the complete testing environment in cleanroom conditions

set -euo pipefail

# Configuration
COMPOSE_FILE="/Users/sac/unjucks/docker/docker-compose.testing.yml"
ENV_FILE="/Users/sac/unjucks/docker/.env.testing"
VALIDATION_LOG="/tmp/validation-$(date +%Y%m%d_%H%M%S).log"
VALIDATION_RESULTS="/tmp/validation-results.json"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${timestamp} [${level}] ${message}" | tee -a "$VALIDATION_LOG"
}

log_info() { log "${BLUE}INFO${NC}" "$@"; }
log_warn() { log "${YELLOW}WARN${NC}" "$@"; }
log_error() { log "${RED}ERROR${NC}" "$@"; }
log_success() { log "${GREEN}SUCCESS${NC}" "$@"; }

# Initialize validation results
initialize_results() {
    cat > "$VALIDATION_RESULTS" <<EOF
{
  "validation_timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "validation_id": "$(date +%Y%m%d_%H%M%S)",
  "environment": "testing",
  "status": "in_progress",
  "checks": {},
  "summary": {
    "total_checks": 0,
    "passed_checks": 0,
    "failed_checks": 0,
    "warnings": 0
  }
}
EOF
}

# Update validation results
update_result() {
    local check_name="$1"
    local status="$2"
    local message="$3"
    local details="${4:-{}}"
    
    jq --arg name "$check_name" \
       --arg status "$status" \
       --arg message "$message" \
       --argjson details "$details" \
       '.checks[$name] = {
         "status": $status,
         "message": $message,
         "details": $details,
         "timestamp": now | strftime("%Y-%m-%dT%H:%M:%SZ")
       }' "$VALIDATION_RESULTS" > "$VALIDATION_RESULTS.tmp" && mv "$VALIDATION_RESULTS.tmp" "$VALIDATION_RESULTS"
    
    # Update summary
    case "$status" in
        "passed")
            jq '.summary.passed_checks += 1 | .summary.total_checks += 1' "$VALIDATION_RESULTS" > "$VALIDATION_RESULTS.tmp" && mv "$VALIDATION_RESULTS.tmp" "$VALIDATION_RESULTS"
            ;;
        "failed")
            jq '.summary.failed_checks += 1 | .summary.total_checks += 1' "$VALIDATION_RESULTS" > "$VALIDATION_RESULTS.tmp" && mv "$VALIDATION_RESULTS.tmp" "$VALIDATION_RESULTS"
            ;;
        "warning")
            jq '.summary.warnings += 1 | .summary.total_checks += 1' "$VALIDATION_RESULTS" > "$VALIDATION_RESULTS.tmp" && mv "$VALIDATION_RESULTS.tmp" "$VALIDATION_RESULTS"
            ;;
    esac
}

# Pre-validation checks
pre_validation_checks() {
    log_info "Starting pre-validation checks..."
    
    # Check if Docker is running
    if ! docker info >/dev/null 2>&1; then
        log_error "Docker is not running or accessible"
        update_result "docker_availability" "failed" "Docker is not running or accessible"
        exit 1
    fi
    log_success "Docker is running and accessible"
    update_result "docker_availability" "passed" "Docker is running and accessible"
    
    # Check Docker Compose version
    if ! docker compose version >/dev/null 2>&1; then
        log_error "Docker Compose is not available or version is too old"
        update_result "docker_compose_version" "failed" "Docker Compose is not available"
        exit 1
    fi
    local compose_version=$(docker compose version --short)
    log_success "Docker Compose version: $compose_version"
    update_result "docker_compose_version" "passed" "Docker Compose version: $compose_version" "{\"version\": \"$compose_version\"}"
    
    # Check if compose file exists
    if [[ ! -f "$COMPOSE_FILE" ]]; then
        log_error "Docker Compose file not found: $COMPOSE_FILE"
        update_result "compose_file_exists" "failed" "Docker Compose file not found"
        exit 1
    fi
    log_success "Docker Compose file found: $COMPOSE_FILE"
    update_result "compose_file_exists" "passed" "Docker Compose file found"
    
    # Check if environment file exists
    if [[ ! -f "$ENV_FILE" ]]; then
        log_warn "Environment file not found: $ENV_FILE (will use defaults)"
        update_result "env_file_exists" "warning" "Environment file not found, using defaults"
    else
        log_success "Environment file found: $ENV_FILE"
        update_result "env_file_exists" "passed" "Environment file found"
    fi
    
    # Validate compose file syntax
    if docker compose -f "$COMPOSE_FILE" config >/dev/null 2>&1; then
        log_success "Docker Compose file syntax is valid"
        update_result "compose_file_syntax" "passed" "Docker Compose file syntax is valid"
    else
        log_error "Docker Compose file syntax is invalid"
        update_result "compose_file_syntax" "failed" "Docker Compose file syntax is invalid"
        exit 1
    fi
}

# System requirements check
system_requirements_check() {
    log_info "Checking system requirements..."
    
    # Check available memory
    local available_memory=$(free -m | awk 'NR==2{printf "%.1f", $7/1024}')
    local required_memory=4.0
    
    if (( $(echo "$available_memory >= $required_memory" | bc -l) )); then
        log_success "Sufficient memory available: ${available_memory}GB (required: ${required_memory}GB)"
        update_result "memory_check" "passed" "Sufficient memory available" "{\"available\": \"${available_memory}GB\", \"required\": \"${required_memory}GB\"}"
    else
        log_warn "Low memory: ${available_memory}GB available (recommended: ${required_memory}GB)"
        update_result "memory_check" "warning" "Low memory available" "{\"available\": \"${available_memory}GB\", \"required\": \"${required_memory}GB\"}"
    fi
    
    # Check available disk space
    local available_disk=$(df . | awk 'NR==2 {printf "%.1f", $4/1024/1024}')
    local required_disk=2.0
    
    if (( $(echo "$available_disk >= $required_disk" | bc -l) )); then
        log_success "Sufficient disk space: ${available_disk}GB (required: ${required_disk}GB)"
        update_result "disk_space_check" "passed" "Sufficient disk space available" "{\"available\": \"${available_disk}GB\", \"required\": \"${required_disk}GB\"}"
    else
        log_error "Insufficient disk space: ${available_disk}GB available (required: ${required_disk}GB)"
        update_result "disk_space_check" "failed" "Insufficient disk space" "{\"available\": \"${available_disk}GB\", \"required\": \"${required_disk}GB\"}"
    fi
    
    # Check CPU cores
    local cpu_cores=$(nproc)
    local required_cores=2
    
    if [[ $cpu_cores -ge $required_cores ]]; then
        log_success "Sufficient CPU cores: $cpu_cores (required: $required_cores)"
        update_result "cpu_cores_check" "passed" "Sufficient CPU cores available" "{\"available\": $cpu_cores, \"required\": $required_cores}"
    else
        log_warn "Limited CPU cores: $cpu_cores (recommended: $required_cores)"
        update_result "cpu_cores_check" "warning" "Limited CPU cores" "{\"available\": $cpu_cores, \"required\": $required_cores}"
    fi
}

# Network validation
network_validation() {
    log_info "Validating network configuration..."
    
    # Check if networks can be created
    local networks=("testing-frontend" "testing-backend" "testing-database" "testing-monitoring")
    
    for network in "${networks[@]}"; do
        if docker network create --dry-run "$network" >/dev/null 2>&1; then
            log_success "Network '$network' configuration is valid"
            update_result "network_${network}_config" "passed" "Network configuration is valid"
        else
            log_error "Network '$network' configuration is invalid"
            update_result "network_${network}_config" "failed" "Network configuration is invalid"
        fi
    done
    
    # Check subnet conflicts
    local existing_subnets=$(docker network ls --format "table {{.Name}}\t{{.Driver}}" | grep bridge | awk '{print $1}' | xargs -I {} docker network inspect {} | jq -r '.[].IPAM.Config[].Subnet' 2>/dev/null | sort | uniq)
    local new_subnets=("172.20.0.0/24" "172.21.0.0/24" "172.22.0.0/24" "172.23.0.0/24")
    
    local conflicts=()
    for subnet in "${new_subnets[@]}"; do
        if echo "$existing_subnets" | grep -q "$subnet"; then
            conflicts+=("$subnet")
        fi
    done
    
    if [[ ${#conflicts[@]} -eq 0 ]]; then
        log_success "No subnet conflicts detected"
        update_result "subnet_conflicts" "passed" "No subnet conflicts detected"
    else
        log_warn "Subnet conflicts detected: ${conflicts[*]}"
        update_result "subnet_conflicts" "warning" "Subnet conflicts detected" "{\"conflicts\": $(printf '%s\n' "${conflicts[@]}" | jq -R . | jq -s .)}"
    fi
}

# Service configuration validation
service_configuration_validation() {
    log_info "Validating service configurations..."
    
    # Extract services from compose file
    local services=$(docker compose -f "$COMPOSE_FILE" config --services)
    local service_count=$(echo "$services" | wc -l)
    
    log_info "Found $service_count services to validate"
    update_result "service_count" "passed" "Found $service_count services" "{\"count\": $service_count, \"services\": $(echo "$services" | jq -R . | jq -s .)}"
    
    # Validate each service
    while IFS= read -r service; do
        log_info "Validating service: $service"
        
        # Check service configuration
        local service_config=$(docker compose -f "$COMPOSE_FILE" config --service "$service" 2>/dev/null)
        if [[ -n "$service_config" ]]; then
            log_success "Service '$service' configuration is valid"
            update_result "service_${service}_config" "passed" "Service configuration is valid"
        else
            log_error "Service '$service' configuration is invalid"
            update_result "service_${service}_config" "failed" "Service configuration is invalid"
        fi
        
        # Check if image exists or can be built
        local image=$(docker compose -f "$COMPOSE_FILE" config | yq eval ".services.${service}.image // \"\"" -)
        local build_context=$(docker compose -f "$COMPOSE_FILE" config | yq eval ".services.${service}.build.context // \"\"" -)
        
        if [[ -n "$image" ]]; then
            # Check if image exists locally or can be pulled
            if docker image inspect "$image" >/dev/null 2>&1; then
                log_success "Image '$image' is available locally"
                update_result "service_${service}_image" "passed" "Image is available locally"
            elif docker pull "$image" >/dev/null 2>&1; then
                log_success "Image '$image' can be pulled"
                update_result "service_${service}_image" "passed" "Image can be pulled"
            else
                log_warn "Image '$image' is not available locally and cannot be pulled"
                update_result "service_${service}_image" "warning" "Image is not available"
            fi
        elif [[ -n "$build_context" ]]; then
            if [[ -d "$build_context" ]]; then
                log_success "Build context '$build_context' exists"
                update_result "service_${service}_build" "passed" "Build context exists"
            else
                log_error "Build context '$build_context' does not exist"
                update_result "service_${service}_build" "failed" "Build context does not exist"
            fi
        fi
    done <<< "$services"
}

# Volume validation
volume_validation() {
    log_info "Validating volume configurations..."
    
    # Extract volumes from compose file
    local volumes=$(docker compose -f "$COMPOSE_FILE" config | yq eval '.volumes | keys | .[]' -)
    
    if [[ -n "$volumes" ]]; then
        while IFS= read -r volume; do
            log_info "Validating volume: $volume"
            
            # Check if volume can be created
            if docker volume create --dry-run "$volume" >/dev/null 2>&1; then
                log_success "Volume '$volume' configuration is valid"
                update_result "volume_${volume}_config" "passed" "Volume configuration is valid"
            else
                log_error "Volume '$volume' configuration is invalid"
                update_result "volume_${volume}_config" "failed" "Volume configuration is invalid"
            fi
        done <<< "$volumes"
    else
        log_info "No named volumes found in compose file"
        update_result "volumes_check" "passed" "No named volumes to validate"
    fi
}

# Port conflict validation
port_conflict_validation() {
    log_info "Checking for port conflicts..."
    
    # Extract exposed ports from compose file
    local ports=$(docker compose -f "$COMPOSE_FILE" config | yq eval '.services.*.ports[]' - 2>/dev/null | cut -d: -f1 | sort | uniq)
    
    local conflicts=()
    if [[ -n "$ports" ]]; then
        while IFS= read -r port; do
            if netstat -tuln | grep -q ":$port "; then
                conflicts+=("$port")
            fi
        done <<< "$ports"
    fi
    
    if [[ ${#conflicts[@]} -eq 0 ]]; then
        log_success "No port conflicts detected"
        update_result "port_conflicts" "passed" "No port conflicts detected"
    else
        log_warn "Port conflicts detected: ${conflicts[*]}"
        update_result "port_conflicts" "warning" "Port conflicts detected" "{\"conflicts\": $(printf '%s\n' "${conflicts[@]}" | jq -R . | jq -s .)}"
    fi
}

# Cleanroom environment test
cleanroom_test() {
    log_info "Starting cleanroom environment test..."
    
    local project_name="unjucks_test_cleanroom_$(date +%s)"
    local cleanup_required=false
    
    # Cleanup function
    cleanup_cleanroom() {
        if [[ "$cleanup_required" == "true" ]]; then
            log_info "Cleaning up cleanroom test environment..."
            docker compose -f "$COMPOSE_FILE" -p "$project_name" down --volumes --remove-orphans >/dev/null 2>&1 || true
            docker system prune -f >/dev/null 2>&1 || true
        fi
    }
    
    # Set up cleanup on exit
    trap cleanup_cleanroom EXIT
    
    # Start services in cleanroom
    log_info "Starting services in cleanroom environment..."
    if docker compose -f "$COMPOSE_FILE" -p "$project_name" up -d >/dev/null 2>&1; then
        cleanup_required=true
        log_success "Services started successfully in cleanroom"
        update_result "cleanroom_startup" "passed" "Services started successfully"
        
        # Wait for services to stabilize
        log_info "Waiting for services to stabilize..."
        sleep 30
        
        # Check service health
        local healthy_services=0
        local total_services=0
        
        local services=$(docker compose -f "$COMPOSE_FILE" -p "$project_name" ps --services)
        while IFS= read -r service; do
            total_services=$((total_services + 1))
            local container_id=$(docker compose -f "$COMPOSE_FILE" -p "$project_name" ps -q "$service")
            
            if [[ -n "$container_id" ]]; then
                local health_status=$(docker inspect "$container_id" --format='{{.State.Health.Status}}' 2>/dev/null || echo "no-healthcheck")
                local container_status=$(docker inspect "$container_id" --format='{{.State.Status}}' 2>/dev/null || echo "unknown")
                
                if [[ "$health_status" == "healthy" ]] || [[ "$health_status" == "no-healthcheck" && "$container_status" == "running" ]]; then
                    healthy_services=$((healthy_services + 1))
                    log_success "Service '$service' is healthy"
                else
                    log_warn "Service '$service' is not healthy (health: $health_status, status: $container_status)"
                fi
            else
                log_error "Service '$service' container not found"
            fi
        done <<< "$services"
        
        local health_percentage=$((healthy_services * 100 / total_services))
        if [[ $health_percentage -ge 80 ]]; then
            log_success "Cleanroom test passed: $healthy_services/$total_services services healthy (${health_percentage}%)"
            update_result "cleanroom_health" "passed" "Most services are healthy" "{\"healthy\": $healthy_services, \"total\": $total_services, \"percentage\": $health_percentage}"
        else
            log_warn "Cleanroom test warning: Only $healthy_services/$total_services services healthy (${health_percentage}%)"
            update_result "cleanroom_health" "warning" "Some services are unhealthy" "{\"healthy\": $healthy_services, \"total\": $total_services, \"percentage\": $health_percentage}"
        fi
        
        # Test basic connectivity
        log_info "Testing basic connectivity..."
        test_connectivity "$project_name"
        
    else
        log_error "Failed to start services in cleanroom environment"
        update_result "cleanroom_startup" "failed" "Failed to start services"
    fi
}

# Test connectivity between services
test_connectivity() {
    local project_name="$1"
    
    # Test database connectivity
    log_info "Testing database connectivity..."
    
    # PostgreSQL
    local postgres_container=$(docker compose -f "$COMPOSE_FILE" -p "$project_name" ps -q postgres-test)
    if [[ -n "$postgres_container" ]]; then
        if docker exec "$postgres_container" pg_isready -U test_user -d unjucks_test >/dev/null 2>&1; then
            log_success "PostgreSQL connectivity test passed"
            update_result "connectivity_postgres" "passed" "PostgreSQL is accessible"
        else
            log_warn "PostgreSQL connectivity test failed"
            update_result "connectivity_postgres" "warning" "PostgreSQL is not accessible"
        fi
    fi
    
    # Redis
    local redis_container=$(docker compose -f "$COMPOSE_FILE" -p "$project_name" ps -q redis-test)
    if [[ -n "$redis_container" ]]; then
        if docker exec "$redis_container" redis-cli -a test_redis_password ping >/dev/null 2>&1; then
            log_success "Redis connectivity test passed"
            update_result "connectivity_redis" "passed" "Redis is accessible"
        else
            log_warn "Redis connectivity test failed"
            update_result "connectivity_redis" "warning" "Redis is not accessible"
        fi
    fi
    
    # MongoDB
    local mongodb_container=$(docker compose -f "$COMPOSE_FILE" -p "$project_name" ps -q mongodb-test)
    if [[ -n "$mongodb_container" ]]; then
        if docker exec "$mongodb_container" mongosh --eval "db.adminCommand('ping')" >/dev/null 2>&1; then
            log_success "MongoDB connectivity test passed"
            update_result "connectivity_mongodb" "passed" "MongoDB is accessible"
        else
            log_warn "MongoDB connectivity test failed"
            update_result "connectivity_mongodb" "warning" "MongoDB is not accessible"
        fi
    fi
}

# Generate final report
generate_final_report() {
    log_info "Generating final validation report..."
    
    # Update final status
    local failed_checks=$(jq -r '.summary.failed_checks' "$VALIDATION_RESULTS")
    local total_checks=$(jq -r '.summary.total_checks' "$VALIDATION_RESULTS")
    local passed_checks=$(jq -r '.summary.passed_checks' "$VALIDATION_RESULTS")
    local warnings=$(jq -r '.summary.warnings' "$VALIDATION_RESULTS")
    
    local overall_status="passed"
    if [[ $failed_checks -gt 0 ]]; then
        overall_status="failed"
    elif [[ $warnings -gt 0 ]]; then
        overall_status="warning"
    fi
    
    jq --arg status "$overall_status" '.status = $status' "$VALIDATION_RESULTS" > "$VALIDATION_RESULTS.tmp" && mv "$VALIDATION_RESULTS.tmp" "$VALIDATION_RESULTS"
    
    # Print summary
    echo ""
    log_info "=== VALIDATION SUMMARY ==="
    log_info "Total Checks: $total_checks"
    log_success "Passed: $passed_checks"
    log_warn "Warnings: $warnings"
    log_error "Failed: $failed_checks"
    log_info "Overall Status: $overall_status"
    echo ""
    
    if [[ "$overall_status" == "passed" ]]; then
        log_success "Docker testing environment validation PASSED"
        log_info "The environment is ready for full stack testing"
    elif [[ "$overall_status" == "warning" ]]; then
        log_warn "Docker testing environment validation completed with WARNINGS"
        log_info "The environment can be used but some optimizations are recommended"
    else
        log_error "Docker testing environment validation FAILED"
        log_info "Critical issues must be resolved before testing"
    fi
    
    log_info "Detailed results saved to: $VALIDATION_RESULTS"
    log_info "Validation log saved to: $VALIDATION_LOG"
    
    return $([ "$overall_status" == "failed" ] && echo 1 || echo 0)
}

# Main validation function
main() {
    echo "Docker Testing Environment Validation"
    echo "====================================="
    echo "Timestamp: $(date)"
    echo "Compose File: $COMPOSE_FILE"
    echo "Environment File: $ENV_FILE"
    echo ""
    
    initialize_results
    
    # Run validation checks
    pre_validation_checks
    system_requirements_check
    network_validation
    service_configuration_validation
    volume_validation
    port_conflict_validation
    cleanroom_test
    
    # Generate final report
    generate_final_report
}

# Run main function
main "$@"