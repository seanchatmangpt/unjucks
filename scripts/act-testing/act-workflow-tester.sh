#!/bin/bash

# Act Workflow Tester - Comprehensive GitHub Actions testing with act
# 
# This script provides comprehensive testing capabilities for GitHub Actions workflows
# using act, with support for different test modes, platforms, and detailed reporting.
#
# Usage:
#   ./act-workflow-tester.sh [command] [options]
#
# Commands:
#   quick       - Run quick compatibility tests
#   full        - Run comprehensive test suite
#   ci          - Test CI/CD workflows specifically
#   security    - Test security scanning workflows
#   performance - Test performance workflows
#   matrix      - Test matrix build strategies
#   services    - Test service container workflows
#   clean       - Clean up test artifacts
#
# Options:
#   --dry-run   - Only validate workflow syntax
#   --verbose   - Enable verbose output
#   --parallel  - Run tests in parallel
#   --platform  - Specify platform (ubuntu-latest, ubuntu-22.04, etc.)
#   --workflow  - Test specific workflow file
#   --job       - Test specific job within workflow
#   --help      - Show this help message

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
WORKFLOWS_DIR="${PROJECT_ROOT}/.github/workflows"
RESULTS_DIR="${PROJECT_ROOT}/test-results/act"
LOGS_DIR="${RESULTS_DIR}/logs"
REPORTS_DIR="${RESULTS_DIR}/reports"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
SKIPPED_TESTS=0

# Options
DRY_RUN=false
VERBOSE=false
PARALLEL=false
PLATFORM=""
WORKFLOW_FILE=""
JOB_NAME=""
TIMEOUT=300

# Act configuration
ACT_PLATFORM_MAPPINGS=(
    "ubuntu-latest=catthehacker/ubuntu:act-latest"
    "ubuntu-22.04=catthehacker/ubuntu:act-22.04"
    "ubuntu-20.04=catthehacker/ubuntu:act-20.04"
    "windows-latest=catthehacker/ubuntu:act-latest"
    "macos-latest=catthehacker/ubuntu:act-latest"
)

ACT_DEFAULT_OPTIONS=(
    "--artifact-server-path /tmp/artifacts"
    "--reuse"
    "--env CI=true"
    "--env GITHUB_ACTIONS=true"
    "--env RUNNER_OS=Linux"
    "--env RUNNER_ARCH=X64"
)

# Logging functions
log_info() {
    echo -e "${BLUE}ℹ️  INFO:${NC} $1"
}

log_success() {
    echo -e "${GREEN}✅ SUCCESS:${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}⚠️  WARNING:${NC} $1"
}

log_error() {
    echo -e "${RED}❌ ERROR:${NC} $1"
}

log_debug() {
    if [[ "${VERBOSE}" == "true" ]]; then
        echo -e "${PURPLE}🔍 DEBUG:${NC} $1"
    fi
}

# Help function
show_help() {
    cat << EOF
Act Workflow Tester - Comprehensive GitHub Actions testing

USAGE:
    $0 [COMMAND] [OPTIONS]

COMMANDS:
    quick           Run quick compatibility tests (syntax validation)
    full            Run comprehensive test suite (all tests)
    ci              Test CI/CD workflows specifically
    security        Test security scanning workflows
    performance     Test performance workflows
    matrix          Test matrix build strategies
    services        Test service container workflows
    docker          Test Docker-related workflows
    lint            Test linting and code quality workflows
    clean           Clean up test artifacts and containers
    list            List all available workflows
    validate        Validate act configuration

OPTIONS:
    --dry-run       Only validate workflow syntax, don't execute
    --verbose       Enable verbose output and debugging
    --parallel      Run compatible tests in parallel (experimental)
    --platform P    Specify platform (ubuntu-latest, ubuntu-22.04, etc.)
    --workflow W    Test specific workflow file (e.g., ci.yml)
    --job J         Test specific job within workflow
    --timeout T     Set timeout in seconds (default: 300)
    --help          Show this help message

EXAMPLES:
    $0 quick                                    # Quick syntax validation
    $0 full --verbose                          # Full test suite with verbose output
    $0 ci --workflow ci.yml                    # Test specific CI workflow
    $0 matrix --platform ubuntu-22.04         # Test matrix builds on specific platform
    $0 services --dry-run                      # Validate service container workflows
    $0 clean                                   # Clean up test artifacts

ENVIRONMENT VARIABLES:
    ACT_SECRETS_FILE    Path to secrets file for act
    ACT_CONFIG_FILE     Path to custom act configuration
    DOCKER_HOST         Docker daemon host (if not default)

For more information, visit: https://github.com/nektos/act
EOF
}

# Prerequisites check
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check act installation
    if ! command -v act &> /dev/null; then
        log_error "act is not installed. Please install from: https://github.com/nektos/act#installation"
        return 1
    fi
    
    local act_version
    act_version=$(act --version 2>&1 | head -n1)
    log_success "Found act: ${act_version}"
    
    # Check Docker installation
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed or not in PATH"
        return 1
    fi
    
    local docker_version
    docker_version=$(docker --version)
    log_success "Found Docker: ${docker_version}"
    
    # Check Docker daemon
    if ! docker info &> /dev/null; then
        log_error "Docker daemon is not running"
        return 1
    fi
    
    log_success "Docker daemon is running"
    
    # Check workflows directory
    if [[ ! -d "${WORKFLOWS_DIR}" ]]; then
        log_error "Workflows directory not found: ${WORKFLOWS_DIR}"
        return 1
    fi
    
    local workflow_count
    workflow_count=$(find "${WORKFLOWS_DIR}" -name "*.yml" -o -name "*.yaml" | wc -l)
    log_success "Found ${workflow_count} workflow files"
    
    return 0
}

# Setup function
setup_test_environment() {
    log_info "Setting up test environment..."
    
    # Create directories
    mkdir -p "${RESULTS_DIR}" "${LOGS_DIR}" "${REPORTS_DIR}"
    
    # Create act configuration if it doesn't exist
    if [[ ! -f "${PROJECT_ROOT}/.actrc" ]]; then
        log_info "Creating default .actrc configuration..."
        create_default_actrc
    fi
    
    # Create secrets file for testing
    create_test_secrets_file
    
    log_success "Test environment setup complete"
}

create_default_actrc() {
    cat > "${PROJECT_ROOT}/.actrc" << 'EOF'
# Act configuration for workflow testing
# Platform mappings
-P ubuntu-latest=catthehacker/ubuntu:act-latest
-P ubuntu-22.04=catthehacker/ubuntu:act-22.04
-P ubuntu-20.04=catthehacker/ubuntu:act-20.04
-P windows-latest=catthehacker/ubuntu:act-latest
-P macos-latest=catthehacker/ubuntu:act-latest

# Default environment variables
--env CI=true
--env GITHUB_ACTIONS=true
--env RUNNER_OS=Linux
--env RUNNER_ARCH=X64

# Default secrets
--secret GITHUB_TOKEN=ghp_mock_token_for_local_testing

# Artifact settings
--artifact-server-path /tmp/artifacts

# Performance optimizations
--reuse
--rm=false

# Networking
--bind
EOF
    log_success "Created default .actrc configuration"
}

create_test_secrets_file() {
    local secrets_file="${RESULTS_DIR}/test-secrets.env"
    cat > "${secrets_file}" << 'EOF'
GITHUB_TOKEN=ghp_mock_token_for_testing
NPM_TOKEN=npm_mock_token_for_testing
CODECOV_TOKEN=codecov_mock_token
SNYK_TOKEN=snyk_mock_token
TEST_SECRET=test_value_123
DOCKER_USERNAME=test_user
DOCKER_PASSWORD=test_password
EOF
    log_debug "Created test secrets file: ${secrets_file}"
}

# Workflow discovery
discover_workflows() {
    local pattern="${1:-*.yml}"
    find "${WORKFLOWS_DIR}" -name "${pattern}" -o -name "*.yaml" | sort
}

list_workflows() {
    log_info "Available workflows:"
    local workflows
    workflows=$(discover_workflows)
    
    if [[ -z "${workflows}" ]]; then
        log_warning "No workflow files found"
        return 1
    fi
    
    local count=0
    while IFS= read -r workflow; do
        local name
        name=$(basename "${workflow}")
        local size
        size=$(stat -f%z "${workflow}" 2>/dev/null || stat -c%s "${workflow}" 2>/dev/null || echo "unknown")
        printf "  ${CYAN}%-30s${NC} (%s bytes)\n" "${name}" "${size}"
        ((count++))
    done <<< "${workflows}"
    
    log_info "Total: ${count} workflows"
}

# Test execution functions
run_test() {
    local test_name="$1"
    local test_command="$2"
    local log_file="${LOGS_DIR}/${test_name}.log"
    
    ((TOTAL_TESTS++))
    
    log_info "Running test: ${test_name}"
    log_debug "Command: ${test_command}"
    log_debug "Log file: ${log_file}"
    
    local start_time
    start_time=$(date +%s)
    
    # Execute test with timeout
    if timeout "${TIMEOUT}" bash -c "${test_command}" > "${log_file}" 2>&1; then
        local end_time
        end_time=$(date +%s)
        local duration=$((end_time - start_time))
        
        ((PASSED_TESTS++))
        log_success "${test_name} passed (${duration}s)"
        return 0
    else
        local exit_code=$?
        local end_time
        end_time=$(date +%s)
        local duration=$((end_time - start_time))
        
        ((FAILED_TESTS++))
        log_error "${test_name} failed (${duration}s, exit code: ${exit_code})"
        
        if [[ "${VERBOSE}" == "true" ]]; then
            echo "--- Last 10 lines of log ---"
            tail -n 10 "${log_file}" || true
            echo "--- End of log ---"
        fi
        
        return ${exit_code}
    fi
}

# Test categories
test_workflow_syntax() {
    log_info "Testing workflow syntax validation..."
    
    local workflows
    workflows=$(discover_workflows)
    
    while IFS= read -r workflow; do
        local name
        name=$(basename "${workflow}")
        local test_name="syntax-${name}"
        
        if [[ -n "${WORKFLOW_FILE}" && "${name}" != "${WORKFLOW_FILE}" ]]; then
            continue
        fi
        
        local command="act --dry-run -W '${workflow}'"
        run_test "${test_name}" "${command}"
    done <<< "${workflows}"
}

test_basic_workflows() {
    log_info "Testing basic workflow execution..."
    
    local basic_workflows=(
        "ci.yml"
        "nodejs-ci.yml"
        "checks.yml"
    )
    
    for workflow in "${basic_workflows[@]}"; do
        local workflow_path="${WORKFLOWS_DIR}/${workflow}"
        
        if [[ ! -f "${workflow_path}" ]]; then
            log_warning "Workflow not found: ${workflow}"
            continue
        fi
        
        if [[ -n "${WORKFLOW_FILE}" && "${workflow}" != "${WORKFLOW_FILE}" ]]; then
            continue
        fi
        
        local test_name="basic-${workflow}"
        local command="act push -W '${workflow_path}'"
        
        if [[ "${DRY_RUN}" == "true" ]]; then
            command="${command} --dry-run"
        fi
        
        if [[ -n "${JOB_NAME}" ]]; then
            command="${command} --job '${JOB_NAME}'"
        fi
        
        run_test "${test_name}" "${command}"
    done
}

test_ci_workflows() {
    log_info "Testing CI/CD workflows..."
    
    local ci_workflows=(
        "ci.yml"
        "ci-main.yml"
        "nodejs-ci.yml"
        "cross-platform-ci.yml"
        "ci-cd-validation.yml"
    )
    
    for workflow in "${ci_workflows[@]}"; do
        local workflow_path="${WORKFLOWS_DIR}/${workflow}"
        
        if [[ ! -f "${workflow_path}" ]]; then
            log_debug "CI workflow not found: ${workflow}"
            continue
        fi
        
        if [[ -n "${WORKFLOW_FILE}" && "${workflow}" != "${WORKFLOW_FILE}" ]]; then
            continue
        fi
        
        local test_name="ci-${workflow}"
        local command="act push -W '${workflow_path}'"
        
        if [[ "${DRY_RUN}" == "true" ]]; then
            command="${command} --dry-run"
        fi
        
        if [[ -n "${PLATFORM}" ]]; then
            command="${command} -P '${PLATFORM}'"
        fi
        
        run_test "${test_name}" "${command}"
    done
}

test_security_workflows() {
    log_info "Testing security scanning workflows..."
    
    local security_workflows=(
        "security.yml"
        "security-scanning.yml"
        "act-security.yml"
    )
    
    for workflow in "${security_workflows[@]}"; do
        local workflow_path="${WORKFLOWS_DIR}/${workflow}"
        
        if [[ ! -f "${workflow_path}" ]]; then
            log_debug "Security workflow not found: ${workflow}"
            continue
        fi
        
        if [[ -n "${WORKFLOW_FILE}" && "${workflow}" != "${WORKFLOW_FILE}" ]]; then
            continue
        fi
        
        local test_name="security-${workflow}"
        local command="act push -W '${workflow_path}'"
        
        if [[ "${DRY_RUN}" == "true" ]]; then
            command="${command} --dry-run"
        fi
        
        # Security workflows often need secrets
        local secrets_file="${RESULTS_DIR}/test-secrets.env"
        if [[ -f "${secrets_file}" ]]; then
            command="${command} --secret-file '${secrets_file}'"
        fi
        
        run_test "${test_name}" "${command}"
    done
}

test_performance_workflows() {
    log_info "Testing performance workflows..."
    
    local performance_workflows=(
        "performance.yml"
        "performance-benchmarks.yml"
        "act-performance.yml"
    )
    
    for workflow in "${performance_workflows[@]}"; do
        local workflow_path="${WORKFLOWS_DIR}/${workflow}"
        
        if [[ ! -f "${workflow_path}" ]]; then
            log_debug "Performance workflow not found: ${workflow}"
            continue
        fi
        
        if [[ -n "${WORKFLOW_FILE}" && "${workflow}" != "${WORKFLOW_FILE}" ]]; then
            continue
        fi
        
        local test_name="performance-${workflow}"
        local command="act push -W '${workflow_path}'"
        
        if [[ "${DRY_RUN}" == "true" ]]; then
            command="${command} --dry-run"
        fi
        
        # Performance tests may need longer timeout
        TIMEOUT=600
        
        run_test "${test_name}" "${command}"
        
        # Reset timeout
        TIMEOUT=300
    done
}

test_matrix_builds() {
    log_info "Testing matrix build strategies..."
    
    local matrix_workflows=(
        "cross-platform-ci.yml"
        "comprehensive-testing.yml"
        "docker-validation.yml"
    )
    
    for workflow in "${matrix_workflows[@]}"; do
        local workflow_path="${WORKFLOWS_DIR}/${workflow}"
        
        if [[ ! -f "${workflow_path}" ]]; then
            log_debug "Matrix workflow not found: ${workflow}"
            continue
        fi
        
        if [[ -n "${WORKFLOW_FILE}" && "${workflow}" != "${WORKFLOW_FILE}" ]]; then
            continue
        fi
        
        local test_name="matrix-${workflow}"
        local command="act push -W '${workflow_path}'"
        
        if [[ "${DRY_RUN}" == "true" ]]; then
            command="${command} --dry-run"
        fi
        
        # Test specific matrix combinations
        if [[ "${workflow}" == "cross-platform-ci.yml" ]]; then
            command="${command} --matrix node-version:20 --matrix os:ubuntu-latest"
        fi
        
        run_test "${test_name}" "${command}"
    done
}

test_service_containers() {
    log_info "Testing service container workflows..."
    
    local service_workflows=(
        "docker-validation.yml"
        "production-validation.yml"
    )
    
    for workflow in "${service_workflows[@]}"; do
        local workflow_path="${WORKFLOWS_DIR}/${workflow}"
        
        if [[ ! -f "${workflow_path}" ]]; then
            log_debug "Service workflow not found: ${workflow}"
            continue
        fi
        
        if [[ -n "${WORKFLOW_FILE}" && "${workflow}" != "${WORKFLOW_FILE}" ]]; then
            continue
        fi
        
        local test_name="services-${workflow}"
        local command="act push -W '${workflow_path}' --bind"
        
        if [[ "${DRY_RUN}" == "true" ]]; then
            command="${command} --dry-run"
        fi
        
        # Service containers may need specific jobs
        if [[ "${workflow}" == "docker-validation.yml" ]]; then
            command="${command} --job production-simulation"
        fi
        
        run_test "${test_name}" "${command}"
    done
}

test_docker_workflows() {
    log_info "Testing Docker-related workflows..."
    
    local docker_workflows=(
        "docker-validation.yml"
        "docker-deployment.yml"
        "act-build-validation.yml"
    )
    
    for workflow in "${docker_workflows[@]}"; do
        local workflow_path="${WORKFLOWS_DIR}/${workflow}"
        
        if [[ ! -f "${workflow_path}" ]]; then
            log_debug "Docker workflow not found: ${workflow}"
            continue
        fi
        
        if [[ -n "${WORKFLOW_FILE}" && "${workflow}" != "${WORKFLOW_FILE}" ]]; then
            continue
        fi
        
        local test_name="docker-${workflow}"
        local command="act push -W '${workflow_path}' --bind"
        
        if [[ "${DRY_RUN}" == "true" ]]; then
            command="${command} --dry-run"
        fi
        
        run_test "${test_name}" "${command}"
    done
}

# Report generation
generate_report() {
    log_info "Generating test report..."
    
    local report_file="${REPORTS_DIR}/act-test-report.md"
    local json_report="${REPORTS_DIR}/act-test-report.json"
    
    # Generate markdown report
    cat > "${report_file}" << EOF
# Act Workflow Testing Report

## Summary

- **Total Tests**: ${TOTAL_TESTS}
- **Passed**: ${PASSED_TESTS}
- **Failed**: ${FAILED_TESTS}
- **Skipped**: ${SKIPPED_TESTS}
- **Success Rate**: $(( TOTAL_TESTS > 0 ? (PASSED_TESTS * 100) / TOTAL_TESTS : 0 ))%

## Environment

- **Date**: $(date)
- **Act Version**: $(act --version 2>&1 | head -n1)
- **Docker Version**: $(docker --version)
- **Platform**: $(uname -s) $(uname -m)

## Test Results

EOF

    # Add individual test results
    if [[ -d "${LOGS_DIR}" ]]; then
        for log_file in "${LOGS_DIR}"/*.log; do
            if [[ -f "${log_file}" ]]; then
                local test_name
                test_name=$(basename "${log_file}" .log)
                local status="❌ FAILED"
                
                # Check if test passed (basic heuristic)
                if grep -q "successful\|completed\|passed" "${log_file}" 2>/dev/null; then
                    status="✅ PASSED"
                fi
                
                echo "### ${test_name}" >> "${report_file}"
                echo "" >> "${report_file}"
                echo "**Status**: ${status}" >> "${report_file}"
                echo "" >> "${report_file}"
                echo "\`\`\`" >> "${report_file}"
                tail -n 20 "${log_file}" >> "${report_file}" 2>/dev/null || echo "No log output" >> "${report_file}"
                echo "\`\`\`" >> "${report_file}"
                echo "" >> "${report_file}"
            fi
        done
    fi
    
    # Add recommendations
    cat >> "${report_file}" << 'EOF'
## Known Limitations and Workarounds

### GitHub Actions Features Not Fully Supported in Act

1. **GitHub API Access**: Limited access to GitHub APIs (github-script actions)
2. **External Services**: Codecov, Snyk, and other external integrations
3. **Deployment Actions**: GitHub Pages, releases, and deployment statuses
4. **Service Containers**: May not behave exactly like in GitHub Actions
5. **Matrix Parallelism**: Limited compared to GitHub Actions
6. **Platform Differences**: macOS and Windows simulation limitations

### Recommended Workarounds

1. **Use Environment Variables**: Add conditionals for local testing
   ```yaml
   - name: Skip in act
     if: ${{ !env.ACT }}
     run: echo "This step runs only in GitHub Actions"
   ```

2. **Mock External Services**: Replace API calls with local alternatives
   ```yaml
   - name: Mock API call
     run: |
       if [ "$ACT" = "true" ]; then
         echo "Mocking API call for local testing"
       else
         curl -X POST https://api.example.com/webhook
       fi
   ```

3. **Simplify Service Dependencies**: Use minimal configurations for testing
   ```yaml
   services:
     postgres:
       image: postgres:13-alpine  # Use lighter images
       env:
         POSTGRES_PASSWORD: test  # Simple test credentials
   ```

4. **Create Act-Specific Workflows**: Maintain separate workflows for local testing
   ```yaml
   # .github/workflows/act-ci.yml
   name: Act CI
   on: [push, pull_request]
   jobs:
     test:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - name: Simple test
           run: npm test
   ```

## Next Steps

1. **Fix Failing Tests**: Address the failed tests by implementing workarounds
2. **Update Workflows**: Add act compatibility improvements to workflows
3. **Documentation**: Create team guidelines for act usage
4. **Automation**: Integrate act testing into development workflow
5. **Monitoring**: Set up regular act compatibility checks

EOF
    
    # Generate JSON report
    cat > "${json_report}" << EOF
{
  "summary": {
    "total": ${TOTAL_TESTS},
    "passed": ${PASSED_TESTS},
    "failed": ${FAILED_TESTS},
    "skipped": ${SKIPPED_TESTS},
    "successRate": $(( TOTAL_TESTS > 0 ? (PASSED_TESTS * 100) / TOTAL_TESTS : 0 ))
  },
  "environment": {
    "date": "$(date -Iseconds)",
    "actVersion": "$(act --version 2>&1 | head -n1)",
    "dockerVersion": "$(docker --version)",
    "platform": "$(uname -s) $(uname -m)"
  },
  "options": {
    "dryRun": ${DRY_RUN},
    "verbose": ${VERBOSE},
    "parallel": ${PARALLEL},
    "platform": "${PLATFORM}",
    "workflow": "${WORKFLOW_FILE}",
    "job": "${JOB_NAME}",
    "timeout": ${TIMEOUT}
  }
}
EOF
    
    log_success "Report generated: ${report_file}"
    log_success "JSON report generated: ${json_report}"
}

# Cleanup function
cleanup_test_artifacts() {
    log_info "Cleaning up test artifacts..."
    
    # Stop and remove act containers
    log_info "Stopping act containers..."
    docker ps -a --filter "label=act" --format "{{.ID}}" | xargs -r docker rm -f || true
    
    # Clean up act images (optional)
    if [[ "${1:-}" == "--images" ]]; then
        log_info "Removing act images..."
        docker images --filter "reference=catthehacker/ubuntu" --format "{{.ID}}" | xargs -r docker rmi -f || true
    fi
    
    # Clean up test artifacts
    if [[ -d "${RESULTS_DIR}" ]]; then
        log_info "Cleaning up test results..."
        rm -rf "${RESULTS_DIR}/logs"/*
        rm -rf "${RESULTS_DIR}/reports"/*
    fi
    
    # Clean up temporary files
    rm -f /tmp/act-* 2>/dev/null || true
    rm -rf /tmp/artifacts/* 2>/dev/null || true
    
    log_success "Cleanup completed"
}

# Main command processing
main() {
    local command="${1:-help}"
    shift || true
    
    # Parse options
    while [[ $# -gt 0 ]]; do
        case $1 in
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            --verbose)
                VERBOSE=true
                shift
                ;;
            --parallel)
                PARALLEL=true
                shift
                ;;
            --platform)
                PLATFORM="$2"
                shift 2
                ;;
            --workflow)
                WORKFLOW_FILE="$2"
                shift 2
                ;;
            --job)
                JOB_NAME="$2"
                shift 2
                ;;
            --timeout)
                TIMEOUT="$2"
                shift 2
                ;;
            --help)
                show_help
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    # Execute command
    case "${command}" in
        quick)
            log_info "Running quick compatibility tests..."
            check_prerequisites
            setup_test_environment
            test_workflow_syntax
            generate_report
            ;;
        full)
            log_info "Running comprehensive test suite..."
            check_prerequisites
            setup_test_environment
            test_workflow_syntax
            test_basic_workflows
            test_ci_workflows
            test_security_workflows
            test_performance_workflows
            test_matrix_builds
            test_service_containers
            test_docker_workflows
            generate_report
            ;;
        ci)
            log_info "Testing CI/CD workflows..."
            check_prerequisites
            setup_test_environment
            test_ci_workflows
            generate_report
            ;;
        security)
            log_info "Testing security workflows..."
            check_prerequisites
            setup_test_environment
            test_security_workflows
            generate_report
            ;;
        performance)
            log_info "Testing performance workflows..."
            check_prerequisites
            setup_test_environment
            test_performance_workflows
            generate_report
            ;;
        matrix)
            log_info "Testing matrix builds..."
            check_prerequisites
            setup_test_environment
            test_matrix_builds
            generate_report
            ;;
        services)
            log_info "Testing service containers..."
            check_prerequisites
            setup_test_environment
            test_service_containers
            generate_report
            ;;
        docker)
            log_info "Testing Docker workflows..."
            check_prerequisites
            setup_test_environment
            test_docker_workflows
            generate_report
            ;;
        clean)
            cleanup_test_artifacts "${1:-}"
            ;;
        list)
            list_workflows
            ;;
        validate)
            check_prerequisites
            log_success "Act configuration is valid"
            ;;
        help|--help)
            show_help
            ;;
        *)
            log_error "Unknown command: ${command}"
            show_help
            exit 1
            ;;
    esac
    
    # Final summary
    if [[ "${command}" != "clean" && "${command}" != "list" && "${command}" != "validate" && "${command}" != "help" ]]; then
        echo ""
        log_info "Test Summary:"
        echo "  Total: ${TOTAL_TESTS}"
        echo "  Passed: ${GREEN}${PASSED_TESTS}${NC}"
        echo "  Failed: ${RED}${FAILED_TESTS}${NC}"
        echo "  Skipped: ${YELLOW}${SKIPPED_TESTS}${NC}"
        
        if [[ ${FAILED_TESTS} -gt 0 ]]; then
            log_warning "Some tests failed. Check logs in ${LOGS_DIR}/ for details."
            exit 1
        else
            log_success "All tests passed!"
        fi
    fi
}

# Run main function with all arguments
main "$@"