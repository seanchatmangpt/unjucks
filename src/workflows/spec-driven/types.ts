/**
 * Type definitions for spec-driven development workflows
 */

export interface WorkflowConfig {
  id: string;
  name: string;
  description: string;
  version: string;
  timeout: number;
  retryCount: number;
  parallel: boolean;
  dependencies: string[];
}

export interface WorkflowState {
  id: string;
  status: WorkflowStatus;
  currentStep: string;
  progress: number;
  startTime: Date;
  endTime?: Date;
  error?: WorkflowError;
  metadata: Record<string, any>;
}

export type WorkflowStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';

export interface WorkflowError {
  code: string;
  message: string;
  stack?: string;
  recoverable: boolean;
}

export interface WorkflowResult<T = any> {
  success: boolean;
  data?: T;
  error?: WorkflowError;
  metrics: WorkflowMetrics;
}

export interface WorkflowMetrics {
  duration: number;
  stepsCompleted: number;
  totalSteps: number;
  resourcesUsed: Record<string, number>;
  agentsInvolved: string[];
}

// Specification-related types
export interface SpecificationDocument {
  id: string;
  title: string;
  description: string;
  version: string;
  author: string;
  created: Date;
  updated: Date;
  status: SpecStatus;
  requirements: Requirement[];
  constraints: Constraint[];
  acceptanceCriteria: AcceptanceCriterion[];
  metadata: Record<string, any>;
}

export type SpecStatus = 'draft' | 'review' | 'approved' | 'rejected' | 'archived';

export interface Requirement {
  id: string;
  type: 'functional' | 'non-functional' | 'business' | 'technical';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  testable: boolean;
  dependencies: string[];
}

export interface Constraint {
  id: string;
  type: 'technical' | 'business' | 'regulatory' | 'performance';
  description: string;
  impact: 'low' | 'medium' | 'high';
  mandatory: boolean;
}

export interface AcceptanceCriterion {
  id: string;
  requirementId: string;
  scenario: string;
  given: string;
  when: string;
  then: string;
  testable: boolean;
}

// Technical planning types
export interface TechnicalPlan {
  id: string;
  specificationId: string;
  version: string;
  created: Date;
  architecture: ArchitecturalDecision[];
  components: ComponentSpec[];
  dependencies: DependencySpec[];
  timeline: Milestone[];
  risks: RiskAssessment[];
}

export interface ArchitecturalDecision {
  id: string;
  title: string;
  description: string;
  rationale: string;
  alternatives: string[];
  implications: string[];
  status: 'proposed' | 'accepted' | 'rejected' | 'superseded';
}

export interface ComponentSpec {
  id: string;
  name: string;
  type: 'service' | 'library' | 'database' | 'ui' | 'integration';
  description: string;
  interfaces: InterfaceSpec[];
  dependencies: string[];
  estimatedEffort: number;
  complexity: 'low' | 'medium' | 'high';
}

export interface InterfaceSpec {
  name: string;
  type: 'rest' | 'graphql' | 'grpc' | 'event' | 'function';
  schema: any;
  documentation: string;
}

export interface DependencySpec {
  name: string;
  version: string;
  type: 'internal' | 'external';
  critical: boolean;
  alternatives: string[];
}

export interface Milestone {
  id: string;
  name: string;
  description: string;
  dueDate: Date;
  deliverables: string[];
  dependencies: string[];
}

export interface RiskAssessment {
  id: string;
  description: string;
  probability: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  mitigation: string;
  owner: string;
}

// Task distribution types
export interface TaskAssignment {
  id: string;
  planId: string;
  componentId: string;
  agentType: AgentType;
  agentId?: string;
  priority: TaskPriority;
  estimatedEffort: number;
  dependencies: string[];
  requirements: string[];
  constraints: string[];
  status: TaskStatus;
  assignedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

export type AgentType = 
  | 'researcher' 
  | 'coder' 
  | 'tester' 
  | 'reviewer' 
  | 'architect'
  | 'optimizer'
  | 'documenter'
  | 'coordinator'
  | 'specialist';

export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';
export type TaskStatus = 'pending' | 'assigned' | 'in_progress' | 'completed' | 'blocked' | 'cancelled';

// Implementation types
export interface ImplementationResult {
  taskId: string;
  success: boolean;
  artifacts: CodeArtifact[];
  tests: TestResult[];
  documentation: string[];
  metrics: ImplementationMetrics;
  issues: Issue[];
}

export interface CodeArtifact {
  path: string;
  type: 'source' | 'test' | 'config' | 'documentation';
  content: string;
  language: string;
  size: number;
  complexity: number;
}

export interface TestResult {
  suite: string;
  tests: number;
  passed: number;
  failed: number;
  coverage: number;
  duration: number;
}

export interface ImplementationMetrics {
  linesOfCode: number;
  cyclomatic Complexity: number;
  testCoverage: number;
  codeQuality: number;
  performance: Record<string, number>;
}

export interface Issue {
  id: string;
  type: 'bug' | 'performance' | 'security' | 'style' | 'documentation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  file: string;
  line?: number;
  suggestion?: string;
}

// MCP Integration types
export interface MCPWorkflowConfig extends WorkflowConfig {
  swarmTopology: 'hierarchical' | 'mesh' | 'ring' | 'star';
  maxAgents: number;
  mcpServers: string[];
  enableHooks: boolean;
  enableMemory: boolean;
}

export interface AgentCapability {
  name: string;
  description: string;
  inputs: string[];
  outputs: string[];
  dependencies: string[];
}

export interface WorkflowEvent {
  id: string;
  workflowId: string;
  type: string;
  timestamp: Date;
  data: any;
  source: string;
}