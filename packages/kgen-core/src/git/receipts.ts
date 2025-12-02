/**
 * Git Receipts System
 * 
 * Writes receipts for every operation and stores them at refs/notes/kgen/receipts
 * Includes attestation pointers and operation metadata for full auditability
 */

import git from 'isomorphic-git';
import { createHash } from 'crypto';
import { EventEmitter } from 'events';

export interface OperationReceipt {
  id: string;
  timestamp: string;
  operation: string;
  operationVersion: string;
  commitHash?: string;
  parentCommit?: string;
  inputs: Record<string, any>;
  outputs: Record<string, any>;
  metadata: {
    duration?: number;
    fileCount?: number;
    byteSize?: number;
    checksums?: Record<string, string>;
    dependencies?: string[];
    environment?: Record<string, string>;
  };
  attestation?: {
    hash: string;
    signature?: string;
    algorithm?: string;
    publicKey?: string;
  };
  verification: {
    inputsValid: boolean;
    outputsValid: boolean;
    checksumValid: boolean;
    signatureValid?: boolean;
  };
  errors?: string[];
  warnings?: string[];
}

export interface ReceiptQuery {
  operation?: string;
  since?: Date;
  until?: Date;
  commitHash?: string;
  hasErrors?: boolean;
  verified?: boolean;
  limit?: number;
  offset?: number;
}

export interface ReceiptConfig {
  gitDir: string;
  fs: any;
  notesRef?: string;
  enableSigning?: boolean;
  enableVerification?: boolean;
  compressionLevel?: number;
  retentionDays?: number;
}

export class GitReceipts extends EventEmitter {
  private config: Required<ReceiptConfig>;
  private receiptsCache: Map<string, OperationReceipt>;
  private stats: {
    receiptsWritten: number;
    receiptsRead: number;
    verificationsPassed: number;
    verificationsFailed: number;
    bytesStored: number;
  };

  constructor(config: ReceiptConfig) {
    super();
    
    this.config = {
      gitDir: config.gitDir || process.cwd() + '/.git',
      fs: config.fs,
      notesRef: config.notesRef || 'refs/notes/kgen/receipts',
      enableSigning: config.enableSigning ?? true,
      enableVerification: config.enableVerification ?? true,
      compressionLevel: config.compressionLevel ?? 6,
      retentionDays: config.retentionDays ?? 365
    };

    this.receiptsCache = new Map();
    this.stats = {
      receiptsWritten: 0,
      receiptsRead: 0,
      verificationsPassed: 0,
      verificationsFailed: 0,
      bytesStored: 0
    };
  }

  /**
   * Initialize the receipts system (optional method for consistency)
   */
  async initialize?(): Promise<void> {
    try {
      // Ensure git repository exists
      await this.ensureGitRepository();
      this.emit('receipts-initialized');
    } catch (error) {
      this.emit('receipts-error', { operation: 'initialize', error });
      throw error;
    }
  }

  /**
   * Write receipt for an operation
   */
  async writeReceipt(
    operation: string,
    inputs: Record<string, any>,
    outputs: Record<string, any>,
    options: {
      commitHash?: string;
      parentCommit?: string;
      metadata?: Record<string, any>;
      duration?: number;
      errors?: string[];
      warnings?: string[];
      skipVerification?: boolean;
    } = {}
  ): Promise<OperationReceipt> {
    try {
      const timestamp = new Date().toISOString();
      const receiptId = this.generateReceiptId(operation, timestamp, inputs);

      // Calculate metadata
      const metadata = {
        duration: options.duration || 0,
        fileCount: this.countFiles(outputs),
        byteSize: this.calculateByteSize(outputs),
        checksums: await this.calculateChecksums(outputs),
        dependencies: options.metadata?.dependencies || [],
        environment: this.getEnvironmentInfo(),
        ...options.metadata
      };

      // Create receipt
      const receipt: OperationReceipt = {
        id: receiptId,
        timestamp,
        operation,
        operationVersion: '1.0',
        commitHash: options.commitHash,
        parentCommit: options.parentCommit,
        inputs,
        outputs,
        metadata,
        verification: {
          inputsValid: true,
          outputsValid: true,
          checksumValid: true
        },
        errors: options.errors || [],
        warnings: options.warnings || []
      };

      // Verify receipt if enabled
      if (this.config.enableVerification && !options.skipVerification) {
        await this.verifyReceipt(receipt);
      }

      // Add attestation if signing enabled
      if (this.config.enableSigning) {
        receipt.attestation = await this.createAttestation(receipt);
        receipt.verification.signatureValid = await this.verifyAttestation(receipt.attestation);
      }

      // Store receipt in git notes
      await this.storeReceiptInNotes(receipt);

      // Cache receipt
      this.receiptsCache.set(receiptId, receipt);
      
      this.stats.receiptsWritten++;
      this.emit('receipt-written', { receipt, operation });

      return receipt;
    } catch (error) {
      this.emit('receipt-error', { operation: 'write', error });
      throw error;
    }
  }

  /**
   * Read receipt by ID
   */
  async readReceipt(receiptId: string): Promise<OperationReceipt | null> {
    try {
      // Check cache first
      if (this.receiptsCache.has(receiptId)) {
        return this.receiptsCache.get(receiptId)!;
      }

      // Find receipt in git notes
      const receipt = await this.findReceiptInNotes(receiptId);
      if (receipt) {
        this.receiptsCache.set(receiptId, receipt);
        this.stats.receiptsRead++;
      }

      return receipt;
    } catch (error) {
      this.emit('receipt-error', { operation: 'read', error });
      throw error;
    }
  }

  /**
   * Query receipts with filters
   */
  async queryReceipts(query: ReceiptQuery = {}): Promise<OperationReceipt[]> {
    try {
      const allReceipts = await this.getAllReceipts();
      let filteredReceipts = allReceipts;

      // Apply filters
      if (query.operation) {
        filteredReceipts = filteredReceipts.filter(r => r.operation === query.operation);
      }

      if (query.since) {
        filteredReceipts = filteredReceipts.filter(r => new Date(r.timestamp) >= query.since!);
      }

      if (query.until) {
        filteredReceipts = filteredReceipts.filter(r => new Date(r.timestamp) <= query.until!);
      }

      if (query.commitHash) {
        filteredReceipts = filteredReceipts.filter(r => r.commitHash === query.commitHash);
      }

      if (query.hasErrors !== undefined) {
        filteredReceipts = filteredReceipts.filter(r => 
          query.hasErrors ? (r.errors && r.errors.length > 0) : (!r.errors || r.errors.length === 0)
        );
      }

      if (query.verified !== undefined) {
        filteredReceipts = filteredReceipts.filter(r => 
          this.isReceiptVerified(r) === query.verified
        );
      }

      // Sort by timestamp (newest first)
      filteredReceipts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      // Apply pagination
      if (query.offset) {
        filteredReceipts = filteredReceipts.slice(query.offset);
      }
      if (query.limit) {
        filteredReceipts = filteredReceipts.slice(0, query.limit);
      }

      return filteredReceipts;
    } catch (error) {
      this.emit('receipt-error', { operation: 'query', error });
      throw error;
    }
  }

  /**
   * Get all receipts from git notes
   */
  async getAllReceipts(): Promise<OperationReceipt[]> {
    try {
      const receipts: OperationReceipt[] = [];
      const notesMap = await this.getAllReceiptNotes();

      for (const [objectHash, noteContent] of notesMap) {
        try {
          const receiptData = JSON.parse(noteContent);
          
          // Handle both single receipts and arrays
          const receiptList = Array.isArray(receiptData) ? receiptData : [receiptData];
          
          for (const receipt of receiptList) {
            if (this.isValidReceipt(receipt)) {
              receipts.push(receipt as OperationReceipt);
            }
          }
        } catch (parseError) {
          this.emit('receipt-warning', {
            message: `Failed to parse receipt for ${objectHash}`,
            error: parseError
          });
        }
      }

      return receipts;
    } catch (error) {
      this.emit('receipt-error', { operation: 'get-all', error });
      throw error;
    }
  }

  /**
   * Verify receipt integrity
   */
  async verifyReceipt(receipt: OperationReceipt): Promise<boolean> {
    try {
      let isValid = true;

      // Verify inputs
      receipt.verification.inputsValid = await this.verifyInputs(receipt.inputs);
      if (!receipt.verification.inputsValid) isValid = false;

      // Verify outputs
      receipt.verification.outputsValid = await this.verifyOutputs(receipt.outputs);
      if (!receipt.verification.outputsValid) isValid = false;

      // Verify checksums
      const currentChecksums = await this.calculateChecksums(receipt.outputs);
      receipt.verification.checksumValid = this.compareChecksums(
        receipt.metadata.checksums || {}, 
        currentChecksums
      );
      if (!receipt.verification.checksumValid) isValid = false;

      // Verify attestation if present
      if (receipt.attestation) {
        receipt.verification.signatureValid = await this.verifyAttestation(receipt.attestation);
        if (!receipt.verification.signatureValid) isValid = false;
      }

      if (isValid) {
        this.stats.verificationsPassed++;
      } else {
        this.stats.verificationsFailed++;
      }

      this.emit('receipt-verified', { receipt, isValid });
      return isValid;
    } catch (error) {
      this.emit('receipt-error', { operation: 'verify', error });
      return false;
    }
  }

  /**
   * Store receipt in git notes
   */
  private async storeReceiptInNotes(receipt: OperationReceipt): Promise<void> {
    try {
      const workingDir = this.config.gitDir.replace('/.git', '');
      
      // Use receipt ID as the note object hash for easy lookup
      const noteObjectHash = receipt.id;
      const receiptContent = JSON.stringify(receipt, null, 2);

      // Write receipt as blob
      const receiptBlob = await git.writeBlob({
        fs: this.config.fs,
        dir: workingDir,
        blob: Buffer.from(receiptContent, 'utf8')
      });

      // Store in git notes structure
      await this.writeGitNote(noteObjectHash, receiptContent);

      this.stats.bytesStored += Buffer.byteLength(receiptContent, 'utf8');
    } catch (error) {
      throw new Error(`Failed to store receipt in notes: ${error.message}`);
    }
  }

  /**
   * Find receipt in git notes
   */
  private async findReceiptInNotes(receiptId: string): Promise<OperationReceipt | null> {
    try {
      const noteContent = await this.readGitNote(receiptId);
      if (!noteContent) {
        return null;
      }

      const receipt = JSON.parse(noteContent);
      return this.isValidReceipt(receipt) ? receipt : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Write git note
   */
  private async writeGitNote(objectHash: string, content: string): Promise<void> {
    try {
      const workingDir = this.config.gitDir.replace('/.git', '');

      // Write content as blob
      const blob = await git.writeBlob({
        fs: this.config.fs,
        dir: workingDir,
        blob: Buffer.from(content, 'utf8')
      });

      // Create tree structure
      const treeEntries = [{
        mode: '100644',
        path: objectHash,
        oid: blob,
        type: 'blob' as const
      }];

      // Get existing notes tree
      try {
        const currentNotesCommit = await git.resolveRef({
          fs: this.config.fs,
          dir: workingDir,
          ref: this.config.notesRef
        });

        const { object: currentCommit } = await git.readCommit({
          fs: this.config.fs,
          dir: workingDir,
          oid: currentNotesCommit
        });

        const existingTree = await git.readTree({
          fs: this.config.fs,
          dir: workingDir,
          oid: currentCommit.tree
        });

        // Add existing entries (except the one we're updating)
        for (const entry of existingTree.tree) {
          if (entry.path !== objectHash) {
            treeEntries.push(entry);
          }
        }
      } catch (error) {
        // Notes ref doesn't exist yet
      }

      // Write tree
      const tree = await git.writeTree({
        fs: this.config.fs,
        dir: workingDir,
        tree: treeEntries
      });

      // Get parent commits
      let parents: string[] = [];
      try {
        const parentRef = await git.resolveRef({
          fs: this.config.fs,
          dir: workingDir,
          ref: this.config.notesRef
        });
        parents = [parentRef];
      } catch (error) {
        // No parent (first notes commit)
      }

      // Create commit
      const commit = await git.commit({
        fs: this.config.fs,
        dir: workingDir,
        message: `Add receipt ${objectHash}`,
        tree,
        parent: parents,
        author: {
          name: 'KGEN-Receipts',
          email: 'receipts@kgen.local',
          timestamp: Math.floor(Date.now() / 1000),
          timezoneOffset: 0
        },
        committer: {
          name: 'KGEN-Receipts', 
          email: 'receipts@kgen.local',
          timestamp: Math.floor(Date.now() / 1000),
          timezoneOffset: 0
        }
      });

      // Update notes ref
      await git.writeRef({
        fs: this.config.fs,
        dir: workingDir,
        ref: this.config.notesRef,
        value: commit
      });
    } catch (error) {
      throw new Error(`Failed to write git note: ${error.message}`);
    }
  }

  /**
   * Read git note
   */
  private async readGitNote(objectHash: string): Promise<string | null> {
    try {
      const workingDir = this.config.gitDir.replace('/.git', '');

      // Resolve notes ref
      const notesCommit = await git.resolveRef({
        fs: this.config.fs,
        dir: workingDir,
        ref: this.config.notesRef
      });

      // Read commit
      const { object: commit } = await git.readCommit({
        fs: this.config.fs,
        dir: workingDir,
        oid: notesCommit
      });

      // Read tree
      const { tree } = await git.readTree({
        fs: this.config.fs,
        dir: workingDir,
        oid: commit.tree
      });

      // Find note entry
      const noteEntry = tree.find(entry => entry.path === objectHash);
      if (!noteEntry) {
        return null;
      }

      // Read blob
      const { blob } = await git.readBlob({
        fs: this.config.fs,
        dir: workingDir,
        oid: noteEntry.oid
      });

      return blob.toString('utf8');
    } catch (error) {
      if (error.code === 'NotFoundError') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Get all receipt notes
   */
  private async getAllReceiptNotes(): Promise<Map<string, string>> {
    try {
      const notes = new Map();
      const workingDir = this.config.gitDir.replace('/.git', '');

      // Resolve notes ref
      const notesCommit = await git.resolveRef({
        fs: this.config.fs,
        dir: workingDir,
        ref: this.config.notesRef
      });

      // Read commit
      const { object: commit } = await git.readCommit({
        fs: this.config.fs,
        dir: workingDir,
        oid: notesCommit
      });

      // Read tree
      const { tree } = await git.readTree({
        fs: this.config.fs,
        dir: workingDir,
        oid: commit.tree
      });

      // Read all blobs
      for (const entry of tree) {
        if (entry.type === 'blob') {
          const { blob } = await git.readBlob({
            fs: this.config.fs,
            dir: workingDir,
            oid: entry.oid
          });
          notes.set(entry.path, blob.toString('utf8'));
        }
      }

      return notes;
    } catch (error) {
      if (error.code === 'NotFoundError') {
        return new Map();
      }
      throw error;
    }
  }

  /**
   * Generate receipt ID
   */
  private generateReceiptId(operation: string, timestamp: string, inputs: Record<string, any>): string {
    const data = `${operation}:${timestamp}:${JSON.stringify(inputs)}`;
    return createHash('sha256').update(data).digest('hex').substring(0, 16);
  }

  /**
   * Create attestation for receipt
   */
  private async createAttestation(receipt: OperationReceipt): Promise<OperationReceipt['attestation']> {
    try {
      // Create hash of receipt data (excluding attestation)
      const { attestation, ...receiptData } = receipt;
      const receiptHash = createHash('sha256')
        .update(JSON.stringify(receiptData, Object.keys(receiptData).sort()))
        .digest('hex');

      // Create signature (simplified - in production use proper cryptographic signing)
      const signature = createHash('sha256')
        .update(`${receiptHash}:kgen-secret`)
        .digest('hex');

      return {
        hash: receiptHash,
        signature,
        algorithm: 'SHA256-HMAC',
        publicKey: 'kgen-default-key'
      };
    } catch (error) {
      throw new Error(`Failed to create attestation: ${error.message}`);
    }
  }

  /**
   * Verify attestation
   */
  private async verifyAttestation(attestation: OperationReceipt['attestation']): Promise<boolean> {
    if (!attestation) return false;

    try {
      // Recreate signature and compare
      const expectedSignature = createHash('sha256')
        .update(`${attestation.hash}:kgen-secret`)
        .digest('hex');

      return attestation.signature === expectedSignature;
    } catch (error) {
      return false;
    }
  }

  /**
   * Verify inputs
   */
  private async verifyInputs(inputs: Record<string, any>): Promise<boolean> {
    // Basic validation - check that inputs are not empty and have expected structure
    return inputs && typeof inputs === 'object' && Object.keys(inputs).length > 0;
  }

  /**
   * Verify outputs
   */
  private async verifyOutputs(outputs: Record<string, any>): Promise<boolean> {
    // Basic validation - check that outputs are not empty and have expected structure
    return outputs && typeof outputs === 'object';
  }

  /**
   * Calculate checksums for outputs
   */
  private async calculateChecksums(outputs: Record<string, any>): Promise<Record<string, string>> {
    const checksums: Record<string, string> = {};

    for (const [key, value] of Object.entries(outputs)) {
      if (typeof value === 'string') {
        checksums[key] = createHash('sha256').update(value).digest('hex');
      } else {
        checksums[key] = createHash('sha256').update(JSON.stringify(value)).digest('hex');
      }
    }

    return checksums;
  }

  /**
   * Compare checksums
   */
  private compareChecksums(expected: Record<string, string>, actual: Record<string, string>): boolean {
    const expectedKeys = Object.keys(expected).sort();
    const actualKeys = Object.keys(actual).sort();

    if (expectedKeys.length !== actualKeys.length) return false;
    if (!expectedKeys.every(key => actualKeys.includes(key))) return false;

    return expectedKeys.every(key => expected[key] === actual[key]);
  }

  /**
   * Count files in outputs
   */
  private countFiles(outputs: Record<string, any>): number {
    let count = 0;
    for (const value of Object.values(outputs)) {
      if (typeof value === 'string' && value.includes('\n')) {
        count++; // Assume multiline strings are file contents
      } else if (Array.isArray(value)) {
        count += value.length;
      }
    }
    return count;
  }

  /**
   * Calculate byte size of outputs
   */
  private calculateByteSize(outputs: Record<string, any>): number {
    const serialized = JSON.stringify(outputs);
    return Buffer.byteLength(serialized, 'utf8');
  }

  /**
   * Get environment information
   */
  private getEnvironmentInfo(): Record<string, string> {
    return {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      cwd: process.cwd(),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Check if receipt is verified
   */
  private isReceiptVerified(receipt: OperationReceipt): boolean {
    const verification = receipt.verification;
    return verification.inputsValid && 
           verification.outputsValid && 
           verification.checksumValid &&
           (verification.signatureValid !== false);
  }

  /**
   * Validate receipt structure
   */
  private isValidReceipt(receipt: any): receipt is OperationReceipt {
    return receipt && 
           typeof receipt === 'object' &&
           receipt.id &&
           receipt.timestamp &&
           receipt.operation &&
           receipt.inputs &&
           receipt.outputs &&
           receipt.verification;
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      ...this.stats,
      cacheSize: this.receiptsCache.size,
      avgBytesPerReceipt: this.stats.receiptsWritten > 0 ? 
        Math.round(this.stats.bytesStored / this.stats.receiptsWritten) : 0
    };
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.receiptsCache.clear();
  }

  /**
   * Ensure git repository exists
   */
  private async ensureGitRepository(): Promise<void> {
    try {
      const workingDir = this.config.gitDir.replace('/.git', '');
      
      // Check if .git directory exists
      try {
        await this.config.fs.access(this.config.gitDir);
      } catch (error) {
        // Initialize git repository
        await git.init({
          fs: this.config.fs,
          dir: workingDir,
          bare: false
        });
      }
    } catch (error) {
      throw new Error(`Failed to ensure git repository: ${error.message}`);
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    this.clearCache();
    this.removeAllListeners();
  }
}

/**
 * Create git receipts instance
 */
export function createGitReceipts(config: ReceiptConfig): GitReceipts {
  return new GitReceipts(config);
}

export default GitReceipts;