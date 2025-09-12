# ADR-001: Monorepo Structure with NPM Workspaces

**Status**: Accepted  
**Date**: 2024-01-15  
**Deciders**: KGEN Architecture Team  

## Context

KGEN requires a modular architecture with clear separation of concerns between the CLI interface, core engine, validation rules, and template system. We need to decide on the project structure that best supports development, testing, and deployment.

## Decision

We will use a monorepo structure with NPM workspaces, organizing code into four main packages:

```
kgen/
├── packages/
│   ├── kgen-cli/          # Command-line interface
│   ├── kgen-core/         # Core engine and orchestration  
│   ├── kgen-rules/        # Validation and transformation rules
│   └── kgen-templates/    # Template engine for artifact generation
├── config/                # Shared configurations
└── docs/                  # Architecture and API documentation
```

## Rationale

### Benefits of Monorepo Structure:

1. **Coordinated Development**
   - Single repository for all related packages
   - Atomic commits across packages
   - Easier to maintain consistent APIs

2. **Shared Tooling**
   - Common TypeScript/ESLint configurations
   - Unified build and test scripts
   - Consistent dependency management

3. **Clear Module Boundaries**
   - Each package has distinct responsibility
   - Well-defined interfaces between packages
   - Easier to understand and maintain

4. **Simplified Dependency Management**
   - Workspace dependencies for internal packages
   - Shared devDependencies at root level
   - Consistent versioning strategy

### Package Responsibilities:

#### kgen-cli
- **Purpose**: Command-line interface using citty framework
- **Dependencies**: @kgen/core
- **Exports**: CLI commands (compile, validate, query, init)
- **Key Features**: Configuration loading, argument parsing, user interaction

#### kgen-core  
- **Purpose**: Core engine orchestrating all operations
- **Dependencies**: @kgen/rules, @kgen/templates
- **Exports**: KGENEngine class, graph operations, provenance tracking
- **Key Features**: RDF parsing, SPARQL queries, deterministic processing

#### kgen-rules
- **Purpose**: Validation and transformation rules
- **Dependencies**: n3, rdf-ext, shacl
- **Exports**: Validation engine, SHACL shapes, custom rules
- **Key Features**: Graph validation, compliance checking, rule engine

#### kgen-templates
- **Purpose**: Template-based artifact generation
- **Dependencies**: nunjucks, puppeteer (for PDF), mammoth (for Office)
- **Exports**: Template engine, renderers, format handlers
- **Key Features**: Code generation, document generation, Office/LaTeX support

## Implementation

### Workspace Configuration (package.json):
```json
{
  "name": "kgen",
  "private": true,
  "workspaces": ["packages/*"],
  "scripts": {
    "build": "npm run build --workspaces --if-present",
    "test": "npm run test --workspaces --if-present",
    "kgen": "node packages/kgen-cli/bin/kgen.js"
  }
}
```

### TypeScript Configuration:
- Root `tsconfig.json` with shared settings
- Package-specific `tsconfig.json` extending root config
- Project references for build optimization

### Dependency Strategy:
- **Internal dependencies**: Use `workspace:*` protocol
- **Peer dependencies**: Core types shared across packages  
- **External dependencies**: Minimal, carefully chosen

## Alternatives Considered

### 1. Single Package
**Pros**: Simpler initial setup, fewer configuration files
**Cons**: Poor separation of concerns, harder to maintain, monolithic builds

**Rejected because**: Violates modularity principle, makes testing and development harder

### 2. Separate Repositories  
**Pros**: Complete isolation, independent versioning
**Cons**: Complex dependency management, harder to coordinate changes, API drift

**Rejected because**: Over-engineering for project size, coordination overhead too high

### 3. Lerna Monorepo
**Pros**: Advanced monorepo tooling, independent publishing
**Cons**: Additional complexity, overkill for our needs

**Rejected because**: NPM workspaces provide sufficient functionality with less complexity

## Consequences

### Positive:
- **Clear architecture**: Well-defined package boundaries
- **Easy development**: Single repo clone, unified scripts
- **Consistent tooling**: Shared configurations across packages  
- **Simplified CI/CD**: Single build pipeline
- **Type safety**: TypeScript project references enable cross-package types

### Negative:
- **Build complexity**: Need to build packages in dependency order
- **Version coordination**: All packages typically released together
- **Workspace learning curve**: Developers need to understand workspace semantics

### Mitigation Strategies:
- **Build orchestration**: Use `npm run build --workspaces --if-present`
- **Development scripts**: Convenient npm scripts for common tasks
- **Documentation**: Clear guidelines for workspace development

## Compliance

This decision aligns with:
- **Modularity principle**: Clear separation of concerns
- **Deterministic principle**: Reproducible builds across packages
- **Provenance principle**: Clear dependency tracking

## Implementation Checklist

- [x] Create root package.json with workspace configuration
- [x] Set up packages/ directory structure  
- [x] Create individual package.json files with proper dependencies
- [x] Configure TypeScript project references
- [x] Set up shared tooling (ESLint, build scripts)
- [x] Document development workflow
- [ ] Set up CI/CD pipeline for monorepo
- [ ] Establish versioning and release strategy

## Related ADRs

- ADR-002: TypeScript and JSDoc Type Strategy (pending)
- ADR-003: Dependency Management Strategy (pending)
- ADR-004: Build and Release Strategy (pending)