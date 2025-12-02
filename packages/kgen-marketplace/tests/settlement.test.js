/**
 * Settlement Engine Tests
 */

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { 
  ValueVector, 
  SettlementEngine,
  StripeAdapter,
  Web3Adapter,
  GitHubAdapter,
  ComputeAdapter,
  PolicyTemplates 
} from '../src/index.js';

describe('ValueVector', () => {
  test('should create value vector from dimensions', () => {
    const vector = new ValueVector({
      fiat: 10,
      crypto: 0.001,
      reputation: 100
    });
    
    assert.strictEqual(vector.dimensions.fiat, 10);
    assert.strictEqual(vector.dimensions.crypto, 0.001);
    assert.strictEqual(vector.dimensions.reputation, 100);
    assert.ok(vector.id);
    assert.ok(vector.timestamp);
  });

  test('should parse from KPack manifest', () => {
    const manifest = {
      payment: {
        fiat: 25,
        reputation: 500,
        custom: {
          enterprise_credits: 10
        }
      }
    };
    
    const vector = ValueVector.fromKPackManifest(manifest);
    assert.strictEqual(vector.dimensions.fiat, 25);
    assert.strictEqual(vector.dimensions.reputation, 500);
    assert.strictEqual(vector.dimensions.enterprise_credits, 10);
  });

  test('should check satisfaction', () => {
    const userBalance = new ValueVector({
      fiat: 100,
      crypto: 1.0,
      reputation: 1000
    });
    
    const requirement = new ValueVector({
      fiat: 50,
      crypto: 0.5,
      reputation: 500
    });
    
    assert.ok(userBalance.satisfies(requirement));
  });

  test('should handle insufficient balance', () => {
    const userBalance = new ValueVector({
      fiat: 10,
      crypto: 0.1
    });
    
    const requirement = new ValueVector({
      fiat: 50,
      crypto: 0.5
    });
    
    assert.ok(!userBalance.satisfies(requirement));
  });

  test('should subtract vectors correctly', () => {
    const balance = new ValueVector({ fiat: 100, crypto: 1.0 });
    const cost = new ValueVector({ fiat: 25, crypto: 0.1 });
    
    const result = balance.subtract(cost);
    assert.strictEqual(result.dimensions.fiat, 75);
    assert.strictEqual(result.dimensions.crypto, 0.9);
  });

  test('should add vectors correctly', () => {
    const balance = new ValueVector({ fiat: 100, crypto: 1.0 });
    const credit = new ValueVector({ fiat: 25, crypto: 0.1 });
    
    const result = balance.add(credit);
    assert.strictEqual(result.dimensions.fiat, 125);
    assert.strictEqual(result.dimensions.crypto, 1.1);
  });
});

describe('SettlementEngine', () => {
  let engine;
  let stripeAdapter;
  let web3Adapter;
  let githubAdapter;
  let computeAdapter;

  beforeEach(async () => {
    engine = new SettlementEngine();
    
    // Initialize mock adapters
    stripeAdapter = new StripeAdapter({ apiKey: 'sk_test_mock' });
    web3Adapter = new Web3Adapter({ rpcUrl: 'http://mock' });
    githubAdapter = new GitHubAdapter({ token: 'mock_token' });
    computeAdapter = new ComputeAdapter({ provider: 'mock' });
    
    await engine.initialize({
      stripe: stripeAdapter,
      web3: web3Adapter,
      github: githubAdapter,
      compute: computeAdapter
    });
    
    // Set mock balances
    await stripeAdapter.setBalance('test_user', 1000);
    await web3Adapter.setBalance('test_user', 5.0);
    await githubAdapter.setBalance('test_user', 2000);
    await computeAdapter.setBalance('test_user', 1000);
  });

  test('should settle simple payment', async () => {
    const requirement = new ValueVector({
      fiat: 10,
      crypto: 0.001
    });
    
    const result = await engine.settle({
      userId: 'test_user',
      kpackId: 'test_kpack',
      requirement
    });
    
    assert.ok(result.success);
    assert.ok(result.transactionId);
    assert.ok(result.receipt);
    assert.strictEqual(result.receipt.transaction.userId, 'test_user');
  });

  test('should reject insufficient funds', async () => {
    const requirement = new ValueVector({
      fiat: 2000 // More than available balance
    });
    
    const result = await engine.settle({
      userId: 'test_user',
      kpackId: 'test_kpack',
      requirement
    });
    
    assert.ok(!result.success);
    assert.ok(result.error.includes('Insufficient funds'));
  });

  test('should handle multi-dimensional payment', async () => {
    const requirement = new ValueVector({
      fiat: 25,
      crypto: 0.1,
      reputation: 100,
      compute: 50
    });
    
    const result = await engine.settle({
      userId: 'test_user',
      kpackId: 'test_kpack',
      requirement
    });
    
    assert.ok(result.success);
    assert.strictEqual(result.receipt.transaction.operations.length, 4);
  });

  test('should apply flexible payment policy', async () => {
    // Set user to have only crypto, no fiat
    await stripeAdapter.setBalance('test_user', 0);
    
    const requirement = new ValueVector({
      fiat: 25,
      crypto: 0.1,
      reputation: 500
    });
    
    const result = await engine.settle({
      userId: 'test_user',
      kpackId: 'test_kpack',
      requirement,
      policy: PolicyTemplates.FLEXIBLE_PAYMENT
    });
    
    assert.ok(result.success, 'Should succeed with flexible policy');
  });

  test('should track transaction history', async () => {
    const requirement = new ValueVector({ fiat: 10 });
    
    await engine.settle({
      userId: 'test_user',
      kpackId: 'kpack1',
      requirement
    });
    
    await engine.settle({
      userId: 'test_user',
      kpackId: 'kpack2',
      requirement
    });
    
    const history = engine.getTransactionHistory('test_user');
    assert.strictEqual(history.length, 2);
    assert.strictEqual(history[0].kpackId, 'kpack2'); // Most recent first
    assert.strictEqual(history[1].kpackId, 'kpack1');
  });

  test('should generate valid receipts', async () => {
    const requirement = new ValueVector({
      fiat: 15,
      reputation: 200
    });
    
    const result = await engine.settle({
      userId: 'test_user',
      kpackId: 'test_kpack',
      requirement
    });
    
    const receipt = result.receipt;
    assert.ok(receipt);
    assert.strictEqual(receipt['@type'], 'kmkt:Receipt');
    assert.ok(receipt.cryptographic);
    assert.ok(receipt.cryptographic.contentHash);
    assert.ok(receipt.cryptographic.signature);
    assert.ok(receipt.cryptographic.merkleProof);
    assert.ok(receipt.cryptographic.timestampProof);
  });
});

describe('Payment Adapters', () => {
  test('StripeAdapter should handle fiat payments', async () => {
    const adapter = new StripeAdapter({ apiKey: 'sk_test_mock' });
    await adapter.initialize();
    await adapter.setBalance('test_user', 100);
    
    const balance = await adapter.getBalance('test_user');
    assert.strictEqual(balance, 100);
    
    const debitResult = await adapter.debit('test_user', 25);
    assert.ok(debitResult.id);
    assert.strictEqual(debitResult.amount, 25);
    assert.strictEqual(debitResult.status, 'completed');
    
    const newBalance = await adapter.getBalance('test_user');
    assert.strictEqual(newBalance, 75);
  });

  test('Web3Adapter should handle crypto payments', async () => {
    const adapter = new Web3Adapter({ rpcUrl: 'http://mock' });
    await adapter.initialize();
    await adapter.setBalance('test_user', 2.0);
    
    const balance = await adapter.getBalance('test_user');
    assert.strictEqual(balance, 2.0);
    
    const debitResult = await adapter.debit('test_user', 0.5);
    assert.ok(debitResult.txHash);
    assert.ok(debitResult.txHash.startsWith('0x'));
    assert.strictEqual(debitResult.amount, 0.5);
  });

  test('GitHubAdapter should handle reputation credits', async () => {
    const adapter = new GitHubAdapter({ token: 'mock_token' });
    await adapter.initialize();
    await adapter.setBalance('test_user', 1000);
    
    const balance = await adapter.getBalance('test_user');
    assert.strictEqual(balance, 1000);
    
    const debitResult = await adapter.debit('test_user', 200);
    assert.strictEqual(debitResult.reputationAction, 'spend');
    assert.strictEqual(debitResult.amount, 200);
  });

  test('ComputeAdapter should handle compute credits', async () => {
    const adapter = new ComputeAdapter({ provider: 'test' });
    await adapter.initialize();
    await adapter.setBalance('test_user', 500);
    
    const balance = await adapter.getBalance('test_user');
    assert.strictEqual(balance, 500);
    
    const debitResult = await adapter.debit('test_user', 100);
    assert.strictEqual(debitResult.computeUnits, 100);
    assert.ok(debitResult.estimatedDuration);
    
    const usageStats = adapter.getUsageStats('test_user');
    assert.strictEqual(usageStats.total, 100);
    assert.strictEqual(usageStats.sessions.length, 1);
  });
});