/**
 * Project Scaffolder
 * Generates complete project structure from template map
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import nunjucks from 'nunjucks';
import chalk from 'chalk';

export class ProjectScaffolder {
  constructor(options = {}) {
    this.dryRun = options.dryRun || false;
    this.force = options.force || false;

    // Configure Nunjucks
    this.env = nunjucks.configure({
      autoescape: false,
      trimBlocks: true,
      lstripBlocks: true
    });
  }

  /**
   * Generate complete project from template map
   */
  async generateProject(templateMap, outputDir, options = {}) {
    const generatedFiles = [];

    try {
      // Create output directory
      if (!this.dryRun) {
        await fs.mkdir(outputDir, { recursive: true });
      }

      // Define project structure
      const structure = {
        'src/models': templateMap.models,
        'src/controllers': templateMap.controllers,
        'src/routes': templateMap.routes,
        'migrations': templateMap.migrations,
        '': [] // Root files
      };

      // Add root files
      if (templateMap.project.packageJson) {
        structure[''].push({
          name: 'package',
          template: templateMap.project.packageJson,
          data: templateMap.project.data,
          extension: 'json'
        });
      }

      if (templateMap.project.server) {
        structure['src'].push({
          name: 'server',
          template: templateMap.project.server,
          data: templateMap.project.data,
          extension: 'js'
        });
      }

      if (templateMap.project.config) {
        structure['src/config'].push({
          name: 'database',
          template: templateMap.project.config,
          data: templateMap.project.data,
          extension: 'js'
        });
      }

      // Generate files
      for (const [dir, items] of Object.entries(structure)) {
        if (!items || items.length === 0) continue;

        const fullDir = join(outputDir, dir);

        if (!this.dryRun) {
          await fs.mkdir(fullDir, { recursive: true });
        }

        for (const item of items) {
          const fileName = `${item.name}.${item.extension || 'js'}`;
          const filePath = join(fullDir, fileName);

          // Check if file exists
          if (!this.force && !this.dryRun) {
            try {
              await fs.access(filePath);
              console.log(chalk.yellow(`⚠️  Skipping existing file: ${filePath}`));
              continue;
            } catch {
              // File doesn't exist, proceed
            }
          }

          // Render template
          const content = this.renderTemplate(item.template, item.data);

          // Write file
          if (!this.dryRun) {
            await fs.writeFile(filePath, content, 'utf8');
          }

          generatedFiles.push({
            path: filePath,
            size: content.length,
            type: dir.split('/')[0] || 'root'
          });
        }
      }

      // Generate additional project files
      await this.generateAdditionalFiles(outputDir, templateMap.project.data, generatedFiles);

      return generatedFiles;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Generate additional project files (README, .gitignore, etc.)
   */
  async generateAdditionalFiles(outputDir, projectData, generatedFiles) {
    // Generate README.md
    const readmeContent = this.generateReadme(projectData);
    const readmePath = join(outputDir, 'README.md');

    if (!this.dryRun) {
      await fs.writeFile(readmePath, readmeContent, 'utf8');
    }

    generatedFiles.push({
      path: readmePath,
      size: readmeContent.length,
      type: 'documentation'
    });

    // Generate .gitignore
    const gitignoreContent = this.generateGitignore();
    const gitignorePath = join(outputDir, '.gitignore');

    if (!this.dryRun) {
      await fs.writeFile(gitignorePath, gitignoreContent, 'utf8');
    }

    generatedFiles.push({
      path: gitignorePath,
      size: gitignoreContent.length,
      type: 'configuration'
    });

    // Generate .env.example
    const envContent = this.generateEnvExample(projectData);
    const envPath = join(outputDir, '.env.example');

    if (!this.dryRun) {
      await fs.writeFile(envPath, envContent, 'utf8');
    }

    generatedFiles.push({
      path: envPath,
      size: envContent.length,
      type: 'configuration'
    });
  }

  /**
   * Render template with data
   */
  renderTemplate(template, data) {
    try {
      return this.env.renderString(template, data);
    } catch (error) {
      throw new Error(`Template rendering failed: ${error.message}`);
    }
  }

  /**
   * Generate README content
   */
  generateReadme(projectData) {
    return `# ${projectData.projectName}

${projectData.metadata?.description || 'Generated from RDF ontology'}

## Features

- REST API with ${projectData.framework}
- ${projectData.database} database
- ${projectData.classes?.length || 0} models
- CRUD operations for all resources

## Installation

\`\`\`bash
npm install
\`\`\`

## Configuration

Copy \`.env.example\` to \`.env\` and configure your database:

\`\`\`bash
cp .env.example .env
\`\`\`

## Database Setup

Run migrations:

\`\`\`bash
npm run migrate
\`\`\`

## Development

\`\`\`bash
npm run dev
\`\`\`

## Production

\`\`\`bash
npm start
\`\`\`

## API Endpoints

${this.generateEndpointsList(projectData.classes)}

## License

MIT
`;
  }

  /**
   * Generate endpoints list for README
   */
  generateEndpointsList(classes) {
    if (!classes || classes.length === 0) return '';

    return classes.map(cls => {
      const resource = cls.name + 's';
      return `
### ${this.capitalize(cls.name)}

- GET    \`/${resource}\` - List all
- GET    \`/${resource}/:id\` - Get by ID
- POST   \`/${resource}\` - Create new
- PUT    \`/${resource}/:id\` - Update
- DELETE \`/${resource}/:id\` - Delete
`;
    }).join('\n');
  }

  /**
   * Generate .gitignore content
   */
  generateGitignore() {
    return `# Dependencies
node_modules/

# Environment
.env
.env.local

# Logs
logs/
*.log

# Build
dist/
build/

# IDE
.vscode/
.idea/

# OS
.DS_Store
Thumbs.db

# Testing
coverage/
.nyc_output/
`;
  }

  /**
   * Generate .env.example content
   */
  generateEnvExample(projectData) {
    const dbType = projectData.database || 'postgresql';

    let dbUrl = '';
    switch (dbType) {
      case 'postgresql':
        dbUrl = 'postgresql://user:password@localhost:5432/dbname';
        break;
      case 'mysql':
        dbUrl = 'mysql://user:password@localhost:3306/dbname';
        break;
      case 'sqlite':
        dbUrl = 'sqlite://./database.sqlite';
        break;
    }

    return `# Application
NODE_ENV=development
PORT=3000

# Database
DATABASE_URL=${dbUrl}

# API
API_PREFIX=/api/v1

# Logging
LOG_LEVEL=info
`;
  }

  /**
   * Display generation summary
   */
  displaySummary(generatedFiles) {
    console.log('\n' + chalk.bold('📊 Generation Summary\n'));

    // Group by type
    const byType = generatedFiles.reduce((acc, file) => {
      if (!acc[file.type]) acc[file.type] = [];
      acc[file.type].push(file);
      return acc;
    }, {});

    // Display grouped files
    for (const [type, files] of Object.entries(byType)) {
      console.log(chalk.blue(`${this.capitalize(type)} (${files.length} files):`));
      files.forEach(file => {
        const sizeKB = (file.size / 1024).toFixed(2);
        console.log(chalk.gray(`  ✓ ${file.path} (${sizeKB} KB)`));
      });
      console.log();
    }

    // Total stats
    const totalSize = generatedFiles.reduce((sum, f) => sum + f.size, 0);
    const totalSizeKB = (totalSize / 1024).toFixed(2);

    console.log(chalk.green(`Total: ${generatedFiles.length} files (${totalSizeKB} KB)`));
  }

  /**
   * Capitalize string
   */
  capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

export default ProjectScaffolder;
