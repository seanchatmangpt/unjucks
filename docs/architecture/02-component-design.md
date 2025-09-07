# Component Design

## Architecture Overview

Unjucks follows a layered architecture with clear separation of concerns. Each component has well-defined responsibilities and interfaces, enabling independent development, testing, and deployment.

```
┌────────────────────────────────────────────────────────────────────┐
│                        Component Interaction                           │
├────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  ┌─────────────────┐        CLI Layer         ┌─────────────────┐  │
│  │ Citty Framework │ ◄─────────────────► │ Argument Parser │  │
│  ├─────────────────┤                       ├─────────────────┤  │
│  │ Command Router  │ ◄─────────────────► │ Help System     │  │
│  └────────┬────────┘                       └────────┬────────┘  │
│           │                                                │           │
│           ▼                                                ▼           │
│  ┌─────────────────┐      MCP Layer       ┌─────────────────┐  │
│  │ Claude Flow     │ ◄─────────────────► │ Task Orchestrat.│  │
│  ├─────────────────┤                       ├─────────────────┤  │
│  │ Shared Memory   │ ◄─────────────────► │ Semantic Server │  │
│  └────────┬────────┘                       └────────┬────────┘  │
│           │                                                │           │
│           ▼                                                ▼           │
│  ┌─────────────────┐      Core Engine     ┌─────────────────┐  │
│  │ Template Engine │ ◄─────────────────► │ Frontmatter Par.│  │
│  ├─────────────────┤                       ├─────────────────┤  │
│  │ File Operations │ ◄─────────────────► │ Variable Enhanc.│  │
│  └────────┬────────┘                       └────────┬────────┘  │
│           │                                                │           │
│           ▼                                                ▼           │
│  ┌─────────────────┐    Semantic Layer    ┌─────────────────┐  │
│  │ RDF Data Loader │ ◄─────────────────► │ Turtle Parser   │  │
│  ├─────────────────┤                       ├─────────────────┤  │
│  │ Semantic Validat│ ◄─────────────────► │ Query Engine    │  │
│  └─────────────────┘                       └─────────────────┘  │
│                                                                        │
└────────────────────────────────────────────────────────────────────┘
```

## 1. CLI Layer Components

### 1.1 Citty Framework Integration

**Purpose**: Modern CLI framework providing command parsing, auto-completion, and help generation.

**Key Features**:
- Auto-generated help and usage documentation
- Type-safe argument parsing with validation
- Command composition and sub-command support
- Shell completion for bash/zsh/fish

**Interface**:
```typescript
interface CLICommand {
  name: string;
  description: string;
  args?: CommandArg[];
  options?: CommandOption[];
  handler: CommandHandler;
  subCommands?: CLICommand[];
}
```

**Implementation Location**: `/src/cli/`
- `commands/` - Individual command implementations
- `parsers/` - Argument and option parsing logic
- `help/` - Documentation generation

### 1.2 Command Router

**Purpose**: Route CLI commands to appropriate handlers and coordinate with MCP layer.

**Key Features**:
- Dynamic command registration and discovery
- Template-based command generation
- Error handling and user feedback
- Integration with MCP task orchestration

**Core Commands**:
- `list` - Discover and display available templates
- `help` - Generate contextual help and documentation
- `generate` - Create files from templates
- `inject` - Modify existing files with template content
- `dry-run` - Preview operations without execution

### 1.3 Argument Parser

**Purpose**: Parse and validate command-line arguments with template variable extraction.

**Key Features**:
- Dynamic flag generation from template variables
- Type inference and validation
- Default value handling
- Interactive prompts for missing values

**Example**:
```bash
# Auto-generated from template frontmatter
unjucks generate api user --entityName User --withAuth --port 3000
```

### 1.4 Help System

**Purpose**: Generate comprehensive help documentation from templates and configurations.

**Key Features**:
- Auto-generated usage examples
- Template variable documentation
- Command composition guides
- Best practices and tips

## 2. MCP Integration Layer

### 2.1 Claude Flow Connector

**Purpose**: Bridge between Unjucks and Claude Flow MCP ecosystem for agent coordination.

**Key Features**:
- Swarm initialization and topology management
- Agent spawning and lifecycle management
- Task distribution and coordination
- Real-time status monitoring

**Interface**:
```typescript
interface ClaudeFlowConnector {
  initSwarm(topology: SwarmTopology): Promise<SwarmID>;
  spawnAgent(type: AgentType, capabilities: string[]): Promise<AgentID>;
  orchestrateTask(task: TaskDefinition): Promise<TaskResult>;
  getSwarmStatus(): Promise<SwarmStatus>;
}
```

### 2.2 Task Orchestrator

**Purpose**: Coordinate complex template generation workflows across multiple agents.

**Key Features**:
- Parallel template processing
- Dependency management between tasks
- Progress tracking and reporting
- Error recovery and retries

**Workflow Types**:
- **Sequential**: Templates processed in order
- **Parallel**: Independent templates processed concurrently
- **Adaptive**: Dynamic scheduling based on complexity and resources

### 2.3 Shared Memory Interface

**Purpose**: Provide shared state and communication channel between agents.

**Key Features**:
- Cross-session persistence
- Namespace isolation
- TTL-based expiration
- Event-driven notifications

**Memory Types**:
- **Template Context**: Shared variables and computed values
- **Generation History**: Audit trail and rollback support
- **Performance Metrics**: Optimization data collection

### 2.4 Semantic Server

**Purpose**: Dedicated MCP server for RDF processing and semantic validation.

**Key Features**:
- RDF data processing and transformation
- Ontology-aware validation
- Compliance framework integration
- Cross-ontology mapping and reasoning

## 3. Core Engine Components

### 3.1 Template Engine (Nunjucks Extended)

**Purpose**: Process templates with enhanced filters and semantic data integration.

**Key Features**:
- Standard Nunjucks template processing
- Custom filters for RDF data
- Semantic-aware variable resolution
- Performance optimization with streaming

**Custom Filters**:
```typescript
// RDF/Semantic filters
{{ rdfData | sparql('SELECT ?name WHERE { ?s foaf:name ?name }') }}
{{ entity | ontologyMap('schema.org') }}
{{ value | complianceCheck('GDPR') }}

// Utility filters
{{ filename | camelCase | pluralize }}
{{ timestamp | formatDate('ISO') }}
{{ content | minify | base64 }}
```

### 3.2 Frontmatter Parser

**Purpose**: Parse YAML frontmatter with RDF configuration and semantic validation.

**Key Features**:
- YAML parsing with type validation
- RDF data source configuration
- Compliance framework specification
- Variable enhancement settings

**Configuration Schema**:
```yaml
---
to: src/{{entityName | camelCase}}/{{entityName | kebabCase}}.ts
inject: true
before: "// Generated code"
rdf:
  type: file
  source: ontologies/schema.ttl
semanticValidation:
  enabled: true
  frameworks: [GDPR, FHIR]
  strictMode: true
variableEnhancement:
  semanticMapping: true
  typeInference: true
  enterpriseValidation: true
---
```

### 3.3 File Operations Manager

**Purpose**: Handle all file system operations with atomic transactions and rollback support.

**Key Features**:
- Atomic write operations with backup
- Intelligent injection and merging
- Permission management (chmod)
- Shell command execution

**Operation Modes**:
- **Write**: Create new files atomically
- **Inject**: Modify existing files with markers
- **Append/Prepend**: Add content to file boundaries
- **Line Insert**: Insert at specific line numbers

### 3.4 Variable Enhancement Engine

**Purpose**: Enhance template variables with semantic context and type information.

**Key Features**:
- Automatic type inference from RDF data
- Cross-ontology property mapping
- Validation rule application
- Default value resolution

## 4. Semantic Layer Components

### 4.1 Turtle Parser (N3.js)

**Purpose**: Parse RDF/Turtle data with comprehensive error handling and performance optimization.

**Key Features**:
- Full Turtle/N3 syntax support
- Streaming parser for large datasets
- Prefix management and URI resolution
- Statistics and performance metrics

**Implementation**: Based on N3.js with custom extensions:
```typescript
class TurtleParser {
  async parse(content: string): Promise<TurtleParseResult>;
  parseSync(content: string): TurtleParseResult;
  async createStore(content: string): Promise<Store>;
}
```

### 4.2 RDF Data Loader

**Purpose**: Load RDF data from multiple sources with caching and performance optimization.

**Key Features**:
- Multi-source data loading (file, URI, inline)
- Intelligent caching with TTL
- Concurrent data fetching
- Template context generation

**Data Sources**:
- **File**: Local RDF/Turtle files
- **URI**: Remote RDF endpoints (HTTP/HTTPS)
- **Inline**: Embedded RDF in frontmatter
- **SPARQL**: Query results from endpoints

### 4.3 Semantic Validator

**Purpose**: Validate data against ontologies and compliance frameworks.

**Key Features**:
- Multi-ontology validation
- Industry compliance checking (GDPR, HIPAA, SOX, FHIR, FIBO, GS1)
- Custom validation rule engine
- Performance-optimized validation pipelines

**Validation Levels**:
- **Strict**: Fail on any validation error
- **Warn**: Log warnings but continue processing
- **Info**: Informational validation results only

### 4.4 Query Engine

**Purpose**: Execute SPARQL-like queries against RDF data for template variable resolution.

**Key Features**:
- SPARQL-compatible query syntax
- Optimized query execution
- Result caching and memoization
- Cross-dataset federation

**Query Examples**:
```sparql
# Find all entities of specific type
SELECT ?entity ?name WHERE {
  ?entity rdf:type schema:Organization ;
          schema:name ?name .
}

# Complex property traversal
SELECT ?person ?email WHERE {
  ?person schema:memberOf ?org ;
          schema:email ?email .
  ?org schema:name "Acme Corp" .
}
```

## 5. Performance and Monitoring

### 5.1 Performance Monitor

**Purpose**: Track system performance and identify bottlenecks.

**Metrics Collected**:
- Template processing times
- RDF parsing performance
- Memory usage patterns
- Cache hit/miss ratios
- File operation latencies

### 5.2 Cache Management

**Purpose**: Multi-level caching system for optimal performance.

**Cache Layers**:
- **Template Cache**: Parsed template objects
- **RDF Cache**: Processed semantic data
- **Query Cache**: SPARQL query results
- **File System Cache**: Template discovery results

### 5.3 Memory Optimization

**Purpose**: Efficient memory usage for large-scale operations.

**Optimization Strategies**:
- Streaming processing for large datasets
- Lazy loading of semantic data
- Automatic garbage collection
- Memory pool management

## 6. Extension Points

### 6.1 Custom Filters

**Purpose**: Allow users to add custom Nunjucks filters for domain-specific processing.

**Registration**:
```typescript
import { registerFilter } from 'unjucks/filters';

registerFilter('myCustomFilter', (value, options) => {
  // Custom processing logic
  return transformedValue;
});
```

### 6.2 Validation Rules

**Purpose**: Add custom semantic validation rules.

**Implementation**:
```typescript
import { registerValidationRule } from 'unjucks/validation';

registerValidationRule('myDomainRule', {
  validate: (data, context) => {
    // Custom validation logic
    return validationResult;
  },
  severity: 'error',
  description: 'Domain-specific validation rule'
});
```

### 6.3 Data Source Connectors

**Purpose**: Support for additional data sources beyond standard RDF.

**Interface**:
```typescript
interface DataSourceConnector {
  type: string;
  connect(config: DataSourceConfig): Promise<DataConnection>;
  query(connection: DataConnection, query: string): Promise<QueryResult>;
  disconnect(connection: DataConnection): Promise<void>;
}
```

This component design provides a solid foundation for the Unjucks system while maintaining flexibility for future enhancements and customizations.