/**
 * ROI Analysis Algorithm
 * 
 * Calculates return on investment for marketplace packages
 * considering implementation costs, time savings, and business value.
 */

import { createLogger } from '../../utils/logger.js';

export class ROIAnalyzer {
  constructor(sparqlEngine) {
    this.sparqlEngine = sparqlEngine;
    this.logger = createLogger('ROIAnalyzer');
    
    // Industry-specific hourly rates and cost factors
    this.industryRates = {
      'financial': { hourlyRate: 200, qualityMultiplier: 1.3, riskMultiplier: 0.8 },
      'healthcare': { hourlyRate: 180, qualityMultiplier: 1.4, riskMultiplier: 0.7 },
      'technology': { hourlyRate: 150, qualityMultiplier: 1.1, riskMultiplier: 1.0 },
      'retail': { hourlyRate: 130, qualityMultiplier: 1.0, riskMultiplier: 1.1 },
      'manufacturing': { hourlyRate: 140, qualityMultiplier: 1.1, riskMultiplier: 0.9 },
      'government': { hourlyRate: 120, qualityMultiplier: 1.2, riskMultiplier: 0.8 },
      'education': { hourlyRate: 100, qualityMultiplier: 1.0, riskMultiplier: 1.2 }
    };
    
    // Cost categories and their typical impact
    this.costCategories = {
      'development': { weight: 0.4, variability: 'high' },
      'maintenance': { weight: 0.3, variability: 'medium' },
      'training': { weight: 0.15, variability: 'low' },
      'licensing': { weight: 0.1, variability: 'low' },
      'support': { weight: 0.05, variability: 'medium' }
    };
  }
  
  /**
   * Analyze ROI opportunities for user context
   * @param {Object} userContext - User's project and business context
   * @param {Object} options - Analysis options
   * @returns {Promise<Object>} ROI analysis results
   */
  async analyze(userContext, options = {}) {
    try {
      this.logger.info('Analyzing ROI opportunities', { userContext });
      
      const {
        industry = 'technology',
        budget = null,
        timeframe = '12months',
        hourlyRate = null,
        teamSize = 5,
        projectComplexity = 'medium'
      } = userContext;
      
      // Get ROI data from SPARQL
      const roiOpportunities = await this.sparqlEngine.executeNamedQuery('identifyROI', {
        userHourlyRate: hourlyRate || this.industryRates[industry]?.hourlyRate || 150,
        userTechnologies: this._formatArrayForSparql(userContext.technologies || []),
        userPainPoints: this._formatArrayForSparql(userContext.painPoints || []),
        minROI: options.minROI || 25, // 25% minimum ROI
        maxPaybackMonths: options.maxPaybackMonths || 18,
        limit: options.limit || 30
      });
      
      // Perform detailed ROI analysis
      const detailedAnalysis = await Promise.all(
        roiOpportunities.map(opportunity => this._performDetailedROI(opportunity, userContext))
      );
      
      // Generate insights and recommendations
      const insights = this._generateROIInsights(detailedAnalysis, userContext);
      const prioritization = this._prioritizeOpportunities(detailedAnalysis, userContext);
      
      return {
        opportunities: detailedAnalysis,
        insights,
        prioritization,
        summary: this._generateSummary(detailedAnalysis, userContext),
        metadata: {
          analysisDate: new Date().toISOString(),
          assumedHourlyRate: hourlyRate || this.industryRates[industry]?.hourlyRate || 150,
          timeframe,
          criteria: {
            minROI: options.minROI || 25,
            maxPaybackMonths: options.maxPaybackMonths || 18
          }
        }
      };
      
    } catch (error) {
      this.logger.error('Failed to analyze ROI', error);
      throw error;
    }
  }
  
  /**
   * Find high-ROI opportunities based on specific criteria
   * @param {Object} context - Analysis context
   * @returns {Promise<Array>} High-ROI opportunities
   */
  async findOpportunities(context) {
    try {
      const analysis = await this.analyze(context, {
        minROI: 50, // Higher threshold for "opportunities"
        maxPaybackMonths: 12
      });
      
      return analysis.opportunities
        .filter(opp => opp.roi.percentage >= 50)
        .filter(opp => opp.payback.months <= 12)
        .sort((a, b) => b.roi.percentage - a.roi.percentage)
        .slice(0, 10);
        
    } catch (error) {
      this.logger.error('Failed to find ROI opportunities', error);
      throw error;
    }
  }
  
  /**
   * Calculate detailed ROI for a specific package
   * @param {Object} packageInfo - Package information
   * @param {Object} userContext - User context
   * @returns {Promise<Object>} Detailed ROI analysis
   */
  async calculatePackageROI(packageInfo, userContext) {
    try {
      const roiData = await this._performDetailedROI(packageInfo, userContext);
      
      // Add sensitivity analysis
      const sensitivityAnalysis = this._performSensitivityAnalysis(roiData, userContext);
      
      // Add risk assessment
      const riskAssessment = this._assessROIRisk(roiData, userContext);
      
      return {
        ...roiData,
        sensitivityAnalysis,
        riskAssessment,
        recommendation: this._generateROIRecommendation(roiData, riskAssessment)
      };
      
    } catch (error) {
      this.logger.error('Failed to calculate package ROI', error);
      throw error;
    }
  }
  
  /**
   * Perform detailed ROI calculation
   */
  async _performDetailedROI(opportunity, userContext) {
    const {
      industry = 'technology',
      hourlyRate = null,
      teamSize = 5
    } = userContext;
    
    const effectiveRate = hourlyRate || this.industryRates[industry]?.hourlyRate || 150;
    
    // Extract values from SPARQL results
    const timeSavings = parseFloat(opportunity.timeSavings?.value || 0);
    const costSavings = parseFloat(opportunity.costSavings?.value || 0);
    const paybackPeriod = parseFloat(opportunity.paybackPeriod?.value || 12);
    const confidence = parseFloat(opportunity.confidenceScore?.value || 0.5);
    
    // Calculate costs
    const costs = this._calculateTotalCosts(opportunity, userContext);
    
    // Calculate benefits
    const benefits = this._calculateTotalBenefits(opportunity, userContext, effectiveRate);
    
    // Calculate ROI metrics
    const roi = this._calculateROIMetrics(costs, benefits, paybackPeriod);
    
    // Calculate risk-adjusted values
    const riskAdjustment = this._calculateRiskAdjustment(opportunity, userContext);
    
    return {
      package: {
        name: opportunity.name?.value,
        uri: opportunity.pack?.value,
        category: opportunity.category?.value
      },
      costs,
      benefits,
      roi: {
        ...roi,
        riskAdjusted: {
          percentage: roi.percentage * riskAdjustment.factor,
          netValue: roi.netValue * riskAdjustment.factor
        }
      },
      payback: {
        months: paybackPeriod,
        breakEvenPoint: costs.total / (benefits.monthly || 1)
      },
      confidence: {
        score: confidence,
        level: confidence >= 0.8 ? 'high' : confidence >= 0.6 ? 'medium' : 'low',
        factors: this._identifyConfidenceFactors(opportunity, userContext)
      },
      assumptions: this._documentAssumptions(opportunity, userContext, effectiveRate),
      timeline: this._generateTimeline(opportunity, userContext)
    };
  }
  
  /**
   * Calculate total implementation and ongoing costs
   */
  _calculateTotalCosts(opportunity, userContext) {
    const baseCosts = {
      licensing: this._estimateLicensingCosts(opportunity, userContext),
      implementation: this._estimateImplementationCosts(opportunity, userContext),
      training: this._estimateTrainingCosts(opportunity, userContext),
      maintenance: this._estimateMaintenanceCosts(opportunity, userContext),
      support: this._estimateSupportCosts(opportunity, userContext)
    };
    
    const total = Object.values(baseCosts).reduce((sum, cost) => sum + cost, 0);
    
    return {
      ...baseCosts,
      total,
      breakdown: this._generateCostBreakdown(baseCosts),
      monthly: total / 12 // Assuming 12-month analysis period
    };
  }
  
  /**
   * Calculate total benefits and value
   */
  _calculateTotalBenefits(opportunity, userContext, hourlyRate) {
    const timeSavings = parseFloat(opportunity.timeSavings?.value || 0);
    const costSavings = parseFloat(opportunity.costSavings?.value || 0);
    
    const benefits = {
      timeSavings: {
        hours: timeSavings,
        value: timeSavings * hourlyRate
      },
      qualityImprovement: this._estimateQualityBenefits(opportunity, userContext),
      riskReduction: this._estimateRiskReductionBenefits(opportunity, userContext),
      scalabilityGains: this._estimateScalabilityBenefits(opportunity, userContext),
      directCostSavings: costSavings
    };
    
    const totalValue = Object.values(benefits).reduce((sum, benefit) => {
      return sum + (typeof benefit === 'object' ? benefit.value : benefit);
    }, 0);
    
    return {
      ...benefits,
      total: totalValue,
      monthly: totalValue / 12,
      breakdown: this._generateBenefitBreakdown(benefits)
    };
  }
  
  /**
   * Calculate ROI metrics
   */
  _calculateROIMetrics(costs, benefits, paybackPeriod) {
    const netValue = benefits.total - costs.total;
    const percentage = costs.total > 0 ? (netValue / costs.total) * 100 : 0;
    
    return {
      percentage,
      netValue,
      costBenefitRatio: costs.total > 0 ? benefits.total / costs.total : 0,
      annualValue: netValue, // Assuming 12-month analysis
      npv: this._calculateNPV(costs, benefits, paybackPeriod),
      irr: this._calculateIRR(costs, benefits, paybackPeriod)
    };
  }
  
  /**
   * Calculate risk adjustment factor
   */
  _calculateRiskAdjustment(opportunity, userContext) {
    const adoptionRisk = parseFloat(opportunity.adoptionRisk?.value || 0.5);
    const industryMultiplier = this.industryRates[userContext.industry]?.riskMultiplier || 1.0;
    const confidenceScore = parseFloat(opportunity.confidenceScore?.value || 0.5);
    
    const riskFactor = (1 - adoptionRisk) * industryMultiplier * confidenceScore;
    
    return {
      factor: Math.max(0.3, Math.min(1.0, riskFactor)),
      components: {
        adoptionRisk,
        industryMultiplier,
        confidenceScore
      },
      rationale: this._generateRiskRationale(adoptionRisk, industryMultiplier, confidenceScore)
    };
  }
  
  /**
   * Generate ROI insights
   */
  _generateROIInsights(opportunities, userContext) {
    const insights = {
      topOpportunities: opportunities
        .sort((a, b) => b.roi.percentage - a.roi.percentage)
        .slice(0, 5),
      quickWins: opportunities.filter(opp => 
        opp.payback.months <= 6 && opp.roi.percentage >= 30
      ),
      highImpact: opportunities.filter(opp => 
        opp.benefits.total >= 100000 // $100k+ total benefit
      ),
      lowRisk: opportunities.filter(opp => 
        opp.confidence.level === 'high' && opp.roi.riskAdjusted.percentage >= 25
      ),
      totalPotentialValue: opportunities.reduce((sum, opp) => sum + opp.roi.netValue, 0),
      averageROI: opportunities.reduce((sum, opp) => sum + opp.roi.percentage, 0) / opportunities.length,
      averagePayback: opportunities.reduce((sum, opp) => sum + opp.payback.months, 0) / opportunities.length
    };
    
    return insights;
  }
  
  /**
   * Prioritize opportunities based on multiple criteria
   */
  _prioritizeOpportunities(opportunities, userContext) {
    const scored = opportunities.map(opp => ({
      ...opp,
      priorityScore: this._calculatePriorityScore(opp, userContext)
    }));
    
    return {
      byROI: scored.sort((a, b) => b.roi.percentage - a.roi.percentage),
      byPayback: scored.sort((a, b) => a.payback.months - b.payback.months),
      byConfidence: scored.sort((a, b) => b.confidence.score - a.confidence.score),
      byPriority: scored.sort((a, b) => b.priorityScore - a.priorityScore),
      recommended: scored
        .filter(opp => opp.priorityScore >= 0.7)
        .sort((a, b) => b.priorityScore - a.priorityScore)
        .slice(0, 5)
    };
  }
  
  /**
   * Calculate priority score combining multiple factors
   */
  _calculatePriorityScore(opportunity, userContext) {
    const roiWeight = 0.35;
    const paybackWeight = 0.25;
    const confidenceWeight = 0.25;
    const strategicWeight = 0.15;
    
    // Normalize ROI (cap at 200% for scoring)
    const roiScore = Math.min(opportunity.roi.percentage / 200, 1.0);
    
    // Normalize payback (18 months = 0, 0 months = 1)
    const paybackScore = Math.max(0, 1 - (opportunity.payback.months / 18));
    
    // Confidence score is already normalized
    const confidenceScore = opportunity.confidence.score;
    
    // Strategic alignment score
    const strategicScore = this._calculateStrategicAlignment(opportunity, userContext);
    
    return (roiScore * roiWeight) +
           (paybackScore * paybackWeight) +
           (confidenceScore * confidenceWeight) +
           (strategicScore * strategicWeight);
  }
  
  /**
   * Calculate strategic alignment with user's goals
   */
  _calculateStrategicAlignment(opportunity, userContext) {
    let score = 0.5; // baseline
    
    // Align with user's pain points
    const painPoints = userContext.painPoints || [];
    const packageCategory = opportunity.package.category;
    
    if (painPoints.includes('development-speed') && packageCategory === 'template') score += 0.3;
    if (painPoints.includes('security') && packageCategory === 'security') score += 0.4;
    if (painPoints.includes('compliance') && packageCategory === 'compliance') score += 0.4;
    if (painPoints.includes('maintenance') && packageCategory === 'automation') score += 0.3;
    
    // Align with industry priorities
    const industry = userContext.industry;
    if (industry === 'financial' && packageCategory === 'compliance') score += 0.2;
    if (industry === 'healthcare' && packageCategory === 'security') score += 0.2;
    if (industry === 'technology' && packageCategory === 'template') score += 0.1;
    
    return Math.min(1.0, score);
  }
  
  /**
   * Perform sensitivity analysis
   */
  _performSensitivityAnalysis(roiData, userContext) {
    const scenarios = {
      pessimistic: this._calculateScenario(roiData, 0.7), // 30% worse
      realistic: roiData,
      optimistic: this._calculateScenario(roiData, 1.3) // 30% better
    };
    
    return {
      scenarios,
      keyVariables: this._identifyKeyVariables(roiData),
      riskFactors: this._identifyRiskFactors(roiData, userContext)
    };
  }
  
  /**
   * Assess ROI-related risks
   */
  _assessROIRisk(roiData, userContext) {
    const risks = {
      implementationRisk: this._assessImplementationRisk(roiData, userContext),
      adoptionRisk: this._assessAdoptionRisk(roiData, userContext),
      technologyRisk: this._assessTechnologyRisk(roiData, userContext),
      marketRisk: this._assessMarketRisk(roiData, userContext)
    };
    
    const overallRisk = Object.values(risks).reduce((sum, risk) => sum + risk.score, 0) / Object.keys(risks).length;
    
    return {
      overall: {
        score: overallRisk,
        level: overallRisk <= 0.3 ? 'low' : overallRisk <= 0.6 ? 'medium' : 'high'
      },
      components: risks,
      mitigation: this._generateRiskMitigation(risks)
    };
  }
  
  /**
   * Helper methods for cost and benefit estimation
   */
  _estimateLicensingCosts(opportunity, userContext) {
    // Mock implementation - would use real pricing data
    const baseCost = 1000; // Annual licensing
    const teamSize = userContext.teamSize || 5;
    return baseCost * Math.sqrt(teamSize); // Sub-linear scaling
  }
  
  _estimateImplementationCosts(opportunity, userContext) {
    const complexity = opportunity.complexity?.value || 'medium';
    const hourlyRate = this.industryRates[userContext.industry]?.hourlyRate || 150;
    
    const hoursByComplexity = {
      'low': 40,
      'medium': 80,
      'high': 160
    };
    
    return (hoursByComplexity[complexity] || 80) * hourlyRate;
  }
  
  _estimateTrainingCosts(opportunity, userContext) {
    const teamSize = userContext.teamSize || 5;
    const trainingHoursPerPerson = 8;
    const hourlyRate = this.industryRates[userContext.industry]?.hourlyRate || 150;
    
    return teamSize * trainingHoursPerPerson * hourlyRate;
  }
  
  _estimateMaintenanceCosts(opportunity, userContext) {
    const implementationCost = this._estimateImplementationCosts(opportunity, userContext);
    return implementationCost * 0.2; // 20% of implementation cost annually
  }
  
  _estimateSupportCosts(opportunity, userContext) {
    const licensingCost = this._estimateLicensingCosts(opportunity, userContext);
    return licensingCost * 0.15; // 15% of licensing cost for support
  }
  
  _estimateQualityBenefits(opportunity, userContext) {
    // Quality improvements translate to reduced rework and defects
    const hourlyRate = this.industryRates[userContext.industry]?.hourlyRate || 150;
    const qualityMultiplier = this.industryRates[userContext.industry]?.qualityMultiplier || 1.0;
    
    return {
      defectReduction: 50 * hourlyRate * qualityMultiplier, // 50 hours saved on defect handling
      reworkReduction: 30 * hourlyRate * qualityMultiplier, // 30 hours saved on rework
      value: 80 * hourlyRate * qualityMultiplier
    };
  }
  
  _estimateRiskReductionBenefits(opportunity, userContext) {
    // Risk reduction benefits vary by industry and package type
    const category = opportunity.package?.category;
    const industry = userContext.industry;
    
    let riskValue = 0;
    
    if (category === 'security') {
      riskValue = industry === 'financial' ? 500000 : 
                  industry === 'healthcare' ? 300000 : 100000;
    } else if (category === 'compliance') {
      riskValue = industry === 'financial' ? 1000000 : 
                  industry === 'healthcare' ? 800000 : 200000;
    }
    
    // Apply probability of avoiding the risk
    const avoidanceProbability = 0.1; // 10% chance of avoiding a major incident
    
    return {
      potentialLoss: riskValue,
      avoidanceProbability,
      value: riskValue * avoidanceProbability
    };
  }
  
  _estimateScalabilityBenefits(opportunity, userContext) {
    // Benefits from improved scalability and efficiency
    const teamSize = userContext.teamSize || 5;
    const hourlyRate = this.industryRates[userContext.industry]?.hourlyRate || 150;
    
    return {
      efficiencyGains: teamSize * 10 * hourlyRate, // 10 hours per team member
      scalabilityValue: teamSize * 5 * hourlyRate,  // 5 hours per team member
      value: teamSize * 15 * hourlyRate
    };
  }
  
  _generateCostBreakdown(costs) {
    const total = costs.total;
    return Object.entries(costs)
      .filter(([key]) => key !== 'total' && key !== 'breakdown' && key !== 'monthly')
      .map(([category, amount]) => ({
        category,
        amount,
        percentage: (amount / total) * 100
      }));
  }
  
  _generateBenefitBreakdown(benefits) {
    const total = benefits.total;
    return Object.entries(benefits)
      .filter(([key]) => key !== 'total' && key !== 'breakdown' && key !== 'monthly')
      .map(([category, benefit]) => ({
        category,
        amount: typeof benefit === 'object' ? benefit.value : benefit,
        percentage: ((typeof benefit === 'object' ? benefit.value : benefit) / total) * 100
      }));
  }
  
  _calculateNPV(costs, benefits, periodMonths) {
    const discountRate = 0.1; // 10% annual discount rate
    const monthlyRate = discountRate / 12;
    
    let npv = -costs.total; // Initial investment
    
    for (let month = 1; month <= periodMonths; month++) {
      const cashFlow = benefits.monthly;
      npv += cashFlow / Math.pow(1 + monthlyRate, month);
    }
    
    return npv;
  }
  
  _calculateIRR(costs, benefits, periodMonths) {
    // Simplified IRR calculation
    const monthlyCashFlow = benefits.monthly;
    const initialInvestment = costs.total;
    
    if (monthlyCashFlow <= 0) return 0;
    
    const totalCashFlow = monthlyCashFlow * periodMonths;
    const annualReturn = (totalCashFlow - initialInvestment) / initialInvestment;
    
    return (annualReturn / (periodMonths / 12)) * 100; // Annualized percentage
  }
  
  _formatArrayForSparql(array) {
    return array.map(item => `"${item}"`).join(', ');
  }
  
  _documentAssumptions(opportunity, userContext, hourlyRate) {
    return {
      hourlyRate,
      implementationTime: '2-3 months',
      adoptionRate: '80% team adoption',
      maintenanceEffort: '20% of initial implementation',
      benefitRealizationPeriod: '12 months',
      discountRate: '10% annual'
    };
  }
  
  _generateTimeline(opportunity, userContext) {
    return {
      months: [
        { month: 1, phase: 'Planning & Setup', costs: 25, benefits: 0 },
        { month: 2, phase: 'Implementation', costs: 50, benefits: 10 },
        { month: 3, phase: 'Training & Rollout', costs: 25, benefits: 30 },
        { month: 4, phase: 'Full Operation', costs: 5, benefits: 100 },
        { month: 12, phase: 'Optimization', costs: 10, benefits: 120 }
      ]
    };
  }
  
  _generateSummary(opportunities, userContext) {
    return {
      totalOpportunities: opportunities.length,
      totalPotentialROI: opportunities.reduce((sum, opp) => sum + opp.roi.percentage, 0),
      totalPotentialValue: opportunities.reduce((sum, opp) => sum + opp.roi.netValue, 0),
      averagePayback: opportunities.reduce((sum, opp) => sum + opp.payback.months, 0) / opportunities.length,
      recommendedActions: this._generateRecommendedActions(opportunities, userContext)
    };
  }
  
  _generateRecommendedActions(opportunities, userContext) {
    const highROI = opportunities.filter(opp => opp.roi.percentage >= 50);
    const quickWins = opportunities.filter(opp => opp.payback.months <= 6);
    
    const actions = [];
    
    if (highROI.length > 0) {
      actions.push({
        priority: 'high',
        action: 'immediate-implementation',
        packages: highROI.slice(0, 3).map(opp => opp.package.name),
        reasoning: 'High ROI potential with strong business case'
      });
    }
    
    if (quickWins.length > 0) {
      actions.push({
        priority: 'medium',
        action: 'quick-wins',
        packages: quickWins.slice(0, 2).map(opp => opp.package.name),
        reasoning: 'Fast payback for immediate value'
      });
    }
    
    return actions;
  }
  
  _identifyConfidenceFactors(opportunity, userContext) {
    return [
      'Market validation from download count',
      'User rating and feedback quality',
      'Vendor reputation and support',
      'Technical compatibility assessment',
      'Industry-specific use case validation'
    ];
  }
  
  _generateRiskRationale(adoptionRisk, industryMultiplier, confidenceScore) {
    const factors = [];
    
    if (adoptionRisk > 0.6) factors.push('High adoption risk due to complexity');
    if (industryMultiplier < 1.0) factors.push('Industry-specific risk factors apply');
    if (confidenceScore < 0.6) factors.push('Limited validation data available');
    
    return factors.length > 0 ? factors.join('; ') : 'Standard risk profile';
  }
  
  _calculateScenario(roiData, multiplier) {
    return {
      ...roiData,
      benefits: {
        ...roiData.benefits,
        total: roiData.benefits.total * multiplier
      },
      roi: {
        ...roiData.roi,
        percentage: ((roiData.benefits.total * multiplier - roiData.costs.total) / roiData.costs.total) * 100,
        netValue: roiData.benefits.total * multiplier - roiData.costs.total
      }
    };
  }
  
  _identifyKeyVariables(roiData) {
    return [
      'Time savings estimation accuracy',
      'Implementation cost variability',
      'Adoption rate assumptions',
      'Benefit realization timeline',
      'Maintenance cost projections'
    ];
  }
  
  _identifyRiskFactors(roiData, userContext) {
    return [
      'Technology compatibility issues',
      'Change management resistance',
      'Vendor support quality',
      'Integration complexity',
      'Market condition changes'
    ];
  }
  
  _assessImplementationRisk(roiData, userContext) {
    return {
      score: 0.4, // Mock value
      factors: ['Technical complexity', 'Team capacity'],
      mitigation: 'Phased implementation approach'
    };
  }
  
  _assessAdoptionRisk(roiData, userContext) {
    return {
      score: 0.3, // Mock value
      factors: ['User training requirements', 'Change management'],
      mitigation: 'Comprehensive training program'
    };
  }
  
  _assessTechnologyRisk(roiData, userContext) {
    return {
      score: 0.2, // Mock value
      factors: ['Compatibility issues', 'Version dependencies'],
      mitigation: 'Thorough compatibility testing'
    };
  }
  
  _assessMarketRisk(roiData, userContext) {
    return {
      score: 0.1, // Mock value
      factors: ['Vendor stability', 'Market conditions'],
      mitigation: 'Vendor evaluation and contingency planning'
    };
  }
  
  _generateRiskMitigation(risks) {
    return Object.entries(risks).map(([type, risk]) => ({
      riskType: type,
      mitigationStrategy: risk.mitigation
    }));
  }
  
  _generateROIRecommendation(roiData, riskAssessment) {
    const roi = roiData.roi.percentage;
    const payback = roiData.payback.months;
    const risk = riskAssessment.overall.level;
    
    if (roi >= 50 && payback <= 12 && risk === 'low') {
      return 'Strong recommendation - proceed immediately';
    } else if (roi >= 30 && payback <= 18 && risk !== 'high') {
      return 'Recommended - good business case';
    } else if (roi >= 15 && risk === 'low') {
      return 'Consider - acceptable returns with low risk';
    } else {
      return 'Caution - requires careful evaluation';
    }
  }
}

export default ROIAnalyzer;