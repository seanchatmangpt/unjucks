#!/bin/bash
# Health Monitor Script for Docker Testing Environment
# Monitors all services and generates health reports

set -euo pipefail

# Configuration
CHECK_INTERVAL=${CHECK_INTERVAL:-30}
ALERT_THRESHOLD=${ALERT_THRESHOLD:-3}
HEALTH_LOG="/tmp/health-monitor.log"
ALERT_LOG="/tmp/health-alerts.log"

# Initialize logs
echo "Health Monitor Started at $(date)" > "$HEALTH_LOG"
echo "Health Alerts Log Started at $(date)" > "$ALERT_LOG"

# Service health check functions
check_postgres() {
    local host="postgres-test"
    local port="5432"
    local user="test_user"
    local db="unjucks_test"
    
    if pg_isready -h "$host" -p "$port" -U "$user" -d "$db" >/dev/null 2>&1; then
        echo "postgres:healthy"
    else
        echo "postgres:unhealthy"
    fi
}

check_redis() {
    local host="redis-test"
    local port="6379"
    
    if redis-cli -h "$host" -p "$port" -a "test_redis_password" ping >/dev/null 2>&1; then
        echo "redis:healthy"
    else
        echo "redis:unhealthy"
    fi
}

check_mongodb() {
    local host="mongodb-test"
    local port="27017"
    
    if mongosh --host "$host:$port" --eval "db.adminCommand('ping')" >/dev/null 2>&1; then
        echo "mongodb:healthy"
    else
        echo "mongodb:unhealthy"
    fi
}

check_elasticsearch() {
    local host="elasticsearch-test"
    local port="9200"
    
    if curl -sf "http://$host:$port/_cluster/health" >/dev/null 2>&1; then
        echo "elasticsearch:healthy"
    else
        echo "elasticsearch:unhealthy"
    fi
}

check_app() {
    local host="app-test"
    local port="3000"
    
    if curl -sf "http://$host:$port/health" >/dev/null 2>&1; then
        echo "app:healthy"
    else
        echo "app:unhealthy"
    fi
}

# Service failure counters
declare -A failure_counts
failure_counts[postgres]=0
failure_counts[redis]=0
failure_counts[mongodb]=0
failure_counts[elasticsearch]=0
failure_counts[app]=0

# Alert function
send_alert() {
    local service="$1"
    local status="$2"
    local timestamp=$(date)
    
    echo "ALERT: $service is $status at $timestamp" | tee -a "$ALERT_LOG"
    
    # Here you could add webhook notifications, email alerts, etc.
    # For testing environment, we just log
}

# Reset failure counter on recovery
reset_failure_count() {
    local service="$1"
    failure_counts[$service]=0
    echo "INFO: $service recovered at $(date)" >> "$HEALTH_LOG"
}

# Main monitoring loop
monitor_services() {
    while true; do
        local timestamp=$(date)
        local overall_status="healthy"
        
        echo "=== Health Check at $timestamp ===" >> "$HEALTH_LOG"
        
        # Check all services
        local services=("postgres" "redis" "mongodb" "elasticsearch" "app")
        
        for service in "${services[@]}"; do
            local result
            case $service in
                postgres)
                    result=$(check_postgres)
                    ;;
                redis)
                    result=$(check_redis)
                    ;;
                mongodb)
                    result=$(check_mongodb)
                    ;;
                elasticsearch)
                    result=$(check_elasticsearch)
                    ;;
                app)
                    result=$(check_app)
                    ;;
            esac
            
            echo "$result" >> "$HEALTH_LOG"
            
            # Parse result
            local service_name=$(echo "$result" | cut -d: -f1)
            local service_status=$(echo "$result" | cut -d: -f2)
            
            if [[ "$service_status" == "unhealthy" ]]; then
                overall_status="degraded"
                failure_counts[$service]=$((failure_counts[$service] + 1))
                
                # Send alert if threshold reached
                if [[ ${failure_counts[$service]} -ge $ALERT_THRESHOLD ]]; then
                    send_alert "$service" "unhealthy for ${failure_counts[$service]} consecutive checks"
                fi
            else
                # Reset counter on successful check
                if [[ ${failure_counts[$service]} -gt 0 ]]; then
                    reset_failure_count "$service"
                fi
            fi
        done
        
        echo "Overall Status: $overall_status" >> "$HEALTH_LOG"
        echo "" >> "$HEALTH_LOG"
        
        # Generate JSON health report
        generate_health_report "$overall_status"
        
        sleep "$CHECK_INTERVAL"
    done
}

# Generate structured health report
generate_health_report() {
    local overall_status="$1"
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    
    cat > /tmp/health-status.json <<EOF
{
  "timestamp": "$timestamp",
  "overall_status": "$overall_status",
  "services": {
    "postgres": {
      "status": "$(check_postgres | cut -d: -f2)",
      "failure_count": ${failure_counts[postgres]}
    },
    "redis": {
      "status": "$(check_redis | cut -d: -f2)",
      "failure_count": ${failure_counts[redis]}
    },
    "mongodb": {
      "status": "$(check_mongodb | cut -d: -f2)",
      "failure_count": ${failure_counts[mongodb]}
    },
    "elasticsearch": {
      "status": "$(check_elasticsearch | cut -d: -f2)",
      "failure_count": ${failure_counts[elasticsearch]}
    },
    "app": {
      "status": "$(check_app | cut -d: -f2)",
      "failure_count": ${failure_counts[app]}
    }
  },
  "configuration": {
    "check_interval": $CHECK_INTERVAL,
    "alert_threshold": $ALERT_THRESHOLD
  }
}
EOF
}

# Cleanup function
cleanup() {
    echo "Health Monitor stopping at $(date)" >> "$HEALTH_LOG"
    exit 0
}

# Set up signal handlers
trap cleanup SIGTERM SIGINT

# Start monitoring
echo "Starting health monitoring with check interval: ${CHECK_INTERVAL}s, alert threshold: ${ALERT_THRESHOLD}"
monitor_services