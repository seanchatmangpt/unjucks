/**
 * Cross-test communication and shared fixtures system
 * Provides utilities for test coordination and data sharing
 */

import { EventEmitter } from 'events';
import fs from 'fs-extra';
import path from 'node:path';
import { tmpdir } from 'node:os';

export class CrossTestCommunication extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      persistState: options.persistState !== false,
      stateFile: options.stateFile || path.join(tmpdir(), 'unjucks-test-state.json'),
      maxSharedData: options.maxSharedData || 100, // Max number of shared data entries
      cleanupInterval: options.cleanupInterval || 60000, // 1 minute
      maxAge: options.maxAge || 300000, // 5 minutes
      enablePubSub: options.enablePubSub !== false,
      ...options
    };
    
    this.sharedData = new Map();
    this.subscribers = new Map();
    this.messageQueue = [];
    this.cleanupTimer = null;
    
    // Load persisted state
    if (this.options.persistState) {
      this.loadState();
    }
    
    // Start cleanup timer
    this.startCleanupTimer();
  }

  /**
   * Store shared data between tests
   */
  async setSharedData(key, data, options = {}) {
    const {
      ttl = this.options.maxAge,
      persistent = false,
      notify = true
    } = options;
    
    const entry = {
      key,
      data,
      timestamp: Date.now(),
      ttl,
      persistent,
      testId: this.getCurrentTestId()
    };
    
    this.sharedData.set(key, entry);
    
    // Limit size of shared data
    if (this.sharedData.size > this.options.maxSharedData) {
      this.cleanupOldEntries();
    }
    
    // Persist if needed
    if (persistent && this.options.persistState) {
      await this.saveState();
    }
    
    // Notify subscribers
    if (notify && this.options.enablePubSub) {
      this.emit('dataChanged', { key, data, action: 'set' });
      this.notifySubscribers(key, 'set', data);
    }
    
    return entry;
  }

  /**
   * Get shared data
   */
  getSharedData(key, defaultValue = null) {
    const entry = this.sharedData.get(key);
    
    if (!entry) {
      return defaultValue;
    }
    
    // Check if expired
    if (this.isExpired(entry)) {
      this.sharedData.delete(key);
      return defaultValue;
    }
    
    return entry.data;
  }

  /**
   * Check if shared data exists
   */
  hasSharedData(key) {
    const entry = this.sharedData.get(key);
    return entry && !this.isExpired(entry);
  }

  /**
   * Delete shared data
   */
  async deleteSharedData(key) {
    const entry = this.sharedData.get(key);
    const deleted = this.sharedData.delete(key);
    
    if (deleted && this.options.persistState) {
      await this.saveState();
    }
    
    if (deleted && this.options.enablePubSub) {
      this.emit('dataChanged', { key, action: 'delete' });
      this.notifySubscribers(key, 'delete', null);
    }
    
    return deleted;
  }

  /**
   * List all shared data keys
   */
  listSharedData(filterExpired = true) {
    const keys = Array.from(this.sharedData.keys());
    
    if (!filterExpired) {
      return keys;
    }
    
    return keys.filter(key => {
      const entry = this.sharedData.get(key);
      return entry && !this.isExpired(entry);
    });
  }

  /**
   * Subscribe to data changes
   */
  subscribe(pattern, callback) {
    const subscriptionId = this.generateSubscriptionId();
    
    if (!this.subscribers.has(pattern)) {
      this.subscribers.set(pattern, new Map());
    }
    
    this.subscribers.get(pattern).set(subscriptionId, callback);
    
    return {
      id: subscriptionId,
      unsubscribe: () => this.unsubscribe(pattern, subscriptionId)
    };
  }

  /**
   * Unsubscribe from data changes
   */
  unsubscribe(pattern, subscriptionId) {
    const patternSubscribers = this.subscribers.get(pattern);
    if (patternSubscribers) {
      const deleted = patternSubscribers.delete(subscriptionId);
      
      // Clean up empty pattern
      if (patternSubscribers.size === 0) {
        this.subscribers.delete(pattern);
      }
      
      return deleted;
    }
    return false;
  }

  /**
   * Publish message to subscribers
   */
  publish(channel, message) {
    this.emit('message', { channel, message });
    
    // Add to message queue for replay
    this.messageQueue.push({
      channel,
      message,
      timestamp: Date.now(),
      testId: this.getCurrentTestId()
    });
    
    // Limit message queue size
    if (this.messageQueue.length > 1000) {
      this.messageQueue = this.messageQueue.slice(-500);
    }
    
    // Notify channel subscribers
    this.notifyChannelSubscribers(channel, message);
  }

  /**
   * Subscribe to messages on channel
   */
  subscribeToChannel(channel, callback) {
    return this.subscribe(channel, callback);
  }

  /**
   * Wait for shared data to be available
   */
  async waitForSharedData(key, timeout = 10000, pollInterval = 100) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      if (this.hasSharedData(key)) {
        return this.getSharedData(key);
      }
      
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
    
    throw new Error(`Timeout waiting for shared data: ${key}`);
  }

  /**
   * Wait for message on channel
   */
  async waitForMessage(channel, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        subscription.unsubscribe();
        reject(new Error(`Timeout waiting for message on channel: ${channel}`));
      }, timeout);
      
      const subscription = this.subscribeToChannel(channel, (message) => {
        clearTimeout(timer);
        subscription.unsubscribe();
        resolve(message);
      });
    });
  }

  /**
   * Create test barrier for synchronization
   */
  async createBarrier(barrierId, expectedCount, timeout = 30000) {
    const key = `barrier:${barrierId}`;
    const currentCount = this.getSharedData(key, 0) + 1;
    
    await this.setSharedData(key, currentCount, { 
      ttl: timeout,
      notify: true 
    });
    
    if (currentCount >= expectedCount) {
      // Barrier reached, notify all waiting tests
      this.publish(`barrier:${barrierId}:complete`, { count: currentCount });
      return true;
    }
    
    // Wait for barrier to complete
    try {
      await this.waitForMessage(`barrier:${barrierId}:complete`, timeout);
      return true;
    } catch (error) {
      // Clean up barrier data on timeout
      await this.deleteSharedData(key);
      throw error;
    }
  }

  /**
   * Share test fixtures between tests
   */
  async shareFixture(name, content, metadata = {}) {
    const fixtureKey = `fixture:${name}`;
    const fixtureData = {
      content,
      metadata: {
        ...metadata,
        createdAt: new Date().toISOString(),
        createdBy: this.getCurrentTestId(),
        size: typeof content === 'string' ? content.length : JSON.stringify(content).length
      }
    };
    
    await this.setSharedData(fixtureKey, fixtureData, {
      persistent: true,
      ttl: metadata.ttl || this.options.maxAge * 2 // Fixtures live longer
    });
    
    return fixtureKey;
  }

  /**
   * Get shared fixture
   */
  getFixture(name) {
    const fixtureData = this.getSharedData(`fixture:${name}`);
    return fixtureData ? fixtureData.content : null;
  }

  /**
   * List available fixtures
   */
  listFixtures() {
    return this.listSharedData()
      .filter(key => key.startsWith('fixture:'))
      .map(key => ({
        name: key.replace('fixture:', ''),
        key,
        metadata: this.getSharedData(key).metadata
      }));
  }

  /**
   * Create test result aggregator
   */
  async reportTestResult(testName, result) {
    const resultKey = `result:${testName}`;
    const resultData = {
      ...result,
      testName,
      timestamp: new Date().toISOString(),
      testId: this.getCurrentTestId()
    };
    
    await this.setSharedData(resultKey, resultData, {
      persistent: true,
      notify: true
    });
    
    // Aggregate results
    const aggregateKey = 'results:aggregate';
    const currentAggregate = this.getSharedData(aggregateKey, {
      total: 0,
      passed: 0,
      failed: 0,
      results: []
    });
    
    currentAggregate.total++;
    if (result.success) {
      currentAggregate.passed++;
    } else {
      currentAggregate.failed++;
    }
    currentAggregate.results.push(resultData);
    
    await this.setSharedData(aggregateKey, currentAggregate, {
      persistent: true,
      notify: true
    });
  }

  /**
   * Get aggregated test results
   */
  getTestResults() {
    return this.getSharedData('results:aggregate', {
      total: 0,
      passed: 0,
      failed: 0,
      results: []
    });
  }

  /**
   * Notify subscribers matching pattern
   */
  notifySubscribers(key, action, data) {
    for (const [pattern, subscribers] of this.subscribers) {
      if (this.matchesPattern(key, pattern)) {
        for (const [subscriptionId, callback] of subscribers) {
          try {
            callback({ key, action, data, pattern });
          } catch (error) {
            console.warn(`Subscriber error for pattern ${pattern}:`, error);
          }
        }
      }
    }
  }

  /**
   * Notify channel subscribers
   */
  notifyChannelSubscribers(channel, message) {
    const subscribers = this.subscribers.get(channel);
    if (subscribers) {
      for (const [subscriptionId, callback] of subscribers) {
        try {
          callback(message);
        } catch (error) {
          console.warn(`Channel subscriber error for ${channel}:`, error);
        }
      }
    }
  }

  /**
   * Check if key matches pattern
   */
  matchesPattern(key, pattern) {
    if (pattern === '*') return true;
    if (pattern === key) return true;
    
    // Simple wildcard matching
    const regex = new RegExp(
      '^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$'
    );
    return regex.test(key);
  }

  /**
   * Check if entry is expired
   */
  isExpired(entry) {
    if (!entry.ttl) return false;
    return Date.now() - entry.timestamp > entry.ttl;
  }

  /**
   * Clean up old entries
   */
  cleanupOldEntries() {
    const now = Date.now();
    const toDelete = [];
    
    for (const [key, entry] of this.sharedData) {
      if (this.isExpired(entry)) {
        toDelete.push(key);
      }
    }
    
    // Keep only the most recent entries if still too many
    if (this.sharedData.size - toDelete.length > this.options.maxSharedData) {
      const entries = Array.from(this.sharedData.entries())
        .filter(([key]) => !toDelete.includes(key))
        .sort(([, a], [, b]) => b.timestamp - a.timestamp);
      
      const keepCount = this.options.maxSharedData - toDelete.length;
      const extraEntries = entries.slice(keepCount);
      
      for (const [key] of extraEntries) {
        toDelete.push(key);
      }
    }
    
    for (const key of toDelete) {
      this.sharedData.delete(key);
    }
  }

  /**
   * Start cleanup timer
   */
  startCleanupTimer() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    
    this.cleanupTimer = setInterval(() => {
      this.cleanupOldEntries();
    }, this.options.cleanupInterval);
  }

  /**
   * Load persisted state
   */
  async loadState() {
    try {
      if (await fs.pathExists(this.options.stateFile)) {
        const state = await fs.readJson(this.options.stateFile);
        
        // Restore non-expired entries
        for (const [key, entry] of Object.entries(state.sharedData || {})) {
          if (!this.isExpired(entry)) {
            this.sharedData.set(key, entry);
          }
        }
      }
    } catch (error) {
      console.warn('Failed to load test state:', error.message);
    }
  }

  /**
   * Save state to file
   */
  async saveState() {
    try {
      const state = {
        sharedData: Object.fromEntries(
          Array.from(this.sharedData.entries())
            .filter(([, entry]) => entry.persistent)
        ),
        timestamp: Date.now()
      };
      
      await fs.ensureDir(path.dirname(this.options.stateFile));
      await fs.writeJson(this.options.stateFile, state, { spaces: 2 });
    } catch (error) {
      console.warn('Failed to save test state:', error.message);
    }
  }

  /**
   * Generate unique subscription ID
   */
  generateSubscriptionId() {
    return `sub-${Date.now()}-${Math.random().toString(36).substring(2)}`;
  }

  /**
   * Get current test ID
   */
  getCurrentTestId() {
    // Try to get test name from various sources
    const testName = process.env.TEST_NAME || 
                    global.currentTestName || 
                    'unknown-test';
    
    return `${testName}-${process.pid}-${Date.now()}`;
  }

  /**
   * Clean up all resources
   */
  async cleanup() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    
    // Save persistent data
    if (this.options.persistState) {
      await this.saveState();
    }
    
    // Clear all data
    this.sharedData.clear();
    this.subscribers.clear();
    this.messageQueue = [];
    
    this.removeAllListeners();
  }

  /**
   * Get communication statistics
   */
  getStats() {
    return {
      sharedDataCount: this.sharedData.size,
      subscriberCount: Array.from(this.subscribers.values())
        .reduce((sum, subs) => sum + subs.size, 0),
      messageQueueSize: this.messageQueue.length,
      patterns: Array.from(this.subscribers.keys()),
      memoryUsage: this.calculateMemoryUsage()
    };
  }

  /**
   * Calculate approximate memory usage
   */
  calculateMemoryUsage() {
    const dataSize = Array.from(this.sharedData.values())
      .reduce((sum, entry) => {
        return sum + JSON.stringify(entry).length;
      }, 0);
    
    const messageSize = this.messageQueue
      .reduce((sum, msg) => sum + JSON.stringify(msg).length, 0);
    
    return {
      sharedData: dataSize,
      messageQueue: messageSize,
      total: dataSize + messageSize
    };
  }
}

/**
 * Global communication instance
 */
export const globalCommunication = new CrossTestCommunication();

/**
 * Convenience functions
 */
export async function setSharedData(key, data, options) {
  return globalCommunication.setSharedData(key, data, options);
}

export function getSharedData(key, defaultValue) {
  return globalCommunication.getSharedData(key, defaultValue);
}

export function publishMessage(channel, message) {
  return globalCommunication.publish(channel, message);
}

export function subscribeToMessages(channel, callback) {
  return globalCommunication.subscribeToChannel(channel, callback);
}

export async function createTestBarrier(barrierId, expectedCount, timeout) {
  return globalCommunication.createBarrier(barrierId, expectedCount, timeout);
}

export async function shareFixture(name, content, metadata) {
  return globalCommunication.shareFixture(name, content, metadata);
}

export function getFixture(name) {
  return globalCommunication.getFixture(name);
}

export default CrossTestCommunication;