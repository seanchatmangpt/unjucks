# Import and Type Issues Analysis

## Issues Identified

### 1. Duplicate ValidationResult Interfaces
Found **28 different ValidationResult interfaces** across the codebase:
- `src/types/unified-types.ts` (canonical definition)
- `src/lib/validation/ArgumentValidator.ts` (duplicate)
- `src/lib/types/validation.ts` (duplicate)
- `src/types/commands.ts` (duplicate)
- Multiple other files with local definitions

### 2. Missing Unified Types Imports
Files that use types but don't import from `unified-types.ts`:
- `src/commands/generate.ts` - has imports but incomplete
- `src/commands/inject.ts` - has imports but incomplete  
- `src/commands/list.ts` - has imports but incomplete
- `src/lib/validation/ArgumentValidator.ts` - needs complete refactor
- `src/lib/*.ts` files - many missing imports
- `tests/validation/*.ts` - missing imports

### 3. Circular Reference Issues
- `ArgumentValidator.ts` defines its own ValidationResult but imports from unified-types
- Multiple files define the same interfaces causing conflicts
- ValidationRule is defined in multiple places

## Current Status of Fixes

### ✅ Completed
1. Created analysis directory structure
2. Identified scope of duplicate interface problem

### 🔄 In Progress  
1. Fixing ArgumentValidator.ts to use unified types only
2. Removing duplicate ValidationResult interfaces

### ⏳ Pending
1. Update all src/commands/*.ts files
2. Update all src/lib/*.ts files
3. Update test files
4. Validate TypeScript compilation
5. Clean up remaining duplicate definitions

## Files Requiring Import Updates

### High Priority (Core Commands)
- `src/commands/generate.ts`
- `src/commands/inject.ts`
- `src/commands/list.ts`
- `src/lib/validation/ArgumentValidator.ts`

### Medium Priority (Library Files)
- `src/lib/generator.ts`
- `src/lib/frontmatter-parser.ts`
- `src/lib/template-scanner.ts`
- `src/lib/semantic-engine.ts`

### Low Priority (Tests & Utils)
- `tests/validation/*.ts` files
- Various utility and helper files

## Strategy

1. **Centralize on unified-types.ts** - All types should come from this single source
2. **Remove duplicates** - Delete local type definitions
3. **Update imports** - Ensure all files import from unified-types.ts
4. **Fix property mismatches** - Some interfaces use `isValid` vs `valid`
5. **Test compilation** - Ensure TypeScript compiles without errors