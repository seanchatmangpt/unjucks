# Data Flow Architecture

## Overview

Unjucks processes requests through a multi-stage pipeline that integrates CLI commands, MCP coordination, template processing, and semantic validation. This document details how data flows through the system from initial command to final output.

## Request Flow Pipeline

```
┌────────────────────────────────────────────────────────────────────────────┐
│                            Request Processing Pipeline                                │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                                    │
│ 1. CLI Input         2. Command Parse     3. Template Discovery   4. MCP Coordination │
│ ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐ │
│ │ User Command    │   │ Citty Parser    │   │ Template Index  │   │ Swarm Init      │ │
│ │ CLI Args        │ → │ Validation      │ → │ Variable Scan   │ → │ Agent Spawn     │ │
│ │ Environment     │   │ Help Generation │   │ Frontmatter     │   │ Task Orchestr.  │ │
│ └─────────────────┘   └─────────────────┘   └─────────────────┘   └─────────────────┘ │
│                                                                                    │
│                                        │                                        │
│                                        ▼                                        │
│                                                                                    │
│ 5. RDF Processing    6. Template Render  7. File Operations     8. Validation      │
│ ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐ │
│ │ Data Loading    │   │ Nunjucks Proc.  │   │ Write/Inject    │   │ Semantic Valid. │ │
│ │ Turtle Parsing  │ → │ Filter Apply    │ → │ Chmod/Shell     │ → │ Compliance      │ │
│ │ Query Exec      │   │ Context Merge   │   │ Atomic Ops      │   │ Performance     │ │
│ └─────────────────┘   └─────────────────┘   └─────────────────┘   └─────────────────┘ │
│                                                                                    │
└────────────────────────────────────────────────────────────────────────────┘
```

## 1. CLI Input Processing

### Data Structure
```typescript
interface CLIInput {
  command: string;           // Primary command (generate, list, help, etc.)
  subCommand?: string;       // Sub-command (optional)
  templateName: string;      // Template identifier
  generator?: string;        // Generator namespace
  flags: Record<string, any>; // Command-line flags
  args: string[];           // Positional arguments
  environment: EnvVars;     // Environment variables
  workingDirectory: string;  // Current working directory
}
```

### Example Flow
```bash
# Input command
unjucks generate api user --entityName User --withAuth --dest ./src

# Parsed structure
{
  command: "generate",
  templateName: "user",
  generator: "api",
  flags: {
    entityName: "User",
    withAuth: true,
    dest: "./src"
  },
  workingDirectory: "/project/root"
}
```

## 2. Command Parsing and Validation

### Citty Integration
```typescript
interface ParsedCommand {
  isValid: boolean;
  command: CommandDefinition;
  args: ValidatedArgs;
  options: ValidatedOptions;
  errors: ParseError[];
  help?: HelpContent;
}

class CommandParser {
  parse(input: CLIInput): ParsedCommand {
    // 1. Command resolution
    // 2. Argument validation
    // 3. Help generation (if requested)
    // 4. Error collection and reporting
  }
}
```

### Validation Pipeline
1. **Command Existence**: Verify command is registered
2. **Required Arguments**: Check all required parameters provided
3. **Type Validation**: Validate argument types (string, number, boolean)
4. **Pattern Matching**: Apply regex patterns for format validation
5. **Dependency Checks**: Validate inter-argument dependencies

## 3. Template Discovery and Analysis

### Template Index Structure
```typescript
interface TemplateIndex {
  generators: Map<string, GeneratorDefinition>;
  templates: Map<string, TemplateDefinition>;
  cache: TemplateCache;
  lastScan: timestamp;
}

interface TemplateDefinition {
  path: string;
  frontmatter: FrontmatterConfig;
  variables: TemplateVariable[];
  dependencies: string[];
  rdfConfig?: RDFDataSource;
  validationRules: ValidationRule[];
}
```

### Discovery Process
```
┌───────────────────────────────────────────────────────────────────┐
│                         Template Discovery Flow                           │
├───────────────────────────────────────────────────────────────────┤
│                                                                         │
│  File System Scan  →  Frontmatter Parse  →  Variable Extract  →  Index Build  │
│  ┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐  │
│  │ Glob Pattern    │       │ YAML Parse      │       │ {{ var }} Scan  │       │ Memory Cache    │  │
│  │ Template Filter │       │ RDF Config      │       │ Type Inference  │       │ Dependency Map  │  │
│  │ Ignore Rules    │       │ Validation      │       │ Default Values  │       │ Quick Lookup    │  │
│  └─────────────────┘       └─────────────────┘       └─────────────────┘       └─────────────────┘  │
│                                                                         │
└───────────────────────────────────────────────────────────────────┘
```

## 4. MCP Coordination Flow

### MCP Request Lifecycle
```typescript
interface MCPRequest {
  id: string;
  method: string;
  params: MCPParams;
  metadata: RequestMetadata;
}

interface MCPResponse {
  id: string;
  result?: MCPResult;
  error?: MCPError;
  performance: PerformanceMetrics;
}
```

### Agent Coordination Pattern
```
┌────────────────────────────────────────────────────────────────────────────┐
│                            Agent Coordination                                  │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  Claude Code (Client)                    Unjucks MCP Server                  │
│  ┌─────────────────────┐  MCP  ┌─────────────────────┐              │
│  │ Task Agent         │ ◄─────► │ Request Handler   │              │
│  │ • Template Gen      │       │ • Template Ops     │              │
│  │ • File Operations   │       │ • RDF Processing   │              │
│  │ • Coordination      │       │ • Validation       │              │
│  └─────────────────────┘       └────────┬────────────┘              │
│           │                            │                            │
│           ▼                            ▼                            │
│  ┌─────────────────────┐       ┌─────────────────────┐              │
│  │ Shared Memory      │ ◄─────► │ Memory Interface  │              │
│  │ • Context Store     │       │ • Template Context │              │
│  │ • Progress Tracking │       │ • RDF Data Store   │              │
│  │ • Error State       │       │ • Cache Management │              │
│  └─────────────────────┘       └─────────────────────┘              │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### MCP Tool Invocations
```typescript
// Template listing
await mcp.call('unjucks-list', {
  generator: 'api',
  includeHidden: false
});

// Help generation  
await mcp.call('unjucks-help', {
  command: 'generate',
  template: 'user'
});

// Dry run execution
await mcp.call('unjucks-dry-run', {
  template: 'api/user',
  variables: { entityName: 'User' },
  destination: './src'
});

// Template generation
await mcp.call('unjucks-generate', {
  template: 'api/user',
  variables: { entityName: 'User', withAuth: true },
  destination: './src',
  force: false
});
```

## 5. RDF Data Processing Flow

### Data Loading Pipeline
```typescript
interface RDFProcessingFlow {
  sources: RDFDataSource[];
  loadingStrategy: 'sequential' | 'parallel' | 'adaptive';
  cacheConfig: CacheConfiguration;
  validationLevel: 'strict' | 'warn' | 'info';
}
```

### Processing Stages
```
┌────────────────────────────────────────────────────────────────────────────┐
│                          RDF Processing Pipeline                              │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│ Data Sources → Cache Check → Parse/Load → Validation → Context Build  │
│                                                                            │
│ ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐ │
│ │ File        │  │ TTL Check  │  │ N3.js      │  │ Ontology   │  │ Template   │ │
│ │ URI         │  │ Hash Match │  │ Parser     │  │ Validation │  │ Variables  │ │
│ │ Inline      │  │ Version    │  │ Store      │  │ Compliance │  │ Filters    │ │
│ │ SPARQL      │  │ Control    │  │ Creation   │  │ Framework  │  │ Context    │ │
│ └────────────┘  └────────────┘  └────────────┘  └────────────┘  └────────────┘ │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### Template Context Creation
```typescript
interface TemplateContext {
  // CLI variables
  cliVars: Record<string, any>;
  
  // RDF-derived data
  rdf: {
    subjects: Record<string, RDFSubject>;
    prefixes: Record<string, string>;
    triples: ParsedTriple[];
    stats: ParseStats;
  };
  
  // Enhanced variables
  enhanced: {
    types: Record<string, string>;
    mappings: Record<string, any>;
    validations: ValidationResult[];
  };
  
  // System context
  system: {
    timestamp: Date;
    user: UserContext;
    environment: EnvironmentVars;
    performance: PerformanceMetrics;
  };
}
```

## 6. Template Rendering Pipeline

### Nunjucks Processing Flow
```typescript
interface RenderingPipeline {
  template: ParsedTemplate;
  context: TemplateContext;
  filters: CustomFilter[];
  extensions: NunjucksExtension[];
  options: RenderOptions;
}

interface RenderOptions {
  streaming: boolean;
  validation: boolean;
  performance: boolean;
  errorMode: 'strict' | 'lenient' | 'ignore';
}
```

### Filter Application Chain
```
┌────────────────────────────────────────────────────────────────────────────┐
│                           Filter Processing Chain                              │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│    Input → Built-in Filters → Semantic Filters → Custom Filters → Output     │
│                                                                            │
│  ┌──────────┐  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐  ┌───────────┐ │
│  │ Template │  │ camelCase     │  │ sparql        │  │ Domain        │  │ Rendered  │ │
│  │ Variable │  │ kebab-case    │  │ ontologyMap   │  │ Specific      │  │ Content   │ │
│  │ RDF Data │  │ pluralize     │  │ compliance    │  │ Transforms    │  │ Validated │ │
│  │ Context  │  │ capitalize    │  │ rdfProperty   │  │ Extensions    │  │ Output    │ │
│  └──────────┘  └───────────────┘  └───────────────┘  └───────────────┘  └───────────┘ │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

## 7. File Operations and Atomic Transactions

### Operation Modes
```typescript
type FileOperation = 
  | { mode: 'write'; target: string; content: string; }
  | { mode: 'inject'; target: string; content: string; before?: string; after?: string; }
  | { mode: 'append'; target: string; content: string; }
  | { mode: 'prepend'; target: string; content: string; }
  | { mode: 'lineAt'; target: string; content: string; lineNumber: number; };
```

### Atomic Transaction Flow
```
┌────────────────────────────────────────────────────────────────────────────┐
│                        File Operation Transaction                             │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  Begin → Backup → Validate → Execute → Verify → Commit/Rollback     │
│                                                                            │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐ │
│  │ Lock    │  │ Create  │  │ Check   │  │ Write   │  │ Hash    │  │ Success │ │
│  │ Files   │  │ Backup  │  │ Perms   │  │ Temp    │  │ Check   │  │ Cleanup │ │
│  │ State   │  │ Copies  │  │ Space   │  │ File    │  │ Size    │  │ Unlock  │ │
│  │ Track   │  │ State   │  │ Exists  │  │ Atomic  │  │ Valid   │  │ Notify  │ │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘  └─────────┘  └─────────┘ │
│                                   │                    │                    │
│                                   ▼                    ▼                    │
│                            Error Handler         Rollback              │
│                          ┌───────────────┐  ┌───────────────┐            │
│                          │ Log Error     │  │ Restore Backup│            │
│                          │ Clean Temp    │  │ Clean State   │            │
│                          │ Unlock Files  │  │ Report Failure│            │
│                          └───────────────┘  └───────────────┘            │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

## 8. Validation and Quality Gates

### Multi-Layer Validation
```typescript
interface ValidationPipeline {
  layers: ValidationLayer[];
  strategy: 'fail-fast' | 'collect-all' | 'warn-continue';
  customRules: ValidationRule[];
  complianceFrameworks: ComplianceFramework[];
}

interface ValidationLayer {
  name: string;
  validators: Validator[];
  required: boolean;
  order: number;
}
```

### Validation Flow
```
┌────────────────────────────────────────────────────────────────────────────┐
│                          Validation Pipeline                               │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  Syntax → Semantic → Compliance → Performance → Custom → Report    │
│                                                                            │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐ │
│  │ YAML    │  │ RDF     │  │ GDPR    │  │ Memory  │  │ Domain  │  │ Results │ │
│  │ Template│  │ Valid.  │  │ HIPAA   │  │ CPU     │  │ Rules   │  │ Summary │ │
│  │ Path    │  │ Onto.   │  │ SOX     │  │ Time    │  │ Logic   │  │ Errors  │ │
│  │ Vars    │  │ Consist.│  │ FHIR    │  │ Limits  │  │ Checks  │  │ Metrics │ │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘  └─────────┘  └─────────┘ │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

## Error Handling and Recovery

### Error Classification
```typescript
type ErrorCategory = 
  | 'syntax'      // Template/YAML syntax errors
  | 'semantic'    // RDF/ontology validation errors
  | 'runtime'     // File system and execution errors
  | 'network'     // Remote data source failures
  | 'compliance'  // Regulatory framework violations
  | 'performance' // Resource limit exceeded
  | 'user'        // Invalid user input
  | 'system';     // Internal system errors
```

### Recovery Strategies
```typescript
interface ErrorRecoveryStrategy {
  category: ErrorCategory;
  severity: 'critical' | 'error' | 'warning' | 'info';
  recovery: 'abort' | 'retry' | 'fallback' | 'continue';
  maxRetries?: number;
  backoffStrategy?: 'linear' | 'exponential' | 'fixed';
  fallbackAction?: () => Promise<void>;
}
```

## Performance Monitoring

### Metrics Collection Points
```typescript
interface PerformanceMetrics {
  // Timing metrics
  templateDiscovery: number;
  rdfParsing: number;
  templateRendering: number;
  fileOperations: number;
  validation: number;
  totalExecution: number;
  
  // Resource metrics
  memoryUsage: MemoryUsage;
  cacheHitRatio: number;
  fileSystemOps: number;
  networkRequests: number;
  
  // Quality metrics
  validationErrors: number;
  complianceViolations: number;
  templateCoverage: number;
}
```

This data flow architecture ensures efficient, reliable, and observable processing of template generation requests while maintaining data integrity and system performance throughout the pipeline.