#!/bin/bash
# KGEN Docker Swarm Deployment Script
# Enterprise-grade zero-downtime blue-green deployment

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="$PROJECT_DIR/docker-compose.production.yml"
STACK_NAME="kgen"
DEPLOYMENT_TIMEOUT=600
HEALTH_CHECK_TIMEOUT=300

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] ✅${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] ⚠️${NC} $1"
}

log_error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ❌${NC} $1"
}

# Function to check if Docker Swarm is initialized
check_swarm() {
    if ! docker info | grep -q "Swarm: active"; then
        log_error "Docker Swarm is not active. Please initialize swarm mode first:"
        log "  docker swarm init"
        exit 1
    fi
    log_success "Docker Swarm is active"
}

# Function to create required directories
create_directories() {
    log "Creating required directories..."
    
    local directories=(
        "/opt/kgen/data"
        "/opt/kgen/postgres"
        "/opt/kgen/redis"
        "/opt/kgen/prometheus"
        "/opt/kgen/grafana"
        "/opt/kgen/logs"
        "/opt/kgen/backups"
    )
    
    for dir in "${directories[@]}"; do
        if [[ ! -d "$dir" ]]; then
            sudo mkdir -p "$dir"
            sudo chown -R "$(id -u):$(id -g)" "$dir"
            log "Created directory: $dir"
        fi
    done
    
    log_success "Directories created successfully"
}

# Function to create Docker secrets
create_secrets() {
    log "Creating Docker secrets..."
    
    # Database password
    if ! docker secret ls | grep -q "database_password"; then
        echo "${DATABASE_PASSWORD:-$(openssl rand -base64 32)}" | docker secret create database_password -
        log "Created database_password secret"
    fi
    
    # Redis password
    if ! docker secret ls | grep -q "redis_password"; then
        echo "${REDIS_PASSWORD:-$(openssl rand -base64 32)}" | docker secret create redis_password -
        log "Created redis_password secret"
    fi
    
    # Grafana admin password
    if ! docker secret ls | grep -q "grafana_admin_password"; then
        echo "${GRAFANA_ADMIN_PASSWORD:-admin123!}" | docker secret create grafana_admin_password -
        log "Created grafana_admin_password secret"
    fi
    
    # SSL certificates (if provided)
    if [[ -n "${SSL_CERT_PATH:-}" && -f "$SSL_CERT_PATH" ]]; then
        if ! docker secret ls | grep -q "ssl_cert"; then
            docker secret create ssl_cert "$SSL_CERT_PATH"
            log "Created ssl_cert secret"
        fi
    fi
    
    if [[ -n "${SSL_KEY_PATH:-}" && -f "$SSL_KEY_PATH" ]]; then
        if ! docker secret ls | grep -q "ssl_key"; then
            docker secret create ssl_key "$SSL_KEY_PATH"
            log "Created ssl_key secret"
        fi
    fi
    
    log_success "Secrets created successfully"
}

# Function to create Docker configs
create_configs() {
    log "Creating Docker configs..."
    
    # KGEN configuration
    if [[ -f "$PROJECT_DIR/configs/kgen.config.ts" ]]; then
        if docker config ls | grep -q "kgen_config"; then
            docker config rm kgen_config || true
            sleep 2
        fi
        docker config create kgen_config "$PROJECT_DIR/configs/kgen.config.ts"
        log "Created kgen_config"
    fi
    
    # Nginx configuration
    if [[ -f "$PROJECT_DIR/configs/nginx.conf" ]]; then
        if docker config ls | grep -q "nginx_config"; then
            docker config rm nginx_config || true
            sleep 2
        fi
        docker config create nginx_config "$PROJECT_DIR/configs/nginx.conf"
        log "Created nginx_config"
    fi
    
    # Prometheus configuration
    if [[ -f "$PROJECT_DIR/configs/prometheus.yml" ]]; then
        if docker config ls | grep -q "prometheus_config"; then
            docker config rm prometheus_config || true
            sleep 2
        fi
        docker config create prometheus_config "$PROJECT_DIR/configs/prometheus.yml"
        log "Created prometheus_config"
    fi
    
    log_success "Configs created successfully"
}

# Function to get current active slot
get_active_slot() {
    local blue_replicas green_replicas
    
    blue_replicas=$(docker service ls --filter name="${STACK_NAME}_kgen-blue" --format "{{.Replicas}}" | cut -d'/' -f1 || echo "0")
    green_replicas=$(docker service ls --filter name="${STACK_NAME}_kgen-green" --format "{{.Replicas}}" | cut -d'/' -f1 || echo "0")
    
    if [[ "$blue_replicas" -gt 0 ]]; then
        echo "blue"
    elif [[ "$green_replicas" -gt 0 ]]; then
        echo "green"
    else
        echo "blue"  # Default to blue if neither is active
    fi
}

# Function to get inactive slot
get_inactive_slot() {
    local active_slot="$1"
    if [[ "$active_slot" == "blue" ]]; then
        echo "green"
    else
        echo "blue"
    fi
}

# Function to wait for service to be ready
wait_for_service_ready() {
    local service_name="$1"
    local timeout="${2:-300}"
    local start_time
    start_time=$(date +%s)
    
    log "Waiting for $service_name to be ready (timeout: ${timeout}s)..."
    
    while true; do
        local current_time
        current_time=$(date +%s)
        
        if [[ $((current_time - start_time)) -gt $timeout ]]; then
            log_error "Timeout waiting for $service_name to be ready"
            return 1
        fi
        
        # Check if service is running and healthy
        local running_tasks
        running_tasks=$(docker service ps "$service_name" --filter desired-state=running --format "{{.CurrentState}}" | grep -c "Running" || echo "0")
        
        if [[ "$running_tasks" -gt 0 ]]; then
            # Additional health check for KGEN services
            if [[ "$service_name" =~ kgen-(blue|green) ]]; then
                local service_ip
                service_ip=$(docker service ps "$service_name" --filter desired-state=running --format "{{.Node}}" | head -1)
                
                if [[ -n "$service_ip" ]]; then
                    # Test health endpoint
                    if docker exec "$(docker ps --filter label=com.docker.swarm.service.name="$service_name" --format "{{.ID}}" | head -1)" \
                        curl -f -s http://localhost:3000/health > /dev/null 2>&1; then
                        log_success "$service_name is ready and healthy"
                        return 0
                    fi
                fi
            else
                log_success "$service_name is ready"
                return 0
            fi
        fi
        
        log "Waiting for $service_name... (${running_tasks} tasks running)"
        sleep 10
    done
}

# Function to perform health check
health_check() {
    local service_name="$1"
    local retries="${2:-5}"
    local delay="${3:-10}"
    
    log "Performing health check for $service_name..."
    
    for ((i=1; i<=retries; i++)); do
        log "Health check attempt $i/$retries..."
        
        # Get a container ID for the service
        local container_id
        container_id=$(docker ps --filter label=com.docker.swarm.service.name="$service_name" --format "{{.ID}}" | head -1)
        
        if [[ -n "$container_id" ]]; then
            if docker exec "$container_id" curl -f -s http://localhost:3000/health > /dev/null 2>&1; then
                log_success "Health check passed for $service_name"
                return 0
            fi
        fi
        
        if [[ $i -lt $retries ]]; then
            log_warning "Health check failed, retrying in ${delay}s..."
            sleep "$delay"
        fi
    done
    
    log_error "Health check failed for $service_name after $retries attempts"
    return 1
}

# Function to scale service
scale_service() {
    local service_name="$1"
    local replicas="$2"
    
    log "Scaling $service_name to $replicas replicas..."
    
    if docker service update --replicas="$replicas" "$service_name"; then
        log_success "Successfully scaled $service_name to $replicas replicas"
        return 0
    else
        log_error "Failed to scale $service_name"
        return 1
    fi
}

# Function to perform blue-green deployment
blue_green_deploy() {
    local current_slot target_slot
    
    current_slot=$(get_active_slot)
    target_slot=$(get_inactive_slot "$current_slot")
    
    log "Current active slot: $current_slot"
    log "Target deployment slot: $target_slot"
    
    # Deploy to target slot
    log "Deploying to $target_slot slot..."
    
    # Scale up target slot
    if ! scale_service "${STACK_NAME}_kgen-$target_slot" 3; then
        log_error "Failed to scale up $target_slot slot"
        return 1
    fi
    
    # Wait for target slot to be ready
    if ! wait_for_service_ready "${STACK_NAME}_kgen-$target_slot" "$HEALTH_CHECK_TIMEOUT"; then
        log_error "Target slot $target_slot failed to become ready"
        # Rollback: scale down target slot
        scale_service "${STACK_NAME}_kgen-$target_slot" 0
        return 1
    fi
    
    # Perform health checks on target slot
    if ! health_check "${STACK_NAME}_kgen-$target_slot"; then
        log_error "Health check failed for target slot $target_slot"
        # Rollback: scale down target slot
        scale_service "${STACK_NAME}_kgen-$target_slot" 0
        return 1
    fi
    
    # Switch traffic (update load balancer configuration)
    log "Switching traffic to $target_slot slot..."
    
    # In a real implementation, this would update load balancer rules
    # For now, we'll use Docker service labels to indicate active slot
    docker service update --label-add "kgen.active=true" "${STACK_NAME}_kgen-$target_slot"
    docker service update --label-rm "kgen.active" "${STACK_NAME}_kgen-$current_slot" || true
    
    # Gradual traffic switch (optional)
    log "Performing gradual traffic switch..."
    sleep 30
    
    # Final health check after traffic switch
    if ! health_check "${STACK_NAME}_kgen-$target_slot"; then
        log_error "Post-switch health check failed"
        # Emergency rollback
        docker service update --label-add "kgen.active=true" "${STACK_NAME}_kgen-$current_slot"
        docker service update --label-rm "kgen.active" "${STACK_NAME}_kgen-$target_slot" || true
        scale_service "${STACK_NAME}_kgen-$target_slot" 0
        return 1
    fi
    
    # Scale down previous slot
    log "Scaling down previous slot: $current_slot"
    scale_service "${STACK_NAME}_kgen-$current_slot" 0
    
    log_success "Blue-green deployment completed successfully!"
    log_success "Active slot is now: $target_slot"
    
    return 0
}

# Function to rollback deployment
rollback() {
    log "Performing rollback..."
    
    local current_slot target_slot
    current_slot=$(get_active_slot)
    target_slot=$(get_inactive_slot "$current_slot")
    
    log "Rolling back from $current_slot to $target_slot"
    
    # Scale up target slot (previous version)
    scale_service "${STACK_NAME}_kgen-$target_slot" 3
    
    # Wait for target slot to be ready
    wait_for_service_ready "${STACK_NAME}_kgen-$target_slot" "$HEALTH_CHECK_TIMEOUT"
    
    # Switch traffic back
    docker service update --label-add "kgen.active=true" "${STACK_NAME}_kgen-$target_slot"
    docker service update --label-rm "kgen.active" "${STACK_NAME}_kgen-$current_slot" || true
    
    # Scale down current slot
    scale_service "${STACK_NAME}_kgen-$current_slot" 0
    
    log_success "Rollback completed successfully!"
}

# Function to deploy stack
deploy_stack() {
    log "Deploying KGEN stack..."
    
    # Set default environment variables
    export KGEN_IMAGE="${KGEN_IMAGE:-ghcr.io/your-org/kgen}"
    export KGEN_TAG="${KGEN_TAG:-latest}"
    
    # Deploy the stack
    if docker stack deploy -c "$COMPOSE_FILE" "$STACK_NAME"; then
        log_success "Stack deployment initiated"
    else
        log_error "Failed to deploy stack"
        return 1
    fi
    
    # Wait for core services to be ready
    local core_services=(
        "${STACK_NAME}_postgres"
        "${STACK_NAME}_redis"
        "${STACK_NAME}_load-balancer"
    )
    
    for service in "${core_services[@]}"; do
        if ! wait_for_service_ready "$service"; then
            log_error "Core service $service failed to start"
            return 1
        fi
    done
    
    log_success "Core services are ready"
    
    # Perform blue-green deployment for KGEN application
    if ! blue_green_deploy; then
        log_error "Blue-green deployment failed"
        return 1
    fi
    
    log_success "KGEN stack deployed successfully!"
}

# Function to show stack status
show_status() {
    log "KGEN Stack Status:"
    echo
    
    docker stack services "$STACK_NAME" --format "table {{.Name}}\t{{.Mode}}\t{{.Replicas}}\t{{.Image}}"
    echo
    
    log "Active KGEN slot:"
    local active_slot
    active_slot=$(get_active_slot)
    echo "  Current active slot: $active_slot"
    echo
    
    log "Service endpoints:"
    echo "  Application: https://kgen.yourdomain.com"
    echo "  Prometheus: http://localhost:9090"
    echo "  Grafana: http://localhost:3001"
    echo "  Node Exporter: http://localhost:9100"
    echo "  cAdvisor: http://localhost:8080"
}

# Main function
main() {
    local action="${1:-deploy}"
    
    case "$action" in
        deploy)
            log "Starting KGEN deployment..."
            check_swarm
            create_directories
            create_secrets
            create_configs
            deploy_stack
            show_status
            ;;
        rollback)
            log "Starting rollback..."
            check_swarm
            rollback
            show_status
            ;;
        status)
            show_status
            ;;
        blue-green)
            log "Starting blue-green deployment..."
            check_swarm
            blue_green_deploy
            show_status
            ;;
        scale)
            local service="${2:-}"
            local replicas="${3:-}"
            if [[ -z "$service" || -z "$replicas" ]]; then
                log_error "Usage: $0 scale <service> <replicas>"
                exit 1
            fi
            scale_service "$service" "$replicas"
            ;;
        *)
            echo "Usage: $0 {deploy|rollback|status|blue-green|scale}"
            echo
            echo "Commands:"
            echo "  deploy      - Deploy the KGEN stack with blue-green deployment"
            echo "  rollback    - Rollback to previous version"
            echo "  status      - Show current stack status"
            echo "  blue-green  - Perform blue-green deployment"
            echo "  scale       - Scale a specific service"
            echo
            echo "Environment variables:"
            echo "  KGEN_IMAGE             - KGEN container image (default: ghcr.io/your-org/kgen)"
            echo "  KGEN_TAG               - KGEN image tag (default: latest)"
            echo "  DATABASE_PASSWORD      - Database password (auto-generated if not set)"
            echo "  REDIS_PASSWORD         - Redis password (auto-generated if not set)"
            echo "  GRAFANA_ADMIN_PASSWORD - Grafana admin password (default: admin123!)"
            echo "  SSL_CERT_PATH          - Path to SSL certificate file"
            echo "  SSL_KEY_PATH           - Path to SSL private key file"
            exit 1
            ;;
    esac
}

# Run main function
main "$@"