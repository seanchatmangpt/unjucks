/**
 * Simplified implementation of the unjucks_help MCP tool
 * Self-contained help system without complex dependencies
 */

import { createTextToolResult, handleToolError } from '../utils.js';
import fs from 'fs-extra';
import path from 'node:path';
import { glob } from 'glob';

/**
 * Simplified help functionality for MCP integration
 * @param {import('../types.js').UnjucksHelpParams} params - Help parameters
 * @returns {Promise<import('../types.js').ToolResult>}
 */
export async function unjucksHelp(params) {
  try {
    const { generator, template } = params;
    
    if (!generator || !template) {
      return createTextToolResult(
        'Help requires both generator and template parameters.\n' +
        'Usage: unjucks_help { "generator": "command", "template": "citty" }',
        { error: 'missing_parameters' },
        true
      );
    }

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
        'No templates directory found. Create _templates/ or templates/ directory.',
        { error: 'no_templates_dir' },
        true
      );
    }

    const templatePath = path.join(templatesDir, generator, template);
    
    if (!await fs.pathExists(templatePath)) {
      return createTextToolResult(
        `Template "${generator}/${template}" not found.\n` +
        `Looking in: ${templatePath}\n\n` +
        'Available generators and templates can be found using unjucks_list.',
        { 
          error: 'template_not_found',
          searchPath: templatePath,
          templatesDir 
        },
        true
      );
    }

    // Generate comprehensive help documentation
    const helpContent = await generateHelpContent(templatePath, generator, template, templatesDir);
    
    return createTextToolResult(helpContent, {
      generator,
      template,
      templatePath,
      templatesDir
    });

  } catch (error) {
    return handleToolError(error, 'unjucks_help', `getting help for ${params?.generator}/${params?.template}`);
  }
}

/**
 * Generate comprehensive help content for a template
 * @param {string} templatePath - Path to template directory
 * @param {string} generator - Generator name
 * @param {string} template - Template name
 * @param {string} templatesDir - Templates root directory
 * @returns {Promise<string>}
 */
async function generateHelpContent(templatePath, generator, template, templatesDir) {
  const lines = [];
  
  lines.push(`# Help for ${generator}/${template}`);
  lines.push('');
  
  // Template overview
  lines.push('## Template Overview');
  lines.push(`**Generator:** ${generator}`);
  lines.push(`**Template:** ${template}`);
  lines.push(`**Location:** ${templatePath}`);
  lines.push('');

  // Description from _prompt file
  const description = await getTemplateDescription(templatePath);
  if (description) {
    lines.push('## Description');
    lines.push(description);
    lines.push('');
  }

  // Files that will be generated
  const files = await getTemplateFiles(templatePath);
  if (files.length > 0) {
    lines.push('## Files Generated');
    lines.push(`This template will generate ${files.length} file(s):`);
    lines.push('');
    for (const file of files) {
      lines.push(`- \`${file}\``);
    }
    lines.push('');
  }

  // Variables
  const variables = await getTemplateVariables(templatePath);
  if (variables.length > 0) {
    lines.push('## Variables');
    lines.push('The following variables are used in this template:');
    lines.push('');
    for (const variable of variables) {
      lines.push(`### ${variable.name}`);
      lines.push(`- **Type:** ${variable.type || 'string'}`);
      lines.push(`- **Required:** ${variable.required ? 'Yes' : 'No'}`);
      if (variable.description) {
        lines.push(`- **Description:** ${variable.description}`);
      }
      if (variable.defaultValue !== undefined) {
        lines.push(`- **Default:** \`${variable.defaultValue}\``);
      }
      lines.push('');
    }
  }

  // Usage examples
  lines.push('## Usage Examples');
  lines.push('');
  lines.push('### Generate files');
  lines.push('```bash');
  lines.push(`unjucks generate ${generator} ${template} --dest ./output`);
  if (variables.length > 0) {
    const exampleVars = variables.slice(0, 2).map(v => `--${v.name} "${v.defaultValue || 'example'}"`).join(' ');
    lines.push(`unjucks generate ${generator} ${template} --dest ./output ${exampleVars}`);
  }
  lines.push('```');
  lines.push('');

  lines.push('### Dry run (preview only)');
  lines.push('```bash');
  lines.push(`unjucks generate ${generator} ${template} --dest ./output --dry`);
  lines.push('```');
  lines.push('');

  lines.push('### MCP Tool Usage');
  lines.push('```json');
  const mcpExample = {
    name: 'unjucks_generate',
    arguments: {
      generator,
      template,
      dest: './output',
      variables: {}
    }
  };
  if (variables.length > 0) {
    for (const variable of variables.slice(0, 2)) {
      mcpExample.arguments.variables[variable.name] = variable.defaultValue || 'example';
    }
  }
  lines.push(JSON.stringify(mcpExample, null, 2));
  lines.push('```');
  lines.push('');

  // File contents preview
  const preview = await getFilePreview(templatePath, files.slice(0, 3));
  if (preview) {
    lines.push('## File Preview');
    lines.push(preview);
    lines.push('');
  }

  // Related information
  lines.push('## Related Commands');
  lines.push('- `unjucks_list` - List all available generators and templates');
  lines.push(`- \`unjucks_list { "generator": "${generator}" }\` - List templates in this generator`);
  lines.push(`- \`unjucks_dry_run\` - Preview files before generation`);
  lines.push('- `unjucks_inject` - Inject content into existing files');
  lines.push('');

  lines.push('## Tips');
  lines.push('- Use `--dry` flag to preview changes before writing files');
  lines.push('- Use `--force` flag to overwrite existing files');
  lines.push('- Variables can be passed as command line arguments or in a variables object');
  lines.push('- Template files use EJS syntax: `<%= variableName %>`');

  return lines.join('\n');
}

/**
 * Get template description from _prompt file
 * @param {string} templatePath - Template directory path
 * @returns {Promise<string|null>}
 */
async function getTemplateDescription(templatePath) {
  try {
    const promptFile = path.join(templatePath, '_prompt');
    if (await fs.pathExists(promptFile)) {
      const content = await fs.readFile(promptFile, 'utf8');
      const data = JSON.parse(content);
      return data.description || null;
    }
  } catch (error) {
    // Ignore errors
  }
  return null;
}

/**
 * Get list of files in template
 * @param {string} templatePath - Template directory path
 * @returns {Promise<Array<string>>}
 */
async function getTemplateFiles(templatePath) {
  try {
    const files = await glob('**/*', {
      cwd: templatePath,
      ignore: ['node_modules/**', '.git/**', '_prompt'],
      nodir: true
    });
    return files.sort();
  } catch (error) {
    return [];
  }
}

/**
 * Get template variables from _prompt file or by scanning
 * @param {string} templatePath - Template directory path
 * @returns {Promise<Array>}
 */
async function getTemplateVariables(templatePath) {
  // Try to read from _prompt file first
  try {
    const promptFile = path.join(templatePath, '_prompt');
    if (await fs.pathExists(promptFile)) {
      const content = await fs.readFile(promptFile, 'utf8');
      const data = JSON.parse(content);
      if (data.variables && Array.isArray(data.variables)) {
        return data.variables;
      }
    }
  } catch (error) {
    // Continue to scanning if _prompt file fails
  }

  // Scan template files for variables
  return await scanTemplateForVariables(templatePath);
}

/**
 * Scan template files for variable usage
 * @param {string} templatePath - Template directory path
 * @returns {Promise<Array>}
 */
async function scanTemplateForVariables(templatePath) {
  const variables = new Set();
  
  try {
    const files = await glob('**/*', {
      cwd: templatePath,
      ignore: ['node_modules/**', '.git/**', '_prompt'],
      nodir: true
    });

    const templateExtensions = ['.ejs', '.njk', '.hbs', '.mustache'];
    
    for (const file of files) {
      const hasTemplateExtension = templateExtensions.some(ext => file.endsWith(ext));
      
      if (hasTemplateExtension) {
        try {
          const filePath = path.join(templatePath, file);
          const content = await fs.readFile(filePath, 'utf8');
          
          // Variable detection patterns
          const patterns = [
            /<%=?\s*(\w+)\s*%>/g,           // EJS: <%= variable %>
            /{{\s*(\w+)\s*}}/g,            // Handlebars: {{ variable }}
            /\$\{\{\s*(\w+)\s*\}\}/g,      // Dollar notation: ${{ variable }}
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
  } catch (error) {
    // Ignore scanning errors
  }
  
  return Array.from(variables).map(name => ({
    name,
    type: 'string',
    description: `Template variable: ${name}`,
    required: true
  }));
}

/**
 * Get preview of template file contents
 * @param {string} templatePath - Template directory path
 * @param {Array<string>} files - Files to preview
 * @returns {Promise<string>}
 */
async function getFilePreview(templatePath, files) {
  const previews = [];
  
  for (const file of files) {
    try {
      const filePath = path.join(templatePath, file);
      const content = await fs.readFile(filePath, 'utf8');
      
      // Limit preview to first 10 lines
      const lines = content.split('\n').slice(0, 10);
      const preview = lines.join('\n');
      const truncated = lines.length === 10 && content.split('\n').length > 10;
      
      previews.push(`### ${file}`);
      previews.push('```');
      previews.push(preview);
      if (truncated) {
        previews.push('... (truncated)');
      }
      previews.push('```');
      previews.push('');
    } catch (error) {
      // Skip files that can't be read
    }
  }
  
  return previews.join('\n');
}