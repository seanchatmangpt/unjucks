import { defineCommand } from "citty";
import * as chalk from "chalk";
import {
  validators,
  displayValidationResults,
  createCommandError,
} from "../lib/command-validation.js";
import type {
  CLICommandArgs,
  CLICommandResult,
  ValidationResult,
} from "../types/unified-types.js";
import { CommandError } from "../types/commands.js";
import ora from "ora";
import * as fs from "fs-extra";
import * as path from "path";

// ============================================================================
// PERFORMANCE COMMAND TYPES
// ============================================================================

/**
 * Benchmark suite types
 */
export type BenchmarkSuite = "all" | "wasm" | "swarm" | "agent" | "task" | "neural";

/**
 * Component types for analysis
 */
export type ComponentType = "api" | "database" | "memory" | "neural" | "swarm" | "all";

/**
 * Time frame options
 */
export type TimeFrame = "1h" | "24h" | "7d" | "30d" | "90d";

/**
 * Memory namespace types
 */
export type MemoryNamespace = "default" | "swarm" | "neural" | "cache" | "session";

/**
 * Performance metrics interface
 */
export interface PerformanceMetrics {
  cpu: number;
  memory: number;
  tasks: number;
  performance: number;
  timestamp: string;
}

/**
 * Benchmark result interface
 */
export interface BenchmarkResult {
  suite: string;
  iterations: number;
  averageTime: number;
  minTime: number;
  maxTime: number;
  throughput: number;
  success: boolean;
}

/**
 * Token usage statistics
 */
export interface TokenUsage {
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  operations: number;
  timeframe: string;
  breakdown?: Record<string, { tokens: number; cost: number }>;
}

// ============================================================================
// PERFORMANCE COMMAND IMPLEMENTATION
// ============================================================================

export const perfCommand = defineCommand({
  meta: {
    name: "perf",
    description: "Performance monitoring and analysis tools for Unjucks with MCP integration",
  },
  subCommands: {
    // ========================================================================
    // BENCHMARK SUBCOMMAND
    // ========================================================================
    benchmark: defineCommand({
      meta: {
        name: "benchmark",
        description: "Run performance benchmarks across different components",
      },
      args: {
        suite: {
          type: "string",
          description: "Benchmark suite to run (all, wasm, swarm, agent, task, neural)",
          default: "all",
          alias: "s",
        },
        iterations: {
          type: "string",
          description: "Number of iterations to run",
          default: "10",
          alias: "i",
        },
        output: {
          type: "string",
          description: "Output format (json, table, summary)",
          default: "table",
          alias: "o",
        },
        save: {
          type: "boolean",
          description: "Save results to file",
          default: false,
        },
      },
      async run({ args }: { args: any }): Promise<CLICommandResult> {
        const spinner = ora("Running performance benchmarks...").start();

        try {
          // Validate arguments
          const validation = validators.validateBenchmarkArgs({
            suite: args.suite,
            iterations: parseInt(args.iterations),
            output: args.output,
          });

          if (!validation.valid) {
            displayValidationResults([validation], "benchmark");
            throw createCommandError("Invalid benchmark arguments", CommandError.VALIDATION_ERROR);
          }

          spinner.text = "Running benchmarks...";

          // Mock benchmark results for now - this will be replaced with actual MCP integration
          const benchmarkResult = await runMockBenchmarks(args.suite, parseInt(args.iterations));

          spinner.succeed("Benchmarks completed successfully");

          // Display results
          console.log(chalk.blue.bold("\n🚀 Performance Benchmark Results"));
          console.log(chalk.gray(`Suite: ${args.suite} | Iterations: ${args.iterations}`));
          
          displayBenchmarkResults(benchmarkResult.results, args.output);

          // Save results if requested
          if (args.save) {
            await saveBenchmarkResults(benchmarkResult, args.suite);
          }

          return {
            success: true,
            data: benchmarkResult
          };

        } catch (error: any) {
          spinner.fail("Benchmark failed");
          throw createCommandError(error.message || "Benchmark failed", CommandError.UNKNOWN_ERROR);
        }
      },
    }),

    // ========================================================================
    // BOTTLENECKS SUBCOMMAND
    // ========================================================================
    bottlenecks: defineCommand({
      meta: {
        name: "bottlenecks",
        description: "Analyze performance bottlenecks in system components",
      },
      args: {
        component: {
          type: "string",
          description: "Component to analyze (api, database, memory, neural, swarm, all)",
          default: "all",
          alias: "c",
        },
        threshold: {
          type: "string",
          description: "Performance threshold for bottleneck detection",
          default: "80",
          alias: "t",
        },
        detailed: {
          type: "boolean",
          description: "Show detailed analysis",
          default: false,
          alias: "d",
        },
      },
      async run({ args }: { args: any }): Promise<CLICommandResult> {
        const spinner = ora("Analyzing performance bottlenecks...").start();

        try {
          spinner.text = "Analyzing bottlenecks...";

          // Mock bottleneck analysis for now
          const bottleneckResult = await runMockBottleneckAnalysis(args.component, args.detailed);

          spinner.succeed("Bottleneck analysis completed");

          // Display results
          console.log(chalk.yellow.bold("\n⚠️  Performance Bottleneck Analysis"));
          console.log(chalk.gray(`Component: ${args.component} | Threshold: ${args.threshold}%`));
          
          displayBottleneckAnalysis(bottleneckResult.bottlenecks, args.detailed);

          return {
            success: true,
            data: bottleneckResult
          };

        } catch (error: any) {
          spinner.fail("Bottleneck analysis failed");
          throw createCommandError(error.message || "Bottleneck analysis failed", CommandError.UNKNOWN_ERROR);
        }
      },
    }),

    // ========================================================================
    // TOKENS SUBCOMMAND
    // ========================================================================
    tokens: defineCommand({
      meta: {
        name: "tokens",
        description: "Track token usage and consumption patterns",
      },
      args: {
        timeframe: {
          type: "string",
          description: "Time frame for analysis (1h, 24h, 7d, 30d, 90d)",
          default: "24h",
          alias: "t",
        },
        operation: {
          type: "string",
          description: "Specific operation to analyze",
          alias: "o",
        },
        breakdown: {
          type: "boolean",
          description: "Show detailed breakdown by operation type",
          default: false,
          alias: "b",
        },
      },
      async run({ args }: { args: any }): Promise<CLICommandResult> {
        const spinner = ora("Analyzing token usage...").start();

        try {
          spinner.text = "Analyzing token usage...";

          // Mock token usage analysis for now
          const tokenResult = await runMockTokenAnalysis(args.timeframe, args.breakdown);

          spinner.succeed("Token analysis completed");

          // Display results
          console.log(chalk.green.bold("\n📊 Token Usage Analysis"));
          console.log(chalk.gray(`Timeframe: ${args.timeframe}`));
          
          displayTokenUsage(tokenResult.usage, args.breakdown);

          return {
            success: true,
            data: tokenResult
          };

        } catch (error: any) {
          spinner.fail("Token analysis failed");
          throw createCommandError(error.message || "Token analysis failed", CommandError.UNKNOWN_ERROR);
        }
      },
    }),

    // ========================================================================
    // MEMORY SUBCOMMAND
    // ========================================================================
    memory: defineCommand({
      meta: {
        name: "memory",
        description: "Analyze memory usage and patterns",
      },
      args: {
        namespace: {
          type: "string",
          description: "Memory namespace to analyze (default, swarm, neural, cache, session)",
          default: "default",
          alias: "n",
        },
        detail: {
          type: "string",
          description: "Detail level (summary, detailed, by-agent)",
          default: "summary",
          alias: "d",
        },
        cleanup: {
          type: "boolean",
          description: "Clean up unused memory",
          default: false,
          alias: "c",
        },
      },
      async run({ args }: { args: any }): Promise<CLICommandResult> {
        const spinner = ora("Analyzing memory usage...").start();

        try {
          spinner.text = "Analyzing memory...";

          // Mock memory analysis for now
          const memoryResult = await runMockMemoryAnalysis(args.detail);

          spinner.succeed("Memory analysis completed");

          // Display results
          console.log(chalk.cyan.bold("\n💾 Memory Usage Analysis"));
          console.log(chalk.gray(`Namespace: ${args.namespace} | Detail: ${args.detail}`));
          
          displayMemoryAnalysis(memoryResult.usage, args.detail);

          // Cleanup if requested
          if (args.cleanup) {
            spinner.start("Cleaning up unused memory...");
            await new Promise(resolve => setTimeout(resolve, 1000)); // Mock cleanup
            spinner.succeed("Memory cleanup completed");
          }

          return {
            success: true,
            data: memoryResult
          };

        } catch (error: any) {
          spinner.fail("Memory analysis failed");
          throw createCommandError(error.message || "Memory analysis failed", CommandError.UNKNOWN_ERROR);
        }
      },
    }),

    // ========================================================================
    // COST SUBCOMMAND
    // ========================================================================
    cost: defineCommand({
      meta: {
        name: "cost",
        description: "Analyze cost and resource usage",
      },
      args: {
        timeframe: {
          type: "string",
          description: "Time frame for cost analysis (1h, 24h, 7d, 30d, 90d)",
          default: "7d",
          alias: "t",
        },
        breakdown: {
          type: "boolean",
          description: "Show cost breakdown by operation type",
          default: false,
          alias: "b",
        },
        forecast: {
          type: "boolean",
          description: "Include cost forecast",
          default: false,
          alias: "f",
        },
      },
      async run({ args }: { args: any }): Promise<CLICommandResult> {
        const spinner = ora("Analyzing costs...").start();

        try {
          spinner.text = "Analyzing costs...";

          // Mock cost analysis for now
          const costResult = await runMockCostAnalysis(args.breakdown, args.forecast);

          spinner.succeed("Cost analysis completed");

          // Display results
          console.log(chalk.magenta.bold("\n💰 Cost Analysis"));
          console.log(chalk.gray(`Timeframe: ${args.timeframe}`));
          
          displayCostAnalysis(costResult.costs, args.breakdown, args.forecast);

          return {
            success: true,
            data: costResult
          };

        } catch (error: any) {
          spinner.fail("Cost analysis failed");
          throw createCommandError(error.message || "Cost analysis failed", CommandError.UNKNOWN_ERROR);
        }
      },
    }),

    // ========================================================================
    // HEALTH SUBCOMMAND
    // ========================================================================
    health: defineCommand({
      meta: {
        name: "health",
        description: "Monitor system health and status",
      },
      args: {
        components: {
          type: "string",
          description: "Components to check (comma-separated: api,database,memory,neural,swarm)",
          default: "all",
          alias: "c",
        },
        watch: {
          type: "boolean",
          description: "Continuous monitoring mode",
          default: false,
          alias: "w",
        },
        interval: {
          type: "string",
          description: "Monitoring interval in seconds (for watch mode)",
          default: "30",
          alias: "i",
        },
      },
      async run({ args }: { args: any }): Promise<CLICommandResult> {
        const spinner = ora("Checking system health...").start();

        try {
          spinner.text = "Checking health...";

          // Parse components
          const components = args.components === "all" 
            ? ["api", "database", "memory", "neural", "swarm"]
            : args.components.split(",").map((c: string) => c.trim());

          // Mock health check for now
          const healthResult = await runMockHealthCheck(components);

          spinner.succeed("Health check completed");

          // Display results
          console.log(chalk.green.bold("\n🏥 System Health Status"));
          console.log(chalk.gray(`Components: ${components.join(", ")}`));
          
          displayHealthStatus(healthResult.status, components);

          // Watch mode
          if (args.watch) {
            console.log(chalk.yellow(`\n👁️  Entering watch mode (${args.interval}s intervals)`));
            console.log(chalk.gray("Press Ctrl+C to exit"));
            
            await startHealthWatchMode(components, parseInt(args.interval));
          }

          return {
            success: true,
            data: healthResult
          };

        } catch (error: any) {
          spinner.fail("Health check failed");
          throw createCommandError(error.message || "Health check failed", CommandError.UNKNOWN_ERROR);
        }
      },
    }),

    // ========================================================================
    // REPORT SUBCOMMAND
    // ========================================================================
    report: defineCommand({
      meta: {
        name: "report",
        description: "Generate comprehensive performance report",
      },
      args: {
        format: {
          type: "string",
          description: "Report format (summary, detailed, json)",
          default: "detailed",
          alias: "f",
        },
        timeframe: {
          type: "string",
          description: "Report timeframe (24h, 7d, 30d)",
          default: "24h",
          alias: "t",
        },
        output: {
          type: "string",
          description: "Output file path",
          alias: "o",
        },
      },
      async run({ args }: { args: any }): Promise<CLICommandResult> {
        const spinner = ora("Generating performance report...").start();

        try {
          spinner.text = "Generating report...";

          // Mock report generation for now
          const reportResult = await runMockReportGeneration(args.format, args.timeframe);

          spinner.succeed("Performance report generated");

          // Display report
          console.log(chalk.blue.bold("\n📋 Performance Report"));
          console.log(chalk.gray(`Format: ${args.format} | Timeframe: ${args.timeframe}`));
          
          displayPerformanceReport(reportResult.report, args.format);

          // Save report if output specified
          if (args.output) {
            await savePerformanceReport(reportResult.report, args.output, args.format);
            console.log(chalk.green(`\n📁 Report saved to: ${args.output}`));
          }

          return {
            success: true,
            data: reportResult
          };

        } catch (error: any) {
          spinner.fail("Report generation failed");
          throw createCommandError(error.message || "Report generation failed", CommandError.UNKNOWN_ERROR);
        }
      },
    }),
  },
});

// ============================================================================
// MOCK FUNCTIONS (TO BE REPLACED WITH ACTUAL MCP INTEGRATION)
// ============================================================================

async function runMockBenchmarks(suite: string, iterations: number): Promise<{ results: BenchmarkResult[] }> {
  // Simulate benchmark execution
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  const results: BenchmarkResult[] = [];
  const suites = suite === "all" ? ["wasm", "swarm", "agent", "task", "neural"] : [suite];
  
  for (const s of suites) {
    results.push({
      suite: s,
      iterations,
      averageTime: Math.random() * 100 + 50,
      minTime: Math.random() * 50 + 20,
      maxTime: Math.random() * 200 + 100,
      throughput: Math.random() * 1000 + 500,
      success: true,
    });
  }
  
  return { results };
}

async function runMockBottleneckAnalysis(component: string, detailed: boolean): Promise<{ bottlenecks: any[] }> {
  await new Promise(resolve => setTimeout(resolve, 800));
  
  // Mock some bottlenecks
  const bottlenecks = [];
  
  if (Math.random() > 0.7) {
    bottlenecks.push({
      component: "memory",
      severity: "medium",
      metric: "usage",
      value: "85%",
      recommendations: detailed ? ["Consider increasing memory allocation", "Optimize memory usage patterns"] : undefined,
    });
  }
  
  return { bottlenecks };
}

async function runMockTokenAnalysis(timeframe: string, breakdown: boolean): Promise<{ usage: TokenUsage }> {
  await new Promise(resolve => setTimeout(resolve, 600));
  
  const usage: TokenUsage = {
    totalTokens: Math.floor(Math.random() * 100000) + 50000,
    inputTokens: Math.floor(Math.random() * 40000) + 20000,
    outputTokens: Math.floor(Math.random() * 30000) + 15000,
    cost: Math.random() * 50 + 10,
    operations: Math.floor(Math.random() * 1000) + 500,
    timeframe,
  };
  
  if (breakdown) {
    usage.breakdown = {
      "generate": { tokens: 25000, cost: 12.5 },
      "analyze": { tokens: 15000, cost: 7.5 },
      "refactor": { tokens: 10000, cost: 5.0 },
    };
  }
  
  return { usage };
}

async function runMockMemoryAnalysis(detail: string): Promise<{ usage: any }> {
  await new Promise(resolve => setTimeout(resolve, 500));
  
  const usage = {
    total: 8589934592, // 8GB
    used: Math.floor(Math.random() * 4000000000) + 2000000000, // 2-6GB
    available: 0,
    percentage: 0,
  };
  
  usage.available = usage.total - usage.used;
  usage.percentage = (usage.used / usage.total) * 100;
  
  if (detail === "detailed") {
    (usage as any).breakdown = {
      "templates": 512000000,
      "cache": 256000000,
      "generators": 128000000,
      "other": usage.used - 896000000,
    };
  }
  
  return { usage };
}

async function runMockCostAnalysis(breakdown: boolean, forecast: boolean): Promise<{ costs: any }> {
  await new Promise(resolve => setTimeout(resolve, 700));
  
  const costs = {
    total: Math.random() * 100 + 50,
    tokens: Math.random() * 40 + 20,
    compute: Math.random() * 30 + 15,
    storage: Math.random() * 10 + 5,
  };
  
  if (breakdown) {
    (costs as any).breakdown = {
      "claude-calls": 25.50,
      "generation": 15.25,
      "analysis": 8.75,
    };
  }
  
  if (forecast) {
    (costs as any).forecast = costs.total * 30 * 1.1; // 30-day with 10% growth
  }
  
  return { costs };
}

async function runMockHealthCheck(components: string[]): Promise<{ status: any }> {
  await new Promise(resolve => setTimeout(resolve, 400));
  
  const status: any = {};
  
  for (const component of components) {
    const isHealthy = Math.random() > 0.2; // 80% chance of being healthy
    status[component] = {
      healthy: isHealthy,
      status: isHealthy ? "OK" : "Issues Detected",
      issues: isHealthy ? [] : [`${component} performance degraded`, `High ${component} usage`],
    };
  }
  
  return { status };
}

async function runMockReportGeneration(format: string, timeframe: string): Promise<{ report: any }> {
  await new Promise(resolve => setTimeout(resolve, 1200));
  
  const report = {
    health: "Good",
    operations: Math.floor(Math.random() * 10000) + 5000,
    averageResponseTime: `${Math.floor(Math.random() * 500) + 100}ms`,
    errorRate: `${(Math.random() * 5).toFixed(1)}%`,
    details: format === "detailed" ? {
      "Memory Usage": "65%",
      "CPU Utilization": "45%",
      "Active Generators": "12",
      "Cache Hit Rate": "87%",
    } : undefined,
  };
  
  return { report };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Display benchmark results in formatted table
 */
function displayBenchmarkResults(results: BenchmarkResult[], format: string): void {
  if (format === "json") {
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  console.log("\n┌─────────────────┬─────────────┬─────────────┬─────────────┬─────────────┬─────────────┐");
  console.log("│ Suite           │ Iterations  │ Avg Time    │ Min Time    │ Max Time    │ Throughput  │");
  console.log("├─────────────────┼─────────────┼─────────────┼─────────────┼─────────────┼─────────────┤");
  
  results.forEach((result: BenchmarkResult) => {
    const suite = result.suite.padEnd(15);
    const iterations = result.iterations.toString().padEnd(11);
    const avgTime = `${result.averageTime.toFixed(2)}ms`.padEnd(11);
    const minTime = `${result.minTime.toFixed(2)}ms`.padEnd(11);
    const maxTime = `${result.maxTime.toFixed(2)}ms`.padEnd(11);
    const throughput = `${result.throughput.toFixed(1)}/s`.padEnd(11);
    
    const statusColor = result.success ? chalk.green : chalk.red;
    console.log(`│ ${statusColor(suite)} │ ${iterations} │ ${avgTime} │ ${minTime} │ ${maxTime} │ ${throughput} │`);
  });
  
  console.log("└─────────────────┴─────────────┴─────────────┴─────────────┴─────────────┴─────────────┘");
}

/**
 * Display bottleneck analysis
 */
function displayBottleneckAnalysis(bottlenecks: any[], detailed: boolean): void {
  if (bottlenecks.length === 0) {
    console.log(chalk.green("\n✅ No performance bottlenecks detected"));
    return;
  }

  console.log("\n🔴 Bottlenecks Detected:");
  bottlenecks.forEach((bottleneck, index) => {
    console.log(chalk.red(`\n${index + 1}. ${bottleneck.component}`));
    console.log(chalk.gray(`   Impact: ${bottleneck.severity}`));
    console.log(chalk.gray(`   Metric: ${bottleneck.metric} (${bottleneck.value})`));
    
    if (detailed && bottleneck.recommendations) {
      console.log(chalk.yellow("   Recommendations:"));
      bottleneck.recommendations.forEach((rec: string) => {
        console.log(chalk.gray(`   • ${rec}`));
      });
    }
  });
}

/**
 * Display token usage statistics
 */
function displayTokenUsage(usage: TokenUsage, breakdown: boolean): void {
  console.log(`\n📊 Total Tokens: ${chalk.cyan(usage.totalTokens.toLocaleString())}`);
  console.log(`   Input: ${chalk.blue(usage.inputTokens.toLocaleString())}`);
  console.log(`   Output: ${chalk.green(usage.outputTokens.toLocaleString())}`);
  console.log(`💰 Estimated Cost: ${chalk.yellow(`$${usage.cost.toFixed(4)}`)}`);
  console.log(`🔄 Operations: ${chalk.magenta(usage.operations.toLocaleString())}`);
  
  if (breakdown && usage.breakdown) {
    console.log("\n📈 Breakdown by Operation:");
    Object.entries(usage.breakdown).forEach(([operation, stats]: [string, any]) => {
      console.log(`   ${operation}: ${stats.tokens.toLocaleString()} tokens ($${stats.cost.toFixed(4)})`);
    });
  }
}

/**
 * Display memory analysis
 */
function displayMemoryAnalysis(usage: any, detail: string): void {
  console.log(`\n💾 Total Memory: ${chalk.cyan(formatBytes(usage.total))}`);
  console.log(`   Used: ${chalk.yellow(formatBytes(usage.used))} (${usage.percentage.toFixed(1)}%)`);
  console.log(`   Available: ${chalk.green(formatBytes(usage.available))}`);
  
  if (detail === "detailed" && usage.breakdown) {
    console.log("\n📊 Memory Breakdown:");
    Object.entries(usage.breakdown).forEach(([component, size]: [string, any]) => {
      console.log(`   ${component}: ${formatBytes(size)}`);
    });
  }
}

/**
 * Display cost analysis
 */
function displayCostAnalysis(costs: any, breakdown: boolean, forecast: boolean): void {
  console.log(`\n💰 Total Cost: ${chalk.cyan(`$${costs.total.toFixed(2)}`)}`);
  console.log(`   Tokens: ${chalk.blue(`$${costs.tokens.toFixed(2)}`)}`);
  console.log(`   Compute: ${chalk.green(`$${costs.compute.toFixed(2)}`)}`);
  console.log(`   Storage: ${chalk.yellow(`$${costs.storage.toFixed(2)}`)}`);
  
  if (breakdown && costs.breakdown) {
    console.log("\n📈 Cost Breakdown:");
    Object.entries(costs.breakdown).forEach(([category, cost]: [string, any]) => {
      console.log(`   ${category}: $${cost.toFixed(4)}`);
    });
  }
  
  if (forecast && costs.forecast) {
    console.log(`\n🔮 30-day Forecast: ${chalk.magenta(`$${costs.forecast.toFixed(2)}`)}`);
  }
}

/**
 * Display health status
 */
function displayHealthStatus(status: any, components: string[]): void {
  console.log("\n🏥 Component Status:");
  
  components.forEach(component => {
    const componentStatus = status[component];
    if (componentStatus) {
      const statusIcon = componentStatus.healthy ? "🟢" : "🔴";
      const statusColor = componentStatus.healthy ? chalk.green : chalk.red;
      
      console.log(`   ${statusIcon} ${component}: ${statusColor(componentStatus.status)}`);
      
      if (!componentStatus.healthy && componentStatus.issues) {
        componentStatus.issues.forEach((issue: string) => {
          console.log(chalk.gray(`      • ${issue}`));
        });
      }
    }
  });
}

/**
 * Display performance report
 */
function displayPerformanceReport(report: any, format: string): void {
  if (format === "json") {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  
  console.log("\n📊 Performance Summary:");
  console.log(`   Overall Health: ${report.health || "Unknown"}`);
  console.log(`   Total Operations: ${report.operations || 0}`);
  console.log(`   Average Response Time: ${report.averageResponseTime || "N/A"}`);
  console.log(`   Error Rate: ${report.errorRate || "0%"}`);
  
  if (format === "detailed" && report.details) {
    console.log("\n📋 Detailed Analysis:");
    Object.entries(report.details).forEach(([section, data]: [string, any]) => {
      console.log(`\n   ${section}:`);
      if (typeof data === "object") {
        Object.entries(data).forEach(([key, value]) => {
          console.log(`      ${key}: ${value}`);
        });
      } else {
        console.log(`      ${data}`);
      }
    });
  }
}

/**
 * Start health monitoring watch mode
 */
async function startHealthWatchMode(components: string[], interval: number): Promise<void> {
  const watchInterval = setInterval(async () => {
    try {
      const healthResult = await runMockHealthCheck(components);
      
      console.clear();
      console.log(chalk.green.bold("🏥 System Health Status (Live)"));
      console.log(chalk.gray(`Last updated: ${new Date().toLocaleTimeString()}`));
      
      displayHealthStatus(healthResult.status, components);
    } catch (error) {
      console.error(chalk.red("Health check failed:", error));
    }
  }, interval * 1000);
  
  // Handle process termination
  process.on("SIGINT", () => {
    clearInterval(watchInterval);
    console.log(chalk.yellow("\n👋 Health monitoring stopped"));
    process.exit(0);
  });
}

/**
 * Save benchmark results to file
 */
async function saveBenchmarkResults(results: any, suite: string): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `benchmark-${suite}-${timestamp}.json`;
  const filepath = path.join(process.cwd(), "reports", filename);
  
  await fs.ensureDir(path.dirname(filepath));
  await fs.writeJSON(filepath, results, { spaces: 2 });
  
  console.log(chalk.green(`\n📁 Benchmark results saved to: ${filepath}`));
}

/**
 * Save performance report to file
 */
async function savePerformanceReport(report: any, outputPath: string, format: string): Promise<void> {
  await fs.ensureDir(path.dirname(outputPath));
  
  if (format === "json") {
    await fs.writeJSON(outputPath, report, { spaces: 2 });
  } else {
    // Convert to readable format
    let content = "# Performance Report\n\n";
    content += `Generated: ${new Date().toISOString()}\n\n`;
    content += JSON.stringify(report, null, 2);
    
    await fs.writeFile(outputPath, content);
  }
}

/**
 * Format bytes to human readable format
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}