# Unjucks V3 Architecture

## Overview
Unjucks V3 is a focused, reliable Hygen-style CLI generator with advanced semantic capabilities. This architecture represents a complete redesign focused on simplicity, reliability, and powerful semantic features.

## Core Principles
1. **Simplicity First** - Remove complexity, focus on core template generation
2. **Semantic Power** - Leverage RDF/Turtle for advanced code generation
3. **Document Excellence** - First-class LaTeX and professional document support
4. **Reliable Operations** - Atomic writes, path security, error recovery

## Architecture Diagrams

### 1. [System Architecture](./01-system-architecture.md)
**High-level system overview showing core components:**
- CLI Interface (Citty-based command system)
- Template Engine (Nunjucks with 65+ filters)
- RDF Processor (N3.js semantic capabilities)
- File Operations (Atomic writes with security)
- Document Generators (LaTeX, HTML, Markdown)

### 2. [CLI Sequence Flow](./02-cli-sequence.md)
**Command execution lifecycle from user input to file generation:**
- Command parsing and validation
- Template discovery and selection
- Variable collection and processing
- Template rendering with data injection
- File writing with atomic operations

### 3. [Module Structure](./03-module-structure.md)
**Source code organization and internal dependencies:**
- `/src/commands/` - CLI command implementations
- `/src/lib/` - Core engine and utilities
- `/src/filters/` - Nunjucks filter extensions
- `/src/semantic/` - RDF processing modules
- `/src/generators/` - Document generation engines

### 4. [Template Processing](./04-template-processing.md)
**Template parsing, rendering, and injection pipeline:**
- Frontmatter parsing for metadata
- Variable extraction and validation
- Nunjucks rendering with filter chains
- Content injection strategies (replace, append, prepend)
- Path resolution and security validation

### 5. [Data Flow](./05-data-flow.md)
**Data transformations throughout the system:**
- User input → CLI arguments → template variables
- Template files → parsed AST → rendered content
- RDF data → semantic queries → generated code
- Generated content → file operations → output files

### 6. [Feature Mind Map](./06-feature-mindmap.md)
**Complete feature set visualization:**
- Core template generation capabilities
- Advanced semantic processing
- Document export formats
- CLI usability features
- Error handling and recovery

### 7. [Filter Pipeline](./07-filter-pipeline.md)
**65+ filter system and chaining architecture:**
- String manipulation filters
- Code generation filters
- Semantic processing filters
- Document formatting filters
- Custom filter registration

### 8. [RDF Processing](./08-rdf-processing.md)
**Semantic web capabilities with N3.js:**
- Turtle/RDF parsing and validation
- SPARQL-like query processing
- Ontology-driven code generation
- Schema validation and inference

### 9. [Error Handling](./09-error-handling.md)
**Comprehensive error flows and recovery strategies:**
- Template parsing errors
- Variable validation failures
- File operation conflicts
- RDF processing errors
- Recovery and rollback mechanisms

### 10. [Template Structure](./10-template-structure.md)
**Template organization and format specifications:**
- Frontmatter metadata structure
- File naming conventions
- Directory organization patterns
- Injection point definitions

### 11. [Deployment](./11-deployment.md)
**Package distribution and runtime environment:**
- NPM package structure
- Binary distribution
- Runtime dependencies
- Installation and setup

## System Architecture Overview

### Core Components Integration

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   CLI Layer     │    │  Template       │    │  Output         │
│  (Citty-based) │───▶│  Engine         │───▶│  Generation     │
│                 │    │  (Nunjucks)     │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Command        │    │  Filter         │    │  File           │
│  Processing     │    │  Pipeline       │    │  Operations     │
│                 │    │  (65+ filters)  │    │  (Atomic)       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  RDF/Semantic   │    │  Document       │    │  Security &     │
│  Processing     │    │  Generators     │    │  Validation     │
│  (N3.js)        │    │  (LaTeX/HTML)   │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Key Design Decisions

### What We Keep (40% Direct Use)
- **RDF/Turtle processing** with N3.js for semantic capabilities
- **65+ Nunjucks filters** for comprehensive text processing
- **Frontmatter injection system** for flexible content insertion
- **Citty CLI architecture** for modern command-line experience
- **LaTeX document generation** for professional document output

### What We Refactor (35%)
- **Simplify file operations** - Focus on atomic writes and path security
- **Streamline export formats** - HTML, Markdown, and LaTeX only
- **Optimize template discovery** - Faster indexing and caching
- **Enhance error handling** - Better error messages and recovery

### What We Drop (25%)
- **MCP integration** - Removes external dependencies
- **AI/Swarm features** - Focuses on core generation
- **Complex CI/CD** - Simplifies deployment
- **Excessive documentation** - Keeps only essential docs

## Data Flow Architecture

### Primary Flows

1. **Template Generation Flow**
   ```
   User Command → Template Discovery → Variable Collection → 
   Rendering → File Operations → Output Verification
   ```

2. **Semantic Processing Flow**
   ```
   RDF Input → Parsing → Query Processing → 
   Code Generation → Template Integration → Output
   ```

3. **Document Export Flow**
   ```
   Template Content → Format Selection → 
   Generator Pipeline → Asset Processing → Final Document
   ```

## Implementation Phases

### Phase 1: Core Template Engine (Week 1-2)
- **Foundation**: Nunjucks integration with basic filters
- **CLI**: Basic Citty command structure
- **Templates**: Simple template discovery and rendering
- **Output**: Basic file writing with atomic operations

### Phase 2: Hygen-style CLI (Week 3-4)
- **Commands**: Complete CLI command set (list, help, generate)
- **Variables**: Dynamic variable extraction and prompting
- **Injection**: Frontmatter-based content injection
- **Validation**: Path security and input validation

### Phase 3: RDF/Semantic Capabilities (Week 5-6)
- **RDF Parser**: N3.js integration for Turtle processing
- **Queries**: SPARQL-like query capabilities
- **Generation**: Ontology-driven code generation
- **Integration**: Semantic filters in template pipeline

### Phase 4: Document Export (Week 7-8)
- **LaTeX**: Professional document generation
- **HTML**: Web-ready output with styling
- **Markdown**: Documentation-friendly format
- **Assets**: Image and resource handling

## Quality Assurance

### Testing Strategy
- **Unit Tests**: 90%+ coverage for core modules
- **Integration Tests**: End-to-end CLI workflows
- **Template Tests**: Validation of all template formats
- **Performance Tests**: Large template set processing

### Security Measures
- **Path Validation**: Prevent directory traversal
- **Input Sanitization**: Clean all user inputs
- **Atomic Operations**: Prevent partial file writes
- **Permission Checks**: Validate file access rights

### Error Recovery
- **Graceful Degradation**: Fallback for missing dependencies
- **Rollback Capability**: Undo failed operations
- **Clear Messaging**: Actionable error descriptions
- **Debug Mode**: Detailed operation logging

## Performance Targets

- **Template Discovery**: < 100ms for 1000+ templates
- **Rendering Speed**: < 10ms per template
- **Memory Usage**: < 50MB for typical workloads
- **Startup Time**: < 200ms for CLI commands

## Extension Points

### Custom Filters
```javascript
// Register custom filter
unjucks.addFilter('myFilter', (value, args) => {
  return processValue(value, args);
});
```

### Template Hooks
```yaml
# Frontmatter hooks
hooks:
  pre_render: validate_schema
  post_render: format_code
  pre_write: backup_existing
```

### Semantic Extensions
```turtle
# Custom ontology
@prefix my: <http://example.com/ontology#> .
my:Component a rdfs:Class ;
  my:generates "component.js.njk" .
```

## Deployment Architecture

### Package Structure
```
unjucks/
├── bin/           # CLI executables
├── lib/           # Compiled TypeScript
├── templates/     # Built-in templates
├── docs/          # Architecture documentation
└── package.json   # NPM configuration
```

### Runtime Dependencies
- **Node.js**: >= 18.0.0
- **N3.js**: RDF processing
- **Nunjucks**: Template engine
- **Citty**: CLI framework
- **c12**: Configuration management

## Migration Strategy

### From V2 to V3
1. **Template Migration**: Automated frontmatter conversion
2. **Command Mapping**: V2 → V3 command equivalents
3. **Filter Updates**: Breaking changes documentation
4. **Data Preservation**: Export/import for user data

This architecture ensures Unjucks V3 delivers on its promise of being a simple, powerful, and reliable template generation system with advanced semantic capabilities while maintaining excellent performance and user experience.