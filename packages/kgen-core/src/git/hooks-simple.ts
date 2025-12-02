/**
 * Simple Git Hooks System
 * 
 * Implements post-operation hooks that write to git notes:
 * - Post-publish: write listing-hint.json
 * - Post-install: write install-receipt.json  
 * - Post-attest: append to git-notes
 */

import { EventEmitter } from 'events';
import { SimpleReceipts } from './receipts-simple.js';
import { SimpleLedger } from './ledger-simple.js';

export interface HookContext {
  operation: string;
  timestamp: string;
  commitHash?: string;
  workingDir: string;
  metadata?: Record<string, any>;
  inputs?: Record<string, any>;
  outputs?: Record<string, any>;
}

export interface ListingHint {
  packageName: string;
  version: string;
  publishedAt: string;
  commitHash?: string;
  registry?: string;
  author?: {
    name: string;
    email: string;
  };
  dependencies?: Record<string, string>;
  artifacts?: {
    path: string;
    hash: string;
    size: number;
  }[];
}

export interface InstallReceipt {
  packageName: string;
  version: string;
  installedAt: string;
  installMethod: 'npm' | 'yarn' | 'pnpm' | 'manual';
  source: {
    registry?: string;
    url?: string;
    commitHash?: string;
  };
  integrity: {
    algorithm: string;
    hash: string;
    verified: boolean;
  };
  installation: {
    path: string;
    files: number;
    size: number;
    duration: number;
  };
  environment: {
    nodeVersion: string;
    npmVersion?: string;
    platform: string;
    arch: string;
  };
}

export interface HookConfig {
  gitDir: string;
  fs: any;
  enableHooks?: boolean;
  enableSigning?: boolean;
}

export class SimpleHooks extends EventEmitter {
  private config: Required<HookConfig>;
  private receipts: SimpleReceipts;
  private ledger: SimpleLedger;
  private hookRegistry: Map<string, Function[]>;
  private stats: {
    hooksExecuted: number;
    listingHintsWritten: number;
    installReceiptsWritten: number;
    attestationsAppended: number;
    errors: number;
  };

  constructor(config: HookConfig) {
    super();
    
    this.config = {
      gitDir: config.gitDir || process.cwd() + '/.git',
      fs: config.fs,
      enableHooks: config.enableHooks ?? true,
      enableSigning: config.enableSigning ?? true
    };

    this.receipts = new SimpleReceipts({
      gitDir: this.config.gitDir,
      fs: this.config.fs,
      enableVerification: true
    });

    this.ledger = new SimpleLedger({
      gitDir: this.config.gitDir,
      fs: this.config.fs,
      enableSigning: this.config.enableSigning
    });

    this.hookRegistry = new Map();
    this.stats = {
      hooksExecuted: 0,
      listingHintsWritten: 0,
      installReceiptsWritten: 0,
      attestationsAppended: 0,
      errors: 0
    };

    this.registerDefaultHooks();
  }

  /**
   * Initialize hooks system
   */
  async initialize(): Promise<void> {
    try {
      await this.receipts.initialize();
      await this.ledger.initialize();
      this.emit('hooks-initialized');
    } catch (error) {
      this.emit('hooks-error', { operation: 'initialize', error });
      throw error;
    }
  }

  /**
   * Register default hooks
   */
  private registerDefaultHooks(): void {
    this.registerHook('post-publish', this.postPublishHook.bind(this));
    this.registerHook('post-install', this.postInstallHook.bind(this));
    this.registerHook('post-attest', this.postAttestHook.bind(this));
    this.registerHook('pre-operation', this.preOperationHook.bind(this));
    this.registerHook('post-operation', this.postOperationHook.bind(this));
  }

  /**
   * Register a hook for an operation
   */
  registerHook(operation: string, hookFunction: Function): void {
    if (!this.hookRegistry.has(operation)) {
      this.hookRegistry.set(operation, []);
    }
    this.hookRegistry.get(operation)!.push(hookFunction);
    this.emit('hook-registered', { operation, hookCount: this.hookRegistry.get(operation)!.length });
  }

  /**
   * Execute hooks for an operation
   */
  async executeHooks(operation: string, context: HookContext): Promise<void> {
    if (!this.config.enableHooks) {
      return;
    }

    try {
      const hooks = this.hookRegistry.get(operation) || [];
      
      for (const hook of hooks) {
        try {
          await hook(context);
          this.stats.hooksExecuted++;
        } catch (hookError) {
          this.stats.errors++;
          this.emit('hook-error', { operation, context, error: hookError });
          // Continue with other hooks
        }
      }

      this.emit('hooks-executed', { operation, context, hookCount: hooks.length });
    } catch (error) {
      this.emit('hooks-error', { operation: 'execute', error });
      throw error;
    }
  }

  /**
   * Post-publish hook - writes listing-hint.json
   */
  async postPublishHook(context: HookContext): Promise<void> {
    try {
      const listingHint: ListingHint = {
        packageName: context.metadata?.packageName || 'unknown',
        version: context.metadata?.version || '0.0.0',
        publishedAt: context.timestamp,
        commitHash: context.commitHash,
        registry: context.metadata?.registry || 'npm',
        author: context.metadata?.author || {
          name: 'Unknown',
          email: 'unknown@example.com'
        },
        dependencies: context.metadata?.dependencies || {},
        artifacts: this.collectArtifacts(context)
      };

      // Record in ledger
      await this.ledger.recordOperation('publish', {
        packageName: listingHint.packageName,
        version: listingHint.version,
        listingHint
      }, {
        message: `KGEN: publish ${listingHint.packageName}@${listingHint.version}`,
        receipt: listingHint
      });

      this.stats.listingHintsWritten++;
      this.emit('listing-hint-written', { listingHint, context });
    } catch (error) {
      this.emit('hook-error', { operation: 'post-publish', error });
      throw error;
    }
  }

  /**
   * Post-install hook - writes install-receipt.json
   */
  async postInstallHook(context: HookContext): Promise<void> {
    try {
      const installReceipt: InstallReceipt = {
        packageName: context.metadata?.packageName || 'unknown',
        version: context.metadata?.version || '0.0.0',
        installedAt: context.timestamp,
        installMethod: context.metadata?.installMethod || 'npm',
        source: {
          registry: context.metadata?.registry,
          url: context.metadata?.url,
          commitHash: context.commitHash
        },
        integrity: {
          algorithm: 'sha512',
          hash: context.metadata?.hash || 'unknown',
          verified: false
        },
        installation: {
          path: context.metadata?.installPath || context.workingDir,
          files: context.metadata?.filesCount || 0,
          size: context.metadata?.size || 0,
          duration: context.metadata?.duration || 0
        },
        environment: {
          nodeVersion: process.version,
          npmVersion: context.metadata?.npmVersion,
          platform: process.platform,
          arch: process.arch
        }
      };

      // Write receipt
      await this.receipts.writeReceipt('install', context.inputs || {}, {
        installReceipt
      }, {
        metadata: context.metadata
      });

      // Record in ledger
      await this.ledger.recordOperation('install', {
        packageName: installReceipt.packageName,
        version: installReceipt.version,
        installReceipt
      }, {
        message: `KGEN: install ${installReceipt.packageName}@${installReceipt.version}`,
        receipt: installReceipt
      });

      this.stats.installReceiptsWritten++;
      this.emit('install-receipt-written', { installReceipt, context });
    } catch (error) {
      this.emit('hook-error', { operation: 'post-install', error });
      throw error;
    }
  }

  /**
   * Post-attest hook - appends to git-notes
   */
  async postAttestHook(context: HookContext): Promise<void> {
    try {
      const attestationEntry = {
        id: this.generateAttestationId(context),
        timestamp: context.timestamp,
        objectHash: context.commitHash || 'unknown',
        attestationType: context.metadata?.attestationType || 'generic',
        attestationData: context.metadata?.attestationData || {},
        chainVerified: true
      };

      // Write receipt
      await this.receipts.writeReceipt('attest', context.inputs || {}, {
        attestationEntry
      }, {
        metadata: context.metadata
      });

      // Record in ledger
      await this.ledger.recordOperation('attest', {
        attestationType: attestationEntry.attestationType,
        objectHash: attestationEntry.objectHash,
        attestationEntry
      }, {
        message: `KGEN: attest ${attestationEntry.attestationType} for ${attestationEntry.objectHash}`,
        receipt: attestationEntry
      });

      this.stats.attestationsAppended++;
      this.emit('attestation-appended', { attestationEntry, context });
    } catch (error) {
      this.emit('hook-error', { operation: 'post-attest', error });
      throw error;
    }
  }

  /**
   * Pre-operation hook
   */
  async preOperationHook(context: HookContext): Promise<void> {
    try {
      // Validate context
      if (!context.operation) {
        throw new Error('Operation name is required');
      }

      // Log operation start
      this.emit('operation-started', { context });
    } catch (error) {
      this.emit('hook-error', { operation: 'pre-operation', error });
      throw error;
    }
  }

  /**
   * Post-operation hook
   */
  async postOperationHook(context: HookContext): Promise<void> {
    try {
      // Write general operation receipt
      const receipt = await this.receipts.writeReceipt(
        context.operation,
        context.inputs || {},
        context.outputs || {},
        {
          metadata: context.metadata,
          duration: context.metadata?.duration
        }
      );

      // Log operation completion
      this.emit('operation-completed', { context, receipt });
    } catch (error) {
      this.emit('hook-error', { operation: 'post-operation', error });
      throw error;
    }
  }

  /**
   * Helper methods
   */
  private collectArtifacts(context: HookContext): ListingHint['artifacts'] {
    const artifacts: ListingHint['artifacts'] = [];
    
    if (context.outputs) {
      for (const [path, content] of Object.entries(context.outputs)) {
        if (typeof content === 'string') {
          artifacts.push({
            path,
            hash: require('crypto').createHash('sha256').update(content).digest('hex'),
            size: Buffer.byteLength(content, 'utf8')
          });
        }
      }
    }

    return artifacts;
  }

  private generateAttestationId(context: HookContext): string {
    const data = `${context.operation}:${context.timestamp}:${context.commitHash}`;
    return require('crypto').createHash('sha256').update(data).digest('hex').substring(0, 16);
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      ...this.stats,
      registeredHooks: this.hookRegistry.size,
      receiptsStats: this.receipts.getStats(),
      ledgerStats: this.ledger.getStats()
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    await this.receipts.cleanup();
    await this.ledger.cleanup();
    this.hookRegistry.clear();
    this.removeAllListeners();
  }
}

/**
 * Create simple hooks instance
 */
export function createSimpleHooks(config: HookConfig): SimpleHooks {
  return new SimpleHooks(config);
}

export default SimpleHooks;