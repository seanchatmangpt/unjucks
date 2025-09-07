import { defineCommand } from "citty";
import * as chalk from "chalk";
import { createMCPBridge, type MCPBridge } from "../lib/mcp-integration.js";
import {
  validators,
  displayValidationResults,
  createCommandError,
} from "../lib/command-validation.js";
import type {
  CLICommandArgs,
  CLICommandResult,
  ValidationResult,
  UnjucksError,
} from "../types/unified-types.js";
import { CommandError, UnjucksCommandError } from "../types/commands.js";
import * as ora from "ora";
import * as fs from "fs-extra";
import * as path from "path";
import * as yaml from "yaml";

// ============================================================================
// NEURAL COMMAND TYPES
// ============================================================================

/**
 * Neural network architecture types
 */
export type NeuralArchitecture = 
  | "feedforward" 
  | "lstm" 
  | "gan" 
  | "autoencoder" 
  | "transformer"
  | "cnn"
  | "rnn"
  | "gnn"
  | "hybrid";

/**
 * Training tier types
 */
export type TrainingTier = "nano" | "mini" | "small" | "medium" | "large";

/**
 * Validation types
 */
export type ValidationType = "performance" | "accuracy" | "robustness" | "comprehensive";

/**
 * Benchmark types
 */
export type BenchmarkType = "inference" | "throughput" | "memory" | "comprehensive";

/**
 * Neural network configuration interface
 */
export interface NeuralConfig {
  architecture: {
    type: NeuralArchitecture;
    layers: Array<{
      type: string;
      units?: number;
      activation?: string;
      dropout?: number;
      [key: string]: any;
    }>;
  };
  training: {
    epochs: number;
    batch_size: number;
    learning_rate: number;
    optimizer: string;
  };
  divergent?: {
    enabled: boolean;
    pattern: "lateral" | "quantum" | "chaotic" | "associative" | "evolutionary";
    factor: number;
  };
}

/**
 * Cluster configuration interface
 */
export interface ClusterConfig {
  name: string;
  architecture: NeuralArchitecture;
  topology: "mesh" | "ring" | "star" | "hierarchical";
  daaEnabled: boolean;
  consensus: "proof-of-learning" | "byzantine" | "raft" | "gossip";
  wasmOptimization: boolean;
}

/**
 * Training job status
 */
export interface TrainingJobStatus {
  id: string;
  status: "pending" | "running" | "completed" | "failed";
  progress: number;
  metrics?: {
    loss: number;
    accuracy: number;
    epoch: number;
  };
  startTime: Date;
  endTime?: Date;
  error?: string;
}

/**
 * Model information
 */
export interface ModelInfo {
  id: string;
  name: string;
  architecture: NeuralArchitecture;
  size: string;
  accuracy?: number;
  createdAt: Date;
  isPublic: boolean;
}

/**
 * Template information
 */
export interface TemplateInfo {
  id: string;
  name: string;
  description: string;
  category: string;
  tier: "free" | "paid";
  price: number;
  rating: number;
  downloads: number;
}

/**
 * Validation workflow result
 */
export interface ValidationResult {
  modelId: string;
  validationType: ValidationType;
  score: number;
  metrics: Record<string, number>;
  passed: boolean;
  recommendations: string[];
}

/**
 * Benchmark result
 */
export interface BenchmarkResult {
  modelId: string;
  benchmarkType: BenchmarkType;
  metrics: {
    latency?: number;
    throughput?: number;
    memoryUsage?: number;
    cpuUsage?: number;
  };
  timestamp: Date;
}

// ============================================================================
// NEURAL COMMAND HANDLERS
// ============================================================================

/**
 * Train a neural network with custom configuration
 */
async function handleTrain(
  args: CLICommandArgs,
  mcp: MCPBridge
): Promise<CLICommandResult> {
  const spinner = ora("Training neural network...").start();
  
  try {
    // Validate arguments
    const configPath = args.config as string;
    const tier = (args.tier as TrainingTier) || "medium";
    const userId = args["user-id"] as string;

    if (!configPath) {
      throw new CommandError("Configuration file path is required", "MISSING_CONFIG");
    }

    // Load configuration
    let config: NeuralConfig;
    try {
      const configContent = await fs.readFile(configPath, "utf-8");
      const extension = path.extname(configPath).toLowerCase();
      
      if (extension === ".json") {
        config = JSON.parse(configContent);
      } else if (extension === ".yaml" || extension === ".yml") {
        config = yaml.parse(configContent);
      } else {
        throw new CommandError("Configuration must be JSON or YAML", "INVALID_CONFIG_FORMAT");
      }
    } catch (error) {
      throw new CommandError(
        `Failed to load configuration from ${configPath}: ${error.message}`,
        "CONFIG_LOAD_ERROR"
      );
    }

    spinner.text = "Submitting training job to neural cluster...";

    // Submit training job via MCP
    const result = await mcp.callTool("mcp__flow-nexus__neural_train", {
      config,
      tier,
      user_id: userId,
    });

    if (!result.success) {
      throw new CommandError(result.error || "Training job submission failed", "TRAINING_FAILED");
    }

    const jobId = result.data?.job_id;
    if (!jobId) {
      throw new CommandError("No job ID returned from training service", "NO_JOB_ID");
    }

    spinner.succeed(`Training job submitted successfully! Job ID: ${jobId}`);

    console.log(chalk.green("\n✅ Neural Network Training Started"));
    console.log(chalk.cyan(`📊 Job ID: ${jobId}`));
    console.log(chalk.cyan(`🎯 Tier: ${tier}`));
    console.log(chalk.cyan(`🏗️ Architecture: ${config.architecture.type}`));
    console.log(chalk.cyan(`📈 Epochs: ${config.training.epochs}`));
    console.log(chalk.yellow("\n💡 Use 'neural status --job-id " + jobId + "' to monitor progress"));

    return {
      success: true,
      data: {
        jobId,
        tier,
        config,
      },
    };

  } catch (error) {
    spinner.fail("Training failed");
    throw error;
  }
}

/**
 * Run inference/prediction on a trained model
 */
async function handlePredict(
  args: CLICommandArgs,
  mcp: MCPBridge
): Promise<CLICommandResult> {
  const spinner = ora("Running neural network inference...").start();
  
  try {
    const modelId = args["model-id"] as string;
    const inputPath = args.input as string;
    const userId = args["user-id"] as string;

    if (!modelId) {
      throw new CommandError("Model ID is required", "MISSING_MODEL_ID");
    }

    if (!inputPath) {
      throw new CommandError("Input data file path is required", "MISSING_INPUT");
    }

    // Load input data
    let inputData: any;
    try {
      const inputContent = await fs.readFile(inputPath, "utf-8");
      const extension = path.extname(inputPath).toLowerCase();
      
      if (extension === ".json") {
        inputData = JSON.parse(inputContent);
      } else if (extension === ".yaml" || extension === ".yml") {
        inputData = yaml.parse(inputContent);
      } else {
        throw new CommandError("Input data must be JSON or YAML", "INVALID_INPUT_FORMAT");
      }
    } catch (error) {
      throw new CommandError(
        `Failed to load input data from ${inputPath}: ${error.message}`,
        "INPUT_LOAD_ERROR"
      );
    }

    spinner.text = "Processing inference request...";

    // Run inference via MCP
    const result = await mcp.callTool("mcp__flow-nexus__neural_predict", {
      model_id: modelId,
      input: Array.isArray(inputData) ? inputData : [inputData],
      user_id: userId,
    });

    if (!result.success) {
      throw new CommandError(result.error || "Inference failed", "INFERENCE_FAILED");
    }

    spinner.succeed("Inference completed successfully!");

    console.log(chalk.green("\n✅ Neural Network Inference Complete"));
    console.log(chalk.cyan(`🤖 Model: ${modelId}`));
    console.log(chalk.cyan("📊 Results:"));
    console.log(JSON.stringify(result.data, null, 2));

    return {
      success: true,
      data: result.data,
    };

  } catch (error) {
    spinner.fail("Inference failed");
    throw error;
  }
}

/**
 * Initialize a distributed neural cluster
 */
async function handleClusterInit(
  args: CLICommandArgs,
  mcp: MCPBridge
): Promise<CLICommandResult> {
  const spinner = ora("Initializing neural cluster...").start();
  
  try {
    const name = args.name as string;
    const architecture = (args.architecture as NeuralArchitecture) || "transformer";
    const topology = args.topology as "mesh" | "ring" | "star" | "hierarchical" || "mesh";
    const daaEnabled = args["daa-enabled"] !== false;
    const consensus = args.consensus as "proof-of-learning" | "byzantine" | "raft" | "gossip" || "proof-of-learning";
    const wasmOptimization = args["wasm-optimization"] !== false;

    if (!name) {
      throw new CommandError("Cluster name is required", "MISSING_CLUSTER_NAME");
    }

    spinner.text = "Setting up distributed neural cluster...";

    // Initialize cluster via MCP
    const result = await mcp.callTool("mcp__flow-nexus__neural_cluster_init", {
      name,
      architecture,
      topology,
      daaEnabled,
      consensus,
      wasmOptimization,
    });

    if (!result.success) {
      throw new CommandError(result.error || "Cluster initialization failed", "CLUSTER_INIT_FAILED");
    }

    const clusterId = result.data?.cluster_id;
    if (!clusterId) {
      throw new CommandError("No cluster ID returned", "NO_CLUSTER_ID");
    }

    spinner.succeed("Neural cluster initialized successfully!");

    console.log(chalk.green("\n✅ Distributed Neural Cluster Ready"));
    console.log(chalk.cyan(`🆔 Cluster ID: ${clusterId}`));
    console.log(chalk.cyan(`📛 Name: ${name}`));
    console.log(chalk.cyan(`🏗️ Architecture: ${architecture}`));
    console.log(chalk.cyan(`🕸️ Topology: ${topology}`));
    console.log(chalk.cyan(`🤖 DAA Enabled: ${daaEnabled}`));
    console.log(chalk.cyan(`⚖️ Consensus: ${consensus}`));
    console.log(chalk.cyan(`⚡ WASM Optimization: ${wasmOptimization}`));

    return {
      success: true,
      data: {
        clusterId,
        name,
        architecture,
        topology,
      },
    };

  } catch (error) {
    spinner.fail("Cluster initialization failed");
    throw error;
  }
}

/**
 * Deploy a template from the app store
 */
async function handleDeployTemplate(
  args: CLICommandArgs,
  mcp: MCPBridge
): Promise<CLICommandResult> {
  const spinner = ora("Deploying neural template...").start();
  
  try {
    const templateId = args["template-id"] as string;
    const customConfigPath = args["custom-config"] as string;
    const userId = args["user-id"] as string;

    if (!templateId) {
      throw new CommandError("Template ID is required", "MISSING_TEMPLATE_ID");
    }

    let customConfig: any = {};
    if (customConfigPath) {
      try {
        const configContent = await fs.readFile(customConfigPath, "utf-8");
        const extension = path.extname(customConfigPath).toLowerCase();
        
        if (extension === ".json") {
          customConfig = JSON.parse(configContent);
        } else if (extension === ".yaml" || extension === ".yml") {
          customConfig = yaml.parse(configContent);
        } else {
          throw new CommandError("Custom config must be JSON or YAML", "INVALID_CONFIG_FORMAT");
        }
      } catch (error) {
        throw new CommandError(
          `Failed to load custom config: ${error.message}`,
          "CONFIG_LOAD_ERROR"
        );
      }
    }

    spinner.text = "Deploying template from app store...";

    // Deploy template via MCP
    const result = await mcp.callTool("mcp__flow-nexus__neural_deploy_template", {
      template_id: templateId,
      custom_config: customConfig,
      user_id: userId,
    });

    if (!result.success) {
      throw new CommandError(result.error || "Template deployment failed", "DEPLOY_FAILED");
    }

    spinner.succeed("Template deployed successfully!");

    console.log(chalk.green("\n✅ Neural Template Deployed"));
    console.log(chalk.cyan(`🆔 Template ID: ${templateId}`));
    if (result.data?.model_id) {
      console.log(chalk.cyan(`🤖 Model ID: ${result.data.model_id}`));
    }
    if (result.data?.endpoint) {
      console.log(chalk.cyan(`🌐 Endpoint: ${result.data.endpoint}`));
    }

    return {
      success: true,
      data: result.data,
    };

  } catch (error) {
    spinner.fail("Template deployment failed");
    throw error;
  }
}

/**
 * Run performance benchmarks on a model
 */
async function handleBenchmark(
  args: CLICommandArgs,
  mcp: MCPBridge
): Promise<CLICommandResult> {
  const spinner = ora("Running performance benchmarks...").start();
  
  try {
    const modelId = args["model-id"] as string;
    const benchmarkType = (args.type as BenchmarkType) || "comprehensive";

    if (!modelId) {
      throw new CommandError("Model ID is required", "MISSING_MODEL_ID");
    }

    spinner.text = `Running ${benchmarkType} benchmarks...`;

    // Run benchmark via MCP
    const result = await mcp.callTool("mcp__flow-nexus__neural_performance_benchmark", {
      model_id: modelId,
      benchmark_type: benchmarkType,
    });

    if (!result.success) {
      throw new CommandError(result.error || "Benchmark failed", "BENCHMARK_FAILED");
    }

    spinner.succeed("Performance benchmarks completed!");

    console.log(chalk.green("\n✅ Benchmark Results"));
    console.log(chalk.cyan(`🤖 Model: ${modelId}`));
    console.log(chalk.cyan(`📊 Type: ${benchmarkType}`));
    
    const metrics = result.data?.metrics || {};
    if (metrics.latency) {
      console.log(chalk.yellow(`⏱️ Latency: ${metrics.latency}ms`));
    }
    if (metrics.throughput) {
      console.log(chalk.yellow(`🚀 Throughput: ${metrics.throughput} req/s`));
    }
    if (metrics.memoryUsage) {
      console.log(chalk.yellow(`💾 Memory: ${metrics.memoryUsage}MB`));
    }
    if (metrics.cpuUsage) {
      console.log(chalk.yellow(`⚡ CPU: ${metrics.cpuUsage}%`));
    }

    return {
      success: true,
      data: result.data,
    };

  } catch (error) {
    spinner.fail("Benchmarks failed");
    throw error;
  }
}

/**
 * Run model validation workflow
 */
async function handleValidate(
  args: CLICommandArgs,
  mcp: MCPBridge
): Promise<CLICommandResult> {
  const spinner = ora("Running model validation...").start();
  
  try {
    const modelId = args["model-id"] as string;
    const validationType = (args["validation-type"] as ValidationType) || "comprehensive";
    const userId = args["user-id"] as string;

    if (!modelId) {
      throw new CommandError("Model ID is required", "MISSING_MODEL_ID");
    }

    spinner.text = `Running ${validationType} validation...`;

    // Run validation via MCP
    const result = await mcp.callTool("mcp__flow-nexus__neural_validation_workflow", {
      model_id: modelId,
      validation_type: validationType,
      user_id: userId,
    });

    if (!result.success) {
      throw new CommandError(result.error || "Validation failed", "VALIDATION_FAILED");
    }

    spinner.succeed("Model validation completed!");

    console.log(chalk.green("\n✅ Validation Results"));
    console.log(chalk.cyan(`🤖 Model: ${modelId}`));
    console.log(chalk.cyan(`🔍 Type: ${validationType}`));
    
    const validationResult = result.data;
    if (validationResult?.score !== undefined) {
      console.log(chalk.yellow(`📊 Score: ${validationResult.score}/100`));
    }
    if (validationResult?.passed) {
      console.log(chalk.green("✅ Validation Passed"));
    } else {
      console.log(chalk.red("❌ Validation Failed"));
    }
    
    if (validationResult?.recommendations?.length) {
      console.log(chalk.cyan("\n💡 Recommendations:"));
      validationResult.recommendations.forEach((rec: string, index: number) => {
        console.log(chalk.yellow(`  ${index + 1}. ${rec}`));
      });
    }

    return {
      success: true,
      data: result.data,
    };

  } catch (error) {
    spinner.fail("Validation failed");
    throw error;
  }
}

/**
 * Check training job status
 */
async function handleStatus(
  args: CLICommandArgs,
  mcp: MCPBridge
): Promise<CLICommandResult> {
  const spinner = ora("Checking training status...").start();
  
  try {
    const jobId = args["job-id"] as string;

    if (!jobId) {
      throw new CommandError("Job ID is required", "MISSING_JOB_ID");
    }

    // Get training status via MCP
    const result = await mcp.callTool("mcp__flow-nexus__neural_training_status", {
      job_id: jobId,
    });

    if (!result.success) {
      throw new CommandError(result.error || "Status check failed", "STATUS_FAILED");
    }

    spinner.succeed("Status retrieved successfully!");

    const status = result.data;
    console.log(chalk.green("\n📊 Training Job Status"));
    console.log(chalk.cyan(`🆔 Job ID: ${jobId}`));
    console.log(chalk.cyan(`📈 Status: ${status?.status || 'unknown'}`));
    
    if (status?.progress !== undefined) {
      console.log(chalk.yellow(`⏳ Progress: ${status.progress}%`));
    }
    
    if (status?.metrics) {
      console.log(chalk.cyan("\n📊 Current Metrics:"));
      if (status.metrics.epoch) {
        console.log(chalk.yellow(`📚 Epoch: ${status.metrics.epoch}`));
      }
      if (status.metrics.loss) {
        console.log(chalk.yellow(`📉 Loss: ${status.metrics.loss.toFixed(4)}`));
      }
      if (status.metrics.accuracy) {
        console.log(chalk.yellow(`🎯 Accuracy: ${(status.metrics.accuracy * 100).toFixed(2)}%`));
      }
    }

    if (status?.error) {
      console.log(chalk.red(`\n❌ Error: ${status.error}`));
    }

    return {
      success: true,
      data: result.data,
    };

  } catch (error) {
    spinner.fail("Status check failed");
    throw error;
  }
}

/**
 * List available templates
 */
async function handleListTemplates(
  args: CLICommandArgs,
  mcp: MCPBridge
): Promise<CLICommandResult> {
  const spinner = ora("Fetching neural templates...").start();
  
  try {
    const category = args.category as string;
    const tier = args.tier as "free" | "paid";
    const search = args.search as string;
    const limit = parseInt(args.limit as string) || 20;

    // List templates via MCP
    const result = await mcp.callTool("mcp__flow-nexus__neural_list_templates", {
      category,
      tier,
      search,
      limit,
    });

    if (!result.success) {
      throw new CommandError(result.error || "Failed to fetch templates", "LIST_FAILED");
    }

    spinner.succeed("Templates retrieved successfully!");

    const templates = result.data?.templates || [];
    
    console.log(chalk.green(`\n📚 Neural Network Templates (${templates.length})`));
    
    if (templates.length === 0) {
      console.log(chalk.yellow("No templates found matching your criteria."));
      return {
        success: true,
        data: { templates: [] },
      };
    }

    templates.forEach((template: TemplateInfo) => {
      console.log(chalk.cyan(`\n🆔 ${template.id}`));
      console.log(chalk.white(`📛 ${template.name}`));
      console.log(chalk.gray(`📝 ${template.description}`));
      console.log(chalk.yellow(`🏷️ ${template.category} | ${template.tier} | $${template.price}`));
      if (template.rating) {
        console.log(chalk.yellow(`⭐ ${template.rating}/5 (${template.downloads || 0} downloads)`));
      }
    });

    return {
      success: true,
      data: result.data,
    };

  } catch (error) {
    spinner.fail("Template listing failed");
    throw error;
  }
}

/**
 * List user's trained models
 */
async function handleListModels(
  args: CLICommandArgs,
  mcp: MCPBridge
): Promise<CLICommandResult> {
  const spinner = ora("Fetching trained models...").start();
  
  try {
    const userId = args["user-id"] as string;
    const includePublic = args["include-public"] as boolean || false;

    if (!userId) {
      throw new CommandError("User ID is required", "MISSING_USER_ID");
    }

    // List models via MCP
    const result = await mcp.callTool("mcp__flow-nexus__neural_list_models", {
      user_id: userId,
      include_public: includePublic,
    });

    if (!result.success) {
      throw new CommandError(result.error || "Failed to fetch models", "LIST_FAILED");
    }

    spinner.succeed("Models retrieved successfully!");

    const models = result.data?.models || [];
    
    console.log(chalk.green(`\n🤖 Your Trained Models (${models.length})`));
    
    if (models.length === 0) {
      console.log(chalk.yellow("No trained models found."));
      return {
        success: true,
        data: { models: [] },
      };
    }

    models.forEach((model: ModelInfo) => {
      console.log(chalk.cyan(`\n🆔 ${model.id}`));
      console.log(chalk.white(`📛 ${model.name}`));
      console.log(chalk.yellow(`🏗️ ${model.architecture} | ${model.size}`));
      if (model.accuracy) {
        console.log(chalk.green(`🎯 Accuracy: ${(model.accuracy * 100).toFixed(2)}%`));
      }
      console.log(chalk.gray(`📅 Created: ${model.createdAt}`));
      console.log(chalk.gray(`🔓 ${model.isPublic ? 'Public' : 'Private'}`));
    });

    return {
      success: true,
      data: result.data,
    };

  } catch (error) {
    spinner.fail("Model listing failed");
    throw error;
  }
}

// ============================================================================
// MAIN NEURAL COMMAND
// ============================================================================

export default defineCommand({
  meta: {
    name: "neural",
    description: "Neural network operations with MCP integration",
  },
  args: {
    // Global options
    "user-id": {
      type: "string",
      description: "User ID for authentication",
    },
    help: {
      type: "boolean",
      description: "Show help information",
    },
  },
  subCommands: {
    train: defineCommand({
      meta: {
        name: "train",
        description: "Train a neural network with custom configuration",
      },
      args: {
        config: {
          type: "string",
          description: "Path to neural network configuration file (JSON/YAML)",
          required: true,
        },
        tier: {
          type: "string",
          description: "Training tier (nano, mini, small, medium, large)",
          default: "medium",
        },
        "user-id": {
          type: "string",
          description: "User ID for authentication",
        },
      },
      async run({ args }) {
        const mcp = await createMCPBridge();
        return await handleTrain(args, mcp);
      },
    }),

    predict: defineCommand({
      meta: {
        name: "predict",
        description: "Run inference on a trained model",
      },
      args: {
        "model-id": {
          type: "string",
          description: "ID of the trained model",
          required: true,
        },
        input: {
          type: "string",
          description: "Path to input data file (JSON/YAML)",
          required: true,
        },
        "user-id": {
          type: "string",
          description: "User ID for authentication",
        },
      },
      async run({ args }) {
        const mcp = await createMCPBridge();
        return await handlePredict(args, mcp);
      },
    }),

    "cluster-init": defineCommand({
      meta: {
        name: "cluster-init",
        description: "Initialize a distributed neural network cluster",
      },
      args: {
        name: {
          type: "string",
          description: "Cluster name",
          required: true,
        },
        architecture: {
          type: "string",
          description: "Neural network architecture (transformer, cnn, rnn, etc.)",
          default: "transformer",
        },
        topology: {
          type: "string",
          description: "Network topology (mesh, ring, star, hierarchical)",
          default: "mesh",
        },
        "daa-enabled": {
          type: "boolean",
          description: "Enable DAA autonomous coordination",
          default: true,
        },
        consensus: {
          type: "string",
          description: "DAA consensus mechanism (proof-of-learning, byzantine, raft, gossip)",
          default: "proof-of-learning",
        },
        "wasm-optimization": {
          type: "boolean",
          description: "Enable WASM acceleration",
          default: true,
        },
      },
      async run({ args }) {
        const mcp = await createMCPBridge();
        return await handleClusterInit(args, mcp);
      },
    }),

    "deploy-template": defineCommand({
      meta: {
        name: "deploy-template",
        description: "Deploy a template from the app store",
      },
      args: {
        "template-id": {
          type: "string",
          description: "Template ID from app store",
          required: true,
        },
        "custom-config": {
          type: "string",
          description: "Path to custom configuration overrides (JSON/YAML)",
        },
        "user-id": {
          type: "string",
          description: "User ID for authentication",
        },
      },
      async run({ args }) {
        const mcp = await createMCPBridge();
        return await handleDeployTemplate(args, mcp);
      },
    }),

    benchmark: defineCommand({
      meta: {
        name: "benchmark",
        description: "Run performance benchmarks on a model",
      },
      args: {
        "model-id": {
          type: "string",
          description: "Model ID to benchmark",
          required: true,
        },
        type: {
          type: "string",
          description: "Benchmark type (inference, throughput, memory, comprehensive)",
          default: "comprehensive",
        },
      },
      async run({ args }) {
        const mcp = await createMCPBridge();
        return await handleBenchmark(args, mcp);
      },
    }),

    validate: defineCommand({
      meta: {
        name: "validate",
        description: "Run model validation workflow",
      },
      args: {
        "model-id": {
          type: "string",
          description: "Model ID to validate",
          required: true,
        },
        "validation-type": {
          type: "string",
          description: "Validation type (performance, accuracy, robustness, comprehensive)",
          default: "comprehensive",
        },
        "user-id": {
          type: "string",
          description: "User ID for authentication",
        },
      },
      async run({ args }) {
        const mcp = await createMCPBridge();
        return await handleValidate(args, mcp);
      },
    }),

    status: defineCommand({
      meta: {
        name: "status",
        description: "Check training job status",
      },
      args: {
        "job-id": {
          type: "string",
          description: "Training job ID",
          required: true,
        },
      },
      async run({ args }) {
        const mcp = await createMCPBridge();
        return await handleStatus(args, mcp);
      },
    }),

    "list-templates": defineCommand({
      meta: {
        name: "list-templates",
        description: "List available neural network templates",
      },
      args: {
        category: {
          type: "string",
          description: "Filter by category (timeseries, classification, regression, etc.)",
        },
        tier: {
          type: "string",
          description: "Filter by pricing tier (free, paid)",
        },
        search: {
          type: "string",
          description: "Search term for template name or description",
        },
        limit: {
          type: "string",
          description: "Maximum number of templates to return",
          default: "20",
        },
      },
      async run({ args }) {
        const mcp = await createMCPBridge();
        return await handleListTemplates(args, mcp);
      },
    }),

    "list-models": defineCommand({
      meta: {
        name: "list-models",
        description: "List your trained models",
      },
      args: {
        "user-id": {
          type: "string",
          description: "User ID for authentication",
          required: true,
        },
        "include-public": {
          type: "boolean",
          description: "Include public models in addition to user models",
          default: false,
        },
      },
      async run({ args }) {
        const mcp = await createMCPBridge();
        return await handleListModels(args, mcp);
      },
    }),
  },

  async run({ args }) {
    if (args.help) {
      console.log(chalk.cyan("\n🧠 Neural Network Command"));
      console.log(chalk.white("\nManage neural networks with distributed training and inference capabilities."));
      
      console.log(chalk.yellow("\n📚 Available Commands:"));
      console.log(chalk.white("  train              Train a neural network"));
      console.log(chalk.white("  predict            Run inference on a model"));
      console.log(chalk.white("  cluster-init       Initialize distributed cluster"));
      console.log(chalk.white("  deploy-template    Deploy template from app store"));
      console.log(chalk.white("  benchmark          Run performance benchmarks"));
      console.log(chalk.white("  validate           Run model validation"));
      console.log(chalk.white("  status             Check training job status"));
      console.log(chalk.white("  list-templates     List available templates"));
      console.log(chalk.white("  list-models        List your trained models"));

      console.log(chalk.yellow("\n💡 Examples:"));
      console.log(chalk.gray("  neural train --config ./config.json --tier medium"));
      console.log(chalk.gray("  neural predict --model-id abc123 --input ./data.json"));
      console.log(chalk.gray("  neural cluster-init --name ml-cluster --architecture transformer"));
      console.log(chalk.gray("  neural benchmark --model-id abc123 --type comprehensive"));
      console.log(chalk.gray("  neural validate --model-id abc123 --validation-type accuracy"));

      return { success: true };
    }

    console.log(chalk.yellow("\n🧠 Neural Network Command"));
    console.log(chalk.white("Use --help to see available subcommands and options."));
    console.log(chalk.gray("Example: neural train --config ./config.json"));
    
    return { success: true };
  },
});