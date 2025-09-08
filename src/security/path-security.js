/**
 * Advanced Path Security and File System Protection
 * Prevents path traversal, validates file operations, and enforces access controls
 */

import fs from 'fs-extra';
import path from 'path';
import { createHash } from 'crypto';
import { SecurityError } from './input-validator.js';

export class PathSecurityManager {
  constructor() {
    this.allowedBasePaths = new Set();
    this.blockedPaths = new Set();
    this.symlinkCache = new Map();
    this.pathValidationCache = new Map();
    this.cacheTimeout = 30000; // 30 seconds
    
    // Initialize default blocked paths
    this.initializeBlockedPaths();
  }

  /**
   * Initialize system-level blocked paths
   */
  initializeBlockedPaths() {
    const systemPaths = [
      // Unix/Linux system directories
      '/etc', '/root', '/sys', '/proc', '/dev', '/boot',
      '/usr/bin', '/usr/sbin', '/sbin', '/bin',
      '/var/log', '/var/run', '/var/lib',
      '/tmp/../', '/var/../',
      
      // Windows system directories  
      'C:\\Windows', 'C:\\System32', 'C:\\Program Files',
      'C:\\Users\\All Users', 'C:\\ProgramData',
      '%SYSTEMROOT%', '%WINDIR%', '%PROGRAMFILES%',
      
      // Environment variable expansions that could be dangerous
      '$HOME/../', '$USER/../', '$PATH/../'
    ];

    systemPaths.forEach(blockedPath => {
      this.blockedPaths.add(path.normalize(blockedPath).toLowerCase());
    });
  }

  /**
   * Add allowed base path for file operations
   */
  addAllowedBasePath(basePath) {
    try {
      const normalizedPath = path.resolve(basePath);
      this.allowedBasePaths.add(normalizedPath);
      return normalizedPath;
    } catch (error) {
      throw new SecurityError(`Invalid base path: ${error.message}`);
    }
  }

  /**
   * Comprehensive path validation with caching
   */
  async validatePath(filePath, options = {}) {
    const cacheKey = this.getCacheKey(filePath, options);
    const cached = this.pathValidationCache.get(cacheKey);
    
    // Return cached result if valid
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      if (!cached.valid) {
        throw new SecurityError(cached.error);
      }
      return cached.result;
    }

    try {
      const result = await this.performPathValidation(filePath, options);
      this.pathValidationCache.set(cacheKey, {
        valid: true,
        result,
        timestamp: Date.now()
      });
      return result;
    } catch (error) {
      this.pathValidationCache.set(cacheKey, {
        valid: false,
        error: error.message,
        timestamp: Date.now()
      });
      throw error;
    }
  }

  /**
   * Perform comprehensive path validation
   */
  async performPathValidation(filePath, options = {}) {
    if (typeof filePath !== 'string' || !filePath.trim()) {
      throw new SecurityError('Path must be a non-empty string');
    }

    // Step 1: Basic path normalization and validation
    const normalizedPath = this.normalizePath(filePath);
    
    // Step 2: Check for path traversal attempts
    this.checkPathTraversal(normalizedPath);
    
    // Step 3: Check against blocked paths
    this.checkBlockedPaths(normalizedPath);
    
    // Step 4: Validate against allowed base paths
    if (this.allowedBasePaths.size > 0) {
      this.validateAllowedBasePaths(normalizedPath);
    }
    
    // Step 5: Check for dangerous patterns
    this.checkDangerousPatterns(normalizedPath);
    
    // Step 6: Validate symlinks if file exists
    if (options.followSymlinks !== false) {
      await this.validateSymlinks(normalizedPath);
    }
    
    // Step 7: Check file extension if specified
    if (options.allowedExtensions) {
      this.validateExtension(normalizedPath, options.allowedExtensions);
    }

    return normalizedPath;
  }

  /**
   * Normalize path and handle edge cases
   */
  normalizePath(filePath) {
    try {
      // Handle Windows UNC paths
      if (filePath.startsWith('\\\\')) {
        throw new SecurityError('UNC paths not allowed');
      }

      // Handle URL schemes that might be disguised paths
      if (/^[a-z][a-z0-9+.-]*:/i.test(filePath)) {
        throw new SecurityError('URL schemes in paths not allowed');
      }

      // Normalize path separators
      let normalized = filePath.replace(/[\\\/]+/g, path.sep);
      
      // Remove null bytes and control characters
      normalized = normalized.replace(/[\x00-\x1f\x7f]/g, '');
      
      // Normalize the path
      normalized = path.normalize(normalized);
      
      return normalized;
    } catch (error) {
      throw new SecurityError(`Path normalization failed: ${error.message}`);
    }
  }

  /**
   * Check for path traversal attempts
   */
  checkPathTraversal(normalizedPath) {
    const dangerousPatterns = [
      /\.\.[\/\\]/g,  // Basic path traversal
      /\.[\/\\]/g,    // Hidden directory traversal
      /~[\/\\]/g,     // User directory traversal
      /%2e%2e[\/\\]/gi, // URL encoded traversal
      /%252e%252e[\/\\]/gi, // Double URL encoded
      /\.%2f/gi,      // Mixed encoding
      /\%5c\%2e\%2e/gi // Windows path traversal
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(normalizedPath)) {
        throw new SecurityError(`Path traversal detected: ${pattern}`);
      }
    }

    // Check for relative path components that could escape
    const pathComponents = normalizedPath.split(path.sep);
    let depth = 0;
    
    for (const component of pathComponents) {
      if (component === '..') {
        depth--;
        if (depth < 0) {
          throw new SecurityError('Path attempts to access parent directories');
        }
      } else if (component !== '.' && component !== '') {
        depth++;
      }
    }
  }

  /**
   * Check against system blocked paths
   */
  checkBlockedPaths(normalizedPath) {
    const lowerPath = normalizedPath.toLowerCase();
    
    for (const blockedPath of this.blockedPaths) {
      if (lowerPath.startsWith(blockedPath)) {
        throw new SecurityError(`Access to blocked path: ${blockedPath}`);
      }
    }
  }

  /**
   * Validate against allowed base paths
   */
  validateAllowedBasePaths(normalizedPath) {
    const absolutePath = path.resolve(normalizedPath);
    let isAllowed = false;

    for (const basePath of this.allowedBasePaths) {
      if (absolutePath.startsWith(basePath)) {
        isAllowed = true;
        break;
      }
    }

    if (!isAllowed) {
      throw new SecurityError('Path not within allowed base directories');
    }
  }

  /**
   * Check for dangerous filename patterns
   */
  checkDangerousPatterns(normalizedPath) {
    const filename = path.basename(normalizedPath);
    
    // Windows reserved names
    const windowsReserved = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\.|$)/i;
    if (windowsReserved.test(filename)) {
      throw new SecurityError(`Reserved filename not allowed: ${filename}`);
    }

    // Dangerous extensions (even if allowed, warn about them)
    const dangerousExtensions = ['.exe', '.bat', '.cmd', '.com', '.pif', '.scr', '.vbs', '.js'];
    const ext = path.extname(filename).toLowerCase();
    if (dangerousExtensions.includes(ext)) {
      console.warn(`Warning: Potentially dangerous file extension: ${ext}`);
    }

    // Check for hidden files starting with dot (configurable)
    if (filename.startsWith('.') && filename !== '.' && filename !== '..') {
      console.warn(`Warning: Hidden file detected: ${filename}`);
    }
  }

  /**
   * Validate symbolic links for security
   */
  async validateSymlinks(normalizedPath) {
    try {
      // Check if path exists first
      if (!(await fs.pathExists(normalizedPath))) {
        return; // Path doesn't exist, no symlink to check
      }

      const stats = await fs.lstat(normalizedPath);
      if (!stats.isSymbolicLink()) {
        return; // Not a symlink
      }

      // Check cache first
      const cacheKey = `symlink:${normalizedPath}`;
      const cached = this.symlinkCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        if (!cached.valid) {
          throw new SecurityError(cached.error);
        }
        return;
      }

      // Resolve symlink
      const realPath = await fs.realpath(normalizedPath);
      
      // Validate the target path
      await this.validateSymlinkTarget(realPath, normalizedPath);
      
      // Cache the result
      this.symlinkCache.set(cacheKey, {
        valid: true,
        target: realPath,
        timestamp: Date.now()
      });

    } catch (error) {
      if (error instanceof SecurityError) {
        throw error;
      }
      throw new SecurityError(`Symlink validation failed: ${error.message}`);
    }
  }

  /**
   * Validate symlink target path
   */
  async validateSymlinkTarget(targetPath, originalPath) {
    // Ensure target is not attempting path traversal
    this.checkPathTraversal(targetPath);
    this.checkBlockedPaths(targetPath);
    
    // If we have allowed base paths, ensure target is also within them
    if (this.allowedBasePaths.size > 0) {
      this.validateAllowedBasePaths(targetPath);
    }

    // Detect symlink loops (basic check)
    const targetStat = await fs.lstat(targetPath);
    if (targetStat.isSymbolicLink()) {
      const nextTarget = await fs.readlink(targetPath);
      if (path.resolve(path.dirname(targetPath), nextTarget) === originalPath) {
        throw new SecurityError('Symlink loop detected');
      }
    }
  }

  /**
   * Validate file extension against allowed list
   */
  validateExtension(normalizedPath, allowedExtensions) {
    const ext = path.extname(normalizedPath).toLowerCase();
    
    if (ext && !allowedExtensions.includes(ext)) {
      throw new SecurityError(`File extension not allowed: ${ext}`);
    }
  }

  /**
   * Secure file operation wrapper
   */
  async secureFileOperation(operation, filePath, ...args) {
    const validatedPath = await this.validatePath(filePath, {
      followSymlinks: true,
      allowedExtensions: ['.js', '.json', '.md', '.txt', '.yml', '.yaml']
    });

    try {
      return await operation(validatedPath, ...args);
    } catch (error) {
      throw new SecurityError(`Secure file operation failed: ${error.message}`);
    }
  }

  /**
   * Batch validate multiple paths
   */
  async validatePaths(paths, options = {}) {
    const results = await Promise.allSettled(
      paths.map(async (filePath) => {
        try {
          const validated = await this.validatePath(filePath, options);
          return { path: filePath, validated, valid: true };
        } catch (error) {
          return { path: filePath, error: error.message, valid: false };
        }
      })
    );

    const valid = results
      .filter(result => result.status === 'fulfilled' && result.value.valid)
      .map(result => result.value);

    const invalid = results
      .filter(result => result.status === 'fulfilled' && !result.value.valid)
      .map(result => result.value);

    return { valid, invalid, allValid: invalid.length === 0 };
  }

  /**
   * Create cache key for path validation
   */
  getCacheKey(filePath, options) {
    const optionsString = JSON.stringify(options);
    return createHash('sha256').update(`${filePath}:${optionsString}`).digest('hex');
  }

  /**
   * Clear validation caches
   */
  clearCaches() {
    this.pathValidationCache.clear();
    this.symlinkCache.clear();
  }

  /**
   * Get security statistics
   */
  getSecurityStats() {
    return {
      allowedBasePaths: Array.from(this.allowedBasePaths),
      blockedPaths: Array.from(this.blockedPaths),
      pathCacheSize: this.pathValidationCache.size,
      symlinkCacheSize: this.symlinkCache.size,
      cacheTimeout: this.cacheTimeout
    };
  }
}

/**
 * Secure file operations with automatic path validation
 */
export class SecureFileOperations {
  constructor(pathManager = null) {
    this.pathManager = pathManager || new PathSecurityManager();
  }

  async readFile(filePath, options = {}) {
    const validPath = await this.pathManager.validatePath(filePath);
    return fs.readFile(validPath, options.encoding || 'utf8');
  }

  async writeFile(filePath, content, options = {}) {
    const validPath = await this.pathManager.validatePath(filePath);
    
    // Ensure directory exists
    await fs.ensureDir(path.dirname(validPath));
    
    return fs.writeFile(validPath, content, options);
  }

  async appendFile(filePath, content, options = {}) {
    const validPath = await this.pathManager.validatePath(filePath);
    return fs.appendFile(validPath, content, options);
  }

  async pathExists(filePath) {
    const validPath = await this.pathManager.validatePath(filePath);
    return fs.pathExists(validPath);
  }

  async stat(filePath) {
    const validPath = await this.pathManager.validatePath(filePath);
    return fs.stat(validPath);
  }

  async readdir(dirPath, options = {}) {
    const validPath = await this.pathManager.validatePath(dirPath);
    return fs.readdir(validPath, options);
  }

  async ensureDir(dirPath) {
    const validPath = await this.pathManager.validatePath(dirPath);
    return fs.ensureDir(validPath);
  }

  async remove(filePath) {
    const validPath = await this.pathManager.validatePath(filePath);
    return fs.remove(validPath);
  }
}

// Export singleton instances
export const pathSecurityManager = new PathSecurityManager();
export const secureFileOps = new SecureFileOperations(pathSecurityManager);

// Auto-configure allowed paths based on current working directory
pathSecurityManager.addAllowedBasePath(process.cwd());
pathSecurityManager.addAllowedBasePath(path.join(process.cwd(), 'tmp'));
pathSecurityManager.addAllowedBasePath(path.join(process.cwd(), '_templates'));
pathSecurityManager.addAllowedBasePath(path.join(process.cwd(), 'src'));
pathSecurityManager.addAllowedBasePath(path.join(process.cwd(), 'test_output'));