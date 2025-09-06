/**
 * Semantic Server Tests
 * Tests for N3/TTL integration and semantic reasoning capabilities
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SemanticServer } from '../../src/mcp/semantic-server.js';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFile, mkdir } from 'node:fs/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));
const testDataDir = join(__dirname, '../fixtures/semantic');

describe('SemanticServer', () => {
  let semanticServer: SemanticServer;
  let mockTemplatePath: string;

  beforeEach(async () => {
    semanticServer = new SemanticServer();
    
    // Create test data directory
    await mkdir(testDataDir, { recursive: true });
    
    // Create mock template file
    mockTemplatePath = join(testDataDir, 'test-template.njk');
    const mockTemplateContent = `---
to: src/api/{{ name }}.ts
inject: false
---
/**
 * {{ name }} API Service
 */
export class {{ name }}Service {
  async getUsers(): Promise<User[]> {
    // Database access
    return await this.userRepository.findAll();
  }
  
  async createPayment(data: PaymentData): Promise<Payment> {
    // Financial transaction processing
    return await this.paymentProcessor.process(data);
  }
}`;
    
    await writeFile(mockTemplatePath, mockTemplateContent);
  });

  describe('Template Validation', () => {
    it('should validate template with compliance schemas', async () => {
      const result = await semanticServer.validateTemplate(
        mockTemplatePath,
        undefined,
        {
          compliance: ['API_GOVERNANCE'],
          strictMode: false
        }
      );

      expect(result).toMatchObject({
        valid: expect.any(Boolean),
        score: expect.any(Number),
        violations: expect.any(Array),
        metadata: expect.any(Object)
      });

      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });

    it('should identify API governance violations', async () => {
      const result = await semanticServer.validateTemplate(
        mockTemplatePath,
        undefined,
        {
          compliance: ['API_GOVERNANCE'],
          strictMode: true
        }
      );

      // Should detect API endpoints without proper governance
      const apiViolations = result.violations.filter(v => 
        v.rule.includes('API') || v.message.toLowerCase().includes('api')
      );

      expect(apiViolations.length).toBeGreaterThan(0);
    });

    it('should detect SOX compliance issues for financial templates', async () => {
      const result = await semanticServer.validateTemplate(
        mockTemplatePath,
        undefined,
        {
          compliance: ['SOX'],
          strictMode: false
        }
      );

      // Should detect financial data processing requiring SOX compliance
      expect(result.violations.some(v => 
        v.rule.includes('SOX') || v.message.toLowerCase().includes('audit')
      )).toBe(true);
    });

    it('should provide remediation suggestions', async () => {
      const result = await semanticServer.validateTemplate(
        mockTemplatePath,
        undefined,
        {
          compliance: ['API_GOVERNANCE', 'SOX'],
          strictMode: false
        }
      );

      const violationsWithSuggestions = result.violations.filter(v => v.suggestion);
      expect(violationsWithSuggestions.length).toBeGreaterThan(0);
    });
  });

  describe('N3 Reasoning', () => {
    it('should enhance template context through reasoning', async () => {
      const templateVars = {
        apiType: 'rest',
        isPublic: true,
        processesFinancialData: false
      };

      const result = await semanticServer.applyReasoning(
        {
          rules: ['# Simple test rule\n@prefix api: <http://unjucks.dev/api/> .\n{ ?x api:isPublic true } => { ?x api:requiresAuthentication true } .'],
          premises: [],
          depth: 2,
          mode: 'forward'
        },
        templateVars
      );

      expect(result.templateContext).toMatchObject(templateVars);
      expect(result.derivedFacts).toBeInstanceOf(Array);
      expect(result.metadata).toHaveProperty('rulesApplied');
      expect(result.metadata).toHaveProperty('derivedFactsCount');
    });

    it('should apply governance rules correctly', async () => {
      const templateVars = {
        generatesEndpoint: true,
        isPublic: true,
        hasFinancialData: true
      };

      const result = await semanticServer.applyReasoning(
        {
          rules: [
            `@prefix template: <http://unjucks.dev/template/> .
             @prefix api: <http://unjucks.dev/api/> .
             { ?ctx api:generatesEndpoint true ; api:isPublic true }
             => 
             { ?ctx api:requiresAuthentication true ; api:requiresRateLimiting true } .`
          ],
          premises: [],
          depth: 3,
          mode: 'forward'
        },
        templateVars
      );

      expect(result.derivedFacts.length).toBeGreaterThan(0);
      expect(result.metadata.derivedFactsCount).toBeGreaterThan(0);
    });

    it('should handle reasoning errors gracefully', async () => {
      const templateVars = { test: 'value' };

      await expect(
        semanticServer.applyReasoning(
          {
            rules: ['invalid N3 rule syntax'],
            premises: [],
            depth: 1,
            mode: 'forward'
          },
          templateVars
        )
      ).rejects.toThrow();
    });
  });

  describe('Knowledge Querying', () => {
    it('should query knowledge graph with pattern matching', async () => {
      const result = await semanticServer.queryKnowledge(
        {
          pattern: {
            predicate: 'http://unjucks.dev/api/generatesEndpoint'
          },
          limit: 10
        },
        { useReasoning: false }
      );

      expect(result.results).toBeInstanceOf(Array);
      expect(result.metadata).toHaveProperty('totalResults');
      expect(result.metadata).toHaveProperty('storeSize');
    });

    it('should apply reasoning to query results when requested', async () => {
      const result = await semanticServer.queryKnowledge(
        {
          pattern: {
            subject: 'http://unjucks.dev/template/test'
          },
          reasoning: true
        },
        { useReasoning: true }
      );

      expect(result.metadata.reasoningApplied).toBe(true);
    });

    it('should respect query limits and offsets', async () => {
      const result1 = await semanticServer.queryKnowledge(
        {
          pattern: {},
          limit: 5,
          offset: 0
        }
      );

      const result2 = await semanticServer.queryKnowledge(
        {
          pattern: {},
          limit: 5,
          offset: 5
        }
      );

      expect(result1.results.length).toBeLessThanOrEqual(5);
      expect(result2.results.length).toBeLessThanOrEqual(5);
    });
  });

  describe('Compliance Checking', () => {
    it('should check compliance against multiple policies', async () => {
      const result = await semanticServer.checkCompliance(
        mockTemplatePath,
        ['SOX', 'GDPR'],
        { strictMode: false }
      );

      expect(result.valid).toBeDefined();
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.violations).toBeInstanceOf(Array);
      expect(result.metadata).toHaveProperty('policies');
      expect(result.metadata.policies).toEqual(['SOX', 'GDPR']);
    });

    it('should enforce strict mode correctly', async () => {
      const strictResult = await semanticServer.checkCompliance(
        mockTemplatePath,
        ['API_GOVERNANCE'],
        { strictMode: true }
      );

      const lenientResult = await semanticServer.checkCompliance(
        mockTemplatePath,
        ['API_GOVERNANCE'],
        { strictMode: false }
      );

      expect(strictResult.metadata.strictMode).toBe(true);
      expect(lenientResult.metadata.strictMode).toBe(false);
    });

    it('should calculate compliance scores correctly', async () => {
      const result = await semanticServer.checkCompliance(
        mockTemplatePath,
        ['API_GOVERNANCE'],
        { strictMode: false }
      );

      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);

      // Score should be inversely related to number of violations
      if (result.violations.length === 0) {
        expect(result.score).toBe(100);
      } else {
        expect(result.score).toBeLessThan(100);
      }
    });

    it('should handle unknown compliance policies gracefully', async () => {
      const result = await semanticServer.checkCompliance(
        mockTemplatePath,
        ['UNKNOWN_POLICY'],
        { strictMode: false }
      );

      expect(result.violations.length).toBe(0);
      expect(result.score).toBeGreaterThan(0);
    });
  });

  describe('Schema Loading', () => {
    it('should load and apply compliance schemas', async () => {
      // This test verifies that compliance schemas are loaded during initialization
      expect(semanticServer).toBeInstanceOf(SemanticServer);
      
      // Test that SOX schema is loaded by checking validation
      const result = await semanticServer.validateTemplate(
        mockTemplatePath,
        undefined,
        { compliance: ['SOX'] }
      );
      
      expect(result.metadata).toHaveProperty('templatePath');
    });

    it('should handle RDF parsing errors gracefully', async () => {
      // Create invalid template path
      const invalidPath = join(testDataDir, 'nonexistent-template.njk');
      
      const result = await semanticServer.validateTemplate(
        invalidPath,
        undefined,
        { compliance: ['API_GOVERNANCE'] }
      );

      expect(result.valid).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.violations[0].severity).toBe('error');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid template paths', async () => {
      const result = await semanticServer.validateTemplate(
        '/nonexistent/path/template.njk',
        undefined,
        { compliance: ['API_GOVERNANCE'] }
      );

      expect(result.valid).toBe(false);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].severity).toBe('error');
      expect(result.violations[0].rule).toBe('SYSTEM_ERROR');
    });

    it('should handle empty template variables', async () => {
      const result = await semanticServer.applyReasoning(
        {
          rules: ['@prefix test: <http://test.org/> . { ?x test:prop ?y } => { ?x test:derived true } .'],
          premises: [],
          depth: 1,
          mode: 'forward'
        },
        {}
      );

      expect(result.templateContext).toEqual({});
      expect(result.derivedFacts).toBeInstanceOf(Array);
    });

    it('should handle malformed N3 rules', async () => {
      await expect(
        semanticServer.applyReasoning(
          {
            rules: ['this is not valid N3 syntax'],
            premises: [],
            depth: 1,
            mode: 'forward'
          },
          { test: 'value' }
        )
      ).rejects.toThrow('Reasoning failed');
    });
  });
});