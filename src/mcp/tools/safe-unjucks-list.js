/**
 * Safe implementation of unjucks_list with comprehensive error handling
 * @fileoverview Robust template discovery with timeout protection and fallbacks
 */

import { createTextToolResult, createJSONToolResult, handleToolError } from '../utils.js';
import fs from 'fs-extra';
import path from 'node:path';

/**
 * Safe list functionality with timeout protection
 * @param {import('../types.js').UnjucksListParams} params - List parameters
 * @returns {Promise<import('../types.js').ToolResult>}
 */
export async function unjucksList(params) {
  // Add comprehensive timeout protection
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('unjucks_list operation timed out after 3 seconds')), 3000);
  });
  
  try {
    const result = await Promise.race([
      performListOperation(params),
      timeoutPromise
    ]);
    return result;
  } catch (error) {
    return handleToolError(error, 'unjucks_list', 'listing templates');
  }
}

/**
 * Perform the actual list operation
 * @param {import('../types.js').UnjucksListParams} params - List parameters
 * @returns {Promise<import('../types.js').ToolResult>}
 */
async function performListOperation(params) {
  const { generator, detailed = false } = params || {};
  
  // Quick validation
  if (generator && typeof generator !== 'string') {
    return createTextToolResult(
      'Generator parameter must be a string',
      { error: 'invalid_generator_type' },
      true
    );
  }

  // Find templates directory with timeout protection
  const templatesDir = await findTemplatesDirectory();
  
  if (!templatesDir) {
    return createTextToolResult(
      'No templates directory found. Expected _templates/ or templates/ directory.\n\n' +
      'To get started:\n' +
      '1. Create a _templates/ directory\n' +
      '2. Add generator subdirectories (e.g., _templates/command/)\n' +
      '3. Add template subdirectories (e.g., _templates/command/citty/)\n' +
      '4. Add template files with .ejs extension\n\n' +
      'Example structure:\n' +
      '_templates/\n' +
      '  └── command/\n' +
      '      └── citty/\n' +
      '          ├── index.ts.ejs\n' +
      '          └── _prompt',
      { 
        error: 'no_templates_dir',
        searchedPaths: ['_templates', 'templates'],
        suggestion: 'create_templates_directory'
      }
    );
  }

  if (generator) {
    // List templates for specific generator
    return await listTemplatesForGenerator(templatesDir, generator, detailed);
  } else {
    // List all generators
    return await listAllGenerators(templatesDir, detailed);
  }
}

/**
 * Find templates directory with timeout protection
 * @returns {Promise<string|null>}
 */
async function findTemplatesDirectory() {
  const possibleDirs = ['_templates', 'templates'];
  
  for (const dir of possibleDirs) {
    try {
      const fullPath = path.resolve(dir);
      const exists = await fs.pathExists(fullPath);
      if (exists) {
        const stat = await fs.stat(fullPath);
        if (stat.isDirectory()) {
          return fullPath;
        }
      }
    } catch (error) {
      // Continue to next directory
      continue;
    }
  }
  
  return null;
}

/**
 * List templates for a specific generator
 * @param {string} templatesDir - Templates directory path
 * @param {string} generator - Generator name
 * @param {boolean} detailed - Include detailed information
 * @returns {Promise<import('../types.js').ToolResult>}
 */
async function listTemplatesForGenerator(templatesDir, generator, detailed) {
  const generatorPath = path.join(templatesDir, generator);
  
  try {
    const exists = await fs.pathExists(generatorPath);
    if (!exists) {
      return createTextToolResult(
        `Generator "${generator}" not found in ${templatesDir}.\n\n` +
        'Available generators can be found by running unjucks_list without parameters.',
        { 
          error: 'generator_not_found',
          generator,
          templatesDir,
          generatorPath
        },
        true
      );
    }

    const stat = await fs.stat(generatorPath);
    if (!stat.isDirectory()) {
      return createTextToolResult(
        `"${generator}" exists but is not a directory`,
        { error: 'not_directory', generator },
        true
      );
    }

    const templates = await discoverTemplatesInDirectory(generatorPath, detailed);
    
    const result = {
      generator,
      templatesDir,
      generatorPath,
      templates,
      count: templates.length,
      timestamp: new Date().toISOString()
    };

    return createJSONToolResult(result);
    
  } catch (error) {
    return createTextToolResult(
      `Error accessing generator "${generator}": ${error.message}`,
      { error: 'access_error', generator, details: error.message },
      true
    );
  }
}

/**
 * List all generators
 * @param {string} templatesDir - Templates directory path
 * @param {boolean} detailed - Include detailed information
 * @returns {Promise<import('../types.js').ToolResult>}
 */
async function listAllGenerators(templatesDir, detailed) {
  try {
    const generators = await discoverGenerators(templatesDir, detailed);
    
    const result = {
      templatesDir,
      generators,
      count: generators.length,
      totalTemplates: generators.reduce((sum, gen) => sum + (gen.templateCount || 0), 0),
      timestamp: new Date().toISOString()
    };

    return createJSONToolResult(result);
    
  } catch (error) {
    return createTextToolResult(
      `Error listing generators: ${error.message}`,
      { error: 'listing_error', templatesDir, details: error.message },
      true
    );
  }
}

/**
 * Discover generators in templates directory
 * @param {string} templatesDir - Templates directory path
 * @param {boolean} detailed - Include detailed information
 * @returns {Promise<Array>}
 */
async function discoverGenerators(templatesDir, detailed) {
  const generators = [];
  
  try {
    const entries = await fs.readdir(templatesDir, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        try {
          const generatorPath = path.join(templatesDir, entry.name);
          const templates = await discoverTemplatesInDirectory(generatorPath, false); // Basic info only for overview
          
          const generator = {
            name: entry.name,
            description: `Generator: ${entry.name}`,
            path: generatorPath,
            templateCount: templates.length
          };

          if (detailed && templates.length > 0) {
            generator.templates = templates;
          }

          generators.push(generator);
        } catch (error) {
          // Include error generators with error info
          generators.push({
            name: entry.name,
            description: `Generator: ${entry.name} (error)`,
            path: path.join(templatesDir, entry.name),
            templateCount: 0,
            error: error.message
          });
        }
      }
    }
  } catch (error) {
    throw new Error(`Failed to read templates directory: ${error.message}`);
  }

  return generators;
}

/**
 * Discover templates in a directory
 * @param {string} generatorPath - Generator directory path
 * @param {boolean} detailed - Include detailed information
 * @returns {Promise<Array>}
 */
async function discoverTemplatesInDirectory(generatorPath, detailed) {
  const templates = [];
  
  try {
    const entries = await fs.readdir(generatorPath, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        try {
          const templatePath = path.join(generatorPath, entry.name);
          const template = await analyzeTemplate(templatePath, entry.name, detailed);
          templates.push(template);
        } catch (error) {
          // Include templates with errors
          templates.push({
            name: entry.name,
            description: `Template: ${entry.name} (error)`,
            path: path.join(generatorPath, entry.name),
            error: error.message
          });
        }
      }
    }
  } catch (error) {
    throw new Error(`Failed to read generator directory: ${error.message}`);
  }

  return templates;
}

/**
 * Analyze a template directory
 * @param {string} templatePath - Template directory path
 * @param {string} templateName - Template name
 * @param {boolean} detailed - Include detailed information
 * @returns {Promise<Object>}
 */
async function analyzeTemplate(templatePath, templateName, detailed) {
  const template = {
    name: templateName,
    description: `Template: ${templateName}`,
    path: templatePath
  };

  if (!detailed) {
    return template;
  }

  try {
    // Get basic file list quickly
    const entries = await fs.readdir(templatePath, { withFileTypes: true });
    const files = entries
      .filter(entry => entry.isFile() && !entry.name.startsWith('.'))
      .map(entry => entry.name);
    
    template.files = files;
    template.fileCount = files.length;

    // Try to read _prompt file for metadata
    try {
      const promptPath = path.join(templatePath, '_prompt');
      const promptExists = await fs.pathExists(promptPath);
      
      if (promptExists) {
        const promptContent = await fs.readFile(promptPath, 'utf8');
        const promptData = JSON.parse(promptContent);
        
        if (promptData.description) {
          template.description = promptData.description;
        }
        
        if (promptData.variables && Array.isArray(promptData.variables)) {
          template.variables = promptData.variables;
          template.variableCount = promptData.variables.length;
        }
      }
    } catch (promptError) {
      // Ignore _prompt file errors
      template.promptNote = 'Could not read _prompt file';
    }

    // Basic variable scanning if no _prompt variables
    if (!template.variables) {
      template.variables = [];
      template.variableCount = 0;
      template.note = 'Variable scanning disabled for performance';
    }

  } catch (error) {
    template.scanError = error.message;
    template.files = [];
    template.fileCount = 0;
    template.variables = [];
    template.variableCount = 0;
  }

  return template;
}