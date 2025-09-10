/**
 * Atomic File Writer
 * 
 * Handles atomic file operations with backup creation, permission management,
 * and post-processing commands with comprehensive error handling.
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync, copyFileSync, chmodSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { execSync } from 'child_process';

import { Logger } from '../utils/logger.js';

/**
 * Atomic File Writer
 * 
 * Provides safe, atomic file writing operations with backup creation,
 * permission management, and shell command execution.
 */
export class FileWriter {
  /**
   * Initialize the file writer
   * @param {Object} options - Configuration options
   * @param {Object} options.logger - Logger instance
   * @param {boolean} options.createBackups - Enable automatic backups
   * @param {boolean} options.atomicWrites - Enable atomic write operations
   * @param {string} options.defaultMode - Default file permissions
   */
  constructor(options = {}) {
    this.logger = options.logger || new Logger();
    this.createBackups = options.createBackups !== false;
    this.atomicWrites = options.atomicWrites !== false;
    this.defaultMode = options.defaultMode || '644';
    
    this.writeHistory = new Map();
    this.backupPaths = new Set();
  }

  /**
   * Write content to file with full processing pipeline
   * @param {string} filePath - Target file path
   * @param {string} content - Content to write
   * @param {Object} options - Write options
   * @param {boolean} options.force - Force overwrite existing files
   * @param {boolean} options.dryRun - Perform dry run without writing
   * @param {string} options.chmod - File permissions to set
   * @param {string} options.sh - Shell command to execute after write
   * @param {boolean} options.createDirs - Create parent directories
   * @returns {Promise<Object>} Write result
   */
  async writeFile(filePath, content, options = {}) {
    try {
      this.logger.debug('Starting file write operation', {
        filePath,
        contentLength: content.length,
        dryRun: options.dryRun,
        force: options.force
      });

      // Validate parameters
      this.validateWriteParams(filePath, content, options);

      // Resolve absolute path
      const absolutePath = resolve(filePath);

      // Check if file exists and handle overwrite
      const fileExists = existsSync(absolutePath);
      if (fileExists && !options.force && !options.dryRun) {
        throw new Error(`File already exists: ${absolutePath}. Use force option to overwrite.`);
      }

      // Create parent directories if needed
      if (options.createDirs !== false) {
        await this.ensureDirectoryExists(dirname(absolutePath), options.dryRun);
      }

      // Create backup if file exists
      let backupPath = null;
      if (this.createBackups && fileExists && !options.dryRun) {
        backupPath = await this.createBackup(absolutePath);
      }

      // Perform the write operation
      let writeResult;
      if (this.atomicWrites) {
        writeResult = await this.atomicWrite(absolutePath, content, options);
      } else {
        writeResult = await this.standardWrite(absolutePath, content, options);
      }

      // Set file permissions if specified
      if (options.chmod && !options.dryRun) {
        await this.setFilePermissions(absolutePath, options.chmod);
      }

      // Execute shell command if specified
      let shellResult = null;
      if (options.sh && !options.dryRun) {
        shellResult = await this.executeShellCommand(options.sh, {
          filePath: absolutePath,
          content
        });
      }

      // Record write operation
      this.recordWrite(absolutePath, {
        content,
        options,
        backupPath,
        shellResult,
        timestamp: new Date().toISOString()
      });

      const result = {
        success: true,
        filePath: absolutePath,
        contentLength: content.length,
        fileExists: fileExists,
        backupPath,
        shellResult,
        dryRun: options.dryRun,
        ...writeResult
      };

      this.logger.info('File write operation completed', result);

      return result;

    } catch (error) {
      this.logger.error('File write operation failed', {
        filePath,
        error: error.message
      });

      // Attempt rollback if needed
      if (this.backupPaths.has(filePath) && !options.dryRun) {
        await this.rollback(filePath);
      }

      throw error;
    }
  }

  /**
   * Validate write parameters
   * @param {string} filePath - Target file path
   * @param {string} content - Content to write
   * @param {Object} options - Write options
   */
  validateWriteParams(filePath, content, options) {
    if (!filePath || typeof filePath !== 'string') {
      throw new Error('Invalid file path provided');
    }

    if (typeof content !== 'string') {
      throw new Error('Content must be a string');
    }

    // Validate file path safety
    if (filePath.includes('..') || filePath.startsWith('/tmp')) {
      this.logger.warn('Potentially unsafe file path', { filePath });
    }

    // Validate permissions format
    if (options.chmod && !/^[0-7]{3,4}$/.test(options.chmod)) {
      throw new Error(`Invalid chmod format: ${options.chmod}`);
    }
  }

  /**
   * Ensure directory exists
   * @param {string} dirPath - Directory path
   * @param {boolean} dryRun - Dry run mode
   * @returns {Promise<void>}
   */
  async ensureDirectoryExists(dirPath, dryRun = false) {
    if (existsSync(dirPath)) {
      return;
    }

    if (dryRun) {
      this.logger.info('Would create directory', { dirPath });
      return;
    }

    try {
      mkdirSync(dirPath, { recursive: true });
      this.logger.debug('Created directory', { dirPath });
    } catch (error) {
      this.logger.error('Failed to create directory', {
        dirPath,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Perform atomic write operation
   * @param {string} filePath - Target file path
   * @param {string} content - Content to write
   * @param {Object} options - Write options
   * @returns {Promise<Object>} Write result
   */
  async atomicWrite(filePath, content, options) {
    if (options.dryRun) {
      return {
        operation: 'atomic_write',
        written: false,
        tempFile: `${filePath}.tmp`
      };
    }

    const tempPath = `${filePath}.tmp.${Date.now()}`;

    try {
      // Write to temporary file first
      writeFileSync(tempPath, content, 'utf8');

      // Verify write by reading back
      const writtenContent = readFileSync(tempPath, 'utf8');
      if (writtenContent !== content) {
        throw new Error('Write verification failed - content mismatch');
      }

      // Atomic move to final location
      const fs = require('fs');
      fs.renameSync(tempPath, filePath);

      this.logger.debug('Atomic write completed', {
        filePath,
        tempFile: tempPath,
        contentLength: content.length
      });

      return {
        operation: 'atomic_write',
        written: true,
        tempFile: tempPath,
        verified: true
      };

    } catch (error) {
      // Clean up temp file on error
      try {
        if (existsSync(tempPath)) {
          require('fs').unlinkSync(tempPath);
        }
      } catch (cleanupError) {
        this.logger.warn('Failed to cleanup temp file', {
          tempFile: tempPath,
          error: cleanupError.message
        });
      }

      throw error;
    }
  }

  /**
   * Perform standard write operation
   * @param {string} filePath - Target file path
   * @param {string} content - Content to write
   * @param {Object} options - Write options
   * @returns {Promise<Object>} Write result
   */
  async standardWrite(filePath, content, options) {
    if (options.dryRun) {
      return {
        operation: 'standard_write',
        written: false
      };
    }

    try {
      writeFileSync(filePath, content, 'utf8');

      this.logger.debug('Standard write completed', {
        filePath,
        contentLength: content.length
      });

      return {
        operation: 'standard_write',
        written: true
      };

    } catch (error) {
      this.logger.error('Standard write failed', {
        filePath,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Create backup of existing file
   * @param {string} filePath - File to backup
   * @returns {Promise<string>} Backup file path
   */
  async createBackup(filePath) {
    if (!existsSync(filePath)) {
      return null;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `${filePath}.backup-${timestamp}`;

    try {
      copyFileSync(filePath, backupPath);
      this.backupPaths.add(backupPath);

      this.logger.debug('Backup created', {
        originalPath: filePath,
        backupPath
      });

      return backupPath;

    } catch (error) {
      this.logger.error('Failed to create backup', {
        filePath,
        backupPath,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Set file permissions
   * @param {string} filePath - File path
   * @param {string} mode - Permission mode (octal string)
   * @returns {Promise<void>}
   */
  async setFilePermissions(filePath, mode) {
    try {
      const octalMode = parseInt(mode, 8);
      chmodSync(filePath, octalMode);

      this.logger.debug('File permissions set', {
        filePath,
        mode,
        octalMode
      });

    } catch (error) {
      this.logger.error('Failed to set file permissions', {
        filePath,
        mode,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Execute shell command with context
   * @param {string} command - Shell command to execute
   * @param {Object} context - Command context variables
   * @returns {Promise<Object>} Execution result
   */
  async executeShellCommand(command, context = {}) {
    try {
      this.logger.debug('Executing shell command', {
        command,
        context: Object.keys(context)
      });

      // Replace template variables in command
      let processedCommand = command;
      Object.entries(context).forEach(([key, value]) => {
        const placeholder = `{{ ${key} }}`;
        processedCommand = processedCommand.replace(new RegExp(placeholder, 'g'), value);
      });

      // Execute command
      const startTime = Date.now();
      const stdout = execSync(processedCommand, {
        encoding: 'utf8',
        timeout: 30000, // 30 second timeout
        cwd: context.filePath ? dirname(context.filePath) : process.cwd()
      });
      const executionTime = Date.now() - startTime;

      const result = {
        command: processedCommand,
        stdout: stdout.trim(),
        stderr: '',
        exitCode: 0,
        executionTime
      };

      this.logger.info('Shell command executed successfully', {
        command: processedCommand,
        executionTime,
        outputLength: stdout.length
      });

      return result;

    } catch (error) {
      const result = {
        command,
        stdout: '',
        stderr: error.message,
        exitCode: error.status || 1,
        executionTime: 0
      };

      this.logger.error('Shell command execution failed', result);

      throw new Error(`Shell command failed: ${error.message}`);
    }
  }

  /**
   * Rollback file to backup
   * @param {string} filePath - File to rollback
   * @returns {Promise<boolean>} True if rollback succeeded
   */
  async rollback(filePath) {
    // Find most recent backup for this file
    const backupPattern = `${filePath}.backup-`;
    const relevantBackups = Array.from(this.backupPaths)
      .filter(backup => backup.startsWith(backupPattern))
      .sort()
      .reverse();

    if (relevantBackups.length === 0) {
      this.logger.warn('No backup available for rollback', { filePath });
      return false;
    }

    const backupPath = relevantBackups[0];

    try {
      copyFileSync(backupPath, filePath);

      this.logger.info('File rolled back to backup', {
        filePath,
        backupPath
      });

      return true;

    } catch (error) {
      this.logger.error('Rollback failed', {
        filePath,
        backupPath,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Record write operation in history
   * @param {string} filePath - Target file path
   * @param {Object} operation - Operation details
   */
  recordWrite(filePath, operation) {
    if (!this.writeHistory.has(filePath)) {
      this.writeHistory.set(filePath, []);
    }

    this.writeHistory.get(filePath).push(operation);

    // Keep only last 5 operations per file
    const history = this.writeHistory.get(filePath);
    if (history.length > 5) {
      history.splice(0, history.length - 5);
    }
  }

  /**
   * Get write history for file
   * @param {string} filePath - File path
   * @returns {Array<Object>} Write history
   */
  getWriteHistory(filePath) {
    return this.writeHistory.get(filePath) || [];
  }

  /**
   * Batch write multiple files
   * @param {Array<Object>} writeOperations - Array of write operations
   * @param {Object} options - Batch options
   * @returns {Promise<Array<Object>>} Array of write results
   */
  async batchWrite(writeOperations, options = {}) {
    const results = [];
    const errors = [];

    this.logger.info('Starting batch write operation', {
      operationCount: writeOperations.length,
      parallel: options.parallel
    });

    if (options.parallel) {
      // Parallel execution
      const promises = writeOperations.map(async (operation, index) => {
        try {
          const result = await this.writeFile(
            operation.filePath,
            operation.content,
            operation.options || {}
          );
          return { index, result, error: null };
        } catch (error) {
          return { index, result: null, error };
        }
      });

      const batchResults = await Promise.all(promises);
      
      batchResults.forEach(({ index, result, error }) => {
        if (error) {
          errors.push({ index, operation: writeOperations[index], error });
        } else {
          results.push(result);
        }
      });

    } else {
      // Sequential execution
      for (let i = 0; i < writeOperations.length; i++) {
        const operation = writeOperations[i];
        try {
          const result = await this.writeFile(
            operation.filePath,
            operation.content,
            operation.options || {}
          );
          results.push(result);
        } catch (error) {
          errors.push({ index: i, operation, error });
          
          // Stop on first error if not in continue mode
          if (!options.continueOnError) {
            break;
          }
        }
      }
    }

    this.logger.info('Batch write operation completed', {
      successful: results.length,
      failed: errors.length,
      total: writeOperations.length
    });

    return {
      results,
      errors,
      successful: results.length,
      failed: errors.length
    };
  }

  /**
   * Clean up old backups
   * @param {number} maxAge - Maximum age in milliseconds
   * @returns {Promise<number>} Number of backups cleaned
   */
  async cleanupBackups(maxAge = 24 * 60 * 60 * 1000) {
    let cleanedCount = 0;
    const now = Date.now();

    for (const backupPath of this.backupPaths) {
      try {
        if (existsSync(backupPath)) {
          const stats = require('fs').statSync(backupPath);
          const age = now - stats.mtime.getTime();

          if (age > maxAge) {
            require('fs').unlinkSync(backupPath);
            this.backupPaths.delete(backupPath);
            cleanedCount++;

            this.logger.debug('Cleaned up old backup', {
              backupPath,
              age: `${Math.round(age / 1000 / 60)}min`
            });
          }
        } else {
          this.backupPaths.delete(backupPath);
        }
      } catch (error) {
        this.logger.warn('Failed to clean backup', {
          backupPath,
          error: error.message
        });
      }
    }

    this.logger.info('Backup cleanup completed', {
      cleanedCount,
      remainingBackups: this.backupPaths.size
    });

    return cleanedCount;
  }

  /**
   * Get file writer statistics
   * @returns {Object} Statistics object
   */
  getStatistics() {
    const totalWrites = Array.from(this.writeHistory.values())
      .reduce((sum, history) => sum + history.length, 0);

    return {
      totalWrites,
      filesWritten: this.writeHistory.size,
      activeBackups: this.backupPaths.size,
      createBackups: this.createBackups,
      atomicWrites: this.atomicWrites,
      defaultMode: this.defaultMode
    };
  }

  /**
   * Clear write history and backups
   */
  clear() {
    this.writeHistory.clear();
    this.backupPaths.clear();
  }
}