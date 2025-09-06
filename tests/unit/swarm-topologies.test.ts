/**
 * Unit Tests for Swarm Topologies and Agent Orchestration
 * Tests different swarm topologies with real agent coordination patterns
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ClaudeFlowConnector } from '../../src/mcp/claude-flow-connector.js';
import { TaskOrchestrator } from '../../src/mcp/task-orchestrator.js';
import { SharedMemoryInterface } from '../../src/mcp/shared-memory-interface.js';
import { AgentType, SwarmStrategy, ExecutionStrategy, SwarmTask } from '../../src/lib/types/index.js';
import { existsSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

describe('Swarm Topologies and Agent Orchestration', () => {
  let connector: ClaudeFlowConnector;
  let testWorkspace: string;

  beforeEach(async () => {
    testWorkspace = join(tmpdir(), `swarm-test-${Date.now()}`);
    connector = new ClaudeFlowConnector({
      workspace: testWorkspace,
      timeout: 10000
    });
    
    await connector.initialize();
  });

  afterEach(async () => {
    if (connector) {
      await connector.cleanup();
    }
    
    if (existsSync(testWorkspace)) {
      rmSync(testWorkspace, { recursive: true, force: true });
    }
  });

  describe('Mesh Topology', () => {
    it('should create mesh topology with peer-to-peer communication', async () => {
      const swarmResult = await connector.createSwarm({
        topology: 'mesh',
        maxAgents: 4,
        strategy: SwarmStrategy.BALANCED
      });

      expect(swarmResult.success).toBe(true);
      expect(swarmResult.data.topology).toBe('mesh');

      // Spawn agents in mesh topology
      const agents = await Promise.all([
        connector.spawnAgent(swarmResult.swarmId!, AgentType.RESEARCHER, ['analysis']),
        connector.spawnAgent(swarmResult.swarmId!, AgentType.CODER, ['typescript']),
        connector.spawnAgent(swarmResult.swarmId!, AgentType.TESTER, ['unit-testing']),
        connector.spawnAgent(swarmResult.swarmId!, AgentType.REVIEWER, ['code-review'])
      ]);

      expect(agents.every(a => a.success)).toBe(true);

      // Test mesh communication patterns
      const coordinationResult = await connector.coordinateAgents(swarmResult.swarmId!, {
        communicationPattern: 'mesh',
        task: 'collaborative-template-generation'
      });

      expect(coordinationResult.success).toBe(true);
      expect(coordinationResult.data.coordinationPattern).toBe('mesh');
      expect(coordinationResult.data.activeConnections).toBeGreaterThan(6); // n*(n-1)/2 connections for 4 agents
    });

    it('should handle load balancing in mesh topology', async () => {
      const swarmResult = await connector.createSwarm({
        topology: 'mesh',
        maxAgents: 3,
        strategy: SwarmStrategy.BALANCED
      });

      await Promise.all([
        connector.spawnAgent(swarmResult.swarmId!, AgentType.CODER, ['javascript']),
        connector.spawnAgent(swarmResult.swarmId!, AgentType.CODER, ['python']),
        connector.spawnAgent(swarmResult.swarmId!, AgentType.CODER, ['go'])
      ]);

      // Create multiple tasks for load balancing test
      const tasks: SwarmTask[] = Array.from({ length: 9 }, (_, i) => ({
        id: `mesh-task-${i}`,
        type: 'template_generate',
        agentType: AgentType.CODER,
        params: { templateName: 'service', index: i },
        priority: 1,
        dependencies: [],
        estimatedDuration: 500
      }));

      const orchestratorResult = await connector.orchestrateToolExecution(
        'parallel_template_generation',
        { tasks },
        3,
        { strategy: ExecutionStrategy.LOAD_BALANCED }
      );

      expect(orchestratorResult.success).toBe(true);
      expect(orchestratorResult.metrics.loadBalancingEfficiency).toBeGreaterThan(0.8); // > 80% efficiency
    });

    it('should maintain fault tolerance in mesh topology', async () => {
      const swarmResult = await connector.createSwarm({
        topology: 'mesh',
        maxAgents: 4
      });

      const agents = await Promise.all([
        connector.spawnAgent(swarmResult.swarmId!, AgentType.CODER, []),
        connector.spawnAgent(swarmResult.swarmId!, AgentType.CODER, []),
        connector.spawnAgent(swarmResult.swarmId!, AgentType.CODER, []),
        connector.spawnAgent(swarmResult.swarmId!, AgentType.CODER, [])
      ]);

      // Simulate agent failure
      await connector.terminateAgent(agents[0].agentId!);

      // Remaining agents should continue working
      const healthCheck = await connector.checkSwarmHealth(swarmResult.swarmId!);
      expect(healthCheck.status).toBe('degraded');
      expect(healthCheck.healthyAgents).toBe(3);
      expect(healthCheck.failedAgents).toBe(1);

      // Execute task with reduced agent count
      const result = await connector.orchestrateToolExecution(
        'template_generate',
        { templateName: 'test' },
        1
      );

      expect(result.success).toBe(true); // Should still succeed with remaining agents
    });
  });

  describe('Hierarchical Topology', () => {
    it('should create hierarchical topology with coordinator-worker pattern', async () => {
      const swarmResult = await connector.createSwarm({
        topology: 'hierarchical',
        maxAgents: 5,
        strategy: SwarmStrategy.SPECIALIZED
      });

      expect(swarmResult.success).toBe(true);
      expect(swarmResult.data.topology).toBe('hierarchical');

      // Spawn coordinator and workers
      const coordinator = await connector.spawnAgent(
        swarmResult.swarmId!, 
        AgentType.COORDINATOR, 
        ['task-coordination', 'resource-management']
      );
      
      const workers = await Promise.all([
        connector.spawnAgent(swarmResult.swarmId!, AgentType.RESEARCHER, ['requirements']),
        connector.spawnAgent(swarmResult.swarmId!, AgentType.CODER, ['implementation']),
        connector.spawnAgent(swarmResult.swarmId!, AgentType.TESTER, ['validation']),
        connector.spawnAgent(swarmResult.swarmId!, AgentType.REVIEWER, ['quality-assurance'])
      ]);

      expect(coordinator.success).toBe(true);
      expect(workers.every(w => w.success)).toBe(true);

      // Test hierarchical coordination
      const coordinationResult = await connector.coordinateAgents(swarmResult.swarmId!, {
        communicationPattern: 'hierarchical',
        coordinatorId: coordinator.agentId,
        task: 'supervised-development-workflow'
      });

      expect(coordinationResult.success).toBe(true);
      expect(coordinationResult.data.coordinationPattern).toBe('hierarchical');
      expect(coordinationResult.data.coordinatorAgent).toBe(coordinator.agentId);
    });

    it('should implement proper command flow in hierarchy', async () => {
      const swarmResult = await connector.createSwarm({
        topology: 'hierarchical',
        maxAgents: 4
      });

      const coordinator = await connector.spawnAgent(
        swarmResult.swarmId!, 
        AgentType.SYSTEM_ARCHITECT, 
        ['coordination']
      );
      
      await Promise.all([
        connector.spawnAgent(swarmResult.swarmId!, AgentType.CODER, []),
        connector.spawnAgent(swarmResult.swarmId!, AgentType.TESTER, []),
        connector.spawnAgent(swarmResult.swarmId!, AgentType.REVIEWER, [])
      ]);

      // Execute hierarchical workflow
      const result = await connector.orchestrateToolExecution(
        'hierarchical_workflow',
        {
          coordinatorId: coordinator.agentId,
          workflowSteps: [
            { phase: 'analysis', agent: 'researcher' },
            { phase: 'implementation', agent: 'coder' },
            { phase: 'testing', agent: 'tester' },
            { phase: 'review', agent: 'reviewer' }
          ]
        },
        1
      );

      expect(result.success).toBe(true);
      expect(result.metrics.coordinationOverhead).toBeLessThan(0.2); // < 20% overhead
    });

    it('should handle coordinator failure with promotion', async () => {
      const swarmResult = await connector.createSwarm({
        topology: 'hierarchical',
        maxAgents: 4,
        failoverEnabled: true
      });

      const coordinator = await connector.spawnAgent(
        swarmResult.swarmId!, 
        AgentType.COORDINATOR, 
        ['leadership']
      );
      
      const workers = await Promise.all([
        connector.spawnAgent(swarmResult.swarmId!, AgentType.SYSTEM_ARCHITECT, ['backup-coordinator']),
        connector.spawnAgent(swarmResult.swarmId!, AgentType.CODER, []),
        connector.spawnAgent(swarmResult.swarmId!, AgentType.TESTER, [])
      ]);

      // Simulate coordinator failure
      await connector.terminateAgent(coordinator.agentId!);

      // System should promote backup coordinator
      const healthCheck = await connector.checkSwarmHealth(swarmResult.swarmId!);
      expect(healthCheck.status).toBe('recovered');
      expect(healthCheck.newCoordinator).toBeDefined();
      expect(healthCheck.newCoordinator).toBe(workers[0].agentId); // System architect promoted
    });
  });

  describe('Ring Topology', () => {
    it('should create ring topology with circular communication', async () => {
      const swarmResult = await connector.createSwarm({
        topology: 'ring',
        maxAgents: 4,
        strategy: SwarmStrategy.ADAPTIVE
      });

      expect(swarmResult.success).toBe(true);
      expect(swarmResult.data.topology).toBe('ring');

      const agents = await Promise.all([
        connector.spawnAgent(swarmResult.swarmId!, AgentType.RESEARCHER, ['stage-1']),
        connector.spawnAgent(swarmResult.swarmId!, AgentType.CODER, ['stage-2']),
        connector.spawnAgent(swarmResult.swarmId!, AgentType.TESTER, ['stage-3']),
        connector.spawnAgent(swarmResult.swarmId!, AgentType.REVIEWER, ['stage-4'])
      ]);

      expect(agents.every(a => a.success)).toBe(true);

      // Test ring communication pattern
      const coordinationResult = await connector.coordinateAgents(swarmResult.swarmId!, {
        communicationPattern: 'ring',
        task: 'pipeline-processing'
      });

      expect(coordinationResult.success).toBe(true);
      expect(coordinationResult.data.ringOrder).toHaveLength(4);
      expect(coordinationResult.data.circularConnections).toBe(4); // Each agent connects to next
    });

    it('should implement pipeline processing in ring', async () => {
      const swarmResult = await connector.createSwarm({
        topology: 'ring',
        maxAgents: 3
      });

      await Promise.all([
        connector.spawnAgent(swarmResult.swarmId!, AgentType.RESEARCHER, ['input-processing']),
        connector.spawnAgent(swarmResult.swarmId!, AgentType.CODER, ['transformation']),
        connector.spawnAgent(swarmResult.swarmId!, AgentType.REVIEWER, ['output-validation'])
      ]);

      // Execute ring pipeline
      const result = await connector.orchestrateToolExecution(
        'ring_pipeline',
        {
          inputData: { templates: ['service', 'controller', 'test'] },
          pipelineStages: ['analyze', 'generate', 'validate']
        },
        1
      );

      expect(result.success).toBe(true);
      expect(result.data.pipelineResults).toHaveLength(3);
      expect(result.metrics.pipelineEfficiency).toBeGreaterThan(0.85); // > 85% efficiency
    });

    it('should handle ring breaks and self-healing', async () => {
      const swarmResult = await connector.createSwarm({
        topology: 'ring',
        maxAgents: 4,
        selfHealing: true
      });

      const agents = await Promise.all([
        connector.spawnAgent(swarmResult.swarmId!, AgentType.CODER, []),
        connector.spawnAgent(swarmResult.swarmId!, AgentType.CODER, []),
        connector.spawnAgent(swarmResult.swarmId!, AgentType.CODER, []),
        connector.spawnAgent(swarmResult.swarmId!, AgentType.CODER, [])
      ]);

      // Break the ring by removing one agent
      await connector.terminateAgent(agents[1].agentId!);

      // Ring should self-heal by reconnecting
      const healthCheck = await connector.checkSwarmHealth(swarmResult.swarmId!);
      expect(healthCheck.status).toBe('healed');
      expect(healthCheck.ringIntegrity).toBe(true);
      expect(healthCheck.activeConnections).toBe(3); // 3 agents, 3 connections
    });
  });

  describe('Star Topology', () => {
    it('should create star topology with central hub', async () => {
      const swarmResult = await connector.createSwarm({
        topology: 'star',
        maxAgents: 5,
        strategy: SwarmStrategy.SPECIALIZED
      });

      expect(swarmResult.success).toBe(true);
      expect(swarmResult.data.topology).toBe('star');

      // Spawn central hub
      const hub = await connector.spawnAgent(
        swarmResult.swarmId!, 
        AgentType.COORDINATOR, 
        ['central-coordination', 'resource-distribution']
      );
      
      // Spawn spoke agents
      const spokes = await Promise.all([
        connector.spawnAgent(swarmResult.swarmId!, AgentType.RESEARCHER, ['specialized-analysis']),
        connector.spawnAgent(swarmResult.swarmId!, AgentType.CODER, ['specialized-coding']),
        connector.spawnAgent(swarmResult.swarmId!, AgentType.TESTER, ['specialized-testing']),
        connector.spawnAgent(swarmResult.swarmId!, AgentType.REVIEWER, ['specialized-review'])
      ]);

      expect(hub.success).toBe(true);
      expect(spokes.every(s => s.success)).toBe(true);

      // Test star communication
      const coordinationResult = await connector.coordinateAgents(swarmResult.swarmId!, {
        communicationPattern: 'star',
        hubId: hub.agentId,
        task: 'centralized-coordination'
      });

      expect(coordinationResult.success).toBe(true);
      expect(coordinationResult.data.hubAgent).toBe(hub.agentId);
      expect(coordinationResult.data.spokeAgents).toHaveLength(4);
    });

    it('should implement efficient resource distribution through hub', async () => {
      const swarmResult = await connector.createSwarm({
        topology: 'star',
        maxAgents: 4
      });

      const hub = await connector.spawnAgent(
        swarmResult.swarmId!, 
        AgentType.TASK_ORCHESTRATOR, 
        ['resource-management']
      );
      
      const spokes = await Promise.all([
        connector.spawnAgent(swarmResult.swarmId!, AgentType.CODER, ['worker-1']),
        connector.spawnAgent(swarmResult.swarmId!, AgentType.CODER, ['worker-2']),
        connector.spawnAgent(swarmResult.swarmId!, AgentType.CODER, ['worker-3'])
      ]);

      // Test resource distribution
      const result = await connector.orchestrateToolExecution(
        'star_distribution',
        {
          hubId: hub.agentId,
          resources: [
            { type: 'template', name: 'service-1' },
            { type: 'template', name: 'service-2' },
            { type: 'template', name: 'service-3' }
          ]
        },
        1
      );

      expect(result.success).toBe(true);
      expect(result.data.distributionEfficiency).toBeGreaterThan(0.9); // > 90% efficiency
      expect(result.metrics.hubUtilization).toBeLessThan(0.8); // Hub not overloaded
    });

    it('should handle hub failure with designated backup', async () => {
      const swarmResult = await connector.createSwarm({
        topology: 'star',
        maxAgents: 5,
        hubFailover: true
      });

      const primaryHub = await connector.spawnAgent(
        swarmResult.swarmId!, 
        AgentType.COORDINATOR, 
        ['primary-hub']
      );
      
      const backupHub = await connector.spawnAgent(
        swarmResult.swarmId!, 
        AgentType.SYSTEM_ARCHITECT, 
        ['backup-hub']
      );
      
      const spokes = await Promise.all([
        connector.spawnAgent(swarmResult.swarmId!, AgentType.CODER, []),
        connector.spawnAgent(swarmResult.swarmId!, AgentType.TESTER, []),
        connector.spawnAgent(swarmResult.swarmId!, AgentType.REVIEWER, [])
      ]);

      // Simulate hub failure
      await connector.terminateAgent(primaryHub.agentId!);

      // Backup should take over
      const healthCheck = await connector.checkSwarmHealth(swarmResult.swarmId!);
      expect(healthCheck.status).toBe('recovered');
      expect(healthCheck.newHub).toBe(backupHub.agentId);
      expect(healthCheck.starTopologyIntact).toBe(true);
    });
  });

  describe('Topology Performance Comparison', () => {
    it('should compare performance across different topologies', async () => {
      const topologies = ['mesh', 'hierarchical', 'ring', 'star'] as const;
      const results = [];

      for (const topology of topologies) {
        const swarmResult = await connector.createSwarm({
          topology,
          maxAgents: 4
        });

        // Spawn appropriate agents for each topology
        if (topology === 'hierarchical' || topology === 'star') {
          await connector.spawnAgent(swarmResult.swarmId!, AgentType.COORDINATOR, []);
          await Promise.all([
            connector.spawnAgent(swarmResult.swarmId!, AgentType.CODER, []),
            connector.spawnAgent(swarmResult.swarmId!, AgentType.TESTER, []),
            connector.spawnAgent(swarmResult.swarmId!, AgentType.REVIEWER, [])
          ]);
        } else {
          await Promise.all([
            connector.spawnAgent(swarmResult.swarmId!, AgentType.CODER, []),
            connector.spawnAgent(swarmResult.swarmId!, AgentType.CODER, []),
            connector.spawnAgent(swarmResult.swarmId!, AgentType.CODER, []),
            connector.spawnAgent(swarmResult.swarmId!, AgentType.CODER, [])
          ]);
        }

        const startTime = Date.now();
        const result = await connector.orchestrateToolExecution(
          'performance_benchmark',
          { complexity: 'medium' },
          1
        );
        const executionTime = Date.now() - startTime;

        results.push({
          topology,
          success: result.success,
          executionTime,
          efficiency: result.metrics?.efficiency || 0,
          resourceUtilization: result.metrics?.resourceUtilization || 0
        });

        await connector.destroySwarm(swarmResult.swarmId!);
      }

      // Verify all topologies completed successfully
      expect(results.every(r => r.success)).toBe(true);

      // Analyze performance characteristics
      const meshResult = results.find(r => r.topology === 'mesh')!;
      const hierarchicalResult = results.find(r => r.topology === 'hierarchical')!;
      const ringResult = results.find(r => r.topology === 'ring')!;
      const starResult = results.find(r => r.topology === 'star')!;

      // Mesh should have high efficiency but potentially higher resource usage
      expect(meshResult.efficiency).toBeGreaterThan(0.8);
      
      // Hierarchical should have good coordination but some overhead
      expect(hierarchicalResult.executionTime).toBeGreaterThan(meshResult.executionTime * 0.9);
      
      // Ring should be efficient for pipeline tasks
      expect(ringResult.efficiency).toBeGreaterThan(0.75);
      
      // Star should have low resource utilization on spokes
      expect(starResult.resourceUtilization).toBeLessThan(meshResult.resourceUtilization);
    });

    it('should recommend optimal topology based on task characteristics', async () => {
      const taskProfiles = [
        {
          name: 'parallel-independent-tasks',
          characteristics: {
            parallelizable: true,
            interdependent: false,
            coordinationNeeded: false,
            resourceIntensive: false
          },
          expectedTopology: 'mesh'
        },
        {
          name: 'supervised-workflow',
          characteristics: {
            parallelizable: true,
            interdependent: true,
            coordinationNeeded: true,
            resourceIntensive: true
          },
          expectedTopology: 'hierarchical'
        },
        {
          name: 'pipeline-processing',
          characteristics: {
            parallelizable: false,
            interdependent: true,
            coordinationNeeded: false,
            resourceIntensive: false
          },
          expectedTopology: 'ring'
        },
        {
          name: 'resource-distribution',
          characteristics: {
            parallelizable: true,
            interdependent: false,
            coordinationNeeded: true,
            resourceIntensive: true
          },
          expectedTopology: 'star'
        }
      ];

      for (const profile of taskProfiles) {
        const recommendation = await connector.recommendTopology(profile.characteristics);
        
        expect(recommendation.recommendedTopology).toBe(profile.expectedTopology);
        expect(recommendation.confidence).toBeGreaterThan(0.7); // > 70% confidence
        expect(recommendation.reasoning).toBeDefined();
      }
    });
  });

  describe('Dynamic Topology Adaptation', () => {
    it('should adapt topology based on runtime performance', async () => {
      // Start with mesh topology
      const swarmResult = await connector.createSwarm({
        topology: 'mesh',
        maxAgents: 4,
        adaptiveTopology: true
      });

      await Promise.all([
        connector.spawnAgent(swarmResult.swarmId!, AgentType.CODER, []),
        connector.spawnAgent(swarmResult.swarmId!, AgentType.CODER, []),
        connector.spawnAgent(swarmResult.swarmId!, AgentType.CODER, []),
        connector.spawnAgent(swarmResult.swarmId!, AgentType.CODER, [])
      ]);

      // Execute task that would benefit from hierarchical topology
      const result = await connector.orchestrateToolExecution(
        'coordination_intensive_task',
        { requiresSupervision: true },
        1,
        { enableTopologyAdaptation: true }
      );

      expect(result.success).toBe(true);
      
      // Check if topology was adapted
      const finalStatus = await connector.getSwarmStatus(swarmResult.swarmId!);
      if (result.metrics?.topologyChanged) {
        expect(finalStatus.data.currentTopology).toBe('hierarchical');
        expect(result.metrics.adaptationReason).toBeDefined();
      }
    });

    it('should handle topology transitions smoothly', async () => {
      const swarmResult = await connector.createSwarm({
        topology: 'ring',
        maxAgents: 3
      });

      await Promise.all([
        connector.spawnAgent(swarmResult.swarmId!, AgentType.CODER, []),
        connector.spawnAgent(swarmResult.swarmId!, AgentType.CODER, []),
        connector.spawnAgent(swarmResult.swarmId!, AgentType.CODER, [])
      ]);

      // Trigger topology change
      const transitionResult = await connector.changeTopology(
        swarmResult.swarmId!,
        'mesh',
        { preserveAgents: true, gracefulTransition: true }
      );

      expect(transitionResult.success).toBe(true);
      expect(transitionResult.transitionTime).toBeLessThan(5000); // < 5 seconds
      expect(transitionResult.agentsPreserved).toBe(3);
      
      // Verify new topology is working
      const verificationResult = await connector.orchestrateToolExecution(
        'topology_verification',
        {},
        1
      );
      
      expect(verificationResult.success).toBe(true);
      expect(verificationResult.data.currentTopology).toBe('mesh');
    });
  });
});
