/**
 * Policy Engine Tests
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { PolicyEngine, PolicyTemplates, ValueVector } from '../src/index.js';

describe('PolicyEngine', () => {
  let engine;
  let userBalances;
  let requirement;

  beforeEach(() => {
    engine = new PolicyEngine();
    userBalances = new ValueVector({
      fiat: 100,
      crypto: 2.0,
      reputation: 1000,
      compute: 500
    });
    requirement = new ValueVector({
      fiat: 50,
      crypto: 0.5,
      reputation: 300,
      compute: 100
    });
  });

  test('should evaluate default policy (all dimensions required)', () => {
    const result = engine.evaluate(userBalances, requirement);
    assert.ok(result);
  });

  test('should reject when default policy not satisfied', () => {
    const poorUser = new ValueVector({
      fiat: 10, // Insufficient
      crypto: 0.1,
      reputation: 50
    });
    
    const result = engine.evaluate(poorUser, requirement);
    assert.ok(!result);
  });

  test('should evaluate simple AND policy', () => {
    const policy = {
      type: 'simple',
      dimensions: ['fiat', 'reputation'],
      operator: 'and'
    };
    
    const result = engine.evaluate(userBalances, requirement, policy);
    assert.ok(result);
  });

  test('should evaluate simple OR policy', () => {
    const policy = {
      type: 'simple',
      dimensions: ['fiat', 'reputation'],
      operator: 'or'
    };
    
    // User with only fiat should pass OR policy
    const fiatOnlyUser = new ValueVector({
      fiat: 100,
      crypto: 0,
      reputation: 0,
      compute: 0
    });
    
    const result = engine.evaluate(fiatOnlyUser, requirement, policy);
    assert.ok(result);
  });

  test('should evaluate logical policy with nested rules', () => {
    const policy = {
      type: 'logical',
      operator: 'and',
      rules: [
        { type: 'dimension', dimension: 'fiat' },
        { type: 'dimension', dimension: 'reputation', multiplier: 0.5 }
      ]
    };
    
    const result = engine.evaluate(userBalances, requirement, policy);
    assert.ok(result);
  });

  test('should evaluate threshold policy (percentage mode)', () => {
    const policy = {
      type: 'threshold',
      threshold: 75, // Need 75% of total requirement
      mode: 'percentage'
    };
    
    // User has 75% of required funds
    const partialUser = new ValueVector({
      fiat: 38,  // 75% of 50
      crypto: 0.375, // 75% of 0.5
      reputation: 225, // 75% of 300
      compute: 75 // 75% of 100
    });
    
    const result = engine.evaluate(partialUser, requirement, policy);
    assert.ok(result);
  });

  test('should evaluate threshold policy (minimum dimensions mode)', () => {
    const policy = {
      type: 'threshold',
      threshold: 2, // Need at least 2 dimensions satisfied
      mode: 'minimum_dimensions'
    };
    
    // User satisfies fiat and reputation only
    const twoElementUser = new ValueVector({
      fiat: 100,
      crypto: 0.1, // Insufficient
      reputation: 500,
      compute: 50 // Insufficient
    });
    
    const result = engine.evaluate(twoElementUser, requirement, policy);
    assert.ok(result);
  });

  test('should evaluate vesting policy', () => {
    const now = new Date('2024-06-15T00:00:00Z'); // Middle of vesting period
    
    const policy = {
      type: 'vesting',
      currentTime: now.toISOString(),
      vestingSchedule: [
        {
          percentage: 50,
          startTime: '2024-01-01T00:00:00Z',
          endTime: '2024-06-01T00:00:00Z'
        },
        {
          percentage: 50,
          startTime: '2024-06-01T00:00:00Z',
          endTime: '2024-12-01T00:00:00Z'
        }
      ]
    };
    
    // Should only need ~60% of requirement due to vesting
    const vestedUser = new ValueVector({
      fiat: 35,      // ~70% of required 50
      crypto: 0.35,  // ~70% of required 0.5
      reputation: 210, // ~70% of required 300
      compute: 70    // ~70% of required 100
    });
    
    const result = engine.evaluate(vestedUser, requirement, policy);
    assert.ok(result);
  });

  test('should evaluate composite policy', () => {
    const policy = {
      type: 'composite',
      operator: 'or',
      policies: [
        {
          type: 'simple',
          dimensions: ['fiat'],
          operator: 'and'
        },
        {
          type: 'logical',
          operator: 'and',
          rules: [
            { type: 'dimension', dimension: 'reputation' },
            { type: 'dimension', dimension: 'compute' }
          ]
        }
      ]
    };
    
    // User with only reputation + compute should pass
    const reputeUser = new ValueVector({
      fiat: 10, // Insufficient alone
      crypto: 0.1,
      reputation: 500,
      compute: 200
    });
    
    const result = engine.evaluate(reputeUser, requirement, policy);
    assert.ok(result);
  });

  test('should parse simple policy string', () => {
    const policy = engine.parseSimplePolicyString('fiat AND reputation');
    assert.strictEqual(policy.type, 'logical');
    assert.strictEqual(policy.operator, 'and');
    assert.strictEqual(policy.rules.length, 2);
    assert.strictEqual(policy.rules[0].dimension, 'fiat');
    assert.strictEqual(policy.rules[1].dimension, 'reputation');
  });

  test('should handle XOR operator', () => {
    const results = [true, false, false];
    assert.ok(engine.applyLogicalOperator(results, 'xor'));
    
    const multipleTrue = [true, true, false];
    assert.ok(!engine.applyLogicalOperator(multipleTrue, 'xor'));
  });

  test('should handle NAND operator', () => {
    const allTrue = [true, true, true];
    assert.ok(!engine.applyLogicalOperator(allTrue, 'nand'));
    
    const someFalse = [true, false, true];
    assert.ok(engine.applyLogicalOperator(someFalse, 'nand'));
  });
});

describe('PolicyTemplates', () => {
  let userBalances;
  let requirement;
  let engine;

  beforeEach(() => {
    engine = new PolicyEngine();
    userBalances = new ValueVector({
      fiat: 100,
      crypto: 2.0,
      reputation: 1000,
      compute: 500
    });
    requirement = new ValueVector({
      fiat: 50,
      crypto: 0.5,
      reputation: 300
    });
  });

  test('FLEXIBLE_PAYMENT should work with any single dimension', () => {
    // User with only crypto
    const cryptoUser = new ValueVector({
      fiat: 0,
      crypto: 1.0,
      reputation: 0
    });
    
    const result = engine.evaluate(cryptoUser, requirement, PolicyTemplates.FLEXIBLE_PAYMENT);
    assert.ok(result);
  });

  test('PREMIUM_ACCESS should require fiat AND reputation', () => {
    const result = engine.evaluate(userBalances, requirement, PolicyTemplates.PREMIUM_ACCESS);
    assert.ok(result);
    
    // User with only fiat should fail
    const fiatOnly = new ValueVector({
      fiat: 100,
      crypto: 0,
      reputation: 0
    });
    
    const failResult = engine.evaluate(fiatOnly, requirement, PolicyTemplates.PREMIUM_ACCESS);
    assert.ok(!failResult);
  });

  test('PARTIAL_PAYMENT should accept 70% of requirement', () => {
    const partialUser = new ValueVector({
      fiat: 40,     // 80% of 50
      crypto: 0.35, // 70% of 0.5
      reputation: 210 // 70% of 300
    });
    
    const result = engine.evaluate(partialUser, requirement, PolicyTemplates.PARTIAL_PAYMENT);
    assert.ok(result);
  });

  test('COMPUTE_FOCUSED should accept compute OR fiat', () => {
    const computeRequirement = new ValueVector({
      fiat: 50,
      compute: 100
    });
    
    // User with only compute
    const computeUser = new ValueVector({
      fiat: 0,
      compute: 150
    });
    
    const result = engine.evaluate(computeUser, computeRequirement, PolicyTemplates.COMPUTE_FOCUSED);
    assert.ok(result);
  });
});