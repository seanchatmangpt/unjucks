/**
 * Simplified Git-based Ledger System
 * 
 * A working implementation that uses git as a ledger where:
 * - Commits are anchors for operations  
 * - Git notes store receipts and attestations
 * - Tags pin releases and major milestones
 * - All state is stored in git for auditability
 */

import git from 'isomorphic-git';
import { createHash } from 'crypto';
import { EventEmitter } from 'events';

export interface LedgerEntry {
  id: string;
  timestamp: string;
  operation: string;
  commitHash?: string;
  metadata: Record<string, any>;
  receipt?: any;
}

export interface LedgerConfig {
  gitDir: string;
  fs: any;
  notesRef?: string;
  enableSigning?: boolean;
}

export class SimpleLedger extends EventEmitter {
  private config: Required<LedgerConfig>;
  private entries: Map<string, LedgerEntry>;

  constructor(config: LedgerConfig) {
    super();
    
    this.config = {
      gitDir: config.gitDir || process.cwd() + '/.git',
      fs: config.fs,
      notesRef: config.notesRef || 'refs/notes/kgen/ledger',
      enableSigning: config.enableSigning ?? true
    };

    this.entries = new Map();
  }

  /**
   * Initialize the git ledger
   */
  async initialize(): Promise<void> {
    try {
      await this.ensureGitRepository();
      this.emit('ledger-initialized');
    } catch (error) {
      this.emit('ledger-error', { operation: 'initialize', error });
      throw error;
    }
  }

  /**
   * Record an operation as a ledger entry
   */
  async recordOperation(
    operation: string,
    metadata: Record<string, any>,
    options: {
      message?: string;
      receipt?: any;
    } = {}
  ): Promise<LedgerEntry> {
    try {
      const timestamp = new Date().toISOString();
      const entryId = this.generateEntryId(operation, timestamp, metadata);

      // Create entry
      const entry: LedgerEntry = {
        id: entryId,
        timestamp,
        operation,
        metadata,
        receipt: options.receipt
      };

      // Try to get current commit
      try {
        const workingDir = this.config.gitDir.replace('/.git', '');
        entry.commitHash = await git.resolveRef({
          fs: this.config.fs,
          dir: workingDir,
          ref: 'HEAD'
        });
      } catch (error) {
        // No commit available yet
      }

      // Store in memory cache
      this.entries.set(entryId, entry);

      // Store in git notes
      await this.storeEntryInNotes(entry);

      this.emit('operation-recorded', { entry });
      return entry;
    } catch (error) {
      this.emit('ledger-error', { operation: 'record', error });
      throw error;
    }
  }

  /**
   * Get all entries
   */
  async getAllEntries(): Promise<LedgerEntry[]> {
    try {
      // Load from git notes if cache is empty
      if (this.entries.size === 0) {
        await this.loadEntriesFromNotes();
      }

      return Array.from(this.entries.values())
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    } catch (error) {
      this.emit('ledger-error', { operation: 'get-all', error });
      throw error;
    }
  }

  /**
   * Get entries by operation
   */
  async getEntriesByOperation(operation: string): Promise<LedgerEntry[]> {
    const allEntries = await this.getAllEntries();
    return allEntries.filter(entry => entry.operation === operation);
  }

  /**
   * Store entry in git notes
   */
  private async storeEntryInNotes(entry: LedgerEntry): Promise<void> {
    try {
      const workingDir = this.config.gitDir.replace('/.git', '');
      
      // Serialize entry
      const entryContent = JSON.stringify(entry, null, 2);
      
      // Write as blob
      const entryBlob = await git.writeBlob({
        fs: this.config.fs,
        dir: workingDir,
        blob: Buffer.from(entryContent, 'utf8')
      });

      // Create tree structure for notes
      const noteKey = `entry-${entry.id}`;
      const treeEntries = [{
        mode: '100644',
        path: noteKey,
        oid: entryBlob,
        type: 'blob' as const
      }];

      // Get existing notes tree if it exists
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
        message: `Add ledger entry: ${entry.operation}`,
        tree: treeHash,
        parent: parents,
        author: {
          name: 'KGEN-Ledger',
          email: 'ledger@kgen.local',
          timestamp: Math.floor(Date.now() / 1000),
          timezoneOffset: 0
        },
        committer: {
          name: 'KGEN-Ledger',
          email: 'ledger@kgen.local', 
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
      throw new Error(`Failed to store entry in notes: ${error.message}`);
    }
  }

  /**
   * Load entries from git notes
   */
  private async loadEntriesFromNotes(): Promise<void> {
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

      // Load all entries
      for (const treeEntry of notesTree.tree) {
        if (treeEntry.type === 'blob' && treeEntry.path.startsWith('entry-')) {
          try {
            const blobResult = await git.readBlob({
              fs: this.config.fs,
              dir: workingDir,
              oid: treeEntry.oid
            });

            const entry: LedgerEntry = JSON.parse(new TextDecoder().decode(blobResult.blob));
            this.entries.set(entry.id, entry);
          } catch (parseError) {
            // Skip invalid entries
          }
        }
      }
    } catch (error) {
      if (error.code !== 'NotFoundError') {
        throw error;
      }
      // Notes don't exist yet, which is fine
    }
  }

  /**
   * Generate entry ID
   */
  private generateEntryId(operation: string, timestamp: string, metadata: Record<string, any>): string {
    const data = `${operation}:${timestamp}:${JSON.stringify(metadata)}`;
    return createHash('sha256').update(data).digest('hex').substring(0, 16);
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
      entriesCount: this.entries.size,
      operations: Array.from(new Set(Array.from(this.entries.values()).map(e => e.operation)))
    };
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.entries.clear();
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
 * Create simple ledger instance
 */
export function createSimpleLedger(config: LedgerConfig): SimpleLedger {
  return new SimpleLedger(config);
}

export default SimpleLedger;