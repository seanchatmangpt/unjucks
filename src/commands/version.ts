import { defineCommand } from "citty";

// Dynamic version resolution for cross-platform compatibility
function getVersion(): string {
  // First try environment variable (set during build/npm)
  if (process.env.npm_package_version) {
    return process.env.npm_package_version;
  }
  
  try {
    // Use require for compatibility with bundled code
    const fs = require("fs");
    const path = require("path");
    
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
    
    return "0.0.0";
  } catch (error) {
    return "0.0.0";
  }
}

export const versionCommand = defineCommand({
  meta: {
    name: "version",
    description: "Show version information",
  },
  run(context: any) {
    const { args } = context;
    const version = getVersion();
    console.log(version);
  },
});
