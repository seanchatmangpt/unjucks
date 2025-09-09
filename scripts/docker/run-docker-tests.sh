#!/bin/bash

# Docker Testing Script for Unjucks
# Comprehensive testing environment orchestration

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DOCKER_COMPOSE_FILE="$PROJECT_ROOT/docker/docker-compose.testing.yml"
TEST_RESULTS_DIR="$PROJECT_ROOT/test-results-docker"
REPORTS_DIR="$PROJECT_ROOT/reports"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Claude Flow coordination hooks
claude_flow_pre_task() {
    echo -e "${BLUE}🚀 Initializing Docker testing coordination...${NC}"
    npx claude-flow@alpha hooks pre-task --description "Docker testing orchestration for unjucks" || true
}

claude_flow_post_task() {
    echo -e "${BLUE}✅ Finalizing Docker testing coordination...${NC}"
    npx claude-flow@alpha hooks post-task --task-id "docker-test-$(date +%s)" || true
}

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}" >&2
}

success() {
    echo -e "${GREEN}[SUCCESS] $1${NC}"
}

warning() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

# Help function
show_help() {
    cat << EOF
Docker Testing Script for Unjucks

Usage: $0 [OPTIONS] [TEST_TYPE]

TEST_TYPES:
    all         Run all tests (default)
    minimal     Run minimal tests only
    security    Run security tests
    performance Run performance tests
    integration Run integration tests
    unit        Run unit tests only
    build-only  Build images only

OPTIONS:
    -h, --help          Show this help message
    -c, --clean         Clean up before running tests
    -v, --verbose       Verbose output
    -f, --force         Force rebuild images
    -p, --parallel      Run tests in parallel
    -r, --report        Generate test report only
    -w, --watch         Watch mode for development
    --dry-run          Show what would be executed
    --no-cache         Build without cache
    --mem-limit        Set memory limit (default: 1g)
    --cpu-limit        Set CPU limit (default: 2.0)

Examples:
    $0                  # Run all tests
    $0 minimal          # Run minimal tests
    $0 -c security      # Clean and run security tests
    $0 -f -p all        # Force rebuild and run all tests in parallel
    $0 --dry-run        # Show execution plan
EOF
}

# Parse command line arguments
CLEAN=false
VERBOSE=false
FORCE_REBUILD=false
PARALLEL=false
REPORT_ONLY=false
WATCH_MODE=false
DRY_RUN=false
NO_CACHE=false
MEM_LIMIT="1g"
CPU_LIMIT="2.0"
TEST_TYPE="all"

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -c|--clean)
            CLEAN=true
            shift
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -f|--force)
            FORCE_REBUILD=true
            shift
            ;;
        -p|--parallel)
            PARALLEL=true
            shift
            ;;
        -r|--report)
            REPORT_ONLY=true
            shift
            ;;
        -w|--watch)
            WATCH_MODE=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --no-cache)
            NO_CACHE=true
            shift
            ;;
        --mem-limit)
            MEM_LIMIT="$2"
            shift 2
            ;;
        --cpu-limit)
            CPU_LIMIT="$2"
            shift 2
            ;;
        all|minimal|security|performance|integration|unit|build-only)
            TEST_TYPE="$1"
            shift
            ;;
        *)
            error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Environment setup
setup_environment() {
    log "Setting up Docker testing environment..."
    
    # Create required directories
    mkdir -p "$TEST_RESULTS_DIR" "$REPORTS_DIR"
    
    # Set permissions
    chmod 755 "$TEST_RESULTS_DIR" "$REPORTS_DIR"
    
    # Check Docker availability
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed or not in PATH"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        error "Docker Compose is not installed or not in PATH"
        exit 1
    fi
    
    # Check Docker daemon
    if ! docker info &> /dev/null; then
        error "Docker daemon is not running"
        exit 1
    fi
    
    success "Environment setup complete"
}

# Clean up function
cleanup() {
    if [[ "$CLEAN" == "true" ]]; then
        log "Cleaning up previous test artifacts..."
        
        # Stop and remove containers
        docker-compose -f "$DOCKER_COMPOSE_FILE" down --remove-orphans --volumes || true
        
        # Remove test result directories
        rm -rf "$TEST_RESULTS_DIR"/*
        rm -rf "$REPORTS_DIR"/*
        
        # Prune Docker resources if force rebuild
        if [[ "$FORCE_REBUILD" == "true" ]]; then
            docker system prune -f
            docker image prune -f
        fi
        
        success "Cleanup complete"
    fi
}

# Build Docker images
build_images() {
    log "Building Docker images..."
    
    local build_args=""
    if [[ "$NO_CACHE" == "true" ]]; then
        build_args="--no-cache"
    fi
    
    if [[ "$FORCE_REBUILD" == "true" ]]; then
        build_args="$build_args --force-rm"
    fi
    
    if [[ "$DRY_RUN" == "true" ]]; then
        echo "Would execute: docker-compose -f $DOCKER_COMPOSE_FILE build $build_args"
        return 0
    fi
    
    docker-compose -f "$DOCKER_COMPOSE_FILE" build $build_args
    success "Docker images built successfully"
}

# Run specific test type
run_tests() {
    local test_type="$1"
    
    log "Running $test_type tests..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        echo "Would execute tests for: $test_type"
        return 0
    fi
    
    local compose_args=""
    if [[ "$VERBOSE" == "true" ]]; then
        compose_args="--verbose"
    fi
    
    case "$test_type" in
        "all")
            docker-compose -f "$DOCKER_COMPOSE_FILE" up --abort-on-container-exit unjucks-test
            ;;
        "minimal")
            docker-compose -f "$DOCKER_COMPOSE_FILE" --profile minimal up --abort-on-container-exit unjucks-test-minimal
            ;;
        "security")
            docker-compose -f "$DOCKER_COMPOSE_FILE" --profile security up --abort-on-container-exit unjucks-security-test
            ;;
        "performance")
            docker-compose -f "$DOCKER_COMPOSE_FILE" --profile performance up --abort-on-container-exit unjucks-perf-test
            ;;
        "integration")
            docker-compose -f "$DOCKER_COMPOSE_FILE" --profile integration up --abort-on-container-exit unjucks-integration-test
            ;;
        "unit")
            docker-compose -f "$DOCKER_COMPOSE_FILE" run --rm unjucks-test npm run test:unit
            ;;
        "build-only")
            log "Build-only mode, skipping test execution"
            return 0
            ;;
        *)
            error "Unknown test type: $test_type"
            exit 1
            ;;
    esac
}

# Generate test report
generate_report() {
    if [[ "$REPORT_ONLY" == "true" ]] || [[ "$TEST_TYPE" != "build-only" ]]; then
        log "Generating test reports..."
        
        if [[ "$DRY_RUN" == "true" ]]; then
            echo "Would generate test reports"
            return 0
        fi
        
        # Aggregate test results
        docker-compose -f "$DOCKER_COMPOSE_FILE" --profile aggregation up --abort-on-container-exit test-aggregator || true
        
        # Copy results to host
        if [[ -d "$TEST_RESULTS_DIR" ]]; then
            log "Test results available in: $TEST_RESULTS_DIR"
        fi
        
        if [[ -d "$REPORTS_DIR" ]]; then
            log "Reports available in: $REPORTS_DIR"
        fi
        
        success "Report generation complete"
    fi
}

# Watch mode for development
watch_mode() {
    if [[ "$WATCH_MODE" == "true" ]]; then
        log "Starting watch mode for development..."
        
        if [[ "$DRY_RUN" == "true" ]]; then
            echo "Would start watch mode"
            return 0
        fi
        
        # Use nodemon to watch for changes
        docker-compose -f "$DOCKER_COMPOSE_FILE" run --rm \
            -v "$PROJECT_ROOT/src:/app/src" \
            -v "$PROJECT_ROOT/tests:/app/tests" \
            unjucks-test \
            npx nodemon --watch src --watch tests --ext js,json,njk --exec "npm run test:minimal"
    fi
}

# Main execution
main() {
    claude_flow_pre_task
    
    log "Starting Docker testing orchestration for Unjucks"
    log "Test type: $TEST_TYPE"
    log "Configuration: Clean=$CLEAN, Verbose=$VERBOSE, Force=$FORCE_REBUILD, Parallel=$PARALLEL"
    
    # Setup and validation
    setup_environment
    
    # Cleanup if requested
    cleanup
    
    # Build images
    build_images
    
    # Handle special modes
    if [[ "$WATCH_MODE" == "true" ]]; then
        watch_mode
        return 0
    fi
    
    if [[ "$REPORT_ONLY" == "true" ]]; then
        generate_report
        return 0
    fi
    
    # Run tests
    run_tests "$TEST_TYPE"
    
    # Generate reports
    generate_report
    
    # Coordination hooks
    npx claude-flow@alpha hooks post-edit --file "docker-test-results" --memory-key "swarm/docker/test-results" || true
    
    claude_flow_post_task
    
    success "Docker testing orchestration completed successfully!"
}

# Trap for cleanup on exit
trap 'docker-compose -f "$DOCKER_COMPOSE_FILE" down --remove-orphans' EXIT

# Execute main function
main "$@"