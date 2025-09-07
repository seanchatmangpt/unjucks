/**
 * CLI Test Suite Entry Point
 * Runs all CLI tests in organized groups
 */

import { describe, it, expect } from 'vitest';

// Import all test suites
import './core-cli.test';
import './backward-compatibility.test';
import './error-handling.test';
import './help-system.test';
import './semantic-commands.test';
import './argument-parsing.test';
import './file-operations.test';
import './command-combinations.test';
import './performance-edge-cases.test';
import './full-workflows.test';

describe('Unjucks CLI Test Suite', () => {
  it('should load all test modules successfully', () => {
    expect(true).toBe(true);
  });
});
