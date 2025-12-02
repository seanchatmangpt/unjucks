# Ontology-Driven Project Generation Architecture

## Executive Summary

This document defines the comprehensive architecture for generating complete, production-ready projects from RDF/Turtle ontologies in Unjucks. The system transforms semantic knowledge graphs into fully-functional codebases with TypeScript interfaces, API routes, database schemas, service layers, validation, tests, and documentation.

**Vision**: A single ontology file generates a complete, deployable project structure following industry best practices.

---

## 1. System Overview (C4 Context)

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Unjucks Ontology Generation System              │
│                                                                      │
│  ┌────────────┐         ┌──────────────────┐       ┌─────────────┐ │
│  │  Developer │────────▶│  Unjucks CLI     │──────▶│   Generated │ │
│  │            │  .ttl   │  (ontology gen)  │ code  │   Project   │ │
│  └────────────┘  file   └──────────────────┘       └─────────────┘ │
│        │                         │                         │        │
│        │                         ▼                         │        │
│        │              ┌──────────────────┐                 │        │
│        │              │ Ontology Parser  │                 │        │
│        │              │  (N3.js Store)   │                 │        │
│        │              └──────────────────┘                 │        │
│        │                         │                         │        │
│        │                         ▼                         │        │
│        │              ┌──────────────────────────┐         │        │
│        │              │   Mapping Engine         │         │        │
│        │              │  (Class → Types/API/DB)  │         │        │
│        │              └──────────────────────────┘         │        │
│        │                         │                         │        │
│        │                         ▼                         │        │
│        │              ┌──────────────────────────┐         │        │
│        └─────────────▶│  Template Orchestrator   │◀────────┘        │
│                       │  (Nunjucks + Frontmatter)│                  │
│                       └──────────────────────────┘                  │
│                                  │                                  │
│                                  ▼                                  │
│                       ┌──────────────────────────┐                  │
│                       │   File Generator         │                  │
│                       │  (Atomic Write/Inject)   │                  │
│                       └──────────────────────────┘                  │
└─────────────────────────────────────────────────────────────────────┘
```

**External Systems**:
- **N3.js**: RDF/Turtle parsing and querying
- **Nunjucks**: Template rendering engine
- **SPARQL**: Ontology querying
- **Existing Templates**: Reusable template library in `_templates/`

---

## 2. Container Diagram (C4 Level 2)

```
┌──────────────────────────────────────────────────────────────────────────┐
│                    Ontology Generation Container                          │
│                                                                            │
│  ┌─────────────────────┐      ┌────────────────────────────────────────┐ │
│  │  CLI Command Layer  │      │     Core Processing Pipeline            │ │
│  │                     │      │                                         │ │
│  │  unjucks ontology   │─────▶│  1. Parse Phase                         │ │
│  │    generate         │      │     - Load TTL file                     │ │
│  │    --input app.ttl  │      │     - Build N3 Store                    │ │
│  │    --output ./app   │      │     - Validate structure                │ │
│  │    --preset fullstack      │                                         │ │
│  └─────────────────────┘      │  2. Analysis Phase                      │ │
│                               │     - Extract classes (owl:Class)        │ │
│  ┌─────────────────────┐      │     - Extract properties (owl:*Property)│ │
│  │  Configuration      │      │     - Extract relationships             │ │
│  │  Management         │──────│     - Analyze constraints               │ │
│  │                     │      │                                         │ │
│  │  - Presets          │      │  3. Mapping Phase                       │ │
│  │  - Templates        │      │     - Apply mapping rules               │ │
│  │  - Conventions      │      │     - Generate metadata                 │ │
│  │  - Output structure │      │     - Resolve dependencies              │ │
│  └─────────────────────┘      │                                         │ │
│                               │  4. Template Selection Phase            │ │
│  ┌─────────────────────┐      │     - Choose templates per artifact     │ │
│  │  Template Registry  │──────│     - Merge contexts                    │ │
│  │                     │      │     - Prepare variables                 │ │
│  │  - API templates    │      │                                         │ │
│  │  - DB templates     │      │  5. Generation Phase                    │ │
│  │  - Service templates│      │     - Render all templates              │ │
│  │  - Test templates   │      │     - Process frontmatter directives    │ │
│  │  - Doc templates    │      │     - Apply injections                  │ │
│  └─────────────────────┘      │                                         │ │
│                               │  6. Validation Phase                    │ │
│  ┌─────────────────────┐      │     - Verify structure                  │ │
│  │  Reasoning Engine   │      │     - Check completeness                │ │
│  │                     │──────│     - Run basic tests                   │ │
│  │  - OWL2 reasoning   │      │                                         │ │
│  │  - Constraint check │      │  7. Output Phase                        │ │
│  │  - Consistency      │      │     - Write files atomically            │ │
│  └─────────────────────┘      │     - Generate README                   │ │
│                               │     - Create package.json               │ │
│                               └────────────────────────────────────────┘ │
│                                                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                     Data Flow                                        │ │
│  │                                                                      │ │
│  │  TTL File → N3 Store → Ontology AST → Mapping Rules → Template      │ │
│  │  Context → Rendered Files → Validation → Project Structure          │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Component Diagram (C4 Level 3)

### 3.1 Core Components

```
┌────────────────────────────────────────────────────────────────┐
│              Ontology Parser Component                          │
│  Responsibilities:                                              │
│  - Parse RDF/Turtle files                                      │
│  - Build N3.js Store                                           │
│  - Execute SPARQL queries                                      │
│  - Extract triples                                             │
│                                                                 │
│  Key Classes:                                                   │
│  - OntologyLoader                                              │
│  - SPARQLExecutor                                              │
│  - TripleExtractor                                             │
│                                                                 │
│  Input: .ttl file path                                         │
│  Output: N3.Store instance                                     │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│           Ontology Analyzer Component                          │
│  Responsibilities:                                              │
│  - Extract owl:Class definitions                               │
│  - Extract owl:DatatypeProperty                                │
│  - Extract owl:ObjectProperty                                  │
│  - Analyze rdfs:domain and rdfs:range                          │
│  - Detect cardinality constraints                              │
│  - Build dependency graph                                      │
│                                                                 │
│  Key Classes:                                                   │
│  - ClassExtractor                                              │
│  - PropertyExtractor                                           │
│  - RelationshipAnalyzer                                        │
│  - ConstraintAnalyzer                                          │
│  - DependencyGraphBuilder                                      │
│                                                                 │
│  Input: N3.Store                                               │
│  Output: OntologyStructure (AST)                               │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│            Mapping Engine Component                            │
│  Responsibilities:                                              │
│  - Map owl:Class → TypeScript interfaces                       │
│  - Map owl:Class → Database tables                             │
│  - Map owl:ObjectProperty → API endpoints                      │
│  - Map owl:ObjectProperty → Relationships                      │
│  - Map rdfs:domain/range → Type constraints                    │
│  - Generate validation rules from constraints                  │
│                                                                 │
│  Key Classes:                                                   │
│  - TypeScriptMapper                                            │
│  - DatabaseSchemaMapper                                        │
│  - APIRouteMapper                                              │
│  - RelationshipMapper                                          │
│  - ValidationRuleGenerator                                     │
│                                                                 │
│  Mapping Rules:                                                 │
│  - Class → Interface + Table + Resource                        │
│  - DatatypeProperty → Field + Column + Validation              │
│  - ObjectProperty → Relationship + FK + Endpoint               │
│  - Cardinality → Array type + Multiplicity constraint          │
│                                                                 │
│  Input: OntologyStructure                                      │
│  Output: ProjectStructure (mapped artifacts)                   │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│          Template Orchestrator Component                       │
│  Responsibilities:                                              │
│  - Select appropriate templates                                │
│  - Build template contexts                                     │
│  - Coordinate parallel rendering                               │
│  - Merge shared contexts                                       │
│  - Handle template dependencies                                │
│                                                                 │
│  Key Classes:                                                   │
│  - TemplateSelector                                            │
│  - ContextBuilder                                              │
│  - RenderCoordinator                                           │
│  - DependencyResolver                                          │
│                                                                 │
│  Template Selection Logic:                                      │
│  - Per-class templates (API, Service, Tests)                   │
│  - Global templates (Package.json, README, Config)             │
│  - Relationship templates (Join tables, Associations)          │
│                                                                 │
│  Input: ProjectStructure                                       │
│  Output: RenderPlan[]                                          │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│            File Generator Component                            │
│  Responsibilities:                                              │
│  - Render Nunjucks templates                                   │
│  - Process frontmatter directives (to:, inject:, etc.)         │
│  - Atomic file writing                                         │
│  - Handle file injections (skipIf, lineAt, append, etc.)       │
│  - Ensure idempotency                                          │
│                                                                 │
│  Key Classes:                                                   │
│  - NunjucksRenderer                                            │
│  - FrontmatterProcessor                                        │
│  - AtomicFileWriter                                            │
│  - FileInjector                                                │
│                                                                 │
│  Features:                                                      │
│  - Dry-run mode                                                │
│  - Force overwrite                                             │
│  - Smart merging                                               │
│  - Conflict detection                                          │
│                                                                 │
│  Input: RenderPlan[]                                           │
│  Output: Generated files on disk                               │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│           Validation Component                                 │
│  Responsibilities:                                              │
│  - Verify generated file structure                             │
│  - Check TypeScript compilation                                │
│  - Validate database schema                                    │
│  - Run basic integration tests                                 │
│  - Generate validation report                                  │
│                                                                 │
│  Key Classes:                                                   │
│  - StructureValidator                                          │
│  - TypeScriptValidator                                         │
│  - SchemaValidator                                             │
│  - IntegrationTestRunner                                       │
│                                                                 │
│  Input: Generated project path                                 │
│  Output: ValidationReport                                      │
└────────────────────────────────────────────────────────────────┘
```

---

## 4. Key Design Decisions (ADRs)

### ADR-001: Use N3.js for RDF Parsing

**Status**: Accepted

**Context**: Need a robust RDF/Turtle parser that supports SPARQL-like queries.

**Decision**: Use N3.js as the core RDF parsing and querying engine.

**Rationale**:
- Already integrated in OntologyTemplateEngine
- Supports Turtle, N-Triples, N-Quads
- Fast and memory-efficient
- Active maintenance

**Consequences**:
- Positive: Proven performance, good API
- Negative: Limited SPARQL support (need custom query layer)

---

### ADR-002: Template-Driven Generation over Code Generation

**Status**: Accepted

**Context**: Choose between direct code generation vs. template-based approach.

**Decision**: Use Nunjucks templates with frontmatter for all generation.

**Rationale**:
- Leverages existing template infrastructure
- Easy customization by users
- Clear separation of concerns
- Supports injection and idempotency

**Consequences**:
- Positive: Flexible, maintainable, user-customizable
- Negative: Templates must be created for all artifact types

---

### ADR-003: Three-Phase Mapping Strategy

**Status**: Accepted

**Context**: How to map ontology constructs to code artifacts.

**Decision**: Use three-phase mapping: Analysis → Mapping → Generation

**Rationale**:
- Clean separation of concerns
- Enables validation at each phase
- Supports multiple output formats
- Easier to debug and test

**Phases**:
1. **Analysis**: Extract pure ontology structure
2. **Mapping**: Apply transformation rules
3. **Generation**: Render to files

**Consequences**:
- Positive: Clean architecture, testable
- Negative: More complexity than direct generation

---

### ADR-004: Support Both Batch and Incremental Generation

**Status**: Accepted

**Context**: Generate entire projects or single artifacts.

**Decision**: Support both modes with shared core pipeline.

**Rationale**:
- Initial generation needs full project
- Updates may only need single artifacts
- Enables iterative development

**Modes**:
- `--mode batch`: Generate complete project
- `--mode incremental --class UserClass`: Generate artifacts for one class

**Consequences**:
- Positive: Flexible workflow
- Negative: Need dependency tracking for incremental mode

---

### ADR-005: Use Presets for Common Project Types

**Status**: Accepted

**Context**: Different ontologies map to different project types.

**Decision**: Define presets for common architectures.

**Presets**:
- `fullstack`: REST API + Database + Frontend
- `api-only`: REST API + Service layer
- `graphql`: GraphQL API + Resolvers
- `microservice`: Service + Message queue + Events
- `data-model`: Types + Validation only

**Rationale**:
- Reduces configuration burden
- Encodes best practices
- Easy to extend

**Consequences**:
- Positive: Quick start, best practices
- Negative: Need maintenance of presets

---

### ADR-006: Deterministic Output for Version Control

**Status**: Accepted

**Context**: Generated files should be VCS-friendly.

**Decision**: Ensure deterministic, idempotent generation.

**Requirements**:
- Same input → same output
- Stable file ordering
- Consistent formatting
- Git-friendly diffs

**Implementation**:
- Sort class/property lists alphabetically
- Use deterministic IDs
- Format with Prettier/ESLint
- Skip timestamps in generated code

**Consequences**:
- Positive: VCS-friendly, reproducible
- Negative: Slightly more complex generation logic

---

## 5. Data Models

### 5.1 OntologyStructure (AST)

```typescript
interface OntologyStructure {
  ontologyURI: string;
  metadata: OntologyMetadata;
  classes: ClassDefinition[];
  datatypeProperties: DatatypePropertyDefinition[];
  objectProperties: ObjectPropertyDefinition[];
  individuals: IndividualDefinition[];
  constraints: Constraint[];
  imports: string[];
}

interface ClassDefinition {
  uri: string;
  label: string;
  comment?: string;
  subClassOf?: string[];
  equivalentClass?: string[];
  properties: PropertyReference[];
  constraints: Constraint[];
}

interface DatatypePropertyDefinition {
  uri: string;
  label: string;
  domain: string[];    // Class URIs
  range: string[];     // XSD types
  functional: boolean;
  required: boolean;
  constraints: Constraint[];
}

interface ObjectPropertyDefinition {
  uri: string;
  label: string;
  domain: string[];    // Class URIs
  range: string[];     // Class URIs
  functional: boolean;
  inverseFunctional: boolean;
  symmetric: boolean;
  transitive: boolean;
  constraints: Constraint[];
}

interface Constraint {
  type: 'cardinality' | 'value' | 'pattern' | 'custom';
  property: string;
  value: any;
  severity: 'error' | 'warning';
}
```

### 5.2 ProjectStructure (Mapped)

```typescript
interface ProjectStructure {
  projectName: string;
  preset: ProjectPreset;

  types: TypeDefinition[];          // TypeScript interfaces
  database: DatabaseSchema;         // DB tables/schemas
  api: APIDefinition;               // Routes, controllers
  services: ServiceDefinition[];    // Business logic
  validation: ValidationRules[];    // Validation schemas
  tests: TestSuite[];               // BDD tests
  documentation: Documentation;     // Generated docs

  dependencies: Dependency[];
  configuration: ProjectConfiguration;
}

interface TypeDefinition {
  name: string;                     // e.g., "User"
  sourceClass: string;              // OWL class URI
  fields: TypeField[];
  imports: string[];
  validations: ValidationRule[];
}

interface DatabaseSchema {
  tables: TableDefinition[];
  relationships: Relationship[];
  migrations: Migration[];
}

interface APIDefinition {
  baseRoute: string;
  resources: APIResource[];
  middleware: Middleware[];
}

interface APIResource {
  path: string;                     // e.g., "/users"
  methods: HTTPMethod[];            // GET, POST, etc.
  controller: string;               // Controller class
  handlers: RequestHandler[];
  validation: ValidationSchema;
  sourceClass: string;              // OWL class URI
}
```

### 5.3 RenderPlan

```typescript
interface RenderPlan {
  id: string;
  template: string;                 // Template path
  context: Record<string, any>;     // Template variables
  outputPath: string;               // Destination path
  frontmatter: FrontmatterDirectives;
  dependencies: string[];           // Other render plans this depends on
  priority: number;
}

interface FrontmatterDirectives {
  to?: string;                      // Output file path (dynamic)
  inject?: boolean;                 // Inject vs. create
  before?: string;                  // Injection marker
  after?: string;
  append?: boolean;
  prepend?: boolean;
  lineAt?: number;
  skipIf?: string;                  // Conditional skip
  chmod?: string;                   // File permissions
  sh?: string;                      // Post-generation script
}
```

---

## 6. Technology Stack

### Core Technologies
- **N3.js**: RDF/Turtle parsing and SPARQL querying
- **Nunjucks**: Template rendering engine
- **TypeScript**: Type-safe generation logic
- **Citty**: CLI framework
- **Vitest**: Testing framework (London School TDD)

### Supporting Libraries
- **fs-extra**: File system operations
- **glob**: File pattern matching
- **fast-glob**: Fast file discovery
- **chalk**: Terminal styling
- **execa**: Process execution
- **zod**: Runtime validation

### Integration Points
- **Existing OntologyTemplateEngine**: Reuse for basic operations
- **UltimateOntologyOrchestrator**: Advanced reasoning and repair
- **Template Registry**: `_templates/` directory structure
- **MCP Tools**: Claude Flow coordination for complex workflows

---

## 7. Quality Attributes

### Performance
- **Target**: Generate 100-class ontology in < 30 seconds
- **Strategy**: Parallel template rendering, incremental updates
- **Optimization**: Cache parsed ontologies, lazy loading

### Scalability
- **Target**: Support ontologies with 1000+ classes
- **Strategy**: Stream processing, chunked generation
- **Limits**: Memory budget per operation

### Maintainability
- **Target**: New template creation in < 30 minutes
- **Strategy**: Clear documentation, example templates
- **Testing**: 80%+ coverage, BDD scenarios

### Usability
- **Target**: Zero config for common presets
- **Strategy**: Intelligent defaults, preset library
- **Help**: Interactive mode for configuration

### Reliability
- **Target**: 100% deterministic output
- **Strategy**: No timestamps, sorted outputs
- **Validation**: Pre and post-generation checks

---

## 8. Security Considerations

### Input Validation
- Validate ontology files before parsing
- Sanitize URIs and labels
- Check for malicious SPARQL queries

### Output Sanitization
- Escape template variables
- Validate file paths (no path traversal)
- Sandbox shell commands

### Dependency Management
- Pin exact versions
- Regular security audits
- Minimal dependencies

---

## 9. Deployment Architecture

### CLI Deployment
```
unjucks (global CLI)
  ├── Core generation engine
  ├── Template registry
  ├── Ontology parsers
  └── Output validators
```

### Project Structure (Generated)
```
generated-project/
├── src/
│   ├── types/          # TypeScript interfaces
│   ├── api/            # API routes & controllers
│   ├── services/       # Business logic
│   ├── database/       # Schemas & migrations
│   └── validation/     # Zod schemas
├── tests/
│   ├── unit/           # Unit tests
│   ├── integration/    # Integration tests
│   └── bdd/            # BDD scenarios
├── docs/
│   ├── api/            # API documentation
│   └── ontology/       # Ontology docs
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

---

## 10. Monitoring & Observability

### Generation Metrics
- Total generation time
- Per-template render time
- File count and size
- Validation pass/fail rate

### Error Tracking
- Parse errors with context
- Mapping errors with suggestions
- Template errors with line numbers
- Validation errors with fixes

### Logging
- Structured JSON logs
- Debug mode for verbose output
- Performance profiling mode

---

## 11. Testing Strategy

### Unit Tests (London School TDD)
- Mock external dependencies
- Test each component in isolation
- Fast execution (< 1s per suite)

### Integration Tests
- Real ontology files
- Full generation pipeline
- Validate output structure

### BDD Scenarios (Vitest + Cucumber)
```gherkin
Feature: Full Stack Generation from Ontology

  Scenario: Generate complete project from simple ontology
    Given an ontology file "simple-app.ttl" with 3 classes
    When I run "unjucks ontology generate --preset fullstack"
    Then I should see a project structure with:
      | types      | 3 TypeScript interfaces |
      | api        | 3 REST resources        |
      | database   | 3 database tables       |
      | services   | 3 service classes       |
      | tests      | 9 test files            |
    And the generated code should compile without errors
    And the tests should pass
```

### Performance Tests
- Benchmark generation time
- Memory usage profiling
- Large ontology stress tests (1000+ classes)

---

## 12. Migration Path

### Phase 1: Foundation (Current Sprint)
- Architecture documentation (this document)
- Mapping strategy design
- Pipeline design

### Phase 2: Core Implementation (Next Sprint)
- Ontology Parser component
- Ontology Analyzer component
- Mapping Engine component

### Phase 3: Template Integration (Sprint 3)
- Template Orchestrator
- File Generator
- Existing template adaptation

### Phase 4: Validation & Testing (Sprint 4)
- Validation component
- Test suite (unit + integration + BDD)
- Performance benchmarks

### Phase 5: Polish & Documentation (Sprint 5)
- CLI polish
- User documentation
- Example projects

---

## 13. Success Criteria

### Functional Requirements
- ✅ Parse any valid OWL2 ontology
- ✅ Generate TypeScript interfaces for all classes
- ✅ Generate REST API for all classes
- ✅ Generate database schema with relationships
- ✅ Generate service layer with CRUD
- ✅ Generate validation rules from constraints
- ✅ Generate BDD tests for all endpoints
- ✅ Generate API documentation

### Non-Functional Requirements
- ✅ Generation time < 30s for 100 classes
- ✅ Support 1000+ class ontologies
- ✅ 100% deterministic output
- ✅ 80%+ test coverage
- ✅ Zero manual edits needed for common cases

### User Experience
- ✅ Zero config for presets
- ✅ Interactive mode for customization
- ✅ Clear error messages with fixes
- ✅ Dry-run mode for preview

---

## 14. Future Enhancements

### Incremental Updates
- Detect ontology changes
- Update only affected files
- Preserve manual edits

### Multi-Language Support
- Python/FastAPI generation
- Java/Spring Boot generation
- Go/Fiber generation

### Advanced Features
- GraphQL schema generation
- OpenAPI spec generation
- Event sourcing patterns
- CQRS architecture

### AI Enhancement
- Claude Flow swarm coordination
- Intelligent template selection
- Code optimization suggestions

---

## 15. References

### Internal Documentation
- `src/core/ontology-template-engine.js` - Existing engine
- `src/cli/commands/ontology.js` - CLI commands
- `src/ontology/ultimate-ontology-orchestrator.js` - Advanced features
- `_templates/` - Template library

### External Standards
- OWL2 Web Ontology Language: https://www.w3.org/TR/owl2-overview/
- RDF 1.1 Turtle: https://www.w3.org/TR/turtle/
- SPARQL 1.1 Query Language: https://www.w3.org/TR/sparql11-query/

### Design Patterns
- C4 Model: https://c4model.com/
- Clean Architecture: https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html
- Domain-Driven Design: https://martinfowler.com/bliki/DomainDrivenDesign.html

---

**Document Version**: 1.0.0
**Last Updated**: 2025-12-01
**Authors**: System Architecture Team
**Status**: APPROVED for Implementation
