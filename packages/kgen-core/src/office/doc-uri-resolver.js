/**
 * doc:// URI Resolver for Content-Addressed Office Documents
 * 
 * Implements the doc://sha256/<hash> scheme for canonical document storage
 * and retrieval with OPC (Open Packaging Convention) normalization.
 * 
 * @module doc-uri-resolver
 * @version 1.0.0
 */

import crypto from 'crypto';
import { URL } from 'url';
import { OPCNormalizer } from './normalization/opc-normalizer.js';
import { CASIntegration } from './integration/cas-integration.js';

/**
 * URI schemes supported by the resolver
 */
export const SUPPORTED_SCHEMES = {
  DOC: 'doc',
  FILE: 'file',
  HTTP: 'http',
  HTTPS: 'https'
};

/**
 * Content address types for doc:// URIs
 */
export const CONTENT_ADDRESS_TYPES = {
  SHA256: 'sha256',
  SHA512: 'sha512',
  BLAKE3: 'blake3'
};

/**
 * Document URI Resolver with content-addressable storage
 */
export class DocURIResolver {
  constructor(options = {}) {
    this.options = {
      casDirectory: options.casDirectory || '.kgen/cas',
      enableCache: true,
      enableNormalization: true,
      defaultHashAlgorithm: 'sha256',
      strictMode: true,
      ...options
    };

    // Initialize components
    this.opcNormalizer = new OPCNormalizer(options.opc);
    this.casIntegration = new CASIntegration({
      casDirectory: this.options.casDirectory,
      hashAlgorithm: this.options.defaultHashAlgorithm,
      enableDeduplication: true,
      trackProvenance: true,
      ...options.cas
    });

    // URI cache for performance
    this.uriCache = new Map();
  }

  /**
   * Resolve document URI to content
   * 
   * @param {string} uri - URI to resolve (doc://sha256/<hash> or file:// etc.)
   * @param {Object} options - Resolution options
   * @returns {Promise<Object>} Document resolution result
   */
  async resolveURI(uri, options = {}) {
    try {
      const parsedUri = this.parseURI(uri);
      
      switch (parsedUri.scheme) {
        case SUPPORTED_SCHEMES.DOC:
          return this.resolveDocURI(parsedUri, options);
        
        case SUPPORTED_SCHEMES.FILE:
          return this.resolveFileURI(parsedUri, options);
        
        case SUPPORTED_SCHEMES.HTTP:
        case SUPPORTED_SCHEMES.HTTPS:
          return this.resolveHttpURI(parsedUri, options);
        
        default:
          throw new Error(`Unsupported URI scheme: ${parsedUri.scheme}`);
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
        uri,
        resolved: false
      };
    }
  }

  /**
   * Parse URI into components
   * 
   * @param {string} uri - URI to parse
   * @returns {Object} Parsed URI components
   */
  parseURI(uri) {
    if (!uri || typeof uri !== 'string') {
      throw new Error('Invalid URI: must be a non-empty string');
    }

    try {
      const url = new URL(uri);
      
      const parsed = {
        original: uri,
        scheme: url.protocol.replace(':', ''),
        host: url.host,
        pathname: url.pathname,
        searchParams: url.searchParams,
        hash: url.hash
      };

      // Special handling for doc:// URIs
      if (parsed.scheme === SUPPORTED_SCHEMES.DOC) {
        return this.parseDocURI(parsed);
      }

      return parsed;
    } catch (error) {
      throw new Error(`Invalid URI format: ${uri} - ${error.message}`);
    }
  }

  /**
   * Parse doc:// URI specifically
   * 
   * @param {Object} parsedUrl - Pre-parsed URL components
   * @returns {Object} Enhanced doc URI components
   */
  parseDocURI(parsedUrl) {
    // Expected format: doc://sha256/<hash>
    const pathParts = parsedUrl.pathname.split('/').filter(part => part);
    
    if (pathParts.length < 2) {
      throw new Error(`Invalid doc:// URI format. Expected: doc://<algorithm>/<hash>`);
    }

    const [algorithm, hash, ...segments] = pathParts;
    
    if (!Object.values(CONTENT_ADDRESS_TYPES).includes(algorithm)) {
      throw new Error(`Unsupported hash algorithm: ${algorithm}`);
    }

    if (!this.isValidHash(hash, algorithm)) {
      throw new Error(`Invalid ${algorithm} hash format: ${hash}`);
    }

    return {
      ...parsedUrl,
      algorithm,
      hash,
      segments: segments.length > 0 ? segments : null,
      isCanonical: true
    };
  }

  /**
   * Validate hash format for given algorithm
   * 
   * @param {string} hash - Hash string to validate
   * @param {string} algorithm - Hash algorithm
   * @returns {boolean} True if valid
   */
  isValidHash(hash, algorithm) {
    const patterns = {
      [CONTENT_ADDRESS_TYPES.SHA256]: /^[a-fA-F0-9]{64}$/,
      [CONTENT_ADDRESS_TYPES.SHA512]: /^[a-fA-F0-9]{128}$/,
      [CONTENT_ADDRESS_TYPES.BLAKE3]: /^[a-fA-F0-9]{64}$/
    };

    return patterns[algorithm]?.test(hash) || false;
  }

  /**
   * Resolve doc:// URI from content-addressed storage
   * 
   * @param {Object} parsedUri - Parsed doc URI
   * @param {Object} options - Resolution options
   * @returns {Promise<Object>} Resolution result
   */
  async resolveDocURI(parsedUri, options = {}) {
    const { hash, algorithm, segments } = parsedUri;
    const cacheKey = `doc://${algorithm}/${hash}`;

    // Check URI cache first
    if (this.options.enableCache && this.uriCache.has(cacheKey)) {
      return {
        ...this.uriCache.get(cacheKey),
        fromCache: true
      };
    }

    try {
      // Retrieve from CAS
      const casResult = await this.casIntegration.retrieveDocument(hash);
      
      let content = casResult.content;
      let metadata = casResult.metadata;

      // If segments specified, extract sub-content
      if (segments && segments.length > 0) {
        const subContent = await this.extractSubContent(content, segments, metadata);
        content = subContent.content;
        metadata = { ...metadata, ...subContent.metadata };
      }

      // Verify content hash matches URI
      const computedHash = this.computeContentHash(content, algorithm);
      if (computedHash !== hash) {
        throw new Error(
          `Content hash mismatch: expected ${hash}, got ${computedHash}`
        );
      }

      const result = {
        success: true,
        uri: parsedUri.original,
        resolved: true,
        content,
        metadata,
        contentHash: hash,
        algorithm,
        size: content.length,
        fromCache: false,
        canonical: true
      };

      // Cache successful resolution
      if (this.options.enableCache) {
        this.uriCache.set(cacheKey, { ...result, fromCache: false });
      }

      return result;

    } catch (error) {
      throw new Error(`Failed to resolve doc:// URI ${parsedUri.original}: ${error.message}`);
    }
  }

  /**
   * Store document and return doc:// URI
   * 
   * @param {Buffer} documentBuffer - Document content
   * @param {Object} metadata - Document metadata
   * @param {Object} options - Storage options
   * @returns {Promise<Object>} Storage result with doc:// URI
   */
  async storeDocument(documentBuffer, metadata = {}, options = {}) {
    const {
      algorithm = this.options.defaultHashAlgorithm,
      normalize = this.options.enableNormalization
    } = options;

    let contentToStore = documentBuffer;

    // Normalize document for deterministic storage
    if (normalize && this.isOfficeDocument(documentBuffer)) {
      contentToStore = await this.opcNormalizer.normalizeOfficeDocument(documentBuffer);
    }

    // Store in CAS
    const casResult = await this.casIntegration.storeDocument(contentToStore, {
      ...metadata,
      algorithm,
      normalized: normalize,
      originalSize: documentBuffer.length
    });

    // Generate doc:// URI
    const docURI = this.generateDocURI(casResult.hash, algorithm);

    return {
      success: true,
      docURI,
      contentHash: casResult.hash,
      algorithm,
      size: contentToStore.length,
      originalSize: documentBuffer.length,
      existed: casResult.existed,
      normalized: normalize,
      casResult
    };
  }

  /**
   * Generate doc:// URI for content hash
   * 
   * @param {string} hash - Content hash
   * @param {string} algorithm - Hash algorithm
   * @returns {string} doc:// URI
   */
  generateDocURI(hash, algorithm = this.options.defaultHashAlgorithm) {
    return `doc://${algorithm}/${hash}`;
  }

  /**
   * Compute content hash using specified algorithm
   * 
   * @param {Buffer} content - Content to hash
   * @param {string} algorithm - Hash algorithm
   * @returns {string} Content hash
   */
  computeContentHash(content, algorithm = this.options.defaultHashAlgorithm) {
    const normalizedAlgorithm = algorithm === 'sha256' ? 'sha256' : algorithm;
    return crypto.createHash(normalizedAlgorithm).update(content).digest('hex');
  }

  /**
   * Check if buffer contains Office document
   * 
   * @param {Buffer} buffer - Buffer to check
   * @returns {boolean} True if Office document
   */
  isOfficeDocument(buffer) {
    // Check for ZIP signature (Office documents are ZIP files)
    const zipSignature = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
    return buffer.length >= 4 && buffer.subarray(0, 4).equals(zipSignature);
  }

  /**
   * Extract sub-content from document using segments
   * 
   * @param {Buffer} content - Full document content
   * @param {Array<string>} segments - Path segments
   * @param {Object} metadata - Document metadata
   * @returns {Promise<Object>} Extracted content and metadata
   */
  async extractSubContent(content, segments, metadata) {
    if (!this.isOfficeDocument(content)) {
      throw new Error('Sub-content extraction only supported for Office documents');
    }

    try {
      const fflate = await import('fflate');
      const files = fflate.unzipSync(content);
      
      // Build path from segments
      const targetPath = segments.join('/');
      
      // Find matching file
      const matchingFile = Object.keys(files).find(path => 
        path.toLowerCase() === targetPath.toLowerCase() ||
        path.endsWith('/' + targetPath) ||
        path.includes(targetPath)
      );

      if (!matchingFile) {
        throw new Error(`Path not found in document: ${targetPath}`);
      }

      return {
        content: Buffer.from(files[matchingFile]),
        metadata: {
          extractedPath: matchingFile,
          originalPath: targetPath,
          extractedFrom: metadata.contentHash || 'unknown'
        }
      };

    } catch (error) {
      throw new Error(`Failed to extract sub-content: ${error.message}`);
    }
  }

  /**
   * Resolve file:// URI
   * 
   * @param {Object} parsedUri - Parsed file URI
   * @param {Object} options - Resolution options
   * @returns {Promise<Object>} Resolution result
   */
  async resolveFileURI(parsedUri, options = {}) {
    const { readFile } = await import('fs/promises');
    const filePath = parsedUri.pathname;

    try {
      const content = await readFile(filePath);
      const stats = await import('fs/promises').then(fs => fs.stat(filePath));

      return {
        success: true,
        uri: parsedUri.original,
        resolved: true,
        content,
        metadata: {
          path: filePath,
          size: stats.size,
          mtime: stats.mtime.toISOString(),
          type: 'file'
        },
        size: content.length,
        canonical: false
      };

    } catch (error) {
      throw new Error(`Failed to resolve file:// URI: ${error.message}`);
    }
  }

  /**
   * Resolve HTTP/HTTPS URI
   * 
   * @param {Object} parsedUri - Parsed HTTP URI
   * @param {Object} options - Resolution options
   * @returns {Promise<Object>} Resolution result
   */
  async resolveHttpURI(parsedUri, options = {}) {
    const https = parsedUri.scheme === 'https' ? 
      await import('https') : await import('http');

    return new Promise((resolve, reject) => {
      const request = https.get(parsedUri.original, (response) => {
        const chunks = [];
        
        response.on('data', (chunk) => {
          chunks.push(chunk);
        });

        response.on('end', () => {
          const content = Buffer.concat(chunks);
          
          resolve({
            success: true,
            uri: parsedUri.original,
            resolved: true,
            content,
            metadata: {
              statusCode: response.statusCode,
              headers: response.headers,
              contentType: response.headers['content-type'],
              type: 'http'
            },
            size: content.length,
            canonical: false
          });
        });
      });

      request.on('error', (error) => {
        reject(new Error(`Failed to resolve HTTP URI: ${error.message}`));
      });

      request.setTimeout(options.timeout || 30000, () => {
        request.destroy();
        reject(new Error('HTTP request timeout'));
      });
    });
  }

  /**
   * Create canonical doc:// URI from any source URI
   * 
   * @param {string} sourceUri - Source URI to canonicalize
   * @param {Object} options - Canonicalization options
   * @returns {Promise<Object>} Canonicalization result
   */
  async canonicalizeURI(sourceUri, options = {}) {
    try {
      // First resolve the source URI
      const resolveResult = await this.resolveURI(sourceUri, options);
      
      if (!resolveResult.success) {
        throw new Error(`Failed to resolve source URI: ${resolveResult.error}`);
      }

      // If already canonical, return as-is
      if (resolveResult.canonical) {
        return {
          success: true,
          canonical: true,
          sourceUri,
          docURI: sourceUri,
          contentHash: resolveResult.contentHash,
          alreadyCanonical: true
        };
      }

      // Store content and get doc:// URI
      const storeResult = await this.storeDocument(
        resolveResult.content,
        { ...resolveResult.metadata, canonicalizedFrom: sourceUri },
        options
      );

      return {
        success: true,
        canonical: true,
        sourceUri,
        docURI: storeResult.docURI,
        contentHash: storeResult.contentHash,
        algorithm: storeResult.algorithm,
        alreadyCanonical: false,
        storeResult
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        sourceUri,
        canonical: false
      };
    }
  }

  /**
   * Batch resolve multiple URIs
   * 
   * @param {Array<string>} uris - URIs to resolve
   * @param {Object} options - Resolution options
   * @returns {Promise<Array>} Resolution results
   */
  async batchResolve(uris, options = {}) {
    const results = [];
    const { concurrency = 5 } = options;

    // Process in batches to avoid overwhelming the system
    for (let i = 0; i < uris.length; i += concurrency) {
      const batch = uris.slice(i, i + concurrency);
      const batchPromises = batch.map(async (uri, index) => {
        try {
          const result = await this.resolveURI(uri, options);
          return { index: i + index, uri, ...result };
        } catch (error) {
          return {
            index: i + index,
            uri,
            success: false,
            error: error.message,
            resolved: false
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    return results.sort((a, b) => a.index - b.index);
  }

  /**
   * Clear URI cache
   */
  clearCache() {
    this.uriCache.clear();
  }

  /**
   * Get cache statistics
   * 
   * @returns {Object} Cache statistics
   */
  getCacheStats() {
    return {
      size: this.uriCache.size,
      enabled: this.options.enableCache
    };
  }
}

/**
 * Create doc URI resolver with default settings
 * 
 * @param {Object} options - Resolver options
 * @returns {DocURIResolver} Configured resolver
 */
export function createDocURIResolver(options = {}) {
  return new DocURIResolver(options);
}

/**
 * Quick URI resolution function
 * 
 * @param {string} uri - URI to resolve
 * @param {Object} options - Resolution options
 * @returns {Promise<Object>} Resolution result
 */
export async function resolveURI(uri, options = {}) {
  const resolver = new DocURIResolver(options);
  return resolver.resolveURI(uri, options);
}

/**
 * Quick canonicalization function
 * 
 * @param {string} sourceUri - Source URI to canonicalize
 * @param {Object} options - Canonicalization options
 * @returns {Promise<Object>} Canonicalization result
 */
export async function canonicalizeURI(sourceUri, options = {}) {
  const resolver = new DocURIResolver(options);
  return resolver.canonicalizeURI(sourceUri, options);
}

export default DocURIResolver;