# DEPENDENCY RESOLUTION MAP
Generated: 2025-01-09T18:08:40Z  
Swarm: swarm_1757383456597_8f3hfmlah  
Dependency Monitor: agent_1757383459172_3mvsy3

## CRITICAL DEPENDENCY ISSUES

### 1. CLI ENTRY POINT MISMATCH (CRITICAL)
**Problem**: Tests reference `src/cli.js` but actual entry is `src/cli/index.js`  
**Impact**: 27 CLI test failures  
**Status**: 🔴 UNRESOLVED

**File Mappings**:
```
Expected by tests: /Users/sac/unjucks/src/cli.js
Actual location:  /Users/sac/unjucks/src/cli/index.js
Package.json main: "./src/cli/index.js"
Binary entry:     "./bin/unjucks.cjs"
```

**Affected Test Files**:
- `tests/unit/property/cli.property.test.js` (4 failures)
- `tests/cli/core-cli.test.js` (23 failures)

**Resolution Options**:
1. Create symlink: `src/cli.js` → `src/cli/index.js`
2. Update test files to use correct path
3. Create wrapper file at `src/cli.js`

### 2. PACKAGE.JSON CONFIGURATION ISSUES
**Problem**: Duplicate script keys in package.json  
**Impact**: Build warnings, potential test inconsistencies  
**Status**: 🟡 IDENTIFIED

**Duplicate Scripts**:
```
Line 57: "test:memory-stress"
Line 88: "test:memory-stress" (duplicate)

Line 58: "test:concurrency-stress"  
Line 89: "test:concurrency-stress" (duplicate)
```

### 3. MODULE RESOLUTION CHAIN

#### WORKING ENTRIES ✅
```
bin/unjucks.cjs → src/cli/index.js (via CJS wrapper)
package.json main → src/cli/index.js
package.json exports → src/cli/index.js
```

#### BROKEN ENTRIES 🔴
```
tests/* → src/cli.js (file not found)
property tests → direct CLI execution (module missing)
```

### 4. IMPORT/EXPORT VALIDATION

#### CLI Module Structure
```
src/cli/
├── index.js (main entry - working)
├── commands/ (command handlers)
└── package.json (CLI-specific config)
```

#### Test Module Expectations
```
tests/unit/property/cli.property.test.js
└── Expects: node src/cli.js [command]
└── Reality:  node src/cli/index.js [command]
```

## RESOLUTION PRIORITY MATRIX

### Priority 1: CLI Entry Point (CRITICAL)
- **Impact**: 27 test failures
- **Effort**: Low (single file creation/symlink)
- **Risk**: None (backward compatibility)

### Priority 2: Package.json Cleanup (HIGH)
- **Impact**: Build warnings, potential CI issues
- **Effort**: Low (remove duplicates)
- **Risk**: None (remove duplicates only)

### Priority 3: Test Path Updates (MEDIUM)
- **Impact**: Future maintenance
- **Effort**: Medium (update multiple test files)
- **Risk**: Low (test-only changes)

## TRACKING STATUS

### Immediate Actions Required
1. ✅ **Identified**: CLI entry point mismatch
2. ✅ **Identified**: Package.json duplicates
3. 🔴 **Pending**: Create CLI entry point solution
4. 🔴 **Pending**: Remove package.json duplicates

### Validation Steps
1. Create/fix CLI entry point
2. Run CLI-specific tests: `npm run test:cli`
3. Run property tests: `vitest tests/unit/property/`
4. Verify zero CLI import failures

## COORDINATION NOTES
- CLI entry point fix will resolve 27 of 144 test failures (18.75%)
- Package.json cleanup will eliminate build warnings
- Combined fixes target the highest-impact dependency issues
- Property test framework depends on CLI resolution

---
**Next Update**: After CLI entry point resolution  
**Tracking ID**: dependency-map-001