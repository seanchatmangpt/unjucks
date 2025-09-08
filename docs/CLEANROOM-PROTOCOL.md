# Cleanroom Testing Protocol for Unjucks

## Overview

The Cleanroom Testing Protocol provides a comprehensive, isolated testing environment for validating the Unjucks package functionality, installation process, and runtime behavior. This protocol ensures that the package works correctly in clean environments, simulating real-world installation scenarios.

## Table of Contents

1. [Architecture](#architecture)
2. [Components](#components)
3. [Testing Phases](#testing-phases)
4. [Usage Guide](#usage-guide)
5. [Configuration](#configuration)
6. [Reporting](#reporting)
7. [CI/CD Integration](#cicd-integration)
8. [Troubleshooting](#troubleshooting)

## Architecture

The cleanroom testing system consists of multiple layers:

```
┌─────────────────────────────────────────────────────────┐
│                Test Orchestration                       │
│  ┌─────────────────┐  ┌─────────────────────────────┐  │
│  │ Automated       │  │ Manual Testing              │  │
│  │ Cleanroom       │  │ Scripts                     │  │
│  │ Scripts         │  │                             │  │
│  └─────────────────┘  └─────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────┐
│                Validation Layer                         │
│  ┌─────────────────┐  ┌─────────────────────────────┐  │
│  │ Feature         │  │ Security & Performance      │  │
│  │ Validation      │  │ Auditing                    │  │
│  │ Checklist       │  │                             │  │
│  └─────────────────┘  └─────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────┐
│                Isolation Layer                          │
│  ┌─────────────────┐  ┌─────────────────────────────┐  │
│  │ Local Verdaccio │  │ Docker Containers           │  │
│  │ Registry        │  │                             │  │
│  └─────────────────┘  └─────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────┐
│                Package Layer                            │
│  ┌─────────────────┐  ┌─────────────────────────────┐  │
│  │ Build System    │  │ Package Distribution        │  │
│  │ & Validation    │  │                             │  │
│  └─────────────────┘  └─────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## Components

### 1. Core Testing Scripts

#### `scripts/cleanroom-test.sh`
The primary cleanroom testing script that:
- Sets up isolated testing environment
- Configures local npm registry (Verdaccio)
- Builds and publishes package
- Creates test project and installs package
- Runs functionality tests
- Generates validation reports

**Key Features:**
- Multi-mode operation (setup-only, test-only, docker, full)
- Comprehensive logging and error handling
- Artifact preservation options
- Cross-platform compatibility

#### `scripts/automated-cleanroom.sh`
Orchestration script for comprehensive testing:
- Manages multiple test configurations
- Coordinates test phases
- Generates consolidated reports
- Supports parallel execution
- CI/CD integration ready

**Test Modes:**
- `minimal`: Quick validation with essential tests
- `standard`: Full cleanroom testing with all validations  
- `docker`: Docker-based isolated environment
- `ci`: CI/CD optimized testing with reporting
- `performance`: Performance-focused testing with benchmarks
- `security`: Security-focused validation and audit

#### `scripts/validation-checklist.js`
Comprehensive feature validation system:
- Package structure validation
- CLI functionality testing
- Template system verification
- RDF/Semantic web feature testing
- Performance benchmarking
- Security auditing
- Cross-platform compatibility checks

### 2. Configuration Files

#### `config/verdaccio.yaml`
Verdaccio npm registry configuration:
- Security settings and authentication
- Package access control
- Uplink configuration to npmjs
- Web interface customization
- Rate limiting and caching

#### `docker/Dockerfile.cleanroom`
Multi-stage Docker container for isolated testing:
- Base environment with Node.js and build tools
- Verdaccio registry setup
- Testing environment configuration
- Complete cleanroom environment

### 3. Validation Framework

The validation system provides:
- **Categorized Testing**: Package, CLI, Templates, RDF, Performance, Security, Integration, Compatibility
- **Retry Logic**: Configurable retry attempts for flaky tests
- **Timeout Management**: Per-test timeout configuration
- **Detailed Reporting**: JSON and HTML reports with metrics
- **Flexible Configuration**: Required vs optional validations

## Testing Phases

### Phase 1: Environment Setup
1. **Pre-flight Checks**
   - Node.js version compatibility (≥18.0.0)
   - npm availability and version
   - Project structure validation
   - Port availability (4873 for Verdaccio)
   - Docker availability (if needed)

2. **Environment Preparation**
   - Create isolated test directories
   - Set up logging infrastructure
   - Clean previous test artifacts
   - Initialize configuration files

### Phase 2: Registry Setup
1. **Verdaccio Configuration**
   - Generate registry configuration
   - Set up authentication (if required)
   - Configure package access policies
   - Start registry service

2. **Registry Validation**
   - Verify registry accessibility
   - Test package upload/download
   - Validate authentication flow

### Phase 3: Package Build and Validation
1. **Build Process**
   - Clean previous builds
   - Install production dependencies
   - Execute build scripts
   - Validate build artifacts

2. **Package Creation**
   - Generate package tarball
   - Validate package contents
   - Check file permissions
   - Verify metadata consistency

### Phase 4: Publication and Installation
1. **Registry Publication**
   - Configure npm to use local registry
   - Publish package to Verdaccio
   - Verify publication success
   - Check package availability

2. **Clean Installation**
   - Create isolated test project
   - Install package from registry
   - Verify installation integrity
   - Check dependency resolution

### Phase 5: Functionality Testing
1. **CLI Testing**
   - Help command functionality
   - Version information display
   - Command execution
   - Error handling validation

2. **Feature Testing**
   - Template system functionality
   - RDF/Semantic web features
   - File operations
   - Configuration loading

3. **Integration Testing**
   - Cross-platform compatibility
   - Path handling validation
   - Import/export functionality
   - Plugin system operation

### Phase 6: Performance and Security
1. **Performance Benchmarks**
   - CLI startup time measurement
   - Memory usage profiling
   - Template rendering performance
   - Large dataset handling

2. **Security Auditing**
   - Vulnerability scanning (npm audit)
   - Hardcoded secret detection
   - Permission validation
   - Attack vector analysis

### Phase 7: Reporting and Cleanup
1. **Report Generation**
   - Consolidated test results
   - Performance metrics
   - Security audit findings
   - HTML dashboard creation

2. **Environment Cleanup**
   - Stop running services
   - Archive test artifacts
   - Clean temporary files
   - Generate final summary

## Usage Guide

### Manual Testing

#### Basic Cleanroom Test
```bash
# Run complete cleanroom test
./scripts/cleanroom-test.sh

# Docker-based testing
./scripts/cleanroom-test.sh docker

# Setup only (for debugging)
./scripts/cleanroom-test.sh setup-only
```

#### Automated Testing
```bash
# Standard comprehensive test
./scripts/automated-cleanroom.sh standard

# Quick validation
./scripts/automated-cleanroom.sh minimal

# Performance-focused testing
VERBOSE=true ./scripts/automated-cleanroom.sh performance

# Security audit
./scripts/automated-cleanroom.sh security
```

#### Validation Only
```bash
# Run validation checklist independently
node scripts/validation-checklist.js
```

### Docker-based Testing

#### Build Cleanroom Container
```bash
# Build the cleanroom testing image
docker build -f docker/Dockerfile.cleanroom -t unjucks-cleanroom .

# Run cleanroom tests in container
docker run --rm -v $(pwd)/reports:/output unjucks-cleanroom

# Interactive testing
docker run -it --rm unjucks-cleanroom /bin/bash
```

#### Container Orchestration
```bash
# Using docker-compose (if configured)
docker-compose -f docker/cleanroom-compose.yml up --build

# Cleanup
docker-compose -f docker/cleanroom-compose.yml down -v
```

### Environment Variables

```bash
# Core configuration
export VERDACCIO_PORT=4873           # Registry port
export PRESERVE_CLEANROOM=true       # Keep test artifacts
export VERBOSE=true                  # Enable verbose logging

# Test execution
export PARALLEL_TESTS=false          # Disable parallel execution
export KEEP_ARTIFACTS=true           # Preserve all artifacts
export GENERATE_REPORTS=true         # Generate HTML reports

# Performance tuning
export TEST_TIMEOUT=30000            # Test timeout in ms
export RETRY_ATTEMPTS=3              # Number of retry attempts
```

## Configuration

### Verdaccio Registry Settings

The registry configuration supports:

```yaml
# Storage and authentication
storage: ./verdaccio-storage
auth:
  htpasswd:
    file: ./htpasswd
    max_users: 1000

# Package access control
packages:
  '@seanchatmangpt/*':
    access: $all
    publish: $all
    unpublish: $all
    proxy: npmjs
  
  '**':
    access: $all
    publish: $authenticated
    unpublish: $authenticated
    proxy: npmjs

# Security and performance
security:
  api:
    legacy: true
  web:
    sign:
      expiresIn: 7d

ratelimit:
  ttl: 60
  max: 1000
```

### Validation Checklist Configuration

```javascript
// Test configuration
const config = {
    timeout: 30000,        // Default test timeout
    retries: 3,            // Retry attempts for flaky tests
    verbose: process.env.VERBOSE === 'true',
    outputDir: 'temp/validation-results'
};

// Validation categories
const categories = {
    PACKAGE: 'Package Structure',
    CLI: 'CLI Functionality', 
    TEMPLATES: 'Template System',
    RDF: 'RDF/Semantic Features',
    PERFORMANCE: 'Performance',
    SECURITY: 'Security',
    INTEGRATION: 'Integration',
    COMPATIBILITY: 'Cross-platform'
};
```

### Docker Configuration

Multi-stage build optimizations:

```dockerfile
# Stage 1: Base environment
FROM node:18-alpine AS base
RUN apk add --no-cache bash curl git build-base python3

# Stage 2: Registry setup  
FROM base AS registry
RUN npm install -g verdaccio@latest
EXPOSE 4873

# Stage 3: Testing environment
FROM base AS testing
COPY package*.json ./
RUN npm ci --only=production

# Stage 4: Complete cleanroom
FROM testing AS cleanroom
RUN npm install -g npm-check-updates clinic 0x
```

## Reporting

### Report Types

#### 1. Validation Report (`validation-report.json/html`)
- Comprehensive test results by category
- Pass/fail status with error details
- Performance metrics and timings
- HTML dashboard with visual indicators

#### 2. Cleanroom Report (`validation-report.json`)
- Test phase execution status
- Environment configuration details
- Package validation results
- Functionality test outcomes

#### 3. Master Report (`cleanroom-master-report.json`)
- Consolidated test execution summary
- Environment and configuration metadata
- Artifact location references
- Test phase completion status

#### 4. Performance Report (`performance-benchmarks.json`)
- CLI startup time measurements
- Memory usage profiling
- Template rendering benchmarks
- Threshold compliance status

#### 5. Security Report (`security-audit.json`)
- npm audit vulnerability findings
- Hardcoded secret scan results
- Permission validation outcomes
- Security recommendation summary

### Report Structure

```json
{
  "timestamp": "2025-01-XX...",
  "environment": {
    "os": "Linux",
    "arch": "x64", 
    "node_version": "v18.19.0",
    "npm_version": "10.2.3"
  },
  "test_phases": {
    "build": true,
    "package": true,
    "publish": true,
    "install": true,
    "functionality_tests": {
      "passed": 8,
      "failed": 0,
      "total": 8,
      "details": [...]
    }
  },
  "validation_checklist": {
    "cli_executable": true,
    "package_json_valid": true,
    "dependencies_resolved": true,
    "templates_accessible": true,
    "import_works": true
  }
}
```

### HTML Dashboard Features

- **Executive Summary**: High-level pass/fail metrics
- **Category Breakdown**: Results organized by validation category
- **Timeline View**: Test execution timeline with duration
- **Artifact Browser**: Links to detailed reports and logs
- **Environment Details**: System and configuration information
- **Interactive Filtering**: Filter results by status or category

## CI/CD Integration

### GitHub Actions Workflow

The cleanroom testing integrates into CI/CD via GitHub Actions:

```yaml
cleanroom-test:
  name: Cleanroom Testing
  runs-on: ubuntu-latest
  strategy:
    matrix:
      test-mode: [minimal, standard]
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: '18'
        cache: 'npm'
    - run: npm ci
    - run: npm install -g verdaccio
    - name: Run cleanroom tests
      run: |
        chmod +x scripts/automated-cleanroom.sh
        KEEP_ARTIFACTS=true scripts/automated-cleanroom.sh ${{ matrix.test-mode }}
    - uses: actions/upload-artifact@v4
      with:
        name: cleanroom-results-${{ matrix.test-mode }}
        path: reports/cleanroom-*/
```

### Integration Points

1. **Pre-deployment Validation**
   - Run cleanroom tests before npm publish
   - Validate package integrity and functionality
   - Generate release artifacts and reports

2. **Pull Request Checks**
   - Execute minimal cleanroom validation
   - Report test results as PR status checks
   - Archive test artifacts for review

3. **Release Pipeline**
   - Comprehensive cleanroom validation
   - Performance regression detection
   - Security vulnerability scanning
   - Multi-platform compatibility verification

4. **Scheduled Monitoring**
   - Regular cleanroom validation execution
   - Dependency update impact assessment
   - Performance trend monitoring
   - Security posture evaluation

### CI Environment Variables

```bash
# Required for CI execution
CI=true
GITHUB_ACTIONS=true
NODE_ENV=test

# Cleanroom-specific configuration
CLEANROOM_MODE=ci
KEEP_ARTIFACTS=true
GENERATE_REPORTS=true
PARALLEL_TESTS=false

# Registry configuration
VERDACCIO_PORT=4873
NPM_REGISTRY=http://localhost:4873/
```

## Troubleshooting

### Common Issues

#### 1. Verdaccio Startup Failures

**Symptoms:**
- "Port 4873 already in use" errors
- Registry accessibility timeouts
- Authentication failures

**Solutions:**
```bash
# Check for running Verdaccio instances
ps aux | grep verdaccio
pkill -f verdaccio

# Use alternative port
export VERDACCIO_PORT=4874

# Verify port availability
netstat -ln | grep :4873
```

#### 2. Package Build Failures

**Symptoms:**
- Missing build artifacts
- Permission denied errors
- Dependency resolution failures

**Solutions:**
```bash
# Clean build environment
npm run clean:build
rm -rf node_modules package-lock.json
npm ci

# Fix permissions
chmod +x bin/unjucks.cjs
chmod +x src/cli/index.js

# Validate package.json
npm run build:validate
```

#### 3. Docker Container Issues

**Symptoms:**
- Container build failures
- Service startup timeouts
- Volume mounting problems

**Solutions:**
```bash
# Rebuild with no cache
docker build --no-cache -f docker/Dockerfile.cleanroom -t unjucks-cleanroom .

# Check container logs
docker logs unjucks-cleanroom

# Interactive debugging
docker run -it --rm unjucks-cleanroom /bin/bash
```

#### 4. Test Execution Failures

**Symptoms:**
- Timeout errors during testing
- Flaky test results
- Environment inconsistencies

**Solutions:**
```bash
# Increase timeouts
export TEST_TIMEOUT=60000
export RETRY_ATTEMPTS=5

# Enable verbose logging
export VERBOSE=true

# Run individual test phases
./scripts/cleanroom-test.sh setup-only
./scripts/cleanroom-test.sh test-only
```

#### 5. CI/CD Integration Issues

**Symptoms:**
- GitHub Actions workflow failures
- Artifact upload problems
- Permission denied in CI

**Solutions:**
```yaml
# Ensure proper permissions
- name: Make scripts executable
  run: |
    chmod +x scripts/cleanroom-test.sh
    chmod +x scripts/automated-cleanroom.sh

# Use absolute paths
- name: Run tests with full path
  run: ${{ github.workspace }}/scripts/automated-cleanroom.sh

# Increase timeout for CI
- name: Run with extended timeout
  timeout-minutes: 30
```

### Debug Mode

Enable comprehensive debugging:

```bash
# Enable all debug features
export DEBUG=true
export VERBOSE=true
export PRESERVE_CLEANROOM=true

# Run with detailed logging
bash -x scripts/automated-cleanroom.sh standard 2>&1 | tee debug.log
```

### Log Analysis

Key log files and their purposes:

```
temp/cleanroom-logs-TIMESTAMP/
├── cleanroom-automated.log      # Main execution log
├── cleanroom-errors.log         # Error-specific logging
├── cleanroom-test.log          # Cleanroom test details
└── verdaccio.log               # Registry operation log

reports/cleanroom-TIMESTAMP/
├── validation-report.json       # Test results data
├── validation-report.html       # HTML dashboard
├── performance-benchmarks.json  # Performance metrics
├── security-audit.json         # Security findings
└── index.html                  # Master dashboard
```

### Performance Optimization

For faster test execution:

```bash
# Minimize test scope
./scripts/automated-cleanroom.sh minimal

# Skip non-critical validations
export SKIP_SECURITY_AUDIT=true
export SKIP_PERFORMANCE_TESTS=true

# Use local registry cache
export VERDACCIO_CACHE=true

# Parallel execution (where supported)
export PARALLEL_TESTS=true
```

## Best Practices

### 1. Test Environment Hygiene
- Always use fresh environments for cleanroom testing
- Avoid running on development machines with existing configurations
- Use Docker containers for maximum isolation
- Regularly clean up test artifacts and logs

### 2. Validation Strategy
- Run minimal tests for quick feedback during development
- Use comprehensive testing before releases
- Implement security-focused testing for sensitive changes
- Schedule regular performance regression testing

### 3. CI/CD Integration
- Include cleanroom tests in pull request workflows
- Use matrix builds for multi-platform validation  
- Archive test reports for historical analysis
- Set up notifications for test failures

### 4. Debugging and Troubleshooting
- Enable verbose logging for investigation
- Preserve test artifacts for post-mortem analysis
- Use incremental testing modes for issue isolation
- Monitor system resources during test execution

### 5. Maintenance and Updates
- Regularly update Verdaccio and testing dependencies
- Keep Docker images current with security patches
- Review and update validation criteria as features evolve
- Document custom configurations and modifications

---

This cleanroom testing protocol ensures comprehensive validation of the Unjucks package in isolated environments, providing confidence in package quality, security, and functionality across diverse deployment scenarios.