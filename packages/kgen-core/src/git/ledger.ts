/**
 * Git-based Ledger System
 * 
 * Implements a git-based ledger where:
 * - Commits are anchors for operations
 * - Git notes store receipts and attestations
 * - Tags pin releases and major milestones
 * - All state is stored in git for auditability
 */

import git from 'isomorphic-git';
import { createHash } from 'crypto';
import { EventEmitter } from 'events';
import { GitNotesManager } from './notes.js';

export interface LedgerEntry {
  id: string;
  timestamp: string;
  operation: string;
  commitHash: string;
  parentCommit?: string;
  metadata: Record<string, any>;
  attestationRef?: string;
  receiptRef?: string;
  tags?: string[];
}

export interface LedgerCommit {
  hash: string;
  timestamp: string;
  message: string;
  author: {
    name: string;
    email: string;
  };
  tree: string;
  parents: string[];
  operations: LedgerEntry[];
}

export interface LedgerConfig {
  gitDir: string;
  fs: any;
  notesRef?: string;
  ledgerRef?: string;
  enableSigning?: boolean;
  autoCommit?: boolean;
  compression?: boolean;
}

export class GitLedger extends EventEmitter {
  private config: Required<LedgerConfig>;
  private notesManager: GitNotesManager;
  private entriesCache: Map<string, LedgerEntry>;
  private stats: {
    entriesAdded: number;
    commitsCreated: number;
    receiptsStored: number;
    tagsCreated: number;
  };

  constructor(config: LedgerConfig) {
    super();
    
    this.config = {
      gitDir: config.gitDir || process.cwd() + '/.git',
      fs: config.fs,
      notesRef: config.notesRef || 'refs/notes/kgen/receipts',
      ledgerRef: config.ledgerRef || 'refs/heads/kgen-ledger',
      enableSigning: config.enableSigning ?? true,
      autoCommit: config.autoCommit ?? true,
      compression: config.compression ?? true
    };

    this.notesManager = new GitNotesManager({
      gitDir: this.config.gitDir,
      fs: this.config.fs,
      notesRef: this.config.notesRef,
      enableSignature: this.config.enableSigning
    });

    this.entriesCache = new Map();
    this.stats = {
      entriesAdded: 0,
      commitsCreated: 0,
      receiptsStored: 0,
      tagsCreated: 0
    };
  }

  /**
   * Initialize the git ledger
   */
  async initialize(): Promise<void> {
    try {
      // Ensure git directory exists
      await this.ensureGitRepository();
      
      // Initialize ledger branch if it doesn't exist
      await this.initializeLedgerBranch();
      
      // Initialize notes manager
      await this.notesManager.initialize?.();
      
      this.emit('ledger-initialized', { config: this.config });
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
      author?: { name: string; email: string };
      tags?: string[];
      receipt?: any;
    } = {}
  ): Promise<LedgerEntry> {
    try {
      const timestamp = new Date().toISOString();
      const entryId = this.generateEntryId(operation, timestamp, metadata);

      // Create commit for this operation
      const commitHash = await this.createOperationCommit(
        operation,
        metadata,
        options.message || `KGEN: ${operation}`,
        options.author
      );

      // Create ledger entry
      const entry: LedgerEntry = {
        id: entryId,
        timestamp,
        operation,
        commitHash,
        metadata,
        tags: options.tags || []
      };

      // Store receipt in git notes if provided
      if (options.receipt) {
        const receiptRef = await this.storeReceipt(commitHash, options.receipt);
        entry.receiptRef = receiptRef;
      }

      // Add to cache
      this.entriesCache.set(entryId, entry);
      
      // Apply tags if specified
      if (options.tags && options.tags.length > 0) {
        await this.applyTags(commitHash, options.tags);
      }

      this.stats.entriesAdded++;
      this.emit('operation-recorded', { entry, commitHash });

      return entry;
    } catch (error) {
      this.emit('ledger-error', { operation: 'record', error });
      throw error;
    }
  }

  /**
   * Get ledger entries by operation type
   */
  async getEntriesByOperation(operation: string): Promise<LedgerEntry[]> {
    try {
      const allEntries = await this.getAllEntries();
      return allEntries.filter(entry => entry.operation === operation);
    } catch (error) {
      this.emit('ledger-error', { operation: 'get-by-operation', error });
      throw error;
    }
  }

  /**
   * Get ledger entries within a time range
   */
  async getEntriesByTimeRange(since: Date, until?: Date): Promise<LedgerEntry[]> {
    try {
      const allEntries = await this.getAllEntries();
      const untilDate = until || new Date();
      
      return allEntries.filter(entry => {
        const entryDate = new Date(entry.timestamp);
        return entryDate >= since && entryDate <= untilDate;
      });
    } catch (error) {
      this.emit('ledger-error', { operation: 'get-by-time-range', error });
      throw error;
    }
  }

  /**
   * Get all ledger entries
   */
  async getAllEntries(): Promise<LedgerEntry[]> {
    try {
      // Get all commits in the ledger branch
      const commits = await this.getLedgerCommits();
      const entries: LedgerEntry[] = [];

      for (const commit of commits) {
        // Parse commit message to extract operation info
        const operationInfo = this.parseCommitMessage(commit.message);
        if (operationInfo) {
          // Try to get receipt from git notes
          const receipt = await this.getReceipt(commit.hash);
          
          const entry: LedgerEntry = {
            id: this.generateEntryId(operationInfo.operation, commit.timestamp, operationInfo.metadata),
            timestamp: commit.timestamp,
            operation: operationInfo.operation,
            commitHash: commit.hash,
            parentCommit: commit.parents[0],
            metadata: operationInfo.metadata,
            receiptRef: receipt ? `notes:${commit.hash}` : undefined,
            tags: await this.getCommitTags(commit.hash)
          };

          entries.push(entry);
        }
      }

      return entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    } catch (error) {
      this.emit('ledger-error', { operation: 'get-all-entries', error });
      throw error;
    }
  }

  /**
   * Get receipt for a commit
   */
  async getReceipt(commitHash: string): Promise<any | null> {
    try {
      const attestations = await this.notesManager.getAttestationNotes(commitHash);
      if (attestations.length > 0) {
        // Find receipt in attestations
        const receiptAttestation = attestations.find(a => a.attestationType === 'receipt');
        return receiptAttestation?.receipt || null;
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Store receipt in git notes
   */
  async storeReceipt(commitHash: string, receipt: any): Promise<string> {
    try {
      const attestation = {
        type: 'receipt',
        attestationType: 'receipt',
        receipt,
        timestamp: new Date().toISOString(),
        generator: 'kgen-ledger'
      };

      const notesCommit = await this.notesManager.addAttestationNote(commitHash, attestation);
      this.stats.receiptsStored++;
      
      return notesCommit;
    } catch (error) {
      this.emit('ledger-error', { operation: 'store-receipt', error });
      throw error;
    }
  }

  /**
   * Create a commit for an operation
   */
  private async createOperationCommit(
    operation: string,
    metadata: Record<string, any>,
    message: string,
    author?: { name: string; email: string }
  ): Promise<string> {
    try {
      const workingDir = this.config.gitDir.replace('/.git', '');
      
      // Create operation metadata as a blob
      const operationData = {
        operation,
        metadata,
        timestamp: new Date().toISOString(),
        version: '1.0'
      };

      const blobContent = JSON.stringify(operationData, null, 2);
      const blobHash = await git.writeBlob({
        fs: this.config.fs,
        dir: workingDir,
        blob: Buffer.from(blobContent, 'utf8')
      });

      // Create tree with the operation blob
      const treeEntries = [{
        mode: '100644',
        path: `operations/${operation}-${Date.now()}.json`,
        oid: blobHash,
        type: 'blob' as const
      }];

      // Get current ledger tree if it exists
      try {
        const currentRef = await git.resolveRef({
          fs: this.config.fs,
          dir: workingDir,
          ref: this.config.ledgerRef
        });

        const currentCommit = await git.readCommit({
          fs: this.config.fs,
          dir: workingDir,
          oid: currentRef
        });

        // Add existing tree entries
        const existingTree = await git.readTree({
          fs: this.config.fs,
          dir: workingDir,
          oid: currentCommit.tree
        });

        treeEntries.push(...existingTree.tree);
      } catch (error) {
        // Ledger branch doesn't exist yet or is empty
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
          ref: this.config.ledgerRef
        });
        parents = [parentRef];
      } catch (error) {
        // No parent (first commit)
      }

      // Create commit
      const commitHash = await git.commit({
        fs: this.config.fs,
        dir: workingDir,
        message,
        tree: treeHash,
        parent: parents,
        author: {
          name: author?.name || 'KGEN',
          email: author?.email || 'kgen@localhost',
          timestamp: Math.floor(Date.now() / 1000),
          timezoneOffset: 0
        },
        committer: {
          name: author?.name || 'KGEN',
          email: author?.email || 'kgen@localhost',
          timestamp: Math.floor(Date.now() / 1000),
          timezoneOffset: 0
        }
      });

      // Update ledger ref
      await git.writeRef({
        fs: this.config.fs,
        dir: workingDir,
        ref: this.config.ledgerRef,
        value: commitHash
      });

      this.stats.commitsCreated++;
      return commitHash;
    } catch (error) {
      throw new Error(`Failed to create operation commit: ${error.message}`);
    }
  }

  /**
   * Apply tags to a commit
   */
  private async applyTags(commitHash: string, tags: string[]): Promise<void> {
    try {
      const workingDir = this.config.gitDir.replace('/.git', '');

      for (const tag of tags) {
        const tagRef = `refs/tags/kgen/${tag}`;
        await git.writeRef({
          fs: this.config.fs,
          dir: workingDir,
          ref: tagRef,
          value: commitHash
        });
        this.stats.tagsCreated++;
      }
    } catch (error) {
      throw new Error(`Failed to apply tags: ${error.message}`);
    }
  }

  /**
   * Get commits in the ledger branch
   */
  private async getLedgerCommits(): Promise<any[]> {
    try {
      const workingDir = this.config.gitDir.replace('/.git', '');
      
      // Get the ledger branch ref
      const ledgerRef = await git.resolveRef({
        fs: this.config.fs,
        dir: workingDir,
        ref: this.config.ledgerRef
      });

      // Walk the commit history
      const commits = await git.log({
        fs: this.config.fs,
        dir: workingDir,
        ref: ledgerRef
      });

      return commits.map(commit => ({
        hash: commit.oid,
        timestamp: new Date(commit.commit.committer.timestamp * 1000).toISOString(),
        message: commit.commit.message,
        author: commit.commit.author,
        tree: commit.commit.tree,
        parents: commit.commit.parent
      }));
    } catch (error) {
      if (error.code === 'NotFoundError') {
        return [];
      }
      throw error;
    }
  }

  /**
   * Get tags for a commit
   */
  private async getCommitTags(commitHash: string): Promise<string[]> {
    try {
      const workingDir = this.config.gitDir.replace('/.git', '');
      const tags: string[] = [];

      // List all refs to find tags pointing to this commit
      const refs = await git.listRefs({
        fs: this.config.fs,
        dir: workingDir
      });

      for (const ref of refs) {
        if (ref.ref.startsWith('refs/tags/kgen/') && ref.oid === commitHash) {
          const tagName = ref.ref.replace('refs/tags/kgen/', '');
          tags.push(tagName);
        }
      }

      return tags;
    } catch (error) {
      return [];
    }
  }

  /**
   * Parse commit message to extract operation info
   */
  private parseCommitMessage(message: string): { operation: string; metadata: Record<string, any> } | null {
    try {
      // Expected format: "KGEN: operation_name [metadata]"
      const match = message.match(/^KGEN:\s+(\w+)(?:\s+(.+))?$/);
      if (!match) {
        return null;
      }

      const operation = match[1];
      let metadata = {};

      if (match[2]) {
        try {
          metadata = JSON.parse(match[2]);
        } catch (error) {
          // Metadata not in JSON format, store as string
          metadata = { description: match[2] };
        }
      }

      return { operation, metadata };
    } catch (error) {
      return null;
    }
  }

  /**
   * Generate unique entry ID
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
   * Initialize ledger branch if it doesn't exist
   */
  private async initializeLedgerBranch(): Promise<void> {
    try {
      const workingDir = this.config.gitDir.replace('/.git', '');
      
      // Check if ledger branch exists
      try {
        await git.resolveRef({
          fs: this.config.fs,
          dir: workingDir,
          ref: this.config.ledgerRef
        });
      } catch (error) {
        // Create initial commit for ledger branch
        const initialBlob = await git.writeBlob({
          fs: this.config.fs,
          dir: workingDir,
          blob: Buffer.from('# KGEN Ledger\n\nInitialized ledger for operation tracking.\n', 'utf8')
        });

        const initialTree = await git.writeTree({
          fs: this.config.fs,
          dir: workingDir,
          tree: [{
            mode: '100644',
            path: 'README.md',
            oid: initialBlob,
            type: 'blob'
          }]
        });

        const initialCommit = await git.commit({
          fs: this.config.fs,
          dir: workingDir,
          message: 'KGEN: initialize_ledger',
          tree: initialTree,
          parent: [],
          author: {
            name: 'KGEN',
            email: 'kgen@localhost',
            timestamp: Math.floor(Date.now() / 1000),
            timezoneOffset: 0
          },
          committer: {
            name: 'KGEN',
            email: 'kgen@localhost',
            timestamp: Math.floor(Date.now() / 1000),
            timezoneOffset: 0
          }
        });

        await git.writeRef({
          fs: this.config.fs,
          dir: workingDir,
          ref: this.config.ledgerRef,
          value: initialCommit
        });
      }
    } catch (error) {
      throw new Error(`Failed to initialize ledger branch: ${error.message}`);
    }
  }

  /**
   * Get ledger statistics
   */
  getStats() {
    return {
      ...this.stats,
      cacheSize: this.entriesCache.size,
      notesStats: this.notesManager.getStats()
    };
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.entriesCache.clear();
    this.notesManager.clearCache();
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    this.clearCache();
    await this.notesManager.cleanup();
    this.removeAllListeners();
  }
}

/**
 * Create git ledger instance
 */
export function createGitLedger(config: LedgerConfig): GitLedger {
  return new GitLedger(config);
}

export default GitLedger;