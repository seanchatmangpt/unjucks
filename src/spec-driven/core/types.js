/**
 * Core Type Definitions for Spec-Driven Development
 * 
 * This module defines the foundational types and interfaces for the
 * spec-driven development architecture in unjucks.
 */

/**
 * @typedef {Object} ProjectSpecification
 * @property {SpecMetadata} metadata - Project metadata
 * @property {SpecificationDefinition} specification - Core specification
 * @property {GenerationConfig} generation - Generation configuration
 * @property {ValidationConfig} validation - Validation configuration
 * @property {HookConfig} hooks - Lifecycle hooks
 */

/**
 * @typedef {Object} SpecMetadata
 * @property {string} apiVersion - API version (e.g., "unjucks.dev/v1")
 * @property {string} kind - Resource kind (e.g., "ProjectSpecification")
 * @property {string} name - Project name
 * @property {string} description - Project description
 * @property {string} version - Specification version
 * @property {string[]} tags - Tags for categorization
 * @property {Object} labels - Key-value labels
 * @property {Object} annotations - Additional annotations
 */

/**
 * @typedef {Object} SpecificationDefinition
 * @property {string} domain - Domain area (e.g., "healthcare", "fintech")
 * @property {string} architecture - Architecture pattern
 * @property {string[]} compliance - Compliance frameworks
 * @property {RequirementSet} requirements - Functional and non-functional requirements
 * @property {ArchitectureDefinition} architecture - Technical architecture
 * @property {ComponentDefinition[]} components - System components
 */

/**
 * @typedef {Object} RequirementSet
 * @property {Requirement[]} functional - Functional requirements
 * @property {Requirement[]} nonFunctional - Non-functional requirements
 */

/**
 * @typedef {Object} Requirement
 * @property {string} id - Unique requirement identifier
 * @property {string} description - Requirement description
 * @property {string} priority - Priority level (low, medium, high, critical)
 * @property {string[]} acceptance - Acceptance criteria
 * @property {Object} metrics - Success metrics
 * @property {string[]} dependencies - Requirement dependencies
 */

/**
 * @typedef {Object} ArchitectureDefinition
 * @property {string} pattern - Architecture pattern
 * @property {string} database - Database technology
 * @property {string} auth - Authentication method
 * @property {string} api - API style
 * @property {string} deployment - Deployment platform
 * @property {Object} configuration - Additional configuration
 */

/**
 * @typedef {Object} ComponentDefinition
 * @property {string} name - Component name
 * @property {string} type - Component type
 * @property {string} generator - Generator to use
 * @property {Object} variables - Generator variables
 * @property {string[]} dependencies - Component dependencies
 * @property {Object} configuration - Component configuration
 */

/**
 * @typedef {Object} GenerationConfig
 * @property {string} outputDir - Output directory
 * @property {string} templatesDir - Templates directory
 * @property {GenerationPhase[]} phases - Generation phases
 * @property {Object} options - Generation options
 */

/**
 * @typedef {Object} GenerationPhase
 * @property {string} name - Phase name
 * @property {string} description - Phase description
 * @property {string[]} components - Components to generate
 * @property {string[]} dependsOn - Phase dependencies
 * @property {Object} configuration - Phase configuration
 */

/**
 * @typedef {Object} ValidationConfig
 * @property {boolean} enabled - Enable validation
 * @property {McpValidation} mcp - MCP tool configuration
 * @property {string[]} rules - Validation rules
 * @property {Object} options - Validation options
 */

/**
 * @typedef {Object} McpValidation
 * @property {McpTool[]} tools - MCP tools to use
 * @property {Object} configuration - MCP configuration
 */

/**
 * @typedef {Object} McpTool
 * @property {string} tool - Tool name
 * @property {string} mode - Operation mode
 * @property {string[]} rules - Validation rules
 * @property {string[]} agents - Agents to use
 */

/**
 * @typedef {Object} HookConfig
 * @property {string[]} beforeGeneration - Pre-generation hooks
 * @property {string[]} afterGeneration - Post-generation hooks
 * @property {string[]} beforePhase - Pre-phase hooks
 * @property {string[]} afterPhase - Post-phase hooks
 */

/**
 * @typedef {Object} ExecutionPlan
 * @property {string} id - Plan identifier
 * @property {SpecMetadata} metadata - Plan metadata
 * @property {ProjectSpecification} specification - Source specification
 * @property {ExecutionPhase[]} phases - Execution phases
 * @property {PlanDependencies} dependencies - Plan dependencies
 * @property {Object} configuration - Plan configuration
 * @property {ValidationResult} validation - Validation results
 */

/**
 * @typedef {Object} ExecutionPhase
 * @property {string} name - Phase name
 * @property {string} description - Phase description
 * @property {ExecutionTask[]} tasks - Phase tasks
 * @property {string[]} dependsOn - Phase dependencies
 * @property {PhaseConfiguration} configuration - Phase configuration
 */

/**
 * @typedef {Object} ExecutionTask
 * @property {string} id - Task identifier
 * @property {string} name - Task name
 * @property {string} type - Task type
 * @property {string} generator - Generator to use
 * @property {Object} variables - Task variables
 * @property {string} outputPath - Output path
 * @property {string[]} dependencies - Task dependencies
 * @property {TaskConfiguration} configuration - Task configuration
 */

/**
 * @typedef {Object} TaskConfiguration
 * @property {boolean} parallel - Can run in parallel
 * @property {number} priority - Task priority
 * @property {number} timeout - Task timeout
 * @property {Object} validation - Validation configuration
 * @property {Object} rollback - Rollback configuration
 */

/**
 * @typedef {Object} PlanDependencies
 * @property {string[]} external - External dependencies
 * @property {string[]} templates - Required templates
 * @property {string[]} generators - Required generators
 * @property {Object} resources - Resource requirements
 */

/**
 * @typedef {Object} PhaseConfiguration
 * @property {boolean} parallel - Execute tasks in parallel
 * @property {number} maxConcurrency - Maximum concurrent tasks
 * @property {boolean} failFast - Stop on first failure
 * @property {Object} validation - Phase validation
 */

/**
 * @typedef {Object} TaskList
 * @property {string} id - Task list identifier
 * @property {SpecMetadata} metadata - Task list metadata
 * @property {ExecutionPlan} plan - Source execution plan
 * @property {Task[]} tasks - Individual tasks
 * @property {TaskDependencyGraph} dependencies - Task dependency graph
 * @property {Object} configuration - Task list configuration
 */

/**
 * @typedef {Object} Task
 * @property {string} id - Task identifier
 * @property {string} name - Task name
 * @property {string} type - Task type
 * @property {TaskStatus} status - Task status
 * @property {GeneratorMapping} generator - Generator mapping
 * @property {Object} input - Task input data
 * @property {Object} output - Task output data
 * @property {TaskResult} result - Task execution result
 * @property {Object} metadata - Task metadata
 */

/**
 * @typedef {Object} TaskStatus
 * @property {string} state - Current state (pending, running, completed, failed)
 * @property {Date} startTime - Start timestamp
 * @property {Date} endTime - End timestamp
 * @property {number} progress - Progress percentage
 * @property {string} message - Status message
 */

/**
 * @typedef {Object} GeneratorMapping
 * @property {string} generator - Generator name
 * @property {string} template - Template name
 * @property {Object} variables - Template variables
 * @property {string} outputPath - Output path
 * @property {Object} options - Generation options
 */

/**
 * @typedef {Object} TaskDependencyGraph
 * @property {Object} nodes - Task nodes
 * @property {Object} edges - Task dependencies
 * @property {string[]} roots - Root tasks (no dependencies)
 * @property {string[]} leaves - Leaf tasks (no dependents)
 */

/**
 * @typedef {Object} TaskResult
 * @property {boolean} success - Task success status
 * @property {string} message - Result message
 * @property {GenerationResult[]} files - Generated files
 * @property {ValidationResult} validation - Validation results
 * @property {Object} metrics - Task metrics
 * @property {Error} error - Error if failed
 */

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - Overall validation status
 * @property {ValidationError[]} errors - Validation errors
 * @property {ValidationWarning[]} warnings - Validation warnings
 * @property {Object} metrics - Validation metrics
 * @property {Object} context - Validation context
 */

/**
 * @typedef {Object} ValidationError
 * @property {string} code - Error code
 * @property {string} message - Error message
 * @property {string} severity - Error severity
 * @property {string} path - Path to error location
 * @property {Object} context - Error context
 */

/**
 * @typedef {Object} ValidationWarning
 * @property {string} code - Warning code
 * @property {string} message - Warning message
 * @property {string} path - Path to warning location
 * @property {Object} context - Warning context
 */

/**
 * @typedef {Object} GenerationResult
 * @property {string} path - File path
 * @property {boolean} exists - File existed before generation
 * @property {number} size - File size
 * @property {string} action - Action taken (create, update, skip)
 * @property {Object} metadata - File metadata
 */

/**
 * @typedef {Object} ExecutionResult
 * @property {boolean} success - Overall execution status
 * @property {string} executionId - Execution identifier
 * @property {ExecutionMetrics} metrics - Execution metrics
 * @property {PhaseResult[]} phases - Phase results
 * @property {TaskResult[]} tasks - Task results
 * @property {ValidationResult} validation - Final validation
 * @property {Object} artifacts - Generated artifacts
 */

/**
 * @typedef {Object} ExecutionMetrics
 * @property {Date} startTime - Execution start time
 * @property {Date} endTime - Execution end time
 * @property {number} duration - Total duration (ms)
 * @property {number} tasksCompleted - Completed tasks
 * @property {number} tasksTotal - Total tasks
 * @property {number} filesGenerated - Generated files
 * @property {Object} performance - Performance metrics
 */

/**
 * @typedef {Object} PhaseResult
 * @property {string} name - Phase name
 * @property {boolean} success - Phase success status
 * @property {Date} startTime - Phase start time
 * @property {Date} endTime - Phase end time
 * @property {TaskResult[]} tasks - Phase task results
 * @property {Object} metrics - Phase metrics
 */

/**
 * @typedef {Object} SpecTemplate
 * @property {string} id - Template identifier
 * @property {SpecMetadata} metadata - Template metadata
 * @property {TemplateDefinition} template - Template definition
 * @property {VariableDefinition[]} variables - Template variables
 * @property {ValidationRule[]} validation - Validation rules
 */

/**
 * @typedef {Object} TemplateDefinition
 * @property {string} name - Template name
 * @property {string} description - Template description
 * @property {string} domain - Target domain
 * @property {string[]} tags - Template tags
 * @property {ComponentTemplate[]} components - Component templates
 */

/**
 * @typedef {Object} ComponentTemplate
 * @property {string} name - Component name
 * @property {string} type - Component type
 * @property {string} generator - Default generator
 * @property {Object} defaultVariables - Default variables
 * @property {VariableDefinition[]} requiredVariables - Required variables
 */

/**
 * @typedef {Object} VariableDefinition
 * @property {string} name - Variable name
 * @property {string} type - Variable type
 * @property {string} description - Variable description
 * @property {boolean} required - Is required
 * @property {*} defaultValue - Default value
 * @property {string[]} options - Available options
 * @property {string} validation - Validation pattern
 * @property {string[]} examples - Example values
 */

/**
 * @typedef {Object} ValidationRule
 * @property {string} name - Rule name
 * @property {string} type - Rule type
 * @property {string} description - Rule description
 * @property {Object} configuration - Rule configuration
 * @property {string} severity - Rule severity
 */

/**
 * @typedef {Object} SpecificationIndex
 * @property {string} id - Specification ID
 * @property {string} name - Specification name
 * @property {string} description - Description
 * @property {string} version - Version
 * @property {string[]} tags - Tags
 * @property {Date} created - Created timestamp
 * @property {Date} modified - Modified timestamp
 * @property {Object} metadata - Additional metadata
 */

/**
 * @typedef {Object} RollbackResult
 * @property {boolean} success - Rollback success
 * @property {string} message - Rollback message
 * @property {string[]} restoredFiles - Restored files
 * @property {string[]} errors - Rollback errors
 * @property {Object} metrics - Rollback metrics
 */

/**
 * @typedef {Object} ExecutionStatus
 * @property {string} executionId - Execution identifier
 * @property {string} state - Current state
 * @property {number} progress - Progress percentage
 * @property {string} currentPhase - Current phase
 * @property {string} currentTask - Current task
 * @property {ExecutionMetrics} metrics - Current metrics
 * @property {string} message - Status message
 */

// Export constants and enums
export const SPEC_API_VERSION = 'unjucks.dev/v1';
export const SPEC_KIND_PROJECT = 'ProjectSpecification';
export const SPEC_KIND_TEMPLATE = 'SpecificationTemplate';
export const SPEC_KIND_PLAN = 'ExecutionPlan';

export const TASK_STATES = {
  PENDING: 'pending',
  RUNNING: 'running', 
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
};

export const EXECUTION_STATES = {
  CREATED: 'created',
  PLANNING: 'planning',
  EXECUTING: 'executing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
};

export const PRIORITY_LEVELS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
};

export const COMPONENT_TYPES = {
  API_SERVICE: 'api-service',
  WEB_SERVICE: 'web-service',
  DATABASE: 'database',
  AUTH_SERVICE: 'auth-service',
  MESSAGING: 'messaging',
  MONITORING: 'monitoring',
  DEPLOYMENT: 'deployment',
  CONFIGURATION: 'configuration'
};

export const ARCHITECTURE_PATTERNS = {
  MONOLITH: 'monolith',
  MICROSERVICES: 'microservices',
  SERVERLESS: 'serverless',
  EVENT_DRIVEN: 'event-driven',
  LAYERED: 'layered'
};

export const VALIDATION_SEVERITIES = {
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info'
};

// Utility functions for type checking
export const isValidSpecification = (obj) => {
  return obj &&
    obj.metadata &&
    obj.specification &&
    obj.generation &&
    typeof obj.metadata.name === 'string' &&
    typeof obj.metadata.apiVersion === 'string';
};

export const isValidExecutionPlan = (obj) => {
  return obj &&
    obj.id &&
    obj.metadata &&
    obj.phases &&
    Array.isArray(obj.phases);
};

export const isValidTaskList = (obj) => {
  return obj &&
    obj.id &&
    obj.tasks &&
    Array.isArray(obj.tasks);
};