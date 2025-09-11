/**
 * Query Similarity Detector - Vector-based SPARQL Query Similarity Detection
 * 
 * Uses advanced embedding techniques and graph-based similarity to identify
 * semantically similar queries for result sharing and optimization insights.
 */

import consola from 'consola';

export class QuerySimilarityDetector {
  constructor(options = {}) {
    this.options = {
      embeddingModel: options.embeddingModel || 'sentence-transformers/all-MiniLM-L6-v2',
      similarityThreshold: options.similarityThreshold || 0.8,
      vectorDimensions: options.vectorDimensions || 384,
      maxCachedEmbeddings: options.maxCachedEmbeddings || 10000,
      graphSimilarityWeight: options.graphSimilarityWeight || 0.4,
      semanticSimilarityWeight: options.semanticSimilarityWeight || 0.6,
      ...options
    };
    
    this.logger = consola.withTag('query-similarity');
    
    // Embedding storage and caching
    this.queryEmbeddings = new Map();
    this.embeddingCache = new Map();
    this.vectorIndex = null;
    
    // Query structure analysis
    this.structuralPatterns = new Map();
    this.graphPatterns = new Map();
    this.predicateEmbeddings = new Map();
    
    // Similarity computation
    this.similarityMatrix = new Map();
    this.clusterAssignments = new Map();
    this.clusters = new Map();
    
    // Performance tracking
    this.metrics = {
      embeddingsGenerated: 0,
      similaritiesComputed: 0,
      cacheHits: 0,
      cacheMisses: 0,
      clusterUpdates: 0
    };
    
    this.initializeComponents();
  }

  async initialize() {
    try {
      this.logger.info('Initializing query similarity detector...');
      
      // Initialize embedding model (mock implementation)
      await this.initializeEmbeddingModel();
      
      // Initialize vector index for fast similarity search
      await this.initializeVectorIndex();
      
      // Load pre-computed embeddings if available
      await this.loadPrecomputedEmbeddings();
      
      this.logger.success('Query similarity detector initialized');
      
    } catch (error) {
      this.logger.error('Failed to initialize similarity detector:', error);
      throw error;
    }
  }

  initializeComponents() {
    // SPARQL structural elements for analysis
    this.sparqlElements = {
      queryTypes: ['SELECT', 'CONSTRUCT', 'ASK', 'DESCRIBE'],
      clauses: ['WHERE', 'OPTIONAL', 'UNION', 'MINUS', 'FILTER', 'GROUP BY', 'ORDER BY', 'LIMIT'],
      operators: ['DISTINCT', 'REDUCED'],
      functions: ['COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'SAMPLE', 'GROUP_CONCAT'],
      builtins: ['BOUND', 'IF', 'COALESCE', 'EXISTS', 'NOT EXISTS', 'IN', 'NOT IN']
    };
    
    // Predicate importance weights
    this.predicateWeights = new Map([
      ['rdf:type', 0.9],
      ['rdfs:label', 0.7],
      ['prov:wasDerivedFrom', 0.8],
      ['prov:wasGeneratedBy', 0.8],
      ['prov:wasAssociatedWith', 0.7],
      ['foaf:name', 0.6],
      ['dcterms:created', 0.5],
      ['dcterms:modified', 0.5]
    ]);
  }

  async initializeEmbeddingModel() {
    // Mock embedding model initialization
    // In production, this would load actual transformer models
    this.embeddingModel = {
      name: this.options.embeddingModel,
      dimensions: this.options.vectorDimensions,
      initialized: true,
      encode: this.mockEncode.bind(this)
    };
    
    this.logger.debug(`Initialized embedding model: ${this.options.embeddingModel}`);
  }

  async initializeVectorIndex() {
    // Initialize vector index for fast similarity search
    // In production, this could use libraries like FAISS or Annoy
    this.vectorIndex = {
      vectors: [],
      queryIds: [],
      index: new Map(),
      add: this.addToIndex.bind(this),
      search: this.searchIndex.bind(this)
    };
    
    this.logger.debug('Initialized vector index');
  }

  async loadPrecomputedEmbeddings() {
    // Load pre-computed embeddings from storage
    // This would load from a persistent store in production
    this.logger.debug('Loading pre-computed embeddings...');
  }

  mockEncode(text) {
    // Mock embedding generation
    // In production, use actual transformer model
    const dimensions = this.options.vectorDimensions;
    const embedding = new Array(dimensions);
    
    // Generate pseudo-random but deterministic embedding based on text
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = ((hash << 5) - hash + text.charCodeAt(i)) & 0xffffffff;
    }
    
    for (let i = 0; i < dimensions; i++) {
      hash = ((hash * 1664525 + 1013904223) & 0xffffffff);
      embedding[i] = (hash / 0xffffffff - 0.5) * 2; // Normalize to [-1, 1]
    }
    
    return embedding;
  }

  /**
   * Find similar queries to the given query
   * @param {string} query - SPARQL query to find similarities for
   * @param {Object} options - Search options
   */
  async findSimilar(query, options = {}) {
    try {
      const threshold = options.threshold || this.options.similarityThreshold;
      const maxResults = options.maxResults || 10;
      
      this.logger.debug('Finding similar queries...');
      
      // Generate or retrieve embedding for target query
      const queryEmbedding = await this.getQueryEmbedding(query);
      
      // Extract structural features
      const queryStructure = this.analyzeQueryStructure(query);
      
      // Find similar queries using multiple approaches
      const candidates = await this.findSimilarityExplore(queryEmbedding, queryStructure, threshold);
      
      // Rank and filter results
      const similarQueries = await this.rankSimilarQueries(query, candidates, options);
      
      return similarQueries.slice(0, maxResults);
      
    } catch (error) {
      this.logger.error('Failed to find similar queries:', error);
      return [];
    }
  }

  async getQueryEmbedding(query) {
    // Check cache first
    const queryHash = this.hashQuery(query);
    const cached = this.embeddingCache.get(queryHash);
    
    if (cached) {
      this.metrics.cacheHits++;
      return cached;
    }
    
    this.metrics.cacheMisses++;
    
    // Normalize query for embedding
    const normalizedQuery = this.normalizeQuery(query);
    
    // Generate embedding
    const embedding = await this.embeddingModel.encode(normalizedQuery);
    
    // Cache the embedding
    this.embeddingCache.set(queryHash, embedding);
    this.queryEmbeddings.set(queryHash, {
      query,
      embedding,
      structure: this.analyzeQueryStructure(query),
      timestamp: Date.now()
    });
    
    // Add to vector index
    this.vectorIndex.add(embedding, queryHash);
    
    this.metrics.embeddingsGenerated++;
    
    // Trim cache if too large
    if (this.embeddingCache.size > this.options.maxCachedEmbeddings) {
      this.trimEmbeddingCache();
    }
    
    return embedding;
  }

  normalizeQuery(query) {
    // Normalize query for consistent embedding
    return query
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/\?[a-zA-Z_][a-zA-Z0-9_]*/g, '?VAR') // Normalize variables
      .replace(/<[^>]+>/g, '<URI>') // Normalize URIs
      .replace(/"[^"]*"/g, '"LITERAL"') // Normalize literals
      .toLowerCase()
      .trim();
  }

  analyzeQueryStructure(query) {
    const structure = {
      type: this.extractQueryType(query),
      variables: this.extractVariables(query),
      triplePatterns: this.extractTriplePatterns(query),
      filters: this.extractFilters(query),
      clauses: this.extractClauses(query),
      functions: this.extractFunctions(query),
      graph: this.buildQueryGraph(query),
      complexity: this.calculateComplexity(query)
    };
    
    return structure;
  }

  extractQueryType(query) {
    for (const type of this.sparqlElements.queryTypes) {
      if (query.toUpperCase().includes(type)) {
        return type;
      }
    }
    return 'UNKNOWN';
  }

  extractVariables(query) {
    const variables = [...new Set((query.match(/\?\w+/g) || []))];
    return variables.map(v => v.toLowerCase());
  }

  extractTriplePatterns(query) {
    // Extract triple patterns with predicate analysis
    const patterns = [];
    const tripleRegex = /(\?\w+|<[^>]+>)\s+([^.\s]+)\s+(\?\w+|<[^>]+>|"[^"]*")/g;
    let match;
    
    while ((match = tripleRegex.exec(query)) !== null) {
      patterns.push({
        subject: this.normalizeRDFNode(match[1]),
        predicate: this.normalizeRDFNode(match[2]),
        object: this.normalizeRDFNode(match[3]),
        weight: this.getPredicateWeight(match[2])
      });
    }
    
    return patterns;
  }

  extractFilters(query) {
    const filters = [];
    const filterRegex = /FILTER\s*\(([^)]+)\)/gi;
    let match;
    
    while ((match = filterRegex.exec(query)) !== null) {
      filters.push({
        expression: match[1],
        type: this.classifyFilterType(match[1]),
        variables: this.extractVariablesFromFilter(match[1])
      });
    }
    
    return filters;
  }

  extractClauses(query) {
    const clauses = [];
    
    for (const clause of this.sparqlElements.clauses) {
      if (query.toUpperCase().includes(clause)) {
        clauses.push(clause);
      }
    }
    
    return clauses;
  }

  extractFunctions(query) {
    const functions = [];
    
    for (const func of this.sparqlElements.functions) {
      const regex = new RegExp(`\\b${func}\\s*\\(`, 'gi');
      if (regex.test(query)) {
        functions.push(func);
      }
    }
    
    return functions;
  }

  buildQueryGraph(query) {
    // Build a graph representation of the query
    const graph = {
      nodes: new Set(),
      edges: [],
      clusters: []
    };
    
    const triplePatterns = this.extractTriplePatterns(query);
    
    // Add nodes and edges from triple patterns
    for (const pattern of triplePatterns) {
      graph.nodes.add(pattern.subject);
      graph.nodes.add(pattern.object);
      
      graph.edges.push({
        from: pattern.subject,
        to: pattern.object,
        label: pattern.predicate,
        weight: pattern.weight
      });
    }
    
    // Identify clusters (connected components)
    graph.clusters = this.findConnectedComponents(graph);
    
    return graph;
  }

  findConnectedComponents(graph) {
    const visited = new Set();
    const clusters = [];
    
    for (const node of graph.nodes) {
      if (!visited.has(node)) {
        const cluster = this.dfsTraversal(node, graph, visited);
        clusters.push(cluster);
      }
    }
    
    return clusters;
  }

  dfsTraversal(startNode, graph, visited) {
    const cluster = new Set();
    const stack = [startNode];
    
    while (stack.length > 0) {
      const node = stack.pop();
      if (!visited.has(node)) {
        visited.add(node);
        cluster.add(node);
        
        // Find connected nodes
        for (const edge of graph.edges) {
          if (edge.from === node && !visited.has(edge.to)) {
            stack.push(edge.to);
          }
          if (edge.to === node && !visited.has(edge.from)) {
            stack.push(edge.from);
          }
        }
      }
    }
    
    return cluster;
  }

  calculateComplexity(query) {
    const structure = {
      tripleCount: (query.match(/\?\w+[^.]*\./g) || []).length,
      optionalCount: (query.match(/OPTIONAL/gi) || []).length,
      unionCount: (query.match(/UNION/gi) || []).length,
      filterCount: (query.match(/FILTER/gi) || []).length,
      subqueryCount: (query.match(/\{\s*SELECT/gi) || []).length
    };
    
    return (
      structure.tripleCount * 1 +
      structure.optionalCount * 2 +
      structure.unionCount * 1.5 +
      structure.filterCount * 0.5 +
      structure.subqueryCount * 3
    );
  }

  normalizeRDFNode(node) {
    if (node.startsWith('?')) return '?VAR';
    if (node.startsWith('<') && node.endsWith('>')) return '<URI>';
    if (node.startsWith('"') && node.endsWith('"')) return '"LITERAL"';
    return node.toLowerCase();
  }

  getPredicateWeight(predicate) {
    return this.predicateWeights.get(predicate) || 0.5;
  }

  classifyFilterType(expression) {
    if (expression.includes('=')) return 'equality';
    if (expression.includes('>') || expression.includes('<')) return 'comparison';
    if (expression.includes('regex')) return 'regex';
    if (expression.includes('bound')) return 'bound';
    if (expression.includes('exists')) return 'exists';
    return 'other';
  }

  extractVariablesFromFilter(expression) {
    return [...new Set((expression.match(/\?\w+/g) || []))];
  }

  async findSimilarityExplore(queryEmbedding, queryStructure, threshold) {
    const candidates = [];
    
    // Vector similarity search
    const vectorCandidates = await this.vectorIndex.search(queryEmbedding, threshold);
    candidates.push(...vectorCandidates.map(c => ({ ...c, source: 'vector' })));
    
    // Structural similarity search
    const structuralCandidates = await this.findStructurallySimilar(queryStructure);
    candidates.push(...structuralCandidates.map(c => ({ ...c, source: 'structural' })));
    
    // Graph-based similarity
    const graphCandidates = await this.findGraphSimilar(queryStructure.graph);
    candidates.push(...graphCandidates.map(c => ({ ...c, source: 'graph' })));
    
    // Remove duplicates and combine scores
    return this.combineCandidates(candidates);
  }

  async findStructurallySimilar(queryStructure) {
    const candidates = [];
    
    for (const [queryHash, data] of this.queryEmbeddings) {
      const similarity = this.calculateStructuralSimilarity(queryStructure, data.structure);
      
      if (similarity >= this.options.similarityThreshold) {
        candidates.push({
          queryHash,
          query: data.query,
          similarity,
          type: 'structural'
        });
      }
    }
    
    return candidates;
  }

  calculateStructuralSimilarity(structure1, structure2) {
    let similarity = 0;
    let weights = 0;
    
    // Query type similarity
    if (structure1.type === structure2.type) {
      similarity += 0.2;
    }
    weights += 0.2;
    
    // Clause similarity
    const clauseSimilarity = this.calculateSetSimilarity(structure1.clauses, structure2.clauses);
    similarity += clauseSimilarity * 0.15;
    weights += 0.15;
    
    // Function similarity
    const functionSimilarity = this.calculateSetSimilarity(structure1.functions, structure2.functions);
    similarity += functionSimilarity * 0.1;
    weights += 0.1;
    
    // Triple pattern similarity
    const patternSimilarity = this.calculatePatternSimilarity(structure1.triplePatterns, structure2.triplePatterns);
    similarity += patternSimilarity * 0.3;
    weights += 0.3;
    
    // Filter similarity
    const filterSimilarity = this.calculateFilterSimilarity(structure1.filters, structure2.filters);
    similarity += filterSimilarity * 0.15;
    weights += 0.15;
    
    // Complexity similarity
    const complexityDiff = Math.abs(structure1.complexity - structure2.complexity);
    const complexitySimilarity = Math.max(0, 1 - complexityDiff / Math.max(structure1.complexity, structure2.complexity, 1));
    similarity += complexitySimilarity * 0.1;
    weights += 0.1;
    
    return weights > 0 ? similarity / weights : 0;
  }

  calculateSetSimilarity(set1, set2) {
    const intersection = set1.filter(item => set2.includes(item));
    const union = [...new Set([...set1, ...set2])];
    return union.length > 0 ? intersection.length / union.length : 0;
  }

  calculatePatternSimilarity(patterns1, patterns2) {
    if (patterns1.length === 0 && patterns2.length === 0) return 1;
    if (patterns1.length === 0 || patterns2.length === 0) return 0;
    
    let totalSimilarity = 0;
    let matches = 0;
    
    for (const pattern1 of patterns1) {
      let bestMatch = 0;
      
      for (const pattern2 of patterns2) {
        const patternSim = this.calculateSinglePatternSimilarity(pattern1, pattern2);
        bestMatch = Math.max(bestMatch, patternSim);
      }
      
      totalSimilarity += bestMatch;
      matches++;
    }
    
    return matches > 0 ? totalSimilarity / matches : 0;
  }

  calculateSinglePatternSimilarity(pattern1, pattern2) {
    let similarity = 0;
    
    // Subject similarity
    if (pattern1.subject === pattern2.subject) similarity += 0.33;
    
    // Predicate similarity (weighted higher)
    if (pattern1.predicate === pattern2.predicate) {
      similarity += 0.4 * Math.max(pattern1.weight, pattern2.weight);
    }
    
    // Object similarity
    if (pattern1.object === pattern2.object) similarity += 0.27;
    
    return similarity;
  }

  calculateFilterSimilarity(filters1, filters2) {
    if (filters1.length === 0 && filters2.length === 0) return 1;
    if (filters1.length === 0 || filters2.length === 0) return 0;
    
    let totalSimilarity = 0;
    let matches = 0;
    
    for (const filter1 of filters1) {
      let bestMatch = 0;
      
      for (const filter2 of filters2) {
        const filterSim = this.calculateSingleFilterSimilarity(filter1, filter2);
        bestMatch = Math.max(bestMatch, filterSim);
      }
      
      totalSimilarity += bestMatch;
      matches++;
    }
    
    return matches > 0 ? totalSimilarity / matches : 0;
  }

  calculateSingleFilterSimilarity(filter1, filter2) {
    let similarity = 0;
    
    // Type similarity
    if (filter1.type === filter2.type) similarity += 0.5;
    
    // Variable overlap
    const varSimilarity = this.calculateSetSimilarity(filter1.variables, filter2.variables);
    similarity += varSimilarity * 0.3;
    
    // Expression similarity (simplified)
    const exprSimilarity = this.calculateStringSimilarity(filter1.expression, filter2.expression);
    similarity += exprSimilarity * 0.2;
    
    return similarity;
  }

  calculateStringSimilarity(str1, str2) {
    // Simple Jaccard similarity for strings
    const words1 = new Set(str1.toLowerCase().split(/\W+/));
    const words2 = new Set(str2.toLowerCase().split(/\W+/));
    
    const intersection = new Set([...words1].filter(w => words2.has(w)));
    const union = new Set([...words1, ...words2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  async findGraphSimilar(queryGraph) {
    const candidates = [];
    
    for (const [queryHash, data] of this.queryEmbeddings) {
      const similarity = this.calculateGraphSimilarity(queryGraph, data.structure.graph);
      
      if (similarity >= this.options.similarityThreshold) {
        candidates.push({
          queryHash,
          query: data.query,
          similarity,
          type: 'graph'
        });
      }
    }
    
    return candidates;
  }

  calculateGraphSimilarity(graph1, graph2) {
    // Node similarity
    const nodeSimilarity = this.calculateSetSimilarity(
      Array.from(graph1.nodes),
      Array.from(graph2.nodes)
    );
    
    // Edge similarity
    const edgeSimilarity = this.calculateEdgeSimilarity(graph1.edges, graph2.edges);
    
    // Cluster similarity
    const clusterSimilarity = this.calculateClusterSimilarity(graph1.clusters, graph2.clusters);
    
    return (nodeSimilarity * 0.3 + edgeSimilarity * 0.5 + clusterSimilarity * 0.2);
  }

  calculateEdgeSimilarity(edges1, edges2) {
    if (edges1.length === 0 && edges2.length === 0) return 1;
    if (edges1.length === 0 || edges2.length === 0) return 0;
    
    let totalSimilarity = 0;
    let matches = 0;
    
    for (const edge1 of edges1) {
      let bestMatch = 0;
      
      for (const edge2 of edges2) {
        const edgeSim = this.calculateSingleEdgeSimilarity(edge1, edge2);
        bestMatch = Math.max(bestMatch, edgeSim);
      }
      
      totalSimilarity += bestMatch;
      matches++;
    }
    
    return matches > 0 ? totalSimilarity / matches : 0;
  }

  calculateSingleEdgeSimilarity(edge1, edge2) {
    let similarity = 0;
    
    if (edge1.from === edge2.from) similarity += 0.33;
    if (edge1.to === edge2.to) similarity += 0.33;
    if (edge1.label === edge2.label) {
      similarity += 0.34 * Math.max(edge1.weight, edge2.weight);
    }
    
    return similarity;
  }

  calculateClusterSimilarity(clusters1, clusters2) {
    if (clusters1.length === 0 && clusters2.length === 0) return 1;
    if (clusters1.length === 0 || clusters2.length === 0) return 0;
    
    let totalSimilarity = 0;
    let matches = 0;
    
    for (const cluster1 of clusters1) {
      let bestMatch = 0;
      
      for (const cluster2 of clusters2) {
        const clusterSim = this.calculateSetSimilarity(
          Array.from(cluster1),
          Array.from(cluster2)
        );
        bestMatch = Math.max(bestMatch, clusterSim);
      }
      
      totalSimilarity += bestMatch;
      matches++;
    }
    
    return matches > 0 ? totalSimilarity / matches : 0;
  }

  combineCandidates(candidates) {
    const combined = new Map();
    
    for (const candidate of candidates) {
      const existing = combined.get(candidate.queryHash);
      
      if (existing) {
        // Combine scores from different sources
        const vectorScore = candidate.source === 'vector' ? candidate.similarity : existing.vectorScore || 0;
        const structuralScore = candidate.source === 'structural' ? candidate.similarity : existing.structuralScore || 0;
        const graphScore = candidate.source === 'graph' ? candidate.similarity : existing.graphScore || 0;
        
        const combinedScore = (
          vectorScore * this.options.semanticSimilarityWeight +
          (structuralScore + graphScore) * this.options.graphSimilarityWeight
        );
        
        existing.similarity = Math.max(existing.similarity, combinedScore);
        existing.vectorScore = vectorScore;
        existing.structuralScore = structuralScore;
        existing.graphScore = graphScore;
        existing.sources.add(candidate.source);
        
      } else {
        combined.set(candidate.queryHash, {
          ...candidate,
          sources: new Set([candidate.source]),
          vectorScore: candidate.source === 'vector' ? candidate.similarity : 0,
          structuralScore: candidate.source === 'structural' ? candidate.similarity : 0,
          graphScore: candidate.source === 'graph' ? candidate.similarity : 0
        });
      }
    }
    
    return Array.from(combined.values());
  }

  async rankSimilarQueries(originalQuery, candidates, options) {
    // Enhanced ranking with multiple factors
    const ranked = [];
    
    for (const candidate of candidates) {
      const enhancedScore = await this.calculateEnhancedSimilarity(
        originalQuery,
        candidate.query,
        candidate
      );
      
      ranked.push({
        query: candidate.query,
        queryHash: candidate.queryHash,
        similarity: enhancedScore,
        details: {
          vectorSimilarity: candidate.vectorScore,
          structuralSimilarity: candidate.structuralScore,
          graphSimilarity: candidate.graphScore,
          sources: Array.from(candidate.sources)
        }
      });
    }
    
    return ranked
      .sort((a, b) => b.similarity - a.similarity)
      .filter(r => r.similarity >= (options.threshold || this.options.similarityThreshold));
  }

  async calculateEnhancedSimilarity(query1, query2, candidate) {
    let score = candidate.similarity;
    
    // Boost score for queries with similar performance characteristics
    if (candidate.performance) {
      const perfSimilarity = this.calculatePerformanceSimilarity(query1, query2, candidate.performance);
      score += perfSimilarity * 0.1;
    }
    
    // Boost score for queries from same domain/context
    const contextSimilarity = this.calculateContextSimilarity(query1, query2);
    score += contextSimilarity * 0.05;
    
    // Penalty for overly complex differences
    const complexityPenalty = this.calculateComplexityPenalty(query1, query2);
    score -= complexityPenalty * 0.05;
    
    return Math.min(1.0, Math.max(0.0, score));
  }

  calculatePerformanceSimilarity(query1, query2, performance) {
    // Mock performance similarity calculation
    return 0.5;
  }

  calculateContextSimilarity(query1, query2) {
    // Check for domain-specific patterns
    const domains1 = this.extractDomains(query1);
    const domains2 = this.extractDomains(query2);
    
    return this.calculateSetSimilarity(domains1, domains2);
  }

  extractDomains(query) {
    const domains = [];
    
    if (query.includes('prov:') || query.includes('provenance')) domains.push('provenance');
    if (query.includes('foaf:') || query.includes('person')) domains.push('social');
    if (query.includes('org:') || query.includes('organization')) domains.push('organizational');
    if (query.includes('time') || query.includes('date')) domains.push('temporal');
    
    return domains;
  }

  calculateComplexityPenalty(query1, query2) {
    const complexity1 = this.calculateComplexity(query1);
    const complexity2 = this.calculateComplexity(query2);
    
    const diff = Math.abs(complexity1 - complexity2);
    const max = Math.max(complexity1, complexity2, 1);
    
    return diff / max;
  }

  addToIndex(embedding, queryHash) {
    this.vectorIndex.vectors.push(embedding);
    this.vectorIndex.queryIds.push(queryHash);
    this.vectorIndex.index.set(queryHash, this.vectorIndex.vectors.length - 1);
  }

  async searchIndex(queryEmbedding, threshold) {
    const similarities = [];
    
    for (let i = 0; i < this.vectorIndex.vectors.length; i++) {
      const similarity = this.cosineSimilarity(queryEmbedding, this.vectorIndex.vectors[i]);
      
      if (similarity >= threshold) {
        similarities.push({
          queryHash: this.vectorIndex.queryIds[i],
          query: this.queryEmbeddings.get(this.vectorIndex.queryIds[i])?.query,
          similarity,
          type: 'vector'
        });
      }
    }
    
    return similarities.sort((a, b) => b.similarity - a.similarity);
  }

  cosineSimilarity(vec1, vec2) {
    let dotProduct = 0;
    let magnitude1 = 0;
    let magnitude2 = 0;
    
    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      magnitude1 += vec1[i] * vec1[i];
      magnitude2 += vec2[i] * vec2[i];
    }
    
    magnitude1 = Math.sqrt(magnitude1);
    magnitude2 = Math.sqrt(magnitude2);
    
    if (magnitude1 === 0 || magnitude2 === 0) return 0;
    
    return dotProduct / (magnitude1 * magnitude2);
  }

  hashQuery(query) {
    // Simple hash function
    let hash = 0;
    for (let i = 0; i < query.length; i++) {
      const char = query.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString();
  }

  trimEmbeddingCache() {
    // Remove oldest entries to stay within limit
    const entries = Array.from(this.embeddingCache.entries());
    const sortedByAge = entries.sort((a, b) => {
      const dataA = this.queryEmbeddings.get(a[0]);
      const dataB = this.queryEmbeddings.get(b[0]);
      return (dataA?.timestamp || 0) - (dataB?.timestamp || 0);
    });
    
    const toRemove = sortedByAge.slice(0, sortedByAge.length - this.options.maxCachedEmbeddings * 0.8);
    
    for (const [queryHash] of toRemove) {
      this.embeddingCache.delete(queryHash);
      this.queryEmbeddings.delete(queryHash);
    }
    
    this.logger.debug(`Trimmed ${toRemove.length} embeddings from cache`);
  }

  /**
   * Cluster similar queries for pattern analysis
   * @param {number} k - Number of clusters
   */
  async clusterQueries(k = 10) {
    const embeddings = Array.from(this.queryEmbeddings.values()).map(data => data.embedding);
    const queryHashes = Array.from(this.queryEmbeddings.keys());
    
    if (embeddings.length < k) {
      this.logger.warn('Not enough queries for clustering');
      return;
    }
    
    // Simple k-means clustering (mock implementation)
    const clusters = await this.kMeansClustering(embeddings, k);
    
    // Update cluster assignments
    for (let i = 0; i < queryHashes.length; i++) {
      const queryHash = queryHashes[i];
      const clusterId = clusters.assignments[i];
      this.clusterAssignments.set(queryHash, clusterId);
      
      if (!this.clusters.has(clusterId)) {
        this.clusters.set(clusterId, []);
      }
      this.clusters.get(clusterId).push(queryHash);
    }
    
    this.metrics.clusterUpdates++;
    this.logger.info(`Clustered ${embeddings.length} queries into ${k} clusters`);
    
    return {
      clusters: this.clusters,
      assignments: this.clusterAssignments,
      centroids: clusters.centroids
    };
  }

  async kMeansClustering(embeddings, k) {
    // Mock k-means implementation
    const centroids = this.initializeCentroids(embeddings, k);
    const assignments = new Array(embeddings.length);
    
    for (let iter = 0; iter < 10; iter++) {
      // Assign points to nearest centroid
      for (let i = 0; i < embeddings.length; i++) {
        let bestCluster = 0;
        let bestDistance = Infinity;
        
        for (let j = 0; j < k; j++) {
          const distance = this.euclideanDistance(embeddings[i], centroids[j]);
          if (distance < bestDistance) {
            bestDistance = distance;
            bestCluster = j;
          }
        }
        
        assignments[i] = bestCluster;
      }
      
      // Update centroids
      for (let j = 0; j < k; j++) {
        const clusterPoints = embeddings.filter((_, i) => assignments[i] === j);
        if (clusterPoints.length > 0) {
          centroids[j] = this.calculateCentroid(clusterPoints);
        }
      }
    }
    
    return { assignments, centroids };
  }

  initializeCentroids(embeddings, k) {
    const centroids = [];
    const dimensions = embeddings[0].length;
    
    for (let i = 0; i < k; i++) {
      const centroid = new Array(dimensions);
      for (let j = 0; j < dimensions; j++) {
        centroid[j] = Math.random() * 2 - 1; // Random value between -1 and 1
      }
      centroids.push(centroid);
    }
    
    return centroids;
  }

  calculateCentroid(points) {
    const dimensions = points[0].length;
    const centroid = new Array(dimensions).fill(0);
    
    for (const point of points) {
      for (let i = 0; i < dimensions; i++) {
        centroid[i] += point[i];
      }
    }
    
    for (let i = 0; i < dimensions; i++) {
      centroid[i] /= points.length;
    }
    
    return centroid;
  }

  euclideanDistance(vec1, vec2) {
    let sum = 0;
    for (let i = 0; i < vec1.length; i++) {
      sum += Math.pow(vec1[i] - vec2[i], 2);
    }
    return Math.sqrt(sum);
  }

  /**
   * Get similarity detection statistics
   */
  getStatistics() {
    return {
      embeddings: {
        cached: this.embeddingCache.size,
        generated: this.metrics.embeddingsGenerated,
        cacheHits: this.metrics.cacheHits,
        cacheMisses: this.metrics.cacheMisses,
        hitRate: this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses) || 0
      },
      similarity: {
        computations: this.metrics.similaritiesComputed,
        vectorIndex: this.vectorIndex.vectors.length,
        structuralPatterns: this.structuralPatterns.size,
        graphPatterns: this.graphPatterns.size
      },
      clustering: {
        clusters: this.clusters.size,
        updates: this.metrics.clusterUpdates,
        assignments: this.clusterAssignments.size
      },
      configuration: {
        threshold: this.options.similarityThreshold,
        embeddingModel: this.options.embeddingModel,
        vectorDimensions: this.options.vectorDimensions,
        maxCached: this.options.maxCachedEmbeddings
      }
    };
  }

  /**
   * Clear all cached data
   */
  clear() {
    this.queryEmbeddings.clear();
    this.embeddingCache.clear();
    this.similarityMatrix.clear();
    this.clusterAssignments.clear();
    this.clusters.clear();
    
    this.vectorIndex = {
      vectors: [],
      queryIds: [],
      index: new Map(),
      add: this.addToIndex.bind(this),
      search: this.searchIndex.bind(this)
    };
    
    // Reset metrics
    Object.keys(this.metrics).forEach(key => {
      this.metrics[key] = 0;
    });
    
    this.logger.info('Query similarity detector cleared');
  }
}

export default QuerySimilarityDetector;