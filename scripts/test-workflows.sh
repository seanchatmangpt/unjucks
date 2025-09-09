#!/bin/bash

# GitHub Actions Local Testing Script
# Usage: ./scripts/test-workflows.sh [workflow] [job]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ACT_VERSION_MIN="0.2.40"
WORKFLOWS_DIR=".github/workflows"

# Function to print colored output
log() {
    echo -e "${2:-$GREEN}$1${NC}"
}

error() {
    echo -e "${RED}ERROR: $1${NC}" >&2
}

warning() {
    echo -e "${YELLOW}WARNING: $1${NC}" >&2
}

info() {
    echo -e "${BLUE}INFO: $1${NC}"
}

# Check if act is installed
check_act() {
    if ! command -v act &> /dev/null; then
        error "act is not installed. Please install it first:"
        echo "  macOS: brew install act"
        echo "  Linux: curl https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash"
        echo "  Windows: choco install act-cli"
        exit 1
    fi
    
    local act_version=$(act --version | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)
    info "act version: $act_version"
}

# Check if Docker is running
check_docker() {
    if ! docker info &> /dev/null; then
        error "Docker is not running. Please start Docker Desktop."
        exit 1
    fi
    info "Docker is running"
}

# List available workflows
list_workflows() {
    log "Available workflows:" $BLUE
    echo
    find "$WORKFLOWS_DIR" -name "act-*.yml" -exec basename {} \; | sed 's/^/  /'
    echo
    log "Available jobs in each workflow:" $BLUE
    echo
    for workflow in "$WORKFLOWS_DIR"/act-*.yml; do
        if [ -f "$workflow" ]; then
            workflow_name=$(basename "$workflow")
            log "  $workflow_name:" $YELLOW
            act -l -W "$workflow" 2>/dev/null | grep -v "^INFO" | sed 's/^/    /' || echo "    No jobs found"
            echo
        fi
    done
}

# Run specific workflow
run_workflow() {
    local workflow="$1"
    local job="$2"
    local event="${3:-push}"
    
    # Determine workflow file
    local workflow_file=""
    case "$workflow" in
        ci|continuous-integration)
            workflow_file="$WORKFLOWS_DIR/act-ci.yml"
            ;;
        security|sec)
            workflow_file="$WORKFLOWS_DIR/act-security.yml"
            ;;
        performance|perf|bench)
            workflow_file="$WORKFLOWS_DIR/act-performance.yml"
            ;;
        build|validation|val)
            workflow_file="$WORKFLOWS_DIR/act-build-validation.yml"
            ;;
        *)
            if [ -f "$WORKFLOWS_DIR/act-$workflow.yml" ]; then
                workflow_file="$WORKFLOWS_DIR/act-$workflow.yml"
            elif [ -f "$WORKFLOWS_DIR/$workflow" ]; then
                workflow_file="$WORKFLOWS_DIR/$workflow"
            else
                error "Unknown workflow: $workflow"
                list_workflows
                exit 1
            fi
            ;;
    esac
    
    if [ ! -f "$workflow_file" ]; then
        error "Workflow file not found: $workflow_file"
        exit 1
    fi
    
    log "Running workflow: $(basename "$workflow_file")" $BLUE
    
    # Build act command
    local act_cmd="act $event -W $workflow_file"
    
    if [ -n "$job" ]; then
        act_cmd="$act_cmd -j $job"
        log "Running job: $job" $YELLOW
    fi
    
    # Add common flags
    act_cmd="$act_cmd --reuse --rm"
    
    log "Command: $act_cmd" $BLUE
    echo
    
    # Run the command
    eval "$act_cmd"
}

# Run quick tests
quick_test() {
    log "Running quick validation tests..." $GREEN
    echo
    
    log "1. Testing CI lint job..." $YELLOW
    act push -W "$WORKFLOWS_DIR/act-ci.yml" -j lint --reuse
    
    log "2. Testing build validation..." $YELLOW
    act push -W "$WORKFLOWS_DIR/act-build-validation.yml" -j dependency-validation --reuse
    
    log "Quick tests completed!" $GREEN
}

# Run full test suite
full_test() {
    log "Running full test suite..." $GREEN
    echo
    
    workflows=("act-ci.yml" "act-security.yml" "act-build-validation.yml")
    
    for workflow in "${workflows[@]}"; do
        workflow_path="$WORKFLOWS_DIR/$workflow"
        if [ -f "$workflow_path" ]; then
            log "Testing $workflow..." $YELLOW
            act push -W "$workflow_path" --reuse || warning "Workflow $workflow had issues"
        fi
    done
    
    log "Full test suite completed!" $GREEN
}

# Clean act containers and cache
clean() {
    log "Cleaning act containers and cache..." $YELLOW
    
    # Stop and remove act containers
    docker ps -a --filter "label=act" -q | xargs -r docker rm -f
    
    # Remove act images (optional - uncomment if needed)
    # docker images --filter "reference=catthehacker/*" -q | xargs -r docker rmi
    
    # Clean act cache
    act --rm &> /dev/null || true
    
    log "Cleanup completed!" $GREEN
}

# Show help
show_help() {
    cat << EOF
GitHub Actions Local Testing Script

Usage: $0 [COMMAND] [OPTIONS]

Commands:
    list                    List available workflows and jobs
    quick                   Run quick validation tests
    full                    Run full test suite
    clean                   Clean act containers and cache
    
    ci [job]               Run CI workflow (optionally specific job)
    security [job]         Run security workflow
    performance [job]      Run performance workflow  
    build [job]           Run build validation workflow

Examples:
    $0 list                         # List all workflows
    $0 quick                        # Quick tests
    $0 ci                          # Run full CI workflow
    $0 ci test                     # Run CI test job only
    $0 security secret-scan        # Run security secret scan
    $0 performance cli-performance # Run CLI performance benchmarks
    $0 build cross-platform-build # Run cross-platform build test
    $0 clean                       # Clean up containers

Options:
    -h, --help             Show this help message

Environment Variables:
    ACT_EVENT             Event type (default: push)
    ACT_PLATFORM          Platform override
    ACT_VERBOSE           Enable verbose output (set to 1)

EOF
}

# Main script logic
main() {
    local command="${1:-help}"
    
    case "$command" in
        -h|--help|help)
            show_help
            exit 0
            ;;
        list|ls)
            check_act
            list_workflows
            ;;
        quick|q)
            check_act
            check_docker
            quick_test
            ;;
        full|f)
            check_act
            check_docker
            full_test
            ;;
        clean|c)
            check_docker
            clean
            ;;
        ci|security|performance|build)
            check_act
            check_docker
            run_workflow "$1" "$2" "${ACT_EVENT:-push}"
            ;;
        *)
            error "Unknown command: $command"
            show_help
            exit 1
            ;;
    esac
}

# Set verbose mode if requested
if [ "${ACT_VERBOSE:-0}" = "1" ]; then
    set -x
fi

# Run main function with all arguments
main "$@"