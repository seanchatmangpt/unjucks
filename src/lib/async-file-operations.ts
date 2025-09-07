/**
 * Async File Operations Module - Dark Matter I/O Liberation
 * Eliminates synchronous I/O operations with batched async alternatives
 */

import fs from "fs-extra";
import path from "node:path";
import { tmpdir } from "node:os";

// Performance constants
const MAX_CONCURRENT_OPERATIONS = 20;
const OPERATION_TIMEOUT = 5000;
const CACHE_TTL = 30000; // 30 seconds

// Path validation cache for performance
interface PathValidationEntry {
  result: PathValidationResult;
  timestamp: number;
  realPath: string;
}

export interface PathValidationResult {
  valid: boolean;
  reason?: string;
  sanitizedPath?: string;
}

// Dangerous paths that should be blocked
const DANGEROUS_PATHS = [
  '/etc', '/root', '/sys', '/proc', '/dev', '/var/log',
  'C:\\Windows', 'C:\\Program Files', 'C:\\System32'
];

export class AsyncFileOperations {
  private pathValidationCache = new Map<string, PathValidationEntry>();
  private operationQueue: Promise<any>[] = [];
  private semaphore = new AsyncSemaphore(MAX_CONCURRENT_OPERATIONS);

  /**
   * Batch file existence checks with parallel processing
   */
  async batchPathExists(paths: string[]): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();
    
    // Process paths in batches to avoid overwhelming the system
    const batches = this.chunkArray(paths, MAX_CONCURRENT_OPERATIONS);
    
    for (const batch of batches) {
      const batchResults = await Promise.all(
        batch.map(async (filePath) => {
          try {
            const exists = await this.withTimeout(
              fs.pathExists(filePath),
              OPERATION_TIMEOUT,
              `pathExists timeout for ${filePath}`
            );
            return { path: filePath, exists };
          } catch (error) {
            console.warn(`Path exists check failed for ${filePath}:`, error);
            return { path: filePath, exists: false };
          }
        })
      );
      
      batchResults.forEach(({ path, exists }) => {
        results.set(path, exists);
      });
    }
    
    return results;
  }

  /**
   * Batch file stat operations with parallel processing
   */
  async batchStat(paths: string[]): Promise<Map<string, fs.Stats | null>> {
    const results = new Map<string, fs.Stats | null>();
    
    const batches = this.chunkArray(paths, MAX_CONCURRENT_OPERATIONS);
    
    for (const batch of batches) {
      const batchResults = await Promise.all(
        batch.map(async (filePath) => {
          try {
            const stats = await this.withTimeout(
              fs.stat(filePath),
              OPERATION_TIMEOUT,
              `stat timeout for ${filePath}`
            );
            return { path: filePath, stats };
          } catch (error) {
            return { path: filePath, stats: null };
          }
        })
      );
      
      batchResults.forEach(({ path, stats }) => {
        results.set(path, stats);
      });
    }
    
    return results;
  }

  /**
   * Cached path validation with async operations
   */
  async validateFilePath(filePath: string): Promise<PathValidationResult> {
    // Check cache first
    const cacheKey = path.resolve(filePath);
    const cached = this.pathValidationCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
      return cached.result;
    }

    const result = await this.performPathValidation(filePath);
    
    // Cache the result
    this.pathValidationCache.set(cacheKey, {
      result,
      timestamp: Date.now(),
      realPath: result.sanitizedPath || cacheKey
    });

    return result;
  }

  /**
   * Perform comprehensive async path validation
   */
  private async performPathValidation(filePath: string): Promise<PathValidationResult> {
    try {
      // Basic validation
      if (!filePath) {
        return { valid: false, reason: 'Path cannot be empty' };
      }

      // Check for null bytes and encoded characters
      if (filePath.includes('\0') || filePath.includes('%00') || filePath.includes('\u0000')) {
        return { valid: false, reason: 'Null byte or encoded null detected in path' };
      }

      // Check for URL encoded path traversal
      const decodedPath = decodeURIComponent(filePath);
      if (decodedPath !== filePath && (decodedPath.includes('..') || decodedPath.includes('\0'))) {
        return { valid: false, reason: 'URL encoded path traversal detected' };
      }

      // Resolve path
      const resolved = path.resolve(filePath);
      let realPath: string;

      try {
        // Check if file exists and get real path
        if (await fs.pathExists(resolved)) {
          realPath = await fs.realpath(resolved);
        } else {
          // File doesn't exist - validate parent directory
          const parentDir = path.dirname(resolved);
          if (await fs.pathExists(parentDir)) {
            const realParent = await fs.realpath(parentDir);
            realPath = path.join(realParent, path.basename(resolved));
          } else {
            realPath = resolved;
          }
        }
      } catch (error) {
        return { valid: false, reason: `Path resolution failed: ${error}` };
      }

      // Check for path traversal patterns
      if (resolved.includes('..') || realPath.includes('..')) {
        return { valid: false, reason: 'Path traversal detected in resolved/real path' };
      }

      // Validate against allowed directories
      const isAllowed = await this.validateAllowedDirectories(realPath);
      if (!isAllowed) {
        return { valid: false, reason: `Path outside allowed directories: ${realPath}` };
      }

      // Block dangerous system paths
      for (const dangerousPath of DANGEROUS_PATHS) {
        if (resolved.toLowerCase().startsWith(dangerousPath.toLowerCase()) || 
            realPath.toLowerCase().startsWith(dangerousPath.toLowerCase())) {
          return { valid: false, reason: `Access to system directory blocked: ${dangerousPath}` };
        }
      }

      // Check path length
      if (resolved.length > 4096 || realPath.length > 4096) {
        return { valid: false, reason: 'Path too long (>4096 characters)' };
      }

      // Platform-specific validation
      const platformValidation = await this.validatePlatformSpecific(resolved, realPath);
      if (!platformValidation.valid) {
        return platformValidation;
      }

      return { valid: true, sanitizedPath: realPath };
    } catch (error) {
      return { valid: false, reason: `Path validation error: ${error}` };
    }
  }

  /**
   * Validate against allowed directories asynchronously
   */
  private async validateAllowedDirectories(realPath: string): Promise<boolean> {
    try {
      const cwd = process.cwd();
      const [realCwd, realTmp] = await Promise.all([
        fs.realpath(cwd),
        fs.realpath('/tmp').catch(() => null)
      ]);

      const allowedPrefixes = [
        realCwd,                    // Current working directory
        realTmp,                    // System temp directory
        path.resolve('./tmp'),      // Project temp directory
        tmpdir()                    // OS temp directory
      ].filter(Boolean) as string[];

      // Check if path is within any allowed directory
      return allowedPrefixes.some(allowedPath => {
        try {
          return realPath.startsWith(allowedPath);
        } catch {
          return false;
        }
      });
    } catch {
      return false;
    }
  }

  /**
   * Platform-specific validation (Windows/Unix)
   */
  private async validatePlatformSpecific(resolved: string, realPath: string): Promise<PathValidationResult> {
    if (process.platform === 'win32') {
      // Windows validation
      const windowsDevices = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];
      
      const resolvedBaseName = path.basename(resolved).toUpperCase().split('.')[0];
      const realBaseName = path.basename(realPath).toUpperCase().split('.')[0];
      
      if (windowsDevices.includes(resolvedBaseName) || windowsDevices.includes(realBaseName)) {
        return { valid: false, reason: `Windows device name detected: ${resolvedBaseName || realBaseName}` };
      }

      // Check for reserved characters
      const reservedChars = /[<>:"|?*]/;
      if (reservedChars.test(resolved) || reservedChars.test(realPath)) {
        return { valid: false, reason: 'Windows reserved characters detected in path' };
      }
    } else {
      // Unix/Linux symlink validation
      const validation = await this.validateSymlinks(realPath);
      if (!validation.valid) {
        return validation;
      }
    }

    return { valid: true };
  }

  /**
   * Validate symlinks asynchronously (Unix/Linux)
   */
  private async validateSymlinks(realPath: string): Promise<PathValidationResult> {
    try {
      const pathComponents = realPath.split(path.sep);
      let currentPath = path.sep;
      
      for (const component of pathComponents.slice(1)) {
        currentPath = path.join(currentPath, component);
        
        if (await fs.pathExists(currentPath)) {
          const stats = await fs.lstat(currentPath);
          if (stats.isSymbolicLink()) {
            const linkTarget = await fs.readlink(currentPath);
            
            // Block relative symlinks that could escape
            if (linkTarget.startsWith('../') || linkTarget.includes('../')) {
              return { valid: false, reason: `Malicious symlink detected: ${currentPath} -> ${linkTarget}` };
            }
            
            // Block absolute symlinks to dangerous paths
            if (path.isAbsolute(linkTarget)) {
              for (const dangerousPath of DANGEROUS_PATHS) {
                if (linkTarget.toLowerCase().startsWith(dangerousPath.toLowerCase())) {
                  return { valid: false, reason: `Symlink points to dangerous absolute path: ${linkTarget}` };
                }
              }
            }
          }
        }
      }
      
      return { valid: true };
    } catch (error) {
      return { valid: false, reason: `Symlink validation failed: ${error}` };
    }
  }

  /**
   * Clear expired cache entries
   */
  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.pathValidationCache.entries()) {
      if (now - entry.timestamp > CACHE_TTL) {
        this.pathValidationCache.delete(key);
      }
    }
  }

  /**
   * Utility: Add timeout to async operations
   */
  private withTimeout<T>(promise: Promise<T>, ms: number, errorMessage: string): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(errorMessage)), ms)
      )
    ]);
  }

  /**
   * Utility: Chunk array for batch processing
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Get cache statistics for monitoring
   */
  getCacheStats(): { size: number; hitRate: number } {
    this.cleanupCache();
    return {
      size: this.pathValidationCache.size,
      hitRate: 0 // TODO: Implement hit rate tracking
    };
  }
}

/**
 * Async semaphore for controlling concurrent operations
 */
class AsyncSemaphore {
  private permits: number;
  private queue: Array<{ resolve: () => void; reject: (error: Error) => void }> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.permits > 0) {
        this.permits--;
        resolve();
      } else {
        this.queue.push({ resolve, reject });
      }
    });
  }

  release(): void {
    this.permits++;
    if (this.queue.length > 0) {
      this.permits--;
      const { resolve } = this.queue.shift()!;
      resolve();
    }
  }
}

// Singleton instance for global use
export const asyncFileOperations = new AsyncFileOperations();