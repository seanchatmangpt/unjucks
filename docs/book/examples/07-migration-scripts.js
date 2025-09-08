// Migration Scripts and Examples for Unjucks v2
// Comprehensive migration utilities for upgrading from v1 to v2 and handling project migrations

/**
 * =============================================================================
 * CORE MIGRATION SYSTEM
 * =============================================================================
 */

class UnjucksMigrationManager {
  constructor(options = {}) {
    this.options = {
      sourceVersion: '1.x',
      targetVersion: '2.0',
      backupEnabled: true,
      dryRun: false,
      verbose: false,
      autoFix: true,
      ...options
    };
    
    this.migrations = new Map();
    this.migrationHistory = [];
    this.errors = [];
    this.warnings = [];
    this.backupPath = null;
  }

  // Register migration step
  registerMigration(id, migration) {
    if (!migration.name || !migration.migrate || !migration.version) {
      throw new Error(`Invalid migration: ${id}. Must have name, migrate function, and version`);
    }

    this.migrations.set(id, {
      id,
      ...migration,
      timestamp: Date.now()
    });
  }

  // Run all applicable migrations
  async runMigrations(projectPath) {
    console.log(`Starting migration from ${this.options.sourceVersion} to ${this.options.targetVersion}`);
    
    try {
      // Create backup if enabled
      if (this.options.backupEnabled && !this.options.dryRun) {
        await this.createBackup(projectPath);
      }

      // Analyze project structure
      const projectInfo = await this.analyzeProject(projectPath);
      console.log(`Analyzed project: ${projectInfo.templateCount} templates, ${projectInfo.configFiles.length} config files`);

      // Get applicable migrations
      const applicableMigrations = this.getApplicableMigrations(projectInfo);
      console.log(`Found ${applicableMigrations.length} applicable migrations`);

      // Execute migrations in order
      for (const migration of applicableMigrations) {
        await this.executeMigration(migration, projectPath, projectInfo);
      }

      // Generate migration report
      const report = this.generateMigrationReport();
      
      if (this.options.dryRun) {
        console.log('\n📋 DRY RUN COMPLETED - No changes were made');
      } else {
        console.log('\n✅ MIGRATION COMPLETED SUCCESSFULLY');
      }

      return report;

    } catch (error) {
      console.error('Migration failed:', error.message);
      if (this.backupPath && !this.options.dryRun) {
        console.log(`Backup available at: ${this.backupPath}`);
      }
      throw error;
    }
  }

  // Create project backup
  async createBackup(projectPath) {
    const fs = require('fs').promises;
    const path = require('path');
    const archiver = require('archiver'); // Would need to be installed

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.backupPath = path.join(projectPath, `../${path.basename(projectPath)}-backup-${timestamp}`);

    console.log(`Creating backup at: ${this.backupPath}`);
    
    // Simple backup by copying directory
    await this.copyDirectory(projectPath, this.backupPath);
    
    console.log('Backup created successfully');
  }

  // Copy directory recursively
  async copyDirectory(src, dest) {
    const fs = require('fs').promises;
    const path = require('path');

    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.name === 'node_modules' || entry.name === '.git') {
        continue; // Skip large directories
      }

      if (entry.isDirectory()) {
        await this.copyDirectory(srcPath, destPath);
      } else {
        await fs.copyFile(srcPath, destPath);
      }
    }
  }

  // Analyze project structure
  async analyzeProject(projectPath) {
    const fs = require('fs').promises;
    const path = require('path');

    const info = {
      projectPath,
      version: null,
      templateCount: 0,
      templates: [],
      configFiles: [],
      packageJson: null,
      hasUnjucksConfig: false,
      hasLegacyStructure: false
    };

    try {
      // Check package.json
      const packageJsonPath = path.join(projectPath, 'package.json');
      try {
        const packageContent = await fs.readFile(packageJsonPath, 'utf8');
        info.packageJson = JSON.parse(packageContent);
        
        // Detect Unjucks version from dependencies
        if (info.packageJson.dependencies?.['@seanchatmangpt/unjucks']) {
          info.version = info.packageJson.dependencies['@seanchatmangpt/unjucks'];
        } else if (info.packageJson.devDependencies?.['@seanchatmangpt/unjucks']) {
          info.version = info.packageJson.devDependencies['@seanchatmangpt/unjucks'];
        }
      } catch (error) {
        console.warn('No package.json found or unable to read');
      }

      // Check for config files
      const configFiles = ['unjucks.config.js', 'unjucks.config.ts', '.unjucksrc', '.unjucksrc.json'];
      for (const configFile of configFiles) {
        const configPath = path.join(projectPath, configFile);
        try {
          await fs.access(configPath);
          info.configFiles.push(configFile);
          if (configFile.startsWith('unjucks.config')) {
            info.hasUnjucksConfig = true;
          }
        } catch {
          // Config file doesn't exist
        }
      }

      // Scan for templates
      const templateDirs = ['_templates', 'templates', '.unjucks'];
      for (const templateDir of templateDirs) {
        const templatePath = path.join(projectPath, templateDir);
        try {
          const templates = await this.scanTemplates(templatePath);
          info.templates.push(...templates);
          info.templateCount += templates.length;
          
          if (templateDir === '.unjucks') {
            info.hasLegacyStructure = true;
          }
        } catch {
          // Template directory doesn't exist
        }
      }

    } catch (error) {
      console.error('Project analysis failed:', error.message);
    }

    return info;
  }

  // Scan templates in directory
  async scanTemplates(templateDir) {
    const fs = require('fs').promises;
    const path = require('path');

    const templates = [];
    
    try {
      const entries = await fs.readdir(templateDir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const subTemplates = await this.scanTemplates(path.join(templateDir, entry.name));
          templates.push(...subTemplates);
        } else if (entry.name.endsWith('.ejs') || entry.name.endsWith('.njk')) {
          templates.push({
            path: path.join(templateDir, entry.name),
            name: entry.name,
            type: entry.name.endsWith('.ejs') ? 'ejs' : 'nunjucks',
            relativePath: path.relative(templateDir, path.join(templateDir, entry.name))
          });
        }
      }
    } catch (error) {
      // Directory doesn't exist or can't be read
    }

    return templates;
  }

  // Get applicable migrations based on project info
  getApplicableMigrations(projectInfo) {
    const applicable = [];
    
    for (const [id, migration] of this.migrations) {
      if (migration.condition) {
        if (migration.condition(projectInfo)) {
          applicable.push(migration);
        }
      } else {
        applicable.push(migration);
      }
    }

    // Sort by priority (lower number = higher priority)
    return applicable.sort((a, b) => (a.priority || 100) - (b.priority || 100));
  }

  // Execute single migration
  async executeMigration(migration, projectPath, projectInfo) {
    console.log(`Running migration: ${migration.name}`);
    
    const startTime = Date.now();
    const migrationResult = {
      id: migration.id,
      name: migration.name,
      startTime,
      endTime: null,
      success: false,
      changes: [],
      errors: [],
      warnings: []
    };

    try {
      if (this.options.dryRun) {
        console.log(`[DRY RUN] Would run: ${migration.name}`);
        // Run migration in dry-run mode if supported
        if (migration.dryRun) {
          const result = await migration.dryRun(projectPath, projectInfo, this.options);
          migrationResult.changes = result.changes || [];
          migrationResult.warnings = result.warnings || [];
        }
      } else {
        // Run actual migration
        const result = await migration.migrate(projectPath, projectInfo, this.options);
        migrationResult.changes = result.changes || [];
        migrationResult.warnings = result.warnings || [];
      }

      migrationResult.success = true;
      migrationResult.endTime = Date.now();
      
      console.log(`✅ Completed: ${migration.name} (${migrationResult.endTime - startTime}ms)`);
      if (migrationResult.changes.length > 0) {
        console.log(`   Changes: ${migrationResult.changes.length}`);
      }
      if (migrationResult.warnings.length > 0) {
        console.log(`   Warnings: ${migrationResult.warnings.length}`);
      }

    } catch (error) {
      migrationResult.success = false;
      migrationResult.endTime = Date.now();
      migrationResult.errors.push(error.message);
      
      console.error(`❌ Failed: ${migration.name} - ${error.message}`);
      this.errors.push(`${migration.name}: ${error.message}`);
      
      if (!migration.optional) {
        throw new Error(`Critical migration failed: ${migration.name}`);
      }
    }

    this.migrationHistory.push(migrationResult);
    this.warnings.push(...migrationResult.warnings);
  }

  // Generate migration report
  generateMigrationReport() {
    const totalMigrations = this.migrationHistory.length;
    const successfulMigrations = this.migrationHistory.filter(m => m.success).length;
    const failedMigrations = totalMigrations - successfulMigrations;
    const totalChanges = this.migrationHistory.reduce((sum, m) => sum + m.changes.length, 0);

    const report = {
      summary: {
        totalMigrations,
        successful: successfulMigrations,
        failed: failedMigrations,
        totalChanges,
        totalWarnings: this.warnings.length,
        totalErrors: this.errors.length,
        duration: this.migrationHistory.reduce((sum, m) => 
          sum + (m.endTime - m.startTime), 0
        )
      },
      migrations: this.migrationHistory,
      errors: this.errors,
      warnings: this.warnings,
      backupPath: this.backupPath
    };

    // Print summary
    console.log('\n📊 MIGRATION SUMMARY');
    console.log('===================');
    console.log(`Migrations: ${successfulMigrations}/${totalMigrations} successful`);
    console.log(`Changes: ${totalChanges}`);
    console.log(`Warnings: ${this.warnings.length}`);
    console.log(`Errors: ${this.errors.length}`);
    console.log(`Duration: ${report.summary.duration}ms`);

    if (this.warnings.length > 0) {
      console.log('\n⚠️  WARNINGS:');
      this.warnings.forEach((warning, i) => {
        console.log(`${i + 1}. ${warning}`);
      });
    }

    return report;
  }
}

/**
 * =============================================================================
 * SPECIFIC MIGRATION IMPLEMENTATIONS
 * =============================================================================
 */

// Migration: Update package.json for Unjucks v2
const packageJsonMigration = {
  name: 'Update package.json for Unjucks v2',
  version: '2.0',
  priority: 1,
  condition: (projectInfo) => projectInfo.packageJson !== null,
  
  async migrate(projectPath, projectInfo, options) {
    const fs = require('fs').promises;
    const path = require('path');
    const changes = [];
    
    const packageJsonPath = path.join(projectPath, 'package.json');
    const packageJson = { ...projectInfo.packageJson };

    // Update Unjucks dependency
    if (packageJson.dependencies?.['@seanchatmangpt/unjucks']) {
      const oldVersion = packageJson.dependencies['@seanchatmangpt/unjucks'];
      packageJson.dependencies['@seanchatmangpt/unjucks'] = '^2.0.0';
      changes.push(`Updated dependency: @seanchatmangpt/unjucks from ${oldVersion} to ^2.0.0`);
    }

    if (packageJson.devDependencies?.['@seanchatmangpt/unjucks']) {
      const oldVersion = packageJson.devDependencies['@seanchatmangpt/unjucks'];
      packageJson.devDependencies['@seanchatmangpt/unjucks'] = '^2.0.0';
      changes.push(`Updated devDependency: @seanchatmangpt/unjucks from ${oldVersion} to ^2.0.0`);
    }

    // Update scripts
    if (packageJson.scripts) {
      Object.keys(packageJson.scripts).forEach(scriptName => {
        const script = packageJson.scripts[scriptName];
        if (script.includes('unjucks')) {
          // Update command syntax if needed
          const updatedScript = script
            .replace(/unjucks new/g, 'unjucks generate')
            .replace(/unjucks add/g, 'unjucks generate');
          
          if (updatedScript !== script) {
            packageJson.scripts[scriptName] = updatedScript;
            changes.push(`Updated script '${scriptName}': ${script} → ${updatedScript}`);
          }
        }
      });
    }

    // Add new recommended scripts
    if (!packageJson.scripts) {
      packageJson.scripts = {};
    }

    const recommendedScripts = {
      'unjucks:list': 'unjucks list',
      'unjucks:help': 'unjucks help'
    };

    Object.entries(recommendedScripts).forEach(([name, command]) => {
      if (!packageJson.scripts[name]) {
        packageJson.scripts[name] = command;
        changes.push(`Added script '${name}': ${command}`);
      }
    });

    // Write updated package.json
    await fs.writeFile(
      packageJsonPath,
      JSON.stringify(packageJson, null, 2) + '\n',
      'utf8'
    );

    return { changes };
  },

  async dryRun(projectPath, projectInfo, options) {
    // Same logic but don't write file
    const changes = [];
    const packageJson = projectInfo.packageJson;

    if (packageJson.dependencies?.['@seanchatmangpt/unjucks']) {
      changes.push(`Would update dependency: @seanchatmangpt/unjucks to ^2.0.0`);
    }

    if (packageJson.devDependencies?.['@seanchatmangpt/unjucks']) {
      changes.push(`Would update devDependency: @seanchatmangpt/unjucks to ^2.0.0`);
    }

    return { changes };
  }
};

// Migration: Convert EJS templates to Nunjucks
const templateFormatMigration = {
  name: 'Convert EJS templates to Nunjucks',
  version: '2.0',
  priority: 3,
  condition: (projectInfo) => projectInfo.templates.some(t => t.type === 'ejs'),
  
  async migrate(projectPath, projectInfo, options) {
    const fs = require('fs').promises;
    const path = require('path');
    const changes = [];
    const warnings = [];

    const ejsTemplates = projectInfo.templates.filter(t => t.type === 'ejs');
    
    for (const template of ejsTemplates) {
      try {
        const templateContent = await fs.readFile(template.path, 'utf8');
        const convertedContent = this.convertEjsToNunjucks(templateContent);
        
        // Create new .njk file
        const newPath = template.path.replace(/\.ejs$/, '.njk');
        await fs.writeFile(newPath, convertedContent, 'utf8');
        
        changes.push(`Converted ${template.relativePath} → ${path.basename(newPath)}`);
        
        // Remove old .ejs file
        await fs.unlink(template.path);
        changes.push(`Removed ${template.relativePath}`);
        
      } catch (error) {
        warnings.push(`Failed to convert ${template.relativePath}: ${error.message}`);
      }
    }

    return { changes, warnings };
  },

  convertEjsToNunjucks(ejsContent) {
    let nunjucksContent = ejsContent;
    
    // Convert variable syntax: <%= var %> → {{ var }}
    nunjucksContent = nunjucksContent.replace(/<%=\s*(.*?)\s*%>/g, '{{ $1 }}');
    
    // Convert raw output: <%- var %> → {{ var | safe }}
    nunjucksContent = nunjucksContent.replace(/<%- \s*(.*?)\s*%>/g, '{{ $1 | safe }}');
    
    // Convert control structures: <% if (condition) { %> → {% if condition %}
    nunjucksContent = nunjucksContent
      .replace(/<% if \((.*?)\) \{ %>/g, '{% if $1 %}')
      .replace(/<% } else if \((.*?)\) \{ %>/g, '{% elif $1 %}')
      .replace(/<% } else \{ %>/g, '{% else %}')
      .replace(/<% } %>/g, '{% endif %}');
    
    // Convert loops: <% for (let item of items) { %> → {% for item in items %}
    nunjucksContent = nunjucksContent
      .replace(/<% for \(let (.*?) of (.*?)\) \{ %>/g, '{% for $1 in $2 %}')
      .replace(/<% for \(const (.*?) of (.*?)\) \{ %>/g, '{% for $1 in $2 %}')
      .replace(/<% (.*?)\.forEach\((.*?) => \{ %>/g, '{% for $2 in $1 %}');
    
    // Convert forEach end: <% }); %> → {% endfor %}
    nunjucksContent = nunjucksContent
      .replace(/<% \}\); %>/g, '{% endfor %}')
      .replace(/<% } %>/g, '{% endfor %}');
    
    // Convert includes: <%- include('template', data) %> → {% include 'template' %}
    nunjucksContent = nunjucksContent.replace(
      /<%- include\(['"](.+?)['"](?:,.*?)?\) %>/g,
      "{% include '$1' %}"
    );

    return nunjucksContent;
  },

  async dryRun(projectPath, projectInfo, options) {
    const changes = [];
    const ejsTemplates = projectInfo.templates.filter(t => t.type === 'ejs');
    
    ejsTemplates.forEach(template => {
      changes.push(`Would convert ${template.relativePath} to Nunjucks format`);
      changes.push(`Would remove original ${template.relativePath}`);
    });

    return { changes };
  }
};

// Migration: Update frontmatter format
const frontmatterMigration = {
  name: 'Update template frontmatter to v2 format',
  version: '2.0',
  priority: 4,
  
  async migrate(projectPath, projectInfo, options) {
    const fs = require('fs').promises;
    const matter = require('gray-matter');
    const changes = [];
    const warnings = [];

    for (const template of projectInfo.templates) {
      try {
        const content = await fs.readFile(template.path, 'utf8');
        const parsed = matter(content);
        
        let frontmatterChanged = false;
        const newFrontmatter = { ...parsed.data };

        // Convert old frontmatter keys to new format
        if (newFrontmatter.name && !newFrontmatter.to) {
          newFrontmatter.to = newFrontmatter.name;
          delete newFrontmatter.name;
          frontmatterChanged = true;
          changes.push(`${template.relativePath}: Converted 'name' to 'to'`);
        }

        // Add new required fields
        if (!newFrontmatter.description) {
          newFrontmatter.description = `Generated template: ${template.name}`;
          frontmatterChanged = true;
          changes.push(`${template.relativePath}: Added description`);
        }

        // Convert old condition syntax
        if (newFrontmatter.unless) {
          newFrontmatter.skipIf = newFrontmatter.unless;
          delete newFrontmatter.unless;
          frontmatterChanged = true;
          changes.push(`${template.relativePath}: Converted 'unless' to 'skipIf'`);
        }

        // Update variable definitions format
        if (newFrontmatter.prompt && Array.isArray(newFrontmatter.prompt)) {
          newFrontmatter.variables = {};
          newFrontmatter.prompt.forEach(prompt => {
            if (typeof prompt === 'object' && prompt.name) {
              newFrontmatter.variables[prompt.name] = {
                type: prompt.type || 'string',
                description: prompt.message || '',
                required: !prompt.optional,
                default: prompt.initial
              };
            }
          });
          delete newFrontmatter.prompt;
          frontmatterChanged = true;
          changes.push(`${template.relativePath}: Converted prompt array to variables object`);
        }

        // Write updated template if changes were made
        if (frontmatterChanged) {
          const newContent = matter.stringify(parsed.content, newFrontmatter);
          await fs.writeFile(template.path, newContent, 'utf8');
        }

      } catch (error) {
        warnings.push(`Failed to update frontmatter in ${template.relativePath}: ${error.message}`);
      }
    }

    return { changes, warnings };
  },

  async dryRun(projectPath, projectInfo, options) {
    const changes = [];
    
    projectInfo.templates.forEach(template => {
      changes.push(`Would analyze and update frontmatter in ${template.relativePath}`);
    });

    return { changes };
  }
};

// Migration: Move legacy template directory
const templateDirectoryMigration = {
  name: 'Move legacy template directory to _templates',
  version: '2.0',
  priority: 2,
  condition: (projectInfo) => projectInfo.hasLegacyStructure,
  
  async migrate(projectPath, projectInfo, options) {
    const fs = require('fs').promises;
    const path = require('path');
    const changes = [];

    const legacyPath = path.join(projectPath, '.unjucks');
    const newPath = path.join(projectPath, '_templates');

    try {
      // Check if target directory already exists
      try {
        await fs.access(newPath);
        changes.push(`Target directory ${newPath} already exists, merging contents`);
        
        // Merge directories
        await this.mergeDirectories(legacyPath, newPath);
        changes.push(`Merged .unjucks into _templates`);
        
      } catch {
        // Target doesn't exist, simple rename
        await fs.rename(legacyPath, newPath);
        changes.push(`Moved .unjucks → _templates`);
      }

    } catch (error) {
      throw new Error(`Failed to move template directory: ${error.message}`);
    }

    return { changes };
  },

  async mergeDirectories(source, target) {
    const fs = require('fs').promises;
    const path = require('path');

    const entries = await fs.readdir(source, { withFileTypes: true });
    
    for (const entry of entries) {
      const sourcePath = path.join(source, entry.name);
      const targetPath = path.join(target, entry.name);

      if (entry.isDirectory()) {
        await fs.mkdir(targetPath, { recursive: true });
        await this.mergeDirectories(sourcePath, targetPath);
      } else {
        // Check if file already exists in target
        try {
          await fs.access(targetPath);
          // File exists, create backup
          const backupPath = targetPath + '.backup';
          await fs.rename(targetPath, backupPath);
          console.log(`Created backup: ${path.basename(backupPath)}`);
        } catch {
          // File doesn't exist in target, safe to copy
        }
        
        await fs.copyFile(sourcePath, targetPath);
      }
    }

    // Remove source directory after successful merge
    await fs.rmdir(source, { recursive: true });
  },

  async dryRun(projectPath, projectInfo, options) {
    const changes = [];
    changes.push('Would move .unjucks directory to _templates');
    return { changes };
  }
};

// Migration: Create Unjucks v2 configuration file
const configurationMigration = {
  name: 'Create Unjucks v2 configuration file',
  version: '2.0',
  priority: 5,
  condition: (projectInfo) => !projectInfo.hasUnjucksConfig,
  
  async migrate(projectPath, projectInfo, options) {
    const fs = require('fs').promises;
    const path = require('path');
    const changes = [];

    const configPath = path.join(projectPath, 'unjucks.config.js');
    
    const defaultConfig = `// Unjucks v2 Configuration
export default {
  // Template directory (relative to project root)
  templateDirectory: './_templates',
  
  // Default output directory
  outputDirectory: './src',
  
  // Global variables available to all templates
  globalVariables: {
    author: '${projectInfo.packageJson?.author || 'Your Name'}',
    license: '${projectInfo.packageJson?.license || 'MIT'}',
    year: new Date().getFullYear()
  },
  
  // Plugin configuration
  plugins: [
    // Add plugins here, e.g.:
    // 'prettier-plugin',
    // 'eslint-plugin'
  ],
  
  // Template engine configuration
  templateEngine: {
    // Configure Nunjucks options
    nunjucks: {
      autoescape: true,
      trimBlocks: true,
      lstripBlocks: true
    }
  },
  
  // File operation settings
  files: {
    // Default file permissions for generated files
    defaultMode: 0o644,
    
    // Backup existing files before overwrite
    backup: false,
    
    // File encoding
    encoding: 'utf8'
  },
  
  // Performance settings
  performance: {
    // Enable template caching
    enableCache: true,
    
    // Maximum cache size
    maxCacheSize: 100,
    
    // Concurrent file operations
    maxConcurrency: 5
  }
};
`;

    await fs.writeFile(configPath, defaultConfig, 'utf8');
    changes.push('Created unjucks.config.js with default settings');

    return { changes };
  },

  async dryRun(projectPath, projectInfo, options) {
    return {
      changes: ['Would create unjucks.config.js with default v2 configuration']
    };
  }
};

/**
 * =============================================================================
 * SPECIALIZED MIGRATION UTILITIES
 * =============================================================================
 */

// Hygen to Unjucks migration utility
class HygenMigrationUtility {
  constructor() {
    this.templateMappings = new Map();
    this.actionMappings = new Map();
  }

  // Migrate Hygen templates to Unjucks format
  async migrateHygenProject(hygenPath, unjucksPath) {
    const fs = require('fs').promises;
    const path = require('path');

    console.log('Starting Hygen to Unjucks migration...');

    // Analyze Hygen structure
    const hygenStructure = await this.analyzeHygenStructure(hygenPath);
    console.log(`Found ${hygenStructure.generators.length} Hygen generators`);

    // Create Unjucks project structure
    await fs.mkdir(path.join(unjucksPath, '_templates'), { recursive: true });

    // Migrate each generator
    for (const generator of hygenStructure.generators) {
      await this.migrateGenerator(generator, hygenPath, unjucksPath);
    }

    // Create package.json if it doesn't exist
    const packageJsonPath = path.join(unjucksPath, 'package.json');
    try {
      await fs.access(packageJsonPath);
    } catch {
      await this.createPackageJson(unjucksPath);
    }

    // Create Unjucks config
    await this.createUnjucksConfig(unjucksPath, hygenStructure);

    console.log('Hygen migration completed successfully');
  }

  // Analyze Hygen project structure
  async analyzeHygenStructure(hygenPath) {
    const fs = require('fs').promises;
    const path = require('path');

    const structure = {
      generators: [],
      globalHelpers: null
    };

    const templatesPath = path.join(hygenPath, '_templates');
    
    try {
      const entries = await fs.readdir(templatesPath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const generator = await this.analyzeGenerator(
            path.join(templatesPath, entry.name),
            entry.name
          );
          structure.generators.push(generator);
        }
      }
    } catch (error) {
      throw new Error(`Failed to analyze Hygen structure: ${error.message}`);
    }

    return structure;
  }

  // Analyze individual generator
  async analyzeGenerator(generatorPath, generatorName) {
    const fs = require('fs').promises;
    const path = require('path');

    const generator = {
      name: generatorName,
      actions: [],
      templates: []
    };

    const entries = await fs.readdir(generatorPath, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.isDirectory()) {
        // Action directory
        const actionPath = path.join(generatorPath, entry.name);
        const action = await this.analyzeAction(actionPath, entry.name);
        generator.actions.push(action);
      }
    }

    return generator;
  }

  // Analyze action (e.g., 'new', 'add')
  async analyzeAction(actionPath, actionName) {
    const fs = require('fs').promises;
    const path = require('path');

    const action = {
      name: actionName,
      templates: [],
      prompts: null
    };

    const entries = await fs.readdir(actionPath);
    
    for (const entry of entries) {
      const entryPath = path.join(actionPath, entry);
      
      if (entry === 'prompt.js') {
        // Load prompts
        try {
          delete require.cache[require.resolve(entryPath)];
          action.prompts = require(entryPath);
        } catch (error) {
          console.warn(`Failed to load prompts for ${actionName}: ${error.message}`);
        }
      } else if (entry.endsWith('.ejs.t')) {
        // Template file
        const templateContent = await fs.readFile(entryPath, 'utf8');
        action.templates.push({
          name: entry,
          path: entryPath,
          content: templateContent
        });
      }
    }

    return action;
  }

  // Migrate individual generator
  async migrateGenerator(generator, hygenPath, unjucksPath) {
    const fs = require('fs').promises;
    const path = require('path');

    console.log(`Migrating generator: ${generator.name}`);

    for (const action of generator.actions) {
      const outputDir = path.join(unjucksPath, '_templates', generator.name, action.name);
      await fs.mkdir(outputDir, { recursive: true });

      for (const template of action.templates) {
        await this.migrateTemplate(template, action, outputDir);
      }
    }
  }

  // Migrate individual template
  async migrateTemplate(template, action, outputDir) {
    const fs = require('fs').promises;
    const path = require('path');
    const matter = require('gray-matter');

    // Parse Hygen template
    const parsed = matter(template.content);
    const hygenFrontmatter = parsed.data;
    
    // Convert to Unjucks frontmatter
    const unjucksFrontmatter = {
      to: hygenFrontmatter.to,
      description: `Migrated from Hygen: ${template.name}`
    };

    // Convert conditionals
    if (hygenFrontmatter.unless) {
      unjucksFrontmatter.skipIf = hygenFrontmatter.unless;
    }

    // Convert prompts to variables
    if (action.prompts && action.prompts.prompt) {
      unjucksFrontmatter.variables = {};
      
      action.prompts.prompt.forEach(prompt => {
        if (prompt.name) {
          unjucksFrontmatter.variables[prompt.name] = {
            type: this.mapHygenPromptType(prompt.type),
            description: prompt.message || '',
            required: !prompt.initial,
            default: prompt.initial
          };
        }
      });
    }

    // Convert template content
    let templateContent = parsed.content;
    templateContent = this.convertHygenSyntax(templateContent);

    // Create new template file
    const outputName = template.name.replace('.ejs.t', '.njk');
    const outputPath = path.join(outputDir, outputName);
    
    const newContent = matter.stringify(templateContent, unjucksFrontmatter);
    await fs.writeFile(outputPath, newContent, 'utf8');

    console.log(`  Migrated: ${template.name} → ${outputName}`);
  }

  // Map Hygen prompt types to Unjucks variable types
  mapHygenPromptType(hygenType) {
    const typeMap = {
      'input': 'string',
      'confirm': 'boolean',
      'list': 'enum',
      'checkbox': 'array'
    };
    
    return typeMap[hygenType] || 'string';
  }

  // Convert Hygen template syntax to Unjucks
  convertHygenSyntax(content) {
    // Convert Hygen variable syntax: <%= name %> (already EJS, will be converted by EJS migration)
    return content;
  }

  // Create package.json for migrated project
  async createPackageJson(projectPath) {
    const fs = require('fs').promises;
    const path = require('path');

    const packageJson = {
      name: path.basename(projectPath),
      version: '1.0.0',
      type: 'module',
      scripts: {
        generate: 'unjucks generate',
        list: 'unjucks list'
      },
      dependencies: {
        '@seanchatmangpt/unjucks': '^2.0.0'
      }
    };

    const packageJsonPath = path.join(projectPath, 'package.json');
    await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf8');
    
    console.log('Created package.json');
  }

  // Create Unjucks configuration
  async createUnjucksConfig(projectPath, hygenStructure) {
    const fs = require('fs').promises;
    const path = require('path');

    const config = `// Unjucks configuration (migrated from Hygen)
export default {
  templateDirectory: './_templates',
  outputDirectory: './app', // Adjust as needed
  
  globalVariables: {
    author: 'Your Name',
    year: new Date().getFullYear()
  },
  
  // Generators migrated from Hygen:
  // ${hygenStructure.generators.map(g => `// - ${g.name}`).join('\n  ')}
};
`;

    const configPath = path.join(projectPath, 'unjucks.config.js');
    await fs.writeFile(configPath, config, 'utf8');
    
    console.log('Created unjucks.config.js');
  }
}

/**
 * =============================================================================
 * USAGE EXAMPLES
 * =============================================================================
 */

// Example: Complete Unjucks v1 to v2 migration
async function migrateUnjucksProject(projectPath) {
  const migrationManager = new UnjucksMigrationManager({
    sourceVersion: '1.x',
    targetVersion: '2.0',
    backupEnabled: true,
    verbose: true
  });

  // Register all migrations
  migrationManager.registerMigration('package-json', packageJsonMigration);
  migrationManager.registerMigration('template-directory', templateDirectoryMigration);
  migrationManager.registerMigration('template-format', templateFormatMigration);
  migrationManager.registerMigration('frontmatter', frontmatterMigration);
  migrationManager.registerMigration('configuration', configurationMigration);

  try {
    const report = await migrationManager.runMigrations(projectPath);
    
    console.log('\n🎉 Migration completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Run `npm install` to update dependencies');
    console.log('2. Test your templates with `unjucks list`');
    console.log('3. Review the generated unjucks.config.js');
    console.log('4. Update any custom scripts or workflows');
    
    return report;
    
  } catch (error) {
    console.error('Migration failed:', error.message);
    throw error;
  }
}

// Example: Dry run migration
async function dryRunMigration(projectPath) {
  const migrationManager = new UnjucksMigrationManager({
    dryRun: true,
    verbose: true
  });

  // Register migrations
  migrationManager.registerMigration('package-json', packageJsonMigration);
  migrationManager.registerMigration('template-format', templateFormatMigration);
  migrationManager.registerMigration('frontmatter', frontmatterMigration);

  return await migrationManager.runMigrations(projectPath);
}

// Example: Hygen to Unjucks migration
async function migrateFromHygen(hygenProjectPath, outputPath) {
  const hygenMigration = new HygenMigrationUtility();
  
  try {
    await hygenMigration.migrateHygenProject(hygenProjectPath, outputPath);
    
    console.log('\n✅ Hygen project migrated successfully!');
    console.log('\nNext steps:');
    console.log('1. Install Unjucks: npm install @seanchatmangpt/unjucks');
    console.log('2. Review migrated templates in _templates/');
    console.log('3. Test generation: unjucks list');
    console.log('4. Adjust configuration in unjucks.config.js as needed');
    
  } catch (error) {
    console.error('Hygen migration failed:', error.message);
    throw error;
  }
}

// CLI interface for migrations
function createMigrationCLI() {
  return {
    async run(command, args) {
      switch (command) {
        case 'migrate':
          return await migrateUnjucksProject(args.projectPath);
          
        case 'dry-run':
          return await dryRunMigration(args.projectPath);
          
        case 'from-hygen':
          return await migrateFromHygen(args.hygenPath, args.outputPath);
          
        default:
          throw new Error(`Unknown migration command: ${command}`);
      }
    }
  };
}

// Export for use in other modules
module.exports = {
  UnjucksMigrationManager,
  HygenMigrationUtility,
  packageJsonMigration,
  templateFormatMigration,
  frontmatterMigration,
  templateDirectoryMigration,
  configurationMigration,
  migrateUnjucksProject,
  dryRunMigration,
  migrateFromHygen,
  createMigrationCLI
};

// Example usage (commented out for safety)
/*
// Migrate existing project
migrateUnjucksProject('./my-unjucks-project')
  .then(report => {
    console.log('Migration report:', report);
  })
  .catch(error => {
    console.error('Migration failed:', error);
  });

// Migrate from Hygen
migrateFromHygen('./_templates', './migrated-project')
  .then(() => {
    console.log('Hygen migration completed');
  })
  .catch(error => {
    console.error('Hygen migration failed:', error);
  });
*/