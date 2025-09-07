/**
 * Unit Tests for JTBDWorkflows
 * Tests all 5 Fortune 5 JTBD scenarios with realistic execution and ROI calculations
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JTBDWorkflows } from '../../src/mcp/jtbd-workflows.js';
import { SharedMemoryInterface } from '../../src/mcp/shared-memory-interface.js';
import { TaskOrchestrator } from '../../src/mcp/task-orchestrator.js';
import { Fortune5CompanyProfile, JTBDRequirements, JTBDWorkflowResult } from '../../src/lib/types/index.js';
import { existsSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

describe('JTBDWorkflows', () => { let workflows;
  let memoryInterface;
  let orchestrator;
  let testWorkspace = {
    id },
    constraints: { security }
  };

  beforeEach(async () => {
    testWorkspace = join(tmpdir(), `jtbd-test-${Date.now()}`);
    
    memoryInterface = new SharedMemoryInterface({ persistToDisk });
    orchestrator = new TaskOrchestrator({
      memoryInterface,
      workspace,
      maxConcurrent);

    workflows = new JTBDWorkflows({ memoryInterface,
      orchestrator,
      workspace,
      enableMetrics });

    await memoryInterface.initialize();
    await orchestrator.initialize();
    await workflows.initialize();
  });

  afterEach(async () => { if (workflows) await workflows.cleanup();
    if (orchestrator) await orchestrator.cleanup();
    if (memoryInterface) await memoryInterface.cleanup();
    
    if (existsSync(testWorkspace)) {
      rmSync(testWorkspace, { recursive: true, force });
    }
  });

  describe('API Standardization Workflow', () => { it('should execute complete API standardization for microservices', async () => {
      const requirements = {
        microserviceCount }
      };

      const result = await workflows.executeAPIStandardization(
        mockFortune5Company,
        requirements
      );

      expect(result.success).toBe(true);
      expect(result.workflowId).toBeDefined();
      expect(result.executionTime).toBeGreaterThan(0);
      
      // Verify deliverables
      expect(result.deliverables.length).toBeGreaterThan(0);
      expect(result.deliverables.some(d => d.type === 'api-template')).toBe(true);
      expect(result.deliverables.some(d => d.type === 'openapi-spec')).toBe(true);
      expect(result.deliverables.some(d => d.type === 'security-config')).toBe(true);
      
      // Verify ROI calculation
      expect(result.roi.estimatedValue).toBeGreaterThan(1000000); // > $1M
      expect(result.roi.timeToValue).toBeLessThanOrEqual(90); // <= 90 days
      expect(result.roi.riskReduction).toBeGreaterThan(0);
      
      // Verify metrics
      expect(result.metrics.tasksCompleted).toBeGreaterThan(0);
      expect(result.metrics.agentsUsed.length).toBeGreaterThan(0);
      expect(result.metrics.memoryOperations).toBeGreaterThan(0);
    });

    it('should handle API standardization with custom requirements', async () => { const customRequirements = {
        microserviceCount },
          'payment-service': { patterns }
        }
      };

      const result = await workflows.executeAPIStandardization(
        mockFortune5Company,
        customRequirements
      );

      expect(result.success).toBe(true);
      expect(result.deliverables.some(d => d.name.includes('auth-service'))).toBe(true);
      expect(result.deliverables.some(d => d.name.includes('payment-service'))).toBe(true);
      
      // Should scale ROI with larger service count
      expect(result.roi.estimatedValue).toBeGreaterThan(3000000); // > $3M for 100 services
    });

    it('should generate appropriate templates for different tech stacks', async () => { const requirements = {
        techStackOverride }
      };

      const result = await workflows.executeAPIStandardization(
        mockFortune5Company,
        requirements
      );

      expect(result.success).toBe(true);
      
      const goTemplates = result.deliverables.filter(d => 
        d.metadata?.language === 'Go' || d.content.includes('package main')
      );
      expect(goTemplates.length).toBeGreaterThan(0);
    });
  });

  describe('Compliance-Ready Service Scaffolding', () => { it('should generate SOX-compliant service scaffolding', async () => {
      const requirements = {
        complianceLevel }
      };

      const result = await workflows.executeComplianceScaffolding(
        mockFortune5Company,
        requirements
      );

      expect(result.success).toBe(true);
      
      // Verify compliance-specific deliverables
      expect(result.deliverables.some(d => d.type === 'audit-logger')).toBe(true);
      expect(result.deliverables.some(d => d.type === 'access-control')).toBe(true);
      expect(result.deliverables.some(d => d.type === 'encryption-config')).toBe(true);
      
      // SOX compliance should have high value due to risk reduction
      expect(result.roi.estimatedValue).toBeGreaterThan(4000000); // > $4M
      expect(result.roi.riskReduction).toBeGreaterThan(0.8); // > 80% risk reduction
    });

    it('should generate GDPR-compliant service scaffolding', async () => { const requirements = {
        complianceLevel }
      };

      const result = await workflows.executeComplianceScaffolding(
        mockFortune5Company,
        requirements
      );

      expect(result.success).toBe(true);
      
      // Verify GDPR-specific features
      expect(result.deliverables.some(d => d.name.includes('consent-manager'))).toBe(true);
      expect(result.deliverables.some(d => d.name.includes('data-portability'))).toBe(true);
      expect(result.deliverables.some(d => d.name.includes('deletion-service'))).toBe(true);
    });

    it('should handle multi-compliance requirements', async () => { const requirements = {
        complianceLevel };

      const result = await workflows.executeComplianceScaffolding(
        mockFortune5Company,
        requirements
      );

      expect(result.success).toBe(true);
      
      // Should include features from all compliance frameworks
      const deliverableNames = result.deliverables.map(d => d.name.toLowerCase()).join(' ');
      expect(deliverableNames).toMatch(/audit|log/); // SOX
      expect(deliverableNames).toMatch(/consent|privacy/); // GDPR
      expect(deliverableNames).toMatch(/phi|hipaa/); // HIPAA
      
      // Multi-compliance should have higher value
      expect(result.roi.estimatedValue).toBeGreaterThan(6000000); // > $6M
    });
  });

  describe('Database Migration Generation', () => { it('should generate comprehensive migration scripts', async () => {
      const requirements = {
        databaseMigrations }
      };

      const result = await workflows.executeDatabaseMigrations(
        mockFortune5Company,
        requirements
      );

      expect(result.success).toBe(true);
      
      // Verify migration deliverables
      expect(result.deliverables.some(d => d.type === 'schema-migration')).toBe(true);
      expect(result.deliverables.some(d => d.type === 'data-migration')).toBe(true);
      expect(result.deliverables.some(d => d.type === 'rollback-script')).toBe(true);
      expect(result.deliverables.some(d => d.type === 'validation-script')).toBe(true);
      
      // Large migration should have significant value
      expect(result.roi.estimatedValue).toBeGreaterThan(2500000); // > $2.5M
    });

    it('should handle cloud-native migration patterns', async () => { const requirements = {
        databaseMigrations }
      };

      const result = await workflows.executeDatabaseMigrations(
        mockFortune5Company,
        requirements
      );

      expect(result.success).toBe(true);
      
      const cloudDeliverables = result.deliverables.filter(d => 
        d.metadata?.cloudNative || d.name.includes('aurora') || d.name.includes('aws')
      );
      expect(cloudDeliverables.length).toBeGreaterThan(0);
    });

    it('should generate performance optimization scripts', async () => { const requirements = {
        performanceOptimization }
      };

      const result = await workflows.executeDatabaseMigrations(
        mockFortune5Company,
        requirements
      );

      expect(result.success).toBe(true);
      
      expect(result.deliverables.some(d => d.type === 'index-optimization')).toBe(true);
      expect(result.deliverables.some(d => d.type === 'partitioning-script')).toBe(true);
      expect(result.deliverables.some(d => d.type === 'caching-config')).toBe(true);
    });
  });

  describe('CI/CD Pipeline Generation', () => { it('should generate multi-stack CI/CD pipelines', async () => {
      const requirements = {
        cicdRequirements }
      };

      const result = await workflows.executeCICDPipelines(
        mockFortune5Company,
        requirements
      );

      expect(result.success).toBe(true);
      
      // Verify pipeline deliverables
      expect(result.deliverables.some(d => d.type === 'github-workflow')).toBe(true);
      expect(result.deliverables.some(d => d.type === 'jenkins-pipeline')).toBe(true);
      expect(result.deliverables.some(d => d.type === 'gitlab-ci')).toBe(true);
      
      // Verify environment-specific configs
      const envConfigs = result.deliverables.filter(d => d.type === 'environment-config');
      expect(envConfigs.length).toBe(3); // dev, staging, production
      
      expect(result.roi.estimatedValue).toBeGreaterThan(3500000); // > $3.5M
    });

    it('should include security scanning and compliance checks', async () => { const requirements = {
        securityScanning }
      };

      const result = await workflows.executeCICDPipelines(
        mockFortune5Company,
        requirements
      );

      expect(result.success).toBe(true);
      
      expect(result.deliverables.some(d => d.type === 'security-scan-config')).toBe(true);
      expect(result.deliverables.some(d => d.name.includes('sonarqube'))).toBe(true);
      expect(result.deliverables.some(d => d.name.includes('dependency-scan'))).toBe(true);
    });

    it('should support containerization and orchestration', async () => { const requirements = {
        containerization }
      };

      const result = await workflows.executeCICDPipelines(
        mockFortune5Company,
        requirements
      );

      expect(result.success).toBe(true);
      
      expect(result.deliverables.some(d => d.type === 'dockerfile')).toBe(true);
      expect(result.deliverables.some(d => d.type === 'k8s-manifest')).toBe(true);
      expect(result.deliverables.some(d => d.type === 'helm-chart')).toBe(true);
    });
  });

  describe('Enterprise Documentation Generation', () => { it('should generate comprehensive API documentation', async () => {
      const requirements = {
        documentationTypes }
      };

      const result = await workflows.executeDocumentationGeneration(
        mockFortune5Company,
        requirements
      );

      expect(result.success).toBe(true);
      
      // Verify documentation deliverables
      expect(result.deliverables.some(d => d.type === 'api-docs')).toBe(true);
      expect(result.deliverables.some(d => d.type === 'architecture-docs')).toBe(true);
      expect(result.deliverables.some(d => d.type === 'operations-guide')).toBe(true);
      
      // Verify multiple output formats
      const formats = result.deliverables.map(d => d.metadata?.format).filter(Boolean);
      expect(formats).toContain('markdown');
      expect(formats).toContain('openapi');
      
      expect(result.roi.estimatedValue).toBeGreaterThan(1200000); // > $1.2M
    });

    it('should support interactive documentation features', async () => { const requirements = {
        interactiveFeatures }
      };

      const result = await workflows.executeDocumentationGeneration(
        mockFortune5Company,
        requirements
      );

      expect(result.success).toBe(true);
      
      expect(result.deliverables.some(d => d.name.includes('interactive'))).toBe(true);
      expect(result.deliverables.some(d => d.type === 'api-playground')).toBe(true);
      expect(result.deliverables.some(d => d.type === 'code-examples')).toBe(true);
    });

    it('should generate compliance documentation', async () => { const requirements = {
        complianceDocumentation }
      };

      const result = await workflows.executeDocumentationGeneration(
        mockFortune5Company,
        requirements
      );

      expect(result.success).toBe(true);
      
      expect(result.deliverables.some(d => d.type === 'compliance-matrix')).toBe(true);
      expect(result.deliverables.some(d => d.type === 'audit-documentation')).toBe(true);
      expect(result.deliverables.some(d => d.type === 'risk-assessment')).toBe(true);
    });
  });

  describe('Workflow Orchestration and Integration', () => {
    it('should execute multiple workflows in sequence', async () => {
      const apiResult = await workflows.executeAPIStandardization(mockFortune5Company);
      const complianceResult = await workflows.executeComplianceScaffolding(mockFortune5Company);
      
      expect(apiResult.success).toBe(true);
      expect(complianceResult.success).toBe(true);
      
      // Second workflow should benefit from first workflow's outputs
      const sharedData = await memoryInterface.search({ tags);
      expect(sharedData.length).toBeGreaterThan(0);
    });

    it('should track cross-workflow dependencies', async () => { const workflowChain = await workflows.executeWorkflowChain([
        { type } },
        { type } },
        { type });

    it('should handle workflow failures gracefully', async () => { // Mock a scenario where one workflow fails
      vi.spyOn(workflows, 'executeDatabaseMigrations').mockRejectedValueOnce(
        new Error('Database connection failed')
      );

      const workflowChain = await workflows.executeWorkflowChain([
        { type } },
        { type } }, // This will fail
        { type });
  });

  describe('Performance and Scalability', () => { it('should handle large-scale Fortune 5 requirements', async () => {
      const largeScaleCompany = {
        ...mockFortune5Company,
        employees };

      const requirements = { microserviceCount };

      const startTime = Date.now();
      const result = await workflows.executeAPIStandardization(
        largeScaleCompany,
        requirements
      );
      const executionTime = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(executionTime).toBeLessThan(30000); // Should complete within 30 seconds
      
      // ROI should scale with company size
      expect(result.roi.estimatedValue).toBeGreaterThan(10000000); // > $10M
    });

    it('should utilize parallel agent execution efficiently', async () => {
      const parallelWorkflows = [
        workflows.executeAPIStandardization(mockFortune5Company),
        workflows.executeComplianceScaffolding(mockFortune5Company),
        workflows.executeDatabaseMigrations(mockFortune5Company)
      ];

      const startTime = Date.now();
      const results = await Promise.all(parallelWorkflows);
      const totalTime = Date.now() - startTime;

      expect(results.every(r => r.success)).toBe(true);
      
      // Parallel execution should be faster than sequential
      const estimatedSequentialTime = results.reduce(
        (sum, r) => sum + r.executionTime, 0
      );
      expect(totalTime).toBeLessThan(estimatedSequentialTime * 0.8); // At least 20% faster
    });

    it('should manage memory efficiently during large operations', async () => { const initialStats = await memoryInterface.getStats();
      
      // Execute memory-intensive workflow
      await workflows.executeDocumentationGeneration(mockFortune5Company, {
        documentationTypes });
  });

  describe('ROI Calculations and Business Value', () => { it('should calculate realistic ROI based on company profile', async () => {
      const smallerCompany = {
        ...mockFortune5Company,
        revenue };

      const largerCompany = { ...mockFortune5Company,
        revenue };

      const smallResult = await workflows.executeAPIStandardization(smallerCompany);
      const largeResult = await workflows.executeAPIStandardization(largerCompany);

      expect(smallResult.success && largeResult.success).toBe(true);
      
      // Larger company should have proportionally higher ROI
      expect(largeResult.roi.estimatedValue).toBeGreaterThan(
        smallResult.roi.estimatedValue * 1.5
      );
    });

    it('should factor in industry-specific considerations', async () => { const healthcareCompany = {
        ...mockFortune5Company,
        industry };

      const result = await workflows.executeComplianceScaffolding(healthcareCompany);
      
      expect(result.success).toBe(true);
      
      // Healthcare should have higher compliance value due to risk
      expect(result.roi.riskReduction).toBeGreaterThan(0.9); // > 90% risk reduction
      expect(result.roi.complianceSavings).toBeGreaterThan(5000000); // > $5M
    });

    it('should calculate time-to-value accurately', async () => {
      const result = await workflows.executeCICDPipelines(mockFortune5Company);
      
      expect(result.success).toBe(true);
      expect(result.roi.timeToValue).toBeGreaterThan(0);
      expect(result.roi.timeToValue).toBeLessThan(180); // < 6 months
      
      // Should provide monthly value breakdown
      expect(result.roi.monthlyValue).toBeGreaterThan(0);
      expect(result.roi.yearlyValue).toBeGreaterThan(result.roi.monthlyValue * 10);
    });
  });
});
