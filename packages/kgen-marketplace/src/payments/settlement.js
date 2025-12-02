/**
 * N-Dimensional Payment Settlement System
 * Handles multiple currency types with policy-based value exchange
 */

import { createHash } from 'crypto';
import { PolicyEngine } from '../policies/engine.js';
import { ReceiptGenerator } from '../receipts/generator.js';
import { AdapterRegistry } from '../adapters/registry.js';

/**
 * Value vector representing multi-dimensional payment requirements
 */
class ValueVector {
  constructor(dimensions = {}) {
    this.dimensions = dimensions; // e.g., { fiat: 10, crypto: 0.001, reputation: 100, compute: 50 }
    this.timestamp = new Date().toISOString();
    this.id = this.generateId();
  }

  generateId() {
    const content = JSON.stringify(this.dimensions) + this.timestamp;
    return createHash('sha256').update(content).digest('hex').slice(0, 16);
  }

  /**
   * Parse value vector from KPack manifest
   */
  static fromKPackManifest(manifest) {
    const dimensions = {};
    
    if (manifest.payment) {
      // Standard payment fields
      if (manifest.payment.fiat) dimensions.fiat = manifest.payment.fiat;
      if (manifest.payment.crypto) dimensions.crypto = manifest.payment.crypto;
      if (manifest.payment.reputation) dimensions.reputation = manifest.payment.reputation;
      if (manifest.payment.compute) dimensions.compute = manifest.payment.compute;
      
      // Custom dimension support
      if (manifest.payment.custom) {
        Object.assign(dimensions, manifest.payment.custom);
      }
    }
    
    return new ValueVector(dimensions);
  }

  /**
   * Check if this vector satisfies another vector's requirements
   */
  satisfies(requirement, policy = null) {
    if (policy) {
      return PolicyEngine.evaluate(this, requirement, policy);
    }
    
    // Default: all dimensions must be >= requirement
    for (const [dimension, value] of Object.entries(requirement.dimensions)) {
      if (!this.dimensions[dimension] || this.dimensions[dimension] < value) {
        return false;
      }
    }
    return true;
  }

  /**
   * Subtract another vector (for balance deduction)
   */
  subtract(other) {
    const result = { ...this.dimensions };
    for (const [dimension, value] of Object.entries(other.dimensions)) {
      result[dimension] = (result[dimension] || 0) - value;
    }
    return new ValueVector(result);
  }

  /**
   * Add another vector (for balance addition)
   */
  add(other) {
    const result = { ...this.dimensions };
    for (const [dimension, value] of Object.entries(other.dimensions)) {
      result[dimension] = (result[dimension] || 0) + value;
    }
    return new ValueVector(result);
  }

  toString() {
    return `ValueVector(${JSON.stringify(this.dimensions)})`;
  }
}

/**
 * Main settlement engine
 */
class SettlementEngine {
  constructor(config = {}) {
    this.config = config;
    this.policyEngine = new PolicyEngine();
    this.receiptGenerator = new ReceiptGenerator();
    this.adapterRegistry = new AdapterRegistry();
    this.transactions = new Map(); // In-memory transaction store
  }

  /**
   * Initialize with payment adapters
   */
  async initialize(adapters = {}) {
    if (adapters.stripe) {
      await this.adapterRegistry.register('fiat', adapters.stripe);
    }
    if (adapters.web3) {
      await this.adapterRegistry.register('crypto', adapters.web3);
    }
    if (adapters.github) {
      await this.adapterRegistry.register('reputation', adapters.github);
    }
    if (adapters.compute) {
      await this.adapterRegistry.register('compute', adapters.compute);
    }
  }

  /**
   * Process settlement request
   */
  async settle({
    userId,
    kpackId,
    requirement,
    policy = null,
    metadata = {}
  }) {
    const transactionId = this.generateTransactionId();
    
    try {
      // Step 1: Parse requirement vector
      const requirementVector = requirement instanceof ValueVector 
        ? requirement 
        : new ValueVector(requirement);

      // Step 2: Check user balances across all dimensions
      const userBalances = await this.getUserBalances(userId);
      
      // Step 3: Evaluate if policy is satisfied
      const canSettle = policy 
        ? this.policyEngine.evaluate(userBalances, requirementVector, policy)
        : userBalances.satisfies(requirementVector);

      if (!canSettle) {
        throw new Error('Insufficient funds or policy not satisfied');
      }

      // Step 4: Execute atomic transaction
      const receipt = await this.executeTransaction({
        transactionId,
        userId,
        kpackId,
        requirement: requirementVector,
        userBalances,
        policy,
        metadata
      });

      return {
        success: true,
        transactionId,
        receipt
      };

    } catch (error) {
      // Log error and return failure
      console.error(`Settlement failed for ${transactionId}:`, error.message);
      return {
        success: false,
        transactionId,
        error: error.message
      };
    }
  }

  /**
   * Execute atomic multi-dimensional transaction
   */
  async executeTransaction({
    transactionId,
    userId,
    kpackId,
    requirement,
    userBalances,
    policy,
    metadata
  }) {
    const transaction = {
      id: transactionId,
      userId,
      kpackId,
      requirement: requirement.dimensions,
      timestamp: new Date().toISOString(),
      status: 'pending',
      operations: []
    };

    try {
      // Execute each dimension's payment
      for (const [dimension, amount] of Object.entries(requirement.dimensions)) {
        if (amount <= 0) continue;

        const adapter = this.adapterRegistry.get(dimension);
        if (!adapter) {
          throw new Error(`No adapter registered for dimension: ${dimension}`);
        }

        const operation = await adapter.debit(userId, amount, {
          transactionId,
          kpackId,
          metadata
        });

        transaction.operations.push({
          dimension,
          amount,
          adapter: adapter.name,
          operationId: operation.id,
          status: 'completed'
        });
      }

      transaction.status = 'completed';
      this.transactions.set(transactionId, transaction);

      // Generate cryptographic receipt
      const receipt = await this.receiptGenerator.generate({
        transaction,
        policy,
        metadata
      });

      return receipt;

    } catch (error) {
      // Rollback operations
      await this.rollbackTransaction(transaction);
      throw error;
    }
  }

  /**
   * Rollback transaction operations
   */
  async rollbackTransaction(transaction) {
    for (const operation of transaction.operations.reverse()) {
      try {
        const adapter = this.adapterRegistry.get(operation.dimension);
        await adapter.credit(transaction.userId, operation.amount, {
          originalTransaction: transaction.id,
          reason: 'rollback'
        });
      } catch (rollbackError) {
        console.error(`Rollback failed for ${operation.operationId}:`, rollbackError);
      }
    }
    
    transaction.status = 'rolled_back';
    this.transactions.set(transaction.id, transaction);
  }

  /**
   * Get user balances across all dimensions
   */
  async getUserBalances(userId) {
    const balances = {};
    
    for (const [dimension, adapter] of this.adapterRegistry.getAll()) {
      try {
        balances[dimension] = await adapter.getBalance(userId);
      } catch (error) {
        console.warn(`Failed to get ${dimension} balance for ${userId}:`, error.message);
        balances[dimension] = 0;
      }
    }
    
    return new ValueVector(balances);
  }

  /**
   * Generate unique transaction ID
   */
  generateTransactionId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2);
    return `txn_${timestamp}_${random}`;
  }

  /**
   * Get transaction by ID
   */
  getTransaction(transactionId) {
    return this.transactions.get(transactionId);
  }

  /**
   * Get transaction history for user
   */
  getTransactionHistory(userId) {
    return Array.from(this.transactions.values())
      .filter(tx => tx.userId === userId)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }
}

export {
  ValueVector,
  SettlementEngine
};