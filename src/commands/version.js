import { defineCommand } from "citty";
import { getVersion, getVersionDetails } from "../lib/version-resolver.js";

/**
 * Version command - Shows version information
 */
export const versionCommand = defineCommand({
  meta: {
    name: "version",
    description: "Show version information",
  },
  args: {
    verbose: {
      type: "boolean",
      description: "Show detailed version information",
      alias: "v",
    },
  },
  /**
   * Main execution handler for the version command
   * @param {Object} context - Command context
   * @param {Object} context.args - Parsed command arguments
   */
  run(context) {
    const { args } = context;
    
    if (args.verbose) {
      const details = getVersionDetails();
      console.log(`Unjucks Version: ${details.version}`);
      console.log(`Source: ${details.source}`);
      console.log(`Node.js: ${details.nodeVersion}`);
      console.log(`Platform: ${details.platform} (${details.arch})`);
      console.log(`Generated: ${details.timestamp}`);
    } else {
      const version = getVersion();
      console.log(version);
    }
  },
});