# TypeScript Type System Architecture

This document maps out the complete TypeScript type system for the Unjucks codebase and provides a comprehensive refactoring plan to unify all types and interfaces.

## Current Type System Analysis

### Core Type Categories

#### 1. RDF/Semantic Types
**Location**: `src/lib/types/turtle-types.ts`, `src/lib/types/semantic-common.ts`

```typescript
// RDF Core Types
interface TurtleData {
  triples: ParsedTriple[];
  subjects: Record<string, any>;
  predicates: Record<string, any>;
  objects: Record<string, any>;
}

interface TurtleParseResult {
  data: TurtleData;
  variables: Record<string, any>;
  metadata: ParseStats;
  namedGraphs?: string[];
}

interface RDFDataSource {
  type: 'file' | 'inline' | 'uri';
  source?: string;
  path?: string;
  content?: string;
  uri?: string;
  options?: TurtleParseOptions;
}

interface RDFDataLoadResult extends TurtleParseResult {
  success: boolean;
  source?: string;
  error?: string;
  errors: string[];
  data: TurtleParseResult;
}

// Semantic Types
interface PropertyDefinition {
  uri: string;
  label: string;
  required: boolean;
  type?: string | TypescriptType;
  domain?: string[];
  range?: string[];
  datatype?: string;
  cardinality?: 'single' | 'multiple';
  name?: string;
  description?: string;
  constraints?: PropertyConstraints;
}

interface TypescriptType {
  interface?: string;
  union?: TypescriptType[];
  literal?: string;
  array?: TypescriptType;
  optional?: boolean;
}

interface ValidationRule {
  id: string;
  name: string;
  description?: string;
  type: 'semantic' | 'syntax' | 'constraint' | 'cross-ontology';
  severity: 'error' | 'warning' | 'info';
  condition: string | Function;
  message: string | Function;
  metadata?: Record<string, any>;
}
```

#### 2. Template Engine Types
**Location**: `src/lib/semantic-template-engine.ts`, `src/lib/template-scanner.ts`

```typescript
// Template Core Types
interface TemplateVariable {
  name: string;
  type: "string" | "boolean" | "number";
  defaultValue?: any;
  description?: string;
  required?: boolean;
}

interface TemplateScanResult {
  variables: TemplateVariable[];
  dependencies: string[];
  metadata: Record<string, any>;
}

interface SemanticContext {
  ontologies: Map<string, OntologyDefinition>;
  validationRules: ValidationRule[];
  mappingRules: CrossOntologyRule[];
  performanceProfile: PerformanceProfile;
}

interface SemanticRenderResult {
  content: string;
  metadata: {
    renderTime: number;
    variablesUsed: string[];
    filtersApplied: string[];
    validationResults: ValidationResult[];
  };
  errors: string[];
  warnings: string[];
}

// Template Configuration
interface TemplateEngineConfig {
  nunjucks?: {
    autoescape?: boolean;
    throwOnUndefined?: boolean;
    trimBlocks?: boolean;
    lstripBlocks?: boolean;
    tags?: {
      blockStart?: string;
      blockEnd?: string;
      variableStart?: string;
      variableEnd?: string;
      commentStart?: string;
      commentEnd?: string;
    };
    globals?: Record<string, any>;
  };
  filters?: Record<string, FilterFunction>;
  variables?: {
    typeInference?: boolean;
    strictTypes?: boolean;
    defaults?: Record<string, any>;
    transforms?: VariableTransformConfig[];
  };
  ejs?: {
    enabled?: boolean;
    delimiter?: string;
    openDelimiter?: string;
    closeDelimiter?: string;
  };
}
```

#### 3. Validation Types
**Location**: `src/lib/validation/ArgumentValidator.ts`, `src/lib/types/validation.ts`

```typescript
// Validation Core Types
interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  suggestions: ValidationSuggestion[];
  metadata: ValidationMetadata;
}

interface ValidationError {
  type: ValidationErrorType;
  message: string;
  code: string;
  severity: 'error' | 'warning' | 'info';
  location?: ValidationLocation;
  context?: Record<string, any>;
  suggestion?: string;
}

interface ValidationWarning {
  type: ValidationWarningType;
  message: string;
  code: string;
  severity: 'warning' | 'info';
  location?: ValidationLocation;
  context?: Record<string, any>;
  suggestion?: string;
}

type ValidationErrorType = 
  | 'missing-required' 
  | 'invalid-type' 
  | 'invalid-value' 
  | 'conflicting-args' 
  | 'unknown-arg'
  | 'semantic-violation'
  | 'syntax-error'
  | 'constraint-violation';

type ValidationWarningType = 
  | 'deprecated' 
  | 'unused-arg' 
  | 'type-mismatch' 
  | 'performance'
  | 'best-practice';
```

#### 4. Configuration Types
**Location**: `docs/book/src/reference/configuration/options.md`

```typescript
// Main Configuration Interface
interface UnjucksConfig {
  templatesDir?: string;
  outputDir?: string;
  cacheDir?: string;
  templateEngine?: TemplateEngineConfig;
  fileOperations?: FileOperationsConfig;
  defaults?: DefaultsConfig;
  hooks?: HooksConfig;
  performance?: PerformanceConfig;
  cache?: CacheConfig;
  security?: SecurityConfig;
  validation?: ValidationConfig;
  semantic?: SemanticConfig;
  enterprise?: EnterpriseConfig;
  development?: DevelopmentConfig;
  plugins?: PluginConfig[];
}

interface FileOperationsConfig {
  create?: {
    overwrite?: boolean;
    backup?: boolean;
    permissions?: string;
  };
  inject?: {
    strategy?: 'append' | 'prepend' | 'replace' | 'custom';
    markers?: {
      start?: string;
      end?: string;
    };
  };
  copy?: {
    preservePermissions?: boolean;
    followSymlinks?: boolean;
  };
}
```

#### 5. MCP (Model Context Protocol) Types
**Location**: `src/mcp/types.ts`

```typescript
interface MCPRequest {
  method: string;
  params?: any;
  id?: string | number;
}

interface MCPResponse {
  result?: any;
  error?: MCPError;
  id?: string | number;
}

interface MCPError {
  code: number;
  message: string;
  data?: any;
}

interface Tool {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, any>;
  };
}

interface ToolCall {
  name: string;
  arguments: Record<string, any>;
}
```

## Unified Type System Design

### Core Principles

1. **Single Source of Truth**: Each type should be defined once and imported everywhere
2. **Hierarchical Organization**: Types should be organized by domain and functionality
3. **Extensibility**: Types should support extension without breaking changes
4. **Type Safety**: All types should be strongly typed with proper constraints
5. **Documentation**: All types should be self-documenting with JSDoc comments

### Proposed Type System Structure

```
src/types/
├── core/
│   ├── base.ts              # Base interfaces and common types
│   ├── errors.ts            # Error handling types
│   └── metadata.ts          # Metadata and context types
├── rdf/
│   ├── turtle.ts            # Turtle parsing types
│   ├── semantic.ts          # Semantic web types
│   └── validation.ts         # RDF validation types
├── template/
│   ├── engine.ts            # Template engine types
│   ├── variables.ts          # Template variable types
│   └── rendering.ts          # Rendering result types
├── validation/
│   ├── rules.ts             # Validation rule types
│   ├── results.ts            # Validation result types
│   └── context.ts            # Validation context types
├── config/
│   ├── main.ts              # Main configuration types
│   ├── engine.ts            # Engine configuration types
│   └── plugins.ts            # Plugin configuration types
├── cli/
│   ├── commands.ts           # CLI command types
│   ├── arguments.ts          # CLI argument types
│   └── output.ts             # CLI output types
└── index.ts                 # Public API exports
```

## Refactoring Implementation Plan

### Phase 1: Core Type Consolidation (Week 1)

#### 1.1 Create Base Type System
- Create `src/types/core/base.ts` with fundamental interfaces
- Define common error types in `src/types/core/errors.ts`
- Establish metadata and context types in `src/types/core/metadata.ts`

#### 1.2 Consolidate RDF Types
- Merge `turtle-types.ts` and `semantic-common.ts` into unified RDF types
- Create `src/types/rdf/turtle.ts` for Turtle-specific types
- Create `src/types/rdf/semantic.ts` for semantic web types
- Create `src/types/rdf/validation.ts` for RDF validation types

#### 1.3 Template Engine Types
- Consolidate template-related types into `src/types/template/`
- Separate engine configuration from runtime types
- Create unified variable and rendering types

### Phase 2: Validation System Unification (Week 2)

#### 2.1 Validation Types Consolidation
- Merge all validation-related interfaces into `src/types/validation/`
- Create unified `ValidationResult` interface
- Standardize error and warning types across all modules

#### 2.2 Configuration Type System
- Consolidate all configuration interfaces into `src/types/config/`
- Create hierarchical configuration types
- Establish plugin configuration standards

### Phase 3: CLI and MCP Types (Week 3)

#### 3.1 CLI Type System
- Create `src/types/cli/` for all CLI-related types
- Unify command, argument, and output types
- Establish CLI error handling standards

#### 3.2 MCP Type Integration
- Integrate MCP types into the unified system
- Create proper type definitions for tool calls and responses
- Establish MCP error handling patterns

### Phase 4: Migration and Testing (Week 4)

#### 4.1 Gradual Migration
- Update imports across all files to use new type system
- Maintain backward compatibility during transition
- Update all type references incrementally

#### 4.2 Type Safety Validation
- Run TypeScript compiler to verify all types are correct
- Update tests to use new type system
- Validate that all functionality still works

## Implementation Strategy

### 1. Backward Compatibility
- Maintain existing interfaces during transition
- Use type aliases to map old names to new names
- Gradual deprecation of old interfaces

### 2. Type Safety
- Use strict TypeScript configuration
- Implement proper type guards and assertions
- Add runtime validation where needed

### 3. Documentation
- Add comprehensive JSDoc comments to all types
- Create type usage examples
- Document migration patterns

### 4. Testing
- Create type tests to ensure interfaces work correctly
- Validate that all existing functionality still works
- Test edge cases and error conditions

## Benefits of Unified Type System

1. **Reduced Duplication**: Single definition for each type
2. **Better IntelliSense**: Improved IDE support and autocomplete
3. **Type Safety**: Catch errors at compile time
4. **Maintainability**: Easier to update and modify types
5. **Documentation**: Self-documenting code with proper types
6. **Refactoring**: Safer refactoring with type checking
7. **API Consistency**: Unified interfaces across all modules
8. **Performance**: Better tree-shaking and optimization

## Migration Checklist

- [ ] Create new type system structure
- [ ] Consolidate RDF types
- [ ] Unify template engine types
- [ ] Consolidate validation types
- [ ] Create configuration type system
- [ ] Integrate CLI types
- [ ] Integrate MCP types
- [ ] Update all imports
- [ ] Run type checking
- [ ] Update tests
- [ ] Document new type system
- [ ] Remove deprecated types
- [ ] Validate functionality
