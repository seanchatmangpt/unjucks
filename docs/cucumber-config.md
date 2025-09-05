# Cucumber.js Configuration Guide

## Overview

This project uses Cucumber.js for Behavior-Driven Development (BDD) testing with a comprehensive configuration that supports multiple testing profiles, TypeScript, parallel execution, and detailed reporting.

## Folder Structure

```
/
├── features/                    # Feature files (.feature)
│   ├── cli/                    # CLI-related features
│   ├── configuration/          # Configuration features
│   └── advanced/               # Advanced features
├── tests/
│   ├── step-definitions/       # Step definition files (.ts)
│   ├── support/               # Support files
│   │   ├── world.ts           # Custom World class
│   │   ├── hooks.ts           # Before/After hooks
│   │   └── env.ts             # Environment configuration
│   ├── helpers/               # Test helper utilities
│   └── tsconfig.json         # TypeScript config for tests
├── reports/                   # Test reports (auto-generated)
└── cucumber.config.cjs        # Cucumber configuration (CommonJS for compatibility)
```

## Key Architecture Decisions

### ES Module Compatibility
- **Configuration**: Uses `.cjs` extension for CommonJS compatibility with ES module project
- **Step Definitions**: Uses `import` directive instead of `require` for ES modules
- **TypeScript**: Configured with `ts-node/esm` loader for proper ES module support

### File Path Resolution
- **Features**: Located in `features/` directory (not `tests/features/`)
- **Step Definitions**: Explicitly imported individual files for better control
- **Support Files**: Automatically loaded via import patterns

## Configuration Profiles

### Default Profile
```bash
npm run test:cucumber
```
- Runs smoke and regression tests
- 2 parallel workers
- HTML and JSON reports

### Smoke Tests
```bash
npm run test:smoke
```
- Quick validation tests (`@smoke` tag)
- 4 parallel workers
- No retries for fast feedback
- JSON report only

### Regression Tests
```bash
npm run test:regression
```
- Comprehensive test suite (`@regression` tag)
- 2 parallel workers
- 2 retry attempts
- HTML and JSON reports

### Integration Tests
```bash
npm run test:integration
```
- External dependency tests (`@integration` tag)
- Sequential execution (parallel: 1)
- Extended timeout (60s)
- JSON report only

### Development Profile
```bash
npm run test:dev
```
- Work-in-progress tests (`@wip` or `@dev` tags)
- Sequential execution
- Pretty formatter for debugging
- No retries

### CI/CD Profile
```bash
npm run test:ci
```
- All tests except manual and WIP
- 4 parallel workers
- Multiple report formats (JSON, HTML, JUnit)
- Strict mode enabled

### Performance Tests
```bash
npm run test:performance
```
- Performance-specific tests (`@performance` tag)
- Sequential execution
- Extended timeout (120s)
- No retries

### Security Tests
```bash
npm run test:security
```
- Security-focused tests (`@security` tag)
- Sequential execution
- JSON reporting

## Key Features

### 1. TypeScript Support
- Full TypeScript integration with ts-node
- Type-safe step definitions and world objects
- ESM module support

### 2. Custom World Class
- Centralized test context management
- Built-in TestHelper integration
- Debug logging capabilities
- Command result tracking

### 3. Comprehensive Hooks
- Global setup/teardown
- Scenario-level initialization/cleanup
- Tag-specific configurations
- Performance monitoring
- Error handling and debugging

### 4. Environment Configuration
- Environment-specific settings
- Debug mode support
- Configurable timeouts and URLs
- Test data management

### 5. Multiple Report Formats
- **Progress Bar**: Real-time test execution feedback
- **JSON**: Machine-readable results for CI/CD
- **HTML**: Human-readable detailed reports
- **JUnit**: Integration with CI systems
- **Pretty Formatter**: Detailed debugging output

### 6. Parallel Execution
- Configurable parallel workers per profile
- Optimized for different test types
- Load balancing across scenarios

## Available npm Scripts

```bash
# Basic Cucumber testing
npm run test:cucumber              # Default profile
npm run test:cucumber:watch        # Watch mode
npm run test:cucumber:dry          # Dry run (validate scenarios)
npm run test:cucumber:debug        # Debug mode with verbose output

# Profile-specific testing
npm run test:smoke                 # Smoke tests
npm run test:regression            # Regression tests
npm run test:integration           # Integration tests
npm run test:dev                   # Development tests
npm run test:ci                    # CI/CD tests
npm run test:performance           # Performance tests
npm run test:security              # Security tests

# Advanced execution
npm run test:cucumber:parallel     # Force parallel execution
```

## Environment Variables

```bash
# Core configuration
NODE_ENV=test                      # Test environment
DEBUG=true                         # Enable debug logging
VERBOSE=true                       # Verbose output

# Execution settings
BASE_URL=http://localhost:3000     # Application base URL
DEFAULT_TIMEOUT=30000              # Default timeout (ms)
PARALLEL=4                         # Parallel workers
RETRY_ATTEMPTS=1                   # Retry failed scenarios

# Feature flags
ENABLE_FEATURE_X=true              # Enable experimental features

# Reporting
REPORTS_DIR=./reports              # Custom reports directory
```

## Tags Usage

### Core Tags
- `@smoke` - Quick validation tests
- `@regression` - Comprehensive feature tests
- `@integration` - External dependency tests
- `@performance` - Performance benchmarks
- `@security` - Security validations

### Development Tags
- `@wip` - Work in progress (excluded from main runs)
- `@dev` - Development-only tests
- `@manual` - Manual testing required (excluded from CI)

### Execution Control Tags
- `@slow` - Tests requiring extended timeout
- `@skip` - Temporarily disabled tests
- `@focus` - Run only these tests during development

## Best Practices

### 1. Feature File Organization
```gherkin
@smoke @cli
Feature: CLI Command Execution
  
  Background:
    Given I have a project with templates directory
    
  @regression
  Scenario: Generate command template
    When I run "unjucks generate command user"
    Then I should see "UserCommand.ts" file generated
```

### 2. Step Definition Patterns
```typescript
// Use CustomWorld for context
Given("I have setup {string}", async function (this: CustomWorld, setup: string) {
  // Implementation
});

// Leverage world methods
When("I execute {string}", async function (this: CustomWorld, command: string) {
  const result = await this.helper.runCli(command);
  this.setLastCommandResult(result);
});
```

### 3. Error Handling
```typescript
Then("the command should fail with {string}", function (this: CustomWorld, error: string) {
  const result = this.getLastCommandResult();
  expect(result.exitCode).not.toBe(0);
  expect(result.stderr).toContain(error);
});
```

## Debugging

### Enable Debug Mode
```bash
DEBUG=true npm run test:cucumber:debug
```

### Check Configuration
```bash
npm run test:cucumber:dry
```

### Profile Testing
```bash
# Test specific profile
cucumber-js --profile smoke --dry-run
```

## Reports Location

All reports are generated in the `reports/` directory:

```
reports/
├── cucumber-default.html         # Default profile HTML report
├── cucumber-default.json         # Default profile JSON data
├── cucumber-smoke.json           # Smoke tests results
├── cucumber-regression.html      # Regression tests report
├── cucumber-ci.xml              # JUnit XML for CI systems
└── cucumber-performance.json     # Performance test results
```

## Integration with CI/CD

The `ci` profile is optimized for continuous integration:

```yaml
# GitHub Actions example
- name: Run Cucumber Tests
  run: npm run test:ci
  
- name: Upload Test Reports
  uses: actions/upload-artifact@v3
  with:
    name: cucumber-reports
    path: reports/
```

## Troubleshooting

### Common Issues

1. **TypeScript compilation errors**
   - Ensure `ts-node` is properly configured
   - Check `tsconfig.json` includes test files

2. **Step definition not found**
   - Verify step definitions are in `tests/step-definitions/`
   - Check file extensions match configuration (`.ts`, `.js`)

3. **Parallel execution issues**
   - Reduce parallel workers for resource constraints
   - Use sequential execution for integration tests

4. **Timeout errors**
   - Increase timeout in specific profiles
   - Use `@slow` tag for extended timeout

### Debug Commands

```bash
# Validate configuration
npx cucumber-js --config cucumber.config.js --dry-run

# List available step definitions
npx cucumber-js --config cucumber.config.js --dry-run --format usage

# Run with maximum verbosity
DEBUG=* VERBOSE=true npm run test:cucumber:debug
```

This configuration follows the 80/20 principle: providing simple defaults while supporting advanced use cases through profiles and environment variables.