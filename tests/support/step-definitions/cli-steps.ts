/**
 * CLI Step Definitions for Vitest-Cucumber
 * Modular step definitions for command-line interface testing
 */
import { expect } from 'vitest';
import type { TestContext } from '../test-context.js';

export const createCliSteps = (context: TestContext) => ({
  /**
   * Execute a CLI command
   */
  'I run "([^"]*)"': async (command: string) => {
    context.lastResult = await context.helper.executeCommand(command);
  },

  /**
   * Execute an unjucks CLI command 
   */
  'I run unjucks "([^"]*)"': async (command: string) => {
    context.lastResult = await context.helper.runCli(command);
  },

  /**
   * Execute unjucks command with arguments
   */
  'I run unjucks (.*)': async (args: string) => {
    context.lastResult = await context.helper.runCli(args);
  },

  /**
   * Check command exit code
   */
  'the command should exit with code (\\d+)': (expectedCode: string) => {
    expect(context.lastResult?.exitCode).toBe(parseInt(expectedCode, 10));
  },

  /**
   * Check command succeeds (exit code 0)
   */
  'the command should succeed': () => {
    expect(context.lastResult?.exitCode).toBe(0);
  },

  /**
   * Check command fails (non-zero exit code)
   */
  'the command should fail': () => {
    expect(context.lastResult?.exitCode).toBeGreaterThan(0);
  },

  /**
   * Check stdout contains text
   */
  'the output should contain "([^"]*)"': (expectedText: string) => {
    const output = context.lastResult?.stdout || '';
    expect(output).toContain(expectedText);
  },

  /**
   * Check stdout matches pattern
   */
  'the output should match /([^/]+)/': (pattern: string) => {
    const output = context.lastResult?.stdout || '';
    expect(output).toMatch(new RegExp(pattern));
  },

  /**
   * Check stderr contains text
   */
  'the error output should contain "([^"]*)"': (expectedText: string) => {
    const errorOutput = context.lastResult?.stderr || '';
    expect(errorOutput).toContain(expectedText);
  },

  /**
   * Check output is empty
   */
  'the output should be empty': () => {
    const output = context.lastResult?.stdout || '';
    expect(output.trim()).toBe('');
  },

  /**
   * Check command execution time
   */
  'the command should complete in less than (\\d+) (?:seconds?|ms)': (time: string, unit: string) => {
    const duration = context.lastResult?.duration || 0;
    const expectedMs = unit.startsWith('s') ? parseInt(time, 10) * 1000 : parseInt(time, 10);
    expect(duration).toBeLessThan(expectedMs);
  },

  /**
   * Store output in variable
   */
  'I store the output as "([^"]*)"': (variableName: string) => {
    context.variables[variableName] = context.lastResult?.stdout || '';
  },

  /**
   * Store exit code in variable
   */
  'I store the exit code as "([^"]*)"': (variableName: string) => {
    context.variables[variableName] = context.lastResult?.exitCode || 0;
  }
});