import { defineCommand } from "citty";
import chalk from "chalk";
import fs from 'fs-extra';
import path from 'node:path';
import yaml from 'yaml';

/**
 * Granular task breakdown generator from specifications
 * Creates actionable development tasks from high-level plans
 */
export const tasksCommand = defineCommand({
  meta: {
    name: "tasks",
    description: "Break down specifications into granular, actionable development tasks",
  },
  args: {
    planFile: {
      type: "string",
      description: "Development plan file to break down into tasks", 
      default: "specs/development-plan.yaml",
      alias: "p",
    },
    specDir: {
      type: "string",
      description: "Directory containing specifications",
      default: "specs",
      alias: "s",
    },
    output: {
      type: "string",
      description: "Output file for generated tasks",
      default: "specs/tasks.yaml",
      alias: "o",
    },
    format: {
      type: "string",
      description: "Output format (yaml, json, markdown, github, jira)",
      default: "yaml",
      alias: "f",
    },
    granularity: {
      type: "string",
      description: "Task granularity level (coarse, medium, fine)",
      default: "medium",
      alias: "g",
    },
    estimateHours: {
      type: "boolean",
      description: "Include hour-based time estimates for each task",
      default: true,
      alias: "e",
    },
    assignTeams: {
      type: "boolean",
      description: "Suggest team/role assignments for tasks",
      default: true,
      alias: "a",
    },
    includeDependencies: {
      type: "boolean",
      description: "Include task dependency mapping",
      default: true,
      alias: "d",
    },
    prioritize: {
      type: "boolean",
      description: "Prioritize tasks based on business value and dependencies",
      default: true,
    },
    sprint: {
      type: "boolean",
      description: "Group tasks into sprint-sized iterations",
      default: false,
    },
    sprintSize: {
      type: "number",
      description: "Sprint size in hours (for sprint grouping)",
      default: 80,
    },
    verbose: {
      type: "boolean",
      description: "Enable verbose logging",
      default: false,
      alias: "v",
    },
    dry: {
      type: "boolean",
      description: "Preview tasks without writing files",
      default: false,
    },
  },
  async run(context) {
    const { args } = context;
    const startTime = this.getDeterministicTimestamp();

    try {
      console.log(chalk.blue("🔧 Breaking Down Specifications into Tasks"));
      
      if (args.verbose) {
        console.log(chalk.gray("Configuration:"), {
          planFile: args.planFile,
          specDir: args.specDir,
          granularity: args.granularity,
          format: args.format,
          estimateHours: args.estimateHours
        });
      }

      // Load development plan if it exists
      let developmentPlan = null;
      if (await fs.pathExists(args.planFile)) {
        try {
          const planContent = await fs.readFile(args.planFile, 'utf8');
          developmentPlan = yaml.parse(planContent);
          
          if (args.verbose) {
            console.log(chalk.green(`✓ Loaded development plan: ${args.planFile}`));
          }
        } catch (error) {
          console.warn(chalk.yellow(`Warning: Could not load plan file: ${error.message}`));
        }
      } else {
        console.warn(chalk.yellow(`Warning: Plan file not found: ${args.planFile}`));
        console.log(chalk.blue("💡 Generate a plan first with: unjucks specify plan"));
      }

      // Initialize task breakdown engine
      const taskBreakdown = new TaskBreakdownEngine(args.specDir, {
        granularity: args.granularity,
        estimateHours: args.estimateHours,
        assignTeams: args.assignTeams,
        includeDependencies: args.includeDependencies,
        verbose: args.verbose
      });

      // Generate tasks from plan and/or specifications
      const result = await taskBreakdown.generateTasks(developmentPlan);

      if (!result.success) {
        console.error(chalk.red("\n❌ Task breakdown failed:"));
        console.error(chalk.red(`  ${result.error}`));
        return result;
      }

      if (args.verbose) {
        console.log(chalk.cyan("\n📊 Task Breakdown Results:"));
        console.log(chalk.gray(`  Total tasks: ${result.tasks.length}`));
        console.log(chalk.gray(`  Estimated total effort: ${result.totalEstimatedHours || 'N/A'} hours`));
        console.log(chalk.gray(`  Average task size: ${result.averageTaskSize || 'N/A'} hours`));
      }

      // Prioritize tasks if requested
      if (args.prioritize) {
        result.tasks = this.prioritizeTasks(result.tasks);
      }

      // Group into sprints if requested
      if (args.sprint) {
        result.sprints = this.groupIntoSprints(result.tasks, args.sprintSize);
      }

      // Format output according to selected format
      let formattedOutput;
      switch (args.format) {
        case 'json':
          formattedOutput = JSON.stringify(result, null, 2);
          break;
        case 'markdown':
          formattedOutput = this.formatTasksAsMarkdown(result, args);
          break;
        case 'github':
          formattedOutput = this.formatTasksAsGitHubIssues(result, args);
          break;
        case 'jira':
          formattedOutput = this.formatTasksAsJiraCSV(result, args);
          break;
        case 'yaml':
        default:
          formattedOutput = yaml.stringify(result, { 
            indent: 2, 
            lineWidth: 120
          });
          break;
      }

      if (args.dry) {
        console.log(chalk.yellow("\n🔍 Dry Run - Task Breakdown Preview:"));
        console.log(chalk.gray("=" * 60));
        console.log(formattedOutput.substring(0, 1500) + (formattedOutput.length > 1500 ? '...\n[truncated]' : ''));
        console.log(chalk.gray("=" * 60));
        
        console.log(chalk.blue(`\n✨ Task breakdown completed in ${this.getDeterministicTimestamp() - startTime}ms`));
        console.log(chalk.gray(`Run without --dry to save to: ${args.output}`));
        
        return {
          success: true,
          message: "Task breakdown generated (dry run)",
          tasks: result.tasks
        };
      }

      // Write tasks to file
      await fs.ensureDir(path.dirname(args.output));
      await fs.writeFile(args.output, formattedOutput, 'utf8');

      const duration = this.getDeterministicTimestamp() - startTime;

      console.log(chalk.green("\n✅ Task breakdown generated successfully"));
      console.log(chalk.cyan(`📄 Tasks saved to: ${args.output}`));
      console.log(chalk.gray(`⏱️  Completed in ${duration}ms`));

      // Show task summary
      console.log(chalk.blue("\n📋 Task Summary:"));
      console.log(chalk.gray(`  🎯 Total tasks: ${result.tasks.length}`));
      console.log(chalk.gray(`  ⏱️  Estimated effort: ${result.totalEstimatedHours || 'N/A'} hours`));
      if (result.sprints) {
        console.log(chalk.gray(`  🏃 Sprints: ${result.sprints.length}`));
      }

      // Show priority distribution
      const priorityCount = result.tasks.reduce((acc, task) => {
        acc[task.priority] = (acc[task.priority] || 0) + 1;
        return acc;
      }, {});
      
      console.log(chalk.blue("\n📊 Priority Distribution:"));
      Object.entries(priorityCount).forEach(([priority, count]) => {
        console.log(chalk.gray(`  ${priority}: ${count} tasks`));
      });

      // Show next steps
      console.log(chalk.blue("\n📝 Next steps:"));
      console.log(chalk.gray("  1. Review and refine the generated tasks"));
      console.log(chalk.gray("  2. Assign tasks to team members"));
      console.log(chalk.gray("  3. Import into your project management tool"));
      console.log(chalk.gray("  4. Start development with highest priority tasks"));

      return {
        success: true,
        message: "Task breakdown generated successfully",
        taskFile: args.output,
        duration,
        tasks: result.tasks,
        totalTasks: result.tasks.length
      };

    } catch (error) {
      console.error(chalk.red("\n❌ Task breakdown failed:"));
      console.error(chalk.red(`  ${error.message}`));
      
      if (args.verbose && error.stack) {
        console.error(chalk.gray("\n📍 Stack trace:"));
        console.error(chalk.gray(error.stack));
      }
      
      return {
        success: false,
        message: "Task breakdown failed",
        error: error.message
      };
    }
  },

  // Helper methods for task prioritization and formatting
  prioritizeTasks(tasks) {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    
    return tasks.sort((a, b) => {
      // First sort by priority
      const priorityDiff = (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2);
      if (priorityDiff !== 0) return priorityDiff;
      
      // Then by dependency count (tasks with fewer dependencies first)
      const depDiff = (a.dependencies?.length || 0) - (b.dependencies?.length || 0);
      if (depDiff !== 0) return depDiff;
      
      // Finally by estimated effort (smaller tasks first)
      const effortOrder = { small: 0, medium: 1, large: 2 };
      return (effortOrder[a.effort] || 1) - (effortOrder[b.effort] || 1);
    });
  },

  groupIntoSprints(tasks, sprintSizeHours) {
    const sprints = [];
    let currentSprint = { 
      name: `Sprint ${sprints.length + 1}`, 
      tasks: [], 
      totalHours: 0,
      startDate: null,
      endDate: null
    };

    const effortHours = { small: 4, medium: 16, large: 40 };

    for (const task of tasks) {
      const taskHours = task.estimatedHours || effortHours[task.effort] || 8;
      
      // Check if adding this task would exceed sprint capacity
      if (currentSprint.totalHours + taskHours > sprintSizeHours && currentSprint.tasks.length > 0) {
        sprints.push(currentSprint);
        currentSprint = { 
          name: `Sprint ${sprints.length + 1}`, 
          tasks: [], 
          totalHours: 0,
          startDate: null,
          endDate: null
        };
      }

      currentSprint.tasks.push(task);
      currentSprint.totalHours += taskHours;
    }

    // Add the last sprint if it has tasks
    if (currentSprint.tasks.length > 0) {
      sprints.push(currentSprint);
    }

    return sprints;
  },

  formatTasksAsMarkdown(result, args) {
    let markdown = `# Development Tasks\n\n`;
    markdown += `**Generated:** ${this.getDeterministicDate().toISOString()}\n`;
    markdown += `**Total Tasks:** ${result.tasks.length}\n`;
    markdown += `**Estimated Effort:** ${result.totalEstimatedHours || 'N/A'} hours\n\n`;

    if (result.sprints) {
      markdown += `## Sprint Breakdown\n\n`;
      result.sprints.forEach((sprint, index) => {
        markdown += `### ${sprint.name} (${sprint.totalHours}h)\n\n`;
        sprint.tasks.forEach((task, taskIndex) => {
          markdown += `${taskIndex + 1}. **${task.title}** (${task.priority})\n`;
          markdown += `   - Effort: ${task.effort} (${task.estimatedHours || 'N/A'}h)\n`;
          markdown += `   - Team: ${task.assignedTeam || 'Unassigned'}\n`;
          if (task.dependencies && task.dependencies.length > 0) {
            markdown += `   - Dependencies: ${task.dependencies.join(', ')}\n`;
          }
          markdown += `   - ${task.description}\n\n`;
        });
      });
    } else {
      markdown += `## Tasks by Priority\n\n`;
      
      const tasksByPriority = result.tasks.reduce((acc, task) => {
        if (!acc[task.priority]) acc[task.priority] = [];
        acc[task.priority].push(task);
        return acc;
      }, {});

      ['critical', 'high', 'medium', 'low'].forEach(priority => {
        if (tasksByPriority[priority]) {
          markdown += `### ${priority.charAt(0).toUpperCase() + priority.slice(1)} Priority\n\n`;
          tasksByPriority[priority].forEach((task, index) => {
            markdown += `${index + 1}. **${task.title}**\n`;
            markdown += `   - Effort: ${task.effort} (${task.estimatedHours || 'N/A'}h)\n`;
            markdown += `   - Team: ${task.assignedTeam || 'Unassigned'}\n`;
            markdown += `   - ${task.description}\n\n`;
          });
        }
      });
    }

    return markdown;
  },

  formatTasksAsGitHubIssues(result, args) {
    let output = `# GitHub Issues Template\n\n`;
    output += `Copy and paste each section below as a new GitHub issue.\n\n`;
    
    result.tasks.forEach((task, index) => {
      output += `## Issue ${index + 1}: ${task.title}\n\n`;
      output += `**Priority:** ${task.priority}\n`;
      output += `**Effort:** ${task.effort} (${task.estimatedHours || 'N/A'}h)\n`;
      output += `**Team:** ${task.assignedTeam || 'Unassigned'}\n\n`;
      output += `**Description:**\n${task.description}\n\n`;
      
      if (task.acceptanceCriteria && task.acceptanceCriteria.length > 0) {
        output += `**Acceptance Criteria:**\n`;
        task.acceptanceCriteria.forEach(criterion => {
          output += `- [ ] ${criterion}\n`;
        });
        output += `\n`;
      }

      if (task.dependencies && task.dependencies.length > 0) {
        output += `**Dependencies:**\n`;
        task.dependencies.forEach(dep => {
          output += `- ${dep}\n`;
        });
        output += `\n`;
      }

      output += `**Labels:** \`${task.priority}\`, \`${task.effort}\`, \`${task.category || 'feature'}\`\n\n`;
      output += `---\n\n`;
    });

    return output;
  },

  formatTasksAsJiraCSV(result, args) {
    const headers = [
      'Summary',
      'Description', 
      'Priority',
      'Story Points',
      'Estimated Hours',
      'Component',
      'Labels',
      'Dependencies'
    ];

    let csv = headers.join(',') + '\n';
    
    result.tasks.forEach(task => {
      const storyPoints = { small: 1, medium: 3, large: 8 }[task.effort] || 3;
      
      const row = [
        `"${task.title}"`,
        `"${task.description.replace(/"/g, '""')}"`,
        task.priority,
        storyPoints,
        task.estimatedHours || '',
        `"${task.component || ''}"`,
        `"${task.priority},${task.effort},${task.category || 'feature'}"`,
        `"${(task.dependencies || []).join('; ')}"`
      ];
      
      csv += row.join(',') + '\n';
    });

    return csv;
  }
});

/**
 * Task breakdown engine that converts high-level plans into granular tasks
 */
class TaskBreakdownEngine {
  constructor(specDir, options = {}) {
    this.specDir = path.resolve(specDir);
    this.granularity = options.granularity || 'medium';
    this.estimateHours = options.estimateHours || true;
    this.assignTeams = options.assignTeams || true;
    this.includeDependencies = options.includeDependencies || true;
    this.verbose = options.verbose || false;
  }

  async generateTasks(developmentPlan = null) {
    try {
      const tasks = [];
      let totalEstimatedHours = 0;

      // Generate tasks from development plan if available
      if (developmentPlan && developmentPlan.phases) {
        const planTasks = await this.generateTasksFromPlan(developmentPlan);
        tasks.push(...planTasks);
      }

      // Generate additional tasks from specifications
      const specTasks = await this.generateTasksFromSpecs();
      tasks.push(...specTasks);

      // Remove duplicates and merge similar tasks
      const uniqueTasks = this.deduplicateTasks(tasks);

      // Add effort estimation
      if (this.estimateHours) {
        uniqueTasks.forEach(task => {
          task.estimatedHours = this.estimateTaskHours(task);
          totalEstimatedHours += task.estimatedHours;
        });
      }

      // Assign teams if requested
      if (this.assignTeams) {
        uniqueTasks.forEach(task => {
          task.assignedTeam = this.assignTeam(task);
        });
      }

      // Add dependencies if requested
      if (this.includeDependencies) {
        this.mapTaskDependencies(uniqueTasks);
      }

      return {
        success: true,
        tasks: uniqueTasks,
        totalEstimatedHours,
        averageTaskSize: uniqueTasks.length > 0 ? (totalEstimatedHours / uniqueTasks.length).toFixed(1) : 0,
        metadata: {
          generated: this.getDeterministicDate().toISOString(),
          granularity: this.granularity,
          totalTasks: uniqueTasks.length
        }
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async generateTasksFromPlan(plan) {
    const tasks = [];
    
    if (!plan.phases) return tasks;

    for (const phase of plan.phases) {
      if (!phase.tasks) continue;

      for (const phaseTask of phase.tasks) {
        // Break down phase tasks based on granularity
        const subtasks = this.breakdownPhaseTask(phaseTask, phase);
        tasks.push(...subtasks);
      }
    }

    return tasks;
  }

  async generateTasksFromSpecs() {
    const tasks = [];
    
    // Generate tasks from requirements
    const requirements = await this.loadRequirements();
    for (const req of requirements) {
      const reqTasks = this.generateTasksFromRequirement(req);
      tasks.push(...reqTasks);
    }

    // Generate tasks from architecture specs
    const components = await this.loadArchitectureComponents();
    for (const comp of components) {
      const compTasks = this.generateTasksFromComponent(comp);
      tasks.push(...compTasks);
    }

    return tasks;
  }

  breakdownPhaseTask(phaseTask, phase) {
    const tasks = [];
    const taskPrefix = phaseTask.name.replace(/\s+/g, '_').toLowerCase();

    switch (this.granularity) {
      case 'coarse':
        // Keep tasks as-is from the plan
        tasks.push({
          id: `${taskPrefix}`,
          title: phaseTask.name,
          description: phaseTask.description,
          priority: phaseTask.priority || 'medium',
          effort: phaseTask.effort || 'medium',
          category: this.categorizeTask(phaseTask.name),
          phase: phase.name,
          dependencies: phaseTask.dependencies || []
        });
        break;

      case 'medium':
        // Break down into 2-4 subtasks
        tasks.push(...this.generateMediumGranularityTasks(phaseTask, phase));
        break;

      case 'fine':
        // Break down into many small tasks
        tasks.push(...this.generateFineGranularityTasks(phaseTask, phase));
        break;
    }

    return tasks;
  }

  generateMediumGranularityTasks(phaseTask, phase) {
    const tasks = [];
    const baseName = phaseTask.name;
    const baseId = baseName.replace(/\s+/g, '_').toLowerCase();

    // Common task breakdown patterns
    if (baseName.includes('Implement')) {
      tasks.push(
        {
          id: `${baseId}_design`,
          title: `Design ${baseName.replace('Implement ', '')}`,
          description: `Create detailed design and architecture for ${baseName.replace('Implement ', '').toLowerCase()}`,
          priority: phaseTask.priority || 'medium',
          effort: 'small',
          category: 'design',
          phase: phase.name,
          dependencies: phaseTask.dependencies || []
        },
        {
          id: `${baseId}_code`,
          title: `Code ${baseName.replace('Implement ', '')}`,
          description: `Write implementation code for ${baseName.replace('Implement ', '').toLowerCase()}`,
          priority: phaseTask.priority || 'medium', 
          effort: 'medium',
          category: 'development',
          phase: phase.name,
          dependencies: [`${baseId}_design`]
        },
        {
          id: `${baseId}_test`,
          title: `Test ${baseName.replace('Implement ', '')}`,
          description: `Create and execute tests for ${baseName.replace('Implement ', '').toLowerCase()}`,
          priority: phaseTask.priority || 'medium',
          effort: 'small',
          category: 'testing',
          phase: phase.name,
          dependencies: [`${baseId}_code`]
        }
      );
    } else if (baseName.includes('Setup') || baseName.includes('Infrastructure')) {
      tasks.push(
        {
          id: `${baseId}_plan`,
          title: `Plan ${baseName}`,
          description: `Create setup plan and requirements for ${baseName.toLowerCase()}`,
          priority: phaseTask.priority || 'medium',
          effort: 'small', 
          category: 'planning',
          phase: phase.name,
          dependencies: phaseTask.dependencies || []
        },
        {
          id: `${baseId}_configure`,
          title: `Configure ${baseName.replace('Setup ', '').replace('Infrastructure ', '')}`,
          description: `Configure and deploy ${baseName.toLowerCase()}`,
          priority: phaseTask.priority || 'medium',
          effort: 'medium',
          category: 'devops',
          phase: phase.name,
          dependencies: [`${baseId}_plan`]
        }
      );
    } else {
      // Generic breakdown
      tasks.push({
        id: baseId,
        title: baseName,
        description: phaseTask.description,
        priority: phaseTask.priority || 'medium',
        effort: phaseTask.effort || 'medium',
        category: this.categorizeTask(baseName),
        phase: phase.name,
        dependencies: phaseTask.dependencies || []
      });
    }

    return tasks;
  }

  generateFineGranularityTasks(phaseTask, phase) {
    const tasks = [];
    const mediumTasks = this.generateMediumGranularityTasks(phaseTask, phase);
    
    // Further break down each medium task
    mediumTasks.forEach(mediumTask => {
      if (mediumTask.category === 'development') {
        // Break development tasks into smaller pieces
        const baseId = mediumTask.id;
        tasks.push(
          {
            id: `${baseId}_models`,
            title: `Create Data Models for ${mediumTask.title}`,
            description: `Define data models and schemas`,
            priority: mediumTask.priority,
            effort: 'small',
            category: 'development',
            phase: phase.name,
            dependencies: mediumTask.dependencies
          },
          {
            id: `${baseId}_services`,
            title: `Implement Services for ${mediumTask.title}`,
            description: `Create business logic and services`,
            priority: mediumTask.priority,
            effort: 'small',
            category: 'development',
            phase: phase.name,
            dependencies: [`${baseId}_models`]
          },
          {
            id: `${baseId}_api`,
            title: `Create API Endpoints for ${mediumTask.title}`,
            description: `Implement REST/GraphQL endpoints`,
            priority: mediumTask.priority,
            effort: 'small',
            category: 'development',
            phase: phase.name,
            dependencies: [`${baseId}_services`]
          }
        );
      } else {
        // Keep non-development tasks as medium granularity
        tasks.push(mediumTask);
      }
    });

    return tasks;
  }

  generateTasksFromRequirement(requirement) {
    const tasks = [];
    const reqId = requirement.id.toLowerCase().replace(/[^a-z0-9]/g, '_');
    
    tasks.push({
      id: `req_${reqId}_analysis`,
      title: `Analyze Requirement: ${requirement.title}`,
      description: `Detailed analysis and breakdown of ${requirement.title}`,
      priority: requirement.priority,
      effort: 'small',
      category: 'analysis',
      requirement: requirement.id,
      acceptanceCriteria: requirement.acceptanceCriteria || []
    });

    if (requirement.type === 'functional') {
      tasks.push({
        id: `req_${reqId}_implement`,
        title: `Implement ${requirement.title}`,
        description: requirement.description || `Implement functional requirement: ${requirement.title}`,
        priority: requirement.priority,
        effort: this.estimateRequirementEffort(requirement),
        category: 'development',
        requirement: requirement.id,
        dependencies: [`req_${reqId}_analysis`],
        acceptanceCriteria: requirement.acceptanceCriteria || []
      });
    }

    return tasks;
  }

  generateTasksFromComponent(component) {
    const tasks = [];
    const compId = component.name.toLowerCase().replace(/[^a-z0-9]/g, '_');

    tasks.push(
      {
        id: `comp_${compId}_design`,
        title: `Design Component: ${component.name}`,
        description: `Create detailed design for ${component.name} component`,
        priority: 'medium',
        effort: 'small',
        category: 'design',
        component: component.name
      },
      {
        id: `comp_${compId}_implement`,
        title: `Implement Component: ${component.name}`,
        description: component.description || `Implement ${component.name} component`,
        priority: 'medium',
        effort: this.estimateComponentEffort(component),
        category: 'development',
        component: component.name,
        dependencies: [`comp_${compId}_design`]
      }
    );

    return tasks;
  }

  // Helper methods for task processing
  categorizeTask(taskName) {
    const name = taskName.toLowerCase();
    
    if (name.includes('design') || name.includes('architect')) return 'design';
    if (name.includes('implement') || name.includes('code') || name.includes('develop')) return 'development';
    if (name.includes('test') || name.includes('validation')) return 'testing';
    if (name.includes('deploy') || name.includes('setup') || name.includes('configure')) return 'devops';
    if (name.includes('document') || name.includes('spec')) return 'documentation';
    if (name.includes('plan') || name.includes('analyze')) return 'planning';
    
    return 'feature';
  }

  estimateTaskHours(task) {
    const baseHours = {
      small: 4,
      medium: 16,
      large: 40
    };

    let hours = baseHours[task.effort] || 8;

    // Adjust based on category
    const categoryMultipliers = {
      design: 0.8,
      development: 1.0,
      testing: 0.6,
      devops: 1.2,
      documentation: 0.5,
      planning: 0.7
    };

    hours *= categoryMultipliers[task.category] || 1.0;

    // Adjust based on priority
    const priorityMultipliers = {
      critical: 1.3,
      high: 1.1,
      medium: 1.0,
      low: 0.9
    };

    hours *= priorityMultipliers[task.priority] || 1.0;

    return Math.ceil(hours);
  }

  assignTeam(task) {
    const teamAssignments = {
      design: 'Architecture Team',
      development: 'Development Team',
      testing: 'QA Team', 
      devops: 'DevOps Team',
      documentation: 'Technical Writing',
      planning: 'Product Team'
    };

    return teamAssignments[task.category] || 'Development Team';
  }

  estimateRequirementEffort(requirement) {
    const criteriaCount = requirement.acceptanceCriteria?.length || 1;
    if (criteriaCount <= 2) return 'small';
    if (criteriaCount <= 5) return 'medium';
    return 'large';
  }

  estimateComponentEffort(component) {
    const responsibilityCount = component.responsibilities?.length || 1;
    if (responsibilityCount <= 2) return 'small';
    if (responsibilityCount <= 5) return 'medium';
    return 'large';
  }

  deduplicateTasks(tasks) {
    const seen = new Set();
    const unique = [];

    tasks.forEach(task => {
      const key = `${task.title}_${task.category}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(task);
      }
    });

    return unique;
  }

  mapTaskDependencies(tasks) {
    // Enhanced dependency mapping logic would go here
    // For now, just ensure referenced dependencies exist
    tasks.forEach(task => {
      if (task.dependencies) {
        task.dependencies = task.dependencies.filter(dep => 
          tasks.some(t => t.id === dep || t.title.includes(dep))
        );
      }
    });
  }

  async loadRequirements() {
    // Simplified requirement loading - in practice would use the same logic as the plan command
    try {
      const requirementsDir = path.join(this.specDir, 'requirements');
      if (!(await fs.pathExists(requirementsDir))) return [];

      const files = await this.findYamlFiles(requirementsDir);
      const requirements = [];

      for (const file of files) {
        try {
          const content = await fs.readFile(file, 'utf8');
          const spec = yaml.parse(content);
          if (spec && spec.id) {
            requirements.push(spec);
          }
        } catch (error) {
          if (this.verbose) {
            console.warn(`Warning: Failed to load ${file}: ${error.message}`);
          }
        }
      }

      return requirements;
    } catch (error) {
      return [];
    }
  }

  async loadArchitectureComponents() {
    // Simplified component loading
    try {
      const archDir = path.join(this.specDir, 'architecture');
      if (!(await fs.pathExists(archDir))) return [];

      const files = await this.findYamlFiles(archDir);
      const components = [];

      for (const file of files) {
        try {
          const content = await fs.readFile(file, 'utf8');
          const spec = yaml.parse(content);
          if (spec && spec.component) {
            components.push(spec.component);
          }
        } catch (error) {
          if (this.verbose) {
            console.warn(`Warning: Failed to load ${file}: ${error.message}`);
          }
        }
      }

      return components;
    } catch (error) {
      return [];
    }
  }

  async findYamlFiles(dir) {
    const files = [];
    
    async function traverse(currentDir) {
      const items = await fs.readdir(currentDir, { withFileTypes: true });
      
      for (const item of items) {
        const fullPath = path.join(currentDir, item.name);
        
        if (item.isDirectory()) {
          await traverse(fullPath);
        } else if (item.isFile() && (item.name.endsWith('.yaml') || item.name.endsWith('.yml'))) {
          files.push(fullPath);
        }
      }
    }

    try {
      await traverse(dir);
    } catch (error) {
      // Directory doesn't exist or permission error
    }
    
    return files;
  }
}