/**
 * Explore Command Tests
 * 
 * Tests for persona-driven marketplace exploration functionality.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MarketplaceAnalyzer } from '../../packages/kgen-cli/src/utils/marketplace-analyzer.js';
import { ROICalculator } from '../../packages/kgen-cli/src/utils/roi-calculator.js';
import { ComplianceMatrix } from '../../packages/kgen-cli/src/utils/compliance-matrix.js';
import { RiskAssessment } from '../../packages/kgen-cli/src/utils/risk-assessment.js';
import executiveView from '../../packages/kgen-cli/src/commands/explore/views/executive.js';
import architectView from '../../packages/kgen-cli/src/commands/explore/views/architect.js';
import developerView from '../../packages/kgen-cli/src/commands/explore/views/developer.js';

describe('Explore Command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('MarketplaceAnalyzer', () => {
    let analyzer;

    beforeEach(() => {
      analyzer = new MarketplaceAnalyzer();
    });

    it('should generate portfolio summary', async () => {
      const summary = await analyzer.getPortfolioSummary();
      
      expect(summary).toMatchObject({
        totalPacks: expect.any(Number),
        activeProjects: expect.any(Number),
        categoryBreakdown: expect.any(Object),
        utilizationRates: expect.any(Object),
        topPacks: expect.any(Array),
        velocityMetrics: expect.any(Object),
        timeMetrics: expect.any(Object),
        overview: expect.any(Object)
      });

      expect(summary.totalPacks).toBeGreaterThan(0);
      expect(summary.utilizationRates).toHaveProperty('overall');
      expect(summary.velocityMetrics).toHaveProperty('weeklyDeployments');
    });

    it('should filter portfolio by category', async () => {
      const filtered = await analyzer.getPortfolioSummary('api-services');
      const unfiltered = await analyzer.getPortfolioSummary();
      
      // Filtered results should have fewer or equal packs
      expect(filtered.totalPacks).toBeLessThanOrEqual(unfiltered.totalPacks);
    });

    it('should generate market metrics', async () => {
      const metrics = await analyzer.getMarketMetrics();
      
      expect(metrics).toMatchObject({
        totalDownloads: expect.any(Number),
        averageRating: expect.any(Number),
        activePackages: expect.any(Number),
        activeMaintainers: expect.any(Number),
        recentUpdates: expect.any(Number)
      });

      expect(metrics.averageRating).toBeGreaterThanOrEqual(0);
      expect(metrics.averageRating).toBeLessThanOrEqual(5);
    });
  });

  describe('ROI Calculator', () => {
    let calculator;

    beforeEach(() => {
      calculator = new ROICalculator();
    });

    it('should calculate monthly ROI', async () => {
      const portfolioData = { totalPacks: 10 };
      const costAnalysis = { totalCostSaved: 50000 };
      
      const roi = calculator.calculateMonthlyROI(portfolioData, costAnalysis);
      
      expect(roi).toBeGreaterThan(0);
      expect(typeof roi).toBe('number');
    });

    it('should analyze costs', async () => {
      const analysis = await calculator.analyzeCosts();
      
      expect(analysis).toMatchObject({
        totalTimeSaved: expect.any(Number),
        totalCostSaved: expect.any(Number),
        roi: expect.any(Number),
        paybackPeriod: expect.any(Number)
      });

      expect(analysis.totalTimeSaved).toBeGreaterThan(0);
      expect(analysis.roi).toBeGreaterThan(0);
    });

    it('should calculate revenue impact', async () => {
      const portfolioData = { 
        timeMetrics: { improvement: 25 }
      };
      
      const impact = calculator.calculateRevenueImpact(portfolioData);
      
      expect(impact).toHaveProperty('totalImpact');
      expect(impact).toHaveProperty('breakdown');
      expect(impact.totalImpact).toBeGreaterThan(0);
    });

    it('should generate forecasts', async () => {
      const forecasts = await calculator.generateForecasts();
      
      expect(forecasts).toHaveProperty('conservative');
      expect(forecasts).toHaveProperty('realistic');
      expect(forecasts).toHaveProperty('optimistic');
      
      expect(forecasts.optimistic.year3).toBeGreaterThan(forecasts.realistic.year3);
      expect(forecasts.realistic.year3).toBeGreaterThan(forecasts.conservative.year3);
    });
  });

  describe('Compliance Matrix', () => {
    let compliance;

    beforeEach(() => {
      compliance = new ComplianceMatrix();
    });

    it('should generate compliance matrix', async () => {
      const matrix = await compliance.generateMatrix();
      
      expect(matrix).toMatchObject({
        overallScore: expect.any(Number),
        frameworks: expect.any(Array),
        gaps: expect.any(Array),
        recommendations: expect.any(Array),
        lastAssessment: expect.any(String),
        nextReview: expect.any(String)
      });

      expect(matrix.overallScore).toBeGreaterThanOrEqual(0);
      expect(matrix.overallScore).toBeLessThanOrEqual(100);
    });

    it('should assess individual frameworks', async () => {
      const assessment = await compliance.assessFramework('SOX');
      
      expect(assessment).toMatchObject({
        name: 'SOX',
        score: expect.any(Number),
        status: expect.stringMatching(/compliant|partial|non-compliant/),
        controls: expect.any(Number),
        implementedControls: expect.any(Number),
        gaps: expect.any(Number)
      });

      expect(assessment.implementedControls).toBeLessThanOrEqual(assessment.controls);
    });

    it('should generate recommendations', async () => {
      const gaps = [
        { riskLevel: 'high', category: 'security' },
        { riskLevel: 'medium', category: 'compliance' }
      ];
      
      const recommendations = compliance.generateRecommendations(gaps);
      
      expect(recommendations).toBeInstanceOf(Array);
      expect(recommendations.length).toBeGreaterThan(0);
      
      const highPriority = recommendations.find(r => r.priority === 'immediate');
      expect(highPriority).toBeDefined();
    });
  });

  describe('Risk Assessment', () => {
    let riskAssessment;

    beforeEach(() => {
      riskAssessment = new RiskAssessment();
    });

    it('should analyze risks', async () => {
      const analysis = await riskAssessment.analyzeRisks();
      
      expect(analysis).toMatchObject({
        overallRisk: expect.stringMatching(/low|medium|high|critical/),
        categories: expect.any(Array),
        mitigation: expect.any(Array),
        exposure: expect.any(Object),
        lastAssessment: expect.any(String),
        nextReview: expect.any(String)
      });

      expect(analysis.categories.length).toBe(6); // All risk categories
    });

    it('should assess category risks', async () => {
      const assessment = await riskAssessment.assessCategory('security');
      
      expect(assessment).toMatchObject({
        category: 'security',
        level: expect.stringMatching(/low|medium|high|critical/),
        likelihood: expect.any(Number),
        impact: expect.any(Number),
        score: expect.any(Number),
        risks: expect.any(Array),
        controls: expect.any(Array),
        recommendations: expect.any(Array)
      });

      expect(assessment.likelihood).toBeGreaterThanOrEqual(0);
      expect(assessment.likelihood).toBeLessThanOrEqual(1);
    });

    it('should run scenario analysis', async () => {
      const scenarios = await riskAssessment.runScenarioAnalysis();
      
      expect(scenarios).toHaveProperty('bestCase');
      expect(scenarios).toHaveProperty('worstCase');
      expect(scenarios).toHaveProperty('mostLikely');
      
      expect(scenarios.bestCase.riskReduction).toBeGreaterThan(0);
      expect(scenarios.worstCase.potentialLoss).toBeGreaterThan(0);
    });
  });

  describe('Executive View', () => {
    it('should generate executive view with summary depth', async () => {
      const result = await executiveView.generate({ depth: 'summary' });
      
      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        viewType: 'executive',
        persona: 'C-level Executive',
        summary: expect.any(Object),
        kpis: expect.any(Object),
        portfolio: expect.any(Object),
        compliance: expect.any(Object),
        risks: expect.any(Object),
        businessImpact: expect.any(Object)
      });

      expect(result.data.summary).toHaveProperty('totalPacksInstalled');
      expect(result.data.summary).toHaveProperty('monthlyROI');
      expect(result.data.kpis).toHaveProperty('developmentVelocity');
    });

    it('should generate comprehensive executive view', async () => {
      const result = await executiveView.generate({ depth: 'comprehensive' });
      
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('detailedAnalysis');
      expect(result.data.detailedAnalysis).toMatchObject({
        marketTrends: expect.any(Object),
        benchmarking: expect.any(Object),
        forecastModeling: expect.any(Object),
        scenarioAnalysis: expect.any(Object)
      });
    });

    it('should handle view generation errors', async () => {
      // Mock error in dependencies
      vi.spyOn(MarketplaceAnalyzer.prototype, 'getPortfolioSummary')
        .mockRejectedValue(new Error('Database connection failed'));
      
      const result = await executiveView.generate();
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Database connection failed');
      expect(result.data).toBeNull();
    });
  });

  describe('Architect View', () => {
    it('should generate architect view', async () => {
      const result = await architectView.generate({ depth: 'summary' });
      
      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        viewType: 'architect',
        persona: 'Solution Architect',
        summary: expect.any(Object),
        dependencies: expect.any(Object),
        patterns: expect.any(Object),
        performance: expect.any(Object),
        technicalMetrics: expect.any(Object),
        integration: expect.any(Object)
      });

      expect(result.data.dependencies).toHaveProperty('graph');
      expect(result.data.dependencies).toHaveProperty('criticalPaths');
    });

    it('should include deep dive analysis for comprehensive depth', async () => {
      const result = await architectView.generate({ depth: 'comprehensive' });
      
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('deepDive');
      expect(result.data.deepDive).toMatchObject({
        systemTopology: expect.any(Object),
        dataArchitecture: expect.any(Object),
        securityArchitecture: expect.any(Object),
        deploymentPatterns: expect.any(Object),
        evolutionPath: expect.any(Object)
      });
    });
  });

  describe('Developer View', () => {
    it('should generate developer view', async () => {
      const result = await developerView.generate({ depth: 'summary' });
      
      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        viewType: 'developer',
        persona: 'Software Developer',
        summary: expect.any(Object),
        apis: expect.any(Object),
        examples: expect.any(Object),
        quickstarts: expect.any(Object),
        implementation: expect.any(Object),
        tools: expect.any(Object),
        resources: expect.any(Object)
      });

      expect(result.data.apis).toHaveProperty('endpoints');
      expect(result.data.examples).toHaveProperty('byLanguage');
    });

    it('should include advanced examples for comprehensive depth', async () => {
      const result = await developerView.generate({ depth: 'comprehensive' });
      
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('advanced');
      expect(result.data.advanced).toMatchObject({
        performanceOptimization: expect.any(Object),
        securityGuidelines: expect.any(Object),
        scalabilityPatterns: expect.any(Object),
        monitoringIntegration: expect.any(Object),
        advancedExamples: expect.any(Object)
      });
    });

    it('should filter by category', async () => {
      const result = await developerView.generate({ 
        depth: 'summary',
        filter: 'api-services'
      });
      
      expect(result.success).toBe(true);
      // Filtered results should still have the same structure
      expect(result.data.viewType).toBe('developer');
    });
  });

  describe('View Schema Validation', () => {
    it('should validate executive view schema', async () => {
      const result = await executiveView.generate();
      
      expect(result.metadata.schema).toBe('kmkt:ExecutiveView');
      expect(result.metadata.version).toBe('1.0.0');
      expect(result.metadata.generated).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should validate architect view schema', async () => {
      const result = await architectView.generate();
      
      expect(result.metadata.schema).toBe('kmkt:ArchitectView');
      expect(result.metadata.version).toBe('1.0.0');
    });

    it('should validate developer view schema', async () => {
      const result = await developerView.generate();
      
      expect(result.metadata.schema).toBe('kmkt:DeveloperView');
      expect(result.metadata.version).toBe('1.0.0');
    });
  });

  describe('Error Handling', () => {
    it('should handle SPARQL query failures gracefully', async () => {
      const analyzer = new MarketplaceAnalyzer();
      
      // Mock SPARQL failure
      vi.spyOn(analyzer.sparql, 'query')
        .mockRejectedValue(new Error('SPARQL endpoint unavailable'));
      
      // Should not throw, but handle gracefully
      const summary = await analyzer.getPortfolioSummary();
      expect(summary).toBeDefined();
    });

    it('should handle missing ontology files', async () => {
      vi.spyOn(require('fs/promises'), 'readdir')
        .mockRejectedValue(new Error('Directory not found'));
      
      const analyzer = new MarketplaceAnalyzer();
      await expect(analyzer.getPortfolioSummary()).resolves.toBeDefined();
    });
  });

  describe('Performance', () => {
    it('should generate views within reasonable time', async () => {
      const start = Date.now();
      await executiveView.generate({ depth: 'summary' });
      const duration = Date.now() - start;
      
      // Should complete within 5 seconds
      expect(duration).toBeLessThan(5000);
    });

    it('should handle concurrent view generation', async () => {
      const promises = [
        executiveView.generate({ depth: 'summary' }),
        architectView.generate({ depth: 'summary' }),
        developerView.generate({ depth: 'summary' })
      ];
      
      const results = await Promise.all(promises);
      
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
    });
  });
});