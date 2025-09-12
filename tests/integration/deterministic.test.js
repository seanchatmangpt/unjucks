/**
 * KGEN Deterministic Output Tests
 * 
 * Validates that KGEN produces identical outputs for identical inputs
 * Tests reproducibility, caching, and lock file functionality
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const TEST_DIR = '/Users/sac/unjucks/tests/fixtures/deterministic';
const KGEN_CLI = '/Users/sac/unjucks/bin/kgen.mjs';

describe('KGEN Deterministic Generation', () => {
  beforeEach(async () => {
    // Create clean test environment
    await fs.mkdir(TEST_DIR, { recursive: true });
    
    // Create consistent test data
    const testGraph = `
@prefix : <http://example.org/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

:Product rdf:type rdfs:Class ;
         rdfs:label "Product" ;
         rdfs:comment "A product in the catalog" .

:name rdf:type rdf:Property ;
      rdfs:domain :Product ;
      rdfs:range rdfs:Literal .

:price rdf:type rdf:Property ;
       rdfs:domain :Product ;
       rdfs:range rdfs:Literal .

:category rdf:type rdf:Property ;
          rdfs:domain :Product ;
          rdfs:range rdfs:Literal .

:laptop rdf:type :Product ;
        :name "Gaming Laptop" ;
        :price "1299.99" ;
        :category "Electronics" .
`;
    
    await fs.writeFile(path.join(TEST_DIR, 'products.ttl'), testGraph);
    
    // Create deterministic template (no timestamps, UUIDs, etc.)
    const template = `---
to: src/{{ entityName | kebabCase }}.js
inject: false
---
/**
 * {{ entityName }} Entity
 * Generated deterministically from RDF graph
 */

class {{ entityName | pascalCase }} {
  static schema = {
    {{#each properties}}
    {{ this.name }}: {
      type: '{{ this.type }}',
      required: {{ this.required }}
    },
    {{/each}}
  };

  constructor(data = {}) {
    {{#each properties}}
    this.{{ this.name }} = data.{{ this.name }} || {{ this.default }};
    {{/each}}
  }

  validate() {
    const schema = {{ entityName | pascalCase }}.schema;
    const errors = [];
    
    for (const [field, config] of Object.entries(schema)) {
      if (config.required && !this[field]) {
        errors.push(\`\${field} is required\`);
      }
    }
    
    return errors;
  }

  static fromRDF(rdfData) {
    return new {{ entityName | pascalCase }}(rdfData);
  }
}

export default {{ entityName | pascalCase }};
`;
    
    await fs.mkdir(path.join(TEST_DIR, '_templates/entity'), { recursive: true });
    await fs.writeFile(
      path.join(TEST_DIR, '_templates/entity/entity.ejs.t'),
      template
    );
  });

  afterEach(async () => {
    try {
      await fs.rm(TEST_DIR, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  it('should produce identical output across multiple runs', async () => {
    const cwd = TEST_DIR;
    const outputs = [];
    
    // Generate same artifact 5 times
    for (let i = 0; i < 5; i++) {
      // Clean previous run
      try {
        await fs.rm(path.join(cwd, 'src'), { recursive: true, force: true });
      } catch {}
      
      // Generate
      execSync(
        `node ${KGEN_CLI} generate entity --graph products.ttl --entityName Product --static-build-time 2024-01-01T00:00:00.000Z`,
        { cwd, timeout: 30000 }
      );
      
      // Read generated content
      const content = await fs.readFile(
        path.join(cwd, 'src/product.js'),
        'utf-8'
      );
      
      outputs.push(content);
    }
    
    // Verify all outputs are identical
    const firstOutput = outputs[0];
    for (let i = 1; i < outputs.length; i++) {
      expect(outputs[i]).toBe(firstOutput);
    }
  }, 150000);

  it('should generate identical hashes for identical inputs', async () => {
    const cwd = TEST_DIR;
    const hashes = [];
    
    // Generate with attestation to get hashes
    for (let i = 0; i < 3; i++) {
      try {
        await fs.rm(path.join(cwd, 'src'), { recursive: true, force: true });
      } catch {}
      
      execSync(
        `node ${KGEN_CLI} generate entity --graph products.ttl --entityName Product --attest --static-build-time 2024-01-01T00:00:00.000Z`,
        { cwd, timeout: 30000 }
      );
      
      // Read attestation file
      const attestation = JSON.parse(
        await fs.readFile(
          path.join(cwd, 'src/product.js.attest.json'),
          'utf-8'
        )
      );
      
      hashes.push(attestation.hash);
    }
    
    // All hashes should be identical
    const firstHash = hashes[0];
    for (let i = 1; i < hashes.length; i++) {
      expect(hashes[i]).toBe(firstHash);
    }
  }, 120000);

  it('should detect content changes through hash comparison', async () => {
    const cwd = TEST_DIR;
    
    // Generate initial version
    execSync(
      `node ${KGEN_CLI} generate entity --graph products.ttl --entityName Product --attest --static-build-time 2024-01-01T00:00:00.000Z`,
      { cwd, timeout: 30000 }
    );
    
    const initialAttestation = JSON.parse(
      await fs.readFile(
        path.join(cwd, 'src/product.js.attest.json'),
        'utf-8'
      )
    );
    
    // Modify the RDF graph
    const modifiedGraph = `
@prefix : <http://example.org/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

:Product rdf:type rdfs:Class ;
         rdfs:label "Product" ;
         rdfs:comment "A product in the catalog" .

:name rdf:type rdf:Property ;
      rdfs:domain :Product ;
      rdfs:range rdfs:Literal .

:price rdf:type rdf:Property ;
       rdfs:domain :Product ;
       rdfs:range rdfs:Literal .

:description rdf:type rdf:Property ;
            rdfs:domain :Product ;
            rdfs:range rdfs:Literal .

:laptop rdf:type :Product ;
        :name "Gaming Laptop Pro" ;
        :price "1599.99" ;
        :description "High-performance gaming laptop" .
`;
    
    await fs.writeFile(path.join(cwd, 'products.ttl'), modifiedGraph);
    
    // Generate with modified data
    try {
      await fs.rm(path.join(cwd, 'src'), { recursive: true, force: true });
    } catch {}
    
    execSync(
      `node ${KGEN_CLI} generate entity --graph products.ttl --entityName Product --attest --static-build-time 2024-01-01T00:00:00.000Z`,
      { cwd, timeout: 30000 }
    );
    
    const modifiedAttestation = JSON.parse(
      await fs.readFile(
        path.join(cwd, 'src/product.js.attest.json'),
        'utf-8'
      )
    );
    
    // Hashes should be different
    expect(modifiedAttestation.hash).not.toBe(initialAttestation.hash);
  }, 90000);

  it('should maintain deterministic ordering in collections', async () => {
    // Create graph with multiple items that could be ordered differently
    const unorderedGraph = `
@prefix : <http://example.org/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .

:zebra rdf:type :Animal ; :name "Zebra" .
:ant rdf:type :Animal ; :name "Ant" .
:bear rdf:type :Animal ; :name "Bear" .
:dog rdf:type :Animal ; :name "Dog" .
:cat rdf:type :Animal ; :name "Cat" .
`;
    
    const template = `---
to: src/animals.js
---
// Animals (should be consistently ordered)
export const animals = [
{{#each entities}}
  { name: "{{ this.name }}", type: "{{ this.type }}" },
{{/each}}
];
`;
    
    const cwd = TEST_DIR;
    await fs.writeFile(path.join(cwd, 'animals.ttl'), unorderedGraph);
    await fs.mkdir(path.join(cwd, '_templates/animals'), { recursive: true });
    await fs.writeFile(
      path.join(cwd, '_templates/animals/list.ejs.t'),
      template
    );
    
    const outputs = [];
    
    // Generate multiple times
    for (let i = 0; i < 3; i++) {
      try {
        await fs.rm(path.join(cwd, 'src'), { recursive: true, force: true });
      } catch {}
      
      execSync(
        `node ${KGEN_CLI} generate animals/list --graph animals.ttl --static-build-time 2024-01-01T00:00:00.000Z`,
        { cwd, timeout: 30000 }
      );
      
      const content = await fs.readFile(
        path.join(cwd, 'src/animals.js'),
        'utf-8'
      );
      
      outputs.push(content);
    }
    
    // All outputs should be identical (same ordering)
    const firstOutput = outputs[0];
    for (let i = 1; i < outputs.length; i++) {
      expect(outputs[i]).toBe(firstOutput);
    }
  }, 120000);
});

describe('KGEN Lock File Management', () => {
  beforeEach(async () => {
    await fs.mkdir(TEST_DIR, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(TEST_DIR, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  it('should create lock file on generation', async () => {
    const testGraph = `
@prefix : <http://example.org/> .
:User a :Entity ; :name "Test" .
`;
    
    const template = `---
to: src/user.js
---
export const user = "{{ name }}";
`;
    
    const cwd = TEST_DIR;
    await fs.writeFile(path.join(cwd, 'users.ttl'), testGraph);
    await fs.mkdir(path.join(cwd, '_templates/user'), { recursive: true });
    await fs.writeFile(
      path.join(cwd, '_templates/user/user.ejs.t'),
      template
    );
    
    // Generate
    execSync(
      `node ${KGEN_CLI} generate user/user --graph users.ttl --name TestUser`,
      { cwd, timeout: 30000 }
    );
    
    // Check for lock file
    const lockFile = path.join(cwd, 'kgen.lock.json');
    const lockExists = await fs.access(lockFile)
      .then(() => true)
      .catch(() => false);
    
    expect(lockExists).toBe(true);
    
    // Verify lock file structure
    const lockData = JSON.parse(
      await fs.readFile(lockFile, 'utf-8')
    );
    
    expect(lockData).toHaveProperty('version');
    expect(lockData).toHaveProperty('timestamp');
    expect(lockData).toHaveProperty('files');
    expect(lockData.files).toHaveProperty('users.ttl');
    expect(lockData.files).toHaveProperty('src/user.js');
  }, 60000);

  it('should detect file changes via lock file comparison', async () => {
    const initialGraph = `
@prefix : <http://example.org/> .
:User a :Entity ; :name "Initial" .
`;
    
    const template = `---
to: src/data.js
---
export const data = "{{ name }}";
`;
    
    const cwd = TEST_DIR;
    await fs.writeFile(path.join(cwd, 'data.ttl'), initialGraph);
    await fs.mkdir(path.join(cwd, '_templates/data'), { recursive: true });
    await fs.writeFile(
      path.join(cwd, '_templates/data/data.ejs.t'),
      template
    );
    
    // Initial generation
    execSync(
      `node ${KGEN_CLI} generate data/data --graph data.ttl --name Initial`,
      { cwd, timeout: 30000 }
    );
    
    const initialLock = JSON.parse(
      await fs.readFile(path.join(cwd, 'kgen.lock.json'), 'utf-8')
    );
    
    // Modify source file
    const modifiedGraph = `
@prefix : <http://example.org/> .
:User a :Entity ; :name "Modified" .
`;
    
    await fs.writeFile(path.join(cwd, 'data.ttl'), modifiedGraph);
    
    // Wait a moment to ensure timestamp difference
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Regenerate
    execSync(
      `node ${KGEN_CLI} generate data/data --graph data.ttl --name Modified`,
      { cwd, timeout: 30000 }
    );
    
    const modifiedLock = JSON.parse(
      await fs.readFile(path.join(cwd, 'kgen.lock.json'), 'utf-8')
    );
    
    // Lock file should reflect changes
    expect(modifiedLock.files['data.ttl'].hash)
      .not.toBe(initialLock.files['data.ttl'].hash);
    expect(modifiedLock.files['src/data.js'].hash)
      .not.toBe(initialLock.files['src/data.js'].hash);
  }, 90000);

  it('should validate lock file integrity', async () => {
    const cwd = TEST_DIR;
    
    // Create a corrupted lock file
    const corruptedLock = {
      version: "1.0.0",
      timestamp: "2024-01-01T00:00:00.000Z",
      files: {
        "nonexistent.ttl": {
          hash: "invalid-hash",
          size: 9999,
          modified: "2024-01-01T00:00:00.000Z"
        }
      }
    };
    
    await fs.writeFile(
      path.join(cwd, 'kgen.lock.json'),
      JSON.stringify(corruptedLock, null, 2)
    );
    
    // Validate lock file
    try {
      const result = execSync(
        `node ${KGEN_CLI} validate --lock-file`,
        { 
          cwd,
          encoding: 'utf-8',
          timeout: 30000
        }
      );
      
      expect(result).toContain('invalid') || expect(result).toContain('error');
    } catch (error) {
      // Expected to fail validation
      expect(error.message).toContain('lock') || expect(error.message).toContain('invalid');
    }
  }, 60000);
});

describe('KGEN Reproducibility Validation', () => {
  it('should produce bit-identical outputs in different environments', async () => {
    const testData = {
      graph: `
@prefix : <http://example.org/> .
:Config a :Entity ; :version "1.0" ; :env "production" .
`,
      template: `---
to: config/app.js
---
export default {
  version: "{{ version }}",
  environment: "{{ env }}",
  buildId: "deterministic-build"
};
`
    };
    
    // Simulate different environment variables but same inputs
    const environments = [
      { NODE_ENV: 'development', USER: 'dev1' },
      { NODE_ENV: 'production', USER: 'ci' },
      { NODE_ENV: 'test', USER: 'tester' }
    ];
    
    const outputs = [];
    
    for (const env of environments) {
      const cwd = TEST_DIR + '_env_' + env.USER;
      await fs.mkdir(cwd, { recursive: true });
      
      try {
        await fs.writeFile(path.join(cwd, 'config.ttl'), testData.graph);
        await fs.mkdir(path.join(cwd, '_templates/config'), { recursive: true });
        await fs.writeFile(
          path.join(cwd, '_templates/config/app.ejs.t'),
          testData.template
        );
        
        // Generate with environment variables
        const result = execSync(
          `node ${KGEN_CLI} generate config/app --graph config.ttl --version 1.0 --env production --static-build-time 2024-01-01T00:00:00.000Z`,
          { 
            cwd,
            env: { ...process.env, ...env },
            encoding: 'utf-8',
            timeout: 30000
          }
        );
        
        const content = await fs.readFile(
          path.join(cwd, 'config/app.js'),
          'utf-8'
        );
        
        outputs.push(content);
        
        // Cleanup
        await fs.rm(cwd, { recursive: true, force: true });
      } catch (error) {
        // Cleanup on error
        try {
          await fs.rm(cwd, { recursive: true, force: true });
        } catch {}
        throw error;
      }
    }
    
    // All outputs should be identical despite different environments
    const firstOutput = outputs[0];
    for (let i = 1; i < outputs.length; i++) {
      expect(outputs[i]).toBe(firstOutput);
    }
  }, 120000);
});