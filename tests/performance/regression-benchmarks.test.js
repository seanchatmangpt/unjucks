/**
 * Performance Regression Tests
 * Ensures performance doesn't degrade over time
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawn } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
import { performance } from 'perf_hooks';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');
const cliPath = path.join(projectRoot, 'bin/unjucks.cjs');

// Performance thresholds (in milliseconds)
const PERFORMANCE_THRESHOLDS = {
  CLI_STARTUP: 2000,
  VERSION_CHECK: 1000,
  HELP_DISPLAY: 1500,
  LIST_GENERATORS: 3000,
  SIMPLE_GENERATION: 5000,
  COMPLEX_GENERATION: 10000,
  TEMPLATE_PARSING: 1000,
  FILE_OPERATIONS: 2000
};

// Memory thresholds (in MB)
const MEMORY_THRESHOLDS = {
  INITIAL_HEAP: 50,
  AFTER_OPERATION: 100,
  MEMORY_LEAK_THRESHOLD: 10
};

describe('Performance Regression Tests', () => {
  let tempDir;
  let originalCwd;
  let performanceBaseline;

  beforeEach(async () => {
    originalCwd = process.cwd();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'unjucks-perf-'));
    process.chdir(tempDir);

    // Set up test environment
    await fs.ensureDir('_templates');
    await createPerformanceTemplates();

    // Establish performance baseline
    performanceBaseline = await establishBaseline();
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fs.remove(tempDir);
  });

  describe('CLI Startup Performance', () => {
    it('should start CLI within performance threshold', async () => {
      const times = [];
      
      // Run multiple iterations for statistical significance
      for (let i = 0; i < 5; i++) {
        const start = performance.now();
        const result = await execCLI(['--version']);
        const duration = performance.now() - start;
        
        expect(result.exitCode).toBe(0);
        times.push(duration);
      }

      const avgTime = times.reduce((a, b) => a + b) / times.length;
      expect(avgTime).toBeLessThan(PERFORMANCE_THRESHOLDS.CLI_STARTUP);
    });

    it('should show help within performance threshold', async () => {
      const start = performance.now();
      const result = await execCLI(['--help']);
      const duration = performance.now() - start;

      expect(result.exitCode).toBe(0);
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.HELP_DISPLAY);
    });

    it('should list generators within performance threshold', async () => {
      const start = performance.now();
      const result = await execCLI(['list']);
      const duration = performance.now() - start;

      expect(result.exitCode).toBe(0);
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.LIST_GENERATORS);
    });
  });

  describe('Template Generation Performance', () => {
    it('should generate simple template within threshold', async () => {
      const start = performance.now();
      const result = await execCLI(['simple', 'component', 'TestComponent']);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.SIMPLE_GENERATION);
    });

    it('should generate complex template within threshold', async () => {
      const start = performance.now();
      const result = await execCLI(['complex', 'service', 'TestService']);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.COMPLEX_GENERATION);
    });

    it('should handle large template efficiently', async () => {
      const start = performance.now();
      const result = await execCLI(['large', 'dataset', 'TestData']);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.COMPLEX_GENERATION);
    });
  });

  describe('Memory Usage Performance', () => {
    it('should not leak memory during operations', async () => {
      global.gc && global.gc(); // Force garbage collection if available
      const initialMemory = process.memoryUsage().heapUsed;

      // Perform multiple operations
      for (let i = 0; i < 10; i++) {
        await execCLI(['--version']);
        await execCLI(['list']);
      }

      global.gc && global.gc(); // Force garbage collection
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = (finalMemory - initialMemory) / (1024 * 1024); // Convert to MB

      expect(memoryIncrease).toBeLessThan(MEMORY_THRESHOLDS.MEMORY_LEAK_THRESHOLD);
    });

    it('should maintain reasonable memory footprint', async () => {
      const memoryUsage = process.memoryUsage();
      const heapUsedMB = memoryUsage.heapUsed / (1024 * 1024);

      expect(heapUsedMB).toBeLessThan(MEMORY_THRESHOLDS.INITIAL_HEAP);
    });
  });

  describe('Concurrent Operations Performance', () => {
    it('should handle concurrent CLI calls efficiently', async () => {
      const concurrentOperations = 5;
      const operations = [];

      const start = performance.now();
      for (let i = 0; i < concurrentOperations; i++) {
        operations.push(execCLI(['--version']));
      }

      const results = await Promise.all(operations);
      const duration = performance.now() - start;

      results.forEach(result => {
        expect(result.exitCode).toBe(0);
      });

      // Should complete all concurrent operations within reasonable time
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.CLI_STARTUP * 2);
    });

    it('should maintain performance under load', async () => {
      const loadTestOperations = 20;
      const times = [];

      for (let i = 0; i < loadTestOperations; i++) {
        const start = performance.now();
        const result = await execCLI(['--version']);
        const duration = performance.now() - start;
        
        expect(result.exitCode).toBe(0);
        times.push(duration);
      }

      // Check that performance doesn't degrade significantly under load
      const firstBatch = times.slice(0, 5).reduce((a, b) => a + b) / 5;
      const lastBatch = times.slice(-5).reduce((a, b) => a + b) / 5;
      const degradation = (lastBatch - firstBatch) / firstBatch;

      expect(degradation).toBeLessThan(0.5); // Less than 50% degradation
    });
  });

  describe('File System Performance', () => {
    it('should handle large directory structures efficiently', async () => {
      // Create deep directory structure
      const deepPath = path.join('_templates', 'deep', 'nested', 'structure', 'test');
      await fs.ensureDir(deepPath);
      await fs.writeFile(path.join(deepPath, 'template.njk'), 'Test template');

      const start = performance.now();
      const result = await execCLI(['list']);
      const duration = performance.now() - start;

      expect(result.exitCode).toBe(0);
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.LIST_GENERATORS);
    });

    it('should handle many template files efficiently', async () => {
      // Create many template files
      for (let i = 0; i < 50; i++) {
        const templateDir = path.join('_templates', `template${i}`, 'new');
        await fs.ensureDir(templateDir);
        await fs.writeFile(path.join(templateDir, 'file.njk'), `Template ${i}`);
      }

      const start = performance.now();
      const result = await execCLI(['list']);
      const duration = performance.now() - start;

      expect(result.exitCode).toBe(0);
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.LIST_GENERATORS * 2);
    });
  });

  describe('Performance Regression Detection', () => {
    it('should not regress from baseline performance', async () => {
      const currentPerformance = await measureCurrentPerformance();
      
      // Allow up to 20% performance degradation
      const maxAllowedRegression = 0.2;
      
      Object.keys(currentPerformance).forEach(operation => {
        const baseline = performanceBaseline[operation];
        const current = currentPerformance[operation];
        
        if (baseline && current) {
          const regression = (current - baseline) / baseline;
          expect(regression).toBeLessThan(maxAllowedRegression);
        }
      });
    });
  });

  describe('CPU and Resource Utilization', () => {
    it('should not consume excessive CPU during operations', async () => {
      const startUsage = process.cpuUsage();
      
      // Perform CPU-intensive operation
      await execCLI(['complex', 'service', 'TestService']);
      
      const endUsage = process.cpuUsage(startUsage);
      const totalCPUTime = (endUsage.user + endUsage.system) / 1000000; // Convert to seconds
      
      // Should not consume more than 5 seconds of CPU time
      expect(totalCPUTime).toBeLessThan(5);
    });
  });
});

/**
 * Create performance test templates
 */
async function createPerformanceTemplates() {
  // Simple template
  await fs.ensureDir('_templates/simple/component');
  await fs.writeFile(
    '_templates/simple/component/component.js.njk',
    'export const {{ name }} = () => "{{ name }}";'
  );

  // Complex template
  await fs.ensureDir('_templates/complex/service');
  await fs.writeFile(
    '_templates/complex/service/service.js.njk',
    `// {{ name }} Service
export class {{ name }} {
  constructor() {
    this.name = '{{ name }}';
    this.initialized = false;
  }

  async initialize() {
    this.initialized = true;
    return this;
  }

  {% for method in methods -%}
  async {{ method }}() {
    return '{{ method }} result';
  }
  
  {% endfor %}
}`
  );

  // Large template with loops
  await fs.ensureDir('_templates/large/dataset');
  await fs.writeFile(
    '_templates/large/dataset/data.js.njk',
    `export const {{ name }} = [
{% for i in range(0, 1000) -%}
  { id: {{ i }}, name: 'Item {{ i }}', value: Math.random() },
{% endfor %}
];`
  );
}

/**
 * Establish performance baseline
 */
async function establishBaseline() {
  return {
    version: await measureOperation(() => execCLI(['--version'])),
    help: await measureOperation(() => execCLI(['--help'])),
    list: await measureOperation(() => execCLI(['list'])),
    simpleGeneration: await measureOperation(() => execCLI(['simple', 'component', 'Test']))
  };
}

/**
 * Measure current performance
 */
async function measureCurrentPerformance() {
  return {
    version: await measureOperation(() => execCLI(['--version'])),
    help: await measureOperation(() => execCLI(['--help'])),
    list: await measureOperation(() => execCLI(['list'])),
    simpleGeneration: await measureOperation(() => execCLI(['simple', 'component', 'Test']))
  };
}

/**
 * Measure operation duration
 */
async function measureOperation(operation) {
  const start = performance.now();
  await operation();
  return performance.now() - start;
}

/**
 * Execute CLI command
 */
function execCLI(args = []) {
  return new Promise((resolve) => {
    const child = spawn('node', [cliPath, ...args], {
      cwd: process.cwd(),
      env: { ...process.env, NODE_ENV: 'test' },
      timeout: 30000
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (exitCode) => {
      resolve({ exitCode: exitCode || 0, stdout, stderr });
    });

    child.on('error', (error) => {
      resolve({ exitCode: 1, stdout, stderr: error.message });
    });
  });
}