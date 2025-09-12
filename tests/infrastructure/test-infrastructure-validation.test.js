/**
 * Comprehensive test infrastructure validation
 * Tests all helper utilities, mocking framework, and coordination systems
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PropertyTestHelper } from '../helpers/property-test-helper.js';
import { AsyncTestHelper } from '../helpers/async-test-helper.js';
import { TestEnvironmentManager, CommonSetupHooks } from '../helpers/test-environment-manager.js';
import { CrossTestCommunication } from '../helpers/cross-test-communication.js';
import { EnhancedMockFramework } from '../helpers/enhanced-mock-framework.js';
import { globalCommunication } from '../helpers/cross-test-communication.js';

describe('Test Infrastructure Validation', () => {
  let propertyHelper;
  let asyncHelper;
  let envManager;
  let communication;
  let mockFramework;

  beforeEach(async () => {
    propertyHelper = new PropertyTestHelper({ numRuns: 20 });
    asyncHelper = new AsyncTestHelper({ defaultTimeout: 2000 });
    envManager = new TestEnvironmentManager();
    communication = new CrossTestCommunication();
    mockFramework = new EnhancedMockFramework();
  });

  afterEach(async () => {
    await propertyHelper.cleanup();
    await asyncHelper.cleanup();
    await envManager.cleanupAll();
    await communication.cleanup();
    mockFramework.cleanup();
  });

  describe('Property-based testing infrastructure', () => {
    it('should generate valid test data', () => {
      const testData = propertyHelper.generateTestData('template-variables');
      expect(testData).toBeDefined();
      expect(Array.isArray(testData)).toBe(true);
      expect(testData.length).toBe(10);
      
      testData.forEach(variables => {
        expect(typeof variables).toBe('object');
        expect(variables).not.toBeNull();
      });
    });

    it('should run property tests with proper error handling', async () => {
      const result = await propertyHelper.runProperty(
        async (input) => {
          // Property: string concatenation is associative
          const { a, b, c } = input;
          const left = (a + b) + c;
          const right = a + (b + c);
          return left === right;
        },
        require('fast-check').record({
          a: require('fast-check').string(),
          b: require('fast-check').string(),
          c: require('fast-check').string()
        }),
        { numRuns: 50 }
      );

      expect(result.success).toBe(true);
      expect(propertyHelper.getStats().successRate).toBeGreaterThan(0);
    });

    it('should handle failing properties correctly', async () => {
      try {
        await propertyHelper.runProperty(
          async (input) => {
            // Property that should fail: division is commutative (it's not)
            const { a, b } = input;
            if (b === 0) return true; // Skip division by zero
            return (a / b) === (b / a);
          },
          require('fast-check').record({
            a: require('fast-check').integer({ min: 1, max: 100 }),
            b: require('fast-check').integer({ min: 1, max: 100 })
          }),
          { numRuns: 20 }
        );
        
        // Should not reach here
        expect(false).toBe(true);
      } catch (error) {
        expect(error.message).toContain('Property failed');
        expect(propertyHelper.getStats().failedTests).toBeGreaterThan(0);
      }
    });

    it('should generate Unjucks-specific test data', () => {
      const templateContent = propertyHelper.generateTestData('template-content');
      const filePaths = propertyHelper.generateTestData('file-paths');
      const frontmatter = propertyHelper.generateTestData('frontmatter');

      expect(templateContent.length).toBe(10);
      expect(filePaths.length).toBe(10);
      expect(frontmatter.length).toBe(10);

      // Validate template content contains variables
      templateContent.forEach(template => {
        expect(typeof template).toBe('string');
        expect(template).toMatch(/\{\{.*\}\}/);
      });

      // Validate file paths are valid
      filePaths.forEach(filePath => {
        expect(typeof filePath).toBe('string');
        expect(filePath.length).toBeGreaterThan(0);
        expect(filePath).toMatch(/\.(js|ts|json|md|txt|njk)$/);
      });
    });
  });

  describe('Async test infrastructure', () => {
    it('should handle timeouts correctly', async () => {
      const operation = () => new Promise(resolve => 
        setTimeout(resolve, 3000)
      );

      try {
        await asyncHelper.withTimeout(operation, 1000, 'timeout-test');
        expect(false).toBe(true); // Should not reach here
      } catch (error) {
        expect(error.message).toContain('timeout');
        expect(asyncHelper.getStats().timeoutOperations).toBe(1);
      }
    });

    it('should retry failed operations', async () => {
      let attempts = 0;
      const flakyOperation = () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Flaky failure');
        }
        return 'success';
      };

      const result = await asyncHelper.withTimeout(flakyOperation, 5000, 'retry-test');
      expect(result).toBe('success');
      expect(attempts).toBe(3);
      expect(asyncHelper.getStats().retriedOperations).toBe(1);
    });

    it('should execute operations in parallel with concurrency control', async () => {
      const operations = Array.from({ length: 10 }, (_, i) => 
        () => new Promise(resolve => 
          setTimeout(() => resolve(`result-${i}`), 100)
        )
      );

      const startTime = this.getDeterministicTimestamp();
      const result = await asyncHelper.executeParallel(operations, {
        concurrency: 3,
        timeout: 2000
      });
      const duration = this.getDeterministicTimestamp() - startTime;

      expect(result.successCount).toBe(10);
      expect(result.errorCount).toBe(0);
      expect(result.results.length).toBe(10);
      
      // Should take roughly 400ms (10 ops / 3 concurrency * 100ms)
      // allowing for some overhead
      expect(duration).toBeLessThan(1000);
      expect(duration).toBeGreaterThan(300);
    });

    it('should handle circuit breaker pattern', async () => {
      let callCount = 0;
      const failingOperation = () => {
        callCount++;
        throw new Error('Operation failed');
      };

      // First 5 calls should fail normally
      for (let i = 0; i < 5; i++) {
        try {
          await asyncHelper.withCircuitBreaker(failingOperation, {
            failureThreshold: 5,
            resetTimeout: 1000
          });
        } catch (error) {
          expect(error.message).toBe('Operation failed');
        }
      }

      // 6th call should be rejected by circuit breaker
      try {
        await asyncHelper.withCircuitBreaker(failingOperation, {
          failureThreshold: 5,
          resetTimeout: 1000
        });
        expect(false).toBe(true); // Should not reach here
      } catch (error) {
        expect(error.message).toContain('Circuit breaker is open');
      }

      expect(callCount).toBe(5); // Circuit breaker prevented 6th call
    });

    it('should wait for conditions with polling', async () => {
      let conditionMet = false;
      setTimeout(() => { conditionMet = true; }, 500);

      const result = await asyncHelper.waitFor(
        () => conditionMet,
        { timeout: 2000, pollInterval: 100, description: 'test condition' }
      );

      expect(result).toBe(true);
    });
  });

  describe('Test environment management', () => {
    it('should create and manage test environments', async () => {
      const envId = await envManager.createEnvironment('test-env', {
        isolateTests: true,
        useSharedResources: false
      });

      expect(envId).toBeDefined();
      expect(envId).toContain('test-env');

      const environment = envManager.getEnvironment(envId);
      expect(environment.state).toBe('ready');
      expect(environment.resources.has('workspace')).toBe(true);

      await envManager.cleanupEnvironment(envId);
      expect(() => envManager.getEnvironment(envId)).toThrow();
    });

    it('should setup fixtures in environment', async () => {
      const envId = await envManager.createEnvironment('fixture-test');
      
      const fixturePath = await envManager.addFixture(
        envId,
        'test.json',
        { test: 'data' },
        { fileType: 'json' }
      );

      expect(fixturePath).toBeDefined();
      
      const retrievedPath = envManager.getFixture(envId, 'test.json');
      expect(retrievedPath).toBe(fixturePath);

      await envManager.cleanupEnvironment(envId);
    });

    it('should handle setup and teardown hooks', async () => {
      let setupCalled = false;
      let teardownCalled = false;

      envManager.addSetupHook(async (env) => {
        setupCalled = true;
        env.resources.set('setupTest', true);
      });

      envManager.addTeardownHook(async (env) => {
        teardownCalled = true;
      });

      const envId = await envManager.createEnvironment('hook-test');
      const environment = envManager.getEnvironment(envId);
      
      expect(setupCalled).toBe(true);
      expect(environment.resources.get('setupTest')).toBe(true);

      await envManager.cleanupEnvironment(envId);
      expect(teardownCalled).toBe(true);
    });

    it('should manage multiple environments concurrently', async () => {
      const envPromises = Array.from({ length: 5 }, (_, i) =>
        envManager.createEnvironment(`concurrent-test-${i}`)
      );

      const envIds = await Promise.all(envPromises);
      expect(envIds.length).toBe(5);

      const activeEnvs = envManager.getActiveEnvironments();
      expect(activeEnvs.length).toBe(5);

      // Cleanup all environments
      await Promise.all(envIds.map(id => envManager.cleanupEnvironment(id)));
      
      const remainingEnvs = envManager.getActiveEnvironments();
      expect(remainingEnvs.length).toBe(0);
    });
  });

  describe('Cross-test communication', () => {
    it('should share data between tests', async () => {
      await communication.setSharedData('test-key', { value: 'test-data' });
      
      const retrievedData = communication.getSharedData('test-key');
      expect(retrievedData).toEqual({ value: 'test-data' });
      
      const hasData = communication.hasSharedData('test-key');
      expect(hasData).toBe(true);
    });

    it('should handle data expiration', async () => {
      await communication.setSharedData('expiring-key', 'data', { ttl: 100 });
      
      expect(communication.hasSharedData('expiring-key')).toBe(true);
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));
      
      expect(communication.hasSharedData('expiring-key')).toBe(false);
      expect(communication.getSharedData('expiring-key')).toBeNull();
    });

    it('should support pub/sub messaging', async () => {
      const messages = [];
      const subscription = communication.subscribeToChannel('test-channel', (message) => {
        messages.push(message);
      });

      communication.publish('test-channel', { type: 'test', data: 'message-1' });
      communication.publish('test-channel', { type: 'test', data: 'message-2' });

      // Allow async message delivery
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(messages.length).toBe(2);
      expect(messages[0].data).toBe('message-1');
      expect(messages[1].data).toBe('message-2');

      subscription.unsubscribe();
    });

    it('should create and coordinate test barriers', async () => {
      const barrier = communication.createBarrier('test-barrier', 3, 5000);
      
      // Simulate other tests reaching the barrier
      setTimeout(() => communication.createBarrier('test-barrier', 3, 5000), 100);
      setTimeout(() => communication.createBarrier('test-barrier', 3, 5000), 200);

      const result = await barrier;
      expect(result).toBe(true);
    });

    it('should share fixtures between tests', async () => {
      const fixtureKey = await communication.shareFixture(
        'shared-template',
        '{{ name }} - {{ value }}',
        { type: 'nunjucks', version: '1.0' }
      );

      expect(fixtureKey).toBe('fixture:shared-template');
      
      const retrievedFixture = communication.getFixture('shared-template');
      expect(retrievedFixture).toBe('{{ name }} - {{ value }}');

      const fixtures = communication.listFixtures();
      expect(fixtures.length).toBe(1);
      expect(fixtures[0].name).toBe('shared-template');
    });

    it('should aggregate test results', async () => {
      await communication.reportTestResult('test-1', { success: true, duration: 100 });
      await communication.reportTestResult('test-2', { success: false, duration: 200, error: 'Test failed' });
      await communication.reportTestResult('test-3', { success: true, duration: 150 });

      const aggregateResults = communication.getTestResults();
      expect(aggregateResults.total).toBe(3);
      expect(aggregateResults.passed).toBe(2);
      expect(aggregateResults.failed).toBe(1);
      expect(aggregateResults.results.length).toBe(3);
    });
  });

  describe('Enhanced mocking framework', () => {
    it('should create and track mock interactions', () => {
      const repository = mockFramework.createMock('UserRepository', {
        save: { returnValue: { id: '123' } },
        findById: { implementation: (id) => ({ id, name: 'User' }) },
        delete: { returnValue: true }
      });

      const result = repository.save({ name: 'John' });
      expect(result).toEqual({ id: '123' });

      const user = repository.findById('123');
      expect(user).toEqual({ id: '123', name: 'User' });

      expect(repository._hasBeenCalled('save')).toBe(true);
      expect(repository._hasBeenCalledWith('save', { name: 'John' })).toBe(true);
      expect(repository._hasBeenCalledTimes('save', 1)).toBe(true);
    });

    it('should verify mock expectations', () => {
      const service = mockFramework.createMock('NotificationService', {
        sendEmail: { returnValue: true },
        sendSms: { returnValue: true }
      });

      mockFramework.expect('NotificationService', 'sendEmail')
        .toBeCalledWith('user@example.com', 'Welcome!')
        .toBeCalledTimes(1);

      service.sendEmail('user@example.com', 'Welcome!');

      expect(() => mockFramework.verifyMock('NotificationService')).not.toThrow();
    });

    it('should verify interaction order', () => {
      const repository = mockFramework.createMock('Repository', {
        connect: { returnValue: true },
        query: { returnValue: [] },
        disconnect: { returnValue: true }
      });

      repository.connect();
      repository.query('SELECT * FROM users');
      repository.disconnect();

      expect(() => mockFramework.verifyInteractionOrder(
        { mockName: 'Repository', methodName: 'connect' },
        { mockName: 'Repository', methodName: 'query' },
        { mockName: 'Repository', methodName: 'disconnect' }
      )).not.toThrow();
    });

    it('should handle async mock methods', async () => {
      const asyncService = mockFramework.createMock('AsyncService', {
        fetchData: { 
          async: true,
          implementation: async (id) => ({ id, data: 'async result' })
        }
      });

      const result = await asyncService.fetchData('123');
      expect(result).toEqual({ id: '123', data: 'async result' });
      
      expect(asyncService._hasBeenCalledWith('fetchData', '123')).toBe(true);
    });

    it('should create spies on existing objects', () => {
      const realObject = {
        calculate: (a, b) => a + b,
        format: (value) => `Result: ${value}`
      };

      const spy = mockFramework.spy(realObject, 'calculate');
      
      const result = realObject.calculate(2, 3);
      expect(result).toBe(5);
      
      expect(spy._hasBeenCalledWith('calculate', 2, 3)).toBe(true);
      
      spy._restore();
      expect(typeof realObject.calculate).toBe('function');
    });

    it('should track comprehensive statistics', () => {
      const mock1 = mockFramework.createMock('Mock1', {
        method1: { returnValue: 'result1' },
        method2: { returnValue: 'result2' }
      });

      const mock2 = mockFramework.createMock('Mock2', {
        method3: { returnValue: 'result3' }
      });

      mock1.method1();
      mock1.method1();
      mock1.method2();
      mock2.method3();

      const stats = mockFramework.getStats();
      expect(stats.totalMocks).toBe(2);
      expect(stats.totalCalls).toBe(4);
      
      const mock1Stats = stats.mocks.find(m => m.name === 'Mock1');
      expect(mock1Stats.totalCalls).toBe(3);
      expect(mock1Stats.methods.find(m => m.methodName === 'method1').callCount).toBe(2);
    });
  });

  describe('Integration testing', () => {
    it('should coordinate all infrastructure components', async () => {
      // Create test environment
      const envId = await envManager.createEnvironment('integration-test');
      
      // Setup shared data
      await globalCommunication.setSharedData('integration-config', {
        testMode: true,
        timeout: 1000
      });

      // Create mocks
      const apiClient = mockFramework.createMock('ApiClient', {
        get: { async: true, returnValue: { data: 'test' } },
        post: { async: true, returnValue: { id: '123' } }
      });

      // Run property-based test with async operations
      const result = await propertyHelper.runProperty(
        async ({ endpoint, data }) => {
          const response = await asyncHelper.withTimeout(
            () => apiClient.get(endpoint),
            1000,
            'api-call'
          );
          return response.data === 'test';
        },
        require('fast-check').record({
          endpoint: require('fast-check').webUrl(),
          data: require('fast-check').object()
        }),
        { numRuns: 10 }
      );

      expect(result.success).toBe(true);
      
      // Verify mock interactions
      expect(apiClient._hasBeenCalled('get')).toBe(true);
      
      // Check shared data
      const config = globalCommunication.getSharedData('integration-config');
      expect(config.testMode).toBe(true);

      // Cleanup
      await envManager.cleanupEnvironment(envId);
    });

    it('should handle complex error scenarios gracefully', async () => {
      const errorScenarios = [
        { type: 'timeout', delay: 2000 },
        { type: 'network', error: new Error('Network error') },
        { type: 'validation', error: new Error('Validation failed') }
      ];

      for (const scenario of errorScenarios) {
        try {
          if (scenario.type === 'timeout') {
            await asyncHelper.withTimeout(
              () => new Promise(resolve => setTimeout(resolve, scenario.delay)),
              1000,
              `${scenario.type}-test`
            );
          } else {
            throw scenario.error;
          }
        } catch (error) {
          expect(error).toBeDefined();
          
          // Error should be properly handled and logged
          const stats = asyncHelper.getStats();
          if (scenario.type === 'timeout') {
            expect(stats.timeoutOperations).toBeGreaterThan(0);
          }
        }
      }
    });
  });
});