import { describe } from 'vitest';
import { cucumber } from '@amiceli/vitest-cucumber';
import { resolve } from 'path';

// Core CLI Commands Feature
describe('CLI Core Commands', () => {
  cucumber(
    resolve(__dirname, './features/cli-core.feature'),
    resolve(__dirname, './step-definitions/cli-core.steps.ts')
  );
});

// Template Generation Feature
describe('Template Generation', () => {
  cucumber(
    resolve(__dirname, './features/template-generation.feature'),
    [
      resolve(__dirname, './step-definitions/cli-core.steps.ts'),
      resolve(__dirname, './step-definitions/template-generation.steps.ts')
    ]
  );
});

// File Injection Feature
describe('File Injection and Modification', () => {
  cucumber(
    resolve(__dirname, './features/file-injection.feature'),
    [
      resolve(__dirname, './step-definitions/cli-core.steps.ts'),
      resolve(__dirname, './step-definitions/file-injection.steps.ts')
    ]
  );
});

// Semantic Features
describe('Semantic RDF/Turtle Features', () => {
  cucumber(
    resolve(__dirname, './features/semantic-features.feature'),
    [
      resolve(__dirname, './step-definitions/cli-core.steps.ts'),
      resolve(__dirname, './step-definitions/semantic-features.steps.ts')
    ]
  );
});

// Swarm Integration
describe('Swarm and MCP Integration', () => {
  cucumber(
    resolve(__dirname, './features/swarm-integration.feature'),
    [
      resolve(__dirname, './step-definitions/cli-core.steps.ts'),
      resolve(__dirname, './step-definitions/swarm-integration.steps.ts')
    ]
  );
});

// Developer Workflows
describe('End-to-End Developer Workflows', () => {
  cucumber(
    resolve(__dirname, './features/developer-workflows.feature'),
    [
      resolve(__dirname, './step-definitions/cli-core.steps.ts'),
      resolve(__dirname, './step-definitions/template-generation.steps.ts'),
      resolve(__dirname, './step-definitions/file-injection.steps.ts'),
      resolve(__dirname, './step-definitions/semantic-features.steps.ts'),
      resolve(__dirname, './step-definitions/swarm-integration.steps.ts')
    ]
  );
});

// Error Handling
describe('Error Handling and Edge Cases', () => {
  cucumber(
    resolve(__dirname, './features/error-handling.feature'),
    [
      resolve(__dirname, './step-definitions/cli-core.steps.ts'),
      resolve(__dirname, './step-definitions/error-handling.steps.ts')
    ]
  );
});

// Performance and Security
describe('Performance and Security Validation', () => {
  cucumber(
    resolve(__dirname, './features/performance-security.feature'),
    [
      resolve(__dirname, './step-definitions/cli-core.steps.ts'),
      resolve(__dirname, './step-definitions/performance-security.steps.ts')
    ]
  );
});
