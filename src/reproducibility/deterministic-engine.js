/**
 * Deterministic Engine for KGEN - Ensures Reproducible Builds
 * 
 * This module replaces all non-deterministic elements (timestamps, UUIDs, random values)
 * with deterministic alternatives based on git commits and content hashing.
 * 
 * Key Features:
 * - Git-based deterministic timestamps
 * - Content-hash-based UUIDs
 * - Sorted file operations
 * - Fixed seed random generation
 * - Reproducible hash generation
 */

import crypto from 'crypto';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

export class DeterministicEngine {
  constructor(options = {}) {
    this.baseCommit = options.baseCommit || this.getGitHeadCommit();
    this.commitTimestamp = options.commitTimestamp || this.getCommitTimestamp(this.baseCommit);
    this.seed = options.seed || this.generateSeed();
    this.enableLogging = options.enableLogging || false;
    
    if (this.enableLogging) {
      console.log(`[Deterministic] Using commit: ${this.baseCommit}`);
      console.log(`[Deterministic] Using timestamp: ${this.commitTimestamp}`);
      console.log(`[Deterministic] Using seed: ${this.seed}`);
    }
  }

  /**
   * Get the current git HEAD commit hash
   */
  getGitHeadCommit() {
    try {
      return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
    } catch (error) {
      // Fallback: use a fixed hash for non-git environments
      return 'ffffffffffffffffffffffffffffffffffffffff';
    }
  }

  /**
   * Get the timestamp of a specific commit
   */
  getCommitTimestamp(commit) {
    try {
      const timestamp = execSync(`git log -1 --format="%ct" ${commit}`, { encoding: 'utf8' }).trim();
      return new Date(parseInt(timestamp) * 1000).toISOString();
    } catch (error) {
      // Fallback: use epoch time for determinism
      return '1970-01-01T00:00:00.000Z';
    }
  }

  /**
   * Generate a deterministic seed from git commit
   */
  generateSeed() {
    const hash = crypto.createHash('sha256');
    hash.update(this.baseCommit);
    hash.update(this.commitTimestamp);
    return hash.digest('hex').substring(0, 16);
  }

  /**
   * Get deterministic timestamp (always returns commit timestamp)
   */
  getDeterministicTimestamp() {
    return this.commitTimestamp;
  }

  /**
   * Generate deterministic UUID based on content
   */
  generateDeterministicUUID(content = '') {
    const hash = crypto.createHash('sha256');
    hash.update(this.seed);
    hash.update(content.toString());
    
    const hex = hash.digest('hex');
    
    // Format as UUID v4 with deterministic values
    const uuid = [
      hex.substring(0, 8),
      hex.substring(8, 12),
      '4' + hex.substring(13, 16), // Version 4
      ((parseInt(hex.substring(16, 17), 16) & 0x3) | 0x8).toString(16) + hex.substring(17, 20), // Variant bits
      hex.substring(20, 32)
    ].join('-');
    
    return uuid;
  }

  /**
   * Generate deterministic random number (0-1) based on content
   */
  generateDeterministicRandom(content = '') {
    const hash = crypto.createHash('sha256');
    hash.update(this.seed);
    hash.update(content.toString());
    
    const hex = hash.digest('hex').substring(0, 8);
    return parseInt(hex, 16) / 0xffffffff;
  }

  /**
   * Generate deterministic integer random number
   */
  generateDeterministicRandomInt(min, max, content = '') {
    const random = this.generateDeterministicRandom(content);
    return Math.floor(random * (max - min + 1)) + min;
  }

  /**
   * Generate deterministic hex string
   */
  generateDeterministicHex(length, content = '') {
    const hash = crypto.createHash('sha256');
    hash.update(this.seed);
    hash.update(content.toString());
    
    return hash.digest('hex').substring(0, length);
  }

  /**
   * Sort files deterministically
   */
  sortFilesDeterministically(files) {
    return files.sort((a, b) => {
      // Primary sort: by path
      const pathCompare = a.path.localeCompare(b.path);
      if (pathCompare !== 0) return pathCompare;
      
      // Secondary sort: by hash (for identical paths)
      if (a.hash && b.hash) {
        return a.hash.localeCompare(b.hash);
      }
      
      // Tertiary sort: by size
      if (a.size && b.size) {
        return a.size - b.size;
      }
      
      return 0;
    });
  }

  /**
   * Generate deterministic lock file content
   */
  generateDeterministicLockFile(files, options = {}) {
    const sortedFiles = this.sortFilesDeterministically(files);
    
    const lockContent = {
      version: "1.0.0",
      timestamp: this.getDeterministicTimestamp(),
      commit: this.baseCommit,
      seed: this.seed,
      directory: options.directory || ".",
      files: {}
    };

    // Add files in deterministic order
    for (const file of sortedFiles) {
      lockContent.files[file.path] = {
        hash: file.hash,
        size: file.size,
        modified: file.modified || this.getDeterministicTimestamp()
      };
    }

    return lockContent;
  }

  /**
   * Create deterministic file hash
   */
  createDeterministicHash(content) {
    const hash = crypto.createHash('sha256');
    hash.update(content);
    return hash.digest('hex');
  }

  /**
   * Replace non-deterministic patterns in code
   */
  makeDeterministic(code) {
    let deterministicCode = code;

    // Replace this.getDeterministicDate() calls
    deterministicCode = deterministicCode.replace(
      /new Date\(\)\.toISOString\(\)/g,
      `"${this.getDeterministicTimestamp()}"`
    );

    deterministicCode = deterministicCode.replace(
      /new Date\(\)/g,
      `new Date("${this.getDeterministicTimestamp()}")`
    );

    // Replace this.getDeterministicTimestamp() calls
    deterministicCode = deterministicCode.replace(
      /Date\.now\(\)/g,
      `${new Date(this.getDeterministicTimestamp()).getTime()}`
    );

    // Replace Math.random() calls
    deterministicCode = deterministicCode.replace(
      /Math\.random\(\)/g,
      `0.${this.seed.substring(0, 10)}`
    );

    return deterministicCode;
  }

  /**
   * Validate reproducibility by comparing hashes
   */
  validateReproducibility(run1Hash, run2Hash) {
    return run1Hash === run2Hash;
  }

  /**
   * Generate reproducibility report
   */
  generateReproducibilityReport(files, options = {}) {
    const report = {
      timestamp: this.getDeterministicTimestamp(),
      commit: this.baseCommit,
      seed: this.seed,
      totalFiles: files.length,
      totalSize: files.reduce((sum, f) => sum + (f.size || 0), 0),
      deterministic: true,
      files: files.map(f => ({
        path: f.path,
        hash: f.hash,
        size: f.size
      }))
    };

    if (options.includeManifest) {
      report.manifestHash = this.createDeterministicHash(JSON.stringify(report.files));
    }

    return report;
  }
}

/**
 * Global instance for consistent deterministic behavior
 */
let globalEngine = null;

export function getDeterministicEngine(options = {}) {
  if (!globalEngine) {
    globalEngine = new DeterministicEngine(options);
  }
  return globalEngine;
}

/**
 * Reset the global engine (useful for testing)
 */
export function resetDeterministicEngine() {
  globalEngine = null;
}

/**
 * Helper functions for easy integration
 */
export function deterministicTimestamp() {
  return getDeterministicEngine().getDeterministicTimestamp();
}

export function deterministicUUID(content = '') {
  return getDeterministicEngine().generateDeterministicUUID(content);
}

export function deterministicRandom(content = '') {
  return getDeterministicEngine().generateDeterministicRandom(content);
}

export function deterministicHex(length, content = '') {
  return getDeterministicEngine().generateDeterministicHex(length, content);
}