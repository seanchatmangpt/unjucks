# CLI Reference Guide

## Overview

Unjucks provides 47+ commands organized into logical groups for template generation, semantic processing, MCP coordination, and system management.

## Command Structure

```bash
unjucks <command> [subcommand] [options]
# or Hygen-style positional syntax:
unjucks <generator> <template> [args...]
```

## Core Commands

### generate
Generate files from templates with intelligent scaffolding.

**Usage:**
```bash
unjucks generate <generator> <template> [args...]
unjucks <generator> <template> [args...]  # Hygen-style shorthand
```

**Arguments:**
- `generator` - Name of the generator to use (e.g., component, api, model)
- `template` - Template within the generator (e.g., react, express, sequelize)  
- `name` - Name/identifier for the generated entity

**Options:**
- `--dest <path>` - Destination directory (default: ".")
- `--force` - Overwrite existing files without confirmation
- `--dry` - Preview mode - show what would be generated without creating files
- `--backup` - Create backup copies of existing files before overwriting
- `--skip-prompts, -y` - Skip interactive prompts and use defaults
- `--verbose, -v` - Enable verbose logging with detailed progress information
- `--quiet, -q` - Suppress non-essential output

**Examples:**
```bash
# Interactive mode
unjucks generate

# Direct generation with Hygen-style syntax
unjucks component react MyButton --withTests --dest src/components

# Explicit syntax
unjucks generate api express UserService --auth --database postgresql

# Dry run to preview
unjucks generate model sequelize User --dry

# Force overwrite with backup
unjucks generate component vue UserCard --force --backup
```

### list
List available generators and templates.

**Usage:**
```bash
unjucks list [generator]
```

**Arguments:**
- `generator` - Optional: Show templates for specific generator

**Examples:**
```bash
unjucks list                    # Show all generators
unjucks list component          # Show templates in component generator
```

### init
Initialize a new project with scaffolding.

**Usage:**
```bash
unjucks init [template]
```

**Arguments:**
- `template` - Project template to initialize

**Options:**
- `--name <name>` - Project name
- `--dest <path>` - Destination directory

**Examples:**
```bash
unjucks init                    # Interactive initialization
unjucks init fullstack-app      # Initialize with specific template
```

### inject
Inject or modify content in existing files.

**Usage:**
```bash
unjucks inject <generator> <template> [options]
```

**Options:**
- `--target <file>` - Target file to modify
- `--before <pattern>` - Insert before matching pattern
- `--after <pattern>` - Insert after matching pattern
- `--line-at <number>` - Insert at specific line number
- `--skip-if <condition>` - Skip injection if condition is met

**Examples:**
```bash
unjucks inject route express users --target app.js --after "// Routes"
unjucks inject import react useState --target Component.jsx --line-at 3
```

### version
Show version information.

**Usage:**
```bash
unjucks version
unjucks --version
unjucks -v
```

### help
Show template variable help.

**Usage:**
```bash
unjucks help <generator> <template>
```

**Examples:**
```bash
unjucks help component react    # Show variables for react component template
```

## Semantic Commands

### semantic generate
Generate code from RDF/OWL ontologies with semantic awareness.

**Usage:**
```bash
unjucks semantic generate [options]
```

**Options:**
- `--ontology, -o <file>` - Path to RDF/OWL ontology file
- `--templates, -t <dir>` - Template directory path (default: "_templates")
- `--output, --out <dir>` - Output directory (default: "./generated")
- `--enterprise, -e` - Enable enterprise scaffolding (APIs, forms, tests)
- `--types` - Generate TypeScript interfaces (default: true)
- `--schemas` - Generate Zod validation schemas (default: true)
- `--validators` - Generate validation helpers (default: true)
- `--tests` - Generate test suites
- `--docs` - Generate documentation
- `--validate` - Validate generated output (default: true)
- `--cross-package` - Enable cross-package type sharing
- `--watch, -w` - Watch for changes and regenerate

**Examples:**
```bash
unjucks semantic generate -o schema.owl --enterprise
unjucks semantic generate --ontology user.ttl --output ./generated --tests --docs
```

### semantic types
Generate TypeScript types from RDF ontology.

**Usage:**
```bash
unjucks semantic types -o <ontology> [options]
```

**Options:**
- `--ontology, -o <file>` - Path to RDF/OWL ontology file (required)
- `--output, --out <dir>` - Output directory (default: "./types")
- `--schemas, -s` - Also generate Zod schemas (default: true)
- `--validators, -v` - Also generate validation helpers (default: true)

### semantic scaffold
Scaffold complete application from RDF ontology.

**Usage:**
```bash
unjucks semantic scaffold -o <ontology> -n <name> [options]
```

**Options:**
- `--ontology, -o <file>` - Path to RDF/OWL ontology file (required)
- `--name, -n <name>` - Project name (required)
- `--template, -t <type>` - Scaffold template: api, fullstack, component-lib (default: fullstack)
- `--database, --db <type>` - Database type: postgresql, mysql, sqlite (default: postgresql)
- `--auth` - Include authentication system
- `--testing` - Include testing setup (default: true)

### semantic validate
Validate RDF/OWL ontologies with comprehensive semantic analysis.

**Usage:**
```bash
unjucks semantic validate [options]
```

**Options:**
- `--rdf, -r <file>` - Path to RDF/Turtle data file to validate
- `--ontology, -o <file>` - Path to ontology file
- `--generated, -g <dir>` - Path to generated code directory
- `--schema, -s <file>` - Path to custom validation schema
- `--compliance, -c <frameworks>` - Compliance frameworks: SOX,GDPR,HIPAA,API_GOVERNANCE (default: API_GOVERNANCE)
- `--strict` - Strict validation mode (fail on warnings)
- `--format, -f <format>` - Output format: json, turtle, summary (default: json)

### semantic reason
Apply reasoning rules to enhance template context.

**Usage:**
```bash
unjucks semantic reason -v <variables> -r <rules> [options]
```

**Options:**
- `--variables, -v <file>` - JSON file with template variables (required)
- `--rules, -r <files>` - Comma-separated list of N3 rule files (required)
- `--premises, -p <files>` - Comma-separated list of premise TTL files
- `--depth, -d <number>` - Maximum reasoning depth 1-10 (default: 3)
- `--mode, -m <mode>` - Reasoning mode: forward, backward, hybrid (default: forward)
- `--output, -o <file>` - Output enhanced variables to file

### semantic query
Execute SPARQL queries on knowledge graphs.

**Usage:**
```bash
unjucks semantic query [options]
```

**Options:**
- `--sparql, -q <query>` - SPARQL query string
- `--pattern, -p <pattern>` - Simple triple pattern (subject,predicate,object)
- `--knowledge, -k <files>` - Comma-separated knowledge base files
- `--reasoning, -r` - Enable reasoning over results
- `--limit, -l <number>` - Maximum results to return (default: 100)
- `--format, -f <format>` - Output format: json, table, csv, turtle (default: table)

### semantic convert
Convert between RDF formats (TTL, N3, JSON-LD).

**Usage:**
```bash
unjucks semantic convert -i <input> -o <output> -f <from> -t <to> [options]
```

**Options:**
- `--input, -i <file>` - Input file path (required)
- `--output, -o <file>` - Output file path (required)
- `--from, -f <format>` - Input format: turtle, n3, jsonld (required)
- `--to, -t <format>` - Output format: turtle, n3, jsonld (required)
- `--validate, -v` - Validate during conversion (default: true)

### Additional Semantic Commands

The semantic command group includes 20+ additional subcommands:

- `orchestrate` - Orchestrate semantic workflow with multiple steps
- `monitor` - Real-time monitoring of semantic operations
- `benchmark` - Performance benchmarking for semantic operations
- `map` - Cross-ontology mapping and alignment
- `import` - Import RDF data from external sources with format conversion
- `export` - Export RDF data to different formats and destinations
- `merge` - Merge multiple RDF datasets with conflict resolution
- `diff` - Compare RDF datasets and show differences
- `create` - Create new ontology with guided setup
- `infer` - Advanced inference and reasoning with multiple engines
- `federate` - Set up federated knowledge graph endpoints
- `analytics` - Advanced analytics and reporting on semantic data
- `performance` - Enterprise performance metrics and analysis

## Swarm Commands

### swarm init
Initialize multi-agent swarm with specified topology.

**Usage:**
```bash
unjucks swarm init --topology <type> [options]
```

**Options:**
- `--topology <type>` - Swarm topology: hierarchical, mesh, ring, star (required)
- `--max-agents <number>` - Maximum number of agents in swarm (default: 8)
- `--strategy <strategy>` - Agent distribution strategy: balanced, specialized, adaptive (default: balanced)

### swarm agents
Manage swarm agents.

**Usage:**
```bash
unjucks swarm agents <action> [options]
```

**Actions:**
- `list` - List active agents
- `spawn` - Create new agent
- `destroy` - Remove agent
- `status` - Get agent status

### swarm tasks
Orchestrate and manage tasks across swarm.

**Usage:**
```bash
unjucks swarm tasks <action> [options]
```

**Actions:**
- `create` - Create new task
- `status` - Check task status
- `results` - Get task results
- `cancel` - Cancel running task

## Workflow Commands

### workflow create
Create custom development workflows.

**Usage:**
```bash
unjucks workflow create --name <name> [options]
```

**Options:**
- `--name <name>` - Workflow name (required)
- `--template <template>` - Workflow template
- `--steps <steps>` - Workflow steps configuration
- `--triggers <triggers>` - Event triggers for workflow

### workflow run
Execute workflow with specified parameters.

**Usage:**
```bash
unjucks workflow run <workflow-id> [options]
```

**Options:**
- `--params <params>` - Workflow parameters (JSON)
- `--async` - Run workflow asynchronously
- `--monitor` - Monitor workflow execution

## Performance Commands

### perf benchmark
Run performance benchmarks on various operations.

**Usage:**
```bash
unjucks perf benchmark --suite <suite> [options]
```

**Options:**
- `--suite <suite>` - Benchmark suite to run: all, generation, validation, conversion
- `--iterations <number>` - Number of test iterations (default: 10)
- `--output <file>` - Benchmark results output file

### perf monitor
Monitor system performance in real-time.

**Usage:**
```bash
unjucks perf monitor [options]
```

**Options:**
- `--interval <seconds>` - Monitoring interval (default: 5)
- `--metrics <metrics>` - Metrics to track: cpu, memory, disk, network

## GitHub Commands

### github analyze
Analyze GitHub repositories for patterns and insights.

**Usage:**
```bash
unjucks github analyze --repo <repo> [options]
```

**Options:**
- `--repo <repo>` - Repository in format owner/repo (required)
- `--analysis-type <type>` - Analysis type: code_quality, performance, security
- `--output <file>` - Analysis report output file

### github sync
Synchronize with GitHub repository data.

**Usage:**
```bash
unjucks github sync --repo <repo> [options]
```

**Options:**
- `--repo <repo>` - Repository to sync with
- `--branch <branch>` - Specific branch to sync
- `--templates` - Sync template definitions

## Knowledge Commands

### knowledge load
Load and process knowledge bases.

**Usage:**
```bash
unjucks knowledge load <source> [options]
```

**Arguments:**
- `source` - Knowledge source file or URL

**Options:**
- `--format <format>` - Source format: rdf, turtle, owl, json-ld
- `--validate` - Validate knowledge base after loading
- `--index` - Create search index

### knowledge query
Query loaded knowledge bases.

**Usage:**
```bash
unjucks knowledge query --query <query> [options]
```

**Options:**
- `--query <query>` - SPARQL query or natural language query
- `--format <format>` - Output format: json, table, csv
- `--limit <number>` - Maximum results to return

## Neural Commands

### neural train
Train AI/ML neural networks for enhanced processing.

**Usage:**
```bash
unjucks neural train --architecture <arch> [options]
```

**Options:**
- `--architecture <arch>` - Network architecture: transformer, lstm, cnn
- `--tier <tier>` - Training tier: nano, mini, small, medium, large
- `--epochs <number>` - Number of training epochs
- `--data <path>` - Training data path

### neural predict
Run inference on trained models.

**Usage:**
```bash
unjucks neural predict --model <model-id> --input <data> [options]
```

**Options:**
- `--model <model-id>` - ID of trained model (required)
- `--input <data>` - Input data for prediction (required)
- `--format <format>` - Input data format: json, csv, text

## Migration Commands

### migrate
Handle database and project migrations.

**Usage:**
```bash
unjucks migrate <action> [options]
```

**Actions:**
- `create` - Create new migration
- `up` - Apply migrations
- `down` - Rollback migrations
- `status` - Show migration status

**Options:**
- `--name <name>` - Migration name
- `--database <type>` - Database type
- `--dry-run` - Preview migration without applying

## Global Options

These options are available for all commands:

- `--help, -h` - Show help information
- `--version, -v` - Show version information
- `--verbose` - Enable verbose output
- `--quiet, -q` - Suppress non-essential output
- `--config <file>` - Use custom configuration file
- `--dry-run` - Preview mode (where applicable)
- `--force` - Force operation without confirmation (where applicable)

## Configuration

Commands can be configured via:

1. **Configuration file**: `unjucks.config.ts` or `unjucks.config.js`
2. **Environment variables**: `UNJUCKS_*` prefix
3. **Command-line flags**: Override configuration
4. **Interactive prompts**: For missing required values

## Error Handling

All commands provide:

- **Descriptive error messages** with context
- **Suggestions for resolution** 
- **Exit codes** for scripting (0 = success, >0 = error)
- **Stack traces** in verbose mode
- **Validation results** with detailed feedback

## Examples

### Basic Template Generation
```bash
# Interactive mode
unjucks generate

# Direct generation
unjucks component react UserProfile --withTests --dest src/components

# Dry run
unjucks api express UserAPI --dry --verbose
```

### Semantic Processing
```bash
# Generate from ontology
unjucks semantic generate --ontology user.owl --enterprise --output ./generated

# Validate RDF data
unjucks semantic validate --rdf data.ttl --compliance GDPR,HIPAA --strict

# Run SPARQL query
unjucks semantic query --sparql "SELECT ?s ?p ?o WHERE { ?s ?p ?o } LIMIT 10"
```

### Swarm Coordination
```bash
# Initialize swarm
unjucks swarm init --topology mesh --max-agents 10

# Create coordinated task
unjucks swarm tasks create --task "Analyze codebase and generate tests"
```

### Performance Analysis
```bash
# Run benchmarks
unjucks perf benchmark --suite all --iterations 20 --output benchmark-results.json

# Monitor performance
unjucks perf monitor --metrics cpu,memory,disk --interval 10
```