import { promises as fs } from "fs";
import path from "path";

export interface TemplateInfo {
  name: string;
  path: string;
  relativePath: string;
  content: string;
}

export interface GeneratorInfo {
  name: string;
  path: string;
  templates: TemplateInfo[];
}

export interface ScanResult {
  generators: GeneratorInfo[];
  templates: TemplateInfo[];
  totalFiles: number;
  totalGenerators: number;
}

export interface DirectoryMigratorOptions {
  force?: boolean;
  backup?: boolean;
  preserveStructure?: boolean;
}

/**
 * Handles directory structure migration from Hygen to Unjucks
 * Manages the transformation from _templates to templates directory structure
 */
export class DirectoryMigrator {
  /**
   * Scan source directory and analyze template structure
   */
  async scanTemplates(sourcePath: string): Promise<ScanResult> {
    const generators: GeneratorInfo[] = [];
    const templates: TemplateInfo[] = [];

    try {
      const entries = await fs.readdir(sourcePath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith(".")) {
          const generatorPath = path.join(sourcePath, entry.name);
          const generatorTemplates = await this.scanGeneratorTemplates(generatorPath, sourcePath);
          
          generators.push({
            name: entry.name,
            path: generatorPath,
            templates: generatorTemplates,
          });

          templates.push(...generatorTemplates);
        }
      }

      return {
        generators,
        templates,
        totalFiles: templates.length,
        totalGenerators: generators.length,
      };

    } catch (error: any) {
      throw new Error(`Failed to scan templates directory: ${error.message}`);
    }
  }

  /**
   * Scan templates within a specific generator directory
   */
  private async scanGeneratorTemplates(
    generatorPath: string,
    basePath: string
  ): Promise<TemplateInfo[]> {
    const templates: TemplateInfo[] = [];
    
    try {
      await this.scanTemplatesRecursive(generatorPath, basePath, templates);
    } catch (error: any) {
      throw new Error(`Failed to scan generator templates at ${generatorPath}: ${error.message}`);
    }

    return templates;
  }

  /**
   * Recursively scan for template files
   */
  private async scanTemplatesRecursive(
    currentPath: string,
    basePath: string,
    templates: TemplateInfo[]
  ): Promise<void> {
    const entries = await fs.readdir(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      
      if (entry.isDirectory()) {
        await this.scanTemplatesRecursive(fullPath, basePath, templates);
      } else if (entry.isFile() && !entry.name.startsWith(".")) {
        try {
          const content = await fs.readFile(fullPath, "utf-8");
          
          templates.push({
            name: entry.name,
            path: fullPath,
            relativePath: path.relative(basePath, fullPath),
            content,
          });
        } catch (error: any) {
          // Skip files that can't be read
          console.warn(`Warning: Could not read file ${fullPath}: ${error.message}`);
        }
      }
    }
  }

  /**
   * Create target directory structure
   */
  async createTargetStructure(
    targetPath: string,
    generators: GeneratorInfo[],
    options: DirectoryMigratorOptions = {}
  ): Promise<void> {
    try {
      // Check if target directory exists
      const targetExists = await fs.stat(targetPath).then(() => true).catch(() => false);
      
      if (targetExists && !options.force) {
        throw new Error(`Target directory already exists: ${targetPath}. Use --force to overwrite.`);
      }

      // Create backup if requested and target exists
      if (options.backup && targetExists) {
        await this.createBackup(targetPath);
      }

      // Create target directory
      await fs.mkdir(targetPath, { recursive: true });

      // Create generator subdirectories
      for (const generator of generators) {
        await this.createGeneratorStructure(targetPath, generator, options);
      }

    } catch (error: any) {
      throw new Error(`Failed to create target structure: ${error.message}`);
    }
  }

  /**
   * Create directory structure for a specific generator
   */
  private async createGeneratorStructure(
    targetPath: string,
    generator: GeneratorInfo,
    options: DirectoryMigratorOptions
  ): Promise<void> {
    const generatorTargetPath = path.join(targetPath, generator.name);
    
    // Create generator directory
    await fs.mkdir(generatorTargetPath, { recursive: true });

    // Create subdirectories based on template structure
    const uniqueDirs = new Set<string>();
    
    for (const template of generator.templates) {
      const sourceDir = path.dirname(template.path);
      const relativeDir = path.relative(generator.path, sourceDir);
      
      if (relativeDir && relativeDir !== ".") {
        uniqueDirs.add(path.join(generatorTargetPath, relativeDir));
      }
    }

    // Create all unique subdirectories
    for (const dir of uniqueDirs) {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  /**
   * Create backup of existing directory
   */
  private async createBackup(targetPath: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupPath = `${targetPath}.backup.${timestamp}`;
    
    try {
      await this.copyDirectory(targetPath, backupPath);
      return backupPath;
    } catch (error: any) {
      throw new Error(`Failed to create backup: ${error.message}`);
    }
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
   * Migrate file organization from Hygen to Unjucks conventions
   * Handles common Hygen patterns and converts them to Unjucks structure
   */
  async migrateFileOrganization(
    sourcePath: string,
    targetPath: string,
    options: DirectoryMigratorOptions = {}
  ): Promise<void> {
    const scanResult = await this.scanTemplates(sourcePath);
    
    for (const generator of scanResult.generators) {
      const generatorTargetPath = path.join(targetPath, generator.name);
      
      for (const template of generator.templates) {
        const sourceFilePath = template.path;
        const relativeFilePath = path.relative(generator.path, sourceFilePath);
        const targetFilePath = path.join(generatorTargetPath, relativeFilePath);
        
        // Apply file naming conventions migration
        const migratedFileName = this.migrateFileName(path.basename(targetFilePath));
        const migratedFilePath = path.join(path.dirname(targetFilePath), migratedFileName);
        
        // Ensure target directory exists
        await fs.mkdir(path.dirname(migratedFilePath), { recursive: true });
        
        // Copy file to new location (content conversion handled separately)
        await fs.copyFile(sourceFilePath, migratedFilePath);
      }
    }
  }

  /**
   * Migrate file names from Hygen to Unjucks conventions
   */
  private migrateFileName(fileName: string): string {
    let migrated = fileName;
    
    // Hygen uses .ejs.t extensions, Unjucks uses direct extensions
    migrated = migrated.replace(/\.ejs\.t$/, "");
    
    // Handle common Hygen naming patterns
    if (migrated.endsWith(".t")) {
      migrated = migrated.slice(0, -2); // Remove .t extension
    }
    
    return migrated;
  }

  /**
   * Validate directory structure after migration
   */
  async validateMigratedStructure(targetPath: string): Promise<{
    valid: boolean;
    issues: string[];
    statistics: {
      generators: number;
      templates: number;
      directories: number;
    };
  }> {
    const issues: string[] = [];
    
    try {
      const scanResult = await this.scanTemplates(targetPath);
      
      // Check for empty generators
      for (const generator of scanResult.generators) {
        if (generator.templates.length === 0) {
          issues.push(`Generator '${generator.name}' has no templates`);
        }
      }

      // Check for orphaned files (files not in generator directories)
      const rootFiles = await fs.readdir(targetPath, { withFileTypes: true });
      const rootTemplateFiles = rootFiles.filter(f => f.isFile() && !f.name.startsWith("."));
      
      if (rootTemplateFiles.length > 0) {
        issues.push(`Found ${rootTemplateFiles.length} template files in root directory (should be in generator directories)`);
      }

      // Count directories
      let directoryCount = 0;
      for (const generator of scanResult.generators) {
        directoryCount += await this.countDirectories(generator.path);
      }

      return {
        valid: issues.length === 0,
        issues,
        statistics: {
          generators: scanResult.totalGenerators,
          templates: scanResult.totalFiles,
          directories: directoryCount,
        },
      };

    } catch (error: any) {
      return {
        valid: false,
        issues: [`Validation failed: ${error.message}`],
        statistics: { generators: 0, templates: 0, directories: 0 },
      };
    }
  }

  /**
   * Count directories recursively
   */
  private async countDirectories(dirPath: string): Promise<number> {
    let count = 0;
    
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          count += 1 + await this.countDirectories(path.join(dirPath, entry.name));
        }
      }
    } catch (error) {
      // Ignore errors and return current count
    }
    
    return count;
  }

  /**
   * Clean up migration artifacts and temporary files
   */
  async cleanupMigration(targetPath: string): Promise<void> {
    try {
      // Remove any .bak files created during migration
      await this.removeBackupFiles(targetPath);
      
      // Remove empty directories
      await this.removeEmptyDirectories(targetPath);
      
    } catch (error: any) {
      throw new Error(`Failed to cleanup migration: ${error.message}`);
    }
  }

  /**
   * Remove backup files recursively
   */
  private async removeBackupFiles(dirPath: string): Promise<void> {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      if (entry.isDirectory()) {
        await this.removeBackupFiles(fullPath);
      } else if (entry.name.endsWith(".bak") || entry.name.includes(".backup.")) {
        await fs.unlink(fullPath);
      }
    }
  }

  /**
   * Remove empty directories recursively
   */
  private async removeEmptyDirectories(dirPath: string): Promise<void> {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const fullPath = path.join(dirPath, entry.name);
        await this.removeEmptyDirectories(fullPath);
        
        // Check if directory is now empty
        const remainingEntries = await fs.readdir(fullPath);
        if (remainingEntries.length === 0) {
          await fs.rmdir(fullPath);
        }
      }
    }
  }
}