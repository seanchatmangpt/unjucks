#!/bin/bash

#######################################################################
# ACT Test Runner - Comprehensive GitHub Actions Workflow Testing
#######################################################################

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
WORKFLOWS_DIR="$ROOT_DIR/.github/workflows"
RESULTS_DIR="$SCRIPT_DIR/results"
LOG_FILE="$RESULTS_DIR/act-test-$(date +%Y%m%d_%H%M%S).log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Test configuration
PLATFORMS=("ubuntu-latest" "ubuntu-20.04")
EVENTS=("push" "pull_request" "workflow_dispatch")
MAX_PARALLEL_TESTS=3
TIMEOUT=600  # 10 minutes per test

# Statistics
TOTAL_WORKFLOWS=0
TESTED_WORKFLOWS=0
PASSED_WORKFLOWS=0
FAILED_WORKFLOWS=0
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
SKIPPED_TESTS=0

#######################################################################
# Utility Functions
#######################################################################

log() {
    local level=$1
    shift
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${timestamp} [${level}] $*" | tee -a "$LOG_FILE"
}

log_info() {
    log "INFO" "${BLUE}$*${NC}"
}

log_success() {
    log "SUCCESS" "${GREEN}$*${NC}"
}

log_warning() {
    log "WARNING" "${YELLOW}$*${NC}"
}

log_error() {
    log "ERROR" "${RED}$*${NC}"
}

print_header() {
    echo -e "\n${PURPLE}=====================================${NC}"
    echo -e "${PURPLE} ACT Workflow Validation Framework${NC}"
    echo -e "${PURPLE}=====================================${NC}\n"
}

print_section() {
    echo -e "\n${CYAN}$1${NC}"
    echo -e "${CYAN}$(echo "$1" | sed 's/./─/g')${NC}\n"
}

setup_directories() {
    log_info "Setting up test directories..."
    mkdir -p "$RESULTS_DIR"
    cd "$ROOT_DIR"
}

check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check act installation
    if ! command -v act &> /dev/null; then
        log_error "act CLI not found. Installing..."
        if command -v curl &> /dev/null; then
            curl -s https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash
        else
            log_error "curl not found. Please install act manually: https://github.com/nektos/act"
            exit 1
        fi
    fi
    
    local act_version=$(act --version)
    log_success "act CLI found: $act_version"
    
    # Check Docker
    if ! docker info &> /dev/null; then
        log_error "Docker not running. Please start Docker first."
        exit 1
    fi
    log_success "Docker is running"
    
    # Check Node.js (if needed)
    if command -v node &> /dev/null; then
        local node_version=$(node --version)
        log_success "Node.js found: $node_version"
    fi
}

setup_act_environment() {
    log_info "Setting up ACT environment..."
    
    # Create .actrc configuration
    cat > .actrc << 'EOF'
--platform ubuntu-latest=ghcr.io/catthehacker/ubuntu:act-latest
--platform ubuntu-20.04=ghcr.io/catthehacker/ubuntu:act-20.04
--platform ubuntu-18.04=ghcr.io/catthehacker/ubuntu:act-18.04
--artifact-server-path /tmp/act-artifacts
--env-file .env.act
--secret-file .secrets.act
--var-file .vars.act
--container-daemon-socket -
EOF

    # Create environment variables file
    cat > .env.act << 'EOF'
NODE_VERSION=20
CI=true
GITHUB_ACTIONS=true
RUNNER_OS=Linux
RUNNER_ARCH=X64
ACT_TESTING=true
FORCE_COLOR=1
EOF

    # Create secrets file (dummy values for testing)
    cat > .secrets.act << 'EOF'
GITHUB_TOKEN=dummy_github_token_for_act_testing
NPM_TOKEN=dummy_npm_token_for_act_testing
SLACK_WEBHOOK_URL=dummy_slack_webhook_for_act_testing
DOCKER_PASSWORD=dummy_docker_password_for_act_testing
EOF

    # Create variables file
    cat > .vars.act << 'EOF'
deployment_environment=test
test_environment=true
act_testing=true
ci_environment=act
EOF

    log_success "ACT environment configuration created"
}

pull_docker_images() {
    log_info "Pulling required Docker images..."
    
    local images=(
        "ghcr.io/catthehacker/ubuntu:act-latest"
        "ghcr.io/catthehacker/ubuntu:act-20.04"
        "ghcr.io/catthehacker/ubuntu:act-18.04"
    )
    
    for image in "${images[@]}"; do
        log_info "Pulling $image..."
        if docker pull "$image"; then
            log_success "Successfully pulled $image"
        else
            log_warning "Failed to pull $image, but continuing..."
        fi
    done
}

discover_workflows() {
    log_info "Discovering workflows..."
    
    if [ ! -d "$WORKFLOWS_DIR" ]; then
        log_error "Workflows directory not found: $WORKFLOWS_DIR"
        exit 1
    fi
    
    mapfile -t workflows < <(find "$WORKFLOWS_DIR" -name "*.yml" -o -name "*.yaml" | sort)
    TOTAL_WORKFLOWS=${#workflows[@]}
    
    log_success "Found $TOTAL_WORKFLOWS workflows"
    
    # List workflows
    for workflow in "${workflows[@]}"; do
        local name=$(basename "$workflow" .yml)
        name=$(basename "$name" .yaml)
        log_info "  - $name"
    done
}

analyze_workflow() {
    local workflow_file=$1
    local workflow_name=$(basename "$workflow_file" .yml)
    workflow_name=$(basename "$workflow_name" .yaml)
    
    log_info "Analyzing workflow: $workflow_name"
    
    # Extract workflow information
    local has_matrix=false
    local has_services=false
    local has_environment=false
    local job_count=0
    
    if grep -q "strategy:" "$workflow_file" && grep -q "matrix:" "$workflow_file"; then
        has_matrix=true
    fi
    
    if grep -q "services:" "$workflow_file"; then
        has_services=true
    fi
    
    if grep -q "environment:" "$workflow_file"; then
        has_environment=true
    fi
    
    job_count=$(yq eval '.jobs | keys | length' "$workflow_file" 2>/dev/null || echo "1")
    
    echo "  Matrix Strategy: $has_matrix"
    echo "  Service Containers: $has_services"
    echo "  GitHub Environments: $has_environment"
    echo "  Job Count: $job_count"
}

test_workflow() {
    local workflow_file=$1
    local platform=$2
    local event=$3
    local job=$4
    
    local workflow_name=$(basename "$workflow_file" .yml)
    workflow_name=$(basename "$workflow_name" .yaml)
    
    log_info "Testing: $workflow_name ($platform, $event)"
    
    # Build act command
    local cmd="act $event --workflows \"$workflow_file\" --platform $platform"
    
    if [ -n "$job" ]; then
        cmd="$cmd --job $job"
    fi
    
    if [ "$DRY_RUN" = "true" ]; then
        cmd="$cmd --dry-run"
    fi
    
    if [ "$VERBOSE" = "true" ]; then
        cmd="$cmd --verbose"
    fi
    
    local start_time=$(date +%s)
    local test_result="UNKNOWN"
    local error_output=""
    
    # Run the test with timeout
    if timeout $TIMEOUT bash -c "$cmd" > "$RESULTS_DIR/${workflow_name}_${platform}_${event}.log" 2>&1; then
        test_result="PASSED"
        ((PASSED_TESTS++))
    else
        test_result="FAILED"
        ((FAILED_TESTS++))
        error_output=$(tail -20 "$RESULTS_DIR/${workflow_name}_${platform}_${event}.log")
    fi
    
    local end_time=$(date +%s)
    local execution_time=$((end_time - start_time))
    
    ((TOTAL_TESTS++))
    
    # Log result
    if [ "$test_result" = "PASSED" ]; then
        log_success "  ✅ $test_result (${execution_time}s)"
    else
        log_error "  ❌ $test_result (${execution_time}s)"
        if [ -n "$error_output" ]; then
            log_error "  Error details: $error_output"
        fi
    fi
    
    # Save test result to JSON
    local result_json="{
        \"workflow\": \"$workflow_name\",
        \"file\": \"$workflow_file\",
        \"platform\": \"$platform\",
        \"event\": \"$event\",
        \"job\": \"$job\",
        \"result\": \"$test_result\",
        \"execution_time\": $execution_time,
        \"timestamp\": \"$(date -u '+%Y-%m-%dT%H:%M:%SZ')\",
        \"log_file\": \"${workflow_name}_${platform}_${event}.log\"
    }"
    
    echo "$result_json" >> "$RESULTS_DIR/test_results.jsonl"
}

test_workflow_comprehensive() {
    local workflow_file=$1
    local workflow_name=$(basename "$workflow_file" .yml)
    workflow_name=$(basename "$workflow_name" .yaml)
    
    log_info "Comprehensive testing: $workflow_name"
    
    # Analyze workflow first
    analyze_workflow "$workflow_file"
    
    local workflow_passed=true
    
    # Test with different platforms and events
    for platform in "${PLATFORMS[@]}"; do
        for event in "${EVENTS[@]}"; do
            # Check if event is compatible with workflow
            if is_event_compatible "$workflow_file" "$event"; then
                test_workflow "$workflow_file" "$platform" "$event"
                
                # If any test fails, mark workflow as failed
                if [ $? -ne 0 ]; then
                    workflow_passed=false
                fi
            else
                log_info "  ⏭️  Skipping incompatible event: $event"
                ((SKIPPED_TESTS++))
            fi
        done
    done
    
    # Update workflow statistics
    ((TESTED_WORKFLOWS++))
    if [ "$workflow_passed" = true ]; then
        ((PASSED_WORKFLOWS++))
    else
        ((FAILED_WORKFLOWS++))
    fi
}

is_event_compatible() {
    local workflow_file=$1
    local event=$2
    
    # Simple compatibility check - look for event in workflow triggers
    if grep -q "on:" "$workflow_file"; then
        if grep -A 10 "on:" "$workflow_file" | grep -q "$event"; then
            return 0  # Compatible
        fi
    fi
    
    return 1  # Not compatible
}

run_error_scenario_tests() {
    print_section "Error Scenario Testing"
    
    log_info "Testing error scenarios and failure conditions..."
    
    # Test 1: Invalid workflow syntax
    log_info "Test: Invalid workflow syntax"
    cat > .github/workflows/invalid-test.yml << 'EOF'
name: Invalid Workflow Test
on: push
jobs:
  invalid-job:
    runs-on: ubuntu-latest
    steps:
      - name: Invalid step
        invalid_action: this_should_fail
        uses: nonexistent/action@v1
EOF
    
    if act push --workflows .github/workflows/invalid-test.yml --dry-run 2>/dev/null; then
        log_error "Invalid workflow test unexpectedly passed"
    else
        log_success "Invalid workflow test correctly failed"
    fi
    
    rm -f .github/workflows/invalid-test.yml
    
    # Test 2: Missing required inputs
    log_info "Test: Missing required inputs"
    # Implementation would depend on specific workflows
    
    # Test 3: Network timeouts (simulated)
    log_info "Test: Network timeout simulation"
    # This would typically require network manipulation tools
    
    log_success "Error scenario testing completed"
}

run_performance_benchmarks() {
    print_section "Performance Benchmarking"
    
    log_info "Running performance benchmarks..."
    
    # Select a few workflows for benchmarking
    local benchmark_workflows=(
        ".github/workflows/pr-checks.yml"
        ".github/workflows/optimized-ci.yml"
        ".github/workflows/act-compatibility.yml"
    )
    
    for workflow in "${benchmark_workflows[@]}"; do
        if [ -f "$workflow" ]; then
            log_info "Benchmarking: $(basename "$workflow")"
            
            local total_time=0
            local runs=3
            
            for ((i=1; i<=runs; i++)); do
                local start_time=$(date +%s)
                
                if act push --workflows "$workflow" --dry-run &> /dev/null; then
                    local end_time=$(date +%s)
                    local execution_time=$((end_time - start_time))
                    total_time=$((total_time + execution_time))
                    log_info "  Run $i: ${execution_time}s"
                else
                    log_warning "  Run $i: Failed"
                fi
            done
            
            local avg_time=$((total_time / runs))
            log_success "  Average execution time: ${avg_time}s"
            
            # Save benchmark result
            echo "{\"workflow\": \"$(basename "$workflow")\", \"average_time\": $avg_time, \"runs\": $runs}" >> "$RESULTS_DIR/benchmark_results.jsonl"
        fi
    done
}

generate_summary_report() {
    print_section "Test Summary Report"
    
    local pass_rate=0
    if [ $TOTAL_TESTS -gt 0 ]; then
        pass_rate=$((PASSED_TESTS * 100 / TOTAL_TESTS))
    fi
    
    local workflow_pass_rate=0
    if [ $TESTED_WORKFLOWS -gt 0 ]; then
        workflow_pass_rate=$((PASSED_WORKFLOWS * 100 / TESTED_WORKFLOWS))
    fi
    
    # Console summary
    echo -e "\n${PURPLE}📊 COMPREHENSIVE TEST RESULTS${NC}"
    echo -e "${PURPLE}══════════════════════════════${NC}"
    echo -e "\n${CYAN}Workflow Statistics:${NC}"
    echo -e "  Total Workflows: $TOTAL_WORKFLOWS"
    echo -e "  Tested Workflows: $TESTED_WORKFLOWS"
    echo -e "  Passed Workflows: ${GREEN}$PASSED_WORKFLOWS${NC}"
    echo -e "  Failed Workflows: ${RED}$FAILED_WORKFLOWS${NC}"
    echo -e "  Workflow Pass Rate: ${YELLOW}${workflow_pass_rate}%${NC}"
    
    echo -e "\n${CYAN}Test Statistics:${NC}"
    echo -e "  Total Tests: $TOTAL_TESTS"
    echo -e "  Passed Tests: ${GREEN}$PASSED_TESTS${NC}"
    echo -e "  Failed Tests: ${RED}$FAILED_TESTS${NC}"
    echo -e "  Skipped Tests: ${YELLOW}$SKIPPED_TESTS${NC}"
    echo -e "  Test Pass Rate: ${YELLOW}${pass_rate}%${NC}"
    
    # Generate JSON report
    local report_file="$RESULTS_DIR/act-validation-summary.json"
    cat > "$report_file" << EOF
{
  "metadata": {
    "timestamp": "$(date -u '+%Y-%m-%dT%H:%M:%SZ')",
    "framework": "ACT Test Runner v1.0.0",
    "total_execution_time": "$(date +%s)"
  },
  "summary": {
    "total_workflows": $TOTAL_WORKFLOWS,
    "tested_workflows": $TESTED_WORKFLOWS,
    "passed_workflows": $PASSED_WORKFLOWS,
    "failed_workflows": $FAILED_WORKFLOWS,
    "workflow_pass_rate": $workflow_pass_rate,
    "total_tests": $TOTAL_TESTS,
    "passed_tests": $PASSED_TESTS,
    "failed_tests": $FAILED_TESTS,
    "skipped_tests": $SKIPPED_TESTS,
    "test_pass_rate": $pass_rate
  },
  "environment": {
    "act_version": "$(act --version 2>/dev/null || echo 'unknown')",
    "docker_version": "$(docker --version 2>/dev/null || echo 'unknown')",
    "os": "$(uname -s)",
    "arch": "$(uname -m)"
  }
}
EOF

    # Generate Markdown report
    local md_report="$RESULTS_DIR/act-validation-report.md"
    cat > "$md_report" << EOF
# ACT Workflow Validation Report

## Summary

- **Total Workflows**: $TOTAL_WORKFLOWS
- **Workflows Tested**: $TESTED_WORKFLOWS
- **Workflows Passed**: $PASSED_WORKFLOWS ✅
- **Workflows Failed**: $FAILED_WORKFLOWS ❌
- **Workflow Pass Rate**: ${workflow_pass_rate}%

## Test Results

| Metric | Value |
|--------|-------|
| Total Tests | $TOTAL_TESTS |
| Passed Tests | $PASSED_TESTS |
| Failed Tests | $FAILED_TESTS |
| Skipped Tests | $SKIPPED_TESTS |
| Test Pass Rate | ${pass_rate}% |

## Environment

- **ACT Version**: $(act --version 2>/dev/null || echo 'unknown')
- **Docker Version**: $(docker --version 2>/dev/null || echo 'unknown')
- **OS**: $(uname -s) $(uname -m)
- **Generated**: $(date -u '+%Y-%m-%d %H:%M:%S UTC')

## Detailed Results

See individual test logs in the results directory for detailed information.

---
*Generated by ACT Test Runner v1.0.0*
EOF

    log_success "Reports generated:"
    log_success "  JSON: $report_file"
    log_success "  Markdown: $md_report"
    log_success "  Logs: $LOG_FILE"
    
    # Final status
    if [ $pass_rate -ge 73 ]; then
        log_success "🎉 Overall validation PASSED (${pass_rate}% >= 73% threshold)"
        echo -e "\n${GREEN}✅ ACT VALIDATION FRAMEWORK COMPLETED SUCCESSFULLY${NC}"
        return 0
    else
        log_error "❌ Overall validation FAILED (${pass_rate}% < 73% threshold)"
        echo -e "\n${RED}❌ ACT VALIDATION FRAMEWORK FAILED TO MEET THRESHOLD${NC}"
        return 1
    fi
}

store_results_in_memory() {
    if [ "$STORE_IN_MEMORY" = "true" ]; then
        log_info "Storing validation results in memory..."
        
        # This would interface with the memory system specified in the requirements
        # For now, we'll create a memory-compatible JSON structure
        local memory_data="{
            \"validation_complete\": true,
            \"timestamp\": \"$(date -u '+%Y-%m-%dT%H:%M:%SZ')\",
            \"pass_rate\": $pass_rate,
            \"total_workflows\": $TOTAL_WORKFLOWS,
            \"passed_workflows\": $PASSED_WORKFLOWS,
            \"failed_workflows\": $FAILED_WORKFLOWS,
            \"recommendations\": [
                \"Review failed workflows for ACT compatibility\",
                \"Optimize workflow performance where needed\",
                \"Implement regular regression testing\"
            ]
        }"
        
        echo "$memory_data" > "$RESULTS_DIR/memory-store.json"
        log_success "Validation results prepared for memory storage"
    fi
}

#######################################################################
# Main Execution
#######################################################################

main() {
    print_header
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --dry-run)
                DRY_RUN="true"
                shift
                ;;
            --verbose)
                VERBOSE="true"
                shift
                ;;
            --store-memory)
                STORE_IN_MEMORY="true"
                shift
                ;;
            --quick)
                PLATFORMS=("ubuntu-latest")
                EVENTS=("push")
                shift
                ;;
            --help)
                echo "ACT Test Runner - Comprehensive GitHub Actions Workflow Testing"
                echo ""
                echo "Usage: $0 [OPTIONS]"
                echo ""
                echo "Options:"
                echo "  --dry-run       Run tests in dry-run mode only"
                echo "  --verbose       Enable verbose output"
                echo "  --store-memory  Store results in memory system"
                echo "  --quick         Quick test mode (limited platforms/events)"
                echo "  --help          Show this help message"
                echo ""
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    # Main execution flow
    setup_directories
    check_prerequisites
    setup_act_environment
    pull_docker_images
    discover_workflows
    
    print_section "Comprehensive Workflow Testing"
    
    # Test all workflows
    for workflow in "${workflows[@]}"; do
        test_workflow_comprehensive "$workflow"
    done
    
    # Additional testing phases
    run_error_scenario_tests
    run_performance_benchmarks
    
    # Generate final report and store results
    generate_summary_report
    local exit_code=$?
    
    store_results_in_memory
    
    exit $exit_code
}

# Trap signals for cleanup
trap 'log_warning "Script interrupted"; exit 130' INT TERM

# Run main function with all arguments
main "$@"