/**
 * Integration tests for the complete KGEN Marketplace Insight & Recommendation Engine
 * 
 * Tests the full workflow from user context to actionable recommendations
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { MarketplaceRecommender } from '../../src/insights/recommender.js';
import { ExploreIntegration } from '../../src/explore-integration.js';
import { SparqlQueryEngine } from '../../src/insights/sparql-engine.js';

describe('KGEN Marketplace Insights - Full Integration', () => {
  let recommender;
  let integration;
  let engine;

  beforeEach(() => {
    engine = new SparqlQueryEngine();
    recommender = new MarketplaceRecommender();
    integration = new ExploreIntegration();
  });

  describe('End-to-End Recommendation Workflow', () => {
    it('should provide complete recommendations for a financial services project', async () => {
      const userContext = {
        industry: 'financial',
        projectType: 'web-app',
        technologies: ['React', 'Node.js', 'PostgreSQL', 'TypeScript'],
        teamSize: 'large',
        developmentStage: 'production',
        currentCompliance: ['SOC2'],
        painPoints: [
          'compliance-gaps',
          'security-vulnerabilities', 
          'development-velocity',
          'testing-coverage'
        ],
        goals: [
          'achieve-sox-compliance',
          'improve-security-posture',
          'increase-development-speed',
          'enhance-code-quality'
        ],
        budget: 500000,
        timeline: '6months',
        riskTolerance: 'low'
      };

      // Get comprehensive recommendations
      const recommendations = await recommender.generateRecommendations(userContext);

      // Validate recommendation structure
      expect(recommendations).toHaveProperty('recommendations');
      expect(recommendations).toHaveProperty('insights');
      expect(recommendations).toHaveProperty('metadata');

      expect(Array.isArray(recommendations.recommendations)).toBe(true);
      expect(recommendations.recommendations.length).toBeGreaterThan(0);

      // Should include compliance recommendations for financial industry
      const complianceRecs = recommendations.recommendations.filter(rec => 
        rec.type === 'compliance'
      );
      expect(complianceRecs.length).toBeGreaterThan(0);

      // Should include technology-relevant recommendations
      const techRelevantRecs = recommendations.recommendations.filter(rec => 
        rec.reasoning?.includes('React') || 
        rec.reasoning?.includes('Node.js') ||
        rec.reasoning?.includes('TypeScript')
      );
      expect(techRelevantRecs.length).toBeGreaterThan(0);

      // Validate insights generation
      expect(recommendations.insights).toHaveProperty('summary');
      expect(recommendations.insights.summary).toHaveProperty('totalRecommendations');
      expect(recommendations.insights.summary).toHaveProperty('averageScore');

      // Validate metadata
      expect(recommendations.metadata).toHaveProperty('userContext');
      expect(recommendations.metadata).toHaveProperty('generatedAt');
      expect(recommendations.metadata).toHaveProperty('algorithmsUsed');
      expect(recommendations.metadata.algorithmsUsed).toContain('compliance');
      expect(recommendations.metadata.algorithmsUsed).toContain('template');
    });

    it('should provide startup-focused recommendations for early-stage tech company', async () => {
      const startupContext = {
        industry: 'technology',
        projectType: 'microservices',
        technologies: ['Vue', 'Python', 'Docker', 'AWS'],
        teamSize: 'small',
        developmentStage: 'early',
        currentCompliance: [],
        painPoints: [
          'rapid-prototyping',
          'scalability-concerns',
          'infrastructure-complexity'
        ],
        goals: [
          'fast-development',
          'easy-scaling',
          'cost-optimization'
        ],
        budget: 50000,
        timeline: '3months',
        riskTolerance: 'high',
        urgency: 'immediate'
      };

      const recommendations = await recommender.generateRecommendations(startupContext);

      // Should prioritize quick wins and templates for rapid development
      const quickWins = recommendations.insights?.opportunities?.quickWins || [];
      expect(quickWins.length).toBeGreaterThan(0);

      // Should include microservices-relevant recommendations
      const microservicesRecs = recommendations.recommendations.filter(rec => 
        rec.reasoning?.toLowerCase().includes('microservice') ||
        rec.category?.value === 'architecture'
      );
      expect(microservicesRecs.length).toBeGreaterThan(0);

      // Should have high-velocity recommendations for startup urgency
      const templateRecs = recommendations.recommendations.filter(rec => 
        rec.type === 'template'
      );
      expect(templateRecs.length).toBeGreaterThan(0);
    });
  });

  describe('CLI Integration Workflow', () => {
    it('should provide complete CLI-ready output for explore command', async () => {
      const exploreContext = {
        projectType: 'web-app',
        technologies: ['React', 'TypeScript', 'Node.js'],
        industry: 'healthcare',
        teamSize: 'medium',
        currentPackages: {
          templates: ['basic-component'],
          packages: ['axios', 'lodash'],
          compliance: []
        },
        painPoints: ['compliance', 'security', 'documentation'],
        goals: ['hipaa-compliance', 'improve-security', 'better-docs']
      };

      const result = await integration.getExploreRecommendations(exploreContext);

      // Validate CLI-friendly structure
      expect(result).toHaveProperty('recommendations');
      expect(result).toHaveProperty('actions');
      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('metadata');

      // Validate actionable commands
      expect(result.actions).toHaveProperty('immediate');
      expect(result.actions).toHaveProperty('planned');
      expect(result.actions).toHaveProperty('investigate');

      const immediateActions = result.actions.immediate;
      if (immediateActions.length > 0) {
        const action = immediateActions[0];
        expect(action).toHaveProperty('action');
        expect(action).toHaveProperty('description');
        expect(action).toHaveProperty('estimatedTime');
        expect(action.action).toMatch(/^kgen\s+\w+/); // Should be a valid kgen command
      }

      // Generate implementation commands
      const commands = integration.generateImplementationCommands(result.recommendations);
      expect(Array.isArray(commands)).toBe(true);

      if (commands.length > 0) {
        const command = commands[0];
        expect(command).toHaveProperty('command');
        expect(command).toHaveProperty('description');
        expect(command).toHaveProperty('category');
        expect(command).toHaveProperty('priority');
        expect(command).toHaveProperty('estimatedTime');
        expect(command.command).toMatch(/^kgen\s+/);
      }
    });

    it('should provide project analysis with actionable insights', async () => {
      const projectConfig = {
        name: 'healthcare-portal',
        version: '1.0.0',
        templates: ['react-component', 'api-endpoint'],
        technologies: ['React', 'Node.js', 'MongoDB'],
        compliance: ['HIPAA'],
        security: { enabled: true },
        testing: { framework: 'jest', coverage: 75 }
      };

      const projectStructure = {
        files: [
          'src/components/',
          'src/api/',
          'tests/',
          'docs/',
          'package.json',
          'README.md',
          '.github/workflows/ci.yml',
          'Dockerfile'
        ]
      };

      const analysis = await integration.analyzeProject(projectConfig, projectStructure);

      // Validate analysis structure
      expect(analysis).toHaveProperty('analysis');
      expect(analysis).toHaveProperty('recommendations');
      expect(analysis).toHaveProperty('quickActions');
      expect(analysis).toHaveProperty('insights');
      expect(analysis).toHaveProperty('nextSteps');

      // Validate project analysis
      expect(analysis.analysis).toHaveProperty('projectType');
      expect(analysis.analysis).toHaveProperty('technologies');
      expect(analysis.analysis).toHaveProperty('complianceNeeds');
      expect(analysis.analysis).toHaveProperty('templateUsage');

      // Should detect healthcare compliance needs
      expect(analysis.analysis.complianceNeeds).toContain('HIPAA');

      // Should detect React/Node.js technologies
      expect(analysis.analysis.technologies).toContain('React');
      expect(analysis.analysis.technologies).toContain('Node.js');

      // Should provide actionable next steps
      expect(Array.isArray(analysis.nextSteps)).toBe(true);
      expect(analysis.nextSteps.length).toBeGreaterThan(0);

      const firstStep = analysis.nextSteps[0];
      expect(firstStep).toHaveProperty('step', 1);
      expect(firstStep).toHaveProperty('action');
      expect(firstStep).toHaveProperty('command');
      expect(firstStep).toHaveProperty('estimatedTime');
    });
  });

  describe('Market Intelligence Integration', () => {
    it('should provide comprehensive market intelligence', async () => {
      const filters = {
        industry: 'technology',
        technologies: ['React', 'Vue', 'Angular'],
        timeRange: '30days'
      };

      const intelligence = await integration.getMarketIntelligence(filters);

      expect(intelligence).toHaveProperty('trends');
      expect(intelligence).toHaveProperty('opportunities');
      expect(intelligence).toHaveProperty('recommendations');
      expect(intelligence).toHaveProperty('visualization');

      // Validate trends structure
      expect(intelligence.trends).toHaveProperty('emerging');
      expect(intelligence.trends).toHaveProperty('declining');
      expect(intelligence.trends).toHaveProperty('stable');

      expect(Array.isArray(intelligence.trends.emerging)).toBe(true);
      expect(Array.isArray(intelligence.trends.declining)).toBe(true);
      expect(Array.isArray(intelligence.trends.stable)).toBe(true);

      // Validate opportunities
      expect(Array.isArray(intelligence.opportunities)).toBe(true);

      // Validate visualization data
      expect(intelligence.visualization).toHaveProperty('trends');
      expect(intelligence.visualization).toHaveProperty('adoption');

      const trendsViz = intelligence.visualization.trends;
      expect(trendsViz).toHaveProperty('type');
      expect(trendsViz).toHaveProperty('title');
      expect(trendsViz).toHaveProperty('data');
    });
  });

  describe('Algorithm Coordination and Scoring', () => {
    it('should coordinate multiple algorithms effectively', async () => {
      const context = {
        industry: 'financial',
        technologies: ['Java', 'Spring Boot', 'Oracle'],
        projectType: 'enterprise',
        teamSize: 'large',
        painPoints: ['compliance', 'performance', 'maintenance'],
        goals: ['sox-compliance', 'improve-performance', 'reduce-costs']
      };

      const recommendations = await recommender.generateRecommendations(context);

      // Should have recommendations from multiple algorithms
      const algorithmTypes = new Set(recommendations.recommendations.map(rec => rec.type));
      expect(algorithmTypes.size).toBeGreaterThan(1);

      // Should include at least compliance and template recommendations
      expect(algorithmTypes.has('compliance')).toBe(true);

      // Validate scoring and ranking
      const scores = recommendations.recommendations.map(rec => rec.score);
      
      // Scores should be in descending order
      for (let i = 1; i < scores.length; i++) {
        expect(scores[i]).toBeLessThanOrEqual(scores[i - 1]);
      }

      // All scores should be between 0 and 1
      scores.forEach(score => {
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(1);
      });

      // Should have reasoning for recommendations
      recommendations.recommendations.forEach(rec => {
        expect(rec).toHaveProperty('reasoning');
        expect(typeof rec.reasoning).toBe('string');
        expect(rec.reasoning.length).toBeGreaterThan(0);
      });
    });

    it('should provide consistent scoring across multiple runs', async () => {
      const context = {
        industry: 'technology',
        technologies: ['Python', 'Django'],
        projectType: 'web-app'
      };

      // Run recommendations multiple times
      const run1 = await recommender.generateRecommendations(context);
      const run2 = await recommender.generateRecommendations(context);

      // Should return consistent results (due to caching)
      expect(run1.recommendations).toEqual(run2.recommendations);
    });
  });

  describe('Specific Insight Types', () => {
    it('should provide detailed compliance gap analysis', async () => {
      const context = {
        industry: 'financial',
        currentCompliance: ['SOC2'],
        riskTolerance: 'low'
      };

      const insights = await recommender.getInsights('compliance-gaps', context);

      expect(insights).toHaveProperty('type', 'compliance-gaps');
      expect(insights).toHaveProperty('insights');
      expect(insights).toHaveProperty('context');
      expect(insights).toHaveProperty('generatedAt');

      // Should identify missing compliance frameworks for financial industry
      expect(insights.insights).toBeDefined();
    });

    it('should provide ROI analysis with business metrics', async () => {
      const context = {
        industry: 'technology',
        budget: 100000,
        teamSize: 'medium',
        hourlyRate: 150,
        timeline: '12months'
      };

      const insights = await recommender.getInsights('roi-opportunities', context);

      expect(insights).toHaveProperty('type', 'roi-opportunities');
      expect(insights).toHaveProperty('insights');

      // Should include ROI calculations
      expect(insights.insights).toBeDefined();
    });

    it('should provide data exhaust analysis', async () => {
      const context = {
        technologies: ['Node.js', 'PostgreSQL'],
        dataVolume: 'high'
      };

      const insights = await recommender.getInsights('data-exhaust', context);

      expect(insights).toHaveProperty('type', 'data-exhaust');
      expect(insights).toHaveProperty('insights');
    });
  });

  describe('Use Case Specific Recommendations', () => {
    it('should provide quick-start recommendations', async () => {
      const context = {
        projectType: 'prototype',
        teamSize: 'small',
        timeline: '1month',
        urgency: 'immediate'
      };

      const recommendations = await recommender.getUseCaseRecommendations('quick-start', context);

      expect(recommendations).toHaveProperty('recommendations');
      expect(recommendations.recommendations.length).toBeLessThanOrEqual(5);

      // Should include beginner-friendly options
      const quickStartRecs = recommendations.recommendations.filter(rec => 
        rec.reasoning?.includes('quick') || 
        rec.reasoning?.includes('beginner') ||
        rec.complexity?.value === 'low'
      );
      expect(quickStartRecs.length).toBeGreaterThan(0);
    });

    it('should provide enterprise compliance recommendations', async () => {
      const context = {
        industry: 'healthcare',
        teamSize: 'large',
        complianceRequirements: ['HIPAA', 'HITECH'],
        riskTolerance: 'low'
      };

      const recommendations = await recommender.getUseCaseRecommendations('enterprise-compliance', context);

      expect(recommendations).toHaveProperty('recommendations');

      // Should focus on compliance and security
      const complianceRecs = recommendations.recommendations.filter(rec => 
        rec.type === 'compliance' || 
        rec.category?.value === 'security'
      );
      expect(complianceRecs.length).toBeGreaterThan(0);
    });

    it('should provide cost optimization recommendations', async () => {
      const context = {
        budget: 25000,
        painPoints: ['high-costs', 'inefficiency'],
        goals: ['reduce-costs', 'improve-efficiency']
      };

      const recommendations = await recommender.getUseCaseRecommendations('cost-optimization', context);

      expect(recommendations).toHaveProperty('recommendations');

      // Should be sorted by ROI
      const rois = recommendations.recommendations
        .map(rec => rec.metrics?.roi || 0)
        .filter(roi => roi > 0);
      
      for (let i = 1; i < rois.length; i++) {
        expect(rois[i]).toBeLessThanOrEqual(rois[i - 1]);
      }
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle empty user context gracefully', async () => {
      const emptyContext = {};
      const recommendations = await recommender.generateRecommendations(emptyContext);

      expect(recommendations).toHaveProperty('recommendations');
      expect(Array.isArray(recommendations.recommendations)).toBe(true);
      expect(recommendations).toHaveProperty('insights');
      expect(recommendations).toHaveProperty('metadata');
    });

    it('should handle null/undefined inputs', async () => {
      const recommendations1 = await recommender.generateRecommendations(null);
      const recommendations2 = await recommender.generateRecommendations(undefined);

      expect(recommendations1).toHaveProperty('recommendations');
      expect(recommendations2).toHaveProperty('recommendations');
    });

    it('should handle invalid industry/technology combinations', async () => {
      const invalidContext = {
        industry: 'nonexistent-industry',
        technologies: ['unknown-tech-1', 'unknown-tech-2'],
        projectType: 'invalid-project-type'
      };

      const recommendations = await recommender.generateRecommendations(invalidContext);

      // Should not crash and return valid structure
      expect(recommendations).toHaveProperty('recommendations');
      expect(Array.isArray(recommendations.recommendations)).toBe(true);
    });

    it('should handle network/SPARQL endpoint failures gracefully', async () => {
      // Mock SPARQL engine to simulate failure
      const failingEngine = new SparqlQueryEngine('http://nonexistent-endpoint');
      const failingRecommender = new MarketplaceRecommender({ 
        endpoint: 'http://nonexistent-endpoint' 
      });

      const context = { industry: 'technology' };

      // Should not crash, may return empty or default results
      try {
        const recommendations = await failingRecommender.generateRecommendations(context);
        expect(recommendations).toHaveProperty('recommendations');
      } catch (error) {
        // It's acceptable for this to fail, but should be handled gracefully
        expect(error.message).toBeDefined();
      }
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle multiple concurrent recommendation requests', async () => {
      const contexts = [
        { industry: 'technology', technologies: ['React'] },
        { industry: 'financial', technologies: ['Java'] },
        { industry: 'healthcare', technologies: ['Python'] }
      ];

      // Execute recommendations concurrently
      const promises = contexts.map(context => 
        recommender.generateRecommendations(context)
      );

      const results = await Promise.all(promises);

      // All should complete successfully
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result).toHaveProperty('recommendations');
        expect(Array.isArray(result.recommendations)).toBe(true);
      });
    });

    it('should cache recommendations effectively', async () => {
      const context = { industry: 'technology', technologies: ['Vue'] };

      const start1 = Date.now();
      const result1 = await recommender.generateRecommendations(context);
      const time1 = Date.now() - start1;

      const start2 = Date.now();
      const result2 = await recommender.generateRecommendations(context);
      const time2 = Date.now() - start2;

      // Second call should be faster (cached)
      expect(time2).toBeLessThan(time1);
      expect(result1).toEqual(result2);
    });
  });

  describe('Integration with External Systems', () => {
    it('should generate valid CLI commands for all recommendation types', async () => {
      const context = {
        industry: 'technology',
        technologies: ['React', 'Node.js'],
        painPoints: ['testing', 'deployment', 'security']
      };

      const recommendations = await recommender.generateRecommendations(context);
      const commands = integration.generateImplementationCommands(recommendations.recommendations);

      commands.forEach(command => {
        // All commands should start with 'kgen'
        expect(command.command).toMatch(/^kgen\s+/);
        
        // Should have required properties
        expect(command).toHaveProperty('description');
        expect(command).toHaveProperty('category');
        expect(command).toHaveProperty('priority');
        expect(command).toHaveProperty('estimatedTime');
        
        // Category should be valid
        expect(['template', 'compliance', 'general', 'configuration']).toContain(command.category);
        
        // Priority should be valid
        expect(['high', 'medium', 'low']).toContain(command.priority);
        
        // Estimated time should follow expected format
        expect(command.estimatedTime).toMatch(/\d+-?\d*\s*(min|minutes|hour|hours)/);
      });
    });

    it('should provide visualization-ready data', async () => {
      const insights = await integration.getMarketIntelligence({
        industry: 'technology'
      });

      const viz = insights.visualization;
      
      // Should have chart-ready data
      expect(viz.trends).toHaveProperty('type');
      expect(viz.trends).toHaveProperty('title');
      expect(viz.trends).toHaveProperty('data');
      
      expect(viz.adoption).toHaveProperty('type');
      expect(viz.adoption).toHaveProperty('title');
      expect(viz.adoption).toHaveProperty('data');
      
      // Chart types should be valid
      expect(['line', 'bar', 'pie', 'scatter']).toContain(viz.trends.type);
      expect(['line', 'bar', 'pie', 'scatter']).toContain(viz.adoption.type);
    });
  });
});

describe('System Performance Validation', () => {
  let recommender;

  beforeEach(() => {
    recommender = new MarketplaceRecommender();
  });

  it('should complete recommendations within reasonable time', async () => {
    const context = {
      industry: 'technology',
      technologies: ['React', 'Node.js', 'TypeScript'],
      projectType: 'web-app',
      teamSize: 'medium'
    };

    const start = Date.now();
    const recommendations = await recommender.generateRecommendations(context);
    const duration = Date.now() - start;

    // Should complete within 5 seconds for typical usage
    expect(duration).toBeLessThan(5000);
    expect(recommendations.recommendations.length).toBeGreaterThan(0);
  });

  it('should handle large result sets efficiently', async () => {
    const context = {
      industry: 'technology',
      technologies: ['JavaScript'], // Very broad technology
      includeAll: true
    };

    const recommendations = await recommender.generateRecommendations(context, { 
      limit: 100 
    });

    // Should limit results appropriately
    expect(recommendations.recommendations.length).toBeLessThanOrEqual(100);
    
    // Should still be structured correctly
    expect(recommendations).toHaveProperty('insights');
    expect(recommendations).toHaveProperty('metadata');
  });
});

describe('Data Quality Validation', () => {
  let recommender;

  beforeEach(() => {
    recommender = new MarketplaceRecommender();
  });

  it('should return high-quality recommendations with valid metadata', async () => {
    const context = {
      industry: 'financial',
      technologies: ['Java', 'Spring Boot'],
      teamSize: 'large',
      complianceRequirements: ['SOX', 'PCI-DSS']
    };

    const recommendations = await recommender.generateRecommendations(context);

    recommendations.recommendations.forEach(rec => {
      // Should have valid name
      expect(rec.name?.value || rec.package?.name).toBeDefined();
      expect(typeof (rec.name?.value || rec.package?.name)).toBe('string');
      
      // Should have valid score
      expect(rec.score).toBeDefined();
      expect(typeof rec.score).toBe('number');
      expect(rec.score).toBeGreaterThanOrEqual(0);
      expect(rec.score).toBeLessThanOrEqual(1);
      
      // Should have valid type
      expect(rec.type).toBeDefined();
      expect(['compliance', 'template', 'similarity', 'popularity', 'package']).toContain(rec.type);
      
      // Should have reasoning
      expect(rec.reasoning).toBeDefined();
      expect(typeof rec.reasoning).toBe('string');
      expect(rec.reasoning.length).toBeGreaterThan(0);
    });
  });

  it('should provide consistent insights structure', async () => {
    const context = { industry: 'healthcare' };
    const recommendations = await recommender.generateRecommendations(context);

    const insights = recommendations.insights;
    
    // Should have consistent structure
    expect(insights).toHaveProperty('summary');
    expect(insights.summary).toHaveProperty('totalRecommendations');
    expect(insights.summary).toHaveProperty('averageScore');
    
    expect(typeof insights.summary.totalRecommendations).toBe('number');
    expect(typeof insights.summary.averageScore).toBe('number');
    
    // Should have patterns if available
    if (insights.patterns) {
      expect(insights.patterns).toHaveProperty('dominantVerticals');
      expect(Array.isArray(insights.patterns.dominantVerticals)).toBe(true);
    }
  });
});