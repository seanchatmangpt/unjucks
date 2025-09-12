/**
 * Lock File Hardener for KGEN - Removes Non-Deterministic Elements
 * 
 * This module ensures kgen.lock.json and all related lock files are completely
 * deterministic by removing timestamps and other variable elements.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getDeterministicEngine } from './deterministic-engine.js';

export class LockFileHardener {
  constructor(options = {}) {
    this.engine = getDeterministicEngine(options);
    this.enableLogging = options.enableLogging || false;
  }

  /**
   * Remove all non-deterministic elements from kgen.lock.json
   */
  hardenLockFile(lockFilePath) {
    try {
      if (!fs.existsSync(lockFilePath)) {
        if (this.enableLogging) {
          console.log(`[Hardener] Lock file not found: ${lockFilePath}`);
        }
        return null;
      }

      const originalContent = fs.readFileSync(lockFilePath, 'utf8');
      const lockData = JSON.parse(originalContent);

      // Remove the top-level timestamp (major source of non-determinism)
      if (lockData.timestamp) {
        delete lockData.timestamp;
        if (this.enableLogging) {
          console.log(`[Hardener] Removed top-level timestamp`);
        }
      }

      // Remove or replace modified timestamps in files section
      if (lockData.files) {
        let modifiedCount = 0;
        for (const [filePath, fileData] of Object.entries(lockData.files)) {
          if (fileData.modified) {
            // Option 1: Remove the modified field entirely
            delete fileData.modified;
            modifiedCount++;
            
            // Option 2: Replace with deterministic timestamp based on file content
            // fileData.modified = this.engine.getDeterministicTimestamp();
          }
        }
        if (this.enableLogging) {
          console.log(`[Hardener] Removed 'modified' field from ${modifiedCount} files`);
        }
      }

      // Sort files deterministically to ensure consistent ordering
      if (lockData.files) {
        const sortedFiles = {};
        const sortedKeys = Object.keys(lockData.files).sort();
        for (const key of sortedKeys) {
          sortedFiles[key] = lockData.files[key];
        }
        lockData.files = sortedFiles;
      }

      // Add deterministic commit information for reproducibility tracking
      lockData.commit = this.engine.baseCommit;
      lockData.seed = this.engine.seed;
      lockData.deterministicTimestamp = this.engine.getDeterministicTimestamp();

      // Write back the hardened lock file
      const hardenedContent = JSON.stringify(lockData, null, 2);
      fs.writeFileSync(lockFilePath, hardenedContent);

      if (this.enableLogging) {
        console.log(`[Hardener] Hardened lock file: ${lockFilePath}`);
      }

      return {
        originalSize: originalContent.length,
        hardenedSize: hardenedContent.length,
        removed: ['timestamp', 'modified'],
        added: ['commit', 'seed', 'deterministicTimestamp']
      };

    } catch (error) {
      console.error(`[Hardener] Error hardening lock file ${lockFilePath}:`, error.message);
      return null;
    }
  }

  /**
   * Scan directory for all lock files and harden them
   */
  hardenAllLockFiles(directory) {
    const lockFilePatterns = [
      'kgen.lock.json',
      '*.lock.json',
      'kgen-attestation-*.json'
    ];

    const results = [];

    for (const pattern of lockFilePatterns) {
      const files = this.findFilesByPattern(directory, pattern);
      for (const file of files) {
        const result = this.hardenLockFile(file);
        if (result) {
          results.push({
            file,
            ...result
          });
        }
      }
    }

    return results;
  }

  /**
   * Find files matching a pattern
   */
  findFilesByPattern(directory, pattern) {
    const files = [];
    
    try {
      const entries = fs.readdirSync(directory, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(directory, entry.name);
        
        if (entry.isFile()) {
          if (this.matchesPattern(entry.name, pattern)) {
            files.push(fullPath);
          }
        } else if (entry.isDirectory() && !entry.name.startsWith('.')) {
          // Recursively search subdirectories
          files.push(...this.findFilesByPattern(fullPath, pattern));
        }
      }
    } catch (error) {
      // Ignore access errors for directories
    }

    return files;
  }

  /**
   * Simple pattern matching (supports * wildcard)
   */
  matchesPattern(filename, pattern) {
    const regex = pattern.replace(/\*/g, '.*');
    return new RegExp(`^${regex}$`).test(filename);
  }

  /**
   * Create a deterministic lock file from scratch
   */
  createDeterministicLockFile(directory, outputPath) {
    const files = this.scanDirectoryForFiles(directory);
    const sortedFiles = files.sort((a, b) => a.path.localeCompare(b.path));

    const lockContent = {
      version: "1.0.0",
      commit: this.engine.baseCommit,
      seed: this.engine.seed,
      deterministicTimestamp: this.engine.getDeterministicTimestamp(),
      directory: path.relative(process.cwd(), directory) || ".",
      files: {}
    };

    for (const file of sortedFiles) {
      lockContent.files[file.relativePath] = {
        hash: file.hash,
        size: file.size
      };
    }

    fs.writeFileSync(outputPath, JSON.stringify(lockContent, null, 2));
    
    return {
      totalFiles: sortedFiles.length,
      outputPath,
      manifestHash: this.engine.createDeterministicHash(JSON.stringify(lockContent))
    };
  }

  /**
   * Scan directory and calculate file hashes
   */
  scanDirectoryForFiles(directory) {
    const files = [];
    
    const scanRecursive = (dir, basePath = '') => {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          const relativePath = path.join(basePath, entry.name);
          
          if (entry.isFile()) {
            // Skip lock files and hidden files
            if (!entry.name.startsWith('.') && !entry.name.endsWith('.lock.json')) {
              try {
                const content = fs.readFileSync(fullPath);
                const hash = crypto.createHash('sha256').update(content).digest('hex');
                const stats = fs.statSync(fullPath);
                
                files.push({
                  path: fullPath,
                  relativePath: relativePath.replace(/\\/g, '/'), // Normalize path separators
                  hash,
                  size: stats.size
                });
              } catch (error) {
                // Skip files that can't be read
              }
            }
          } else if (entry.isDirectory() && !entry.name.startsWith('.')) {
            scanRecursive(fullPath, relativePath);
          }
        }
      } catch (error) {
        // Ignore directory access errors
      }
    };

    scanRecursive(directory);
    return files;
  }

  /**
   * Validate that a lock file is deterministic
   */
  validateDeterministicLockFile(lockFilePath) {
    try {
      const content = fs.readFileSync(lockFilePath, 'utf8');
      const lockData = JSON.parse(content);

      const issues = [];

      // Check for non-deterministic fields
      if (lockData.timestamp && !lockData.deterministicTimestamp) {
        issues.push('Contains non-deterministic timestamp field');
      }

      if (lockData.files) {
        for (const [filePath, fileData] of Object.entries(lockData.files)) {
          if (fileData.modified && !lockData.deterministicTimestamp) {
            issues.push(`File ${filePath} contains non-deterministic 'modified' field`);
            break; // Only report once
          }
        }
      }

      if (!lockData.commit) {
        issues.push('Missing commit field for reproducibility tracking');
      }

      if (!lockData.seed) {
        issues.push('Missing seed field for deterministic operations');
      }

      return {
        isDeterministic: issues.length === 0,
        issues
      };

    } catch (error) {
      return {
        isDeterministic: false,
        issues: [`Failed to validate: ${error.message}`]
      };
    }
  }

  /**
   * Generate a reproducibility report for the project
   */
  generateReproducibilityReport(directory) {
    const lockFiles = this.findFilesByPattern(directory, '*.lock.json');
    const results = [];

    for (const lockFile of lockFiles) {
      const validation = this.validateDeterministicLockFile(lockFile);
      results.push({
        file: path.relative(process.cwd(), lockFile),
        ...validation
      });
    }

    const report = {
      timestamp: this.engine.getDeterministicTimestamp(),
      commit: this.engine.baseCommit,
      totalLockFiles: results.length,
      deterministicLockFiles: results.filter(r => r.isDeterministic).length,
      results
    };

    return report;
  }
}

// Export convenience functions
export function hardenKgenLockFile(lockFilePath, options = {}) {
  const hardener = new LockFileHardener(options);
  return hardener.hardenLockFile(lockFilePath);
}

export function hardenAllLockFiles(directory, options = {}) {
  const hardener = new LockFileHardener(options);
  return hardener.hardenAllLockFiles(directory);
}

export function validateLockFile(lockFilePath, options = {}) {
  const hardener = new LockFileHardener(options);
  return hardener.validateDeterministicLockFile(lockFilePath);
}