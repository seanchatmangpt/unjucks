# System Architecture

Comprehensive architecture documentation for Unjucks v1.0, covering design principles, component interactions, and implementation details.

## Overview

Unjucks is built as a modular, extensible code generation system with a clean separation of concerns. The architecture emphasizes flexibility, performance, and developer experience.

## Architecture Principles

### 1. Modular Design
- **Single Responsibility**: Each component has a focused, well-defined purpose
- **Loose Coupling**: Components interact through well-defined interfaces
- **High Cohesion**: Related functionality is grouped together

### 2. Extensibility
- **Plugin Architecture**: Support for custom filters and extensions
- **Template Discovery**: Automatic discovery of generators and templates
- **Dynamic CLI**: Automatically generated CLI from template analysis

### 3. Developer Experience
- **Zero Configuration**: Works out of the box with sensible defaults
- **Interactive Prompts**: User-friendly prompts for missing information
- **Comprehensive Feedback**: Clear error messages and progress indicators

### 4. Performance
- **Lazy Loading**: Components loaded only when needed
- **Caching**: Template analysis results cached for performance
- **Efficient File Operations**: Optimized file system interactions

## System Components

### Core Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Unjucks CLI                            │
├─────────────────────────────────────────────────────────────────┤
│                     Command Layer                              │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌──────────┐  │
│  │   generate  │ │    list     │ │    init     │ │   help   │  │
│  └─────────────┘ └─────────────┘ └─────────────┘ └──────────┘  │
├─────────────────────────────────────────────────────────────────┤
│                    Service Layer                               │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                 Generator                                   │ │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────┐ │ │
│  │  │ Discovery   │ │ Processing  │ │    File Generation      │ │ │
│  │  └─────────────┘ └─────────────┘ └─────────────────────────┘ │ │
│  └─────────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │              TemplateScanner                                │ │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────┐ │ │
│  │  │ Variable    │ │ File        │ │    CLI Args             │ │ │
│  │  │ Extraction  │ │ Analysis    │ │    Generation           │ │ │
│  │  └─────────────┘ └─────────────┘ └─────────────────────────┘ │ │
│  └─────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│                    Engine Layer                                │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────────┐ │
│  │   Nunjucks      │ │  File System    │ │     Prompts         │ │
│  │   Engine        │ │  Operations     │ │     (Inquirer)      │ │
│  └─────────────────┘ └─────────────────┘ └─────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Component Details

### 1. CLI Layer (cli.ts)

**Responsibilities:**
- Command routing and argument parsing
- User interface and feedback
- Integration with Citty command framework

**Key Features:**
- Dynamic command generation from templates
- Comprehensive help system
- Error handling and user feedback

```typescript
// CLI Architecture
const main = defineCommand({
  meta: { name: "unjucks" },
  subCommands: {
    generate: createDynamicGenerateCommand(),  // Dynamic CLI generation
    list: listCommand,                         // Static command
    init: initCommand,                         // Static command
    help: createTemplateHelpCommand()          // Dynamic help
  }
});
```

### 2. Generator Service (lib/generator.ts)

**Responsibilities:**
- Template discovery and management
- File generation workflow orchestration
- Configuration management
- Variable collection and processing

**Core Methods:**
```typescript
class Generator {
  // Discovery
  async listGenerators(): Promise<GeneratorConfig[]>
  async listTemplates(generator: string): Promise<TemplateConfig[]>
  
  // Analysis
  async scanTemplateForVariables(generator: string, template: string)
  
  // Generation
  async generate(options: GenerateOptions): Promise<GenerateResult>
  
  // Initialization
  async initProject(options: InitOptions): Promise<void>
}
```

**Template Discovery Process:**
1. Find templates directory (_templates or templates)
2. Scan subdirectories as generators
3. Load generator configurations (config.yml)
4. Discover templates within generators
5. Build generator/template registry

### 3. Template Scanner (lib/template-scanner.ts)

**Responsibilities:**
- Template file analysis
- Variable extraction from Nunjucks syntax
- CLI argument generation
- Type inference for variables

**Variable Detection Patterns:**
```typescript
// Nunjucks variable patterns
{{ variableName }}                    // String variable
{{ variableName | filter }}           // String with filter
{% if variableName %}                 // Boolean variable
{% for item in items %}               // Array variable (items)

// Filename patterns
{{ componentName | pascalCase }}.tsx  // Variable in filename

// Boolean detection heuristics
withTests, hasProps, isActive         // Boolean by naming convention
```

### 4. Nunjucks Engine Integration

**Responsibilities:**
- Template rendering
- Custom filter implementation
- Environment configuration

**Custom Filters:**
```typescript
// String transformation filters
camelCase:    "hello world" → "helloWorld"
pascalCase:   "hello world" → "HelloWorld"
kebabCase:    "hello world" → "hello-world"
snakeCase:    "hello world" → "hello_world"
titleCase:    "hello world" → "Hello World"

// Pluralization filters
pluralize:    "item" → "items"
singularize:  "items" → "item"

// Capitalization filters
capitalize:   "hello world" → "Hello world"
```

### 5. File System Operations

**Responsibilities:**
- File and directory creation
- Atomic file operations
- Permission handling
- Conflict resolution

**File Generation Workflow:**
```
Template Processing → Variable Substitution → Filename Generation → File Writing
       ↓                      ↓                      ↓               ↓
   Parse template     Apply Nunjucks engine    Process filename    Create/update
   files and dirs     with variables           variables           files safely
```

### 6. Dynamic Command Generation

**Responsibilities:**
- Runtime CLI command creation
- Argument parsing and validation
- Help text generation

**Dynamic CLI Process:**
1. User runs `unjucks generate <generator> <template>`
2. System scans template for variables
3. CLI arguments generated from variables
4. Command executed with parsed arguments
5. Variables passed to template engine

## Data Flow Architecture

### Template Generation Flow

```
User Input → CLI Parsing → Template Discovery → Variable Extraction → Template Rendering → File Output
     ↓           ↓              ↓                     ↓                    ↓              ↓
CLI Command → Arguments → Generator/Template → Variables List → Nunjucks Engine → Generated Files
```

### Detailed Flow Steps

1. **Command Parsing**
   ```typescript
   unjucks generate component react --componentName Button --withProps
   ```

2. **Template Discovery**
   ```typescript
   // Find template at: _templates/component/react/
   const templatePath = path.join(templatesDir, 'component', 'react');
   ```

3. **Variable Extraction**
   ```typescript
   // Scan template files for {{ variables }}
   const variables = scanner.scanTemplate(templatePath);
   // Result: [{ name: 'componentName', type: 'string' }, ...]
   ```

4. **Variable Collection**
   ```typescript
   // Merge CLI args with prompts
   const templateVars = {
     componentName: 'Button',    // From CLI
     withProps: true,            // From CLI
     withTests: await prompt()   // From interactive prompt
   };
   ```

5. **Template Rendering**
   ```typescript
   // Process each template file
   const content = nunjucks.render(templateContent, templateVars);
   const filename = nunjucks.render(templateFilename, templateVars);
   ```

6. **File Generation**
   ```typescript
   // Write processed files to destination
   await fs.writeFile(path.join(destDir, filename), content);
   ```

## Template Structure

### Standard Template Layout

```
_templates/
├── generator1/                 # Generator directory
│   ├── config.yml             # Optional configuration
│   ├── template1/             # Template directory
│   │   ├── file1.txt.njk      # Template files
│   │   ├── {{ name }}.ts      # Dynamic filename
│   │   └── subdir/
│   │       └── nested.tsx
│   └── template2/
└── generator2/
```

### Configuration Schema

```yaml
# _templates/component/config.yml
name: "component"
description: "Generate React components"
templates:
  - name: "react"
    description: "React functional component"
    files:
      - "{{ componentName | pascalCase }}.tsx"
      - "{{ componentName | pascalCase }}.test.tsx"
    prompts:
      - name: "componentName"
        message: "Component name:"
        type: "input"
        default: "MyComponent"
      - name: "withProps"
        message: "Include props interface?"
        type: "confirm"
        default: true
```

## Error Handling Strategy

### Error Categories

1. **User Errors**
   - Invalid command syntax
   - Missing required variables
   - File conflicts

2. **System Errors**
   - Template not found
   - File system permissions
   - Invalid template syntax

3. **Configuration Errors**
   - Invalid YAML configuration
   - Missing template files
   - Circular dependencies

### Error Handling Flow

```typescript
try {
  // Operation
  await generator.generate(options);
} catch (error) {
  if (error instanceof TemplateNotFoundError) {
    // Show available templates
    console.error(`Template not found. Available templates:`);
    showAvailableTemplates();
  } else if (error instanceof VariableValidationError) {
    // Show variable requirements
    console.error(`Missing required variables:`);
    showRequiredVariables(error.missingVars);
  } else {
    // Generic error handling
    console.error(`Generation failed: ${error.message}`);
  }
}
```

## Performance Considerations

### Optimization Strategies

1. **Lazy Loading**
   - Templates loaded only when accessed
   - CLI commands generated on-demand
   - File operations batched when possible

2. **Caching**
   - Template analysis results cached
   - Generator configurations cached
   - File system lookups minimized

3. **Memory Management**
   - Large file operations streamed
   - Template content released after processing
   - Temporary files cleaned up automatically

### Performance Metrics

| Operation | Target Performance | Actual (v1.0) |
|-----------|-------------------|---------------|
| Template Discovery | < 100ms | ~50ms |
| Variable Extraction | < 50ms | ~25ms |
| File Generation | < 200ms/file | ~100ms/file |
| CLI Startup | < 500ms | ~200ms |

## Security Architecture

### Input Validation

```typescript
// Template path validation
const safePath = path.resolve(templatesDir, userPath);
if (!safePath.startsWith(templatesDir)) {
  throw new SecurityError('Path traversal attempt detected');
}

// Variable validation
const sanitizedVars = Object.fromEntries(
  Object.entries(vars).map(([key, value]) => [
    sanitizeVariableName(key),
    sanitizeVariableValue(value)
  ])
);
```

### File System Security

1. **Path Validation**
   - Prevent path traversal attacks
   - Validate file extensions
   - Restrict output directories

2. **Permission Checks**
   - Verify write permissions
   - Check file ownership
   - Respect system file attributes

3. **Template Sandboxing**
   - Restrict template file access
   - Prevent arbitrary code execution
   - Validate template syntax

## Extension Points

### 1. Custom Filters

```typescript
// Register custom filter
env.addFilter('customFilter', (str: string) => {
  return processString(str);
});

// Usage in template
{{ variableName | customFilter }}
```

### 2. Custom Commands

```typescript
// Add custom command
const customCommand = defineCommand({
  meta: { name: 'custom' },
  async run() {
    // Custom logic
  }
});

main.subCommands.custom = customCommand;
```

### 3. Template Processors

```typescript
// Custom template processor
class CustomTemplateProcessor {
  async process(template: string, variables: any): Promise<string> {
    // Custom processing logic
    return processedTemplate;
  }
}
```

### 4. Variable Extractors

```typescript
// Custom variable extractor
class CustomVariableExtractor {
  extractVariables(content: string): TemplateVariable[] {
    // Custom extraction logic
    return variables;
  }
}
```

## Testing Architecture

### Test Strategy

1. **Unit Tests** - Individual component testing
2. **Integration Tests** - Component interaction testing
3. **BDD Tests** - Behavior-driven feature testing
4. **Performance Tests** - Load and stress testing

### Test Structure

```
tests/
├── unit/                      # Vitest unit tests
│   ├── generator.test.ts
│   ├── template-scanner.test.ts
│   └── filters.test.ts
├── step-definitions/          # Cucumber step implementations
├── fixtures/                  # Test data and templates
└── support/                   # Test utilities
```

### Test Coverage

- **Unit Tests**: 95%+ code coverage
- **Integration Tests**: All major workflows
- **BDD Tests**: 302 scenarios across 18 features
- **Performance Tests**: Key operation benchmarks

## Deployment Architecture

### Build Process

```typescript
// obuild configuration
export default {
  entries: [
    'src/index.ts',      // Main API
    'src/cli.ts'         // CLI entry point
  ],
  outDir: 'dist',
  format: 'esm',
  target: 'node16',
  dts: true              // Generate TypeScript definitions
};
```

### Distribution

1. **npm Package** - Primary distribution method
2. **Global Installation** - CLI available system-wide
3. **Local Installation** - Project-specific usage
4. **Docker Image** - Containerized deployment (future)

### Compatibility

- **Node.js**: >= 16.0.0
- **Operating Systems**: macOS, Linux, Windows
- **Package Managers**: npm, pnpm, yarn
- **Module Systems**: ESM (primary), CJS (compatibility)

## Future Architecture Considerations

### Planned Enhancements

1. **Plugin System**
   - Third-party generator plugins
   - Custom filter packages
   - Template marketplace integration

2. **Remote Templates**
   - Git repository templates
   - NPM template packages
   - Template sharing platform

3. **Advanced Features**
   - Template composition
   - Multi-language support
   - IDE integrations

4. **Performance Improvements**
   - Parallel template processing
   - Incremental generation
   - Template compilation

### Scalability Considerations

1. **Large Projects**
   - Template registry optimization
   - Memory usage optimization
   - Batch operation support

2. **Enterprise Features**
   - Template governance
   - Audit logging
   - Access controls

3. **Cloud Integration**
   - Serverless deployment
   - Container orchestration
   - CI/CD pipeline integration

---

## C4 Model Architecture Diagrams

This section contains the complete C4 model architecture documentation for the KGEN Knowledge Graph Engine system. The diagrams follow the C4 model methodology, providing different levels of architectural abstraction from high-level system context down to detailed code-level components.

### KGEN Architecture Overview

The KGEN system extends Unjucks with deterministic knowledge graph processing, semantic validation, and cryptographic provenance tracking. The architecture follows distributed system principles with strong emphasis on reproducibility, semantic validation, and enterprise-grade security.

### C4 Model Levels

#### Level 1: System Context

- **[c4-context.mmd](./c4-context.mmd)** - System Context Diagram
  - Shows KGEN system in relation to external users, systems, and dependencies
  - Depicts high-level relationships with Git repositories, CI/CD systems, RDF stores, and monitoring

#### Level 2: Container Architecture

- **[c4-container-cli.mmd](./c4-container-cli.mmd)** - CLI Container Diagram
  - Command-line interface architecture and interaction patterns
  - Shows CLI commands, argument processing, and core engine integration

- **[c4-container-autonomic.mmd](./c4-container-autonomic.mmd)** - Autonomic Computing Container
  - Self-managing system components for automatic optimization
  - Adaptive behavior and autonomous decision-making containers

#### Level 3: Component Architecture

##### Core Generation Components

- **[c4-component-artifact-generate.mmd](./c4-component-artifact-generate.mmd)** - Artifact Generation Workflow
  - Complete artifact generation pipeline from templates to deterministic outputs
  - Integration between template processing, RDF processing, and storage systems

- **[c4-component-document-generation.mmd](./c4-component-document-generation.mmd)** - Document Generation System
  - Specialized document generation components for various output formats
  - Template-driven document creation with semantic enrichment

##### Data Processing Components

- **[c4-component-graph-engine.mmd](./c4-component-graph-engine.mmd)** - RDF Graph Processing Engine
  - Semantic data processing, SPARQL querying, and knowledge graph operations
  - Integration with external RDF stores and semantic reasoning

- **[c4-component-frontmatter-engine.mmd](./c4-component-frontmatter-engine.mmd)** - Frontmatter Processing Engine
  - Template frontmatter parsing, variable extraction, and directive processing
  - Integration with template scanning and analysis systems

- **[c4-component-uri-resolver.mmd](./c4-component-uri-resolver.mmd)** - URI Resolution System
  - Handles URI resolution across different protocols and schemes
  - Caching, validation, and content retrieval from various sources

##### Storage & Caching Components

- **[c4-component-cas-cache.mmd](./c4-component-cas-cache.mmd)** - Content-Addressed Storage System
  - Immutable content storage with cryptographic addressing
  - Deduplication, integrity verification, and efficient retrieval

- **[c4-component-git-as-blockchain.mmd](./c4-component-git-as-blockchain.mmd)** - Git-Based Blockchain System
  - Leveraging Git's DAG structure for blockchain-like provenance
  - Immutable history, distributed verification, and cryptographic integrity

##### Validation & Compliance Components

- **[c4-component-shacl-validation.mmd](./c4-component-shacl-validation.mmd)** - SHACL Validation System
  - Semantic validation using SHACL shapes and constraints
  - Real-time validation, batch processing, and compliance reporting

- **[c4-component-sbom-generation.mmd](./c4-component-sbom-generation.mmd)** - Software Bill of Materials Generation
  - Automatic SBOM creation from code analysis and dependencies
  - Supply chain security and compliance automation

##### Monitoring & Analysis Components

- **[c4-component-artifact-drift.mmd](./c4-component-artifact-drift.mmd)** - Artifact Drift Detection
  - Monitors changes in generated artifacts over time
  - Detects unintended modifications and configuration drift

- **[c4-component-provenance-explain.mmd](./c4-component-provenance-explain.mmd)** - Provenance Explanation Engine
  - Traces artifact generation history and decision points
  - Provides detailed explanation of generation process

- **[c4-component-project-lifecycle.mmd](./c4-component-project-lifecycle.mmd)** - Project Lifecycle Management
  - Manages project evolution, versioning, and lifecycle states
  - Integration with development workflows and release processes

- **[c4-component-merkle-changefeed.mmd](./c4-component-merkle-changefeed.mmd)** - Merkle Tree Changefeed System
  - Efficient change tracking using Merkle tree structures
  - Real-time change propagation and integrity verification

#### Level 4: Code Architecture

##### Core Processing Engines

- **[c4-code-deterministic-renderer.mmd](./c4-code-deterministic-renderer.mmd)** - Deterministic Rendering System
  - Template rendering with guaranteed reproducible output
  - Content normalization, context management, and caching strategies
  - Validation of rendering determinism and consistency

- **[c4-code-semantic-hashing.mmd](./c4-code-semantic-hashing.mmd)** - Semantic Hashing Engine
  - Meaning-aware content hashing that remains stable across syntactic variations
  - Machine learning-based semantic analysis and feature extraction
  - Hash collision detection and quality analysis

##### Security & Cryptography

- **[c4-code-attestation-generator.mmd](./c4-code-attestation-generator.mmd)** - Cryptographic Attestation Generator
  - Complete cryptographic proof generation system
  - Digital signatures, Merkle proofs, and multi-format attestation output
  - Key management, entropy sources, and verification systems

- **[c4-code-policy-gate.mmd](./c4-code-policy-gate.mmd)** - SHACL Policy Gate Engine
  - Policy enforcement through SHACL-based validation rules
  - Rule execution, decision making, and conflict resolution
  - Performance optimization and audit logging

##### Specialized Processors

- **[c4-code-opc-normalizer.mmd](./c4-code-opc-normalizer.mmd)** - OPC Document Normalizer
  - Deterministic processing of Office documents (DOCX, XLSX, PPTX)
  - Package structure normalization, metadata stripping, and compression management
  - Binary content processing and validation

### KGEN Architecture Patterns

#### Deterministic Processing
All KGEN components are designed to produce identical outputs given identical inputs, ensuring reproducibility across different environments and time periods.

#### Content-Addressed Storage
Extensive use of content-addressed storage patterns ensures immutability and enables efficient deduplication and caching throughout the system.

#### Semantic-Aware Processing
Components understand content semantics rather than just syntax, enabling robust handling of logically equivalent but syntactically different inputs.

#### Cryptographic Provenance
Every artifact includes cryptographic attestations that prove its generation process and enable verification of integrity and authenticity.

#### Distributed Architecture
System components can operate in distributed environments with proper coordination and consistency guarantees.

### Integration Points

#### External Systems
- **Git Repositories**: Version control integration with enhanced provenance tracking
- **RDF Triple Stores**: Semantic data integration and SPARQL querying capabilities
- **CI/CD Pipelines**: Automated validation and artifact generation workflows
- **Monitoring Systems**: OpenTelemetry-based observability and metrics collection

#### Internal Coordination
- **Event-Driven Architecture**: Components communicate through well-defined events and message passing
- **Content-Addressed Coordination**: Shared state management through immutable content addressing
- **Policy-Based Validation**: SHACL-based rules govern system behavior and data validation

### Quality Attributes

#### Performance
- **Multi-level Caching**: Content-addressed storage with intelligent cache hierarchies
- **Parallel Processing**: Concurrent execution where data dependencies allow
- **Semantic Optimization**: ML-based analysis for intelligent processing optimization

#### Security
- **Cryptographic Integrity**: All artifacts include cryptographic proofs and signatures
- **Immutable Audit Trail**: Complete provenance tracking with tamper evidence
- **Policy Enforcement**: SHACL-based access control and validation rules

#### Scalability
- **Distributed Components**: Horizontal scaling support across multiple nodes
- **Content Deduplication**: Efficient storage utilization through intelligent deduplication
- **Incremental Processing**: Process only changed content for efficiency

#### Reliability
- **Deterministic Output**: Guaranteed reproducible results across all operations
- **Comprehensive Validation**: Multi-stage validation pipeline with semantic checks
- **Graceful Degradation**: Fallback mechanisms for component failures

### Development Guidelines

#### Adding New C4 Diagrams
1. Follow C4 model conventions and abstraction levels
2. Use consistent mermaid syntax and styling
3. Maintain proper abstraction levels between diagram types
4. Update this index when adding new diagrams

#### Diagram Naming Convention
- `c4-context-*.mmd` - System context level diagrams
- `c4-container-*.mmd` - Container level diagrams
- `c4-component-*.mmd` - Component level diagrams
- `c4-code-*.mmd` - Code/class level diagrams

#### Consistency Requirements
- All diagrams should reference consistent component names and boundaries
- Relationships should be bidirectionally coherent across diagram levels
- Technology choices should align across all abstraction levels
- Maintain consistent visual styling and layout patterns

### Tools and Rendering

These C4 diagrams are created using Mermaid syntax and can be rendered in:
- **GitHub**: Native Mermaid support in README files
- **Mermaid Live Editor**: Online editing and preview
- **Visual Studio Code**: Mermaid preview extensions
- **Documentation Generators**: GitBook, Docusaurus, VuePress with Mermaid plugins

---

*Total Architecture Components: 21 C4 Diagrams + Comprehensive Implementation Documentation | Last Updated: September 2025*

*For implementation details and API usage, see the [API Reference](../api/README.md) and [Getting Started Guide](../getting-started.md).*