/**
 * KGEN CLI Integration Tests
 * 
 * Tests the complete CLI interface and validates PRD commands
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { spawn } from 'child_process';
import { existsSync, readFileSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const TEST_DIR = join(tmpdir(), 'kgen-cli-test-' + Date.now());
const CLI_PATH = join(process.cwd(), 'bin', 'kgen.js');

// Sample test files
const SAMPLE_GRAPH = `
@prefix ex: <http://example.org/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .

ex:User a ex:Class ;
  ex:name "User Model" ;
  ex:property ex:id, ex:name, ex:email .

ex:id a ex:Property ;
  ex:type "string" ;
  ex:required true .

ex:name a ex:Property ;
  ex:type "string" ;
  ex:required true .

ex:email a ex:Property ;
  ex:type "string" ;
  ex:format "email" .
`;

const SAMPLE_TEMPLATE = `---
to: "{{ outputDir }}/{{ className | kebabcase }}.model.ts"
---
/**
 * {{ className }} Model
 * Generated from: {{ meta.graphPath }}
 * Hash: {{ meta.graphHash }}
 */

export interface {{ className }} {
  {% for prop in properties -%}
  {{ prop.name }}{% if not prop.required %}?{% endif %}: {{ prop.type }};
  {% endfor %}
}
`;

function setupTestEnvironment() {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true });
  }
  mkdirSync(TEST_DIR, { recursive: true });
  mkdirSync(join(TEST_DIR, 'templates'), { recursive: true });
  mkdirSync(join(TEST_DIR, 'output'), { recursive: true });
  
  // Write test files
  writeFileSync(join(TEST_DIR, 'model.ttl'), SAMPLE_GRAPH);
  writeFileSync(join(TEST_DIR, 'templates', 'model.ts.njk'), SAMPLE_TEMPLATE);
  
  // Create kgen config
  const config = {
    project: {
      name: 'test-project',
      version: '1.0.0'
    },
    directories: {
      out: join(TEST_DIR, 'output'),
      templates: join(TEST_DIR, 'templates'),
      cache: join(TEST_DIR, '.kgen', 'cache'),
      state: join(TEST_DIR, '.kgen', 'state')
    },
    generate: {
      attestByDefault: true
    }
  };
  
  writeFileSync(join(TEST_DIR, 'kgen.config.js'), 
    `export default ${JSON.stringify(config, null, 2)};`);
}

function cleanupTestEnvironment() {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true });
  }
}

async function runCLI(args) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [CLI_PATH, ...args], {
      cwd: TEST_DIR,
      stdio: 'pipe'
    });
    
    let stdout = '';
    let stderr = '';
    
    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    child.on('close', (code) => {
      resolve({
        code,
        stdout,
        stderr,
        success: code === 0
      });
    });
    
    child.on('error', reject);
    
    // Timeout after 10 seconds
    setTimeout(() => {
      child.kill();
      reject(new Error('CLI command timeout'));
    }, 10000);
  });
}

describe('KGEN CLI Integration Tests', () => {

  test('CLI: Help Command', async () => {
    setupTestEnvironment();
    
    try {
      const result = await runCLI(['--help']);
      
      assert.ok(result.success, 'Help command should succeed');
      assert.ok(result.stdout.includes('kgen'), 'Help should include program name');
      assert.ok(result.stdout.includes('artifact'), 'Help should list artifact commands');
      assert.ok(result.stdout.includes('graph'), 'Help should list graph commands');
      
    } finally {
      cleanupTestEnvironment();
    }
  });

  test('PRD Command: kgen graph hash', async () => {
    setupTestEnvironment();
    
    try {
      const result = await runCLI(['graph', 'hash', '--input', 'model.ttl']);
      
      assert.ok(result.success, 'Graph hash command should succeed');
      
      const output = JSON.parse(result.stdout);
      assert.ok(output.success, 'Command should return success');
      assert.ok(output.data.hash, 'Should return graph hash');
      assert.match(output.data.hash, /^[a-f0-9]{64}$/, 'Hash should be 64-char hex');
      assert.ok(output.data.triples, 'Should return triple count');
      
    } finally {
      cleanupTestEnvironment();
    }
  });

  test('PRD Command: kgen artifact generate', async () => {
    setupTestEnvironment();
    
    try {
      const result = await runCLI([
        'artifact', 'generate',
        '--graph', 'model.ttl',
        '--template', 'model.ts.njk',
        '--variables', JSON.stringify({
          className: 'User',
          properties: [
            { name: 'id', type: 'string', required: true },
            { name: 'name', type: 'string', required: true },
            { name: 'email', type: 'string', required: false }
          ]
        })
      ]);
      
      assert.ok(result.success, 'Artifact generate should succeed');
      
      const output = JSON.parse(result.stdout);
      assert.ok(output.success, 'Command should return success');
      assert.ok(output.data.files, 'Should return generated files');
      assert.ok(output.data.files.length > 0, 'Should generate at least one file');
      assert.ok(output.data.graphHash, 'Should include graph hash');
      
      // Verify file was actually created
      const generatedFile = output.data.files[0];
      assert.ok(existsSync(generatedFile.path), 'Generated file should exist');
      
      const content = readFileSync(generatedFile.path, 'utf8');
      assert.ok(content.includes('interface User'), 'Should generate TypeScript interface');
      assert.ok(content.includes('id: string'), 'Should include required properties');
      
    } finally {
      cleanupTestEnvironment();
    }
  });

  test('PRD Command: kgen artifact drift', async () => {
    setupTestEnvironment();
    
    try {
      // First generate artifacts
      await runCLI([
        'artifact', 'generate',
        '--graph', 'model.ttl',
        '--template', 'model.ts.njk',
        '--variables', JSON.stringify({
          className: 'User',
          properties: [{ name: 'id', type: 'string', required: true }]
        })
      ]);
      
      // Check for drift (should be none)
      const driftResult = await runCLI(['artifact', 'drift', '--check', 'output/']);
      
      assert.ok(driftResult.success, 'Drift check should succeed when no drift');
      
      const output = JSON.parse(driftResult.stdout);
      assert.ok(output.success, 'Should report no drift');
      assert.strictEqual(output.data.driftDetected, false, 'Should detect no drift');
      
      // Modify a generated file
      const files = output.data.files;
      if (files.length > 0) {
        const modifiedContent = readFileSync(files[0].path, 'utf8') + '\n// Modified';
        writeFileSync(files[0].path, modifiedContent);
        
        // Check for drift again (should detect drift)
        const driftResult2 = await runCLI(['artifact', 'drift', '--check', 'output/']);
        
        // This should fail with exit code 3 (drift detected)
        assert.strictEqual(driftResult2.code, 3, 'Should exit with code 3 when drift detected');
        
        const output2 = JSON.parse(driftResult2.stdout);
        assert.strictEqual(output2.data.driftDetected, true, 'Should detect drift');
      }
      
    } finally {
      cleanupTestEnvironment();
    }
  });

  test('PRD Command: kgen templates ls', async () => {
    setupTestEnvironment();
    
    try {
      const result = await runCLI(['templates', 'ls']);
      
      assert.ok(result.success, 'Templates list should succeed');
      
      const output = JSON.parse(result.stdout);
      assert.ok(output.success, 'Command should return success');
      assert.ok(Array.isArray(output.data.templates), 'Should return templates array');
      assert.ok(output.data.templates.some(t => t.name === 'model.ts.njk'), 
        'Should include test template');
      
    } finally {
      cleanupTestEnvironment();
    }
  });

  test('PRD Command: kgen cache gc', async () => {
    setupTestEnvironment();
    
    try {
      const result = await runCLI(['cache', 'gc']);
      
      assert.ok(result.success, 'Cache GC should succeed');
      
      const output = JSON.parse(result.stdout);
      assert.ok(output.success, 'Command should return success');
      assert.ok(typeof output.data.itemsRemoved === 'number', 'Should report items removed');
      assert.ok(typeof output.data.bytesFreed === 'number', 'Should report bytes freed');
      
    } finally {
      cleanupTestEnvironment();
    }
  });

  test('PRD Command: kgen project lock', async () => {
    setupTestEnvironment();
    
    try {
      const result = await runCLI(['project', 'lock', '--output', 'project.lock']);
      
      assert.ok(result.success, 'Project lock should succeed');
      
      const output = JSON.parse(result.stdout);
      assert.ok(output.success, 'Command should return success');
      assert.ok(output.data.lockfile, 'Should return lockfile path');
      
      // Verify lockfile was created
      const lockfilePath = join(TEST_DIR, 'project.lock');
      assert.ok(existsSync(lockfilePath), 'Lockfile should be created');
      
      const lockContent = JSON.parse(readFileSync(lockfilePath, 'utf8'));
      assert.ok(lockContent.project, 'Lockfile should include project info');
      assert.ok(lockContent.graphs, 'Lockfile should include graph hashes');
      assert.ok(lockContent.timestamp, 'Lockfile should include timestamp');
      
    } finally {
      cleanupTestEnvironment();
    }
  });

  test('CLI Error Handling', async () => {
    setupTestEnvironment();
    
    try {
      // Test with non-existent graph file
      const result = await runCLI([
        'artifact', 'generate',
        '--graph', 'non-existent.ttl',
        '--template', 'model.ts.njk'
      ]);
      
      assert.ok(!result.success, 'Should fail with non-existent graph');
      assert.ok(result.stderr.includes('not found') || result.stdout.includes('not found'), 
        'Should report file not found error');
      
    } finally {
      cleanupTestEnvironment();
    }
  });

  test('CLI Output Formats', async () => {
    setupTestEnvironment();
    
    try {
      // Test JSON output (default)
      const jsonResult = await runCLI(['graph', 'hash', '--input', 'model.ttl', '--format', 'json']);
      assert.ok(jsonResult.success, 'JSON format should succeed');
      
      const jsonOutput = JSON.parse(jsonResult.stdout);
      assert.ok(jsonOutput.success, 'JSON output should be valid');
      
      // Test YAML output
      const yamlResult = await runCLI(['graph', 'hash', '--input', 'model.ttl', '--format', 'yaml']);
      assert.ok(yamlResult.success, 'YAML format should succeed');
      assert.ok(yamlResult.stdout.includes('success:'), 'YAML output should be valid');
      
    } finally {
      cleanupTestEnvironment();
    }
  });

  test('CLI Configuration Loading', async () => {
    setupTestEnvironment();
    
    try {
      // Test with custom config
      const result = await runCLI([
        'artifact', 'generate',
        '--config', 'kgen.config.js',
        '--graph', 'model.ttl',
        '--template', 'model.ts.njk'
      ]);
      
      assert.ok(result.success, 'Should load custom config successfully');
      
      const output = JSON.parse(result.stdout);
      assert.ok(output.data.project, 'Should include project info from config');
      assert.strictEqual(output.data.project.name, 'test-project', 
        'Should use project name from config');
      
    } finally {
      cleanupTestEnvironment();
    }
  });

});

export { setupTestEnvironment, cleanupTestEnvironment, runCLI };