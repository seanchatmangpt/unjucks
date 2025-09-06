import fs from "fs-extra";
import path from "node:path";
import { createHash } from "node:crypto";

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  hash: string;
}

interface TemplateCacheOptions {
  maxAge?: number; // Cache TTL in milliseconds
  maxEntries?: number; // Maximum cache entries
  persistent?: boolean; // Use filesystem cache
  cacheDir?: string; // Cache directory for persistent cache
}

export class TemplateCache<T = any> {
  private memoryCache = new Map<string, CacheEntry<T>>();
  private options: Required<TemplateCacheOptions>;
  private cacheDir: string;

  constructor(options: TemplateCacheOptions = {}) {
    this.options = {
      maxAge: options.maxAge ?? 5 * 60 * 1000, // 5 minutes default
      maxEntries: options.maxEntries ?? 100,
      persistent: options.persistent ?? true,
      cacheDir: options.cacheDir ?? path.join(process.cwd(), '.unjucks-cache')
    };

    this.cacheDir = this.options.cacheDir;
    
    if (this.options.persistent) {
      this.initPersistentCache();
    }
  }

  private async initPersistentCache(): Promise<void> {
    try {
      await fs.ensureDir(this.cacheDir);
    } catch (error) {
      console.warn('Failed to initialize persistent cache:', error);
      this.options.persistent = false;
    }
  }

  private generateKey(keyParts: string[]): string {
    const combined = keyParts.join(':');
    return createHash('md5').update(combined).digest('hex');
  }

  private async getFileHash(filePath: string): Promise<string> {
    try {
      const stat = await fs.stat(filePath);
      return `${stat.mtime.getTime()}-${stat.size}`;
    } catch {
      return 'unknown';
    }
  }

  private getCacheFilePath(key: string): string {
    return path.join(this.cacheDir, `${key}.json`);
  }

  private isExpired(entry: CacheEntry<T>): boolean {
    return Date.now() - entry.timestamp > this.options.maxAge;
  }

  private async loadFromPersistent(key: string): Promise<CacheEntry<T> | null> {
    if (!this.options.persistent) return null;

    try {
      const cacheFile = this.getCacheFilePath(key);
      if (await fs.pathExists(cacheFile)) {
        const data = await fs.readJSON(cacheFile);
        if (!this.isExpired(data)) {
          return data;
        } else {
          // Clean up expired cache file
          await fs.remove(cacheFile);
        }
      }
    } catch (error) {
      // Ignore cache read errors
    }

    return null;
  }

  private async saveToPersistent(key: string, entry: CacheEntry<T>): Promise<void> {
    if (!this.options.persistent) return;

    try {
      const cacheFile = this.getCacheFilePath(key);
      await fs.writeJSON(cacheFile, entry, { spaces: 0 });
    } catch (error) {
      // Ignore cache write errors
    }
  }

  private evictOldEntries(): void {
    if (this.memoryCache.size <= this.options.maxEntries) return;

    // Sort by timestamp and remove oldest entries
    const entries = Array.from(this.memoryCache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp);

    const toRemove = entries.slice(0, entries.length - this.options.maxEntries);
    
    for (const [key] of toRemove) {
      this.memoryCache.delete(key);
    }
  }

  async get(keyParts: string[], filePath?: string): Promise<T | null> {
    const key = this.generateKey(keyParts);
    
    // Check memory cache first
    let entry = this.memoryCache.get(key);
    
    if (entry && !this.isExpired(entry)) {
      // Validate file-based cache if filePath provided
      if (filePath) {
        const currentHash = await this.getFileHash(filePath);
        if (entry.hash !== currentHash) {
          // File changed, invalidate cache
          this.memoryCache.delete(key);
          entry = null;
        }
      }
      
      if (entry) return entry.data;
    }

    // Check persistent cache
    entry = await this.loadFromPersistent(key);
    if (entry) {
      // Validate file-based cache if filePath provided
      if (filePath) {
        const currentHash = await this.getFileHash(filePath);
        if (entry.hash === currentHash) {
          // Restore to memory cache
          this.memoryCache.set(key, entry);
          return entry.data;
        }
      } else {
        this.memoryCache.set(key, entry);
        return entry.data;
      }
    }

    return null;
  }

  async set(keyParts: string[], data: T, filePath?: string): Promise<void> {
    const key = this.generateKey(keyParts);
    const hash = filePath ? await this.getFileHash(filePath) : 'static';
    
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      hash
    };

    // Store in memory cache
    this.memoryCache.set(key, entry);
    this.evictOldEntries();

    // Store in persistent cache
    await this.saveToPersistent(key, entry);
  }

  async invalidate(keyParts: string[]): Promise<void> {
    const key = this.generateKey(keyParts);
    
    // Remove from memory cache
    this.memoryCache.delete(key);
    
    // Remove from persistent cache
    if (this.options.persistent) {
      try {
        const cacheFile = this.getCacheFilePath(key);
        await fs.remove(cacheFile);
      } catch {
        // Ignore removal errors
      }
    }
  }

  async clear(): Promise<void> {
    // Clear memory cache
    this.memoryCache.clear();
    
    // Clear persistent cache
    if (this.options.persistent) {
      try {
        await fs.remove(this.cacheDir);
        await this.initPersistentCache();
      } catch {
        // Ignore clear errors
      }
    }
  }

  getStats(): { memoryEntries: number; memorySize: number } {
    const memorySize = Array.from(this.memoryCache.values())
      .reduce((size, entry) => size + JSON.stringify(entry).length, 0);

    return {
      memoryEntries: this.memoryCache.size,
      memorySize
    };
  }

  async cleanup(): Promise<void> {
    if (!this.options.persistent) return;

    try {
      const files = await fs.readdir(this.cacheDir);
      const now = Date.now();

      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        const filePath = path.join(this.cacheDir, file);
        try {
          const entry = await fs.readJSON(filePath);
          if (now - entry.timestamp > this.options.maxAge) {
            await fs.remove(filePath);
          }
        } catch {
          // Remove corrupted cache files
          await fs.remove(filePath);
        }
      }
    } catch {
      // Ignore cleanup errors
    }
  }
}

// Global template cache instances
export const templateScanCache = new TemplateCache({
  maxAge: 10 * 60 * 1000, // 10 minutes for template scans
  maxEntries: 50,
  persistent: true,
  cacheDir: path.join(process.cwd(), '.unjucks-cache', 'templates')
});

export const generatorListCache = new TemplateCache({
  maxAge: 5 * 60 * 1000, // 5 minutes for generator lists
  maxEntries: 10,
  persistent: true,
  cacheDir: path.join(process.cwd(), '.unjucks-cache', 'generators')
});

export const nunjucksTemplateCache = new TemplateCache({
  maxAge: 15 * 60 * 1000, // 15 minutes for compiled templates
  maxEntries: 200,
  persistent: false, // Memory only for compiled templates
});