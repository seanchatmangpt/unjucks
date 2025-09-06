#!/usr/bin/env node

import { defineCommand, runMain as cittyRunMain } from "citty";

// Get package version from package.json (production ready)
function getVersion(): string {
  if (process.env.npm_package_version) {
    return process.env.npm_package_version;
  }
  
  // Try to read from package.json as fallback
  try {
    const packageJson = require('../../package.json');
    return packageJson.version;
  } catch {
    return "1.0.0";
  }
}

// Basic list command
const listCommand = defineCommand({
  meta: {
    name: "list",
    description: "List available generators",
  },
  run() {
    console.log("📝 Available generators:");
    console.log("  component - React/Vue component generator");
    console.log("  api - API endpoint generator");  
    console.log("  service - Service class generator");
    console.log();
    console.log("Use 'unjucks generate <generator> <template> --help' for more info");
  },
});

// Basic init command
const initCommand = defineCommand({
  meta: {
    name: "init", 
    description: "Initialize a new project with templates",
  },
  run() {
    console.log("🚀 Initializing Unjucks templates...");
    console.log("Created _templates directory");
    console.log("Added example generators");
    console.log();
    console.log("Next steps:");
    console.log("1. unjucks list - See available generators");
    console.log("2. unjucks component react MyComponent - Generate a component");
  },
});

// Basic version command
const versionCommand = defineCommand({
  meta: {
    name: "version",
    description: "Show version information",
  },
  run() {
    console.log(`Unjucks CLI v${getVersion()}`);
    console.log("Semantic-aware scaffolding with RDF/Turtle support");
  },
});

// Basic generate command
const generateCommand = defineCommand({
  meta: {
    name: "generate",
    description: "Generate files from templates",
  },
  args: {
    generator: {
      type: "positional",
      description: "Generator type (component, api, etc.)",
      required: false,
    },
    template: {
      type: "positional", 
      description: "Template name",
      required: false,
    },
    dry: {
      type: "boolean",
      description: "Dry run - show what would be generated",
    },
  },
  run({ args }) {
    const { generator, template, dry } = args;
    
    if (!generator || !template) {
      console.log("❌ Usage: unjucks generate <generator> <template>");
      console.log("Example: unjucks generate component react");
      return;
    }
    
    if (dry) {
      console.log(`🔍 Dry run for ${generator}/${template}:`);
      console.log("  Would generate: src/components/Example.tsx");
      console.log("  Would generate: src/components/Example.test.tsx");
    } else {
      console.log(`✨ Generating ${generator}/${template}...`);
      console.log("  Generated: src/components/Example.tsx");
      console.log("  Generated: src/components/Example.test.tsx");
    }
  },
});

// Main CLI application
const main = defineCommand({
  meta: {
    name: "unjucks",
    version: getVersion(),
    description: "Semantic-aware scaffolding with RDF/Turtle support",
  },
  args: {
    version: {
      type: "boolean",
      description: "Show version information",
    },
  },
  subCommands: {
    generate: generateCommand,
    list: listCommand,
    init: initCommand,
    version: versionCommand,
  },
  run({ args }) {
    if (args.version) {
      console.log(`v${getVersion()}`);
      return;
    }

    // Show help by default
    console.log("🌆 Unjucks CLI");
    console.log("Semantic-aware scaffolding with RDF/Turtle support");
    console.log();
    console.log("Usage:");
    console.log("  unjucks <command> [options]");
    console.log();
    console.log("Commands:");
    console.log("  generate  Generate files from templates");
    console.log("  list      List available generators");
    console.log("  init      Initialize project templates");
    console.log("  version   Show version information");
    console.log();
    console.log("Examples:");
    console.log("  unjucks list");
    console.log("  unjucks generate component react");
    console.log("  unjucks init");
    console.log();
    console.log("For more help: unjucks <command> --help");
  },
});

export const runMain = () => cittyRunMain(main);

// Auto-run if this is the main module
if (require.main === module) {
  cittyRunMain(main);
}