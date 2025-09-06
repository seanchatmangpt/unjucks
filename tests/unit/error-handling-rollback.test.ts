/**
 * Unit Tests for Error Handling and Rollback Mechanisms
 * Tests comprehensive error scenarios, recovery strategies, and atomic operations
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ClaudeFlowConnector } from '../../src/mcp/claude-flow-connector.js';
import { TaskOrchestrator } from '../../src/mcp/task-orchestrator.js';
import { SharedMemoryInterface } from '../../src/mcp/shared-memory-interface.js';
import { JTBDWorkflows } from '../../src/mcp/jtbd-workflows.js';
import { AgentType, ExecutionStrategy, SwarmTask, Fortune5CompanyProfile } from '../../src/lib/types/index.js';
import { existsSync, rmSync, writeFileSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

describe('Error Handling and Rollback Mechanisms', () => {
  let connector: ClaudeFlowConnector;
  let memoryInterface: SharedMemoryInterface;
  let orchestrator: TaskOrchestrator;
  let workflows: JTBDWorkflows;
  let testWorkspace: string;
  let testCompany: Fortune5CompanyProfile;

  beforeEach(async () => {
    testWorkspace = join(tmpdir(), `error-test-${Date.now()}`);
    
    testCompany = {
      id: 'error-test-company',
      name: 'Error Test Corp',
      industry: 'Technology',
      revenue: 100000000000,
      employees: 200000,
      regions: ['North America'],
      complianceRequirements: ['SOX'],
      techStack: {
        languages: ['TypeScript'],
        frameworks: ['React'],
        databases: ['PostgreSQL'],
        cloud: ['AWS'],
        cicd: ['GitHub Actions']
      },
      constraints: {
        security: 'enterprise',
        performance: 'high',
        scalability: 'regional',
        availability: '99.9%'
      }
    };

    memoryInterface = new SharedMemoryInterface({ persistToDisk: false });
    orchestrator = new TaskOrchestrator({
      memoryInterface,
      workspace: testWorkspace,
      maxConcurrent: 3,
      timeout: 5000
    });
    
    connector = new ClaudeFlowConnector({
      workspace: testWorkspace,
      timeout: 5000
    });
    
    workflows = new JTBDWorkflows({
      memoryInterface,
      orchestrator,
      workspace: testWorkspace
    });

    await memoryInterface.initialize();
    await orchestrator.initialize();
    await connector.initialize();
    await workflows.initialize();
  });

  afterEach(async () => {
    if (workflows) await workflows.cleanup();
    if (connector) await connector.cleanup();
    if (orchestrator) await orchestrator.cleanup();
    if (memoryInterface) await memoryInterface.cleanup();
    
    if (existsSync(testWorkspace)) {
      rmSync(testWorkspace, { recursive: true, force: true });
    }
  });

  describe('Task Execution Error Handling', () => {
    it('should handle single task failures without affecting others', async () => {
      const tasks: SwarmTask[] = [
        {
          id: 'success-task-1',
          type: 'template_generate',
          agentType: AgentType.CODER,
          params: { templateName: 'component', name: 'Button' },
          priority: 1,
          dependencies: [],
          estimatedDuration: 1000
        },
        {
          id: 'failure-task',
          type: 'invalid_operation',
          agentType: AgentType.CODER,
          params: { invalidParam: 'causes-error' },
          priority: 1,
          dependencies: [],
          estimatedDuration: 1000
        },
        {
          id: 'success-task-2',
          type: 'template_generate',
          agentType: AgentType.CODER,
          params: { templateName: 'component', name: 'Modal' },
          priority: 1,
          dependencies: [],
          estimatedDuration: 1000
        }
      ];

      const results = await orchestrator.executeTasks(tasks, ExecutionStrategy.PARALLEL);

      expect(results).toHaveLength(3);
      
      const successfulTasks = results.filter(r => r.success);
      const failedTasks = results.filter(r => !r.success);
      
      expect(successfulTasks).toHaveLength(2);
      expect(failedTasks).toHaveLength(1);
      expect(failedTasks[0].taskId).toBe('failure-task');
      expect(failedTasks[0].error).toBeDefined();
    });

    it('should implement proper retry logic with exponential backoff', async () => {
      const retryOrchestrator = new TaskOrchestrator({
        memoryInterface,
        workspace: testWorkspace,
        maxConcurrent: 1,
        timeout: 3000,
        retryAttempts: 3,
        retryBackoff: 'exponential'
      });

      await retryOrchestrator.initialize();

      let attemptCount = 0;
      vi.spyOn(retryOrchestrator as any, 'executeTask').mockImplementation(async (task) => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error(`Attempt ${attemptCount} failed`);
        }
        return {
          success: true,
          taskId: task.id,
          result: 'success on third attempt',
          metrics: { startTime: Date.now(), endTime: Date.now(), executionTime: 100 }
        };
      });

      const tasks: SwarmTask[] = [{
        id: 'retry-task',
        type: 'flaky_operation',
        agentType: AgentType.CODER,
        params: {},
        priority: 1,
        dependencies: [],
        estimatedDuration: 1000
      }];

      const results = await retryOrchestrator.executeTasks(tasks);
      
      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      expect(results[0].metrics.retryAttempts).toBe(2); // Failed twice, succeeded on third
      expect(attemptCount).toBe(3);

      await retryOrchestrator.cleanup();
    });

    it('should handle timeout scenarios gracefully', async () => {
      const tasks: SwarmTask[] = [{
        id: 'timeout-task',
        type: 'long_running_task',
        agentType: AgentType.CODER,
        params: { duration: 10000 }, // 10 seconds, longer than 5s timeout
        priority: 1,
        dependencies: [],
        estimatedDuration: 10000
      }];

      const results = await orchestrator.executeTasks(tasks);
      
      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].error).toMatch(/timeout/i);
      expect(results[0].metrics.executionTime).toBeLessThan(6000); // Should timeout before 6s
    });

    it('should handle memory errors and cleanup', async () => {
      // Create interface with very limited memory
      const limitedMemory = new SharedMemoryInterface({
        persistToDisk: false,
        maxMemorySize: 1024 // 1KB limit
      });

      await limitedMemory.initialize();

      const limitedOrchestrator = new TaskOrchestrator({
        memoryInterface: limitedMemory,
        workspace: testWorkspace,
        maxConcurrent: 1
      });

      await limitedOrchestrator.initialize();

      const tasks: SwarmTask[] = [{
        id: 'memory-intensive-task',
        type: 'large_data_operation',
        agentType: AgentType.CODER,
        params: { 
          largeData: 'x'.repeat(2048) // 2KB data, exceeds memory limit
        },
        priority: 1,
        dependencies: [],
        estimatedDuration: 1000
      }];

      const results = await limitedOrchestrator.executeTasks(tasks);
      
      expect(results).toHaveLength(1);
      if (!results[0].success) {
        expect(results[0].error).toMatch(/(memory|limit|size)/i);
      }

      // Memory should be cleaned up
      const memoryStats = await limitedMemory.getStats();
      expect(memoryStats.memoryUsage).toBeLessThan(1024);

      await limitedOrchestrator.cleanup();
      await limitedMemory.cleanup();
    });
  });

  describe('Atomic Operations and Rollback', () => {
    it('should rollback file operations on failure', async () => {
      const testFile = join(testWorkspace, 'test-file.txt');
      const originalContent = 'original content';
      
      // Create initial file
      writeFileSync(testFile, originalContent);
      expect(readFileSync(testFile, 'utf-8')).toBe(originalContent);

      // Mock a file operation that fails after partial changes
      const mockFileOperation = vi.fn().mockImplementation(async () => {
        // Modify file
        writeFileSync(testFile, 'modified content');
        
        // Then fail
        throw new Error('File operation failed');
      });

      const rollbackResult = await connector.executeWithRollback(async () => {
        return mockFileOperation();
      }, {
        backupFiles: [testFile]
      });

      expect(rollbackResult.success).toBe(false);
      expect(rollbackResult.error).toContain('File operation failed');
      
      // File should be restored to original content
      expect(readFileSync(testFile, 'utf-8')).toBe(originalContent);
    });

    it('should rollback memory operations on failure', async () => {
      // Store initial data
      await memoryInterface.set('rollback-test', 'initial-value');
      await memoryInterface.set('preserve-test', 'preserve-value');
      
      const rollbackOperation = async () => {
        // Modify memory
        await memoryInterface.set('rollback-test', 'modified-value');
        await memoryInterface.set('new-key', 'new-value');
        
        // Then fail
        throw new Error('Memory operation failed');
      };

      const rollbackResult = await connector.executeWithRollback(
        rollbackOperation,
        {
          memoryKeys: ['rollback-test'],
          preserveKeys: ['preserve-test']
        }
      );

      expect(rollbackResult.success).toBe(false);
      
      // Original value should be restored
      const restoredValue = await memoryInterface.get('rollback-test');
      expect(restoredValue).toBe('initial-value');
      
      // New key should not exist
      const newKeyValue = await memoryInterface.get('new-key');
      expect(newKeyValue).toBeNull();
      
      // Preserved key should remain unchanged
      const preservedValue = await memoryInterface.get('preserve-test');
      expect(preservedValue).toBe('preserve-value');
    });

    it('should handle complex multi-step rollback scenarios', async () => {
      const step1File = join(testWorkspace, 'step1.txt');
      const step2File = join(testWorkspace, 'step2.txt');
      const step3File = join(testWorkspace, 'step3.txt');
      
      const complexOperation = async () => {
        // Step 1: Create file 1
        writeFileSync(step1File, 'step 1 content');
        
        // Step 2: Store in memory
        await memoryInterface.set('complex-operation', 'step 2 data');
        
        // Step 3: Create file 2
        writeFileSync(step2File, 'step 2 content');
        
        // Step 4: Fail before file 3
        throw new Error('Operation failed at step 4');
      };

      const rollbackResult = await connector.executeWithRollback(
        complexOperation,
        {
          backupFiles: [],
          memoryKeys: ['complex-operation'],
          cleanupFiles: [step1File, step2File, step3File]
        }
      );

      expect(rollbackResult.success).toBe(false);
      
      // All created files should be cleaned up
      expect(existsSync(step1File)).toBe(false);
      expect(existsSync(step2File)).toBe(false);
      expect(existsSync(step3File)).toBe(false);
      
      // Memory should be cleaned up
      const memoryValue = await memoryInterface.get('complex-operation');
      expect(memoryValue).toBeNull();
    });

    it('should handle rollback of swarm operations', async () => {
      const swarmResult = await connector.createSwarm({
        topology: 'mesh',
        maxAgents: 3
      });

      const agents = await Promise.all([
        connector.spawnAgent(swarmResult.swarmId!, AgentType.CODER, []),
        connector.spawnAgent(swarmResult.swarmId!, AgentType.TESTER, [])
      ]);

      expect(agents.every(a => a.success)).toBe(true);

      // Mock operation that fails after creating agents
      const swarmOperation = async () => {
        // Spawn another agent
        await connector.spawnAgent(swarmResult.swarmId!, AgentType.REVIEWER, []);
        
        // Then fail
        throw new Error('Swarm operation failed');
      };

      const rollbackResult = await connector.executeWithRollback(
        swarmOperation,
        {
          swarmId: swarmResult.swarmId,
          preserveAgents: agents.map(a => a.agentId!)
        }
      );

      expect(rollbackResult.success).toBe(false);
      
      // Check that only original agents remain
      const finalStatus = await connector.getSwarmStatus(swarmResult.swarmId!);
      expect(finalStatus.data.activeAgents).toBe(2); // Original 2 agents preserved
    });
  });

  describe('Workflow Error Recovery', () => {
    it('should handle JTBD workflow failures with proper cleanup', async () => {
      // Mock a component to fail during workflow execution
      vi.spyOn(workflows.orchestrator, 'executeTasks').mockRejectedValueOnce(
        new Error('Task orchestration failed')
      );

      const result = await workflows.executeAPIStandardization(
        testCompany,
        { microserviceCount: 10 }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Task orchestration failed');
      
      // Verify cleanup was performed
      const memoryKeys = await memoryInterface.listKeys();
      const workflowKeys = memoryKeys.filter(key => key.includes('api-standardization'));
      expect(workflowKeys.length).toBe(0); // All workflow data cleaned up
    });

    it('should handle partial workflow completion with state preservation', async () => {
      // Mock scenario where workflow partially completes
      let taskCount = 0;
      vi.spyOn(workflows.orchestrator, 'executeTasks').mockImplementation(async (tasks) => {
        taskCount++;
        if (taskCount === 2) {
          throw new Error('Second batch of tasks failed');
        }
        
        // First batch succeeds
        return tasks.map(task => ({
          success: true,
          taskId: task.id,
          result: { generatedFiles: [`${task.id}.ts`] },
          metrics: {
            startTime: Date.now(),
            endTime: Date.now(),
            executionTime: 1000
          }
        }));
      });

      const result = await workflows.executeComplianceScaffolding(
        testCompany,
        { complianceLevel: 'SOX' }
      );

      expect(result.success).toBe(false);
      
      // Check that partial results are preserved for recovery
      const partialResults = await memoryInterface.get('partial-workflow-results');
      expect(partialResults).toBeDefined();
      expect(partialResults).toHaveProperty('completedTasks');
      expect(partialResults).toHaveProperty('failurePoint');
    });

    it('should support workflow recovery from checkpoint', async () => {
      // Simulate workflow failure with checkpoint
      await memoryInterface.set('workflow-checkpoint', {
        workflowType: 'database-migrations',
        completedSteps: ['schema-analysis', 'migration-planning'],
        nextStep: 'migration-generation',
        context: {
          companyProfile: testCompany,
          requirements: { sourceSystem: 'Oracle', targetSystem: 'PostgreSQL' }
        }
      });

      const recoveryResult = await workflows.recoverWorkflowFromCheckpoint(
        'workflow-checkpoint'
      );

      expect(recoveryResult.success).toBe(true);
      expect(recoveryResult.workflowType).toBe('database-migrations');
      expect(recoveryResult.resumedFromStep).toBe('migration-generation');
      expect(recoveryResult.deliverables.length).toBeGreaterThan(0);
    });

    it('should handle cascading failures across multiple workflows', async () => {
      const workflowChain = [
        { type: 'api-standardization' as const, requirements: {} },
        { type: 'compliance-scaffolding' as const, requirements: {} },
        { type: 'documentation-generation' as const, requirements: {} }
      ];

      // Mock second workflow to fail
      vi.spyOn(workflows, 'executeComplianceScaffolding').mockRejectedValueOnce(
        new Error('Compliance workflow failed')
      );

      const chainResult = await workflows.executeWorkflowChain(
        workflowChain,
        testCompany
      );

      expect(chainResult.success).toBe(false);
      expect(chainResult.workflowResults.length).toBeGreaterThanOrEqual(1); // First workflow completed
      expect(chainResult.errors.length).toBe(1);
      expect(chainResult.errors[0]).toContain('Compliance workflow failed');
      
      // Verify first workflow results are preserved
      const firstWorkflowResult = chainResult.workflowResults.find(
        r => r.workflowType === 'api-standardization'
      );
      expect(firstWorkflowResult?.success).toBe(true);
    });
  });

  describe('Resource Cleanup and Leak Prevention', () => {
    it('should clean up temporary resources on success', async () => {
      const result = await workflows.executeDocumentationGeneration(
        testCompany,
        { documentationTypes: ['API'] }
      );

      expect(result.success).toBe(true);
      
      // Check that temporary files are cleaned up
      const tempFiles = await connector.listTempFiles();
      expect(tempFiles.length).toBe(0);
      
      // Check that temporary memory keys are cleaned up
      const tempKeys = await memoryInterface.listKeys({ namespace: 'temp' });
      expect(tempKeys.length).toBe(0);
    });

    it('should clean up resources on failure', async () => {
      // Mock operation that creates temporary resources then fails
      const operationWithTempResources = async () => {
        // Create temp file
        const tempFile = join(testWorkspace, 'temp-resource.txt');
        writeFileSync(tempFile, 'temporary data');
        
        // Store temp data in memory
        await memoryInterface.set('temp-key', 'temp-value', { namespace: 'temp' });
        
        // Fail
        throw new Error('Operation failed after creating resources');
      };

      const result = await connector.executeWithCleanup(
        operationWithTempResources,
        {
          cleanupTempFiles: true,
          cleanupTempMemory: true
        }
      );

      expect(result.success).toBe(false);
      
      // Verify cleanup occurred
      const remainingTempFiles = await connector.listTempFiles();
      expect(remainingTempFiles.length).toBe(0);
      
      const tempKeys = await memoryInterface.listKeys({ namespace: 'temp' });
      expect(tempKeys.length).toBe(0);
    });

    it('should prevent memory leaks during long-running operations', async () => {
      const initialStats = await memoryInterface.getStats();
      
      // Execute multiple operations that could leak memory
      for (let i = 0; i < 10; i++) {
        await workflows.executeAPIStandardization(
          testCompany,
          { microserviceCount: 5 }
        );
      }

      const finalStats = await memoryInterface.getStats();
      
      // Memory growth should be reasonable
      const memoryGrowth = finalStats.memoryUsage - initialStats.memoryUsage;
      expect(memoryGrowth).toBeLessThan(10 * 1024 * 1024); // Less than 10MB growth
    });

    it('should handle resource contention and deadlock prevention', async () => {
      const resourceKey = 'shared-resource';
      
      // Store shared resource
      await memoryInterface.set(resourceKey, 'shared-data');
      
      // Start multiple concurrent operations that need the same resource
      const concurrentOperations = [];
      
      for (let i = 0; i < 5; i++) {
        concurrentOperations.push(
          connector.executeWithResourceLock(async () => {
            const resource = await memoryInterface.get(resourceKey);
            
            // Simulate work with resource
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Modify resource
            await memoryInterface.set(resourceKey, `${resource}-modified-${i}`);
            
            return `operation-${i}-complete`;
          }, {
            resourceKeys: [resourceKey],
            timeout: 2000
          })
        );
      }
      
      const results = await Promise.all(concurrentOperations);
      
      // All operations should complete successfully
      expect(results.every(r => r.success)).toBe(true);
      
      // Final resource should reflect all modifications
      const finalResource = await memoryInterface.get(resourceKey);
      expect(finalResource).toMatch(/shared-data(-modified-[0-4]){5}/);
    });
  });

  describe('Error Reporting and Diagnostics', () => {
    it('should provide detailed error context and stack traces', async () => {
      const tasks: SwarmTask[] = [{
        id: 'error-context-task',
        type: 'complex_operation',
        agentType: AgentType.CODER,
        params: { complexParam: { nested: { value: 'test' } } },
        priority: 1,
        dependencies: [],
        estimatedDuration: 1000
      }];

      // Mock to throw detailed error
      vi.spyOn(orchestrator as any, 'executeTask').mockRejectedValueOnce(
        new Error('Detailed operation error with context')
      );

      const results = await orchestrator.executeTasks(tasks);
      
      expect(results[0].success).toBe(false);
      expect(results[0].error).toBeDefined();
      expect(results[0].errorContext).toBeDefined();
      expect(results[0].errorContext).toHaveProperty('taskId', 'error-context-task');
      expect(results[0].errorContext).toHaveProperty('agentType', AgentType.CODER);
      expect(results[0].errorContext).toHaveProperty('params');
      expect(results[0].stackTrace).toBeDefined();
    });

    it('should generate comprehensive error reports', async () => {
      // Cause multiple types of errors
      const errors = [];
      
      try {
        await workflows.executeAPIStandardization(testCompany, {
          invalidParam: 'causes-validation-error'
        } as any);
      } catch (error) {
        errors.push({ type: 'validation', error });
      }
      
      try {
        await orchestrator.executeTasks([{
          id: 'timeout-task',
          type: 'timeout_operation',
          agentType: AgentType.CODER,
          params: {},
          priority: 1,
          dependencies: [],
          estimatedDuration: 10000
        }]);
      } catch (error) {
        errors.push({ type: 'timeout', error });
      }

      const errorReport = await connector.generateErrorReport({
        includeStackTraces: true,
        includeSystemState: true,
        timeWindow: '1h'
      });

      expect(errorReport.summary).toBeDefined();
      expect(errorReport.summary.totalErrors).toBeGreaterThan(0);
      expect(errorReport.errorBreakdown).toBeDefined();
      expect(errorReport.systemState).toBeDefined();
      expect(errorReport.recommendations).toHaveLength.toBeGreaterThan(0);
    });

    it('should provide recovery suggestions based on error patterns', async () => {
      const recoveryAnalysis = await connector.analyzeRecoveryOptions([
        {
          errorType: 'timeout',
          frequency: 5,
          context: { operation: 'template_generation', avgDuration: 8000 }
        },
        {
          errorType: 'memory_limit',
          frequency: 3,
          context: { operation: 'large_workflow', memoryUsage: '95%' }
        }
      ]);

      expect(recoveryAnalysis.recommendations).toHaveLength.toBeGreaterThan(0);
      
      const timeoutRecommendation = recoveryAnalysis.recommendations.find(
        r => r.errorType === 'timeout'
      );
      expect(timeoutRecommendation).toBeDefined();
      expect(timeoutRecommendation?.suggestion).toMatch(/increase.*timeout|optimize.*operation/i);
      
      const memoryRecommendation = recoveryAnalysis.recommendations.find(
        r => r.errorType === 'memory_limit'
      );
      expect(memoryRecommendation).toBeDefined();
      expect(memoryRecommendation?.suggestion).toMatch(/increase.*memory|reduce.*batch/i);
    });
  });
});
