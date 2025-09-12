# KGEN Enterprise Deployment Guide

## Overview

This guide provides comprehensive instructions for deploying KGEN in enterprise environments with high availability, scalability, and security. KGEN supports multiple deployment strategies including Kubernetes, Docker Swarm, and multi-cloud architectures.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Deployment Options](#deployment-options)
- [Kubernetes Deployment](#kubernetes-deployment)
- [Docker Swarm Deployment](#docker-swarm-deployment)
- [Multi-Cloud Deployment](#multi-cloud-deployment)
- [Configuration Management](#configuration-management)
- [Security Considerations](#security-considerations)
- [Monitoring and Observability](#monitoring-and-observability)
- [Blue-Green Deployments](#blue-green-deployments)
- [Disaster Recovery](#disaster-recovery)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### Infrastructure Requirements

- **Kubernetes**: v1.24+ with RBAC enabled
- **Docker**: v20.10+ with Docker Swarm mode (for Swarm deployments)
- **Database**: PostgreSQL 14+ or MySQL 8+
- **Cache**: Redis 6+ (optional but recommended)
- **Load Balancer**: NGINX, HAProxy, or cloud load balancer
- **Certificate Management**: cert-manager (Kubernetes) or manual SSL certificates

### Resource Requirements

#### Minimum (Development)
- **CPU**: 2 vCPUs
- **Memory**: 4 GB RAM
- **Storage**: 20 GB
- **Network**: 1 Gbps

#### Recommended (Production)
- **CPU**: 8+ vCPUs
- **Memory**: 16+ GB RAM
- **Storage**: 100+ GB SSD
- **Network**: 10+ Gbps

#### High Availability (Enterprise)
- **CPU**: 16+ vCPUs (distributed)
- **Memory**: 32+ GB RAM
- **Storage**: 500+ GB SSD (replicated)
- **Network**: 10+ Gbps with redundancy

## Deployment Options

### 1. Kubernetes Deployment (Recommended)
- **Use Case**: Cloud-native, scalable, enterprise environments
- **Features**: Auto-scaling, rolling updates, service discovery, secrets management
- **Complexity**: Medium to High
- **Maintenance**: Automated with GitOps

### 2. Docker Swarm Deployment
- **Use Case**: Simpler container orchestration, edge deployments
- **Features**: Built-in load balancing, overlay networking, secrets
- **Complexity**: Low to Medium
- **Maintenance**: Manual or scripted

### 3. Multi-Cloud Deployment
- **Use Case**: Vendor diversification, disaster recovery, compliance
- **Features**: Cross-cloud replication, cost optimization, high availability
- **Complexity**: High
- **Maintenance**: Automated with Terraform

## Kubernetes Deployment

### Quick Start with Helm

```bash
# Add KGEN Helm repository
helm repo add kgen https://charts.kgen.io
helm repo update

# Install KGEN with default values
helm install kgen kgen/kgen --namespace kgen --create-namespace

# Install with custom values
helm install kgen kgen/kgen -f values-production.yaml --namespace kgen
```

### Manual Kubernetes Deployment

1. **Create Namespace**
```bash
kubectl create namespace kgen
```

2. **Apply Base Resources**
```bash
kubectl apply -f infrastructure/k8s/rbac/
kubectl apply -f infrastructure/k8s/security/
kubectl apply -f infrastructure/k8s/config/
```

3. **Deploy Database (if not using external)**
```bash
# PostgreSQL with persistent storage
kubectl apply -f infrastructure/k8s/database/postgresql.yaml
```

4. **Deploy KGEN Application**
```bash
kubectl apply -f infrastructure/k8s/deployment/
kubectl apply -f infrastructure/k8s/load-balancing/
kubectl apply -f infrastructure/k8s/networking/
```

5. **Configure Auto-scaling**
```bash
kubectl apply -f infrastructure/k8s/autoscaling/
```

6. **Setup Monitoring**
```bash
kubectl apply -f infrastructure/k8s/monitoring/
```

### Helm Configuration

Create a `values-production.yaml` file:

```yaml
# Production Helm values
replicaCount: 3

image:
  repository: ghcr.io/your-org/kgen
  tag: "v1.0.0"
  pullPolicy: IfNotPresent

resources:
  limits:
    cpu: 1000m
    memory: 1Gi
  requests:
    cpu: 100m
    memory: 256Mi

autoscaling:
  enabled: true
  minReplicas: 3
  maxReplicas: 20
  targetCPUUtilizationPercentage: 70

ingress:
  enabled: true
  className: nginx
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/rate-limit: "100"
  hosts:
    - host: kgen.yourdomain.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: kgen-tls
      hosts:
        - kgen.yourdomain.com

database:
  external:
    enabled: true
    host: your-postgresql-host
    database: kgen
    username: kgen_user
    existingSecret: kgen-database-secret

monitoring:
  prometheus:
    enabled: true
  serviceMonitor:
    enabled: true

networkPolicy:
  enabled: true
```

## Docker Swarm Deployment

### Initialize Docker Swarm

```bash
# Initialize swarm on manager node
docker swarm init

# Join worker nodes (run on worker nodes)
docker swarm join --token SWMTKN-1-xxx... manager-ip:2377
```

### Deploy KGEN Stack

1. **Prepare Environment**
```bash
# Clone repository
git clone https://github.com/your-org/kgen
cd kgen/infrastructure/docker-swarm

# Set environment variables
export KGEN_IMAGE=ghcr.io/your-org/kgen
export KGEN_TAG=v1.0.0
export DATABASE_PASSWORD=$(openssl rand -base64 32)
export REDIS_PASSWORD=$(openssl rand -base64 32)
```

2. **Create Required Directories**
```bash
sudo mkdir -p /opt/kgen/{data,postgres,redis,prometheus,grafana}
sudo chown -R $(id -u):$(id -g) /opt/kgen
```

3. **Deploy Stack**
```bash
# Using deployment script (recommended)
./scripts/deploy.sh deploy

# Or manual deployment
docker stack deploy -c docker-compose.production.yml kgen
```

### Blue-Green Deployment with Docker Swarm

```bash
# Deploy new version to green slot
./scripts/deploy.sh blue-green

# Rollback if needed
./scripts/deploy.sh rollback

# Check deployment status
./scripts/deploy.sh status
```

## Multi-Cloud Deployment

### Terraform Configuration

1. **Initialize Terraform**
```bash
cd infrastructure/terraform
terraform init
```

2. **Configure Variables**
```hcl
# terraform.tfvars
project_name = "kgen"
environment = "production"

cloud_providers = ["aws", "azure", "gcp"]
deployment_strategy = "active-active"

# AWS Configuration
aws_region = "us-west-2"
aws_instance_type = "t3.large"

# Azure Configuration  
azure_region = "East US 2"
azure_vm_size = "Standard_D2s_v3"

# GCP Configuration
gcp_project_id = "your-project-id"
gcp_region = "us-central1"
gcp_machine_type = "e2-standard-2"

# Database Configuration
db_allocated_storage = 100
backup_retention_days = 7

# Monitoring
enable_monitoring = true
enable_prometheus = true
enable_grafana = true
```

3. **Deploy Infrastructure**
```bash
# Plan deployment
terraform plan

# Apply configuration
terraform apply

# Get outputs
terraform output
```

### Multi-Cloud Networking

The Terraform configuration automatically sets up:
- **Cross-cloud VPN connections** for secure communication
- **Load balancers** in each cloud for traffic distribution  
- **DNS failover** for automatic traffic routing
- **Cross-cloud data replication** for consistency

## Configuration Management

### Environment Variables

KGEN supports configuration through environment variables:

```bash
# Core Configuration
NODE_ENV=production
PORT=3000
LOG_LEVEL=info

# Database Configuration
DATABASE_HOST=postgresql.default.svc.cluster.local
DATABASE_PORT=5432
DATABASE_NAME=kgen
DATABASE_USERNAME=kgen_user
DATABASE_PASSWORD=secure_password
DATABASE_SSL=true

# Redis Configuration (Optional)
REDIS_HOST=redis.default.svc.cluster.local
REDIS_PORT=6379
REDIS_PASSWORD=redis_password
REDIS_DB=0

# Security Configuration
JWT_SECRET=your_jwt_secret
SESSION_SECRET=your_session_secret
ENCRYPTION_KEY=your_encryption_key

# External Integrations
GITHUB_TOKEN=ghp_xxx (optional)
SLACK_WEBHOOK_URL=https://hooks.slack.com/xxx (optional)

# Monitoring
METRICS_PORT=9090
PROMETHEUS_ENABLED=true
```

### ConfigMaps (Kubernetes)

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: kgen-config
data:
  kgen.config.ts: |
    export default {
      directories: {
        out: './generated',
        state: './.kgen/state',
        cache: './.kgen/cache',
        templates: '_templates',
        rules: './rules',
        knowledge: './knowledge'
      },
      // ... additional configuration
    };
```

### Secrets Management

#### Kubernetes Secrets
```bash
# Create database secret
kubectl create secret generic kgen-database-secret \
  --from-literal=password=secure_password \
  --from-literal=username=kgen_user \
  --from-literal=host=postgresql \
  --from-literal=database=kgen \
  --namespace=kgen

# Create application secrets  
kubectl create secret generic kgen-app-secrets \
  --from-literal=jwt-secret=your_jwt_secret \
  --from-literal=session-secret=your_session_secret \
  --from-literal=encryption-key=your_encryption_key \
  --namespace=kgen
```

#### External Secrets Operator
```yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: kgen-secrets
spec:
  refreshInterval: 300s
  secretStoreRef:
    name: aws-secrets-manager
    kind: SecretStore
  target:
    name: kgen-app-secrets
  data:
  - secretKey: jwt-secret
    remoteRef:
      key: kgen/production
      property: jwt-secret
```

## Security Considerations

### Network Security

1. **Network Policies** (Kubernetes)
```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: kgen-network-policy
spec:
  podSelector:
    matchLabels:
      app.kubernetes.io/name: kgen
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: ingress-nginx
    ports:
    - protocol: TCP
      port: 3000
```

2. **TLS/SSL Configuration**
```yaml
# cert-manager ClusterIssuer
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@yourdomain.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
```

### Container Security

1. **Security Contexts**
```yaml
securityContext:
  runAsNonRoot: true
  runAsUser: 65534
  fsGroup: 65534
  allowPrivilegeEscalation: false
  readOnlyRootFilesystem: true
  capabilities:
    drop:
    - ALL
```

2. **Image Security**
```bash
# Scan container images
docker scan ghcr.io/your-org/kgen:latest

# Use distroless base images
FROM gcr.io/distroless/nodejs:18
```

### RBAC Configuration

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: kgen-role
rules:
- apiGroups: [""]
  resources: ["configmaps", "secrets"]
  verbs: ["get", "list"]
- apiGroups: [""]
  resources: ["pods"]
  verbs: ["get", "list"]
```

## Monitoring and Observability

### Prometheus Metrics

KGEN exposes metrics at `/metrics` endpoint:

```prometheus
# Request metrics
http_requests_total
http_request_duration_seconds

# Application metrics  
kgen_generation_requests_total
kgen_generation_duration_seconds
kgen_cache_hits_total
kgen_cache_misses_total

# Resource metrics
process_cpu_usage_seconds_total
process_memory_usage_bytes
nodejs_heap_usage_bytes
```

### Grafana Dashboards

1. **Application Dashboard**: Request rates, latency, errors
2. **Infrastructure Dashboard**: CPU, memory, network, storage
3. **Business Dashboard**: Generation metrics, cache performance

### Alerting Rules

```yaml
groups:
- name: kgen-application
  rules:
  - alert: KGENHighErrorRate
    expr: rate(http_requests_total{code=~"5.."}[5m]) > 0.1
    for: 5m
    labels:
      severity: critical
    annotations:
      summary: "KGEN high error rate detected"
      
  - alert: KGENHighLatency
    expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 2
    for: 5m  
    labels:
      severity: warning
    annotations:
      summary: "KGEN high latency detected"
```

### Health Checks

KGEN provides multiple health check endpoints:

- **`/health`**: Overall application health
- **`/ready`**: Readiness probe (K8s)
- **`/live`**: Liveness probe (K8s)
- **`/health/database`**: Database connectivity
- **`/health/redis`**: Redis connectivity

## Blue-Green Deployments

### Kubernetes Blue-Green

Use the provided blue-green deployment script:

```bash
# Deploy new version
./infrastructure/scripts/blue-green-deploy.sh deploy v1.1.0

# Rollback if needed
./infrastructure/scripts/blue-green-deploy.sh rollback

# Check status
./infrastructure/scripts/blue-green-deploy.sh status
```

### Traffic Switching Strategies

1. **Immediate Switch**: Instant traffic cutover
2. **Gradual Switch**: Progressive traffic migration (10%, 50%, 100%)
3. **Canary Deployment**: Small percentage for testing

### Automated Rollback

The deployment system automatically rolls back if:
- Health checks fail
- Error rate exceeds threshold (5%)
- Response time exceeds SLA (2 seconds)

## Disaster Recovery

### Backup Strategy

1. **Database Backups**
```bash
# Automated PostgreSQL backups
kubectl create cronjob postgresql-backup \
  --image=postgres:15 \
  --schedule="0 2 * * *" \
  -- /bin/bash -c "pg_dump -h postgres -U kgen_user kgen > /backup/kgen-$(date +%Y%m%d).sql"
```

2. **Configuration Backups**
```bash
# Backup Kubernetes resources
kubectl get all,configmaps,secrets -n kgen -o yaml > kgen-backup.yaml
```

3. **Cross-Region Replication**
```yaml
# Multi-cloud backup configuration (Terraform)
backup_strategy = {
  enabled = true
  frequency = "daily"
  retention_days = 30
  cross_region = true
  cross_cloud = true
}
```

### Recovery Procedures

1. **Database Recovery**
```bash
# Restore from backup
psql -h postgres -U kgen_user -d kgen < kgen-backup.sql
```

2. **Application Recovery**
```bash
# Redeploy application
kubectl apply -f kgen-backup.yaml
```

3. **Multi-Cloud Failover**
```bash
# Switch to secondary cloud
terraform workspace select disaster-recovery
terraform apply -var="failover_enabled=true"
```

## Troubleshooting

### Common Issues

#### 1. Pod CrashLoopBackOff
```bash
# Check pod logs
kubectl logs -f pod/kgen-xxx --previous

# Check pod events
kubectl describe pod kgen-xxx

# Common causes:
# - Database connection issues
# - Missing environment variables
# - Resource constraints
# - Image pull errors
```

#### 2. Service Unavailable
```bash
# Check service endpoints
kubectl get endpoints kgen

# Check ingress configuration
kubectl describe ingress kgen

# Check network policies
kubectl get networkpolicies
```

#### 3. High Memory Usage
```bash
# Check resource utilization
kubectl top pods -n kgen

# Increase memory limits
kubectl patch deployment kgen -p '{"spec":{"template":{"spec":{"containers":[{"name":"kgen","resources":{"limits":{"memory":"2Gi"}}}]}}}}'

# Enable memory profiling
kubectl exec -it kgen-xxx -- node --inspect-brk=0.0.0.0:9229 app.js
```

#### 4. Database Connection Issues
```bash
# Test database connectivity
kubectl run -it --rm debug --image=postgres:15 --restart=Never -- psql -h postgres -U kgen_user -d kgen

# Check database logs
kubectl logs -f postgresql-xxx

# Verify secrets
kubectl get secret kgen-database-secret -o yaml
```

### Performance Tuning

#### 1. Resource Optimization
```yaml
resources:
  requests:
    cpu: 100m      # Minimum required
    memory: 256Mi  # Minimum required
  limits:
    cpu: 1000m     # Maximum allowed
    memory: 1Gi    # Maximum allowed
```

#### 2. Auto-scaling Configuration
```yaml
autoscaling:
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory  
      target:
        type: Utilization
        averageUtilization: 80
```

#### 3. Cache Optimization
```yaml
redis:
  enabled: true
  architecture: standalone
  master:
    persistence:
      enabled: true
      size: 8Gi
  replica:
    replicaCount: 2
```

### Debugging Commands

```bash
# Check cluster status
kubectl cluster-info
kubectl get nodes
kubectl get pods --all-namespaces

# Check KGEN namespace
kubectl get all -n kgen
kubectl describe deployment kgen -n kgen

# Check logs
kubectl logs -f deployment/kgen -n kgen
kubectl logs -f deployment/prometheus -n kgen

# Check metrics
kubectl port-forward svc/prometheus 9090:9090 -n kgen
# Open http://localhost:9090

# Check configuration
kubectl get configmaps -n kgen -o yaml
kubectl get secrets -n kgen

# Network debugging
kubectl run -it --rm debug --image=nicolaka/netshoot --restart=Never -- bash
```

### Support and Documentation

- **Documentation**: https://docs.kgen.io
- **GitHub Issues**: https://github.com/your-org/kgen/issues
- **Community**: https://discord.gg/kgen
- **Enterprise Support**: support@kgen.io

---

## Next Steps

1. Review the [Security Hardening Guide](./SECURITY_HARDENING.md)
2. Set up [CI/CD Pipelines](./CICD_GUIDE.md)
3. Configure [Disaster Recovery](./DISASTER_RECOVERY.md)
4. Implement [Cost Optimization](./COST_OPTIMIZATION.md)