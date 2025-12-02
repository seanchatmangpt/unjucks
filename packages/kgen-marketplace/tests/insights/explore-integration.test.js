/**
 * Tests for ExploreIntegration
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ExploreIntegration } from '../../src/explore-integration.js';

// Mock the MarketplaceRecommender
jest.mock('../../src/insights/recommender.js', () => ({
  MarketplaceRecommender: jest.fn().mockImplementation(() => ({
    generateRecommendations: jest.fn().mockResolvedValue({
      recommendations: [
        {
          name: { value: 'React Template Pack' },
          type: 'template',
          score: 0.85,
          category: { value: 'frontend' },
          description: { value: 'Comprehensive React templates' },
          reasoning: 'High compatibility with your React stack',
          ranking: { tier: 'high' },
          downloads: { value: '2500' },
          rating: { value: '4.5' },
          complexity: { value: 'medium' },
          pack: { value: 'http://marketplace.kgen.ai/packs/react-templates' }
        },
        {
          name: { value: 'Security Compliance Pack' },
          type: 'compliance',
          score: 0.92,
          category: { value: 'security' },
          description: { value: 'Enterprise security templates' },
          reasoning: 'Addresses security pain points',
          ranking: { tier: 'top' },
          downloads: { value: '1800' },
          rating: { value: '4.8' },
          complexity: { value: 'high' }
        }
      ],
      insights: {
        summary: {
          totalRecommendations: 2,
          averageScore: 0.885,
          topCategory: 'security'
        },
        patterns: {
          dominantVerticals: [['security', 1], ['frontend', 1]]
        }
      }
    }),
    getInsights: jest.fn().mockResolvedValue({
      type: 'compliance-gaps',
      insights: [
        { framework: 'GDPR', gap: 'missing', priority: 'high' },
        { framework: 'SOC2', gap: 'partial', priority: 'medium' }
      ]
    }),
    analyzeProject: jest.fn().mockResolvedValue({
      analysis: {
        projectType: 'web-app',
        technologies: ['React', 'Node.js'],
        complianceNeeds: ['security'],
        templateUsage: {
          templateCount: 3,
          customTemplates: 1,
          standardTemplates: 2
        }
      },
      recommendations: [
        {
          name: 'Testing Framework',
          type: 'template',
          reasoning: 'Missing test infrastructure'
        }
      ],
      actionableInsights: [
        {
          type: 'template_optimization',
          priority: 'high',
          message: 'Consider adding more templates',
          recommendation: [
            { name: 'Jest Testing Template' },
            { name: 'API Documentation Template' }
          ]
        }
      ]
    })
  }))
}));

describe('ExploreIntegration', () => {
  let integration;
  let exploreContext;

  beforeEach(() => {
    jest.clearAllMocks();
    integration = new ExploreIntegration();
    
    exploreContext = {
      projectType: 'web-app',
      technologies: ['React', 'Node.js', 'TypeScript'],
      industry: 'technology',
      teamSize: 'medium',
      urgency: 'normal',
      currentPackages: {
        templates: ['basic-component'],
        packages: ['lodash', 'axios'],
        compliance: ['SOC2']
      },
      painPoints: ['development-speed', 'security'],
      goals: ['improve-velocity', 'enhance-security']
    };
  });

  describe('getExploreRecommendations', () => {
    it('should transform explore context and return CLI-friendly recommendations', async () => {
      const result = await integration.getExploreRecommendations(exploreContext);

      expect(result).toHaveProperty('recommendations');
      expect(result).toHaveProperty('insights');
      expect(result).toHaveProperty('actions');
      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('metadata');

      // Verify CLI-friendly format
      expect(Array.isArray(result.recommendations)).toBe(true);
      expect(result.recommendations[0]).toHaveProperty('name');
      expect(result.recommendations[0]).toHaveProperty('type');
      expect(result.recommendations[0]).toHaveProperty('score');
      expect(result.recommendations[0]).toHaveProperty('priority');
      expect(result.recommendations[0]).toHaveProperty('metrics');
      expect(result.recommendations[0]).toHaveProperty('implementation');
    });

    it('should generate actionable commands', async () => {
      const result = await integration.getExploreRecommendations(exploreContext);

      expect(result.actions).toHaveProperty('immediate');
      expect(result.actions).toHaveProperty('planned');
      expect(result.actions).toHaveProperty('investigate');

      // Verify command structure
      if (result.actions.immediate.length > 0) {
        const command = result.actions.immediate[0];
        expect(command).toHaveProperty('action');
        expect(command).toHaveProperty('description');
        expect(command).toHaveProperty('reasoning');
        expect(command).toHaveProperty('priority');
        expect(command).toHaveProperty('estimatedTime');
      }
    });

    it('should provide summary statistics', async () => {
      const result = await integration.getExploreRecommendations(exploreContext);

      expect(result.summary).toHaveProperty('totalRecommendations');
      expect(result.summary).toHaveProperty('byType');
      expect(result.summary).toHaveProperty('byPriority');
      expect(result.summary).toHaveProperty('topRecommendation');
      expect(result.summary).toHaveProperty('averageScore');

      expect(typeof result.summary.totalRecommendations).toBe('number');
      expect(typeof result.summary.averageScore).toBe('number');
    });
  });

  describe('getSpecificInsights', () => {
    it('should get compliance gaps insights', async () => {
      const result = await integration.getSpecificInsights('compliance-gaps', exploreContext);

      expect(result).toHaveProperty('type', 'compliance-gaps');
      expect(result).toHaveProperty('insights');
      expect(result).toHaveProperty('recommendations');
      expect(result).toHaveProperty('visualization');
    });

    it('should format insights for CLI display', async () => {
      const result = await integration.getSpecificInsights('compliance-gaps', exploreContext);

      expect(result.insights).toHaveProperty('summary');
      expect(result.insights).toHaveProperty('keyFindings');
      expect(result.insights).toHaveProperty('recommendations');
      expect(result.insights).toHaveProperty('dataPoints');
    });

    it('should extract actionable recommendations', async () => {
      const result = await integration.getSpecificInsights('roi-opportunities', exploreContext);

      expect(Array.isArray(result.recommendations)).toBe(true);
      
      if (result.recommendations.length > 0) {
        const rec = result.recommendations[0];
        expect(rec).toHaveProperty('type');
        expect(rec).toHaveProperty('title');
        expect(rec).toHaveProperty('timeframe');
      }
    });
  });

  describe('analyzeProject', () => {
    const projectConfig = {
      templates: ['react-component', 'api-endpoint'],
      technologies: ['React', 'Node.js'],
      compliance: ['SOC2']
    };

    const projectStructure = {
      files: ['src/components/', 'src/api/', 'package.json', 'README.md']
    };

    it('should analyze project configuration and structure', async () => {
      const result = await integration.analyzeProject(projectConfig, projectStructure);

      expect(result).toHaveProperty('analysis');
      expect(result).toHaveProperty('recommendations');
      expect(result).toHaveProperty('quickActions');
      expect(result).toHaveProperty('insights');
      expect(result).toHaveProperty('nextSteps');
    });

    it('should identify project structure gaps', async () => {
      const structureWithGaps = {
        files: ['src/components/', 'package.json'] // Missing tests, docs, CI
      };

      const result = await integration.analyzeProject(projectConfig, structureWithGaps);

      expect(result.insights).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'project-gaps'
          })
        ])
      );
    });

    it('should generate quick actions', async () => {
      const result = await integration.analyzeProject(projectConfig, projectStructure);

      expect(Array.isArray(result.quickActions)).toBe(true);
      
      if (result.quickActions.length > 0) {
        const action = result.quickActions[0];
        expect(action).toHaveProperty('type');
        expect(action).toHaveProperty('title');
        expect(action).toHaveProperty('commands');
        expect(action).toHaveProperty('estimatedTime');
      }
    });

    it('should provide next steps', async () => {
      const result = await integration.analyzeProject(projectConfig, projectStructure);

      expect(Array.isArray(result.nextSteps)).toBe(true);
      expect(result.nextSteps.length).toBeGreaterThan(0);

      const step = result.nextSteps[0];
      expect(step).toHaveProperty('step');
      expect(step).toHaveProperty('action');
      expect(step).toHaveProperty('description');
      expect(step).toHaveProperty('command');
      expect(step).toHaveProperty('estimatedTime');
    });
  });

  describe('generateImplementationCommands', () => {
    const recommendations = [
      {
        name: { value: 'React Template Pack' },
        type: 'template',
        ranking: { tier: 'high' },
        implementationGuide: {
          setupSteps: ['Install', 'Configure', 'Test']
        }
      },
      {
        name: { value: 'Security Pack' },
        type: 'compliance',
        ranking: { tier: 'top' }
      },
      {
        name: { value: 'Utility Package' },
        type: 'package',
        ranking: { tier: 'medium' }
      }
    ];

    it('should generate CLI commands for recommendations', () => {
      const commands = integration.generateImplementationCommands(recommendations);

      expect(Array.isArray(commands)).toBe(true);
      expect(commands.length).toBeGreaterThan(0);

      // Verify template command
      const templateCommand = commands.find(cmd => cmd.category === 'template');
      expect(templateCommand).toBeDefined();
      expect(templateCommand.command).toContain('kgen add template');
      expect(templateCommand).toHaveProperty('description');
      expect(templateCommand).toHaveProperty('priority');
      expect(templateCommand).toHaveProperty('estimatedTime');

      // Verify compliance command
      const complianceCommand = commands.find(cmd => cmd.category === 'compliance');
      expect(complianceCommand).toBeDefined();
      expect(complianceCommand.command).toContain('kgen add compliance-pack');

      // Verify package command
      const packageCommand = commands.find(cmd => cmd.category === 'general');
      expect(packageCommand).toBeDefined();
      expect(packageCommand.command).toContain('kgen add package');
    });

    it('should include configuration commands when needed', () => {
      const commands = integration.generateImplementationCommands(recommendations);

      const configCommand = commands.find(cmd => cmd.category === 'configuration');
      expect(configCommand).toBeDefined();
      expect(configCommand.command).toContain('kgen configure');
    });

    it('should handle empty recommendations gracefully', () => {
      const commands = integration.generateImplementationCommands([]);
      expect(Array.isArray(commands)).toBe(true);
      expect(commands.length).toBe(0);
    });
  });

  describe('getMarketIntelligence', () => {
    it('should provide market intelligence data', async () => {
      const result = await integration.getMarketIntelligence();

      expect(result).toHaveProperty('trends');
      expect(result).toHaveProperty('opportunities');
      expect(result).toHaveProperty('recommendations');
      expect(result).toHaveProperty('visualization');
    });

    it('should format trends for CLI display', async () => {
      const result = await integration.getMarketIntelligence();

      expect(result.trends).toHaveProperty('emerging');
      expect(result.trends).toHaveProperty('declining');
      expect(result.trends).toHaveProperty('stable');

      expect(Array.isArray(result.trends.emerging)).toBe(true);
      expect(Array.isArray(result.trends.declining)).toBe(true);
      expect(Array.isArray(result.trends.stable)).toBe(true);
    });

    it('should identify market opportunities', async () => {
      const result = await integration.getMarketIntelligence();

      expect(Array.isArray(result.opportunities)).toBe(true);
      
      if (result.opportunities.length > 0) {
        const opportunity = result.opportunities[0];
        expect(opportunity).toHaveProperty('type');
        expect(opportunity).toHaveProperty('title');
        expect(opportunity).toHaveProperty('risk');
        expect(opportunity).toHaveProperty('potential');
      }
    });

    it('should provide market visualization data', async () => {
      const result = await integration.getMarketIntelligence();

      expect(result.visualization).toHaveProperty('trends');
      expect(result.visualization).toHaveProperty('adoption');

      expect(result.visualization.trends).toHaveProperty('type');
      expect(result.visualization.trends).toHaveProperty('title');
      expect(result.visualization.trends).toHaveProperty('data');
    });
  });

  describe('context transformation', () => {
    it('should transform explore context to recommendation context', () => {
      const transformed = integration._transformExploreContext(exploreContext);

      expect(transformed).toHaveProperty('project');
      expect(transformed).toHaveProperty('industry');
      expect(transformed).toHaveProperty('teamSize');
      expect(transformed).toHaveProperty('urgency');
      expect(transformed).toHaveProperty('painPoints');
      expect(transformed).toHaveProperty('goals');

      expect(transformed.project).toHaveProperty('projectType');
      expect(transformed.project).toHaveProperty('technologies');
      expect(transformed.project).toHaveProperty('existingTemplates');
      expect(transformed.project).toHaveProperty('developmentStage');

      expect(transformed.project.projectType).toBe('web-app');
      expect(transformed.project.technologies).toContain('React');
      expect(transformed.industry).toBe('technology');
    });

    it('should handle missing context fields gracefully', () => {
      const minimalContext = { projectType: 'library' };
      const transformed = integration._transformExploreContext(minimalContext);

      expect(transformed.project.projectType).toBe('library');
      expect(transformed.industry).toBe('technology'); // default
      expect(transformed.teamSize).toBe('medium'); // default
      expect(Array.isArray(transformed.project.technologies)).toBe(true);
      expect(Array.isArray(transformed.painPoints)).toBe(true);
    });
  });

  describe('CLI formatting', () => {
    const mockRecommendations = {
      recommendations: [
        {
          name: { value: 'Test Package' },
          type: 'template',
          score: 0.85,
          category: { value: 'testing' },
          description: { value: 'Testing utilities' },
          reasoning: 'Improves test coverage',
          ranking: { tier: 'high' },
          downloads: { value: '1500' },
          rating: { value: '4.2' },
          complexity: { value: 'low' },
          pack: { value: 'http://example.com/test-pack' }
        }
      ]
    };

    it('should format recommendations for CLI display', () => {
      const formatted = integration._formatForCLI(mockRecommendations);

      expect(Array.isArray(formatted)).toBe(true);
      expect(formatted[0]).toHaveProperty('name', 'Test Package');
      expect(formatted[0]).toHaveProperty('type', 'template');
      expect(formatted[0]).toHaveProperty('score', 85); // Percentage
      expect(formatted[0]).toHaveProperty('category', 'testing');
      expect(formatted[0]).toHaveProperty('priority', 'high');
      expect(formatted[0]).toHaveProperty('metrics');
      expect(formatted[0]).toHaveProperty('implementation');

      expect(formatted[0].metrics).toHaveProperty('downloads', '1500');
      expect(formatted[0].metrics).toHaveProperty('rating', '4.2');

      expect(formatted[0].implementation).toHaveProperty('difficulty', 'low');
      expect(formatted[0].implementation).toHaveProperty('estimatedTime');
    });

    it('should handle missing recommendation fields', () => {
      const incompleteRecommendations = {
        recommendations: [
          {
            name: { value: 'Minimal Package' },
            type: 'package'
            // Missing many optional fields
          }
        ]
      };

      const formatted = integration._formatForCLI(incompleteRecommendations);

      expect(formatted[0]).toHaveProperty('name', 'Minimal Package');
      expect(formatted[0]).toHaveProperty('type', 'package');
      expect(formatted[0]).toHaveProperty('score', 0); // Default
      expect(formatted[0]).toHaveProperty('category', 'general'); // Default
      expect(formatted[0]).toHaveProperty('priority', 'medium'); // Default
    });
  });

  describe('implementation time estimation', () => {
    it('should estimate time based on complexity and type', () => {
      const templateRec = { complexity: { value: 'low' }, type: 'template' };
      const time1 = integration._estimateImplementationTime(templateRec);
      expect(time1).toBe('2-5 min');

      const complexPackageRec = { complexity: { value: 'high' }, type: 'package' };
      const time2 = integration._estimateImplementationTime(complexPackageRec);
      expect(time2).toBe('20-45 min');

      const complianceRec = { complexity: { value: 'medium' }, type: 'compliance' };
      const time3 = integration._estimateImplementationTime(complianceRec);
      expect(time3).toBe('30-60 min');
    });

    it('should provide default time for unknown types', () => {
      const unknownRec = { complexity: { value: 'medium' }, type: 'unknown' };
      const time = integration._estimateImplementationTime(unknownRec);
      expect(time).toBe('10-20 min');
    });
  });

  describe('gap recommendations', () => {
    it('should provide recommendations for testing gap', () => {
      const recommendations = integration._getRecommendationsForGap('testing');
      
      expect(Array.isArray(recommendations)).toBe(true);
      expect(recommendations.length).toBeGreaterThan(0);
      
      const testingRec = recommendations.find(rec => rec.name === 'jest-template');
      expect(testingRec).toBeDefined();
      expect(testingRec.type).toBe('template');
      expect(testingRec.priority).toBe('high');
    });

    it('should provide recommendations for ci-cd gap', () => {
      const recommendations = integration._getRecommendationsForGap('ci-cd');
      
      expect(Array.isArray(recommendations)).toBe(true);
      
      const ciRec = recommendations.find(rec => rec.name === 'github-actions-template');
      expect(ciRec).toBeDefined();
      expect(ciRec.type).toBe('template');
    });

    it('should return empty array for unknown gaps', () => {
      const recommendations = integration._getRecommendationsForGap('unknown-gap');
      expect(Array.isArray(recommendations)).toBe(true);
      expect(recommendations.length).toBe(0);
    });
  });

  describe('error handling', () => {
    it('should handle recommender errors gracefully', async () => {
      const errorIntegration = new ExploreIntegration();
      errorIntegration.recommender.generateRecommendations = jest.fn()
        .mockRejectedValue(new Error('Recommender failed'));

      await expect(
        errorIntegration.getExploreRecommendations(exploreContext)
      ).rejects.toThrow('Recommender failed');
    });

    it('should handle invalid explore context', async () => {
      const result = await integration.getExploreRecommendations(null);
      
      // Should not throw, but return valid structure
      expect(result).toHaveProperty('recommendations');
      expect(result).toHaveProperty('summary');
    });

    it('should handle empty recommendations gracefully', async () => {
      integration.recommender.generateRecommendations = jest.fn()
        .mockResolvedValue({
          recommendations: [],
          insights: {}
        });

      const result = await integration.getExploreRecommendations(exploreContext);
      
      expect(result.recommendations).toHaveLength(0);
      expect(result.summary.totalRecommendations).toBe(0);
      expect(result.summary.averageScore).toBe(0);
    });
  });
});

describe('ExploreIntegration End-to-End', () => {
  let integration;

  beforeEach(() => {
    integration = new ExploreIntegration();
  });

  it('should provide complete workflow for typical user', async () => {
    const userContext = {
      projectType: 'web-app',
      technologies: ['React', 'TypeScript', 'Node.js'],
      industry: 'financial',
      teamSize: 'large',
      painPoints: ['compliance', 'security', 'testing'],
      goals: ['improve-compliance', 'enhance-security', 'increase-test-coverage']
    };

    // Get recommendations
    const recommendations = await integration.getExploreRecommendations(userContext);
    expect(recommendations.recommendations.length).toBeGreaterThan(0);

    // Generate implementation commands
    const commands = integration.generateImplementationCommands(recommendations.recommendations);
    expect(commands.length).toBeGreaterThan(0);

    // Get specific insights
    const complianceInsights = await integration.getSpecificInsights('compliance-gaps', userContext);
    expect(complianceInsights.type).toBe('compliance-gaps');

    // Verify all components work together
    expect(recommendations.actions.immediate.length).toBeGreaterThanOrEqual(0);
    expect(recommendations.actions.planned.length).toBeGreaterThanOrEqual(0);
    expect(recommendations.summary.totalRecommendations).toBeGreaterThan(0);
  });
});