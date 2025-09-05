/**
 * Cucumber-compatible assertion utilities
 * Provides a simple, lightweight alternative to vitest expect() for Cucumber step definitions
 */
import * as assert from 'node:assert';

/**
 * Cucumber assertion helper that mimics vitest expect() but uses Node.js assert
 */
export class CucumberAssert {
  constructor(private actual: any) {}

  static expect(actual: any): CucumberAssert {
    return new CucumberAssert(actual);
  }

  toBe(expected: any): void {
    assert.strictEqual(this.actual, expected, `Expected ${this.actual} to be ${expected}`);
  }

  toEqual(expected: any): void {
    assert.deepStrictEqual(this.actual, expected, `Expected ${JSON.stringify(this.actual)} to equal ${JSON.stringify(expected)}`);
  }

  toStrictEqual(expected: any): void {
    assert.deepStrictEqual(this.actual, expected, `Expected ${JSON.stringify(this.actual)} to strictly equal ${JSON.stringify(expected)}`);
  }

  toContain(expected: any): void {
    if (typeof this.actual === 'string') {
      assert.ok(this.actual.includes(expected), `Expected string "${this.actual}" to contain "${expected}"`);
    } else if (Array.isArray(this.actual)) {
      assert.ok(this.actual.includes(expected), `Expected array ${JSON.stringify(this.actual)} to contain ${expected}`);
    } else {
      assert.fail(`toContain() only works with strings and arrays, got ${typeof this.actual}`);
    }
  }

  toMatch(pattern: RegExp): void {
    if (typeof this.actual !== 'string') {
      assert.fail(`toMatch() only works with strings, got ${typeof this.actual}`);
    }
    assert.ok(pattern.test(this.actual), `Expected string "${this.actual}" to match pattern ${pattern}`);
  }

  toBeGreaterThan(expected: number): void {
    assert.ok(this.actual > expected, `Expected ${this.actual} to be greater than ${expected}`);
  }

  toBeGreaterThanOrEqual(expected: number): void {
    assert.ok(this.actual >= expected, `Expected ${this.actual} to be greater than or equal to ${expected}`);
  }

  toBeLessThan(expected: number): void {
    assert.ok(this.actual < expected, `Expected ${this.actual} to be less than ${expected}`);
  }

  toBeLessThanOrEqual(expected: number): void {
    assert.ok(this.actual <= expected, `Expected ${this.actual} to be less than or equal to ${expected}`);
  }

  toBeTrue(): void {
    assert.strictEqual(this.actual, true, `Expected ${this.actual} to be true`);
  }

  toBeFalse(): void {
    assert.strictEqual(this.actual, false, `Expected ${this.actual} to be false`);
  }

  toBeTruthy(): void {
    assert.ok(this.actual, `Expected ${this.actual} to be truthy`);
  }

  toBeFalsy(): void {
    assert.ok(!this.actual, `Expected ${this.actual} to be falsy`);
  }

  toBeNull(): void {
    assert.strictEqual(this.actual, null, `Expected ${this.actual} to be null`);
  }

  toBeUndefined(): void {
    assert.strictEqual(this.actual, undefined, `Expected ${this.actual} to be undefined`);
  }

  toBeDefined(): void {
    assert.notStrictEqual(this.actual, undefined, `Expected ${this.actual} to be defined`);
  }

  toHaveLength(expected: number): void {
    if (!this.actual || typeof this.actual.length !== 'number') {
      assert.fail(`toHaveLength() requires an object with length property, got ${typeof this.actual}`);
    }
    assert.strictEqual(this.actual.length, expected, `Expected length to be ${expected}, got ${this.actual.length}`);
  }

  toThrow(expectedError?: string | RegExp): void {
    if (typeof this.actual !== 'function') {
      assert.fail('toThrow() requires a function');
    }
    
    try {
      this.actual();
      assert.fail('Expected function to throw, but it did not');
    } catch (error: any) {
      if (expectedError) {
        if (typeof expectedError === 'string') {
          assert.ok(error.message.includes(expectedError), `Expected error message to contain "${expectedError}", got "${error.message}"`);
        } else if (expectedError instanceof RegExp) {
          assert.ok(expectedError.test(error.message), `Expected error message to match ${expectedError}, got "${error.message}"`);
        }
      }
    }
  }

  // Negative assertions
  get not(): CucumberAssertNot {
    return new CucumberAssertNot(this.actual);
  }
}

class CucumberAssertNot {
  constructor(private actual: any) {}

  toBe(expected: any): void {
    assert.notStrictEqual(this.actual, expected, `Expected ${this.actual} not to be ${expected}`);
  }

  toEqual(expected: any): void {
    try {
      assert.deepStrictEqual(this.actual, expected);
      assert.fail(`Expected ${JSON.stringify(this.actual)} not to equal ${JSON.stringify(expected)}`);
    } catch (error: any) {
      // If assertion failed, that's what we want for "not"
      if (error.code !== 'ERR_ASSERTION') {
        throw error;
      }
    }
  }

  toContain(expected: any): void {
    if (typeof this.actual === 'string') {
      assert.ok(!this.actual.includes(expected), `Expected string "${this.actual}" not to contain "${expected}"`);
    } else if (Array.isArray(this.actual)) {
      assert.ok(!this.actual.includes(expected), `Expected array ${JSON.stringify(this.actual)} not to contain ${expected}`);
    } else {
      assert.fail(`toContain() only works with strings and arrays, got ${typeof this.actual}`);
    }
  }

  toMatch(pattern: RegExp): void {
    if (typeof this.actual !== 'string') {
      assert.fail(`toMatch() only works with strings, got ${typeof this.actual}`);
    }
    assert.ok(!pattern.test(this.actual), `Expected string "${this.actual}" not to match pattern ${pattern}`);
  }

  toThrow(): void {
    if (typeof this.actual !== 'function') {
      assert.fail('toThrow() requires a function');
    }
    
    try {
      this.actual();
      // If we get here, function didn't throw - which is what we want for "not"
    } catch (error: any) {
      assert.fail('Expected function not to throw, but it did');
    }
  }
}

// Export both the class and a convenience function that matches vitest API
export const expect = (actual: any) => CucumberAssert.expect(actual);

// Export assertion utilities for direct use
export const cucumberAssert = {
  ok: assert.ok,
  strictEqual: assert.strictEqual,
  notStrictEqual: assert.notStrictEqual,
  deepStrictEqual: assert.deepStrictEqual,
  fail: assert.fail,
  throws: assert.throws,
  doesNotThrow: assert.doesNotThrow,
};