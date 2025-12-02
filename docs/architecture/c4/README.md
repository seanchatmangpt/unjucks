# Unjucks V4 C4 Architecture Diagrams

This directory contains PlantUML C4 architecture diagrams for unjucks v4, a clean refactor with no v3 source code or backwards compatibility.

## Diagrams

### 1. Context Diagram (`01-context-diagram.puml`)
Shows the system context of unjucks v4, including:
- **Actors**: Developer, CI/CD System
- **External Systems**: File System, RDF Data Sources, Template Repositories
- **Relationships**: How unjucks v4 interacts with users and external systems

### 2. Container Diagram (`02-container-diagram.puml`)
Shows the main containers within unjucks v4:
- **CLI**: Command-line interface
- **Core Engine**: Orchestration and workflow coordination
- **Template Engine**: Template rendering and processing
- **RDF Engine**: RDF data processing (parsing, SPARQL, reasoning, validation)
- **File Operations**: File system operations (write, inject, append, prepend, lineAt)

### 3. Component Diagram (`03-component-diagram.puml`)
Shows detailed components within the Template Engine container:
- **Frontmatter Parser**: YAML frontmatter parsing and validation
- **Nunjucks Renderer**: Template rendering with context and filters
- **Hygen Generator**: Hygen-style generator/action/file pattern matching
- **RDF Integration**: RDF context builder for templates
- **Variable Extractor**: Variable detection and type inference
- **Path Resolver**: Dynamic path resolution using Nunjucks templating
- **Operation Engine**: File operation executor
- **Filter Registry**: Nunjucks filter catalog management
- **Conditional Processor**: Condition evaluation (skipIf, etc.)

### 4. Dynamic Diagram (`04-dynamic-diagram.puml`)
Shows the template processing flow from user command to file generation, including Dark Matter optimization:
1. CLI receives command
2. Core Engine orchestrates workflow
3. Hygen Generator discovers templates
4. Frontmatter Parser extracts configuration
5. Conditional Processor evaluates skip conditions
6. RDF Integration loads semantic data (if configured)
   - **Dark Matter**: Query Analyzer analyzes SPARQL queries
   - **Critical Path**: Identifies 20% of queries causing 80% of latency
   - **Optimization**: Dark Matter Optimizer optimizes critical queries
7. Variable Extractor scans for variables
8. Path Resolver resolves output paths
9. **Performance Optimizer**: Identifies critical paths and checks cache
10. Nunjucks Renderer renders template (using optimized path)
11. Operation Engine executes file operations

### 5. Dark Matter 80/20 Framework Diagram (`05-dark-matter-80-20-diagram.puml`)
Shows the Dark Matter 80/20 optimization framework:
- **Knowledge Substrate Core**: Essential 20% of components delivering 80% of value
- **Dark Matter Query Optimization**: Identifies and optimizes 20% of queries causing 80% of performance issues
- **Performance Optimization Layer (Dark Energy)**: Caching, batching, and path optimization
- **Dark Matter Validation**: Tests 20% of edge cases that cause 80% of production failures

### 6. Frontmatter Architecture Component Diagram (`06-frontmatter-architecture.puml`)
Shows the detailed component architecture of the frontmatter parsing and execution system:
- **Parser Layer**: 4 parser implementations (Deterministic, Enhanced, Document, Advanced)
- **Execution Layer**: Rendering, operations, conditionals, workflows, path resolution
- **Integration Layer**: CLI, resolver, variable resolution, template bridge, office processors
- **Validation Layer**: Schema validation, metadata extraction, provenance tracking
- **Support Layer**: Error handling, caching, performance monitoring
- **Relationships**: Complete component interactions and data flows

### 7. Frontmatter Container Diagram (`07-frontmatter-containers.puml`)
Shows the high-level container architecture of the frontmatter system:
- **Parser Container**: Multiple parser implementations
- **Execution Container**: Template processing and file operations
- **Integration Container**: System integrations (CLI, resolver, etc.)
- **Validation Container**: Validation and metadata services
- **Support Container**: Supporting services (error handling, caching, monitoring)
- **External Systems**: File system, RDF sources, template repository

### 8. Frontmatter Dynamic Diagram (`08-frontmatter-dynamic.puml`)
Shows the dynamic execution flow of frontmatter processing:
1. Developer executes CLI command
2. Workflow Engine initiates processing
3. Frontmatter Parser extracts frontmatter
4. Metadata Extractor extracts comprehensive metadata
5. Schema Validator validates frontmatter
6. Conditional Processor evaluates skipIf conditions
7. Path Resolver resolves output paths dynamically
8. Operation Engine executes file operations (write/inject/append/prepend/lineAt)
9. File System receives generated artifacts
10. Results returned to developer

## Viewing the Diagrams

### Using PlantUML

1. **VS Code**: Install the "PlantUML" extension
2. **Online**: Use [PlantUML Web Server](http://www.plantuml.com/plantuml/uml/)
3. **CLI**: Install PlantUML and run:
   ```bash
   plantuml docs/architecture/c4/*.puml
   ```

### Using C4-PlantUML

These diagrams use the C4-PlantUML library which is automatically included via the `!include` directive. No local installation needed.

## Architecture Principles

- **Clean v4 refactor**: No v3 source code, no backwards compatibility
- **Frontmatter-driven**: YAML frontmatter controls template processing
- **Nunjucks rendering**: Uses Nunjucks as the template engine
- **Hygen patterns**: Supports Hygen-style generator/action/file structure
- **RDF integration**: Full support for RDF data sources, SPARQL queries, reasoning, and validation
- **Modular design**: Clear separation of concerns between containers and components

## Key Features

- **Template Discovery**: Hygen-style `_templates/{generator}/{action}/` structure
- **Frontmatter Processing**: YAML configuration for paths, operations, conditions
- **RDF Support**: Load RDF data, execute SPARQL queries, apply reasoning rules
- **Variable Extraction**: Automatic detection and type inference
- **Multiple File Operations**: write, inject, append, prepend, lineAt
- **Conditional Processing**: skipIf conditions for conditional generation

## Dark Matter 80/20 Framework

Unjucks v4 implements the Dark Matter 80/20 framework for optimization:

### Core Principles

1. **80/20 Value Delivery**: Focus on the 20% of components that deliver 80% of value
2. **Dark Matter Queries**: Identify and optimize the 20% of queries causing 80% of performance issues
3. **Dark Energy Optimization**: Performance layer that optimizes critical paths
4. **Dark Matter Validation**: Test the 20% of edge cases that cause 80% of production failures

### Components

- **Knowledge Substrate Core**: Essential components (Transaction Manager, Hook Manager, Effect Sandbox, Observability, Performance Optimizer, Lockchain Writer)
- **Query Analyzer**: Analyzes SPARQL query complexity
- **Critical Path Identifier**: Identifies the 20% of operations causing 80% of latency
- **Dark Matter Optimizer**: Optimizes critical queries using 80/20 rules
- **Performance Optimizer**: Optimizes critical execution paths
- **Cache Manager**: Content-addressed caching with 80/20 strategy
- **Edge Case Validators**: Unicode, malformed input, performance stress, security, encoding validators

