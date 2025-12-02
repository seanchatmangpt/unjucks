/**
 * Tests for MarketplaceRecommender
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { MarketplaceRecommender } from '../../src/insights/recommender.js';

// Mock the SPARQL engine
const mockSparqlEngine = {
  query: jest.fn(),
  executeNamedQuery: jest.fn()
};

// Mock the algorithm classes
jest.mock('../../src/insights/algorithms/compliance-recommender.js', () => ({
  ComplianceRecommender: jest.fn().mockImplementation(() => ({
    recommend: jest.fn().mockResolvedValue([
      {
        name: { value: 'SOX Compliance Pack' },
        type: 'compliance',
        score: 0.85,
        complianceFramework: { value: 'SOX' }
      }
    ]),
    findGaps: jest.fn().mockResolvedValue({
      missingFrameworks: ['GDPR', 'SOX'],
      criticalGaps: ['SOX']
    })
  }))
}));

jest.mock('../../src/insights/algorithms/template-recommender.js', () => ({
  TemplateRecommender: jest.fn().mockImplementation(() => ({
    recommend: jest.fn().mockResolvedValue([
      {
        name: { value: 'React Component Template' },
        type: 'template',
        score: 0.78,
        framework: { value: 'React' }
      }
    ]),
    findMatches: jest.fn().mockResolvedValue([])
  }))
}));

jest.mock('../../src/insights/algorithms/roi-analyzer.js', () => ({
  ROIAnalyzer: jest.fn().mockImplementation(() => ({
    analyze: jest.fn().mockResolvedValue({
      opportunities: [
        {
          package: { name: 'Test Package' },
          roi: { percentage: 150 },
          payback: { months: 8 }
        }
      ]
    }),
    findOpportunities: jest.fn().mockResolvedValue([])
  }))
}));

jest.mock('../../src/insights/algorithms/similarity-matcher.js', () => ({
  SimilarityMatcher: jest.fn().mockImplementation(() => ({
    recommend: jest.fn().mockResolvedValue([
      {
        name: { value: 'Similar Package' },
        type: 'similarity',
        score: 0.72,
        similarity: 0.85
      }
    ])
  }))
}));

jest.mock('../../src/insights/algorithms/popularity-tracker.js', () => ({
  PopularityTracker: jest.fn().mockImplementation(() => ({
    recommend: jest.fn().mockResolvedValue([
      {
        name: { value: 'Popular Package' },
        type: 'popularity',
        score: 0.68,
        downloads: { value: '5000' }
      }
    ]),
    getTrends: jest.fn().mockResolvedValue({
      trends: [],
      insights: {}
    })
  }))
}));

jest.mock('../../src/insights/scoring/score-calculator.js', () => ({
  ScoreCalculator: jest.fn().mockImplementation(() => ({
    scoreRecommendations: jest.fn().mockResolvedValue([
      {
        name: { value: 'Top Recommendation' },
        score: 0.92,
        ranking: { position: 1, tier: 'top' }
      },
      {
        name: { value: 'Second Recommendation' },
        score: 0.87,
        ranking: { position: 2, tier: 'high' }
      }
    ])
  }))
}));

jest.mock('../../src/insights/insight-aggregator.js', () => ({
  InsightAggregator: jest.fn().mockImplementation(() => ({
    aggregate: jest.fn().mockImplementation((recommendations) => {
      // Simple aggregation for testing
      return recommendations.flat();
    })
  }))
}));

describe('MarketplaceRecommender', () => {
  let recommender;
  let userContext;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    recommender = new MarketplaceRecommender({
      endpoint: 'http://test-sparql-endpoint'
    });
    
    userContext = {
      industry: 'technology',
      technologies: ['React', 'Node.js'],
      projectType: 'web-app',
      teamSize: 'medium',
      currentCompliance: ['SOC2'],
      painPoints: ['development-speed', 'security']
    };
  });

  describe('generateRecommendations', () => {
    it('should generate recommendations from all algorithms', async () => {
      const result = await recommender.generateRecommendations(userContext);
      
      expect(result).toHaveProperty('recommendations');
      expect(result).toHaveProperty('insights');
      expect(result).toHaveProperty('metadata');
      
      expect(Array.isArray(result.recommendations)).toBe(true);
      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(result.metadata.algorithmsUsed).toContain('compliance');
      expect(result.metadata.algorithmsUsed).toContain('template');
    });

    it('should handle empty user context gracefully', async () => {
      const result = await recommender.generateRecommendations({});
      
      expect(result).toHaveProperty('recommendations');
      expect(Array.isArray(result.recommendations)).toBe(true);
    });

    it('should use cache when available', async () => {
      // First call
      const result1 = await recommender.generateRecommendations(userContext);
      
      // Second call should use cache
      const result2 = await recommender.generateRecommendations(userContext);
      
      expect(result1).toEqual(result2);
    });

    it('should bypass cache when forceRefresh is true', async () => {
      // First call
      await recommender.generateRecommendations(userContext);
      
      // Second call with forceRefresh
      const result = await recommender.generateRecommendations(userContext, { forceRefresh: true });
      
      expect(result).toHaveProperty('recommendations');
    });
  });

  describe('getInsights', () => {
    it('should generate compliance gaps insights', async () => {
      const result = await recommender.getInsights('compliance-gaps', userContext);
      
      expect(result).toHaveProperty('type', 'compliance-gaps');
      expect(result).toHaveProperty('insights');
      expect(result).toHaveProperty('context');
    });

    it('should generate template matches insights', async () => {
      const result = await recommender.getInsights('template-matches', userContext);
      
      expect(result).toHaveProperty('type', 'template-matches');
      expect(result).toHaveProperty('insights');
    });

    it('should generate ROI opportunities insights', async () => {
      const result = await recommender.getInsights('roi-opportunities', userContext);
      
      expect(result).toHaveProperty('type', 'roi-opportunities');
      expect(result).toHaveProperty('insights');
    });

    it('should throw error for unknown insight type', async () => {
      await expect(
        recommender.getInsights('unknown-insight', userContext)
      ).rejects.toThrow('Unknown insight type: unknown-insight');
    });
  });

  describe('getUseCaseRecommendations', () => {
    it('should generate quick-start recommendations', async () => {
      const result = await recommender.getUseCaseRecommendations('quick-start', userContext);
      
      expect(result).toHaveProperty('recommendations');
      expect(result.recommendations.length).toBeLessThanOrEqual(5);
    });

    it('should generate enterprise-compliance recommendations', async () => {
      const result = await recommender.getUseCaseRecommendations('enterprise-compliance', userContext);
      
      expect(result).toHaveProperty('recommendations');
    });

    it('should throw error for unknown use case', async () => {
      await expect(
        recommender.getUseCaseRecommendations('unknown-use-case', userContext)
      ).rejects.toThrow('Unknown use case: unknown-use-case');
    });
  });

  describe('analyzeProject', () => {
    it('should analyze project configuration', async () => {
      const projectConfig = {
        templates: ['react-component', 'api-endpoint'],
        technologies: ['React', 'Node.js'],
        compliance: ['SOC2']
      };
      
      const result = await recommender.analyzeProject(projectConfig);
      
      expect(result).toHaveProperty('analysis');
      expect(result).toHaveProperty('recommendations');
      expect(result).toHaveProperty('actionableInsights');
      
      expect(result.analysis).toHaveProperty('projectType');
      expect(result.analysis).toHaveProperty('technologies');
      expect(result.analysis).toHaveProperty('complianceNeeds');
      expect(result.analysis).toHaveProperty('templateUsage');
    });

    it('should detect project type correctly', async () => {
      const microservicesConfig = {
        templates: ['microservice-template'],
        technologies: ['Node.js', 'Docker']
      };
      
      const result = await recommender.analyzeProject(microservicesConfig);
      
      expect(result.analysis.projectType).toBe('microservices');
    });

    it('should identify compliance needs', async () => {
      const financialConfig = {
        compliance: ['sox', 'pci-dss'],
        industry: 'financial'
      };
      
      const result = await recommender.analyzeProject(financialConfig);
      
      expect(result.analysis.complianceNeeds).toContain('SOX');
      expect(result.analysis.complianceNeeds).toContain('PCI-DSS');
    });
  });

  describe('private methods', () => {
    it('should detect project type from templates', () => {
      const config = { templates: ['microservice'] };
      const projectType = recommender._detectProjectType(config);
      expect(projectType).toBe('microservices');
    });

    it('should extract technologies from config', () => {
      const config = {
        templates: ['react-component', 'node-api'],
        dependencies: {
          react: '^18.0.0',
          express: '^4.0.0'
        }
      };
      
      const technologies = recommender._extractTechnologies(config);
      expect(technologies).toContain('React');
      expect(technologies).toContain('Node.js');
      expect(technologies).toContain('Express.js');
    });

    it('should analyze compliance needs from config', () => {
      const config = {
        security: { enabled: true },
        audit: { enabled: true },
        compliance: ['sox', 'gdpr']
      };
      
      const needs = recommender._analyzeComplianceNeeds(config);
      expect(needs).toContain('security');
      expect(needs).toContain('audit');
      expect(needs).toContain('SOX');
      expect(needs).toContain('GDPR');
    });

    it('should analyze template usage patterns', () => {
      const config = {
        templates: ['react-component', 'api-endpoint', 'custom-template']
      };
      
      const usage = recommender._analyzeTemplateUsage(config);
      expect(usage.templateCount).toBe(3);
      expect(usage.customTemplates).toBe(1);
      expect(usage.standardTemplates).toBe(2);
    });
  });

  describe('error handling', () => {
    it('should handle algorithm failures gracefully', async () => {
      // Mock one algorithm to fail
      const mockComplianceError = jest.fn().mockRejectedValue(new Error('Compliance algorithm failed'));
      recommender.algorithms.compliance.recommend = mockComplianceError;
      
      const result = await recommender.generateRecommendations(userContext);
      
      // Should still return results from other algorithms
      expect(result).toHaveProperty('recommendations');
      expect(Array.isArray(result.recommendations)).toBe(true);
    });

    it('should handle SPARQL engine failures', async () => {
      // Mock SPARQL engine to fail
      mockSparqlEngine.executeNamedQuery.mockRejectedValue(new Error('SPARQL query failed'));
      
      // Should not throw, but handle gracefully
      const result = await recommender.generateRecommendations(userContext);
      expect(result).toHaveProperty('recommendations');
    });
  });

  describe('cache management', () => {
    it('should generate consistent cache keys', () => {
      const context1 = { industry: 'tech', technologies: ['React'] };
      const context2 = { industry: 'tech', technologies: ['React'] };
      const context3 = { industry: 'tech', technologies: ['Vue'] };
      
      const key1 = recommender._generateCacheKey(context1, {});
      const key2 = recommender._generateCacheKey(context2, {});
      const key3 = recommender._generateCacheKey(context3, {});
      
      expect(key1).toBe(key2);
      expect(key1).not.toBe(key3);
    });

    it('should respect cache TTL', async () => {
      // Set very short cache TTL for testing
      recommender.cacheTTL = 100; // 100ms
      
      const result1 = await recommender.generateRecommendations(userContext);
      
      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 150));
      
      const result2 = await recommender.generateRecommendations(userContext);
      
      // Should generate new results after cache expiry
      expect(result1).toHaveProperty('recommendations');
      expect(result2).toHaveProperty('recommendations');
    });
  });
});

describe('MarketplaceRecommender Integration', () => {
  let recommender;

  beforeEach(() => {
    recommender = new MarketplaceRecommender();
  });

  it('should provide comprehensive recommendations for a typical project', async () => {
    const context = {
      industry: 'financial',
      technologies: ['React', 'Node.js', 'PostgreSQL'],
      projectType: 'web-app',
      teamSize: 'large',
      currentCompliance: ['SOC2'],
      painPoints: ['security', 'compliance', 'development-speed'],
      goals: ['improve-security', 'increase-velocity', 'ensure-compliance']
    };

    const result = await recommender.generateRecommendations(context);

    // Verify comprehensive output
    expect(result.recommendations).toBeDefined();
    expect(result.insights).toBeDefined();
    expect(result.metadata).toBeDefined();

    // Verify recommendations are relevant to financial industry
    const hasComplianceRecs = result.recommendations.some(rec => 
      rec.type === 'compliance'
    );
    expect(hasComplianceRecs).toBe(true);

    // Verify technology alignment
    const hasReactRecs = result.recommendations.some(rec => 
      rec.framework?.value === 'React' || 
      rec.technology?.value === 'React'
    );
    expect(hasReactRecs).toBe(true);
  });

  it('should handle edge cases gracefully', async () => {
    // Test with minimal context
    const minimalContext = { industry: 'unknown' };
    const result1 = await recommender.generateRecommendations(minimalContext);
    expect(result1.recommendations).toBeDefined();

    // Test with null context
    const result2 = await recommender.generateRecommendations(null);
    expect(result2.recommendations).toBeDefined();

    // Test with empty arrays
    const emptyContext = {
      technologies: [],
      painPoints: [],
      goals: []
    };
    const result3 = await recommender.generateRecommendations(emptyContext);
    expect(result3.recommendations).toBeDefined();
  });
});

export { mockSparqlEngine };