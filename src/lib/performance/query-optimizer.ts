import { Store, Quad, Term, NamedNode, Literal, BlankNode } from 'n3';
import { LRUCache } from 'lru-cache';

interface QueryPattern {
  subject?: Term | null;
  predicate?: Term | null;
  object?: Term | null;
  graph?: Term | null;
}

interface QueryOptimizationStrategy {
  estimatedCost: number;
  indexUsage: string[];
  recommendation: string;
  executionPlan: string;
}

interface QueryCache {
  key: string;
  result: Quad[];
  timestamp: number;
  accessCount: number;
  avgExecutionTime: number;
}

interface IndexStats {
  [key: string]: {
    size: number;
    lastUpdated: number;
    hitRate: number;
    avgQueryTime: number;
  };
}

export class QueryOptimizer {
  private store: Store;
  private queryCache: LRUCache<string, QueryCache>;
  private indexStats: IndexStats = {};
  private queryHistory: Array<{
    pattern: QueryPattern;
    executionTime: number;
    resultCount: number;
    timestamp: number;
    cacheHit: boolean;
  }> = [];

  constructor(store: Store, cacheOptions?: {
    maxSize?: number;
    ttl?: number; // Time to live in ms
  }) {
    this.store = store;
    this.queryCache = new LRUCache({
      max: cacheOptions?.maxSize || 1000,
      ttl: cacheOptions?.ttl || 300000, // 5 minutes default TTL
      updateAgeOnGet: true,
      updateAgeOnHas: true
    });

    // Initialize index statistics
    this.initializeIndexStats();
  }

  private initializeIndexStats(): void {
    // N3.js Store internally uses indices for SPO, PSO, OPS, etc.
    // We track virtual statistics for these common access patterns
    this.indexStats = {
      'SPO': { size: 0, lastUpdated: Date.now(), hitRate: 0, avgQueryTime: 0 },
      'PSO': { size: 0, lastUpdated: Date.now(), hitRate: 0, avgQueryTime: 0 },
      'OPS': { size: 0, lastUpdated: Date.now(), hitRate: 0, avgQueryTime: 0 },
      'SOP': { size: 0, lastUpdated: Date.now(), hitRate: 0, avgQueryTime: 0 },
      'POS': { size: 0, lastUpdated: Date.now(), hitRate: 0, avgQueryTime: 0 },
      'OSP': { size: 0, lastUpdated: Date.now(), hitRate: 0, avgQueryTime: 0 }
    };
  }

  public async executeQuery(pattern: QueryPattern, options?: {
    useCache?: boolean;
    maxResults?: number;
    timeout?: number;
  }): Promise<{
    results: Quad[];
    executionTime: number;
    cacheHit: boolean;
    optimization: QueryOptimizationStrategy;
  }> {
    const startTime = Date.now();
    const useCache = options?.useCache !== false; // Default to true
    const maxResults = options?.maxResults || Number.MAX_SAFE_INTEGER;
    const timeout = options?.timeout || 30000; // 30 second default timeout

    // Generate cache key
    const cacheKey = this.generateCacheKey(pattern);
    
    // Check cache first
    if (useCache && this.queryCache.has(cacheKey)) {
      const cached = this.queryCache.get(cacheKey)!;
      cached.accessCount++;
      
      const executionTime = Date.now() - startTime;
      
      // Record query history
      this.recordQueryExecution(pattern, executionTime, cached.result.length, true);
      
      return {
        results: cached.result.slice(0, maxResults),
        executionTime,
        cacheHit: true,
        optimization: this.analyzeQueryPattern(pattern)
      };
    }

    // Execute query with optimization
    const optimization = this.analyzeQueryPattern(pattern);
    const results = await this.executeOptimizedQuery(pattern, timeout, maxResults);
    
    const executionTime = Date.now() - startTime;

    // Cache results if beneficial
    if (useCache && this.shouldCacheQuery(pattern, results.length, executionTime)) {
      const cacheEntry: QueryCache = {
        key: cacheKey,
        result: results,
        timestamp: Date.now(),
        accessCount: 1,
        avgExecutionTime: executionTime
      };
      this.queryCache.set(cacheKey, cacheEntry);
    }

    // Update statistics
    this.updateIndexStats(pattern, executionTime, results.length);
    this.recordQueryExecution(pattern, executionTime, results.length, false);

    return {
      results,
      executionTime,
      cacheHit: false,
      optimization
    };
  }

  private generateCacheKey(pattern: QueryPattern): string {
    const s = pattern.subject ? pattern.subject.value : '*';
    const p = pattern.predicate ? pattern.predicate.value : '*';
    const o = pattern.object ? pattern.object.value : '*';
    const g = pattern.graph ? pattern.graph.value : '*';
    return `${s}|${p}|${o}|${g}`;
  }

  private analyzeQueryPattern(pattern: QueryPattern): QueryOptimizationStrategy {
    const selectivity = this.calculateSelectivity(pattern);
    const optimalIndex = this.determineOptimalIndex(pattern);
    const estimatedCost = this.estimateQueryCost(pattern);
    
    let recommendation = '';
    let executionPlan = '';

    // Analyze pattern specificity
    const boundVars = [pattern.subject, pattern.predicate, pattern.object, pattern.graph].filter(Boolean).length;
    
    if (boundVars === 0) {
      recommendation = 'Full scan required. Consider adding constraints to improve performance.';
      executionPlan = 'Full triple store scan';
    } else if (boundVars === 1) {
      if (pattern.predicate) {
        recommendation = 'Predicate-based query. Good performance expected with PSO index.';
        executionPlan = 'Use PSO index for predicate lookup';
      } else if (pattern.subject) {
        recommendation = 'Subject-based query. Excellent performance expected with SPO index.';
        executionPlan = 'Use SPO index for subject lookup';
      } else if (pattern.object) {
        recommendation = 'Object-based query. Good performance with OPS index.';
        executionPlan = 'Use OPS index for object lookup';
      }
    } else if (boundVars === 2) {
      recommendation = 'Well-constrained query. Excellent performance expected.';
      executionPlan = `Use ${optimalIndex} index for efficient lookup`;
    } else {
      recommendation = 'Highly specific query. Optimal performance expected.';
      executionPlan = `Direct lookup using ${optimalIndex} index`;
    }

    return {
      estimatedCost,
      indexUsage: [optimalIndex],
      recommendation,
      executionPlan
    };
  }

  private calculateSelectivity(pattern: QueryPattern): number {
    // Estimate selectivity based on pattern constraints
    // This is a simplified heuristic - in production, you'd use actual statistics
    let selectivity = 1.0;
    
    const totalQuads = this.store.size;
    if (totalQuads === 0) return 0;

    // Adjust selectivity based on bound variables
    if (pattern.subject) selectivity *= 0.1;  // Subjects typically have low cardinality
    if (pattern.predicate) selectivity *= 0.05; // Predicates have very low cardinality
    if (pattern.object) selectivity *= 0.3;  // Objects have medium cardinality
    if (pattern.graph) selectivity *= 0.2;   // Graphs have low cardinality

    return selectivity;
  }

  private determineOptimalIndex(pattern: QueryPattern): string {
    // Determine the best index based on the query pattern
    // Priority: most selective variable first
    
    const subjectBound = !!pattern.subject;
    const predicateBound = !!pattern.predicate;
    const objectBound = !!pattern.object;

    if (subjectBound && predicateBound && objectBound) return 'SPO';
    if (subjectBound && predicateBound) return 'SPO';
    if (subjectBound && objectBound) return 'SOP';
    if (predicateBound && objectBound) return 'PSO';
    if (subjectBound) return 'SPO';
    if (predicateBound) return 'PSO';
    if (objectBound) return 'OPS';
    
    return 'SPO'; // Default fallback
  }

  private estimateQueryCost(pattern: QueryPattern): number {
    const selectivity = this.calculateSelectivity(pattern);
    const storeSize = this.store.size;
    const estimatedResults = storeSize * selectivity;
    
    // Cost is roughly logarithmic for indexed access, linear for scans
    const boundVars = [pattern.subject, pattern.predicate, pattern.object].filter(Boolean).length;
    
    if (boundVars === 0) {
      return storeSize; // Full scan
    } else if (boundVars === 1) {
      return Math.log2(storeSize) * estimatedResults;
    } else {
      return Math.log2(storeSize) + estimatedResults;
    }
  }

  private async executeOptimizedQuery(
    pattern: QueryPattern, 
    timeout: number, 
    maxResults: number
  ): Promise<Quad[]> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Query timeout after ${timeout}ms`));
      }, timeout);

      try {
        const results = this.store.getQuads(
          pattern.subject,
          pattern.predicate,
          pattern.object,
          pattern.graph
        );

        clearTimeout(timeoutId);
        
        // Apply result limit
        const limitedResults = Array.from(results).slice(0, maxResults);
        resolve(limitedResults);
      } catch (error) {
        clearTimeout(timeoutId);
        reject(error);
      }
    });
  }

  private shouldCacheQuery(pattern: QueryPattern, resultCount: number, executionTime: number): boolean {
    // Cache expensive queries that return moderate result sets
    const isExpensive = executionTime > 10; // Cache queries taking more than 10ms
    const isReasonableSize = resultCount < 10000 && resultCount > 0; // Don't cache huge or empty results
    const hasConstraints = !!(pattern.subject || pattern.predicate || pattern.object); // Don't cache full scans
    
    return isExpensive && isReasonableSize && hasConstraints;
  }

  private updateIndexStats(pattern: QueryPattern, executionTime: number, resultCount: number): void {
    const indexUsed = this.determineOptimalIndex(pattern);
    
    if (this.indexStats[indexUsed]) {
      const stats = this.indexStats[indexUsed];
      const previousAvg = stats.avgQueryTime;
      const count = this.queryHistory.filter(q => 
        this.determineOptimalIndex(q.pattern) === indexUsed
      ).length;
      
      // Update rolling average
      stats.avgQueryTime = (previousAvg * count + executionTime) / (count + 1);
      stats.lastUpdated = Date.now();
      stats.size = resultCount;
    }
  }

  private recordQueryExecution(
    pattern: QueryPattern, 
    executionTime: number, 
    resultCount: number, 
    cacheHit: boolean
  ): void {
    this.queryHistory.push({
      pattern,
      executionTime,
      resultCount,
      timestamp: Date.now(),
      cacheHit
    });

    // Keep only last 1000 queries for analysis
    if (this.queryHistory.length > 1000) {
      this.queryHistory.shift();
    }
  }

  public getPerformanceReport(): {
    cacheStats: {
      size: number;
      hitRate: number;
      averageAccessTime: number;
    };
    indexStats: IndexStats;
    queryStats: {
      totalQueries: number;
      averageExecutionTime: number;
      slowQueries: number; // Queries > 1000ms
      cacheHitRate: number;
    };
    recommendations: string[];
  } {
    // Calculate cache statistics
    const cacheSize = this.queryCache.size;
    const totalAccesses = this.queryHistory.length;
    const cacheHits = this.queryHistory.filter(q => q.cacheHit).length;
    const cacheHitRate = totalAccesses > 0 ? (cacheHits / totalAccesses) * 100 : 0;
    
    const cachedQueries = Array.from(this.queryCache.values());
    const avgAccessTime = cachedQueries.length > 0 
      ? cachedQueries.reduce((sum, q) => sum + q.avgExecutionTime, 0) / cachedQueries.length
      : 0;

    // Calculate query statistics
    const totalQueries = this.queryHistory.length;
    const avgExecutionTime = totalQueries > 0 
      ? this.queryHistory.reduce((sum, q) => sum + q.executionTime, 0) / totalQueries 
      : 0;
    const slowQueries = this.queryHistory.filter(q => q.executionTime > 1000).length;

    // Generate recommendations
    const recommendations: string[] = [];
    
    if (cacheHitRate < 20) {
      recommendations.push('Low cache hit rate. Consider adjusting cache size or TTL settings.');
    }
    
    if (avgExecutionTime > 100) {
      recommendations.push('High average execution time. Review query patterns and consider adding more constraints.');
    }
    
    if (slowQueries > totalQueries * 0.1) {
      recommendations.push('High number of slow queries. Consider query optimization or indexing strategies.');
    }
    
    const fullScans = this.queryHistory.filter(q => 
      !q.pattern.subject && !q.pattern.predicate && !q.pattern.object
    ).length;
    
    if (fullScans > 0) {
      recommendations.push('Full scan queries detected. Add constraints to improve performance.');
    }

    if (recommendations.length === 0) {
      recommendations.push('Query performance appears optimal.');
    }

    return {
      cacheStats: {
        size: cacheSize,
        hitRate: cacheHitRate,
        averageAccessTime: avgAccessTime
      },
      indexStats: this.indexStats,
      queryStats: {
        totalQueries,
        averageExecutionTime: avgExecutionTime,
        slowQueries,
        cacheHitRate
      },
      recommendations
    };
  }

  public optimizeQuery(pattern: QueryPattern): {
    originalPattern: QueryPattern;
    optimizedPattern: QueryPattern;
    optimization: QueryOptimizationStrategy;
    explanation: string;
  } {
    const original = { ...pattern };
    const optimized = { ...pattern };
    let explanation = 'No optimization needed.';

    // Check for common optimization opportunities
    if (!pattern.subject && !pattern.predicate && !pattern.object) {
      explanation = 'Full scan query detected. Consider adding constraints to improve performance.';
    } else {
      // Example optimizations (in a real system, these would be more sophisticated)
      const strategy = this.analyzeQueryPattern(pattern);
      explanation = `Query uses ${strategy.indexUsage.join(', ')} index(es). ${strategy.recommendation}`;
    }

    return {
      originalPattern: original,
      optimizedPattern: optimized,
      optimization: this.analyzeQueryPattern(optimized),
      explanation
    };
  }

  public clearCache(): void {
    this.queryCache.clear();
  }

  public preWarmCache(patterns: QueryPattern[]): Promise<void> {
    const promises = patterns.map(pattern => 
      this.executeQuery(pattern, { useCache: true })
    );

    return Promise.all(promises).then(() => {
      console.log(`Pre-warmed cache with ${patterns.length} query patterns`);
    });
  }

  public getSlowQueries(threshold: number = 1000): Array<{
    pattern: QueryPattern;
    averageTime: number;
    executionCount: number;
    lastExecution: number;
  }> {
    const queryPatterns = new Map<string, {
      pattern: QueryPattern;
      times: number[];
      lastExecution: number;
    }>();

    // Group queries by pattern
    this.queryHistory.forEach(query => {
      const key = this.generateCacheKey(query.pattern);
      
      if (!queryPatterns.has(key)) {
        queryPatterns.set(key, {
          pattern: query.pattern,
          times: [],
          lastExecution: query.timestamp
        });
      }
      
      const data = queryPatterns.get(key)!;
      data.times.push(query.executionTime);
      data.lastExecution = Math.max(data.lastExecution, query.timestamp);
    });

    // Filter and transform slow queries
    return Array.from(queryPatterns.values())
      .map(data => ({
        pattern: data.pattern,
        averageTime: data.times.reduce((a, b) => a + b, 0) / data.times.length,
        executionCount: data.times.length,
        lastExecution: data.lastExecution
      }))
      .filter(query => query.averageTime > threshold)
      .sort((a, b) => b.averageTime - a.averageTime);
  }

  public cleanup(): void {
    this.clearCache();
    this.queryHistory = [];
    this.indexStats = {};
    this.initializeIndexStats();
  }
}

// Factory function for easy instantiation
export function createQueryOptimizer(store: Store, options?: {
  cacheSize?: number;
  cacheTTL?: number;
}): QueryOptimizer {
  return new QueryOptimizer(store, {
    maxSize: options?.cacheSize || 1000,
    ttl: options?.cacheTTL || 300000 // 5 minutes
  });
}

// Utility functions
export function createQueryPattern(
  subject?: string | Term,
  predicate?: string | Term,
  object?: string | Term,
  graph?: string | Term
): QueryPattern {
  return {
    subject: typeof subject === 'string' ? { value: subject } as Term : subject || null,
    predicate: typeof predicate === 'string' ? { value: predicate } as Term : predicate || null,
    object: typeof object === 'string' ? { value: object } as Term : object || null,
    graph: typeof graph === 'string' ? { value: graph } as Term : graph || null
  };
}