/**
 * Consistent Hashing Implementation for Distributed KGEN
 * 
 * Provides consistent data distribution across nodes with minimal reshuffling
 * when nodes are added or removed from the cluster.
 */

import crypto from 'crypto';

export class ConsistentHash {
  constructor(options = {}) {
    this.virtualNodes = options.virtualNodes || 150; // Virtual nodes per physical node
    this.hashFunction = options.hashFunction || 'sha256';
    this.ring = new Map(); // hash -> nodeId
    this.nodes = new Map(); // nodeId -> nodeInfo
    this.sortedHashes = []; // Sorted array of hash values for binary search
    this.debug = options.debug || false;
    
    this.statistics = {
      totalNodes: 0,
      totalVirtualNodes: 0,
      hashCollisions: 0,
      rebalanceOperations: 0,
      lastRebalanceTime: null
    };
  }
  
  /**
   * Add a node to the consistent hash ring
   */
  addNode(nodeId, nodeInfo = {}) {
    if (this.nodes.has(nodeId)) {
      if (this.debug) {
        console.log(`[ConsistentHash] Node ${nodeId} already exists, updating info`);
      }
      this.nodes.set(nodeId, { ...this.nodes.get(nodeId), ...nodeInfo });
      return;
    }
    
    const weight = nodeInfo.weight || 1;
    const virtualNodeCount = Math.floor(this.virtualNodes * weight);
    
    this.nodes.set(nodeId, {
      ...nodeInfo,
      nodeId,
      weight,
      virtualNodes: virtualNodeCount,
      addedAt: this.getDeterministicTimestamp(),
      status: 'active'
    });
    
    // Add virtual nodes to the ring
    for (let i = 0; i < virtualNodeCount; i++) {
      const virtualNodeKey = `${nodeId}:${i}`;
      const hash = this.hash(virtualNodeKey);
      
      // Handle hash collisions
      let finalHash = hash;
      let collisionCount = 0;
      while (this.ring.has(finalHash)) {
        collisionCount++;
        finalHash = this.hash(`${virtualNodeKey}:collision:${collisionCount}`);
        this.statistics.hashCollisions++;
      }
      
      this.ring.set(finalHash, nodeId);
    }
    
    // Rebuild sorted hash array
    this.rebuildSortedHashes();
    
    this.statistics.totalNodes++;
    this.statistics.totalVirtualNodes += virtualNodeCount;
    this.statistics.rebalanceOperations++;
    this.statistics.lastRebalanceTime = this.getDeterministicTimestamp();
    
    if (this.debug) {
      console.log(`[ConsistentHash] Added node ${nodeId} with ${virtualNodeCount} virtual nodes`);
    }
  }
  
  /**
   * Remove a node from the consistent hash ring
   */
  removeNode(nodeId) {
    const nodeInfo = this.nodes.get(nodeId);
    if (!nodeInfo) {
      if (this.debug) {
        console.log(`[ConsistentHash] Node ${nodeId} not found`);
      }
      return false;
    }
    
    // Remove all virtual nodes for this physical node
    const hashesToRemove = [];
    for (const [hash, nodeIdOnRing] of this.ring) {
      if (nodeIdOnRing === nodeId) {
        hashesToRemove.push(hash);
      }
    }
    
    for (const hash of hashesToRemove) {
      this.ring.delete(hash);
    }
    
    this.nodes.delete(nodeId);
    
    // Rebuild sorted hash array
    this.rebuildSortedHashes();
    
    this.statistics.totalNodes--;
    this.statistics.totalVirtualNodes -= nodeInfo.virtualNodes;
    this.statistics.rebalanceOperations++;
    this.statistics.lastRebalanceTime = this.getDeterministicTimestamp();
    
    if (this.debug) {
      console.log(`[ConsistentHash] Removed node ${nodeId} and ${hashesToRemove.length} virtual nodes`);
    }
    
    return true;
  }
  
  /**
   * Get the node responsible for a given key
   */
  getNode(key) {
    if (this.ring.size === 0) {
      return null;
    }
    
    const keyHash = this.hash(key);
    
    // Find the first node whose hash is >= keyHash
    const index = this.binarySearchCeiling(keyHash);
    const targetHash = this.sortedHashes[index];
    
    return this.ring.get(targetHash);
  }
  
  /**
   * Get multiple nodes for replication
   */
  getNodes(key, options = {}) {
    const count = Math.min(options.count || 1, this.statistics.totalNodes);
    const excludeNodes = new Set(options.exclude || []);
    
    if (this.ring.size === 0 || count === 0) {
      return [];
    }
    
    const keyHash = this.hash(key);
    const nodes = [];
    const seenNodes = new Set();
    
    // Start from the first node whose hash is >= keyHash
    let startIndex = this.binarySearchCeiling(keyHash);
    
    // Walk clockwise around the ring
    for (let i = 0; i < this.sortedHashes.length && nodes.length < count; i++) {
      const index = (startIndex + i) % this.sortedHashes.length;
      const hash = this.sortedHashes[index];
      const nodeId = this.ring.get(hash);
      
      // Skip if we've already seen this physical node or it's excluded
      if (!seenNodes.has(nodeId) && !excludeNodes.has(nodeId)) {
        const nodeInfo = this.nodes.get(nodeId);
        if (nodeInfo && nodeInfo.status === 'active') {
          nodes.push(nodeId);
          seenNodes.add(nodeId);
        }
      }
    }
    
    return nodes;
  }
  
  /**
   * Get distribution statistics for load balancing analysis
   */
  getDistributionStats(sampleKeys = null) {
    if (this.statistics.totalNodes === 0) {
      return {
        nodeDistribution: {},
        balanceScore: 0,
        averageLoad: 0,
        maxLoad: 0,
        minLoad: 0
      };
    }
    
    // Use provided sample keys or generate random ones
    const keys = sampleKeys || this.generateSampleKeys(10000);
    const distribution = new Map();
    
    // Initialize distribution counters
    for (const nodeId of this.nodes.keys()) {
      distribution.set(nodeId, 0);
    }
    
    // Count key assignments
    for (const key of keys) {
      const nodeId = this.getNode(key);
      if (nodeId && distribution.has(nodeId)) {
        distribution.set(nodeId, distribution.get(nodeId) + 1);
      }
    }
    
    // Calculate statistics
    const loads = Array.from(distribution.values());
    const totalLoad = loads.reduce((sum, load) => sum + load, 0);
    const averageLoad = totalLoad / loads.length;
    const maxLoad = Math.max(...loads);
    const minLoad = Math.min(...loads);
    
    // Balance score: how evenly distributed (1.0 = perfect, 0.0 = terrible)
    const variance = loads.reduce((sum, load) => sum + Math.pow(load - averageLoad, 2), 0) / loads.length;
    const coefficient = averageLoad > 0 ? Math.sqrt(variance) / averageLoad : 0;
    const balanceScore = Math.max(0, 1 - coefficient);
    
    return {
      nodeDistribution: Object.fromEntries(distribution),
      balanceScore,
      averageLoad,
      maxLoad,
      minLoad,
      totalKeys: keys.length,
      loadVariance: variance
    };
  }
  
  /**
   * Get keys that would be affected by adding/removing a node
   */
  getAffectedKeys(nodeId, operation = 'remove', sampleKeys = null) {
    const keys = sampleKeys || this.generateSampleKeys(1000);
    const affectedKeys = [];
    
    if (operation === 'remove') {
      // Keys currently assigned to this node would be affected
      for (const key of keys) {
        if (this.getNode(key) === nodeId) {
          affectedKeys.push(key);
        }
      }
    } else if (operation === 'add') {
      // Simulate adding the node to see which keys would move
      const currentAssignments = new Map();
      
      // Record current assignments
      for (const key of keys) {
        currentAssignments.set(key, this.getNode(key));
      }
      
      // Temporarily add node
      this.addNode(nodeId, { temporary: true });
      
      // Check which keys would be reassigned
      for (const key of keys) {
        const newAssignment = this.getNode(key);
        const oldAssignment = currentAssignments.get(key);
        
        if (newAssignment !== oldAssignment) {
          affectedKeys.push(key);
        }
      }
      
      // Remove temporary node
      this.removeNode(nodeId);
    }
    
    return affectedKeys;
  }
  
  /**
   * Get all active nodes in the ring
   */
  getActiveNodes() {
    return Array.from(this.nodes.entries())
      .filter(([nodeId, nodeInfo]) => nodeInfo.status === 'active')
      .map(([nodeId, nodeInfo]) => nodeId);
  }
  
  /**
   * Update node status or metadata
   */
  updateNode(nodeId, updates) {
    const nodeInfo = this.nodes.get(nodeId);
    if (!nodeInfo) {
      return false;
    }
    
    this.nodes.set(nodeId, {
      ...nodeInfo,
      ...updates,
      lastUpdated: this.getDeterministicTimestamp()
    });
    
    return true;
  }
  
  /**
   * Mark node as failed or inactive
   */
  markNodeFailed(nodeId) {
    return this.updateNode(nodeId, {
      status: 'failed',
      failedAt: this.getDeterministicTimestamp()
    });
  }
  
  /**
   * Mark node as active again
   */
  markNodeActive(nodeId) {
    return this.updateNode(nodeId, {
      status: 'active',
      recoveredAt: this.getDeterministicTimestamp()
    });
  }
  
  /**
   * Get ring topology information for debugging
   */
  getRingTopology() {
    const topology = {
      totalVirtualNodes: this.ring.size,
      physicalNodes: this.statistics.totalNodes,
      virtualNodesPerPhysical: this.statistics.totalNodes > 0 ? this.ring.size / this.statistics.totalNodes : 0,
      ringSegments: []
    };
    
    let lastHash = null;
    for (const hash of this.sortedHashes) {
      const nodeId = this.ring.get(hash);
      const nodeInfo = this.nodes.get(nodeId);
      
      topology.ringSegments.push({
        hash: hash.toString(16),
        nodeId,
        nodeStatus: nodeInfo?.status || 'unknown',
        segmentSize: lastHash !== null ? hash - lastHash : null
      });
      
      lastHash = hash;
    }
    
    return topology;
  }
  
  /**
   * Hash a string using the configured hash function
   */
  hash(key) {
    const hash = crypto.createHash(this.hashFunction);
    hash.update(key);
    const digest = hash.digest();
    
    // Convert first 4 bytes to unsigned integer
    return digest.readUInt32BE(0);
  }
  
  /**
   * Rebuild the sorted hash array for efficient lookups
   */
  rebuildSortedHashes() {
    this.sortedHashes = Array.from(this.ring.keys()).sort((a, b) => a - b);
  }
  
  /**
   * Binary search to find the ceiling (first element >= target)
   */
  binarySearchCeiling(target) {
    if (this.sortedHashes.length === 0) {
      return 0;
    }
    
    let left = 0;
    let right = this.sortedHashes.length - 1;
    
    // If target is larger than the largest hash, wrap around to 0
    if (target > this.sortedHashes[right]) {
      return 0;
    }
    
    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const midHash = this.sortedHashes[mid];
      
      if (midHash === target) {
        return mid;
      } else if (midHash < target) {
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }
    
    return left;
  }
  
  /**
   * Generate sample keys for testing and analysis
   */
  generateSampleKeys(count) {
    const keys = [];
    for (let i = 0; i < count; i++) {
      keys.push(`key_${i}_${Math.random().toString(36).substring(2)}`);
    }
    return keys;
  }
  
  /**
   * Get statistics about the consistent hash ring
   */
  getStatistics() {
    return {
      ...this.statistics,
      ringSize: this.ring.size,
      physicalNodes: this.nodes.size,
      averageVirtualNodes: this.statistics.totalNodes > 0 ? this.statistics.totalVirtualNodes / this.statistics.totalNodes : 0
    };
  }
  
  /**
   * Clear the entire ring (useful for testing)
   */
  clear() {
    this.ring.clear();
    this.nodes.clear();
    this.sortedHashes = [];
    
    this.statistics = {
      totalNodes: 0,
      totalVirtualNodes: 0,
      hashCollisions: 0,
      rebalanceOperations: 0,
      lastRebalanceTime: null
    };
  }
  
  /**
   * Export ring state for persistence or debugging
   */
  exportState() {
    return {
      nodes: Object.fromEntries(this.nodes),
      ring: Object.fromEntries(Array.from(this.ring.entries()).map(([hash, nodeId]) => [hash.toString(), nodeId])),
      statistics: this.statistics,
      config: {
        virtualNodes: this.virtualNodes,
        hashFunction: this.hashFunction
      }
    };
  }
  
  /**
   * Import ring state from exported data
   */
  importState(state) {
    this.clear();
    
    // Import configuration
    this.virtualNodes = state.config?.virtualNodes || this.virtualNodes;
    this.hashFunction = state.config?.hashFunction || this.hashFunction;
    
    // Import nodes
    for (const [nodeId, nodeInfo] of Object.entries(state.nodes || {})) {
      this.nodes.set(nodeId, nodeInfo);
    }
    
    // Import ring
    for (const [hashStr, nodeId] of Object.entries(state.ring || {})) {
      const hash = parseInt(hashStr);
      this.ring.set(hash, nodeId);
    }
    
    // Import statistics
    this.statistics = { ...this.statistics, ...state.statistics };
    
    // Rebuild sorted hashes
    this.rebuildSortedHashes();
  }
}

export default ConsistentHash;
