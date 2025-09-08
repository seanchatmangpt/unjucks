# 🧪 Unjucks Master Test Orchestrator

**The definitive entry point that proves everything works.**

This orchestrator validates complete system readiness for production deployment through comprehensive testing, metrics collection, and production readiness scoring.

## 🎯 Mission

Provide definitive proof that the Unjucks system is:
- ✅ Functionally correct
- 🔒 Secure and safe  
- ⚡ Performant and reliable
- 📦 Production ready

## 🚀 Quick Start

### Local Execution
```bash
# Run complete test orchestration
node run-all-tests.js

# View generated reports
open reports/master-test-report.html
```

### Docker Execution (Clean Environment)
```bash
# Build and run in clean Docker environment
docker-compose up unjucks-test

# Run all test profiles
docker-compose --profile main --profile parallel --profile benchmark up
```

## 📊 What Gets Tested

### Core Test Suites
1. **Smoke Tests** (Critical) - Basic CLI functionality
2. **Unit Tests** (Critical) - Core filters and utilities  
3. **Filter Tests** (Critical) - Template filter validation
4. **CLI Comprehensive** (Critical) - Complete CLI testing
5. **Integration Tests** - Cross-component validation
6. **Chaos Tests** - Error handling and resilience
7. **Stress Tests** - Performance and load testing
8. **Security Tests** (Critical) - Vulnerability scanning

### Metrics Collected
- **Test Coverage**: Success rates across all suites
- **Performance**: Execution times and memory usage
- **Security**: Vulnerability scans and safety checks
- **Reliability**: Error handling and recovery
- **Production Readiness**: Comprehensive scoring (0-100%)

## 📈 Scoring System

### Production Readiness Calculation
- **Weighted Scores**: Each test suite contributes based on importance
- **Critical Gates**: Must pass all critical suites (85%+ each)
- **Overall Threshold**: 85% total score for production ready
- **Penalty System**: Critical failures reduce score significantly

### Grading Scale
- **A+ (97-100%)**: Exceptional - Deploy with confidence
- **A (93-96%)**: Excellent - Minor optimizations possible  
- **B+ (87-92%)**: Good - Ready for production
- **B (83-86%)**: Acceptable - Monitor closely
- **C (70-82%)**: Needs improvement before production
- **D/F (<70%)**: Not ready for production

## 📋 Generated Reports

### Main Reports
- `master-test-report.html` - Interactive dashboard
- `master-test-report.json` - Detailed data for CI/CD
- `MASTER-TEST-REPORT.md` - Executive summary

### Test Artifacts
- Individual test suite reports
- Performance benchmarks
- Security scan results
- Code coverage reports
- Error logs and diagnostics

## 🐳 Docker Environment

### Clean Test Environment Features
- **Isolated**: No external dependencies
- **Reproducible**: Same results every time
- **Secure**: Non-root execution
- **Complete**: All test suites included

### Service Profiles

#### Main Profile
```bash
docker-compose --profile main up
```
Runs complete test orchestration suite

#### Parallel Profile  
```bash
docker-compose --profile parallel up
```
Executes tests in parallel for faster results

#### Benchmark Profile
```bash
docker-compose --profile benchmark up
```
Focuses on performance and stress testing

#### Security Profile
```bash
docker-compose --profile security up  
```
Runs security validation and vulnerability scans

## 🛠️ Configuration

### Environment Variables
- `NODE_ENV=test` - Test mode
- `CI=true` - Continuous integration mode
- `PARALLEL_EXECUTION=true` - Enable parallel testing
- `BENCHMARK_MODE=true` - Performance testing focus
- `SECURITY_MODE=true` - Security validation focus

### Custom Test Suites
Add new test suites by modifying the `testSuites` array in `run-all-tests.js`:

```javascript
{
  name: 'my-custom-suite',
  description: 'Custom test validation',
  path: '../my-tests/',
  pattern: '*.test.js',
  weight: 0.10,
  critical: false
}
```

## 📊 Integration with CI/CD

### GitHub Actions Example
```yaml
name: Master Test Validation
on: [push, pull_request]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: cd tests/docker-validation && docker-compose up unjucks-test
      - uses: actions/upload-artifact@v3
        with:
          name: test-reports
          path: tests/docker-validation/reports/
```

### Exit Codes
- `0`: Production ready (>= 85% score, no critical failures)
- `1`: Not production ready (needs fixes)
- `2`: Orchestration failure (system error)

## 🔧 Troubleshooting

### Common Issues

**Tests Timeout**
- Increase timeout in `execAsync` calls
- Check Docker resources allocation

**Permission Denied**  
- Verify file permissions: `chmod +x run-all-tests.js`
- Check Docker user permissions

**Missing Dependencies**
- Run `npm install` in project root
- Verify package.json dependencies

**Docker Build Fails**
- Check Docker daemon is running
- Verify Dockerfile paths are correct

### Debug Mode
```bash
DEBUG=1 node run-all-tests.js
```

## 📚 Technical Details

### Architecture
- **Modular**: Each test suite runs independently
- **Fault Tolerant**: Non-critical failures don't stop execution
- **Comprehensive**: Covers functionality, security, performance
- **Extensible**: Easy to add new test suites

### Dependencies
- Node.js 18+ 
- Docker (for containerized execution)
- File system access for reports
- Network access for some integration tests

### Performance
- **Parallel Execution**: Test suites can run concurrently
- **Resource Monitoring**: Memory and CPU usage tracked
- **Timeout Protection**: Prevents hanging tests
- **Artifact Management**: Efficient storage of test outputs

## 🎯 Success Criteria

A system passes **production readiness** when:

1. ✅ **All Critical Suites Pass** (>85% each)
2. ✅ **Overall Score ≥85%**  
3. ✅ **Zero Critical Failures**
4. ✅ **Performance Within Limits**
5. ✅ **Security Validation Clean**

---

**This orchestrator is the single source of truth for production readiness validation.**