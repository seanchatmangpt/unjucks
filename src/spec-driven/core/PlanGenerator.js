/**
 * PlanGenerator - Execution plan generation engine
 * 
 * Converts specifications into actionable execution plans
 * that can be processed by the task orchestrator.
 */

import path from 'node:path';
import fs from 'fs-extra';

export class PlanGenerator {
  constructor(options = {}) {
    this.options = {
      templatesDir: '_templates',
      validationEngine: null,
      ...options
    };
  }

  /**
   * Generate execution plan from specification
   * @param {Object} spec - Project specification
   * @returns {Promise<Object>} Execution plan
   */
  async generatePlan(spec) {
    const planId = this.generatePlanId();
    
    try {
      const plan = {
        id: planId,
        metadata: {
          name: `${spec.metadata.name}-execution-plan`,
          description: `Execution plan for ${spec.metadata.name}`,
          createdAt: this.getDeterministicDate().toISOString(),
          specification: {
            name: spec.metadata.name,
            version: spec.metadata.version || '1.0.0'
          }
        },
        phases: await this.generatePhases(spec),
        dependencies: await this.analyzeDependencies(spec),
        resources: await this.calculateResources(spec),
        timeline: await this.estimateTimeline(spec)
      };

      return plan;
    } catch (error) {
      throw new Error(`Failed to generate execution plan: ${error.message}`);
    }
  }

  /**
   * Generate execution phases from specification
   * @private
   * @param {Object} spec - Project specification
   * @returns {Promise<Array>} Execution phases
   */
  async generatePhases(spec) {
    const phases = [
      {
        id: 'setup',
        name: 'Project Setup',
        description: 'Initialize project structure',
        order: 1,
        tasks: ['create-structure', 'setup-config']
      },
      {
        id: 'core',
        name: 'Core Implementation',
        description: 'Implement core components',
        order: 2,
        tasks: await this.generateCoreTasks(spec)
      },
      {
        id: 'integration',
        name: 'Integration',
        description: 'Integrate components and test',
        order: 3,
        tasks: ['integration-tests', 'validation']
      }
    ];

    return phases;
  }

  /**
   * Generate core implementation tasks
   * @private
   * @param {Object} spec - Project specification
   * @returns {Promise<Array>} Core tasks
   */
  async generateCoreTasks(spec) {
    const tasks = [];
    
    if (spec.specification?.components) {
      for (const component of spec.specification.components) {
        tasks.push(`implement-${component.name || component.id}`);
      }
    }

    if (spec.specification?.requirements?.functional) {
      for (const req of spec.specification.requirements.functional) {
        tasks.push(`implement-requirement-${req.id}`);
      }
    }

    return tasks.length > 0 ? tasks : ['implement-core'];
  }

  /**
   * Analyze task dependencies
   * @private
   * @param {Object} spec - Project specification
   * @returns {Promise<Array>} Dependencies
   */
  async analyzeDependencies(spec) {
    return [
      {
        from: 'setup',
        to: 'core',
        type: 'sequential'
      },
      {
        from: 'core',
        to: 'integration',
        type: 'sequential'
      }
    ];
  }

  /**
   * Calculate resource requirements
   * @private
   * @param {Object} spec - Project specification
   * @returns {Promise<Object>} Resource requirements
   */
  async calculateResources(spec) {
    const componentCount = spec.specification?.components?.length || 1;
    const requirementCount = spec.specification?.requirements?.functional?.length || 1;
    
    return {
      estimatedTime: Math.max(componentCount * 15, requirementCount * 10, 30),
      complexity: componentCount > 5 ? 'high' : componentCount > 2 ? 'medium' : 'low',
      resources: {
        generators: componentCount,
        templates: Math.ceil(componentCount * 1.5),
        tests: componentCount + Math.ceil(requirementCount * 0.5)
      }
    };
  }

  /**
   * Estimate project timeline
   * @private
   * @param {Object} spec - Project specification
   * @returns {Promise<Object>} Timeline estimation
   */
  async estimateTimeline(spec) {
    const resources = await this.calculateResources(spec);
    
    return {
      estimatedDuration: `${resources.estimatedTime} minutes`,
      phases: {
        setup: '5-10 minutes',
        core: `${Math.ceil(resources.estimatedTime * 0.7)} minutes`,
        integration: '5-15 minutes'
      },
      milestones: [
        {
          name: 'Project Setup Complete',
          phase: 'setup'
        },
        {
          name: 'Core Implementation Complete',
          phase: 'core'
        },
        {
          name: 'Integration Complete',
          phase: 'integration'
        }
      ]
    };
  }

  /**
   * Generate unique plan ID
   * @private
   * @returns {string} Plan ID
   */
  generatePlanId() {
    const timestamp = this.getDeterministicTimestamp();
    const random = Math.random().toString(36).substr(2, 9);
    return `plan-${timestamp}-${random}`;
  }
}