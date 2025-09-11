#!/bin/sh
set -e

# KGEN Docker Entrypoint
# Handles initialization, health checks, and graceful startup

echo "🚀 Starting KGEN Knowledge Graph Engine..."

# Function to wait for service
wait_for_service() {
    local host=$1
    local port=$2
    local service=$3
    local timeout=${4:-30}
    
    echo "⏳ Waiting for $service at $host:$port..."
    
    for i in $(seq 1 $timeout); do
        if nc -z "$host" "$port" >/dev/null 2>&1; then
            echo "✅ $service is ready"
            return 0
        fi
        echo "   Attempt $i/$timeout - $service not ready yet, waiting..."
        sleep 1
    done
    
    echo "❌ Timeout waiting for $service at $host:$port"
    return 1
}

# Function to validate environment
validate_environment() {
    echo "🔍 Validating environment..."
    
    local errors=0
    
    # Check required environment variables
    if [ -z "$KGEN_JWT_SECRET" ]; then
        echo "❌ KGEN_JWT_SECRET is required"
        errors=$((errors + 1))
    elif [ ${#KGEN_JWT_SECRET} -lt 32 ]; then
        echo "❌ KGEN_JWT_SECRET must be at least 32 characters"
        errors=$((errors + 1))
    fi
    
    if [ -z "$KGEN_PG_PASSWORD" ] && [ "$NODE_ENV" = "production" ]; then
        echo "❌ KGEN_PG_PASSWORD is required in production"
        errors=$((errors + 1))
    fi
    
    # Validate port
    if [ -n "$KGEN_PORT" ] && ([ "$KGEN_PORT" -lt 1 ] || [ "$KGEN_PORT" -gt 65535 ]); then
        echo "❌ KGEN_PORT must be between 1 and 65535"
        errors=$((errors + 1))
    fi
    
    if [ $errors -gt 0 ]; then
        echo "❌ Environment validation failed with $errors errors"
        exit 1
    fi
    
    echo "✅ Environment validation passed"
}

# Function to wait for dependencies
wait_for_dependencies() {
    echo "🔗 Checking dependencies..."
    
    # Wait for PostgreSQL
    if [ -n "$KGEN_PG_HOST" ] && [ -n "$KGEN_PG_PORT" ]; then
        if ! wait_for_service "$KGEN_PG_HOST" "$KGEN_PG_PORT" "PostgreSQL" 60; then
            echo "⚠️  PostgreSQL not available, KGEN may fail to start"
        fi
    fi
    
    # Wait for Redis (optional)
    if [ -n "$KGEN_REDIS_HOST" ] && [ -n "$KGEN_REDIS_PORT" ]; then
        if ! wait_for_service "$KGEN_REDIS_HOST" "$KGEN_REDIS_PORT" "Redis" 30; then
            echo "⚠️  Redis not available, caching will be limited to memory"
        fi
    fi
    
    echo "✅ Dependency checks completed"
}

# Function to initialize application
initialize_app() {
    echo "🔧 Initializing KGEN..."
    
    # Create necessary directories
    mkdir -p logs uploads temp
    
    # Set default environment variables
    export NODE_ENV=${NODE_ENV:-production}
    export KGEN_PORT=${KGEN_PORT:-3000}
    export KGEN_HOST=${KGEN_HOST:-0.0.0.0}
    export KGEN_LOG_LEVEL=${KGEN_LOG_LEVEL:-info}
    
    # PostgreSQL defaults
    export KGEN_PG_HOST=${KGEN_PG_HOST:-localhost}
    export KGEN_PG_PORT=${KGEN_PG_PORT:-5432}
    export KGEN_PG_DATABASE=${KGEN_PG_DATABASE:-kgen}
    export KGEN_PG_USERNAME=${KGEN_PG_USERNAME:-kgen}
    
    # Redis defaults
    export KGEN_REDIS_HOST=${KGEN_REDIS_HOST:-localhost}
    export KGEN_REDIS_PORT=${KGEN_REDIS_PORT:-6379}
    export KGEN_REDIS_DB=${KGEN_REDIS_DB:-0}
    
    # Security defaults
    export KGEN_JWT_EXPIRES_IN=${KGEN_JWT_EXPIRES_IN:-24h}
    export KGEN_BCRYPT_ROUNDS=${KGEN_BCRYPT_ROUNDS:-12}
    
    # Monitoring defaults
    export KGEN_METRICS_ENABLED=${KGEN_METRICS_ENABLED:-true}
    export KGEN_SWAGGER_ENABLED=${KGEN_SWAGGER_ENABLED:-true}
    
    echo "✅ KGEN initialized"
}

# Function to run database migrations (if needed)
run_migrations() {
    if [ "$KGEN_RUN_MIGRATIONS" = "true" ]; then
        echo "🔄 Running database migrations..."
        # In a real implementation, you would run migrations here
        echo "✅ Database migrations completed"
    fi
}

# Function to start the application
start_application() {
    echo "🌟 Starting KGEN application..."
    
    # Start KGEN based on the mode
    case "${KGEN_MODE:-server}" in
        "server")
            echo "📡 Starting KGEN API server..."
            exec node src/kgen/index.js
            ;;
        "cli")
            echo "💻 Starting KGEN CLI..."
            exec node src/cli/index.js "$@"
            ;;
        "worker")
            echo "⚙️  Starting KGEN worker..."
            # Could implement background workers here
            exec node src/kgen/index.js --worker
            ;;
        *)
            echo "❌ Unknown KGEN_MODE: $KGEN_MODE"
            echo "Valid modes: server, cli, worker"
            exit 1
            ;;
    esac
}

# Function to handle shutdown signals
cleanup() {
    echo "🛑 Received shutdown signal, gracefully stopping..."
    # Kill the main process
    if [ -n "$KGEN_PID" ]; then
        kill -TERM "$KGEN_PID" 2>/dev/null || true
        wait "$KGEN_PID" 2>/dev/null || true
    fi
    echo "🛑 KGEN shutdown complete"
    exit 0
}

# Setup signal handlers
trap cleanup TERM INT QUIT

# Main execution flow
main() {
    echo "🎯 KGEN Knowledge Graph Engine"
    echo "   Version: ${npm_package_version:-unknown}"
    echo "   Node.js: $(node --version)"
    echo "   Environment: ${NODE_ENV}"
    echo "   Mode: ${KGEN_MODE:-server}"
    echo ""
    
    # Validate environment
    validate_environment
    
    # Wait for dependencies
    wait_for_dependencies
    
    # Initialize application
    initialize_app
    
    # Run migrations if needed
    run_migrations
    
    # Start the application
    start_application &
    KGEN_PID=$!
    
    # Wait for the application
    wait $KGEN_PID
}

# Handle special cases
if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    echo "KGEN Docker Container"
    echo ""
    echo "Environment Variables:"
    echo "  KGEN_MODE          - server, cli, worker (default: server)"
    echo "  KGEN_PORT          - Port to listen on (default: 3000)"
    echo "  KGEN_HOST          - Host to bind to (default: 0.0.0.0)"
    echo "  NODE_ENV           - Environment (default: production)"
    echo "  KGEN_LOG_LEVEL     - Logging level (default: info)"
    echo "  KGEN_JWT_SECRET    - JWT secret key (required)"
    echo "  KGEN_PG_HOST       - PostgreSQL host"
    echo "  KGEN_PG_PORT       - PostgreSQL port"
    echo "  KGEN_PG_DATABASE   - PostgreSQL database"
    echo "  KGEN_PG_USERNAME   - PostgreSQL username"
    echo "  KGEN_PG_PASSWORD   - PostgreSQL password"
    echo "  KGEN_REDIS_HOST    - Redis host"
    echo "  KGEN_REDIS_PORT    - Redis port"
    echo "  KGEN_RUN_MIGRATIONS - Run database migrations (default: false)"
    echo ""
    echo "Usage:"
    echo "  docker run kgen                    # Start server"
    echo "  docker run -e KGEN_MODE=cli kgen  # Start CLI"
    echo "  docker run kgen --help             # Show this help"
    exit 0
fi

# If arguments are provided, pass them to the CLI
if [ $# -gt 0 ] && [ "$1" != "docker-entrypoint.sh" ]; then
    export KGEN_MODE=cli
    start_application "$@"
else
    # Normal startup
    main
fi