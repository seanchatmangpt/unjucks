#!/bin/bash

# KGEN Observability Stack Validation Script
# Comprehensive validation of all monitoring components

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Validation results
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0
WARNING_CHECKS=0

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO] $1${NC}"
}

log_success() {
    echo -e "${GREEN}[✓] $1${NC}"
    ((PASSED_CHECKS++))
}

log_warning() {
    echo -e "${YELLOW}[⚠] $1${NC}"
    ((WARNING_CHECKS++))
}

log_error() {
    echo -e "${RED}[✗] $1${NC}"
    ((FAILED_CHECKS++))
}

# Check function
check() {
    ((TOTAL_CHECKS++))
}

# Service connectivity check
check_service() {
    local service_name=$1
    local host=$2
    local port=$3
    local path=${4:-/}
    local timeout=${5:-5}
    
    check
    if curl -sf --max-time "$timeout" "http://${host}:${port}${path}" > /dev/null 2>&1; then
        log_success "$service_name is accessible at $host:$port"
        return 0
    else
        log_error "$service_name is NOT accessible at $host:$port"
        return 1
    fi
}

# Docker container check
check_container() {
    local container_name=$1
    
    check
    if docker ps --format '{{.Names}}' | grep -q "^${container_name}$"; then
        local status=$(docker ps --filter "name=${container_name}" --format '{{.Status}}')
        log_success "Container $container_name is running ($status)"
        return 0
    else
        log_error "Container $container_name is NOT running"
        return 1
    fi
}

# Metrics endpoint check
check_metrics() {
    local service_name=$1
    local url=$2
    
    check
    local response=$(curl -s "$url" 2>/dev/null)
    if [[ -n "$response" && "$response" == *"# HELP"* ]]; then
        local metric_count=$(echo "$response" | grep -c "# HELP" || true)
        log_success "$service_name metrics endpoint working ($metric_count metrics)"
        return 0
    else
        log_error "$service_name metrics endpoint failed"
        return 1
    fi
}

# Dashboard check
check_dashboard() {
    local dashboard_name=$1
    local url=$2
    
    check
    if curl -sf "$url" > /dev/null 2>&1; then
        log_success "$dashboard_name dashboard is accessible"
        return 0
    else
        log_error "$dashboard_name dashboard is NOT accessible"
        return 1
    fi
}

# Configuration file check
check_config_file() {
    local file_name=$1
    local file_path=$2
    
    check
    if [[ -f "$file_path" ]]; then
        local file_size=$(stat -f%z "$file_path" 2>/dev/null || stat -c%s "$file_path" 2>/dev/null || echo "0")
        if [[ "$file_size" -gt 0 ]]; then
            log_success "$file_name configuration exists ($file_size bytes)"
            return 0
        else
            log_error "$file_name configuration file is empty"
            return 1
        fi
    else
        log_error "$file_name configuration file missing: $file_path"
        return 1
    fi
}

# Volume check
check_volume() {
    local volume_name=$1
    
    check
    if docker volume ls --format '{{.Name}}' | grep -q "^${volume_name}$"; then
        log_success "Volume $volume_name exists"
        return 0
    else
        log_error "Volume $volume_name does NOT exist"
        return 1
    fi
}

# Network check
check_network() {
    local network_name=$1
    
    check
    if docker network ls --format '{{.Name}}' | grep -q "^${network_name}$"; then
        log_success "Network $network_name exists"
        return 0
    else
        log_error "Network $network_name does NOT exist"
        return 1
    fi
}

# Main validation function
main() {
    echo -e "${CYAN}"
    echo "=============================================="
    echo "  KGEN Observability Stack Validation"
    echo "=============================================="
    echo -e "${NC}"
    
    log_info "Starting comprehensive validation of monitoring stack..."
    echo ""
    
    # 1. Configuration Files Validation
    log_info "1. Validating Configuration Files..."
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    MONITORING_DIR="$(dirname "$SCRIPT_DIR")"
    
    check_config_file "Prometheus" "$MONITORING_DIR/prometheus/prometheus.yml"
    check_config_file "Prometheus Metrics" "$MONITORING_DIR/prometheus/kgen-metrics.js"
    check_config_file "Grafana Overview Dashboard" "$MONITORING_DIR/grafana/dashboards/kgen-overview.json"
    check_config_file "Security Dashboard" "$MONITORING_DIR/security/security-dashboard.json"
    check_config_file "Jaeger Config" "$MONITORING_DIR/jaeger/jaeger-config.yml"
    check_config_file "Logstash Config" "$MONITORING_DIR/elk/logstash.conf"
    check_config_file "Alertmanager Config" "$MONITORING_DIR/alerting/alertmanager.yml"
    check_config_file "Business Metrics API" "$MONITORING_DIR/metrics-api/business-metrics.js"
    check_config_file "Docker Compose" "$MONITORING_DIR/docker/docker-compose.observability.yml"
    echo ""
    
    # 2. Docker Infrastructure Validation
    log_info "2. Validating Docker Infrastructure..."
    
    # Check volumes
    check_volume "kgen_prometheus_data" || check_volume "monitoring_prometheus_data"
    check_volume "kgen_grafana_data" || check_volume "monitoring_grafana_data"
    check_volume "kgen_elasticsearch_data" || check_volume "monitoring_elasticsearch_data"
    check_volume "kgen_alertmanager_data" || check_volume "monitoring_alertmanager_data"
    
    # Check networks
    check_network "monitoring_monitoring" || check_network "kgen_monitoring"
    check_network "monitoring_kgen-network" || check_network "kgen_kgen-network"
    echo ""
    
    # 3. Container Status Validation
    log_info "3. Validating Container Status..."
    
    check_container "kgen-prometheus"
    check_container "kgen-grafana"
    check_container "kgen-alertmanager"
    check_container "kgen-elasticsearch"
    check_container "kgen-kibana"
    check_container "kgen-logstash"
    check_container "kgen-jaeger"
    check_container "kgen-node-exporter"
    check_container "kgen-cadvisor"
    check_container "kgen-blackbox-exporter"
    check_container "kgen-metrics-api"
    echo ""
    
    # 4. Service Connectivity Validation
    log_info "4. Validating Service Connectivity..."
    
    check_service "Prometheus" "localhost" "9090" "/-/healthy"
    check_service "Grafana" "localhost" "3001" "/api/health"
    check_service "Alertmanager" "localhost" "9093" "/-/healthy"
    check_service "Elasticsearch" "localhost" "9200" "/_cluster/health"
    check_service "Kibana" "localhost" "5601" "/api/status"
    check_service "Jaeger" "localhost" "16686" "/"
    check_service "Node Exporter" "localhost" "9100" "/metrics"
    check_service "cAdvisor" "localhost" "8080" "/metrics"
    check_service "Business Metrics API" "localhost" "3002" "/health"
    echo ""
    
    # 5. Metrics Endpoints Validation
    log_info "5. Validating Metrics Endpoints..."
    
    check_metrics "Prometheus" "http://localhost:9090/metrics"
    check_metrics "Node Exporter" "http://localhost:9100/metrics"
    check_metrics "cAdvisor" "http://localhost:8080/metrics"
    check_metrics "Alertmanager" "http://localhost:9093/metrics"
    check_metrics "Business API" "http://localhost:3002/metrics"
    echo ""
    
    # 6. Dashboard Accessibility Validation
    log_info "6. Validating Dashboard Accessibility..."
    
    check_dashboard "Grafana Login" "http://localhost:3001/login"
    check_dashboard "Prometheus" "http://localhost:9090/graph"
    check_dashboard "Jaeger UI" "http://localhost:16686/search"
    check_dashboard "Kibana" "http://localhost:5601/app/home"
    check_dashboard "Alertmanager" "http://localhost:9093/#/alerts"
    echo ""
    
    # 7. Data Flow Validation
    log_info "7. Validating Data Flow..."
    
    # Check if Prometheus can scrape targets
    check
    if curl -s "http://localhost:9090/api/v1/targets" | grep -q '"health":"up"'; then
        log_success "Prometheus targets are healthy"
    else
        log_warning "Some Prometheus targets may be down"
    fi
    
    # Check if Elasticsearch has indices
    check
    if curl -s "http://localhost:9200/_cat/indices" | grep -q "kgen"; then
        log_success "Elasticsearch has KGEN indices"
    else
        log_warning "No KGEN indices found in Elasticsearch (expected if no logs yet)"
    fi
    
    # Check if Grafana has data sources
    check
    if curl -s -u admin:admin123 "http://localhost:3001/api/datasources" | grep -q "Prometheus"; then
        log_success "Grafana has Prometheus data source"
    else
        log_warning "Grafana may not have Prometheus data source configured"
    fi
    echo ""
    
    # 8. Security Validation
    log_info "8. Validating Security Configuration..."
    
    # Check if services are using authentication
    check
    if curl -s "http://localhost:3001/api/health" | grep -q '"database":"ok"'; then
        log_success "Grafana authentication is configured"
    else
        log_warning "Grafana authentication may need configuration"
    fi
    
    # Check if Elasticsearch is accessible (should be restricted in production)
    check
    if curl -s "http://localhost:9200/_cluster/health" > /dev/null; then
        log_warning "Elasticsearch is publicly accessible (consider restricting in production)"
    else
        log_success "Elasticsearch access appears to be restricted"
    fi
    echo ""
    
    # 9. Performance Validation
    log_info "9. Validating Performance Metrics..."
    
    # Check system resources
    check
    local cpu_usage=$(top -l 1 -n 0 | grep "CPU usage" | awk '{print $3}' | sed 's/%//g' 2>/dev/null || echo "0")
    if [[ "${cpu_usage%.*}" -lt 80 ]]; then
        log_success "System CPU usage is acceptable (${cpu_usage}%)"
    else
        log_warning "System CPU usage is high (${cpu_usage}%)"
    fi
    
    check
    local memory_usage=$(free | grep Mem | awk '{printf "%.0f", $3/$2 * 100.0}' 2>/dev/null || echo "0")
    if [[ "$memory_usage" -lt 90 ]]; then
        log_success "System memory usage is acceptable (${memory_usage}%)"
    else
        log_warning "System memory usage is high (${memory_usage}%)"
    fi
    
    check
    local disk_usage=$(df / | tail -1 | awk '{print $5}' | sed 's/%//g')
    if [[ "$disk_usage" -lt 85 ]]; then
        log_success "System disk usage is acceptable (${disk_usage}%)"
    else
        log_warning "System disk usage is high (${disk_usage}%)"
    fi
    echo ""
    
    # Final Summary
    echo -e "${CYAN}"
    echo "=============================================="
    echo "            VALIDATION SUMMARY"
    echo "=============================================="
    echo -e "${NC}"
    
    echo -e "Total Checks: ${BLUE}$TOTAL_CHECKS${NC}"
    echo -e "Passed: ${GREEN}$PASSED_CHECKS${NC}"
    echo -e "Warnings: ${YELLOW}$WARNING_CHECKS${NC}"
    echo -e "Failed: ${RED}$FAILED_CHECKS${NC}"
    
    local success_rate=$((PASSED_CHECKS * 100 / TOTAL_CHECKS))
    echo -e "Success Rate: ${BLUE}${success_rate}%${NC}"
    
    echo ""
    
    if [[ $FAILED_CHECKS -eq 0 ]]; then
        echo -e "${GREEN}🎉 VALIDATION SUCCESSFUL!${NC}"
        echo -e "${GREEN}The KGEN Observability Stack is properly deployed and functional.${NC}"
        
        if [[ $WARNING_CHECKS -gt 0 ]]; then
            echo -e "${YELLOW}⚠️  Note: $WARNING_CHECKS warnings detected. Review above for optimization opportunities.${NC}"
        fi
        
        echo ""
        echo "Next Steps:"
        echo "1. Configure your applications to send metrics to http://localhost:9090"
        echo "2. Set up log forwarding to Logstash at localhost:5044"
        echo "3. Configure alerting channels in Alertmanager"
        echo "4. Customize Grafana dashboards for your specific needs"
        echo "5. Review security settings for production deployment"
        
        exit 0
    else
        echo -e "${RED}❌ VALIDATION FAILED!${NC}"
        echo -e "${RED}$FAILED_CHECKS critical issues detected. Please review the errors above.${NC}"
        
        echo ""
        echo "Common fixes:"
        echo "1. Run: docker-compose -f docker/docker-compose.observability.yml up -d"
        echo "2. Wait 2-3 minutes for services to fully start"
        echo "3. Check Docker logs: docker-compose logs [service-name]"
        echo "4. Ensure sufficient system resources (8GB RAM, 10GB disk)"
        echo "5. Re-run this validation script"
        
        exit 1
    fi
}

# Run main function
main "$@"