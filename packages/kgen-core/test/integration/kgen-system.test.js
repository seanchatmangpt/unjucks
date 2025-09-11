/**
 * KGEN System Integration Tests
 * 
 * Tests the complete KGEN pipeline from graph to artifacts
 * Validates PRD requirements and deterministic behavior
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { existsSync, readFileSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import { tmpdir } from 'os';
import crypto from 'crypto';

import { createKGen } from '../src/index.js';
import { TemplateRenderer } from '../src/templating/renderer.js';
import { RDFProcessor } from '../src/rdf/index.js';

const TEST_DIR = join(tmpdir(), 'kgen-test-' + Date.now());

// Setup test directory
function setupTestDir() {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true });
  }
  mkdirSync(TEST_DIR, { recursive: true });
  mkdirSync(join(TEST_DIR, 'templates'), { recursive: true });
  mkdirSync(join(TEST_DIR, 'output'), { recursive: true });
}

// Cleanup test directory
function cleanupTestDir() {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true });
  }
}

// Sample RDF graph for testing
const SAMPLE_GRAPH = `
@prefix ex: <http://example.org/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

ex:User a rdfs:Class ;
  rdfs:label "User" ;
  rdfs:comment "A user in the system" .

ex:name a rdf:Property ;
  rdfs:label "name" ;
  rdfs:domain ex:User ;
  rdfs:range rdfs:Literal .

ex:email a rdf:Property ;
  rdfs:label "email" ;
  rdfs:domain ex:User ;
  rdfs:range rdfs:Literal .

ex:john a ex:User ;
  ex:name "John Doe" ;
  ex:email "john@example.org" .
`;

// Sample template for testing
const SAMPLE_TEMPLATE = `---
to: "{{ outputDir }}/user.js"
---
/**
 * Generated User Model
 * Graph Hash: {{ meta.graphHash }}
 */

export const User = {
  name: "{{ user.name | value }}",
  email: "{{ user.email | value }}"
};

export default User;
`;

describe('KGEN System Integration', () => {
  
  test('PRD Requirement: Deterministic Generation', async () => {
    setupTestDir();
    
    try {
      // Write test graph and template
      const graphPath = join(TEST_DIR, 'test.ttl');
      const templatePath = join(TEST_DIR, 'templates', 'user.js.njk');
      
      writeFileSync(graphPath, SAMPLE_GRAPH);
      writeFileSync(templatePath, SAMPLE_TEMPLATE);
      
      // Create KGEN engine
      const kgen = await createKGen({
        directories: {
          templates: join(TEST_DIR, 'templates'),
          out: join(TEST_DIR, 'output')
        }
      });
      
      // Generate artifacts twice
      const result1 = await kgen.generateArtifacts(graphPath, 'user.js.njk', {
        user: { name: 'John Doe', email: 'john@example.org' }
      });
      
      const result2 = await kgen.generateArtifacts(graphPath, 'user.js.njk', {
        user: { name: 'John Doe', email: 'john@example.org' }
      });
      
      // Verify byte-for-byte identical outputs
      assert.strictEqual(result1.files.length, result2.files.length);
      
      for (let i = 0; i < result1.files.length; i++) {
        const content1 = readFileSync(result1.files[i].path, 'utf8');
        const content2 = readFileSync(result2.files[i].path, 'utf8');
        
        assert.strictEqual(content1, content2, 'Generated artifacts must be byte-for-byte identical');
        assert.strictEqual(result1.files[i].hash, result2.files[i].hash, 'File hashes must be identical');
      }
      
    } finally {
      cleanupTestDir();
    }
  });

  test('PRD Requirement: Graph Hash Generation', async () => {
    setupTestDir();
    
    try {
      const graphPath = join(TEST_DIR, 'test.ttl');
      writeFileSync(graphPath, SAMPLE_GRAPH);
      
      const rdf = new RDFProcessor();
      const hash1 = await rdf.generateGraphHash(graphPath);
      const hash2 = await rdf.generateGraphHash(graphPath);
      
      // Hash must be deterministic
      assert.strictEqual(hash1, hash2, 'Graph hash must be deterministic');
      assert.match(hash1, /^[a-f0-9]{64}$/, 'Hash must be 64-character hex string');
      
      // Different graphs must produce different hashes
      const modifiedGraph = SAMPLE_GRAPH + '\nex:jane a ex:User .';
      const modifiedPath = join(TEST_DIR, 'modified.ttl');
      writeFileSync(modifiedPath, modifiedGraph);
      
      const hash3 = await rdf.generateGraphHash(modifiedPath);
      assert.notStrictEqual(hash1, hash3, 'Different graphs must have different hashes');
      
    } finally {
      cleanupTestDir();
    }
  });

  test('PRD Requirement: Attestation Generation', async () => {
    setupTestDir();
    
    try {
      const graphPath = join(TEST_DIR, 'test.ttl');
      const templatePath = join(TEST_DIR, 'templates', 'user.js.njk');
      
      writeFileSync(graphPath, SAMPLE_GRAPH);
      writeFileSync(templatePath, SAMPLE_TEMPLATE);
      
      const kgen = await createKGen({
        directories: {
          templates: join(TEST_DIR, 'templates'),
          out: join(TEST_DIR, 'output')
        },
        generate: {
          attestByDefault: true
        }
      });
      
      const result = await kgen.generateArtifacts(graphPath, 'user.js.njk', {
        user: { name: 'John Doe', email: 'john@example.org' }
      });
      
      // Verify attestation files exist
      for (const file of result.files) {
        const attestPath = file.path + '.attest.json';
        assert.ok(existsSync(attestPath), 'Attestation file must exist');
        
        const attestation = JSON.parse(readFileSync(attestPath, 'utf8'));
        
        // Verify attestation structure
        assert.ok(attestation.graphHash, 'Attestation must include graph hash');
        assert.ok(attestation.template, 'Attestation must include template');
        assert.ok(attestation.timestamp, 'Attestation must include timestamp');
        assert.ok(attestation.engine, 'Attestation must include engine info');
        assert.strictEqual(attestation.artifactHash, file.hash, 'Artifact hash must match');
      }
      
    } finally {
      cleanupTestDir();
    }
  });

  test('PRD Requirement: Template Rendering with RDF Context', async () => {
    setupTestDir();
    
    try {
      const templatePath = join(TEST_DIR, 'templates', 'user.js.njk');
      writeFileSync(templatePath, SAMPLE_TEMPLATE);
      
      const renderer = new TemplateRenderer();
      renderer.initialize(join(TEST_DIR, 'templates'));
      
      const context = {
        outputDir: join(TEST_DIR, 'output'),
        user: {
          name: { value: 'John Doe', termType: 'Literal' },
          email: { value: 'john@example.org', termType: 'Literal' }
        },
        meta: {
          graphHash: 'abc123'
        }
      };
      
      const result = await renderer.render(templatePath, context);
      
      // Verify template rendering
      assert.ok(result.content.includes('John Doe'), 'Template must render user name');
      assert.ok(result.content.includes('john@example.org'), 'Template must render user email');
      assert.ok(result.content.includes('abc123'), 'Template must include graph hash');
      assert.ok(result.metadata, 'Result must include metadata');
      
    } finally {
      cleanupTestDir();
    }
  });

  test('PRD Requirement: Error Handling and Validation', async () => {
    setupTestDir();
    
    try {
      const kgen = await createKGen({
        directories: {
          templates: join(TEST_DIR, 'templates'),
          out: join(TEST_DIR, 'output')
        }
      });
      
      // Test with non-existent graph file
      await assert.rejects(
        async () => {
          await kgen.generateArtifacts('non-existent.ttl', 'template.njk', {});
        },
        /Graph file not found/,
        'Should reject with appropriate error for missing graph'
      );
      
      // Test with non-existent template
      const graphPath = join(TEST_DIR, 'test.ttl');
      writeFileSync(graphPath, SAMPLE_GRAPH);
      
      await assert.rejects(
        async () => {
          await kgen.generateArtifacts(graphPath, 'non-existent.njk', {});
        },
        /Template not found/,
        'Should reject with appropriate error for missing template'
      );
      
    } finally {
      cleanupTestDir();
    }
  });

  test('PRD Requirement: Performance and Caching', async () => {
    setupTestDir();
    
    try {
      const graphPath = join(TEST_DIR, 'test.ttl');
      const templatePath = join(TEST_DIR, 'templates', 'user.js.njk');
      
      writeFileSync(graphPath, SAMPLE_GRAPH);
      writeFileSync(templatePath, SAMPLE_TEMPLATE);
      
      const kgen = await createKGen({
        directories: {
          templates: join(TEST_DIR, 'templates'),
          out: join(TEST_DIR, 'output')
        },
        cache: {
          enabled: true
        }
      });
      
      const context = {
        user: { name: 'John Doe', email: 'john@example.org' }
      };
      
      // First generation (should cache)
      const start1 = Date.now();
      const result1 = await kgen.generateArtifacts(graphPath, 'user.js.njk', context);
      const duration1 = Date.now() - start1;
      
      // Second generation (should use cache)
      const start2 = Date.now();
      const result2 = await kgen.generateArtifacts(graphPath, 'user.js.njk', context);
      const duration2 = Date.now() - start2;
      
      // Verify cache effectiveness (second run should be faster)
      assert.ok(duration2 <= duration1, 'Cached generation should be faster or equal');
      assert.strictEqual(result1.files[0].hash, result2.files[0].hash, 'Cached results must be identical');
      
    } finally {
      cleanupTestDir();
    }
  });

  test('Integration: Complete PRD Workflow', async () => {
    setupTestDir();
    
    try {
      // Setup complete test environment
      const graphPath = join(TEST_DIR, 'api-model.ttl');
      const templateDir = join(TEST_DIR, 'templates');
      const outputDir = join(TEST_DIR, 'output');
      
      // Extended RDF graph
      const apiGraph = `
        @prefix api: <http://example.org/api#> .
        @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
        
        api:UserAPI a api:Service ;
          rdfs:label "User API" ;
          api:hasEndpoint api:createUser, api:getUser .
        
        api:createUser a api:Endpoint ;
          api:method "POST" ;
          api:path "/users" ;
          api:accepts api:UserInput .
        
        api:getUser a api:Endpoint ;
          api:method "GET" ;
          api:path "/users/{id}" ;
          api:returns api:User .
      `;
      
      const apiTemplate = `---
to: "{{ outputDir }}/api/{{ serviceName | kebabcase }}.ts"
---
/**
 * {{ serviceName }} API
 * Generated from: {{ meta.graphPath }}
 * Hash: {{ meta.graphHash }}
 */

export class {{ serviceName | pascalcase }}API {
  {% for endpoint in endpoints -%}
  /**
   * {{ endpoint.description }}
   * @route {{ endpoint.method }} {{ endpoint.path }}
   */
  async {{ endpoint.name }}(): Promise<any> {
    // Implementation generated from RDF graph
    return {};
  }
  
  {% endfor %}
}
`;
      
      writeFileSync(graphPath, apiGraph);
      writeFileSync(join(templateDir, 'api-service.ts.njk'), apiTemplate);
      
      // Create and test complete KGEN system
      const kgen = await createKGen({
        directories: {
          templates: templateDir,
          out: outputDir,
          cache: join(TEST_DIR, 'cache'),
          state: join(TEST_DIR, 'state')
        },
        generate: {
          attestByDefault: true,
          globalVars: {
            serviceName: 'UserAPI',
            version: '1.0.0'
          }
        },
        metrics: {
          enabled: true
        }
      });
      
      // Generate artifacts
      const result = await kgen.generateArtifacts(graphPath, 'api-service.ts.njk', {
        endpoints: [
          { name: 'createUser', method: 'POST', path: '/users', description: 'Create new user' },
          { name: 'getUser', method: 'GET', path: '/users/{id}', description: 'Get user by ID' }
        ]
      });
      
      // Comprehensive validation
      assert.ok(result.success, 'Generation must succeed');
      assert.ok(result.files.length > 0, 'Must generate at least one file');
      assert.ok(result.graphHash, 'Must include graph hash');
      assert.ok(result.metrics, 'Must include metrics');
      assert.ok(result.metrics.durationMs >= 0, 'Must track generation time');
      
      // Verify generated file content
      const generatedFile = result.files[0];
      const content = readFileSync(generatedFile.path, 'utf8');
      
      assert.ok(content.includes('UserAPI'), 'Must include service name');
      assert.ok(content.includes('createUser'), 'Must include endpoints');
      assert.ok(content.includes('getUser'), 'Must include all endpoints');
      assert.ok(content.includes(result.graphHash), 'Must include graph hash in comments');
      
      // Verify attestation
      const attestPath = generatedFile.path + '.attest.json';
      assert.ok(existsSync(attestPath), 'Must generate attestation');
      
      const attestation = JSON.parse(readFileSync(attestPath, 'utf8'));
      assert.strictEqual(attestation.graphHash, result.graphHash, 'Attestation hash must match');
      
    } finally {
      cleanupTestDir();
    }
  });

});

export { setupTestDir, cleanupTestDir, SAMPLE_GRAPH, SAMPLE_TEMPLATE };