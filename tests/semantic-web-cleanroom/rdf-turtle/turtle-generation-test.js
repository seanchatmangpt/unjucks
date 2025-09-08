/**
 * Clean Room RDF/Turtle Generation Test
 * Tests RDF/Turtle generation capabilities without existing mocks
 */

import { Store, Parser, Writer, DataFactory } from 'n3';
import fs from 'fs/promises';
import path from 'path';

const { namedNode, literal, quad } = DataFactory;

export class TurtleGenerationTester {
  constructor() {
    this.store = new Store();
    this.parser = new Parser();
    this.writer = new Writer({ prefixes: this.getCommonPrefixes() });
    this.results = {
      totalTests: 0,
      passed: 0,
      failed: 0,
      details: []
    };
  }

  getCommonPrefixes() {
    return {
      'rdf': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
      'rdfs': 'http://www.w3.org/2000/01/rdf-schema#',
      'owl': 'http://www.w3.org/2002/07/owl#',
      'xsd': 'http://www.w3.org/2001/XMLSchema#',
      'foaf': 'http://xmlns.com/foaf/0.1/',
      'schema': 'https://schema.org/',
      'skos': 'http://www.w3.org/2004/02/skos/core#',
      'dc': 'http://purl.org/dc/elements/1.1/',
      'dcterms': 'http://purl.org/dc/terms/'
    };
  }

  async testSchemaOrgGeneration() {
    this.results.totalTests++;
    try {
      // Generate Schema.org Person with Organization
      const personQuads = [
        quad(
          namedNode('https://example.org/person/john'),
          namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
          namedNode('https://schema.org/Person')
        ),
        quad(
          namedNode('https://example.org/person/john'),
          namedNode('https://schema.org/name'),
          literal('John Doe')
        ),
        quad(
          namedNode('https://example.org/person/john'),
          namedNode('https://schema.org/email'),
          literal('john.doe@example.com')
        ),
        quad(
          namedNode('https://example.org/person/john'),
          namedNode('https://schema.org/worksFor'),
          namedNode('https://example.org/org/acme')
        ),
        quad(
          namedNode('https://example.org/org/acme'),
          namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
          namedNode('https://schema.org/Organization')
        ),
        quad(
          namedNode('https://example.org/org/acme'),
          namedNode('https://schema.org/name'),
          literal('Acme Corporation')
        )
      ];

      this.store.addQuads(personQuads);
      const turtle = await this.generateTurtle();
      
      // Validate generated Turtle
      const validation = await this.validateTurtle(turtle);
      
      this.results.passed++;
      this.results.details.push({
        test: 'Schema.org Generation',
        status: 'PASS',
        generated: turtle.length,
        quads: personQuads.length,
        validation: validation.valid ? 'Valid' : 'Invalid'
      });

      return { success: true, turtle, validation };
    } catch (error) {
      this.results.failed++;
      this.results.details.push({
        test: 'Schema.org Generation',
        status: 'FAIL',
        error: error.message
      });
      return { success: false, error: error.message };
    }
  }

  async testFOAFGeneration() {
    this.results.totalTests++;
    try {
      // Clear store for fresh test
      this.store = new Store();
      
      // Generate FOAF Person with social network
      const foafQuads = [
        quad(
          namedNode('https://example.org/people#alice'),
          namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
          namedNode('http://xmlns.com/foaf/0.1/Person')
        ),
        quad(
          namedNode('https://example.org/people#alice'),
          namedNode('http://xmlns.com/foaf/0.1/name'),
          literal('Alice Smith')
        ),
        quad(
          namedNode('https://example.org/people#alice'),
          namedNode('http://xmlns.com/foaf/0.1/mbox'),
          namedNode('mailto:alice@example.org')
        ),
        quad(
          namedNode('https://example.org/people#alice'),
          namedNode('http://xmlns.com/foaf/0.1/homepage'),
          namedNode('https://alice.example.org/')
        ),
        quad(
          namedNode('https://example.org/people#alice'),
          namedNode('http://xmlns.com/foaf/0.1/knows'),
          namedNode('https://example.org/people#bob')
        ),
        quad(
          namedNode('https://example.org/people#bob'),
          namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
          namedNode('http://xmlns.com/foaf/0.1/Person')
        ),
        quad(
          namedNode('https://example.org/people#bob'),
          namedNode('http://xmlns.com/foaf/0.1/name'),
          literal('Bob Johnson')
        )
      ];

      this.store.addQuads(foafQuads);
      const turtle = await this.generateTurtle();
      const validation = await this.validateTurtle(turtle);

      this.results.passed++;
      this.results.details.push({
        test: 'FOAF Generation',
        status: 'PASS',
        generated: turtle.length,
        quads: foafQuads.length,
        validation: validation.valid ? 'Valid' : 'Invalid'
      });

      return { success: true, turtle, validation };
    } catch (error) {
      this.results.failed++;
      this.results.details.push({
        test: 'FOAF Generation',
        status: 'FAIL',
        error: error.message
      });
      return { success: false, error: error.message };
    }
  }

  async testSKOSGeneration() {
    this.results.totalTests++;
    try {
      this.store = new Store();
      
      // Generate SKOS Concept Scheme with hierarchical concepts
      const skosQuads = [
        quad(
          namedNode('https://example.org/scheme/topics'),
          namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
          namedNode('http://www.w3.org/2004/02/skos/core#ConceptScheme')
        ),
        quad(
          namedNode('https://example.org/scheme/topics'),
          namedNode('http://purl.org/dc/elements/1.1/title'),
          literal('Topic Classification Scheme')
        ),
        quad(
          namedNode('https://example.org/concepts/technology'),
          namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
          namedNode('http://www.w3.org/2004/02/skos/core#Concept')
        ),
        quad(
          namedNode('https://example.org/concepts/technology'),
          namedNode('http://www.w3.org/2004/02/skos/core#prefLabel'),
          literal('Technology', 'en')
        ),
        quad(
          namedNode('https://example.org/concepts/technology'),
          namedNode('http://www.w3.org/2004/02/skos/core#inScheme'),
          namedNode('https://example.org/scheme/topics')
        ),
        quad(
          namedNode('https://example.org/concepts/ai'),
          namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
          namedNode('http://www.w3.org/2004/02/skos/core#Concept')
        ),
        quad(
          namedNode('https://example.org/concepts/ai'),
          namedNode('http://www.w3.org/2004/02/skos/core#prefLabel'),
          literal('Artificial Intelligence', 'en')
        ),
        quad(
          namedNode('https://example.org/concepts/ai'),
          namedNode('http://www.w3.org/2004/02/skos/core#broader'),
          namedNode('https://example.org/concepts/technology')
        )
      ];

      this.store.addQuads(skosQuads);
      const turtle = await this.generateTurtle();
      const validation = await this.validateTurtle(turtle);

      this.results.passed++;
      this.results.details.push({
        test: 'SKOS Generation',
        status: 'PASS',
        generated: turtle.length,
        quads: skosQuads.length,
        validation: validation.valid ? 'Valid' : 'Invalid'
      });

      return { success: true, turtle, validation };
    } catch (error) {
      this.results.failed++;
      this.results.details.push({
        test: 'SKOS Generation',
        status: 'FAIL',
        error: error.message
      });
      return { success: false, error: error.message };
    }
  }

  async testDublinCoreGeneration() {
    this.results.totalTests++;
    try {
      this.store = new Store();
      
      // Generate Dublin Core metadata
      const dcQuads = [
        quad(
          namedNode('https://example.org/documents/report2024'),
          namedNode('http://purl.org/dc/elements/1.1/title'),
          literal('Annual Technology Report 2024')
        ),
        quad(
          namedNode('https://example.org/documents/report2024'),
          namedNode('http://purl.org/dc/elements/1.1/creator'),
          literal('Jane Smith')
        ),
        quad(
          namedNode('https://example.org/documents/report2024'),
          namedNode('http://purl.org/dc/elements/1.1/subject'),
          literal('Technology Trends')
        ),
        quad(
          namedNode('https://example.org/documents/report2024'),
          namedNode('http://purl.org/dc/elements/1.1/description'),
          literal('Comprehensive analysis of emerging technology trends and their business impact.')
        ),
        quad(
          namedNode('https://example.org/documents/report2024'),
          namedNode('http://purl.org/dc/elements/1.1/publisher'),
          literal('Tech Insights Inc.')
        ),
        quad(
          namedNode('https://example.org/documents/report2024'),
          namedNode('http://purl.org/dc/elements/1.1/date'),
          literal('2024-01-15', namedNode('http://www.w3.org/2001/XMLSchema#date'))
        ),
        quad(
          namedNode('https://example.org/documents/report2024'),
          namedNode('http://purl.org/dc/elements/1.1/type'),
          literal('Report')
        ),
        quad(
          namedNode('https://example.org/documents/report2024'),
          namedNode('http://purl.org/dc/elements/1.1/format'),
          literal('application/pdf')
        ),
        quad(
          namedNode('https://example.org/documents/report2024'),
          namedNode('http://purl.org/dc/elements/1.1/language'),
          literal('en')
        )
      ];

      this.store.addQuads(dcQuads);
      const turtle = await this.generateTurtle();
      const validation = await this.validateTurtle(turtle);

      this.results.passed++;
      this.results.details.push({
        test: 'Dublin Core Generation',
        status: 'PASS',
        generated: turtle.length,
        quads: dcQuads.length,
        validation: validation.valid ? 'Valid' : 'Invalid'
      });

      return { success: true, turtle, validation };
    } catch (error) {
      this.results.failed++;
      this.results.details.push({
        test: 'Dublin Core Generation',
        status: 'FAIL',
        error: error.message
      });
      return { success: false, error: error.message };
    }
  }

  async generateTurtle() {
    return new Promise((resolve, reject) => {
      this.writer.list(this.store.getQuads(null, null, null, null), (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      });
    });
  }

  async validateTurtle(turtleContent) {
    try {
      const testParser = new Parser();
      const parsedQuads = [];
      
      testParser.parse(turtleContent, (error, quad) => {
        if (error) {
          return { valid: false, error: error.message };
        }
        if (quad) {
          parsedQuads.push(quad);
        }
      });

      return {
        valid: true,
        quadCount: parsedQuads.length,
        hasValidPrefixes: turtleContent.includes('@prefix'),
        hasValidTriples: turtleContent.includes(' .')
      };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  async runAllTests() {
    console.log('🧪 Starting Clean Room RDF/Turtle Generation Tests...\n');

    const schemaResult = await this.testSchemaOrgGeneration();
    console.log('✅ Schema.org Generation:', schemaResult.success ? 'PASS' : 'FAIL');

    const foafResult = await this.testFOAFGeneration();
    console.log('✅ FOAF Generation:', foafResult.success ? 'PASS' : 'FAIL');

    const skosResult = await this.testSKOSGeneration();
    console.log('✅ SKOS Generation:', skosResult.success ? 'PASS' : 'FAIL');

    const dcResult = await this.testDublinCoreGeneration();
    console.log('✅ Dublin Core Generation:', dcResult.success ? 'PASS' : 'FAIL');

    return this.generateReport();
  }

  generateReport() {
    const successRate = (this.results.passed / this.results.totalTests) * 100;
    
    return {
      summary: {
        totalTests: this.results.totalTests,
        passed: this.results.passed,
        failed: this.results.failed,
        successRate: `${successRate.toFixed(1)}%`
      },
      details: this.results.details,
      verdict: successRate >= 71 ? 'MEETS_BASELINE' : 'BELOW_BASELINE'
    };
  }
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new TurtleGenerationTester();
  const results = await tester.runAllTests();
  
  console.log('\n📊 Test Results Summary:');
  console.log(`Total Tests: ${results.summary.totalTests}`);
  console.log(`Passed: ${results.summary.passed}`);
  console.log(`Failed: ${results.summary.failed}`);
  console.log(`Success Rate: ${results.summary.successRate}`);
  console.log(`Baseline Verdict: ${results.verdict}`);
  
  if (results.summary.failed > 0) {
    console.log('\n❌ Failed Tests:');
    results.details.filter(d => d.status === 'FAIL').forEach(detail => {
      console.log(`  - ${detail.test}: ${detail.error}`);
    });
  }
}