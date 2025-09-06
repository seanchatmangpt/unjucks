# TypeScript Error: Invalid Characters in String Literals

## Issue
**File:** `tests/security/attack-simulation.test.ts`  
**Error:** TS1127 Invalid character errors due to improperly escaped quotes in string literals

## Root Cause
Line 361 contains a string literal with improperly escaped quotes, causing TypeScript to fail parsing the string. The backslashes before quotes are not properly escaped for JavaScript/TypeScript.

## Affected Code
```typescript
// Line 361
{ command: "test && python -c \\"import os; os.system('rm -rf /')\\"", severity: "CRITICAL" as const }
```

## Potential Fixes

### Option 1: Fix String Escaping (Recommended)
- Properly escape the quotes in the string literal
- Use single quotes for the outer string and escape inner quotes:
```typescript
{ command: 'test && python -c "import os; os.system(\'rm -rf /\')"', severity: "CRITICAL" as const }
```

### Option 2: Use Template Literals
- Convert to template literal with proper escaping:
```typescript
{ command: `test && python -c "import os; os.system('rm -rf /')"`, severity: "CRITICAL" as const }
```

### Option 3: Use Raw String Constants
- Define the command as a constant with proper escaping
- Reference the constant in the object

### Option 4: Use JSON.stringify for Complex Strings
- Use JSON.stringify to properly escape complex strings
- Parse them back if needed

## Impact Assessment
- **High Priority:** Syntax error prevents compilation
- **Simple Fix:** Proper string escaping
- **Security Test:** Important to maintain test integrity

## Recommendation
Use Option 1 (fix string escaping) as it's the most straightforward solution that maintains the test's intent while fixing the syntax error.
