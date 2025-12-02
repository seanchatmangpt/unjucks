/**
 * Payment Adapter Registry
 * Manages different payment adapters for various currency types
 */

class AdapterRegistry {
  constructor() {
    this.adapters = new Map();
  }

  /**
   * Register a payment adapter for a dimension
   */
  async register(dimension, adapter) {
    if (!adapter.name || !adapter.debit || !adapter.credit || !adapter.getBalance) {
      throw new Error(`Invalid adapter for dimension ${dimension}: missing required methods`);
    }

    await adapter.initialize?.();
    this.adapters.set(dimension, adapter);
    console.log(`Registered ${adapter.name} adapter for ${dimension} dimension`);
  }

  /**
   * Get adapter for dimension
   */
  get(dimension) {
    return this.adapters.get(dimension);
  }

  /**
   * Get all registered adapters
   */
  getAll() {
    return this.adapters;
  }

  /**
   * Check if adapter exists for dimension
   */
  has(dimension) {
    return this.adapters.has(dimension);
  }

  /**
   * Remove adapter
   */
  unregister(dimension) {
    return this.adapters.delete(dimension);
  }
}

export { AdapterRegistry };