/**
 * Settlement Policies Export Module
 */

export { PolicyEngine } from './engine.js';

/**
 * Pre-defined policy templates
 */
export const PolicyTemplates = {
  /**
   * Flexible payment: fiat OR crypto OR reputation
   */
  FLEXIBLE_PAYMENT: {
    type: 'logical',
    operator: 'or',
    rules: [
      { type: 'dimension', dimension: 'fiat' },
      { type: 'dimension', dimension: 'crypto' },
      { type: 'dimension', dimension: 'reputation' }
    ]
  },

  /**
   * Premium access: fiat AND reputation
   */
  PREMIUM_ACCESS: {
    type: 'logical',
    operator: 'and',
    rules: [
      { type: 'dimension', dimension: 'fiat' },
      { type: 'dimension', dimension: 'reputation', multiplier: 0.5 }
    ]
  },

  /**
   * Enterprise tier: high requirements across all dimensions
   */
  ENTERPRISE_TIER: {
    type: 'logical',
    operator: 'and',
    rules: [
      { type: 'dimension', dimension: 'fiat', multiplier: 2.0 },
      { type: 'dimension', dimension: 'reputation', multiplier: 1.5 }
    ]
  },

  /**
   * Compute-focused: compute credits OR fiat
   */
  COMPUTE_FOCUSED: {
    type: 'logical',
    operator: 'or',
    rules: [
      { type: 'dimension', dimension: 'compute' },
      { type: 'dimension', dimension: 'fiat', multiplier: 1.2 }
    ]
  },

  /**
   * Partial payment: 70% of any combination
   */
  PARTIAL_PAYMENT: {
    type: 'threshold',
    threshold: 70,
    mode: 'percentage'
  },

  /**
   * Subscription vesting: unlocks over 12 months
   */
  SUBSCRIPTION_VESTING: {
    type: 'vesting',
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
  },

  /**
   * Community contributor: reputation-heavy
   */
  COMMUNITY_CONTRIBUTOR: {
    type: 'composite',
    operator: 'or',
    policies: [
      {
        type: 'logical',
        operator: 'and',
        rules: [
          { type: 'dimension', dimension: 'reputation', multiplier: 2.0 },
          { type: 'dimension', dimension: 'compute', multiplier: 0.1 }
        ]
      },
      {
        type: 'simple',
        dimensions: ['fiat']
      }
    ]
  }
};