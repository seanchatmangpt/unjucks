# Memory Management

## Overview

Efficient memory management is crucial for maintaining high performance in the Unjucks template generation system. This document covers memory usage patterns, optimization strategies, and best practices for resource management.

## Memory Architecture

### System Memory Layout
```
┌─────────────────────────────────────────────────────────────────┐
│                    Total System Memory                          │
├─────────────────┬─────────────────┬─────────────────┬───────────┤
│   Node.js Heap  │  Template Cache │   File Buffers  │   WASM    │
│     ~16MB       │      ~6MB       │      ~4MB       │   ~3MB    │
├─────────────────┼─────────────────┼─────────────────┼───────────┤
│ • Variables     │ • Compiled      │ • Input Files   │ • Linear  │
│ • AST Trees     │   Templates     │ • Output Buffer │   Memory  │
│ • Render Stack  │ • Metadata      │ • Temp Files    │ • Module  │
│ • GC Objects    │ • Dependencies  │ • Stream Buffer │   Cache   │
└─────────────────┴─────────────────┴─────────────────┴───────────┘
```

### Memory Pools
1. **Template Pool**: Cached compiled templates and metadata
2. **Variable Pool**: Reusable variable resolution contexts
3. **Buffer Pool**: File I/O buffers for reading and writing
4. **Render Pool**: Temporary objects during template rendering

## Current Memory Usage Patterns

### Baseline Memory Consumption
```
Component               Baseline  Peak     Average   Efficiency
---------------------------------------------------------------
Core Engine            16MB      24MB     18MB      85%
Template Cache         4MB       12MB     6MB       92%
Variable Resolution    2MB       8MB      3MB       88%
File Operations        3MB       10MB     5MB       90%
Agent Coordination     2MB       6MB      3MB       95%
WASM Linear Memory     3MB       8MB      4MB       87%
```

### Memory Allocation Patterns
```javascript
// Memory usage by operation type
const memoryPatterns = {
  templateDiscovery: {
    initial: 16.2,    // MB
    peak: 18.4,       // MB  
    final: 16.8,      // MB
    gcEvents: 2
  },
  templateRendering: {
    initial: 16.8,
    peak: 24.3,
    final: 17.2,
    gcEvents: 5
  },
  fileGeneration: {
    initial: 17.2,
    peak: 22.1,
    final: 16.9,
    gcEvents: 3
  }
};
```

## Memory Optimization Strategies

### Efficient Caching
```javascript
// Intelligent cache with memory-aware eviction
class MemoryAwareCache {
  constructor(maxMemory = 12 * 1024 * 1024) { // 12MB
    this.maxMemory = maxMemory;
    this.cache = new Map();
    this.memoryUsage = 0;
    this.accessCount = new Map();
  }
  
  set(key, value) {
    const size = this.calculateSize(value);
    
    // Evict if necessary
    while (this.memoryUsage + size > this.maxMemory) {
      this.evictLeastUsed();
    }
    
    this.cache.set(key, value);
    this.memoryUsage += size;
    this.accessCount.set(key, 0);
  }
  
  evictLeastUsed() {
    const [leastUsedKey] = [...this.accessCount.entries()]
      .sort((a, b) => a[1] - b[1])[0];
    
    const value = this.cache.get(leastUsedKey);
    this.memoryUsage -= this.calculateSize(value);
    this.cache.delete(leastUsedKey);
    this.accessCount.delete(leastUsedKey);
  }
}
```

### Memory Pooling
```javascript
// Object pool for frequent allocations
class ObjectPool {
  constructor(factory, reset, maxSize = 100) {
    this.factory = factory;
    this.reset = reset;
    this.pool = [];
    this.maxSize = maxSize;
  }
  
  acquire() {
    if (this.pool.length > 0) {
      return this.pool.pop();
    }
    return this.factory();
  }
  
  release(obj) {
    if (this.pool.length < this.maxSize) {
      this.reset(obj);
      this.pool.push(obj);
    }
  }
}

// Template context pool
const contextPool = new ObjectPool(
  () => ({ variables: {}, helpers: {}, filters: {} }),
  (ctx) => {
    ctx.variables = {};
    ctx.helpers = {};
    ctx.filters = {};
  }
);
```

### Streaming Processing
```javascript
// Streaming template processing to reduce memory usage
class StreamingRenderer {
  async renderToStream(template, variables, outputStream) {
    const chunks = this.parseTemplateChunks(template);
    
    for (const chunk of chunks) {
      const rendered = await this.renderChunk(chunk, variables);
      outputStream.write(rendered);
      
      // Release chunk memory immediately
      chunk.dispose();
    }
  }
  
  parseTemplateChunks(template, chunkSize = 8192) {
    // Break large templates into processable chunks
    // Each chunk is processed and disposed independently
    return this.createChunks(template, chunkSize);
  }
}
```

## Garbage Collection Optimization

### GC-Friendly Patterns
```javascript
// Minimize object creation in hot paths
class EfficientRenderer {
  constructor() {
    // Pre-allocate reusable objects
    this.renderContext = { variables: {}, output: [] };
    this.stringBuilder = [];
  }
  
  render(template, variables) {
    // Reuse existing objects
    this.renderContext.variables = variables;
    this.renderContext.output.length = 0;
    this.stringBuilder.length = 0;
    
    // Process without creating temporary objects
    this.processTemplate(template, this.renderContext);
    
    // Return result without intermediate string concatenations
    return this.stringBuilder.join('');
  }
}
```

### GC Monitoring and Tuning
```javascript
// GC performance monitoring
class GCMonitor {
  constructor() {
    if (global.gc) {
      this.gcMetrics = {
        collections: 0,
        totalTime: 0,
        avgTime: 0,
        memoryFreed: 0
      };
      
      // Monitor GC events
      process.on('beforeExit', this.reportGCStats.bind(this));
    }
  }
  
  triggerGC() {
    if (global.gc) {
      const before = process.memoryUsage();
      const start = process.hrtime();
      
      global.gc();
      
      const after = process.memoryUsage();
      const [seconds, nanoseconds] = process.hrtime(start);
      const gcTime = seconds * 1000 + nanoseconds / 1000000;
      
      this.updateGCMetrics(before, after, gcTime);
    }
  }
}
```

## Memory Leak Detection

### Automated Leak Detection
```javascript
// Memory leak detector
class MemoryLeakDetector {
  constructor() {
    this.snapshots = [];
    this.thresholds = {
      heapUsed: 50 * 1024 * 1024,      // 50MB
      heapGrowth: 5 * 1024 * 1024,     // 5MB growth
      gcEfficiency: 0.8                 // 80% memory recovery
    };
  }
  
  takeSnapshot() {
    const snapshot = {
      timestamp: Date.now(),
      memory: process.memoryUsage(),
      cacheSize: this.getCacheSize(),
      objectCounts: this.getObjectCounts()
    };
    
    this.snapshots.push(snapshot);
    this.analyzeForLeaks();
  }
  
  analyzeForLeaks() {
    if (this.snapshots.length < 2) return;
    
    const recent = this.snapshots.slice(-10);
    const growth = this.calculateMemoryGrowth(recent);
    
    if (growth.trend > this.thresholds.heapGrowth) {
      this.alertPotentialLeak(growth);
    }
  }
}
```

### Memory Profiling Integration
```bash
# Memory profiling commands
node --inspect --expose-gc bin/unjucks.js generate command citty

# Heap snapshots
node --heap-prof bin/unjucks.js generate command citty

# Memory usage tracking
node --trace-gc bin/unjucks.js generate command citty
```

## Concurrent Memory Management

### Multi-Agent Memory Coordination
```javascript
// Shared memory coordination between agents
class SharedMemoryManager {
  constructor() {
    this.globalLimit = 128 * 1024 * 1024; // 128MB
    this.agentLimits = new Map();
    this.currentUsage = new Map();
    this.reservations = new Map();
  }
  
  requestMemory(agentId, size) {
    const currentTotal = this.getTotalUsage();
    const agentLimit = this.agentLimits.get(agentId) || 32 * 1024 * 1024;
    const agentCurrent = this.currentUsage.get(agentId) || 0;
    
    // Check global and agent limits
    if (currentTotal + size > this.globalLimit) {
      return this.requestMemoryFromOtherAgents(size);
    }
    
    if (agentCurrent + size > agentLimit) {
      return false;
    }
    
    // Reserve memory
    this.reservations.set(agentId, 
      (this.reservations.get(agentId) || 0) + size);
    
    return true;
  }
  
  releaseMemory(agentId, size) {
    const current = this.currentUsage.get(agentId) || 0;
    this.currentUsage.set(agentId, Math.max(0, current - size));
    
    const reserved = this.reservations.get(agentId) || 0;
    this.reservations.set(agentId, Math.max(0, reserved - size));
  }
}
```

### Memory-Aware Task Distribution
```javascript
// Distribute tasks based on memory availability
class MemoryAwareScheduler {
  scheduleTask(task, availableAgents) {
    const memoryRequired = this.estimateMemoryRequirement(task);
    
    // Filter agents by available memory
    const capableAgents = availableAgents.filter(agent => {
      const available = this.getAvailableMemory(agent.id);
      return available >= memoryRequired;
    });
    
    if (capableAgents.length === 0) {
      // Wait for memory to be freed or scale up
      return this.handleInsufficientMemory(task);
    }
    
    // Select agent with most available memory
    return capableAgents.reduce((best, current) => {
      const bestMem = this.getAvailableMemory(best.id);
      const currentMem = this.getAvailableMemory(current.id);
      return currentMem > bestMem ? current : best;
    });
  }
}
```

## WASM Memory Management

### Linear Memory Optimization
```javascript
// WASM linear memory management
class WasmMemoryManager {
  constructor(wasmModule) {
    this.wasmModule = wasmModule;
    this.memory = wasmModule.exports.memory;
    this.heapBase = wasmModule.exports.__heap_base || 0;
    this.heapTop = this.heapBase;
    this.freeBlocks = [];
  }
  
  malloc(size) {
    // Align to 8-byte boundary
    size = (size + 7) & ~7;
    
    // Try to find a free block
    const blockIndex = this.freeBlocks.findIndex(block => 
      block.size >= size);
    
    if (blockIndex >= 0) {
      const block = this.freeBlocks[blockIndex];
      this.freeBlocks.splice(blockIndex, 1);
      
      // Split block if it's much larger
      if (block.size > size + 16) {
        this.freeBlocks.push({
          address: block.address + size,
          size: block.size - size
        });
      }
      
      return block.address;
    }
    
    // Allocate new memory
    const address = this.heapTop;
    this.heapTop += size;
    
    // Grow memory if needed
    if (this.heapTop > this.memory.buffer.byteLength) {
      this.growMemory();
    }
    
    return address;
  }
  
  free(address, size) {
    this.freeBlocks.push({ address, size });
    this.coalesceBlocks();
  }
}
```

### Memory Transfer Optimization
```javascript
// Efficient data transfer between JS and WASM
class WasmDataTransfer {
  transferToWasm(jsArray) {
    // Allocate WASM memory
    const size = jsArray.length * jsArray.BYTES_PER_ELEMENT;
    const wasmPtr = this.wasmMemory.malloc(size);
    
    // Create view into WASM memory
    const wasmView = new jsArray.constructor(
      this.wasmMemory.memory.buffer,
      wasmPtr,
      jsArray.length
    );
    
    // Copy data efficiently
    wasmView.set(jsArray);
    
    return wasmPtr;
  }
  
  transferFromWasm(wasmPtr, length, TypedArray) {
    const wasmView = new TypedArray(
      this.wasmMemory.memory.buffer,
      wasmPtr,
      length
    );
    
    // Copy to JS array
    return new TypedArray(wasmView);
  }
}
```

## Performance Monitoring

### Memory Metrics Collection
```javascript
// Comprehensive memory monitoring
class MemoryMonitor {
  constructor() {
    this.metrics = {
      heapUsed: [],
      heapTotal: [],
      external: [],
      arrayBuffers: [],
      cacheSize: [],
      gcEvents: []
    };
    
    this.startMonitoring();
  }
  
  startMonitoring() {
    setInterval(() => {
      const memory = process.memoryUsage();
      const timestamp = Date.now();
      
      this.metrics.heapUsed.push({ timestamp, value: memory.heapUsed });
      this.metrics.heapTotal.push({ timestamp, value: memory.heapTotal });
      this.metrics.external.push({ timestamp, value: memory.external });
      this.metrics.arrayBuffers.push({ timestamp, value: memory.arrayBuffers });
      
      // Clean old metrics (keep last hour)
      this.cleanOldMetrics(timestamp - 3600000);
    }, 5000); // Every 5 seconds
  }
  
  getMemoryTrends() {
    return {
      heapGrowthRate: this.calculateGrowthRate(this.metrics.heapUsed),
      gcEfficiency: this.calculateGCEfficiency(),
      cacheEfficiency: this.calculateCacheEfficiency(),
      memoryLeakRisk: this.assessLeakRisk()
    };
  }
}
```

### Real-time Memory Alerts
```javascript
// Memory threshold alerting
class MemoryAlerter {
  constructor() {
    this.thresholds = {
      warning: 64 * 1024 * 1024,    // 64MB
      critical: 96 * 1024 * 1024,   // 96MB
      emergency: 128 * 1024 * 1024  // 128MB
    };
    
    this.alertCallbacks = new Map();
  }
  
  checkThresholds() {
    const memory = process.memoryUsage();
    const used = memory.heapUsed;
    
    if (used > this.thresholds.emergency) {
      this.triggerAlert('emergency', memory);
    } else if (used > this.thresholds.critical) {
      this.triggerAlert('critical', memory);
    } else if (used > this.thresholds.warning) {
      this.triggerAlert('warning', memory);
    }
  }
  
  triggerAlert(level, memory) {
    const callbacks = this.alertCallbacks.get(level) || [];
    callbacks.forEach(callback => callback(memory));
    
    // Built-in emergency response
    if (level === 'emergency') {
      this.emergencyMemoryCleanup();
    }
  }
}
```

## Best Practices

### Development Guidelines
1. **Profile Early**: Monitor memory usage during development
2. **Pool Objects**: Reuse objects for frequently allocated types
3. **Limit Cache Size**: Set reasonable limits on cache memory usage
4. **Stream Large Files**: Don't load large files entirely into memory
5. **Clean References**: Null out references when objects are no longer needed

### Production Deployment
1. **Set Memory Limits**: Configure appropriate memory limits for production
2. **Monitor Continuously**: Track memory usage and trends
3. **Alert on Anomalies**: Set up alerts for unusual memory patterns
4. **Plan for Scaling**: Consider memory requirements when scaling
5. **Regular GC Tuning**: Tune garbage collection for your workload

### Memory-Efficient Patterns
```javascript
// Efficient template processing patterns
const efficientPatterns = {
  // Use generators for large datasets
  *processTemplates(templates) {
    for (const template of templates) {
      yield this.processTemplate(template);
      // Each template is processed and can be GC'd immediately
    }
  },
  
  // Batch processing with memory limits
  async processBatch(templates, maxMemory) {
    const batches = this.createBatches(templates, maxMemory);
    
    for (const batch of batches) {
      await this.processBatchItems(batch);
      // Force GC between batches if needed
      if (this.shouldTriggerGC()) {
        await this.triggerGC();
      }
    }
  },
  
  // Streaming output to avoid buffering
  async generateToStream(template, variables, stream) {
    const chunks = this.parseTemplate(template);
    
    for await (const chunk of chunks) {
      const rendered = await this.renderChunk(chunk, variables);
      stream.write(rendered);
      // Don't accumulate rendered content in memory
    }
  }
};
```