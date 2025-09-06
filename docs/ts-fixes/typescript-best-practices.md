# TypeScript Error Fix Best Practices

This document outlines best practices for fixing the remaining TypeScript errors found in the codebase, organized by error category and complexity.

## Error Categories and Fix Strategies

### 1. API Signature Mismatches

**Error Pattern**: `TS2554: Expected X arguments, but got Y`
**Example**: `Expected 4 arguments, but got 3` for `getQuads()` method

#### Best Practices:
- **Check API Documentation**: Verify the correct method signature in the library documentation
- **Use Type Definitions**: Install proper `@types/` packages for external libraries
- **Gradual Migration**: Update method calls incrementally to avoid breaking changes
- **Add Type Guards**: Use runtime checks for optional parameters

#### Fix Example:
```typescript
// Before (incorrect)
const quads = testStore.getQuads(null, null, null);

// After (correct)
const quads = testStore.getQuads(null, null, null, null);
// or use default graph
const quads = testStore.getQuads(null, null, null, DataFactory.defaultGraph());
```

### 2. Missing Properties on Types

**Error Pattern**: `TS2339: Property 'X' does not exist on type 'Y'`
**Example**: `Property 'success' does not exist on type 'TurtleParseResult'`

#### Best Practices:
- **Update Type Definitions**: Modify interface definitions to include missing properties
- **Use Type Assertions**: When you know the property exists but TypeScript doesn't
- **Add Optional Properties**: Use `?` for properties that might not always be present
- **Create Union Types**: For objects that can have different shapes

#### Fix Example:
```typescript
// Before (missing properties)
interface TurtleParseResult {
  triples: Triple[];
}

// After (complete interface)
interface TurtleParseResult {
  success: boolean;
  triples: Triple[];
  errors: string[];
  metadata: {
    loadTime: number;
    sourceCount: number;
  };
  variables?: Record<string, any>;
}
```

### 3. Import/Export Issues

**Error Pattern**: `TS2724: 'X' has no exported member named 'Y'`
**Example**: `'n3' has no exported member named 'N3Parser'`

#### Best Practices:
- **Check Export Names**: Verify the actual exported names from the library
- **Use Default Imports**: When the library exports a default
- **Update Import Statements**: Match the actual API surface
- **Version Compatibility**: Ensure library versions match type definitions

#### Fix Example:
```typescript
// Before (incorrect import)
import { N3Parser, DataFactory, Store } from 'n3';

// After (correct import)
import { Parser as N3Parser, DataFactory, Store } from 'n3';
// or
import { Parser, DataFactory, Store } from 'n3';
```

### 4. Method Signature Mismatches

**Error Pattern**: `TS2554: Expected 2-3 arguments, but got 1`
**Example**: `renderString()` method expecting context parameter

#### Best Practices:
- **Provide Required Parameters**: Always pass all required arguments
- **Use Default Values**: Provide sensible defaults for optional parameters
- **Type Parameters Correctly**: Ensure parameter types match expected types
- **Handle Optional Parameters**: Use undefined or null for optional parameters

#### Fix Example:
```typescript
// Before (missing required parameter)
const result = env.renderString(template);

// After (with required context)
const result = env.renderString(template, {});
// or with meaningful context
const result = env.renderString(template, { data: myData });
```

### 5. Type Safety Issues

**Error Pattern**: `TS2339: Property 'X' does not exist on type 'unknown'`
**Example**: Accessing properties on untyped return values

#### Best Practices:
- **Add Type Annotations**: Explicitly type function returns and variables
- **Use Type Guards**: Check types at runtime before accessing properties
- **Create Proper Interfaces**: Define interfaces for complex objects
- **Use Generic Types**: When working with dynamic data structures

#### Fix Example:
```typescript
// Before (unknown type)
const result = someFunction();
console.log(result.property); // Error: property doesn't exist on unknown

// After (typed)
interface MyResult {
  property: string;
  isValid: boolean;
}

const result: MyResult = someFunction();
console.log(result.property); // Safe access
```

### 6. Configuration Object Issues

**Error Pattern**: `TS2353: Object literal may only specify known properties`
**Example**: `'cacheTTL' does not exist in type 'RDFDataLoaderOptions'`

#### Best Practices:
- **Update Interface Definitions**: Add missing properties to configuration interfaces
- **Use Partial Types**: For optional configuration objects
- **Validate Configuration**: Add runtime validation for configuration objects
- **Document Configuration**: Provide clear documentation for all options

#### Fix Example:
```typescript
// Before (missing properties)
interface RDFDataLoaderOptions {
  baseUri: string;
  validateSyntax: boolean;
}

// After (complete interface)
interface RDFDataLoaderOptions {
  baseUri: string;
  validateSyntax: boolean;
  cacheTTL?: number;
  httpTimeout?: number;
  templateDir?: string;
  maxRetries?: number;
}
```

## Implementation Strategy

### Phase 1: Critical Fixes (High Priority)
1. **Fix API Signature Mismatches**: Update method calls to match library APIs
2. **Resolve Import Issues**: Correct import statements for external libraries
3. **Add Missing Properties**: Update type definitions to include required properties

### Phase 2: Type Safety Improvements (Medium Priority)
1. **Add Type Annotations**: Explicitly type function parameters and returns
2. **Create Proper Interfaces**: Define interfaces for complex data structures
3. **Implement Type Guards**: Add runtime type checking where needed

### Phase 3: Configuration and Options (Low Priority)
1. **Update Configuration Types**: Add missing options to configuration interfaces
2. **Improve Error Handling**: Add proper error types and handling
3. **Enhance Documentation**: Document all configuration options and types

## Testing Strategy

### Unit Testing
- **Type Tests**: Use `tsd` or similar tools to test type definitions
- **Interface Validation**: Test that interfaces match runtime objects
- **Error Handling**: Test error cases and edge conditions

### Integration Testing
- **API Compatibility**: Test that updated method calls work with actual libraries
- **Configuration Validation**: Test configuration objects with various options
- **Type Safety**: Verify that type annotations prevent runtime errors

## Tools and Resources

### TypeScript Tools
- **tsc --noEmit**: Check types without generating output
- **tsd**: Test type definitions
- **typescript-eslint**: Lint TypeScript code for type issues

### Library Documentation
- **@types packages**: Official type definitions for popular libraries
- **Library documentation**: Always check official docs for API changes
- **GitHub issues**: Check for known type definition issues

### Debugging Tips
- **Use `any` temporarily**: For complex type issues, use `any` as a temporary fix
- **Gradual typing**: Add types incrementally rather than all at once
- **Type assertions**: Use `as` when you know the type but TypeScript doesn't
- **Generic constraints**: Use generic type constraints for flexible but safe types

## Common Pitfalls to Avoid

1. **Over-typing**: Don't add unnecessary complexity to simple types
2. **Ignoring Errors**: Don't suppress TypeScript errors with `@ts-ignore`
3. **Breaking Changes**: Avoid making breaking changes to public APIs
4. **Inconsistent Types**: Maintain consistency across similar objects
5. **Missing Null Checks**: Always handle potential null/undefined values

## Conclusion

These best practices provide a systematic approach to fixing TypeScript errors while maintaining code quality and type safety. The key is to address errors incrementally, starting with the most critical issues that prevent compilation, then moving to type safety improvements, and finally enhancing the overall type system.
