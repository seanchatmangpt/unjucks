# 🐳 Docker Testing Environment Guide

## Overview

This guide provides comprehensive documentation for the Unjucks Docker testing environment, designed for clean, reproducible testing across different environments and CI/CD pipelines.

## Architecture

### Multi-Stage Docker Build

The testing environment uses a multi-stage Dockerfile that optimizes for both functionality and size:

1. **Base Stage**: Node.js 20 Alpine with system dependencies
2. **Dependencies Stage**: Clean npm ci installation
3. **Test Environment**: Full testing setup with user permissions
4. **Testing Stage**: Production-ready testing image
5. **Minimal Testing**: Lightweight version for quick validation

### Directory Structure

```
docker/
├── Dockerfile.testing           # Multi-stage build for testing
├── docker-compose.testing.yml   # Orchestration configuration
└── .dockerignore               # Build optimization

scripts/docker/
├── run-docker-tests.sh         # Main testing orchestration script
├── aggregate-test-results.js   # Test results consolidation
├── docker-ci-integration.js    # CI/CD integration generator
└── docker-health-check.js      # Health monitoring

test-results-docker/            # Container test outputs
reports/                        # Generated test reports
coverage/                       # Coverage data
```

## Quick Start

### 1. Build and Run All Tests

```bash
# Build images and run comprehensive tests
./scripts/docker/run-docker-tests.sh all

# Run with cleanup and verbose output
./scripts/docker/run-docker-tests.sh all -c -v
```

### 2. Run Specific Test Types

```bash
# Minimal tests (fastest)
./scripts/docker/run-docker-tests.sh minimal

# Security tests
./scripts/docker/run-docker-tests.sh security

# Performance tests
./scripts/docker/run-docker-tests.sh performance

# Integration tests
./scripts/docker/run-docker-tests.sh integration
```

### 3. Docker Compose Direct Usage

```bash
# Run main test suite
docker-compose -f docker/docker-compose.testing.yml up unjucks-test

# Run minimal tests with specific profile
docker-compose -f docker/docker-compose.testing.yml --profile minimal up unjucks-test-minimal

# Run security tests
docker-compose -f docker/docker-compose.testing.yml --profile security up unjucks-security-test
```

## Test Profiles

### Main Test Profile (`unjucks-test`)
- **Memory**: 1GB
- **CPU**: 2.0
- **Command**: `npm run test:comprehensive`
- **Includes**: All test suites, coverage, reports

### Minimal Test Profile (`unjucks-test-minimal`)
- **Memory**: 512MB
- **CPU**: 1.0
- **Command**: `npm run test:minimal`
- **Includes**: Basic functionality tests only

### Security Test Profile (`unjucks-security-test`)
- **Memory**: 768MB
- **CPU**: 1.5
- **Command**: `npm run test:security`
- **Includes**: Security vulnerability tests

### Performance Test Profile (`unjucks-perf-test`)
- **Memory**: 2GB
- **CPU**: 3.0
- **Command**: `npm run perf:all`
- **Includes**: Performance benchmarks and load tests

### Integration Test Profile (`unjucks-integration-test`)
- **Memory**: 1.5GB
- **CPU**: 2.5
- **Command**: `npm run test:integration`
- **Includes**: Integration tests with mock dependencies

## Script Options

### `run-docker-tests.sh` Options

```bash
Usage: ./scripts/docker/run-docker-tests.sh [OPTIONS] [TEST_TYPE]

TEST_TYPES:
  all         Run all tests (default)
  minimal     Run minimal tests only
  security    Run security tests
  performance Run performance tests
  integration Run integration tests
  unit        Run unit tests only
  build-only  Build images only

OPTIONS:
  -h, --help          Show help message
  -c, --clean         Clean up before running tests
  -v, --verbose       Verbose output
  -f, --force         Force rebuild images
  -p, --parallel      Run tests in parallel
  -r, --report        Generate test report only
  -w, --watch         Watch mode for development
  --dry-run          Show what would be executed
  --no-cache         Build without cache
  --mem-limit        Set memory limit (default: 1g)
  --cpu-limit        Set CPU limit (default: 2.0)
```

### Examples

```bash
# Development workflow
./scripts/docker/run-docker-tests.sh minimal -w

# CI/CD pipeline
./scripts/docker/run-docker-tests.sh all -c -f --no-cache

# Performance testing
./scripts/docker/run-docker-tests.sh performance --mem-limit 4g --cpu-limit 4.0

# Security audit
./scripts/docker/run-docker-tests.sh security -v

# Parallel execution
./scripts/docker/run-docker-tests.sh all -p
```

## Volume Mapping

### Source Code (Read-Only)
- `./src:/app/src:ro`
- `./tests:/app/tests:ro`
- `./_templates:/app/_templates:ro`
- `./bin:/app/bin:ro`
- `./scripts:/app/scripts:ro`
- `./config:/app/config:ro`

### Test Results (Read-Write)
- `./test-results-docker:/app/test-results`
- `./coverage:/app/coverage`
- `./reports:/app/reports`

### Configuration Files (Read-Only)
- `./package.json:/app/package.json:ro`
- `./vitest.ci.config.js:/app/vitest.ci.config.js:ro`
- `./vitest.minimal.config.js:/app/vitest.minimal.config.js:ro`

## Environment Variables

### Test Configuration
- `NODE_ENV=test`
- `CI=true`
- `UNJUCKS_TEST_MODE=docker`
- `VITEST_POOL_SIZE=1-4`
- `FORCE_COLOR=1`

### Resource Management
- `VITEST_MIN_THREADS=1`
- `VITEST_MAX_THREADS=4`
- `NPM_CONFIG_CACHE=/tmp/.npm`

### Test Timeouts
- `TEST_TIMEOUT=30000`

## Health Monitoring

### Manual Health Check

```bash
# Run comprehensive health check
node scripts/docker/docker-health-check.js
```

### Automated Health Checks

The health check script monitors:
- Docker daemon status
- Container status and health
- Network connectivity
- Volume mount functionality
- Resource usage
- Test execution capability

### Health Check Results

Health checks generate:
- JSON report: `reports/docker-health-report.json`
- Console output with recommendations
- Exit codes: 0 (healthy), 1 (unhealthy), 2 (degraded)

## CI/CD Integration

### Generating CI Configurations

```bash
# Generate all CI/CD configurations
node scripts/docker/docker-ci-integration.js
```

This creates:
- **GitHub Actions**: `.github/workflows/docker-tests.yml`
- **GitLab CI**: `.gitlab-ci.yml`
- **Jenkins**: `Jenkinsfile`
- **CircleCI**: `.circleci/config.yml`

### CI/CD Features

- Matrix testing across Node.js versions
- Parallel test execution
- Artifact collection
- Performance baselines
- Security scanning with Trivy
- Test result commenting on PRs
- Scheduled nightly runs

## Test Results and Reporting

### Test Result Aggregation

```bash
# Manual aggregation
node scripts/docker/aggregate-test-results.js
```

### Generated Reports

1. **JSON Report**: `reports/docker-test-summary.json`
2. **HTML Report**: `reports/docker-test-report.html`
3. **Markdown Report**: `reports/docker-test-report.md`

### Report Contents

- Test execution summary
- Individual test suite results
- Coverage information
- Performance metrics
- Security scan results
- Error analysis and recommendations

## Development Workflow

### Watch Mode for Development

```bash
# Continuous testing during development
./scripts/docker/run-docker-tests.sh minimal -w
```

### Interactive Container Access

```bash
# Access running test container
docker-compose -f docker/docker-compose.testing.yml exec unjucks-test bash

# Run specific commands
docker-compose -f docker/docker-compose.testing.yml exec unjucks-test npm run test:unit
```

### Debugging Failed Tests

```bash
# Verbose output with all logs
./scripts/docker/run-docker-tests.sh all -v

# Keep containers running for inspection
docker-compose -f docker/docker-compose.testing.yml up --no-deps unjucks-test

# Check container logs
docker-compose -f docker/docker-compose.testing.yml logs unjucks-test
```

## Optimization and Performance

### Build Optimization

- Multi-stage builds reduce final image size
- `.dockerignore` excludes unnecessary files
- Layer caching for dependency installation
- Parallel building with `--parallel` flag

### Runtime Optimization

- User-based security (non-root execution)
- Resource limits prevent resource exhaustion
- Health checks ensure container reliability
- Minimal base images (Alpine Linux)

### Resource Monitoring

```bash
# Monitor resource usage
docker stats

# Check container health
docker-compose -f docker/docker-compose.testing.yml ps
```

## Troubleshooting

### Common Issues

1. **Build Failures**
   ```bash
   # Clear cache and rebuild
   ./scripts/docker/run-docker-tests.sh build-only -f --no-cache
   ```

2. **Permission Issues**
   ```bash
   # Check user permissions in container
   docker-compose exec unjucks-test id
   ```

3. **Network Connectivity**
   ```bash
   # Test network
   docker network inspect unjucks-test-network
   ```

4. **Volume Mount Issues**
   ```bash
   # Verify mounts
   docker-compose exec unjucks-test ls -la /app/test-results
   ```

### Cleanup

```bash
# Clean up all containers and volumes
docker-compose -f docker/docker-compose.testing.yml down --volumes --remove-orphans

# Clean up images
docker image prune -f

# Full cleanup
./scripts/docker/run-docker-tests.sh all -c -f
```

## Security Considerations

### Container Security

- Non-root user execution
- Minimal base images
- Regular security scanning
- Isolated network environment
- Read-only volume mounts for source code

### Secrets Management

- No hardcoded secrets in images
- Environment variable injection
- Secure handling of test credentials
- Isolated test environment

## Support and Maintenance

### Regular Maintenance

1. **Update base images**: Rebuild with latest Node.js Alpine
2. **Dependency updates**: Refresh npm dependencies
3. **Security scans**: Run Trivy scans regularly
4. **Performance baselines**: Update performance benchmarks

### Monitoring

- Health check automation
- Resource usage monitoring
- Test execution metrics
- Build time optimization

---

## Claude Flow Integration

This Docker testing environment integrates with Claude Flow coordination system:

- **Pre-task hooks**: Initialize coordination before test execution
- **Post-task hooks**: Register completion and results
- **Memory coordination**: Store test results and metrics
- **Agent orchestration**: Coordinate with other testing agents

```bash
# Manual coordination hooks
npx claude-flow@alpha hooks pre-task --description "Docker test execution"
npx claude-flow@alpha hooks post-task --task-id "docker-test-123"
```

For more information on Claude Flow integration, see the main project documentation.