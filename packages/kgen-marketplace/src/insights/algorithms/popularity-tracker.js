/**
 * Popularity Tracking Algorithm
 * 
 * Tracks and analyzes marketplace trends, popularity patterns,
 * and emerging packages based on community usage and engagement.
 */

import { createLogger } from '../../utils/logger.js';

export class PopularityTracker {
  constructor(sparqlEngine) {
    this.sparqlEngine = sparqlEngine;
    this.logger = createLogger('PopularityTracker');
    
    // Popularity metrics and their weights
    this.popularityMetrics = {
      downloads: { weight: 0.25, decay: 0.95 }, // Recent downloads matter more
      rating: { weight: 0.2, threshold: 3.0 },
      stars: { weight: 0.15, saturationPoint: 1000 },
      forks: { weight: 0.1, saturationPoint: 100 },
      contributors: { weight: 0.1, saturationPoint: 50 },
      recentActivity: { weight: 0.1, timeWindow: 30 }, // days
      mentions: { weight: 0.05, sources: ['blog', 'social', 'docs'] },
      issues: { weight: 0.05, openVsClosed: true }
    };
    
    // Trend detection parameters
    this.trendParameters = {
      minimumGrowthRate: 0.1, // 10% growth threshold
      minimumMomentum: 5, // Minimum activity level
      trendWindow: 90, // days to analyze for trends
      emergingThreshold: 0.2, // Growth rate for "emerging" classification
      establishedThreshold: 1000 // Download threshold for "established"
    };
    
    // Category-specific adjustments
    this.categoryAdjustments = {
      'security': { popularityBoost: 1.2, trendSensitivity: 1.1 },
      'testing': { popularityBoost: 1.1, trendSensitivity: 0.9 },
      'deployment': { popularityBoost: 1.0, trendSensitivity: 1.2 },
      'documentation': { popularityBoost: 0.9, trendSensitivity: 0.8 },
      'experimental': { popularityBoost: 0.8, trendSensitivity: 1.5 }
    };
  }
  
  /**
   * Generate popularity-based recommendations
   * @param {Object} userContext - User's preferences and context
   * @param {Object} options - Recommendation options
   * @returns {Promise<Array>} Popular packages in user's domain
   */
  async recommend(userContext, options = {}) {
    try {
      this.logger.info('Generating popularity-based recommendations', { userContext });
      
      const {
        technologies = [],
        industry = null,
        categories = [],
        includeEmerging = true,
        includeTrending = true
      } = userContext;
      
      // Get popular packages from SPARQL
      const popularPackages = await this.sparqlEngine.executeNamedQuery('getPopularPacks', {
        userVerticals: this._formatArrayForSparql([industry].filter(Boolean)),
        userTechnologies: this._formatArrayForSparql(technologies),
        minRating: options.minRating || 3.0,
        minDownloads: options.minDownloads || 100,
        minLastUpdated: this._getMinLastUpdated(options.recencyDays || 90),
        limit: options.limit || 40
      });
      
      // Calculate comprehensive popularity scores
      const scoredPackages = await Promise.all(
        popularPackages.map(pkg => this._calculatePopularityScore(pkg, userContext))
      );
      
      // Add trend analysis
      const withTrends = await Promise.all(
        scoredPackages.map(pkg => this._addTrendAnalysis(pkg, userContext))
      );
      
      // Filter and categorize
      const filtered = withTrends
        .filter(pkg => this._passesPopularityFilter(pkg, options))
        .map(pkg => ({
          ...pkg,
          type: 'popularity',
          reasoning: this._generatePopularityReasoning(pkg, userContext),
          trendCategory: this._categorizeTrend(pkg),
          recommendationStrength: this._calculateRecommendationStrength(pkg, userContext)
        }));
      
      return filtered
        .sort((a, b) => b.popularityScore - a.popularityScore)
        .slice(0, options.limit || 20);
        
    } catch (error) {
      this.logger.error('Failed to generate popularity recommendations', error);
      throw error;
    }
  }
  
  /**
   * Get current trending packages and technologies
   * @param {Object} context - Analysis context
   * @returns {Promise<Object>} Trending analysis
   */
  async getTrends(context) {
    try {
      const {
        timeframe = '30days',
        categories = [],
        technologies = [],
        includeEmerging = true
      } = context;
      
      // Get market trends from SPARQL
      const marketTrends = await this.sparqlEngine.executeNamedQuery('getMarketTrends', {
        minGrowthRate: this.trendParameters.minimumGrowthRate,
        minMomentum: this.trendParameters.minimumMomentum,
        userCategories: this._formatArrayForSparql(categories),
        userTechnologies: this._formatArrayForSparql(technologies),
        limit: 50
      });
      
      // Analyze trending patterns
      const trendAnalysis = this._analyzeTrendingPatterns(marketTrends);
      
      // Identify emerging vs established trends
      const categorizedTrends = this._categorizeTrends(marketTrends);
      
      // Generate insights from trends
      const insights = this._generateTrendInsights(trendAnalysis, categorizedTrends, context);
      
      return {
        trends: marketTrends,
        analysis: trendAnalysis,
        categorized: categorizedTrends,
        insights,
        metadata: {
          analysisDate: new Date().toISOString(),
          timeframe,
          criteria: {
            minGrowthRate: this.trendParameters.minimumGrowthRate,
            minMomentum: this.trendParameters.minimumMomentum
          }
        }
      };
      
    } catch (error) {
      this.logger.error('Failed to get trends', error);
      throw error;
    }
  }
  
  /**
   * Analyze popularity patterns for a specific package
   * @param {Object} packageInfo - Package to analyze
   * @param {Object} timeRange - Time range for analysis
   * @returns {Promise<Object>} Popularity analysis
   */
  async analyzePackagePopularity(packageInfo, timeRange = {}) {
    try {
      const {
        startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 90 days ago
        endDate = new Date()
      } = timeRange;
      
      // Get historical popularity data (mock implementation)
      const historicalData = await this._getHistoricalPopularityData(packageInfo, startDate, endDate);
      
      // Calculate popularity metrics
      const metrics = this._calculateDetailedPopularityMetrics(packageInfo, historicalData);
      
      // Trend analysis
      const trendAnalysis = this._analyzePopularityTrend(historicalData);
      
      // Comparative analysis
      const comparison = await this._compareWithSimilarPackages(packageInfo);
      
      // Future projections
      const projections = this._projectFuturePopularity(historicalData, trendAnalysis);
      
      return {
        package: packageInfo,
        metrics,
        trend: trendAnalysis,
        comparison,
        projections,
        summary: this._generatePopularitySummary(metrics, trendAnalysis)
      };
      
    } catch (error) {
      this.logger.error('Failed to analyze package popularity', error);
      throw error;
    }
  }
  
  /**
   * Calculate comprehensive popularity score
   */
  async _calculatePopularityScore(package_, userContext) {
    const downloads = parseInt(package_.downloads?.value || 0);
    const rating = parseFloat(package_.rating?.value || 3.0);
    const trend = parseFloat(package_.trend?.value || 0);
    const momentum = parseFloat(package_.momentum?.value || 0);
    const communityScore = parseFloat(package_.communityScore?.value || 0);
    const recency = parseFloat(package_.recency?.value || 0);
    
    // Calculate normalized scores for each metric
    const scores = {
      downloads: this._normalizeDownloads(downloads),
      rating: this._normalizeRating(rating),
      trend: this._normalizeTrend(trend),
      momentum: this._normalizeMomentum(momentum),
      community: communityScore,
      recency: recency
    };
    
    // Apply weights
    const weightedScore = 
      (scores.downloads * this.popularityMetrics.downloads.weight) +
      (scores.rating * this.popularityMetrics.rating.weight) +
      (scores.trend * 0.15) + // Trend weight
      (scores.momentum * 0.1) + // Momentum weight
      (scores.community * 0.15) + // Community weight
      (scores.recency * 0.1); // Recency weight
    
    // Apply category adjustments
    const category = package_.category?.value;
    const categoryAdjustment = this.categoryAdjustments[category]?.popularityBoost || 1.0;
    
    // Apply user context relevance
    const relevanceMultiplier = this._calculateRelevanceMultiplier(package_, userContext);
    
    return {
      ...package_,
      popularityScore: weightedScore * categoryAdjustment * relevanceMultiplier,
      components: scores,
      adjustments: {
        category: categoryAdjustment,
        relevance: relevanceMultiplier
      }
    };
  }
  
  /**
   * Add trend analysis to package
   */
  async _addTrendAnalysis(package_, userContext) {
    const trend = parseFloat(package_.trend?.value || 0);
    const momentum = parseFloat(package_.momentum?.value || 0);
    const downloads = parseInt(package_.downloads?.value || 0);
    
    const trendData = {
      growthRate: trend,
      momentum: momentum,
      velocity: this._calculateVelocity(package_),
      direction: trend > 0 ? 'rising' : trend < 0 ? 'declining' : 'stable',
      strength: this._calculateTrendStrength(trend, momentum),
      sustainability: this._assessTrendSustainability(package_),
      lifecycle: this._determineLifecycleStage(downloads, trend, momentum)
    };
    
    return {
      ...package_,
      trendAnalysis: trendData
    };
  }
  
  /**
   * Calculate popularity metric normalizations
   */
  _normalizeDownloads(downloads) {
    // Logarithmic normalization for downloads
    return Math.min(Math.log10(downloads + 1) / 6, 1.0); // Cap at 1M downloads
  }
  
  _normalizeRating(rating) {
    // Linear normalization for rating (3.0 is threshold)
    const threshold = this.popularityMetrics.rating.threshold;
    return Math.max(0, (rating - threshold) / (5.0 - threshold));
  }
  
  _normalizeTrend(trend) {
    // Sigmoid normalization for trend (handles negative growth)
    return 1 / (1 + Math.exp(-trend * 10)); // Sigmoid with scaling
  }
  
  _normalizeMomentum(momentum) {
    // Square root normalization for momentum
    return Math.min(Math.sqrt(momentum) / 10, 1.0);
  }
  
  /**
   * Calculate relevance multiplier based on user context
   */
  _calculateRelevanceMultiplier(package_, userContext) {
    let multiplier = 1.0;
    
    // Technology alignment
    const packageTech = this._extractTechnologies(package_);
    const userTech = userContext.technologies || [];
    const techMatch = packageTech.filter(tech => userTech.includes(tech)).length;
    if (techMatch > 0) {
      multiplier += techMatch / userTech.length * 0.3;
    }
    
    // Industry alignment
    const packageIndustry = package_.vertical?.value;
    if (packageIndustry === userContext.industry) {
      multiplier += 0.2;
    }
    
    // Category preference
    const category = package_.category?.value;
    const userCategories = userContext.categories || [];
    if (userCategories.includes(category)) {
      multiplier += 0.15;
    }
    
    return Math.min(multiplier, 2.0); // Cap at 2x multiplier
  }
  
  /**
   * Analyze trending patterns across all trends
   */
  _analyzeTrendingPatterns(trends) {
    const patterns = {
      overallGrowth: this._calculateOverallGrowth(trends),
      hotCategories: this._identifyHotCategories(trends),
      emergingTechnologies: this._identifyEmergingTechnologies(trends),
      growthDistribution: this._analyzeGrowthDistribution(trends),
      momentumFactors: this._analyzeMomentumFactors(trends)
    };
    
    return patterns;
  }
  
  /**
   * Categorize trends by their characteristics
   */
  _categorizeTrends(trends) {
    const categorized = {
      emerging: trends.filter(t => this._isEmerging(t)),
      growing: trends.filter(t => this._isGrowing(t)),
      established: trends.filter(t => this._isEstablished(t)),
      declining: trends.filter(t => this._isDeclining(t)),
      volatile: trends.filter(t => this._isVolatile(t))
    };
    
    return categorized;
  }
  
  /**
   * Generate insights from trend analysis
   */
  _generateTrendInsights(analysis, categorized, context) {
    const insights = [];
    
    // Emerging technology insights
    if (analysis.emergingTechnologies.length > 0) {
      insights.push({
        type: 'emerging-tech',
        title: 'Emerging Technologies to Watch',
        description: `${analysis.emergingTechnologies.length} technologies showing strong growth`,
        technologies: analysis.emergingTechnologies.slice(0, 5),
        actionable: true
      });
    }
    
    // Hot category insights
    if (analysis.hotCategories.length > 0) {
      insights.push({
        type: 'hot-categories',
        title: 'Trending Package Categories',
        description: 'Categories experiencing significant growth in adoption',
        categories: analysis.hotCategories.slice(0, 3),
        opportunity: 'Consider exploring packages in these growing areas'
      });
    }
    
    // Market momentum insights
    insights.push({
      type: 'market-momentum',
      title: 'Market Momentum Analysis',
      description: `Overall market growth: ${analysis.overallGrowth.toFixed(1)}%`,
      momentum: analysis.overallGrowth,
      interpretation: this._interpretMarketMomentum(analysis.overallGrowth)
    });
    
    // User-specific insights
    if (context.technologies?.length > 0) {
      const userTechTrends = this._analyzeUserTechnologyTrends(categorized, context.technologies);
      if (userTechTrends.length > 0) {
        insights.push({
          type: 'user-tech-trends',
          title: 'Your Technology Stack Trends',
          description: 'Trend analysis for your current technologies',
          trends: userTechTrends,
          recommendations: this._generateTechTrendRecommendations(userTechTrends)
        });
      }
    }
    
    return insights;
  }
  
  /**
   * Trend classification helpers
   */
  _isEmerging(trend) {
    const growthRate = parseFloat(trend.growthRate?.value || 0);
    const momentum = parseFloat(trend.momentum?.value || 0);
    return growthRate >= this.trendParameters.emergingThreshold && momentum < 50;
  }
  
  _isGrowing(trend) {
    const growthRate = parseFloat(trend.growthRate?.value || 0);
    return growthRate >= this.trendParameters.minimumGrowthRate && growthRate < this.trendParameters.emergingThreshold;
  }
  
  _isEstablished(trend) {
    const momentum = parseFloat(trend.momentum?.value || 0);
    const growthRate = parseFloat(trend.growthRate?.value || 0);
    return momentum >= this.trendParameters.establishedThreshold && growthRate >= 0;
  }
  
  _isDeclining(trend) {
    const growthRate = parseFloat(trend.growthRate?.value || 0);
    return growthRate < 0;
  }
  
  _isVolatile(trend) {
    // Would analyze variance in growth over time
    return false; // Mock implementation
  }
  
  /**
   * Helper methods for analysis
   */
  _calculateOverallGrowth(trends) {
    const growthRates = trends.map(t => parseFloat(t.growthRate?.value || 0));
    return growthRates.reduce((sum, rate) => sum + rate, 0) / growthRates.length;
  }
  
  _identifyHotCategories(trends) {
    const categories = {};
    trends.forEach(trend => {
      if (trend.trendType?.value === 'category') {
        const category = trend.category?.value;
        const growth = parseFloat(trend.growthRate?.value || 0);
        if (growth >= 0.15) { // 15% growth threshold
          categories[category] = growth;
        }
      }
    });
    
    return Object.entries(categories)
      .sort(([,a], [,b]) => b - a)
      .map(([category, growth]) => ({ category, growth }));
  }
  
  _identifyEmergingTechnologies(trends) {
    const technologies = {};
    trends.forEach(trend => {
      if (trend.trendType?.value === 'technology') {
        const tech = trend.technology?.value;
        const growth = parseFloat(trend.growthRate?.value || 0);
        if (growth >= this.trendParameters.emergingThreshold) {
          technologies[tech] = growth;
        }
      }
    });
    
    return Object.entries(technologies)
      .sort(([,a], [,b]) => b - a)
      .map(([technology, growth]) => ({ technology, growth }));
  }
  
  _analyzeGrowthDistribution(trends) {
    const growthRates = trends.map(t => parseFloat(t.growthRate?.value || 0));
    const mean = growthRates.reduce((sum, rate) => sum + rate, 0) / growthRates.length;
    const variance = growthRates.reduce((sum, rate) => sum + Math.pow(rate - mean, 2), 0) / growthRates.length;
    
    return {
      mean,
      variance,
      standardDeviation: Math.sqrt(variance),
      distribution: this._categorizeGrowthRates(growthRates)
    };
  }
  
  _analyzeMomentumFactors(trends) {
    return {
      highMomentum: trends.filter(t => parseFloat(t.momentum?.value || 0) > 100).length,
      mediumMomentum: trends.filter(t => {
        const momentum = parseFloat(t.momentum?.value || 0);
        return momentum >= 20 && momentum <= 100;
      }).length,
      lowMomentum: trends.filter(t => parseFloat(t.momentum?.value || 0) < 20).length
    };
  }
  
  _categorizeGrowthRates(rates) {
    return {
      explosive: rates.filter(r => r >= 0.5).length, // >50% growth
      rapid: rates.filter(r => r >= 0.2 && r < 0.5).length, // 20-50%
      moderate: rates.filter(r => r >= 0.1 && r < 0.2).length, // 10-20%
      slow: rates.filter(r => r >= 0 && r < 0.1).length, // 0-10%
      declining: rates.filter(r => r < 0).length // Negative growth
    };
  }
  
  _calculateVelocity(package_) {
    // Mock velocity calculation based on recent activity
    const downloads = parseInt(package_.downloads?.value || 0);
    const trend = parseFloat(package_.trend?.value || 0);
    return downloads * (1 + trend);
  }
  
  _calculateTrendStrength(trend, momentum) {
    const trendComponent = Math.abs(trend);
    const momentumComponent = Math.min(momentum / 100, 1.0);
    return (trendComponent + momentumComponent) / 2;
  }
  
  _assessTrendSustainability(package_) {
    // Assess how sustainable the current trend is
    const rating = parseFloat(package_.rating?.value || 3.0);
    const communityScore = parseFloat(package_.communityScore?.value || 0);
    
    // Higher rating and community engagement suggest more sustainable trends
    return (rating / 5.0) * 0.6 + communityScore * 0.4;
  }
  
  _determineLifecycleStage(downloads, trend, momentum) {
    if (downloads < 1000 && trend > 0.2) return 'emerging';
    if (downloads < 10000 && trend > 0.1) return 'growing';
    if (downloads >= 10000 && trend >= 0) return 'mature';
    if (trend < 0) return 'declining';
    return 'stable';
  }
  
  _passesPopularityFilter(package_, options) {
    const score = package_.popularityScore;
    const minScore = options.minPopularityScore || 0.3;
    
    return score >= minScore;
  }
  
  _generatePopularityReasoning(package_, userContext) {
    const reasons = [];
    const components = package_.components || {};
    
    if (components.downloads > 0.7) {
      reasons.push('High download volume indicates strong community adoption');
    }
    
    if (components.rating > 0.8) {
      reasons.push('Excellent user ratings demonstrate quality');
    }
    
    if (components.trend > 0.6) {
      reasons.push('Strong growth trend suggests increasing popularity');
    }
    
    if (components.community > 0.7) {
      reasons.push('Active community engagement and contribution');
    }
    
    if (package_.adjustments?.relevance > 1.2) {
      reasons.push('High relevance to your technology stack and needs');
    }
    
    return reasons.join('; ') || 'Popular package with strong community metrics';
  }
  
  _categorizeTrend(package_) {
    const trendAnalysis = package_.trendAnalysis;
    
    if (!trendAnalysis) return 'unknown';
    
    if (trendAnalysis.lifecycle === 'emerging') return 'emerging';
    if (trendAnalysis.direction === 'rising' && trendAnalysis.strength > 0.7) return 'trending';
    if (trendAnalysis.direction === 'stable' && trendAnalysis.sustainability > 0.8) return 'established';
    if (trendAnalysis.direction === 'declining') return 'declining';
    
    return 'growing';
  }
  
  _calculateRecommendationStrength(package_, userContext) {
    const popularity = package_.popularityScore;
    const relevance = package_.adjustments?.relevance || 1.0;
    const trend = package_.trendAnalysis?.strength || 0.5;
    
    return (popularity * 0.5) + (relevance * 0.3) + (trend * 0.2);
  }
  
  _extractTechnologies(package_) {
    const technologies = [];
    
    if (package_.technology?.value) {
      technologies.push(package_.technology.value);
    }
    
    if (package_.framework?.value) {
      technologies.push(package_.framework.value);
    }
    
    return technologies;
  }
  
  _formatArrayForSparql(array) {
    return array.map(item => `"${item}"`).join(', ');
  }
  
  _getMinLastUpdated(recencyDays) {
    const date = new Date();
    date.setDate(date.getDate() - recencyDays);
    return date.toISOString();
  }
  
  async _getHistoricalPopularityData(packageInfo, startDate, endDate) {
    // Mock implementation - would fetch real historical data
    return {
      downloads: this._generateMockTimeSeries(startDate, endDate, 'downloads'),
      ratings: this._generateMockTimeSeries(startDate, endDate, 'ratings'),
      stars: this._generateMockTimeSeries(startDate, endDate, 'stars')
    };
  }
  
  _generateMockTimeSeries(startDate, endDate, metric) {
    const data = [];
    const current = new Date(startDate);
    
    while (current <= endDate) {
      data.push({
        date: new Date(current),
        value: Math.random() * 100 + (metric === 'ratings' ? 3.0 : 0)
      });
      current.setDate(current.getDate() + 1);
    }
    
    return data;
  }
  
  _calculateDetailedPopularityMetrics(packageInfo, historicalData) {
    return {
      currentMetrics: {
        downloads: historicalData.downloads[historicalData.downloads.length - 1]?.value || 0,
        rating: historicalData.ratings[historicalData.ratings.length - 1]?.value || 3.0,
        stars: historicalData.stars[historicalData.stars.length - 1]?.value || 0
      },
      trends: {
        downloadTrend: this._calculateTrendFromTimeSeries(historicalData.downloads),
        ratingTrend: this._calculateTrendFromTimeSeries(historicalData.ratings),
        starsTrend: this._calculateTrendFromTimeSeries(historicalData.stars)
      },
      volatility: {
        downloadVolatility: this._calculateVolatility(historicalData.downloads),
        ratingVolatility: this._calculateVolatility(historicalData.ratings)
      }
    };
  }
  
  _analyzePopularityTrend(historicalData) {
    return {
      overall: 'growing', // Mock value
      strength: 0.75,
      confidence: 0.8,
      inflectionPoints: [], // Would identify trend changes
      seasonality: this._detectSeasonality(historicalData.downloads)
    };
  }
  
  async _compareWithSimilarPackages(packageInfo) {
    // Mock comparison data
    return {
      rankInCategory: 5,
      totalInCategory: 50,
      percentile: 90,
      competitivePosition: 'strong'
    };
  }
  
  _projectFuturePopularity(historicalData, trendAnalysis) {
    // Simple linear projection
    const downloadTrend = this._calculateTrendFromTimeSeries(historicalData.downloads);
    const currentDownloads = historicalData.downloads[historicalData.downloads.length - 1]?.value || 0;
    
    return {
      nextMonth: currentDownloads * (1 + downloadTrend * 0.1),
      nextQuarter: currentDownloads * (1 + downloadTrend * 0.3),
      confidence: trendAnalysis.confidence || 0.5
    };
  }
  
  _generatePopularitySummary(metrics, trendAnalysis) {
    return {
      overallHealth: 'good', // Mock value
      keyStrengths: ['Strong download growth', 'Consistent ratings'],
      concerns: [],
      outlook: trendAnalysis.overall
    };
  }
  
  _calculateTrendFromTimeSeries(timeSeries) {
    if (timeSeries.length < 2) return 0;
    
    const first = timeSeries[0].value;
    const last = timeSeries[timeSeries.length - 1].value;
    
    return (last - first) / first;
  }
  
  _calculateVolatility(timeSeries) {
    if (timeSeries.length < 2) return 0;
    
    const values = timeSeries.map(point => point.value);
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    
    return Math.sqrt(variance) / mean; // Coefficient of variation
  }
  
  _detectSeasonality(timeSeries) {
    // Simple seasonality detection
    return {
      hasSeasonality: false, // Mock value
      period: null,
      strength: 0
    };
  }
  
  _interpretMarketMomentum(overallGrowth) {
    if (overallGrowth >= 0.3) return 'Very strong market momentum';
    if (overallGrowth >= 0.15) return 'Strong market momentum';
    if (overallGrowth >= 0.05) return 'Moderate market momentum';
    if (overallGrowth >= 0) return 'Stable market conditions';
    return 'Market slowdown detected';
  }
  
  _analyzeUserTechnologyTrends(categorized, userTechnologies) {
    const userTechTrends = [];
    
    userTechnologies.forEach(tech => {
      const trends = [...categorized.emerging, ...categorized.growing]
        .filter(trend => trend.technology?.value === tech);
      
      if (trends.length > 0) {
        userTechTrends.push({
          technology: tech,
          trend: trends[0].growthRate?.value || 0,
          status: trends[0].growthRate?.value >= 0.2 ? 'emerging' : 'growing'
        });
      }
    });
    
    return userTechTrends;
  }
  
  _generateTechTrendRecommendations(userTechTrends) {
    const recommendations = [];
    
    userTechTrends.forEach(techTrend => {
      if (techTrend.trend >= 0.3) {
        recommendations.push({
          type: 'leverage-growth',
          technology: techTrend.technology,
          recommendation: `${techTrend.technology} is showing strong growth - consider expanding usage`
        });
      }
    });
    
    return recommendations;
  }
}

export default PopularityTracker;