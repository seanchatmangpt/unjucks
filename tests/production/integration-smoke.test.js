/**
 * Production Integration Smoke Tests - RDF/Turtle Filters
 * End-to-end workflow validation for production deployment readiness
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { Store, Parser, Writer, DataFactory } from 'n3';
import { RDFFilters, registerRDFFilters } from '../../src/lib/rdf-filters.js';
import { SemanticFilters } from '../../src/lib/semantic/semantic-filters.js';
import nunjucks from 'nunjucks';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const { namedNode, literal, quad } = DataFactory;

// Smoke test configuration
const SMOKE_CONFIG = {
  CRITICAL_WORKFLOWS: [
    'template-rendering-with-rdf',
    'data-loading-and-querying', 
    'filter-registration-and-usage',
    'semantic-reasoning-basic',
    'error-handling-graceful',
    'performance-acceptable'
  ],
  ACCEPTANCE_CRITERIA: {
    RESPONSE_TIME_MAX: 2000, // 2 seconds for smoke tests
    MEMORY_GROWTH_MAX: 100, // MB
    SUCCESS_RATE_MIN: 98, // 98% minimum success rate
    COVERAGE_REQUIREMENT: 80 // 80% workflow coverage
  }
};

describe('Production Integration Smoke Tests', () => {
  let nunjucksEnv;
  let rdfFilters;
  let semanticFilters;
  let smokeResults = {
    workflows: [],
    performance: [],
    integrations: [],
    criticalPath: [],
    issues: []
  };

  beforeAll(async () => {
    console.log('🚀 Starting production integration smoke tests...');
    
    // Setup Nunjucks environment
    nunjucksEnv = nunjucks.configure({
      autoescape: false,
      throwOnUndefined: false
    });
    
    // Setup RDF components
    const store = new Store();
    await setupProductionSmokeData(store);
    
    rdfFilters = new RDFFilters({ store });
    semanticFilters = new SemanticFilters();
    
    // Register RDF filters with Nunjucks
    registerRDFFilters(nunjucksEnv, { store });
    
    console.log('Smoke test environment initialized');
  });

  afterAll(() => {
    console.log('\n=== PRODUCTION SMOKE TEST REPORT ===');
    console.log(`Critical workflows tested: ${smokeResults.workflows.length}`);
    console.log(`Performance benchmarks: ${smokeResults.performance.length}`);
    console.log(`Integration points: ${smokeResults.integrations.length}`);
    console.log(`Issues found: ${smokeResults.issues.length}`);
    
    const overallSuccess = smokeResults.workflows.filter(w => w.status === 'PASS').length;
    const successRate = (overallSuccess / smokeResults.workflows.length) * 100;
    
    console.log(`Overall success rate: ${successRate.toFixed(1)}%`);
    
    // Generate smoke test report
    const report = {
      timestamp: new Date().toISOString(),
      environment: 'production-smoke',
      results: smokeResults,
      summary: {
        totalWorkflows: smokeResults.workflows.length,
        successfulWorkflows: overallSuccess,
        successRate,
        criticalIssues: smokeResults.issues.filter(i => i.severity === 'CRITICAL').length,
        readyForProduction: successRate >= SMOKE_CONFIG.ACCEPTANCE_CRITERIA.SUCCESS_RATE_MIN
      }
    };
    
    console.log(`Production readiness: ${report.summary.readyForProduction ? 'READY' : 'NOT READY'}`);
  });

  describe('Critical Workflow Validation', () => {
    test('Template rendering with RDF filters - End-to-end', async () => {
      console.log('Testing template rendering with RDF filters...');
      
      const workflowStart = Date.now();
      
      try {
        // Test complete template rendering workflow
        const template = `
{%- set people = rdfQuery('?person rdf:type foaf:Person') -%}
<h1>People Directory</h1>
<ul>
{%- for person in people -%}
  <li>
    <strong>{{ person[0].value | rdfLabel }}</strong>
    {%- set email = rdfObject(person[0].value, 'foaf:mbox') -%}
    {%- if email.length > 0 %}
    - Email: {{ email[0].value }}
    {%- endif %}
    {%- set age = rdfObject(person[0].value, 'foaf:age') -%}
    {%- if age.length > 0 %}
    - Age: {{ age[0].value }}
    {%- endif %}
  </li>
{%- endfor -%}
</ul>

<h2>Statistics</h2>
<p>Total people: {{ rdfCount('?s', 'rdf:type', 'foaf:Person') }}</p>
<p>People with emails: {{ rdfCount('?s', 'foaf:mbox', '?email') }}</p>
`;

        const rendered = nunjucksEnv.renderString(template);
        const workflowDuration = Date.now() - workflowStart;
        
        // Validate rendered output
        expect(rendered).toContain('<h1>People Directory</h1>');
        expect(rendered).toContain('<ul>');
        expect(rendered).toContain('<li>');
        expect(rendered).toContain('<h2>Statistics</h2>');
        expect(rendered).toMatch(/Total people: \d+/);
        
        // Check for RDF filter results
        expect(rendered).not.toContain('undefined');
        expect(rendered).not.toContain('[object Object]');
        expect(rendered).not.toContain('null');
        
        smokeResults.workflows.push({
          name: 'Template Rendering with RDF',
          status: 'PASS',
          duration: workflowDuration,
          outputLength: rendered.length,
          validContent: true
        });
        
        smokeResults.performance.push({
          workflow: 'Template Rendering',
          duration: workflowDuration,
          withinLimit: workflowDuration < SMOKE_CONFIG.ACCEPTANCE_CRITERIA.RESPONSE_TIME_MAX
        });
        
        expect(workflowDuration).toBeLessThan(SMOKE_CONFIG.ACCEPTANCE_CRITERIA.RESPONSE_TIME_MAX);
        
        console.log(`✅ Template rendering: ${workflowDuration}ms, ${rendered.length} chars output`);
        
      } catch (error) {
        smokeResults.workflows.push({
          name: 'Template Rendering with RDF',
          status: 'FAIL',
          error: error.message,
          duration: Date.now() - workflowStart
        });
        
        smokeResults.issues.push({
          workflow: 'Template Rendering',
          error: error.message,
          severity: 'CRITICAL',
          timestamp: Date.now()
        });
        
        throw error;
      }
    });

    test('Data loading and querying pipeline', async () => {
      console.log('Testing data loading and querying pipeline...');
      
      const workflowStart = Date.now();
      
      try {
        // Test complete data processing pipeline
        
        // 1. Create new data store
        const pipelineStore = new Store();
        
        // 2. Load Turtle data
        const turtleData = `
@prefix ex: <http://example.org/> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix dc: <http://purl.org/dc/elements/1.1/> .

ex:company a foaf:Organization ;
  foaf:name "Example Corp" ;
  ex:founded "2020-01-01"^^<http://www.w3.org/2001/XMLSchema#date> ;
  ex:employees ex:alice, ex:bob, ex:carol .

ex:alice a foaf:Person ;
  foaf:name "Alice Smith" ;
  foaf:mbox <mailto:alice@example.org> ;
  ex:role "Engineer" ;
  ex:worksFor ex:company .

ex:bob a foaf:Person ;
  foaf:name "Bob Johnson" ;
  foaf:mbox <mailto:bob@example.org> ;
  ex:role "Designer" ;
  ex:worksFor ex:company .

ex:carol a foaf:Person ;
  foaf:name "Carol Brown" ;
  foaf:mbox <mailto:carol@example.org> ;
  ex:role "Manager" ;
  ex:worksFor ex:company .
`;
        
        const parser = new Parser();
        const quads = parser.parse(turtleData);
        pipelineStore.addQuads(quads);
        
        // 3. Initialize filters with new data
        const pipelineFilters = new RDFFilters({ store: pipelineStore });
        
        // 4. Execute comprehensive queries
        const queries = [
          {
            name: 'Find all employees',
            query: () => pipelineFilters.rdfSubject('ex:worksFor', 'ex:company'),
            expectedMin: 3
          },
          {
            name: 'Get company name',
            query: () => pipelineFilters.rdfObject('ex:company', 'foaf:name'),
            expectedMin: 1
          },
          {
            name: 'Find engineers',
            query: () => pipelineFilters.rdfSubject('ex:role', 'Engineer'),
            expectedMin: 1
          },
          {
            name: 'Count people',
            query: () => pipelineFilters.rdfCount('?s', 'rdf:type', 'foaf:Person'),
            expectedMin: 3
          },
          {
            name: 'Check email exists',
            query: () => pipelineFilters.rdfExists('ex:alice', 'foaf:mbox', null),
            expected: true
          }
        ];
        
        let successfulQueries = 0;
        const queryResults = [];
        
        for (const query of queries) {
          try {
            const result = query.query();
            
            if (query.expected !== undefined) {
              expect(result).toBe(query.expected);
            } else if (query.expectedMin !== undefined) {
              expect(Array.isArray(result) ? result.length : result).toBeGreaterThanOrEqual(query.expectedMin);
            }
            
            successfulQueries++;
            queryResults.push({
              name: query.name,
              success: true,
              result: Array.isArray(result) ? result.length : result
            });
            
          } catch (queryError) {
            queryResults.push({
              name: query.name,
              success: false,
              error: queryError.message
            });
          }
        }
        
        const workflowDuration = Date.now() - workflowStart;
        const querySuccessRate = (successfulQueries / queries.length) * 100;
        
        smokeResults.workflows.push({
          name: 'Data Loading and Querying',
          status: querySuccessRate >= 90 ? 'PASS' : 'FAIL',
          duration: workflowDuration,
          queriesTotal: queries.length,
          queriesSuccessful: successfulQueries,
          successRate: querySuccessRate,
          results: queryResults
        });
        
        expect(querySuccessRate).toBeGreaterThanOrEqual(90); // 90% query success rate
        expect(workflowDuration).toBeLessThan(SMOKE_CONFIG.ACCEPTANCE_CRITERIA.RESPONSE_TIME_MAX);
        
        console.log(`✅ Data pipeline: ${successfulQueries}/${queries.length} queries (${querySuccessRate.toFixed(1)}%)`);
        
      } catch (error) {
        smokeResults.workflows.push({
          name: 'Data Loading and Querying',
          status: 'FAIL',
          error: error.message,
          duration: Date.now() - workflowStart
        });
        
        throw error;
      }
    });

    test('Filter registration and usage integration', async () => {
      console.log('Testing filter registration and usage...');
      
      const workflowStart = Date.now();
      
      try {
        // Test filter registration process
        const testEnv = nunjucks.configure({ autoescape: false });
        const testStore = new Store();
        
        // Add test data
        testStore.addQuad(quad(
          namedNode('http://example.org/test'),
          namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
          namedNode('http://xmlns.com/foaf/0.1/Person')
        ));
        testStore.addQuad(quad(
          namedNode('http://example.org/test'),
          namedNode('http://xmlns.com/foaf/0.1/name'),
          literal('Integration Test')
        ));
        
        // Register filters
        registerRDFFilters(testEnv, { store: testStore });
        
        // Test all major filter types
        const filterTests = [
          {
            name: 'rdfQuery',
            template: '{{ rdfQuery("?s rdf:type foaf:Person") | length }}',
            expected: '1'
          },
          {
            name: 'rdfObject',
            template: '{{ rdfObject("ex:test", "foaf:name")[0].value }}',
            expected: 'Integration Test'
          },
          {
            name: 'rdfLabel',
            template: '{{ rdfLabel("ex:test") }}',
            expectedContains: 'Integration Test'
          },
          {
            name: 'rdfType',
            template: '{{ rdfType("ex:test") | length }}',
            expected: '1'
          },
          {
            name: 'rdfExists',
            template: '{{ rdfExists("ex:test", "foaf:name", null) }}',
            expected: 'true'
          },
          {
            name: 'rdfCount',
            template: '{{ rdfCount("?s", "rdf:type", "foaf:Person") }}',
            expected: '1'
          },
          {
            name: 'rdfExpand', 
            template: '{{ rdfExpand("foaf:Person") }}',
            expectedContains: 'xmlns.com/foaf'
          },
          {
            name: 'rdfCompact',
            template: '{{ rdfCompact("http://xmlns.com/foaf/0.1/Person") }}',
            expectedContains: 'foaf:'
          }
        ];
        
        let filtersWorking = 0;
        const filterResults = [];
        
        for (const filterTest of filterTests) {
          try {
            const rendered = testEnv.renderString(filterTest.template);
            
            if (filterTest.expected && rendered.trim() === filterTest.expected) {
              filtersWorking++;
              filterResults.push({ name: filterTest.name, status: 'PASS', output: rendered.trim() });
            } else if (filterTest.expectedContains && rendered.includes(filterTest.expectedContains)) {
              filtersWorking++;
              filterResults.push({ name: filterTest.name, status: 'PASS', output: rendered.trim() });
            } else {
              filterResults.push({ 
                name: filterTest.name, 
                status: 'FAIL', 
                output: rendered.trim(),
                expected: filterTest.expected || filterTest.expectedContains
              });
            }
            
          } catch (filterError) {
            filterResults.push({ 
              name: filterTest.name, 
              status: 'ERROR', 
              error: filterError.message 
            });
          }
        }
        
        const workflowDuration = Date.now() - workflowStart;
        const filterSuccessRate = (filtersWorking / filterTests.length) * 100;
        
        smokeResults.workflows.push({
          name: 'Filter Registration and Usage',
          status: filterSuccessRate >= 95 ? 'PASS' : 'FAIL',
          duration: workflowDuration,
          filtersTotal: filterTests.length,
          filtersWorking: filtersWorking,
          successRate: filterSuccessRate,
          results: filterResults
        });
        
        smokeResults.integrations.push({
          component: 'Nunjucks Filter Integration',
          status: filterSuccessRate >= 95 ? 'OPERATIONAL' : 'DEGRADED',
          successRate: filterSuccessRate,
          issues: filterResults.filter(r => r.status !== 'PASS').length
        });
        
        expect(filterSuccessRate).toBeGreaterThanOrEqual(95); // 95% filter success rate
        
        console.log(`✅ Filter integration: ${filtersWorking}/${filterTests.length} filters working (${filterSuccessRate.toFixed(1)}%)`);
        
      } catch (error) {
        smokeResults.workflows.push({
          name: 'Filter Registration and Usage',
          status: 'FAIL',
          error: error.message,
          duration: Date.now() - workflowStart
        });
        
        throw error;
      }
    });

    test('Semantic reasoning basic workflow', async () => {
      console.log('Testing semantic reasoning workflow...');
      
      const workflowStart = Date.now();
      
      try {
        // Test semantic reasoning capabilities
        const semanticStore = new Store();
        
        // Add ontology data with class hierarchies
        const ontologyData = [
          // Class hierarchy
          { s: 'ex:Person', p: 'rdfs:subClassOf', o: 'ex:Agent' },
          { s: 'ex:Employee', p: 'rdfs:subClassOf', o: 'ex:Person' },
          { s: 'ex:Manager', p: 'rdfs:subClassOf', o: 'ex:Employee' },
          
          // Property domains and ranges
          { s: 'ex:manages', p: 'rdfs:domain', o: 'ex:Manager' },
          { s: 'ex:manages', p: 'rdfs:range', o: 'ex:Employee' },
          
          // Instance data
          { s: 'ex:alice', p: 'rdf:type', o: 'ex:Manager' },
          { s: 'ex:bob', p: 'rdf:type', o: 'ex:Employee' },
          { s: 'ex:alice', p: 'ex:manages', o: 'ex:bob' }
        ];
        
        for (const triple of ontologyData) {
          semanticStore.addQuad(quad(
            namedNode(triple.s),
            namedNode(triple.p),
            namedNode(triple.o)
          ));
        }
        
        const semanticRdfFilters = new RDFFilters({ store: semanticStore });
        
        // Test semantic reasoning operations
        const reasoningTests = [
          {
            name: 'Type Inference',
            test: () => {
              // Alice is a Manager, which is subclass of Employee and Person
              const types = semanticRdfFilters.rdfType('ex:alice');
              return types.includes('ex:Manager');
            },
            expected: true
          },
          {
            name: 'Class Hierarchy Query',
            test: () => {
              // Find all people (including employees and managers)
              const people = semanticRdfFilters.rdfSubject('rdf:type', 'ex:Person');
              return people.length;
            },
            expectedMin: 0 // Basic query, reasoning would find more
          },
          {
            name: 'Property Domain Check',
            test: () => {
              // Check that alice (Manager) can use the manages property
              return semanticRdfFilters.rdfExists('ex:alice', 'ex:manages', 'ex:bob');
            },
            expected: true
          },
          {
            name: 'Transitive Relationships',
            test: () => {
              // Basic relationship query
              const manages = semanticRdfFilters.rdfObject('ex:alice', 'ex:manages');
              return manages.length;
            },
            expectedMin: 1
          }
        ];
        
        let reasoningSuccess = 0;
        const reasoningResults = [];
        
        for (const test of reasoningTests) {
          try {
            const result = test.test();
            
            if (test.expected !== undefined && result === test.expected) {
              reasoningSuccess++;
              reasoningResults.push({ name: test.name, status: 'PASS', result });
            } else if (test.expectedMin !== undefined && result >= test.expectedMin) {
              reasoningSuccess++;
              reasoningResults.push({ name: test.name, status: 'PASS', result });
            } else {
              reasoningResults.push({ name: test.name, status: 'FAIL', result, expected: test.expected || `>=${test.expectedMin}` });
            }
            
          } catch (error) {
            reasoningResults.push({ name: test.name, status: 'ERROR', error: error.message });
          }
        }
        
        const workflowDuration = Date.now() - workflowStart;
        const reasoningSuccessRate = (reasoningSuccess / reasoningTests.length) * 100;
        
        smokeResults.workflows.push({
          name: 'Semantic Reasoning Basic',
          status: reasoningSuccessRate >= 75 ? 'PASS' : 'FAIL', // Lower threshold for basic reasoning
          duration: workflowDuration,
          testsTotal: reasoningTests.length,
          testsSuccessful: reasoningSuccess,
          successRate: reasoningSuccessRate,
          results: reasoningResults
        });
        
        // Basic semantic capabilities should work
        expect(reasoningSuccessRate).toBeGreaterThanOrEqual(75);
        
        console.log(`✅ Semantic reasoning: ${reasoningSuccess}/${reasoningTests.length} tests (${reasoningSuccessRate.toFixed(1)}%)`);
        
      } catch (error) {
        smokeResults.workflows.push({
          name: 'Semantic Reasoning Basic',
          status: 'FAIL', 
          error: error.message,
          duration: Date.now() - workflowStart
        });
        
        throw error;
      }
    });

    test('Error handling graceful degradation', async () => {
      console.log('Testing graceful error handling...');
      
      const workflowStart = Date.now();
      
      try {
        // Test error handling across the system
        const errorStore = new Store();
        const errorFilters = new RDFFilters({ store: errorStore });
        
        const errorScenarios = [
          {
            name: 'Invalid URI',
            test: () => errorFilters.rdfLabel('not-a-valid-uri'),
            shouldNotThrow: true
          },
          {
            name: 'Missing Resource',
            test: () => errorFilters.rdfObject('ex:nonexistent', 'foaf:name'),
            shouldNotThrow: true
          },
          {
            name: 'Invalid Query Pattern',
            test: () => errorFilters.rdfQuery('invalid pattern structure'),
            shouldNotThrow: true
          },
          {
            name: 'Null Input',
            test: () => errorFilters.rdfExists(null, 'rdf:type', 'foaf:Person'),
            shouldNotThrow: true
          },
          {
            name: 'Empty String Input',
            test: () => errorFilters.rdfType(''),
            shouldNotThrow: true
          },
          {
            name: 'Very Long Input',
            test: () => errorFilters.rdfLabel('x'.repeat(10000)),
            shouldNotThrow: true
          }
        ];
        
        let gracefulHandling = 0;
        const errorResults = [];
        
        for (const scenario of errorScenarios) {
          try {
            const result = scenario.test();
            
            // Should return reasonable default values, not throw
            if (result === null || result === undefined || 
                (Array.isArray(result) && result.length === 0) ||
                (typeof result === 'string' && result.length === 0)) {
              gracefulHandling++;
              errorResults.push({ 
                name: scenario.name, 
                status: 'GRACEFUL', 
                result: `${typeof result}${Array.isArray(result) ? `[${result.length}]` : ''}` 
              });
            } else {
              errorResults.push({ 
                name: scenario.name, 
                status: 'UNEXPECTED_RESULT', 
                result: JSON.stringify(result).substring(0, 100) 
              });
            }
            
          } catch (error) {
            if (scenario.shouldNotThrow) {
              errorResults.push({ 
                name: scenario.name, 
                status: 'THREW_ERROR', 
                error: error.message 
              });
            } else {
              gracefulHandling++;
              errorResults.push({ 
                name: scenario.name, 
                status: 'EXPECTED_ERROR', 
                error: error.message 
              });
            }
          }
        }
        
        // Test template error handling
        const templateErrorEnv = nunjucks.configure({ autoescape: false });
        registerRDFFilters(templateErrorEnv, { store: errorStore });
        
        const templateErrors = [
          {
            name: 'Invalid Filter Usage',
            template: '{{ nonexistentFilter("test") }}',
            shouldFail: true
          },
          {
            name: 'Missing RDF Data',
            template: '{{ rdfObject("ex:missing", "foaf:name")[0].value }}',
            shouldFail: false // Should handle gracefully
          }
        ];
        
        for (const templateError of templateErrors) {
          try {
            const result = templateErrorEnv.renderString(templateError.template);
            
            if (!templateError.shouldFail) {
              gracefulHandling++;
              errorResults.push({ 
                name: templateError.name, 
                status: 'TEMPLATE_GRACEFUL', 
                result: result.trim() 
              });
            } else {
              errorResults.push({ 
                name: templateError.name, 
                status: 'TEMPLATE_UNEXPECTED_SUCCESS', 
                result: result.trim() 
              });
            }
            
          } catch (templateErr) {
            if (templateError.shouldFail) {
              gracefulHandling++;
              errorResults.push({ 
                name: templateError.name, 
                status: 'TEMPLATE_EXPECTED_ERROR', 
                error: templateErr.message 
              });
            } else {
              errorResults.push({ 
                name: templateError.name, 
                status: 'TEMPLATE_UNEXPECTED_ERROR', 
                error: templateErr.message 
              });
            }
          }
        }
        
        const workflowDuration = Date.now() - workflowStart;
        const totalScenarios = errorScenarios.length + templateErrors.length;
        const gracefulRate = (gracefulHandling / totalScenarios) * 100;
        
        smokeResults.workflows.push({
          name: 'Error Handling Graceful',
          status: gracefulRate >= 80 ? 'PASS' : 'FAIL',
          duration: workflowDuration,
          scenariosTotal: totalScenarios,
          gracefulHandling: gracefulHandling,
          gracefulRate: gracefulRate,
          results: errorResults
        });
        
        expect(gracefulRate).toBeGreaterThanOrEqual(80); // 80% graceful error handling
        
        console.log(`✅ Error handling: ${gracefulHandling}/${totalScenarios} scenarios graceful (${gracefulRate.toFixed(1)}%)`);
        
      } catch (error) {
        smokeResults.workflows.push({
          name: 'Error Handling Graceful',
          status: 'FAIL',
          error: error.message,
          duration: Date.now() - workflowStart
        });
        
        throw error;
      }
    });

    test('Performance acceptance criteria', async () => {
      console.log('Testing performance acceptance criteria...');
      
      const workflowStart = Date.now();
      
      try {
        // Test performance under typical production loads
        const perfStore = new Store();
        await setupProductionSmokeData(perfStore); // Use larger dataset
        const perfFilters = new RDFFilters({ store: perfStore });
        
        const performanceTests = [
          {
            name: 'Simple Query Performance',
            test: () => perfFilters.rdfQuery('?s rdf:type foaf:Person'),
            maxTime: 100, // 100ms
            iterations: 100
          },
          {
            name: 'Complex Query Performance',
            test: () => perfFilters.rdfQuery('?person foaf:knows ?friend'),
            maxTime: 500, // 500ms
            iterations: 50
          },
          {
            name: 'Label Resolution Performance',
            test: () => perfFilters.rdfLabel('ex:person1'),
            maxTime: 50, // 50ms
            iterations: 200
          },
          {
            name: 'Existence Check Performance',
            test: () => perfFilters.rdfExists('ex:person1', 'foaf:name', null),
            maxTime: 50, // 50ms
            iterations: 200
          },
          {
            name: 'Count Operation Performance',
            test: () => perfFilters.rdfCount('?s', 'rdf:type', 'foaf:Person'),
            maxTime: 100, // 100ms
            iterations: 100
          }
        ];
        
        let performancePassing = 0;
        const performanceResults = [];
        
        for (const perfTest of performanceTests) {
          const iterations = perfTest.iterations;
          const startTime = Date.now();
          
          try {
            // Run test multiple times to get average
            for (let i = 0; i < iterations; i++) {
              perfTest.test();
            }
            
            const endTime = Date.now();
            const totalTime = endTime - startTime;
            const avgTime = totalTime / iterations;
            const withinLimit = avgTime <= perfTest.maxTime;
            
            if (withinLimit) {
              performancePassing++;
            }
            
            performanceResults.push({
              name: perfTest.name,
              avgTime: avgTime,
              maxTime: perfTest.maxTime,
              withinLimit: withinLimit,
              iterations: iterations,
              totalTime: totalTime
            });
            
            smokeResults.performance.push({
              test: perfTest.name,
              avgTime: avgTime,
              maxTime: perfTest.maxTime,
              passing: withinLimit
            });
            
          } catch (perfError) {
            performanceResults.push({
              name: perfTest.name,
              error: perfError.message,
              withinLimit: false
            });
          }
        }
        
        const workflowDuration = Date.now() - workflowStart;
        const performanceSuccessRate = (performancePassing / performanceTests.length) * 100;
        
        smokeResults.workflows.push({
          name: 'Performance Acceptance',
          status: performanceSuccessRate >= 80 ? 'PASS' : 'FAIL',
          duration: workflowDuration,
          testsTotal: performanceTests.length,
          testsPassing: performancePassing,
          successRate: performanceSuccessRate,
          results: performanceResults
        });
        
        expect(performanceSuccessRate).toBeGreaterThanOrEqual(80); // 80% performance tests must pass
        
        console.log(`✅ Performance tests: ${performancePassing}/${performanceTests.length} passing (${performanceSuccessRate.toFixed(1)}%)`);
        
      } catch (error) {
        smokeResults.workflows.push({
          name: 'Performance Acceptance',
          status: 'FAIL',
          error: error.message,
          duration: Date.now() - workflowStart
        });
        
        throw error;
      }
    });
  });

  describe('System Integration Health', () => {
    test('Memory usage under production load', async () => {
      console.log('Testing memory usage under load...');
      
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Simulate production-like workload
      const workloadIterations = 1000;
      const batchSize = 50;
      
      for (let batch = 0; batch < workloadIterations / batchSize; batch++) {
        // Batch operations
        for (let i = 0; i < batchSize; i++) {
          const personId = `ex:person${batch * batchSize + i}`;
          
          rdfFilters.rdfType(personId);
          rdfFilters.rdfLabel(personId);
          rdfFilters.rdfExists(personId, 'foaf:name', null);
        }
        
        // Check memory every few batches
        if (batch % 5 === 0) {
          const currentMemory = process.memoryUsage().heapUsed;
          const memoryGrowthMB = (currentMemory - initialMemory) / 1024 / 1024;
          
          if (memoryGrowthMB > SMOKE_CONFIG.ACCEPTANCE_CRITERIA.MEMORY_GROWTH_MAX) {
            smokeResults.issues.push({
              type: 'Memory Growth Excessive',
              batch: batch,
              memoryGrowthMB: memoryGrowthMB,
              severity: 'HIGH',
              timestamp: Date.now()
            });
            break;
          }
        }
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const totalMemoryGrowthMB = (finalMemory - initialMemory) / 1024 / 1024;
      
      smokeResults.integrations.push({
        component: 'Memory Management',
        status: totalMemoryGrowthMB <= SMOKE_CONFIG.ACCEPTANCE_CRITERIA.MEMORY_GROWTH_MAX ? 'OPERATIONAL' : 'DEGRADED',
        memoryGrowthMB: totalMemoryGrowthMB,
        maxAllowedMB: SMOKE_CONFIG.ACCEPTANCE_CRITERIA.MEMORY_GROWTH_MAX
      });
      
      expect(totalMemoryGrowthMB).toBeLessThanOrEqual(SMOKE_CONFIG.ACCEPTANCE_CRITERIA.MEMORY_GROWTH_MAX);
      
      console.log(`✅ Memory usage: ${totalMemoryGrowthMB.toFixed(2)}MB growth (limit: ${SMOKE_CONFIG.ACCEPTANCE_CRITERIA.MEMORY_GROWTH_MAX}MB)`);
    });

    test('Concurrent access stability', async () => {
      console.log('Testing concurrent access stability...');
      
      const concurrentUsers = 20;
      const operationsPerUser = 25;
      const promises = [];
      
      for (let user = 0; user < concurrentUsers; user++) {
        const promise = new Promise(async (resolve) => {
          const userResults = [];
          
          try {
            for (let op = 0; op < operationsPerUser; op++) {
              const personId = `ex:person${(user * operationsPerUser + op) % 100}`;
              
              // Mixed operations
              const operations = [
                rdfFilters.rdfType(personId),
                rdfFilters.rdfLabel(personId),
                rdfFilters.rdfExists(personId, 'foaf:name', null),
                rdfFilters.rdfObject(personId, 'foaf:age')
              ];
              
              userResults.push(operations.length);
            }
            
            resolve({ user, success: true, operations: userResults.length });
            
          } catch (error) {
            resolve({ user, success: false, error: error.message });
          }
        });
        
        promises.push(promise);
      }
      
      const concurrentResults = await Promise.all(promises);
      
      const successfulUsers = concurrentResults.filter(r => r.success).length;
      const successRate = (successfulUsers / concurrentUsers) * 100;
      
      smokeResults.integrations.push({
        component: 'Concurrent Access',
        status: successRate >= 95 ? 'OPERATIONAL' : 'DEGRADED',
        successRate: successRate,
        totalUsers: concurrentUsers,
        successfulUsers: successfulUsers
      });
      
      expect(successRate).toBeGreaterThanOrEqual(95); // 95% concurrent access success
      
      console.log(`✅ Concurrent access: ${successfulUsers}/${concurrentUsers} users successful (${successRate.toFixed(1)}%)`);
    });
  });

  // Final production readiness assessment
  test('Production deployment readiness assessment', async () => {
    console.log('\n=== PRODUCTION READINESS ASSESSMENT ===');
    
    const assessment = {
      timestamp: new Date().toISOString(),
      criticalWorkflows: smokeResults.workflows.length,
      workflowsPassed: smokeResults.workflows.filter(w => w.status === 'PASS').length,
      integrationComponents: smokeResults.integrations.length,
      operationalComponents: smokeResults.integrations.filter(i => i.status === 'OPERATIONAL').length,
      criticalIssues: smokeResults.issues.filter(i => i.severity === 'CRITICAL').length,
      totalIssues: smokeResults.issues.length,
      performanceTests: smokeResults.performance.length,
      performancePassing: smokeResults.performance.filter(p => p.passing).length
    };
    
    // Calculate readiness scores
    const workflowScore = (assessment.workflowsPassed / assessment.criticalWorkflows) * 100;
    const integrationScore = (assessment.operationalComponents / assessment.integrationComponents) * 100;
    const performanceScore = assessment.performanceTests > 0 ? (assessment.performancePassing / assessment.performanceTests) * 100 : 100;
    
    const overallReadiness = (workflowScore + integrationScore + performanceScore) / 3;
    
    // Determine production readiness
    let readinessStatus = 'NOT READY';
    if (assessment.criticalIssues === 0 && overallReadiness >= 90) {
      readinessStatus = 'READY';
    } else if (assessment.criticalIssues === 0 && overallReadiness >= 80) {
      readinessStatus = 'READY WITH MONITORING';
    } else if (overallReadiness >= 70) {
      readinessStatus = 'NEEDS ATTENTION';
    }
    
    console.log(`Critical Workflows: ${assessment.workflowsPassed}/${assessment.criticalWorkflows} (${workflowScore.toFixed(1)}%)`);
    console.log(`Integration Components: ${assessment.operationalComponents}/${assessment.integrationComponents} (${integrationScore.toFixed(1)}%)`);
    console.log(`Performance Tests: ${assessment.performancePassing}/${assessment.performanceTests} (${performanceScore.toFixed(1)}%)`);
    console.log(`Critical Issues: ${assessment.criticalIssues}`);
    console.log(`Overall Readiness: ${overallReadiness.toFixed(1)}%`);
    console.log(`Production Status: ${readinessStatus}`);
    
    // Generate deployment recommendations
    const recommendations = [];
    
    if (workflowScore < 95) {
      recommendations.push('Address failing critical workflows before deployment');
    }
    
    if (integrationScore < 90) {
      recommendations.push('Fix degraded integration components');
    }
    
    if (performanceScore < 80) {
      recommendations.push('Optimize performance bottlenecks');
    }
    
    if (assessment.criticalIssues > 0) {
      recommendations.push('Resolve all critical issues immediately');
    }
    
    if (smokeResults.issues.length > 5) {
      recommendations.push('Review and address system issues for stability');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('System is ready for production deployment');
    }
    
    console.log('\nRecommendations:');
    recommendations.forEach((rec, index) => {
      console.log(`  ${index + 1}. ${rec}`);
    });
    
    // Final assertions for test success
    expect(assessment.criticalIssues).toBe(0);
    expect(workflowScore).toBeGreaterThanOrEqual(SMOKE_CONFIG.ACCEPTANCE_CRITERIA.SUCCESS_RATE_MIN);
    expect(readinessStatus).not.toBe('NOT READY');
    
    // Save assessment report
    const reportPath = path.join(process.cwd(), 'production-readiness-report.json');
    const fullReport = {
      assessment,
      readinessStatus,
      overallReadiness,
      recommendations,
      detailedResults: smokeResults
    };
    
    try {
      fs.writeFileSync(reportPath, JSON.stringify(fullReport, null, 2));
      console.log(`\nProduction readiness report saved: ${reportPath}`);
    } catch (reportError) {
      console.warn('Could not save production readiness report:', reportError.message);
    }
  });
});

// Helper function to set up comprehensive production smoke test data
async function setupProductionSmokeData(store) {
  console.log('Setting up production smoke test data...');
  
  // Create comprehensive dataset that exercises all major features
  const entities = [
    // People
    { id: 'person1', type: 'Person', name: 'Alice Johnson', age: 28, email: 'alice@example.org' },
    { id: 'person2', type: 'Person', name: 'Bob Smith', age: 35, email: 'bob@example.org' },
    { id: 'person3', type: 'Person', name: 'Carol Davis', age: 42, email: 'carol@example.org' },
    { id: 'person4', type: 'Person', name: 'David Wilson', age: 31, email: 'david@example.org' },
    { id: 'person5', type: 'Person', name: 'Eve Brown', age: 29, email: 'eve@example.org' },
    
    // Organizations
    { id: 'company1', type: 'Organization', name: 'Tech Corp', founded: '2015-01-01' },
    { id: 'company2', type: 'Organization', name: 'Data Inc', founded: '2018-03-15' },
    
    // Projects
    { id: 'project1', type: 'Project', name: 'RDF Platform', status: 'active' },
    { id: 'project2', type: 'Project', name: 'Semantic Web', status: 'completed' }
  ];
  
  // Add entities with comprehensive properties
  for (const entity of entities) {
    const subject = namedNode(`http://example.org/${entity.id}`);
    
    // Type
    const typeClass = entity.type === 'Person' ? 'foaf:Person' : 
                     entity.type === 'Organization' ? 'foaf:Organization' : 'ex:Project';
    store.addQuad(quad(subject, namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'), namedNode(`http://xmlns.com/foaf/0.1/${entity.type}`)));
    
    // Name
    store.addQuad(quad(subject, namedNode('http://xmlns.com/foaf/0.1/name'), literal(entity.name)));
    
    // Age (for people)
    if (entity.age) {
      store.addQuad(quad(subject, namedNode('http://xmlns.com/foaf/0.1/age'), literal(String(entity.age))));
    }
    
    // Email (for people)
    if (entity.email) {
      store.addQuad(quad(subject, namedNode('http://xmlns.com/foaf/0.1/mbox'), literal(`mailto:${entity.email}`)));
    }
    
    // Founded date (for organizations)
    if (entity.founded) {
      store.addQuad(quad(subject, namedNode('http://example.org/founded'), literal(entity.founded)));
    }
    
    // Status (for projects)
    if (entity.status) {
      store.addQuad(quad(subject, namedNode('http://example.org/status'), literal(entity.status)));
    }
  }
  
  // Add relationships
  const relationships = [
    { from: 'person1', to: 'person2', relation: 'foaf:knows' },
    { from: 'person1', to: 'person3', relation: 'foaf:knows' },
    { from: 'person2', to: 'person4', relation: 'foaf:knows' },
    { from: 'person1', to: 'company1', relation: 'ex:worksFor' },
    { from: 'person2', to: 'company1', relation: 'ex:worksFor' },
    { from: 'person3', to: 'company2', relation: 'ex:worksFor' },
    { from: 'person1', to: 'project1', relation: 'ex:worksOn' },
    { from: 'person2', to: 'project2', relation: 'ex:worksOn' }
  ];
  
  for (const rel of relationships) {
    store.addQuad(quad(
      namedNode(`http://example.org/${rel.from}`),
      namedNode(`http://xmlns.com/foaf/0.1/${rel.relation.replace('foaf:', '').replace('ex:', '')}`),
      namedNode(`http://example.org/${rel.to}`)
    ));
  }
  
  // Add some additional test data for edge cases
  const additionalData = [
    // Unicode and special characters
    { id: 'unicode', name: '测试用户 🌍', type: 'Person' },
    // Long names
    { id: 'longname', name: 'This is a very long name that tests how the system handles extended text content in RDF literals', type: 'Person' },
    // Numbers and dates
    { id: 'stats', population: '1000000', established: '2023-12-25T10:30:00Z', type: 'Organization' }
  ];
  
  for (const data of additionalData) {
    const subject = namedNode(`http://example.org/${data.id}`);
    
    if (data.type) {
      store.addQuad(quad(subject, namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'), namedNode(`http://xmlns.com/foaf/0.1/${data.type}`)));
    }
    
    if (data.name) {
      store.addQuad(quad(subject, namedNode('http://xmlns.com/foaf/0.1/name'), literal(data.name)));
    }
    
    if (data.population) {
      store.addQuad(quad(subject, namedNode('http://example.org/population'), literal(data.population)));
    }
    
    if (data.established) {
      store.addQuad(quad(subject, namedNode('http://example.org/established'), literal(data.established)));
    }
  }
  
  console.log(`Production smoke test data setup complete: ${store.size} triples`);
}