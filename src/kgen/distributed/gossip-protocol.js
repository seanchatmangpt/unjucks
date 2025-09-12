/**
 * Gossip Protocol Implementation for KGEN Distributed System
 * 
 * Provides node discovery, failure detection, and cluster state synchronization
 * using epidemic-style information dissemination.
 */

import EventEmitter from 'events';
import crypto from 'crypto';
import { performance } from 'perf_hooks';

export class GossipProtocol extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.nodeId = options.nodeId || crypto.randomUUID();
    this.port = options.port || 8080;
    this.seeds = options.seeds || []; // Initial nodes to connect to
    this.debug = options.debug || false;
    
    this.config = {
      gossipInterval: options.gossipInterval || 1000, // 1 second
      failureTimeout: options.failureTimeout || 10000, // 10 seconds
      cleanupInterval: options.cleanupInterval || 30000, // 30 seconds
      maxGossipPeers: options.maxGossipPeers || 3, // Number of peers to gossip with
      suspicionTimeout: options.suspicionTimeout || 5000, // 5 seconds before marking suspicious
      indirectPingCount: options.indirectPingCount || 3, // Indirect ping attempts
      networkTimeout: options.networkTimeout || 2000, // 2 seconds
      maxMessageSize: options.maxMessageSize || 64 * 1024, // 64KB
      compressionThreshold: options.compressionThreshold || 1024, // 1KB
      retransmitMultiplier: options.retransmitMultiplier || 4,
      ...options.config
    };
    
    // Node state management
    this.nodes = new Map(); // nodeId -> nodeInfo
    this.suspiciousNodes = new Map(); // nodeId -> suspicionInfo
    this.failedNodes = new Set(); // nodeId set
    this.localState = {
      incarnation: 0,
      status: 'alive',
      metadata: options.metadata || {},
      lastUpdated: Date.now()
    };
    
    // Message handling
    this.messageQueue = [];
    this.messageHistory = new Map(); // messageId -> timestamp (for deduplication)
    this.pendingAcks = new Map(); // messageId -> { resolve, reject, timeout }
    
    // Statistics
    this.statistics = {
      messagesSent: 0,
      messagesReceived: 0,
      gossipRounds: 0,
      nodesJoined: 0,
      nodesLeft: 0,
      nodesFailed: 0,
      suspicionRaised: 0,
      indirectPings: 0,
      networkErrors: 0,
      averageLatency: 0,
      totalLatency: 0
    };
    
    // Network simulation (in real implementation, this would be UDP/TCP)
    this.networkSimulator = new Map(); // nodeId -> GossipProtocol instance
    this.isInitialized = false;
    this.isShutdown = false;
  }
  
  /**
   * Initialize the gossip protocol
   */
  async initialize() {
    try {
      if (this.debug) {
        console.log(`[GossipProtocol] Initializing gossip protocol for node ${this.nodeId}`);
      }
      
      // Initialize local node info
      this.nodes.set(this.nodeId, {
        nodeId: this.nodeId,
        address: `localhost:${this.port}`,
        port: this.port,
        status: 'alive',
        incarnation: this.localState.incarnation,
        metadata: this.localState.metadata,
        lastSeen: Date.now(),
        firstSeen: Date.now(),
        roundTripTime: 0
      });
      
      // Set up network (simulated)
      await this.setupNetwork();
      
      // Connect to seed nodes
      await this.connectToSeeds();
      
      // Start gossip processes
      this.startGossipTimer();
      this.startFailureDetection();
      this.startCleanupTimer();
      
      this.isInitialized = true;
      
      if (this.debug) {
        console.log(`[GossipProtocol] Gossip protocol initialized for node ${this.nodeId}`);
      }
      
      this.emit('initialized', { nodeId: this.nodeId });
      return { success: true };
      
    } catch (error) {
      console.error(`[GossipProtocol] Initialization failed:`, error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Set up network layer (simulated for demonstration)
   */
  async setupNetwork() {
    // In a real implementation, this would set up UDP/TCP listeners
    // For simulation, we'll use a shared network simulator
    if (!global.gossipNetworkSimulator) {
      global.gossipNetworkSimulator = new Map();
    }
    
    this.networkSimulator = global.gossipNetworkSimulator;
    this.networkSimulator.set(this.nodeId, this);
    
    if (this.debug) {
      console.log(`[GossipProtocol] Network simulation setup for ${this.nodeId}`);
    }
  }
  
  /**
   * Connect to seed nodes for initial cluster discovery
   */
  async connectToSeeds() {
    if (this.seeds.length === 0) {
      if (this.debug) {
        console.log(`[GossipProtocol] No seed nodes configured, starting as initial node`);
      }
      return;
    }
    
    for (const seed of this.seeds) {
      try {
        await this.joinCluster(seed);
      } catch (error) {
        if (this.debug) {
          console.log(`[GossipProtocol] Failed to connect to seed ${seed}: ${error.message}`);
        }
      }
    }
  }
  
  /**
   * Join existing cluster by contacting a known node
   */
  async joinCluster(seedAddress) {
    // Parse seed address (simplified)
    const [seedNodeId] = seedAddress.split(':');
    
    if (!this.networkSimulator.has(seedNodeId)) {
      throw new Error(`Seed node ${seedNodeId} not available in network simulator`);
    }
    
    const seedNode = this.networkSimulator.get(seedNodeId);
    
    // Send join message
    const joinMessage = {
      type: 'join',
      from: this.nodeId,
      nodeInfo: this.nodes.get(this.nodeId),
      timestamp: Date.now()
    };
    
    const response = await this.sendMessage(seedNodeId, joinMessage);
    
    if (response && response.type === 'welcome') {
      // Add all nodes from the welcome message
      for (const nodeInfo of response.nodes) {
        if (nodeInfo.nodeId !== this.nodeId) {
          this.addNode(nodeInfo);
        }
      }
      
      if (this.debug) {
        console.log(`[GossipProtocol] Successfully joined cluster via ${seedNodeId}`);
      }
    }
  }
  
  /**
   * Add a node to the cluster
   */
  addNode(nodeInfo) {
    const existingNode = this.nodes.get(nodeInfo.nodeId);
    
    if (!existingNode || nodeInfo.incarnation > existingNode.incarnation) {
      const updatedNode = {
        ...nodeInfo,
        lastSeen: Date.now(),
        firstSeen: existingNode?.firstSeen || Date.now()
      };
      
      this.nodes.set(nodeInfo.nodeId, updatedNode);
      
      if (!existingNode) {
        this.statistics.nodesJoined++;
        
        if (this.debug) {
          console.log(`[GossipProtocol] Node joined: ${nodeInfo.nodeId}`);
        }
        
        this.emit('node:joined', updatedNode);
      } else {
        if (this.debug) {
          console.log(`[GossipProtocol] Node updated: ${nodeInfo.nodeId}`);
        }
        
        this.emit('node:updated', updatedNode);
      }
      
      // Remove from suspicious/failed if it was there
      this.suspiciousNodes.delete(nodeInfo.nodeId);
      this.failedNodes.delete(nodeInfo.nodeId);
    }
  }
  
  /**
   * Mark a node as suspicious
   */
  markSuspicious(nodeId, reason = 'timeout') {
    if (nodeId === this.nodeId || this.failedNodes.has(nodeId)) {
      return;
    }
    
    if (!this.suspiciousNodes.has(nodeId)) {
      this.suspiciousNodes.set(nodeId, {
        nodeId,
        reason,
        suspectedAt: Date.now(),
        indirectPingCount: 0
      });
      
      this.statistics.suspicionRaised++;
      
      if (this.debug) {
        console.log(`[GossipProtocol] Node marked suspicious: ${nodeId} (${reason})`);
      }
      
      this.emit('node:suspicious', { nodeId, reason });
      
      // Start indirect ping process
      this.startIndirectPing(nodeId);
    }
  }
  
  /**
   * Mark a node as failed
   */
  markFailed(nodeId, reason = 'timeout') {
    if (nodeId === this.nodeId || this.failedNodes.has(nodeId)) {
      return;
    }
    
    this.failedNodes.add(nodeId);
    this.suspiciousNodes.delete(nodeId);
    
    const nodeInfo = this.nodes.get(nodeId);
    if (nodeInfo) {
      nodeInfo.status = 'failed';
      nodeInfo.failedAt = Date.now();
    }
    
    this.statistics.nodesFailed++;
    
    if (this.debug) {
      console.log(`[GossipProtocol] Node marked failed: ${nodeId} (${reason})`);
    }
    
    this.emit('node:failed', { nodeId, reason, nodeInfo });
    
    // Gossip the failure to other nodes
    this.gossipNodeFailure(nodeId);
  }
  
  /**
   * Start indirect ping process for suspicious node
   */
  async startIndirectPing(suspiciousNodeId) {
    const suspicion = this.suspiciousNodes.get(suspiciousNodeId);
    if (!suspicion || suspicion.indirectPingCount >= this.config.indirectPingCount) {
      return;
    }
    
    suspicion.indirectPingCount++;
    this.statistics.indirectPings++;
    
    // Select random nodes to perform indirect ping
    const availableNodes = Array.from(this.nodes.values())
      .filter(node => 
        node.nodeId !== this.nodeId && 
        node.nodeId !== suspiciousNodeId &&
        node.status === 'alive' &&
        !this.failedNodes.has(node.nodeId)
      )
      .slice(0, 3); // Use up to 3 nodes for indirect ping
    
    if (availableNodes.length === 0) {
      // No nodes available for indirect ping, mark as failed
      this.markFailed(suspiciousNodeId, 'no_indirect_ping_nodes');
      return;
    }
    
    const indirectPingPromises = availableNodes.map(async (node) => {
      try {
        const response = await this.sendMessage(node.nodeId, {
          type: 'indirect_ping',
          from: this.nodeId,
          target: suspiciousNodeId,
          timestamp: Date.now()
        });
        
        return response && response.success;
      } catch (error) {
        return false;
      }
    });
    
    const results = await Promise.allSettled(indirectPingPromises);
    const successfulPings = results.filter(result => 
      result.status === 'fulfilled' && result.value === true
    ).length;
    
    if (successfulPings > 0) {
      // Node is alive, remove from suspicious list
      this.suspiciousNodes.delete(suspiciousNodeId);
      
      if (this.debug) {
        console.log(`[GossipProtocol] Node ${suspiciousNodeId} confirmed alive via indirect ping`);
      }
      
      this.emit('node:confirmed_alive', { nodeId: suspiciousNodeId });
    } else if (suspicion.indirectPingCount >= this.config.indirectPingCount) {
      // All indirect pings failed, mark as failed
      this.markFailed(suspiciousNodeId, 'indirect_ping_failed');
    } else {
      // Retry indirect ping after delay
      setTimeout(() => {
        this.startIndirectPing(suspiciousNodeId);
      }, this.config.suspicionTimeout);
    }
  }
  
  /**
   * Start gossip timer
   */
  startGossipTimer() {
    const gossipTimer = setInterval(async () => {
      if (this.isShutdown) {
        clearInterval(gossipTimer);
        return;
      }
      
      try {
        await this.performGossipRound();
      } catch (error) {
        if (this.debug) {
          console.log(`[GossipProtocol] Gossip round error: ${error.message}`);
        }
      }
    }, this.config.gossipInterval);
  }
  
  /**
   * Perform a single gossip round
   */
  async performGossipRound() {
    this.statistics.gossipRounds++;
    
    // Select random peers for gossip
    const peers = this.selectGossipPeers();
    
    if (peers.length === 0) {
      return; // No peers available
    }
    
    // Prepare gossip message with node states
    const gossipMessage = {
      type: 'gossip',
      from: this.nodeId,
      nodes: this.getGossipableNodes(),
      timestamp: Date.now()
    };
    
    // Send gossip to selected peers
    const gossipPromises = peers.map(async (peer) => {
      try {
        await this.sendMessage(peer.nodeId, gossipMessage);
      } catch (error) {
        // Handle peer communication failure
        this.handlePeerFailure(peer.nodeId, error);
      }
    });
    
    await Promise.allSettled(gossipPromises);
  }
  
  /**
   * Select peers for gossip
   */
  selectGossipPeers() {
    const availableNodes = Array.from(this.nodes.values())
      .filter(node => 
        node.nodeId !== this.nodeId && 
        node.status === 'alive' &&
        !this.failedNodes.has(node.nodeId)
      );
    
    // Randomly select peers
    const selectedPeers = [];
    const peerCount = Math.min(this.config.maxGossipPeers, availableNodes.length);
    
    for (let i = 0; i < peerCount; i++) {
      const randomIndex = Math.floor(Math.random() * availableNodes.length);
      const peer = availableNodes.splice(randomIndex, 1)[0];
      selectedPeers.push(peer);
    }
    
    return selectedPeers;
  }
  
  /**
   * Get nodes that should be included in gossip
   */
  getGossipableNodes() {
    const nodes = [];
    
    // Include alive nodes
    for (const node of this.nodes.values()) {
      if (node.status === 'alive' && !this.failedNodes.has(node.nodeId)) {
        nodes.push({
          nodeId: node.nodeId,
          address: node.address,
          port: node.port,
          status: node.status,
          incarnation: node.incarnation,
          metadata: node.metadata
        });
      }
    }
    
    // Include recently failed nodes (for propagation)
    const recentFailureThreshold = Date.now() - (this.config.failureTimeout * 2);
    for (const nodeId of this.failedNodes) {
      const node = this.nodes.get(nodeId);
      if (node && node.failedAt && node.failedAt > recentFailureThreshold) {
        nodes.push({
          nodeId: node.nodeId,
          status: 'failed',
          failedAt: node.failedAt,
          incarnation: node.incarnation
        });
      }
    }
    
    return nodes;
  }
  
  /**
   * Handle peer communication failure
   */
  handlePeerFailure(nodeId, error) {
    this.statistics.networkErrors++;
    
    if (!this.suspiciousNodes.has(nodeId)) {
      this.markSuspicious(nodeId, 'communication_failure');
    }
  }
  
  /**
   * Send message to another node
   */
  async sendMessage(targetNodeId, message) {
    if (!this.networkSimulator.has(targetNodeId)) {
      throw new Error(`Target node ${targetNodeId} not found`);
    }
    
    const targetNode = this.networkSimulator.get(targetNodeId);
    
    // Simulate network delay and potential failures
    const networkDelay = Math.random() * 50 + 10; // 10-60ms
    const failureRate = 0.01; // 1% message loss
    
    if (Math.random() < failureRate) {
      throw new Error('Simulated network failure');
    }
    
    this.statistics.messagesSent++;
    
    const startTime = performance.now();
    
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        try {
          const response = targetNode.handleMessage(message, this.nodeId);
          
          // Update latency statistics
          const latency = performance.now() - startTime;
          this.updateLatencyStats(latency);
          
          resolve(response);
        } catch (error) {
          reject(error);
        }
      }, networkDelay);
    });
  }
  
  /**
   * Handle incoming message
   */
  handleMessage(message, fromNodeId) {
    if (this.isShutdown) {
      return null;
    }
    
    this.statistics.messagesReceived++;
    
    // Update last seen time for sender
    const senderNode = this.nodes.get(fromNodeId);
    if (senderNode) {
      senderNode.lastSeen = Date.now();
    }
    
    switch (message.type) {
      case 'join':
        return this.handleJoinMessage(message);
        
      case 'gossip':
        return this.handleGossipMessage(message);
        
      case 'ping':
        return this.handlePingMessage(message);
        
      case 'indirect_ping':
        return this.handleIndirectPingMessage(message);
        
      case 'broadcast':
        return this.handleBroadcastMessage(message);
        
      default:
        if (this.debug) {
          console.log(`[GossipProtocol] Unknown message type: ${message.type}`);
        }
        return null;
    }
  }
  
  /**
   * Handle join message
   */
  handleJoinMessage(message) {
    this.addNode(message.nodeInfo);
    
    // Send welcome message with current cluster state
    return {
      type: 'welcome',
      from: this.nodeId,
      nodes: Array.from(this.nodes.values()),
      timestamp: Date.now()
    };
  }
  
  /**
   * Handle gossip message
   */
  handleGossipMessage(message) {
    // Process node updates
    for (const nodeInfo of message.nodes) {
      if (nodeInfo.status === 'failed') {
        // Handle failure notification
        if (!this.failedNodes.has(nodeInfo.nodeId)) {
          this.markFailed(nodeInfo.nodeId, 'gossip_failure');
        }
      } else {
        // Handle node update
        this.addNode(nodeInfo);
      }
    }
    
    return { type: 'ack', from: this.nodeId, timestamp: Date.now() };
  }
  
  /**
   * Handle ping message
   */
  handlePingMessage(message) {
    return {
      type: 'pong',
      from: this.nodeId,
      timestamp: Date.now(),
      originalTimestamp: message.timestamp
    };
  }
  
  /**
   * Handle indirect ping message
   */
  async handleIndirectPingMessage(message) {
    const { target } = message;
    
    try {
      // Try to ping the target node
      const response = await this.sendMessage(target, {
        type: 'ping',
        from: this.nodeId,
        timestamp: Date.now()
      });
      
      return {
        type: 'indirect_ping_result',
        from: this.nodeId,
        target,
        success: response && response.type === 'pong',
        timestamp: Date.now()
      };
      
    } catch (error) {
      return {
        type: 'indirect_ping_result',
        from: this.nodeId,
        target,
        success: false,
        error: error.message,
        timestamp: Date.now()
      };
    }
  }
  
  /**
   * Handle broadcast message
   */
  handleBroadcastMessage(message) {
    // Check for duplicate
    if (this.messageHistory.has(message.messageId)) {
      return null; // Already processed
    }
    
    this.messageHistory.set(message.messageId, Date.now());
    
    // Emit the broadcast event
    this.emit('broadcast', message.payload);
    
    // Retransmit to other nodes
    this.retransmitBroadcast(message);
    
    return { type: 'ack', from: this.nodeId, timestamp: Date.now() };
  }
  
  /**
   * Broadcast message to all nodes
   */
  async broadcast(eventType, payload) {
    const message = {
      type: 'broadcast',
      from: this.nodeId,
      messageId: crypto.randomUUID(),
      eventType,
      payload,
      timestamp: Date.now(),
      ttl: this.config.retransmitMultiplier
    };
    
    // Add to message history
    this.messageHistory.set(message.messageId, Date.now());
    
    // Send to all alive nodes
    const promises = [];
    for (const node of this.nodes.values()) {
      if (node.nodeId !== this.nodeId && node.status === 'alive' && !this.failedNodes.has(node.nodeId)) {
        promises.push(this.sendMessage(node.nodeId, message).catch(() => {})); // Ignore failures
      }
    }
    
    await Promise.allSettled(promises);
    
    this.emit('broadcast', payload);
  }
  
  /**
   * Retransmit broadcast message
   */
  async retransmitBroadcast(message) {
    if (message.ttl <= 0) {
      return; // TTL expired
    }
    
    // Decrease TTL and retransmit to random subset of nodes
    const retransmitMessage = {
      ...message,
      ttl: message.ttl - 1,
      retransmittedBy: this.nodeId
    };
    
    const peers = this.selectGossipPeers();
    const promises = peers.map(peer => 
      this.sendMessage(peer.nodeId, retransmitMessage).catch(() => {})
    );
    
    await Promise.allSettled(promises);
  }
  
  /**
   * Start failure detection
   */
  startFailureDetection() {
    const failureTimer = setInterval(() => {
      if (this.isShutdown) {
        clearInterval(failureTimer);
        return;
      }
      
      const now = Date.now();
      const suspicionThreshold = now - this.config.suspicionTimeout;
      const failureThreshold = now - this.config.failureTimeout;
      
      // Check for suspicious nodes
      for (const node of this.nodes.values()) {
        if (node.nodeId === this.nodeId) continue;
        
        if (node.lastSeen < failureThreshold && !this.failedNodes.has(node.nodeId)) {
          this.markFailed(node.nodeId, 'timeout');
        } else if (node.lastSeen < suspicionThreshold && 
                   !this.suspiciousNodes.has(node.nodeId) && 
                   !this.failedNodes.has(node.nodeId)) {
          this.markSuspicious(node.nodeId, 'timeout');
        }
      }
      
      // Check suspicious nodes for timeout
      for (const [nodeId, suspicion] of this.suspiciousNodes) {
        if (suspicion.suspectedAt < failureThreshold) {
          this.markFailed(nodeId, 'suspicion_timeout');
        }
      }
      
    }, this.config.suspicionTimeout);
  }
  
  /**
   * Start cleanup timer
   */
  startCleanupTimer() {
    const cleanupTimer = setInterval(() => {
      if (this.isShutdown) {
        clearInterval(cleanupTimer);
        return;
      }
      
      this.cleanup();
    }, this.config.cleanupInterval);
  }
  
  /**
   * Cleanup old data
   */
  cleanup() {
    const now = Date.now();
    const cleanupThreshold = now - (this.config.failureTimeout * 10); // Keep failed nodes for 10x failure timeout
    
    // Clean up old message history
    for (const [messageId, timestamp] of this.messageHistory) {
      if (timestamp < cleanupThreshold) {
        this.messageHistory.delete(messageId);
      }
    }
    
    // Clean up very old failed nodes
    const nodesToRemove = [];
    for (const nodeId of this.failedNodes) {
      const node = this.nodes.get(nodeId);
      if (node && node.failedAt && node.failedAt < cleanupThreshold) {
        nodesToRemove.push(nodeId);
      }
    }
    
    for (const nodeId of nodesToRemove) {
      this.failedNodes.delete(nodeId);
      this.nodes.delete(nodeId);
      
      if (this.debug) {
        console.log(`[GossipProtocol] Cleaned up old failed node: ${nodeId}`);
      }
      
      this.emit('node:removed', { nodeId });
    }
  }
  
  /**
   * Gossip node failure to cluster
   */
  async gossipNodeFailure(nodeId) {
    await this.broadcast('node:failed', {
      nodeId,
      reason: 'failure_detection',
      timestamp: Date.now()
    });
  }
  
  /**
   * Update latency statistics
   */
  updateLatencyStats(latency) {
    this.statistics.totalLatency += latency;
    const messageCount = this.statistics.messagesSent || 1;
    this.statistics.averageLatency = this.statistics.totalLatency / messageCount;
  }
  
  /**
   * Get cluster statistics
   */
  getStatistics() {
    return {
      ...this.statistics,
      nodeId: this.nodeId,
      totalNodes: this.nodes.size,
      aliveNodes: Array.from(this.nodes.values()).filter(n => n.status === 'alive').length,
      suspiciousNodes: this.suspiciousNodes.size,
      failedNodes: this.failedNodes.size,
      messageHistorySize: this.messageHistory.size
    };
  }
  
  /**
   * Get cluster state
   */
  getClusterState() {
    return {
      nodes: Array.from(this.nodes.values()),
      suspicious: Array.from(this.suspiciousNodes.values()),
      failed: Array.from(this.failedNodes),
      localNode: this.nodeId,
      statistics: this.getStatistics()
    };
  }
  
  /**
   * Health check
   */
  async healthCheck() {
    const aliveNodes = Array.from(this.nodes.values()).filter(n => n.status === 'alive').length;
    const totalNodes = this.nodes.size;
    
    return {
      healthy: aliveNodes > 0,
      nodeId: this.nodeId,
      clusterSize: totalNodes,
      aliveNodes,
      suspiciousNodes: this.suspiciousNodes.size,
      failedNodes: this.failedNodes.size,
      isInitialized: this.isInitialized,
      statistics: this.getStatistics()
    };
  }
  
  /**
   * Shutdown gossip protocol gracefully
   */
  async shutdown() {
    if (this.debug) {
      console.log(`[GossipProtocol] Shutting down gossip protocol for node ${this.nodeId}`);
    }
    
    this.isShutdown = true;
    
    // Announce departure
    try {
      await this.broadcast('node:leaving', {
        nodeId: this.nodeId,
        timestamp: Date.now()
      });
    } catch (error) {
      // Ignore errors during shutdown
    }
    
    // Remove from network simulator
    if (this.networkSimulator) {
      this.networkSimulator.delete(this.nodeId);
    }
    
    // Clear all timers (they check isShutdown flag)
    
    this.emit('shutdown', { nodeId: this.nodeId });
    
    if (this.debug) {
      console.log(`[GossipProtocol] Gossip protocol shut down for node ${this.nodeId}`);
    }
  }
}

export default GossipProtocol;
