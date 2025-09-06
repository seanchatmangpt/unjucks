# TypeScript Refactoring Implementation Plan

This document provides a detailed implementation plan for refactoring the TypeScript type system to eliminate all errors and create a unified, maintainable type architecture.

## Current Error Analysis

Based on the TypeScript compiler output, we have identified these error categories:

### 1. API Signature Mismatches (1,200+ errors)
- **Pattern**: `Expected X arguments, but got Y`
- **Root Cause**: Incorrect method signatures for external libraries
- **Files**: `tests/validation/rdf-data-validation.test.ts`, `tests/validation/rdf-template-validation.test.ts`

### 2. Missing Properties (800+ errors)
- **Pattern**: `Property 'X' does not exist on type 'Y'`
- **Root Cause**: Incomplete interface definitions
- **Files**: Multiple test files expecting properties not defined in interfaces

### 3. Import/Export Issues (300+ errors)
- **Pattern**: `Cannot find module` or `has no exported member`
- **Root Cause**: Incorrect import statements and missing dependencies
- **Files**: Various files importing non-existent modules

### 4. Type Safety Issues (500+ errors)
- **Pattern**: `Type 'X' is not assignable to type 'Y'`
- **Root Cause**: Type mismatches and incorrect type assertions
- **Files**: Configuration files and test files

### 5. Method Signature Mismatches (400+ errors)
- **Pattern**: `Expected X arguments, but got Y` for class methods
- **Root Cause**: Incorrect method implementations
- **Files**: Core library files

## Refactoring Strategy

### Phase 1: Foundation Types (Days 1-2)

#### 1.1 Create Core Type System
```typescript
// src/types/core/base.ts
export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, any>;
}

export interface BaseError {
  code: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
  context?: Record<string, any>;
  timestamp: Date;
}

export interface BaseResult<T = any> {
  success: boolean;
  data?: T;
  error?: BaseError;
  metadata?: Record<string, any>;
}
```

#### 1.2 RDF Type System
```typescript
// src/types/rdf/turtle.ts
export interface TurtleParseResult {
  success: boolean;
  data: {
    triples: ParsedTriple[];
    subjects: Record<string, any>;
    predicates: Record<string, any>;
    objects: Record<string, any>;
  };
  variables: Record<string, any>;
  metadata: {
    loadTime: number;
    sourceCount: number;
    parseStats: ParseStats;
  };
  errors: string[];
  warnings: string[];
  namedGraphs?: string[];
}

export interface ParsedTriple {
  subject: {
    value: string;
    type: 'uri' | 'blank' | 'literal';
  };
  predicate: {
    value: string;
    type: 'uri';
  };
  object: {
    value: string;
    type: 'uri' | 'blank' | 'literal';
    datatype?: string;
    language?: string;
  };
  graph?: {
    value: string;
    type: 'uri' | 'blank' | 'default';
  };
}

export interface ParseStats {
  tripleCount: number;
  subjectCount: number;
  predicateCount: number;
  objectCount: number;
  namedGraphCount?: number;
  parseTimeMs: number;
  memoryUsed: number;
}
```

#### 1.3 RDF Data Loader Types
```typescript
// src/types/rdf/loader.ts
export interface RDFDataSource {
  type: 'file' | 'inline' | 'uri';
  source?: string;
  path?: string;
  content?: string;
  uri?: string;
  options?: TurtleParseOptions;
}

export interface RDFDataLoadResult extends TurtleParseResult {
  source?: string;
  error?: string;
}

export interface RDFDataLoaderOptions {
  baseUri?: string;
  validateSyntax?: boolean;
  cacheEnabled?: boolean;
  cacheTTL?: number;
  httpTimeout?: number;
  templateDir?: string;
  maxRetries?: number;
  retryDelay?: number;
}

export interface QueryOptions {
  query: string;
  variables?: Record<string, any>;
  timeout?: number;
}

export interface QueryResult {
  success: boolean;
  data?: any[];
  error?: string;
  metadata?: {
    executionTime: number;
    resultCount: number;
  };
}
```

### Phase 2: Template Engine Types (Days 3-4)

#### 2.1 Template Core Types
```typescript
// src/types/template/engine.ts
export interface TemplateEngineConfig {
  nunjucks?: NunjucksConfig;
  filters?: Record<string, FilterFunction>;
  variables?: VariableConfig;
  ejs?: EJSConfig;
}

export interface NunjucksConfig {
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
}

export interface VariableConfig {
  typeInference?: boolean;
  strictTypes?: boolean;
  defaults?: Record<string, any>;
  transforms?: VariableTransformConfig[];
}

export interface VariableTransformConfig {
  match: string | RegExp;
  transform: (value: any) => any;
  when?: 'before' | 'after';
}

export type FilterFunction = (value: any, ...args: any[]) => any;
```

#### 2.2 Template Variable Types
```typescript
// src/types/template/variables.ts
export interface TemplateVariable {
  name: string;
  type: 'string' | 'boolean' | 'number' | 'array' | 'object';
  defaultValue?: any;
  description?: string;
  required?: boolean;
  choices?: any[];
  validation?: VariableValidation;
}

export interface VariableValidation {
  min?: number;
  max?: number;
  pattern?: string;
  custom?: (value: any) => boolean;
}

export interface TemplateScanResult {
  variables: TemplateVariable[];
  dependencies: string[];
  metadata: {
    scanTime: number;
    fileCount: number;
    complexity: 'low' | 'medium' | 'high';
  };
}
```

#### 2.3 Template Rendering Types
```typescript
// src/types/template/rendering.ts
export interface SemanticRenderResult {
  content: string;
  metadata: {
    renderTime: number;
    variablesUsed: string[];
    filtersApplied: string[];
    validationResults: ValidationResult[];
    performance: PerformanceMetrics;
  };
  errors: string[];
  warnings: string[];
}

export interface PerformanceMetrics {
  memoryUsed: number;
  cpuTime: number;
  cacheHits: number;
  cacheMisses: number;
}
```

### Phase 3: Validation System (Days 5-6)

#### 3.1 Validation Core Types
```typescript
// src/types/validation/core.ts
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  suggestions: ValidationSuggestion[];
  metadata: ValidationMetadata;
}

export interface ValidationError {
  type: ValidationErrorType;
  message: string;
  code: string;
  severity: 'error' | 'warning' | 'info';
  location?: ValidationLocation;
  context?: Record<string, any>;
  suggestion?: string;
  timestamp: Date;
}

export interface ValidationWarning {
  type: ValidationWarningType;
  message: string;
  code: string;
  severity: 'warning' | 'info';
  location?: ValidationLocation;
  context?: Record<string, any>;
  suggestion?: string;
  timestamp: Date;
}

export interface ValidationSuggestion {
  type: 'fix' | 'improvement' | 'best-practice';
  message: string;
  code?: string;
  priority: 'low' | 'medium' | 'high';
}

export interface ValidationLocation {
  file?: string;
  line?: number;
  column?: number;
  range?: {
    start: number;
    end: number;
  };
}

export interface ValidationMetadata {
  validationTime: number;
  rulesApplied: string[];
  context: Record<string, any>;
}
```

#### 3.2 Validation Rule Types
```typescript
// src/types/validation/rules.ts
export interface ValidationRule {
  id: string;
  name: string;
  description?: string;
  type: ValidationRuleType;
  severity: 'error' | 'warning' | 'info';
  condition: string | ValidationConditionFunction;
  message: string | ValidationMessageFunction;
  metadata?: Record<string, any>;
}

export type ValidationRuleType = 
  | 'semantic' 
  | 'syntax' 
  | 'constraint' 
  | 'cross-ontology'
  | 'performance'
  | 'security';

export type ValidationConditionFunction = (
  value: any,
  context: ValidationContext
) => boolean | Promise<boolean>;

export type ValidationMessageFunction = (
  value: any,
  context: ValidationContext
) => string;

export interface ValidationContext {
  args?: Record<string, any>;
  command?: string;
  subcommand?: string;
  templateContext?: TemplateContext;
  environment?: EnvironmentInfo;
  rdfContext?: RDFContext;
}
```

### Phase 4: Configuration Types (Days 7-8)

#### 4.1 Main Configuration
```typescript
// src/types/config/main.ts
export interface UnjucksConfig {
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

export interface FileOperationsConfig {
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

export interface PerformanceConfig {
  level: 'development' | 'balanced' | 'production';
  cacheEnabled: boolean;
  indexingEnabled: boolean;
  parallelProcessing: boolean;
  maxMemoryUsage: number;
  maxProcessingTime: number;
}
```

### Phase 5: CLI Types (Days 9-10)

#### 5.1 CLI Command Types
```typescript
// src/types/cli/commands.ts
export interface CLICommand {
  name: string;
  description: string;
  usage: string;
  arguments: CLIArgument[];
  options: CLIOption[];
  examples: string[];
  subcommands?: CLICommand[];
}

export interface CLIArgument {
  name: string;
  description: string;
  type: 'string' | 'number' | 'boolean' | 'array';
  required: boolean;
  default?: any;
  choices?: any[];
  validation?: ArgumentValidation;
}

export interface CLIOption {
  name: string;
  short?: string;
  description: string;
  type: 'string' | 'number' | 'boolean' | 'array';
  default?: any;
  choices?: any[];
  validation?: ArgumentValidation;
}

export interface ArgumentValidation {
  min?: number;
  max?: number;
  pattern?: string;
  custom?: (value: any) => boolean;
}
```

#### 5.2 CLI Output Types
```typescript
// src/types/cli/output.ts
export interface CLIOutput {
  success: boolean;
  data?: any;
  error?: CLIError;
  warnings?: CLIWarning[];
  metadata?: {
    executionTime: number;
    memoryUsed: number;
    filesProcessed: number;
  };
}

export interface CLIError {
  code: string;
  message: string;
  details?: string;
  suggestions?: string[];
  context?: Record<string, any>;
}

export interface CLIWarning {
  code: string;
  message: string;
  suggestion?: string;
  context?: Record<string, any>;
}
```

### Phase 6: MCP Types (Days 11-12)

#### 6.1 MCP Core Types
```typescript
// src/types/mcp/core.ts
export interface MCPRequest {
  method: string;
  params?: Record<string, any>;
  id?: string | number;
  timestamp?: Date;
}

export interface MCPResponse {
  result?: any;
  error?: MCPError;
  id?: string | number;
  timestamp?: Date;
}

export interface MCPError {
  code: number;
  message: string;
  data?: any;
  timestamp?: Date;
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, any>;
    required?: string[];
  };
  outputSchema?: {
    type: "object";
    properties: Record<string, any>;
  };
}

export interface MCPToolCall {
  name: string;
  arguments: Record<string, any>;
  timestamp?: Date;
}
```

## Implementation Steps

### Step 1: Create Type System Structure
```bash
mkdir -p src/types/{core,rdf,template,validation,config,cli,mcp}
touch src/types/{core,rdf,template,validation,config,cli,mcp}/index.ts
touch src/types/index.ts
```

### Step 2: Implement Core Types
- Create base interfaces and common types
- Establish error handling patterns
- Define metadata and context types

### Step 3: Implement RDF Types
- Consolidate Turtle parsing types
- Create semantic web types
- Define RDF validation types

### Step 4: Implement Template Types
- Create template engine types
- Define variable and rendering types
- Establish template configuration types

### Step 5: Implement Validation Types
- Create validation result types
- Define validation rule types
- Establish validation context types

### Step 6: Implement Configuration Types
- Create main configuration interface
- Define engine configuration types
- Establish plugin configuration types

### Step 7: Implement CLI Types
- Create CLI command types
- Define argument and option types
- Establish CLI output types

### Step 8: Implement MCP Types
- Create MCP request/response types
- Define tool and tool call types
- Establish MCP error handling types

### Step 9: Update Imports
- Update all files to use new type system
- Remove old type definitions
- Update import statements

### Step 10: Validate and Test
- Run TypeScript compiler to check for errors
- Update tests to use new types
- Validate all functionality still works

## Migration Strategy

### 1. Gradual Migration
- Implement new types alongside existing ones
- Use type aliases for backward compatibility
- Gradually replace old types with new ones

### 2. Type Safety
- Use strict TypeScript configuration
- Implement proper type guards
- Add runtime validation where needed

### 3. Testing
- Create type tests for all interfaces
- Validate that existing functionality works
- Test edge cases and error conditions

### 4. Documentation
- Add comprehensive JSDoc comments
- Create usage examples
- Document migration patterns

## Expected Outcomes

After implementing this refactoring plan:

1. **Zero TypeScript Errors**: All compilation errors will be resolved
2. **Unified Type System**: Single source of truth for all types
3. **Better IntelliSense**: Improved IDE support and autocomplete
4. **Type Safety**: Catch errors at compile time
5. **Maintainability**: Easier to update and modify types
6. **Documentation**: Self-documenting code with proper types
7. **Refactoring Safety**: Safer refactoring with type checking
8. **API Consistency**: Unified interfaces across all modules
9. **Performance**: Better tree-shaking and optimization
10. **Developer Experience**: Improved productivity and reduced bugs
