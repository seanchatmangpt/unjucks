import { defineCommand } from "citty";
import chalk from "chalk";
import { consola } from "consola";
import ora from "ora";
import * as fs from "fs-extra";
import * as path from "path";
import * as yaml from "yaml";
import { spawn } from "child_process";
import inquirer from "inquirer";
import { MCPBridge, createMCPBridge } from "../lib/mcp-integration.js";
import type { SwarmTask, JTBDWorkflow } from "../lib/mcp-integration.js";
import {
  validators,
  displayValidationResults,
  createCommandError,
} from "../lib/command-validation.js";
import { CommandError, UnjucksCommandError } from "../types/commands.js";

// ============================================================================
// WORKFLOW COMMAND TYPES
// ============================================================================

/**
 * Workflow execution strategy
 */
export type WorkflowStrategy = "parallel" | "sequential" | "adaptive" | "balanced";

/**
 * Workflow step action types
 */
export type WorkflowAction = 
  | "generate" 
  | "analyze" 
  | "test" 
  | "review" 
  | "deploy"
  | "validate"
  | "optimize"
  | "monitor";

/**
 * Event trigger types for workflows
 */
export type EventTrigger = 
  | "file-change"
  | "git-push" 
  | "pr-opened"
  | "issue-created"
  | "schedule"
  | "webhook"
  | "manual";

/**
 * Workflow step definition
 */
export interface WorkflowStep {
  id: string;
  name: string;
  description: string;
  action: WorkflowAction;
  agentType?: string;
  parameters: Record<string, any>;
  conditions?: Record<string, any>;
  timeout?: number;
  retries?: number;
  onFailure?: "continue" | "stop" | "retry";
  dependencies?: string[];
  outputs?: string[];
  artifacts?: string[];
}

/**
 * Event trigger configuration
 */
export interface EventConfig {
  type: EventTrigger;
  pattern?: string;
  schedule?: string;
  webhook?: {
    url: string;
    secret?: string;
    headers?: Record<string, string>;
  };
  conditions?: Record<string, any>;
}

/**
 * Complete workflow configuration
 */
export interface WorkflowConfig {
  id: string;
  name: string;
  description: string;
  version?: string;
  author?: string;
  tags?: string[];
  steps: WorkflowStep[];
  triggers?: EventConfig[];
  strategy?: WorkflowStrategy;
  maxAgents?: number;
  timeout?: number;
  retries?: number;
  environment?: Record<string, string>;
  resources?: {
    memory?: string;
    cpu?: string;
    disk?: string;
  };
  notifications?: {
    onSuccess?: string[];
    onFailure?: string[];
  };
  persistence?: boolean;
  metadata?: Record<string, any>;
}

/**
 * Workflow execution status
 */
export interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  startTime: string;
  endTime?: string;
  duration?: number;
  trigger?: {
    type: string;
    data?: any;
  };
  steps: {
    stepId: string;
    status: "pending" | "running" | "completed" | "failed" | "skipped";
    startTime?: string;
    endTime?: string;
    duration?: number;
    error?: string;
    output?: any;
    artifacts?: string[];
  }[];
  metrics: {
    totalSteps: number;
    completedSteps: number;
    failedSteps: number;
    successRate: number;
  };
  logs: {
    timestamp: string;
    level: "info" | "warn" | "error";
    message: string;
    context?: any;
  }[];
}

// ============================================================================
// MCP INTEGRATION UTILITIES
// ============================================================================

let mcpBridge: MCPBridge | null = null;

/**
 * Initialize MCP Bridge for workflow coordination
 */
async function initializeMCPBridge(): Promise<MCPBridge> {
  if (!mcpBridge) {
    try {
      mcpBridge = await createMCPBridge({
        swarmMcpCommand: ['npx', 'claude-flow@alpha', 'mcp', 'start'],
        hooksEnabled: true,
        realtimeSync: true,
        debugMode: process.env.DEBUG_UNJUCKS === 'true'
      });
    } catch (error) {
      consola.warn('MCP Bridge initialization failed, using fallback mode');
      throw error;
    }
  }
  return mcpBridge;
}

/**
 * Execute MCP workflow command
 */
async function executeMCPWorkflow(command: string, params: Record<string, any>, timeout = 60000): Promise<any> {
  try {
    const bridge = await initializeMCPBridge();
    
    return new Promise((resolve, reject) => {
      const mcpProcess = spawn('npx', [
        'claude-flow@alpha', 
        'workflow', 
        command, 
        ...Object.entries(params).flat().map(String)
      ], {
        stdio: 'pipe',
        env: { ...process.env, MCP_TIMEOUT: timeout.toString() }
      });

      let stdout = '';
      let stderr = '';

      mcpProcess.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      mcpProcess.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      mcpProcess.on('close', (code) => {
        if (code === 0) {
          try {
            resolve(JSON.parse(stdout));
          } catch {
            resolve({ success: true, output: stdout });
          }
        } else {
          reject(new Error(`MCP workflow command failed: ${stderr}`));
        }
      });

      mcpProcess.on('error', reject);

      setTimeout(() => {
        mcpProcess.kill();
        reject(new Error('MCP workflow command timeout'));
      }, timeout);
    });
  } catch (error) {
    consola.warn('MCP workflow execution failed, using fallback');
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

// ============================================================================
// WORKFLOW MANAGEMENT FUNCTIONS
// ============================================================================

/**
 * Load workflow from file
 */
async function loadWorkflowConfig(filePath: string): Promise<WorkflowConfig> {
  try {
    const absolutePath = path.resolve(filePath);
    
    if (!await fs.pathExists(absolutePath)) {
      throw new Error(`Workflow file not found: ${filePath}`);
    }

    const content = await fs.readFile(absolutePath, 'utf-8');
    const ext = path.extname(filePath).toLowerCase();

    let workflow: WorkflowConfig;
    
    switch (ext) {
      case '.json':
        workflow = JSON.parse(content);
        break;
      case '.yaml':
      case '.yml':
        workflow = yaml.parse(content);
        break;
      default:
        throw new Error(`Unsupported workflow file format: ${ext}. Use .json or .yaml`);
    }

    // Validate required fields
    if (!workflow.id || !workflow.name || !workflow.steps) {
      throw new Error('Invalid workflow: missing required fields (id, name, steps)');
    }

    // Set defaults
    workflow.version = workflow.version || '1.0.0';
    workflow.strategy = workflow.strategy || 'adaptive';
    workflow.maxAgents = workflow.maxAgents || 5;
    workflow.timeout = workflow.timeout || 300000; // 5 minutes
    workflow.retries = workflow.retries || 2;
    workflow.persistence = workflow.persistence !== false;

    return workflow;
  } catch (error) {
    throw new Error(`Failed to load workflow: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Save workflow configuration
 */
async function saveWorkflowConfig(workflow: WorkflowConfig, filePath: string): Promise<void> {
  try {
    const dir = path.dirname(filePath);
    await fs.ensureDir(dir);

    const ext = path.extname(filePath).toLowerCase();
    let content: string;

    switch (ext) {
      case '.json':
        content = JSON.stringify(workflow, null, 2);
        break;
      case '.yaml':
      case '.yml':
        content = yaml.stringify(workflow, { indent: 2 });
        break;
      default:
        throw new Error(`Unsupported file format: ${ext}. Use .json or .yaml`);
    }

    await fs.writeFile(filePath, content, 'utf-8');
  } catch (error) {
    throw new Error(`Failed to save workflow: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Validate workflow configuration
 */
function validateWorkflow(workflow: WorkflowConfig): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Basic validation
  if (!workflow.id) errors.push("Workflow ID is required");
  if (!workflow.name) errors.push("Workflow name is required");
  if (!workflow.steps || workflow.steps.length === 0) {
    errors.push("Workflow must have at least one step");
  }

  // Step validation
  workflow.steps?.forEach((step, index) => {
    if (!step.id) errors.push(`Step ${index + 1}: ID is required`);
    if (!step.name) errors.push(`Step ${index + 1}: Name is required`);
    if (!step.action) errors.push(`Step ${index + 1}: Action is required`);
    
    const validActions: WorkflowAction[] = ["generate", "analyze", "test", "review", "deploy", "validate", "optimize", "monitor"];
    if (!validActions.includes(step.action)) {
      errors.push(`Step ${index + 1}: Invalid action '${step.action}'`);
    }

    // Check dependencies
    if (step.dependencies) {
      step.dependencies.forEach(depId => {
        if (!workflow.steps.find(s => s.id === depId)) {
          warnings.push(`Step ${step.id}: dependency '${depId}' not found`);
        }
      });
    }
  });

  // Trigger validation
  workflow.triggers?.forEach((trigger, index) => {
    if (!trigger.type) {
      errors.push(`Trigger ${index + 1}: Type is required`);
    }
    
    if (trigger.type === 'schedule' && !trigger.schedule) {
      errors.push(`Trigger ${index + 1}: Schedule pattern required for schedule trigger`);
    }
    
    if (trigger.type === 'webhook' && !trigger.webhook?.url) {
      errors.push(`Trigger ${index + 1}: Webhook URL required for webhook trigger`);
    }
  });

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Execute workflow step
 */
async function executeWorkflowStep(
  step: WorkflowStep, 
  workflow: WorkflowConfig, 
  context: Record<string, any>
): Promise<{ success: boolean; output?: any; error?: string; artifacts?: string[] }> {
  try {
    // Create SwarmTask for MCP Bridge coordination
    const swarmTask: SwarmTask = {
      id: `${workflow.id}-${step.id}-${Date.now()}`,
      type: step.action === 'generate' ? 'generate' : 
            step.action === 'analyze' ? 'analyze' : 
            step.action === 'test' ? 'scaffold' : 'document',
      description: step.description || step.name,
      parameters: {
        ...step.parameters,
        ...context,
        stepId: step.id,
        workflowId: workflow.id
      },
      agentType: step.agentType,
      priority: 'medium'
    };

    const bridge = await initializeMCPBridge();
    
    // Convert task to unjucks parameters and execute
    const unjucksParams = await bridge.swarmToUnjucks(swarmTask);
    if (!unjucksParams) {
      throw new Error(`Failed to convert step '${step.id}' to executable parameters`);
    }

    // Execute via MCP if available, otherwise fallback
    const mcpResult = await executeMCPWorkflow('execute-step', {
      stepId: step.id,
      action: step.action,
      parameters: step.parameters,
      context
    });

    if (mcpResult.success) {
      return {
        success: true,
        output: mcpResult.output,
        artifacts: mcpResult.artifacts || []
      };
    } else {
      throw new Error(mcpResult.error || 'Step execution failed');
    }

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Create workflow template
 */
function createWorkflowTemplate(type: string, name: string, description?: string): WorkflowConfig {
  const baseTemplate: WorkflowConfig = {
    id: `workflow-${Date.now()}`,
    name,
    description: description || `${name} workflow`,
    version: '1.0.0',
    steps: [],
    strategy: 'adaptive',
    maxAgents: 5,
    timeout: 300000,
    retries: 2,
    persistence: true
  };

  switch (type.toLowerCase()) {
    case 'ci':
    case 'cicd':
      return {
        ...baseTemplate,
        id: `ci-${name.toLowerCase().replace(/\s+/g, '-')}`,
        steps: [
          {
            id: 'checkout',
            name: 'Checkout Code',
            description: 'Checkout source code from repository',
            action: 'generate',
            parameters: { type: 'checkout', branch: 'main' }
          },
          {
            id: 'install',
            name: 'Install Dependencies',
            description: 'Install project dependencies',
            action: 'generate',
            parameters: { command: 'npm install' },
            dependencies: ['checkout']
          },
          {
            id: 'test',
            name: 'Run Tests',
            description: 'Execute test suite',
            action: 'test',
            parameters: { command: 'npm test', coverage: true },
            dependencies: ['install']
          },
          {
            id: 'build',
            name: 'Build Application',
            description: 'Build production artifacts',
            action: 'generate',
            parameters: { command: 'npm run build' },
            dependencies: ['test']
          },
          {
            id: 'deploy',
            name: 'Deploy to Production',
            description: 'Deploy to production environment',
            action: 'deploy',
            parameters: { environment: 'production', strategy: 'rolling' },
            dependencies: ['build']
          }
        ],
        triggers: [
          { type: 'git-push', pattern: 'main' },
          { type: 'pr-opened' }
        ]
      };

    case 'api':
      return {
        ...baseTemplate,
        id: `api-${name.toLowerCase().replace(/\s+/g, '-')}`,
        steps: [
          {
            id: 'design',
            name: 'API Design',
            description: 'Design API endpoints and schema',
            action: 'analyze',
            agentType: 'architect',
            parameters: { type: 'api-design', format: 'openapi' }
          },
          {
            id: 'generate',
            name: 'Generate Code',
            description: 'Generate API implementation',
            action: 'generate',
            agentType: 'coder',
            parameters: { generator: 'api', template: 'express' },
            dependencies: ['design']
          },
          {
            id: 'test',
            name: 'Generate Tests',
            description: 'Generate API tests',
            action: 'test',
            agentType: 'tester',
            parameters: { type: 'integration', coverage: 90 },
            dependencies: ['generate']
          },
          {
            id: 'docs',
            name: 'Generate Documentation',
            description: 'Generate API documentation',
            action: 'generate',
            parameters: { generator: 'docs', template: 'api' },
            dependencies: ['test']
          }
        ]
      };

    case 'frontend':
      return {
        ...baseTemplate,
        id: `frontend-${name.toLowerCase().replace(/\s+/g, '-')}`,
        steps: [
          {
            id: 'scaffold',
            name: 'Scaffold Project',
            description: 'Create project structure',
            action: 'generate',
            parameters: { generator: 'app', template: 'react-ts' }
          },
          {
            id: 'components',
            name: 'Generate Components',
            description: 'Create UI components',
            action: 'generate',
            parameters: { generator: 'component', template: 'react' },
            dependencies: ['scaffold']
          },
          {
            id: 'styling',
            name: 'Setup Styling',
            description: 'Configure styling system',
            action: 'generate',
            parameters: { generator: 'style', template: 'tailwind' },
            dependencies: ['components']
          },
          {
            id: 'testing',
            name: 'Setup Testing',
            description: 'Configure testing framework',
            action: 'test',
            parameters: { framework: 'jest', coverage: 80 },
            dependencies: ['styling']
          }
        ]
      };

    default:
      return baseTemplate;
  }
}

// ============================================================================
// WORKFLOW COMMAND DEFINITION
// ============================================================================

/**
 * Workflow command - Advanced development workflow automation
 * 
 * This command provides comprehensive workflow management with:
 * - Event-driven workflow execution
 * - Multi-agent task orchestration  
 * - Real-time monitoring and metrics
 * - Template-based workflow creation
 * - MCP integration for swarm coordination
 * - Persistent execution history
 * - Artifact management and tracking
 * 
 * @example
 * ```bash
 * # Create a new CI/CD workflow
 * unjucks workflow create --type cicd --name "Frontend Build" --output ./workflows/
 * 
 * # Execute workflow with custom parameters
 * unjucks workflow execute ./workflows/api-development.yaml --input '{"service":"users"}'
 * 
 * # List all workflows and their status
 * unjucks workflow list --status running --detailed
 * 
 * # Monitor workflow execution in real-time
 * unjucks workflow monitor workflow-123 --follow --format table
 * 
 * # Schedule workflow with cron expression
 * unjucks workflow schedule ./workflows/backup.yaml --cron "0 2 * * *"
 * ```
 */
export default defineCommand({
  meta: {
    name: "workflow",
    description: "Advanced development workflow automation with event-driven processing and multi-agent orchestration",
  },
  subCommands: {
    /**
     * Create a new workflow from template or scratch
     */
    create: defineCommand({
      meta: {
        name: "create",
        description: "Create a new workflow from template or interactive builder",
      },
      args: {
        name: {
          type: "string",
          description: "Workflow name",
          required: true,
          alias: "n",
        },
        type: {
          type: "string",
          description: "Workflow template type (cicd, api, frontend, custom)",
          default: "custom",
          alias: "t",
        },
        description: {
          type: "string",
          description: "Workflow description",
          alias: "d",
        },
        output: {
          type: "string",
          description: "Output directory for workflow file",
          default: "./workflows",
          alias: "o",
        },
        format: {
          type: "string",
          description: "Output format (yaml, json)",
          default: "yaml",
          alias: "f",
        },
        interactive: {
          type: "boolean",
          description: "Use interactive workflow builder",
          default: false,
          alias: "i",
        },
      },
      async run({ args }: { args: any }) {
        const spinner = ora("Creating workflow...").start();

        try {
          let workflow: WorkflowConfig;

          if (args.interactive) {
            spinner.stop();
            
            // Interactive workflow builder
            const answers = await inquirer.prompt([
              {
                type: 'list',
                name: 'type',
                message: 'Select workflow type:',
                choices: [
                  { name: 'CI/CD Pipeline', value: 'cicd' },
                  { name: 'API Development', value: 'api' },
                  { name: 'Frontend Application', value: 'frontend' },
                  { name: 'Custom Workflow', value: 'custom' }
                ]
              },
              {
                type: 'input',
                name: 'description',
                message: 'Enter workflow description:',
                default: args.description
              },
              {
                type: 'confirm',
                name: 'enableTriggers',
                message: 'Add event triggers?',
                default: true
              }
            ]);

            workflow = createWorkflowTemplate(answers.type, args.name, answers.description);
            
            if (answers.enableTriggers && answers.type !== 'custom') {
              // Keep existing triggers from template
            } else if (answers.enableTriggers) {
              const triggerAnswers = await inquirer.prompt([
                {
                  type: 'checkbox',
                  name: 'triggers',
                  message: 'Select event triggers:',
                  choices: [
                    { name: 'File changes', value: 'file-change' },
                    { name: 'Git push', value: 'git-push' },
                    { name: 'Pull request opened', value: 'pr-opened' },
                    { name: 'Issue created', value: 'issue-created' },
                    { name: 'Schedule (cron)', value: 'schedule' },
                    { name: 'Manual trigger', value: 'manual' }
                  ]
                }
              ]);

              workflow.triggers = triggerAnswers.triggers.map((type: EventTrigger) => ({ type }));
            }
          } else {
            workflow = createWorkflowTemplate(args.type, args.name, args.description);
          }

          // Ensure output directory exists
          await fs.ensureDir(args.output);

          // Generate filename
          const filename = `${workflow.id}.${args.format}`;
          const filePath = path.join(args.output, filename);

          // Save workflow
          await saveWorkflowConfig(workflow, filePath);
          
          spinner.stop();

          console.log(chalk.green(`\n✅ Workflow created successfully`));
          console.log(chalk.cyan(`📁 File: ${filePath}`));
          console.log(chalk.gray(`🏷️  ID: ${workflow.id}`));
          console.log(chalk.gray(`📋 Steps: ${workflow.steps.length}`));
          
          if (workflow.triggers && workflow.triggers.length > 0) {
            console.log(chalk.gray(`🎯 Triggers: ${workflow.triggers.map(t => t.type).join(', ')}`));
          }

          return {
            success: true,
            message: "Workflow created successfully",
            data: { id: workflow.id, file: filePath, steps: workflow.steps.length }
          };

        } catch (error) {
          spinner.stop();
          console.error(chalk.red("\n❌ Workflow creation failed:"));
          console.error(chalk.red(`  ${error instanceof Error ? error.message : String(error)}`));
          process.exit(1);
        }
      },
    }),

    /**
     * Execute a workflow
     */
    execute: defineCommand({
      meta: {
        name: "execute",
        description: "Execute a workflow with optional input parameters",
      },
      args: {
        file: {
          type: "positional",
          description: "Workflow file path",
          required: true,
        },
        input: {
          type: "string",
          description: "Input parameters as JSON string",
          alias: "i",
        },
        async: {
          type: "boolean",
          description: "Execute asynchronously in background",
          default: false,
          alias: "a",
        },
        monitor: {
          type: "boolean",
          description: "Monitor execution in real-time",
          default: false,
          alias: "m",
        },
        dryRun: {
          type: "boolean",
          description: "Validate workflow without executing",
          default: false,
          alias: "d",
        },
        maxAgents: {
          type: "string",
          description: "Maximum number of agents to use",
          alias: "agents",
        },
      },
      async run({ args }: { args: any }) {
        const spinner = ora("Loading workflow...").start();

        try {
          // Load and validate workflow
          const workflow = await loadWorkflowConfig(args.file);
          const validation = validateWorkflow(workflow);
          
          if (!validation.valid) {
            spinner.stop();
            console.error(chalk.red("\n❌ Workflow validation failed:"));
            validation.errors.forEach(error => {
              console.error(chalk.red(`  • ${error}`));
            });
            process.exit(1);
          }

          if (validation.warnings.length > 0) {
            console.log(chalk.yellow("\n⚠️ Workflow warnings:"));
            validation.warnings.forEach(warning => {
              console.log(chalk.yellow(`  • ${warning}`));
            });
          }

          // Parse input parameters
          let inputParams = {};
          if (args.input) {
            try {
              inputParams = JSON.parse(args.input);
            } catch (error) {
              throw new Error(`Invalid input JSON: ${error instanceof Error ? error.message : String(error)}`);
            }
          }

          // Override maxAgents if specified
          if (args.maxAgents) {
            workflow.maxAgents = parseInt(args.maxAgents);
          }

          spinner.text = "Initializing MCP Bridge...";
          
          // Initialize MCP Bridge for orchestration
          const bridge = await initializeMCPBridge();
          
          if (args.dryRun) {
            spinner.stop();
            console.log(chalk.yellow("\n🔍 Dry Run - Workflow would execute with:"));
            console.log(chalk.gray(`  📄 Workflow: ${workflow.name} (${workflow.id})`));
            console.log(chalk.gray(`  🎯 Strategy: ${workflow.strategy}`));
            console.log(chalk.gray(`  🤖 Max Agents: ${workflow.maxAgents}`));
            console.log(chalk.gray(`  ⏱️ Timeout: ${workflow.timeout}ms`));
            console.log(chalk.gray(`  📝 Steps: ${workflow.steps.length}`));
            
            workflow.steps.forEach((step, index) => {
              console.log(chalk.blue(`    ${index + 1}. ${step.name} (${step.action})`));
              if (step.dependencies && step.dependencies.length > 0) {
                console.log(chalk.gray(`       Depends on: ${step.dependencies.join(', ')}`));
              }
            });

            return { success: true, message: "Dry run completed", data: workflow };
          }

          // Convert workflow to JTBD format for MCP Bridge
          const jtbdWorkflow: JTBDWorkflow = {
            id: workflow.id,
            name: workflow.name,
            description: workflow.description,
            job: `Execute ${workflow.name} workflow with ${workflow.steps.length} steps`,
            steps: workflow.steps.map(step => ({
              action: step.action === 'generate' ? 'generate' : 
                      step.action === 'test' ? 'validate' :
                      step.action === 'review' ? 'analyze' :
                      step.action === 'deploy' ? 'generate' : 'analyze',
              description: step.description || step.name,
              generator: step.parameters?.generator,
              template: step.parameters?.template,
              parameters: { ...step.parameters, ...inputParams }
            })),
            triggers: workflow.triggers?.map(trigger => ({
              event: trigger.type,
              condition: JSON.stringify(trigger.conditions || {})
            }))
          };

          if (args.async) {
            spinner.stop();
            console.log(chalk.blue("\n🚀 Starting workflow execution in background..."));
            
            // Execute asynchronously via MCP
            const result = await executeMCPWorkflow('create', {
              name: workflow.name,
              steps: workflow.steps,
              async: true
            });

            if (result.success) {
              console.log(chalk.green(`✅ Workflow queued successfully`));
              console.log(chalk.cyan(`📋 Execution ID: ${result.executionId}`));
              console.log(chalk.gray(`Monitor with: unjucks workflow status ${result.executionId}`));
            }

            return { success: true, message: "Workflow queued", data: result };
          }

          // Execute synchronously with real-time monitoring
          spinner.text = "Executing workflow...";
          
          const startTime = Date.now();
          const result = await bridge.orchestrateJTBD(jtbdWorkflow);
          const duration = Date.now() - startTime;

          spinner.stop();

          if (result.success) {
            console.log(chalk.green(`\n✅ Workflow completed successfully`));
            console.log(chalk.cyan(`⏱️ Duration: ${duration}ms`));
            console.log(chalk.gray(`📊 Steps: ${result.results.length} executed`));
            
            if (args.monitor) {
              console.log(chalk.blue("\n📋 Step Results:"));
              result.results.forEach((stepResult: any, index: number) => {
                const status = stepResult.success ? chalk.green("✅") : chalk.red("❌");
                console.log(`  ${status} ${stepResult.description || `Step ${index + 1}`}`);
              });
            }
          } else {
            console.error(chalk.red(`\n❌ Workflow execution failed`));
            result.errors.forEach((error: string) => {
              console.error(chalk.red(`  • ${error}`));
            });
          }

          return {
            success: result.success,
            message: result.success ? "Workflow completed" : "Workflow failed",
            data: result,
            duration
          };

        } catch (error) {
          spinner.stop();
          console.error(chalk.red("\n❌ Workflow execution failed:"));
          console.error(chalk.red(`  ${error instanceof Error ? error.message : String(error)}`));
          process.exit(1);
        }
      },
    }),

    /**
     * List all workflows
     */
    list: defineCommand({
      meta: {
        name: "list",
        description: "List all workflows and their execution status",
      },
      args: {
        directory: {
          type: "string",
          description: "Directory to scan for workflows",
          default: "./workflows",
          alias: "d",
        },
        status: {
          type: "string",
          description: "Filter by status (all, running, completed, failed)",
          default: "all",
          alias: "s",
        },
        format: {
          type: "string",
          description: "Output format (table, json, yaml)",
          default: "table",
          alias: "f",
        },
        detailed: {
          type: "boolean",
          description: "Show detailed information",
          default: false,
          alias: "D",
        },
      },
      async run({ args }: { args: any }) {
        const spinner = ora("Scanning for workflows...").start();

        try {
          const workflowDir = path.resolve(args.directory);
          const workflows: WorkflowConfig[] = [];

          if (await fs.pathExists(workflowDir)) {
            const files = await fs.readdir(workflowDir);
            
            for (const file of files) {
              if (file.endsWith('.yaml') || file.endsWith('.yml') || file.endsWith('.json')) {
                try {
                  const filePath = path.join(workflowDir, file);
                  const workflow = await loadWorkflowConfig(filePath);
                  workflows.push(workflow);
                } catch (error) {
                  // Skip invalid workflow files
                  consola.warn(`Skipping invalid workflow file: ${file}`);
                }
              }
            }
          }

          // Get execution status via MCP if available
          let executions: WorkflowExecution[] = [];
          try {
            const mcpResult = await executeMCPWorkflow('list', { status: args.status });
            executions = mcpResult.executions || [];
          } catch {
            // MCP not available, show workflows without execution status
          }

          spinner.stop();

          if (workflows.length === 0) {
            console.log(chalk.yellow("\n📂 No workflows found"));
            console.log(chalk.gray(`   Directory: ${workflowDir}`));
            console.log(chalk.gray("   Create a workflow with: unjucks workflow create"));
            return { success: true, message: "No workflows found", data: [] };
          }

          console.log(chalk.blue(`\n📋 Found ${workflows.length} workflows`));

          if (args.format === 'json') {
            console.log(JSON.stringify(workflows, null, 2));
          } else if (args.format === 'yaml') {
            console.log(yaml.stringify(workflows));
          } else {
            // Table format
            workflows.forEach((workflow, index) => {
              console.log(chalk.cyan(`\n${index + 1}. ${workflow.name}`));
              console.log(chalk.gray(`   ID: ${workflow.id}`));
              console.log(chalk.gray(`   Version: ${workflow.version}`));
              console.log(chalk.gray(`   Steps: ${workflow.steps.length}`));
              console.log(chalk.gray(`   Strategy: ${workflow.strategy}`));
              
              if (workflow.triggers && workflow.triggers.length > 0) {
                console.log(chalk.gray(`   Triggers: ${workflow.triggers.map(t => t.type).join(', ')}`));
              }

              // Show execution status if available
              const execution = executions.find(exec => exec.workflowId === workflow.id);
              if (execution) {
                const statusColor = execution.status === 'completed' ? 'green' :
                                  execution.status === 'running' ? 'blue' :
                                  execution.status === 'failed' ? 'red' : 'yellow';
                console.log(chalk[statusColor](`   Status: ${execution.status}`));
                
                if (args.detailed && execution.metrics) {
                  console.log(chalk.gray(`   Success Rate: ${(execution.metrics.successRate * 100).toFixed(1)}%`));
                  console.log(chalk.gray(`   Completed Steps: ${execution.metrics.completedSteps}/${execution.metrics.totalSteps}`));
                }
              }

              if (args.detailed) {
                console.log(chalk.gray(`   Description: ${workflow.description}`));
                workflow.steps.forEach((step, stepIndex) => {
                  console.log(chalk.blue(`     ${stepIndex + 1}. ${step.name} (${step.action})`));
                });
              }
            });
          }

          return {
            success: true,
            message: `Found ${workflows.length} workflows`,
            data: workflows
          };

        } catch (error) {
          spinner.stop();
          console.error(chalk.red("\n❌ Failed to list workflows:"));
          console.error(chalk.red(`  ${error instanceof Error ? error.message : String(error)}`));
          process.exit(1);
        }
      },
    }),

    /**
     * Monitor workflow execution
     */
    monitor: defineCommand({
      meta: {
        name: "monitor",
        description: "Monitor workflow execution in real-time",
      },
      args: {
        execution: {
          type: "positional",
          description: "Execution ID to monitor",
          required: true,
        },
        follow: {
          type: "boolean",
          description: "Follow execution until completion",
          default: false,
          alias: "f",
        },
        interval: {
          type: "string",
          description: "Refresh interval in seconds",
          default: "5",
          alias: "i",
        },
        format: {
          type: "string",
          description: "Output format (table, json, logs)",
          default: "table",
          alias: "F",
        },
      },
      async run({ args }: { args: any }) {
        const interval = parseInt(args.interval) * 1000;
        let monitoring = true;

        // Handle Ctrl+C gracefully
        process.on('SIGINT', () => {
          monitoring = false;
          console.log(chalk.yellow("\n\n👋 Monitoring stopped"));
          process.exit(0);
        });

        try {
          while (monitoring) {
            const spinner = ora("Fetching execution status...").start();

            try {
              const result = await executeMCPWorkflow('status', { 
                execution_id: args.execution,
                detailed: true 
              });

              spinner.stop();
              console.clear();

              if (!result.success) {
                console.error(chalk.red(`❌ Execution not found: ${args.execution}`));
                return;
              }

              const execution: WorkflowExecution = result.execution;
              
              console.log(chalk.blue(`📊 Workflow Execution Monitor`));
              console.log(chalk.gray(`Execution ID: ${execution.id}`));
              console.log(chalk.gray(`Workflow: ${execution.workflowId}`));
              console.log(chalk.gray(`Status: ${execution.status}`));
              
              if (execution.startTime) {
                const startTime = new Date(execution.startTime);
                const duration = execution.endTime 
                  ? new Date(execution.endTime).getTime() - startTime.getTime()
                  : Date.now() - startTime.getTime();
                console.log(chalk.gray(`Duration: ${Math.round(duration / 1000)}s`));
              }

              if (args.format === 'json') {
                console.log(JSON.stringify(execution, null, 2));
              } else if (args.format === 'logs') {
                console.log(chalk.blue("\n📝 Recent Logs:"));
                execution.logs.slice(-10).forEach(log => {
                  const color = log.level === 'error' ? 'red' :
                               log.level === 'warn' ? 'yellow' : 'gray';
                  console.log(chalk[color](`  [${log.timestamp}] ${log.level.toUpperCase()}: ${log.message}`));
                });
              } else {
                // Table format - show step progress
                console.log(chalk.blue("\n📋 Step Progress:"));
                execution.steps.forEach((step, index) => {
                  const statusIcon = step.status === 'completed' ? '✅' :
                                    step.status === 'running' ? '🔄' :
                                    step.status === 'failed' ? '❌' : '⏳';
                  console.log(`  ${statusIcon} ${step.stepId} (${step.status})`);
                  
                  if (step.error) {
                    console.log(chalk.red(`     Error: ${step.error}`));
                  }
                });

                // Show metrics
                if (execution.metrics) {
                  console.log(chalk.green(`\n📊 Progress: ${execution.metrics.completedSteps}/${execution.metrics.totalSteps} steps`));
                  console.log(chalk.green(`📈 Success Rate: ${(execution.metrics.successRate * 100).toFixed(1)}%`));
                }
              }

              // Stop monitoring if execution is complete
              if (['completed', 'failed', 'cancelled'].includes(execution.status)) {
                if (args.follow) {
                  console.log(chalk.green(`\n🎯 Execution ${execution.status}`));
                  monitoring = false;
                } else {
                  return {
                    success: true,
                    message: `Execution ${execution.status}`,
                    data: execution
                  };
                }
              }

              if (monitoring && args.follow) {
                console.log(chalk.gray(`\n⏰ Next update in ${args.interval}s (Ctrl+C to stop)`));
                await new Promise(resolve => setTimeout(resolve, interval));
              } else {
                monitoring = false;
              }

            } catch (error) {
              spinner.stop();
              console.error(chalk.red(`❌ Monitor failed: ${error instanceof Error ? error.message : String(error)}`));
              
              if (!args.follow) {
                process.exit(1);
              }
              
              await new Promise(resolve => setTimeout(resolve, interval));
            }
          }

        } catch (error) {
          console.error(chalk.red(`❌ Monitoring failed: ${error instanceof Error ? error.message : String(error)}`));
          process.exit(1);
        }
      },
    }),

    /**
     * Validate workflow configuration
     */
    validate: defineCommand({
      meta: {
        name: "validate",
        description: "Validate workflow configuration and dependencies",
      },
      args: {
        file: {
          type: "positional",
          description: "Workflow file to validate",
          required: true,
        },
        strict: {
          type: "boolean",
          description: "Enable strict validation mode",
          default: false,
          alias: "s",
        },
        fix: {
          type: "boolean",
          description: "Auto-fix common issues",
          default: false,
          alias: "f",
        },
      },
      async run({ args }: { args: any }) {
        const spinner = ora("Validating workflow...").start();

        try {
          const workflow = await loadWorkflowConfig(args.file);
          const validation = validateWorkflow(workflow);

          spinner.stop();

          console.log(chalk.blue(`\n🔍 Workflow Validation: ${workflow.name}`));
          console.log(chalk.gray(`File: ${args.file}`));
          console.log(chalk.gray(`ID: ${workflow.id}`));
          console.log(chalk.gray(`Steps: ${workflow.steps.length}`));

          if (validation.valid) {
            console.log(chalk.green("\n✅ Workflow is valid"));
          } else {
            console.log(chalk.red("\n❌ Validation failed"));
            console.log(chalk.red("\nErrors:"));
            validation.errors.forEach(error => {
              console.log(chalk.red(`  • ${error}`));
            });
          }

          if (validation.warnings.length > 0) {
            console.log(chalk.yellow("\n⚠️ Warnings:"));
            validation.warnings.forEach(warning => {
              console.log(chalk.yellow(`  • ${warning}`));
            });
          }

          if (args.fix && (!validation.valid || validation.warnings.length > 0)) {
            console.log(chalk.blue("\n🔧 Auto-fixing issues..."));
            
            // Apply basic fixes
            let fixed = false;

            // Add missing IDs
            workflow.steps.forEach((step, index) => {
              if (!step.id) {
                step.id = `step-${index + 1}`;
                fixed = true;
              }
            });

            // Set default values
            if (!workflow.version) {
              workflow.version = '1.0.0';
              fixed = true;
            }
            if (!workflow.strategy) {
              workflow.strategy = 'adaptive';
              fixed = true;
            }

            if (fixed) {
              await saveWorkflowConfig(workflow, args.file);
              console.log(chalk.green("✅ Issues fixed and file updated"));
            } else {
              console.log(chalk.yellow("ℹ️ No automatic fixes available"));
            }
          }

          return {
            success: validation.valid,
            message: validation.valid ? "Workflow is valid" : "Validation failed",
            data: {
              valid: validation.valid,
              errors: validation.errors.length,
              warnings: validation.warnings.length,
              workflow: workflow.id
            }
          };

        } catch (error) {
          spinner.stop();
          console.error(chalk.red("\n❌ Validation failed:"));
          console.error(chalk.red(`  ${error instanceof Error ? error.message : String(error)}`));
          process.exit(1);
        }
      },
    }),

    /**
     * Schedule workflow execution
     */
    schedule: defineCommand({
      meta: {
        name: "schedule",
        description: "Schedule workflow execution with cron expressions",
      },
      args: {
        file: {
          type: "positional",
          description: "Workflow file to schedule",
          required: true,
        },
        cron: {
          type: "string",
          description: "Cron expression for scheduling",
          required: true,
          alias: "c",
        },
        timezone: {
          type: "string",
          description: "Timezone for schedule",
          default: "UTC",
          alias: "tz",
        },
        input: {
          type: "string",
          description: "Default input parameters as JSON",
          alias: "i",
        },
        name: {
          type: "string",
          description: "Schedule name",
          alias: "n",
        },
      },
      async run({ args }: { args: any }) {
        const spinner = ora("Setting up schedule...").start();

        try {
          const workflow = await loadWorkflowConfig(args.file);
          
          // Validate cron expression (basic validation)
          const cronParts = args.cron.trim().split(/\s+/);
          if (cronParts.length !== 5) {
            throw new Error("Invalid cron expression. Expected format: 'minute hour day month weekday'");
          }

          const scheduleName = args.name || `${workflow.name}-schedule`;
          let inputParams = {};
          
          if (args.input) {
            try {
              inputParams = JSON.parse(args.input);
            } catch (error) {
              throw new Error(`Invalid input JSON: ${error instanceof Error ? error.message : String(error)}`);
            }
          }

          // Add schedule trigger to workflow
          const scheduleConfig: EventConfig = {
            type: 'schedule',
            schedule: args.cron,
            conditions: {
              timezone: args.timezone,
              input: inputParams
            }
          };

          if (!workflow.triggers) {
            workflow.triggers = [];
          }
          workflow.triggers.push(scheduleConfig);

          // Save updated workflow
          await saveWorkflowConfig(workflow, args.file);

          // Register schedule with MCP
          const mcpResult = await executeMCPWorkflow('schedule', {
            workflow_id: workflow.id,
            cron: args.cron,
            timezone: args.timezone,
            name: scheduleName,
            input: inputParams
          });

          spinner.stop();

          if (mcpResult.success) {
            console.log(chalk.green("\n✅ Workflow scheduled successfully"));
            console.log(chalk.cyan(`📅 Schedule: ${args.cron}`));
            console.log(chalk.gray(`🕐 Timezone: ${args.timezone}`));
            console.log(chalk.gray(`🏷️  Name: ${scheduleName}`));
            
            // Show next execution times
            console.log(chalk.blue("\n⏰ Next executions:"));
            console.log(chalk.gray("  (Schedule simulation would show here)"));
          } else {
            throw new Error(mcpResult.error || "Failed to register schedule");
          }

          return {
            success: true,
            message: "Workflow scheduled successfully",
            data: { schedule: scheduleName, cron: args.cron, workflow: workflow.id }
          };

        } catch (error) {
          spinner.stop();
          console.error(chalk.red("\n❌ Scheduling failed:"));
          console.error(chalk.red(`  ${error instanceof Error ? error.message : String(error)}`));
          process.exit(1);
        }
      },
    }),
  },
});