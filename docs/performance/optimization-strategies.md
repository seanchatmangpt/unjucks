# Optimization Strategies

## Overview

This document outlines comprehensive optimization strategies for maximizing performance in the Unjucks template generation system. It covers algorithmic optimizations, system-level improvements, and best practices for sustained high performance.

## Core Optimization Principles

### Performance-First Design Philosophy
```javascript
// Performance-oriented design patterns
const optimizationPrinciples = {
  measureFirst: {
    principle: "Always measure before optimizing",
    implementation: [
      "Profile operations to identify bottlenecks",
      "Establish performance baselines",
      "Use data-driven optimization decisions",
      "Validate optimization impact with metrics"
    ]
  },
  
  cacheEverything: {
    principle: "Cache at multiple levels for maximum efficiency",
    implementation: [
      "Template compilation caching",
      "Variable resolution caching", 
      "File system operation caching",
      "Network request caching"
    ]
  },
  
  parallelizeWhenPossible: {
    principle: "Leverage concurrency for independent operations",
    implementation: [
      "Parallel template processing",
      "Concurrent file operations",
      "Multi-agent coordination",
      "Asynchronous I/O operations"
    ]
  },
  
  minimizeAllocations: {
    principle: "Reduce memory allocations and garbage collection pressure",
    implementation: [
      "Object pooling for frequent allocations",
      "String interning for repeated strings",
      "Streaming processing for large datasets",
      "Efficient data structures"
    ]
  }
};
```

## Template Processing Optimizations

### Template Compilation Caching
```javascript
// Advanced template compilation cache with intelligent eviction
class AdvancedTemplateCache {
  constructor() {
    this.compiledTemplates = new Map();
    this.templateMetadata = new Map();
    this.accessCounts = new Map();
    this.lastAccess = new Map();
    this.maxCacheSize = 50 * 1024 * 1024; // 50MB
    this.currentCacheSize = 0;
  }
  
  compileAndCache(templatePath, templateContent, variables = {}) {
    const cacheKey = this.generateCacheKey(templatePath, variables);
    
    // Check cache first
    if (this.compiledTemplates.has(cacheKey)) {
      this.updateAccessMetrics(cacheKey);
      return this.compiledTemplates.get(cacheKey);
    }
    
    // Compile template
    const compiled = this.compileTemplate(templateContent, variables);
    
    // Calculate memory footprint
    const size = this.estimateTemplateSize(compiled);
    
    // Evict if necessary
    this.ensureCacheSpace(size);
    
    // Store in cache
    this.compiledTemplates.set(cacheKey, compiled);
    this.templateMetadata.set(cacheKey, {
      size,
      compilationTime: compiled.compilationTime,
      variableCount: Object.keys(variables).length
    });
    this.accessCounts.set(cacheKey, 1);
    this.lastAccess.set(cacheKey, Date.now());
    this.currentCacheSize += size;
    
    return compiled;
  }
  
  ensureCacheSpace(requiredSize) {
    while (this.currentCacheSize + requiredSize > this.maxCacheSize) {
      // Evict least recently used template
      const lru = this.findLRUTemplate();
      if (lru) {
        this.evictTemplate(lru);
      } else {
        break; // No templates to evict
      }
    }
  }
  
  findLRUTemplate() {
    let oldestAccess = Date.now();
    let lruKey = null;
    
    for (const [key, lastAccessTime] of this.lastAccess.entries()) {
      const accessCount = this.accessCounts.get(key) || 0;
      const score = lastAccessTime / Math.max(accessCount, 1); // Favor frequently used templates
      
      if (score < oldestAccess) {
        oldestAccess = score;
        lruKey = key;
      }
    }
    
    return lruKey;
  }
  
  // Precompile frequently used templates
  async precompileTemplates(templatePaths) {
    const precompilationPromises = templatePaths.map(async (path) => {
      try {
        const content = await this.loadTemplate(path);
        const commonVariables = await this.extractCommonVariables(path);
        
        for (const variables of commonVariables) {
          this.compileAndCache(path, content, variables);
        }
      } catch (error) {
        console.warn(`Failed to precompile template ${path}:`, error.message);
      }
    });
    
    await Promise.all(precompilationPromises);
    console.log(`Precompiled ${templatePaths.length} templates`);
  }
}
```

### Variable Resolution Optimization
```javascript
// Optimized variable resolution with dependency tracking
class OptimizedVariableResolver {
  constructor() {
    this.resolvedCache = new Map();
    this.dependencyGraph = new Map();
    this.resolutionOrder = [];
  }
  
  resolveVariables(variables, context = {}) {
    const cacheKey = this.generateVariableCacheKey(variables, context);
    
    if (this.resolvedCache.has(cacheKey)) {
      return this.resolvedCache.get(cacheKey);
    }
    
    // Build dependency graph
    this.buildDependencyGraph(variables);
    
    // Optimize resolution order
    const optimizedOrder = this.optimizeResolutionOrder();
    
    // Resolve in optimal order
    const resolved = this.resolveInOrder(variables, context, optimizedOrder);
    
    // Cache the result
    this.resolvedCache.set(cacheKey, resolved);
    
    return resolved;
  }
  
  buildDependencyGraph(variables) {
    this.dependencyGraph.clear();
    
    for (const [key, value] of Object.entries(variables)) {
      const dependencies = this.extractDependencies(value);
      this.dependencyGraph.set(key, dependencies);
    }
  }
  
  extractDependencies(value) {
    if (typeof value !== 'string') return [];
    
    // Extract variable references (e.g., {{otherVariable}})
    const dependencyPattern = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;
    const dependencies = [];
    let match;
    
    while ((match = dependencyPattern.exec(value)) !== null) {
      dependencies.push(match[1]);
    }
    
    return dependencies;
  }
  
  optimizeResolutionOrder() {
    // Topological sort for optimal resolution order
    const visited = new Set();
    const order = [];
    
    const visit = (variable) => {
      if (visited.has(variable)) return;
      
      visited.add(variable);
      const dependencies = this.dependencyGraph.get(variable) || [];
      
      // Visit dependencies first
      for (const dep of dependencies) {
        visit(dep);
      }
      
      order.push(variable);
    };
    
    for (const variable of this.dependencyGraph.keys()) {
      visit(variable);
    }
    
    return order;
  }
  
  // Parallel variable resolution for independent variables
  async resolveInParallel(variables, context) {
    const independentGroups = this.groupIndependentVariables(variables);
    const resolvedGroups = [];
    
    for (const group of independentGroups) {
      const groupPromises = group.map(async (varName) => {
        return {
          name: varName,
          value: await this.resolveSingleVariable(variables[varName], context)
        };
      });
      
      const groupResults = await Promise.all(groupPromises);
      resolvedGroups.push(groupResults);
      
      // Add resolved variables to context for next group
      for (const result of groupResults) {
        context[result.name] = result.value;
      }
    }
    
    return context;
  }
}
```

## I/O and File System Optimizations

### Batch File Operations
```javascript
// Optimized batch file operations with intelligent grouping
class BatchFileOperator {
  constructor() {
    this.pendingOperations = [];
    this.batchSize = 50;
    this.batchTimeout = 100; // ms
    this.batchTimer = null;
  }
  
  queueFileOperation(operation) {
    this.pendingOperations.push(operation);
    
    if (this.pendingOperations.length >= this.batchSize) {
      this.processBatch();
    } else if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => this.processBatch(), this.batchTimeout);
    }
  }
  
  async processBatch() {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    
    if (this.pendingOperations.length === 0) return;
    
    const batch = this.pendingOperations.splice(0);
    const groupedOperations = this.groupOperationsByType(batch);
    
    // Process each operation type optimally
    const results = await Promise.all([
      this.batchReadOperations(groupedOperations.read || []),
      this.batchWriteOperations(groupedOperations.write || []),
      this.batchDeleteOperations(groupedOperations.delete || []),
      this.batchStatOperations(groupedOperations.stat || [])
    ]);
    
    // Merge and return results
    return this.mergeResults(results);
  }
  
  async batchReadOperations(operations) {
    // Group by directory for optimal disk access
    const byDirectory = this.groupByDirectory(operations);
    const results = [];
    
    for (const [directory, ops] of byDirectory.entries()) {
      // Read files in directory sequentially for better cache locality
      for (const op of ops) {
        try {
          const content = await this.readFileOptimized(op.path);
          results.push({ operation: op, result: content });
        } catch (error) {
          results.push({ operation: op, error });
        }
      }
    }
    
    return results;
  }
  
  async batchWriteOperations(operations) {
    // Group by directory and create directories first
    const byDirectory = this.groupByDirectory(operations);
    const results = [];
    
    // Create all necessary directories first
    const directories = [...byDirectory.keys()];
    await this.ensureDirectoriesExist(directories);
    
    // Write files in parallel with concurrency limit
    const concurrency = 10;
    const semaphore = new Semaphore(concurrency);
    
    const writePromises = operations.map(async (op) => {
      const release = await semaphore.acquire();
      
      try {
        await this.writeFileOptimized(op.path, op.content);
        return { operation: op, success: true };
      } catch (error) {
        return { operation: op, error };
      } finally {
        release();
      }
    });
    
    return await Promise.all(writePromises);
  }
  
  async writeFileOptimized(filePath, content) {
    const fs = require('fs').promises;
    const path = require('path');
    
    // Use atomic write for consistency
    const tempPath = `${filePath}.tmp.${Date.now()}`;
    
    try {
      await fs.writeFile(tempPath, content, 'utf8');
      await fs.rename(tempPath, filePath);
    } catch (error) {
      // Clean up temp file if write failed
      try {
        await fs.unlink(tempPath);
      } catch {}
      throw error;
    }
  }
}
```

### Streaming Optimizations
```javascript
// Streaming template processing for large templates
class StreamingTemplateProcessor {
  constructor() {
    this.chunkSize = 64 * 1024; // 64KB chunks
    this.streamPool = [];
  }
  
  async processTemplateStream(templateStream, variables, outputStream) {
    const pipeline = require('stream').pipeline;
    const { Transform } = require('stream');
    
    // Create transformation stream
    const transformStream = new Transform({
      objectMode: false,
      transform: (chunk, encoding, callback) => {
        try {
          const processed = this.processChunk(chunk.toString(), variables);
          callback(null, processed);
        } catch (error) {
          callback(error);
        }
      }
    });
    
    // Pipeline for streaming processing
    return new Promise((resolve, reject) => {
      pipeline(
        templateStream,
        transformStream,
        outputStream,
        (error) => {
          if (error) reject(error);
          else resolve();
        }
      );
    });
  }
  
  processChunk(chunk, variables) {
    // Process template chunk without loading entire template
    // Handle partial template syntax across chunk boundaries
    return this.renderChunk(chunk, variables);
  }
  
  // Optimized memory usage for large file generation
  async generateLargeFile(template, variables, outputPath) {
    const fs = require('fs');
    const stream = fs.createWriteStream(outputPath);
    
    try {
      // Process template in chunks to avoid memory pressure
      const chunks = this.splitTemplateIntoChunks(template);
      
      for (const chunk of chunks) {
        const rendered = this.renderChunk(chunk, variables);
        
        // Write chunk and wait for drain if necessary
        if (!stream.write(rendered)) {
          await new Promise(resolve => stream.once('drain', resolve));
        }
      }
      
      // Ensure all data is written
      await new Promise((resolve, reject) => {
        stream.end((error) => {
          if (error) reject(error);
          else resolve();
        });
      });
      
    } catch (error) {
      // Clean up on error
      stream.destroy();
      await fs.promises.unlink(outputPath).catch(() => {});
      throw error;
    }
  }
}
```

## Memory and Resource Optimizations

### Object Pooling Strategy
```javascript
// Comprehensive object pooling for memory optimization
class ObjectPoolManager {
  constructor() {
    this.pools = new Map();
    this.poolConfigs = new Map();
  }
  
  createPool(name, factory, reset, maxSize = 100) {
    const pool = {
      objects: [],
      factory,
      reset,
      maxSize,
      created: 0,
      acquired: 0,
      released: 0,
      hits: 0,
      misses: 0
    };
    
    this.pools.set(name, pool);
    this.poolConfigs.set(name, { factory, reset, maxSize });
    
    return pool;
  }
  
  acquire(poolName) {
    const pool = this.pools.get(poolName);
    if (!pool) {
      throw new Error(`Pool '${poolName}' not found`);
    }
    
    pool.acquired++;
    
    if (pool.objects.length > 0) {
      pool.hits++;
      return pool.objects.pop();
    }
    
    // Create new object
    pool.misses++;
    pool.created++;
    return pool.factory();
  }
  
  release(poolName, obj) {
    const pool = this.pools.get(poolName);
    if (!pool) return;
    
    pool.released++;
    
    if (pool.objects.length < pool.maxSize) {
      // Reset object state
      pool.reset(obj);
      pool.objects.push(obj);
    }
    // If pool is full, let object be garbage collected
  }
  
  // Common object pools for template processing
  initializeCommonPools() {
    // Template context pool
    this.createPool(
      'templateContext',
      () => ({ variables: {}, helpers: {}, filters: {} }),
      (ctx) => {
        ctx.variables = {};
        ctx.helpers = {};
        ctx.filters = {};
      }
    );
    
    // String builder pool
    this.createPool(
      'stringBuilder',
      () => [],
      (arr) => arr.length = 0
    );
    
    // Variable resolution context pool
    this.createPool(
      'variableContext',
      () => ({ resolved: {}, dependencies: [], depth: 0 }),
      (ctx) => {
        ctx.resolved = {};
        ctx.dependencies.length = 0;
        ctx.depth = 0;
      }
    );
    
    // File buffer pool
    this.createPool(
      'fileBuffer',
      () => Buffer.alloc(64 * 1024), // 64KB buffers
      (buf) => buf.fill(0)
    );
  }
  
  getPoolStatistics() {
    const stats = {};
    
    for (const [name, pool] of this.pools.entries()) {
      stats[name] = {
        size: pool.objects.length,
        maxSize: pool.maxSize,
        created: pool.created,
        acquired: pool.acquired,
        released: pool.released,
        hitRate: pool.hits / (pool.hits + pool.misses),
        utilization: pool.objects.length / pool.maxSize
      };
    }
    
    return stats;
  }
}
```

### Garbage Collection Optimization
```javascript
// Advanced GC optimization strategies
class GarbageCollectionOptimizer {
  constructor() {
    this.gcMetrics = {
      collections: 0,
      totalTime: 0,
      avgTime: 0,
      memoryFreed: 0
    };
    
    this.gcThresholds = {
      memoryPressure: 0.85,      // 85% memory usage
      timeSinceLastGC: 30000,    // 30 seconds
      objectAllocationRate: 1000  // objects per second
    };
  }
  
  optimizeForWorkload(workloadType) {
    const optimizations = {
      'template-heavy': {
        // Optimize for frequent template compilation
        generationalGC: true,
        incrementalMarking: true,
        compactOnGC: false
      },
      
      'io-heavy': {
        // Optimize for file operations
        generationalGC: false,
        incrementalMarking: false,
        compactOnGC: true
      },
      
      'memory-intensive': {
        // Optimize for large data processing
        generationalGC: true,
        incrementalMarking: true,
        compactOnGC: true
      }
    };
    
    const config = optimizations[workloadType] || optimizations['template-heavy'];
    this.applyGCConfiguration(config);
  }
  
  applyGCConfiguration(config) {
    // Configure V8 GC settings
    const v8 = require('v8');
    
    if (config.generationalGC) {
      // Tune generational GC for object lifetime patterns
      v8.setFlagsFromString('--max-old-space-size=256');
      v8.setFlagsFromString('--max-new-space-size=32');
    }
    
    if (config.incrementalMarking) {
      v8.setFlagsFromString('--incremental-marking');
      v8.setFlagsFromString('--incremental-marking-wrappers');
    }
    
    if (config.compactOnGC) {
      v8.setFlagsFromString('--always-compact');
    }
  }
  
  // Intelligent GC triggering
  shouldTriggerGC() {
    const memory = process.memoryUsage();
    const memoryPressure = memory.heapUsed / memory.heapTotal;
    
    // Check memory pressure
    if (memoryPressure > this.gcThresholds.memoryPressure) {
      return 'memory_pressure';
    }
    
    // Check time since last GC
    if (this.timeSinceLastGC() > this.gcThresholds.timeSinceLastGC) {
      return 'time_threshold';
    }
    
    return null;
  }
  
  async performOptimizedGC() {
    if (!global.gc) {
      console.warn('GC not exposed. Run with --expose-gc flag.');
      return;
    }
    
    const beforeMemory = process.memoryUsage();
    const startTime = process.hrtime();
    
    // Perform garbage collection
    global.gc();
    
    const afterMemory = process.memoryUsage();
    const [seconds, nanoseconds] = process.hrtime(startTime);
    const gcTime = seconds * 1000 + nanoseconds / 1000000;
    
    // Update metrics
    this.gcMetrics.collections++;
    this.gcMetrics.totalTime += gcTime;
    this.gcMetrics.avgTime = this.gcMetrics.totalTime / this.gcMetrics.collections;
    this.gcMetrics.memoryFreed += (beforeMemory.heapUsed - afterMemory.heapUsed);
    
    console.log(`GC completed: ${gcTime.toFixed(2)}ms, freed ${(beforeMemory.heapUsed - afterMemory.heapUsed) / 1024 / 1024}MB`);
  }
}
```

## Algorithm-Level Optimizations

### Template Parsing Optimizations
```javascript
// Optimized template parsing with lookahead and caching
class OptimizedTemplateParser {
  constructor() {
    this.parseCache = new Map();
    this.syntaxPatterns = new Map();
    this.initializePatterns();
  }
  
  initializePatterns() {
    // Pre-compile regex patterns for better performance
    this.syntaxPatterns.set('variable', /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)\s*\}\}/g);
    this.syntaxPatterns.set('loop', /\{%\s*for\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+in\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*%\}/g);
    this.syntaxPatterns.set('condition', /\{%\s*if\s+([^%]+)\s*%\}/g);
    this.syntaxPatterns.set('include', /\{%\s*include\s+['"]([^'"]+)['"]\s*%\}/g);
  }
  
  parseTemplate(template, cacheKey = null) {
    if (cacheKey && this.parseCache.has(cacheKey)) {
      return this.parseCache.get(cacheKey);
    }
    
    const ast = this.buildAST(template);
    const optimized = this.optimizeAST(ast);
    
    if (cacheKey) {
      this.parseCache.set(cacheKey, optimized);
    }
    
    return optimized;
  }
  
  buildAST(template) {
    // Tokenize template efficiently
    const tokens = this.tokenizeEfficiently(template);
    
    // Build AST with optimized structure
    return this.buildOptimizedAST(tokens);
  }
  
  tokenizeEfficiently(template) {
    const tokens = [];
    let position = 0;
    
    // Use a single pass with lookahead for efficient tokenization
    while (position < template.length) {
      const result = this.scanNextToken(template, position);
      tokens.push(result.token);
      position = result.nextPosition;
    }
    
    return tokens;
  }
  
  scanNextToken(template, position) {
    // Efficient token scanning with minimal backtracking
    const char = template[position];
    
    if (char === '{') {
      // Check for template syntax
      if (template[position + 1] === '{') {
        return this.scanVariable(template, position);
      } else if (template[position + 1] === '%') {
        return this.scanDirective(template, position);
      }
    }
    
    // Scan text token
    return this.scanText(template, position);
  }
  
  optimizeAST(ast) {
    // Perform AST optimizations
    const optimizations = [
      this.constantFolding,
      this.deadCodeElimination,
      this.commonSubexpressionElimination,
      this.loopInvariantCodeMotion
    ];
    
    let optimizedAST = ast;
    
    for (const optimization of optimizations) {
      optimizedAST = optimization.call(this, optimizedAST);
    }
    
    return optimizedAST;
  }
  
  constantFolding(ast) {
    // Fold constant expressions at compile time
    return this.traverseAndTransform(ast, (node) => {
      if (node.type === 'expression' && this.isConstantExpression(node)) {
        return {
          type: 'literal',
          value: this.evaluateConstantExpression(node)
        };
      }
      return node;
    });
  }
  
  commonSubexpressionElimination(ast) {
    // Eliminate common subexpressions
    const expressionMap = new Map();
    
    return this.traverseAndTransform(ast, (node) => {
      if (node.type === 'expression') {
        const key = this.expressionToKey(node);
        
        if (expressionMap.has(key)) {
          // Replace with reference to first occurrence
          return {
            type: 'reference',
            target: expressionMap.get(key)
          };
        } else {
          expressionMap.set(key, node.id);
        }
      }
      
      return node;
    });
  }
}
```

### Performance Measurement Integration
```javascript
// Comprehensive performance measurement for optimization validation
class OptimizationValidator {
  constructor() {
    this.measurements = new Map();
    this.optimizationHistory = [];
  }
  
  measureOperation(name, operation, ...args) {
    const measurement = this.startMeasurement(name);
    
    try {
      const result = operation(...args);
      
      if (result && typeof result.then === 'function') {
        // Async operation
        return result
          .then(value => {
            measurement.end();
            return value;
          })
          .catch(error => {
            measurement.end();
            throw error;
          });
      } else {
        // Sync operation
        measurement.end();
        return result;
      }
    } catch (error) {
      measurement.end();
      throw error;
    }
  }
  
  startMeasurement(name) {
    const startTime = process.hrtime.bigint();
    const startMemory = process.memoryUsage();
    
    return {
      end: () => {
        const endTime = process.hrtime.bigint();
        const endMemory = process.memoryUsage();
        
        const duration = Number(endTime - startTime) / 1000000; // Convert to ms
        const memoryDelta = endMemory.heapUsed - startMemory.heapUsed;
        
        this.recordMeasurement(name, {
          duration,
          memoryDelta,
          timestamp: Date.now()
        });
      }
    };
  }
  
  recordMeasurement(name, measurement) {
    if (!this.measurements.has(name)) {
      this.measurements.set(name, []);
    }
    
    this.measurements.get(name).push(measurement);
    
    // Keep only recent measurements
    const measurements = this.measurements.get(name);
    if (measurements.length > 100) {
      measurements.splice(0, measurements.length - 100);
    }
  }
  
  compareOptimizationImpact(operationName, beforeOptimization, afterOptimization) {
    const comparison = {
      operation: operationName,
      before: this.calculateStatistics(beforeOptimization),
      after: this.calculateStatistics(afterOptimization),
      improvement: {}
    };
    
    // Calculate improvements
    comparison.improvement.duration = (comparison.before.avgDuration - comparison.after.avgDuration) / comparison.before.avgDuration;
    comparison.improvement.memory = (comparison.before.avgMemory - comparison.after.avgMemory) / Math.abs(comparison.before.avgMemory);
    comparison.improvement.throughput = comparison.improvement.duration; // Inverse relationship
    
    this.optimizationHistory.push(comparison);
    
    return comparison;
  }
  
  generateOptimizationReport() {
    const report = {
      totalOptimizations: this.optimizationHistory.length,
      overallImprovement: {},
      bestOptimizations: [],
      recommendations: []
    };
    
    if (this.optimizationHistory.length > 0) {
      // Calculate overall improvements
      report.overallImprovement.duration = this.optimizationHistory
        .reduce((sum, opt) => sum + opt.improvement.duration, 0) / this.optimizationHistory.length;
      
      report.overallImprovement.memory = this.optimizationHistory
        .reduce((sum, opt) => sum + opt.improvement.memory, 0) / this.optimizationHistory.length;
      
      // Find best optimizations
      report.bestOptimizations = this.optimizationHistory
        .sort((a, b) => b.improvement.duration - a.improvement.duration)
        .slice(0, 5);
      
      // Generate recommendations
      report.recommendations = this.generateRecommendations();
    }
    
    return report;
  }
}
```

## Best Practices Summary

### Optimization Workflow
```javascript
const optimizationWorkflow = {
  step1_measure: {
    description: "Establish baseline performance metrics",
    actions: [
      "Profile current system performance",
      "Identify performance bottlenecks", 
      "Document current resource usage",
      "Set performance targets"
    ]
  },
  
  step2_prioritize: {
    description: "Prioritize optimization opportunities",
    actions: [
      "Focus on operations with highest impact",
      "Consider implementation complexity",
      "Evaluate risk vs. reward",
      "Plan incremental improvements"
    ]
  },
  
  step3_implement: {
    description: "Implement optimizations systematically",
    actions: [
      "Make one optimization at a time",
      "Test thoroughly after each change",
      "Measure impact on performance",
      "Document changes and results"
    ]
  },
  
  step4_validate: {
    description: "Validate optimization effectiveness",
    actions: [
      "Compare before/after metrics",
      "Test under realistic conditions",
      "Check for unintended side effects",
      "Update performance baselines"
    ]
  },
  
  step5_maintain: {
    description: "Maintain optimized performance",
    actions: [
      "Monitor performance continuously",
      "Set up regression detection",
      "Regular performance reviews",
      "Keep optimizations up to date"
    ]
  }
};
```

### Common Optimization Pitfalls
```javascript
const optimizationPitfalls = {
  prematureOptimization: {
    problem: "Optimizing before identifying real bottlenecks",
    solution: "Always profile first, optimize second",
    prevention: "Use data-driven optimization approach"
  },
  
  microOptimizations: {
    problem: "Focusing on tiny improvements while ignoring major issues",
    solution: "Focus on high-impact optimizations first",
    prevention: "Use 80/20 rule - optimize the 20% that matters"
  },
  
  cacheOveruse: {
    problem: "Caching everything without considering memory impact",
    solution: "Implement intelligent cache eviction policies",
    prevention: "Monitor cache hit rates and memory usage"
  },
  
  complexityIncrease: {
    problem: "Making code too complex in pursuit of performance",
    solution: "Balance performance gains with maintainability",
    prevention: "Document complex optimizations thoroughly"
  }
};
```

This comprehensive optimization strategy guide provides a systematic approach to achieving and maintaining high performance in the Unjucks template generation system.