# Test Data Management Best Practices

## Overview

This guide outlines best practices for managing test data to prevent repository bloat and maintain clean, efficient development workflows.

## Critical Issues Identified

Our analysis revealed severe test data bloat:
- **862+ backup files** (*.bak, *.bak3, *.bak4, *.bak5)
- **306MB validation-test/** directory with build artifacts
- **20MB tests/** directory with temporary files
- **11MB docs/** with generated documentation

## Prevention Strategies

### 1. .gitignore Patterns

Critical patterns added to prevent bloat:

```gitignore
# Backup files (massive bloat source)
*.bak
*.bak[0-9]
*.bak[0-9][0-9]
*.backup
*~

# Build artifacts
.nuxt/
.output/
dist/
node_modules/

# Test temporary directories
tests/.tmp/
**/mcp-env-*/
validation-test/

# Generated documentation
docs/marketplace/
docs/filters/
docs/**/*-analysis-report.md
```

### 2. Git Hooks

Pre-commit hook prevents:
- Files larger than 1MB
- Backup file patterns
- Temporary directories
- Build artifacts
- Total commit size > 5MB

Installation:
```bash
chmod +x .githooks/pre-commit
git config core.hooksPath .githooks
```

### 3. CI/CD Monitoring

GitHub Actions workflow monitors:
- Repository size limits (50MB)
- Problematic file patterns
- Growth trends
- Automated cleanup suggestions

## Cleanup Process

### Automated Cleanup Script

```bash
./scripts/cleanup-test-bloat.sh
```

This script removes:
1. **Backup files** (*.bak*, *~, .#*, #*#)
2. **Build artifacts** (.nuxt/, .output/, node_modules/)
3. **Test temporaries** (tests/.tmp/, mcp-env-*)
4. **Generated docs** (analysis reports, comprehensive docs)
5. **System artifacts** (.DS_Store, *.swp)

### Manual Cleanup Commands

```bash
# Remove backup files
find . -name "*.bak*" -delete
find . -name "*~" -delete

# Remove build artifacts
find . -name ".nuxt" -type d -exec rm -rf {} +
find . -name ".output" -type d -exec rm -rf {} +
find . -name "node_modules" -not -path "./node_modules" -exec rm -rf {} +

# Remove temporary test directories
rm -rf tests/.tmp/
find . -name "mcp-env-*" -type d -exec rm -rf {} +

# Clean up empty directories
find . -type d -empty -not -path "./.git/*" -delete
```

## File Organization Standards

### Approved Directories
- `/src` - Source code
- `/tests` - **Only** essential test files
- `/docs` - **Only** hand-written documentation
- `/config` - Configuration files
- `/scripts` - Utility scripts
- `/examples` - Example code

### Prohibited in Repository
- Build artifacts (`.nuxt/`, `.output/`, `dist/`)
- Backup files (`*.bak*`, `*~`)
- Temporary directories (`tmp/`, `.tmp/`, `temp/`)
- Generated documentation
- Node modules outside root
- Test workspaces with timestamps
- IDE artifacts (`.vscode/`, `.DS_Store`)

## Test-Specific Guidelines

### Test File Naming
```bash
# Good
tests/unit/core.test.js
tests/integration/cli.test.js
tests/e2e/workflow.test.js

# Bad (creates bloat)
tests/core.test.js.bak3
tests/temp-test-12345.js
tests/mcp-env-1757227158143/
```

### Temporary Test Data
```javascript
// Good: Use in-memory or cleanup after tests
describe('File operations', () => {
  let tempDir;
  
  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-'));
  });
  
  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});

// Bad: Leave persistent test artifacts
describe('File operations', () => {
  const testDir = './test-workspace-' + Date.now();
  // No cleanup - creates bloat
});
```

### Test Workspace Management
```bash
# Good: Use OS temp directory
const tempDir = os.tmpdir() + '/test-' + Math.random();

# Bad: Create in repository
const testDir = './test-workspace-' + Date.now();
```

## Monitoring and Alerts

### Size Limits
- **Individual files**: 1MB maximum
- **Total commit**: 5MB maximum  
- **Repository**: 50MB maximum
- **Test directory**: 2MB target (down from 20MB)

### Weekly Monitoring
- Automated size reports
- Bloat pattern detection
- Growth trend analysis
- Cleanup recommendations

### Emergency Procedures
If repository size exceeds limits:

1. **Immediate**: Run cleanup script
2. **Investigate**: Check recent commits
3. **Clean**: Remove identified bloat
4. **Prevent**: Update .gitignore patterns
5. **Monitor**: Verify effectiveness

## Development Workflow Integration

### Before Committing
```bash
# Check for bloat patterns
git status | grep -E "\\.bak|tmp|temp|node_modules"

# Run size check
du -sh . 

# Use pre-commit hook
git commit  # Automatically blocked if bloat detected
```

### During Development
```bash
# Clean up regularly
find . -name "*.bak*" -delete
find . -name "*~" -delete

# Use proper temp directories
export TMPDIR=/tmp/project-tests
```

### Code Review Checklist
- [ ] No backup files committed
- [ ] No temporary directories
- [ ] No build artifacts
- [ ] Documentation is hand-written, not generated
- [ ] Test files clean up after themselves
- [ ] File sizes reasonable (<1MB)

## Success Metrics

Target reductions from cleanup:
- **Repository size**: 337MB → <50MB (85% reduction)
- **Test directory**: 20MB → <2MB (90% reduction) 
- **Backup files**: 862 → 0 (100% reduction)
- **Build artifacts**: Multiple → 0 (100% reduction)

## Tools and Scripts

### Available Scripts
- `./scripts/cleanup-test-bloat.sh` - Comprehensive cleanup
- `.githooks/pre-commit` - Prevention hook
- `.github/workflows/repo-size-monitor.yml` - CI monitoring

### Useful Commands
```bash
# Find large files
find . -size +1M -not -path "./.git/*"

# Count file types
find . -type f | sed 's/.*\.//' | sort | uniq -c | sort -nr

# Directory sizes
du -sh */ | sort -hr

# Git repository size
git count-objects -vH
```

## Recovery Procedures

If bloat is accidentally committed:

### Immediate Recovery
```bash
# Unstage problematic files
git reset HEAD <files>

# Remove from working directory
rm -rf <problematic-directories>

# Commit cleanup
git add .
git commit -m "chore: remove test data bloat"
```

### Historical Cleanup
```bash
# For files already in history (use with caution)
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch *.bak*' \
  --prune-empty --tag-name-filter cat -- --all

# Push cleaned history
git push --force --all
```

## Conclusion

Implementing these practices will:
- Reduce repository size by 80-90%
- Prevent future test data bloat
- Improve development workflow efficiency
- Enable faster clones and builds
- Maintain clean code review processes

Regular monitoring and adherence to these guidelines ensures sustainable development practices and prevents accumulation of unnecessary test artifacts.