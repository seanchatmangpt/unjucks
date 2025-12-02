/**
 * KGEN Marketplace Insight & Recommendation Engine
 * 
 * SPARQL-powered recommendation system for marketplace intelligence
 * and personalized suggestions based on user context and usage patterns.
 */

import { SparqlQueryEngine } from './sparql-engine.js';
import { ComplianceRecommender } from './algorithms/compliance-recommender.js';
import { TemplateRecommender } from './algorithms/template-recommender.js';
import { ROIAnalyzer } from './algorithms/roi-analyzer.js';
import { SimilarityMatcher } from './algorithms/similarity-matcher.js';
import { PopularityTracker } from './algorithms/popularity-tracker.js';
import { ScoreCalculator } from './scoring/score-calculator.js';
import { InsightAggregator } from './insight-aggregator.js';
import { createLogger } from '../utils/logger.js';

/**
 * Main recommendation engine orchestrating all algorithms and insights
 */
export class MarketplaceRecommender {
  constructor(options = {}) {
    this.logger = createLogger('MarketplaceRecommender');
    this.sparqlEngine = new SparqlQueryEngine(options.endpoint);
    this.scoreCalculator = new ScoreCalculator();
    this.insightAggregator = new InsightAggregator();
    
    // Initialize recommendation algorithms
    this.algorithms = {
      compliance: new ComplianceRecommender(this.sparqlEngine),
      template: new TemplateRecommender(this.sparqlEngine),
      roi: new ROIAnalyzer(this.sparqlEngine),
      similarity: new SimilarityMatcher(this.sparqlEngine),
      popularity: new PopularityTracker(this.sparqlEngine)
    };
    
    this.cache = new Map();
    this.cacheTTL = options.cacheTimeout || 300000; // 5 minutes default
  }
  
  /**
   * Generate comprehensive recommendations for a user context
   * @param {Object} userContext - User's project context and preferences
   * @param {Object} options - Recommendation options
   * @returns {Promise<Object>} Recommendations with insights and scoring
   */
  async generateRecommendations(userContext, options = {}) {
    try {
      this.logger.info('Generating recommendations', { userContext, options });
      
      const cacheKey = this._generateCacheKey(userContext, options);
      const cached = this._getFromCache(cacheKey);
      if (cached && !options.forceRefresh) {
        this.logger.debug('Returning cached recommendations');
        return cached;
      }
      
      // Run all recommendation algorithms in parallel
      const [
        complianceRecs,
        templateRecs,
        roiAnalysis,
        similarityRecs,
        popularityRecs
      ] = await Promise.all([
        this.algorithms.compliance.recommend(userContext, options),
        this.algorithms.template.recommend(userContext, options),
        this.algorithms.roi.analyze(userContext, options),
        this.algorithms.similarity.recommend(userContext, options),
        this.algorithms.popularity.recommend(userContext, options)
      ]);
      
      // Aggregate and score all recommendations
      const aggregatedRecommendations = this.insightAggregator.aggregate([
        complianceRecs,
        templateRecs,
        similarityRecs,
        popularityRecs
      ]);
      
      // Calculate final scores and rank recommendations
      const scoredRecommendations = await this.scoreCalculator.scoreRecommendations(
        aggregatedRecommendations,
        userContext,
        roiAnalysis
      );
      
      // Generate insights from the recommendations
      const insights = await this._generateInsights(scoredRecommendations, userContext);
      
      const result = {
        recommendations: scoredRecommendations,
        insights,
        metadata: {
          userContext,
          generatedAt: new Date().toISOString(),
          algorithmsUsed: Object.keys(this.algorithms),
          totalRecommendations: scoredRecommendations.length,
          cacheKey
        }
      };
      
      this._setCache(cacheKey, result);
      this.logger.info('Generated recommendations', { 
        count: scoredRecommendations.length,
        topScore: scoredRecommendations[0]?.score 
      });
      
      return result;
      
    } catch (error) {
      this.logger.error('Failed to generate recommendations', error);
      throw new Error(`Recommendation generation failed: ${error.message}`);
    }
  }
  
  /**
   * Get specific insights for marketplace intelligence
   * @param {string} insightType - Type of insight to generate
   * @param {Object} context - Context for the insight
   * @returns {Promise<Object>} Generated insights
   */
  async getInsights(insightType, context = {}) {
    try {
      this.logger.info('Generating specific insights', { insightType, context });
      
      const insightGenerators = {
        'compliance-gaps': () => this.algorithms.compliance.findGaps(context),
        'template-matches': () => this.algorithms.template.findMatches(context),
        'roi-opportunities': () => this.algorithms.roi.findOpportunities(context),
        'market-trends': () => this.algorithms.popularity.getTrends(context),
        'data-exhaust': () => this._analyzeDataExhaust(context),
        'attestation-strength': () => this._analyzeAttestationStrength(context)
      };
      
      const generator = insightGenerators[insightType];
      if (!generator) {
        throw new Error(`Unknown insight type: ${insightType}`);
      }
      
      const insights = await generator();
      return {
        type: insightType,
        insights,
        context,
        generatedAt: new Date().toISOString()
      };
      
    } catch (error) {
      this.logger.error('Failed to generate insights', error);
      throw new Error(`Insight generation failed: ${error.message}`);
    }
  }
  
  /**
   * Get recommendations for specific use cases
   * @param {string} useCase - Specific use case for recommendations
   * @param {Object} context - Context for the use case
   * @returns {Promise<Array>} Filtered recommendations
   */
  async getUseCaseRecommendations(useCase, context = {}) {
    try {
      const useCaseMap = {
        'quick-start': { 
          filters: ['quickstart', 'beginner-friendly'], 
          limit: 5 
        },
        'enterprise-compliance': { 
          filters: ['enterprise', 'compliance', 'security'], 
          algorithms: ['compliance', 'roi'] 
        },
        'modernization': { 
          filters: ['modern', 'migration', 'upgrade'], 
          algorithms: ['template', 'similarity'] 
        },
        'cost-optimization': { 
          algorithms: ['roi'], 
          sortBy: 'roi_score' 
        },
        'best-practices': { 
          filters: ['best-practice', 'recommended'], 
          algorithms: ['popularity', 'similarity'] 
        }
      };
      
      const useCaseConfig = useCaseMap[useCase];
      if (!useCaseConfig) {
        throw new Error(`Unknown use case: ${useCase}`);
      }
      
      const options = {
        ...useCaseConfig,
        useCase
      };
      
      const recommendations = await this.generateRecommendations(context, options);
      return recommendations;
      
    } catch (error) {
      this.logger.error('Failed to get use case recommendations', error);
      throw error;
    }
  }
  
  /**
   * Analyze user's current project for recommendations
   * @param {Object} projectConfig - User's kgen.config.js or project structure
   * @returns {Promise<Object>} Project analysis with recommendations
   */
  async analyzeProject(projectConfig) {
    try {
      this.logger.info('Analyzing project for recommendations', { projectConfig });
      
      const analysis = {
        projectType: this._detectProjectType(projectConfig),
        technologies: this._extractTechnologies(projectConfig),
        complianceNeeds: this._analyzeComplianceNeeds(projectConfig),
        templateUsage: this._analyzeTemplateUsage(projectConfig),
        improvementAreas: []
      };
      
      // Generate context-aware recommendations
      const recommendations = await this.generateRecommendations({
        project: analysis,
        config: projectConfig
      });
      
      return {
        analysis,
        recommendations: recommendations.recommendations.slice(0, 10), // Top 10
        actionableInsights: this._generateActionableInsights(analysis, recommendations)
      };
      
    } catch (error) {
      this.logger.error('Failed to analyze project', error);
      throw error;
    }
  }
  
  /**
   * Generate insights from scored recommendations
   */
  async _generateInsights(recommendations, userContext) {
    const insights = {
      summary: {
        totalRecommendations: recommendations.length,
        averageScore: recommendations.reduce((sum, r) => sum + r.score, 0) / recommendations.length,
        topCategory: this._getTopCategory(recommendations),
        confidenceLevel: this._calculateConfidenceLevel(recommendations)
      },
      patterns: {
        dominantVerticals: this._analyzeDominantVerticals(recommendations),
        technologyTrends: this._analyzeTechnologyTrends(recommendations),
        complianceGaps: this._analyzeComplianceGaps(recommendations, userContext)
      },
      opportunities: {
        quickWins: recommendations.filter(r => r.metrics?.difficulty === 'low' && r.score > 0.7),
        highImpact: recommendations.filter(r => r.metrics?.impact === 'high'),
        costSavings: recommendations.filter(r => r.metrics?.roi > 0.5)
      },
      risks: {
        lowAdoption: recommendations.filter(r => r.metrics?.popularity < 0.3),
        highComplexity: recommendations.filter(r => r.metrics?.difficulty === 'high'),
        securityConcerns: recommendations.filter(r => r.metrics?.securityScore < 0.5)
      }
    };
    
    return insights;
  }
  
  /**
   * Analyze data exhaust for insights
   */
  async _analyzeDataExhaust(context) {
    const query = `
      SELECT ?pack ?dataType ?volume ?lastUpdated ?schema WHERE {
        ?pack a kgen:Package ;
              kgen:generatesData ?dataType ;
              kgen:dataVolume ?volume ;
              kgen:lastUpdated ?lastUpdated ;
              kgen:hasSchema ?schema .
        FILTER(?volume > 1000)
      }
      ORDER BY DESC(?volume)
      LIMIT 20
    `;
    
    const results = await this.sparqlEngine.query(query);
    return this._processDataExhaustResults(results);
  }
  
  /**
   * Analyze attestation strength across marketplace
   */
  async _analyzeAttestationStrength(context) {
    const query = `
      SELECT ?pack ?attestationType ?signatureStrength ?verificationStatus ?trustScore WHERE {
        ?pack a kgen:Package ;
              kgenattest:hasAttestation ?attestation .
        ?attestation a ?attestationType ;
                     kgenattest:hasSignature ?signature ;
                     kgenattest:verificationStatus ?verificationStatus .
        ?signature crypto:keySize ?keySize .
        BIND(IF(?keySize >= 2048, "strong", "weak") AS ?signatureStrength)
        BIND((?keySize / 4096.0) AS ?trustScore)
      }
      ORDER BY DESC(?trustScore)
    `;
    
    const results = await this.sparqlEngine.query(query);
    return this._processAttestationResults(results);
  }
  
  /**
   * Helper methods for analysis
   */
  _detectProjectType(config) {
    if (config.templates?.includes('microservice')) return 'microservices';
    if (config.templates?.includes('monolith')) return 'monolith';
    if (config.templates?.includes('serverless')) return 'serverless';
    if (config.compliance?.length > 0) return 'enterprise';
    return 'general';
  }
  
  _extractTechnologies(config) {
    const techs = new Set();
    
    // Extract from templates
    config.templates?.forEach(template => {
      if (template.includes('react')) techs.add('React');
      if (template.includes('node')) techs.add('Node.js');
      if (template.includes('python')) techs.add('Python');
      if (template.includes('java')) techs.add('Java');
      if (template.includes('docker')) techs.add('Docker');
      if (template.includes('k8s') || template.includes('kubernetes')) techs.add('Kubernetes');
    });
    
    // Extract from dependencies
    if (config.dependencies) {
      Object.keys(config.dependencies).forEach(dep => {
        if (dep.includes('express')) techs.add('Express.js');
        if (dep.includes('spring')) techs.add('Spring Boot');
        if (dep.includes('django')) techs.add('Django');
      });
    }
    
    return Array.from(techs);
  }
  
  _analyzeComplianceNeeds(config) {
    const needs = [];
    
    if (config.security?.enabled) needs.push('security');
    if (config.audit?.enabled) needs.push('audit');
    if (config.compliance?.includes('sox')) needs.push('SOX');
    if (config.compliance?.includes('gdpr')) needs.push('GDPR');
    if (config.compliance?.includes('hipaa')) needs.push('HIPAA');
    if (config.compliance?.includes('pci')) needs.push('PCI-DSS');
    
    return needs;
  }
  
  _analyzeTemplateUsage(config) {
    return {
      templateCount: config.templates?.length || 0,
      customTemplates: config.templates?.filter(t => t.includes('custom')).length || 0,
      standardTemplates: config.templates?.filter(t => !t.includes('custom')).length || 0,
      templateTypes: this._categorizeTemplates(config.templates || [])
    };
  }
  
  _categorizeTemplates(templates) {
    const categories = {};
    templates.forEach(template => {
      if (template.includes('api')) categories.api = (categories.api || 0) + 1;
      if (template.includes('ui')) categories.ui = (categories.ui || 0) + 1;
      if (template.includes('test')) categories.test = (categories.test || 0) + 1;
      if (template.includes('config')) categories.config = (categories.config || 0) + 1;
      if (template.includes('deploy')) categories.deployment = (categories.deployment || 0) + 1;
    });
    return categories;
  }
  
  _generateActionableInsights(analysis, recommendations) {
    const insights = [];
    
    // Template insights
    if (analysis.templateUsage.templateCount < 5) {
      insights.push({
        type: 'template_optimization',
        priority: 'high',
        message: 'Consider adopting more templates to improve development velocity',
        recommendation: recommendations.recommendations
          .filter(r => r.type === 'template')
          .slice(0, 3)
      });
    }
    
    // Compliance insights
    if (analysis.complianceNeeds.length === 0) {
      insights.push({
        type: 'compliance_gap',
        priority: 'medium',
        message: 'No compliance frameworks detected. Consider security and audit templates',
        recommendation: recommendations.recommendations
          .filter(r => r.categories?.includes('compliance'))
          .slice(0, 2)
      });
    }
    
    // Technology insights
    if (analysis.technologies.length > 10) {
      insights.push({
        type: 'technology_sprawl',
        priority: 'medium',
        message: 'High technology diversity detected. Consider standardization templates',
        recommendation: recommendations.recommendations
          .filter(r => r.categories?.includes('standardization'))
          .slice(0, 2)
      });
    }
    
    return insights;
  }
  
  _getTopCategory(recommendations) {
    const categories = {};
    recommendations.forEach(rec => {
      rec.categories?.forEach(cat => {
        categories[cat] = (categories[cat] || 0) + 1;
      });
    });
    return Object.entries(categories).sort(([,a], [,b]) => b - a)[0]?.[0];
  }
  
  _calculateConfidenceLevel(recommendations) {
    const avgScore = recommendations.reduce((sum, r) => sum + r.score, 0) / recommendations.length;
    const scoreVariance = recommendations.reduce((sum, r) => sum + Math.pow(r.score - avgScore, 2), 0) / recommendations.length;
    return Math.max(0, Math.min(1, avgScore - Math.sqrt(scoreVariance)));
  }
  
  _analyzeDominantVerticals(recommendations) {
    const verticals = {};
    recommendations.forEach(rec => {
      rec.vertical && (verticals[rec.vertical] = (verticals[rec.vertical] || 0) + 1);
    });
    return Object.entries(verticals).sort(([,a], [,b]) => b - a).slice(0, 5);
  }
  
  _analyzeTechnologyTrends(recommendations) {
    const techs = {};
    recommendations.forEach(rec => {
      rec.technologies?.forEach(tech => {
        techs[tech] = (techs[tech] || 0) + 1;
      });
    });
    return Object.entries(techs).sort(([,a], [,b]) => b - a).slice(0, 10);
  }
  
  _analyzeComplianceGaps(recommendations, userContext) {
    const userCompliance = new Set(userContext.compliance || []);
    const recommendedCompliance = new Set();
    
    recommendations.forEach(rec => {
      rec.compliance?.forEach(comp => recommendedCompliance.add(comp));
    });
    
    return Array.from(recommendedCompliance).filter(comp => !userCompliance.has(comp));
  }
  
  _processDataExhaustResults(results) {
    return results.map(result => ({
      package: result.pack.value,
      dataType: result.dataType.value,
      volume: parseInt(result.volume.value),
      lastUpdated: new Date(result.lastUpdated.value),
      schema: result.schema.value
    }));
  }
  
  _processAttestationResults(results) {
    return results.map(result => ({
      package: result.pack.value,
      attestationType: result.attestationType.value,
      signatureStrength: result.signatureStrength.value,
      verificationStatus: result.verificationStatus.value,
      trustScore: parseFloat(result.trustScore.value)
    }));
  }
  
  _generateCacheKey(userContext, options) {
    return Buffer.from(JSON.stringify({ userContext, options })).toString('base64');
  }
  
  _getFromCache(key) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }
  
  _setCache(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }
}

export default MarketplaceRecommender;