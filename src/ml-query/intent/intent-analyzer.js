/**
 * Query Intent Analyzer - ML-based SPARQL Query Intent Understanding
 * 
 * Analyzes SPARQL queries and natural language to understand user intent,
 * providing intelligent suggestions and query optimization recommendations.
 */

import consola from 'consola';

export class QueryIntentAnalyzer {
  constructor(options = {}) {
    this.options = {
      classificationModel: options.classificationModel || 'distilbert-base-uncased',
      intentCategories: options.intentCategories || [
        'lineage', 'compliance', 'performance', 'security', 'exploration', 'analytics'
      ],
      confidenceThreshold: options.confidenceThreshold || 0.7,
      maxSuggestions: options.maxSuggestions || 5,
      contextWindow: options.contextWindow || 10,
      ...options
    };
    
    this.logger = consola.withTag('intent-analyzer');
    
    // ML models
    this.intentClassifier = null;
    this.contextAnalyzer = null;
    this.suggestionEngine = null;
    
    // Intent patterns and rules
    this.intentPatterns = new Map();
    this.contextPatterns = new Map();
    this.domainKnowledge = new Map();
    
    // Learning and adaptation
    this.userBehaviorProfiles = new Map();
    this.sessionHistory = [];
    this.feedbackHistory = [];
    
    // Metrics
    this.metrics = {
      classificationsPerformed: 0,
      correctPredictions: 0,
      suggestionsProvided: 0,
      feedbackReceived: 0,
      accuracy: 0
    };
    
    this.initializeComponents();
  }

  async initialize() {
    try {
      this.logger.info('Initializing query intent analyzer...');
      
      // Initialize ML models
      await this.initializeIntentClassifier();
      await this.initializeContextAnalyzer();
      await this.initializeSuggestionEngine();
      
      // Load domain knowledge
      await this.loadDomainKnowledge();
      
      // Load intent patterns
      await this.loadIntentPatterns();
      
      this.logger.success('Query intent analyzer initialized');
      
    } catch (error) {
      this.logger.error('Failed to initialize intent analyzer:', error);
      throw error;
    }
  }

  initializeComponents() {
    // Intent classification features
    this.features = {
      lexical: ['keywords', 'ngrams', 'entities'],
      syntactic: ['query_structure', 'clauses', 'patterns'],
      semantic: ['domain_concepts', 'relationships', 'context'],
      pragmatic: ['user_history', 'session_context', 'goals']
    };
    
    // Intent-specific keyword patterns
    this.intentKeywords = {
      lineage: [
        'lineage', 'provenance', 'derived', 'origin', 'source', 'ancestry',
        'wasDerivedFrom', 'wasGeneratedBy', 'history', 'trace', 'flow'
      ],
      compliance: [
        'audit', 'compliance', 'regulation', 'gdpr', 'sox', 'hipaa',
        'policy', 'governance', 'control', 'violation', 'breach'
      ],
      performance: [
        'performance', 'optimization', 'speed', 'execution', 'time',
        'benchmark', 'efficiency', 'bottleneck', 'slow', 'fast'
      ],
      security: [
        'security', 'access', 'permission', 'authentication', 'authorization',
        'privacy', 'confidential', 'sensitive', 'threat', 'risk'
      ],
      exploration: [
        'explore', 'discover', 'browse', 'search', 'find', 'investigate',
        'overview', 'summary', 'what', 'how', 'why', 'show'
      ],
      analytics: [
        'analyze', 'statistics', 'metrics', 'report', 'dashboard',
        'count', 'sum', 'average', 'trend', 'pattern', 'insight'
      ]
    };
    
    // Query structure patterns
    this.structurePatterns = {
      lineage: {
        predicates: ['prov:wasDerivedFrom', 'prov:wasGeneratedBy', 'prov:used'],
        patterns: ['path_queries', 'recursive_patterns'],
        complexity: 'high'
      },
      compliance: {
        predicates: ['dcterms:created', 'dcterms:modified', 'prov:wasAttributedTo'],
        patterns: ['temporal_constraints', 'agent_tracking'],
        complexity: 'medium'
      },
      analytics: {
        functions: ['COUNT', 'SUM', 'AVG', 'MAX', 'MIN'],
        clauses: ['GROUP BY', 'ORDER BY', 'HAVING'],
        complexity: 'medium'
      },
      exploration: {
        patterns: ['broad_selection', 'optional_patterns', 'union_queries'],
        complexity: 'low'
      }
    };
  }

  async initializeIntentClassifier() {
    // Mock ML model initialization
    // In production, this would load actual classification models
    this.intentClassifier = {
      model: this.options.classificationModel,
      categories: this.options.intentCategories,
      classify: this.mockClassify.bind(this),
      trainOnFeedback: this.trainClassifier.bind(this)
    };
    
    this.logger.debug('Initialized intent classifier');
  }

  async initializeContextAnalyzer() {
    // Initialize context analysis components
    this.contextAnalyzer = {
      analyzeQueryContext: this.analyzeQueryContext.bind(this),
      analyzeSessionContext: this.analyzeSessionContext.bind(this),
      analyzeUserContext: this.analyzeUserContext.bind(this)
    };
    
    this.logger.debug('Initialized context analyzer');
  }

  async initializeSuggestionEngine() {
    // Initialize suggestion generation
    this.suggestionEngine = {
      generateSuggestions: this.generateIntentBasedSuggestions.bind(this),
      rankSuggestions: this.rankSuggestions.bind(this),
      personalizedSuggestions: this.generatePersonalizedSuggestions.bind(this)
    };
    
    this.logger.debug('Initialized suggestion engine');
  }

  async loadDomainKnowledge() {
    // Load domain-specific knowledge for better intent understanding
    this.domainKnowledge.set('provenance', {
      concepts: ['entity', 'activity', 'agent', 'bundle'],
      relationships: ['derivation', 'generation', 'association', 'attribution'],
      useCase: 'tracking data lineage and audit trails'
    });
    
    this.domainKnowledge.set('compliance', {
      concepts: ['policy', 'regulation', 'audit', 'control'],
      relationships: ['compliance', 'violation', 'approval', 'monitoring'],
      useCase: 'regulatory compliance and governance'
    });
    
    this.domainKnowledge.set('analytics', {
      concepts: ['metric', 'measure', 'dimension', 'fact'],
      relationships: ['aggregation', 'calculation', 'comparison', 'trend'],
      useCase: 'business intelligence and reporting'
    });
    
    this.logger.debug('Loaded domain knowledge');
  }

  async loadIntentPatterns() {
    // Load learned intent patterns
    this.intentPatterns.set('lineage_discovery', {
      pattern: /(?:lineage|provenance|origin|source|derived).*(?:of|for)\s+(\w+)/i,
      intent: 'lineage',
      confidence: 0.9,
      suggestion: 'Query the complete lineage chain for the specified entity'
    });
    
    this.intentPatterns.set('compliance_audit', {
      pattern: /(?:audit|compliance|regulation).*(?:check|verify|ensure)/i,
      intent: 'compliance',
      confidence: 0.85,
      suggestion: 'Generate compliance report with audit trail'
    });
    
    this.intentPatterns.set('performance_analysis', {
      pattern: /(?:performance|speed|optimization|benchmark)/i,
      intent: 'performance',
      confidence: 0.8,
      suggestion: 'Analyze query performance and suggest optimizations'
    });
    
    this.logger.debug('Loaded intent patterns');
  }

  /**
   * Analyze query intent from SPARQL query or natural language
   * @param {string} query - SPARQL query or natural language
   * @param {Object} context - Analysis context
   */
  async analyzeIntent(query, context = {}) {
    try {
      this.logger.debug('Analyzing query intent...');
      this.metrics.classificationsPerformed++;
      
      // Extract features for intent analysis
      const features = await this.extractIntentFeatures(query, context);
      
      // Classify intent using multiple approaches
      const intentPredictions = await this.classifyIntent(features, context);
      
      // Analyze context for better understanding
      const contextAnalysis = await this.contextAnalyzer.analyzeQueryContext(query, context);
      
      // Generate suggestions based on intent
      const suggestions = await this.suggestionEngine.generateSuggestions(
        intentPredictions, 
        contextAnalysis, 
        context
      );
      
      // Combine and rank results
      const analysis = this.combineIntentAnalysis(
        intentPredictions, 
        contextAnalysis, 
        suggestions
      );
      
      // Update user behavior profile
      this.updateUserBehaviorProfile(context.userId, analysis);
      
      // Record for learning
      this.recordIntentAnalysis(query, analysis, context);
      
      return analysis;
      
    } catch (error) {
      this.logger.error('Intent analysis failed:', error);
      return {
        category: 'exploration',
        confidence: 0.1,
        suggestions: [],
        error: error.message
      };
    }
  }

  async extractIntentFeatures(query, context) {
    const features = {
      lexical: await this.extractLexicalFeatures(query),
      syntactic: await this.extractSyntacticFeatures(query),
      semantic: await this.extractSemanticFeatures(query, context),
      pragmatic: await this.extractPragmaticFeatures(query, context)
    };
    
    return features;
  }

  async extractLexicalFeatures(query) {
    const features = {
      keywords: this.extractKeywords(query),
      entities: this.extractEntities(query),
      ngrams: this.extractNgrams(query, 2), // Bigrams
      termFrequency: this.calculateTermFrequency(query)
    };
    
    return features;
  }

  extractKeywords(query) {
    const keywords = [];
    const queryLower = query.toLowerCase();
    
    // Check for intent-specific keywords
    for (const [intent, intentKeywords] of Object.entries(this.intentKeywords)) {
      const matchedKeywords = intentKeywords.filter(keyword => 
        queryLower.includes(keyword.toLowerCase())
      );
      
      if (matchedKeywords.length > 0) {
        keywords.push({
          intent,
          keywords: matchedKeywords,
          score: matchedKeywords.length / intentKeywords.length
        });
      }
    }
    
    return keywords;
  }

  extractEntities(query) {
    // Simple entity extraction
    const entities = [];
    
    // Extract URIs
    const uriPattern = /<([^>]+)>/g;
    let match;
    while ((match = uriPattern.exec(query)) !== null) {
      entities.push({
        type: 'uri',
        value: match[1],
        text: match[0]
      });
    }
    
    // Extract prefixed names
    const prefixedPattern = /(\w+):(\w+)/g;
    while ((match = prefixedPattern.exec(query)) !== null) {
      entities.push({
        type: 'prefixed_name',
        prefix: match[1],
        localName: match[2],
        text: match[0]
      });
    }
    
    // Extract variables
    const variablePattern = /\?(\w+)/g;
    while ((match = variablePattern.exec(query)) !== null) {
      entities.push({
        type: 'variable',
        name: match[1],
        text: match[0]
      });
    }
    
    return entities;
  }

  extractNgrams(query, n) {
    const words = query.toLowerCase().split(/\s+/);
    const ngrams = [];
    
    for (let i = 0; i <= words.length - n; i++) {
      ngrams.push(words.slice(i, i + n).join(' '));
    }
    
    return ngrams;
  }

  calculateTermFrequency(query) {
    const words = query.toLowerCase().split(/\s+/);
    const frequency = new Map();
    
    for (const word of words) {
      frequency.set(word, (frequency.get(word) || 0) + 1);
    }
    
    return frequency;
  }

  async extractSyntacticFeatures(query) {
    const features = {
      queryType: this.identifyQueryType(query),
      clauses: this.extractClauses(query),
      patterns: this.identifyQueryPatterns(query),
      complexity: this.calculateQueryComplexity(query)
    };
    
    return features;
  }

  identifyQueryType(query) {
    const queryUpper = query.toUpperCase();
    
    if (queryUpper.includes('SELECT')) return 'SELECT';
    if (queryUpper.includes('CONSTRUCT')) return 'CONSTRUCT';
    if (queryUpper.includes('ASK')) return 'ASK';
    if (queryUpper.includes('DESCRIBE')) return 'DESCRIBE';
    
    return 'UNKNOWN';
  }

  extractClauses(query) {
    const clauses = [];
    const clausePatterns = [
      'WHERE', 'OPTIONAL', 'UNION', 'MINUS', 'FILTER', 
      'GROUP BY', 'ORDER BY', 'LIMIT', 'OFFSET', 'HAVING'
    ];
    
    const queryUpper = query.toUpperCase();
    
    for (const clause of clausePatterns) {
      if (queryUpper.includes(clause)) {
        clauses.push(clause);
      }
    }
    
    return clauses;
  }

  identifyQueryPatterns(query) {
    const patterns = [];
    
    // Check for structural patterns
    if (query.includes('OPTIONAL')) patterns.push('optional_pattern');
    if (query.includes('UNION')) patterns.push('union_pattern');
    if (query.includes('FILTER')) patterns.push('filter_pattern');
    if (query.match(/\{\s*SELECT/)) patterns.push('subquery_pattern');
    if (query.includes('GROUP BY')) patterns.push('aggregation_pattern');
    
    // Check for domain-specific patterns
    if (query.includes('prov:wasDerivedFrom') || query.includes('lineage')) {
      patterns.push('lineage_pattern');
    }
    
    if (query.includes('COUNT') || query.includes('SUM')) {
      patterns.push('analytics_pattern');
    }
    
    return patterns;
  }

  calculateQueryComplexity(query) {
    let complexity = 0;
    
    // Count structural elements
    complexity += (query.match(/\{/g) || []).length; // Subqueries
    complexity += (query.match(/OPTIONAL/gi) || []).length * 0.5;
    complexity += (query.match(/UNION/gi) || []).length * 0.7;
    complexity += (query.match(/FILTER/gi) || []).length * 0.3;
    complexity += (query.match(/\?\w+/g) || []).length * 0.1; // Variables
    
    return complexity;
  }

  async extractSemanticFeatures(query, context) {
    const features = {
      domainConcepts: this.identifyDomainConcepts(query),
      relationships: this.extractRelationships(query),
      semanticRoles: this.identifySemanticRoles(query),
      contextRelevance: this.calculateContextRelevance(query, context)
    };
    
    return features;
  }

  identifyDomainConcepts(query) {
    const concepts = [];
    
    for (const [domain, knowledge] of this.domainKnowledge) {
      const domainConcepts = knowledge.concepts.filter(concept =>
        query.toLowerCase().includes(concept.toLowerCase())
      );
      
      if (domainConcepts.length > 0) {
        concepts.push({
          domain,
          concepts: domainConcepts,
          score: domainConcepts.length / knowledge.concepts.length
        });
      }
    }
    
    return concepts;
  }

  extractRelationships(query) {
    const relationships = [];
    
    // Extract predicates as relationships
    const predicatePattern = /(\w+):(\w+)/g;
    let match;
    
    while ((match = predicatePattern.exec(query)) !== null) {
      relationships.push({
        namespace: match[1],
        predicate: match[2],
        full: match[0]
      });
    }
    
    return relationships;
  }

  identifySemanticRoles(query) {
    const roles = [];
    
    // Identify agent roles
    if (query.includes('prov:wasAssociatedWith') || query.includes('agent')) {
      roles.push('agent_query');
    }
    
    // Identify temporal roles
    if (query.includes('time') || query.includes('date')) {
      roles.push('temporal_query');
    }
    
    // Identify causal roles
    if (query.includes('caused') || query.includes('triggered')) {
      roles.push('causal_query');
    }
    
    return roles;
  }

  calculateContextRelevance(query, context) {
    let relevance = 0.5; // Base relevance
    
    // Check session context
    if (context.sessionType === 'compliance_audit') {
      if (query.includes('audit') || query.includes('compliance')) {
        relevance += 0.3;
      }
    }
    
    // Check user context
    if (context.userRole === 'auditor') {
      if (query.includes('audit') || query.includes('control')) {
        relevance += 0.2;
      }
    }
    
    // Check temporal context
    if (context.timeOfDay === 'business_hours') {
      relevance += 0.1;
    }
    
    return Math.min(1.0, relevance);
  }

  async extractPragmaticFeatures(query, context) {
    const features = {
      userHistory: this.analyzeUserHistory(context.userId),
      sessionContext: this.analyzeCurrentSession(context.sessionId),
      goals: this.inferUserGoals(query, context),
      urgency: this.assessUrgency(query, context)
    };
    
    return features;
  }

  analyzeUserHistory(userId) {
    if (!userId) return { patterns: [], frequency: {} };
    
    const userProfile = this.userBehaviorProfiles.get(userId);
    if (!userProfile) return { patterns: [], frequency: {} };
    
    return {
      patterns: userProfile.commonPatterns || [],
      frequency: userProfile.intentFrequency || {},
      preferences: userProfile.preferences || {}
    };
  }

  analyzeCurrentSession(sessionId) {
    const sessionQueries = this.sessionHistory.filter(h => h.sessionId === sessionId);
    
    const intents = sessionQueries.map(q => q.intent).filter(Boolean);
    const intentCounts = {};
    
    for (const intent of intents) {
      intentCounts[intent] = (intentCounts[intent] || 0) + 1;
    }
    
    return {
      queryCount: sessionQueries.length,
      primaryIntents: intents,
      intentDistribution: intentCounts,
      sessionDuration: sessionQueries.length > 0 ? 
        this.getDeterministicTimestamp() - sessionQueries[0].timestamp : 0
    };
  }

  inferUserGoals(query, context) {
    const goals = [];
    
    // Infer from query patterns
    if (query.includes('lineage') || query.includes('provenance')) {
      goals.push('understand_data_flow');
    }
    
    if (query.includes('compliance') || query.includes('audit')) {
      goals.push('ensure_compliance');
    }
    
    if (query.includes('optimize') || query.includes('performance')) {
      goals.push('improve_performance');
    }
    
    // Infer from context
    if (context.userRole === 'data_scientist') {
      goals.push('data_analysis');
    }
    
    if (context.projectType === 'compliance') {
      goals.push('regulatory_compliance');
    }
    
    return goals;
  }

  assessUrgency(query, context) {
    let urgency = 0.5; // Default medium urgency
    
    // High urgency indicators
    if (query.includes('urgent') || query.includes('immediate')) {
      urgency = 1.0;
    }
    
    if (query.includes('asap') || query.includes('now')) {
      urgency = 0.9;
    }
    
    // Context-based urgency
    if (context.alertLevel === 'high') {
      urgency = Math.max(urgency, 0.8);
    }
    
    if (context.deadline && new Date(context.deadline) - this.getDeterministicTimestamp() < 86400000) {
      urgency = Math.max(urgency, 0.7); // Less than 24 hours
    }
    
    return urgency;
  }

  async classifyIntent(features, context) {
    // Combine multiple classification approaches
    const predictions = [];
    
    // Rule-based classification
    const ruleBasedPrediction = this.classifyIntentRuleBased(features);
    if (ruleBasedPrediction) {
      predictions.push(ruleBasedPrediction);
    }
    
    // Pattern-based classification
    const patternBasedPrediction = this.classifyIntentPatternBased(features);
    if (patternBasedPrediction) {
      predictions.push(patternBasedPrediction);
    }
    
    // ML model classification
    const mlPrediction = await this.intentClassifier.classify(features, context);
    if (mlPrediction) {
      predictions.push(mlPrediction);
    }
    
    // Context-based adjustment
    const contextAdjustedPredictions = this.adjustPredictionsForContext(predictions, context);
    
    // Ensemble and rank predictions
    return this.ensemblePredictions(contextAdjustedPredictions);
  }

  classifyIntentRuleBased(features) {
    const scores = new Map();
    
    // Score based on keywords
    for (const keywordMatch of features.lexical.keywords) {
      const currentScore = scores.get(keywordMatch.intent) || 0;
      scores.set(keywordMatch.intent, currentScore + keywordMatch.score * 0.4);
    }
    
    // Score based on domain concepts
    for (const conceptMatch of features.semantic.domainConcepts) {
      const intent = this.mapDomainToIntent(conceptMatch.domain);
      if (intent) {
        const currentScore = scores.get(intent) || 0;
        scores.set(intent, currentScore + conceptMatch.score * 0.3);
      }
    }
    
    // Score based on query patterns
    for (const pattern of features.syntactic.patterns) {
      const intent = this.mapPatternToIntent(pattern);
      if (intent) {
        const currentScore = scores.get(intent) || 0;
        scores.set(intent, currentScore + 0.2);
      }
    }
    
    // Find best prediction
    let bestIntent = null;
    let bestScore = 0;
    
    for (const [intent, score] of scores) {
      if (score > bestScore) {
        bestIntent = intent;
        bestScore = score;
      }
    }
    
    if (bestIntent && bestScore >= 0.3) {
      return {
        category: bestIntent,
        confidence: Math.min(0.9, bestScore),
        method: 'rule_based',
        scores: Object.fromEntries(scores)
      };
    }
    
    return null;
  }

  classifyIntentPatternBased(features) {
    // Check against learned patterns
    for (const [patternId, pattern] of this.intentPatterns) {
      // This is simplified - in production would use more sophisticated pattern matching
      const queryText = features.original || '';
      
      if (pattern.pattern.test(queryText)) {
        return {
          category: pattern.intent,
          confidence: pattern.confidence,
          method: 'pattern_based',
          matchedPattern: patternId
        };
      }
    }
    
    return null;
  }

  async mockClassify(features, context) {
    // Mock ML classification
    // In production, this would use actual ML models
    
    const intentScores = {};
    
    // Simple scoring based on features
    for (const category of this.options.intentCategories) {
      let score = 0.1; // Base score
      
      // Score based on keyword matches
      const keywordMatches = features.lexical.keywords.filter(k => k.intent === category);
      score += keywordMatches.length * 0.2;
      
      // Score based on complexity for certain intents
      if (category === 'performance' && features.syntactic.complexity > 5) {
        score += 0.3;
      }
      
      if (category === 'lineage' && features.syntactic.patterns.includes('lineage_pattern')) {
        score += 0.4;
      }
      
      intentScores[category] = Math.min(0.95, score);
    }
    
    // Find best prediction
    const sortedIntents = Object.entries(intentScores)
      .sort(([,a], [,b]) => b - a);
    
    const [bestIntent, bestScore] = sortedIntents[0];
    
    return {
      category: bestIntent,
      confidence: bestScore,
      method: 'ml_model',
      allScores: intentScores
    };
  }

  mapDomainToIntent(domain) {
    const mapping = {
      'provenance': 'lineage',
      'compliance': 'compliance',
      'analytics': 'analytics'
    };
    
    return mapping[domain];
  }

  mapPatternToIntent(pattern) {
    const mapping = {
      'lineage_pattern': 'lineage',
      'analytics_pattern': 'analytics',
      'aggregation_pattern': 'analytics',
      'optional_pattern': 'exploration'
    };
    
    return mapping[pattern];
  }

  adjustPredictionsForContext(predictions, context) {
    return predictions.map(prediction => {
      let adjustedConfidence = prediction.confidence;
      
      // Adjust based on user history
      const userHistory = this.analyzeUserHistory(context.userId);
      if (userHistory.frequency[prediction.category]) {
        adjustedConfidence += userHistory.frequency[prediction.category] * 0.1;
      }
      
      // Adjust based on session context
      if (context.sessionType === prediction.category) {
        adjustedConfidence += 0.15;
      }
      
      // Adjust based on time context
      if (prediction.category === 'compliance' && this.isComplianceReportingTime()) {
        adjustedConfidence += 0.1;
      }
      
      return {
        ...prediction,
        confidence: Math.min(0.95, adjustedConfidence),
        contextAdjusted: true
      };
    });
  }

  ensemblePredictions(predictions) {
    if (predictions.length === 0) {
      return {
        category: 'exploration',
        confidence: 0.1,
        method: 'default'
      };
    }
    
    if (predictions.length === 1) {
      return predictions[0];
    }
    
    // Weighted ensemble
    const weights = {
      'pattern_based': 0.4,
      'rule_based': 0.35,
      'ml_model': 0.25
    };
    
    const ensembleScores = new Map();
    
    for (const prediction of predictions) {
      const weight = weights[prediction.method] || 0.2;
      const weightedScore = prediction.confidence * weight;
      
      const currentScore = ensembleScores.get(prediction.category) || 0;
      ensembleScores.set(prediction.category, currentScore + weightedScore);
    }
    
    // Find best ensemble prediction
    let bestCategory = null;
    let bestScore = 0;
    
    for (const [category, score] of ensembleScores) {
      if (score > bestScore) {
        bestCategory = category;
        bestScore = score;
      }
    }
    
    return {
      category: bestCategory,
      confidence: Math.min(0.95, bestScore),
      method: 'ensemble',
      individualPredictions: predictions,
      ensembleScores: Object.fromEntries(ensembleScores)
    };
  }

  async analyzeQueryContext(query, context) {
    return {
      queryComplexity: this.calculateQueryComplexity(query),
      domainRelevance: this.assessDomainRelevance(query),
      temporalAspects: this.analyzeTemporalAspects(query),
      dataScope: this.assessDataScope(query),
      userContext: this.assessUserContext(context)
    };
  }

  async analyzeSessionContext(context) {
    const sessionId = context.sessionId;
    const sessionData = this.sessionHistory.filter(h => h.sessionId === sessionId);
    
    return {
      sessionLength: sessionData.length,
      intentProgression: this.analyzeIntentProgression(sessionData),
      queryComplexityTrend: this.analyzeComplexityTrend(sessionData),
      userEngagement: this.assessUserEngagement(sessionData)
    };
  }

  async analyzeUserContext(context) {
    const userId = context.userId;
    const userProfile = this.userBehaviorProfiles.get(userId);
    
    return {
      experienceLevel: userProfile?.experienceLevel || 'intermediate',
      preferredIntents: userProfile?.preferredIntents || [],
      queryStyle: userProfile?.queryStyle || 'mixed',
      learningPattern: userProfile?.learningPattern || 'exploratory'
    };
  }

  async generateIntentBasedSuggestions(intentPredictions, contextAnalysis, context) {
    const suggestions = [];
    
    const primaryIntent = intentPredictions.category;
    const confidence = intentPredictions.confidence;
    
    if (confidence >= this.options.confidenceThreshold) {
      // Generate high-confidence suggestions
      const intentSuggestions = await this.generateSuggestionsForIntent(
        primaryIntent, 
        contextAnalysis, 
        context
      );
      suggestions.push(...intentSuggestions);
    }
    
    // Generate general suggestions
    const generalSuggestions = await this.generateGeneralSuggestions(
      contextAnalysis, 
      context
    );
    suggestions.push(...generalSuggestions);
    
    return this.rankSuggestions(suggestions, intentPredictions, context);
  }

  async generateSuggestionsForIntent(intent, contextAnalysis, context) {
    const suggestions = [];
    
    switch (intent) {
      case 'lineage':
        suggestions.push({
          type: 'query_enhancement',
          description: 'Add temporal constraints to lineage query',
          action: 'add_temporal_filter',
          confidence: 0.8
        });
        suggestions.push({
          type: 'optimization',
          description: 'Optimize lineage query with path constraints',
          action: 'optimize_path_query',
          confidence: 0.7
        });
        break;
        
      case 'compliance':
        suggestions.push({
          type: 'template',
          description: 'Use compliance report template',
          action: 'apply_compliance_template',
          confidence: 0.9
        });
        suggestions.push({
          type: 'validation',
          description: 'Add data quality checks',
          action: 'add_quality_checks',
          confidence: 0.75
        });
        break;
        
      case 'analytics':
        suggestions.push({
          type: 'aggregation',
          description: 'Add GROUP BY for better analytics',
          action: 'add_grouping',
          confidence: 0.8
        });
        suggestions.push({
          type: 'visualization',
          description: 'Generate charts from query results',
          action: 'create_visualization',
          confidence: 0.6
        });
        break;
        
      case 'exploration':
        suggestions.push({
          type: 'discovery',
          description: 'Explore related entities',
          action: 'expand_exploration',
          confidence: 0.7
        });
        suggestions.push({
          type: 'sampling',
          description: 'Add LIMIT for faster exploration',
          action: 'add_limit',
          confidence: 0.8
        });
        break;
    }
    
    return suggestions;
  }

  async generateGeneralSuggestions(contextAnalysis, context) {
    const suggestions = [];
    
    // Performance suggestions
    if (contextAnalysis.queryComplexity > 10) {
      suggestions.push({
        type: 'performance',
        description: 'Consider query optimization for better performance',
        action: 'optimize_query',
        confidence: 0.6
      });
    }
    
    // Data scope suggestions
    if (contextAnalysis.dataScope === 'very_large') {
      suggestions.push({
        type: 'scope',
        description: 'Add filters to reduce data scope',
        action: 'add_filters',
        confidence: 0.7
      });
    }
    
    // User experience suggestions
    if (context.userExperience === 'beginner') {
      suggestions.push({
        type: 'learning',
        description: 'View query explanation and examples',
        action: 'show_explanation',
        confidence: 0.8
      });
    }
    
    return suggestions;
  }

  rankSuggestions(suggestions, intentPredictions, context) {
    return suggestions
      .map(suggestion => ({
        ...suggestion,
        finalScore: this.calculateSuggestionScore(suggestion, intentPredictions, context)
      }))
      .sort((a, b) => b.finalScore - a.finalScore)
      .slice(0, this.options.maxSuggestions);
  }

  calculateSuggestionScore(suggestion, intentPredictions, context) {
    let score = suggestion.confidence || 0.5;
    
    // Boost score for high-confidence intent matches
    if (intentPredictions.confidence > 0.8) {
      score += 0.2;
    }
    
    // Boost score for user preferences
    const userProfile = this.userBehaviorProfiles.get(context.userId);
    if (userProfile?.preferredSuggestionTypes?.includes(suggestion.type)) {
      score += 0.15;
    }
    
    // Boost score for contextually relevant suggestions
    if (suggestion.type === 'performance' && context.performanceIssues) {
      score += 0.25;
    }
    
    return Math.min(1.0, score);
  }

  combineIntentAnalysis(intentPredictions, contextAnalysis, suggestions) {
    return {
      category: intentPredictions.category,
      confidence: intentPredictions.confidence,
      method: intentPredictions.method,
      context: contextAnalysis,
      suggestions: suggestions,
      timestamp: this.getDeterministicTimestamp(),
      metadata: {
        features: intentPredictions.features,
        ensemble: intentPredictions.ensembleScores,
        contextAdjusted: intentPredictions.contextAdjusted
      }
    };
  }

  updateUserBehaviorProfile(userId, analysis) {
    if (!userId) return;
    
    let profile = this.userBehaviorProfiles.get(userId) || {
      intentFrequency: {},
      preferredIntents: [],
      queryPatterns: [],
      experienceLevel: 'intermediate',
      preferences: {}
    };
    
    // Update intent frequency
    const intent = analysis.category;
    profile.intentFrequency[intent] = (profile.intentFrequency[intent] || 0) + 1;
    
    // Update preferred intents
    const totalQueries = Object.values(profile.intentFrequency).reduce((sum, freq) => sum + freq, 0);
    profile.preferredIntents = Object.entries(profile.intentFrequency)
      .filter(([, freq]) => freq / totalQueries > 0.2)
      .map(([intent]) => intent);
    
    // Update experience level based on query complexity
    const avgComplexity = analysis.context?.queryComplexity || 0;
    if (avgComplexity > 15) {
      profile.experienceLevel = 'advanced';
    } else if (avgComplexity < 5) {
      profile.experienceLevel = 'beginner';
    }
    
    this.userBehaviorProfiles.set(userId, profile);
  }

  recordIntentAnalysis(query, analysis, context) {
    this.sessionHistory.push({
      query,
      intent: analysis.category,
      confidence: analysis.confidence,
      suggestions: analysis.suggestions.length,
      sessionId: context.sessionId,
      userId: context.userId,
      timestamp: this.getDeterministicTimestamp()
    });
    
    // Trim session history
    if (this.sessionHistory.length > 1000) {
      this.sessionHistory = this.sessionHistory.slice(-500);
    }
  }

  async updateFromFeedback(queryId, feedbackData) {
    this.feedbackHistory.push({
      queryId,
      feedback: feedbackData,
      timestamp: this.getDeterministicTimestamp()
    });
    
    this.metrics.feedbackReceived++;
    
    // Update accuracy metrics
    if (feedbackData.intentCorrect) {
      this.metrics.correctPredictions++;
    }
    
    this.metrics.accuracy = this.metrics.correctPredictions / this.metrics.classificationsPerformed;
    
    // Train classifier with feedback
    await this.trainClassifier(feedbackData);
    
    this.logger.debug(`Updated from feedback for query ${queryId}`);
  }

  async trainClassifier(feedbackData) {
    // Update ML models with feedback
    // This is a simplified implementation
    if (feedbackData.correctIntent && feedbackData.features) {
      // In production, this would retrain the actual ML models
      this.logger.debug('Training classifier with feedback');
    }
  }

  // Utility methods
  
  assessDomainRelevance(query) {
    let relevance = 0;
    for (const [domain, knowledge] of this.domainKnowledge) {
      const concepts = knowledge.concepts.filter(concept =>
        query.toLowerCase().includes(concept.toLowerCase())
      );
      relevance += concepts.length / knowledge.concepts.length;
    }
    return Math.min(1.0, relevance);
  }

  analyzeTemporalAspects(query) {
    const temporal = {
      hasTimeConstraints: query.includes('time') || query.includes('date'),
      isRecent: query.includes('recent') || query.includes('latest'),
      isHistorical: query.includes('history') || query.includes('past'),
      timeRange: this.extractTimeRange(query)
    };
    return temporal;
  }

  extractTimeRange(query) {
    // Simple time range extraction
    const patterns = [
      /(\d{4})-(\d{2})-(\d{2})/g, // Date patterns
      /last\s+(\d+)\s+(day|week|month|year)s?/gi,
      /past\s+(\d+)\s+(day|week|month|year)s?/gi
    ];
    
    for (const pattern of patterns) {
      const match = pattern.exec(query);
      if (match) {
        return match[0];
      }
    }
    
    return null;
  }

  assessDataScope(query) {
    if (query.includes('LIMIT')) {
      const limitMatch = query.match(/LIMIT\s+(\d+)/i);
      if (limitMatch) {
        const limit = parseInt(limitMatch[1]);
        if (limit < 100) return 'small';
        if (limit < 1000) return 'medium';
        return 'large';
      }
    }
    
    // No limit specified
    if (query.includes('SELECT *') && !query.includes('FILTER')) {
      return 'very_large';
    }
    
    return 'medium';
  }

  assessUserContext(context) {
    return {
      role: context.userRole || 'user',
      experience: context.userExperience || 'intermediate',
      department: context.department || 'unknown',
      accessLevel: context.accessLevel || 'standard'
    };
  }

  analyzeIntentProgression(sessionData) {
    const intents = sessionData.map(d => d.intent);
    return {
      sequence: intents,
      transitions: this.calculateIntentTransitions(intents),
      focusedIntent: this.getMostFrequentIntent(intents)
    };
  }

  calculateIntentTransitions(intents) {
    const transitions = {};
    for (let i = 0; i < intents.length - 1; i++) {
      const from = intents[i];
      const to = intents[i + 1];
      const key = `${from}->${to}`;
      transitions[key] = (transitions[key] || 0) + 1;
    }
    return transitions;
  }

  getMostFrequentIntent(intents) {
    const frequency = {};
    for (const intent of intents) {
      frequency[intent] = (frequency[intent] || 0) + 1;
    }
    
    return Object.entries(frequency)
      .sort(([,a], [,b]) => b - a)[0]?.[0];
  }

  analyzeComplexityTrend(sessionData) {
    const complexities = sessionData
      .map(d => d.queryComplexity || 0)
      .filter(c => c > 0);
    
    if (complexities.length < 2) return 'stable';
    
    const trend = complexities[complexities.length - 1] - complexities[0];
    if (trend > 2) return 'increasing';
    if (trend < -2) return 'decreasing';
    return 'stable';
  }

  assessUserEngagement(sessionData) {
    const avgTimeBetweenQueries = this.calculateAvgTimeBetweenQueries(sessionData);
    
    if (avgTimeBetweenQueries < 30000) return 'high'; // Less than 30 seconds
    if (avgTimeBetweenQueries < 120000) return 'medium'; // Less than 2 minutes
    return 'low';
  }

  calculateAvgTimeBetweenQueries(sessionData) {
    if (sessionData.length < 2) return 0;
    
    const intervals = [];
    for (let i = 1; i < sessionData.length; i++) {
      intervals.push(sessionData[i].timestamp - sessionData[i-1].timestamp);
    }
    
    return intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
  }

  isComplianceReportingTime() {
    // Check if it's a typical compliance reporting time
    const now = this.getDeterministicDate();
    const month = now.getMonth();
    const dayOfMonth = now.getDate();
    
    // End of quarter
    if ([2, 5, 8, 11].includes(month) && dayOfMonth > 25) {
      return true;
    }
    
    // End of year
    if (month === 11 && dayOfMonth > 20) {
      return true;
    }
    
    return false;
  }

  async generatePersonalizedSuggestions(userId, context) {
    const userProfile = this.userBehaviorProfiles.get(userId);
    if (!userProfile) return [];
    
    const suggestions = [];
    
    // Suggest based on user's frequent intents
    for (const intent of userProfile.preferredIntents) {
      suggestions.push({
        type: 'personalized',
        description: `Continue with ${intent} analysis based on your history`,
        action: `suggest_${intent}_query`,
        confidence: 0.7
      });
    }
    
    return suggestions;
  }

  /**
   * Get intent analyzer statistics
   */
  getStatistics() {
    return {
      ...this.metrics,
      accuracy: this.metrics.classificationsPerformed > 0 ? 
        this.metrics.correctPredictions / this.metrics.classificationsPerformed : 0,
      userProfiles: this.userBehaviorProfiles.size,
      sessionHistory: this.sessionHistory.length,
      feedbackHistory: this.feedbackHistory.length,
      intentPatterns: this.intentPatterns.size,
      domainKnowledge: this.domainKnowledge.size
    };
  }

  /**
   * Clear all data
   */
  clear() {
    this.userBehaviorProfiles.clear();
    this.sessionHistory = [];
    this.feedbackHistory = [];
    
    // Reset metrics
    Object.keys(this.metrics).forEach(key => {
      if (typeof this.metrics[key] === 'number') {
        this.metrics[key] = 0;
      }
    });
    
    this.logger.info('Intent analyzer cleared');
  }
}

export default QueryIntentAnalyzer;