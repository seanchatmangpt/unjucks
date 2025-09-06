import { promises as fs } from "fs";
import path from "path";
import { loadConfig } from "confbox";

export interface HygenConfig {
  templates?: string;
  helpers?: string;
  exec?: {
    [key: string]: string;
  };
  inquirer?: {
    [key: string]: any;
  };
}

export interface UnjucksConfig {
  templates?: string;
  helpers?: string;
  filters?: string;
  extensions?: string[];
  prompts?: {
    [key: string]: any;
  };
  hooks?: {
    pre?: string[];
    post?: string[];
  };
  defaults?: {
    [key: string]: any;
  };
}

export interface ConfigMigrationResult {
  success: boolean;
  originalConfig?: HygenConfig;
  migratedConfig?: UnjucksConfig;
  configPath?: string;
  changes: string[];
  warnings: string[];
  errors: string[];
}

export interface ConfigMigrationOptions {
  dry?: boolean;
  force?: boolean;
  backup?: boolean;
  preserveCustom?: boolean;
}

/**
 * Migrates Hygen configuration to Unjucks format
 * Handles .hygenrc, package.json hygen section, and other config files
 */
export class ConfigMigrator {
  /**
   * Migrate configuration from Hygen to Unjucks
   */
  async migrateConfig(
    sourcePath: string,
    targetPath: string,
    options: ConfigMigrationOptions = {}
  ): Promise<ConfigMigrationResult> {
    const result: ConfigMigrationResult = {
      success: false,
      changes: [],
      warnings: [],
      errors: [],
    };

    try {
      // Look for Hygen configuration files
      const hygenConfig = await this.findAndLoadHygenConfig(sourcePath);
      
      if (!hygenConfig.config) {
        result.warnings.push("No Hygen configuration found, creating default Unjucks config");
        return await this.createDefaultConfig(targetPath, options, result);
      }

      result.originalConfig = hygenConfig.config;
      result.configPath = hygenConfig.path;

      // Convert Hygen config to Unjucks format
      const migratedConfig = await this.convertConfig(hygenConfig.config, sourcePath, targetPath);
      result.migratedConfig = migratedConfig;

      // Write the new configuration
      if (!options.dry) {
        await this.writeUnjucksConfig(targetPath, migratedConfig, options);
        result.changes.push("Created unjucks.config.ts");
      }

      // Migrate helper files if they exist
      const helpersMigration = await this.migrateHelpers(
        sourcePath,
        targetPath,
        hygenConfig.config,
        options
      );
      result.changes.push(...helpersMigration.changes);
      result.warnings.push(...helpersMigration.warnings);

      // Migrate package.json scripts
      const scriptsMigration = await this.migratePackageJsonScripts(targetPath, options);
      result.changes.push(...scriptsMigration.changes);
      result.warnings.push(...scriptsMigration.warnings);

      result.success = true;

    } catch (error: any) {
      result.errors.push(`Configuration migration failed: ${error.message}`);
    }

    return result;
  }

  /**
   * Find and load Hygen configuration from various sources
   */
  private async findAndLoadHygenConfig(sourcePath: string): Promise<{
    config?: HygenConfig;
    path?: string;
    source: string;
  }> {
    const configSources = [
      // .hygenrc files
      { path: path.join(sourcePath, ".hygenrc"), source: ".hygenrc" },
      { path: path.join(sourcePath, ".hygenrc.json"), source: ".hygenrc.json" },
      { path: path.join(sourcePath, ".hygenrc.js"), source: ".hygenrc.js" },
      
      // Package.json hygen section
      { path: path.join(sourcePath, "../package.json"), source: "package.json" },
      
      // Current directory configs
      { path: path.join(process.cwd(), ".hygenrc"), source: ".hygenrc" },
      { path: path.join(process.cwd(), "package.json"), source: "package.json" },
    ];

    for (const source of configSources) {
      try {
        const exists = await fs.stat(source.path).then(() => true).catch(() => false);
        if (!exists) continue;

        if (source.source === "package.json") {
          const packageJson = JSON.parse(await fs.readFile(source.path, "utf-8"));
          if (packageJson.hygen) {
            return {
              config: packageJson.hygen,
              path: source.path,
              source: source.source,
            };
          }
        } else {
          const config = await loadConfig({
            name: path.basename(source.path, path.extname(source.path)),
            cwd: path.dirname(source.path),
          }) as HygenConfig;

          if (config && Object.keys(config).length > 0) {
            return {
              config,
              path: source.path,
              source: source.source,
            };
          }
        }
      } catch (error) {
        // Continue to next source if this one fails
        continue;
      }
    }

    return { source: "none" };
  }

  /**
   * Convert Hygen configuration to Unjucks format
   */
  private async convertConfig(
    hygenConfig: HygenConfig,
    sourcePath: string,
    targetPath: string
  ): Promise<UnjucksConfig> {
    const unjucksConfig: UnjucksConfig = {};

    // Convert templates path
    if (hygenConfig.templates) {
      unjucksConfig.templates = this.convertPath(hygenConfig.templates, sourcePath, targetPath);
    } else {
      unjucksConfig.templates = "templates";
    }

    // Convert helpers
    if (hygenConfig.helpers) {
      unjucksConfig.helpers = this.convertPath(hygenConfig.helpers, sourcePath, targetPath);
    }

    // Convert exec commands to hooks
    if (hygenConfig.exec) {
      unjucksConfig.hooks = {
        pre: [],
        post: [],
      };

      Object.entries(hygenConfig.exec).forEach(([key, command]) => {
        if (key.startsWith("pre")) {
          unjucksConfig.hooks!.pre!.push(command);
        } else if (key.startsWith("post")) {
          unjucksConfig.hooks!.post!.push(command);
        }
      });
    }

    // Convert inquirer to prompts
    if (hygenConfig.inquirer) {
      unjucksConfig.prompts = hygenConfig.inquirer;
    }

    // Add Unjucks-specific defaults
    unjucksConfig.extensions = [".njk", ".nunjucks", ".html", ".md", ".txt"];
    unjucksConfig.filters = "helpers/filters";

    return unjucksConfig;
  }

  /**
   * Convert file paths from Hygen to Unjucks conventions
   */
  private convertPath(hygenPath: string, sourcePath: string, targetPath: string): string {
    // Convert _templates to templates
    if (hygenPath === "_templates" || hygenPath.endsWith("/_templates")) {
      return hygenPath.replace("_templates", "templates");
    }

    // Handle relative paths
    if (!path.isAbsolute(hygenPath)) {
      return hygenPath;
    }

    // Convert absolute paths relative to new structure
    const relativePath = path.relative(sourcePath, hygenPath);
    return relativePath.startsWith("..") ? hygenPath : relativePath;
  }

  /**
   * Create default Unjucks configuration
   */
  private async createDefaultConfig(
    targetPath: string,
    options: ConfigMigrationOptions,
    result: ConfigMigrationResult
  ): Promise<ConfigMigrationResult> {
    const defaultConfig: UnjucksConfig = {
      templates: "templates",
      helpers: "helpers",
      filters: "helpers/filters",
      extensions: [".njk", ".nunjucks", ".html", ".md", ".txt", ".js", ".ts"],
      defaults: {},
    };

    result.migratedConfig = defaultConfig;

    if (!options.dry) {
      await this.writeUnjucksConfig(targetPath, defaultConfig, options);
      result.changes.push("Created default unjucks.config.ts");
    }

    result.success = true;
    return result;
  }

  /**
   * Write Unjucks configuration file
   */
  private async writeUnjucksConfig(
    targetPath: string,
    config: UnjucksConfig,
    options: ConfigMigrationOptions
  ): Promise<void> {
    const configPath = path.join(path.dirname(targetPath), "unjucks.config.ts");
    
    // Check if config already exists
    const exists = await fs.stat(configPath).then(() => true).catch(() => false);
    if (exists && !options.force) {
      throw new Error(`Configuration file already exists: ${configPath}. Use --force to overwrite.`);
    }

    // Create backup if requested
    if (options.backup && exists) {
      const backupPath = `${configPath}.backup.${Date.now()}`;
      await fs.copyFile(configPath, backupPath);
    }

    // Generate TypeScript config file content
    const configContent = this.generateConfigContent(config);
    
    // Ensure directory exists
    await fs.mkdir(path.dirname(configPath), { recursive: true });
    
    // Write config file
    await fs.writeFile(configPath, configContent, "utf-8");
  }

  /**
   * Generate TypeScript configuration file content
   */
  private generateConfigContent(config: UnjucksConfig): string {
    const configJson = JSON.stringify(config, null, 2);
    
    return `import { defineConfig } from "unjucks";

// Migrated from Hygen configuration
export default defineConfig(${configJson});
`;
  }

  /**
   * Migrate helper files from Hygen to Unjucks
   */
  private async migrateHelpers(
    sourcePath: string,
    targetPath: string,
    hygenConfig: HygenConfig,
    options: ConfigMigrationOptions
  ): Promise<{ changes: string[]; warnings: string[] }> {
    const changes: string[] = [];
    const warnings: string[] = [];

    try {
      const helpersPath = hygenConfig.helpers || path.join(sourcePath, "helpers");
      const helpersExist = await fs.stat(helpersPath).then(() => true).catch(() => false);

      if (helpersExist) {
        const targetHelpersPath = path.join(path.dirname(targetPath), "helpers");
        
        if (!options.dry) {
          // Copy helpers directory
          await this.copyDirectory(helpersPath, targetHelpersPath);
          
          // Convert helper files if needed
          await this.convertHelperFiles(targetHelpersPath);
          
          changes.push(`Migrated helpers from ${helpersPath} to ${targetHelpersPath}`);
        } else {
          changes.push(`Would migrate helpers from ${helpersPath} to helpers/`);
        }
      } else {
        warnings.push("No Hygen helpers directory found");
      }

    } catch (error: any) {
      warnings.push(`Failed to migrate helpers: ${error.message}`);
    }

    return { changes, warnings };
  }

  /**
   * Migrate package.json scripts from Hygen to Unjucks
   */
  private async migratePackageJsonScripts(
    targetPath: string,
    options: ConfigMigrationOptions
  ): Promise<{ changes: string[]; warnings: string[] }> {
    const changes: string[] = [];
    const warnings: string[] = [];

    try {
      const packageJsonPath = path.join(path.dirname(targetPath), "package.json");
      const exists = await fs.stat(packageJsonPath).then(() => true).catch(() => false);

      if (!exists) {
        warnings.push("No package.json found for script migration");
        return { changes, warnings };
      }

      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, "utf-8"));
      
      if (!packageJson.scripts) {
        packageJson.scripts = {};
      }

      // Convert Hygen scripts to Unjucks
      const scriptMigrations = [
        { from: "hygen", to: "unjucks generate" },
        { from: "gen", to: "unjucks generate" },
        { from: "generate", to: "unjucks generate" },
      ];

      let hasChanges = false;

      for (const [scriptName, scriptCommand] of Object.entries(packageJson.scripts || {})) {
        if (typeof scriptCommand === "string") {
          for (const migration of scriptMigrations) {
            if (scriptCommand.includes(migration.from)) {
              const newCommand = scriptCommand.replace(migration.from, migration.to);
              if (!options.dry) {
                packageJson.scripts[scriptName] = newCommand;
              }
              changes.push(`Updated script '${scriptName}': ${scriptCommand} -> ${newCommand}`);
              hasChanges = true;
            }
          }
        }
      }

      // Add default Unjucks scripts if they don't exist
      const defaultScripts = {
        "gen": "unjucks generate",
        "gen:list": "unjucks list",
        "gen:help": "unjucks help",
      };

      for (const [scriptName, scriptCommand] of Object.entries(defaultScripts)) {
        if (!packageJson.scripts[scriptName]) {
          if (!options.dry) {
            packageJson.scripts[scriptName] = scriptCommand;
          }
          changes.push(`Added script '${scriptName}': ${scriptCommand}`);
          hasChanges = true;
        }
      }

      // Write updated package.json
      if (hasChanges && !options.dry) {
        if (options.backup) {
          const backupPath = `${packageJsonPath}.backup.${Date.now()}`;
          await fs.copyFile(packageJsonPath, backupPath);
        }

        await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2), "utf-8");
        changes.push("Updated package.json with Unjucks scripts");
      }

    } catch (error: any) {
      warnings.push(`Failed to migrate package.json scripts: ${error.message}`);
    }

    return { changes, warnings };
  }

  /**
   * Copy directory recursively
   */
  private async copyDirectory(source: string, destination: string): Promise<void> {
    await fs.mkdir(destination, { recursive: true });
    
    const entries = await fs.readdir(source, { withFileTypes: true });
    
    for (const entry of entries) {
      const sourcePath = path.join(source, entry.name);
      const destPath = path.join(destination, entry.name);
      
      if (entry.isDirectory()) {
        await this.copyDirectory(sourcePath, destPath);
      } else {
        await fs.copyFile(sourcePath, destPath);
      }
    }
  }

  /**
   * Convert helper files to Unjucks format
   */
  private async convertHelperFiles(helpersPath: string): Promise<void> {
    const entries = await fs.readdir(helpersPath, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.isFile() && (entry.name.endsWith(".js") || entry.name.endsWith(".ts"))) {
        const filePath = path.join(helpersPath, entry.name);
        const content = await fs.readFile(filePath, "utf-8");
        
        // Convert common Hygen helper patterns to Unjucks
        let converted = content;
        
        // Convert module.exports to export default for ES modules
        if (converted.includes("module.exports")) {
          converted = converted.replace(/module\.exports\s*=\s*/g, "export default ");
        }

        // Add Unjucks helper template if significantly different
        if (converted !== content) {
          await fs.writeFile(filePath, converted, "utf-8");
        }
      }
    }
  }

  /**
   * Validate migrated configuration
   */
  async validateConfig(configPath: string): Promise<{
    valid: boolean;
    issues: string[];
    config?: UnjucksConfig;
  }> {
    const issues: string[] = [];

    try {
      const config = await loadConfig({
        name: "unjucks.config",
        cwd: path.dirname(configPath),
      }) as UnjucksConfig;

      // Validate required fields
      if (!config.templates) {
        issues.push("Missing 'templates' configuration");
      }

      // Validate templates path exists
      if (config.templates) {
        const templatesPath = path.resolve(path.dirname(configPath), config.templates);
        const exists = await fs.stat(templatesPath).then(() => true).catch(() => false);
        if (!exists) {
          issues.push(`Templates directory does not exist: ${templatesPath}`);
        }
      }

      // Validate helpers path if specified
      if (config.helpers) {
        const helpersPath = path.resolve(path.dirname(configPath), config.helpers);
        const exists = await fs.stat(helpersPath).then(() => true).catch(() => false);
        if (!exists) {
          issues.push(`Helpers directory does not exist: ${helpersPath}`);
        }
      }

      return {
        valid: issues.length === 0,
        issues,
        config,
      };

    } catch (error: any) {
      return {
        valid: false,
        issues: [`Failed to load configuration: ${error.message}`],
      };
    }
  }
}