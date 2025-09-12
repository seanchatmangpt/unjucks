/**
 * Complete End-to-End Workflow Integration Tests
 * Tests the full generate → validate → attest workflow
 */

import { jest } from '@jest/globals';
import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';
import { execSync, spawn } from 'child_process';
import { promisify } from 'util';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../../../');
const testDataDir = path.join(__dirname, '../fixtures');
const tempDir = path.join(__dirname, '../temp/workflow-tests');

describe('Complete Workflow Integration Tests', () => {
  let testResults = {
    workflowSteps: [],
    errors: [],
    artifacts: [],
    dataFlow: {},
    performance: {}
  };

  beforeAll(async () => {
    // Setup test environment
    await fs.ensureDir(tempDir);
    await fs.ensureDir(testDataDir);
    
    // Create test RDF graph
    await setupTestGraph();
    await setupTestTemplates();
  });

  afterAll(async () => {
    // Cleanup and save results for analysis
    await fs.writeJson(
      path.join(__dirname, '../results/workflow-integration-results.json'), 
      testResults,
      { spaces: 2 }
    );
    await fs.remove(tempDir);
  });

  describe('End-to-End Workflow: Generate → Validate → Attest', () => {
    const workflowId = `workflow-${this.getDeterministicTimestamp()}`;
    let graphFile, templateFile, outputDir;

    beforeEach(() => {
      graphFile = path.join(testDataDir, 'test-graph.ttl');
      templateFile = path.join(testDataDir, 'test-template.njk');
      outputDir = path.join(tempDir, workflowId);
    });

    test('Complete workflow executes successfully', async () => {
      const startTime = this.getDeterministicTimestamp();
      const workflowSteps = [];
      let currentStep = null;

      try {
        // Step 1: Generate artifact from graph
        currentStep = 'generate';
        workflowSteps.push({ step: currentStep, startTime: this.getDeterministicTimestamp() });
        
        const generateResult = await executeKGenCommand([
          'artifact', 'generate',
          '--graph', graphFile,
          '--template', 'test-template',
          '--output', outputDir
        ]);

        workflowSteps[workflowSteps.length - 1].result = generateResult;
        workflowSteps[workflowSteps.length - 1].endTime = this.getDeterministicTimestamp();

        expect(generateResult.success).toBe(true);
        expect(generateResult.outputPath).toBeDefined();
        expect(fs.existsSync(generateResult.outputPath)).toBe(true);

        // Verify artifact content
        const artifactContent = await fs.readFile(generateResult.outputPath, 'utf8');
        expect(artifactContent.length).toBeGreaterThan(0);

        // Step 2: Validate the generated artifact
        currentStep = 'validate';
        workflowSteps.push({ step: currentStep, startTime: this.getDeterministicTimestamp() });

        const validateResult = await executeKGenCommand([
          'validate', 'artifacts',
          '--path', generateResult.outputPath,
          '--recursive'
        ]);

        workflowSteps[workflowSteps.length - 1].result = validateResult;
        workflowSteps[workflowSteps.length - 1].endTime = this.getDeterministicTimestamp();

        expect(validateResult.success).toBe(true);

        // Step 3: Create attestation
        currentStep = 'attest';
        workflowSteps.push({ step: currentStep, startTime: this.getDeterministicTimestamp() });

        const attestResult = await executeKGenCommand([
          'project', 'attest',
          '--directory', outputDir
        ]);

        workflowSteps[workflowSteps.length - 1].result = attestResult;
        workflowSteps[workflowSteps.length - 1].endTime = this.getDeterministicTimestamp();

        expect(attestResult.success).toBe(true);
        expect(attestResult.attestationPath).toBeDefined();
        expect(fs.existsSync(attestResult.attestationPath)).toBe(true);

        // Verify attestation content
        const attestationContent = await fs.readJson(attestResult.attestationPath);
        expect(attestationContent.project).toBeDefined();
        expect(attestationContent.attestation).toBeDefined();
        expect(attestationContent.artifacts).toBeDefined();

        // Step 4: Verify reproducibility
        currentStep = 'verify';
        workflowSteps.push({ step: currentStep, startTime: this.getDeterministicTimestamp() });

        const verifyResult = await executeKGenCommand([
          'deterministic', 'verify',
          '--artifact', generateResult.outputPath,
          '--iterations', '3'
        ]);

        workflowSteps[workflowSteps.length - 1].result = verifyResult;
        workflowSteps[workflowSteps.length - 1].endTime = this.getDeterministicTimestamp();

        expect(verifyResult.success).toBe(true);
        expect(verifyResult.verified).toBe(true);

        // Record successful workflow
        const totalTime = this.getDeterministicTimestamp() - startTime;
        testResults.workflowSteps.push({
          workflowId,
          steps: workflowSteps,
          totalTime,
          success: true
        });

      } catch (error) {
        testResults.errors.push({
          workflowId,
          step: currentStep,
          error: error.message,
          stack: error.stack,
          workflowSteps
        });
        throw error;
      }
    }, 60000); // 60 second timeout

    test('Workflow handles invalid inputs gracefully', async () => {
      // Test with invalid graph file
      const invalidResult = await executeKGenCommand([
        'artifact', 'generate',
        '--graph', 'non-existent-file.ttl',
        '--template', 'test-template',
        '--output', outputDir
      ]);

      expect(invalidResult.success).toBe(false);
      expect(invalidResult.error).toContain('not found');

      testResults.workflowSteps.push({
        workflowId: `${workflowId}-invalid`,
        type: 'error-handling',
        result: invalidResult,
        success: false
      });
    });

    test('Workflow maintains data consistency across steps', async () => {
      // Generate multiple artifacts from same graph
      const artifacts = [];
      
      for (let i = 0; i < 3; i++) {
        const result = await executeKGenCommand([
          'artifact', 'generate',
          '--graph', graphFile,
          '--template', 'test-template',
          '--output', path.join(outputDir, `artifact-${i}`)
        ]);

        if (result.success) {
          artifacts.push(result);
        }
      }

      expect(artifacts.length).toBe(3);

      // Verify all artifacts have same content hash (deterministic)
      const contentHashes = artifacts.map(a => a.contentHash);
      expect(new Set(contentHashes).size).toBe(1);

      testResults.dataFlow.deterministic = {
        artifacts: artifacts.length,
        uniqueHashes: new Set(contentHashes).size,
        consistent: new Set(contentHashes).size === 1
      };
    });
  });

  describe('Module Interdependency Tests', () => {
    test('Graph processing integrates with template rendering', async () => {
      // Test the data flow from graph processing to template rendering
      const graphHashResult = await executeKGenCommand([
        'graph', 'hash', graphFile
      ]);

      expect(graphHashResult.success).toBe(true);
      expect(graphHashResult.hash).toBeDefined();

      const graphIndexResult = await executeKGenCommand([
        'graph', 'index', graphFile
      ]);

      expect(graphIndexResult.success).toBe(true);
      expect(graphIndexResult.triples).toBeGreaterThan(0);

      // Verify template rendering can access graph data
      const renderResult = await executeKGenCommand([
        'deterministic', 'render',
        '--template', templateFile,
        '--context', JSON.stringify({
          graph: {
            hash: graphHashResult.hash,
            triples: graphIndexResult.triples
          }
        }),
        '--output', path.join(tempDir, 'rendered-output.txt')
      ]);

      expect(renderResult.success).toBe(true);

      testResults.dataFlow.graphToTemplate = {
        graphHash: graphHashResult.hash,
        triples: graphIndexResult.triples,
        renderSuccess: renderResult.success
      };
    });

    test('Attestation system integrates with artifact generation', async () => {
      // Generate artifact
      const generateResult = await executeKGenCommand([
        'artifact', 'generate',
        '--graph', graphFile,
        '--template', 'test-template',
        '--output', path.join(tempDir, 'attestation-test')
      ]);

      expect(generateResult.success).toBe(true);

      // Check that attestation file was created
      const attestationPath = `${generateResult.outputPath}.attest.json`;
      expect(fs.existsSync(attestationPath)).toBe(true);

      const attestation = await fs.readJson(attestationPath);
      expect(attestation.generation).toBeDefined();
      expect(attestation.verification).toBeDefined();
      expect(attestation.generation.contentHash).toBe(generateResult.contentHash);

      testResults.dataFlow.artifactToAttestation = {
        artifactPath: generateResult.outputPath,
        attestationPath,
        contentHashMatch: attestation.generation.contentHash === generateResult.contentHash
      };
    });

    test('Drift detection integrates with baseline state', async () => {
      const testDir = path.join(tempDir, 'drift-test');
      await fs.ensureDir(testDir);

      // Create initial state
      const lockResult = await executeKGenCommand([
        'project', 'lock',
        '--directory', testDir
      ]);

      expect(lockResult.success).toBe(true);

      // Generate some artifacts
      await executeKGenCommand([
        'artifact', 'generate',
        '--graph', graphFile,
        '--template', 'test-template',
        '--output', path.join(testDir, 'test-artifact')
      ]);

      // Check for drift
      const driftResult = await executeKGenCommand([
        'drift', 'detect',
        '--directory', testDir
      ]);

      // Should not detect drift immediately after generation
      expect(driftResult.success).toBe(true);

      testResults.dataFlow.driftDetection = {
        lockCreated: lockResult.success,
        driftDetected: driftResult.driftDetected,
        baselineExists: fs.existsSync(path.join(testDir, 'kgen.lock.json'))
      };
    });
  });

  describe('Error Propagation Tests', () => {
    test('Template errors propagate correctly', async () => {
      // Create invalid template
      const invalidTemplate = path.join(testDataDir, 'invalid-template.njk');
      await fs.writeFile(invalidTemplate, '{{ invalid.syntax }}');

      const result = await executeKGenCommand([
        'deterministic', 'validate',
        '--template', invalidTemplate
      ]);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();

      testResults.errors.push({
        type: 'template-validation',
        error: result.error,
        propagatedCorrectly: true
      });
    });

    test('Graph processing errors are handled', async () => {
      // Create invalid RDF
      const invalidRDF = path.join(testDataDir, 'invalid.ttl');
      await fs.writeFile(invalidRDF, 'invalid rdf syntax here');

      const result = await executeKGenCommand([
        'graph', 'index', invalidRDF
      ]);

      // Should handle error gracefully
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();

      testResults.errors.push({
        type: 'graph-processing',
        error: result.error,
        handledGracefully: result.success === false
      });
    });
  });

  describe('Complex Scenarios', () => {
    test('Large graph processing performance', async () => {
      // Create larger test graph
      const largeGraph = await createLargeTestGraph();
      const startTime = this.getDeterministicTimestamp();

      const indexResult = await executeKGenCommand([
        'graph', 'index', largeGraph
      ]);

      const processingTime = this.getDeterministicTimestamp() - startTime;

      expect(indexResult.success).toBe(true);
      expect(processingTime).toBeLessThan(30000); // Should complete in 30 seconds

      testResults.performance.largeGraphProcessing = {
        triples: indexResult.triples,
        processingTime,
        performanceAcceptable: processingTime < 30000
      };
    });

    test('Multiple concurrent operations', async () => {
      const concurrentOps = [];

      // Start multiple operations simultaneously
      for (let i = 0; i < 5; i++) {
        concurrentOps.push(
          executeKGenCommand([
            'artifact', 'generate',
            '--graph', graphFile,
            '--template', 'test-template',
            '--output', path.join(tempDir, `concurrent-${i}`)
          ])
        );
      }

      const results = await Promise.all(concurrentOps);
      const successCount = results.filter(r => r.success).length;

      expect(successCount).toBe(5);

      testResults.performance.concurrentOperations = {
        operations: 5,
        successful: successCount,
        allSuccessful: successCount === 5
      };
    });
  });
});

// Helper functions

async function setupTestGraph() {
  const graphContent = `
@prefix ex: <http://example.org/> .
@prefix prov: <http://www.w3.org/ns/prov#> .
@prefix dc: <http://purl.org/dc/terms/> .

ex:dataset1 a ex:Dataset ;
  dc:title "Test Dataset" ;
  prov:wasGeneratedBy ex:activity1 ;
  prov:generatedAtTime "2024-01-01T00:00:00Z" .

ex:activity1 a prov:Activity ;
  prov:wasAssociatedWith ex:agent1 ;
  prov:startedAtTime "2024-01-01T00:00:00Z" .

ex:agent1 a prov:Agent ;
  ex:name "Test Agent" .

ex:dataset2 prov:wasDerivedFrom ex:dataset1 ;
  prov:wasGeneratedBy ex:activity2 .

ex:activity2 a prov:Activity ;
  prov:wasAssociatedWith ex:agent1 ;
  prov:used ex:dataset1 .
  `;

  await fs.writeFile(path.join(testDataDir, 'test-graph.ttl'), graphContent);
}

async function setupTestTemplates() {
  const templateContent = `
# Generated from graph: {{ graph.path }}
# Content hash: {{ graph.hash }}
# Triples: {{ graph.triples }}

Dataset Information:
{% if graph.semanticData %}
- Languages: {{ graph.semanticData.languages | join(', ') }}
- Datatypes: {{ graph.semanticData.datatypes | join(', ') }}
- Literals: {{ graph.semanticData.literals }}
- URIs: {{ graph.semanticData.uris }}
{% endif %}

Generated at: {{ timestamp }}
  `;

  await fs.writeFile(path.join(testDataDir, 'test-template.njk'), templateContent);

  // Create template directory structure
  const templatesDir = path.join(rootDir, '_templates');
  await fs.ensureDir(templatesDir);
  await fs.writeFile(
    path.join(templatesDir, 'test-template.njk'), 
    templateContent
  );
}

async function createLargeTestGraph() {
  const largeGraphPath = path.join(testDataDir, 'large-graph.ttl');
  let content = '@prefix ex: <http://example.org/> .\n@prefix prov: <http://www.w3.org/ns/prov#> .\n\n';

  // Generate 1000 triples
  for (let i = 0; i < 1000; i++) {
    content += `ex:entity${i} a ex:Entity ;\n`;
    content += `  ex:id ${i} ;\n`;
    content += `  ex:value "value-${i}" .\n\n`;
  }

  await fs.writeFile(largeGraphPath, content);
  return largeGraphPath;
}

async function executeKGenCommand(args) {
  return new Promise((resolve) => {
    const kgenPath = path.join(rootDir, 'bin/kgen.mjs');
    const child = spawn('node', [kgenPath, ...args], {
      stdio: 'pipe',
      cwd: rootDir
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      try {
        // Try to parse JSON output
        if (stdout.trim()) {
          const result = JSON.parse(stdout.trim());
          resolve(result);
        } else {
          resolve({
            success: code === 0,
            error: stderr || `Process exited with code ${code}`,
            stdout,
            stderr
          });
        }
      } catch (error) {
        resolve({
          success: false,
          error: `Failed to parse output: ${error.message}`,
          stdout,
          stderr
        });
      }
    });

    // Timeout after 30 seconds
    setTimeout(() => {
      child.kill();
      resolve({
        success: false,
        error: 'Command timeout',
        timeout: true
      });
    }, 30000);
  });
}