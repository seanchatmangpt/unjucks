/**
 * Marketplace Integration Test Suite
 * 
 * End-to-end integration tests for the complete marketplace system
 * including ledger operations, CLI commands, and real git operations.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { execSync } from 'child_process';
import KGenMarketplace from '../packages/kgen-marketplace/src/index.js';
import LedgerCLI from '../packages/kgen-marketplace/src/ledger/ledger-cli.js';

describe('Marketplace Integration', () => {
  let testRepo;
  let marketplace;
  let cli;

  beforeEach(async () => {
    // Create temporary git repository
    testRepo = await mkdtemp(join(tmpdir(), 'marketplace-integration-'));
    
    // Initialize git repo
    execSync('git init', { cwd: testRepo });
    execSync('git config user.name "Test User"', { cwd: testRepo });
    execSync('git config user.email "test@example.com"', { cwd: testRepo });
    
    // Create initial commit
    execSync('echo "# Marketplace Test" > README.md', { cwd: testRepo });
    execSync('git add README.md', { cwd: testRepo });
    execSync('git commit -m "Initial commit"', { cwd: testRepo });
    
    // Initialize marketplace
    marketplace = new KGenMarketplace(testRepo);
    cli = new LedgerCLI(testRepo);
    
    // Initialize with test keys
    await marketplace.initialize();
  });

  afterEach(async () => {
    // Clean up test repository
    await rm(testRepo, { recursive: true, force: true });
  });

  describe('Complete Purchase Workflow', () => {
    it('should handle complete KPack purchase lifecycle', async () => {
      // 1. Record KPack purchase
      const purchaseResult = await marketplace.purchaseKPack({
        kpackId: 'awesome-utils-v1.0.0',
        buyerId: 'user-alice',
        sellerId: 'dev-bob',
        version: '1.0.0',
        amount: 29.99,
        currency: 'USD',
        paymentMethod: 'credit-card',
        metadata: {
          installPath: '/home/alice/.kgen/kpacks/awesome-utils',
          environment: 'development'
        }
      });

      expect(purchaseResult.status).toBe('completed');
      expect(purchaseResult.transactionId).toBeDefined();
      expect(purchaseResult.installationId).toBeDefined();

      // 2. Record security attestation
      const attestationId = await marketplace.attestKPack({
        kpackId: 'awesome-utils-v1.0.0',
        attestationType: 'security-scan',
        result: 'passed',
        scanner: 'kgen-security-bot-v2',
        score: 8.5,
        vulnerabilities: [],
        details: {
          scanDuration: '45s',
          filesScanned: 127,
          rulesChecked: 245
        }
      });

      expect(attestationId).toBeDefined();

      // 3. Record trust decision
      const trustId = await marketplace.decideTrust({
        kpackId: 'awesome-utils-v1.0.0',
        userId: 'user-alice',
        decision: 'trusted',
        reason: 'security-scan-passed',
        riskScore: 2.1,
        automatic: true
      });

      expect(trustId).toBeDefined();

      // 4. Verify all entries are recorded
      const [receipts, attestations, installs, trust] = await Promise.all([
        marketplace.ledger.queryReceipts({ kpackId: 'awesome-utils-v1.0.0' }),
        marketplace.ledger.queryAttestations({ kpackId: 'awesome-utils-v1.0.0' }),
        marketplace.ledger.queryInstallations({ kpackId: 'awesome-utils-v1.0.0' }),
        marketplace.ledger.queryTrustDecisions({ kpackId: 'awesome-utils-v1.0.0' })
      ]);

      expect(receipts).toHaveLength(1);
      expect(attestations).toHaveLength(1);
      expect(installs).toHaveLength(1);
      expect(trust).toHaveLength(1);

      // 5. Generate complete audit trail
      const auditTrail = await marketplace.ledger.getKPackAuditTrail('awesome-utils-v1.0.0');
      
      expect(auditTrail.kpackId).toBe('awesome-utils-v1.0.0');
      expect(auditTrail.receipts).toHaveLength(1);
      expect(auditTrail.attestations).toHaveLength(1);
      expect(auditTrail.installs).toHaveLength(1);
      expect(auditTrail.trust).toHaveLength(1);

      // 6. Verify all entries cryptographically
      for (const receipt of receipts) {
        const isValid = await cli.verifyEntry(receipt.id, 'refs/notes/kgen/receipts');
        expect(isValid).toBe(true);
      }
    });

    it('should calculate accurate marketplace metrics', async () => {
      // Create multiple transactions for the same KPack
      const kpackId = 'popular-kpack-v2.1.0';
      
      // Multiple purchases
      await marketplace.purchaseKPack({
        kpackId,
        buyerId: 'user-1',
        sellerId: 'dev-creator',
        version: '2.1.0',
        amount: 15.99
      });

      await marketplace.purchaseKPack({
        kpackId,
        buyerId: 'user-2',
        sellerId: 'dev-creator',
        version: '2.1.0',
        amount: 15.99
      });

      await marketplace.purchaseKPack({
        kpackId,
        buyerId: 'user-3',
        sellerId: 'dev-creator',
        version: '2.1.0',
        amount: 12.99 // Discounted price
      });

      // Multiple attestations
      await marketplace.attestKPack({
        kpackId,
        attestationType: 'security-scan',
        result: 'passed',
        scanner: 'security-bot',
        score: 9.2
      });

      await marketplace.attestKPack({
        kpackId,
        attestationType: 'quality-check',
        result: 'passed',
        scanner: 'quality-bot',
        score: 8.7
      });

      // Trust decisions
      await marketplace.decideTrust({
        kpackId,
        userId: 'user-1',
        decision: 'trusted',
        reason: 'high-quality-package'
      });

      await marketplace.decideTrust({
        kpackId,
        userId: 'user-2',
        decision: 'trusted',
        reason: 'recommended-by-community'
      });

      // Get metrics
      const metrics = await marketplace.getKPackMetrics(kpackId);

      expect(metrics.sales.totalRevenue).toBe(44.97); // 15.99 + 15.99 + 12.99
      expect(metrics.sales.transactionCount).toBe(3);
      expect(metrics.sales.averagePrice).toBeCloseTo(14.99);
      
      expect(metrics.adoption.installCount).toBe(3);
      expect(metrics.adoption.uniqueUsers).toBe(3);
      
      expect(metrics.trust.decisions).toBe(2);
      expect(metrics.trust.trusted).toBe(2);
      expect(metrics.trust.blocked).toBe(0);
      expect(metrics.trust.score).toBeGreaterThan(0.7); // Should be high

      expect(metrics.security.status).toBe('verified'); // Has security scan + passed
      expect(metrics.security.attestationCount).toBe(2);
    });
  });

  describe('Marketplace Search and Discovery', () => {
    it('should support complex marketplace searches', async () => {
      // Create diverse KPack ecosystem
      const kpacks = [
        {
          id: 'budget-tool-v1.0.0',
          price: 9.99,
          seller: 'indie-dev',
          attestations: [{ type: 'basic-check', result: 'passed', score: 6.5 }],
          trust: [{ decision: 'trusted', userId: 'user-1' }]
        },
        {
          id: 'enterprise-suite-v3.2.1',
          price: 199.99,
          seller: 'big-corp',
          attestations: [
            { type: 'security-scan', result: 'passed', score: 9.8 },
            { type: 'compliance-check', result: 'passed', score: 9.5 }
          ],
          trust: [
            { decision: 'trusted', userId: 'enterprise-user-1' },
            { decision: 'trusted', userId: 'enterprise-user-2' }
          ]
        },
        {
          id: 'experimental-ai-v0.1.0',
          price: 4.99,
          seller: 'researcher',
          attestations: [{ type: 'security-scan', result: 'warning', score: 4.2 }],
          trust: [{ decision: 'blocked', userId: 'security-conscious-user' }]
        }
      ];

      // Populate marketplace
      for (const kpack of kpacks) {
        await marketplace.purchaseKPack({
          kpackId: kpack.id,
          buyerId: 'test-buyer',
          sellerId: kpack.seller,
          version: '1.0.0',
          amount: kpack.price
        });

        for (const attestation of kpack.attestations) {
          await marketplace.attestKPack({
            kpackId: kpack.id,
            attestationType: attestation.type,
            result: attestation.result,
            score: attestation.score
          });
        }

        for (const trustDecision of kpack.trust) {
          await marketplace.decideTrust({
            kpackId: kpack.id,
            userId: trustDecision.userId,
            decision: trustDecision.decision,
            reason: 'test-decision'
          });
        }
      }

      // Test price-based search
      const budgetResults = await marketplace.searchMarketplace(
        { maxPrice: 50 },
        { sortBy: 'price', sortOrder: 'asc' }
      );

      expect(budgetResults.results).toHaveLength(2);
      expect(budgetResults.results[0].kpackId).toBe('experimental-ai-v0.1.0');

      // Test trust score filter
      const trustedResults = await marketplace.searchMarketplace(
        { minTrustScore: 0.6 }
      );

      expect(trustedResults.results).toHaveLength(2);
      expect(trustedResults.results.some(r => r.kpackId === 'enterprise-suite-v3.2.1')).toBe(true);

      // Test security status filter
      const secureResults = await marketplace.searchMarketplace(
        { securityStatus: 'passed' }
      );

      expect(secureResults.results.length).toBeGreaterThan(0);
    });
  });

  describe('Data Integrity and Audit', () => {
    it('should maintain cryptographic integrity across operations', async () => {
      // Create transaction
      await marketplace.purchaseKPack({
        kpackId: 'integrity-test-v1.0.0',
        buyerId: 'alice',
        sellerId: 'bob',
        version: '1.0.0',
        amount: 25.50
      });

      // Verify initial integrity
      const initialIntegrity = await marketplace.verifyMarketplaceIntegrity();
      expect(initialIntegrity.summary.status).toBe('healthy');
      expect(initialIntegrity.summary.integrityScore).toBe(1.0);

      // Add more entries
      await marketplace.attestKPack({
        kpackId: 'integrity-test-v1.0.0',
        attestationType: 'integrity-scan',
        result: 'passed'
      });

      await marketplace.decideTrust({
        kpackId: 'integrity-test-v1.0.0',
        userId: 'alice',
        decision: 'trusted',
        reason: 'verified-source'
      });

      // Verify integrity after additions
      const finalIntegrity = await marketplace.verifyMarketplaceIntegrity();
      expect(finalIntegrity.summary.status).toBe('healthy');
      expect(finalIntegrity.summary.totalEntries).toBe(3); // Receipt + attestation + trust
      expect(finalIntegrity.summary.verifiedEntries).toBe(3);
      expect(finalIntegrity.summary.failedEntries).toBe(0);
    });

    it('should export and validate complete marketplace state', async () => {
      // Populate with test data
      await marketplace.purchaseKPack({
        kpackId: 'export-test-v1.0.0',
        buyerId: 'user-export',
        sellerId: 'dev-export',
        version: '1.0.0',
        amount: 19.99
      });

      await marketplace.attestKPack({
        kpackId: 'export-test-v1.0.0',
        attestationType: 'export-test',
        result: 'passed'
      });

      // Export marketplace
      const exportPath = join(testRepo, 'marketplace-export.json');
      const exportData = await marketplace.exportMarketplace(exportPath);

      expect(exportData.version).toBe('1.0');
      expect(exportData.exportedAt).toBeDefined();
      expect(exportData.receipts.totalEntries).toBe(1);
      expect(exportData.attestations.totalEntries).toBe(1);

      // Verify export file was created
      const fs = await import('fs/promises');
      const exportFile = await fs.readFile(exportPath, 'utf8');
      const parsedExport = JSON.parse(exportFile);
      
      expect(parsedExport.version).toBe('1.0');
      expect(parsedExport.receipts).toBeDefined();
      expect(parsedExport.attestations).toBeDefined();
    });
  });

  describe('Git Operations and Replication', () => {
    it('should properly use git notes for storage', async () => {
      // Create entries
      await marketplace.purchaseKPack({
        kpackId: 'git-test-v1.0.0',
        buyerId: 'git-user',
        sellerId: 'git-dev',
        version: '1.0.0',
        amount: 15.00
      });

      // Verify git notes were created
      const receiptNotes = execSync('git notes --ref=refs/notes/kgen/receipts list', { 
        cwd: testRepo,
        encoding: 'utf8'
      }).trim();

      expect(receiptNotes).toBeTruthy();
      expect(receiptNotes.split('\n').length).toBeGreaterThan(0);

      const installNotes = execSync('git notes --ref=refs/notes/kgen/installs list', {
        cwd: testRepo,
        encoding: 'utf8'
      }).trim();

      expect(installNotes).toBeTruthy();

      // Verify notes content
      const noteIds = receiptNotes.split('\n');
      const firstNoteContent = execSync(`git notes --ref=refs/notes/kgen/receipts show ${noteIds[0]}`, {
        cwd: testRepo,
        encoding: 'utf8'
      });

      const noteData = JSON.parse(firstNoteContent);
      expect(noteData.data.kpackId).toBe('git-test-v1.0.0');
      expect(noteData.data.amount).toBe(15.00);
      expect(noteData.signature).toBeDefined();
      expect(noteData.anchorCommit).toBeDefined();
    });

    it('should handle Merkle tree proofs correctly', async () => {
      // Create multiple entries for meaningful tree
      const entries = [
        { kpackId: 'merkle-1', amount: 10 },
        { kpackId: 'merkle-2', amount: 20 },
        { kpackId: 'merkle-3', amount: 30 },
        { kpackId: 'merkle-4', amount: 40 }
      ];

      for (const entry of entries) {
        await marketplace.purchaseKPack({
          kpackId: entry.kpackId,
          buyerId: 'merkle-user',
          sellerId: 'merkle-dev',
          version: '1.0.0',
          amount: entry.amount
        });
      }

      // Get all receipts
      const receipts = await marketplace.ledger.queryReceipts({});
      expect(receipts).toHaveLength(4);

      // Generate and verify Merkle proofs for each entry
      for (const receipt of receipts) {
        const proof = await marketplace.ledger.generateMerkleProof(
          'refs/notes/kgen/receipts',
          receipt.id
        );

        expect(proof.entryId).toBe(receipt.id);
        expect(proof.proof).toBeDefined();
        expect(proof.root).toBeDefined();

        // Verify the proof
        const entryHash = marketplace.ledger.hashEntry(receipt);
        const isValid = marketplace.ledger.verifyMerkleProof(proof, entryHash);
        expect(isValid).toBe(true);
      }
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle malformed data gracefully', async () => {
      // Test with missing required fields
      await expect(marketplace.purchaseKPack({
        // Missing required fields
        amount: 10
      })).rejects.toThrow();

      // Test with invalid amounts
      await expect(marketplace.purchaseKPack({
        kpackId: 'test',
        buyerId: 'buyer',
        sellerId: 'seller',
        version: '1.0.0',
        amount: -5 // Negative amount
      })).rejects.toThrow();
    });

    it('should handle empty marketplace queries', async () => {
      // Query empty marketplace
      const results = await marketplace.searchMarketplace({});
      expect(results.results).toHaveLength(0);
      expect(results.totalCount).toBe(0);

      // Query non-existent KPack
      const audit = await marketplace.ledger.getKPackAuditTrail('non-existent-kpack');
      expect(audit.receipts).toHaveLength(0);
      expect(audit.attestations).toHaveLength(0);
    });

    it('should maintain consistency under concurrent operations', async () => {
      // Simulate concurrent purchases
      const concurrentPurchases = Array.from({ length: 5 }, (_, i) =>
        marketplace.purchaseKPack({
          kpackId: `concurrent-${i}`,
          buyerId: `buyer-${i}`,
          sellerId: 'concurrent-seller',
          version: '1.0.0',
          amount: 10 + i
        })
      );

      const results = await Promise.all(concurrentPurchases);
      
      expect(results).toHaveLength(5);
      expect(results.every(r => r.status === 'completed')).toBe(true);
      expect(new Set(results.map(r => r.transactionId)).size).toBe(5); // All unique

      // Verify all entries were recorded
      const allReceipts = await marketplace.ledger.queryReceipts({});
      expect(allReceipts).toHaveLength(5);
    });
  });
});

describe('CLI Integration', () => {
  let testRepo;
  let cli;

  beforeEach(async () => {
    testRepo = await mkdtemp(join(tmpdir(), 'cli-integration-'));
    
    execSync('git init', { cwd: testRepo });
    execSync('git config user.name "CLI Test"', { cwd: testRepo });
    execSync('git config user.email "cli@test.com"', { cwd: testRepo });
    execSync('echo "# CLI Test" > README.md', { cwd: testRepo });
    execSync('git add README.md', { cwd: testRepo });
    execSync('git commit -m "Initial commit"', { cwd: testRepo });
    
    cli = new LedgerCLI(testRepo);
    await cli.initializeLedger();
  });

  afterEach(async () => {
    await rm(testRepo, { recursive: true, force: true });
  });

  describe('CLI Command Execution', () => {
    it('should execute transaction recording via CLI', async () => {
      const entryId = await cli.recordTransaction({
        txId: 'cli-tx-001',
        buyerId: 'cli-buyer',
        sellerId: 'cli-seller',
        kpackId: 'cli-kpack-v1.0.0',
        amount: '49.99',
        currency: 'USD'
      });

      expect(entryId).toBeDefined();
      expect(typeof entryId).toBe('string');
      expect(entryId).toHaveLength(64); // SHA256 hash
    });

    it('should handle CLI queries with formatting', async () => {
      // Record test data
      await cli.recordTransaction({
        txId: 'query-test-001',
        buyerId: 'query-buyer',
        sellerId: 'query-seller',
        kpackId: 'query-kpack',
        amount: '25.00'
      });

      // Test different output formats
      const entries = await cli.queryLedger('receipts', {}, { format: 'json' });
      expect(entries).toHaveLength(1);
      expect(entries[0].data.kpackId).toBe('query-kpack');

      // Test filtering
      const filtered = await cli.queryLedger(
        'receipts',
        { kpackId: 'query-kpack' },
        { format: 'json' }
      );
      expect(filtered).toHaveLength(1);
    });
  });
});