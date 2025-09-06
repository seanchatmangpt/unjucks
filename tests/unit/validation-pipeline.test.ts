import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SemanticValidationPipelineImpl } from '../../src/lib/semantic-validator.js';
import { SHACLValidator } from '../../src/lib/shacl-validator.js';
import { TemplateValidator } from '../../src/lib/template-validator.js';
import type { 
  ValidationResult, 
  ValidationError, 
  ValidationOptions,
  SHACLConstraint,
  TemplateValidationInput
} from '../../src/lib/types/validation.js';

describe('Validation Pipeline', () => {
  let pipeline: SemanticValidationPipelineImpl;
  let shaclValidator: SHACLValidator;
  let templateValidator: TemplateValidator;

  beforeEach(() => {
    pipeline = new SemanticValidationPipelineImpl({
      enableCaching: true,
      maxCacheSize: 100,
      logger: {
        info: () => {},
        warn: () => {},
        error: () => {},
        debug: () => {}
      }
    });
    shaclValidator = new SHACLValidator({});
    templateValidator = new TemplateValidator({});
  });

  afterEach(() => {
    pipeline.clearCache();
  });

  describe('SemanticValidationPipeline', () => {
    describe('RDF Validation', () => {
      it('should validate valid RDF content successfully', async () => {
        const validRDF = `
          @prefix ex: <http://example.org/> .
          @prefix foaf: <http://xmlns.com/foaf/0.1/> .
          
          ex:person1 a foaf:Person ;
                     foaf:name "John Doe" ;
                     foaf:age 30 .
        `;

        const result = await pipeline.validateRDF(validRDF);
        
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
        expect(result.triples).toBeGreaterThan(0);
        expect(result.performance).toBeDefined();
        expect(result.performance!.parsingTime).toBeGreaterThanOrEqual(0);
      });

      it('should detect syntax errors in RDF content', async () => {
        const invalidRDF = `
          @prefix ex: <http://example.org/> .
          @prefix foaf: <http://xmlns.com/foaf/0.1/> .
          
          ex:person1 a foaf:Person
          foaf:name "John Doe" ; // Missing semicolon
          foaf:age 30 .
        `;

        const result = await pipeline.validateRDF(invalidRDF);
        
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0].type).toBe('error');
        expect(result.errors[0].message).toContain('parsing');
      });

      it('should detect circular references', async () => {
        const circularRDF = `
          @prefix ex: <http://example.org/> .
          
          ex:person1 ex:knows ex:person2 .
          ex:person2 ex:knows ex:person3 .
          ex:person3 ex:knows ex:person1 .
        `;

        const result = await pipeline.validateRDF(circularRDF, {
          checkCircularReferences: true
        });
        
        expect(result.warnings.some(w => w.code === 'CIRCULAR_REFERENCE')).toBe(true);
      });

      it('should validate datatype constraints', async () => {
        const datatypeRDF = `
          @prefix ex: <http://example.org/> .
          @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
          
          ex:person1 ex:age "not-a-number"^^xsd:integer .
        `;

        const result = await pipeline.validateRDF(datatypeRDF, {
          validateDatatypes: true
        });
        
        expect(result.errors.some(e => e.code === 'INVALID_DATATYPE')).toBe(true);
      });

      it('should validate namespace prefixes', async () => {
        const invalidPrefixRDF = `
          @prefix ex: <http://example.org/> .
          
          ex:person1 unknown:property "value" .
        `;

        const result = await pipeline.validateRDF(invalidPrefixRDF, {
          validatePrefixes: true
        });
        
        expect(result.errors.some(e => e.code === 'UNDEFINED_PREFIX')).toBe(true);
      });
    });

    describe('Performance and Caching', () => {
      it('should cache validation results', async () => {
        const rdf = `
          @prefix ex: <http://example.org/> .
          ex:test ex:prop "value" .
        `;

        // First validation
        const result1 = await pipeline.validateRDF(rdf);
        const firstTime = result1.performance!.totalTime;

        // Second validation (should use cache)
        const result2 = await pipeline.validateRDF(rdf);
        const secondTime = result2.performance!.totalTime;

        expect(result1.isValid).toBe(result2.isValid);
        expect(secondTime).toBeLessThanOrEqual(firstTime);
      });

      it('should respect performance thresholds', async () => {
        // Create large RDF content
        let largeRDF = '@prefix ex: <http://example.org/> .\n';
        for (let i = 0; i < 1000; i++) {
          largeRDF += `ex:item${i} ex:property "value${i}" .\n`;
        }

        const result = await pipeline.validateRDF(largeRDF, {
          performanceThresholds: {
            maxTriples: 500,
            maxParsingTimeMs: 10000,
            maxMemoryMB: 100
          }
        });
        
        expect(result.warnings.some(w => w.code === 'PERFORMANCE_THRESHOLD_EXCEEDED')).toBe(true);
      });

      it('should provide detailed performance metrics', async () => {
        const rdf = `
          @prefix ex: <http://example.org/> .
          ex:person1 ex:name "John Doe" .
        `;

        const result = await pipeline.validateRDF(rdf, {
          collectMetrics: true
        });
        
        expect(result.performance).toBeDefined();
        expect(result.performance!.parsingTime).toBeGreaterThanOrEqual(0);
        expect(result.performance!.validationTime).toBeGreaterThanOrEqual(0);
        expect(result.performance!.totalTime).toBeGreaterThanOrEqual(0);
        expect(result.performance!.memoryUsage).toBeGreaterThan(0);
        expect(result.performance!.tripleCount).toBeGreaterThan(0);
      });
    });

    describe('Batch Validation', () => {
      it('should validate multiple RDF sources in parallel', async () => {
        const sources = [
          { id: 'source1', content: '@prefix ex: <http://example.org/> . ex:test1 ex:prop "value1" .' },
          { id: 'source2', content: '@prefix ex: <http://example.org/> . ex:test2 ex:prop "value2" .' },
          { id: 'source3', content: '@prefix ex: <http://example.org/> . ex:test3 ex:prop "value3" .' }
        ];

        const results = await pipeline.validateBatch(sources);
        
        expect(results).toHaveLength(3);
        expect(results.every(r => r.isValid)).toBe(true);
        expect(results[0].sourceId).toBe('source1');
        expect(results[1].sourceId).toBe('source2');
        expect(results[2].sourceId).toBe('source3');
      });

      it('should handle mixed validation results in batch', async () => {
        const sources = [
          { id: 'valid', content: '@prefix ex: <http://example.org/> . ex:test ex:prop "value" .' },
          { id: 'invalid', content: '@prefix ex: <http://example.org/> . ex:test ex:prop' } // Incomplete
        ];

        const results = await pipeline.validateBatch(sources);
        
        expect(results).toHaveLength(2);
        expect(results.find(r => r.sourceId === 'valid')?.isValid).toBe(true);
        expect(results.find(r => r.sourceId === 'invalid')?.isValid).toBe(false);
      });
    });

    describe('Custom Rules', () => {
      it('should apply custom validation rules', async () => {
        const customRule = {
          name: 'require-type',
          description: 'All subjects must have a type',
          validate: (result: ValidationResult) => {
            const errors: ValidationError[] = [];
            // Custom validation logic would go here
            return errors;
          }
        };

        pipeline.addCustomRule(customRule);

        const rdf = `
          @prefix ex: <http://example.org/> .
          ex:person1 ex:name "John Doe" .
        `;

        const result = await pipeline.validateRDF(rdf);
        
        expect(result.appliedRules).toContain('require-type');
      });
    });
  });

  describe('SHACLValidator', () => {
    describe('Shape Validation', () => {
      it('should validate against SHACL shapes', async () => {
        const shapes = `
          @prefix sh: <http://www.w3.org/ns/shacl#> .
          @prefix ex: <http://example.org/> .
          @prefix foaf: <http://xmlns.com/foaf/0.1/> .
          
          ex:PersonShape a sh:NodeShape ;
            sh:targetClass foaf:Person ;
            sh:property [
              sh:path foaf:name ;
              sh:datatype xsd:string ;
              sh:minCount 1 ;
              sh:maxCount 1 ;
            ] ;
            sh:property [
              sh:path foaf:age ;
              sh:datatype xsd:integer ;
              sh:minInclusive 0 ;
              sh:maxInclusive 150 ;
            ] .
        `;

        const data = `
          @prefix ex: <http://example.org/> .
          @prefix foaf: <http://xmlns.com/foaf/0.1/> .
          @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
          
          ex:person1 a foaf:Person ;
                     foaf:name "John Doe" ;
                     foaf:age 30 .
        `;

        const result = await shaclValidator.validate(data, shapes);
        
        expect(result.conforms).toBe(true);
        expect(result.violations).toHaveLength(0);
      });

      it('should detect SHACL constraint violations', async () => {
        const shapes = `
          @prefix sh: <http://www.w3.org/ns/shacl#> .
          @prefix ex: <http://example.org/> .
          @prefix foaf: <http://xmlns.com/foaf/0.1/> .
          @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
          
          ex:PersonShape a sh:NodeShape ;
            sh:targetClass foaf:Person ;
            sh:property [
              sh:path foaf:name ;
              sh:datatype xsd:string ;
              sh:minCount 1 ;
            ] .
        `;

        const data = `
          @prefix ex: <http://example.org/> .
          @prefix foaf: <http://xmlns.com/foaf/0.1/> .
          
          ex:person1 a foaf:Person .
        `;

        const result = await shaclValidator.validate(data, shapes);
        
        expect(result.conforms).toBe(false);
        expect(result.violations.length).toBeGreaterThan(0);
        expect(result.violations[0].constraint.type).toBe('minCount');
      });

      it('should validate cardinality constraints', async () => {
        const constraints: SHACLConstraint[] = [
          {
            type: 'minCount',
            property: 'http://xmlns.com/foaf/0.1/name',
            value: 1
          },
          {
            type: 'maxCount',
            property: 'http://xmlns.com/foaf/0.1/name',
            value: 1
          }
        ];

        const subject = {
          uri: 'http://example.org/person1',
          properties: {
            'http://www.w3.org/1999/02/22-rdf-syntax-ns#type': [{
              type: 'uri',
              value: 'http://xmlns.com/foaf/0.1/Person'
            }]
          },
          type: ['http://xmlns.com/foaf/0.1/Person']
        };

        const result = shaclValidator.validateConstraints(subject, constraints);
        
        expect(result.some(v => v.constraint.type === 'minCount')).toBe(true);
      });

      it('should validate datatype constraints', async () => {
        const constraints: SHACLConstraint[] = [
          {
            type: 'datatype',
            property: 'http://xmlns.com/foaf/0.1/age',
            value: 'http://www.w3.org/2001/XMLSchema#integer'
          }
        ];

        const subject = {
          uri: 'http://example.org/person1',
          properties: {
            'http://xmlns.com/foaf/0.1/age': [{
              type: 'literal',
              value: 'not-a-number'
            }]
          },
          type: []
        };

        const result = shaclValidator.validateConstraints(subject, constraints);
        
        expect(result.some(v => v.constraint.type === 'datatype')).toBe(true);
      });

      it('should validate node kind constraints', async () => {
        const constraints: SHACLConstraint[] = [
          {
            type: 'nodeKind',
            property: 'http://xmlns.com/foaf/0.1/knows',
            value: 'http://www.w3.org/ns/shacl#IRI'
          }
        ];

        const subject = {
          uri: 'http://example.org/person1',
          properties: {
            'http://xmlns.com/foaf/0.1/knows': [{
              type: 'literal',
              value: 'should-be-uri'
            }]
          },
          type: []
        };

        const result = shaclValidator.validateConstraints(subject, constraints);
        
        expect(result.some(v => v.constraint.type === 'nodeKind')).toBe(true);
      });
    });

    describe('Common Shapes', () => {
      it('should provide common validation shapes', () => {
        const personShape = shaclValidator.getCommonShape('person');
        const organizationShape = shaclValidator.getCommonShape('organization');
        const documentShape = shaclValidator.getCommonShape('document');

        expect(personShape).toContain('foaf:Person');
        expect(organizationShape).toContain('foaf:Organization');
        expect(documentShape).toContain('foaf:Document');
      });
    });
  });

  describe('TemplateValidator', () => {
    describe('Syntax Validation', () => {
      it('should validate TypeScript syntax', async () => {
        const input: TemplateValidationInput = {
          content: `
            interface User {
              id: number;
              name: string;
              email: string;
            }
            
            function createUser(data: Partial<User>): User {
              return {
                id: Math.random(),
                name: data.name || '',
                email: data.email || ''
              };
            }
          `,
          language: 'typescript',
          templateName: 'user-model'
        };

        const result = await templateValidator.validate(input);
        
        expect(result.isValid).toBe(true);
        expect(result.errors.filter(e => e.type === 'error')).toHaveLength(0);
      });

      it('should detect TypeScript syntax errors', async () => {
        const input: TemplateValidationInput = {
          content: `
            interface User {
              id: number;
              name: string;
              email: string; // Missing closing brace
            
            function createUser(data: Partial<User>): User {
              return {
                id: Math.random(),
                name: data.name || '',
                email: data.email || ''
              };
            }
          `,
          language: 'typescript',
          templateName: 'invalid-user-model'
        };

        const result = await templateValidator.validate(input);
        
        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.category === 'syntax')).toBe(true);
      });

      it('should validate JavaScript syntax', async () => {
        const input: TemplateValidationInput = {
          content: `
            function calculateTotal(items) {
              return items.reduce((sum, item) => sum + item.price, 0);
            }
            
            module.exports = { calculateTotal };
          `,
          language: 'javascript',
          templateName: 'calculator'
        };

        const result = await templateValidator.validate(input);
        
        expect(result.isValid).toBe(true);
        expect(result.errors.filter(e => e.type === 'error')).toHaveLength(0);
      });

      it('should validate JSON syntax', async () => {
        const input: TemplateValidationInput = {
          content: `{
            "name": "test-package",
            "version": "1.0.0",
            "dependencies": {
              "lodash": "^4.17.21"
            }
          }`,
          language: 'json',
          templateName: 'package-json'
        };

        const result = await templateValidator.validate(input);
        
        expect(result.isValid).toBe(true);
      });

      it('should detect JSON syntax errors', async () => {
        const input: TemplateValidationInput = {
          content: `{
            "name": "test-package",
            "version": "1.0.0",
            "dependencies": {
              "lodash": "^4.17.21",  // Trailing comma
            }
          }`,
          language: 'json',
          templateName: 'invalid-package-json'
        };

        const result = await templateValidator.validate(input);
        
        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.category === 'syntax')).toBe(true);
      });
    });

    describe('Consistency Validation', () => {
      it('should validate import/export consistency', async () => {
        const input: TemplateValidationInput = {
          content: `
            import { nonExistentFunction } from './utils';
            
            export function main() {
              return nonExistentFunction();
            }
          `,
          language: 'typescript',
          templateName: 'main-module',
          dependencies: ['./utils']
        };

        const result = await templateValidator.validate(input);
        
        expect(result.warnings.some(w => w.category === 'consistency')).toBe(true);
      });

      it('should validate package.json dependencies', async () => {
        const input: TemplateValidationInput = {
          content: `{
            "name": "test-package",
            "dependencies": {
              "nonexistent-package": "^1.0.0"
            }
          }`,
          language: 'json',
          templateName: 'package-json'
        };

        const result = await templateValidator.validate(input);
        
        expect(result.warnings.some(w => w.category === 'dependency')).toBe(true);
      });
    });

    describe('Template-Specific Validation', () => {
      it('should detect template placeholders', async () => {
        const input: TemplateValidationInput = {
          content: `
            export interface {{ className }} {
              id: {{ idType }};
              name: string;
            }
          `,
          language: 'typescript',
          templateName: 'interface-template'
        };

        const result = await templateValidator.validate(input);
        
        expect(result.templatePlaceholders).toContain('className');
        expect(result.templatePlaceholders).toContain('idType');
      });

      it('should validate file size limits', async () => {
        const input: TemplateValidationInput = {
          content: 'x'.repeat(2000000), // 2MB content
          language: 'javascript',
          templateName: 'large-file',
          maxFileSize: 1048576 // 1MB limit
        };

        const result = await templateValidator.validate(input);
        
        expect(result.warnings.some(w => w.category === 'performance' && w.code === 'FILE_SIZE_WARNING')).toBe(true);
      });
    });

    describe('Performance Validation', () => {
      it('should provide performance metrics', async () => {
        const input: TemplateValidationInput = {
          content: `
            function complexCalculation() {
              let result = 0;
              for (let i = 0; i < 1000; i++) {
                result += Math.sin(i) * Math.cos(i);
              }
              return result;
            }
          `,
          language: 'javascript',
          templateName: 'performance-test'
        };

        const result = await templateValidator.validate(input);
        
        expect(result.performance).toBeDefined();
        expect(result.performance!.validationTime).toBeGreaterThanOrEqual(0);
        expect(result.performance!.contentSize).toBeGreaterThan(0);
      });
    });

    describe('Batch Template Validation', () => {
      it('should validate multiple templates', async () => {
        const templates: TemplateValidationInput[] = [
          {
            content: 'function test1() { return "test1"; }',
            language: 'javascript',
            templateName: 'template1'
          },
          {
            content: 'function test2() { return "test2"; }',
            language: 'javascript', 
            templateName: 'template2'
          }
        ];

        const results = await templateValidator.validateBatch(templates);
        
        expect(results).toHaveLength(2);
        expect(results.every(r => r.isValid)).toBe(true);
      });
    });
  });

  describe('Integration Tests', () => {
    it('should integrate all validators in a complete workflow', async () => {
      // RDF data with SHACL shapes and template validation
      const rdfData = `
        @prefix ex: <http://example.org/> .
        @prefix foaf: <http://xmlns.com/foaf/0.1/> .
        
        ex:person1 a foaf:Person ;
                   foaf:name "John Doe" ;
                   foaf:age 30 .
      `;

      const shaclShapes = `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .
        @prefix foaf: <http://xmlns.com/foaf/0.1/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
        
        ex:PersonShape a sh:NodeShape ;
          sh:targetClass foaf:Person ;
          sh:property [
            sh:path foaf:name ;
            sh:datatype xsd:string ;
            sh:minCount 1 ;
          ] .
      `;

      const templateContent = `
        interface Person {
          name: string;
          age: number;
        }
        
        export const person: Person = {
          name: "John Doe",
          age: 30
        };
      `;

      // Run all validations
      const [rdfResult, shaclResult, templateResult] = await Promise.all([
        pipeline.validateRDF(rdfData),
        shaclValidator.validate(rdfData, shaclShapes),
        templateValidator.validate({
          content: templateContent,
          language: 'typescript',
          templateName: 'person-model'
        })
      ]);

      expect(rdfResult.isValid).toBe(true);
      expect(shaclResult.conforms).toBe(true);
      expect(templateResult.isValid).toBe(true);
    });

    it('should handle validation failures across all validators', async () => {
      const invalidRDF = `@prefix ex: <http://example.org/> . ex:test`;
      const invalidTemplate = `interface Test { missing brace`;

      const [rdfResult, templateResult] = await Promise.all([
        pipeline.validateRDF(invalidRDF),
        templateValidator.validate({
          content: invalidTemplate,
          language: 'typescript',
          templateName: 'invalid-template'
        })
      ]);

      expect(rdfResult.isValid).toBe(false);
      expect(templateResult.isValid).toBe(false);
      expect(rdfResult.errors.length).toBeGreaterThan(0);
      expect(templateResult.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should handle malformed input gracefully', async () => {
      const result = await pipeline.validateRDF(null as any);
      
      expect(result.isValid).toBe(false);
      expect(result.errors[0].type).toBe('error');
      expect(result.errors[0].message).toContain('Invalid input');
    });

    it('should continue validation after encountering errors', async () => {
      const sources = [
        { id: 'invalid1', content: null as any },
        { id: 'valid', content: '@prefix ex: <http://example.org/> . ex:test ex:prop "value" .' },
        { id: 'invalid2', content: '@prefix ex: <http://example.org/> . ex:test' }
      ];

      const results = await pipeline.validateBatch(sources);
      
      expect(results).toHaveLength(3);
      expect(results.find(r => r.sourceId === 'valid')?.isValid).toBe(true);
      expect(results.find(r => r.sourceId === 'invalid1')?.isValid).toBe(false);
      expect(results.find(r => r.sourceId === 'invalid2')?.isValid).toBe(false);
    });
  });
});