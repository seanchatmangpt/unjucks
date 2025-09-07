/**
 * Unit Tests for TaskOrchestrator
 * Tests parallel task execution, load balancing, and agent coordination
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TaskOrchestrator } from '../../src/mcp/task-orchestrator.js';
import { SharedMemoryInterface } from '../../src/mcp/shared-memory-interface.js';
import { AgentType, ExecutionStrategy, SwarmTask, SwarmStrategy, OrchestrationResult } from '../../src/lib/types/index.js';
import { tmpdir } from 'os';
import { join } from 'path';

describe('TaskOrchestrator', () => {
  let orchestrator;
  let memoryInterface;
  let testWorkspace => {
    testWorkspace = join(tmpdir(), `orchestrator-test-${Date.now()}`);
    memoryInterface = new SharedMemoryInterface({ persistToDisk });
    
    orchestrator = new TaskOrchestrator({ memoryInterface,
      workspace,
      maxConcurrent });

  afterEach(async () => {
    if (orchestrator) {
      await orchestrator.cleanup();
    }
    if (memoryInterface) {
      await memoryInterface.cleanup();
    }
  });

  describe('Task Execution Strategies', () => { it('should execute tasks in parallel strategy', async () => {
      const tasks = [
        {
          id },
          priority: 1,
          dependencies: [],
          estimatedDuration: 1000
        },
        { id },
          priority: 1,
          dependencies: [],
          estimatedDuration: 1200
        },
        { id },
          priority: 1,
          dependencies: [],
          estimatedDuration: 800
        }
      ];

      const startTime = Date.now();
      const results = await orchestrator.executeTasks(tasks, ExecutionStrategy.PARALLEL);
      const duration = Date.now() - startTime;

      expect(results).toHaveLength(3);
      expect(results.every(r => r.success)).toBe(true);
      
      // Parallel execution should be faster than sequential
      expect(duration).toBeLessThan(2000); // Should complete in under 2 seconds
    });

    it('should execute tasks in sequential strategy', async () => { const tasks = [
        {
          id },
          priority: 3,
          dependencies: [],
          estimatedDuration: 500
        },
        { id },
          priority: 2,
          dependencies: ['seq-1'],
          estimatedDuration: 1000
        },
        { id },
          priority: 1,
          dependencies: ['seq-2'],
          estimatedDuration: 300
        }
      ];

      const results = await orchestrator.executeTasks(tasks, ExecutionStrategy.SEQUENTIAL);

      expect(results).toHaveLength(3);
      expect(results.every(r => r.success)).toBe(true);
      
      // Verify execution order by checking timestamps
      for (let i = 1; i < results.length; i++) {
        expect(results[i].metrics.startTime).toBeGreaterThanOrEqual(
          results[i - 1].metrics.endTime!
        );
      }
    });

    it('should adapt strategy based on task characteristics', async () => { const tasks = [
        {
          id },
          priority: 3,
          dependencies: [],
          estimatedDuration: 2000
        },
        { id },
          priority: 1,
          dependencies: [],
          estimatedDuration: 200
        }
      ];

      const results = await orchestrator.executeTasks(tasks, ExecutionStrategy.ADAPTIVE);

      expect(results).toHaveLength(2);
      expect(results.every(r => r.success)).toBe(true);
      
      // Quick task should complete first in adaptive mode
      const quickTaskResult = results.find(r => r.taskId === 'adaptive-2');
      expect(quickTaskResult?.metrics.executionTime).toBeLessThan(500);
    });
  });

  describe('Load Balancing', () => { it('should distribute tasks across available agents', async () => {
      const tasks = Array.from({ length, (_, i) => ({
        id }`,
        type: 'template_generate',
        agentType: AgentType.CODER,
        params: { templateName },
        priority: 1,
        dependencies: [],
        estimatedDuration));

      const results = await orchestrator.executeTasks(tasks, ExecutionStrategy.LOAD_BALANCED);

      expect(results).toHaveLength(8);
      expect(results.every(r => r.success)).toBe(true);
      
      // Check that load balancing metrics are tracked
      const loadMetrics = await orchestrator.getLoadBalancingMetrics();
      expect(loadMetrics.totalTasksDistributed).toBe(8);
      expect(loadMetrics.agentUtilization).toBeGreaterThan(0);
    });

    it('should handle agent failures with load rebalancing', async () => { const tasks = Array.from({ length, (_, i) => ({
        id }`,
        type: 'template_generate',
        agentType: AgentType.CODER,
        params: { templateName }, // Make one task fail
        priority: 1,
        dependencies: [],
        estimatedDuration));

      const results = await orchestrator.executeTasks(tasks, ExecutionStrategy.LOAD_BALANCED);

      expect(results).toHaveLength(6);
      
      const successfulTasks = results.filter(r => r.success);
      const failedTasks = results.filter(r => !r.success);
      
      expect(successfulTasks.length).toBe(5);
      expect(failedTasks.length).toBe(1);
      expect(failedTasks[0].taskId).toBe('failure-task-2');
    });
  });

  describe('Dependency Management', () => { it('should respect task dependencies', async () => {
      const tasks = [
        {
          id },
          priority: 3,
          dependencies: [],
          estimatedDuration: 400
        },
        { id },
          priority: 2,
          dependencies: ['dep-root'],
          estimatedDuration: 600
        },
        { id },
          priority: 2,
          dependencies: ['dep-root'],
          estimatedDuration: 500
        },
        { id },
          priority: 1,
          dependencies: ['dep-child-1', 'dep-child-2'],
          estimatedDuration: 300
        }
      ];

      const results = await orchestrator.executeTasks(tasks, ExecutionStrategy.ADAPTIVE);

      expect(results).toHaveLength(4);
      expect(results.every(r => r.success)).toBe(true);

      // Verify dependency order
      const rootResult = results.find(r => r.taskId === 'dep-root')!;
      const child1Result = results.find(r => r.taskId === 'dep-child-1')!;
      const child2Result = results.find(r => r.taskId === 'dep-child-2')!;
      const grandchildResult = results.find(r => r.taskId === 'dep-grandchild')!;

      expect(rootResult.metrics.endTime).toBeLessThanOrEqual(child1Result.metrics.startTime);
      expect(rootResult.metrics.endTime).toBeLessThanOrEqual(child2Result.metrics.startTime);
      expect(child1Result.metrics.endTime).toBeLessThanOrEqual(grandchildResult.metrics.startTime);
      expect(child2Result.metrics.endTime).toBeLessThanOrEqual(grandchildResult.metrics.startTime);
    });

    it('should detect circular dependencies', async () => { const tasks = [
        {
          id },
          priority: 1,
          dependencies: ['circular-2'],
          estimatedDuration: 100
        },
        { id },
          priority: 1,
          dependencies: ['circular-1'],
          estimatedDuration: 100
        }
      ];

      await expect(orchestrator.executeTasks(tasks, ExecutionStrategy.SEQUENTIAL))
        .rejects.toThrow(/circular dependency/i);
    });
  });

  describe('Agent Management', () => { it('should track agent performance metrics', async () => {
      const tasks = [
        {
          id },
          priority: 1,
          dependencies: [],
          estimatedDuration: 300
        },
        { id },
          priority: 1,
          dependencies: [],
          estimatedDuration: 500
        }
      ];

      await orchestrator.executeTasks(tasks, ExecutionStrategy.PARALLEL);

      const agentMetrics = await orchestrator.getAgentPerformanceMetrics();
      
      expect(agentMetrics).toBeDefined();
      expect(agentMetrics.totalAgents).toBeGreaterThan(0);
      expect(agentMetrics.averageTaskTime).toBeGreaterThan(0);
      expect(agentMetrics.agentUtilization).toBeGreaterThan(0);
    });

    it('should handle agent capacity limits', async () => { // Create orchestrator with limited capacity
      const limitedOrchestrator = new TaskOrchestrator({
        memoryInterface,
        workspace,
        maxConcurrent }`,
        type: 'template_generate',
        agentType: AgentType.CODER,
        params: { templateName },
        priority: 1,
        dependencies: [],
        estimatedDuration));

      const startTime = Date.now();
      const results = await limitedOrchestrator.executeTasks(tasks, ExecutionStrategy.PARALLEL);
      const duration = Date.now() - startTime;

      expect(results).toHaveLength(5);
      expect(results.every(r => r.success)).toBe(true);
      
      // Should take longer due to capacity limits (queue processing)
      expect(duration).toBeGreaterThan(2000);

      await limitedOrchestrator.cleanup();
    });
  });

  describe('Error Handling and Recovery', () => { it('should handle task timeouts', async () => {
      const tasks = [
        {
          id }, // 15 seconds, longer than orchestrator timeout
          priority: 1,
          dependencies: [],
          estimatedDuration: 15000
        }
      ];

      const results = await orchestrator.executeTasks(tasks, ExecutionStrategy.SEQUENTIAL);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].error).toMatch(/timeout/i);
    });

    it('should retry failed tasks when configured', async () => { const retryOrchestrator = new TaskOrchestrator({
        memoryInterface,
        workspace,
        maxConcurrent }, // 70% chance of failure
          priority: 1,
          dependencies: [],
          estimatedDuration: 200
        }
      ];

      const results = await retryOrchestrator.executeTasks(tasks, ExecutionStrategy.SEQUENTIAL);

      expect(results).toHaveLength(1);
      
      const result = results[0];
      expect(result.metrics.retryAttempts).toBeGreaterThanOrEqual(0);
      expect(result.metrics.retryAttempts).toBeLessThanOrEqual(2);

      await retryOrchestrator.cleanup();
    });

    it('should isolate failures to prevent cascade', async () => { const tasks = [
        {
          id },
          priority: 1,
          dependencies: [],
          estimatedDuration: 200
        },
        { id },
          priority: 1,
          dependencies: [],
          estimatedDuration: 100
        },
        { id },
          priority: 1,
          dependencies: [],
          estimatedDuration: 300
        }
      ];

      const results = await orchestrator.executeTasks(tasks, ExecutionStrategy.PARALLEL);

      expect(results).toHaveLength(3);
      
      const successfulTasks = results.filter(r => r.success);
      const failedTasks = results.filter(r => !r.success);
      
      expect(successfulTasks.length).toBe(2);
      expect(failedTasks.length).toBe(1);
      expect(failedTasks[0].taskId).toBe('failing-task');
    });
  });

  describe('Memory Integration', () => { it('should share task results through memory interface', async () => {
      const tasks = [
        {
          id },
          priority: 2,
          dependencies: [],
          estimatedDuration: 400
        },
        { id },
          priority: 1,
          dependencies: ['producer-task'],
          estimatedDuration: 300
        }
      ];

      const results = await orchestrator.executeTasks(tasks, ExecutionStrategy.SEQUENTIAL);

      expect(results).toHaveLength(2);
      expect(results.every(r => r.success)).toBe(true);

      // Verify data was shared correctly
      const sharedData = await memoryInterface.get('shared-data');
      expect(sharedData).toBeDefined();
    });

    it('should clean up temporary memory after task completion', async () => { const tasks = [
        {
          id },
          priority: 1,
          dependencies: [],
          estimatedDuration: 200
        }
      ];

      await orchestrator.executeTasks(tasks, ExecutionStrategy.SEQUENTIAL);

      // Verify temporary data is cleaned up
      const tempKeys = await memoryInterface.listKeys({ namespace);
      expect(tempKeys.length).toBe(0);
    });
  });
});
