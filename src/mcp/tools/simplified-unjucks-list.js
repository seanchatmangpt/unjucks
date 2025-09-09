/**
 * Simplified implementation of the unjucks_list MCP tool
 * Self-contained template discovery without complex dependencies
 */

import { createTextToolResult, createJSONToolResult, handleToolError } from '../utils.js';
import fs from 'fs-extra';
import path from 'node:path';
import { glob } from 'glob';

/**
 * Simplified list functionality for MCP integration
 * @param {import('../types.js').UnjucksListParams} params - List parameters
 * @returns {Promise<import('../types.js').ToolResult>}
 */
export async function unjucksList(params) {
  try {
    const { generator, detailed = false } = params || {};
    
    // Find templates directories
    const possibleTemplateDirs = [
      '_templates',
      'templates',
      './templates',
      './_templates'
    ];

    let templatesDir = null;
    for (const dir of possibleTemplateDirs) {
      const fullPath = path.resolve(dir);
      if (await fs.pathExists(fullPath)) {
        templatesDir = fullPath;
        break;
      }
    }

    if (!templatesDir) {
      return createTextToolResult(
        'No templates directory found. Looking for _templates/ or templates/ directories.\n' +
        'Create a templates directory with generator subdirectories to get started.',
        { searchedPaths: possibleTemplateDirs }
      );
    }

    if (generator) {
      // List templates for specific generator
      const generatorPath = path.join(templatesDir, generator);
      
      if (!await fs.pathExists(generatorPath)) {
        return createTextToolResult(
          `Generator "${generator}" not found in ${templatesDir}`,
          { error: 'generator_not_found', templatesDir }
        );
      }

      const templates = await discoverTemplatesInGenerator(generatorPath, generator, detailed);
      
      const result = {
        generator,
        templatesDir,
        generatorPath,
        templates,
        count: templates.length
      };

      return createJSONToolResult(result);

    } else {
      // List all generators
      const generators = await discoverAllGenerators(templatesDir, detailed);
      
      const result = {
        templatesDir,
        generators,
        count: generators.length,
        totalTemplates: generators.reduce((sum, gen) => sum + (gen.templateCount || 0), 0)
      };

      return createJSONToolResult(result);
    }

  } catch (error) {
    return handleToolError(error, 'unjucks_list', 'discovering templates');
  }
}

/**
 * Discover all generators in templates directory
 * @param {string} templatesDir - Templates directory path
 * @param {boolean} detailed - Include detailed information
 * @returns {Promise<Array>}
 */
async function discoverAllGenerators(templatesDir, detailed) {
  const generators = [];
  
  try {
    const entries = await fs.readdir(templatesDir, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        const generatorPath = path.join(templatesDir, entry.name);
        const templates = await discoverTemplatesInGenerator(generatorPath, entry.name, detailed);
        
        const generator = {
          name: entry.name,
          description: `Generator: ${entry.name}`,
          path: generatorPath,
          templateCount: templates.length
        };

        if (detailed) {
          generator.templates = templates;
        }

        generators.push(generator);
      }
    }
  } catch (error) {
    console.warn('Error reading templates directory:', error.message);
  }

  return generators;
}

/**
 * Discover templates within a generator directory
 * @param {string} generatorPath - Generator directory path
 * @param {string} generatorName - Generator name
 * @param {boolean} detailed - Include detailed information
 * @returns {Promise<Array>}
 */
async function discoverTemplatesInGenerator(generatorPath, generatorName, detailed) {
  const templates = [];
  
  try {
    const entries = await fs.readdir(generatorPath, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        const templatePath = path.join(generatorPath, entry.name);
        const template = await analyzeTemplate(templatePath, entry.name, generatorName, detailed);
        templates.push(template);
      }
    }
  } catch (error) {
    console.warn(`Error reading generator directory ${generatorPath}:`, error.message);
  }

  return templates;
}

/**
 * Analyze a single template directory
 * @param {string} templatePath - Template directory path
 * @param {string} templateName - Template name
 * @param {string} generatorName - Generator name
 * @param {boolean} detailed - Include detailed information
 * @returns {Promise<Object>}
 */
async function analyzeTemplate(templatePath, templateName, generatorName, detailed) {
  const template = {
    name: templateName,
    description: `Template: ${templateName}`,
    path: templatePath
  };

  if (detailed) {
    try {
      // Find template files
      const files = await glob('**/*', { 
        cwd: templatePath,
        ignore: ['node_modules/**', '.git/**'],
        nodir: true 
      });
      
      template.files = files;
      template.fileCount = files.length;

      // Try to read _prompt file for metadata
      const promptFile = path.join(templatePath, '_prompt');
      if (await fs.pathExists(promptFile)) {
        try {
          const promptContent = await fs.readFile(promptFile, 'utf8');
          const promptData = JSON.parse(promptContent);
          
          if (promptData.description) {
            template.description = promptData.description;
          }
          
          if (promptData.variables && Array.isArray(promptData.variables)) {
            template.variables = promptData.variables;
            template.variableCount = promptData.variables.length;
          }
        } catch (error) {
          // Ignore prompt file parsing errors
          template.promptError = 'Could not parse _prompt file';
        }
      }

      // Scan for variables in template files
      if (!template.variables) {
        template.variables = await scanForVariables(templatePath, files);
        template.variableCount = template.variables.length;
      }

    } catch (error) {
      template.scanError = error.message;
      template.files = [];
      template.fileCount = 0;
      template.variables = [];
      template.variableCount = 0;
    }
  }

  return template;
}

/**
 * Scan template files for variables
 * @param {string} templatePath - Template directory path
 * @param {Array<string>} files - List of template files
 * @returns {Promise<Array>}
 */
async function scanForVariables(templatePath, files) {
  const variables = new Set();
  
  // Common template file extensions
  const templateExtensions = ['.ejs', '.njk', '.hbs', '.mustache'];
  
  for (const file of files) {
    const hasTemplateExtension = templateExtensions.some(ext => file.endsWith(ext));
    
    if (hasTemplateExtension) {
      try {
        const filePath = path.join(templatePath, file);
        const content = await fs.readFile(filePath, 'utf8');
        
        // Simple variable detection patterns
        const patterns = [
          /<%=?\s*(\w+)\s*%>/g,           // EJS: <%= variable %>
          /{{\s*(\w+)\s*}}/g,            // Handlebars/Mustache: {{ variable }}
          /\$\{\{\s*(\w+)\s*\}\}/g,      // Dollar notation: ${{ variable }}
          /<%\s*(\w+)\s*%>/g             // EJS without =
        ];
        
        for (const pattern of patterns) {
          let match;
          while ((match = pattern.exec(content)) !== null) {
            const varName = match[1];
            if (varName && varName.length > 0) {
              variables.add(varName);
            }
          }
        }
      } catch (error) {
        // Ignore file reading errors
      }
    }
  }
  
  return Array.from(variables).map(name => ({
    name,
    type: 'string',
    description: `Variable: ${name}`,
    required: true
  }));
}