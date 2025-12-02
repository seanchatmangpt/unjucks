/**
 * Master Coordinator for Distributed KGEN Processing
 * 
 * Manages distributed processing of massive knowledge graphs across multiple nodes.
 * Supports 100M+ triples with fault tolerance, load balancing, and consensus.
 */

import EventEmitter from 'events';
import crypto from 'crypto';
import { ConsistentHash } from './consistent-hash.js';
import { MessageQueue } from './message-queue.js';
import { GossipProtocol } from './gossip-protocol.js';
import { CircuitBreaker } from './circuit-breaker.js';
import { DistributedLock } from './distributed-lock.js';

export class MasterCoordinator extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.nodeId = options.nodeId || crypto.randomUUID();
    this.port = options.port || 8080;
    this.isLeader = false;
    this.nodes = new Map(); // nodeId -> nodeInfo
    this.workQueue = [];
    this.activeJobs = new Map(); // jobId -> jobInfo
    
    // Distributed systems components
    this.consistentHash = new ConsistentHash({
      virtualNodes: options.virtualNodes || 150,
      hashFunction: options.hashFunction || 'sha256'
    });
    
    this.messageQueue = new MessageQueue({
      type: options.messageQueueType || 'redis',
      connection: options.messageQueueConnection
    });
    
    this.gossipProtocol = new GossipProtocol({
      nodeId: this.nodeId,
      port: this.port + 1000, // Use different port for gossip
      seeds: options.seeds || []
    });
    
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: options.failureThreshold || 5,
      timeout: options.timeout || 60000,
      resetTimeout: options.resetTimeout || 300000
    });
    
    this.distributedLock = new DistributedLock({
      backend: options.lockBackend || 'redis',
      connection: options.lockConnection
    });
    
    this.config = {
      maxWorkers: options.maxWorkers || 10,
      maxTriples: options.maxTriples || 100000000,
      partitionSize: options.partitionSize || 1000000,
      replicationFactor: options.replicationFactor || 3,
      maxRetries: options.maxRetries || 3,
      heartbeatInterval: options.heartbeatInterval || 5000,
      leaderElectionTimeout: options.leaderElectionTimeout || 10000,
      workStealingEnabled: options.workStealingEnabled !== false,
      debug: options.debug || false
    };
    
    this.metrics = {
      jobsProcessed: 0,
      triplesProcessed: 0,
      averageJobTime: 0,
      errorRate: 0,
      nodeUtilization: 0,
      throughputPerSecond: 0
    };
    
    this.startTime = this.getDeterministicTimestamp();
  }
  
  /**
   * Initialize the master coordinator
   */
  async initialize() {
    try {
      if (this.config.debug) {
        console.log(`[MasterCoordinator] Initializing node ${this.nodeId}`);
      }
      
      // Initialize message queue
      await this.messageQueue.initialize();
      
      // Initialize gossip protocol for node discovery
      await this.gossipProtocol.initialize();
      
      // Initialize distributed locking
      await this.distributedLock.initialize();
      
      // Start leader election process
      await this.startLeaderElection();
      
      // Set up event listeners
      this.setupEventListeners();
      
      // Start heartbeat and monitoring
      this.startHeartbeat();
      
      if (this.config.debug) {
        console.log(`[MasterCoordinator] Node ${this.nodeId} initialized successfully`);
      }
      
      return { success: true, nodeId: this.nodeId, isLeader: this.isLeader };
      
    } catch (error) {
      console.error(`[MasterCoordinator] Initialization failed:`, error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Start leader election process using distributed consensus
   */
  async startLeaderElection() {
    const lockKey = 'kgen:leader:election';
    const lockTTL = this.config.leaderElectionTimeout;
    
    try {
      // Try to acquire leader lock
      const lockAcquired = await this.distributedLock.acquire(lockKey, {
        ttl: lockTTL,
        nodeId: this.nodeId
      });
      
      if (lockAcquired) {
        this.becomeLeader();
      } else {
        this.becomeFollower();
        // Schedule next leader election attempt
        setTimeout(() => this.startLeaderElection(), lockTTL / 2);
      }
      
    } catch (error) {
      console.error(`[MasterCoordinator] Leader election failed:`, error);
      this.becomeFollower();
      setTimeout(() => this.startLeaderElection(), lockTTL);
    }
  }
  
  /**
   * Become the cluster leader
   */
  becomeLeader() {
    if (this.isLeader) return;
    
    this.isLeader = true;
    
    if (this.config.debug) {
      console.log(`[MasterCoordinator] Node ${this.nodeId} became leader`);
    }
    
    // Start leader responsibilities
    this.startJobScheduling();
    this.startNodeMonitoring();
    
    this.emit('leader:elected', { nodeId: this.nodeId });
    
    // Maintain leadership by renewing lock
    this.maintainLeadership();
  }
  
  /**
   * Become a follower node
   */
  becomeFollower() {
    if (!this.isLeader) return;
    
    this.isLeader = false;
    
    if (this.config.debug) {
      console.log(`[MasterCoordinator] Node ${this.nodeId} became follower`);
    }
    
    // Stop leader responsibilities
    this.stopJobScheduling();
    this.stopNodeMonitoring();
    
    this.emit('leader:lost', { nodeId: this.nodeId });
  }
  
  /**
   * Maintain leadership by renewing the leader lock
   */
  async maintainLeadership() {
    if (!this.isLeader) return;
    
    const lockKey = 'kgen:leader:election';
    const renewInterval = this.config.leaderElectionTimeout / 3;
    
    try {
      const renewed = await this.distributedLock.renew(lockKey, {
        ttl: this.config.leaderElectionTimeout,
        nodeId: this.nodeId
      });
      
      if (renewed) {
        setTimeout(() => this.maintainLeadership(), renewInterval);
      } else {
        this.becomeFollower();
        this.startLeaderElection();
      }
      
    } catch (error) {
      console.error(`[MasterCoordinator] Leadership maintenance failed:`, error);
      this.becomeFollower();
      this.startLeaderElection();
    }
  }
  
  /**
   * Process a massive knowledge graph distributedly
   */
  async processKnowledgeGraph(graphData, options = {}) {
    if (!this.isLeader) {
      throw new Error('Only leader node can initiate graph processing');
    }
    
    const jobId = crypto.randomUUID();
    const startTime = this.getDeterministicTimestamp();
    
    try {
      if (this.config.debug) {
        console.log(`[MasterCoordinator] Starting distributed processing of graph with ${graphData.triples} triples`);
      }
      
      // Step 1: Partition the knowledge graph
      const partitions = await this.partitionGraph(graphData, options);
      
      // Step 2: Distribute partitions across nodes using consistent hashing
      const workPlan = await this.createWorkPlan(partitions, options);
      
      // Step 3: Execute distributed processing
      const results = await this.executeDistributedWork(jobId, workPlan, options);
      
      // Step 4: Aggregate results
      const finalResult = await this.aggregateResults(results, options);
      
      const processingTime = this.getDeterministicTimestamp() - startTime;
      
      // Update metrics
      this.updateMetrics({
        jobsProcessed: 1,
        triplesProcessed: graphData.triples,
        processingTime
      });
      
      return {
        success: true,
        jobId,
        result: finalResult,
        processingTime,
        partitions: partitions.length,
        nodesUsed: workPlan.length
      };
      
    } catch (error) {
      console.error(`[MasterCoordinator] Graph processing failed:`, error);
      
      return {
        success: false,
        jobId,
        error: error.message,
        processingTime: this.getDeterministicTimestamp() - startTime
      };
    }
  }
  
  /**
   * Partition knowledge graph for distributed processing
   */
  async partitionGraph(graphData, options = {}) {
    const partitionSize = options.partitionSize || this.config.partitionSize;
    const strategy = options.partitionStrategy || 'subject-based';
    
    if (this.config.debug) {
      console.log(`[MasterCoordinator] Partitioning graph using ${strategy} strategy`);
    }
    
    const partitions = [];
    
    switch (strategy) {
      case 'subject-based':
        partitions.push(...await this.partitionBySubject(graphData, partitionSize));
        break;
        
      case 'predicate-based':
        partitions.push(...await this.partitionByPredicate(graphData, partitionSize));
        break;
        
      case 'hash-based':
        partitions.push(...await this.partitionByHash(graphData, partitionSize));
        break;
        
      case 'semantic-clustering':
        partitions.push(...await this.partitionBySemantic(graphData, partitionSize));
        break;
        
      default:
        throw new Error(`Unknown partition strategy: ${strategy}`);
    }
    
    if (this.config.debug) {
      console.log(`[MasterCoordinator] Created ${partitions.length} partitions`);
    }
    
    return partitions;
  }
  
  /**
   * Partition graph by subject grouping
   */
  async partitionBySubject(graphData, partitionSize) {
    const partitions = [];
    const subjectGroups = new Map();
    
    // Group triples by subject
    for (const triple of graphData.triples) {
      const subject = triple.subject;
      if (!subjectGroups.has(subject)) {
        subjectGroups.set(subject, []);
      }
      subjectGroups.get(subject).push(triple);
    }
    
    // Create partitions from subject groups
    let currentPartition = [];
    let currentSize = 0;
    
    for (const [subject, triples] of subjectGroups) {
      if (currentSize + triples.length > partitionSize && currentPartition.length > 0) {
        partitions.push({
          id: crypto.randomUUID(),
          triples: currentPartition,
          size: currentSize,
          subjects: new Set(currentPartition.map(t => t.subject)).size,
          strategy: 'subject-based'
        });
        
        currentPartition = [];
        currentSize = 0;
      }
      
      currentPartition.push(...triples);
      currentSize += triples.length;
    }
    
    // Add final partition
    if (currentPartition.length > 0) {
      partitions.push({
        id: crypto.randomUUID(),
        triples: currentPartition,
        size: currentSize,
        subjects: new Set(currentPartition.map(t => t.subject)).size,
        strategy: 'subject-based'
      });
    }
    
    return partitions;
  }
  
  /**
   * Create work plan for distributed execution
   */
  async createWorkPlan(partitions, options = {}) {
    const availableNodes = this.getAvailableNodes();
    const workPlan = [];
    
    if (availableNodes.length === 0) {
      throw new Error('No available worker nodes for distributed processing');
    }
    
    // Distribute partitions using consistent hashing
    for (const partition of partitions) {
      const targetNodes = this.consistentHash.getNodes(partition.id, {
        count: Math.min(this.config.replicationFactor, availableNodes.length)
      });
      
      workPlan.push({
        partitionId: partition.id,
        partition,
        targetNodes,
        primaryNode: targetNodes[0],
        replicaNodes: targetNodes.slice(1),
        retries: 0,
        status: 'pending'
      });
    }
    
    return workPlan;
  }
  
  /**
   * Execute distributed work across nodes
   */
  async executeDistributedWork(jobId, workPlan, options = {}) {
    const results = [];
    const maxConcurrency = options.maxConcurrency || this.config.maxWorkers;
    const semaphore = new Array(maxConcurrency).fill(null);
    
    if (this.config.debug) {
      console.log(`[MasterCoordinator] Executing ${workPlan.length} work items with concurrency ${maxConcurrency}`);
    }
    
    // Execute work items with controlled concurrency
    const executeWorkItem = async (workItem, index) => {
      try {
        const result = await this.circuitBreaker.execute(async () => {
          return await this.executePartitionWork(jobId, workItem, options);
        });
        
        results[index] = result;
        
      } catch (error) {
        console.error(`[MasterCoordinator] Work item ${workItem.partitionId} failed:`, error);
        
        // Retry logic
        if (workItem.retries < this.config.maxRetries) {
          workItem.retries++;
          
          if (this.config.debug) {
            console.log(`[MasterCoordinator] Retrying work item ${workItem.partitionId}, attempt ${workItem.retries}`);
          }
          
          // Try replica nodes if primary failed
          if (workItem.replicaNodes.length > 0) {
            workItem.primaryNode = workItem.replicaNodes.shift();
          }
          
          return await executeWorkItem(workItem, index);
        }
        
        results[index] = {
          success: false,
          partitionId: workItem.partitionId,
          error: error.message
        };
      }
    };
    
    // Execute all work items
    await Promise.all(
      workPlan.map((workItem, index) => executeWorkItem(workItem, index))
    );
    
    return results;
  }
  
  /**
   * Execute work on a specific partition
   */
  async executePartitionWork(jobId, workItem, options = {}) {
    const message = {
      jobId,
      partitionId: workItem.partitionId,
      partition: workItem.partition,
      operation: options.operation || 'process',
      parameters: options.parameters || {},
      timeout: options.timeout || 300000
    };
    
    // Send work to target node via message queue
    const response = await this.messageQueue.sendRequest(
      `node:${workItem.primaryNode}:work`,
      message,
      { timeout: message.timeout }
    );
    
    return {
      success: true,
      partitionId: workItem.partitionId,
      nodeId: workItem.primaryNode,
      result: response.result,
      processingTime: response.processingTime
    };
  }
  
  /**
   * Aggregate results from distributed processing
   */
  async aggregateResults(results, options = {}) {
    const aggregationStrategy = options.aggregationStrategy || 'merge';
    
    if (this.config.debug) {
      console.log(`[MasterCoordinator] Aggregating ${results.length} results using ${aggregationStrategy}`);
    }
    
    const finalResult = {
      success: true,
      totalPartitions: results.length,
      successfulPartitions: 0,
      failedPartitions: 0,
      data: null,
      metadata: {
        aggregationStrategy,
        timestamp: this.getDeterministicDate().toISOString()
      }
    };
    
    // Count successful and failed partitions
    const successfulResults = results.filter(r => r && r.success);
    const failedResults = results.filter(r => !r || !r.success);
    
    finalResult.successfulPartitions = successfulResults.length;
    finalResult.failedPartitions = failedResults.length;
    
    if (failedResults.length > 0) {
      finalResult.errors = failedResults.map(r => ({
        partitionId: r?.partitionId,
        error: r?.error
      }));
    }
    
    // Aggregate successful results based on strategy
    switch (aggregationStrategy) {
      case 'merge':
        finalResult.data = await this.mergeResults(successfulResults);
        break;
        
      case 'union':
        finalResult.data = await this.unionResults(successfulResults);
        break;
        
      case 'intersection':
        finalResult.data = await this.intersectionResults(successfulResults);
        break;
        
      default:
        finalResult.data = successfulResults;
    }
    
    return finalResult;
  }
  
  /**
   * Merge results from multiple partitions
   */
  async mergeResults(results) {
    const merged = {
      triples: [],
      subjects: new Set(),
      predicates: new Set(),
      objects: new Set(),
      totalTriples: 0
    };
    
    for (const result of results) {
      if (result.result && result.result.triples) {
        merged.triples.push(...result.result.triples);
        merged.totalTriples += result.result.triples.length;
        
        // Collect unique subjects, predicates, objects
        if (result.result.subjects) {
          result.result.subjects.forEach(s => merged.subjects.add(s));
        }
        if (result.result.predicates) {
          result.result.predicates.forEach(p => merged.predicates.add(p));
        }
        if (result.result.objects) {
          result.result.objects.forEach(o => merged.objects.add(o));
        }
      }
    }
    
    return {
      triples: merged.triples,
      subjects: Array.from(merged.subjects),
      predicates: Array.from(merged.predicates),
      objects: Array.from(merged.objects),
      totalTriples: merged.totalTriples,
      uniqueSubjects: merged.subjects.size,
      uniquePredicates: merged.predicates.size,
      uniqueObjects: merged.objects.size
    };
  }
  
  /**
   * Get available worker nodes
   */
  getAvailableNodes() {
    const availableNodes = [];
    
    for (const [nodeId, nodeInfo] of this.nodes) {
      if (nodeInfo.status === 'active' && nodeInfo.type === 'worker') {
        availableNodes.push(nodeId);
      }
    }
    
    // Add nodes from consistent hash ring
    const ringNodes = this.consistentHash.getActiveNodes();
    ringNodes.forEach(nodeId => {
      if (!availableNodes.includes(nodeId)) {
        availableNodes.push(nodeId);
      }
    });
    
    return availableNodes;
  }
  
  /**
   * Set up event listeners
   */
  setupEventListeners() {
    // Gossip protocol events
    this.gossipProtocol.on('node:joined', (nodeInfo) => {
      this.handleNodeJoined(nodeInfo);
    });
    
    this.gossipProtocol.on('node:left', (nodeInfo) => {
      this.handleNodeLeft(nodeInfo);
    });
    
    // Message queue events
    this.messageQueue.on('message', (message) => {
      this.handleMessage(message);
    });
    
    // Circuit breaker events
    this.circuitBreaker.on('circuit:opened', (service) => {
      console.warn(`[MasterCoordinator] Circuit breaker opened for ${service}`);
    });
    
    this.circuitBreaker.on('circuit:closed', (service) => {
      if (this.config.debug) {
        console.log(`[MasterCoordinator] Circuit breaker closed for ${service}`);
      }
    });
  }
  
  /**
   * Handle node joining the cluster
   */
  handleNodeJoined(nodeInfo) {
    this.nodes.set(nodeInfo.nodeId, {
      ...nodeInfo,
      joinedAt: this.getDeterministicTimestamp(),
      lastHeartbeat: this.getDeterministicTimestamp(),
      status: 'active'
    });
    
    // Add node to consistent hash ring
    this.consistentHash.addNode(nodeInfo.nodeId, {
      weight: nodeInfo.capacity || 1,
      metadata: nodeInfo
    });
    
    if (this.config.debug) {
      console.log(`[MasterCoordinator] Node ${nodeInfo.nodeId} joined cluster`);
    }
    
    this.emit('node:joined', nodeInfo);
  }
  
  /**
   * Handle node leaving the cluster
   */
  handleNodeLeft(nodeInfo) {
    this.nodes.delete(nodeInfo.nodeId);
    
    // Remove node from consistent hash ring
    this.consistentHash.removeNode(nodeInfo.nodeId);
    
    if (this.config.debug) {
      console.log(`[MasterCoordinator] Node ${nodeInfo.nodeId} left cluster`);
    }
    
    this.emit('node:left', nodeInfo);
    
    // Reassign work from failed node if we're the leader
    if (this.isLeader) {
      this.reassignFailedWork(nodeInfo.nodeId);
    }
  }
  
  /**
   * Start heartbeat monitoring
   */
  startHeartbeat() {
    setInterval(() => {
      this.sendHeartbeat();
      this.checkNodeHealth();
    }, this.config.heartbeatInterval);
  }
  
  /**
   * Send heartbeat to cluster
   */
  async sendHeartbeat() {
    const heartbeat = {
      nodeId: this.nodeId,
      timestamp: this.getDeterministicTimestamp(),
      isLeader: this.isLeader,
      metrics: this.getMetrics(),
      status: 'active'
    };
    
    try {
      await this.gossipProtocol.broadcast('heartbeat', heartbeat);
    } catch (error) {
      console.error(`[MasterCoordinator] Failed to send heartbeat:`, error);
    }
  }
  
  /**
   * Get current metrics
   */
  getMetrics() {
    const uptime = this.getDeterministicTimestamp() - this.startTime;
    
    return {
      ...this.metrics,
      uptime,
      activeJobs: this.activeJobs.size,
      queuedJobs: this.workQueue.length,
      clusterNodes: this.nodes.size
    };
  }
  
  /**
   * Update processing metrics
   */
  updateMetrics(updates) {
    Object.assign(this.metrics, updates);
    
    // Calculate derived metrics
    if (updates.processingTime) {
      const jobCount = this.metrics.jobsProcessed || 1;
      this.metrics.averageJobTime = ((this.metrics.averageJobTime * (jobCount - 1)) + updates.processingTime) / jobCount;
    }
    
    if (updates.triplesProcessed) {
      const uptime = this.getDeterministicTimestamp() - this.startTime;
      this.metrics.throughputPerSecond = this.metrics.triplesProcessed / (uptime / 1000);
    }
  }
  
  /**
   * Shutdown coordinator gracefully
   */
  async shutdown() {
    if (this.config.debug) {
      console.log(`[MasterCoordinator] Shutting down node ${this.nodeId}`);
    }
    
    // Step down as leader
    if (this.isLeader) {
      await this.distributedLock.release('kgen:leader:election');
      this.becomeFollower();
    }
    
    // Cleanup components
    await this.gossipProtocol.shutdown();
    await this.messageQueue.shutdown();
    await this.distributedLock.shutdown();
    
    this.emit('shutdown', { nodeId: this.nodeId });
  }
}

export default MasterCoordinator;
