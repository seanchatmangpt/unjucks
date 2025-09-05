# Vitest-Cucumber Refactor Plan

## Overview

This document outlines the plan to refactor the current BDD testing setup from traditional Cucumber.js to `@amiceli/vitest-cucumber`, providing a unified testing framework that combines the power of BDD scenarios with Vitest's excellent developer experience.

## Current State Analysis

### Existing Infrastructure (What We Have)
- ✅ **18 feature files** with 302+ scenarios in Gherkin format
- ✅ **9 step definition files** with 150+ implementations
- ✅ **Comprehensive World class** (`UnjucksWorld`) with utilities
- ✅ **TestHelper infrastructure** with CLI execution capabilities
- ✅ **Working minimal Cucumber setup** for basic CLI tests

### Current Problems (What We're Solving)
- ❌ **ES Module conflicts** between Cucumber and project dependencies
- ❌ **Import issues** with nunjucks and other dependencies
- ❌ **Assertion library conflicts** (vitest expect vs cucumber assertions)
- ❌ **Configuration complexity** maintaining separate test systems
- ❌ **Developer friction** switching between unit tests (Vitest) and BDD tests (Cucumber)

## Target Architecture: Vitest-Cucumber Integration

### Core Benefits
1. **Single Test Framework**: Everything runs through Vitest
2. **Unified Configuration**: One test config, one test command
3. **No Import Conflicts**: Native Vitest expect, no assertion mismatches
4. **Better Performance**: Vitest's fast test runner for all tests
5. **Enhanced DX**: Hot reload, coverage, parallel execution for BDD tests
6. **TypeScript Native**: Full TypeScript support without loader complications

### Architecture Overview
```
┌─────────────────────────────────────────┐
│           Vitest Test Runner            │
├─────────────────┬───────────────────────┤
│   Unit Tests    │    BDD Tests          │
│   *.test.ts     │    *.feature.spec.ts  │
├─────────────────┼───────────────────────┤
│ vitest expect   │  vitest expect        │
│ @vitest/ui      │  @amiceli/vitest-     │
│ native vitest   │  cucumber             │
└─────────────────┴───────────────────────┘
```

## Migration Strategy

### Phase 1: Setup & Foundation (Priority: High)
**Estimated Time**: 2-4 hours

#### 1.1 Install Dependencies
```bash
npm install -D @amiceli/vitest-cucumber
```

#### 1.2 Update Configuration
- **Modify `vitest.config.ts`**:
  - Add support for `.feature.spec.ts` files
  - Configure feature file loading
  - Set up coverage for BDD tests
- **Remove/Archive Cucumber Config**:
  - Move `cucumber.config.cjs` to `cucumber.config.cjs.bak`
  - Update package.json scripts

#### 1.3 Create Migration Utilities
- **Feature File Converter**: Tool to validate existing .feature files
- **Step Definition Mapper**: Map existing step definitions to vitest-cucumber format

### Phase 2: Core Infrastructure Migration (Priority: High)
**Estimated Time**: 4-6 hours

#### 2.1 Convert World Class
```typescript
// Before (Cucumber World)
export class UnjucksWorld extends World {
  helper: TestHelper;
  // ... existing methods
}

// After (Vitest-Cucumber Context)
export interface TestContext {
  helper: TestHelper;
  // ... existing properties
}

export const createTestContext = (): TestContext => ({
  helper: new TestHelper(),
  // ... initialization
});
```

#### 2.2 Convert Step Definitions
```typescript
// Before (Cucumber format)
Given('I have a templates directory at {string}', 
  async function (this: UnjucksWorld, templatePath: string) {
    // implementation
  });

// After (Vitest-Cucumber format)
export const templateSteps = (context: TestContext) => ({
  'I have a templates directory at "(.*)"': async (templatePath: string) => {
    // implementation using context
  }
});
```

#### 2.3 Convert Feature Specs
```typescript
// New format: basic-cli.feature.spec.ts
import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';
import { createTestContext } from '../support/test-context';

const feature = await loadFeature('./features/smoke/basic-cli.feature');

describeFeature(feature, ({ Scenario }) => {
  Scenario('CLI version command works', ({ Given, When, Then }) => {
    const context = createTestContext();
    
    When('I run "node dist/cli.mjs --version"', async () => {
      const result = await context.helper.executeCommand('node dist/cli.mjs --version');
      context.lastResult = result;
    });
    
    Then('the command should exit with code 0', () => {
      expect(context.lastResult?.exitCode).toBe(0);
    });
  });
});
```

### Phase 3: Feature Migration (Priority: Medium)
**Estimated Time**: 6-8 hours

#### 3.1 Convert by Priority
1. **Smoke Tests** (basic-cli.feature) - Immediate validation
2. **CLI Features** (4 files, 66 scenarios) - Core functionality
3. **Generator Features** (5 files, 84 scenarios) - Primary use cases
4. **Template Features** (5 files, 81 scenarios) - Core engine
5. **Injection Features** (4 files, 71 scenarios) - Advanced functionality

#### 3.2 Migration Process per Feature
1. **Validate Feature File**: Ensure Gherkin syntax compatibility
2. **Convert Step Definitions**: Transform to vitest-cucumber format
3. **Update Imports**: Use Vitest expect and utilities
4. **Test Migration**: Run converted tests to ensure functionality
5. **Performance Check**: Verify test execution speed

### Phase 4: Advanced Features & Optimization (Priority: Low)
**Estimated Time**: 3-5 hours

#### 4.1 Enhanced Integration
- **Coverage Integration**: BDD scenarios in coverage reports
- **Parallel Execution**: Optimize scenario execution
- **Watch Mode**: Hot reload for feature files
- **Custom Matchers**: Domain-specific assertions

#### 4.2 Developer Experience
- **VS Code Integration**: Syntax highlighting, jump-to-definition
- **Test Debugging**: Full debugging support in IDE
- **Error Reporting**: Enhanced error messages and stack traces

## File Structure Changes

### Before (Current Structure)
```
tests/
├── step-definitions/           # 9 files, 150+ steps
│   ├── cli-commands.steps.ts
│   ├── template-steps.ts
│   └── ...
├── support/                   # Infrastructure
│   ├── world.ts              # UnjucksWorld class
│   ├── TestHelper.ts         # CLI utilities
│   └── hooks.ts              # Before/After hooks
features/                      # 18 feature files
├── cli/                      # 4 files, 66 scenarios
├── generators/               # 5 files, 84 scenarios
├── templates/                # 5 files, 81 scenarios
└── injection/                # 4 files, 71 scenarios
cucumber.config.cjs           # Cucumber configuration
```

### After (Target Structure)
```
tests/
├── features/                  # Vitest-cucumber specs
│   ├── cli/
│   │   ├── cli-commands.feature.spec.ts
│   │   ├── cli-options.feature.spec.ts
│   │   └── ...
│   ├── generators/
│   │   ├── generator-discovery.feature.spec.ts
│   │   └── ...
│   └── templates/
│       ├── template-rendering.feature.spec.ts
│       └── ...
├── support/                   # Shared utilities
│   ├── test-context.ts       # Vitest-compatible context
│   ├── TestHelper.ts         # CLI utilities (unchanged)
│   ├── step-definitions/     # Reusable step libraries
│   │   ├── cli-steps.ts
│   │   ├── template-steps.ts
│   │   └── ...
│   └── fixtures/             # Test data
features/                      # Original feature files (kept)
├── cli/                      # Reference only
└── ...
vitest.config.ts              # Unified test configuration
```

## Implementation Details

### 1. Context Management
Replace Cucumber World with lightweight context object:

```typescript
export interface TestContext {
  helper: TestHelper;
  variables: Record<string, any>;
  lastResult?: CommandResult;
  tempDirectory: string;
}

export const useTestContext = (): TestContext => {
  return {
    helper: new TestHelper(),
    variables: {},
    tempDirectory: path.join(os.tmpdir(), `unjucks-test-${Date.now()}`)
  };
};
```

### 2. Step Definition Libraries
Create modular, reusable step definitions:

```typescript
// tests/support/step-definitions/cli-steps.ts
import { expect } from 'vitest';
import type { TestContext } from '../test-context';

export const cliSteps = (context: TestContext) => ({
  'I run "(.*)"': async (command: string) => {
    context.lastResult = await context.helper.executeCommand(command);
  },
  
  'the command should exit with code (\\d+)': (expectedCode: string) => {
    expect(context.lastResult?.exitCode).toBe(parseInt(expectedCode));
  },
  
  'the output should contain "(.*)"': (expectedText: string) => {
    const output = context.lastResult?.stdout || '';
    expect(output).toContain(expectedText);
  }
});
```

### 3. Feature Spec Template
Standard template for all feature specs:

```typescript
import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';
import { useTestContext } from '../../support/test-context';
import { cliSteps } from '../../support/step-definitions/cli-steps';
import { templateSteps } from '../../support/step-definitions/template-steps';

const feature = await loadFeature('./features/cli/cli-commands.feature');

describeFeature(feature, ({ Scenario, Background }) => {
  let context = useTestContext();
  
  // Merge step definition libraries
  const steps = {
    ...cliSteps(context),
    ...templateSteps(context)
  };
  
  Background(() => {
    // Setup before each scenario
    context = useTestContext();
  });
  
  Scenario('CLI version command works', ({ Given, When, Then }) => {
    // Map steps to implementations
    When(steps['I run "(.*)"']);
    Then(steps['the command should exit with code (\\d+)']);
    Then(steps['the output should contain "(.*)"']);
  });
});
```

## Benefits Analysis

### Developer Experience
- **Single Command**: `npm test` runs all tests
- **Fast Feedback**: Vitest's fast test runner
- **Hot Reload**: Immediate test re-runs on changes
- **Better Debugging**: Native IDE debugging support
- **Unified Coverage**: Single coverage report

### Maintainability  
- **Less Configuration**: One test config instead of two
- **Consistent Patterns**: Same testing patterns across unit/BDD tests
- **Better TypeScript**: Native TS support without loaders
- **Simpler Dependencies**: Fewer packages, less complexity

### Performance
- **Faster Execution**: Vitest's optimized test runner
- **Parallel BDD**: Scenarios can run in parallel
- **Smart Caching**: Vitest's intelligent caching
- **Memory Efficiency**: Single process for all tests

## Migration Timeline

### Week 1: Foundation
- [ ] Install vitest-cucumber
- [ ] Update configuration
- [ ] Convert basic CLI tests
- [ ] Validate approach

### Week 2: Core Migration  
- [ ] Convert all CLI features (4 files)
- [ ] Convert generator features (5 files)
- [ ] Test migration results
- [ ] Performance validation

### Week 3: Complete Migration
- [ ] Convert template features (5 files)  
- [ ] Convert injection features (4 files)
- [ ] Convert advanced features
- [ ] Documentation updates

### Week 4: Optimization
- [ ] Performance tuning
- [ ] Developer experience enhancements
- [ ] CI/CD integration
- [ ] Team training

## Risk Assessment

### Low Risk ✅
- **Feature Files**: No changes needed, stay in Gherkin format
- **TestHelper**: Can be reused as-is
- **Core Logic**: Business logic in steps remains unchanged

### Medium Risk ⚠️
- **Step Definition Conversion**: Requires careful mapping
- **Context Management**: Need to replicate World functionality
- **Complex Scenarios**: Some scenarios may need restructuring

### High Risk 🚨
- **Integration Dependencies**: Some steps import complex dependencies
- **Custom Hooks**: Before/After hooks need conversion
- **Parallel Execution**: Need to ensure scenario isolation

### Mitigation Strategies
1. **Incremental Migration**: Convert features one by one
2. **Parallel Development**: Keep existing Cucumber setup during migration
3. **Comprehensive Testing**: Validate each converted feature thoroughly
4. **Rollback Plan**: Maintain ability to revert if issues arise

## Success Metrics

### Functional Metrics
- [ ] All 302+ scenarios pass in vitest-cucumber
- [ ] All CLI commands properly tested  
- [ ] Template generation scenarios work
- [ ] Injection scenarios function correctly

### Performance Metrics
- [ ] Test execution time < 30 seconds (vs current ~60s)
- [ ] Memory usage reduced by >30%
- [ ] Hot reload working (<1s feedback)

### Developer Experience
- [ ] Single test command works
- [ ] IDE debugging functional
- [ ] Coverage reports unified
- [ ] Documentation updated

## Conclusion

The migration to vitest-cucumber will provide significant benefits:
- **Unified testing experience** across unit and BDD tests
- **Better performance** with Vitest's optimized runner  
- **Simplified configuration** and dependency management
- **Enhanced developer experience** with modern tooling

The migration is technically feasible with manageable risk, leveraging our existing feature files and core logic while modernizing the execution framework.

**Recommendation**: Proceed with migration, starting with Phase 1 foundation work and basic CLI tests to validate the approach before full commitment.