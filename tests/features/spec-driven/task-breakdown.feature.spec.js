import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { tmpdir } from 'os';

// Mock implementations for task breakdown system
class TaskBreakdownEngine {
  constructor() {
    this.templates = new Map([
      ['crud_api', [
        { name: 'Create endpoint', category: 'backend', estimatedHours: 4 },
        { name: 'Read endpoint', category: 'backend', estimatedHours: 2 },
        { name: 'Update endpoint', category: 'backend', estimatedHours: 4 },
        { name: 'Delete endpoint', category: 'backend', estimatedHours: 3 }
      ]],
      ['ui_component', [
        { name: 'Design component', category: 'frontend', estimatedHours: 3 },
        { name: 'Implement component', category: 'frontend', estimatedHours: 6 },
        { name: 'Test component', category: 'testing', estimatedHours: 2 },
        { name: 'Document component', category: 'documentation', estimatedHours: 1 }
      ]]
    ]);
  }

  breakdownSpecification(specification, options = {}) {
    const tasks = [];

    // Generate basic tasks based on specification type
    if (specification.type === 'feature') {
      tasks.push(...this.generateFeatureTasks(specification));
    } else if (specification.type === 'bug') {
      tasks.push(...this.generateBugTasks(specification));
    }

    // Apply templates if specified
    if (options.template && this.templates.has(options.template)) {
      tasks.push(...this.generateTemplatedTasks(specification, options.template));
    }

    // Add acceptance criteria tasks
    if (specification.acceptance) {
      tasks.push(...this.generateAcceptanceTasks(specification.acceptance));
    }

    // Set task IDs and metadata
    tasks.forEach((task, index) => {
      task.id = `task-${specification.id}-${index + 1}`;
      task.specificationId = specification.id;
      task.acceptanceCriteria = this.generateTaskAcceptanceCriteria(task);
      task.status = 'pending';
      task.createdAt = this.getDeterministicDate().toISOString();
    });

    return this.validateAndOptimizeTasks(tasks);
  }

  analyzeDependencies(tasks) {
    const dependencyMap = new Map();
    
    tasks.forEach(task => {
      const dependencies = this.calculateTaskDependencies(task, tasks);
      dependencyMap.set(task.id, dependencies);
      task.dependencies = dependencies;
    });

    // Check for circular dependencies
    const cycles = this.detectDependencyCycles(dependencyMap);
    if (cycles.length > 0) {
      throw new Error(`Circular dependencies detected: ${cycles.map(c => c.join(' -> ')).join(', ')}`);
    }

    // Calculate execution order
    const executionOrder = this.calculateExecutionOrder(tasks, dependencyMap);
    
    return {
      dependencyMap: Object.fromEntries(dependencyMap),
      executionOrder,
      parallelOpportunities: this.identifyParallelTasks(tasks, dependencyMap)
    };
  }

  estimateTasks(tasks, technique = 'story_points') {
    return tasks.map(task => {
      const estimatedTask = { ...task };
      
      switch (technique) {
        case 'story_points':
          estimatedTask.storyPoints = this.calculateStoryPoints(task);
          estimatedTask.confidence = this.calculateConfidence(task);
          break;
        case 'time_hours':
          estimatedTask.timeHours = this.calculateTimeHours(task);
          estimatedTask.confidence = this.calculateConfidence(task);
          break;
        case 'both':
          estimatedTask.storyPoints = this.calculateStoryPoints(task);
          estimatedTask.timeHours = this.calculateTimeHours(task);
          estimatedTask.confidence = this.calculateConfidence(task);
          break;
      }

      // Check if task needs splitting
      if (estimatedTask.timeHours > 16) {
        estimatedTask.needsSplitting = true;
        estimatedTask.suggestedSplit = this.suggestTaskSplit(task);
      }

      return estimatedTask;
    });
  }

  categorizeAndLabelTasks(tasks) {
    return tasks.map(task => {
      const categorizedTask = { ...task };
      
      // Skill categorization
      categorizedTask.skillRequired = this.determineRequiredSkill(task);
      
      // Complexity categorization
      categorizedTask.complexity = this.determineComplexity(task);
      
      // Priority categorization  
      categorizedTask.priority = this.determinePriority(task);
      
      // Type categorization
      categorizedTask.type = this.determineTaskType(task);
      
      // Add labels for filtering
      categorizedTask.labels = [
        categorizedTask.skillRequired,
        categorizedTask.complexity,
        categorizedTask.priority,
        categorizedTask.type,
        categorizedTask.category
      ].filter(Boolean);

      return categorizedTask;
    });
  }

  createHierarchicalStructure(tasks, specification) {
    const hierarchy = {
      epic: {
        id: `epic-${specification.id}`,
        name: specification.name,
        description: specification.description,
        level: 'epic',
        children: []
      }
    };

    // Group tasks by feature areas
    const featureGroups = this.groupTasksByFeature(tasks);
    
    featureGroups.forEach((featureTasks, featureName) => {
      const feature = {
        id: `feature-${featureName.replace(/\s+/g, '-').toLowerCase()}`,
        name: featureName,
        level: 'feature',
        children: []
      };

      // Create stories for each group of related tasks
      const storyGroups = this.groupTasksByStory(featureTasks);
      
      storyGroups.forEach((storyTasks, storyName) => {
        const story = {
          id: `story-${storyName.replace(/\s+/g, '-').toLowerCase()}`,
          name: storyName,
          level: 'story',
          children: storyTasks.map(task => ({
            ...task,
            level: 'task',
            children: task.subtasks || []
          }))
        };
        
        feature.children.push(story);
      });

      hierarchy.epic.children.push(feature);
    });

    // Calculate rollup estimates
    this.calculateRollupEstimates(hierarchy.epic);

    return hierarchy;
  }

  assignTasks(tasks, teamMembers, options = {}) {
    const assignments = new Map();
    const workloadMap = new Map();

    // Initialize workload tracking
    teamMembers.forEach(member => {
      workloadMap.set(member.id, {
        member,
        currentLoad: member.currentCapacity || 0,
        maxCapacity: member.maxCapacity || 40, // hours per week
        assignedTasks: []
      });
    });

    // Sort tasks by priority and dependencies
    const sortedTasks = this.sortTasksForAssignment(tasks);

    sortedTasks.forEach(task => {
      const bestMatch = this.findBestAssignment(task, workloadMap, options);
      
      if (bestMatch) {
        assignments.set(task.id, bestMatch.member.id);
        bestMatch.assignedTasks.push(task);
        bestMatch.currentLoad += task.estimatedHours || 8; // default estimate
        
        task.assignedTo = bestMatch.member.id;
        task.assignedAt = this.getDeterministicDate().toISOString();
      } else {
        task.assignmentIssue = 'No suitable team member found';
      }
    });

    return {
      assignments: Object.fromEntries(assignments),
      workloadDistribution: Object.fromEntries(
        Array.from(workloadMap.entries()).map(([id, data]) => [
          id, {
            member: data.member.name,
            utilization: (data.currentLoad / data.maxCapacity * 100).toFixed(1) + '%',
            assignedTasks: data.assignedTasks.length,
            overloaded: data.currentLoad > data.maxCapacity
          }
        ])
      ),
      unassignedTasks: tasks.filter(task => !task.assignedTo)
    };
  }

  refineTasksWithNewInfo(tasks, newInformation) {
    const refinedTasks = [...tasks];
    const changes = [];

    newInformation.forEach(info => {
      switch (info.action) {
        case 'split':
          const splitResult = this.splitTask(refinedTasks, info.taskId, info.criteria);
          changes.push(...splitResult.changes);
          break;
        case 'merge':
          const mergeResult = this.mergeTasks(refinedTasks, info.taskIds, info.reason);
          changes.push(...mergeResult.changes);
          break;
        case 'reprioritize':
          const repriorityResult = this.reprioritizeTasks(refinedTasks, info.updates);
          changes.push(...repriorityResult.changes);
          break;
        case 're-estimate':
          const reestimateResult = this.reestimateTasks(refinedTasks, info.updates);
          changes.push(...reestimateResult.changes);
          break;
      }
    });

    return {
      refinedTasks,
      changes,
      impactAnalysis: this.analyzeRefinementImpact(changes),
      timelineAdjustment: this.calculateTimelineAdjustment(refinedTasks, tasks)
    };
  }

  // Private helper methods
  generateFeatureTasks(specification) {
    return [
      { 
        name: 'API endpoint development', 
        category: 'backend', 
        task_type: 'API endpoint', 
        estimated_hours: 8,
        description: `Create API endpoints for ${specification.name}`
      },
      { 
        name: 'Database schema design', 
        category: 'backend', 
        task_type: 'Database schema', 
        estimated_hours: 4,
        description: `Design database schema for ${specification.name}`
      },
      { 
        name: 'Frontend implementation', 
        category: 'frontend', 
        task_type: 'UI component', 
        estimated_hours: 6,
        description: `Implement user interface for ${specification.name}`
      },
      { 
        name: 'Unit test development', 
        category: 'testing', 
        task_type: 'Unit tests', 
        estimated_hours: 8,
        description: `Create unit tests for ${specification.name}`
      },
      { 
        name: 'Integration testing', 
        category: 'testing', 
        task_type: 'Integration tests', 
        estimated_hours: 6,
        description: `Create integration tests for ${specification.name}`
      }
    ];
  }

  generateBugTasks(specification) {
    return [
      {
        name: 'Bug investigation',
        category: 'investigation',
        task_type: 'research',
        estimated_hours: 4,
        description: `Investigate and identify root cause of ${specification.name}`
      },
      {
        name: 'Bug fix implementation',
        category: 'backend',
        task_type: 'bug fix',
        estimated_hours: 6,
        description: `Implement fix for ${specification.name}`
      },
      {
        name: 'Regression testing',
        category: 'testing',
        task_type: 'regression tests',
        estimated_hours: 4,
        description: `Test fix and ensure no regression for ${specification.name}`
      }
    ];
  }

  generateTemplatedTasks(specification, templateName) {
    const template = this.templates.get(templateName);
    return template.map(taskTemplate => ({
      ...taskTemplate,
      description: `${taskTemplate.name} for ${specification.name}`,
      template: templateName
    }));
  }

  generateAcceptanceTasks(acceptanceCriteria) {
    return acceptanceCriteria.map((criterion, index) => ({
      name: `Acceptance test: ${criterion}`,
      category: 'testing',
      task_type: 'acceptance test',
      estimated_hours: 3,
      description: `Implement and verify: ${criterion}`,
      acceptanceCriterion: criterion
    }));
  }

  generateTaskAcceptanceCriteria(task) {
    const baseCriteria = [
      'Code follows project standards',
      'All tests are passing',
      'Code is reviewed and approved'
    ];

    const specificCriteria = {
      'backend': ['API documentation updated', 'Error handling implemented'],
      'frontend': ['UI matches design specs', 'Accessibility requirements met'],
      'testing': ['Coverage requirements met', 'Test documentation updated']
    };

    return [
      ...baseCriteria,
      ...(specificCriteria[task.category] || [])
    ];
  }

  calculateTaskDependencies(task, allTasks) {
    const dependencies = [];
    
    // Simple dependency logic based on task types and categories
    if (task.category === 'frontend' && task.task_type === 'UI component') {
      const apiTasks = allTasks.filter(t => 
        t.category === 'backend' && t.task_type === 'API endpoint'
      );
      dependencies.push(...apiTasks.map(t => t.id));
    }

    if (task.category === 'testing' && task.task_type === 'Integration tests') {
      const implementationTasks = allTasks.filter(t => 
        t.category !== 'testing' && t !== task
      );
      dependencies.push(...implementationTasks.map(t => t.id));
    }

    return dependencies.filter(Boolean);
  }

  detectDependencyCycles(dependencyMap) {
    const visited = new Set();
    const recursionStack = new Set();
    const cycles = [];

    const detectCycle = (taskId, path = []) => {
      if (recursionStack.has(taskId)) {
        const cycleStart = path.indexOf(taskId);
        cycles.push(path.slice(cycleStart));
        return;
      }

      if (visited.has(taskId)) return;

      visited.add(taskId);
      recursionStack.add(taskId);
      path.push(taskId);

      const dependencies = dependencyMap.get(taskId) || [];
      dependencies.forEach(dep => detectCycle(dep, [...path]));

      recursionStack.delete(taskId);
    };

    Array.from(dependencyMap.keys()).forEach(taskId => {
      if (!visited.has(taskId)) {
        detectCycle(taskId);
      }
    });

    return cycles;
  }

  calculateExecutionOrder(tasks, dependencyMap) {
    const ordered = [];
    const remaining = new Set(tasks.map(t => t.id));
    const completed = new Set();

    while (remaining.size > 0) {
      const ready = Array.from(remaining).filter(taskId => {
        const deps = dependencyMap.get(taskId) || [];
        return deps.every(dep => completed.has(dep));
      });

      if (ready.length === 0) {
        throw new Error('Cannot resolve task dependencies - possible circular dependency');
      }

      ready.forEach(taskId => {
        ordered.push(taskId);
        completed.add(taskId);
        remaining.delete(taskId);
      });
    }

    return ordered;
  }

  identifyParallelTasks(tasks, dependencyMap) {
    const parallelGroups = [];
    const processed = new Set();

    tasks.forEach(task => {
      if (processed.has(task.id)) return;

      const deps = dependencyMap.get(task.id) || [];
      if (deps.length === 0) {
        // Find all tasks with no dependencies that can run in parallel
        const parallelTasks = tasks.filter(t => 
          !processed.has(t.id) && 
          (dependencyMap.get(t.id) || []).length === 0
        );
        
        if (parallelTasks.length > 1) {
          parallelGroups.push(parallelTasks.map(t => t.id));
          parallelTasks.forEach(t => processed.add(t.id));
        }
      }
    });

    return parallelGroups;
  }

  calculateStoryPoints(task) {
    // Fibonacci-like point system based on complexity
    const complexityPoints = {
      'simple': 1,
      'medium': 3,
      'complex': 8
    };

    const hours = task.estimated_hours || 8;
    if (hours <= 4) return 1;
    if (hours <= 8) return 3;
    if (hours <= 16) return 8;
    if (hours <= 24) return 13;
    return 21;
  }

  calculateTimeHours(task) {
    if (task.estimated_hours) return task.estimated_hours;

    // Estimate based on task type and complexity
    const baseHours = {
      'API endpoint': 6,
      'Database schema': 4,
      'UI component': 8,
      'Unit tests': 4,
      'Integration tests': 6,
      'bug fix': 8
    };

    return baseHours[task.task_type] || 8;
  }

  calculateConfidence(task) {
    // Confidence based on task familiarity and complexity
    let confidence = 0.8; // Base confidence

    if (task.template) confidence += 0.1; // Template-based tasks are more predictable
    if (task.category === 'testing') confidence += 0.05; // Testing is usually well-understood
    if (task.complexity === 'complex') confidence -= 0.2;

    return Math.max(0.3, Math.min(0.95, confidence));
  }

  validateAndOptimizeTasks(tasks) {
    // Ensure proper task sizing
    const optimizedTasks = tasks.map(task => {
      if (task.estimated_hours > 16) {
        // Split large tasks
        return this.autoSplitTask(task);
      }
      return [task];
    }).flat();

    // Validate task completeness
    optimizedTasks.forEach(task => {
      if (!task.category) task.category = 'general';
      if (!task.estimated_hours) task.estimated_hours = 8;
      if (!task.acceptanceCriteria) task.acceptanceCriteria = [];
    });

    return optimizedTasks;
  }

  autoSplitTask(task) {
    const splitTasks = [];
    const targetHours = 8;
    const numSplits = Math.ceil(task.estimated_hours / targetHours);

    for (let i = 0; i < numSplits; i++) {
      splitTasks.push({
        ...task,
        name: `${task.name} - Part ${i + 1}`,
        estimated_hours: Math.min(targetHours, task.estimated_hours - (i * targetHours)),
        originalTask: task.id,
        partNumber: i + 1,
        totalParts: numSplits
      });
    }

    return splitTasks;
  }

  // Additional helper methods for the other features...
  determineRequiredSkill(task) {
    const skillMap = {
      'backend': 'backend',
      'frontend': 'frontend',
      'testing': 'testing',
      'documentation': 'technical-writing',
      'investigation': 'debugging'
    };
    return skillMap[task.category] || 'general';
  }

  determineComplexity(task) {
    const hours = task.estimated_hours || 8;
    if (hours <= 4) return 'simple';
    if (hours <= 12) return 'medium';
    return 'complex';
  }

  determinePriority(task) {
    // Simple priority logic
    if (task.task_type === 'API endpoint' || task.category === 'backend') return 'high';
    if (task.category === 'testing') return 'medium';
    return 'low';
  }

  determineTaskType(task) {
    if (task.task_type) return task.task_type;
    if (task.name.toLowerCase().includes('test')) return 'testing';
    if (task.name.toLowerCase().includes('bug')) return 'bug';
    if (task.name.toLowerCase().includes('refactor')) return 'refactor';
    return 'feature';
  }

  groupTasksByFeature(tasks) {
    const groups = new Map();
    
    tasks.forEach(task => {
      const featureName = task.category || 'General';
      if (!groups.has(featureName)) {
        groups.set(featureName, []);
      }
      groups.get(featureName).push(task);
    });

    return groups;
  }

  groupTasksByStory(tasks) {
    const groups = new Map();
    
    tasks.forEach(task => {
      const storyName = task.task_type || 'General';
      if (!groups.has(storyName)) {
        groups.set(storyName, []);
      }
      groups.get(storyName).push(task);
    });

    return groups;
  }

  calculateRollupEstimates(node) {
    if (!node.children || node.children.length === 0) {
      // Leaf node - use its own estimates
      return {
        storyPoints: node.storyPoints || 0,
        timeHours: node.timeHours || node.estimated_hours || 0
      };
    }

    // Internal node - sum up children
    let totalStoryPoints = 0;
    let totalTimeHours = 0;

    node.children.forEach(child => {
      const childEstimates = this.calculateRollupEstimates(child);
      totalStoryPoints += childEstimates.storyPoints;
      totalTimeHours += childEstimates.timeHours;
    });

    node.totalStoryPoints = totalStoryPoints;
    node.totalTimeHours = totalTimeHours;

    return { storyPoints: totalStoryPoints, timeHours: totalTimeHours };
  }

  sortTasksForAssignment(tasks) {
    return [...tasks].sort((a, b) => {
      const priorityOrder = { 'critical': 4, 'high': 3, 'medium': 2, 'low': 1 };
      const aPriority = priorityOrder[a.priority] || 2;
      const bPriority = priorityOrder[b.priority] || 2;

      if (aPriority !== bPriority) return bPriority - aPriority;
      
      // Secondary sort by dependencies (fewer dependencies first)
      const aDeps = (a.dependencies || []).length;
      const bDeps = (b.dependencies || []).length;
      
      return aDeps - bDeps;
    });
  }

  findBestAssignment(task, workloadMap, options) {
    const requiredSkill = this.determineRequiredSkill(task);
    const taskHours = task.estimated_hours || 8;

    let bestMatch = null;
    let bestScore = -1;

    for (const [memberId, workload] of workloadMap) {
      const member = workload.member;
      
      // Check capacity
      if (workload.currentLoad + taskHours > workload.maxCapacity) {
        continue;
      }

      // Calculate match score
      let score = 0;
      
      // Skill match
      if (member.skills && member.skills.includes(requiredSkill)) {
        score += 50;
      }

      // Workload balance (prefer less loaded members)
      const utilizationRatio = workload.currentLoad / workload.maxCapacity;
      score += (1 - utilizationRatio) * 30;

      // Preferences
      if (member.preferences && member.preferences.includes(task.category)) {
        score += 20;
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = workload;
      }
    }

    return bestMatch;
  }

  splitTask(tasks, taskId, criteria) {
    const taskIndex = tasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) {
      return { changes: [{ type: 'error', message: `Task ${taskId} not found` }] };
    }

    const originalTask = tasks[taskIndex];
    const splitTasks = this.autoSplitTask(originalTask);

    // Replace original task with split tasks
    tasks.splice(taskIndex, 1, ...splitTasks);

    return {
      changes: [
        { 
          type: 'split', 
          originalTaskId: taskId, 
          newTaskIds: splitTasks.map(t => t.id),
          reason: criteria
        }
      ]
    };
  }

  mergeTasks(tasks, taskIds, reason) {
    const tasksToMerge = taskIds.map(id => tasks.find(t => t.id === id)).filter(Boolean);
    
    if (tasksToMerge.length < 2) {
      return { changes: [{ type: 'error', message: 'At least 2 tasks required for merge' }] };
    }

    const mergedTask = {
      id: `merged-${this.getDeterministicTimestamp()}`,
      name: `${tasksToMerge[0].name} (merged)`,
      description: `Merged task: ${tasksToMerge.map(t => t.name).join(', ')}`,
      category: tasksToMerge[0].category,
      estimated_hours: tasksToMerge.reduce((sum, t) => sum + (t.estimated_hours || 8), 0),
      mergedFrom: taskIds,
      mergeReason: reason
    };

    // Remove original tasks and add merged task
    taskIds.forEach(id => {
      const index = tasks.findIndex(t => t.id === id);
      if (index !== -1) tasks.splice(index, 1);
    });
    tasks.push(mergedTask);

    return {
      changes: [
        {
          type: 'merge',
          originalTaskIds: taskIds,
          newTaskId: mergedTask.id,
          reason
        }
      ]
    };
  }

  reprioritizeTasks(tasks, updates) {
    const changes = [];
    
    updates.forEach(update => {
      const task = tasks.find(t => t.id === update.taskId);
      if (task) {
        const oldPriority = task.priority;
        task.priority = update.newPriority;
        changes.push({
          type: 'reprioritize',
          taskId: update.taskId,
          oldPriority,
          newPriority: update.newPriority
        });
      }
    });

    return { changes };
  }

  reestimateTasks(tasks, updates) {
    const changes = [];
    
    updates.forEach(update => {
      const task = tasks.find(t => t.id === update.taskId);
      if (task) {
        const oldEstimate = task.estimated_hours;
        task.estimated_hours = update.newEstimate;
        changes.push({
          type: 're-estimate',
          taskId: update.taskId,
          oldEstimate,
          newEstimate: update.newEstimate
        });
      }
    });

    return { changes };
  }

  analyzeRefinementImpact(changes) {
    return {
      totalChanges: changes.length,
      changeTypes: [...new Set(changes.map(c => c.type))],
      significantChanges: changes.filter(c => c.type === 'split' || c.type === 'merge').length
    };
  }

  calculateTimelineAdjustment(refinedTasks, originalTasks) {
    const originalTotal = originalTasks.reduce((sum, t) => sum + (t.estimated_hours || 8), 0);
    const refinedTotal = refinedTasks.reduce((sum, t) => sum + (t.estimated_hours || 8), 0);
    
    return {
      originalHours: originalTotal,
      refinedHours: refinedTotal,
      adjustment: refinedTotal - originalTotal,
      percentageChange: ((refinedTotal - originalTotal) / originalTotal * 100).toFixed(1) + '%'
    };
  }
}

// Test context
let testContext = {};

describe('Task Breakdown from Specifications', () => {
  beforeEach(() => {
    testContext = {
      taskEngine: new TaskBreakdownEngine(),
      sampleSpec: {
        id: 'spec-1',
        name: 'UserAuthentication',
        description: 'User login and logout system',
        type: 'feature',
        acceptance: [
          'User can login with valid credentials',
          'User receives error for invalid credentials',
          'User can logout successfully'
        ]
      },
      teamMembers: [
        { id: 'dev1', name: 'Alice', skills: ['backend', 'testing'], maxCapacity: 40 },
        { id: 'dev2', name: 'Bob', skills: ['frontend', 'testing'], maxCapacity: 35 },
        { id: 'dev3', name: 'Charlie', skills: ['backend', 'frontend'], maxCapacity: 40 }
      ]
    };
  });

  // Scenario: Basic task breakdown
  describe('Basic task breakdown', () => {
    it('should generate tasks for different categories', () => {
      const tasks = testContext.taskEngine.breakdownSpecification(testContext.sampleSpec);

      expect(tasks.length).toBeGreaterThan(0);
      
      const categories = [...new Set(tasks.map(t => t.category))];
      expect(categories).toContain('backend');
      expect(categories).toContain('frontend');
      expect(categories).toContain('testing');
    });

    it('should generate tasks with proper estimates', () => {
      const tasks = testContext.taskEngine.breakdownSpecification(testContext.sampleSpec);

      tasks.forEach(task => {
        expect(task.estimated_hours).toBeDefined();
        expect(task.estimated_hours).toBeGreaterThan(0);
        expect(task.estimated_hours).toBeLessThanOrEqual(16); // Should be properly sized
      });
    });

    it('should include acceptance criteria tasks', () => {
      const tasks = testContext.taskEngine.breakdownSpecification(testContext.sampleSpec);

      const acceptanceTasks = tasks.filter(t => t.acceptanceCriterion);
      expect(acceptanceTasks.length).toBe(testContext.sampleSpec.acceptance.length);
    });

    it('should assign unique IDs to tasks', () => {
      const tasks = testContext.taskEngine.breakdownSpecification(testContext.sampleSpec);

      const ids = tasks.map(t => t.id);
      const uniqueIds = [...new Set(ids)];
      expect(ids.length).toBe(uniqueIds.length);
    });
  });

  // Scenario: Task dependency resolution
  describe('Task dependency resolution', () => {
    it('should identify task dependencies', () => {
      const tasks = testContext.taskEngine.breakdownSpecification(testContext.sampleSpec);
      const analysis = testContext.taskEngine.analyzeDependencies(tasks);

      expect(analysis.dependencyMap).toBeDefined();
      expect(analysis.executionOrder).toBeDefined();
      expect(analysis.parallelOpportunities).toBeDefined();
      
      // Should have some dependencies
      const hasDependencies = Object.values(analysis.dependencyMap).some(deps => deps.length > 0);
      expect(hasDependencies).toBe(true);
    });

    it('should detect circular dependencies', () => {
      const tasks = [
        { id: 'task1', name: 'Task 1', category: 'backend' },
        { id: 'task2', name: 'Task 2', category: 'frontend' }
      ];

      // Manually create circular dependency
      tasks[0].dependencies = ['task2'];
      tasks[1].dependencies = ['task1'];

      expect(() => {
        testContext.taskEngine.analyzeDependencies(tasks);
      }).toThrow('Circular dependencies detected');
    });

    it('should calculate execution order', () => {
      const tasks = testContext.taskEngine.breakdownSpecification(testContext.sampleSpec);
      const analysis = testContext.taskEngine.analyzeDependencies(tasks);

      expect(analysis.executionOrder).toHaveLength(tasks.length);
      
      // All task IDs should be in execution order
      const taskIds = new Set(tasks.map(t => t.id));
      const orderIds = new Set(analysis.executionOrder);
      expect(taskIds).toEqual(orderIds);
    });

    it('should identify parallel execution opportunities', () => {
      const tasks = testContext.taskEngine.breakdownSpecification(testContext.sampleSpec);
      const analysis = testContext.taskEngine.analyzeDependencies(tasks);

      expect(analysis.parallelOpportunities).toBeDefined();
      expect(Array.isArray(analysis.parallelOpportunities)).toBe(true);
    });
  });

  // Scenario: Task estimation and sizing
  describe('Task estimation and sizing', () => {
    it('should estimate tasks using story points', () => {
      const tasks = testContext.taskEngine.breakdownSpecification(testContext.sampleSpec);
      const estimatedTasks = testContext.taskEngine.estimateTasks(tasks, 'story_points');

      estimatedTasks.forEach(task => {
        expect(task.storyPoints).toBeDefined();
        expect(task.confidence).toBeDefined();
        expect(task.storyPoints).toBeGreaterThan(0);
        expect(task.confidence).toBeGreaterThan(0);
        expect(task.confidence).toBeLessThanOrEqual(1);
      });
    });

    it('should estimate tasks using time hours', () => {
      const tasks = testContext.taskEngine.breakdownSpecification(testContext.sampleSpec);
      const estimatedTasks = testContext.taskEngine.estimateTasks(tasks, 'time_hours');

      estimatedTasks.forEach(task => {
        expect(task.timeHours).toBeDefined();
        expect(task.timeHours).toBeGreaterThan(0);
      });
    });

    it('should identify oversized tasks for splitting', () => {
      const largeTasks = [
        {
          id: 'large-task',
          name: 'Large Task',
          category: 'development',
          estimated_hours: 24 // Over 16 hour limit
        }
      ];

      const estimatedTasks = testContext.taskEngine.estimateTasks(largeTasks, 'time_hours');
      const largeTask = estimatedTasks[0];

      expect(largeTask.needsSplitting).toBe(true);
      expect(largeTask.suggestedSplit).toBeDefined();
    });
  });

  // Scenario: Task categorization and labeling
  describe('Task categorization and labeling', () => {
    it('should categorize tasks by skill, complexity, priority, and type', () => {
      const tasks = testContext.taskEngine.breakdownSpecification(testContext.sampleSpec);
      const categorizedTasks = testContext.taskEngine.categorizeAndLabelTasks(tasks);

      categorizedTasks.forEach(task => {
        expect(task.skillRequired).toBeDefined();
        expect(task.complexity).toBeOneOf(['simple', 'medium', 'complex']);
        expect(task.priority).toBeOneOf(['critical', 'high', 'medium', 'low']);
        expect(task.type).toBeDefined();
        expect(Array.isArray(task.labels)).toBe(true);
        expect(task.labels.length).toBeGreaterThan(0);
      });
    });

    it('should allow filtering by task dimensions', () => {
      const tasks = testContext.taskEngine.breakdownSpecification(testContext.sampleSpec);
      const categorizedTasks = testContext.taskEngine.categorizeAndLabelTasks(tasks);

      // Test filtering by skill
      const backendTasks = categorizedTasks.filter(t => t.skillRequired === 'backend');
      const frontendTasks = categorizedTasks.filter(t => t.skillRequired === 'frontend');
      
      expect(backendTasks.length).toBeGreaterThan(0);
      expect(frontendTasks.length).toBeGreaterThan(0);

      // Test filtering by complexity
      const simpleTasks = categorizedTasks.filter(t => t.complexity === 'simple');
      expect(Array.isArray(simpleTasks)).toBe(true);
    });
  });

  // Scenario: Hierarchical task structure
  describe('Hierarchical task structure', () => {
    it('should create hierarchical structure with epic, features, stories, and tasks', () => {
      const tasks = testContext.taskEngine.breakdownSpecification(testContext.sampleSpec);
      const hierarchy = testContext.taskEngine.createHierarchicalStructure(tasks, testContext.sampleSpec);

      expect(hierarchy.epic).toBeDefined();
      expect(hierarchy.epic.level).toBe('epic');
      expect(hierarchy.epic.name).toBe(testContext.sampleSpec.name);
      expect(hierarchy.epic.children).toBeDefined();
      expect(hierarchy.epic.children.length).toBeGreaterThan(0);

      // Check feature level
      const feature = hierarchy.epic.children[0];
      expect(feature.level).toBe('feature');
      expect(feature.children).toBeDefined();
    });

    it('should calculate rollup estimates', () => {
      const tasks = testContext.taskEngine.breakdownSpecification(testContext.sampleSpec);
      const estimatedTasks = testContext.taskEngine.estimateTasks(tasks, 'both');
      const hierarchy = testContext.taskEngine.createHierarchicalStructure(estimatedTasks, testContext.sampleSpec);

      expect(hierarchy.epic.totalStoryPoints).toBeDefined();
      expect(hierarchy.epic.totalTimeHours).toBeDefined();
      expect(hierarchy.epic.totalStoryPoints).toBeGreaterThan(0);
      expect(hierarchy.epic.totalTimeHours).toBeGreaterThan(0);
    });
  });

  // Scenario: Task assignment and allocation
  describe('Task assignment and allocation', () => {
    it('should assign tasks to team members based on skills and capacity', () => {
      const tasks = testContext.taskEngine.breakdownSpecification(testContext.sampleSpec);
      const categorizedTasks = testContext.taskEngine.categorizeAndLabelTasks(tasks);
      const assignment = testContext.taskEngine.assignTasks(categorizedTasks, testContext.teamMembers);

      expect(assignment.assignments).toBeDefined();
      expect(assignment.workloadDistribution).toBeDefined();
      expect(assignment.unassignedTasks).toBeDefined();

      // Check that assignments respect capacity
      Object.values(assignment.workloadDistribution).forEach(workload => {
        expect(workload.utilization).toBeDefined();
        expect(workload.assignedTasks).toBeDefined();
      });
    });

    it('should balance workload across team members', () => {
      const tasks = testContext.taskEngine.breakdownSpecification(testContext.sampleSpec);
      const assignment = testContext.taskEngine.assignTasks(tasks, testContext.teamMembers);

      const workloads = Object.values(assignment.workloadDistribution);
      const utilizationRates = workloads.map(w => parseFloat(w.utilization));
      
      // Check that no one is severely overloaded while others are idle
      const maxUtilization = Math.max(...utilizationRates);
      const minUtilization = Math.min(...utilizationRates);
      
      expect(maxUtilization - minUtilization).toBeLessThan(50); // Reasonable balance
    });

    it('should identify overloaded team members', () => {
      const heavyTasks = Array(10).fill().map((_, i) => ({
        id: `heavy-${i}`,
        name: `Heavy Task ${i}`,
        category: 'backend',
        estimated_hours: 20
      }));

      const assignment = testContext.taskEngine.assignTasks(heavyTasks, testContext.teamMembers);
      
      const overloadedMembers = Object.values(assignment.workloadDistribution)
        .filter(workload => workload.overloaded);
      
      // With heavy tasks, some members should be marked as overloaded
      expect(overloadedMembers.length).toBeGreaterThan(0);
    });
  });

  // Scenario: Dynamic task refinement
  describe('Dynamic task refinement', () => {
    it('should split tasks when needed', () => {
      const tasks = testContext.taskEngine.breakdownSpecification(testContext.sampleSpec);
      const largeTask = {
        id: 'large-task',
        name: 'Large Task',
        estimated_hours: 24
      };
      tasks.push(largeTask);

      const refinement = testContext.taskEngine.refineTasksWithNewInfo(tasks, [
        { action: 'split', taskId: 'large-task', criteria: 'Task too large' }
      ]);

      expect(refinement.refinedTasks.length).toBeGreaterThan(tasks.length);
      expect(refinement.changes).toHaveLength(1);
      expect(refinement.changes[0].type).toBe('split');
    });

    it('should merge related small tasks', () => {
      const tasks = [
        { id: 'small1', name: 'Small Task 1', estimated_hours: 2 },
        { id: 'small2', name: 'Small Task 2', estimated_hours: 2 }
      ];

      const refinement = testContext.taskEngine.refineTasksWithNewInfo(tasks, [
        { action: 'merge', taskIds: ['small1', 'small2'], reason: 'Related small tasks' }
      ]);

      expect(refinement.refinedTasks.length).toBe(1);
      expect(refinement.changes[0].type).toBe('merge');
    });

    it('should reprioritize tasks', () => {
      const tasks = [
        { id: 'task1', name: 'Task 1', priority: 'low' },
        { id: 'task2', name: 'Task 2', priority: 'medium' }
      ];

      const refinement = testContext.taskEngine.refineTasksWithNewInfo(tasks, [
        { action: 'reprioritize', updates: [
          { taskId: 'task1', newPriority: 'high' }
        ]}
      ]);

      const updatedTask = refinement.refinedTasks.find(t => t.id === 'task1');
      expect(updatedTask.priority).toBe('high');
      expect(refinement.changes[0].type).toBe('reprioritize');
    });

    it('should provide impact analysis', () => {
      const tasks = testContext.taskEngine.breakdownSpecification(testContext.sampleSpec);
      
      const refinement = testContext.taskEngine.refineTasksWithNewInfo(tasks, [
        { action: 're-estimate', updates: [
          { taskId: tasks[0].id, newEstimate: 16 }
        ]}
      ]);

      expect(refinement.impactAnalysis).toBeDefined();
      expect(refinement.timelineAdjustment).toBeDefined();
      expect(refinement.impactAnalysis.totalChanges).toBeGreaterThan(0);
    });
  });
});