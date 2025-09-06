# TypeScript Migration: Import Mapping Guide

This document maps all the import statements that need to be updated to use the new unified type system.

## Import Change Summary

| Current Import | New Import | Files Affected |
|----------------|------------|----------------|
| `from './types/turtle-types.js'` | `from '../types/unified-types.js'` | 43 files |
| `from './types/semantic-common.js'` | `from '../types/unified-types.js'` | 2 files |
| `from '../mcp/types.js'` | `from '../types/unified-types.js'` | 3 files |
| `from './types/validation.js'` | `from '../types/unified-types.js'` | 5 files |

## Detailed Import Changes

### 1. RDF Type Imports

#### Files Importing `turtle-types.js` (43 files)
```typescript
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
  TurtleParseResult,
  ParsedTriple,
  RDFTerm,
  ParseStats,
  TurtleParseOptions,
  QueryOptions,
  QueryResult
} from '../types/unified-types.js';
```

**Files to Update**:
- `tests/integration/rdf-critical-paths.test.ts`
- `src/lib/semantic-template-engine.ts`
- `src/lib/rdf-type-converter.ts`
- `src/lib/semantic-engine.ts`
- `src/lib/frontmatter-parser.ts`
- `src/index.ts`
- `tests/integration/validation-pipeline.test.ts`
- `tests/unit/semantic-validator.test.ts`
- `src/lib/mcp-integration.ts`
- `src/validation/consistency-rules.ts`
- `src/validation/performance-rules.ts`
- `src/validation/compliance-rules.ts`
- `src/lib/semantic-workflow-orchestrator.ts`
- `tests/unit/rdf-data-loader.test.ts`
- `tests/documentation/semantic-doc-validation.test.ts`
- `src/lib/semantic-swarm-patterns.ts`
- `tests/integration/rdf-working-demo.test.ts`
- `tests/integration/rdf-integration-summary.test.ts`
- `tests/integration/rdf-simple-test.test.ts`
- `src/lib/semantic/semantic-filters.ts`
- `tests/integration/rdf-template-generation.test.ts`
- `tests/performance/semantic-performance.test.ts`
- `tests/integration/rdf-pipeline-integration.test.ts`
- `src/lib/semantic-coordination.ts`
- `tests/compliance/semantic-validation.test.ts`
- `tests/integration/rdf-performance-cache.test.ts`
- `src/lib/semantic-renderer.ts`
- `tests/integration/rdf-edge-cases.test.ts`
- `tests/unit/semantic-reasoning.test.ts`
- `tests/benchmarks/run-benchmarks.ts`
- `tests/security/rdf-security-focused.test.ts`
- `tests/integration/rdf-full-integration.test.ts`
- `tests/benchmarks/rdf-performance-benchmarks.spec.ts`
- `tests/security/rdf-attack-vectors.test.ts`
- `tests/helpers/rdf-test-helpers.ts`
- `tests/benchmarks/rdf-performance-benchmarks.bench.ts`
- `tests/security/rdf-security-comprehensive.test.ts`
- `tests/validation/rdf-data-validation.test.ts`
- `src/mcp/jtbd-workflows.ts`
- `src/lib/mcp-template-orchestrator.ts`
- `src/mcp/claude-flow-connector.ts`
- `tests/factories/rdf-factory.ts`

### 2. Semantic Common Imports

#### Files Importing `semantic-common.js` (2 files)
```typescript
// BEFORE
import type {
  PropertyDefinition,
  ValidationRule,
  CrossOntologyRule,
  PerformanceProfile,
  ClassDefinition
} from './types/semantic-common.js';

// AFTER
import type {
  PropertyDefinition,
  ValidationRule,
  CrossOntologyRule,
  PerformanceProfile,
  ClassDefinition,
  TypescriptType,
  PropertyConstraints,
  OntologyDefinition
} from '../types/unified-types.js';
```

**Files to Update**:
- `src/lib/semantic-template-engine.ts`
- `src/lib/semantic-template-orchestrator.ts`

### 3. MCP Type Imports

#### Files Importing `mcp/types.js` (3 files)
```typescript
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
  MCPToolCall,
  LoggingCapability,
  Tool,
  ToolCall
} from '../types/unified-types.js';
```

**Files to Update**:
- `src/lib/mcp-integration.ts`
- `tests/integration/semantic-mcp-tools.test.ts`
- `tests/step-definitions/mcp-protocol.steps.ts`

### 4. Validation Type Imports

#### Files Importing `validation.js` (5 files)
```typescript
// BEFORE
import type { 
  ValidationResult, 
  ValidationError, 
  ValidationWarning 
} from './types/validation.js';

// AFTER
import type { 
  ValidationResult, 
  ValidationError, 
  ValidationWarning,
  ValidationSuggestion,
  ValidationMetadata,
  ValidationLocation,
  ValidationRule,
  ValidationContext,
  ValidationErrorType,
  ValidationWarningType
} from '../types/unified-types.js';
```

**Files to Update**:
- `src/lib/validation/ArgumentValidator.ts`
- `src/lib/types/validation.ts`
- `src/validation/consistency-rules.ts`
- `src/validation/performance-rules.ts`
- `src/validation/compliance-rules.ts`

## Automated Import Update Script

### Bash Script for Import Updates
```bash
#!/bin/bash
# update-imports.sh

echo "Updating TypeScript imports to use unified types..."

# Update turtle-types imports
echo "Updating turtle-types imports..."
find . -name "*.ts" -not -path "./node_modules/*" -not -path "./dist/*" -exec sed -i 's|from.*turtle-types\.js.*|from "../types/unified-types.js";|g' {} \;

# Update semantic-common imports
echo "Updating semantic-common imports..."
find . -name "*.ts" -not -path "./node_modules/*" -not -path "./dist/*" -exec sed -i 's|from.*semantic-common\.js.*|from "../types/unified-types.js";|g' {} \;

# Update MCP type imports
echo "Updating MCP type imports..."
find . -name "*.ts" -not -path "./node_modules/*" -not -path "./dist/*" -exec sed -i 's|from.*mcp/types\.js.*|from "../types/unified-types.js";|g' {} \;

# Update validation imports
echo "Updating validation imports..."
find . -name "*.ts" -not -path "./node_modules/*" -not -path "./dist/*" -exec sed -i 's|from.*validation\.js.*|from "../types/unified-types.js";|g' {} \;

echo "Import updates complete!"
```

### PowerShell Script for Windows
```powershell
# update-imports.ps1

Write-Host "Updating TypeScript imports to use unified types..."

# Update turtle-types imports
Write-Host "Updating turtle-types imports..."
Get-ChildItem -Recurse -Filter "*.ts" | Where-Object { $_.FullName -notlike "*node_modules*" -and $_.FullName -notlike "*dist*" } | ForEach-Object {
    (Get-Content $_.FullName) -replace 'from.*turtle-types\.js.*', 'from "../types/unified-types.js";' | Set-Content $_.FullName
}

# Update semantic-common imports
Write-Host "Updating semantic-common imports..."
Get-ChildItem -Recurse -Filter "*.ts" | Where-Object { $_.FullName -notlike "*node_modules*" -and $_.FullName -notlike "*dist*" } | ForEach-Object {
    (Get-Content $_.FullName) -replace 'from.*semantic-common\.js.*', 'from "../types/unified-types.js";' | Set-Content $_.FullName
}

# Update MCP type imports
Write-Host "Updating MCP type imports..."
Get-ChildItem -Recurse -Filter "*.ts" | Where-Object { $_.FullName -notlike "*node_modules*" -and $_.FullName -notlike "*dist*" } | ForEach-Object {
    (Get-Content $_.FullName) -replace 'from.*mcp/types\.js.*', 'from "../types/unified-types.js";' | Set-Content $_.FullName
}

# Update validation imports
Write-Host "Updating validation imports..."
Get-ChildItem -Recurse -Filter "*.ts" | Where-Object { $_.FullName -notlike "*node_modules*" -and $_.FullName -notlike "*dist*" } | ForEach-Object {
    (Get-Content $_.FullName) -replace 'from.*validation\.js.*', 'from "../types/unified-types.js";' | Set-Content $_.FullName
}

Write-Host "Import updates complete!"
```

## Manual Import Update Checklist

### Core Library Files
- [ ] `src/lib/rdf-data-loader.ts`
- [ ] `src/lib/semantic-template-engine.ts`
- [ ] `src/lib/template-scanner.ts`
- [ ] `src/lib/semantic-renderer.ts`
- [ ] `src/lib/semantic-engine.ts`
- [ ] `src/lib/frontmatter-parser.ts`
- [ ] `src/lib/rdf-type-converter.ts`

### Validation Files
- [ ] `src/lib/validation/ArgumentValidator.ts`
- [ ] `src/validation/consistency-rules.ts`
- [ ] `src/validation/performance-rules.ts`
- [ ] `src/validation/compliance-rules.ts`

### MCP Integration Files
- [ ] `src/lib/mcp-integration.ts`
- [ ] `src/mcp/semantic-server.ts`
- [ ] `src/mcp/jtbd-workflows.ts`
- [ ] `src/mcp/claude-flow-connector.ts`

### Test Files (43 files)
- [ ] `tests/validation/rdf-data-validation.test.ts`
- [ ] `tests/validation/rdf-template-validation.test.ts`
- [ ] `tests/integration/rdf-critical-paths.test.ts`
- [ ] `tests/integration/fortune5-scenarios/doc-generation.test.ts`
- [ ] `tests/security/attack-simulation.test.ts`
- [ ] `tests/unit/rdf-data-loader.test.ts`
- [ ] `tests/integration/rdf-working-demo.test.ts`
- [ ] `tests/integration/rdf-integration-summary.test.ts`
- [ ] `tests/integration/rdf-simple-test.test.ts`
- [ ] `tests/integration/rdf-template-generation.test.ts`
- [ ] `tests/performance/semantic-performance.test.ts`
- [ ] `tests/integration/rdf-pipeline-integration.test.ts`
- [ ] `tests/compliance/semantic-validation.test.ts`
- [ ] `tests/integration/rdf-performance-cache.test.ts`
- [ ] `tests/integration/rdf-edge-cases.test.ts`
- [ ] `tests/unit/semantic-reasoning.test.ts`
- [ ] `tests/benchmarks/run-benchmarks.ts`
- [ ] `tests/security/rdf-security-focused.test.ts`
- [ ] `tests/integration/rdf-full-integration.test.ts`
- [ ] `tests/benchmarks/rdf-performance-benchmarks.spec.ts`
- [ ] `tests/security/rdf-attack-vectors.test.ts`
- [ ] `tests/helpers/rdf-test-helpers.ts`
- [ ] `tests/benchmarks/rdf-performance-benchmarks.bench.ts`
- [ ] `tests/security/rdf-security-comprehensive.test.ts`
- [ ] `tests/factories/rdf-factory.ts`
- [ ] `tests/documentation/semantic-doc-validation.test.ts`
- [ ] `tests/unit/semantic-validator.test.ts`
- [ ] `tests/integration/validation-pipeline.test.ts`
- [ ] `tests/integration/semantic-mcp-tools.test.ts`
- [ ] `tests/step-definitions/mcp-protocol.steps.ts`

### Configuration Files
- [ ] `src/types/commands.ts`
- [ ] `src/lib/generator.ts`
- [ ] `src/lib/ArgumentParser.ts`

### Template Files
- [ ] `templates/typescript-interface/new/interface.ts.njk`
- [ ] `_templates/nuxt-openapi/types/api-types.ts.ejs`
- [ ] `_templates/component/interview-copilot/types/component.ts.ejs`

## Import Path Corrections

### Relative Path Adjustments
Some files may need path adjustments based on their location:

#### Files in `src/lib/` directory
```typescript
// Change from
from './types/turtle-types.js'
// To
from '../types/unified-types.js'
```

#### Files in `tests/` directory
```typescript
// Change from
from './types/turtle-types.js'
// To
from '../../src/types/unified-types.js'
```

#### Files in `src/mcp/` directory
```typescript
// Change from
from '../mcp/types.js'
// To
from '../types/unified-types.js'
```

#### Files in `src/validation/` directory
```typescript
// Change from
from './types/validation.js'
// To
from '../types/unified-types.js'
```

## Validation Commands

### After Import Updates
```bash
# Check TypeScript compilation
npx tsc --noEmit --pretty

# Check specific files
npx tsc --noEmit src/lib/rdf-data-loader.ts --pretty
npx tsc --noEmit src/lib/semantic-template-engine.ts --pretty

# Run tests to ensure functionality
npm test -- tests/validation/rdf-data-validation.test.ts
```

### Final Validation
```bash
# Full TypeScript check
npx tsc --noEmit --pretty

# Check test files
npx tsc --noEmit --project tests/tsconfig.json --pretty

# Run all tests
npm test
```

## Expected Results

After updating all imports:

1. **Zero Import Errors**: All import statements will resolve correctly
2. **Unified Type Access**: All files will use the same type definitions
3. **Better IntelliSense**: IDE will provide better autocomplete and error detection
4. **Type Safety**: Compile-time type checking will work correctly
5. **Maintainability**: Single source of truth for all types

## Troubleshooting

### Common Import Issues

#### Path Resolution Errors
```bash
# If you get path resolution errors, check the relative path
# Files in src/lib/ should use ../types/unified-types.js
# Files in tests/ should use ../../src/types/unified-types.js
```

#### Missing Type Exports
```bash
# If a type is not found, check if it's exported from unified-types.ts
# Add the missing type to the unified-types.ts file if needed
```

#### Circular Import Issues
```bash
# If you get circular import errors, check the import structure
# Make sure unified-types.ts doesn't import from files that import it
```

## Rollback Instructions

If issues arise with import updates:

```bash
# Restore original imports
git checkout -- src/lib/rdf-data-loader.ts
git checkout -- src/lib/semantic-template-engine.ts
git checkout -- src/lib/template-scanner.ts

# Or use git to revert all changes
git reset --hard HEAD
```
