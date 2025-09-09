# Multi-Layer Cache Dependencies Action

Enterprise-grade multi-layer caching for CI/CD workflows with 85%+ hit rate optimization.

## 🚀 Features

- **5 Cache Layers**: NPM global, node_modules, build artifacts, tools, and custom paths
- **Smart Fallback**: Progressive cache key fallback for maximum hit rate
- **Cross-Platform**: Works on Linux, macOS, and Windows
- **Multi Package Manager**: npm, pnpm, yarn support
- **Performance Monitoring**: Built-in cache analytics and optimization recommendations
- **Enterprise Grade**: Designed for Fortune 5 standards with comprehensive reporting

## 📊 Cache Layers

### Layer 1: NPM Global Cache
- `~/.npm`, `~/.cache/npm`, `~/.local/share/npm`
- Package manager global cache directories
- Highest priority for dependency resolution

### Layer 2: Node Modules Cache  
- `node_modules`, `*/node_modules`
- `.pnpm-store`, `~/.yarn/cache`
- Installed packages and dependencies

### Layer 3: Build Artifacts Cache
- `dist`, `build`, `.output`, `.cache`, `coverage`
- Compiled code and generated assets
- ESLint cache, TypeScript build info

### Layer 4: Tools Cache
- `~/.cache`, `~/Library/Caches`
- Puppeteer, Playwright browsers
- Development tools cache

### Layer 5: Additional Paths
- User-defined custom cache paths
- Project-specific cache directories

## 🔧 Basic Usage

```yaml
- name: Setup Multi-Layer Cache
  uses: ./.github/actions/cache-dependencies
  with:
    package-manager: 'npm'
    node-version: '20'
    cache-strategy: 'balanced'
```

## ⚙️ Configuration Options

### Cache Strategy

| Strategy | Description | Hit Rate Target | Use Case |
|----------|-------------|-----------------|----------|
| `aggressive` | Maximum caching, longest fallback chains | 90%+ | Stable dependencies |
| `balanced` | Optimal balance of hit rate and freshness | 85%+ | Most projects |
| `conservative` | Shorter cache lifetime, fewer fallbacks | 70%+ | Frequently changing deps |

### Package Manager Support

```yaml
- uses: ./.github/actions/cache-dependencies
  with:
    package-manager: 'npm'     # npm, pnpm, yarn
    node-version: '20'         # Node.js version
```

### Cache Layers Control

```yaml
- uses: ./.github/actions/cache-dependencies
  with:
    enable-npm-cache: 'true'           # NPM global cache
    enable-node-modules-cache: 'true'  # node_modules cache
    enable-build-cache: 'true'         # Build artifacts cache
    enable-tool-cache: 'true'          # Tools and binaries cache
```

### Build Artifacts

```yaml
- uses: ./.github/actions/cache-dependencies
  with:
    build-artifacts: |
      dist
      build
      .output
      coverage
      .unjucks-cache
      custom-build-dir
```

### Advanced Options

```yaml
- uses: ./.github/actions/cache-dependencies
  with:
    cache-key-prefix: 'my-project'       # Custom cache prefix
    enable-cleanup: 'true'               # Auto cleanup old caches
    max-cache-age-days: '7'              # Cache retention period
    cache-compression: 'true'            # Enable compression
    parallel-cache-ops: 'true'           # Parallel operations
    additional-cache-paths: |            # Extra paths to cache
      .custom-cache
      vendor/
      tmp/build-cache
```

## 📈 Performance Monitoring

The action provides comprehensive cache analytics:

### Outputs

```yaml
- name: Setup Cache
  id: cache
  uses: ./.github/actions/cache-dependencies

- name: Check Cache Performance
  run: |
    echo "NPM Cache Hit: ${{ steps.cache.outputs.npm-cache-hit }}"
    echo "Node Modules Hit: ${{ steps.cache.outputs.node-modules-cache-hit }}"
    echo "Build Cache Hit: ${{ steps.cache.outputs.build-cache-hit }}"
    echo "Hit Rate: ${{ steps.cache.outputs.cache-hit-rate }}%"
    echo "Cache Size: ${{ steps.cache.outputs.total-cache-size }}MB"
    echo "Restore Time: ${{ steps.cache.outputs.cache-restore-time }}s"
```

### Performance Benchmarks

| Metric | Excellent | Good | Needs Improvement |
|--------|-----------|------|-------------------|
| Hit Rate | ≥85% | 70-84% | <70% |
| Restore Time | ≤30s | 31-60s | >60s |
| Cache Size | <500MB | 500MB-1GB | >1GB |

## 🏢 Enterprise Usage Examples

### Basic CI Pipeline

```yaml
name: CI Pipeline
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          
      - name: Multi-Layer Cache
        uses: ./.github/actions/cache-dependencies
        with:
          package-manager: 'npm'
          cache-strategy: 'balanced'
          
      - run: npm ci
      - run: npm test
```

### Multi-Platform Matrix

```yaml
strategy:
  matrix:
    os: [ubuntu-latest, windows-latest, macos-latest]
    node: ['18', '20', '22']

steps:
  - uses: actions/checkout@v4
  
  - name: Setup Node.js ${{ matrix.node }}
    uses: actions/setup-node@v4
    with:
      node-version: ${{ matrix.node }}
      
  - name: Platform-Optimized Cache
    uses: ./.github/actions/cache-dependencies
    with:
      package-manager: 'npm'
      node-version: ${{ matrix.node }}
      cache-strategy: 'balanced'
      cache-key-prefix: 'ci-matrix'
```

### Performance-Critical Builds

```yaml
- name: High-Performance Cache
  uses: ./.github/actions/cache-dependencies
  with:
    cache-strategy: 'aggressive'
    cache-compression: 'true'
    parallel-cache-ops: 'true'
    build-artifacts: |
      dist
      build
      .next
      .nuxt
      coverage
      .storybook-static
```

### Custom Enterprise Setup

```yaml
- name: Enterprise Cache Setup
  uses: ./.github/actions/cache-dependencies
  with:
    package-manager: 'pnpm'
    cache-strategy: 'balanced'
    cache-key-prefix: 'enterprise-proj'
    enable-cleanup: 'true'
    max-cache-age-days: '14'
    additional-cache-paths: |
      .gradle/caches
      .m2/repository
      vendor/
      .custom-build-cache
```

## 🎯 Optimization Tips

### Achieve 85%+ Hit Rate

1. **Use Consistent Keys**: Keep dependencies and Node.js versions stable
2. **Strategic Fallbacks**: The action provides 6 levels of fallback keys
3. **Branch-Specific Caching**: Different cache strategies per branch
4. **Monitor Performance**: Use output metrics to track improvements

### Reduce Cache Size

1. **Enable Compression**: `cache-compression: 'true'`
2. **Selective Caching**: Disable unused cache layers
3. **Regular Cleanup**: `enable-cleanup: 'true'`
4. **Custom Paths**: Only cache necessary directories

### Improve Restore Time

1. **Parallel Operations**: `parallel-cache-ops: 'true'`
2. **Smaller Caches**: Reduce cached path scope
3. **Strategic Placement**: Place cache step after checkout, before setup

## 🔍 Troubleshooting

### Low Hit Rate (<70%)

```yaml
# Try aggressive strategy
- uses: ./.github/actions/cache-dependencies
  with:
    cache-strategy: 'aggressive'
    
# Check dependency stability
- name: Debug Dependencies
  run: |
    echo "Lock file hash: ${{ hashFiles('**/package-lock.json') }}"
    ls -la package*.json
```

### Slow Cache Restoration

```yaml
# Enable optimizations
- uses: ./.github/actions/cache-dependencies
  with:
    parallel-cache-ops: 'true'
    cache-compression: 'true'
    
# Reduce cache scope
- uses: ./.github/actions/cache-dependencies
  with:
    enable-tool-cache: 'false'  # Disable heavy tool cache
```

### Cache Size Issues

```yaml
# Enable cleanup and compression
- uses: ./.github/actions/cache-dependencies
  with:
    enable-cleanup: 'true'
    max-cache-age-days: '3'
    cache-compression: 'true'
```

## 📋 Cache Key Strategy

### Primary Key Pattern
```
{prefix}-{strategy}-{os}-{arch}-node{version}-{package-manager}-{dependency-hash}-{source-hash}
```

### Fallback Chain
1. `{prefix}-{strategy}-{os}-{arch}-node{version}-{package-manager}-{dependency-hash}`
2. `{prefix}-{strategy}-{os}-node{version}-{package-manager}-{weekly-key}`
3. `{prefix}-{strategy}-{os}-node{version}-{package-manager}`
4. `{prefix}-{strategy}-{os}-{arch}`
5. `{prefix}-{strategy}`

This strategy ensures maximum cache hit rate while maintaining cache freshness.

## 🏆 Best Practices

1. **Place Early**: Use cache action immediately after checkout
2. **Monitor Metrics**: Track hit rates and optimize based on outputs
3. **Branch Strategy**: Different cache strategies for different branches
4. **Regular Review**: Monitor cache performance weekly
5. **Team Alignment**: Ensure consistent Node.js and dependency versions

## 🤝 Contributing

This action is part of the Unjucks project. For issues or improvements:

1. Check existing issues
2. Test changes across multiple scenarios
3. Update documentation
4. Verify enterprise compatibility

## 📜 License

MIT License - see LICENSE file for details.