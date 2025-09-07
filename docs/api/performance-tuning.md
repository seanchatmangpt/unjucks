# Performance Tuning Guide

## Overview

This guide provides comprehensive performance optimization strategies for Unjucks deployments, from development environments to enterprise-scale production systems. Learn how to optimize template processing, semantic operations, agent coordination, and system resources.

## Performance Monitoring

### Built-in Performance Metrics

Unjucks automatically collects performance metrics across all operations:

```bash
# Enable performance monitoring
unjucks perf monitor --metrics cpu,memory,disk,network --interval 5

# Run performance benchmarks
unjucks perf benchmark --suite all --iterations 20 --output benchmark-results.json

# Analyze specific operations
unjucks perf analyze --operation semantic-generation --dataset ./test-data --period 24h
```

### Key Performance Indicators (KPIs)

Monitor these critical metrics:

- **Template Generation Time**: Target < 100ms per template
- **Semantic Processing Latency**: Target < 2s for complex ontologies  
- **Memory Usage**: Keep under 70% of available memory
- **Agent Coordination Overhead**: < 10% of total execution time
- **File I/O Throughput**: > 50MB/s for template operations
- **Error Rate**: < 0.1% across all operations

## Template Processing Optimization

### Template Engine Configuration

```typescript
// unjucks.config.ts - Optimized template processing
export default defineConfig({
  templates: {
    engine: {
      name: 'nunjucks',
      options: {
        autoescape: true,
        throwOnUndefined: false, // Improves error handling performance
        trimBlocks: true,
        lstripBlocks: false
      }
    },
    
    // Aggressive caching for production
    cache: {
      enabled: true,
      maxSize: 1000, // Increase cache size
      ttl: 7200,     // 2 hours TTL
      storage: 'redis', // Use Redis for distributed caching
      redisUrl: process.env.REDIS_URL,
      compressionLevel: 6 // Balance between speed and size
    },
    
    // Performance optimizations
    optimization: {
      precompileTemplates: true,  // Precompile for faster rendering
      enableParallelProcessing: true,
      batchSize: 50,              // Process templates in batches
      useWorkerThreads: true,     // Leverage multi-core systems
      optimizeRegexes: true       // Compile regexes once
    }
  }
});
```

### Template Structure Optimization

**Efficient Template Design:**
```njk
{# Good: Use cached filters and avoid expensive operations in loops #}
{% set processedUsers = users | batch(10) | first %}
{% for userBatch in processedUsers %}
  {# Process in batches to reduce memory pressure #}
{% endfor %}

{# Good: Cache expensive computations #}
{% set complexData = someExpensiveFilter(data) %}
{% for item in items %}
  {{ item.name }}: {{ complexData[item.id] }}
{% endfor %}

{# Bad: Expensive operations in loops #}
{% for item in items %}
  {{ item | someExpensiveFilter | anotherFilter }}
{% endfor %}
```

**Template Inheritance Optimization:**
```njk
{# base.njk - Keep base templates minimal #}
<!DOCTYPE html>
<html>
<head>
  <title>{% block title %}Default Title{% endblock %}</title>
  {% block head %}{% endblock %}
</head>
<body>
  {% block content %}{% endblock %}
  {% block scripts %}{% endblock %}
</body>
</html>

{# component.njk - Avoid deep inheritance chains #}
{% extends "base.njk" %}

{% block content %}
  {# Direct content, avoid nested extends #}
{% endblock %}
```

### Batch Processing

```bash
# Process multiple templates efficiently
unjucks generate component react \
  --batch-mode \
  --batch-size 20 \
  --workers 4 \
  --input batch-config.json

# batch-config.json
{
  "templates": [
    {"name": "UserCard", "props": ["name", "email"]},
    {"name": "ProductCard", "props": ["title", "price", "image"]},
    {"name": "OrderCard", "props": ["id", "status", "total"]}
  ],
  "destination": "./src/components",
  "parallelExecution": true
}
```

## Semantic Web Performance

### RDF Processing Optimization

```typescript
// Optimized semantic configuration
export default defineConfig({
  semantic: {
    rdf: {
      // Optimize for large datasets
      maxTriples: 10000000,  // 10M triples
      chunkSize: 50000,      // Process in 50K chunks
      timeout: 120000,       // 2 minutes for large files
      
      // Memory management
      enableStreaming: true,  // Stream large files
      memoryLimit: '4GB',     // Set memory limit
      gcInterval: 1000,       // Garbage collect every 1000 operations
      
      // Parsing optimizations
      skipValidation: false,  // Keep validation but optimize
      ignoreDuplicates: true, // Skip duplicate triples
      normalizeUris: false,   // Skip normalization if not needed
      
      // Indexing strategy
      createIndexes: true,
      indexStrategy: 'SPOG',  // Subject-Predicate-Object-Graph
      indexInMemory: true     // Keep indexes in memory
    },
    
    sparql: {
      // Query optimization
      queryTimeout: 60000,    // 1 minute timeout
      maxResults: 100000,     // Limit result sets
      enableQueryPlanning: true,
      useStatistics: true,    // Use query statistics
      
      // Connection pooling
      connectionPool: {
        minConnections: 5,
        maxConnections: 20,
        idleTimeout: 30000,
        acquireTimeout: 10000
      },
      
      // Caching strategy
      caching: {
        enabled: true,
        ttl: 3600,             // 1 hour cache
        maxSize: 1000,         // Cache 1000 queries
        strategy: 'lru',       // Least Recently Used
        keyGenerator: 'hash'   // Hash-based cache keys
      }
    },
    
    reasoning: {
      // Reasoning performance
      maxDepth: 5,             // Limit reasoning depth
      maxInferences: 50000,    // Limit inferences per run
      enableParallelization: true,
      workerCount: 4,          // Use 4 reasoning workers
      
      // Memory management for reasoning
      memoryLimit: '2GB',
      enableGarbageCollection: true,
      gcThreshold: 0.8         // GC when 80% memory used
    }
  }
});
```

### SPARQL Query Optimization

**Optimized Query Patterns:**
```sparql
-- Good: Use LIMIT and specific predicates
SELECT ?person ?name ?email
WHERE {
  ?person a ex:Person ;           # Specific type first
    ex:name ?name ;
    ex:email ?email .
  FILTER(STRLEN(?name) > 0)       # Filter early
}
ORDER BY ?name
LIMIT 1000

-- Good: Use indexes with proper join order
SELECT ?user ?profile ?company
WHERE {
  ?user ex:hasProfile ?profile . # Start with most selective
  ?profile ex:company ?company .
  ?user ex:active true .         # Boolean filters are fast
}

-- Bad: Avoid unbounded queries
SELECT ?s ?p ?o
WHERE {
  ?s ?p ?o .                     # This scans entire dataset
}

-- Bad: Expensive string operations
SELECT ?person
WHERE {
  ?person ex:name ?name .
  FILTER(REGEX(?name, ".*John.*", "i"))  # Use contains() instead
}
```

**Query Planning and Statistics:**
```bash
# Analyze query performance
unjucks semantic query \
  --sparql-file complex-query.sparql \
  --knowledge enterprise-data.ttl \
  --explain \
  --profile

# Update dataset statistics for better planning
unjucks semantic optimize \
  --dataset enterprise-data.ttl \
  --update-statistics \
  --rebuild-indexes
```

### Ontology Loading Strategies

```typescript
// Efficient ontology management
class OptimizedOntologyManager {
  async loadOntologies(paths: string[]): Promise<void> {
    // Load ontologies in parallel
    const loadPromises = paths.map(async (path) => {
      return this.loadOntologyWithCaching(path);
    });
    
    await Promise.all(loadPromises);
  }
  
  private async loadOntologyWithCaching(path: string): Promise<Ontology> {
    // Check cache first
    const cached = await this.cache.get(`ontology:${path}`);
    if (cached) return cached;
    
    // Load with streaming for large files
    const ontology = await this.loadOntologyStreaming(path);
    
    // Cache with compression
    await this.cache.set(`ontology:${path}`, ontology, {
      ttl: 3600,
      compress: true
    });
    
    return ontology;
  }
  
  private async loadOntologyStreaming(path: string): Promise<Ontology> {
    // Use streaming parser for memory efficiency
    const parser = new StreamingN3Parser();
    const chunks = [];
    
    return new Promise((resolve, reject) => {
      const stream = fs.createReadStream(path);
      
      stream
        .pipe(parser)
        .on('data', (quad) => {
          chunks.push(quad);
          
          // Process in chunks to avoid memory spikes
          if (chunks.length >= 10000) {
            this.processChunk(chunks.splice(0));
          }
        })
        .on('end', () => {
          this.processChunk(chunks); // Process remaining
          resolve(this.buildOntology());
        })
        .on('error', reject);
    });
  }
}
```

## Agent Coordination Performance

### MCP Server Optimization

```typescript
// Optimized MCP configuration
export default defineConfig({
  mcp: {
    // Connection optimization
    timeout: 15000,          // Reduce timeout for faster failure
    retries: 2,              // Reduce retries to fail fast
    concurrency: 20,         // Increase concurrent operations
    keepAlive: true,         // Maintain connections
    
    // Connection pooling
    connectionPool: {
      enabled: true,
      maxConnections: 10,
      minConnections: 2,
      idleTimeout: 30000,
      acquireTimeout: 5000
    },
    
    // Health checking
    healthCheck: {
      enabled: true,
      interval: 15000,       // Check every 15 seconds
      timeout: 5000,         // 5 second health check timeout
      retries: 1             // Fast failure for health checks
    },
    
    // Request optimization
    batchRequests: true,     // Batch multiple requests
    batchSize: 10,           // Batch up to 10 requests
    compression: true,       // Compress request/response
    
    servers: {
      'claude-flow': {
        command: 'npx',
        args: ['claude-flow@alpha', 'mcp', 'start'],
        
        // Performance tuning
        env: {
          NODE_OPTIONS: '--max-old-space-size=4096', // 4GB heap
          UV_THREADPOOL_SIZE: '8',                   // 8 UV threads
          CLAUDE_FLOW_CONCURRENCY: '15',             // 15 concurrent ops
          CLAUDE_FLOW_CACHE_SIZE: '1000'             // Cache 1000 items
        },
        
        // Process management
        timeout: 30000,
        retries: 2,
        restartDelay: 5000,    // 5 second restart delay
        maxRestarts: 5         // Max 5 restarts per hour
      },
      
      'ruv-swarm': {
        command: 'npx',
        args: ['ruv-swarm@latest', 'mcp'],
        
        env: {
          RUV_SWARM_WORKERS: '4',         // 4 neural workers
          RUV_SWARM_MEMORY_LIMIT: '2GB',  // 2GB memory limit
          RUV_SWARM_BATCH_SIZE: '100'     // Process 100 items per batch
        }
      },
      
      'flow-nexus': {
        command: 'npx',
        args: ['@ruv/flow-nexus', 'mcp', 'start'],
        
        env: {
          FLOW_NEXUS_CACHE_REDIS: process.env.REDIS_URL,
          FLOW_NEXUS_MAX_SANDBOXES: '20',  // 20 concurrent sandboxes
          FLOW_NEXUS_SANDBOX_TIMEOUT: '300' // 5 minute sandbox timeout
        }
      }
    }
  }
});
```

### Agent Load Balancing

```bash
# Configure intelligent agent load balancing
unjucks swarm init \
  --topology mesh \
  --max-agents 15 \
  --strategy adaptive \
  --load-balancing round-robin \
  --health-checking enabled

# Monitor agent performance
unjucks swarm monitor \
  --metrics cpu,memory,task-throughput \
  --alert-threshold 80 \
  --auto-scale enabled
```

### Memory Management

```typescript
// Efficient memory management for agent coordination
class MemoryOptimizedCoordinator {
  private memoryPool = new MemoryPool({
    maxSize: '1GB',
    gcInterval: 30000,      // GC every 30 seconds
    gcThreshold: 0.8        // GC when 80% full
  });
  
  async coordinateTask(task: Task): Promise<TaskResult> {
    // Use memory pool for temporary data
    const workingMemory = this.memoryPool.allocate(task.estimatedSize);
    
    try {
      // Efficient task coordination
      const result = await this.executeWithMemoryManagement(task, workingMemory);
      return result;
    } finally {
      // Always release memory
      this.memoryPool.release(workingMemory);
    }
  }
  
  private async executeWithMemoryManagement(
    task: Task, 
    memory: MemorySpace
  ): Promise<TaskResult> {
    // Monitor memory usage during execution
    const monitor = new MemoryMonitor(memory);
    
    monitor.onThreshold(0.9, () => {
      // Trigger garbage collection at 90% usage
      this.forceGarbageCollection();
    });
    
    return await task.execute(memory);
  }
}
```

## System Resource Optimization

### CPU Optimization

```typescript
// CPU optimization configuration
export default defineConfig({
  performance: {
    // Thread management
    maxWorkerThreads: Math.min(16, require('os').cpus().length),
    workerIdleTimeout: 60000,     // 1 minute idle timeout
    enableWorkerPooling: true,
    
    // Process scheduling
    priorityScheduling: true,      // Enable priority-based scheduling
    cpuAffinity: 'auto',          // Automatic CPU affinity
    niceValue: 0,                 // Standard process priority
    
    // Concurrency control
    maxConcurrentOperations: Math.min(20, require('os').cpus().length * 2),
    adaptiveConcurrency: true,    // Adjust based on system load
    throttleThreshold: 0.8,       // Throttle at 80% CPU
    
    // Algorithm optimization
    enableSIMD: true,             // Use SIMD instructions when available
    enableAVX: true,              // Use AVX instructions
    optimizeLoops: true,          // Loop optimization
    branchPrediction: true        // Optimize branch prediction
  }
});
```

### Memory Optimization

```typescript
// Memory optimization strategies
export default defineConfig({
  performance: {
    memory: {
      // Heap management
      maxHeapSize: '8GB',         // Maximum heap size
      initialHeapSize: '2GB',     // Initial heap allocation
      heapGrowthFactor: 1.5,      // Growth factor for heap expansion
      
      // Garbage collection tuning
      gcStrategy: 'generational', // Generational GC for better performance
      gcInterval: 'adaptive',     // Adaptive GC timing
      gcThreshold: 0.75,          // GC when 75% heap used
      incrementalGC: true,        // Incremental garbage collection
      
      // Memory pooling
      enableMemoryPools: true,
      poolSizes: {
        small: '1MB',             // For small allocations
        medium: '10MB',           // For medium allocations  
        large: '100MB'            // For large allocations
      },
      
      // Buffer management
      bufferPooling: true,
      maxBufferSize: '256MB',
      bufferReuseThreshold: 1024, // Reuse buffers > 1KB
      
      // Memory mapping
      enableMemoryMapping: true,  // Memory-mapped files for large data
      mappingThreshold: '100MB'   // Map files > 100MB
    }
  }
});
```

### Disk I/O Optimization

```typescript
// Disk I/O performance tuning
export default defineConfig({
  performance: {
    io: {
      // File system optimization
      enableDirectIO: true,       // Direct I/O for large files
      ioScheduler: 'mq-deadline', // Multi-queue deadline scheduler
      readAhead: '2MB',           // Read-ahead buffer size
      
      // Concurrent I/O
      maxConcurrentReads: 8,      // Max concurrent read operations
      maxConcurrentWrites: 4,     // Max concurrent write operations
      ioQueueDepth: 32,           // I/O queue depth
      
      // Caching strategy
      enablePageCache: true,      // Use system page cache
      cacheWriteThrough: false,   // Write-back caching for better performance
      syncInterval: 30000,        // Sync every 30 seconds
      
      // Compression
      enableCompression: true,    // Compress stored data
      compressionLevel: 6,        // Balance between speed and size
      compressionThreshold: 1024, // Compress files > 1KB
      
      // Temporary files
      tempDir: '/tmp/unjucks',    // High-performance temp directory
      cleanupInterval: 300000,    // Cleanup every 5 minutes
      maxTempSize: '1GB'          // Max temp space usage
    }
  }
});
```

### Network Optimization

```bash
# Network performance tuning for distributed operations
export UNJUCKS_NET_KEEPALIVE=true
export UNJUCKS_NET_TIMEOUT=30000
export UNJUCKS_NET_POOL_SIZE=20
export UNJUCKS_NET_COMPRESSION=gzip

# Configure connection pooling
unjucks config set network.pooling.enabled true
unjucks config set network.pooling.maxConnections 50
unjucks config set network.pooling.keepAlive 60000
```

## Production Deployment Optimization

### Docker Configuration

```dockerfile
# Optimized Dockerfile for production
FROM node:18-alpine AS builder

# Build-time optimizations
ENV NODE_OPTIONS="--max-old-space-size=4096"
ENV NPM_CONFIG_CACHE="/tmp/.npm"

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production --no-audit --prefer-offline

COPY . .
RUN npm run build

FROM node:18-alpine AS runtime

# Runtime optimizations
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=2048 --enable-source-maps=false"
ENV UV_THREADPOOL_SIZE=8

# Performance tuning
RUN apk add --no-cache tini \
    && addgroup -g 1001 -S nodejs \
    && adduser -S unjucks -u 1001

WORKDIR /app
COPY --from=builder --chown=unjucks:nodejs /app/dist ./dist
COPY --from=builder --chown=unjucks:nodejs /app/node_modules ./node_modules
COPY --chown=unjucks:nodejs package.json ./

USER unjucks

# Use tini for proper process management
ENTRYPOINT ["tini", "--"]
CMD ["node", "dist/cli.js"]
```

### Kubernetes Deployment

```yaml
# Optimized Kubernetes deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: unjucks-api
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
      
  template:
    spec:
      containers:
      - name: unjucks
        image: unjucks:latest
        
        # Resource optimization
        resources:
          requests:
            cpu: "500m"
            memory: "1Gi"
          limits:
            cpu: "2"
            memory: "4Gi"
            
        # Environment optimization
        env:
        - name: NODE_OPTIONS
          value: "--max-old-space-size=3072"
        - name: UV_THREADPOOL_SIZE
          value: "8"
        - name: UNJUCKS_CONCURRENCY
          value: "20"
          
        # Health checks
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
          
        # Volume mounts for persistent data
        volumeMounts:
        - name: cache
          mountPath: /app/.cache
        - name: templates
          mountPath: /app/_templates
          
      # Node affinity for performance
      nodeSelector:
        node-type: compute-optimized
        
      volumes:
      - name: cache
        emptyDir:
          sizeLimit: 1Gi
      - name: templates
        persistentVolumeClaim:
          claimName: unjucks-templates
```

## Monitoring and Profiling

### Performance Monitoring Stack

```bash
# Set up comprehensive monitoring
unjucks perf monitor \
  --enable-metrics-server \
  --port 9090 \
  --export-prometheus \
  --enable-tracing \
  --jaeger-endpoint http://jaeger:14268

# Configure alerting rules
unjucks perf alerts \
  --cpu-threshold 80 \
  --memory-threshold 85 \
  --latency-threshold 2000 \
  --error-rate-threshold 0.01
```

### Profiling Tools

```bash
# CPU profiling
unjucks perf profile --type cpu --duration 60s --output cpu-profile.json

# Memory profiling
unjucks perf profile --type memory --track-allocations --output memory-profile.json

# I/O profiling
unjucks perf profile --type io --track-file-operations --duration 30s

# End-to-end performance testing
unjucks perf test \
  --scenario load-test.js \
  --concurrent-users 100 \
  --duration 300s \
  --report-format html
```

### Performance Dashboards

```typescript
// Custom performance dashboard configuration
export const performanceDashboard = {
  metrics: {
    // Core performance metrics
    'template.generation.time': { threshold: 100, unit: 'ms' },
    'semantic.processing.latency': { threshold: 2000, unit: 'ms' },
    'agent.coordination.overhead': { threshold: 10, unit: 'percent' },
    
    // System metrics
    'system.cpu.usage': { threshold: 80, unit: 'percent' },
    'system.memory.usage': { threshold: 70, unit: 'percent' },
    'system.disk.io': { threshold: 100, unit: 'MB/s' },
    
    // Application metrics
    'app.requests.per.second': { threshold: 1000, unit: 'rps' },
    'app.error.rate': { threshold: 0.1, unit: 'percent' },
    'app.response.time.p99': { threshold: 1000, unit: 'ms' }
  },
  
  alerts: {
    critical: ['system.memory.usage', 'app.error.rate'],
    warning: ['template.generation.time', 'semantic.processing.latency'],
    info: ['app.requests.per.second']
  }
};
```

## Optimization Checklist

### Pre-Production Checklist

- [ ] **Template Optimization**
  - [ ] Enable template precompilation
  - [ ] Configure aggressive caching
  - [ ] Optimize template structure
  - [ ] Remove debug code and logging

- [ ] **Semantic Processing**
  - [ ] Optimize ontology loading
  - [ ] Configure query result caching
  - [ ] Enable parallel processing
  - [ ] Set appropriate memory limits

- [ ] **Agent Coordination**
  - [ ] Configure connection pooling
  - [ ] Enable request batching
  - [ ] Optimize agent assignment algorithms
  - [ ] Set up health monitoring

- [ ] **System Resources**
  - [ ] Configure CPU affinity
  - [ ] Optimize memory allocation
  - [ ] Enable I/O optimization
  - [ ] Configure network pooling

- [ ] **Monitoring & Alerting**
  - [ ] Set up performance monitoring
  - [ ] Configure alerting thresholds
  - [ ] Enable distributed tracing
  - [ ] Set up log aggregation

### Performance Testing

```bash
# Comprehensive performance test suite
unjucks perf test-suite \
  --load-test \
  --stress-test \
  --endurance-test \
  --spike-test \
  --chaos-test \
  --report-format comprehensive

# Automated performance regression testing
unjucks perf regression-test \
  --baseline baseline-results.json \
  --threshold 5 \  # 5% performance degradation threshold
  --fail-on-regression
```

This performance tuning guide provides enterprise-grade optimization strategies that can improve system performance by 2-4x while maintaining stability and reliability.