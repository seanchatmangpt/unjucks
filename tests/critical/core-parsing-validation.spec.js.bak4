/**
 * 80/20 Core Parsing Validation Suite
 * Tests the critical 20% of functionality that validates 80% of semantic parsing capabilities
 */
import { describe, test, expect, beforeEach } from 'vitest';
import { TurtleParser } from '../../src/lib/turtle-parser.js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
describe('80/20 Core Parsing Validation', () => {
  let parser;

  beforeEach(() => {
    parser = new TurtleParser();
  });

  // Test 1: Enterprise Scale Basic Parsing (15% coverage)
  // This single test validates the most critical parsing functionality
  test('Parse enterprise-scale ontology with business entities', async () => { // Load real enterprise-style data
    const enterpriseData = readFileSync(
      join(process.cwd(), 'tests/fixtures/turtle/enterprise-schema.ttl'), 
      'utf-8'
    );
    
    const startTime = performance.now();
    const result = await parser.parse(enterpriseData);
    const parseTime = performance.now() - startTime;
    
    // CRITICAL BUSINESS VALIDATIONS (80% of real-world usage)
    
    // 1. Scale validation - enterprise minimum
    expect(result.triples.length).toBeGreaterThan(100);
    expect(result.triples.length).toBeLessThan(100000); // Reasonable upper bound
    
    // 2. Performance validation - sub-second requirement
    expect(parseTime).toBeLessThan(1000);
    
    // 3. Essential vocabulary support
    expect(result.prefixes).toHaveProperty('foaf');
    expect(result.prefixes).toHaveProperty('schema');
    expect(result.prefixes.foaf).toBe('http });

  // Test 2: Multi-vocabulary Integration (10% coverage)
  // Validates cross-vocabulary relationships critical for enterprise integration
  test('Parse multi-vocabulary RDF with cross-references', async () => { const multiVocabData = `
      @prefix foaf });

  // Test 3: Template Variable Extraction (10% coverage)
  // Validates the core template integration that drives code generation
  test('Extract template variables from semantic data', async () => { const templateData = readFileSync(
      join(process.cwd(), 'tests/fixtures/turtle/basic-person.ttl'), 
      'utf-8'
    );
    
    const result = await parser.parse(templateData);
    
    // TEMPLATE INTEGRATION VALIDATION
    
    // 1. Core entity extraction
    const personTriples = result.triples.filter(triple => 
      triple.subject.value.includes('person1')
    );
    expect(personTriples.length).toBeGreaterThan(3); // Multiple properties needed
    
    // 2. Essential template variables that drive code generation
    const nameTriple = personTriples.find(triple => 
      triple.predicate.value.includes('name')
    );
    const emailTriple = personTriples.find(triple => 
      triple.predicate.value.includes('email')
    );
    const ageTriple = personTriples.find(triple =>
      triple.predicate.value.includes('age')
    );
    
    // These are the most common template variables in enterprise generation
    expect(nameTriple?.object.value).toBe('John Doe');
    expect(emailTriple?.object.value).toBe('john.doe@example.com');
    expect(ageTriple?.object.value).toBe('30');
    
    // 3. Validate object types for template processing
    expect(nameTriple?.object.type).toBe('literal');
    expect(emailTriple?.object.type).toBe('literal');
    
    // 4. Relationship validation for template context
    const relationshipTriples = result.triples.filter(triple =>
      triple.subject.value.includes('person1') &&
      triple.object.type === 'uri'
    );
    expect(relationshipTriples.length).toBeGreaterThan(0);
    
    // 5. Template variable structure validation
    const allPersonProperties = personTriples.map(triple => ({
      property).pop()?.split('#').pop(),
      value }));
    
    expect(allPersonProperties.length).toBeGreaterThan(3);
    expect(allPersonProperties.some(prop => prop.property === 'name')).toBe(true);
    expect(allPersonProperties.some(prop => prop.property === 'email')).toBe(true);
  });

  // Test 4: Critical Error Handling (5% coverage but high business impact)
  // Validates that parsing fails gracefully and provides actionable errors
  test('Handle parsing errors with detailed diagnostics', async () => { const invalidData = `
      @prefix foaf }
    
    // ERROR RECOVERY VALIDATION (critical for enterprise deployment)
    
    // 1. Error caught and wrapped properly
    expect(parseError).toBeDefined();
    expect(parseError.name).toBe('TurtleParseError');
    expect(parseError.message).toMatch(/Failed to parse Turtle/);
    
    // 2. Diagnostic information provided
    expect(parseError.line).toBeDefined();
    expect(parseError.column).toBeDefined();
    expect(parseError.originalError).toBeDefined();
    
    // 3. System stability maintained
    expect(parseError).toBeInstanceOf(Error);
    
    // 4. Can continue parsing after error
    const validData = `@prefix ex: <http://example.org/> . <#test> ex:name "Test" .`;
    const recoveryResult = await parser.parse(validData);
    expect(recoveryResult.triples.length).toBe(1);
  });

  // Test 5: Edge Case Handling (5% coverage but critical for reliability)
  // Validates handling of edge cases that could break enterprise systems
  test('Handle edge cases gracefully without failure', async () => {
    // EDGE CASE VALIDATION (critical for enterprise reliability)
    
    // 1. Empty content
    const emptyResult = await parser.parse('');
    expect(emptyResult.triples).toHaveLength(0);
    expect(emptyResult.stats.tripleCount).toBe(0);
    expect(emptyResult.prefixes).toEqual({});
    
    // 2. Comments only
    const commentsOnly = await parser.parse(`
      # This is just a comment
      # Another comment
      # No actual RDF data here
    `);
    expect(commentsOnly.triples).toHaveLength(0);
    expect(commentsOnly.stats.tripleCount).toBe(0);
    
    // 3. Whitespace only  
    const whitespaceOnly = await parser.parse('   \n\t  \n   \r\n  ');
    expect(whitespaceOnly.triples).toHaveLength(0);
    
    // 4. Single triple (minimal valid RDF)
    const singleTriple = await parser.parse('<#s> <#p> <#o> .');
    expect(singleTriple.triples).toHaveLength(1);
    expect(singleTriple.stats.tripleCount).toBe(1);
    
    // 5. Unicode handling
    const unicodeData = `
      @prefix ex: <http://example.org/> .
      <#test> ex:name "测试用户" ;
              ex:description "Тест пользователя" ;
              ex:emoji "🚀🌟" .
    `;
    const unicodeResult = await parser.parse(unicodeData);
    expect(unicodeResult.triples.length).toBeGreaterThan(2);
    
    const nameTriple = unicodeResult.triples.find(t => 
      t.predicate.value.includes('name')
    );
    expect(nameTriple?.object.value).toBe('测试用户');
  });
});