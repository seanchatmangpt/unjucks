// Test setup and utilities for spec-driven BDD testing
import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { tmpdir } from 'os';

// Global test configuration
export const testConfig = {
  timeout: 30000,
  tempDirPrefix: 'spec-driven-test-',
  mockDelayMs: 100,
  qualityThresholds: {
    coverage: 0.8,
    performance: 0.7,
    satisfaction: 0.75
  }
};

// Test utilities class
export class SpecDrivenTestUtils {
  constructor() {
    this.tempDirs = new Set();
    this.mockTimers = [];
    this.testData = new Map();
  }

  // Temporary directory management
  async createTempDir(prefix = testConfig.tempDirPrefix) {
    const tempDir = await fs.mkdtemp(path.join(tmpdir(), prefix));
    this.tempDirs.add(tempDir);
    return tempDir;
  }

  async cleanupTempDirs() {
    for (const tempDir of this.tempDirs) {
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (error) {
        console.warn(`Failed to cleanup temp dir ${tempDir}:`, error.message);
      }
    }
    this.tempDirs.clear();
  }

  // Mock data generators
  generateSpecification(overrides = {}) {
    const baseSpec = {
      id: `spec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: 'TestSpecification',
      description: 'A test specification for BDD testing',
      type: 'feature',
      priority: 'medium',
      complexity: 'medium',
      createdAt: new Date().toISOString(),
      version: 1,
      acceptance: [
        'System should handle user input correctly',
        'System should provide appropriate feedback',
        'System should maintain data integrity'
      ],
      ...overrides
    };

    this.testData.set(baseSpec.id, baseSpec);
    return baseSpec;
  }

  generatePlan(specification, overrides = {}) {
    const basePlan = {
      id: `plan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      specificationId: specification.id,
      name: `Development Plan for ${specification.name}`,
      phases: [
        { name: 'analysis', estimatedDays: 2, dependencies: [] },
        { name: 'design', estimatedDays: 3, dependencies: ['analysis'] },
        { name: 'implementation', estimatedDays: 10, dependencies: ['design'] },
        { name: 'testing', estimatedDays: 5, dependencies: ['implementation'] },
        { name: 'deployment', estimatedDays: 2, dependencies: ['testing'] }
      ],
      totalEstimatedDays: 22,
      createdAt: new Date().toISOString(),
      status: 'draft',
      ...overrides
    };

    this.testData.set(basePlan.id, basePlan);
    return basePlan;
  }

  generateTasks(specification, overrides = {}) {
    const baseTasks = [
      {
        id: `task-${specification.id}-1`,
        name: 'API endpoint development',
        category: 'backend',
        estimatedHours: 8,
        priority: 'high',
        status: 'pending'
      },
      {
        id: `task-${specification.id}-2`,
        name: 'Frontend implementation',
        category: 'frontend',
        estimatedHours: 6,
        priority: 'high',
        status: 'pending'
      },
      {
        id: `task-${specification.id}-3`,
        name: 'Unit testing',
        category: 'testing',
        estimatedHours: 4,
        priority: 'medium',
        status: 'pending'
      }
    ];

    const tasks = baseTasks.map(task => ({ ...task, ...overrides }));
    tasks.forEach(task => this.testData.set(task.id, task));
    return tasks;
  }

  generateWorkflow(requirement, overrides = {}) {
    const baseWorkflow = {
      id: `workflow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      requirement,
      status: 'running',
      startTime: new Date().toISOString(),
      phases: [],
      currentPhase: 0,
      deliverables: {},
      metrics: {},
      ...overrides
    };

    this.testData.set(baseWorkflow.id, baseWorkflow);
    return baseWorkflow;
  }

  generateTeamMembers() {
    return [
      {
        id: 'dev1',
        name: 'Alice Johnson',
        role: 'Backend Developer',
        skills: ['backend', 'database', 'api'],
        maxCapacity: 40,
        currentCapacity: 25,
        preferences: ['backend', 'architecture']
      },
      {
        id: 'dev2',
        name: 'Bob Smith',
        role: 'Frontend Developer',
        skills: ['frontend', 'react', 'css'],
        maxCapacity: 35,
        currentCapacity: 20,
        preferences: ['frontend', 'ui']
      },
      {
        id: 'dev3',
        name: 'Carol Davis',
        role: 'Full Stack Developer',
        skills: ['backend', 'frontend', 'testing'],
        maxCapacity: 40,
        currentCapacity: 30,
        preferences: ['testing', 'integration']
      },
      {
        id: 'qa1',
        name: 'David Wilson',
        role: 'QA Engineer',
        skills: ['testing', 'automation', 'performance'],
        maxCapacity: 40,
        currentCapacity: 15,
        preferences: ['automation', 'performance']
      }
    ];
  }

  // Assertion helpers
  assertSpecificationValid(specification) {
    expect(specification).toBeDefined();
    expect(specification.id).toBeDefined();
    expect(specification.name).toBeDefined();
    expect(specification.description).toBeDefined();
    expect(specification.type).toBeOneOf(['feature', 'bug', 'enhancement']);
    expect(specification.createdAt).toBeDefined();
    expect(specification.version).toBeGreaterThan(0);
  }

  assertPlanValid(plan) {
    expect(plan).toBeDefined();
    expect(plan.id).toBeDefined();
    expect(plan.specificationId).toBeDefined();
    expect(plan.phases).toBeDefined();
    expect(Array.isArray(plan.phases)).toBe(true);
    expect(plan.totalEstimatedDays).toBeGreaterThan(0);
    
    plan.phases.forEach(phase => {
      expect(phase.name).toBeDefined();
      expect(phase.estimatedDays).toBeGreaterThan(0);
      expect(Array.isArray(phase.dependencies)).toBe(true);
    });
  }

  assertTasksValid(tasks) {
    expect(Array.isArray(tasks)).toBe(true);
    expect(tasks.length).toBeGreaterThan(0);

    tasks.forEach(task => {
      expect(task.id).toBeDefined();
      expect(task.name).toBeDefined();
      expect(task.category).toBeDefined();
      expect(task.estimatedHours).toBeGreaterThan(0);
      expect(task.estimatedHours).toBeLessThanOrEqual(16); // Should be properly sized
      expect(task.status).toBeOneOf(['pending', 'in_progress', 'completed']);
    });
  }

  assertWorkflowValid(workflow) {
    expect(workflow).toBeDefined();
    expect(workflow.id).toBeDefined();
    expect(workflow.requirement).toBeDefined();
    expect(workflow.status).toBeOneOf(['running', 'completed', 'failed', 'blocked']);
    expect(workflow.startTime).toBeDefined();
    expect(Array.isArray(workflow.phases)).toBe(true);
  }

  assertQualityMetrics(metrics) {
    expect(metrics).toBeDefined();
    
    if (metrics.coverage !== undefined) {
      expect(metrics.coverage).toBeGreaterThanOrEqual(testConfig.qualityThresholds.coverage);
    }
    
    if (metrics.performance !== undefined) {
      expect(metrics.performance).toBeGreaterThanOrEqual(testConfig.qualityThresholds.performance);
    }
    
    if (metrics.satisfaction !== undefined) {
      expect(metrics.satisfaction).toBeGreaterThanOrEqual(testConfig.qualityThresholds.satisfaction);
    }
  }

  // Mock time and delay utilities
  async simulateAsyncWork(delayMs = testConfig.mockDelayMs) {
    return new Promise(resolve => {
      const timer = setTimeout(resolve, delayMs);
      this.mockTimers.push(timer);
    });
  }

  clearMockTimers() {
    this.mockTimers.forEach(timer => clearTimeout(timer));
    this.mockTimers = [];
  }

  // File system test helpers
  async createTestFile(filePath, content) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, 'utf-8');
    return filePath;
  }

  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async readTestFile(filePath) {
    try {
      return await fs.readFile(filePath, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to read test file ${filePath}: ${error.message}`);
    }
  }

  // Test data management
  getTestData(id) {
    return this.testData.get(id);
  }

  setTestData(id, data) {
    this.testData.set(id, data);
  }

  clearTestData() {
    this.testData.clear();
  }

  // Performance testing helpers
  measureExecutionTime(fn) {
    const start = performance.now();
    const result = fn();
    const end = performance.now();
    
    return {
      result,
      executionTime: end - start,
      withinThreshold: (end - start) < 1000 // 1 second threshold
    };
  }

  async measureAsyncExecutionTime(asyncFn) {
    const start = performance.now();
    const result = await asyncFn();
    const end = performance.now();
    
    return {
      result,
      executionTime: end - start,
      withinThreshold: (end - start) < 5000 // 5 second threshold for async
    };
  }

  // Memory usage monitoring
  getMemoryUsage() {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const usage = process.memoryUsage();
      return {
        heapUsed: usage.heapUsed / 1024 / 1024, // MB
        heapTotal: usage.heapTotal / 1024 / 1024, // MB
        external: usage.external / 1024 / 1024, // MB
        rss: usage.rss / 1024 / 1024 // MB
      };
    }
    return null;
  }

  // Validation helpers
  validateJSON(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      return { valid: true, data: parsed };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  validateYAML(yamlString) {
    // Simple YAML validation (would use a real YAML parser in production)
    try {
      const lines = yamlString.split('\n');
      const hasValidStructure = lines.some(line => line.includes(':'));
      return { valid: hasValidStructure };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  // Error simulation
  simulateError(errorType = 'generic', message = 'Simulated error') {
    const errors = {
      validation: () => new Error(`Validation Error: ${message}`),
      network: () => new Error(`Network Error: ${message}`),
      timeout: () => new Error(`Timeout Error: ${message}`),
      permission: () => new Error(`Permission Error: ${message}`),
      generic: () => new Error(message)
    };

    const errorConstructor = errors[errorType] || errors.generic;
    throw errorConstructor();
  }

  // Cleanup method
  async cleanup() {
    await this.cleanupTempDirs();
    this.clearMockTimers();
    this.clearTestData();
  }
}

// Global test utilities instance
export const testUtils = new SpecDrivenTestUtils();

// Global setup and teardown
beforeAll(async () => {
  console.log('Setting up spec-driven BDD test environment...');
});

afterAll(async () => {
  console.log('Cleaning up spec-driven BDD test environment...');
  await testUtils.cleanup();
});

beforeEach(() => {
  // Reset test state before each test
  testUtils.clearTestData();
});

afterEach(async () => {
  // Cleanup after each test
  testUtils.clearMockTimers();
});

// Custom matchers
expect.extend({
  toBeValidSpecification(received) {
    try {
      testUtils.assertSpecificationValid(received);
      return {
        message: () => `Expected specification to be invalid`,
        pass: true
      };
    } catch (error) {
      return {
        message: () => `Expected specification to be valid: ${error.message}`,
        pass: false
      };
    }
  },

  toBeValidPlan(received) {
    try {
      testUtils.assertPlanValid(received);
      return {
        message: () => `Expected plan to be invalid`,
        pass: true
      };
    } catch (error) {
      return {
        message: () => `Expected plan to be valid: ${error.message}`,
        pass: false
      };
    }
  },

  toBeValidTaskList(received) {
    try {
      testUtils.assertTasksValid(received);
      return {
        message: () => `Expected task list to be invalid`,
        pass: true
      };
    } catch (error) {
      return {
        message: () => `Expected task list to be valid: ${error.message}`,
        pass: false
      };
    }
  },

  toBeValidWorkflow(received) {
    try {
      testUtils.assertWorkflowValid(received);
      return {
        message: () => `Expected workflow to be invalid`,
        pass: true
      };
    } catch (error) {
      return {
        message: () => `Expected workflow to be valid: ${error.message}`,
        pass: false
      };
    }
  },

  toMeetQualityThresholds(received) {
    try {
      testUtils.assertQualityMetrics(received);
      return {
        message: () => `Expected metrics to not meet quality thresholds`,
        pass: true
      };
    } catch (error) {
      return {
        message: () => `Expected metrics to meet quality thresholds: ${error.message}`,
        pass: false
      };
    }
  },

  toBeOneOf(received, array) {
    const pass = array.includes(received);
    if (pass) {
      return {
        message: () => `Expected ${received} not to be one of ${array.join(', ')}`,
        pass: true
      };
    } else {
      return {
        message: () => `Expected ${received} to be one of ${array.join(', ')}`,
        pass: false
      };
    }
  }
});

// Export test configuration and utilities
export default {
  testConfig,
  testUtils,
  SpecDrivenTestUtils
};