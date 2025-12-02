/**
 * Risk Assessment Utility
 * 
 * Analyzes business and technical risks in marketplace operations.
 */

export class RiskAssessment {
  constructor() {
    this.riskCategories = [
      'operational',
      'financial', 
      'security',
      'compliance',
      'technical',
      'strategic'
    ];
  }

  async analyzeRisks(depth = 'summary') {
    const risks = await this.assessAllCategories();
    const overallRisk = this.calculateOverallRisk(risks);
    const mitigation = this.generateMitigationStrategies(risks);
    const exposure = this.calculateExposure(risks);

    const assessment = {
      overallRisk,
      categories: risks,
      mitigation,
      exposure,
      lastAssessment: new Date().toISOString(),
      nextReview: this.calculateNextReview()
    };

    if (depth === 'comprehensive') {
      assessment.scenarioAnalysis = await this.runScenarioAnalysis();
      assessment.heatMap = this.generateRiskHeatMap(risks);
      assessment.trending = this.analyzeTrends(risks);
    }

    return assessment;
  }

  async assessAllCategories() {
    const assessments = [];
    
    for (const category of this.riskCategories) {
      const assessment = await this.assessCategory(category);
      assessments.push(assessment);
    }
    
    return assessments;
  }

  async assessCategory(category) {
    const risks = this.getCategoryRisks(category);
    const likelihood = this.calculateLikelihood(category);
    const impact = this.calculateImpact(category);
    const riskScore = likelihood * impact;
    
    return {
      category,
      level: this.getRiskLevel(riskScore),
      likelihood,
      impact,
      score: riskScore,
      risks: risks.slice(0, 5), // Top 5 risks per category
      controls: this.getExistingControls(category),
      recommendations: this.getCategoryRecommendations(category)
    };
  }

  getCategoryRisks(category) {
    const riskDatabase = {
      operational: [
        { name: 'Knowledge pack dependency failure', severity: 'high', probability: 0.15 },
        { name: 'Team knowledge gaps', severity: 'medium', probability: 0.25 },
        { name: 'Integration complexity', severity: 'medium', probability: 0.35 },
        { name: 'Vendor lock-in', severity: 'high', probability: 0.20 },
        { name: 'Documentation obsolescence', severity: 'low', probability: 0.45 }
      ],
      financial: [
        { name: 'Cost overruns from inefficient pack usage', severity: 'high', probability: 0.20 },
        { name: 'Licensing compliance violations', severity: 'critical', probability: 0.10 },
        { name: 'ROI below expectations', severity: 'medium', probability: 0.30 },
        { name: 'Hidden maintenance costs', severity: 'medium', probability: 0.25 },
        { name: 'Budget allocation inefficiencies', severity: 'low', probability: 0.40 }
      ],
      security: [
        { name: 'Vulnerable knowledge pack dependencies', severity: 'critical', probability: 0.15 },
        { name: 'Insufficient access controls', severity: 'high', probability: 0.20 },
        { name: 'Data exposure through templates', severity: 'high', probability: 0.10 },
        { name: 'Supply chain attacks', severity: 'critical', probability: 0.05 },
        { name: 'Inadequate security scanning', severity: 'medium', probability: 0.30 }
      ],
      compliance: [
        { name: 'Regulatory requirement violations', severity: 'critical', probability: 0.12 },
        { name: 'Audit trail insufficiency', severity: 'high', probability: 0.18 },
        { name: 'Data retention policy violations', severity: 'medium', probability: 0.22 },
        { name: 'Cross-border data transfer issues', severity: 'high', probability: 0.15 },
        { name: 'Industry standard non-compliance', severity: 'medium', probability: 0.25 }
      ],
      technical: [
        { name: 'Architecture drift from standards', severity: 'medium', probability: 0.35 },
        { name: 'Performance degradation', severity: 'medium', probability: 0.40 },
        { name: 'Scalability limitations', severity: 'high', probability: 0.20 },
        { name: 'Integration breaking changes', severity: 'high', probability: 0.25 },
        { name: 'Technical debt accumulation', severity: 'medium', probability: 0.50 }
      ],
      strategic: [
        { name: 'Technology obsolescence', severity: 'high', probability: 0.30 },
        { name: 'Competitive disadvantage', severity: 'high', probability: 0.15 },
        { name: 'Market disruption', severity: 'critical', probability: 0.08 },
        { name: 'Skill gap expansion', severity: 'medium', probability: 0.40 },
        { name: 'Innovation stagnation', severity: 'medium', probability: 0.25 }
      ]
    };
    
    return riskDatabase[category] || [];
  }

  calculateLikelihood(category) {
    // Base likelihood scores by category
    const baseLikelihoods = {
      operational: 0.7,
      financial: 0.5,
      security: 0.4,
      compliance: 0.3,
      technical: 0.6,
      strategic: 0.4
    };
    
    return baseLikelihoods[category] || 0.5;
  }

  calculateImpact(category) {
    // Base impact scores by category
    const baseImpacts = {
      operational: 0.6,
      financial: 0.8,
      security: 0.9,
      compliance: 0.9,
      technical: 0.5,
      strategic: 0.7
    };
    
    return baseImpacts[category] || 0.5;
  }

  getRiskLevel(score) {
    if (score >= 0.7) return 'critical';
    if (score >= 0.5) return 'high';
    if (score >= 0.3) return 'medium';
    return 'low';
  }

  calculateOverallRisk(risks) {
    const weightedScore = risks.reduce((sum, risk) => {
      const weight = this.getCategoryWeight(risk.category);
      return sum + (risk.score * weight);
    }, 0);
    
    const totalWeight = risks.reduce((sum, risk) => sum + this.getCategoryWeight(risk.category), 0);
    const averageScore = weightedScore / totalWeight;
    
    return this.getRiskLevel(averageScore);
  }

  getCategoryWeight(category) {
    const weights = {
      security: 1.2,
      compliance: 1.1,
      financial: 1.0,
      operational: 0.9,
      technical: 0.8,
      strategic: 0.7
    };
    
    return weights[category] || 1.0;
  }

  generateMitigationStrategies(risks) {
    const strategies = [];
    
    risks.forEach(risk => {
      if (risk.level === 'critical' || risk.level === 'high') {
        strategies.push({
          category: risk.category,
          strategy: this.getMitigationStrategy(risk.category),
          priority: risk.level === 'critical' ? 'immediate' : 'high',
          effort: this.getEstimatedEffort(risk.category),
          timeline: this.getEstimatedTimeline(risk.category)
        });
      }
    });
    
    return strategies;
  }

  getMitigationStrategy(category) {
    const strategies = {
      operational: 'Implement redundancy and monitoring for critical dependencies',
      financial: 'Establish cost controls and regular ROI reviews',
      security: 'Deploy comprehensive security scanning and access controls',
      compliance: 'Implement automated compliance monitoring and reporting',
      technical: 'Establish architecture governance and performance monitoring',
      strategic: 'Create technology roadmap and skill development programs'
    };
    
    return strategies[category] || 'Develop category-specific risk mitigation plan';
  }

  getEstimatedEffort(category) {
    const efforts = {
      operational: 'medium',
      financial: 'low',
      security: 'high',
      compliance: 'high', 
      technical: 'medium',
      strategic: 'high'
    };
    
    return efforts[category] || 'medium';
  }

  getEstimatedTimeline(category) {
    const timelines = {
      operational: '2-3 months',
      financial: '1-2 months',
      security: '3-6 months',
      compliance: '4-6 months',
      technical: '2-4 months',
      strategic: '6-12 months'
    };
    
    return timelines[category] || '3-6 months';
  }

  calculateExposure(risks) {
    const totalExposure = risks.reduce((sum, risk) => sum + risk.score, 0);
    const maxExposure = risks.length * 1.0; // Maximum possible score
    
    return {
      current: totalExposure,
      maximum: maxExposure,
      percentage: (totalExposure / maxExposure) * 100,
      trend: this.calculateExposureTrend()
    };
  }

  calculateExposureTrend() {
    // Mock trend calculation - would use historical data in production
    return Math.random() > 0.5 ? 'decreasing' : 'stable';
  }

  getExistingControls(category) {
    const controls = {
      operational: ['Monitoring systems', 'Backup procedures', 'Documentation'],
      financial: ['Budget tracking', 'Cost analysis', 'ROI reporting'],
      security: ['Access controls', 'Vulnerability scanning', 'Security policies'],
      compliance: ['Audit procedures', 'Policy framework', 'Training programs'],
      technical: ['Code reviews', 'Architecture standards', 'Performance monitoring'],
      strategic: ['Technology roadmap', 'Market analysis', 'Skill assessments']
    };
    
    return controls[category] || [];
  }

  getCategoryRecommendations(category) {
    const recommendations = {
      operational: ['Implement automated dependency monitoring', 'Create knowledge sharing protocols'],
      financial: ['Establish ROI tracking dashboard', 'Implement cost allocation models'],
      security: ['Deploy automated security scanning', 'Implement zero-trust architecture'],
      compliance: ['Create automated compliance reporting', 'Implement policy management system'],
      technical: ['Establish architecture review board', 'Implement performance SLAs'],
      strategic: ['Create innovation pipeline', 'Implement competitive intelligence']
    };
    
    return recommendations[category] || [];
  }

  async runScenarioAnalysis() {
    return {
      bestCase: {
        description: 'All mitigation strategies successful',
        riskReduction: 0.6,
        timeline: '6 months',
        investment: 250000
      },
      worstCase: {
        description: 'Multiple risk categories materialize',
        potentialLoss: 2000000,
        businessImpact: 'severe',
        recoveryTime: '12-18 months'
      },
      mostLikely: {
        description: 'Moderate risk materialization with standard mitigation',
        riskReduction: 0.4,
        timeline: '9 months',
        investment: 400000
      }
    };
  }

  generateRiskHeatMap(risks) {
    return risks.map(risk => ({
      category: risk.category,
      likelihood: risk.likelihood,
      impact: risk.impact,
      score: risk.score,
      level: risk.level,
      coordinates: {
        x: risk.likelihood * 10,
        y: risk.impact * 10
      }
    }));
  }

  analyzeTrends(risks) {
    // Mock trend analysis - would use historical data
    return {
      improving: ['operational', 'technical'],
      stable: ['financial', 'strategic'],
      worsening: ['security', 'compliance']
    };
  }

  calculateNextReview() {
    const nextReview = new Date();
    nextReview.setMonth(nextReview.getMonth() + 1); // Monthly reviews
    return nextReview.toISOString();
  }
}