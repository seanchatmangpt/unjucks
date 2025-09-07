# Unjucks CLI Commands Overview

The Unjucks CLI provides a comprehensive set of commands for template-based code generation, workflow automation, and swarm coordination. This document maps all available commands and their capabilities.

## Core Commands

### `unjucks generate`
**Main generation command with intelligent scaffolding**

**Features:**
- Interactive generator and template selection
- Intelligent positional argument parsing (Hygen-style)
- Dry run support with detailed preview
- Force overwrite with confirmation
- Template variable validation
- Backup creation for existing files
- Comprehensive error handling

**Usage:**
```bash
# Interactive mode
unjucks generate

# Direct generation
unjucks generate component react MyButton --withTests --dest src/components

# Dry run to preview
unjucks generate api express UserService --dry

# Force overwrite with backup
unjucks generate model sequelize User --force --backup
```

**Arguments:**
- `generator` (positional): Name of the generator to use
- `template` (positional): Name of the template within the generator  
- `name` (positional): Name/identifier for the generated entity
- `--dest`: Destination directory for generated files
- `--force`: Overwrite existing files without confirmation
- `--dry`: Preview mode - show what would be generated
- `--backup`: Create backup copies of existing files
- `--skip-prompts, -y`: Skip interactive prompts
- `--verbose, -v`: Enable verbose logging
- `--quiet, -q`: Suppress non-essential output

### `unjucks list`
**Display available generators and templates with filtering**

**Features:**
- List all generators or specific generator templates
- Multiple output formats (table, JSON, YAML, simple)
- Search and category filtering
- Sorting by name, date, or usage statistics
- Detailed view with template variables
- Usage statistics and metadata

**Usage:**
```bash
# List all generators
unjucks list

# List templates for specific generator
unjucks list component

# Search generators
unjucks list --search react

# JSON output for automation
unjucks list --format json

# Detailed view with variables
unjucks list --detailed
```

**Arguments:**
- `generator` (positional, optional): Specific generator to list templates for
- `--category, -c`: Filter by category
- `--search, -s`: Search generators/templates by name or description
- `--format, -f`: Output format (table, json, yaml, simple)
- `--sort`: Sort results by field (name, modified, created, usage)
- `--direction, -d`: Sort direction (asc/desc)
- `--detailed, -D`: Show detailed information including template variables
- `--stats`: Include usage statistics in output
- `--quiet, -q`: Suppress headers and formatting
- `--verbose, -v`: Show verbose output with additional metadata

## Advanced Commands

### `unjucks workflow`
**Advanced development workflow automation with event-driven processing**

**Features:**
- Event-driven workflow execution
- Multi-agent task orchestration  
- Real-time monitoring and metrics
- Template-based workflow creation
- MCP integration for swarm coordination
- Persistent execution history
- Artifact management and tracking

**Subcommands:**

#### `workflow create`
Create a new workflow from template or interactive builder

```bash
# Create a new CI/CD workflow
unjucks workflow create --type cicd --name "Frontend Build" --output ./workflows/

# Interactive workflow builder
unjucks workflow create --interactive --name "API Development"
```

#### `workflow execute`
Execute a workflow with optional input parameters

```bash
# Execute workflow with custom parameters
unjucks workflow execute ./workflows/api-development.yaml --input '{"service":"users"}'

# Background execution with monitoring
unjucks workflow execute workflow.yaml --async --monitor
```

#### `workflow list`
List all workflows and their execution status

```bash
# List all workflows
unjucks workflow list --status running --detailed

# Show workflows in specific directory
unjucks workflow list --directory ./custom-workflows
```

#### `workflow monitor`
Monitor workflow execution in real-time

```bash
# Monitor specific execution
unjucks workflow monitor workflow-123 --follow --format table

# Monitor with custom interval
unjucks workflow monitor execution-456 --interval 2
```

#### `workflow analytics`
Get comprehensive workflow analytics and performance metrics

```bash
# Performance analytics for last 24 hours
unjucks workflow analytics --timeframe 24h --includeBottlenecks

# Specific workflow analysis
unjucks workflow analytics --workflowId api-workflow --includeTrends
```

#### `workflow optimize`
Analyze and optimize workflow performance

```bash
# Auto-optimize for speed
unjucks workflow optimize --target speed --auto

# Dry run optimization analysis
unjucks workflow optimize --workflowId my-workflow --dryRun
```

### `unjucks swarm`
**Enhanced AI swarm orchestration with neural networks and DAA capabilities**

**Features:**
- Advanced swarm initialization with neural and DAA features
- Sophisticated agent lifecycle management
- Topology optimization and auto-scaling
- Neural pattern training and cognitive modeling
- Decentralized Autonomous Agent (DAA) coordination
- Real-time monitoring and health checks
- Memory management and cross-session persistence
- Performance benchmarking and optimization

**Subcommands:**

#### `swarm init`
Initialize advanced AI swarm

```bash
# Initialize advanced swarm with neural training
unjucks swarm init --topology mesh --agents 8 --neural --daa --monitoring
```

#### `swarm agent spawn`
Spawn new agent with enhanced configuration

```bash
# Spawn specialized agent
unjucks swarm agent spawn backend-dev --cognitive lateral --autonomy 0.8
```

#### `swarm neural cluster`
Create distributed neural network cluster

```bash
# Create neural cluster
unjucks swarm neural cluster "distributed-ai" --topology mesh --nodes 5
```

#### `swarm monitor`
Real-time swarm monitoring

```bash
# Monitor swarm with real-time metrics
unjucks swarm monitor --real-time --detailed --export-metrics
```

### `unjucks github`
**GitHub integration and repository management with MCP support**

**Features:**
- Repository analysis for code quality, security, performance
- Pull request management and automated reviews
- Issue tracking and triage management
- Release coordination and automation
- Multi-repository synchronization
- GitHub Actions workflow automation
- Repository statistics and metrics

**Subcommands:**

#### `github analyze`
Analyze GitHub repository

```bash
# Analyze code quality
unjucks github analyze --repo owner/repo --type code_quality --clone

# Security analysis
unjucks github analyze --repo owner/repo --type security --output json
```

#### `github pr`
Pull request management

```bash
# List pull requests
unjucks github pr list --repo owner/repo

# Automated review
unjucks github pr review --repo owner/repo --number 123 --auto
```

#### `github issues`
Issue tracking and management

```bash
# Auto-triage issues
unjucks github issues triage --repo owner/repo

# Create new issue
unjucks github issues create --repo owner/repo --title "Bug Report" --labels "bug,priority-high"
```

### `unjucks mcp`
**Model Context Protocol server management and tools**

**Features:**
- MCP server management
- Tool discovery and execution
- External server connections
- Protocol validation and testing

**Subcommands:**

#### `mcp server`
Start the Unjucks MCP server

```bash
# Start MCP server in STDIO mode
unjucks mcp server

# Start with debug logging
unjucks mcp server --debug --timeout 120000
```

#### `mcp list-tools`
List all available MCP tools

```bash
# List all tools
unjucks mcp list-tools

# Detailed tool information
unjucks mcp list-tools --detailed --category core
```

#### `mcp connect`
Connect to external MCP servers

```bash
# Connect to Claude Flow
unjucks mcp connect claude-flow

# Execute command on external server
unjucks mcp connect ruv-swarm --command swarm_init --args '{"topology":"mesh"}'
```

## Command Structure and Patterns

### Interactive Modes
Many commands support interactive modes when required parameters are missing:
- Generator/template selection with `inquirer` prompts
- Dynamic command generation with variable prompting
- Confirmation dialogs for destructive operations

### Variable Prompting System
The CLI uses an intelligent variable prompting system:
- Scans templates for `{{ variables }}` and filename patterns
- Generates CLI flags dynamically based on discovered variables
- Supports type inference (string, boolean, number)
- Validates required vs optional variables

### Output Formats
Most commands support multiple output formats:
- **table**: Human-readable tabular output (default)
- **json**: Machine-readable JSON for automation
- **yaml**: YAML format for configuration files
- **simple**: Plain text output for scripting

### Error Handling and Validation
- Comprehensive input validation with helpful error messages
- Suggestion system for common mistakes
- Graceful degradation when optional features are unavailable
- Detailed error reporting with troubleshooting tips

### Dry Run and Preview Modes
- `--dry` flag available on destructive operations
- Shows detailed preview of what would be generated/modified
- File size calculations and action summaries
- Content previews for generated files

## Integration Points

### MCP Integration
Commands integrate with Model Context Protocol for:
- AI assistant tool execution
- Cross-system coordination
- Advanced orchestration capabilities

### Template System Integration
- Dynamic discovery of generators and templates
- Variable extraction and validation
- Frontmatter parsing for injection modes
- File system operations with safety checks

### Coordination Protocols
Agent spawned via Task Tool must use coordination hooks:

**Before Work:**
```bash
npx claude-flow@alpha hooks pre-task --description "[task]"
npx claude-flow@alpha hooks session-restore --session-id "swarm-[id]"
```

**During Work:**
```bash
npx claude-flow@alpha hooks post-edit --file "[file]" --memory-key "swarm/[agent]/[step]"
npx claude-flow@alpha hooks notify --message "[what was done]"
```

**After Work:**
```bash
npx claude-flow@alpha hooks post-task --task-id "[task]"
npx claude-flow@alpha hooks session-end --export-metrics true
```

This comprehensive CLI system provides powerful capabilities for template-based development, workflow automation, and multi-agent coordination while maintaining usability and extensibility.