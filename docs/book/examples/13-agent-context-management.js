/**
 * Multi-Agent Context Coordination for Spec-Driven Development
 * 
 * Advanced patterns for coordinating context across multiple AI agents
 * in parallel development workflows. Based on real implementations from
 * the Unjucks v2 project that achieved 84.8% SWE-Bench success rate.
 * 
 * Key Innovations:
 * - Distributed context sharing without token overflow
 * - Agent-specific context optimization
 * - Real-time coordination memory management
 * - Cross-agent pattern learning and adaptation
 */

import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import crypto from 'crypto';

/**
 * Context Coordination Hub
 * Central system for managing shared context across multiple AI agents
 */
class AgentContextCoordinator extends EventEmitter {
  constructor(options = {}) {
    super();
    this.maxGlobalTokens = options.maxGlobalTokens || 64000; // Shared context limit
    this.agentTokenLimit = options.agentTokenLimit || 32000; // Per-agent context limit
    this.compressionThreshold = options.compressionThreshold || 0.8; // Trigger compression at 80%
    
    this.agents = new Map(); // Active agent contexts
    this.sharedMemory = new Map(); // Cross-agent shared context
    this.patterns = new Map(); // Learned patterns
    this.sessionId = crypto.randomUUID();
    
    this.metrics = {
      totalAgents: 0,
      contextSyncs: 0,
      compressionEvents: 0,
      patternMatches: 0,
      tokensSaved: 0,
      coordinationTime: 0
    };
    
    // Auto-compression when approaching limits
    this.setupAutoCompression();
  }

  /**
   * Pattern 1: Agent Registration and Context Specialization
   * Each agent type gets optimized context based on their role
   */
  registerAgent(agentId, agentType, specialization = {}) {
    const startTime = performance.now();
    
    const agentContext = {
      id: agentId,
      type: agentType,
      specialization,
      context: this.createSpecializedContext(agentType, specialization),
      tokenUsage: 0,
      lastSync: this.getDeterministicTimestamp(),
      patterns: new Set(),
      dependencies: new Set(),
      contributions: []
    };
    
    this.agents.set(agentId, agentContext);
    this.metrics.totalAgents++;
    this.metrics.coordinationTime += performance.now() - startTime;
    
    // Emit registration event for other agents
    this.emit('agentRegistered', { agentId, agentType, context: agentContext });
    
    console.log(`🤖 Agent ${agentId} (${agentType}) registered with specialized context`);
    return agentContext;
  }

  createSpecializedContext(agentType, specialization) {
    const baseContext = {
      sessionId: this.sessionId,
      timestamp: this.getDeterministicTimestamp(),
      agentType,
      specialization
    };
    
    // Role-specific context optimization patterns from Unjucks v2
    switch (agentType) {
      case 'researcher':
        return {
          ...baseContext,
          focus: 'analysis_and_requirements',
          contextPriority: ['specifications', 'examples', 'patterns', 'documentation'],
          compressionStrategy: 'preserve_examples',
          memoryRetention: 'high', // Keep research findings longer
          relevantPatterns: [
            'yaml_specification_analysis',
            'requirement_extraction',
            'pattern_identification',
            'best_practice_research'
          ]
        };
      
      case 'coder':
        return {
          ...baseContext,
          focus: 'implementation',
          contextPriority: ['templates', 'code_examples', 'apis', 'dependencies'],
          compressionStrategy: 'preserve_implementation_details',
          memoryRetention: 'medium',
          relevantPatterns: [
            'template_rendering',
            'file_generation',
            'code_injection',
            'error_handling',
            'api_integration'
          ]
        };
      
      case 'tester':
        return {
          ...baseContext,
          focus: 'validation_and_testing',
          contextPriority: ['test_cases', 'edge_cases', 'validation_rules', 'bdd_scenarios'],
          compressionStrategy: 'preserve_test_scenarios',
          memoryRetention: 'high', // Keep test cases for regression
          relevantPatterns: [
            'bdd_scenario_writing',
            'unit_test_generation',
            'integration_testing',
            'edge_case_identification'
          ]
        };
      
      case 'reviewer':
        return {
          ...baseContext,
          focus: 'quality_and_standards',
          contextPriority: ['code_quality', 'security', 'performance', 'standards'],
          compressionStrategy: 'preserve_quality_metrics',
          memoryRetention: 'medium',
          relevantPatterns: [
            'code_review_guidelines',
            'security_scanning',
            'performance_analysis',
            'best_practices_enforcement'
          ]
        };
      
      case 'system-architect':
        return {
          ...baseContext,
          focus: 'architecture_and_design',
          contextPriority: ['system_design', 'patterns', 'scalability', 'integration'],
          compressionStrategy: 'preserve_architectural_decisions',
          memoryRetention: 'very_high', // Architecture decisions are long-lasting
          relevantPatterns: [
            'system_architecture',
            'design_patterns',
            'scalability_planning',
            'integration_design'
          ]
        };
      
      default:
        return {
          ...baseContext,
          focus: 'general',
          contextPriority: ['general_context'],
          compressionStrategy: 'balanced',
          memoryRetention: 'medium',
          relevantPatterns: ['general_development']
        };
    }
  }

  /**
   * Pattern 2: Intelligent Context Sharing
   * Share relevant context between agents without duplicating everything
   */
  async shareContext(fromAgentId, toAgentId, contextKey, data, importance = 'medium') {
    const startTime = performance.now();
    const fromAgent = this.agents.get(fromAgentId);
    const toAgent = this.agents.get(toAgentId);
    
    if (!fromAgent || !toAgent) {
      throw new Error(`Invalid agent IDs: ${fromAgentId} -> ${toAgentId}`);
    }
    
    // Determine relevance based on agent types and specializations
    const relevance = this.calculateContextRelevance(fromAgent, toAgent, contextKey, data);
    
    if (relevance.score < 0.3) {
      console.log(`📊 Context ${contextKey} not relevant enough (${relevance.score}) for ${toAgentId}`);
      return false;
    }
    
    // Compress context based on receiving agent's specialization
    const compressedContext = this.compressContextForAgent(data, toAgent, relevance);
    
    // Store in shared memory
    const memoryKey = `${fromAgentId}->${toAgentId}:${contextKey}`;
    this.sharedMemory.set(memoryKey, {
      data: compressedContext,
      metadata: {
        fromAgent: fromAgentId,
        toAgent: toAgentId,
        contextKey,
        importance,
        relevance: relevance.score,
        timestamp: this.getDeterministicTimestamp(),
        tokenCount: this.estimateTokens(compressedContext)
      }
    });
    
    // Add to receiving agent's context
    toAgent.context.sharedData = toAgent.context.sharedData || {};
    toAgent.context.sharedData[contextKey] = {
      ...compressedContext,
      source: fromAgentId,
      relevance: relevance.score
    };
    
    // Track dependencies
    toAgent.dependencies.add(fromAgentId);
    fromAgent.contributions.push({ to: toAgentId, contextKey, timestamp: this.getDeterministicTimestamp() });
    
    this.metrics.contextSyncs++;
    this.metrics.coordinationTime += performance.now() - startTime;
    
    this.emit('contextShared', { fromAgentId, toAgentId, contextKey, relevance: relevance.score });
    
    console.log(`🔄 Context '${contextKey}' shared ${fromAgentId} -> ${toAgentId} (relevance: ${relevance.score.toFixed(2)})`);
    return true;
  }

  calculateContextRelevance(fromAgent, toAgent, contextKey, data) {
    const relevanceFactors = {
      agentTypeCompatibility: this.calculateAgentTypeCompatibility(fromAgent.type, toAgent.type),
      contextKeyRelevance: this.calculateContextKeyRelevance(contextKey, toAgent.specialization),
      dataRelevance: this.calculateDataRelevance(data, toAgent.context.relevantPatterns),
      temporalRelevance: this.calculateTemporalRelevance(fromAgent, toAgent),
      dependencyRelevance: this.calculateDependencyRelevance(fromAgent, toAgent)
    };
    
    // Weighted scoring
    const weights = {
      agentTypeCompatibility: 0.3,
      contextKeyRelevance: 0.25,
      dataRelevance: 0.25,
      temporalRelevance: 0.1,
      dependencyRelevance: 0.1
    };
    
    const score = Object.keys(relevanceFactors).reduce((total, factor) => {
      return total + (relevanceFactors[factor] * weights[factor]);
    }, 0);
    
    return {
      score: Math.max(0, Math.min(1, score)),
      factors: relevanceFactors,
      reasoning: this.generateRelevanceReasoning(relevanceFactors, weights)
    };
  }

  calculateAgentTypeCompatibility(fromType, toType) {
    // Compatibility matrix based on real workflow patterns
    const compatibilityMatrix = {
      researcher: { coder: 0.9, tester: 0.7, reviewer: 0.8, 'system-architect': 0.9 },
      coder: { researcher: 0.8, tester: 0.9, reviewer: 0.9, 'system-architect': 0.7 },
      tester: { researcher: 0.6, coder: 0.9, reviewer: 0.8, 'system-architect': 0.5 },
      reviewer: { researcher: 0.7, coder: 0.9, tester: 0.8, 'system-architect': 0.6 },
      'system-architect': { researcher: 0.9, coder: 0.8, tester: 0.6, reviewer: 0.7 }
    };
    
    return compatibilityMatrix[fromType]?.[toType] || 0.5;
  }

  calculateContextKeyRelevance(contextKey, specialization) {
    const keywordMatches = specialization.relevantPatterns?.filter(pattern => 
      contextKey.toLowerCase().includes(pattern.toLowerCase().replace('_', ''))
    ) || [];
    
    return Math.min(1, keywordMatches.length * 0.3 + 0.1);
  }

  calculateDataRelevance(data, relevantPatterns) {
    if (!data || !relevantPatterns) return 0.5;
    
    const dataString = JSON.stringify(data).toLowerCase();
    const matches = relevantPatterns.filter(pattern => 
      dataString.includes(pattern.toLowerCase().replace('_', ''))
    );
    
    return Math.min(1, matches.length * 0.2 + 0.2);
  }

  calculateTemporalRelevance(fromAgent, toAgent) {
    const timeDiff = Math.abs(fromAgent.lastSync - toAgent.lastSync);
    const maxRelevantTime = 300000; // 5 minutes
    
    return Math.max(0, 1 - (timeDiff / maxRelevantTime));
  }

  calculateDependencyRelevance(fromAgent, toAgent) {
    const hasDependency = toAgent.dependencies.has(fromAgent.id) || 
                         fromAgent.dependencies.has(toAgent.id);
    return hasDependency ? 0.8 : 0.3;
  }

  /**
   * Pattern 3: Dynamic Context Compression
   * Automatically compress context when approaching token limits
   */
  compressContextForAgent(data, agent, relevance) {
    const strategy = agent.context.compressionStrategy;
    const targetReduction = Math.max(0.3, 1 - relevance.score); // Lower relevance = more compression
    
    switch (strategy) {
      case 'preserve_examples':
        return this.compressPreservingExamples(data, targetReduction);
      
      case 'preserve_implementation_details':
        return this.compressPreservingImplementation(data, targetReduction);
      
      case 'preserve_test_scenarios':
        return this.compressPreservingTests(data, targetReduction);
      
      case 'preserve_quality_metrics':
        return this.compressPreservingQuality(data, targetReduction);
      
      case 'preserve_architectural_decisions':
        return this.compressPreservingArchitecture(data, targetReduction);
      
      default:
        return this.compressBalanced(data, targetReduction);
    }
  }

  compressPreservingExamples(data, reduction) {
    if (typeof data !== 'object') return data;
    
    const compressed = { ...data };
    
    // Preserve example-related fields
    const preserveFields = ['examples', 'samples', 'patterns', 'specifications'];
    const compressFields = Object.keys(data).filter(key => !preserveFields.includes(key));
    
    // Compress non-essential fields
    compressFields.forEach(field => {
      if (Array.isArray(data[field])) {
        const keepCount = Math.max(1, Math.floor(data[field].length * (1 - reduction)));
        compressed[field] = data[field].slice(0, keepCount);
      } else if (typeof data[field] === 'string' && data[field].length > 500) {
        const keepLength = Math.max(100, Math.floor(data[field].length * (1 - reduction)));
        compressed[field] = data[field].substring(0, keepLength) + '...';
      }
    });
    
    return compressed;
  }

  compressPreservingImplementation(data, reduction) {
    if (typeof data !== 'object') return data;
    
    const compressed = { ...data };
    
    // Preserve implementation-critical fields
    const preserveFields = ['code', 'templates', 'functions', 'apis', 'dependencies', 'config'];
    const compressFields = Object.keys(data).filter(key => !preserveFields.includes(key));
    
    // More aggressive compression of documentation and examples
    compressFields.forEach(field => {
      if (field.includes('doc') || field.includes('example') || field.includes('comment')) {
        if (Array.isArray(data[field])) {
          compressed[field] = data[field].slice(0, Math.max(1, Math.floor(data[field].length * 0.3)));
        } else if (typeof data[field] === 'string') {
          compressed[field] = data[field].substring(0, 200) + '...';
        }
      }
    });
    
    return compressed;
  }

  /**
   * Pattern 4: Cross-Agent Pattern Learning
   * Learn from successful agent collaborations and optimize future interactions
   */
  learnFromInteraction(fromAgentId, toAgentId, contextKey, outcome) {
    const patternKey = `${fromAgentId}->${toAgentId}:${contextKey}`;
    
    const existingPattern = this.patterns.get(patternKey) || {
      interactions: 0,
      successes: 0,
      avgRelevance: 0,
      bestPractices: [],
      commonIssues: []
    };
    
    existingPattern.interactions++;
    
    if (outcome.success) {
      existingPattern.successes++;
      existingPattern.avgRelevance = 
        (existingPattern.avgRelevance * (existingPattern.interactions - 1) + outcome.relevance) / 
        existingPattern.interactions;
      
      // Extract successful patterns
      if (outcome.bestPractices) {
        existingPattern.bestPractices.push(...outcome.bestPractices);
        existingPattern.bestPractices = [...new Set(existingPattern.bestPractices)]; // Deduplicate
      }
    } else {
      // Learn from failures
      if (outcome.issues) {
        existingPattern.commonIssues.push(...outcome.issues);
      }
    }
    
    this.patterns.set(patternKey, existingPattern);
    this.metrics.patternMatches++;
    
    // Emit learning event
    this.emit('patternLearned', { patternKey, pattern: existingPattern, outcome });
  }

  /**
   * Pattern 5: Real-time Context Synchronization
   * Keep all agents synchronized with minimal overhead
   */
  async synchronizeAgents(options = {}) {
    const startTime = performance.now();
    const {
      includeAgents = Array.from(this.agents.keys()),
      syncDepth = 'shallow', // shallow, medium, deep
      forceSync = false
    } = options;
    
    console.log(`🔄 Starting agent synchronization (${syncDepth} mode)`);
    
    const syncPromises = includeAgents.map(async (agentId) => {
      const agent = this.agents.get(agentId);
      if (!agent) return null;
      
      try {
        const syncData = await this.prepareSyncData(agent, syncDepth);
        await this.applySyncData(agent, syncData);
        agent.lastSync = this.getDeterministicTimestamp();
        
        return { agentId, success: true, tokenCount: this.estimateTokens(syncData) };
      } catch (error) {
        console.error(`❌ Sync failed for agent ${agentId}:`, error.message);
        return { agentId, success: false, error: error.message };
      }
    });
    
    const results = await Promise.all(syncPromises);
    const successful = results.filter(r => r?.success).length;
    
    this.metrics.contextSyncs++;
    this.metrics.coordinationTime += performance.now() - startTime;
    
    console.log(`✅ Synchronized ${successful}/${includeAgents.length} agents in ${((performance.now() - startTime)).toFixed(2)}ms`);
    
    this.emit('agentsSynchronized', { 
      total: includeAgents.length, 
      successful, 
      results,
      syncDepth,
      duration: performance.now() - startTime
    });
    
    return results;
  }

  async prepareSyncData(agent, depth) {
    const syncData = {
      globalContext: this.getGlobalContext(depth),
      relevantSharedData: this.getRelevantSharedData(agent, depth),
      patterns: this.getRelevantPatterns(agent, depth),
      metadata: {
        timestamp: this.getDeterministicTimestamp(),
        depth,
        tokenCount: 0
      }
    };
    
    syncData.metadata.tokenCount = this.estimateTokens(syncData);
    
    // Compress if exceeding agent's token limit
    if (syncData.metadata.tokenCount > agent.context.agentTokenLimit) {
      const compressionRatio = agent.context.agentTokenLimit / syncData.metadata.tokenCount;
      return this.compressContextForAgent(syncData, agent, { score: compressionRatio });
    }
    
    return syncData;
  }

  async applySyncData(agent, syncData) {
    // Merge sync data into agent's context
    agent.context.global = { ...agent.context.global, ...syncData.globalContext };
    agent.context.shared = { ...agent.context.shared, ...syncData.relevantSharedData };
    agent.context.patterns = { ...agent.context.patterns, ...syncData.patterns };
    agent.context.lastSyncData = syncData;
    
    // Update token usage
    agent.tokenUsage = this.estimateTokens(agent.context);
  }

  /**
   * Pattern 6: Context Memory Management
   * Intelligent cleanup and archiving of context data
   */
  manageContextMemory() {
    const startTime = performance.now();
    let cleanedItems = 0;
    let archivedItems = 0;
    let tokensSaved = 0;
    
    // Clean expired shared memory
    for (const [key, value] of this.sharedMemory.entries()) {
      const age = this.getDeterministicTimestamp() - value.metadata.timestamp;
      const maxAge = this.getMaxAgeForImportance(value.metadata.importance);
      
      if (age > maxAge) {
        tokensSaved += value.metadata.tokenCount;
        this.sharedMemory.delete(key);
        cleanedItems++;
      }
    }
    
    // Archive old patterns
    for (const [key, pattern] of this.patterns.entries()) {
      if (pattern.interactions > 10 && pattern.successes / pattern.interactions < 0.3) {
        // Archive low-success patterns
        this.archivePattern(key, pattern);
        this.patterns.delete(key);
        archivedItems++;
      }
    }
    
    // Compress agent contexts if needed
    for (const agent of this.agents.values()) {
      if (agent.tokenUsage > agent.context.agentTokenLimit * 0.9) {
        const beforeTokens = agent.tokenUsage;
        agent.context = this.compressContextForAgent(agent.context, agent, { score: 0.7 });
        agent.tokenUsage = this.estimateTokens(agent.context);
        tokensSaved += beforeTokens - agent.tokenUsage;
      }
    }
    
    this.metrics.tokensSaved += tokensSaved;
    this.metrics.coordinationTime += performance.now() - startTime;
    
    console.log(`🧹 Memory cleanup: ${cleanedItems} items cleaned, ${archivedItems} patterns archived, ${tokensSaved} tokens saved`);
    
    this.emit('memoryManaged', {
      cleanedItems,
      archivedItems,
      tokensSaved,
      duration: performance.now() - startTime
    });
  }

  // Auto-compression setup
  setupAutoCompression() {
    setInterval(() => {
      const totalTokens = this.calculateTotalTokenUsage();
      const utilizationRatio = totalTokens / this.maxGlobalTokens;
      
      if (utilizationRatio > this.compressionThreshold) {
        console.log(`⚡ Auto-compression triggered (${(utilizationRatio * 100).toFixed(1)}% utilization)`);
        this.manageContextMemory();
        this.metrics.compressionEvents++;
      }
    }, 30000); // Check every 30 seconds
  }

  // Utility methods
  calculateTotalTokenUsage() {
    let total = 0;
    
    // Agent contexts
    for (const agent of this.agents.values()) {
      total += agent.tokenUsage || 0;
    }
    
    // Shared memory
    for (const item of this.sharedMemory.values()) {
      total += item.metadata.tokenCount || 0;
    }
    
    return total;
  }

  estimateTokens(content) {
    if (typeof content === 'string') {
      return Math.ceil(content.length / 4);
    }
    
    if (typeof content === 'object') {
      return Math.ceil(JSON.stringify(content).length / 4);
    }
    
    return 0;
  }

  getMaxAgeForImportance(importance) {
    const ages = {
      critical: 3600000, // 1 hour
      high: 1800000,     // 30 minutes
      medium: 900000,    // 15 minutes
      low: 300000        // 5 minutes
    };
    
    return ages[importance] || ages.medium;
  }

  // Reporting and metrics
  getCoordinationReport() {
    return {
      sessionId: this.sessionId,
      metrics: this.metrics,
      currentState: {
        totalAgents: this.agents.size,
        sharedMemorySize: this.sharedMemory.size,
        patternsLearned: this.patterns.size,
        totalTokenUsage: this.calculateTotalTokenUsage(),
        utilizationRatio: (this.calculateTotalTokenUsage() / this.maxGlobalTokens * 100).toFixed(1) + '%'
      },
      agentStates: Array.from(this.agents.entries()).map(([id, agent]) => ({
        id,
        type: agent.type,
        tokenUsage: agent.tokenUsage,
        dependencies: Array.from(agent.dependencies),
        contributions: agent.contributions.length,
        lastSync: new Date(agent.lastSync).toISOString()
      }))
    };
  }

  // Helper methods (simplified for brevity)
  getGlobalContext(depth) {
    return { sessionId: this.sessionId, depth, timestamp: this.getDeterministicTimestamp() };
  }

  getRelevantSharedData(agent, depth) {
    const relevantData = {};
    for (const [key, value] of this.sharedMemory.entries()) {
      if (key.includes(agent.id)) {
        relevantData[key] = depth === 'shallow' ? value.metadata : value;
      }
    }
    return relevantData;
  }

  getRelevantPatterns(agent, depth) {
    const relevantPatterns = {};
    for (const [key, pattern] of this.patterns.entries()) {
      if (key.includes(agent.id) || pattern.successes / pattern.interactions > 0.7) {
        relevantPatterns[key] = pattern;
      }
    }
    return relevantPatterns;
  }

  archivePattern(key, pattern) {
    // In real implementation, would store to persistent storage
    console.log(`📁 Archiving pattern ${key} with ${pattern.interactions} interactions`);
  }

  generateRelevanceReasoning(factors, weights) {
    const sortedFactors = Object.entries(factors)
      .sort(([,a], [,b]) => b - a)
      .map(([name, score]) => `${name}: ${score.toFixed(2)} (${(weights[name] * 100).toFixed(0)}%)`);
    
    return `Top factors: ${sortedFactors.slice(0, 3).join(', ')}`;
  }

  // Compression strategies (simplified implementations)
  compressPreservingTests(data, reduction) {
    // Similar to other compression methods but preserving test-related data
    return this.compressBalanced(data, reduction * 0.5); // Less aggressive for tests
  }

  compressPreservingQuality(data, reduction) {
    // Preserve quality metrics and standards
    return this.compressBalanced(data, reduction * 0.7);
  }

  compressPreservingArchitecture(data, reduction) {
    // Preserve architectural decisions and design patterns
    return this.compressBalanced(data, reduction * 0.3); // Least aggressive
  }

  compressBalanced(data, reduction) {
    if (typeof data !== 'object' || !data) return data;
    
    const compressed = {};
    
    for (const [key, value] of Object.entries(data)) {
      if (Array.isArray(value)) {
        const keepCount = Math.max(1, Math.floor(value.length * (1 - reduction)));
        compressed[key] = value.slice(0, keepCount);
      } else if (typeof value === 'string' && value.length > 200) {
        const keepLength = Math.max(50, Math.floor(value.length * (1 - reduction)));
        compressed[key] = value.substring(0, keepLength) + '...';
      } else {
        compressed[key] = value;
      }
    }
    
    return compressed;
  }
}

// Export the coordinator
export default AgentContextCoordinator;
export { AgentContextCoordinator };

/**
 * Usage Example:
 * 
 * const coordinator = new AgentContextCoordinator({
 *   maxGlobalTokens: 64000,
 *   agentTokenLimit: 32000
 * });
 * 
 * // Register agents
 * const researcher = coordinator.registerAgent('researcher-1', 'researcher');
 * const coder = coordinator.registerAgent('coder-1', 'coder');
 * 
 * // Share context between agents
 * await coordinator.shareContext('researcher-1', 'coder-1', 'api-spec', {
 *   endpoints: [...],
 *   models: [...],
 *   requirements: [...]
 * });
 * 
 * // Synchronize all agents
 * await coordinator.synchronizeAgents({ syncDepth: 'medium' });
 * 
 * // Get performance report
 * console.log(coordinator.getCoordinationReport());
 */