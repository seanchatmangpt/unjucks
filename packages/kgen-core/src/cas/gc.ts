import { promises as fs } from 'fs';
import { join } from 'path';
import { ContentAddressedStorage, ContentType, StoredContent } from './storage.js';

export interface GCOptions {
  dryRun?: boolean;
  verbose?: boolean;
  maxAge?: number; // Max age in days
  minRefCount?: number; // Minimum reference count to keep
  preserveTypes?: ContentType[];
  maxCacheSize?: number; // Max cache size in bytes
}

export interface GCStats {
  totalItems: number;
  deletedItems: number;
  bytesFreed: number;
  duration: number;
  errors: string[];
}

export interface RefCountEntry {
  hash: string;
  type: ContentType;
  refCount: number;
  lastAccessed?: Date;
  size: number;
}

export class GarbageCollector {
  private refCounts = new Map<string, number>();
  private accessTimes = new Map<string, Date>();

  constructor(private storage: ContentAddressedStorage) {}

  /**
   * Run garbage collection with specified options
   */
  async collect(options: GCOptions = {}): Promise<GCStats> {
    const startTime = Date.now();
    const stats: GCStats = {
      totalItems: 0,
      deletedItems: 0,
      bytesFreed: 0,
      duration: 0,
      errors: []
    };

    try {
      if (options.verbose) {
        console.log('Starting garbage collection...');
      }

      // Load reference counts and access times
      await this.loadReferenceData();

      // Get all stored content
      const allContent = await this.storage.list();
      stats.totalItems = allContent.length;

      if (options.verbose) {
        console.log(`Found ${stats.totalItems} items in cache`);
      }

      // Determine what to delete based on options
      const toDelete = await this.determineItemsToDelete(allContent, options);

      if (options.verbose) {
        console.log(`Marked ${toDelete.length} items for deletion`);
      }

      // Delete items (or just report in dry run)
      for (const item of toDelete) {
        try {
          if (options.dryRun) {
            if (options.verbose) {
              console.log(`[DRY RUN] Would delete: ${item.hash} (${item.type}, ${item.size} bytes)`);
            }
          } else {
            await this.deleteItem(item);
            if (options.verbose) {
              console.log(`Deleted: ${item.hash} (${item.type}, ${item.size} bytes)`);
            }
          }

          stats.deletedItems++;
          stats.bytesFreed += item.size;
        } catch (error) {
          const errorMsg = `Failed to delete ${item.hash}: ${error}`;
          stats.errors.push(errorMsg);
          if (options.verbose) {
            console.error(errorMsg);
          }
        }
      }

      // Update reference counts file
      if (!options.dryRun && stats.deletedItems > 0) {
        await this.saveReferenceData();
      }

    } catch (error) {
      stats.errors.push(`GC failed: ${error}`);
    }

    stats.duration = Date.now() - startTime;

    if (options.verbose) {
      this.printStats(stats, options.dryRun || false);
    }

    return stats;
  }

  /**
   * Mark content as accessed (updates LRU tracking)
   */
  markAccessed(hash: string): void {
    this.accessTimes.set(hash, new Date());
  }

  /**
   * Increment reference count for content
   */
  incrementRef(hash: string): void {
    const current = this.refCounts.get(hash) || 0;
    this.refCounts.set(hash, current + 1);
  }

  /**
   * Decrement reference count for content
   */
  decrementRef(hash: string): void {
    const current = this.refCounts.get(hash) || 0;
    if (current > 0) {
      this.refCounts.set(hash, current - 1);
    }
  }

  /**
   * Get reference count for content
   */
  getRefCount(hash: string): number {
    return this.refCounts.get(hash) || 0;
  }

  /**
   * Get all reference count entries
   */
  async getAllRefCounts(): Promise<RefCountEntry[]> {
    const allContent = await this.storage.list();
    const entries: RefCountEntry[] = [];

    for (const content of allContent) {
      entries.push({
        hash: content.hash,
        type: content.type,
        refCount: this.getRefCount(content.hash),
        lastAccessed: this.accessTimes.get(content.hash),
        size: content.size
      });
    }

    return entries.sort((a, b) => b.refCount - a.refCount);
  }

  /**
   * Find orphaned content (zero references)
   */
  async findOrphans(): Promise<StoredContent[]> {
    const allContent = await this.storage.list();
    return allContent.filter(content => this.getRefCount(content.hash) === 0);
  }

  /**
   * Estimate cache size
   */
  async getCacheSize(): Promise<{ totalSize: number; itemCount: number; sizeByType: Record<ContentType, number> }> {
    const allContent = await this.storage.list();
    let totalSize = 0;
    const sizeByType: Record<ContentType, number> = {
      graphs: 0,
      templates: 0,
      artifacts: 0,
      packs: 0
    };

    for (const content of allContent) {
      totalSize += content.size;
      sizeByType[content.type] += content.size;
    }

    return {
      totalSize,
      itemCount: allContent.length,
      sizeByType
    };
  }

  /**
   * Clean up by cache size limit
   */
  async cleanupByCacheSize(maxSize: number, options: { dryRun?: boolean; verbose?: boolean } = {}): Promise<GCStats> {
    const cacheInfo = await this.getCacheSize();
    
    if (cacheInfo.totalSize <= maxSize) {
      return {
        totalItems: cacheInfo.itemCount,
        deletedItems: 0,
        bytesFreed: 0,
        duration: 0,
        errors: []
      };
    }

    const bytesToFree = cacheInfo.totalSize - maxSize;
    const allContent = await this.storage.list();
    
    // Sort by LRU and reference count (prioritize low-ref, old items)
    const sortedContent = allContent.sort((a, b) => {
      const aRefCount = this.getRefCount(a.hash);
      const bRefCount = this.getRefCount(b.hash);
      
      if (aRefCount !== bRefCount) {
        return aRefCount - bRefCount; // Lower ref count first
      }
      
      const aAccessed = this.accessTimes.get(a.hash) || a.createdAt;
      const bAccessed = this.accessTimes.get(b.hash) || b.createdAt;
      
      return aAccessed.getTime() - bAccessed.getTime(); // Older first
    });

    // Select items to delete until we free enough space
    const toDelete: StoredContent[] = [];
    let bytesFreed = 0;

    for (const content of sortedContent) {
      toDelete.push(content);
      bytesFreed += content.size;
      
      if (bytesFreed >= bytesToFree) {
        break;
      }
    }

    return this.collect({
      ...options,
      // Custom filter to only delete selected items
      dryRun: options.dryRun
    });
  }

  /**
   * Determine which items to delete based on options
   */
  private async determineItemsToDelete(allContent: StoredContent[], options: GCOptions): Promise<StoredContent[]> {
    const toDelete: StoredContent[] = [];
    const now = new Date();
    const maxAgeMs = (options.maxAge || Infinity) * 24 * 60 * 60 * 1000;

    for (const content of allContent) {
      // Skip preserved types
      if (options.preserveTypes?.includes(content.type)) {
        continue;
      }

      const refCount = this.getRefCount(content.hash);
      const age = now.getTime() - content.createdAt.getTime();
      const lastAccessed = this.accessTimes.get(content.hash);
      const accessAge = lastAccessed ? now.getTime() - lastAccessed.getTime() : age;

      let shouldDelete = false;

      // Delete if ref count is below minimum
      if (refCount < (options.minRefCount || 1)) {
        shouldDelete = true;
      }

      // Delete if too old
      if (age > maxAgeMs || accessAge > maxAgeMs) {
        shouldDelete = true;
      }

      if (shouldDelete) {
        toDelete.push(content);
      }
    }

    // If cache size limit is set, add more items if needed
    if (options.maxCacheSize) {
      const remainingContent = allContent.filter(c => !toDelete.includes(c));
      const currentSize = remainingContent.reduce((sum, c) => sum + c.size, 0);
      
      if (currentSize > options.maxCacheSize) {
        const additionalToDelete = this.selectItemsForSizeLimit(
          remainingContent,
          currentSize - options.maxCacheSize
        );
        toDelete.push(...additionalToDelete);
      }
    }

    return toDelete;
  }

  /**
   * Select additional items to delete to meet size limit
   */
  private selectItemsForSizeLimit(content: StoredContent[], bytesToFree: number): StoredContent[] {
    // Sort by LRU and reference count (prioritize low-ref, old items)
    const sorted = content.sort((a, b) => {
      const aRefCount = this.getRefCount(a.hash);
      const bRefCount = this.getRefCount(b.hash);
      
      if (aRefCount !== bRefCount) {
        return aRefCount - bRefCount;
      }
      
      const aAccessed = this.accessTimes.get(a.hash) || a.createdAt;
      const bAccessed = this.accessTimes.get(b.hash) || b.createdAt;
      
      return aAccessed.getTime() - bAccessed.getTime();
    });

    const toDelete: StoredContent[] = [];
    let bytesFreed = 0;

    for (const item of sorted) {
      toDelete.push(item);
      bytesFreed += item.size;
      
      if (bytesFreed >= bytesToFree) {
        break;
      }
    }

    return toDelete;
  }

  /**
   * Delete a single item from storage
   */
  private async deleteItem(content: StoredContent): Promise<void> {
    try {
      // Delete the content file
      await fs.unlink(content.path);
      
      // Try to delete compressed version if it exists
      try {
        await fs.unlink(content.path + '.gz');
      } catch {
        // Ignore if compressed version doesn't exist
      }

      // Delete metadata
      const metadataPath = join(this.storage.getStoragePath('graphs', '').replace('/graphs/', '/metadata/'), `${content.hash}.json`);
      try {
        await fs.unlink(metadataPath);
      } catch {
        // Ignore if metadata doesn't exist
      }

      // Remove from reference counts
      this.refCounts.delete(content.hash);
      this.accessTimes.delete(content.hash);

      // Try to remove empty directory
      try {
        await fs.rmdir(join(content.path, '..'));
      } catch {
        // Ignore if directory is not empty or doesn't exist
      }
    } catch (error) {
      throw new Error(`Failed to delete ${content.hash}: ${error}`);
    }
  }

  /**
   * Load reference counts and access times from disk
   */
  private async loadReferenceData(): Promise<void> {
    const cacheDir = this.storage.getStoragePath('graphs', '').replace('/graphs/', '');
    const refCountPath = join(cacheDir, 'refcounts.json');
    const accessTimePath = join(cacheDir, 'access-times.json');

    try {
      const refCountData = await fs.readFile(refCountPath, 'utf8');
      const refCounts = JSON.parse(refCountData);
      this.refCounts = new Map(Object.entries(refCounts).map(([k, v]) => [k, v as number]));
    } catch {
      // File doesn't exist or is invalid, start fresh
      this.refCounts.clear();
    }

    try {
      const accessTimeData = await fs.readFile(accessTimePath, 'utf8');
      const accessTimes = JSON.parse(accessTimeData);
      this.accessTimes = new Map(Object.entries(accessTimes).map(([k, v]) => [k, new Date(v as string)]));
    } catch {
      // File doesn't exist or is invalid, start fresh
      this.accessTimes.clear();
    }
  }

  /**
   * Save reference counts and access times to disk
   */
  private async saveReferenceData(): Promise<void> {
    const cacheDir = this.storage.getStoragePath('graphs', '').replace('/graphs/', '');
    
    // Ensure cache directory exists
    try {
      await fs.mkdir(cacheDir, { recursive: true });
    } catch {
      // Directory might already exist
    }

    const refCountPath = join(cacheDir, 'refcounts.json');
    const accessTimePath = join(cacheDir, 'access-times.json');

    // Save reference counts
    const refCountObj = Object.fromEntries(this.refCounts);
    await fs.writeFile(refCountPath, JSON.stringify(refCountObj, null, 2));

    // Save access times
    const accessTimeObj = Object.fromEntries(
      Array.from(this.accessTimes.entries()).map(([k, v]) => [k, v.toISOString()])
    );
    await fs.writeFile(accessTimePath, JSON.stringify(accessTimeObj, null, 2));
  }

  /**
   * Print garbage collection statistics
   */
  private printStats(stats: GCStats, dryRun: boolean): void {
    console.log('\n=== Garbage Collection Results ===');
    console.log(`Mode: ${dryRun ? 'DRY RUN' : 'ACTUAL'}`);
    console.log(`Total items: ${stats.totalItems}`);
    console.log(`${dryRun ? 'Would delete' : 'Deleted'}: ${stats.deletedItems} items`);
    console.log(`${dryRun ? 'Would free' : 'Freed'}: ${(stats.bytesFreed / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Duration: ${stats.duration}ms`);
    
    if (stats.errors.length > 0) {
      console.log(`Errors: ${stats.errors.length}`);
      stats.errors.forEach(error => console.log(`  - ${error}`));
    }
    
    console.log('=====================================\n');
  }
}

export default GarbageCollector;