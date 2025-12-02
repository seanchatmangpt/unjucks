/**
 * Abstract registry interface for kgen marketplace
 * Provides consistent API across different registry backends
 */

import { EventEmitter } from 'events';
import { createHash } from 'crypto';

export class RegistryError extends Error {
  constructor(message, code, cause) {
    super(message);
    this.name = 'RegistryError';
    this.code = code;
    this.cause = cause;
  }
}

export class RegistryNotFoundError extends RegistryError {
  constructor(resource, registryType) {
    super(`Resource '${resource}' not found in ${registryType} registry`, 'NOT_FOUND');
  }
}

export class RegistryAuthError extends RegistryError {
  constructor(registryType, action) {
    super(`Authentication failed for ${registryType} registry during ${action}`, 'AUTH_FAILED');
  }
}

export class RegistryNetworkError extends RegistryError {
  constructor(registryType, operation, cause) {
    super(`Network error in ${registryType} registry during ${operation}`, 'NETWORK_ERROR', cause);
  }
}

/**
 * Abstract base class for all registry implementations
 * Defines the contract that all registry backends must implement
 */
export class RegistryInterface extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = config;
    this.name = config.name || 'unknown';
    this.type = config.type || 'generic';
    this.baseUrl = config.baseUrl || null;
    this.timeout = config.timeout || 30000;
    this.retryAttempts = config.retryAttempts || 3;
    this.retryDelay = config.retryDelay || 1000;
  }

  /**
   * Initialize the registry connection
   * @returns {Promise<void>}
   */
  async initialize() {
    throw new Error('initialize() method must be implemented by registry backend');
  }

  /**
   * Check if the registry is available and responding
   * @returns {Promise<boolean>}
   */
  async isHealthy() {
    throw new Error('isHealthy() method must be implemented by registry backend');
  }

  /**
   * Publish a package to the registry
   * @param {Object} packageInfo - Package metadata and content
   * @param {string} packageInfo.name - Package name
   * @param {string} packageInfo.version - Package version
   * @param {string} packageInfo.description - Package description
   * @param {Object} packageInfo.metadata - Additional metadata
   * @param {Buffer|string} packageInfo.content - Package content
   * @param {Object} options - Publishing options
   * @returns {Promise<Object>} Publishing result
   */
  async publish(packageInfo, options = {}) {
    throw new Error('publish() method must be implemented by registry backend');
  }

  /**
   * Search for packages in the registry
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @param {number} options.limit - Maximum number of results
   * @param {number} options.offset - Results offset
   * @param {Array<string>} options.tags - Filter by tags
   * @param {string} options.author - Filter by author
   * @returns {Promise<Array<Object>>} Search results
   */
  async search(query, options = {}) {
    throw new Error('search() method must be implemented by registry backend');
  }

  /**
   * Fetch package information without downloading content
   * @param {string} name - Package name
   * @param {string} version - Package version (optional, defaults to latest)
   * @returns {Promise<Object>} Package metadata
   */
  async getPackageInfo(name, version = 'latest') {
    throw new Error('getPackageInfo() method must be implemented by registry backend');
  }

  /**
   * Download package content
   * @param {string} name - Package name
   * @param {string} version - Package version (optional, defaults to latest)
   * @param {Object} options - Download options
   * @returns {Promise<Buffer>} Package content
   */
  async downloadPackage(name, version = 'latest', options = {}) {
    throw new Error('downloadPackage() method must be implemented by registry backend');
  }

  /**
   * List all versions of a package
   * @param {string} name - Package name
   * @returns {Promise<Array<string>>} List of versions
   */
  async listVersions(name) {
    throw new Error('listVersions() method must be implemented by registry backend');
  }

  /**
   * Check if a package exists in the registry
   * @param {string} name - Package name
   * @param {string} version - Package version (optional)
   * @returns {Promise<boolean>} True if package exists
   */
  async exists(name, version = null) {
    try {
      const info = await this.getPackageInfo(name, version || 'latest');
      return !!info;
    } catch (error) {
      if (error instanceof RegistryNotFoundError) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Authenticate with the registry
   * @param {Object} credentials - Authentication credentials
   * @returns {Promise<Object>} Authentication result
   */
  async authenticate(credentials) {
    throw new Error('authenticate() method must be implemented by registry backend');
  }

  /**
   * Get registry capabilities and supported features
   * @returns {Promise<Object>} Registry capabilities
   */
  async getCapabilities() {
    return {
      name: this.name,
      type: this.type,
      supports: {
        publish: true,
        search: true,
        download: true,
        versioning: true,
        authentication: false,
        tags: false,
        metadata: true
      },
      endpoints: {
        base: this.baseUrl,
        health: null,
        search: null,
        package: null
      }
    };
  }

  /**
   * Generate a unique identifier for a package
   * @param {string} name - Package name
   * @param {string} version - Package version
   * @returns {string} Package identifier
   */
  generatePackageId(name, version) {
    return `${name}@${version}`;
  }

  /**
   * Generate a content hash for integrity verification
   * @param {Buffer|string} content - Content to hash
   * @param {string} algorithm - Hash algorithm (default: sha256)
   * @returns {string} Content hash
   */
  generateContentHash(content, algorithm = 'sha256') {
    return createHash(algorithm).update(content).digest('hex');
  }

  /**
   * Retry a registry operation with exponential backoff
   * @param {Function} operation - Operation to retry
   * @param {Object} options - Retry options
   * @returns {Promise<any>} Operation result
   */
  async retryOperation(operation, options = {}) {
    const attempts = options.attempts || this.retryAttempts;
    const delay = options.delay || this.retryDelay;
    const backoff = options.backoff || 2;

    let lastError;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        // Don't retry authentication or not found errors
        if (error instanceof RegistryAuthError || error instanceof RegistryNotFoundError) {
          throw error;
        }

        if (attempt < attempts) {
          const waitTime = delay * Math.pow(backoff, attempt - 1);
          this.emit('retry', { attempt, error, waitTime });
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }

    throw lastError;
  }

  /**
   * Validate package metadata
   * @param {Object} packageInfo - Package information to validate
   * @throws {RegistryError} If validation fails
   */
  validatePackageInfo(packageInfo) {
    const required = ['name', 'version'];
    const missing = required.filter(field => !packageInfo[field]);
    
    if (missing.length > 0) {
      throw new RegistryError(
        `Missing required package fields: ${missing.join(', ')}`,
        'VALIDATION_ERROR'
      );
    }

    // Validate version format (semver)
    const versionRegex = /^\d+\.\d+\.\d+(?:-[a-zA-Z0-9-]+)?(?:\+[a-zA-Z0-9-]+)?$/;
    if (!versionRegex.test(packageInfo.version)) {
      throw new RegistryError(
        `Invalid version format: ${packageInfo.version}`,
        'VALIDATION_ERROR'
      );
    }

    // Validate package name
    const nameRegex = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\/[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*$/;
    if (!nameRegex.test(packageInfo.name)) {
      throw new RegistryError(
        `Invalid package name format: ${packageInfo.name}`,
        'VALIDATION_ERROR'
      );
    }
  }

  /**
   * Clean up registry resources
   * @returns {Promise<void>}
   */
  async cleanup() {
    this.removeAllListeners();
  }

  /**
   * Get registry statistics
   * @returns {Promise<Object>} Registry statistics
   */
  async getStats() {
    return {
      name: this.name,
      type: this.type,
      healthy: await this.isHealthy(),
      lastCheck: new Date().toISOString()
    };
  }
}

export default RegistryInterface;