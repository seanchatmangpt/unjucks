/**
 * Access Control Manager
 * File system access controls and permission management
 * Implements fine-grained access control with audit trails
 */

import { EventEmitter } from 'events';
import consola from 'consola';
import { promises as fs } from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class AccessControlManager extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      // Access control settings
      enableFileSystemACL: true,
      enablePathValidation: true,
      enableContentFiltering: true,
      
      // Path restrictions
      allowedBasePaths: [],
      blockedPaths: ['/etc', '/proc', '/sys', '/dev', '/var/log'],
      allowedExtensions: ['.json', '.yaml', '.yml', '.txt', '.md', '.rdf', '.ttl', '.n3'],
      blockedExtensions: ['.exe', '.bat', '.sh', '.ps1', '.com', '.scr'],
      
      // Size limits
      maxFileSize: 50 * 1024 * 1024, // 50MB
      maxDirectoryDepth: 10,
      maxFilesPerOperation: 1000,
      
      // Permission levels
      defaultPermissions: { read: false, write: false, execute: false },
      adminOverride: false,
      
      // Audit settings
      enableAuditLog: true,
      auditLogPath: './logs/access-control.log',
      logAllOperations: true,
      
      ...config
    };
    
    this.logger = consola.withTag('access-control');
    this.permissions = new Map();
    this.accessCache = new Map();
    this.auditTrail = [];
    
    // File operation counters
    this.metrics = {
      readOperations: 0,
      writeOperations: 0,
      deleteOperations: 0,
      accessDenied: 0,
      pathTraversalAttempts: 0,
      suspiciousActivity: 0
    };
    
    // Security patterns
    this.securityPatterns = {
      pathTraversal: [
        /\.\.\/|\.\.\\/g,
        /\%2e\%2e\%2f/gi,
        /\%2e\%2e\%5c/gi,
        /\.\.\x2f|\.\.\/|\.\.\x5c/g
      ],
      maliciousFiles: [
        /\.(exe|bat|cmd|com|pif|scr|vbs|js|jar|app|deb|dmg|pkg|run)$/i,
        /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i,
        /\x00/g // Null bytes
      ],
      suspiciousContent: [
        /<script[^>]*>.*?<\/script>/gi,
        /javascript:/gi,
        /vbscript:/gi,
        /data:text\/html/gi,
        /eval\s*\(/gi,
        /exec\s*\(/gi
      ]
    };
  }

  /**
   * Initialize access control manager
   */
  async initialize() {
    try {
      this.logger.info('Initializing access control manager...');
      
      // Validate configuration
      await this._validateConfiguration();
      
      // Load existing permissions
      await this._loadPermissions();
      
      // Setup audit logging
      if (this.config.enableAuditLog) {
        await this._initializeAuditLog();
      }
      
      // Setup cleanup interval
      this.cleanupInterval = setInterval(() => {
        this._cleanupAccessCache();
      }, 300000); // Every 5 minutes
      
      this.logger.success('Access control manager initialized');
      
    } catch (error) {
      this.logger.error('Failed to initialize access control manager:', error);
      throw error;
    }
  }

  /**
   * Check if file/directory access is allowed
   * @param {string} filePath - Path to check
   * @param {string} operation - Operation type (read|write|delete|execute)
   * @param {object} user - User context
   * @returns {Promise<object>} Access decision
   */
  async checkAccess(filePath, operation, user = {}) {
    const startTime = this.getDeterministicTimestamp();
    
    try {
      this.logger.debug(`Checking ${operation} access to: ${filePath}`);
      
      const accessResult = {
        allowed: false,
        path: filePath,
        operation,
        user: user.id || 'anonymous',
        reason: '',
        sanitizedPath: null,
        metadata: {
          timestamp: this.getDeterministicDate(),
          checkDuration: 0
        }
      };
      
      // Basic input validation
      if (!filePath || typeof filePath !== 'string') {
        accessResult.reason = 'Invalid file path';
        await this._logAccess(accessResult);
        return accessResult;
      }
      
      // Path traversal detection
      const pathTraversalCheck = this._detectPathTraversal(filePath);
      if (pathTraversalCheck.detected) {
        accessResult.reason = 'Path traversal detected';
        this.metrics.pathTraversalAttempts++;
        this.metrics.suspiciousActivity++;
        
        this.emit('security-violation', {
          type: 'path-traversal',
          path: filePath,
          user: user.id,
          details: pathTraversalCheck.violations
        });
        
        await this._logAccess(accessResult);
        return accessResult;
      }
      
      // Normalize and resolve path
      const resolvedPath = this._normalizePath(filePath);
      accessResult.sanitizedPath = resolvedPath;
      
      // Check against blocked paths
      if (this._isPathBlocked(resolvedPath)) {
        accessResult.reason = 'Path is in blocked list';
        this.metrics.accessDenied++;
        await this._logAccess(accessResult);
        return accessResult;
      }
      
      // Check against allowed base paths
      if (this.config.allowedBasePaths.length > 0) {
        if (!this._isPathAllowed(resolvedPath)) {
          accessResult.reason = 'Path not in allowed base paths';
          this.metrics.accessDenied++;
          await this._logAccess(accessResult);
          return accessResult;
        }
      }
      
      // File extension validation
      const extensionCheck = this._validateFileExtension(resolvedPath, operation);
      if (!extensionCheck.allowed) {
        accessResult.reason = extensionCheck.reason;
        this.metrics.accessDenied++;
        await this._logAccess(accessResult);
        return accessResult;
      }
      
      // Check file system permissions
      const fsPermissionCheck = await this._checkFileSystemPermissions(resolvedPath, operation, user);
      if (!fsPermissionCheck.allowed) {
        accessResult.reason = fsPermissionCheck.reason;
        this.metrics.accessDenied++;
        await this._logAccess(accessResult);
        return accessResult;
      }
      
      // File size validation for read/write operations
      if (operation === 'read' || operation === 'write') {
        const sizeCheck = await this._validateFileSize(resolvedPath);
        if (!sizeCheck.valid) {
          accessResult.reason = sizeCheck.reason;
          this.metrics.accessDenied++;
          await this._logAccess(accessResult);
          return accessResult;
        }
      }
      
      // Content security check for read operations
      if (operation === 'read' && this.config.enableContentFiltering) {
        const contentCheck = await this._validateFileContent(resolvedPath);
        if (!contentCheck.safe) {
          accessResult.reason = `Content security violation: ${contentCheck.violations.join(', ')}`;
          this.metrics.suspiciousActivity++;
          await this._logAccess(accessResult);
          return accessResult;
        }
      }
      
      // User-specific permission check
      const userPermissionCheck = this._checkUserPermissions(resolvedPath, operation, user);
      if (!userPermissionCheck.allowed) {
        accessResult.reason = userPermissionCheck.reason;
        this.metrics.accessDenied++;
        await this._logAccess(accessResult);
        return accessResult;
      }
      
      // All checks passed
      accessResult.allowed = true;
      accessResult.reason = 'Access granted';
      accessResult.metadata.checkDuration = this.getDeterministicTimestamp() - startTime;
      
      // Update metrics
      this._updateOperationMetrics(operation);
      
      // Cache successful access decision
      this._cacheAccessDecision(filePath, operation, user, accessResult);
      
      await this._logAccess(accessResult);
      
      this.emit('access-granted', {
        path: resolvedPath,
        operation,
        user: user.id,
        duration: accessResult.metadata.checkDuration
      });
      
      return accessResult;
      
    } catch (error) {
      this.logger.error(`Access check failed for ${filePath}:`, error);
      
      const errorResult = {
        allowed: false,
        path: filePath,
        operation,
        user: user.id || 'anonymous',
        reason: `Access check error: ${error.message}`,
        sanitizedPath: null,
        metadata: {
          timestamp: this.getDeterministicDate(),
          checkDuration: this.getDeterministicTimestamp() - startTime,
          error: error.message
        }
      };
      
      await this._logAccess(errorResult);
      return errorResult;
    }
  }

  /**
   * Secure file read with access control
   * @param {string} filePath - File to read
   * @param {object} user - User context
   * @param {object} options - Read options
   * @returns {Promise<object>} Read result
   */
  async secureReadFile(filePath, user = {}, options = {}) {
    try {
      const accessCheck = await this.checkAccess(filePath, 'read', user);
      
      if (!accessCheck.allowed) {
        throw new Error(`Read access denied: ${accessCheck.reason}`);
      }
      
      const content = await fs.readFile(accessCheck.sanitizedPath, options.encoding || 'utf8');
      
      // Post-read content validation
      if (this.config.enableContentFiltering) {
        const contentValidation = this._validateContentSecurity(content);
        if (!contentValidation.safe) {
          this.logger.warn(`Suspicious content detected in ${filePath}:`, contentValidation.violations);
        }
      }
      
      this.emit('file-read', {
        path: accessCheck.sanitizedPath,
        user: user.id,
        size: content.length
      });
      
      return {
        success: true,
        content,
        metadata: {
          path: accessCheck.sanitizedPath,
          size: content.length,
          readAt: this.getDeterministicDate()
        }
      };
      
    } catch (error) {
      this.logger.error(`Secure read failed for ${filePath}:`, error);
      
      return {
        success: false,
        error: error.message,
        metadata: {
          path: filePath,
          readAt: this.getDeterministicDate()
        }
      };
    }
  }

  /**
   * Secure file write with access control
   * @param {string} filePath - File to write
   * @param {string} content - Content to write
   * @param {object} user - User context
   * @param {object} options - Write options
   * @returns {Promise<object>} Write result
   */
  async secureWriteFile(filePath, content, user = {}, options = {}) {
    try {
      const accessCheck = await this.checkAccess(filePath, 'write', user);
      
      if (!accessCheck.allowed) {
        throw new Error(`Write access denied: ${accessCheck.reason}`);
      }
      
      // Content security validation before writing
      const contentValidation = this._validateContentSecurity(content);
      if (!contentValidation.safe) {
        throw new Error(`Content security violation: ${contentValidation.violations.join(', ')}`);
      }
      
      // Size validation
      if (content.length > this.config.maxFileSize) {
        throw new Error(`Content size exceeds limit: ${this.config.maxFileSize}`);
      }
      
      // Backup existing file if specified
      if (options.backup && await this._fileExists(accessCheck.sanitizedPath)) {
        await this._createBackup(accessCheck.sanitizedPath);
      }
      
      // Write file with proper permissions
      await fs.writeFile(accessCheck.sanitizedPath, content, {
        mode: options.mode || 0o644,
        ...options
      });
      
      this.emit('file-written', {
        path: accessCheck.sanitizedPath,
        user: user.id,
        size: content.length
      });
      
      return {
        success: true,
        metadata: {
          path: accessCheck.sanitizedPath,
          size: content.length,
          writtenAt: this.getDeterministicDate()
        }
      };
      
    } catch (error) {
      this.logger.error(`Secure write failed for ${filePath}:`, error);
      
      return {
        success: false,
        error: error.message,
        metadata: {
          path: filePath,
          writtenAt: this.getDeterministicDate()
        }
      };
    }
  }

  /**
   * List directory with access control
   * @param {string} dirPath - Directory to list
   * @param {object} user - User context
   * @param {object} options - List options
   * @returns {Promise<object>} Directory listing
   */
  async secureListDirectory(dirPath, user = {}, options = {}) {
    try {
      const accessCheck = await this.checkAccess(dirPath, 'read', user);
      
      if (!accessCheck.allowed) {
        throw new Error(`Directory read access denied: ${accessCheck.reason}`);
      }
      
      const entries = await fs.readdir(accessCheck.sanitizedPath, { withFileTypes: true });
      const filteredEntries = [];
      
      for (const entry of entries) {
        const entryPath = path.join(accessCheck.sanitizedPath, entry.name);
        
        // Check access for each entry
        const entryAccess = await this.checkAccess(entryPath, 'read', user);
        
        if (entryAccess.allowed) {
          const stat = await fs.stat(entryPath);
          
          filteredEntries.push({
            name: entry.name,
            path: entryPath,
            type: entry.isDirectory() ? 'directory' : 'file',
            size: stat.size,
            modified: stat.mtime,
            permissions: {
              read: entryAccess.allowed,
              write: (await this.checkAccess(entryPath, 'write', user)).allowed,
              execute: (await this.checkAccess(entryPath, 'execute', user)).allowed
            }
          });
        }
        
        // Limit number of entries to prevent DoS
        if (filteredEntries.length >= this.config.maxFilesPerOperation) {
          break;
        }
      }
      
      this.emit('directory-listed', {
        path: accessCheck.sanitizedPath,
        user: user.id,
        entryCount: filteredEntries.length
      });
      
      return {
        success: true,
        entries: filteredEntries,
        metadata: {
          path: accessCheck.sanitizedPath,
          totalEntries: entries.length,
          accessibleEntries: filteredEntries.length,
          listedAt: this.getDeterministicDate()
        }
      };
      
    } catch (error) {
      this.logger.error(`Directory listing failed for ${dirPath}:`, error);
      
      return {
        success: false,
        error: error.message,
        metadata: {
          path: dirPath,
          listedAt: this.getDeterministicDate()
        }
      };
    }
  }

  /**
   * Set user permissions for path
   * @param {string} pathPattern - Path or pattern
   * @param {string} userId - User ID
   * @param {object} permissions - Permission set
   */
  setUserPermissions(pathPattern, userId, permissions) {
    const key = `${userId}:${pathPattern}`;
    
    this.permissions.set(key, {
      ...this.config.defaultPermissions,
      ...permissions,
      createdAt: this.getDeterministicDate(),
      createdBy: 'system'
    });
    
    this.logger.info(`Set permissions for ${userId} on ${pathPattern}:`, permissions);
    
    this.emit('permissions-updated', {
      userId,
      pathPattern,
      permissions
    });
  }

  /**
   * Get access metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      activePermissions: this.permissions.size,
      cacheSize: this.accessCache.size,
      auditTrailSize: this.auditTrail.length
    };
  }

  /**
   * Get audit trail
   * @param {object} filter - Filter options
   * @returns {Array} Filtered audit entries
   */
  getAuditTrail(filter = {}) {
    let entries = [...this.auditTrail];
    
    if (filter.user) {
      entries = entries.filter(e => e.user === filter.user);
    }
    
    if (filter.operation) {
      entries = entries.filter(e => e.operation === filter.operation);
    }
    
    if (filter.allowed !== undefined) {
      entries = entries.filter(e => e.allowed === filter.allowed);
    }
    
    if (filter.since) {
      const since = new Date(filter.since);
      entries = entries.filter(e => new Date(e.metadata.timestamp) >= since);
    }
    
    return entries.slice(0, filter.limit || 1000);
  }

  /**
   * Shutdown access control manager
   */
  async shutdown() {
    try {
      this.logger.info('Shutting down access control manager...');
      
      // Clear cleanup interval
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
      }
      
      // Save audit trail
      if (this.config.enableAuditLog) {
        await this._saveAuditTrail();
      }
      
      // Clear caches
      this.accessCache.clear();
      this.permissions.clear();
      this.auditTrail.length = 0;
      
      this.logger.success('Access control manager shutdown completed');
      
    } catch (error) {
      this.logger.error('Error during access control manager shutdown:', error);
      throw error;
    }
  }

  // Private methods

  async _validateConfiguration() {
    // Validate allowed base paths
    for (const basePath of this.config.allowedBasePaths) {
      try {
        await fs.access(basePath);
      } catch {
        this.logger.warn(`Allowed base path does not exist: ${basePath}`);
      }
    }
    
    // Ensure audit log directory exists
    if (this.config.enableAuditLog) {
      const logDir = path.dirname(this.config.auditLogPath);
      await fs.mkdir(logDir, { recursive: true });
    }
  }

  async _loadPermissions() {
    // Load permissions from storage if available
    this.logger.info('Loading access control permissions...');
  }

  async _initializeAuditLog() {
    try {
      await fs.access(this.config.auditLogPath);
      this.logger.info(`Audit log initialized: ${this.config.auditLogPath}`);
    } catch {
      // Create new audit log
      await fs.writeFile(this.config.auditLogPath, '', { mode: 0o600 });
      this.logger.info(`Created new audit log: ${this.config.auditLogPath}`);
    }
  }

  _detectPathTraversal(filePath) {
    const result = {
      detected: false,
      violations: []
    };
    
    for (const pattern of this.securityPatterns.pathTraversal) {
      const matches = filePath.match(pattern);
      if (matches) {
        result.detected = true;
        result.violations.push({
          pattern: pattern.toString(),
          matches: matches.slice(0, 3)
        });
      }
    }
    
    return result;
  }

  _normalizePath(filePath) {
    return path.resolve(path.normalize(filePath));
  }

  _isPathBlocked(resolvedPath) {
    return this.config.blockedPaths.some(blockedPath => 
      resolvedPath.startsWith(path.resolve(blockedPath))
    );
  }

  _isPathAllowed(resolvedPath) {
    return this.config.allowedBasePaths.some(allowedPath => 
      resolvedPath.startsWith(path.resolve(allowedPath))
    );
  }

  _validateFileExtension(filePath, operation) {
    const ext = path.extname(filePath).toLowerCase();
    
    // Check blocked extensions
    if (this.config.blockedExtensions.includes(ext)) {
      return {
        allowed: false,
        reason: `File extension '${ext}' is blocked`
      };
    }
    
    // Check allowed extensions (if specified)
    if (this.config.allowedExtensions.length > 0) {
      if (!this.config.allowedExtensions.includes(ext)) {
        return {
          allowed: false,
          reason: `File extension '${ext}' is not in allowed list`
        };
      }
    }
    
    // Check for malicious filenames
    const filename = path.basename(filePath);
    for (const pattern of this.securityPatterns.maliciousFiles) {
      if (pattern.test(filename)) {
        return {
          allowed: false,
          reason: `Potentially malicious filename detected`
        };
      }
    }
    
    return { allowed: true };
  }

  async _checkFileSystemPermissions(filePath, operation, user) {
    try {
      // Check if file/directory exists
      const exists = await this._fileExists(filePath);
      
      if (operation !== 'write' && !exists) {
        return {
          allowed: false,
          reason: 'File or directory does not exist'
        };
      }
      
      // Check Node.js file system permissions
      const fsConstants = {
        read: fs.constants.R_OK,
        write: fs.constants.W_OK,
        execute: fs.constants.X_OK
      };
      
      if (exists) {
        try {
          await fs.access(filePath, fsConstants[operation] || fs.constants.R_OK);
        } catch {
          return {
            allowed: false,
            reason: `Insufficient file system permissions for ${operation}`
          };
        }
      }
      
      return { allowed: true };
      
    } catch (error) {
      return {
        allowed: false,
        reason: `Permission check failed: ${error.message}`
      };
    }
  }

  async _validateFileSize(filePath) {
    try {
      const exists = await this._fileExists(filePath);
      if (!exists) {
        return { valid: true }; // New files are valid
      }
      
      const stats = await fs.stat(filePath);
      
      if (stats.size > this.config.maxFileSize) {
        return {
          valid: false,
          reason: `File size ${stats.size} exceeds limit ${this.config.maxFileSize}`
        };
      }
      
      return { valid: true };
      
    } catch (error) {
      return {
        valid: false,
        reason: `Size validation failed: ${error.message}`
      };
    }
  }

  async _validateFileContent(filePath) {
    try {
      const exists = await this._fileExists(filePath);
      if (!exists) {
        return { safe: true }; // Non-existent files are safe
      }
      
      // Read a sample of the file for content analysis
      const sampleSize = Math.min(1024 * 1024, this.config.maxFileSize); // 1MB sample
      const fd = await fs.open(filePath, 'r');
      const buffer = Buffer.alloc(sampleSize);
      await fd.read(buffer, 0, sampleSize, 0);
      await fd.close();
      
      const content = buffer.toString('utf8');
      
      return this._validateContentSecurity(content);
      
    } catch (error) {
      return {
        safe: false,
        violations: [`Content validation failed: ${error.message}`]
      };
    }
  }

  _validateContentSecurity(content) {
    const result = {
      safe: true,
      violations: []
    };
    
    // Check for suspicious content patterns
    for (const pattern of this.securityPatterns.suspiciousContent) {
      const matches = content.match(pattern);
      if (matches) {
        result.safe = false;
        result.violations.push({
          type: 'suspicious-content',
          pattern: pattern.toString(),
          matches: matches.slice(0, 3).map(m => m.substring(0, 50))
        });
      }
    }
    
    return result;
  }

  _checkUserPermissions(filePath, operation, user) {
    // Admin override
    if (this.config.adminOverride && user.roles?.includes('admin')) {
      return { allowed: true, reason: 'Admin override' };
    }
    
    // Check specific user permissions
    const userId = user.id || 'anonymous';
    
    // Direct path permission
    const directKey = `${userId}:${filePath}`;
    const directPermission = this.permissions.get(directKey);
    if (directPermission && directPermission[operation]) {
      return { allowed: true, reason: 'Direct permission granted' };
    }
    
    // Pattern-based permissions
    for (const [key, permission] of this.permissions.entries()) {
      if (key.startsWith(`${userId}:`)) {
        const pattern = key.substring(userId.length + 1);
        if (this._matchesPathPattern(filePath, pattern) && permission[operation]) {
          return { allowed: true, reason: 'Pattern permission granted' };
        }
      }
    }
    
    // Default permissions
    const defaultPermissions = this.config.defaultPermissions;
    if (defaultPermissions[operation]) {
      return { allowed: true, reason: 'Default permission' };
    }
    
    return {
      allowed: false,
      reason: `No ${operation} permission for user ${userId}`
    };
  }

  _matchesPathPattern(filePath, pattern) {
    // Simple glob-like pattern matching
    const regex = pattern
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.')
      .replace(/\[\]/g, '[^/]*');
    
    return new RegExp(`^${regex}$`).test(filePath);
  }

  _updateOperationMetrics(operation) {
    switch (operation) {
      case 'read':
        this.metrics.readOperations++;
        break;
      case 'write':
        this.metrics.writeOperations++;
        break;
      case 'delete':
        this.metrics.deleteOperations++;
        break;
    }
  }

  _cacheAccessDecision(filePath, operation, user, result) {
    const cacheKey = `${user.id || 'anonymous'}:${operation}:${filePath}`;
    const cacheEntry = {
      result: { ...result },
      timestamp: this.getDeterministicTimestamp(),
      ttl: 5 * 60 * 1000 // 5 minutes
    };
    
    this.accessCache.set(cacheKey, cacheEntry);
  }

  _cleanupAccessCache() {
    const now = this.getDeterministicTimestamp();
    const expired = [];
    
    for (const [key, entry] of this.accessCache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        expired.push(key);
      }
    }
    
    expired.forEach(key => this.accessCache.delete(key));
    
    if (expired.length > 0) {
      this.logger.debug(`Cleaned up ${expired.length} expired cache entries`);
    }
  }

  async _logAccess(accessResult) {
    // Add to in-memory audit trail
    this.auditTrail.push({
      ...accessResult,
      loggedAt: this.getDeterministicDate()
    });
    
    // Keep audit trail size manageable
    if (this.auditTrail.length > 10000) {
      this.auditTrail.splice(0, 1000); // Remove oldest 1000 entries
    }
    
    // Log to file if enabled
    if (this.config.enableAuditLog && this.config.logAllOperations) {
      const logEntry = JSON.stringify(accessResult) + '\n';
      try {
        await fs.appendFile(this.config.auditLogPath, logEntry);
      } catch (error) {
        this.logger.error('Failed to write audit log:', error);
      }
    }
  }

  async _saveAuditTrail() {
    if (this.auditTrail.length > 0) {
      const auditData = JSON.stringify(this.auditTrail, null, 2);
      const backupPath = `${this.config.auditLogPath}.backup.${this.getDeterministicTimestamp()}`;
      await fs.writeFile(backupPath, auditData);
      this.logger.info(`Saved audit trail backup: ${backupPath}`);
    }
  }

  async _fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async _createBackup(filePath) {
    const backupPath = `${filePath}.backup.${this.getDeterministicTimestamp()}`;
    await fs.copyFile(filePath, backupPath);
    this.logger.info(`Created backup: ${backupPath}`);
    return backupPath;
  }
}

export default AccessControlManager;