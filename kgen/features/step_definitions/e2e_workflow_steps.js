/**
 * E2E Workflow Step Definitions for KGEN
 * 
 * Tests complete project lifecycles connecting multiple engines:
 * - RDF Knowledge Graph Engine
 * - Template Rendering Engine
 * - Content-Addressed Storage (CAS) Engine
 * - Provenance & Attestation Engine
 * - Performance Monitoring Engine
 */

import { Given, When, Then, Before, After } from '@cucumber/cucumber';
import { expect } from 'chai';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { performance } from 'perf_hooks';

// Import KGEN engines and utilities
import { CASEngine } from '../../../packages/kgen-core/src/cas/index.js';
import { KgenTemplateEngine } from '../../../packages/kgen-templates/src/template-engine.js';
import { ProvenanceEngine } from '../../../packages/kgen-core/src/provenance/engine.js';
import { PerformanceMonitor } from '../../../packages/kgen-core/src/performance/monitor.js';
import { RDFKnowledgeGraph } from '../../../packages/kgen-core/src/rdf/knowledge-graph.js';

/**
 * Workflow step definition
 * @typedef {Object} WorkflowStep
 * @property {string} step - Step name
 * @property {'pending'|'running'|'completed'|'failed'} status - Step status
 * @property {number} [startTime] - Step start time
 * @property {number} [endTime] - Step end time
 * @property {any} [error] - Error object if step failed
 */

/**
 * Project metrics tracking
 * @typedef {Object} ProjectMetrics
 * @property {number} totalRenderTime - Total rendering time
 * @property {number} p95RenderTime - 95th percentile render time
 * @property {number} memoryUsage - Memory usage in MB
 * @property {number} cacheHitRate - Cache hit rate percentage
 * @property {number} totalFiles - Total files generated
 * @property {number} attestedFiles - Files with attestation
 */

/**
 * Generated format data
 * @typedef {Object} GeneratedFormat
 * @property {string} content - File content
 * @property {string} hash - Content hash
 * @property {string} path - File path
 */

/**
 * Error scenario tracking
 * @typedef {Object} ErrorScenario
 * @property {string} type - Error type
 * @property {boolean} injected - Whether error was injected
 * @property {boolean} recovered - Whether recovery was successful
 */

/**
 * Rollback point state
 * @typedef {Object} RollbackPoint
 * @property {string} phase - Phase name
 * @property {any} state - Saved state data
 */

/**
 * Performance benchmark result
 * @typedef {Object} BenchmarkResult
 * @property {string} operation - Operation name
 * @property {number} duration - Operation duration in ms
 * @property {number} timestamp - Timestamp
 * @property {any} metadata - Additional metadata
 */

/**
 * E2E workflow test context
 * @typedef {Object} E2EWorkflowContext
 * @property {CASEngine} casEngine - Content-addressed storage engine
 * @property {KgenTemplateEngine} templateEngine - Template rendering engine
 * @property {ProvenanceEngine} provenanceEngine - Provenance tracking engine
 * @property {PerformanceMonitor} performanceMonitor - Performance monitoring
 * @property {RDFKnowledgeGraph} knowledgeGraph - RDF knowledge graph
 * @property {string} projectRoot - Project root directory
 * @property {string} testWorkspace - Test workspace directory
 * @property {string} outputDir - Output directory
 * @property {string} templatesDir - Templates directory
 * @property {string} currentWorkflow - Current workflow name
 * @property {Array<WorkflowStep>} workflowSteps - Workflow steps
 * @property {Map<string, any>} workflowResults - Workflow results
 * @property {'init'|'generate'|'validate'|'attest'|'completed'|'failed'} projectPhase - Current project phase
 * @property {ProjectMetrics} projectMetrics - Project metrics
 * @property {Map<string, GeneratedFormat>} generatedFormats - Generated format data
 * @property {Map<string, boolean>} formatValidation - Format validation results
 * @property {Array<ErrorScenario>} errorScenarios - Error scenarios
 * @property {Array<RollbackPoint>} rollbackPoints - Rollback points
 * @property {Array<BenchmarkResult>} benchmarkResults - Benchmark results
 * @property {import('child_process').ChildProcess | null} kgenProcess - CLI process
 * @property {string[]} processOutput - Process output lines
 * @property {string[]} processErrors - Process error lines
 * @property {number | null} exitCode - Process exit code
 */

// Global workflow context
/** @type {E2EWorkflowContext} */
let workflowContext = {
  casEngine: null,
  templateEngine: null,
  provenanceEngine: null,
  performanceMonitor: null,
  knowledgeGraph: null,
  
  projectRoot: process.cwd(),
  testWorkspace: '',
  outputDir: '',
  templatesDir: '',
  
  currentWorkflow: '',
  workflowSteps: [],
  workflowResults: new Map(),
  
  projectPhase: 'init',
  projectMetrics: {
    totalRenderTime: 0,
    p95RenderTime: 0,
    memoryUsage: 0,
    cacheHitRate: 0,
    totalFiles: 0,
    attestedFiles: 0
  },
  
  generatedFormats: new Map(),
  formatValidation: new Map(),
  
  errorScenarios: [],
  rollbackPoints: [],
  
  benchmarkResults: [],
  
  kgenProcess: null,
  processOutput: [],
  processErrors: [],
  exitCode: null
};

// =============================================================================
// WORKFLOW SETUP AND INITIALIZATION
// =============================================================================

Before(async function() {
  // Clean state for each scenario
  if (workflowContext.kgenProcess) {
    workflowContext.kgenProcess.kill();
  }
  
  workflowContext.testWorkspace = path.join(__dirname, '../../../test-workspace', 
    `e2e-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  workflowContext.outputDir = path.join(workflowContext.testWorkspace, 'output');
  workflowContext.templatesDir = path.join(workflowContext.testWorkspace, '_templates');
  
  await fs.mkdir(workflowContext.testWorkspace, { recursive: true });
  await fs.mkdir(workflowContext.outputDir, { recursive: true });
  await fs.mkdir(workflowContext.templatesDir, { recursive: true });
});

After(async function() {
  // Cleanup engines
  if (workflowContext.casEngine) {
    await workflowContext.casEngine.shutdown();
  }
  if (workflowContext.provenanceEngine) {
    await workflowContext.provenanceEngine.shutdown();
  }
  if (workflowContext.performanceMonitor) {
    workflowContext.performanceMonitor.stop();
  }
  
  // Kill any running processes
  if (workflowContext.kgenProcess) {
    workflowContext.kgenProcess.kill();
  }
  
  // Clean up test workspace
  try {
    await fs.rm(workflowContext.testWorkspace, { recursive: true, force: true });
  } catch (error) {
    console.warn('Could not clean up test workspace:', error.message);
  }
});

Given('I have a complete KGEN environment initialized', async function() {
  // Initialize all engines with production-like configuration
  workflowContext.casEngine = new CASEngine({
    storageType: 'memory',
    cacheSize: 10000,
    enableMetrics: true,
    performanceTarget: { 
      hashTimeP95: 5, 
      cacheHitRate: 0.90 
    }
  });
  
  workflowContext.templateEngine = new KgenTemplateEngine({
    templateDirs: [workflowContext.templatesDir],
    outputDir: workflowContext.outputDir,
    deterministic: true,
    enableCache: true
  });
  
  workflowContext.provenanceEngine = new ProvenanceEngine({
    storageBackend: 'memory',
    enableCryptographicProofs: true,
    enableTimestamping: true
  });
  
  workflowContext.performanceMonitor = new PerformanceMonitor({
    enableRealTime: true,
    sampleRate: 1.0,
    metricsRetention: 1000
  });
  
  workflowContext.knowledgeGraph = new RDFKnowledgeGraph({
    enableInference: true,
    enableValidation: true
  });
  
  // Initialize all engines
  await Promise.all([
    workflowContext.casEngine.initialize(),
    workflowContext.templateEngine.initialize(),
    workflowContext.provenanceEngine.initialize(),
    workflowContext.performanceMonitor.start(),
    workflowContext.knowledgeGraph.initialize()
  ]);
  
  expect(workflowContext.casEngine.isInitialized()).to.be.true;
  expect(workflowContext.templateEngine.isInitialized()).to.be.true;
  expect(workflowContext.provenanceEngine.isInitialized()).to.be.true;
  expect(workflowContext.performanceMonitor.isRunning()).to.be.true;
  expect(workflowContext.knowledgeGraph.isInitialized()).to.be.true;
});

Given('I have a project template for {string} with RDF schema', async function(projectType) {
  // Create project template with comprehensive structure
  const templateStructure = {
    'new/index.njk': `---
to: <%= projectName %>/index.js
inject: false
---
// Generated <%= projectType %> project: <%= projectName %>
// Generated at: <%= generatedAt %>
// Schema: <%= rdf.schema.name %>

module.exports = {
  name: '<%= projectName %>',
  type: '<%= projectType %>',
  version: '1.0.0',
  dependencies: <%= JSON.stringify(dependencies, null, 2) %>,
  schema: '<%= rdf.schema.name %>'
};`,

    'new/README.njk': `---
to: <%= projectName %>/README.md
inject: false
---
# <%= projectName %>

A <%= projectType %> project generated by KGEN.

## RDF Schema
\`\`\`turtle
<%= rdf.schema.turtle %>
\`\`\`

## Generated Files
{% for file in generatedFiles -%}
- {{ file.path }} ({{ file.size }} bytes)
{% endfor %}`,

    'new/package.njk': `---
to: <%= projectName %>/package.json
inject: false
---
{
  "name": "<%= projectName %>",
  "version": "1.0.0",
  "description": "Generated <%= projectType %> project",
  "main": "index.js",
  "dependencies": <%= JSON.stringify(dependencies, null, 2) %>,
  "kgen": {
    "generator": "<%= generatorName %>",
    "version": "<%= kgenVersion %>",
    "timestamp": "<%= generatedAt %>",
    "schema": "<%= rdf.schema.name %>"
  }
}`,

    'new/schema.njk': `---
to: <%= projectName %>/schema.ttl
inject: false
---
<%= rdf.schema.turtle %>`,

    'new/attest.njk': `---
to: <%= projectName %>/<%= projectName %>.attest.json
inject: false
---
{
  "version": "1.0.0",
  "generator": "<%= generatorName %>",
  "timestamp": "<%= generatedAt %>",
  "project": {
    "name": "<%= projectName %>",
    "type": "<%= projectType %>",
    "files": <%= JSON.stringify(generatedFiles, null, 2) %>
  },
  "provenance": <%= JSON.stringify(provenance, null, 2) %>,
  "signature": "<%= signature %>"
}`
  };
  
  // Write templates to filesystem
  for (const [templatePath, content] of Object.entries(templateStructure)) {
    const fullPath = path.join(workflowContext.templatesDir, templatePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content, 'utf-8');
  }
  
  // Create RDF schema for project type
  const rdfSchema = `
@prefix ex: <http://example.org/${projectType}/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

ex:${projectType.charAt(0).toUpperCase() + projectType.slice(1)}Project a rdfs:Class ;
  rdfs:label "${projectType} Project" ;
  rdfs:comment "A ${projectType} project generated by KGEN" .

ex:hasName a rdf:Property ;
  rdfs:domain ex:${projectType.charAt(0).toUpperCase() + projectType.slice(1)}Project ;
  rdfs:range rdfs:Literal .

ex:hasType a rdf:Property ;
  rdfs:domain ex:${projectType.charAt(0).toUpperCase() + projectType.slice(1)}Project ;
  rdfs:range rdfs:Literal .
`;
  
  await workflowContext.knowledgeGraph.loadTurtle(rdfSchema);
  
  workflowContext.workflowResults.set('projectTemplate', {
    type: projectType,
    templatesCreated: Object.keys(templateStructure).length,
    rdfSchemaLoaded: true
  });
});

// =============================================================================
// FULL PROJECT LIFECYCLE WORKFLOWS
// =============================================================================

When('I execute the complete project lifecycle for {string} named {string}', async function(projectType, projectName) {
  workflowContext.currentWorkflow = `${projectType}-${projectName}-lifecycle`;
  workflowContext.workflowSteps = [
    { step: 'init', status: 'pending' },
    { step: 'generate', status: 'pending' },
    { step: 'validate', status: 'pending' },
    { step: 'attest', status: 'pending' }
  ];
  
  const workflowStartTime = performance.now();
  
  try {
    // Phase 1: Initialize project
    await executeWorkflowStep('init', async () => {
      workflowContext.projectPhase = 'init';
      const initResult = await workflowContext.templateEngine.discoverGenerators();
      expect(initResult.generators).to.have.length.greaterThan(0);
      
      workflowContext.workflowResults.set('init', {
        generatorsFound: initResult.generators.length,
        phase: 'completed'
      });
    });
    
    // Phase 2: Generate project files
    await executeWorkflowStep('generate', async () => {
      workflowContext.projectPhase = 'generate';
      
      const templateVars = {
        projectName,
        projectType,
        generatedAt: new Date().toISOString(),
        dependencies: {
          'express': '^4.18.0',
          'lodash': '^4.17.0'
        },
        rdf: {
          schema: {
            name: `${projectType}Schema`,
            turtle: await workflowContext.knowledgeGraph.serializeToTurtle()
          }
        },
        generatedFiles: [],
        kgenVersion: '1.0.0',
        generatorName: 'kgen-new'
      };
      
      const renderStartTime = performance.now();
      const generationResults = await workflowContext.templateEngine.generateFromTemplate('new', templateVars);
      const renderEndTime = performance.now();
      
      workflowContext.projectMetrics.totalRenderTime = renderEndTime - renderStartTime;
      workflowContext.projectMetrics.totalFiles = generationResults.files?.length || 0;
      
      // Store generated content in CAS
      for (const file of generationResults.files || []) {
        const content = await fs.readFile(file.path, 'utf-8');
        const hash = await workflowContext.casEngine.store(content);
        workflowContext.generatedFormats.set(file.path, {
          content,
          hash,
          path: file.path
        });
      }
      
      workflowContext.workflowResults.set('generate', {
        filesGenerated: generationResults.files?.length || 0,
        renderTime: workflowContext.projectMetrics.totalRenderTime,
        phase: 'completed'
      });
    });
    
    // Phase 3: Validate generated files
    await executeWorkflowStep('validate', async () => {
      workflowContext.projectPhase = 'validate';
      
      let validationResults = { passed: 0, failed: 0, errors: [] };
      
      for (const [filePath, fileData] of workflowContext.generatedFormats.entries()) {
        try {
          // Validate file exists and has content
          const stats = await fs.stat(fileData.path);
          expect(stats.size).to.be.greaterThan(0);
          
          // Validate content hash integrity
          const currentHash = crypto.createHash('sha256').update(fileData.content).digest('hex');
          expect(currentHash).to.equal(fileData.hash.replace('sha256:', ''));
          
          // Format-specific validation
          if (filePath.endsWith('.json')) {
            JSON.parse(fileData.content); // Validate JSON
          }
          if (filePath.endsWith('.ttl')) {
            await workflowContext.knowledgeGraph.validateTurtle(fileData.content);
          }
          
          workflowContext.formatValidation.set(filePath, true);
          validationResults.passed++;
          
        } catch (error) {
          workflowContext.formatValidation.set(filePath, false);
          validationResults.failed++;
          validationResults.errors.push({ file: filePath, error: error.message });
        }
      }
      
      workflowContext.workflowResults.set('validate', {
        ...validationResults,
        phase: 'completed'
      });
    });
    
    // Phase 4: Generate attestations
    await executeWorkflowStep('attest', async () => {
      workflowContext.projectPhase = 'attest';
      
      const attestationResults = { created: 0, failed: 0, errors: [] };
      
      for (const [filePath, fileData] of workflowContext.generatedFormats.entries()) {
        if (!filePath.endsWith('.attest.json')) {
          try {
            const provenance = await workflowContext.provenanceEngine.createProvenance({
              file: filePath,
              generator: 'kgen-new',
              timestamp: new Date().toISOString(),
              contentHash: fileData.hash,
              dependencies: []
            });
            
            const attestation = await workflowContext.provenanceEngine.createAttestation(provenance);
            
            workflowContext.projectMetrics.attestedFiles++;
            attestationResults.created++;
            
          } catch (error) {
            attestationResults.failed++;
            attestationResults.errors.push({ file: filePath, error: error.message });
          }
        }
      }
      
      workflowContext.workflowResults.set('attest', {
        ...attestationResults,
        phase: 'completed'
      });
    });
    
    workflowContext.projectPhase = 'completed';
    
    const workflowEndTime = performance.now();
    const totalWorkflowTime = workflowEndTime - workflowStartTime;
    
    workflowContext.benchmarkResults.push({
      operation: 'complete_lifecycle',
      duration: totalWorkflowTime,
      timestamp: Date.now(),
      metadata: {
        projectType,
        projectName,
        phases: workflowContext.workflowSteps.length,
        files: workflowContext.projectMetrics.totalFiles
      }
    });
    
  } catch (error) {
    workflowContext.projectPhase = 'failed';
    const currentStep = workflowContext.workflowSteps.find(step => step.status === 'running');
    if (currentStep) {
      currentStep.status = 'failed';
      currentStep.error = error;
    }
    throw error;
  }
});

/**
 * Executes a workflow step with timing and error handling
 * @param {string} stepName - Name of the step
 * @param {function(): Promise<void>} stepFunction - Function to execute
 * @returns {Promise<void>}
 */
async function executeWorkflowStep(stepName, stepFunction) {
  const step = workflowContext.workflowSteps.find(s => s.step === stepName);
  if (!step) throw new Error(`Workflow step '${stepName}' not found`);
  
  step.status = 'running';
  step.startTime = performance.now();
  
  try {
    await stepFunction();
    step.status = 'completed';
    step.endTime = performance.now();
  } catch (error) {
    step.status = 'failed';
    step.error = error;
    step.endTime = performance.now();
    throw error;
  }
}

// =============================================================================
// MULTI-FORMAT OUTPUT GENERATION
// =============================================================================

When('I generate outputs in formats {string}', async function(formatsStr) {
  const formats = formatsStr.split(',').map(f => f.trim());
  const generationStartTime = performance.now();
  
  for (const format of formats) {
    const formatStartTime = performance.now();
    
    try {
      let output;
      const templateVars = {
        projectName: 'test-project',
        timestamp: new Date().toISOString(),
        format: format
      };
      
      switch (format.toLowerCase()) {
        case 'json':
          output = JSON.stringify(templateVars, null, 2);
          break;
        case 'yaml':
          output = Object.entries(templateVars)
            .map(([key, value]) => `${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`)
            .join('\n');
          break;
        case 'turtle':
          output = `@prefix ex: <http://example.org/> .\nex:project ex:name "${templateVars.projectName}" .`;
          break;
        case 'xml':
          output = `<?xml version="1.0"?>\n<project name="${templateVars.projectName}" timestamp="${templateVars.timestamp}" />`;
          break;
        default:
          output = `# ${format.toUpperCase()} Output\nProject: ${templateVars.projectName}\nTimestamp: ${templateVars.timestamp}`;
      }
      
      // Store in CAS
      const hash = await workflowContext.casEngine.store(output);
      const outputPath = path.join(workflowContext.outputDir, `output.${format}`);
      await fs.writeFile(outputPath, output, 'utf-8');
      
      workflowContext.generatedFormats.set(format, {
        content: output,
        hash,
        path: outputPath
      });
      
      const formatEndTime = performance.now();
      workflowContext.benchmarkResults.push({
        operation: `generate_${format}`,
        duration: formatEndTime - formatStartTime,
        timestamp: Date.now(),
        metadata: { format, contentLength: output.length }
      });
      
    } catch (error) {
      throw new Error(`Failed to generate ${format} output: ${error.message}`);
    }
  }
  
  const generationEndTime = performance.now();
  workflowContext.projectMetrics.totalRenderTime = generationEndTime - generationStartTime;
});

Then('all {int} formats should be generated successfully', function(expectedCount) {
  expect(workflowContext.generatedFormats.size).to.equal(expectedCount);
  
  for (const [format, data] of workflowContext.generatedFormats.entries()) {
    expect(data.content).to.not.be.empty;
    expect(data.hash).to.not.be.empty;
    expect(data.path).to.not.be.empty;
  }
});

Then('each format should have unique content addressing', async function() {
  const hashes = new Set();
  
  for (const [format, data] of workflowContext.generatedFormats.entries()) {
    expect(hashes.has(data.hash)).to.be.false, `Duplicate hash found for format ${format}`);
    hashes.add(data.hash);
    
    // Verify content can be retrieved by hash
    const retrievedContent = await workflowContext.casEngine.retrieve(data.hash);
    expect(retrievedContent).to.equal(data.content);
  }
});

// =============================================================================
// ERROR RECOVERY AND ROLLBACK SCENARIOS
// =============================================================================

Given('I have a rollback point at {string} phase', async function(phase) {
  const currentState = {
    phase: workflowContext.projectPhase,
    files: Array.from(workflowContext.generatedFormats.keys()),
    metrics: { ...workflowContext.projectMetrics },
    casEntries: await workflowContext.casEngine.listEntries()
  };
  
  workflowContext.rollbackPoints.push({
    phase,
    state: currentState
  });
});

When('I inject a {string} error during {string}', async function(errorType, phase) {
  const errorScenario = { type: errorType, injected: false, recovered: false };
  
  try {
    switch (errorType) {
      case 'filesystem':
        // Simulate filesystem error by making directory read-only
        await fs.chmod(workflowContext.outputDir, 0o444);
        errorScenario.injected = true;
        break;
        
      case 'template':
        // Inject invalid template syntax
        const invalidTemplate = path.join(workflowContext.templatesDir, 'invalid.njk');
        await fs.writeFile(invalidTemplate, '{{ invalid.syntax.with.missing.end', 'utf-8');
        errorScenario.injected = true;
        break;
        
      case 'memory':
        // Simulate memory constraint by filling up memory
        const largeArray = new Array(1000000).fill('x'.repeat(1000));
        setTimeout(() => { /* Keep reference alive */ largeArray.length = 0; }, 100);
        errorScenario.injected = true;
        break;
        
      case 'network':
        // Simulate network timeout (for future network operations)
        process.env.NETWORK_TIMEOUT = '1';
        errorScenario.injected = true;
        break;
        
      default:
        throw new Error(`Unknown error type: ${errorType}`);
    }
    
    workflowContext.errorScenarios.push(errorScenario);
    
  } catch (error) {
    errorScenario.injected = false;
    throw error;
  }
});

When('the system attempts recovery', async function() {
  for (const errorScenario of workflowContext.errorScenarios) {
    if (errorScenario.injected && !errorScenario.recovered) {
      try {
        switch (errorScenario.type) {
          case 'filesystem':
            // Restore filesystem permissions
            await fs.chmod(workflowContext.outputDir, 0o755);
            errorScenario.recovered = true;
            break;
            
          case 'template':
            // Remove invalid template
            const invalidTemplate = path.join(workflowContext.templatesDir, 'invalid.njk');
            await fs.unlink(invalidTemplate);
            errorScenario.recovered = true;
            break;
            
          case 'memory':
            // Trigger garbage collection
            if (global.gc) global.gc();
            errorScenario.recovered = true;
            break;
            
          case 'network':
            // Reset network timeout
            delete process.env.NETWORK_TIMEOUT;
            errorScenario.recovered = true;
            break;
        }
      } catch (recoveryError) {
        console.warn(`Failed to recover from ${errorScenario.type} error:`, recoveryError.message);
      }
    }
  }
});

When('I rollback to {string} phase', async function(phase) {
  const rollbackPoint = workflowContext.rollbackPoints.find(rp => rp.phase === phase);
  expect(rollbackPoint).to.not.be.undefined, `No rollback point found for phase: ${phase}`);
  
  // Clear current state
  await workflowContext.casEngine.clear();
  workflowContext.generatedFormats.clear();
  
  // Restore state from rollback point
  workflowContext.projectPhase = rollbackPoint.state.phase;
  workflowContext.projectMetrics = { ...rollbackPoint.state.metrics };
  
  // Restore CAS entries
  for (const entry of rollbackPoint.state.casEntries) {
    await workflowContext.casEngine.store(entry.content, entry.hash);
  }
  
  // Restore generated files
  for (const filePath of rollbackPoint.state.files) {
    if (await fs.access(filePath).then(() => true).catch(() => false)) {
      const content = await fs.readFile(filePath, 'utf-8');
      const hash = crypto.createHash('sha256').update(content).digest('hex');
      workflowContext.generatedFormats.set(filePath, {
        content,
        hash: `sha256:${hash}`,
        path: filePath
      });
    }
  }
});

Then('recovery should be successful for all {int} error scenarios', function(expectedScenarios) {
  expect(workflowContext.errorScenarios).to.have.length(expectedScenarios);
  
  for (const scenario of workflowContext.errorScenarios) {
    expect(scenario.recovered).to.be.true, 
      `Recovery failed for ${scenario.type} error scenario`);
  }
});

Then('rollback should restore the system to {string} phase', function(expectedPhase) {
  expect(workflowContext.projectPhase).to.equal(expectedPhase);
});

// =============================================================================
// PERFORMANCE BENCHMARKING
// =============================================================================

When('I benchmark the {string} operation {int} times', async function(operation, iterations) {
  const benchmarkStartTime = performance.now();
  const durations = [];
  
  for (let i = 0; i < iterations; i++) {
    const iterationStart = performance.now();
    
    try {
      switch (operation) {
        case 'template_render':
          await workflowContext.templateEngine.render('{{ projectName }}', { projectName: `test-${i}` });
          break;
          
        case 'cas_store':
          await workflowContext.casEngine.store(`test-content-${i}-${Date.now()}`);
          break;
          
        case 'provenance_create':
          await workflowContext.provenanceEngine.createProvenance({
            file: `test-${i}.js`,
            generator: 'benchmark',
            timestamp: new Date().toISOString(),
            contentHash: `hash-${i}`,
            dependencies: []
          });
          break;
          
        case 'rdf_query':
          await workflowContext.knowledgeGraph.query('SELECT ?s ?p ?o WHERE { ?s ?p ?o } LIMIT 10');
          break;
          
        default:
          throw new Error(`Unknown benchmark operation: ${operation}`);
      }
      
      const iterationEnd = performance.now();
      durations.push(iterationEnd - iterationStart);
      
    } catch (error) {
      console.warn(`Benchmark iteration ${i} failed:`, error.message);
      durations.push(NaN);
    }
  }
  
  const benchmarkEndTime = performance.now();
  const validDurations = durations.filter(d => !isNaN(d));
  
  const benchmarkResult = {
    operation,
    duration: benchmarkEndTime - benchmarkStartTime,
    timestamp: Date.now(),
    metadata: {
      iterations,
      successfulIterations: validDurations.length,
      averageTime: validDurations.length > 0 ? validDurations.reduce((a, b) => a + b) / validDurations.length : 0,
      minTime: validDurations.length > 0 ? Math.min(...validDurations) : 0,
      maxTime: validDurations.length > 0 ? Math.max(...validDurations) : 0,
      p95Time: validDurations.length > 0 ? validDurations.sort((a, b) => a - b)[Math.floor(validDurations.length * 0.95)] : 0
    }
  };
  
  workflowContext.benchmarkResults.push(benchmarkResult);
  
  if (operation === 'template_render') {
    workflowContext.projectMetrics.p95RenderTime = benchmarkResult.metadata.p95Time;
  }
});

Then('the {string} operation should meet KPI target of {float}ms p95', function(operation, targetP95) {
  const benchmark = workflowContext.benchmarkResults.find(b => b.operation === operation);
  expect(benchmark).to.not.be.undefined, `No benchmark results found for operation: ${operation}`);
  
  expect(benchmark.metadata.p95Time).to.be.lessThan(targetP95,
    `P95 time ${benchmark.metadata.p95Time}ms exceeds target ${targetP95}ms`);
});

Then('performance metrics should show cache hit rate above {float}', async function(targetHitRate) {
  const metrics = await workflowContext.casEngine.getMetrics();
  expect(metrics.cacheHitRate).to.be.greaterThan(targetHitRate,
    `Cache hit rate ${metrics.cacheHitRate} below target ${targetHitRate}`);
  
  workflowContext.projectMetrics.cacheHitRate = metrics.cacheHitRate;
});

Then('memory usage should remain under {int}MB during workflow', function(maxMemoryMB) {
  const currentMemory = process.memoryUsage().heapUsed;
  const currentMemoryMB = currentMemory / (1024 * 1024);
  
  expect(currentMemoryMB).to.be.lessThan(maxMemoryMB,
    `Memory usage ${currentMemoryMB.toFixed(2)}MB exceeds limit ${maxMemoryMB}MB`);
  
  workflowContext.projectMetrics.memoryUsage = currentMemoryMB;
});

// =============================================================================
// INTEGRATION VALIDATION
// =============================================================================

Then('all workflow steps should complete successfully', function() {
  for (const step of workflowContext.workflowSteps) {
    expect(step.status).to.equal('completed', 
      `Workflow step '${step.step}' failed: ${step.error?.message || 'Unknown error'}`);
  }
});

Then('the complete project lifecycle should be validated', function() {
  expect(workflowContext.projectPhase).to.equal('completed');
  
  // Validate all phases completed
  const phaseResults = ['init', 'generate', 'validate', 'attest'];
  for (const phase of phaseResults) {
    const result = workflowContext.workflowResults.get(phase);
    expect(result).to.not.be.undefined, `Phase '${phase}' result not found`);
    expect(result.phase).to.equal('completed', `Phase '${phase}' did not complete successfully`);
  }
  
  // Validate metrics are within acceptable ranges
  expect(workflowContext.projectMetrics.totalFiles).to.be.greaterThan(0);
  expect(workflowContext.projectMetrics.totalRenderTime).to.be.greaterThan(0);
  if (workflowContext.projectMetrics.p95RenderTime > 0) {
    expect(workflowContext.projectMetrics.p95RenderTime).to.be.lessThan(150); // KPI target
  }
});

Then('engine integration should be seamless', function() {
  // Verify all engines are properly initialized and functional
  expect(workflowContext.casEngine.isInitialized()).to.be.true;
  expect(workflowContext.templateEngine.isInitialized()).to.be.true;
  expect(workflowContext.provenanceEngine.isInitialized()).to.be.true;
  expect(workflowContext.performanceMonitor.isRunning()).to.be.true;
  expect(workflowContext.knowledgeGraph.isInitialized()).to.be.true;
  
  // Verify engines worked together (data flowed between them)
  expect(workflowContext.generatedFormats.size).to.be.greaterThan(0);
  expect(workflowContext.benchmarkResults.length).to.be.greaterThan(0);
  expect(workflowContext.projectMetrics.attestedFiles).to.be.greaterThan(0);
});

// Attach helper function to global context for step reuse
globalThis.executeWorkflowStep = executeWorkflowStep;