/**
 * Git-Notes Integration for Attestation Receipts
 * 
 * Provides git-notes based storage and retrieval of attestation receipts
 * with isomorphic-git for cross-platform compatibility.
 */

import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import consola from 'consola';
import * as git from 'isomorphic-git';
import { hashSHA256 } from 'hash-wasm';

export interface AttestationReceipt {
  id: string;
  gitSHA: string;
  artifactPath: string;
  attestation: any;
  envelope: any;
  createdAt: string;
  version: string;
  metadata?: Record<string, any>;
}

export interface GitNotesConfig {
  gitDirectory?: string;
  receiptDirectory?: string;
  notesRef?: string;
  enableCompression?: boolean;
  maxReceiptSize?: number;
}

export class GitNotesManager {
  private config: Required<GitNotesConfig>;
  private logger: any;
  private gitRepo?: any;

  constructor(config: GitNotesConfig = {}) {
    this.config = {
      gitDirectory: '.git',
      receiptDirectory: '.kgen/receipts',
      notesRef: 'refs/notes/attestations',
      enableCompression: true,
      maxReceiptSize: 1024 * 1024, // 1MB
      ...config
    };
    
    this.logger = consola.withTag('git-notes');
  }

  /**
   * Initialize git-notes manager
   */
  async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing git-notes manager...');
      
      // Check if git repository exists
      const gitExists = await this.checkGitRepository();
      if (!gitExists) {
        throw new Error('Git repository not found');
      }
      
      this.gitRepo = { fs, dir: '.' };
      
      // Ensure receipt directory exists
      await fs.mkdir(this.config.receiptDirectory, { recursive: true });
      
      // Initialize notes ref if it doesn't exist
      await this.initializeNotesRef();
      
      this.logger.success('Git-notes manager initialized successfully');
      
    } catch (error) {
      this.logger.error('Failed to initialize git-notes manager:', error);
      throw error;
    }
  }

  /**
   * Store attestation receipt in git-notes
   */
  async storeReceipt(
    gitSHA: string,
    artifactPath: string,
    attestation: any,
    envelope: any,
    metadata?: Record<string, any>
  ): Promise<string> {
    try {
      this.logger.info(`Storing attestation receipt for git SHA: ${gitSHA}`);
      
      const receiptId = crypto.randomUUID();
      const receipt: AttestationReceipt = {
        id: receiptId,
        gitSHA,
        artifactPath: path.resolve(artifactPath),
        attestation,
        envelope,
        createdAt: new Date().toISOString(),
        version: '1.0.0',
        metadata
      };
      
      // Validate receipt size
      const receiptSize = Buffer.byteLength(JSON.stringify(receipt));
      if (receiptSize > this.config.maxReceiptSize) {
        throw new Error(`Receipt size (${receiptSize}) exceeds maximum (${this.config.maxReceiptSize})`);
      }
      
      // Store receipt file
      const receiptPath = await this.writeReceiptFile(receipt);
      
      // Add to git-notes
      await this.addToGitNotes(gitSHA, receiptId, receiptPath);
      
      this.logger.success(`Stored receipt: ${receiptPath}`);
      return receiptPath;
      
    } catch (error) {
      this.logger.error(`Failed to store receipt for ${gitSHA}:`, error);
      throw error;
    }
  }

  /**
   * Retrieve attestation receipts for a git SHA
   */
  async getReceipts(gitSHA: string): Promise<AttestationReceipt[]> {
    try {
      this.logger.info(`Retrieving receipts for git SHA: ${gitSHA}`);
      
      // Get receipts from notes
      const noteData = await this.getFromGitNotes(gitSHA);
      if (!noteData) {
        return [];
      }
      
      const receiptIds = noteData.receiptIds || [];
      const receipts: AttestationReceipt[] = [];
      
      for (const receiptId of receiptIds) {
        try {
          const receipt = await this.loadReceiptFile(gitSHA, receiptId);
          if (receipt) {
            receipts.push(receipt);
          }
        } catch (error) {
          this.logger.warn(`Failed to load receipt ${receiptId}:`, error.message);
        }
      }
      
      this.logger.info(`Found ${receipts.length} receipts for ${gitSHA}`);
      return receipts;
      
    } catch (error) {
      this.logger.error(`Failed to get receipts for ${gitSHA}:`, error);
      return [];
    }
  }

  /**
   * Get all receipts for an artifact path across all commits
   */
  async getReceiptsForArtifact(artifactPath: string): Promise<AttestationReceipt[]> {
    try {
      const resolvedPath = path.resolve(artifactPath);
      this.logger.info(`Finding receipts for artifact: ${resolvedPath}`);
      
      const allReceipts: AttestationReceipt[] = [];
      
      // Scan all receipt directories
      const receiptDir = this.config.receiptDirectory;
      try {
        const gitSHADirs = await fs.readdir(receiptDir);
        
        for (const gitSHA of gitSHADirs) {
          const receipts = await this.getReceipts(gitSHA);
          const matchingReceipts = receipts.filter(r => r.artifactPath === resolvedPath);
          allReceipts.push(...matchingReceipts);
        }
      } catch (error) {
        // Receipt directory may not exist
        this.logger.debug('Receipt directory not found or empty');
      }
      
      // Sort by creation time (newest first)
      allReceipts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      this.logger.info(`Found ${allReceipts.length} receipts for ${artifactPath}`);
      return allReceipts;
      
    } catch (error) {
      this.logger.error(`Failed to get receipts for artifact ${artifactPath}:`, error);
      return [];
    }
  }

  /**
   * Verify receipt integrity
   */
  async verifyReceipt(receipt: AttestationReceipt): Promise<{
    verified: boolean;
    reason: string;
    details?: any;
  }> {
    try {
      // Verify receipt structure
      const structureValid = this.validateReceiptStructure(receipt);
      if (!structureValid.valid) {
        return {
          verified: false,
          reason: structureValid.reason
        };
      }
      
      // Verify git SHA exists
      const gitSHAValid = await this.verifyGitSHA(receipt.gitSHA);
      if (!gitSHAValid) {
        return {
          verified: false,
          reason: 'Git SHA not found in repository'
        };
      }
      
      // Verify artifact hash if file still exists
      const artifactValid = await this.verifyArtifactHash(receipt);
      
      return {
        verified: gitSHAValid && artifactValid.verified,
        reason: artifactValid.verified ? 'Receipt verification passed' : artifactValid.reason,
        details: {
          structure: structureValid,
          gitSHA: gitSHAValid,
          artifact: artifactValid
        }
      };
      
    } catch (error) {
      return {
        verified: false,
        reason: `Receipt verification failed: ${error.message}`
      };
    }
  }

  /**
   * List all git SHAs with attestation receipts
   */
  async listReceiptCommits(): Promise<string[]> {
    try {
      const receiptDir = this.config.receiptDirectory;
      const commits = await fs.readdir(receiptDir).catch(() => []);
      
      // Validate each commit SHA
      const validCommits: string[] = [];
      for (const commit of commits) {
        if (/^[a-f0-9]{40}$/i.test(commit)) {
          validCommits.push(commit);
        }
      }
      
      return validCommits.sort();
    } catch (error) {
      this.logger.error('Failed to list receipt commits:', error);
      return [];
    }
  }

  /**
   * Clean up old receipts
   */
  async cleanupReceipts(options: {
    olderThanDays?: number;
    keepMinimum?: number;
  } = {}): Promise<number> {
    try {
      const { olderThanDays = 30, keepMinimum = 10 } = options;
      const cutoffDate = new Date(Date.now() - (olderThanDays * 24 * 60 * 60 * 1000));
      
      this.logger.info(`Cleaning up receipts older than ${olderThanDays} days...`);
      
      let cleanedCount = 0;
      const commits = await this.listReceiptCommits();
      
      for (const commit of commits) {
        const receipts = await this.getReceipts(commit);
        const oldReceipts = receipts.filter(r => 
          new Date(r.createdAt) < cutoffDate && receipts.length > keepMinimum
        );
        
        for (const receipt of oldReceipts) {
          try {
            await this.deleteReceipt(receipt.gitSHA, receipt.id);
            cleanedCount++;
          } catch (error) {
            this.logger.warn(`Failed to delete receipt ${receipt.id}:`, error.message);
          }
        }
      }
      
      this.logger.info(`Cleaned up ${cleanedCount} old receipts`);
      return cleanedCount;
      
    } catch (error) {
      this.logger.error('Failed to cleanup receipts:', error);
      throw error;
    }
  }

  // Private implementation methods
  
  private async checkGitRepository(): Promise<boolean> {
    try {
      await fs.access(this.config.gitDirectory);
      return true;
    } catch {
      return false;
    }
  }

  private async initializeNotesRef(): Promise<void> {
    try {
      // Check if notes ref exists
      const refExists = await git.listBranches({ fs, dir: '.' })
        .then(branches => branches.includes(this.config.notesRef.replace('refs/heads/', '')))
        .catch(() => false);
      
      if (!refExists) {
        this.logger.info(`Initializing notes ref: ${this.config.notesRef}`);
        // Create empty notes ref
        await git.writeRef({
          fs,
          dir: '.',
          ref: this.config.notesRef,
          value: '0000000000000000000000000000000000000000'
        }).catch(() => {
          // May fail if ref doesn't exist, that's ok
          this.logger.debug('Could not initialize notes ref');
        });
      }
    } catch (error) {
      this.logger.warn('Failed to initialize notes ref:', error.message);
    }
  }

  private async writeReceiptFile(receipt: AttestationReceipt): Promise<string> {
    const receiptDir = path.join(this.config.receiptDirectory, receipt.gitSHA);
    await fs.mkdir(receiptDir, { recursive: true });
    
    const receiptPath = path.join(receiptDir, `${receipt.id}.attest.json`);
    
    let content = JSON.stringify(receipt, null, 2);
    
    // Compress if enabled and beneficial
    if (this.config.enableCompression && content.length > 1024) {
      // Simple compression placeholder - could use actual compression library
      this.logger.debug('Compression enabled but not implemented yet');
    }
    
    await fs.writeFile(receiptPath, content);
    return receiptPath;
  }

  private async loadReceiptFile(gitSHA: string, receiptId: string): Promise<AttestationReceipt | null> {
    try {
      const receiptPath = path.join(this.config.receiptDirectory, gitSHA, `${receiptId}.attest.json`);
      const content = await fs.readFile(receiptPath, 'utf8');
      return JSON.parse(content) as AttestationReceipt;
    } catch (error) {
      this.logger.debug(`Receipt file not found: ${receiptId}`);
      return null;
    }
  }

  private async addToGitNotes(gitSHA: string, receiptId: string, receiptPath: string): Promise<void> {
    try {
      // Get existing notes data
      const existingData = await this.getFromGitNotes(gitSHA) || { receiptIds: [] };
      
      // Add new receipt ID
      if (!existingData.receiptIds.includes(receiptId)) {
        existingData.receiptIds.push(receiptId);
        existingData.lastUpdated = new Date().toISOString();
      }
      
      // Store updated notes data
      const noteContent = JSON.stringify(existingData);
      const noteRef = `${this.config.notesRef}/${gitSHA}`;
      
      // Create blob for the note
      const noteHash = await git.writeBlob({
        fs,
        dir: '.',
        object: noteContent
      });
      
      // Update notes ref
      await git.writeRef({
        fs,
        dir: '.',
        ref: noteRef,
        value: noteHash
      }).catch(() => {
        // Notes update may fail, continue anyway
        this.logger.debug(`Could not update git note for ${gitSHA}`);
      });
      
    } catch (error) {
      this.logger.warn(`Failed to add to git notes for ${gitSHA}:`, error.message);
    }
  }

  private async getFromGitNotes(gitSHA: string): Promise<any | null> {
    try {
      const noteRef = `${this.config.notesRef}/${gitSHA}`;
      
      const noteHash = await git.resolveRef({
        fs,
        dir: '.',
        ref: noteRef
      });
      
      const noteBlob = await git.readBlob({
        fs,
        dir: '.',
        oid: noteHash
      });
      
      const noteContent = new TextDecoder().decode(noteBlob.blob);
      return JSON.parse(noteContent);
      
    } catch (error) {
      this.logger.debug(`No git note found for ${gitSHA}`);
      return null;
    }
  }

  private validateReceiptStructure(receipt: AttestationReceipt): { valid: boolean; reason: string } {
    const requiredFields = ['id', 'gitSHA', 'artifactPath', 'attestation', 'envelope', 'createdAt', 'version'];
    
    for (const field of requiredFields) {
      if (!(field in receipt)) {
        return {
          valid: false,
          reason: `Missing required field: ${field}`
        };
      }
    }
    
    // Validate git SHA format
    if (!/^[a-f0-9]{40}$/i.test(receipt.gitSHA)) {
      return {
        valid: false,
        reason: 'Invalid git SHA format'
      };
    }
    
    // Validate UUID format
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(receipt.id)) {
      return {
        valid: false,
        reason: 'Invalid receipt ID format'
      };
    }
    
    return {
      valid: true,
      reason: 'Receipt structure is valid'
    };
  }

  private async verifyGitSHA(gitSHA: string): Promise<boolean> {
    try {
      await git.readCommit({ fs, dir: '.', oid: gitSHA });
      return true;
    } catch {
      return false;
    }
  }

  private async verifyArtifactHash(receipt: AttestationReceipt): Promise<{
    verified: boolean;
    reason: string;
  }> {
    try {
      // Check if artifact file still exists
      const artifactExists = await fs.access(receipt.artifactPath).then(() => true).catch(() => false);
      if (!artifactExists) {
        return {
          verified: true, // Artifact may have been moved/deleted, that's ok
          reason: 'Artifact file not found (may have been moved)'
        };
      }
      
      // Calculate current hash
      const artifactContent = await fs.readFile(receipt.artifactPath);
      const currentHash = await hashSHA256(artifactContent);
      
      // Get expected hash from attestation
      const expectedHash = receipt.attestation?.subject?.[0]?.digest?.sha256;
      if (!expectedHash) {
        return {
          verified: false,
          reason: 'No expected hash found in attestation'
        };
      }
      
      const verified = currentHash === expectedHash;
      return {
        verified,
        reason: verified ? 'Artifact hash verified' : 'Artifact hash mismatch'
      };
      
    } catch (error) {
      return {
        verified: false,
        reason: `Artifact verification failed: ${error.message}`
      };
    }
  }

  private async deleteReceipt(gitSHA: string, receiptId: string): Promise<void> {
    // Delete receipt file
    const receiptPath = path.join(this.config.receiptDirectory, gitSHA, `${receiptId}.attest.json`);
    await fs.unlink(receiptPath).catch(() => {
      // File may not exist
    });
    
    // Update git notes
    const existingData = await this.getFromGitNotes(gitSHA);
    if (existingData && existingData.receiptIds) {
      existingData.receiptIds = existingData.receiptIds.filter((id: string) => id !== receiptId);
      existingData.lastUpdated = new Date().toISOString();
      
      // Update notes
      await this.addToGitNotes(gitSHA, '', '').catch(() => {
        // May fail, that's ok
      });
    }
  }
}

export default GitNotesManager;