# Unjucks Deployment Strategy: npm & Homebrew Distribution

## Executive Summary

Based on analysis of the current Unjucks codebase, this document outlines a comprehensive deployment strategy for seamless npm and Homebrew distribution. The goal is to achieve the **80/20 rule** - identifying the critical 20% of requirements that deliver 80% of installation success.

## Current State Analysis

### ✅ Strengths
- **Modern ESM setup** with dual CJS/ESM exports (`type: "module"`)
- **TypeScript build system** already configured with `tsc`
- **CLI entry point** properly structured with `citty` framework
- **Clean dependency tree** with only 9 production dependencies
- **Comprehensive test suite** with multiple testing frameworks

### ⚠️ Critical Issues Identified

1. **Missing binary file**: `package.json` references `./bin/unjucks.cjs` but file doesn't exist
2. **Build process failing**: TypeScript compilation has 1000+ errors blocking distribution
3. **Large dist size**: 10MB output includes test files, examples, and unnecessary assets
4. **No CI/CD pipeline**: No automated testing or publishing workflow
5. **No cleanroom testing**: No validation in fresh environments

## 🎯 80/20 Critical Requirements

### Phase 1: Core Distribution (80% Impact)

#### 1. Fix Binary Entry Point (CRITICAL)
**Current Issue**: `./bin/unjucks.cjs` missing
```json
// package.json (current)
"bin": {
  "unjucks": "./bin/unjucks.cjs"
}
```

**Solution**: Create proper binary wrapper
```bash
mkdir -p bin
# Create bin/unjucks.cjs with proper shebang and Node.js execution
```

#### 2. Clean Build Output (CRITICAL)
**Current Issue**: 1000+ TypeScript errors, 10MB dist size
```bash
# Current broken build
npm run build  # Fails with type errors
```

**Solution**: 
- Fix TypeScript configuration exclusions
- Separate library vs CLI builds
- Bundle size optimization (target <2MB)

#### 3. Production-Ready Dependencies (CRITICAL)
**Current Dependencies** (9 production deps):
- `@types/node` (should be devDep)
- `axios`, `chokidar`, `citty`, `glob`, `gray-matter`, `n3`, `nunjucks`, `yaml`

**Optimization**:
- Move `@types/node` to devDependencies
- Consider bundling smaller dependencies
- Add `engines` field for Node.js version requirements

#### 4. Essential npm Configuration (CRITICAL)
```json
{
  "name": "unjucks",
  "version": "1.0.0",
  "bin": {
    "unjucks": "./bin/unjucks.cjs"
  },
  "files": [
    "dist/src",
    "bin",
    "README.md",
    "LICENSE"
  ],
  "engines": {
    "node": ">=18.0.0"
  },
  "preferGlobal": true,
  "keywords": [
    "template", "generator", "nunjucks", "hygen", "scaffolding", 
    "rdf", "turtle", "semantic-web", "cli"
  ]
}
```

### Phase 2: Automated Distribution (20% for 80% Reliability)

#### 5. GitHub Actions CI/CD Pipeline
**Required Workflows**:

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
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
      - run: npm ci
      - run: npm run build
      - run: npm test
      - run: npm run test:integration

  publish:
    needs: test
    runs-on: ubuntu-latest
    if: startsWith(github.ref, 'refs/tags/')
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          registry-url: 'https://registry.npmjs.org'
      - run: npm ci
      - run: npm run build
      - run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

#### 6. Cleanroom Testing Strategy
**Multi-Environment Validation**:

```bash
# Test matrix
OS: [ubuntu-latest, windows-latest, macos-latest]
Node: [18, 20, 22]
Package Manager: [npm, pnpm, yarn]

# Test scenarios
1. Global install: npm install -g unjucks
2. Fresh environment: docker run --rm -it node:20-alpine
3. CLI functionality: unjucks --version, unjucks list, unjucks generate
4. Template generation: unjucks component react TestComponent
5. Cross-platform paths: Windows vs Unix path handling
```

## 🍺 Homebrew Formula Strategy

### Requirements Analysis
Based on Homebrew documentation for Node.js CLI tools:

```ruby
# Formula structure
class Unjucks < Formula
  desc "Nunjucks + Hygen style scaffolding with RDF/Turtle support"
  homepage "https://github.com/username/unjucks"
  url "https://registry.npmjs.org/unjucks/-/unjucks-1.0.0.tgz"
  sha256 "CALCULATED_HASH"
  license "MIT"

  depends_on "node"

  def install
    system "npm", "install", *std_npm_args
    bin.install_symlink Dir["#{libexec}/bin/*"]
  end

  test do
    system "#{bin}/unjucks", "--version"
    system "#{bin}/unjucks", "list"
  end
end
```

### Homebrew Distribution Path
1. **Publish to npm first** (required for formula URL)
2. **Create Homebrew tap**: `homebrew-unjucks` repository
3. **Submit to homebrew-core** (after community adoption)

## 🏗️ Build Optimization Strategy

### Current Issues
- **10MB dist size** (excessive for CLI tool)
- **All files included** (tests, examples, documentation)
- **No tree shaking** for dependencies

### Optimization Plan

#### 1. Selective File Inclusion
```json
{
  "files": [
    "dist/src",
    "bin",
    "README.md", 
    "LICENSE"
  ]
}
```

#### 2. Build Configuration Enhancement
```typescript
// Enhanced build.config.mjs
export default defineBuildConfig({
  entries: ["./src/cli.ts"],  // CLI-focused build
  rollup: {
    esbuild: {
      minify: true,
      target: 'node18',
      treeShaking: true
    }
  },
  externals: [
    // Keep heavy deps external
    'nunjucks',
    'n3', 
    'chokidar'
  ],
  outDir: "dist",
  clean: true,
  sourcemap: false  // Reduce size
});
```

#### 3. Bundle Analysis
```bash
# Add bundle analysis
npm install --save-dev webpack-bundle-analyzer
npm run build:analyze
```

**Target Metrics**:
- **Bundle size**: <2MB (from 10MB)
- **Install time**: <30 seconds
- **Cold start**: <1 second

## 🧪 Cleanroom Testing Implementation

### Docker-Based Testing
```dockerfile
# Test container
FROM node:20-alpine
RUN npm install -g unjucks@latest
WORKDIR /test
COPY test-scenarios/ ./
RUN chmod +x test-all.sh
CMD ["./test-all.sh"]
```

### Test Scenarios
```bash
#!/bin/bash
# test-all.sh
set -e

echo "🧪 Cleanroom Testing Unjucks"

# Basic CLI
unjucks --version
unjucks --help

# List generators
unjucks list

# Generate component
mkdir -p test-project
cd test-project
unjucks component react TestComponent --dry-run

# Validate output
[ -f "expected-output.tsx" ] && echo "✅ Generation test passed"

# Performance test
time unjucks component react PerfTest --dry-run

echo "✅ All cleanroom tests passed"
```

### Cross-Platform Testing Matrix
```yaml
# GitHub Actions matrix
strategy:
  matrix:
    os: [ubuntu-latest, windows-latest, macos-latest]
    node: [18, 20, 22]
    pm: [npm, pnpm, yarn]
```

## 📈 Installation Experience Improvements

### 1. Installation Speed
**Current**: Unknown (build broken)
**Target**: <30 seconds global install

**Optimizations**:
- Reduce dependency count
- Pre-compiled binaries
- Package splitting (core vs extensions)

### 2. Cross-Platform Compatibility
**Windows Considerations**:
- Path separators (`\` vs `/`)
- File permissions
- Binary execution

**macOS/Linux**:
- File permissions (`chmod +x`)
- Symlink handling

### 3. Error Handling & Diagnostics
```typescript
// Enhanced error messages
if (!nodeVersion.satisfies('>=18.0.0')) {
  console.error(`
❌ Node.js >=18.0.0 required (current: ${process.version})
📦 Please upgrade: https://nodejs.org/
  `);
  process.exit(1);
}
```

## 🚀 Deployment Roadmap

### Week 1: Foundation (Must-Have)
- [ ] Fix binary entry point (`bin/unjucks.cjs`)
- [ ] Resolve TypeScript build errors
- [ ] Optimize `package.json` configuration
- [ ] Basic CI/CD pipeline setup

### Week 2: Testing & Validation (Critical)
- [ ] Implement cleanroom testing
- [ ] Cross-platform validation
- [ ] Performance benchmarking
- [ ] Bundle size optimization

### Week 3: Distribution (Launch-Ready)
- [ ] npm registry publishing
- [ ] Homebrew formula creation  
- [ ] Documentation updates
- [ ] Community testing

### Week 4: Monitoring & Iteration (Post-Launch)
- [ ] Installation analytics
- [ ] User feedback collection
- [ ] Performance monitoring
- [ ] Bug fixes and improvements

## 📊 Success Metrics

### Installation Success Rate
- **Target**: >95% successful installs
- **Measurement**: CI testing across platforms
- **Monitoring**: npm download analytics

### Performance Benchmarks
- **Bundle size**: <2MB (current: 10MB)
- **Install time**: <30s (target)
- **Cold start**: <1s CLI execution
- **Memory usage**: <50MB during generation

### User Experience
- **Time to first success**: <5 minutes from install
- **Error rate**: <5% of CLI invocations
- **Cross-platform parity**: 100% feature compatibility

## 🔧 Implementation Priorities

### CRITICAL (Must Fix Before Any Distribution)
1. **Binary entry point creation**
2. **TypeScript build resolution** 
3. **Package.json optimization**
4. **Basic CI/CD pipeline**

### HIGH (Required for Professional Distribution)
1. **Cleanroom testing implementation**
2. **Cross-platform validation**
3. **Bundle size optimization**
4. **Error handling enhancement**

### MEDIUM (Important for Adoption)
1. **Homebrew formula**
2. **Performance optimization**
3. **Documentation updates**
4. **Community engagement**

### LOW (Nice-to-Have)
1. **Advanced analytics**
2. **Plugin ecosystem**
3. **Enterprise features**
4. **Alternative package managers**

## 📝 Next Steps

1. **Fix the build system** - Address TypeScript compilation errors
2. **Create binary wrapper** - Implement proper `bin/unjucks.cjs`
3. **Set up CI/CD pipeline** - Automate testing and publishing
4. **Implement cleanroom testing** - Validate cross-platform installation
5. **Optimize bundle size** - Reduce from 10MB to <2MB
6. **Create Homebrew formula** - Enable `brew install unjucks`
7. **Monitor and iterate** - Track metrics and improve based on feedback

The success of Unjucks distribution depends on executing these priorities in order, with particular focus on the **CRITICAL** items that currently block any distribution attempts.