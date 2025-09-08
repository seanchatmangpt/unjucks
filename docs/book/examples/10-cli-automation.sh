#!/bin/bash

# CLI Automation Examples for Unjucks v2
# Comprehensive shell scripts demonstrating CLI usage patterns and automation

# =============================================================================
# BASIC CLI OPERATIONS
# =============================================================================

# Colors for output formatting
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Logging functions
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

log_step() {
    echo -e "${PURPLE}[STEP]${NC} $1"
}

# Function: List all available templates
list_templates() {
    log_step "Listing available templates..."
    
    if ! command -v unjucks &> /dev/null; then
        log_error "Unjucks CLI not found. Please install it first."
        return 1
    fi
    
    unjucks list --format=table --show-variables
    
    if [ $? -eq 0 ]; then
        log_success "Templates listed successfully"
    else
        log_error "Failed to list templates"
        return 1
    fi
}

# Function: Show template help
show_template_help() {
    local generator=$1
    local action=$2
    
    if [ -z "$generator" ]; then
        log_error "Generator name is required"
        return 1
    fi
    
    log_step "Showing help for $generator${action:+/$action}..."
    
    if [ -n "$action" ]; then
        unjucks help "$generator" "$action"
    else
        unjucks help "$generator"
    fi
}

# Function: Validate project structure
validate_project() {
    log_step "Validating project structure..."
    
    local errors=0
    
    # Check for templates directory
    if [ ! -d "_templates" ] && [ ! -d "templates" ]; then
        log_warning "No templates directory found (_templates or templates)"
        ((errors++))
    fi
    
    # Check for package.json
    if [ ! -f "package.json" ]; then
        log_warning "No package.json found"
        ((errors++))
    fi
    
    # Check for Unjucks config
    if [ ! -f "unjucks.config.js" ] && [ ! -f "unjucks.config.ts" ] && [ ! -f ".unjucksrc" ]; then
        log_warning "No Unjucks configuration found"
        ((errors++))
    fi
    
    if [ $errors -eq 0 ]; then
        log_success "Project structure is valid"
        return 0
    else
        log_error "Found $errors validation issues"
        return 1
    fi
}

# =============================================================================
# SERVICE GENERATION AUTOMATION
# =============================================================================

# Function: Generate complete service with tests and documentation
generate_service() {
    local service_name=$1
    local database_type=${2:-"postgresql"}
    local enable_auth=${3:-"true"}
    local include_tests=${4:-"true"}
    local output_dir=${5:-"./src/services"}
    
    if [ -z "$service_name" ]; then
        log_error "Service name is required"
        echo "Usage: generate_service <service_name> [database_type] [enable_auth] [include_tests] [output_dir]"
        return 1
    fi
    
    log_step "Generating service: $service_name"
    
    # Dry run first to validate
    log_info "Running dry-run validation..."
    if ! unjucks generate service new \
        --serviceName="$service_name" \
        --databaseType="$database_type" \
        --enableAuth="$enable_auth" \
        --includeTests="$include_tests" \
        --output="$output_dir" \
        --dry-run; then
        log_error "Dry-run validation failed"
        return 1
    fi
    
    # Generate the service
    log_info "Generating service files..."
    if unjucks generate service new \
        --serviceName="$service_name" \
        --databaseType="$database_type" \
        --enableAuth="$enable_auth" \
        --includeTests="$include_tests" \
        --output="$output_dir" \
        --force; then
        log_success "Service $service_name generated successfully"
    else
        log_error "Service generation failed"
        return 1
    fi
    
    # Post-generation steps
    if [ "$include_tests" = "true" ]; then
        log_info "Running generated tests..."
        npm test -- "$service_name" --passWithNoTests
    fi
    
    # Format generated code
    if command -v prettier &> /dev/null; then
        log_info "Formatting generated code..."
        prettier --write "$output_dir/$service_name*"
    fi
    
    # Lint generated code
    if command -v eslint &> /dev/null; then
        log_info "Linting generated code..."
        eslint "$output_dir/$service_name*" --fix || true
    fi
}

# Function: Generate API endpoints for service
generate_api_endpoints() {
    local entity_name=$1
    local operations=${2:-"create,read,update,delete,list"}
    local auth_required=${3:-"true"}
    local include_validation=${4:-"true"}
    
    if [ -z "$entity_name" ]; then
        log_error "Entity name is required"
        return 1
    fi
    
    log_step "Generating API endpoints for: $entity_name"
    
    # Convert operations string to array
    IFS=',' read -ra OPS_ARRAY <<< "$operations"
    
    # Generate controller
    log_info "Generating controller..."
    unjucks generate api controller \
        --entityName="$entity_name" \
        --operations="$operations" \
        --authRequired="$auth_required" \
        --includeValidation="$include_validation" \
        --output="./src/api/controllers"
    
    # Generate routes
    log_info "Generating routes..."
    unjucks generate api routes \
        --entityName="$entity_name" \
        --operations="$operations" \
        --output="./src/api/routes"
    
    # Generate DTOs if validation is enabled
    if [ "$include_validation" = "true" ]; then
        log_info "Generating DTOs..."
        unjucks generate api dto \
            --entityName="$entity_name" \
            --operations="$operations" \
            --output="./src/api/dto"
    fi
    
    # Generate OpenAPI documentation
    log_info "Generating OpenAPI documentation..."
    unjucks generate api docs \
        --entityName="$entity_name" \
        --operations="$operations" \
        --output="./docs/api"
    
    log_success "API endpoints for $entity_name generated successfully"
}

# =============================================================================
# BATCH OPERATIONS
# =============================================================================

# Function: Batch generate multiple services
batch_generate_services() {
    local services_file=$1
    
    if [ -z "$services_file" ] || [ ! -f "$services_file" ]; then
        log_error "Services configuration file is required and must exist"
        echo "Usage: batch_generate_services <services.json>"
        return 1
    fi
    
    log_step "Batch generating services from: $services_file"
    
    # Check if jq is available for JSON parsing
    if ! command -v jq &> /dev/null; then
        log_error "jq is required for JSON parsing. Please install it."
        return 1
    fi
    
    # Parse and generate each service
    local services_count
    services_count=$(jq '. | length' "$services_file")
    
    log_info "Found $services_count services to generate"
    
    for ((i = 0; i < services_count; i++)); do
        local service_config
        service_config=$(jq ".[$i]" "$services_file")
        
        local name
        local database_type
        local enable_auth
        local include_tests
        
        name=$(echo "$service_config" | jq -r '.name')
        database_type=$(echo "$service_config" | jq -r '.databaseType // "postgresql"')
        enable_auth=$(echo "$service_config" | jq -r '.enableAuth // true')
        include_tests=$(echo "$service_config" | jq -r '.includeTests // true')
        
        log_info "Generating service $((i + 1))/$services_count: $name"
        
        if generate_service "$name" "$database_type" "$enable_auth" "$include_tests"; then
            log_success "Service $name completed"
        else
            log_error "Service $name failed"
        fi
    done
    
    log_success "Batch generation completed"
}

# Example services.json format:
create_example_services_config() {
    cat > services.json << 'EOF'
[
  {
    "name": "UserService",
    "databaseType": "postgresql",
    "enableAuth": true,
    "includeTests": true
  },
  {
    "name": "ProductService", 
    "databaseType": "mongodb",
    "enableAuth": true,
    "includeTests": true
  },
  {
    "name": "OrderService",
    "databaseType": "postgresql", 
    "enableAuth": true,
    "includeTests": true
  }
]
EOF
    log_success "Created example services.json configuration"
}

# =============================================================================
# REACT COMPONENT AUTOMATION
# =============================================================================

# Function: Generate React component with stories and tests
generate_react_component() {
    local component_name=$1
    local component_type=${2:-"functional"}
    local styling=${3:-"css-modules"}
    local include_stories=${4:-"true"}
    local include_tests=${5:-"true"}
    
    if [ -z "$component_name" ]; then
        log_error "Component name is required"
        return 1
    fi
    
    log_step "Generating React component: $component_name"
    
    # Generate main component
    unjucks generate component new \
        --componentName="$component_name" \
        --componentType="$component_type" \
        --styling="$styling" \
        --includeStories="$include_stories" \
        --includeTests="$include_tests" \
        --output="./src/components"
    
    # Generate additional files based on options
    if [ "$include_stories" = "true" ]; then
        log_info "Generating Storybook stories..."
        unjucks generate component stories \
            --componentName="$component_name" \
            --output="./src/components/$component_name"
    fi
    
    if [ "$include_tests" = "true" ]; then
        log_info "Generating component tests..."
        unjucks generate component test \
            --componentName="$component_name" \
            --testFramework="react-testing-library" \
            --output="./src/components/$component_name"
    fi
    
    log_success "React component $component_name generated successfully"
}

# Function: Generate component library structure
generate_component_library() {
    local library_name=$1
    local components=${2:-"Button,Input,Card,Modal"}
    
    if [ -z "$library_name" ]; then
        log_error "Library name is required"
        return 1
    fi
    
    log_step "Generating component library: $library_name"
    
    # Create library structure
    mkdir -p "src/components/$library_name"
    
    # Convert components string to array
    IFS=',' read -ra COMP_ARRAY <<< "$components"
    
    # Generate each component
    for component in "${COMP_ARRAY[@]}"; do
        log_info "Generating component: $component"
        generate_react_component "$component" "functional" "css-modules" "true" "true"
    done
    
    # Generate library index file
    log_info "Generating library index..."
    unjucks generate component index \
        --libraryName="$library_name" \
        --components="$components" \
        --output="./src/components/$library_name"
    
    # Generate library documentation
    log_info "Generating library documentation..."
    unjucks generate docs library \
        --libraryName="$library_name" \
        --components="$components" \
        --output="./docs/components"
    
    log_success "Component library $library_name generated successfully"
}

# =============================================================================
# DATABASE OPERATIONS
# =============================================================================

# Function: Generate database migrations
generate_migration() {
    local migration_name=$1
    local migration_type=${2:-"create_table"}
    local table_name=$3
    
    if [ -z "$migration_name" ]; then
        log_error "Migration name is required"
        return 1
    fi
    
    log_step "Generating database migration: $migration_name"
    
    # Generate migration files
    unjucks generate migration new \
        --migrationName="$migration_name" \
        --migrationType="$migration_type" \
        --tableName="$table_name" \
        --output="./database/migrations"
    
    # Generate rollback script
    unjucks generate migration rollback \
        --migrationName="$migration_name" \
        --output="./database/migrations"
    
    log_success "Migration $migration_name generated successfully"
    log_info "Don't forget to review and run: npm run migrate"
}

# Function: Generate model from migration
generate_model_from_migration() {
    local table_name=$1
    local model_type=${2:-"sequelize"}
    
    if [ -z "$table_name" ]; then
        log_error "Table name is required"
        return 1
    fi
    
    log_step "Generating model for table: $table_name"
    
    unjucks generate model new \
        --tableName="$table_name" \
        --modelType="$model_type" \
        --includeAssociations="true" \
        --includeValidation="true" \
        --output="./src/models"
    
    log_success "Model for $table_name generated successfully"
}

# =============================================================================
# DOCKER AND DEPLOYMENT
# =============================================================================

# Function: Generate Docker configuration
generate_docker_config() {
    local app_name=$1
    local node_version=${2:-"18-alpine"}
    local port=${3:-"3000"}
    local include_compose=${4:-"true"}
    
    if [ -z "$app_name" ]; then
        log_error "Application name is required"
        return 1
    fi
    
    log_step "Generating Docker configuration for: $app_name"
    
    # Generate Dockerfile
    unjucks generate docker dockerfile \
        --appName="$app_name" \
        --nodeVersion="$node_version" \
        --port="$port" \
        --optimized="true" \
        --output="."
    
    # Generate .dockerignore
    unjucks generate docker dockerignore \
        --output="."
    
    # Generate docker-compose.yml if requested
    if [ "$include_compose" = "true" ]; then
        log_info "Generating docker-compose.yml..."
        unjucks generate docker compose \
            --appName="$app_name" \
            --port="$port" \
            --includeDatabase="true" \
            --includeRedis="true" \
            --output="."
    fi
    
    log_success "Docker configuration generated successfully"
    log_info "You can now run: docker build -t $app_name ."
}

# Function: Generate Kubernetes manifests
generate_k8s_manifests() {
    local app_name=$1
    local namespace=${2:-"default"}
    local replicas=${3:-"3"}
    local port=${4:-"3000"}
    
    if [ -z "$app_name" ]; then
        log_error "Application name is required"
        return 1
    fi
    
    log_step "Generating Kubernetes manifests for: $app_name"
    
    mkdir -p k8s
    
    # Generate deployment
    unjucks generate k8s deployment \
        --appName="$app_name" \
        --namespace="$namespace" \
        --replicas="$replicas" \
        --port="$port" \
        --output="./k8s"
    
    # Generate service
    unjucks generate k8s service \
        --appName="$app_name" \
        --namespace="$namespace" \
        --port="$port" \
        --output="./k8s"
    
    # Generate ingress
    unjucks generate k8s ingress \
        --appName="$app_name" \
        --namespace="$namespace" \
        --output="./k8s"
    
    # Generate configmap
    unjucks generate k8s configmap \
        --appName="$app_name" \
        --namespace="$namespace" \
        --output="./k8s"
    
    log_success "Kubernetes manifests generated successfully"
    log_info "You can deploy with: kubectl apply -f k8s/"
}

# =============================================================================
# CI/CD AUTOMATION
# =============================================================================

# Function: Generate GitHub Actions workflow
generate_github_actions() {
    local workflow_name=$1
    local node_versions=${2:-"16,18,20"}
    local include_deployment=${3:-"true"}
    local deployment_env=${4:-"staging,production"}
    
    if [ -z "$workflow_name" ]; then
        log_error "Workflow name is required"
        return 1
    fi
    
    log_step "Generating GitHub Actions workflow: $workflow_name"
    
    mkdir -p .github/workflows
    
    # Generate main CI workflow
    unjucks generate cicd github-actions \
        --workflowName="$workflow_name" \
        --nodeVersions="$node_versions" \
        --includeDeployment="$include_deployment" \
        --deploymentEnvironments="$deployment_env" \
        --output="./.github/workflows"
    
    # Generate deployment workflow if requested
    if [ "$include_deployment" = "true" ]; then
        log_info "Generating deployment workflow..."
        unjucks generate cicd deployment \
            --workflowName="deploy" \
            --environments="$deployment_env" \
            --output="./.github/workflows"
    fi
    
    log_success "GitHub Actions workflows generated successfully"
}

# Function: Generate GitLab CI configuration
generate_gitlab_ci() {
    local stages=${1:-"build,test,deploy"}
    local docker_image=${2:-"node:18-alpine"}
    local include_deployment=${3:-"true"}
    
    log_step "Generating GitLab CI configuration"
    
    unjucks generate cicd gitlab-ci \
        --stages="$stages" \
        --dockerImage="$docker_image" \
        --includeDeployment="$include_deployment" \
        --output="."
    
    log_success "GitLab CI configuration generated successfully"
}

# =============================================================================
# TESTING AUTOMATION
# =============================================================================

# Function: Generate comprehensive test suite
generate_test_suite() {
    local test_type=${1:-"all"}
    local framework=${2:-"jest"}
    local coverage_threshold=${3:-"80"}
    
    log_step "Generating test suite with $framework"
    
    case $test_type in
        "unit")
            unjucks generate test unit \
                --framework="$framework" \
                --coverageThreshold="$coverage_threshold" \
                --output="./src/__tests__"
            ;;
        "integration")
            unjucks generate test integration \
                --framework="$framework" \
                --output="./tests/integration"
            ;;
        "e2e")
            unjucks generate test e2e \
                --framework="cypress" \
                --output="./tests/e2e"
            ;;
        "all")
            generate_test_suite "unit" "$framework" "$coverage_threshold"
            generate_test_suite "integration" "$framework" "$coverage_threshold"
            generate_test_suite "e2e" "cypress" "$coverage_threshold"
            ;;
        *)
            log_error "Unknown test type: $test_type"
            return 1
            ;;
    esac
    
    log_success "Test suite generated successfully"
}

# Function: Generate test data and fixtures
generate_test_data() {
    local entity_name=$1
    local data_size=${2:-"10"}
    local include_relationships=${3:-"true"}
    
    if [ -z "$entity_name" ]; then
        log_error "Entity name is required"
        return 1
    fi
    
    log_step "Generating test data for: $entity_name"
    
    unjucks generate test data \
        --entityName="$entity_name" \
        --dataSize="$data_size" \
        --includeRelationships="$include_relationships" \
        --faker="true" \
        --output="./tests/fixtures"
    
    log_success "Test data for $entity_name generated successfully"
}

# =============================================================================
# FULL-STACK PROJECT AUTOMATION
# =============================================================================

# Function: Initialize complete full-stack project
initialize_fullstack_project() {
    local project_name=$1
    local frontend_framework=${2:-"react"}
    local backend_framework=${3:-"express"}
    local database=${4:-"postgresql"}
    local include_docker=${5:-"true"}
    local include_tests=${6:-"true"}
    
    if [ -z "$project_name" ]; then
        log_error "Project name is required"
        return 1
    fi
    
    log_step "Initializing full-stack project: $project_name"
    
    # Create project directory
    mkdir -p "$project_name"
    cd "$project_name" || return 1
    
    # Initialize package.json
    npm init -y
    
    # Generate backend structure
    log_info "Generating backend structure..."
    unjucks generate fullstack backend \
        --framework="$backend_framework" \
        --database="$database" \
        --includeAuth="true" \
        --output="./backend"
    
    # Generate frontend structure
    log_info "Generating frontend structure..."
    unjucks generate fullstack frontend \
        --framework="$frontend_framework" \
        --includeRouting="true" \
        --includeStateManagement="true" \
        --output="./frontend"
    
    # Generate shared types/schemas
    log_info "Generating shared schemas..."
    unjucks generate fullstack shared \
        --includeTypes="true" \
        --includeValidation="true" \
        --output="./shared"
    
    # Generate Docker configuration if requested
    if [ "$include_docker" = "true" ]; then
        log_info "Generating Docker configuration..."
        generate_docker_config "$project_name" "18-alpine" "3000" "true"
    fi
    
    # Generate test configuration if requested
    if [ "$include_tests" = "true" ]; then
        log_info "Generating test configuration..."
        generate_test_suite "all" "jest" "80"
    fi
    
    # Generate CI/CD configuration
    log_info "Generating CI/CD configuration..."
    generate_github_actions "ci-cd" "16,18,20" "true" "staging,production"
    
    # Generate documentation
    log_info "Generating project documentation..."
    unjucks generate docs project \
        --projectName="$project_name" \
        --includeAPI="true" \
        --includeDeployment="true" \
        --output="./docs"
    
    cd - > /dev/null || return 1
    
    log_success "Full-stack project $project_name initialized successfully"
    log_info "Next steps:"
    log_info "  1. cd $project_name"
    log_info "  2. npm install"
    log_info "  3. Review and customize generated configuration"
    log_info "  4. Start development: npm run dev"
}

# =============================================================================
# MAINTENANCE AND UTILITIES
# =============================================================================

# Function: Update all templates to latest version
update_templates() {
    log_step "Updating templates to latest version..."
    
    # Check for template updates
    unjucks update --check
    
    # Update if available
    if unjucks update --confirm; then
        log_success "Templates updated successfully"
    else
        log_warning "No template updates available or update failed"
    fi
    
    # Regenerate configuration if needed
    if [ -f "unjucks.config.js" ]; then
        log_info "Validating configuration..."
        unjucks config validate
    fi
}

# Function: Clean generated files
clean_generated_files() {
    local confirm=${1:-"false"}
    
    if [ "$confirm" != "true" ]; then
        log_warning "This will remove all generated files!"
        read -p "Are you sure? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Operation cancelled"
            return 0
        fi
    fi
    
    log_step "Cleaning generated files..."
    
    # Remove common generated directories
    rm -rf src/generated/
    rm -rf dist/
    rm -rf build/
    rm -rf .output/
    
    # Remove generated markers
    find . -name "*.generated.*" -type f -delete
    find . -name "*.gen.*" -type f -delete
    
    log_success "Generated files cleaned successfully"
}

# Function: Validate all generated code
validate_generated_code() {
    log_step "Validating generated code..."
    
    local errors=0
    
    # TypeScript type checking
    if command -v tsc &> /dev/null && [ -f "tsconfig.json" ]; then
        log_info "Running TypeScript type checking..."
        if ! tsc --noEmit; then
            log_error "TypeScript errors found"
            ((errors++))
        fi
    fi
    
    # ESLint checking
    if command -v eslint &> /dev/null; then
        log_info "Running ESLint..."
        if ! eslint src/ --max-warnings 0; then
            log_error "ESLint errors found"
            ((errors++))
        fi
    fi
    
    # Run tests
    if [ -f "package.json" ] && npm run test --if-present; then
        log_info "Tests passed"
    else
        log_error "Tests failed"
        ((errors++))
    fi
    
    if [ $errors -eq 0 ]; then
        log_success "All validations passed"
        return 0
    else
        log_error "Found $errors validation errors"
        return 1
    fi
}

# =============================================================================
# MAIN CLI INTERFACE
# =============================================================================

# Function: Display help information
show_help() {
    cat << 'EOF'
Unjucks v2 CLI Automation Script

USAGE:
    ./unjucks-automation.sh <command> [arguments...]

COMMANDS:
    list                           List available templates
    help <generator> [action]      Show template help
    validate                       Validate project structure

SERVICE GENERATION:
    service <name> [db] [auth] [tests] [output]
        Generate service with optional parameters
    
    api <entity> [ops] [auth] [validation]
        Generate API endpoints for entity
    
    batch-services <config.json>
        Generate multiple services from configuration

COMPONENT GENERATION:
    component <name> [type] [styling] [stories] [tests]
        Generate React component
    
    library <name> [components]
        Generate component library

DATABASE:
    migration <name> [type] [table]
        Generate database migration
    
    model <table> [type]
        Generate model from table

INFRASTRUCTURE:
    docker <app> [node-version] [port] [compose]
        Generate Docker configuration
    
    k8s <app> [namespace] [replicas] [port]
        Generate Kubernetes manifests
    
    github-actions <name> [node-versions] [deploy] [envs]
        Generate GitHub Actions workflow
    
    gitlab-ci [stages] [image] [deploy]
        Generate GitLab CI configuration

TESTING:
    test-suite [type] [framework] [coverage]
        Generate test suite (unit/integration/e2e/all)
    
    test-data <entity> [size] [relationships]
        Generate test data and fixtures

PROJECT MANAGEMENT:
    init-fullstack <name> [frontend] [backend] [db] [docker] [tests]
        Initialize complete full-stack project
    
    update-templates
        Update templates to latest version
    
    clean [confirm]
        Clean generated files
    
    validate-code
        Validate all generated code

EXAMPLES:
    ./unjucks-automation.sh service UserService postgresql true
    ./unjucks-automation.sh component UserProfile functional css-modules
    ./unjucks-automation.sh docker myapp 18-alpine 3000 true
    ./unjucks-automation.sh init-fullstack myproject react express postgresql

EOF
}

# Main command dispatcher
main() {
    local command=$1
    shift
    
    case $command in
        "list")
            list_templates
            ;;
        "help")
            show_template_help "$@"
            ;;
        "validate")
            validate_project
            ;;
        "service")
            generate_service "$@"
            ;;
        "api")
            generate_api_endpoints "$@"
            ;;
        "batch-services")
            batch_generate_services "$@"
            ;;
        "component")
            generate_react_component "$@"
            ;;
        "library")
            generate_component_library "$@"
            ;;
        "migration")
            generate_migration "$@"
            ;;
        "model")
            generate_model_from_migration "$@"
            ;;
        "docker")
            generate_docker_config "$@"
            ;;
        "k8s")
            generate_k8s_manifests "$@"
            ;;
        "github-actions")
            generate_github_actions "$@"
            ;;
        "gitlab-ci")
            generate_gitlab_ci "$@"
            ;;
        "test-suite")
            generate_test_suite "$@"
            ;;
        "test-data")
            generate_test_data "$@"
            ;;
        "init-fullstack")
            initialize_fullstack_project "$@"
            ;;
        "update-templates")
            update_templates
            ;;
        "clean")
            clean_generated_files "$@"
            ;;
        "validate-code")
            validate_generated_code
            ;;
        "create-services-config")
            create_example_services_config
            ;;
        "--help"|"-h"|"help"|"")
            show_help
            ;;
        *)
            log_error "Unknown command: $command"
            echo
            show_help
            exit 1
            ;;
    esac
}

# Run main function if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi

# =============================================================================
# EXAMPLE USAGE SCENARIOS
# =============================================================================

# Scenario 1: Generate a complete microservice
# ./unjucks-automation.sh service UserService postgresql true true ./src/services
# ./unjucks-automation.sh api User "create,read,update,delete,list" true true
# ./unjucks-automation.sh docker UserService 18-alpine 3000 true
# ./unjucks-automation.sh k8s UserService default 3 3000

# Scenario 2: Create React component library
# ./unjucks-automation.sh library UIKit "Button,Input,Card,Modal,Dropdown"
# ./unjucks-automation.sh test-suite all jest 90

# Scenario 3: Initialize full-stack e-commerce project
# ./unjucks-automation.sh init-fullstack ecommerce-app react express postgresql true true
# cd ecommerce-app
# ./unjucks-automation.sh service ProductService postgresql true
# ./unjucks-automation.sh service OrderService postgresql true
# ./unjucks-automation.sh service PaymentService postgresql true

# Scenario 4: Batch generate multiple services
# ./unjucks-automation.sh create-services-config
# ./unjucks-automation.sh batch-services services.json

# Scenario 5: Setup CI/CD and deployment
# ./unjucks-automation.sh github-actions "CI/CD" "16,18,20" true "staging,production"
# ./unjucks-automation.sh docker myapp 18-alpine 3000 true

# This automation script provides a comprehensive CLI interface for all
# Unjucks v2 operations, enabling rapid development and deployment workflows.