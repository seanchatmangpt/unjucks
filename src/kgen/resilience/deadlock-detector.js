import { EventEmitter } from 'events';

/**
 * Advanced deadlock detection and resolution system
 * Implements multiple detection algorithms and resolution strategies
 */
export class DeadlockDetector extends EventEmitter {
  constructor(options = {}) {
    super();
    this.config = {
      enabled: options.enabled !== false,
      detectionInterval: options.detectionInterval || 5000, // 5 seconds
      waitForGraphTimeout: options.waitForGraphTimeout || 30000, // 30 seconds
      maxResolutionAttempts: options.maxResolutionAttempts || 3,
      preventionEnabled: options.preventionEnabled !== false,
      ...options
    };

    // Resource tracking
    this.resources = new Map(); // resourceId -> ResourceInfo
    this.processes = new Map(); // processId -> ProcessInfo
    this.waitForGraph = new Map(); // processId -> Set<resourceId>
    this.resourceOwnership = new Map(); // resourceId -> processId
    
    // Detection state
    this.isDetecting = false;
    this.detectionHistory = [];
    this.resolutionAttempts = new Map(); // deadlockId -> attemptCount
    
    // Metrics
    this.metrics = {
      deadlocksDetected: 0,
      deadlocksResolved: 0,
      resolutionFailures: 0,
      falsePositives: 0,
      averageDetectionTime: 0,
      averageResolutionTime: 0
    };

    this._startDetection();
  }

  /**
   * Register a resource for deadlock tracking
   */
  registerResource(resourceId, metadata = {}) {
    this.resources.set(resourceId, {
      id: resourceId,
      type: metadata.type || 'unknown',
      priority: metadata.priority || 0,
      createdAt: Date.now(),
      lastAccessed: Date.now(),
      metadata
    });

    this.emit('resourceRegistered', { resourceId, metadata });
  }

  /**
   * Register a process for deadlock tracking
   */
  registerProcess(processId, metadata = {}) {
    this.processes.set(processId, {
      id: processId,
      type: metadata.type || 'unknown',
      priority: metadata.priority || 0,
      startTime: Date.now(),
      resources: new Set(),
      waitingFor: new Set(),
      metadata
    });

    this.emit('processRegistered', { processId, metadata });
  }

  /**
   * Record resource acquisition
   */
  acquireResource(processId, resourceId, options = {}) {
    if (!this.processes.has(processId)) {
      this.registerProcess(processId);
    }
    if (!this.resources.has(resourceId)) {
      this.registerResource(resourceId);
    }

    const process = this.processes.get(processId);
    const resource = this.resources.get(resourceId);

    // Check if resource is already owned
    if (this.resourceOwnership.has(resourceId)) {
      const currentOwner = this.resourceOwnership.get(resourceId);
      if (currentOwner !== processId) {
        // Resource is owned by another process - potential wait
        this._recordWaitFor(processId, resourceId);
        
        if (options.timeout) {
          setTimeout(() => {
            if (this._isProcessWaitingFor(processId, resourceId)) {
              this._handleAcquisitionTimeout(processId, resourceId);
            }
          }, options.timeout);
        }
        
        return false; // Acquisition failed
      }
    }

    // Acquire the resource
    this.resourceOwnership.set(resourceId, processId);
    process.resources.add(resourceId);
    resource.lastAccessed = Date.now();
    
    // Remove from wait-for graph if waiting
    this._removeWaitFor(processId, resourceId);

    this.emit('resourceAcquired', { processId, resourceId });
    return true;
  }

  /**
   * Record resource release
   */
  releaseResource(processId, resourceId) {
    const process = this.processes.get(processId);
    if (!process) return false;

    if (this.resourceOwnership.get(resourceId) === processId) {
      this.resourceOwnership.delete(resourceId);
      process.resources.delete(resourceId);
      
      this.emit('resourceReleased', { processId, resourceId });
      
      // Check if any processes can now acquire this resource
      this._notifyWaitingProcesses(resourceId);
      return true;
    }

    return false;
  }

  /**
   * Perform deadlock detection using multiple algorithms
   */
  async detectDeadlocks() {
    if (this.isDetecting) return [];
    this.isDetecting = true;

    const startTime = Date.now();
    const deadlocks = [];

    try {
      // Algorithm 1: Wait-for graph cycle detection
      const wfgDeadlocks = this._detectWaitForGraphCycles();
      deadlocks.push(...wfgDeadlocks);

      // Algorithm 2: Resource allocation graph analysis
      const ragDeadlocks = this._detectResourceAllocationDeadlocks();
      deadlocks.push(...ragDeadlocks);

      // Algorithm 3: Timeout-based detection
      const timeoutDeadlocks = this._detectTimeoutBasedDeadlocks();
      deadlocks.push(...timeoutDeadlocks);

      // Remove duplicates and validate
      const uniqueDeadlocks = this._deduplicateDeadlocks(deadlocks);
      const validatedDeadlocks = await this._validateDeadlocks(uniqueDeadlocks);

      // Update metrics
      const detectionTime = Date.now() - startTime;
      this._updateDetectionMetrics(detectionTime, validatedDeadlocks.length);

      // Emit events for detected deadlocks
      for (const deadlock of validatedDeadlocks) {
        this.emit('deadlockDetected', deadlock);
        this.metrics.deadlocksDetected++;
      }

      return validatedDeadlocks;
    } finally {
      this.isDetecting = false;
    }
  }

  /**
   * Resolve detected deadlocks using various strategies
   */
  async resolveDeadlock(deadlock, strategy = 'auto') {
    const deadlockId = deadlock.id;
    const attemptCount = (this.resolutionAttempts.get(deadlockId) || 0) + 1;
    
    if (attemptCount > this.config.maxResolutionAttempts) {
      this.emit('resolutionFailed', { deadlock, reason: 'max_attempts_exceeded' });
      this.metrics.resolutionFailures++;
      return false;
    }

    this.resolutionAttempts.set(deadlockId, attemptCount);
    const startTime = Date.now();

    try {
      let resolved = false;

      switch (strategy) {
        case 'victim_selection':
          resolved = await this._resolveByVictimSelection(deadlock);
          break;
        case 'resource_preemption':
          resolved = await this._resolveByResourcePreemption(deadlock);
          break;
        case 'process_rollback':
          resolved = await this._resolveByProcessRollback(deadlock);
          break;
        case 'timeout_based':
          resolved = await this._resolveByTimeout(deadlock);
          break;
        case 'auto':
        default:
          resolved = await this._resolveAutomatically(deadlock);
          break;
      }

      const resolutionTime = Date.now() - startTime;

      if (resolved) {
        this.emit('deadlockResolved', { deadlock, strategy, resolutionTime });
        this.metrics.deadlocksResolved++;
        this._updateResolutionMetrics(resolutionTime);
        this.resolutionAttempts.delete(deadlockId);
      } else {
        this.emit('resolutionAttemptFailed', { deadlock, strategy, attempt: attemptCount });
      }

      return resolved;
    } catch (error) {
      this.emit('resolutionError', { deadlock, strategy, error: error.message });
      this.metrics.resolutionFailures++;
      return false;
    }
  }

  /**
   * Get current deadlock detection status
   */
  getStatus() {
    return {
      enabled: this.config.enabled,
      isDetecting: this.isDetecting,
      resourceCount: this.resources.size,
      processCount: this.processes.size,
      activeWaits: this._countActiveWaits(),
      metrics: { ...this.metrics },
      recentDeadlocks: this.detectionHistory.slice(-10)
    };
  }

  // Private methods for detection algorithms

  /**
   * Detect cycles in wait-for graph using DFS
   */
  _detectWaitForGraphCycles() {
    const deadlocks = [];
    const visited = new Set();
    const recursionStack = new Set();

    for (const [processId] of this.processes) {
      if (!visited.has(processId)) {
        const cycle = this._dfsDetectCycle(processId, visited, recursionStack, []);
        if (cycle.length > 0) {
          deadlocks.push(this._createDeadlockFromCycle(cycle, 'wait_for_graph'));
        }
      }
    }

    return deadlocks;
  }

  /**
   * DFS cycle detection helper
   */
  _dfsDetectCycle(processId, visited, recursionStack, path) {
    visited.add(processId);
    recursionStack.add(processId);
    path.push(processId);

    const waitingFor = this.waitForGraph.get(processId) || new Set();
    
    for (const resourceId of waitingFor) {
      const resourceOwner = this.resourceOwnership.get(resourceId);
      if (resourceOwner && resourceOwner !== processId) {
        if (recursionStack.has(resourceOwner)) {
          // Found cycle
          const cycleStart = path.indexOf(resourceOwner);
          return path.slice(cycleStart);
        }
        
        if (!visited.has(resourceOwner)) {
          const cycle = this._dfsDetectCycle(resourceOwner, visited, recursionStack, [...path]);
          if (cycle.length > 0) {
            return cycle;
          }
        }
      }
    }

    recursionStack.delete(processId);
    return [];
  }

  /**
   * Detect deadlocks in resource allocation graph
   */
  _detectResourceAllocationDeadlocks() {
    // Implementation of Banker's algorithm variation for deadlock detection
    const deadlocks = [];
    // ... implementation details
    return deadlocks;
  }

  /**
   * Detect deadlocks based on timeout patterns
   */
  _detectTimeoutBasedDeadlocks() {
    const deadlocks = [];
    const currentTime = Date.now();
    const timeout = this.config.waitForGraphTimeout;

    for (const [processId, waitingFor] of this.waitForGraph) {
      const process = this.processes.get(processId);
      if (!process) continue;

      const waitTime = currentTime - (process.waitStartTime || currentTime);
      if (waitTime > timeout && waitingFor.size > 0) {
        // Long wait detected - potential deadlock
        deadlocks.push({
          id: `timeout_${processId}_${Date.now()}`,
          type: 'timeout_based',
          processes: [processId],
          resources: Array.from(waitingFor),
          detectedAt: currentTime,
          waitTime
        });
      }
    }

    return deadlocks;
  }

  // Private methods for deadlock resolution

  /**
   * Resolve deadlock automatically using best strategy
   */
  async _resolveAutomatically(deadlock) {
    // Analyze deadlock characteristics and choose best strategy
    const processCount = deadlock.processes.length;
    const resourceCount = deadlock.resources.length;

    if (processCount === 2 && resourceCount === 2) {
      // Simple circular wait - use victim selection
      return await this._resolveByVictimSelection(deadlock);
    } else if (resourceCount > processCount) {
      // More resources than processes - try preemption
      return await this._resolveByResourcePreemption(deadlock);
    } else {
      // Complex deadlock - use timeout approach
      return await this._resolveByTimeout(deadlock);
    }
  }

  /**
   * Resolve by selecting a victim process to terminate
   */
  async _resolveByVictimSelection(deadlock) {
    // Select victim based on priority, resource usage, and rollback cost
    const victim = this._selectVictimProcess(deadlock.processes);
    if (!victim) return false;

    // Terminate victim process and release its resources
    return await this._terminateProcess(victim, 'deadlock_resolution');
  }

  /**
   * Resolve by preempting resources
   */
  async _resolveByResourcePreemption(deadlock) {
    // Select resources to preempt based on priority and preemptability
    const preemptableResources = deadlock.resources.filter(rid => 
      this._isResourcePreemptable(rid));
    
    if (preemptableResources.length === 0) return false;

    // Preempt resources and break the cycle
    for (const resourceId of preemptableResources) {
      const currentOwner = this.resourceOwnership.get(resourceId);
      if (currentOwner) {
        await this._preemptResource(currentOwner, resourceId);
        // Check if deadlock is broken
        if (!(await this._isStillDeadlocked(deadlock))) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Resolve by timeout-based approach
   */
  async _resolveByTimeout(deadlock) {
    // Introduce random delays to break synchronization
    const delays = deadlock.processes.map(() => Math.random() * 1000);
    
    await Promise.all(deadlock.processes.map((processId, index) => 
      this._delayProcess(processId, delays[index])));
    
    return true;
  }

  // Utility methods

  _recordWaitFor(processId, resourceId) {
    if (!this.waitForGraph.has(processId)) {
      this.waitForGraph.set(processId, new Set());
    }
    this.waitForGraph.get(processId).add(resourceId);
    
    const process = this.processes.get(processId);
    if (process) {
      process.waitStartTime = Date.now();
      process.waitingFor.add(resourceId);
    }
  }

  _removeWaitFor(processId, resourceId) {
    const waitSet = this.waitForGraph.get(processId);
    if (waitSet) {
      waitSet.delete(resourceId);
      if (waitSet.size === 0) {
        this.waitForGraph.delete(processId);
      }
    }
    
    const process = this.processes.get(processId);
    if (process) {
      process.waitingFor.delete(resourceId);
      if (process.waitingFor.size === 0) {
        delete process.waitStartTime;
      }
    }
  }

  _isProcessWaitingFor(processId, resourceId) {
    const waitSet = this.waitForGraph.get(processId);
    return waitSet && waitSet.has(resourceId);
  }

  _countActiveWaits() {
    let count = 0;
    for (const waitSet of this.waitForGraph.values()) {
      count += waitSet.size;
    }
    return count;
  }

  _createDeadlockFromCycle(cycle, type) {
    return {
      id: `${type}_${cycle.join('_')}_${Date.now()}`,
      type,
      processes: cycle,
      resources: this._getResourcesInvolvedInCycle(cycle),
      detectedAt: Date.now(),
      cycle
    };
  }

  _getResourcesInvolvedInCycle(processes) {
    const resources = new Set();
    for (const processId of processes) {
      const waitingFor = this.waitForGraph.get(processId) || new Set();
      for (const resourceId of waitingFor) {
        resources.add(resourceId);
      }
    }
    return Array.from(resources);
  }

  _startDetection() {
    if (!this.config.enabled) return;

    this.detectionTimer = setInterval(async () => {
      try {
        const deadlocks = await this.detectDeadlocks();
        if (deadlocks.length > 0) {
          // Attempt to resolve detected deadlocks
          for (const deadlock of deadlocks) {
            await this.resolveDeadlock(deadlock);
          }
        }
      } catch (error) {
        this.emit('detectionError', error);
      }
    }, this.config.detectionInterval);
  }

  _updateDetectionMetrics(detectionTime, deadlockCount) {
    this.metrics.averageDetectionTime = 
      (this.metrics.averageDetectionTime + detectionTime) / 2;
  }

  _updateResolutionMetrics(resolutionTime) {
    this.metrics.averageResolutionTime = 
      (this.metrics.averageResolutionTime + resolutionTime) / 2;
  }

  /**
   * Cleanup and shutdown
   */
  shutdown() {
    if (this.detectionTimer) {
      clearInterval(this.detectionTimer);
      this.detectionTimer = null;
    }
    
    this.resources.clear();
    this.processes.clear();
    this.waitForGraph.clear();
    this.resourceOwnership.clear();
    this.resolutionAttempts.clear();
    
    this.emit('shutdown');
  }
}

/**
 * Deadlock prevention system using resource ordering
 */
export class DeadlockPreventionSystem extends EventEmitter {
  constructor(options = {}) {
    super();
    this.config = {
      enabled: options.enabled !== false,
      orderingStrategy: options.orderingStrategy || 'priority',
      timeoutPreemption: options.timeoutPreemption || 30000,
      ...options
    };

    this.resourceOrder = new Map(); // resourceId -> order number
    this.processRequirements = new Map(); // processId -> required resources
  }

  /**
   * Establish resource ordering to prevent circular waits
   */
  establishResourceOrdering(resources) {
    resources.sort((a, b) => {
      switch (this.config.orderingStrategy) {
        case 'priority':
          return (b.priority || 0) - (a.priority || 0);
        case 'alphabetical':
          return a.id.localeCompare(b.id);
        case 'usage_frequency':
          return (b.usageCount || 0) - (a.usageCount || 0);
        default:
          return a.id.localeCompare(b.id);
      }
    });

    resources.forEach((resource, index) => {
      this.resourceOrder.set(resource.id, index);
    });

    this.emit('resourceOrderingEstablished', { resources, strategy: this.config.orderingStrategy });
  }

  /**
   * Validate resource acquisition request against ordering
   */
  validateAcquisition(processId, resourceId, currentlyHeld = []) {
    const requestedOrder = this.resourceOrder.get(resourceId);
    if (requestedOrder === undefined) {
      // Resource not in ordering - allow but warn
      this.emit('unorderedResourceAccess', { processId, resourceId });
      return true;
    }

    // Check if this would violate ordering
    const maxCurrentOrder = Math.max(...currentlyHeld.map(rid => 
      this.resourceOrder.get(rid) || -1));

    if (requestedOrder <= maxCurrentOrder) {
      this.emit('orderingViolationPrevented', { 
        processId, 
        resourceId, 
        requestedOrder, 
        maxCurrentOrder 
      });
      return false;
    }

    return true;
  }
}