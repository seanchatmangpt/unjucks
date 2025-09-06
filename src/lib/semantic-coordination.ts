import type { 
  TurtleData, 
  RDFTemplateContext, 
  RDFDataSource 
} from './types/turtle-types.js';
import { SemanticEngine, type SemanticEngineOptions } from './semantic-engine.js';

/**
 * Semantic Coordination Engine for MCP Swarm Integration
 * Manages semantic task orchestration and agent assignment based on ontology expertise
 */
export class SemanticCoordination {
  private semanticEngine: SemanticEngine;
  private agentRegistry = new Map<string, SemanticAgent>();
  private taskQueue: SemanticTask[] = [];
  private executionHistory: ExecutionRecord[] = [];

  constructor(options: SemanticCoordinationOptions = {}) {
    this.semanticEngine = new SemanticEngine(options.semanticEngine);
    this.initializeDefaultAgents();
  }

  /**
   * Register semantic agent with ontology expertise
   */
  registerAgent(agent: SemanticAgent): void {
    this.agentRegistry.set(agent.id, agent);
  }

  /**
   * Assign agents to semantic tasks based on ontology expertise
   */
  assignAgentToTask(task: SemanticTask): SemanticAgent[] {
    const candidateAgents: Array<{ agent: SemanticAgent; score: number }> = [];

    for (const agent of this.agentRegistry.values()) {
      const score = this.calculateSemanticFitScore(agent, task);
      if (score > 0.3) { // Minimum threshold for assignment
        candidateAgents.push({ agent, score });
      }
    }

    // Sort by score and return top candidates
    candidateAgents.sort((a, b) => b.score - a.score);
    const selectedCount = Math.min(task.maxAgents || 3, candidateAgents.length);
    
    return candidateAgents.slice(0, selectedCount).map(c => c.agent);
  }

  /**
   * Orchestrate semantic task across swarm with cross-template consistency
   */
  async orchestrateSemanticTask(task: SemanticTask): Promise<SemanticTaskResult> {
    const startTime = Date.now();
    
    try {
      // Validate task requirements
      const validation = await this.validateSemanticTask(task);
      if (!validation.valid) {
        return {
          success: false,
          errors: validation.errors,
          executionTime: Date.now() - startTime,
          agentsUsed: []
        };
      }

      // Select and assign agents
      const assignedAgents = this.assignAgentToTask(task);
      if (assignedAgents.length === 0) {
        return {
          success: false,
          errors: ['No suitable agents found for this semantic task'],
          executionTime: Date.now() - startTime,
          agentsUsed: []
        };
      }

      // Prepare semantic context for agents
      const semanticContext = await this.prepareSemanticContext(task);

      // Execute task with assigned agents
      const results = await this.executeTaskWithAgents(
        task,
        assignedAgents,
        semanticContext
      );

      // Validate cross-template consistency
      const consistencyCheck = await this.validateConsistency(results, task);

      const executionRecord: ExecutionRecord = {
        taskId: task.id,
        agentIds: assignedAgents.map(a => a.id),
        startTime: new Date(startTime),
        endTime: new Date(),
        success: results.every(r => r.success),
        semanticScore: this.calculateSemanticScore(results),
        consistencyScore: consistencyCheck.score
      };

      this.executionHistory.push(executionRecord);

      return {
        success: results.every(r => r.success),
        results: results.map(r => r.data).filter(Boolean),
        errors: results.flatMap(r => r.errors || []),
        warnings: consistencyCheck.warnings,
        executionTime: Date.now() - startTime,
        agentsUsed: assignedAgents.map(a => ({
          id: a.id,
          type: a.type,
          ontologyExpertise: a.ontologyExpertise,
          performance: a.performanceMetrics
        })),
        semanticMetadata: {
          ontologiesUsed: task.ontologies,
          consistencyScore: consistencyCheck.score,
          semanticComplexity: this.assessSemanticComplexity(task)
        }
      };

    } catch (error) {
      return {
        success: false,
        errors: [error instanceof Error ? error.message : String(error)],
        executionTime: Date.now() - startTime,
        agentsUsed: []
      };
    }
  }

  /**
   * Validate semantic consistency across multiple templates
   */
  async validateSemanticConsistency(
    templates: TemplateValidationRequest[]
  ): Promise<ConsistencyValidationResult> {
    const results: ConsistencyValidationResult = {
      consistent: true,
      issues: [],
      recommendations: [],
      ontologyAlignment: new Map()
    };

    // Load and analyze all templates
    const templateContexts = await Promise.all(
      templates.map(async t => ({
        template: t,
        context: await this.semanticEngine.createSemanticTemplateContext(
          t.dataSources,
          t.variables
        )
      }))
    );

    // Check ontology alignment
    for (let i = 0; i < templateContexts.length; i++) {
      for (let j = i + 1; j < templateContexts.length; j++) {
        const alignment = this.checkOntologyAlignment(
          templateContexts[i].context,
          templateContexts[j].context
        );
        
        if (alignment.score < 0.8) {
          results.consistent = false;
          results.issues.push({
            type: 'ontology_mismatch',
            severity: 'warning',
            message: `Ontology alignment between templates ${i} and ${j} is low (${alignment.score})`,
            templates: [templates[i].name, templates[j].name],
            suggestions: alignment.suggestions
          });
        }

        results.ontologyAlignment.set(
          `${templates[i].name}-${templates[j].name}`,
          alignment.score
        );
      }
    }

    // Check semantic variable consistency
    const variableConsistency = this.checkVariableConsistency(templateContexts);
    if (!variableConsistency.consistent) {
      results.consistent = false;
      results.issues.push(...variableConsistency.issues);
    }

    // Generate recommendations for improvement
    results.recommendations = this.generateConsistencyRecommendations(results.issues);

    return results;
  }

  /**
   * Monitor swarm performance for semantic tasks
   */
  getSemanticPerformanceMetrics(): SemanticPerformanceMetrics {
    const recentExecutions = this.executionHistory.slice(-100); // Last 100 executions
    
    const avgExecutionTime = recentExecutions.reduce((sum, r) => 
      sum + (r.endTime.getTime() - r.startTime.getTime()), 0
    ) / Math.max(recentExecutions.length, 1);

    const successRate = recentExecutions.filter(r => r.success).length / 
                       Math.max(recentExecutions.length, 1);

    const avgSemanticScore = recentExecutions.reduce((sum, r) => 
      sum + (r.semanticScore || 0), 0
    ) / Math.max(recentExecutions.length, 1);

    const avgConsistencyScore = recentExecutions.reduce((sum, r) => 
      sum + (r.consistencyScore || 0), 0
    ) / Math.max(recentExecutions.length, 1);

    // Analyze agent performance
    const agentPerformance = this.analyzeAgentPerformance(recentExecutions);

    return {
      totalTasks: recentExecutions.length,
      avgExecutionTime,
      successRate,
      avgSemanticScore,
      avgConsistencyScore,
      agentPerformance,
      ontologyUsage: this.analyzeOntologyUsage(recentExecutions),
      bottlenecks: this.identifyPerformanceBottlenecks(recentExecutions)
    };
  }

  /**
   * Optimize agent assignment based on historical performance
   */
  optimizeAgentAssignment(task: SemanticTask): void {
    const historicalData = this.executionHistory.filter(r => 
      this.isSimilarTask(task, r)
    );

    if (historicalData.length < 5) return; // Need minimum data for optimization

    // Update agent performance metrics based on history
    const agentScores = new Map<string, number>();
    
    for (const record of historicalData) {
      const taskComplexity = this.assessSemanticComplexity({ 
        id: record.taskId, 
        ontologies: [], 
        requirements: [] 
      } as SemanticTask);
      
      for (const agentId of record.agentIds) {
        const agent = this.agentRegistry.get(agentId);
        if (agent) {
          const currentScore = agentScores.get(agentId) || 0;
          const performanceWeight = record.success ? 1.0 : 0.3;
          const complexityBonus = taskComplexity > 0.7 ? 0.2 : 0.0;
          
          agentScores.set(agentId, currentScore + performanceWeight + complexityBonus);
          
          // Update agent metrics
          agent.performanceMetrics.tasksCompleted++;
          if (record.success) {
            agent.performanceMetrics.successRate = 
              (agent.performanceMetrics.successRate * (agent.performanceMetrics.tasksCompleted - 1) + 1) /
              agent.performanceMetrics.tasksCompleted;
          }
        }
      }
    }

    // Boost performance for high-performing agents
    for (const [agentId, score] of agentScores.entries()) {
      const agent = this.agentRegistry.get(agentId);
      if (agent && score > 5.0) {
        agent.performanceMetrics.specialization += 0.1;
      }
    }
  }

  // Private helper methods

  private initializeDefaultAgents(): void {
    const defaultAgents: SemanticAgent[] = [
      {
        id: 'semantic-researcher',
        type: 'researcher',
        ontologyExpertise: ['schema.org', 'dublin-core', 'foaf'],
        capabilities: ['ontology-analysis', 'semantic-mapping', 'data-discovery'],
        performanceMetrics: {
          tasksCompleted: 0,
          successRate: 1.0,
          avgExecutionTime: 0,
          specialization: 0.8
        }
      },
      {
        id: 'fhir-specialist',
        type: 'coder',
        ontologyExpertise: ['fhir', 'snomed-ct', 'loinc'],
        capabilities: ['healthcare-modeling', 'clinical-data', 'fhir-profiles'],
        performanceMetrics: {
          tasksCompleted: 0,
          successRate: 1.0,
          avgExecutionTime: 0,
          specialization: 0.9
        }
      },
      {
        id: 'financial-ontologist',
        type: 'backend-dev',
        ontologyExpertise: ['fibo', 'xbrl', 'iso20022'],
        capabilities: ['financial-modeling', 'regulatory-compliance', 'risk-assessment'],
        performanceMetrics: {
          tasksCompleted: 0,
          successRate: 1.0,
          avgExecutionTime: 0,
          specialization: 0.85
        }
      },
      {
        id: 'supply-chain-expert',
        type: 'system-architect',
        ontologyExpertise: ['gs1', 'epcis', 'cbv'],
        capabilities: ['supply-chain-modeling', 'traceability', 'product-data'],
        performanceMetrics: {
          tasksCompleted: 0,
          successRate: 1.0,
          avgExecutionTime: 0,
          specialization: 0.8
        }
      },
      {
        id: 'consistency-validator',
        type: 'reviewer',
        ontologyExpertise: ['owl', 'shacl', 'rdfs'],
        capabilities: ['consistency-checking', 'validation', 'quality-assurance'],
        performanceMetrics: {
          tasksCompleted: 0,
          successRate: 1.0,
          avgExecutionTime: 0,
          specialization: 0.9
        }
      }
    ];

    defaultAgents.forEach(agent => this.registerAgent(agent));
  }

  private calculateSemanticFitScore(agent: SemanticAgent, task: SemanticTask): number {
    let score = 0.0;

    // Ontology expertise match
    const ontologyOverlap = task.ontologies.filter(ont => 
      agent.ontologyExpertise.includes(ont)
    ).length;
    const ontologyScore = ontologyOverlap / Math.max(task.ontologies.length, 1);
    score += ontologyScore * 0.4;

    // Capability match
    const capabilityOverlap = task.requirements.filter(req => 
      agent.capabilities.includes(req)
    ).length;
    const capabilityScore = capabilityOverlap / Math.max(task.requirements.length, 1);
    score += capabilityScore * 0.3;

    // Performance history
    score += agent.performanceMetrics.successRate * 0.2;
    score += agent.performanceMetrics.specialization * 0.1;

    return Math.min(score, 1.0);
  }

  private async validateSemanticTask(task: SemanticTask): Promise<TaskValidationResult> {
    const errors: string[] = [];

    if (!task.id || !task.ontologies || !task.requirements) {
      errors.push('Task must have id, ontologies, and requirements');
    }

    if (task.ontologies.length === 0) {
      errors.push('Task must specify at least one ontology');
    }

    if (task.requirements.length === 0) {
      errors.push('Task must specify at least one requirement');
    }

    // Validate ontology availability
    for (const ontology of task.ontologies) {
      if (!this.isOntologySupported(ontology)) {
        errors.push(`Unsupported ontology: ${ontology}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  private isOntologySupported(ontology: string): boolean {
    const supportedOntologies = [
      'schema.org', 'dublin-core', 'foaf', 'fhir', 'fibo', 'gs1',
      'owl', 'rdfs', 'skos', 'snomed-ct', 'loinc', 'xbrl'
    ];
    return supportedOntologies.includes(ontology.toLowerCase());
  }

  private async prepareSemanticContext(task: SemanticTask): Promise<RDFTemplateContext> {
    // Create context with task-specific data sources
    const dataSources = task.dataSources || [];
    return await this.semanticEngine.createSemanticTemplateContext(dataSources);
  }

  private async executeTaskWithAgents(
    task: SemanticTask,
    agents: SemanticAgent[],
    context: RDFTemplateContext
  ): Promise<AgentExecutionResult[]> {
    const results: AgentExecutionResult[] = [];

    // Execute agents in parallel for efficiency
    const executionPromises = agents.map(async agent => {
      const startTime = Date.now();
      
      try {
        // Simulate agent execution with semantic context
        const agentResult = await this.executeAgentTask(agent, task, context);
        
        return {
          agentId: agent.id,
          success: true,
          data: agentResult,
          executionTime: Date.now() - startTime,
          errors: []
        };
      } catch (error) {
        return {
          agentId: agent.id,
          success: false,
          data: null,
          executionTime: Date.now() - startTime,
          errors: [error instanceof Error ? error.message : String(error)]
        };
      }
    });

    const executionResults = await Promise.all(executionPromises);
    results.push(...executionResults);

    return results;
  }

  private async executeAgentTask(
    agent: SemanticAgent,
    task: SemanticTask,
    context: RDFTemplateContext
  ): Promise<any> {
    // Simulate semantic task execution
    // In a real implementation, this would interface with MCP tools
    return {
      agentType: agent.type,
      ontologyExpertise: agent.ontologyExpertise,
      taskCompleted: true,
      semanticAnalysis: {
        ontologiesAnalyzed: task.ontologies,
        consistencyChecks: agent.capabilities.includes('consistency-checking'),
        dataQuality: Math.random() * 0.3 + 0.7 // Simulate quality score
      }
    };
  }

  private async validateConsistency(
    results: AgentExecutionResult[],
    task: SemanticTask
  ): Promise<ConsistencyCheck> {
    // Analyze results for semantic consistency
    const warnings: string[] = [];
    let score = 1.0;

    const successfulResults = results.filter(r => r.success);
    
    if (successfulResults.length < results.length * 0.8) {
      warnings.push('Less than 80% of agents completed successfully');
      score -= 0.2;
    }

    // Check for ontology consistency across results
    const ontologyAnalyses = successfulResults
      .map(r => r.data?.semanticAnalysis?.ontologiesAnalyzed)
      .filter(Boolean);

    if (ontologyAnalyses.length > 1) {
      const ontologyOverlap = this.calculateOntologyOverlap(ontologyAnalyses);
      if (ontologyOverlap < 0.7) {
        warnings.push('Low ontology overlap between agent results');
        score -= 0.1;
      }
    }

    return { score, warnings };
  }

  private calculateOntologyOverlap(analyses: string[][]): number {
    if (analyses.length < 2) return 1.0;

    const allOntologies = new Set(analyses.flat());
    const commonOntologies = new Set();

    for (const ontology of allOntologies) {
      if (analyses.every(analysis => analysis.includes(ontology))) {
        commonOntologies.add(ontology);
      }
    }

    return commonOntologies.size / allOntologies.size;
  }

  private calculateSemanticScore(results: AgentExecutionResult[]): number {
    const scores = results
      .filter(r => r.success && r.data?.semanticAnalysis?.dataQuality)
      .map(r => r.data.semanticAnalysis.dataQuality);

    if (scores.length === 0) return 0;
    return scores.reduce((sum, score) => sum + score, 0) / scores.length;
  }

  private assessSemanticComplexity(task: SemanticTask): number {
    let complexity = 0.0;

    // Ontology complexity
    complexity += task.ontologies.length * 0.1;

    // Requirements complexity  
    complexity += task.requirements.length * 0.05;

    // Data source complexity
    if (task.dataSources) {
      complexity += task.dataSources.length * 0.1;
    }

    return Math.min(complexity, 1.0);
  }

  private checkOntologyAlignment(
    context1: RDFTemplateContext,
    context2: RDFTemplateContext
  ): OntologyAlignment {
    const prefixes1 = new Set(Object.keys(context1.$rdf.prefixes));
    const prefixes2 = new Set(Object.keys(context2.$rdf.prefixes));
    
    const commonPrefixes = new Set([...prefixes1].filter(p => prefixes2.has(p)));
    const allPrefixes = new Set([...prefixes1, ...prefixes2]);
    
    const score = commonPrefixes.size / allPrefixes.size;
    
    const suggestions: string[] = [];
    if (score < 0.5) {
      suggestions.push('Consider standardizing ontology prefixes');
      suggestions.push('Add common vocabulary mappings');
    }

    return { score, suggestions };
  }

  private checkVariableConsistency(
    contexts: Array<{ template: TemplateValidationRequest; context: RDFTemplateContext }>
  ): VariableConsistencyResult {
    const issues: ConsistencyIssue[] = [];
    let consistent = true;

    // Group variables by name across templates
    const variableGroups = new Map<string, Array<{ template: string; type: any; uri?: string }>>();

    for (const { template, context } of contexts) {
      for (const [varName, value] of Object.entries(context)) {
        if (varName.startsWith('$')) continue; // Skip special variables

        if (!variableGroups.has(varName)) {
          variableGroups.set(varName, []);
        }

        variableGroups.get(varName)!.push({
          template: template.name,
          type: typeof value,
          uri: typeof value === 'object' && value?.uri ? value.uri : undefined
        });
      }
    }

    // Check consistency within each group
    for (const [varName, instances] of variableGroups.entries()) {
      if (instances.length > 1) {
        const types = new Set(instances.map(i => i.type));
        const uris = new Set(instances.map(i => i.uri).filter(Boolean));

        if (types.size > 1) {
          consistent = false;
          issues.push({
            type: 'type_mismatch',
            severity: 'error',
            message: `Variable '${varName}' has inconsistent types across templates`,
            templates: instances.map(i => i.template),
            suggestions: [`Standardize type for variable '${varName}'`]
          });
        }

        if (uris.size > 1) {
          consistent = false;
          issues.push({
            type: 'semantic_mismatch',
            severity: 'warning',
            message: `Variable '${varName}' maps to different URIs across templates`,
            templates: instances.map(i => i.template),
            suggestions: [`Align semantic meaning for variable '${varName}'`]
          });
        }
      }
    }

    return { consistent, issues };
  }

  private generateConsistencyRecommendations(issues: ConsistencyIssue[]): string[] {
    const recommendations = new Set<string>();

    for (const issue of issues) {
      recommendations.add(...issue.suggestions);
    }

    // Add general recommendations
    if (issues.some(i => i.type === 'ontology_mismatch')) {
      recommendations.add('Establish organization-wide ontology standards');
    }

    if (issues.some(i => i.type === 'type_mismatch')) {
      recommendations.add('Create shared type definitions for common variables');
    }

    return Array.from(recommendations);
  }

  private analyzeAgentPerformance(
    executions: ExecutionRecord[]
  ): Map<string, AgentPerformanceAnalysis> {
    const analysis = new Map<string, AgentPerformanceAnalysis>();

    for (const record of executions) {
      for (const agentId of record.agentIds) {
        if (!analysis.has(agentId)) {
          analysis.set(agentId, {
            agentId,
            totalTasks: 0,
            successfulTasks: 0,
            avgExecutionTime: 0,
            specializedTasks: 0,
            ontologyExpertise: []
          });
        }

        const agentAnalysis = analysis.get(agentId)!;
        agentAnalysis.totalTasks++;
        
        if (record.success) {
          agentAnalysis.successfulTasks++;
        }

        const executionTime = record.endTime.getTime() - record.startTime.getTime();
        agentAnalysis.avgExecutionTime = 
          (agentAnalysis.avgExecutionTime * (agentAnalysis.totalTasks - 1) + executionTime) /
          agentAnalysis.totalTasks;
      }
    }

    return analysis;
  }

  private analyzeOntologyUsage(executions: ExecutionRecord[]): Map<string, number> {
    const usage = new Map<string, number>();
    
    // This would analyze which ontologies are used most frequently
    // For now, return placeholder data
    usage.set('schema.org', 0.6);
    usage.set('fhir', 0.3);
    usage.set('dublin-core', 0.4);
    
    return usage;
  }

  private identifyPerformanceBottlenecks(
    executions: ExecutionRecord[]
  ): PerformanceBottleneck[] {
    const bottlenecks: PerformanceBottleneck[] = [];

    // Analyze execution times
    const avgTime = executions.reduce((sum, r) => 
      sum + (r.endTime.getTime() - r.startTime.getTime()), 0
    ) / Math.max(executions.length, 1);

    const slowExecutions = executions.filter(r => 
      (r.endTime.getTime() - r.startTime.getTime()) > avgTime * 1.5
    );

    if (slowExecutions.length > executions.length * 0.2) {
      bottlenecks.push({
        type: 'execution_time',
        severity: 'warning',
        description: 'More than 20% of executions are significantly slower than average',
        affectedTasks: slowExecutions.length,
        recommendation: 'Optimize agent assignment or increase parallelization'
      });
    }

    return bottlenecks;
  }

  private isSimilarTask(task1: SemanticTask, record: ExecutionRecord): boolean {
    // Simple similarity check based on task ID patterns
    return task1.id.split('-')[0] === record.taskId.split('-')[0];
  }
}

// Supporting interfaces and types

export interface SemanticCoordinationOptions {
  semanticEngine?: SemanticEngineOptions;
  maxConcurrentTasks?: number;
  performanceTracking?: boolean;
}

export interface SemanticAgent {
  id: string;
  type: string;
  ontologyExpertise: string[];
  capabilities: string[];
  performanceMetrics: AgentPerformanceMetrics;
}

export interface AgentPerformanceMetrics {
  tasksCompleted: number;
  successRate: number;
  avgExecutionTime: number;
  specialization: number;
}

export interface SemanticTask {
  id: string;
  ontologies: string[];
  requirements: string[];
  dataSources?: RDFDataSource[];
  maxAgents?: number;
  priority?: 'low' | 'medium' | 'high' | 'critical';
}

export interface SemanticTaskResult {
  success: boolean;
  results?: any[];
  errors: string[];
  warnings?: string[];
  executionTime: number;
  agentsUsed: Array<{
    id: string;
    type: string;
    ontologyExpertise: string[];
    performance: AgentPerformanceMetrics;
  }>;
  semanticMetadata?: {
    ontologiesUsed: string[];
    consistencyScore: number;
    semanticComplexity: number;
  };
}

export interface ExecutionRecord {
  taskId: string;
  agentIds: string[];
  startTime: Date;
  endTime: Date;
  success: boolean;
  semanticScore?: number;
  consistencyScore?: number;
}

export interface TaskValidationResult {
  valid: boolean;
  errors: string[];
}

export interface AgentExecutionResult {
  agentId: string;
  success: boolean;
  data: any;
  executionTime: number;
  errors: string[];
}

export interface ConsistencyCheck {
  score: number;
  warnings: string[];
}

export interface TemplateValidationRequest {
  name: string;
  dataSources: RDFDataSource[];
  variables?: Record<string, any>;
}

export interface ConsistencyValidationResult {
  consistent: boolean;
  issues: ConsistencyIssue[];
  recommendations: string[];
  ontologyAlignment: Map<string, number>;
}

export interface ConsistencyIssue {
  type: 'ontology_mismatch' | 'type_mismatch' | 'semantic_mismatch';
  severity: 'error' | 'warning' | 'info';
  message: string;
  templates: string[];
  suggestions: string[];
}

export interface OntologyAlignment {
  score: number;
  suggestions: string[];
}

export interface VariableConsistencyResult {
  consistent: boolean;
  issues: ConsistencyIssue[];
}

export interface SemanticPerformanceMetrics {
  totalTasks: number;
  avgExecutionTime: number;
  successRate: number;
  avgSemanticScore: number;
  avgConsistencyScore: number;
  agentPerformance: Map<string, AgentPerformanceAnalysis>;
  ontologyUsage: Map<string, number>;
  bottlenecks: PerformanceBottleneck[];
}

export interface AgentPerformanceAnalysis {
  agentId: string;
  totalTasks: number;
  successfulTasks: number;
  avgExecutionTime: number;
  specializedTasks: number;
  ontologyExpertise: string[];
}

export interface PerformanceBottleneck {
  type: string;
  severity: 'error' | 'warning' | 'info';
  description: string;
  affectedTasks: number;
  recommendation: string;
}

export default SemanticCoordination;