/**
 * Unit Tests for ClaudeFlowConnector
 * Tests the core MCP-Claude Flow bridge functionality with real agent orchestration
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ClaudeFlowConnector } from '../../src/mcp/claude-flow-connector.js';
import { SharedMemoryInterface } from '../../src/mcp/shared-memory-interface.js';
import { TaskOrchestrator } from '../../src/mcp/task-orchestrator.js';
import { AgentType, SwarmStrategy, ExecutionStrategy, OrchestrationResult } from '../../src/lib/types/index.js';
import { existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

describe('ClaudeFlowConnector', () => {
  let connector;
  let testWorkspace;
  
  beforeEach(() => {
    testWorkspace = join(tmpdir(), `claude-flow-test-${Date.now()}`);
    connector = new ClaudeFlowConnector({ baseUrl: 'http://localhost:8000' });

  afterEach(async () => {
    if (connector) {
      await connector.cleanup();
    }
  });

  describe('Initialization', () => {
    it('should initialize with proper configuration', () => {
      expect(connector).toBeDefined();
      expect(connector.isInitialized()).toBe(true);
    });

    it('should create workspace directory during initialization', () => {
      expect(existsSync(testWorkspace)).toBe(true);
    });

    it('should initialize shared memory interface', () => {
      const memoryInterface = connector.getMemoryInterface();
      expect(memoryInterface).toBeInstanceOf(SharedMemoryInterface);
    });

    it('should initialize task orchestrator', () => {
      const orchestrator = connector.getTaskOrchestrator();
      expect(orchestrator).toBeInstanceOf(TaskOrchestrator);
    });
  });

  describe('Swarm Management', () => { it('should create swarm with mesh topology', async () => {
      const result = await connector.createSwarm({
        topology });

    it('should spawn agents with correct capabilities', async () => { const swarmResult = await connector.createSwarm({
        topology });
    });

    it('should handle swarm status queries', async () => { const swarmResult = await connector.createSwarm({
        topology });
  });

  describe('Tool Execution Orchestration', () => { it('should orchestrate single tool execution', async () => {
      const result = await connector.orchestrateToolExecution(
        'template_generate',
        {
          templateName },
          outputPath,
        1
      );

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(1);
      expect(result.metrics.executionTime).toBeGreaterThan(0);
    });

    it('should orchestrate parallel tool execution', async () => { const result = await connector.orchestrateToolExecution(
        'template_generate',
        {
          templateName },
          outputPath: 'src/services/payment'
        },
        3, // Parallel execution across 3 agents
        { strategy });

    it('should handle tool execution errors gracefully', async () => {
      const result = await connector.orchestrateToolExecution(
        'nonexistent_tool',
        { invalid,
        1
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('Tool not found');
    });
  });

  describe('Memory Integration', () => { it('should store and retrieve shared data', async () => {
      const testData = {
        templateResults };

      const stored = await connector.storeSharedData('test-key', testData, { namespace });

    it('should handle TTL expiration', async () => { const testData = { value };
      
      const stored = await connector.storeSharedData('ttl-key', testData, {
        ttl);

      expect(stored).toBe(true);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1500));

      const retrieved = await connector.getSharedData('ttl-key');
      expect(retrieved).toBeNull();
    });

    it('should support namespace isolation', async () => { const data1 = { namespace1 };
      const data2 = { namespace2 };

      await connector.storeSharedData('same-key', data1, { namespace);
      await connector.storeSharedData('same-key', data2, { namespace);

      const retrieved1 = await connector.getSharedData('same-key', { namespace);
      const retrieved2 = await connector.getSharedData('same-key', { namespace);

      expect(retrieved1).toEqual(data1);
      expect(retrieved2).toEqual(data2);
      expect(retrieved1).not.toEqual(retrieved2);
    });
  });

  describe('Error Handling and Rollback', () => {
    it('should rollback operations on failure', async () => {
      // Mock a scenario where one operation fails
      vi.spyOn(connector.getTaskOrchestrator(), 'executeTasks').mockImplementationOnce(() => {
        throw new Error('Simulated task failure');
      });

      const result = await connector.orchestrateToolExecution(
        'template_generate',
        { templateName,
        2
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Simulated task failure');
      
      // Verify cleanup was attempted
      const memoryKeys = await connector.listSharedDataKeys();
      expect(memoryKeys.filter(key => key.startsWith('rollback-')).length).toBe(0);
    });

    it('should handle network timeouts', async () => { // Create connector with very short timeout
      const timeoutConnector = new ClaudeFlowConnector({
        baseUrl });
  });

  describe('Performance Metrics', () => {
    it('should track execution metrics', async () => {
      const result = await connector.orchestrateToolExecution(
        'template_list',
        {},
        1
      );

      expect(result.metrics).toBeDefined();
      expect(result.metrics.executionTime).toBeGreaterThan(0);
      expect(result.metrics.totalTasks).toBe(1);
      expect(result.metrics.successfulTasks).toBeGreaterThanOrEqual(0);
      expect(result.metrics.failedTasks).toBeGreaterThanOrEqual(0);
    });

    it('should track agent performance', async () => { const swarmResult = await connector.createSwarm({ topology });
  });

  describe('Integration with MCP Server', () => {
    it('should communicate with MCP server for tool execution', async () => {
      const result = await connector.executeMCPTool('template_list', {});
      
      expect(result).toBeDefined();
      // The actual result depends on the MCP server implementation
      // At minimum, it should not throw an error
    });

    it('should handle MCP server unavailability', async () => { // Create connector with invalid MCP server config
      const invalidConnector = new ClaudeFlowConnector({
        baseUrl });
      
      // Should handle gracefully, possibly with fallback behavior
      expect(result).toBeDefined();
      
      await invalidConnector.cleanup();
    });
  });
});
