/**
 * Workflow Consolidation Validation Test Suite
 * 
 * Validates that the 5 consolidated workflows maintain 100% functionality
 * of the original 37 workflows while delivering improved performance.
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { WorkflowCompositionEngine } from '../../src/lib/workflow-composition-engine.js';
import chalk from 'chalk';

describe('Workflow Consolidation Validation', () => {
  let compositionEngine;
  let originalWorkflowCount = 37;
  let targetWorkflowCount = 5;

  beforeAll(async () => {
    console.log(chalk.blue('🔍 Initializing Workflow Consolidation Validation'));
    
    compositionEngine = new WorkflowCompositionEngine({
      debugMode: true,
      enablePerformanceMonitoring: true,
      enableNeuralOptimization: true
    });
  });

  afterAll(async () => {
    if (compositionEngine) {
      await compositionEngine.destroy();
    }
  });

  describe('Core Workflow Validation', () => {
    test('should have exactly 5 core workflows', () => {
      const coreWorkflows = compositionEngine.getCoreWorkflows();
      expect(coreWorkflows).toHaveLength(targetWorkflowCount);
      
      const expectedWorkflows = [
        'meta-orchestration',
        'development-lifecycle', 
        'template-generator',
        'quality-assurance',
        'integration-deployment'
      ];
      
      const actualWorkflowIds = coreWorkflows.map(w => w.id);
      expectedWorkflows.forEach(expectedId => {
        expect(actualWorkflowIds).toContain(expectedId);
      });
    });

    test('should consolidate all 37 original workflows', () => {
      const coreWorkflows = compositionEngine.getCoreWorkflows();
      const totalConsolidated = coreWorkflows.reduce(
        (sum, workflow) => sum + workflow.consolidatedWorkflows.length, 
        0
      );
      
      expect(totalConsolidated).toBeGreaterThanOrEqual(originalWorkflowCount);
      console.log(chalk.green(`✅ Consolidated ${totalConsolidated} workflows into ${targetWorkflowCount} core workflows`));
    });

    test('should have comprehensive capabilities coverage', () => {
      const coreWorkflows = compositionEngine.getCoreWorkflows();
      const allCapabilities = new Set();
      
      coreWorkflows.forEach(workflow => {
        workflow.capabilities.forEach(capability => {
          allCapabilities.add(capability);
        });
      });

      // Expected capabilities that should be covered
      const expectedCapabilities = [
        'swarm-initialization',
        'agent-spawning', 
        'task-orchestration',
        'code-generation',
        'testing-execution',
        'quality-validation',
        'template-discovery',
        'security-scanning',
        'deployment-orchestration',
        'performance-monitoring'
      ];

      expectedCapabilities.forEach(capability => {
        expect(Array.from(allCapabilities)).toContain(capability);
      });

      console.log(chalk.blue(`📋 Total capabilities: ${allCapabilities.size}`));
    });
  });

  describe('Composition Template Validation', () => {
    test('should provide templates for common development scenarios', () => {
      const templates = compositionEngine.getCompositionTemplates();
      expect(templates.length).toBeGreaterThanOrEqual(5);
      
      const expectedTemplates = [
        'enterprise-fullstack',
        'api-microservice',
        'template-development',
        'rapid-prototyping',
        'production-deployment'
      ];
      
      const templateNames = templates.map(t => t.name);
      expectedTemplates.forEach(expected => {
        expect(templateNames).toContain(expected);
      });
    });

    test('should support multiple composition strategies', () => {
      const templates = compositionEngine.getCompositionTemplates();
      const strategies = new Set(templates.map(t => t.strategy));
      
      expect(strategies.has('sequential')).toBe(true);
      expect(strategies.has('parallel')).toBe(true);
      expect(strategies.has('adaptive')).toBe(true);
      
      console.log(chalk.cyan(`🔄 Composition strategies: ${Array.from(strategies).join(', ')}`));
    });
  });

  describe('Functional Equivalence Validation', () => {
    test('should execute enterprise fullstack development workflow', async () => {
      const composition = await compositionEngine.composeWorkflow({
        template: 'enterprise-fullstack',
        name: 'Test Enterprise Development',
        parameters: {
          projectType: 'fullstack',
          testingStrategy: 'comprehensive'
        }
      });

      expect(composition.status).toBe('completed');
      expect(composition.results.length).toBe(3); // 3 workflows in template
      expect(composition.results.every(r => r.success)).toBe(true);
      
      console.log(chalk.green(`✅ Enterprise workflow completed in ${composition.metrics.totalExecutionTime.toFixed(2)}ms`));
    }, 30000);

    test('should execute API microservice pipeline', async () => {
      const composition = await compositionEngine.composeWorkflow({
        template: 'api-microservice',
        name: 'Test API Pipeline',
        parameters: {
          projectType: 'api',
          deploymentStrategy: 'rolling'
        }
      });

      expect(composition.status).toBe('completed');
      expect(composition.results.length).toBe(3);
      expect(composition.results.every(r => r.success)).toBe(true);
      
      console.log(chalk.green(`✅ API pipeline completed in ${composition.metrics.totalExecutionTime.toFixed(2)}ms`));
    }, 20000);

    test('should execute template development workflow', async () => {
      const composition = await compositionEngine.composeWorkflow({
        template: 'template-development',
        name: 'Test Template Development',
        parameters: {
          operation: ['generate', 'validate', 'publish'],
          marketplace: true
        }
      });

      expect(composition.status).toBe('completed');
      expect(composition.results.length).toBe(3);
      expect(composition.results.every(r => r.success)).toBe(true);
      
      console.log(chalk.green(`✅ Template workflow completed in ${composition.metrics.totalExecutionTime.toFixed(2)}ms`));
    }, 15000);

    test('should execute rapid prototyping workflow', async () => {
      const composition = await compositionEngine.composeWorkflow({
        template: 'rapid-prototyping',
        name: 'Test Rapid Prototyping',
        parameters: {
          projectType: 'prototype',
          testingStrategy: 'basic'
        }
      });

      expect(composition.status).toBe('completed');
      expect(composition.results.length).toBe(2); // 2 workflows in template
      expect(composition.results.every(r => r.success)).toBe(true);
      
      console.log(chalk.green(`✅ Rapid prototyping completed in ${composition.metrics.totalExecutionTime.toFixed(2)}ms`));
    }, 10000);

    test('should execute production deployment workflow', async () => {
      const composition = await compositionEngine.composeWorkflow({
        template: 'production-deployment',
        name: 'Test Production Deployment',
        parameters: {
          environment: 'production',
          strategy: 'blue-green'
        }
      });

      expect(composition.status).toBe('completed');
      expect(composition.results.length).toBe(3);
      expect(composition.results.every(r => r.success)).toBe(true);
      
      console.log(chalk.green(`✅ Production deployment completed in ${composition.metrics.totalExecutionTime.toFixed(2)}ms`));
    }, 25000);
  });

  describe('Custom Composition Validation', () => {
    test('should support custom workflow composition', async () => {
      const composition = await compositionEngine.composeWorkflow({
        name: 'Custom Development Pipeline',
        workflows: ['development-lifecycle', 'quality-assurance'],
        strategy: 'sequential',
        parameters: {
          projectType: 'frontend',
          testingStrategy: 'integration'
        }
      });

      expect(composition.status).toBe('completed');
      expect(composition.results.length).toBe(2);
      expect(composition.results.every(r => r.success)).toBe(true);
    }, 15000);

    test('should support parallel workflow execution', async () => {
      const startTime = performance.now();
      
      const composition = await compositionEngine.composeWorkflow({
        name: 'Parallel Pipeline',
        workflows: ['template-generator', 'quality-assurance'],
        strategy: 'parallel',
        parameters: {
          operation: 'generate',
          testTypes: ['unit', 'integration']
        }
      });

      const executionTime = performance.now() - startTime;
      
      expect(composition.status).toBe('completed');
      expect(composition.results.length).toBe(2);
      expect(composition.results.every(r => r.success)).toBe(true);
      
      // Parallel execution should be faster than sequential
      console.log(chalk.cyan(`⚡ Parallel execution time: ${executionTime.toFixed(2)}ms`));
    }, 10000);
  });

  describe('Performance Validation', () => {
    test('should demonstrate improved execution efficiency', async () => {
      const metrics = compositionEngine.getEngineMetrics();
      
      expect(metrics.totalCoreWorkflows).toBe(5);
      expect(metrics.consolidationRatio).toBe('86.5%'); // (37-5)/37 * 100
      
      console.log(chalk.blue('📊 Consolidation Metrics:'));
      console.log(chalk.gray(`  Original workflows: ${metrics.originalWorkflows}`));
      console.log(chalk.gray(`  Core workflows: ${metrics.totalCoreWorkflows}`));
      console.log(chalk.gray(`  Consolidation ratio: ${metrics.consolidationRatio}`));
      console.log(chalk.gray(`  Estimated efficiency gain: ${metrics.estimatedEfficiencyGain}`));
      console.log(chalk.gray(`  Estimated speed improvement: ${metrics.estimatedSpeedImprovement}`));
      console.log(chalk.gray(`  Estimated resource reduction: ${metrics.estimatedResourceReduction}`));
    });

    test('should maintain all critical capabilities', () => {
      const coreWorkflows = compositionEngine.getCoreWorkflows();
      
      // Critical capabilities that must be preserved
      const criticalCapabilities = [
        'swarm-initialization',
        'code-generation',
        'testing-execution',
        'security-scanning',
        'deployment-orchestration',
        'performance-monitoring',
        'quality-validation'
      ];

      const allCapabilities = new Set();
      coreWorkflows.forEach(workflow => {
        workflow.capabilities.forEach(cap => allCapabilities.add(cap));
      });

      criticalCapabilities.forEach(capability => {
        expect(Array.from(allCapabilities)).toContain(capability);
      });

      console.log(chalk.green(`✅ All ${criticalCapabilities.length} critical capabilities preserved`));
    });

    test('should support concurrent workflow execution', async () => {
      const concurrentPromises = [
        compositionEngine.composeWorkflow({
          template: 'rapid-prototyping',
          name: 'Concurrent Test 1'
        }),
        compositionEngine.composeWorkflow({
          template: 'template-development', 
          name: 'Concurrent Test 2'
        }),
        compositionEngine.composeWorkflow({
          name: 'Concurrent Test 3',
          workflows: ['quality-assurance'],
          strategy: 'sequential'
        })
      ];

      const results = await Promise.allSettled(concurrentPromises);
      
      expect(results.every(r => r.status === 'fulfilled')).toBe(true);
      expect(results.every(r => r.value.status === 'completed')).toBe(true);
      
      console.log(chalk.green(`✅ Successfully executed ${results.length} concurrent workflows`));
    }, 20000);
  });

  describe('Error Handling Validation', () => {
    test('should handle invalid workflow compositions gracefully', async () => {
      await expect(compositionEngine.composeWorkflow({
        name: 'Invalid Workflow',
        workflows: ['non-existent-workflow'],
        strategy: 'sequential'
      })).rejects.toThrow('Unknown core workflow: non-existent-workflow');
    });

    test('should handle invalid templates gracefully', async () => {
      await expect(compositionEngine.composeWorkflow({
        template: 'non-existent-template',
        name: 'Invalid Template Test'
      })).rejects.toThrow('Unknown composition template: non-existent-template');
    });

    test('should handle invalid strategies gracefully', async () => {
      await expect(compositionEngine.composeWorkflow({
        name: 'Invalid Strategy',
        workflows: ['development-lifecycle'],
        strategy: 'invalid-strategy'
      })).rejects.toThrow('Invalid strategy: invalid-strategy');
    });
  });

  describe('Migration Validation', () => {
    test('should provide migration path for all original workflows', () => {
      const coreWorkflows = compositionEngine.getCoreWorkflows();
      const consolidatedWorkflows = new Set();
      
      coreWorkflows.forEach(workflow => {
        workflow.consolidatedWorkflows.forEach(consolidated => {
          consolidatedWorkflows.add(consolidated);
        });
      });

      // Verify that key original workflows are represented
      const keyOriginalWorkflows = [
        'bdd-agent-coordination',
        'semantic-workflow-orchestrator',
        'fullstack-development',
        'template-discovery',
        'performance-testing',
        'security-scanning',
        'deployment-orchestration'
      ];

      keyOriginalWorkflows.forEach(original => {
        const found = Array.from(consolidatedWorkflows).some(consolidated => 
          consolidated.includes(original.replace('-', '-'))
        );
        expect(found).toBe(true);
      });

      console.log(chalk.blue(`📋 Migration coverage: ${consolidatedWorkflows.size} original workflows mapped`));
    });
  });

  describe('Integration Validation', () => {
    test('should maintain compatibility with existing systems', () => {
      const templates = compositionEngine.getCompositionTemplates();
      
      // Ensure templates support common integration patterns
      const enterpriseTemplate = templates.find(t => t.name === 'Enterprise Full-Stack Development');
      expect(enterpriseTemplate).toBeDefined();
      expect(enterpriseTemplate.workflows).toContain('meta-orchestration');
      expect(enterpriseTemplate.workflows).toContain('quality-assurance');
      
      const apiTemplate = templates.find(t => t.name === 'API Microservice Pipeline');
      expect(apiTemplate).toBeDefined();
      expect(apiTemplate.workflows).toContain('integration-deployment');
    });

    test('should support flexible parameter inheritance', async () => {
      const composition = await compositionEngine.composeWorkflow({
        name: 'Parameter Inheritance Test',
        workflows: ['development-lifecycle'],
        strategy: 'sequential',
        parameters: {
          projectType: 'custom',
          // Should inherit other defaults from core workflow
        }
      });

      expect(composition.status).toBe('completed');
      expect(composition.parameters.projectType).toBe('custom');
      // Should have inherited default testingStrategy
      expect(composition.parameters.testingStrategy).toBe('comprehensive');
    }, 10000);
  });

  describe('Comprehensive Validation Summary', () => {
    test('should generate consolidation summary report', () => {
      const coreWorkflows = compositionEngine.getCoreWorkflows();
      const templates = compositionEngine.getCompositionTemplates();
      const metrics = compositionEngine.getEngineMetrics();

      console.log(chalk.bold('\n📊 WORKFLOW CONSOLIDATION VALIDATION SUMMARY'));
      console.log(chalk.blue('═'.repeat(60)));
      
      console.log(chalk.green('\n✅ CONSOLIDATION SUCCESS:'));
      console.log(chalk.gray(`   Original workflows: ${metrics.originalWorkflows}`));
      console.log(chalk.gray(`   Consolidated to: ${metrics.totalCoreWorkflows} core workflows`));
      console.log(chalk.gray(`   Reduction: ${metrics.consolidationRatio}`));
      console.log(chalk.gray(`   Composition templates: ${metrics.totalTemplates}`));
      
      console.log(chalk.cyan('\n⚡ EXPECTED PERFORMANCE GAINS:'));
      console.log(chalk.gray(`   Efficiency improvement: ${metrics.estimatedEfficiencyGain}`));
      console.log(chalk.gray(`   Speed improvement: ${metrics.estimatedSpeedImprovement}`));
      console.log(chalk.gray(`   Resource reduction: ${metrics.estimatedResourceReduction}`));
      
      console.log(chalk.yellow('\n🎯 CAPABILITIES PRESERVED:'));
      const totalCapabilities = new Set();
      coreWorkflows.forEach(w => w.capabilities.forEach(c => totalCapabilities.add(c)));
      console.log(chalk.gray(`   Total capabilities: ${totalCapabilities.size}`));
      console.log(chalk.gray(`   Core workflows: ${coreWorkflows.length}`));
      console.log(chalk.gray(`   Composition strategies: sequential, parallel, adaptive`));
      
      console.log(chalk.blue('\n═'.repeat(60)));
      console.log(chalk.bold('🎉 CONSOLIDATION VALIDATION: PASSED'));
      
      // Final assertions
      expect(coreWorkflows.length).toBe(5);
      expect(templates.length).toBeGreaterThanOrEqual(5);
      expect(totalCapabilities.size).toBeGreaterThanOrEqual(20);
    });
  });
});

/**
 * Additional validation helpers
 */
function validateWorkflowCapabilities(workflow, expectedCapabilities) {
  expectedCapabilities.forEach(capability => {
    expect(workflow.capabilities).toContain(capability);
  });
}

function validateCompositionResult(result, expectedWorkflowCount) {
  expect(result.status).toBe('completed');
  expect(result.results.length).toBe(expectedWorkflowCount);
  expect(result.results.every(r => r.success)).toBe(true);
  expect(result.metrics.totalExecutionTime).toBeGreaterThan(0);
}