#!/bin/bash

# KGEN Observability Stack Deployment Script
# Comprehensive monitoring and alerting deployment

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MONITORING_DIR="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="$MONITORING_DIR/docker/docker-compose.observability.yml"
ENV_FILE="$MONITORING_DIR/.env.monitoring"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
    exit 1
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed. Please install Docker first."
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        error "Docker Compose is not installed. Please install Docker Compose first."
    fi
    
    # Check available disk space (minimum 10GB)
    available_space=$(df "$MONITORING_DIR" | tail -1 | awk '{print $4}')
    if [ "$available_space" -lt 10485760 ]; then  # 10GB in KB
        warn "Less than 10GB available disk space. Monitoring may run out of storage."
    fi
    
    # Check memory (minimum 8GB recommended)
    total_mem=$(free -m | grep '^Mem:' | awk '{print $2}')
    if [ "$total_mem" -lt 8192 ]; then
        warn "Less than 8GB RAM available. Performance may be impacted."
    fi
    
    log "Prerequisites check completed."
}

# Create environment file
create_environment() {
    log "Creating environment configuration..."
    
    cat > "$ENV_FILE" << EOF
# KGEN Observability Stack Environment Configuration
# Generated on $(date)

# Environment
ENVIRONMENT=production
KGEN_VERSION=1.0.0

# Prometheus Configuration
PROMETHEUS_RETENTION_TIME=30d
PROMETHEUS_RETENTION_SIZE=10GB

# Grafana Configuration
GF_SECURITY_ADMIN_USER=admin
GF_SECURITY_ADMIN_PASSWORD=\${GRAFANA_ADMIN_PASSWORD:-admin123}
GF_USERS_ALLOW_SIGN_UP=false
GF_SERVER_ROOT_URL=http://grafana.kgen.local

# Elasticsearch Configuration
ES_JAVA_OPTS=-Xms2g -Xmx2g
ELASTIC_PASSWORD=\${ELASTIC_PASSWORD:-changeme}

# Logstash Configuration
LS_JAVA_OPTS=-Xmx1g -Xms1g

# Jaeger Configuration
SPAN_STORAGE_TYPE=elasticsearch
ES_SERVER_URLS=http://elasticsearch:9200

# Alerting Configuration
SMTP_HOST=\${SMTP_HOST:-localhost}
SMTP_PORT=\${SMTP_PORT:-587}
SMTP_USER=\${SMTP_USER:-kgen-alerts@company.com}
SMTP_PASSWORD=\${SMTP_PASSWORD:-}

# Slack Integration
SLACK_WEBHOOK_URL=\${SLACK_WEBHOOK_URL:-}
PAGERDUTY_KEY=\${PAGERDUTY_KEY:-}

# Security
KGEN_SECRET_KEY=\${KGEN_SECRET_KEY:-$(openssl rand -hex 32)}

# Network
TRAEFIK_DOMAIN=kgen.local
EOF
    
    log "Environment file created at $ENV_FILE"
    log "Please update the environment variables as needed."
}

# Setup directories and permissions
setup_directories() {
    log "Setting up directories and permissions..."
    
    # Create necessary directories
    mkdir -p "$MONITORING_DIR"/{data,logs,config,backups}
    mkdir -p "$MONITORING_DIR"/data/{prometheus,grafana,elasticsearch,alertmanager}
    mkdir -p "$MONITORING_DIR"/logs/{prometheus,grafana,logstash,jaeger}
    
    # Set permissions
    chmod -R 755 "$MONITORING_DIR"/{data,logs,config}
    chmod 600 "$ENV_FILE"
    
    # For Elasticsearch (requires UID 1000)
    if [ "$(id -u)" = "0" ]; then
        chown -R 1000:1000 "$MONITORING_DIR"/data/elasticsearch
    else
        warn "Not running as root. Elasticsearch may have permission issues."
    fi
    
    log "Directory setup completed."
}

# Validate configuration files
validate_configs() {
    log "Validating configuration files..."
    
    # Check Prometheus config
    if [ -f "$MONITORING_DIR/prometheus/prometheus.yml" ]; then
        log "✓ Prometheus configuration found"
    else
        error "Prometheus configuration not found at $MONITORING_DIR/prometheus/prometheus.yml"
    fi
    
    # Check Grafana dashboards
    if [ -d "$MONITORING_DIR/grafana/dashboards" ]; then
        dashboard_count=$(find "$MONITORING_DIR/grafana/dashboards" -name "*.json" | wc -l)
        log "✓ Found $dashboard_count Grafana dashboards"
    else
        warn "Grafana dashboards directory not found"
    fi
    
    # Check Logstash config
    if [ -f "$MONITORING_DIR/elk/logstash.conf" ]; then
        log "✓ Logstash configuration found"
    else
        error "Logstash configuration not found at $MONITORING_DIR/elk/logstash.conf"
    fi
    
    # Check Alertmanager config
    if [ -f "$MONITORING_DIR/alerting/alertmanager.yml" ]; then
        log "✓ Alertmanager configuration found"
    else
        error "Alertmanager configuration not found at $MONITORING_DIR/alerting/alertmanager.yml"
    fi
    
    log "Configuration validation completed."
}

# Deploy the stack
deploy_stack() {
    log "Deploying KGEN Observability Stack..."
    
    # Pull images first
    log "Pulling Docker images..."
    docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" pull
    
    # Start the stack
    log "Starting services..."
    docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d
    
    # Wait for services to be ready
    log "Waiting for services to start..."
    sleep 30
    
    # Health checks
    check_service_health
}

# Check service health
check_service_health() {
    log "Checking service health..."
    
    services=(
        "prometheus:9090"
        "grafana:3001"
        "elasticsearch:9200"
        "kibana:5601"
        "jaeger:16686"
        "alertmanager:9093"
        "kgen-metrics-api:3002"
    )
    
    for service in "${services[@]}"; do
        name=${service%%:*}
        port=${service##*:}
        
        if curl -sf "http://localhost:$port" > /dev/null 2>&1; then
            log "✓ $name is healthy (port $port)"
        else
            warn "✗ $name may not be ready yet (port $port)"
        fi
    done
}

# Import Grafana dashboards
import_dashboards() {
    log "Importing Grafana dashboards..."
    
    # Wait for Grafana to be ready
    sleep 10
    
    # Import dashboards using Grafana API
    dashboard_files=$(find "$MONITORING_DIR/grafana/dashboards" -name "*.json")
    
    for dashboard_file in $dashboard_files; do
        dashboard_name=$(basename "$dashboard_file" .json)
        
        # Create dashboard payload
        dashboard_json=$(cat "$dashboard_file")
        payload=$(jq -n --argjson dashboard "$dashboard_json" '{dashboard: $dashboard, overwrite: true}')
        
        # Import dashboard
        response=$(curl -s -X POST \
            -H "Content-Type: application/json" \
            -d "$payload" \
            "http://admin:admin123@localhost:3001/api/dashboards/db" || true)
        
        if [[ "$response" == *"success"* ]]; then
            log "✓ Imported dashboard: $dashboard_name"
        else
            warn "Failed to import dashboard: $dashboard_name"
        fi
    done
}

# Configure Elasticsearch indices
setup_elasticsearch() {
    log "Setting up Elasticsearch indices..."
    
    # Wait for Elasticsearch to be ready
    sleep 15
    
    # Create index templates
    cat << 'EOF' | curl -s -X PUT "http://localhost:9200/_template/kgen-logs" \
        -H "Content-Type: application/json" -d @- > /dev/null || true
{
  "index_patterns": ["kgen-logs-*"],
  "settings": {
    "number_of_shards": 2,
    "number_of_replicas": 1
  },
  "mappings": {
    "properties": {
      "@timestamp": { "type": "date" },
      "level": { "type": "keyword" },
      "message": { "type": "text" },
      "service": { "type": "keyword" },
      "operation": { "type": "keyword" },
      "duration": { "type": "float" },
      "success": { "type": "boolean" }
    }
  }
}
EOF
    
    log "✓ Elasticsearch index templates created"
}

# Create monitoring scripts
create_scripts() {
    log "Creating monitoring utility scripts..."
    
    # Backup script
    cat > "$MONITORING_DIR/scripts/backup.sh" << 'EOF'
#!/bin/bash
# KGEN Monitoring Backup Script

BACKUP_DIR="/opt/kgen/backups/monitoring"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"

# Backup Prometheus data
docker run --rm -v kgen_prometheus_data:/data -v "$BACKUP_DIR":/backup alpine \
    tar czf "/backup/prometheus_$DATE.tar.gz" /data

# Backup Grafana data  
docker run --rm -v kgen_grafana_data:/data -v "$BACKUP_DIR":/backup alpine \
    tar czf "/backup/grafana_$DATE.tar.gz" /data

# Cleanup old backups (keep 7 days)
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +7 -delete

echo "Backup completed: $DATE"
EOF
    
    # Status check script
    cat > "$MONITORING_DIR/scripts/status.sh" << 'EOF'
#!/bin/bash
# KGEN Monitoring Status Check Script

echo "=== KGEN Observability Stack Status ==="
echo ""

# Check Docker containers
echo "Docker Containers:"
docker ps --filter "name=kgen-" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""

# Check disk usage
echo "Disk Usage:"
docker system df
echo ""

# Service URLs
echo "Service URLs:"
echo "  Prometheus: http://localhost:9090"
echo "  Grafana:    http://localhost:3001 (admin/admin123)"
echo "  Kibana:     http://localhost:5601"
echo "  Jaeger:     http://localhost:16686"
echo "  Alertmanager: http://localhost:9093"
echo ""
EOF
    
    # Restart script
    cat > "$MONITORING_DIR/scripts/restart.sh" << 'EOF'
#!/bin/bash
# KGEN Monitoring Restart Script

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MONITORING_DIR="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="$MONITORING_DIR/docker/docker-compose.observability.yml"
ENV_FILE="$MONITORING_DIR/.env.monitoring"

echo "Restarting KGEN Observability Stack..."

# Graceful restart
docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" restart

echo "Restart completed."
EOF
    
    # Make scripts executable
    chmod +x "$MONITORING_DIR"/scripts/*.sh
    
    log "✓ Monitoring utility scripts created"
}

# Main deployment function
main() {
    log "Starting KGEN Observability Stack deployment..."
    
    check_prerequisites
    create_environment
    setup_directories
    validate_configs
    deploy_stack
    import_dashboards
    setup_elasticsearch
    create_scripts
    
    log ""
    log "🎉 KGEN Observability Stack deployed successfully!"
    log ""
    log "Service URLs:"
    log "  Prometheus:     http://localhost:9090"
    log "  Grafana:        http://localhost:3001 (admin/admin123)"
    log "  Kibana:         http://localhost:5601"
    log "  Jaeger:         http://localhost:16686"
    log "  Alertmanager:   http://localhost:9093"
    log "  Business API:   http://localhost:3002"
    log ""
    log "Next Steps:"
    log "1. Configure your applications to send metrics to Prometheus"
    log "2. Update alerting rules in prometheus/alert_rules.yml"
    log "3. Configure Slack/PagerDuty webhooks in .env.monitoring"
    log "4. Set up log forwarding to Logstash (port 5044)"
    log "5. Review security dashboard at Grafana"
    log ""
    log "Run './scripts/status.sh' to check stack health"
    log "Run './scripts/backup.sh' to backup monitoring data"
}

# Run main function
main "$@"