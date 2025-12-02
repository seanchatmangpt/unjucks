/**
 * Git Ledger CLI Integration for KGen Marketplace
 * 
 * Command-line interface for interacting with the immutable ledger system
 * providing marketplace operations, queries, and audit functionality.
 */

import { consola } from 'consola';
import { table } from 'table';
import { writeFile } from 'fs/promises';
import GitLedger, { NOTES_REFS } from './git-ledger.js';
import SignatureManager from '../crypto/signatures.js';

/**
 * Ledger CLI Commands
 */
export class LedgerCLI {
  constructor(repoPath = process.cwd(), options = {}) {
    this.ledger = new GitLedger(repoPath, options);
    this.logger = consola;
  }

  /**
   * Initialize ledger with key pair
   */
  async initializeLedger(options = {}) {
    try {
      // Generate or load key pair
      let keyPair;
      if (options.keyFile) {
        keyPair = await this.loadKeyPair(options.keyFile);
      } else {
        keyPair = await SignatureManager.generateKeyPair();
        if (options.saveKeys) {
          await this.saveKeyPair(keyPair, options.saveKeys);
        }
      }

      this.ledger.privateKey = keyPair.privateKey;
      this.ledger.publicKey = keyPair.publicKey;

      this.logger.success('Ledger initialized successfully');
      this.logger.info(`Public key: ${keyPair.publicKey}`);
      
      return keyPair;
    } catch (error) {
      this.logger.error('Failed to initialize ledger:', error.message);
      throw error;
    }
  }

  /**
   * Record marketplace transaction
   */
  async recordTransaction(args) {
    try {
      const transactionData = {
        transactionId: args.txId,
        buyerId: args.buyerId,
        sellerId: args.sellerId,
        kpackId: args.kpackId,
        amount: parseFloat(args.amount),
        currency: args.currency || 'USD',
        timestamp: Date.now(),
        metadata: args.metadata || {}
      };

      const entryId = await this.ledger.recordReceipt(transactionData);
      
      this.logger.success(`Transaction recorded: ${entryId}`);
      this.logger.info(`KPack: ${transactionData.kpackId}`);
      this.logger.info(`Amount: ${transactionData.amount} ${transactionData.currency}`);
      
      return entryId;
    } catch (error) {
      this.logger.error('Failed to record transaction:', error.message);
      throw error;
    }
  }

  /**
   * Record KPack attestation
   */
  async recordAttestation(args) {
    try {
      const attestationData = {
        kpackId: args.kpackId,
        attestationType: args.type,
        result: args.result,
        scanner: args.scanner || 'manual',
        score: args.score ? parseFloat(args.score) : null,
        details: args.details || {},
        timestamp: Date.now()
      };

      const entryId = await this.ledger.recordAttestation(attestationData);
      
      this.logger.success(`Attestation recorded: ${entryId}`);
      this.logger.info(`Type: ${attestationData.attestationType}`);
      this.logger.info(`Result: ${attestationData.result}`);
      
      return entryId;
    } catch (error) {
      this.logger.error('Failed to record attestation:', error.message);
      throw error;
    }
  }

  /**
   * Record installation event
   */
  async recordInstallation(args) {
    try {
      const installData = {
        kpackId: args.kpackId,
        userId: args.userId,
        version: args.version,
        installPath: args.path,
        environment: args.env || 'production',
        timestamp: Date.now(),
        metadata: args.metadata || {}
      };

      const entryId = await this.ledger.recordInstallation(installData);
      
      this.logger.success(`Installation recorded: ${entryId}`);
      this.logger.info(`KPack: ${installData.kpackId}@${installData.version}`);
      this.logger.info(`Path: ${installData.installPath}`);
      
      return entryId;
    } catch (error) {
      this.logger.error('Failed to record installation:', error.message);
      throw error;
    }
  }

  /**
   * Record trust decision
   */
  async recordTrustDecision(args) {
    try {
      const trustData = {
        kpackId: args.kpackId,
        userId: args.userId,
        decision: args.decision,
        reason: args.reason,
        riskScore: args.risk ? parseFloat(args.risk) : null,
        automatic: args.auto || false,
        timestamp: Date.now()
      };

      const entryId = await this.ledger.recordTrustDecision(trustData);
      
      this.logger.success(`Trust decision recorded: ${entryId}`);
      this.logger.info(`Decision: ${trustData.decision}`);
      this.logger.info(`Reason: ${trustData.reason}`);
      
      return entryId;
    } catch (error) {
      this.logger.error('Failed to record trust decision:', error.message);
      throw error;
    }
  }

  /**
   * Query ledger entries
   */
  async queryLedger(namespace, filter = {}, options = {}) {
    try {
      let entries;
      
      switch (namespace) {
        case 'receipts':
          entries = await this.ledger.queryReceipts(filter);
          break;
        case 'attestations':
          entries = await this.ledger.queryAttestations(filter);
          break;
        case 'installs':
          entries = await this.ledger.queryInstallations(filter);
          break;
        case 'trust':
          entries = await this.ledger.queryTrustDecisions(filter);
          break;
        default:
          entries = await this.ledger.listNotes(namespace, { filter });
      }

      if (options.format === 'table') {
        this.displayEntriesAsTable(entries, namespace);
      } else if (options.format === 'json') {
        console.log(JSON.stringify(entries, null, 2));
      } else {
        this.displayEntriesAsText(entries, namespace);
      }

      return entries;
    } catch (error) {
      this.logger.error('Failed to query ledger:', error.message);
      throw error;
    }
  }

  /**
   * Generate audit trail for KPack
   */
  async generateAuditTrail(kpackId, options = {}) {
    try {
      const auditTrail = await this.ledger.getKPackAuditTrail(kpackId);
      
      if (options.output) {
        await writeFile(options.output, JSON.stringify(auditTrail, null, 2));
        this.logger.success(`Audit trail exported to: ${options.output}`);
      }

      if (options.format === 'summary') {
        this.displayAuditSummary(auditTrail);
      } else {
        console.log(JSON.stringify(auditTrail, null, 2));
      }

      return auditTrail;
    } catch (error) {
      this.logger.error('Failed to generate audit trail:', error.message);
      throw error;
    }
  }

  /**
   * Verify entry integrity
   */
  async verifyEntry(entryId, namespace) {
    try {
      const entry = await this.ledger.readNote(namespace, entryId);
      
      if (!entry) {
        this.logger.error(`Entry not found: ${entryId}`);
        return false;
      }

      let signatureValid = false;
      let merkleProofValid = false;

      // Check signature if present
      if (entry.signature) {
        signatureValid = this.ledger.verifySignature(entry.data, entry.signature);
      }

      // Check Merkle proof
      try {
        const proof = await this.ledger.generateMerkleProof(namespace, entryId);
        const entryHash = this.ledger.hashEntry(entry);
        merkleProofValid = this.ledger.verifyMerkleProof(proof, entryHash);
      } catch (error) {
        this.logger.warn('Merkle proof verification failed:', error.message);
      }

      // Display results
      this.logger.info(`Entry ID: ${entryId}`);
      this.logger.info(`Namespace: ${namespace}`);
      this.logger.info(`Signature Valid: ${signatureValid ? '✅' : '❌'}`);
      this.logger.info(`Merkle Proof Valid: ${merkleProofValid ? '✅' : '❌'}`);
      this.logger.info(`Timestamp: ${new Date(entry.timestamp).toISOString()}`);

      const isValid = signatureValid && merkleProofValid;
      if (isValid) {
        this.logger.success('Entry integrity verified');
      } else {
        this.logger.error('Entry integrity check failed');
      }

      return isValid;
    } catch (error) {
      this.logger.error('Failed to verify entry:', error.message);
      throw error;
    }
  }

  /**
   * Replicate ledger to/from remote
   */
  async replicateLedger(remoteUrl, direction = 'push') {
    try {
      await this.ledger.replicateLedger(remoteUrl, direction);
      
      this.logger.success(`Ledger ${direction}ed successfully`);
      this.logger.info(`Remote: ${remoteUrl}`);
    } catch (error) {
      this.logger.error(`Failed to ${direction} ledger:`, error.message);
      throw error;
    }
  }

  /**
   * Display ledger statistics
   */
  async displayStatistics() {
    try {
      const stats = {};
      
      for (const [name, ref] of Object.entries(NOTES_REFS)) {
        if (name !== 'MERKLE') {
          const entries = await this.ledger.listNotes(ref);
          stats[name.toLowerCase()] = entries.length;
        }
      }

      const tableData = [
        ['Namespace', 'Entry Count'],
        ...Object.entries(stats).map(([name, count]) => [name, count])
      ];

      console.log(table(tableData));
      
      return stats;
    } catch (error) {
      this.logger.error('Failed to get statistics:', error.message);
      throw error;
    }
  }

  /**
   * Display entries as table
   */
  displayEntriesAsTable(entries, namespace) {
    if (entries.length === 0) {
      this.logger.info(`No entries found in ${namespace}`);
      return;
    }

    const headers = ['ID', 'Timestamp', 'Data Summary'];
    const rows = entries.map(entry => [
      entry.id.substring(0, 12) + '...',
      new Date(entry.timestamp).toLocaleString(),
      this.summarizeData(entry.data, namespace)
    ]);

    const tableData = [headers, ...rows];
    console.log(table(tableData));
  }

  /**
   * Display entries as formatted text
   */
  displayEntriesAsText(entries, namespace) {
    if (entries.length === 0) {
      this.logger.info(`No entries found in ${namespace}`);
      return;
    }

    this.logger.info(`Found ${entries.length} entries in ${namespace}:`);
    
    entries.forEach((entry, index) => {
      console.log(`\n${index + 1}. Entry ${entry.id.substring(0, 12)}...`);
      console.log(`   Timestamp: ${new Date(entry.timestamp).toISOString()}`);
      console.log(`   Data: ${JSON.stringify(entry.data, null, 2)}`);
      if (entry.signature) {
        console.log(`   Signed: ✅ (${entry.signature.publicKey.substring(0, 12)}...)`);
      }
    });
  }

  /**
   * Display audit trail summary
   */
  displayAuditSummary(auditTrail) {
    this.logger.info(`\n📋 Audit Trail for ${auditTrail.kpackId}`);
    this.logger.info(`Generated: ${auditTrail.auditedAt}`);
    
    const summaryData = [
      ['Category', 'Count', 'Latest'],
      ['Receipts', auditTrail.receipts.length, this.getLatestTimestamp(auditTrail.receipts)],
      ['Attestations', auditTrail.attestations.length, this.getLatestTimestamp(auditTrail.attestations)],
      ['Installations', auditTrail.installs.length, this.getLatestTimestamp(auditTrail.installs)],
      ['Trust Decisions', auditTrail.trust.length, this.getLatestTimestamp(auditTrail.trust)]
    ];

    console.log(table(summaryData));
  }

  /**
   * Summarize data for table display
   */
  summarizeData(data, namespace) {
    switch (namespace) {
      case 'receipts':
        return `${data.kpackId} - $${data.amount}`;
      case 'attestations':
        return `${data.kpackId} - ${data.result}`;
      case 'installs':
        return `${data.kpackId}@${data.version}`;
      case 'trust':
        return `${data.kpackId} - ${data.decision}`;
      default:
        return JSON.stringify(data).substring(0, 50) + '...';
    }
  }

  /**
   * Get latest timestamp from entries
   */
  getLatestTimestamp(entries) {
    if (entries.length === 0) return 'N/A';
    
    const latest = Math.max(...entries.map(e => e.timestamp));
    return new Date(latest).toLocaleDateString();
  }

  /**
   * Save key pair to file
   */
  async saveKeyPair(keyPair, filename) {
    const keyData = {
      privateKey: keyPair.privateKey,
      publicKey: keyPair.publicKey,
      generated: new Date().toISOString(),
      algorithm: 'Ed25519'
    };

    await writeFile(filename, JSON.stringify(keyData, null, 2));
    this.logger.success(`Keys saved to: ${filename}`);
  }

  /**
   * Load key pair from file
   */
  async loadKeyPair(filename) {
    try {
      const content = await readFile(filename, 'utf8');
      const keyData = JSON.parse(content);
      
      if (!keyData.privateKey || !keyData.publicKey) {
        throw new Error('Invalid key file format');
      }

      return {
        privateKey: keyData.privateKey,
        publicKey: keyData.publicKey
      };
    } catch (error) {
      throw new Error(`Failed to load key file: ${error.message}`);
    }
  }
}

export default LedgerCLI;