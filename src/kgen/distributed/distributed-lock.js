/**
 * Distributed Lock Implementation for KGEN Cluster
 * 
 * Provides distributed locking mechanism for coordinating access to shared resources
 * across multiple nodes in the KGEN cluster. Supports Redis and consensus-based backends.
 */

import EventEmitter from 'events';
import crypto from 'crypto';

export class DistributedLock extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.backend = options.backend || 'redis'; // redis, consensus, memory
    this.connection = options.connection || {};
    this.nodeId = options.nodeId || crypto.randomUUID();
    this.debug = options.debug || false;
    
    this.config = {
      defaultTTL: options.defaultTTL || 30000, // 30 seconds
      maxTTL: options.maxTTL || 300000, // 5 minutes
      renewInterval: options.renewInterval || 10000, // 10 seconds
      acquireTimeout: options.acquireTimeout || 60000, // 1 minute
      retryDelay: options.retryDelay || 1000, // 1 second
      maxRetries: options.maxRetries || 10,
      clockDriftFactor: options.clockDriftFactor || 0.01, // 1% clock drift allowance
      ...options.config
    };
    
    // Internal state
    this.client = null;
    this.activeLocks = new Map(); // lockKey -> lockInfo
    this.renewalTimers = new Map(); // lockKey -> timer
    this.pendingAcquisitions = new Map(); // lockKey -> promise
    
    // Statistics
    this.statistics = {
      locksAcquired: 0,
      locksReleased: 0,
      locksFailed: 0,
      locksExpired: 0,
      renewalsSucceeded: 0,
      renewalsFailed: 0,
      averageHoldTime: 0,
      totalHoldTime: 0,
      currentActiveLocks: 0
    };
  }
  
  /**
   * Initialize the distributed lock system
   */
  async initialize() {
    try {
      if (this.debug) {
        console.log(`[DistributedLock] Initializing ${this.backend} distributed lock system`);
      }
      
      switch (this.backend) {
        case 'redis':
          await this.initializeRedis();
          break;
          
        case 'consensus':
          await this.initializeConsensus();
          break;
          
        case 'memory':
          await this.initializeMemory();
          break;
          
        default:
          throw new Error(`Unsupported backend: ${this.backend}`);
      }
      
      if (this.debug) {
        console.log(`[DistributedLock] Distributed lock system initialized`);
      }
      
      return { success: true };
      
    } catch (error) {
      console.error(`[DistributedLock] Initialization failed:`, error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Initialize Redis-based distributed locks
   */
  async initializeRedis() {
    // Simulated Redis client for demonstration
    this.client = {
      type: 'redis',
      storage: new Map(),
      
      // SET key value PX milliseconds NX - atomic set if not exists with expiration
      setNX: async (key, value, ttl) => {
        if (this.client.storage.has(key)) {
          const existing = this.client.storage.get(key);
          if (existing.expiry > this.getDeterministicTimestamp()) {
            return false; // Key exists and not expired
          }
          // Clean up expired key
          this.client.storage.delete(key);
        }
        
        this.client.storage.set(key, {
          value,
          expiry: this.getDeterministicTimestamp() + ttl,
          timestamp: this.getDeterministicTimestamp()
        });
        
        return true;
      },
      
      // GET key
      get: async (key) => {
        const entry = this.client.storage.get(key);
        if (!entry) return null;
        
        if (entry.expiry <= this.getDeterministicTimestamp()) {
          this.client.storage.delete(key);
          return null;
        }
        
        return entry.value;
      },
      
      // DELETE key if value matches (atomic)
      deleteIfValue: async (key, expectedValue) => {
        const entry = this.client.storage.get(key);
        if (!entry) return false;
        
        if (entry.value === expectedValue) {
          this.client.storage.delete(key);
          return true;
        }
        
        return false;
      },
      
      // Extend TTL if value matches (atomic)
      extendIfValue: async (key, expectedValue, newTTL) => {
        const entry = this.client.storage.get(key);
        if (!entry) return false;
        
        if (entry.value === expectedValue && entry.expiry > this.getDeterministicTimestamp()) {
          entry.expiry = this.getDeterministicTimestamp() + newTTL;
          return true;
        }
        
        return false;
      }
    };
  }
  
  /**
   * Initialize consensus-based distributed locks
   */
  async initializeConsensus() {
    // Simulated consensus-based locking
    this.client = {
      type: 'consensus',
      nodes: new Map(), // nodeId -> nodeState
      locks: new Map(), // lockKey -> { owner, expiry, votes }
      
      acquireLock: async (key, nodeId, ttl) => {
        // Simplified consensus: majority of nodes must agree
        const lock = this.client.locks.get(key);
        
        if (lock && lock.expiry > this.getDeterministicTimestamp() && lock.owner !== nodeId) {
          return false; // Lock held by another node
        }
        
        // Grant lock
        this.client.locks.set(key, {
          owner: nodeId,
          expiry: this.getDeterministicTimestamp() + ttl,
          timestamp: this.getDeterministicTimestamp(),
          votes: 1 // Simplified - in real implementation would require majority
        });
        
        return true;
      },
      
      releaseLock: async (key, nodeId) => {
        const lock = this.client.locks.get(key);
        if (lock && lock.owner === nodeId) {
          this.client.locks.delete(key);
          return true;
        }
        return false;
      },
      
      renewLock: async (key, nodeId, newTTL) => {
        const lock = this.client.locks.get(key);
        if (lock && lock.owner === nodeId && lock.expiry > this.getDeterministicTimestamp()) {
          lock.expiry = this.getDeterministicTimestamp() + newTTL;
          return true;
        }
        return false;
      }
    };
  }
  
  /**
   * Initialize memory-based distributed locks (for testing)
   */
  async initializeMemory() {
    this.client = {
      type: 'memory',
      locks: new Map(),
      
      acquire: async (key, nodeId, ttl) => {
        const existing = this.client.locks.get(key);
        if (existing && existing.expiry > this.getDeterministicTimestamp()) {
          return false;
        }
        
        this.client.locks.set(key, {
          owner: nodeId,
          expiry: this.getDeterministicTimestamp() + ttl,
          timestamp: this.getDeterministicTimestamp()
        });
        
        return true;
      },
      
      release: async (key, nodeId) => {
        const lock = this.client.locks.get(key);
        if (lock && lock.owner === nodeId) {
          this.client.locks.delete(key);
          return true;
        }
        return false;
      },
      
      renew: async (key, nodeId, newTTL) => {
        const lock = this.client.locks.get(key);
        if (lock && lock.owner === nodeId) {
          lock.expiry = this.getDeterministicTimestamp() + newTTL;
          return true;
        }
        return false;
      }
    };
  }
  
  /**
   * Acquire a distributed lock
   */
  async acquire(lockKey, options = {}) {
    const ttl = Math.min(options.ttl || this.config.defaultTTL, this.config.maxTTL);
    const timeout = options.timeout || this.config.acquireTimeout;
    const nodeId = options.nodeId || this.nodeId;
    const lockValue = `${nodeId}:${crypto.randomUUID()}:${this.getDeterministicTimestamp()}`;
    
    // Check if we already have a pending acquisition for this lock
    if (this.pendingAcquisitions.has(lockKey)) {
      return await this.pendingAcquisitions.get(lockKey);
    }
    
    const acquisitionPromise = this.attemptAcquisition(lockKey, lockValue, ttl, timeout, nodeId);
    this.pendingAcquisitions.set(lockKey, acquisitionPromise);
    
    try {
      const result = await acquisitionPromise;
      return result;
    } finally {
      this.pendingAcquisitions.delete(lockKey);
    }
  }
  
  /**
   * Attempt to acquire lock with retries
   */
  async attemptAcquisition(lockKey, lockValue, ttl, timeout, nodeId) {
    const startTime = this.getDeterministicTimestamp();
    let attempt = 0;
    
    while (this.getDeterministicTimestamp() - startTime < timeout && attempt < this.config.maxRetries) {
      attempt++;
      
      try {
        const acquired = await this.tryAcquire(lockKey, lockValue, ttl);
        
        if (acquired) {
          // Lock acquired successfully
          const lockInfo = {
            key: lockKey,
            value: lockValue,
            nodeId,
            ttl,
            acquiredAt: this.getDeterministicTimestamp(),
            expiresAt: this.getDeterministicTimestamp() + ttl,
            renewCount: 0
          };
          
          this.activeLocks.set(lockKey, lockInfo);
          this.startAutoRenewal(lockKey);
          
          this.statistics.locksAcquired++;
          this.statistics.currentActiveLocks++;
          
          if (this.debug) {
            console.log(`[DistributedLock] Acquired lock: ${lockKey} (attempt ${attempt})`);
          }
          
          this.emit('lock:acquired', { lockKey, nodeId, attempt });
          
          return {
            success: true,
            lockKey,
            lockValue,
            expiresAt: lockInfo.expiresAt,
            attempt
          };
        }
        
      } catch (error) {
        if (this.debug) {
          console.log(`[DistributedLock] Acquire attempt ${attempt} failed: ${error.message}`);
        }
      }
      
      // Wait before retry
      if (attempt < this.config.maxRetries && this.getDeterministicTimestamp() - startTime < timeout) {
        await this.sleep(this.config.retryDelay * Math.min(attempt, 5)); // Exponential backoff cap
      }
    }
    
    // Failed to acquire lock
    this.statistics.locksFailed++;
    
    if (this.debug) {
      console.log(`[DistributedLock] Failed to acquire lock: ${lockKey} after ${attempt} attempts`);
    }
    
    this.emit('lock:failed', { lockKey, nodeId, attempts: attempt });
    
    return {
      success: false,
      lockKey,
      error: `Failed to acquire lock after ${attempt} attempts`,
      attempts: attempt
    };
  }
  
  /**
   * Try to acquire lock once
   */
  async tryAcquire(lockKey, lockValue, ttl) {
    switch (this.backend) {
      case 'redis':
        return await this.client.setNX(lockKey, lockValue, ttl);
        
      case 'consensus':
        return await this.client.acquireLock(lockKey, this.nodeId, ttl);
        
      case 'memory':
        return await this.client.acquire(lockKey, this.nodeId, ttl);
        
      default:
        throw new Error(`Unsupported backend: ${this.backend}`);
    }
  }
  
  /**
   * Release a distributed lock
   */
  async release(lockKey) {
    const lockInfo = this.activeLocks.get(lockKey);
    if (!lockInfo) {
      if (this.debug) {
        console.log(`[DistributedLock] Attempted to release unknown lock: ${lockKey}`);
      }
      return { success: false, error: 'Lock not found' };
    }
    
    try {
      let released = false;
      
      switch (this.backend) {
        case 'redis':
          released = await this.client.deleteIfValue(lockKey, lockInfo.value);
          break;
          
        case 'consensus':
          released = await this.client.releaseLock(lockKey, lockInfo.nodeId);
          break;
          
        case 'memory':
          released = await this.client.release(lockKey, lockInfo.nodeId);
          break;
      }
      
      if (released) {
        this.stopAutoRenewal(lockKey);
        this.activeLocks.delete(lockKey);
        
        const holdTime = this.getDeterministicTimestamp() - lockInfo.acquiredAt;
        this.updateHoldTimeStatistics(holdTime);
        
        this.statistics.locksReleased++;
        this.statistics.currentActiveLocks--;
        
        if (this.debug) {
          console.log(`[DistributedLock] Released lock: ${lockKey}`);
        }
        
        this.emit('lock:released', { lockKey, holdTime });
        
        return { success: true, holdTime };
      } else {
        // Lock was already expired or released
        this.stopAutoRenewal(lockKey);
        this.activeLocks.delete(lockKey);
        
        if (this.debug) {
          console.log(`[DistributedLock] Lock already released or expired: ${lockKey}`);
        }
        
        return { success: false, error: 'Lock already released or expired' };
      }
      
    } catch (error) {
      console.error(`[DistributedLock] Failed to release lock ${lockKey}:`, error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Renew a distributed lock
   */
  async renew(lockKey, options = {}) {
    const lockInfo = this.activeLocks.get(lockKey);
    if (!lockInfo) {
      return { success: false, error: 'Lock not found' };
    }
    
    const newTTL = options.ttl || this.config.defaultTTL;
    
    try {
      let renewed = false;
      
      switch (this.backend) {
        case 'redis':
          renewed = await this.client.extendIfValue(lockKey, lockInfo.value, newTTL);
          break;
          
        case 'consensus':
          renewed = await this.client.renewLock(lockKey, lockInfo.nodeId, newTTL);
          break;
          
        case 'memory':
          renewed = await this.client.renew(lockKey, lockInfo.nodeId, newTTL);
          break;
      }
      
      if (renewed) {
        lockInfo.expiresAt = this.getDeterministicTimestamp() + newTTL;
        lockInfo.renewCount++;
        
        this.statistics.renewalsSucceeded++;
        
        if (this.debug) {
          console.log(`[DistributedLock] Renewed lock: ${lockKey} (count: ${lockInfo.renewCount})`);
        }
        
        this.emit('lock:renewed', { lockKey, newExpiry: lockInfo.expiresAt });
        
        return { success: true, expiresAt: lockInfo.expiresAt };
      } else {
        // Lock expired or was released
        this.handleLockExpired(lockKey);
        this.statistics.renewalsFailed++;
        
        return { success: false, error: 'Lock expired or was released' };
      }
      
    } catch (error) {
      this.statistics.renewalsFailed++;
      console.error(`[DistributedLock] Failed to renew lock ${lockKey}:`, error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Start automatic renewal for a lock
   */
  startAutoRenewal(lockKey) {
    const lockInfo = this.activeLocks.get(lockKey);
    if (!lockInfo) return;
    
    const renewalTimer = setInterval(async () => {
      const result = await this.renew(lockKey);
      
      if (!result.success) {
        if (this.debug) {
          console.log(`[DistributedLock] Auto-renewal failed for ${lockKey}, stopping timer`);
        }
        this.stopAutoRenewal(lockKey);
      }
    }, this.config.renewInterval);
    
    this.renewalTimers.set(lockKey, renewalTimer);
  }
  
  /**
   * Stop automatic renewal for a lock
   */
  stopAutoRenewal(lockKey) {
    const timer = this.renewalTimers.get(lockKey);
    if (timer) {
      clearInterval(timer);
      this.renewalTimers.delete(lockKey);
    }
  }
  
  /**
   * Handle lock expiration
   */
  handleLockExpired(lockKey) {
    const lockInfo = this.activeLocks.get(lockKey);
    if (lockInfo) {
      this.stopAutoRenewal(lockKey);
      this.activeLocks.delete(lockKey);
      
      this.statistics.locksExpired++;
      this.statistics.currentActiveLocks--;
      
      if (this.debug) {
        console.log(`[DistributedLock] Lock expired: ${lockKey}`);
      }
      
      this.emit('lock:expired', { lockKey });
    }
  }
  
  /**
   * Check if we currently hold a specific lock
   */
  hasLock(lockKey) {
    return this.activeLocks.has(lockKey);
  }
  
  /**
   * Get information about a held lock
   */
  getLockInfo(lockKey) {
    return this.activeLocks.get(lockKey) || null;
  }
  
  /**
   * Get all currently held locks
   */
  getActiveLocks() {
    return Array.from(this.activeLocks.values());
  }
  
  /**
   * Execute a function while holding a lock
   */
  async withLock(lockKey, fn, options = {}) {
    const lockResult = await this.acquire(lockKey, options);
    
    if (!lockResult.success) {
      throw new Error(`Failed to acquire lock: ${lockResult.error}`);
    }
    
    try {
      const result = await fn();
      return result;
    } finally {
      await this.release(lockKey);
    }
  }
  
  /**
   * Get lock statistics
   */
  getStatistics() {
    return {
      ...this.statistics,
      backend: this.backend,
      nodeId: this.nodeId,
      activeRenewals: this.renewalTimers.size
    };
  }
  
  /**
   * Update hold time statistics
   */
  updateHoldTimeStatistics(holdTime) {
    this.statistics.totalHoldTime += holdTime;
    const releasedLocks = this.statistics.locksReleased || 1;
    this.statistics.averageHoldTime = this.statistics.totalHoldTime / releasedLocks;
  }
  
  /**
   * Health check for the distributed lock system
   */
  async healthCheck() {
    try {
      const testKey = `health:${this.nodeId}:${this.getDeterministicTimestamp()}`;
      
      // Test acquire
      const acquired = await this.acquire(testKey, { ttl: 10000 });
      
      if (!acquired.success) {
        return {
          healthy: false,
          error: 'Failed to acquire test lock',
          statistics: this.getStatistics()
        };
      }
      
      // Test release
      const released = await this.release(testKey);
      
      if (!released.success) {
        return {
          healthy: false,
          error: 'Failed to release test lock',
          statistics: this.getStatistics()
        };
      }
      
      return {
        healthy: true,
        backend: this.backend,
        activeLocks: this.statistics.currentActiveLocks,
        statistics: this.getStatistics()
      };
      
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
        statistics: this.getStatistics()
      };
    }
  }
  
  /**
   * Cleanup expired locks and timers
   */
  cleanup() {
    const now = this.getDeterministicTimestamp();
    const expiredLocks = [];
    
    for (const [lockKey, lockInfo] of this.activeLocks) {
      if (lockInfo.expiresAt <= now) {
        expiredLocks.push(lockKey);
      }
    }
    
    for (const lockKey of expiredLocks) {
      this.handleLockExpired(lockKey);
    }
    
    if (this.debug && expiredLocks.length > 0) {
      console.log(`[DistributedLock] Cleaned up ${expiredLocks.length} expired locks`);
    }
  }
  
  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Shutdown distributed lock system gracefully
   */
  async shutdown() {
    if (this.debug) {
      console.log(`[DistributedLock] Shutting down distributed lock system`);
    }
    
    // Release all active locks
    const activeLockKeys = Array.from(this.activeLocks.keys());
    const releasePromises = activeLockKeys.map(lockKey => this.release(lockKey));
    
    await Promise.allSettled(releasePromises);
    
    // Clear all timers
    for (const timer of this.renewalTimers.values()) {
      clearInterval(timer);
    }
    this.renewalTimers.clear();
    
    // Clear pending acquisitions
    this.pendingAcquisitions.clear();
    
    // Close client connection if applicable
    if (this.client && this.client.close) {
      await this.client.close();
    }
    
    this.emit('shutdown');
    
    if (this.debug) {
      console.log(`[DistributedLock] Distributed lock system shut down`);
    }
  }
}

export default DistributedLock;
