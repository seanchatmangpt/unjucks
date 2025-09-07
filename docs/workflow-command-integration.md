# Workflow Command - MCP Integration Guide

## Overview

The workflow command at `/Users/sac/unjucks/src/commands/workflow.ts` provides a comprehensive CLI interface for managing workflows and automation using MCP (Model Context Protocol) capabilities. This command exposes advanced workflow orchestration features through an intuitive command-line interface.

## Features

### 🔧 Core Workflow Operations
- **Create workflows** with event triggers and steps
- **Execute workflows** with message queue processing  
- **Monitor workflow status** and performance metrics
- **List and filter workflows** by various criteria
- **Agent assignment optimization** with vector similarity matching

### 🔍 Advanced Monitoring
- **Queue status monitoring** for message processing
- **Audit trails** for workflow execution history
- **Performance metrics** and resource usage tracking

## Available Subcommands

### `workflow create`
Create a new workflow with event triggers
```bash
workflow create --name "api-development" --steps "design,implement,test" --triggers "push,pr" --priority 8
```

**Options:**
- `--name` (required): Workflow name
- `--steps` (required): Comma-separated workflow steps
- `--description`: Optional workflow description
- `--triggers`: Event triggers (push, pr, schedule, etc.)
- `--priority`: Priority level (0-10)
- `--metadata`: JSON metadata

### `workflow execute`
Execute a workflow with message queue processing
```bash
workflow execute --workflow-id abc123 --async --input-data '{"branch":"main","environment":"production"}'
```

**Options:**
- `--workflow-id` (required): ID of workflow to execute
- `--async`: Execute asynchronously via message queue
- `--input-data`: JSON input data for execution

### `workflow status`
Get workflow execution status and performance metrics
```bash
workflow status --workflow-id abc123 --include-metrics
```

**Options:**
- `--workflow-id`: Specific workflow ID
- `--execution-id`: Specific execution ID  
- `--include-metrics`: Include performance metrics

### `workflow list`
List workflows with filtering options
```bash
workflow list --status active --limit 25 --offset 0
```

**Options:**
- `--status`: Filter by status (active, completed, failed, paused)
- `--limit`: Maximum workflows to return (default: 10)
- `--offset`: Number to skip (default: 0)

### `workflow agent-assign`
Assign optimal agent to workflow task using AI matching
```bash
workflow agent-assign --task-id xyz789 --agent-type coder --use-vector-similarity
```

**Options:**
- `--task-id` (required): Task ID to assign agent to
- `--agent-type`: Preferred agent type (coder, tester, reviewer, etc.)
- `--use-vector-similarity`: Use AI vector matching for optimal assignment

### `workflow queue-status`
Check message queue status and health
```bash
workflow queue-status --queue-name high-priority --include-messages
```

**Options:**
- `--queue-name`: Specific queue to monitor
- `--include-messages`: Include pending message details

### `workflow audit-trail`
Get comprehensive workflow execution audit trail
```bash
workflow audit-trail --workflow-id abc123 --limit 100 --start-time "2024-01-15T10:00:00Z"
```

**Options:**
- `--workflow-id`: Specific workflow ID
- `--limit`: Maximum events to return (default: 50)
- `--start-time`: Start time filter (ISO 8601)

## MCP Integration Points

### Current Implementation Status

The workflow command is currently implemented with **mock/demonstration functions** that show the expected data structures and flow. To integrate with actual MCP services, the following functions need to be replaced with real MCP calls:

```typescript
// These functions in workflow.ts should be replaced with actual MCP calls:
- createWorkflow()      → mcp__flow-nexus__workflow_create
- executeWorkflow()     → mcp__flow-nexus__workflow_execute  
- getWorkflowStatus()   → mcp__flow-nexus__workflow_status
- listWorkflows()       → mcp__flow-nexus__workflow_list
- assignAgent()         → mcp__flow-nexus__workflow_agent_assign
- getQueueStatus()      → mcp__flow-nexus__workflow_queue_status
- getAuditTrail()       → mcp__flow-nexus__workflow_audit_trail
```

### Integration Example

```typescript
// Example of replacing mock with actual MCP call
async function createWorkflow(options: WorkflowCreateOptions) {
  try {
    // Replace this mock implementation:
    const result = await mcp__flow_nexus__workflow_create({
      name: options.name,
      description: options.description,
      steps: parsedSteps,
      triggers: parsedTriggers,
      priority: options.priority || 5,
      metadata: options.metadata || {}
    })
    
    return result
  } catch (error) {
    throw new Error(`Failed to create workflow: ${error}`)
  }
}
```

## Usage in Development Workflows

### Example 1: API Development Pipeline
```bash
# Create API development workflow
workflow create --name "api-pipeline" \
  --steps "design,implement,test,review,deploy" \
  --triggers "push,pr" \
  --priority 8

# Execute the workflow
workflow execute --workflow-id api-pipeline-001 --async \
  --input-data '{"service":"users","version":"v2","environment":"staging"}'

# Monitor progress
workflow status --workflow-id api-pipeline-001 --include-metrics

# Check queue health
workflow queue-status --queue-name api-deployments
```

### Example 2: Code Review Automation
```bash
# Create code review workflow  
workflow create --name "code-review" \
  --steps "static-analysis,security-scan,test-coverage,human-review" \
  --triggers "pr-opened,pr-updated"

# Assign specialized agents to tasks
workflow agent-assign --task-id security-scan-task \
  --agent-type security-auditor \
  --use-vector-similarity

# Get audit trail
workflow audit-trail --workflow-id code-review-002 --limit 50
```

## Integration with Claude-Flow

The workflow command is designed to work seamlessly with the Claude-Flow MCP ecosystem:

### Coordination Setup
```bash
# Initialize swarm topology first (optional)
mcp__claude-flow__swarm_init --topology mesh --maxAgents 6

# Create workflow that leverages the swarm
workflow create --name "distributed-development" \
  --steps "research,architect,implement,test,optimize" \
  --metadata '{"swarm_enabled": true, "parallel_execution": true}'
```

### Agent Integration
The workflow command supports all Claude-Flow agent types:
- `coder`, `reviewer`, `tester`, `planner`, `researcher`
- `system-architect`, `performance-benchmarker`, `security-manager`
- `github-integration`, `api-docs`, `cicd-engineer`

## Testing

The workflow command includes comprehensive testing:

```bash
# Test command structure and functionality
npx tsx tests/workflow-command.test.ts

# Test individual subcommands (when MCP is connected)
workflow create --name "test-workflow" --steps "step1,step2"
workflow list --status active
workflow queue-status
```

## Error Handling

The command includes robust error handling:
- **Validation errors** for required parameters
- **JSON parsing errors** for metadata and input data  
- **Network errors** for MCP communication
- **Queue timeout errors** for async operations
- **Permission errors** for workflow access

## Performance Considerations

- **Async execution** prevents CLI blocking on long workflows
- **Pagination support** for large workflow lists
- **Metrics collection** for performance monitoring
- **Queue management** for load balancing
- **Vector similarity matching** for optimal agent assignment

## Future Enhancements

- Real-time workflow monitoring with WebSocket connections
- Workflow template system for common patterns
- Integration with external CI/CD systems
- Advanced scheduling and cron-like triggers
- Workflow composition and dependency management