/**
 * Integration Validation Step Definitions for KGEN E2E Testing
 * 
 * Validates seamless integration between all KGEN engines and components:
 * - RDF Knowledge Graph ↔ Template Engine
 * - Template Engine ↔ CAS Engine  
 * - CAS Engine ↔ Provenance Engine
 * - Performance Monitor ↔ All Engines
 * - CLI ↔ All Backend Systems
 */

import { Given, When, Then, Before, After } from '@cucumber/cucumber';
import { expect } from 'chai';
import { promises as fs } from 'fs';
import path from 'path';
import { performance } from 'perf_hooks';
import crypto from 'crypto';

// Import test data
import sampleData from '../fixtures/data/sample-project-data.json';

interface IntegrationContext {
  // Engine health tracking
  engineStates: Map<string, {
    initialized: boolean;
    responsive: boolean;
    lastHealthCheck: number;
    errorCount: number;
    performance: {
      averageResponseTime: number;
      operationsCount: number;
    };
  }>;
  
  // Cross-engine data flow tracking
  dataFlowLog: Array<{
    timestamp: number;
    source: string;
    target: string;
    operation: string;
    dataSize: number;
    duration: number;
    success: boolean;
    errorDetails?: string;
  }>;
  
  // Integration test results
  integrationResults: Map<string, {
    testName: string;
    passed: boolean;
    duration: number;
    details: any;
    error?: string;
  }>;
  
  // Component interaction matrix
  interactionMatrix: Map<string, Map<string, {
    interactions: number;
    successRate: number;
    averageDuration: number;
    lastInteraction: number;
  }>>;
  
  // System-wide metrics
  systemMetrics: {
    totalOperations: number;
    successfulOperations: number;
    failedOperations: number;
    averageEndToEndLatency: number;
    memoryEfficiency: number;
    cacheEffectiveness: number;
  };
  
  // Test workspace
  integrationWorkspace: string;
  testArtifacts: Set<string>;
  
  // Mock external dependencies
  mockServices: Map<string, any>;
}

// Global integration context
let integrationContext: IntegrationContext = {
  engineStates: new Map(),
  dataFlowLog: [],
  integrationResults: new Map(),
  interactionMatrix: new Map(),
  systemMetrics: {
    totalOperations: 0,
    successfulOperations: 0,
    failedOperations: 0,
    averageEndToEndLatency: 0,
    memoryEfficiency: 0,
    cacheEffectiveness: 0
  },
  integrationWorkspace: '',
  testArtifacts: new Set(),
  mockServices: new Map()
};

// =============================================================================
// INTEGRATION SETUP AND UTILITIES
// =============================================================================

Before(async function() {
  // Setup integration workspace
  integrationContext.integrationWorkspace = path.join(__dirname, '../../../test-workspace', 
    `integration-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  
  await fs.mkdir(integrationContext.integrationWorkspace, { recursive: true });
  
  // Clear previous state
  integrationContext.engineStates.clear();
  integrationContext.dataFlowLog = [];
  integrationContext.integrationResults.clear();
  integrationContext.interactionMatrix.clear();
  integrationContext.testArtifacts.clear();
  integrationContext.mockServices.clear();
  
  // Reset system metrics
  integrationContext.systemMetrics = {
    totalOperations: 0,
    successfulOperations: 0,
    failedOperations: 0,
    averageEndToEndLatency: 0,
    memoryEfficiency: 0,
    cacheEffectiveness: 0
  };
  
  // Initialize engine tracking
  const engines = ['CAS', 'Template', 'Provenance', 'Performance', 'RDF', 'CLI'];
  for (const engine of engines) {
    integrationContext.engineStates.set(engine, {
      initialized: false,
      responsive: false,
      lastHealthCheck: 0,
      errorCount: 0,
      performance: {
        averageResponseTime: 0,
        operationsCount: 0
      }
    });
    
    integrationContext.interactionMatrix.set(engine, new Map());
  }
});

After(async function() {
  // Cleanup test artifacts
  for (const artifact of integrationContext.testArtifacts) {
    try {
      await fs.unlink(artifact);
    } catch (error) {
      // Artifact might already be deleted
    }
  }
  
  // Cleanup workspace
  try {
    await fs.rm(integrationContext.integrationWorkspace, { recursive: true, force: true });
  } catch (error) {
    console.warn('Could not clean up integration workspace:', error.message);
  }
});

// Utility functions
async function trackDataFlow(source: string, target: string, operation: string, 
  dataSize: number, duration: number, success: boolean, errorDetails?: string) {
  
  integrationContext.dataFlowLog.push({
    timestamp: Date.now(),
    source,
    target,
    operation,
    dataSize,
    duration,
    success,
    errorDetails
  });
  
  // Update interaction matrix
  if (!integrationContext.interactionMatrix.get(source)?.has(target)) {
    integrationContext.interactionMatrix.get(source)?.set(target, {
      interactions: 0,
      successRate: 0,
      averageDuration: 0,
      lastInteraction: 0
    });
  }
  
  const interaction = integrationContext.interactionMatrix.get(source)?.get(target);
  if (interaction) {
    interaction.interactions++;
    interaction.lastInteraction = Date.now();
    interaction.averageDuration = (interaction.averageDuration + duration) / 2;
    interaction.successRate = integrationContext.dataFlowLog
      .filter(log => log.source === source && log.target === target)
      .reduce((acc, log, _, arr) => acc + (log.success ? 1 : 0) / arr.length, 0);
  }
}

async function performHealthCheck(engineName: string): Promise<boolean> {
  const engine = integrationContext.engineStates.get(engineName);
  if (!engine) return false;
  
  const startTime = performance.now();
  
  try {
    // Perform engine-specific health check
    let healthCheckResult = false;
    
    switch (engineName) {
      case 'CAS':
        // Test CAS storage and retrieval
        const { CASEngine } = await import('../../../packages/kgen-core/src/cas/index.js');
        const casEngine = new CASEngine({ storageType: 'memory' });
        await casEngine.initialize();
        const testHash = await casEngine.store('health-check-data');
        const retrieved = await casEngine.retrieve(testHash);
        healthCheckResult = retrieved === 'health-check-data';
        break;
        
      case 'Template':
        // Test template rendering
        const { KgenTemplateEngine } = await import('../../../packages/kgen-templates/src/template-engine.js');
        const templateEngine = new KgenTemplateEngine({
          templateDirs: [integrationContext.integrationWorkspace],
          outputDir: integrationContext.integrationWorkspace
        });
        await templateEngine.initialize();
        const rendered = await templateEngine.render('{{ test }}', { test: 'health-check' });
        healthCheckResult = rendered === 'health-check';
        break;
        
      case 'Provenance':
        // Test provenance creation
        const { ProvenanceEngine } = await import('../../../packages/kgen-core/src/provenance/engine.js');
        const provenanceEngine = new ProvenanceEngine({ storageBackend: 'memory' });
        await provenanceEngine.initialize();
        const provenance = await provenanceEngine.createProvenance({
          file: 'health-check.txt',
          generator: 'health-check',
          timestamp: new Date().toISOString(),
          contentHash: 'sha256:test',
          dependencies: []
        });
        healthCheckResult = !!provenance;
        break;
        
      case 'Performance':
        // Test performance monitoring
        const { PerformanceMonitor } = await import('../../../packages/kgen-core/src/performance/monitor.js');
        const perfMonitor = new PerformanceMonitor({ enableRealTime: true });
        perfMonitor.start();
        healthCheckResult = perfMonitor.isRunning();
        perfMonitor.stop();
        break;
        
      case 'RDF':
        // Test RDF operations
        const { RDFKnowledgeGraph } = await import('../../../packages/kgen-core/src/rdf/knowledge-graph.js');
        const rdfGraph = new RDFKnowledgeGraph();
        await rdfGraph.initialize();
        await rdfGraph.loadTurtle('@prefix test: <http://test.org/> . test:subject test:predicate "health-check" .');
        const queryResult = await rdfGraph.query('SELECT ?o WHERE { ?s ?p ?o }');
        healthCheckResult = queryResult.length > 0;
        break;
        
      case 'CLI':
        // Test CLI availability (basic check)
        const cliBinary = path.resolve(__dirname, '../../../bin/kgen.mjs');
        await fs.access(cliBinary, fs.constants.F_OK);
        healthCheckResult = true;
        break;
        
      default:
        healthCheckResult = false;
    }
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    // Update engine state
    engine.responsive = healthCheckResult;
    engine.lastHealthCheck = Date.now();
    engine.performance.operationsCount++;
    engine.performance.averageResponseTime = 
      (engine.performance.averageResponseTime + duration) / 2;
    
    if (!healthCheckResult) {
      engine.errorCount++;
    }
    
    await trackDataFlow('HealthCheck', engineName, 'health_check', 0, duration, healthCheckResult);
    
    return healthCheckResult;
    
  } catch (error) {
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    engine.responsive = false;
    engine.errorCount++;
    engine.lastHealthCheck = Date.now();
    
    await trackDataFlow('HealthCheck', engineName, 'health_check', 0, duration, false, error.message);
    
    return false;
  }
}

// =============================================================================
// ENGINE INTEGRATION VALIDATION
// =============================================================================

Given('all KGEN engines are initialized and healthy', async function() {
  const engines = Array.from(integrationContext.engineStates.keys());
  const healthResults = await Promise.all(
    engines.map(async engine => ({
      engine,
      healthy: await performHealthCheck(engine)
    }))
  );
  
  for (const result of healthResults) {
    expect(result.healthy).to.be.true, `Engine ${result.engine} health check failed`);
    
    const engineState = integrationContext.engineStates.get(result.engine);
    if (engineState) {
      engineState.initialized = true;
      engineState.responsive = true;
    }
  }
  
  console.log(`✓ All ${engines.length} engines are healthy and responsive`);
});

When('I test data flow between {string} and {string} engines', async function(sourceEngine: string, targetEngine: string) {
  const testName = `dataflow_${sourceEngine}_to_${targetEngine}`;
  const testStart = performance.now();
  
  try {
    let testResult = false;
    let testDetails: any = {};
    
    // Test specific engine combinations
    if (sourceEngine === 'RDF' && targetEngine === 'Template') {
      // Test RDF → Template integration
      const { RDFKnowledgeGraph } = await import('../../../packages/kgen-core/src/rdf/knowledge-graph.js');
      const { KgenTemplateEngine } = await import('../../../packages/kgen-templates/src/template-engine.js');
      
      const rdfGraph = new RDFKnowledgeGraph();
      const templateEngine = new KgenTemplateEngine({
        templateDirs: [integrationContext.integrationWorkspace],
        outputDir: integrationContext.integrationWorkspace
      });
      
      await rdfGraph.initialize();
      await templateEngine.initialize();
      
      // Load test RDF data
      const rdfData = `
        @prefix test: <http://test.org/> .
        @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
        
        test:Project a rdfs:Class ;
          rdfs:label "Test Project" ;
          test:name "IntegrationTest" ;
          test:version "1.0.0" .
      `;
      
      await rdfGraph.loadTurtle(rdfData);
      const rdfResults = await rdfGraph.query(`
        SELECT ?name ?version WHERE {
          ?project test:name ?name ;
                  test:version ?version .
        }
      `);
      
      // Use RDF data in template
      const templateContent = 'Project: {{ rdf.name }}, Version: {{ rdf.version }}';
      const rdfVars = {
        rdf: {
          name: rdfResults[0]?.name?.value || 'Unknown',
          version: rdfResults[0]?.version?.value || '0.0.0'
        }
      };
      
      const rendered = await templateEngine.render(templateContent, rdfVars);
      testResult = rendered.includes('IntegrationTest') && rendered.includes('1.0.0');
      testDetails = { rdfResults, rendered };
      
    } else if (sourceEngine === 'Template' && targetEngine === 'CAS') {
      // Test Template → CAS integration
      const { KgenTemplateEngine } = await import('../../../packages/kgen-templates/src/template-engine.js');
      const { CASEngine } = await import('../../../packages/kgen-core/src/cas/index.js');
      
      const templateEngine = new KgenTemplateEngine({
        templateDirs: [integrationContext.integrationWorkspace],
        outputDir: integrationContext.integrationWorkspace
      });
      const casEngine = new CASEngine({ storageType: 'memory', enableMetrics: true });
      
      await templateEngine.initialize();
      await casEngine.initialize();
      
      // Render template and store in CAS
      const templateContent = 'Generated content: {{ timestamp }} - {{ data }}';
      const templateVars = {
        timestamp: new Date().toISOString(),
        data: 'integration-test-data'
      };
      
      const rendered = await templateEngine.render(templateContent, templateVars);
      const casHash = await casEngine.store(rendered);
      const retrieved = await casEngine.retrieve(casHash);
      
      testResult = retrieved === rendered && casHash.startsWith('sha256:');
      testDetails = { rendered, casHash, retrieved };
      
    } else if (sourceEngine === 'CAS' && targetEngine === 'Provenance') {
      // Test CAS → Provenance integration
      const { CASEngine } = await import('../../../packages/kgen-core/src/cas/index.js');
      const { ProvenanceEngine } = await import('../../../packages/kgen-core/src/provenance/engine.js');
      
      const casEngine = new CASEngine({ storageType: 'memory' });
      const provenanceEngine = new ProvenanceEngine({ 
        storageBackend: 'memory',
        enableCryptographicProofs: true
      });
      
      await casEngine.initialize();
      await provenanceEngine.initialize();
      
      // Store content in CAS and create provenance
      const testContent = 'Provenance test content with unique data: ' + Math.random();
      const contentHash = await casEngine.store(testContent);
      
      const provenance = await provenanceEngine.createProvenance({
        file: 'test-integration.txt',
        generator: 'integration-test',
        timestamp: new Date().toISOString(),
        contentHash,
        dependencies: []
      });
      
      const attestation = await provenanceEngine.createAttestation(provenance);
      
      testResult = !!provenance && !!attestation && provenance.contentHash === contentHash;
      testDetails = { contentHash, provenance, attestation };
      
    } else {
      // Generic integration test
      testResult = await performHealthCheck(sourceEngine) && await performHealthCheck(targetEngine);
      testDetails = { message: 'Generic health check integration' };
    }
    
    const testEnd = performance.now();
    const testDuration = testEnd - testStart;
    
    integrationContext.integrationResults.set(testName, {
      testName,
      passed: testResult,
      duration: testDuration,
      details: testDetails
    });
    
    await trackDataFlow(sourceEngine, targetEngine, 'integration_test', 
      JSON.stringify(testDetails).length, testDuration, testResult);
    
    integrationContext.systemMetrics.totalOperations++;
    if (testResult) {
      integrationContext.systemMetrics.successfulOperations++;
    } else {
      integrationContext.systemMetrics.failedOperations++;
    }
    
  } catch (error) {
    const testEnd = performance.now();
    const testDuration = testEnd - testStart;
    
    integrationContext.integrationResults.set(testName, {
      testName,
      passed: false,
      duration: testDuration,
      details: {},
      error: error.message
    });
    
    await trackDataFlow(sourceEngine, targetEngine, 'integration_test', 
      0, testDuration, false, error.message);
    
    integrationContext.systemMetrics.totalOperations++;
    integrationContext.systemMetrics.failedOperations++;
    
    throw error;
  }
});

When('I validate end-to-end workflow integration', async function() {
  const workflowStart = performance.now();
  
  // Create a comprehensive end-to-end test using sample data
  const projectData = sampleData.webappProject;
  const templateVars = {
    ...projectData,
    ...sampleData.templateVariables
  };
  
  try {
    // Step 1: Initialize all engines
    const { RDFKnowledgeGraph } = await import('../../../packages/kgen-core/src/rdf/knowledge-graph.js');
    const { KgenTemplateEngine } = await import('../../../packages/kgen-templates/src/template-engine.js');
    const { CASEngine } = await import('../../../packages/kgen-core/src/cas/index.js');
    const { ProvenanceEngine } = await import('../../../packages/kgen-core/src/provenance/engine.js');
    const { PerformanceMonitor } = await import('../../../packages/kgen-core/src/performance/monitor.js');
    
    const engines = {
      rdf: new RDFKnowledgeGraph({ enableInference: true }),
      template: new KgenTemplateEngine({
        templateDirs: [path.join(__dirname, '../fixtures/templates')],
        outputDir: path.join(integrationContext.integrationWorkspace, 'output')
      }),
      cas: new CASEngine({ storageType: 'memory', enableMetrics: true }),
      provenance: new ProvenanceEngine({ storageBackend: 'memory', enableCryptographicProofs: true }),
      performance: new PerformanceMonitor({ enableRealTime: true })
    };
    
    // Initialize all engines
    await Promise.all([
      engines.rdf.initialize(),
      engines.template.initialize(), 
      engines.cas.initialize(),
      engines.provenance.initialize(),
      engines.performance.start()
    ]);
    
    // Step 2: Load RDF schema
    await engines.rdf.loadTurtle(projectData.rdf.schema.turtle);
    await trackDataFlow('Test', 'RDF', 'load_schema', projectData.rdf.schema.turtle.length, 0, true);
    
    // Step 3: Create template and render
    const templateContent = `---
to: {{ projectName }}/test-integration.js
---
// Generated by E2E integration test
const project = {
  name: '{{ projectName }}',
  type: '{{ projectType }}', 
  features: {{ features | dump }},
  timestamp: '{{ generatedAt }}'
};
module.exports = project;`;
    
    const templatePath = path.join(integrationContext.integrationWorkspace, 'test-template.njk');
    await fs.writeFile(templatePath, templateContent, 'utf-8');
    integrationContext.testArtifacts.add(templatePath);
    
    const rendered = await engines.template.render(templateContent, templateVars);
    await trackDataFlow('Test', 'Template', 'render_template', rendered.length, 0, true);
    
    // Step 4: Store rendered content in CAS
    const contentHash = await engines.cas.store(rendered);
    await trackDataFlow('Template', 'CAS', 'store_content', rendered.length, 0, true);
    
    // Step 5: Create provenance record
    const provenance = await engines.provenance.createProvenance({
      file: `${projectData.projectName}/test-integration.js`,
      generator: 'e2e-integration-test',
      timestamp: templateVars.generatedAt,
      contentHash,
      dependencies: [templatePath]
    });
    await trackDataFlow('CAS', 'Provenance', 'create_provenance', JSON.stringify(provenance).length, 0, true);
    
    // Step 6: Create attestation
    const attestation = await engines.provenance.createAttestation(provenance);
    await trackDataFlow('Provenance', 'Provenance', 'create_attestation', JSON.stringify(attestation).length, 0, true);
    
    // Step 7: Verify data integrity across all engines
    const retrievedContent = await engines.cas.retrieve(contentHash);
    const integrityCheck = retrievedContent === rendered;
    await trackDataFlow('CAS', 'Test', 'verify_integrity', retrievedContent.length, 0, integrityCheck);
    
    // Step 8: Query RDF for schema validation
    const schemaQuery = 'SELECT ?s ?p ?o WHERE { ?s ?p ?o } LIMIT 10';
    const schemaResults = await engines.rdf.query(schemaQuery);
    const schemaValid = schemaResults.length > 0;
    await trackDataFlow('Test', 'RDF', 'query_schema', JSON.stringify(schemaResults).length, 0, schemaValid);
    
    // Step 9: Get performance metrics
    const perfMetrics = engines.performance.getMetrics();
    const casMetrics = await engines.cas.getMetrics();
    
    engines.performance.stop();
    
    const workflowEnd = performance.now();
    const totalDuration = workflowEnd - workflowStart;
    
    // Calculate system-wide metrics
    integrationContext.systemMetrics.averageEndToEndLatency = totalDuration;
    integrationContext.systemMetrics.memoryEfficiency = process.memoryUsage().heapUsed / (1024 * 1024);
    integrationContext.systemMetrics.cacheEffectiveness = casMetrics.hitRate || 0;
    
    // Validate end-to-end success
    const e2eSuccess = integrityCheck && schemaValid && !!provenance && !!attestation;
    
    integrationContext.integrationResults.set('e2e_workflow', {
      testName: 'e2e_workflow',
      passed: e2eSuccess,
      duration: totalDuration,
      details: {
        rendered: !!rendered,
        contentHash,
        integrityCheck,
        schemaValid,
        provenanceCreated: !!provenance,
        attestationCreated: !!attestation,
        perfMetrics,
        casMetrics
      }
    });
    
    integrationContext.systemMetrics.totalOperations++;
    if (e2eSuccess) {
      integrationContext.systemMetrics.successfulOperations++;
    } else {
      integrationContext.systemMetrics.failedOperations++;
    }
    
  } catch (error) {
    const workflowEnd = performance.now();
    const totalDuration = workflowEnd - workflowStart;
    
    integrationContext.integrationResults.set('e2e_workflow', {
      testName: 'e2e_workflow',
      passed: false,
      duration: totalDuration,
      details: {},
      error: error.message
    });
    
    integrationContext.systemMetrics.totalOperations++;
    integrationContext.systemMetrics.failedOperations++;
    
    throw error;
  }
});

// =============================================================================
// INTEGRATION ASSERTIONS
// =============================================================================

Then('data flow between engines should be seamless', function() {
  // Analyze data flow logs for issues
  const failedFlows = integrationContext.dataFlowLog.filter(log => !log.success);
  const totalFlows = integrationContext.dataFlowLog.length;
  
  expect(totalFlows).to.be.greaterThan(0, 'No data flows recorded');
  
  const successRate = (totalFlows - failedFlows.length) / totalFlows;
  expect(successRate).to.be.greaterThan(0.95, 
    `Data flow success rate ${(successRate * 100).toFixed(1)}% below 95% threshold`);
  
  // Check average flow duration
  const averageFlowTime = integrationContext.dataFlowLog
    .reduce((sum, log) => sum + log.duration, 0) / totalFlows;
  
  expect(averageFlowTime).to.be.lessThan(1000, 
    `Average data flow time ${averageFlowTime.toFixed(2)}ms exceeds 1000ms threshold`);
  
  console.log(`✓ Data flow seamless: ${(successRate * 100).toFixed(1)}% success rate, ${averageFlowTime.toFixed(2)}ms average`);
});

Then('all integration tests should pass', function() {
  const allTests = Array.from(integrationContext.integrationResults.values());
  const failedTests = allTests.filter(test => !test.passed);
  
  expect(allTests.length).to.be.greaterThan(0, 'No integration tests were executed');
  
  for (const test of failedTests) {
    console.error(`Failed integration test: ${test.testName} - ${test.error || 'Unknown error'}`);
  }
  
  expect(failedTests.length).to.equal(0, 
    `${failedTests.length} integration tests failed: ${failedTests.map(t => t.testName).join(', ')}`);
  
  console.log(`✓ All ${allTests.length} integration tests passed`);
});

Then('engine interaction matrix should show healthy communication', function() {
  let totalInteractions = 0;
  let totalSuccessRate = 0;
  let interactionPairs = 0;
  
  for (const [source, targets] of integrationContext.interactionMatrix.entries()) {
    for (const [target, stats] of targets.entries()) {
      if (stats.interactions > 0) {
        totalInteractions += stats.interactions;
        totalSuccessRate += stats.successRate;
        interactionPairs++;
        
        expect(stats.successRate).to.be.greaterThan(0.9, 
          `${source} → ${target} success rate ${(stats.successRate * 100).toFixed(1)}% below 90%`);
        
        expect(stats.averageDuration).to.be.lessThan(500, 
          `${source} → ${target} average duration ${stats.averageDuration.toFixed(2)}ms exceeds 500ms`);
      }
    }
  }
  
  expect(interactionPairs).to.be.greaterThan(0, 'No engine interactions recorded');
  
  const overallSuccessRate = totalSuccessRate / interactionPairs;
  expect(overallSuccessRate).to.be.greaterThan(0.95, 
    `Overall interaction success rate ${(overallSuccessRate * 100).toFixed(1)}% below 95%`);
  
  console.log(`✓ Engine interactions healthy: ${interactionPairs} pairs, ${(overallSuccessRate * 100).toFixed(1)}% success`);
});

Then('system-wide performance metrics should be within targets', function() {
  const metrics = integrationContext.systemMetrics;
  
  expect(metrics.totalOperations).to.be.greaterThan(0, 'No operations recorded');
  
  const systemSuccessRate = metrics.successfulOperations / metrics.totalOperations;
  expect(systemSuccessRate).to.be.greaterThan(0.95, 
    `System success rate ${(systemSuccessRate * 100).toFixed(1)}% below 95%`);
  
  expect(metrics.averageEndToEndLatency).to.be.lessThan(5000, 
    `End-to-end latency ${metrics.averageEndToEndLatency.toFixed(2)}ms exceeds 5000ms`);
  
  expect(metrics.memoryEfficiency).to.be.lessThan(500, 
    `Memory usage ${metrics.memoryEfficiency.toFixed(2)}MB exceeds 500MB`);
  
  if (metrics.cacheEffectiveness > 0) {
    expect(metrics.cacheEffectiveness).to.be.greaterThan(0.8, 
      `Cache effectiveness ${(metrics.cacheEffectiveness * 100).toFixed(1)}% below 80%`);
  }
  
  console.log(`✓ System metrics: ${(systemSuccessRate * 100).toFixed(1)}% success, ${metrics.averageEndToEndLatency.toFixed(0)}ms e2e`);
});

Then('end-to-end workflow should complete successfully', function() {
  const e2eResult = integrationContext.integrationResults.get('e2e_workflow');
  expect(e2eResult).to.not.be.undefined, 'End-to-end workflow test not found');
  
  expect(e2eResult.passed).to.be.true, 
    `End-to-end workflow failed: ${e2eResult.error || 'Unknown error'}`);
  
  expect(e2eResult.duration).to.be.lessThan(10000, 
    `End-to-end workflow took ${e2eResult.duration.toFixed(2)}ms, expected under 10000ms`);
  
  // Validate specific workflow components
  expect(e2eResult.details.rendered).to.be.true, 'Template rendering failed');
  expect(e2eResult.details.integrityCheck).to.be.true, 'Content integrity check failed');
  expect(e2eResult.details.schemaValid).to.be.true, 'RDF schema validation failed');
  expect(e2eResult.details.provenanceCreated).to.be.true, 'Provenance creation failed');
  expect(e2eResult.details.attestationCreated).to.be.true, 'Attestation creation failed');
  
  console.log(`✓ End-to-end workflow completed in ${e2eResult.duration.toFixed(2)}ms`);
});

// Export context for external access
export { integrationContext };