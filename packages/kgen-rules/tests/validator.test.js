/**
 * Test suite for KGEN Rules Validator
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { validateGraph, validateMultipleGraphs, createSummaryReport } from '../index.js';

describe('KGEN Rules Validator', () => {
  
  const validTtl = `
    @prefix ex: <http://example.org/> .
    @prefix foaf: <http://xmlns.com/foaf/0.1/> .
    
    ex:person1 a foaf:Person ;
        foaf:name "John Doe" ;
        foaf:age 30 .
  `;
  
  const validShacl = `
    @prefix ex: <http://example.org/> .
    @prefix foaf: <http://xmlns.com/foaf/0.1/> .
    @prefix sh: <http://www.w3.org/ns/shacl#> .
    @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
    
    ex:PersonShape a sh:NodeShape ;
        sh:targetClass foaf:Person ;
        sh:property [
            sh:path foaf:name ;
            sh:datatype xsd:string ;
            sh:minCount 1 ;
        ] ;
        sh:property [
            sh:path foaf:age ;
            sh:datatype xsd:integer ;
            sh:minInclusive 0 ;
        ] .
  `;
  
  const invalidTtl = `
    @prefix ex: <http://example.org/> .
    @prefix foaf: <http://xmlns.com/foaf/0.1/> .
    
    ex:person1 a foaf:Person .
  `;

  const invalidShacl = `
    @prefix ex: <http://example.org/> .
    @prefix foaf: <http://xmlns.com/foaf/0.1/> .
    @prefix sh: <http://www.w3.org/ns/shacl#> .
    @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
    
    ex:PersonShape a sh:NodeShape ;
        sh:targetClass foaf:Person ;
        sh:property [
            sh:path foaf:name ;
            sh:datatype xsd:string ;
            sh:minCount 1 ;
        ] .
  `;

  test('validateGraph returns correct structure for valid data', async () => {
    const result = await validateGraph({ ttl: validTtl, shacl: validShacl });
    
    assert.strictEqual(typeof result, 'object');
    assert.strictEqual(typeof result.ok, 'boolean');
    assert.strictEqual(Array.isArray(result.errors), true);
    assert.strictEqual(typeof result.graph, 'object');
    assert.strictEqual(typeof result.validation, 'object');
    
    // Check graph structure
    assert.strictEqual(typeof result.graph.tripleCount, 'number');
    assert.strictEqual(typeof result.graph.valid, 'boolean');
    
    // Check validation structure
    assert.strictEqual(typeof result.validation.duration, 'number');
    assert.strictEqual(typeof result.validation.shapesCount, 'number');
  });

  test('validateGraph reports valid data correctly', async () => {
    const result = await validateGraph({ ttl: validTtl, shacl: validShacl });
    
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.graph.valid, true);
    assert.strictEqual(result.errors.length, 0);
    assert.ok(result.graph.tripleCount > 0);
  });

  test('validateGraph reports invalid data correctly', async () => {
    const result = await validateGraph({ ttl: invalidTtl, shacl: invalidShacl });
    
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.graph.valid, false);
    assert.ok(result.errors.length > 0);
    
    // Check error structure
    const error = result.errors[0];
    assert.strictEqual(typeof error.path, 'string');
    assert.strictEqual(typeof error.message, 'string');
    assert.strictEqual(typeof error.constraint, 'string');
  });

  test('validateGraph handles parsing errors gracefully', async () => {
    const invalidSyntax = "invalid turtle syntax @#$%";
    const result = await validateGraph({ ttl: invalidSyntax, shacl: validShacl });
    
    assert.strictEqual(result.ok, false);
    assert.ok(result.errors.length > 0);
    assert.strictEqual(result.errors[0].constraint, 'system-error');
  });

  test('validateMultipleGraphs processes multiple validations', async () => {
    const validations = [
      { ttl: validTtl, shacl: validShacl },
      { ttl: invalidTtl, shacl: invalidShacl }
    ];
    
    const results = await validateMultipleGraphs(validations);
    
    assert.strictEqual(results.length, 2);
    assert.strictEqual(results[0].ok, true);
    assert.strictEqual(results[1].ok, false);
  });

  test('createSummaryReport generates correct summary', async () => {
    const reports = [
      { ok: true, errors: [], graph: { tripleCount: 10 }, validation: { duration: 100 } },
      { ok: false, errors: [{}], graph: { tripleCount: 5 }, validation: { duration: 150 } }
    ];
    
    const summary = createSummaryReport(reports);
    
    assert.strictEqual(summary.ok, false);
    assert.strictEqual(summary.summary.totalGraphs, 2);
    assert.strictEqual(summary.summary.validGraphs, 1);
    assert.strictEqual(summary.summary.invalidGraphs, 1);
    assert.strictEqual(summary.summary.totalErrors, 1);
    assert.strictEqual(summary.summary.totalTriples, 15);
    assert.strictEqual(summary.summary.totalDuration, 250);
    assert.strictEqual(summary.summary.averageDuration, 125);
  });

  test('validator reports correct metrics', async () => {
    const result = await validateGraph({ ttl: validTtl, shacl: validShacl });
    
    assert.ok(result.validation.duration >= 0);
    assert.ok(result.validation.shapesCount >= 0);
    assert.ok(result.graph.tripleCount > 0);
  });

  test('error structure contains required fields', async () => {
    const result = await validateGraph({ ttl: invalidTtl, shacl: invalidShacl });
    
    if (result.errors.length > 0) {
      const error = result.errors[0];
      assert.ok(error.hasOwnProperty('path'));
      assert.ok(error.hasOwnProperty('message'));
      assert.ok(error.hasOwnProperty('constraint'));
      assert.ok(error.hasOwnProperty('value'));
    }
  });
});