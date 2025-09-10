/**
 * File Injection System
 * 
 * Handles idempotent file modifications with support for append, prepend,
 * line insertion, pattern matching, and safe rollback operations.
 */

import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'fs';
import { join, dirname } from 'path';
import { mkdirSync } from 'fs';

import { Logger } from '../utils/logger.js';

/**
 * File Injection System
 * 
 * Provides safe, idempotent file modification capabilities with
 * comprehensive injection modes and automatic backup/rollback.
 */
export class InjectionSystem {
  /**
   * Initialize the injection system
   * @param {Object} options - Configuration options
   * @param {Object} options.logger - Logger instance
   * @param {boolean} options.createBackups - Enable automatic backups
   * @param {boolean} options.validateInjections - Enable injection validation
   */
  constructor(options = {}) {
    this.logger = options.logger || new Logger();
    this.createBackups = options.createBackups !== false;
    this.validateInjections = options.validateInjections !== false;
    
    this.injectionHistory = new Map();
    this.backupPaths = new Map();
  }

  /**
   * Inject content into a file using specified mode
   * @param {string} filePath - Target file path
   * @param {string} content - Content to inject
   * @param {Object} options - Injection options
   * @param {string} options.mode - Injection mode
   * @param {number} options.lineAt - Line number for line insertion
   * @param {string} options.before - Pattern to insert before
   * @param {string} options.after - Pattern to insert after
   * @param {string} options.replace - Pattern to replace
   * @param {boolean} options.force - Force injection even if content exists
   * @param {boolean} options.dryRun - Perform dry run without writing
   * @returns {Promise<Object>} Injection result
   */
  async inject(filePath, content, options = {}) {
    try {
      this.logger.debug('Starting file injection', {
        filePath,
        mode: options.mode,
        contentLength: content.length,
        dryRun: options.dryRun
      });

      // Validate injection parameters
      this.validateInjectionParams(filePath, content, options);

      // Read existing file content
      const fileExists = existsSync(filePath);
      const originalContent = fileExists ? readFileSync(filePath, 'utf8') : '';

      // Check if injection is needed
      if (!options.force && this.isContentAlreadyInjected(originalContent, content, options)) {
        this.logger.info('Content already exists, skipping injection', {
          filePath,
          mode: options.mode
        });
        
        return {
          success: true,
          modified: false,
          reason: 'Content already exists',
          originalLength: originalContent.length,
          newLength: originalContent.length
        };
      }

      // Create backup if enabled and not dry run
      let backupPath = null;
      if (this.createBackups && fileExists && !options.dryRun) {
        backupPath = await this.createBackup(filePath);
      }

      // Perform injection based on mode
      const modifiedContent = await this.performInjection(
        originalContent,
        content,
        options
      );

      // Validate injection result
      if (this.validateInjections) {
        this.validateInjectionResult(originalContent, modifiedContent, content, options);
      }

      // Write modified content (unless dry run)
      if (!options.dryRun) {
        await this.writeContentSafely(filePath, modifiedContent);
        
        // Record injection in history
        this.recordInjection(filePath, {
          content,
          options,
          backupPath,
          timestamp: new Date().toISOString()
        });
      }

      const result = {
        success: true,
        modified: true,
        originalLength: originalContent.length,
        newLength: modifiedContent.length,
        linesAdded: this.countLines(modifiedContent) - this.countLines(originalContent),
        backupPath,
        dryRun: options.dryRun
      };

      this.logger.info('File injection completed', {
        filePath,
        ...result
      });

      return result;

    } catch (error) {
      this.logger.error('File injection failed', {
        filePath,
        error: error.message,
        mode: options.mode
      });

      // Attempt rollback if backup exists
      if (this.backupPaths.has(filePath) && !options.dryRun) {
        await this.rollback(filePath);
      }

      throw error;
    }
  }

  /**
   * Validate injection parameters
   * @param {string} filePath - Target file path
   * @param {string} content - Content to inject
   * @param {Object} options - Injection options
   */
  validateInjectionParams(filePath, content, options) {
    if (!filePath || typeof filePath !== 'string') {
      throw new Error('Invalid file path provided');
    }

    if (typeof content !== 'string') {
      throw new Error('Content must be a string');
    }

    const validModes = ['append', 'prepend', 'lineAt', 'before', 'after', 'replace'];
    if (options.mode && !validModes.includes(options.mode)) {
      throw new Error(`Invalid injection mode: ${options.mode}`);
    }

    // Mode-specific validation
    if (options.mode === 'lineAt' && (typeof options.lineAt !== 'number' || options.lineAt < 1)) {
      throw new Error('lineAt mode requires a valid line number (>= 1)');
    }

    if (['before', 'after', 'replace'].includes(options.mode) && !options[options.mode]) {
      throw new Error(`${options.mode} mode requires a pattern`);
    }
  }

  /**
   * Check if content is already injected
   * @param {string} fileContent - Existing file content
   * @param {string} content - Content to inject
   * @param {Object} options - Injection options
   * @returns {boolean} True if content already exists
   */
  isContentAlreadyInjected(fileContent, content, options) {
    // Simple containment check for most cases
    if (fileContent.includes(content.trim())) {
      return true;
    }

    // Mode-specific checks
    switch (options.mode) {
      case 'append':
        return fileContent.trimEnd().endsWith(content.trim());
      
      case 'prepend':
        return fileContent.trimStart().startsWith(content.trim());
      
      case 'replace':
        // If pattern exists but content doesn't, replacement is needed
        return !fileContent.includes(options.replace);
      
      default:
        return false;
    }
  }

  /**
   * Perform the actual injection based on mode
   * @param {string} originalContent - Original file content
   * @param {string} content - Content to inject
   * @param {Object} options - Injection options
   * @returns {Promise<string>} Modified content
   */
  async performInjection(originalContent, content, options) {
    const mode = options.mode || 'append';

    switch (mode) {
      case 'append':
        return this.appendContent(originalContent, content);
      
      case 'prepend':
        return this.prependContent(originalContent, content);
      
      case 'lineAt':
        return this.insertAtLine(originalContent, content, options.lineAt);
      
      case 'before':
        return this.insertBeforePattern(originalContent, content, options.before);
      
      case 'after':
        return this.insertAfterPattern(originalContent, content, options.after);
      
      case 'replace':
        return this.replacePattern(originalContent, content, options.replace);
      
      default:
        throw new Error(`Unsupported injection mode: ${mode}`);
    }
  }

  /**
   * Append content to end of file
   * @param {string} originalContent - Original content
   * @param {string} content - Content to append
   * @returns {string} Modified content
   */
  appendContent(originalContent, content) {
    // Ensure proper line endings
    let result = originalContent;
    
    if (result && !result.endsWith('\n')) {
      result += '\n';
    }
    
    result += content;
    
    if (!content.endsWith('\n')) {
      result += '\n';
    }
    
    return result;
  }

  /**
   * Prepend content to start of file
   * @param {string} originalContent - Original content
   * @param {string} content - Content to prepend
   * @returns {string} Modified content
   */
  prependContent(originalContent, content) {
    let result = content;
    
    if (!content.endsWith('\n')) {
      result += '\n';
    }
    
    if (originalContent) {
      result += originalContent;
    }
    
    return result;
  }

  /**
   * Insert content at specific line number
   * @param {string} originalContent - Original content
   * @param {string} content - Content to insert
   * @param {number} lineNumber - Line number (1-based)
   * @returns {string} Modified content
   */
  insertAtLine(originalContent, content, lineNumber) {
    const lines = originalContent.split('\n');
    const insertIndex = Math.max(0, Math.min(lineNumber - 1, lines.length));
    
    const contentLines = content.split('\n');
    lines.splice(insertIndex, 0, ...contentLines);
    
    return lines.join('\n');
  }

  /**
   * Insert content before matching pattern
   * @param {string} originalContent - Original content
   * @param {string} content - Content to insert
   * @param {string} pattern - Pattern to match
   * @returns {string} Modified content
   */
  insertBeforePattern(originalContent, content, pattern) {
    const patternIndex = originalContent.indexOf(pattern);
    
    if (patternIndex === -1) {
      throw new Error(`Pattern not found: ${pattern}`);
    }
    
    const before = originalContent.substring(0, patternIndex);
    const after = originalContent.substring(patternIndex);
    
    return before + content + '\n' + after;
  }

  /**
   * Insert content after matching pattern
   * @param {string} originalContent - Original content
   * @param {string} content - Content to insert
   * @param {string} pattern - Pattern to match
   * @returns {string} Modified content
   */
  insertAfterPattern(originalContent, content, pattern) {
    const patternIndex = originalContent.indexOf(pattern);
    
    if (patternIndex === -1) {
      throw new Error(`Pattern not found: ${pattern}`);
    }
    
    const patternEnd = patternIndex + pattern.length;
    const before = originalContent.substring(0, patternEnd);
    const after = originalContent.substring(patternEnd);
    
    return before + '\n' + content + after;
  }

  /**
   * Replace pattern with content
   * @param {string} originalContent - Original content
   * @param {string} content - Replacement content
   * @param {string} pattern - Pattern to replace
   * @returns {string} Modified content
   */
  replacePattern(originalContent, content, pattern) {
    if (!originalContent.includes(pattern)) {
      throw new Error(`Pattern not found: ${pattern}`);
    }
    
    return originalContent.replace(pattern, content);
  }

  /**
   * Validate injection result
   * @param {string} originalContent - Original content
   * @param {string} modifiedContent - Modified content
   * @param {string} injectedContent - Injected content
   * @param {Object} options - Injection options
   */
  validateInjectionResult(originalContent, modifiedContent, injectedContent, options) {
    // Basic sanity checks
    if (modifiedContent.length < originalContent.length && options.mode !== 'replace') {
      throw new Error('Modified content is shorter than original (invalid injection)');
    }

    // Ensure injected content is present (unless replace mode removed it)
    if (options.mode !== 'replace' && !modifiedContent.includes(injectedContent.trim())) {
      throw new Error('Injected content not found in result');
    }

    // Mode-specific validation
    switch (options.mode) {
      case 'append':
        if (!modifiedContent.includes(originalContent)) {
          throw new Error('Original content missing after append');
        }
        break;
      
      case 'prepend':
        if (!modifiedContent.includes(originalContent)) {
          throw new Error('Original content missing after prepend');
        }
        break;
      
      case 'lineAt':
        const expectedLines = this.countLines(originalContent) + this.countLines(injectedContent);
        const actualLines = this.countLines(modifiedContent);
        if (actualLines < expectedLines) {
          throw new Error('Incorrect line count after line insertion');
        }
        break;
    }
  }

  /**
   * Write content to file safely with directory creation
   * @param {string} filePath - Target file path
   * @param {string} content - Content to write
   * @returns {Promise<void>}
   */
  async writeContentSafely(filePath, content) {
    try {
      // Ensure directory exists
      const dir = dirname(filePath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      // Write content atomically
      writeFileSync(filePath, content, 'utf8');

      this.logger.debug('Content written successfully', {
        filePath,
        contentLength: content.length
      });

    } catch (error) {
      this.logger.error('Failed to write content', {
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
      this.backupPaths.set(filePath, backupPath);

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
   * Rollback file to backup
   * @param {string} filePath - File to rollback
   * @returns {Promise<boolean>} True if rollback succeeded
   */
  async rollback(filePath) {
    const backupPath = this.backupPaths.get(filePath);

    if (!backupPath || !existsSync(backupPath)) {
      this.logger.warn('No backup available for rollback', { filePath });
      return false;
    }

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
   * Record injection in history
   * @param {string} filePath - Target file path
   * @param {Object} injection - Injection details
   */
  recordInjection(filePath, injection) {
    if (!this.injectionHistory.has(filePath)) {
      this.injectionHistory.set(filePath, []);
    }

    this.injectionHistory.get(filePath).push(injection);

    // Keep only last 10 injections per file
    const history = this.injectionHistory.get(filePath);
    if (history.length > 10) {
      history.splice(0, history.length - 10);
    }
  }

  /**
   * Get injection history for file
   * @param {string} filePath - File path
   * @returns {Array<Object>} Injection history
   */
  getInjectionHistory(filePath) {
    return this.injectionHistory.get(filePath) || [];
  }

  /**
   * Count lines in content
   * @param {string} content - Content to count
   * @returns {number} Line count
   */
  countLines(content) {
    if (!content) return 0;
    return content.split('\n').length;
  }

  /**
   * Clean up old backups
   * @param {number} maxAge - Maximum age in milliseconds
   * @returns {Promise<number>} Number of backups cleaned
   */
  async cleanupBackups(maxAge = 24 * 60 * 60 * 1000) { // 24 hours default
    let cleanedCount = 0;
    const now = Date.now();

    for (const [filePath, backupPath] of this.backupPaths.entries()) {
      try {
        if (existsSync(backupPath)) {
          const stats = require('fs').statSync(backupPath);
          const age = now - stats.mtime.getTime();

          if (age > maxAge) {
            require('fs').unlinkSync(backupPath);
            this.backupPaths.delete(filePath);
            cleanedCount++;

            this.logger.debug('Cleaned up old backup', {
              backupPath,
              age: `${Math.round(age / 1000 / 60)}min`
            });
          }
        } else {
          this.backupPaths.delete(filePath);
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
   * Get injection statistics
   * @returns {Object} Statistics object
   */
  getStatistics() {
    const totalInjections = Array.from(this.injectionHistory.values())
      .reduce((sum, history) => sum + history.length, 0);

    return {
      totalInjections,
      filesModified: this.injectionHistory.size,
      activeBackups: this.backupPaths.size,
      createBackups: this.createBackups,
      validateInjections: this.validateInjections
    };
  }

  /**
   * Clear injection history and backups
   */
  clear() {
    this.injectionHistory.clear();
    this.backupPaths.clear();
  }
}