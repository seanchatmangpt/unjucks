# KGEN Docker Deployment Guide

## Overview

This guide covers deploying KGEN using Docker and Docker Swarm for enterprise environments. KGEN provides multiple Docker configurations optimized for different use cases from development to production.

## Table of Contents

- [Docker Images](#docker-images)
- [Single Container Deployment](#single-container-deployment)
- [Docker Compose Development](#docker-compose-development)
- [Docker Swarm Production](#docker-swarm-production)
- [Blue-Green Deployment](#blue-green-deployment)
- [Security Hardening](#security-hardening)
- [Monitoring Integration](#monitoring-integration)
- [Backup and Recovery](#backup-and-recovery)
- [Troubleshooting](#troubleshooting)

## Docker Images

KGEN provides several specialized Docker images:

### Available Images

| Image | Purpose | Base | Size | Security Level |
|-------|---------|------|------|---------------|
| `kgen:latest` | Development | Node.js Alpine | ~200MB | Standard |
| `kgen:distroless-production` | Production | Distroless | ~150MB | High |
| `kgen:security-hardened` | High Security | Distroless + Security | ~160MB | Maximum |
| `kgen:performance-optimized` | Performance | Alpine + Optimizations | ~180MB | Standard |
| `kgen:cleanroom-testing` | Testing | Minimal Test Environment | ~120MB | Testing |

### Image Registry

```bash
# GitHub Container Registry (Recommended)
docker pull ghcr.io/your-org/kgen:latest
docker pull ghcr.io/your-org/kgen:distroless-production

# Docker Hub (Alternative)
docker pull your-org/kgen:latest
docker pull your-org/kgen:security-hardened
```

## Single Container Deployment

### Quick Start

```bash
# Pull the latest image
docker pull ghcr.io/your-org/kgen:latest

# Run with default settings
docker run -d \
  --name kgen \
  -p 3000:3000 \
  -e NODE_ENV=production \
  ghcr.io/your-org/kgen:latest

# Check container status
docker logs -f kgen
```

### Production Container

```bash
# Run production-optimized container
docker run -d \
  --name kgen-prod \
  --restart unless-stopped \
  -p 3000:3000 \
  -p 9090:9090 \
  -e NODE_ENV=production \
  -e LOG_LEVEL=info \
  -e DATABASE_HOST=postgresql.example.com \
  -e DATABASE_PORT=5432 \
  -e DATABASE_NAME=kgen \
  -e DATABASE_USERNAME=kgen_user \
  -e DATABASE_PASSWORD=secure_password \
  -e REDIS_HOST=redis.example.com \
  -e REDIS_PORT=6379 \
  -e REDIS_PASSWORD=redis_password \
  -v kgen-data:/app/.kgen \
  -v kgen-logs:/var/log/kgen \
  --memory=1g \
  --cpus=1.0 \
  --security-opt=no-new-privileges:true \
  --read-only \
  --tmpfs /tmp \
  ghcr.io/your-org/kgen:distroless-production
```

### Environment Variables

```bash
# Core Configuration
NODE_ENV=production
PORT=3000
LOG_LEVEL=info
LOG_FORMAT=json

# Database Configuration
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=kgen
DATABASE_USERNAME=kgen_user
DATABASE_PASSWORD=secure_password
DATABASE_SSL=true
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10

# Redis Configuration (Optional)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=redis_password
REDIS_DB=0

# Security Configuration
JWT_SECRET=your_jwt_secret_here
SESSION_SECRET=your_session_secret_here
ENCRYPTION_KEY=your_encryption_key_here

# External Integrations
GITHUB_TOKEN=ghp_xxxxxxxxxxxx
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/xxx

# Monitoring
METRICS_PORT=9090
PROMETHEUS_ENABLED=true
HEALTH_CHECK_INTERVAL=30000

# KGEN Specific
KGEN_CACHE_ENABLED=true
KGEN_ATTESTATION_ENABLED=true
KGEN_RDF_ENABLED=true
KGEN_STRICT_MODE=true
```

## Docker Compose Development

### Basic Development Setup

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  kgen:
    image: ghcr.io/your-org/kgen:latest
    ports:
      - "3000:3000"
      - "9090:9090"
    environment:
      - NODE_ENV=development
      - LOG_LEVEL=debug
      - DATABASE_HOST=postgres
      - DATABASE_NAME=kgen
      - DATABASE_USERNAME=kgen_user
      - DATABASE_PASSWORD=dev_password
      - REDIS_HOST=redis
    volumes:
      - ./src:/app/src:ro
      - kgen-data:/app/.kgen
    depends_on:
      - postgres
      - redis
    restart: unless-stopped

  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=kgen
      - POSTGRES_USER=kgen_user
      - POSTGRES_PASSWORD=dev_password
    volumes:
      - postgres-data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass dev_redis_password
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    restart: unless-stopped

  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9091:9090"
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus-data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
    restart: unless-stopped

volumes:
  kgen-data:
  postgres-data:
  redis-data:
  prometheus-data:
```

### Enhanced Development with Hot Reload

```yaml
version: '3.8'

services:
  kgen-dev:
    build:
      context: .
      dockerfile: docker/Dockerfile.development
    ports:
      - "3000:3000"
      - "9090:9090"
      - "9229:9229"  # Debug port
    environment:
      - NODE_ENV=development
      - LOG_LEVEL=debug
      - DATABASE_HOST=postgres
      - DATABASE_NAME=kgen
      - DATABASE_USERNAME=kgen_user
      - DATABASE_PASSWORD=dev_password
      - REDIS_HOST=redis
    volumes:
      - ./src:/app/src
      - ./tests:/app/tests
      - ./templates:/app/_templates
      - kgen-data:/app/.kgen
      - /app/node_modules  # Anonymous volume for node_modules
    depends_on:
      - postgres
      - redis
    command: npm run dev:debug
    restart: unless-stopped
```

### Testing Environment

```yaml
version: '3.8'

services:
  kgen-test:
    image: ghcr.io/your-org/kgen:cleanroom-testing
    environment:
      - NODE_ENV=test
      - DATABASE_HOST=postgres-test
      - DATABASE_NAME=kgen_test
      - DATABASE_USERNAME=kgen_test_user
      - DATABASE_PASSWORD=test_password
      - REDIS_HOST=redis-test
    volumes:
      - ./tests:/app/tests:ro
    depends_on:
      - postgres-test
      - redis-test
    command: npm test
    profiles: ["testing"]

  postgres-test:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=kgen_test
      - POSTGRES_USER=kgen_test_user
      - POSTGRES_PASSWORD=test_password
    tmpfs:
      - /var/lib/postgresql/data
    profiles: ["testing"]

  redis-test:
    image: redis:7-alpine
    command: redis-server --save ""
    profiles: ["testing"]
```

### Running Development Environment

```bash
# Start development environment
docker-compose up -d

# View logs
docker-compose logs -f kgen

# Run tests
docker-compose --profile testing up --build kgen-test

# Stop environment
docker-compose down

# Clean up volumes
docker-compose down -v
```

## Docker Swarm Production

### Swarm Initialization

```bash
# Initialize swarm on manager node
docker swarm init --advertise-addr $(hostname -I | awk '{print $1}')

# Add worker nodes (run on each worker)
docker swarm join --token SWMTKN-1-xxx... manager-ip:2377

# Verify swarm status
docker node ls
```

### Production Stack Deployment

The production Docker Swarm configuration provides:

- **High Availability**: Multi-replica services with health checks
- **Blue-Green Deployment**: Zero-downtime deployments
- **Load Balancing**: Built-in load balancing with session affinity
- **Security**: Secrets management and network isolation
- **Monitoring**: Integrated Prometheus and Grafana
- **Backup**: Automated backup services

#### Deploy Production Stack

```bash
# Navigate to Docker Swarm configuration
cd infrastructure/docker-swarm

# Set environment variables
export KGEN_IMAGE=ghcr.io/your-org/kgen
export KGEN_TAG=v1.0.0
export ENVIRONMENT=production

# Create required directories
sudo mkdir -p /opt/kgen/{data,postgres,redis,prometheus,grafana,backups}
sudo chown -R $(id -u):$(id -g) /opt/kgen

# Deploy using script (recommended)
./scripts/deploy.sh deploy

# Or deploy manually
docker stack deploy -c docker-compose.production.yml kgen
```

#### Service Configuration

The production stack includes:

```yaml
services:
  # Load Balancer (NGINX)
  load-balancer:
    replicas: 2
    placement: manager nodes
    
  # KGEN Application (Blue-Green)
  kgen-blue:
    replicas: 3
    placement: worker nodes
    
  kgen-green:
    replicas: 0  # Initially inactive
    placement: worker nodes
    
  # Database
  postgres:
    replicas: 1
    placement: dedicated database node
    
  # Cache
  redis:
    replicas: 1
    placement: worker nodes
    
  # Monitoring
  prometheus:
    replicas: 1
    placement: manager nodes
    
  grafana:
    replicas: 1
    placement: manager nodes
```

## Blue-Green Deployment

### Automated Blue-Green with Script

```bash
# Deploy new version to inactive slot
./scripts/deploy.sh blue-green

# Check deployment status
./scripts/deploy.sh status

# Rollback if needed
./scripts/deploy.sh rollback
```

### Manual Blue-Green Process

1. **Deploy to Inactive Slot**
```bash
# Update green slot with new image
docker service update \
  --image ghcr.io/your-org/kgen:v1.1.0 \
  kgen_kgen-green

# Scale up green slot
docker service scale kgen_kgen-green=3
```

2. **Health Check Green Slot**
```bash
# Wait for green slot to be healthy
while ! curl -f http://kgen-green:3000/health; do
  echo "Waiting for green slot..."
  sleep 10
done
```

3. **Switch Traffic**
```bash
# Update load balancer to point to green
docker service update \
  --label-add "kgen.active=true" \
  kgen_kgen-green

docker service update \
  --label-rm "kgen.active" \
  kgen_kgen-blue
```

4. **Scale Down Blue Slot**
```bash
# Scale down blue slot after successful switch
docker service scale kgen_kgen-blue=0
```

### Traffic Switching Strategies

#### Immediate Switch
```bash
# Instant traffic cutover
./scripts/deploy.sh blue-green --strategy immediate
```

#### Gradual Switch
```bash
# Progressive traffic migration (10%, 50%, 100%)
./scripts/deploy.sh blue-green --strategy gradual
```

#### Canary Deployment
```bash
# 10% traffic for 5 minutes, then full switch
./scripts/deploy.sh blue-green --strategy canary --canary-duration 300
```

## Security Hardening

### Container Security

#### Security-Hardened Image
```dockerfile
# Multi-stage build for security
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

FROM gcr.io/distroless/nodejs18-debian11
COPY --from=builder /app/node_modules /app/node_modules
COPY --chown=65534:65534 . /app
WORKDIR /app
USER 65534
EXPOSE 3000
CMD ["server.js"]
```

#### Runtime Security
```bash
# Run with security options
docker run -d \
  --security-opt=no-new-privileges:true \
  --cap-drop=ALL \
  --read-only \
  --tmpfs /tmp:noexec,nosuid,size=100m \
  --user 65534:65534 \
  --memory=1g \
  --cpus=1.0 \
  ghcr.io/your-org/kgen:security-hardened
```

### Network Security

#### Docker Swarm Networks
```yaml
networks:
  frontend:
    driver: overlay
    attachable: true
  backend:
    driver: overlay
    internal: true  # No external access
  database:
    driver: overlay
    internal: true
    encrypted: true  # Encrypted overlay network
```

#### Firewall Configuration
```bash
# Allow only required ports
ufw allow 22    # SSH
ufw allow 80    # HTTP
ufw allow 443   # HTTPS
ufw allow 2377  # Docker Swarm management
ufw allow 7946  # Docker Swarm communication
ufw allow 4789  # Docker Swarm overlay network

# Enable firewall
ufw enable
```

### Secrets Management

#### Create Secrets
```bash
# Database password
echo "secure_database_password" | docker secret create database_password -

# Redis password
echo "secure_redis_password" | docker secret create redis_password -

# Application secrets
echo "jwt_secret_key_here" | docker secret create jwt_secret -
echo "session_secret_key_here" | docker secret create session_secret -

# SSL certificates
docker secret create ssl_cert /path/to/cert.pem
docker secret create ssl_key /path/to/private.key
```

#### Use Secrets in Services
```yaml
services:
  kgen:
    secrets:
      - source: database_password
        target: /run/secrets/db_password
        mode: 0400
      - source: jwt_secret
        target: /run/secrets/jwt_secret
        mode: 0400
    environment:
      - DATABASE_PASSWORD_FILE=/run/secrets/db_password
      - JWT_SECRET_FILE=/run/secrets/jwt_secret
```

## Monitoring Integration

### Prometheus Configuration

```yaml
# monitoring/prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'kgen-application'
    docker_sd_configs:
      - host: unix:///var/run/docker.sock
        port: 9090
    relabel_configs:
      - source_labels: [__meta_docker_container_label_com_docker_swarm_service_name]
        regex: kgen_kgen-(blue|green)
        target_label: __tmp_service_name
      - source_labels: [__tmp_service_name]
        regex: (.+)
        target_label: service
        replacement: kgen
      - source_labels: [__meta_docker_container_label_kgen_slot]
        target_label: slot

  - job_name: 'postgres-exporter'
    static_configs:
      - targets: ['postgres-exporter:9187']

  - job_name: 'redis-exporter'
    static_configs:
      - targets: ['redis-exporter:9121']

  - job_name: 'node-exporter'
    docker_sd_configs:
      - host: unix:///var/run/docker.sock
        port: 9100
    relabel_configs:
      - source_labels: [__meta_docker_container_label_com_docker_swarm_service_name]
        regex: kgen_node-exporter
        action: keep
```

### Grafana Dashboards

```yaml
# monitoring/grafana-datasources.yml
apiVersion: 1
datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
```

### Log Management

#### Centralized Logging
```yaml
services:
  kgen:
    logging:
      driver: json-file
      options:
        max-size: "100m"
        max-file: "5"
        labels: "service,slot"
    labels:
      - "service=kgen"
      - "slot=blue"

  logstash:
    image: elastic/logstash:8.8.0
    ports:
      - "5000:5000"
    volumes:
      - ./monitoring/logstash.conf:/usr/share/logstash/pipeline/logstash.conf
    depends_on:
      - elasticsearch
```

#### Log Aggregation
```ruby
# monitoring/logstash.conf
input {
  beats {
    port => 5044
  }
}

filter {
  if [docker][container][labels][service] == "kgen" {
    json {
      source => "message"
    }
    
    date {
      match => [ "timestamp", "ISO8601" ]
    }
    
    mutate {
      add_field => { 
        "service" => "%{[docker][container][labels][service]}"
        "slot" => "%{[docker][container][labels][slot]}"
      }
    }
  }
}

output {
  elasticsearch {
    hosts => ["elasticsearch:9200"]
    index => "kgen-logs-%{+YYYY.MM.dd}"
  }
}
```

## Backup and Recovery

### Automated Backup Service

```yaml
services:
  backup:
    image: alpine:3.18
    volumes:
      - postgres-data:/backup/postgres:ro
      - redis-data:/backup/redis:ro
      - kgen-data:/backup/kgen:ro
      - ./scripts/backup.sh:/backup.sh:ro
    environment:
      - BACKUP_BUCKET=kgen-backups
      - AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID}
      - AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY}
    command: >
      sh -c "
        apk add --no-cache postgresql-client aws-cli &&
        echo '0 2 * * * /backup.sh' | crontab - &&
        crond -f
      "
    deploy:
      replicas: 1
      placement:
        constraints: [node.labels.backup == true]
```

### Backup Script

```bash
#!/bin/bash
# scripts/backup.sh

set -euo pipefail

BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/tmp/backup_${BACKUP_DATE}"
S3_BUCKET="${BACKUP_BUCKET:-kgen-backups}"

mkdir -p "$BACKUP_DIR"

# Database backup
echo "Backing up PostgreSQL..."
pg_dump -h postgres -U kgen_user -d kgen | gzip > "${BACKUP_DIR}/postgres_${BACKUP_DATE}.sql.gz"

# Redis backup
echo "Backing up Redis..."
redis-cli -h redis --rdb "${BACKUP_DIR}/redis_${BACKUP_DATE}.rdb"

# KGEN data backup
echo "Backing up KGEN data..."
tar -czf "${BACKUP_DIR}/kgen_data_${BACKUP_DATE}.tar.gz" -C /backup/kgen .

# Upload to S3
echo "Uploading to S3..."
aws s3 sync "$BACKUP_DIR" "s3://${S3_BUCKET}/backups/${BACKUP_DATE}/"

# Cleanup
rm -rf "$BACKUP_DIR"

echo "Backup completed: $BACKUP_DATE"
```

### Recovery Procedures

#### Database Recovery
```bash
# Stop KGEN service
docker service scale kgen_kgen-blue=0

# Restore database
gunzip -c postgres_backup.sql.gz | docker exec -i kgen_postgres_1 psql -U kgen_user -d kgen

# Restart KGEN service
docker service scale kgen_kgen-blue=3
```

#### Full Stack Recovery
```bash
# Download backup from S3
aws s3 sync s3://kgen-backups/backups/20231201_020000/ ./restore/

# Stop all services
docker stack rm kgen

# Restore data volumes
docker run --rm -v kgen_postgres-data:/restore -v ./restore:/backup alpine \
  sh -c "cd /restore && tar -xzf /backup/postgres_data.tar.gz"

# Redeploy stack
docker stack deploy -c docker-compose.production.yml kgen
```

## Troubleshooting

### Common Issues

#### 1. Container Won't Start
```bash
# Check container logs
docker logs kgen-container-id

# Check service logs (Swarm)
docker service logs kgen_kgen-blue

# Common causes:
# - Database connection failure
# - Missing environment variables
# - Resource constraints
# - Image pull errors
```

#### 2. High Memory Usage
```bash
# Check container stats
docker stats

# Monitor specific container
docker exec kgen-container-id ps aux --sort=-%mem

# Adjust memory limits
docker service update --limit-memory=2g kgen_kgen-blue
```

#### 3. Network Connectivity Issues
```bash
# Test network connectivity
docker exec kgen-container-id nc -zv postgres 5432
docker exec kgen-container-id nc -zv redis 6379

# Check Docker networks
docker network ls
docker network inspect kgen_backend

# Check service discovery
docker exec kgen-container-id nslookup postgres
```

#### 4. Storage Issues
```bash
# Check volume usage
docker system df

# Clean up unused resources
docker system prune -a

# Check volume mounts
docker inspect kgen-container-id | grep -A 10 Mounts
```

### Performance Optimization

#### Container Resources
```yaml
services:
  kgen:
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 1G
        reservations:
          cpus: '0.25'
          memory: 512M
```

#### Docker Daemon Optimization
```json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "100m",
    "max-file": "5"
  },
  "storage-driver": "overlay2",
  "storage-opts": [
    "overlay2.size=20G"
  ],
  "default-ulimits": {
    "nofile": {
      "Hard": 64000,
      "Name": "nofile",
      "Soft": 64000
    }
  }
}
```

### Debugging Commands

```bash
# Docker Swarm debugging
docker service ls
docker service ps kgen_kgen-blue --no-trunc
docker service inspect kgen_kgen-blue

# Container debugging
docker exec -it kgen-container-id sh
docker run --rm -it --entrypoint sh ghcr.io/your-org/kgen:latest

# Network debugging
docker run --rm --net kgen_backend nicolaka/netshoot

# Volume debugging
docker run --rm -v kgen_postgres-data:/data alpine ls -la /data

# Performance monitoring
docker stats --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}"
```

### Health Check Debugging

```bash
# Test health endpoints manually
curl -f http://localhost:3000/health
curl -f http://localhost:3000/ready
curl -f http://localhost:9090/metrics

# Check health check configuration
docker inspect kgen-container-id | grep -A 20 Health

# Monitor health check logs
docker events --filter container=kgen-container-id
```

---

## Next Steps

1. Review the [Kubernetes Deployment Guide](./KUBERNETES_DEPLOYMENT.md)
2. Set up [Monitoring and Alerting](./MONITORING_GUIDE.md)
3. Configure [CI/CD Pipelines](./CICD_GUIDE.md)
4. Implement [Security Hardening](./SECURITY_HARDENING.md)