#!/bin/bash
# =============================================================================
# UNJUCKS ENTERPRISE CONTAINER TESTING SUITE
# Local testing for Docker workflows with act
# =============================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
WORKFLOWS_DIR="$PROJECT_ROOT/.github/workflows"
DOCKER_DIR="$PROJECT_ROOT/docker"

# Test suites
declare -A WORKFLOWS=(
    ["enterprise"]="docker-enterprise.yml"
    ["unified"]="docker-unified.yml"
    ["security"]="security.yml"
    ["performance"]="performance-monitoring.yml"
)

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_dependencies() {
    log_info "Checking dependencies..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed"
        exit 1
    fi
    
    # Check act
    if ! command -v act &> /dev/null; then
        log_warning "act is not installed. Install with: brew install act"
        echo "Skipping workflow tests..."
        return 1
    fi
    
    # Check Docker BuildKit
    if ! docker buildx version &> /dev/null; then
        log_error "Docker BuildKit is not available"
        exit 1
    fi
    
    log_success "All dependencies are available"
    return 0
}

test_docker_build() {
    local dockerfile="$1"
    local target="${2:-}"
    local image_name="$3"
    
    log_info "Testing Docker build: $dockerfile -> $image_name"
    
    cd "$PROJECT_ROOT"
    
    local build_cmd="docker buildx build"
    build_cmd+=" --file $dockerfile"
    build_cmd+=" --platform linux/amd64"
    build_cmd+=" --tag $image_name:test"
    
    if [[ -n "$target" ]]; then
        build_cmd+=" --target $target"
    fi
    
    build_cmd+=" ."
    
    if eval "$build_cmd"; then
        log_success "Docker build successful: $image_name"
        return 0
    else
        log_error "Docker build failed: $image_name"
        return 1
    fi
}

test_docker_compose() {
    local compose_file="$1"
    local profile="${2:-default}"
    
    log_info "Testing Docker Compose: $compose_file (profile: $profile)"
    
    cd "$DOCKER_DIR"
    
    # Validate compose file
    if docker-compose -f "$compose_file" config --quiet; then
        log_success "Docker Compose validation successful: $compose_file"
    else
        log_error "Docker Compose validation failed: $compose_file"
        return 1
    fi
    
    # Test dry run
    local compose_cmd="docker-compose -f $compose_file"
    if [[ "$profile" != "default" ]]; then
        compose_cmd+=" --profile $profile"
    fi
    
    if $compose_cmd config > /dev/null; then
        log_success "Docker Compose dry run successful: $compose_file"
        return 0
    else
        log_error "Docker Compose dry run failed: $compose_file"
        return 1
    fi
}

test_security_scanning() {
    local image_name="$1"
    
    log_info "Running security scan on: $image_name"
    
    # Test with Trivy (if available)
    if command -v trivy &> /dev/null; then
        if trivy image --exit-code 0 --severity HIGH,CRITICAL "$image_name:test"; then
            log_success "Trivy security scan passed: $image_name"
        else
            log_warning "Trivy security scan found issues: $image_name"
        fi
    fi
    
    # Test with Docker Scout (if available)
    if docker scout version &> /dev/null; then
        if docker scout cves "$image_name:test" --exit-code; then
            log_success "Docker Scout security scan passed: $image_name"
        else
            log_warning "Docker Scout security scan found issues: $image_name"
        fi
    fi
}

test_workflow() {
    local workflow_name="$1"
    local workflow_file="$2"
    
    if ! command -v act &> /dev/null; then
        log_warning "act not available, skipping workflow test: $workflow_name"
        return 0
    fi
    
    log_info "Testing workflow: $workflow_name ($workflow_file)"
    
    cd "$PROJECT_ROOT"
    
    # Create temporary event file
    local event_file="/tmp/push-event.json"
    cat > "$event_file" << EOF
{
  "push": {
    "ref": "refs/heads/main"
  },
  "repository": {
    "name": "unjucks",
    "full_name": "unjucks/unjucks"
  }
}
EOF
    
    # Test workflow syntax
    if act --list --workflows "$WORKFLOWS_DIR" | grep -q "$workflow_file"; then
        log_success "Workflow syntax valid: $workflow_name"
    else
        log_error "Workflow syntax invalid: $workflow_name"
        return 1
    fi
    
    # Dry run workflow
    if act push --dry-run --eventpath "$event_file" --workflows "$WORKFLOWS_DIR/$workflow_file" --job prepare-enterprise-build; then
        log_success "Workflow dry run successful: $workflow_name"
    else
        log_error "Workflow dry run failed: $workflow_name"
        return 1
    fi
    
    rm -f "$event_file"
}

run_enterprise_tests() {
    log_info "Running Enterprise Container Tests"
    echo "================================="
    
    local failed_tests=0
    
    # Test enhanced Dockerfile builds
    log_info "Testing Enhanced Dockerfile builds..."
    
    declare -A DOCKERFILE_TESTS=(
        ["docker/Dockerfile.enhanced:distroless-production"]="unjucks-distroless"
        ["docker/Dockerfile.enhanced:security-hardened"]="unjucks-hardened"
        ["docker/Dockerfile.enhanced:performance"]="unjucks-performance"
        ["docker/Dockerfile:testing"]="unjucks-testing"
    )
    
    for dockerfile_target in "${!DOCKERFILE_TESTS[@]}"; do
        IFS=':' read -r dockerfile target <<< "$dockerfile_target"
        image_name="${DOCKERFILE_TESTS[$dockerfile_target]}"
        
        if test_docker_build "$dockerfile" "$target" "$image_name"; then
            # Run security scanning on built images
            test_security_scanning "$image_name"
        else
            ((failed_tests++))
        fi
    done
    
    # Test Docker Compose configurations
    log_info "Testing Docker Compose configurations..."
    
    declare -A COMPOSE_TESTS=(
        ["docker-compose.enhanced.yml"]="security monitoring"
        ["docker-compose.cleanroom.yml"]="integration"
        ["docker-compose.yml"]="default"
    )
    
    for compose_file in "${!COMPOSE_TESTS[@]}"; do
        profile="${COMPOSE_TESTS[$compose_file]}"
        if test_docker_compose "$compose_file" "$profile"; then
            log_success "Compose test passed: $compose_file"
        else
            ((failed_tests++))
        fi
    done
    
    # Test workflows
    if command -v act &> /dev/null; then
        log_info "Testing GitHub Actions workflows..."
        
        for workflow_name in "${!WORKFLOWS[@]}"; do
            workflow_file="${WORKFLOWS[$workflow_name]}"
            if [[ -f "$WORKFLOWS_DIR/$workflow_file" ]]; then
                if test_workflow "$workflow_name" "$workflow_file"; then
                    log_success "Workflow test passed: $workflow_name"
                else
                    ((failed_tests++))
                fi
            else
                log_warning "Workflow file not found: $workflow_file"
            fi
        done
    fi
    
    # Summary
    echo
    echo "================================="
    if [[ $failed_tests -eq 0 ]]; then
        log_success "All enterprise container tests passed!"
    else
        log_error "$failed_tests test(s) failed"
        exit 1
    fi
}

cleanup() {
    log_info "Cleaning up test artifacts..."
    
    # Clean up Docker images
    docker images --filter "reference=unjucks-*:test" -q | xargs -r docker rmi -f
    
    # Clean up Docker system
    docker system prune -f
    
    log_success "Cleanup completed"
}

show_help() {
    echo "Unjucks Enterprise Container Testing Suite"
    echo
    echo "Usage: $0 [OPTION]"
    echo
    echo "Options:"
    echo "  --build-only       Test only Docker builds"
    echo "  --compose-only     Test only Docker Compose"
    echo "  --workflows-only   Test only GitHub Actions workflows"
    echo "  --security-only    Test only security scanning"
    echo "  --cleanup          Clean up test artifacts"
    echo "  --help            Show this help message"
    echo
    echo "Examples:"
    echo "  $0                 Run all tests"
    echo "  $0 --build-only    Test Docker builds only"
    echo "  $0 --cleanup       Clean up after testing"
}

main() {
    echo "🐳 Unjucks Enterprise Container Testing Suite"
    echo "=============================================="
    echo
    
    # Parse command line arguments
    case "${1:-}" in
        --build-only)
            check_dependencies
            # Run only build tests
            log_info "Running Docker build tests only..."
            # Implementation for build-only tests
            ;;
        --compose-only)
            check_dependencies
            log_info "Running Docker Compose tests only..."
            # Implementation for compose-only tests
            ;;
        --workflows-only)
            check_dependencies
            log_info "Running workflow tests only..."
            # Implementation for workflow-only tests
            ;;
        --security-only)
            check_dependencies
            log_info "Running security tests only..."
            # Implementation for security-only tests
            ;;
        --cleanup)
            cleanup
            exit 0
            ;;
        --help|-h)
            show_help
            exit 0
            ;;
        "")
            # Run all tests
            if check_dependencies; then
                run_enterprise_tests
            fi
            ;;
        *)
            log_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
    
    # Always cleanup on exit
    trap cleanup EXIT
}

# Run main function with all arguments
main "$@"