/**
 * Unit Tests for ClaudeFlowIntegration
 * Tests the unified interface and factory functions for the complete integration system
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  ClaudeFlowIntegration, 
  createClaudeFlowIntegration,
  createFortune5CompanyProfile 
} from '../../src/mcp/integration-index.js';
import { Fortune5CompanyProfile, JTBDRequirements } from '../../src/lib/types/index.js';
import { existsSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

describe('ClaudeFlowIntegration', () => {
  let integration;
  let testWorkspace => {
    testWorkspace = join(tmpdir(), `integration-test-${this.getDeterministicTimestamp()}`);
    
    testCompany = createFortune5CompanyProfile({ name });
  });

  afterEach(async () => {
    if (integration) {
      await integration.shutdown();
    }
    
    if (existsSync(testWorkspace)) { rmSync(testWorkspace, { recursive: true, force });
    }
  });

  describe('Integration Initialization', () => {
    it('should initialize all components successfully', async () => {
      expect(integration).toBeDefined();
      expect(await integration.isHealthy()).toBe(true);
      
      const status = await integration.getStatus();
      expect(status.initialized).toBe(true);
      expect(status.components.connector).toBe('healthy');
      expect(status.components.orchestrator).toBe('healthy');
      expect(status.components.memory).toBe('healthy');
      expect(status.components.workflows).toBe('healthy');
    });

    it('should handle initialization with custom configuration', async () => { const customIntegration = await createClaudeFlowIntegration({
        workspace, 'custom'),
        maxConcurrentAgents });

      expect(customIntegration).toBeDefined();
      expect(await customIntegration.isHealthy()).toBe(true);
      
      const config = await customIntegration.getConfiguration();
      expect(config.maxConcurrentAgents).toBe(8);
      expect(config.defaultTimeout).toBe(15000);
      expect(config.enablePersistence).toBe(true);
      
      await customIntegration.shutdown();
    });

    it('should gracefully handle initialization failures', async () => { const invalidIntegration = await createClaudeFlowIntegration({
        workspace });
  });

  describe('Unified JTBD Workflow Interface', () => { it('should execute single JTBD workflow through unified interface', async () => {
      const result = await integration.executeJTBDWorkflow(
        'api-standardization',
        testCompany,
        {
          microserviceCount }
      );

      expect(result.success).toBe(true);
      expect(result.workflowType).toBe('api-standardization');
      expect(result.deliverables.length).toBeGreaterThan(0);
      expect(result.roi.estimatedValue).toBeGreaterThan(0);
      expect(result.executionTime).toBeGreaterThan(0);
    });

    it('should execute multiple JTBD workflows in sequence', async () => { const workflowChain = [
        { type } },
        { type } },
        { type } }
      ];

      const result = await integration.executeJTBDWorkflowChain(
        workflowChain,
        testCompany
      );

      expect(result.success).toBe(true);
      expect(result.workflowResults).toHaveLength(3);
      expect(result.workflowResults.every(r => r.success)).toBe(true);
      
      // Total execution time should be reasonable
      expect(result.totalExecutionTime).toBeGreaterThan(0);
      expect(result.totalExecutionTime).toBeLessThan(30000); // < 30 seconds
      
      // Total ROI should be calculated
      expect(result.totalROI.estimatedValue).toBeGreaterThan(0);
    });

    it('should handle parallel JTBD workflow execution', async () => { const parallelWorkflows = [
        { type } },
        { type } },
        { type } }
      ];

      const startTime = this.getDeterministicTimestamp();
      const result = await integration.executeJTBDWorkflowsParallel(
        parallelWorkflows,
        testCompany
      );
      const totalTime = this.getDeterministicTimestamp() - startTime;

      expect(result.success).toBe(true);
      expect(result.workflowResults).toHaveLength(3);
      
      // Parallel execution should be faster than sum of individual times
      const individualTimes = result.workflowResults.reduce(
        (sum, r) => sum + r.executionTime, 0
      );
      expect(totalTime).toBeLessThan(individualTimes * 0.8); // At least 20% faster
    });
  });

  describe('Swarm Management Integration', () => { it('should create and manage swarms through unified interface', async () => {
      const swarmConfig = {
        topology };

      const swarmId = await integration.createSwarm(swarmConfig);
      expect(swarmId).toBeDefined();
      expect(typeof swarmId).toBe('string');

      const swarmStatus = await integration.getSwarmStatus(swarmId);
      expect(swarmStatus.swarmId).toBe(swarmId);
      expect(swarmStatus.topology).toBe('mesh');
      expect(swarmStatus.maxAgents).toBe(6);
      expect(swarmStatus.activeAgents).toBe(0); // No agents spawned yet
    });

    it('should spawn and manage agents in swarms', async () => { const swarmId = await integration.createSwarm({
        topology });

      const updatedStatus = await integration.getSwarmStatus(swarmId);
      expect(updatedStatus.activeAgents).toBe(4);
    });

    it('should coordinate agents across different topologies', async () => {
      const topologies = ['mesh', 'hierarchical', 'ring', 'star'];
      const swarms = [];

      for (const topology of topologies) {
        const swarmId = await integration.createSwarm({ topology, maxAgents);
        swarms.push({ id, topology });
      }

      // Test coordination across different topologies
      const coordinationResult = await integration.coordinateMultipleSwarms(
        swarms.map(s => s.id),
        { task }
      );

      expect(coordinationResult.success).toBe(true);
      expect(coordinationResult.participatingSwarms).toBe(swarms.length);
    });
  });

  describe('Memory and State Management', () => {
    it('should manage shared memory across workflows', async () => {
      // Execute first workflow that produces shared data
      await integration.executeJTBDWorkflow(
        'api-standardization',
        testCompany,
        { microserviceCount);

      // Check that shared data is available
      const sharedData = await integration.getSharedData('api-templates');
      expect(sharedData).toBeDefined();

      // Execute second workflow that should use the shared data
      const result = await integration.executeJTBDWorkflow(
        'documentation-generation',
        testCompany,
        { documentationTypes);

      expect(result.success).toBe(true);
      expect(result.metadata?.usedSharedData).toBe(true);
    });

    it('should handle memory namespace isolation', async () => {
      await integration.setSharedData('test-key', 'namespace-1-value', {
        namespace);
      await integration.setSharedData('test-key', 'namespace-2-value', {
        namespace);

      const value1 = await integration.getSharedData('test-key', { namespace);
      const value2 = await integration.getSharedData('test-key', { namespace);

      expect(value1).toBe('namespace-1-value');
      expect(value2).toBe('namespace-2-value');
      expect(value1).not.toBe(value2);
    });

    it('should persist state across sessions when enabled', async () => { const persistentIntegration = await createClaudeFlowIntegration({
        workspace, 'persistent'),
        enablePersistence });

      await persistentIntegration.setSharedData('persistent-key', 'persistent-value');
      await persistentIntegration.shutdown();

      // Create new integration instance
      const restoredIntegration = await createClaudeFlowIntegration({ workspace, 'persistent'),
        enablePersistence });

      const restoredValue = await restoredIntegration.getSharedData('persistent-key');
      expect(restoredValue).toBe('persistent-value');

      await restoredIntegration.shutdown();
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle workflow failures with proper rollback', async () => {
      // Mock a workflow component to fail
      vi.spyOn(integration.workflows, 'executeAPIStandardization')
        .mockRejectedValueOnce(new Error('Simulated workflow failure'));

      const result = await integration.executeJTBDWorkflow(
        'api-standardization',
        testCompany,
        {}
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Simulated workflow failure');
      
      // Verify cleanup was performed
      const memoryKeys = await integration.listSharedDataKeys();
      expect(memoryKeys.filter(key => key.startsWith('rollback-')).length).toBe(0);
    });

    it('should recover from agent failures', async () => { const swarmId = await integration.createSwarm({ topology });

    it('should handle resource exhaustion gracefully', async () => { // Create integration with very limited resources
      const limitedIntegration = await createClaudeFlowIntegration({
        workspace, 'limited'),
        maxConcurrentAgents });

      // Try to execute resource-intensive workflow
      const result = await limitedIntegration.executeJTBDWorkflow(
        'api-standardization',
        testCompany,
        { microserviceCount);

      // Should either succeed with warnings or fail gracefully
      if (result.success) {
        expect(result.warnings.length).toBeGreaterThan(0);
      } else {
        expect(result.error).toMatch(/(resource|memory|limit)/i);
      }

      await limitedIntegration.shutdown();
    });
  });

  describe('Performance Monitoring and Metrics', () => {
    it('should track comprehensive performance metrics', async () => {
      await integration.executeJTBDWorkflow(
        'api-standardization',
        testCompany,
        { microserviceCount);

      const metrics = await integration.getPerformanceMetrics();
      
      expect(metrics.totalWorkflowsExecuted).toBeGreaterThan(0);
      expect(metrics.averageExecutionTime).toBeGreaterThan(0);
      expect(metrics.successRate).toBeGreaterThanOrEqual(0);
      expect(metrics.successRate).toBeLessThanOrEqual(1);
      expect(metrics.memoryUsage.current).toBeGreaterThan(0);
      expect(metrics.agentUtilization.average).toBeGreaterThanOrEqual(0);
    });

    it('should provide detailed agent performance analytics', async () => { const swarmId = await integration.createSwarm({ topology });
    });

    it('should generate performance reports', async () => {
      // Execute multiple workflows to generate metrics
      await Promise.all([
        integration.executeJTBDWorkflow('api-standardization', testCompany, {}),
        integration.executeJTBDWorkflow('cicd-pipelines', testCompany, {})
      ]);

      const report = await integration.generatePerformanceReport({ timeRange });
  });

  describe('Factory Functions and Utilities', () => { it('should create company profiles with factory function', () => {
      const customCompany = createFortune5CompanyProfile({
        name });

    it('should validate company profiles', () => { const validCompany = createFortune5CompanyProfile({
        name };

      expect(() => integration.validateCompanyProfile(invalidCompany)).toThrow();
    });

    it('should provide configuration recommendations', async () => {
      const recommendations = await integration.getConfigurationRecommendations(
        testCompany
      );

      expect(recommendations).toBeDefined();
      expect(recommendations.swarmTopology).toBeDefined();
      expect(recommendations.maxConcurrentAgents).toBeGreaterThan(0);
      expect(recommendations.recommendedWorkflows).toHaveLength.toBeGreaterThan(0);
      expect(recommendations.estimatedROI).toBeGreaterThan(0);
    });
  });

  describe('Integration Health and Diagnostics', () => {
    it('should provide comprehensive health check', async () => {
      const health = await integration.getHealthCheck();
      
      expect(health.overall).toBe('healthy');
      expect(health.components).toBeDefined();
      expect(health.components.connector).toBe('healthy');
      expect(health.components.orchestrator).toBe('healthy');
      expect(health.components.memory).toBe('healthy');
      expect(health.components.workflows).toBe('healthy');
      expect(health.uptime).toBeGreaterThan(0);
      expect(health.lastChecked).toBeDefined();
    });

    it('should diagnose system issues', async () => {
      const diagnostics = await integration.runDiagnostics();
      
      expect(diagnostics.tests).toBeDefined();
      expect(diagnostics.tests.length).toBeGreaterThan(0);
      
      diagnostics.tests.forEach(test => {
        expect(test.name).toBeDefined();
        expect(test.status).toMatch(/^(passed|failed|warning)$/);
        expect(test.duration).toBeGreaterThanOrEqual(0);
      });
      
      expect(diagnostics.summary.totalTests).toBe(diagnostics.tests.length);
      expect(diagnostics.summary.passedTests).toBeGreaterThanOrEqual(0);
      expect(diagnostics.summary.failedTests).toBeGreaterThanOrEqual(0);
    });

    it('should export system configuration', async () => {
      const config = await integration.exportConfiguration();
      
      expect(config.version).toBeDefined();
      expect(config.workspace).toBe(testWorkspace);
      expect(config.components).toBeDefined();
      expect(config.settings).toBeDefined();
      expect(config.createdAt).toBeDefined();
    });

    it('should import and apply configuration', async () => { const originalConfig = await integration.exportConfiguration();
      
      // Modify some settings
      const newConfig = {
        ...originalConfig,
        settings }
      };
      
      const importResult = await integration.importConfiguration(newConfig);
      expect(importResult.success).toBe(true);
      
      const updatedConfig = await integration.getConfiguration();
      expect(updatedConfig.maxConcurrentAgents).toBe(12);
      expect(updatedConfig.defaultTimeout).toBe(20000);
    });
  });
});
