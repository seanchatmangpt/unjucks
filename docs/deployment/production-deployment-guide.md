# Production Deployment Guide - Unjucks Enterprise

**Target Audience**: Fortune 5 Operations Teams  
**Security Classification**: Internal Use  
**Last Updated**: September 2025  
**Version**: 2.0.8

## Executive Summary

This guide provides comprehensive deployment procedures for Unjucks enterprise code generation platform in Fortune 5 production environments. The system supports multi-tenant semantic web applications with enterprise-grade security, compliance, and scalability requirements.

## System Overview

### Core Components
- **Application**: Node.js 18+ application with semantic web capabilities
- **Database**: PostgreSQL 14+ with Redis 7+ caching layer
- **Authentication**: Multi-protocol (OAuth, SAML, LDAP) with JWT tokens
- **Storage**: Configurable (Local, AWS S3, Google Cloud Storage)
- **Monitoring**: Prometheus metrics with Grafana dashboards
- **Message Queue**: Redis/RabbitMQ/Kafka for event processing

### Architecture Patterns
- Microservices-ready with container orchestration
- Multi-tenant with role-based access control (RBAC)
- Event-driven architecture with audit logging
- Zero-trust security model with encryption at rest/transit

## Pre-Deployment Requirements

### Infrastructure Specifications

#### Minimum Production Requirements
```yaml
Compute Resources:
  CPU: 4 vCPUs (8 recommended)
  Memory: 8 GB RAM (16 GB recommended)  
  Storage: 100 GB SSD (500 GB recommended)
  Network: 1 Gbps bandwidth

Database Requirements:
  PostgreSQL: v14+ with 16 GB RAM, 500 GB storage
  Redis: v7+ with 4 GB RAM, persistent storage enabled
  Backup: Automated daily backups with 30-day retention

Load Balancer:
  SSL/TLS termination required
  Session affinity enabled
  Health check endpoints configured
```

#### High Availability Setup
```yaml
Application Tier:
  Instances: 3+ in different availability zones
  Load Balancer: Layer 7 with SSL offloading
  Auto Scaling: CPU-based (60-80% threshold)

Database Tier:  
  Primary/Replica setup with automatic failover
  Connection pooling with 20-50 max connections per app instance
  Read replicas for analytics workloads

Caching Tier:
  Redis Cluster mode with 3+ nodes
  Persistent storage for session data
  Memory limit: 75% of available RAM
```

### Network Requirements

#### Security Groups / Firewall Rules
```yaml
Application Tier:
  Inbound: 
    - Port 443 (HTTPS) from Load Balancer
    - Port 3000 (App) from Load Balancer only
  Outbound:
    - Port 5432 to Database Tier
    - Port 6379 to Redis Tier
    - Port 443 for external API calls

Database Tier:
  Inbound:
    - Port 5432 from Application Tier only
  Outbound: None required

Load Balancer:
  Inbound:
    - Port 443 from 0.0.0.0/0 (public access)
    - Port 80 redirect to 443
```

#### DNS Configuration
- Primary domain with SSL certificate
- Health check endpoint: `https://domain.com/health`
- Metrics endpoint: `https://domain.com/metrics` (internal only)

## Environment Configuration

### Critical Environment Variables

#### Server Configuration
```bash
# Core Server Settings
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# Process Management
NODE_OPTIONS="--max-old-space-size=2048 --max-http-header-size=16384"
UV_THREADPOOL_SIZE=16
```

#### Database Configuration
```bash
# PostgreSQL Primary
DB_HOST=prod-db-cluster.internal
DB_PORT=5432
DB_NAME=unjucks_prod
DB_USER=unjucks_app
DB_PASSWORD=${SECRET_DB_PASSWORD}  # From secrets manager
DB_SSL_ENABLED=true
DB_POOL_MAX=20
DB_POOL_MIN=5
DB_IDLE_TIMEOUT=30000
DB_CONNECTION_TIMEOUT=10000
DB_STATEMENT_TIMEOUT=30000
DB_QUERY_TIMEOUT=30000
DB_HEALTH_CHECK_INTERVAL=30000

# Redis Configuration
REDIS_URL=redis://prod-redis-cluster.internal:6379
REDIS_MAX_RETRIES=3
REDIS_RETRY_DELAY=100
```

#### Security Configuration
```bash
# JWT Configuration
JWT_SECRET=${SECRET_JWT_KEY}  # 256-bit key from secrets manager
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d

# Encryption
BCRYPT_ROUNDS=12
SESSION_SECRET=${SECRET_SESSION_KEY}  # 256-bit key
CSRF_SECRET=${SECRET_CSRF_KEY}  # 256-bit key  
ENCRYPTION_KEY=${SECRET_ENCRYPTION_KEY}  # 256-bit key

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_MAX_REQUESTS=1000
RATE_LIMIT_SKIP_SUCCESS=false

# CORS Configuration
CORS_ORIGIN=${ALLOWED_ORIGINS}  # Comma-separated list
CORS_CREDENTIALS=true
```

#### Authentication Providers
```bash
# SAML Configuration (Enterprise SSO)
SAML_ENTRY_POINT=${SAML_IDP_URL}
SAML_ISSUER=${SAML_ENTITY_ID}  
SAML_CERT=${SAML_X509_CERT}
SAML_PRIVATE_KEY=${SAML_PRIVATE_KEY}

# OAuth Providers
OAUTH_GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
OAUTH_GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}
OAUTH_GITHUB_CLIENT_ID=${GITHUB_CLIENT_ID}  
OAUTH_GITHUB_CLIENT_SECRET=${GITHUB_CLIENT_SECRET}
OAUTH_MICROSOFT_CLIENT_ID=${MICROSOFT_CLIENT_ID}
OAUTH_MICROSOFT_CLIENT_SECRET=${MICROSOFT_CLIENT_SECRET}

# LDAP/Active Directory
LDAP_URL=ldaps://ad.company.com:636
LDAP_BIND_DN=${LDAP_SERVICE_ACCOUNT_DN}
LDAP_BIND_CREDENTIALS=${LDAP_SERVICE_ACCOUNT_PASSWORD}
LDAP_SEARCH_BASE=ou=users,dc=company,dc=com
LDAP_SEARCH_FILTER=(sAMAccountName={{username}})
```

#### Monitoring and Logging
```bash
# Metrics and Health Checks
METRICS_ENABLED=true
HEALTH_CHECK_PATH=/health
PROMETHEUS_ENDPOINT=/metrics

# Audit Logging
AUDIT_LOG_LEVEL=info
SIEM_WEBHOOK_URL=${SIEM_WEBHOOK_ENDPOINT}
SIEM_API_KEY=${SIEM_API_KEY}

# Log Levels
LOG_LEVEL=info
DEBUG_ENABLED=false
```

#### File Storage
```bash
# Storage Configuration
UPLOAD_MAX_SIZE=10485760  # 10MB
STORAGE_TYPE=s3  # local, s3, gcs

# AWS S3 Configuration
S3_BUCKET=${S3_PROD_BUCKET}
S3_REGION=${AWS_REGION}
AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY}
AWS_SECRET_ACCESS_KEY=${AWS_SECRET_KEY}
```

## Deployment Procedures

### Phase 1: Infrastructure Provisioning

#### 1.1 Database Setup
```sql
-- Create production database and user
CREATE DATABASE unjucks_prod;
CREATE USER unjucks_app WITH ENCRYPTED PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE unjucks_prod TO unjucks_app;

-- Enable required extensions
\c unjucks_prod;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- Create audit schema
CREATE SCHEMA audit;
GRANT USAGE ON SCHEMA audit TO unjucks_app;
```

#### 1.2 Redis Configuration
```bash
# Redis production configuration
# /etc/redis/redis.conf

# Security
requirepass ${REDIS_PASSWORD}
rename-command FLUSHDB ""
rename-command FLUSHALL ""
rename-command DEBUG ""

# Persistence
save 900 1
save 300 10  
save 60 10000
rdbcompression yes
rdbchecksum yes

# Memory management
maxmemory 3gb
maxmemory-policy allkeys-lru

# Networking
bind 127.0.0.1 10.0.0.0/8
port 6379
timeout 300
tcp-keepalive 60
```

### Phase 2: Application Deployment

#### 2.1 Container Deployment
```yaml
# docker-compose.production.yml
version: '3.8'

services:
  app:
    image: unjucks:${VERSION}
    environment:
      NODE_ENV: production
      PORT: 3000
    ports:
      - "3000:3000"
    depends_on:
      - postgres
      - redis
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    deploy:
      replicas: 3
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3
      resources:
        limits:
          memory: 2G
          cpus: '1.0'
        reservations:
          memory: 1G
          cpus: '0.5'
```

#### 2.2 Kubernetes Deployment
```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: unjucks-app
  namespace: production
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 1
      maxSurge: 1
  selector:
    matchLabels:
      app: unjucks-app
  template:
    metadata:
      labels:
        app: unjucks-app
    spec:
      containers:
      - name: unjucks
        image: unjucks:${VERSION}
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: production
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: unjucks-secrets
              key: db-password
        resources:
          requests:
            memory: "1Gi"
            cpu: "500m"
          limits:
            memory: "2Gi" 
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
```

### Phase 3: Security Configuration

#### 3.1 SSL/TLS Configuration
```nginx
# nginx.conf - Load Balancer Configuration
upstream unjucks_backend {
    least_conn;
    server app1.internal:3000 max_fails=3 fail_timeout=30s;
    server app2.internal:3000 max_fails=3 fail_timeout=30s;
    server app3.internal:3000 max_fails=3 fail_timeout=30s;
}

server {
    listen 443 ssl http2;
    server_name unjucks.company.com;
    
    ssl_certificate /etc/ssl/certs/unjucks.crt;
    ssl_certificate_key /etc/ssl/private/unjucks.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    location / {
        proxy_pass http://unjucks_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        proxy_connect_timeout 5s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    location /health {
        proxy_pass http://unjucks_backend/health;
        access_log off;
    }
}
```

### Phase 4: Monitoring Setup

#### 4.1 Prometheus Configuration
```yaml
# prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'unjucks-app'
    static_configs:
      - targets: ['app1.internal:3000', 'app2.internal:3000', 'app3.internal:3000']
    metrics_path: /metrics
    scrape_interval: 30s
    scrape_timeout: 10s
```

#### 4.2 Grafana Dashboards
Key metrics to monitor:
- Application response time (p50, p95, p99)
- Error rate and HTTP status codes
- Database connection pool utilization
- Redis hit/miss ratios
- Memory and CPU usage
- Active user sessions
- API request volume by endpoint

## Post-Deployment Validation

### 1. Health Checks
```bash
# Application health
curl -f https://unjucks.company.com/health

# Database connectivity
curl -f https://unjucks.company.com/health/db

# Redis connectivity  
curl -f https://unjucks.company.com/health/redis

# Authentication flow
curl -X POST https://unjucks.company.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@company.com","password":"test"}'
```

### 2. Load Testing
```bash
# Basic load test
ab -n 1000 -c 10 https://unjucks.company.com/

# Authentication load test
# Use custom script with JWT tokens
```

### 3. Security Validation
```bash
# SSL/TLS configuration
nmap --script ssl-enum-ciphers -p 443 unjucks.company.com

# OWASP ZAP baseline scan
docker run -v $(pwd):/zap/wrk/:rw \
  owasp/zap2docker-stable \
  zap-baseline.py -t https://unjucks.company.com
```

## Rollback Procedures

### Application Rollback
```bash
# Docker deployment
docker service update --image unjucks:${PREVIOUS_VERSION} unjucks_app

# Kubernetes deployment  
kubectl rollout undo deployment/unjucks-app -n production
kubectl rollout status deployment/unjucks-app -n production
```

### Database Rollback
- Restore from automated backup within 30-day retention window
- Apply differential backups if needed
- Validate data integrity before switching traffic

## Success Criteria

✅ **Application Health**: All health endpoints return 200 OK  
✅ **Performance**: Response time < 500ms for 95th percentile  
✅ **Security**: SSL Labs grade A or higher  
✅ **Availability**: 99.9% uptime SLA met  
✅ **Authentication**: All SSO providers functional  
✅ **Monitoring**: Metrics flowing to dashboards  
✅ **Backup**: Automated backups verified and tested  

## Emergency Contacts

- **On-Call Engineer**: +1-555-0123
- **Database DBA**: +1-555-0124  
- **Security Team**: +1-555-0125
- **Platform Engineering**: +1-555-0126

---

**Next Steps**: See [incident-response.md](../runbooks/incident-response.md) for operational procedures and troubleshooting guides.