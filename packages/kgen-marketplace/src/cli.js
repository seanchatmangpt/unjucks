/**
 * KGen Marketplace CLI Commands
 * 
 * Command-line interface for the Git-based immutable ledger marketplace system.
 * Integrates with the main KGen CLI to provide marketplace functionality.
 */

import { defineCommand } from 'citty';
import { consola } from 'consola';
import { resolve } from 'path';
import KGenMarketplace from './index.js';
import LedgerCLI from './ledger/ledger-cli.js';

/**
 * Main marketplace command group
 */
export const marketplaceCommand = defineCommand({
  meta: {
    name: 'marketplace',
    description: 'KGen Marketplace with immutable ledger operations'
  },
  subCommands: {
    init: initCommand,
    purchase: purchaseCommand,
    attest: attestCommand,
    trust: trustCommand,
    query: queryCommand,
    audit: auditCommand,
    verify: verifyCommand,
    stats: statsCommand,
    export: exportCommand,
    replicate: replicateCommand
  }
});

/**
 * Initialize marketplace with ledger
 */
export const initCommand = defineCommand({
  meta: {
    name: 'init',
    description: 'Initialize marketplace with cryptographic ledger'
  },
  args: {
    'save-keys': {
      type: 'string',
      description: 'Save generated keys to file'
    },
    'key-file': {
      type: 'string', 
      description: 'Load keys from file'
    },
    'repo-path': {
      type: 'string',
      description: 'Git repository path',
      default: process.cwd()
    }
  },
  async run({ args }) {
    try {
      const marketplace = new KGenMarketplace(args['repo-path']);
      
      const keyPair = await marketplace.initialize({
        saveKeys: args['save-keys'],
        keyFile: args['key-file']
      });
      
      consola.success('Marketplace initialized successfully');
      consola.info(`Repository: ${args['repo-path']}`);
      consola.info(`Public key: ${keyPair.publicKey.substring(0, 16)}...`);
      
    } catch (error) {
      consola.error('Failed to initialize marketplace:', error.message);
      process.exit(1);
    }
  }
});

/**
 * Record KPack purchase
 */
export const purchaseCommand = defineCommand({
  meta: {
    name: 'purchase',
    description: 'Record KPack purchase transaction'
  },
  args: {
    kpack: {
      type: 'string',
      description: 'KPack ID',
      required: true
    },
    buyer: {
      type: 'string',
      description: 'Buyer user ID',
      required: true
    },
    seller: {
      type: 'string',
      description: 'Seller user ID',
      required: true
    },
    version: {
      type: 'string',
      description: 'KPack version',
      required: true
    },
    amount: {
      type: 'string',
      description: 'Purchase amount',
      required: true
    },
    currency: {
      type: 'string',
      description: 'Currency code',
      default: 'USD'
    },
    'install-path': {
      type: 'string',
      description: 'Installation path'
    },
    'repo-path': {
      type: 'string',
      description: 'Git repository path',
      default: process.cwd()
    }
  },
  async run({ args }) {
    try {
      const marketplace = new KGenMarketplace(args['repo-path']);
      
      const result = await marketplace.purchaseKPack({
        kpackId: args.kpack,
        buyerId: args.buyer,
        sellerId: args.seller,
        version: args.version,
        amount: parseFloat(args.amount),
        currency: args.currency,
        metadata: {
          installPath: args['install-path']
        }
      });
      
      consola.success('Purchase recorded successfully');
      consola.info(`Transaction ID: ${result.transactionId}`);
      consola.info(`Installation ID: ${result.installationId}`);
      consola.info(`KPack: ${result.kpackId}@${result.version}`);
      
    } catch (error) {
      consola.error('Failed to record purchase:', error.message);
      process.exit(1);
    }
  }
});

/**
 * Record KPack attestation
 */
export const attestCommand = defineCommand({
  meta: {
    name: 'attest',
    description: 'Record KPack security/quality attestation'
  },
  args: {
    kpack: {
      type: 'string',
      description: 'KPack ID',
      required: true
    },
    type: {
      type: 'string',
      description: 'Attestation type (security-scan, quality-check, etc.)',
      required: true
    },
    result: {
      type: 'string',
      description: 'Attestation result (passed, failed, warning)',
      required: true
    },
    scanner: {
      type: 'string',
      description: 'Scanner/tool name'
    },
    score: {
      type: 'string',
      description: 'Numeric score (0-10)'
    },
    'repo-path': {
      type: 'string',
      description: 'Git repository path',
      default: process.cwd()
    }
  },
  async run({ args }) {
    try {
      const marketplace = new KGenMarketplace(args['repo-path']);
      
      const entryId = await marketplace.attestKPack({
        kpackId: args.kpack,
        attestationType: args.type,
        result: args.result,
        scanner: args.scanner,
        score: args.score ? parseFloat(args.score) : null
      });
      
      consola.success('Attestation recorded successfully');
      consola.info(`Entry ID: ${entryId}`);
      consola.info(`KPack: ${args.kpack}`);
      consola.info(`Type: ${args.type} - Result: ${args.result}`);
      
    } catch (error) {
      consola.error('Failed to record attestation:', error.message);
      process.exit(1);
    }
  }
});

/**
 * Record trust decision
 */
export const trustCommand = defineCommand({
  meta: {
    name: 'trust',
    description: 'Record trust decision for KPack'
  },
  args: {
    kpack: {
      type: 'string',
      description: 'KPack ID',
      required: true
    },
    user: {
      type: 'string',
      description: 'User ID making decision',
      required: true
    },
    decision: {
      type: 'string',
      description: 'Trust decision (trusted, blocked, warning)',
      required: true
    },
    reason: {
      type: 'string',
      description: 'Reason for decision',
      required: true
    },
    risk: {
      type: 'string',
      description: 'Risk score (0-10)'
    },
    auto: {
      type: 'boolean',
      description: 'Automatic decision',
      default: false
    },
    'repo-path': {
      type: 'string',
      description: 'Git repository path',
      default: process.cwd()
    }
  },
  async run({ args }) {
    try {
      const marketplace = new KGenMarketplace(args['repo-path']);
      
      const entryId = await marketplace.decideTrust({
        kpackId: args.kpack,
        userId: args.user,
        decision: args.decision,
        reason: args.reason,
        riskScore: args.risk ? parseFloat(args.risk) : null,
        automatic: args.auto
      });
      
      consola.success('Trust decision recorded successfully');
      consola.info(`Entry ID: ${entryId}`);
      consola.info(`KPack: ${args.kpack}`);
      consola.info(`Decision: ${args.decision} - ${args.reason}`);
      
    } catch (error) {
      consola.error('Failed to record trust decision:', error.message);
      process.exit(1);
    }
  }
});

/**
 * Query ledger entries
 */
export const queryCommand = defineCommand({
  meta: {
    name: 'query',
    description: 'Query marketplace ledger entries'
  },
  args: {
    namespace: {
      type: 'string',
      description: 'Namespace to query (receipts, attestations, installs, trust)',
      required: true
    },
    kpack: {
      type: 'string',
      description: 'Filter by KPack ID'
    },
    user: {
      type: 'string',
      description: 'Filter by user ID'
    },
    result: {
      type: 'string',
      description: 'Filter by result'
    },
    format: {
      type: 'string',
      description: 'Output format (table, json, text)',
      default: 'table'
    },
    limit: {
      type: 'string',
      description: 'Limit number of results'
    },
    'repo-path': {
      type: 'string',
      description: 'Git repository path',
      default: process.cwd()
    }
  },
  async run({ args }) {
    try {
      const cli = new LedgerCLI(args['repo-path']);
      
      const filter = {};
      if (args.kpack) filter.kpackId = args.kpack;
      if (args.user) filter.userId = args.user;
      if (args.result) filter.result = args.result;
      
      const options = {
        format: args.format,
        limit: args.limit ? parseInt(args.limit) : undefined
      };
      
      await cli.queryLedger(args.namespace, filter, options);
      
    } catch (error) {
      consola.error('Failed to query ledger:', error.message);
      process.exit(1);
    }
  }
});

/**
 * Generate audit trail
 */
export const auditCommand = defineCommand({
  meta: {
    name: 'audit',
    description: 'Generate complete audit trail for KPack'
  },
  args: {
    kpack: {
      type: 'string',
      description: 'KPack ID',
      required: true
    },
    output: {
      type: 'string',
      description: 'Output file path'
    },
    format: {
      type: 'string',
      description: 'Output format (summary, full)',
      default: 'summary'
    },
    'repo-path': {
      type: 'string',
      description: 'Git repository path',
      default: process.cwd()
    }
  },
  async run({ args }) {
    try {
      const cli = new LedgerCLI(args['repo-path']);
      
      await cli.generateAuditTrail(args.kpack, {
        output: args.output,
        format: args.format
      });
      
    } catch (error) {
      consola.error('Failed to generate audit trail:', error.message);
      process.exit(1);
    }
  }
});

/**
 * Verify entry integrity
 */
export const verifyCommand = defineCommand({
  meta: {
    name: 'verify',
    description: 'Verify ledger entry integrity'
  },
  args: {
    entry: {
      type: 'string',
      description: 'Entry ID to verify',
      required: true
    },
    namespace: {
      type: 'string',
      description: 'Namespace (receipts, attestations, installs, trust)',
      required: true
    },
    'repo-path': {
      type: 'string',
      description: 'Git repository path',
      default: process.cwd()
    }
  },
  async run({ args }) {
    try {
      const cli = new LedgerCLI(args['repo-path']);
      
      await cli.verifyEntry(args.entry, args.namespace);
      
    } catch (error) {
      consola.error('Failed to verify entry:', error.message);
      process.exit(1);
    }
  }
});

/**
 * Display marketplace statistics
 */
export const statsCommand = defineCommand({
  meta: {
    name: 'stats',
    description: 'Display marketplace statistics'
  },
  args: {
    'repo-path': {
      type: 'string',
      description: 'Git repository path',
      default: process.cwd()
    }
  },
  async run({ args }) {
    try {
      const cli = new LedgerCLI(args['repo-path']);
      
      await cli.displayStatistics();
      
    } catch (error) {
      consola.error('Failed to get statistics:', error.message);
      process.exit(1);
    }
  }
});

/**
 * Export marketplace state
 */
export const exportCommand = defineCommand({
  meta: {
    name: 'export',
    description: 'Export complete marketplace state'
  },
  args: {
    output: {
      type: 'string',
      description: 'Output file path',
      required: true
    },
    'repo-path': {
      type: 'string',
      description: 'Git repository path',
      default: process.cwd()
    }
  },
  async run({ args }) {
    try {
      const marketplace = new KGenMarketplace(args['repo-path']);
      
      await marketplace.exportMarketplace(args.output);
      
      consola.success(`Marketplace exported to: ${args.output}`);
      
    } catch (error) {
      consola.error('Failed to export marketplace:', error.message);
      process.exit(1);
    }
  }
});

/**
 * Replicate ledger
 */
export const replicateCommand = defineCommand({
  meta: {
    name: 'replicate',
    description: 'Replicate ledger to/from remote repository'
  },
  args: {
    remote: {
      type: 'string',
      description: 'Remote repository URL',
      required: true
    },
    direction: {
      type: 'string',
      description: 'Direction (push, pull)',
      default: 'push'
    },
    'repo-path': {
      type: 'string',
      description: 'Git repository path',
      default: process.cwd()
    }
  },
  async run({ args }) {
    try {
      const cli = new LedgerCLI(args['repo-path']);
      
      await cli.replicateLedger(args.remote, args.direction);
      
    } catch (error) {
      consola.error('Failed to replicate ledger:', error.message);
      process.exit(1);
    }
  }
});

export default marketplaceCommand;