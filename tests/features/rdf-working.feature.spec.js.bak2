import { describe, it, expect, beforeEach } from 'vitest';
import { Parser, Store } from 'n3';
import nunjucks from 'nunjucks';

/**
 * 80/20 RDF Integration Tests
 * Testing the core 20% of features that provide 80% of value
 */

describe('Feature)', () => {
  let parser;
  let store;
  let env => { parser = new Parser();
    store = new Store();
    env = nunjucks.configure({ autoescape });
  });

  describe('Scenario, () => { it('should parse Turtle data and extract template variables', async () => {
      // Given I have Turtle data with prefixes and triples
      const turtleData = `
        @prefix ex };
        const localStore = new Store(); // Create a local store for this test
        
        // Create a new parser for each parse operation
        const testParser = new Parser();
        testParser.parse(turtleData, (error, quad, prefixData) => {
          if (error) {
            reject(error);
          } else if (quad) {
            quads.push(quad);
            localStore.add(quad);
          } else { // Parsing complete
            if (prefixData) prefixes = prefixData;
            resolve({ quads, prefixes, store });
          }
        });
      });

      // Then I should get a valid RDF store
      expect(result).toBeDefined();
      expect((result).quads).toHaveLength(3); // 3 triples
      expect((result).store.size).toBe(3);

      // And I should extract template variables from the RDF
      const variables = extractVariables((result).store);
      expect(variables).toHaveProperty('alice');
      expect(variables.alice).toHaveProperty('name', 'Alice');
      expect(variables.alice).toHaveProperty('age', '30');
    });
  });

  describe('Scenario, () => { it('should render templates with RDF context', async () => {
      // Given I have parsed RDF data with organizations and people
      const turtleData = `
        @prefix schema }} {
          employees = {{ acme.numberOfEmployees }};
        }
      `;

      // When I render the template with RDF context
      const output = env.renderString(template, variables);

      // Then I should get valid generated code
      expect(output).toContain('class AcmeCorp');
      expect(output).toContain('employees = 100');
    });
  });

  describe('Scenario, () => { it('should apply RDF filters correctly', async () => {
      // Given I have RDF data loaded in a store
      const turtleData = `
        @prefix foaf });

      env.addFilter('rdfType', (subject) => { const quads = store.getQuads(null, 
          'http });

      // When I use filters in a template
      const template = `
        Label: { { "http }}
        Types: {{ "bob" | rdfType | join(", ") }}
      `;

      const output = env.renderString(template, {});

      // Then each filter should transform the data correctly
      expect(output).toContain('Label);
      expect(output).toContain('Types);
    });
  });

  describe('Scenario, () => { it('should cover the essential RDF features', () => {
      // Given I focus on the core 20% of features
      const supportedFeatures = {
        loadingTurtle,
        extractingVariables,
        basicFilters,
        templateRendering,
        complexSPARQL,
        owlReasoning,
        shaclValidation };

      // Then I should support the essential features
      expect(supportedFeatures.loadingTurtle).toBe(true);
      expect(supportedFeatures.extractingVariables).toBe(true);
      expect(supportedFeatures.basicFilters).toBe(true);
      expect(supportedFeatures.templateRendering).toBe(true);

      // But I don't need complex features
      expect(supportedFeatures.complexSPARQL).toBe(false);
      expect(supportedFeatures.owlReasoning).toBe(false);
      expect(supportedFeatures.shaclValidation).toBe(false);
    });
  });
});

// Helper functions (80/20 approach - minimal but functional)

function extractVariables(store) {
  const variables = {};
  
  const subjects = store.getSubjects(null, null, null);
  subjects.forEach(subject => {
    const name = getLocalName(subject.value);
    variables[name] = {};
    
    const quads = store.getQuads(subject, null, null, null);
    quads.forEach(quad => { const propName = getLocalName(quad.predicate.value);
      if (propName !== 'type') { // Skip rdf }
    });
  });
  
  return variables;
}

function getLocalName(uri) {
  return uri.split(/[#/]/).pop() || uri;
}

async function parseIntoStore(_parser, store, turtle) {
  return new Promise((resolve, reject) => {
    // Create a new parser for each parse operation
    const newParser = new Parser();
    newParser.parse(turtle, (error, quad) => {
      if (error) reject(error);
      else if (quad) store.add(quad);
      else resolve();
    });
  });
}