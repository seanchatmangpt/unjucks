# Unjucks Test Suite

This directory contains the Cucumber.js BDD test suite for Unjucks.

## Structure

```
tests/
├── support/
│   ├── world.ts          # Test world context and utilities
│   └── hooks.ts          # Before/After hooks and setup
├── step-definitions/
│   ├── common-steps.ts   # Reusable step definitions
│   ├── cli-steps.ts      # CLI command and validation steps
│   ├── generator-steps.ts # Generator operations steps
│   ├── template-steps.ts  # Template processing steps
│   └── injection-steps.ts # File injection steps
├── fixtures/
│   ├── common/           # Common test templates and data
│   └── basic-generator/  # Sample generator for testing
└── tsconfig.json         # TypeScript configuration for tests

```

## Running Tests

### Install dependencies first
```bash
npm install
npm run build  # Build the project before running tests
```

### Run all tests
```bash
npm run test:cucumber
```

### Run by profile
```bash
npm run test:smoke        # Smoke tests only
npm run test:regression   # Regression tests only
npm run test:integration  # Integration tests only
```

### Run specific features
```bash
npx cucumber-js features/cli/
npx cucumber-js features/generators/
npx cucumber-js --tags "@smoke"
```

## Test Configuration

The tests use:
- **Cucumber.js** for BDD testing
- **TypeScript** with ts-node for compilation
- **Jest** assertions for verification
- **Custom World class** for test context and utilities
- **Temporary directories** for isolated test execution
- **Automatic cleanup** after each scenario

## Key Features

1. **Isolated Testing**: Each scenario runs in a temporary directory
2. **TypeScript Support**: Full TypeScript support with proper types
3. **Template Testing**: Utilities for creating and testing templates
4. **CLI Testing**: Command execution and output verification
5. **File System Testing**: File creation, modification, and injection testing
6. **Error Handling**: Comprehensive error scenarios and edge cases

## Writing Tests

### Using the World Class

```typescript
import { UnjucksWorld } from '../support/world';

When('I do something', async function (this: UnjucksWorld) {
  await this.executeUnjucksCommand(['generate', 'component']);
  this.assertCommandSucceeded();
});
```

### Common Patterns

```typescript
// Create template structure
await this.createTemplateStructure({
  'component/new.tsx.ejs': templateContent
});

// Execute command
await this.executeUnjucksCommand(['generate', 'component', '--name', 'MyComponent']);

// Verify file creation
const exists = await this.fileExists('src/components/MyComponent.tsx');
expect(exists).toBe(true);

// Read and verify content
const content = await this.readGeneratedFile('src/components/MyComponent.tsx');
expect(content).toContain('MyComponent');
```

## Test Categories

- **@smoke**: Basic functionality tests
- **@regression**: Full feature regression tests  
- **@integration**: End-to-end integration tests
- **@performance**: Performance and timing tests
- **@requires-build**: Tests requiring built project
- **@requires-fixtures**: Tests using specific fixtures