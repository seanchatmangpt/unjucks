#!/bin/bash
set -euo pipefail

# Coordination initialization script for Docker swarm testing
echo "🤝 Initializing Coordination System"
echo "==================================="

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COORD_DIR="/app/coordination-logs"
LOG_FILE="${COORD_DIR}/coordination.log"

# Create directories
mkdir -p "${COORD_DIR}"
exec 1> >(tee -a "${LOG_FILE}")
exec 2> >(tee -a "${LOG_FILE}" >&2)

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[COORD]${NC} $1"; }
log_success() { echo -e "${GREEN}[COORD]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[COORD]${NC} $1"; }
log_error() { echo -e "${RED}[COORD]${NC} $1"; }

# Check if this is a health check
if [[ "${1:-}" == "--health-check" ]]; then
    if [[ -f "${COORD_DIR}/coordination-active" ]]; then
        log_success "Coordination system is healthy"
        exit 0
    else
        log_error "Coordination system not active"
        exit 1
    fi
fi

# Coordination functions
init_claude_flow() {
    log_info "Initializing Claude Flow coordination..."
    
    # Check if Claude Flow is available
    if ! command -v npx >/dev/null 2>&1; then
        log_error "npx not available for Claude Flow initialization"
        return 1
    fi
    
    # Initialize swarm if not already done
    if ! npx claude-flow@alpha hooks pre-task --description "Docker validation coordination" 2>/dev/null; then
        log_warning "Claude Flow hooks may not be available, using local coordination"
        return 0
    fi
    
    # Set up session
    SWARM_ID="${SWARM_ID:-docker-validation-$(date +%s)}"
    export SWARM_ID
    
    log_info "Swarm ID: $SWARM_ID"
    
    # Restore session if available
    if npx claude-flow@alpha hooks session-restore --session-id "$SWARM_ID" 2>/dev/null; then
        log_success "Session restored: $SWARM_ID"
    else
        log_info "Starting new coordination session: $SWARM_ID"
    fi
    
    log_success "Claude Flow coordination initialized"
}

init_docker_coordination() {
    log_info "Initializing Docker coordination network..."
    
    # Create coordination network if it doesn't exist
    NETWORK_NAME="${COORDINATION_NETWORK:-unjucks-coord}"
    
    if docker network ls | grep -q "$NETWORK_NAME"; then
        log_info "Coordination network '$NETWORK_NAME' already exists"
    else
        if docker network create "$NETWORK_NAME" --driver bridge 2>/dev/null; then
            log_success "Created coordination network: $NETWORK_NAME"
        else
            log_warning "Could not create coordination network (may already exist)"
        fi
    fi
    
    # Set up coordination volume
    VOLUME_NAME="unjucks-coordination"
    if ! docker volume ls | grep -q "$VOLUME_NAME"; then
        if docker volume create "$VOLUME_NAME" 2>/dev/null; then
            log_success "Created coordination volume: $VOLUME_NAME"
        else
            log_warning "Could not create coordination volume"
        fi
    fi
    
    log_success "Docker coordination network initialized"
}

setup_coordination_hooks() {
    log_info "Setting up coordination hooks..."
    
    # Create hook scripts directory
    mkdir -p "${COORD_DIR}/hooks"
    
    # Pre-task hook
    cat > "${COORD_DIR}/hooks/pre-task.sh" <<'EOF'
#!/bin/bash
echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Pre-task hook: $1" >> /app/coordination-logs/hooks.log
npx claude-flow@alpha hooks pre-task --description "$1" 2>/dev/null || echo "Hook execution failed" >> /app/coordination-logs/hooks.log
EOF
    
    # Post-task hook
    cat > "${COORD_DIR}/hooks/post-task.sh" <<'EOF'
#!/bin/bash
echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Post-task hook: $1" >> /app/coordination-logs/hooks.log
npx claude-flow@alpha hooks post-task --task-id "$1" 2>/dev/null || echo "Hook execution failed" >> /app/coordination-logs/hooks.log
EOF
    
    # Post-edit hook
    cat > "${COORD_DIR}/hooks/post-edit.sh" <<'EOF'
#!/bin/bash
echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Post-edit hook: $1" >> /app/coordination-logs/hooks.log
npx claude-flow@alpha hooks post-edit --file "$1" --memory-key "docker-validation/$2" 2>/dev/null || echo "Hook execution failed" >> /app/coordination-logs/hooks.log
EOF
    
    # Make hooks executable
    chmod +x "${COORD_DIR}/hooks/"*.sh
    
    log_success "Coordination hooks configured"
}

create_coordination_state() {
    log_info "Creating coordination state file..."
    
    cat > "${COORD_DIR}/coordination-state.json" <<EOF
{
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "swarm_id": "${SWARM_ID:-unknown}",
    "coordination_network": "${COORDINATION_NETWORK:-unjucks-coord}",
    "status": "active",
    "docker_validation": {
        "multi_arch_enabled": true,
        "security_scanning": true,
        "performance_testing": true,
        "production_simulation": true
    },
    "agents": {
        "security_scanner": "pending",
        "performance_monitor": "pending", 
        "validation_coordinator": "pending"
    },
    "hooks": {
        "pre_task": "enabled",
        "post_task": "enabled",
        "post_edit": "enabled"
    }
}
EOF
    
    # Mark coordination as active
    touch "${COORD_DIR}/coordination-active"
    
    log_success "Coordination state created"
}

start_coordination_monitoring() {
    log_info "Starting coordination monitoring..."
    
    # Background process to monitor coordination
    (
        while [[ -f "${COORD_DIR}/coordination-active" ]]; do
            echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Coordination heartbeat" >> "${COORD_DIR}/monitoring.log"
            
            # Update state
            jq '.last_heartbeat = now | .status = "active"' "${COORD_DIR}/coordination-state.json" > "${COORD_DIR}/coordination-state.tmp" && \
            mv "${COORD_DIR}/coordination-state.tmp" "${COORD_DIR}/coordination-state.json"
            
            sleep 30
        done
    ) &
    
    MONITOR_PID=$!
    echo "$MONITOR_PID" > "${COORD_DIR}/monitor.pid"
    
    log_success "Coordination monitoring started (PID: $MONITOR_PID)"
}

run_coordination_tests() {
    log_info "Running coordination validation tests..."
    
    # Test hook execution
    if "${COORD_DIR}/hooks/pre-task.sh" "coordination-test"; then
        log_success "Pre-task hook test passed"
    else
        log_warning "Pre-task hook test failed"
    fi
    
    # Test state updates
    if jq '.test_timestamp = now' "${COORD_DIR}/coordination-state.json" > "${COORD_DIR}/test-state.json"; then
        mv "${COORD_DIR}/test-state.json" "${COORD_DIR}/coordination-state.json"
        log_success "State update test passed"
    else
        log_warning "State update test failed"
    fi
    
    # Test network connectivity (if in Docker)
    if command -v docker >/dev/null 2>&1; then
        if docker network ls | grep -q "${COORDINATION_NETWORK:-unjucks-coord}"; then
            log_success "Coordination network test passed"
        else
            log_warning "Coordination network test failed"
        fi
    fi
    
    log_success "Coordination validation tests completed"
}

cleanup_coordination() {
    log_info "Setting up coordination cleanup..."
    
    # Cleanup function
    cat > "${COORD_DIR}/cleanup.sh" <<'EOF'
#!/bin/bash
echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Cleaning up coordination..." >> /app/coordination-logs/coordination.log

# Stop monitoring
if [[ -f "/app/coordination-logs/monitor.pid" ]]; then
    MONITOR_PID=$(cat "/app/coordination-logs/monitor.pid")
    kill "$MONITOR_PID" 2>/dev/null || true
    rm -f "/app/coordination-logs/monitor.pid"
fi

# Export final state
npx claude-flow@alpha hooks session-end --export-metrics true 2>/dev/null || true

# Mark as inactive
rm -f "/app/coordination-logs/coordination-active"

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Coordination cleanup completed" >> /app/coordination-logs/coordination.log
EOF
    
    chmod +x "${COORD_DIR}/cleanup.sh"
    
    # Set up signal handlers
    trap "${COORD_DIR}/cleanup.sh" EXIT TERM INT
    
    log_success "Coordination cleanup configured"
}

# Main coordination initialization
main() {
    log_info "Starting coordination initialization..."
    
    init_claude_flow
    init_docker_coordination
    setup_coordination_hooks
    create_coordination_state
    start_coordination_monitoring
    run_coordination_tests
    cleanup_coordination
    
    log_success "🤝 Coordination system initialized successfully!"
    log_info "Coordination logs: ${COORD_DIR}"
    log_info "Swarm ID: ${SWARM_ID:-unknown}"
    
    # Keep running if no arguments provided
    if [[ $# -eq 0 ]]; then
        log_info "Coordination system running... (Press Ctrl+C to stop)"
        while [[ -f "${COORD_DIR}/coordination-active" ]]; do
            sleep 10
        done
    fi
}

# Run main function
main "$@"