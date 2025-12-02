/**
 * Simple Git Receipts System
 * 
 * Writes receipts for every operation and stores them at refs/notes/kgen/receipts
 */

import git from 'isomorphic-git';
import { createHash } from 'crypto';
import { EventEmitter } from 'events';

export interface SimpleReceipt {
  id: string;
  timestamp: string;
  operation: string;
  inputs: Record<string, any>;
  outputs: Record<string, any>;
  metadata: {
    duration?: number;
    fileCount?: number;
    byteSize?: number;
    checksums?: Record<string, string>;
  };
  verification: {
    inputsValid: boolean;
    outputsValid: boolean;
    checksumValid: boolean;
  };
  errors?: string[];
}

export interface ReceiptConfig {
  gitDir: string;
  fs: any;
  notesRef?: string;
  enableVerification?: boolean;
}

export class SimpleReceipts extends EventEmitter {
  private config: Required<ReceiptConfig>;
  private receipts: Map<string, SimpleReceipt>;

  constructor(config: ReceiptConfig) {
    super();
    
    this.config = {
      gitDir: config.gitDir || process.cwd() + '/.git',
      fs: config.fs,
      notesRef: config.notesRef || 'refs/notes/kgen/receipts',
      enableVerification: config.enableVerification ?? true
    };

    this.receipts = new Map();
  }

  /**
   * Initialize receipts system
   */
  async initialize(): Promise<void> {
    try {
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
      metadata?: Record<string, any>;
      duration?: number;
      errors?: string[];
    } = {}
  ): Promise<SimpleReceipt> {
    try {
      const timestamp = new Date().toISOString();
      const receiptId = this.generateReceiptId(operation, timestamp, inputs);

      // Calculate metadata
      const metadata = {
        duration: options.duration || 0,
        fileCount: this.countFiles(outputs),
        byteSize: this.calculateByteSize(outputs),
        checksums: await this.calculateChecksums(outputs),
        ...options.metadata
      };

      // Create receipt
      const receipt: SimpleReceipt = {
        id: receiptId,
        timestamp,
        operation,
        inputs,
        outputs,
        metadata,
        verification: {
          inputsValid: true,
          outputsValid: true,
          checksumValid: true
        },
        errors: options.errors || []
      };

      // Verify receipt if enabled
      if (this.config.enableVerification) {
        await this.verifyReceipt(receipt);
      }

      // Store receipt
      this.receipts.set(receiptId, receipt);
      await this.storeReceiptInNotes(receipt);

      this.emit('receipt-written', { receipt, operation });
      return receipt;
    } catch (error) {
      this.emit('receipts-error', { operation: 'write', error });
      throw error;
    }
  }

  /**
   * Read receipt by ID
   */
  async readReceipt(receiptId: string): Promise<SimpleReceipt | null> {
    try {
      // Check cache first
      if (this.receipts.has(receiptId)) {
        return this.receipts.get(receiptId)!;
      }

      // Load from git notes if not in cache
      if (this.receipts.size === 0) {
        await this.loadReceiptsFromNotes();
        return this.receipts.get(receiptId) || null;
      }

      return null;
    } catch (error) {
      this.emit('receipts-error', { operation: 'read', error });
      return null;
    }
  }

  /**
   * Query receipts
   */
  async queryReceipts(filters: {
    operation?: string;
    since?: Date;
    until?: Date;
    hasErrors?: boolean;
    limit?: number;
  } = {}): Promise<SimpleReceipt[]> {
    try {
      // Load all receipts if cache is empty
      if (this.receipts.size === 0) {
        await this.loadReceiptsFromNotes();
      }

      let results = Array.from(this.receipts.values());

      // Apply filters
      if (filters.operation) {
        results = results.filter(r => r.operation === filters.operation);
      }

      if (filters.since) {
        results = results.filter(r => new Date(r.timestamp) >= filters.since!);
      }

      if (filters.until) {
        results = results.filter(r => new Date(r.timestamp) <= filters.until!);
      }

      if (filters.hasErrors !== undefined) {
        results = results.filter(r => 
          filters.hasErrors ? (r.errors && r.errors.length > 0) : (!r.errors || r.errors.length === 0)
        );
      }

      // Sort by timestamp (newest first)
      results.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      // Apply limit
      if (filters.limit) {
        results = results.slice(0, filters.limit);
      }

      return results;
    } catch (error) {
      this.emit('receipts-error', { operation: 'query', error });
      throw error;
    }
  }

  /**
   * Get all receipts
   */
  async getAllReceipts(): Promise<SimpleReceipt[]> {
    return this.queryReceipts();
  }

  /**
   * Store receipt in git notes
   */
  private async storeReceiptInNotes(receipt: SimpleReceipt): Promise<void> {
    try {
      const workingDir = this.config.gitDir.replace('/.git', '');
      
      // Serialize receipt
      const receiptContent = JSON.stringify(receipt, null, 2);
      
      // Write as blob
      const receiptBlob = await git.writeBlob({
        fs: this.config.fs,
        dir: workingDir,
        blob: Buffer.from(receiptContent, 'utf8')
      });

      // Create tree structure
      const noteKey = `receipt-${receipt.id}`;
      const treeEntries = [{
        mode: '100644',
        path: noteKey,
        oid: receiptBlob,
        type: 'blob' as const
      }];

      // Get existing notes tree
      try {
        const notesRef = await git.resolveRef({
          fs: this.config.fs,
          dir: workingDir,
          ref: this.config.notesRef
        });

        const notesCommit = await git.readCommit({
          fs: this.config.fs,
          dir: workingDir,
          oid: notesRef
        });

        const existingTree = await git.readTree({
          fs: this.config.fs,
          dir: workingDir,
          oid: notesCommit.commit.tree
        });

        // Add existing entries except the one we're updating
        for (const treeEntry of existingTree.tree) {
          if (treeEntry.path !== noteKey && treeEntry.type === 'blob') {
            treeEntries.push({
              mode: treeEntry.mode,
              path: treeEntry.path,
              oid: treeEntry.oid,
              type: 'blob' as const
            });
          }
        }
      } catch (error) {
        // Notes ref doesn't exist yet
      }

      // Write tree
      const treeHash = await git.writeTree({
        fs: this.config.fs,
        dir: workingDir,
        tree: treeEntries
      });

      // Get parent commit
      let parents: string[] = [];
      try {
        const parentRef = await git.resolveRef({
          fs: this.config.fs,
          dir: workingDir,
          ref: this.config.notesRef
        });
        parents = [parentRef];
      } catch (error) {
        // No parent
      }

      // Create commit
      const commitHash = await git.commit({
        fs: this.config.fs,
        dir: workingDir,
        message: `Add receipt: ${receipt.operation}`,
        tree: treeHash,
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
        value: commitHash
      });
    } catch (error) {
      throw new Error(`Failed to store receipt in notes: ${error.message}`);
    }
  }

  /**
   * Load receipts from git notes
   */
  private async loadReceiptsFromNotes(): Promise<void> {
    try {
      const workingDir = this.config.gitDir.replace('/.git', '');

      // Get notes ref
      const notesRef = await git.resolveRef({
        fs: this.config.fs,
        dir: workingDir,
        ref: this.config.notesRef
      });

      // Read commit
      const notesCommit = await git.readCommit({
        fs: this.config.fs,
        dir: workingDir,
        oid: notesRef
      });

      // Read tree
      const notesTree = await git.readTree({
        fs: this.config.fs,
        dir: workingDir,
        oid: notesCommit.commit.tree
      });

      // Load all receipts
      for (const treeEntry of notesTree.tree) {
        if (treeEntry.type === 'blob' && treeEntry.path.startsWith('receipt-')) {
          try {
            const blobResult = await git.readBlob({
              fs: this.config.fs,
              dir: workingDir,
              oid: treeEntry.oid
            });

            const receipt: SimpleReceipt = JSON.parse(new TextDecoder().decode(blobResult.blob));
            this.receipts.set(receipt.id, receipt);
          } catch (parseError) {
            // Skip invalid receipts
          }
        }
      }
    } catch (error) {
      if (error.code !== 'NotFoundError') {
        throw error;
      }
      // Notes don't exist yet
    }
  }

  /**
   * Verify receipt
   */
  private async verifyReceipt(receipt: SimpleReceipt): Promise<void> {
    // Basic verification
    receipt.verification.inputsValid = !!(receipt.inputs && typeof receipt.inputs === 'object');
    receipt.verification.outputsValid = !!(receipt.outputs && typeof receipt.outputs === 'object');
    
    // Verify checksums
    const currentChecksums = await this.calculateChecksums(receipt.outputs);
    receipt.verification.checksumValid = this.compareChecksums(
      receipt.metadata.checksums || {},
      currentChecksums
    );
  }

  /**
   * Generate receipt ID
   */
  private generateReceiptId(operation: string, timestamp: string, inputs: Record<string, any>): string {
    const data = `${operation}:${timestamp}:${JSON.stringify(inputs)}`;
    return createHash('sha256').update(data).digest('hex').substring(0, 16);
  }

  /**
   * Calculate checksums
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
        count++;
      } else if (Array.isArray(value)) {
        count += value.length;
      }
    }
    return count;
  }

  /**
   * Calculate byte size
   */
  private calculateByteSize(outputs: Record<string, any>): number {
    const serialized = JSON.stringify(outputs);
    return Buffer.byteLength(serialized, 'utf8');
  }

  /**
   * Ensure git repository exists
   */
  private async ensureGitRepository(): Promise<void> {
    try {
      const workingDir = this.config.gitDir.replace('/.git', '');
      
      try {
        await this.config.fs.access(this.config.gitDir);
      } catch (error) {
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
   * Get statistics
   */
  getStats() {
    return {
      receiptsCount: this.receipts.size,
      operations: Array.from(new Set(Array.from(this.receipts.values()).map(r => r.operation))),
      avgBytesPerReceipt: this.receipts.size > 0 ? 
        Array.from(this.receipts.values()).reduce((sum, r) => sum + r.metadata.byteSize, 0) / this.receipts.size : 0
    };
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.receipts.clear();
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
 * Create simple receipts instance
 */
export function createSimpleReceipts(config: ReceiptConfig): SimpleReceipts {
  return new SimpleReceipts(config);
}

export default SimpleReceipts;