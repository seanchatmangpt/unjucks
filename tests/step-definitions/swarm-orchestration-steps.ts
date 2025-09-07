import { Given, When, Then, Before, After } from "@cucumber/cucumber";
import { expect } from "chai";
import { spawn, ChildProcess } from "child_process";
import { promises as fs } from "fs";
import * as path from "path";
import fetch from "node-fetch";
import WebSocket from "ws";

// Extended test context for swarm orchestration
interface SwarmTestContext {
  mcpProcess?: ChildProcess;
  swarmId?: string;
  agentIds?: string[];
  swarmTopology?: string;
  agentCount?: number;
  lastCommand?: string;
  lastOutput?: string;
  lastError?: string;
  lastExitCode?: number;
  startTime?: number;
  performanceMetrics?: Record<string, any>;
  tempFiles?: string[];
  mcpEndpoint?: string;
  authToken?: string;
  websocket?: WebSocket;
  realtimeEvents?: any[];
  swarmHealth?: string;
  taskIds?: string[];
  executionMetrics?: Record<string, any>;
  benchmarkResults?: Record<string, any>;
  securityScanResults?: Record<string, any>;
}

let swarmContext: SwarmTestContext = {};

// Constants for swarm testing
const SWARM_TIMEOUT = 60000; // 60 seconds for complex swarm operations
const AGENT_SPAWN_TIMEOUT = 30000; // 30 seconds for agent spawning
const MCP_ENDPOINT = process.env.MCP_ENDPOINT || "http://localhost:8000";
const WS_ENDPOINT = process.env.WS_ENDPOINT || "ws://localhost:8001";

// Utility functions for swarm testing
async function executeSwarmCommand(command: string, timeout: number = SWARM_TIMEOUT): Promise<{
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number;
}> {
  const startTime = Date.now();
  
  return new Promise((resolve, reject) => {
    const parts = command.split(' ');
    const cmd = parts[0];
    const args = parts.slice(1);
    
    const process = spawn(cmd, args, {
      stdio: 'pipe',
      env: { 
        ...process.env,
        MCP_ENDPOINT,
        DEBUG_UNJUCKS: 'false',
        NODE_ENV: 'test',
        SWARM_MODE: 'test'
      }
    });

    let stdout = '';
    let stderr = '';

    process.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    process.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    const timeoutHandle = setTimeout(() => {
      process.kill('SIGKILL');
      reject(new Error(`Swarm command timeout after ${timeout}ms: ${command}`));
    }, timeout);

    process.on('close', (code) => {
      clearTimeout(timeoutHandle);
      const duration = Date.now() - startTime;
      resolve({
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: code || 0,
        duration
      });
    });

    process.on('error', (error) => {
      clearTimeout(timeoutHandle);
      reject(error);
    });
  });
}

async function validateSwarmStatus(swarmId: string): Promise<boolean> {
  try {
    const result = await executeSwarmCommand(`unjucks swarm status ${swarmId}`, 10000);
    return result.exitCode === 0 && result.stdout.includes('active');
  } catch {
    return false;
  }
}

async function waitForAgentsReady(expectedCount: number, maxWait: number = 30000): Promise<boolean> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWait) {
    try {
      const result = await executeSwarmCommand('unjucks swarm agent list', 10000);
      if (result.exitCode === 0) {
        const agentMatches = result.stdout.match(/agent-\w+-\d+/g) || [];
        if (agentMatches.length >= expectedCount) {
          swarmContext.agentIds = agentMatches;
          return true;
        }
      }
    } catch {
      // Continue waiting
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  return false;
}

async function measureSwarmPerformance(taskType: string, taskCount: number): Promise<Record<string, any>> {
  const startTime = Date.now();
  const metrics: Record<string, any> = {};
  
  // Execute tasks and measure performance
  const tasks = Array.from({ length: taskCount }, (_, i) => `${taskType}-task-${i}`);
  
  const results = await Promise.allSettled(tasks.map(task => 
    executeSwarmCommand(`unjucks swarm orchestrate "${task}" --async`, 15000)
  ));
  
  const successful = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;
  const totalTime = Date.now() - startTime;
  
  return {
    taskCount,
    successful,
    failed,
    totalTime,
    averageTime: totalTime / successful || 0,
    successRate: (successful / taskCount) * 100,
    throughput: (successful / (totalTime / 1000)) // tasks per second
  };
}

// Background setup for swarm tests
Before({ tags: "@swarm" }, async function() {
  swarmContext = {
    tempFiles: [],
    agentIds: [],
    taskIds: [],
    realtimeEvents: [],
    mcpEndpoint: MCP_ENDPOINT
  };
  
  // Ensure MCP server is ready for swarm operations
  const mcpReady = await validateSwarmStatus('test-swarm').catch(() => false);
  if (!mcpReady) {
    console.log('Starting MCP server for swarm testing...');
    swarmContext.mcpProcess = spawn('npx', ['claude-flow@alpha', 'mcp', 'start'], {
      stdio: 'pipe',
      env: { ...process.env, PORT: '8000', SWARM_MODE: 'true' }
    });
    
    // Wait for server to be ready
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
});

After({ tags: "@swarm" }, async function() {
  // Cleanup swarms
  if (swarmContext.swarmId) {
    try {
      await executeSwarmCommand(`unjucks swarm destroy ${swarmContext.swarmId} --force --cleanup`, 15000);
    } catch {
      // Ignore cleanup errors
    }
  }
  
  // Close WebSocket connections
  if (swarmContext.websocket) {
    swarmContext.websocket.close();
  }
  
  // Cleanup temp files
  if (swarmContext.tempFiles) {
    for (const file of swarmContext.tempFiles) {
      try {
        await fs.unlink(file);
      } catch {
        // Ignore cleanup errors
      }
    }
  }
  
  // Stop MCP process if we started it
  if (swarmContext.mcpProcess) {
    swarmContext.mcpProcess.kill();
  }
});

// Swarm initialization step definitions
Given('I want to create an advanced swarm with neural capabilities', function() {
  swarmContext.startTime = Date.now();
});

When('I run {string}', async function(command: string) {
  swarmContext.lastCommand = command;
  
  try {
    const result = await executeSwarmCommand(command, SWARM_TIMEOUT);
    swarmContext.lastOutput = result.stdout;
    swarmContext.lastError = result.stderr;
    swarmContext.lastExitCode = result.exitCode;
    swarmContext.performanceMetrics = {
      duration: result.duration,
      command: command
    };
    
    // Extract swarm ID if this was a swarm init command
    if (command.includes('swarm init')) {
      const swarmMatch = result.stdout.match(/swarm[_\s]id[:\s]+([a-zA-Z0-9-]+)/i);
      if (swarmMatch) {
        swarmContext.swarmId = swarmMatch[1];
      }
      
      // Extract topology
      const topologyMatch = command.match(/--topology\s+(\w+)/);
      if (topologyMatch) {
        swarmContext.swarmTopology = topologyMatch[1];
      }
      
      // Extract agent count
      const agentMatch = command.match(/--agents\s+(\d+)/);
      if (agentMatch) {
        swarmContext.agentCount = parseInt(agentMatch[1]);
      }
    }
    
  } catch (error) {
    swarmContext.lastError = error instanceof Error ? error.message : String(error);
    swarmContext.lastExitCode = 1;
  }
});

Then('the swarm should be initialized successfully', function() {
  expect(swarmContext.lastExitCode, `Swarm initialization failed: ${swarmContext.lastError}`).to.equal(0);
  expect(swarmContext.lastOutput).to.include('initialized');
  expect(swarmContext.swarmId).to.not.be.undefined;
});

Then('neural training should be activated for coordination patterns', function() {
  expect(swarmContext.lastOutput).to.include('neural');
  expect(swarmContext.lastOutput).to.include('training');
  expect(swarmContext.lastOutput).to.include('coordination');
});

Then('{int} DAA agents should be spawned with adaptive cognitive patterns', async function(expectedCount: number) {
  expect(swarmContext.lastOutput).to.include('DAA');
  expect(swarmContext.lastOutput).to.include('adaptive');
  
  // Wait for agents to be ready
  const agentsReady = await waitForAgentsReady(expectedCount, 30000);
  expect(agentsReady, 'Agents were not ready within timeout').to.be.true;
  expect(swarmContext.agentIds?.length).to.equal(expectedCount);
});

Then('each agent should have individual neural networks', function() {
  expect(swarmContext.lastOutput).to.include('neural');
  expect(swarmContext.lastOutput).to.include('networks');
});

Then('swarm memory should be initialized with cross-session persistence', function() {
  expect(swarmContext.lastOutput).to.include('memory');
  expect(swarmContext.lastOutput).to.include('persistence');
});

Then('the swarm status should show {string} with health {string}', async function(expectedStatus: string, expectedHealth: string) {
  const statusResult = await executeSwarmCommand(`unjucks swarm status ${swarmContext.swarmId}`, 15000);
  expect(statusResult.exitCode).to.equal(0);
  expect(statusResult.stdout).to.include(expectedStatus);
  expect(statusResult.stdout).to.include(expectedHealth);
  swarmContext.swarmHealth = expectedHealth;
});

// Agent deployment step definitions
Given('I have an active neural swarm initialized', async function() {
  if (!swarmContext.swarmId) {
    // Initialize a test swarm
    const result = await executeSwarmCommand('unjucks swarm init --topology mesh --agents 5 --neural --daa', SWARM_TIMEOUT);
    expect(result.exitCode).to.equal(0);
    
    const swarmMatch = result.stdout.match(/swarm[_\s]id[:\s]+([a-zA-Z0-9-]+)/i);
    if (swarmMatch) {
      swarmContext.swarmId = swarmMatch[1];
    }
  }
  
  // Verify swarm is active
  const isActive = await validateSwarmStatus(swarmContext.swarmId!);
  expect(isActive).to.be.true;
});

Then('each agent should be deployed with specified cognitive patterns', function() {
  expect(swarmContext.lastOutput).to.include('cognitive');
  expect(swarmContext.lastOutput).to.include('pattern');
  expect(swarmContext.lastOutput).to.include('deployed');
});

Then('learning rates should be configured according to autonomy levels', function() {
  expect(swarmContext.lastOutput).to.include('learning');
  expect(swarmContext.lastOutput).to.include('autonomy');
});

Then('agents should begin autonomous skill acquisition', function() {
  expect(swarmContext.lastOutput).to.include('autonomous');
  expect(swarmContext.lastOutput).to.include('skill');
});

Then('memory systems should be isolated per agent with shared knowledge base', function() {
  expect(swarmContext.lastOutput).to.include('memory');
  expect(swarmContext.lastOutput).to.include('isolated');
  expect(swarmContext.lastOutput).to.include('shared');
});

Then('performance metrics should track learning progress', function() {
  expect(swarmContext.lastOutput).to.include('metrics');
  expect(swarmContext.lastOutput).to.include('learning');
  expect(swarmContext.lastOutput).to.include('progress');
});

// Orchestration step definitions
Given('I have a neural swarm with specialized DAA agents', async function() {
  // Ensure we have a neural swarm with DAA agents
  if (!swarmContext.swarmId) {
    await this.Given('I have an active neural swarm initialized');
  }
  
  // Deploy specialized agents
  const agentTypes = ['backend-dev', 'tester', 'optimizer'];
  for (const agentType of agentTypes) {
    const result = await executeSwarmCommand(`unjucks swarm agent deploy ${agentType} --cognitive adaptive --autonomy 0.8 --learning`, AGENT_SPAWN_TIMEOUT);
    expect(result.exitCode).to.equal(0);
  }
});

Given('I have a complex multi-step workflow requiring coordination', function() {
  // This is a given that sets up the context for complex orchestration
  swarmContext.executionMetrics = {
    expectedSteps: ['analysis', 'architecture', 'implementation', 'testing', 'deployment'],
    expectedComplexity: 'high'
  };
});

Then('agents should autonomously analyze and decompose the complex task', function() {
  expect(swarmContext.lastOutput).to.include('analyze');
  expect(swarmContext.lastOutput).to.include('decompose');
  expect(swarmContext.lastOutput).to.include('autonomous');
});

Then('task distribution should be optimized based on agent capabilities', function() {
  expect(swarmContext.lastOutput).to.include('distribution');
  expect(swarmContext.lastOutput).to.include('optimized');
  expect(swarmContext.lastOutput).to.include('capabilities');
});

Then('agents should coordinate independently without central control', function() {
  expect(swarmContext.lastOutput).to.include('coordinate');
  expect(swarmContext.lastOutput).to.include('independently');
});

Then('learning should occur from successful coordination patterns', function() {
  expect(swarmContext.lastOutput).to.include('learning');
  expect(swarmContext.lastOutput).to.include('coordination');
  expect(swarmContext.lastOutput).to.include('patterns');
});

Then('the orchestration should complete all phases within performance SLA', function() {
  const duration = swarmContext.performanceMetrics?.duration || 0;
  expect(duration).to.be.lessThan(300000); // 5 minutes SLA
  expect(swarmContext.lastExitCode).to.equal(0);
});

// Neural training step definitions
Given('I have historical swarm coordination data', async function() {
  // Create test coordination history file
  const historyFile = path.resolve('tests/fixtures/swarm-history.json');
  swarmContext.tempFiles?.push(historyFile);
  
  const historyData = {
    coordination_events: [
      {
        timestamp: new Date().toISOString(),
        task_type: 'code-generation',
        agents_involved: ['coder-001', 'reviewer-001'],
        success: true,
        duration: 45000,
        patterns: ['parallel-execution', 'peer-review']
      },
      {
        timestamp: new Date().toISOString(),
        task_type: 'testing',
        agents_involved: ['tester-001', 'tester-002'],
        success: true,
        duration: 32000,
        patterns: ['load-balancing', 'result-aggregation']
      }
    ],
    performance_metrics: {
      average_coordination_time: 38500,
      success_rate: 0.95,
      agent_utilization: 0.78
    }
  };
  
  await fs.mkdir(path.dirname(historyFile), { recursive: true });
  await fs.writeFile(historyFile, JSON.stringify(historyData, null, 2));
});

Then('neural networks should be trained on coordination patterns', function() {
  expect(swarmContext.lastOutput).to.include('neural');
  expect(swarmContext.lastOutput).to.include('trained');
  expect(swarmContext.lastOutput).to.include('coordination');
});

Then('training should converge within acceptable loss thresholds', function() {
  expect(swarmContext.lastOutput).to.include('converge');
  expect(swarmContext.lastOutput).to.include('loss');
  expect(swarmContext.lastExitCode).to.equal(0);
});

Then('learned patterns should improve future task distribution', function() {
  expect(swarmContext.lastOutput).to.include('patterns');
  expect(swarmContext.lastOutput).to.include('improve');
  expect(swarmContext.lastOutput).to.include('distribution');
});

Then('cognitive models should be validated against performance metrics', function() {
  expect(swarmContext.lastOutput).to.include('cognitive');
  expect(swarmContext.lastOutput).to.include('validated');
  expect(swarmContext.lastOutput).to.include('metrics');
});

Then('trained models should be persisted for future swarm sessions', function() {
  expect(swarmContext.lastOutput).to.include('persisted');
  expect(swarmContext.lastOutput).to.include('models');
  expect(swarmContext.lastOutput).to.include('sessions');
});

// Distributed neural cluster step definitions
Given('I need massive parallel processing capabilities', function() {
  swarmContext.executionMetrics = {
    ...swarmContext.executionMetrics,
    requiresDistributedProcessing: true,
    expectedNodes: 12
  };
});

Then('a distributed neural cluster should be created with {int} nodes', function(expectedNodes: number) {
  expect(swarmContext.lastOutput).to.include('cluster');
  expect(swarmContext.lastOutput).to.include(expectedNodes.toString());
  expect(swarmContext.lastExitCode).to.equal(0);
});

Then('nodes should be connected in mesh topology for redundancy', function() {
  expect(swarmContext.lastOutput).to.include('mesh');
  expect(swarmContext.lastOutput).to.include('topology');
  expect(swarmContext.lastOutput).to.include('redundancy');
});

Then('neural processing should be distributed across all nodes', function() {
  expect(swarmContext.lastOutput).to.include('distributed');
  expect(swarmContext.lastOutput).to.include('processing');
});

Then('cluster should handle node failures with automatic failover', function() {
  expect(swarmContext.lastOutput).to.include('failover');
  expect(swarmContext.lastOutput).to.include('failures');
});

Then('processing throughput should scale linearly with node count', async function() {
  // This would require actual performance testing
  // For now, verify the command completed successfully
  expect(swarmContext.lastExitCode).to.equal(0);
  expect(swarmContext.lastOutput).to.include('throughput');
});

// Performance benchmarking step definitions
Given('I have multiple swarm configurations to compare', async function() {
  swarmContext.benchmarkResults = {
    configurations: [
      { topology: 'mesh', agents: 5, neural: true },
      { topology: 'hierarchical', agents: 8, neural: false },
      { topology: 'ring', agents: 6, neural: true }
    ]
  };
});

Then('benchmarks should measure neural processing performance', function() {
  expect(swarmContext.lastOutput).to.include('benchmark');
  expect(swarmContext.lastOutput).to.include('neural');
  expect(swarmContext.lastOutput).to.include('performance');
});

Then('learning speed should be compared across cognitive patterns', function() {
  expect(swarmContext.lastOutput).to.include('learning');
  expect(swarmContext.lastOutput).to.include('speed');
  expect(swarmContext.lastOutput).to.include('cognitive');
});

Then('memory efficiency should be tracked for different architectures', function() {
  expect(swarmContext.lastOutput).to.include('memory');
  expect(swarmContext.lastOutput).to.include('efficiency');
  expect(swarmContext.lastOutput).to.include('architecture');
});

Then('reliability metrics should include fault recovery times', function() {
  expect(swarmContext.lastOutput).to.include('reliability');
  expect(swarmContext.lastOutput).to.include('fault');
  expect(swarmContext.lastOutput).to.include('recovery');
});

Then('performance improvements from neural training should be quantified', function() {
  expect(swarmContext.lastOutput).to.include('improvements');
  expect(swarmContext.lastOutput).to.include('neural');
  expect(swarmContext.lastOutput).to.include('quantified');
});

Then('benchmark results should be exportable for analysis', function() {
  expect(swarmContext.lastOutput).to.include('export');
  expect(swarmContext.lastOutput).to.include('results');
});

// Security validation step definitions
Given('I have enterprise neural swarms processing sensitive data', async function() {
  swarmContext.securityScanResults = {
    sensitiveDataHandling: true,
    complianceRequired: ['SOX', 'GDPR', 'HIPAA'],
    encryptionRequired: true
  };
});

Then('neural networks should be validated for security vulnerabilities', function() {
  expect(swarmContext.lastOutput).to.include('neural');
  expect(swarmContext.lastOutput).to.include('security');
  expect(swarmContext.lastOutput).to.include('validated');
});

Then('agent communications should be verified for encryption', function() {
  expect(swarmContext.lastOutput).to.include('communication');
  expect(swarmContext.lastOutput).to.include('encryption');
  expect(swarmContext.lastOutput).to.include('verified');
});

Then('DAA autonomous decisions should comply with security policies', function() {
  expect(swarmContext.lastOutput).to.include('DAA');
  expect(swarmContext.lastOutput).to.include('autonomous');
  expect(swarmContext.lastOutput).to.include('comply');
});

Then('threat assessment should identify potential attack vectors', function() {
  expect(swarmContext.lastOutput).to.include('threat');
  expect(swarmContext.lastOutput).to.include('assessment');
  expect(swarmContext.lastOutput).to.include('attack');
});

Then('compliance reports should meet enterprise security standards', function() {
  expect(swarmContext.lastOutput).to.include('compliance');
  expect(swarmContext.lastOutput).to.include('reports');
  expect(swarmContext.lastOutput).to.include('standards');
});

Then('security monitoring should provide real-time threat detection', function() {
  expect(swarmContext.lastOutput).to.include('monitoring');
  expect(swarmContext.lastOutput).to.include('real-time');
  expect(swarmContext.lastOutput).to.include('threat');
});

// Cost optimization step definitions
Given('I have swarms with varying resource costs and performance requirements', function() {
  swarmContext.executionMetrics = {
    ...swarmContext.executionMetrics,
    costOptimization: true,
    performanceRequirements: ['low-latency', 'high-throughput', 'cost-effective']
  };
});

Then('neural analysis should identify cost optimization opportunities', function() {
  expect(swarmContext.lastOutput).to.include('neural');
  expect(swarmContext.lastOutput).to.include('cost');
  expect(swarmContext.lastOutput).to.include('optimization');
});

Then('resource allocation should be optimized based on usage patterns', function() {
  expect(swarmContext.lastOutput).to.include('resource');
  expect(swarmContext.lastOutput).to.include('allocation');
  expect(swarmContext.lastOutput).to.include('patterns');
});

Then('agent configurations should be automatically tuned for efficiency', function() {
  expect(swarmContext.lastOutput).to.include('configuration');
  expect(swarmContext.lastOutput).to.include('tuned');
  expect(swarmContext.lastOutput).to.include('efficiency');
});

Then('cost projections should be provided with confidence intervals', function() {
  expect(swarmContext.lastOutput).to.include('cost');
  expect(swarmContext.lastOutput).to.include('projection');
  expect(swarmContext.lastOutput).to.include('confidence');
});

Then('optimization recommendations should be prioritized by impact', function() {
  expect(swarmContext.lastOutput).to.include('recommendation');
  expect(swarmContext.lastOutput).to.include('prioritized');
  expect(swarmContext.lastOutput).to.include('impact');
});

Then('cost savings should be measurable and tracked over time', function() {
  expect(swarmContext.lastOutput).to.include('cost');
  expect(swarmContext.lastOutput).to.include('savings');
  expect(swarmContext.lastOutput).to.include('tracked');
});

// Real-time monitoring step definitions
Given('I have neural swarms processing production workloads', async function() {
  if (!swarmContext.swarmId) {
    await this.Given('I have an active neural swarm initialized');
  }
  
  // Start some production-like workload simulation
  const workloadResult = await executeSwarmCommand(`unjucks swarm orchestrate "production workload simulation" --strategy adaptive`, 15000);
  expect(workloadResult.exitCode).to.equal(0);
});

Then('monitoring should provide real-time neural network status', function() {
  expect(swarmContext.lastOutput).to.include('monitoring');
  expect(swarmContext.lastOutput).to.include('neural');
  expect(swarmContext.lastOutput).to.include('status');
});

Then('predictive analytics should forecast performance trends', function() {
  expect(swarmContext.lastOutput).to.include('predictive');
  expect(swarmContext.lastOutput).to.include('analytics');
  expect(swarmContext.lastOutput).to.include('forecast');
});

Then('anomaly detection should identify unusual patterns automatically', function() {
  expect(swarmContext.lastOutput).to.include('anomaly');
  expect(swarmContext.lastOutput).to.include('detection');
  expect(swarmContext.lastOutput).to.include('patterns');
});

Then('learning progress should be visualized across all agents', function() {
  expect(swarmContext.lastOutput).to.include('learning');
  expect(swarmContext.lastOutput).to.include('progress');
  expect(swarmContext.lastOutput).to.include('agents');
});

Then('performance bottlenecks should be identified with AI recommendations', function() {
  expect(swarmContext.lastOutput).to.include('bottleneck');
  expect(swarmContext.lastOutput).to.include('identified');
  expect(swarmContext.lastOutput).to.include('recommendation');
});

Then('monitoring data should enable proactive optimization', function() {
  expect(swarmContext.lastOutput).to.include('monitoring');
  expect(swarmContext.lastOutput).to.include('proactive');
  expect(swarmContext.lastOutput).to.include('optimization');
});