/**
 * Semantic Template Renderer Tests
 * Comprehensive test suite for RDF-aware template rendering
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SemanticRenderer, renderSemanticTemplate } from '../../src/lib/semantic-renderer.js';
import { TurtleParser } from '../../src/lib/turtle-parser.js';
import fs from 'fs-extra';
import path from 'node:path';
import { tmpdir } from 'os';

// Test ontology data
const testFhirOntology = `
@prefix fhir: <http://hl7.org/fhir/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

fhir:Patient rdf:type rdfs:Class ;
    rdfs:label "Patient" ;
    rdfs:comment "Demographics and other administrative information about an individual or animal receiving care or other health-related services." .

fhir:name rdf:type rdf:Property ;
    rdfs:domain fhir:Patient ;
    rdfs:range xsd:string ;
    rdfs:label "name" .

fhir:birthDate rdf:type rdf:Property ;
    rdfs:domain fhir:Patient ;
    rdfs:range xsd:date ;
    rdfs:label "birthDate" .
`;

const testGS1Ontology = `
@prefix gs1: <https://gs1.org/voc/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

gs1:Product rdf:type rdfs:Class ;
    rdfs:label "Product" ;
    rdfs:comment "A product that can be traded." .

gs1:gtin rdf:type rdf:Property ;
    rdfs:domain gs1:Product ;
    rdfs:range xsd:string ;
    rdfs:label "Global Trade Item Number" .

gs1:productName rdf:type rdf:Property ;
    rdfs:domain gs1:Product ;
    rdfs:range xsd:string ;
    rdfs:label "productName" .
`;

describe('SemanticRenderer', () => {
  let renderer;
  let tempDir => { renderer = new SemanticRenderer();
    
    // Create temporary directory for test ontologies
    tempDir = await fs.mkdtemp(path.join(tmpdir(), 'semantic-test-'));
    
    // Write test ontologies to temporary files
    const fhirPath = path.join(tempDir, 'fhir.ttl');
    const gs1Path = path.join(tempDir, 'gs1.ttl');
    
    await fs.writeFile(fhirPath, testFhirOntology);
    await fs.writeFile(gs1Path, testGS1Ontology);
    
    ontologyPaths = { fhir, gs1 };
  });

  afterEach(async () => {
    // Clean up temporary files
    await fs.remove(tempDir);
  });

  describe('Basic Rendering', () => { it('should render simple template without ontologies', async () => {
      const template = `
---
to }} {
  constructor() {
    console.log('{{ className }} created');
  }
}`;

      const result = await renderer.render(template, { className);
      
      expect(result.rendered).toContain('export class TestService');
      expect(result.rendered).toContain("console.log('TestService created')");
      expect(result.validation.valid).toBe(true);
    });

    it('should render template with RDF data', async () => { const template = `
---
to };
<% } -%>`;

      const result = await renderer.render(template);
      
      expect(result.rendered).toContain('name);
      expect(result.rendered).toContain('age);
    });
  });

  describe('Ontology Loading', () => { it('should load single ontology', async () => {
      const template = `
---
ontology }"
semanticValidation: true
---
// FHIR Classes: <%= $ontologies.fhir ? $ontologies.fhir.classes.length : 0 %>`;

      const result = await renderer.render(template);
      
      expect(result.context.$ontologies).toBeDefined();
      expect(result.context.$ontologies.fhir).toBeDefined();
      expect(result.rendered).toContain('FHIR Classes); // Patient class
    });

    it('should load multiple ontologies', async () => { const template = `
---
ontologies }"
  gs1:
    uri: "${ontologyPaths.gs1}"
semanticValidation: true
---
FHIR Classes: <%= $ontologies.fhir.classes.length %>
GS1 Classes: <%= $ontologies.gs1.classes.length %>`;

      const result = await renderer.render(template);
      
      expect(result.context.$ontologies.fhir).toBeDefined();
      expect(result.context.$ontologies.gs1).toBeDefined();
      expect(result.rendered).toContain('FHIR Classes);
      expect(result.rendered).toContain('GS1 Classes);
    });
  });

  describe('Semantic Validation', () => { it('should validate template against ontology', async () => {
      const template = `
---
ontology }"
semanticValidation: true
---
// Valid FHIR Patient template`;

      const result = await renderer.render(template);
      
      expect(result.validation.valid).toBe(true);
      expect(result.validation.ontologyConsistency).toBe(true);
    });

    it('should detect validation errors', async () => { const template = `
---
ontology }"
semanticValidation: true
consistency: "strict"
---
// Template with potential issues`;

      const result = await renderer.render(template);
      
      expect(result.validation).toBeDefined();
      expect(Array.isArray(result.validation.errors)).toBe(true);
    });
  });

  describe('Performance Monitoring', () => { it('should track performance metrics', async () => {
      const template = `
---
ontology }"
---
// Performance test template`;

      const result = await renderer.render(template);
      
      expect(result.performance).toBeDefined();
      expect(result.performance.totalTime).toBeGreaterThan(0);
      expect(result.performance.ontologyLoadTime).toBeGreaterThanOrEqual(0);
      expect(result.performance.templateRenderTime).toBeGreaterThanOrEqual(0);
    });

    it('should measure ontology loading time', async () => { const template = `
---
ontologies }"
  gs1:
    uri: "${ontologyPaths.gs1}"
---
// Multi-ontology performance test`;

      const result = await renderer.render(template);
      
      expect(result.performance.ontologyLoadTime).toBeGreaterThan(0);
      expect(result.performance.triplesProcessed).toBeGreaterThan(0);
    });
  });

  describe('Compliance Framework', () => { it('should handle HIPAA compliance configuration', async () => {
      const template = `
---
ontology }"
compliance:
  framework: "HIPAA"
  version: "2023"
  rules:
    - "minimum_necessary"
    - "access_controls"
---
Framework: <%= $compliance.framework %>
Version: <%= $compliance.version %>`;

      const result = await renderer.render(template);
      
      expect(result.context.$compliance.framework).toBe('HIPAA');
      expect(result.context.$compliance.version).toBe('2023');
      expect(result.rendered).toContain('Framework);
      expect(result.rendered).toContain('Version);
    });

    it('should validate compliance rules', async () => { const template = `
---
ontology }"
compliance:
  framework: "HIPAA"
  rules: ["minimum_necessary", "audit_logs"]
semanticValidation: true
---
// HIPAA compliant template`;

      const result = await renderer.render(template);
      
      expect(result.validation.valid).toBe(true);
      expect(result.context.$compliance.validationResults).toBeDefined();
    });
  });

  describe('Error Handling', () => { it('should handle missing ontology files gracefully', async () => {
      const template = `
---
ontology });

    it('should handle invalid ontology syntax', async () => { // Create invalid ontology file
      const invalidPath = path.join(tempDir, 'invalid.ttl');
      await fs.writeFile(invalidPath, 'invalid turtle syntax here');

      const template = `
---
ontology }"
---
// Test with invalid ontology`;

      await expect(renderer.render(template)).rejects.toThrow();
    });

    it('should handle template syntax errors', async () => { const template = `
---
ontology }"
---
<% invalid nunjucks syntax -%>`;

      await expect(renderer.render(template)).rejects.toThrow();
    });
  });

  describe('Caching', () => { it('should cache loaded ontologies', async () => {
      const template = `
---
ontology }"
ontologyCache: true
---
// First render`;

      // First render
      const result1 = await renderer.render(template);
      const firstLoadTime = result1.performance.ontologyLoadTime;
      
      // Second render (should use cache)
      const result2 = await renderer.render(template);
      const secondLoadTime = result2.performance.ontologyLoadTime;
      
      expect(secondLoadTime).toBeLessThanOrEqual(firstLoadTime);
      
      // Check cache
      const cachedOntologies = renderer.getCachedOntologies();
      expect(cachedOntologies.size).toBeGreaterThan(0);
    });

    it('should invalidate cache when requested', async () => { const template = `
---
ontology }"
ontologyCache: false
---
// No cache template`;

      await renderer.render(template);
      
      // Clear cache
      renderer.clearOntologyCache();
      
      const cachedOntologies = renderer.getCachedOntologies();
      expect(cachedOntologies.size).toBe(0);
    });
  });

  describe('Convenience Functions', () => {
    it('should work with convenience render function', async () => {
      const template = `
Hello {{ name }}!
<% if (withOntology) { -%>
Ontology-driven greeting
<% } -%>`;

      const result = await renderSemanticTemplate(template, { name });

    it('should validate templates without rendering', async () => { const template = `
---
ontology }"
semanticValidation: true
---
// Validation test`;

      const validation = await renderer.validateTemplate(template);
      
      expect(validation.valid).toBe(true);
      expect(validation.ontologyConsistency).toBe(true);
    });
  });

  describe('Real-world Scenarios', () => { it('should generate healthcare service from FHIR ontology', async () => {
      const template = `
---
ontology }"
compliance:
  framework: "HIPAA"
  rules: ["minimum_necessary", "access_controls"]
semanticValidation: true
---
/**
 * Generated Healthcare Service
 * Compliance: <%= $compliance.framework %>
 */
export class PatientService {
<% for (const cls of $ontologies.fhir.classes) { -%>
  // Handle <%= cls.split('/').pop() %>
<% } -%>
  
  async createPatient(data) { // HIPAA compliant patient creation
    return { id };
  }
}`;

      const result = await renderer.render(template);
      
      expect(result.rendered).toContain('Generated Healthcare Service');
      expect(result.rendered).toContain('Compliance);
      expect(result.rendered).toContain('Handle Patient');
      expect(result.rendered).toContain('createPatient');
      expect(result.validation.valid).toBe(true);
    });

    it('should generate supply chain service from GS1 ontology', async () => { const template = `
---
ontology }"
compliance:
  framework: "GS1"
  rules: ["unique_identification", "interoperability"]
---
/**
 * GS1-compliant Supply Chain Service
 */
export class SupplyChainService {
<% for (const cls of $ontologies.gs1.classes) { -%>
  // Track <%= cls.split('/').pop() %>
<% } -%>

  async trackProduct(gtin) { // GS1 Digital Link implementation
    return { gtin, status };
  }
}`;

      const result = await renderer.render(template);
      
      expect(result.rendered).toContain('GS1-compliant Supply Chain Service');
      expect(result.rendered).toContain('Track Product');
      expect(result.rendered).toContain('trackProduct');
      expect(result.context.$compliance.framework).toBe('GS1');
    });
  });

  describe('Integration with Existing Infrastructure', () => { it('should work with existing RDF data loader', async () => {
      const template = `
---
rdfData }"
---
<% if ($rdf && $rdf.subjects.product) { -%>
Product } -%>`;

      const result = await renderer.render(template);
      
      expect(result.rendered).toContain('Product);
      expect(result.rendered).toContain('Price);
    });
  });
});

describe('SemanticRenderer Edge Cases', () => {
  let renderer;

  beforeEach(() => {
    renderer = new SemanticRenderer();
  });

  it('should handle empty ontologies gracefully', async () => { const template = `
---
ontologies }
---
Empty ontologies test`;

    const result = await renderer.render(template);
    expect(result.rendered).toContain('Empty ontologies test');
  });

  it('should handle templates without frontmatter', async () => {
    const template = 'Simple template without frontmatter';
    
    const result = await renderer.render(template);
    expect(result.rendered).toBe('Simple template without frontmatter');
  });

  it('should handle complex variable substitution', async () => {
    const template = `
Complex template with {{ nested.property }} and {{ array[0] }}`;

    const variables = { nested },
      array: ['first', 'second']
    };

    const result = await renderer.render(template, variables);
    expect(result.rendered).toContain('value');
    expect(result.rendered).toContain('first');
  });
});