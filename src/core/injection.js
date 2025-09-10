/**
 * File Injection System - Core Implementation
 * 
 * Provides robust mechanisms for code injection with multiple positioning strategies,
 * idempotent operations, and skipIf conditions. Implements the 80/20 principle
 * focusing on common injection patterns.
 * 
 * Features:
 * - Multiple injection modes: before, after, append, prepend, lineAt, replace
 * - Idempotent operations to prevent duplicate injections
 * - skipIf conditions for conditional injection
 * - Atomic file operations with backup and rollback
 * - Content detection and smart positioning
 * - Performance optimized for common use cases
 */

import fs from 'fs-extra';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { EOL } from 'node:os';

/**
 * @typedef {Object} InjectionConfig
 * @property {string} [to] - Target file path
 * @property {boolean} [inject] - Enable injection mode
 * @property {string} [before] - Insert before this pattern
 * @property {string} [after] - Insert after this pattern
 * @property {boolean} [append] - Append to end of file
 * @property {boolean} [prepend] - Prepend to start of file
 * @property {number} [lineAt] - Insert at specific line number
 * @property {string} [replace] - Replace this pattern
 * @property {string|boolean} [skipIf] - Skip condition expression
 * @property {string} [marker] - Unique marker for idempotent operations
 * @property {string} [chmod] - File permissions
 * @property {string|string[]} [sh] - Shell commands to execute
 */

/**
 * @typedef {Object} InjectionOptions
 * @property {boolean} [force] - Force injection even if skipIf fails
 * @property {boolean} [dry] - Dry run mode
 * @property {boolean} [backup] - Create backup before injection
 * @property {string} [backupDir] - Backup directory
 */

/**
 * @typedef {Object} InjectionResult
 * @property {boolean} success - Whether injection succeeded
 * @property {boolean} skipped - Whether injection was skipped
 * @property {string} action - Action performed
 * @property {string} message - Result message
 * @property {string} [backupPath] - Path to backup file
 * @property {string} [preview] - Preview of changes (dry run)
 * @property {string[]} [changes] - List of changes made
 * @property {number} [linesAdded] - Number of lines added
 * @property {number} [linesRemoved] - Number of lines removed
 */

/**
 * Core File Injection Engine
 * 
 * Handles all file injection operations with support for multiple positioning
 * strategies, idempotent operations, and atomic file writes.
 */
export class FileInjector {
  constructor() {
    this.backupCounter = 0;
    this.patterns = {
      // Common injection markers
      imports: /^import\s+.*from\s+['"][^'"]+['"];?\s*$/gm,
      exports: /^export\s+.*$/gm,
      functions: /^(function|const|let|var)\s+\w+/gm,
      classes: /^(class|interface)\s+\w+/gm,
      comments: /^\s*\/\/.*$|^\s*\/\*.*?\*\/$/gm,
      blocks: /^\s*\{|\}$/gm
    };
  }

  /**
   * Process file injection with comprehensive error handling
   * 
   * @param {string} filePath - Target file path
   * @param {string} content - Content to inject
   * @param {InjectionConfig} config - Injection configuration
   * @param {InjectionOptions} options - Injection options
   * @returns {Promise<InjectionResult>}
   */
  async processFile(filePath, content, config = {}, options = {}) {
    const startTime = Date.now();
    
    try {
      // Validate inputs
      const validation = this.validateInputs(filePath, content, config);
      if (!validation.valid) {
        return {
          success: false,
          skipped: false,
          action: 'validation_failed',
          message: validation.error
        };
      }

      // Check if file exists
      const fileExists = await fs.pathExists(filePath);
      if (!fileExists && !options.force) {
        return {
          success: false,
          skipped: false,
          action: 'file_not_found',
          message: `Target file does not exist: ${filePath}`
        };
      }

      // Read existing content
      let existingContent = '';
      if (fileExists) {
        existingContent = await fs.readFile(filePath, 'utf8');
      }

      // Evaluate skipIf condition
      const skipResult = this.evaluateSkipCondition(config.skipIf, existingContent, content, config);
      if (skipResult.skip && !options.force) {
        return {
          success: true,
          skipped: true,
          action: 'skipped',
          message: skipResult.reason
        };
      }

      // Determine injection strategy
      const strategy = this.determineInjectionStrategy(config);
      if (!strategy) {
        return {
          success: false,
          skipped: false,
          action: 'invalid_strategy',
          message: 'No valid injection strategy specified'
        };
      }

      // Create backup if requested
      let backupPath;
      if (options.backup && fileExists && !options.dry) {
        backupPath = await this.createBackup(filePath, options.backupDir);
      }

      // Perform injection
      const injectionResult = await this.performInjection(
        existingContent,
        content,
        strategy,
        config
      );

      if (!injectionResult.success) {
        return {
          success: false,
          skipped: false,
          action: 'injection_failed',
          message: injectionResult.error,
          backupPath
        };
      }

      // Handle dry run
      if (options.dry) {
        return {
          success: true,
          skipped: false,
          action: 'dry_run',
          message: 'Dry run completed',
          preview: injectionResult.newContent,
          changes: injectionResult.changes,
          linesAdded: injectionResult.linesAdded,
          linesRemoved: injectionResult.linesRemoved
        };
      }

      // Write file atomically
      await this.writeFileAtomic(filePath, injectionResult.newContent);

      const duration = Date.now() - startTime;

      return {
        success: true,
        skipped: false,
        action: strategy.mode,
        message: `Content injected successfully using ${strategy.mode} strategy`,
        backupPath,
        changes: injectionResult.changes,
        linesAdded: injectionResult.linesAdded,
        linesRemoved: injectionResult.linesRemoved,
        duration
      };

    } catch (error) {
      return {
        success: false,
        skipped: false,
        action: 'error',
        message: `Injection failed: ${error.message}`
      };
    }
  }

  /**
   * Validate injection inputs
   * 
   * @param {string} filePath - File path to validate
   * @param {string} content - Content to validate
   * @param {InjectionConfig} config - Configuration to validate
   * @returns {Object} Validation result
   */
  validateInputs(filePath, content, config) {
    if (!filePath || typeof filePath !== 'string') {
      return { valid: false, error: 'Invalid file path' };
    }

    if (!content || typeof content !== 'string') {
      return { valid: false, error: 'Invalid content to inject' };
    }

    if (!config || typeof config !== 'object') {
      return { valid: false, error: 'Invalid injection configuration' };
    }

    // Check for path traversal
    const normalizedPath = path.normalize(filePath);
    if (normalizedPath.includes('..')) {
      return { valid: false, error: 'Path traversal detected' };
    }

    return { valid: true };
  }

  /**
   * Evaluate skipIf condition for idempotent operations
   * 
   * @param {string|boolean} skipIf - Skip condition
   * @param {string} existingContent - Current file content
   * @param {string} newContent - Content to inject
   * @param {InjectionConfig} config - Injection config
   * @returns {Object} Skip evaluation result
   */
  evaluateSkipCondition(skipIf, existingContent, newContent, config) {
    if (!skipIf) {
      return { skip: false };
    }

    // Boolean skip condition
    if (typeof skipIf === 'boolean') {
      return { 
        skip: skipIf,
        reason: skipIf ? 'Skip condition is true' : 'Skip condition is false'
      };
    }

    // String expression evaluation
    if (typeof skipIf === 'string') {
      try {
        // Simple template variable substitution
        let expression = skipIf
          .replace(/\{\{\s*content\s*\}\}/g, 'existingContent')
          .replace(/\{\{\s*newContent\s*\}\}/g, 'newContent')
          .replace(/\{\{\s*marker\s*\}\}/g, config.marker || '');

        // Common skip patterns
        if (expression.includes('content.includes(')) {
          const match = expression.match(/content\.includes\(['"`]([^'"`]+)['"`]\)/);
          if (match) {
            const searchText = match[1];
            const skip = existingContent.includes(searchText);
            return {
              skip,
              reason: skip 
                ? `Content already contains: ${searchText}`
                : `Content does not contain: ${searchText}`
            };
          }
        }

        // Marker-based idempotent injection
        if (config.marker) {
          const skip = existingContent.includes(config.marker);
          return {
            skip,
            reason: skip 
              ? `Marker already exists: ${config.marker}`
              : `Marker not found: ${config.marker}`
          };
        }

        // Default: check if exact content already exists
        const skip = existingContent.includes(newContent.trim());
        return {
          skip,
          reason: skip 
            ? 'Content already exists in file'
            : 'Content not found in file'
        };

      } catch (error) {
        return { 
          skip: false, 
          reason: `Skip condition evaluation failed: ${error.message}`
        };
      }
    }

    return { skip: false };
  }

  /**
   * Determine injection strategy from configuration
   * 
   * @param {InjectionConfig} config - Injection configuration
   * @returns {Object|null} Injection strategy
   */
  determineInjectionStrategy(config) {
    // Priority order for injection modes
    if (config.replace) {
      return { mode: 'replace', pattern: config.replace };
    }
    
    if (config.before) {
      return { mode: 'before', pattern: config.before };
    }
    
    if (config.after) {
      return { mode: 'after', pattern: config.after };
    }
    
    if (config.lineAt !== undefined) {
      return { mode: 'lineAt', line: config.lineAt };
    }
    
    if (config.prepend) {
      return { mode: 'prepend' };
    }
    
    if (config.append) {
      return { mode: 'append' };
    }

    // Default to append if inject is true
    if (config.inject) {
      return { mode: 'append' };
    }

    return null;
  }

  /**
   * Perform the actual content injection
   * 
   * @param {string} existingContent - Current file content
   * @param {string} newContent - Content to inject
   * @param {Object} strategy - Injection strategy
   * @param {InjectionConfig} config - Injection configuration
   * @returns {Promise<Object>} Injection result
   */
  async performInjection(existingContent, newContent, strategy, config) {
    const lines = existingContent.split(/\r?\n/);
    const newLines = [...lines];
    const changes = [];
    let linesAdded = 0;
    let linesRemoved = 0;

    try {
      switch (strategy.mode) {
        case 'append':
          return this.appendContent(existingContent, newContent, config);

        case 'prepend':
          return this.prependContent(existingContent, newContent, config);

        case 'lineAt':
          return this.insertAtLine(lines, newContent, strategy.line, config);

        case 'before':
          return this.insertBefore(lines, newContent, strategy.pattern, config);

        case 'after':
          return this.insertAfter(lines, newContent, strategy.pattern, config);

        case 'replace':
          return this.replaceContent(existingContent, newContent, strategy.pattern, config);

        default:
          throw new Error(`Unsupported injection mode: ${strategy.mode}`);
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Append content to end of file
   */
  appendContent(existingContent, newContent, config) {
    const separator = existingContent.endsWith('\n') ? '' : '\n';
    const finalContent = config.marker 
      ? `${existingContent}${separator}${config.marker}\n${newContent}\n`
      : `${existingContent}${separator}${newContent}\n`;

    return {
      success: true,
      newContent: finalContent,
      changes: ['Appended content to end of file'],
      linesAdded: newContent.split('\n').length + (config.marker ? 1 : 0),
      linesRemoved: 0
    };
  }

  /**
   * Prepend content to start of file
   */
  prependContent(existingContent, newContent, config) {
    const finalContent = config.marker
      ? `${config.marker}\n${newContent}\n${existingContent}`
      : `${newContent}\n${existingContent}`;

    return {
      success: true,
      newContent: finalContent,
      changes: ['Prepended content to start of file'],
      linesAdded: newContent.split('\n').length + (config.marker ? 1 : 0),
      linesRemoved: 0
    };
  }

  /**
   * Insert content at specific line number
   */
  insertAtLine(lines, newContent, lineNumber, config) {
    const insertIndex = Math.max(0, Math.min(lineNumber - 1, lines.length));
    const contentLines = newContent.split('\n');
    
    if (config.marker) {
      contentLines.unshift(config.marker);
    }

    lines.splice(insertIndex, 0, ...contentLines);

    return {
      success: true,
      newContent: lines.join('\n'),
      changes: [`Inserted content at line ${lineNumber}`],
      linesAdded: contentLines.length,
      linesRemoved: 0
    };
  }

  /**
   * Insert content before matching pattern
   */
  insertBefore(lines, newContent, pattern, config) {
    let insertIndex = -1;
    
    // Find the first line matching the pattern
    for (let i = 0; i < lines.length; i++) {
      if (this.matchesPattern(lines[i], pattern)) {
        insertIndex = i;
        break;
      }
    }

    if (insertIndex === -1) {
      throw new Error(`Pattern not found: ${pattern}`);
    }

    const contentLines = newContent.split('\n');
    if (config.marker) {
      contentLines.unshift(config.marker);
    }

    lines.splice(insertIndex, 0, ...contentLines);

    return {
      success: true,
      newContent: lines.join('\n'),
      changes: [`Inserted content before pattern: ${pattern}`],
      linesAdded: contentLines.length,
      linesRemoved: 0
    };
  }

  /**
   * Insert content after matching pattern
   */
  insertAfter(lines, newContent, pattern, config) {
    let insertIndex = -1;
    
    // Find the first line matching the pattern
    for (let i = 0; i < lines.length; i++) {
      if (this.matchesPattern(lines[i], pattern)) {
        insertIndex = i + 1;
        break;
      }
    }

    if (insertIndex === -1) {
      throw new Error(`Pattern not found: ${pattern}`);
    }

    const contentLines = newContent.split('\n');
    if (config.marker) {
      contentLines.unshift(config.marker);
    }

    lines.splice(insertIndex, 0, ...contentLines);

    return {
      success: true,
      newContent: lines.join('\n'),
      changes: [`Inserted content after pattern: ${pattern}`],
      linesAdded: contentLines.length,
      linesRemoved: 0
    };
  }

  /**
   * Replace content matching pattern
   */
  replaceContent(existingContent, newContent, pattern, config) {
    const regex = new RegExp(pattern, 'gm');
    const matches = existingContent.match(regex);
    
    if (!matches) {
      throw new Error(`Pattern not found for replacement: ${pattern}`);
    }

    const replacement = config.marker 
      ? `${config.marker}\n${newContent}`
      : newContent;

    const finalContent = existingContent.replace(regex, replacement);
    const originalLines = existingContent.split('\n').length;
    const newLines = finalContent.split('\n').length;

    return {
      success: true,
      newContent: finalContent,
      changes: [`Replaced ${matches.length} occurrence(s) of pattern: ${pattern}`],
      linesAdded: Math.max(0, newLines - originalLines),
      linesRemoved: Math.max(0, originalLines - newLines)
    };
  }

  /**
   * Check if a line matches a pattern (string or regex)
   */
  matchesPattern(line, pattern) {
    if (typeof pattern === 'string') {
      return line.includes(pattern);
    }
    
    if (pattern instanceof RegExp) {
      return pattern.test(line);
    }
    
    return false;
  }

  /**
   * Create backup of file before modification
   */
  async createBackup(filePath, backupDir) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = path.basename(filePath);
    const backupName = `${fileName}.backup-${timestamp}`;
    
    const backupPath = backupDir 
      ? path.join(backupDir, backupName)
      : path.join(path.dirname(filePath), backupName);

    await fs.ensureDir(path.dirname(backupPath));
    await fs.copy(filePath, backupPath);
    
    return backupPath;
  }

  /**
   * Write file atomically to prevent corruption
   */
  async writeFileAtomic(filePath, content) {
    const tempPath = `${filePath}.tmp-${Date.now()}`;
    
    try {
      await fs.ensureDir(path.dirname(filePath));
      await fs.writeFile(tempPath, content, 'utf8');
      await fs.move(tempPath, filePath);
    } catch (error) {
      // Clean up temp file if it exists
      if (await fs.pathExists(tempPath)) {
        await fs.remove(tempPath);
      }
      throw error;
    }
  }

  /**
   * Set file permissions
   */
  async setPermissions(filePath, mode) {
    try {
      const octalMode = typeof mode === 'string' ? parseInt(mode, 8) : mode;
      await fs.chmod(filePath, octalMode);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Execute shell commands
   */
  async executeCommands(commands, workingDir = process.cwd()) {
    const { spawn } = await import('node:child_process');
    const results = [];

    for (const command of commands) {
      try {
        const result = await new Promise((resolve, reject) => {
          const [cmd, ...args] = command.split(' ');
          const child = spawn(cmd, args, { 
            cwd: workingDir, 
            stdio: 'pipe',
            shell: true 
          });

          let stdout = '';
          let stderr = '';

          child.stdout.on('data', (data) => {
            stdout += data.toString();
          });

          child.stderr.on('data', (data) => {
            stderr += data.toString();
          });

          child.on('close', (code) => {
            resolve({ code, stdout, stderr });
          });

          child.on('error', reject);
        });

        results.push({
          command,
          success: result.code === 0,
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: result.code
        });

      } catch (error) {
        results.push({
          command,
          success: false,
          error: error.message
        });
      }
    }

    return {
      success: results.every(r => r.success),
      results
    };
  }

  /**
   * Generate content hash for idempotent operations
   */
  generateContentHash(content) {
    return createHash('md5').update(content).digest('hex').substring(0, 8);
  }

  /**
   * Smart pattern detection for common injection points
   */
  detectInjectionPoints(content, type = 'imports') {
    const points = [];
    const lines = content.split('\n');

    switch (type) {
      case 'imports':
        for (let i = 0; i < lines.length; i++) {
          if (this.patterns.imports.test(lines[i])) {
            points.push({ line: i + 1, content: lines[i] });
          }
        }
        break;

      case 'exports':
        for (let i = 0; i < lines.length; i++) {
          if (this.patterns.exports.test(lines[i])) {
            points.push({ line: i + 1, content: lines[i] });
          }
        }
        break;

      default:
        // Generic pattern detection
        const pattern = this.patterns[type];
        if (pattern) {
          for (let i = 0; i < lines.length; i++) {
            if (pattern.test(lines[i])) {
              points.push({ line: i + 1, content: lines[i] });
            }
          }
        }
    }

    return points;
  }
}

/**
 * File Injector Orchestrator
 * 
 * Higher-level orchestrator that handles multiple files and complex injection workflows
 */
export class FileInjectorOrchestrator {
  constructor() {
    this.injector = new FileInjector();
  }

  /**
   * Process single file injection
   */
  async processFile(filePath, content, config, options) {
    return await this.injector.processFile(filePath, content, config, options);
  }

  /**
   * Set file permissions
   */
  async setPermissions(filePath, mode) {
    return await this.injector.setPermissions(filePath, mode);
  }

  /**
   * Execute shell commands
   */
  async executeCommands(commands, workingDir) {
    return await this.injector.executeCommands(commands, workingDir);
  }

  /**
   * Process multiple files in batch
   */
  async processBatch(injections, options = {}) {
    const results = [];
    
    for (const injection of injections) {
      const result = await this.processFile(
        injection.filePath,
        injection.content,
        injection.config,
        { ...options, ...injection.options }
      );
      
      results.push({
        ...result,
        filePath: injection.filePath
      });
    }

    return {
      success: results.every(r => r.success),
      results,
      totalFiles: results.length,
      successfulFiles: results.filter(r => r.success).length,
      skippedFiles: results.filter(r => r.skipped).length
    };
  }

  /**
   * Validate injection configuration
   */
  validateConfig(config) {
    const errors = [];

    if (!config || typeof config !== 'object') {
      errors.push('Configuration must be an object');
      return { valid: false, errors };
    }

    // Check for conflicting injection modes
    const modes = ['before', 'after', 'append', 'prepend', 'lineAt', 'replace'];
    const activeModes = modes.filter(mode => config[mode] !== undefined && config[mode] !== false);
    
    if (activeModes.length > 1) {
      errors.push(`Multiple injection modes specified: ${activeModes.join(', ')}`);
    }

    if (activeModes.length === 0 && !config.inject) {
      errors.push('No injection mode specified');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get injector statistics
   */
  getStatistics() {
    return {
      version: '1.0.0',
      supportedModes: ['before', 'after', 'append', 'prepend', 'lineAt', 'replace'],
      features: [
        'Idempotent operations',
        'Skip conditions',
        'Atomic writes',
        'Backup creation',
        'Dry run mode',
        'Pattern matching',
        'Smart positioning'
      ]
    };
  }
}

// Export default instance for convenience
export const injector = new FileInjectorOrchestrator();