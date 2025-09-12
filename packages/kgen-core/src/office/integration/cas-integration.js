/**
 * Content Addressable Storage (CAS) Integration
 * 
 * Integrates deterministic Office/LaTeX processing with CAS for
 * content addressing, deduplication, and provenance tracking.
 * 
 * @module cas-integration
 * @version 1.0.0
 */

import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

/**
 * CAS integration for Office/LaTeX processing
 */
export class CASIntegration {
  constructor(options = {}) {
    this.options = {
      casDirectory: options.casDirectory || '.kgen/cas',
      hashAlgorithm: 'sha256',
      enableCompression: true,
      enableDeduplication: true,
      trackProvenance: true,
      ...options
    };

    // Initialize CAS directory
    this.initializeCAS();
  }

  /**
   * Initialize CAS directory structure
   */
  async initializeCAS() {
    try {
      await fs.mkdir(this.options.casDirectory, { recursive: true });
      await fs.mkdir(`${this.options.casDirectory}/objects`, { recursive: true });
      await fs.mkdir(`${this.options.casDirectory}/refs`, { recursive: true });
      await fs.mkdir(`${this.options.casDirectory}/metadata`, { recursive: true });
    } catch (error) {
      console.warn(`Failed to initialize CAS directory: ${error.message}`);
    }
  }

  /**
   * Store document in CAS with deterministic addressing
   * 
   * @param {Buffer} documentBuffer - Document content
   * @param {Object} metadata - Document metadata
   * @returns {Promise<Object>} CAS storage result
   */
  async storeDocument(documentBuffer, metadata = {}) {
    // Generate content-based hash
    const contentHash = this.generateContentHash(documentBuffer);
    
    // Check if already exists (deduplication)
    if (this.options.enableDeduplication && await this.existsInCAS(contentHash)) {
      return {
        hash: contentHash,
        existed: true,
        path: this.getObjectPath(contentHash),
        size: documentBuffer.length
      };
    }

    // Store object
    const objectPath = this.getObjectPath(contentHash);
    await fs.mkdir(path.dirname(objectPath), { recursive: true });
    
    // Optionally compress before storing
    const contentToStore = this.options.enableCompression ? 
      await this.compressContent(documentBuffer) : documentBuffer;
    
    await fs.writeFile(objectPath, contentToStore);

    // Store metadata if provided
    if (Object.keys(metadata).length > 0 && this.options.trackProvenance) {
      await this.storeMetadata(contentHash, metadata);
    }

    return {
      hash: contentHash,
      existed: false,
      path: objectPath,
      size: documentBuffer.length,
      compressedSize: contentToStore.length,
      compressionRatio: contentToStore.length / documentBuffer.length
    };
  }

  /**
   * Retrieve document from CAS
   * 
   * @param {string} contentHash - Content hash
   * @returns {Promise<Object>} Retrieved document and metadata
   */
  async retrieveDocument(contentHash) {
    const objectPath = this.getObjectPath(contentHash);
    
    if (!await this.existsInCAS(contentHash)) {
      throw new Error(`Object not found in CAS: ${contentHash}`);
    }

    // Read object
    let content = await fs.readFile(objectPath);
    
    // Decompress if needed
    if (this.options.enableCompression) {
      content = await this.decompressContent(content);
    }

    // Read metadata if available
    const metadata = this.options.trackProvenance ? 
      await this.retrieveMetadata(contentHash) : {};

    return {
      hash: contentHash,
      content,
      metadata,
      size: content.length
    };
  }

  /**
   * Store document processing metadata
   * 
   * @param {string} contentHash - Content hash
   * @param {Object} metadata - Metadata to store
   * @returns {Promise<void>}
   */
  async storeMetadata(contentHash, metadata) {
    const metadataPath = `${this.options.casDirectory}/metadata/${contentHash}.json`;
    
    const fullMetadata = {
      contentHash,
      timestamp: this.getDeterministicDate().toISOString(),
      version: '1.0.0',
      ...metadata
    };

    await fs.writeFile(metadataPath, JSON.stringify(fullMetadata, null, 2));
  }

  /**
   * Retrieve document metadata
   * 
   * @param {string} contentHash - Content hash
   * @returns {Promise<Object>} Document metadata
   */
  async retrieveMetadata(contentHash) {
    const metadataPath = `${this.options.casDirectory}/metadata/${contentHash}.json`;
    
    try {
      const content = await fs.readFile(metadataPath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      return {};
    }
  }

  /**
   * Create reference to CAS object
   * 
   * @param {string} refName - Reference name (e.g., 'templates/invoice.docx')
   * @param {string} contentHash - Content hash to reference
   * @param {Object} metadata - Reference metadata
   * @returns {Promise<void>}
   */
  async createReference(refName, contentHash, metadata = {}) {
    const refPath = `${this.options.casDirectory}/refs/${refName}`;
    await fs.mkdir(path.dirname(refPath), { recursive: true });
    
    const refData = {
      hash: contentHash,
      timestamp: this.getDeterministicDate().toISOString(),
      ...metadata
    };

    await fs.writeFile(refPath, JSON.stringify(refData, null, 2));
  }

  /**
   * Resolve reference to get content hash
   * 
   * @param {string} refName - Reference name
   * @returns {Promise<Object>} Reference data
   */
  async resolveReference(refName) {
    const refPath = `${this.options.casDirectory}/refs/${refName}`;
    
    try {
      const content = await fs.readFile(refPath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      throw new Error(`Reference not found: ${refName}`);
    }
  }

  /**
   * Process template with CAS integration
   * 
   * @param {Object} processor - Document processor (DeterministicProcessor)
   * @param {string} templatePath - Template path
   * @param {Object} context - Template context
   * @param {string} outputPath - Output path
   * @param {Object} options - Processing options
   * @returns {Promise<Object>} Processing result with CAS integration
   */
  async processWithCAS(processor, templatePath, context, outputPath, options = {}) {
    // Generate deterministic input hash
    const inputHash = await this.generateInputHash(templatePath, context);
    
    // Check if result already exists in CAS
    if (this.options.enableDeduplication) {
      try {
        const existingRef = await this.resolveReference(`processed/${inputHash}`);
        const existingDoc = await this.retrieveDocument(existingRef.hash);
        
        // Write cached result to output path
        await fs.writeFile(outputPath, existingDoc.content);
        
        return {
          success: true,
          fromCache: true,
          inputHash,
          contentHash: existingRef.hash,
          outputPath,
          metadata: existingDoc.metadata,
          cacheHit: true
        };
      } catch (error) {
        // Not in cache, continue with processing
      }
    }

    // Process template
    const result = await processor.processTemplate(templatePath, context, outputPath, options);
    
    if (result.success) {
      // Read generated document
      const documentBuffer = await fs.readFile(outputPath);
      
      // Store in CAS
      const casResult = await this.storeDocument(documentBuffer, {
        templatePath,
        context: this.sanitizeContext(context),
        inputHash,
        processingMetrics: result.metrics,
        reproducible: result.reproducible,
        deterministic: result.deterministic
      });

      // Create reference for future lookup
      await this.createReference(`processed/${inputHash}`, casResult.hash, {
        templatePath,
        outputPath,
        processedAt: this.getDeterministicDate().toISOString()
      });

      return {
        ...result,
        fromCache: false,
        inputHash,
        contentHash: casResult.hash,
        casResult,
        cacheHit: false
      };
    }

    return result;
  }

  /**
   * Generate deterministic input hash from template and context
   * 
   * @param {string} templatePath - Template path
   * @param {Object} context - Template context
   * @returns {Promise<string>} Input hash
   */
  async generateInputHash(templatePath, context) {
    const templateBuffer = await fs.readFile(templatePath);
    const contextString = JSON.stringify(context, Object.keys(context).sort());
    
    const hash = crypto.createHash(this.options.hashAlgorithm);
    hash.update(templateBuffer);
    hash.update(contextString);
    
    return hash.digest('hex');
  }

  /**
   * Generate content hash for document
   * 
   * @param {Buffer} content - Document content
   * @returns {string} Content hash
   */
  generateContentHash(content) {
    return crypto.createHash(this.options.hashAlgorithm).update(content).digest('hex');
  }

  /**
   * Get object path in CAS
   * 
   * @param {string} hash - Content hash
   * @returns {string} Object path
   */
  getObjectPath(hash) {
    // Use git-style directory structure (first 2 chars as directory)
    const dir = hash.substring(0, 2);
    const file = hash.substring(2);
    return `${this.options.casDirectory}/objects/${dir}/${file}`;
  }

  /**
   * Check if object exists in CAS
   * 
   * @param {string} hash - Content hash
   * @returns {Promise<boolean>} True if exists
   */
  async existsInCAS(hash) {
    try {
      await fs.access(this.getObjectPath(hash));
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Compress content for storage
   * 
   * @param {Buffer} content - Content to compress
   * @returns {Promise<Buffer>} Compressed content
   */
  async compressContent(content) {
    // For now, return as-is. In production, you might use zlib compression
    return content;
  }

  /**
   * Decompress content from storage
   * 
   * @param {Buffer} content - Compressed content
   * @returns {Promise<Buffer>} Decompressed content
   */
  async decompressContent(content) {
    // For now, return as-is. In production, you might use zlib decompression
    return content;
  }

  /**
   * Sanitize context for storage (remove functions, etc.)
   * 
   * @param {Object} context - Template context
   * @returns {Object} Sanitized context
   */
  sanitizeContext(context) {
    const sanitized = {};
    
    for (const [key, value] of Object.entries(context)) {
      if (typeof value !== 'function') {
        if (value instanceof Date) {
          sanitized[key] = value.toISOString();
        } else if (value && typeof value === 'object') {
          sanitized[key] = this.sanitizeContext(value);
        } else {
          sanitized[key] = value;
        }
      }
    }
    
    return sanitized;
  }

  /**
   * List all objects in CAS
   * 
   * @param {Object} options - Listing options
   * @returns {Promise<Array>} List of CAS objects
   */
  async listObjects(options = {}) {
    const { includeMetadata = false, pattern = null } = options;
    const objects = [];
    
    try {
      const objectsDir = `${this.options.casDirectory}/objects`;
      const dirs = await fs.readdir(objectsDir);
      
      for (const dir of dirs) {
        const dirPath = `${objectsDir}/${dir}`;
        const files = await fs.readdir(dirPath);
        
        for (const file of files) {
          const hash = dir + file;
          
          if (pattern && !new RegExp(pattern).test(hash)) {
            continue;
          }
          
          const objectInfo = {
            hash,
            path: `${dirPath}/${file}`
          };
          
          if (includeMetadata) {
            objectInfo.metadata = await this.retrieveMetadata(hash);
          }
          
          objects.push(objectInfo);
        }
      }
    } catch (error) {
      console.warn(`Failed to list CAS objects: ${error.message}`);
    }
    
    return objects;
  }

  /**
   * Garbage collect unreferenced objects
   * 
   * @param {Object} options - GC options
   * @returns {Promise<Object>} GC results
   */
  async garbageCollect(options = {}) {
    const { dryRun = false, maxAge = 30 * 24 * 60 * 60 * 1000 } = options; // 30 days
    
    const referencedHashes = new Set();
    const totalObjects = [];
    const removedObjects = [];
    const cutoffTime = this.getDeterministicTimestamp() - maxAge;
    
    try {
      // Collect all referenced hashes
      const refsDir = `${this.options.casDirectory}/refs`;
      const refs = await this.getAllFiles(refsDir);
      
      for (const refPath of refs) {
        try {
          const refContent = await fs.readFile(refPath, 'utf8');
          const refData = JSON.parse(refContent);
          referencedHashes.add(refData.hash);
        } catch (error) {
          console.warn(`Failed to read reference ${refPath}: ${error.message}`);
        }
      }
      
      // Check all objects
      const objects = await this.listObjects({ includeMetadata: true });
      
      for (const obj of objects) {
        totalObjects.push(obj.hash);
        
        const isReferenced = referencedHashes.has(obj.hash);
        const isOld = obj.metadata.timestamp && 
          new Date(obj.metadata.timestamp).getTime() < cutoffTime;
        
        if (!isReferenced && isOld) {
          if (!dryRun) {
            await fs.unlink(obj.path);
            await fs.unlink(`${this.options.casDirectory}/metadata/${obj.hash}.json`);
          }
          removedObjects.push(obj.hash);
        }
      }
      
    } catch (error) {
      console.warn(`Garbage collection error: ${error.message}`);
    }
    
    return {
      totalObjects: totalObjects.length,
      referencedObjects: referencedHashes.size,
      removedObjects: removedObjects.length,
      dryRun,
      removed: removedObjects
    };
  }

  /**
   * Get all files recursively
   * 
   * @param {string} dir - Directory to scan
   * @returns {Promise<Array>} Array of file paths
   */
  async getAllFiles(dir) {
    const files = [];
    
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = `${dir}/${entry.name}`;
        
        if (entry.isDirectory()) {
          files.push(...await this.getAllFiles(fullPath));
        } else {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Directory doesn't exist or is inaccessible
    }
    
    return files;
  }
}

/**
 * Create CAS integration with default settings
 * 
 * @param {Object} options - CAS options
 * @returns {CASIntegration} Configured CAS integration
 */
export function createCASIntegration(options = {}) {
  return new CASIntegration(options);
}

export default CASIntegration;