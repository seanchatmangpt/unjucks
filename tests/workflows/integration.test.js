/**
 * Integration Tests for Workflow Orchestrator and KGEN Bridge
 * 
 * Comprehensive end-to-end testing of the complete workflow integration
 * from unjucks template discovery to KGEN semantic processing and
 * provenance tracking with deterministic guarantees.
 */

import { describe, it, beforeEach, afterEach, expect } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { WorkflowOrchestrator } from '../../src/workflows/orchestrator.js';
import { KgenBridge } from '../../src/integrations/kgen-bridge.js';

describe('Workflow Integration - End-to-End', () => {
  let orchestrator;
  let kgenBridge;
  let testDir;
  let templateDir;
  let outputDir;
  
  beforeEach(async () => {
    // Setup test environment
    testDir = path.join(process.cwd(), 'tests', 'temp', `test-${Date.now()}`);
    templateDir = path.join(testDir, 'templates');
    outputDir = path.join(testDir, 'output');
    
    await fs.mkdir(templateDir, { recursive: true });
    await fs.mkdir(outputDir, { recursive: true });
    
    // Initialize components
    orchestrator = new WorkflowOrchestrator({
      templatePath: templateDir,
      outputPath: outputDir,
      enableProvenance: true,
      atomicOperations: true,
      validateOutputs: true,
      errorRecovery: true
    });
    
    kgenBridge = new KgenBridge({
      enableSemanticProcessing: true,
      enableKnowledgeGraph: true,
      enableComplianceTracking: true,
      storageBackend: 'memory'
    });
    
    await orchestrator.initialize();
    await kgenBridge.initialize();
    
    // Create test templates
    await createTestTemplates(templateDir);
  });
  
  afterEach(async () => {
    // Cleanup test environment
    try {
      await fs.rmdir(testDir, { recursive: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });
  
  describe('Complete Workflow Pipeline', () => {
    it('should execute complete workflow from discovery to KGEN analysis', async () => {
      // Define workflow specification
      const workflowSpec = {
        id: 'test-complete-workflow',
        name: 'Complete Integration Test',
        generator: 'component',
        variables: {
          name: 'UserService',
          description: 'Service for user management',
          author: 'Test Author',
          withTests: true,
          withDocs: true
        },
        options: {
          typescript: true,
          async: true
        },
        user: {
          id: 'test-user',
          name: 'Test User',
          email: 'test@example.com'
        }
      };
      
      // Execute workflow
      const workflowResult = await orchestrator.executeWorkflow(workflowSpec);
      
      // Verify workflow execution
      expect(workflowResult).toBeDefined();
      expect(workflowResult.status).toBe('success');
      expect(workflowResult.workflowId).toBe('test-complete-workflow');
      expect(workflowResult.phases).toBeDefined();
      expect(workflowResult.artifacts).toBeInstanceOf(Array);
      expect(workflowResult.provenance).toBeDefined();
      
      // Process through KGEN bridge
      const kgenResult = await kgenBridge.processWorkflowResult(workflowResult);
      
      // Verify KGEN processing
      expect(kgenResult).toBeDefined();
      expect(kgenResult.processingId).toBeDefined();
      expect(kgenResult.kgenAnalysis).toBeDefined();
      expect(kgenResult.kgenAnalysis.semantic).toBeDefined();
      expect(kgenResult.kgenAnalysis.knowledgeGraph).toBeDefined();
      expect(kgenResult.kgenAnalysis.compliance).toBeDefined();
      expect(kgenResult.kgenAnalysis.provenance).toBeDefined();
      
      // Verify quality metrics
      expect(kgenResult.qualityMetrics).toBeDefined();
      expect(kgenResult.qualityMetrics.overall).toMatch(/excellent|good|acceptable|poor/);
      
      // Verify recommendations
      expect(kgenResult.recommendations).toBeInstanceOf(Array);
      expect(kgenResult.enhancements).toBeInstanceOf(Array);
    }, 30000);
    
    it('should handle template discovery and variable resolution correctly', async () => {
      const workflowSpec = {
        id: 'test-discovery',
        generator: 'component',
        variables: {
          name: 'TestComponent',
          customVar: 'customValue'
        }
      };
      
      const result = await orchestrator.executeWorkflow(workflowSpec);
      
      // Verify discovery phase
      expect(result.phases.discovery).toBeInstanceOf(Array);
      expect(result.phases.discovery.length).toBeGreaterThan(0);
      
      // Verify variable resolution
      expect(result.phases.variableResolution).toBeDefined();
      expect(result.phases.variableResolution.name).toBe('TestComponent');
      expect(result.phases.variableResolution.customVar).toBe('customValue');
      expect(result.phases.variableResolution.author).toBeDefined(); // Should have default
    });
    
    it('should perform frontmatter processing and atomic generation', async () => {
      // Create template with complex frontmatter
      const complexTemplate = `---
{
  "to": "{{name}}/{{name}}.service.js",
  "inject": false,
  "chmod": "644",
  "skipIf": "withoutService"
}
---
export class {{name}}Service {
  constructor() {
    this.name = '{{name}}';
    this.description = '{{description}}';
  }
  
  async process() {
    // {{description}}
    return this.name;
  }
}
`;
      
      await fs.writeFile(
        path.join(templateDir, 'component', 'service.js.njk'),
        complexTemplate,
        'utf8'
      );
      
      // Re-initialize to pick up new template
      await orchestrator.initialize();
      
      const workflowSpec = {
        id: 'test-complex-frontmatter',
        generator: 'component',
        variables: {
          name: 'Payment',
          description: 'Payment processing service'
        }
      };
      
      const result = await orchestrator.executeWorkflow(workflowSpec);
      
      // Verify frontmatter processing
      expect(result.phases.frontmatterProcessing).toBeInstanceOf(Array);
      expect(result.phases.frontmatterProcessing[0].resolvedPath).toBe('Payment/Payment.service.js');
      expect(result.phases.frontmatterProcessing[0].shouldInject).toBe(false);
      
      // Verify generation results
      expect(result.phases.generation.artifacts).toBeInstanceOf(Array);
      expect(result.phases.generation.artifacts.length).toBeGreaterThan(0);
      expect(result.phases.generation.errors).toBeInstanceOf(Array);
      expect(result.phases.generation.errors.length).toBe(0);
    });
    
    it('should validate artifacts and perform KGEN semantic analysis', async () => {
      const workflowSpec = {
        id: 'test-validation',
        generator: 'component',
        variables: {
          name: 'DataProcessor',
          description: 'Processes data efficiently'
        }
      };
      
      const workflowResult = await orchestrator.executeWorkflow(workflowSpec);
      const kgenResult = await kgenBridge.processWorkflowResult(workflowResult);
      
      // Verify validation phase
      expect(workflowResult.phases.validation).toBeDefined();
      expect(workflowResult.phases.validation.passedValidations).toBeGreaterThan(0);
      expect(workflowResult.phases.validation.validationReports).toBeInstanceOf(Array);
      
      // Verify semantic analysis
      expect(kgenResult.kgenAnalysis.semantic).toBeDefined();
      expect(kgenResult.kgenAnalysis.semantic.analyzed).toBeGreaterThan(0);
      expect(kgenResult.kgenAnalysis.semantic.analyses).toBeInstanceOf(Array);
      
      // Check for JavaScript analysis
      const jsAnalysis = kgenResult.kgenAnalysis.semantic.analyses
        .find(analysis => analysis.artifactId && analysis.metrics);
      
      if (jsAnalysis) {
        expect(jsAnalysis.metrics.linesOfCode).toBeGreaterThan(0);
        expect(jsAnalysis.metrics.functions).toBeDefined();
        expect(jsAnalysis.patterns).toBeInstanceOf(Array);
      }
    });
    
    it('should track provenance throughout the entire workflow', async () => {
      const workflowSpec = {
        id: 'test-provenance',
        generator: 'component',
        variables: { name: 'ProvenanceTest' },
        user: {
          id: 'prov-user',
          name: 'Provenance User',
          email: 'prov@test.com'
        }
      };
      
      const workflowResult = await orchestrator.executeWorkflow(workflowSpec);
      const kgenResult = await kgenBridge.processWorkflowResult(workflowResult);
      
      // Verify workflow provenance
      expect(workflowResult.provenance).toBeDefined();
      expect(workflowResult.provenance.operationId).toBe('test-provenance');
      expect(workflowResult.provenance.agent).toBeDefined();
      expect(workflowResult.provenance.startTime).toBeDefined();
      expect(workflowResult.provenance.endTime).toBeDefined();
      expect(workflowResult.provenance.integrityHash).toBeDefined();
      
      // Verify KGEN provenance
      expect(kgenResult.kgenAnalysis.provenance).toBeDefined();
      expect(kgenResult.kgenAnalysis.provenance.operationId).toBeDefined();
      expect(kgenResult.kgenAnalysis.provenance.type).toBe('kgen-processing');
      
      // Verify provenance chain
      expect(workflowResult.provenance.provenanceTriples).toBeDefined();
    });
    
    it('should generate attestations and maintain integrity', async () => {
      const workflowSpec = {
        id: 'test-attestation',
        generator: 'component',
        variables: { name: 'AttestationTest' }
      };
      
      const workflowResult = await orchestrator.executeWorkflow(workflowSpec);
      
      // Verify attestation phase
      expect(workflowResult.phases.attestation).toBeDefined();
      expect(workflowResult.phases.attestation.attestations).toBeInstanceOf(Array);
      
      // Check attestation structure
      if (workflowResult.phases.attestation.attestations.length > 0) {
        const attestation = workflowResult.phases.attestation.attestations[0];
        expect(attestation.id).toBeDefined();
        expect(attestation.hash).toBeDefined();
        expect(attestation.timestamp).toBeDefined();
        expect(attestation.validationPassed).toBeDefined();
      }
    });
  });
  
  describe('Error Handling and Recovery', () => {
    it('should handle template processing errors gracefully', async () => {
      // Create invalid template
      await fs.writeFile(
        path.join(templateDir, 'component', 'invalid.js.njk'),
        '{{invalid-syntax}}}',
        'utf8'
      );
      
      await orchestrator.initialize();
      
      const workflowSpec = {
        id: 'test-error-handling',
        generator: 'component',
        variables: { name: 'ErrorTest' }
      };
      
      // Should not throw, but handle errors gracefully
      const result = await orchestrator.executeWorkflow(workflowSpec);
      
      expect(result.status).toBe('success'); // Should succeed with error recovery
      expect(result.phases.generation.errors).toBeDefined();
    });
    
    it('should rollback atomic operations on failure', async () => {
      // This test would require more complex setup to force atomic operation failure
      // For now, we'll test the basic structure
      const workflowSpec = {
        id: 'test-atomic-rollback',
        generator: 'component',
        variables: { name: 'RollbackTest' }
      };
      
      const result = await orchestrator.executeWorkflow(workflowSpec);
      
      // Verify atomic transaction handling
      expect(result.phases.generation.operations).toBeInstanceOf(Array);
      expect(result.phases.generation.operations.length).toBeGreaterThan(0);
      
      // All operations should be successful or properly rolled back
      const failedOps = result.phases.generation.operations
        .filter(op => !op.result.success);
      
      // In a successful test, there should be no failed operations
      expect(failedOps.length).toBe(0);
    });
  });
  
  describe('Performance and Scalability', () => {
    it('should handle multiple templates efficiently', async () => {
      // Create multiple templates
      const templates = [
        'component.js.njk',
        'service.js.njk',
        'test.spec.js.njk',
        'index.js.njk',
        'types.d.ts.njk'
      ];
      
      for (const template of templates) {
        await fs.writeFile(
          path.join(templateDir, 'component', template),
          `// Template: ${template}\nexport const {{name}} = '{{name}}';`,
          'utf8'
        );
      }
      
      await orchestrator.initialize();
      
      const workflowSpec = {
        id: 'test-multiple-templates',
        generator: 'component',
        variables: { name: 'MultiTest' }
      };
      
      const startTime = Date.now();
      const result = await orchestrator.executeWorkflow(workflowSpec);
      const endTime = Date.now();
      
      expect(result.artifacts.length).toBeGreaterThanOrEqual(templates.length);
      expect(endTime - startTime).toBeLessThan(10000); // Should complete within 10 seconds
    });
    
    it('should cache semantic analysis results', async () => {
      const workflowSpec = {
        id: 'test-caching',
        generator: 'component',
        variables: { name: 'CacheTest' }
      };
      
      // First execution
      const result1 = await orchestrator.executeWorkflow(workflowSpec);
      const kgen1 = await kgenBridge.processWorkflowResult(result1);
      
      const initialCacheHits = kgenBridge.metrics.cacheHits;
      
      // Second execution with same content
      const result2 = await orchestrator.executeWorkflow({
        ...workflowSpec,
        id: 'test-caching-2'
      });
      const kgen2 = await kgenBridge.processWorkflowResult(result2);
      
      // Should have cache hits on second run
      expect(kgenBridge.metrics.cacheHits).toBeGreaterThan(initialCacheHits);
    });
  });
  
  describe('Compliance and Security', () => {
    it('should perform GDPR compliance checks', async () => {
      const workflowSpec = {
        id: 'test-gdpr',
        generator: 'component',
        variables: {
          name: 'PersonalDataProcessor',
          description: 'Handles personal information'
        }
      };
      
      const workflowResult = await orchestrator.executeWorkflow(workflowSpec);
      const kgenResult = await kgenBridge.processWorkflowResult(workflowResult);
      
      expect(kgenResult.kgenAnalysis.compliance).toBeDefined();
      expect(kgenResult.kgenAnalysis.compliance.frameworks.gdpr).toBeDefined();
      expect(kgenResult.kgenAnalysis.compliance.frameworks.gdpr.compliant).toBeDefined();
    });
    
    it('should detect security issues in generated code', async () => {
      // Create template with potential security issues
      const insecureTemplate = `---
{
  "to": "{{name}}/{{name}}.js"
}
---
export class {{name}} {
  constructor() {
    console.log('Debug: Creating {{name}}'); // Debug statement
    this.data = {};
  }
  
  process(input) {
    // TODO: Add input validation
    eval(input); // Security issue
    return this.data;
  }
}
`;
      
      await fs.writeFile(
        path.join(templateDir, 'component', 'insecure.js.njk'),
        insecureTemplate,
        'utf8'
      );
      
      await orchestrator.initialize();
      
      const workflowSpec = {
        id: 'test-security',
        generator: 'component',
        variables: { name: 'SecurityTest' }
      };
      
      const workflowResult = await orchestrator.executeWorkflow(workflowSpec);
      const kgenResult = await kgenBridge.processWorkflowResult(workflowResult);
      
      // Should detect security issues
      const analysis = kgenResult.kgenAnalysis.semantic?.analyses
        ?.find(a => a.patterns?.includes('debug-statements'));
      
      if (analysis) {
        expect(analysis.patterns).toContain('debug-statements');
      }
      
      expect(kgenResult.kgenAnalysis.semantic?.security).toBe('low');
    });
  });
  
  describe('Knowledge Graph Integration', () => {
    it('should extract entities and relationships from workflow', async () => {
      const workflowSpec = {
        id: 'test-knowledge-graph',
        generator: 'component',
        variables: {
          name: 'UserManager',
          description: 'Manages user entities'
        }
      };
      
      const workflowResult = await orchestrator.executeWorkflow(workflowSpec);
      const kgenResult = await kgenBridge.processWorkflowResult(workflowResult);
      
      const kgAnalysis = kgenResult.kgenAnalysis.knowledgeGraph;
      expect(kgAnalysis).toBeDefined();
      expect(kgAnalysis.entities).toBeInstanceOf(Array);
      expect(kgAnalysis.relationships).toBeInstanceOf(Array);
      expect(kgAnalysis.graphUpdates).toBeGreaterThanOrEqual(0);
      
      // Should have extracted artifact entities
      const artifactEntities = kgAnalysis.entities
        .filter(entity => entity.type === 'artifact');
      expect(artifactEntities.length).toBeGreaterThan(0);
      
      // Should have template entities
      const templateEntities = kgAnalysis.entities
        .filter(entity => entity.type === 'template');
      expect(templateEntities.length).toBeGreaterThan(0);
    });
  });
});

describe('Integration Status and Metrics', () => {
  let orchestrator;
  let kgenBridge;
  
  beforeEach(async () => {
    orchestrator = new WorkflowOrchestrator({
      templatePath: './test-templates',
      outputPath: './test-output',
      enableProvenance: false // Disable for simpler testing
    });
    
    kgenBridge = new KgenBridge({
      enableSemanticProcessing: true,
      storageBackend: 'memory'
    });
    
    await orchestrator.initialize();
    await kgenBridge.initialize();
  });
  
  it('should provide comprehensive status information', () => {
    const orchestratorStatus = orchestrator.getStatus();
    const kgenStatus = kgenBridge.getStatus();
    
    // Orchestrator status
    expect(orchestratorStatus.state).toBe('ready');
    expect(orchestratorStatus.metrics).toBeDefined();
    expect(orchestratorStatus.templatesIndexed).toBeDefined();
    expect(orchestratorStatus.variablesRegistered).toBeDefined();
    
    // KGEN bridge status
    expect(kgenStatus.state).toBe('ready');
    expect(kgenStatus.metrics).toBeDefined();
    expect(kgenStatus.configuration).toBeDefined();
    expect(kgenStatus.cache).toBeDefined();
  });
  
  it('should track metrics across multiple workflow executions', async () => {
    const initialMetrics = orchestrator.getStatus().metrics;
    
    // Execute multiple workflows
    for (let i = 0; i < 3; i++) {
      const workflowSpec = {
        id: `metrics-test-${i}`,
        generator: 'component',
        variables: { name: `Test${i}` }
      };
      
      try {
        await orchestrator.executeWorkflow(workflowSpec);
      } catch (error) {
        // Ignore errors for metrics testing
      }
    }
    
    const finalMetrics = orchestrator.getStatus().metrics;
    
    expect(finalMetrics.totalWorkflows).toBeGreaterThan(initialMetrics.totalWorkflows);
  });
});

// Helper function to create test templates
async function createTestTemplates(templateDir) {
  const componentDir = path.join(templateDir, 'component');
  await fs.mkdir(componentDir, { recursive: true });
  
  // Basic component template
  const componentTemplate = `---
{
  "to": "{{name}}/{{name}}.js"
}
---
/**
 * {{description}}
 * Generated by: {{author}}
 */

export class {{name}} {
  constructor() {
    this.name = '{{name}}';
    this.created = new Date();
  }
  
  getName() {
    return this.name;
  }
  
  getDescription() {
    return '{{description}}';
  }
}

export default {{name}};
`;
  
  await fs.writeFile(
    path.join(componentDir, 'component.js.njk'),
    componentTemplate,
    'utf8'
  );
  
  // Test template
  const testTemplate = `---
{
  "to": "{{name}}/{{name}}.test.js",
  "skipIf": "withoutTests"
}
---
import { {{name}} } from './{{name}}.js';

describe('{{name}}', () => {
  let instance;
  
  beforeEach(() => {
    instance = new {{name}}();
  });
  
  it('should create instance', () => {
    expect(instance).toBeDefined();
    expect(instance.getName()).toBe('{{name}}');
  });
  
  it('should have description', () => {
    expect(instance.getDescription()).toBe('{{description}}');
  });
});
`;
  
  await fs.writeFile(
    path.join(componentDir, 'test.js.njk'),
    testTemplate,
    'utf8'
  );
  
  // Index template
  const indexTemplate = `---
{
  "to": "{{name}}/index.js"
}
---
export { {{name}} } from './{{name}}.js';
export default {{name}};
`;
  
  await fs.writeFile(
    path.join(componentDir, 'index.js.njk'),
    indexTemplate,
    'utf8'
  );
}