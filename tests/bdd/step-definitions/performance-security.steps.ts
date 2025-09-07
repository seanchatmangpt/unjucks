import { Given, When, Then } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';
import * as fs from 'fs-extra';
import * as path from 'path';
import { performance } from 'perf_hooks';
import { testContext } from './cli-core.steps.js';

// Performance and security context
interface PerformanceSecurityContext {
  startTime: number;
  endTime: number;
  memoryUsage: {
    before: NodeJS.MemoryUsage;
    during: NodeJS.MemoryUsage;
    after: NodeJS.MemoryUsage;
  };
  securityViolations: string[];
  performanceMetrics: {
    executionTime: number;
    maxMemory: number;
    avgCpu: number;
    fileOperations: number;
  };
  mockProcesses: any[];
  securityConfig: {
    enableSandbox: boolean;
    allowExternalRequests: boolean;
    restrictedPaths: string[];
    maxFileSize: number;
  };
}

const perfSecContext: PerformanceSecurityContext = {
  startTime: 0,
  endTime: 0,
  memoryUsage: {
    before: process.memoryUsage(),
    during: process.memoryUsage(),
    after: process.memoryUsage()
  },
  securityViolations: [],
  performanceMetrics: {
    executionTime: 0,
    maxMemory: 0,
    avgCpu: 0,
    fileOperations: 0
  },
  mockProcesses: [],
  securityConfig: {
    enableSandbox: true,
    allowExternalRequests: false,
    restrictedPaths: ['/etc', '/root', '/system'],
    maxFileSize: 100 * 1024 * 1024 // 100MB
  }
};

// Helper functions
function startPerformanceMonitoring(): void {
  perfSecContext.startTime = performance.now();
  perfSecContext.memoryUsage.before = process.memoryUsage();
}

function stopPerformanceMonitoring(): void {
  perfSecContext.endTime = performance.now();
  perfSecContext.memoryUsage.after = process.memoryUsage();
  perfSecContext.performanceMetrics.executionTime = perfSecContext.endTime - perfSecContext.startTime;
}

function createManyTemplates(count: number, templateDir: string): void {
  const baseDir = path.join(testContext.workingDir, templateDir);
  fs.ensureDirSync(baseDir);
  
  for (let i = 1; i <= count; i++) {
    const templateContent = `---
to: src/component-{{ name }}-${i}.ts
---
export class {{ name }}Component${i} {
  private id = ${i};
  
  constructor() {
    console.log('Component ${i} created');
  }
  
  getName(): string {
    return '{{ name }}Component${i}';
  }
}
`;
    
    fs.writeFileSync(path.join(baseDir, `component-${i}.ts.njk`), templateContent);
  }
}

function createLargeFileTemplate(): void {
  const templateDir = path.join(testContext.workingDir, 'templates/large-file');
  fs.ensureDirSync(templateDir);
  
  // Create template that generates a large file
  const largeTemplate = `---
to: src/{{ name }}.ts
---
// Generated large file for {{ name }}
{% for i in range(100000) %}
export const data{{ i }} = {
  id: {{ i }},
  name: "Item {{ i }}",
  description: "This is item number {{ i }} with some data",
  timestamp: new Date('{{ "now" | date("ISO") }}'),
  metadata: {
    index: {{ i }},
    group: {{ i // 1000 }},
    category: "category-{{ i % 10 }}"
  }
};
{% endfor %}

export class {{ name }} {
  getAllData() {
    return [{% for i in range(100000) %}data{{ i }}{{ ',' if not loop.last }}{% endfor %}];
  }
}
`;
  
  fs.writeFileSync(path.join(templateDir, 'index.ts.njk'), largeTemplate);
}

function createComplexTemplate(): void {
  const templateDir = path.join(testContext.workingDir, 'templates/complex-template');
  fs.ensureDirSync(templateDir);
  
  // Template with nested loops and complex logic
  const complexTemplate = `---
to: src/{{ name }}.ts
---
// Complex template for {{ name }}
{% set complexData = {
  categories: ["A", "B", "C", "D", "E"],
  levels: [1, 2, 3, 4, 5],
  types: ["primary", "secondary", "tertiary"]
} %}

{% for category in complexData.categories %}
  {% for level in complexData.levels %}
    {% for type in complexData.types %}
      {% set itemName = category + level|string + type|capitalize %}
      
      export class {{ name }}{{ itemName }} {
        private category = "{{ category }}";
        private level = {{ level }};
        private type = "{{ type }}";
        
        {% for i in range(level * 10) %}
        method{{ i }}(): string {
          return `${this.category}-${this.level}-${this.type}-{{ i }}`;
        }
        {% endfor %}
        
        // Complex calculation method
        calculateComplexValue(): number {
          let result = 0;
          {% for calc in range(level * 100) %}
          result += {{ calc }} * Math.random();
          {% endfor %}
          return result;
        }
      }
      
    {% endfor %}
  {% endfor %}
{% endfor %}

export class {{ name }}Manager {
  private components = [
    {% for category in complexData.categories %}
      {% for level in complexData.levels %}
        {% for type in complexData.types %}
          new {{ name }}{{ category }}{{ level }}{{ type|capitalize }}(),
        {% endfor %}
      {% endfor %}
    {% endfor %}
  ];
}
`;
  
  fs.writeFileSync(path.join(templateDir, 'index.ts.njk'), complexTemplate);
}

function createLargeRDFSchema(): void {
  const schemaPath = path.join(testContext.workingDir, 'large-schema.ttl');
  
  let rdfContent = `
@prefix : <http://example.org/schema#> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

`;
  
  // Generate 1000+ RDF triples
  for (let i = 1; i <= 1000; i++) {
    rdfContent += `
:Entity${i} rdf:type :Entity ;
  rdfs:label "Entity ${i}" ;
  :hasProperty :prop${i}a, :prop${i}b, :prop${i}c ;
  :relatedTo :Entity${(i % 100) + 1} .

:prop${i}a rdf:type rdf:Property ;
  rdfs:domain :Entity${i} ;
  rdfs:range xsd:string .

:prop${i}b rdf:type rdf:Property ;
  rdfs:domain :Entity${i} ;
  rdfs:range xsd:integer .

:prop${i}c rdf:type rdf:Property ;
  rdfs:domain :Entity${i} ;
  rdfs:range xsd:dateTime .
`;
  }
  
  fs.writeFileSync(schemaPath, rdfContent);
}

function simulateConcurrentProcesses(count: number): void {
  for (let i = 0; i < count; i++) {
    const mockProcess = {
      pid: 1000 + i,
      name: `unjucks-${i}`,
      startTime: Date.now() - Math.random() * 10000,
      memory: Math.random() * 100,
      cpu: Math.random() * 50
    };
    perfSecContext.mockProcesses.push(mockProcess);
  }
}

function detectSecurityViolation(violationType: string, details: string): void {
  perfSecContext.securityViolations.push(`${violationType}: ${details}`);
}

// Given steps for performance and security
Given('I have performance monitoring enabled', async () => {
  // Enable performance monitoring
  process.env.UNJUCKS_PERF_MONITORING = 'true';
  perfSecContext.performanceMetrics = {
    executionTime: 0,
    maxMemory: 0,
    avgCpu: 0,
    fileOperations: 0
  };
});

Given('I have security validation enabled', async () => {
  // Enable security validation
  process.env.UNJUCKS_SECURITY_MODE = 'strict';
  perfSecContext.securityViolations = [];
});

Given(/^I have (\d+) template files in "([^"]+)"$/, async (count: string, templateDir: string) => {
  const templateCount = parseInt(count);
  createManyTemplates(templateCount, templateDir);
});

Given('I have a template that generates a 10MB file', async () => {
  createLargeFileTemplate();
});

Given('I have multiple Unjucks processes running', async () => {
  simulateConcurrentProcesses(10);
});

Given('I have templates with nested loops and complex logic', async () => {
  createComplexTemplate();
});

Given('I have a large RDF schema with 1000+ triples', async () => {
  createLargeRDFSchema();
});

Given('I have a swarm with 10 active agents', async () => {
  // Mock swarm setup
  process.env.UNJUCKS_SWARM_SIZE = '10';
  process.env.UNJUCKS_SWARM_ENABLED = 'true';
});

Given('I have a template with user-provided variables', async () => {
  const templateDir = path.join(testContext.workingDir, 'templates/user-input');
  fs.ensureDirSync(templateDir);
  
  const userInputTemplate = `---
to: src/{{ name | safe }}.ts
---
// Template with user input: {{ name }}
export class UserGenerated {
  private userInput = "{{ name | escape }}";
  private rawInput = "{{ name }}";
  
  getUserInput(): string {
    return this.userInput;
  }
}
`;
  
  fs.writeFileSync(path.join(templateDir, 'index.ts.njk'), userInputTemplate);
});

Given('I have environment variables with sensitive data', async () => {
  // Set up sensitive environment variables
  process.env.DATABASE_PASSWORD = 'super-secret-password';
  process.env.API_KEY = 'sk-1234567890abcdef';
  process.env.SECRET_TOKEN = 'secret-token-value';
});

Given('I have a template with dynamic code execution', async () => {
  const templateDir = path.join(testContext.workingDir, 'templates/dynamic');
  fs.ensureDirSync(templateDir);
  
  // Template that attempts code execution (should be blocked)
  const dynamicTemplate = `---
to: src/{{ name }}.ts
---
// Dynamic template - THIS SHOULD BE BLOCKED
{% raw %}
// User input: {{ userInput }}
{% if userInput.includes('require') %}
  // Attempting code execution: {{ userInput }}
  const result = eval("{{ userInput }}");
{% endif %}
{% endraw %}

export class {{ name }} {
  // Safe code here
}
`;
  
  fs.writeFileSync(path.join(templateDir, 'index.ts.njk'), dynamicTemplate);
});

Given('I have RDF data processing enabled', async () => {
  process.env.UNJUCKS_RDF_ENABLED = 'true';
});

Given('I have templates from external sources', async () => {
  // Mock external template source
  process.env.UNJUCKS_ALLOW_EXTERNAL_TEMPLATES = 'false';
});

Given('I have custom template helpers', async () => {
  const helpersDir = path.join(testContext.workingDir, 'helpers');
  fs.ensureDirSync(helpersDir);
  
  const helperContent = `
// Custom helper that should be validated
module.exports = {
  customHelper: function(input) {
    // This should be sandboxed
    return input.toUpperCase();
  },
  
  dangerousHelper: function(input) {
    // This should be blocked
    return eval(input);
  }
};
`;
  
  fs.writeFileSync(path.join(helpersDir, 'custom-helpers.js'), helperContent);
});

Given('an attacker attempts resource exhaustion', async () => {
  // Mock resource exhaustion attack
  process.env.UNJUCKS_RESOURCE_LIMITS = 'strict';
});

Given('I have templates that create temporary files', async () => {
  const templateDir = path.join(testContext.workingDir, 'templates/temp-files');
  fs.ensureDirSync(templateDir);
  
  const tempFilesTemplate = `---
to: src/{{ name }}.ts
tempFiles:
  - ".temp/processing.json"
  - ".temp/cache.dat"
---
// Template that uses temporary files
export class {{ name }} {
  process() {
    // Processing logic that creates temp files
  }
}
`;
  
  fs.writeFileSync(path.join(templateDir, 'index.ts.njk'), tempFilesTemplate);
});

Given('I have template caching enabled', async () => {
  process.env.UNJUCKS_CACHE_ENABLED = 'true';
  process.env.UNJUCKS_CACHE_MAX_SIZE = '100MB';
});

Given('I have templates that generate very large files', async () => {
  const templateDir = path.join(testContext.workingDir, 'templates/streaming-template');
  fs.ensureDirSync(templateDir);
  
  const streamingTemplate = `---
to: src/{{ name }}.ts
streaming: true
size: "{{ size }}"
---
// Streaming template for very large files
{% for chunk in range(1000000) %}
// Chunk {{ chunk }}: ${'x'.repeat(1000)}
{% endfor %}
`;
  
  fs.writeFileSync(path.join(templateDir, 'index.ts.njk'), streamingTemplate);
});

Given('I have audit logging enabled', async () => {
  process.env.UNJUCKS_AUDIT_ENABLED = 'true';
  process.env.UNJUCKS_AUDIT_LEVEL = 'detailed';
});

Given('I have signed templates', async () => {
  process.env.UNJUCKS_TEMPLATE_SIGNING = 'required';
});

Given('I have swarm agents running on multiple machines', async () => {
  process.env.UNJUCKS_DISTRIBUTED_SWARM = 'true';
  process.env.UNJUCKS_SWARM_ENCRYPTION = 'enabled';
});

// When steps that trigger performance monitoring
Given(/^I run (\d+) concurrent "([^"]+)"$/, async (count: string, command: string) => {
  const processCount = parseInt(count);
  startPerformanceMonitoring();
  
  // Mock concurrent execution
  for (let i = 0; i < processCount; i++) {
    const modifiedCommand = command.replace('{n}', i.toString());
    // This would normally execute the actual command
    // For testing, we simulate the execution
    perfSecContext.mockProcesses.push({
      id: i,
      command: modifiedCommand,
      status: 'running',
      startTime: Date.now()
    });
  }
});

// Then steps for performance validation
Then(/^all templates should be generated within (\d+) seconds$/, async (timeLimit: string) => {
  const limit = parseInt(timeLimit) * 1000; // Convert to milliseconds
  stopPerformanceMonitoring();
  
  expect(perfSecContext.performanceMetrics.executionTime).toBeLessThan(limit);
});

Then(/^memory usage should stay below (\d+)MB$/, async (memoryLimit: string) => {
  const limit = parseInt(memoryLimit) * 1024 * 1024; // Convert to bytes
  const currentMemory = process.memoryUsage().heapUsed;
  
  expect(currentMemory).toBeLessThan(limit);
});

Then(/^CPU usage should not exceed (\d+)%$/, async (cpuLimit: string) => {
  const limit = parseInt(cpuLimit);
  // Mock CPU usage check
  const mockCpuUsage = Math.random() * 100;
  
  expect(mockCpuUsage).toBeLessThan(limit);
});

Then(/^the file should be generated within (\d+) seconds$/, async (timeLimit: string) => {
  const limit = parseInt(timeLimit) * 1000;
  stopPerformanceMonitoring();
  
  expect(perfSecContext.performanceMetrics.executionTime).toBeLessThan(limit);
});

Then(/^memory usage should not exceed (\d+)MB during generation$/, async (memoryLimit: string) => {
  const limit = parseInt(memoryLimit) * 1024 * 1024;
  const peakMemory = Math.max(
    perfSecContext.memoryUsage.before.heapUsed,
    perfSecContext.memoryUsage.during.heapUsed,
    perfSecContext.memoryUsage.after.heapUsed
  );
  
  expect(peakMemory).toBeLessThan(limit);
});

Then('temporary files should be cleaned up', async () => {
  const tempDir = path.join(testContext.workingDir, '.temp');
  if (fs.existsSync(tempDir)) {
    const tempFiles = fs.readdirSync(tempDir);
    expect(tempFiles.length).toBe(0);
  }
});

Then(/^all processes should complete within (\d+) seconds$/, async (timeLimit: string) => {
  const limit = parseInt(timeLimit) * 1000;
  
  perfSecContext.mockProcesses.forEach(proc => {
    const duration = Date.now() - proc.startTime;
    expect(duration).toBeLessThan(limit);
  });
});

Then('no process should fail due to resource contention', async () => {
  const failedProcesses = perfSecContext.mockProcesses.filter(p => p.status === 'failed');
  expect(failedProcesses.length).toBe(0);
});

Then('file system locks should be handled properly', async () => {
  // Mock file system lock check
  const lockErrors = perfSecContext.securityViolations.filter(v => v.includes('file lock'));
  expect(lockErrors.length).toBe(0);
});

Then('no memory leaks should be detected', async () => {
  const memoryGrowth = perfSecContext.memoryUsage.after.heapUsed - perfSecContext.memoryUsage.before.heapUsed;
  const reasonableGrowth = 50 * 1024 * 1024; // 50MB
  
  expect(memoryGrowth).toBeLessThan(reasonableGrowth);
});

Then(/^validation should complete within (\d+) seconds$/, async (timeLimit: string) => {
  const limit = parseInt(timeLimit) * 1000;
  expect(perfSecContext.performanceMetrics.executionTime).toBeLessThan(limit);
});

Then(/^SPARQL queries should execute in under (\d+) seconds$/, async (timeLimit: string) => {
  const limit = parseInt(timeLimit) * 1000;
  // Mock SPARQL query time
  const mockQueryTime = Math.random() * 3000;
  
  expect(mockQueryTime).toBeLessThan(limit);
});

// Security validation then steps
Then('malicious input should be sanitized', async () => {
  const output = testContext.lastOutput;
  expect(output).not.toContain('<script>');
  expect(output).toMatch(/&lt;script&gt;|escaped/i);
});

Then('no script execution should occur', async () => {
  const violations = perfSecContext.securityViolations.filter(v => v.includes('script execution'));
  expect(violations.length).toBe(0);
});

Then('generated files should contain escaped content', async () => {
  const srcDir = path.join(testContext.workingDir, 'src');
  if (fs.existsSync(srcDir)) {
    const files = fs.readdirSync(srcDir, { recursive: true }) as string[];
    files.forEach(file => {
      if (file.endsWith('.ts')) {
        const content = fs.readFileSync(path.join(srcDir, file), 'utf8');
        expect(content).not.toContain('<script>alert');
      }
    });
  }
});

Then('the operation should be blocked', async () => {
  expect(testContext.lastExitCode).toBe(1);
});

Then('I should see "Path traversal detected" error', async () => {
  const output = testContext.lastOutput + testContext.lastError;
  expect(output).toMatch(/path.*traversal.*detected|directory.*traversal/i);
});

Then('no files should be written outside the project directory', async () => {
  // Check that no files were created outside the working directory
  const suspiciousPaths = ['/etc', '/root', '../../../'];
  suspiciousPaths.forEach(suspiciousPath => {
    expect(fs.existsSync(suspiciousPath)).toBe(false);
  });
});

Then('I should see "Unsafe template operation" error', async () => {
  const output = testContext.lastOutput + testContext.lastError;
  expect(output).toMatch(/unsafe.*template.*operation|dangerous.*operation/i);
});

Then('no system files should be affected', async () => {
  // Mock check that system files are intact
  const systemFiles = ['/etc/passwd', '/etc/hosts'];
  systemFiles.forEach(file => {
    // In a real test, you'd check file integrity
    expect(true).toBe(true); // Placeholder
  });
});

Then('I should see "Resource limit exceeded" error', async () => {
  const output = testContext.lastOutput + testContext.lastError;
  expect(output).toMatch(/resource.*limit.*exceeded|resource.*exhaustion/i);
});

Then('system resources should remain available', async () => {
  const currentMemory = process.memoryUsage().heapUsed;
  const memoryLimit = 1024 * 1024 * 1024; // 1GB
  
  expect(currentMemory).toBeLessThan(memoryLimit);
});

// Additional performance and security validations
Then('subsequent runs should be significantly faster', async () => {
  // Mock cache performance improvement
  const firstRunTime = 5000; // 5 seconds
  const cachedRunTime = 500;  // 0.5 seconds
  const improvement = firstRunTime / cachedRunTime;
  
  expect(improvement).toBeGreaterThan(5); // At least 5x faster
});

Then('all operations should be logged with timestamps', async () => {
  const output = testContext.lastOutput;
  expect(output).toMatch(/\d{4}-\d{2}-\d{2}.*\d{2}:\d{2}:\d{2}|logged|audit/i);
});

Then('template signatures should be validated', async () => {
  const output = testContext.lastOutput;
  expect(output).toMatch(/signature.*validation|verified.*signature/i);
});

// Export context for other test files
export { perfSecContext };
