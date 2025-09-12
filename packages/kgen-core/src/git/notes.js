/**
 * Git Notes Operations - Attestation storage via git-notes
 * 
 * Provides git-notes based storage for attestations and metadata,
 * allowing cryptographic attestations to be attached to commits and objects.
 */

import git from 'isomorphic-git';
import fs from 'fs-extra';
import crypto from 'crypto';
import { EventEmitter } from 'events';
import { Consola } from 'consola';

export class GitNotesManager extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      gitDir: config.gitDir || process.cwd() + '/.git',
      fs: config.fs || fs,
      notesRef: config.notesRef || 'refs/notes/kgen-attestations',
      enableSignature: config.enableSignature !== false,
      signatureAlgorithm: config.signatureAlgorithm || 'RS256',
      autoCommit: config.autoCommit !== false,
      ...config
    };
    
    this.logger = new Consola({ tag: 'git-notes' });
    this.notesCache = new Map();
    this.stats = {
      notesAdded: 0,
      notesRetrieved: 0,
      notesUpdated: 0,
      attestationsGenerated: 0
    };
  }

  /**
   * Add attestation note to a git object (commit, blob, tree)
   * @param {string} objectHash - Git object hash
   * @param {Object} attestation - Attestation data
   * @param {Object} options - Options
   * @returns {Promise<string>} Notes commit hash
   */
  async addAttestationNote(objectHash, attestation, options = {}) {
    try {
      const startTime = Date.now();
      
      // Validate object exists
      await this._validateObjectExists(objectHash);
      
      // Prepare attestation data
      const enrichedAttestation = {
        ...attestation,
        timestamp: attestation.timestamp || new Date().toISOString(),
        objectHash,
        attestationType: attestation.type || 'kgen-artifact',
        version: '1.0',
        generator: 'kgen-core'
      };
      
      // Add cryptographic signature if enabled
      if (this.config.enableSignature) {
        enrichedAttestation.signature = await this._generateSignature(enrichedAttestation);
      }
      
      // Serialize attestation
      const noteContent = JSON.stringify(enrichedAttestation, null, 2);
      
      // Get existing notes for this object
      const existingNotes = await this.getAttestationNotes(objectHash, { silent: true });
      
      // Merge with existing notes
      let combinedNotes;
      if (existingNotes && existingNotes.length > 0) {
        const allAttestations = [...existingNotes, enrichedAttestation];
        combinedNotes = JSON.stringify(allAttestations, null, 2);
        this.stats.notesUpdated++;
      } else {
        combinedNotes = `[${noteContent}]`;
        this.stats.notesAdded++;
      }
      
      // Add note using git-notes
      const notesCommit = await this._addGitNote(objectHash, combinedNotes, options);
      
      // Update cache
      this.notesCache.set(objectHash, enrichedAttestation);
      this.stats.attestationsGenerated++;
      
      // Emit event
      this.emit('attestation-added', {
        objectHash,
        attestation: enrichedAttestation,
        notesCommit,
        duration: Date.now() - startTime
      });
      
      this.logger.info(`Added attestation note for ${objectHash}: ${notesCommit}`);
      return notesCommit;
      
    } catch (error) {
      this.logger.error(`Failed to add attestation note for ${objectHash}:`, error);
      this.emit('attestation-error', { operation: 'add', objectHash, error });
      throw error;
    }
  }

  /**
   * Retrieve attestation notes for a git object
   * @param {string} objectHash - Git object hash
   * @param {Object} options - Options
   * @returns {Promise<Array>} Array of attestations
   */
  async getAttestationNotes(objectHash, options = {}) {
    try {
      // Check cache first
      if (this.notesCache.has(objectHash)) {
        return [this.notesCache.get(objectHash)];
      }
      
      // Retrieve from git notes
      const noteContent = await this._getGitNote(objectHash, options);
      if (!noteContent) {
        return [];
      }
      
      // Parse attestations
      let attestations;
      try {
        attestations = JSON.parse(noteContent);
        if (!Array.isArray(attestations)) {
          attestations = [attestations];
        }
      } catch (parseError) {
        if (!options.silent) {
          this.logger.warn(`Failed to parse note content for ${objectHash}:`, parseError);
        }
        return [];
      }
      
      // Verify signatures if enabled
      if (this.config.enableSignature) {
        for (const attestation of attestations) {
          if (attestation.signature) {
            attestation.signatureValid = await this._verifySignature(attestation);
          }
        }
      }
      
      // Update cache
      if (attestations.length > 0) {
        this.notesCache.set(objectHash, attestations[attestations.length - 1]);
      }
      
      this.stats.notesRetrieved++;
      
      if (!options.silent) {
        this.logger.debug(`Retrieved ${attestations.length} attestation(s) for ${objectHash}`);
      }
      
      return attestations;
      
    } catch (error) {
      if (!options.silent) {
        this.logger.error(`Failed to get attestation notes for ${objectHash}:`, error);
      }
      return [];
    }
  }

  /**
   * List all attestation notes in the repository
   * @param {Object} options - Listing options
   * @returns {Promise<Array>} List of all attestations with their objects
   */
  async listAllAttestations(options = {}) {
    try {
      const attestations = [];
      
      // Get all notes from the notes ref
      const notesMap = await this._getAllGitNotes();
      
      for (const [objectHash, noteContent] of notesMap) {
        try {
          const objectAttestations = JSON.parse(noteContent);
          const attestationList = Array.isArray(objectAttestations) 
            ? objectAttestations 
            : [objectAttestations];
            
          for (const attestation of attestationList) {
            attestations.push({
              objectHash,
              ...attestation
            });
          }
        } catch (parseError) {
          this.logger.warn(`Failed to parse attestation for ${objectHash}:`, parseError.message);
        }
      }
      
      // Apply filters
      let filteredAttestations = attestations;
      if (options.type) {
        filteredAttestations = filteredAttestations.filter(a => a.attestationType === options.type);
      }
      if (options.since) {
        const sinceDate = new Date(options.since);
        filteredAttestations = filteredAttestations.filter(a => new Date(a.timestamp) >= sinceDate);
      }
      if (options.until) {
        const untilDate = new Date(options.until);
        filteredAttestations = filteredAttestations.filter(a => new Date(a.timestamp) <= untilDate);
      }
      
      // Sort by timestamp (newest first)
      filteredAttestations.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      this.logger.info(`Listed ${filteredAttestations.length} attestations (filtered from ${attestations.length})`);
      return filteredAttestations;
      
    } catch (error) {
      this.logger.error('Failed to list all attestations:', error);
      throw error;
    }
  }

  /**
   * Verify attestation chain for an artifact
   * @param {string} objectHash - Git object hash
   * @returns {Promise<Object>} Verification result
   */
  async verifyAttestationChain(objectHash) {
    try {
      const attestations = await this.getAttestationNotes(objectHash);
      
      if (attestations.length === 0) {
        return {
          objectHash,
          verified: false,
          reason: 'No attestations found',
          attestationCount: 0
        };
      }
      
      const verificationResults = [];
      let allValid = true;
      
      for (const attestation of attestations) {
        const result = {
          timestamp: attestation.timestamp,
          type: attestation.attestationType,
          hasSignature: !!attestation.signature,
          signatureValid: null,
          structureValid: this._validateAttestationStructure(attestation)
        };
        
        if (attestation.signature && this.config.enableSignature) {
          result.signatureValid = await this._verifySignature(attestation);
        }
        
        if (!result.structureValid || (result.hasSignature && result.signatureValid === false)) {
          allValid = false;
        }
        
        verificationResults.push(result);
      }
      
      return {
        objectHash,
        verified: allValid,
        attestationCount: attestations.length,
        verificationResults,
        verifiedAt: new Date().toISOString()
      };
      
    } catch (error) {
      this.logger.error(`Failed to verify attestation chain for ${objectHash}:`, error);
      return {
        objectHash,
        verified: false,
        reason: error.message,
        error: true
      };
    }
  }

  /**
   * Add git note using low-level operations
   * @param {string} objectHash - Target object hash
   * @param {string} noteContent - Note content
   * @param {Object} options - Options
   * @returns {Promise<string>} Notes commit hash
   */
  async _addGitNote(objectHash, noteContent, options = {}) {
    try {
      // Write note as blob
      const noteBlob = await git.writeBlob({
        fs: this.config.fs,
        dir: this.config.gitDir.replace('/.git', ''),
        blob: Buffer.from(noteContent, 'utf8')
      });
      
      // Create tree entry for the note
      const treeEntries = [{
        mode: '100644',
        path: objectHash,
        oid: noteBlob,
        type: 'blob'
      }];
      
      // Get current notes tree (if exists)
      try {
        const currentNotesCommit = await git.resolveRef({
          fs: this.config.fs,
          dir: this.config.gitDir.replace('/.git', ''),
          ref: this.config.notesRef
        });
        
        const { object: currentTree } = await git.readCommit({
          fs: this.config.fs,
          dir: this.config.gitDir.replace('/.git', ''),
          oid: currentNotesCommit
        });
        
        // Add existing tree entries (except the one we're updating)
        const existingTree = await git.readTree({
          fs: this.config.fs,
          dir: this.config.gitDir.replace('/.git', ''),
          oid: currentTree.tree
        });
        
        for (const entry of existingTree.tree) {
          if (entry.path !== objectHash) {
            treeEntries.push(entry);
          }
        }
      } catch (refError) {
        // Notes ref doesn't exist yet, which is fine
        this.logger.debug('Creating new notes ref');
      }
      
      // Write tree
      const treeHash = await git.writeTree({
        fs: this.config.fs,
        dir: this.config.gitDir.replace('/.git', ''),
        tree: treeEntries
      });
      
      // Create commit
      const commitHash = await git.commit({
        fs: this.config.fs,
        dir: this.config.gitDir.replace('/.git', ''),
        message: options.message || `Add attestation note for ${objectHash}`,
        tree: treeHash,
        parent: [], // Notes commits typically don't have parents
        author: {
          name: options.author?.name || 'KGEN',
          email: options.author?.email || 'kgen@localhost',
          timestamp: Math.floor(Date.now() / 1000)
        }
      });
      
      // Update notes ref
      await git.writeRef({
        fs: this.config.fs,
        dir: this.config.gitDir.replace('/.git', ''),
        ref: this.config.notesRef,
        value: commitHash,
        force: true // Allow overwriting existing ref
      });
      
      return commitHash;
      
    } catch (error) {
      this.logger.error('Failed to add git note:', error);
      throw error;
    }
  }

  /**
   * Get git note for an object
   * @param {string} objectHash - Target object hash
   * @param {Object} options - Options
   * @returns {Promise<string|null>} Note content or null
   */
  async _getGitNote(objectHash, options = {}) {
    try {
      // Resolve notes ref
      const notesCommit = await git.resolveRef({
        fs: this.config.fs,
        dir: this.config.gitDir.replace('/.git', ''),
        ref: this.config.notesRef
      });
      
      // Read the commit
      const { object: commit } = await git.readCommit({
        fs: this.config.fs,
        dir: this.config.gitDir.replace('/.git', ''),
        oid: notesCommit
      });
      
      // Read the tree
      const { tree } = await git.readTree({
        fs: this.config.fs,
        dir: this.config.gitDir.replace('/.git', ''),
        oid: commit.tree
      });
      
      // Find the note for this object
      const noteEntry = tree.find(entry => entry.path === objectHash);
      if (!noteEntry) {
        return null;
      }
      
      // Read the note blob
      const { blob } = await git.readBlob({
        fs: this.config.fs,
        dir: this.config.gitDir.replace('/.git', ''),
        oid: noteEntry.oid
      });
      
      return blob.toString('utf8');
      
    } catch (error) {
      if (error.code === 'NotFoundError' || error.message.includes('not found')) {
        return null;
      }
      if (!options.silent) {
        this.logger.error(`Failed to get git note for ${objectHash}:`, error);
      }
      throw error;
    }
  }

  /**
   * Get all git notes
   * @returns {Promise<Map<string, string>>} Map of object hash to note content
   */
  async _getAllGitNotes() {
    try {
      const notes = new Map();
      
      // Resolve notes ref
      const notesCommit = await git.resolveRef({
        fs: this.config.fs,
        dir: this.config.gitDir.replace('/.git', ''),
        ref: this.config.notesRef
      });
      
      // Read the commit
      const { object: commit } = await git.readCommit({
        fs: this.config.fs,
        dir: this.config.gitDir.replace('/.git', ''),
        oid: notesCommit
      });
      
      // Read the tree
      const { tree } = await git.readTree({
        fs: this.config.fs,
        dir: this.config.gitDir.replace('/.git', ''),
        oid: commit.tree
      });
      
      // Read all note blobs
      for (const entry of tree) {
        if (entry.type === 'blob') {
          const { blob } = await git.readBlob({
            fs: this.config.fs,
            dir: this.config.gitDir.replace('/.git', ''),
            oid: entry.oid
          });
          notes.set(entry.path, blob.toString('utf8'));
        }
      }
      
      return notes;
      
    } catch (error) {
      if (error.code === 'NotFoundError') {
        return new Map(); // No notes exist yet
      }
      throw error;
    }
  }

  /**
   * Validate that a git object exists
   * @param {string} objectHash - Object hash to validate
   * @returns {Promise<void>}
   */
  async _validateObjectExists(objectHash) {
    try {
      // Try to read the object (works for any git object type)
      await git.readObject({
        fs: this.config.fs,
        dir: this.config.gitDir.replace('/.git', ''),
        oid: objectHash
      });
    } catch (error) {
      throw new Error(`Git object ${objectHash} does not exist: ${error.message}`);
    }
  }

  /**
   * Generate cryptographic signature for attestation
   * @param {Object} attestation - Attestation data (without signature)
   * @returns {Promise<string>} Signature
   */
  async _generateSignature(attestation) {
    // Create a copy without the signature field
    const { signature, ...dataToSign } = attestation;
    const dataString = JSON.stringify(dataToSign, Object.keys(dataToSign).sort());
    
    // For now, use HMAC-SHA256 (in production, use RSA or ECDSA)
    const secret = this.config.signatureSecret || 'kgen-default-secret';
    return crypto.createHmac('sha256', secret).update(dataString).digest('hex');
  }

  /**
   * Verify cryptographic signature
   * @param {Object} attestation - Attestation data with signature
   * @returns {Promise<boolean>} True if signature is valid
   */
  async _verifySignature(attestation) {
    try {
      const expectedSignature = await this._generateSignature(attestation);
      return attestation.signature === expectedSignature;
    } catch (error) {
      this.logger.warn('Signature verification failed:', error.message);
      return false;
    }
  }

  /**
   * Validate attestation structure
   * @param {Object} attestation - Attestation to validate
   * @returns {boolean} True if structure is valid
   */
  _validateAttestationStructure(attestation) {
    const required = ['timestamp', 'objectHash', 'attestationType', 'version'];
    return required.every(field => attestation.hasOwnProperty(field) && attestation[field]);
  }

  /**
   * Get statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      ...this.stats,
      cacheSize: this.notesCache.size
    };
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.notesCache.clear();
    this.logger.info('Notes cache cleared');
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    this.clearCache();
    this.removeAllListeners();
    this.logger.info('Git notes manager cleanup completed');
  }
}

/**
 * Create git notes manager instance
 * @param {Object} config - Configuration options
 * @returns {GitNotesManager} Initialized manager instance
 */
export function createGitNotesManager(config = {}) {
  return new GitNotesManager(config);
}

export default GitNotesManager;
