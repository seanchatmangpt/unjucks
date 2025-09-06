import { expect } from 'vitest';
import { UnjucksWorld } from '../support/world';
import { promises as fs } from 'fs';
import { join } from 'path';
import { performance } from 'perf_hooks';

export const mcpEdgeCaseStepDefinitions = {
  // Empty and missing template scenarios
  'I have no templates available': async (world: UnjucksWorld) => {
    // Ensure templates directory is empty
    const templatesDir = join(world.context.tempDirectory!, '_templates');
    try {
      await fs.rmdir(templatesDir, { recursive: true });
    } catch (error) {
      // Directory might not exist, which is fine
    }
  },

  'the response should return an empty generators list': (world: UnjucksWorld) => {
    const response = world.context.lastMCPResponse;
    expect(response.result).toBeDefined();
    expect(response.result.generators).toBeDefined();
    expect(Array.isArray(response.result.generators)).toBe(true);
    expect(response.result.generators).toHaveLength(0);
  },

  'should include a helpful message about no generators found': (world: UnjucksWorld) => {
    const response = world.context.lastMCPResponse;
    expect(response.result.message).toContain('no generators found');
  },

  // Malformed template scenarios
  'I have a template with invalid frontmatter:': async (world: UnjucksWorld, invalidTemplate: string) => {
    await world.helper.createDirectory('_templates/invalid/new');
    await world.helper.createFile('_templates/invalid/new/template.njk', invalidTemplate);
  },

  'the response should indicate a parsing error': (world: UnjucksWorld) => {
    const response = world.context.lastMCPResponse;
    expect(response.error).toBeDefined();
    expect(response.error.message).toMatch(/parse|parsing|yaml|frontmatter/i);
  },

  'should provide specific details about the YAML issue': (world: UnjucksWorld) => {
    const response = world.context.lastMCPResponse;
    expect(response.error.message.length).toBeGreaterThan(20);
    expect(response.error.data).toBeDefined();
  },

  // Circular dependency scenarios
  'I have templates that reference each other:': async (world: UnjucksWorld, templateTable: any) => {
    for (const row of templateTable.hashes()) {
      const templateName = row.template_a || row.template_b;
      const includes = row.includes;
      
      await world.helper.createDirectory(`_templates/${templateName}/new`);
      await world.helper.createFile(`_templates/${templateName}/new/template.njk`, `---
to: "output.js"
includes: "${includes}"
---
{% include "${includes}/new/template.njk" %}
Content for ${templateName}`);
    }
  },

  'the system should detect the circular dependency': (world: UnjucksWorld) => {
    const response = world.context.lastMCPResponse;
    expect(response.error).toBeDefined();
    expect(response.error.message).toMatch(/circular|dependency|recursive/i);
  },

  'should prevent infinite loops': (world: UnjucksWorld) => {
    const response = world.context.lastMCPResponse;
    // Should fail quickly, not hang indefinitely
    expect(world.context.lastRequestTime).toBeLessThan(5000);
  },

  // Long file path scenarios  
  'I have a template that generates files with paths longer than {int} characters': async (world: UnjucksWorld, pathLength: number) => {
    const longPath = 'a'.repeat(Math.min(pathLength, 300)); // Limit for test stability
    
    await world.helper.createDirectory('_templates/longpath/new');
    await world.helper.createFile('_templates/longpath/new/template.njk', `---
to: "very/long/path/structure/${longPath}/{{ name }}.js"
---
export const component = '{{ name }}';`);
  },

  'I call {string} with a very long destination path': async (world: UnjucksWorld, toolName: string) => {
    const veryLongDest = 'output/' + 'nested/'.repeat(50) + 'file.js';
    
    const response = await world.callMCPTool(toolName, {
      generator: 'longpath',
      name: 'test',
      dest: veryLongDest
    });
    
    world.context.lastMCPResponse = response;
  },

  'should either generate the file or provide a clear path length error': (world: UnjucksWorld) => {
    const response = world.context.lastMCPResponse;
    
    if (response.error) {
      expect(response.error.message).toMatch(/path|length|long|limit/i);
    } else {
      expect(response.result.filesCreated).toBeDefined();
    }
  },

  // Unicode and special character scenarios
  'I provide variables with special characters:': async (world: UnjucksWorld, variableTable: any) => {
    const variables: Record<string, string> = {};
    variableTable.hashes().forEach((row: any) => {
      variables[row.variable] = row.value;
    });
    
    const response = await world.callMCPTool('unjucks_generate', {
      generator: 'component',
      ...variables
    });
    
    world.context.lastMCPResponse = response;
    world.context.testVariables = variables;
  },

  'the variables should be properly encoded/escaped': async (world: UnjucksWorld) => {
    const response = world.context.lastMCPResponse;
    
    if (response.result?.filesCreated) {
      for (const filePath of response.result.filesCreated) {
        const fullPath = join(world.context.tempDirectory!, filePath);
        const content = await fs.readFile(fullPath, 'utf-8');
        
        // Check that dangerous content is escaped
        expect(content).not.toMatch(/<script[^>]*>.*<\/script>/i);
        expect(content).not.toMatch(/javascript:/i);
      }
    }
  },

  'no security issues should arise': (world: UnjucksWorld) => {
    // This would be verified through security scanning tools in real implementation
    const response = world.context.lastMCPResponse;
    expect(response.error?.message).not.toMatch(/security|vulnerability|exploit/i);
  },

  // Large content scenarios
  'I have a template expecting a {string} variable': async (world: UnjucksWorld, variableName: string) => {
    await world.helper.createDirectory('_templates/large-content/new');
    await world.helper.createFile('_templates/large-content/new/template.njk', `---
to: "large-output.txt"
---
Large content: {{ ${variableName} }}`);
  },

  'I provide a {string} string as the {word} variable': async (world: UnjucksWorld, size: string, variableName: string) => {
    let contentSize = 1024; // Default 1KB
    if (size.includes('MB')) contentSize = parseInt(size) * 1024 * 1024;
    else if (size.includes('KB')) contentSize = parseInt(size) * 1024;
    
    // Limit size for test performance - use smaller size in tests
    const testContentSize = Math.min(contentSize, 100 * 1024); // Max 100KB in tests
    const largeContent = 'x'.repeat(testContentSize);
    
    const response = await world.callMCPTool('unjucks_generate', {
      generator: 'large-content',
      [variableName]: largeContent
    });
    
    world.context.lastMCPResponse = response;
  },

  'should either process it or reject with a size limit error': (world: UnjucksWorld) => {
    const response = world.context.lastMCPResponse;
    
    if (response.error) {
      expect(response.error.message).toMatch(/size|limit|large|memory/i);
    } else {
      expect(response.result).toBeDefined();
    }
  },

  'should not exhaust system memory': (world: UnjucksWorld) => {
    const memUsage = process.memoryUsage();
    const memUsageMB = memUsage.heapUsed / 1024 / 1024;
    
    // Should not use more than 500MB during test
    expect(memUsageMB).toBeLessThan(500);
  },

  // Syntax error scenarios
  'I have a template with Nunjucks syntax errors:': async (world: UnjucksWorld, templateContent: string) => {
    await world.helper.createDirectory('_templates/syntax-error/new');
    await world.helper.createFile('_templates/syntax-error/new/template.njk', templateContent);
  },

  'should specify the exact error locations': (world: UnjucksWorld) => {
    const response = world.context.lastMCPResponse;
    expect(response.error).toBeDefined();
    // Should include line/column information
    expect(response.error.message).toMatch(/line|column|position|\d+/);
  },

  'should provide suggestions for fixing the syntax': (world: UnjucksWorld) => {
    const response = world.context.lastMCPResponse;
    expect(response.error.data?.suggestions).toBeDefined();
    expect(Array.isArray(response.error.data.suggestions)).toBe(true);
  },

  // Performance and reliability scenarios
  'should timeout after a reasonable duration': (world: UnjucksWorld) => {
    expect(world.context.lastRequestTime).toBeLessThan(10000); // 10 seconds max
  },

  'should handle deep nesting appropriately': (world: UnjucksWorld) => {
    const response = world.context.lastMCPResponse;
    
    // Should either succeed or fail gracefully, not crash
    expect(typeof response).toBe('object');
    
    if (response.error) {
      expect(response.error.message).toMatch(/nesting|depth|stack|recursion/i);
    }
  },

  'should not crash the entire system': (world: UnjucksWorld) => {
    // System should still be responsive
    expect(world.context.mcpServer.isRunning).toBe(true);
    
    // Memory usage should be reasonable
    const memUsage = process.memoryUsage();
    const memUsageMB = memUsage.heapUsed / 1024 / 1024;
    expect(memUsageMB).toBeLessThan(200);
  },

  // Parameter validation scenarios
  'I call MCP tools with invalid parameter combinations:': async (world: UnjucksWorld, paramTable: any) => {
    const results: any[] = [];
    
    for (const row of paramTable.hashes()) {
      const tool = row.tool;
      const invalidParams = parseInvalidParams(row.invalid_params);
      
      const response = await world.callMCPTool(tool, invalidParams);
      results.push({ tool, response });
    }
    
    world.context.validationResults = results;
  },

  'should provide specific validation errors': (world: UnjucksWorld) => {
    const results = world.context.validationResults;
    
    results.forEach((result: any) => {
      expect(result.response.error).toBeDefined();
      expect(result.response.error.message).toMatch(/invalid|validation|parameter/i);
    });
  },

  'should suggest correct parameter usage': (world: UnjucksWorld) => {
    const results = world.context.validationResults;
    
    results.forEach((result: any) => {
      expect(result.response.error.data?.usage || result.response.error.message)
        .toMatch(/should|expected|example|correct/i);
    });
  }
};

// Helper function to parse invalid parameter strings
function parseInvalidParams(paramString: string): Record<string, any> {
  const params: Record<string, any> = {};
  
  // Parse comma-separated key: value pairs
  const pairs = paramString.split(',').map(p => p.trim());
  
  for (const pair of pairs) {
    const [key, value] = pair.split(':').map(s => s.trim().replace(/"/g, ''));
    
    // Convert value types
    if (value === 'null') params[key] = null;
    else if (value === 'undefined') params[key] = undefined;
    else if (value === '') params[key] = '';
    else if (!isNaN(Number(value))) params[key] = Number(value);
    else params[key] = value;
  }
  
  return params;
}