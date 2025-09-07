import { vi } from 'vitest';
import consola from 'consola';
import path from 'path';

// Global test setup for vitest-cucumber BDD framework
// Configure test environment for CLI and MCP integration testing

// Suppress console output during tests unless explicitly needed
consola.level = -1;

// Mock environment variables for consistent testing
process.env.NODE_ENV = 'test';
process.env.UNJUCKS_CONFIG_DIR = './tests/fixtures/config';
process.env.UNJUCKS_TEMPLATES_DIR = './tests/fixtures/templates';
process.env.CLAUDE_FLOW_MCP_URL = 'http://localhost:3000';

// Global test utilities
declare global {
  var testUtils: {
    cleanupFiles: () => Promise<void>;
    mockMCPResponse: (method: string, response: any) => void;
    resetMCPMocks: () => void;
    createTempDir: () => Promise<string>;
    removeTempDir: (dir: string) => Promise<void>;
    createMockTemplate: (generator: string, template: string, content: string) => Promise<void>;
    setupMCPServer: () => Promise<void>;
    teardownMCPServer: () => Promise<void>;
    validateGeneratedCode: (filePath: string, expectations: string[]) => Promise<boolean>;
    measurePerformance: (operation: () => Promise<any>) => Promise<{ duration: number; memory: number }>;
  };
}

// Initialize global test utilities
globalThis.testUtils = {
  cleanupFiles: async () => {
    // Clean up test-generated files
    const fs = await import('fs/promises');
    
    const testPatterns = [
      './test-output',
      './temp-test-*',
      './.temp-*',
      './generated',
      './*.test.ts',
      './*.test.tsx',
      './*.spec.ts',
      './src/components/**/generated-*',
      './migration-plan.md',
      './performance-report.json'
    ];
    
    for (const pattern of testPatterns) {
      try {
        if (pattern.includes('*')) {
          const { glob } = await import('glob');
          const matches = await glob(pattern);
          for (const match of matches) {
            await fs.rm(match, { recursive: true, force: true });
          }
        } else {
          await fs.rm(pattern, { recursive: true, force: true });
        }
      } catch (error) {
        // Ignore cleanup errors - files might not exist
      }
    }
  },

  mockMCPResponse: (method: string, response: any) => {
    // Mock MCP tool responses for testing
    vi.mock('../../src/lib/mcp-integration', () => ({
      sendMCPRequest: vi.fn().mockImplementation(async (request) => {
        if (request.method === method) {
          return { 
            jsonrpc: '2.0',
            id: request.id,
            result: response 
          };
        }
        return {
          jsonrpc: '2.0',
          id: request.id,
          error: {
            code: -32601,
            message: `Method not found: ${request.method}`
          }
        };
      })
    }));
  },

  resetMCPMocks: () => {
    vi.clearAllMocks();
    vi.resetAllMocks();
    vi.unstubAllGlobals();
  },

  createTempDir: async () => {
    const fs = await import('fs/promises');
    const tempDir = path.join(process.cwd(), `.temp-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
    await fs.mkdir(tempDir, { recursive: true });
    return tempDir;
  },

  removeTempDir: async (dir: string) => {
    const fs = await import('fs/promises');
    try {
      await fs.rm(dir, { recursive: true, force: true });
    } catch (error) {
      // Directory might not exist or already be deleted
    }
  },

  createMockTemplate: async (generator: string, template: string, content: string) => {
    const fs = await import('fs/promises');
    const templateDir = path.join('_templates', generator);
    await fs.mkdir(templateDir, { recursive: true });
    await fs.writeFile(path.join(templateDir, template), content);
  },

  setupMCPServer: async () => {
    // Mock MCP server setup for integration tests
    globalThis.mockMCPServer = {
      connected: true,
      tools: [
        'unjucks_generate',
        'unjucks_list', 
        'unjucks_help',
        'unjucks_semantic_generate',
        'unjucks_semantic_validate',
        'unjucks_reasoning_apply',
        'unjucks_knowledge_query',
        'swarm_init',
        'task_orchestrate',
        'swarm_status'
      ]
    };
  },

  teardownMCPServer: async () => {
    // Clean up mock MCP server
    delete globalThis.mockMCPServer;
  },

  validateGeneratedCode: async (filePath: string, expectations: string[]) => {
    try {
      const fs = await import('fs/promises');
      const content = await fs.readFile(filePath, 'utf8');
      
      return expectations.every(expectation => {
        if (expectation.startsWith('!')) {
          // Negative expectation - should NOT contain
          return !content.includes(expectation.slice(1));
        }
        return content.includes(expectation);
      });
    } catch (error) {
      return false;
    }
  },

  measurePerformance: async (operation: () => Promise<any>) => {
    const startTime = process.hrtime.bigint();
    const startMemory = process.memoryUsage().heapUsed;
    
    await operation();
    
    const endTime = process.hrtime.bigint();
    const endMemory = process.memoryUsage().heapUsed;
    
    return {
      duration: Number(endTime - startTime) / 1_000_000, // Convert to milliseconds
      memory: endMemory - startMemory // Memory difference in bytes
    };
  }
};

// Setup and teardown hooks for all tests
beforeEach(async () => {
  globalThis.testUtils.resetMCPMocks();
  await globalThis.testUtils.setupMCPServer();
});

afterEach(async () => {
  await globalThis.testUtils.cleanupFiles();
  await globalThis.testUtils.teardownMCPServer();
});

// Legacy exports for compatibility
export function setupTestEnvironment() {
  console.log("Setting up test environment...");
}

export function cleanupTestEnvironment() {
  console.log("Cleaning up test environment...");
}

export const testHelpers = {
  async delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  cleanMocks() {
    globalThis.testUtils.resetMCPMocks();
  }
};

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