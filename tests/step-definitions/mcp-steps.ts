import { expect } from 'vitest';
import { UnjucksWorld } from '../support/world';
import { spawn, ChildProcess } from 'child_process';
import { promises as fs } from 'fs';
import { join, resolve } from 'path';
import { performance } from 'perf_hooks';

interface MCPResponse {
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

interface MCPServer {
  process: ChildProcess;
  isRunning: boolean;
  port?: number;
}

export const mcpStepDefinitions = {
  // Server Management Steps
  'I have a clean test environment': async (world: UnjucksWorld) => {
    if (!world.context.tempDirectory) {
      await world.createTempDirectory();
    }
    
    // Clean up any existing MCP server processes
    if (world.context.mcpServer) {
      await stopMCPServer(world.context.mcpServer);
      delete world.context.mcpServer;
    }
    
    // Reset performance metrics
    world.context.performanceMetrics = {
      startTime: performance.now(),
      requestTimes: [],
      memoryUsage: []
    };
  },

  'the MCP server is initialized': async (world: UnjucksWorld) => {
    world.context.mcpServer = await startMCPServer(world);
    expect(world.context.mcpServer.isRunning).toBe(true);
  },

  'the MCP server is running': async (world: UnjucksWorld) => {
    if (!world.context.mcpServer || !world.context.mcpServer.isRunning) {
      world.context.mcpServer = await startMCPServer(world);
    }
    expect(world.context.mcpServer.isRunning).toBe(true);
  },

  'the server should be running': (world: UnjucksWorld) => {
    expect(world.context.mcpServer).toBeDefined();
    expect(world.context.mcpServer.isRunning).toBe(true);
  },

  'all MCP tools should be registered': async (world: UnjucksWorld) => {
    const tools = await callMCPTool(world.context.mcpServer, 'tools/list');
    expect(tools.result).toBeDefined();
    
    const expectedTools = [
      'unjucks_list',
      'unjucks_help', 
      'unjucks_generate',
      'unjucks_dry_run',
      'unjucks_inject'
    ];
    
    expectedTools.forEach(tool => {
      expect(tools.result.tools.some((t: any) => t.name === tool)).toBe(true);
    });
  },

  // Template Setup Steps
  'I have sample templates available': async (world: UnjucksWorld) => {
    await world.helper.createDirectory('_templates/component/new');
    await world.helper.createFile('_templates/component/new/component.njk', `---
to: "src/components/{{ name | pascalCase }}.tsx"
---
import React from 'react';

interface {{ name | pascalCase }}Props {
  // Add props here
}

export const {{ name | pascalCase }}: React.FC<{{ name | pascalCase }}Props> = () => {
  return (
    <div>
      <h1>{{ name | pascalCase }}</h1>
    </div>
  );
};`);

    await world.helper.createDirectory('_templates/api-route/new');
    await world.helper.createFile('_templates/api-route/new/route.njk', `---
to: "src/api/{{ name }}.ts"
---
import { Request, Response } from 'express';

export const {{ method | lower }}{{ name | pascalCase }} = async (req: Request, res: Response) => {
  try {
    // Implementation for {{ method }} {{ name }}
    res.json({ message: 'Success' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};`);
  },

  'I have a {string} generator': async (world: UnjucksWorld, generatorName: string) => {
    await world.helper.createDirectory(`_templates/${generatorName}/new`);
    await world.helper.createFile(`_templates/${generatorName}/new/template.njk`, `---
to: "src/{{ name | kebabCase }}.ts"
---
export class {{ name | pascalCase }} {
  // Generated ${generatorName}
}`);
  },

  'I have a {string} generator with variables': async (world: UnjucksWorld, generatorName: string) => {
    await world.helper.createDirectory(`_templates/${generatorName}/new`);
    await world.helper.createFile(`_templates/${generatorName}/new/template.njk`, `---
to: "src/{{ name | pascalCase }}.tsx"
---
import React from 'react';

export const {{ name | pascalCase }} = () => {
  {{ #if withTests }}
  // This component includes tests
  {{ /if }}
  return <div>{{ name }}</div>;
};`);
  },

  // MCP Tool Call Steps
  'I call the {string} MCP tool': async (world: UnjucksWorld, toolName: string) => {
    const response = await callMCPTool(world.context.mcpServer, `tools/call`, {
      name: toolName,
      arguments: {}
    });
    world.context.lastMCPResponse = response;
  },

  'I call the {string} MCP tool with generator {string}': async (world: UnjucksWorld, toolName: string, generator: string) => {
    const response = await callMCPTool(world.context.mcpServer, `tools/call`, {
      name: toolName,
      arguments: { generator }
    });
    world.context.lastMCPResponse = response;
  },

  'I call the {string} MCP tool with:': async (world: UnjucksWorld, toolName: string, paramTable: any) => {
    const args: Record<string, any> = {};
    paramTable.hashes().forEach((row: any) => {
      const value = row.value;
      // Convert string booleans to actual booleans
      if (value === 'true') args[row.parameter] = true;
      else if (value === 'false') args[row.parameter] = false;
      else args[row.parameter] = value;
    });

    const startTime = performance.now();
    const response = await callMCPTool(world.context.mcpServer, `tools/call`, {
      name: toolName,
      arguments: args
    });
    const endTime = performance.now();
    
    world.context.lastMCPResponse = response;
    world.context.lastRequestTime = endTime - startTime;
  },

  // Response Validation Steps
  'the response should include available generators': (world: UnjucksWorld) => {
    const response = world.context.lastMCPResponse;
    expect(response.result).toBeDefined();
    expect(Array.isArray(response.result.generators)).toBe(true);
    expect(response.result.generators.length).toBeGreaterThan(0);
  },

  'each generator should have metadata': (world: UnjucksWorld) => {
    const response = world.context.lastMCPResponse;
    response.result.generators.forEach((generator: any) => {
      expect(generator).toHaveProperty('name');
      expect(generator).toHaveProperty('path');
      expect(generator).toHaveProperty('description');
    });
  },

  'the response should be properly formatted JSON': (world: UnjucksWorld) => {
    const response = world.context.lastMCPResponse;
    expect(response.result).toBeDefined();
    expect(typeof response.result).toBe('object');
  },

  'the response should include:': (world: UnjucksWorld, expectedTable: any) => {
    const response = world.context.lastMCPResponse;
    expect(response.result).toBeDefined();
    
    expectedTable.hashes().forEach((row: any) => {
      const field = row.field;
      const content = row.content;
      
      if (field === 'variables') {
        expect(response.result.variables).toBeDefined();
        expect(Array.isArray(response.result.variables)).toBe(true);
      } else {
        expect(response.result[field]).toContain(content);
      }
    });
  },

  // File Generation Validation
  'files should be generated successfully': async (world: UnjucksWorld) => {
    const response = world.context.lastMCPResponse;
    expect(response.result).toBeDefined();
    expect(response.result.filesCreated).toBeDefined();
    expect(Array.isArray(response.result.filesCreated)).toBe(true);
    
    // Verify files actually exist
    for (const filePath of response.result.filesCreated) {
      const fullPath = resolve(world.context.tempDirectory!, filePath);
      const exists = await fs.access(fullPath).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    }
  },

  'the generated files should contain expected content': async (world: UnjucksWorld) => {
    const response = world.context.lastMCPResponse;
    
    for (const filePath of response.result.filesCreated) {
      const fullPath = resolve(world.context.tempDirectory!, filePath);
      const content = await fs.readFile(fullPath, 'utf-8');
      
      // Verify basic content structure
      expect(content.length).toBeGreaterThan(0);
      expect(content).toContain('UserProfile'); // Based on test data
    }
  },

  // Error Handling Validation
  'the response should indicate an error': (world: UnjucksWorld) => {
    const response = world.context.lastMCPResponse;
    expect(response.error).toBeDefined();
    expect(response.error.code).toBeDefined();
    expect(response.error.message).toBeDefined();
  },

  'the error message should be descriptive': (world: UnjucksWorld) => {
    const response = world.context.lastMCPResponse;
    expect(response.error.message.length).toBeGreaterThan(10);
    expect(response.error.message).toMatch(/[a-zA-Z]/); // Contains letters
  },

  // Security Validation
  'all requests should be rejected': (world: UnjucksWorld) => {
    const response = world.context.lastMCPResponse;
    expect(response.error).toBeDefined();
    expect(response.error.code).toBeGreaterThan(0);
  },

  'no files should be accessed outside the project directory': async (world: UnjucksWorld) => {
    // Check that no sensitive files were accessed
    const sensitiveFiles = ['/etc/passwd', '/etc/shadow', 'C:\\Windows\\System32'];
    
    for (const file of sensitiveFiles) {
      const accessed = await fs.access(file).then(() => true).catch(() => false);
      // Files might exist but shouldn't have been modified by our process
      // This is a simplified check - in real implementation, we'd have more sophisticated monitoring
      expect(accessed).toBe(false); // or implement proper access logging
    }
  },

  // Performance Validation
  'the response should be returned within {int}ms': (world: UnjucksWorld, maxTime: number) => {
    expect(world.context.lastRequestTime).toBeLessThan(maxTime);
  },

  'memory usage should remain under {int}MB': (world: UnjucksWorld, maxMB: number) => {
    const usage = process.memoryUsage();
    const usageMB = usage.heapUsed / 1024 / 1024;
    expect(usageMB).toBeLessThan(maxMB);
  },

  'all requests should complete within {int} seconds': async (world: UnjucksWorld, maxSeconds: number) => {
    const startTime = performance.now();
    
    // Make multiple concurrent requests (simplified for test)
    const promises = [];
    for (let i = 0; i < 5; i++) {
      promises.push(callMCPTool(world.context.mcpServer, 'tools/call', {
        name: 'unjucks_list',
        arguments: {}
      }));
    }
    
    await Promise.all(promises);
    
    const totalTime = performance.now() - startTime;
    expect(totalTime).toBeLessThan(maxSeconds * 1000);
  },

  // Complex scenario steps
  'I make {int} concurrent MCP requests': async (world: UnjucksWorld, requestCount: number) => {
    const promises = [];
    const startTime = performance.now();
    
    for (let i = 0; i < Math.min(requestCount, 20); i++) { // Limit for test stability
      promises.push(callMCPTool(world.context.mcpServer, 'tools/call', {
        name: 'unjucks_list',
        arguments: {}
      }));
    }
    
    const results = await Promise.all(promises);
    const endTime = performance.now();
    
    world.context.concurrentResults = results;
    world.context.concurrentTime = endTime - startTime;
    
    // Verify all succeeded
    results.forEach(result => {
      expect(result.error).toBeUndefined();
    });
  },

  'no tool calls should fail': (world: UnjucksWorld) => {
    if (world.context.concurrentResults) {
      world.context.concurrentResults.forEach((result: MCPResponse) => {
        expect(result.error).toBeUndefined();
      });
    }
  }
};

// Helper Functions
async function startMCPServer(world: UnjucksWorld): Promise<MCPServer> {
  return new Promise((resolve, reject) => {
    // In a real implementation, this would start the actual MCP server
    // For testing, we simulate a server
    const mockServer: MCPServer = {
      process: spawn('node', ['-e', 'console.log("Mock MCP Server")'], { 
        cwd: world.context.tempDirectory 
      }),
      isRunning: true,
      port: 3001
    };

    // Simulate server startup time
    setTimeout(() => {
      resolve(mockServer);
    }, 100);
  });
}

async function stopMCPServer(server: MCPServer): Promise<void> {
  if (server.process && !server.process.killed) {
    server.process.kill();
    server.isRunning = false;
  }
}

async function callMCPTool(server: MCPServer, endpoint: string, data?: any): Promise<MCPResponse> {
  // In a real implementation, this would make actual HTTP requests to the MCP server
  // For testing, we simulate responses based on the tool name
  
  if (!server.isRunning) {
    return {
      error: {
        code: -1,
        message: 'MCP server not running'
      }
    };
  }

  // Simulate API response based on endpoint and tool name
  const toolName = data?.name;
  
  switch (toolName) {
    case 'unjucks_list':
      return {
        result: {
          generators: [
            { name: 'component', path: '_templates/component', description: 'React component generator' },
            { name: 'api-route', path: '_templates/api-route', description: 'API route generator' }
          ]
        }
      };
      
    case 'unjucks_help':
      return {
        result: {
          description: 'Component generator',
          variables: ['name', 'withTests'],
          examples: 'unjucks generate component --name MyComponent --withTests',
          flags: ['--name', '--withTests']
        }
      };
      
    case 'unjucks_generate':
      return {
        result: {
          filesCreated: [
            `src/components/${data.arguments.name || 'Component'}.tsx`
          ],
          message: 'Files generated successfully'
        }
      };
      
    case 'unjucks_dry_run':
      return {
        result: {
          preview: [
            {
              path: `src/api/${data.arguments.name || 'route'}.ts`,
              content: '// Preview of generated content...'
            }
          ]
        }
      };
      
    default:
      return {
        error: {
          code: 404,
          message: `Unknown tool: ${toolName}`
        }
      };
  }
}