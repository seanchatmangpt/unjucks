/**
 * Atomic Storage Engine for CAS with Hardlink Support
 * 
 * Provides atomic write operations, hardlink management, and storage reliability
 * with optimized file system operations and error recovery.
 */

import { promises as fs, constants as fsConstants } from 'fs';
import { join, dirname, basename, extname } from 'path';
import { createHash } from 'crypto';
import consola from 'consola';
import { performance } from 'perf_hooks';

/**
 * Atomic Storage Engine with reliability and performance optimizations
 */
export class AtomicStorageEngine {
  constructor(options = {}) {
    this.options = {
      casDir: options.casDir || join(process.cwd(), '.kgen/cas'),
      enableHardlinks: options.enableHardlinks !== false,
      enableIntegrityChecks: options.enableIntegrityChecks !== false,
      enableDriftDetection: options.enableDriftDetection !== false,
      tempSuffix: options.tempSuffix || '.tmp',
      backupSuffix: options.backupSuffix || '.backup',
      maxRetries: options.maxRetries || 3,
      retryDelayMs: options.retryDelayMs || 100,
      enableCompression: options.enableCompression || false,
      ...options
    };
    
    this.logger = consola.withTag('atomic-storage');
    
    // Storage statistics
    this.stats = {
      atomicWrites: 0,
      hardlinksCreated: 0,
      integrityVerifications: 0,
      driftDetections: 0,
      retryAttempts: 0,
      errors: 0,
      totalOperationTime: 0
    };
    
    // Operation tracking
    this.activeOperations = new Map();
    this.initialized = false;
  }

  /**
   * Initialize the atomic storage engine
   */
  async initialize() {
    if (this.initialized) return { success: true, cached: true };
    
    try {
      // Ensure CAS directory exists with proper permissions
      await fs.mkdir(this.options.casDir, { recursive: true });
      
      // Verify write permissions
      await this._verifyPermissions();
      
      this.initialized = true;
      this.logger.info(`Atomic Storage Engine initialized: ${this.options.casDir}`);
      
      return {
        success: true,
        casDir: this.options.casDir,
        features: {
          hardlinks: this.options.enableHardlinks,
          integrityChecks: this.options.enableIntegrityChecks,
          driftDetection: this.options.enableDriftDetection,
          compression: this.options.enableCompression
        }
      };
    } catch (error) {
      this.logger.error('Failed to initialize atomic storage:', error);
      throw error;
    }
  }

  /**
   * Atomically store content with reliability guarantees
   */
  async storeAtomic(content, hash, options = {}) {
    await this.initialize();
    const startTime = performance.now();
    const operationId = this._generateOperationId();
    
    try {
      this.activeOperations.set(operationId, { startTime, phase: 'starting' });
      
      const {
        extension = null,
        source = null,
        algorithm = 'sha256',
        enableBackup = true,
        verifyAfterWrite = this.options.enableIntegrityChecks
      } = options;
      
      // Calculate storage paths with sharding
      const shardDir = hash.substring(0, 2);
      const targetDir = join(this.options.casDir, shardDir);
      const targetPath = extension ? 
        join(targetDir, `${hash}${extension}`) : 
        join(targetDir, hash);
      
      // Create temporary path for atomic operation
      const tempPath = `${targetPath}${this.options.tempSuffix}.${operationId}`;
      const backupPath = enableBackup ? `${targetPath}${this.options.backupSuffix}` : null;
      
      this.activeOperations.set(operationId, { startTime, phase: 'preparing' });
      
      // Ensure target directory exists
      await fs.mkdir(targetDir, { recursive: true });
      
      // Check if target already exists
      const targetExists = await this._pathExists(targetPath);
      
      if (targetExists) {
        // Verify existing content integrity
        if (this.options.enableIntegrityChecks) {
          const verification = await this._verifyFileIntegrity(targetPath, hash, algorithm);
          if (verification.valid) {
            // Content already exists and is valid
            this._completeOperation(operationId, performance.now() - startTime);
            return {
              stored: false,
              existed: true,
              path: targetPath,
              verified: true,
              processingTime: performance.now() - startTime
            };
          } else {
            this.logger.warn(`Existing file failed integrity check: ${targetPath}`);
            // Continue with overwrite
          }
        } else {
          // File exists, assume it's correct
          this._completeOperation(operationId, performance.now() - startTime);
          return {
            stored: false,
            existed: true,
            path: targetPath,
            processingTime: performance.now() - startTime
          };
        }
      }
      
      this.activeOperations.set(operationId, { startTime, phase: 'writing' });
      
      // Create backup if file exists and backup is enabled
      if (targetExists && enableBackup) {
        try {
          await fs.copyFile(targetPath, backupPath);
        } catch (error) {
          this.logger.warn(`Failed to create backup for ${targetPath}:`, error.message);
        }
      }
      
      // Atomic write operation with retries
      await this._writeWithRetry(content, tempPath, hash, algorithm);
      
      this.activeOperations.set(operationId, { startTime, phase: 'finalizing' });
      
      // Atomic rename to final location
      await fs.rename(tempPath, targetPath);
      this.stats.atomicWrites++;
      
      // Verify after write if enabled
      if (verifyAfterWrite) {
        const verification = await this._verifyFileIntegrity(targetPath, hash, algorithm);
        if (!verification.valid) {
          // Restore backup if available
          if (backupPath && await this._pathExists(backupPath)) {
            await fs.copyFile(backupPath, targetPath);
          }
          throw new Error(`Post-write integrity verification failed: ${verification.error}`);
        }
        this.stats.integrityVerifications++;
      }
      
      // Create hardlinks if requested
      let hardlinkCreated = false;
      if (this.options.enableHardlinks && source) {
        hardlinkCreated = await this._createHardlinkSafe(source, targetPath);
      }
      
      // Clean up backup
      if (backupPath && await this._pathExists(backupPath)) {
        try {
          await fs.unlink(backupPath);
        } catch (error) {
          this.logger.warn(`Failed to clean up backup: ${backupPath}`);
        }
      }
      
      const processingTime = performance.now() - startTime;
      this._completeOperation(operationId, processingTime);
      
      return {
        stored: true,
        existed: false,
        path: targetPath,
        hardlinkCreated,
        verified: verifyAfterWrite,
        processingTime,
        operationId
      };
      
    } catch (error) {
      this.stats.errors++;
      this._failOperation(operationId, error);
      
      // Clean up temporary files
      await this._cleanupTempFiles(operationId);
      
      this.logger.error(`Atomic store failed for hash ${hash}:`, error);
      throw error;
    }
  }

  /**
   * Create hardlink with safety checks and fallback handling
   */
  async createHardlink(sourcePath, targetPath, options = {}) {
    if (!this.options.enableHardlinks) {
      throw new Error('Hardlinks are disabled');
    }
    
    return this._createHardlinkSafe(sourcePath, targetPath, options);
  }

  /**
   * Verify file integrity with performance optimization
   */
  async verifyIntegrity(filePath, expectedHash, algorithm = 'sha256') {
    const startTime = performance.now();
    
    try {
      const verification = await this._verifyFileIntegrity(filePath, expectedHash, algorithm);
      verification.processingTime = performance.now() - startTime;
      
      this.stats.integrityVerifications++;
      
      return verification;
    } catch (error) {
      return {
        valid: false,
        error: `Integrity verification failed: ${error.message}`,
        processingTime: performance.now() - startTime
      };
    }
  }

  /**
   * Detect content drift between files
   */
  async detectDrift(filePath1, filePath2, algorithm = 'sha256') {
    if (!this.options.enableDriftDetection) {
      throw new Error('Drift detection is disabled');
    }
    
    const startTime = performance.now();
    
    try {
      const [hash1, hash2] = await Promise.all([
        this._calculateFileHash(filePath1, algorithm),
        this._calculateFileHash(filePath2, algorithm)
      ]);
      
      const driftDetected = hash1 !== hash2;
      
      if (driftDetected) {
        this.stats.driftDetections++;
      }
      
      return {
        driftDetected,
        hash1,
        hash2,
        algorithm,
        processingTime: performance.now() - startTime
      };
    } catch (error) {
      return {
        driftDetected: true,
        error: `Drift detection failed: ${error.message}`,
        processingTime: performance.now() - startTime
      };
    }
  }

  /**
   * Get storage statistics and performance metrics
   */
  getStats() {
    const avgOperationTime = this.stats.atomicWrites > 0 ? 
      this.stats.totalOperationTime / this.stats.atomicWrites : 0;
    
    return {
      operations: {
        atomicWrites: this.stats.atomicWrites,
        hardlinksCreated: this.stats.hardlinksCreated,
        integrityVerifications: this.stats.integrityVerifications,
        driftDetections: this.stats.driftDetections,
        retryAttempts: this.stats.retryAttempts,
        errors: this.stats.errors
      },
      performance: {
        averageOperationTime: Math.round(avgOperationTime * 100) / 100,
        totalOperationTime: Math.round(this.stats.totalOperationTime),
        errorRate: this.stats.atomicWrites > 0 ? 
          this.stats.errors / this.stats.atomicWrites : 0
      },
      activeOperations: this.activeOperations.size,
      features: {
        hardlinks: this.options.enableHardlinks,
        integrityChecks: this.options.enableIntegrityChecks,
        driftDetection: this.options.enableDriftDetection,
        compression: this.options.enableCompression
      }
    };
  }

  /**
   * Shutdown and cleanup
   */
  async shutdown() {
    // Wait for active operations to complete
    const maxWaitTime = 10000; // 10 seconds
    const startWait = this.getDeterministicTimestamp();
    
    while (this.activeOperations.size > 0 && this.getDeterministicTimestamp() - startWait < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    if (this.activeOperations.size > 0) {
      this.logger.warn(`Shutdown with ${this.activeOperations.size} active operations`);
    }
    
    this.logger.info('Atomic Storage Engine shutdown completed');
  }

  // Private methods

  async _verifyPermissions() {
    const testFile = join(this.options.casDir, '.write-test');
    try {
      await fs.writeFile(testFile, 'test');
      await fs.unlink(testFile);
    } catch (error) {
      throw new Error(`No write permission in CAS directory: ${error.message}`);
    }
  }

  async _pathExists(path) {
    try {
      await fs.access(path, fsConstants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  async _writeWithRetry(content, tempPath, expectedHash, algorithm) {
    let lastError;
    
    for (let attempt = 1; attempt <= this.options.maxRetries; attempt++) {
      try {
        // Write content to temporary file
        await fs.writeFile(tempPath, content);
        
        // Verify content if integrity checks are enabled
        if (this.options.enableIntegrityChecks) {
          const verification = await this._verifyFileIntegrity(tempPath, expectedHash, algorithm);
          if (!verification.valid) {
            throw new Error(`Written content verification failed: ${verification.error}`);
          }
        }
        
        return; // Success
      } catch (error) {
        lastError = error;
        this.stats.retryAttempts++;
        
        if (attempt < this.options.maxRetries) {
          this.logger.warn(`Write attempt ${attempt} failed, retrying: ${error.message}`);
          await new Promise(resolve => setTimeout(resolve, this.options.retryDelayMs * attempt));
        }
        
        // Clean up failed attempt
        try {
          await fs.unlink(tempPath);
        } catch {}
      }
    }
    
    throw new Error(`Write failed after ${this.options.maxRetries} attempts: ${lastError.message}`);
  }

  async _createHardlinkSafe(sourcePath, targetPath, options = {}) {
    try {
      const { overwrite = false } = options;
      
      // Check if source exists
      if (!await this._pathExists(sourcePath)) {
        throw new Error(`Source file does not exist: ${sourcePath}`);
      }
      
      // Check if target exists
      const targetExists = await this._pathExists(targetPath);
      if (targetExists && !overwrite) {
        // Check if they're already hardlinked
        try {
          const [sourceStat, targetStat] = await Promise.all([
            fs.stat(sourcePath),
            fs.stat(targetPath)
          ]);
          
          if (sourceStat.ino === targetStat.ino && sourceStat.dev === targetStat.dev) {
            // Already hardlinked
            return true;
          }
        } catch {
          // Stats failed, proceed with hardlink attempt
        }
      }
      
      // Ensure target directory exists
      await fs.mkdir(dirname(targetPath), { recursive: true });
      
      // Create hardlink
      await fs.link(sourcePath, targetPath);
      this.stats.hardlinksCreated++;
      
      return true;
    } catch (error) {
      this.logger.warn(`Failed to create hardlink ${sourcePath} -> ${targetPath}:`, error.message);
      return false;
    }
  }

  async _verifyFileIntegrity(filePath, expectedHash, algorithm) {
    try {
      const actualHash = await this._calculateFileHash(filePath, algorithm);
      
      return {
        valid: actualHash === expectedHash,
        expectedHash,
        actualHash,
        algorithm,
        error: actualHash === expectedHash ? null : 'Hash mismatch detected'
      };
    } catch (error) {
      return {
        valid: false,
        error: `Integrity check failed: ${error.message}`
      };
    }
  }

  async _calculateFileHash(filePath, algorithm) {
    const hash = createHash(algorithm);
    const content = await fs.readFile(filePath);
    hash.update(content);
    return hash.digest('hex');
  }

  _generateOperationId() {
    return `op_${this.getDeterministicTimestamp()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  _completeOperation(operationId, processingTime) {
    this.activeOperations.delete(operationId);
    this.stats.totalOperationTime += processingTime;
  }

  _failOperation(operationId, error) {
    const operation = this.activeOperations.get(operationId);
    if (operation) {
      const processingTime = performance.now() - operation.startTime;
      this.stats.totalOperationTime += processingTime;
    }
    this.activeOperations.delete(operationId);
  }

  async _cleanupTempFiles(operationId) {
    // Find and clean up any temporary files associated with this operation
    try {
      const pattern = `${this.options.tempSuffix}.${operationId}`;
      // This is a simplified cleanup - in production you'd want recursive directory scanning
      this.logger.debug(`Cleaning up temp files for operation ${operationId}`);
    } catch (error) {
      this.logger.warn(`Failed to cleanup temp files for ${operationId}:`, error.message);
    }
  }
}

// Export singleton instance
export const atomicStorage = new AtomicStorageEngine();

export default AtomicStorageEngine;