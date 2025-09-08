/**
 * TaskOrchestrator - Task execution and coordination engine
 * 
 * Orchestrates the execution of tasks generated from execution plans,
 * managing dependencies, coordination, and result aggregation.
 */

import fs from 'fs-extra';
import path from 'node:path';

export class TaskOrchestrator {
  constructor(options = {}) {
    this.options = {
      outputDir: './generated',
      validationEngine: null,
      maxConcurrency: 3,
      ...options
    };
    
    this.runningTasks = new Map();
    this.completedTasks = new Map();
  }

  /**
   * Generate task list from execution plan
   * @param {Object} plan - Execution plan
   * @returns {Promise<Object>} Task list
   */
  async generateTasks(plan) {
    const taskListId = this.generateTaskListId();
    
    try {
      const tasks = [];
      
      for (const phase of plan.phases) {
        for (const taskName of phase.tasks) {
          const task = await this.createTask(taskName, phase, plan);
          tasks.push(task);
        }
      }

      return {
        id: taskListId,
        metadata: {
          name: `${plan.metadata.name}-tasks`,
          description: `Task list generated from ${plan.metadata.name}`,
          createdAt: new Date().toISOString(),
          planId: plan.id,
          totalTasks: tasks.length
        },
        tasks,
        dependencies: plan.dependencies || [],
        configuration: {
          maxConcurrency: this.options.maxConcurrency,
          outputDir: this.options.outputDir
        }
      };
    } catch (error) {
      throw new Error(`Failed to generate tasks: ${error.message}`);
    }
  }

  /**
   * Execute task list
   * @param {Object} taskList - Task list to execute
   * @param {Object} options - Execution options
   * @returns {Promise<Object>} Execution result
   */
  async executeTasks(taskList, options = {}) {
    const executionId = this.generateExecutionId();
    const startTime = new Date();
    
    try {
      const results = {
        success: true,
        executionId,
        metrics: {
          startTime,
          tasksTotal: taskList.tasks.length,
          tasksCompleted: 0,
          tasksSkipped: 0,
          tasksFailed: 0,
          filesGenerated: 0
        },
        phases: [],
        tasks: [],
        validation: {
          valid: true,
          errors: [],
          warnings: []
        },
        artifacts: {}
      };

      // Execute tasks in phases
      for (const task of taskList.tasks) {
        try {
          const taskResult = await this.executeTask(task, options);
          results.tasks.push(taskResult);
          
          if (taskResult.success) {
            results.metrics.tasksCompleted++;
            if (taskResult.filesGenerated) {
              results.metrics.filesGenerated += taskResult.filesGenerated;
            }
          } else {
            results.metrics.tasksFailed++;
            results.success = false;
          }
          
        } catch (error) {
          results.metrics.tasksFailed++;
          results.success = false;
          results.tasks.push({
            taskId: task.id,
            success: false,
            error: error.message,
            duration: 0,
            artifacts: {}
          });
        }
      }

      const endTime = new Date();
      results.metrics.endTime = endTime;
      results.metrics.duration = endTime.getTime() - startTime.getTime();

      return results;
    } catch (error) {
      const endTime = new Date();
      return {
        success: false,
        executionId,
        error: error.message,
        metrics: {
          startTime,
          endTime,
          duration: endTime.getTime() - startTime.getTime(),
          tasksCompleted: 0,
          tasksTotal: taskList.tasks.length,
          tasksFailed: taskList.tasks.length,
          filesGenerated: 0
        },
        phases: [],
        tasks: [],
        validation: {
          valid: false,
          errors: [{
            code: 'EXECUTION_ERROR',
            message: error.message,
            severity: 'error'
          }],
          warnings: []
        },
        artifacts: {}
      };
    }
  }

  /**
   * Create task from task name and phase
   * @private
   * @param {string} taskName - Name of task to create
   * @param {Object} phase - Phase the task belongs to
   * @param {Object} plan - Execution plan
   * @returns {Promise<Object>} Task definition
   */
  async createTask(taskName, phase, plan) {
    return {
      id: this.generateTaskId(taskName),
      name: taskName,
      phase: phase.id,
      description: `Execute ${taskName} in ${phase.name} phase`,
      generator: await this.mapTaskToGenerator(taskName, plan),
      dependencies: [],
      configuration: {
        timeout: 30000,
        retries: 1
      },
      output: {
        path: this.options.outputDir,
        type: 'file'
      }
    };
  }

  /**
   * Map task to generator configuration
   * @private
   * @param {string} taskName - Task name
   * @param {Object} plan - Execution plan
   * @returns {Promise<Object>} Generator configuration
   */
  async mapTaskToGenerator(taskName, plan) {
    // Simple task to generator mapping
    const mappings = {
      'create-structure': { generator: 'project', template: 'structure' },
      'setup-config': { generator: 'config', template: 'basic' },
      'integration-tests': { generator: 'test', template: 'integration' },
      'validation': { generator: 'test', template: 'validation' }
    };

    // Handle component implementation tasks
    if (taskName.startsWith('implement-')) {
      const componentName = taskName.replace('implement-', '').replace('requirement-', '');
      return {
        generator: 'component',
        template: 'basic',
        variables: {
          name: componentName,
          type: 'component'
        }
      };
    }

    return mappings[taskName] || { 
      generator: 'generic', 
      template: 'default',
      variables: { taskName }
    };
  }

  /**
   * Execute individual task
   * @private
   * @param {Object} task - Task to execute
   * @param {Object} options - Execution options
   * @returns {Promise<Object>} Task execution result
   */
  async executeTask(task, options = {}) {
    const startTime = new Date();
    
    try {
      // Simulate task execution (in real implementation, this would
      // call the actual generator system)
      const mockResult = await this.simulateTaskExecution(task, options);
      
      const endTime = new Date();
      
      return {
        taskId: task.id,
        success: true,
        duration: endTime.getTime() - startTime.getTime(),
        artifacts: mockResult.artifacts || {},
        filesGenerated: mockResult.filesGenerated || 0,
        output: mockResult.output || ''
      };
      
    } catch (error) {
      const endTime = new Date();
      
      return {
        taskId: task.id,
        success: false,
        error: error.message,
        duration: endTime.getTime() - startTime.getTime(),
        artifacts: {},
        filesGenerated: 0
      };
    }
  }

  /**
   * Simulate task execution for validation purposes
   * @private
   * @param {Object} task - Task to simulate
   * @param {Object} options - Execution options
   * @returns {Promise<Object>} Simulation result
   */
  async simulateTaskExecution(task, options) {
    // Simple simulation - in real implementation this would integrate
    // with the existing generator system
    const delay = Math.random() * 1000 + 500; // 0.5-1.5 seconds
    await new Promise(resolve => setTimeout(resolve, delay));
    
    return {
      artifacts: {
        [`${task.name}.generated`]: 'mock-content'
      },
      filesGenerated: 1,
      output: `Task ${task.name} completed successfully`
    };
  }

  /**
   * Generate task list ID
   * @private
   * @returns {string} Task list ID
   */
  generateTaskListId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `tasks-${timestamp}-${random}`;
  }

  /**
   * Generate task ID
   * @private
   * @param {string} taskName - Task name
   * @returns {string} Task ID
   */
  generateTaskId(taskName) {
    const timestamp = Date.now();
    const cleanName = taskName.replace(/[^a-zA-Z0-9]/g, '-');
    return `task-${cleanName}-${timestamp}`;
  }

  /**
   * Generate execution ID
   * @private
   * @returns {string} Execution ID
   */
  generateExecutionId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `exec-${timestamp}-${random}`;
  }
}