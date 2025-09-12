// AI Swarm Coordination Examples for Unjucks v2
// Demonstrates integration with Claude-Flow and multi-agent systems

/**
 * =============================================================================
 * SWARM COORDINATOR ARCHITECTURE
 * =============================================================================
 */

class UnjucksSwarmCoordinator {
  constructor(options = {}) {
    this.options = {
      maxAgents: 8,
      topology: 'mesh',
      strategy: 'adaptive',
      enableNeuralPatterns: true,
      memoryNamespace: 'unjucks-swarm',
      ...options
    };
    
    this.swarmId = null;
    this.agents = new Map();
    this.taskQueue = [];
    this.results = new Map();
    this.performance = {
      startTime: null,
      endTime: null,
      tasksCompleted: 0,
      tokenUsage: 0
    };
  }

  // Initialize swarm with Claude-Flow integration
  async initializeSwarm() {
    try {
      // Initialize swarm topology
      const swarmResult = await this.executeClaudeFlow('swarm_init', {
        topology: this.options.topology,
        maxAgents: this.options.maxAgents,
        strategy: this.options.strategy
      });

      this.swarmId = swarmResult.swarmId;
      console.log(`Swarm initialized with ID: ${this.swarmId}`);

      // Spawn specialized agents
      await this.spawnSpecializedAgents();

      // Setup neural pattern learning
      if (this.options.enableNeuralPatterns) {
        await this.initializeNeuralPatterns();
      }

      return {
        success: true,
        swarmId: this.swarmId,
        agentCount: this.agents.size
      };

    } catch (error) {
      console.error('Swarm initialization failed:', error);
      throw new Error(`Swarm initialization failed: ${error.message}`);
    }
  }

  // Spawn specialized agents for different tasks
  async spawnSpecializedAgents() {
    const agentTypes = [
      { type: 'researcher', name: 'template-researcher', capabilities: ['template-analysis', 'pattern-recognition'] },
      { type: 'coder', name: 'code-generator', capabilities: ['typescript', 'javascript', 'template-rendering'] },
      { type: 'reviewer', name: 'code-reviewer', capabilities: ['code-quality', 'security-analysis', 'best-practices'] },
      { type: 'tester', name: 'test-generator', capabilities: ['unit-testing', 'integration-testing', 'bdd-scenarios'] },
      { type: 'architect', name: 'system-architect', capabilities: ['architecture-design', 'pattern-matching'] },
      { type: 'optimizer', name: 'performance-optimizer', capabilities: ['code-optimization', 'bundling', 'minification'] }
    ];

    for (const agentSpec of agentTypes) {
      try {
        const agent = await this.executeClaudeFlow('agent_spawn', {
          type: agentSpec.type,
          name: agentSpec.name,
          capabilities: agentSpec.capabilities
        });

        this.agents.set(agentSpec.name, {
          ...agent,
          ...agentSpec,
          status: 'idle',
          tasksCompleted: 0,
          performance: {
            avgExecutionTime: 0,
            successRate: 1.0
          }
        });

        console.log(`Agent spawned: ${agentSpec.name} (${agentSpec.type})`);

      } catch (error) {
        console.warn(`Failed to spawn agent ${agentSpec.name}:`, error.message);
      }
    }
  }

  // Initialize neural pattern learning
  async initializeNeuralPatterns() {
    try {
      await this.executeClaudeFlow('neural_status');
      
      // Train patterns for code generation coordination
      await this.executeClaudeFlow('neural_train', {
        pattern_type: 'coordination',
        training_data: JSON.stringify({
          patterns: [
            'template-analysis -> code-generation -> testing -> review',
            'requirements -> architecture -> implementation -> validation',
            'research -> design -> code -> optimize -> test'
          ]
        })
      });

      console.log('Neural patterns initialized for swarm coordination');
    } catch (error) {
      console.warn('Neural pattern initialization failed:', error.message);
    }
  }

  /**
   * =============================================================================
   * TASK ORCHESTRATION
   * =============================================================================
   */

  // Orchestrate complex generation task across swarm
  async orchestrateGeneration(generationRequest) {
    this.performance.startTime = this.getDeterministicTimestamp();
    
    try {
      // Break down the generation into tasks
      const tasks = await this.analyzeAndDecompose(generationRequest);
      
      // Assign tasks to appropriate agents
      const assignments = await this.assignTasks(tasks);
      
      // Execute tasks in parallel with coordination
      const results = await this.executeTasksWithCoordination(assignments);
      
      // Aggregate and validate results
      const finalResult = await this.aggregateResults(results);
      
      this.performance.endTime = this.getDeterministicTimestamp();
      this.performance.tasksCompleted = tasks.length;
      
      return {
        success: true,
        result: finalResult,
        performance: this.getPerformanceMetrics(),
        swarmMetrics: await this.getSwarmMetrics()
      };

    } catch (error) {
      console.error('Task orchestration failed:', error);
      return {
        success: false,
        error: error.message,
        partialResults: this.results
      };
    }
  }

  // Analyze request and decompose into tasks
  async analyzeAndDecompose(request) {
    console.log('Analyzing generation request...');
    
    // Use researcher agent to analyze requirements
    const analysisResult = await this.executeAgentTask('template-researcher', {
      task: 'analyze-requirements',
      data: {
        templatePath: request.templatePath,
        variables: request.variables,
        outputPath: request.outputPath,
        options: request.options
      }
    });

    // Decompose into specific tasks based on analysis
    const tasks = [
      {
        id: 'template-analysis',
        type: 'research',
        agent: 'template-researcher',
        priority: 'high',
        data: {
          templatePath: request.templatePath,
          analysis: analysisResult.templateStructure
        }
      },
      {
        id: 'architecture-design',
        type: 'architecture',
        agent: 'system-architect',
        priority: 'high',
        dependencies: ['template-analysis'],
        data: {
          requirements: request.variables,
          patterns: analysisResult.recommendedPatterns
        }
      },
      {
        id: 'code-generation',
        type: 'generation',
        agent: 'code-generator',
        priority: 'medium',
        dependencies: ['template-analysis', 'architecture-design'],
        data: {
          templatePath: request.templatePath,
          variables: request.variables,
          architecture: null // Will be filled from architecture-design result
        }
      },
      {
        id: 'test-generation',
        type: 'testing',
        agent: 'test-generator',
        priority: 'medium',
        dependencies: ['code-generation'],
        data: {
          generatedCode: null, // Will be filled from code-generation result
          testingStrategy: 'comprehensive'
        }
      },
      {
        id: 'code-review',
        type: 'review',
        agent: 'code-reviewer',
        priority: 'medium',
        dependencies: ['code-generation'],
        data: {
          codeFiles: null, // Will be filled from code-generation result
          reviewCriteria: ['security', 'performance', 'maintainability']
        }
      },
      {
        id: 'optimization',
        type: 'optimization',
        agent: 'performance-optimizer',
        priority: 'low',
        dependencies: ['code-generation', 'code-review'],
        data: {
          codeFiles: null, // Will be filled from code-generation result
          optimizations: ['bundle-size', 'runtime-performance']
        }
      }
    ];

    console.log(`Decomposed into ${tasks.length} tasks`);
    return tasks;
  }

  // Assign tasks to agents with load balancing
  async assignTasks(tasks) {
    const assignments = new Map();
    
    // Sort tasks by priority and dependencies
    const sortedTasks = this.topologicalSort(tasks);
    
    for (const task of sortedTasks) {
      const agent = this.agents.get(task.agent);
      if (!agent) {
        throw new Error(`Agent ${task.agent} not available`);
      }

      if (!assignments.has(task.agent)) {
        assignments.set(task.agent, []);
      }
      
      assignments.get(task.agent).push(task);
      agent.status = 'assigned';
    }

    console.log('Tasks assigned to agents:', 
      Array.from(assignments.entries()).map(([agent, tasks]) => 
        `${agent}: ${tasks.length} tasks`
      ).join(', ')
    );

    return assignments;
  }

  // Execute tasks with inter-agent coordination
  async executeTasksWithCoordination(assignments) {
    const executionResults = new Map();
    const completedTasks = new Set();
    const inProgressTasks = new Set();

    // Execute tasks respecting dependencies
    while (completedTasks.size < this.getTotalTaskCount(assignments)) {
      const readyTasks = this.getReadyTasks(assignments, completedTasks, inProgressTasks);
      
      if (readyTasks.length === 0) {
        // Check for circular dependencies or errors
        const remainingTasks = this.getRemainingTasks(assignments, completedTasks, inProgressTasks);
        if (remainingTasks.length > 0) {
          console.warn('Potential circular dependency or error in task execution');
          break;
        }
        continue;
      }

      // Execute ready tasks in parallel
      const promises = readyTasks.map(async (task) => {
        inProgressTasks.add(task.id);
        
        try {
          // Prepare task data with dependencies
          const taskData = await this.prepareTaskData(task, executionResults);
          
          // Execute task with agent
          const result = await this.executeAgentTask(task.agent, {
            taskId: task.id,
            type: task.type,
            ...taskData
          });

          // Store result and update coordination state
          executionResults.set(task.id, result);
          completedTasks.add(task.id);
          inProgressTasks.delete(task.id);

          // Update agent performance metrics
          this.updateAgentPerformance(task.agent, result);

          // Share knowledge with other agents if needed
          if (task.shareResults) {
            await this.shareKnowledge(task, result);
          }

          console.log(`Task completed: ${task.id} by ${task.agent}`);
          return { taskId: task.id, success: true, result };

        } catch (error) {
          console.error(`Task failed: ${task.id} by ${task.agent}:`, error.message);
          inProgressTasks.delete(task.id);
          return { taskId: task.id, success: false, error: error.message };
        }
      });

      // Wait for current batch to complete
      await Promise.all(promises);
      
      // Brief pause for coordination
      await this.sleep(100);
    }

    return executionResults;
  }

  // Execute task with specific agent through Claude-Flow
  async executeAgentTask(agentName, taskData) {
    const agent = this.agents.get(agentName);
    if (!agent) {
      throw new Error(`Agent ${agentName} not found`);
    }

    agent.status = 'busy';
    const startTime = this.getDeterministicTimestamp();

    try {
      // Store task context in memory for agent coordination
      await this.storeTaskContext(taskData.taskId, taskData);

      // Execute task through Claude-Flow orchestration
      const result = await this.executeClaudeFlow('task_orchestrate', {
        task: this.formatTaskForAgent(taskData, agent),
        strategy: 'adaptive',
        maxAgents: 1,
        priority: taskData.priority || 'medium'
      });

      // Retrieve and parse results
      const taskResults = await this.executeClaudeFlow('task_results', {
        taskId: result.taskId
      });

      const executionTime = this.getDeterministicTimestamp() - startTime;
      agent.tasksCompleted++;
      agent.performance.avgExecutionTime = 
        (agent.performance.avgExecutionTime + executionTime) / agent.tasksCompleted;

      agent.status = 'idle';

      return {
        success: true,
        data: taskResults.result,
        executionTime,
        agent: agentName
      };

    } catch (error) {
      agent.status = 'error';
      agent.performance.successRate = 
        (agent.performance.successRate * agent.tasksCompleted) / (agent.tasksCompleted + 1);
      
      throw error;
    }
  }

  // Format task for agent execution
  formatTaskForAgent(taskData, agent) {
    const agentTasks = {
      'template-researcher': this.formatResearchTask,
      'code-generator': this.formatCodeGenerationTask,
      'code-reviewer': this.formatReviewTask,
      'test-generator': this.formatTestingTask,
      'system-architect': this.formatArchitectureTask,
      'performance-optimizer': this.formatOptimizationTask
    };

    const formatter = agentTasks[agent.name];
    if (!formatter) {
      throw new Error(`No task formatter for agent ${agent.name}`);
    }

    return formatter.call(this, taskData, agent);
  }

  // Task formatters for different agent types
  formatResearchTask(taskData, agent) {
    return `
Research Task: ${taskData.type}

Analyze the template structure at ${taskData.data?.templatePath} and provide:

1. Template complexity analysis
2. Variable dependencies mapping
3. Output file structure recommendations
4. Best practices recommendations
5. Potential optimization opportunities

Use your ${agent.capabilities.join(', ')} capabilities to provide comprehensive analysis.

Store findings in memory under key: swarm/${agent.name}/${taskData.taskId}
    `.trim();
  }

  formatCodeGenerationTask(taskData, agent) {
    return `
Code Generation Task: ${taskData.type}

Generate code using:
- Template Path: ${taskData.data?.templatePath}
- Variables: ${JSON.stringify(taskData.data?.variables, null, 2)}
- Architecture Guidelines: Retrieved from memory key: swarm/system-architect/${taskData.dependencies?.[1]}

Requirements:
1. Generate clean, maintainable code
2. Follow TypeScript best practices
3. Include proper error handling
4. Add comprehensive JSDoc comments
5. Ensure type safety

Capabilities available: ${agent.capabilities.join(', ')}

Store generated files in memory under key: swarm/${agent.name}/${taskData.taskId}
    `.trim();
  }

  formatReviewTask(taskData, agent) {
    return `
Code Review Task: ${taskData.type}

Review generated code from memory key: swarm/code-generator/${taskData.dependencies?.[0]}

Review Criteria:
${taskData.data?.reviewCriteria?.map(c => `- ${c}`).join('\n') || '- Security\n- Performance\n- Maintainability'}

Provide:
1. Security vulnerability assessment
2. Performance improvement suggestions
3. Code quality metrics
4. Best practices compliance check
5. Refactoring recommendations

Use ${agent.capabilities.join(', ')} capabilities for thorough review.

Store review results in memory under key: swarm/${agent.name}/${taskData.taskId}
    `.trim();
  }

  formatTestingTask(taskData, agent) {
    return `
Test Generation Task: ${taskData.type}

Generate comprehensive tests for code from memory key: swarm/code-generator/${taskData.dependencies?.[0]}

Test Requirements:
1. Unit tests with >90% coverage
2. Integration tests for main workflows
3. BDD scenarios for business logic
4. Performance benchmarks
5. Error case testing

Testing Strategy: ${taskData.data?.testingStrategy || 'comprehensive'}

Capabilities: ${agent.capabilities.join(', ')}

Store test files in memory under key: swarm/${agent.name}/${taskData.taskId}
    `.trim();
  }

  formatArchitectureTask(taskData, agent) {
    return `
Architecture Design Task: ${taskData.type}

Design system architecture based on:
- Requirements: ${JSON.stringify(taskData.data?.requirements, null, 2)}
- Analysis from: memory key swarm/template-researcher/${taskData.dependencies?.[0]}

Provide:
1. Component architecture diagram
2. Data flow design
3. Module dependencies
4. Interface definitions
5. Scalability considerations

Patterns to consider: ${taskData.data?.patterns?.join(', ') || 'MVC, Repository, Factory'}

Use ${agent.capabilities.join(', ')} for architectural analysis.

Store architecture in memory under key: swarm/${agent.name}/${taskData.taskId}
    `.trim();
  }

  formatOptimizationTask(taskData, agent) {
    return `
Performance Optimization Task: ${taskData.type}

Optimize code from memory key: swarm/code-generator/${taskData.dependencies?.[0]}
Consider review feedback from: swarm/code-reviewer/${taskData.dependencies?.[1]}

Optimization Areas:
${taskData.data?.optimizations?.map(o => `- ${o}`).join('\n') || '- Bundle size\n- Runtime performance'}

Provide:
1. Code splitting recommendations
2. Bundle optimization strategies  
3. Runtime performance improvements
4. Memory usage optimizations
5. Loading performance enhancements

Capabilities: ${agent.capabilities.join(', ')}

Store optimized code in memory under key: swarm/${agent.name}/${taskData.taskId}
    `.trim();
  }

  /**
   * =============================================================================
   * COORDINATION UTILITIES
   * =============================================================================
   */

  // Store task context for agent coordination
  async storeTaskContext(taskId, taskData) {
    try {
      await this.executeClaudeFlow('memory_usage', {
        action: 'store',
        key: `swarm/context/${taskId}`,
        value: JSON.stringify(taskData),
        namespace: this.options.memoryNamespace,
        ttl: 3600 // 1 hour
      });
    } catch (error) {
      console.warn(`Failed to store task context for ${taskId}:`, error.message);
    }
  }

  // Share knowledge between agents
  async shareKnowledge(task, result) {
    try {
      await this.executeClaudeFlow('daa_knowledge_share', {
        sourceAgentId: task.agent,
        targetAgentIds: this.getRelatedAgents(task),
        knowledgeDomain: task.type,
        knowledgeContent: {
          taskId: task.id,
          result: result.data,
          insights: result.insights || [],
          recommendations: result.recommendations || []
        }
      });
    } catch (error) {
      console.warn('Knowledge sharing failed:', error.message);
    }
  }

  // Get related agents for knowledge sharing
  getRelatedAgents(task) {
    const relationships = {
      'research': ['code-generator', 'system-architect'],
      'generation': ['test-generator', 'code-reviewer'],
      'architecture': ['code-generator', 'performance-optimizer'],
      'testing': ['code-reviewer'],
      'review': ['performance-optimizer', 'code-generator'],
      'optimization': ['test-generator']
    };

    return relationships[task.type] || [];
  }

  // Prepare task data with dependency results
  async prepareTaskData(task, executionResults) {
    const taskData = { ...task.data };

    // Fill in dependency results
    if (task.dependencies) {
      for (const depId of task.dependencies) {
        const depResult = executionResults.get(depId);
        if (depResult) {
          taskData[`${depId}_result`] = depResult.data;
        }
      }
    }

    return { ...task, data: taskData };
  }

  // Topological sort for task dependencies
  topologicalSort(tasks) {
    const visited = new Set();
    const sorted = [];
    const visiting = new Set();

    const visit = (task) => {
      if (visiting.has(task.id)) {
        throw new Error(`Circular dependency detected involving task ${task.id}`);
      }
      
      if (visited.has(task.id)) {
        return;
      }

      visiting.add(task.id);

      if (task.dependencies) {
        for (const depId of task.dependencies) {
          const depTask = tasks.find(t => t.id === depId);
          if (depTask) {
            visit(depTask);
          }
        }
      }

      visiting.delete(task.id);
      visited.add(task.id);
      sorted.push(task);
    };

    for (const task of tasks) {
      visit(task);
    }

    return sorted;
  }

  // Get tasks ready for execution
  getReadyTasks(assignments, completed, inProgress) {
    const ready = [];
    
    for (const [agent, tasks] of assignments) {
      for (const task of tasks) {
        if (completed.has(task.id) || inProgress.has(task.id)) {
          continue;
        }

        const dependenciesMet = !task.dependencies || 
          task.dependencies.every(depId => completed.has(depId));

        if (dependenciesMet) {
          ready.push(task);
        }
      }
    }

    return ready;
  }

  // Get total task count
  getTotalTaskCount(assignments) {
    return Array.from(assignments.values()).reduce((total, tasks) => total + tasks.length, 0);
  }

  // Get remaining tasks
  getRemainingTasks(assignments, completed, inProgress) {
    const remaining = [];
    
    for (const tasks of assignments.values()) {
      for (const task of tasks) {
        if (!completed.has(task.id) && !inProgress.has(task.id)) {
          remaining.push(task);
        }
      }
    }

    return remaining;
  }

  // Aggregate final results
  async aggregateResults(executionResults) {
    const results = {
      generatedFiles: [],
      tests: [],
      documentation: [],
      architecture: null,
      review: null,
      optimizations: []
    };

    // Process each result type
    for (const [taskId, result] of executionResults) {
      if (!result.success) continue;

      switch (taskId) {
        case 'code-generation':
          results.generatedFiles = result.data.files || [];
          break;
        case 'test-generation':
          results.tests = result.data.tests || [];
          break;
        case 'architecture-design':
          results.architecture = result.data.architecture;
          break;
        case 'code-review':
          results.review = result.data.review;
          break;
        case 'optimization':
          results.optimizations = result.data.optimizations || [];
          break;
      }
    }

    // Apply optimizations to generated files
    if (results.optimizations.length > 0) {
      results.generatedFiles = await this.applyOptimizations(
        results.generatedFiles,
        results.optimizations
      );
    }

    return results;
  }

  // Apply optimizations to files
  async applyOptimizations(files, optimizations) {
    // This would apply the optimizations suggested by the performance agent
    return files.map(file => ({
      ...file,
      optimized: true,
      optimizations: optimizations
    }));
  }

  /**
   * =============================================================================
   * CLAUDE-FLOW INTEGRATION
   * =============================================================================
   */

  // Execute Claude-Flow MCP commands
  async executeClaudeFlow(command, params = {}) {
    // This would integrate with the actual Claude-Flow MCP server
    // For this example, we'll simulate the responses
    
    console.log(`Executing Claude-Flow: ${command}`, params);
    
    const mockResponses = {
      swarm_init: { 
        swarmId: `swarm_${this.getDeterministicTimestamp()}`,
        topology: params.topology,
        status: 'initialized'
      },
      agent_spawn: {
        agentId: `agent_${this.getDeterministicTimestamp()}`,
        type: params.type,
        status: 'spawned'
      },
      task_orchestrate: {
        taskId: `task_${this.getDeterministicTimestamp()}`,
        status: 'orchestrated'
      },
      task_results: {
        result: this.generateMockResult(params.taskId)
      },
      neural_status: {
        status: 'active',
        models: 3
      },
      neural_train: {
        status: 'training_complete',
        accuracy: 0.95
      },
      memory_usage: {
        action: params.action,
        success: true
      },
      daa_knowledge_share: {
        shared: true,
        recipients: params.targetAgentIds?.length || 0
      }
    };

    // Simulate network delay
    await this.sleep(100 + Math.random() * 200);
    
    const response = mockResponses[command];
    if (!response) {
      throw new Error(`Unknown Claude-Flow command: ${command}`);
    }

    return response;
  }

  // Generate mock results for demonstration
  generateMockResult(taskId) {
    const resultTypes = {
      'template-analysis': {
        templateStructure: {
          complexity: 'medium',
          variables: ['className', 'databaseType'],
          patterns: ['service', 'repository']
        },
        recommendedPatterns: ['dependency-injection', 'factory-pattern']
      },
      'code-generation': {
        files: [
          { path: 'service.ts', content: '// Generated service class', size: 1024 },
          { path: 'types.ts', content: '// Generated types', size: 512 }
        ]
      },
      'test-generation': {
        tests: [
          { path: 'service.test.ts', content: '// Generated tests', coverage: 95 }
        ]
      },
      'code-review': {
        review: {
          score: 85,
          issues: ['Consider extracting interface'],
          suggestions: ['Add input validation']
        }
      },
      'architecture-design': {
        architecture: {
          components: ['Service', 'Repository', 'Controller'],
          patterns: ['layered-architecture']
        }
      },
      'optimization': {
        optimizations: [
          { type: 'bundle-size', reduction: '15%' },
          { type: 'performance', improvement: '25%' }
        ]
      }
    };

    const taskType = taskId.split('-')[0] + '-' + taskId.split('-')[1];
    return resultTypes[taskType] || { message: 'Task completed successfully' };
  }

  // Get performance metrics
  getPerformanceMetrics() {
    const totalTime = this.performance.endTime - this.performance.startTime;
    
    return {
      totalExecutionTime: `${totalTime}ms`,
      tasksCompleted: this.performance.tasksCompleted,
      averageTaskTime: `${totalTime / this.performance.tasksCompleted}ms`,
      tokenUsage: this.performance.tokenUsage,
      agentUtilization: this.getAgentUtilization()
    };
  }

  // Get swarm metrics
  async getSwarmMetrics() {
    try {
      const swarmStatus = await this.executeClaudeFlow('swarm_status');
      return swarmStatus;
    } catch (error) {
      return { error: error.message };
    }
  }

  // Get agent utilization statistics
  getAgentUtilization() {
    const utilization = {};
    
    for (const [name, agent] of this.agents) {
      utilization[name] = {
        tasksCompleted: agent.tasksCompleted,
        averageExecutionTime: `${agent.performance.avgExecutionTime.toFixed(2)}ms`,
        successRate: `${(agent.performance.successRate * 100).toFixed(1)}%`,
        status: agent.status
      };
    }

    return utilization;
  }

  // Update agent performance metrics
  updateAgentPerformance(agentName, result) {
    const agent = this.agents.get(agentName);
    if (!agent) return;

    if (result.success) {
      agent.performance.successRate = 
        (agent.performance.successRate * agent.tasksCompleted + 1) / (agent.tasksCompleted + 1);
    } else {
      agent.performance.successRate = 
        (agent.performance.successRate * agent.tasksCompleted) / (agent.tasksCompleted + 1);
    }

    this.performance.tokenUsage += result.tokenUsage || 0;
  }

  // Cleanup swarm resources
  async cleanup() {
    try {
      if (this.swarmId) {
        await this.executeClaudeFlow('swarm_destroy', {
          swarmId: this.swarmId
        });
      }
      
      this.agents.clear();
      this.taskQueue = [];
      this.results.clear();
      
      console.log('Swarm cleanup completed');
    } catch (error) {
      console.error('Swarm cleanup failed:', error.message);
    }
  }

  // Utility function for delays
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * =============================================================================
 * USAGE EXAMPLES
 * =============================================================================
 */

// Example 1: Basic swarm coordination for service generation
async function generateServiceWithSwarm() {
  const swarm = new UnjucksSwarmCoordinator({
    maxAgents: 6,
    topology: 'mesh',
    strategy: 'adaptive'
  });

  try {
    // Initialize swarm
    await swarm.initializeSwarm();

    // Execute generation with swarm coordination
    const result = await swarm.orchestrateGeneration({
      templatePath: './templates/service',
      outputPath: './output/user-service',
      variables: {
        className: 'UserService',
        databaseType: 'postgresql',
        enableAuth: true,
        features: ['crud', 'validation', 'logging']
      },
      options: {
        includeTests: true,
        generateDocs: true,
        optimize: true
      }
    });

    console.log('Generation completed:', result);
    return result;

  } catch (error) {
    console.error('Swarm generation failed:', error);
  } finally {
    await swarm.cleanup();
  }
}

// Example 2: Multi-project coordination
async function generateMultipleProjectsWithSwarm() {
  const swarm = new UnjucksSwarmCoordinator({
    maxAgents: 8,
    topology: 'hierarchical',
    strategy: 'balanced'
  });

  const projects = [
    {
      name: 'user-service',
      template: './templates/service',
      variables: { className: 'UserService', databaseType: 'postgresql' }
    },
    {
      name: 'auth-service', 
      template: './templates/service',
      variables: { className: 'AuthService', databaseType: 'redis' }
    },
    {
      name: 'api-gateway',
      template: './templates/gateway',
      variables: { services: ['user-service', 'auth-service'] }
    }
  ];

  try {
    await swarm.initializeSwarm();

    const results = await Promise.all(
      projects.map(project => 
        swarm.orchestrateGeneration({
          templatePath: project.template,
          outputPath: `./output/${project.name}`,
          variables: project.variables
        })
      )
    );

    console.log('Multi-project generation completed:', results);
    return results;

  } finally {
    await swarm.cleanup();
  }
}

// Example 3: Swarm with custom agent configuration
async function generateWithCustomSwarm() {
  const swarm = new UnjucksSwarmCoordinator({
    maxAgents: 10,
    topology: 'star', // Centralized coordination
    strategy: 'specialized',
    enableNeuralPatterns: true,
    memoryNamespace: 'custom-project'
  });

  // Override agent spawning for custom agents
  swarm.spawnSpecializedAgents = async function() {
    const customAgents = [
      { type: 'researcher', name: 'requirements-analyst', capabilities: ['requirements-analysis', 'stakeholder-management'] },
      { type: 'architect', name: 'solution-architect', capabilities: ['system-design', 'technology-selection'] },
      { type: 'coder', name: 'fullstack-developer', capabilities: ['frontend', 'backend', 'database'] },
      { type: 'coder', name: 'mobile-developer', capabilities: ['react-native', 'ios', 'android'] },
      { type: 'tester', name: 'qa-engineer', capabilities: ['automated-testing', 'performance-testing'] },
      { type: 'reviewer', name: 'security-specialist', capabilities: ['security-audit', 'penetration-testing'] },
      { type: 'optimizer', name: 'devops-engineer', capabilities: ['ci-cd', 'containerization', 'monitoring'] }
    ];

    for (const agentSpec of customAgents) {
      const agent = await this.executeClaudeFlow('agent_spawn', {
        type: agentSpec.type,
        name: agentSpec.name,
        capabilities: agentSpec.capabilities
      });

      this.agents.set(agentSpec.name, {
        ...agent,
        ...agentSpec,
        status: 'idle',
        tasksCompleted: 0,
        performance: { avgExecutionTime: 0, successRate: 1.0 }
      });
    }
  };

  try {
    await swarm.initializeSwarm();

    const result = await swarm.orchestrateGeneration({
      templatePath: './templates/full-stack-app',
      outputPath: './output/enterprise-app',
      variables: {
        appName: 'EnterpriseApp',
        architecture: 'microservices',
        frontend: 'react',
        backend: 'node-express',
        database: 'postgresql',
        authentication: 'jwt',
        deployment: 'kubernetes'
      },
      options: {
        includeTests: true,
        generateDocs: true,
        optimize: true,
        securityScan: true,
        performanceTest: true
      }
    });

    return result;

  } finally {
    await swarm.cleanup();
  }
}

// Export for use in other modules
module.exports = {
  UnjucksSwarmCoordinator,
  generateServiceWithSwarm,
  generateMultipleProjectsWithSwarm,
  generateWithCustomSwarm
};

// Example usage (commented out for safety)
/*
generateServiceWithSwarm()
  .then(result => console.log('Service generation completed:', result))
  .catch(error => console.error('Generation failed:', error));
*/