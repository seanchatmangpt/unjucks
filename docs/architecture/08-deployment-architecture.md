# Deployment Architecture and Scaling Patterns

## Overview

Unjucks is designed for flexible deployment across different environments, from local development to large-scale enterprise production systems. This document outlines deployment architectures, scaling strategies, and operational patterns for maintaining high availability and performance.

## Deployment Models

```
┌────────────────────────────────────────────────────────────────────────────┐
│                          Deployment Architecture Models                         │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│ Standalone CLI       ┌──► MCP-Enabled       ┌──► Distributed Enterprise │
│                      │                       │                         │
│ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐  │
│ │ Local Templates  │ │ Claude Code + MCP │ │ Multi-Region     │  │
│ │ Direct Execution │ │ Agent Swarms     │ │ Load Balancing   │  │
│ │ File System      │ │ Shared Memory    │ │ Auto-Scaling     │  │
│ │ Minimal Deps     │ │ Coordination     │ │ High Availability│  │
│ └─────────────────┘ └─────────────────┘ └─────────────────┘  │
│                                                                            │
│ Best for:           Best for:            Best for:                       │
│ • Development        • Team Collaboration  • Production Scale                │
│ • CI/CD Pipelines    • Complex Projects    • Enterprise Security            │
│ • Simple Use Cases   • Real-time Coord.    • Regulatory Compliance          │
│ • Offline Work       • Performance Opt.    • Multi-tenant SaaS              │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

## 1. Standalone CLI Deployment

### Local Development Setup

```bash
# Installation
npm install -g @seanchatmangpt/unjucks

# Basic usage
unjucks list
unjucks generate api user --entityName User --dest ./src
```

### CI/CD Integration

```yaml
# .github/workflows/template-generation.yml
name: Template Generation

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  generate-templates:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install Unjucks
        run: npm install -g @seanchatmangpt/unjucks
        
      - name: Generate API Templates
        run: |
          unjucks generate api user --entityName User --withAuth
          unjucks generate api product --entityName Product --withValidation
          
      - name: Validate Generated Code
        run: |
          npm install
          npm run typecheck
          npm run lint
          npm run test
          
      - name: Archive Generated Files
        uses: actions/upload-artifact@v3
        with:
          name: generated-templates
          path: src/
```

### Docker Container

```dockerfile
# Dockerfile
FROM node:18-alpine

# Install Unjucks globally
RUN npm install -g @seanchatmangpt/unjucks

# Create app directory
WORKDIR /app

# Copy templates
COPY templates/ ./templates/
COPY unjucks.config.js ./

# Create non-root user
RUN addgroup -g 1001 -S unjucks && \
    adduser -S unjucks -u 1001

USER unjucks

# Set entrypoint
ENTRYPOINT ["unjucks"]
CMD ["help"]
```

## 2. MCP-Enabled Deployment

### Claude Code Integration

```json
// claude_desktop_config.json
{
  "mcpServers": {
    "unjucks": {
      "command": "npx",
      "args": ["@seanchatmangpt/unjucks", "mcp"],
      "env": {
        "UNJUCKS_CONFIG_PATH": "/path/to/unjucks.config.js",
        "UNJUCKS_TEMPLATES_PATH": "/path/to/templates"
      }
    },
    "claude-flow": {
      "command": "npx",
      "args": ["claude-flow@alpha", "mcp", "start"]
    }
  }
}
```

### Swarm Coordination Setup

```typescript
// swarm-deployment.ts
import { SwarmManager } from '@unjucks/swarm';
import { ClaudeFlowConnector } from '@unjucks/claude-flow';

export class SwarmDeployment {
  private swarmManager: SwarmManager;
  private claudeFlow: ClaudeFlowConnector;
  
  async initialize(): Promise<void> {
    // Initialize Claude Flow connection
    this.claudeFlow = new ClaudeFlowConnector({
      topology: 'mesh',
      maxAgents: 8,
      strategy: 'adaptive'
    });
    
    // Initialize swarm
    const swarmId = await this.claudeFlow.initializeSwarm();
    
    // Spawn specialized agents
    await Promise.all([
      this.claudeFlow.spawnAgent('template-generator', {
        capabilities: ['template-processing', 'file-operations'],
        resources: { memory: '512MB', cpu: '1' }
      }),
      this.claudeFlow.spawnAgent('rdf-processor', {
        capabilities: ['semantic-processing', 'ontology-validation'],
        resources: { memory: '1GB', cpu: '2' }
      }),
      this.claudeFlow.spawnAgent('security-validator', {
        capabilities: ['compliance-checking', 'vulnerability-scanning'],
        resources: { memory: '256MB', cpu: '1' }
      })
    ]);
    
    console.log(`Swarm initialized with ID: ${swarmId}`);
  }
  
  async processTemplate(templateRequest: TemplateRequest): Promise<TemplateResult> {
    // Orchestrate template processing across swarm
    return await this.claudeFlow.orchestrateTask({
      type: 'template-generation',
      priority: 'high',
      strategy: 'parallel',
      data: templateRequest
    });
  }
}
```

## 3. Distributed Enterprise Deployment

### Kubernetes Deployment

```yaml
# k8s-deployment.yml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: unjucks-api
  labels:
    app: unjucks
    component: api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: unjucks
      component: api
  template:
    metadata:
      labels:
        app: unjucks
        component: api
    spec:
      containers:
      - name: unjucks-api
        image: unjucks/api:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: unjucks-secrets
              key: redis-url
        - name: POSTGRES_URL
          valueFrom:
            secretKeyRef:
              name: unjucks-secrets
              key: postgres-url
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: unjucks-api-service
spec:
  selector:
    app: unjucks
    component: api
  ports:
    - protocol: TCP
      port: 80
      targetPort: 3000
  type: ClusterIP
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: unjucks-api-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: unjucks-api
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

### Semantic Processing Cluster

```yaml
# semantic-cluster.yml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: unjucks-semantic
  labels:
    app: unjucks
    component: semantic
spec:
  replicas: 2
  selector:
    matchLabels:
      app: unjucks
      component: semantic
  template:
    metadata:
      labels:
        app: unjucks
        component: semantic
    spec:
      containers:
      - name: semantic-processor
        image: unjucks/semantic:latest
        ports:
        - containerPort: 3001
        env:
        - name: RDF_CACHE_SIZE
          value: "1GB"
        - name: ONTOLOGY_STORAGE_PATH
          value: "/data/ontologies"
        resources:
          requests:
            memory: "1Gi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
        volumeMounts:
        - name: ontology-storage
          mountPath: /data/ontologies
      volumes:
      - name: ontology-storage
        persistentVolumeClaim:
          claimName: ontology-pvc
```

## 4. High Availability Architecture

### Multi-Region Deployment

```
┌────────────────────────────────────────────────────────────────────────────┐
│                          Multi-Region High Availability                         │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│                           ┌────────────────────┐                           │
│                           │ Global Load Balancer │                           │
│                           │ • DNS-based Routing  │                           │
│                           │ • Health Checks      │                           │
│                           │ • Failover Logic     │                           │
│                           └─────────┬──────────┘                           │
│                                    │                                    │
│                     ┌────────────┬────────────┐                     │
│                     │                 │                 │                     │
│            ┌───────────────────────┐   ┌───────────────────────┐            │
│            │ Region A (Primary)     │   │ Region B (Secondary)   │            │
│            │                        │   │                        │            │
│  ┌─────────────├───────────────────────┤   ├───────────────────────┬─────────────┐  │
│  │ API Cluster │                        │   │                        │ API Cluster │  │
│  │ • 3+ Nodes   │   ┌──────────────────┐   │   ┌──────────────────┐   │ • 3+ Nodes   │  │
│  │ • Auto-Scale │   │ Semantic Cluster A │   │   │ Semantic Cluster B │   │ • Auto-Scale │  │
│  └────────┬─────┘   │ • RDF Processing   │   │   │ • RDF Processing   │   └────────┬─────┘  │
│           │         │ • Ontology Cache   │   │   │ • Ontology Cache   │            │         │
│           │         └────────┬─────────┘   │   └────────┬─────────┘            │         │
│           │                  │               │               │                  │         │
│  ┌────────┬─────┘        ┌───────┬────────│───────┬───────┐        └─────┬────────┐  │
│  │ DB-A-1  │       │ Cache-A │       │       │ Cache-B │       │ DB-B-1  │  │
│  │ Primary │       │ Redis   │       │       │ Redis   │       │ Replica │  │
│  └─────────────────┘       └───────────────┘       └───────────────┘       └─────────────────┘  │
│                                       │                                       │
│                            ┌────────┬────────┐                            │
│                            │ Cross-Region Sync│                            │
│                            │ • Database Repl. │                            │
│                            │ • Cache Sync     │                            │
│                            │ • Config Sync    │                            │
│                            └─────────────────┘                            │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### Load Balancer Configuration

```nginx
# nginx.conf
upstream unjucks_api {
    least_conn;
    server unjucks-api-1:3000 weight=3 max_fails=3 fail_timeout=30s;
    server unjucks-api-2:3000 weight=3 max_fails=3 fail_timeout=30s;
    server unjucks-api-3:3000 weight=3 max_fails=3 fail_timeout=30s;
    
    # Backup servers in secondary region
    server unjucks-api-backup-1:3000 weight=1 backup;
    server unjucks-api-backup-2:3000 weight=1 backup;
}

upstream unjucks_semantic {
    ip_hash;  # Sticky sessions for semantic processing
    server semantic-1:3001 weight=2 max_fails=2 fail_timeout=20s;
    server semantic-2:3001 weight=2 max_fails=2 fail_timeout=20s;
    server semantic-backup:3001 weight=1 backup;
}

server {
    listen 80;
    server_name api.unjucks.dev;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.unjucks.dev;
    
    ssl_certificate /etc/ssl/certs/unjucks.crt;
    ssl_certificate_key /etc/ssl/private/unjucks.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;
    
    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=semantic:5m rate=2r/s;
    
    # API endpoints
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        
        proxy_pass http://unjucks_api;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts
        proxy_connect_timeout 5s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # Health checks
        proxy_next_upstream error timeout http_502 http_503 http_504;
    }
    
    # Semantic processing endpoints
    location /semantic/ {
        limit_req zone=semantic burst=5 nodelay;
        
        proxy_pass http://unjucks_semantic;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        
        # Longer timeouts for semantic processing
        proxy_connect_timeout 10s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }
    
    # Health check endpoint
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
```

## 5. Auto-Scaling Strategies

### Horizontal Pod Autoscaler (HPA)

```yaml
# advanced-hpa.yml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: unjucks-api-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: unjucks-api
  minReplicas: 3
  maxReplicas: 50
  metrics:
  # CPU utilization
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  
  # Memory utilization
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  
  # Custom metrics
  - type: Pods
    pods:
      metric:
        name: template_generation_queue_length
      target:
        type: AverageValue
        averageValue: "10"
  
  # External metrics (from monitoring system)
  - type: External
    external:
      metric:
        name: nginx_requests_per_second
        selector:
          matchLabels:
            service: unjucks-api
      target:
        type: AverageValue
        averageValue: "100"
  
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300  # 5 minutes
      policies:
      - type: Percent
        value: 10  # Scale down by max 10% of current replicas
        periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 60   # 1 minute
      policies:
      - type: Percent
        value: 50  # Scale up by max 50% of current replicas
        periodSeconds: 15
      - type: Pods
        value: 5   # Or add max 5 pods
        periodSeconds: 15
      selectPolicy: Max  # Use the policy that allows for more aggressive scaling
```

### Vertical Pod Autoscaler (VPA)

```yaml
# vpa.yml
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: unjucks-semantic-vpa
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: unjucks-semantic
  updatePolicy:
    updateMode: "Auto"  # Automatically apply recommendations
  resourcePolicy:
    containerPolicies:
    - containerName: semantic-processor
      minAllowed:
        cpu: 100m
        memory: 128Mi
      maxAllowed:
        cpu: 2
        memory: 4Gi
      controlledResources: ["cpu", "memory"]
      controlledValues: RequestsAndLimits
```

## 6. Performance Optimization

### Caching Strategy

```typescript
// cache-strategy.ts
export class CacheStrategy {
  private redis: Redis;
  private localCache: NodeCache;
  
  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT || '6379'),
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      cluster: {
        enableOfflineQueue: false,
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: null
      }
    });
    
    this.localCache = new NodeCache({
      stdTTL: 300,  // 5 minutes
      checkperiod: 60,  // Check for expired keys every minute
      useClones: false  // Better performance
    });
  }
  
  async get<T>(key: string, level: CacheLevel = 'L2'): Promise<T | null> {
    try {
      // L1 Cache (Local memory)
      if (level === 'L1' || level === 'L2') {
        const localResult = this.localCache.get<T>(key);
        if (localResult !== undefined) {
          await this.updateCacheStats('L1', 'hit');
          return localResult;
        }
        await this.updateCacheStats('L1', 'miss');
      }
      
      // L2 Cache (Redis)
      if (level === 'L2') {
        const redisResult = await this.redis.get(key);
        if (redisResult) {
          const parsed = JSON.parse(redisResult);
          // Populate L1 cache
          this.localCache.set(key, parsed, 300);
          await this.updateCacheStats('L2', 'hit');
          return parsed;
        }
        await this.updateCacheStats('L2', 'miss');
      }
      
      return null;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }
  
  async set<T>(
    key: string, 
    value: T, 
    ttl: number = 3600, 
    level: CacheLevel = 'L2'
  ): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      
      // Set in L1 cache
      if (level === 'L1' || level === 'L2') {
        this.localCache.set(key, value, ttl);
      }
      
      // Set in L2 cache
      if (level === 'L2') {
        await this.redis.setex(key, ttl, serialized);
      }
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }
  
  async invalidate(pattern: string): Promise<void> {
    try {
      // Invalidate local cache
      const localKeys = this.localCache.keys();
      const matchingKeys = localKeys.filter(key => 
        this.matchPattern(key, pattern)
      );
      this.localCache.del(matchingKeys);
      
      // Invalidate Redis cache
      const redisKeys = await this.redis.keys(pattern);
      if (redisKeys.length > 0) {
        await this.redis.del(...redisKeys);
      }
    } catch (error) {
      console.error('Cache invalidation error:', error);
    }
  }
}
```

### Database Optimization

```typescript
// database-config.ts
export class DatabaseConfig {
  static getPostgreSQLConfig(): any {
    return {
      // Connection pooling
      max: 20,  // Maximum connections
      min: 2,   // Minimum connections
      acquire: 30000,  // Maximum time to get connection
      idle: 10000,     // Maximum idle time
      
      // Performance optimizations
      logging: process.env.NODE_ENV === 'production' ? false : console.log,
      
      pool: {
        max: 20,
        min: 2,
        idle: 10000,
        acquire: 30000,
        evict: 1000,
        handleDisconnects: true
      },
      
      // Query optimization
      dialectOptions: {
        statement_timeout: 30000,  // 30 seconds
        query_timeout: 30000,
        connectTimeout: 10000,
        requestTimeout: 30000,
        
        // SSL configuration for production
        ssl: process.env.NODE_ENV === 'production' ? {
          require: true,
          rejectUnauthorized: false
        } : false
      },
      
      // Retry configuration
      retry: {
        max: 3,
        match: [
          'ETIMEDOUT',
          'EHOSTUNREACH',
          'ECONNRESET',
          'ECONNREFUSED',
          'ENETUNREACH',
          'SequelizeConnectionError'
        ]
      }
    };
  }
  
  static getReadReplicaConfig(): any {
    return {
      ...this.getPostgreSQLConfig(),
      replication: {
        read: [
          {
            host: process.env.DB_READ_REPLICA_1_HOST,
            username: process.env.DB_READ_USERNAME,
            password: process.env.DB_READ_PASSWORD,
            database: process.env.DB_NAME
          },
          {
            host: process.env.DB_READ_REPLICA_2_HOST,
            username: process.env.DB_READ_USERNAME,
            password: process.env.DB_READ_PASSWORD,
            database: process.env.DB_NAME
          }
        ],
        write: {
          host: process.env.DB_WRITE_HOST,
          username: process.env.DB_WRITE_USERNAME,
          password: process.env.DB_WRITE_PASSWORD,
          database: process.env.DB_NAME
        }
      }
    };
  }
}
```

## 7. Monitoring and Observability

### Prometheus Metrics

```typescript
// metrics.ts
import { register, Counter, Histogram, Gauge } from 'prom-client';

export class MetricsCollector {
  // Request metrics
  private readonly httpRequestsTotal = new Counter({
    name: 'unjucks_http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code']
  });
  
  private readonly httpRequestDuration = new Histogram({
    name: 'unjucks_http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route'],
    buckets: [0.1, 0.5, 1, 2, 5, 10, 30]
  });
  
  // Template processing metrics
  private readonly templateGenerationTotal = new Counter({
    name: 'unjucks_template_generation_total',
    help: 'Total number of template generations',
    labelNames: ['template_type', 'status']
  });
  
  private readonly templateGenerationDuration = new Histogram({
    name: 'unjucks_template_generation_duration_seconds',
    help: 'Duration of template generation in seconds',
    labelNames: ['template_type'],
    buckets: [0.1, 0.5, 1, 5, 10, 30, 60]
  });
  
  // RDF processing metrics
  private readonly rdfProcessingDuration = new Histogram({
    name: 'unjucks_rdf_processing_duration_seconds',
    help: 'Duration of RDF processing in seconds',
    labelNames: ['operation_type'],
    buckets: [0.01, 0.1, 0.5, 1, 5, 10]
  });
  
  // Cache metrics
  private readonly cacheHitRate = new Gauge({
    name: 'unjucks_cache_hit_rate',
    help: 'Cache hit rate percentage',
    labelNames: ['cache_level']
  });
  
  // System metrics
  private readonly activeConnections = new Gauge({
    name: 'unjucks_active_connections',
    help: 'Number of active connections'
  });
  
  private readonly queueLength = new Gauge({
    name: 'unjucks_queue_length',
    help: 'Current queue length',
    labelNames: ['queue_type']
  });
  
  constructor() {
    // Register all metrics
    register.registerMetric(this.httpRequestsTotal);
    register.registerMetric(this.httpRequestDuration);
    register.registerMetric(this.templateGenerationTotal);
    register.registerMetric(this.templateGenerationDuration);
    register.registerMetric(this.rdfProcessingDuration);
    register.registerMetric(this.cacheHitRate);
    register.registerMetric(this.activeConnections);
    register.registerMetric(this.queueLength);
  }
  
  recordHttpRequest(method: string, route: string, statusCode: number, duration: number): void {
    this.httpRequestsTotal.labels(method, route, statusCode.toString()).inc();
    this.httpRequestDuration.labels(method, route).observe(duration);
  }
  
  recordTemplateGeneration(templateType: string, status: string, duration: number): void {
    this.templateGenerationTotal.labels(templateType, status).inc();
    this.templateGenerationDuration.labels(templateType).observe(duration);
  }
  
  recordRDFProcessing(operationType: string, duration: number): void {
    this.rdfProcessingDuration.labels(operationType).observe(duration);
  }
  
  updateCacheHitRate(cacheLevel: string, hitRate: number): void {
    this.cacheHitRate.labels(cacheLevel).set(hitRate);
  }
  
  updateActiveConnections(count: number): void {
    this.activeConnections.set(count);
  }
  
  updateQueueLength(queueType: string, length: number): void {
    this.queueLength.labels(queueType).set(length);
  }
}
```

### Grafana Dashboard Configuration

```json
{
  "dashboard": {
    "id": null,
    "title": "Unjucks Production Dashboard",
    "tags": ["unjucks", "production"],
    "timezone": "browser",
    "panels": [
      {
        "id": 1,
        "title": "Request Rate",
        "type": "stat",
        "targets": [{
          "expr": "rate(unjucks_http_requests_total[5m])",
          "legendFormat": "Requests/sec"
        }],
        "fieldConfig": {
          "defaults": {
            "unit": "reqps",
            "thresholds": {
              "steps": [
                {"color": "green", "value": null},
                {"color": "yellow", "value": 100},
                {"color": "red", "value": 500}
              ]
            }
          }
        }
      },
      {
        "id": 2,
        "title": "Response Times",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(unjucks_http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "95th percentile"
          },
          {
            "expr": "histogram_quantile(0.50, rate(unjucks_http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "50th percentile"
          }
        ],
        "yAxes": [{
          "unit": "s",
          "min": 0
        }]
      },
      {
        "id": 3,
        "title": "Template Generation Rate",
        "type": "graph",
        "targets": [{
          "expr": "rate(unjucks_template_generation_total[5m])",
          "legendFormat": "{{template_type}}"
        }]
      },
      {
        "id": 4,
        "title": "Cache Hit Rate",
        "type": "stat",
        "targets": [{
          "expr": "unjucks_cache_hit_rate",
          "legendFormat": "{{cache_level}}"
        }],
        "fieldConfig": {
          "defaults": {
            "unit": "percent",
            "min": 0,
            "max": 100
          }
        }
      }
    ],
    "time": {
      "from": "now-1h",
      "to": "now"
    },
    "refresh": "5s"
  }
}
```

This deployment architecture provides comprehensive coverage for running Unjucks at scale, from simple development setups to complex enterprise deployments with high availability, auto-scaling, and comprehensive monitoring.