/**
 * Semantic Swarm Patterns - 80/20 approach for MCP semantic coordination
 * 
 * Core patterns providing 80% of semantic coordination value:
 * 1. Ontology-based agent assignment
 * 2. Semantic task decomposition 
 * 3. Cross-template consistency validation
 * 4. Semantic memory sharing between agents
 */

import { EventEmitter } from 'node:events';
import chalk from 'chalk';
import type { TurtleData, RDFDataSource } from './types/turtle-types.js';
import { RDFDataLoader } from './rdf-data-loader.js';

/**
 * Semantic task types for coordination
 */
export interface SemanticTask {
  id: string;
  type: 'healthcare' | 'financial' | 'supply_chain' | 'generic' | 'validation';
  description: string;
  parameters: Record<string, any>;
  ontologyDomain?: OntologyDomain;
  assignedAgent?: SemanticAgent;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  rdfContext?: RDFDataSource[];
}

/**
 * Ontology domains for task routing
 */
export type OntologyDomain = 'fhir' | 'fibo' | 'gs1' | 'schema_org' | 'dublin_core' | 'foaf' | 'generic';

/**
 * Ontology expertise configuration
 */
export interface OntologyExpertise {
  domain: OntologyDomain;
  vocabularies: string[];
  capabilities: string[];
  confidenceScore: number;
}

/**
 * Semantic agent with domain expertise
 */
export interface SemanticAgent {
  id: string;
  type: 'healthcare' | 'financial' | 'supply_chain' | 'validator' | 'coordinator';
  name: string;
  expertise: OntologyExpertise[];
  status: 'idle' | 'busy' | 'offline';
  currentTasks: string[];
  memory: SemanticMemory;
  performance: {
    tasksCompleted: number;
    avgProcessingTime: number;
    successRate: number;
  };
}

/**
 * Semantic memory for knowledge sharing
 */
export interface SemanticMemory {
  ontologies: Record<string, TurtleData>;
  templates: Record<string, any>;
  patterns: Record<string, any>;
  crossReferences: Record<string, string[]>;
  lastUpdated: string;
}

/**
 * Task decomposition result
 */
export interface TaskDecomposition {
  originalTaskId: string;
  subTasks: Array<{
    id: string;
    type: SemanticTask['type'];
    description: string;
    assignedAgent?: SemanticAgent;
    dependencies: string[];
    ontologyContext: OntologyDomain[];
  }>;
  executionPlan: 'parallel' | 'sequential' | 'mixed';
  estimatedDuration: number;
}

/**
 * Semantic validation result
 */
export interface SemanticValidationResult {
  valid: boolean;
  consistency: {
    crossTemplate: boolean;
    ontologyCompliance: boolean;
    vocabularyUsage: boolean;
  };
  issues: Array<{
    type: 'error' | 'warning' | 'info';
    message: string;
    location?: string;
    suggestion?: string;
  }>;
  metrics: {
    templatesValidated: number;
    ontologiesChecked: number;
    processingTime: number;
  };
}

/**
 * Configuration for semantic coordination
 */
export interface SemanticCoordinationConfig {
  enableMemorySharing?: boolean;
  ontologyValidation?: boolean;
  crossTemplateConsistency?: boolean;
  debugMode?: boolean;
  maxConcurrentTasks?: number;
  taskTimeoutMs?: number;
}

/**
 * Main Semantic Swarm Coordinator
 */
export class SemanticSwarmCoordinator extends EventEmitter {
  private agents: Map<string, SemanticAgent> = new Map();
  private tasks: Map<string, SemanticTask> = new Map();
  private rdfLoader: RDFDataLoader;
  private config: SemanticCoordinationConfig;
  private isInitialized: boolean = false;

  // Pre-defined domain agents for 80/20 approach
  private readonly DOMAIN_AGENTS: Omit<SemanticAgent, 'id' | 'memory' | 'performance'>[] = [
    {
      type: 'healthcare',
      name: 'FHIR Healthcare Agent',
      expertise: [{
        domain: 'fhir',
        vocabularies: [
          'http://hl7.org/fhir/',
          'http://snomed.info/sct',
          'http://loinc.org',
          'http://www.nlm.nih.gov/research/umls/'
        ],
        capabilities: ['patient_data', 'clinical_workflows', 'medical_terminology', 'healthcare_interop'],
        confidenceScore: 0.95
      }],
      status: 'idle',
      currentTasks: []
    },
    {
      type: 'financial',
      name: 'FIBO Financial Agent',
      expertise: [{
        domain: 'fibo',
        vocabularies: [
          'https://spec.edmcouncil.org/fibo/',
          'http://www.omg.org/spec/EDMC-FIBO/',
          'http://purl.org/goodrelations/'
        ],
        capabilities: ['financial_instruments', 'market_data', 'regulatory_compliance', 'risk_management'],
        confidenceScore: 0.92
      }],
      status: 'idle',
      currentTasks: []
    },
    {
      type: 'supply_chain',
      name: 'GS1 Supply Chain Agent',
      expertise: [{
        domain: 'gs1',
        vocabularies: [
          'http://gs1.org/voc/',
          'http://www.gs1.org/standards/',
          'http://purl.org/goodrelations/'
        ],
        capabilities: ['product_identification', 'logistics', 'traceability', 'inventory_management'],
        confidenceScore: 0.88
      }],
      status: 'idle',
      currentTasks: []
    },
    {
      type: 'validator',
      name: 'Cross-Ontology Validator',
      expertise: [
        {
          domain: 'schema_org',
          vocabularies: ['http://schema.org/'],
          capabilities: ['schema_validation', 'structured_data'],
          confidenceScore: 0.85
        },
        {
          domain: 'dublin_core',
          vocabularies: ['http://purl.org/dc/elements/1.1/', 'http://purl.org/dc/terms/'],
          capabilities: ['metadata_standards', 'resource_description'],
          confidenceScore: 0.82
        },
        {
          domain: 'foaf',
          vocabularies: ['http://xmlns.com/foaf/0.1/'],
          capabilities: ['social_networks', 'person_description'],
          confidenceScore: 0.80
        }
      ],
      status: 'idle',
      currentTasks: []
    }
  ];

  constructor(config: SemanticCoordinationConfig = {}) {
    super();
    
    this.config = {
      enableMemorySharing: true,
      ontologyValidation: true,
      crossTemplateConsistency: true,
      debugMode: false,
      maxConcurrentTasks: 10,
      taskTimeoutMs: 300000, // 5 minutes
      ...config
    };

    this.rdfLoader = new RDFDataLoader();
  }

  /**
   * Initialize semantic coordination system
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Initialize domain agents
      for (const agentTemplate of this.DOMAIN_AGENTS) {
        const agent: SemanticAgent = {
          ...agentTemplate,
          id: `semantic_agent_${agentTemplate.type}_${Date.now()}`,
          memory: this.createEmptyMemory(),
          performance: {
            tasksCompleted: 0,
            avgProcessingTime: 0,
            successRate: 1.0
          }
        };
        
        this.agents.set(agent.id, agent);
        
        if (this.config.debugMode) {
          console.log(chalk.green(`[Semantic Coordinator] Initialized ${agent.name}`));
        }
      }

      // Setup memory sharing if enabled
      if (this.config.enableMemorySharing) {
        this.setupMemorySharing();
      }

      this.isInitialized = true;
      this.emit('initialized', { agentCount: this.agents.size });

    } catch (error) {
      throw new Error(`Failed to initialize semantic coordinator: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Core Pattern 1: Ontology-based agent assignment
   */
  async routeTaskToAgent(task: SemanticTask): Promise<SemanticTask> {
    const startTime = performance.now();
    
    try {
      // Analyze task for ontology domain
      const domains = this.analyzeTaskOntology(task);
      
      // Find best agent based on expertise
      const bestAgent = this.findBestAgent(domains);
      
      if (bestAgent) {
        task.assignedAgent = bestAgent;
        task.ontologyDomain = domains[0]; // Primary domain
        
        // Update agent status
        bestAgent.status = 'busy';
        bestAgent.currentTasks.push(task.id);
        
        this.tasks.set(task.id, task);
        
        if (this.config.debugMode) {
          console.log(chalk.blue(`[Semantic Coordinator] Routed task ${task.id} to ${bestAgent.name} (${domains.join(', ')})`));
        }
        
        this.emit('task-routed', { 
          task, 
          agent: bestAgent, 
          domains,
          routingTime: performance.now() - startTime
        });
      }
      
      return task;
      
    } catch (error) {
      if (this.config.debugMode) {
        console.error(chalk.red(`[Semantic Coordinator] Failed to route task: ${error instanceof Error ? error.message : String(error)}`));
      }
      return task;
    }
  }

  /**
   * Core Pattern 2: Semantic task decomposition
   */
  async decomposeTask(task: SemanticTask): Promise<TaskDecomposition> {
    const startTime = performance.now();
    
    try {
      // Analyze task complexity and identify sub-components
      const subTasks: TaskDecomposition['subTasks'] = [];
      let executionPlan: TaskDecomposition['executionPlan'] = 'parallel';
      
      // Healthcare domain decomposition
      if (task.type === 'healthcare' || task.ontologyDomain === 'fhir') {
        if (task.description.toLowerCase().includes('patient')) {
          subTasks.push({
            id: `${task.id}_patient_data`,
            type: 'healthcare',
            description: 'Process patient data structures',
            dependencies: [],
            ontologyContext: ['fhir']
          });
        }
        
        if (task.description.toLowerCase().includes('clinical')) {
          subTasks.push({
            id: `${task.id}_clinical_workflow`,
            type: 'healthcare',
            description: 'Handle clinical workflow patterns',
            dependencies: [],
            ontologyContext: ['fhir']
          });
        }
      }
      
      // Financial domain decomposition
      if (task.type === 'financial' || task.ontologyDomain === 'fibo') {
        if (task.description.toLowerCase().includes('instrument')) {
          subTasks.push({
            id: `${task.id}_financial_instruments`,
            type: 'financial',
            description: 'Process financial instrument definitions',
            dependencies: [],
            ontologyContext: ['fibo']
          });
        }
        
        if (task.description.toLowerCase().includes('market')) {
          subTasks.push({
            id: `${task.id}_market_data`,
            type: 'financial',
            description: 'Handle market data structures',
            dependencies: [],
            ontologyContext: ['fibo']
          });
        }
      }
      
      // Supply chain decomposition
      if (task.type === 'supply_chain' || task.ontologyDomain === 'gs1') {
        if (task.description.toLowerCase().includes('product')) {
          subTasks.push({
            id: `${task.id}_product_id`,
            type: 'supply_chain',
            description: 'Process product identification',
            dependencies: [],
            ontologyContext: ['gs1']
          });
        }
        
        if (task.description.toLowerCase().includes('trace')) {
          subTasks.push({
            id: `${task.id}_traceability`,
            type: 'supply_chain',
            description: 'Handle traceability requirements',
            dependencies: [],
            ontologyContext: ['gs1']
          });
        }
      }
      
      // Always add validation sub-task for consistency
      subTasks.push({
        id: `${task.id}_validation`,
        type: 'validation',
        description: 'Validate cross-ontology consistency',
        dependencies: subTasks.map(st => st.id),
        ontologyContext: Array.from(new Set(subTasks.flatMap(st => st.ontologyContext)))
      });
      
      // Assign agents to sub-tasks
      for (const subTask of subTasks) {
        const agent = this.findBestAgent(subTask.ontologyContext as OntologyDomain[]);
        if (agent) {
          subTask.assignedAgent = agent;
        }
      }
      
      // Determine execution plan
      const hasValidationDependency = subTasks.some(st => st.dependencies.length > 0);
      if (hasValidationDependency) {
        executionPlan = 'mixed';
      }
      
      const decomposition: TaskDecomposition = {
        originalTaskId: task.id,
        subTasks,
        executionPlan,
        estimatedDuration: this.estimateTaskDuration(subTasks)
      };
      
      if (this.config.debugMode) {
        console.log(chalk.cyan(`[Semantic Coordinator] Decomposed task ${task.id} into ${subTasks.length} sub-tasks`));
      }
      
      this.emit('task-decomposed', { 
        task, 
        decomposition,
        decompositionTime: performance.now() - startTime
      });
      
      return decomposition;
      
    } catch (error) {
      throw new Error(`Failed to decompose task: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Core Pattern 3: Cross-template consistency validation
   */
  async validateSemanticConsistency(
    templates: Array<{ path: string; content: string; context: any }>,
    ontologies: RDFDataSource[]
  ): Promise<SemanticValidationResult> {
    const startTime = performance.now();
    const issues: SemanticValidationResult['issues'] = [];
    
    try {
      // Load ontology data
      const ontologyData = await Promise.all(
        ontologies.map(ont => this.rdfLoader.loadFromSource(ont))
      );
      
      // Cross-template consistency checks
      const crossTemplateValid = await this.validateCrossTemplateConsistency(templates);
      if (!crossTemplateValid.valid) {
        issues.push(...crossTemplateValid.issues);
      }
      
      // Ontology compliance checks
      const ontologyCompliant = await this.validateOntologyCompliance(templates, ontologyData);
      if (!ontologyCompliant.valid) {
        issues.push(...ontologyCompliant.issues);
      }
      
      // Vocabulary usage validation
      const vocabularyValid = await this.validateVocabularyUsage(templates, ontologyData);
      if (!vocabularyValid.valid) {
        issues.push(...vocabularyValid.issues);
      }
      
      const result: SemanticValidationResult = {
        valid: issues.filter(i => i.type === 'error').length === 0,
        consistency: {
          crossTemplate: crossTemplateValid.valid,
          ontologyCompliance: ontologyCompliant.valid,
          vocabularyUsage: vocabularyValid.valid
        },
        issues,
        metrics: {
          templatesValidated: templates.length,
          ontologiesChecked: ontologies.length,
          processingTime: performance.now() - startTime
        }
      };
      
      if (this.config.debugMode) {
        console.log(chalk.green(`[Semantic Coordinator] Validated ${templates.length} templates with ${issues.length} issues found`));
      }
      
      this.emit('validation-completed', result);
      
      return result;
      
    } catch (error) {
      return {
        valid: false,
        consistency: {
          crossTemplate: false,
          ontologyCompliance: false,
          vocabularyUsage: false
        },
        issues: [{
          type: 'error',
          message: `Validation failed: ${error instanceof Error ? error.message : String(error)}`
        }],
        metrics: {
          templatesValidated: 0,
          ontologiesChecked: 0,
          processingTime: performance.now() - startTime
        }
      };
    }
  }

  /**
   * Core Pattern 4: Semantic memory sharing between agents
   */
  async shareKnowledgeBetweenAgents(
    sourceAgentId: string,
    targetAgentIds: string[],
    knowledgeType: 'ontologies' | 'templates' | 'patterns'
  ): Promise<{ success: boolean; shared: number; errors: string[] }> {
    const errors: string[] = [];
    let shared = 0;
    
    try {
      const sourceAgent = this.agents.get(sourceAgentId);
      if (!sourceAgent) {
        throw new Error(`Source agent ${sourceAgentId} not found`);
      }
      
      const knowledge = sourceAgent.memory[knowledgeType];
      
      for (const targetId of targetAgentIds) {
        const targetAgent = this.agents.get(targetId);
        if (!targetAgent) {
          errors.push(`Target agent ${targetId} not found`);
          continue;
        }
        
        // Merge knowledge with conflict resolution
        Object.assign(targetAgent.memory[knowledgeType], knowledge);
        targetAgent.memory.lastUpdated = new Date().toISOString();
        shared++;
        
        if (this.config.debugMode) {
          console.log(chalk.blue(`[Semantic Coordinator] Shared ${knowledgeType} from ${sourceAgent.name} to ${targetAgent.name}`));
        }
      }
      
      this.emit('knowledge-shared', {
        source: sourceAgentId,
        targets: targetAgentIds,
        type: knowledgeType,
        count: shared
      });
      
      return { success: errors.length === 0, shared, errors };
      
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
      return { success: false, shared, errors };
    }
  }

  /**
   * Get swarm status and performance metrics
   */
  getSwarmStatus(): {
    agents: Array<{ id: string; type: string; name: string; status: string; performance: any }>;
    tasks: { active: number; completed: number; failed: number };
    performance: { averageTaskTime: number; successRate: number };
    memoryUsage: { totalOntologies: number; totalTemplates: number; totalPatterns: number };
  } {
    const agents = Array.from(this.agents.values()).map(agent => ({
      id: agent.id,
      type: agent.type,
      name: agent.name,
      status: agent.status,
      performance: agent.performance
    }));
    
    const activeTasks = Array.from(this.tasks.values()).filter(t => t.assignedAgent?.status === 'busy').length;
    const totalCompleted = agents.reduce((sum, a) => sum + a.performance.tasksCompleted, 0);
    const avgSuccessRate = agents.reduce((sum, a) => sum + a.performance.successRate, 0) / agents.length;
    const avgTaskTime = agents.reduce((sum, a) => sum + a.performance.avgProcessingTime, 0) / agents.length;
    
    let totalOntologies = 0;
    let totalTemplates = 0;
    let totalPatterns = 0;
    
    for (const agent of this.agents.values()) {
      totalOntologies += Object.keys(agent.memory.ontologies).length;
      totalTemplates += Object.keys(agent.memory.templates).length;
      totalPatterns += Object.keys(agent.memory.patterns).length;
    }
    
    return {
      agents,
      tasks: {
        active: activeTasks,
        completed: totalCompleted,
        failed: 0 // Calculated from performance metrics
      },
      performance: {
        averageTaskTime: avgTaskTime,
        successRate: avgSuccessRate
      },
      memoryUsage: {
        totalOntologies,
        totalTemplates,
        totalPatterns
      }
    };
  }

  // ==================== PRIVATE HELPER METHODS ====================

  private createEmptyMemory(): SemanticMemory {
    return {
      ontologies: {},
      templates: {},
      patterns: {},
      crossReferences: {},
      lastUpdated: new Date().toISOString()
    };
  }

  private analyzeTaskOntology(task: SemanticTask): OntologyDomain[] {
    const domains: Set<OntologyDomain> = new Set();
    const description = task.description.toLowerCase();
    const params = JSON.stringify(task.parameters).toLowerCase();
    const text = `${description} ${params}`;
    
    // Healthcare domain detection
    if (text.match(/\b(patient|clinical|medical|health|fhir|hl7|snomed|loinc)\b/)) {
      domains.add('fhir');
    }
    
    // Financial domain detection
    if (text.match(/\b(financial|market|instrument|trade|fibo|regulation|bank)\b/)) {
      domains.add('fibo');
    }
    
    // Supply chain detection
    if (text.match(/\b(supply|product|inventory|logistics|gs1|gtin|trace)\b/)) {
      domains.add('gs1');
    }
    
    // Schema.org detection
    if (text.match(/\b(schema|structured|seo|microdata|json-ld)\b/)) {
      domains.add('schema_org');
    }
    
    // Dublin Core detection
    if (text.match(/\b(metadata|resource|dublin|dc|description)\b/)) {
      domains.add('dublin_core');
    }
    
    // FOAF detection
    if (text.match(/\b(person|social|profile|foaf|friend)\b/)) {
      domains.add('foaf');
    }
    
    // Default to generic if no specific domain detected
    if (domains.size === 0) {
      domains.add('generic');
    }
    
    return Array.from(domains);
  }

  private findBestAgent(domains: OntologyDomain[]): SemanticAgent | null {
    let bestAgent: SemanticAgent | null = null;
    let bestScore = 0;
    
    for (const agent of this.agents.values()) {
      if (agent.status === 'offline') continue;
      
      // Calculate expertise score for this agent
      let score = 0;
      for (const domain of domains) {
        const expertise = agent.expertise.find(exp => exp.domain === domain);
        if (expertise) {
          score += expertise.confidenceScore;
        }
      }
      
      // Factor in current load (prefer less busy agents)
      const loadPenalty = agent.currentTasks.length * 0.1;
      score = Math.max(0, score - loadPenalty);
      
      // Factor in performance history
      const performanceBonus = agent.performance.successRate * 0.1;
      score += performanceBonus;
      
      if (score > bestScore) {
        bestScore = score;
        bestAgent = agent;
      }
    }
    
    return bestAgent;
  }

  private estimateTaskDuration(subTasks: TaskDecomposition['subTasks']): number {
    // Simple estimation based on sub-task count and complexity
    const baseTime = 30000; // 30 seconds base
    const perTaskTime = 15000; // 15 seconds per sub-task
    const complexityMultiplier = subTasks.some(st => st.dependencies.length > 0) ? 1.5 : 1.0;
    
    return (baseTime + (subTasks.length * perTaskTime)) * complexityMultiplier;
  }

  private async validateCrossTemplateConsistency(
    templates: Array<{ path: string; content: string; context: any }>
  ): Promise<{ valid: boolean; issues: Array<{ type: 'error' | 'warning' | 'info'; message: string; location?: string }> }> {
    const issues: Array<{ type: 'error' | 'warning' | 'info'; message: string; location?: string }> = [];
    
    // Check for variable naming consistency
    const variableNames = new Set<string>();
    const variableTypes = new Map<string, string>();
    
    for (const template of templates) {
      // Extract variables from template content
      const matches = template.content.match(/\{\{\s*(\w+)[\.\w]*\s*\}\}/g) || [];
      
      for (const match of matches) {
        const varName = match.replace(/[{}.\s]/g, '').split('.')[0];
        variableNames.add(varName);
        
        // Check if variable type is consistent across templates
        if (template.context[varName]) {
          const currentType = typeof template.context[varName];
          const existingType = variableTypes.get(varName);
          
          if (existingType && existingType !== currentType) {
            issues.push({
              type: 'warning',
              message: `Variable '${varName}' has inconsistent types across templates: ${existingType} vs ${currentType}`,
              location: template.path
            });
          } else {
            variableTypes.set(varName, currentType);
          }
        }
      }
    }
    
    return {
      valid: issues.filter(i => i.type === 'error').length === 0,
      issues
    };
  }

  private async validateOntologyCompliance(
    templates: Array<{ path: string; content: string; context: any }>,
    ontologyData: Array<{ success: boolean; data: TurtleData }>
  ): Promise<{ valid: boolean; issues: Array<{ type: 'error' | 'warning' | 'info'; message: string; location?: string }> }> {
    const issues: Array<{ type: 'error' | 'warning' | 'info'; message: string; location?: string }> = [];
    
    // Check if templates use valid ontology terms
    for (const template of templates) {
      for (const ontResult of ontologyData) {
        if (!ontResult.success) continue;
        
        const ontology = ontResult.data;
        
        // Check if template references exist in ontology
        const uriMatches = template.content.match(/https?:\/\/[^\s"'<>]+/g) || [];
        
        for (const uri of uriMatches) {
          const exists = Object.keys(ontology.subjects).some(subject => subject === uri) ||
                        Array.from(ontology.predicates).some(pred => pred === uri);
          
          if (!exists) {
            issues.push({
              type: 'warning',
              message: `URI '${uri}' not found in loaded ontologies`,
              location: template.path
            });
          }
        }
      }
    }
    
    return {
      valid: issues.filter(i => i.type === 'error').length === 0,
      issues
    };
  }

  private async validateVocabularyUsage(
    templates: Array<{ path: string; content: string; context: any }>,
    ontologyData: Array<{ success: boolean; data: TurtleData }>
  ): Promise<{ valid: boolean; issues: Array<{ type: 'error' | 'warning' | 'info'; message: string; location?: string }> }> {
    const issues: Array<{ type: 'error' | 'warning' | 'info'; message: string; location?: string }> = [];
    
    // Check for proper prefix usage and vocabulary consistency
    const prefixPattern = /(\w+):\w+/g;
    
    for (const template of templates) {
      const prefixMatches = template.content.match(prefixPattern) || [];
      
      for (const match of prefixMatches) {
        const [prefix] = match.split(':');
        
        // Check if prefix is properly defined in ontologies
        let prefixFound = false;
        for (const ontResult of ontologyData) {
          if (!ontResult.success) continue;
          
          if (ontResult.data.prefixes[prefix]) {
            prefixFound = true;
            break;
          }
        }
        
        if (!prefixFound) {
          issues.push({
            type: 'warning',
            message: `Prefix '${prefix}' is used but not defined in loaded ontologies`,
            location: template.path
          });
        }
      }
    }
    
    return {
      valid: issues.filter(i => i.type === 'error').length === 0,
      issues
    };
  }

  private setupMemorySharing(): void {
    // Periodic memory synchronization between agents
    setInterval(() => {
      this.synchronizeAgentMemories();
    }, 30000); // Every 30 seconds
  }

  private async synchronizeAgentMemories(): Promise<void> {
    if (!this.config.enableMemorySharing) return;
    
    try {
      const agents = Array.from(this.agents.values());
      
      // Share patterns between agents of different types
      for (let i = 0; i < agents.length; i++) {
        for (let j = i + 1; j < agents.length; j++) {
          const agentA = agents[i];
          const agentB = agents[j];
          
          // Only share between different agent types to cross-pollinate knowledge
          if (agentA.type !== agentB.type) {
            // Share patterns from A to B
            for (const [key, pattern] of Object.entries(agentA.memory.patterns)) {
              if (!agentB.memory.patterns[key]) {
                agentB.memory.patterns[key] = pattern;
              }
            }
            
            // Share patterns from B to A
            for (const [key, pattern] of Object.entries(agentB.memory.patterns)) {
              if (!agentA.memory.patterns[key]) {
                agentA.memory.patterns[key] = pattern;
              }
            }
          }
        }
      }
      
      if (this.config.debugMode) {
        console.log(chalk.gray('[Semantic Coordinator] Synchronized agent memories'));
      }
      
    } catch (error) {
      if (this.config.debugMode) {
        console.warn(chalk.yellow(`[Semantic Coordinator] Memory sync failed: ${error instanceof Error ? error.message : String(error)}`));
      }
    }
  }

  /**
   * Cleanup resources
   */
  async destroy(): Promise<void> {
    this.isInitialized = false;
    this.agents.clear();
    this.tasks.clear();
    this.removeAllListeners();
    
    if (this.config.debugMode) {
      console.log(chalk.gray('[Semantic Coordinator] Destroyed'));
    }
  }
}