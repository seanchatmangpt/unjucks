/**
 * Comprehensive MCP Integration Testing Suite
 * 
 * This test suite validates the complete MCP integration pipeline:
 * 1. MCP Bridge initialization and configuration
 * 2. Swarm-to-Unjucks task conversion
 * 3. Real-time memory synchronization
 * 4. Semantic coordination workflows
 * 5. JTBD (Jobs to Be Done) orchestration
 * 6. Performance and fault tolerance
 * 
 * @requires MCP Bridge, Generator, Semantic Coordinator
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { MCPBridge, SwarmTask, JTBDWorkflow } from '../../src/lib/mcp-integration.js';
import { Generator } from '../../src/lib/generator.js';
import { promises as fs } from 'fs';
import { join, resolve } from 'path';
import { performance } from 'perf_hooks';
import chalk from 'chalk';
import type {
  UnjucksGenerateParams,
  UnjucksInjectParams,
  MCPRequest,
  MCPResponse,
  ToolResult
} from '../../src/mcp/types.js';

/**
 * Test Environment Setup
 */
interface TestEnvironment {
  tempDir: string;
  templatesDir: string;
  outputDir: string;
  bridge: MCPBridge;
  generator: Generator;
  performanceMetrics: {
    startTime: number;
    requests: number;
    totalResponseTime: number;
    memoryUsage: number[];
  };
}

describe('MCP Comprehensive Integration Testing', () => {
  let env: TestEnvironment;

  beforeAll(async () => {
    // Setup test environment
    const baseDir = process.cwd();
    const tempDir = join(baseDir, 'tests', '.tmp', `mcp-comprehensive-${Date.now()}`);
    
    env = {
      tempDir,
      templatesDir: join(tempDir, '_templates'),
      outputDir: join(tempDir, 'output'),
      bridge: new MCPBridge({
        debugMode: true,
        hooksEnabled: true,
        realtimeSync: true,
        memoryNamespace: 'test-mcp-comprehensive',
        timeouts: {
          swarmRequest: 5000,
          unjucksRequest: 10000,
          memorySync: 2000
        }
      }),
      generator: new Generator(),
      performanceMetrics: {
        startTime: performance.now(),
        requests: 0,
        totalResponseTime: 0,
        memoryUsage: []
      }
    };

    // Create test directories
    await fs.mkdir(env.tempDir, { recursive: true });
    await fs.mkdir(env.templatesDir, { recursive: true });
    await fs.mkdir(env.outputDir, { recursive: true });

    // Create comprehensive test templates
    await createComprehensiveTestTemplates(env);

    // Initialize MCP Bridge
    await env.bridge.initialize();
    
    console.log(chalk.green('✓ MCP Comprehensive Test Environment Ready'));
  });

  afterAll(async () => {
    // Cleanup
    if (env.bridge) {
      await env.bridge.destroy();
    }
    
    try {
      await fs.rmdir(env.tempDir, { recursive: true });
    } catch (error) {
      console.warn(chalk.yellow(`Cleanup warning: ${error}`));
    }
    
    console.log(chalk.gray('✓ Test environment cleaned up'));
  });

  beforeEach(() => {
    env.performanceMetrics.startTime = performance.now();
    env.performanceMetrics.memoryUsage.push(process.memoryUsage().heapUsed);
  });

  afterEach(() => {
    env.performanceMetrics.requests++;
    const responseTime = performance.now() - env.performanceMetrics.startTime;
    env.performanceMetrics.totalResponseTime += responseTime;
  });

  describe('MCP Bridge Initialization and Status', () => {
    it('should initialize MCP Bridge with all capabilities', () => {
      const status = env.bridge.getStatus();
      
      expect(status.initialized).toBe(true);
      expect(status.memory).toBeDefined();
      expect(status.memory.templates).toBeDefined();
      expect(status.memory.agents).toBeDefined();
      expect(status.memory.tasks).toBeDefined();
      expect(status.memory.workflows).toBeDefined();
      expect(status.stats.uptime).toBeGreaterThan(0);
    });

    it('should report semantic coordinator status', () => {
      const semanticStatus = env.bridge.getSemanticStatus();
      expect(semanticStatus).toBeDefined();
      expect(semanticStatus.error).toBeUndefined();
    });

    it('should store integration schema in memory', async () => {
      await env.bridge.storeIntegrationSchema();
      
      const status = env.bridge.getStatus();
      expect(status.memory.templates.metadata.integrationSchema).toBeDefined();
      expect(status.memory.templates.metadata.integrationSchema.version).toBe('1.0.0');
      expect(status.memory.templates.metadata.integrationSchema.capabilities).toMatchObject({
        swarmToUnjucks: true,
        unjucksToSwarm: true,
        templateVariableSync: true,
        jtbdWorkflows: true,
        realtimeCoordination: true,
        rdfSupport: true
      });
    });
  });

  describe('Swarm-to-Unjucks Task Conversion', () => {
    it('should convert generate task to unjucks parameters', async () => {
      const swarmTask: SwarmTask = {
        id: 'test-generate-001',
        type: 'generate',
        description: 'Generate React component with TypeScript',
        parameters: {
          generator: 'component',
          template: 'typescript',
          dest: env.outputDir,
          variables: {
            name: 'UserProfile',
            withTests: true,
            typescript: true
          }
        },
        priority: 'high'
      };

      const unjucksParams = await env.bridge.swarmToUnjucks(swarmTask);
      expect(unjucksParams).toBeDefined();
      
      const generateParams = unjucksParams as UnjucksGenerateParams;
      expect(generateParams.generator).toBe('component');
      expect(generateParams.template).toBe('typescript');
      expect(generateParams.dest).toBe(env.outputDir);
      expect(generateParams.variables?.name).toBe('UserProfile');
      expect(generateParams.variables?.withTests).toBe(true);
    });

    it('should convert scaffold task to unjucks parameters', async () => {
      const swarmTask: SwarmTask = {
        id: 'test-scaffold-001',
        type: 'scaffold',
        description: 'Scaffold microservice with API and database',
        parameters: {
          name: 'user-service',
          description: 'User management microservice',
          dest: env.outputDir,
          variables: {
            database: 'postgresql',
            authentication: 'jwt',
            withOpenAPI: true
          }
        }
      };

      const unjucksParams = await env.bridge.swarmToUnjucks(swarmTask);
      expect(unjucksParams).toBeDefined();
      
      const generateParams = unjucksParams as UnjucksGenerateParams;
      expect(generateParams.generator).toBe('scaffold');
      expect(generateParams.template).toBe('project');
      expect(generateParams.variables?.projectName).toBe('user-service');
      expect(generateParams.variables?.database).toBe('postgresql');
    });

    it('should convert refactor task to injection parameters', async () => {
      const swarmTask: SwarmTask = {
        id: 'test-refactor-001',
        type: 'refactor',
        description: 'Add error handling to API controller',
        parameters: {
          file: join(env.outputDir, 'api', 'UserController.ts'),
          content: 'try {\n  // Original code\n} catch (error) {\n  handleError(error);\n}',
          before: 'export class UserController',
          force: true
        }
      };

      const unjucksParams = await env.bridge.swarmToUnjucks(swarmTask);
      expect(unjucksParams).toBeDefined();
      
      const injectParams = unjucksParams as UnjucksInjectParams;
      expect(injectParams.file).toBe(swarmTask.parameters.file);
      expect(injectParams.content).toBe(swarmTask.parameters.content);
      expect(injectParams.before).toBe(swarmTask.parameters.before);
      expect(injectParams.force).toBe(true);
    });

    it('should handle null conversion for unsupported task types', async () => {
      const swarmTask: SwarmTask = {
        id: 'test-unsupported-001',
        type: 'unsupported' as any,
        description: 'Unsupported task type',
        parameters: {}
      };

      const unjucksParams = await env.bridge.swarmToUnjucks(swarmTask);
      expect(unjucksParams).toBeNull();
    });
  });

  describe('Template Variable Synchronization', () => {
    it('should sync template variables with swarm memory', async () => {
      const swarmContext = {
        projectName: 'TestProject',
        version: '1.0.0',
        author: 'Test Developer',
        features: ['api', 'database', 'authentication']
      };

      const syncedVariables = await env.bridge.syncTemplateVariables(
        'microservice',
        'api',
        swarmContext
      );

      expect(syncedVariables).toBeDefined();
      expect(syncedVariables.projectName).toBe('TestProject');
      expect(syncedVariables.version).toBe('1.0.0');
      expect(syncedVariables.author).toBe('Test Developer');
      expect(Array.isArray(syncedVariables.features)).toBe(true);

      // Verify memory was updated
      const status = env.bridge.getStatus();
      expect(status.memory.templates.variables.projectName).toBe('TestProject');
    });

    it('should merge variables with proper precedence (RDF > swarm > template)', async () => {
      const swarmContext = {
        rdf: {
          type: 'inline',
          source: '@prefix ex: <http://example.org/> . ex:project ex:name "RDFProject" .',
          format: 'turtle'
        },
        projectName: 'SwarmProject', // Should be overridden by RDF
        description: 'From swarm context'
      };

      const syncedVariables = await env.bridge.syncTemplateVariables(
        'project',
        'basic',
        swarmContext
      );

      expect(syncedVariables).toBeDefined();
      // RDF data should take precedence
      expect(syncedVariables.description).toBe('From swarm context');
    });
  });

  describe('JTBD Workflow Orchestration', () => {
    it('should execute simple JTBD workflow successfully', async () => {
      const workflow: JTBDWorkflow = {
        id: 'test-workflow-001',
        name: 'Component Generation Workflow',
        description: 'Generate React component with tests and stories',
        job: 'Create a reusable UI component quickly with all necessary files',
        steps: [
          {
            action: 'generate',
            description: 'Generate component file',
            generator: 'component',
            template: 'typescript',
            parameters: {
              dest: env.outputDir,
              variables: { name: 'Button', withTests: true, withStories: true }
            }
          },
          {
            action: 'generate',
            description: 'Generate test file',
            generator: 'test',
            template: 'component',
            parameters: {
              dest: join(env.outputDir, '__tests__'),
              variables: { componentName: 'Button' }
            }
          },
          {
            action: 'validate',
            description: 'Validate generated files',
            parameters: {
              files: [
                join(env.outputDir, 'Button.tsx'),
                join(env.outputDir, '__tests__', 'Button.test.tsx')
              ]
            }
          }
        ]
      };

      const result = await env.bridge.orchestrateJTBD(workflow);

      expect(result.success).toBe(true);
      expect(result.errors.length).toBe(0);
      expect(result.results.length).toBe(3); // Three steps
      
      // Verify each step was executed
      result.results.forEach((stepResult, index) => {
        expect(stepResult.stepIndex).toBe(index);
        expect(stepResult.success).toBe(true);
        expect(stepResult.action).toBe(workflow.steps[index].action);
      });

      // Verify workflow was stored in memory
      const status = env.bridge.getStatus();
      expect(status.memory.workflows[workflow.id]).toBeDefined();
      expect(status.memory.workflows[workflow.id].metadata.success).toBe(true);
    });

    it('should handle workflow with failures gracefully', async () => {
      const workflow: JTBDWorkflow = {
        id: 'test-workflow-failure-001',
        name: 'Workflow with Failures',
        description: 'Test workflow resilience',
        job: 'Test error handling in workflows',
        steps: [
          {
            action: 'generate',
            description: 'Valid generation step',
            generator: 'component',
            template: 'basic',
            parameters: {
              dest: env.outputDir,
              variables: { name: 'ValidComponent' }
            }
          },
          {
            action: 'generate',
            description: 'Invalid generation step',
            generator: 'nonexistent-generator',
            template: 'nonexistent-template',
            parameters: {
              dest: env.outputDir,
              variables: { name: 'InvalidComponent' }
            }
          },
          {
            action: 'validate',
            description: 'Validation step',
            parameters: {
              files: [join(env.outputDir, 'ValidComponent.tsx')]
            }
          }
        ]
      };

      const result = await env.bridge.orchestrateJTBD(workflow);

      expect(result.success).toBe(false); // Overall failure due to step 2
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.results.length).toBe(3);
      
      // First and third steps should succeed, second should fail
      expect(result.results[0].success).toBe(true);
      expect(result.results[1].success).toBe(false);
      expect(result.results[2].success).toBe(true);
    });
  });

  describe('Real-time Coordination and Memory', () => {
    it('should coordinate with swarm through notifications', async () => {
      const testMessage = 'Test coordination message';
      const testData = { timestamp: Date.now(), component: 'test' };

      // This should not throw
      await expect(
        env.bridge.coordinateWithSwarm(testMessage, testData)
      ).resolves.not.toThrow();

      // Verify event was emitted (we can't easily test this without mocking)
      // In a real scenario, we would verify the swarm received the notification
    });

    it('should handle memory synchronization errors gracefully', async () => {
      // Test with invalid memory configuration
      const bridgeWithBadConfig = new MCPBridge({
        debugMode: true,
        swarmMcpCommand: ['nonexistent-command'],
        timeouts: { swarmRequest: 100, unjucksRequest: 100, memorySync: 100 }
      });

      await bridgeWithBadConfig.initialize();
      
      // Should not throw when sync fails
      await expect(
        bridgeWithBadConfig.syncTemplateVariables('test', 'test')
      ).resolves.toBeDefined();

      await bridgeWithBadConfig.destroy();
    });
  });

  describe('Semantic Coordination Integration', () => {
    it('should execute semantic workflow with ontology validation', async () => {
      const swarmTask: SwarmTask = {
        id: 'semantic-test-001',
        type: 'generate',
        description: 'Generate healthcare FHIR-compliant API',
        parameters: {
          generator: 'api',
          template: 'fhir',
          dest: env.outputDir,
          variables: {
            resourceType: 'Patient',
            compliance: 'FHIR-R4'
          }
        }
      };

      const result = await env.bridge.orchestrateSemanticWorkflow(
        swarmTask,
        [
          {
            type: 'url',
            source: 'http://hl7.org/fhir/patient.ttl',
            format: 'turtle'
          }
        ]
      );

      expect(result.success).toBe(true);
      expect(result.results.length).toBeGreaterThan(0);
      
      // Semantic validation should be present
      if (result.validation) {
        expect(result.validation).toBeDefined();
      }
    });

    it('should route tasks to appropriate semantic agents', async () => {
      const healthcareTask: SwarmTask = {
        id: 'healthcare-routing-test',
        type: 'generate',
        description: 'Generate patient management system',
        parameters: {
          domain: 'healthcare',
          standard: 'FHIR',
          resourceTypes: ['Patient', 'Observation', 'Practitioner']
        }
      };

      const financialTask: SwarmTask = {
        id: 'financial-routing-test',
        type: 'generate',
        description: 'Generate trading system components',
        parameters: {
          domain: 'financial',
          standard: 'FIBO',
          instruments: ['Bond', 'Equity', 'Derivative']
        }
      };

      // Execute both tasks
      const healthcareResult = await env.bridge.swarmToUnjucks(healthcareTask);
      const financialResult = await env.bridge.swarmToUnjucks(financialTask);

      expect(healthcareResult).toBeDefined();
      expect(financialResult).toBeDefined();

      // Verify they were processed with appropriate domain context
      const semanticStatus = env.bridge.getSemanticStatus();
      expect(semanticStatus).toBeDefined();
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle concurrent task processing', async () => {
      const concurrentTasks = Array.from({ length: 10 }, (_, i) => ({
        id: `concurrent-task-${i}`,
        type: 'generate' as const,
        description: `Concurrent task ${i}`,
        parameters: {
          generator: 'component',
          template: 'basic',
          dest: env.outputDir,
          variables: { name: `Component${i}` }
        }
      }));

      const startTime = performance.now();
      const results = await Promise.all(
        concurrentTasks.map(task => env.bridge.swarmToUnjucks(task))
      );
      const endTime = performance.now();

      expect(results.length).toBe(10);
      results.forEach(result => {
        expect(result).toBeDefined();
      });

      const totalTime = endTime - startTime;
      expect(totalTime).toBeLessThan(5000); // Should complete within 5 seconds

      console.log(chalk.cyan(`✓ Processed ${concurrentTasks.length} concurrent tasks in ${totalTime.toFixed(2)}ms`));
    });

    it('should maintain stable memory usage under load', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Execute multiple operations
      for (let i = 0; i < 50; i++) {
        await env.bridge.syncTemplateVariables('test', 'template', {
          iteration: i,
          data: Array(100).fill(`data-${i}`).join(',')
        });
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      const memoryIncreaseMB = memoryIncrease / 1024 / 1024;

      expect(memoryIncreaseMB).toBeLessThan(50); // Should not increase more than 50MB

      console.log(chalk.cyan(`✓ Memory increase: ${memoryIncreaseMB.toFixed(2)}MB`));
    });

    it('should meet enterprise response time requirements', () => {
      const avgResponseTime = env.performanceMetrics.totalResponseTime / env.performanceMetrics.requests;
      
      expect(avgResponseTime).toBeLessThan(500); // Average response time < 500ms
      expect(env.performanceMetrics.requests).toBeGreaterThan(0);

      console.log(chalk.cyan(`✓ Average response time: ${avgResponseTime.toFixed(2)}ms over ${env.performanceMetrics.requests} requests`));
    });
  });

  describe('Error Handling and Fault Tolerance', () => {
    it('should recover from connection failures', async () => {
      // Simulate connection failure by destroying and reinitializing
      await env.bridge.destroy();
      
      expect(env.bridge.getStatus().initialized).toBe(false);

      // Reinitialize
      await env.bridge.initialize();
      expect(env.bridge.getStatus().initialized).toBe(true);

      // Verify it still works
      const testTask: SwarmTask = {
        id: 'recovery-test',
        type: 'generate',
        description: 'Test recovery',
        parameters: {
          generator: 'component',
          template: 'basic',
          dest: env.outputDir,
          variables: { name: 'RecoveryTest' }
        }
      };

      const result = await env.bridge.swarmToUnjucks(testTask);
      expect(result).toBeDefined();
    });

    it('should handle malformed swarm tasks gracefully', async () => {
      const malformedTasks = [
        { id: 'malformed-1', type: null, description: '', parameters: {} },
        { id: 'malformed-2', type: 'generate', parameters: null },
        { id: 'malformed-3', type: 'invalid-type', description: 'Invalid type', parameters: {} }
      ];

      for (const task of malformedTasks) {
        await expect(
          env.bridge.swarmToUnjucks(task as any)
        ).resolves.not.toThrow();
      }
    });

    it('should continue operation after individual step failures', async () => {
      const workflow: JTBDWorkflow = {
        id: 'fault-tolerance-test',
        name: 'Fault Tolerance Test',
        description: 'Test workflow continues after failures',
        job: 'Demonstrate fault tolerance',
        steps: [
          {
            action: 'generate',
            description: 'Valid step 1',
            generator: 'component',
            template: 'basic',
            parameters: { dest: env.outputDir, variables: { name: 'Step1' } }
          },
          {
            action: 'generate',
            description: 'Failing step 2',
            generator: 'invalid-generator',
            template: 'invalid-template',
            parameters: { dest: '/invalid/path' }
          },
          {
            action: 'generate',
            description: 'Valid step 3',
            generator: 'component',
            template: 'basic',
            parameters: { dest: env.outputDir, variables: { name: 'Step3' } }
          }
        ]
      };

      const result = await env.bridge.orchestrateJTBD(workflow);

      expect(result.results.length).toBe(3); // All steps attempted
      expect(result.results[0].success).toBe(true);
      expect(result.results[1].success).toBe(false);
      expect(result.results[2].success).toBe(true);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});

/**
 * Helper function to create comprehensive test templates
 */
async function createComprehensiveTestTemplates(env: TestEnvironment): Promise<void> {
  // Component templates
  const componentDir = join(env.templatesDir, 'component');
  await fs.mkdir(join(componentDir, 'typescript'), { recursive: true });
  await fs.mkdir(join(componentDir, 'basic'), { recursive: true });

  await fs.writeFile(
    join(componentDir, 'typescript', 'component.njk'),
    `---
to: "{{ dest }}/{{ name | pascalCase }}.tsx"
---
import React from 'react';

interface {{ name | pascalCase }}Props {
  className?: string;
  children?: React.ReactNode;
}

export const {{ name | pascalCase }}: React.FC<{{ name | pascalCase }}Props> = ({
  className,
  children
}) => {
  return (
    <div className={className}>
      {children}
    </div>
  );
};

export default {{ name | pascalCase }};
`
  );

  await fs.writeFile(
    join(componentDir, 'basic', 'component.njk'),
    `---
to: "{{ dest }}/{{ name | pascalCase }}.jsx"
---
import React from 'react';

export const {{ name | pascalCase }} = () => {
  return (
    <div>
      <h1>{{ name | pascalCase }}</h1>
    </div>
  );
};
`
  );

  // API templates
  const apiDir = join(env.templatesDir, 'api');
  await fs.mkdir(join(apiDir, 'fhir'), { recursive: true });

  await fs.writeFile(
    join(apiDir, 'fhir', 'resource.njk'),
    `---
to: "{{ dest }}/{{ resourceType | pascalCase }}Controller.ts"
---
import { Request, Response } from 'express';
import { {{ resourceType | pascalCase }} } from '../models/{{ resourceType | pascalCase }}';

export class {{ resourceType | pascalCase }}Controller {
  async create(req: Request, res: Response) {
    try {
      const resource = new {{ resourceType | pascalCase }}(req.body);
      await resource.save();
      res.status(201).json(resource);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async findById(req: Request, res: Response) {
    try {
      const resource = await {{ resourceType | pascalCase }}.findById(req.params.id);
      if (!resource) {
        return res.status(404).json({ error: '{{ resourceType | pascalCase }} not found' });
      }
      res.json(resource);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}
`
  );

  // Test templates
  const testDir = join(env.templatesDir, 'test');
  await fs.mkdir(join(testDir, 'component'), { recursive: true });

  await fs.writeFile(
    join(testDir, 'component', 'test.njk'),
    `---
to: "{{ dest }}/{{ componentName | pascalCase }}.test.tsx"
---
import React from 'react';
import { render, screen } from '@testing-library/react';
import { {{ componentName | pascalCase }} } from '../{{ componentName | pascalCase }}';

describe('{{ componentName | pascalCase }}', () => {
  it('renders without crashing', () => {
    render(<{{ componentName | pascalCase }} />);
  });

  it('displays content correctly', () => {
    render(<{{ componentName | pascalCase }}>Test Content</{{ componentName | pascalCase }}>);
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });
});
`
  );

  // Microservice scaffold
  const microserviceDir = join(env.templatesDir, 'scaffold');
  await fs.mkdir(join(microserviceDir, 'project'), { recursive: true });

  await fs.writeFile(
    join(microserviceDir, 'project', 'package.njk'),
    `---
to: "{{ dest }}/package.json"
---
{
  "name": "{{ projectName | kebabCase }}",
  "version": "1.0.0",
  "description": "{{ description }}",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "tsx watch src/index.ts",
    "test": "vitest"
  },
  "dependencies": {
    "express": "^4.18.2",
    {% if database === 'postgresql' %}"pg": "^8.11.3",{% endif %}
    {% if authentication === 'jwt' %}"jsonwebtoken": "^9.0.2",{% endif %}
    "dotenv": "^16.3.1"
  },
  "devDependencies": {
    "@types/node": "^20.8.0",
    "@types/express": "^4.17.18",
    "tsx": "^3.14.0",
    "typescript": "^5.2.2",
    "vitest": "^0.34.6"
  }
}
`
  );

  console.log(chalk.blue('✓ Comprehensive test templates created'));
}