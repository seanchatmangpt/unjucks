# Specific TypeScript Error Fixes Guide

This document provides specific fixes for the remaining TypeScript errors found in the codebase, organized by file and error type.

## RDF Library Errors

### File: `tests/validation/rdf-data-validation.test.ts`

#### Error: Missing Properties on TurtleParseResult
```typescript
// Current Error: Property 'success' does not exist on type 'TurtleParseResult'
expect(result.success).toBe(true);

// Fix: Update the TurtleParseResult interface
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

#### Error: Missing Method on RDFDataLoader
```typescript
// Current Error: Property 'executeQuery' does not exist on type 'RDFDataLoader'
const queryResult = await loader.executeQuery(result.data, { ... });

// Fix: Add the method to RDFDataLoader class
class RDFDataLoader {
  async executeQuery(data: TurtleData, query: QueryOptions): Promise<QueryResult> {
    // Implementation
  }
}
```

#### Error: Missing Configuration Properties
```typescript
// Current Error: 'cacheTTL' does not exist in type 'RDFDataLoaderOptions'
const options: RDFDataLoaderOptions = {
  cacheTTL: 100  // Error
};

// Fix: Update RDFDataLoaderOptions interface
interface RDFDataLoaderOptions {
  baseUri: string;
  validateSyntax: boolean;
  cacheTTL?: number;
  httpTimeout?: number;
  templateDir?: string;
  maxRetries?: number;
}
```

### File: `tests/validation/rdf-template-validation.test.ts`

#### Error: Incorrect Import from n3 Library
```typescript
// Current Error: 'n3' has no exported member named 'N3Parser'
import { N3Parser, DataFactory, Store } from 'n3';

// Fix: Use correct export name
import { Parser as N3Parser, DataFactory, Store } from 'n3';
// or
import { Parser, DataFactory, Store } from 'n3';
```

#### Error: Missing Arguments for getQuads Method
```typescript
// Current Error: Expected 4 arguments, but got 3
const quads = testStore.getQuads(null, null, null);

// Fix: Provide all required arguments
const quads = testStore.getQuads(null, null, null, null);
// or use default graph
const quads = testStore.getQuads(null, null, null, DataFactory.defaultGraph());
```

#### Error: Missing Context Parameter for renderString
```typescript
// Current Error: Expected 2-3 arguments, but got 1
const result = env.renderString(template);

// Fix: Provide required context parameter
const result = env.renderString(template, {});
// or with meaningful context
const result = env.renderString(template, { data: myData });
```

## Security Test Errors

### File: `tests/security/rdf-security-validation.test.ts`

#### Error: Missing Properties on RDFDataSource
```typescript
// Current Error: 'variables' does not exist in type 'RDFDataSource'
const dataSource: RDFDataSource = {
  type: 'inline',
  source: '...',
  variables: ['user']  // Error
};

// Fix: Update RDFDataSource interface
interface RDFDataSource {
  type: 'file' | 'inline' | 'url';
  source: string;
  format?: string;
  variables?: string[];
}
```

## Template Engine Errors

### File: `tests/validation/rdf-template-validation.test.ts`

#### Error: Function Type Mismatch
```typescript
// Current Error: Argument of type 'Function' is not assignable to parameter
env.addFilter(name, filter);

// Fix: Properly type the filter function
env.addFilter(name, filter as (...args: any[]) => any);
// or define proper filter type
type FilterFunction = (...args: any[]) => any;
env.addFilter(name, filter as FilterFunction);
```

## Performance and Memory Errors

### File: `tests/validation/rdf-data-validation.test.ts`

#### Error: Missing Cache Statistics Properties
```typescript
// Current Error: Property 'totalSize' does not exist on cache stats
expect(stats.totalSize).toBeGreaterThan(0);

// Fix: Update cache statistics interface
interface CacheStats {
  size: number;
  maxSize: number;
  hitCount: number;
  missCount: number;
  totalSize: number;
  newestEntry: Date;
  oldestEntry: Date;
}
```

## Implementation Priority

### High Priority (Blocking Compilation)
1. **Fix Import Statements**: Correct library imports (n3, nunjucks)
2. **Update Method Signatures**: Fix getQuads, renderString calls
3. **Add Missing Properties**: Update TurtleParseResult interface

### Medium Priority (Type Safety)
1. **Complete Interface Definitions**: Add all missing properties
2. **Fix Configuration Types**: Update RDFDataLoaderOptions
3. **Add Method Implementations**: Implement missing methods

### Low Priority (Enhancement)
1. **Improve Error Handling**: Add proper error types
2. **Enhance Type Guards**: Add runtime type checking
3. **Documentation**: Document all interfaces and methods

## Testing Strategy

### Before Fixes
```bash
# Run TypeScript compiler to see all errors
npx tsc --noEmit --project tests/tsconfig.json
```

### After Each Fix
```bash
# Test specific file
npx tsc --noEmit tests/validation/rdf-data-validation.test.ts

# Test specific error category
npx tsc --noEmit --project tests/tsconfig.json 2>&1 | grep "TS2339"
```

### Validation
```bash
# Run tests to ensure functionality still works
npm test tests/validation/
```

## Common Patterns

### Interface Updates
```typescript
// Pattern: Add missing properties to existing interfaces
interface ExistingInterface {
  // existing properties
  newProperty?: Type;  // Add missing property
}
```

### Method Signature Fixes
```typescript
// Pattern: Update method calls to match library APIs
// Before: methodCall(arg1, arg2)
// After: methodCall(arg1, arg2, arg3, arg4)
```

### Import Corrections
```typescript
// Pattern: Fix incorrect imports
// Before: import { WrongName } from 'library'
// After: import { CorrectName } from 'library'
```

## Tools and Commands

### TypeScript Compiler
```bash
# Check specific file
npx tsc --noEmit path/to/file.ts

# Check with specific config
npx tsc --noEmit --project tests/tsconfig.json

# Generate type definitions
npx tsc --declaration --emitDeclarationOnly
```

### Error Filtering
```bash
# Filter specific error types
npx tsc --noEmit 2>&1 | grep "TS2339"  # Property errors
npx tsc --noEmit 2>&1 | grep "TS2554"  # Argument errors
npx tsc --noEmit 2>&1 | grep "TS2724"  # Import errors
```

This guide provides specific, actionable fixes for the remaining TypeScript errors while maintaining the existing functionality and avoiding breaking changes.
