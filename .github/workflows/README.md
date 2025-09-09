# GitHub Actions CI/CD Workflows

This directory contains GitHub Actions workflows for comprehensive CI/CD pipeline with local testing support using [act](https://github.com/nektos/act).

## Available Workflows

### 1. Continuous Integration (`act-ci.yml`)
**Purpose:** Core testing and validation
- ✅ Test Suite across Node.js versions (18, 20, 22)
- ✅ Cross-platform testing (Ubuntu, Windows, macOS)
- ✅ Integration tests
- ✅ Code quality checks
- ✅ CLI functionality validation

**Local testing:**
```bash
npm run act:ci
# or
./scripts/test-workflows.sh ci
```

### 2. Security Scanning (`act-security.yml`)
**Purpose:** Security vulnerability detection
- 🔒 NPM security audit
- 🔒 Dependency security checks
- 🔒 Secret pattern scanning
- 🔒 CodeQL analysis
- 🔒 License compliance

**Local testing:**
```bash
npm run act:security
# or
./scripts/test-workflows.sh security
```

### 3. Performance Benchmarks (`act-performance.yml`)
**Purpose:** Performance monitoring and optimization
- ⚡ CLI startup time benchmarking
- ⚡ Template rendering performance
- ⚡ Memory usage profiling
- ⚡ Large-scale operation testing

**Local testing:**
```bash
npm run act:performance
# or
./scripts/test-workflows.sh performance
```

### 4. Build Validation (`act-build-validation.yml`)
**Purpose:** Build integrity and cross-platform compatibility
- 🏗️ Build validation across platforms
- 🏗️ Dependency validation
- 🏗️ Fresh install testing
- 🏗️ Package structure verification
- 🏗️ Executable permissions

**Local testing:**
```bash
npm run act:build
# or
./scripts/test-workflows.sh build
```

## Local Testing Setup

### Prerequisites
1. **Install act:**
   ```bash
   # macOS
   brew install act
   
   # Linux
   curl https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash
   
   # Windows
   choco install act-cli
   ```

2. **Install Docker:**
   - [Docker Desktop](https://docs.docker.com/get-docker/)

### Quick Start
```bash
# Run quick validation tests
npm run act:test

# Test specific workflow
npm run act:ci        # CI tests
npm run act:security  # Security scans
npm run act:build     # Build validation

# Clean up containers
npm run act:clean
```

### Workflow Script Usage
```bash
# List available workflows and jobs
./scripts/test-workflows.sh list

# Run quick tests
./scripts/test-workflows.sh quick

# Run specific workflow
./scripts/test-workflows.sh ci
./scripts/test-workflows.sh security secret-scan
./scripts/test-workflows.sh performance cli-performance

# Clean up
./scripts/test-workflows.sh clean
```

## Configuration Files

### `.actrc`
Configuration for act with:
- Platform mappings for cross-platform simulation
- Default environment variables
- Container reuse for speed
- Artifact handling

### `scripts/test-workflows.sh`
Convenient script for:
- ✅ Testing workflows locally
- ✅ Running specific jobs
- ✅ Quick validation
- ✅ Container management

## Workflow Features

### Act-Compatible Design
- ✅ No GitHub-specific services that don't work in act
- ✅ Platform simulation for Windows/macOS on Linux containers
- ✅ Proper error handling and fallbacks
- ✅ Container reuse for performance

### Comprehensive Testing
- ✅ Node.js 18, 20, 22 compatibility
- ✅ Cross-platform build validation
- ✅ Security vulnerability scanning
- ✅ Performance benchmarking
- ✅ CLI functionality testing

### Production Ready
- ✅ Artifact uploads
- ✅ Matrix builds
- ✅ Conditional execution
- ✅ Proper error handling
- ✅ Resource cleanup

## Integration with Development

### Pre-commit hooks
```bash
# Quick validation before commit
npm run act:test
```

### Pre-push validation
```bash
# Full CI validation
npm run act:ci
```

### Release preparation
```bash
# Build validation
npm run act:build

# Security check
npm run act:security
```

## Troubleshooting

### Common Issues
1. **Docker not running**: Start Docker Desktop
2. **Permission issues**: Run `sudo act` on Linux
3. **Container issues**: Run `npm run act:clean`
4. **Network issues**: Check Docker network settings

### Performance Tips
1. **Use container reuse**: Enabled by default in `.actrc`
2. **Clean periodically**: Run `npm run act:clean`
3. **Use specific jobs**: Test only what you need

## Environment Variables

The workflows support these environment variables:
- `NODE_VERSION`: Node.js version to use (default: 20)
- `ACT_EVENT`: Event type for testing (default: push)
- `ACT_VERBOSE`: Enable verbose output

## GitHub vs Local Differences

### Limitations in Act
- CodeQL analysis may not work perfectly
- Some GitHub-specific actions have limitations
- Windows/macOS jobs run on Linux containers
- Performance benchmarks may differ

### Act Advantages
- Fast feedback loop
- No CI minutes consumption
- Debug workflows locally
- Test matrix builds quickly

## Best Practices

1. **Test locally first**: Always run `npm run act:test` before pushing
2. **Use specific jobs**: Test only what changed
3. **Clean regularly**: Prevent container bloat
4. **Monitor performance**: Use benchmark workflows
5. **Security first**: Run security scans regularly

## Support

- **Act documentation**: https://github.com/nektos/act
- **Workflow issues**: Check the individual workflow files
- **Local testing script**: `./scripts/test-workflows.sh --help`

---

These workflows ensure robust CI/CD with the ability to test everything locally before pushing to GitHub, significantly improving development velocity and reducing CI failures.