# Production Deployment Guide - Unjucks RDF Filters

## Overview

This guide provides comprehensive instructions for deploying the Unjucks RDF filter system to production environments with enterprise-grade reliability, security, and performance.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Production Architecture](#production-architecture)
3. [Environment Setup](#environment-setup)
4. [Security Configuration](#security-configuration)
5. [Monitoring & Observability](#monitoring--observability)
6. [Deployment Process](#deployment-process)
7. [Post-Deployment Validation](#post-deployment-validation)
8. [Operations & Maintenance](#operations--maintenance)
9. [Troubleshooting](#troubleshooting)
10. [Compliance & Governance](#compliance--governance)

## Prerequisites

### System Requirements

- **Operating System**: Ubuntu 20.04+ LTS, RHEL 8+, or CentOS 8+
- **Node.js**: Version 18.x or 20.x (LTS versions)
- **Memory**: Minimum 4GB RAM, Recommended 16GB+
- **CPU**: Minimum 2 cores, Recommended 8+ cores
- **Storage**: Minimum 50GB, Recommended 500GB+ SSD
- **Network**: Stable internet connection with sufficient bandwidth

### Infrastructure Components

- **Container Orchestration**: Kubernetes 1.24+ or Docker Swarm
- **Load Balancer**: NGINX, HAProxy, or cloud load balancer
- **Database**: PostgreSQL 14+ (for metadata and caching)
- **Message Queue**: Redis 7+ or RabbitMQ 3.11+
- **Monitoring**: Prometheus + Grafana stack
- **Logging**: ELK Stack or equivalent centralized logging

### Access Requirements

- SSH access to production servers
- Docker registry access for container images
- DNS management capabilities
- SSL certificate management
- Monitoring system access

## Production Architecture

### High-Level Architecture

```
[Internet] → [Load Balancer] → [API Gateway] → [Unjucks Instances]
                                                      ↓
[Monitoring] ← [Service Mesh] ← [Container Platform] ← [Storage Layer]
```

### Component Breakdown

#### 1. Frontend Layer
- **Load Balancer**: Distributes traffic across multiple instances
- **API Gateway**: Handles authentication, rate limiting, and routing
- **SSL Termination**: Manages TLS certificates and encryption

#### 2. Application Layer
- **Unjucks Service**: Core RDF filtering and template rendering
- **Worker Processes**: Background processing for heavy operations
- **Cache Layer**: Redis for fast data access and session storage

#### 3. Data Layer
- **Primary Database**: PostgreSQL for persistent data
- **File Storage**: Distributed file system for templates and assets
- **Backup Storage**: Automated backup and disaster recovery

#### 4. Observability Layer
- **Metrics**: Prometheus for metrics collection
- **Logs**: Centralized logging with structured formats
- **Traces**: Distributed tracing for request flow analysis
- **Alerting**: PagerDuty or similar for incident management

## Environment Setup

### 1. Infrastructure Provisioning

#### Using Terraform (Recommended)

```hcl
# infrastructure/main.tf
resource "aws_instance" "unjucks_app" {
  count                  = 3
  ami                   = data.aws_ami.ubuntu.id
  instance_type         = "t3.large"
  vpc_security_group_ids = [aws_security_group.unjucks.id]
  subnet_id             = aws_subnet.private[count.index].id
  
  user_data = file("${path.module}/user_data.sh")
  
  tags = {
    Name = "unjucks-app-${count.index + 1}"
    Environment = "production"
    Service = "unjucks"
  }
}

resource "aws_rds_instance" "unjucks_db" {
  identifier = "unjucks-production"
  engine     = "postgres"
  engine_version = "14.9"
  instance_class = "db.t3.medium"
  allocated_storage = 100
  storage_encrypted = true
  
  db_name  = "unjucks"
  username = "unjucks_user"
  password = var.db_password
  
  backup_retention_period = 30
  backup_window = "03:00-04:00"
  maintenance_window = "sun:04:00-sun:05:00"
  
  skip_final_snapshot = false
  final_snapshot_identifier = "unjucks-final-${formatdate("YYYY-MM-DD-hhmm", timestamp())}"
}
```

#### Manual Setup

```bash
# 1. Update system packages
sudo apt update && sudo apt upgrade -y

# 2. Install Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 3. Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# 4. Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 5. Install monitoring tools
sudo apt-get install -y prometheus grafana-server
```

### 2. Network Configuration

#### Firewall Rules

```bash
# Allow SSH (restrict to management IPs)
sudo ufw allow from <MANAGEMENT_IP> to any port 22

# Allow HTTP/HTTPS
sudo ufw allow 80
sudo ufw allow 443

# Allow application port (internal only)
sudo ufw allow from <VPC_CIDR> to any port 3000

# Allow monitoring
sudo ufw allow from <MONITORING_IP> to any port 9090
sudo ufw allow from <MONITORING_IP> to any port 3000

# Enable firewall
sudo ufw --force enable
```

#### Load Balancer Configuration (NGINX)

```nginx
# /etc/nginx/sites-available/unjucks
upstream unjucks_backend {
    least_conn;
    server 10.0.1.10:3000 max_fails=3 fail_timeout=30s;
    server 10.0.1.11:3000 max_fails=3 fail_timeout=30s;
    server 10.0.1.12:3000 max_fails=3 fail_timeout=30s;
}

server {
    listen 80;
    server_name unjucks.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name unjucks.yourdomain.com;
    
    ssl_certificate /etc/ssl/certs/unjucks.crt;
    ssl_certificate_key /etc/ssl/private/unjucks.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    
    # Security headers
    add_header Strict-Transport-Security "max-age=63072000" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    
    # Rate limiting
    limit_req_zone $binary_remote_addr zone=unjucks_limit:10m rate=10r/s;
    limit_req zone=unjucks_limit burst=20 nodelay;
    
    location / {
        proxy_pass http://unjucks_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
        
        # Health check
        proxy_next_upstream error timeout invalid_header http_500 http_502 http_503;
    }
    
    location /health {
        access_log off;
        proxy_pass http://unjucks_backend/health;
        proxy_set_header Host $host;
    }
}
```

## Security Configuration

### 1. Environment Variables

```bash
# /etc/environment or systemd service file
NODE_ENV=production
LOG_LEVEL=info
PORT=3000

# Database
DATABASE_URL=postgresql://unjucks_user:${DB_PASSWORD}@db-cluster:5432/unjucks
DATABASE_SSL=true
DATABASE_POOL_SIZE=20

# Redis
REDIS_URL=redis://redis-cluster:6379
REDIS_PASSWORD=${REDIS_PASSWORD}

# Security
JWT_SECRET=${JWT_SECRET}
ENCRYPTION_KEY=${ENCRYPTION_KEY}
SESSION_SECRET=${SESSION_SECRET}

# External Services
LDAP_URL=ldaps://ldap.company.com:636
LDAP_BIND_DN=cn=service,ou=services,dc=company,dc=com
LDAP_BIND_PASSWORD=${LDAP_PASSWORD}

# Monitoring
PROMETHEUS_ENDPOINT=http://prometheus:9090
GRAFANA_API_KEY=${GRAFANA_API_KEY}

# Feature Flags
ENABLE_PERFORMANCE_MONITORING=true
ENABLE_SECURITY_SCANNING=true
ENABLE_COMPLIANCE_LOGGING=true
```

### 2. Secret Management

#### Using HashiCorp Vault

```bash
# Store secrets in Vault
vault kv put secret/unjucks/production \
  db_password="$(openssl rand -base64 32)" \
  jwt_secret="$(openssl rand -base64 64)" \
  encryption_key="$(openssl rand -base64 32)" \
  session_secret="$(openssl rand -base64 32)"

# Retrieve secrets in application
vault kv get -field=db_password secret/unjucks/production
```

#### Using Kubernetes Secrets

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: unjucks-secrets
  namespace: production
type: Opaque
data:
  db-password: <base64-encoded-password>
  jwt-secret: <base64-encoded-secret>
  encryption-key: <base64-encoded-key>
  session-secret: <base64-encoded-secret>
```

### 3. Access Control

#### RBAC Configuration

```yaml
# rbac.yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  namespace: production
  name: unjucks-deployer
rules:
- apiGroups: [""]
  resources: ["pods", "services", "configmaps", "secrets"]
  verbs: ["get", "list", "create", "update", "patch", "delete"]
- apiGroups: ["apps"]
  resources: ["deployments", "replicasets"]
  verbs: ["get", "list", "create", "update", "patch", "delete"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: unjucks-deployer-binding
  namespace: production
subjects:
- kind: ServiceAccount
  name: unjucks-deployer
  namespace: production
roleRef:
  kind: Role
  name: unjucks-deployer
  apiGroup: rbac.authorization.k8s.io
```

## Monitoring & Observability

### 1. Prometheus Configuration

```yaml
# prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "unjucks_alerts.yml"

scrape_configs:
  - job_name: 'unjucks'
    static_configs:
      - targets: ['unjucks-app-1:3000', 'unjucks-app-2:3000', 'unjucks-app-3:3000']
    metrics_path: '/metrics'
    scrape_interval: 15s

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093
```

### 2. Grafana Dashboard Import

```bash
# Import production dashboard
curl -X POST \
  http://grafana:3000/api/dashboards/db \
  -H "Authorization: Bearer ${GRAFANA_API_KEY}" \
  -H "Content-Type: application/json" \
  -d @config/monitoring-dashboard.json
```

### 3. Log Aggregation

#### Fluentd Configuration

```conf
<source>
  @type tail
  path /var/log/unjucks/*.log
  pos_file /var/log/fluentd/unjucks.log.pos
  tag unjucks.*
  format json
  time_key timestamp
  time_format %Y-%m-%dT%H:%M:%S.%LZ
</source>

<match unjucks.**>
  @type elasticsearch
  host elasticsearch
  port 9200
  index_name unjucks-production
  type_name _doc
  logstash_format true
  logstash_prefix unjucks-production
</match>
```

## Deployment Process

### 1. Pre-deployment Checklist

- [ ] All tests passing in CI/CD pipeline
- [ ] Security scans completed without critical issues
- [ ] Performance benchmarks meeting SLA requirements
- [ ] Database migrations tested and ready
- [ ] Rollback plan documented and tested
- [ ] Monitoring alerts configured
- [ ] On-call team notified
- [ ] Maintenance window scheduled (if required)

### 2. Blue-Green Deployment

#### Step 1: Deploy to Green Environment

```bash
# Deploy new version to green environment
kubectl set image deployment/unjucks-green \
  unjucks=unjucks:${NEW_VERSION} \
  --namespace=production

# Wait for rollout to complete
kubectl rollout status deployment/unjucks-green --namespace=production
```

#### Step 2: Health Check and Smoke Tests

```bash
# Run health checks
npm run test:production:smoke -- --environment=green

# Verify metrics
curl -f http://unjucks-green:3000/health || exit 1
curl -f http://unjucks-green:3000/metrics || exit 1
```

#### Step 3: Traffic Switch

```bash
# Update load balancer to point to green
kubectl patch service unjucks-lb \
  --patch '{"spec":{"selector":{"version":"green"}}}' \
  --namespace=production

# Monitor metrics for 5 minutes
sleep 300

# Verify no increase in error rates
prometheus_query="rate(unjucks_errors_total[5m])"
error_rate=$(curl -s "http://prometheus:9090/api/v1/query?query=${prometheus_query}" | jq -r '.data.result[0].value[1]')

if (( $(echo "$error_rate > 0.01" | bc -l) )); then
  echo "Error rate too high, rolling back"
  exit 1
fi
```

#### Step 4: Blue Environment Cleanup

```bash
# Scale down old version
kubectl scale deployment unjucks-blue --replicas=0 --namespace=production

# Keep for quick rollback if needed
echo "Blue environment scaled down but preserved for rollback"
```

### 3. Kubernetes Deployment

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: unjucks-app
  namespace: production
  labels:
    app: unjucks
    version: "1.0.0"
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 1
      maxSurge: 1
  selector:
    matchLabels:
      app: unjucks
  template:
    metadata:
      labels:
        app: unjucks
        version: "1.0.0"
    spec:
      serviceAccountName: unjucks-app
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        fsGroup: 2000
      containers:
      - name: unjucks
        image: your-registry/unjucks:1.0.0
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: unjucks-secrets
              key: database-url
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 3
        volumeMounts:
        - name: config
          mountPath: /app/config
          readOnly: true
        - name: logs
          mountPath: /var/log/unjucks
      volumes:
      - name: config
        configMap:
          name: unjucks-config
      - name: logs
        emptyDir: {}
---
apiVersion: v1
kind: Service
metadata:
  name: unjucks-service
  namespace: production
spec:
  selector:
    app: unjucks
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3000
  type: ClusterIP
```

## Post-Deployment Validation

### 1. Automated Validation

```bash
# Run comprehensive production validation
npm run test:production:full -- --environment=production

# Specific validation suites
npm run test:production:performance
npm run test:production:security
npm run test:production:compliance
```

### 2. Manual Verification

#### Health Checks

```bash
# Service health
curl -f https://unjucks.yourdomain.com/health

# Database connectivity
curl -f https://unjucks.yourdomain.com/db-health

# External integrations
curl -f https://unjucks.yourdomain.com/integration-health
```

#### Performance Validation

```bash
# Load test with realistic traffic
artillery run tests/load/production-load-test.yml

# Memory usage validation
kubectl exec -it deployment/unjucks-app -- node -e "console.log(process.memoryUsage())"

# Response time validation
for i in {1..10}; do
  curl -w "@curl-format.txt" -o /dev/null -s "https://unjucks.yourdomain.com/api/test"
done
```

### 3. Monitoring Validation

```bash
# Verify metrics are being collected
curl -s http://prometheus:9090/api/v1/query?query=up{job="unjucks"} | jq '.data.result[].value[1]'

# Check dashboard visibility
curl -f "http://grafana:3000/api/dashboards/uid/unjucks-prod"

# Verify alerting
curl -f "http://alertmanager:9093/api/v1/status"
```

## Operations & Maintenance

### 1. Backup Procedures

#### Database Backup

```bash
#!/bin/bash
# scripts/backup-database.sh

BACKUP_DIR="/backup/unjucks"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="unjucks_backup_${DATE}.sql"

# Create backup
pg_dump $DATABASE_URL > "${BACKUP_DIR}/${BACKUP_FILE}"

# Compress backup
gzip "${BACKUP_DIR}/${BACKUP_FILE}"

# Upload to S3
aws s3 cp "${BACKUP_DIR}/${BACKUP_FILE}.gz" "s3://unjucks-backups/daily/"

# Clean up local files older than 7 days
find $BACKUP_DIR -name "*.gz" -mtime +7 -delete

echo "Backup completed: ${BACKUP_FILE}.gz"
```

#### Application State Backup

```bash
#!/bin/bash
# scripts/backup-application.sh

# Backup configuration
kubectl get configmap unjucks-config -o yaml > backup/config-$(date +%Y%m%d).yaml

# Backup secrets (encrypted)
kubectl get secret unjucks-secrets -o yaml | \
  gpg --encrypt --recipient ops@company.com > backup/secrets-$(date +%Y%m%d).yaml.gpg

# Backup persistent volumes
kubectl get pv -o yaml > backup/volumes-$(date +%Y%m%d).yaml
```

### 2. Scaling Procedures

#### Horizontal Scaling

```bash
# Scale up during high traffic
kubectl scale deployment unjucks-app --replicas=6 --namespace=production

# Verify scaling
kubectl get pods -l app=unjucks --namespace=production

# Update load balancer if needed
kubectl patch service unjucks-lb --patch '{
  "metadata": {
    "annotations": {
      "service.beta.kubernetes.io/aws-load-balancer-backend-protocol": "http"
    }
  }
}' --namespace=production
```

#### Vertical Scaling

```bash
# Increase resource limits
kubectl patch deployment unjucks-app --patch '{
  "spec": {
    "template": {
      "spec": {
        "containers": [{
          "name": "unjucks",
          "resources": {
            "requests": {
              "memory": "1Gi",
              "cpu": "500m"
            },
            "limits": {
              "memory": "4Gi",
              "cpu": "2000m"
            }
          }
        }]
      }
    }
  }
}' --namespace=production
```

### 3. Update Procedures

#### Security Updates

```bash
# Update base image with security patches
docker build -t unjucks:security-update-$(date +%Y%m%d) .

# Test in staging
kubectl set image deployment/unjucks-app unjucks=unjucks:security-update-$(date +%Y%m%d) --namespace=staging

# Deploy to production after testing
kubectl set image deployment/unjucks-app unjucks=unjucks:security-update-$(date +%Y%m%d) --namespace=production
```

#### Configuration Updates

```bash
# Update configuration without restart
kubectl patch configmap unjucks-config --patch '{
  "data": {
    "feature_flags.json": "{\"new_feature\": true}"
  }
}' --namespace=production

# Rolling restart to pick up changes
kubectl rollout restart deployment/unjucks-app --namespace=production
```

## Troubleshooting

### 1. Common Issues

#### High Memory Usage

```bash
# Check memory usage by pod
kubectl top pods -l app=unjucks --namespace=production

# Get heap dump for analysis
kubectl exec -it deployment/unjucks-app -- kill -USR2 1

# Analyze memory patterns
kubectl exec -it deployment/unjucks-app -- node -e "
  const used = process.memoryUsage();
  console.log(JSON.stringify(used, null, 2));
"
```

#### Database Connection Issues

```bash
# Check database connectivity
kubectl run db-test --image=postgres:14 --rm -it --restart=Never -- \
  psql $DATABASE_URL -c "SELECT 1;"

# Check connection pool status
kubectl exec -it deployment/unjucks-app -- curl localhost:3000/debug/db-pool

# Review connection logs
kubectl logs -l app=unjucks --tail=100 | grep -i "database\|connection"
```

#### Performance Degradation

```bash
# Check system resources
kubectl describe node <node-name>

# Review application metrics
curl -s http://prometheus:9090/api/v1/query?query=unjucks_request_duration_seconds

# Analyze slow queries
kubectl exec -it postgres-pod -- psql -c "
  SELECT query, calls, total_time, mean_time 
  FROM pg_stat_statements 
  ORDER BY total_time DESC 
  LIMIT 10;
"
```

### 2. Incident Response

#### Severity 1 (Critical)

1. **Immediate Actions**
   - Notify on-call team
   - Create incident channel
   - Begin troubleshooting

2. **Rollback Decision**
   ```bash
   # Quick rollback if deployment-related
   kubectl rollout undo deployment/unjucks-app --namespace=production
   
   # Verify rollback success
   kubectl rollout status deployment/unjucks-app --namespace=production
   ```

3. **Communication**
   - Update status page
   - Notify stakeholders
   - Document timeline

#### Severity 2 (Major)

1. **Investigation**
   - Gather metrics and logs
   - Identify root cause
   - Plan remediation

2. **Mitigation**
   - Apply temporary fixes
   - Scale resources if needed
   - Monitor for improvement

### 3. Log Analysis

#### Centralized Logging Queries

```bash
# Error analysis in last hour
curl -X GET "elasticsearch:9200/unjucks-production-*/_search" \
  -H 'Content-Type: application/json' \
  -d '{
    "query": {
      "bool": {
        "must": [
          {"term": {"level": "error"}},
          {"range": {"@timestamp": {"gte": "now-1h"}}}
        ]
      }
    },
    "size": 100,
    "sort": [{"@timestamp": {"order": "desc"}}]
  }'

# Performance analysis
curl -X GET "elasticsearch:9200/unjucks-production-*/_search" \
  -H 'Content-Type: application/json' \
  -d '{
    "query": {
      "bool": {
        "must": [
          {"exists": {"field": "response_time"}},
          {"range": {"response_time": {"gte": 1000}}}
        ]
      }
    },
    "aggs": {
      "avg_response_time": {"avg": {"field": "response_time"}},
      "max_response_time": {"max": {"field": "response_time"}}
    }
  }'
```

## Compliance & Governance

### 1. Data Privacy (GDPR)

#### Data Processing Inventory

```bash
# Generate data processing report
npm run compliance:gdpr-validation -- --report-format=detailed

# Verify data minimization
curl -X POST https://unjucks.yourdomain.com/api/compliance/data-audit \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Test right to be forgotten
curl -X DELETE https://unjucks.yourdomain.com/api/user/$USER_ID/data \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

#### Consent Management

```bash
# Audit consent records
kubectl exec -it postgres-pod -- psql -c "
  SELECT 
    user_id, 
    consent_type, 
    granted_at, 
    expires_at,
    legal_basis
  FROM user_consents 
  WHERE expires_at < NOW() 
  ORDER BY expires_at;
"

# Update consent preferences
curl -X PATCH https://unjucks.yourdomain.com/api/user/consent \
  -H "Content-Type: application/json" \
  -d '{"marketing": false, "analytics": true}'
```

### 2. SOX Compliance

#### Change Management

```bash
# Document production change
cat > change-record.json << EOF
{
  "change_id": "CHG-$(date +%Y%m%d)-001",
  "description": "Update RDF filter performance optimization",
  "requestor": "$USER",
  "approver": "$APPROVER",
  "implementation_date": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "rollback_plan": "kubectl rollout undo deployment/unjucks-app",
  "business_justification": "Performance improvement for customer SLA",
  "risk_assessment": "Low - backward compatible changes only"
}
EOF

# Submit to change management system
curl -X POST https://change-mgmt.company.com/api/changes \
  -H "Authorization: Bearer $CHANGE_TOKEN" \
  -d @change-record.json
```

#### Access Control Audit

```bash
# Review access permissions
kubectl get rolebindings --all-namespaces | grep unjucks

# Audit user access
curl -X GET https://unjucks.yourdomain.com/api/admin/access-audit \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Generate access report
npm run compliance:sox-controls -- --report-type=access-review
```

### 3. Security Compliance

#### Vulnerability Scanning

```bash
# Container vulnerability scan
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  aquasec/trivy image your-registry/unjucks:latest

# Dependency vulnerability scan
npm audit --audit-level=moderate

# Infrastructure security scan
nmap -sS -O target-host
```

#### Penetration Testing

```bash
# API security testing
zap-baseline.py -t https://unjucks.yourdomain.com

# SQL injection testing
sqlmap -u "https://unjucks.yourdomain.com/api/query" --batch

# XSS testing
curl -X POST https://unjucks.yourdomain.com/api/template \
  -d 'template=<script>alert(1)</script>' \
  -H "Content-Type: application/x-www-form-urlencoded"
```

## Conclusion

This production deployment guide provides a comprehensive framework for deploying Unjucks RDF filters with enterprise-grade reliability, security, and compliance. Regular reviews and updates of this guide ensure it remains current with best practices and regulatory requirements.

For additional support or questions, contact the DevOps team or refer to the project documentation repository.

---

**Document Version**: 1.0  
**Last Updated**: $(date +%Y-%m-%d)  
**Next Review**: $(date -d "+3 months" +%Y-%m-%d)