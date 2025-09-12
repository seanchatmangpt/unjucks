/**
 * KGEN Operation Engine
 * 
 * Executes frontmatter-driven operations including write, inject, append, prepend,
 * and lineAt operations. Provides atomic file operations with rollback capabilities,
 * conflict resolution, and comprehensive audit trails.
 */

import fs from 'fs/promises';
import path from 'path';
import { EventEmitter } from 'events';
import { Logger } from 'consola';
import nunjucks from 'nunjucks';

export class OperationEngine extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      maxConcurrentOperations: 10,
      enableAtomicOperations: true,
      enableBackups: true,
      backupDirectory: '.kgen/backups',
      enableRollback: true,
      createDirectories: true,
      defaultFileMode: 0o644,
      defaultDirectoryMode: 0o755,
      enableDryRun: false,
      enableForceOverwrite: false,
      lineEnding: '\n',
      encoding: 'utf8',
      ...options
    };
    
    this.logger = new Logger({ tag: 'kgen-operation-engine' });
    this.activeOperations = new Map();
    this.operationHistory = [];
    this.backupRegistry = new Map();
    
    // Configure Nunjucks for content rendering
    this.nunjucksEnv = new nunjucks.Environment(null, {
      autoescape: false,
      throwOnUndefined: false,
      trimBlocks: true,
      lstripBlocks: true
    });
    
    this._setupFilters();
  }

  /**
   * Initialize the operation engine
   */
  async initialize() {
    try {
      this.logger.info('Initializing KGEN operation engine...');
      
      // Create backup directory if needed
      if (this.options.enableBackups && this.options.backupDirectory) {
        await this._ensureDirectory(this.options.backupDirectory);
      }
      
      this.emit('engine:ready');
      this.logger.success('KGEN operation engine initialized successfully');
      
    } catch (error) {
      this.logger.error('Failed to initialize operation engine:', error);
      throw error;
    }
  }

  /**
   * Execute template operation based on frontmatter configuration
   * @param {Object} operationConfig - Complete operation configuration
   * @returns {Promise<Object>} Operation result
   */
  async execute(operationConfig) {
    const {
      frontmatter,
      content,
      context,
      metadata,
      pathResolution,
      conditionalResult,
      operationId,
      provenanceContext
    } = operationConfig;
    
    const startTime = Date.now();
    
    try {
      this.logger.info(`Starting operation execution ${operationId}`);
      
      // Validate operation configuration
      const validationResult = this._validateOperationConfig(operationConfig);
      if (!validationResult.valid) {
        throw new Error(`Invalid operation configuration: ${validationResult.errors.join(', ')}`);
      }
      
      // Check if operation should be skipped due to conditions
      if (conditionalResult && conditionalResult.skip) {
        return {
          operationId,
          status: 'skipped',
          reason: conditionalResult.reason,
          artifacts: [],
          operationMetadata: {
            executionTime: Date.now() - startTime,
            operationType: 'skip'
          }
        };
      }
      
      // Render template content with context
      const renderResult = await this._renderContent(content, context, {
        operationId,
        metadata
      });
      
      if (!renderResult.success) {
        throw new Error(`Content rendering failed: ${renderResult.error}`);
      }
      
      // Determine operation type and execute
      const operationType = this._determineOperationType(frontmatter);
      const executionResult = await this._executeOperation({
        operationType,
        frontmatter,
        renderedContent: renderResult.content,
        pathResolution,
        operationId,
        metadata,
        provenanceContext
      });
      
      // Create operation metadata
      const operationMetadata = {
        executionTime: Date.now() - startTime,
        operationType,
        contentSize: renderResult.content.length,
        usedVariables: renderResult.usedVariables,
        pathResolution: pathResolution.status,
        renderingTime: renderResult.renderTime
      };
      
      // Record operation in history
      this._recordOperation({
        operationId,
        operationType,
        targetPath: pathResolution.resolvedPath,
        success: true,
        metadata: operationMetadata,
        timestamp: new Date()
      });
      
      // Emit completion event
      this.emit('operation:complete', {
        operationId,
        operationType,
        result: executionResult
      });
      
      this.logger.success(`Operation ${operationId} completed successfully`);
      
      return {
        operationId,
        status: 'success',
        operationType,
        artifacts: executionResult.artifacts,
        operationMetadata,
        executionResult
      };
      
    } catch (error) {
      // Record failed operation
      this._recordOperation({
        operationId,
        operationType: 'unknown',
        targetPath: pathResolution?.resolvedPath,
        success: false,
        error: error.message,
        timestamp: new Date()
      });
      
      this.emit('operation:error', { operationId, error });
      
      this.logger.error(`Operation ${operationId} failed:`, error);
      throw error;
    }
  }

  /**
   * Execute batch operations with concurrency control
   * @param {Array} operations - Array of operation configurations
   * @returns {Promise<Array>} Array of operation results
   */
  async executeBatch(operations) {
    const batchId = this._generateOperationId();
    const startTime = Date.now();
    
    try {
      this.logger.info(`Starting batch operation ${batchId} with ${operations.length} operations`);
      
      // Execute operations with controlled concurrency
      const semaphore = new Semaphore(this.options.maxConcurrentOperations);
      
      const results = await Promise.allSettled(
        operations.map(async (operation, index) => {
          await semaphore.acquire();
          try {
            return await this.execute({
              ...operation,
              batchId,
              batchIndex: index
            });
          } finally {
            semaphore.release();
          }
        })
      );
      
      // Collect results
      const successful = [];
      const failed = [];
      
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          successful.push(result.value);
        } else {
          failed.push({ index, error: result.reason });
        }
      });
      
      const batchResult = {
        batchId,
        status: failed.length === 0 ? 'success' : 'partial_success',
        total: operations.length,
        successful: successful.length,
        failed: failed.length,
        results: successful,
        errors: failed,
        batchMetadata: {
          executionTime: Date.now() - startTime,
          concurrency: this.options.maxConcurrentOperations
        }
      };
      
      this.emit('batch:complete', batchResult);
      
      return batchResult;
      
    } catch (error) {
      this.emit('batch:error', { batchId, error });
      throw error;
    }
  }

  /**
   * Validate operation configuration
   * @param {Object} config - Operation configuration
   * @returns {Object} Validation result
   */
  _validateOperationConfig(config) {
    const errors = [];
    
    if (!config.frontmatter || typeof config.frontmatter !== 'object') {
      errors.push('frontmatter is required and must be an object');
    }
    
    if (!config.content || typeof config.content !== 'string') {
      errors.push('content is required and must be a string');
    }
    
    if (!config.pathResolution || !config.pathResolution.resolvedPath) {
      errors.push('pathResolution with resolvedPath is required');
    }
    
    if (!config.operationId) {
      errors.push('operationId is required');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Render template content with context
   * @param {string} content - Template content
   * @param {Object} context - Rendering context
   * @param {Object} options - Rendering options
   * @returns {Promise<Object>} Render result
   */
  async _renderContent(content, context, options = {}) {
    const startTime = Date.now();
    
    try {
      // Track used variables
      const usedVariables = new Set();
      const trackingContext = new Proxy(context, {
        get(target, prop) {
          if (typeof prop === 'string') {
            usedVariables.add(prop);
          }
          return target[prop];
        }
      });
      
      // Render content with Nunjucks
      const renderedContent = this.nunjucksEnv.renderString(content, trackingContext);
      
      return {
        success: true,
        content: renderedContent,
        usedVariables: Array.from(usedVariables),
        renderTime: Date.now() - startTime,
        originalSize: content.length,
        renderedSize: renderedContent.length
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        renderTime: Date.now() - startTime
      };
    }
  }

  /**
   * Determine operation type from frontmatter
   * @param {Object} frontmatter - Parsed frontmatter
   * @returns {string} Operation type
   */
  _determineOperationType(frontmatter) {
    if (frontmatter.operationMode) {
      return frontmatter.operationMode;
    }
    
    if (frontmatter.inject) return 'inject';
    if (frontmatter.append) return 'append';
    if (frontmatter.prepend) return 'prepend';
    if (frontmatter.lineAt !== undefined) return 'lineAt';
    
    return 'write';
  }

  /**
   * Execute specific operation based on type
   * @param {Object} params - Operation parameters
   * @returns {Promise<Object>} Execution result
   */
  async _executeOperation(params) {
    const {
      operationType,
      frontmatter,
      renderedContent,
      pathResolution,
      operationId,
      metadata,
      provenanceContext
    } = params;
    
    const targetPath = pathResolution.absolutePath;
    
    // Check if this is a dry run
    if (this.options.enableDryRun || frontmatter.dryRun) {
      return await this._executeDryRun(params);
    }
    
    // Create backup if needed and file exists
    let backupPath = null;
    if (this.options.enableBackups && await this._fileExists(targetPath)) {
      backupPath = await this._createBackup(targetPath, operationId);
    }
    
    try {
      let result;
      
      switch (operationType) {
        case 'write':
          result = await this._executeWrite(targetPath, renderedContent, frontmatter, operationId);
          break;
          
        case 'inject':
          result = await this._executeInject(targetPath, renderedContent, frontmatter, operationId);
          break;
          
        case 'append':
          result = await this._executeAppend(targetPath, renderedContent, frontmatter, operationId);
          break;
          
        case 'prepend':
          result = await this._executePrepend(targetPath, renderedContent, frontmatter, operationId);
          break;
          
        case 'lineAt':
          result = await this._executeLineAt(targetPath, renderedContent, frontmatter, operationId);
          break;
          
        default:
          throw new Error(`Unknown operation type: ${operationType}`);
      }
      
      // Execute post-operation commands
      if (frontmatter.sh && Array.isArray(frontmatter.sh)) {
        await this._executeShellCommands(frontmatter.sh, {
          targetPath,
          operationId,
          workingDirectory: path.dirname(targetPath)
        });
      }
      
      // Set file permissions if specified
      if (frontmatter.chmod) {
        await this._setFilePermissions(targetPath, frontmatter.chmod);
      }
      
      // Clean up backup if operation succeeded
      if (backupPath && this.options.enableBackups) {
        this._registerBackup(targetPath, backupPath, operationId);
      }
      
      return result;
      
    } catch (error) {
      // Rollback changes if backup exists and rollback is enabled
      if (backupPath && this.options.enableRollback) {
        try {
          await this._rollbackFromBackup(targetPath, backupPath);
          this.logger.info(`Rolled back changes for ${targetPath}`);
        } catch (rollbackError) {
          this.logger.error(`Failed to rollback ${targetPath}:`, rollbackError);
        }
      }
      
      throw error;
    }
  }

  /**
   * Execute write operation (create/overwrite file)
   * @param {string} targetPath - Target file path
   * @param {string} content - Content to write
   * @param {Object} frontmatter - Frontmatter configuration
   * @param {string} operationId - Operation ID
   * @returns {Promise<Object>} Write result
   */
  async _executeWrite(targetPath, content, frontmatter, operationId) {
    // Check if file exists and overwrite is not forced
    if (await this._fileExists(targetPath) && !frontmatter.overwrite && !this.options.enableForceOverwrite) {
      throw new Error(`File already exists and overwrite not enabled: ${targetPath}`);
    }
    
    // Ensure directory exists
    if (this.options.createDirectories || frontmatter.createDirectories !== false) {
      await this._ensureDirectory(path.dirname(targetPath));
    }
    
    // Write content to file
    await fs.writeFile(targetPath, content, {
      encoding: this.options.encoding,
      mode: this.options.defaultFileMode
    });
    
    const stats = await fs.stat(targetPath);
    
    return {
      operationType: 'write',
      artifacts: [{
        type: 'file',
        path: targetPath,
        size: stats.size,
        created: !await this._fileExists(targetPath),
        modified: new Date(),
        operationId
      }]
    };
  }

  /**
   * Execute inject operation (insert content at specific markers)
   * @param {string} targetPath - Target file path
   * @param {string} content - Content to inject
   * @param {Object} frontmatter - Frontmatter configuration
   * @param {string} operationId - Operation ID
   * @returns {Promise<Object>} Inject result
   */
  async _executeInject(targetPath, content, frontmatter, operationId) {
    if (!await this._fileExists(targetPath)) {
      throw new Error(`Target file does not exist for injection: ${targetPath}`);
    }
    
    let existingContent = await fs.readFile(targetPath, { encoding: this.options.encoding });
    const originalSize = existingContent.length;
    let injected = false;
    let injectionPoint = null;
    
    // Handle before/after markers
    if (frontmatter.before) {
      const beforeIndex = existingContent.indexOf(frontmatter.before);
      if (beforeIndex !== -1) {
        existingContent = existingContent.slice(0, beforeIndex) + 
                         content + this.options.lineEnding +
                         existingContent.slice(beforeIndex);
        injected = true;
        injectionPoint = `before: ${frontmatter.before}`;
      }
    } else if (frontmatter.after) {
      const afterIndex = existingContent.indexOf(frontmatter.after);
      if (afterIndex !== -1) {
        const insertIndex = afterIndex + frontmatter.after.length;
        existingContent = existingContent.slice(0, insertIndex) + 
                         this.options.lineEnding + content +
                         existingContent.slice(insertIndex);
        injected = true;
        injectionPoint = `after: ${frontmatter.after}`;
      }
    } else {
      // Default injection at end of file
      existingContent += this.options.lineEnding + content;
      injected = true;
      injectionPoint = 'end of file';
    }
    
    if (!injected && (frontmatter.before || frontmatter.after)) {
      throw new Error(`Injection marker not found: ${frontmatter.before || frontmatter.after}`);
    }
    
    // Write modified content
    await fs.writeFile(targetPath, existingContent, {
      encoding: this.options.encoding
    });
    
    const stats = await fs.stat(targetPath);
    
    return {
      operationType: 'inject',
      artifacts: [{
        type: 'file',
        path: targetPath,
        size: stats.size,
        originalSize,
        injectionPoint,
        created: false,
        modified: new Date(),
        operationId
      }]
    };
  }

  /**
   * Execute append operation (add content to end of file)
   * @param {string} targetPath - Target file path
   * @param {string} content - Content to append
   * @param {Object} frontmatter - Frontmatter configuration
   * @param {string} operationId - Operation ID
   * @returns {Promise<Object>} Append result
   */
  async _executeAppend(targetPath, content, frontmatter, operationId) {
    let existingContent = '';
    let created = false;
    
    if (await this._fileExists(targetPath)) {
      existingContent = await fs.readFile(targetPath, { encoding: this.options.encoding });
    } else {
      created = true;
      // Ensure directory exists
      if (this.options.createDirectories || frontmatter.createDirectories !== false) {
        await this._ensureDirectory(path.dirname(targetPath));
      }
    }
    
    const originalSize = existingContent.length;
    const newContent = existingContent + 
                      (existingContent.length > 0 ? this.options.lineEnding : '') + 
                      content;
    
    await fs.writeFile(targetPath, newContent, {
      encoding: this.options.encoding,
      mode: this.options.defaultFileMode
    });
    
    const stats = await fs.stat(targetPath);
    
    return {
      operationType: 'append',
      artifacts: [{
        type: 'file',
        path: targetPath,
        size: stats.size,
        originalSize,
        created,
        modified: new Date(),
        operationId
      }]
    };
  }

  /**
   * Execute prepend operation (add content to beginning of file)
   * @param {string} targetPath - Target file path
   * @param {string} content - Content to prepend
   * @param {Object} frontmatter - Frontmatter configuration
   * @param {string} operationId - Operation ID
   * @returns {Promise<Object>} Prepend result
   */
  async _executePrepend(targetPath, content, frontmatter, operationId) {
    let existingContent = '';
    let created = false;
    
    if (await this._fileExists(targetPath)) {
      existingContent = await fs.readFile(targetPath, { encoding: this.options.encoding });
    } else {
      created = true;
      // Ensure directory exists
      if (this.options.createDirectories || frontmatter.createDirectories !== false) {
        await this._ensureDirectory(path.dirname(targetPath));
      }
    }
    
    const originalSize = existingContent.length;
    const newContent = content + 
                      (existingContent.length > 0 ? this.options.lineEnding : '') + 
                      existingContent;
    
    await fs.writeFile(targetPath, newContent, {
      encoding: this.options.encoding,
      mode: this.options.defaultFileMode
    });
    
    const stats = await fs.stat(targetPath);
    
    return {
      operationType: 'prepend',
      artifacts: [{
        type: 'file',
        path: targetPath,
        size: stats.size,
        originalSize,
        created,
        modified: new Date(),
        operationId
      }]
    };
  }

  /**
   * Execute lineAt operation (insert content at specific line number)
   * @param {string} targetPath - Target file path
   * @param {string} content - Content to insert
   * @param {Object} frontmatter - Frontmatter configuration
   * @param {string} operationId - Operation ID
   * @returns {Promise<Object>} LineAt result
   */
  async _executeLineAt(targetPath, content, frontmatter, operationId) {
    if (!await this._fileExists(targetPath)) {
      throw new Error(`Target file does not exist for line insertion: ${targetPath}`);
    }
    
    const existingContent = await fs.readFile(targetPath, { encoding: this.options.encoding });
    const lines = existingContent.split('\n');
    const lineNumber = frontmatter.lineNumber || frontmatter.lineAt;
    
    if (lineNumber < 1 || lineNumber > lines.length + 1) {
      throw new Error(`Invalid line number ${lineNumber} for file with ${lines.length} lines`);
    }
    
    // Insert content at specified line (1-based indexing)
    lines.splice(lineNumber - 1, 0, content);
    const newContent = lines.join('\n');
    
    await fs.writeFile(targetPath, newContent, {
      encoding: this.options.encoding
    });
    
    const stats = await fs.stat(targetPath);
    
    return {
      operationType: 'lineAt',
      artifacts: [{
        type: 'file',
        path: targetPath,
        size: stats.size,
        originalSize: existingContent.length,
        lineNumber,
        created: false,
        modified: new Date(),
        operationId
      }]
    };
  }

  /**
   * Execute dry run (simulate operation without making changes)
   * @param {Object} params - Operation parameters
   * @returns {Promise<Object>} Dry run result
   */
  async _executeDryRun(params) {
    const {
      operationType,
      frontmatter,
      renderedContent,
      pathResolution,
      operationId
    } = params;
    
    const targetPath = pathResolution.absolutePath;
    const fileExists = await this._fileExists(targetPath);
    
    return {
      operationType: `${operationType}_dry_run`,
      dryRun: true,
      artifacts: [{
        type: 'simulated_file',
        path: targetPath,
        size: renderedContent.length,
        exists: fileExists,
        wouldCreate: !fileExists,
        operationId
      }]
    };
  }

  /**
   * Execute shell commands
   * @param {Array} commands - Array of shell commands
   * @param {Object} options - Execution options
   * @returns {Promise<Array>} Command results
   */
  async _executeShellCommands(commands, options = {}) {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    
    const results = [];
    
    for (const command of commands) {
      try {
        const result = await execAsync(command, {
          cwd: options.workingDirectory || process.cwd(),
          env: { ...process.env },
          timeout: 30000
        });
        
        results.push({
          command,
          success: true,
          stdout: result.stdout,
          stderr: result.stderr
        });
        
      } catch (error) {
        results.push({
          command,
          success: false,
          error: error.message,
          stdout: error.stdout || '',
          stderr: error.stderr || ''
        });
        
        // Continue with other commands even if one fails
        this.logger.warn(`Shell command failed: ${command}`, error.message);
      }
    }
    
    return results;
  }

  /**
   * Set file permissions
   * @param {string} filePath - File path
   * @param {string|number} chmod - Permissions
   */
  async _setFilePermissions(filePath, chmod) {
    try {
      const mode = typeof chmod === 'string' ? parseInt(chmod, 8) : chmod;
      await fs.chmod(filePath, mode);
    } catch (error) {
      this.logger.warn(`Failed to set permissions for ${filePath}:`, error.message);
    }
  }

  /**
   * Check if file exists
   * @param {string} filePath - File path to check
   * @returns {Promise<boolean>} Whether file exists
   */
  async _fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Ensure directory exists
   * @param {string} dirPath - Directory path
   */
  async _ensureDirectory(dirPath) {
    try {
      await fs.mkdir(dirPath, { 
        recursive: true, 
        mode: this.options.defaultDirectoryMode 
      });
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
  }

  /**
   * Create backup of file
   * @param {string} filePath - File to backup
   * @param {string} operationId - Operation ID
   * @returns {Promise<string>} Backup file path
   */
  async _createBackup(filePath, operationId) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `${path.basename(filePath)}.${operationId}.${timestamp}.backup`;
    const backupPath = path.join(this.options.backupDirectory, backupName);
    
    await this._ensureDirectory(this.options.backupDirectory);
    await fs.copyFile(filePath, backupPath);
    
    return backupPath;
  }

  /**
   * Register backup for cleanup
   * @param {string} originalPath - Original file path
   * @param {string} backupPath - Backup file path
   * @param {string} operationId - Operation ID
   */
  _registerBackup(originalPath, backupPath, operationId) {
    if (!this.backupRegistry.has(operationId)) {
      this.backupRegistry.set(operationId, []);
    }
    
    this.backupRegistry.get(operationId).push({
      originalPath,
      backupPath,
      timestamp: new Date()
    });
  }

  /**
   * Rollback from backup
   * @param {string} targetPath - Target file path
   * @param {string} backupPath - Backup file path
   */
  async _rollbackFromBackup(targetPath, backupPath) {
    if (await this._fileExists(backupPath)) {
      await fs.copyFile(backupPath, targetPath);
    }
  }

  /**
   * Record operation in history
   * @param {Object} operation - Operation record
   */
  _recordOperation(operation) {
    this.operationHistory.push(operation);
    
    // Limit history size
    if (this.operationHistory.length > 1000) {
      this.operationHistory.splice(0, this.operationHistory.length - 1000);
    }
  }

  /**
   * Setup Nunjucks filters for content rendering
   */
  _setupFilters() {
    // Add common filters
    this.nunjucksEnv.addFilter('upper', (str) => String(str).toUpperCase());
    this.nunjucksEnv.addFilter('lower', (str) => String(str).toLowerCase());
    this.nunjucksEnv.addFilter('title', (str) => String(str).replace(/\w\S*/g, (txt) => 
      txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()));
    this.nunjucksEnv.addFilter('camelCase', (str) => String(str).replace(/[-_](.)/g, (_, c) => c.toUpperCase()));
    this.nunjucksEnv.addFilter('pascalCase', (str) => {
      const camelCase = String(str).replace(/[-_](.)/g, (_, c) => c.toUpperCase());
      return camelCase.charAt(0).toUpperCase() + camelCase.slice(1);
    });
    this.nunjucksEnv.addFilter('kebabCase', (str) => String(str).replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase());
    this.nunjucksEnv.addFilter('snakeCase', (str) => String(str).replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase());
  }

  /**
   * Generate operation ID
   * @returns {string} Operation ID
   */
  _generateOperationId() {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Shutdown the operation engine
   */
  async shutdown() {
    try {
      this.logger.info('Shutting down operation engine...');
      
      // Wait for active operations to complete
      while (this.activeOperations.size > 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      this.emit('engine:shutdown');
      this.logger.success('Operation engine shutdown completed');
      
    } catch (error) {
      this.logger.error('Error during operation engine shutdown:', error);
      throw error;
    }
  }

  /**
   * Get operation statistics
   */
  getStatistics() {
    return {
      activeOperations: this.activeOperations.size,
      operationHistory: this.operationHistory.length,
      backupRegistry: this.backupRegistry.size,
      options: this.options
    };
  }

  /**
   * Get operation history
   * @param {Object} filters - Optional filters
   * @returns {Array} Filtered operation history
   */
  getOperationHistory(filters = {}) {
    let history = [...this.operationHistory];
    
    if (filters.operationId) {
      history = history.filter(op => op.operationId === filters.operationId);
    }
    
    if (filters.operationType) {
      history = history.filter(op => op.operationType === filters.operationType);
    }
    
    if (filters.success !== undefined) {
      history = history.filter(op => op.success === filters.success);
    }
    
    if (filters.since) {
      const sinceDate = new Date(filters.since);
      history = history.filter(op => op.timestamp >= sinceDate);
    }
    
    return history;
  }
}

/**
 * Simple semaphore for concurrency control
 */
class Semaphore {
  constructor(capacity) {
    this.capacity = capacity;
    this.current = 0;
    this.queue = [];
  }
  
  async acquire() {
    if (this.current < this.capacity) {
      this.current++;
      return;
    }
    
    return new Promise((resolve) => {
      this.queue.push(resolve);
    });
  }
  
  release() {
    this.current--;
    
    if (this.queue.length > 0) {
      const resolve = this.queue.shift();
      this.current++;
      resolve();
    }
  }
}

export default OperationEngine;