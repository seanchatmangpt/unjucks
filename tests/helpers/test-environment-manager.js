/**
 * Test environment manager for setup and teardown automation
 * Provides comprehensive environment management for reliable testing
 */

import fs from 'fs-extra';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { EventEmitter } from 'events';
import { TestHelper } from './test-helper.js';
import { FileTestHelper } from './file-test-helper.js';
import { AsyncTestHelper } from './async-test-helper.js';

export class TestEnvironmentManager extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      cleanupOnExit: options.cleanupOnExit !== false,
      isolateTests: options.isolateTests !== false,
      preserveState: options.preserveState || false,
      maxEnvironments: options.maxEnvironments || 10,
      autoCleanup: options.autoCleanup !== false,
      setupTimeout: options.setupTimeout || 30000,
      teardownTimeout: options.teardownTimeout || 15000,
      ...options
    };
    
    this.environments = new Map();
    this.activeSetups = new Set();
    this.globalResources = new Map();
    this.setupHooks = [];
    this.teardownHooks = [];
    this.cleanupQueue = [];
    
    // Auto-cleanup on process exit
    if (this.options.cleanupOnExit) {
      process.on('exit', () => this.syncCleanupAll());
      process.on('SIGINT', () => this.handleExit());
      process.on('SIGTERM', () => this.handleExit());
    }
  }

  /**
   * Create a new test environment
   */
  async createEnvironment(testName, config = {}) {
    const environmentId = this.generateEnvironmentId(testName);
    
    if (this.environments.has(environmentId)) {
      throw new Error(`Environment already exists: ${environmentId}`);
    }

    const environment = {
      id: environmentId,
      testName,
      config: { ...this.options, ...config },
      testHelper: new TestHelper(),
      fileHelper: new FileTestHelper(),
      asyncHelper: new AsyncTestHelper(),
      resources: new Map(),
      fixtures: new Map(),
      state: 'creating',
      startTime: this.getDeterministicTimestamp(),
      tempDirs: new Set(),
      processes: new Set(),
      cleanup: []
    };

    this.environments.set(environmentId, environment);
    this.activeSetups.add(environmentId);

    try {
      await this.setupEnvironment(environment);
      environment.state = 'ready';
      this.activeSetups.delete(environmentId);
      
      this.emit('environmentCreated', { environmentId, testName });
      return environmentId;
    } catch (error) {
      this.activeSetups.delete(environmentId);
      await this.cleanupEnvironment(environmentId);
      throw new Error(`Failed to create environment for ${testName}: ${error.message}`);
    }
  }

  /**
   * Setup environment with all necessary resources
   */
  async setupEnvironment(environment) {
    const { asyncHelper } = environment;
    
    // Run pre-setup hooks
    for (const hook of this.setupHooks) {
      await asyncHelper.withTimeout(
        () => hook(environment),
        this.options.setupTimeout,
        `setup-hook-${hook.name}`
      );
    }

    // Create temporary workspace
    const workspace = await this.createWorkspace(environment);
    environment.resources.set('workspace', workspace);

    // Setup test helpers
    await environment.testHelper.changeToTempDir();
    environment.tempDirs.add(environment.testHelper.tempDir);

    // Create fixture directories
    await this.setupFixtures(environment);

    // Setup shared resources
    await this.setupSharedResources(environment);

    // Create isolation if needed
    if (environment.config.isolateTests) {
      await this.setupIsolation(environment);
    }

    this.emit('environmentSetup', { environmentId: environment.id });
  }

  /**
   * Create workspace for test environment
   */
  async createWorkspace(environment) {
    const workspaceId = `${environment.testName}-${this.getDeterministicTimestamp()}-${Math.random().toString(36).substring(2)}`;
    const workspacePath = path.join(tmpdir(), 'unjucks-test-env', workspaceId);
    
    await fs.ensureDir(workspacePath);
    environment.tempDirs.add(workspacePath);
    
    // Create standard directories
    const standardDirs = ['_templates', 'src', 'tests', 'fixtures', 'output'];
    for (const dir of standardDirs) {
      await fs.ensureDir(path.join(workspacePath, dir));
    }
    
    return workspacePath;
  }

  /**
   * Setup test fixtures
   */
  async setupFixtures(environment) {
    const fixturesDir = path.join(environment.resources.get('workspace'), 'fixtures');
    
    // Copy standard fixtures
    const standardFixtures = {
      'sample-template.njk': `---
to: "{{ name | kebabCase }}.js"
---
export const {{ name | camelCase }} = {
  name: '{{ name }}',
  version: '{{ version || "1.0.0" }}'
};`,
      
      'package.json': JSON.stringify({
        name: 'test-package',
        version: '1.0.0',
        type: 'module'
      }, null, 2),
      
      'config.json': JSON.stringify({
        templatesDir: '_templates',
        outputDir: 'src'
      }, null, 2)
    };
    
    for (const [filename, content] of Object.entries(standardFixtures)) {
      const fixturePath = path.join(fixturesDir, filename);
      await fs.writeFile(fixturePath, content);
      environment.fixtures.set(filename, fixturePath);
    }
  }

  /**
   * Setup shared resources across environments
   */
  async setupSharedResources(environment) {
    if (environment.config.useSharedResources) {
      // Setup shared mock MCP server
      if (!this.globalResources.has('mockMcpServer')) {
        const mockServer = await this.createMockMcpServer();
        this.globalResources.set('mockMcpServer', mockServer);
      }
      
      environment.resources.set('mockMcpServer', this.globalResources.get('mockMcpServer'));
    }
  }

  /**
   * Setup test isolation
   */
  async setupIsolation(environment) {
    // Isolate environment variables
    environment.originalEnv = { ...process.env };
    environment.cleanup.push(() => {
      Object.keys(process.env).forEach(key => {
        if (!(key in environment.originalEnv)) {
          delete process.env[key];
        }
      });
      Object.assign(process.env, environment.originalEnv);
    });

    // Isolate current working directory
    environment.originalCwd = process.cwd();
    process.chdir(environment.resources.get('workspace'));
    environment.cleanup.push(() => {
      process.chdir(environment.originalCwd);
    });
  }

  /**
   * Get environment by ID
   */
  getEnvironment(environmentId) {
    const environment = this.environments.get(environmentId);
    if (!environment) {
      throw new Error(`Environment not found: ${environmentId}`);
    }
    return environment;
  }

  /**
   * Get all active environments
   */
  getActiveEnvironments() {
    return Array.from(this.environments.values())
      .filter(env => env.state === 'ready');
  }

  /**
   * Add fixture to environment
   */
  async addFixture(environmentId, name, content, options = {}) {
    const environment = this.getEnvironment(environmentId);
    const { fileType = 'text', encoding = 'utf8' } = options;
    
    const fixturesDir = path.join(environment.resources.get('workspace'), 'fixtures');
    const fixturePath = path.join(fixturesDir, name);
    
    await fs.ensureDir(path.dirname(fixturePath));
    
    if (fileType === 'json') {
      await fs.writeJson(fixturePath, content, { spaces: 2 });
    } else {
      await fs.writeFile(fixturePath, content, encoding);
    }
    
    environment.fixtures.set(name, fixturePath);
    return fixturePath;
  }

  /**
   * Get fixture path
   */
  getFixture(environmentId, name) {
    const environment = this.getEnvironment(environmentId);
    return environment.fixtures.get(name);
  }

  /**
   * Create shared state between tests
   */
  setSharedState(key, value) {
    this.globalResources.set(`state:${key}`, value);
  }

  /**
   * Get shared state
   */
  getSharedState(key) {
    return this.globalResources.get(`state:${key}`);
  }

  /**
   * Add setup hook
   */
  addSetupHook(hook) {
    this.setupHooks.push(hook);
  }

  /**
   * Add teardown hook
   */
  addTeardownHook(hook) {
    this.teardownHooks.push(hook);
  }

  /**
   * Cleanup environment
   */
  async cleanupEnvironment(environmentId) {
    const environment = this.environments.get(environmentId);
    if (!environment) {
      return; // Already cleaned up
    }

    environment.state = 'cleaning';
    
    try {
      // Run teardown hooks
      for (const hook of this.teardownHooks) {
        try {
          await environment.asyncHelper.withTimeout(
            () => hook(environment),
            this.options.teardownTimeout,
            `teardown-hook-${hook.name}`
          );
        } catch (error) {
          console.warn(`Teardown hook failed: ${error.message}`);
        }
      }

      // Run environment-specific cleanup
      for (const cleanupFn of environment.cleanup) {
        try {
          await cleanupFn();
        } catch (error) {
          console.warn(`Environment cleanup failed: ${error.message}`);
        }
      }

      // Cleanup helpers
      await environment.testHelper.destroy();
      await environment.fileHelper.cleanup();
      await environment.asyncHelper.cleanup();

      // Clean up temporary directories
      for (const tempDir of environment.tempDirs) {
        try {
          await fs.remove(tempDir);
        } catch (error) {
          console.warn(`Failed to remove temp directory: ${tempDir}`);
        }
      }

      // Kill any remaining processes
      for (const process of environment.processes) {
        try {
          process.kill('SIGTERM');
        } catch (error) {
          console.warn(`Failed to kill process: ${error.message}`);
        }
      }

      this.emit('environmentCleaned', { environmentId });
    } finally {
      this.environments.delete(environmentId);
    }
  }

  /**
   * Cleanup all environments
   */
  async cleanupAll() {
    const cleanupPromises = Array.from(this.environments.keys()).map(id => 
      this.cleanupEnvironment(id)
    );

    await Promise.allSettled(cleanupPromises);

    // Clean up global resources
    for (const [key, resource] of this.globalResources) {
      if (resource && typeof resource.cleanup === 'function') {
        try {
          await resource.cleanup();
        } catch (error) {
          console.warn(`Failed to cleanup global resource ${key}: ${error.message}`);
        }
      }
    }
    this.globalResources.clear();
  }

  /**
   * Synchronous cleanup for process exit
   */
  syncCleanupAll() {
    for (const environment of this.environments.values()) {
      // Best effort synchronous cleanup
      for (const tempDir of environment.tempDirs) {
        try {
          fs.removeSync(tempDir);
        } catch (error) {
          // Ignore errors during exit cleanup
        }
      }
    }
  }

  /**
   * Handle process exit
   */
  async handleExit() {
    await this.cleanupAll();
    process.exit(0);
  }

  /**
   * Generate unique environment ID
   */
  generateEnvironmentId(testName) {
    const sanitized = testName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
    const timestamp = this.getDeterministicTimestamp();
    const random = Math.random().toString(36).substring(2, 8);
    return `${sanitized}-${timestamp}-${random}`;
  }

  /**
   * Create mock MCP server for testing
   */
  async createMockMcpServer() {
    // This would be implemented based on your MCP server needs
    return {
      port: 3000 + Math.floor(Math.random() * 1000),
      cleanup: async () => {
        // Cleanup server resources
      }
    };
  }

  /**
   * Get environment statistics
   */
  getStats() {
    const environments = Array.from(this.environments.values());
    
    return {
      totalEnvironments: environments.length,
      activeEnvironments: environments.filter(e => e.state === 'ready').length,
      creatingEnvironments: this.activeSetups.size,
      cleaningEnvironments: environments.filter(e => e.state === 'cleaning').length,
      averageSetupTime: this.calculateAverageSetupTime(environments),
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime()
    };
  }

  /**
   * Calculate average setup time
   */
  calculateAverageSetupTime(environments) {
    const readyEnvironments = environments.filter(e => e.state === 'ready');
    if (readyEnvironments.length === 0) return 0;
    
    const totalTime = readyEnvironments.reduce((sum, env) => 
      sum + (this.getDeterministicTimestamp() - env.startTime), 0
    );
    
    return totalTime / readyEnvironments.length;
  }
}

/**
 * Global environment manager instance
 */
export const globalEnvironmentManager = new TestEnvironmentManager();

/**
 * Create environment for test
 */
export async function createTestEnvironment(testName, config = {}) {
  return globalEnvironmentManager.createEnvironment(testName, config);
}

/**
 * Cleanup test environment
 */
export async function cleanupTestEnvironment(environmentId) {
  return globalEnvironmentManager.cleanupEnvironment(environmentId);
}

/**
 * Get environment helpers
 */
export function getTestHelpers(environmentId) {
  const environment = globalEnvironmentManager.getEnvironment(environmentId);
  return {
    testHelper: environment.testHelper,
    fileHelper: environment.fileHelper,
    asyncHelper: environment.asyncHelper,
    workspace: environment.resources.get('workspace'),
    fixtures: environment.fixtures
  };
}

/**
 * Setup hooks for common test scenarios
 */
export const CommonSetupHooks = {
  /**
   * Setup MCP client mock
   */
  setupMcpClientMock: async (environment) => {
    const { MockMCPClient } = await import('../mocks/mcp-client.mock.js');
    const mockClient = new MockMCPClient({ latency: 10, errorRate: 0 });
    await mockClient.connect();
    environment.resources.set('mcpClient', mockClient);
    environment.cleanup.push(() => mockClient.disconnect());
  },

  /**
   * Setup template generation environment
   */
  setupTemplateEnvironment: async (environment) => {
    const workspace = environment.resources.get('workspace');
    const templatesDir = path.join(workspace, '_templates');
    
    // Create sample generator
    await fs.ensureDir(path.join(templatesDir, 'component'));
    await fs.writeFile(
      path.join(templatesDir, 'component', 'index.js.njk'),
      `---
to: "{{ name | kebabCase }}.js"
---
export const {{ name | camelCase }} = '{{ name }}';`
    );
  },

  /**
   * Setup performance monitoring
   */
  setupPerformanceMonitoring: async (environment) => {
    const startTime = this.getDeterministicTimestamp();
    environment.resources.set('performanceStart', startTime);
    
    environment.cleanup.push(() => {
      const duration = this.getDeterministicTimestamp() - startTime;
      console.log(`Test ${environment.testName} took ${duration}ms`);
    });
  }
};

export default TestEnvironmentManager;