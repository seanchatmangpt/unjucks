/**
 * Task Distribution Workflow - Assign tasks to AI agents
 * Intelligently distributes implementation tasks to specialized AI agents
 */

import type {
  WorkflowConfig,
  WorkflowState,
  WorkflowResult,
  TechnicalPlan,
  TaskAssignment,
  AgentType,
  TaskPriority,
  TaskStatus,
  ComponentSpec,
  AgentCapability
} from './types';

export interface TaskDistributionConfig extends WorkflowConfig {
  agentPool: AgentProfile[];
  loadBalancing: LoadBalancingStrategy;
  priorityWeights: Record<TaskPriority, number>;
  maxConcurrentTasks: number;
  skillMatching: SkillMatchingConfig;
}

export interface AgentProfile {
  id: string;
  type: AgentType;
  name: string;
  capabilities: AgentCapability[];
  currentLoad: number;
  maxCapacity: number;
  skillLevel: 'junior' | 'mid' | 'senior' | 'expert';
  specializations: string[];
  availability: AgentAvailability;
  performance: AgentPerformance;
}

export interface AgentAvailability {
  status: 'available' | 'busy' | 'offline';
  currentTasks: string[];
  estimatedFreeTime?: Date;
  workingHours: {
    start: string;
    end: string;
    timezone: string;
  };
}

export interface AgentPerformance {
  completionRate: number;
  averageQuality: number;
  averageTime: number;
  successfulTasks: number;
  failedTasks: number;
  lastUpdated: Date;
}

export interface LoadBalancingStrategy {
  type: 'round-robin' | 'weighted' | 'capability-based' | 'performance-based';
  parameters: Record<string, any>;
}

export interface SkillMatchingConfig {
  algorithm: 'exact' | 'fuzzy' | 'ml-based';
  threshold: number;
  considerPerformance: boolean;
  considerLoad: boolean;
}

export interface TaskDistributionResult {
  assignments: TaskAssignment[];
  unassignedTasks: UnassignedTask[];
  distributionMetrics: DistributionMetrics;
  recommendations: string[];
}

export interface UnassignedTask {
  componentId: string;
  reason: string;
  suggestedActions: string[];
  requiredCapabilities: string[];
}

export interface DistributionMetrics {
  totalTasks: number;
  assignedTasks: number;
  loadDistribution: Record<string, number>;
  estimatedCompletionTime: Date;
  resourceUtilization: number;
}

export class TaskDistributionWorkflow {
  private config: TaskDistributionConfig;
  private state: WorkflowState;
  private agentPool: Map<string, AgentProfile>;

  constructor(config: TaskDistributionConfig) {
    this.config = config;
    this.agentPool = new Map(config.agentPool.map(agent => [agent.id, agent]));
    this.state = {
      id: `task-dist-${Date.now()}`,
      status: 'pending',
      currentStep: 'initialization',
      progress: 0,
      startTime: new Date(),
      metadata: {}
    };
  }

  async execute(technicalPlan: TechnicalPlan): Promise<WorkflowResult<TaskDistributionResult>> {
    const startTime = Date.now();

    try {
      this.updateState('in_progress', 'task-analysis', 10);

      // Step 1: Analyze components and create tasks
      const tasks = await this.createTasksFromPlan(technicalPlan);
      this.updateState('in_progress', 'capability-matching', 30);

      // Step 2: Match tasks with agent capabilities
      const matchedTasks = await this.matchTasksWithCapabilities(tasks);
      this.updateState('in_progress', 'load-balancing', 50);

      // Step 3: Apply load balancing
      const balancedAssignments = await this.applyLoadBalancing(matchedTasks);
      this.updateState('in_progress', 'optimization', 70);

      // Step 4: Optimize assignments
      const optimizedAssignments = await this.optimizeAssignments(balancedAssignments);
      this.updateState('in_progress', 'validation', 85);

      // Step 5: Validate assignments and create result
      const result = await this.validateAndFinalize(optimizedAssignments, tasks);
      this.updateState('completed', 'finished', 100);

      return {
        success: true,
        data: result,
        metrics: {
          duration: Date.now() - startTime,
          stepsCompleted: 5,
          totalSteps: 5,
          resourcesUsed: { 
            'agents': this.agentPool.size,
            'tasks': tasks.length,
            'assignments': result.assignments.length
          },
          agentsInvolved: ['task-distributor', 'load-balancer', 'optimizer']
        }
      };

    } catch (error) {
      this.updateState('failed', 'error', this.state.progress);
      this.state.error = {
        code: 'TASK_DISTRIBUTION_FAILED',
        message: error.message,
        stack: error.stack,
        recoverable: true
      };

      return {
        success: false,
        error: this.state.error,
        metrics: {
          duration: Date.now() - startTime,
          stepsCompleted: 0,
          totalSteps: 5,
          resourcesUsed: {},
          agentsInvolved: []
        }
      };
    }
  }

  private async createTasksFromPlan(plan: TechnicalPlan): Promise<TaskCandidate[]> {
    const tasks: TaskCandidate[] = [];

    for (const component of plan.components) {
      // Break down component into specific implementation tasks
      const componentTasks = await this.decomposeComponent(component);
      tasks.push(...componentTasks);
    }

    // Add cross-cutting tasks
    const crossCuttingTasks = await this.createCrossCuttingTasks(plan);
    tasks.push(...crossCuttingTasks);

    // Sort by priority and dependencies
    return this.prioritizeTasks(tasks, plan);
  }

  private async decomposeComponent(component: ComponentSpec): Promise<TaskCandidate[]> {
    const tasks: TaskCandidate[] = [];

    // Core implementation task
    tasks.push({
      id: `task-${component.id}-impl`,
      componentId: component.id,
      title: `Implement ${component.name}`,
      description: component.description,
      type: 'implementation',
      requiredCapabilities: this.getRequiredCapabilities(component),
      preferredAgentType: this.getPreferredAgentType(component),
      priority: this.calculatePriority(component),
      estimatedEffort: component.estimatedEffort,
      complexity: component.complexity,
      dependencies: component.dependencies.map(dep => `task-${dep}-impl`),
      deliverables: ['Source code', 'Unit tests', 'Documentation']
    });

    // Interface design task (if complex interfaces)
    if (component.interfaces.length > 1 || this.hasComplexInterfaces(component)) {
      tasks.push({
        id: `task-${component.id}-interface`,
        componentId: component.id,
        title: `Design ${component.name} Interfaces`,
        description: `Design and document interfaces for ${component.name}`,
        type: 'design',
        requiredCapabilities: ['interface-design', 'api-design', 'documentation'],
        preferredAgentType: 'architect',
        priority: 'high',
        estimatedEffort: Math.round(component.estimatedEffort * 0.2),
        complexity: 'medium',
        dependencies: [],
        deliverables: ['Interface specifications', 'API documentation']
      });
    }

    // Testing task
    tasks.push({
      id: `task-${component.id}-test`,
      componentId: component.id,
      title: `Test ${component.name}`,
      description: `Create comprehensive tests for ${component.name}`,
      type: 'testing',
      requiredCapabilities: ['testing', 'test-automation', component.type],
      preferredAgentType: 'tester',
      priority: 'medium',
      estimatedEffort: Math.round(component.estimatedEffort * 0.3),
      complexity: component.complexity,
      dependencies: [`task-${component.id}-impl`],
      deliverables: ['Unit tests', 'Integration tests', 'Test documentation']
    });

    // Performance optimization (for high complexity components)
    if (component.complexity === 'high') {
      tasks.push({
        id: `task-${component.id}-perf`,
        componentId: component.id,
        title: `Optimize ${component.name} Performance`,
        description: `Performance optimization and tuning for ${component.name}`,
        type: 'optimization',
        requiredCapabilities: ['performance-optimization', 'profiling', component.type],
        preferredAgentType: 'optimizer',
        priority: 'medium',
        estimatedEffort: Math.round(component.estimatedEffort * 0.15),
        complexity: 'high',
        dependencies: [`task-${component.id}-impl`, `task-${component.id}-test`],
        deliverables: ['Performance analysis', 'Optimized code', 'Performance tests']
      });
    }

    return tasks;
  }

  private async createCrossCuttingTasks(plan: TechnicalPlan): Promise<TaskCandidate[]> {
    const tasks: TaskCandidate[] = [];

    // Documentation task
    tasks.push({
      id: 'task-documentation',
      componentId: 'cross-cutting',
      title: 'Project Documentation',
      description: 'Create comprehensive project documentation',
      type: 'documentation',
      requiredCapabilities: ['documentation', 'technical-writing'],
      preferredAgentType: 'documenter',
      priority: 'low',
      estimatedEffort: 16,
      complexity: 'low',
      dependencies: [], // Can be done in parallel
      deliverables: ['README', 'API docs', 'Deployment guide']
    });

    // Integration testing task
    tasks.push({
      id: 'task-integration-test',
      componentId: 'cross-cutting',
      title: 'System Integration Testing',
      description: 'End-to-end integration testing of all components',
      type: 'integration-testing',
      requiredCapabilities: ['integration-testing', 'test-automation', 'system-testing'],
      preferredAgentType: 'tester',
      priority: 'high',
      estimatedEffort: 24,
      complexity: 'high',
      dependencies: plan.components.map(c => `task-${c.id}-impl`),
      deliverables: ['Integration test suite', 'Test results', 'Bug reports']
    });

    // Security review task
    const hasSecurityComponents = plan.components.some(c => c.name.includes('Security'));
    if (hasSecurityComponents) {
      tasks.push({
        id: 'task-security-review',
        componentId: 'cross-cutting',
        title: 'Security Review',
        description: 'Comprehensive security review and penetration testing',
        type: 'security-review',
        requiredCapabilities: ['security-testing', 'penetration-testing', 'code-review'],
        preferredAgentType: 'reviewer',
        priority: 'high',
        estimatedEffort: 20,
        complexity: 'high',
        dependencies: plan.components.filter(c => c.name.includes('Security')).map(c => `task-${c.id}-impl`),
        deliverables: ['Security assessment', 'Vulnerability report', 'Remediation plan']
      });
    }

    return tasks;
  }

  private async matchTasksWithCapabilities(tasks: TaskCandidate[]): Promise<TaskMatch[]> {
    const matches: TaskMatch[] = [];

    for (const task of tasks) {
      const candidateAgents = await this.findCandidateAgents(task);
      const scoredCandidates = await this.scoreAgentCandidates(task, candidateAgents);
      
      matches.push({
        task,
        candidates: scoredCandidates,
        bestMatch: scoredCandidates[0] || null
      });
    }

    return matches;
  }

  private async findCandidateAgents(task: TaskCandidate): Promise<AgentProfile[]> {
    const candidates: AgentProfile[] = [];

    for (const [agentId, agent] of this.agentPool) {
      if (agent.availability.status === 'offline') continue;
      
      // Check if agent has required capabilities
      const hasRequiredCapabilities = task.requiredCapabilities.every(reqCap =>
        agent.capabilities.some(agentCap => 
          agentCap.name === reqCap || 
          this.isCapabilityCompatible(agentCap.name, reqCap)
        )
      );

      if (!hasRequiredCapabilities) continue;

      // Check agent type preference
      if (task.preferredAgentType && agent.type !== task.preferredAgentType) {
        // Only include if agent has cross-functional capabilities
        if (!this.hasCrossFunctionalCapabilities(agent, task.preferredAgentType)) {
          continue;
        }
      }

      // Check capacity
      if (agent.currentLoad >= agent.maxCapacity) continue;

      candidates.push(agent);
    }

    return candidates;
  }

  private async scoreAgentCandidates(task: TaskCandidate, candidates: AgentProfile[]): Promise<ScoredAgent[]> {
    return candidates.map(agent => {
      let score = 0;

      // Capability match score (40%)
      const capabilityScore = this.calculateCapabilityScore(task, agent);
      score += capabilityScore * 0.4;

      // Performance score (30%)
      const performanceScore = this.calculatePerformanceScore(agent);
      score += performanceScore * 0.3;

      // Load balance score (20%)
      const loadScore = this.calculateLoadScore(agent);
      score += loadScore * 0.2;

      // Priority and urgency (10%)
      const priorityScore = this.calculatePriorityScore(task, agent);
      score += priorityScore * 0.1;

      return {
        agent,
        score,
        reasons: this.generateScoreReasons(task, agent, {
          capability: capabilityScore,
          performance: performanceScore,
          load: loadScore,
          priority: priorityScore
        })
      };
    }).sort((a, b) => b.score - a.score);
  }

  private async applyLoadBalancing(matches: TaskMatch[]): Promise<PreliminaryAssignment[]> {
    const assignments: PreliminaryAssignment[] = [];
    const agentLoads = new Map<string, number>();

    // Initialize agent loads
    for (const [agentId, agent] of this.agentPool) {
      agentLoads.set(agentId, agent.currentLoad);
    }

    // Sort tasks by priority
    const sortedMatches = matches.sort((a, b) => 
      this.config.priorityWeights[b.task.priority] - this.config.priorityWeights[a.task.priority]
    );

    for (const match of sortedMatches) {
      if (!match.bestMatch) {
        continue; // Will be handled as unassigned
      }

      let selectedAgent = match.bestMatch.agent;

      // Apply load balancing strategy
      switch (this.config.loadBalancing.type) {
        case 'weighted':
          selectedAgent = this.selectAgentWithWeighting(match, agentLoads);
          break;
        case 'capability-based':
          selectedAgent = this.selectAgentByCapability(match, agentLoads);
          break;
        case 'performance-based':
          selectedAgent = this.selectAgentByPerformance(match, agentLoads);
          break;
        default:
          // Use best match from scoring
          break;
      }

      // Check if agent can handle the additional load
      const currentLoad = agentLoads.get(selectedAgent.id) || 0;
      if (currentLoad + match.task.estimatedEffort <= selectedAgent.maxCapacity) {
        assignments.push({
          taskId: match.task.id,
          agentId: selectedAgent.id,
          confidence: match.bestMatch.score,
          estimatedStartTime: this.calculateStartTime(selectedAgent, currentLoad),
          estimatedDuration: match.task.estimatedEffort
        });

        // Update agent load
        agentLoads.set(selectedAgent.id, currentLoad + match.task.estimatedEffort);
      }
    }

    return assignments;
  }

  private async optimizeAssignments(assignments: PreliminaryAssignment[]): Promise<TaskAssignment[]> {
    // Convert preliminary assignments to full task assignments
    const taskAssignments: TaskAssignment[] = [];

    for (const assignment of assignments) {
      const task = await this.getTaskById(assignment.taskId);
      if (!task) continue;

      const taskAssignment: TaskAssignment = {
        id: `assignment-${assignment.taskId}-${assignment.agentId}`,
        planId: this.state.metadata.planId || 'unknown',
        componentId: task.componentId,
        agentType: this.agentPool.get(assignment.agentId)?.type || 'coder',
        agentId: assignment.agentId,
        priority: task.priority,
        estimatedEffort: task.estimatedEffort,
        dependencies: task.dependencies,
        requirements: task.requiredCapabilities,
        constraints: this.getTaskConstraints(task),
        status: 'pending',
        assignedAt: new Date()
      };

      taskAssignments.push(taskAssignment);
    }

    // Optimize for dependency resolution
    return this.optimizeDependencyOrder(taskAssignments);
  }

  private async validateAndFinalize(
    assignments: TaskAssignment[], 
    allTasks: TaskCandidate[]
  ): Promise<TaskDistributionResult> {
    const assignedTaskIds = new Set(assignments.map(a => a.componentId));
    const unassignedTasks: UnassignedTask[] = [];
    
    // Find unassigned tasks
    for (const task of allTasks) {
      if (!assignedTaskIds.has(task.id)) {
        unassignedTasks.push({
          componentId: task.id,
          reason: this.determineUnassignmentReason(task),
          suggestedActions: this.suggestActionsForUnassigned(task),
          requiredCapabilities: task.requiredCapabilities
        });
      }
    }

    // Calculate metrics
    const metrics = this.calculateDistributionMetrics(assignments, allTasks);
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(assignments, unassignedTasks, metrics);

    return {
      assignments,
      unassignedTasks,
      distributionMetrics: metrics,
      recommendations
    };
  }

  // Helper methods and scoring functions
  private getRequiredCapabilities(component: ComponentSpec): string[] {
    const capabilities = [component.type];
    
    // Add specific capabilities based on component type
    switch (component.type) {
      case 'service':
        capabilities.push('backend-development', 'api-development');
        break;
      case 'ui':
        capabilities.push('frontend-development', 'ui-design');
        break;
      case 'database':
        capabilities.push('database-design', 'sql');
        break;
      case 'integration':
        capabilities.push('integration', 'api-integration');
        break;
    }

    // Add complexity-based capabilities
    if (component.complexity === 'high') {
      capabilities.push('complex-systems', 'architecture');
    }

    // Add interface-specific capabilities
    component.interfaces.forEach(iface => {
      if (iface.type === 'rest') capabilities.push('rest-api');
      if (iface.type === 'graphql') capabilities.push('graphql');
      if (iface.type === 'grpc') capabilities.push('grpc');
    });

    return capabilities;
  }

  private getPreferredAgentType(component: ComponentSpec): AgentType {
    switch (component.type) {
      case 'service': return 'coder';
      case 'ui': return 'coder';
      case 'database': return 'coder';
      case 'integration': return 'specialist';
      case 'library': return 'coder';
      default: return 'coder';
    }
  }

  private calculatePriority(component: ComponentSpec): TaskPriority {
    if (component.complexity === 'high') return 'high';
    if (component.dependencies.length > 3) return 'high';
    if (component.estimatedEffort > 40) return 'high';
    if (component.name.toLowerCase().includes('security')) return 'critical';
    return 'medium';
  }

  private hasComplexInterfaces(component: ComponentSpec): boolean {
    return component.interfaces.some(iface => 
      iface.type === 'graphql' || iface.type === 'grpc' || 
      (typeof iface.schema === 'object' && Object.keys(iface.schema).length > 5)
    );
  }

  private prioritizeTasks(tasks: TaskCandidate[], plan: TechnicalPlan): TaskCandidate[] {
    return tasks.sort((a, b) => {
      // Priority weight
      const priorityDiff = this.config.priorityWeights[b.priority] - this.config.priorityWeights[a.priority];
      if (priorityDiff !== 0) return priorityDiff;

      // Dependencies (fewer dependencies = higher priority)
      const depDiff = a.dependencies.length - b.dependencies.length;
      if (depDiff !== 0) return depDiff;

      // Effort (smaller tasks first)
      return a.estimatedEffort - b.estimatedEffort;
    });
  }

  private calculateCapabilityScore(task: TaskCandidate, agent: AgentProfile): number {
    let score = 0;
    const totalRequired = task.requiredCapabilities.length;

    for (const reqCap of task.requiredCapabilities) {
      const agentCap = agent.capabilities.find(ac => 
        ac.name === reqCap || this.isCapabilityCompatible(ac.name, reqCap)
      );
      
      if (agentCap) {
        score += 1;
        // Bonus for specializations
        if (agent.specializations.includes(reqCap)) {
          score += 0.5;
        }
      }
    }

    return totalRequired > 0 ? (score / totalRequired) * 100 : 0;
  }

  private calculatePerformanceScore(agent: AgentProfile): number {
    const perf = agent.performance;
    return (perf.completionRate * 0.4 + perf.averageQuality * 0.6);
  }

  private calculateLoadScore(agent: AgentProfile): number {
    const utilizationRatio = agent.currentLoad / agent.maxCapacity;
    return Math.max(0, 100 - (utilizationRatio * 100));
  }

  private calculatePriorityScore(task: TaskCandidate, agent: AgentProfile): number {
    // Higher skill agents get higher priority tasks
    const skillLevels = { junior: 1, mid: 2, senior: 3, expert: 4 };
    const agentLevel = skillLevels[agent.skillLevel];
    const taskPriorityLevel = this.config.priorityWeights[task.priority] / 10;
    
    return Math.min(100, (agentLevel * taskPriorityLevel) * 25);
  }

  private isCapabilityCompatible(agentCap: string, requiredCap: string): boolean {
    const compatibility: Record<string, string[]> = {
      'backend-development': ['service', 'api-development'],
      'frontend-development': ['ui', 'ui-design'],
      'full-stack': ['backend-development', 'frontend-development', 'service', 'ui'],
      'testing': ['unit-testing', 'integration-testing', 'test-automation'],
      'database-design': ['database', 'sql', 'data-modeling']
    };

    return compatibility[agentCap]?.includes(requiredCap) || false;
  }

  private updateState(status: WorkflowState['status'], step: string, progress: number): void {
    this.state.status = status;
    this.state.currentStep = step;
    this.state.progress = progress;
    
    if (status === 'completed' || status === 'failed') {
      this.state.endTime = new Date();
    }
  }

  getState(): WorkflowState {
    return { ...this.state };
  }

  // Additional helper interfaces
  interface TaskCandidate {
    id: string;
    componentId: string;
    title: string;
    description: string;
    type: string;
    requiredCapabilities: string[];
    preferredAgentType: AgentType;
    priority: TaskPriority;
    estimatedEffort: number;
    complexity: 'low' | 'medium' | 'high';
    dependencies: string[];
    deliverables: string[];
  }

  interface TaskMatch {
    task: TaskCandidate;
    candidates: ScoredAgent[];
    bestMatch: ScoredAgent | null;
  }

  interface ScoredAgent {
    agent: AgentProfile;
    score: number;
    reasons: string[];
  }

  interface PreliminaryAssignment {
    taskId: string;
    agentId: string;
    confidence: number;
    estimatedStartTime: Date;
    estimatedDuration: number;
  }
}