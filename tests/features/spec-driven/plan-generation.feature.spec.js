import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { tmpdir } from 'os';

// Mock implementations for plan generation system
class PlanGenerator {
  constructor() {
    this.templates = new Map([
      ['default', {
        phases: [
          { name: 'analysis', description: 'Requirement analysis', estimatedDays: 2 },
          { name: 'design', description: 'System design', estimatedDays: 3 },
          { name: 'development', description: 'Implementation', estimatedDays: 10 },
          { name: 'testing', description: 'Testing and validation', estimatedDays: 5 },
          { name: 'deployment', description: 'Release preparation', estimatedDays: 2 }
        ]
      }],
      ['agile-sprint', {
        phases: [
          { name: 'sprint-planning', description: 'Sprint planning', estimatedDays: 0.5 },
          { name: 'development', description: 'Sprint development', estimatedDays: 8 },
          { name: 'review', description: 'Sprint review', estimatedDays: 0.5 },
          { name: 'retrospective', description: 'Sprint retrospective', estimatedDays: 1 }
        ],
        methodology: 'agile',
        includeStoryPoints: true
      }]
    ]);
  }

  async generatePlan(specification, options = {}) {
    const template = this.templates.get(options.template || 'default');
    if (!template) {
      throw new Error(`Template not found: ${options.template}`);
    }

    const plan = {
      id: this.generatePlanId(),
      specificationId: specification.id,
      name: `Development Plan for ${specification.name}`,
      template: options.template || 'default',
      phases: template.phases.map(phase => ({
        ...phase,
        id: this.generatePhaseId(),
        dependencies: this.calculateDependencies(phase),
        resources: this.estimateResources(phase, specification)
      })),
      totalEstimatedDays: template.phases.reduce((sum, phase) => sum + phase.estimatedDays, 0),
      createdAt: new Date().toISOString(),
      status: 'draft'
    };

    if (template.methodology) {
      plan.methodology = template.methodology;
    }

    return plan;
  }

  async generateMultiSpecPlan(specifications, options = {}) {
    // Sort specifications by priority and complexity
    const sortedSpecs = this.prioritizeSpecifications(specifications);
    
    const plan = {
      id: this.generatePlanId(),
      name: 'Multi-Specification Development Plan',
      specifications: sortedSpecs,
      phases: [],
      totalEstimatedDays: 0,
      parallelizationOpportunities: [],
      dependencies: [],
      createdAt: new Date().toISOString(),
      status: 'draft'
    };

    // Generate integrated phases considering dependencies
    for (const spec of sortedSpecs) {
      const subPlan = await this.generatePlan(spec, options);
      plan.phases.push(...subPlan.phases);
      plan.totalEstimatedDays += subPlan.totalEstimatedDays;
    }

    // Optimize for parallel execution
    plan.parallelizationOpportunities = this.identifyParallelTasks(plan.phases);
    plan.dependencies = this.resolveDependencies(sortedSpecs);

    return plan;
  }

  customizePlan(plan, customizations) {
    const updatedPlan = { ...plan };

    customizations.forEach(customization => {
      switch (customization.action) {
        case 'adjust_duration':
          this.adjustPhaseDuration(updatedPlan, customization.target, customization.value);
          break;
        case 'add_milestone':
          this.addMilestone(updatedPlan, customization.target, customization.value);
          break;
        case 'assign_resource':
          this.assignResource(updatedPlan, customization.target, customization.value);
          break;
      }
    });

    // Recalculate dependencies and timeline
    updatedPlan.totalEstimatedDays = this.recalculateTotalDuration(updatedPlan);
    updatedPlan.lastModified = new Date().toISOString();

    return updatedPlan;
  }

  validatePlan(plan, constraints = {}) {
    const validation = {
      valid: true,
      issues: [],
      suggestions: []
    };

    // Check resource availability
    if (constraints.resources) {
      const resourceIssues = this.checkResourceConstraints(plan, constraints.resources);
      validation.issues.push(...resourceIssues);
    }

    // Check timeline constraints
    if (constraints.timeline && plan.totalEstimatedDays > constraints.timeline) {
      validation.issues.push(`Plan exceeds timeline constraint: ${plan.totalEstimatedDays} > ${constraints.timeline} days`);
      validation.suggestions.push('Consider reducing scope or adding resources');
    }

    // Identify potential risks
    const risks = this.identifyRisks(plan);
    validation.issues.push(...risks);

    validation.valid = validation.issues.length === 0;
    return validation;
  }

  exportPlan(plan, format) {
    switch (format) {
      case 'gantt':
        return this.toGantt(plan);
      case 'json':
        return JSON.stringify(plan, null, 2);
      case 'csv':
        return this.toCsv(plan);
      case 'pdf':
        return this.toPdf(plan);
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  // Private helper methods
  generatePlanId() {
    return 'plan-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
  }

  generatePhaseId() {
    return 'phase-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
  }

  calculateDependencies(phase) {
    // Simple dependency calculation based on phase type
    const dependencyMap = {
      'analysis': [],
      'design': ['analysis'],
      'development': ['design'],
      'testing': ['development'],
      'deployment': ['testing']
    };
    return dependencyMap[phase.name] || [];
  }

  estimateResources(phase, specification) {
    // Basic resource estimation
    const baseResources = {
      'analysis': { analysts: 1, architects: 0.5 },
      'design': { architects: 1, designers: 1 },
      'development': { developers: 2, architects: 0.5 },
      'testing': { testers: 1, developers: 0.5 },
      'deployment': { devops: 1, developers: 0.5 }
    };
    return baseResources[phase.name] || { developers: 1 };
  }

  prioritizeSpecifications(specifications) {
    return specifications.sort((a, b) => {
      const priorityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
      const complexityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
      
      const aPriority = priorityOrder[a.priority] || 2;
      const bPriority = priorityOrder[b.priority] || 2;
      const aComplexity = complexityOrder[a.complexity] || 2;
      const bComplexity = complexityOrder[b.complexity] || 2;
      
      // Higher priority first, then lower complexity for quick wins
      if (aPriority !== bPriority) return bPriority - aPriority;
      return aComplexity - bComplexity;
    });
  }

  identifyParallelTasks(phases) {
    return phases.filter(phase => 
      phase.dependencies.length === 0 || 
      phase.name.includes('testing') || 
      phase.name.includes('documentation')
    ).map(phase => phase.id);
  }

  resolveDependencies(specifications) {
    // Simple dependency resolution
    return specifications.map(spec => ({
      specId: spec.id,
      dependsOn: spec.dependsOn || [],
      relatesTo: spec.relatesTo || []
    }));
  }

  adjustPhaseDuration(plan, target, value) {
    const phase = plan.phases.find(p => p.name === target);
    if (phase) {
      const durationMatch = value.match(/(\d+)\s*(\w+)/);
      if (durationMatch) {
        const [, amount, unit] = durationMatch;
        const days = unit.includes('week') ? parseInt(amount) * 7 : parseInt(amount);
        phase.estimatedDays = days;
      }
    }
  }

  addMilestone(plan, target, value) {
    const phase = plan.phases.find(p => p.name === target);
    if (phase) {
      if (!phase.milestones) phase.milestones = [];
      phase.milestones.push({
        name: value,
        type: 'milestone',
        addedAt: new Date().toISOString()
      });
    }
  }

  assignResource(plan, target, value) {
    const phase = plan.phases.find(p => p.name === target);
    if (phase) {
      if (!phase.resourceAssignments) phase.resourceAssignments = {};
      phase.resourceAssignments[target] = value;
    }
  }

  recalculateTotalDuration(plan) {
    return plan.phases.reduce((sum, phase) => sum + phase.estimatedDays, 0);
  }

  checkResourceConstraints(plan, constraints) {
    const issues = [];
    // Simplified resource constraint checking
    if (constraints.developers && plan.phases.some(p => 
      (p.resources.developers || 0) > constraints.developers)) {
      issues.push('Insufficient developers for planned phases');
    }
    return issues;
  }

  identifyRisks(plan) {
    const risks = [];
    
    // Check for phases without dependencies (potential bottlenecks)
    const criticalPath = plan.phases.filter(p => p.dependencies.length > 2);
    if (criticalPath.length > plan.phases.length * 0.7) {
      risks.push('High dependency complexity may cause delays');
    }

    return risks;
  }

  toGantt(plan) {
    // Simplified Gantt representation
    return plan.phases.map(phase => 
      `${phase.name}: ${phase.estimatedDays} days (${phase.dependencies.join(', ') || 'no deps'})`
    ).join('\n');
  }

  toCsv(plan) {
    const headers = 'Phase,Description,Duration,Dependencies\n';
    const rows = plan.phases.map(phase => 
      `${phase.name},${phase.description},${phase.estimatedDays},"${phase.dependencies.join(', ')}"`
    ).join('\n');
    return headers + rows;
  }

  toPdf(plan) {
    // Mock PDF generation
    return `PDF: Development Plan for ${plan.name}`;
  }
}

// Test context
let testContext = {};

describe('Plan Generation from Specifications', () => {
  beforeEach(() => {
    testContext = {
      planGenerator: new PlanGenerator(),
      sampleSpec: {
        id: 'spec-1',
        name: 'UserAuthentication',
        description: 'User login and logout system',
        type: 'feature',
        priority: 'high'
      },
      generatedPlan: null
    };
  });

  // Scenario: Generating basic development plan
  describe('Generating basic development plan', () => {
    it('should generate plan with standard phases', async () => {
      const plan = await testContext.planGenerator.generatePlan(testContext.sampleSpec);
      testContext.generatedPlan = plan;

      expect(plan).toBeDefined();
      expect(plan.id).toBeDefined();
      expect(plan.name).toBe('Development Plan for UserAuthentication');
      expect(plan.phases).toHaveLength(5);
      
      const phaseNames = plan.phases.map(p => p.name);
      expect(phaseNames).toContain('analysis');
      expect(phaseNames).toContain('design');
      expect(phaseNames).toContain('development');
      expect(phaseNames).toContain('testing');
      expect(phaseNames).toContain('deployment');
    });

    it('should estimate durations for each phase', async () => {
      const plan = await testContext.planGenerator.generatePlan(testContext.sampleSpec);
      
      plan.phases.forEach(phase => {
        expect(phase.estimatedDays).toBeGreaterThan(0);
        expect(typeof phase.estimatedDays).toBe('number');
      });

      expect(plan.totalEstimatedDays).toBeGreaterThan(0);
      expect(plan.totalEstimatedDays).toBe(
        plan.phases.reduce((sum, phase) => sum + phase.estimatedDays, 0)
      );
    });

    it('should identify phase dependencies', async () => {
      const plan = await testContext.planGenerator.generatePlan(testContext.sampleSpec);
      
      const analysisPhase = plan.phases.find(p => p.name === 'analysis');
      const designPhase = plan.phases.find(p => p.name === 'design');
      const developmentPhase = plan.phases.find(p => p.name === 'development');

      expect(analysisPhase.dependencies).toHaveLength(0);
      expect(designPhase.dependencies).toContain('analysis');
      expect(developmentPhase.dependencies).toContain('design');
    });
  });

  // Scenario: Plan generation with custom templates
  describe('Plan generation with custom templates', () => {
    it('should use agile sprint template', async () => {
      const plan = await testContext.planGenerator.generatePlan(
        testContext.sampleSpec, 
        { template: 'agile-sprint' }
      );

      expect(plan.template).toBe('agile-sprint');
      expect(plan.methodology).toBe('agile');
      
      const phaseNames = plan.phases.map(p => p.name);
      expect(phaseNames).toContain('sprint-planning');
      expect(phaseNames).toContain('development');
      expect(phaseNames).toContain('review');
      expect(phaseNames).toContain('retrospective');
    });

    it('should throw error for non-existent template', async () => {
      await expect(
        testContext.planGenerator.generatePlan(
          testContext.sampleSpec, 
          { template: 'non-existent' }
        )
      ).rejects.toThrow('Template not found: non-existent');
    });
  });

  // Scenario: Multi-specification plan generation
  describe('Multi-specification plan generation', () => {
    it('should generate comprehensive plan for multiple specs', async () => {
      const specifications = [
        { 
          id: 'spec-1', 
          name: 'UserAuthentication', 
          priority: 'high', 
          complexity: 'medium' 
        },
        { 
          id: 'spec-2', 
          name: 'UserProfile', 
          priority: 'medium', 
          complexity: 'low' 
        },
        { 
          id: 'spec-3', 
          name: 'UserPreferences', 
          priority: 'low', 
          complexity: 'low' 
        }
      ];

      const plan = await testContext.planGenerator.generateMultiSpecPlan(specifications);

      expect(plan.name).toBe('Multi-Specification Development Plan');
      expect(plan.specifications).toHaveLength(3);
      expect(plan.phases.length).toBeGreaterThan(5); // More phases for multiple specs
      expect(plan.parallelizationOpportunities).toBeDefined();
      expect(plan.dependencies).toBeDefined();
    });

    it('should prioritize specifications correctly', async () => {
      const specifications = [
        { id: 'spec-1', name: 'Low Priority', priority: 'low', complexity: 'high' },
        { id: 'spec-2', name: 'High Priority', priority: 'high', complexity: 'medium' },
        { id: 'spec-3', name: 'Medium Priority', priority: 'medium', complexity: 'low' }
      ];

      const plan = await testContext.planGenerator.generateMultiSpecPlan(specifications);
      
      // High priority should come first
      expect(plan.specifications[0].name).toBe('High Priority');
      // Among same priority, lower complexity should come first
      expect(plan.specifications[1].name).toBe('Medium Priority');
      expect(plan.specifications[2].name).toBe('Low Priority');
    });
  });

  // Scenario: Plan customization and refinement
  describe('Plan customization and refinement', () => {
    it('should customize plan with duration adjustments', async () => {
      const originalPlan = await testContext.planGenerator.generatePlan(testContext.sampleSpec);
      const customizations = [
        { action: 'adjust_duration', target: 'development', value: '2 weeks' }
      ];

      const customizedPlan = testContext.planGenerator.customizePlan(originalPlan, customizations);

      const developmentPhase = customizedPlan.phases.find(p => p.name === 'development');
      expect(developmentPhase.estimatedDays).toBe(14); // 2 weeks = 14 days
      expect(customizedPlan.lastModified).toBeDefined();
    });

    it('should add milestones to phases', async () => {
      const originalPlan = await testContext.planGenerator.generatePlan(testContext.sampleSpec);
      const customizations = [
        { action: 'add_milestone', target: 'testing', value: 'QA Gate' }
      ];

      const customizedPlan = testContext.planGenerator.customizePlan(originalPlan, customizations);

      const testingPhase = customizedPlan.phases.find(p => p.name === 'testing');
      expect(testingPhase.milestones).toBeDefined();
      expect(testingPhase.milestones).toHaveLength(1);
      expect(testingPhase.milestones[0].name).toBe('QA Gate');
    });

    it('should assign resources to phases', async () => {
      const originalPlan = await testContext.planGenerator.generatePlan(testContext.sampleSpec);
      const customizations = [
        { action: 'assign_resource', target: 'development', value: '2 devs' }
      ];

      const customizedPlan = testContext.planGenerator.customizePlan(originalPlan, customizations);

      const developmentPhase = customizedPlan.phases.find(p => p.name === 'development');
      expect(developmentPhase.resourceAssignments).toBeDefined();
      expect(developmentPhase.resourceAssignments.development).toBe('2 devs');
    });
  });

  // Scenario: Plan validation and feasibility check
  describe('Plan validation and feasibility check', () => {
    it('should validate plan with no constraints', async () => {
      const plan = await testContext.planGenerator.generatePlan(testContext.sampleSpec);
      const validation = testContext.planGenerator.validatePlan(plan);

      expect(validation.valid).toBe(true);
      expect(validation.issues).toHaveLength(0);
    });

    it('should detect timeline constraint violations', async () => {
      const plan = await testContext.planGenerator.generatePlan(testContext.sampleSpec);
      const constraints = { timeline: 10 }; // 10 days, less than typical plan

      const validation = testContext.planGenerator.validatePlan(plan, constraints);

      expect(validation.valid).toBe(false);
      expect(validation.issues.some(issue => issue.includes('exceeds timeline constraint'))).toBe(true);
      expect(validation.suggestions.some(suggestion => 
        suggestion.includes('reducing scope') || suggestion.includes('adding resources')
      )).toBe(true);
    });

    it('should identify resource constraint issues', async () => {
      const plan = await testContext.planGenerator.generatePlan(testContext.sampleSpec);
      const constraints = { resources: { developers: 1 } };

      const validation = testContext.planGenerator.validatePlan(plan, constraints);

      // This depends on the plan requiring more than 1 developer
      if (plan.phases.some(p => (p.resources.developers || 0) > 1)) {
        expect(validation.issues.some(issue => 
          issue.includes('Insufficient developers')
        )).toBe(true);
      }
    });
  });

  // Scenario: Plan export and sharing
  describe('Plan export and sharing', () => {
    it('should export to Gantt format', async () => {
      const plan = await testContext.planGenerator.generatePlan(testContext.sampleSpec);
      const ganttExport = testContext.planGenerator.exportPlan(plan, 'gantt');

      expect(ganttExport).toBeDefined();
      expect(typeof ganttExport).toBe('string');
      expect(ganttExport).toContain('analysis:');
      expect(ganttExport).toContain('development:');
      expect(ganttExport).toContain('days');
    });

    it('should export to JSON format', async () => {
      const plan = await testContext.planGenerator.generatePlan(testContext.sampleSpec);
      const jsonExport = testContext.planGenerator.exportPlan(plan, 'json');

      expect(jsonExport).toBeDefined();
      const parsed = JSON.parse(jsonExport);
      expect(parsed.id).toBe(plan.id);
      expect(parsed.phases).toHaveLength(plan.phases.length);
    });

    it('should export to CSV format', async () => {
      const plan = await testContext.planGenerator.generatePlan(testContext.sampleSpec);
      const csvExport = testContext.planGenerator.exportPlan(plan, 'csv');

      expect(csvExport).toBeDefined();
      expect(csvExport).toContain('Phase,Description,Duration,Dependencies');
      expect(csvExport.split('\n').length).toBeGreaterThan(1); // Header + data rows
    });

    it('should throw error for unsupported format', async () => {
      const plan = await testContext.planGenerator.generatePlan(testContext.sampleSpec);
      
      expect(() => {
        testContext.planGenerator.exportPlan(plan, 'unsupported');
      }).toThrow('Unsupported format: unsupported');
    });
  });
});