# Testing Guide

Comprehensive testing guide for Unjucks v1.0, covering BDD testing framework, test execution, and contribution guidelines.

## Overview

Unjucks uses a comprehensive Behavior-Driven Development (BDD) testing framework with Cucumber.js and Vitest. The test suite covers all functionality with 302 scenarios across 18 feature files.

## Test Architecture

### Testing Stack

- **BDD Framework**: Cucumber.js for behavior-driven testing
- **Test Runner**: Vitest for unit tests and coverage
- **Language**: TypeScript with ES modules
- **Assertion Library**: Built-in Vitest/Chai assertions
- **Test Data**: YAML fixtures and data tables

### Directory Structure

```
tests/
├── fixtures/                 # Test data and templates
│   ├── _templates/           # Sample templates for testing
│   └── data/                 # Test data files
├── step-definitions/         # Cucumber step implementations
│   ├── cli-commands.steps.ts
│   ├── cli-steps.ts
│   ├── common-steps.ts
│   ├── file-operations.steps.ts
│   ├── generator-steps.ts
│   ├── injection-steps.ts
│   └── template-steps.ts
├── support/                  # Test utilities and helpers
├── unit/                     # Unit tests
├── setup.ts                  # Global test setup
└── README.md                # Testing documentation
```

## Feature Test Coverage

### Complete Test Suite (302 scenarios)

The BDD test suite covers all functionality with comprehensive scenarios:

#### CLI Features (66 scenarios)
- `cli-commands.feature` (12 scenarios) - Core CLI command functionality
- `cli-options.feature` (14 scenarios) - Command-line options and flags
- `cli-prompts.feature` (17 scenarios) - Interactive prompts and validation
- `cli-validation.feature` (23 scenarios) - Input validation and error handling

#### Generator Features (84 scenarios)
- `generator-discovery.feature` (11 scenarios) - Automatic generator discovery
- `generator-execution.feature` (20 scenarios) - Template execution workflow
- `generator-help.feature` (19 scenarios) - Template help and documentation
- `generator-listing.feature` (14 scenarios) - Generator enumeration
- `generator-selection.feature` (20 scenarios) - Generator and template selection

#### Injection Features (71 scenarios)
- `injection-atomic.feature` (21 scenarios) - Atomic file operations
- `injection-idempotency.feature` (17 scenarios) - Idempotent operations
- `injection-modes.feature` (14 scenarios) - Different injection modes
- `injection-targets.feature` (19 scenarios) - Target file management

#### Template Features (81 scenarios)
- `template-conditionals.feature` (14 scenarios) - Conditional logic
- `template-filters.feature` (19 scenarios) - String transformation filters
- `template-frontmatter.feature` (17 scenarios) - Template metadata
- `template-rendering.feature` (16 scenarios) - Template processing
- `template-variables.feature` (15 scenarios) - Variable extraction and usage

## Running Tests

### Test Execution Commands

```bash
# Run all tests
npm test

# Run BDD tests only
npm run test:cucumber

# Run specific test profiles
npm run test:smoke      # Smoke tests (@smoke tag)
npm run test:regression # Regression tests (@regression tag)
npm run test:integration # Integration tests (@integration tag)

# Run with specific tags
npm run test:cucumber -- --tags "@critical"
npm run test:cucumber -- --tags "@core and not @slow"

# Run tests in parallel
npm run test:cucumber:parallel

# Watch mode for development
npm run test:cucumber:watch
```

### Test Profiles

#### Smoke Tests
Quick validation of core functionality:
```bash
npm run test:smoke
```
- Core system components
- Basic CLI operations
- Essential template rendering

#### Regression Tests
Full functionality validation:
```bash
npm run test:regression
```
- All feature scenarios
- Edge cases and error conditions
- Performance benchmarks

#### Integration Tests
End-to-end workflow testing:
```bash
npm run test:integration
```
- Complete generation workflows
- File system operations
- Cross-component integration

#### Development Profile
Fast feedback during development:
```bash
npm run test:dev
```
- Focused test execution
- Detailed logging
- Debug mode enabled

### Unit Tests

Run unit tests with Vitest:
```bash
# Unit tests only
npm run test:types

# With coverage
npm run test -- --coverage

# Watch mode
npm run dev
```

## Test Configuration

### Cucumber Configuration

The test suite uses multiple Cucumber.js profiles:

```javascript
// cucumber.config.cjs
module.exports = {
  default: {
    paths: ["features/**/*.feature"],
    import: [
      "tests/support/**/*.ts",
      "tests/step-definitions/**/*.ts"
    ],
    loader: ["ts-node/esm"],
    format: [
      "json:reports/cucumber-report.json",
      "html:reports/cucumber-report.html",
      "progress-bar"
    ],
    formatOptions: {
      snippetInterface: "async-await"
    }
  },
  smoke: {
    tags: "@smoke",
    format: ["progress-bar"]
  },
  regression: {
    tags: "@regression",
    parallel: 4
  }
};
```

### Vitest Configuration

Unit test configuration:

```typescript
// vitest.config.ts
export default {
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['tests/**', 'node_modules/**']
    }
  }
};
```

## Writing Tests

### BDD Feature Files

Feature files use Gherkin syntax to describe behavior:

```gherkin
# features/cli/cli-commands.feature
@cli @core
Feature: CLI Commands
  As a developer
  I want to use CLI commands
  So that I can generate code efficiently

  Background:
    Given the Unjucks CLI is available
    And I have a clean workspace

  @smoke @critical
  Scenario: Basic command execution
    Given I have a generator "component" with template "react"
    When I run "unjucks generate component react --componentName Button --dest ./src"
    Then the command should succeed
    And file "./src/Button.tsx" should be created
    And file "./src/Button.tsx" should contain "export const Button"

  @integration
  Scenario Outline: Generate multiple components
    Given I have a generator "component" with template "react"
    When I run "unjucks generate component react --componentName <name> --withProps <props> --dest ./src"
    Then the command should succeed
    And file "./src/<name>.tsx" should be created
    And file "./src/<name>.tsx" should contain "<expected>"

    Examples:
      | name   | props | expected        |
      | Button | true  | ButtonProps     |
      | Input  | false | React.FC        |
      | Modal  | true  | ModalProps      |
```

### Step Definitions

Implement step definitions for feature files:

```typescript
// tests/step-definitions/cli-commands.steps.ts
import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from 'chai';
import { execSync } from 'child_process';
import fs from 'fs-extra';

Given('the Unjucks CLI is available', async function () {
  // Verify CLI is installed and accessible
  const result = execSync('unjucks --version', { encoding: 'utf8' });
  expect(result).to.contain('unjucks');
});

Given('I have a clean workspace', async function () {
  // Setup clean test workspace
  await fs.ensureDir(this.workspace);
  await fs.emptyDir(this.workspace);
});

Given('I have a generator {string} with template {string}', async function (generator: string, template: string) {
  // Setup test generator and template
  const generatorPath = `${this.workspace}/_templates/${generator}/${template}`;
  await fs.ensureDir(generatorPath);
  
  // Copy test template files
  await fs.copy(`./tests/fixtures/_templates/${generator}/${template}`, generatorPath);
  
  this.generator = generator;
  this.template = template;
});

When('I run {string}', function (command: string) {
  // Execute CLI command
  try {
    this.result = execSync(command, {
      cwd: this.workspace,
      encoding: 'utf8'
    });
    this.exitCode = 0;
  } catch (error) {
    this.error = error;
    this.exitCode = error.status || 1;
    this.result = error.stdout || error.message;
  }
});

Then('the command should succeed', function () {
  expect(this.exitCode).to.equal(0);
});

Then('file {string} should be created', async function (filePath: string) {
  const fullPath = `${this.workspace}/${filePath}`;
  expect(await fs.pathExists(fullPath)).to.be.true;
});

Then('file {string} should contain {string}', async function (filePath: string, content: string) {
  const fullPath = `${this.workspace}/${filePath}`;
  const fileContent = await fs.readFile(fullPath, 'utf8');
  expect(fileContent).to.contain(content);
});
```

### Unit Tests

Write unit tests for individual components:

```typescript
// tests/unit/generator.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { Generator } from '../../src/lib/generator.js';
import path from 'path';
import fs from 'fs-extra';

describe('Generator', () => {
  let generator: Generator;
  let testTemplatesDir: string;

  beforeEach(async () => {
    testTemplatesDir = path.join(__dirname, '../fixtures/_templates');
    generator = new Generator(testTemplatesDir);
  });

  describe('listGenerators', () => {
    it('should return available generators', async () => {
      const generators = await generator.listGenerators();
      
      expect(generators).toHaveLength(1);
      expect(generators[0]).toMatchObject({
        name: 'component',
        description: expect.any(String),
        templates: expect.any(Array)
      });
    });
  });

  describe('generate', () => {
    it('should generate files from template', async () => {
      const result = await generator.generate({
        generator: 'component',
        template: 'react',
        dest: './test-output',
        force: true,
        dry: true,
        componentName: 'TestButton',
        withProps: true,
        withTests: false
      });

      expect(result.files).toHaveLength(1);
      expect(result.files[0].path).toContain('TestButton.tsx');
      expect(result.files[0].content).toContain('TestButton');
      expect(result.files[0].content).toContain('TestButtonProps');
    });

    it('should handle missing variables', async () => {
      await expect(generator.generate({
        generator: 'component',
        template: 'react',
        dest: './test-output',
        force: true,
        dry: true
        // Missing componentName
      })).rejects.toThrow('componentName');
    });
  });

  describe('scanTemplateForVariables', () => {
    it('should extract variables from template', async () => {
      const result = await generator.scanTemplateForVariables('component', 'react');
      
      expect(result.variables).toContainEqual(
        expect.objectContaining({
          name: 'componentName',
          type: 'string',
          required: true
        })
      );
      
      expect(result.variables).toContainEqual(
        expect.objectContaining({
          name: 'withProps',
          type: 'boolean',
          required: false
        })
      );
    });
  });
});
```

### Test Data and Fixtures

Organize test data systematically:

```
tests/fixtures/
├── _templates/              # Sample templates
│   ├── component/
│   │   └── react/
│   │       ├── {{ componentName | pascalCase }}.tsx
│   │       └── {{ componentName | pascalCase }}.test.tsx
│   └── command/
│       └── citty/
│           └── {{ commandName | pascalCase }}.ts
├── data/
│   ├── generators.yml       # Test generator configurations
│   ├── variables.yml        # Test variable definitions
│   └── expected-outputs/    # Expected generated files
└── workspaces/              # Temporary test workspaces
```

Example test fixture:

```typescript
// tests/fixtures/_templates/component/react/{{ componentName | pascalCase }}.tsx
import React from 'react';

{% if withProps %}
interface {{ componentName | pascalCase }}Props {
  // Component props
}

export const {{ componentName | pascalCase }}: React.FC<{{ componentName | pascalCase }}Props> = (props) => {
{% else %}
export const {{ componentName | pascalCase }}: React.FC = () => {
{% endif %}
  return (
    <div>
      <h1>{{ componentName | titleCase }}</h1>
    </div>
  );
};
```

## Test Utilities

### Custom World Object

Cucumber world object for shared test context:

```typescript
// tests/support/world.ts
import { setWorldConstructor, World } from '@cucumber/cucumber';
import { execSync } from 'child_process';
import fs from 'fs-extra';
import path from 'path';

export class UnjucksWorld extends World {
  public workspace: string;
  public result: string;
  public error: Error;
  public exitCode: number;
  public generator: string;
  public template: string;
  public generatedFiles: string[];

  constructor(options: any) {
    super(options);
    this.workspace = path.join(__dirname, '../tmp', `test-${Date.now()}`);
  }

  async setup() {
    await fs.ensureDir(this.workspace);
  }

  async cleanup() {
    await fs.remove(this.workspace);
  }

  execCommand(command: string): string {
    try {
      this.result = execSync(command, {
        cwd: this.workspace,
        encoding: 'utf8'
      });
      this.exitCode = 0;
      return this.result;
    } catch (error) {
      this.error = error;
      this.exitCode = error.status || 1;
      this.result = error.stdout || error.message;
      throw error;
    }
  }
}

setWorldConstructor(UnjucksWorld);
```

### Test Hooks

Setup and teardown hooks:

```typescript
// tests/support/hooks.ts
import { Before, After, BeforeAll, AfterAll } from '@cucumber/cucumber';
import { UnjucksWorld } from './world.js';

BeforeAll(async function () {
  // Global setup
  console.log('Starting Unjucks BDD test suite');
});

Before(async function (this: UnjucksWorld) {
  // Setup test workspace for each scenario
  await this.setup();
});

After(async function (this: UnjucksWorld) {
  // Cleanup after each scenario
  if (!process.env.KEEP_TEST_FILES) {
    await this.cleanup();
  }
});

AfterAll(async function () {
  // Global cleanup
  console.log('Completed Unjucks BDD test suite');
});
```

### Assertion Helpers

Custom assertion helpers:

```typescript
// tests/support/assertions.ts
import { expect } from 'chai';
import fs from 'fs-extra';

export async function expectFileExists(filePath: string): Promise<void> {
  expect(await fs.pathExists(filePath), `File should exist: ${filePath}`).to.be.true;
}

export async function expectFileContains(filePath: string, content: string): Promise<void> {
  expect(await fs.pathExists(filePath), `File should exist: ${filePath}`).to.be.true;
  const fileContent = await fs.readFile(filePath, 'utf8');
  expect(fileContent, `File should contain "${content}"`).to.contain(content);
}

export async function expectFileDoesNotExist(filePath: string): Promise<void> {
  expect(await fs.pathExists(filePath), `File should not exist: ${filePath}`).to.be.false;
}

export function expectCommandSuccess(exitCode: number, result: string): void {
  expect(exitCode, `Command should succeed. Output: ${result}`).to.equal(0);
}

export function expectCommandFailure(exitCode: number): void {
  expect(exitCode, 'Command should fail').to.not.equal(0);
}
```

## Test Tags and Organization

### Tag Categories

Tests are organized using comprehensive tags:

#### Priority Tags
- `@critical` - Must-pass tests for releases
- `@smoke` - Quick validation tests
- `@regression` - Full functionality tests

#### Component Tags
- `@cli` - CLI interface tests
- `@core` - Core functionality tests
- `@templates` - Template processing tests
- `@generators` - Generator discovery and execution
- `@injection` - Code injection features

#### Type Tags
- `@unit` - Unit tests
- `@integration` - Integration tests
- `@e2e` - End-to-end tests

#### Performance Tags
- `@performance` - Performance benchmarks
- `@slow` - Long-running tests

### Tag Usage Examples

```bash
# Run only critical tests
npm run test:cucumber -- --tags "@critical"

# Run CLI tests excluding slow ones
npm run test:cucumber -- --tags "@cli and not @slow"

# Run smoke tests for core functionality
npm run test:cucumber -- --tags "@smoke and @core"

# Run all integration tests
npm run test:cucumber -- --tags "@integration"
```

## Continuous Integration

### GitHub Actions Integration

```yaml
# .github/workflows/test.yml
name: Test Suite

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'
        cache: 'pnpm'
    
    - name: Install dependencies
      run: pnpm install
    
    - name: Run unit tests
      run: pnpm test:types
    
    - name: Run smoke tests
      run: pnpm test:smoke
    
    - name: Run full test suite
      run: pnpm test:cucumber
      
    - name: Upload test reports
      uses: actions/upload-artifact@v4
      if: always()
      with:
        name: test-reports
        path: reports/
```

### Pre-commit Hooks

```bash
# Install pre-commit hooks
npm install --save-dev husky lint-staged

# Configure package.json
{
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged",
      "pre-push": "npm run test:smoke"
    }
  },
  "lint-staged": {
    "*.{ts,js}": ["eslint --fix", "git add"],
    "*.{feature}": ["cucumber-js --dry-run"]
  }
}
```

## Performance Testing

### Benchmark Tests

```typescript
// tests/performance/benchmark.test.ts
import { describe, it, expect } from 'vitest';
import { Generator } from '../../src/lib/generator.js';
import { performance } from 'perf_hooks';

describe('Performance Benchmarks', () => {
  it('should generate files within performance thresholds', async () => {
    const generator = new Generator();
    const start = performance.now();
    
    await generator.generate({
      generator: 'component',
      template: 'react',
      dest: './test-output',
      dry: true,
      force: true,
      componentName: 'PerfTest',
      withProps: true
    });
    
    const duration = performance.now() - start;
    expect(duration).toBeLessThan(1000); // Should complete within 1 second
  });

  it('should handle large template generation efficiently', async () => {
    const generator = new Generator();
    const components = Array.from({ length: 100 }, (_, i) => `Component${i}`);
    
    const start = performance.now();
    
    for (const componentName of components) {
      await generator.generate({
        generator: 'component',
        template: 'react',
        dest: './test-output',
        dry: true,
        force: true,
        componentName,
        withProps: true
      });
    }
    
    const duration = performance.now() - start;
    const avgDuration = duration / components.length;
    
    expect(avgDuration).toBeLessThan(50); // Average < 50ms per component
  });
});
```

## Contributing Tests

### Test Development Workflow

1. **Feature Development**: Write failing tests first (TDD)
2. **Implementation**: Implement feature to pass tests
3. **Refactoring**: Improve code while maintaining test coverage
4. **Documentation**: Update test documentation

### Adding New Test Scenarios

1. **Create Feature File**:
```bash
touch features/new-feature/my-feature.feature
```

2. **Write Gherkin Scenarios**:
```gherkin
@new-feature
Feature: My New Feature
  As a user
  I want new functionality
  So that I can accomplish my goals

  Scenario: Basic usage
    Given preconditions are met
    When I perform an action
    Then I should see expected results
```

3. **Implement Step Definitions**:
```bash
touch tests/step-definitions/my-feature.steps.ts
```

4. **Add Test Data**:
```bash
mkdir tests/fixtures/my-feature
```

5. **Run Tests**:
```bash
npm run test:cucumber -- features/new-feature/
```

### Test Quality Guidelines

1. **Gherkin Best Practices**:
   - Use clear, behavior-focused language
   - Keep scenarios focused and independent
   - Use Background for common setup
   - Implement reusable step definitions

2. **Step Definition Guidelines**:
   - Keep steps atomic and focused
   - Use meaningful assertions
   - Handle async operations properly
   - Provide helpful error messages

3. **Test Data Management**:
   - Use fixtures for consistent test data
   - Keep test data minimal and focused
   - Clean up after tests
   - Use realistic but safe test data

## Debugging Tests

### Debug Configuration

```json
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Cucumber Tests",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/node_modules/.bin/cucumber-js",
      "args": [
        "--config", "cucumber.config.cjs",
        "--tags", "@debug",
        "--parallel", "0"
      ],
      "env": {
        "NODE_ENV": "test",
        "DEBUG": "true"
      },
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen"
    }
  ]
}
```

### Debug Helpers

```typescript
// tests/support/debug.ts
export function debugLog(message: string, data?: any): void {
  if (process.env.DEBUG) {
    console.log(`[DEBUG] ${message}`, data || '');
  }
}

export function debugStep(stepName: string): void {
  debugLog(`Executing step: ${stepName}`);
}

export function debugWorld(world: any): void {
  debugLog('World state:', {
    workspace: world.workspace,
    generator: world.generator,
    template: world.template,
    exitCode: world.exitCode
  });
}
```

---

*For more information about testing patterns and examples, see the [API Reference](../api/README.md) and [Getting Started Guide](../getting-started.md).*