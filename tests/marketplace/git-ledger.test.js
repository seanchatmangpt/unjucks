/**
 * Git Ledger Test Suite
 * 
 * Comprehensive tests for the Git-based immutable ledger system
 * including cryptographic verification and audit trail functionality.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { execSync } from 'child_process';
import GitLedger, { NOTES_REFS } from '../packages/kgen-marketplace/src/ledger/git-ledger.js';
import SignatureManager from '../packages/kgen-marketplace/src/crypto/signatures.js';

describe('GitLedger', () => {
  let testRepo;
  let ledger;
  let keyPair;

  beforeEach(async () => {
    // Create temporary git repository
    testRepo = await mkdtemp(join(tmpdir(), 'git-ledger-test-'));
    
    // Initialize git repo
    execSync('git init', { cwd: testRepo });
    execSync('git config user.name "Test User"', { cwd: testRepo });
    execSync('git config user.email "test@example.com"', { cwd: testRepo });
    
    // Create initial commit
    execSync('echo "# Test Repo" > README.md', { cwd: testRepo });
    execSync('git add README.md', { cwd: testRepo });
    execSync('git commit -m "Initial commit"', { cwd: testRepo });
    
    // Generate test key pair
    keyPair = await SignatureManager.generateKeyPair();
    
    // Initialize ledger
    ledger = new GitLedger(testRepo, {
      privateKey: keyPair.privateKey,
      publicKey: keyPair.publicKey
    });
  });

  afterEach(async () => {
    // Clean up test repository
    await rm(testRepo, { recursive: true, force: true });
  });

  describe('Initialization', () => {
    it('should initialize in a git repository', () => {
      expect(ledger.repoPath).toBe(testRepo);
      expect(ledger.privateKey).toBe(keyPair.privateKey);
      expect(ledger.publicKey).toBe(keyPair.publicKey);
    });

    it('should throw error if not in git repository', async () => {
      const nonGitDir = await mkdtemp(join(tmpdir(), 'non-git-'));
      
      expect(() => {
        new GitLedger(nonGitDir);
      }).toThrow('Not a git repository');
      
      await rm(nonGitDir, { recursive: true, force: true });
    });
  });

  describe('Basic Ledger Operations', () => {
    it('should append entry to receipts namespace', async () => {
      const transactionData = {
        txId: 'test-tx-001',
        amount: 100,
        kpackId: 'test-kpack',
        timestamp: Date.now()
      };

      const entryId = await ledger.recordReceipt(transactionData);
      
      expect(entryId).toBeDefined();
      expect(typeof entryId).toBe('string');
      expect(entryId).toHaveLength(64); // SHA256 hash
    });

    it('should retrieve stored entries', async () => {
      const testData = { test: 'data', value: 42 };
      
      const entryId = await ledger.appendToLedger(NOTES_REFS.RECEIPTS, testData);
      const entries = await ledger.listNotes(NOTES_REFS.RECEIPTS);
      
      expect(entries).toHaveLength(1);
      expect(entries[0].id).toBe(entryId);
      expect(entries[0].data).toEqual(testData);
    });

    it('should maintain chronological order', async () => {
      const data1 = { sequence: 1 };
      const data2 = { sequence: 2 };
      const data3 = { sequence: 3 };
      
      await ledger.appendToLedger(NOTES_REFS.RECEIPTS, data1);
      await new Promise(resolve => setTimeout(resolve, 10)); // Ensure different timestamps
      await ledger.appendToLedger(NOTES_REFS.RECEIPTS, data2);
      await new Promise(resolve => setTimeout(resolve, 10));
      await ledger.appendToLedger(NOTES_REFS.RECEIPTS, data3);
      
      const entries = await ledger.listNotes(NOTES_REFS.RECEIPTS);
      
      expect(entries).toHaveLength(3);
      // Should be in reverse chronological order (newest first)
      expect(entries[0].data.sequence).toBe(3);
      expect(entries[1].data.sequence).toBe(2);
      expect(entries[2].data.sequence).toBe(1);
    });
  });

  describe('Cryptographic Features', () => {
    it('should create and verify signatures', async () => {
      const testData = { important: 'data', value: 123 };
      
      const entryId = await ledger.appendToLedger(NOTES_REFS.ATTESTATIONS, testData);
      const entry = await ledger.readNote(NOTES_REFS.ATTESTATIONS, entryId);
      
      expect(entry.signature).toBeDefined();
      expect(entry.signature.hash).toBeDefined();
      expect(entry.signature.signature).toBeDefined();
      expect(entry.signature.publicKey).toBe(keyPair.publicKey);
      
      // Verify signature
      const isValid = ledger.verifySignature(testData, entry.signature);
      expect(isValid).toBe(true);
    });

    it('should detect tampered data', async () => {
      const originalData = { value: 'original' };
      const tamperedData = { value: 'tampered' };
      
      const entryId = await ledger.appendToLedger(NOTES_REFS.TRUST, originalData);
      const entry = await ledger.readNote(NOTES_REFS.TRUST, entryId);
      
      // Try to verify with tampered data
      const isValid = ledger.verifySignature(tamperedData, entry.signature);
      expect(isValid).toBe(false);
    });
  });

  describe('Merkle Tree Integration', () => {
    it('should update Merkle tree on new entries', async () => {
      const data1 = { test: 'data1' };
      const data2 = { test: 'data2' };
      
      await ledger.appendToLedger(NOTES_REFS.RECEIPTS, data1);
      await ledger.appendToLedger(NOTES_REFS.RECEIPTS, data2);
      
      // Check Merkle root was created
      const root = await ledger.readNote(NOTES_REFS.MERKLE, `${NOTES_REFS.RECEIPTS}-root`);
      
      expect(root).toBeDefined();
      expect(root.root).toBeDefined();
      expect(root.namespace).toBe(NOTES_REFS.RECEIPTS);
      expect(root.entryCount).toBe(2);
    });

    it('should generate valid Merkle proofs', async () => {
      const testData = { proof: 'test' };
      
      const entryId = await ledger.appendToLedger(NOTES_REFS.RECEIPTS, testData);
      const proof = await ledger.generateMerkleProof(NOTES_REFS.RECEIPTS, entryId);
      
      expect(proof.entryId).toBe(entryId);
      expect(proof.proof).toBeDefined();
      expect(proof.root).toBeDefined();
      expect(proof.namespace).toBe(NOTES_REFS.RECEIPTS);
      
      // Verify proof
      const entryHash = ledger.hashEntry({ id: entryId, data: testData, timestamp: expect.any(Number) });
      const isValid = ledger.verifyMerkleProof(proof, entryHash);
      expect(isValid).toBe(true);
    });
  });

  describe('Marketplace Operations', () => {
    it('should record transaction receipts', async () => {
      const receipt = {
        transactionId: 'tx-001',
        buyerId: 'user-123',
        sellerId: 'dev-456',
        kpackId: 'awesome-kpack-v1.0.0',
        amount: 50,
        currency: 'USD',
        timestamp: Date.now()
      };

      const entryId = await ledger.recordReceipt(receipt);
      const receipts = await ledger.queryReceipts({ kpackId: 'awesome-kpack-v1.0.0' });
      
      expect(receipts).toHaveLength(1);
      expect(receipts[0].data).toEqual(receipt);
      expect(receipts[0].metadata.type).toBe('transaction');
    });

    it('should record KPack attestations', async () => {
      const attestation = {
        kpackId: 'secure-kpack-v2.1.0',
        attestationType: 'security-scan',
        result: 'passed',
        scanner: 'security-bot-v1',
        vulnerabilities: 0,
        timestamp: Date.now()
      };

      const entryId = await ledger.recordAttestation(attestation);
      const attestations = await ledger.queryAttestations({ kpackId: 'secure-kpack-v2.1.0' });
      
      expect(attestations).toHaveLength(1);
      expect(attestations[0].data.result).toBe('passed');
      expect(attestations[0].metadata.category).toBe('kpack');
    });

    it('should record installation events', async () => {
      const installation = {
        kpackId: 'utility-kpack-v1.5.0',
        userId: 'user-789',
        installPath: '/home/user/.kgen/kpacks/utility-kpack-v1.5.0',
        version: '1.5.0',
        timestamp: Date.now()
      };

      const entryId = await ledger.recordInstallation(installation);
      const installs = await ledger.queryInstallations({ userId: 'user-789' });
      
      expect(installs).toHaveLength(1);
      expect(installs[0].data.kpackId).toBe('utility-kpack-v1.5.0');
    });

    it('should record trust decisions', async () => {
      const trustDecision = {
        kpackId: 'experimental-kpack-v0.1.0',
        userId: 'user-456',
        decision: 'blocked',
        reason: 'experimental-version',
        riskScore: 7.5,
        timestamp: Date.now()
      };

      const entryId = await ledger.recordTrustDecision(trustDecision);
      const decisions = await ledger.queryTrustDecisions({ decision: 'blocked' });
      
      expect(decisions).toHaveLength(1);
      expect(decisions[0].data.reason).toBe('experimental-version');
    });
  });

  describe('Audit Trail', () => {
    it('should generate complete KPack audit trail', async () => {
      const kpackId = 'test-kpack-v1.0.0';
      
      // Create various entries
      await ledger.recordReceipt({
        transactionId: 'tx-001',
        kpackId,
        amount: 25
      });
      
      await ledger.recordAttestation({
        kpackId,
        attestationType: 'security-scan',
        result: 'passed'
      });
      
      await ledger.recordInstallation({
        kpackId,
        userId: 'user-123',
        version: '1.0.0'
      });
      
      await ledger.recordTrustDecision({
        kpackId,
        userId: 'user-123',
        decision: 'trusted'
      });
      
      const auditTrail = await ledger.getKPackAuditTrail(kpackId);
      
      expect(auditTrail.kpackId).toBe(kpackId);
      expect(auditTrail.receipts).toHaveLength(1);
      expect(auditTrail.attestations).toHaveLength(1);
      expect(auditTrail.installs).toHaveLength(1);
      expect(auditTrail.trust).toHaveLength(1);
      expect(auditTrail.auditedAt).toBeDefined();
    });

    it('should export audit trail for compliance', async () => {
      const testData = { compliance: 'test' };
      await ledger.appendToLedger(NOTES_REFS.RECEIPTS, testData);
      
      const audit = await ledger.exportAuditTrail(NOTES_REFS.RECEIPTS);
      
      expect(audit.namespace).toBe(NOTES_REFS.RECEIPTS);
      expect(audit.exportedAt).toBeDefined();
      expect(audit.totalEntries).toBe(1);
      expect(audit.entries).toHaveLength(1);
      expect(audit.entries[0].verified).toBe(true); // Should be verified if signed
    });
  });

  describe('Filtering and Queries', () => {
    it('should filter entries by metadata', async () => {
      await ledger.recordReceipt({ kpackId: 'kpack-a', amount: 10 });
      await ledger.recordReceipt({ kpackId: 'kpack-b', amount: 20 });
      await ledger.recordReceipt({ kpackId: 'kpack-a', amount: 30 });
      
      const kpackAReceipts = await ledger.queryReceipts({ kpackId: 'kpack-a' });
      
      expect(kpackAReceipts).toHaveLength(2);
      expect(kpackAReceipts.every(r => r.data.kpackId === 'kpack-a')).toBe(true);
    });

    it('should limit query results', async () => {
      for (let i = 0; i < 5; i++) {
        await ledger.recordReceipt({ sequence: i });
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
      const limitedResults = await ledger.listNotes(NOTES_REFS.RECEIPTS, { limit: 3 });
      
      expect(limitedResults).toHaveLength(3);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing entries gracefully', async () => {
      const nonExistentId = '0000000000000000000000000000000000000000000000000000000000000000';
      const entry = await ledger.readNote(NOTES_REFS.RECEIPTS, nonExistentId);
      
      expect(entry).toBeNull();
    });

    it('should throw error for invalid Merkle proof requests', async () => {
      const nonExistentId = '1111111111111111111111111111111111111111111111111111111111111111';
      
      await expect(
        ledger.generateMerkleProof(NOTES_REFS.RECEIPTS, nonExistentId)
      ).rejects.toThrow('Entry not found');
    });

    it('should handle empty namespaces', async () => {
      const entries = await ledger.listNotes(NOTES_REFS.TRUST);
      expect(entries).toEqual([]);
      
      const audit = await ledger.exportAuditTrail(NOTES_REFS.TRUST);
      expect(audit.totalEntries).toBe(0);
    });
  });

  describe('Git Operations', () => {
    it('should use proper git notes refs', () => {
      expect(NOTES_REFS.RECEIPTS).toBe('refs/notes/kgen/receipts');
      expect(NOTES_REFS.ATTESTATIONS).toBe('refs/notes/kgen/attestations');
      expect(NOTES_REFS.INSTALLS).toBe('refs/notes/kgen/installs');
      expect(NOTES_REFS.TRUST).toBe('refs/notes/kgen/trust');
      expect(NOTES_REFS.MERKLE).toBe('refs/notes/kgen/merkle');
    });

    it('should anchor entries to git commits', async () => {
      const testData = { anchored: 'entry' };
      const entryId = await ledger.appendToLedger(NOTES_REFS.RECEIPTS, testData);
      const entry = await ledger.readNote(NOTES_REFS.RECEIPTS, entryId);
      
      expect(entry.anchorCommit).toBeDefined();
      expect(entry.anchorCommit).toMatch(/^[0-9a-f]{40}$/); // Git commit hash format
    });
  });
});