# PR Checks Workflow Documentation

## Overview

The `pr-checks.yml` workflow provides fast, lightweight validation for pull requests with a focus on essential checks and quick feedback. It's designed to complete within 10 minutes and provide clear pass/fail status reporting.

## Workflow Features

### 🚀 Performance Optimizations
- **Maximum 10-minute timeout** - Entire workflow fails fast if taking too long
- **Ubuntu latest with Node 20 only** - Single, modern environment 
- **Smart dependency caching** - Automatic npm cache with fallback to pnpm
- **Shallow clone** - `fetch-depth: 1` for faster checkout
- **Concurrent cancellation** - Cancel previous runs on new commits

### ✅ Essential Checks

1. **Lint Check** (2 minutes max)
   - Runs `npm run lint` if available
   - Non-blocking if script doesn't exist
   - Clear pass/fail status

2. **Unit Tests** (4 minutes max)
   - Prioritizes fast unit tests over integration tests
   - Attempts multiple test script variations:
     - `npm run test`
     - `npm run test:unit`
     - `npm run test:vitest`
   - Skips heavy integration tests

3. **Build Check** (3 minutes max)
   - Runs `npm run build` if available
   - Validates that code compiles/bundles correctly
   - Essential for deployment readiness

4. **Type Check** (1 minute max, non-blocking)
   - Runs `npm run typecheck` if available
   - Continues on error for JavaScript projects
   - Provides additional validation for TypeScript projects

### 🔒 Additional Validations

**Security Check (Light)**
- Quick `npm audit` for high-severity vulnerabilities
- Production dependencies only
- Non-blocking (continues on error)
- 3-minute timeout

**Smoke Test**
- Basic functionality verification
- CLI testing if binaries exist
- 2-minute timeout
- Non-blocking

## Concurrency Control

```yaml
concurrency:
  group: pr-${{ github.event.pull_request.number }}
  cancel-in-progress: true
```

- Each PR gets its own concurrency group
- New commits cancel previous workflow runs
- Prevents resource waste and queue buildup

## Status Reporting

The workflow generates a comprehensive status report comment on the PR:

```
🚀 PR Checks Status Report

| Check | Status | Result |
|-------|--------|---------|
| **Lint** | ✅ | success |
| **Unit Tests** | ✅ | success |
| **Build** | ✅ | success |

Overall Status: ✅ PASSED

🎉 All essential checks passed! This PR is ready for review.
```

## Integration with Branch Protection

Add these required status checks to your branch protection rules:

- `Essential PR Validation`
- `pr-checks`

## Comparison with Existing pr-validation.yml

| Feature | pr-checks.yml | pr-validation.yml |
|---------|---------------|-------------------|
| **Focus** | Speed + Essential validation | Comprehensive automation |
| **Runtime** | <10 minutes | 15-30+ minutes |
| **Node Versions** | 20 only | Multiple versions |
| **Tests** | Unit tests only | Full test suite |
| **Integration** | Skipped | Included |
| **Auto-merge** | No | Yes (Dependabot) |
| **PR Commands** | No | Yes (/unjucks commands) |
| **Labeling** | No | Automatic |
| **Analysis** | Basic | Comprehensive |

## Usage Examples

### Typical Successful Run
```bash
📥 Checkout code ✅
⚡ Setup Node.js 20 ✅  
📦 Install dependencies ✅ (45s)
🧹 Lint Check ✅ (12s)
🧪 Unit Tests ✅ (2m 15s)
🏗️ Build Check ✅ (1m 30s)
📊 Generate Status Report ✅

Total: ~5 minutes
```

### Failed Build Example
```bash
📥 Checkout code ✅
⚡ Setup Node.js 20 ✅  
📦 Install dependencies ✅ (45s)
🧹 Lint Check ✅ (12s)
🧪 Unit Tests ✅ (2m 15s)
🏗️ Build Check ❌ (Build failed)
📊 Generate Status Report ✅

Status: ❌ FAILED - Build issues need fixing
```

## Best Practices

### For Contributors
1. Ensure your PR passes all essential checks before requesting review
2. Fix lint issues first - they're quickest to resolve
3. Write unit tests - they run in this workflow
4. Test your build locally before pushing

### For Maintainers
1. Use this workflow for fast PR feedback
2. Configure branch protection to require these checks
3. Keep heavy integration tests in main branch workflows
4. Monitor workflow performance and adjust timeouts if needed

## Troubleshooting

### Common Issues

**"Dependencies install timeout"**
```bash
# Solution: Check for large dependencies or network issues
# The workflow allows 3 minutes for dependency installation
```

**"Tests taking too long"**
```bash
# Solution: Move integration tests to separate workflow
# Keep only fast unit tests in pr-checks
```

**"Build failures"**
```bash
# Solution: Ensure build scripts work with Node 20
# Check for missing build dependencies
```

### Debugging

1. **Check workflow logs** - Each step is grouped for easy navigation
2. **Verify package.json scripts** - Ensure `lint`, `test`, `build` exist
3. **Test locally** - Use same Node 20 version
4. **Check timeouts** - Adjust if needed for your project size

## Configuration

### Package.json Requirements
```json
{
  "scripts": {
    "lint": "eslint src/",           // Optional but recommended
    "test": "vitest run",            // Required for test validation
    "build": "rollup -c",            // Required for build validation
    "typecheck": "tsc --noEmit"      // Optional for TypeScript projects
  }
}
```

### Workflow Customization

To customize timeouts or add steps, edit `.github/workflows/pr-checks.yml`:

```yaml
# Adjust timeouts
- name: 🧪 Unit Tests
  timeout-minutes: 6  # Increase from 4 if needed

# Add custom validation
- name: 🔍 Custom Check
  run: npm run custom-validation
  timeout-minutes: 2
```

## Performance Metrics

Target performance for typical projects:

- **Small PRs** (<50 lines): 3-5 minutes
- **Medium PRs** (50-200 lines): 5-7 minutes  
- **Large PRs** (200+ lines): 7-10 minutes
- **Maximum allowed**: 10 minutes (hard timeout)

This workflow prioritizes speed and essential validation to provide rapid feedback to contributors while maintaining code quality standards.