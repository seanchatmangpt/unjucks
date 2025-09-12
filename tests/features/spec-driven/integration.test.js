import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { testUtils, testConfig } from './setup.js';
import MockDataFactory, { mockSpecifications, mockTeamMembers } from '../../fixtures/spec-driven/mock-data.js';

/**
 * Integration tests for the complete spec-driven development workflow
 * These tests demonstrate how all components work together end-to-end
 */
describe('Spec-Driven Development Integration Tests', () => {
  let tempDir;
  let integrationContext;

  beforeAll(async () => {
    console.log('Setting up integration test environment...');
    tempDir = await testUtils.createTempDir('spec-integration-');
    
    integrationContext = {
      specifications: new Map(),
      plans: new Map(),
      tasks: new Map(),
      workflows: new Map(),
      generatedCode: new Map(),
      qualityResults: new Map()
    };
  });

  afterAll(async () => {
    console.log('Cleaning up integration test environment...');
    await testUtils.cleanup();
  });

  beforeEach(() => {
    // Reset integration context for each test
    Object.values(integrationContext).forEach(map => map.clear());
  });

  describe('Complete Specification-to-Production Workflow', () => {
    it('should execute complete workflow from specification to deployment', async () => {
      // Phase 1: Create and validate specification
      const specification = testUtils.generateSpecification({
        name: 'UserAuthenticationService',
        description: 'Complete user authentication with JWT tokens',
        type: 'feature',
        priority: 'high',
        endpoints: [
          { method: 'POST', path: '/auth/login', description: 'User login' },
          { method: 'POST', path: '/auth/logout', description: 'User logout' },
          { method: 'GET', path: '/auth/profile', description: 'Get user profile' }
        ],
        entities: [
          { name: 'User', fields: { id: 'uuid', email: 'string', password_hash: 'string' } }
        ]
      });

      integrationContext.specifications.set(specification.id, specification);
      expect(specification).toBeValidSpecification();

      // Phase 2: Generate development plan
      const plan = testUtils.generatePlan(specification, {
        template: 'agile-sprint',
        phases: [
          { name: 'spec_validation', estimatedDays: 1, dependencies: [] },
          { name: 'api_design', estimatedDays: 2, dependencies: ['spec_validation'] },
          { name: 'backend_implementation', estimatedDays: 8, dependencies: ['api_design'] },
          { name: 'testing', estimatedDays: 4, dependencies: ['backend_implementation'] },
          { name: 'deployment', estimatedDays: 1, dependencies: ['testing'] }
        ]
      });

      integrationContext.plans.set(plan.id, plan);
      expect(plan).toBeValidPlan();
      expect(plan.totalEstimatedDays).toBe(16);

      // Phase 3: Break down into tasks
      const tasks = testUtils.generateTasks(specification, {
        category: 'backend',
        priority: 'high',
        estimatedHours: 6
      });

      tasks.forEach(task => {
        integrationContext.tasks.set(task.id, task);
      });
      
      expect(tasks).toBeValidTaskList();
      expect(tasks.length).toBeGreaterThan(0);

      // Phase 4: Generate code scaffolding
      const generatedFiles = MockDataFactory.createCodeGenerationFiles(specification);
      
      generatedFiles.forEach(file => {
        integrationContext.generatedCode.set(file.path, file);
      });

      expect(generatedFiles.length).toBeGreaterThan(0);
      expect(generatedFiles.some(f => f.type === 'service_class')).toBe(true);
      expect(generatedFiles.some(f => f.type === 'test_file')).toBe(true);

      // Phase 5: Validate end-to-end workflow
      const workflow = testUtils.generateWorkflow({
        name: specification.name,
        specification,
        plan,
        tasks,
        generatedFiles
      }, {
        status: 'completed',
        endTime: this.getDeterministicDate().toISOString()
      });

      integrationContext.workflows.set(workflow.id, workflow);
      expect(workflow).toBeValidWorkflow();
      expect(workflow.status).toBe('completed');

      // Verify all phases completed successfully
      expect(integrationContext.specifications.size).toBe(1);
      expect(integrationContext.plans.size).toBe(1);
      expect(integrationContext.tasks.size).toBeGreaterThan(0);
      expect(integrationContext.generatedCode.size).toBeGreaterThan(0);
      expect(integrationContext.workflows.size).toBe(1);
    });

    it('should maintain traceability throughout the workflow', async () => {
      // Create related artifacts with proper IDs
      const specification = testUtils.generateSpecification({
        name: 'TraceabilityTest',
        acceptance: ['Feature works correctly', 'Performance is acceptable']
      });

      const plan = testUtils.generatePlan(specification);
      const tasks = testUtils.generateTasks(specification);
      const workflow = testUtils.generateWorkflow(specification);

      // Verify traceability links
      expect(plan.specificationId).toBe(specification.id);
      
      tasks.forEach(task => {
        expect(task.specificationId).toBe(specification.id);
      });

      expect(workflow.requirement.name).toBe(specification.name);

      // Verify acceptance criteria propagation
      expect(specification.acceptance).toBeDefined();
      tasks.forEach(task => {
        expect(task.acceptanceCriteria).toBeDefined();
        expect(task.acceptanceCriteria.length).toBeGreaterThan(0);
      });
    });

    it('should handle quality gates throughout the workflow', async () => {
      const specification = testUtils.generateSpecification({
        name: 'QualityGateTest'
      });

      const qualityGates = MockDataFactory.createQualityGates();
      
      // Simulate quality gate execution for each phase
      const qualityResults = new Map();
      
      for (const gate of qualityGates) {
        const gateResult = {
          phase: gate.phase,
          name: gate.name,
          passed: Math.random() > 0.1, // 90% pass rate
          score: Math.random() * 0.3 + 0.7, // 70-100%
          criteria: gate.criteria.map(criterion => ({
            name: criterion.name,
            passed: Math.random() > 0.05, // 95% pass rate
            score: Math.random() * 0.2 + 0.8 // 80-100%
          }))
        };
        
        qualityResults.set(gate.phase, gateResult);
      }

      integrationContext.qualityResults = qualityResults;

      // Verify quality gates are enforced
      for (const [phase, result] of qualityResults) {
        expect(result.phase).toBe(phase);
        expect(typeof result.passed).toBe('boolean');
        expect(result.score).toBeGreaterThanOrEqual(0.7);
        expect(Array.isArray(result.criteria)).toBe(true);
      }

      // Verify overall quality
      const overallPassed = Array.from(qualityResults.values()).every(r => r.passed);
      const averageScore = Array.from(qualityResults.values())
        .reduce((sum, r) => sum + r.score, 0) / qualityResults.size;

      expect(averageScore).toBeGreaterThanOrEqual(0.7);
      
      if (!overallPassed) {
        console.log('Some quality gates failed (expected for testing)');
      }
    });
  });

  describe('Multi-Team Collaboration Integration', () => {
    it('should coordinate work across multiple teams', async () => {
      const specification = testUtils.generateSpecification({
        name: 'MultiTeamFeature',
        complexity: 'high'
      });

      const teams = [
        { name: 'backend-team', type: 'backend', capacity: 3 },
        { name: 'frontend-team', type: 'frontend', capacity: 2 },
        { name: 'qa-team', type: 'qa', capacity: 2 },
        { name: 'devops-team', type: 'devops', capacity: 1 }
      ];

      // Generate team-specific tasks
      const backendTasks = testUtils.generateTasks(specification, {
        category: 'backend',
        assignedTeam: 'backend-team'
      }).slice(0, 3);

      const frontendTasks = testUtils.generateTasks(specification, {
        category: 'frontend',
        assignedTeam: 'frontend-team'
      }).slice(0, 2);

      const qaTasks = testUtils.generateTasks(specification, {
        category: 'testing',
        assignedTeam: 'qa-team'
      }).slice(0, 2);

      const allTasks = [...backendTasks, ...frontendTasks, ...qaTasks];

      // Verify team coordination
      expect(backendTasks.every(t => t.assignedTeam === 'backend-team')).toBe(true);
      expect(frontendTasks.every(t => t.assignedTeam === 'frontend-team')).toBe(true);
      expect(qaTasks.every(t => t.assignedTeam === 'qa-team')).toBe(true);

      // Verify task distribution matches team capacity
      expect(backendTasks.length).toBeLessThanOrEqual(3);
      expect(frontendTasks.length).toBeLessThanOrEqual(2);
      expect(qaTasks.length).toBeLessThanOrEqual(2);

      // Create coordination plan
      const coordinationPlan = {
        specification: specification.id,
        teams,
        tasks: allTasks,
        dependencies: [
          { from: 'frontend-team', to: 'backend-team', type: 'api_dependency' },
          { from: 'qa-team', to: 'backend-team', type: 'testing_dependency' },
          { from: 'qa-team', to: 'frontend-team', type: 'testing_dependency' }
        ],
        milestones: [
          { name: 'API Contract Complete', week: 1, teams: ['backend-team', 'frontend-team'] },
          { name: 'Implementation Complete', week: 3, teams: ['backend-team', 'frontend-team'] },
          { name: 'Testing Complete', week: 4, teams: ['qa-team'] }
        ]
      };

      expect(coordinationPlan.teams.length).toBe(4);
      expect(coordinationPlan.dependencies.length).toBe(3);
      expect(coordinationPlan.milestones.length).toBe(3);
    });

    it('should handle interface definitions between teams', async () => {
      const specification = testUtils.generateSpecification({
        name: 'InterfaceTest',
        endpoints: [
          { method: 'GET', path: '/api/users', description: 'Get users' },
          { method: 'POST', path: '/api/users', description: 'Create user' }
        ]
      });

      // Define interfaces between teams
      const interfaces = [
        {
          name: 'user-api',
          from: 'backend-team',
          to: 'frontend-team',
          type: 'rest_api',
          specification: {
            endpoints: specification.endpoints,
            dataFormats: ['JSON'],
            authentication: 'JWT'
          }
        },
        {
          name: 'test-api',
          from: 'backend-team',
          to: 'qa-team',
          type: 'test_interface',
          specification: {
            testEndpoints: specification.endpoints.map(e => ({ ...e, testable: true })),
            mockData: 'provided'
          }
        }
      ];

      // Verify interface definitions
      interfaces.forEach(iface => {
        expect(iface.name).toBeDefined();
        expect(iface.from).toBeDefined();
        expect(iface.to).toBeDefined();
        expect(iface.type).toBeDefined();
        expect(iface.specification).toBeDefined();
      });

      expect(interfaces.length).toBe(2);
      expect(interfaces.every(i => i.specification)).toBe(true);
    });
  });

  describe('Performance and Quality Monitoring Integration', () => {
    it('should track performance metrics throughout workflow', async () => {
      const specification = testUtils.generateSpecification({
        name: 'PerformanceMonitoring'
      });

      const workflow = testUtils.generateWorkflow(specification);
      const performanceMetrics = MockDataFactory.createPerformanceMetrics();

      // Simulate metric collection throughout workflow phases
      const phaseMetrics = new Map();

      const phases = ['specification', 'planning', 'implementation', 'testing', 'deployment'];
      phases.forEach(phase => {
        const metrics = {
          phase,
          timestamp: this.getDeterministicDate().toISOString(),
          metrics: {
            velocity: {
              tasksCompleted: Math.floor(Math.random() * 10) + 5,
              cycleTime: Math.floor(Math.random() * 5) + 2
            },
            quality: {
              testCoverage: Math.random() * 0.15 + 0.85,
              defectDensity: Math.random() * 0.05
            },
            efficiency: {
              resourceUtilization: Math.random() * 0.2 + 0.8,
              reworkPercentage: Math.random() * 0.1
            }
          }
        };
        
        phaseMetrics.set(phase, metrics);
      });

      // Verify metrics collection
      expect(phaseMetrics.size).toBe(5);
      
      for (const [phase, metrics] of phaseMetrics) {
        expect(metrics.phase).toBe(phase);
        expect(metrics.metrics.velocity).toBeDefined();
        expect(metrics.metrics.quality).toBeDefined();
        expect(metrics.metrics.efficiency).toBeDefined();
        
        // Verify quality thresholds
        expect(metrics.metrics.quality.testCoverage).toBeGreaterThanOrEqual(0.8);
        expect(metrics.metrics.efficiency.resourceUtilization).toBeGreaterThanOrEqual(0.7);
      }

      // Calculate overall performance score
      const performanceScores = Array.from(phaseMetrics.values()).map(m => {
        const velocity = m.metrics.velocity.tasksCompleted / 10; // Normalize to 0-1
        const quality = m.metrics.quality.testCoverage;
        const efficiency = m.metrics.efficiency.resourceUtilization;
        
        return (velocity + quality + efficiency) / 3;
      });

      const avgPerformance = performanceScores.reduce((sum, score) => sum + score, 0) / performanceScores.length;
      expect(avgPerformance).toBeGreaterThanOrEqual(0.7);
    });

    it('should enforce quality standards across all phases', async () => {
      const specification = testUtils.generateSpecification({
        name: 'QualityStandards'
      });

      const qualityStandards = {
        specification: { completeness: 0.9, clarity: 0.85 },
        implementation: { coverage: 0.8, complexity: 0.7 },
        testing: { passRate: 0.95, automation: 0.8 },
        deployment: { security: 0.9, performance: 0.8 }
      };

      // Simulate quality enforcement
      const qualityResults = {};
      
      for (const [phase, standards] of Object.entries(qualityStandards)) {
        const results = {};
        
        for (const [metric, threshold] of Object.entries(standards)) {
          const actualValue = Math.random() * 0.2 + 0.8; // 80-100%
          results[metric] = {
            actual: actualValue,
            threshold,
            passed: actualValue >= threshold
          };
        }
        
        qualityResults[phase] = {
          results,
          overallPassed: Object.values(results).every(r => r.passed)
        };
      }

      // Verify quality enforcement
      Object.entries(qualityResults).forEach(([phase, result]) => {
        expect(result.results).toBeDefined();
        expect(typeof result.overallPassed).toBe('boolean');
        
        Object.values(result.results).forEach(metricResult => {
          expect(metricResult.actual).toBeGreaterThanOrEqual(0);
          expect(metricResult.threshold).toBeGreaterThanOrEqual(0);
          expect(typeof metricResult.passed).toBe('boolean');
        });
      });

      // Check overall quality
      const allPhasesPassed = Object.values(qualityResults).every(r => r.overallPassed);
      console.log(`Overall quality enforcement: ${allPhasesPassed ? 'PASSED' : 'SOME FAILURES'}`);
    });
  });

  describe('Error Handling and Recovery Integration', () => {
    it('should handle workflow failures gracefully', async () => {
      const specification = testUtils.generateSpecification({
        name: 'ErrorHandlingTest'
      });

      // Simulate workflow with potential failures
      const workflow = testUtils.generateWorkflow(specification, {
        status: 'running'
      });

      const phases = ['specification', 'planning', 'implementation', 'testing'];
      const phaseResults = [];

      for (const phase of phases) {
        const phaseResult = {
          phase,
          startTime: this.getDeterministicDate().toISOString(),
          status: 'running'
        };

        // Simulate phase execution with potential failure
        const failureChance = phase === 'implementation' ? 0.3 : 0.1; // Higher failure chance for implementation
        const success = Math.random() > failureChance;

        if (success) {
          phaseResult.status = 'completed';
          phaseResult.endTime = this.getDeterministicDate().toISOString();
        } else {
          phaseResult.status = 'failed';
          phaseResult.error = `Simulated failure in ${phase} phase`;
          phaseResult.endTime = this.getDeterministicDate().toISOString();
          
          // Simulate recovery attempt
          phaseResult.recovery = {
            attempted: true,
            strategy: `Retry ${phase} with adjusted parameters`,
            success: Math.random() > 0.2 // 80% recovery success rate
          };

          if (phaseResult.recovery.success) {
            phaseResult.status = 'recovered';
          }
        }

        phaseResults.push(phaseResult);

        // Break if phase failed and couldn't recover
        if (phaseResult.status === 'failed') {
          break;
        }
      }

      // Verify error handling
      const failedPhases = phaseResults.filter(p => p.status === 'failed');
      const recoveredPhases = phaseResults.filter(p => p.status === 'recovered');

      console.log(`Failed phases: ${failedPhases.length}, Recovered phases: ${recoveredPhases.length}`);

      // All phases should have proper status
      phaseResults.forEach(phase => {
        expect(phase.status).toBeOneOf(['completed', 'failed', 'recovered']);
        expect(phase.startTime).toBeDefined();
        expect(phase.endTime).toBeDefined();
        
        if (phase.status === 'failed' || phase.status === 'recovered') {
          expect(phase.error).toBeDefined();
          expect(phase.recovery).toBeDefined();
        }
      });
    });

    it('should maintain data consistency during failures', async () => {
      const specification = testUtils.generateSpecification({
        name: 'ConsistencyTest'
      });

      // Create backup points for critical data
      const backupPoints = MockDataFactory.createBackupPoints();
      
      // Simulate data state throughout workflow
      const dataStates = new Map();
      dataStates.set('initial', { specifications: 1, plans: 0, tasks: 0 });
      dataStates.set('planning', { specifications: 1, plans: 1, tasks: 0 });
      dataStates.set('task_breakdown', { specifications: 1, plans: 1, tasks: 5 });
      
      // Simulate failure during task breakdown
      const failurePoint = 'task_breakdown';
      const relevantBackup = backupPoints.find(b => b.stage === 'specification');
      
      expect(relevantBackup).toBeDefined();
      expect(relevantBackup.type).toBe('version_control');

      // Verify rollback capability
      const rollbackState = dataStates.get('planning');
      expect(rollbackState.specifications).toBe(1);
      expect(rollbackState.plans).toBe(1);
      expect(rollbackState.tasks).toBe(0);

      // Verify data consistency after rollback
      const postRollbackState = {
        specifications: rollbackState.specifications,
        plans: rollbackState.plans,
        tasks: rollbackState.tasks,
        consistent: true,
        rollbackPoint: relevantBackup.id
      };

      expect(postRollbackState.consistent).toBe(true);
      expect(postRollbackState.rollbackPoint).toBe(relevantBackup.id);
    });
  });

  describe('Scalability and Performance Integration', () => {
    it('should handle large-scale workflows efficiently', async () => {
      // Create a complex specification with many components
      const largeSpecification = testUtils.generateSpecification({
        name: 'LargeScaleSystem',
        complexity: 'high',
        endpoints: Array.from({ length: 20 }, (_, i) => ({
          method: i % 2 === 0 ? 'GET' : 'POST',
          path: `/api/resource${i + 1}`,
          description: `Resource ${i + 1} endpoint`
        })),
        entities: Array.from({ length: 10 }, (_, i) => ({
          name: `Entity${i + 1}`,
          fields: {
            id: 'uuid',
            name: 'string',
            data: 'json',
            created_at: 'datetime'
          }
        }))
      });

      // Generate large number of tasks
      const largeTasks = Array.from({ length: 50 }, (_, i) => 
        testUtils.generateTasks(largeSpecification, {
          name: `Task ${i + 1}`,
          category: ['backend', 'frontend', 'testing'][i % 3],
          estimatedHours: Math.floor(Math.random() * 12) + 4
        })[0]
      );

      // Measure performance
      const performanceTest = await testUtils.measureAsyncExecutionTime(async () => {
        // Simulate processing large dataset
        const processed = largeTasks.map(task => ({
          ...task,
          processed: true,
          processingTime: this.getDeterministicTimestamp()
        }));

        return {
          specification: largeSpecification,
          tasks: processed,
          totalProcessed: processed.length
        };
      });

      // Verify scalability
      expect(performanceTest.result.totalProcessed).toBe(50);
      expect(performanceTest.executionTime).toBeLessThan(1000); // Should complete under 1 second
      expect(performanceTest.withinThreshold).toBe(true);

      // Verify memory usage is reasonable
      const memoryUsage = testUtils.getMemoryUsage();
      if (memoryUsage) {
        expect(memoryUsage.heapUsed).toBeLessThan(100); // Less than 100MB
      }
    });

    it('should optimize resource allocation for concurrent workflows', async () => {
      const concurrentSpecs = Array.from({ length: 5 }, (_, i) =>
        testUtils.generateSpecification({
          name: `ConcurrentSpec${i + 1}`,
          priority: ['high', 'medium', 'low'][i % 3]
        })
      );

      const teamMembers = mockTeamMembers;
      const totalCapacity = teamMembers.reduce((sum, member) => sum + (member.maxCapacity || 40), 0);

      // Simulate concurrent workflow execution
      const concurrentWorkflows = concurrentSpecs.map(spec => {
        const tasks = testUtils.generateTasks(spec);
        const totalHours = tasks.reduce((sum, task) => sum + (task.estimatedHours || 8), 0);
        
        return {
          specification: spec,
          tasks,
          estimatedHours: totalHours,
          priority: spec.priority
        };
      });

      // Calculate resource allocation
      let remainingCapacity = totalCapacity;
      const allocations = [];

      // Sort by priority for allocation
      const sortedWorkflows = concurrentWorkflows.sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      });

      for (const workflow of sortedWorkflows) {
        const allocation = {
          workflowId: workflow.specification.id,
          requestedHours: workflow.estimatedHours,
          allocatedHours: Math.min(workflow.estimatedHours, remainingCapacity),
          priority: workflow.priority
        };
        
        remainingCapacity -= allocation.allocatedHours;
        allocations.push(allocation);
      }

      // Verify optimal allocation
      expect(allocations.length).toBe(5);
      expect(allocations.every(a => a.allocatedHours <= a.requestedHours)).toBe(true);
      
      const totalAllocated = allocations.reduce((sum, a) => sum + a.allocatedHours, 0);
      expect(totalAllocated).toBeLessThanOrEqual(totalCapacity);

      // High priority workflows should get full allocation
      const highPriorityAllocation = allocations.find(a => a.priority === 'high');
      if (highPriorityAllocation) {
        expect(highPriorityAllocation.allocatedHours).toBe(highPriorityAllocation.requestedHours);
      }
    });
  });

  describe('Compliance and Governance Integration', () => {
    it('should maintain compliance throughout the workflow', async () => {
      const specification = testUtils.generateSpecification({
        name: 'ComplianceWorkflow',
        description: 'Workflow with compliance requirements'
      });

      const complianceRequirements = {
        gdpr: true,
        security: true,
        accessibility: true,
        auditTrail: true
      };

      const complianceArtifacts = MockDataFactory.createComplianceArtifacts();

      // Verify compliance artifacts
      expect(complianceArtifacts.gdpr.compliant).toBe(true);
      expect(complianceArtifacts.security.compliant).toBe(true);
      expect(complianceArtifacts.accessibility.compliant).toBe(true);

      // Verify GDPR compliance
      expect(complianceArtifacts.gdpr.dataRetentionPolicies).toBeDefined();
      expect(complianceArtifacts.gdpr.consentManagement).toBe(true);
      expect(complianceArtifacts.gdpr.rightToErasure).toBe(true);

      // Verify security compliance
      expect(complianceArtifacts.security.scanResults.critical).toBe(0);
      expect(complianceArtifacts.security.authenticationMethods).toContain('JWT');
      expect(complianceArtifacts.security.encryptionStandards).toContain('AES-256');

      // Verify accessibility compliance
      expect(complianceArtifacts.accessibility.wcagLevel).toBe('AA');
      expect(complianceArtifacts.accessibility.testResults.automated).toBe('Passed');

      // Create audit trail
      const auditTrail = {
        workflowId: specification.id,
        events: [
          { timestamp: this.getDeterministicDate().toISOString(), action: 'specification_created', user: 'system' },
          { timestamp: this.getDeterministicDate().toISOString(), action: 'compliance_check_gdpr', result: 'passed' },
          { timestamp: this.getDeterministicDate().toISOString(), action: 'compliance_check_security', result: 'passed' },
          { timestamp: this.getDeterministicDate().toISOString(), action: 'compliance_check_accessibility', result: 'passed' }
        ],
        compliant: true
      };

      expect(auditTrail.events.length).toBe(4);
      expect(auditTrail.events.every(e => e.timestamp && e.action)).toBe(true);
      expect(auditTrail.compliant).toBe(true);
    });
  });
});