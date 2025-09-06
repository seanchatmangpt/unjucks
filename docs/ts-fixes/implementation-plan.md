# TypeScript Error Fix Implementation Plan

This document provides a structured implementation plan for fixing the remaining TypeScript errors in the codebase.

## Error Analysis Summary

Based on the TypeScript compiler output, the remaining errors fall into these categories:

- **API Signature Mismatches**: 1,200+ errors
- **Missing Properties**: 800+ errors  
- **Import/Export Issues**: 300+ errors
- **Type Safety Issues**: 500+ errors
- **Configuration Problems**: 200+ errors
- **Method Signature Mismatches**: 400+ errors

## Implementation Phases

### Phase 1: Critical Infrastructure Fixes (Week 1)

#### 1.1 Fix Core Library Imports
**Files**: `tests/validation/rdf-template-validation.test.ts`, `tests/validation/rdf-data-validation.test.ts`

**Actions**:
- Fix n3 library imports (`N3Parser` → `Parser`)
- Update nunjucks template engine calls
- Correct method signatures for external libraries

**Commands**:
```bash
# Fix n3 imports
find tests/ -name "*.ts" -exec sed -i 's/N3Parser/Parser/g' {} \;

# Test fixes
npx tsc --noEmit tests/validation/rdf-template-validation.test.ts
```

#### 1.2 Update Core Type Definitions
**Files**: `src/lib/types/turtle-types.ts`, `src/lib/rdf-data-loader.ts`

**Actions**:
- Add missing properties to `TurtleParseResult` interface
- Update `RDFDataLoaderOptions` interface
- Add missing methods to `RDFDataLoader` class

**Implementation**:
```typescript
// Update turtle-types.ts
interface TurtleParseResult {
  success: boolean;
  errors: string[];
  data: {
    triples: Triple[];
    subjects: Record<string, any>;
  };
  metadata: {
    loadTime: number;
    sourceCount: number;
  };
  variables?: Record<string, any>;
}
```

### Phase 2: API Signature Corrections (Week 2)

#### 2.1 Fix Method Call Signatures
**Pattern**: `Expected X arguments, but got Y`

**Files**: All test files with `getQuads`, `renderString` calls

**Actions**:
- Update `getQuads` calls to include graph parameter
- Add context parameter to `renderString` calls
- Fix filter function type annotations

**Script**:
```bash
#!/bin/bash
# fix-method-signatures.sh

# Fix getQuads calls
find tests/ -name "*.ts" -exec sed -i 's/getQuads(null, null, null)/getQuads(null, null, null, null)/g' {} \;

# Fix renderString calls
find tests/ -name "*.ts" -exec sed -i 's/renderString(template)/renderString(template, {})/g' {} \;
```

#### 2.2 Update Configuration Objects
**Files**: All files using `RDFDataLoaderOptions`

**Actions**:
- Add missing configuration properties
- Update interface definitions
- Provide default values

### Phase 3: Type Safety Improvements (Week 3)

#### 3.1 Add Missing Properties
**Pattern**: `Property 'X' does not exist on type 'Y'`

**Actions**:
- Update all interfaces with missing properties
- Add optional properties where appropriate
- Create proper type definitions for complex objects

#### 3.2 Implement Type Guards
**Files**: Files with `unknown` type issues

**Actions**:
- Add runtime type checking
- Create type guard functions
- Improve error handling

### Phase 4: Testing and Validation (Week 4)

#### 4.1 Automated Testing
**Script**: `test-typescript-fixes.sh`
```bash
#!/bin/bash
echo "Testing TypeScript fixes..."

# Test compilation
echo "1. Testing compilation..."
npx tsc --noEmit --project tests/tsconfig.json
if [ $? -eq 0 ]; then
    echo "✅ Compilation successful"
else
    echo "❌ Compilation failed"
    exit 1
fi

# Test specific error categories
echo "2. Testing error categories..."
ERRORS=$(npx tsc --noEmit --project tests/tsconfig.json 2>&1 | wc -l)
if [ $ERRORS -lt 100 ]; then
    echo "✅ Error count reduced significantly"
else
    echo "❌ Too many errors remaining"
fi

# Run functional tests
echo "3. Running functional tests..."
npm test tests/validation/
if [ $? -eq 0 ]; then
    echo "✅ Functional tests pass"
else
    echo "❌ Functional tests failed"
fi
```

#### 4.2 Validation Checklist
- [ ] All original syntax errors fixed
- [ ] No new compilation errors introduced
- [ ] All tests still pass
- [ ] Type safety improved
- [ ] Documentation updated

## File-by-File Implementation Guide

### High Priority Files

#### `tests/validation/rdf-data-validation.test.ts`
**Errors**: 112 TypeScript errors
**Priority**: Critical
**Actions**:
1. Update `TurtleParseResult` interface
2. Add missing methods to `RDFDataLoader`
3. Fix configuration object properties
4. Update cache statistics interface

#### `tests/validation/rdf-template-validation.test.ts`
**Errors**: 23 TypeScript errors
**Priority**: High
**Actions**:
1. Fix n3 library imports
2. Update `getQuads` method calls
3. Fix `renderString` calls
4. Update filter function types

#### `tests/validation/rdf-security-validation.test.ts`
**Errors**: 30 TypeScript errors
**Priority**: High
**Actions**:
1. Update `RDFDataSource` interface
2. Fix configuration properties
3. Add missing method implementations

### Medium Priority Files

#### `tests/integration/rdf-critical-paths.test.ts`
**Errors**: 52 TypeScript errors
**Priority**: Medium
**Actions**:
1. Update method signatures
2. Fix type annotations
3. Add missing properties

#### `tests/unit/rdf-data-loader.test.ts`
**Errors**: 74 TypeScript errors
**Priority**: Medium
**Actions**:
1. Update test expectations
2. Fix mock implementations
3. Update interface usage

## Automation Scripts

### Batch Fix Script
```bash
#!/bin/bash
# batch-fix-typescript.sh

echo "Starting TypeScript error fixes..."

# Phase 1: Fix imports
echo "Phase 1: Fixing imports..."
find tests/ -name "*.ts" -exec sed -i 's/N3Parser/Parser/g' {} \;

# Phase 2: Fix method signatures
echo "Phase 2: Fixing method signatures..."
find tests/ -name "*.ts" -exec sed -i 's/getQuads(null, null, null)/getQuads(null, null, null, null)/g' {} \;
find tests/ -name "*.ts" -exec sed -i 's/renderString(template)/renderString(template, {})/g' {} \;

# Phase 3: Test compilation
echo "Phase 3: Testing compilation..."
npx tsc --noEmit --project tests/tsconfig.json

echo "Batch fixes complete!"
```

### Progress Tracking Script
```bash
#!/bin/bash
# track-progress.sh

echo "TypeScript Error Progress Tracking"
echo "=================================="

# Count errors by type
echo "Error counts by type:"
npx tsc --noEmit --project tests/tsconfig.json 2>&1 | grep -o "TS[0-9]*" | sort | uniq -c | sort -nr

# Count total errors
TOTAL_ERRORS=$(npx tsc --noEmit --project tests/tsconfig.json 2>&1 | wc -l)
echo "Total errors: $TOTAL_ERRORS"

# Track progress over time
echo "$(date): $TOTAL_ERRORS errors" >> typescript-progress.log
```

## Success Metrics

### Quantitative Goals
- **Error Reduction**: Reduce from 3,500+ errors to <100 errors
- **Compilation Success**: Achieve clean compilation with `tsc --noEmit`
- **Test Coverage**: Maintain 100% test pass rate
- **Type Safety**: Improve type coverage to >95%

### Qualitative Goals
- **Code Quality**: Improve maintainability and readability
- **Developer Experience**: Reduce TypeScript-related friction
- **Documentation**: Provide clear type definitions and interfaces
- **Future-Proofing**: Create extensible type system

## Risk Mitigation

### Potential Risks
1. **Breaking Changes**: Fixes might break existing functionality
2. **Performance Impact**: Type checking might slow down compilation
3. **Maintenance Overhead**: More complex type definitions to maintain

### Mitigation Strategies
1. **Incremental Changes**: Fix errors in small, testable batches
2. **Comprehensive Testing**: Run full test suite after each change
3. **Documentation**: Document all changes and their rationale
4. **Rollback Plan**: Maintain ability to revert changes if needed

## Conclusion

This implementation plan provides a structured approach to fixing the remaining TypeScript errors while maintaining code quality and functionality. The phased approach ensures that critical issues are addressed first, with proper testing and validation at each step.
