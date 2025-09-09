# Observability Setup & Configuration Guide

**Target Audience**: SRE, Platform Engineering, DevOps Teams  
**Classification**: Internal Operations  
**Last Updated**: September 2025  
**Version**: 2.0

## Overview

This guide provides comprehensive setup and configuration instructions for monitoring, logging, and observability infrastructure for the Unjucks enterprise platform. The observability stack is designed for Fortune 5 environments with high availability, compliance, and security requirements.

## Observability Stack Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Applications  │───▶│   Prometheus    │───▶│    Grafana      │
│  (Metrics API)  │    │ (Metrics Store) │    │  (Dashboards)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │                       │
┌─────────────────┐             │               ┌─────────────────┐
│  Infrastructure │─────────────┘               │   AlertManager  │
│   (Node/K8s)    │                             │   (Alerting)    │
└─────────────────┘                             └─────────────────┘

┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Applications  │───▶│   Fluentd/      │───▶│ Elasticsearch   │
│    (Logs)       │    │   Logstash      │    │  (Log Store)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                       │
┌─────────────────┐                           ┌─────────────────┐
│  Infrastructure │───────────────────────────▶│     Kibana      │
│    (System)     │                           │ (Log Analysis)  │
└─────────────────┘                           └─────────────────┘

┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Applications  │───▶│     Jaeger      │───▶│    Grafana      │
│   (Traces)      │    │ (Trace Store)   │    │ (Trace Viewer)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Metrics Collection Setup

### Prometheus Configuration

#### Prometheus Server Deployment
```yaml
# prometheus-config.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: prometheus-config
  namespace: monitoring
data:
  prometheus.yml: |
    global:
      scrape_interval: 15s
      evaluation_interval: 15s
      scrape_timeout: 10s
      external_labels:
        cluster: 'production'
        environment: 'prod'
        
    rule_files:
      - "/etc/prometheus/rules/*.yml"
      
    alerting:
      alertmanagers:
        - static_configs:
            - targets:
              - alertmanager:9093
              
    scrape_configs:
      # Application metrics
      - job_name: 'unjucks-app'
        static_configs:
          - targets: ['unjucks-app:3000']
        metrics_path: /metrics
        scrape_interval: 30s
        scrape_timeout: 10s
        
      # Kubernetes API server
      - job_name: 'kubernetes-apiservers'
        kubernetes_sd_configs:
          - role: endpoints
        scheme: https
        tls_config:
          ca_file: /var/run/secrets/kubernetes.io/serviceaccount/ca.crt
        bearer_token_file: /var/run/secrets/kubernetes.io/serviceaccount/token
        relabel_configs:
          - source_labels: [__meta_kubernetes_namespace, __meta_kubernetes_service_name, __meta_kubernetes_endpoint_port_name]
            action: keep
            regex: default;kubernetes;https
            
      # Kubernetes nodes (kubelet)
      - job_name: 'kubernetes-nodes'
        scheme: https
        tls_config:
          ca_file: /var/run/secrets/kubernetes.io/serviceaccount/ca.crt
        bearer_token_file: /var/run/secrets/kubernetes.io/serviceaccount/token
        kubernetes_sd_configs:
          - role: node
        relabel_configs:
          - action: labelmap
            regex: __meta_kubernetes_node_label_(.+)
          - target_label: __address__
            replacement: kubernetes.default.svc:443
          - source_labels: [__meta_kubernetes_node_name]
            regex: (.+)
            target_label: __metrics_path__
            replacement: /api/v1/nodes/${1}/proxy/metrics
            
      # Node Exporter
      - job_name: 'node-exporter'
        kubernetes_sd_configs:
          - role: endpoints
        relabel_configs:
          - source_labels: [__meta_kubernetes_endpoints_name]
            action: keep
            regex: node-exporter
          - source_labels: [__meta_kubernetes_endpoint_address_target_name]
            target_label: node
            
      # PostgreSQL Exporter
      - job_name: 'postgres-exporter'
        static_configs:
          - targets: ['postgres-exporter:9187']
        scrape_interval: 30s
        
      # Redis Exporter
      - job_name: 'redis-exporter'
        static_configs:
          - targets: ['redis-exporter:9121']
        scrape_interval: 30s
        
      # NGINX Ingress
      - job_name: 'nginx-ingress'
        kubernetes_sd_configs:
          - role: pod
        relabel_configs:
          - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
            action: keep
            regex: true
          - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_path]
            action: replace
            target_label: __metrics_path__
            regex: (.+)

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: prometheus
  namespace: monitoring
spec:
  replicas: 1
  selector:
    matchLabels:
      app: prometheus
  template:
    metadata:
      labels:
        app: prometheus
    spec:
      serviceAccountName: prometheus
      containers:
        - name: prometheus
          image: prom/prometheus:v2.40.0
          args:
            - '--config.file=/etc/prometheus/prometheus.yml'
            - '--storage.tsdb.path=/prometheus/'
            - '--web.console.libraries=/etc/prometheus/console_libraries'
            - '--web.console.templates=/etc/prometheus/consoles'
            - '--storage.tsdb.retention.time=30d'
            - '--storage.tsdb.retention.size=50GB'
            - '--web.enable-lifecycle'
            - '--web.enable-admin-api'
          ports:
            - containerPort: 9090
          resources:
            requests:
              memory: "4Gi"
              cpu: "1000m"
            limits:
              memory: "8Gi"
              cpu: "2000m"
          volumeMounts:
            - name: prometheus-config
              mountPath: /etc/prometheus/
            - name: prometheus-storage
              mountPath: /prometheus/
            - name: alert-rules
              mountPath: /etc/prometheus/rules/
      volumes:
        - name: prometheus-config
          configMap:
            name: prometheus-config
        - name: prometheus-storage
          persistentVolumeClaim:
            claimName: prometheus-pvc
        - name: alert-rules
          configMap:
            name: prometheus-rules
```

#### Alert Rules Configuration
```yaml
# prometheus-rules.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: prometheus-rules
  namespace: monitoring
data:
  app-rules.yml: |
    groups:
    - name: unjucks-app
      rules:
      - alert: HighResponseTime
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 0.5
        for: 2m
        labels:
          severity: warning
          service: unjucks-app
        annotations:
          summary: "High response time detected"
          description: "95th percentile response time is {{ $value }}s for the last 2 minutes"
          
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) > 0.01
        for: 1m
        labels:
          severity: critical
          service: unjucks-app
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value }}% for the last minute"
          
      - alert: ApplicationDown
        expr: up{job="unjucks-app"} == 0
        for: 30s
        labels:
          severity: critical
          service: unjucks-app
        annotations:
          summary: "Application is down"
          description: "Unjucks application has been down for more than 30 seconds"
          
  infra-rules.yml: |
    groups:
    - name: infrastructure
      rules:
      - alert: HighCPUUsage
        expr: (100 - (avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)) > 80
        for: 5m
        labels:
          severity: warning
          component: infrastructure
        annotations:
          summary: "High CPU usage detected"
          description: "CPU usage is {{ $value }}% on instance {{ $labels.instance }}"
          
      - alert: HighMemoryUsage
        expr: (node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes) / node_memory_MemTotal_bytes * 100 > 90
        for: 3m
        labels:
          severity: critical
          component: infrastructure
        annotations:
          summary: "High memory usage detected"
          description: "Memory usage is {{ $value }}% on instance {{ $labels.instance }}"
          
      - alert: DiskSpaceLow
        expr: (node_filesystem_avail_bytes / node_filesystem_size_bytes) * 100 < 10
        for: 5m
        labels:
          severity: warning
          component: infrastructure
        annotations:
          summary: "Low disk space"
          description: "Disk space is {{ $value }}% on instance {{ $labels.instance }}"
          
  database-rules.yml: |
    groups:
    - name: database
      rules:
      - alert: PostgreSQLDown
        expr: up{job="postgres-exporter"} == 0
        for: 30s
        labels:
          severity: critical
          service: postgresql
        annotations:
          summary: "PostgreSQL is down"
          description: "PostgreSQL database has been down for more than 30 seconds"
          
      - alert: HighDatabaseConnections
        expr: pg_stat_database_numbackends / pg_settings_max_connections * 100 > 80
        for: 2m
        labels:
          severity: warning
          service: postgresql
        annotations:
          summary: "High database connection usage"
          description: "Database connection usage is {{ $value }}%"
          
      - alert: DatabaseReplicationLag
        expr: pg_replication_lag_seconds > 10
        for: 1m
        labels:
          severity: warning
          service: postgresql
        annotations:
          summary: "Database replication lag detected"
          description: "Replication lag is {{ $value }} seconds"
          
      - alert: RedisDown
        expr: up{job="redis-exporter"} == 0
        for: 30s
        labels:
          severity: critical
          service: redis
        annotations:
          summary: "Redis is down"
          description: "Redis cache has been down for more than 30 seconds"
          
      - alert: RedisHighMemoryUsage
        expr: redis_memory_used_bytes / redis_memory_max_bytes * 100 > 90
        for: 3m
        labels:
          severity: warning
          service: redis
        annotations:
          summary: "Redis high memory usage"
          description: "Redis memory usage is {{ $value }}%"
```

### Application Metrics Instrumentation

#### Node.js Application Metrics
```javascript
// src/lib/metrics.js
const promClient = require('prom-client');

// Create metrics registry
const register = promClient.register;

// Default metrics (CPU, memory, etc.)
promClient.collectDefaultMetrics({
  register,
  timeout: 5000,
  gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
});

// Custom metrics
const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5, 10],
});

const httpRequestsTotal = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status'],
});

const templateGenerationDuration = new promClient.Histogram({
  name: 'template_generation_duration_seconds',
  help: 'Duration of template generation operations',
  labelNames: ['template', 'generator', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10, 30],
});

const databaseConnectionPool = new promClient.Gauge({
  name: 'database_connection_pool_size',
  help: 'Current database connection pool size',
  labelNames: ['pool', 'state'],
});

const cacheHitRatio = new promClient.Gauge({
  name: 'cache_hit_ratio',
  help: 'Cache hit ratio (0-1)',
  labelNames: ['cache_type'],
});

// Middleware for HTTP metrics
const metricsMiddleware = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const labels = {
      method: req.method,
      route: req.route?.path || req.path,
      status: res.statusCode,
    };
    
    httpRequestDuration.observe(labels, duration);
    httpRequestsTotal.inc(labels);
  });
  
  next();
};

// Business metrics
const activeUsers = new promClient.Gauge({
  name: 'active_users_total',
  help: 'Number of active users',
  labelNames: ['tenant'],
});

const templatesGenerated = new promClient.Counter({
  name: 'templates_generated_total',
  help: 'Total number of templates generated',
  labelNames: ['template_type', 'generator', 'tenant'],
});

const rdfTripleCount = new promClient.Gauge({
  name: 'rdf_triples_total',
  help: 'Total number of RDF triples stored',
  labelNames: ['context', 'tenant'],
});

// Export metrics endpoint
const metricsEndpoint = async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    const metrics = await register.metrics();
    res.send(metrics);
  } catch (error) {
    res.status(500).send('Error generating metrics');
  }
};

module.exports = {
  register,
  metricsMiddleware,
  metricsEndpoint,
  httpRequestDuration,
  httpRequestsTotal,
  templateGenerationDuration,
  databaseConnectionPool,
  cacheHitRatio,
  activeUsers,
  templatesGenerated,
  rdfTripleCount,
};
```

#### Database Metrics Collection
```javascript
// src/lib/database-metrics.js
const { Pool } = require('pg');
const { databaseConnectionPool } = require('./metrics');

class DatabaseMetricsCollector {
  constructor(pool) {
    this.pool = pool;
    this.startCollection();
  }
  
  startCollection() {
    // Collect pool metrics every 30 seconds
    setInterval(() => {
      this.collectPoolMetrics();
    }, 30000);
  }
  
  collectPoolMetrics() {
    const pool = this.pool;
    
    databaseConnectionPool.set(
      { pool: 'main', state: 'total' },
      pool.totalCount
    );
    
    databaseConnectionPool.set(
      { pool: 'main', state: 'idle' },
      pool.idleCount
    );
    
    databaseConnectionPool.set(
      { pool: 'main', state: 'waiting' },
      pool.waitingCount
    );
  }
  
  async collectQueryMetrics() {
    try {
      // Collect active connection count
      const activeConnectionsResult = await this.pool.query(`
        SELECT count(*) as active_connections 
        FROM pg_stat_activity 
        WHERE state = 'active'
      `);
      
      databaseConnectionPool.set(
        { pool: 'main', state: 'active' },
        parseInt(activeConnectionsResult.rows[0].active_connections)
      );
      
      // Collect database size metrics
      const dbSizeResult = await this.pool.query(`
        SELECT pg_size_pretty(pg_database_size(current_database())) as size,
               pg_database_size(current_database()) as size_bytes
      `);
      
      // Could add database size gauge here if needed
      
    } catch (error) {
      console.error('Error collecting database metrics:', error);
    }
  }
}

module.exports = DatabaseMetricsCollector;
```

## Grafana Dashboard Setup

### Grafana Deployment
```yaml
# grafana-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: grafana
  namespace: monitoring
spec:
  replicas: 1
  selector:
    matchLabels:
      app: grafana
  template:
    metadata:
      labels:
        app: grafana
    spec:
      securityContext:
        fsGroup: 472
        runAsUser: 472
      containers:
        - name: grafana
          image: grafana/grafana:9.3.0
          ports:
            - containerPort: 3000
          resources:
            requests:
              memory: "2Gi"
              cpu: "500m"
            limits:
              memory: "4Gi"
              cpu: "1000m"
          env:
            - name: GF_SECURITY_ADMIN_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: grafana-secret
                  key: admin-password
            - name: GF_SERVER_ROOT_URL
              value: "https://grafana.company.com"
            - name: GF_AUTH_LDAP_ENABLED
              value: "true"
            - name: GF_AUTH_LDAP_CONFIG_FILE
              value: "/etc/grafana/ldap.toml"
          volumeMounts:
            - name: grafana-storage
              mountPath: /var/lib/grafana
            - name: grafana-config
              mountPath: /etc/grafana/grafana.ini
              subPath: grafana.ini
            - name: grafana-ldap-config
              mountPath: /etc/grafana/ldap.toml
              subPath: ldap.toml
            - name: grafana-dashboards
              mountPath: /var/lib/grafana/dashboards
      volumes:
        - name: grafana-storage
          persistentVolumeClaim:
            claimName: grafana-pvc
        - name: grafana-config
          configMap:
            name: grafana-config
        - name: grafana-ldap-config
          secret:
            secretName: grafana-ldap-config
        - name: grafana-dashboards
          configMap:
            name: grafana-dashboards
```

### Dashboard Configuration
```json
{
  "dashboard": {
    "id": null,
    "title": "Unjucks Application Overview",
    "tags": ["unjucks", "production"],
    "timezone": "browser",
    "panels": [
      {
        "id": 1,
        "title": "Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])",
            "legendFormat": "{{method}} {{route}}"
          }
        ],
        "yAxes": [
          {
            "label": "requests/sec",
            "min": 0
          }
        ],
        "gridPos": {
          "h": 8,
          "w": 12,
          "x": 0,
          "y": 0
        }
      },
      {
        "id": 2,
        "title": "Response Time (95th percentile)",
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
        ],
        "yAxes": [
          {
            "label": "seconds",
            "min": 0
          }
        ],
        "gridPos": {
          "h": 8,
          "w": 12,
          "x": 12,
          "y": 0
        }
      },
      {
        "id": 3,
        "title": "Error Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_requests_total{status=~\"5..\"}[5m]) / rate(http_requests_total[5m]) * 100",
            "legendFormat": "Error Rate %"
          }
        ],
        "yAxes": [
          {
            "label": "percentage",
            "min": 0,
            "max": 100
          }
        ],
        "gridPos": {
          "h": 8,
          "w": 12,
          "x": 0,
          "y": 8
        }
      },
      {
        "id": 4,
        "title": "Active Database Connections",
        "type": "graph",
        "targets": [
          {
            "expr": "database_connection_pool_size{state=\"active\"}",
            "legendFormat": "Active Connections"
          },
          {
            "expr": "database_connection_pool_size{state=\"total\"}",
            "legendFormat": "Total Connections"
          }
        ],
        "gridPos": {
          "h": 8,
          "w": 12,
          "x": 12,
          "y": 8
        }
      }
    ],
    "time": {
      "from": "now-1h",
      "to": "now"
    },
    "refresh": "30s"
  }
}
```

## Centralized Logging Setup

### ELK Stack Deployment

#### Elasticsearch Configuration
```yaml
# elasticsearch-deployment.yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: elasticsearch
  namespace: logging
spec:
  serviceName: elasticsearch
  replicas: 3
  selector:
    matchLabels:
      app: elasticsearch
  template:
    metadata:
      labels:
        app: elasticsearch
    spec:
      containers:
        - name: elasticsearch
          image: docker.elastic.co/elasticsearch/elasticsearch:7.17.0
          resources:
            requests:
              memory: "8Gi"
              cpu: "2000m"
            limits:
              memory: "16Gi"
              cpu: "4000m"
          ports:
            - containerPort: 9200
            - containerPort: 9300
          env:
            - name: cluster.name
              value: "unjucks-logs"
            - name: node.name
              valueFrom:
                fieldRef:
                  fieldPath: metadata.name
            - name: discovery.seed_hosts
              value: "elasticsearch-0.elasticsearch,elasticsearch-1.elasticsearch,elasticsearch-2.elasticsearch"
            - name: cluster.initial_master_nodes
              value: "elasticsearch-0,elasticsearch-1,elasticsearch-2"
            - name: ES_JAVA_OPTS
              value: "-Xms8g -Xmx8g"
            - name: xpack.security.enabled
              value: "true"
            - name: xpack.security.transport.ssl.enabled
              value: "true"
            - name: xpack.security.http.ssl.enabled
              value: "true"
          volumeMounts:
            - name: data
              mountPath: /usr/share/elasticsearch/data
            - name: config
              mountPath: /usr/share/elasticsearch/config/elasticsearch.yml
              subPath: elasticsearch.yml
      volumes:
        - name: config
          configMap:
            name: elasticsearch-config
  volumeClaimTemplates:
    - metadata:
        name: data
      spec:
        accessModes: ["ReadWriteOnce"]
        resources:
          requests:
            storage: 500Gi
        storageClassName: fast-ssd
```

#### Logstash Configuration
```yaml
# logstash-config.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: logstash-config
  namespace: logging
data:
  logstash.yml: |
    http.host: "0.0.0.0"
    path.config: /usr/share/logstash/pipeline
    pipeline.workers: 4
    pipeline.batch.size: 1000
    pipeline.batch.delay: 5
    
  pipelines.yml: |
    - pipeline.id: main
      path.config: "/usr/share/logstash/pipeline/main.conf"
      
  main.conf: |
    input {
      beats {
        port => 5044
      }
      
      http {
        port => 8080
        codec => json
      }
      
      # Kubernetes logs
      kubernetes {
        type => "kubernetes"
      }
    }
    
    filter {
      # Parse JSON logs
      if [message] {
        json {
          source => "message"
          target => "parsed"
        }
      }
      
      # Add timestamp
      date {
        match => [ "timestamp", "ISO8601" ]
      }
      
      # Extract Kubernetes metadata
      if [kubernetes] {
        mutate {
          rename => { "[kubernetes][pod][name]" => "pod_name" }
          rename => { "[kubernetes][namespace]" => "namespace" }
          rename => { "[kubernetes][container][name]" => "container_name" }
        }
      }
      
      # Parse application logs
      if [container_name] == "unjucks" {
        grok {
          match => { 
            "message" => "%{TIMESTAMP_ISO8601:timestamp} %{LOGLEVEL:level} \[%{DATA:component}\] %{GREEDYDATA:log_message}"
          }
        }
        
        # Parse HTTP access logs
        if [log_message] =~ /^HTTP/ {
          grok {
            match => {
              "log_message" => "HTTP %{WORD:method} %{URIPATH:path} %{NUMBER:status} %{NUMBER:response_time}ms"
            }
          }
        }
      }
      
      # Security log enrichment
      if [level] == "SECURITY" {
        mutate {
          add_field => { "alert_type" => "security" }
          add_tag => [ "security", "alert" ]
        }
      }
      
      # Performance log enrichment
      if [response_time] and [response_time] > 1000 {
        mutate {
          add_field => { "alert_type" => "performance" }
          add_tag => [ "performance", "slow" ]
        }
      }
    }
    
    output {
      elasticsearch {
        hosts => ["elasticsearch:9200"]
        index => "unjucks-logs-%{+YYYY.MM.dd}"
        user => "${ELASTICSEARCH_USERNAME}"
        password => "${ELASTICSEARCH_PASSWORD}"
      }
      
      # Send alerts to SIEM
      if "alert" in [tags] {
        http {
          url => "${SIEM_WEBHOOK_URL}"
          http_method => "post"
          headers => {
            "Authorization" => "Bearer ${SIEM_API_KEY}"
            "Content-Type" => "application/json"
          }
          mapping => {
            "timestamp" => "%{@timestamp}"
            "level" => "%{level}"
            "message" => "%{log_message}"
            "pod" => "%{pod_name}"
            "namespace" => "%{namespace}"
            "alert_type" => "%{alert_type}"
          }
        }
      }
      
      # Debug output (remove in production)
      # stdout { codec => rubydebug }
    }

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: logstash
  namespace: logging
spec:
  replicas: 2
  selector:
    matchLabels:
      app: logstash
  template:
    metadata:
      labels:
        app: logstash
    spec:
      containers:
        - name: logstash
          image: docker.elastic.co/logstash/logstash:7.17.0
          resources:
            requests:
              memory: "4Gi"
              cpu: "1000m"
            limits:
              memory: "8Gi"
              cpu: "2000m"
          ports:
            - containerPort: 5044
            - containerPort: 8080
          env:
            - name: ELASTICSEARCH_USERNAME
              valueFrom:
                secretKeyRef:
                  name: elasticsearch-secret
                  key: username
            - name: ELASTICSEARCH_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: elasticsearch-secret
                  key: password
            - name: SIEM_WEBHOOK_URL
              valueFrom:
                secretKeyRef:
                  name: siem-config
                  key: webhook-url
            - name: SIEM_API_KEY
              valueFrom:
                secretKeyRef:
                  name: siem-config
                  key: api-key
          volumeMounts:
            - name: logstash-config
              mountPath: /usr/share/logstash/config
            - name: logstash-pipeline
              mountPath: /usr/share/logstash/pipeline
      volumes:
        - name: logstash-config
          configMap:
            name: logstash-config
        - name: logstash-pipeline
          configMap:
            name: logstash-config
```

#### Application Logging Configuration
```javascript
// src/lib/logger.js
const winston = require('winston');
const { format } = winston;

// Custom format for structured logging
const customFormat = format.combine(
  format.timestamp(),
  format.errors({ stack: true }),
  format.json(),
  format.printf(({ timestamp, level, message, ...meta }) => {
    return JSON.stringify({
      timestamp,
      level,
      message,
      ...meta,
      service: 'unjucks',
      version: process.env.APP_VERSION,
      instance: process.env.HOSTNAME,
      correlation_id: meta.correlation_id || 'unknown'
    });
  })
);

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: customFormat,
  defaultMeta: { service: 'unjucks' },
  transports: [
    // Console output for container logs
    new winston.transports.Console({
      format: format.combine(
        format.colorize(),
        format.simple()
      )
    }),
    
    // File output for local development
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  ]
});

// Add request correlation middleware
const addCorrelationId = (req, res, next) => {
  req.correlation_id = req.headers['x-correlation-id'] || 
                      req.headers['x-request-id'] || 
                      require('uuid').v4();
  
  res.set('X-Correlation-ID', req.correlation_id);
  next();
};

// HTTP request logging middleware
const httpLoggerMiddleware = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('HTTP Request', {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      user_agent: req.get('User-Agent'),
      ip: req.ip,
      correlation_id: req.correlation_id,
      user_id: req.user?.id,
      tenant_id: req.tenant?.id
    });
  });
  
  next();
};

// Security logging helper
const logSecurityEvent = (event, details, req) => {
  logger.warn('Security Event', {
    event,
    details,
    ip: req?.ip,
    user_agent: req?.get('User-Agent'),
    user_id: req?.user?.id,
    tenant_id: req?.tenant?.id,
    correlation_id: req?.correlation_id,
    level: 'SECURITY'
  });
};

// Audit logging helper
const logAuditEvent = (action, resource, details, req) => {
  logger.info('Audit Event', {
    action,
    resource,
    details,
    user_id: req.user?.id,
    tenant_id: req.tenant?.id,
    ip: req.ip,
    correlation_id: req.correlation_id,
    level: 'AUDIT'
  });
};

module.exports = {
  logger,
  addCorrelationId,
  httpLoggerMiddleware,
  logSecurityEvent,
  logAuditEvent
};
```

## Alerting Setup

### AlertManager Configuration
```yaml
# alertmanager-config.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: alertmanager-config
  namespace: monitoring
data:
  alertmanager.yml: |
    global:
      smtp_smarthost: 'smtp.company.com:587'
      smtp_from: 'alerts@company.com'
      smtp_auth_username: 'alerts@company.com'
      smtp_auth_password: '${SMTP_PASSWORD}'
      
    route:
      group_by: ['alertname', 'severity']
      group_wait: 30s
      group_interval: 5m
      repeat_interval: 4h
      receiver: 'default-receiver'
      routes:
        - match:
            severity: critical
          receiver: 'critical-alerts'
          group_wait: 10s
          repeat_interval: 10m
          
        - match:
            severity: warning
          receiver: 'warning-alerts'
          
        - match_re:
            service: unjucks.*
          receiver: 'unjucks-team'
          
        - match:
            component: infrastructure
          receiver: 'platform-team'
          
    receivers:
      - name: 'default-receiver'
        email_configs:
          - to: 'oncall@company.com'
            subject: '[ALERT] {{ .GroupLabels.alertname }}'
            body: |
              Alert: {{ .GroupLabels.alertname }}
              Severity: {{ .GroupLabels.severity }}
              
              {{ range .Alerts }}
              - {{ .Annotations.summary }}
                {{ .Annotations.description }}
              {{ end }}
              
      - name: 'critical-alerts'
        email_configs:
          - to: 'critical-alerts@company.com'
            subject: '[CRITICAL] {{ .GroupLabels.alertname }}'
            body: |
              🚨 CRITICAL ALERT 🚨
              
              Alert: {{ .GroupLabels.alertname }}
              Time: {{ .GroupLabels.startsAt }}
              
              {{ range .Alerts }}
              Summary: {{ .Annotations.summary }}
              Description: {{ .Annotations.description }}
              Instance: {{ .Labels.instance }}
              {{ end }}
              
        slack_configs:
          - api_url: '${SLACK_WEBHOOK_URL}'
            channel: '#critical-alerts'
            title: '🚨 Critical Alert: {{ .GroupLabels.alertname }}'
            text: |
              {{ range .Alerts }}
              *Summary:* {{ .Annotations.summary }}
              *Description:* {{ .Annotations.description }}
              *Instance:* {{ .Labels.instance }}
              *Time:* {{ .StartsAt.Format "2006-01-02 15:04:05 UTC" }}
              {{ end }}
            color: 'danger'
            
        pagerduty_configs:
          - service_key: '${PAGERDUTY_SERVICE_KEY}'
            description: '{{ .GroupLabels.alertname }} - {{ .Annotations.summary }}'
            
      - name: 'warning-alerts'
        slack_configs:
          - api_url: '${SLACK_WEBHOOK_URL}'
            channel: '#alerts'
            title: '⚠️ Warning: {{ .GroupLabels.alertname }}'
            text: |
              {{ range .Alerts }}
              *Summary:* {{ .Annotations.summary }}
              *Description:* {{ .Annotations.description }}
              {{ end }}
            color: 'warning'
            
      - name: 'unjucks-team'
        email_configs:
          - to: 'unjucks-team@company.com'
            subject: '[Unjucks Alert] {{ .GroupLabels.alertname }}'
            
      - name: 'platform-team'
        email_configs:
          - to: 'platform-team@company.com'
            subject: '[Infrastructure Alert] {{ .GroupLabels.alertname }}'
            
    inhibit_rules:
      - source_match:
          severity: 'critical'
        target_match:
          severity: 'warning'
        equal: ['alertname', 'instance']
        
      - source_match:
          alertname: 'ApplicationDown'
        target_match_re:
          alertname: 'High.*'
        equal: ['instance']

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: alertmanager
  namespace: monitoring
spec:
  replicas: 1
  selector:
    matchLabels:
      app: alertmanager
  template:
    metadata:
      labels:
        app: alertmanager
    spec:
      containers:
        - name: alertmanager
          image: prom/alertmanager:v0.25.0
          args:
            - '--config.file=/etc/alertmanager/alertmanager.yml'
            - '--storage.path=/alertmanager'
            - '--web.external-url=https://alertmanager.company.com'
          ports:
            - containerPort: 9093
          resources:
            requests:
              memory: "256Mi"
              cpu: "100m"
            limits:
              memory: "512Mi"
              cpu: "200m"
          env:
            - name: SMTP_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: alertmanager-secret
                  key: smtp-password
            - name: SLACK_WEBHOOK_URL
              valueFrom:
                secretKeyRef:
                  name: alertmanager-secret
                  key: slack-webhook
            - name: PAGERDUTY_SERVICE_KEY
              valueFrom:
                secretKeyRef:
                  name: alertmanager-secret
                  key: pagerduty-key
          volumeMounts:
            - name: alertmanager-config
              mountPath: /etc/alertmanager
            - name: alertmanager-storage
              mountPath: /alertmanager
      volumes:
        - name: alertmanager-config
          configMap:
            name: alertmanager-config
        - name: alertmanager-storage
          persistentVolumeClaim:
            claimName: alertmanager-pvc
```

## Distributed Tracing

### Jaeger Setup
```yaml
# jaeger-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: jaeger
  namespace: tracing
spec:
  replicas: 1
  selector:
    matchLabels:
      app: jaeger
  template:
    metadata:
      labels:
        app: jaeger
    spec:
      containers:
        - name: jaeger
          image: jaegertracing/all-in-one:1.39
          env:
            - name: COLLECTOR_ZIPKIN_HTTP_PORT
              value: "9411"
            - name: SPAN_STORAGE_TYPE
              value: elasticsearch
            - name: ES_SERVER_URLS
              value: "http://elasticsearch.logging:9200"
            - name: ES_USERNAME
              valueFrom:
                secretKeyRef:
                  name: elasticsearch-secret
                  key: username
            - name: ES_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: elasticsearch-secret
                  key: password
          ports:
            - containerPort: 16686 # UI
            - containerPort: 14268 # HTTP collector
            - containerPort: 14250 # gRPC collector
            - containerPort: 9411  # Zipkin compatible
          resources:
            requests:
              memory: "1Gi"
              cpu: "500m"
            limits:
              memory: "2Gi"
              cpu: "1000m"
```

### Application Tracing Integration
```javascript
// src/lib/tracing.js
const opentelemetry = require('@opentelemetry/api');
const { NodeSDK } = require('@opentelemetry/auto-instrumentations-node');
const { JaegerExporter } = require('@opentelemetry/exporter-jaeger');
const { Resource } = require('@opentelemetry/resources');
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');

// Configure the SDK
const sdk = new NodeSDK({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: 'unjucks',
    [SemanticResourceAttributes.SERVICE_VERSION]: process.env.APP_VERSION || '1.0.0',
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development',
  }),
  traceExporter: new JaegerExporter({
    endpoint: process.env.JAEGER_ENDPOINT || 'http://jaeger:14268/api/traces',
  }),
});

// Initialize the SDK
sdk.start();

// Custom tracing helpers
const tracer = opentelemetry.trace.getTracer('unjucks', '1.0.0');

const createSpan = (name, fn) => {
  return tracer.startActiveSpan(name, async (span) => {
    try {
      const result = await fn(span);
      span.setStatus({ code: opentelemetry.SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.recordException(error);
      span.setStatus({
        code: opentelemetry.SpanStatusCode.ERROR,
        message: error.message,
      });
      throw error;
    } finally {
      span.end();
    }
  });
};

module.exports = {
  tracer,
  createSpan,
};
```

## Health Checks & Status Pages

### Health Check Endpoint
```javascript
// src/routes/health.js
const express = require('express');
const { Pool } = require('pg');
const Redis = require('redis');
const router = express.Router();

const dbPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1, // Use minimal connections for health checks
});

const redisClient = Redis.createClient({
  url: process.env.REDIS_URL,
});

// Simple health check
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION || '1.0.0',
    uptime: process.uptime(),
  });
});

// Detailed health check with dependencies
router.get('/health/detailed', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION || '1.0.0',
    uptime: process.uptime(),
    checks: {},
  };

  // Database health check
  try {
    const start = Date.now();
    await dbPool.query('SELECT 1');
    health.checks.database = {
      status: 'healthy',
      responseTime: Date.now() - start,
    };
  } catch (error) {
    health.checks.database = {
      status: 'unhealthy',
      error: error.message,
    };
    health.status = 'degraded';
  }

  // Redis health check
  try {
    const start = Date.now();
    await redisClient.ping();
    health.checks.redis = {
      status: 'healthy',
      responseTime: Date.now() - start,
    };
  } catch (error) {
    health.checks.redis = {
      status: 'unhealthy',
      error: error.message,
    };
    health.status = 'degraded';
  }

  // File system health check
  try {
    const fs = require('fs').promises;
    await fs.access('/tmp', fs.constants.W_OK);
    health.checks.filesystem = {
      status: 'healthy',
    };
  } catch (error) {
    health.checks.filesystem = {
      status: 'unhealthy',
      error: error.message,
    };
    health.status = 'degraded';
  }

  const httpStatus = health.status === 'healthy' ? 200 : 503;
  res.status(httpStatus).json(health);
});

// Database-specific health check
router.get('/health/db', async (req, res) => {
  try {
    const result = await dbPool.query('SELECT NOW() as timestamp, version() as version');
    res.status(200).json({
      status: 'healthy',
      database: {
        timestamp: result.rows[0].timestamp,
        version: result.rows[0].version,
      },
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
    });
  }
});

// Redis-specific health check
router.get('/health/redis', async (req, res) => {
  try {
    const info = await redisClient.info('server');
    res.status(200).json({
      status: 'healthy',
      redis: {
        info: info.split('\r\n').reduce((acc, line) => {
          const [key, value] = line.split(':');
          if (key && value) acc[key] = value;
          return acc;
        }, {}),
      },
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
    });
  }
});

module.exports = router;
```

## Performance Testing & Monitoring

### Load Testing Setup
```bash
#!/bin/bash
# scripts/load-test.sh

# K6 load testing script
k6 run - <<EOF
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

export let errorRate = new Rate('errors');

export let options = {
  stages: [
    { duration: '2m', target: 100 },   // Ramp up
    { duration: '5m', target: 100 },   // Stay at 100 users
    { duration: '2m', target: 200 },   // Ramp up to 200 users
    { duration: '5m', target: 200 },   // Stay at 200 users
    { duration: '2m', target: 0 },     // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],  // 95% of requests under 500ms
    http_req_failed: ['rate<0.01'],    // Error rate under 1%
    errors: ['rate<0.01'],
  },
};

export default function() {
  // Health check
  let healthResponse = http.get('https://unjucks.company.com/health');
  check(healthResponse, {
    'health check status is 200': (r) => r.status === 200,
  });
  
  // Template listing
  let listResponse = http.get('https://unjucks.company.com/api/templates', {
    headers: { 'Authorization': 'Bearer ${TEST_TOKEN}' },
  });
  check(listResponse, {
    'template list status is 200': (r) => r.status === 200,
    'template list response time < 500ms': (r) => r.timings.duration < 500,
  });
  
  errorRate.add(listResponse.status !== 200);
  
  sleep(1);
}
EOF
```

## Compliance & Audit Logging

### SIEM Integration
```javascript
// src/lib/siem-integration.js
const axios = require('axios');
const { logger } = require('./logger');

class SIEMIntegration {
  constructor() {
    this.webhookUrl = process.env.SIEM_WEBHOOK_URL;
    this.apiKey = process.env.SIEM_API_KEY;
    this.enabled = process.env.SIEM_ENABLED === 'true';
    this.batchSize = parseInt(process.env.SIEM_BATCH_SIZE || '100');
    this.flushInterval = parseInt(process.env.SIEM_FLUSH_INTERVAL || '60000');
    
    this.eventBuffer = [];
    this.startBatchProcessor();
  }
  
  sendEvent(event) {
    if (!this.enabled) return;
    
    const siemEvent = {
      timestamp: new Date().toISOString(),
      source: 'unjucks',
      environment: process.env.NODE_ENV,
      ...event,
    };
    
    this.eventBuffer.push(siemEvent);
    
    if (this.eventBuffer.length >= this.batchSize) {
      this.flushEvents();
    }
  }
  
  startBatchProcessor() {
    if (!this.enabled) return;
    
    setInterval(() => {
      if (this.eventBuffer.length > 0) {
        this.flushEvents();
      }
    }, this.flushInterval);
  }
  
  async flushEvents() {
    if (this.eventBuffer.length === 0) return;
    
    const events = [...this.eventBuffer];
    this.eventBuffer = [];
    
    try {
      await axios.post(this.webhookUrl, {
        events,
      }, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 5000,
      });
      
      logger.debug(`Sent ${events.length} events to SIEM`);
    } catch (error) {
      logger.error('Failed to send events to SIEM:', error);
      // Put events back in buffer for retry
      this.eventBuffer.unshift(...events);
    }
  }
  
  logSecurityEvent(type, details, req) {
    this.sendEvent({
      event_type: 'security',
      security_event_type: type,
      user_id: req.user?.id,
      tenant_id: req.tenant?.id,
      ip_address: req.ip,
      user_agent: req.get('User-Agent'),
      correlation_id: req.correlation_id,
      details,
    });
  }
  
  logAuditEvent(action, resource, details, req) {
    this.sendEvent({
      event_type: 'audit',
      action,
      resource,
      user_id: req.user?.id,
      tenant_id: req.tenant?.id,
      ip_address: req.ip,
      correlation_id: req.correlation_id,
      details,
    });
  }
  
  logComplianceEvent(regulation, requirement, status, details) {
    this.sendEvent({
      event_type: 'compliance',
      regulation,
      requirement,
      status,
      details,
    });
  }
}

module.exports = new SIEMIntegration();
```

---

**Next Steps**:
- Configure monitoring alerts for your specific SLAs
- Set up automated runbook execution for common issues  
- Implement custom dashboards for business metrics
- Configure log retention policies based on compliance requirements
- Test alerting and escalation procedures

**Related Documents**:
- [Incident Response Runbook](../runbooks/incident-response.md)
- [Production Deployment Guide](../deployment/production-deployment-guide.md)
- [Infrastructure Requirements](../deployment/infrastructure-requirements.md)