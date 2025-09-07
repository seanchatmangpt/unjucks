/**
 * FileLockManager - Thread-safe locking mechanisms
 * Handles file locking with versioning to prevent ABA problems and race conditions
 */

import path from "node:path";
import { createHash } from "node:crypto";
import type { IFileLockManager, FileLock } from "./interfaces.js";
import { SECURITY_CONSTANTS } from "./interfaces.js";

export class FileLockManager implements IFileLockManager {
  private fileLocks = new Map<string, FileLock>();
  private lockTimeouts = new Map<string, NodeJS.Timeout>();
  private lockVersions = new Map<string, number>();
  private cleanupInProgress = new Set<string>();
  private lockAcquisitionQueue = new Map<string, Array<{
    resolve: (value: FileLock) => void;
    reject: (reason?: any) => void;
    lockId: string;
    timeoutId?: NodeJS.Timeout;
  }>>();

  /**
   * Execute operation with file lock protection
   */
  async withLock<T>(filePath: string, operation: () => Promise<T>): Promise<T> {
    const normalizedPath = path.resolve(filePath);
    const processId = process.pid;
    const lockId = createHash('sha256')
      .update(`${normalizedPath}-${processId}-${Date.now()}-${Math.random()}`)
      .digest('hex')
      .slice(0, 16);
    
    return new Promise<T>((resolve, reject) => {
      this.acquireFileLockAtomic(normalizedPath, lockId, processId)
        .then(async (lock) => {
          try {
            const operationTimeout = new Promise<never>((_, rejectTimeout) => 
              setTimeout(() => rejectTimeout(new Error(`Operation timeout: ${filePath}`)), 
                SECURITY_CONSTANTS.FILE_OPERATION_TIMEOUT)
            );
            
            const result = await Promise.race([operation(), operationTimeout]);
            resolve(result);
          } catch (error) {
            reject(error);
          } finally {
            this.releaseFileLockAtomic(normalizedPath, lock);
          }
        })
        .catch(reject);
    });
  }

  /**
   * Atomically acquire file lock with versioning to prevent ABA problems
   */
  private async acquireFileLockAtomic(
    normalizedPath: string, 
    lockId: string, 
    processId: number
  ): Promise<FileLock> {
    return new Promise<FileLock>((resolve, reject) => {
      const attemptAcquisition = () => {
        // Atomic check-and-set operation using Map operations
        const existingLock = this.fileLocks.get(normalizedPath);
        const currentVersion = this.lockVersions.get(normalizedPath) || 0;
        
        if (!existingLock || !existingLock.acquired) {
          // Atomic acquisition - create new lock with version increment
          const newVersion = currentVersion + 1;
          const lockPromise = Promise.resolve(); // Placeholder, will be replaced with actual operation
          
          const lock: FileLock = {
            promise: lockPromise,
            timestamp: Date.now(),
            lockId,
            version: newVersion,
            processId,
            acquired: true
          };
          
          // Atomic set operations
          this.fileLocks.set(normalizedPath, lock);
          this.lockVersions.set(normalizedPath, newVersion);
          
          // Set cleanup timeout with version check
          const cleanupTimeout = setTimeout(() => {
            this.atomicCleanupLockIfOwned(normalizedPath, lockId, newVersion);
          }, SECURITY_CONSTANTS.FILE_OPERATION_TIMEOUT * 2);
          
          this.lockTimeouts.set(normalizedPath, cleanupTimeout);
          
          // Perform non-blocking expired locks cleanup
          setImmediate(() => this.cleanupExpiredLocks());
          
          resolve(lock);
          return;
        }
        
        // Lock is held, queue this request
        if (!this.lockAcquisitionQueue.has(normalizedPath)) {
          this.lockAcquisitionQueue.set(normalizedPath, []);
        }
        
        const queue = this.lockAcquisitionQueue.get(normalizedPath)!;
        const queueEntry = { 
          resolve, 
          reject, 
          lockId, 
          timeoutId: undefined as NodeJS.Timeout | undefined 
        };
        queue.push(queueEntry);
        
        // Set timeout for queued request
        const timeoutId = setTimeout(() => {
          const index = queue.indexOf(queueEntry);
          if (index !== -1) {
            queue.splice(index, 1);
            if (queue.length === 0) {
              this.lockAcquisitionQueue.delete(normalizedPath);
            }
            reject(new Error(`Lock acquisition timeout: ${normalizedPath}`));
          }
        }, SECURITY_CONSTANTS.FILE_OPERATION_TIMEOUT);
        
        // Store timeout for cleanup
        queueEntry.timeoutId = timeoutId;
        
        // Wait for existing lock to be released
        if (existingLock && existingLock.promise) {
          existingLock.promise
            .finally(() => {
              // Retry acquisition when lock is released
              setImmediate(attemptAcquisition);
            })
            .catch(() => {
              // Lock operation failed, retry acquisition
              setImmediate(attemptAcquisition);
            });
        } else {
          // Retry after brief delay
          setTimeout(attemptAcquisition, 10);
        }
      };
      
      attemptAcquisition();
    });
  }

  /**
   * Atomically release file lock and process queue
   */
  private releaseFileLockAtomic(normalizedPath: string, lock: FileLock): void {
    const existingLock = this.fileLocks.get(normalizedPath);
    
    // Verify ownership using lock ID and version (prevents ABA problems)
    if (existingLock && existingLock.lockId === lock.lockId && existingLock.version === lock.version) {
      // Atomic release operations
      this.fileLocks.delete(normalizedPath);
      
      // Clear timeout
      const timeout = this.lockTimeouts.get(normalizedPath);
      if (timeout) {
        clearTimeout(timeout);
        this.lockTimeouts.delete(normalizedPath);
      }
      
      // Process waiting queue atomically
      const queue = this.lockAcquisitionQueue.get(normalizedPath);
      if (queue && queue.length > 0) {
        // Get next queued request
        const nextRequest = queue.shift()!;
        
        if (nextRequest.timeoutId) {
          clearTimeout(nextRequest.timeoutId);
        }
        
        if (queue.length === 0) {
          this.lockAcquisitionQueue.delete(normalizedPath);
        }
        
        // Process next request asynchronously
        setImmediate(() => {
          this.acquireFileLockAtomic(normalizedPath, nextRequest.lockId, process.pid)
            .then(nextRequest.resolve)
            .catch(nextRequest.reject);
        });
      }
    }
  }

  /**
   * Atomic cleanup of owned lock with version checking
   */
  private atomicCleanupLockIfOwned(normalizedPath: string, lockId: string, version: number): void {
    const existingLock = this.fileLocks.get(normalizedPath);
    
    // Only cleanup if we still own the lock (prevents race conditions)
    if (existingLock && existingLock.lockId === lockId && existingLock.version === version) {
      this.releaseFileLockAtomic(normalizedPath, existingLock);
    }
  }

  /**
   * Thread-safe cleanup of expired file locks without interfering with active operations
   */
  private cleanupExpiredLocks(): void {
    const now = Date.now();
    const pathsToCleanup: Array<{path: string, lock: FileLock}> = [];
    
    // Phase 1: Identify expired locks without modification (read-only phase)
    for (const [path, lock] of this.fileLocks) {
      // Skip if cleanup already in progress for this path
      if (this.cleanupInProgress.has(path)) {
        continue;
      }
      
      // Check if lock is truly expired and not actively being used
      if (now - lock.timestamp > SECURITY_CONSTANTS.FILE_OPERATION_TIMEOUT * 3 && lock.acquired) {
        pathsToCleanup.push({ path, lock });
      }
    }
    
    // Phase 2: Atomic cleanup of each expired lock
    for (const { path, lock } of pathsToCleanup) {
      // Mark cleanup in progress to prevent concurrent cleanup
      if (this.cleanupInProgress.has(path)) {
        continue; // Another cleanup is already handling this path
      }
      
      this.cleanupInProgress.add(path);
      
      try {
        const currentLock = this.fileLocks.get(path);
        
        // Verify the lock is still the same one we identified (prevents ABA issues)
        if (currentLock && 
            currentLock.lockId === lock.lockId && 
            currentLock.version === lock.version &&
            currentLock.timestamp === lock.timestamp) {
          
          // Check one more time if it's truly expired (double-check)
          if (now - currentLock.timestamp > SECURITY_CONSTANTS.FILE_OPERATION_TIMEOUT * 3) {
            
            // Atomic cleanup operations
            this.fileLocks.delete(path);
            
            // Clear associated timeout
            const timeout = this.lockTimeouts.get(path);
            if (timeout) {
              clearTimeout(timeout);
              this.lockTimeouts.delete(path);
            }
            
            // Increment version to invalidate any pending operations on this lock
            const currentVersion = this.lockVersions.get(path) || 0;
            this.lockVersions.set(path, currentVersion + 1);
            
            // Clean up any queued requests for this path (they'll retry)
            const queue = this.lockAcquisitionQueue.get(path);
            if (queue) {
              // Reject all queued requests with expiration error
              while (queue.length > 0) {
                const queuedRequest = queue.shift()!;
                if (queuedRequest.timeoutId) {
                  clearTimeout(queuedRequest.timeoutId);
                }
                // Don't reject here - let them retry with new acquisition attempt
                setImmediate(() => {
                  this.acquireFileLockAtomic(path, queuedRequest.lockId, process.pid)
                    .then(queuedRequest.resolve)
                    .catch(queuedRequest.reject);
                });
              }
              this.lockAcquisitionQueue.delete(path);
            }
          }
        }
      } catch (error) {
        // Log error but continue cleanup process
        console.warn(`Lock cleanup error for ${path}:`, error);
      } finally {
        // Always remove from cleanup progress set
        this.cleanupInProgress.delete(path);
      }
    }
  }

  /**
   * Clean up all locks and resources
   */
  cleanup(): void {
    // Clear all timeouts
    for (const timeout of this.lockTimeouts.values()) {
      clearTimeout(timeout);
    }
    
    // Clear all queued request timeouts
    for (const queue of this.lockAcquisitionQueue.values()) {
      for (const queuedRequest of queue) {
        if (queuedRequest.timeoutId) {
          clearTimeout(queuedRequest.timeoutId);
        }
        queuedRequest.reject(new Error('FileLockManager cleanup'));
      }
    }
    
    // Clear all maps
    this.fileLocks.clear();
    this.lockTimeouts.clear();
    this.lockVersions.clear();
    this.cleanupInProgress.clear();
    this.lockAcquisitionQueue.clear();
  }
}