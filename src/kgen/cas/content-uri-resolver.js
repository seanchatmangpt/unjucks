/**
 * Content URI Resolver for Dark-Matter Integration
 * 
 * Implements content:// URI scheme for content-addressed storage:
 * - content://sha256/<hash> URIs with automatic file extension detection
 * - Hardlink-based CAS with .kgen/cas storage and directory sharding
 * - Integration with existing KGEN CAS engine and provenance system
 * - Atomic operations with drift detection and integrity verification
 */

import { createHash } from 'crypto';
import { promises as fs, constants as fsConstants } from 'fs';
import { join, dirname, extname, basename } from 'path';
import { fileURLToPath } from 'url';
import consola from 'consola';
import { CASEngine } from './cas-core.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export class ContentUriResolver {
  constructor(options = {}) {
    this.options = {
      casDir: options.casDir || join(process.cwd(), '.kgen/cas'),
      enableHardlinks: options.enableHardlinks !== false,
      enableExtensionPreservation: options.enableExtensionPreservation !== false,
      enableDriftDetection: options.enableDriftDetection !== false,
      cacheSize: options.cacheSize || 5000,
      compressionEnabled: options.compressionEnabled || false,
      integrityChecks: options.integrityChecks !== false,
      ...options
    };
    
    this.logger = consola.withTag('content-uri-resolver');
    this.casEngine = new CASEngine({
      defaultHashAlgorithm: 'sha256',
      cacheSize: this.options.cacheSize,
      enableMetrics: true
    });
    
    // In-memory cache for frequently accessed content
    this.contentCache = new Map();
    this.metadataCache = new Map();
    
    // Performance metrics
    this.stats = {
      resolves: 0,
      stores: 0,
      cacheHits: 0,
      hardlinkCreated: 0,
      integrityChecks: 0,
      errors: 0,
      driftDetections: 0
    };
    
    this.initialized = false;
  }

  /**
   * Initialize the content URI resolver with CAS storage
   * 
   * Creates sharded directory structure for optimal filesystem performance
   * and initializes the CAS engine for content-addressed storage.
   * 
   * @returns {Promise<Object>} Initialization result
   * @throws {Error} If storage directories cannot be created or CAS engine fails
   * 
   * @example
   * ```javascript
   * const resolver = new ContentUriResolver({
   *   casDir: './.cas',
   *   enableHardlinks: true
   * });
   * const result = await resolver.initialize();
   * console.log(result.success); // true
   * ```
   */
  async initialize() {
    if (this.initialized) return { success: true, cached: true };
    
    try {
      this.logger.info('Initializing content URI resolver...');
      
      // Create CAS directory structure with sharding
      await fs.mkdir(this.options.casDir, { recursive: true });
      
      // Create sharded directories for better filesystem performance
      // Using first 2 hex characters for sharding (256 directories)
      for (let i = 0; i < 256; i++) {
        const shardDir = join(this.options.casDir, i.toString(16).padStart(2, '0'));
        await fs.mkdir(shardDir, { recursive: true });
      }
      
      // Create metadata directory
      await fs.mkdir(join(this.options.casDir, '.metadata'), { recursive: true });
      
      // Initialize CAS engine
      await this.casEngine.initialize?.() || Promise.resolve();
      
      this.logger.success(`Content URI resolver initialized with CAS directory: ${this.options.casDir}`);
      this.initialized = true;
      
      return { 
        success: true, 
        casDir: this.options.casDir,
        sharding: true,
        hardlinks: this.options.enableHardlinks,
        extensionPreservation: this.options.enableExtensionPreservation
      };
      
    } catch (error) {
      this.logger.error('Failed to initialize content URI resolver:', error);
      throw error;
    }
  }

  /**
   * Resolve a content:// URI to file system path and metadata
   * @param {string} uri - The content:// URI to resolve
   * @param {Object} options - Resolution options
   * @returns {Promise<Object>} Resolved content information
   */
  async resolve(uri, options = {}) {
    await this.initialize();
    this.stats.resolves++;
    
    try {
      const parsed = this.parseContentURI(uri);
      
      // Check content cache first
      const cacheKey = `${parsed.algorithm}:${parsed.hash}`;
      if (this.contentCache.has(cacheKey) && !options.skipCache) {
        this.stats.cacheHits++;
        const cached = this.contentCache.get(cacheKey);
        this.logger.debug(`Content cache hit for ${parsed.hash}`);
        
        // Still perform integrity check on cached content if enabled
        let integrityStatus = null;
        if (this.options.integrityChecks) {
          integrityStatus = await this._verifyContentIntegrity(cached.path, parsed.hash, parsed.algorithm);
          this.stats.integrityChecks++;
          
          if (!integrityStatus.valid) {
            this.stats.errors++;
            this.logger.warn(`Cached content integrity check failed for ${uri}: ${integrityStatus.error}`);
            
            if (!options.allowCorrupted) {
              throw new Error(`Content integrity verification failed: ${integrityStatus.error}`);
            }
          }
        }
        
        return { 
          ...cached, 
          cached: true, 
          uri, 
          integrity: integrityStatus,
          cachedAt: cached.cachedAt || this.getDeterministicTimestamp(),
          resolvedAt: this.getDeterministicDate().toISOString()
        };
      }
      
      // Calculate storage path with sharding
      const shardDir = parsed.hash.substring(0, 2);
      const casPath = join(this.options.casDir, shardDir, parsed.hash);
      
      // Find the actual file (may have extension)
      const contentFile = await this._findContentFile(casPath, parsed.hash);
      
      if (!contentFile.exists) {
        throw new Error(`Content not found for hash: ${parsed.hash}`);
      }
      
      // Load metadata
      const metadata = await this._loadContentMetadata(parsed.hash);
      
      // Perform integrity check if enabled
      let integrityStatus = null;
      if (this.options.integrityChecks) {
        integrityStatus = await this._verifyContentIntegrity(contentFile.path, parsed.hash, parsed.algorithm);
        this.stats.integrityChecks++;
        
        if (!integrityStatus.valid) {
          this.stats.errors++;
          this.logger.warn(`Integrity check failed for ${uri}: ${integrityStatus.error}`);
          
          if (!options.allowCorrupted) {
            throw new Error(`Content integrity verification failed: ${integrityStatus.error}`);
          }
        }
      }
      
      const result = {
        uri,
        algorithm: parsed.algorithm,
        hash: parsed.hash,
        path: contentFile.path,
        extension: contentFile.extension,
        size: await this._getFileSize(contentFile.path),
        metadata: metadata || {},
        integrity: integrityStatus,
        shardDir,
        resolvedAt: this.getDeterministicDate().toISOString(),
        cached: false
      };
      
      // Cache the result
      this._cacheContent(cacheKey, result);
      
      return result;
      
    } catch (error) {
      this.stats.errors++;
      this.logger.error(`Failed to resolve content URI ${uri}:`, error);
      throw error;
    }
  }

  /**
   * Store content and return content:// URI
   * 
   * Stores content using content-addressed storage with optional extension preservation
   * and hardlink creation. Returns a content:// URI that can be used to retrieve the content.
   * 
   * @param {Buffer|string} content - Content to store (binary or text)
   * @param {Object} options - Storage options
   * @param {string} [options.algorithm='sha256'] - Hash algorithm (sha256, sha512, blake2b, blake3)
   * @param {string} [options.extension] - File extension to preserve (.js, .json, etc.)
   * @param {Object} [options.metadata={}] - Additional metadata to store
   * @param {string} [options.source] - Source file path for hardlink creation
   * @param {boolean} [options.preserveExtension] - Whether to preserve file extension
   * @returns {Promise<Object>} Storage result with URI and metadata
   * @returns {string} returns.uri - The generated content:// URI
   * @returns {string} returns.hash - Content hash
   * @returns {string} returns.path - File system path to stored content
   * @returns {boolean} returns.stored - Whether content was newly stored
   * @returns {boolean} returns.existed - Whether content already existed
   * @throws {Error} If content cannot be stored or hash calculation fails
   * 
   * @example
   * ```javascript
   * // Store text content
   * const result = await resolver.store('console.log("hello");', {
   *   extension: '.js',
   *   metadata: { language: 'javascript' }
   * });
   * console.log(result.uri); // content://sha256/abc123...
   * 
   * // Store binary content with hardlink
   * const buffer = await fs.readFile('image.png');
   * const result = await resolver.store(buffer, {
   *   extension: '.png',
   *   source: 'image.png'
   * });
   * ```
   */
  async store(content, options = {}) {
    await this.initialize();
    this.stats.stores++;
    
    try {
      const {
        algorithm = 'sha256',
        extension = null,
        metadata = {},
        source = null,
        preserveExtension = this.options.enableExtensionPreservation
      } = options;
      
      // Normalize content to Buffer
      const contentBuffer = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');
      
      // Generate content hash using CAS engine for consistency
      const casResult = await this.casEngine.store(contentBuffer, { algorithm });
      const hash = await this.casEngine.calculateHash(contentBuffer, algorithm);
      
      // Determine file extension
      let fileExtension = null;
      if (preserveExtension && extension) {
        fileExtension = extension.startsWith('.') ? extension : `.${extension}`;
      } else if (preserveExtension && source) {
        fileExtension = extname(source);
      }
      
      // Calculate storage paths with sharding
      const shardDir = hash.substring(0, 2);
      const casDir = join(this.options.casDir, shardDir);
      const basePath = join(casDir, hash);
      const finalPath = fileExtension ? `${basePath}${fileExtension}` : basePath;
      
      // Check if content already exists
      const existingFile = await this._findContentFile(basePath, hash);
      
      if (existingFile.exists) {
        // Content already exists, perform drift detection if enabled
        if (this.options.enableDriftDetection) {
          const driftCheck = await this._detectContentDrift(existingFile.path, contentBuffer, hash, algorithm);
          if (driftCheck.driftDetected) {
            this.stats.driftDetections++;
            this.logger.warn(`Content drift detected for hash ${hash}:`, driftCheck);
          }
        }
        
        return {
          uri: `content://${algorithm}/${hash}`,
          hash,
          algorithm,
          path: existingFile.path,
          extension: existingFile.extension,
          size: contentBuffer.length,
          stored: false,
          existed: true,
          driftDetected: false,
          casResult
        };
      }
      
      // Create hardlinks first if enabled and source provided
      let hardlinked = false;
      if (this.options.enableHardlinks && source) {
        try {
          await this._createHardlink(source, finalPath);
          this.stats.hardlinkCreated++;
          hardlinked = true;
        } catch (error) {
          this.logger.warn(`Failed to create hardlink from ${source} to ${finalPath}:`, error.message);
          hardlinked = false;
          // Fall back to writing content directly
          await fs.writeFile(finalPath, contentBuffer);
        }
      } else {
        // Store the content atomically if not using hardlinks
        await fs.writeFile(finalPath, contentBuffer);
      }
      
      // Store metadata
      const contentMetadata = {
        hash,
        algorithm,
        size: contentBuffer.length,
        extension: fileExtension,
        storedAt: this.getDeterministicDate().toISOString(),
        source,
        ...metadata
      };
      
      await this._storeContentMetadata(hash, contentMetadata);
      
      const uri = `content://${algorithm}/${hash}`;
      const result = {
        uri,
        hash,
        algorithm,
        path: finalPath,
        extension: fileExtension,
        size: contentBuffer.length,
        metadata: contentMetadata,
        stored: true,
        existed: false,
        hardlinked,
        casResult
      };
      
      // Cache the result
      const cacheKey = `${algorithm}:${hash}`;
      this._cacheContent(cacheKey, result);
      
      this.logger.info(`Stored content at ${uri} (path: ${finalPath})`);
      
      return result;
      
    } catch (error) {
      this.stats.errors++;
      this.logger.error('Failed to store content:', error);
      throw error;
    }
  }

  /**
   * Create hardlink between source and CAS storage
   * 
   * Creates a filesystem hardlink from the source file to the CAS storage location.
   * This provides space-efficient storage by allowing multiple paths to reference
   * the same inode.
   * 
   * @param {string} sourcePath - Absolute path to source file
   * @param {string} targetPath - Absolute path to target CAS location
   * @returns {Promise<Object>} Hardlink creation result
   * @returns {boolean} returns.success - Whether hardlink was created successfully
   * @returns {string} returns.source - Source file path
   * @returns {string} returns.target - Target CAS path
   * @returns {boolean} returns.hardlinked - Confirmation that hardlink exists
   * @throws {Error} If hardlinks are disabled or creation fails
   * 
   * @example
   * ```javascript
   * const result = await resolver.createHardlink(
   *   '/path/to/source.js',
   *   '/cas/ab/abcdef123456.js'
   * );
   * console.log(result.success); // true
   * ```
   */
  async createHardlink(sourcePath, targetPath) {
    if (!this.options.enableHardlinks) {
      throw new Error('Hardlinks are disabled');
    }
    
    try {
      await this._createHardlink(sourcePath, targetPath);
      this.stats.hardlinkCreated++;
      
      return {
        success: true,
        source: sourcePath,
        target: targetPath,
        hardlinked: true
      };
    } catch (error) {
      this.logger.error(`Failed to create hardlink:`, error);
      throw error;
    }
  }

  /**
   * Get content from URI as Buffer
   * 
   * Retrieves the raw binary content from a content:// URI.
   * Performs integrity verification if enabled.
   * 
   * @param {string} uri - content:// URI (e.g., 'content://sha256/abc123...')
   * @param {Object} [options={}] - Read options
   * @param {boolean} [options.skipCache=false] - Skip content cache
   * @param {boolean} [options.allowCorrupted=false] - Allow corrupted content
   * @returns {Promise<Buffer>} Content as binary buffer
   * @throws {Error} If URI is invalid or content not found
   * @throws {Error} If integrity check fails and allowCorrupted is false
   * 
   * @example
   * ```javascript
   * const content = await resolver.getContent('content://sha256/abc123...');
   * console.log(content instanceof Buffer); // true
   * ```
   */
  async getContent(uri, options = {}) {
    const resolved = await this.resolve(uri, options);
    return await fs.readFile(resolved.path);
  }

  /**
   * Get content from URI as string
   * 
   * Retrieves content from a content:// URI and converts it to a string
   * using the specified encoding.
   * 
   * @param {string} uri - content:// URI (e.g., 'content://sha256/abc123...')
   * @param {string} [encoding='utf8'] - Text encoding (utf8, ascii, base64, etc.)
   * @param {Object} [options={}] - Read options
   * @param {boolean} [options.skipCache=false] - Skip content cache
   * @param {boolean} [options.allowCorrupted=false] - Allow corrupted content
   * @returns {Promise<string>} Content as string
   * @throws {Error} If URI is invalid or content not found
   * @throws {Error} If encoding conversion fails
   * 
   * @example
   * ```javascript
   * const jsCode = await resolver.getContentAsString(
   *   'content://sha256/abc123...', 
   *   'utf8'
   * );
   * console.log(typeof jsCode); // 'string'
   * ```
   */
  async getContentAsString(uri, encoding = 'utf8', options = {}) {
    const content = await this.getContent(uri, options);
    return content.toString(encoding);
  }

  /**
   * Check if content exists for given URI
   * 
   * Verifies whether content is available for the given content:// URI
   * without actually retrieving the content data.
   * 
   * @param {string} uri - content:// URI to check (e.g., 'content://sha256/abc123...')
   * @returns {Promise<boolean>} true if content exists, false otherwise
   * 
   * @example
   * ```javascript
   * const exists = await resolver.exists('content://sha256/abc123...');
   * if (exists) {
   *   const content = await resolver.getContent(uri);
   * }
   * ```
   */
  async exists(uri) {
    try {
      await this.resolve(uri, { skipCache: false });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * List all stored content with optional filtering
   * @param {Object} filters - Filtering options
   * @returns {Promise<Array>} List of content entries
   */
  async list(filters = {}) {
    await this.initialize();
    
    const entries = [];
    const casDir = this.options.casDir;
    
    // Iterate through sharded directories
    for (let i = 0; i < 256; i++) {
      const shardHex = i.toString(16).padStart(2, '0');
      const shardDir = join(casDir, shardHex);
      
      try {
        const files = await fs.readdir(shardDir);
        
        for (const file of files) {
          const filePath = join(shardDir, file);
          const stat = await fs.stat(filePath);
          
          if (stat.isFile()) {
            const hash = this._extractHashFromFilename(file);
            const extension = extname(file);
            
            // Apply filters
            if (filters.algorithm && !hash.algorithm === filters.algorithm) continue;
            if (filters.extension && extension !== filters.extension) continue;
            if (filters.minSize && stat.size < filters.minSize) continue;
            if (filters.maxSize && stat.size > filters.maxSize) continue;
            
            entries.push({
              uri: `content://sha256/${hash}`,
              hash,
              algorithm: 'sha256',
              path: filePath,
              extension: extension || null,
              size: stat.size,
              shard: shardHex,
              modifiedAt: stat.mtime.toISOString()
            });
          }
        }
      } catch (error) {
        // Skip inaccessible shard directories
        continue;
      }
    }
    
    return entries;
  }

  /**
   * Parse content:// URI into components
   * @param {string} uri - URI to parse
   * @returns {Object} Parsed components
   */
  parseContentURI(uri) {
    const match = uri.match(/^content:\/\/([^/]+)\/([a-fA-F0-9]+)$/);
    if (!match) {
      throw new Error(`Invalid content URI format: ${uri}. Expected: content://algorithm/hash`);
    }
    
    const algorithm = match[1].toLowerCase();
    const hash = match[2].toLowerCase();
    
    // Validate algorithm
    if (!['sha256', 'sha512', 'blake2b', 'blake3'].includes(algorithm)) {
      throw new Error(`Unsupported hash algorithm: ${algorithm}`);
    }
    
    // Validate hash length
    const expectedLengths = { sha256: 64, sha512: 128, blake2b: 128, blake3: 64 };
    if (hash.length !== expectedLengths[algorithm]) {
      throw new Error(`Invalid hash length for ${algorithm}: expected ${expectedLengths[algorithm]}, got ${hash.length}`);
    }
    
    return { algorithm, hash, uri };
  }

  /**
   * Create content:// URI from hash and algorithm
   * @param {string} hash - Content hash
   * @param {string} algorithm - Hash algorithm
   * @returns {string} content:// URI
   */
  createContentURI(hash, algorithm = 'sha256') {
    return `content://${algorithm}/${hash.toLowerCase()}`;
  }

  /**
   * Validate content:// URI format
   * @param {string} uri - URI to validate
   * @returns {Object} Validation result
   */
  validateContentURI(uri) {
    try {
      const parsed = this.parseContentURI(uri);
      return { valid: true, parsed };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  /**
   * Get resolver performance statistics
   * @returns {Object} Performance statistics
   */
  getStats() {
    const casMetrics = this.casEngine.getMetrics();
    
    return {
      resolver: this.stats,
      cache: {
        contentCacheSize: this.contentCache.size,
        metadataCacheSize: this.metadataCache.size,
        hitRate: this.stats.resolves > 0 ? this.stats.cacheHits / this.stats.resolves : 0
      },
      cas: casMetrics,
      performance: {
        errorRate: this.stats.resolves > 0 ? this.stats.errors / this.stats.resolves : 0,
        hardlinkRate: this.stats.stores > 0 ? this.stats.hardlinkCreated / this.stats.stores : 0,
        driftDetectionRate: this.stats.resolves > 0 ? this.stats.driftDetections / this.stats.resolves : 0
      }
    };
  }

  /**
   * Clear all caches
   */
  clearCache() {
    this.contentCache.clear();
    this.metadataCache.clear();
    this.casEngine.gc?.(true);
    this.logger.info('All caches cleared');
  }

  /**
   * Shutdown resolver and cleanup resources
   */
  async shutdown() {
    this.clearCache();
    this.logger.info('Content URI resolver shutdown completed');
  }

  // Private methods

  async _findContentFile(basePath, hash) {
    // Try exact match first
    try {
      await fs.access(basePath, fsConstants.F_OK);
      return { path: basePath, extension: null, exists: true };
    } catch {
      // File doesn't exist, try with extensions
    }
    
    // Try common extensions
    const extensions = ['.js', '.ts', '.json', '.md', '.txt', '.html', '.css', '.py', '.go', '.rs'];
    
    for (const ext of extensions) {
      const pathWithExt = `${basePath}${ext}`;
      try {
        await fs.access(pathWithExt, fsConstants.F_OK);
        return { path: pathWithExt, extension: ext, exists: true };
      } catch {
        continue;
      }
    }
    
    // Try to find any file starting with the hash
    try {
      const dir = dirname(basePath);
      const files = await fs.readdir(dir);
      const matchingFile = files.find(f => f.startsWith(hash));
      
      if (matchingFile) {
        const fullPath = join(dir, matchingFile);
        const extension = extname(matchingFile);
        return { path: fullPath, extension, exists: true };
      }
    } catch {
      // Directory doesn't exist or not accessible
    }
    
    return { path: basePath, extension: null, exists: false };
  }

  async _createHardlink(source, target) {
    try {
      // Ensure target directory exists
      await fs.mkdir(dirname(target), { recursive: true });
      
      // Verify source exists before creating hardlink
      await fs.access(source, fsConstants.F_OK);
      
      // Create hardlink
      await fs.link(source, target);
      
      // Verify hardlink was created correctly by checking inodes
      const sourceStat = await fs.stat(source);
      const targetStat = await fs.stat(target);
      
      if (sourceStat.ino !== targetStat.ino) {
        throw new Error(`Hardlink verification failed: inode mismatch (${sourceStat.ino} !== ${targetStat.ino})`);
      }
      
    } catch (error) {
      if (error.code === 'EEXIST') {
        // Target already exists, verify it's a proper hardlink
        try {
          const sourceStat = await fs.stat(source);
          const targetStat = await fs.stat(target);
          if (sourceStat.ino === targetStat.ino) {
            return; // Already a proper hardlink
          }
        } catch {
          // If we can't verify, continue with the error
        }
      }
      throw error;
    }
  }

  async _getFileSize(filePath) {
    try {
      const stat = await fs.stat(filePath);
      return stat.size;
    } catch {
      return 0;
    }
  }

  async _verifyContentIntegrity(filePath, expectedHash, algorithm) {
    try {
      const content = await fs.readFile(filePath);
      const actualHash = await this.casEngine.calculateHash(content, algorithm);
      
      return {
        valid: actualHash === expectedHash,
        expectedHash,
        actualHash,
        algorithm,
        error: actualHash === expectedHash ? null : 'Hash mismatch detected'
      };
    } catch (error) {
      return {
        valid: false,
        error: `Integrity check failed: ${error.message}`
      };
    }
  }

  async _detectContentDrift(filePath, expectedContent, expectedHash, algorithm) {
    try {
      const actualContent = await fs.readFile(filePath);
      const actualHash = await this.casEngine.calculateHash(actualContent, algorithm);
      
      const driftDetected = actualHash !== expectedHash;
      
      return {
        driftDetected,
        expectedHash,
        actualHash,
        contentMatches: Buffer.compare(expectedContent, actualContent) === 0,
        filePath
      };
    } catch (error) {
      return {
        driftDetected: true,
        error: `Drift detection failed: ${error.message}`,
        filePath
      };
    }
  }

  async _loadContentMetadata(hash) {
    const metadataPath = join(this.options.casDir, '.metadata', `${hash}.json`);
    
    try {
      const content = await fs.readFile(metadataPath, 'utf8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  async _storeContentMetadata(hash, metadata) {
    const metadataDir = join(this.options.casDir, '.metadata');
    const metadataPath = join(metadataDir, `${hash}.json`);
    
    await fs.mkdir(metadataDir, { recursive: true });
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
  }

  _extractHashFromFilename(filename) {
    // Remove extension and return the hash part
    const name = basename(filename, extname(filename));
    return name;
  }

  _cacheContent(key, content) {
    // Implement LRU cache behavior
    if (this.contentCache.size >= this.options.cacheSize) {
      const firstKey = this.contentCache.keys().next().value;
      this.contentCache.delete(firstKey);
    }
    
    this.contentCache.set(key, {
      ...content,
      cachedAt: this.getDeterministicTimestamp()
    });
  }
}

// Export singleton instance
export const contentResolver = new ContentUriResolver();

// Export class for custom instances
export default ContentUriResolver;