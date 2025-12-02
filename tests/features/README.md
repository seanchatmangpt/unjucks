# Drift Detection Test Suite

This directory contains comprehensive Cucumber/BDD step definitions for testing KGEN's drift detection capabilities.

## 📁 Structure

```
tests/features/
├── step_definitions/
│   ├── drift_detection_steps.js      # Core drift detection steps
│   ├── advanced_drift_steps.js       # AST analysis, batch processing
│   ├── git_cicd_integration_steps.js # Git and CI/CD integration
│   ├── drift_validation_steps.js     # Performance and accuracy validation
│   └── index.js                      # Comprehensive test suite runner
├── fixtures/
│   └── drift/
│       └── baseline_states.js        # Test fixtures with before/after states
└── *.feature                        # Gherkin feature files

```

## 🎯 Features Tested

### Core Drift Detection
- ✅ Semantic drift detection with baseline comparisons
- ✅ Signal-to-noise ratio calculations (90% target)
- ✅ Change analysis with severity categorization
- ✅ False positive prevention for cosmetic changes

### Advanced Analysis
- ✅ AST (Abstract Syntax Tree) structural analysis
- ✅ Dependency change tracking with bundle impact
- ✅ Batch processing for multiple artifacts
- ✅ Incremental detection with checksum optimization

### Integration Testing
- ✅ Git-based change tracking with diff analysis
- ✅ CI/CD pipeline integration (GitHub Actions, etc.)
- ✅ Pull request analysis and reporting
- ✅ Webhook notifications for critical drift

### Performance & Scalability
- ✅ Single file analysis (target: <100ms)
- ✅ Batch processing scalability validation
- ✅ Large changeset handling (1000+ files)
- ✅ Memory usage optimization

## 🚀 Running Tests

### Quick Start
```bash
# Run the comprehensive validation suite
node tests/features/step_definitions/index.js

# Or using npm script (if configured)
npm run test:drift-detection
```

### Individual Test Components
```bash
# Test specific scenarios using Cucumber
npx cucumber-js tests/features/drift-detection.feature \
  --require tests/features/step_definitions/

# Run performance benchmarks
npx cucumber-js tests/features/drift-detection.feature \
  --tags "@performance"

# Run integration tests only  
npx cucumber-js tests/features/drift-detection.feature \
  --tags "@drift-detection and @ci-integration"
```

### Cucumber Configuration
Create `cucumber.js` in project root:
```javascript
module.exports = {
  default: {
    require: [
      'tests/features/step_definitions/**/*.js'
    ],
    format: [
      'pretty',
      'json:cucumber-report.json'
    ],
    publishQuiet: true
  }
};
```

## 📊 Validation Metrics

The test suite validates these key metrics:

### Accuracy Metrics
- **Accuracy**: Overall correctness (target: ≥90%)
- **Precision**: True positives / (True positives + False positives) (target: ≥85%)
- **Recall**: True positives / (True positives + False negatives) (target: ≥80%)
- **F1 Score**: Harmonic mean of precision and recall (target: ≥0.85)

### Performance Metrics
- **Single File Analysis**: <100ms per file
- **Batch Processing**: Linear scaling with file count
- **Memory Usage**: <50MB for 1000 files
- **Throughput**: >10 files/second for large batches

### Integration Metrics
- **Git Integration**: Hunk-level diff analysis
- **CI/CD Success Rate**: 100% workflow compatibility
- **Report Generation**: Complete structured output

## 🧪 Test Fixtures

The test suite includes comprehensive fixtures:

### Baseline States
- **TypeScript Interfaces**: Service definitions with type changes
- **React Components**: Props and state modifications
- **API Routes**: Endpoint additions/removals
- **Dependencies**: Import scope changes with bundle impact

### Change Patterns
- **Semantic Changes**: Type signatures, method removals, API breaking changes
- **Cosmetic Changes**: Whitespace, comments, formatting
- **Structural Changes**: File organization, import reordering

### Batch Test Data
- **50 Test Artifacts**: Mix of semantic and cosmetic changes
- **Version Baselines**: Multiple comparison points
- **Git History**: Realistic commit patterns

## 🎯 Usage Examples

### Basic Drift Detection
```javascript
const { driftTestSuite } = require('./step_definitions/index.js');

// Initialize test suite
driftTestSuite.initialize();

// Run full validation
const results = await driftTestSuite.runFullValidation();

// Check if drift detection meets quality standards
if (results.summary.overallScore >= 80) {
  console.log('✅ Drift detection system ready for production');
} else {
  console.log('❌ Quality improvements needed');
}
```

### Custom Test Scenarios
```javascript
const { testContext, driftFixtures } = require('./step_definitions/index.js');

// Test specific change pattern
const baseline = driftFixtures.getFixture('user-service-baseline');
const current = driftFixtures.getFixture('user-service-breaking');

// Analyze drift
const driftResult = await testContext.driftEngine.detectDrift({
  baselineContent: baseline.content,
  currentContent: current.content
});

console.log(`Drift detected: ${driftResult.driftDetected}`);
console.log(`Severity: ${driftResult.severity}`);
console.log(`SNR: ${driftResult.signalToNoiseRatio}`);
```

## 📈 Continuous Integration

### GitHub Actions Integration
```yaml
name: Drift Detection Validation
on: [push, pull_request]

jobs:
  drift-validation:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run drift detection tests
        run: |
          node tests/features/step_definitions/index.js
          npx cucumber-js tests/features/drift-detection.feature
      
      - name: Upload test results
        uses: actions/upload-artifact@v3
        with:
          name: drift-validation-report
          path: drift-detection-validation-report.json
```

### Quality Gates
```yaml
      - name: Validate drift detection quality
        run: |
          SCORE=$(node -e "
            const report = require('./drift-detection-validation-report.json');
            console.log(report.results.summary.overallScore);
          ")
          
          if (( $(echo "$SCORE >= 80" | bc -l) )); then
            echo "✅ Drift detection quality: $SCORE/100 (PASSED)"
          else
            echo "❌ Drift detection quality: $SCORE/100 (FAILED)"
            exit 1
          fi
```

## 🔧 Configuration

### Environment Variables
- `DRIFT_TEST_TIMEOUT`: Test timeout in milliseconds (default: 30000)
- `DRIFT_TEST_VERBOSE`: Enable verbose logging (default: false)
- `DRIFT_FIXTURES_PATH`: Custom fixtures directory path

### Test Configuration
```javascript
// In your test setup
process.env.DRIFT_TEST_TIMEOUT = '60000';
process.env.DRIFT_TEST_VERBOSE = 'true';
```

## 📝 Adding New Tests

### Step 1: Define Feature File
```gherkin
# tests/features/new-drift-feature.feature
Feature: New Drift Detection Capability
  Scenario: Detect specific change pattern
    Given I have a baseline with specific pattern
    When I make the target change
    Then drift should be detected with expected severity
```

### Step 2: Implement Step Definitions
```javascript
// In appropriate step definition file
Given('I have a baseline with specific pattern', function() {
  // Setup test baseline
});

When('I make the target change', function() {
  // Apply specific change
});

Then('drift should be detected with expected severity', function() {
  // Validate detection result
});
```

### Step 3: Add Test Fixtures
```javascript
// In fixtures/drift/baseline_states.js
driftFixtures.addFixture('new-pattern-baseline', {
  content: '/* baseline content */',
  type: 'typescript',
  category: 'pattern'
});
```

## 📚 API Reference

See individual step definition files for detailed API documentation:

- **Core Steps**: `drift_detection_steps.js`
- **Advanced Steps**: `advanced_drift_steps.js` 
- **Integration Steps**: `git_cicd_integration_steps.js`
- **Validation Steps**: `drift_validation_steps.js`

## 🐛 Troubleshooting

### Common Issues

1. **Test Timeouts**: Increase `DRIFT_TEST_TIMEOUT` for large test suites
2. **Fixture Loading**: Ensure fixtures are properly initialized
3. **Context Isolation**: Each test scenario has isolated context
4. **Performance**: Use `--parallel` for faster Cucumber execution

### Debug Mode
```bash
DEBUG=drift:* node tests/features/step_definitions/index.js
```

## 🤝 Contributing

1. Add comprehensive test coverage for new drift detection features
2. Ensure step definitions follow existing patterns
3. Update fixtures for new test scenarios  
4. Validate performance impact of new tests
5. Document any new configuration options

---

**Note**: This test suite connects to the actual KGEN drift detection engines in `packages/kgen-core/src/validation/` and validates real functionality, not mocks or placeholders.