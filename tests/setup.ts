// Setup for Vitest tests
import { vi } from 'vitest';

// Global test timeout for Vitest
if (typeof globalThis !== 'undefined' && 'vi' in globalThis) {
  // We're in a Vitest environment
  console.log('Setting up Vitest test environment...');
} else {
  // We're in a different test environment (like Cucumber)
  console.log('Setting up BDD test environment...');
}

export function setupTestEnvironment() {
  console.log("Setting up test environment...");
}

export function cleanupTestEnvironment() {
  console.log("Cleaning up test environment...");
}

// Test helpers
export const testHelpers = {
  async delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  cleanMocks() {
    // Simple mock cleanup
  }
};

// Mock console methods if needed
export const mockConsole = {
  originalLog: console.log,
  originalError: console.error,
  
  silence() {
    console.log = () => {};
    console.error = () => {};
  },
  
  restore() {
    console.log = this.originalLog;
    console.error = this.originalError;
  }
};