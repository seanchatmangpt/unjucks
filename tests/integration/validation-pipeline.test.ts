import { describe, it, expect, beforeEach } from 'vitest';
import { SemanticValidator } from '../../src/lib/semantic-validator.js';
import { FrontmatterParser } from '../../src/lib/frontmatter-parser.js';
import { RDFDataLoader } from '../../src/lib/rdf-data-loader.js';
import type { TurtleData } from '../../src/lib/types/turtle-types.js';

describe('Validation Pipeline Integration', () => {
  let validator: SemanticValidator;
  let parser: FrontmatterParser;
  let dataLoader: RDFDataLoader;

  beforeEach(() => {
    validator = new SemanticValidator({
      performanceThresholds: {
        maxTriples: 10000,
        maxMemoryMB: 512,
        maxProcessingTimeMs: 3000,
        maxQueryLatencyMs: 100
      },
      enabledCompliances: ['GDPR', 'HIPAA', 'SOX']
    });

    parser = new FrontmatterParser(true); // Enable validation
    dataLoader = new RDFDataLoader({
      cacheEnabled: true,
      cacheTTL: 300000
    });
  });

  describe('End-to-End Validation Pipeline', () => {
    it('should validate complete template with RDF data', async () => {
      const templateContent = `---
to: generated/{{entity.name}}.ts
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
// Generated TypeScript interface for {{entity.name}}
export interface {{entity.name | capitalize}} {
  name: string;
  email: string;
}`;

      // Parse template with semantic validation enabled
      const parsedTemplate = await parser.parse(templateContent, true);
      
      expect(parsedTemplate.hasValidFrontmatter).toBe(true);
      expect(parsedTemplate.frontmatter.semanticValidation?.enabled).toBe(true);

      // Load RDF data from frontmatter
      const rdfResult = await dataLoader.loadFromFrontmatter(parsedTemplate.frontmatter);
      
      expect(rdfResult.success).toBe(true);
      expect(rdfResult.data.triples.length).toBeGreaterThan(0);

      // Validate the loaded RDF data
      const validationResult = await validator.validateRDFData(rdfResult.data, {
        enableCompliance: true,
        enablePerformance: true,
        enableConsistency: false
      });

      expect(validationResult).toBeDefined();
      expect(validationResult.metadata.validationTime).toBeGreaterThan(0);

      // Check GDPR compliance (should have violations due to personal data)
      const gdprCompliance = validationResult.compliance?.find(c => c.framework === 'GDPR');
      expect(gdprCompliance).toBeDefined();
      expect(gdprCompliance!.violations.length).toBeGreaterThan(0);
    });

    it('should validate multiple data sources', async () => {
      const multiSourceTemplate = `---
to: generated/entities.ts
rdfSources:
  - type: inline
    source: |
      @prefix foaf: <http://xmlns.com/foaf/0.1/> .
      @prefix ex: <http://example.org/> .
      
      ex:person1 a foaf:Person ;
                 foaf:name "Person 1" .
  - type: inline
    source: |
      @prefix org: <http://www.w3.org/ns/org#> .
      @prefix ex: <http://example.org/> .
      
      ex:org1 a org:Organization ;
              org:identifier "ORG001" .
semanticValidation:
  enabled: true
  complianceFrameworks: ["GDPR", "SOX"]
---
// Multi-source entities`;

      const parsedTemplate = await parser.parse(multiSourceTemplate, true);
      const rdfResult = await dataLoader.loadFromFrontmatter(parsedTemplate.frontmatter);
      
      expect(rdfResult.success).toBe(true);
      expect(rdfResult.metadata.sourceCount).toBe(2);

      const validationResult = await validator.validateRDFData(rdfResult.data, {
        enableCompliance: true,
        enableConsistency: true
      });

      expect(validationResult.valid).toBeDefined();
      expect(validationResult.compliance?.length).toBe(2); // GDPR and SOX
    });
  });

  describe('Performance Validation Integration', () => {
    it('should validate large dataset performance', async () => {
      // Generate large inline RDF data
      const largeRdfData = generateLargeRDFData(5000); // 5000 triples
      
      const largeDataTemplate = `---
to: generated/large-dataset.ts
rdf:
  type: inline
  source: |
${largeRdfData}
semanticValidation:
  enabled: true
---
// Large dataset template`;

      const parsedTemplate = await parser.parse(largeDataTemplate, true);
      const rdfResult = await dataLoader.loadFromFrontmatter(parsedTemplate.frontmatter);
      
      expect(rdfResult.success).toBe(true);

      const validationResult = await validator.validateRDFData(rdfResult.data, {
        enablePerformance: true
      });

      expect(validationResult.performance).toBeDefined();
      expect(validationResult.performance!.tripleCount).toBe(5000);
      
      // Should pass since 5000 < 10000 threshold
      const perfErrors = validationResult.errors.filter(e => e.code.includes('PERF_'));
      expect(perfErrors.length).toBe(0);
    });

    it('should detect performance threshold violations', async () => {
      // Generate data exceeding threshold
      const oversizedData = generateLargeRDFData(15000); // Exceeds 10000 threshold
      
      const oversizedTemplate = `---
to: generated/oversized.ts
rdf:
  type: inline
  source: |
${oversizedData}
---
// Oversized template`;

      const parsedTemplate = await parser.parse(oversizedTemplate, true);
      const rdfResult = await dataLoader.loadFromFrontmatter(parsedTemplate.frontmatter);
      
      const validationResult = await validator.validateRDFData(rdfResult.data, {
        enablePerformance: true
      });

      expect(validationResult.performance!.tripleCount).toBe(15000);
      
      // Should have performance violations
      const perfErrors = validationResult.errors.filter(e => e.code.includes('PERF_'));
      expect(perfErrors.length).toBeGreaterThan(0);
    });
  });

  describe('Compliance Validation Integration', () => {
    it('should validate HIPAA compliance with medical data', async () => {
      const medicalTemplate = `---
to: generated/medical-records.ts
rdf:
  type: inline
  source: |
    @prefix ex: <http://example.org/> .
    @prefix medical: <http://example.org/medical/> .
    
    ex:patient1 medical:diagnosis "Type 2 Diabetes" ;
                medical:treatment "Metformin 500mg" ;
                medical:doctor "Dr. Smith" .
                
    ex:patient2 medical:diagnosis "Hypertension" ;
                medical:medication "Lisinopril" .
semanticValidation:
  enabled: true
  complianceFrameworks: ["HIPAA"]
---
// Medical records template`;

      const parsedTemplate = await parser.parse(medicalTemplate, true);
      const rdfResult = await dataLoader.loadFromFrontmatter(parsedTemplate.frontmatter);
      
      const validationResult = await validator.validateRDFData(rdfResult.data, {
        enableCompliance: true
      });

      const hipaaCompliance = validationResult.compliance?.find(c => c.framework === 'HIPAA');
      expect(hipaaCompliance).toBeDefined();
      expect(hipaaCompliance!.compliant).toBe(false); // Should fail due to unprotected PHI
      expect(hipaaCompliance!.violations.some(v => v.code === 'HIPAA_PHI_UNENCRYPTED')).toBe(true);
    });

    it('should validate SOX compliance with financial data', async () => {
      const financialTemplate = `---
to: generated/financial-reports.ts
rdf:
  type: inline
  source: |
    @prefix ex: <http://example.org/> .
    @prefix finance: <http://example.org/finance/> .
    @prefix dcterms: <http://purl.org/dc/terms/> .
    
    ex:transaction1 finance:revenue "1000000" ;
                    finance:expense "750000" ;
                    dcterms:created "2024-01-15T10:00:00Z" ;
                    dcterms:creator "accounting_system" .
semanticValidation:
  enabled: true
  complianceFrameworks: ["SOX"]
---
// Financial reports template`;

      const parsedTemplate = await parser.parse(financialTemplate, true);
      const rdfResult = await dataLoader.loadFromFrontmatter(parsedTemplate.frontmatter);
      
      const validationResult = await validator.validateRDFData(rdfResult.data, {
        enableCompliance: true
      });

      const soxCompliance = validationResult.compliance?.find(c => c.framework === 'SOX');
      expect(soxCompliance).toBeDefined();
      expect(soxCompliance!.violations.length).toBeGreaterThan(0); // Should have violations
    });
  });

  describe('Error Recovery and Reporting', () => {
    it('should handle invalid RDF data gracefully', async () => {
      const invalidTemplate = `---
to: generated/invalid.ts
rdf:
  type: inline
  source: |
    @prefix ex: <http://example.org/> .
    
    ex:invalid < invalid turtle syntax here
---
// Invalid template`;

      const parsedTemplate = await parser.parse(invalidTemplate, true);
      const rdfResult = await dataLoader.loadFromFrontmatter(parsedTemplate.frontmatter);
      
      // Should fail to load due to invalid syntax
      expect(rdfResult.success).toBe(false);
      expect(rdfResult.errors.length).toBeGreaterThan(0);
    });

    it('should provide comprehensive validation reports', async () => {
      const complexTemplate = `---
to: generated/complex.ts
rdf:
  type: inline
  source: |
    @prefix foaf: <http://xmlns.com/foaf/0.1/> .
    @prefix ex: <http://example.org/> .
    
    ex:person1 a foaf:Person ;
               foaf:name "John Doe" ;
               foaf:email "john@example.com" ;
               foaf:phone "+1-555-0123" .
semanticValidation:
  enabled: true
  complianceFrameworks: ["GDPR", "HIPAA", "SOX"]
  strictMode: true
---
// Complex validation template`;

      const parsedTemplate = await parser.parse(complexTemplate, true);
      const rdfResult = await dataLoader.loadFromFrontmatter(parsedTemplate.frontmatter);
      
      const validationResult = await validator.validateRDFData(rdfResult.data, {
        enableCompliance: true,
        enablePerformance: true,
        enableConsistency: false,
        strictMode: true
      });

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

  describe('Caching and Performance', () => {
    it('should cache validation results for repeated calls', async () => {
      const template = `---
to: generated/cached.ts
rdf:
  type: inline
  source: |
    @prefix ex: <http://example.org/> .
    ex:test ex:prop "value" .
---
// Cached template`;

      const parsedTemplate = await parser.parse(template, true);
      
      // First call
      const startTime1 = performance.now();
      const rdfResult1 = await dataLoader.loadFromFrontmatter(parsedTemplate.frontmatter);
      const endTime1 = performance.now();
      
      // Second call (should be cached)
      const startTime2 = performance.now();
      const rdfResult2 = await dataLoader.loadFromFrontmatter(parsedTemplate.frontmatter);
      const endTime2 = performance.now();

      expect(rdfResult1.success).toBe(true);
      expect(rdfResult2.success).toBe(true);
      
      // Second call should be faster due to caching
      const time1 = endTime1 - startTime1;
      const time2 = endTime2 - startTime2;
      expect(time2).toBeLessThan(time1);
    });
  });
});

// Helper function to generate large RDF datasets for testing
function generateLargeRDFData(tripleCount: number): string {
  let rdf = '@prefix ex: <http://example.org/> .\n@prefix foaf: <http://xmlns.com/foaf/0.1/> .\n\n';
  
  for (let i = 0; i < tripleCount; i++) {
    rdf += `ex:entity${i} a foaf:Person ;\n`;
    rdf += `  foaf:name "Person ${i}" ;\n`;
    rdf += `  ex:id "${i}" .\n\n`;
  }
  
  return rdf;
}