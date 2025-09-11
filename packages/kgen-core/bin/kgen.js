#!/usr/bin/env node

/**
 * KGEN CLI - Deterministic Artifact Generator
 */

import { runMain, defineCommand } from "citty";
import { artifactCommand } from '../src/commands/artifact.js';

const main = defineCommand({
  meta: {
    name: "kgen",
    version: "1.0.0",
    description: "Deterministic artifact generation with content addressing and attestations"
  },
  subCommands: {
    artifact: artifactCommand
  },
  args: {
    version: {
      type: "boolean",
      description: "Show version information",
      alias: "v"
    },
    help: {
      type: "boolean", 
      description: "Show help information",
      alias: "h"
    }
  },
  async run({ args }) {
    if (args.version) {
      console.log("kgen v1.0.0");
      console.log("Deterministic artifact generation with content addressing");
      return;
    }

    if (args.help) {
      console.log("kgen - Deterministic Artifact Generator");
      console.log("");
      console.log("Usage:");
      console.log("  kgen artifact generate --template <path> --context <json>");
      console.log("  kgen artifact lockfile --config <path>");
      console.log("  kgen artifact verify --artifact <path>");
      console.log("");
      console.log("Examples:");
      console.log("  kgen artifact generate --template component.njk --context '{\"name\":\"Button\"}'");
      console.log("  kgen artifact lockfile --config templates.json");
      console.log("  kgen artifact verify --artifact generated/Button.js");
      return;
    }

    console.log("Use 'kgen --help' for usage information");
    console.log("Use 'kgen artifact --help' for artifact generation commands");
  }
});

runMain(main);