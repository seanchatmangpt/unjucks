/**
 * KGEN Path Resolver
 * 
 * Handles dynamic path generation for 'to:' fields in frontmatter.
 * Supports Nunjucks template rendering within paths, deterministic
 * output resolution, and conflict detection for enterprise workflows.
 */

import path from 'path';
import { EventEmitter } from 'events';
import { Logger } from 'consola';
import nunjucks from 'nunjucks';

export class PathResolver extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      deterministic: true,
      enableConflictDetection: true,
      baseDirectory: process.cwd(),
      allowAbsolutePaths: false,
      pathSeparator: path.sep,
      maxPathLength: 260, // Windows MAX_PATH limitation
      reservedNames: ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'],
      ...options
    };
    
    this.logger = new Logger({ tag: 'kgen-path-resolver' });
    this.pathCache = new Map();
    this.conflictRegistry = new Map();
    this.resolveHistory = [];
    
    // Configure Nunjucks for path rendering
    this.nunjucksEnv = new nunjucks.Environment(null, {
      autoescape: false,
      throwOnUndefined: false,
      trimBlocks: true,
      lstripBlocks: true
    });
    
    this._setupFilters();
  }

  /**
   * Resolve dynamic output paths from frontmatter and context
   * @param {Object} frontmatter - Parsed frontmatter
   * @param {Object} context - Template rendering context
   * @param {Object} options - Resolution options
   * @returns {Promise<Object>} Path resolution result
   */
  async resolve(frontmatter, context = {}, options = {}) {
    const startTime = Date.now();
    const operationId = options.operationId || this._generateOperationId();
    
    try {
      // Extract output path configuration
      const pathConfig = this._extractPathConfig(frontmatter);
      
      if (!pathConfig.outputPath) {
        return {
          operationId,
          status: 'no_path',
          reason: 'No output path specified in frontmatter',
          resolvedPath: null,
          originalPath: null,
          pathMetadata: {
            resolutionTime: Date.now() - startTime,
            cacheHit: false
          }
        };
      }
      
      // Generate cache key for deterministic resolution
      const cacheKey = this._generateCacheKey(pathConfig, context, options);
      
      // Check cache if enabled
      if (options.useCache !== false && this.pathCache.has(cacheKey)) {
        const cached = this.pathCache.get(cacheKey);
        return {
          ...cached,
          pathMetadata: {
            ...cached.pathMetadata,
            cacheHit: true
          }
        };
      }
      
      // Render dynamic path with context
      const renderResult = await this._renderPath(pathConfig.outputPath, context, options);
      
      if (!renderResult.success) {
        return {
          operationId,
          status: 'render_error',
          reason: `Failed to render path: ${renderResult.error}`,
          originalPath: pathConfig.outputPath,
          resolvedPath: null,
          pathMetadata: {
            resolutionTime: Date.now() - startTime,
            cacheHit: false,
            errors: [renderResult.error]
          }
        };
      }
      
      // Normalize and validate resolved path
      const normalizedPath = this._normalizePath(renderResult.renderedPath);
      const validationResult = await this._validatePath(normalizedPath, options);
      
      if (!validationResult.valid) {
        return {
          operationId,
          status: 'validation_error',
          reason: `Path validation failed: ${validationResult.errors.join(', ')}`,
          originalPath: pathConfig.outputPath,
          resolvedPath: normalizedPath,
          pathMetadata: {
            resolutionTime: Date.now() - startTime,
            cacheHit: false,
            errors: validationResult.errors,
            warnings: validationResult.warnings
          }
        };
      }
      
      // Check for conflicts if enabled
      let conflictResult = null;
      if (this.options.enableConflictDetection) {
        conflictResult = await this._checkConflicts(normalizedPath, operationId, options);
      }
      
      // Resolve final absolute path
      const absolutePath = this._resolveAbsolutePath(normalizedPath);
      
      // Create path metadata
      const pathMetadata = {
        resolutionTime: Date.now() - startTime,
        cacheHit: false,
        renderVariables: renderResult.usedVariables,
        normalizedPath,
        absolutePath,
        conflictResult,
        validationResult
      };
      
      const result = {
        operationId,
        status: 'success',
        originalPath: pathConfig.outputPath,
        resolvedPath: normalizedPath,
        absolutePath,
        pathConfig,
        pathMetadata
      };
      
      // Cache result if enabled
      if (options.useCache !== false) {
        this.pathCache.set(cacheKey, result);
      }
      
      // Register path for conflict detection
      if (this.options.enableConflictDetection) {
        this._registerPath(normalizedPath, operationId);
      }
      
      // Add to resolution history
      this.resolveHistory.push({
        operationId,
        timestamp: new Date(),
        originalPath: pathConfig.outputPath,
        resolvedPath: normalizedPath,
        success: true
      });
      
      // Emit resolution event
      this.emit('path:resolved', result);
      
      return result;
      
    } catch (error) {
      const errorResult = {
        operationId,
        status: 'error',
        reason: `Path resolution failed: ${error.message}`,
        originalPath: frontmatter.to || null,
        resolvedPath: null,
        pathMetadata: {
          resolutionTime: Date.now() - startTime,
          cacheHit: false,
          errors: [error.message]
        }
      };
      
      this.emit('path:error', { operationId, error, result: errorResult });
      
      return errorResult;
    }
  }

  /**
   * Batch resolve multiple paths
   * @param {Array} pathConfigs - Array of {frontmatter, context, options} objects
   * @returns {Promise<Array>} Array of resolution results
   */
  async batchResolve(pathConfigs) {
    const batchId = this._generateOperationId();
    const startTime = Date.now();
    
    try {
      this.logger.info(`Starting batch path resolution ${batchId} with ${pathConfigs.length} paths`);
      
      // Process paths with controlled concurrency
      const results = await Promise.allSettled(
        pathConfigs.map((config, index) => 
          this.resolve(config.frontmatter, config.context, {
            ...config.options,
            batchId,
            batchIndex: index
          })
        )
      );
      
      // Collect results and detect batch-level conflicts
      const successful = [];
      const failed = [];
      const paths = new Map();
      
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          const resolveResult = result.value;
          successful.push(resolveResult);
          
          if (resolveResult.resolvedPath) {
            if (paths.has(resolveResult.resolvedPath)) {
              // Batch-level path conflict detected
              paths.get(resolveResult.resolvedPath).push(index);
            } else {
              paths.set(resolveResult.resolvedPath, [index]);
            }
          }
        } else {
          failed.push({ index, error: result.reason });
        }
      });
      
      // Detect conflicts within batch
      const conflicts = [];
      for (const [path, indices] of paths.entries()) {
        if (indices.length > 1) {
          conflicts.push({ path, indices });
        }
      }
      
      const batchResult = {
        batchId,
        status: failed.length === 0 ? 'success' : 'partial_success',
        total: pathConfigs.length,
        successful: successful.length,
        failed: failed.length,
        conflicts: conflicts.length,
        results: successful,
        errors: failed,
        conflictDetails: conflicts,
        batchMetadata: {
          resolutionTime: Date.now() - startTime,
          pathCount: pathConfigs.length
        }
      };
      
      this.emit('path:batch_resolved', batchResult);
      
      return batchResult;
      
    } catch (error) {
      this.emit('path:batch_error', { batchId, error });
      throw error;
    }
  }

  /**
   * Extract path configuration from frontmatter
   * @param {Object} frontmatter - Parsed frontmatter
   * @returns {Object} Path configuration
   */
  _extractPathConfig(frontmatter) {
    const config = {
      outputPath: frontmatter.to || frontmatter.outputPath,
      operationMode: frontmatter.operationMode || 'write',
      createDirectories: frontmatter.createDirectories !== false,
      overwrite: frontmatter.overwrite === true,
      backup: frontmatter.backup === true,
      permissions: frontmatter.chmod
    };
    
    // Handle injection-specific path requirements
    if (config.operationMode === 'inject' || frontmatter.inject) {
      config.injectionMarkers = {
        before: frontmatter.before,
        after: frontmatter.after,
        lineAt: frontmatter.lineAt
      };
    }
    
    return config;
  }

  /**
   * Render dynamic path using Nunjucks
   * @param {string} pathTemplate - Path template with variables
   * @param {Object} context - Rendering context
   * @param {Object} options - Rendering options
   * @returns {Promise<Object>} Render result
   */
  async _renderPath(pathTemplate, context, options = {}) {
    try {
      // Track used variables for metadata
      const usedVariables = new Set();
      
      // Create context with variable tracking
      const trackingContext = new Proxy(context, {
        get(target, prop) {
          if (typeof prop === 'string') {
            usedVariables.add(prop);
          }
          return target[prop];
        }
      });
      
      // Render path template
      const renderedPath = this.nunjucksEnv.renderString(pathTemplate, trackingContext);
      
      return {
        success: true,
        renderedPath,
        usedVariables: Array.from(usedVariables),
        template: pathTemplate
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        template: pathTemplate
      };
    }
  }

  /**
   * Normalize path for cross-platform compatibility
   * @param {string} pathStr - Path to normalize
   * @returns {string} Normalized path
   */
  _normalizePath(pathStr) {
    if (!pathStr || typeof pathStr !== 'string') {
      return '';
    }
    
    // Remove leading/trailing whitespace
    let normalized = pathStr.trim();
    
    // Convert backslashes to forward slashes on non-Windows
    if (process.platform !== 'win32') {
      normalized = normalized.replace(/\\/g, '/');
    }
    
    // Remove duplicate separators
    normalized = normalized.replace(/[/\\]+/g, path.sep);
    
    // Resolve relative path components
    normalized = path.normalize(normalized);
    
    // Remove leading separator for relative paths
    if (!this.options.allowAbsolutePaths && path.isAbsolute(normalized)) {
      normalized = path.relative('/', normalized);
    }
    
    return normalized;
  }

  /**
   * Validate resolved path
   * @param {string} pathStr - Path to validate
   * @param {Object} options - Validation options
   * @returns {Promise<Object>} Validation result
   */
  async _validatePath(pathStr, options = {}) {
    const errors = [];
    const warnings = [];
    
    try {
      // Check path length
      if (pathStr.length > this.options.maxPathLength) {
        errors.push(`Path length (${pathStr.length}) exceeds maximum (${this.options.maxPathLength})`);
      }
      
      // Check for invalid characters
      const invalidChars = /[<>:"|?*\x00-\x1f]/;
      if (invalidChars.test(pathStr)) {
        errors.push('Path contains invalid characters');
      }
      
      // Check for reserved names (Windows)
      const pathParts = pathStr.split(path.sep);
      for (const part of pathParts) {
        const baseName = path.parse(part).name.toUpperCase();
        if (this.options.reservedNames.includes(baseName)) {
          errors.push(`Path contains reserved name: ${part}`);
        }
      }
      
      // Check for absolute paths if not allowed
      if (!this.options.allowAbsolutePaths && path.isAbsolute(pathStr)) {
        errors.push('Absolute paths are not allowed');
      }
      
      // Check for path traversal attempts
      if (pathStr.includes('..')) {
        warnings.push('Path contains parent directory references');
      }
      
      // Check for empty path components
      if (pathStr.includes(path.sep + path.sep)) {
        errors.push('Path contains empty components');
      }
      
      // Check file extension validity
      const extension = path.extname(pathStr);
      if (extension && extension.length > 10) {
        warnings.push(`Unusual file extension: ${extension}`);
      }
      
      return {
        valid: errors.length === 0,
        errors,
        warnings
      };
      
    } catch (error) {
      return {
        valid: false,
        errors: [`Path validation failed: ${error.message}`],
        warnings
      };
    }
  }

  /**
   * Check for path conflicts
   * @param {string} pathStr - Path to check
   * @param {string} operationId - Current operation ID
   * @param {Object} options - Conflict check options
   * @returns {Promise<Object>} Conflict check result
   */
  async _checkConflicts(pathStr, operationId, options = {}) {
    const conflicts = [];
    
    // Check against registered paths
    if (this.conflictRegistry.has(pathStr)) {
      const existingOperations = this.conflictRegistry.get(pathStr);
      existingOperations.forEach(existingOp => {
        if (existingOp.operationId !== operationId) {
          conflicts.push({
            type: 'path_collision',
            existingOperation: existingOp.operationId,
            timestamp: existingOp.timestamp
          });
        }
      });
    }
    
    // Check for similar paths (potential typos)
    const similarPaths = [];
    for (const [registeredPath] of this.conflictRegistry) {
      const similarity = this._calculatePathSimilarity(pathStr, registeredPath);
      if (similarity > 0.8 && similarity < 1.0) {
        similarPaths.push({
          path: registeredPath,
          similarity
        });
      }
    }
    
    return {
      hasConflicts: conflicts.length > 0,
      conflicts,
      similarPaths: similarPaths.length > 0 ? similarPaths : undefined
    };
  }

  /**
   * Register path for conflict detection
   * @param {string} pathStr - Path to register
   * @param {string} operationId - Operation ID
   */
  _registerPath(pathStr, operationId) {
    if (!this.conflictRegistry.has(pathStr)) {
      this.conflictRegistry.set(pathStr, []);
    }
    
    this.conflictRegistry.get(pathStr).push({
      operationId,
      timestamp: new Date()
    });
  }

  /**
   * Calculate path similarity for conflict detection
   * @param {string} path1 - First path
   * @param {string} path2 - Second path
   * @returns {number} Similarity score (0-1)
   */
  _calculatePathSimilarity(path1, path2) {
    if (path1 === path2) return 1.0;
    
    const len1 = path1.length;
    const len2 = path2.length;
    const maxLen = Math.max(len1, len2);
    
    if (maxLen === 0) return 1.0;
    
    // Simple Levenshtein distance calculation
    const matrix = Array(len2 + 1).fill(null).map(() => Array(len1 + 1).fill(null));
    
    for (let i = 0; i <= len1; i++) matrix[0][i] = i;
    for (let j = 0; j <= len2; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= len2; j++) {
      for (let i = 1; i <= len1; i++) {
        if (path1[i - 1] === path2[j - 1]) {
          matrix[j][i] = matrix[j - 1][i - 1];
        } else {
          matrix[j][i] = Math.min(
            matrix[j - 1][i] + 1,     // deletion
            matrix[j][i - 1] + 1,     // insertion
            matrix[j - 1][i - 1] + 1  // substitution
          );
        }
      }
    }
    
    const distance = matrix[len2][len1];
    return (maxLen - distance) / maxLen;
  }

  /**
   * Resolve absolute path safely
   * @param {string} pathStr - Relative path
   * @returns {string} Absolute path
   */
  _resolveAbsolutePath(pathStr) {
    if (path.isAbsolute(pathStr)) {
      return pathStr;
    }
    
    return path.resolve(this.options.baseDirectory, pathStr);
  }

  /**
   * Setup Nunjucks filters for path processing
   */
  _setupFilters() {
    // Path manipulation filters
    this.nunjucksEnv.addFilter('dirname', (pathStr) => path.dirname(pathStr));
    this.nunjucksEnv.addFilter('basename', (pathStr) => path.basename(pathStr));
    this.nunjucksEnv.addFilter('extname', (pathStr) => path.extname(pathStr));
    this.nunjucksEnv.addFilter('join', (pathParts) => path.join(...pathParts));
    
    // String manipulation filters commonly used in paths
    this.nunjucksEnv.addFilter('kebabCase', (str) => str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase());
    this.nunjucksEnv.addFilter('snakeCase', (str) => str.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase());
    this.nunjucksEnv.addFilter('camelCase', (str) => str.replace(/[-_](.)/g, (_, c) => c.toUpperCase()));
    this.nunjucksEnv.addFilter('pascalCase', (str) => str.charAt(0).toUpperCase() + str.slice(1).replace(/[-_](.)/g, (_, c) => c.toUpperCase()));
    this.nunjucksEnv.addFilter('titleCase', (str) => str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()));
  }

  /**
   * Generate cache key for path resolution
   * @param {Object} pathConfig - Path configuration
   * @param {Object} context - Rendering context
   * @param {Object} options - Resolution options
   * @returns {string} Cache key
   */
  _generateCacheKey(pathConfig, context, options) {
    const keyData = {
      outputPath: pathConfig.outputPath,
      context: JSON.stringify(context),
      deterministic: this.options.deterministic,
      options: JSON.stringify(options || {})
    };
    
    return this._simpleHash(JSON.stringify(keyData));
  }

  /**
   * Simple hash function for cache keys
   * @param {string} str - String to hash
   * @returns {string} Hash value
   */
  _simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Generate operation ID
   * @returns {string} Operation ID
   */
  _generateOperationId() {
    return `path_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Clear path caches and conflict registry
   */
  clearCache() {
    this.pathCache.clear();
    this.conflictRegistry.clear();
    this.resolveHistory.length = 0;
    this.emit('cache:cleared');
  }

  /**
   * Get path resolver statistics
   */
  getStatistics() {
    return {
      cacheSize: this.pathCache.size,
      conflictRegistrySize: this.conflictRegistry.size,
      resolutionHistory: this.resolveHistory.length,
      options: this.options
    };
  }
}

export default PathResolver;