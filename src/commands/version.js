import { defineCommand } from "citty";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Dynamic version resolution for cross-platform compatibility
 * @returns {string} The version string
 */
function getVersion() {
  // First try environment variable (set during build/npm)
  if (process.env.npm_package_version) {
    return process.env.npm_package_version;
  }
  
  try {
    // Try multiple paths to find package.json
    const possiblePaths = [
      path.resolve(__dirname, "../../package.json"),
      path.resolve(process.cwd(), "package.json"),
      path.resolve(__dirname, "../package.json")
    ];
    
    for (const packagePath of possiblePaths) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf-8"));
        if (packageJson.version) {
          return packageJson.version;
        }
      } catch {
        continue;
      }
    }
    
    return "1.0.0";
  } catch (error) {
    return "1.0.0";
  }
}

/**
 * Version command - Shows version information
 */
export const versionCommand = defineCommand({
  meta: {
    name: "version",
    description: "Show version information",
  },
  /**
   * Main execution handler for the version command
   * @param {Object} context - Command context
   * @param {Object} context.args - Parsed command arguments
   */
  run(context) {
    const { args } = context;
    const version = getVersion();
    console.log(version);
  },
});