import { defineCommand } from "citty";
import chalk from "chalk";
import fs from 'fs-extra';
import path from 'node:path';
import yaml from 'yaml';

/**
 * Specification-driven technical plan generator
 * Analyzes specs and generates comprehensive development plans
 */
export const planCommand = defineCommand({
  meta: {
    name: "plan",
    description: "Generate technical development plan from project specifications",
  },
  args: {
    specDir: {
      type: "string",
      description: "Directory containing specifications",
      default: "specs",
      alias: "s",
    },
    output: {
      type: "string", 
      description: "Output file for the generated plan",
      default: "specs/development-plan.yaml",
      alias: "o",
    },
    format: {
      type: "string",
      description: "Output format (yaml, json, markdown)",
      default: "yaml",
      alias: "f",
    },
    includeArchitecture: {
      type: "boolean",
      description: "Include architecture analysis in plan",
      default: true,
    },
    includeRequirements: {
      type: "boolean",
      description: "Include requirements analysis in plan",
      default: true,
    },
    includeDependencies: {
      type: "boolean",
      description: "Include dependency analysis and planning",
      default: true,
    },
    prioritize: {
      type: "boolean",
      description: "Generate priority-ordered implementation plan",
      default: true,
      alias: "p",
    },
    estimateEffort: {
      type: "boolean",
      description: "Include effort estimation for each component",
      default: true,
      alias: "e",
    },
    verbose: {
      type: "boolean",
      description: "Enable verbose logging",
      default: false,
      alias: "v",
    },
    dry: {
      type: "boolean",
      description: "Preview plan without writing files",
      default: false,
    },
  },
  async run(context) {
    const { args } = context;
    const startTime = this.getDeterministicTimestamp();

    try {
      console.log(chalk.blue("🗺️  Generating Technical Development Plan"));
      
      if (args.verbose) {
        console.log(chalk.gray("Configuration:"), {
          specDir: args.specDir,
          output: args.output,
          format: args.format,
          includeArchitecture: args.includeArchitecture,
          includeRequirements: args.includeRequirements
        });
      }

      // Validate spec directory exists
      if (!(await fs.pathExists(args.specDir))) {
        console.error(chalk.red(`\n❌ Specifications directory not found: ${args.specDir}`));
        console.log(chalk.blue("💡 Initialize project with: unjucks specify init <project>"));
        return {
          success: false,
          message: "Specs directory not found"
        };
      }

      // Analyze specifications
      const analyzer = new SpecificationAnalyzer(args.specDir, { verbose: args.verbose });
      const analysisResult = await analyzer.analyze({
        includeArchitecture: args.includeArchitecture,
        includeRequirements: args.includeRequirements,
        includeDependencies: args.includeDependencies
      });

      if (!analysisResult.success) {
        console.error(chalk.red("\n❌ Specification analysis failed:"));
        console.error(chalk.red(`  ${analysisResult.error}`));
        return analysisResult;
      }

      if (args.verbose) {
        console.log(chalk.cyan("\n📊 Analysis Results:"));
        console.log(chalk.gray(`  Requirements: ${analysisResult.requirements.length}`));
        console.log(chalk.gray(`  Components: ${analysisResult.architecture.components.length}`));
        console.log(chalk.gray(`  Dependencies: ${analysisResult.dependencies.length}`));
      }

      // Generate development plan
      const planner = new DevelopmentPlanner(analysisResult, {
        prioritize: args.prioritize,
        estimateEffort: args.estimateEffort,
        verbose: args.verbose
      });
      
      const plan = await planner.generatePlan();

      // Format output
      let formattedPlan;
      switch (args.format) {
        case 'json':
          formattedPlan = JSON.stringify(plan, null, 2);
          break;
        case 'markdown':
          formattedPlan = this.formatPlanAsMarkdown(plan);
          break;
        case 'yaml':
        default:
          formattedPlan = yaml.stringify(plan, { 
            indent: 2, 
            lineWidth: 120
          });
          break;
      }

      if (args.dry) {
        console.log(chalk.yellow("\n🔍 Dry Run - Generated Plan Preview:"));
        console.log(chalk.gray("=" * 60));
        console.log(formattedPlan.substring(0, 1000) + (formattedPlan.length > 1000 ? '...\n[truncated]' : ''));
        console.log(chalk.gray("=" * 60));
        
        console.log(chalk.blue(`\n✨ Plan generation completed in ${this.getDeterministicTimestamp() - startTime}ms`));
        console.log(chalk.gray(`Run without --dry to save to: ${args.output}`));
        
        return {
          success: true,
          message: "Plan generated (dry run)",
          plan
        };
      }

      // Write plan to file
      await fs.ensureDir(path.dirname(args.output));
      await fs.writeFile(args.output, formattedPlan, 'utf8');

      const duration = this.getDeterministicTimestamp() - startTime;

      console.log(chalk.green("\n✅ Development plan generated successfully"));
      console.log(chalk.cyan(`📄 Plan saved to: ${args.output}`));
      console.log(chalk.gray(`⏱️  Completed in ${duration}ms`));

      // Show plan summary
      console.log(chalk.blue("\n📋 Plan Summary:"));
      console.log(chalk.gray(`  🎯 Total phases: ${plan.phases.length}`));
      console.log(chalk.gray(`  🔧 Total tasks: ${plan.phases.reduce((sum, phase) => sum + phase.tasks.length, 0)}`));
      console.log(chalk.gray(`  ⚡ Estimated effort: ${plan.metadata.estimatedEffort || 'Not calculated'}`));
      console.log(chalk.gray(`  📊 Risk level: ${plan.metadata.riskLevel || 'Medium'}`));

      // Show next steps
      console.log(chalk.blue("\n📝 Next steps:"));
      console.log(chalk.gray("  1. Review the generated plan"));
      console.log(chalk.gray("  2. unjucks specify tasks (break down into granular tasks)"));
      console.log(chalk.gray("  3. unjucks specify validate (validate specifications)"));

      return {
        success: true,
        message: "Plan generated successfully",
        planPath: args.output,
        duration,
        plan
      };

    } catch (error) {
      console.error(chalk.red("\n❌ Plan generation failed:"));
      console.error(chalk.red(`  ${error.message}`));
      
      if (args.verbose && error.stack) {
        console.error(chalk.gray("\n📍 Stack trace:"));
        console.error(chalk.gray(error.stack));
      }
      
      return {
        success: false,
        message: "Plan generation failed",
        error: error.message
      };
    }
  },

  // Helper method to format plan as Markdown
  formatPlanAsMarkdown(plan) {
    let markdown = `# Development Plan: ${plan.metadata.projectName}\n\n`;
    markdown += `**Generated:** ${plan.metadata.generated}\n`;
    markdown += `**Version:** ${plan.metadata.version}\n\n`;

    if (plan.overview) {
      markdown += `## Overview\n\n${plan.overview}\n\n`;
    }

    if (plan.phases && plan.phases.length > 0) {
      markdown += `## Development Phases\n\n`;
      
      plan.phases.forEach((phase, index) => {
        markdown += `### Phase ${index + 1}: ${phase.name}\n\n`;
        markdown += `**Priority:** ${phase.priority}\n`;
        markdown += `**Estimated Duration:** ${phase.estimatedDuration || 'TBD'}\n\n`;
        
        if (phase.description) {
          markdown += `${phase.description}\n\n`;
        }

        if (phase.tasks && phase.tasks.length > 0) {
          markdown += `#### Tasks:\n\n`;
          phase.tasks.forEach((task, taskIndex) => {
            markdown += `${taskIndex + 1}. **${task.name}**\n`;
            markdown += `   - Priority: ${task.priority}\n`;
            markdown += `   - Effort: ${task.effort || 'TBD'}\n`;
            if (task.dependencies && task.dependencies.length > 0) {
              markdown += `   - Dependencies: ${task.dependencies.join(', ')}\n`;
            }
            markdown += `   - ${task.description}\n\n`;
          });
        }
      });
    }

    if (plan.risks && plan.risks.length > 0) {
      markdown += `## Risks & Mitigations\n\n`;
      plan.risks.forEach(risk => {
        markdown += `- **${risk.description}** (${risk.impact})\n`;
        markdown += `  - Mitigation: ${risk.mitigation}\n\n`;
      });
    }

    return markdown;
  }
});

/**
 * Analyzes project specifications to extract requirements, architecture, and dependencies
 */
class SpecificationAnalyzer {
  constructor(specDir, options = {}) {
    this.specDir = path.resolve(specDir);
    this.verbose = options.verbose || false;
  }

  async analyze(options = {}) {
    try {
      const result = {
        success: true,
        requirements: [],
        architecture: { components: [], interfaces: [] },
        dependencies: [],
        metadata: {}
      };

      // Load project metadata
      const projectSpecPath = path.join(this.specDir, 'project.spec.yaml');
      if (await fs.pathExists(projectSpecPath)) {
        const projectSpec = yaml.parse(await fs.readFile(projectSpecPath, 'utf8'));
        result.metadata = projectSpec.metadata || {};
      }

      // Analyze requirements
      if (options.includeRequirements) {
        result.requirements = await this.analyzeRequirements();
      }

      // Analyze architecture 
      if (options.includeArchitecture) {
        result.architecture = await this.analyzeArchitecture();
      }

      // Analyze dependencies
      if (options.includeDependencies) {
        result.dependencies = await this.analyzeDependencies();
      }

      return result;

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async analyzeRequirements() {
    const requirements = [];
    const requirementsDir = path.join(this.specDir, 'requirements');
    
    if (!(await fs.pathExists(requirementsDir))) {
      return requirements;
    }

    const specFiles = await this.findYamlFiles(requirementsDir);
    
    for (const filePath of specFiles) {
      try {
        const content = await fs.readFile(filePath, 'utf8');
        const spec = yaml.parse(content);
        
        if (spec && spec.id) {
          requirements.push({
            id: spec.id,
            title: spec.title,
            type: spec.type || 'functional',
            priority: spec.priority || 'medium',
            status: spec.status || 'draft',
            description: spec.description,
            acceptanceCriteria: spec.acceptance_criteria || [],
            dependencies: spec.dependencies || [],
            filePath
          });
        }
      } catch (error) {
        if (this.verbose) {
          console.warn(chalk.yellow(`Warning: Failed to parse ${filePath}: ${error.message}`));
        }
      }
    }

    return requirements;
  }

  async analyzeArchitecture() {
    const architecture = { components: [], interfaces: [] };
    const archDir = path.join(this.specDir, 'architecture');
    
    if (!(await fs.pathExists(archDir))) {
      return architecture;
    }

    const specFiles = await this.findYamlFiles(archDir);
    
    for (const filePath of specFiles) {
      try {
        const content = await fs.readFile(filePath, 'utf8');
        const spec = yaml.parse(content);
        
        if (spec && spec.component) {
          architecture.components.push({
            name: spec.component.name,
            type: spec.component.type,
            layer: spec.component.layer,
            description: spec.description,
            responsibilities: spec.responsibilities || [],
            interfaces: spec.interfaces || {},
            implementation: spec.implementation || {},
            qualityAttributes: spec.quality_attributes || {},
            filePath
          });
        }
      } catch (error) {
        if (this.verbose) {
          console.warn(chalk.yellow(`Warning: Failed to parse ${filePath}: ${error.message}`));
        }
      }
    }

    return architecture;
  }

  async analyzeDependencies() {
    const dependencies = [];
    
    // Extract dependencies from requirements and architecture specs
    // This is a simplified implementation - in practice, you'd want more sophisticated dependency analysis
    
    return dependencies;
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

    await traverse(dir);
    return files;
  }
}

/**
 * Generates comprehensive development plans from analyzed specifications
 */
class DevelopmentPlanner {
  constructor(analysisResult, options = {}) {
    this.analysisResult = analysisResult;
    this.prioritize = options.prioritize || true;
    this.estimateEffort = options.estimateEffort || true;
    this.verbose = options.verbose || false;
  }

  async generatePlan() {
    const plan = {
      metadata: {
        projectName: this.analysisResult.metadata.name || 'Unnamed Project',
        version: '1.0.0',
        generated: this.getDeterministicDate().toISOString(),
        planType: 'specification-driven',
        estimatedEffort: null,
        riskLevel: 'medium'
      },
      overview: this.generateOverview(),
      phases: this.generatePhases(),
      risks: this.generateRisks(),
      milestones: this.generateMilestones()
    };

    // Calculate effort estimation
    if (this.estimateEffort) {
      plan.metadata.estimatedEffort = this.calculateEffortEstimation(plan.phases);
    }

    // Assess risk level
    plan.metadata.riskLevel = this.assessRiskLevel(plan.phases);

    return plan;
  }

  generateOverview() {
    const { requirements, architecture } = this.analysisResult;
    
    return `This development plan is generated from ${requirements.length} requirements ` +
           `and ${architecture.components.length} architectural components. ` +
           `The plan follows specification-driven development principles with ` +
           `automated validation and iterative refinement.`;
  }

  generatePhases() {
    const phases = [];
    
    // Phase 1: Foundation & Setup
    phases.push({
      name: 'Foundation & Setup',
      priority: 'critical',
      description: 'Establish project foundation, tooling, and initial architecture',
      estimatedDuration: '1-2 weeks',
      tasks: [
        {
          name: 'Project Infrastructure Setup',
          description: 'Initialize repository, CI/CD, and development environment',
          priority: 'critical',
          effort: 'medium',
          dependencies: []
        },
        {
          name: 'Core Architecture Implementation',
          description: 'Implement foundational architecture components',
          priority: 'critical',
          effort: 'large',
          dependencies: ['Project Infrastructure Setup']
        }
      ]
    });

    // Phase 2: Core Components
    if (this.analysisResult.architecture.components.length > 0) {
      const coreTasks = this.analysisResult.architecture.components
        .filter(comp => comp.layer === 'core' || comp.type === 'service')
        .map(comp => ({
          name: `Implement ${comp.name}`,
          description: comp.description || `Implement ${comp.name} component`,
          priority: this.mapPriorityFromQuality(comp.qualityAttributes),
          effort: this.estimateComponentEffort(comp),
          dependencies: this.extractComponentDependencies(comp)
        }));

      phases.push({
        name: 'Core Components Development',
        priority: 'high',
        description: 'Implement core system components and services',
        estimatedDuration: '3-4 weeks',
        tasks: coreTasks
      });
    }

    // Phase 3: Feature Implementation
    if (this.analysisResult.requirements.length > 0) {
      const featureTasks = this.analysisResult.requirements
        .filter(req => req.type === 'functional')
        .map(req => ({
          name: `Implement ${req.title}`,
          description: req.description || `Implement ${req.title} requirement`,
          priority: req.priority,
          effort: this.estimateRequirementEffort(req),
          dependencies: req.dependencies || []
        }));

      phases.push({
        name: 'Feature Implementation',
        priority: 'high',
        description: 'Implement functional requirements and user-facing features',
        estimatedDuration: '4-6 weeks',
        tasks: featureTasks
      });
    }

    // Phase 4: Integration & Testing
    phases.push({
      name: 'Integration & Testing',
      priority: 'high',
      description: 'System integration, comprehensive testing, and quality assurance',
      estimatedDuration: '2-3 weeks',
      tasks: [
        {
          name: 'Integration Testing',
          description: 'End-to-end integration testing and system validation',
          priority: 'high',
          effort: 'large',
          dependencies: []
        },
        {
          name: 'Performance Optimization',
          description: 'Performance testing and optimization',
          priority: 'medium',
          effort: 'medium',
          dependencies: ['Integration Testing']
        }
      ]
    });

    // Phase 5: Deployment & Launch
    phases.push({
      name: 'Deployment & Launch',
      priority: 'medium',
      description: 'Production deployment and go-live activities',
      estimatedDuration: '1-2 weeks',
      tasks: [
        {
          name: 'Production Deployment',
          description: 'Deploy to production environment',
          priority: 'high',
          effort: 'medium',
          dependencies: []
        },
        {
          name: 'Monitoring & Documentation',
          description: 'Setup monitoring and finalize documentation',
          priority: 'medium',
          effort: 'small',
          dependencies: ['Production Deployment']
        }
      ]
    });

    // Prioritize phases if requested
    if (this.prioritize) {
      phases.sort((a, b) => {
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        return (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2);
      });
    }

    return phases;
  }

  generateRisks() {
    const risks = [
      {
        description: 'Specification changes during development',
        impact: 'medium',
        probability: 'medium',
        mitigation: 'Use specification versioning and change management process'
      },
      {
        description: 'Technical complexity exceeds initial estimates',
        impact: 'high', 
        probability: 'low',
        mitigation: 'Regular architecture reviews and proof-of-concept validation'
      },
      {
        description: 'Integration dependencies cause delays',
        impact: 'medium',
        probability: 'medium',
        mitigation: 'Early integration testing and dependency management'
      }
    ];

    return risks;
  }

  generateMilestones() {
    return [
      {
        name: 'Architecture Baseline',
        description: 'Core architecture implemented and validated',
        targetDate: '+4 weeks',
        deliverables: ['Architecture documentation', 'Core services', 'Integration framework']
      },
      {
        name: 'MVP Complete',
        description: 'Minimum viable product with core features',
        targetDate: '+8 weeks', 
        deliverables: ['Core features', 'Basic UI', 'API endpoints']
      },
      {
        name: 'Production Ready',
        description: 'Fully tested and production-ready system',
        targetDate: '+12 weeks',
        deliverables: ['Full feature set', 'Performance validated', 'Documentation complete']
      }
    ];
  }

  // Helper methods for effort estimation and priority mapping
  mapPriorityFromQuality(qualityAttributes) {
    if (!qualityAttributes) return 'medium';
    
    const { performance, scalability, maintainability } = qualityAttributes;
    if (performance === 'high' || scalability === 'high') return 'high';
    if (maintainability === 'high') return 'medium';
    return 'medium';
  }

  estimateComponentEffort(component) {
    const complexity = component.responsibilities?.length || 1;
    if (complexity <= 2) return 'small';
    if (complexity <= 5) return 'medium';
    return 'large';
  }

  estimateRequirementEffort(requirement) {
    const complexity = requirement.acceptanceCriteria?.length || 1;
    if (complexity <= 2) return 'small';
    if (complexity <= 5) return 'medium';
    return 'large';
  }

  extractComponentDependencies(component) {
    return component.interfaces?.dependencies?.map(dep => dep.name) || [];
  }

  calculateEffortEstimation(phases) {
    const effortMap = { small: 1, medium: 3, large: 8 };
    let totalEffort = 0;
    
    phases.forEach(phase => {
      phase.tasks.forEach(task => {
        totalEffort += effortMap[task.effort] || 3;
      });
    });
    
    return `${Math.ceil(totalEffort / 5)} weeks (${totalEffort} story points)`;
  }

  assessRiskLevel(phases) {
    const totalTasks = phases.reduce((sum, phase) => sum + phase.tasks.length, 0);
    const criticalTasks = phases.reduce((sum, phase) => 
      sum + phase.tasks.filter(task => task.priority === 'critical').length, 0);
    
    const riskRatio = criticalTasks / totalTasks;
    if (riskRatio > 0.3) return 'high';
    if (riskRatio > 0.1) return 'medium';
    return 'low';
  }
}