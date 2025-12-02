# KGEN v1 BDD Test Suite

Comprehensive Behavior-Driven Development (BDD) tests for KGEN v1 functionality validation.

## Overview

This test suite validates all critical v1 requirements through comprehensive BDD scenarios:

- **Deterministic Generation** - Byte-identical outputs for reproducible builds
- **Content Addressed Storage** - BLAKE3-based CAS with deduplication  
- **Attestation Generation** - Cryptographic provenance for every command
- **Marketplace Publishing/Installation** - Deterministic TAR creation and verification
- **SHACL Validation** - RDF graph constraint validation
- **Git Receipts Ledger** - Immutable operation tracking via git notes
- **Persona Exploration** - Dynamic JSON view generation
- **Golden File Testing** - Byte-exact validation against reference files
- **Fuzz Testing** - Path order, whitespace variants, and edge cases

## Quick Start

```bash
# Run critical smoke tests (fastest)
npm run test:v1:quick

# Run full v1 validation suite
npm run test:v1:full

# Run specific test categories
npm run test:v1:deterministic
npm run test:v1:cas
npm run test:v1:attestation
npm run test:v1:marketplace
npm run test:v1:shacl
npm run test:v1:git-receipts
npm run test:v1:personas
npm run test:v1:fuzz
```

## Test Structure

```
tests/
├── features/                     # BDD feature files
│   ├── deterministic-generation.feature
│   ├── cas-storage.feature
│   ├── attestation.feature
│   ├── marketplace-publish.feature
│   ├── marketplace-install.feature
│   ├── shacl-validation.feature
│   ├── git-receipts.feature
│   └── explore-personas.feature
├── step_definitions/             # Test step implementations
│   └── v1-common-steps.js
├── fixtures/                     # Test utilities
│   ├── golden-files-validator.js
│   └── fuzz-tester.js
├── golden/                       # Reference golden files
├── reports/                      # Test execution reports
├── cucumber.config.js            # Cucumber configuration
├── run-v1-tests.js              # Test runner script
└── README.md                     # This file
```

## Test Categories

### 🎯 Critical Tests (@critical)
**Must pass for v1 release**

- Deterministic generation with byte-identical outputs
- CAS storage with BLAKE3 hashing
- Attestation generation for all commands
- Marketplace package creation and verification

### 🔄 Deterministic Tests (@deterministic)
**Validates reproducible builds**

- Same inputs produce identical bytes (99.9% KPI)
- Cross-platform determinism
- Timestamp normalization (SOURCE_DATE_EPOCH)
- File order independence
- Variable order independence
- Unicode normalization

### 🗄️ CAS Tests (@cas)
**Content Addressed Storage validation**

- BLAKE3 hash addressing
- Automatic deduplication
- Content integrity verification
- Large file handling
- Concurrent operations
- Garbage collection

### 📝 Attestation Tests (@attestation)  
**Cryptographic provenance tracking**

- Command metadata capture
- File input/output tracking
- Cryptographic signing (Ed25519)
- Chain of custody maintenance
- Error handling attestations
- Compliance-ready format

### 🏪 Marketplace Tests (@marketplace)
**Package publishing and installation**

- Deterministic TAR creation
- Package signing and verification
- Dependency resolution
- Version management
- Security scanning
- CAS integration

### 🔍 SHACL Tests (@shacl)
**RDF graph validation**

- SHACL shape validation
- Violation detection and reporting
- Custom constraints
- SPARQL-based validation
- Multi-graph validation
- Performance with large graphs

### 📚 Git Receipts Tests (@git)
**Immutable operation ledger**

- Git notes receipt creation
- Distributed ledger maintenance
- Receipt integrity verification
- Search and query capabilities
- Provenance chain tracking
- Conflict resolution

### 👥 Personas Tests (@personas)
**Dynamic view generation**

- JSON view creation for personas
- Data filtering by permissions
- Computed field generation
- Hierarchical views
- Dynamic persona creation
- Conditional logic

### 🎲 Fuzz Tests (@fuzz)
**Edge case and variant testing**

- Path order variants
- Whitespace normalization
- Filename edge cases
- Variable name validation
- Content size extremes
- Unicode handling

## Golden File Testing

Golden files provide byte-exact reference outputs for regression testing:

```bash
# Create golden files from known-good outputs
tests/fixtures/golden-files-validator.js store <test-name> <content>

# Validate against golden files  
tests/fixtures/golden-files-validator.js validate <test-name> <actual-content>
```

Golden files ensure:
- Byte-identical generation across systems
- TAR archive determinism
- Attestation format stability
- No regressions in output

## Fuzz Testing

Comprehensive fuzz testing validates edge cases:

```javascript
const fuzzTester = new FuzzTester({ seed: 12345 });

// Generate variants
const pathVariants = fuzzTester.generatePathOrderVariants(basePaths);
const whitespaceVariants = fuzzTester.generateWhitespaceVariants(content);  
const filenameVariants = fuzzTester.generateFilenameVariants();

// Run fuzz test suite
await fuzzTester.runFuzzTests(testFunction, baseData);
```

Fuzz testing covers:
- **Path Order** - File generation order independence
- **Whitespace** - Tabs, spaces, mixed, Unicode spaces
- **Filenames** - Problematic characters, Unicode, length limits
- **Variables** - Invalid names, reserved words, edge cases
- **Content Size** - Empty to multi-megabyte content

## Test Configuration

### Environment Variables

```bash
# Deterministic testing
export SOURCE_DATE_EPOCH="1704067200"  # 2024-01-01 00:00:00 UTC
export KGEN_DETERMINISTIC="true"
export TZ="UTC"

# Feature toggles
export KGEN_CAS_ENABLED="true"
export KGEN_ATTESTATION="true" 
export KGEN_HASH_ALGORITHM="blake3"

# Test mode
export NODE_ENV="test"
export KGEN_TEST_MODE="true"
```

### Cucumber Profiles

```bash
# Run specific test profiles
npx cucumber-js --profile deterministic
npx cucumber-js --profile cas
npx cucumber-js --profile attestation
npx cucumber-js --profile marketplace
npx cucumber-js --profile shacl
npx cucumber-js --profile git-receipts
npx cucumber-js --profile personas
npx cucumber-js --profile fuzz
npx cucumber-js --profile performance
npx cucumber-js --profile kpi
```

## Performance Requirements

### KPI Targets for v1 Release

| Metric | Target | Test |
|--------|--------|------|
| Deterministic Reproducibility | 99.9% | 1000 generations with identical inputs |
| Generation Speed | < 2 seconds | Standard template generation |
| Memory Usage | < 100MB | Template processing |
| CAS Storage Efficiency | > 90% | Deduplication ratio |
| Attestation Overhead | < 5% | Performance impact |

### Performance Test Execution

```bash
# Run performance benchmarks
npm run test:v1:performance

# Run KPI validation (long-running)
npm run test:v1:kpi
```

## Continuous Integration

### CI Pipeline Integration

```yaml
# .github/workflows/v1-tests.yml
- name: Run v1 Critical Tests
  run: npm run test:v1:quick

- name: Run Full v1 Suite  
  run: npm run test:v1:full
  if: github.ref == 'refs/heads/main'
```

### Test Reports

All test executions generate comprehensive reports:

- **JSON Reports** - Machine-readable results (`tests/reports/*.json`)
- **HTML Reports** - Human-readable with visualization (`tests/reports/*.html`)
- **JUnit XML** - CI/CD integration (`tests/reports/*.xml`)
- **Markdown Summary** - GitHub-ready results (`tests/reports/v1-test-summary.md`)

## Development Workflow

### Adding New Tests

1. **Create Feature File**
   ```gherkin
   @new-feature @v1
   Feature: New Functionality
     As a user
     I want new capability  
     So that I can achieve goals
   
     @critical
     Scenario: Core functionality works
       Given preconditions
       When I perform action
       Then expected results occur
   ```

2. **Implement Step Definitions**
   ```javascript
   Given('preconditions', function() {
     // Setup test state
   });
   
   When('I perform action', function() {
     // Execute functionality
   });
   
   Then('expected results occur', function() {
     // Validate outcomes
   });
   ```

3. **Add to Test Profiles**
   ```javascript
   // tests/cucumber.config.js
   profiles: {
     'new-feature': {
       tags: '@new-feature',
       format: ['progress-bar', 'json:tests/reports/new-feature-report.json']
     }
   }
   ```

### Debugging Tests

```bash
# Run single feature
npx cucumber-js tests/features/deterministic-generation.feature

# Run with specific tags
npx cucumber-js --tags "@deterministic and @critical"

# Debug mode with verbose output
DEBUG=* npx cucumber-js tests/features/cas-storage.feature
```

## v1 Release Criteria

**All critical tests must pass for v1 release:**

✅ **Deterministic Generation** - 99.9% reproducibility  
✅ **CAS Storage** - BLAKE3 content addressing  
✅ **Attestation** - Cryptographic provenance  
✅ **Marketplace** - Package publishing/installation  
✅ **SHACL Validation** - RDF constraint checking  
✅ **Git Receipts** - Immutable operation ledger  
✅ **Persona Exploration** - Dynamic JSON views  
✅ **Golden Files** - Byte-exact regression prevention  
✅ **Fuzz Testing** - Edge case validation  

**Performance KPIs must be met:**
- 99.9% deterministic reproducibility
- < 2 second generation time
- < 100MB memory usage  
- > 90% CAS efficiency
- < 5% attestation overhead

Run the complete validation:

```bash
npm run test:v1:full
```

Success output indicates v1 readiness:
```
🎉 ALL v1 TESTS PASSED! KGEN v1 is ready for release.
```