#!/usr/bin/env tsx
/**
 * Semantic Capabilities Demo
 * Demonstrates N3/TTL integration for enterprise code generation
 */

import { SemanticServer } from '../semantic-server.js';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Demo: Template Semantic Validation
 */
async function demoSemanticValidation() {
  console.log('🔍 Semantic Template Validation Demo\n');
  
  const semanticServer = new SemanticServer();
  
  // Create a mock template file for validation
  const mockTemplatePath = join(__dirname, 'mock-api-template.njk');
  
  // Validate against SOX and API Governance policies
  const result = await semanticServer.validateTemplate(
    mockTemplatePath,
    undefined,
    {
      compliance: ['SOX', 'API_GOVERNANCE'],
      strictMode: false
    }
  );
  
  console.log('Validation Results:');
  console.log(`✓ Valid: ${result.valid}`);
  console.log(`✓ Score: ${result.score}/100`);
  console.log(`✓ Violations: ${result.violations.length}`);
  
  if (result.violations.length > 0) {
    console.log('\nViolations Found:');
    result.violations.forEach((violation, index) => {
      console.log(`${index + 1}. [${violation.severity.toUpperCase()}] ${violation.rule}`);
      console.log(`   Message: ${violation.message}`);
      if (violation.suggestion) {
        console.log(`   Suggestion: ${violation.suggestion}`);
      }
      console.log('');
    });
  }
  
  console.log('Metadata:', result.metadata);
  console.log('\n' + '='.repeat(60) + '\n');
}

/**
 * Demo: N3 Reasoning for Enhanced Template Context
 */
async function demoN3Reasoning() {
  console.log('🧠 N3 Reasoning Demo\n');
  
  const semanticServer = new SemanticServer();
  
  // Example template variables
  const templateVars = {
    apiType: 'rest',
    isPublic: true,
    hasUserAuth: false,
    processesFinancialData: true,
    expectedRpm: 1500
  };
  
  // Apply reasoning using enterprise governance rules
  const result = await semanticServer.applyReasoning(
    {
      rules: [join(__dirname, '../rules/enterprise-governance.n3')],
      premises: [
        join(__dirname, '../schemas/sox-compliance.ttl'),
        join(__dirname, '../schemas/api-governance.ttl')
      ],
      depth: 3,
      mode: 'forward'
    },
    templateVars
  );
  
  console.log('Original Template Variables:');
  console.log(JSON.stringify(templateVars, null, 2));
  
  console.log('\nEnhanced Template Context (after reasoning):');
  console.log(JSON.stringify(result.templateContext, null, 2));
  
  console.log(`\nDerived Facts: ${result.derivedFacts.length}`);
  if (result.derivedFacts.length > 0) {
    console.log('Sample derived facts:');
    result.derivedFacts.slice(0, 5).forEach((fact, index) => {
      console.log(`${index + 1}. ${fact.subject.value} → ${fact.predicate.value} → ${fact.object.value}`);
    });
  }
  
  console.log('\nReasoning Metadata:', result.metadata);
  console.log('\n' + '='.repeat(60) + '\n');
}

/**
 * Demo: Knowledge Graph Querying
 */
async function demoKnowledgeQuery() {
  console.log('📊 Knowledge Graph Query Demo\n');
  
  const semanticServer = new SemanticServer();
  
  // Query for API endpoints with specific patterns
  const result = await semanticServer.queryKnowledge(
    {
      pattern: {
        predicate: 'http://unjucks.dev/api/generatesEndpoint',
        object: 'true'
      },
      limit: 10
    },
    { useReasoning: true }
  );
  
  console.log('Knowledge Query Results:');
  console.log(`Total results: ${result.results.length}`);
  
  if (result.results.length > 0) {
    console.log('\nAPI Endpoints Found:');
    result.results.forEach((result, index) => {
      console.log(`${index + 1}. Subject: ${result.subject}`);
      console.log(`   Predicate: ${result.predicate}`);
      console.log(`   Object: ${result.object}`);
      console.log('');
    });
  }
  
  console.log('Query Metadata:', result.metadata);
  console.log('\n' + '='.repeat(60) + '\n');
}

/**
 * Demo: Enterprise Compliance Checking
 */
async function demoComplianceCheck() {
  console.log('🏛️ Enterprise Compliance Check Demo\n');
  
  const semanticServer = new SemanticServer();
  
  // Mock template path
  const mockTemplatePath = join(__dirname, 'mock-financial-template.njk');
  
  // Check compliance against multiple policies
  const result = await semanticServer.checkCompliance(
    mockTemplatePath,
    ['SOX', 'GDPR', 'API_GOVERNANCE'],
    { strictMode: false }
  );
  
  console.log('Compliance Check Results:');
  console.log(`✓ Valid: ${result.valid}`);
  console.log(`✓ Score: ${result.score}/100`);
  
  if (result.violations.length > 0) {
    console.log('\nCompliance Issues:');
    
    const errors = result.violations.filter(v => v.severity === 'error');
    const warnings = result.violations.filter(v => v.severity === 'warning');
    
    if (errors.length > 0) {
      console.log(`\nErrors (${errors.length}):`);
      errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error.rule}: ${error.message}`);
        if (error.suggestion) {
          console.log(`   💡 ${error.suggestion}`);
        }
      });
    }
    
    if (warnings.length > 0) {
      console.log(`\nWarnings (${warnings.length}):`);
      warnings.forEach((warning, index) => {
        console.log(`${index + 1}. ${warning.rule}: ${warning.message}`);
      });
    }
  }
  
  console.log('\nCompliance Metadata:', result.metadata);
  console.log('\n' + '='.repeat(60) + '\n');
}

/**
 * Demo: Integration with Existing RDF Filters
 */
async function demoRdfIntegration() {
  console.log('🔗 RDF Filters Integration Demo\n');
  
  // Load existing RDF data and show how semantic server enhances it
  const { RDFFilters } = await import('../../lib/rdf-filters.js');
  const { Store, Parser, DataFactory } = await import('n3');
  
  const { namedNode, literal, quad } = DataFactory;
  
  // Create some sample RDF data
  const store = new Store();
  store.addQuad(
    namedNode('http://unjucks.dev/template/api-service'),
    namedNode('http://unjucks.dev/api/generatesEndpoint'),
    literal('true')
  );
  store.addQuad(
    namedNode('http://unjucks.dev/template/api-service'),
    namedNode('http://unjucks.dev/api/isPublic'),
    literal('true')
  );
  store.addQuad(
    namedNode('http://unjucks.dev/template/api-service'),
    namedNode('http://unjucks.dev/template/hasFinancialData'),
    literal('true')
  );
  
  // Create RDF filters with the store
  const rdfFilters = new RDFFilters({ store });
  
  // Demonstrate RDF filter queries
  console.log('RDF Filter Queries:');
  
  const apiEndpoints = rdfFilters.rdfObject(
    'http://unjucks.dev/template/api-service',
    'http://unjucks.dev/api/generatesEndpoint'
  );
  console.log('API Endpoints:', apiEndpoints);
  
  const publicApis = rdfFilters.rdfObject(
    'http://unjucks.dev/template/api-service',
    'http://unjucks.dev/api/isPublic'
  );
  console.log('Public APIs:', publicApis);
  
  const label = rdfFilters.rdfLabel('http://unjucks.dev/template/api-service');
  console.log('Template Label:', label);
  
  const types = rdfFilters.rdfType('http://unjucks.dev/template/api-service');
  console.log('Template Types:', types);
  
  console.log('\n' + '='.repeat(60) + '\n');
}

/**
 * Main demo runner
 */
async function runDemo() {
  console.log('🚀 Unjucks Semantic Capabilities Demo\n');
  console.log('Demonstrating advanced N3/TTL integration for enterprise code generation\n');
  console.log('='.repeat(60) + '\n');
  
  try {
    await demoSemanticValidation();
    await demoN3Reasoning();
    await demoKnowledgeQuery();
    await demoComplianceCheck();
    await demoRdfIntegration();
    
    console.log('✅ All demos completed successfully!');
    console.log('\nSemantic capabilities include:');
    console.log('• RDF-based template validation using enterprise schemas');
    console.log('• N3 rule-based reasoning for intelligent code generation');
    console.log('• SPARQL-like querying of enterprise knowledge graphs');
    console.log('• Semantic compliance validation (SOX, GDPR, HIPAA, API Governance)');
    console.log('• Integration with existing RDF filters for template processing');
    
  } catch (error) {
    console.error('❌ Demo failed:', error);
    process.exit(1);
  }
}

// Run demo if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runDemo().catch(console.error);
}

export {
  demoSemanticValidation,
  demoN3Reasoning,
  demoKnowledgeQuery,
  demoComplianceCheck,
  demoRdfIntegration
};