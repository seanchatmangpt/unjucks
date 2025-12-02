/**
 * Score Calculator for Marketplace Recommendations
 * 
 * Combines multiple recommendation algorithms and calculates
 * final scores based on user context, ROI analysis, and relevance.
 */

import { createLogger } from '../../utils/logger.js';

export class ScoreCalculator {
  constructor() {
    this.logger = createLogger('ScoreCalculator');
    
    // Algorithm weights for final scoring
    this.algorithmWeights = {
      compliance: 0.25,
      template: 0.2,
      similarity: 0.2,
      popularity: 0.15,
      roi: 0.2
    };
    
    // Context factors that influence scoring
    this.contextFactors = {
      industry: {
        financial: { compliance: 1.3, security: 1.2, roi: 1.1 },
        healthcare: { compliance: 1.4, security: 1.3, privacy: 1.2 },
        technology: { template: 1.2, innovation: 1.1, velocity: 1.2 },
        retail: { scalability: 1.2, performance: 1.1 },
        government: { compliance: 1.3, security: 1.2, accessibility: 1.1 }
      },
      projectStage: {
        planning: { template: 1.3, compliance: 1.2 },
        development: { template: 1.2, similarity: 1.1 },
        testing: { quality: 1.3, testing: 1.2 },
        production: { reliability: 1.3, performance: 1.2, security: 1.1 },
        maintenance: { efficiency: 1.2, automation: 1.1 }
      },
      teamSize: {
        small: { simplicity: 1.2, quickWins: 1.1 },
        medium: { scalability: 1.1, collaboration: 1.1 },
        large: { enterprise: 1.2, governance: 1.1, standardization: 1.2 }
      },
      urgency: {
        immediate: { quickWins: 1.3, simplicity: 1.2 },
        normal: { balanced: 1.0 },
        longTerm: { strategic: 1.2, roi: 1.1 }
      }
    };
    
    // Quality multipliers based on package characteristics
    this.qualityMultipliers = {
      rating: {
        excellent: 1.2,  // 4.5+
        good: 1.1,       // 4.0-4.4
        average: 1.0,    // 3.0-3.9
        poor: 0.8        // <3.0
      },
      maturity: {
        mature: 1.1,
        stable: 1.0,
        beta: 0.9,
        alpha: 0.7
      },
      adoption: {
        widespread: 1.2,
        popular: 1.1,
        growing: 1.0,
        niche: 0.9
      },
      maintenance: {
        active: 1.1,
        maintained: 1.0,
        sporadic: 0.8,
        abandoned: 0.3
      }
    };
  }
  
  /**
   * Score and rank recommendations from multiple algorithms
   * @param {Array} recommendations - Aggregated recommendations
   * @param {Object} userContext - User context and preferences
   * @param {Object} roiAnalysis - ROI analysis results
   * @returns {Promise<Array>} Scored and ranked recommendations
   */
  async scoreRecommendations(recommendations, userContext, roiAnalysis) {
    try {
      this.logger.info('Scoring recommendations', { 
        count: recommendations.length,
        userContext: userContext.industry || 'unknown'
      });
      
      // Calculate scores for each recommendation
      const scoredRecommendations = await Promise.all(
        recommendations.map(rec => this._calculateFinalScore(rec, userContext, roiAnalysis))
      );
      
      // Apply ranking logic
      const rankedRecommendations = this._rankRecommendations(scoredRecommendations, userContext);
      
      // Add ranking metadata
      const withMetadata = this._addRankingMetadata(rankedRecommendations, userContext);
      
      this.logger.info('Completed scoring', { 
        topScore: withMetadata[0]?.score || 0,
        averageScore: this._calculateAverageScore(withMetadata)
      });
      
      return withMetadata;
      
    } catch (error) {
      this.logger.error('Failed to score recommendations', error);
      throw error;
    }
  }
  
  /**
   * Calculate score for a specific recommendation type
   * @param {Object} recommendation - Single recommendation
   * @param {string} algorithm - Algorithm that generated it
   * @param {Object} context - Scoring context
   * @returns {number} Calculated score
   */
  calculateAlgorithmScore(recommendation, algorithm, context) {
    try {
      const baseScore = recommendation.score || 0;
      const algorithmWeight = this.algorithmWeights[algorithm] || 0.2;
      
      // Apply context adjustments
      const contextMultiplier = this._getContextMultiplier(recommendation, context);
      
      // Apply quality multipliers
      const qualityMultiplier = this._getQualityMultiplier(recommendation);
      
      // Calculate weighted score
      const weightedScore = baseScore * algorithmWeight * contextMultiplier * qualityMultiplier;
      
      return Math.min(weightedScore, 1.0);
      
    } catch (error) {
      this.logger.error('Failed to calculate algorithm score', error);
      return 0;
    }
  }
  
  /**
   * Validate and normalize scores across different scales
   * @param {Array} recommendations - Recommendations with various scoring scales
   * @returns {Array} Normalized recommendations
   */
  normalizeScores(recommendations) {
    try {
      // Find score ranges for normalization
      const scores = recommendations.map(rec => rec.score || 0).filter(score => score > 0);
      
      if (scores.length === 0) {
        return recommendations;
      }
      
      const minScore = Math.min(...scores);
      const maxScore = Math.max(...scores);
      const scoreRange = maxScore - minScore;
      
      // Normalize scores to 0-1 range
      return recommendations.map(rec => {
        if (!rec.score || rec.score <= 0) {
          return { ...rec, score: 0, normalizedScore: 0 };
        }
        
        const normalizedScore = scoreRange > 0 ? (rec.score - minScore) / scoreRange : 0.5;
        
        return {
          ...rec,
          originalScore: rec.score,
          score: normalizedScore,
          normalizedScore
        };
      });
      
    } catch (error) {
      this.logger.error('Failed to normalize scores', error);
      return recommendations;
    }
  }
  
  /**
   * Calculate final score combining all factors
   */
  async _calculateFinalScore(recommendation, userContext, roiAnalysis) {
    try {
      // Get base algorithm score
      const algorithmScore = this._getAlgorithmScore(recommendation);
      
      // Apply context factors
      const contextScore = this._applyContextFactors(recommendation, userContext);
      
      // Apply ROI weighting
      const roiScore = this._applyROIWeighting(recommendation, roiAnalysis);
      
      // Apply quality multipliers
      const qualityScore = this._applyQualityMultipliers(recommendation);
      
      // Apply relevance scoring
      const relevanceScore = this._calculateRelevanceScore(recommendation, userContext);
      
      // Apply risk adjustments
      const riskAdjustment = this._calculateRiskAdjustment(recommendation, userContext);
      
      // Combine all factors
      const combinedScore = this._combineScoreFactors({
        algorithm: algorithmScore,
        context: contextScore,
        roi: roiScore,
        quality: qualityScore,
        relevance: relevanceScore
      });
      
      // Apply risk adjustment
      const finalScore = combinedScore * riskAdjustment;
      
      return {
        ...recommendation,
        score: Math.min(finalScore, 1.0),
        scoreBreakdown: {
          algorithm: algorithmScore,
          context: contextScore,
          roi: roiScore,
          quality: qualityScore,
          relevance: relevanceScore,
          riskAdjustment,
          final: finalScore
        }
      };
      
    } catch (error) {
      this.logger.error('Failed to calculate final score', error);
      return { ...recommendation, score: 0 };
    }
  }
  
  /**
   * Get base algorithm score
   */
  _getAlgorithmScore(recommendation) {
    const type = recommendation.type;
    const baseScore = recommendation.score || 0;
    const algorithmWeight = this.algorithmWeights[type] || 0.2;
    
    return baseScore * algorithmWeight;
  }
  
  /**
   * Apply context factors based on user situation
   */
  _applyContextFactors(recommendation, userContext) {
    const {
      industry = 'technology',
      projectStage = 'development',
      teamSize = 'medium',
      urgency = 'normal'
    } = userContext;
    
    let contextMultiplier = 1.0;
    
    // Industry factors
    const industryFactors = this.contextFactors.industry[industry] || {};
    contextMultiplier *= this._getFactorMultiplier(recommendation, industryFactors);
    
    // Project stage factors
    const stageFactors = this.contextFactors.projectStage[projectStage] || {};
    contextMultiplier *= this._getFactorMultiplier(recommendation, stageFactors);
    
    // Team size factors
    const teamFactors = this.contextFactors.teamSize[teamSize] || {};
    contextMultiplier *= this._getFactorMultiplier(recommendation, teamFactors);
    
    // Urgency factors
    const urgencyFactors = this.contextFactors.urgency[urgency] || {};
    contextMultiplier *= this._getFactorMultiplier(recommendation, urgencyFactors);
    
    return Math.min(contextMultiplier, 2.0); // Cap at 2x multiplier
  }
  
  /**
   * Apply ROI weighting to scores
   */
  _applyROIWeighting(recommendation, roiAnalysis) {
    if (!roiAnalysis || !roiAnalysis.opportunities) {
      return 1.0; // Neutral if no ROI data
    }
    
    // Find ROI data for this recommendation
    const packageName = recommendation.name?.value || recommendation.package?.name;
    const roiOpportunity = roiAnalysis.opportunities.find(opp => 
      opp.package?.name === packageName
    );
    
    if (!roiOpportunity) {
      return 1.0; // Neutral if no specific ROI data
    }
    
    // Weight based on ROI percentage and confidence
    const roiPercentage = roiOpportunity.roi?.percentage || 0;
    const confidence = roiOpportunity.confidence?.score || 0.5;
    
    // Normalize ROI to multiplier (0% = 1.0, 100% = 1.5, 200%+ = 2.0)
    const roiMultiplier = 1.0 + Math.min(roiPercentage / 200, 1.0) * 0.5;
    
    // Weight by confidence
    return roiMultiplier * confidence + (1.0 - confidence) * 1.0;
  }
  
  /**
   * Apply quality multipliers
   */
  _applyQualityMultipliers(recommendation) {
    let qualityMultiplier = 1.0;
    
    // Rating quality
    const rating = parseFloat(recommendation.rating?.value || 3.0);
    qualityMultiplier *= this._getRatingMultiplier(rating);
    
    // Maturity level
    const maturity = recommendation.maturity?.value || 'stable';
    qualityMultiplier *= this.qualityMultipliers.maturity[maturity] || 1.0;
    
    // Adoption level
    const downloads = parseInt(recommendation.downloads?.value || 0);
    qualityMultiplier *= this._getAdoptionMultiplier(downloads);
    
    // Maintenance status
    const maintenance = recommendation.maintenanceStatus?.value || 'maintained';
    qualityMultiplier *= this.qualityMultipliers.maintenance[maintenance] || 1.0;
    
    return qualityMultiplier;
  }
  
  /**
   * Calculate relevance score based on user needs
   */
  _calculateRelevanceScore(recommendation, userContext) {
    const {
      technologies = [],
      categories = [],
      painPoints = [],
      goals = []
    } = userContext;
    
    let relevanceScore = 0.5; // Base relevance
    
    // Technology relevance
    const recTechnologies = this._extractTechnologies(recommendation);
    const techMatch = recTechnologies.filter(tech => technologies.includes(tech)).length;
    if (technologies.length > 0) {
      relevanceScore += (techMatch / technologies.length) * 0.3;
    }
    
    // Category relevance
    const recCategory = recommendation.category?.value;
    if (recCategory && categories.includes(recCategory)) {
      relevanceScore += 0.2;
    }
    
    // Pain point addressing
    const recFeatures = this._extractFeatures(recommendation);
    const painPointMatch = painPoints.filter(pain => 
      recFeatures.some(feature => feature.toLowerCase().includes(pain.toLowerCase()))
    ).length;
    if (painPoints.length > 0) {
      relevanceScore += (painPointMatch / painPoints.length) * 0.2;
    }
    
    // Goal alignment
    const goalMatch = goals.filter(goal => 
      recFeatures.some(feature => feature.toLowerCase().includes(goal.toLowerCase()))
    ).length;
    if (goals.length > 0) {
      relevanceScore += (goalMatch / goals.length) * 0.15;
    }
    
    return Math.min(relevanceScore, 1.0);
  }
  
  /**
   * Calculate risk adjustment factor
   */
  _calculateRiskAdjustment(recommendation, userContext) {
    const riskTolerance = userContext.riskTolerance || 'medium';
    
    // Base risk assessment
    let riskFactor = 1.0;
    
    // Maturity risk
    const maturity = recommendation.maturity?.value || 'stable';
    if (maturity === 'alpha' || maturity === 'beta') {
      riskFactor *= 0.8;
    }
    
    // Maintenance risk
    const maintenance = recommendation.maintenanceStatus?.value || 'maintained';
    if (maintenance === 'sporadic') {
      riskFactor *= 0.9;
    } else if (maintenance === 'abandoned') {
      riskFactor *= 0.5;
    }
    
    // Adoption risk (very low adoption can be risky)
    const downloads = parseInt(recommendation.downloads?.value || 0);
    if (downloads < 100) {
      riskFactor *= 0.7;
    }
    
    // Complexity risk
    const complexity = recommendation.complexity?.value || 'medium';
    if (complexity === 'high' && userContext.teamSize === 'small') {
      riskFactor *= 0.8;
    }
    
    // Adjust based on user's risk tolerance
    const toleranceAdjustments = {
      low: 0.8,    // More conservative
      medium: 1.0, // Neutral
      high: 1.1    // More aggressive
    };
    
    return riskFactor * (toleranceAdjustments[riskTolerance] || 1.0);
  }
  
  /**
   * Combine score factors into final score
   */
  _combineScoreFactors(factors) {
    const weights = {
      algorithm: 0.3,
      context: 0.25,
      roi: 0.2,
      quality: 0.15,
      relevance: 0.1
    };
    
    return Object.entries(factors).reduce((total, [factor, score]) => {
      return total + (score * (weights[factor] || 0));
    }, 0);
  }
  
  /**
   * Rank recommendations using sophisticated logic
   */
  _rankRecommendations(recommendations, userContext) {
    // Sort by score first
    const sorted = recommendations.sort((a, b) => b.score - a.score);
    
    // Apply diversity ranking to avoid clustering
    const diversified = this._applyDiversityRanking(sorted, userContext);
    
    // Apply boost factors for special cases
    const boosted = this._applyRankingBoosts(diversified, userContext);
    
    return boosted;
  }
  
  /**
   * Apply diversity ranking to promote variety
   */
  _applyDiversityRanking(recommendations, userContext) {
    const diversified = [];
    const categoriesSeen = new Set();
    const technologiesSeen = new Set();
    
    // First pass: top recommendations
    for (const rec of recommendations) {
      if (diversified.length >= 5) break; // Top 5 remain unchanged
      diversified.push(rec);
      
      const category = rec.category?.value;
      const technologies = this._extractTechnologies(rec);
      
      if (category) categoriesSeen.add(category);
      technologies.forEach(tech => technologiesSeen.add(tech));
    }
    
    // Second pass: promote diversity
    const remaining = recommendations.slice(5);
    for (const rec of remaining) {
      const category = rec.category?.value;
      const technologies = this._extractTechnologies(rec);
      
      // Boost score if it adds diversity
      let diversityBoost = 1.0;
      
      if (category && !categoriesSeen.has(category)) {
        diversityBoost += 0.1;
        categoriesSeen.add(category);
      }
      
      const newTechs = technologies.filter(tech => !technologiesSeen.has(tech));
      if (newTechs.length > 0) {
        diversityBoost += newTechs.length * 0.05;
        newTechs.forEach(tech => technologiesSeen.add(tech));
      }
      
      diversified.push({
        ...rec,
        score: rec.score * diversityBoost,
        diversityBoost
      });
    }
    
    // Re-sort with diversity adjustments
    return diversified.sort((a, b) => b.score - a.score);
  }
  
  /**
   * Apply ranking boosts for special conditions
   */
  _applyRankingBoosts(recommendations, userContext) {
    return recommendations.map((rec, index) => {
      let boost = 1.0;
      
      // Quick win boost
      if (rec.type === 'template' && userContext.urgency === 'immediate') {
        boost += 0.1;
      }
      
      // Strategic boost
      if (rec.type === 'compliance' && userContext.projectStage === 'planning') {
        boost += 0.15;
      }
      
      // Innovation boost for technology companies
      if (userContext.industry === 'technology' && rec.trendCategory === 'emerging') {
        boost += 0.1;
      }
      
      return {
        ...rec,
        score: rec.score * boost,
        rankingBoost: boost,
        rank: index + 1
      };
    });
  }
  
  /**
   * Add metadata about ranking decisions
   */
  _addRankingMetadata(recommendations, userContext) {
    return recommendations.map((rec, index) => ({
      ...rec,
      ranking: {
        position: index + 1,
        percentile: ((recommendations.length - index) / recommendations.length) * 100,
        tier: this._getTier(index, recommendations.length),
        confidence: this._getRankingConfidence(rec, index)
      }
    }));
  }
  
  /**
   * Helper methods
   */
  _getContextMultiplier(recommendation, context) {
    // Implementation would map recommendation attributes to context factors
    return 1.0; // Simplified
  }
  
  _getQualityMultiplier(recommendation) {
    const rating = parseFloat(recommendation.rating?.value || 3.0);
    return this._getRatingMultiplier(rating);
  }
  
  _getFactorMultiplier(recommendation, factors) {
    let multiplier = 1.0;
    
    // Check if recommendation matches any factor keywords
    const recText = `${recommendation.name?.value || ''} ${recommendation.description?.value || ''} ${recommendation.category?.value || ''}`.toLowerCase();
    
    for (const [keyword, factor] of Object.entries(factors)) {
      if (recText.includes(keyword.toLowerCase())) {
        multiplier *= factor;
      }
    }
    
    return Math.min(multiplier, 2.0);
  }
  
  _getRatingMultiplier(rating) {
    if (rating >= 4.5) return this.qualityMultipliers.rating.excellent;
    if (rating >= 4.0) return this.qualityMultipliers.rating.good;
    if (rating >= 3.0) return this.qualityMultipliers.rating.average;
    return this.qualityMultipliers.rating.poor;
  }
  
  _getAdoptionMultiplier(downloads) {
    if (downloads >= 10000) return this.qualityMultipliers.adoption.widespread;
    if (downloads >= 1000) return this.qualityMultipliers.adoption.popular;
    if (downloads >= 100) return this.qualityMultipliers.adoption.growing;
    return this.qualityMultipliers.adoption.niche;
  }
  
  _extractTechnologies(recommendation) {
    const technologies = [];
    
    if (recommendation.technology?.value) {
      technologies.push(recommendation.technology.value);
    }
    
    if (recommendation.framework?.value) {
      technologies.push(recommendation.framework.value);
    }
    
    if (recommendation.technologies) {
      technologies.push(...recommendation.technologies);
    }
    
    return [...new Set(technologies)];
  }
  
  _extractFeatures(recommendation) {
    const features = [];
    
    if (recommendation.features?.value) {
      features.push(...recommendation.features.value.split(','));
    }
    
    if (recommendation.description?.value) {
      // Simple keyword extraction from description
      const words = recommendation.description.value.toLowerCase()
        .split(/\s+/)
        .filter(word => word.length > 4);
      features.push(...words);
    }
    
    return features;
  }
  
  _calculateAverageScore(recommendations) {
    if (recommendations.length === 0) return 0;
    return recommendations.reduce((sum, rec) => sum + (rec.score || 0), 0) / recommendations.length;
  }
  
  _getTier(position, total) {
    const percentage = position / total;
    if (percentage <= 0.1) return 'top';
    if (percentage <= 0.3) return 'high';
    if (percentage <= 0.7) return 'medium';
    return 'low';
  }
  
  _getRankingConfidence(recommendation, position) {
    const scoreConfidence = recommendation.confidence?.score || 0.5;
    const positionConfidence = position < 5 ? 0.9 : position < 10 ? 0.8 : 0.7;
    
    return (scoreConfidence + positionConfidence) / 2;
  }
}

export default ScoreCalculator;