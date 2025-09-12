/**
 * Advanced Graph Partitioning Algorithms for Distributed KGEN Processing
 * 
 * Implements multiple partitioning strategies for optimal distribution of
 * massive knowledge graphs (100M+ triples) across compute nodes.
 */

import crypto from 'crypto';
import { Parser } from 'n3';

export class GraphPartitioner {
  constructor(options = {}) {
    this.config = {
      defaultPartitionSize: options.defaultPartitionSize || 1000000, // 1M triples per partition
      minPartitionSize: options.minPartitionSize || 100000, // 100K minimum
      maxPartitionSize: options.maxPartitionSize || 5000000, // 5M maximum
      loadBalanceTolerance: options.loadBalanceTolerance || 0.1, // 10% imbalance allowed
      semanticClusteringEnabled: options.semanticClusteringEnabled !== false,
      debug: options.debug || false
    };
    
    this.statistics = {
      totalTriples: 0,
      partitionsCreated: 0,
      processingTime: 0,
      partitioningStrategy: null,
      balanceScore: 0
    };
  }
  
  /**
   * Partition a knowledge graph using the specified strategy
   */
  async partitionGraph(graphData, strategy = 'subject-based', options = {}) {
    const startTime = Date.now();
    
    try {
      if (this.config.debug) {
        console.log(`[GraphPartitioner] Partitioning ${graphData.triples?.length || 'unknown'} triples using ${strategy}`);
      }
      
      let partitions = [];
      const partitionSize = options.partitionSize || this.config.defaultPartitionSize;
      
      switch (strategy) {
        case 'subject-based':
          partitions = await this.partitionBySubject(graphData, partitionSize, options);
          break;
          
        case 'predicate-based':
          partitions = await this.partitionByPredicate(graphData, partitionSize, options);
          break;
          
        case 'hash-based':
          partitions = await this.partitionByHash(graphData, partitionSize, options);
          break;
          
        case 'semantic-clustering':
          partitions = await this.partitionBySemantic(graphData, partitionSize, options);
          break;
          
        case 'hybrid-intelligent':
          partitions = await this.partitionByHybridIntelligent(graphData, partitionSize, options);
          break;
          
        case 'temporal-locality':
          partitions = await this.partitionByTemporalLocality(graphData, partitionSize, options);
          break;
          
        default:
          throw new Error(`Unknown partitioning strategy: ${strategy}`);
      }
      
      // Post-process partitions for optimization
      partitions = await this.optimizePartitions(partitions, options);
      
      const processingTime = Date.now() - startTime;
      
      // Update statistics
      this.updateStatistics({
        totalTriples: graphData.triples?.length || 0,
        partitionsCreated: partitions.length,
        processingTime,
        partitioningStrategy: strategy,
        balanceScore: this.calculateBalanceScore(partitions)
      });
      
      return {
        success: true,
        strategy,
        partitions,
        statistics: this.statistics,
        metadata: {
          partitionSizes: partitions.map(p => p.size),
          averagePartitionSize: partitions.reduce((sum, p) => sum + p.size, 0) / partitions.length,
          processingTime
        }
      };
      
    } catch (error) {
      console.error(`[GraphPartitioner] Partitioning failed:`, error);
      return {
        success: false,
        error: error.message,
        processingTime: Date.now() - startTime
      };
    }
  }
  
  /**
   * Subject-based partitioning: Group triples by subject URIs
   * Excellent for maintaining entity coherence
   */
  async partitionBySubject(graphData, partitionSize, options = {}) {
    const partitions = [];
    const subjectGroups = new Map();
    const subjectSizes = new Map();
    
    // Phase 1: Group triples by subject and calculate sizes
    for (const triple of graphData.triples) {
      const subject = triple.subject.value;
      
      if (!subjectGroups.has(subject)) {
        subjectGroups.set(subject, []);
        subjectSizes.set(subject, 0);
      }
      
      subjectGroups.get(subject).push(triple);
      subjectSizes.set(subject, subjectSizes.get(subject) + 1);
    }
    
    // Phase 2: Sort subjects by size for better load balancing
    const sortedSubjects = Array.from(subjectSizes.entries())
      .sort((a, b) => b[1] - a[1]); // Descending by size
    
    // Phase 3: Create partitions using First Fit Decreasing algorithm
    let currentPartition = {
      id: crypto.randomUUID(),
      triples: [],
      subjects: new Set(),
      predicates: new Set(),
      objects: new Set(),
      size: 0,
      strategy: 'subject-based'
    };
    
    for (const [subject, size] of sortedSubjects) {
      const triples = subjectGroups.get(subject);
      
      // If adding this subject would exceed partition size, start new partition
      if (currentPartition.size + size > partitionSize && currentPartition.size > 0) {
        // Finalize current partition
        currentPartition.metadata = {
          subjectCount: currentPartition.subjects.size,
          predicateCount: currentPartition.predicates.size,
          objectCount: currentPartition.objects.size,
          density: currentPartition.size / currentPartition.subjects.size
        };
        
        partitions.push(currentPartition);
        
        // Start new partition
        currentPartition = {
          id: crypto.randomUUID(),
          triples: [],
          subjects: new Set(),
          predicates: new Set(),
          objects: new Set(),
          size: 0,
          strategy: 'subject-based'
        };
      }
      
      // Add triples to current partition
      currentPartition.triples.push(...triples);
      currentPartition.subjects.add(subject);
      currentPartition.size += size;
      
      // Collect predicates and objects for metadata
      for (const triple of triples) {
        currentPartition.predicates.add(triple.predicate.value);
        currentPartition.objects.add(triple.object.value);
      }
    }
    
    // Add final partition if it has content
    if (currentPartition.size > 0) {
      currentPartition.metadata = {
        subjectCount: currentPartition.subjects.size,
        predicateCount: currentPartition.predicates.size,
        objectCount: currentPartition.objects.size,
        density: currentPartition.size / currentPartition.subjects.size
      };
      partitions.push(currentPartition);
    }
    
    return partitions;
  }
  
  /**
   * Predicate-based partitioning: Group triples by predicate
   * Good for query-specific optimizations
   */
  async partitionByPredicate(graphData, partitionSize, options = {}) {
    const partitions = [];
    const predicateGroups = new Map();
    
    // Group triples by predicate
    for (const triple of graphData.triples) {
      const predicate = triple.predicate.value;
      
      if (!predicateGroups.has(predicate)) {
        predicateGroups.set(predicate, []);
      }
      
      predicateGroups.get(predicate).push(triple);
    }
    
    // Sort predicates by frequency
    const sortedPredicates = Array.from(predicateGroups.entries())
      .sort((a, b) => b[1].length - a[1].length);
    
    let currentPartition = {
      id: crypto.randomUUID(),
      triples: [],
      subjects: new Set(),
      predicates: new Set(),
      objects: new Set(),
      size: 0,
      strategy: 'predicate-based'
    };
    
    for (const [predicate, triples] of sortedPredicates) {
      // Check if adding this predicate group exceeds partition size
      if (currentPartition.size + triples.length > partitionSize && currentPartition.size > 0) {
        // Finalize current partition
        currentPartition.metadata = {
          predicateCount: currentPartition.predicates.size,
          subjectCount: currentPartition.subjects.size,
          objectCount: currentPartition.objects.size,
          dominantPredicate: Array.from(currentPartition.predicates)[0]
        };
        
        partitions.push(currentPartition);
        
        // Start new partition
        currentPartition = {
          id: crypto.randomUUID(),
          triples: [],
          subjects: new Set(),
          predicates: new Set(),
          objects: new Set(),
          size: 0,
          strategy: 'predicate-based'
        };
      }
      
      // Add triples to current partition
      currentPartition.triples.push(...triples);
      currentPartition.predicates.add(predicate);
      currentPartition.size += triples.length;
      
      // Collect subjects and objects
      for (const triple of triples) {
        currentPartition.subjects.add(triple.subject.value);
        currentPartition.objects.add(triple.object.value);
      }
    }
    
    // Add final partition
    if (currentPartition.size > 0) {
      currentPartition.metadata = {
        predicateCount: currentPartition.predicates.size,
        subjectCount: currentPartition.subjects.size,
        objectCount: currentPartition.objects.size,
        dominantPredicate: Array.from(currentPartition.predicates)[0]
      };
      partitions.push(currentPartition);
    }
    
    return partitions;
  }
  
  /**
   * Hash-based partitioning: Even distribution using hash function
   * Excellent for load balancing but may break locality
   */
  async partitionByHash(graphData, partitionSize, options = {}) {
    const numPartitions = Math.ceil(graphData.triples.length / partitionSize);
    const partitions = [];
    
    // Initialize partitions
    for (let i = 0; i < numPartitions; i++) {
      partitions.push({
        id: crypto.randomUUID(),
        triples: [],
        subjects: new Set(),
        predicates: new Set(),
        objects: new Set(),
        size: 0,
        strategy: 'hash-based',
        partitionIndex: i
      });
    }
    
    // Distribute triples based on subject hash
    for (const triple of graphData.triples) {
      const subjectHash = this.hashString(triple.subject.value);
      const partitionIndex = subjectHash % numPartitions;
      const partition = partitions[partitionIndex];
      
      partition.triples.push(triple);
      partition.subjects.add(triple.subject.value);
      partition.predicates.add(triple.predicate.value);
      partition.objects.add(triple.object.value);
      partition.size++;
    }
    
    // Add metadata to partitions
    partitions.forEach(partition => {
      partition.metadata = {
        hashRange: `${partition.partitionIndex}/${numPartitions}`,
        subjectCount: partition.subjects.size,
        predicateCount: partition.predicates.size,
        objectCount: partition.objects.size,
        loadBalance: partition.size / (graphData.triples.length / numPartitions)
      };
    });
    
    return partitions.filter(p => p.size > 0);
  }
  
  /**
   * Semantic clustering partitioning: Group related concepts together
   * Best for maintaining semantic coherence
   */
  async partitionBySemantic(graphData, partitionSize, options = {}) {
    if (!this.config.semanticClusteringEnabled) {
      // Fallback to subject-based partitioning
      return await this.partitionBySubject(graphData, partitionSize, options);
    }
    
    const clusters = new Map();
    const typeRelations = new Set(['rdf:type', 'rdfs:subClassOf', 'rdfs:subPropertyOf']);
    
    // Phase 1: Identify semantic clusters based on type relationships
    for (const triple of graphData.triples) {
      if (typeRelations.has(triple.predicate.value)) {
        const cluster = triple.object.value; // Use type/class as cluster key
        
        if (!clusters.has(cluster)) {
          clusters.set(cluster, {
            id: crypto.randomUUID(),
            triples: [],
            subjects: new Set(),
            predicates: new Set(),
            objects: new Set(),
            size: 0,
            clusterType: cluster,
            strategy: 'semantic-clustering'
          });
        }
        
        const clusterPartition = clusters.get(cluster);
        clusterPartition.triples.push(triple);
        clusterPartition.subjects.add(triple.subject.value);
        clusterPartition.predicates.add(triple.predicate.value);
        clusterPartition.objects.add(triple.object.value);
        clusterPartition.size++;
      }
    }
    
    // Phase 2: Assign remaining triples to closest semantic cluster
    const assignedSubjects = new Set();
    clusters.forEach(cluster => {
      cluster.subjects.forEach(subject => assignedSubjects.add(subject));
    });
    
    for (const triple of graphData.triples) {
      if (!assignedSubjects.has(triple.subject.value)) {
        // Find the most appropriate cluster based on object types
        let bestCluster = null;
        let bestScore = 0;
        
        for (const [clusterKey, cluster] of clusters) {
          if (cluster.objects.has(triple.object.value)) {
            const score = cluster.objects.size; // Simple scoring based on cluster size
            if (score > bestScore) {
              bestScore = score;
              bestCluster = cluster;
            }
          }
        }
        
        if (bestCluster) {
          bestCluster.triples.push(triple);
          bestCluster.subjects.add(triple.subject.value);
          bestCluster.predicates.add(triple.predicate.value);
          bestCluster.objects.add(triple.object.value);
          bestCluster.size++;
          assignedSubjects.add(triple.subject.value);
        }
      }
    }
    
    // Phase 3: Split large clusters and merge small ones
    const finalPartitions = [];
    const smallClusters = [];
    
    for (const cluster of clusters.values()) {
      if (cluster.size > partitionSize) {
        // Split large cluster
        const subPartitions = await this.splitLargeCluster(cluster, partitionSize);
        finalPartitions.push(...subPartitions);
      } else if (cluster.size < this.config.minPartitionSize) {
        // Mark for merging
        smallClusters.push(cluster);
      } else {
        // Add cluster metadata
        cluster.metadata = {
          clusterType: cluster.clusterType,
          semanticCoherence: this.calculateSemanticCoherence(cluster),
          subjectCount: cluster.subjects.size,
          predicateCount: cluster.predicates.size,
          objectCount: cluster.objects.size
        };
        finalPartitions.push(cluster);
      }
    }
    
    // Merge small clusters
    if (smallClusters.length > 0) {
      const mergedPartitions = await this.mergeSmallClusters(smallClusters, partitionSize);
      finalPartitions.push(...mergedPartitions);
    }
    
    return finalPartitions;
  }
  
  /**
   * Hybrid intelligent partitioning: Combines multiple strategies
   * Adapts strategy based on graph characteristics
   */
  async partitionByHybridIntelligent(graphData, partitionSize, options = {}) {
    // Analyze graph characteristics
    const characteristics = await this.analyzeGraphCharacteristics(graphData);
    
    let strategy = 'subject-based'; // Default
    
    // Choose optimal strategy based on graph characteristics
    if (characteristics.typeRatio > 0.1 && characteristics.semanticDepth > 3) {
      strategy = 'semantic-clustering';
    } else if (characteristics.predicateDistribution < 0.3) {
      strategy = 'predicate-based';
    } else if (characteristics.subjectDistribution > 0.8) {
      strategy = 'hash-based';
    }
    
    if (this.config.debug) {
      console.log(`[GraphPartitioner] Hybrid strategy selected: ${strategy}`);
      console.log(`[GraphPartitioner] Graph characteristics:`, characteristics);
    }
    
    // Execute chosen strategy
    const partitions = await this.partitionGraph(graphData, strategy, options);
    
    // Post-process with intelligent optimizations
    return await this.applyIntelligentOptimizations(partitions.partitions, characteristics);
  }
  
  /**
   * Temporal locality partitioning: Group by temporal patterns
   * Useful for time-series and historical data
   */
  async partitionByTemporalLocality(graphData, partitionSize, options = {}) {
    const temporalGroups = new Map();
    const datePredicates = new Set([
      'dcterms:created', 'dcterms:modified', 'dcterms:date',
      'prov:generatedAtTime', 'time:hasDateTimeDescription'
    ]);
    
    // Extract temporal information
    for (const triple of graphData.triples) {
      if (datePredicates.has(triple.predicate.value)) {
        const dateStr = triple.object.value;
        const timeGroup = this.extractTimeGroup(dateStr, options.temporalGranularity || 'month');
        
        if (!temporalGroups.has(timeGroup)) {
          temporalGroups.set(timeGroup, {
            id: crypto.randomUUID(),
            triples: [],
            subjects: new Set(),
            predicates: new Set(),
            objects: new Set(),
            size: 0,
            timeGroup,
            strategy: 'temporal-locality'
          });
        }
      }
    }
    
    // If no temporal data found, fallback to subject-based
    if (temporalGroups.size === 0) {
      return await this.partitionBySubject(graphData, partitionSize, options);
    }
    
    // Assign triples to temporal groups
    const subjectToTimeGroup = new Map();
    
    // First pass: map subjects to time groups based on temporal triples
    for (const triple of graphData.triples) {
      if (datePredicates.has(triple.predicate.value)) {
        const timeGroup = this.extractTimeGroup(triple.object.value, options.temporalGranularity || 'month');
        subjectToTimeGroup.set(triple.subject.value, timeGroup);
      }
    }
    
    // Second pass: assign all triples to temporal groups
    for (const triple of graphData.triples) {
      const timeGroup = subjectToTimeGroup.get(triple.subject.value);
      
      if (timeGroup && temporalGroups.has(timeGroup)) {
        const group = temporalGroups.get(timeGroup);
        group.triples.push(triple);
        group.subjects.add(triple.subject.value);
        group.predicates.add(triple.predicate.value);
        group.objects.add(triple.object.value);
        group.size++;
      }
    }
    
    // Convert to array and add metadata
    const partitions = Array.from(temporalGroups.values())
      .filter(group => group.size > 0)
      .map(group => ({
        ...group,
        metadata: {
          timeGroup: group.timeGroup,
          temporalSpan: this.calculateTemporalSpan(group.triples),
          subjectCount: group.subjects.size,
          predicateCount: group.predicates.size,
          objectCount: group.objects.size
        }
      }));
    
    // Split partitions that are too large
    const finalPartitions = [];
    for (const partition of partitions) {
      if (partition.size > partitionSize) {
        const subPartitions = await this.splitLargeCluster(partition, partitionSize);
        finalPartitions.push(...subPartitions);
      } else {
        finalPartitions.push(partition);
      }
    }
    
    return finalPartitions;
  }
  
  /**
   * Optimize partitions for better load balancing and performance
   */
  async optimizePartitions(partitions, options = {}) {
    if (!options.optimize) {
      return partitions;
    }
    
    // Step 1: Balance partition sizes
    let optimizedPartitions = await this.balancePartitionSizes(partitions);
    
    // Step 2: Minimize cross-partition references
    if (options.minimizeCrossReferences) {
      optimizedPartitions = await this.minimizeCrossReferences(optimizedPartitions);
    }
    
    // Step 3: Optimize for query patterns if provided
    if (options.queryPatterns) {
      optimizedPartitions = await this.optimizeForQueries(optimizedPartitions, options.queryPatterns);
    }
    
    return optimizedPartitions;
  }
  
  /**
   * Balance partition sizes to improve load distribution
   */
  async balancePartitionSizes(partitions) {
    const tolerance = this.config.loadBalanceTolerance;
    const averageSize = partitions.reduce((sum, p) => sum + p.size, 0) / partitions.length;
    const maxSize = averageSize * (1 + tolerance);
    const minSize = averageSize * (1 - tolerance);
    
    const balanced = [];
    const oversized = [];
    const undersized = [];
    
    // Categorize partitions
    for (const partition of partitions) {
      if (partition.size > maxSize) {
        oversized.push(partition);
      } else if (partition.size < minSize) {
        undersized.push(partition);
      } else {
        balanced.push(partition);
      }
    }
    
    // Rebalance oversized partitions
    for (const partition of oversized) {
      const split = await this.splitPartition(partition, maxSize);
      balanced.push(...split);
    }
    
    // Merge undersized partitions
    if (undersized.length > 1) {
      const merged = await this.mergePartitions(undersized, minSize);
      balanced.push(...merged);
    } else if (undersized.length === 1) {
      balanced.push(undersized[0]);
    }
    
    return balanced;
  }
  
  /**
   * Calculate balance score for partitions (1.0 = perfectly balanced)
   */
  calculateBalanceScore(partitions) {
    if (partitions.length === 0) return 0;
    
    const sizes = partitions.map(p => p.size);
    const avgSize = sizes.reduce((sum, size) => sum + size, 0) / sizes.length;
    
    if (avgSize === 0) return 1.0;
    
    const variance = sizes.reduce((sum, size) => sum + Math.pow(size - avgSize, 2), 0) / sizes.length;
    const coefficient = Math.sqrt(variance) / avgSize;
    
    return Math.max(0, 1 - coefficient);
  }
  
  /**
   * Analyze graph characteristics to choose optimal partitioning strategy
   */
  async analyzeGraphCharacteristics(graphData) {
    const subjects = new Set();
    const predicates = new Set();
    const objects = new Set();
    const types = new Set();
    
    let temporalTriples = 0;
    let typeTriples = 0;
    
    for (const triple of graphData.triples) {
      subjects.add(triple.subject.value);
      predicates.add(triple.predicate.value);
      objects.add(triple.object.value);
      
      if (triple.predicate.value === 'rdf:type') {
        types.add(triple.object.value);
        typeTriples++;
      }
      
      if (this.isTemporalPredicate(triple.predicate.value)) {
        temporalTriples++;
      }
    }
    
    return {
      totalTriples: graphData.triples.length,
      uniqueSubjects: subjects.size,
      uniquePredicates: predicates.size,
      uniqueObjects: objects.size,
      uniqueTypes: types.size,
      typeRatio: typeTriples / graphData.triples.length,
      temporalRatio: temporalTriples / graphData.triples.length,
      subjectDistribution: subjects.size / graphData.triples.length,
      predicateDistribution: predicates.size / graphData.triples.length,
      semanticDepth: this.estimateSemanticDepth(types)
    };
  }
  
  /**
   * Hash string to integer for consistent partitioning
   */
  hashString(str) {
    const hash = crypto.createHash('md5').update(str).digest('hex');
    return parseInt(hash.substring(0, 8), 16);
  }
  
  /**
   * Extract time group from date string
   */
  extractTimeGroup(dateStr, granularity) {
    try {
      const date = new Date(dateStr);
      
      switch (granularity) {
        case 'year':
          return date.getFullYear().toString();
        case 'month':
          return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        case 'day':
          return date.toISOString().split('T')[0];
        default:
          return date.toISOString().split('T')[0];
      }
    } catch (error) {
      return 'unknown';
    }
  }
  
  /**
   * Check if predicate is temporal
   */
  isTemporalPredicate(predicate) {
    const temporalPredicates = [
      'dcterms:created', 'dcterms:modified', 'dcterms:date',
      'prov:generatedAtTime', 'time:hasDateTimeDescription',
      'time:hasBeginning', 'time:hasEnd'
    ];
    return temporalPredicates.includes(predicate);
  }
  
  /**
   * Update partitioning statistics
   */
  updateStatistics(updates) {
    Object.assign(this.statistics, updates);
  }
  
  /**
   * Get partitioning statistics
   */
  getStatistics() {
    return { ...this.statistics };
  }
}

export default GraphPartitioner;
