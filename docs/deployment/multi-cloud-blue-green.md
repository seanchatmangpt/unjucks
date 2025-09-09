# Multi-Cloud Blue-Green Deployment Guide

## 🌩️ Overview

This guide covers implementing blue-green deployments across AWS, Azure, and Google Cloud Platform, providing cloud-agnostic deployment strategies with platform-specific optimizations.

## ☁️ Cloud Provider Configurations

### 🌩️ AWS Implementation

#### Infrastructure Components
```yaml
# AWS Blue-Green Infrastructure
Load_Balancer: Application Load Balancer (ALB)
Compute: EC2 Auto Scaling Groups / ECS Services  
Traffic_Control: Target Groups with weighted routing
Health_Checks: ELB Health Checks + Custom endpoints
DNS: Route 53 with weighted routing policies
```

#### Deployment Scripts
```bash
# AWS Blue-Green Traffic Switch
aws elbv2 modify-target-group-attributes \
  --target-group-arn $BLUE_TG_ARN \
  --attributes Key=deregistration_delay.timeout_seconds,Value=30

aws elbv2 modify-listener \
  --listener-arn $LISTENER_ARN \
  --default-actions Type=forward,ForwardConfig='{
    "TargetGroups":[
      {"TargetGroupArn":"'$GREEN_TG_ARN'","Weight":100},
      {"TargetGroupArn":"'$BLUE_TG_ARN'","Weight":0}
    ]
  }'

# Health Check Validation
aws elbv2 describe-target-health \
  --target-group-arn $GREEN_TG_ARN \
  --query 'TargetHealthDescriptions[?TargetHealth.State==`healthy`]'
```

#### Auto Scaling Integration
```bash
# Update Launch Template
aws autoscaling update-auto-scaling-group \
  --auto-scaling-group-name app-green \
  --launch-template LaunchTemplateName=app-template,Version=\$Latest

# Gradual Instance Replacement
aws autoscaling start-instance-refresh \
  --auto-scaling-group-name app-green \
  --preferences '{
    "InstanceWarmup":300,
    "MinHealthyPercentage":50,
    "CheckpointPercentages":[50],
    "CheckpointDelay":600
  }'
```

### 🔷 Azure Implementation

#### Infrastructure Components
```yaml
# Azure Blue-Green Infrastructure  
Load_Balancer: Azure Traffic Manager / Application Gateway
Compute: Virtual Machine Scale Sets / App Service Slots
Traffic_Control: Traffic Manager endpoints with weights
Health_Checks: Traffic Manager probes + App insights
DNS: Azure DNS with Traffic Manager profiles
```

#### Deployment Scripts
```bash
# Azure Traffic Manager Blue-Green Switch
az network traffic-manager endpoint update \
  --resource-group $RG_NAME \
  --profile-name $TM_PROFILE \
  --name green-endpoint \
  --type azureEndpoints \
  --weight 100

az network traffic-manager endpoint update \
  --resource-group $RG_NAME \
  --profile-name $TM_PROFILE \
  --name blue-endpoint \
  --type azureEndpoints \
  --weight 0

# App Service Slot Swap (Alternative)
az webapp deployment slot swap \
  --resource-group $RG_NAME \
  --name $APP_NAME \
  --slot green \
  --target-slot production
```

#### VMSS Integration
```bash
# Update VMSS with new image
az vmss update \
  --resource-group $RG_NAME \
  --name app-green-vmss \
  --set virtualMachineProfile.storageProfile.imageReference.version=$NEW_VERSION

# Rolling upgrade with health checks
az vmss rolling-upgrade start \
  --resource-group $RG_NAME \
  --name app-green-vmss \
  --policy '{
    "maxBatchInstancePercent":50,
    "maxUnhealthyInstancePercent":20,
    "pauseTimeBetweenBatches":"PT300S"
  }'
```

### 🌐 Google Cloud Implementation

#### Infrastructure Components
```yaml
# GCP Blue-Green Infrastructure
Load_Balancer: Global HTTP(S) Load Balancer
Compute: Managed Instance Groups / Cloud Run services
Traffic_Control: Backend service traffic splitting
Health_Checks: HTTP/HTTPS health checks
DNS: Cloud DNS with load balancer integration
```

#### Deployment Scripts
```bash
# GCP Backend Service Traffic Split
gcloud compute backend-services update $BACKEND_SERVICE \
  --global \
  --backend=group=$GREEN_MIG,balancing-mode=UTILIZATION,max-utilization=0.8,capacity-scaler=1.0 \
  --backend=group=$BLUE_MIG,balancing-mode=UTILIZATION,max-utilization=0.8,capacity-scaler=0.0

# Gradual traffic migration
for weight in 10 25 50 75 100; do
  gcloud compute backend-services update $BACKEND_SERVICE \
    --global \
    --backend=group=$GREEN_MIG,capacity-scaler=$(echo "scale=2; $weight/100" | bc) \
    --backend=group=$BLUE_MIG,capacity-scaler=$(echo "scale=2; (100-$weight)/100" | bc)
  
  echo "Switched to ${weight}% green traffic"
  sleep 300  # 5 minute observation
done
```

#### Cloud Run Blue-Green
```bash
# Deploy new revision
gcloud run deploy $SERVICE_NAME \
  --image $NEW_IMAGE \
  --region $REGION \
  --no-traffic

# Gradually shift traffic
gcloud run services update-traffic $SERVICE_NAME \
  --region $REGION \
  --to-revisions=$NEW_REVISION=10,$OLD_REVISION=90

# Full traffic switch after validation
gcloud run services update-traffic $SERVICE_NAME \
  --region $REGION \
  --to-revisions=$NEW_REVISION=100
```

## 🔄 Universal Blue-Green Patterns

### Traffic Splitting Strategies

#### Canary Deployment Pattern
```yaml
traffic_steps:
  - percentage: 5
    duration: 2_minutes
    health_check_interval: 30_seconds
  - percentage: 10  
    duration: 5_minutes
    health_check_interval: 30_seconds
  - percentage: 25
    duration: 10_minutes
    health_check_interval: 60_seconds
  - percentage: 50
    duration: 15_minutes
    health_check_interval: 60_seconds
  - percentage: 100
    duration: 30_minutes
    health_check_interval: 120_seconds
```

#### Linear Rollout Pattern
```yaml
traffic_steps:
  - percentage: 20
    duration: 5_minutes
  - percentage: 40
    duration: 5_minutes
  - percentage: 60
    duration: 5_minutes
  - percentage: 80
    duration: 5_minutes
  - percentage: 100
    duration: 10_minutes
```

### Health Check Validation

#### Multi-Tier Health Checks
```bash
#!/bin/bash
# Universal health check script

validate_health() {
  local endpoint=$1
  local timeout=${2:-10}
  
  # Application health
  curl -f -m $timeout "$endpoint/health" || return 1
  
  # Database connectivity  
  curl -f -m $timeout "$endpoint/health/db" || return 1
  
  # Cache connectivity
  curl -f -m $timeout "$endpoint/health/cache" || return 1
  
  # External dependencies
  curl -f -m $timeout "$endpoint/health/dependencies" || return 1
  
  # Application readiness
  curl -f -m $timeout "$endpoint/ready" || return 1
  
  return 0
}

# Comprehensive validation with retries
validate_with_retries() {
  local endpoint=$1
  local max_attempts=${2:-30}
  local delay=${3:-10}
  
  for attempt in $(seq 1 $max_attempts); do
    if validate_health "$endpoint"; then
      echo "✅ Health validation passed (attempt $attempt)"
      return 0
    else
      echo "⏳ Health check failed (attempt $attempt/$max_attempts)"
      if [ $attempt -eq $max_attempts ]; then
        echo "❌ Health validation failed after $max_attempts attempts"
        return 1
      fi
      sleep $delay
    fi
  done
}
```

### Performance Validation

#### Load Testing Integration
```bash
#!/bin/bash
# Performance validation script

performance_test() {
  local endpoint=$1
  local requests=${2:-1000}
  local concurrency=${3:-10}
  local timeout=${4:-30}
  
  echo "⚡ Running performance test..."
  echo "Endpoint: $endpoint"
  echo "Requests: $requests"
  echo "Concurrency: $concurrency"
  
  # Use Apache Bench for load testing
  ab_output=$(ab -n $requests -c $concurrency -s $timeout "$endpoint/health" 2>/dev/null)
  
  # Extract metrics
  success_rate=$(echo "$ab_output" | grep "Complete requests:" | awk '{print $3}')
  failed_requests=$(echo "$ab_output" | grep "Failed requests:" | awk '{print $3}')
  avg_time=$(echo "$ab_output" | grep "Time per request:" | head -1 | awk '{print $4}')
  
  success_percentage=$(( (success_rate * 100) / requests ))
  
  echo "📊 Performance Results:"
  echo "  Success Rate: ${success_percentage}%"  
  echo "  Failed Requests: $failed_requests"
  echo "  Average Response Time: ${avg_time}ms"
  
  # Validate against thresholds
  if [ $success_percentage -ge 95 ] && [ $(echo "$avg_time < 500" | bc -l) -eq 1 ]; then
    echo "✅ Performance validation passed"
    return 0
  else
    echo "❌ Performance validation failed"
    return 1
  fi
}
```

## 🗄️ Database Migration Strategies

### Forward-Compatible Migrations

#### Strategy Overview
```yaml
migration_approach: additive_only
constraints:
  - no_column_drops
  - no_table_renames  
  - no_data_type_changes
  - maintain_backward_compatibility

phases:
  1. deploy_schema_changes: Add new columns/tables
  2. deploy_application: Update code to use new schema
  3. data_migration: Populate new columns
  4. cleanup_phase: Remove old columns (next deployment)
```

#### Implementation Pattern
```sql
-- Phase 1: Add new columns (compatible with old code)
ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN verification_token VARCHAR(255);

-- Phase 2: Create new indexes (non-blocking)
CREATE INDEX CONCURRENTLY idx_users_email_verified 
ON users(email_verified) WHERE email_verified = true;

-- Phase 3: Populate new columns
UPDATE users SET email_verified = true 
WHERE email IS NOT NULL AND created_at < NOW() - INTERVAL '30 days';
```

### Shadow Database Testing

#### Pattern Implementation
```bash
#!/bin/bash
# Shadow database migration testing

shadow_migration_test() {
  local prod_db=$1
  local shadow_db="shadow_$(date +%s)"
  
  echo "🌑 Creating shadow database: $shadow_db"
  
  # Create shadow database from production backup
  createdb $shadow_db
  pg_dump $prod_db | psql $shadow_db
  
  # Apply migrations to shadow database
  echo "📝 Applying migrations to shadow database..."
  DATABASE_URL="postgresql:///$shadow_db" rails db:migrate
  
  # Run application tests against shadow database
  echo "🧪 Running tests against shadow database..."
  DATABASE_URL="postgresql:///$shadow_db" rails test
  
  if [ $? -eq 0 ]; then
    echo "✅ Shadow database testing passed"
    
    # Apply migrations to production
    rails db:migrate
  else
    echo "❌ Shadow database testing failed"
    dropdb $shadow_db
    return 1
  fi
  
  # Cleanup shadow database
  dropdb $shadow_db
}
```

## 📊 Monitoring and Observability

### Key Metrics Dashboard

#### Essential Deployment Metrics
```yaml
deployment_metrics:
  success_rate:
    target: ">99%"
    alert_threshold: "<95%"
  
  deployment_duration:
    target: "<45_minutes"
    alert_threshold: ">60_minutes"
    
  rollback_time:
    target: "<5_minutes"
    alert_threshold: ">10_minutes"
    
  zero_downtime:
    target: "100%"
    alert_threshold: "<99.9%"

application_metrics:
  response_time:
    target: "<200ms p95"
    alert_threshold: ">500ms p95"
    
  error_rate:
    target: "<0.1%"
    alert_threshold: ">1%"
    
  throughput:
    target: "maintain_baseline"
    alert_threshold: "<80%_baseline"
```

#### Alerting Configuration
```yaml
alerts:
  deployment_failure:
    condition: "deployment_status == 'failed'"
    severity: "critical"
    notification: ["slack", "pagerduty"]
    
  health_check_failure:
    condition: "health_check_failures > 5 consecutive"
    severity: "critical" 
    auto_action: "trigger_rollback"
    
  performance_degradation:
    condition: "response_time_p95 > 500ms for 2min"
    severity: "warning"
    auto_action: "scale_up"
    
  error_rate_spike:
    condition: "error_rate > 5% for 1min"  
    severity: "critical"
    auto_action: "trigger_rollback"
```

## 🔧 Troubleshooting Guide

### Common Deployment Issues

#### Traffic Switching Problems
```bash
# Diagnosis commands by cloud provider

# AWS
aws elbv2 describe-load-balancers --names $LB_NAME
aws elbv2 describe-target-health --target-group-arn $TG_ARN

# Azure  
az network traffic-manager profile show --name $TM_PROFILE
az network traffic-manager endpoint show --name $ENDPOINT_NAME

# GCP
gcloud compute backend-services describe $BACKEND_SERVICE --global
gcloud compute health-checks describe $HEALTH_CHECK_NAME
```

#### Health Check Failures
```bash
# Debug health check endpoints
for endpoint in /health /health/db /health/cache /ready; do
  echo "Testing $endpoint..."
  curl -v "https://$DEPLOYMENT_URL$endpoint"
  echo "---"
done

# Check application logs
kubectl logs -f deployment/app-green --tail=100

# Verify database connectivity
psql $DATABASE_URL -c "SELECT version(), now();"
```

#### Performance Issues
```bash
# Resource utilization check
kubectl top pods --selector=app=myapp,slot=green

# Memory profiling
curl -s "https://$DEPLOYMENT_URL/debug/pprof/heap" > heap.prof
go tool pprof heap.prof

# Connection pool status  
curl -s "https://$DEPLOYMENT_URL/health/db" | jq .connection_pool
```

### Rollback Scenarios

#### Immediate Rollback Triggers
- Health checks failing for >2 minutes
- Error rate >10% for >30 seconds  
- Response time >2000ms for >1 minute
- Security vulnerability detected

#### Rollback Execution
```bash
# Universal rollback script
rollback_deployment() {
  local current_slot=$1
  local previous_slot=$2
  
  echo "🚨 Executing emergency rollback..."
  echo "From: $current_slot → To: $previous_slot"
  
  # Cloud-specific rollback commands
  case "$CLOUD_PROVIDER" in
    "aws")
      aws elbv2 modify-listener --listener-arn $LISTENER_ARN \
        --default-actions Type=forward,TargetGroupArn=$PREVIOUS_TG_ARN
      ;;
    "azure")  
      az network traffic-manager endpoint update \
        --name $previous_slot --weight 100
      az network traffic-manager endpoint update \
        --name $current_slot --weight 0
      ;;
    "gcp")
      gcloud compute backend-services update $BACKEND_SERVICE \
        --backend=group=$PREVIOUS_MIG,capacity-scaler=1.0 \
        --backend=group=$CURRENT_MIG,capacity-scaler=0.0
      ;;
  esac
  
  # Verify rollback success
  sleep 30
  validate_with_retries "https://$DEPLOYMENT_URL" 10 10
}
```

## 📋 Best Practices Summary

### ✅ Do's
- Always test in staging environment first
- Implement comprehensive health checks  
- Use gradual traffic splitting
- Monitor key metrics continuously
- Have automated rollback procedures
- Document all deployment steps
- Maintain deployment artifacts
- Test rollback procedures regularly

### ❌ Don'ts  
- Never deploy directly to production without staging
- Don't skip health check validation
- Don't switch 100% traffic immediately
- Don't ignore performance metrics
- Don't deploy without rollback plan
- Don't modify database schema without migration strategy
- Don't disable monitoring during deployments

---

**Last Updated**: 2025-01-09  
**Version**: 2.0  
**Maintained By**: Blue-Green Deployment Engineer