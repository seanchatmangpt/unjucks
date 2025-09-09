/**
 * Enhanced mocking framework for TDD London School approach
 * Provides comprehensive mock utilities with behavior verification
 */

import { EventEmitter } from 'events';

export class EnhancedMockFramework extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      autoVerify: options.autoVerify !== false,
      strictMode: options.strictMode || false,
      trackAllCalls: options.trackAllCalls !== false,
      enableRecording: options.enableRecording !== false,
      ...options
    };
    
    this.mocks = new Map();
    this.recordings = new Map();
    this.expectations = new Map();
    this.verificationResults = new Map();
    this.callSequence = [];
    this.globalSequenceNumber = 0;
  }

  /**
   * Create a mock object with specified interface
   */
  createMock(name, interface_ = {}) {
    const mock = {
      _mockName: name,
      _mockCalls: new Map(),
      _mockExpectations: new Map(),
      _mockBehaviors: new Map(),
      _mockSequence: [],
      _mockVerified: false
    };

    // Create mock methods based on interface
    for (const [methodName, config] of Object.entries(interface_)) {
      mock[methodName] = this.createMockMethod(mock, methodName, config);
    }

    // Add utility methods
    mock._verify = () => this.verifyMock(name);
    mock._reset = () => this.resetMock(name);
    mock._getCalls = (methodName) => this.getMethodCalls(name, methodName);
    mock._getLastCall = (methodName) => this.getLastCall(name, methodName);
    mock._hasBeenCalled = (methodName) => this.hasBeenCalled(name, methodName);
    mock._hasBeenCalledWith = (methodName, ...args) => this.hasBeenCalledWith(name, methodName, ...args);
    mock._hasBeenCalledTimes = (methodName, times) => this.hasBeenCalledTimes(name, methodName, times);

    this.mocks.set(name, mock);
    return mock;
  }

  /**
   * Create mock method with call tracking and behavior
   */
  createMockMethod(mock, methodName, config = {}) {
    const { 
      returnValue, 
      implementation, 
      throws, 
      async: isAsync = false,
      side_effect
    } = config;

    return (...args) => {
      const callInfo = {
        methodName,
        args,
        timestamp: Date.now(),
        sequence: ++this.globalSequenceNumber,
        mockName: mock._mockName
      };

      // Record call
      if (!mock._mockCalls.has(methodName)) {
        mock._mockCalls.set(methodName, []);
      }
      mock._mockCalls.get(methodName).push(callInfo);
      mock._mockSequence.push(callInfo);

      // Add to global sequence
      if (this.options.trackAllCalls) {
        this.callSequence.push(callInfo);
      }

      // Execute side effects
      if (side_effect) {
        try {
          side_effect(...args);
        } catch (error) {
          console.warn(`Side effect error in ${mock._mockName}.${methodName}:`, error);
        }
      }

      // Emit call event
      this.emit('methodCalled', callInfo);

      // Check if method should throw
      if (throws) {
        const error = typeof throws === 'function' ? throws(...args) : throws;
        throw error;
      }

      // Execute custom implementation
      if (implementation) {
        const result = implementation(...args);
        if (isAsync && !(result instanceof Promise)) {
          return Promise.resolve(result);
        }
        return result;
      }

      // Return configured value
      if (returnValue !== undefined) {
        const result = typeof returnValue === 'function' ? returnValue(...args) : returnValue;
        if (isAsync && !(result instanceof Promise)) {
          return Promise.resolve(result);
        }
        return result;
      }

      // Default behavior
      if (isAsync) {
        return Promise.resolve(undefined);
      }
      return undefined;
    };
  }

  /**
   * Set expectations for mock interactions
   */
  expect(mockName, methodName) {
    const expectation = new MockExpectation(this, mockName, methodName);
    
    const key = `${mockName}.${methodName}`;
    if (!this.expectations.has(key)) {
      this.expectations.set(key, []);
    }
    this.expectations.get(key).push(expectation);

    return expectation;
  }

  /**
   * Verify that a mock method was called
   */
  verifyMethodCall(mockName, methodName, ...expectedArgs) {
    const calls = this.getMethodCalls(mockName, methodName);
    
    if (calls.length === 0) {
      throw new Error(`Expected ${mockName}.${methodName} to be called, but it wasn't`);
    }

    if (expectedArgs.length > 0) {
      const matchingCall = calls.find(call => 
        this.argumentsMatch(call.args, expectedArgs)
      );
      
      if (!matchingCall) {
        throw new Error(
          `Expected ${mockName}.${methodName} to be called with ${JSON.stringify(expectedArgs)}, ` +
          `but it was called with: ${calls.map(c => JSON.stringify(c.args)).join(', ')}`
        );
      }
    }

    return true;
  }

  /**
   * Verify mock expectations
   */
  verifyMock(mockName) {
    const mock = this.mocks.get(mockName);
    if (!mock) {
      throw new Error(`Mock not found: ${mockName}`);
    }

    const errors = [];

    // Check all expectations for this mock
    for (const [key, expectations] of this.expectations) {
      if (key.startsWith(mockName + '.')) {
        for (const expectation of expectations) {
          try {
            expectation.verify();
          } catch (error) {
            errors.push(error.message);
          }
        }
      }
    }

    mock._mockVerified = true;
    this.verificationResults.set(mockName, { errors, success: errors.length === 0 });

    if (errors.length > 0) {
      throw new Error(`Mock verification failed for ${mockName}:\n${errors.join('\n')}`);
    }

    return true;
  }

  /**
   * Verify all mocks
   */
  verifyAll() {
    const errors = [];

    for (const mockName of this.mocks.keys()) {
      try {
        this.verifyMock(mockName);
      } catch (error) {
        errors.push(error.message);
      }
    }

    if (errors.length > 0) {
      throw new Error(`Mock verification failed:\n${errors.join('\n')}`);
    }

    return true;
  }

  /**
   * Verify interaction order between mocks
   */
  verifyInteractionOrder(...interactions) {
    const relevantCalls = this.callSequence.filter(call => 
      interactions.some(interaction => 
        call.mockName === interaction.mockName && 
        call.methodName === interaction.methodName
      )
    );

    for (let i = 0; i < interactions.length; i++) {
      const expected = interactions[i];
      const actual = relevantCalls[i];

      if (!actual) {
        throw new Error(`Expected interaction ${i + 1}: ${expected.mockName}.${expected.methodName} was not found`);
      }

      if (actual.mockName !== expected.mockName || actual.methodName !== expected.methodName) {
        throw new Error(
          `Interaction order mismatch at position ${i + 1}: ` +
          `expected ${expected.mockName}.${expected.methodName}, ` +
          `got ${actual.mockName}.${actual.methodName}`
        );
      }
    }

    return true;
  }

  /**
   * Get method calls for a mock
   */
  getMethodCalls(mockName, methodName) {
    const mock = this.mocks.get(mockName);
    if (!mock) return [];
    
    return mock._mockCalls.get(methodName) || [];
  }

  /**
   * Get last call for a method
   */
  getLastCall(mockName, methodName) {
    const calls = this.getMethodCalls(mockName, methodName);
    return calls[calls.length - 1] || null;
  }

  /**
   * Check if method has been called
   */
  hasBeenCalled(mockName, methodName) {
    return this.getMethodCalls(mockName, methodName).length > 0;
  }

  /**
   * Check if method has been called with specific arguments
   */
  hasBeenCalledWith(mockName, methodName, ...expectedArgs) {
    const calls = this.getMethodCalls(mockName, methodName);
    return calls.some(call => this.argumentsMatch(call.args, expectedArgs));
  }

  /**
   * Check if method has been called specific number of times
   */
  hasBeenCalledTimes(mockName, methodName, expectedTimes) {
    return this.getMethodCalls(mockName, methodName).length === expectedTimes;
  }

  /**
   * Check if arguments match
   */
  argumentsMatch(actual, expected) {
    if (actual.length !== expected.length) {
      return false;
    }

    for (let i = 0; i < actual.length; i++) {
      if (!this.valuesEqual(actual[i], expected[i])) {
        return false;
      }
    }

    return true;
  }

  /**
   * Deep equality check for values
   */
  valuesEqual(a, b) {
    if (a === b) return true;
    
    if (a instanceof Date && b instanceof Date) {
      return a.getTime() === b.getTime();
    }
    
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      return a.every((val, i) => this.valuesEqual(val, b[i]));
    }
    
    if (typeof a === 'object' && typeof b === 'object' && a !== null && b !== null) {
      const keysA = Object.keys(a);
      const keysB = Object.keys(b);
      
      if (keysA.length !== keysB.length) return false;
      
      return keysA.every(key => 
        keysB.includes(key) && this.valuesEqual(a[key], b[key])
      );
    }
    
    return false;
  }

  /**
   * Reset specific mock
   */
  resetMock(mockName) {
    const mock = this.mocks.get(mockName);
    if (mock) {
      mock._mockCalls.clear();
      mock._mockSequence = [];
      mock._mockVerified = false;
    }

    // Clear expectations for this mock
    for (const [key, expectations] of this.expectations) {
      if (key.startsWith(mockName + '.')) {
        this.expectations.set(key, []);
      }
    }

    this.verificationResults.delete(mockName);
  }

  /**
   * Reset all mocks
   */
  resetAll() {
    for (const mockName of this.mocks.keys()) {
      this.resetMock(mockName);
    }
    
    this.callSequence = [];
    this.globalSequenceNumber = 0;
  }

  /**
   * Start recording interactions
   */
  startRecording(name = 'default') {
    this.recordings.set(name, {
      calls: [],
      startTime: Date.now()
    });
  }

  /**
   * Stop recording and get results
   */
  stopRecording(name = 'default') {
    const recording = this.recordings.get(name);
    if (!recording) {
      throw new Error(`Recording not found: ${name}`);
    }

    const endTime = Date.now();
    const relevantCalls = this.callSequence.filter(call => 
      call.timestamp >= recording.startTime && call.timestamp <= endTime
    );

    this.recordings.delete(name);
    
    return {
      calls: relevantCalls,
      duration: endTime - recording.startTime,
      totalCalls: relevantCalls.length
    };
  }

  /**
   * Create spy on existing object method
   */
  spy(object, methodName) {
    const originalMethod = object[methodName];
    const spyName = `${object.constructor.name || 'Object'}.${methodName}`;
    
    if (typeof originalMethod !== 'function') {
      throw new Error(`Cannot spy on non-function property: ${methodName}`);
    }

    const spy = this.createMock(spyName, {
      [methodName]: {
        implementation: (...args) => originalMethod.apply(object, args)
      }
    });

    object[methodName] = spy[methodName];
    spy._original = originalMethod;
    spy._restore = () => {
      object[methodName] = originalMethod;
    };

    return spy;
  }

  /**
   * Get comprehensive stats
   */
  getStats() {
    const mockStats = Array.from(this.mocks.entries()).map(([name, mock]) => ({
      name,
      totalCalls: mock._mockSequence.length,
      methods: Array.from(mock._mockCalls.entries()).map(([methodName, calls]) => ({
        methodName,
        callCount: calls.length
      })),
      verified: mock._mockVerified
    }));

    return {
      totalMocks: this.mocks.size,
      totalCalls: this.callSequence.length,
      totalExpectations: Array.from(this.expectations.values()).flat().length,
      mocks: mockStats,
      verificationResults: Object.fromEntries(this.verificationResults)
    };
  }

  /**
   * Clean up framework
   */
  cleanup() {
    this.resetAll();
    this.mocks.clear();
    this.expectations.clear();
    this.verificationResults.clear();
    this.recordings.clear();
    this.removeAllListeners();
  }
}

/**
 * Mock expectation builder class
 */
export class MockExpectation {
  constructor(framework, mockName, methodName) {
    this.framework = framework;
    this.mockName = mockName;
    this.methodName = methodName;
    this.expectedArgs = null;
    this.expectedCallCount = null;
    this.callCountOperator = 'equals';
    this.constraints = [];
  }

  /**
   * Expect specific arguments
   */
  toBeCalledWith(...args) {
    this.expectedArgs = args;
    return this;
  }

  /**
   * Expect specific call count
   */
  toBeCalledTimes(count) {
    this.expectedCallCount = count;
    this.callCountOperator = 'equals';
    return this;
  }

  /**
   * Expect at least N calls
   */
  toBeCalledAtLeast(count) {
    this.expectedCallCount = count;
    this.callCountOperator = 'atLeast';
    return this;
  }

  /**
   * Expect at most N calls
   */
  toBeCalledAtMost(count) {
    this.expectedCallCount = count;
    this.callCountOperator = 'atMost';
    return this;
  }

  /**
   * Expect to be called before another method
   */
  toBeCalledBefore(otherMockName, otherMethodName) {
    this.constraints.push({
      type: 'before',
      target: { mockName: otherMockName, methodName: otherMethodName }
    });
    return this;
  }

  /**
   * Expect to be called after another method
   */
  toBeCalledAfter(otherMockName, otherMethodName) {
    this.constraints.push({
      type: 'after',
      target: { mockName: otherMockName, methodName: otherMethodName }
    });
    return this;
  }

  /**
   * Verify this expectation
   */
  verify() {
    const calls = this.framework.getMethodCalls(this.mockName, this.methodName);

    // Verify call count
    if (this.expectedCallCount !== null) {
      switch (this.callCountOperator) {
        case 'equals':
          if (calls.length !== this.expectedCallCount) {
            throw new Error(
              `Expected ${this.mockName}.${this.methodName} to be called ${this.expectedCallCount} times, ` +
              `but it was called ${calls.length} times`
            );
          }
          break;
        case 'atLeast':
          if (calls.length < this.expectedCallCount) {
            throw new Error(
              `Expected ${this.mockName}.${this.methodName} to be called at least ${this.expectedCallCount} times, ` +
              `but it was called ${calls.length} times`
            );
          }
          break;
        case 'atMost':
          if (calls.length > this.expectedCallCount) {
            throw new Error(
              `Expected ${this.mockName}.${this.methodName} to be called at most ${this.expectedCallCount} times, ` +
              `but it was called ${calls.length} times`
            );
          }
          break;
      }
    }

    // Verify arguments
    if (this.expectedArgs !== null) {
      const matchingCall = calls.find(call => 
        this.framework.argumentsMatch(call.args, this.expectedArgs)
      );
      
      if (!matchingCall) {
        throw new Error(
          `Expected ${this.mockName}.${this.methodName} to be called with ${JSON.stringify(this.expectedArgs)}, ` +
          `but it was called with: ${calls.map(c => JSON.stringify(c.args)).join(', ')}`
        );
      }
    }

    // Verify constraints
    for (const constraint of this.constraints) {
      this.verifyConstraint(constraint, calls);
    }

    return true;
  }

  /**
   * Verify ordering constraint
   */
  verifyConstraint(constraint, calls) {
    const targetCalls = this.framework.getMethodCalls(
      constraint.target.mockName, 
      constraint.target.methodName
    );

    if (constraint.type === 'before') {
      if (calls.length === 0) {
        throw new Error(`Expected ${this.mockName}.${this.methodName} to be called before ${constraint.target.mockName}.${constraint.target.methodName}, but it was never called`);
      }
      
      if (targetCalls.length === 0) {
        return; // Target wasn't called, constraint is satisfied
      }

      const lastThisCall = calls[calls.length - 1];
      const firstTargetCall = targetCalls[0];

      if (lastThisCall.sequence >= firstTargetCall.sequence) {
        throw new Error(`Expected ${this.mockName}.${this.methodName} to be called before ${constraint.target.mockName}.${constraint.target.methodName}`);
      }
    }

    if (constraint.type === 'after') {
      if (calls.length === 0) {
        throw new Error(`Expected ${this.mockName}.${this.methodName} to be called after ${constraint.target.mockName}.${constraint.target.methodName}, but it was never called`);
      }

      if (targetCalls.length === 0) {
        throw new Error(`Expected ${this.mockName}.${this.methodName} to be called after ${constraint.target.mockName}.${constraint.target.methodName}, but target was never called`);
      }

      const firstThisCall = calls[0];
      const lastTargetCall = targetCalls[targetCalls.length - 1];

      if (firstThisCall.sequence <= lastTargetCall.sequence) {
        throw new Error(`Expected ${this.mockName}.${this.methodName} to be called after ${constraint.target.mockName}.${constraint.target.methodName}`);
      }
    }
  }
}

/**
 * Global mock framework instance
 */
export const globalMockFramework = new EnhancedMockFramework();

/**
 * Convenience functions
 */
export function createMock(name, interface_) {
  return globalMockFramework.createMock(name, interface_);
}

export function expect(mockName, methodName) {
  return globalMockFramework.expect(mockName, methodName);
}

export function verifyAll() {
  return globalMockFramework.verifyAll();
}

export function resetAll() {
  return globalMockFramework.resetAll();
}

export function spy(object, methodName) {
  return globalMockFramework.spy(object, methodName);
}

export default EnhancedMockFramework;