# Intelligent Matrix Strategy Configuration

## Overview

This document outlines our intelligent matrix strategy that dynamically adjusts CI/CD test matrices based on branch type, changed files, and release status. This approach optimizes resource usage while maintaining comprehensive testing coverage for critical changes.

## Strategy Summary

| Branch Type | OS Coverage | Node Versions | Use Case |
|-------------|-------------|---------------|----------|
| Feature Branches | Ubuntu only | Node 20 only | Fast feedback for development |
| Develop Branch | Ubuntu + Windows | Node 18, 20, 22 | Pre-integration validation |
| Main Branch | All OS (Ubuntu, Windows, macOS) | Node 18, 20, 22 | Production-ready validation |
| Release Tags | All OS + Extended | Node 16, 18, 20, 22 | Complete compatibility matrix |

## Core Principles

### 1. Progressive Matrix Expansion
- **Minimal for speed**: Feature branches use minimal matrix for rapid feedback
- **Expand for stability**: Main branch uses comprehensive matrix for production readiness
- **Full for releases**: Release tags test complete compatibility matrix

### 2. Smart Exclusions
- **Performance-based**: Exclude slow/redundant combinations
- **Compatibility-based**: Skip known incompatible combinations
- **Resource-based**: Optimize for GitHub Actions minute usage

### 3. File-Based Adjustments
- **Core changes**: Trigger full matrix regardless of branch
- **Documentation only**: Use minimal matrix even on main
- **Security changes**: Always run full security matrix

## Matrix Configuration Templates

### Base Matrix Configuration

```yaml
# .github/workflows/templates/base-matrix.yml
strategy:
  fail-fast: false
  matrix:
    include:
      # Feature branches - minimal matrix
      - if: ${{ github.ref_type == 'branch' && !contains(github.ref, 'main') && !contains(github.ref, 'develop') }}
        os: ubuntu-latest
        node: '20'
        test-type: smoke
      
      # Develop branch - extended matrix
      - if: ${{ github.ref == 'refs/heads/develop' }}
        os: [ubuntu-latest, windows-latest]
        node: ['18', '20', '22']
        test-type: integration
      
      # Main branch - full matrix
      - if: ${{ github.ref == 'refs/heads/main' }}
        os: [ubuntu-latest, windows-latest, macos-latest]
        node: ['18', '20', '22']
        test-type: full
      
      # Release tags - complete matrix
      - if: ${{ github.ref_type == 'tag' }}
        os: [ubuntu-latest, windows-latest, macos-latest]
        node: ['16', '18', '20', '22']
        test-type: comprehensive
```

### Smart Exclusions Configuration

```yaml
# Smart exclusions for efficiency and compatibility
exclude:
  # Skip Node 16 on non-release builds (deprecated)
  - node: '16'
    if: ${{ github.ref_type != 'tag' }}
  
  # Skip older Node versions on Windows (performance optimization)
  - os: windows-latest
    node: '18'
    if: ${{ !contains(github.event.head_commit.message, '[test-windows]') }}
  
  # Skip macOS for non-critical changes
  - os: macos-latest
    if: ${{ !contains(github.event.head_commit.modified, 'src/') && github.ref_type != 'tag' }}
  
  # Skip comprehensive tests for docs-only changes
  - test-type: comprehensive
    if: ${{ github.event.head_commit.modified == 'docs/**' || github.event.head_commit.modified == '*.md' }}
```

## Dynamic Matrix Generation

### Branch-Based Matrix Selection

```javascript
// .github/scripts/generate-matrix.js
function generateMatrix(context) {
  const { ref, refType, eventName } = context;
  
  // Base configuration
  const matrices = {
    minimal: {
      os: ['ubuntu-latest'],
      node: ['20'],
      'test-strategy': ['smoke']
    },
    standard: {
      os: ['ubuntu-latest', 'windows-latest'],
      node: ['18', '20', '22'],
      'test-strategy': ['integration']
    },
    full: {
      os: ['ubuntu-latest', 'windows-latest', 'macos-latest'],
      node: ['18', '20', '22'],
      'test-strategy': ['comprehensive']
    },
    release: {
      os: ['ubuntu-latest', 'windows-latest', 'macos-latest'],
      node: ['16', '18', '20', '22'],
      'test-strategy': ['comprehensive', 'compatibility']
    }
  };
  
  // Branch-based selection
  if (refType === 'tag') {
    return matrices.release;
  } else if (ref === 'refs/heads/main') {
    return matrices.full;
  } else if (ref === 'refs/heads/develop') {
    return matrices.standard;
  } else {
    return matrices.minimal;
  }
}
```

### File-Based Matrix Adjustments

```yaml
# File pattern matrix overrides
matrix-overrides:
  core-changes:
    pattern: 'src/**'
    force-matrix: full
    reason: "Core changes require comprehensive testing"
  
  security-changes:
    pattern: ['src/security/**', 'package.json', '.github/**']
    force-matrix: full
    additional-tests: ['security', 'audit']
    reason: "Security changes require full validation"
  
  performance-changes:
    pattern: ['src/performance/**', 'benchmarks/**']
    force-matrix: full
    additional-tests: ['performance', 'benchmarks']
    reason: "Performance changes require benchmarking"
  
  docs-only:
    pattern: ['docs/**', '*.md', 'README.*']
    force-matrix: minimal
    skip-tests: ['integration', 'performance']
    reason: "Documentation changes don't affect functionality"
  
  config-only:
    pattern: ['*.config.*', '.eslintrc*', '.prettierrc*']
    matrix: standard
    focus-tests: ['lint', 'format']
    reason: "Config changes need validation but not full testing"
```

## Implementation Examples

### Workflow Integration Example

```yaml
name: Smart Matrix CI/CD

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  matrix-generation:
    name: Generate Intelligent Matrix
    runs-on: ubuntu-latest
    outputs:
      matrix: ${{ steps.generate.outputs.matrix }}
      test-strategy: ${{ steps.generate.outputs.test-strategy }}
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      
      - name: Analyze Changes
        id: changes
        uses: dorny/paths-filter@v3
        with:
          filters: |
            core:
              - 'src/**'
              - 'bin/**'
            security:
              - 'src/security/**'
              - 'package*.json'
            docs:
              - 'docs/**'
              - '*.md'
      
      - name: Generate Matrix
        id: generate
        run: |
          # Determine base matrix from branch
          if [[ "${{ github.ref }}" == "refs/heads/main" ]]; then
            BASE_MATRIX="full"
          elif [[ "${{ github.ref }}" == "refs/heads/develop" ]]; then
            BASE_MATRIX="standard"  
          else
            BASE_MATRIX="minimal"
          fi
          
          # Override based on file changes
          if [[ "${{ steps.changes.outputs.core }}" == "true" ]]; then
            FINAL_MATRIX="full"
          elif [[ "${{ steps.changes.outputs.docs }}" == "true" && "$BASE_MATRIX" != "minimal" ]]; then
            FINAL_MATRIX="minimal"
          else
            FINAL_MATRIX="$BASE_MATRIX"
          fi
          
          # Generate matrix JSON
          case $FINAL_MATRIX in
            minimal)
              echo 'matrix={"os":["ubuntu-latest"],"node":["20"]}' >> $GITHUB_OUTPUT
              echo 'test-strategy=smoke' >> $GITHUB_OUTPUT
              ;;
            standard)
              echo 'matrix={"os":["ubuntu-latest","windows-latest"],"node":["18","20","22"]}' >> $GITHUB_OUTPUT
              echo 'test-strategy=integration' >> $GITHUB_OUTPUT
              ;;
            full)
              echo 'matrix={"os":["ubuntu-latest","windows-latest","macos-latest"],"node":["18","20","22"]}' >> $GITHUB_OUTPUT
              echo 'test-strategy=comprehensive' >> $GITHUB_OUTPUT
              ;;
          esac

  test-matrix:
    name: Test (${{ matrix.os }}, Node ${{ matrix.node }})
    runs-on: ${{ matrix.os }}
    needs: matrix-generation
    strategy:
      fail-fast: false
      matrix: ${{ fromJson(needs.matrix-generation.outputs.matrix) }}
      # Smart exclusions
      exclude:
        - os: windows-latest
          node: '18'
        - os: macos-latest  
          node: '18'
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node }}
      
      - run: npm ci
      
      - name: Run Tests
        run: |
          case "${{ needs.matrix-generation.outputs.test-strategy }}" in
            smoke)
              npm run test:smoke
              ;;
            integration)
              npm run test:smoke
              npm run test:integration
              ;;
            comprehensive)
              npm run test:smoke
              npm run test:integration
              npm run test:full
              ;;
          esac
```

## Performance Optimization Strategies

### 1. Caching Strategy
```yaml
cache-strategy:
  node_modules:
    key: deps-${{ runner.os }}-${{ hashFiles('package-lock.json') }}
    paths: ['node_modules']
  
  build-outputs:
    key: build-${{ runner.os }}-${{ github.sha }}
    paths: ['dist', 'coverage', '.cache']
  
  test-results:
    key: tests-${{ matrix.os }}-${{ matrix.node }}-${{ github.sha }}
    paths: ['test-results', 'coverage']
```

### 2. Parallel Execution
```yaml
concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: ${{ github.ref != 'refs/heads/main' }}

jobs:
  # Run different test types in parallel
  unit-tests:
    strategy:
      matrix:
        chunk: [1, 2, 3, 4]  # Split tests into chunks
  
  integration-tests:
    runs-on: ubuntu-latest  # Run once, faster
  
  e2e-tests:
    if: matrix.os == 'ubuntu-latest' && matrix.node == '20'  # Run on primary platform only
```

### 3. Resource Allocation
```yaml
resource-optimization:
  small-runners:
    condition: github.ref != 'refs/heads/main'
    runner: ubuntu-latest
  
  large-runners:
    condition: github.ref == 'refs/heads/main'
    runner: ubuntu-latest-4-cores
  
  timeout-strategy:
    feature-branch: 15  # 15 minutes max
    main-branch: 30     # 30 minutes max
    release: 45         # 45 minutes max
```

## Known Incompatibilities and Exclusions

### Node.js Version Incompatibilities
```yaml
known-incompatibilities:
  node-16:
    reason: "Deprecated, security vulnerabilities"
    exclude-from: ["main", "develop"]
    only-for: ["releases"]
  
  node-18-windows:
    reason: "Performance issues with certain dependencies"
    exclude-unless: "security-changes"
  
  node-22-macos:
    reason: "Optional dependency compilation issues"
    exclude-unless: "core-changes"
```

### OS-Specific Issues
```yaml
os-exclusions:
  windows:
    skip-for:
      - "docs-only changes"
      - "config-only changes"
    reason: "Windows testing not critical for non-code changes"
  
  macos:
    skip-for:
      - "minor changes"
      - "dependency updates"
    reason: "macOS testing expensive, use for critical changes only"
```

## Monitoring and Metrics

### Matrix Efficiency Metrics
```javascript
// Track matrix effectiveness
const matrixMetrics = {
  totalJobs: 'Number of jobs spawned',
  avgDuration: 'Average job duration',
  successRate: 'Percentage of successful jobs',
  resourceUsage: 'GitHub Actions minutes consumed',
  cacheHitRate: 'Percentage of cache hits',
  falsePositives: 'Issues caught in extended matrix but not minimal'
};
```

### Cost Optimization Tracking
```yaml
cost-tracking:
  baseline:
    feature-branch: 5    # minutes
    develop-branch: 25   # minutes  
    main-branch: 45      # minutes
    release: 90          # minutes
  
  targets:
    feature-branch: 3    # 40% reduction
    develop-branch: 20   # 20% reduction
    main-branch: 40      # 11% reduction
    release: 75          # 17% reduction
```

## Advanced Features

### 1. Adaptive Matrix Learning
```javascript
// Machine learning approach to optimize matrix over time
class AdaptiveMatrix {
  constructor() {
    this.failurePatterns = new Map();
    this.successPatterns = new Map();
  }
  
  learnFromRun(matrix, files, success, duration) {
    const pattern = this.extractPattern(matrix, files);
    
    if (success) {
      this.successPatterns.set(pattern, duration);
    } else {
      this.failurePatterns.set(pattern, true);
    }
  }
  
  optimizeMatrix(baseMatrix, files) {
    // Use historical data to optimize matrix
    return this.applyLearnings(baseMatrix, files);
  }
}
```

### 2. Predictive Testing
```yaml
# Predict which tests are most likely to fail
predictive-testing:
  risk-factors:
    file-patterns:
      - 'src/core/**': high-risk
      - 'src/utils/**': medium-risk
      - 'docs/**': low-risk
    
  historical-analysis:
    failure-prone-combinations:
      - os: windows-latest, node: '18'
      - os: macos-latest, node: '22'
    
  priority-testing:
    high-risk: run-first
    medium-risk: run-parallel
    low-risk: run-last
```

### 3. Auto-scaling Matrix
```yaml
# Automatically adjust matrix based on load and results
auto-scaling:
  triggers:
    failure-rate-high:
      condition: failure_rate > 20%
      action: expand-matrix
    
    success-rate-perfect:
      condition: failure_rate == 0% && runs > 10
      action: reduce-matrix
    
    time-pressure:
      condition: pr_age > 2_days
      action: prioritize-critical-tests
```

## Migration Guide

### From Fixed Matrix to Intelligent Matrix

1. **Audit Current Matrix**
   ```bash
   # Analyze current workflow files
   grep -r "matrix:" .github/workflows/
   
   # Calculate current resource usage
   gh api repos/:owner/:repo/actions/runs --per-page 100 | jq '.workflow_runs[] | .run_number, .conclusion, .run_started_at'
   ```

2. **Implement Gradual Migration**
   ```yaml
   # Phase 1: Implement for feature branches only
   strategy:
     matrix:
       include:
         - if: ${{ !contains(github.ref, 'main') }}
           os: ubuntu-latest
           node: '20'
         - if: ${{ contains(github.ref, 'main') }}
           os: [ubuntu-latest, windows-latest, macos-latest]
           node: [18, 20, 22]
   ```

3. **Monitor and Adjust**
   ```bash
   # Track metrics before and after
   echo "Matrix jobs: $(gh api repos/:owner/:repo/actions/runs | jq '.workflow_runs[0].jobs_url' | xargs gh api | jq length)"
   echo "Duration: $(gh api repos/:owner/:repo/actions/runs | jq '.workflow_runs[0] | .run_started_at, .updated_at')"
   ```

## Best Practices

### 1. Matrix Design Principles
- **Start minimal**: Begin with smallest effective matrix
- **Expand strategically**: Add coverage where failures occur
- **Monitor continuously**: Track success rates and resource usage
- **Document decisions**: Record why specific combinations are included/excluded

### 2. Testing Strategy
- **Smoke tests everywhere**: Basic functionality on all matrix combinations
- **Integration tests selectively**: Full integration on primary platforms
- **E2E tests minimally**: End-to-end on single, representative configuration

### 3. Resource Management  
- **Use caching aggressively**: Cache dependencies, builds, and test results
- **Parallelize wisely**: Balance speed with resource constraints
- **Timeout appropriately**: Set realistic timeouts for different test types

### 4. Failure Handling
- **Fail-fast for critical**: Stop immediately on security/core failures  
- **Continue on optional**: Allow documentation/minor failures
- **Retry intelligently**: Retry flaky tests, not systematic failures

## Conclusion

This intelligent matrix strategy provides a balanced approach to CI/CD testing that:
- **Optimizes resources** by using minimal matrices for development
- **Ensures quality** by expanding coverage for production releases
- **Adapts dynamically** based on actual code changes
- **Learns over time** from historical failure patterns

The strategy should be reviewed quarterly and adjusted based on:
- Team development patterns
- Infrastructure costs
- Quality metrics
- New platform/version requirements

For questions or improvements to this strategy, please open an issue or submit a pull request.