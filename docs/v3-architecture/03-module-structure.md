# Module Structure - v3 Architecture

## Overview

The v3 architecture organizes modules into focused, cohesive packages with clear separation of concerns and minimal coupling.

## Module Hierarchy

```mermaid
graph TB
    subgraph "src/"
        subgraph "cli/"
            CLI1[index.js]
            CLI2[arg-preprocessor.js]
        end
        
        subgraph "commands/"
            CMD1[generate.js]
            CMD2[list.js] 
            CMD3[inject.js]
            CMD4[semantic.js]
            CMD5[latex.js]
            CMD6[export.js]
        end
        
        subgraph "lib/"
            subgraph "template/"
                T1[template-engine.js]
                T2[template-discovery.js]
                T3[template-inheritance.js]
                T4[variable-extractor.js]
                T5[frontmatter-parser.js]
            end
            
            subgraph "filters/"
                F1[basic-filters.js]
                F2[rdf-filters.js]
                F3[latex-filters.js]
                F4[semantic-filters.js]
            end
            
            subgraph "semantic/"
                S1[n3-parser.js]
                S2[rdf-loader.js]
                S3[sparql-query.js]
                S4[knowledge-graph.js]
            end
            
            subgraph "file/"
                FI1[file-injector.js]
                FI2[atomic-writer.js]
                FI3[path-security.js]
                FI4[file-watcher.js]
            end
            
            subgraph "latex/"
                L1[latex-processor.js]
                L2[math-renderer.js]
                L3[citation-handler.js]
            end
            
            subgraph "validation/"
                V1[schema-validator.js]
                V2[template-validator.js]
                V3[security-validator.js]
            end
        end
        
        subgraph "config/"
            C1[config-loader.js]
            C2[env-manager.js]
        end
        
        subgraph "utils/"
            U1[logger.js]
            U2[error-handler.js]
            U3[cache-manager.js]
        end
    end
```

## Import Dependency Graph

```mermaid
graph LR
    %% CLI Layer
    CLI[cli/index.js] --> PREPROCESS[cli/arg-preprocessor.js]
    CLI --> CMD_GEN[commands/generate.js]
    CLI --> CMD_LIST[commands/list.js]
    CLI --> CMD_INJ[commands/inject.js]
    CLI --> CMD_SEM[commands/semantic.js]
    CLI --> CMD_LAT[commands/latex.js]
    CLI --> CMD_EXP[commands/export.js]
    
    %% Command Dependencies
    CMD_GEN --> ENGINE[lib/template/template-engine.js]
    CMD_GEN --> DISCOVERY[lib/template/template-discovery.js]
    CMD_GEN --> INJECTOR[lib/file/file-injector.js]
    CMD_GEN --> WRITER[lib/file/atomic-writer.js]
    
    CMD_LIST --> DISCOVERY
    CMD_LIST --> INHERITANCE[lib/template/template-inheritance.js]
    
    CMD_INJ --> INJECTOR
    CMD_INJ --> SECURITY[lib/file/path-security.js]
    
    CMD_SEM --> N3[lib/semantic/n3-parser.js]
    CMD_SEM --> RDF[lib/semantic/rdf-loader.js]
    CMD_SEM --> SPARQL[lib/semantic/sparql-query.js]
    CMD_SEM --> KG[lib/semantic/knowledge-graph.js]
    
    CMD_LAT --> LATEX[lib/latex/latex-processor.js]
    CMD_LAT --> MATH[lib/latex/math-renderer.js]
    CMD_LAT --> CITATION[lib/latex/citation-handler.js]
    
    CMD_EXP --> ENGINE
    CMD_EXP --> RDF
    
    %% Template Engine Dependencies
    ENGINE --> FRONTMATTER[lib/template/frontmatter-parser.js]
    ENGINE --> VARIABLES[lib/template/variable-extractor.js]
    ENGINE --> BASIC_FILTERS[lib/filters/basic-filters.js]
    ENGINE --> RDF_FILTERS[lib/filters/rdf-filters.js]
    ENGINE --> LATEX_FILTERS[lib/filters/latex-filters.js]
    ENGINE --> SEM_FILTERS[lib/filters/semantic-filters.js]
    ENGINE --> VALIDATOR[lib/validation/template-validator.js]
    
    %% Discovery Dependencies
    DISCOVERY --> CONFIG[config/config-loader.js]
    DISCOVERY --> CACHE[utils/cache-manager.js]
    DISCOVERY --> WATCHER[lib/file/file-watcher.js]
    
    %% File Operations
    INJECTOR --> SECURITY
    INJECTOR --> WRITER
    WRITER --> SECURITY
    
    %% Semantic Dependencies
    RDF --> N3
    SPARQL --> RDF
    KG --> SPARQL
    KG --> RDF_FILTERS
    
    %% LaTeX Dependencies
    LATEX --> MATH
    LATEX --> CITATION
    MATH --> LATEX_FILTERS
    
    %% Validation Dependencies
    VALIDATOR --> SCHEMA[lib/validation/schema-validator.js]
    SECURITY --> SEC_VALIDATOR[lib/validation/security-validator.js]
    
    %% Cross-cutting Dependencies
    ENGINE --> LOGGER[utils/logger.js]
    INJECTOR --> LOGGER
    RDF --> LOGGER
    LATEX --> LOGGER
    
    ENGINE --> ERROR[utils/error-handler.js]
    INJECTOR --> ERROR
    RDF --> ERROR
    LATEX --> ERROR
    
    DISCOVERY --> ENV[config/env-manager.js]
    CONFIG --> ENV
```

## Module Descriptions

### CLI Layer

#### `cli/index.js`
- **Purpose**: Main CLI entry point and command router
- **Dependencies**: arg-preprocessor, all command modules
- **Exports**: CLI application instance

#### `cli/arg-preprocessor.js`
- **Purpose**: Preprocesses and validates CLI arguments
- **Dependencies**: config-loader, validation modules
- **Exports**: `preprocessArgs(argv)`, `validateFlags(flags)`

### Command Layer

#### `commands/generate.js`
- **Purpose**: Main template generation command
- **Dependencies**: template-engine, file-injector, atomic-writer
- **Exports**: `generateCommand(options)`, `generateFromTemplate(template, vars)`

#### `commands/list.js`
- **Purpose**: Lists available templates and generators
- **Dependencies**: template-discovery, template-inheritance
- **Exports**: `listCommand(options)`, `listTemplates(pattern)`

#### `commands/inject.js`
- **Purpose**: File injection and modification operations
- **Dependencies**: file-injector, path-security
- **Exports**: `injectCommand(options)`, `injectIntoFile(target, content)`

#### `commands/semantic.js`
- **Purpose**: Semantic web and RDF operations
- **Dependencies**: n3-parser, rdf-loader, sparql-query, knowledge-graph
- **Exports**: `semanticCommand(options)`, `queryKnowledgeGraph(query)`

#### `commands/latex.js`
- **Purpose**: LaTeX document generation and processing
- **Dependencies**: latex-processor, math-renderer, citation-handler
- **Exports**: `latexCommand(options)`, `generateLatex(template, data)`

#### `commands/export.js`
- **Purpose**: Export templates and data in various formats
- **Dependencies**: template-engine, rdf-loader
- **Exports**: `exportCommand(options)`, `exportTemplate(format, data)`

### Template System

#### `lib/template/template-engine.js`
- **Purpose**: Core Nunjucks template rendering engine
- **Dependencies**: frontmatter-parser, variable-extractor, all filter modules
- **Exports**: `TemplateEngine` class, `render(template, context)`

#### `lib/template/template-discovery.js`
- **Purpose**: Discovers and indexes available templates
- **Dependencies**: config-loader, cache-manager, file-watcher
- **Exports**: `TemplateDiscovery` class, `discoverTemplates(path)`

#### `lib/template/template-inheritance.js`
- **Purpose**: Handles template inheritance and extension
- **Dependencies**: template-discovery, frontmatter-parser
- **Exports**: `TemplateInheritance` class, `resolveInheritance(template)`

#### `lib/template/variable-extractor.js`
- **Purpose**: Extracts variables from templates for CLI flag generation
- **Dependencies**: frontmatter-parser
- **Exports**: `VariableExtractor` class, `extractVariables(template)`

#### `lib/template/frontmatter-parser.js`
- **Purpose**: Parses YAML frontmatter in templates
- **Dependencies**: None (uses yaml library)
- **Exports**: `FrontmatterParser` class, `parse(content)`

### Filter System

#### `lib/filters/basic-filters.js`
- **Purpose**: Basic Nunjucks filters (string, array, etc.)
- **Dependencies**: None
- **Exports**: Filter registry object

#### `lib/filters/rdf-filters.js`
- **Purpose**: RDF/semantic web specific filters
- **Dependencies**: n3-parser
- **Exports**: RDF filter registry

#### `lib/filters/latex-filters.js`
- **Purpose**: LaTeX formatting and escaping filters
- **Dependencies**: latex-processor
- **Exports**: LaTeX filter registry

#### `lib/filters/semantic-filters.js`
- **Purpose**: Semantic query and knowledge graph filters
- **Dependencies**: sparql-query, knowledge-graph
- **Exports**: Semantic filter registry

### Semantic System

#### `lib/semantic/n3-parser.js`
- **Purpose**: N3/Turtle RDF parsing using N3.js
- **Dependencies**: N3 library
- **Exports**: `N3Parser` class, `parse(content, format)`

#### `lib/semantic/rdf-loader.js`
- **Purpose**: Loads RDF data from various sources
- **Dependencies**: n3-parser
- **Exports**: `RDFLoader` class, `load(source, options)`

#### `lib/semantic/sparql-query.js`
- **Purpose**: SPARQL query execution against RDF stores
- **Dependencies**: rdf-loader
- **Exports**: `SPARQLQuery` class, `execute(query, store)`

#### `lib/semantic/knowledge-graph.js`
- **Purpose**: Knowledge graph operations and reasoning
- **Dependencies**: sparql-query, rdf-filters
- **Exports**: `KnowledgeGraph` class, `buildGraph(data)`

### File System

#### `lib/file/file-injector.js`
- **Purpose**: Injects content into existing files at specific locations
- **Dependencies**: path-security, atomic-writer
- **Exports**: `FileInjector` class, `inject(target, content, options)`

#### `lib/file/atomic-writer.js`
- **Purpose**: Atomic file writing operations
- **Dependencies**: path-security
- **Exports**: `AtomicWriter` class, `write(path, content, options)`

#### `lib/file/path-security.js`
- **Purpose**: Path traversal and security validation
- **Dependencies**: security-validator
- **Exports**: `PathSecurity` class, `validatePath(path)`

#### `lib/file/file-watcher.js`
- **Purpose**: Watches template files for changes
- **Dependencies**: None (uses chokidar)
- **Exports**: `FileWatcher` class, `watch(path, callback)`

### LaTeX System

#### `lib/latex/latex-processor.js`
- **Purpose**: LaTeX document processing and compilation
- **Dependencies**: math-renderer, citation-handler
- **Exports**: `LaTeXProcessor` class, `process(template, data)`

#### `lib/latex/math-renderer.js`
- **Purpose**: Mathematical expression rendering
- **Dependencies**: latex-filters
- **Exports**: `MathRenderer` class, `render(expression, format)`

#### `lib/latex/citation-handler.js`
- **Purpose**: Bibliography and citation management
- **Dependencies**: None
- **Exports**: `CitationHandler` class, `processCitations(content)`

### Validation System

#### `lib/validation/schema-validator.js`
- **Purpose**: JSON Schema validation for templates and data
- **Dependencies**: None (uses ajv)
- **Exports**: `SchemaValidator` class, `validate(data, schema)`

#### `lib/validation/template-validator.js`
- **Purpose**: Template syntax and structure validation
- **Dependencies**: schema-validator
- **Exports**: `TemplateValidator` class, `validate(template)`

#### `lib/validation/security-validator.js`
- **Purpose**: Security-focused validation (XSS, injection, etc.)
- **Dependencies**: None
- **Exports**: `SecurityValidator` class, `validate(content, context)`

### Configuration

#### `config/config-loader.js`
- **Purpose**: Loads and merges configuration from multiple sources
- **Dependencies**: env-manager
- **Exports**: `ConfigLoader` class, `load(options)`

#### `config/env-manager.js`
- **Purpose**: Environment variable management and validation
- **Dependencies**: None
- **Exports**: `EnvManager` class, `get(key)`, `validate(schema)`

### Utilities

#### `utils/logger.js`
- **Purpose**: Structured logging with multiple transports
- **Dependencies**: None (uses winston)
- **Exports**: Logger instance, log levels

#### `utils/error-handler.js`
- **Purpose**: Centralized error handling and reporting
- **Dependencies**: logger
- **Exports**: `ErrorHandler` class, error types

#### `utils/cache-manager.js`
- **Purpose**: Caching for template discovery and rendering
- **Dependencies**: None
- **Exports**: `CacheManager` class, `get(key)`, `set(key, value)`

## Dependency Principles

### 1. Layered Architecture
- CLI → Commands → Libraries → Utils
- No circular dependencies between layers
- Higher layers can depend on lower layers only

### 2. Domain Separation
- Template system is self-contained
- Semantic system is optional and pluggable
- File operations are isolated and secure

### 3. Configuration Injection
- All modules receive configuration through dependency injection
- No direct config file access except in config-loader

### 4. Error Propagation
- Errors bubble up through layers
- Each layer can add context
- Final handling at CLI level

### 5. Testing Isolation
- Each module can be tested independently
- Dependencies are injectable
- Mock-friendly interfaces

## Module Loading Strategy

```javascript
// Lazy loading for performance
const templateEngine = () => require('./lib/template/template-engine');
const semanticSystem = () => require('./lib/semantic/rdf-loader');

// Eager loading for core modules
const pathSecurity = require('./lib/file/path-security');
const errorHandler = require('./utils/error-handler');
```

This structure ensures maintainability, testability, and clear separation of concerns while supporting the full feature set of Unjucks v3.