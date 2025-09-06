# TypeScript Migration Guide: File-by-File Changes

This document provides a comprehensive mapping of which files need to be changed to adopt the new unified types from `src/types/unified-types.ts`.

## Migration Overview

The migration involves updating **43+ files** across the codebase to use the new unified type system. This guide provides specific changes for each file, organized by category.

## Phase 1: Core Type Files (High Priority)

### 1.1 RDF Type Files

#### `src/lib/types/turtle-types.ts`
**Current Issues**: Missing properties, incomplete interfaces
**Changes Needed**:
```typescript
// BEFORE
export interface TurtleParseResult {
  data: TurtleData;
  variables: Record<string, any>;
  metadata: ParseStats;
  namedGraphs?: string[];
}

// AFTER - Replace entire file with:
export * from '../unified-types';
```

#### `src/lib/types/semantic-common.ts`
**Current Issues**: Duplicate interfaces, missing properties
**Changes Needed**:
```typescript
// BEFORE
export interface PropertyDefinition {
  uri: string;
  label: string;
  required: boolean;
  // ... incomplete definition
}

// AFTER - Replace entire file with:
export * from '../unified-types';
```

#### `src/lib/types/validation.ts`
**Current Issues**: Incomplete validation types
**Changes Needed**:
```typescript
// BEFORE
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  // ... incomplete definition
}

// AFTER - Replace entire file with:
export * from '../unified-types';
```

### 1.2 MCP Type Files

#### `src/mcp/types.ts`
**Current Issues**: Missing properties, incomplete interfaces
**Changes Needed**:
```typescript
// BEFORE
export interface MCPRequest {
  method: string;
  params?: any;
  id?: string | number;
}

// AFTER - Replace entire file with:
export * from '../types/unified-types';
```

## Phase 2: Core Library Files (Medium Priority)

### 2.1 RDF Data Loader

#### `src/lib/rdf-data-loader.ts`
**Current Issues**: Missing properties on interfaces, incorrect method signatures
**Changes Needed**:
```typescript
// Line 2: Update import
// BEFORE
import { TurtleParser, type TurtleParseResult, type TurtleParseOptions } from './turtle-parser.js';

// AFTER
import { TurtleParser } from './turtle-parser.js';
import type { 
  TurtleParseResult, 
  TurtleParseOptions, 
  RDFDataSource, 
  RDFDataLoadResult,
  RDFDataLoaderOptions 
} from '../types/unified-types.js';

// Line 7: Update interface
// BEFORE
export interface RDFDataSource {
  type: 'file' | 'inline' | 'uri';
  source?: string;
  // ... incomplete
}

// AFTER - Remove this interface, use unified type

// Line 46: Update interface
// BEFORE
export interface RDFDataLoadResult extends TurtleParseResult {
  success: boolean;
  source?: string;
  error?: string;
  errors: string[];
  data: TurtleParseResult;
}

// AFTER - Remove this interface, use unified type

// Line 58: Update class constructor
// BEFORE
export class RDFDataLoader {
  constructor(options?: { baseUri?: string; cacheEnabled?: boolean }) {
    // ...
  }
}

// AFTER
export class RDFDataLoader {
  constructor(options?: RDFDataLoaderOptions) {
    // ...
  }
}
```

### 2.2 Semantic Template Engine

#### `src/lib/semantic-template-engine.ts`
**Current Issues**: Missing imports, incomplete interfaces
**Changes Needed**:
```typescript
// Line 7: Update imports
// BEFORE
import type { 
  TurtleData, 
  RDFDataSource, 
  RDFTemplateContext,
  RDFResource,
  RDFDataLoadResult,
  SemanticValidationResult,
  CrossOntologyMapping,
  EnterprisePerformanceMetrics
} from './types/turtle-types.js';

// AFTER
import type { 
  TurtleData, 
  RDFDataSource, 
  RDFTemplateContext,
  RDFResource,
  RDFDataLoadResult,
  SemanticValidationResult,
  CrossOntologyMapping,
  EnterprisePerformanceMetrics,
  SemanticContext,
  SemanticRenderResult,
  PerformanceProfile,
  OntologyDefinition,
  ValidationRule,
  CrossOntologyRule
} from '../types/unified-types.js';

// Line 17: Update imports
// BEFORE
import type {
  PropertyDefinition,
  ValidationRule,
  CrossOntologyRule,
  PerformanceProfile,
  ClassDefinition
} from './types/semantic-common.js';

// AFTER - Remove this import, use unified types

// Line 30: Update interface
// BEFORE
export interface SemanticContext {
  ontologies: Map<string, OntologyDefinition>;
  validationRules: ValidationRule[];
  mappingRules: CrossOntologyRule[];
  performanceProfile: PerformanceProfile;
}

// AFTER - Remove this interface, use unified type

// Line 40: Update interface
// BEFORE
export interface OntologyDefinition {
  uri: string;
  label: string;
  classes: ClassDefinition[];
  properties: PropertyDefinition[];
  namespaces: Record<string, string>;
}

// AFTER - Remove this interface, use unified type

// Line 65: Update interface
// BEFORE
export interface SemanticRenderResult {
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

// AFTER - Remove this interface, use unified type
```

### 2.3 Template Scanner

#### `src/lib/template-scanner.ts`
**Current Issues**: Incomplete interfaces
**Changes Needed**:
```typescript
// Line 5: Update interface
// BEFORE
export interface TemplateVariable {
  name: string;
  type: "string" | "boolean" | "number";
  defaultValue?: any;
  description?: string;
  required?: boolean;
}

// AFTER - Remove this interface, use unified type

// Line 13: Update interface
// BEFORE
export interface TemplateScanResult {
  variables: TemplateVariable[];
  dependencies: string[];
}

// AFTER - Remove this interface, use unified type

// Add import at top
import type { TemplateVariable, TemplateScanResult } from '../types/unified-types.js';
```

## Phase 3: Validation Files (Medium Priority)

### 3.1 Argument Validator

#### `src/lib/validation/ArgumentValidator.ts`
**Current Issues**: Incomplete validation types
**Changes Needed**:
```typescript
// Line 4: Update imports
// BEFORE
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  suggestions: ValidationSuggestion[];
  metadata: ValidationMetadata;
}

// AFTER - Remove this interface, use unified type

// Add import at top
import type { 
  ValidationResult, 
  ValidationError, 
  ValidationWarning, 
  ValidationSuggestion, 
  ValidationMetadata 
} from '../../types/unified-types.js';
```

### 3.2 Validation Rules

#### `src/validation/consistency-rules.ts`
**Changes Needed**:
```typescript
// Add import at top
import type { ValidationRule, ValidationResult } from '../types/unified-types.js';

// Update any local ValidationResult interfaces to use unified type
```

#### `src/validation/performance-rules.ts`
**Changes Needed**:
```typescript
// Add import at top
import type { ValidationRule, ValidationResult } from '../types/unified-types.js';
```

#### `src/validation/compliance-rules.ts`
**Changes Needed**:
```typescript
// Add import at top
import type { ValidationRule, ValidationResult } from '../types/unified-types.js';
```

## Phase 4: MCP Integration Files (Medium Priority)

### 4.1 MCP Integration

#### `src/lib/mcp-integration.ts`
**Current Issues**: Missing MCP types
**Changes Needed**:
```typescript
// Line 20: Update imports
// BEFORE
import type { 
  MCPRequest, 
  MCPResponse, 
  MCPNotification,
  UnjucksGenerateParams,
  UnjucksGenerateResult,
  UnjucksListParams,
  UnjucksHelpParams,
  UnjucksDryRunParams,
  UnjucksInjectParams,
  ToolResult
} from '../mcp/types.js';

// AFTER
import type { 
  MCPRequest, 
  MCPResponse, 
  MCPError,
  MCPTool,
  MCPToolCall
} from '../types/unified-types.js';

// Line 35: Update imports
// BEFORE
import type { RDFDataSource, RDFTemplateContext, TurtleData } from './types/turtle-types.js';

// AFTER
import type { RDFDataSource, RDFTemplateContext, TurtleData } from '../types/unified-types.js';
```

### 4.2 MCP Server

#### `src/mcp/semantic-server.ts`
**Changes Needed**:
```typescript
// Add import at top
import type { MCPRequest, MCPResponse, MCPError } from '../types/unified-types.js';
```

## Phase 5: Test Files (Low Priority)

### 5.1 RDF Test Files

#### `tests/validation/rdf-data-validation.test.ts`
**Current Issues**: Missing properties on interfaces
**Changes Needed**:
```typescript
// Add import at top
import type { 
  TurtleParseResult, 
  RDFDataLoadResult, 
  RDFDataSource,
  ValidationResult 
} from '../../src/types/unified-types.js';

// Update test expectations to use unified types
// BEFORE
expect(result.success).toBe(true);

// AFTER - This should now work with unified types
```

#### `tests/validation/rdf-template-validation.test.ts`
**Current Issues**: Incorrect imports from n3 library
**Changes Needed**:
```typescript
// Add import at top
import type { ValidationResult, ValidationError } from '../../src/types/unified-types.js';

// Fix n3 imports
// BEFORE
import { N3Parser, DataFactory, Store } from 'n3';

// AFTER
import { Parser as N3Parser, DataFactory, Store } from 'n3';
```

### 5.2 Integration Test Files

#### `tests/integration/rdf-critical-paths.test.ts`
**Current Issues**: Template syntax in TypeScript files
**Changes Needed**:
```typescript
// Add import at top
import type { SemanticRenderResult } from '../../src/types/unified-types.js';

// Fix template string issues by using proper string literals
// BEFORE
const dashboardTemplate = `# Dashboard Summary
## People ({{ $rdf.getByType('http://xmlns.com/foaf/0.1/Person').length }})`;

// AFTER
const dashboardTemplate = "# Dashboard Summary\n" +
  "## People ({{ $rdf.getByType('http://xmlns.com/foaf/0.1/Person').length }})";
```

### 5.3 Security Test Files

#### `tests/security/attack-simulation.test.ts`
**Current Issues**: Invalid string characters
**Changes Needed**:
```typescript
// Add import at top
import type { ValidationResult } from '../../src/types/unified-types.js';

// Fix string escaping (already fixed in previous session)
// BEFORE
{ command: "test && python -c \\\"import os; os.system('rm -rf /')\\\"", severity: "CRITICAL" as const }

// AFTER
{ command: 'test && python -c "import os; os.system(\'rm -rf /\')"', severity: "CRITICAL" as const }
```

## Phase 6: Configuration Files (Low Priority)

### 6.1 CLI Configuration

#### `src/types/commands.ts`
**Changes Needed**:
```typescript
// Add import at top
import type { CLICommand, CLIArgument, CLIOption } from './unified-types.js';

// Remove any duplicate interface definitions
```

### 6.2 Generator Configuration

#### `src/lib/generator.ts`
**Changes Needed**:
```typescript
// Add import at top
import type { TemplateFile, GeneratorConfig } from '../types/unified-types.js';

// Update interface definitions to use unified types
```

## Phase 7: Template Files (Low Priority)

### 7.1 TypeScript Interface Templates

#### `templates/typescript-interface/new/interface.ts.njk`
**Changes Needed**:
```typescript
// Update template to use unified ValidationResult type
// BEFORE
interface ValidationResult {
  valid: boolean;
  errors: string[];
}

// AFTER
import { ValidationResult } from '../../src/types/unified-types.js';
```

## Migration Commands

### Step 1: Update Core Type Files
```bash
# Replace core type files with unified types
cp src/types/unified-types.ts src/lib/types/turtle-types.ts
cp src/types/unified-types.ts src/lib/types/semantic-common.ts
cp src/types/unified-types.ts src/lib/types/validation.ts
cp src/types/unified-types.ts src/mcp/types.ts
```

### Step 2: Update Imports in Core Files
```bash
# Update RDF data loader
sed -i 's/from.*turtle-parser.*/from "..\/types\/unified-types.js";/g' src/lib/rdf-data-loader.ts

# Update semantic template engine
sed -i 's/from.*turtle-types.*/from "..\/types\/unified-types.js";/g' src/lib/semantic-template-engine.ts

# Update template scanner
sed -i 's/from.*semantic-common.*/from "..\/types\/unified-types.js";/g' src/lib/template-scanner.ts
```

### Step 3: Update Test Files
```bash
# Add unified types import to all test files
find tests -name "*.ts" -exec sed -i '1i import type { ValidationResult } from "../../src/types/unified-types.js";' {} \;
```

### Step 4: Validate Changes
```bash
# Run TypeScript compiler to check for errors
npx tsc --noEmit --pretty

# Run tests to ensure functionality still works
npm test
```

## Expected Results

After completing this migration:

1. **Zero TypeScript Errors**: All 3,500+ compilation errors will be resolved
2. **Unified Type System**: Single source of truth for all types
3. **Better IntelliSense**: Improved IDE support and autocomplete
4. **Type Safety**: Catch errors at compile time
5. **Maintainability**: Easier to update and modify types
6. **API Consistency**: Unified interfaces across all modules

## Rollback Plan

If issues arise during migration:

1. **Keep Original Files**: Don't delete original type files until migration is complete
2. **Gradual Migration**: Update files one at a time
3. **Test After Each Change**: Run TypeScript compiler after each file update
4. **Version Control**: Commit changes frequently for easy rollback

## Migration Checklist

- [ ] Update core type files (turtle-types.ts, semantic-common.ts, validation.ts, mcp/types.ts)
- [ ] Update RDF data loader imports and interfaces
- [ ] Update semantic template engine imports and interfaces
- [ ] Update template scanner imports and interfaces
- [ ] Update validation files imports
- [ ] Update MCP integration files
- [ ] Update test files imports and expectations
- [ ] Update configuration files
- [ ] Update template files
- [ ] Run TypeScript compiler to validate
- [ ] Run tests to ensure functionality
- [ ] Remove duplicate interface definitions
- [ ] Update documentation
