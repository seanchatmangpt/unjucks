/**
 * Performance Optimization Engine for Unjucks RDF/Turtle Operations
 * 
 * Focuses on the 80/20 rule:
 * - 80% of performance issues come from 20% of operations
 * - Target: Parser, Query, Template Rendering, Memory, and Caching
 */

import { Store, Quad, Parser, DataFactory } from 'n3';
import { performance, PerformanceObserver } from 'perf_hooks';
import { RDFFilters } from '../rdf-filters.js';

const { namedNode, literal, quad } = DataFactory;

export interface PerformanceMetrics {
  parseTime: number;
  queryTime: number;
  renderTime: number;
  memoryUsage: {
    before: number;
    after: number;
    peak: number;
  };
  cacheHits: number;
  cacheMisses: number;
  operationType: string;
  tripleCount: number;
  timestamp: number;
}

export interface OptimizationResult {
  originalTime: number;
  optimizedTime: number;
  improvement: number;
  memoryReduction: number;
  strategy: string;
}

/**
 * LRU Cache for common RDF operations
 */
class LRUCache<T> {
  private cache = new Map<string, T>();
  private accessOrder = new Map<string, number>();
  private maxSize: number;
  private accessCounter = 0;

  constructor(maxSize = 1000) {
    this.maxSize = maxSize;
  }

  get(key: string): T | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      this.accessOrder.set(key, ++this.accessCounter);
    }
    return value;
  }

  set(key: string, value: T): void {
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }
    
    this.cache.set(key, value);
    this.accessOrder.set(key, ++this.accessCounter);
  }

  private evictLRU(): void {
    let oldestKey = '';
    let oldestAccess = Infinity;
    
    for (const [key, access] of this.accessOrder) {
      if (access < oldestAccess) {
        oldestAccess = access;
        oldestKey = key;
      }
    }
    
    this.cache.delete(oldestKey);
    this.accessOrder.delete(oldestKey);
  }

  clear(): void {
    this.cache.clear();
    this.accessOrder.clear();
    this.accessCounter = 0;
  }

  get size(): number {
    return this.cache.size;
  }
}

/**
 * Optimized Turtle Parser with streaming and chunking
 */
export class OptimizedTurtleParser {
  private parseCache = new LRUCache<any>(500);
  private storeCache = new LRUCache<Store>(100);
  private metrics: PerformanceMetrics[] = [];

  /**
   * Parse with optimization strategies for typical use cases
   */
  async parseOptimized(
    content: string,
    options: {
      useCache?: boolean;
      chunkSize?: number;
      enableStreaming?: boolean;
      baseIRI?: string;
    } = {}
  ): Promise<{ result: any; metrics: PerformanceMetrics }> {
    const startTime = performance.now();
    const memoryBefore = process.memoryUsage().heapUsed;
    let memoryPeak = memoryBefore;
    
    const cacheKey = this.generateCacheKey(content, options);
    
    // Check cache first for common patterns
    if (options.useCache !== false) {
      const cached = this.parseCache.get(cacheKey);
      if (cached) {
        return {
          result: cached,
          metrics: {
            parseTime: 0.1, // Cache hit time
            queryTime: 0,
            renderTime: 0,
            memoryUsage: { before: memoryBefore, after: memoryBefore, peak: memoryPeak },
            cacheHits: 1,
            cacheMisses: 0,
            operationType: 'parse-cached',
            tripleCount: cached.triples?.length || 0,
            timestamp: Date.now()
          }
        };
      }
    }

    let result: any;
    let strategy = 'standard';
    
    // Choose optimization strategy based on content size and characteristics
    if (content.length > 100000) {
      // Large files: use streaming
      result = await this.parseStreaming(content, options);
      strategy = 'streaming';
    } else if (this.detectComplexPatterns(content)) {
      // Complex patterns: use chunking
      result = await this.parseChunked(content, options);
      strategy = 'chunked';
    } else {
      // Small files: standard parsing with optimizations
      result = await this.parseStandard(content, options);
      strategy = 'standard-optimized';
    }

    const endTime = performance.now();
    const memoryAfter = process.memoryUsage().heapUsed;
    
    // Cache result for future use
    if (options.useCache !== false && result) {
      this.parseCache.set(cacheKey, result);
    }

    const metrics: PerformanceMetrics = {
      parseTime: endTime - startTime,
      queryTime: 0,
      renderTime: 0,
      memoryUsage: { before: memoryBefore, after: memoryAfter, peak: memoryPeak },
      cacheHits: 0,
      cacheMisses: 1,
      operationType: `parse-${strategy}`,
      tripleCount: result.triples?.length || 0,
      timestamp: Date.now()
    };

    this.metrics.push(metrics);
    return { result, metrics };
  }

  /**
   * Streaming parser for large files
   */
  private async parseStreaming(content: string, options: any): Promise<any> {
    const parser = new Parser({
      baseIRI: options.baseIRI,
      format: 'text/turtle'
    });
    
    const store = new Store();
    const triples: any[] = [];
    
    return new Promise((resolve, reject) => {
      let chunkIndex = 0;
      const chunkSize = options.chunkSize || 10000;
      
      const processChunk = () => {
        const start = chunkIndex * chunkSize;
        const end = Math.min(start + chunkSize, content.length);
        const chunk = content.slice(start, end);
        
        if (start >= content.length) {
          // Processing complete
          resolve({
            triples,
            prefixes: this.extractPrefixes(store),
            namedGraphs: this.extractNamedGraphs(triples),
            stats: {
              tripleCount: triples.length,
              namedGraphCount: this.extractNamedGraphs(triples).length,
              prefixCount: Object.keys(this.extractPrefixes(store)).length
            }
          });
          return;
        }
        
        parser.parse(chunk, (error, quad, prefixes) => {
          if (error) {
            reject(error);
            return;
          }
          
          if (quad) {
            store.add(quad);
            triples.push(this.quadToTriple(quad));
          }
        });
        
        chunkIndex++;
        // Use setTimeout for non-blocking processing
        setTimeout(processChunk, 0);
      };
      
      processChunk();
    });
  }

  /**
   * Chunked parser for complex patterns
   */
  private async parseChunked(content: string, options: any): Promise<any> {
    const lines = content.split('\n');
    const chunkSize = Math.max(100, Math.floor(lines.length / 10));
    const chunks: string[] = [];
    
    for (let i = 0; i < lines.length; i += chunkSize) {
      chunks.push(lines.slice(i, i + chunkSize).join('\n'));
    }
    
    const results = await Promise.all(
      chunks.map(chunk => this.parseStandard(chunk, options))
    );
    
    // Merge results
    const mergedTriples = results.flatMap(r => r.triples || []);
    const mergedPrefixes = Object.assign({}, ...results.map(r => r.prefixes || {}));
    const mergedGraphs = [...new Set(results.flatMap(r => r.namedGraphs || []))];
    
    return {
      triples: mergedTriples,
      prefixes: mergedPrefixes,
      namedGraphs: mergedGraphs,
      stats: {
        tripleCount: mergedTriples.length,
        namedGraphCount: mergedGraphs.length,
        prefixCount: Object.keys(mergedPrefixes).length
      }
    };
  }

  /**
   * Standard parser with micro-optimizations
   */
  private async parseStandard(content: string, options: any): Promise<any> {
    const parser = new Parser({
      baseIRI: options.baseIRI,
      format: 'text/turtle'
    });
    
    const store = new Store();
    const triples: any[] = [];
    
    return new Promise((resolve, reject) => {
      // Pre-allocate arrays for better performance
      triples.length = this.estimateTripleCount(content);
      let tripleIndex = 0;
      
      parser.parse(content, (error, quad, prefixes) => {
        if (error) {
          reject(error);
          return;
        }
        
        if (quad) {
          store.add(quad);
          triples[tripleIndex++] = this.quadToTriple(quad);
        } else {
          // Trim array to actual size
          triples.length = tripleIndex;
          
          resolve({
            triples,
            prefixes: this.extractPrefixes(store),
            namedGraphs: this.extractNamedGraphs(triples),
            stats: {
              tripleCount: triples.length,
              namedGraphCount: this.extractNamedGraphs(triples).length,
              prefixCount: Object.keys(this.extractPrefixes(store)).length
            }
          });
        }
      });
    });
  }

  /**
   * Optimized query engine with indexing and caching
   */
  async queryOptimized(
    store: Store,
    pattern: any,
    options: { useIndex?: boolean; useCache?: boolean } = {}
  ): Promise<{ results: any[]; metrics: PerformanceMetrics }> {
    const startTime = performance.now();
    const memoryBefore = process.memoryUsage().heapUsed;
    
    const cacheKey = `query:${JSON.stringify(pattern)}`;
    
    if (options.useCache !== false) {
      const cached = this.parseCache.get(cacheKey);
      if (cached) {
        return {
          results: cached,
          metrics: {
            parseTime: 0,
            queryTime: 0.1,
            renderTime: 0,
            memoryUsage: { before: memoryBefore, after: memoryBefore, peak: memoryBefore },
            cacheHits: 1,
            cacheMisses: 0,
            operationType: 'query-cached',
            tripleCount: cached.length,
            timestamp: Date.now()
          }
        };
      }
    }
    
    // Use optimized query execution
    const results = this.executeOptimizedQuery(store, pattern);
    
    const endTime = performance.now();
    const memoryAfter = process.memoryUsage().heapUsed;
    
    if (options.useCache !== false) {
      this.parseCache.set(cacheKey, results);
    }
    
    const metrics: PerformanceMetrics = {
      parseTime: 0,
      queryTime: endTime - startTime,
      renderTime: 0,
      memoryUsage: { before: memoryBefore, after: memoryAfter, peak: memoryAfter },
      cacheHits: 0,
      cacheMisses: 1,
      operationType: 'query-optimized',
      tripleCount: results.length,
      timestamp: Date.now()
    };
    
    return { results, metrics };
  }

  /**
   * Generate performance report
   */
  generatePerformanceReport(): {
    summary: any;
    recommendations: string[];
    metrics: PerformanceMetrics[];
  } {
    const totalOperations = this.metrics.length;
    if (totalOperations === 0) {
      return {
        summary: { message: 'No operations recorded' },
        recommendations: ['Start using the optimizer to collect metrics'],
        metrics: []
      };
    }
    
    const avgParseTime = this.metrics.reduce((sum, m) => sum + m.parseTime, 0) / totalOperations;
    const avgQueryTime = this.metrics.reduce((sum, m) => sum + m.queryTime, 0) / totalOperations;
    const totalCacheHits = this.metrics.reduce((sum, m) => sum + m.cacheHits, 0);
    const totalCacheMisses = this.metrics.reduce((sum, m) => sum + m.cacheMisses, 0);
    const cacheHitRate = totalCacheHits / (totalCacheHits + totalCacheMisses);
    
    const summary = {
      totalOperations,
      avgParseTime: Math.round(avgParseTime * 100) / 100,
      avgQueryTime: Math.round(avgQueryTime * 100) / 100,
      cacheHitRate: Math.round(cacheHitRate * 100),
      memoryEfficiency: this.calculateMemoryEfficiency(),
      bottlenecks: this.identifyBottlenecks()
    };
    
    const recommendations = this.generateRecommendations(summary);
    
    return { summary, recommendations, metrics: [...this.metrics] };
  }

  // Private helper methods
  private generateCacheKey(content: string, options: any): string {
    const contentHash = this.simpleHash(content);
    const optionsHash = this.simpleHash(JSON.stringify(options));
    return `${contentHash}:${optionsHash}`;
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  private detectComplexPatterns(content: string): boolean {
    const complexityIndicators = [
      /GRAPH\s+</g,
      /UNION\s*\{/g,
      /OPTIONAL\s*\{/g,
      /FILTER\s*\(/g,
      /_:\w+/g // Blank nodes
    ];
    
    return complexityIndicators.some(pattern => 
      (content.match(pattern) || []).length > 10
    );
  }

  private estimateTripleCount(content: string): number {
    const lines = content.split('\n').filter(line => 
      line.trim() && !line.trim().startsWith('#') && !line.trim().startsWith('@')
    );
    return Math.max(lines.length, 100);
  }

  private quadToTriple(quad: Quad): any {
    return {
      subject: this.termToObject(quad.subject),
      predicate: this.termToObject(quad.predicate),
      object: this.termToObject(quad.object),
      ...(quad.graph && quad.graph.value !== '' ? 
        { graph: this.termToObject(quad.graph) } : {})
    };
  }

  private termToObject(term: any): any {
    if (term.termType === 'NamedNode') {
      return { type: 'uri', value: term.value };
    } else if (term.termType === 'BlankNode') {
      return { type: 'blank', value: term.value };
    } else if (term.termType === 'Literal') {
      return {
        type: 'literal',
        value: term.value,
        ...(term.datatype && term.datatype.value !== 'http://www.w3.org/2001/XMLSchema#string' ? 
          { datatype: term.datatype.value } : {}),
        ...(term.language ? { language: term.language } : {})
      };
    }
    return { type: 'literal', value: term.value };
  }

  private extractPrefixes(store: Store): Record<string, string> {
    const prefixes: Record<string, string> = {};
    const storePrefixes = (store as any)._prefixes;
    if (storePrefixes) {
      for (const [prefix, uri] of Object.entries(storePrefixes)) {
        if (typeof uri === 'string') {
          prefixes[prefix] = uri;
        }
      }
    }
    return prefixes;
  }

  private extractNamedGraphs(triples: any[]): string[] {
    const graphs = new Set<string>();
    for (const triple of triples) {
      if (triple.graph && triple.graph.type === 'uri') {
        graphs.add(triple.graph.value);
      }
    }
    return Array.from(graphs).sort();
  }

  private executeOptimizedQuery(store: Store, pattern: any): any[] {
    // Implement query optimization strategies
    const { subject, predicate, object, graph } = pattern;
    
    // Convert terms for N3 store
    const s = subject ? this.expandTerm(subject) : null;
    const p = predicate ? this.expandTerm(predicate) : null;
    const o = object ? this.expandTerm(object) : null;
    const g = graph ? this.expandTerm(graph) : null;
    
    const quads = store.getQuads(s, p, o, g);
    return quads.map(quad => this.quadToTriple(quad));
  }

  private expandTerm(term: string): any {
    if (term.startsWith('http://') || term.startsWith('https://')) {
      return namedNode(term);
    } else if (term.startsWith('_:')) {
      return { termType: 'BlankNode', value: term.substring(2) };
    } else {
      return literal(term);
    }
  }

  private calculateMemoryEfficiency(): number {
    if (this.metrics.length === 0) return 100;
    
    const totalMemoryGrowth = this.metrics.reduce((sum, m) => 
      sum + (m.memoryUsage.after - m.memoryUsage.before), 0);
    const avgMemoryGrowth = totalMemoryGrowth / this.metrics.length;
    
    // Lower memory growth is better efficiency
    return Math.max(0, 100 - (avgMemoryGrowth / 1024 / 1024)); // MB
  }

  private identifyBottlenecks(): string[] {
    const bottlenecks: string[] = [];
    
    const avgParseTime = this.metrics.reduce((sum, m) => sum + m.parseTime, 0) / this.metrics.length;
    const avgQueryTime = this.metrics.reduce((sum, m) => sum + m.queryTime, 0) / this.metrics.length;
    
    if (avgParseTime > 100) bottlenecks.push('Slow parsing');
    if (avgQueryTime > 50) bottlenecks.push('Slow queries');
    
    const memoryGrowth = this.calculateMemoryEfficiency();
    if (memoryGrowth < 80) bottlenecks.push('High memory usage');
    
    const totalCacheHits = this.metrics.reduce((sum, m) => sum + m.cacheHits, 0);
    const totalCacheMisses = this.metrics.reduce((sum, m) => sum + m.cacheMisses, 0);
    const cacheHitRate = totalCacheHits / (totalCacheHits + totalCacheMisses);
    
    if (cacheHitRate < 0.5) bottlenecks.push('Low cache hit rate');
    
    return bottlenecks;
  }

  private generateRecommendations(summary: any): string[] {
    const recommendations: string[] = [];
    
    if (summary.avgParseTime > 100) {
      recommendations.push('Consider enabling streaming for large files');
      recommendations.push('Use chunked parsing for complex patterns');
    }
    
    if (summary.avgQueryTime > 50) {
      recommendations.push('Enable query result caching');
      recommendations.push('Consider creating indexes for frequent queries');
    }
    
    if (summary.cacheHitRate < 50) {
      recommendations.push('Increase cache size');
      recommendations.push('Enable caching for repetitive operations');
    }
    
    if (summary.memoryEfficiency < 80) {
      recommendations.push('Enable garbage collection hints');
      recommendations.push('Use streaming for large datasets');
    }
    
    return recommendations;
  }

  clearCache(): void {
    this.parseCache.clear();
    this.storeCache.clear();
  }

  getMetrics(): PerformanceMetrics[] {
    return [...this.metrics];
  }
}

/**
 * Template Rendering Optimizer
 */
export class TemplateRenderingOptimizer {
  private renderCache = new LRUCache<string>(200);
  private compiledTemplates = new LRUCache<any>(100);

  async optimizeRendering(
    template: string,
    data: any,
    options: { useCache?: boolean; precompile?: boolean } = {}
  ): Promise<{ result: string; metrics: PerformanceMetrics }> {
    const startTime = performance.now();
    const memoryBefore = process.memoryUsage().heapUsed;
    
    const cacheKey = this.generateRenderCacheKey(template, data);
    
    if (options.useCache !== false) {
      const cached = this.renderCache.get(cacheKey);
      if (cached) {
        return {
          result: cached,
          metrics: {
            parseTime: 0,
            queryTime: 0,
            renderTime: 0.1,
            memoryUsage: { before: memoryBefore, after: memoryBefore, peak: memoryBefore },
            cacheHits: 1,
            cacheMisses: 0,
            operationType: 'render-cached',
            tripleCount: 0,
            timestamp: Date.now()
          }
        };
      }
    }

    // Implement optimized rendering logic here
    const result = await this.renderOptimized(template, data, options);
    
    const endTime = performance.now();
    const memoryAfter = process.memoryUsage().heapUsed;
    
    if (options.useCache !== false) {
      this.renderCache.set(cacheKey, result);
    }
    
    const metrics: PerformanceMetrics = {
      parseTime: 0,
      queryTime: 0,
      renderTime: endTime - startTime,
      memoryUsage: { before: memoryBefore, after: memoryAfter, peak: memoryAfter },
      cacheHits: 0,
      cacheMisses: 1,
      operationType: 'render-optimized',
      tripleCount: 0,
      timestamp: Date.now()
    };
    
    return { result, metrics };
  }

  private async renderOptimized(template: string, data: any, options: any): Promise<string> {
    // Placeholder for actual Nunjucks rendering optimization
    // This would integrate with the actual template engine
    return `Optimized render of template with ${Object.keys(data || {}).length} variables`;
  }

  private generateRenderCacheKey(template: string, data: any): string {
    const templateHash = this.simpleHash(template);
    const dataHash = this.simpleHash(JSON.stringify(data));
    return `${templateHash}:${dataHash}`;
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }
}

// Export singleton instances
export const performanceOptimizer = new OptimizedTurtleParser();
export const templateOptimizer = new TemplateRenderingOptimizer();

export default {
  OptimizedTurtleParser,
  TemplateRenderingOptimizer,
  performanceOptimizer,
  templateOptimizer
};