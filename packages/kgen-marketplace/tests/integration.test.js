/**
 * Integration Tests for Complete Payment Flows
 */

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { 
  MarketplaceSetup,
  ValueVector,
  PolicyTemplates 
} from '../src/index.js';

describe('Marketplace Integration', () => {
  let engine;

  beforeEach(async () => {
    engine = await MarketplaceSetup.createSettlementEngine({
      stripe: { apiKey: 'sk_test_mock' },
      web3: { rpcUrl: 'http://mock' },
      github: { token: 'mock_token' },
      compute: { provider: 'test' }
    });
  });

  test('should handle complete KPack purchase flow', async () => {
    // Simulate KPack manifest
    const kpackManifest = {
      name: 'enterprise-api-template',
      version: '2.1.0',
      payment: {
        fiat: 49.99,
        reputation: 750,
        custom: {
          enterprise_credits: 5
        }
      },
      metadata: {
        author: 'kgen-official',
        category: 'enterprise',
        license: 'commercial'
      }
    };

    // Parse payment requirements
    const requirement = ValueVector.fromKPackManifest(kpackManifest);
    
    // Verify requirement structure
    assert.strictEqual(requirement.dimensions.fiat, 49.99);
    assert.strictEqual(requirement.dimensions.reputation, 750);
    assert.strictEqual(requirement.dimensions.enterprise_credits, 5);

    // Settle payment with enterprise policy
    const result = await engine.settle({
      userId: 'enterprise_user_001',
      kpackId: kpackManifest.name,
      requirement,
      policy: PolicyTemplates.ENTERPRISE_TIER,
      metadata: {
        kpackVersion: kpackManifest.version,
        marketplace: 'kgen-official',
        purchaseType: 'enterprise-license'
      }
    });

    assert.ok(result.success);
    assert.ok(result.receipt);
    assert.strictEqual(result.receipt.transaction.kpackId, kpackManifest.name);
    assert.ok(result.receipt.metadata.kpackVersion);
  });

  test('should handle subscription-based vesting', async () => {
    const subscriptionManifest = {
      name: 'premium-ai-toolkit',
      payment: {
        fiat: 299.99, // Annual subscription
        reputation: 1000
      }
    };

    const requirement = ValueVector.fromKPackManifest(subscriptionManifest);
    
    // Create custom vesting policy for subscription
    const subscriptionPolicy = {
      type: 'vesting',
      currentTime: '2024-03-15T00:00:00Z', // 2.5 months into year
      vestingSchedule: [
        {
          percentage: 25,
          startTime: '2024-01-01T00:00:00Z',
          endTime: '2024-04-01T00:00:00Z'
        },
        {
          percentage: 25,
          startTime: '2024-04-01T00:00:00Z',
          endTime: '2024-07-01T00:00:00Z'
        },
        {
          percentage: 25,
          startTime: '2024-07-01T00:00:00Z',
          endTime: '2024-10-01T00:00:00Z'
        },
        {
          percentage: 25,
          startTime: '2024-10-01T00:00:00Z',
          endTime: '2025-01-01T00:00:00Z'
        }
      ]
    };

    const result = await engine.settle({
      userId: 'subscription_user',
      kpackId: subscriptionManifest.name,
      requirement,
      policy: subscriptionPolicy,
      metadata: {
        subscriptionType: 'annual',
        billingCycle: 'monthly-vested'
      }
    });

    assert.ok(result.success);
    assert.ok(result.receipt.policy);
  });

  test('should handle community contributor discounts', async () => {
    const communityManifest = {
      name: 'open-source-starter',
      payment: {
        fiat: 19.99,
        reputation: 500,
        compute: 100
      }
    };

    const requirement = ValueVector.fromKPackManifest(communityManifest);

    const result = await engine.settle({
      userId: 'contributor_123',
      kpackId: communityManifest.name,
      requirement,
      policy: PolicyTemplates.COMMUNITY_CONTRIBUTOR,
      metadata: {
        contributorLevel: 'active',
        githubStars: 2500,
        discountApplied: true
      }
    });

    assert.ok(result.success);
    assert.strictEqual(result.receipt.metadata.contributorLevel, 'active');
  });

  test('should handle multi-currency flexible payment', async () => {
    const flexibleManifest = {
      name: 'cross-platform-sdk',
      payment: {
        fiat: 39.99,
        crypto: 0.015, // ~$40 in ETH
        reputation: 800,
        compute: 200
      }
    };

    const requirement = ValueVector.fromKPackManifest(flexibleManifest);

    // User has only crypto and compute
    const cryptoUser = {
      fiat: 0,
      crypto: 0.02,
      reputation: 100,
      compute: 250
    };

    // Mock user balances
    const stripeAdapter = engine.adapterRegistry.get('fiat');
    const web3Adapter = engine.adapterRegistry.get('crypto');
    const githubAdapter = engine.adapterRegistry.get('reputation');
    const computeAdapter = engine.adapterRegistry.get('compute');

    await stripeAdapter.setBalance('crypto_user', cryptoUser.fiat);
    await web3Adapter.setBalance('crypto_user', cryptoUser.crypto);
    await githubAdapter.setBalance('crypto_user', cryptoUser.reputation);
    await computeAdapter.setBalance('crypto_user', cryptoUser.compute);

    const result = await engine.settle({
      userId: 'crypto_user',
      kpackId: flexibleManifest.name,
      requirement,
      policy: PolicyTemplates.FLEXIBLE_PAYMENT,
      metadata: {
        paymentMethod: 'crypto-preferred',
        conversionRate: 'market-rate'
      }
    });

    assert.ok(result.success);
    
    // Should have used crypto to satisfy payment
    const operations = result.receipt.transaction.operations;
    const cryptoOperation = operations.find(op => op.dimension === 'crypto');
    assert.ok(cryptoOperation);
    assert.strictEqual(cryptoOperation.amount, 0.015);
  });

  test('should handle compute-heavy AI workflow payment', async () => {
    const aiWorkflowManifest = {
      name: 'ml-training-pipeline',
      payment: {
        fiat: 199.99,
        compute: 5000, // Significant compute requirement
        reputation: 300
      }
    };

    const requirement = ValueVector.fromKPackManifest(aiWorkflowManifest);

    const result = await engine.settle({
      userId: 'ai_researcher',
      kpackId: aiWorkflowManifest.name,
      requirement,
      policy: PolicyTemplates.COMPUTE_FOCUSED,
      metadata: {
        workflowType: 'ml-training',
        estimatedRuntime: '48-hours',
        gpuRequired: true,
        resourceTier: 'high-performance'
      }
    });

    assert.ok(result.success);
    
    // Verify compute allocation
    const computeOperation = result.receipt.transaction.operations
      .find(op => op.dimension === 'compute');
    assert.ok(computeOperation);
    assert.strictEqual(computeOperation.amount, 5000);
  });

  test('should handle failed payment with rollback', async () => {
    const expensiveManifest = {
      name: 'enterprise-mega-suite',
      payment: {
        fiat: 10000, // Very expensive
        reputation: 5000,
        compute: 10000
      }
    };

    const requirement = ValueVector.fromKPackManifest(expensiveManifest);

    // User has insufficient funds
    const poorUser = 'insufficient_user';
    const stripeAdapter = engine.adapterRegistry.get('fiat');
    await stripeAdapter.setBalance(poorUser, 100); // Way too little

    const result = await engine.settle({
      userId: poorUser,
      kpackId: expensiveManifest.name,
      requirement,
      metadata: {
        attemptedPurchase: 'enterprise-mega-suite'
      }
    });

    assert.ok(!result.success);
    assert.ok(result.error);
    assert.ok(result.error.includes('Insufficient funds'));
    
    // Verify no transaction was recorded
    const history = engine.getTransactionHistory(poorUser);
    const failedTransaction = history.find(tx => tx.kpackId === expensiveManifest.name);
    assert.ok(!failedTransaction || failedTransaction.status !== 'completed');
  });

  test('should track complete transaction audit trail', async () => {
    const manifest = {
      name: 'audit-test-kpack',
      payment: {
        fiat: 25,
        reputation: 100
      }
    };

    const requirement = ValueVector.fromKPackManifest(manifest);
    const userId = 'audit_user';

    // Make multiple purchases
    for (let i = 0; i < 3; i++) {
      await engine.settle({
        userId,
        kpackId: `${manifest.name}-v${i + 1}`,
        requirement,
        metadata: {
          purchaseNumber: i + 1,
          testRun: true
        }
      });
    }

    const history = engine.getTransactionHistory(userId);
    assert.strictEqual(history.length, 3);
    
    // Verify chronological order (newest first)
    assert.ok(new Date(history[0].timestamp) >= new Date(history[1].timestamp));
    assert.ok(new Date(history[1].timestamp) >= new Date(history[2].timestamp));
    
    // Verify each transaction has complete data
    for (const transaction of history) {
      assert.ok(transaction.id);
      assert.strictEqual(transaction.userId, userId);
      assert.ok(transaction.kpackId.startsWith(manifest.name));
      assert.strictEqual(transaction.status, 'completed');
      assert.ok(transaction.operations.length > 0);
    }
  });
});