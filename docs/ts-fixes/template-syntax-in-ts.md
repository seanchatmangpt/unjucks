# TypeScript Error: Template Syntax in TypeScript Files

## Issue
**File:** `tests/integration/rdf-critical-paths.test.ts`  
**Error:** TS1005 ',' expected due to template syntax in TypeScript file

## Root Cause
The file contains template syntax (`{{ }}`, `{%- %}`) mixed with TypeScript code, which confuses the TypeScript parser. Line 288 contains Nunjucks template syntax that TypeScript cannot parse.

## Affected Code
```typescript
// Line 288
- {{ project.uri | rdfLabel }}: ${{ project.uri | rdfObject('ex:projectBudget') | first }} ({{ project.uri | rdfObject('ex:priority') | first | upper }})
```

## Potential Fixes

### Option 1: Move Template Content to Template Files (Recommended)
- Extract template content to separate `.njk` or `.ejs` files
- Use template rendering functions in TypeScript code
- Keep TypeScript logic separate from template syntax

### Option 2: Use Template Literals with Proper Escaping
- Convert template syntax to JavaScript template literals
- Escape special characters properly
- Use string interpolation instead of template syntax

### Option 3: Use Template String Constants
- Define template strings as constants
- Use template engines to process them at runtime
- Keep TypeScript code clean of template syntax

### Option 4: Exclude Test Files with Templates
- Add pattern to exclude template-heavy test files from TypeScript compilation
- Process these files separately with template engines

## Impact Assessment
- **Medium Risk:** Mixing template syntax with TypeScript can cause parsing issues
- **Architecture Issue:** Suggests need for better separation of concerns
- **Test File:** Lower priority than production code

## Recommendation
Use Option 1 (separate template files) as it provides better separation of concerns and prevents TypeScript parsing issues.
