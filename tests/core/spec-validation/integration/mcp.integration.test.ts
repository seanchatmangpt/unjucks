import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MCPValidationIntegration } from '../../../../src/core/spec-validation/integration/mcp.integration.js';
import type { 
  ValidationContext, 
  AIValidationInsight,
  AIValidationConfig
} from '../../../../src/core/spec-validation/types/validation.types.js';

describe('MCPValidationIntegration', () => {
  let integration: MCPValidationIntegration;
  let mockConfig: AIValidationConfig;
  let mockContext: ValidationContext;
  let mockSpecification: any;

  beforeEach(() => {
    mockConfig = {
      enabled: true,
      models: [{
        provider: 'claude',
        model: 'claude-3-sonnet',
        temperature: 0.1,
        maxTokens: 2000,
      }],
      prompts: {
        completenessCheck: 'Test completeness prompt',
        consistencyCheck: 'Test consistency prompt',
        qualityAssessment: 'Test quality prompt',
        riskAnalysis: 'Test risk prompt',
      },
      confidence: {
        threshold: 0.8,
        requireHuman: false,
      },
    };

    integration = new MCPValidationIntegration(mockConfig);

    mockContext = {
      specificationId: 'test-spec-001',
      validationId: 'validation-001',
      timestamp: new Date('2024-01-01T00:00:00Z'),
      version: '1.0.0',
      environment: 'development',
      options: {},
    };

    mockSpecification = {
      metadata: {
        id: 'spec-001',
        name: 'Test Specification',
        version: '1.0.0',
        description: 'This is a test specification for MCP integration testing',
        author: { name: 'Test Author' },
        created: '2024-01-01T00:00:00Z',
        lastModified: '2024-01-01T00:00:00Z',
        category: 'api',
        status: 'draft',
      },
      summary: {
        purpose: 'Test specification for MCP integration validation',
        scope: 'Covers MCP integration testing and validation functionality',
        stakeholders: [{ role: 'Developer', responsibilities: ['Testing'] }],
      },
      requirements: [{
        id: 'REQ-001',
        title: 'Test Requirement',
        description: 'This is a test requirement for MCP integration validation',
        type: 'functional',
        priority: 'must-have',
        rationale: 'Required for testing MCP integration functionality',
        acceptanceCriteria: [{
          id: 'AC-001',
          description: 'Test acceptance criterion for MCP integration',
        }],
      }],
    };
  });

  describe('initialization', () => {
    it('should initialize successfully with valid configuration', async () => {
      await expect(integration.initialize()).resolves.not.toThrow();
    });

    it('should handle initialization errors gracefully', async () => {
      const invalidConfig = {
        ...mockConfig,
        models: [{
          provider: 'claude' as const,
          model: 'invalid-model-name',
          temperature: 0.1,
          maxTokens: 2000,
        }],
      };

      const invalidIntegration = new MCPValidationIntegration(invalidConfig);
      
      await expect(invalidIntegration.initialize()).rejects.toThrow(
        'Failed to initialize MCP integration'
      );
    });

    it('should not reinitialize if already initialized', async () => {
      await integration.initialize();
      
      // Should not throw on second initialization
      await expect(integration.initialize()).resolves.not.toThrow();
    });
  });

  describe('validateCompleteness', () => {
    beforeEach(async () => {
      await integration.initialize();
    });

    it('should return completeness insights', async () => {
      const insights = await integration.validateCompleteness(mockSpecification, mockContext);
      
      expect(insights).toHaveLength(1);
      expect(insights[0].category).toBe('completeness');
      expect(insights[0].confidence).toBeGreaterThan(0);
      expect(insights[0].finding).toBeDefined();
      expect(insights[0].reasoning).toBeDefined();
      expect(insights[0].suggestions).toBeInstanceOf(Array);
    });

    it('should handle analysis failures gracefully', async () => {
      // Mock a scenario where MCP analysis fails
      const malformedSpec = null;
      
      const insights = await integration.validateCompleteness(malformedSpec, mockContext);
      
      // Should return empty array on failure, not throw
      expect(insights).toHaveLength(0);
    });

    it('should include related requirements in insights', async () => {
      const insights = await integration.validateCompleteness(mockSpecification, mockContext);
      
      expect(insights[0].relatedRequirements).toBeInstanceOf(Array);
      expect(insights[0].relatedRequirements.length).toBeGreaterThan(0);
    });
  });

  describe('validateConsistency', () => {
    beforeEach(async () => {
      await integration.initialize();
    });

    it('should return consistency insights', async () => {
      const insights = await integration.validateConsistency(mockSpecification, mockContext);
      
      expect(insights).toHaveLength(1);
      expect(insights[0].category).toBe('consistency');
      expect(insights[0].confidence).toBeGreaterThan(0);
      expect(insights[0].finding).toBeDefined();
      expect(insights[0].reasoning).toBeDefined();
      expect(insights[0].suggestions).toBeInstanceOf(Array);
    });

    it('should provide specific consistency recommendations', async () => {
      const insights = await integration.validateConsistency(mockSpecification, mockContext);
      
      expect(insights[0].suggestions.length).toBeGreaterThan(0);
      expect(insights[0].suggestions[0]).toContain('component');
    });
  });

  describe('assessQuality', () => {
    beforeEach(async () => {
      await integration.initialize();
    });

    it('should return quality assessment insights', async () => {
      const insights = await integration.assessQuality(mockSpecification, mockContext);
      
      expect(insights).toHaveLength(1);
      expect(insights[0].category).toBe('quality');
      expect(insights[0].confidence).toBeGreaterThan(0);
      expect(insights[0].finding).toBeDefined();
      expect(insights[0].reasoning).toBeDefined();
    });

    it('should provide quality improvement suggestions', async () => {
      const insights = await integration.assessQuality(mockSpecification, mockContext);
      
      expect(insights[0].suggestions.length).toBeGreaterThan(0);
      expect(insights[0].suggestions[0]).toContain('precise');
    });
  });

  describe('analyzeRisks', () => {
    beforeEach(async () => {
      await integration.initialize();
    });

    it('should return risk analysis insights', async () => {
      const insights = await integration.analyzeRisks(mockSpecification, mockContext);
      
      expect(insights).toHaveLength(1);
      expect(insights[0].category).toBe('risk');
      expect(insights[0].confidence).toBeGreaterThan(0);
      expect(insights[0].finding).toBeDefined();
      expect(insights[0].reasoning).toBeDefined();
    });

    it('should include risk mitigation suggestions', async () => {
      const insights = await integration.analyzeRisks(mockSpecification, mockContext);
      
      expect(insights[0].suggestions.length).toBeGreaterThan(0);
      expect(insights[0].suggestions[0]).toContain('phased');
    });

    it('should identify related requirements for risks', async () => {
      const insights = await integration.analyzeRisks(mockSpecification, mockContext);
      
      expect(insights[0].relatedRequirements.length).toBeGreaterThan(0);
    });
  });

  describe('insightsToValidationIssues', () => {
    beforeEach(async () => {
      await integration.initialize();
    });

    it('should convert high-confidence insights to validation issues', async () => {
      const mockInsights: AIValidationInsight[] = [{
        category: 'completeness',
        confidence: 0.9,
        finding: 'Missing critical information',
        reasoning: 'The specification lacks detail in several areas',
        suggestions: ['Add more details', 'Include examples'],
        relatedRequirements: ['REQ-001'],
      }];

      const issues = integration.insightsToValidationIssues(mockInsights);
      
      expect(issues).toHaveLength(1);
      expect(issues[0].ruleId).toBe('ai-completeness');
      expect(issues[0].severity).toBe('info');
      expect(issues[0].message).toBe('Missing critical information');
      expect(issues[0].description).toBe('The specification lacks detail in several areas');
      expect(issues[0].suggestion).toContain('Add more details');
      expect(issues[0].metadata.aiInsight).toBe(true);
      expect(issues[0].metadata.confidence).toBe(0.9);
    });

    it('should filter out low-confidence insights', async () => {
      const mockInsights: AIValidationInsight[] = [{
        category: 'quality',
        confidence: 0.5, // Below threshold
        finding: 'Low confidence finding',
        reasoning: 'This finding has low confidence',
        suggestions: ['Ignore this'],
        relatedRequirements: [],
      }];

      const issues = integration.insightsToValidationIssues(mockInsights);
      
      expect(issues).toHaveLength(0);
    });

    it('should handle different insight categories', async () => {
      const mockInsights: AIValidationInsight[] = [
        {
          category: 'completeness',
          confidence: 0.95,
          finding: 'Completeness issue',
          reasoning: 'Missing sections',
          suggestions: ['Add sections'],
          relatedRequirements: ['REQ-001'],
        },
        {
          category: 'consistency',
          confidence: 0.85,
          finding: 'Consistency issue',
          reasoning: 'Conflicting information',
          suggestions: ['Resolve conflicts'],
          relatedRequirements: ['REQ-002'],
        },
        {
          category: 'risk',
          confidence: 0.8,
          finding: 'Risk identified',
          reasoning: 'Potential implementation risk',
          suggestions: ['Mitigate risk'],
          relatedRequirements: ['REQ-003'],
        },
      ];

      const issues = integration.insightsToValidationIssues(mockInsights);
      
      expect(issues).toHaveLength(3);
      expect(issues.map(i => i.ruleId)).toEqual([
        'ai-completeness',
        'ai-consistency', 
        'ai-risk'
      ]);
    });

    it('should extract appropriate paths from insights', async () => {
      const mockInsights: AIValidationInsight[] = [{
        category: 'consistency',
        confidence: 0.9,
        finding: 'Cross-section issue',
        reasoning: 'Requirements and architecture mismatch',
        suggestions: ['Align sections'],
        relatedRequirements: ['REQ-001'],
      }];

      const issues = integration.insightsToValidationIssues(mockInsights);
      
      expect(issues[0].path).toBe('requirements[id="REQ-001"]');
    });
  });

  describe('error handling', () => {
    it('should handle uninitialized integration gracefully', async () => {
      const uninitializedIntegration = new MCPValidationIntegration(mockConfig);
      
      const insights = await uninitializedIntegration.validateCompleteness(
        mockSpecification, 
        mockContext
      );
      
      // Should initialize automatically and return insights
      expect(insights).toHaveLength(1);
    });

    it('should handle network or MCP errors gracefully', async () => {
      const faultyConfig = {
        ...mockConfig,
        models: [{
          provider: 'claude' as const,
          model: 'non-existent-model',
          temperature: 0.1,
          maxTokens: 2000,
        }],
      };

      const faultyIntegration = new MCPValidationIntegration(faultyConfig);
      
      // Should not throw, should return empty array
      const insights = await faultyIntegration.validateCompleteness(
        mockSpecification,
        mockContext
      );
      
      expect(insights).toHaveLength(0);
    });
  });

  describe('configuration validation', () => {
    it('should validate Claude model names', async () => {
      const invalidConfig = {
        ...mockConfig,
        models: [{
          provider: 'claude' as const,
          model: 'invalid-claude-model',
          temperature: 0.1,
          maxTokens: 2000,
        }],
      };

      const invalidIntegration = new MCPValidationIntegration(invalidConfig);
      
      await expect(invalidIntegration.initialize()).rejects.toThrow(
        'Invalid Claude model identifier'
      );
    });

    it('should accept valid model configurations', async () => {
      const validConfig = {
        ...mockConfig,
        models: [
          {
            provider: 'claude' as const,
            model: 'claude-3-sonnet',
            temperature: 0.1,
            maxTokens: 2000,
          },
          {
            provider: 'openai' as const,
            model: 'gpt-4',
            temperature: 0.2,
            maxTokens: 1500,
          },
        ],
      };

      const validIntegration = new MCPValidationIntegration(validConfig);
      
      await expect(validIntegration.initialize()).resolves.not.toThrow();
    });
  });
});