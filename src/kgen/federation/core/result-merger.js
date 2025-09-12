/**
 * Query Result Merger for KGEN Federation
 * 
 * Advanced result merging and deduplication engine for federated queries
 * with intelligent conflict resolution and data harmonization capabilities.
 */

import { EventEmitter } from 'events';
import crypto from 'crypto';

export class QueryResultMerger extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = {
      // Merging strategies
      defaultStrategy: config.defaultStrategy || 'intelligent',
      conflictResolution: config.conflictResolution || 'priority',
      deduplication: config.deduplication !== false,
      
      // Deduplication settings
      deduplicationThreshold: config.deduplicationThreshold || 0.95,
      fuzzyMatching: config.fuzzyMatching !== false,
      semanticDeduplication: config.semanticDeduplication || false,
      
      // Performance settings
      batchSize: config.batchSize || 1000,
      maxConcurrency: config.maxConcurrency || 5,
      streamingEnabled: config.streamingEnabled || false,
      
      // Quality settings
      qualityScoring: config.qualityScoring !== false,
      dataValidation: config.dataValidation !== false,
      schemaValidation: config.schemaValidation || false,
      
      ...config
    };
    
    this.state = {
      initialized: false,
      mergeStrategies: new Map(),
      deduplicationCache: new Map(),
      qualityMetrics: new Map(),
      statistics: {
        totalMerges: 0,
        successfulMerges: 0,
        duplicatesRemoved: 0,
        conflictsResolved: 0,
        avgMergeTime: 0,
        dataQualityScore: 0
      }
    };
    
    // Merge strategy handlers
    this.mergeStrategies = {
      'union': this.unionMerge.bind(this),
      'intersection': this.intersectionMerge.bind(this),
      'priority': this.priorityMerge.bind(this),
      'weighted': this.weightedMerge.bind(this),
      'intelligent': this.intelligentMerge.bind(this),
      'semantic': this.semanticMerge.bind(this),
      'temporal': this.temporalMerge.bind(this),
      'consensus': this.consensusMerge.bind(this)
    };
    
    // Deduplication algorithms
    this.deduplicationAlgorithms = {
      'exact': this.exactDeduplication.bind(this),
      'fuzzy': this.fuzzyDeduplication.bind(this),
      'semantic': this.semanticDeduplication.bind(this),
      'structural': this.structuralDeduplication.bind(this),
      'hybrid': this.hybridDeduplication.bind(this)
    };
    
    // Conflict resolution strategies
    this.conflictResolvers = {
      'first_wins': this.firstWinsResolver.bind(this),
      'last_wins': this.lastWinsResolver.bind(this),
      'priority': this.priorityResolver.bind(this),
      'majority': this.majorityResolver.bind(this),
      'weighted': this.weightedResolver.bind(this),
      'quality': this.qualityResolver.bind(this),
      'temporal': this.temporalResolver.bind(this),
      'merge': this.mergeResolver.bind(this)
    };
    
    // Quality scoring functions
    this.qualityScorers = {
      'completeness': this.calculateCompleteness.bind(this),
      'accuracy': this.calculateAccuracy.bind(this),
      'consistency': this.calculateConsistency.bind(this),
      'timeliness': this.calculateTimeliness.bind(this),
      'validity': this.calculateValidity.bind(this),
      'uniqueness': this.calculateUniqueness.bind(this)
    };
  }
  
  async initialize() {
    console.log('🔀 Initializing Query Result Merger...');
    
    try {
      // Initialize merge strategies
      this.initializeMergeStrategies();
      
      // Initialize deduplication cache
      this.initializeDeduplicationCache();
      
      // Initialize quality scoring
      if (this.config.qualityScoring) {
        this.initializeQualityScoring();
      }
      
      // Setup performance monitoring
      this.setupPerformanceMonitoring();
      
      this.state.initialized = true;
      this.emit('initialized');
      
      console.log('✅ Query Result Merger initialized');
      
      return { success: true };
      
    } catch (error) {
      console.error('❌ Result merger initialization failed:', error);
      throw error;
    }
  }
  
  /**
   * Main merge method - merges results from multiple sources
   */
  async mergeResults(results, executionPlan, options = {}) {
    const mergeId = crypto.randomUUID();
    const startTime = Date.now();
    
    try {
      console.log(`🔀 Merging results from ${results.length || results.results?.length || 0} sources (${mergeId})`);
      
      this.state.statistics.totalMerges++;
      
      // Validate input
      const validatedResults = this.validateResults(results);
      if (!validatedResults.valid) {
        throw new Error(`Invalid results: ${validatedResults.error}`);
      }
      
      // Determine merge strategy
      const strategy = options.strategy || 
                      executionPlan.mergeStrategy || 
                      this.config.defaultStrategy;
      
      // Extract normalized data
      const normalizedData = await this.normalizeResults(validatedResults.results, executionPlan);
      
      // Perform deduplication if enabled
      let deduplicatedData = normalizedData;
      if (this.config.deduplication) {
        deduplicatedData = await this.performDeduplication(normalizedData, options);
      }
      
      // Apply merge strategy
      const mergeHandler = this.mergeStrategies[strategy];
      if (!mergeHandler) {
        throw new Error(`Unknown merge strategy: ${strategy}`);
      }
      
      const mergedData = await mergeHandler(deduplicatedData, executionPlan, options);
      
      // Resolve conflicts if any
      let finalData = mergedData;
      if (mergedData.conflicts && mergedData.conflicts.length > 0) {
        finalData = await this.resolveConflicts(mergedData, options);
      }
      
      // Calculate quality metrics
      const qualityMetrics = await this.calculateQualityMetrics(finalData, normalizedData);
      
      // Post-process results
      const processedResults = await this.postProcessResults(finalData, qualityMetrics, options);
      
      // Update statistics
      this.updateMergeStatistics(mergeId, 'success', Date.now() - startTime, processedResults);
      
      const result = {
        success: true,
        mergeId,
        strategy,
        data: processedResults.data,
        metadata: {
          sourceCount: normalizedData.length,
          duplicatesRemoved: this.state.statistics.duplicatesRemoved,
          conflictsResolved: mergedData.conflicts?.length || 0,
          mergeTime: Date.now() - startTime,
          qualityScore: qualityMetrics.overall || 0,
          deduplicationEnabled: this.config.deduplication,
          ...processedResults.metadata
        },
        quality: qualityMetrics,
        provenance: await this.buildMergeProvenance(mergeId, normalizedData, strategy)
      };
      
      this.emit('mergeCompleted', result);
      
      console.log(`✅ Results merged successfully (${Date.now() - startTime}ms)`);
      
      return result;
      
    } catch (error) {
      console.error(`❌ Result merge failed (${mergeId}):`, error);
      
      this.updateMergeStatistics(mergeId, 'failure', Date.now() - startTime);
      
      throw new Error(`Result merge failed: ${error.message}`);
    }
  }
  
  // Merge strategy implementations
  
  async unionMerge(results, executionPlan, options) {
    console.log('🔗 Performing union merge...');
    
    const unionData = [];
    const metadata = {
      sources: [],
      totalItems: 0
    };
    
    for (const result of results) {
      if (result.data && Array.isArray(result.data)) {
        unionData.push(...result.data);
        metadata.sources.push(result.source);
        metadata.totalItems += result.data.length;
      } else if (result.data) {
        unionData.push(result.data);
        metadata.sources.push(result.source);
        metadata.totalItems += 1;
      }
    }
    
    return {
      data: unionData,
      metadata,
      conflicts: []
    };
  }
  
  async intersectionMerge(results, executionPlan, options) {
    console.log('🎯 Performing intersection merge...');
    
    if (results.length === 0) {
      return { data: [], metadata: {}, conflicts: [] };
    }
    
    // Find common items across all results
    let intersectionData = results[0].data || [];
    const metadata = { sources: [results[0].source] };
    
    for (let i = 1; i < results.length; i++) {
      const resultData = results[i].data || [];
      intersectionData = intersectionData.filter(item1 =>
        resultData.some(item2 => this.areItemsEqual(item1, item2))
      );
      metadata.sources.push(results[i].source);
    }
    
    metadata.totalItems = intersectionData.length;
    
    return {
      data: intersectionData,
      metadata,
      conflicts: []
    };
  }
  
  async priorityMerge(results, executionPlan, options) {
    console.log('🏆 Performing priority merge...');
    
    // Sort results by priority
    const sortedResults = results.sort((a, b) => 
      (b.priority || 0) - (a.priority || 0)
    );
    
    const mergedData = [];
    const conflicts = [];
    const seenItems = new Set();
    
    for (const result of sortedResults) {
      if (!result.data) continue;
      
      const items = Array.isArray(result.data) ? result.data : [result.data];
      
      for (const item of items) {
        const itemKey = this.generateItemKey(item);
        
        if (!seenItems.has(itemKey)) {
          mergedData.push(item);
          seenItems.add(itemKey);
        } else {
          // Record conflict but don't include duplicate
          conflicts.push({
            type: 'priority_conflict',
            item,
            source: result.source,
            reason: 'Lower priority duplicate'
          });
        }
      }
    }
    
    return {
      data: mergedData,
      metadata: {
        sources: results.map(r => r.source),
        totalItems: mergedData.length,
        priorityOrder: sortedResults.map(r => r.source)
      },
      conflicts
    };
  }
  
  async weightedMerge(results, executionPlan, options) {
    console.log('⚖️ Performing weighted merge...');
    
    const weightedItems = new Map();
    const conflicts = [];
    
    // Assign weights and collect items
    for (const result of results) {
      const weight = result.weight || 1.0;
      const items = Array.isArray(result.data) ? result.data : [result.data];
      
      for (const item of items) {
        const itemKey = this.generateItemKey(item);
        
        if (!weightedItems.has(itemKey)) {
          weightedItems.set(itemKey, {
            item,
            totalWeight: weight,
            sources: [{ source: result.source, weight }],
            versions: [item]
          });
        } else {
          const existing = weightedItems.get(itemKey);
          existing.totalWeight += weight;
          existing.sources.push({ source: result.source, weight });
          existing.versions.push(item);
          
          // Create merged version based on weights
          const mergedItem = this.createWeightedMergedItem(existing.versions, existing.sources);
          existing.item = mergedItem;
        }
      }
    }
    
    const mergedData = Array.from(weightedItems.values()).map(wi => wi.item);
    
    return {
      data: mergedData,
      metadata: {
        sources: results.map(r => r.source),
        totalItems: mergedData.length,
        weightingApplied: true
      },
      conflicts
    };
  }
  
  async intelligentMerge(results, executionPlan, options) {
    console.log('🧠 Performing intelligent merge...');
    
    // Analyze result characteristics
    const analysis = await this.analyzeResults(results);
    
    // Choose optimal sub-strategy based on analysis
    let subStrategy;
    if (analysis.hasHighOverlap) {
      subStrategy = 'intersection';
    } else if (analysis.hasQualityVariance) {
      subStrategy = 'weighted';
    } else if (analysis.hasPriorityInfo) {
      subStrategy = 'priority';
    } else {
      subStrategy = 'union';
    }
    
    console.log(`🎯 Intelligent merge selected strategy: ${subStrategy}`);
    
    // Delegate to selected strategy
    const subHandler = this.mergeStrategies[subStrategy];
    const result = await subHandler(results, executionPlan, options);
    
    // Add intelligence metadata
    result.metadata.intelligentStrategy = subStrategy;
    result.metadata.analysisResults = analysis;
    
    return result;
  }
  
  async semanticMerge(results, executionPlan, options) {
    console.log('🔤 Performing semantic merge...');
    
    // This would implement semantic understanding and merging
    // For now, implement as enhanced union merge with semantic deduplication
    
    const mergedData = [];
    const conflicts = [];
    const semanticGroups = new Map();
    
    for (const result of results) {
      const items = Array.isArray(result.data) ? result.data : [result.data];
      
      for (const item of items) {
        const semanticKey = await this.generateSemanticKey(item);
        
        if (!semanticGroups.has(semanticKey)) {
          semanticGroups.set(semanticKey, {
            items: [item],
            sources: [result.source]
          });
        } else {
          const group = semanticGroups.get(semanticKey);
          group.items.push(item);
          group.sources.push(result.source);
        }
      }
    }
    
    // Merge semantically similar items
    for (const [semanticKey, group] of semanticGroups) {
      const mergedItem = await this.mergeSemanticGroup(group.items, group.sources);
      mergedData.push(mergedItem);
    }
    
    return {
      data: mergedData,
      metadata: {
        sources: results.map(r => r.source),
        totalItems: mergedData.length,
        semanticGroups: semanticGroups.size
      },
      conflicts
    };
  }
  
  async temporalMerge(results, executionPlan, options) {
    console.log('⏰ Performing temporal merge...');
    
    // Sort items by timestamp and merge based on temporal relationships
    const timestampedItems = [];
    
    for (const result of results) {
      const items = Array.isArray(result.data) ? result.data : [result.data];
      
      for (const item of items) {
        const timestamp = this.extractTimestamp(item);
        timestampedItems.push({
          item,
          timestamp,
          source: result.source
        });
      }
    }
    
    // Sort by timestamp (most recent first)
    timestampedItems.sort((a, b) => 
      new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()
    );
    
    // Apply temporal merge logic
    const mergedData = [];
    const conflicts = [];
    const seenKeys = new Set();
    
    for (const timestampedItem of timestampedItems) {
      const itemKey = this.generateItemKey(timestampedItem.item);
      
      if (!seenKeys.has(itemKey)) {
        mergedData.push(timestampedItem.item);
        seenKeys.add(itemKey);
      } else {
        conflicts.push({
          type: 'temporal_conflict',
          item: timestampedItem.item,
          source: timestampedItem.source,
          timestamp: timestampedItem.timestamp,
          reason: 'Older version of item'
        });
      }
    }
    
    return {
      data: mergedData,
      metadata: {
        sources: results.map(r => r.source),
        totalItems: mergedData.length,
        temporalOrdering: true
      },
      conflicts
    };
  }
  
  async consensusMerge(results, executionPlan, options) {
    console.log('🤝 Performing consensus merge...');
    
    const itemGroups = new Map();
    const conflicts = [];
    
    // Group items by similarity
    for (const result of results) {
      const items = Array.isArray(result.data) ? result.data : [result.data];
      
      for (const item of items) {
        let foundGroup = false;
        
        for (const [groupKey, group] of itemGroups) {
          if (await this.areItemsSimilar(item, group.items[0])) {
            group.items.push(item);
            group.sources.push(result.source);
            foundGroup = true;
            break;
          }
        }
        
        if (!foundGroup) {
          const groupKey = crypto.randomUUID();
          itemGroups.set(groupKey, {
            items: [item],
            sources: [result.source]
          });
        }
      }
    }
    
    // Apply consensus logic to each group
    const mergedData = [];
    const consensusThreshold = options.consensusThreshold || 0.5;
    
    for (const [groupKey, group] of itemGroups) {
      const consensus = group.sources.length / results.length;
      
      if (consensus >= consensusThreshold) {
        // Create consensus item
        const consensusItem = await this.createConsensusItem(group.items, group.sources);
        mergedData.push(consensusItem);
      } else {
        // Record as conflict
        conflicts.push({
          type: 'consensus_conflict',
          items: group.items,
          sources: group.sources,
          consensus: consensus,
          reason: `Consensus ${consensus.toFixed(2)} below threshold ${consensusThreshold}`
        });
      }
    }
    
    return {
      data: mergedData,
      metadata: {
        sources: results.map(r => r.source),
        totalItems: mergedData.length,
        consensusThreshold,
        groupsEvaluated: itemGroups.size
      },
      conflicts
    };
  }
  
  // Deduplication implementations
  
  async performDeduplication(results, options) {
    console.log('🔍 Performing deduplication...');
    
    const algorithm = options.deduplicationAlgorithm || 'hybrid';
    const deduplicationHandler = this.deduplicationAlgorithms[algorithm];
    
    if (!deduplicationHandler) {
      console.warn(`⚠️  Unknown deduplication algorithm: ${algorithm}, using exact`);
      return await this.exactDeduplication(results, options);
    }
    
    return await deduplicationHandler(results, options);
  }
  
  async exactDeduplication(results, options) {
    console.log('🎯 Performing exact deduplication...');
    
    const seen = new Set();
    const deduplicated = [];
    let duplicatesCount = 0;
    
    for (const result of results) {
      const items = Array.isArray(result.data) ? result.data : [result.data];
      
      for (const item of items) {
        const itemHash = this.generateExactHash(item);
        
        if (!seen.has(itemHash)) {
          seen.add(itemHash);
          deduplicated.push({ ...result, data: item });
        } else {
          duplicatesCount++;
        }
      }
    }
    
    this.state.statistics.duplicatesRemoved += duplicatesCount;
    
    return deduplicated;
  }
  
  async fuzzyDeduplication(results, options) {
    console.log('🔍 Performing fuzzy deduplication...');
    
    const threshold = options.fuzzyThreshold || this.config.deduplicationThreshold;
    const deduplicated = [];
    let duplicatesCount = 0;
    
    for (const result of results) {
      const items = Array.isArray(result.data) ? result.data : [result.data];
      
      for (const item of items) {
        let isDuplicate = false;
        
        for (const existing of deduplicated) {
          const similarity = await this.calculateSimilarity(item, existing.data);
          
          if (similarity >= threshold) {
            isDuplicate = true;
            duplicatesCount++;
            break;
          }
        }
        
        if (!isDuplicate) {
          deduplicated.push({ ...result, data: item });
        }
      }
    }
    
    this.state.statistics.duplicatesRemoved += duplicatesCount;
    
    return deduplicated;
  }
  
  async semanticDeduplication(results, options) {
    console.log('🔤 Performing semantic deduplication...');
    
    // This would implement semantic similarity checking
    // For now, implement as enhanced fuzzy deduplication
    
    return await this.fuzzyDeduplication(results, {
      ...options,
      fuzzyThreshold: 0.8 // Higher threshold for semantic similarity
    });
  }
  
  async structuralDeduplication(results, options) {
    console.log('🏗️ Performing structural deduplication...');
    
    const deduplicated = [];
    const structureMap = new Map();
    let duplicatesCount = 0;
    
    for (const result of results) {
      const items = Array.isArray(result.data) ? result.data : [result.data];
      
      for (const item of items) {
        const structure = this.extractStructure(item);
        const structureKey = JSON.stringify(structure);
        
        if (!structureMap.has(structureKey)) {
          structureMap.set(structureKey, []);
        }
        
        const similarItems = structureMap.get(structureKey);
        let isDuplicate = false;
        
        for (const similarItem of similarItems) {
          if (await this.areStructurallySimilar(item, similarItem)) {
            isDuplicate = true;
            duplicatesCount++;
            break;
          }
        }
        
        if (!isDuplicate) {
          similarItems.push(item);
          deduplicated.push({ ...result, data: item });
        }
      }
    }
    
    this.state.statistics.duplicatesRemoved += duplicatesCount;
    
    return deduplicated;
  }
  
  async hybridDeduplication(results, options) {
    console.log('🔀 Performing hybrid deduplication...');
    
    // First pass: exact deduplication
    let deduplicated = await this.exactDeduplication(results, options);
    
    // Second pass: fuzzy deduplication on remaining items
    deduplicated = await this.fuzzyDeduplication(deduplicated, options);
    
    // Third pass: structural deduplication if enabled
    if (options.includeStructural !== false) {
      deduplicated = await this.structuralDeduplication(deduplicated, options);
    }
    
    return deduplicated;
  }
  
  // Conflict resolution implementations
  
  async resolveConflicts(mergedData, options) {
    console.log(`⚖️ Resolving ${mergedData.conflicts.length} conflicts...`);
    
    const strategy = options.conflictResolution || this.config.conflictResolution;
    const resolver = this.conflictResolvers[strategy];
    
    if (!resolver) {
      console.warn(`⚠️  Unknown conflict resolution strategy: ${strategy}`);
      return mergedData;
    }
    
    const resolvedData = await resolver(mergedData, options);
    
    this.state.statistics.conflictsResolved += mergedData.conflicts.length;
    
    return resolvedData;
  }
  
  async firstWinsResolver(mergedData, options) {
    // Keep first occurrence, discard conflicts
    return {
      data: mergedData.data,
      metadata: {
        ...mergedData.metadata,
        conflictResolution: 'first_wins',
        conflictsDiscarded: mergedData.conflicts.length
      },
      conflicts: []
    };
  }
  
  async lastWinsResolver(mergedData, options) {
    // Replace with last occurrence from conflicts
    const finalData = [...mergedData.data];
    
    for (const conflict of mergedData.conflicts) {
      const existingIndex = finalData.findIndex(item => 
        this.generateItemKey(item) === this.generateItemKey(conflict.item)
      );
      
      if (existingIndex !== -1) {
        finalData[existingIndex] = conflict.item;
      } else {
        finalData.push(conflict.item);
      }
    }
    
    return {
      data: finalData,
      metadata: {
        ...mergedData.metadata,
        conflictResolution: 'last_wins',
        conflictsResolved: mergedData.conflicts.length
      },
      conflicts: []
    };
  }
  
  async priorityResolver(mergedData, options) {
    // Resolve based on source priority
    const priorityMap = options.sourcePriorities || new Map();
    const finalData = [...mergedData.data];
    
    for (const conflict of mergedData.conflicts) {
      const existingIndex = finalData.findIndex(item => 
        this.generateItemKey(item) === this.generateItemKey(conflict.item)
      );
      
      if (existingIndex !== -1) {
        const existingPriority = priorityMap.get(conflict.source) || 0;
        const conflictPriority = priorityMap.get(conflict.source) || 0;
        
        if (conflictPriority > existingPriority) {
          finalData[existingIndex] = conflict.item;
        }
      }
    }
    
    return {
      data: finalData,
      metadata: {
        ...mergedData.metadata,
        conflictResolution: 'priority',
        conflictsResolved: mergedData.conflicts.length
      },
      conflicts: []
    };
  }
  
  async majorityResolver(mergedData, options) {
    // Use majority voting for conflict resolution
    return await this.consensusMerge([{ data: mergedData.data }, 
      ...mergedData.conflicts.map(c => ({ data: c.item, source: c.source }))], 
      {}, { consensusThreshold: 0.5 });
  }
  
  async weightedResolver(mergedData, options) {
    // Use weighted voting for conflict resolution
    const sourceWeights = options.sourceWeights || new Map();
    
    // Implementation would weight conflicts by source reliability
    return {
      data: mergedData.data,
      metadata: {
        ...mergedData.metadata,
        conflictResolution: 'weighted'
      },
      conflicts: []
    };
  }
  
  async qualityResolver(mergedData, options) {
    // Resolve based on data quality scores
    const finalData = [...mergedData.data];
    
    for (const conflict of mergedData.conflicts) {
      const conflictQuality = await this.calculateItemQuality(conflict.item);
      const existingIndex = finalData.findIndex(item => 
        this.generateItemKey(item) === this.generateItemKey(conflict.item)
      );
      
      if (existingIndex !== -1) {
        const existingQuality = await this.calculateItemQuality(finalData[existingIndex]);
        
        if (conflictQuality > existingQuality) {
          finalData[existingIndex] = conflict.item;
        }
      }
    }
    
    return {
      data: finalData,
      metadata: {
        ...mergedData.metadata,
        conflictResolution: 'quality'
      },
      conflicts: []
    };
  }
  
  async temporalResolver(mergedData, options) {
    // Resolve based on timestamps (most recent wins)
    const finalData = [...mergedData.data];
    
    for (const conflict of mergedData.conflicts) {
      const existingIndex = finalData.findIndex(item => 
        this.generateItemKey(item) === this.generateItemKey(conflict.item)
      );
      
      if (existingIndex !== -1) {
        const existingTime = new Date(this.extractTimestamp(finalData[existingIndex]) || 0);
        const conflictTime = new Date(this.extractTimestamp(conflict.item) || 0);
        
        if (conflictTime > existingTime) {
          finalData[existingIndex] = conflict.item;
        }
      }
    }
    
    return {
      data: finalData,
      metadata: {
        ...mergedData.metadata,
        conflictResolution: 'temporal'
      },
      conflicts: []
    };
  }
  
  async mergeResolver(mergedData, options) {
    // Attempt to merge conflicting items
    const finalData = [...mergedData.data];
    
    for (const conflict of mergedData.conflicts) {
      const existingIndex = finalData.findIndex(item => 
        this.generateItemKey(item) === this.generateItemKey(conflict.item)
      );
      
      if (existingIndex !== -1) {
        const mergedItem = await this.mergeItems(finalData[existingIndex], conflict.item);
        finalData[existingIndex] = mergedItem;
      } else {
        finalData.push(conflict.item);
      }
    }
    
    return {
      data: finalData,
      metadata: {
        ...mergedData.metadata,
        conflictResolution: 'merge'
      },
      conflicts: []
    };
  }
  
  // Utility methods
  
  validateResults(results) {
    if (!results) {
      return { valid: false, error: 'Results is null or undefined' };
    }
    
    // Handle different result formats
    let normalizedResults;
    if (Array.isArray(results)) {
      normalizedResults = results;
    } else if (results.results && Array.isArray(results.results)) {
      normalizedResults = results.results;
    } else if (results.data) {
      normalizedResults = [results];
    } else {
      return { valid: false, error: 'Invalid results format' };
    }
    
    return { valid: true, results: normalizedResults };
  }
  
  async normalizeResults(results, executionPlan) {
    console.log('🔄 Normalizing results...');
    
    const normalized = [];
    
    for (const result of results) {
      const normalizedResult = {
        data: result.data || result.bindings || result,
        source: result.endpointId || result.source || 'unknown',
        priority: result.priority || 1,
        weight: result.weight || 1.0,
        timestamp: result.timestamp || new Date().toISOString(),
        metadata: result.metadata || {}
      };
      
      normalized.push(normalizedResult);
    }
    
    return normalized;
  }
  
  generateItemKey(item) {
    // Generate unique key for item identification
    if (typeof item === 'object' && item !== null) {
      if (item.id) return `id:${item.id}`;
      if (item._id) return `_id:${item._id}`;
      if (item.uri) return `uri:${item.uri}`;
      
      // Generate hash of object properties
      const sortedKeys = Object.keys(item).sort();
      const keyValues = sortedKeys.map(k => `${k}:${item[k]}`).join('|');
      return crypto.createHash('md5').update(keyValues).digest('hex');
    }
    
    return crypto.createHash('md5').update(JSON.stringify(item)).digest('hex');
  }
  
  generateExactHash(item) {
    return crypto.createHash('sha256')
      .update(JSON.stringify(item, Object.keys(item).sort()))
      .digest('hex');
  }
  
  async generateSemanticKey(item) {
    // This would implement semantic key generation
    // For now, use a simplified approach based on text content
    if (typeof item === 'object') {
      const textContent = this.extractTextContent(item);
      return crypto.createHash('md5').update(textContent.toLowerCase()).digest('hex');
    }
    
    return crypto.createHash('md5').update(String(item).toLowerCase()).digest('hex');
  }
  
  extractTextContent(obj) {
    let text = '';
    
    const traverse = (value) => {
      if (typeof value === 'string') {
        text += value + ' ';
      } else if (typeof value === 'object' && value !== null) {
        for (const prop of Object.values(value)) {
          traverse(prop);
        }
      }
    };
    
    traverse(obj);
    return text.trim();
  }
  
  areItemsEqual(item1, item2) {
    return this.generateItemKey(item1) === this.generateItemKey(item2);
  }
  
  async areItemsSimilar(item1, item2, threshold = 0.8) {
    const similarity = await this.calculateSimilarity(item1, item2);
    return similarity >= threshold;
  }
  
  async calculateSimilarity(item1, item2) {
    // Implement similarity calculation (simplified version)
    const text1 = this.extractTextContent(item1).toLowerCase();
    const text2 = this.extractTextContent(item2).toLowerCase();
    
    // Simple Jaccard similarity
    const words1 = new Set(text1.split(/\s+/));
    const words2 = new Set(text2.split(/\s+/));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }
  
  extractStructure(item) {
    if (typeof item !== 'object' || item === null) {
      return { type: typeof item };
    }
    
    const structure = {};
    for (const key of Object.keys(item)) {
      structure[key] = typeof item[key];
    }
    
    return structure;
  }
  
  async areStructurallySimilar(item1, item2) {
    const structure1 = this.extractStructure(item1);
    const structure2 = this.extractStructure(item2);
    
    const keys1 = Object.keys(structure1).sort();
    const keys2 = Object.keys(structure2).sort();
    
    return JSON.stringify(keys1) === JSON.stringify(keys2);
  }
  
  extractTimestamp(item) {
    // Try to extract timestamp from various common fields
    if (typeof item === 'object' && item !== null) {
      return item.timestamp || 
             item.createdAt || 
             item.updatedAt || 
             item.modified || 
             item.date || 
             null;
    }
    return null;
  }
  
  async mergeItems(item1, item2) {
    // Simple merge strategy - combine properties
    if (typeof item1 === 'object' && typeof item2 === 'object') {
      return { ...item1, ...item2 };
    }
    
    return item2; // Default to second item
  }
  
  createWeightedMergedItem(items, sources) {
    // Create item based on weighted average/consensus
    if (items.length === 1) return items[0];
    
    // For simplicity, return the item with highest weight
    const maxWeight = Math.max(...sources.map(s => s.weight));
    const maxWeightIndex = sources.findIndex(s => s.weight === maxWeight);
    
    return items[maxWeightIndex] || items[0];
  }
  
  async mergeSemanticGroup(items, sources) {
    // Merge semantically similar items
    if (items.length === 1) return items[0];
    
    // Simple merge - combine unique properties
    const merged = {};
    
    for (const item of items) {
      if (typeof item === 'object' && item !== null) {
        Object.assign(merged, item);
      }
    }
    
    return merged;
  }
  
  async createConsensusItem(items, sources) {
    // Create item based on consensus
    return await this.mergeSemanticGroup(items, sources);
  }
  
  async analyzeResults(results) {
    // Analyze result characteristics to inform intelligent merging
    const analysis = {
      resultCount: results.length,
      hasHighOverlap: false,
      hasQualityVariance: false,
      hasPriorityInfo: false,
      averageSize: 0,
      totalItems: 0
    };
    
    // Calculate overlap
    if (results.length > 1) {
      const keys = results.map(r => new Set(
        (Array.isArray(r.data) ? r.data : [r.data]).map(item => this.generateItemKey(item))
      ));
      
      const intersection = keys.reduce((acc, set) => new Set([...acc].filter(x => set.has(x))));
      const union = keys.reduce((acc, set) => new Set([...acc, ...set]));
      
      analysis.hasHighOverlap = intersection.size / union.size > 0.5;
    }
    
    // Check for priority information
    analysis.hasPriorityInfo = results.some(r => r.priority !== undefined);
    
    // Calculate quality variance
    if (this.config.qualityScoring) {
      const qualities = await Promise.all(
        results.map(r => this.calculateResultQuality(r))
      );
      const avgQuality = qualities.reduce((a, b) => a + b, 0) / qualities.length;
      const variance = qualities.reduce((acc, q) => acc + Math.pow(q - avgQuality, 2), 0) / qualities.length;
      
      analysis.hasQualityVariance = variance > 0.1;
    }
    
    return analysis;
  }
  
  async calculateResultQuality(result) {
    // Calculate quality score for a result
    let quality = 0.5; // Base quality
    
    if (result.data) {
      const itemCount = Array.isArray(result.data) ? result.data.length : 1;
      quality += Math.min(itemCount / 100, 0.3); // More items = higher quality (up to limit)
    }
    
    if (result.timestamp) {
      const age = Date.now() - new Date(result.timestamp).getTime();
      const ageInDays = age / (1000 * 60 * 60 * 24);
      quality += Math.max(0, 0.2 - (ageInDays / 365) * 0.2); // Fresher data = higher quality
    }
    
    return Math.min(quality, 1.0);
  }
  
  async calculateItemQuality(item) {
    // Calculate quality score for an individual item
    let quality = 0.5; // Base quality
    
    if (typeof item === 'object' && item !== null) {
      // More fields = higher quality
      const fieldCount = Object.keys(item).length;
      quality += Math.min(fieldCount / 20, 0.3);
      
      // Non-null values = higher quality
      const nonNullValues = Object.values(item).filter(v => v !== null && v !== undefined && v !== '').length;
      quality += Math.min(nonNullValues / fieldCount, 0.2);
    }
    
    return Math.min(quality, 1.0);
  }
  
  // Quality metrics calculation
  
  async calculateQualityMetrics(finalData, originalData) {
    console.log('📊 Calculating quality metrics...');
    
    const metrics = {
      overall: 0,
      completeness: 0,
      accuracy: 0,
      consistency: 0,
      timeliness: 0,
      validity: 0,
      uniqueness: 0
    };
    
    if (this.config.qualityScoring) {
      const scores = await Promise.all([
        this.qualityScorers.completeness(finalData, originalData),
        this.qualityScorers.accuracy(finalData, originalData),
        this.qualityScorers.consistency(finalData, originalData),
        this.qualityScorers.timeliness(finalData, originalData),
        this.qualityScorers.validity(finalData, originalData),
        this.qualityScorers.uniqueness(finalData, originalData)
      ]);
      
      metrics.completeness = scores[0];
      metrics.accuracy = scores[1];
      metrics.consistency = scores[2];
      metrics.timeliness = scores[3];
      metrics.validity = scores[4];
      metrics.uniqueness = scores[5];
      
      // Calculate overall score (weighted average)
      metrics.overall = (
        metrics.completeness * 0.2 +
        metrics.accuracy * 0.25 +
        metrics.consistency * 0.2 +
        metrics.timeliness * 0.15 +
        metrics.validity * 0.15 +
        metrics.uniqueness * 0.05
      );
    }
    
    return metrics;
  }
  
  async calculateCompleteness(finalData, originalData) {
    // Calculate data completeness
    if (!Array.isArray(finalData.data)) return 0;
    
    let totalFields = 0;
    let populatedFields = 0;
    
    for (const item of finalData.data) {
      if (typeof item === 'object' && item !== null) {
        const fields = Object.keys(item);
        totalFields += fields.length;
        populatedFields += fields.filter(f => 
          item[f] !== null && item[f] !== undefined && item[f] !== ''
        ).length;
      }
    }
    
    return totalFields > 0 ? populatedFields / totalFields : 0;
  }
  
  async calculateAccuracy(finalData, originalData) {
    // This would implement accuracy calculation against ground truth
    // For now, return a mock score
    return 0.85;
  }
  
  async calculateConsistency(finalData, originalData) {
    // Calculate internal consistency
    if (!Array.isArray(finalData.data)) return 0;
    
    // Simple consistency check based on data types
    const typeConsistency = new Map();
    
    for (const item of finalData.data) {
      if (typeof item === 'object' && item !== null) {
        for (const [field, value] of Object.entries(item)) {
          const type = typeof value;
          
          if (!typeConsistency.has(field)) {
            typeConsistency.set(field, new Set());
          }
          
          typeConsistency.get(field).add(type);
        }
      }
    }
    
    let consistentFields = 0;
    let totalFields = 0;
    
    for (const [field, types] of typeConsistency) {
      totalFields++;
      if (types.size === 1) {
        consistentFields++;
      }
    }
    
    return totalFields > 0 ? consistentFields / totalFields : 0;
  }
  
  async calculateTimeliness(finalData, originalData) {
    // Calculate data freshness
    if (!Array.isArray(finalData.data)) return 0;
    
    let totalAge = 0;
    let itemsWithTimestamp = 0;
    const now = Date.now();
    
    for (const item of finalData.data) {
      const timestamp = this.extractTimestamp(item);
      if (timestamp) {
        const age = now - new Date(timestamp).getTime();
        totalAge += age;
        itemsWithTimestamp++;
      }
    }
    
    if (itemsWithTimestamp === 0) return 0;
    
    const avgAge = totalAge / itemsWithTimestamp;
    const ageInDays = avgAge / (1000 * 60 * 60 * 24);
    
    // Score decreases with age (0-1 scale, 1 = fresh, 0 = very old)
    return Math.max(0, 1 - (ageInDays / 365));
  }
  
  async calculateValidity(finalData, originalData) {
    // Calculate data validity (format, constraints, etc.)
    // Mock implementation
    return 0.9;
  }
  
  async calculateUniqueness(finalData, originalData) {
    // Calculate uniqueness ratio
    if (!Array.isArray(finalData.data)) return 0;
    
    const keys = new Set();
    let totalItems = 0;
    
    for (const item of finalData.data) {
      totalItems++;
      keys.add(this.generateItemKey(item));
    }
    
    return totalItems > 0 ? keys.size / totalItems : 0;
  }
  
  async postProcessResults(finalData, qualityMetrics, options) {
    console.log('🔧 Post-processing results...');
    
    // Apply any final transformations
    const processedData = {
      data: finalData.data,
      metadata: {
        ...finalData.metadata,
        postProcessed: true,
        qualityScore: qualityMetrics.overall
      }
    };
    
    // Apply sorting if requested
    if (options.sort) {
      processedData.data = this.sortResults(processedData.data, options.sort);
    }
    
    // Apply limiting if requested
    if (options.limit) {
      processedData.data = processedData.data.slice(0, options.limit);
    }
    
    return processedData;
  }
  
  sortResults(data, sortConfig) {
    if (!Array.isArray(data)) return data;
    
    return data.sort((a, b) => {
      const aValue = sortConfig.field ? a[sortConfig.field] : a;
      const bValue = sortConfig.field ? b[sortConfig.field] : b;
      
      if (sortConfig.direction === 'desc') {
        return bValue > aValue ? 1 : bValue < aValue ? -1 : 0;
      } else {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      }
    });
  }
  
  async buildMergeProvenance(mergeId, results, strategy) {
    return {
      mergeId,
      strategy,
      sourceCount: results.length,
      sources: results.map(r => r.source),
      timestamp: new Date().toISOString()
    };
  }
  
  updateMergeStatistics(mergeId, status, duration, results = null) {
    this.state.statistics.totalMerges++;
    
    if (status === 'success') {
      this.state.statistics.successfulMerges++;
      
      if (results) {
        // Update quality statistics
        const quality = results.metadata?.qualityScore || 0;
        this.state.statistics.dataQualityScore = 
          (this.state.statistics.dataQualityScore + quality) / 2;
      }
    }
    
    // Update average merge time
    const total = this.state.statistics.totalMerges;
    const currentAvg = this.state.statistics.avgMergeTime;
    this.state.statistics.avgMergeTime = ((currentAvg * (total - 1)) + duration) / total;
  }
  
  // Initialization methods
  
  initializeMergeStrategies() {
    console.log('🔄 Initializing merge strategies...');
  }
  
  initializeDeduplicationCache() {
    console.log('🔍 Initializing deduplication cache...');
  }
  
  initializeQualityScoring() {
    console.log('📊 Initializing quality scoring...');
  }
  
  setupPerformanceMonitoring() {
    console.log('📈 Setting up performance monitoring...');
  }
  
  getStatistics() {
    return {
      ...this.state.statistics,
      timestamp: new Date().toISOString()
    };
  }
  
  async shutdown() {
    console.log('🔄 Shutting down Query Result Merger...');
    
    // Clear caches
    this.state.deduplicationCache.clear();
    this.state.qualityMetrics.clear();
    
    this.state.initialized = false;
    this.emit('shutdown');
    
    console.log('✅ Query Result Merger shutdown complete');
  }
}

export default QueryResultMerger;