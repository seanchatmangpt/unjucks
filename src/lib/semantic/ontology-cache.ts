/**
 * Ontology Cache Manager - High-performance caching for semantic templates
 * Optimizes ontology loading and reasoning for enterprise-scale deployments
 */

import { Store, Quad } from 'n3';
import { LRUCache } from 'lru-cache';
import { createHash } from 'crypto';
import fs from 'fs-extra';
import path from 'node:path';
import { Logger } from '@/utils/logger';

/**
 * Cached ontology information
 */
export interface CachedOntology {
  uri: string;
  hash: string;
  store: Store;
  classes: string[];
  properties: string[];
  individuals: string[];
  imports: string[];
  loadTime: number;
  lastAccessed: Date;
  version?: string;
  metadata: {
    tripleCount: number;
    prefixes: Record<string, string>;
    namespaces: string[];
  };
}

/**
 * Cache performance metrics
 */
export interface CacheMetrics {
  totalOntologies: number;
  cacheHits: number;
  cacheMisses: number;
  hitRate: number;
  averageLoadTime: number;
  memoryUsage: number;
  evictions: number;
  lastCleanup: Date;
}

/**
 * Cache configuration options
 */
export interface CacheConfig {
  maxSize: number;
  maxAge: number; // in milliseconds
  updateThreshold: number; // in milliseconds
  persistentCache: boolean;
  cacheDirectory: string;
  compressionEnabled: boolean;
  preloadCommonOntologies: boolean;
  backgroundRefresh: boolean;
}

/**
 * High-performance ontology cache with LRU eviction and persistent storage
 */
export class OntologyCache {
  private cache: LRUCache<string, CachedOntology>;
  private persistentStore: Map<string, string>; // URI -> file path
  private logger: Logger;
  private config: CacheConfig;
  private metrics: CacheMetrics;
  private refreshInterval?: NodeJS.Timer;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      maxSize: 50, // Maximum number of ontologies to cache
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      updateThreshold: 60 * 60 * 1000, // 1 hour
      persistentCache: true,
      cacheDirectory: './.cache/ontologies',
      compressionEnabled: true,
      preloadCommonOntologies: true,
      backgroundRefresh: true,
      ...config
    };

    this.cache = new LRUCache({
      max: this.config.maxSize,
      maxAge: this.config.maxAge,
      updateAgeOnGet: true,
      dispose: (value, key) => {
        this.metrics.evictions++;
        this.logger.debug(`Evicted ontology from cache: ${key}`);
      }
    });

    this.persistentStore = new Map();
    this.logger = new Logger('OntologyCache');
    
    this.metrics = {
      totalOntologies: 0,
      cacheHits: 0,
      cacheMisses: 0,
      hitRate: 0,
      averageLoadTime: 0,
      memoryUsage: 0,
      evictions: 0,
      lastCleanup: new Date()
    };

    this.initialize();
  }

  /**
   * Initialize cache system
   */
  private async initialize(): Promise<void> {
    try {
      // Create cache directory
      if (this.config.persistentCache) {
        await fs.ensureDir(this.config.cacheDirectory);
        await this.loadPersistentCache();
      }

      // Preload common ontologies
      if (this.config.preloadCommonOntologies) {
        await this.preloadCommonOntologies();
      }

      // Setup background refresh
      if (this.config.backgroundRefresh) {
        this.setupBackgroundRefresh();
      }

      this.logger.info('Ontology cache initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize ontology cache', error);
    }
  }

  /**
   * Get ontology from cache or load if not cached
   */
  async get(uri: string, forceFresh: boolean = false): Promise<CachedOntology | null> {
    const cacheKey = this.getCacheKey(uri);
    
    // Check cache first (unless forcing fresh load)
    if (!forceFresh) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        this.metrics.cacheHits++;
        cached.lastAccessed = new Date();
        this.updateMetrics();
        return cached;
      }
    }

    // Cache miss - need to load
    this.metrics.cacheMisses++;
    this.updateMetrics();

    try {
      const ontology = await this.loadOntology(uri);
      if (ontology) {
        this.cache.set(cacheKey, ontology);
        
        // Persist to disk if enabled
        if (this.config.persistentCache) {
          await this.persistOntology(cacheKey, ontology);
        }
      }
      return ontology;
    } catch (error) {
      this.logger.error(`Failed to load ontology: ${uri}`, error);
      return null;
    }
  }

  /**
   * Check if ontology is cached
   */
  has(uri: string): boolean {
    const cacheKey = this.getCacheKey(uri);
    return this.cache.has(cacheKey);
  }

  /**
   * Preload ontology into cache
   */
  async preload(uri: string): Promise<boolean> {
    try {
      const ontology = await this.get(uri);
      return ontology !== null;
    } catch (error) {
      this.logger.error(`Failed to preload ontology: ${uri}`, error);
      return false;
    }
  }

  /**
   * Invalidate cache entry
   */
  invalidate(uri: string): boolean {
    const cacheKey = this.getCacheKey(uri);
    const deleted = this.cache.delete(cacheKey);
    
    if (deleted && this.config.persistentCache) {
      // Remove from persistent storage
      const filePath = this.persistentStore.get(cacheKey);
      if (filePath) {
        fs.remove(filePath).catch(error => {
          this.logger.warn(`Failed to remove persistent cache file: ${filePath}`, error);
        });
        this.persistentStore.delete(cacheKey);
      }
    }
    
    return deleted;
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear();
    
    if (this.config.persistentCache) {
      // Clear persistent storage
      fs.emptyDir(this.config.cacheDirectory).catch(error => {
        this.logger.warn('Failed to clear persistent cache directory', error);
      });
      this.persistentStore.clear();
    }
    
    // Reset metrics
    this.metrics.cacheHits = 0;
    this.metrics.cacheMisses = 0;
    this.metrics.evictions = 0;
    this.updateMetrics();
  }

  /**
   * Get cache performance metrics
   */
  getMetrics(): CacheMetrics {
    this.updateMetrics();
    return { ...this.metrics };
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    maxSize: number;
    keys: string[];
    oldestEntry: Date | null;
    newestEntry: Date | null;
  } {
    const keys = Array.from(this.cache.keys());
    const values = keys.map(key => this.cache.get(key)!).filter(Boolean);
    
    const dates = values.map(v => v.lastAccessed).sort();
    
    return {
      size: this.cache.size,
      maxSize: this.config.maxSize,
      keys,
      oldestEntry: dates.length > 0 ? dates[0] : null,
      newestEntry: dates.length > 0 ? dates[dates.length - 1] : null
    };
  }

  /**
   * Optimize cache performance
   */
  optimize(): void {
    // Prune expired entries
    this.cache.purgeStale();
    
    // Update metrics
    this.updateMetrics();
    
    // Run garbage collection hint
    if (global.gc) {
      global.gc();
    }
    
    this.metrics.lastCleanup = new Date();
    this.logger.info('Cache optimization completed', this.getStats());
  }

  /**
   * Shutdown cache system
   */
  async shutdown(): Promise<void> {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
    
    // Final cache persistence
    if (this.config.persistentCache) {
      await this.persistAllCachedOntologies();
    }
    
    this.cache.clear();
    this.logger.info('Ontology cache shutdown completed');
  }

  /**
   * Load ontology from source
   */
  private async loadOntology(uri: string): Promise<CachedOntology | null> {
    const startTime = Date.now();
    
    try {
      // Determine source type and load content
      let content: string;
      
      if (uri.startsWith('http://') || uri.startsWith('https://')) {
        // Load from HTTP (implement with proper caching headers)
        content = await this.loadFromHTTP(uri);
      } else {
        // Load from local file
        content = await fs.readFile(uri, 'utf-8');
      }

      // Parse and analyze ontology
      const { TurtleParser } = await import('../turtle-parser.js');
      const parser = new TurtleParser();
      const parseResult = await parser.parse(content);
      
      // Create N3 store
      const store = new Store();
      for (const triple of parseResult.triples) {
        const { DataFactory } = await import('n3');
        const quad = DataFactory.quad(
          DataFactory.namedNode(triple.subject.value),
          DataFactory.namedNode(triple.predicate.value),
          triple.object.type === 'uri' 
            ? DataFactory.namedNode(triple.object.value)
            : DataFactory.literal(triple.object.value, triple.object.datatype)
        );
        store.add(quad);
      }

      // Extract ontology components
      const classes = this.extractClasses(store);
      const properties = this.extractProperties(store);
      const individuals = this.extractIndividuals(store);
      const imports = this.extractImports(store);

      const loadTime = Date.now() - startTime;
      const hash = this.calculateHash(content);

      const cachedOntology: CachedOntology = {
        uri,
        hash,
        store,
        classes,
        properties,
        individuals,
        imports,
        loadTime,
        lastAccessed: new Date(),
        metadata: {
          tripleCount: parseResult.triples.length,
          prefixes: parseResult.prefixes,
          namespaces: Object.values(parseResult.prefixes)
        }
      };

      this.metrics.totalOntologies++;
      this.logger.info(`Loaded ontology: ${uri} (${loadTime}ms, ${parseResult.triples.length} triples)`);
      
      return cachedOntology;
    } catch (error) {
      this.logger.error(`Failed to load ontology: ${uri}`, error);
      return null;
    }
  }

  /**
   * Load from HTTP with caching headers
   */
  private async loadFromHTTP(uri: string): Promise<string> {
    // TODO: Implement proper HTTP loading with:
    // - Cache headers (ETag, Last-Modified)
    // - Compression support
    // - Retry logic
    // - Timeout handling
    throw new Error(`HTTP ontology loading not yet implemented: ${uri}`);
  }

  /**
   * Load persistent cache from disk
   */
  private async loadPersistentCache(): Promise<void> {
    try {
      const indexFile = path.join(this.config.cacheDirectory, 'index.json');
      if (await fs.pathExists(indexFile)) {
        const index = await fs.readJSON(indexFile);
        
        for (const [cacheKey, filePath] of Object.entries(index)) {
          if (await fs.pathExists(filePath as string)) {
            this.persistentStore.set(cacheKey, filePath as string);
          }
        }
        
        this.logger.info(`Loaded ${this.persistentStore.size} ontologies from persistent cache`);
      }
    } catch (error) {
      this.logger.warn('Failed to load persistent cache index', error);
    }
  }

  /**
   * Persist ontology to disk
   */
  private async persistOntology(cacheKey: string, ontology: CachedOntology): Promise<void> {
    try {
      const fileName = `${cacheKey}.json${this.config.compressionEnabled ? '.gz' : ''}`;
      const filePath = path.join(this.config.cacheDirectory, fileName);
      
      const data = {
        uri: ontology.uri,
        hash: ontology.hash,
        classes: ontology.classes,
        properties: ontology.properties,
        individuals: ontology.individuals,
        imports: ontology.imports,
        loadTime: ontology.loadTime,
        lastAccessed: ontology.lastAccessed,
        metadata: ontology.metadata
        // Note: Store is not serialized due to size - will be reconstructed
      };

      if (this.config.compressionEnabled) {
        const zlib = await import('zlib');
        const compressed = zlib.gzipSync(JSON.stringify(data));
        await fs.writeFile(filePath, compressed);
      } else {
        await fs.writeJSON(filePath, data);
      }
      
      this.persistentStore.set(cacheKey, filePath);
      
      // Update index
      await this.updatePersistentIndex();
    } catch (error) {
      this.logger.warn(`Failed to persist ontology: ${cacheKey}`, error);
    }
  }

  /**
   * Update persistent cache index
   */
  private async updatePersistentIndex(): Promise<void> {
    try {
      const indexFile = path.join(this.config.cacheDirectory, 'index.json');
      const index = Object.fromEntries(this.persistentStore.entries());
      await fs.writeJSON(indexFile, index);
    } catch (error) {
      this.logger.warn('Failed to update persistent cache index', error);
    }
  }

  /**
   * Persist all cached ontologies
   */
  private async persistAllCachedOntologies(): Promise<void> {
    const keys = Array.from(this.cache.keys());
    const promises = keys.map(async (key) => {
      const ontology = this.cache.get(key);
      if (ontology) {
        await this.persistOntology(key, ontology);
      }
    });
    
    await Promise.all(promises);
    this.logger.info(`Persisted ${keys.length} ontologies to disk`);
  }

  /**
   * Preload common ontologies
   */
  private async preloadCommonOntologies(): Promise<void> {
    const commonOntologies = [
      'http://www.w3.org/2000/01/rdf-schema#',
      'http://www.w3.org/2002/07/owl#',
      'http://purl.org/dc/terms/',
      'http://xmlns.com/foaf/0.1/',
      'http://www.w3.org/2004/02/skos/core#',
      'https://schema.org/'
    ];

    for (const uri of commonOntologies) {
      try {
        await this.preload(uri);
      } catch (error) {
        this.logger.debug(`Could not preload common ontology: ${uri}`, error);
      }
    }
  }

  /**
   * Setup background refresh for cached ontologies
   */
  private setupBackgroundRefresh(): void {
    this.refreshInterval = setInterval(async () => {
      const keys = Array.from(this.cache.keys());
      
      for (const key of keys) {
        const ontology = this.cache.get(key);
        if (ontology) {
          const age = Date.now() - ontology.lastAccessed.getTime();
          
          // Refresh if older than threshold
          if (age > this.config.updateThreshold) {
            try {
              await this.get(ontology.uri, true); // Force refresh
            } catch (error) {
              this.logger.debug(`Background refresh failed for: ${ontology.uri}`, error);
            }
          }
        }
      }
    }, this.config.updateThreshold);
  }

  // Utility methods
  private getCacheKey(uri: string): string {
    return createHash('sha256').update(uri).digest('hex').substring(0, 16);
  }

  private calculateHash(content: string): string {
    return createHash('sha256').update(content).digest('hex');
  }

  private updateMetrics(): void {
    this.metrics.hitRate = this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses) || 0;
    this.metrics.memoryUsage = process.memoryUsage().heapUsed;
    
    // Calculate average load time
    const ontologies = Array.from(this.cache.values());
    if (ontologies.length > 0) {
      const totalLoadTime = ontologies.reduce((sum, ont) => sum + ont.loadTime, 0);
      this.metrics.averageLoadTime = totalLoadTime / ontologies.length;
    }
  }

  private extractClasses(store: Store): string[] {
    const classes = new Set<string>();
    const rdfType = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
    const rdfsClass = 'http://www.w3.org/2000/01/rdf-schema#Class';
    const owlClass = 'http://www.w3.org/2002/07/owl#Class';
    
    const classQuads = store.getQuads(null, rdfType, rdfsClass, null)
      .concat(store.getQuads(null, rdfType, owlClass, null));
    
    for (const quad of classQuads) {
      if (quad.subject.termType === 'NamedNode') {
        classes.add(quad.subject.value);
      }
    }
    
    return Array.from(classes);
  }

  private extractProperties(store: Store): string[] {
    const properties = new Set<string>();
    const rdfType = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
    const rdfProperty = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#Property';
    const owlObjectProperty = 'http://www.w3.org/2002/07/owl#ObjectProperty';
    const owlDatatypeProperty = 'http://www.w3.org/2002/07/owl#DatatypeProperty';
    
    const propQuads = store.getQuads(null, rdfType, rdfProperty, null)
      .concat(store.getQuads(null, rdfType, owlObjectProperty, null))
      .concat(store.getQuads(null, rdfType, owlDatatypeProperty, null));
    
    for (const quad of propQuads) {
      if (quad.subject.termType === 'NamedNode') {
        properties.add(quad.subject.value);
      }
    }
    
    return Array.from(properties);
  }

  private extractIndividuals(store: Store): string[] {
    // TODO: Implement individual extraction
    return [];
  }

  private extractImports(store: Store): string[] {
    const imports = new Set<string>();
    const owlImports = 'http://www.w3.org/2002/07/owl#imports';
    
    const importQuads = store.getQuads(null, owlImports, null, null);
    for (const quad of importQuads) {
      if (quad.object.termType === 'NamedNode') {
        imports.add(quad.object.value);
      }
    }
    
    return Array.from(imports);
  }
}

export default OntologyCache;