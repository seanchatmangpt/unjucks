# KGEN Enterprise Integration Suite - Deployment Guide

## 🚀 Overview

The KGEN Enterprise Integration Suite provides comprehensive APIs, webhooks, connectors, and enterprise features for knowledge graph management and code generation at scale.

## 📋 Table of Contents

- [Architecture Overview](#architecture-overview)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Deployment Options](#deployment-options)
- [Security Setup](#security-setup)
- [Monitoring & Observability](#monitoring--observability)
- [High Availability](#high-availability)
- [Troubleshooting](#troubleshooting)

## 🏗️ Architecture Overview

The enterprise suite consists of the following components:

```
┌─────────────────────────────────────────────────────────────┐
│                    Load Balancer                            │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                  API Gateway                                │
│  • Rate Limiting  • Authentication  • Load Balancing       │
│  • API Versioning • Request/Response Transformation        │
└─────────────────────┬───────────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        │             │             │
        ▼             ▼             ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│  REST API   │ │  GraphQL    │ │  Webhooks   │
│   Server    │ │    API      │ │   Manager   │
└─────────────┘ └─────────────┘ └─────────────┘
        │             │             │
        └─────────────┼─────────────┘
                      │
        ┌─────────────┼─────────────┐
        │             │             │
        ▼             ▼             ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│   Message   │ │     ETL     │ │ Enterprise  │
│    Queue    │ │  Pipeline   │ │ Connectors  │
└─────────────┘ └─────────────┘ └─────────────┘
        │             │             │
        └─────────────┼─────────────┘
                      │
                      ▼
        ┌─────────────────────────────┐
        │        Data Layer           │
        │  • Redis    • PostgreSQL    │
        │  • MongoDB  • Knowledge DB  │
        └─────────────────────────────┘
```

## 🔧 Prerequisites

### System Requirements

**Minimum Requirements:**
- CPU: 4 cores
- RAM: 8GB
- Storage: 50GB SSD
- Network: 1Gbps

**Recommended for Production:**
- CPU: 16+ cores
- RAM: 32GB+
- Storage: 500GB+ SSD (NVMe preferred)
- Network: 10Gbps

### Software Dependencies

**Required:**
- Node.js 18+ (LTS recommended)
- Redis 6.2+
- PostgreSQL 13+ or MongoDB 5.0+
- Docker & Docker Compose (for containerized deployment)

**Optional (for specific features):**
- RabbitMQ 3.8+ (for advanced message queuing)
- Elasticsearch 7.10+ (for advanced search)
- Prometheus + Grafana (for monitoring)

### External Services

**Required for full functionality:**
- SSL certificates (Let's Encrypt or commercial)
- SMTP server (for notifications)

**Optional:**
- S3-compatible storage (for file uploads)
- CDN (for static assets)
- External identity provider (LDAP/SAML/OAuth)

## 🚀 Quick Start

### 1. Clone and Install

```bash
git clone https://github.com/your-org/kgen-enterprise.git
cd kgen-enterprise

# Install dependencies
npm install

# Install enterprise dependencies
cd src/enterprise
npm install
```

### 2. Environment Configuration

Create `.env` file:

```bash
# Core Configuration
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# Database Configuration
DATABASE_URL=postgresql://user:pass@localhost:5432/kgen_enterprise
REDIS_URL=redis://localhost:6379

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=24h
REFRESH_TOKEN_EXPIRES_IN=7d

# API Configuration
API_RATE_LIMIT=1000
API_RATE_WINDOW=60000

# Gateway Configuration
GATEWAY_PORT=3001
GATEWAY_RATE_LIMIT=5000

# Webhook Configuration
WEBHOOK_SECRET=your-webhook-secret
WEBHOOK_TIMEOUT=30000

# Message Queue Configuration
QUEUE_PROVIDER=redis  # or rabbitmq
RABBITMQ_URL=amqp://localhost:5672

# ETL Configuration
ETL_TEMP_DIR=/tmp/kgen-etl
ETL_MAX_CONCURRENT=5

# External Integrations
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
SALESFORCE_CLIENT_ID=your-salesforce-client-id
SALESFORCE_CLIENT_SECRET=your-salesforce-client-secret

# Monitoring
ENABLE_METRICS=true
METRICS_PORT=9090
LOG_LEVEL=info

# Security
CORS_ORIGINS=https://your-domain.com,https://admin.your-domain.com
HELMET_ENABLED=true
RATE_LIMIT_ENABLED=true
```

### 3. Database Setup

```bash
# PostgreSQL setup
createdb kgen_enterprise

# Run migrations
npm run db:migrate

# Seed initial data
npm run db:seed
```

### 4. Start Services

```bash
# Development
npm run dev

# Production
npm run build
npm start

# With Docker Compose
docker-compose up -d
```

## ⚙️ Configuration

### API Server Configuration

```javascript
// src/enterprise/config/server.js
export const config = {
  port: process.env.PORT || 3000,
  host: process.env.HOST || '0.0.0.0',
  
  // Database
  database: {
    url: process.env.DATABASE_URL,
    pool: {
      min: 2,
      max: 10,
      acquireTimeoutMillis: 60000,
      createTimeoutMillis: 30000,
      destroyTimeoutMillis: 5000,
      idleTimeoutMillis: 900000,
      createRetryIntervalMillis: 200
    }
  },
  
  // Redis
  redis: {
    url: process.env.REDIS_URL,
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 3
  },
  
  // Authentication
  auth: {
    jwt: {
      secret: process.env.JWT_SECRET,
      expiresIn: process.env.JWT_EXPIRES_IN || '24h'
    },
    providers: {
      local: { enabled: true },
      oauth2: { 
        enabled: process.env.OAUTH2_ENABLED === 'true',
        clientId: process.env.OAUTH2_CLIENT_ID,
        clientSecret: process.env.OAUTH2_CLIENT_SECRET
      },
      saml: {
        enabled: process.env.SAML_ENABLED === 'true',
        entryPoint: process.env.SAML_ENTRY_POINT,
        cert: process.env.SAML_CERT
      },
      ldap: {
        enabled: process.env.LDAP_ENABLED === 'true',
        url: process.env.LDAP_URL,
        bindDN: process.env.LDAP_BIND_DN
      }
    }
  },
  
  // Rate Limiting
  rateLimit: {
    requests: parseInt(process.env.API_RATE_LIMIT) || 1000,
    window: parseInt(process.env.API_RATE_WINDOW) || 60000
  }
};
```

### API Gateway Configuration

```javascript
// src/enterprise/config/gateway.js
export const gatewayConfig = {
  port: process.env.GATEWAY_PORT || 3001,
  
  loadBalancing: {
    strategy: 'round_robin', // round_robin, least_connections, weighted
    healthCheck: {
      enabled: true,
      interval: 30000,
      timeout: 5000,
      path: '/health'
    }
  },
  
  rateLimiting: {
    strategy: 'sliding_window',
    defaultLimits: {
      requests: parseInt(process.env.GATEWAY_RATE_LIMIT) || 5000,
      window: 60000
    }
  },
  
  caching: {
    enabled: true,
    defaultTTL: 300,
    maxSize: '100MB'
  },
  
  monitoring: {
    enabled: true,
    metrics: ['requests', 'latency', 'errors', 'cache_hits']
  }
};
```

## 🐳 Deployment Options

### Docker Deployment

#### 1. Single Container

```dockerfile
# Dockerfile.enterprise
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY src/enterprise/package*.json ./src/enterprise/

# Install dependencies
RUN npm ci --only=production
RUN cd src/enterprise && npm ci --only=production

# Copy source code
COPY . .

# Build application
RUN npm run build

# Expose ports
EXPOSE 3000 3001 9090

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:3000/api/v1/health || exit 1

# Start application
CMD ["npm", "start"]
```

```bash
# Build and run
docker build -f Dockerfile.enterprise -t kgen-enterprise .
docker run -p 3000:3000 -p 3001:3001 --env-file .env kgen-enterprise
```

#### 2. Docker Compose

```yaml
# docker-compose.enterprise.yml
version: '3.8'

services:
  # API Server
  kgen-api:
    build:
      context: .
      dockerfile: Dockerfile.enterprise
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://kgen:password@postgres:5432/kgen_enterprise
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - redis
    restart: unless-stopped
    volumes:
      - logs:/app/logs
    networks:
      - kgen-network

  # API Gateway
  kgen-gateway:
    build:
      context: .
      dockerfile: Dockerfile.gateway
    ports:
      - "3001:3001"
    environment:
      - GATEWAY_BACKEND_URL=http://kgen-api:3000
    depends_on:
      - kgen-api
    restart: unless-stopped
    networks:
      - kgen-network

  # PostgreSQL Database
  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=kgen_enterprise
      - POSTGRES_USER=kgen
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./scripts/init-db.sql:/docker-entrypoint-initdb.d/init-db.sql
    restart: unless-stopped
    networks:
      - kgen-network

  # Redis Cache & Queue
  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    restart: unless-stopped
    networks:
      - kgen-network

  # RabbitMQ (Optional)
  rabbitmq:
    image: rabbitmq:3-management-alpine
    environment:
      - RABBITMQ_DEFAULT_USER=kgen
      - RABBITMQ_DEFAULT_PASS=password
    ports:
      - "15672:15672"  # Management UI
    volumes:
      - rabbitmq_data:/var/lib/rabbitmq
    restart: unless-stopped
    networks:
      - kgen-network

  # Monitoring
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    restart: unless-stopped
    networks:
      - kgen-network

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3003:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana_data:/var/lib/grafana
      - ./monitoring/grafana/dashboards:/var/lib/grafana/dashboards
    restart: unless-stopped
    networks:
      - kgen-network

volumes:
  postgres_data:
  redis_data:
  rabbitmq_data:
  prometheus_data:
  grafana_data:
  logs:

networks:
  kgen-network:
    driver: bridge
```

### Kubernetes Deployment

```yaml
# k8s/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: kgen-enterprise
---
# k8s/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: kgen-config
  namespace: kgen-enterprise
data:
  NODE_ENV: "production"
  LOG_LEVEL: "info"
  API_RATE_LIMIT: "1000"
  GATEWAY_RATE_LIMIT: "5000"
---
# k8s/secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: kgen-secrets
  namespace: kgen-enterprise
type: Opaque
stringData:
  JWT_SECRET: "your-jwt-secret"
  DATABASE_URL: "postgresql://user:pass@postgres:5432/kgen"
  REDIS_URL: "redis://redis:6379"
---
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: kgen-api
  namespace: kgen-enterprise
spec:
  replicas: 3
  selector:
    matchLabels:
      app: kgen-api
  template:
    metadata:
      labels:
        app: kgen-api
    spec:
      containers:
      - name: kgen-api
        image: kgen-enterprise:latest
        ports:
        - containerPort: 3000
        env:
        - name: PORT
          value: "3000"
        envFrom:
        - configMapRef:
            name: kgen-config
        - secretRef:
            name: kgen-secrets
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /api/v1/health
            port: 3000
          initialDelaySeconds: 60
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /api/v1/health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
---
# k8s/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: kgen-api-service
  namespace: kgen-enterprise
spec:
  selector:
    app: kgen-api
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3000
  type: ClusterIP
---
# k8s/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: kgen-ingress
  namespace: kgen-enterprise
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/rate-limit: "100"
    nginx.ingress.kubernetes.io/rate-limit-window: "1m"
spec:
  tls:
  - hosts:
    - api.your-domain.com
    secretName: kgen-tls
  rules:
  - host: api.your-domain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: kgen-api-service
            port:
              number: 80
```

## 🔒 Security Setup

### SSL/TLS Configuration

```bash
# Generate SSL certificates with Let's Encrypt
certbot certonly --nginx -d api.your-domain.com -d gateway.your-domain.com

# Or use commercial certificate
# Place certificates in /etc/ssl/certs/
```

### Environment Security

```bash
# Create secure environment file
cat > .env.secure << EOF
# Use strong, unique secrets
JWT_SECRET=$(openssl rand -base64 64)
WEBHOOK_SECRET=$(openssl rand -base64 32)
SESSION_SECRET=$(openssl rand -base64 32)

# Database with strong password
DATABASE_URL=postgresql://kgen_user:$(openssl rand -base64 32)@localhost:5432/kgen_enterprise

# Redis with password
REDIS_URL=redis://:$(openssl rand -base64 32)@localhost:6379
EOF

# Set appropriate permissions
chmod 600 .env.secure
chown app:app .env.secure
```

### Firewall Configuration

```bash
# UFW configuration
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw allow 3000/tcp  # API Server (if needed)
ufw allow 3001/tcp  # Gateway (if needed)
ufw enable
```

### API Security Headers

```javascript
// Security middleware configuration
const securityConfig = {
  helmet: {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"]
      }
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    }
  },
  cors: {
    origin: process.env.CORS_ORIGINS?.split(',') || false,
    credentials: true,
    optionsSuccessStatus: 200
  }
};
```

## 📊 Monitoring & Observability

### Prometheus Metrics

```yaml
# monitoring/prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'kgen-api'
    static_configs:
      - targets: ['kgen-api:9090']
    scrape_interval: 10s
    metrics_path: /metrics

  - job_name: 'kgen-gateway'
    static_configs:
      - targets: ['kgen-gateway:9091']
    scrape_interval: 10s

  - job_name: 'node-exporter'
    static_configs:
      - targets: ['node-exporter:9100']

rule_files:
  - "alert_rules.yml"

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093
```

### Grafana Dashboards

```json
{
  "dashboard": {
    "title": "KGEN Enterprise API Metrics",
    "panels": [
      {
        "title": "Request Rate",
        "type": "stat",
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])",
            "legendFormat": "Requests/sec"
          }
        ]
      },
      {
        "title": "Response Time",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "95th percentile"
          },
          {
            "expr": "histogram_quantile(0.50, rate(http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "50th percentile"
          }
        ]
      },
      {
        "title": "Error Rate",
        "type": "stat",
        "targets": [
          {
            "expr": "rate(http_requests_total{status=~\"4..|5..\"}[5m]) / rate(http_requests_total[5m])",
            "legendFormat": "Error Rate %"
          }
        ]
      }
    ]
  }
}
```

### Application Logging

```javascript
// src/enterprise/utils/logger.js
import winston from 'winston';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'kgen-enterprise' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Structured logging for requests
export const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    logger.info('HTTP Request', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      responseTime: Date.now() - start,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      userId: req.user?.id
    });
  });
  
  next();
};
```

## ⚡ High Availability

### Load Balancer Configuration (Nginx)

```nginx
# /etc/nginx/sites-available/kgen-enterprise
upstream kgen_api {
    least_conn;
    server 127.0.0.1:3000 max_fails=3 fail_timeout=30s;
    server 127.0.0.1:3010 max_fails=3 fail_timeout=30s backup;
    server 127.0.0.1:3020 max_fails=3 fail_timeout=30s backup;
}

upstream kgen_gateway {
    least_conn;
    server 127.0.0.1:3001 max_fails=3 fail_timeout=30s;
    server 127.0.0.1:3011 max_fails=3 fail_timeout=30s backup;
}

# Rate limiting
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=gateway:10m rate=50r/s;

server {
    listen 80;
    server_name api.your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.your-domain.com;

    ssl_certificate /etc/letsencrypt/live/api.your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.your-domain.com/privkey.pem;
    
    # SSL Configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security Headers
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 10240;
    gzip_proxied expired no-cache no-store private must-revalidate auth;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;

    location /api/ {
        limit_req zone=api burst=20 nodelay;
        
        proxy_pass http://kgen_api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
    }

    location /gateway/ {
        limit_req zone=gateway burst=50 nodelay;
        
        proxy_pass http://kgen_gateway;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Database High Availability

```yaml
# PostgreSQL with streaming replication
# docker-compose.ha.yml
version: '3.8'

services:
  postgres-primary:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=kgen_enterprise
      - POSTGRES_USER=kgen
      - POSTGRES_PASSWORD=password
      - POSTGRES_REPLICATION_USER=replica
      - POSTGRES_REPLICATION_PASSWORD=replica_password
    volumes:
      - postgres_primary_data:/var/lib/postgresql/data
      - ./scripts/postgresql-primary.conf:/etc/postgresql/postgresql.conf
      - ./scripts/pg_hba.conf:/etc/postgresql/pg_hba.conf
    command: postgres -c config_file=/etc/postgresql/postgresql.conf
    networks:
      - kgen-network

  postgres-replica:
    image: postgres:15-alpine
    environment:
      - PGUSER=replica
      - POSTGRES_PASSWORD=replica_password
      - POSTGRES_MASTER_SERVICE=postgres-primary
      - POSTGRES_MASTER_PORT=5432
      - POSTGRES_DB=kgen_enterprise
    volumes:
      - postgres_replica_data:/var/lib/postgresql/data
    command: |
      bash -c "
        if [ ! -s /var/lib/postgresql/data/PG_VERSION ]; then
          echo '*:*:*:replica:replica_password' > ~/.pgpass
          chmod 0600 ~/.pgpass
          pg_basebackup -h postgres-primary -D /var/lib/postgresql/data -U replica -v -P -W
          echo 'standby_mode = on' >> /var/lib/postgresql/data/recovery.conf
          echo 'primary_conninfo = \"host=postgres-primary port=5432 user=replica\"' >> /var/lib/postgresql/data/recovery.conf
        fi
        postgres
      "
    depends_on:
      - postgres-primary
    networks:
      - kgen-network

  # PgBouncer for connection pooling
  pgbouncer:
    image: pgbouncer/pgbouncer:latest
    environment:
      - DATABASES_HOST=postgres-primary
      - DATABASES_PORT=5432
      - DATABASES_USER=kgen
      - DATABASES_PASSWORD=password
      - DATABASES_DBNAME=kgen_enterprise
      - POOL_MODE=transaction
      - MAX_CLIENT_CONN=100
      - DEFAULT_POOL_SIZE=25
    depends_on:
      - postgres-primary
    networks:
      - kgen-network

volumes:
  postgres_primary_data:
  postgres_replica_data:

networks:
  kgen-network:
    driver: bridge
```

### Redis Cluster

```yaml
# Redis Cluster Configuration
version: '3.8'

services:
  redis-node-1:
    image: redis:7-alpine
    command: redis-server /etc/redis/redis.conf --cluster-enabled yes --cluster-config-file nodes-6379.conf --cluster-node-timeout 5000 --appendonly yes --port 6379
    volumes:
      - ./redis-cluster.conf:/etc/redis/redis.conf
      - redis_1_data:/data
    networks:
      - kgen-network

  redis-node-2:
    image: redis:7-alpine
    command: redis-server /etc/redis/redis.conf --cluster-enabled yes --cluster-config-file nodes-6380.conf --cluster-node-timeout 5000 --appendonly yes --port 6380
    volumes:
      - ./redis-cluster.conf:/etc/redis/redis.conf
      - redis_2_data:/data
    networks:
      - kgen-network

  redis-node-3:
    image: redis:7-alpine
    command: redis-server /etc/redis/redis.conf --cluster-enabled yes --cluster-config-file nodes-6381.conf --cluster-node-timeout 5000 --appendonly yes --port 6381
    volumes:
      - ./redis-cluster.conf:/etc/redis/redis.conf
      - redis_3_data:/data
    networks:
      - kgen-network

  redis-cluster-init:
    image: redis:7-alpine
    depends_on:
      - redis-node-1
      - redis-node-2
      - redis-node-3
    command: redis-cli --cluster create redis-node-1:6379 redis-node-2:6380 redis-node-3:6381 --cluster-replicas 0 --cluster-yes
    networks:
      - kgen-network

volumes:
  redis_1_data:
  redis_2_data:
  redis_3_data:

networks:
  kgen-network:
    driver: bridge
```

## 🚨 Troubleshooting

### Common Issues

#### 1. API Server Won't Start

```bash
# Check logs
docker logs kgen-api

# Common issues:
# - Database connection error
# - Redis connection error  
# - Port already in use
# - Missing environment variables

# Verify connections
nc -zv localhost 5432  # PostgreSQL
nc -zv localhost 6379  # Redis

# Check environment
env | grep -E "(DATABASE|REDIS|JWT)"
```

#### 2. High Memory Usage

```bash
# Check memory usage
docker stats kgen-api

# Monitor Node.js heap
curl http://localhost:3000/api/v1/health | jq '.memory'

# Enable heap dumps for analysis
NODE_ENV=production node --max-old-space-size=4096 --heapsnapshot-signal=SIGUSR2 app.js
```

#### 3. Database Performance Issues

```sql
-- Check slow queries
SELECT query, mean_time, calls, rows
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;

-- Check connections
SELECT count(*) as connections, state 
FROM pg_stat_activity 
GROUP BY state;

-- Check cache hit ratio
SELECT 
  sum(heap_blks_read) as heap_read,
  sum(heap_blks_hit)  as heap_hit,
  sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)) as ratio
FROM pg_statio_user_tables;
```

#### 4. Rate Limiting Issues

```bash
# Check rate limit status in Redis
redis-cli KEYS "rate_limit:*"

# Monitor rate limit hits
curl -H "Authorization: Bearer $TOKEN" -v http://localhost:3000/api/v1/graphs
# Look for X-RateLimit-* headers

# Adjust limits in environment
export API_RATE_LIMIT=2000
export API_RATE_WINDOW=60000
```

### Performance Tuning

#### Node.js Optimization

```bash
# Production start with optimization
NODE_ENV=production \
NODE_OPTIONS="--max-old-space-size=4096 --optimize-for-size" \
npm start
```

#### Database Optimization

```sql
-- PostgreSQL optimization
-- postgresql.conf adjustments
shared_buffers = 256MB
effective_cache_size = 1GB
work_mem = 4MB
maintenance_work_mem = 64MB
checkpoint_completion_target = 0.7
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1
effective_io_concurrency = 200

-- Create indexes for common queries
CREATE INDEX CONCURRENTLY idx_graphs_user_created 
ON knowledge_graphs(user_id, created_at DESC);

CREATE INDEX CONCURRENTLY idx_jobs_status_created 
ON generation_jobs(status, created_at DESC);
```

### Health Checks

```bash
#!/bin/bash
# health-check.sh

echo "=== KGEN Enterprise Health Check ==="

# API Server
echo "Checking API Server..."
curl -f http://localhost:3000/api/v1/health || echo "❌ API Server DOWN"

# Gateway
echo "Checking API Gateway..."
curl -f http://localhost:3001/gateway/health || echo "❌ Gateway DOWN"

# Database
echo "Checking PostgreSQL..."
pg_isready -h localhost -p 5432 || echo "❌ PostgreSQL DOWN"

# Redis
echo "Checking Redis..."
redis-cli -h localhost -p 6379 ping || echo "❌ Redis DOWN"

# Disk Space
echo "Checking disk space..."
df -h | grep -E "(/$|/var)" | awk '{print $5 " " $6}' | while read line; do
  usage=$(echo $line | cut -d' ' -f1 | sed 's/%//')
  if [ $usage -gt 85 ]; then
    echo "⚠️  Disk usage high: $line"
  fi
done

# Memory Usage
echo "Checking memory..."
free -h | grep Mem | awk '{if(($3/$2)*100 > 85) print "⚠️  Memory usage high: " $3 "/" $2}'

echo "=== Health Check Complete ==="
```

## 📚 Additional Resources

- **API Documentation**: `/api/v1/docs` (Swagger UI)
- **GraphQL Playground**: `/api/v1/graphql` (development only)
- **Monitoring Dashboard**: `http://localhost:3003` (Grafana)
- **Queue Management**: Built-in Redis/RabbitMQ monitoring
- **Log Analysis**: Structured JSON logs in `/logs/`

## 🆘 Support

For issues and support:

1. **Check logs**: `docker logs kgen-enterprise` or `/logs/combined.log`
2. **Verify configuration**: Environment variables and connection strings
3. **Monitor resources**: CPU, memory, disk, and network usage
4. **Check dependencies**: Database, Redis, external services
5. **Review documentation**: This guide and API documentation

## 📈 Performance Benchmarks

Expected performance metrics:

- **API Throughput**: 1,000+ requests/second (single instance)
- **Response Time**: < 100ms (95th percentile)
- **WebSocket Connections**: 10,000+ concurrent
- **Queue Processing**: 10,000+ messages/minute
- **Memory Usage**: < 512MB (baseline), < 2GB (under load)
- **CPU Usage**: < 50% (normal load), < 80% (peak load)

---

*This deployment guide covers the comprehensive setup and operation of the KGEN Enterprise Integration Suite. For specific customization or advanced configurations, please consult the individual component documentation.*