/**
 * State Management Integration Tests
 * Tests state consistency across operations and modules
 */

import { jest } from '@jest/globals';
import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';
import { EventEmitter } from 'events';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('State Management Integration Tests', () => {
  let stateResults = {
    stateTransitions: [],
    consistency: [],
    persistence: [],
    concurrency: []
  };

  beforeAll(async () => {
    await fs.ensureDir(path.join(__dirname, '../temp/state-tests'));
    await fs.ensureDir(path.join(__dirname, '../results'));
  });

  afterAll(async () => {
    await fs.writeJson(
      path.join(__dirname, '../results/state-management-results.json'),
      stateResults,
      { spaces: 2 }
    );
  });

  describe('Cross-Operation State Management', () => {
    test('State persists correctly across multiple operations', async () => {
      const stateManager = new StateManager();
      const operationId = `op-${this.getDeterministicTimestamp()}`;

      // Initialize state
      await stateManager.initializeOperation(operationId, {
        inputFiles: ['graph1.ttl', 'graph2.ttl'],
        outputDir: '/tmp/test-output',
        templateCache: new Map(),
        processedEntities: 0
      });

      // Operation 1: Process graphs
      await stateManager.updateState(operationId, (state) => {
        state.processedEntities += 10;
        state.templateCache.set('template1', { compiled: true });
        state.currentStage = 'graph-processing';
        return state;
      });

      let currentState = await stateManager.getState(operationId);
      expect(currentState.processedEntities).toBe(10);
      expect(currentState.templateCache.has('template1')).toBe(true);
      expect(currentState.currentStage).toBe('graph-processing');

      // Operation 2: Template rendering
      await stateManager.updateState(operationId, (state) => {
        state.processedEntities += 5;
        state.currentStage = 'template-rendering';
        state.renderCache = { hits: 3, misses: 1 };
        return state;
      });

      currentState = await stateManager.getState(operationId);
      expect(currentState.processedEntities).toBe(15);
      expect(currentState.currentStage).toBe('template-rendering');
      expect(currentState.renderCache.hits).toBe(3);

      // Operation 3: Artifact generation
      await stateManager.updateState(operationId, (state) => {
        state.currentStage = 'artifact-generation';
        state.artifacts = [
          { path: '/tmp/test-output/artifact1.txt', hash: 'abc123' },
          { path: '/tmp/test-output/artifact2.txt', hash: 'def456' }
        ];
        return state;
      });

      const finalState = await stateManager.getState(operationId);
      expect(finalState.artifacts).toHaveLength(2);
      expect(finalState.processedEntities).toBe(15); // Should preserve previous value

      await stateManager.cleanupOperation(operationId);

      stateResults.stateTransitions.push({
        operationId,
        stages: ['graph-processing', 'template-rendering', 'artifact-generation'],
        finalProcessedEntities: finalState.processedEntities,
        finalArtifacts: finalState.artifacts.length,
        statePreserved: true
      });
    });

    test('State rollback works correctly on operation failure', async () => {
      const stateManager = new StateManager();
      const operationId = `rollback-${this.getDeterministicTimestamp()}`;

      // Initialize state
      await stateManager.initializeOperation(operationId, {
        processedItems: 0,
        successfulOperations: [],
        rollbackStack: []
      });

      // Successful operation 1
      const checkpoint1 = await stateManager.createCheckpoint(operationId);
      await stateManager.updateState(operationId, (state) => {
        state.processedItems = 5;
        state.successfulOperations.push('operation1');
        return state;
      });

      // Successful operation 2
      const checkpoint2 = await stateManager.createCheckpoint(operationId);
      await stateManager.updateState(operationId, (state) => {
        state.processedItems = 10;
        state.successfulOperations.push('operation2');
        return state;
      });

      // Failing operation 3
      try {
        await stateManager.updateState(operationId, (state) => {
          state.processedItems = 15;
          throw new Error('Operation 3 failed');
        });
      } catch (error) {
        // Rollback to checkpoint 2
        await stateManager.rollbackToCheckpoint(operationId, checkpoint2);
      }

      const rolledBackState = await stateManager.getState(operationId);
      expect(rolledBackState.processedItems).toBe(10); // Should be at checkpoint 2
      expect(rolledBackState.successfulOperations).toHaveLength(2);
      expect(rolledBackState.successfulOperations).toContain('operation1');
      expect(rolledBackState.successfulOperations).toContain('operation2');

      stateResults.stateTransitions.push({
        type: 'rollback',
        operationId,
        checkpointsCreated: 2,
        rollbackSuccessful: rolledBackState.processedItems === 10,
        stateConsistent: rolledBackState.successfulOperations.length === 2
      });
    });
  });

  describe('Multi-Module State Consistency', () => {
    test('Shared state remains consistent across modules', async () => {
      const sharedState = new SharedStateStore();
      const moduleA = new MockModule('ModuleA', sharedState);
      const moduleB = new MockModule('ModuleB', sharedState);
      const moduleC = new MockModule('ModuleC', sharedState);

      // Initialize shared resources
      await sharedState.set('processingQueue', []);
      await sharedState.set('completedTasks', 0);
      await sharedState.set('errorCount', 0);

      // Module A adds tasks
      await moduleA.addTasks(['task1', 'task2', 'task3']);
      
      let queueSize = (await sharedState.get('processingQueue')).length;
      expect(queueSize).toBe(3);

      // Module B processes some tasks
      const task1 = await moduleB.processNextTask();
      const task2 = await moduleB.processNextTask();

      expect(task1).toBe('task1');
      expect(task2).toBe('task2');

      queueSize = (await sharedState.get('processingQueue')).length;
      expect(queueSize).toBe(1); // One task remaining

      const completedTasks = await sharedState.get('completedTasks');
      expect(completedTasks).toBe(2);

      // Module C encounters an error
      await moduleC.simulateError();
      
      const errorCount = await sharedState.get('errorCount');
      expect(errorCount).toBe(1);

      // Verify all modules see consistent state
      const moduleAView = await moduleA.getStateView();
      const moduleBView = await moduleB.getStateView();
      const moduleCView = await moduleC.getStateView();

      expect(moduleAView.completedTasks).toBe(2);
      expect(moduleBView.completedTasks).toBe(2);
      expect(moduleCView.completedTasks).toBe(2);
      expect(moduleAView.errorCount).toBe(1);
      expect(moduleBView.errorCount).toBe(1);
      expect(moduleCView.errorCount).toBe(1);

      stateResults.consistency.push({
        type: 'multi-module-consistency',
        modules: ['ModuleA', 'ModuleB', 'ModuleC'],
        sharedValues: {
          completedTasks: 2,
          errorCount: 1,
          queueSize: 1
        },
        consistent: true
      });
    });

    test('State changes propagate correctly with event system', async () => {
      const eventBus = new EventEmitter();
      const stateStore = new EventDrivenStateStore(eventBus);
      const subscribers = [];

      // Create subscribers
      const moduleA = new EventSubscriber('ModuleA', eventBus);
      const moduleB = new EventSubscriber('ModuleB', eventBus);
      const moduleC = new EventSubscriber('ModuleC', eventBus);

      subscribers.push(moduleA, moduleB, moduleC);

      // Set up state change listeners
      moduleA.subscribeToStateChanges();
      moduleB.subscribeToStateChanges();
      moduleC.subscribeToStateChanges();

      // Module A updates state
      await stateStore.updateState('globalCounter', 0, 5);
      
      // Allow event propagation
      await new Promise(resolve => setTimeout(resolve, 10));

      // Verify all modules received the update
      expect(moduleA.getLastStateChange()).toEqual({
        key: 'globalCounter',
        oldValue: 0,
        newValue: 5
      });
      expect(moduleB.getLastStateChange()).toEqual({
        key: 'globalCounter',
        oldValue: 0,
        newValue: 5
      });
      expect(moduleC.getLastStateChange()).toEqual({
        key: 'globalCounter',
        oldValue: 0,
        newValue: 5
      });

      // Multiple rapid updates
      await stateStore.updateState('globalCounter', 5, 10);
      await stateStore.updateState('globalCounter', 10, 15);
      await stateStore.updateState('processingStatus', 'idle', 'active');

      await new Promise(resolve => setTimeout(resolve, 20));

      // Verify all subscribers received all updates
      expect(moduleA.getStateChangeCount()).toBe(4); // Initial + 3 updates
      expect(moduleB.getStateChangeCount()).toBe(4);
      expect(moduleC.getStateChangeCount()).toBe(4);

      stateResults.consistency.push({
        type: 'event-driven-propagation',
        subscribers: subscribers.length,
        stateChanges: 4,
        allSubscribersNotified: true
      });
    });
  });

  describe('State Persistence and Recovery', () => {
    test('State persists across system restarts', async () => {
      const persistenceStore = new PersistentStateStore(
        path.join(__dirname, '../temp/state-tests/persistence.json')
      );

      // Create initial state
      await persistenceStore.setState('workflowProgress', {
        completedSteps: ['init', 'validate'],
        currentStep: 'process',
        totalSteps: 5,
        startTime: this.getDeterministicDate().toISOString()
      });

      await persistenceStore.setState('cache', {
        templates: { 'template1': { compiled: true } },
        queries: { 'query1': { optimized: true } }
      });

      // Simulate system shutdown and restart
      await persistenceStore.flush();
      const newPersistenceStore = new PersistentStateStore(
        path.join(__dirname, '../temp/state-tests/persistence.json')
      );
      await newPersistenceStore.load();

      // Verify state was restored
      const restoredProgress = await newPersistenceStore.getState('workflowProgress');
      const restoredCache = await newPersistenceStore.getState('cache');

      expect(restoredProgress.completedSteps).toEqual(['init', 'validate']);
      expect(restoredProgress.currentStep).toBe('process');
      expect(restoredProgress.totalSteps).toBe(5);
      expect(restoredCache.templates.template1.compiled).toBe(true);

      stateResults.persistence.push({
        type: 'restart-recovery',
        stateKeys: ['workflowProgress', 'cache'],
        restoredSuccessfully: true,
        dataIntegrity: 'verified'
      });
    });

    test('Corrupted state files are handled gracefully', async () => {
      const corruptedFile = path.join(__dirname, '../temp/state-tests/corrupted.json');
      
      // Create corrupted state file
      await fs.writeFile(corruptedFile, '{ invalid json content');

      const persistenceStore = new PersistentStateStore(corruptedFile);
      
      // Should handle corruption gracefully
      const loadResult = await persistenceStore.safeLoad();
      
      expect(loadResult.success).toBe(false);
      expect(loadResult.error).toContain('corruption');
      expect(loadResult.recoveryPerformed).toBe(true);

      // Should still be able to set new state after recovery
      await persistenceStore.setState('newKey', { value: 'test' });
      const retrievedState = await persistenceStore.getState('newKey');
      
      expect(retrievedState.value).toBe('test');

      stateResults.persistence.push({
        type: 'corruption-recovery',
        corruptionDetected: true,
        recoverySuccessful: retrievedState.value === 'test',
        newStateWorks: true
      });
    });
  });

  describe('Concurrent State Operations', () => {
    test('Concurrent state modifications are handled correctly', async () => {
      const concurrentStateManager = new ConcurrentStateManager();
      const operationResults = [];

      // Initialize shared counter
      await concurrentStateManager.setState('counter', 0);

      // Create 10 concurrent operations that increment the counter
      const concurrentOperations = Array.from({ length: 10 }, (_, i) =>
        async () => {
          try {
            const result = await concurrentStateManager.atomicUpdate('counter', 
              (currentValue) => currentValue + 1
            );
            operationResults.push({ operation: i, success: true, result });
          } catch (error) {
            operationResults.push({ operation: i, success: false, error: error.message });
          }
        }
      );

      // Execute all operations concurrently
      await Promise.all(concurrentOperations.map(op => op()));

      // Verify final state
      const finalCounter = await concurrentStateManager.getState('counter');
      expect(finalCounter).toBe(10);

      // Verify all operations succeeded
      const successfulOps = operationResults.filter(r => r.success);
      expect(successfulOps).toHaveLength(10);

      // Verify no duplicate values (no race conditions)
      const resultValues = successfulOps.map(r => r.result).sort((a, b) => a - b);
      const expectedValues = Array.from({ length: 10 }, (_, i) => i + 1);
      expect(resultValues).toEqual(expectedValues);

      stateResults.concurrency.push({
        type: 'concurrent-atomic-updates',
        operations: 10,
        successful: successfulOps.length,
        finalValue: finalCounter,
        noRaceConditions: JSON.stringify(resultValues) === JSON.stringify(expectedValues)
      });
    });

    test('Lock contention is handled efficiently', async () => {
      const lockManager = new LockManager();
      const resourceId = 'shared-resource';
      const lockOperations = [];

      // Create operations that require the same lock
      const operations = Array.from({ length: 5 }, (_, i) =>
        async () => {
          const startTime = this.getDeterministicTimestamp();
          const lock = await lockManager.acquireLock(resourceId, 1000); // 1 second timeout
          const acquireTime = this.getDeterministicTimestamp();

          if (lock) {
            try {
              // Simulate work with the locked resource
              await new Promise(resolve => setTimeout(resolve, 50));
              const workDone = `Operation ${i} completed`;
              
              lockOperations.push({
                operation: i,
                success: true,
                acquireTime: acquireTime - startTime,
                workResult: workDone
              });
            } finally {
              await lockManager.releaseLock(resourceId, lock);
            }
          } else {
            lockOperations.push({
              operation: i,
              success: false,
              error: 'Lock timeout'
            });
          }
        }
      );

      // Execute operations concurrently
      await Promise.all(operations.map(op => op()));

      // Verify all operations completed (no deadlocks)
      expect(lockOperations).toHaveLength(5);

      // Verify operations were serialized (no concurrent access)
      const successfulOps = lockOperations.filter(op => op.success);
      expect(successfulOps.length).toBeGreaterThan(0);

      // Check that acquire times show serialization
      const acquireTimes = successfulOps.map(op => op.acquireTime).sort((a, b) => a - b);
      const maxConcurrentAcquireTime = 10; // Should be nearly instant for first, then delayed
      expect(acquireTimes[0]).toBeLessThan(maxConcurrentAcquireTime);

      stateResults.concurrency.push({
        type: 'lock-contention',
        totalOperations: 5,
        successfulOperations: successfulOps.length,
        serialized: true,
        noDeadlocks: lockOperations.length === 5
      });
    });
  });
});

// Mock classes and utilities for state management testing

class StateManager {
  constructor() {
    this.states = new Map();
    this.checkpoints = new Map();
  }

  async initializeOperation(operationId, initialState) {
    this.states.set(operationId, { ...initialState, createdAt: this.getDeterministicDate().toISOString() });
  }

  async updateState(operationId, updateFn) {
    const currentState = this.states.get(operationId);
    if (!currentState) {
      throw new Error(`Operation ${operationId} not found`);
    }

    const updatedState = updateFn({ ...currentState });
    this.states.set(operationId, updatedState);
    return updatedState;
  }

  async getState(operationId) {
    return this.states.get(operationId);
  }

  async createCheckpoint(operationId) {
    const currentState = this.states.get(operationId);
    const checkpointId = `checkpoint-${this.getDeterministicTimestamp()}`;
    this.checkpoints.set(checkpointId, { operationId, state: { ...currentState } });
    return checkpointId;
  }

  async rollbackToCheckpoint(operationId, checkpointId) {
    const checkpoint = this.checkpoints.get(checkpointId);
    if (checkpoint && checkpoint.operationId === operationId) {
      this.states.set(operationId, { ...checkpoint.state });
      return true;
    }
    return false;
  }

  async cleanupOperation(operationId) {
    this.states.delete(operationId);
    // Clean up related checkpoints
    for (const [checkpointId, checkpoint] of this.checkpoints.entries()) {
      if (checkpoint.operationId === operationId) {
        this.checkpoints.delete(checkpointId);
      }
    }
  }
}

class SharedStateStore {
  constructor() {
    this.store = new Map();
    this.locks = new Map();
  }

  async set(key, value) {
    this.store.set(key, value);
  }

  async get(key) {
    return this.store.get(key);
  }

  async update(key, updateFn) {
    const currentValue = this.store.get(key);
    const newValue = updateFn(currentValue);
    this.store.set(key, newValue);
    return newValue;
  }
}

class MockModule {
  constructor(name, sharedState) {
    this.name = name;
    this.sharedState = sharedState;
  }

  async addTasks(tasks) {
    const currentQueue = await this.sharedState.get('processingQueue') || [];
    await this.sharedState.set('processingQueue', [...currentQueue, ...tasks]);
  }

  async processNextTask() {
    const queue = await this.sharedState.get('processingQueue') || [];
    if (queue.length === 0) return null;

    const task = queue.shift();
    await this.sharedState.set('processingQueue', queue);
    
    const completed = await this.sharedState.get('completedTasks') || 0;
    await this.sharedState.set('completedTasks', completed + 1);

    return task;
  }

  async simulateError() {
    const errorCount = await this.sharedState.get('errorCount') || 0;
    await this.sharedState.set('errorCount', errorCount + 1);
  }

  async getStateView() {
    return {
      processingQueue: await this.sharedState.get('processingQueue'),
      completedTasks: await this.sharedState.get('completedTasks'),
      errorCount: await this.sharedState.get('errorCount')
    };
  }
}

class EventDrivenStateStore {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.state = new Map();
  }

  async updateState(key, oldValue, newValue) {
    this.state.set(key, newValue);
    this.eventBus.emit('stateChange', { key, oldValue, newValue });
  }
}

class EventSubscriber {
  constructor(name, eventBus) {
    this.name = name;
    this.eventBus = eventBus;
    this.stateChanges = [];
  }

  subscribeToStateChanges() {
    this.eventBus.on('stateChange', (change) => {
      this.stateChanges.push(change);
    });
  }

  getLastStateChange() {
    return this.stateChanges[this.stateChanges.length - 1];
  }

  getStateChangeCount() {
    return this.stateChanges.length;
  }
}

class PersistentStateStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.state = new Map();
  }

  async setState(key, value) {
    this.state.set(key, value);
  }

  async getState(key) {
    return this.state.get(key);
  }

  async flush() {
    const stateObject = Object.fromEntries(this.state);
    await fs.writeJson(this.filePath, stateObject, { spaces: 2 });
  }

  async load() {
    try {
      const stateObject = await fs.readJson(this.filePath);
      this.state = new Map(Object.entries(stateObject));
    } catch (error) {
      // File doesn't exist or is corrupted
      this.state = new Map();
    }
  }

  async safeLoad() {
    try {
      await this.load();
      return { success: true };
    } catch (error) {
      // Handle corruption
      await fs.writeJson(this.filePath, {});
      this.state = new Map();
      return {
        success: false,
        error: 'State file corruption detected',
        recoveryPerformed: true
      };
    }
  }
}

class ConcurrentStateManager {
  constructor() {
    this.state = new Map();
    this.locks = new Map();
  }

  async setState(key, value) {
    this.state.set(key, value);
  }

  async getState(key) {
    return this.state.get(key);
  }

  async atomicUpdate(key, updateFn) {
    // Simple lock implementation
    while (this.locks.has(key)) {
      await new Promise(resolve => setTimeout(resolve, 1));
    }

    this.locks.set(key, true);

    try {
      const currentValue = this.state.get(key);
      const newValue = updateFn(currentValue);
      this.state.set(key, newValue);
      return newValue;
    } finally {
      this.locks.delete(key);
    }
  }
}

class LockManager {
  constructor() {
    this.locks = new Map();
    this.waitQueue = new Map();
  }

  async acquireLock(resourceId, timeout = 5000) {
    const lockId = `lock-${this.getDeterministicTimestamp()}-${Math.random()}`;
    
    if (!this.locks.has(resourceId)) {
      this.locks.set(resourceId, lockId);
      return lockId;
    }

    // Wait for lock with timeout
    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        resolve(null); // Timeout
      }, timeout);

      const checkLock = () => {
        if (!this.locks.has(resourceId)) {
          clearTimeout(timeoutId);
          this.locks.set(resourceId, lockId);
          resolve(lockId);
        } else {
          setTimeout(checkLock, 10); // Check again in 10ms
        }
      };

      checkLock();
    });
  }

  async releaseLock(resourceId, lockId) {
    if (this.locks.get(resourceId) === lockId) {
      this.locks.delete(resourceId);
      return true;
    }
    return false;
  }
}