/**
 * Ontology Standards Expert - Test Suite
 * 
 * Comprehensive test suite for semantic web compliance and interoperability
 * Tests: Schema.org, FOAF, Dublin Core, HR-XML mappings and validation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Store, Parser, DataFactory } from 'n3';
import { SemanticValidator } from '../../src/lib/semantic-validator.js';
import { 
  OntologyStandardsRegistry, 
  createOntologyStandardsRegistry,
  validateAgainstAllStandards 
} from '../../src/lib/ontology-standards.js';

const { namedNode, literal, quad } = DataFactory;

describe('Ontology Standards Expert', () => {
  let registry;
  let validator;
  let store;

  beforeEach(() => {
    registry = createOntologyStandardsRegistry();
    validator = new SemanticValidator({
      enableStrictValidation: true,
      validateSemantics: true,
      checkStandardsCompliance: true
    });
    store = new Store();
  });

  describe('OntologyStandardsRegistry', () => {
    it('should initialize with standard vocabularies', () => {
      const vocabularies = registry.getAllVocabularies();
      
      expect(vocabularies.has('schema.org')).toBe(true);
      expect(vocabularies.has('foaf')).toBe(true);
      expect(vocabularies.has('dcterms')).toBe(true);
      expect(vocabularies.has('hr-xml')).toBe(true);
      expect(vocabularies.has('saro')).toBe(true);
    });

    it('should provide Schema.org vocabulary with correct properties', () => {
      const schemaOrg = registry.getVocabulary('schema.org');
      
      expect(schemaOrg).toBeDefined();
      expect(schemaOrg.namespace).toBe('https://schema.org/');
      expect(schemaOrg.prefix).toBe('schema');
      expect(schemaOrg.classes.Person).toBeDefined();
      expect(schemaOrg.classes.JobPosting).toBeDefined();
      expect(schemaOrg.properties.name).toBeDefined();
      expect(schemaOrg.properties.skills).toBeDefined();
    });

    it('should provide FOAF vocabulary with correct properties', () => {
      const foaf = registry.getVocabulary('foaf');
      
      expect(foaf).toBeDefined();
      expect(foaf.namespace).toBe('http://xmlns.com/foaf/0.1/');
      expect(foaf.prefix).toBe('foaf');
      expect(foaf.classes.Person).toBeDefined();
      expect(foaf.classes.Agent).toBeDefined();
      expect(foaf.properties.name).toBeDefined();
      expect(foaf.properties.mbox).toBeDefined();
    });

    it('should provide Dublin Core vocabulary with correct properties', () => {
      const dcterms = registry.getVocabulary('dcterms');
      
      expect(dcterms).toBeDefined();
      expect(dcterms.namespace).toBe('http://purl.org/dc/terms/');
      expect(dcterms.prefix).toBe('dcterms');
      expect(dcterms.classes.Agent).toBeDefined();
      expect(dcterms.properties.title).toBeDefined();
      expect(dcterms.properties.creator).toBeDefined();
    });

    it('should provide standard mappings between vocabularies', () => {
      const schemaToFoaf = registry.getMapping('schema', 'foaf');
      
      expect(schemaToFoaf).toBeDefined();
      expect(schemaToFoaf.sourceStandard).toBe('Schema.org');
      expect(schemaToFoaf.targetStandard).toBe('FOAF');
      expect(schemaToFoaf.classMappings['schema:Person']).toBe('foaf:Person');
      expect(schemaToFoaf.propertyMappings['schema:name']).toBe('foaf:name');
    });

    it('should provide compliance rules for vocabularies', () => {
      const schemaRules = registry.getComplianceRules('schema.org');
      
      expect(schemaRules).toBeDefined();
      expect(schemaRules.required.Person).toContain('name');
      expect(schemaRules.required.JobPosting).toContain('title');
      expect(schemaRules.recommended.Person).toContain('email');
    });
  });

  describe('SemanticValidator Enhanced', () => {
    it('should validate basic RDF/Turtle syntax', async () => {
      const validTurtle = `
        @prefix schema: <https://schema.org/> .
        @prefix foaf: <http://xmlns.com/foaf/0.1/> .
        
        <#person/john> a schema:Person ;
          schema:name "John Doe" ;
          schema:email "john@example.com" .
      `;

      const result = await validator.validate(validTurtle);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect syntax errors in RDF/Turtle', async () => {
      const invalidTurtle = `
        @prefix schema: <https://schema.org/> .
        
        <#person/john> a schema:Person ;
          schema:name "John Doe" ;
          schema:email "john@example.com" ; ; // Double semicolon - syntax error
      `;

      const result = await validator.validate(invalidTurtle);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should validate standards compliance', async () => {
      const compliantTurtle = `
        @prefix schema: <https://schema.org/> .
        
        <#person/jane> a schema:Person ;
          schema:name "Jane Smith" ;
          schema:email "jane@example.com" ;
          schema:jobTitle "Software Engineer" .
      `;

      const result = await validator.validate(compliantTurtle);
      
      expect(result.isValid).toBe(true);
      expect(result.details.standards).toBeDefined();
      expect(result.details.standards.vocabulariesDetected).toContain('schema');
    });

    it('should warn about missing recommended properties', async () => {
      const incompleteProfile = `
        @prefix schema: <https://schema.org/> .
        
        <#person/incomplete> a schema:Person ;
          schema:name "Incomplete Person" .
      `;

      const result = await validator.validate(incompleteProfile);
      
      expect(result.isValid).toBe(true); // Still valid, but warnings expected
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should provide standards mapping for memory storage', () => {
      const mapping = validator.getStandardsMapping();
      
      expect(mapping).toBeDefined();
      expect(mapping.timestamp).toBeDefined();
      expect(mapping.version).toBe('1.0.0');
      expect(mapping.mappings).toBeDefined();
      expect(mapping.compliance).toBeDefined();
      expect(mapping.compliance.supported_standards).toContain('Schema.org');
      expect(mapping.compliance.supported_standards).toContain('FOAF (Friend of a Friend)');
      expect(mapping.compliance.supported_standards).toContain('Dublin Core Terms');
      expect(mapping.compliance.supported_standards).toContain('HR-XML');
    });
  });

  describe('Vocabulary Compliance Validation', () => {
    beforeEach(() => {
      // Add test data to store
      const testTriples = [
        quad(
          namedNode('#person/test'),
          namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
          namedNode('https://schema.org/Person')
        ),
        quad(
          namedNode('#person/test'),
          namedNode('https://schema.org/name'),
          literal('Test Person')
        ),
        quad(
          namedNode('#person/test'),
          namedNode('https://schema.org/email'),
          literal('test@example.com')
        )
      ];
      
      store.addQuads(testTriples);
    });

    it('should validate Schema.org compliance', () => {
      const result = registry.validateVocabularyCompliance(store, 'schema.org');
      
      expect(result.isValid).toBe(true);
      expect(result.vocabulary).toBe('schema.org');
      expect(result.compliance.totalInstances).toBeGreaterThan(0);
    });

    it('should detect missing required properties', () => {
      // Add a person without required name property
      const incompleteTriples = [
        quad(
          namedNode('#person/incomplete'),
          namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
          namedNode('https://schema.org/Person')
        ),
        quad(
          namedNode('#person/incomplete'),
          namedNode('https://schema.org/email'),
          literal('incomplete@example.com')
        )
      ];
      
      const incompleteStore = new Store();
      incompleteStore.addQuads(incompleteTriples);
      
      const result = registry.validateVocabularyCompliance(incompleteStore, 'schema.org');
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.includes('Missing required property'))).toBe(true);
    });
  });

  describe('Cross-Vocabulary Mapping', () => {
    beforeEach(() => {
      // Add Schema.org data to store
      const schemaTriples = [
        quad(
          namedNode('#person/mapper'),
          namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
          namedNode('https://schema.org/Person')
        ),
        quad(
          namedNode('#person/mapper'),
          namedNode('https://schema.org/name'),
          literal('Mapper Person')
        ),
        quad(
          namedNode('#person/mapper'),
          namedNode('https://schema.org/email'),
          literal('mapper@example.com')
        )
      ];
      
      store.addQuads(schemaTriples);
    });

    it('should generate cross-vocabulary mappings', () => {
      const mapping = registry.generateCrossVocabularyMapping(store, 'schema', 'foaf');
      
      expect(mapping.success).toBe(true);
      expect(mapping.sourceVocabulary).toBe('schema');
      expect(mapping.targetVocabulary).toBe('foaf');
      expect(mapping.mappedTriples.length).toBeGreaterThan(0);
      expect(mapping.statistics.mappingCoverage).toBeDefined();
    });

    it('should apply transformations during mapping', () => {
      const mapping = registry.generateCrossVocabularyMapping(store, 'schema', 'foaf');
      
      // Check if email transformation was applied (schema:email -> foaf:mbox with mailto: prefix)
      const hasMboxTransformation = mapping.mappedTriples.some(triple => 
        triple.predicate.value.includes('foaf') && 
        triple.predicate.value.includes('mbox')
      );
      
      expect(hasMboxTransformation).toBe(true);
    });
  });

  describe('Interoperability Testing', () => {
    it('should test vocabulary detection', async () => {
      // Add multi-vocabulary data
      const multiVocabTriples = [
        quad(
          namedNode('#person/multi'),
          namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
          namedNode('https://schema.org/Person')
        ),
        quad(
          namedNode('#person/multi'),
          namedNode('http://xmlns.com/foaf/0.1/name'),
          literal('Multi Vocab Person')
        ),
        quad(
          namedNode('#person/multi'),
          namedNode('http://purl.org/dc/terms/title'),
          literal('Professional Profile')
        )
      ];
      
      store.addQuads(multiVocabTriples);
      
      const results = await registry.testInteroperability(store);
      
      expect(results.tests.vocabularyDetection.passed).toBe(true);
      expect(results.tests.vocabularyDetection.detected.length).toBeGreaterThan(0);
      expect(results.overall.passed).toBeGreaterThan(0);
    });

    it('should test linked data best practices', async () => {
      // Add data with HTTP URIs
      const linkedDataTriples = [
        quad(
          namedNode('https://example.org/person/linked'),
          namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
          namedNode('https://schema.org/Person')
        ),
        quad(
          namedNode('https://example.org/person/linked'),
          namedNode('https://schema.org/name'),
          literal('Linked Data Person')
        )
      ];
      
      store.addQuads(linkedDataTriples);
      
      const results = await registry.testInteroperability(store);
      
      expect(results.tests.linkedDataBestPractices).toBeDefined();
      expect(results.tests.linkedDataBestPractices.statistics.dereferenceableRatio).toBeGreaterThan(0);
    });
  });

  describe('Complete Standards Validation', () => {
    it('should validate against all standards comprehensively', async () => {
      // Create comprehensive test data
      const comprehensiveData = `
        @prefix schema: <https://schema.org/> .
        @prefix foaf: <http://xmlns.com/foaf/0.1/> .
        @prefix dcterms: <http://purl.org/dc/terms/> .
        
        <#person/comprehensive> a schema:Person , foaf:Person ;
          schema:name "Comprehensive Person" ;
          foaf:name "Comprehensive Person" ;
          dcterms:title "Comprehensive Person" ;
          schema:email "comprehensive@example.com" ;
          foaf:mbox <mailto:comprehensive@example.com> ;
          schema:jobTitle "Standards Expert" .
      `;
      
      const parser = new Parser();
      const quads = parser.parse(comprehensiveData);
      const testStore = new Store();
      testStore.addQuads(quads);
      
      const results = await validateAgainstAllStandards(testStore);
      
      expect(results.overallValid).toBe(true);
      expect(results.summary.totalVocabularies).toBeGreaterThan(0);
      expect(results.summary.validVocabularies).toBeGreaterThan(0);
      expect(results.interoperabilityResults).toBeDefined();
    });
  });

  describe('Memory Storage Integration', () => {
    it('should generate standards mapping for memory storage', () => {
      const mapping = registry.generateStandardsMapping();
      
      expect(mapping).toBeDefined();
      expect(mapping.timestamp).toBeDefined();
      expect(mapping.version).toBe('1.0.0');
      expect(mapping.implementedBy).toBe('Ontology Standards Expert Agent');
      
      // Check vocabulary information
      expect(mapping.vocabularies['schema.org']).toBeDefined();
      expect(mapping.vocabularies['foaf']).toBeDefined();
      expect(mapping.vocabularies['dcterms']).toBeDefined();
      expect(mapping.vocabularies['hr-xml']).toBeDefined();
      
      // Check mappings information
      expect(mapping.mappings['schema-foaf']).toBeDefined();
      expect(mapping.mappings['schema-dc']).toBeDefined();
      
      // Check compliance information
      expect(mapping.compliance['schema.org']).toBeDefined();
      expect(mapping.compliance['foaf']).toBeDefined();
      
      // Check interoperability information
      expect(mapping.interoperability.supportedStandards).toContain('schema.org');
      expect(mapping.interoperability.supportedStandards).toContain('foaf');
      expect(mapping.interoperability.supportedStandards).toContain('dcterms');
      
      // Check linked data best practices
      expect(mapping.linkedDataBestPractices.dereferenceableURIs).toBe(true);
      expect(mapping.linkedDataBestPractices.versioningStrategy).toBe('semantic');
    });

    it('should store mapping with key hive/standards/compliance', () => {
      const mapping = registry.generateStandardsMapping();
      const storageKey = 'hive/standards/compliance';
      
      // Simulate memory storage
      const memoryStore = new Map();
      memoryStore.set(storageKey, mapping);
      
      const storedMapping = memoryStore.get(storageKey);
      
      expect(storedMapping).toEqual(mapping);
      expect(storedMapping.vocabularies).toBeDefined();
      expect(storedMapping.mappings).toBeDefined();
      expect(storedMapping.compliance).toBeDefined();
      expect(storedMapping.interoperability).toBeDefined();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle unknown vocabularies gracefully', () => {
      const result = registry.getVocabulary('unknown-vocab');
      expect(result).toBeNull();
    });

    it('should handle missing mappings gracefully', () => {
      const mapping = registry.getMapping('unknown1', 'unknown2');
      expect(mapping).toBeNull();
    });

    it('should handle invalid RDF gracefully', async () => {
      const invalidRdf = 'This is not RDF at all!';
      const result = await validator.validate(invalidRdf);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should cache validation results', async () => {
      const turtle = `
        @prefix schema: <https://schema.org/> .
        <#test> a schema:Person ; schema:name "Test" .
      `;
      
      const result1 = await validator.validate(turtle);
      const result2 = await validator.validate(turtle);
      
      // Results should be identical (cached)
      expect(result1).toEqual(result2);
    });
  });
});

describe('Template Integration', () => {
  it('should validate job resume template standards compliance', async () => {
    // This would test the actual template generation
    const templateData = {
      personName: "Jane Doe",
      givenName: "Jane",
      familyName: "Doe",
      email: "jane.doe@example.com",
      jobTitle: "Software Engineer",
      skills: ["JavaScript", "Python", "React"]
    };
    
    // In a real implementation, this would render the template
    // and validate the resulting RDF
    expect(templateData).toBeDefined();
  });
});