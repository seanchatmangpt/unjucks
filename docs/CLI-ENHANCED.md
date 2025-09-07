# Enhanced Unjucks CLI Commands

## Overview

The Unjucks CLI has been enhanced with advanced capabilities through MCP (Model Context Protocol) integration, providing semantic validation, AI swarm orchestration, workflow automation, performance analysis, and GitHub integration.

## Semantic Commands

### `unjucks semantic validate`

Perform SHACL (Shapes Constraint Language) validation on RDF data.

```bash
# Validate RDF data against SHACL shapes
unjucks semantic validate --data templates/data/users.ttl --shapes templates/shapes/user-shape.ttl

# Validate with custom output format
unjucks semantic validate --data data.ttl --shapes shape.ttl --format json

# Batch validation of multiple files
unjucks semantic validate --directory templates/data --shapes-dir templates/shapes
```

**MCP Tool Mapping**: `mcp__claude-flow__semantic_validate`

**Options**:
- `--data, -d` - RDF data file or directory
- `--shapes, -s` - SHACL shapes file or directory
- `--format, -f` - Output format (text, json, turtle)
- `--verbose, -v` - Detailed validation reports

### `unjucks semantic reason`

Apply reasoning rules to RDF data using SPARQL inference.

```bash
# Apply reasoning rules to infer new triples
unjucks semantic reason --data templates/data/ontology.ttl --rules templates/rules/inference.sparql

# Custom reasoning with output file
unjucks semantic reason --data data.ttl --rules rules.sparql --output inferred.ttl

# Reason with multiple rule sets
unjucks semantic reason --data data.ttl --rules-dir templates/rules
```

**MCP Tool Mapping**: `mcp__claude-flow__semantic_reason`

**Options**:
- `--data, -d` - Input RDF data
- `--rules, -r` - SPARQL inference rules
- `--output, -o` - Output file for inferred triples
- `--format, -f` - Output format (turtle, json-ld, n-triples)

### `unjucks semantic query`

Execute SPARQL queries against RDF datasets.

```bash
# Execute SPARQL SELECT query
unjucks semantic query --data templates/data/users.ttl --query "SELECT ?name WHERE { ?user foaf:name ?name }"

# Query from file with results formatting
unjucks semantic query --data data.ttl --query-file queries/users.sparql --format table

# Federated query across multiple datasets
unjucks semantic query --datasets "data1.ttl,data2.ttl" --query-file complex-query.sparql
```

**MCP Tool Mapping**: `mcp__claude-flow__semantic_query`

**Options**:
- `--data, -d` - RDF dataset(s)
- `--query, -q` - Inline SPARQL query
- `--query-file, -f` - SPARQL query file
- `--format` - Results format (table, json, csv, xml)
- `--limit, -l` - Result limit

### `unjucks semantic orchestrate`

Orchestrate complex semantic workflows with AI agents.

```bash
# Orchestrate data validation and reasoning workflow
unjucks semantic orchestrate --workflow templates/workflows/data-pipeline.yaml

# Custom orchestration with swarm coordination
unjucks semantic orchestrate --task "validate and enrich user data" --agents 3 --strategy adaptive
```

**MCP Tool Mapping**: `mcp__claude-flow__task_orchestrate`

**Options**:
- `--workflow, -w` - Workflow definition file
- `--task, -t` - Task description for orchestration
- `--agents, -a` - Number of agents to deploy
- `--strategy` - Orchestration strategy (parallel, sequential, adaptive)

## Swarm Commands

### `unjucks swarm init`

Initialize AI swarm with specified topology for collaborative development.

```bash
# Initialize hierarchical swarm
unjucks swarm init --topology hierarchical --max-agents 8

# Mesh topology for peer-to-peer coordination
unjucks swarm init --topology mesh --strategy balanced

# Star topology with central coordinator
unjucks swarm init --topology star --strategy specialized
```

**MCP Tool Mapping**: `mcp__claude-flow__swarm_init`

**Options**:
- `--topology, -t` - Swarm topology (hierarchical, mesh, ring, star)
- `--max-agents, -m` - Maximum number of agents
- `--strategy, -s` - Distribution strategy (balanced, specialized, adaptive)

### `unjucks swarm spawn`

Create specialized AI agents for specific development tasks.

```bash
# Spawn code analysis agent
unjucks swarm spawn --type code-analyzer --name "semantic-analyzer"

# Create multiple specialized agents
unjucks swarm spawn --type researcher --capabilities "semantic-web,rdf-analysis"
unjucks swarm spawn --type coder --capabilities "typescript,template-engine"
unjucks swarm spawn --type tester --capabilities "bdd,integration-testing"

# Spawn agent with custom configuration
unjucks swarm spawn --type optimizer --config templates/configs/optimizer.json
```

**MCP Tool Mapping**: `mcp__claude-flow__agent_spawn`

**Options**:
- `--type, -t` - Agent type (researcher, coder, tester, optimizer, coordinator)
- `--name, -n` - Custom agent identifier
- `--capabilities, -c` - Comma-separated capabilities list
- `--config` - Agent configuration file

### `unjucks swarm orchestrate`

Orchestrate complex tasks across the AI swarm.

```bash
# Orchestrate template generation workflow
unjucks swarm orchestrate --task "Generate complete CRUD API templates with semantic validation"

# High-priority orchestration with parallel execution
unjucks swarm orchestrate --task "Refactor template engine for RDF support" --priority high --strategy parallel

# Orchestrate with agent constraints
unjucks swarm orchestrate --task "Implement GraphQL resolver templates" --max-agents 5 --strategy adaptive
```

**MCP Tool Mapping**: `mcp__claude-flow__task_orchestrate`

**Options**:
- `--task, -t` - Task description
- `--priority, -p` - Task priority (low, medium, high, critical)
- `--strategy, -s` - Execution strategy (parallel, sequential, adaptive)
- `--max-agents, -m` - Maximum agents to use

## Workflow Commands

### `unjucks workflow create`

Define reusable workflows with event-driven processing.

```bash
# Create workflow from template
unjucks workflow create --name "semantic-validation-pipeline" --template validation

# Create custom workflow with steps
unjucks workflow create --name "api-generation" --steps templates/workflows/api-steps.yaml

# Interactive workflow creation
unjucks workflow create --interactive
```

**MCP Tool Mapping**: `mcp__claude-flow__workflow_create`

**Options**:
- `--name, -n` - Workflow name
- `--template, -t` - Workflow template
- `--steps, -s` - Steps definition file
- `--triggers` - Event triggers configuration
- `--interactive, -i` - Interactive creation mode

### `unjucks workflow execute`

Execute defined workflows with input parameters.

```bash
# Execute workflow with parameters
unjucks workflow execute --workflow semantic-pipeline --input '{"dataFile": "users.ttl"}'

# Asynchronous execution with monitoring
unjucks workflow execute --workflow api-generation --async --monitor

# Execute with custom agent assignment
unjucks workflow execute --workflow complex-task --agent-type specialized
```

**MCP Tool Mapping**: `mcp__claude-flow__workflow_execute`

**Options**:
- `--workflow, -w` - Workflow ID or name
- `--input, -i` - Input parameters (JSON)
- `--async, -a` - Execute asynchronously
- `--monitor, -m` - Enable real-time monitoring
- `--agent-type` - Preferred agent type for execution

### `unjucks workflow monitor`

Monitor workflow execution with real-time updates.

```bash
# Monitor specific workflow execution
unjucks workflow monitor --execution-id exec-123

# Monitor all workflows with metrics
unjucks workflow monitor --all --include-metrics

# Real-time dashboard mode
unjucks workflow monitor --dashboard --refresh-interval 5
```

**MCP Tool Mapping**: `mcp__claude-flow__workflow_status`

**Options**:
- `--execution-id, -e` - Specific execution to monitor
- `--all, -a` - Monitor all active workflows
- `--include-metrics, -m` - Include performance metrics
- `--dashboard, -d` - Dashboard view mode
- `--refresh-interval` - Update interval in seconds

## Performance Commands

### `unjucks perf analyze`

Analyze performance bottlenecks in templates and generation processes.

```bash
# Analyze template performance
unjucks perf analyze --template templates/api --metrics rendering,file-io

# System-wide performance analysis
unjucks perf analyze --system --duration 300

# Analyze specific component performance
unjucks perf analyze --component semantic-engine --detailed
```

**MCP Tool Mapping**: `mcp__claude-flow__bottleneck_analyze`

**Options**:
- `--template, -t` - Specific template to analyze
- `--system, -s` - System-wide analysis
- `--component, -c` - Specific component analysis
- `--metrics, -m` - Metrics to collect
- `--duration, -d` - Analysis duration in seconds
- `--detailed` - Detailed analysis report

### `unjucks perf benchmark`

Run performance benchmarks on generation processes.

```bash
# Benchmark template rendering
unjucks perf benchmark --suite template-rendering --iterations 100

# Custom benchmark with comparison
unjucks perf benchmark --template api-generator --compare-with baseline

# Comprehensive system benchmark
unjucks perf benchmark --comprehensive --output-format json
```

**MCP Tool Mapping**: `mcp__claude-flow__benchmark_run`

**Options**:
- `--suite, -s` - Benchmark suite to run
- `--template, -t` - Template to benchmark
- `--iterations, -i` - Number of iterations
- `--compare-with` - Baseline for comparison
- `--comprehensive` - Run all benchmark suites
- `--output-format` - Output format (text, json, csv)

### `unjucks perf optimize`

Apply performance optimizations based on analysis.

```bash
# Auto-optimize based on analysis
unjucks perf optimize --auto --target template-engine

# Apply specific optimizations
unjucks perf optimize --optimizations caching,parallel-processing

# Optimize with validation
unjucks perf optimize --validate --dry-run
```

**MCP Tool Mapping**: `mcp__claude-flow__daa_optimization`

**Options**:
- `--auto, -a` - Automatic optimization
- `--target, -t` - Optimization target
- `--optimizations, -o` - Specific optimizations to apply
- `--validate, -v` - Validate optimizations
- `--dry-run` - Preview optimizations without applying

## GitHub Commands

### `unjucks github analyze`

Analyze GitHub repositories for code quality and patterns.

```bash
# Analyze repository structure and quality
unjucks github analyze --repo owner/repo --analysis-type code_quality

# Security analysis
unjucks github analyze --repo owner/repo --analysis-type security --depth comprehensive

# Performance analysis with recommendations
unjucks github analyze --repo owner/repo --analysis-type performance --output-format detailed
```

**MCP Tool Mapping**: `mcp__claude-flow__github_repo_analyze`

**Options**:
- `--repo, -r` - Repository (owner/repo format)
- `--analysis-type, -t` - Analysis type (code_quality, performance, security)
- `--depth` - Analysis depth (basic, comprehensive)
- `--output-format` - Output format (summary, detailed, json)

### `unjucks github pr review`

AI-powered code review for pull requests.

```bash
# Review specific pull request
unjucks github pr review --repo owner/repo --pr 123

# Automated review with suggestions
unjucks github pr review --repo owner/repo --pr 123 --auto-suggest --focus security

# Batch review multiple PRs
unjucks github pr review --repo owner/repo --prs 123,124,125 --parallel
```

**MCP Tool Mapping**: `mcp__claude-flow__github_code_review`

**Options**:
- `--repo, -r` - Repository name
- `--pr` - Pull request number
- `--prs` - Multiple PR numbers (comma-separated)
- `--auto-suggest` - Generate improvement suggestions
- `--focus` - Review focus area (security, performance, style)
- `--parallel` - Review multiple PRs in parallel

### `unjucks github issue solve`

Generate solutions and implementations for GitHub issues.

```bash
# Generate solution for specific issue
unjucks github issue solve --repo owner/repo --issue 456

# Batch solve multiple issues
unjucks github issue solve --repo owner/repo --issues 456,457,458 --strategy parallel

# Generate implementation with tests
unjucks github issue solve --repo owner/repo --issue 456 --include-tests --create-pr
```

**MCP Tool Mapping**: `mcp__claude-flow__github_issue_track`

**Options**:
- `--repo, -r` - Repository name
- `--issue` - Issue number
- `--issues` - Multiple issue numbers
- `--strategy` - Solution strategy (parallel, sequential)
- `--include-tests` - Generate test cases
- `--create-pr` - Create pull request with solution

## Global Options

All enhanced commands support these global options:

- `--config, -c` - Configuration file path
- `--verbose, -v` - Verbose output
- `--dry-run` - Preview actions without execution
- `--output, -o` - Output file or directory
- `--format, -f` - Output format
- `--help, -h` - Display command help

## Configuration

Enhanced CLI commands can be configured via `unjucks.config.ts`:

```typescript
export default {
  semantic: {
    defaultNamespace: 'https://example.org/vocab#',
    shaclValidation: true,
    reasoningRules: 'templates/rules'
  },
  swarm: {
    defaultTopology: 'mesh',
    maxAgents: 8,
    strategy: 'adaptive'
  },
  performance: {
    benchmarkSuites: ['template-rendering', 'file-io', 'semantic-processing'],
    optimizationTargets: ['memory', 'cpu', 'io']
  },
  github: {
    token: process.env.GITHUB_TOKEN,
    defaultAnalysis: 'comprehensive'
  }
}
```

## Examples

### Complete Semantic Workflow

```bash
# 1. Initialize swarm for semantic processing
unjucks swarm init --topology hierarchical --max-agents 6

# 2. Validate RDF data
unjucks semantic validate --data templates/data --shapes templates/shapes --format json

# 3. Apply reasoning rules
unjucks semantic reason --data templates/data/ontology.ttl --rules templates/rules

# 4. Query enriched data
unjucks semantic query --data enriched-data.ttl --query-file templates/queries/report.sparql

# 5. Generate templates with semantic context
unjucks generate api --with-semantic-validation --context enriched-data.ttl
```

### AI-Powered Development Workflow

```bash
# 1. Analyze repository
unjucks github analyze --repo myorg/project --analysis-type code_quality

# 2. Initialize development swarm
unjucks swarm init --topology mesh --strategy adaptive

# 3. Orchestrate feature development
unjucks swarm orchestrate --task "Implement GraphQL API with semantic validation" --priority high

# 4. Monitor performance
unjucks perf analyze --system --duration 600

# 5. Optimize based on analysis
unjucks perf optimize --auto --validate
```

## Integration with Standard Commands

Enhanced commands integrate seamlessly with standard Unjucks commands:

```bash
# Standard generation with semantic enhancement
unjucks generate api --name UserAPI --with-semantic --validate-rdf

# List generators with swarm-generated templates
unjucks list --include-generated --source swarm

# Help with AI-powered suggestions
unjucks help generate --ai-suggestions --context semantic
```

## Error Handling and Debugging

Enhanced commands provide detailed error reporting and debugging capabilities:

- `--debug` - Enable debug mode with detailed logging
- `--trace` - Full execution trace
- `--error-report` - Generate error reports for complex failures
- `--recovery-mode` - Attempt automatic error recovery

## Performance and Monitoring

All enhanced commands support:

- Real-time progress indicators
- Performance metrics collection
- Resource usage monitoring
- Execution time tracking
- Memory usage analysis

For more information on specific commands, use `unjucks <command> --help` or refer to the individual command documentation.