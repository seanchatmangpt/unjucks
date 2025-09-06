/**
 * Type definitions for MCP-Claude Flow Integration
 * Unified type exports for the entire integration system
 */

// Core agent and swarm types
export enum AgentType {
  RESEARCHER = 'researcher',
  CODER = 'coder',
  TESTER = 'tester',
  REVIEWER = 'reviewer',
  COORDINATOR = 'coordinator',
  SYSTEM_ARCHITECT = 'system-architect',
  CODE_ANALYZER = 'code-analyzer',
  BACKEND_DEV = 'backend-dev',
  TASK_ORCHESTRATOR = 'task-orchestrator',
  PERFORMANCE_ANALYZER = 'perf-analyzer'
}

export enum SwarmStrategy {
  BALANCED = 'balanced',
  SPECIALIZED = 'specialized',
  ADAPTIVE = 'adaptive'
}

export enum ExecutionStrategy {
  PARALLEL = 'parallel',
  SEQUENTIAL = 'sequential',
  ADAPTIVE = 'adaptive',
  LOAD_BALANCED = 'load_balanced'
}

// Swarm configuration types
export interface SwarmConfig {
  topology: 'mesh' | 'hierarchical' | 'ring' | 'star';
  maxAgents: number;
  strategy?: SwarmStrategy;
  adaptiveTopology?: boolean;
  selfHealing?: boolean;
  failoverEnabled?: boolean;
  hubFailover?: boolean;
}

export interface SwarmTask {
  id: string;
  type: string;
  agentType: AgentType;
  params: Record<string, any>;
  priority: number;
  dependencies: string[];
  estimatedDuration: number;
  metadata?: Record<string, any>;
}

// Orchestration result types
export interface OrchestrationResult {
  success: boolean;
  results: TaskResult[];
  error?: string;
  warnings?: string[];
  metrics: {
    executionTime: number;
    totalTasks: number;
    successfulTasks: number;
    failedTasks: number;
    parallelTasks?: number;
    loadBalancingEfficiency?: number;
    coordinationOverhead?: number;
    pipelineEfficiency?: number;
    distributionEfficiency?: number;
    hubUtilization?: number;
    efficiency?: number;
    resourceUtilization?: number;
    topologyChanged?: boolean;
    adaptationReason?: string;
    retryAttempts?: number;
  };
  data?: Record<string, any>;
}

export interface TaskResult {
  success: boolean;
  taskId: string;
  agentId?: string;
  result?: any;
  error?: string;
  metrics: {
    startTime: number;
    endTime?: number;
    executionTime: number;
    retryAttempts?: number;
  };
  errorContext?: Record<string, any>;
  stackTrace?: string;
}

// Fortune 5 company profile types
export interface Fortune5CompanyProfile {
  id: string;
  name: string;
  industry: string;
  revenue: number;
  employees: number;
  regions: string[];
  complianceRequirements: string[];
  techStack: TechStack;
  constraints: CompanyConstraints;
  customSettings?: Record<string, any>;
}

export interface TechStack {
  languages: string[];
  frameworks: string[];
  databases: string[];
  cloud: string[];
  cicd: string[];
}

export interface CompanyConstraints {
  security: 'basic' | 'enterprise' | 'government';
  performance: 'standard' | 'high' | 'ultra';
  scalability: 'regional' | 'national' | 'global';
  availability: string;
}

// JTBD workflow types
export interface JTBDRequirements {
  microserviceCount?: number;
  apiStandards?: string[];
  securityRequirements?: string[];
  performanceTargets?: Record<string, string>;
  complianceLevel?: string;
  auditRequirements?: Record<string, any>;
  gdprRequirements?: Record<string, boolean>;
  multiCompliance?: string[];
  databaseMigrations?: DatabaseMigrationRequirements;
  performanceOptimization?: Record<string, any>;
  cicdRequirements?: CICDRequirements;
  securityScanning?: SecurityScanningRequirements;
  containerization?: ContainerizationRequirements;
  documentationTypes?: string[];
  outputFormats?: string[];
  autoGeneration?: Record<string, boolean>;
  interactiveFeatures?: Record<string, boolean>;
  complianceDocumentation?: Record<string, any>;
  customTemplates?: Record<string, any>;
  techStackOverride?: Partial<TechStack>;
  useRDFMetadata?: boolean;
  rdfSources?: string[];
  enableCrossReferencing?: boolean;
  customizationRules?: Record<string, string>;
  applyConditionalRules?: boolean;
  largeCodebase?: boolean;
  globalDeployment?: boolean;
  highAvailability?: boolean;
}

export interface DatabaseMigrationRequirements {
  sourceSystem: string;
  targetSystem: string;
  dataVolume?: string;
  tableCount?: number;
  migrationStrategy: string;
  cloudNative?: boolean;
  shardingStrategy?: string;
}

export interface CICDRequirements {
  platforms: string[];
  environments: string[];
  deploymentStrategy: string;
  testingLevels: string[];
}

export interface SecurityScanningRequirements {
  sastTools?: string[];
  dastTools?: string[];
  dependencyScanning?: string[];
  secretScanning?: boolean;
}

export interface ContainerizationRequirements {
  platform: string;
  orchestration: string;
  registry: string;
  helmCharts?: boolean;
}

export interface JTBDWorkflowResult {
  success: boolean;
  workflowId: string;
  workflowType: string;
  executionTime: number;
  deliverables: WorkflowDeliverable[];
  roi: ROICalculation;
  metrics: WorkflowMetrics;
  error?: string;
  warnings?: string[];
  metadata?: Record<string, any>;
}

export interface WorkflowDeliverable {
  id: string;
  name: string;
  type: string;
  content: string;
  path?: string;
  metadata?: Record<string, any>;
  crossReferences?: string[];
  rdfSource?: string;
  customizedFromRDF?: boolean;
  generatedByRules?: string[];
}

export interface ROICalculation {
  estimatedValue: number;
  timeToValue: number;
  riskReduction: number;
  complianceSavings?: number;
  monthlyValue?: number;
  yearlyValue?: number;
}

export interface WorkflowMetrics {
  tasksCompleted: number;
  agentsUsed: string[];
  memoryOperations: number;
  parallelEfficiency?: number;
  errorCount?: number;
}

// Memory interface types
export interface MemoryOptions {
  namespace?: string;
  ttl?: number;
  agentId?: string;
  tags?: string[];
  metadata?: Record<string, any>;
  accessControl?: 'public' | 'private';
}

export interface MemorySearchOptions {
  namespace?: string;
  tags?: string[];
  keyPattern?: RegExp;
  limit?: number;
}

export interface MemoryStats {
  totalKeys: number;
  memoryUsage: number;
  namespaces: string[];
}

export interface MemoryMetrics {
  operations: {
    set: number;
    get: number;
    delete: number;
  };
  performance: {
    averageSetTime: number;
    averageGetTime: number;
  };
}

export interface MemoryHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  memoryUtilization: number;
}

// Agent performance types
export interface AgentPerformanceMetrics {
  agentId: string;
  agentType: AgentType;
  tasksCompleted: number;
  averageTaskTime: number;
  successRate: number;
  currentLoad: number;
}

export interface LoadBalancingMetrics {
  totalTasksDistributed: number;
  agentUtilization: number;
  loadBalance: number;
}

export interface SwarmHealth {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'recovered' | 'healed';
  healthyAgents: number;
  failedAgents: number;
  activeConnections?: number;
  coordinatorAgent?: string;
  newCoordinator?: string;
  newHub?: string;
  ringIntegrity?: boolean;
  starTopologyIntact?: boolean;
}

// Integration types
export interface IntegrationConfig {
  workspace: string;
  maxConcurrentAgents?: number;
  defaultTimeout?: number;
  enableMetrics?: boolean;
  enablePersistence?: boolean;
  persistencePath?: string;
  maxMemorySize?: number;
}

export interface IntegrationStatus {
  initialized: boolean;
  components: {
    connector: string;
    orchestrator: string;
    memory: string;
    workflows: string;
  };
  warnings: string[];
}

export interface PerformanceMetrics {
  totalWorkflowsExecuted: number;
  averageExecutionTime: number;
  successRate: number;
  memoryUsage: {
    current: number;
    peak: number;
  };
  agentUtilization: {
    average: number;
    peak: number;
  };
}

// Error handling types
export interface RollbackOptions {
  backupFiles?: string[];
  memoryKeys?: string[];
  preserveKeys?: string[];
  cleanupFiles?: string[];
  swarmId?: string;
  preserveAgents?: string[];
}

export interface ExecutionResult {
  success: boolean;
  result?: any;
  error?: string;
  rollbackPerformed?: boolean;
}

// Re-export RDF and Turtle types
export * from './rdf.types.js';
export * from './turtle-types.js';

// Enterprise semantic types
export * from './enterprise-rdf.types.js';
export * from './semantic-frontmatter.types.js';

// Additional semantic re-exports  
export type {
  ValidationResult,
  ComplianceMapping,
  InferredProperties,
  EnterpriseSemanticContext,
  TemplateVariableResult,
  OptimizedQueryResult
} from './enterprise-rdf.types.js';

// Import SemanticContext from the main semantic engine
export type { SemanticContext } from '../semantic-template-engine.js';

// Common semantic types (consolidated to avoid conflicts)
export type {
  PropertyDefinition,
  ValidationRule,
  CrossOntologyRule,
  PerformanceProfile,
  ClassDefinition
} from './semantic-common.js';

export type {
  SemanticQueryPattern,
  SemanticValidationRequirements,
  EnterpriseDataSource,
  VariableEnhancementConfig
} from './semantic-frontmatter.types.js';

// Re-export validation types
export * from './validation';

// Workflow chain types
export interface WorkflowChainStep {
  type: 'api-standardization' | 'compliance-scaffolding' | 'database-migrations' | 'cicd-pipelines' | 'documentation-generation';
  requirements: Partial<JTBDRequirements>;
}

export interface WorkflowChainResult {
  success: boolean;
  workflowResults: JTBDWorkflowResult[];
  totalExecutionTime: number;
  totalROI: ROICalculation;
  errors: string[];
}

// Configuration types
export interface ConfigurationRecommendations {
  swarmTopology: string;
  maxConcurrentAgents: number;
  recommendedWorkflows: string[];
  estimatedROI: number;
  reasoning: string;
}

export interface HealthCheck {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  components: {
    connector: 'healthy' | 'degraded' | 'unhealthy';
    orchestrator: 'healthy' | 'degraded' | 'unhealthy';
    memory: 'healthy' | 'degraded' | 'unhealthy';
    workflows: 'healthy' | 'degraded' | 'unhealthy';
  };
  uptime: number;
  lastChecked: Date;
}

export interface DiagnosticsResult {
  tests: DiagnosticTest[];
  summary: {
    totalTests: number;
    passedTests: number;
    failedTests: number;
    warningTests: number;
  };
}

export interface DiagnosticTest {
  name: string;
  status: 'passed' | 'failed' | 'warning';
  duration: number;
  message?: string;
  details?: Record<string, any>;
}

export interface SystemConfiguration {
  version: string;
  workspace: string;
  components: Record<string, any>;
  settings: Record<string, any>;
  createdAt: Date;
}

// Agent spawning result types
export interface AgentSpawnResult {
  success: boolean;
  agentId?: string;
  error?: string;
}

export interface SwarmCreateResult {
  success: boolean;
  swarmId?: string;
  data?: {
    topology: string;
    maxAgents: number;
    strategy?: SwarmStrategy;
    currentTopology?: string;
    activeAgents?: number;
  };
  error?: string;
}

export interface CoordinationResult {
  success: boolean;
  data?: {
    coordinationPattern: string;
    activeConnections?: number;
    coordinatorAgent?: string;
    hubAgent?: string;
    spokeAgents?: string[];
    ringOrder?: string[];
    circularConnections?: number;
    participatingSwarms?: number;
  };
  error?: string;
}