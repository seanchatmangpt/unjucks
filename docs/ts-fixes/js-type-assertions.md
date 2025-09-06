# TypeScript Error: Type Assertions in JavaScript Files

## Issue
**File:** `examples/validation-workflow.js`  
**Error:** `TS8016: Type assertion expressions can only be used in TypeScript files.`

## Root Cause
The file `examples/validation-workflow.js` has a `.js` extension but contains TypeScript-specific syntax (`as const` type assertions) on lines 234, 239, 244, and 263.

## Affected Code
```javascript
// Lines 234, 239, 244, 263
type: 'rdf' as const,
type: 'template' as const,
severity: 'warning' as const,
```

## Potential Fixes

### Option 1: Rename File Extension (Recommended)
- Rename `examples/validation-workflow.js` to `examples/validation-workflow.ts`
- This allows TypeScript syntax to be used properly
- Update any imports/references to use the new `.ts` extension

### Option 2: Remove Type Assertions
- Replace `as const` assertions with regular string literals
- Change `'rdf' as const` to `'rdf'`
- Change `'template' as const` to `'template'`
- Change `'warning' as const` to `'warning'`

### Option 3: Use JSDoc Type Annotations
- Add JSDoc comments to provide type information
- Example: `/** @type {'rdf'} */ type: 'rdf'`

## Impact Assessment
- **Low Risk:** This is a configuration/syntax issue
- **Easy Fix:** Simple file rename or syntax change
- **No Breaking Changes:** The runtime behavior remains the same

## Recommendation
Use Option 1 (rename to `.ts`) as it maintains type safety while allowing proper TypeScript syntax.
