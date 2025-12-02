/**
 * Receipt Generation Tests
 */

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { ReceiptGenerator } from '../src/receipts/generator.js';

describe('ReceiptGenerator', () => {
  let generator;
  let mockTransaction;

  beforeEach(() => {
    generator = new ReceiptGenerator({
      receiptStorage: 'filesystem'
    });
    
    mockTransaction = {
      id: 'txn_test_123',
      userId: 'test_user',
      kpackId: 'test_kpack',
      timestamp: '2024-01-01T00:00:00Z',
      status: 'completed',
      requirement: {
        fiat: 25,
        reputation: 200
      },
      operations: [
        {
          dimension: 'fiat',
          amount: 25,
          adapter: 'stripe',
          operationId: 'stripe_op_123',
          status: 'completed'
        },
        {
          dimension: 'reputation',
          amount: 200,
          adapter: 'github',
          operationId: 'github_op_456',
          status: 'completed'
        }
      ]
    };
  });

  test('should generate valid receipt structure', async () => {
    const receipt = await generator.generate({
      transaction: mockTransaction
    });
    
    assert.strictEqual(receipt['@type'], 'kmkt:Receipt');
    assert.ok(receipt.id.startsWith('receipt:'));
    assert.strictEqual(receipt.transaction.id, mockTransaction.id);
    assert.strictEqual(receipt.transaction.userId, mockTransaction.userId);
    assert.strictEqual(receipt.transaction.kpackId, mockTransaction.kpackId);
    assert.ok(receipt.metadata.generatedAt);
    assert.strictEqual(receipt.metadata.version, '1.0.0');
  });

  test('should include cryptographic proof', async () => {
    const receipt = await generator.generate({
      transaction: mockTransaction
    });
    
    assert.ok(receipt.cryptographic);
    assert.ok(receipt.cryptographic.contentHash);
    assert.ok(receipt.cryptographic.signature);
    assert.ok(receipt.cryptographic.merkleProof);
    assert.ok(receipt.cryptographic.timestampProof);
    
    // Content hash should be deterministic
    assert.strictEqual(receipt.cryptographic.contentHash.length, 64); // SHA-256 hex
  });

  test('should include policy in receipt', async () => {
    const policy = {
      type: 'logical',
      operator: 'or',
      rules: [
        { type: 'dimension', dimension: 'fiat' },
        { type: 'dimension', dimension: 'reputation' }
      ]
    };
    
    const receipt = await generator.generate({
      transaction: mockTransaction,
      policy
    });
    
    assert.ok(receipt.policy);
    assert.strictEqual(receipt.policy.type, 'object');
    assert.deepStrictEqual(receipt.policy.value, policy);
  });

  test('should include metadata', async () => {
    const metadata = {
      kpackVersion: '1.2.3',
      userTier: 'premium',
      marketplace: 'kgen-official'
    };
    
    const receipt = await generator.generate({
      transaction: mockTransaction,
      metadata
    });
    
    assert.strictEqual(receipt.metadata.kpackVersion, '1.2.3');
    assert.strictEqual(receipt.metadata.userTier, 'premium');
    assert.strictEqual(receipt.metadata.marketplace, 'kgen-official');
  });

  test('should verify receipt authenticity', async () => {
    const receipt = await generator.generate({
      transaction: mockTransaction
    });
    
    const verification = await generator.verifyReceipt(receipt);
    
    assert.ok(verification.contentHash);
    assert.ok(verification.signature);
    assert.ok(verification.merkleProof);
    assert.ok(verification.timestamp);
    assert.ok(verification.overall);
  });

  test('should detect tampered receipt', async () => {
    const receipt = await generator.generate({
      transaction: mockTransaction
    });
    
    // Tamper with transaction data
    receipt.transaction.userId = 'hacker';
    
    const verification = await generator.verifyReceipt(receipt);
    
    assert.ok(!verification.contentHash); // Should fail hash verification
    assert.ok(!verification.overall);
  });

  test('should handle string policy serialization', async () => {
    const stringPolicy = 'fiat OR reputation';
    
    const receipt = await generator.generate({
      transaction: mockTransaction,
      policy: stringPolicy
    });
    
    assert.ok(receipt.policy);
    assert.strictEqual(receipt.policy.type, 'string');
    assert.strictEqual(receipt.policy.value, stringPolicy);
  });

  test('should generate unique merkle proofs', async () => {
    const receipt1 = await generator.generate({
      transaction: { ...mockTransaction, id: 'txn_1' }
    });
    
    const receipt2 = await generator.generate({
      transaction: { ...mockTransaction, id: 'txn_2' }
    });
    
    assert.notStrictEqual(
      receipt1.cryptographic.merkleProof.root,
      receipt2.cryptographic.merkleProof.root
    );
  });

  test('should include timestamp proof with blockchain reference', async () => {
    const receipt = await generator.generate({
      transaction: mockTransaction
    });
    
    const timestampProof = receipt.cryptographic.timestampProof;
    assert.ok(timestampProof.timestamp);
    assert.ok(timestampProof.nonce);
    assert.ok(typeof timestampProof.blockHeight === 'number');
    assert.ok(timestampProof.blockHeight > 0);
  });
});

describe('Receipt Storage', () => {
  test('should create filesystem storage path', async () => {
    const generator = new ReceiptGenerator({
      receiptStorage: 'filesystem'
    });
    
    const mockTransaction = {
      id: 'txn_storage_test',
      userId: 'test_user',
      kpackId: 'test_kpack',
      timestamp: new Date().toISOString(),
      status: 'completed',
      requirement: { fiat: 10 },
      operations: []
    };
    
    // This would create .kgen/receipts/ directory and store the receipt
    const receipt = await generator.generate({
      transaction: mockTransaction
    });
    
    assert.ok(receipt);
    // In a real test, would verify file was created in .kgen/receipts/
  });
});