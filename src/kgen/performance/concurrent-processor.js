/**
 * Concurrent Processor - High-Performance Parallel Processing Engine
 * 
 * Implements worker pool architecture for concurrent template rendering,
 * RDF processing, and knowledge graph operations with intelligent
 * workload distribution and resource management.
 */

import { EventEmitter } from 'events';
import { Consola } from 'consola';
import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import os from 'os';

export class ConcurrentProcessor extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      // Worker pool configuration
      maxWorkers: Math.max(2, Math.floor(os.cpus().length * 0.75)),
      minWorkers: 2,
      workerIdleTimeout: 300000, // 5 minutes
      taskTimeout: 60000, // 1 minute per task
      
      // Queue management
      maxQueueSize: 1000,
      enablePriority: true,
      priorityLevels: ['low', 'normal', 'high', 'critical'],
      
      // Load balancing
      loadBalanceStrategy: 'least_loaded', // round_robin, least_loaded, cpu_aware
      enableDynamicScaling: true,
      scaleUpThreshold: 0.8, // 80% utilization
      scaleDownThreshold: 0.2, // 20% utilization
      
      // Performance optimization
      enableBatching: true,
      batchSize: 10,
      batchTimeout: 1000, // 1 second
      enableResultCaching: true,
      
      // Resource management
      memoryLimit: '256MB',
      cpuLimit: 80, // % per worker
      enableResourceMonitoring: true,
      
      // Task types and processing
      supportedTaskTypes: [
        'template_render',
        'rdf_parse',
        'sparql_query',
        'semantic_reason',
        'validation',
        'transformation'
      ],
      
      ...config
    };
    
    this.logger = new Consola({ tag: 'concurrent-processor' });
    
    // Worker pool management
    this.workers = new Map();
    this.availableWorkers = [];
    this.busyWorkers = new Map();
    
    // Task queue and management
    this.taskQueue = [];
    this.priorityQueues = new Map();
    this.activeTasks = new Map();
    this.completedTasks = new Map();
    
    // Performance metrics
    this.metrics = {
      tasksProcessed: 0,
      totalProcessingTime: 0,
      averageTaskTime: 0,
      workerUtilization: 0,
      queueLength: 0,
      throughput: 0,
      errorRate: 0
    };
    
    // Load balancing and scaling
    this.loadBalancer = new LoadBalancer(this.config);
    this.resourceMonitor = null;
    this.scalingDecisions = [];
    
    // Batching system
    this.batchProcessor = new BatchProcessor(this.config);
    this.pendingBatches = new Map();
    
    this.state = 'initialized';
  }

  /**
   * Initialize the concurrent processor
   */
  async initialize() {
    try {
      this.logger.info('Initializing concurrent processor...');
      
      // Initialize priority queues
      this._initializePriorityQueues();
      
      // Create initial worker pool
      await this._createWorkerPool();
      
      // Start resource monitoring if enabled
      if (this.config.enableResourceMonitoring) {
        this._startResourceMonitoring();
      }
      
      // Initialize load balancer
      await this.loadBalancer.initialize(this.workers);
      
      // Initialize batch processor
      if (this.config.enableBatching) {
        await this.batchProcessor.initialize();
      }
      
      // Start queue processing
      this._startQueueProcessing();
      
      this.state = 'ready';
      this.logger.success(`Concurrent processor initialized with ${this.workers.size} workers`);
      
      return {
        status: 'success',
        workers: this.workers.size,
        supportedTaskTypes: this.config.supportedTaskTypes,
        features: {
          dynamicScaling: this.config.enableDynamicScaling,
          batching: this.config.enableBatching,
          priorityQueue: this.config.enablePriority
        }
      };
      
    } catch (error) {
      this.logger.error('Failed to initialize concurrent processor:', error);
      this.state = 'error';
      throw error;
    }
  }

  /**
   * Submit task for concurrent processing
   * @param {string} taskType - Type of task
   * @param {Object} taskData - Task input data
   * @param {Object} options - Processing options
   * @returns {Promise<Object>} Task results
   */
  async processTask(taskType, taskData, options = {}) {
    const taskId = this._generateTaskId();
    const startTime = this.getDeterministicTimestamp();
    
    try {
      // Validate task type
      if (!this.config.supportedTaskTypes.includes(taskType)) {
        throw new Error(`Unsupported task type: ${taskType}`);
      }
      
      this.logger.debug(`Submitting task: ${taskId} (${taskType})`);
      
      // Create task descriptor
      const task = {
        taskId,
        taskType,
        taskData,
        options: {
          priority: options.priority || 'normal',
          timeout: options.timeout || this.config.taskTimeout,
          enableCaching: options.enableCaching !== false && this.config.enableResultCaching,
          retryCount: options.retryCount || 0,
          maxRetries: options.maxRetries || 3,
          ...options
        },
        metadata: {
          submittedAt: this.getDeterministicDate(),
          submitTime: startTime
        }
      };
      
      // Check cache if enabled
      if (task.options.enableCaching) {
        const cachedResult = await this._getCachedResult(task);
        if (cachedResult) {
          this.logger.debug(`Cache hit for task: ${taskId}`);
          return cachedResult;
        }
      }
      
      // Check if task can be batched
      if (this.config.enableBatching && this._canBatchTask(task)) {
        return await this._submitToBatch(task);
      }
      
      // Submit to appropriate queue
      await this._submitToQueue(task);
      
      // Return promise that resolves when task completes
      return new Promise((resolve, reject) => {
        task.resolve = resolve;
        task.reject = reject;
        
        // Set timeout
        task.timeoutHandle = setTimeout(() => {
          this._handleTaskTimeout(task);
        }, task.options.timeout);
        
        this.activeTasks.set(taskId, task);
      });
      
    } catch (error) {
      this.logger.error(`Failed to submit task: ${taskId}`, error);
      throw error;
    }
  }

  /**
   * Process multiple tasks concurrently
   * @param {Array} tasks - Array of task specifications
   * @param {Object} options - Batch processing options
   * @returns {Promise<Array>} Array of results
   */
  async processBatch(tasks, options = {}) {
    const batchId = this._generateBatchId();
    const startTime = this.getDeterministicTimestamp();
    
    try {
      this.logger.info(`Processing batch: ${batchId} (${tasks.length} tasks)`);
      
      // Validate and prepare tasks
      const preparedTasks = tasks.map((task, index) => ({
        ...task,
        batchId,
        batchIndex: index
      }));
      
      // Submit all tasks
      const taskPromises = preparedTasks.map(task => 
        this.processTask(task.taskType, task.taskData, {
          ...task.options,
          batchId,
          batchMode: true
        })
      );
      
      // Wait for all tasks to complete
      const results = await Promise.allSettled(taskPromises);
      
      // Process results
      const processedResults = results.map((result, index) => ({
        taskIndex: index,
        batchId,
        status: result.status,
        value: result.status === 'fulfilled' ? result.value : null,
        error: result.status === 'rejected' ? result.reason : null
      }));
      
      const batchTime = this.getDeterministicTimestamp() - startTime;
      const successful = processedResults.filter(r => r.status === 'fulfilled').length;
      
      this.logger.success(`Batch completed: ${batchId} (${successful}/${tasks.length} successful, ${batchTime}ms)`);
      
      this.emit('batch:completed', {
        batchId,
        totalTasks: tasks.length,
        successful,
        failed: tasks.length - successful,
        processingTime: batchTime
      });
      
      return {
        batchId,
        results: processedResults,
        statistics: {
          totalTasks: tasks.length,
          successful,
          failed: tasks.length - successful,
          processingTime: batchTime,
          averageTaskTime: batchTime / tasks.length
        }
      };
      
    } catch (error) {
      this.logger.error(`Batch processing failed: ${batchId}`, error);
      throw error;
    }
  }

  /**
   * Scale worker pool dynamically
   * @param {number} targetSize - Target number of workers
   * @returns {Promise<Object>} Scaling results
   */
  async scaleWorkerPool(targetSize) {
    const currentSize = this.workers.size;
    
    try {
      this.logger.info(`Scaling worker pool: ${currentSize} -> ${targetSize}`);
      
      if (targetSize > currentSize) {
        // Scale up
        const workersToAdd = targetSize - currentSize;
        await this._addWorkers(workersToAdd);
      } else if (targetSize < currentSize) {
        // Scale down
        const workersToRemove = currentSize - targetSize;
        await this._removeWorkers(workersToRemove);
      }
      
      const finalSize = this.workers.size;
      const scalingResult = {
        previousSize: currentSize,
        targetSize,
        finalSize,
        scaled: finalSize !== currentSize
      };
      
      this.logger.success(`Worker pool scaled: ${scalingResult.previousSize} -> ${scalingResult.finalSize}`);
      this.emit('workers:scaled', scalingResult);
      
      return scalingResult;
      
    } catch (error) {
      this.logger.error('Failed to scale worker pool:', error);
      throw error;
    }
  }

  /**
   * Get comprehensive processor statistics
   */
  getStatistics() {
    const workerStats = Array.from(this.workers.values()).map(worker => ({
      id: worker.id,
      status: worker.status,
      tasksCompleted: worker.tasksCompleted,
      averageTaskTime: worker.totalTime / Math.max(1, worker.tasksCompleted),
      memoryUsage: worker.memoryUsage,
      cpuUsage: worker.cpuUsage
    }));
    
    return {
      workers: {
        total: this.workers.size,
        available: this.availableWorkers.length,
        busy: this.busyWorkers.size,
        utilization: this._calculateWorkerUtilization(),
        stats: workerStats
      },
      tasks: {
        queued: this.taskQueue.length,
        active: this.activeTasks.size,
        completed: this.completedTasks.size,
        totalProcessed: this.metrics.tasksProcessed,
        averageProcessingTime: this.metrics.averageTaskTime,
        throughput: this.metrics.throughput,
        errorRate: this.metrics.errorRate
      },
      queues: this._getQueueStatistics(),
      performance: {
        ...this.metrics,
        systemResources: this._getSystemResourceUsage()
      },
      scaling: {
        decisions: this.scalingDecisions.slice(-10), // Last 10 decisions
        enabled: this.config.enableDynamicScaling
      }
    };
  }

  /**
   * Shutdown the concurrent processor
   */
  async shutdown() {
    try {
      this.logger.info('Shutting down concurrent processor...');
      
      this.state = 'shutting_down';
      
      // Stop accepting new tasks
      this._stopQueueProcessing();
      
      // Complete active tasks with timeout
      await this._completeActiveTasks(30000); // 30 seconds timeout
      
      // Shutdown all workers
      await this._shutdownWorkers();
      
      // Stop resource monitoring
      if (this.resourceMonitor) {
        clearInterval(this.resourceMonitor);
      }
      
      // Clean up
      this.taskQueue.length = 0;
      this.activeTasks.clear();
      this.completedTasks.clear();
      this.workers.clear();
      this.availableWorkers.length = 0;
      this.busyWorkers.clear();
      
      this.state = 'shutdown';
      this.logger.success('Concurrent processor shutdown completed');
      
    } catch (error) {
      this.logger.error('Error during concurrent processor shutdown:', error);
      throw error;
    }
  }

  // Private methods

  _generateTaskId() {
    return `task_${this.getDeterministicTimestamp()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  _generateBatchId() {
    return `batch_${this.getDeterministicTimestamp()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  _generateWorkerId() {
    return `worker_${this.getDeterministicTimestamp()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  _initializePriorityQueues() {
    for (const priority of this.config.priorityLevels) {
      this.priorityQueues.set(priority, []);
    }
  }

  async _createWorkerPool() {
    const initialWorkers = Math.max(this.config.minWorkers, Math.min(this.config.maxWorkers, 4));
    
    for (let i = 0; i < initialWorkers; i++) {
      await this._createWorker();
    }
  }

  async _createWorker() {
    const workerId = this._generateWorkerId();
    
    try {
      // Create worker script if it doesn't exist
      const workerScript = await this._ensureWorkerScript();
      
      const worker = new Worker(workerScript, {
        workerData: {
          workerId,
          config: this.config
        }
      });
      
      // Setup worker metadata
      const workerData = {
        id: workerId,
        worker,
        status: 'available',
        createdAt: this.getDeterministicDate(),
        tasksCompleted: 0,
        totalTime: 0,
        memoryUsage: 0,
        cpuUsage: 0,
        lastActivity: this.getDeterministicDate()
      };
      
      // Setup worker event handlers
      this._setupWorkerEventHandlers(workerData);
      
      // Add to worker pool
      this.workers.set(workerId, workerData);
      this.availableWorkers.push(workerData);
      
      this.logger.debug(`Created worker: ${workerId}`);
      
      return workerData;
      
    } catch (error) {
      this.logger.error(`Failed to create worker: ${workerId}`, error);
      throw error;
    }
  }

  _setupWorkerEventHandlers(workerData) {
    const { worker, id } = workerData;
    
    worker.on('message', (message) => {
      this._handleWorkerMessage(workerData, message);
    });
    
    worker.on('error', (error) => {
      this.logger.error(`Worker error: ${id}`, error);
      this._handleWorkerError(workerData, error);
    });
    
    worker.on('exit', (code) => {
      this.logger.warn(`Worker exited: ${id} (code: ${code})`);
      this._handleWorkerExit(workerData, code);
    });
  }

  _handleWorkerMessage(workerData, message) {
    const { type, taskId, result, error, metrics } = message;
    
    switch (type) {
      case 'task_completed':
        this._handleTaskCompleted(workerData, taskId, result, metrics);
        break;
      case 'task_error':
        this._handleTaskError(workerData, taskId, error, metrics);
        break;
      case 'worker_ready':
        this._handleWorkerReady(workerData);
        break;
      case 'metrics_update':
        this._updateWorkerMetrics(workerData, metrics);
        break;
    }
  }

  _handleTaskCompleted(workerData, taskId, result, metrics) {
    const task = this.activeTasks.get(taskId);
    if (!task) {
      this.logger.warn(`Completed task not found: ${taskId}`);
      return;
    }
    
    // Clear timeout
    if (task.timeoutHandle) {
      clearTimeout(task.timeoutHandle);
    }
    
    // Update task metrics
    const completionTime = this.getDeterministicTimestamp() - task.metadata.submitTime;
    task.metadata.completedAt = this.getDeterministicDate();
    task.metadata.processingTime = completionTime;
    task.metadata.workerMetrics = metrics;
    
    // Update worker stats
    workerData.tasksCompleted++;
    workerData.totalTime += completionTime;
    workerData.lastActivity = this.getDeterministicDate();
    
    // Update global metrics
    this.metrics.tasksProcessed++;
    this.metrics.totalProcessingTime += completionTime;
    this.metrics.averageTaskTime = this.metrics.totalProcessingTime / this.metrics.tasksProcessed;
    
    // Move task to completed
    this.activeTasks.delete(taskId);
    this.completedTasks.set(taskId, { ...task, result });
    
    // Cache result if enabled
    if (task.options.enableCaching) {
      this._cacheResult(task, result);
    }
    
    // Resolve task promise
    if (task.resolve) {
      task.resolve({
        ...result,
        metadata: task.metadata
      });
    }
    
    // Return worker to available pool
    this._returnWorkerToPool(workerData);
    
    this.emit('task:completed', { taskId, processingTime: completionTime, worker: workerData.id });
  }

  _handleTaskError(workerData, taskId, error, metrics) {
    const task = this.activeTasks.get(taskId);
    if (!task) {
      this.logger.warn(`Error task not found: ${taskId}`);
      return;
    }
    
    // Clear timeout
    if (task.timeoutHandle) {
      clearTimeout(task.timeoutHandle);
    }
    
    // Update error metrics
    this.metrics.errorRate = (this.metrics.errorRate * this.metrics.tasksProcessed + 1) / (this.metrics.tasksProcessed + 1);
    
    // Check if task should be retried
    if (task.options.retryCount < task.options.maxRetries) {
      this.logger.warn(`Retrying task: ${taskId} (attempt ${task.options.retryCount + 1})`);
      task.options.retryCount++;
      
      // Resubmit to queue
      this._submitToQueue(task).catch((retryError) => {
        this.logger.error(`Failed to retry task: ${taskId}`, retryError);
        if (task.reject) {
          task.reject(new Error(`Task failed after ${task.options.maxRetries} retries: ${error}`));
        }
      });
    } else {
      // Task failed permanently
      this.activeTasks.delete(taskId);
      
      if (task.reject) {
        task.reject(new Error(error));
      }
    }
    
    // Return worker to pool
    this._returnWorkerToPool(workerData);
    
    this.emit('task:error', { taskId, error, worker: workerData.id });
  }

  _handleWorkerReady(workerData) {
    workerData.status = 'available';
    workerData.lastActivity = this.getDeterministicDate();
    
    if (!this.availableWorkers.includes(workerData)) {
      this.availableWorkers.push(workerData);
    }
  }

  _handleWorkerError(workerData, error) {
    workerData.status = 'error';
    
    // Remove from available workers
    const index = this.availableWorkers.indexOf(workerData);
    if (index !== -1) {
      this.availableWorkers.splice(index, 1);
    }
    
    // Try to recreate worker
    this._recreateWorker(workerData.id);
  }

  _handleWorkerExit(workerData, code) {
    workerData.status = 'exited';
    
    // Clean up
    this.workers.delete(workerData.id);
    this.busyWorkers.delete(workerData.id);
    
    const index = this.availableWorkers.indexOf(workerData);
    if (index !== -1) {
      this.availableWorkers.splice(index, 1);
    }
    
    // Recreate worker if needed
    if (this.state === 'ready' && this.workers.size < this.config.minWorkers) {
      this._createWorker().catch((error) => {
        this.logger.error('Failed to recreate worker:', error);
      });
    }
  }

  async _recreateWorker(oldWorkerId) {
    try {
      this.logger.info(`Recreating worker: ${oldWorkerId}`);
      
      // Remove old worker
      this.workers.delete(oldWorkerId);
      
      // Create new worker
      await this._createWorker();
      
    } catch (error) {
      this.logger.error(`Failed to recreate worker: ${oldWorkerId}`, error);
    }
  }

  _updateWorkerMetrics(workerData, metrics) {
    workerData.memoryUsage = metrics.memoryUsage || 0;
    workerData.cpuUsage = metrics.cpuUsage || 0;
    workerData.lastActivity = this.getDeterministicDate();
  }

  async _submitToQueue(task) {
    if (this.config.enablePriority) {
      const priorityQueue = this.priorityQueues.get(task.options.priority);
      if (priorityQueue) {
        priorityQueue.push(task);
      } else {
        this.taskQueue.push(task);
      }
    } else {
      this.taskQueue.push(task);
    }
    
    this.metrics.queueLength = this._getTotalQueueLength();
    this.emit('task:queued', { taskId: task.taskId, priority: task.options.priority });
  }

  _getTotalQueueLength() {
    let total = this.taskQueue.length;
    
    if (this.config.enablePriority) {
      for (const queue of this.priorityQueues.values()) {
        total += queue.length;
      }
    }
    
    return total;
  }

  _startQueueProcessing() {
    this.queueProcessor = setInterval(() => {
      this._processQueue();
    }, 100); // Process every 100ms
  }

  _stopQueueProcessing() {
    if (this.queueProcessor) {
      clearInterval(this.queueProcessor);
    }
  }

  _processQueue() {
    if (this.availableWorkers.length === 0) {
      return; // No available workers
    }
    
    // Get next task based on priority
    const task = this._getNextTask();
    if (!task) {
      return; // No tasks in queue
    }
    
    // Get optimal worker for task
    const worker = this.loadBalancer.selectWorker(task, this.availableWorkers);
    if (!worker) {
      return; // No suitable worker
    }
    
    // Assign task to worker
    this._assignTaskToWorker(task, worker);
  }

  _getNextTask() {
    if (this.config.enablePriority) {
      // Process tasks by priority
      for (const priority of ['critical', 'high', 'normal', 'low']) {
        const queue = this.priorityQueues.get(priority);
        if (queue && queue.length > 0) {
          return queue.shift();
        }
      }
    }
    
    return this.taskQueue.shift();
  }

  _assignTaskToWorker(task, workerData) {
    // Remove worker from available pool
    const index = this.availableWorkers.indexOf(workerData);
    if (index !== -1) {
      this.availableWorkers.splice(index, 1);
    }
    
    // Add to busy workers
    this.busyWorkers.set(workerData.id, workerData);
    workerData.status = 'busy';
    
    // Send task to worker
    workerData.worker.postMessage({
      type: 'process_task',
      taskId: task.taskId,
      taskType: task.taskType,
      taskData: task.taskData,
      options: task.options
    });
    
    this.logger.debug(`Assigned task ${task.taskId} to worker ${workerData.id}`);
  }

  _returnWorkerToPool(workerData) {
    // Remove from busy workers
    this.busyWorkers.delete(workerData.id);
    
    // Add back to available if not already there
    if (!this.availableWorkers.includes(workerData)) {
      workerData.status = 'available';
      this.availableWorkers.push(workerData);
    }
  }

  async _ensureWorkerScript() {
    const workerScript = path.join(__dirname, 'worker-script.js');
    
    // Create worker script if it doesn't exist
    try {
      await fs.access(workerScript);
    } catch {
      await this._createWorkerScript(workerScript);
    }
    
    return workerScript;
  }

  async _createWorkerScript(scriptPath) {
    const workerCode = `
const { parentPort, workerData } = require('worker_threads');
const { promises: fs } = require('fs');

class TaskProcessor {
  constructor(config) {
    this.config = config;
    this.workerId = workerData.workerId;
  }

  async processTask(taskId, taskType, taskData, options) {
    const startTime = this.getDeterministicTimestamp();
    
    try {
      let result;
      
      switch (taskType) {
        case 'template_render':
          result = await this.renderTemplate(taskData, options);
          break;
        case 'rdf_parse':
          result = await this.parseRDF(taskData, options);
          break;
        case 'sparql_query':
          result = await this.executeSPARQL(taskData, options);
          break;
        case 'semantic_reason':
          result = await this.performReasoning(taskData, options);
          break;
        case 'validation':
          result = await this.validateData(taskData, options);
          break;
        case 'transformation':
          result = await this.transformData(taskData, options);
          break;
        default:
          throw new Error(\`Unsupported task type: \${taskType}\`);
      }
      
      const processingTime = this.getDeterministicTimestamp() - startTime;
      const metrics = {
        processingTime,
        memoryUsage: process.memoryUsage().heapUsed,
        cpuUsage: process.cpuUsage()
      };
      
      parentPort.postMessage({
        type: 'task_completed',
        taskId,
        result,
        metrics
      });
      
    } catch (error) {
      const processingTime = this.getDeterministicTimestamp() - startTime;
      const metrics = {
        processingTime,
        memoryUsage: process.memoryUsage().heapUsed
      };
      
      parentPort.postMessage({
        type: 'task_error',
        taskId,
        error: error.message,
        metrics
      });
    }
  }

  async renderTemplate(taskData, options) {
    // Mock template rendering
    return {
      rendered: \`Template rendered with data: \${JSON.stringify(taskData)}\`,
      timestamp: this.getDeterministicDate().toISOString()
    };
  }

  async parseRDF(taskData, options) {
    // Mock RDF parsing
    return {
      triples: taskData.rdfData ? taskData.rdfData.split('\\n').length : 0,
      format: taskData.format || 'turtle',
      timestamp: this.getDeterministicDate().toISOString()
    };
  }

  async executeSPARQL(taskData, options) {
    // Mock SPARQL execution
    return {
      results: {
        bindings: []
      },
      executionTime: Math.random() * 100,
      timestamp: this.getDeterministicDate().toISOString()
    };
  }

  async performReasoning(taskData, options) {
    // Mock semantic reasoning
    return {
      inferences: Math.floor(Math.random() * 50),
      reasoningTime: Math.random() * 200,
      timestamp: this.getDeterministicDate().toISOString()
    };
  }

  async validateData(taskData, options) {
    // Mock validation
    return {
      isValid: Math.random() > 0.1,
      violations: Math.floor(Math.random() * 5),
      timestamp: this.getDeterministicDate().toISOString()
    };
  }

  async transformData(taskData, options) {
    // Mock data transformation
    return {
      transformedData: { ...taskData, transformed: true },
      transformationTime: Math.random() * 50,
      timestamp: this.getDeterministicDate().toISOString()
    };
  }
}

const processor = new TaskProcessor(workerData.config);

parentPort.on('message', async (message) => {
  const { type, taskId, taskType, taskData, options } = message;
  
  if (type === 'process_task') {
    await processor.processTask(taskId, taskType, taskData, options);
  }
});

// Send ready signal
parentPort.postMessage({
  type: 'worker_ready',
  workerId: workerData.workerId
});
`;
    
    await fs.writeFile(scriptPath, workerCode);
  }

  _startResourceMonitoring() {
    this.resourceMonitor = setInterval(() => {
      this._performResourceMonitoring();
    }, 5000); // Every 5 seconds
  }

  _performResourceMonitoring() {
    const utilization = this._calculateWorkerUtilization();
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    // Check if scaling is needed
    if (this.config.enableDynamicScaling) {
      this._checkScalingConditions(utilization);
    }
    
    // Update metrics
    this.metrics.workerUtilization = utilization;
    
    this.emit('resources:monitored', {
      utilization,
      memoryUsage,
      cpuUsage,
      workers: {
        total: this.workers.size,
        busy: this.busyWorkers.size,
        available: this.availableWorkers.length
      }
    });
  }

  _checkScalingConditions(utilization) {
    const currentTime = this.getDeterministicTimestamp();
    
    if (utilization > this.config.scaleUpThreshold && this.workers.size < this.config.maxWorkers) {
      // Scale up
      this.scalingDecisions.push({
        timestamp: currentTime,
        action: 'scale_up',
        reason: \`High utilization: \${utilization.toFixed(2)}\`,
        fromSize: this.workers.size,
        toSize: Math.min(this.workers.size + 1, this.config.maxWorkers)
      });
      
      this.scaleWorkerPool(Math.min(this.workers.size + 1, this.config.maxWorkers));
      
    } else if (utilization < this.config.scaleDownThreshold && this.workers.size > this.config.minWorkers) {
      // Scale down
      this.scalingDecisions.push({
        timestamp: currentTime,
        action: 'scale_down',
        reason: \`Low utilization: \${utilization.toFixed(2)}\`,
        fromSize: this.workers.size,
        toSize: Math.max(this.workers.size - 1, this.config.minWorkers)
      });
      
      this.scaleWorkerPool(Math.max(this.workers.size - 1, this.config.minWorkers));
    }
  }

  _calculateWorkerUtilization() {
    if (this.workers.size === 0) return 0;
    return (this.busyWorkers.size / this.workers.size) * 100;
  }

  async _addWorkers(count) {
    for (let i = 0; i < count; i++) {
      if (this.workers.size >= this.config.maxWorkers) break;
      await this._createWorker();
    }
  }

  async _removeWorkers(count) {
    let removed = 0;
    
    // Remove idle workers first
    while (removed < count && this.availableWorkers.length > 0 && this.workers.size > this.config.minWorkers) {
      const worker = this.availableWorkers.pop();
      await this._terminateWorker(worker);
      removed++;
    }
  }

  async _terminateWorker(workerData) {
    try {
      await workerData.worker.terminate();
      this.workers.delete(workerData.id);
      this.logger.debug(\`Terminated worker: \${workerData.id}\`);
    } catch (error) {
      this.logger.error(\`Failed to terminate worker: \${workerData.id}\`, error);
    }
  }

  async _completeActiveTasks(timeout) {
    if (this.activeTasks.size === 0) return;
    
    this.logger.info(\`Waiting for \${this.activeTasks.size} active tasks to complete...\`);
    
    const completionPromise = new Promise((resolve) => {
      const checkCompletion = () => {
        if (this.activeTasks.size === 0) {
          resolve();
        } else {
          setTimeout(checkCompletion, 100);
        }
      };
      checkCompletion();
    });
    
    const timeoutPromise = new Promise((resolve) => {
      setTimeout(() => {
        this.logger.warn(\`Timeout waiting for tasks, \${this.activeTasks.size} tasks remaining\`);
        resolve();
      }, timeout);
    });
    
    await Promise.race([completionPromise, timeoutPromise]);
  }

  async _shutdownWorkers() {
    const shutdownPromises = Array.from(this.workers.values()).map(worker => 
      this._terminateWorker(worker)
    );
    
    await Promise.all(shutdownPromises);
  }

  _getQueueStatistics() {
    const stats = {
      total: this._getTotalQueueLength(),
      byPriority: {}
    };
    
    if (this.config.enablePriority) {
      for (const [priority, queue] of this.priorityQueues) {
        stats.byPriority[priority] = queue.length;
      }
    }
    
    return stats;
  }

  _getSystemResourceUsage() {
    return {
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      uptime: process.uptime()
    };
  }

  async _getCachedResult(task) {
    // Placeholder for result caching
    return null;
  }

  _cacheResult(task, result) {
    // Placeholder for result caching
  }

  _canBatchTask(task) {
    // Determine if task can be batched with similar tasks
    return this.config.enableBatching && 
           ['template_render', 'validation'].includes(task.taskType);
  }

  async _submitToBatch(task) {
    return this.batchProcessor.submitTask(task);
  }

  _handleTaskTimeout(task) {
    this.logger.warn(\`Task timeout: \${task.taskId}\`);
    
    if (task.reject) {
      task.reject(new Error('Task timeout'));
    }
    
    this.activeTasks.delete(task.taskId);
  }
}

// Load balancer for optimal worker selection
class LoadBalancer {
  constructor(config) {
    this.config = config;
    this.strategy = config.loadBalanceStrategy;
  }

  async initialize(workers) {
    this.workers = workers;
  }

  selectWorker(task, availableWorkers) {
    if (availableWorkers.length === 0) return null;
    
    switch (this.strategy) {
      case 'round_robin':
        return this._roundRobin(availableWorkers);
      case 'least_loaded':
        return this._leastLoaded(availableWorkers);
      case 'cpu_aware':
        return this._cpuAware(availableWorkers);
      default:
        return availableWorkers[0];
    }
  }

  _roundRobin(workers) {
    // Simple round-robin selection
    return workers[Math.floor(Math.random() * workers.length)];
  }

  _leastLoaded(workers) {
    // Select worker with least completed tasks
    return workers.reduce((least, worker) => 
      worker.tasksCompleted < least.tasksCompleted ? worker : least
    );
  }

  _cpuAware(workers) {
    // Select worker with lowest CPU usage
    return workers.reduce((lowest, worker) => 
      worker.cpuUsage < lowest.cpuUsage ? worker : lowest
    );
  }
}

// Batch processor for grouping similar tasks
class BatchProcessor {
  constructor(config) {
    this.config = config;
    this.pendingBatches = new Map();
    this.batchTimeouts = new Map();
  }

  async initialize() {
    // Initialize batch processor
  }

  async submitTask(task) {
    const batchKey = this._getBatchKey(task);
    
    if (!this.pendingBatches.has(batchKey)) {
      this.pendingBatches.set(batchKey, []);
      this._setBatchTimeout(batchKey);
    }
    
    const batch = this.pendingBatches.get(batchKey);
    batch.push(task);
    
    // Process batch if it reaches the batch size
    if (batch.length >= this.config.batchSize) {
      return this._processBatch(batchKey);
    }
    
    // Return promise that resolves when batch is processed
    return new Promise((resolve, reject) => {
      task.batchResolve = resolve;
      task.batchReject = reject;
    });
  }

  _getBatchKey(task) {
    return \`\${task.taskType}_\${JSON.stringify(task.options)}\`;
  }

  _setBatchTimeout(batchKey) {
    const timeout = setTimeout(() => {
      this._processBatch(batchKey);
    }, this.config.batchTimeout);
    
    this.batchTimeouts.set(batchKey, timeout);
  }

  async _processBatch(batchKey) {
    const batch = this.pendingBatches.get(batchKey);
    if (!batch || batch.length === 0) return;
    
    // Clear timeout
    const timeout = this.batchTimeouts.get(batchKey);
    if (timeout) {
      clearTimeout(timeout);
      this.batchTimeouts.delete(batchKey);
    }
    
    // Remove batch from pending
    this.pendingBatches.delete(batchKey);
    
    // Process all tasks in batch
    const results = await Promise.allSettled(
      batch.map(task => this._processBatchTask(task))
    );
    
    // Resolve individual task promises
    results.forEach((result, index) => {
      const task = batch[index];
      if (result.status === 'fulfilled' && task.batchResolve) {
        task.batchResolve(result.value);
      } else if (result.status === 'rejected' && task.batchReject) {
        task.batchReject(result.reason);
      }
    });
  }

  async _processBatchTask(task) {
    // Process individual task within batch
    // This would implement actual batch processing logic
    return {
      taskId: task.taskId,
      result: \`Batch processed: \${task.taskType}\`,
      batchProcessed: true
    };
  }
}

export default ConcurrentProcessor;