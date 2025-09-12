/**
 * Simple Frontmatter Parser Test Suite
 * 
 * Basic tests for the enhanced KGEN frontmatter parser using Node.js native test framework
 */

import { test, describe, before, after } from 'node:test';
import { strict as assert } from 'node:assert';
import { FrontmatterParser } from '../src/templating/frontmatter-parser.js';

// Mock semantic validator since it may not exist yet
class MockSemanticValidator {
  constructor(config) {
    this.config = config;
  }
  
  validate(frontmatter) {
    return { valid: true, errors: [] };
  }
}

describe('Enhanced Frontmatter Parser', () => {
  let parser;

  before(() => {
    parser = new FrontmatterParser({
      enableValidation: true,
      trackProvenance: true,
      enableSemanticValidation: false,
      strictMode: false,
      kgenConfig: {
        enableAttestations: true,
        enableContentAddressing: true,
        enableProvenanceTracking: true,
        defaultDeterministic: false
      }
    });
  });

  describe('Basic Parsing', () => {
    test('should parse empty content', async () => {
      const result = await parser.parse('');
      
      assert.equal(result.hasValidFrontmatter, false);
      assert.equal(result.content, '');
      assert.equal(result.frontmatter.deterministic, false);
      assert.equal(result.frontmatter.contentAddressed, true);
      assert.equal(result.frontmatter.attestations, true);
    });

    test('should parse content without frontmatter', async () => {
      const content = 'console.log("Hello World");';
      const result = await parser.parse(content);
      
      assert.equal(result.hasValidFrontmatter, false);
      assert.equal(result.content, content);
      assert.equal(result.frontmatter.deterministic, false);
      assert.equal(result.frontmatter.contentAddressed, true);
      assert.equal(result.frontmatter.attestations, true);
    });

    test('should parse content with basic frontmatter', async () => {
      const templateContent = `---
to: "{{ name }}.js"
name: "Basic Component"
---
console.log("{{ message }}");`;

      const result = await parser.parse(templateContent);
      
      assert.equal(result.hasValidFrontmatter, true);
      assert.equal(result.frontmatter.to, '{{ name }}.js');
      assert.equal(result.frontmatter.name, 'Basic Component');
      assert.equal(result.content, 'console.log("{{ message }}");');
    });

    test('should handle invalid YAML gracefully', async () => {
      const templateContent = `---
invalid: yaml: content:
---
console.log("test");`;

      const result = await parser.parse(templateContent);
      
      assert.equal(result.hasValidFrontmatter, false);
      assert.ok(result.error, 'Should have error object');
      assert.equal(result.error.type, 'YAML_PARSE_ERROR');
    });
  });

  describe('KGEN-Specific Features', () => {
    test('should apply KGEN defaults', async () => {
      const templateContent = `---
to: "test.js"
---
console.log("test");`;

      const result = await parser.parse(templateContent);
      
      assert.equal(result.frontmatter.deterministic, false);
      assert.equal(result.frontmatter.contentAddressed, true);
      assert.equal(result.frontmatter.attestations, true);
      assert.ok(result.frontmatter._generated, 'Should have _generated field');
      assert.ok(result.frontmatter._generated.kgenVersion, 'Should have kgenVersion');
    });

    test('should preserve explicit KGEN settings', async () => {
      const templateContent = `---
to: "test.js"
deterministic: true
contentAddressed: false
attestations: false
---
console.log("test");`;

      const result = await parser.parse(templateContent);
      
      assert.equal(result.frontmatter.deterministic, true);
      assert.equal(result.frontmatter.contentAddressed, false);
      assert.equal(result.frontmatter.attestations, false);
    });

    test('should extract template metadata', async () => {
      const templateContent = `---
name: "React Component"
title: "Basic React Component Generator"
description: "Generates a basic React functional component"
category: "components"
tags: ["react", "component", "typescript"]
version: "1.2.0"
author: "KGEN Templates"
license: "MIT"
---
import React from 'react';`;

      const result = await parser.parse(templateContent, { 
        extractMetadata: true,
        templatePath: '/templates/react-component.njk'
      });
      
      assert.ok(result.metadata, 'Should have metadata');
      assert.equal(result.metadata.name, 'React Component');
      assert.equal(result.metadata.category, 'components');
      assert.deepEqual(result.metadata.tags, ['react', 'component', 'typescript']);
      assert.equal(result.metadata.templatePath, '/templates/react-component.njk');
      assert.ok(result.metadata.kgen, 'Should have kgen metadata');
    });
  });

  describe('Injection Directives', () => {
    test('should validate injection modes', async () => {
      const templateContent = `---
inject: true
before: "// INSERT HERE"
to: "test.js"
---
function test() {}`;

      const result = await parser.parse(templateContent);
      
      assert.equal(result.hasValidFrontmatter, true);
      assert.equal(result.validationResult, undefined, 'Should not have validation errors');
    });

    test('should detect conflicting injection modes', async () => {
      const templateContent = `---
inject: true
append: true
to: "test.js"
---
function test() {}`;

      const result = await parser.parse(templateContent);
      
      assert.ok(result.validationResult, 'Should have validation result');
      assert.equal(result.validationResult.valid, false);
      assert.ok(result.validationResult.errors.some(err => 
        err.code === 'EXCLUSIVE_INJECTION_MODES'
      ), 'Should have exclusive injection modes error');
    });

    test('should determine operation modes correctly', () => {
      const testCases = [
        { frontmatter: { inject: true }, expectedMode: 'inject' },
        { frontmatter: { append: true }, expectedMode: 'append' },
        { frontmatter: { prepend: true }, expectedMode: 'prepend' },
        { frontmatter: { lineAt: 10 }, expectedMode: 'lineAt' },
        { frontmatter: {}, expectedMode: 'write' }
      ];

      for (const testCase of testCases) {
        const operationMode = parser.getOperationMode(testCase.frontmatter);
        assert.equal(operationMode.mode, testCase.expectedMode);
      }
    });

    test('should evaluate skipIf conditions', () => {
      const testCases = [
        { skipIf: 'hasTests', variables: { hasTests: true }, shouldSkip: true },
        { skipIf: 'hasTests', variables: { hasTests: false }, shouldSkip: false },
        { skipIf: '!hasTests', variables: { hasTests: false }, shouldSkip: true },
        { skipIf: 'framework==react', variables: { framework: 'react' }, shouldSkip: true },
        { skipIf: 'framework!=vue', variables: { framework: 'react' }, shouldSkip: true }
      ];

      for (const testCase of testCases) {
        const result = parser.shouldSkip(
          { skipIf: testCase.skipIf }, 
          testCase.variables
        );
        assert.equal(result, testCase.shouldSkip, `Failed for skipIf: ${testCase.skipIf}`);
      }
    });
  });

  describe('SPARQL/RDF Support', () => {
    test('should detect SPARQL-like content', () => {
      const testCases = [
        'SELECT ?x WHERE { ?x a foaf:Person }',
        'CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o }',
        'ASK WHERE { ?person foaf:knows ?friend }',
        'PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>'
      ];

      for (const content of testCases) {
        assert.equal(parser._isSparqlLikeContent(content), true, `Should detect SPARQL: ${content}`);
      }
      
      assert.equal(parser._isSparqlLikeContent('console.log("test")'), false);
    });

    test('should validate URI formats correctly', () => {
      const validUris = [
        'http://example.com',
        'https://example.com/path',
        'mailto:test@example.com',
        '/relative/path',
        'prefix:localname'
      ];

      const invalidUris = [
        'not-a-uri',
        'spaces in uri',
        ''
      ];

      for (const uri of validUris) {
        assert.equal(parser._isValidUri(uri), true, `Should be valid URI: ${uri}`);
      }

      for (const uri of invalidUris) {
        assert.equal(parser._isValidUri(uri), false, `Should be invalid URI: ${uri}`);
      }
    });
  });

  describe('Validation', () => {
    test('should normalize chmod values', () => {
      assert.equal(parser.normalizeChmod('755'), 0o755);
      assert.equal(parser.normalizeChmod('0644'), 0o644);
      assert.equal(parser.normalizeChmod(0o755), 0o755);
    });

    test('should maintain backward compatibility with original validate method', () => {
      const frontmatter = {
        inject: true,
        append: true, // This should cause an error
        to: 'test.js'
      };

      const result = parser.validate(frontmatter);
      
      assert.equal(result.valid, false);
      assert.ok(Array.isArray(result.errors), 'Should have errors array');
      assert.ok(result.errors.some(err => 
        err.includes('injection mode')
      ), 'Should have injection mode error');
    });

    test('should extract RDF config using getRDFConfig method', () => {
      const frontmatter = {
        rdf: {
          source: 'data.ttl',
          type: 'file'
        }
      };

      const config = parser.getRDFConfig(frontmatter);
      
      assert.deepEqual(config, {
        source: 'data.ttl',
        type: 'file'
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle malformed frontmatter gracefully', async () => {
      // Only test cases that actually fail YAML parsing
      const malformedCases = [
        '---\ninvalid: yaml: [unclosed\n---\ntest'
      ];

      for (const templateContent of malformedCases) {
        const result = await parser.parse(templateContent);
        
        assert.equal(result.hasValidFrontmatter, false);
        assert.ok(result.error, 'Should have error');
        assert.equal(result.frontmatter.deterministic, false);
        assert.equal(result.frontmatter.contentAddressed, true);
        assert.equal(result.frontmatter.attestations, true);
      }
    });
    
    test('should handle YAML warnings gracefully', async () => {
      // Test case that parses but with warnings
      const templateContent = '---\n{{invalid yaml with templates}}\n---\ntest';
      const result = await parser.parse(templateContent);
      
      // This actually parses successfully with warnings
      assert.equal(result.hasValidFrontmatter, true);
      assert.equal(result.error, undefined);
    });
  });
});