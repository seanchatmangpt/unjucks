/**
 * Compliance Recommendation Algorithm
 * 
 * Analyzes user's industry vertical, current compliance state,
 * and recommends high-ROI compliance packs for risk mitigation.
 */

import { createLogger } from '../../utils/logger.js';

export class ComplianceRecommender {
  constructor(sparqlEngine) {
    this.sparqlEngine = sparqlEngine;
    this.logger = createLogger('ComplianceRecommender');
    
    // Industry-specific compliance priorities
    this.industryMappings = {
      'financial': ['SOX', 'PCI-DSS', 'GDPR', 'BASEL-III'],
      'healthcare': ['HIPAA', 'GDPR', 'FDA-21CFR11', 'HITECH'],
      'retail': ['PCI-DSS', 'GDPR', 'CCPA', 'SOX'],
      'government': ['FedRAMP', 'FISMA', 'NIST', 'SOC2'],
      'technology': ['SOC2', 'GDPR', 'CCPA', 'ISO27001'],
      'manufacturing': ['ISO27001', 'GDPR', 'SOX', 'ITAR'],
      'energy': ['NERC-CIP', 'ISO27001', 'GDPR', 'SOX']
    };
    
    // Risk severity mappings
    this.riskLevels = {
      'critical': { weight: 1.0, priority: 'immediate' },
      'high': { weight: 0.8, priority: 'urgent' },
      'medium': { weight: 0.6, priority: 'moderate' },
      'low': { weight: 0.4, priority: 'future' }
    };
  }
  
  /**
   * Generate compliance recommendations for user context
   * @param {Object} userContext - User's industry, current compliance, etc.
   * @param {Object} options - Recommendation options
   * @returns {Promise<Array>} Compliance recommendations
   */
  async recommend(userContext, options = {}) {
    try {
      this.logger.info('Generating compliance recommendations', { userContext });
      
      const {
        industry = 'technology',
        currentCompliance = [],
        riskTolerance = 'medium',
        budget = null,
        timeline = '6months'
      } = userContext;
      
      // Get compliance gaps
      const gaps = await this.findGaps({
        industry,
        currentCompliance,
        riskTolerance
      });
      
      // Get recommended compliance packs
      const recommendations = await this.sparqlEngine.executeNamedQuery('findComplianceGaps', {
        userIndustry: industry,
        limit: options.limit || 20
      });
      
      // Score and prioritize recommendations
      const scoredRecommendations = recommendations.map(rec => {
        const score = this._calculateComplianceScore(rec, userContext, gaps);
        return {
          ...rec,
          type: 'compliance',
          score,
          reasoning: this._generateReasoning(rec, userContext, gaps),
          priority: this._calculatePriority(rec, gaps),
          implementationGuide: this._generateImplementationGuide(rec, userContext)
        };
      });
      
      // Filter and sort by score
      return scoredRecommendations
        .filter(rec => rec.score > 0.3)
        .sort((a, b) => b.score - a.score)
        .slice(0, options.limit || 10);
        
    } catch (error) {
      this.logger.error('Failed to generate compliance recommendations', error);
      throw error;
    }
  }
  
  /**
   * Find compliance gaps in user's current setup
   * @param {Object} context - User context
   * @returns {Promise<Object>} Identified gaps
   */
  async findGaps(context) {
    try {
      const { industry, currentCompliance = [], riskTolerance } = context;
      
      // Get industry-required compliance frameworks
      const requiredFrameworks = this.industryMappings[industry] || [];
      
      // Find missing frameworks
      const missingFrameworks = requiredFrameworks.filter(
        framework => !currentCompliance.includes(framework)
      );
      
      // Analyze risk exposure
      const riskAnalysis = await this._analyzeRiskExposure(context);
      
      // Get regulatory requirements
      const regulations = await this._getRegulatoryRequirements(industry);
      
      return {
        missingFrameworks,
        riskExposure: riskAnalysis,
        regulatoryGaps: regulations.filter(reg => !this._isCompliant(reg, currentCompliance)),
        criticalGaps: missingFrameworks.filter(fw => this._isCritical(fw, industry)),
        recommendedActions: this._generateGapActions(missingFrameworks, riskTolerance)
      };
      
    } catch (error) {
      this.logger.error('Failed to find compliance gaps', error);
      throw error;
    }
  }
  
  /**
   * Get compliance opportunities with ROI analysis
   * @param {Object} context - User context
   * @returns {Promise<Array>} Compliance opportunities
   */
  async getOpportunities(context) {
    try {
      const gaps = await this.findGaps(context);
      const opportunities = [];
      
      // High-ROI quick wins
      for (const framework of gaps.missingFrameworks) {
        const roi = await this._calculateComplianceROI(framework, context);
        if (roi.paybackMonths <= 12 && roi.riskReduction > 0.6) {
          opportunities.push({
            type: 'quick-win',
            framework,
            roi,
            effort: 'low',
            impact: 'high'
          });
        }
      }
      
      // Critical risk mitigation
      for (const criticalGap of gaps.criticalGaps) {
        opportunities.push({
          type: 'risk-mitigation',
          framework: criticalGap,
          urgency: 'critical',
          consequences: this._getConsequences(criticalGap, context.industry)
        });
      }
      
      // Regulatory deadlines
      const upcomingDeadlines = await this._getUpcomingDeadlines(context.industry);
      for (const deadline of upcomingDeadlines) {
        if (!context.currentCompliance.includes(deadline.framework)) {
          opportunities.push({
            type: 'regulatory-deadline',
            framework: deadline.framework,
            deadline: deadline.date,
            penalties: deadline.penalties
          });
        }
      }
      
      return opportunities.sort((a, b) => this._prioritizeOpportunity(b) - this._prioritizeOpportunity(a));
      
    } catch (error) {
      this.logger.error('Failed to get compliance opportunities', error);
      throw error;
    }
  }
  
  /**
   * Calculate compliance score for a recommendation
   */
  _calculateComplianceScore(recommendation, userContext, gaps) {
    let score = 0;
    
    // Industry relevance (0-0.3)
    const industryMatch = this._calculateIndustryMatch(recommendation, userContext.industry);
    score += industryMatch * 0.3;
    
    // Gap coverage (0-0.4)
    const gapCoverage = this._calculateGapCoverage(recommendation, gaps);
    score += gapCoverage * 0.4;
    
    // ROI potential (0-0.2)
    const roiScore = parseFloat(recommendation.roi?.value || 0) / 100;
    score += Math.min(roiScore, 1.0) * 0.2;
    
    // Implementation feasibility (0-0.1)
    const feasibility = this._calculateFeasibility(recommendation, userContext);
    score += feasibility * 0.1;
    
    return Math.min(score, 1.0);
  }
  
  /**
   * Calculate industry match score
   */
  _calculateIndustryMatch(recommendation, industry) {
    const frameworksForIndustry = this.industryMappings[industry] || [];
    const recFramework = recommendation.complianceFramework?.value;
    
    if (frameworksForIndustry.includes(recFramework)) {
      return 1.0;
    }
    
    // Partial matches for related frameworks
    const partialMatches = {
      'GDPR': ['CCPA', 'PIPEDA'],
      'SOX': ['SOC2', 'COSO'],
      'HIPAA': ['HITECH', 'FDA-21CFR11'],
      'PCI-DSS': ['ISO27001', 'SOC2']
    };
    
    for (const [primary, related] of Object.entries(partialMatches)) {
      if (frameworksForIndustry.includes(primary) && related.includes(recFramework)) {
        return 0.6;
      }
    }
    
    return 0.2; // Generic compliance value
  }
  
  /**
   * Calculate gap coverage score
   */
  _calculateGapCoverage(recommendation, gaps) {
    const recFramework = recommendation.complianceFramework?.value;
    
    if (gaps.criticalGaps.includes(recFramework)) {
      return 1.0;
    }
    
    if (gaps.missingFrameworks.includes(recFramework)) {
      return 0.8;
    }
    
    // Check if it addresses regulatory gaps
    const addressesRegulatory = gaps.regulatoryGaps.some(gap => 
      gap.frameworks.includes(recFramework)
    );
    
    return addressesRegulatory ? 0.6 : 0.2;
  }
  
  /**
   * Calculate implementation feasibility
   */
  _calculateFeasibility(recommendation, userContext) {
    const complexity = recommendation.complexity?.value || 'medium';
    const timeframe = userContext.timeline || '6months';
    const budget = userContext.budget;
    
    let feasibility = 0.5; // baseline
    
    // Complexity factor
    if (complexity === 'low') feasibility += 0.3;
    else if (complexity === 'high') feasibility -= 0.2;
    
    // Timeline factor
    if (timeframe === '3months' && complexity === 'high') feasibility -= 0.3;
    if (timeframe === '12months' && complexity === 'low') feasibility += 0.2;
    
    // Budget factor
    if (budget && recommendation.cost) {
      const costRatio = parseFloat(recommendation.cost.value) / budget;
      if (costRatio <= 0.5) feasibility += 0.2;
      else if (costRatio >= 1.0) feasibility -= 0.3;
    }
    
    return Math.max(0, Math.min(1, feasibility));
  }
  
  /**
   * Generate reasoning for recommendation
   */
  _generateReasoning(recommendation, userContext, gaps) {
    const reasons = [];
    const framework = recommendation.complianceFramework?.value;
    
    if (gaps.criticalGaps.includes(framework)) {
      reasons.push(`Critical compliance gap for ${userContext.industry} industry`);
    }
    
    if (gaps.missingFrameworks.includes(framework)) {
      reasons.push(`Industry standard compliance framework`);
    }
    
    const roi = parseFloat(recommendation.roi?.value || 0);
    if (roi > 50) {
      reasons.push(`High ROI potential (${roi}%)`);
    }
    
    const priority = recommendation.priority?.value;
    if (priority === 'high') {
      reasons.push('High regulatory priority');
    }
    
    return reasons.join('; ');
  }
  
  /**
   * Calculate priority level
   */
  _calculatePriority(recommendation, gaps) {
    const framework = recommendation.complianceFramework?.value;
    
    if (gaps.criticalGaps.includes(framework)) {
      return 'critical';
    }
    
    if (gaps.missingFrameworks.includes(framework)) {
      return 'high';
    }
    
    const riskLevel = recommendation.priority?.value || 'medium';
    return riskLevel;
  }
  
  /**
   * Generate implementation guide
   */
  _generateImplementationGuide(recommendation, userContext) {
    const framework = recommendation.complianceFramework?.value;
    
    return {
      framework,
      estimatedTimeline: this._estimateTimeline(recommendation, userContext),
      keySteps: this._getImplementationSteps(framework),
      resources: this._getRequiredResources(framework),
      risks: this._getImplementationRisks(framework),
      successCriteria: this._getSuccessCriteria(framework)
    };
  }
  
  /**
   * Helper methods for compliance analysis
   */
  async _analyzeRiskExposure(context) {
    // Mock implementation - would integrate with risk assessment tools
    return {
      dataPrivacy: context.currentCompliance.includes('GDPR') ? 'low' : 'high',
      financial: context.currentCompliance.includes('SOX') ? 'low' : 'medium',
      security: context.currentCompliance.includes('SOC2') ? 'low' : 'high'
    };
  }
  
  async _getRegulatoryRequirements(industry) {
    // Mock implementation - would query regulatory database
    const requirements = {
      'financial': [
        { framework: 'SOX', deadline: '2024-12-31', mandatory: true },
        { framework: 'PCI-DSS', deadline: '2024-06-30', mandatory: true }
      ],
      'healthcare': [
        { framework: 'HIPAA', deadline: null, mandatory: true },
        { framework: 'HITECH', deadline: null, mandatory: true }
      ]
    };
    
    return requirements[industry] || [];
  }
  
  _isCompliant(requirement, currentCompliance) {
    return currentCompliance.includes(requirement.framework);
  }
  
  _isCritical(framework, industry) {
    const criticalMappings = {
      'financial': ['SOX', 'PCI-DSS'],
      'healthcare': ['HIPAA'],
      'government': ['FedRAMP'],
      'retail': ['PCI-DSS']
    };
    
    return criticalMappings[industry]?.includes(framework) || false;
  }
  
  _generateGapActions(gaps, riskTolerance) {
    return gaps.map(gap => ({
      framework: gap,
      action: 'implement',
      urgency: this._calculateUrgency(gap, riskTolerance),
      effort: this._estimateEffort(gap)
    }));
  }
  
  async _calculateComplianceROI(framework, context) {
    // Mock ROI calculation - would use industry data
    return {
      paybackMonths: 8,
      riskReduction: 0.75,
      costSavings: 150000,
      implementationCost: 50000
    };
  }
  
  _getConsequences(framework, industry) {
    const consequences = {
      'SOX': ['SEC penalties', 'Executive liability', 'Audit findings'],
      'GDPR': ['Fines up to 4% revenue', 'Reputation damage', 'Customer loss'],
      'HIPAA': ['Civil penalties', 'Criminal charges', 'Patient trust loss'],
      'PCI-DSS': ['Fines from card brands', 'Increased transaction fees', 'Business suspension']
    };
    
    return consequences[framework] || ['Regulatory penalties', 'Business risk'];
  }
  
  async _getUpcomingDeadlines(industry) {
    // Mock deadline data - would query regulatory calendar
    return [
      {
        framework: 'GDPR',
        date: '2024-05-25',
        penalties: 'Up to 4% of annual revenue'
      }
    ];
  }
  
  _prioritizeOpportunity(opportunity) {
    const weights = {
      'quick-win': 0.8,
      'risk-mitigation': 1.0,
      'regulatory-deadline': 0.9
    };
    
    return weights[opportunity.type] || 0.5;
  }
  
  _estimateTimeline(recommendation, userContext) {
    const complexity = recommendation.complexity?.value || 'medium';
    const timelines = {
      'low': '2-4 months',
      'medium': '4-8 months',
      'high': '8-12 months'
    };
    
    return timelines[complexity];
  }
  
  _getImplementationSteps(framework) {
    const steps = {
      'SOX': [
        'Document internal controls',
        'Implement change management',
        'Setup audit trails',
        'Train personnel',
        'Conduct compliance testing'
      ],
      'GDPR': [
        'Data mapping and inventory',
        'Privacy impact assessments',
        'Consent management implementation',
        'Data subject rights processes',
        'Breach notification procedures'
      ]
    };
    
    return steps[framework] || ['Assessment', 'Planning', 'Implementation', 'Testing', 'Certification'];
  }
  
  _getRequiredResources(framework) {
    return {
      personnel: ['Compliance officer', 'Technical lead', 'Legal counsel'],
      tools: ['Compliance management platform', 'Audit tools', 'Training materials'],
      budget: '$50,000 - $150,000'
    };
  }
  
  _getImplementationRisks(framework) {
    return [
      'Resource availability',
      'Technical complexity',
      'Change management resistance',
      'Regulatory interpretation changes'
    ];
  }
  
  _getSuccessCriteria(framework) {
    return [
      'Audit readiness',
      'Risk reduction metrics',
      'Process compliance scores',
      'Staff certification completion'
    ];
  }
  
  _calculateUrgency(gap, riskTolerance) {
    if (riskTolerance === 'low') return 'immediate';
    if (riskTolerance === 'high') return 'moderate';
    return 'urgent';
  }
  
  _estimateEffort(gap) {
    const effortMap = {
      'GDPR': 'high',
      'SOX': 'high',
      'SOC2': 'medium',
      'PCI-DSS': 'medium',
      'HIPAA': 'high'
    };
    
    return effortMap[gap] || 'medium';
  }
}

export default ComplianceRecommender;