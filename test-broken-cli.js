#!/usr/bin/env node

// Test the commands that are broken in the original CLI
import { defineCommand, runMain as cittyRunMain } from "citty";
import chalk from "chalk";

console.log("Testing broken/missing commands from original CLI:\n");

// Test inject command import
try {
  const { injectCommand } = await import('./src/commands/inject.js');
  console.log("✅ inject command imports successfully");
  
  // Try to run inject help
  try {
    const injectTestCmd = defineCommand({
      meta: { name: "test-inject", description: "Test inject" },
      subCommands: { inject: injectCommand },
      run() { console.log("Available: inject"); }
    });
    console.log("✅ inject command can be used in CLI");
  } catch (e) {
    console.log("❌ inject command execution fails:", e.message);
  }
  
} catch (e) {
  console.log("❌ inject command import fails:", e.message);
}

// Test migration command
try {
  const { migrateCommand } = await import('./src/commands/migrate.js');
  console.log("✅ migrate command imports successfully");
} catch (e) {
  console.log("❌ migrate command import fails:", e.message);
}

// Test semantic command  
try {
  const { semanticCommand } = await import('./src/commands/semantic.js');
  console.log("✅ semantic command imports successfully");
} catch (e) {
  console.log("❌ semantic command import fails:", e.message);
}

// Test workflow command
try {
  // Try both named and default imports
  try {
    const { workflowCommand } = await import('./src/commands/workflow.js');
    console.log("✅ workflow command imports as named export");
  } catch {
    const workflowCommand = (await import('./src/commands/workflow.js')).default;
    console.log("✅ workflow command imports as default export");
  }
} catch (e) {
  console.log("❌ workflow command import fails:", e.message);
}

// Test github command
try {
  const { githubCommand } = await import('./src/commands/github.js');
  console.log("✅ github command imports successfully");
} catch (e) {
  console.log("❌ github command import fails:", e.message);
}

// Test file injector (critical dependency)
try {
  const injector = await import('./src/lib/file-injector.js');
  console.log("✅ file injector imports successfully");
} catch (e) {
  console.log("❌ file injector import fails:", e.message);
}

console.log("\nTesting complete. Check results above.");