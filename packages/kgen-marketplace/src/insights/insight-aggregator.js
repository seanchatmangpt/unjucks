/**
 * Insight Aggregator for Marketplace Recommendations
 * 
 * Combines and deduplicates recommendations from multiple algorithms
 * and generates consolidated insights and patterns.
 */

import { createLogger } from '../utils/logger.js';

export class InsightAggregator {
  constructor() {
    this.logger = createLogger('InsightAggregator');
    
    // Deduplication strategies
    this.deduplicationStrategies = {
      'exact-match': this._exactMatchDedup,
      'fuzzy-match': this._fuzzyMatchDedup,
      'semantic-match': this._semanticMatchDedup
    };
    
    // Aggregation weights for combining scores from different algorithms
    this.aggregationWeights = {
      'highest': (scores) => Math.max(...scores),
      'average': (scores) => scores.reduce((sum, s) => sum + s, 0) / scores.length,
      'weighted-average': (scores, weights) => this._weightedAverage(scores, weights),
      'harmonic-mean': (scores) => scores.length / scores.reduce((sum, s) => sum + 1/s, 0),
      'confidence-weighted': (scores, confidences) => this._confidenceWeighted(scores, confidences)
    };
  }
  
  /**
   * Aggregate recommendations from multiple algorithms
   * @param {Array} algorithmResults - Array of results from different algorithms
   * @param {Object} options - Aggregation options
   * @returns {Array} Deduplicated and aggregated recommendations
   */
  aggregate(algorithmResults, options = {}) {
    try {
      this.logger.info('Aggregating recommendations', { 
        algorithmCount: algorithmResults.length,
        totalRecommendations: this._countTotalRecommendations(algorithmResults)
      });
      
      const {
        deduplicationStrategy = 'fuzzy-match',
        scoreAggregation = 'weighted-average',
        maxRecommendations = 50,
        preserveSource = true
      } = options;
      
      // Flatten all recommendations into a single array
      const flattenedRecommendations = this._flattenRecommendations(algorithmResults);
      
      // Deduplicate recommendations
      const deduplicated = this._deduplicateRecommendations(
        flattenedRecommendations,
        deduplicationStrategy
      );
      
      // Aggregate scores for duplicates
      const aggregated = this._aggregateScores(deduplicated, scoreAggregation);
      
      // Merge metadata and insights
      const enriched = this._enrichWithMetadata(aggregated);
      
      // Apply cross-algorithm insights
      const withInsights = this._applyCrossAlgorithmInsights(enriched, algorithmResults);
      
      // Limit results
      const limited = withInsights.slice(0, maxRecommendations);
      
      this.logger.info('Completed aggregation', { 
        originalCount: flattenedRecommendations.length,
        deduplicatedCount: limited.length
      });
      
      return limited;
      
    } catch (error) {
      this.logger.error('Failed to aggregate recommendations', error);
      throw error;
    }
  }
  
  /**
   * Generate cross-algorithm insights
   * @param {Array} recommendations - Aggregated recommendations
   * @param {Array} algorithmResults - Original algorithm results
   * @returns {Object} Generated insights
   */
  generateInsights(recommendations, algorithmResults) {
    try {
      const insights = {
        convergence: this._analyzeAlgorithmConvergence(recommendations, algorithmResults),
        diversity: this._analyzeDiversity(recommendations),
        patterns: this._identifyPatterns(recommendations),
        confidence: this._analyzeConfidence(recommendations),
        coverage: this._analyzeCoverage(recommendations, algorithmResults),
        recommendations: this._generateMetaRecommendations(recommendations)
      };
      
      return insights;
      
    } catch (error) {
      this.logger.error('Failed to generate insights', error);
      return {};
    }
  }
  
  /**
   * Analyze quality of aggregated recommendations
   * @param {Array} recommendations - Aggregated recommendations
   * @returns {Object} Quality analysis
   */
  analyzeQuality(recommendations) {
    try {
      const quality = {
        score: this._calculateOverallQuality(recommendations),
        distribution: this._analyzeScoreDistribution(recommendations),
        consistency: this._analyzeConsistency(recommendations),
        completeness: this._analyzeCompleteness(recommendations),
        reliability: this._analyzeReliability(recommendations)
      };
      
      return quality;
      
    } catch (error) {
      this.logger.error('Failed to analyze quality', error);
      return { score: 0 };
    }
  }
  
  /**
   * Flatten recommendations from all algorithms
   */
  _flattenRecommendations(algorithmResults) {
    const flattened = [];
    
    algorithmResults.forEach((result, algorithmIndex) => {
      const algorithmName = result.algorithm || `algorithm_${algorithmIndex}`;
      const recommendations = result.recommendations || result;
      
      if (Array.isArray(recommendations)) {
        recommendations.forEach(rec => {
          flattened.push({
            ...rec,
            sourceAlgorithm: algorithmName,
            sourceIndex: algorithmIndex,
            originalScore: rec.score
          });
        });
      }
    });
    
    return flattened;
  }
  
  /**
   * Deduplicate recommendations based on strategy
   */
  _deduplicateRecommendations(recommendations, strategy) {
    const deduplicator = this.deduplicationStrategies[strategy];
    if (!deduplicator) {
      this.logger.warn(`Unknown deduplication strategy: ${strategy}, using exact-match`);
      return this._exactMatchDedup(recommendations);
    }
    
    return deduplicator.call(this, recommendations);
  }
  
  /**
   * Exact match deduplication
   */
  _exactMatchDedup(recommendations) {
    const seen = new Map();
    const deduplicated = [];
    
    recommendations.forEach(rec => {
      const key = this._getExactMatchKey(rec);
      
      if (seen.has(key)) {
        // Merge with existing recommendation
        const existing = seen.get(key);
        existing.sources.push({
          algorithm: rec.sourceAlgorithm,
          score: rec.originalScore,
          reasoning: rec.reasoning
        });
        existing.totalScore += rec.originalScore || 0;
        existing.algorithmCount++;
      } else {
        const merged = {
          ...rec,
          sources: [{
            algorithm: rec.sourceAlgorithm,
            score: rec.originalScore,
            reasoning: rec.reasoning
          }],
          totalScore: rec.originalScore || 0,
          algorithmCount: 1
        };
        
        seen.set(key, merged);
        deduplicated.push(merged);
      }
    });
    
    return deduplicated;
  }
  
  /**
   * Fuzzy match deduplication
   */
  _fuzzyMatchDedup(recommendations) {
    const clusters = [];
    
    recommendations.forEach(rec => {
      let matchedCluster = null;
      
      // Find best matching cluster
      for (const cluster of clusters) {
        const similarity = this._calculateSimilarity(rec, cluster.representative);
        if (similarity >= 0.8) { // 80% similarity threshold
          matchedCluster = cluster;
          break;
        }
      }
      
      if (matchedCluster) {
        // Add to existing cluster
        matchedCluster.members.push(rec);
        matchedCluster.totalScore += rec.originalScore || 0;
        
        // Update representative if this has a higher score
        if ((rec.originalScore || 0) > (matchedCluster.representative.originalScore || 0)) {
          matchedCluster.representative = rec;
        }
      } else {
        // Create new cluster
        clusters.push({
          representative: rec,
          members: [rec],
          totalScore: rec.originalScore || 0
        });
      }
    });
    
    // Convert clusters back to recommendations
    return clusters.map(cluster => {
      const sources = cluster.members.map(member => ({
        algorithm: member.sourceAlgorithm,
        score: member.originalScore,
        reasoning: member.reasoning
      }));
      
      return {
        ...cluster.representative,
        sources,
        totalScore: cluster.totalScore,
        algorithmCount: cluster.members.length,
        clusterSize: cluster.members.length
      };
    });
  }
  
  /**
   * Semantic match deduplication (simplified)
   */
  _semanticMatchDedup(recommendations) {
    // For now, use fuzzy matching as a proxy for semantic matching
    // In a real implementation, this would use embeddings or NLP
    return this._fuzzyMatchDedup(recommendations);
  }
  
  /**
   * Aggregate scores for deduplicated recommendations
   */
  _aggregateScores(recommendations, strategy) {
    const aggregationFunction = this.aggregationWeights[strategy];
    
    if (!aggregationFunction) {
      this.logger.warn(`Unknown aggregation strategy: ${strategy}, using average`);
      return this._aggregateWithAverage(recommendations);
    }
    
    return recommendations.map(rec => {
      const scores = rec.sources.map(source => source.score || 0);
      const weights = rec.sources.map(source => this._getAlgorithmWeight(source.algorithm));
      const confidences = rec.sources.map(source => source.confidence || 0.5);
      
      let aggregatedScore;
      
      if (strategy === 'weighted-average') {
        aggregatedScore = this._weightedAverage(scores, weights);
      } else if (strategy === 'confidence-weighted') {
        aggregatedScore = this._confidenceWeighted(scores, confidences);
      } else {
        aggregatedScore = aggregationFunction(scores);
      }
      
      return {
        ...rec,
        score: aggregatedScore,
        scoreAggregation: {
          strategy,
          originalScores: scores,
          weights,
          confidences
        }
      };
    });
  }
  
  /**
   * Enrich recommendations with aggregated metadata
   */
  _enrichWithMetadata(recommendations) {
    return recommendations.map(rec => ({
      ...rec,
      metadata: {
        algorithmConsensus: this._calculateConsensus(rec.sources),
        diversityScore: this._calculateDiversityScore(rec.sources),
        reliabilityScore: this._calculateReliabilityScore(rec),
        validationLevel: this._calculateValidationLevel(rec.algorithmCount),
        crossValidation: rec.algorithmCount > 1
      }
    }));
  }
  
  /**
   * Apply cross-algorithm insights
   */
  _applyCrossAlgorithmInsights(recommendations, algorithmResults) {
    return recommendations.map(rec => {
      const insights = {
        algorithmAgreement: this._analyzeAlgorithmAgreement(rec),
        strengthIndicators: this._identifyStrengthIndicators(rec),
        potentialConcerns: this._identifyPotentialConcerns(rec),
        validationSources: this._identifyValidationSources(rec, algorithmResults)
      };
      
      return {
        ...rec,
        crossAlgorithmInsights: insights
      };
    });
  }
  
  /**
   * Analyze algorithm convergence
   */
  _analyzeAlgorithmConvergence(recommendations, algorithmResults) {
    const totalRecommendations = this._countTotalRecommendations(algorithmResults);
    const deduplicatedCount = recommendations.length;
    
    const convergenceRate = 1 - (deduplicatedCount / totalRecommendations);
    
    // Analyze which packages appear in multiple algorithms
    const multiAlgorithmPicks = recommendations.filter(rec => rec.algorithmCount > 1);
    const convergenceStrength = multiAlgorithmPicks.length / recommendations.length;
    
    return {
      rate: convergenceRate,
      strength: convergenceStrength,
      consensusRecommendations: multiAlgorithmPicks.length,
      totalUnique: deduplicatedCount,
      interpretation: this._interpretConvergence(convergenceRate, convergenceStrength)
    };
  }
  
  /**
   * Analyze diversity of recommendations
   */
  _analyzeDiversity(recommendations) {
    const categories = new Set();
    const technologies = new Set();
    const sources = new Set();
    
    recommendations.forEach(rec => {
      if (rec.category?.value) categories.add(rec.category.value);
      if (rec.technology?.value) technologies.add(rec.technology.value);
      rec.sources.forEach(source => sources.add(source.algorithm));
    });
    
    return {
      categoryDiversity: categories.size,
      technologyDiversity: technologies.size,
      sourceDiversity: sources.size,
      diversityScore: this._calculateOverallDiversity(categories.size, technologies.size, sources.size),
      categories: Array.from(categories),
      technologies: Array.from(technologies)
    };
  }
  
  /**
   * Identify patterns in recommendations
   */
  _identifyPatterns(recommendations) {
    const patterns = {
      categoryTrends: this._identifyCategoryTrends(recommendations),
      technologyClusters: this._identifyTechnologyClusters(recommendations),
      scoringPatterns: this._identifyScoringPatterns(recommendations),
      sourcePatterns: this._identifySourcePatterns(recommendations)
    };
    
    return patterns;
  }
  
  /**
   * Helper methods
   */
  _getExactMatchKey(recommendation) {
    return recommendation.name?.value || 
           recommendation.pack?.value || 
           recommendation.id || 
           recommendation.uri ||
           JSON.stringify(recommendation);
  }
  
  _calculateSimilarity(rec1, rec2) {
    let similarity = 0;
    let factors = 0;
    
    // Name similarity
    if (rec1.name?.value && rec2.name?.value) {
      similarity += this._stringSimilarity(rec1.name.value, rec2.name.value);
      factors++;
    }
    
    // Category similarity
    if (rec1.category?.value && rec2.category?.value) {
      similarity += rec1.category.value === rec2.category.value ? 1 : 0;
      factors++;
    }
    
    // Technology similarity
    const tech1 = rec1.technology?.value || rec1.framework?.value;
    const tech2 = rec2.technology?.value || rec2.framework?.value;
    if (tech1 && tech2) {
      similarity += tech1 === tech2 ? 1 : 0;
      factors++;
    }
    
    return factors > 0 ? similarity / factors : 0;
  }
  
  _stringSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const distance = this._levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }
  
  _levenshteinDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }
  
  _getAlgorithmWeight(algorithmName) {
    const weights = {
      compliance: 0.25,
      template: 0.2,
      similarity: 0.2,
      popularity: 0.15,
      roi: 0.2
    };
    
    return weights[algorithmName] || 0.15;
  }
  
  _weightedAverage(scores, weights) {
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    const weightedSum = scores.reduce((sum, score, i) => sum + score * weights[i], 0);
    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }
  
  _confidenceWeighted(scores, confidences) {
    const totalConfidence = confidences.reduce((sum, c) => sum + c, 0);
    const weightedSum = scores.reduce((sum, score, i) => sum + score * confidences[i], 0);
    return totalConfidence > 0 ? weightedSum / totalConfidence : 0;
  }
  
  _aggregateWithAverage(recommendations) {
    return recommendations.map(rec => {
      const scores = rec.sources.map(source => source.score || 0);
      const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
      
      return {
        ...rec,
        score: averageScore,
        scoreAggregation: {
          strategy: 'average',
          originalScores: scores
        }
      };
    });
  }
  
  _calculateConsensus(sources) {
    const scores = sources.map(s => s.score || 0);
    const avgScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;
    const variance = scores.reduce((sum, s) => sum + Math.pow(s - avgScore, 2), 0) / scores.length;
    
    // Lower variance = higher consensus
    return Math.max(0, 1 - Math.sqrt(variance));
  }
  
  _calculateDiversityScore(sources) {
    const uniqueAlgorithms = new Set(sources.map(s => s.algorithm)).size;
    return uniqueAlgorithms / Math.max(sources.length, 1);
  }
  
  _calculateReliabilityScore(recommendation) {
    const algorithmCount = recommendation.algorithmCount;
    const consensusBonus = algorithmCount > 1 ? 0.2 : 0;
    const scoreStability = recommendation.metadata?.algorithmConsensus || 0.5;
    
    return Math.min(0.5 + consensusBonus + scoreStability * 0.3, 1.0);
  }
  
  _calculateValidationLevel(algorithmCount) {
    if (algorithmCount >= 4) return 'high';
    if (algorithmCount >= 2) return 'medium';
    return 'low';
  }
  
  _analyzeAlgorithmAgreement(recommendation) {
    const scores = recommendation.sources.map(s => s.score || 0);
    const maxScore = Math.max(...scores);
    const minScore = Math.min(...scores);
    const range = maxScore - minScore;
    
    return {
      level: range <= 0.2 ? 'high' : range <= 0.5 ? 'medium' : 'low',
      scoreRange: range,
      algorithms: recommendation.sources.map(s => s.algorithm)
    };
  }
  
  _identifyStrengthIndicators(recommendation) {
    const indicators = [];
    
    if (recommendation.algorithmCount >= 3) {
      indicators.push('Multi-algorithm validation');
    }
    
    if (recommendation.metadata?.algorithmConsensus > 0.8) {
      indicators.push('High algorithm consensus');
    }
    
    if (recommendation.score > 0.8) {
      indicators.push('High overall score');
    }
    
    return indicators;
  }
  
  _identifyPotentialConcerns(recommendation) {
    const concerns = [];
    
    if (recommendation.algorithmCount === 1) {
      concerns.push('Single algorithm recommendation - needs validation');
    }
    
    if (recommendation.metadata?.algorithmConsensus < 0.5) {
      concerns.push('Low algorithm consensus - conflicting signals');
    }
    
    return concerns;
  }
  
  _identifyValidationSources(recommendation, algorithmResults) {
    return recommendation.sources.map(source => ({
      algorithm: source.algorithm,
      validationType: this._getValidationType(source.algorithm),
      confidence: source.confidence || 0.5
    }));
  }
  
  _getValidationType(algorithm) {
    const types = {
      compliance: 'regulatory-validation',
      template: 'technical-validation',
      similarity: 'behavioral-validation',
      popularity: 'community-validation',
      roi: 'business-validation'
    };
    
    return types[algorithm] || 'general-validation';
  }
  
  _countTotalRecommendations(algorithmResults) {
    return algorithmResults.reduce((total, result) => {
      const recommendations = result.recommendations || result;
      return total + (Array.isArray(recommendations) ? recommendations.length : 0);
    }, 0);
  }
  
  _interpretConvergence(rate, strength) {
    if (strength > 0.7) return 'Strong consensus across algorithms';
    if (strength > 0.4) return 'Moderate agreement between algorithms';
    if (strength > 0.2) return 'Some algorithmic overlap';
    return 'Diverse algorithmic perspectives';
  }
  
  _calculateOverallDiversity(categories, technologies, sources) {
    // Weighted diversity score
    return (categories * 0.4 + technologies * 0.4 + sources * 0.2) / 3;
  }
  
  _identifyCategoryTrends(recommendations) {
    const categories = {};
    recommendations.forEach(rec => {
      const category = rec.category?.value || 'unknown';
      categories[category] = (categories[category] || 0) + 1;
    });
    
    return Object.entries(categories)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([category, count]) => ({ category, count, percentage: count / recommendations.length * 100 }));
  }
  
  _identifyTechnologyClusters(recommendations) {
    const technologies = {};
    recommendations.forEach(rec => {
      const tech = rec.technology?.value || rec.framework?.value || 'unknown';
      technologies[tech] = (technologies[tech] || 0) + 1;
    });
    
    return Object.entries(technologies)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([technology, count]) => ({ technology, count }));
  }
  
  _identifyScoringPatterns(recommendations) {
    const scores = recommendations.map(rec => rec.score || 0);
    return {
      average: scores.reduce((sum, s) => sum + s, 0) / scores.length,
      median: this._calculateMedian(scores),
      standardDeviation: this._calculateStandardDeviation(scores),
      distribution: this._categorizeScores(scores)
    };
  }
  
  _identifySourcePatterns(recommendations) {
    const sourceFrequency = {};
    recommendations.forEach(rec => {
      rec.sources.forEach(source => {
        sourceFrequency[source.algorithm] = (sourceFrequency[source.algorithm] || 0) + 1;
      });
    });
    
    return Object.entries(sourceFrequency)
      .sort(([,a], [,b]) => b - a)
      .map(([algorithm, frequency]) => ({ algorithm, frequency }));
  }
  
  _calculateMedian(numbers) {
    const sorted = [...numbers].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  }
  
  _calculateStandardDeviation(numbers) {
    const avg = numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
    const variance = numbers.reduce((sum, n) => sum + Math.pow(n - avg, 2), 0) / numbers.length;
    return Math.sqrt(variance);
  }
  
  _categorizeScores(scores) {
    return {
      excellent: scores.filter(s => s >= 0.8).length,
      good: scores.filter(s => s >= 0.6 && s < 0.8).length,
      average: scores.filter(s => s >= 0.4 && s < 0.6).length,
      poor: scores.filter(s => s < 0.4).length
    };
  }
  
  _calculateOverallQuality(recommendations) {
    if (recommendations.length === 0) return 0;
    
    const avgScore = recommendations.reduce((sum, rec) => sum + (rec.score || 0), 0) / recommendations.length;
    const diversityBonus = this._analyzeDiversity(recommendations).diversityScore * 0.1;
    const validationBonus = recommendations.filter(rec => rec.algorithmCount > 1).length / recommendations.length * 0.1;
    
    return Math.min(avgScore + diversityBonus + validationBonus, 1.0);
  }
  
  _analyzeScoreDistribution(recommendations) {
    const scores = recommendations.map(rec => rec.score || 0);
    return this._categorizeScores(scores);
  }
  
  _analyzeConsistency(recommendations) {
    const multiAlgorithmRecs = recommendations.filter(rec => rec.algorithmCount > 1);
    if (multiAlgorithmRecs.length === 0) return 0;
    
    const consistencyScores = multiAlgorithmRecs.map(rec => rec.metadata?.algorithmConsensus || 0);
    return consistencyScores.reduce((sum, s) => sum + s, 0) / consistencyScores.length;
  }
  
  _analyzeCompleteness(recommendations) {
    // Analyze if recommendations cover all important categories/domains
    const categories = new Set(recommendations.map(rec => rec.category?.value).filter(Boolean));
    const expectedCategories = ['security', 'testing', 'deployment', 'development', 'compliance'];
    const coverage = expectedCategories.filter(cat => categories.has(cat)).length / expectedCategories.length;
    
    return coverage;
  }
  
  _analyzeReliability(recommendations) {
    return recommendations.reduce((sum, rec) => sum + (rec.metadata?.reliabilityScore || 0), 0) / recommendations.length;
  }
  
  _analyzeConfidence(recommendations) {
    const confidenceScores = recommendations.map(rec => {
      const sources = rec.sources || [];
      return sources.reduce((sum, source) => sum + (source.confidence || 0.5), 0) / Math.max(sources.length, 1);
    });
    
    return {
      average: confidenceScores.reduce((sum, c) => sum + c, 0) / confidenceScores.length,
      distribution: this._categorizeConfidence(confidenceScores)
    };
  }
  
  _categorizeConfidence(confidences) {
    return {
      high: confidences.filter(c => c >= 0.8).length,
      medium: confidences.filter(c => c >= 0.6 && c < 0.8).length,
      low: confidences.filter(c => c < 0.6).length
    };
  }
  
  _analyzeCoverage(recommendations, algorithmResults) {
    const totalUnique = this._countUniqueRecommendations(algorithmResults);
    const covered = recommendations.length;
    
    return {
      percentage: (covered / totalUnique) * 100,
      unique: totalUnique,
      covered
    };
  }
  
  _countUniqueRecommendations(algorithmResults) {
    const allNames = new Set();
    algorithmResults.forEach(result => {
      const recommendations = result.recommendations || result;
      if (Array.isArray(recommendations)) {
        recommendations.forEach(rec => {
          const name = rec.name?.value || rec.pack?.value || rec.id;
          if (name) allNames.add(name);
        });
      }
    });
    return allNames.size;
  }
  
  _generateMetaRecommendations(recommendations) {
    const metaRecs = [];
    
    // Recommend packages with high consensus
    const highConsensus = recommendations.filter(rec => 
      rec.algorithmCount >= 3 && rec.metadata?.algorithmConsensus > 0.8
    );
    
    if (highConsensus.length > 0) {
      metaRecs.push({
        type: 'high-consensus',
        title: 'Highly Validated Recommendations',
        description: 'These packages have strong agreement across multiple algorithms',
        packages: highConsensus.slice(0, 3),
        confidence: 'high'
      });
    }
    
    // Recommend quick wins
    const quickWins = recommendations.filter(rec => 
      rec.type === 'template' && rec.score > 0.7
    );
    
    if (quickWins.length > 0) {
      metaRecs.push({
        type: 'quick-wins',
        title: 'Quick Implementation Wins',
        description: 'Templates that can provide immediate value',
        packages: quickWins.slice(0, 2),
        confidence: 'medium'
      });
    }
    
    return metaRecs;
  }
}

export default InsightAggregator;