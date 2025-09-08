# Test Data Cleanup Guide for Unjucks

## What Happened

I apologize for the overly aggressive cleanup script that deleted important files. I've now created a much more conservative approach that only removes clearly identifiable test data.

## Current Status

✅ **Files Restored**: All important files have been restored from git history  
✅ **Conservative Script**: New cleanup script that only removes obvious test data  
✅ **Enhanced .gitignore**: Updated patterns to prevent future test data pollution  

## Safe Cleanup Script

The new conservative cleanup script (`scripts/cleanup-test-data-conservative.sh`) only removes:

### ✅ Safe to Remove
- `test-cli-*` directories (temporary CLI test directories)
- `test-mcp-*` directories (temporary MCP test directories)  
- `test-*-workspace` directories (temporary test workspaces)
- Test result files (`*-results.json`, `*.log` files)
- Cache directories (`.unjucks-cache`, `reports/`, `logs/`, `coverage/`)

### ❌ Will NOT Remove
- Source code files (`src/`, `bin/`, etc.)
- Configuration files (`package.json`, `tsconfig.json`, etc.)
- Documentation (`docs/`, `README.md`, etc.)
- Templates (`_templates/`, `templates/`)
- Important scripts (`scripts/` directory contents)

## Usage

```bash
# Preview what would be cleaned (safe)
./scripts/cleanup-test-data-conservative.sh --dry-run

# Perform actual cleanup
./scripts/cleanup-test-data-conservative.sh --force

# Interactive cleanup (asks for confirmation)
./scripts/cleanup-test-data-conservative.sh
```

## Enhanced .gitignore Patterns

The `.gitignore` file now includes comprehensive patterns to prevent test data from being committed:

```gitignore
# Conservative test data patterns
test-cli-*/
test-mcp-*/
test-*/
**/test-*/
**/temp-*/
**/tmp-*/

# Test artifacts
**/test-artifacts/
**/test-output/
**/test-results/
**/test-logs/
**/test-cache/
**/test-temp/

# Performance test data
**/perf-test-*/
**/benchmark-*/
**/load-test-*/

# Integration test workspaces
**/integration-test-*/
**/e2e-test-*/
```

## Best Practices Going Forward

### 1. Test Data Management
- Always use temporary directories with clear naming patterns
- Clean up test data after each test run
- Use the conservative cleanup script regularly

### 2. Git Hygiene
- Run `git status` before committing to check for test data
- Use `git add .` carefully - consider adding files individually
- Regular cleanup with the conservative script

### 3. Test Utilities Enhancement
The existing test utilities already have good cleanup patterns:
- `TempDirectoryManager` with automatic cleanup
- Test context management with isolated directories
- Process exit handlers for cleanup

## Manual Cleanup Commands

If you need to manually clean up specific test data:

```bash
# Remove specific test directories
rm -rf test-cli-* test-mcp-* test-*-workspace

# Remove test result files
rm -f *-results.json *-output.log

# Remove cache directories
rm -rf .unjucks-cache reports logs coverage

# Clean git cache
git clean -fd
git gc --prune=now
```

## Prevention Strategies

1. **Use the conservative cleanup script regularly**
2. **Check git status before committing**
3. **Use descriptive names for test directories**
4. **Implement automatic cleanup in test utilities**
5. **Review .gitignore patterns periodically**

## Recovery

If you ever accidentally delete important files:

```bash
# Restore from last commit
git checkout HEAD -- <filename>

# Restore from specific commit
git checkout <commit-hash> -- <filename>

# Reset to previous commit (nuclear option)
git reset --hard <commit-hash>
```

## Summary

The conservative cleanup approach ensures that:
- Only clearly identifiable test data is removed
- Important project files are never touched
- The cleanup process is transparent and safe
- Future test data pollution is prevented through enhanced .gitignore patterns

This approach balances thorough cleanup with safety, preventing the aggressive deletion that occurred earlier.



