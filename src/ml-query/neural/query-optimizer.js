/**
 * Neural Query Optimizer - Reinforcement Learning Based Query Plan Optimization
 * 
 * Uses deep Q-learning to optimize SPARQL query execution plans based on
 * query patterns, data characteristics, and historical performance.
 */

import consola from 'consola';
import * as tf from '@tensorflow/tfjs-node';

export class NeuralQueryOptimizer {
  constructor(options = {}) {
    this.options = {
      modelPath: options.modelPath,
      trainingData: options.trainingData,
      learningRate: options.learningRate || 0.001,
      batchSize: options.batchSize || 32,
      maxEpisodes: options.maxEpisodes || 1000,
      epsilonDecay: options.epsilonDecay || 0.995,
      gamma: options.gamma || 0.95,
      ...options
    };
    
    this.logger = consola.withTag('neural-optimizer');
    this.model = null;
    this.targetModel = null;
    this.optimizer = null;
    this.epsilon = 1.0; // Exploration rate
    
    // State features for RL environment
    this.stateFeatures = [
      'queryComplexity',
      'joinCount',
      'filterCount',
      'optionalCount',
      'unionCount',
      'subqueryCount',
      'dataSize',
      'indexCoverage',
      'selectivity',
      'cardinalityEstimate'
    ];
    
    // Action space for query optimization
    this.actions = [
      'reorderJoins',
      'pushDownFilters',
      'materializeSubqueries',
      'addIndexHints',
      'parallelizeJoins',
      'optimizeUnions',
      'cacheIntermediateResults',
      'rewriteOptionals',
      'optimizeGroupBy',
      'noOptimization'
    ];
    
    // Training history
    this.trainingHistory = [];
    this.replayBuffer = [];
    this.maxBufferSize = 10000;
  }

  async initialize() {
    try {
      this.logger.info('Initializing neural query optimizer...');
      
      if (this.options.modelPath) {
        await this.loadModel();
      } else {
        await this.createModel();
      }
      
      this.optimizer = tf.train.adam(this.options.learningRate);
      this.logger.success('Neural query optimizer initialized');
      
    } catch (error) {
      this.logger.error('Failed to initialize neural optimizer:', error);
      throw error;
    }
  }

  async createModel() {
    // Deep Q-Network for query optimization
    this.model = tf.sequential({
      layers: [
        tf.layers.dense({
          inputShape: [this.stateFeatures.length],
          units: 128,
          activation: 'relu',
          kernelInitializer: 'heNormal'
        }),
        tf.layers.dropout({ rate: 0.3 }),
        tf.layers.dense({
          units: 64,
          activation: 'relu',
          kernelInitializer: 'heNormal'
        }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({
          units: 32,
          activation: 'relu',
          kernelInitializer: 'heNormal'
        }),
        tf.layers.dense({
          units: this.actions.length,
          activation: 'linear'
        })
      ]
    });

    // Target network for stable training
    this.targetModel = tf.sequential({
      layers: [
        tf.layers.dense({
          inputShape: [this.stateFeatures.length],
          units: 128,
          activation: 'relu',
          kernelInitializer: 'heNormal'
        }),
        tf.layers.dropout({ rate: 0.3 }),
        tf.layers.dense({
          units: 64,
          activation: 'relu',
          kernelInitializer: 'heNormal'
        }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({
          units: 32,
          activation: 'relu',
          kernelInitializer: 'heNormal'
        }),
        tf.layers.dense({
          units: this.actions.length,
          activation: 'linear'
        })
      ]
    });

    // Initialize target model with same weights
    this.targetModel.setWeights(this.model.getWeights());
    
    this.logger.debug('Created neural network model for query optimization');
  }

  async loadModel() {
    try {
      this.model = await tf.loadLayersModel(this.options.modelPath);
      this.targetModel = await tf.loadLayersModel(this.options.modelPath.replace('.json', '_target.json'));
      this.logger.debug('Loaded pre-trained neural model');
    } catch (error) {
      this.logger.warn('Failed to load model, creating new one:', error);
      await this.createModel();
    }
  }

  async saveModel(path) {
    if (this.model) {
      await this.model.save(path);
      await this.targetModel.save(path.replace('.json', '_target.json'));
      this.logger.info(`Model saved to ${path}`);
    }
  }

  /**
   * Optimize query using reinforcement learning
   * @param {string} query - SPARQL query to optimize
   * @param {Object} store - Data store for context
   */
  async optimize(query, store) {
    try {
      // Extract state features from query and data
      const state = await this.extractStateFeatures(query, store);
      
      // Get action from neural network
      const action = await this.selectAction(state);
      
      // Apply optimization action
      const optimizationPlan = await this.applyOptimization(query, action, state);
      
      // Record for learning
      this.recordInteraction(state, action, query);
      
      return {
        originalQuery: query,
        optimizedQuery: optimizationPlan.optimizedQuery,
        executionPlan: optimizationPlan.executionPlan,
        expectedImprovement: optimizationPlan.expectedImprovement,
        action: this.actions[action],
        confidence: optimizationPlan.confidence
      };
      
    } catch (error) {
      this.logger.error('Query optimization failed:', error);
      return {
        originalQuery: query,
        optimizedQuery: query,
        executionPlan: null,
        expectedImprovement: 0,
        action: 'noOptimization',
        confidence: 0,
        error: error.message
      };
    }
  }

  async extractStateFeatures(query, store) {
    const features = new Array(this.stateFeatures.length).fill(0);
    
    try {
      // Parse query to extract structural features
      const queryAnalysis = this.analyzeQuery(query);
      
      features[0] = queryAnalysis.complexity; // queryComplexity
      features[1] = queryAnalysis.joinCount; // joinCount
      features[2] = queryAnalysis.filterCount; // filterCount
      features[3] = queryAnalysis.optionalCount; // optionalCount
      features[4] = queryAnalysis.unionCount; // unionCount
      features[5] = queryAnalysis.subqueryCount; // subqueryCount
      features[6] = store ? store.size : 1000; // dataSize estimate
      features[7] = this.estimateIndexCoverage(query, store); // indexCoverage
      features[8] = this.estimateSelectivity(query); // selectivity
      features[9] = this.estimateCardinality(query, store); // cardinalityEstimate
      
    } catch (error) {
      this.logger.warn('Feature extraction failed, using defaults:', error);
    }
    
    return features;
  }

  analyzeQuery(query) {
    const analysis = {
      complexity: 1,
      joinCount: 0,
      filterCount: 0,
      optionalCount: 0,
      unionCount: 0,
      subqueryCount: 0
    };
    
    // Count structural elements
    analysis.joinCount = (query.match(/\s+\.\s+/g) || []).length;
    analysis.filterCount = (query.match(/FILTER\s*\(/gi) || []).length;
    analysis.optionalCount = (query.match(/OPTIONAL\s*\{/gi) || []).length;
    analysis.unionCount = (query.match(/UNION\s*\{/gi) || []).length;
    analysis.subqueryCount = (query.match(/\{\s*SELECT/gi) || []).length;
    
    // Calculate complexity score
    analysis.complexity = 1 + 
      analysis.joinCount * 0.3 +
      analysis.filterCount * 0.2 +
      analysis.optionalCount * 0.4 +
      analysis.unionCount * 0.5 +
      analysis.subqueryCount * 0.6;
    
    return analysis;
  }

  estimateIndexCoverage(query, store) {
    // Simplified index coverage estimation
    const predicates = this.extractPredicates(query);
    const indexedPredicates = predicates.filter(p => this.isLikelyIndexed(p));
    return predicates.length > 0 ? indexedPredicates.length / predicates.length : 0.5;
  }

  estimateSelectivity(query) {
    // Simplified selectivity estimation based on filter patterns
    const filters = (query.match(/FILTER\s*\([^)]+\)/gi) || []);
    let selectivity = 1.0;
    
    for (const filter of filters) {
      if (filter.includes('=')) selectivity *= 0.1;
      else if (filter.includes('>') || filter.includes('<')) selectivity *= 0.3;
      else if (filter.includes('regex') || filter.includes('contains')) selectivity *= 0.5;
      else selectivity *= 0.7;
    }
    
    return Math.max(0.001, selectivity);
  }

  estimateCardinality(query, store) {
    // Simplified cardinality estimation
    const baseCardinality = store ? store.size : 1000;
    const selectivity = this.estimateSelectivity(query);
    return Math.max(1, Math.floor(baseCardinality * selectivity));
  }

  extractPredicates(query) {
    const predicatePattern = /<[^>]+>|[a-zA-Z_][a-zA-Z0-9_]*:[a-zA-Z_][a-zA-Z0-9_]*/g;
    return query.match(predicatePattern) || [];
  }

  isLikelyIndexed(predicate) {
    // Heuristic: common predicates are likely indexed
    const commonPredicates = ['rdf:type', 'rdfs:label', 'prov:wasDerivedFrom', 'prov:wasGeneratedBy'];
    return commonPredicates.includes(predicate) || predicate.includes('time') || predicate.includes('id');
  }

  async selectAction(state) {
    // Epsilon-greedy action selection
    if (Math.random() < this.epsilon) {
      // Explore: random action
      return Math.floor(Math.random() * this.actions.length);
    } else {
      // Exploit: best action from neural network
      const stateTensor = tf.tensor2d([state]);
      const qValues = this.model.predict(stateTensor);
      const action = (await qValues.argMax(1).data())[0];
      
      stateTensor.dispose();
      qValues.dispose();
      
      return action;
    }
  }

  async applyOptimization(query, actionIndex, state) {
    const action = this.actions[actionIndex];
    const optimizationPlan = {
      optimizedQuery: query,
      executionPlan: null,
      expectedImprovement: 0,
      confidence: 0.5
    };

    switch (action) {
      case 'reorderJoins':
        optimizationPlan.optimizedQuery = this.reorderJoins(query);
        optimizationPlan.expectedImprovement = 0.2;
        optimizationPlan.executionPlan = { joinOrder: 'optimized' };
        break;
        
      case 'pushDownFilters':
        optimizationPlan.optimizedQuery = this.pushDownFilters(query);
        optimizationPlan.expectedImprovement = 0.3;
        optimizationPlan.executionPlan = { filterPushdown: true };
        break;
        
      case 'materializeSubqueries':
        optimizationPlan.optimizedQuery = this.materializeSubqueries(query);
        optimizationPlan.expectedImprovement = 0.15;
        optimizationPlan.executionPlan = { materialization: true };
        break;
        
      case 'addIndexHints':
        optimizationPlan.executionPlan = { indexHints: this.generateIndexHints(query) };
        optimizationPlan.expectedImprovement = 0.25;
        break;
        
      case 'parallelizeJoins':
        optimizationPlan.executionPlan = { parallelJoins: true };
        optimizationPlan.expectedImprovement = 0.4;
        break;
        
      case 'optimizeUnions':
        optimizationPlan.optimizedQuery = this.optimizeUnions(query);
        optimizationPlan.expectedImprovement = 0.1;
        break;
        
      case 'cacheIntermediateResults':
        optimizationPlan.executionPlan = { cacheIntermediate: true };
        optimizationPlan.expectedImprovement = 0.35;
        break;
        
      case 'rewriteOptionals':
        optimizationPlan.optimizedQuery = this.rewriteOptionals(query);
        optimizationPlan.expectedImprovement = 0.2;
        break;
        
      case 'optimizeGroupBy':
        optimizationPlan.optimizedQuery = this.optimizeGroupBy(query);
        optimizationPlan.expectedImprovement = 0.15;
        break;
        
      default: // noOptimization
        optimizationPlan.expectedImprovement = 0;
        break;
    }

    // Adjust confidence based on query complexity
    const complexity = state[0]; // queryComplexity feature
    optimizationPlan.confidence = Math.max(0.1, 1.0 - (complexity / 10));

    return optimizationPlan;
  }

  reorderJoins(query) {
    // Simplified join reordering - move more selective joins first
    return query.replace(/(\?\w+)\s+([^.\s]+)\s+(\?\w+)\s*\.\s*(\?\w+)\s+([^.\s]+)\s+(\?\w+)/g, 
      (match, s1, p1, o1, s2, p2, o2) => {
        // Heuristic: predicates with 'id' or 'type' are more selective
        if (p2.includes('id') || p2.includes('type')) {
          return `${s2} ${p2} ${o2} . ${s1} ${p1} ${o1}`;
        }
        return match;
      });
  }

  pushDownFilters(query) {
    // Move FILTER clauses closer to relevant triple patterns
    const filters = query.match(/FILTER\s*\([^)]+\)/gi) || [];
    let optimized = query;
    
    for (const filter of filters) {
      // Simple heuristic: move filter after the first triple pattern it references
      const variables = filter.match(/\?\w+/g) || [];
      if (variables.length > 0) {
        const variable = variables[0];
        optimized = optimized.replace(filter, '');
        optimized = optimized.replace(
          new RegExp(`(${variable.replace('?', '\\?')}[^.]*\\.)`, 'i'),
          `$1 ${filter}`
        );
      }
    }
    
    return optimized;
  }

  materializeSubqueries(query) {
    // Add materialization hints for subqueries
    return query.replace(/\{\s*SELECT/gi, '{ # MATERIALIZE\n  SELECT');
  }

  generateIndexHints(query) {
    const predicates = this.extractPredicates(query);
    return predicates.map(p => ({ predicate: p, priority: 'high' }));
  }

  optimizeUnions(query) {
    // Optimize UNION patterns by reordering based on selectivity
    return query.replace(/UNION\s*\{([^}]+)\}/gi, (match, unionContent) => {
      // Simple optimization: keep as is for now
      return match;
    });
  }

  rewriteOptionals(query) {
    // Rewrite OPTIONAL patterns for better performance
    return query.replace(/OPTIONAL\s*\{([^}]+)\}/gi, (match, optionalContent) => {
      // Move more selective patterns outside of OPTIONAL if possible
      if (optionalContent.includes('rdf:type') || optionalContent.includes('id')) {
        return optionalContent + ` OPTIONAL { ${optionalContent.replace(/[^.]*\./g, '')} }`;
      }
      return match;
    });
  }

  optimizeGroupBy(query) {
    // Optimize GROUP BY operations
    return query.replace(/(GROUP\s+BY\s+[^}]+)/gi, (match) => {
      return `${match} # OPTIMIZE_GROUPBY`;
    });
  }

  recordInteraction(state, action, query) {
    // Record state-action pair for learning
    this.replayBuffer.push({
      state,
      action,
      query,
      timestamp: this.getDeterministicTimestamp()
    });

    // Trim buffer if too large
    if (this.replayBuffer.length > this.maxBufferSize) {
      this.replayBuffer = this.replayBuffer.slice(-this.maxBufferSize * 0.8);
    }
  }

  async updateFromFeedback(queryId, performanceFeedback) {
    // Update model based on actual performance feedback
    const interaction = this.replayBuffer.find(r => r.queryId === queryId);
    if (interaction && performanceFeedback.actualTime && performanceFeedback.expectedTime) {
      const reward = this.calculateReward(performanceFeedback);
      
      // Add to training data
      this.trainingHistory.push({
        ...interaction,
        reward,
        feedback: performanceFeedback
      });

      // Trigger retraining if enough data
      if (this.trainingHistory.length % 100 === 0) {
        await this.retrain();
      }
    }
  }

  calculateReward(feedback) {
    const improvement = (feedback.expectedTime - feedback.actualTime) / feedback.expectedTime;
    return Math.max(-1, Math.min(1, improvement * 2)); // Reward between -1 and 1
  }

  async retrain() {
    if (this.trainingHistory.length < this.options.batchSize) return;
    
    try {
      this.logger.info('Starting neural model retraining...');
      
      // Prepare training data
      const batchSize = Math.min(this.options.batchSize, this.trainingHistory.length);
      const batch = this.trainingHistory.slice(-batchSize);
      
      const states = batch.map(b => b.state);
      const actions = batch.map(b => b.action);
      const rewards = batch.map(b => b.reward);
      
      // Prepare target values
      const stateTensor = tf.tensor2d(states);
      const currentQValues = this.model.predict(stateTensor);
      const targetQValues = this.targetModel.predict(stateTensor);
      
      // Update Q-values with rewards
      const targets = await currentQValues.data();
      for (let i = 0; i < batch.length; i++) {
        const actionIndex = actions[i];
        const reward = rewards[i];
        const maxFutureQ = Math.max(...(await targetQValues.slice([i, 0], [1, -1]).data()));
        targets[i * this.actions.length + actionIndex] = reward + this.options.gamma * maxFutureQ;
      }
      
      const targetTensor = tf.tensor2d(targets, [batch.length, this.actions.length]);
      
      // Train model
      await this.model.fit(stateTensor, targetTensor, {
        epochs: 1,
        batchSize: batchSize,
        verbose: 0
      });
      
      // Update target network periodically
      if (this.trainingHistory.length % 1000 === 0) {
        this.targetModel.setWeights(this.model.getWeights());
        this.logger.debug('Updated target network');
      }
      
      // Decay exploration rate
      this.epsilon = Math.max(0.01, this.epsilon * this.options.epsilonDecay);
      
      // Cleanup tensors
      stateTensor.dispose();
      currentQValues.dispose();
      targetQValues.dispose();
      targetTensor.dispose();
      
      this.logger.success('Neural model retrained successfully');
      
    } catch (error) {
      this.logger.error('Retraining failed:', error);
    }
  }

  async suggestOptimizations(query) {
    const state = await this.extractStateFeatures(query, null);
    const stateTensor = tf.tensor2d([state]);
    const qValues = await this.model.predict(stateTensor).data();
    
    // Get top 3 optimization suggestions
    const suggestions = [];
    const sortedActions = qValues
      .map((value, index) => ({ value, index, action: this.actions[index] }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 3);
    
    for (const { value, action } of sortedActions) {
      if (value > 0.1) { // Only suggest if confidence is reasonable
        suggestions.push({
          action,
          confidence: value,
          description: this.getActionDescription(action)
        });
      }
    }
    
    stateTensor.dispose();
    return suggestions;
  }

  getActionDescription(action) {
    const descriptions = {
      reorderJoins: 'Reorder join operations for better performance',
      pushDownFilters: 'Move filter conditions closer to data access',
      materializeSubqueries: 'Cache intermediate subquery results',
      addIndexHints: 'Use specific indexes for query execution',
      parallelizeJoins: 'Execute join operations in parallel',
      optimizeUnions: 'Optimize UNION operations',
      cacheIntermediateResults: 'Cache intermediate computation results',
      rewriteOptionals: 'Rewrite OPTIONAL patterns for efficiency',
      optimizeGroupBy: 'Optimize GROUP BY operations',
      noOptimization: 'No optimization recommended'
    };
    
    return descriptions[action] || 'Unknown optimization';
  }

  getTrainingStatistics() {
    return {
      trainingHistory: this.trainingHistory.length,
      replayBuffer: this.replayBuffer.length,
      epsilon: this.epsilon,
      modelExists: !!this.model,
      lastTrained: this.trainingHistory.length > 0 ? 
        new Date(this.trainingHistory[this.trainingHistory.length - 1].timestamp) : null
    };
  }
}

export default NeuralQueryOptimizer;