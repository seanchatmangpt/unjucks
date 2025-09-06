import { describe, it, expect, beforeEach } from 'vitest';
import { SemanticValidator } from '../../src/lib/semantic-validator.js';
import type { TurtleData, RDFDataSource } from '../../src/lib/types/turtle-types.js';

describe('SemanticValidator', () => {
  let validator: SemanticValidator;

  beforeEach(() => {
    validator = new SemanticValidator({
      performanceThresholds: {
        maxTriples: 1000, // Lower threshold for testing
        maxMemoryMB: 100,
        maxProcessingTimeMs: 1000,
        maxQueryLatencyMs: 50
      },
      enabledCompliances: ['GDPR', 'HIPAA', 'SOX']
    });
  });

  describe('RDF Structure Validation', () => {
    it('should validate empty RDF data', async () => {
      const emptyData: TurtleData = {
        subjects: {},
        predicates: new Set(),
        triples: [],
        prefixes: {}
      };

      const result = await validator.validateRDFData(emptyData);
      
      expect(result.valid).toBe(false); // Empty data should generate warnings
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].code).toBe('STRUCTURE_EMPTY_DATA');
    });

    it('should validate valid RDF structure', async () => {
      const validData: TurtleData = {
        subjects: {
          'http://example.org/person/1': {
            uri: 'http://example.org/person/1',
            properties: {
              'http://www.w3.org/1999/02/22-rdf-syntax-ns#type': [{
                type: 'uri',
                value: 'http://xmlns.com/foaf/0.1/Person'
              }],
              'http://xmlns.com/foaf/0.1/name': [{
                type: 'literal',
                value: 'John Doe'
              }]
            },
            type: ['http://xmlns.com/foaf/0.1/Person']
          }
        },
        predicates: new Set([
          'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
          'http://xmlns.com/foaf/0.1/name'
        ]),
        triples: [],
        prefixes: {
          'foaf': 'http://xmlns.com/foaf/0.1/',
          'rdf': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#'
        }
      };

      const result = await validator.validateRDFData(validData);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Performance Validation', () => {
    it('should validate performance metrics', async () => {
      const largeData: TurtleData = {
        subjects: {},
        predicates: new Set(),
        triples: new Array(2000).fill(null).map((_, i) => ({
          subject: { termType: 'NamedNode', value: `http://example.org/item/${i}` },
          predicate: { termType: 'NamedNode', value: 'http://example.org/prop' },
          object: { termType: 'Literal', value: `Value ${i}`, language: '', datatype: null },
          graph: { termType: 'DefaultGraph', value: '' }
        })),
        prefixes: {}
      };

      const result = await validator.validateRDFData(largeData, {
        enablePerformance: true
      });
      
      expect(result.performance).toBeDefined();
      expect(result.performance!.tripleCount).toBe(2000);
      
      // Should have performance error due to exceeding threshold (1000)
      const performanceErrors = result.errors.filter(e => e.code.includes('PERF_'));
      expect(performanceErrors.length).toBeGreaterThan(0);
    });

    it('should pass performance validation for small datasets', async () => {
      const smallData: TurtleData = {
        subjects: {
          'http://example.org/person/1': {
            uri: 'http://example.org/person/1',
            properties: {
              'http://xmlns.com/foaf/0.1/name': [{
                type: 'literal',
                value: 'John Doe'
              }]
            },
            type: []
          }
        },
        predicates: new Set(['http://xmlns.com/foaf/0.1/name']),
        triples: [],
        prefixes: {}
      };

      const result = await validator.validateRDFData(smallData, {
        enablePerformance: true
      });
      
      expect(result.performance!.tripleCount).toBeLessThan(1000);
      const performanceErrors = result.errors.filter(e => e.code.includes('PERF_'));
      expect(performanceErrors.length).toBe(0);
    });
  });

  describe('GDPR Compliance Validation', () => {
    it('should detect personal data without protection', async () => {
      const personalData: TurtleData = {
        subjects: {
          'http://example.org/person/1': {
            uri: 'http://example.org/person/1',
            properties: {
              'http://xmlns.com/foaf/0.1/name': [{
                type: 'literal',
                value: 'john.doe@example.com' // Email indicates personal data
              }],
              'http://xmlns.com/foaf/0.1/phone': [{
                type: 'literal',
                value: '+1-555-0123'
              }]
            },
            type: ['http://xmlns.com/foaf/0.1/Person']
          }
        },
        predicates: new Set(['http://xmlns.com/foaf/0.1/name', 'http://xmlns.com/foaf/0.1/phone']),
        triples: [],
        prefixes: {}
      };

      const result = await validator.validateRDFData(personalData, {
        enableCompliance: true
      });
      
      expect(result.compliance).toBeDefined();
      const gdprResult = result.compliance!.find(c => c.framework === 'GDPR');
      expect(gdprResult).toBeDefined();
      expect(gdprResult!.compliant).toBe(false);
      expect(gdprResult!.violations.length).toBeGreaterThan(0);
    });

    it('should pass GDPR validation with proper protections', async () => {
      const protectedData: TurtleData = {
        subjects: {
          'http://example.org/person/1': {
            uri: 'http://example.org/person/1',
            properties: {
              'http://xmlns.com/foaf/0.1/name': [{
                type: 'literal',
                value: 'john.doe@example.com'
              }],
              'http://example.org/security/encrypted': [{
                type: 'literal',
                value: 'true'
              }],
              'http://example.org/gdpr/consent': [{
                type: 'literal',
                value: 'explicit'
              }],
              'http://purl.org/dc/terms/purpose': [{
                type: 'literal',
                value: 'user_authentication'
              }]
            },
            type: ['http://xmlns.com/foaf/0.1/Person']
          }
        },
        predicates: new Set(),
        triples: [],
        prefixes: {}
      };

      const result = await validator.validateRDFData(protectedData, {
        enableCompliance: true
      });
      
      const gdprResult = result.compliance!.find(c => c.framework === 'GDPR');
      expect(gdprResult!.violations.filter(v => v.severity === 'error').length).toBe(0);
    });
  });

  describe('HIPAA Compliance Validation', () => {
    it('should detect PHI without proper safeguards', async () => {
      const phiData: TurtleData = {
        subjects: {
          'http://example.org/patient/1': {
            uri: 'http://example.org/patient/1',
            properties: {
              'http://example.org/medical/diagnosis': [{
                type: 'literal',
                value: 'diabetes'
              }],
              'http://example.org/medical/treatment': [{
                type: 'literal',
                value: 'insulin therapy'
              }]
            },
            type: []
          }
        },
        predicates: new Set(),
        triples: [],
        prefixes: {}
      };

      const result = await validator.validateRDFData(phiData, {
        enableCompliance: true
      });
      
      const hipaaResult = result.compliance!.find(c => c.framework === 'HIPAA');
      expect(hipaaResult).toBeDefined();
      expect(hipaaResult!.compliant).toBe(false);
      expect(hipaaResult!.violations.some(v => v.code === 'HIPAA_PHI_UNENCRYPTED')).toBe(true);
    });
  });

  describe('SOX Compliance Validation', () => {
    it('should detect financial data without controls', async () => {
      const financialData: TurtleData = {
        subjects: {
          'http://example.org/transaction/1': {
            uri: 'http://example.org/transaction/1',
            properties: {
              'http://example.org/finance/revenue': [{
                type: 'literal',
                value: '1000000'
              }],
              'http://example.org/finance/expense': [{
                type: 'literal',
                value: '750000'
              }]
            },
            type: []
          }
        },
        predicates: new Set(),
        triples: [],
        prefixes: {}
      };

      const result = await validator.validateRDFData(financialData, {
        enableCompliance: true
      });
      
      const soxResult = result.compliance!.find(c => c.framework === 'SOX');
      expect(soxResult).toBeDefined();
      expect(soxResult!.compliant).toBe(false);
      expect(soxResult!.violations.some(v => v.code === 'SOX_MISSING_CONTROLS')).toBe(true);
    });
  });

  describe('Ontology Validation', () => {
    it('should validate ontology compliance', async () => {
      const ontologyData: TurtleData = {
        subjects: {
          'http://example.org/person/1': {
            uri: 'http://example.org/person/1',
            properties: {
              'http://xmlns.com/foaf/0.1/name': [{
                type: 'literal',
                value: 'John Doe'
              }]
            },
            type: [] // Missing type declaration
          }
        },
        predicates: new Set(),
        triples: [],
        prefixes: {}
      };

      const errors = await validator.validateOntology(ontologyData, 'http://xmlns.com/foaf/0.1/');
      
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.code === 'ONTOLOGY_MISSING_TYPE')).toBe(true);
    });
  });

  describe('Template Consistency Validation', () => {
    it('should validate consistency across templates', async () => {
      const templates = [
        {
          name: 'template1',
          data: {
            subjects: {
              'http://example.org/person/1': {
                uri: 'http://example.org/person/1',
                properties: {
                  'http://xmlns.com/foaf/0.1/name': [{
                    type: 'literal',
                    value: 'John'
                  }]
                },
                type: []
              }
            },
            predicates: new Set(),
            triples: [],
            prefixes: {}
          },
          variables: { name: 'John', age: 25 }
        },
        {
          name: 'template2', 
          data: {
            subjects: {},
            predicates: new Set(),
            triples: [],
            prefixes: {}
          },
          variables: { name: 'Jane', age: 'twenty-five' } // Type mismatch
        }
      ];

      const result = validator.validateTemplateConsistency(templates);
      
      expect(result.coherent).toBe(false);
      expect(result.conflicts.length).toBeGreaterThan(0);
      expect(result.conflicts.some(c => c.type === 'property_conflict')).toBe(true);
    });
  });

  describe('Metadata and Recommendations', () => {
    it('should provide validation metadata', async () => {
      const data: TurtleData = {
        subjects: {},
        predicates: new Set(),
        triples: [],
        prefixes: {}
      };

      const result = await validator.validateRDFData(data);
      
      expect(result.metadata).toBeDefined();
      expect(result.metadata.validationTime).toBeGreaterThan(0);
      expect(result.metadata.rulesApplied).toContain('rdf_structure_validation');
      expect(result.metadata.dataSourceCount).toBe(1);
    });

    it('should provide performance metrics', async () => {
      const data: TurtleData = {
        subjects: {},
        predicates: new Set(),
        triples: [],
        prefixes: {}
      };

      const result = await validator.validateRDFData(data, { enablePerformance: true });
      
      expect(result.performance).toBeDefined();
      expect(result.performance!.tripleCount).toBe(0);
      expect(result.performance!.processingTime).toBeGreaterThanOrEqual(0);
      expect(result.performance!.threshold).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle validation errors gracefully', async () => {
      // Pass invalid data structure
      const invalidData = null as any;

      const result = await validator.validateRDFData(invalidData);
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].code).toBe('VALIDATION_ERROR');
    });
  });
});