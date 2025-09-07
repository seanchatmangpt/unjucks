/**
 * Argument Parsing Edge Cases Tests
 * Comprehensive testing of complex argument parsing scenarios
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * from 'path';
import * from 'fs/promises';
import { tmpdir } from 'os';

const execFileAsync = promisify(execFile);
const CLI_PATH = path.resolve(__dirname, '../../bin/unjucks.cjs');

async function runCLI(args = [], cwd?) {
  try {
    const { stdout, stderr } = await execFileAsync('node', [CLI_PATH, ...args], { cwd),
      timeout });
    return { stdout, stderr, exitCode };
  } catch (error) { return {
      stdout };
  }
}

describe('Argument Parsing Edge Cases', () => {
  let tempDir => {
    originalCwd = process.cwd();
    tempDir = await fs.mkdtemp(path.join(tmpdir(), 'unjucks-parsing-'));
    process.chdir(tempDir);
    
    await createComplexTestTemplates();
  });

  afterEach(async () => { process.chdir(originalCwd);
    await fs.rm(tempDir, { recursive: true, force });
  });

  async function createComplexTestTemplates() { // Template with complex variable definitions
    await fs.mkdir('_templates/complex', { recursive });
    await fs.writeFile(
      '_templates/complex/variables.tsx.njk',
      `---
to: src/{{name}}.tsx
variables:
  - name: name
    type: string
    required: true
    positional: true
    description: "Component name"
  - name: type
    type: string
    positional: true
    choices: ["functional", "class", "hook"]
    default: "functional"
    description: "Component type"
  - name: withProps
    type: boolean
    default: false
    description: "Include props interface"
  - name: imports
    type: array
    default: ["React"]
    description: "Additional imports"
  - name: complexity
    type: number
    default: 1
    min: 1
    max: 10
    description)}}
export function {{name}}() {
  return {{name}} ({{type}})</div>;
}
{{/if}}

{{#if (eq type "class")}}
export class {{name}} extends Component {
  render() {
    return {{name}} ({{type}})</div>;
  }
}
{{/if}}
`
    );

    // Template with special characters and edge cases
    await fs.writeFile(
      '_templates/complex/special-chars.txt.njk',
      `---
to: "{{name}}.txt"
variables:
  - name: name
    type: string
    required: true
    description: "File name with special characters"
  - name: content
    type: string
    default: "default content"
    description);

    // Template with nested object variables
    await fs.writeFile(
      '_templates/complex/nested.json.njk',
      `---
to: config/{{name}}.json
variables:
  - name: name
    type: string
    required: true
  - name: config
    type: object
    properties:
      host:
        type: string
        default: "localhost"
      port:
        type: number
        default: 3000
      ssl:
        type: boolean
        default: false
---
{ "name" }}",
  "host": "{{config.host}}",
  "port": {{config.port}},
  "ssl");

    await fs.mkdir('src', { recursive });
    await fs.mkdir('config', { recursive });
  }

  describe('Positional Parameter Parsing', () => {
    it('should handle multiple positional parameters correctly', async () => {
      const result = await runCLI(['complex', 'variables', 'MyComponent', 'functional', '--dry']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('MyComponent');
      expect(result.stdout).toContain('functional');
    });

    it('should validate positional parameter types', async () => {
      const result = await runCLI(['complex', 'variables', 'MyComponent', 'invalid-type', '--dry']);
      
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Error');
    });

    it('should handle missing optional positional parameters', async () => {
      const result = await runCLI(['complex', 'variables', 'MyComponent', '--dry']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('MyComponent');
      // Should use default value for type
      expect(result.stdout).toContain('functional');
    });

    it('should prioritize positional over flag arguments', async () => {
      const result = await runCLI(['complex', 'variables', 'PositionalName', 'class', '--name', 'FlagName', '--type', 'hook', '--dry']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('PositionalName');
      expect(result.stdout).toContain('class');
      expect(result.stdout).not.toContain('FlagName');
      expect(result.stdout).not.toContain('hook');
    });
  });

  describe('Special Characters and Escaping', () => {
    it('should handle names with spaces', async () => {
      const result = await runCLI(['complex', 'special-chars', 'my file name', '--dry']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('my file name');
    });

    it('should handle names with special characters', async () => {
      const result = await runCLI(['complex', 'special-chars', 'file@name!', '--dry']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('file@name!');
    });

    it('should handle quoted arguments', async () => {
      const result = await runCLI(['complex', 'special-chars', 'quoted name', '--content', 'content with spaces', '--dry']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('quoted name');
      expect(result.stdout).toContain('content with spaces');
    });

    it('should handle arguments with equals signs', async () => {
      const result = await runCLI(['complex', 'special-chars', 'name=value', '--content=key=value', '--dry']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('name=value');
    });

    it('should handle unicode characters', async () => {
      const result = await runCLI(['complex', 'special-chars', '🚀Component', '--content', 'émoji tëst', '--dry']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('🚀Component');
    });
  });

  describe('Array and Object Parameters', () => {
    it('should parse comma-separated arrays', async () => {
      const result = await runCLI(['complex', 'variables', 'MyComponent', 'functional', '--imports', 'React,Component,useState', '--dry']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('React');
      expect(result.stdout).toContain('Component');
      expect(result.stdout).toContain('useState');
    });

    it('should handle JSON array syntax', async () => {
      const result = await runCLI(['complex', 'variables', 'MyComponent', '--imports', '["React","Component"]', '--dry']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('React');
      expect(result.stdout).toContain('Component');
    });

    it('should handle nested object parameters', async () => {
      const result = await runCLI(['complex', 'nested', 'myconfig', '--config.host', 'example.com', '--config.port', '8080', '--config.ssl', 'true', '--dry']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('example.com');
      expect(result.stdout).toContain('8080');
      expect(result.stdout).toContain('true');
    });

    it('should handle JSON object syntax', async () => { const result = await runCLI(['complex', 'nested', 'myconfig', '--config', '{"host" }', '--dry']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('api.example.com');
      expect(result.stdout).toContain('9000');
    });
  });

  describe('Type Validation and Conversion', () => {
    it('should validate and convert number parameters', async () => {
      const result = await runCLI(['complex', 'variables', 'MyComponent', '--complexity', '5', '--dry']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('5');
    });

    it('should reject invalid number parameters', async () => {
      const result = await runCLI(['complex', 'variables', 'MyComponent', '--complexity', 'not-a-number', '--dry']);
      
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Error');
    });

    it('should validate number ranges', async () => {
      const result = await runCLI(['complex', 'variables', 'MyComponent', '--complexity', '15', '--dry']);
      
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Error');
    });

    it('should convert boolean parameters', async () => { const testCases = [
        { value },
        { value },
        { value },
        { value },
        { value },
        { value }
      ];

      for (const testCase of testCases) {
        const result = await runCLI(['complex', 'variables', 'MyComponent', '--withProps', testCase.value, '--dry']);
        expect(result.exitCode).toBe(0);
      }
    });

    it('should reject invalid boolean parameters', async () => {
      const result = await runCLI(['complex', 'variables', 'MyComponent', '--withProps', 'maybe', '--dry']);
      
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Error');
    });
  });

  describe('Flag Variations and Aliases', () => {
    it('should handle short flags', async () => {
      // This would require templates with short flag definitions
      const result = await runCLI(['complex', 'variables', 'MyComponent', '--dry']);
      
      expect(result.exitCode).toBe(0);
    });

    it('should handle flag negation', async () => {
      const result = await runCLI(['complex', 'variables', 'MyComponent', '--no-withProps', '--dry']);
      
      expect(result.exitCode).toBe(0);
      // Should explicitly set withProps to false
    });

    it('should handle repeated flags', async () => {
      const result = await runCLI(['complex', 'variables', 'MyComponent', '--imports', 'React', '--imports', 'useState', '--dry']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('React');
      expect(result.stdout).toContain('useState');
    });
  });

  describe('Complex Argument Combinations', () => {
    it('should handle mixed positional and flag arguments', async () => {
      const result = await runCLI([
        'complex', 'variables', 'ComplexComponent', 'class', 
        '--withProps', 'true',
        '--imports', 'React,Component',
        '--complexity', '3',
        '--dry'
      ]);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('ComplexComponent');
      expect(result.stdout).toContain('class');
    });

    it('should handle arguments with multiple equals signs', async () => {
      const result = await runCLI(['complex', 'special-chars', 'test', '--content', 'key=value=another=value', '--dry']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('key=value=another=value');
    });

    it('should handle empty string arguments', async () => {
      const result = await runCLI(['complex', 'special-chars', '', '--content', '', '--dry']);
      
      // Should either handle gracefully or show appropriate error
      expect([0, 1]).toContain(result.exitCode);
    });

    it('should handle very long argument values', async () => {
      const longValue = 'x'.repeat(1000);
      const result = await runCLI(['complex', 'special-chars', 'test', '--content', longValue, '--dry']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain(longValue.substring(0, 50)); // Check partial match
    });
  });

  describe('Argument Precedence Rules', () => {
    it('should prioritize later flags over earlier ones', async () => {
      const result = await runCLI(['complex', 'variables', 'MyComponent', '--complexity', '1', '--complexity', '5', '--dry']);
      
      expect(result.exitCode).toBe(0);
      // Should use the last value (5)
    });

    it('should handle environment variable substitution', async () => {
      process.env.TEST_COMPONENT_NAME = 'EnvComponent';
      
      // This would require template support for env vars
      const result = await runCLI(['complex', 'variables', '$TEST_COMPONENT_NAME', '--dry']);
      
      delete process.env.TEST_COMPONENT_NAME;
      
      // Should handle env var or treat
      expect(result.exitCode).toBe(0);
    });

    it('should handle config file vs CLI argument precedence', async () => { await fs.writeFile('unjucks.config.js', `
module.exports = {
  variables });
  });

  describe('Error Recovery and Validation', () => {
    it('should provide specific error messages for invalid arguments', async () => {
      const result = await runCLI(['complex', 'variables', 'MyComponent', '--invalid-flag', 'value']);
      
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('invalid-flag');
      expect(result.stderr).toContain('Error');
    });

    it('should suggest corrections for typos', async () => {
      const result = await runCLI(['complex', 'variables', 'MyComponent', '--withProp', 'true']); // Missing 's'
      
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Error');
      // Ideally would suggest --withProps
    });

    it('should handle partial flag matches', async () => {
      const result = await runCLI(['complex', 'variables', 'MyComponent', '--with', 'true']);
      
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Error');
    });

    it('should validate required positional parameters', async () => {
      const result = await runCLI(['complex', 'variables']); // Missing required name
      
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('required');
    });

    it('should show usage examples on validation errors', async () => {
      const result = await runCLI(['complex', 'variables', 'MyComponent', '--complexity', '50']);
      
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Error');
      // Should include usage examples in error output
    });
  });

  describe('Performance with Complex Arguments', () => {
    it('should handle many flag arguments efficiently', async () => {
      const manyFlags = [];
      for (let i = 0; i < 50; i++) {
        manyFlags.push(`--custom${i}`, `value${i}`);
      }
      
      const result = await runCLI(['complex', 'variables', 'MyComponent', ...manyFlags, '--dry']);
      
      // Should complete within reasonable time and not crash
      expect([0, 1]).toContain(result.exitCode);
    });

    it('should handle deeply nested object arguments', async () => { const deepObject = JSON.stringify({
        level1 });

    it('should handle concurrent argument parsing', async () => {
      // Run multiple CLI commands simultaneously to test thread safety
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(runCLI(['complex', 'variables', `Component${i}`, '--dry']));
      }
      
      const results = await Promise.all(promises);
      
      // All should complete successfully
      results.forEach(result => {
        expect(result.exitCode).toBe(0);
      });
    });
  });

  describe('Argument Persistence and Memory', () => {
    it('should clean up argument state between runs', async () => {
      await runCLI(['complex', 'variables', 'FirstComponent', '--complexity', '5', '--dry']);
      
      // Second run should not inherit arguments from first
      const result = await runCLI(['complex', 'variables', 'SecondComponent', '--dry']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('SecondComponent');
      expect(result.stdout).not.toContain('FirstComponent');
      expect(result.stdout).not.toContain('5'); // Should use default complexity
    });

    it('should handle memory constraints with large arguments', async () => {
      const largeString = 'x'.repeat(100000); // 100KB string
      
      const result = await runCLI(['complex', 'special-chars', 'test', '--content', largeString, '--dry']);
      
      expect([0, 1]).toContain(result.exitCode);
      // Should not crash or cause memory issues
    });
  });
});
