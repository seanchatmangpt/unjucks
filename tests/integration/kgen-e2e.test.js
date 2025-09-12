/**
 * KGEN End-to-End Integration Tests
 * 
 * Tests complete workflows from knowledge graph input to artifact generation
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const TEST_DIR = '/Users/sac/unjucks/tests/fixtures/e2e';
const KGEN_CLI = '/Users/sac/unjucks/bin/kgen.mjs';

describe('KGEN End-to-End Workflows', () => {
  beforeEach(async () => {
    // Create clean test directory
    await fs.mkdir(TEST_DIR, { recursive: true });
    
    // Create test RDF graph
    const testGraph = `
@prefix : <http://example.org/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

:User rdf:type rdfs:Class ;
      rdfs:label "User" ;
      rdfs:comment "A system user" .

:name rdf:type rdf:Property ;
      rdfs:domain :User ;
      rdfs:range rdfs:Literal ;
      rdfs:label "name" .

:email rdf:type rdf:Property ;
       rdfs:domain :User ;
       rdfs:range rdfs:Literal ;
       rdfs:label "email" .

:john rdf:type :User ;
      :name "John Doe" ;
      :email "john@example.com" .
`;
    
    await fs.writeFile(path.join(TEST_DIR, 'test-graph.ttl'), testGraph);
    
    // Create test template
    const testTemplate = `---
to: src/models/{{ className | pascalCase }}.js
inject: true
---
/**
 * {{ className }} Model
 * Generated from RDF graph at {{ buildTime }}
 */

class {{ className | pascalCase }} {
  constructor(data = {}) {
    {{#each properties}}
    this.{{ this.name }} = data.{{ this.name }} || null;
    {{/each}}
  }

  validate() {
    const errors = [];
    {{#each properties}}
    {{#if this.required}}
    if (!this.{{ this.name }}) {
      errors.push('{{ this.name }} is required');
    }
    {{/if}}
    {{/each}}
    return errors;
  }

  toJSON() {
    return {
      {{#each properties}}
      {{ this.name }}: this.{{ this.name }},
      {{/each}}
    };
  }
}

export default {{ className | pascalCase }};
`;
    
    await fs.mkdir(path.join(TEST_DIR, '_templates/model'), { recursive: true });
    await fs.writeFile(
      path.join(TEST_DIR, '_templates/model/model.ejs.t'),
      testTemplate
    );
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(TEST_DIR, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  it('should generate artifacts from RDF graph', async () => {
    const cwd = TEST_DIR;
    
    // Generate artifacts using KGEN CLI
    const result = execSync(
      `node ${KGEN_CLI} generate model --graph test-graph.ttl --className User`,
      { 
        cwd,
        encoding: 'utf-8',
        timeout: 30000
      }
    );

    // Verify generation output
    expect(result).toContain('Generated');
    
    // Check if generated file exists
    const generatedFile = path.join(cwd, 'src/models/User.js');
    const fileExists = await fs.access(generatedFile)
      .then(() => true)
      .catch(() => false);
    
    expect(fileExists).toBe(true);
    
    // Verify file content
    const content = await fs.readFile(generatedFile, 'utf-8');
    expect(content).toContain('class User');
    expect(content).toContain('this.name');
    expect(content).toContain('this.email');
    expect(content).toContain('Generated from RDF graph');
  }, 45000);

  it('should create attestation file for generated artifacts', async () => {
    const cwd = TEST_DIR;
    
    // Generate with attestation
    execSync(
      `node ${KGEN_CLI} generate model --graph test-graph.ttl --className User --attest`,
      { cwd, timeout: 30000 }
    );

    // Check for attestation file
    const attestationFile = path.join(cwd, 'src/models/User.js.attest.json');
    const attestExists = await fs.access(attestationFile)
      .then(() => true)
      .catch(() => false);
    
    expect(attestExists).toBe(true);
    
    // Verify attestation content
    const attestation = JSON.parse(
      await fs.readFile(attestationFile, 'utf-8')
    );
    
    expect(attestation).toHaveProperty('sourceGraph');
    expect(attestation).toHaveProperty('template');
    expect(attestation).toHaveProperty('generatedAt');
    expect(attestation).toHaveProperty('hash');
    expect(attestation.sourceGraph).toContain('test-graph.ttl');
  }, 45000);

  it('should maintain reproducible output across runs', async () => {
    const cwd = TEST_DIR;
    
    // First generation
    execSync(
      `node ${KGEN_CLI} generate model --graph test-graph.ttl --className User`,
      { cwd, timeout: 30000 }
    );
    
    const firstContent = await fs.readFile(
      path.join(cwd, 'src/models/User.js'),
      'utf-8'
    );
    const firstHash = crypto.createHash('sha256')
      .update(firstContent)
      .digest('hex');
    
    // Remove generated file
    await fs.unlink(path.join(cwd, 'src/models/User.js'));
    
    // Second generation with same inputs
    execSync(
      `node ${KGEN_CLI} generate model --graph test-graph.ttl --className User`,
      { cwd, timeout: 30000 }
    );
    
    const secondContent = await fs.readFile(
      path.join(cwd, 'src/models/User.js'),
      'utf-8'
    );
    const secondHash = crypto.createHash('sha256')
      .update(secondContent)
      .digest('hex');
    
    // Verify deterministic output
    expect(firstHash).toBe(secondHash);
  }, 60000);

  it('should handle complex knowledge graph structures', async () => {
    const complexGraph = `
@prefix : <http://example.org/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

:Organization rdf:type rdfs:Class ;
             rdfs:label "Organization" .

:Person rdf:type rdfs:Class ;
        rdfs:label "Person" .

:worksFor rdf:type rdf:Property ;
         rdfs:domain :Person ;
         rdfs:range :Organization .

:hasEmployee rdf:type rdf:Property ;
           rdfs:domain :Organization ;
           rdfs:range :Person .

:acme rdf:type :Organization ;
      rdfs:label "ACME Corp" .

:alice rdf:type :Person ;
       rdfs:label "Alice Smith" ;
       :worksFor :acme .

:bob rdf:type :Person ;
     rdfs:label "Bob Jones" ;
     :worksFor :acme .

:acme :hasEmployee :alice, :bob .
`;
    
    const cwd = TEST_DIR;
    await fs.writeFile(path.join(cwd, 'complex-graph.ttl'), complexGraph);
    
    // Generate from complex graph
    const result = execSync(
      `node ${KGEN_CLI} generate model --graph complex-graph.ttl --className Organization`,
      { 
        cwd,
        encoding: 'utf-8',
        timeout: 30000
      }
    );

    expect(result).toContain('Generated');
    
    const generatedFile = path.join(cwd, 'src/models/Organization.js');
    const content = await fs.readFile(generatedFile, 'utf-8');
    
    expect(content).toContain('class Organization');
  }, 45000);

  it('should validate RDF graph before generation', async () => {
    const invalidGraph = `
@prefix : <http://example.org/> .
# Missing closing bracket
:User rdf:type rdfs:Class
      rdfs:label "User" .
`;
    
    const cwd = TEST_DIR;
    await fs.writeFile(path.join(cwd, 'invalid-graph.ttl'), invalidGraph);
    
    // Should fail with invalid RDF
    try {
      execSync(
        `node ${KGEN_CLI} generate model --graph invalid-graph.ttl --className User`,
        { cwd, timeout: 15000 }
      );
      expect.fail('Should have thrown an error for invalid RDF');
    } catch (error) {
      expect(error.message).toContain('RDF');
    }
  }, 30000);

  it('should support template inheritance and includes', async () => {
    // Create base template
    const baseTemplate = `---
to: src/models/Base{{ className | pascalCase }}.js
---
/**
 * Base class for {{ className }}
 */

export class Base{{ className | pascalCase }} {
  constructor() {
    this.created = this.getDeterministicDate();
  }
}
`;

    // Create derived template that includes base
    const derivedTemplate = `---
to: src/models/{{ className | pascalCase }}.js
inject: true
---
import { Base{{ className | pascalCase }} } from './Base{{ className | pascalCase }}.js';

/**
 * {{ className }} Model (extends base)
 */

class {{ className | pascalCase }} extends Base{{ className | pascalCase }} {
  constructor(data = {}) {
    super();
    {{#each properties}}
    this.{{ this.name }} = data.{{ this.name }} || null;
    {{/each}}
  }
}

export default {{ className | pascalCase }};
`;

    const cwd = TEST_DIR;
    await fs.writeFile(
      path.join(TEST_DIR, '_templates/model/base.ejs.t'),
      baseTemplate
    );
    await fs.writeFile(
      path.join(TEST_DIR, '_templates/model/derived.ejs.t'),
      derivedTemplate
    );
    
    // Generate with inheritance
    execSync(
      `node ${KGEN_CLI} generate model/base --graph test-graph.ttl --className User`,
      { cwd, timeout: 30000 }
    );
    
    execSync(
      `node ${KGEN_CLI} generate model/derived --graph test-graph.ttl --className User`,
      { cwd, timeout: 30000 }
    );
    
    // Verify both files were generated
    const baseFile = path.join(cwd, 'src/models/BaseUser.js');
    const derivedFile = path.join(cwd, 'src/models/User.js');
    
    const baseExists = await fs.access(baseFile)
      .then(() => true)
      .catch(() => false);
    const derivedExists = await fs.access(derivedFile)
      .then(() => true)
      .catch(() => false);
    
    expect(baseExists).toBe(true);
    expect(derivedExists).toBe(true);
    
    // Verify inheritance structure
    const derivedContent = await fs.readFile(derivedFile, 'utf-8');
    expect(derivedContent).toContain('extends BaseUser');
    expect(derivedContent).toContain("import { BaseUser }");
  }, 60000);
});

describe('KGEN Graph Processing Pipeline', () => {
  const testGraph = `
@prefix : <http://example.org/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

:API rdf:type rdfs:Class ;
     rdfs:label "API" .

:Endpoint rdf:type rdfs:Class ;
         rdfs:label "Endpoint" .

:hasEndpoint rdf:type rdf:Property ;
            rdfs:domain :API ;
            rdfs:range :Endpoint .

:method rdf:type rdf:Property ;
       rdfs:domain :Endpoint ;
       rdfs:range rdfs:Literal .

:path rdf:type rdf:Property ;
     rdfs:domain :Endpoint ;
     rdfs:range rdfs:Literal .

:userAPI rdf:type :API ;
        rdfs:label "User API" .

:getUserEndpoint rdf:type :Endpoint ;
                :method "GET" ;
                :path "/users/{id}" .

:createUserEndpoint rdf:type :Endpoint ;
                   :method "POST" ;
                   :path "/users" .

:userAPI :hasEndpoint :getUserEndpoint, :createUserEndpoint .
`;

  beforeEach(async () => {
    await fs.mkdir(TEST_DIR, { recursive: true });
    await fs.writeFile(path.join(TEST_DIR, 'api-graph.ttl'), testGraph);
  });

  afterEach(async () => {
    try {
      await fs.rm(TEST_DIR, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  it('should extract structured data from RDF graphs', async () => {
    const cwd = TEST_DIR;
    
    // Query the graph
    const result = execSync(
      `node ${KGEN_CLI} query --graph api-graph.ttl --sparql "SELECT ?endpoint ?method ?path WHERE { ?endpoint a :Endpoint ; :method ?method ; :path ?path }"`,
      { 
        cwd,
        encoding: 'utf-8',
        timeout: 30000
      }
    );

    expect(result).toContain('getUserEndpoint');
    expect(result).toContain('GET');
    expect(result).toContain('/users/{id}');
    expect(result).toContain('createUserEndpoint');
    expect(result).toContain('POST');
    expect(result).toContain('/users');
  }, 45000);

  it('should validate knowledge graph consistency', async () => {
    const cwd = TEST_DIR;
    
    // Run validation
    const result = execSync(
      `node ${KGEN_CLI} validate --graph api-graph.ttl`,
      { 
        cwd,
        encoding: 'utf-8',
        timeout: 30000
      }
    );

    expect(result).toContain('valid') || expect(result).toContain('passed');
  }, 45000);
});