/**
 * Git URI Resolver for KGEN Dark-Matter Integration
 * 
 * Implements git:// URI scheme resolution with attestation integration:
 * - git://<dir>@<oid>/<filepath> - Resolve git objects and file content
 * - Git-notes integration for attestation attachment
 * - Support for raw git objects and file content retrieval
 */

import { GitOperations } from '../git/git-operations.js';
import { GitProvenanceTracker } from '../git/git-provenance.js';
import path from 'path';
import fs from 'fs-extra';
import crypto from 'crypto';

export class GitUriResolver {
  constructor(options = {}) {
    this.options = {
      allowRemoteRepos: options.allowRemoteRepos !== false,
      cacheDir: options.cacheDir || '.kgen/git-cache',
      enableAttestation: options.enableAttestation !== false,
      ...options
    };
    
    this.gitOps = new GitOperations(options);
    this.provenanceTracker = new GitProvenanceTracker(options);
    this.cache = new Map();
  }

  /**
   * Initialize git URI resolver
   */
  async initialize() {
    await fs.ensureDir(this.options.cacheDir);
    
    const gitResult = await this.gitOps.initialize();
    const provResult = await this.provenanceTracker.initialize();
    
    return {
      success: true,
      gitUriResolver: true,
      git: gitResult,
      provenance: provResult,
      cacheDir: this.options.cacheDir
    };
  }

  /**
   * Resolve git:// URI to content with attestation support
   * 
   * URI formats:
   * - git://<dir>@<oid>/<filepath> - File content from git object
   * - git://<dir>@<oid> - Raw git object
   * - git://<dir>@<oid>/tree - Tree listing
   * - git://<dir>@<oid>/.notes - Git notes (attestations)
   */
  async resolve(uri) {
    try {
      const parsed = this._parseGitUri(uri);
      const cacheKey = this._generateCacheKey(uri);
      
      // Check cache first
      if (this.cache.has(cacheKey)) {
        const cached = this.cache.get(cacheKey);
        if (!this._isCacheExpired(cached)) {
          return {
            ...cached.data,
            cached: true,
            cacheHit: true
          };
        }
      }

      let result;
      
      switch (parsed.type) {
        case 'file':
          result = await this._resolveFileContent(parsed);
          break;
        case 'object':
          result = await this._resolveGitObject(parsed);
          break;
        case 'tree':
          result = await this._resolveTreeListing(parsed);
          break;
        case 'notes':
          result = await this._resolveGitNotes(parsed);
          break;
        default:
          throw new Error(`Unsupported git URI type: ${parsed.type}`);
      }

      // Add attestation data if enabled and available
      if (this.options.enableAttestation && parsed.oid) {
        result.attestation = await this._getAttestationData(parsed);
      }

      // Cache the result
      this.cache.set(cacheKey, {
        data: result,
        timestamp: this.getDeterministicTimestamp(),
        uri
      });

      return {
        ...result,
        cached: false,
        resolved: true,
        gitUri: uri
      };

    } catch (error) {
      throw new Error(`Failed to resolve git URI ${uri}: ${error.message}`);
    }
  }

  /**
   * Resolve file content from git object
   */
  async _resolveFileContent(parsed) {
    try {
      // First try to read the object directly
      const objectData = await this.gitOps.readBlob(parsed.oid);
      
      if (parsed.filepath) {
        // If filepath is specified, parse as tree and find the file
        const tree = await this._parseTreeObject(objectData.content);
        const fileEntry = tree.entries.find(entry => entry.path === parsed.filepath);
        
        if (!fileEntry) {
          throw new Error(`File not found: ${parsed.filepath}`);
        }
        
        const fileBlob = await this.gitOps.readBlob(fileEntry.sha);
        
        return {
          type: 'file',
          content: fileBlob.content,
          sha: fileEntry.sha,
          size: fileBlob.size,
          mode: fileEntry.mode,
          filepath: parsed.filepath,
          sourceOid: parsed.oid,
          repository: parsed.dir
        };
      } else {
        // Return blob content directly
        return {
          type: 'blob',
          content: objectData.content,
          sha: parsed.oid,
          size: objectData.size,
          repository: parsed.dir
        };
      }
    } catch (error) {
      throw new Error(`Failed to resolve file content: ${error.message}`);
    }
  }

  /**
   * Resolve raw git object
   */
  async _resolveGitObject(parsed) {
    try {
      const objectData = await this.gitOps.readBlob(parsed.oid);
      
      return {
        type: 'object',
        content: objectData.content,
        sha: parsed.oid,
        size: objectData.size,
        repository: parsed.dir,
        raw: true
      };
    } catch (error) {
      throw new Error(`Failed to resolve git object: ${error.message}`);
    }
  }

  /**
   * Resolve tree listing
   */
  async _resolveTreeListing(parsed) {
    try {
      const objectData = await this.gitOps.readBlob(parsed.oid);
      const tree = await this._parseTreeObject(objectData.content);
      
      return {
        type: 'tree',
        entries: tree.entries,
        sha: parsed.oid,
        repository: parsed.dir,
        count: tree.entries.length
      };
    } catch (error) {
      throw new Error(`Failed to resolve tree listing: ${error.message}`);
    }
  }

  /**
   * Resolve git notes (attestations)
   */
  async _resolveGitNotes(parsed) {
    try {
      const notesData = await this.gitOps.getProvenance(parsed.oid);
      
      if (!notesData) {
        return {
          type: 'notes',
          attestations: [],
          sha: parsed.oid,
          repository: parsed.dir,
          found: false
        };
      }
      
      return {
        type: 'notes',
        attestations: [notesData.provenance],
        sha: parsed.oid,
        repository: parsed.dir,
        found: true,
        notesRef: notesData.notesRef
      };
    } catch (error) {
      throw new Error(`Failed to resolve git notes: ${error.message}`);
    }
  }

  /**
   * Attach attestation to git object via notes
   */
  async attachAttestation(objectSha, attestationData) {
    try {
      // Validate attestation data
      const validatedAttestation = this._validateAttestationData(attestationData);
      
      // Create attestation with timestamp and integrity
      const attestation = {
        '@context': 'http://kgen.org/attestation#',
        '@type': 'Attestation',
        objectSha,
        timestamp: this.getDeterministicDate().toISOString(),
        integrity: {
          objectHash: objectSha,
          attestationHash: this._calculateAttestationHash(validatedAttestation)
        },
        ...validatedAttestation
      };

      // Store as git note
      const result = await this.gitOps.storeProvenance(objectSha, attestation);
      
      return {
        success: true,
        objectSha,
        attestationHash: attestation.integrity.attestationHash,
        notesRef: result.notesRef,
        attached: true
      };
    } catch (error) {
      throw new Error(`Failed to attach attestation: ${error.message}`);
    }
  }

  /**
   * Retrieve attestations for git object
   */
  async getAttestations(objectSha) {
    try {
      const notesData = await this.gitOps.getProvenance(objectSha);
      
      if (!notesData) {
        return {
          objectSha,
          attestations: [],
          found: false
        };
      }
      
      return {
        objectSha,
        attestations: Array.isArray(notesData.provenance) 
          ? notesData.provenance 
          : [notesData.provenance],
        found: true,
        notesRef: notesData.notesRef
      };
    } catch (error) {
      throw new Error(`Failed to retrieve attestations: ${error.message}`);
    }
  }

  /**
   * Create git URI from components
   */
  createGitUri(dir, oid, filepath = null) {
    let uri = `git://${dir}@${oid}`;
    
    if (filepath) {
      uri += `/${filepath}`;
    }
    
    return uri;
  }

  /**
   * Validate git URI format
   */
  validateGitUri(uri) {
    try {
      const parsed = this._parseGitUri(uri);
      return {
        valid: true,
        parsed
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * Parse git:// URI into components
   */
  _parseGitUri(uri) {
    const gitUriRegex = /^git:\/\/([^@]+)@([a-f0-9]{40})(?:\/(.+))?$/;
    const match = uri.match(gitUriRegex);
    
    if (!match) {
      throw new Error(`Invalid git URI format: ${uri}`);
    }
    
    const [, dir, oid, filepath] = match;
    
    // Determine URI type
    let type = 'object';
    if (filepath) {
      if (filepath === 'tree') {
        type = 'tree';
      } else if (filepath === '.notes') {
        type = 'notes';
      } else {
        type = 'file';
      }
    }
    
    return {
      dir,
      oid,
      filepath,
      type,
      uri
    };
  }

  /**
   * Parse tree object content
   */
  async _parseTreeObject(content) {
    // Simplified tree parsing - in production would use proper git object parsing
    const entries = [];
    
    // This is a placeholder - actual implementation would parse git tree format
    // For now, return empty entries
    return {
      entries,
      type: 'tree'
    };
  }

  /**
   * Get attestation data for object
   */
  async _getAttestationData(parsed) {
    try {
      const attestations = await this.getAttestations(parsed.oid);
      return attestations.found ? attestations.attestations : [];
    } catch (error) {
      return [];
    }
  }

  /**
   * Validate attestation data
   */
  _validateAttestationData(data) {
    if (!data || typeof data !== 'object') {
      throw new Error('Attestation data must be an object');
    }
    
    if (!data.type && !data['@type']) {
      data['@type'] = 'GenericAttestation';
    }
    
    return data;
  }

  /**
   * Calculate attestation hash
   */
  _calculateAttestationHash(attestation) {
    const canonicalData = JSON.stringify(attestation, Object.keys(attestation).sort());
    return crypto.createHash('sha256').update(canonicalData).digest('hex');
  }

  /**
   * Generate cache key for URI
   */
  _generateCacheKey(uri) {
    return crypto.createHash('sha256').update(uri).digest('hex').substring(0, 16);
  }

  /**
   * Check if cache entry is expired
   */
  _isCacheExpired(cached) {
    const maxAge = this.options.cacheMaxAge || 5 * 60 * 1000; // 5 minutes default
    return (this.getDeterministicTimestamp() - cached.timestamp) > maxAge;
  }

  /**
   * Clear resolver cache
   */
  clearCache() {
    this.cache.clear();
    return { success: true, cleared: true };
  }

  /**
   * Get resolver statistics
   */
  getStats() {
    return {
      cacheSize: this.cache.size,
      gitOperations: this.gitOps.getPerformanceStats(),
      resolver: {
        type: 'git-uri-resolver',
        attestationEnabled: this.options.enableAttestation,
        cacheDir: this.options.cacheDir
      }
    };
  }
}

export default GitUriResolver;