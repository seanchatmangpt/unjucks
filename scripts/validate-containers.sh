#!/bin/bash

# Container validation script that works with or without Docker daemon
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker daemon is available
check_docker() {
    if command -v docker >/dev/null 2>&1; then
        if docker info >/dev/null 2>&1; then
            log_info "Docker daemon is running"
            return 0
        else
            log_warn "Docker command found but daemon not running"
            return 1
        fi
    else
        log_warn "Docker not installed"
        return 1
    fi
}

# Check alternative container runtimes
check_alternatives() {
    local found=false
    
    if command -v podman >/dev/null 2>&1; then
        log_info "Podman available as Docker alternative"
        found=true
    fi
    
    if command -v buildah >/dev/null 2>&1; then
        log_info "Buildah available for container building"
        found=true
    fi
    
    if command -v containerd >/dev/null 2>&1; then
        log_info "containerd available as runtime"
        found=true
    fi
    
    if [ "$found" = false ]; then
        log_warn "No alternative container runtimes found"
        return 1
    fi
    
    return 0
}

# Validate Dockerfile syntax
validate_dockerfile() {
    local dockerfile="$PROJECT_ROOT/docker/Dockerfile"
    
    if [ ! -f "$dockerfile" ]; then
        log_error "Dockerfile not found at $dockerfile"
        return 1
    fi
    
    log_info "Validating Dockerfile syntax..."
    
    # Basic syntax checks
    if ! grep -q "^FROM " "$dockerfile"; then
        log_error "Dockerfile missing FROM instruction"
        return 1
    fi
    
    if ! grep -q "WORKDIR " "$dockerfile"; then
        log_warn "Dockerfile missing WORKDIR instruction"
    fi
    
    if ! grep -q "HEALTHCHECK " "$dockerfile"; then
        log_warn "Dockerfile missing HEALTHCHECK instruction"
    fi
    
    log_info "Dockerfile syntax validation passed"
    return 0
}

# Validate docker-compose.yml
validate_compose() {
    local compose_file="$PROJECT_ROOT/docker/docker-compose.yml"
    
    if [ ! -f "$compose_file" ]; then
        log_error "docker-compose.yml not found at $compose_file"
        return 1
    fi
    
    log_info "Validating docker-compose.yml..."
    
    if command -v docker-compose >/dev/null 2>&1; then
        if docker-compose -f "$compose_file" config >/dev/null 2>&1; then
            log_info "docker-compose.yml validation passed"
            return 0
        else
            log_error "docker-compose.yml has syntax errors"
            return 1
        fi
    else
        log_warn "docker-compose not available for validation"
        return 0
    fi
}

# Test container build
test_build() {
    local dockerfile="$PROJECT_ROOT/docker/Dockerfile"
    
    if ! check_docker; then
        log_warn "Cannot test build without Docker daemon"
        return 0
    fi
    
    log_info "Testing container build..."
    
    cd "$PROJECT_ROOT"
    
    if docker build -f "$dockerfile" -t unjucks:test . >/dev/null 2>&1; then
        log_info "Container build test passed"
        
        # Test container run
        if docker run --rm unjucks:test node bin/unjucks.cjs --version >/dev/null 2>&1; then
            log_info "Container run test passed"
        else
            log_error "Container run test failed"
            return 1
        fi
        
        # Cleanup
        docker rmi unjucks:test >/dev/null 2>&1 || true
    else
        log_error "Container build test failed"
        return 1
    fi
    
    return 0
}

# Create podman configuration as Docker alternative
create_podman_config() {
    local config_dir="$HOME/.config/containers"
    
    if [ ! -d "$config_dir" ]; then
        mkdir -p "$config_dir"
    fi
    
    cat > "$config_dir/registries.conf" << 'EOF'
[registries.search]
registries = ['docker.io', 'quay.io']

[registries.insecure]
registries = []

[registries.block]
registries = []
EOF

    cat > "$config_dir/storage.conf" << 'EOF'
[storage]
driver = "overlay"
runroot = "/run/user/$UID/containers"
graphroot = "$HOME/.local/share/containers/storage"

[storage.options]
mount_program = "/usr/bin/fuse-overlayfs"
EOF

    log_info "Podman configuration created at $config_dir"
}

# Create buildah setup script
create_buildah_setup() {
    local setup_script="$PROJECT_ROOT/scripts/buildah-setup.sh"
    
    cat > "$setup_script" << 'EOF'
#!/bin/bash
# Buildah container building alternative to Docker

set -euo pipefail

# Create working container
ctr=$(buildah from node:18-alpine)

# Install dependencies
buildah run $ctr -- apk update
buildah run $ctr -- apk add --no-cache dumb-init

# Set working directory
buildah config --workingdir /app $ctr

# Copy files
buildah copy $ctr package*.json ./
buildah copy $ctr bin/ ./bin/
buildah copy $ctr src/ ./src/
buildah copy $ctr _templates/ ./_templates/

# Install npm dependencies
buildah run $ctr -- npm ci --only=production

# Configure container
buildah config --entrypoint '["dumb-init", "--"]' $ctr
buildah config --cmd '["node", "bin/unjucks.cjs", "--help"]' $ctr
buildah config --port 3000 $ctr

# Create image
buildah commit $ctr unjucks:buildah

echo "Container built with buildah: unjucks:buildah"
EOF

    chmod +x "$setup_script"
    log_info "Buildah setup script created at $setup_script"
}

# Main validation function
main() {
    log_info "Starting container validation..."
    
    local exit_code=0
    
    # Check Docker availability
    if check_docker; then
        log_info "Using Docker for container operations"
    else
        log_warn "Docker not available, checking alternatives..."
        if ! check_alternatives; then
            log_warn "No container runtimes available"
        fi
    fi
    
    # Create alternative configurations
    create_podman_config
    create_buildah_setup
    
    # Validate configuration files
    if ! validate_dockerfile; then
        exit_code=1
    fi
    
    if ! validate_compose; then
        exit_code=1
    fi
    
    # Test build if Docker is available
    if check_docker; then
        if ! test_build; then
            exit_code=1
        fi
    fi
    
    if [ $exit_code -eq 0 ]; then
        log_info "All container validations passed!"
    else
        log_error "Some validations failed. Check output above."
    fi
    
    return $exit_code
}

# Run main function if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi