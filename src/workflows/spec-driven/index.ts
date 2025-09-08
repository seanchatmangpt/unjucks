/**
 * Spec-Driven Development Workflow Orchestrator
 * Automates the complete lifecycle from specification to implementation
 */

export { SpecReviewWorkflow } from './spec-review-workflow';
export { PlanGenerationWorkflow } from './plan-generation-workflow';
export { TaskDistributionWorkflow } from './task-distribution-workflow';
export { ImplementationWorkflow } from './implementation-workflow';
export { WorkflowOrchestrator } from './workflow-orchestrator';

// Workflow types and interfaces
export type {
  WorkflowConfig,
  WorkflowState,
  WorkflowResult,
  SpecificationDocument,
  TechnicalPlan,
  TaskAssignment,
  ImplementationResult
} from './types';

// Workflow status constants
export const WORKFLOW_STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
} as const;

// Integration hooks
export { MCPWorkflowIntegration } from './mcp-integration';