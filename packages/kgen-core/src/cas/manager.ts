import { ContentAddressedStorage, CASConfig, ContentType } from './storage.js';
import { ContentRetrieval, RetrievalOptions } from './retrieval.js';
import { GarbageCollector, GCOptions } from './gc.js';
import { ensureCacheStructure, getCacheStructure } from './utils.js';

/**
 * High-level Content-Addressed Storage Manager
 * 
 * Provides a unified interface for CAS operations, combining storage,
 * retrieval, and garbage collection functionality.
 */
export class CASManager {
  private storage: ContentAddressedStorage;
  private retrieval: ContentRetrieval;
  private gc: GarbageCollector;
  private config: Required<CASConfig>;

  constructor(config: CASConfig) {
    this.config = {
      compression: false,
      maxFileSize: 100 * 1024 * 1024, // 100MB
      ...config
    };

    this.storage = new ContentAddressedStorage(this.config);
    this.retrieval = new ContentRetrieval(this.storage);
    this.gc = new GarbageCollector(this.storage);
  }

  /**
   * Initialize the CAS system (create directories, etc.)
   */
  async initialize(): Promise<void> {
    await ensureCacheStructure(this.config.cacheDir);
  }

  /**
   * Store content and return its hash
   */
  async store(content: Buffer | string, type: ContentType, filename?: string): Promise<string> {
    const hash = await this.storage.store(content, type, filename);
    this.gc.markAccessed(hash);
    return hash;
  }

  /**
   * Store file by path
   */
  async storeFile(filePath: string, type: ContentType, filename?: string): Promise<string> {
    const hash = await this.storage.storeFile(filePath, type, filename);
    this.gc.markAccessed(hash);
    return hash;
  }

  /**
   * Store multiple files as a pack
   */
  async storePack(files: Record<string, Buffer | string>, packName: string): Promise<string> {
    const hash = await this.storage.storePack(files, packName);
    this.gc.markAccessed(hash);
    return hash;
  }

  /**
   * Retrieve content by hash
   */
  async retrieve(hash: string, type: ContentType, options?: RetrievalOptions): Promise<Buffer | null> {
    this.gc.markAccessed(hash);
    return this.retrieval.retrieve(hash, type, options);
  }

  /**
   * Retrieve content as text
   */
  async retrieveText(hash: string, type: ContentType, encoding: BufferEncoding = 'utf8', options?: RetrievalOptions): Promise<string | null> {
    this.gc.markAccessed(hash);
    return this.retrieval.retrieveText(hash, type, encoding, options);
  }

  /**
   * Retrieve pack contents
   */
  async retrievePack(hash: string): Promise<Record<string, Buffer> | null> {
    this.gc.markAccessed(hash);
    return this.retrieval.retrievePack(hash);
  }

  /**
   * Retrieve specific file from pack
   */
  async retrieveFromPack(packHash: string, filename: string): Promise<Buffer | null> {
    this.gc.markAccessed(packHash);
    return this.retrieval.retrieveFromPack(packHash, filename);
  }

  /**
   * Check if content exists
   */
  async exists(hash: string, type: ContentType, verifyIntegrity = false): Promise<boolean> {
    return this.retrieval.exists(hash, type, verifyIntegrity);
  }

  /**
   * List stored content
   */
  async list(type?: ContentType) {
    return this.storage.list(type);
  }

  /**
   * Get content metadata
   */
  async getMetadata(hash: string) {
    return this.storage.getMetadata(hash);
  }

  /**
   * Verify content integrity
   */
  async verifyIntegrity(hash: string, type: ContentType): Promise<boolean> {
    const content = await this.retrieval.retrieve(hash, type, { verifyIntegrity: false });
    if (!content) return false;
    
    return this.retrieval.verifyIntegrity(content, hash);
  }

  /**
   * Export content to external location
   */
  async export(hash: string, type: ContentType, targetPath: string): Promise<boolean> {
    this.gc.markAccessed(hash);
    return this.retrieval.export(hash, type, targetPath);
  }

  /**
   * Add reference to content
   */
  addReference(hash: string): void {
    this.gc.incrementRef(hash);
  }

  /**
   * Remove reference from content
   */
  removeReference(hash: string): void {
    this.gc.decrementRef(hash);
  }

  /**
   * Get reference count
   */
  getRefCount(hash: string): number {
    return this.gc.getRefCount(hash);
  }

  /**
   * Run garbage collection
   */
  async runGC(options?: GCOptions) {
    return this.gc.collect(options);
  }

  /**
   * Find orphaned content
   */
  async findOrphans() {
    return this.gc.findOrphans();
  }

  /**
   * Get cache size information
   */
  async getCacheSize() {
    return this.gc.getCacheSize();
  }

  /**
   * Cleanup by cache size limit
   */
  async cleanupByCacheSize(maxSize: number, options?: { dryRun?: boolean; verbose?: boolean }) {
    return this.gc.cleanupByCacheSize(maxSize, options);
  }

  /**
   * Get cache structure information
   */
  getCacheStructure() {
    return getCacheStructure(this.config.cacheDir);
  }

  /**
   * Get storage configuration
   */
  getConfig(): Required<CASConfig> {
    return { ...this.config };
  }

  /**
   * Perform cache health check
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    issues: string[];
    stats: {
      totalItems: number;
      totalSize: number;
      orphanedItems: number;
      corruptedItems: number;
    };
  }> {
    const issues: string[] = [];
    const stats = {
      totalItems: 0,
      totalSize: 0,
      orphanedItems: 0,
      corruptedItems: 0
    };

    try {
      // Check cache directories exist
      const structure = getCacheStructure(this.config.cacheDir);
      for (const [type, path] of Object.entries(structure)) {
        try {
          await ensureCacheStructure(path);
        } catch (error) {
          issues.push(`Cannot access ${type} directory: ${path}`);
        }
      }

      // Get basic stats
      const cacheSize = await this.getCacheSize();
      stats.totalItems = cacheSize.itemCount;
      stats.totalSize = cacheSize.totalSize;

      // Check for orphans
      const orphans = await this.findOrphans();
      stats.orphanedItems = orphans.length;

      // Check for corruption (sample check)
      const allContent = await this.list();
      const sampleSize = Math.min(10, allContent.length);
      
      for (let i = 0; i < sampleSize; i++) {
        const content = allContent[i];
        const isValid = await this.verifyIntegrity(content.hash, content.type);
        
        if (!isValid) {
          stats.corruptedItems++;
          issues.push(`Corrupted content: ${content.hash} (${content.type})`);
        }
      }

      // Check cache size limits
      if (this.config.maxFileSize && stats.totalSize > this.config.maxFileSize * 10) {
        issues.push(`Cache size (${stats.totalSize}) is very large`);
      }

    } catch (error) {
      issues.push(`Health check failed: ${error}`);
    }

    return {
      healthy: issues.length === 0,
      issues,
      stats
    };
  }

  /**
   * Perform cache optimization
   */
  async optimize(options: {
    dryRun?: boolean;
    verbose?: boolean;
    maxCacheSize?: number;
    maxAge?: number;
  } = {}): Promise<{
    gcStats: any;
    optimizationApplied: string[];
  }> {
    const optimizationApplied: string[] = [];

    // Run garbage collection
    const gcOptions: GCOptions = {
      dryRun: options.dryRun,
      verbose: options.verbose,
      maxAge: options.maxAge,
      minRefCount: 1
    };

    if (options.maxCacheSize) {
      gcOptions.maxCacheSize = options.maxCacheSize;
      optimizationApplied.push('cache size limit');
    }

    if (options.maxAge) {
      optimizationApplied.push('age-based cleanup');
    }

    const gcStats = await this.runGC(gcOptions);

    // Additional optimizations could be added here:
    // - Compression of old content
    // - Deduplication
    // - Index rebuilding

    return {
      gcStats,
      optimizationApplied
    };
  }

  /**
   * Create a backup of the cache
   */
  async backup(backupPath: string): Promise<void> {
    // This would create a backup of the entire cache
    // Implementation would depend on requirements (tar, zip, etc.)
    throw new Error('Backup functionality not yet implemented');
  }

  /**
   * Restore cache from backup
   */
  async restore(backupPath: string): Promise<void> {
    // This would restore cache from a backup
    // Implementation would depend on backup format
    throw new Error('Restore functionality not yet implemented');
  }
}

export default CASManager;