/**
 * Integration with KGEN CLI explore command
 * 
 * Provides actionable insights and recommendations
 * that can be directly used by the explore command.
 */

import { MarketplaceRecommender } from './insights/recommender.js';
import { createLogger } from './utils/logger.js';

export class ExploreIntegration {
  constructor(options = {}) {
    this.logger = createLogger('ExploreIntegration');
    this.recommender = new MarketplaceRecommender(options);
    
    // Command integration options
    this.integrationOptions = {
      maxRecommendations: 10,
      includeReasoning: true,
      includeMetrics: true,
      format: 'cli-friendly'
    };
  }
  
  /**
   * Get recommendations for the explore command
   * @param {Object} exploreContext - Context from explore command
   * @returns {Promise<Object>} CLI-friendly recommendations
   */
  async getExploreRecommendations(exploreContext) {
    try {
      this.logger.info('Getting explore recommendations', { exploreContext });
      
      // Transform explore context to recommendation context
      const recommendationContext = this._transformExploreContext(exploreContext);
      
      // Get recommendations from the engine
      const recommendations = await this.recommender.generateRecommendations(
        recommendationContext,
        this.integrationOptions
      );
      
      // Format for CLI consumption
      const cliFormattedRecs = this._formatForCLI(recommendations);
      
      // Generate actionable commands
      const actionableCommands = this._generateActionableCommands(cliFormattedRecs);
      
      return {
        recommendations: cliFormattedRecs,
        insights: recommendations.insights,
        actions: actionableCommands,
        summary: this._generateSummary(cliFormattedRecs),
        metadata: {
          generatedAt: new Date().toISOString(),
          context: exploreContext,
          engine: 'kgen-marketplace-insights'
        }
      };
      
    } catch (error) {
      this.logger.error('Failed to get explore recommendations', error);
      throw error;
    }
  }
  
  /**
   * Get specific insights for explore command
   * @param {string} insightType - Type of insight requested
   * @param {Object} context - Exploration context
   * @returns {Promise<Object>} Formatted insights
   */
  async getSpecificInsights(insightType, context) {
    try {
      const insights = await this.recommender.getInsights(insightType, context);
      
      return {
        type: insightType,
        insights: this._formatInsightsForCLI(insights),
        recommendations: this._extractActionableRecommendations(insights),
        visualization: this._generateVisualizationData(insights)
      };
      
    } catch (error) {
      this.logger.error('Failed to get specific insights', error);
      throw error;
    }
  }
  
  /**
   * Analyze current project configuration for recommendations
   * @param {Object} projectConfig - Current kgen.config.js
   * @param {Object} projectStructure - Project file structure
   * @returns {Promise<Object>} Project analysis with recommendations
   */
  async analyzeProject(projectConfig, projectStructure) {
    try {
      this.logger.info('Analyzing project for explore integration');
      
      const analysis = await this.recommender.analyzeProject(projectConfig);
      
      // Add project structure insights
      const structureInsights = this._analyzeProjectStructure(projectStructure);
      
      // Generate specific recommendations for explore command
      const exploreRecommendations = this._generateExploreSpecificRecommendations(
        analysis,
        structureInsights
      );
      
      return {
        analysis: analysis.analysis,
        recommendations: exploreRecommendations,
        quickActions: this._generateQuickActions(analysis),
        insights: this._generateProjectInsights(analysis, structureInsights),
        nextSteps: this._generateNextSteps(exploreRecommendations)
      };
      
    } catch (error) {
      this.logger.error('Failed to analyze project', error);
      throw error;
    }
  }
  
  /**
   * Generate CLI commands for implementing recommendations
   * @param {Array} recommendations - Recommendations to implement
   * @returns {Array} CLI commands
   */
  generateImplementationCommands(recommendations) {
    try {
      const commands = [];
      
      recommendations.forEach(rec => {
        const packageName = rec.name?.value || rec.package?.name;
        
        if (rec.type === 'template') {
          commands.push({
            command: `kgen add template ${packageName}`,
            description: `Add template: ${packageName}`,
            category: 'template',
            priority: rec.ranking?.tier || 'medium',
            estimatedTime: '2-5 minutes'
          });
        } else if (rec.type === 'compliance') {
          commands.push({
            command: `kgen add compliance-pack ${packageName}`,
            description: `Add compliance pack: ${packageName}`,
            category: 'compliance',
            priority: 'high',
            estimatedTime: '10-30 minutes'
          });
        } else if (rec.type === 'package') {
          commands.push({
            command: `kgen add package ${packageName}`,
            description: `Add package: ${packageName}`,
            category: 'general',
            priority: rec.ranking?.tier || 'medium',
            estimatedTime: '5-15 minutes'
          });
        }
        
        // Add configuration commands if needed
        if (rec.implementationGuide?.setupSteps) {
          commands.push({
            command: `kgen configure ${packageName}`,
            description: `Configure ${packageName} for your project`,
            category: 'configuration',
            priority: 'medium',
            estimatedTime: '5-10 minutes'
          });
        }
      });
      
      return commands;
      
    } catch (error) {
      this.logger.error('Failed to generate implementation commands', error);
      return [];
    }
  }
  
  /**
   * Get market intelligence for explore command
   * @param {Object} filters - Market analysis filters
   * @returns {Promise<Object>} Market intelligence data
   */
  async getMarketIntelligence(filters = {}) {
    try {
      const intelligence = await this.recommender.getInsights('market-trends', filters);
      
      return {
        trends: this._formatTrendsForCLI(intelligence.insights),
        opportunities: this._identifyMarketOpportunities(intelligence),
        recommendations: this._generateMarketRecommendations(intelligence),
        visualization: this._generateMarketVisualization(intelligence)
      };
      
    } catch (error) {
      this.logger.error('Failed to get market intelligence', error);
      throw error;
    }
  }
  
  /**
   * Transform explore context to recommendation context
   */
  _transformExploreContext(exploreContext) {
    const {
      projectType,
      technologies,
      industry,
      teamSize,
      urgency,
      currentPackages,
      painPoints,
      goals
    } = exploreContext;
    
    return {
      project: {
        projectType: projectType || 'web-app',
        technologies: technologies || [],
        existingTemplates: currentPackages?.templates || [],
        developmentStage: 'development' // Default assumption
      },
      industry: industry || 'technology',
      teamSize: teamSize || 'medium',
      urgency: urgency || 'normal',
      painPoints: painPoints || [],
      goals: goals || [],
      currentPackages: currentPackages?.packages || [],
      compliance: currentPackages?.compliance || []
    };
  }
  
  /**
   * Format recommendations for CLI display
   */
  _formatForCLI(recommendations) {
    return recommendations.recommendations.map(rec => ({
      name: rec.name?.value || 'Unknown Package',
      type: rec.type,
      score: Math.round((rec.score || 0) * 100),
      category: rec.category?.value || 'general',
      description: rec.description?.value || '',
      reasoning: rec.reasoning || '',
      priority: rec.ranking?.tier || 'medium',
      metrics: {
        downloads: rec.downloads?.value || 0,
        rating: rec.rating?.value || 0,
        trend: rec.trendCategory || 'stable'
      },
      implementation: {
        difficulty: rec.complexity?.value || 'medium',
        estimatedTime: this._estimateImplementationTime(rec),
        prerequisites: rec.implementationGuide?.prerequisites || []
      },
      uri: rec.pack?.value || rec.uri
    }));
  }
  
  /**
   * Generate actionable commands from recommendations
   */
  _generateActionableCommands(recommendations) {
    const commands = {
      immediate: [],
      planned: [],
      investigate: []
    };
    
    recommendations.forEach(rec => {
      const command = {
        action: `kgen add ${rec.type} ${rec.name}`,
        description: rec.description,
        reasoning: rec.reasoning,
        priority: rec.priority,
        estimatedTime: rec.implementation.estimatedTime
      };
      
      if (rec.priority === 'top' || rec.priority === 'high') {
        commands.immediate.push(command);
      } else if (rec.priority === 'medium') {
        commands.planned.push(command);
      } else {
        commands.investigate.push(command);
      }
    });
    
    return commands;
  }
  
  /**
   * Generate summary for CLI display
   */
  _generateSummary(recommendations) {
    const summary = {
      totalRecommendations: recommendations.length,
      byType: {},
      byPriority: {},
      topRecommendation: recommendations[0]?.name || 'None',
      averageScore: Math.round(
        recommendations.reduce((sum, rec) => sum + rec.score, 0) / recommendations.length
      )
    };
    
    // Count by type
    recommendations.forEach(rec => {
      summary.byType[rec.type] = (summary.byType[rec.type] || 0) + 1;
      summary.byPriority[rec.priority] = (summary.byPriority[rec.priority] || 0) + 1;
    });
    
    return summary;
  }
  
  /**
   * Format insights for CLI consumption
   */
  _formatInsightsForCLI(insights) {
    const formatted = {
      summary: insights.summary || {},
      keyFindings: [],
      recommendations: [],
      dataPoints: []
    };
    
    // Extract key findings
    if (insights.insights) {
      Object.entries(insights.insights).forEach(([key, value]) => {
        if (Array.isArray(value) && value.length > 0) {
          formatted.keyFindings.push({
            category: key,
            findings: value.slice(0, 3), // Top 3 findings
            count: value.length
          });
        }
      });
    }
    
    return formatted;
  }
  
  /**
   * Extract actionable recommendations from insights
   */
  _extractActionableRecommendations(insights) {
    const actionable = [];
    
    if (insights.insights?.quickWins) {
      actionable.push({
        type: 'quick-win',
        title: 'Quick Implementation Opportunities',
        items: insights.insights.quickWins.slice(0, 3),
        timeframe: 'immediate'
      });
    }
    
    if (insights.insights?.highImpact) {
      actionable.push({
        type: 'high-impact',
        title: 'High-Impact Opportunities',
        items: insights.insights.highImpact.slice(0, 3),
        timeframe: 'planned'
      });
    }
    
    return actionable;
  }
  
  /**
   * Generate visualization data for CLI charts/graphs
   */
  _generateVisualizationData(insights) {
    const visualization = {
      charts: [],
      metrics: [],
      trends: []
    };
    
    // Score distribution chart
    if (insights.insights?.scoreDistribution) {
      visualization.charts.push({
        type: 'bar',
        title: 'Recommendation Score Distribution',
        data: insights.insights.scoreDistribution
      });
    }
    
    // Technology trends
    if (insights.insights?.technologyTrends) {
      visualization.trends.push({
        type: 'technology',
        title: 'Technology Adoption Trends',
        data: insights.insights.technologyTrends.slice(0, 5)
      });
    }
    
    return visualization;
  }
  
  /**
   * Analyze project structure for additional insights
   */
  _analyzeProjectStructure(projectStructure) {
    if (!projectStructure) return {};
    
    const insights = {
      hasTests: false,
      hasDocumentation: false,
      hasCI: false,
      hasDocker: false,
      frameworksDetected: [],
      gaps: []
    };
    
    // Analyze file structure
    if (projectStructure.files) {
      insights.hasTests = projectStructure.files.some(file => 
        file.includes('test') || file.includes('spec')
      );
      insights.hasDocumentation = projectStructure.files.some(file => 
        file.includes('README') || file.includes('docs')
      );
      insights.hasCI = projectStructure.files.some(file => 
        file.includes('.github') || file.includes('.gitlab-ci')
      );
      insights.hasDocker = projectStructure.files.some(file => 
        file.includes('Dockerfile') || file.includes('docker-compose')
      );
    }
    
    // Identify gaps
    if (!insights.hasTests) insights.gaps.push('testing');
    if (!insights.hasDocumentation) insights.gaps.push('documentation');
    if (!insights.hasCI) insights.gaps.push('ci-cd');
    if (!insights.hasDocker) insights.gaps.push('containerization');
    
    return insights;
  }
  
  /**
   * Generate explore-specific recommendations
   */
  _generateExploreSpecificRecommendations(analysis, structureInsights) {
    const recommendations = [];
    
    // Add recommendations based on structure gaps
    structureInsights.gaps?.forEach(gap => {
      const gapRecommendations = this._getRecommendationsForGap(gap);
      recommendations.push(...gapRecommendations);
    });
    
    // Add top analysis recommendations
    if (analysis.recommendations) {
      recommendations.push(...analysis.recommendations.slice(0, 5));
    }
    
    return recommendations;
  }
  
  /**
   * Generate quick actions for immediate implementation
   */
  _generateQuickActions(analysis) {
    const actions = [];
    
    // Quick template additions
    if (analysis.actionableInsights) {
      analysis.actionableInsights.forEach(insight => {
        if (insight.type === 'template_optimization' && insight.recommendation) {
          actions.push({
            type: 'add-template',
            title: 'Add Development Templates',
            commands: insight.recommendation.map(rec => `kgen add template ${rec.name}`),
            estimatedTime: '5 minutes'
          });
        }
      });
    }
    
    return actions;
  }
  
  /**
   * Generate project-specific insights
   */
  _generateProjectInsights(analysis, structureInsights) {
    const insights = [];
    
    if (structureInsights.gaps?.length > 0) {
      insights.push({
        type: 'project-gaps',
        title: 'Project Structure Gaps',
        description: `Missing: ${structureInsights.gaps.join(', ')}`,
        recommendations: structureInsights.gaps.map(gap => 
          `Consider adding ${gap} to improve project quality`
        )
      });
    }
    
    if (analysis.analysis?.templateUsage?.templateCount < 5) {
      insights.push({
        type: 'template-opportunity',
        title: 'Template Usage Opportunity',
        description: 'Low template usage detected',
        recommendations: ['Add more templates to improve development velocity']
      });
    }
    
    return insights;
  }
  
  /**
   * Generate next steps based on recommendations
   */
  _generateNextSteps(recommendations) {
    const steps = [];
    
    if (recommendations.length > 0) {
      const topRec = recommendations[0];
      steps.push({
        step: 1,
        action: `Implement ${topRec.name || 'top recommendation'}`,
        description: topRec.reasoning || 'High-priority recommendation',
        command: `kgen add ${topRec.type} ${topRec.name}`,
        estimatedTime: '10-15 minutes'
      });
    }
    
    if (recommendations.length > 1) {
      steps.push({
        step: 2,
        action: 'Evaluate additional recommendations',
        description: `Review ${recommendations.length - 1} other recommendations`,
        command: 'kgen explore --show-all',
        estimatedTime: '5-10 minutes'
      });
    }
    
    steps.push({
      step: 3,
      action: 'Monitor and iterate',
      description: 'Track implementation success and get updated recommendations',
      command: 'kgen explore --refresh',
      estimatedTime: 'Ongoing'
    });
    
    return steps;
  }
  
  /**
   * Get recommendations for specific gaps
   */
  _getRecommendationsForGap(gap) {
    const gapRecommendations = {
      testing: [
        { name: 'jest-template', type: 'template', priority: 'high' },
        { name: 'testing-utilities', type: 'package', priority: 'medium' }
      ],
      documentation: [
        { name: 'docs-template', type: 'template', priority: 'medium' },
        { name: 'api-docs-generator', type: 'package', priority: 'medium' }
      ],
      'ci-cd': [
        { name: 'github-actions-template', type: 'template', priority: 'high' },
        { name: 'deployment-pipeline', type: 'package', priority: 'high' }
      ],
      containerization: [
        { name: 'docker-template', type: 'template', priority: 'medium' },
        { name: 'kubernetes-config', type: 'package', priority: 'low' }
      ]
    };
    
    return gapRecommendations[gap] || [];
  }
  
  /**
   * Estimate implementation time for a recommendation
   */
  _estimateImplementationTime(recommendation) {
    const complexity = recommendation.complexity?.value || 'medium';
    const type = recommendation.type;
    
    const timeEstimates = {
      template: { low: '2-5 min', medium: '5-10 min', high: '10-20 min' },
      package: { low: '5-10 min', medium: '10-20 min', high: '20-45 min' },
      compliance: { low: '15-30 min', medium: '30-60 min', high: '1-3 hours' }
    };
    
    return timeEstimates[type]?.[complexity] || '10-20 min';
  }
  
  /**
   * Format trends for CLI display
   */
  _formatTrendsForCLI(trends) {
    return {
      emerging: trends.filter(t => t.category === 'emerging').slice(0, 5),
      declining: trends.filter(t => t.category === 'declining').slice(0, 3),
      stable: trends.filter(t => t.category === 'stable').slice(0, 5)
    };
  }
  
  /**
   * Identify market opportunities
   */
  _identifyMarketOpportunities(intelligence) {
    const opportunities = [];
    
    if (intelligence.insights?.emerging) {
      opportunities.push({
        type: 'emerging-technology',
        title: 'Emerging Technology Opportunities',
        items: intelligence.insights.emerging.slice(0, 3),
        risk: 'medium',
        potential: 'high'
      });
    }
    
    return opportunities;
  }
  
  /**
   * Generate market-based recommendations
   */
  _generateMarketRecommendations(intelligence) {
    const recommendations = [];
    
    // Add recommendations based on market trends
    if (intelligence.insights?.trends) {
      recommendations.push({
        type: 'market-alignment',
        title: 'Align with Market Trends',
        description: 'Consider adopting trending technologies and patterns',
        actions: intelligence.insights.trends.slice(0, 3).map(trend => 
          `Explore ${trend.name} packages and templates`
        )
      });
    }
    
    return recommendations;
  }
  
  /**
   * Generate market visualization data
   */
  _generateMarketVisualization(intelligence) {
    return {
      trends: {
        type: 'line',
        title: 'Market Trends Over Time',
        data: intelligence.insights?.trends || []
      },
      adoption: {
        type: 'pie',
        title: 'Technology Adoption Distribution',
        data: intelligence.insights?.adoption || []
      }
    };
  }
}

export default ExploreIntegration;