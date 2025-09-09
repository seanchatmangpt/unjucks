# Migration Guide: Converting to Reusable Workflows

This guide shows how to migrate existing GitHub workflows to use the new reusable components.

## Before and After Examples

### 1. Simple CI Workflow Migration

**Before** (Duplicated Setup Code):
```yaml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      - run: npm ci
      - run: npm test

  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4  # Duplicate!
      - uses: actions/setup-node@v4  # Duplicate!
        with:
          node-version: '18'
          cache: 'npm'
      - run: npm ci  # Duplicate!
      - run: npm run build
```

**After** (Using Reusable Components):
```yaml
name: CI
on: [push, pull_request]
jobs:
  test:
    uses: ./.github/workflows/reusable/test.yml

  build:
    needs: test
    uses: ./.github/workflows/reusable/build.yml
```

**Benefits**: 
- 🚀 Reduced from 20+ lines to 8 lines
- 🔧 No duplicate setup code
- 🛡️ Automatic security scanning and caching
- 📊 Built-in test result uploads

### 2. Complex Matrix Testing Migration

**Before**:
```yaml
test:
  runs-on: ubuntu-latest
  strategy:
    matrix:
      node-version: [18, 20, 22]
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: ${{ matrix.node-version }}
        cache: 'npm'
    - run: npm ci
    - run: npm test
    - run: npm run test:integration
    - uses: actions/upload-artifact@v4
      with:
        name: test-results-${{ matrix.node-version }}
        path: coverage/
```

**After**:
```yaml
test:
  uses: ./.github/workflows/reusable/test.yml
  with:
    test-matrix: '["18", "20", "22"]'
    additional-test-commands: '["npm run test:integration"]'
    enable-coverage: true
```

**Benefits**:
- 🎯 Same functionality with 70% less code
- 🔍 Automatic coverage threshold checking
- 📈 Built-in coverage reporting to Codecov

### 3. Publishing Workflow Migration

**Before**:
```yaml
publish:
  runs-on: ubuntu-latest
  environment: production
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: '18'
        registry-url: 'https://registry.npmjs.org'
    - run: npm ci
    - run: npm run build
    - run: npm publish
      env:
        NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
    - uses: actions/create-release@v1
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      with:
        tag_name: v${{ steps.version.outputs.version }}
        release_name: Release ${{ steps.version.outputs.version }}
```

**After**:
```yaml
publish:
  uses: ./.github/workflows/reusable/publish.yml
  with:
    enable-provenance: true
    create-github-release: true
    pre-publish-commands: '["npm run build"]'
  secrets:
    NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**Benefits**:
- 🔐 Built-in package validation and version checking
- 📦 Automatic provenance generation for security
- ✅ Dry-run capability for testing
- 🏷️ Automated GitHub release creation

## Step-by-Step Migration Process

### Phase 1: Assessment (15 minutes)

1. **Audit existing workflows**:
   ```bash
   find .github/workflows -name "*.yml" -exec echo "=== {} ===" \; -exec grep -A5 -B5 "actions/checkout\|actions/setup-node\|npm ci\|npm install" {} \;
   ```

2. **Identify common patterns**:
   - [ ] Repeated checkout/setup/install sequences
   - [ ] Matrix testing configurations
   - [ ] Build and artifact upload steps
   - [ ] Publishing workflows

### Phase 2: Setup Reusable Components (5 minutes)

1. **Copy reusable workflows** (already done in your repository):
   ```
   .github/workflows/reusable/
   ├── setup.yml
   ├── test.yml
   ├── build.yml
   ├── publish.yml
   └── README.md
   ```

2. **Validate components**:
   ```bash
   node scripts/validate-reusable-workflows.js
   ```

### Phase 3: Migrate One Workflow at a Time (10-20 minutes each)

#### Example: Migrating CI/CD Pipeline

**Original workflow**: `.github/workflows/ci-cd-validation.yml`

**Step 1**: Create new simplified workflow
```yaml
# .github/workflows/ci-cd-reusable.yml
name: CI/CD Pipeline (Reusable)
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    uses: ./.github/workflows/reusable/test.yml
    with:
      test-matrix: '["18", "20", "22"]'
      enable-coverage: true
      coverage-threshold: '85'
      additional-test-commands: '["npm run test:integration", "npm run test:security"]'

  build:
    needs: test
    uses: ./.github/workflows/reusable/build.yml
    with:
      enable-typecheck: true
      enable-security-scan: true
      pre-build-commands: '["npm run validate:templates", "npm run validate:schema"]'

  publish:
    needs: [test, build]
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    uses: ./.github/workflows/reusable/publish.yml
    with:
      enable-provenance: true
      pre-publish-commands: '["npm run package:validate"]'
    secrets:
      NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
      GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**Step 2**: Test the new workflow
```bash
# Enable the new workflow
git add .github/workflows/ci-cd-reusable.yml
git commit -m "feat: add reusable CI/CD workflow"
git push

# Monitor the workflow run in GitHub Actions
```

**Step 3**: Compare results and iterate
- Check that all tests pass
- Verify artifacts are uploaded correctly
- Ensure coverage reports work
- Test publishing (dry run first)

**Step 4**: Replace original workflow
```bash
# Disable old workflow by renaming
mv .github/workflows/ci-cd-validation.yml .github/workflows/ci-cd-validation.yml.backup

# Rename new workflow to take its place
mv .github/workflows/ci-cd-reusable.yml .github/workflows/ci-cd-validation.yml
```

### Phase 4: Advanced Customization

#### Custom Input Patterns
```yaml
# Environment-specific testing
test-staging:
  uses: ./.github/workflows/reusable/test.yml
  with:
    enable-matrix: false
    node-version: '20'
    additional-test-commands: '["npm run test:staging"]'

test-production:
  uses: ./.github/workflows/reusable/test.yml
  with:
    test-matrix: '["18", "20", "22"]'
    additional-test-commands: '["npm run test:full-suite"]'
```

#### Conditional Workflows
```yaml
# Different behavior based on branch
test:
  uses: ./.github/workflows/reusable/test.yml
  with:
    enable-matrix: ${{ github.ref == 'refs/heads/main' }}
    test-matrix: '["18", "20", "22"]'
    node-version: '20'  # Used when matrix is disabled
    coverage-threshold: ${{ github.ref == 'refs/heads/main' && '90' || '80' }}
```

## Rollback Plan

If issues arise during migration:

1. **Immediate rollback**:
   ```bash
   # Restore original workflow
   mv .github/workflows/ci-cd-validation.yml.backup .github/workflows/ci-cd-validation.yml
   
   # Remove problematic reusable workflow
   rm .github/workflows/ci-cd-reusable.yml
   ```

2. **Partial rollback**:
   ```yaml
   # Keep some reusable components, inline others
   jobs:
     test:
       uses: ./.github/workflows/reusable/test.yml  # Keep working parts
     
     build:
       runs-on: ubuntu-latest  # Inline problematic parts
       steps:
         - uses: actions/checkout@v4
         # ... custom build steps
   ```

## Validation Checklist

Before completing migration:

- [ ] All tests pass in new workflows
- [ ] Artifacts are uploaded correctly
- [ ] Coverage reports work as expected
- [ ] Security scans complete successfully  
- [ ] Publishing workflows work (test with dry-run first)
- [ ] Job dependencies and conditions work correctly
- [ ] Secrets are passed properly to reusable workflows
- [ ] Workflow summaries and logs are helpful
- [ ] Performance is same or better than original workflows

## Common Issues and Solutions

### Issue: "workflow_call trigger not found"
**Solution**: Ensure reusable workflows have `workflow_call` trigger:
```yaml
on:
  workflow_call:
    # ... inputs and secrets
```

### Issue: "Input validation failed"
**Solution**: Check input types match expected formats:
```yaml
with:
  test-matrix: '["18", "20", "22"]'  # JSON string, not array
  enable-coverage: true              # boolean, not string
  coverage-threshold: '85'           # string, not number
```

### Issue: "Secret not available in reusable workflow"
**Solution**: Pass secrets explicitly:
```yaml
uses: ./.github/workflows/reusable/publish.yml
secrets:
  NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### Issue: "Path resolution errors"
**Solution**: Use repository-relative paths:
```yaml
uses: ./.github/workflows/reusable/test.yml  # Correct
# not: uses: ./reusable/test.yml              # Incorrect
```

## Expected Benefits After Migration

- 📈 **50-70% reduction** in workflow code duplication
- 🚀 **Faster development** with consistent patterns
- 🛡️ **Better security** with built-in scanning and validation
- 📊 **Improved observability** with better logging and summaries
- 🔧 **Easier maintenance** with centralized workflow logic
- ⚡ **Better performance** with optimized caching strategies