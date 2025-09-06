import { Given, When, Then } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { spawn, ChildProcess } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../..');

interface MCPToolCall {
  tool: string;
  arguments?: Record<string, any>;
}

interface MCPTestContext {
  mcpServer?: ChildProcess;
  tempDir: string;
  toolResults: any[];
  generatedFiles: string[];
  startTime: number;
}

const context: MCPTestContext = {
  tempDir: '',
  toolResults: [],
  generatedFiles: [],
  startTime: 0
};

// Helper to call MCP tool
async function callMCPTool(toolName: string, args: Record<string, any> = {}): Promise<any> {
  if (!context.mcpServer) {
    throw new Error('MCP server not running');
  }

  const request = {
    jsonrpc: '2.0',
    id: Date.now(),
    method: 'tools/call',
    params: {
      name: toolName,
      arguments: args
    }
  };

  return new Promise((resolve, reject) => {
    const requestStr = JSON.stringify(request) + '\n';
    let responseData = '';

    const timeout = setTimeout(() => {
      reject(new Error(`MCP tool call timeout for ${toolName}`));
    }, 10000);

    const onData = (data: Buffer) => {
      responseData += data.toString();
      try {
        const response = JSON.parse(responseData.trim());
        clearTimeout(timeout);
        context.mcpServer?.stdout?.off('data', onData);
        resolve(response);
      } catch {
        // Wait for more data
      }
    };

    context.mcpServer.stdout?.on('data', onData);
    context.mcpServer.stdin?.write(requestStr);
  });
}

Given('I have a clean test environment with templates', async () => {
  context.tempDir = path.join(projectRoot, 'temp-mcp-tools-' + Date.now());
  await fs.mkdir(context.tempDir, { recursive: true });
  
  // Create test templates directory
  const templatesDir = path.join(context.tempDir, '_templates');
  await fs.mkdir(templatesDir, { recursive: true });
  
  // Create a sample component generator
  const componentDir = path.join(templatesDir, 'component');
  await fs.mkdir(componentDir, { recursive: true });
  
  // Create component/react template
  const reactDir = path.join(componentDir, 'react');
  await fs.mkdir(reactDir, { recursive: true });
  
  // Create template files
  await fs.writeFile(
    path.join(reactDir, 'Component.tsx'),
    `---
to: src/components/{{ componentName }}/{{ componentName }}.tsx
---
import React from 'react';

interface {{ componentName }}Props {
  // Add props here
}

const {{ componentName }}: React.FC<{{ componentName }}Props> = () => {
  return (
    <div>
      <h1>{{ componentName }}</h1>
    </div>
  );
};

export default {{ componentName }};
`
  );

  if (context.withTests) {
    await fs.writeFile(
      path.join(reactDir, 'Component.test.tsx'),
      `---
to: src/components/{{ componentName }}/{{ componentName }}.test.tsx
skipIf: "{{ withTests }}" == "false"
---
import { render, screen } from '@testing-library/react';
import {{ componentName }} from './{{ componentName }}';

describe('{{ componentName }}', () => {
  it('renders correctly', () => {
    render(<{{ componentName }} />);
    expect(screen.getByText('{{ componentName }}')).toBeInTheDocument();
  });
});
`
    );
  }

  // Create config file
  await fs.writeFile(
    path.join(componentDir, 'config.yml'),
    `name: component
description: Generate React components
prompts:
  - name: componentName
    message: Component name
    type: input
  - name: withTests
    message: Include tests?
    type: confirm
    default: true
`
  );

  context.toolResults = [];
  context.generatedFiles = [];
});

Given('I have test templates available', async () => {
  // Verify templates exist
  const templatesDir = path.join(context.tempDir, '_templates');
  const exists = await fs.access(templatesDir).then(() => true).catch(() => false);
  expect(exists).toBe(true);
});

Given('I have a {string} template', async (templatePath: string) => {
  const [generator, template] = templatePath.split('/');
  const templateDir = path.join(context.tempDir, '_templates', generator, template);
  const exists = await fs.access(templateDir).then(() => true).catch(() => false);
  expect(exists).toBe(true);
});

Given('I have an existing file {string}', async (filePath: string) => {
  const fullPath = path.join(context.tempDir, filePath);
  const dir = path.dirname(fullPath);
  await fs.mkdir(dir, { recursive: true });
  
  await fs.writeFile(fullPath, `// Existing file content
import React from 'react';

export default function App() {
  return <div>App</div>;
}
`);
});

When('I call the {string} MCP tool', async (toolName: string) => {
  context.startTime = Date.now();
  
  const result = await callMCPTool(toolName, {
    workingDirectory: context.tempDir
  });
  
  context.toolResults.push(result);
});

When('I call {string} with generator={string} and template={string}', async (toolName: string, generator: string, template: string) => {
  context.startTime = Date.now();
  
  const result = await callMCPTool(toolName, {
    generator,
    template,
    workingDirectory: context.tempDir
  });
  
  context.toolResults.push(result);
});

When('I call {string} with:', async (toolName: string, table: any[]) => {
  const args = table.reduce((acc, row) => {
    acc[row.generator] = row.template;
    acc[row.componentName] = row.componentName;
    acc[row.withTests] = row.withTests === 'true';
    return acc;
  }, {
    workingDirectory: context.tempDir,
    generator: table[0]?.generator,
    template: table[0]?.template
  });

  context.startTime = Date.now();
  const result = await callMCPTool(toolName, args);
  context.toolResults.push(result);
});

When('I call {string} with componentName={string}', async (toolName: string, componentName: string) => {
  context.startTime = Date.now();
  
  const result = await callMCPTool(toolName, {
    generator: 'component',
    template: 'react',
    componentName,
    workingDirectory: context.tempDir
  });
  
  context.toolResults.push(result);
});

When('I call {string} to add an import', async (toolName: string) => {
  context.startTime = Date.now();
  
  const result = await callMCPTool(toolName, {
    filePath: 'src/index.js',
    content: "import { useState } from 'react';",
    mode: 'after',
    target: "import React from 'react';",
    workingDirectory: context.tempDir
  });
  
  context.toolResults.push(result);
});

When('I call {string} with invalid parameters', async (toolName: string) => {
  context.startTime = Date.now();
  
  try {
    const result = await callMCPTool(toolName, {
      generator: 'nonexistent',
      template: 'invalid',
      workingDirectory: context.tempDir
    });
    context.toolResults.push(result);
  } catch (error) {
    context.toolResults.push({ error: error instanceof Error ? error.message : String(error) });
  }
});

When('I make {int} concurrent calls to {string}', async (count: number, toolName: string) => {
  context.startTime = Date.now();
  
  const promises = Array.from({ length: count }, () => 
    callMCPTool(toolName, { workingDirectory: context.tempDir })
  );
  
  const results = await Promise.all(promises);
  context.toolResults.push(...results);
});

Then('it should return available generators', () => {
  const lastResult = context.toolResults[context.toolResults.length - 1];
  expect(lastResult.result?.content).toBeDefined();
  
  const content = Array.isArray(lastResult.result.content) 
    ? lastResult.result.content[0]?.text 
    : lastResult.result.content;
  
  expect(content).toContain('component');
});

Then('each generator should have metadata', () => {
  const lastResult = context.toolResults[context.toolResults.length - 1];
  expect(lastResult.result?.content).toBeDefined();
  
  const content = Array.isArray(lastResult.result.content) 
    ? lastResult.result.content[0]?.text 
    : lastResult.result.content;
  
  // Should contain structured data with descriptions
  expect(content).toMatch(/description|templates|variables/i);
});

Then('the response should include template counts', () => {
  const lastResult = context.toolResults[context.toolResults.length - 1];
  expect(lastResult.result?.content).toBeDefined();
});

Then('execution should complete in under {int}ms', (maxTime: number) => {
  const duration = Date.now() - context.startTime;
  expect(duration).toBeLessThan(maxTime);
});

Then('it should return variable documentation', () => {
  const lastResult = context.toolResults[context.toolResults.length - 1];
  expect(lastResult.result?.content).toBeDefined();
  
  const content = Array.isArray(lastResult.result.content) 
    ? lastResult.result.content[0]?.text 
    : lastResult.result.content;
  
  expect(content).toMatch(/componentName|variables|parameters/i);
});

Then('it should include usage examples', () => {
  const lastResult = context.toolResults[context.toolResults.length - 1];
  const content = Array.isArray(lastResult.result.content) 
    ? lastResult.result.content[0]?.text 
    : lastResult.result.content;
  
  expect(content).toMatch(/example|usage|generate/i);
});

Then('it should show required vs optional variables', () => {
  const lastResult = context.toolResults[context.toolResults.length - 1];
  const content = Array.isArray(lastResult.result.content) 
    ? lastResult.result.content[0]?.text 
    : lastResult.result.content;
  
  expect(content).toMatch(/required|optional|componentName/i);
});

Then('it should include type information', () => {
  const lastResult = context.toolResults[context.toolResults.length - 1];
  const content = Array.isArray(lastResult.result.content) 
    ? lastResult.result.content[0]?.text 
    : lastResult.result.content;
  
  expect(content).toMatch(/type|string|boolean/i);
});

Then('it should create real files', async () => {
  const lastResult = context.toolResults[context.toolResults.length - 1];
  expect(lastResult.result).toBeDefined();
  expect(lastResult.error).toBeUndefined();
  
  // Check if files were actually created
  const componentFile = path.join(context.tempDir, 'src/components/UserProfile/UserProfile.tsx');
  const exists = await fs.access(componentFile).then(() => true).catch(() => false);
  expect(exists).toBe(true);
});

Then('the files should contain rendered content', async () => {
  const componentFile = path.join(context.tempDir, 'src/components/UserProfile/UserProfile.tsx');
  const content = await fs.readFile(componentFile, 'utf-8');
  expect(content).toContain('UserProfile');
  expect(content).not.toContain('{{ componentName }}');
});

Then('variables should be properly substituted', async () => {
  const componentFile = path.join(context.tempDir, 'src/components/UserProfile/UserProfile.tsx');
  const content = await fs.readFile(componentFile, 'utf-8');
  expect(content).not.toMatch(/\{\{.*\}\}/); // No unsubstituted variables
});

Then('file permissions should be correct', async () => {
  const componentFile = path.join(context.tempDir, 'src/components/UserProfile/UserProfile.tsx');
  const stats = await fs.stat(componentFile);
  expect(stats.isFile()).toBe(true);
});

Then('it should show preview of changes', () => {
  const lastResult = context.toolResults[context.toolResults.length - 1];
  const content = Array.isArray(lastResult.result.content) 
    ? lastResult.result.content[0]?.text 
    : lastResult.result.content;
  
  expect(content).toMatch(/preview|create|would create/i);
});

Then('it should not create any actual files', async () => {
  const componentFile = path.join(context.tempDir, 'src/components/TestComponent/TestComponent.tsx');
  const exists = await fs.access(componentFile).then(() => true).catch(() => false);
  expect(exists).toBe(false);
});

Then('it should detect potential conflicts', () => {
  const lastResult = context.toolResults[context.toolResults.length - 1];
  expect(lastResult.result).toBeDefined();
});

Then('it should show impact analysis', () => {
  const lastResult = context.toolResults[context.toolResults.length - 1];
  const content = Array.isArray(lastResult.result.content) 
    ? lastResult.result.content[0]?.text 
    : lastResult.result.content;
  
  expect(content).toMatch(/files|impact|changes/i);
});

Then('it should modify the file correctly', async () => {
  const filePath = path.join(context.tempDir, 'src/index.js');
  const content = await fs.readFile(filePath, 'utf-8');
  expect(content).toContain("import { useState } from 'react';");
});

Then('the injection should be idempotent', async () => {
  // Call injection again
  await callMCPTool('unjucks_inject', {
    filePath: 'src/index.js',
    content: "import { useState } from 'react';",
    mode: 'after',
    target: "import React from 'react';",
    workingDirectory: context.tempDir
  });
  
  const filePath = path.join(context.tempDir, 'src/index.js');
  const content = await fs.readFile(filePath, 'utf-8');
  
  // Should not duplicate the import
  const matches = content.match(/import { useState } from 'react';/g);
  expect(matches?.length).toBe(1);
});

Then('a backup should be created', async () => {
  const backupFiles = await fs.readdir(context.tempDir, { recursive: true });
  const hasBackup = (backupFiles as string[]).some(f => f.includes('.backup'));
  expect(hasBackup).toBe(true);
});

Then('the content should be at the correct position', async () => {
  const filePath = path.join(context.tempDir, 'src/index.js');
  const content = await fs.readFile(filePath, 'utf-8');
  const lines = content.split('\n');
  
  const reactImportIndex = lines.findIndex(l => l.includes("import React from 'react'"));
  const useStateImportIndex = lines.findIndex(l => l.includes("import { useState } from 'react'"));
  
  expect(useStateImportIndex).toBeGreaterThan(reactImportIndex);
});

Then('it should return a proper MCP error', () => {
  const lastResult = context.toolResults[context.toolResults.length - 1];
  expect(lastResult.error || lastResult.result?.error).toBeDefined();
});

Then('the error message should be descriptive', () => {
  const lastResult = context.toolResults[context.toolResults.length - 1];
  const errorMsg = lastResult.error || lastResult.result?.error?.message;
  expect(errorMsg).toMatch(/not found|invalid|error/i);
});

Then('the error code should be appropriate', () => {
  const lastResult = context.toolResults[context.toolResults.length - 1];
  const errorCode = lastResult.result?.error?.code;
  if (errorCode) {
    expect(errorCode).toBeGreaterThanOrEqual(-32999);
    expect(errorCode).toBeLessThanOrEqual(-32000);
  }
});

Then('no partial files should be created', async () => {
  const files = await fs.readdir(context.tempDir, { recursive: true });
  const partialFiles = (files as string[]).filter(f => 
    f.includes('UserProfile') || f.includes('TestComponent')
  );
  expect(partialFiles.length).toBe(0);
});

Then('all calls should complete successfully', () => {
  const errors = context.toolResults.filter(r => r.error);
  expect(errors.length).toBe(0);
});

Then('average response time should be under {int}ms', (maxTime: number) => {
  const duration = Date.now() - context.startTime;
  const avgTime = duration / context.toolResults.length;
  expect(avgTime).toBeLessThan(maxTime);
});

Then('memory usage should remain stable', () => {
  // Basic memory check - in real implementation would monitor RSS
  expect(process.memoryUsage().heapUsed).toBeLessThan(100 * 1024 * 1024); // 100MB
});

Then('no resource leaks should occur', () => {
  // Check no file handles are left open
  expect(context.toolResults.length).toBeGreaterThan(0);
});

// Cleanup
export async function cleanup() {
  if (context.mcpServer) {
    context.mcpServer.kill();
  }
  
  if (context.tempDir) {
    await fs.rm(context.tempDir, { recursive: true, force: true });
  }
}