import { describe, it, expect, beforeEach } from 'vitest';
import { SemanticValidator } from '../../src/lib/semantic-validator.js';
import { FrontmatterParser } from '../../src/lib/frontmatter-parser.js';
import { RDFDataLoader } from '../../src/lib/rdf-data-loader.js';
describe('Validation Pipeline Integration', () => { let validator;
  let parser;
  let dataLoader;

  beforeEach(() => {
    validator = new SemanticValidator({
      performanceThresholds },
      enabledCompliances, 'HIPAA', 'SOX']
    });

    parser = new FrontmatterParser(true); // Enable validation
    dataLoader = new RDFDataLoader({
      cacheEnabled,
      cacheTTL);
  });

  describe('End-to-End Validation Pipeline', () => { it('should validate complete template with RDF data', async () => {
      const templateContent = `---
to }}.ts
rdf:
  type: inline
  source: |
    @prefix foaf: <http://xmlns.com/foaf/0.1/> .
    @prefix ex: <http://example.org/> .
    
    ex:person1 a foaf:Person ;
               foaf:name "John Doe" ;
               foaf:email "john@example.com" .
               
    ex:person2 a foaf:Person ;
               foaf:name "Jane Smith" ;
               foaf:email "jane@example.com" .
semanticValidation:
  enabled: true
  complianceFrameworks: ["GDPR"]
  strictMode: true
---
// Generated TypeScript }
export interface {{entity.name | capitalize}} { name }`;

      // Parse template with semantic validation enabled
      const parsedTemplate = await parser.parse(templateContent, true);
      
      expect(parsedTemplate.hasValidFrontmatter).toBe(true);
      expect(parsedTemplate.frontmatter.semanticValidation?.enabled).toBe(true);

      // Load RDF data from frontmatter
      const rdfResult = await dataLoader.loadFromFrontmatter(parsedTemplate.frontmatter);
      
      expect(rdfResult.success).toBe(true);
      expect(rdfResult.data.triples.length).toBeGreaterThan(0);

      // Validate the loaded RDF data
      const validationResult = await validator.validateRDFData(rdfResult.data, { enableCompliance,
        enablePerformance,
        enableConsistency });

      expect(validationResult).toBeDefined();
      expect(validationResult.metadata.validationTime).toBeGreaterThan(0);

      // Check GDPR compliance (should have violations due to personal data)
      const gdprCompliance = validationResult.compliance?.find(c => c.framework === 'GDPR');
      expect(gdprCompliance).toBeDefined();
      expect(gdprCompliance!.violations.length).toBeGreaterThan(0);
    });

    it('should validate multiple data sources', async () => { const multiSourceTemplate = `---
to });

      expect(validationResult.valid).toBeDefined();
      expect(validationResult.compliance?.length).toBe(2); // GDPR and SOX
    });
  });

  describe('Performance Validation Integration', () => { it('should validate large dataset performance', async () => {
      // Generate large inline RDF data
      const largeRdfData = generateLargeRDFData(5000); // 5000 triples
      
      const largeDataTemplate = `---
to }
semanticValidation:
  enabled: true
---
// Large dataset template`;

      const parsedTemplate = await parser.parse(largeDataTemplate, true);
      const rdfResult = await dataLoader.loadFromFrontmatter(parsedTemplate.frontmatter);
      
      expect(rdfResult.success).toBe(true);

      const validationResult = await validator.validateRDFData(rdfResult.data, { enablePerformance });

      expect(validationResult.performance).toBeDefined();
      expect(validationResult.performance!.tripleCount).toBe(5000);
      
      // Should pass since 5000 < 10000 threshold
      const perfErrors = validationResult.errors.filter(e => e.code.includes('PERF_'));
      expect(perfErrors.length).toBe(0);
    });

    it('should detect performance threshold violations', async () => { // Generate data exceeding threshold
      const oversizedData = generateLargeRDFData(15000); // Exceeds 10000 threshold
      
      const oversizedTemplate = `---
to }
---
// Oversized template`;

      const parsedTemplate = await parser.parse(oversizedTemplate, true);
      const rdfResult = await dataLoader.loadFromFrontmatter(parsedTemplate.frontmatter);
      
      const validationResult = await validator.validateRDFData(rdfResult.data, { enablePerformance });

      expect(validationResult.performance!.tripleCount).toBe(15000);
      
      // Should have performance violations
      const perfErrors = validationResult.errors.filter(e => e.code.includes('PERF_'));
      expect(perfErrors.length).toBeGreaterThan(0);
    });
  });

  describe('Compliance Validation Integration', () => { it('should validate HIPAA compliance with medical data', async () => {
      const medicalTemplate = `---
to });

      const hipaaCompliance = validationResult.compliance?.find(c => c.framework === 'HIPAA');
      expect(hipaaCompliance).toBeDefined();
      expect(hipaaCompliance!.compliant).toBe(false); // Should fail due to unprotected PHI
      expect(hipaaCompliance!.violations.some(v => v.code === 'HIPAA_PHI_UNENCRYPTED')).toBe(true);
    });

    it('should validate SOX compliance with financial data', async () => { const financialTemplate = `---
to });

      const soxCompliance = validationResult.compliance?.find(c => c.framework === 'SOX');
      expect(soxCompliance).toBeDefined();
      expect(soxCompliance!.violations.length).toBeGreaterThan(0); // Should have violations
    });
  });

  describe('Error Recovery and Reporting', () => { it('should handle invalid RDF data gracefully', async () => {
      const invalidTemplate = `---
to });

    it('should provide comprehensive validation reports', async () => { const complexTemplate = `---
to });

      // Should have comprehensive validation results
      expect(validationResult.metadata).toBeDefined();
      expect(validationResult.performance).toBeDefined();
      expect(validationResult.compliance).toBeDefined();
      expect(validationResult.compliance!.length).toBe(3); // All three frameworks

      // Validate report structure
      for (const compliance of validationResult.compliance!) {
        expect(compliance.framework).toBeOneOf(['GDPR', 'HIPAA', 'SOX']);
        expect(compliance.riskLevel).toBeOneOf(['low', 'medium', 'high', 'critical']);
        expect(Array.isArray(compliance.violations)).toBe(true);
        expect(Array.isArray(compliance.recommendations)).toBe(true);
      }
    });
  });

  describe('Caching and Performance', () => { it('should cache validation results for repeated calls', async () => {
      const template = `---
to });
  });
});

// Helper function to generate large RDF datasets for testing
function generateLargeRDFData(tripleCount) { let rdf = '@prefix ex } a foaf:Person ;\n`;
    rdf += `  foaf:name "Person ${i}" ;\n`;
    rdf += `  ex:id "${i}" .\n\n`;
  }
  
  return rdf;
}