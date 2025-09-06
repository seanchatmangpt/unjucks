# TypeScript Migration: Specific File Changes

This document provides detailed, file-by-file changes needed to migrate to the unified type system.

## File Change Summary

| Category | Files | Priority | Changes Needed |
|----------|-------|----------|----------------|
| Core Types | 4 files | High | Replace entire files with unified types |
| RDF Library | 8 files | High | Update imports, remove duplicate interfaces |
| Template Engine | 6 files | Medium | Update imports, fix interface definitions |
| Validation | 5 files | Medium | Update imports, use unified validation types |
| MCP Integration | 4 files | Medium | Update imports, fix MCP type usage |
| Test Files | 20+ files | Low | Update imports, fix test expectations |
| Configuration | 3 files | Low | Update imports, remove duplicates |

## Detailed File Changes

### 1. Core Type Files (Replace Entire Files)

#### `src/lib/types/turtle-types.ts`
**Action**: Replace entire file
**Reason**: Missing properties, incomplete interfaces
**New Content**:
```typescript
/**
 * Turtle Types - Unified Type System
 * This file exports all types from the unified type system
 */

export * from '../../types/unified-types.js';
```

#### `src/lib/types/semantic-common.ts`
**Action**: Replace entire file
**Reason**: Duplicate interfaces, missing properties
**New Content**:
```typescript
/**
 * Semantic Common Types - Unified Type System
 * This file exports all types from the unified type system
 */

export * from '../../types/unified-types.js';
```

#### `src/lib/types/validation.ts`
**Action**: Replace entire file
**Reason**: Incomplete validation types
**New Content**:
```typescript
/**
 * Validation Types - Unified Type System
 * This file exports all types from the unified type system
 */

export * from '../../types/unified-types.js';
```

#### `src/mcp/types.ts`
**Action**: Replace entire file
**Reason**: Missing properties, incomplete interfaces
**New Content**:
```typescript
/**
 * MCP Types - Unified Type System
 * This file exports all types from the unified type system
 */

export * from '../types/unified-types.js';
```

### 2. RDF Library Files

#### `src/lib/rdf-data-loader.ts`
**Lines to Change**: 2, 7, 46, 58
**Changes**:
```typescript
// Line 2: Update import
- import { TurtleParser, type TurtleParseResult, type TurtleParseOptions } from './turtle-parser.js';
+ import { TurtleParser } from './turtle-parser.js';
+ import type { 
+   TurtleParseResult, 
+   TurtleParseOptions, 
+   RDFDataSource, 
+   RDFDataLoadResult,
+   RDFDataLoaderOptions 
+ } from '../types/unified-types.js';

// Line 7: Remove interface definition
- export interface RDFDataSource {
-   type: 'file' | 'inline' | 'uri';
-   source?: string;
-   path?: string;
-   content?: string;
-   uri?: string;
-   options?: TurtleParseOptions;
- }

// Line 46: Remove interface definition
- export interface RDFDataLoadResult extends TurtleParseResult {
-   success: boolean;
-   source?: string;
-   error?: string;
-   errors: string[];
-   data: TurtleParseResult;
- }

// Line 58: Update constructor
- constructor(options?: { baseUri?: string; cacheEnabled?: boolean }) {
+ constructor(options?: RDFDataLoaderOptions) {
```

#### `src/lib/semantic-template-engine.ts`
**Lines to Change**: 7, 17, 30, 40, 65
**Changes**:
```typescript
// Line 7: Update imports
- import type { 
-   TurtleData, 
-   RDFDataSource, 
-   RDFTemplateContext,
-   RDFResource,
-   RDFDataLoadResult,
-   SemanticValidationResult,
-   CrossOntologyMapping,
-   EnterprisePerformanceMetrics
- } from './types/turtle-types.js';
+ import type { 
+   TurtleData, 
+   RDFDataSource, 
+   RDFTemplateContext,
+   RDFResource,
+   RDFDataLoadResult,
+   SemanticValidationResult,
+   CrossOntologyMapping,
+   EnterprisePerformanceMetrics,
+   SemanticContext,
+   SemanticRenderResult,
+   PerformanceProfile,
+   OntologyDefinition,
+   ValidationRule,
+   CrossOntologyRule
+ } from '../types/unified-types.js';

// Line 17: Remove import
- import type {
-   PropertyDefinition,
-   ValidationRule,
-   CrossOntologyRule,
-   PerformanceProfile,
-   ClassDefinition
- } from './types/semantic-common.js';

// Line 30: Remove interface definition
- export interface SemanticContext {
-   ontologies: Map<string, OntologyDefinition>;
-   validationRules: ValidationRule[];
-   mappingRules: CrossOntologyRule[];
-   performanceProfile: PerformanceProfile;
- }

// Line 40: Remove interface definition
- export interface OntologyDefinition {
-   uri: string;
-   label: string;
-   classes: ClassDefinition[];
-   properties: PropertyDefinition[];
-   namespaces: Record<string, string>;
- }

// Line 65: Remove interface definition
- export interface SemanticRenderResult {
-   content: string;
-   metadata: {
-     renderTime: number;
-     variablesUsed: string[];
-     filtersApplied: string[];
-     validationResults: ValidationResult[];
-   };
-   errors: string[];
-   warnings: string[];
- }
```

#### `src/lib/template-scanner.ts`
**Lines to Change**: 5, 13
**Changes**:
```typescript
// Add import at top
+ import type { TemplateVariable, TemplateScanResult } from '../types/unified-types.js';

// Line 5: Remove interface definition
- export interface TemplateVariable {
-   name: string;
-   type: "string" | "boolean" | "number";
-   defaultValue?: any;
-   description?: string;
-   required?: boolean;
- }

// Line 13: Remove interface definition
- export interface TemplateScanResult {
-   variables: TemplateVariable[];
-   dependencies: string[];
- }
```

### 3. Validation Files

#### `src/lib/validation/ArgumentValidator.ts`
**Lines to Change**: 4, 12, 21
**Changes**:
```typescript
// Add import at top
+ import type { 
+   ValidationResult, 
+   ValidationError, 
+   ValidationWarning, 
+   ValidationSuggestion, 
+   ValidationMetadata 
+ } from '../../types/unified-types.js';

// Line 4: Remove interface definition
- export interface ValidationResult {
-   valid: boolean;
-   errors: ValidationError[];
-   warnings: ValidationWarning[];
-   suggestions: ValidationSuggestion[];
-   metadata: ValidationMetadata;
- }

// Line 12: Remove interface definition
- export interface ValidationError {
-   type: 'missing-required' | 'invalid-type' | 'invalid-value' | 'conflicting-args' | 'unknown-arg';
-   field: string;
-   message: string;
-   severity: 'error' | 'warning';
-   suggestion?: string;
-   context?: any;
- }

// Line 21: Remove interface definition
- export interface ValidationWarning {
-   type: 'deprecated' | 'unused-arg' | 'type-mismatch' | 'performance';
-   message: string;
-   severity: 'warning' | 'info';
-   suggestion?: string;
-   context?: any;
- }
```

#### `src/validation/consistency-rules.ts`
**Changes**:
```typescript
// Add import at top
+ import type { ValidationRule, ValidationResult } from '../types/unified-types.js';
```

#### `src/validation/performance-rules.ts`
**Changes**:
```typescript
// Add import at top
+ import type { ValidationRule, ValidationResult } from '../types/unified-types.js';
```

#### `src/validation/compliance-rules.ts`
**Changes**:
```typescript
// Add import at top
+ import type { ValidationRule, ValidationResult } from '../types/unified-types.js';
```

### 4. MCP Integration Files

#### `src/lib/mcp-integration.ts`
**Lines to Change**: 20, 35
**Changes**:
```typescript
// Line 20: Update imports
- import type { 
-   MCPRequest, 
-   MCPResponse, 
-   MCPNotification,
-   UnjucksGenerateParams,
-   UnjucksGenerateResult,
-   UnjucksListParams,
-   UnjucksHelpParams,
-   UnjucksDryRunParams,
-   UnjucksInjectParams,
-   ToolResult
- } from '../mcp/types.js';
+ import type { 
+   MCPRequest, 
+   MCPResponse, 
+   MCPError,
+   MCPTool,
+   MCPToolCall
+ } from '../types/unified-types.js';

// Line 35: Update imports
- import type { RDFDataSource, RDFTemplateContext, TurtleData } from './types/turtle-types.js';
+ import type { RDFDataSource, RDFTemplateContext, TurtleData } from '../types/unified-types.js';
```

#### `src/mcp/semantic-server.ts`
**Changes**:
```typescript
// Add import at top
+ import type { MCPRequest, MCPResponse, MCPError } from '../types/unified-types.js';
```

### 5. Test Files

#### `tests/validation/rdf-data-validation.test.ts`
**Changes**:
```typescript
// Add import at top
+ import type { 
+   TurtleParseResult, 
+   RDFDataLoadResult, 
+   RDFDataSource,
+   ValidationResult 
+ } from '../../src/types/unified-types.js';
```

#### `tests/validation/rdf-template-validation.test.ts`
**Changes**:
```typescript
// Add import at top
+ import type { ValidationResult, ValidationError } from '../../src/types/unified-types.js';

// Fix n3 imports
- import { N3Parser, DataFactory, Store } from 'n3';
+ import { Parser as N3Parser, DataFactory, Store } from 'n3';
```

#### `tests/integration/rdf-critical-paths.test.ts`
**Changes**:
```typescript
// Add import at top
+ import type { SemanticRenderResult } from '../../src/types/unified-types.js';

// Fix template string issues
- const dashboardTemplate = `# Dashboard Summary
- ## People ({{ $rdf.getByType('http://xmlns.com/foaf/0.1/Person').length }})`;
+ const dashboardTemplate = "# Dashboard Summary\n" +
+   "## People ({{ $rdf.getByType('http://xmlns.com/foaf/0.1/Person').length }})";
```

#### `tests/security/attack-simulation.test.ts`
**Changes**:
```typescript
// Add import at top
+ import type { ValidationResult } from '../../src/types/unified-types.js';

// Fix string escaping (already fixed)
- { command: "test && python -c \\\"import os; os.system('rm -rf /')\\\"", severity: "CRITICAL" as const }
+ { command: 'test && python -c "import os; os.system(\'rm -rf /\')"', severity: "CRITICAL" as const }
```

### 6. Configuration Files

#### `src/types/commands.ts`
**Changes**:
```typescript
// Add import at top
+ import type { CLICommand, CLIArgument, CLIOption } from './unified-types.js';

// Remove any duplicate interface definitions
```

#### `src/lib/generator.ts`
**Changes**:
```typescript
// Add import at top
+ import type { TemplateFile, GeneratorConfig } from '../types/unified-types.js';

// Update interface definitions to use unified types
```

### 7. Template Files

#### `templates/typescript-interface/new/interface.ts.njk`
**Changes**:
```typescript
// Update template to use unified ValidationResult type
- interface ValidationResult {
-   valid: boolean;
-   errors: string[];
- }
+ import { ValidationResult } from '../../src/types/unified-types.js';
```

## Migration Scripts

### Automated Migration Script
```bash
#!/bin/bash
# migrate-types.sh

echo "Starting TypeScript type migration..."

# Step 1: Backup original files
echo "Backing up original files..."
mkdir -p backup/types
cp -r src/lib/types backup/types/
cp -r src/mcp/types.ts backup/

# Step 2: Replace core type files
echo "Replacing core type files..."
echo "export * from '../../types/unified-types.js';" > src/lib/types/turtle-types.ts
echo "export * from '../../types/unified-types.js';" > src/lib/types/semantic-common.ts
echo "export * from '../../types/unified-types.js';" > src/lib/types/validation.ts
echo "export * from '../types/unified-types.js';" > src/mcp/types.ts

# Step 3: Update imports in core files
echo "Updating imports in core files..."
sed -i 's/from.*turtle-parser.*/from "..\/types\/unified-types.js";/g' src/lib/rdf-data-loader.ts
sed -i 's/from.*turtle-types.*/from "..\/types\/unified-types.js";/g' src/lib/semantic-template-engine.ts
sed -i 's/from.*semantic-common.*/from "..\/types\/unified-types.js";/g' src/lib/template-scanner.ts

# Step 4: Add unified types import to test files
echo "Adding unified types import to test files..."
find tests -name "*.ts" -exec sed -i '1i import type { ValidationResult } from "../../src/types/unified-types.js";' {} \;

# Step 5: Validate changes
echo "Validating changes..."
npx tsc --noEmit --pretty

echo "Migration complete!"
```

### Manual Migration Checklist
```bash
# Core type files
□ src/lib/types/turtle-types.ts
□ src/lib/types/semantic-common.ts
□ src/lib/types/validation.ts
□ src/mcp/types.ts

# RDF library files
□ src/lib/rdf-data-loader.ts
□ src/lib/semantic-template-engine.ts
□ src/lib/template-scanner.ts
□ src/lib/semantic-renderer.ts

# Validation files
□ src/lib/validation/ArgumentValidator.ts
□ src/validation/consistency-rules.ts
□ src/validation/performance-rules.ts
□ src/validation/compliance-rules.ts

# MCP integration files
□ src/lib/mcp-integration.ts
□ src/mcp/semantic-server.ts
□ src/mcp/jtbd-workflows.ts
□ src/mcp/claude-flow-connector.ts

# Test files
□ tests/validation/rdf-data-validation.test.ts
□ tests/validation/rdf-template-validation.test.ts
□ tests/integration/rdf-critical-paths.test.ts
□ tests/security/attack-simulation.test.ts
□ tests/integration/fortune5-scenarios/doc-generation.test.ts

# Configuration files
□ src/types/commands.ts
□ src/lib/generator.ts
□ src/lib/ArgumentParser.ts

# Template files
□ templates/typescript-interface/new/interface.ts.njk
□ _templates/nuxt-openapi/types/api-types.ts.ejs
□ _templates/component/interview-copilot/types/component.ts.ejs
```

## Validation Commands

### After Each File Change
```bash
# Check TypeScript compilation
npx tsc --noEmit --pretty

# Run specific tests
npm test -- tests/validation/rdf-data-validation.test.ts
npm test -- tests/validation/rdf-template-validation.test.ts
```

### Final Validation
```bash
# Full TypeScript check
npx tsc --noEmit --pretty

# Run all tests
npm test

# Check for any remaining errors
npx tsc --noEmit --project tests/tsconfig.json --pretty
```

## Expected Results

After completing all changes:

1. **Zero TypeScript Errors**: All compilation errors resolved
2. **Unified Type System**: Single source of truth for all types
3. **Better IntelliSense**: Improved IDE support
4. **Type Safety**: Compile-time error checking
5. **Maintainability**: Easier to update and modify types
6. **API Consistency**: Unified interfaces across modules

## Rollback Instructions

If issues arise:

```bash
# Restore original files
cp -r backup/types/* src/lib/types/
cp backup/types.ts src/mcp/

# Revert git changes
git checkout -- src/lib/rdf-data-loader.ts
git checkout -- src/lib/semantic-template-engine.ts
git checkout -- src/lib/template-scanner.ts

# Remove added imports
find tests -name "*.ts" -exec sed -i '/import type { ValidationResult }/d' {} \;
```
