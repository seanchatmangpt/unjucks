import { EventEmitter } from 'events';
import consola from 'consola';

/**
 * Enterprise Feature Flags Manager
 * Supports local flags, percentage rollouts, user targeting, and external providers
 */
export class FeatureFlagsManager extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      enabled: true,
      provider: 'local',
      refreshInterval: 30000, // 30 seconds
      flags: {},
      rollouts: {},
      ...config
    };
    
    this.flags = new Map();
    this.rollouts = new Map();
    this.providers = new Map();
    this.refreshTimer = null;
    this.logger = consola.withTag('feature-flags');
    
    // Initialize providers
    this.initializeProviders();
  }
  
  /**
   * Initialize feature flags providers
   */
  initializeProviders() {
    this.providers.set('local', new LocalFeatureFlagsProvider(this.config));
    
    // Additional providers can be registered
    // this.providers.set('launchdarkly', new LaunchDarklyProvider(this.config));
    // this.providers.set('unleash', new UnleashProvider(this.config));
    // this.providers.set('flipt', new FliptProvider(this.config));
  }
  
  /**
   * Initialize feature flags manager
   */
  async initialize() {
    if (!this.config.enabled) {
      this.logger.info('Feature flags disabled');
      return;
    }
    
    try {
      const provider = this.providers.get(this.config.provider);
      if (!provider) {
        throw new Error(`Unknown feature flags provider: ${this.config.provider}`);
      }
      
      await provider.initialize();
      await this.loadFlags();
      
      // Setup refresh timer
      if (this.config.refreshInterval > 0) {
        this.setupRefreshTimer();
      }
      
      this.logger.success(`Feature flags manager initialized with provider: ${this.config.provider}`);
      
    } catch (error) {
      this.logger.error('Failed to initialize feature flags manager:', error);
      throw error;
    }
  }
  
  /**
   * Load flags from provider
   */
  async loadFlags() {
    try {
      const provider = this.providers.get(this.config.provider);
      const { flags, rollouts } = await provider.getFlags();
      
      // Update flags
      this.flags.clear();
      for (const [key, value] of Object.entries(flags)) {
        this.flags.set(key, value);
      }
      
      // Update rollouts
      this.rollouts.clear();
      for (const [key, value] of Object.entries(rollouts)) {
        this.rollouts.set(key, value);
      }
      
      this.emit('flagsUpdated', { flags, rollouts });
      this.logger.debug(`Loaded ${this.flags.size} flags and ${this.rollouts.size} rollouts`);
      
    } catch (error) {
      this.logger.error('Failed to load feature flags:', error);
      throw error;
    }
  }
  
  /**
   * Check if a feature flag is enabled
   */
  isEnabled(flagName, context = {}) {
    if (!this.config.enabled) {
      return false;
    }
    
    try {
      // Check if flag exists
      if (!this.flags.has(flagName)) {
        this.logger.warn(`Feature flag '${flagName}' not found, defaulting to false`);
        return false;
      }
      
      const flagValue = this.flags.get(flagName);
      
      // Simple boolean flag
      if (typeof flagValue === 'boolean') {
        return flagValue;
      }
      
      // Complex flag with rollout rules
      if (this.rollouts.has(flagName)) {
        return this.evaluateRollout(flagName, context);
      }
      
      // Default to false for non-boolean values
      return Boolean(flagValue);
      
    } catch (error) {
      this.logger.error(`Error evaluating feature flag '${flagName}':`, error.message);
      return false;
    }
  }
  
  /**
   * Get flag value (supports non-boolean values)
   */
  getValue(flagName, defaultValue = null, context = {}) {
    if (!this.config.enabled) {
      return defaultValue;
    }
    
    try {
      if (!this.flags.has(flagName)) {
        return defaultValue;
      }
      
      const flagValue = this.flags.get(flagName);
      
      // Check rollout rules for complex flags
      if (this.rollouts.has(flagName)) {
        const rolloutConfig = this.rollouts.get(flagName);
        if (this.evaluateRollout(flagName, context)) {
          return rolloutConfig.value || flagValue;
        } else {
          return defaultValue;
        }
      }
      
      return flagValue;
      
    } catch (error) {
      this.logger.error(`Error getting feature flag value '${flagName}':`, error.message);
      return defaultValue;
    }
  }
  
  /**
   * Evaluate rollout rules for a flag
   */
  evaluateRollout(flagName, context = {}) {
    const rolloutConfig = this.rollouts.get(flagName);
    if (!rolloutConfig || !rolloutConfig.enabled) {
      return false;
    }
    
    // Check user groups
    if (rolloutConfig.userGroups && rolloutConfig.userGroups.length > 0) {
      const userGroup = context.userGroup || context.group;
      if (userGroup && rolloutConfig.userGroups.includes(userGroup)) {
        return true;
      }
    }
    
    // Check user ID targeting
    if (rolloutConfig.userIds && rolloutConfig.userIds.length > 0) {
      const userId = context.userId || context.user || context.id;
      if (userId && rolloutConfig.userIds.includes(userId)) {
        return true;
      }
    }
    
    // Check conditions
    if (rolloutConfig.conditions && rolloutConfig.conditions.length > 0) {
      const conditionsMatch = rolloutConfig.conditions.every(condition => {
        return this.evaluateCondition(condition, context);
      });
      
      if (conditionsMatch) {
        return true;
      }
    }
    
    // Check percentage rollout
    if (rolloutConfig.percentage > 0) {
      const userId = context.userId || context.user || context.id || 'anonymous';
      const hash = this.hashString(`${flagName}:${userId}`);
      const percentage = (hash % 100) + 1;
      
      if (percentage <= rolloutConfig.percentage) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Evaluate a single rollout condition
   */
  evaluateCondition(condition, context) {
    const { attribute, operator, value } = condition;
    const contextValue = context[attribute];
    
    switch (operator) {
      case 'eq':
        return contextValue === value;
      case 'ne':
        return contextValue !== value;
      case 'gt':
        return contextValue > value;
      case 'gte':
        return contextValue >= value;
      case 'lt':
        return contextValue < value;
      case 'lte':
        return contextValue <= value;
      case 'in':
        return Array.isArray(value) && value.includes(contextValue);
      case 'not_in':
        return Array.isArray(value) && !value.includes(contextValue);
      case 'contains':
        return typeof contextValue === 'string' && contextValue.includes(value);
      case 'starts_with':
        return typeof contextValue === 'string' && contextValue.startsWith(value);
      case 'ends_with':
        return typeof contextValue === 'string' && contextValue.endsWith(value);
      case 'regex':
        return typeof contextValue === 'string' && new RegExp(value).test(contextValue);
      default:
        this.logger.warn(`Unknown condition operator: ${operator}`);
        return false;
    }
  }
  
  /**
   * Hash string for percentage rollouts
   */
  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
  
  /**
   * Get all flags and their current state
   */
  getAllFlags(context = {}) {
    const result = {};
    
    for (const [flagName] of this.flags) {
      result[flagName] = {
        enabled: this.isEnabled(flagName, context),
        value: this.getValue(flagName, null, context)
      };
    }
    
    return result;
  }
  
  /**
   * Set a flag value (for local provider)
   */
  async setFlag(flagName, value, rolloutConfig = null) {
    const provider = this.providers.get(this.config.provider);
    
    if (!provider.setFlag) {
      throw new Error(`Provider '${this.config.provider}' does not support setting flags`);
    }
    
    await provider.setFlag(flagName, value, rolloutConfig);
    
    // Update local cache
    this.flags.set(flagName, value);
    if (rolloutConfig) {
      this.rollouts.set(flagName, rolloutConfig);
    }
    
    this.emit('flagChanged', { flagName, value, rolloutConfig });
  }
  
  /**
   * Remove a flag (for local provider)
   */
  async removeFlag(flagName) {
    const provider = this.providers.get(this.config.provider);
    
    if (!provider.removeFlag) {
      throw new Error(`Provider '${this.config.provider}' does not support removing flags`);
    }
    
    await provider.removeFlag(flagName);
    
    // Remove from local cache
    this.flags.delete(flagName);
    this.rollouts.delete(flagName);
    
    this.emit('flagRemoved', { flagName });
  }
  
  /**
   * Setup refresh timer
   */
  setupRefreshTimer() {
    this.refreshTimer = setInterval(async () => {
      try {
        await this.loadFlags();
      } catch (error) {
        this.logger.error('Failed to refresh feature flags:', error.message);
      }
    }, this.config.refreshInterval);
    
    this.logger.debug(`Feature flags refresh timer set to ${this.config.refreshInterval}ms`);
  }
  
  /**
   * Health check for feature flags manager
   */
  async healthCheck() {
    try {
      const provider = this.providers.get(this.config.provider);
      const providerHealth = await provider.healthCheck();
      
      return {
        status: 'healthy',
        enabled: this.config.enabled,
        provider: this.config.provider,
        flagsCount: this.flags.size,
        rolloutsCount: this.rollouts.size,
        refreshInterval: this.config.refreshInterval,
        ...providerHealth
      };
      
    } catch (error) {
      return {
        status: 'unhealthy',
        enabled: this.config.enabled,
        provider: this.config.provider,
        error: error.message
      };
    }
  }
  
  /**
   * Cleanup resources
   */
  destroy() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
    
    // Cleanup providers
    for (const provider of this.providers.values()) {
      if (provider.destroy) {
        provider.destroy();
      }
    }
    
    this.removeAllListeners();
    this.logger.info('Feature flags manager destroyed');
  }
}

/**
 * Local Feature Flags Provider
 */
class LocalFeatureFlagsProvider {
  constructor(config) {
    this.config = config;
    this.logger = consola.withTag('local-flags-provider');
  }
  
  async initialize() {
    this.logger.debug('Local feature flags provider initialized');
  }
  
  async getFlags() {
    return {
      flags: this.config.flags || {},
      rollouts: this.config.rollouts || {}
    };
  }
  
  async setFlag(flagName, value, rolloutConfig) {
    this.config.flags = this.config.flags || {};
    this.config.flags[flagName] = value;
    
    if (rolloutConfig) {
      this.config.rollouts = this.config.rollouts || {};
      this.config.rollouts[flagName] = rolloutConfig;
    }
  }
  
  async removeFlag(flagName) {
    if (this.config.flags) {
      delete this.config.flags[flagName];
    }
    
    if (this.config.rollouts) {
      delete this.config.rollouts[flagName];
    }
  }
  
  async healthCheck() {
    return {
      provider: 'local',
      status: 'healthy'
    };
  }
}

/**
 * LaunchDarkly Provider (placeholder for future implementation)
 */
class LaunchDarklyProvider {
  constructor(config) {
    this.config = config;
    this.logger = consola.withTag('launchdarkly-provider');
  }
  
  async initialize() {
    throw new Error('LaunchDarkly provider not implemented yet');
  }
  
  async getFlags() {
    throw new Error('LaunchDarkly provider not implemented yet');
  }
  
  async healthCheck() {
    return {
      provider: 'launchdarkly',
      status: 'not_implemented'
    };
  }
}

/**
 * Unleash Provider (placeholder for future implementation)
 */
class UnleashProvider {
  constructor(config) {
    this.config = config;
    this.logger = consola.withTag('unleash-provider');
  }
  
  async initialize() {
    throw new Error('Unleash provider not implemented yet');
  }
  
  async getFlags() {
    throw new Error('Unleash provider not implemented yet');
  }
  
  async healthCheck() {
    return {
      provider: 'unleash',
      status: 'not_implemented'
    };
  }
}

export default FeatureFlagsManager;