import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SemanticValidationPipelineImpl } from '../../src/lib/semantic-validator.js';
import { SHACLValidator } from '../../src/lib/shacl-validator.js';
import { TemplateValidator } from '../../src/lib/template-validator.js';
describe('Validation Pipeline', () => { let pipeline;
  let shaclValidator;
  let templateValidator;

  beforeEach(() => {
    pipeline = new SemanticValidationPipelineImpl({
      enableCaching: true,
      maxCacheSize: 1000,
      logger: {
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

  describe('SemanticValidationPipeline', () => { describe('RDF Validation', () => {
      it('should validate valid RDF content successfully', async () => {
        const validRDF = `
          @prefix ex: <http://example.org/> .
          ex:subject ex:predicate "object" .
        `;

      it('should detect syntax errors in RDF content', async () => {
        const invalidRDF = `
          @prefix ex: <http://example.org/> .
          ex:subject ex:predicate [invalid syntax] .
        `;
        
        const result = await pipeline.validate(invalidRDF, 'turtle');
        expect(result.errors.length).toBeGreaterThan(0);
      });

      it('should detect circular references', async () => {
        const circularRDF = `
          @prefix ex: <http://example.org/> .
          ex:A ex:contains ex:B .
          ex:B ex:contains ex:A .
        `;
        
        expect(result.warnings.some(w => w.code === 'CIRCULAR_REFERENCE')).toBe(true);
      });

      it('should validate datatype constraints', async () => { const datatypeRDF = `
          @prefix ex });
        
        expect(result.errors.some(e => e.code === 'INVALID_DATATYPE')).toBe(true);
      });

      it('should validate namespace prefixes', async () => { const invalidPrefixRDF = `
          @prefix ex });
        
        expect(result.errors.some(e => e.code === 'UNDEFINED_PREFIX')).toBe(true);
      });
    });

    describe('Performance and Caching', () => { it('should cache validation results', async () => {
        const rdf = `
          @prefix ex });

      it('should respect performance thresholds', async () => { // Create large RDF content
        let largeRDF = '@prefix ex } ex:property "value${i}" .\n`;
        }

        const result = await pipeline.validateRDF(largeRDF, { performanceThresholds });

      it('should provide detailed performance metrics', async () => { const rdf = `
          @prefix ex });
        
        expect(result.performance).toBeDefined();
        expect(result.performance.parsingTime).toBeGreaterThanOrEqual(0);
        expect(result.performance.validationTime).toBeGreaterThanOrEqual(0);
        expect(result.performance.totalTime).toBeGreaterThanOrEqual(0);
        expect(result.performance.memoryUsage).toBeGreaterThan(0);
        expect(result.performance!.tripleCount).toBeGreaterThan(0);
      });
    });

    describe('Batch Validation', () => { it('should validate multiple RDF sources in parallel', async () => {
        const sources = [
          { id },
          { id },
          { id }
        ];

        const results = await pipeline.validateBatch(sources);
        
        expect(results).toHaveLength(3);
        expect(results.every(r => r.isValid)).toBe(true);
        expect(results[0].sourceId).toBe('source1');
        expect(results[1].sourceId).toBe('source2');
        expect(results[2].sourceId).toBe('source3');
      });

      it('should handle mixed validation results in batch', async () => { const sources = [
          { id },
          { id } // Incomplete
        ];

        const results = await pipeline.validateBatch(sources);
        
        expect(results).toHaveLength(2);
        expect(results.find(r => r.sourceId === 'valid')?.isValid).toBe(true);
        expect(results.find(r => r.sourceId === 'invalid')?.isValid).toBe(false);
      });
    });

    describe('Custom Rules', () => { it('should apply custom validation rules', async () => {
        const customRule = {
          name }
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

  describe('SHACLValidator', () => { describe('Shape Validation', () => {
      it('should validate against SHACL shapes', async () => {
        const shapes = `
          @prefix sh });

      it('should detect SHACL constraint violations', async () => { const shapes = `
          @prefix sh });

      it('should validate cardinality constraints', async () => { const constraints = [
          {
            type },
          { type }
        ];

        const subject = { uri }]
          },
          type: ['http://xmlns.com/foaf/0.1/Person']
        };

        const result = shaclValidator.validateConstraints(subject, constraints);
        
        expect(result.some(v => v.constraint.type === 'minCount')).toBe(true);
      });

      it('should validate datatype constraints', async () => { const constraints = [
          {
            type }
        ];

        const subject = { uri }]
          },
          type: []
        };

        const result = shaclValidator.validateConstraints(subject, constraints);
        
        expect(result.some(v => v.constraint.type === 'datatype')).toBe(true);
      });

      it('should validate node kind constraints', async () => { const constraints = [
          {
            type }
        ];

        const subject = { uri }]
          },
          type: []
        };

        const result = shaclValidator.validateConstraints(subject, constraints);
        
        expect(result.some(v => v.constraint.type === 'nodeKind')).toBe(true);
      });
    });

    describe('Common Shapes', () => { it('should provide common validation shapes', () => {
        const personShape = shaclValidator.getCommonShape('person');
        const organizationShape = shaclValidator.getCommonShape('organization');
        const documentShape = shaclValidator.getCommonShape('document');

        expect(personShape).toContain('foaf });
    });
  });

  describe('TemplateValidator', () => { describe('Syntax Validation', () => {
      it('should validate TypeScript syntax', async () => {
        const input = {
          content };
            }
          `,
          language: 'typescript',
          templateName: 'user-model'
        };

        const result = await templateValidator.validate(input);
        
        expect(result.isValid).toBe(true);
        expect(result.errors.filter(e => e.type === 'error')).toHaveLength(0);
      });

      it('should detect TypeScript syntax errors', async () => { const input = {
          content }
          `,
          language: 'typescript',
          templateName: 'invalid-user-model'
        };

        const result = await templateValidator.validate(input);
        
        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.category === 'syntax')).toBe(true);
      });

      it('should validate JavaScript syntax', async () => { const input = {
          content }
            
            module.exports = { calculateTotal };
          `,
          language: 'javascript',
          templateName: 'calculator'
        };

        const result = await templateValidator.validate(input);
        
        expect(result.isValid).toBe(true);
        expect(result.errors.filter(e => e.type === 'error')).toHaveLength(0);
      });

      it('should validate JSON syntax', async () => { const input = {
          content }
          }`,
          language: 'json',
          templateName: 'package-json'
        };

        const result = await templateValidator.validate(input);
        
        expect(result.isValid).toBe(true);
      });

      it('should detect JSON syntax errors', async () => { const input = {
          content }
          }`,
          language: 'json',
          templateName: 'invalid-package-json'
        };

        const result = await templateValidator.validate(input);
        
        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.category === 'syntax')).toBe(true);
      });
    });

    describe('Consistency Validation', () => { it('should validate import/export consistency', async () => {
        const input = {
          content } from './utils.js';
            
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

      it('should validate package.json dependencies', async () => { const input = {
          content }
          }`,
          language: 'json',
          templateName: 'package-json'
        };

        const result = await templateValidator.validate(input);
        
        expect(result.warnings.some(w => w.category === 'dependency')).toBe(true);
      });
    });

    describe('Template-Specific Validation', () => { it('should detect template placeholders', async () => {
        const input = {
          content }} { id }};
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

      it('should validate file size limits', async () => { const input = {
          content };

        const result = await templateValidator.validate(input);
        
        expect(result.warnings.some(w => w.category === 'performance' && w.code === 'FILE_SIZE_WARNING')).toBe(true);
      });
    });

    describe('Performance Validation', () => { it('should provide performance metrics', async () => {
        const input = {
          content }
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

    describe('Batch Template Validation', () => { it('should validate multiple templates', async () => {
        const templates = [
          {
            content }',
            language: 'javascript',
            templateName: 'template1'
          },
          { content }',
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

  describe('Integration Tests', () => { it('should integrate all validators in a complete workflow', async () => {
      // RDF data with SHACL shapes and template validation
      const rdfData = `
        @prefix ex };
      `;

      // Run all validations
      const [rdfResult, shaclResult, templateResult] = await Promise.all([
        pipeline.validateRDF(rdfData),
        shaclValidator.validate(rdfData, shaclShapes),
        templateValidator.validate({ content,
          language });

    it('should handle validation failures across all validators', async () => { const invalidRDF = `@prefix ex });
  });

  describe('Error Recovery and Resilience', () => {
    it('should handle malformed input gracefully', async () => {
      const result = await pipeline.validateRDF(null);
      
      expect(result.isValid).toBe(false);
      expect(result.errors[0].type).toBe('error');
      expect(result.errors[0].message).toContain('Invalid input');
    });

    it('should continue validation after encountering errors', async () => { const sources = [
        { id },
        { id },
        { id }
      ];

      const results = await pipeline.validateBatch(sources);
      
      expect(results).toHaveLength(3);
      expect(results.find(r => r.sourceId === 'valid')?.isValid).toBe(true);
      expect(results.find(r => r.sourceId === 'invalid1')?.isValid).toBe(false);
      expect(results.find(r => r.sourceId === 'invalid2')?.isValid).toBe(false);
    });
  });
});