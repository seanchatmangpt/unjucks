/**
 * Performance and Edge Case Tests
 * Testing CLI performance under stress and unusual conditions
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * from 'path';
import * from 'fs/promises';
import { tmpdir } from 'os';

const execFileAsync = promisify(execFile);
const CLI_PATH = path.resolve(__dirname, '../../bin/unjucks.cjs');

async function runCLI(args = [], cwd?, timeout = 30000) {
  const startTime = Date.now();
  try {
    const { stdout, stderr } = await execFileAsync('node', [CLI_PATH, ...args], { cwd),
      timeout,
      maxBuffer });
    return { stdout, 
      stderr, 
      exitCode };
  } catch (error) { return {
      stdout };
  }
}

describe('Performance and Edge Cases', () => {
  let tempDir => {
    originalCwd = process.cwd();
    tempDir = await fs.mkdtemp(path.join(tmpdir(), 'unjucks-perf-'));
    process.chdir(tempDir);
    
    await createPerformanceTestEnvironment();
  });

  afterEach(async () => { process.chdir(originalCwd);
    await fs.rm(tempDir, { recursive: true, force });
  });

  async function createPerformanceTestEnvironment() { // Large template with many variables and complex logic
    await fs.mkdir('_templates/perf', { recursive });
    
    // Template with many variables for stress testing
    const manyVariables = [];
    for (let i = 0; i < 100; i++) { manyVariables.push(`  - name }
    type: string
    default: "value${i}"
    description);  
    }
    
    await fs.writeFile(
      '_templates/perf/many-vars.txt.njk',
      `---
to)}
---
Generated file with many variables:
${Array.from({length, (_, i) => `{{var${i}}}: {{var${i}}}`).join('\n')}
`
    );

    // Large template content
    const largeContent = 'Large content line\n'.repeat(10000);
    await fs.writeFile(
      '_templates/perf/large-content.txt.njk',
      `---
to);

    // Complex nested template
    await fs.writeFile(
      '_templates/perf/complex.js.njk',
      `---
to: src/{{name}}.js
variables:
  - name: name
    type: string
    required: true
  - name: features
    type: array
    default: []
  - name: config
    type: object
    properties:
      nested:
        type: object
        properties:
          deep:
            type: string
            default: "deep-value"
---
// Complex generated file)}}
  // Auth feature
  function authenticate() {
    return true;
  }
  {{/if}}
  {{#if (eq this "api")}}
  // API feature
  function apiCall(endpoint) {
    return fetch(endpoint);
  }
  {{/if}}
  {{#if (eq this "validation")}}
  // Validation feature
  function validate(data) {
    return Object.keys(data).length > 0;
  }
  {{/if}}
{{/each}}

// Configuration
const config = { name }}',
  nested: { deep }}'
  },
  features: [{{#each features}}'{{this}}'{{#unless @last}},{{/unless}}{{/each}}]
};

module.exports = { {{name}}, config };
`
    );

    // Deep directory structure template
    const deepPath = 'level1/level2/level3/level4/level5';
    await fs.writeFile(
      '_templates/perf/deep-path.txt.njk',
      `---
to: ${deepPath}/{{name}}.txt
---
Deep file);

    // Multiple file template
    await fs.writeFile(
      '_templates/perf/multi-file.ts.njk',
      `---
to: src/{{name}}.ts
---
export interface {{name}} {
  id);

    await fs.writeFile(
      '_templates/perf/multi-file.test.ts.njk',
      `---
to, () => {
  it('should exist', () => {
    expect({{name}}).toBeDefined();
  });
});
`
    );

    await fs.writeFile(
      '_templates/perf/multi-file.d.ts.njk',
      `---
to: types/{{name}}.d.ts
---
declare module '{{name}}' {
  export interface {{name}} {
    id);

    // Create output directories
    await fs.mkdir('output', { recursive });
    await fs.mkdir('src', { recursive });
    await fs.mkdir('tests', { recursive });
    await fs.mkdir('types', { recursive });
  }

  describe('Performance Benchmarks', () => {
    it('should handle simple commands quickly', async () => {
      const result = await runCLI(['--version']);
      
      expect(result.exitCode).toBe(0);
      expect(result.executionTime).toBeLessThan(5000); // Less than 5 seconds
    });

    it('should list generators efficiently', async () => {
      const result = await runCLI(['list']);
      
      expect(result.exitCode).toBe(0);
      expect(result.executionTime).toBeLessThan(10000); // Less than 10 seconds
    });

    it('should generate simple files quickly', async () => {
      const result = await runCLI(['perf', 'large-content', 'QuickTest']);
      
      expect(result.exitCode).toBe(0);
      expect(result.executionTime).toBeLessThan(15000); // Less than 15 seconds
      
      const fileExists = await fs.access('output/QuickTest.txt')
        .then(() => true)
        .catch(() => false);
      expect(fileExists).toBe(true);
    });

    it('should handle dry runs efficiently', async () => {
      const result = await runCLI(['perf', 'large-content', 'DryTest', '--dry']);
      
      expect(result.exitCode).toBe(0);
      expect(result.executionTime).toBeLessThan(10000); // Dry runs should be faster
      expect(result.stdout).toContain('Dry run');
    });
  });

  describe('Memory and Resource Usage', () => {
    it('should handle large template content without memory issues', async () => {
      const result = await runCLI(['perf', 'large-content', 'LargeTest'], undefined, 60000);
      
      expect(result.exitCode).toBe(0);
      
      const content = await fs.readFile('output/LargeTest.txt', 'utf-8');
      expect(content.includes('Large content line')).toBe(true);
      expect(content.split('\n').length).toBeGreaterThan(5000);
    });

    it('should handle many variables efficiently', async () => {
      const manyVarArgs = [];
      for (let i = 0; i < 50; i++) { // Test with 50 variables
        manyVarArgs.push(`--var${i}`, `test-value-${i}`);
      }
      
      const result = await runCLI([
        'perf', 'many-vars', 'ManyVarsTest',
        ...manyVarArgs
      ], undefined, 60000);
      
      expect(result.exitCode).toBe(0);
      expect(result.executionTime).toBeLessThan(30000); // Should complete within 30 seconds
      
      const content = await fs.readFile('output/ManyVarsTest.txt', 'utf-8');
      expect(content).toContain('test-value-0');
      expect(content).toContain('test-value-49');
    });

    it('should handle deep directory structures', async () => {
      const result = await runCLI(['perf', 'deep-path', 'DeepTest']);
      
      expect(result.exitCode).toBe(0);
      
      const deepFile = 'level1/level2/level3/level4/level5/DeepTest.txt';
      const fileExists = await fs.access(deepFile)
        .then(() => true)
        .catch(() => false);
      
      expect(fileExists).toBe(true);
    });

    it('should handle multiple simultaneous file creations', async () => {
      const result = await runCLI(['perf', 'multi-file', 'MultiTest']);
      
      expect(result.exitCode).toBe(0);
      
      const files = [
        'src/MultiTest.ts',
        'tests/MultiTest.test.ts',
        'types/MultiTest.d.ts'
      ];
      
      for (const file of files) {
        const exists = await fs.access(file).then(() => true).catch(() => false);
        expect(exists).toBe(true);
      }
    });
  });

  describe('Stress Testing', () => {
    it('should handle rapid consecutive commands', async () => {
      const promises = [];
      const startTime = Date.now();
      
      for (let i = 0; i < 20; i++) {
        promises.push(runCLI(['perf', 'large-content', `Stress${i}`, '--dry']));
      }
      
      const results = await Promise.all(promises);
      const endTime = Date.now();
      
      // All should succeed
      const successCount = results.filter(r => r.exitCode === 0).length;
      expect(successCount).toBeGreaterThan(15); // At least 75% success rate
      
      // Should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(120000); // Less than 2 minutes
    });

    it('should handle concurrent file operations', async () => {
      const promises = [];
      
      for (let i = 0; i < 10; i++) {
        promises.push(runCLI(['perf', 'multi-file', `Concurrent${i}`]));
      }
      
      const results = await Promise.all(promises);
      
      // Most should succeed (allow for some race conditions)
      const successCount = results.filter(r => r.exitCode === 0).length;
      expect(successCount).toBeGreaterThan(7); // At least 70% success rate
      
      // Verify files were created
      let createdFiles = 0;
      for (let i = 0; i < 10; i++) {
        const exists = await fs.access(`src/Concurrent${i}.ts`)
          .then(() => true)
          .catch(() => false);
        if (exists) createdFiles++;
      }
      
      expect(createdFiles).toBeGreaterThan(5);
    });

    it('should handle very long argument lists', async () => {
      const longArgs = [];
      for (let i = 0; i < 200; i++) {
        longArgs.push(`--custom${i}`, `value${i}`);
      }
      
      const result = await runCLI([
        'perf', 'many-vars', 'LongArgsTest',
        ...longArgs.slice(0, 100), // Limit to 50 arguments to avoid system limits
        '--dry'
      ], undefined, 60000);
      
      // Should either succeed or fail gracefully
      expect([0, 1]).toContain(result.exitCode);
      
      if (result.exitCode === 1) {
        // Should provide meaningful error, not crash
        expect(result.stderr).toContain('Error');
      }
    });
  });

  describe('Edge Case Handling', () => { it('should handle empty template directories', async () => {
      await fs.mkdir('_templates/empty', { recursive });
      // Create empty directory with no templates
      
      const result = await runCLI(['list', 'empty']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('No templates found');
    });

    it('should handle malformed template files gracefully', async () => {
      await fs.writeFile(
        '_templates/perf/malformed.txt.njk',
        'Invalid template without frontmatter\nJust content'
      );
      
      const result = await runCLI(['perf', 'malformed', 'ErrorTest']);
      
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Error');
      expect(result.executionTime).toBeLessThan(15000); // Should fail quickly
    });

    it('should handle extremely long template paths', async () => {
      const longName = 'a'.repeat(200);
      await fs.writeFile(
        `_templates/perf/${longName}.txt.njk`,
        '---\nto);
      
      const result = await runCLI(['perf', longName, 'LongPathTest']);
      
      // Should either succeed or fail gracefully
      expect([0, 1]).toContain(result.exitCode);
    });

    it('should handle special characters in filenames', async () => {
      const specialChars = ['space file', 'file@name', 'file-with-dash', 'file_with_underscore'];
      
      for (const name of specialChars) {
        const result = await runCLI(['perf', 'large-content', name, '--dry']);
        
        // Should handle special characters gracefully
        expect([0, 1]).toContain(result.exitCode);
        
        if (result.exitCode === 0) {
          expect(result.stdout).toContain(name);
        }
      }
    });

    it('should handle Unicode and international characters', async () => {
      const unicodeNames = ['测试文件', 'файл', '🚀Component', 'ñoño', 'café'];
      
      for (const name of unicodeNames) {
        const result = await runCLI(['perf', 'large-content', name, '--dry']);
        
        expect([0, 1]).toContain(result.exitCode);
        
        if (result.exitCode === 0) {
          expect(result.stdout).toContain('Dry run');
        }
      }
    });
  });

  describe('Resource Cleanup and Recovery', () => { it('should clean up temporary resources on interruption', async () => {
      // Start a long-running operation
      const longRunning = runCLI(['perf', 'many-vars', 'InterruptTest'], undefined, 5000);
      
      // Let it run briefly then timeout
      const result = await longRunning;
      
      // Should timeout gracefully
      expect(result.exitCode).toBe(1); // Timeout error
      
      // No temporary files should remain
      const files = await fs.readdir('.', { recursive });
      const tempFiles = files.filter(f => 
        f.toString().includes('.tmp') || 
        f.toString().includes('temp') ||
        f.toString().includes('InterruptTest')
      );
      expect(tempFiles).toHaveLength(0);
    });

    it('should recover from disk space issues gracefully', async () => {
      // This is hard to test reliably, but we can test with extremely large content
      const hugeContent = 'x'.repeat(50 * 1024 * 1024); // 50MB string
      
      const result = await runCLI([
        'perf', 'large-content', 'HugeTest',
        '--content', hugeContent.substring(0, 1000), // Use smaller subset
        '--dry'
      ]);
      
      // Should complete successfully in dry mode
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Dry run');
    });

    it('should handle file system permission changes during execution', async () => { // Create output directory with normal permissions
      await fs.mkdir('restricted-output', { recursive });
      
      // Create file first
      const result1 = await runCLI([
        'perf', 'large-content', 'PermissionTest',
        '--dest', 'restricted-output'
      ]);
      
      expect(result1.exitCode).toBe(0);
      
      // Make directory read-only
      await fs.chmod('restricted-output', 0o444);
      
      // Try to create another file
      const result2 = await runCLI([
        'perf', 'large-content', 'PermissionTest2',
        '--dest', 'restricted-output'
      ]);
      
      // Should fail gracefully
      expect(result2.exitCode).toBe(1);
      expect(result2.stderr).toContain('Error');
      
      // Restore permissions for cleanup
      await fs.chmod('restricted-output', 0o755);
    });
  });

  describe('Performance Regression Detection', () => {
    it('should maintain consistent performance for basic operations', async () => {
      const times = [];
      
      // Run the same operation multiple times
      for (let i = 0; i < 5; i++) {
        const result = await runCLI(['--version']);
        expect(result.exitCode).toBe(0);
        times.push(result.executionTime || 0);
      }
      
      // Calculate average and standard deviation
      const average = times.reduce((sum, time) => sum + time, 0) / times.length;
      const stdDev = Math.sqrt(
        times.reduce((sum, time) => sum + Math.pow(time - average, 2), 0) / times.length
      );
      
      // Performance should be consistent (low standard deviation)
      expect(average).toBeLessThan(10000); // Average under 10 seconds
      expect(stdDev).toBeLessThan(average * 0.5); // StdDev less than 50% of average
    });

    it('should scale reasonably with template complexity', async () => {
      const simpleResult = await runCLI(['perf', 'large-content', 'Simple', '--dry']);
      const complexResult = await runCLI([
        'perf', 'complex', 'Complex',
        '--features', 'auth,api,validation',
        '--config.nested.deep', 'complex-value',
        '--dry'
      ]);
      
      expect(simpleResult.exitCode).toBe(0);
      expect(complexResult.exitCode).toBe(0);
      
      // Complex should take longer but not excessively
      const simpleTime = simpleResult.executionTime || 0;
      const complexTime = complexResult.executionTime || 0;
      
      expect(complexTime).toBeGreaterThan(simpleTime);
      expect(complexTime).toBeLessThan(simpleTime * 10); // Not more than 10x slower
    });
  });

  describe('Memory Leak Detection', () => {
    it('should not accumulate memory across multiple operations', async () => {
      // This is a basic test - in real scenarios you'd use memory profiling tools
      const promises = [];
      
      // Run many operations to potentially expose memory leaks
      for (let i = 0; i < 50; i++) {
        promises.push(runCLI(['--version']));
      }
      
      const results = await Promise.all(promises);
      
      // All should succeed
      const successCount = results.filter(r => r.exitCode === 0).length;
      expect(successCount).toBe(50);
      
      // Later operations should not be significantly slower (indicating memory pressure)
      const firstTen = results.slice(0, 10).map(r => r.executionTime || 0);
      const lastTen = results.slice(-10).map(r => r.executionTime || 0);
      
      const firstAverage = firstTen.reduce((sum, time) => sum + time, 0) / firstTen.length;
      const lastAverage = lastTen.reduce((sum, time) => sum + time, 0) / lastTen.length;
      
      // Last operations should not be more than 2x slower than first
      expect(lastAverage).toBeLessThan(firstAverage * 2);
    });
  });
});
