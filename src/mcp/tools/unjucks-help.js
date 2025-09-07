/**
 * Implementation of the unjucks_help MCP tool
 * Extracts help and documentation from templates
 */

import { Generator } from '../../lib/generator.js';
import { 
  createTextToolResult, 
  createJSONToolResult, 
  handleToolError, 
  validateObjectSchema,
  validateGeneratorName,
  validateTemplateName,
  logPerformance
} from '../utils.js';
import { TOOL_SCHEMAS } from '../types.js';
import path from 'node:path';
import fs from 'fs-extra';
import yaml from 'yaml';

/**
 * Get help information for a specific generator and template
 * @param {import('../types.js').UnjucksHelpParams} params - Help parameters
 * @returns {Promise<import('../types.js').ToolResult>}
 */
export async function unjucksHelp(params) {
  const startTime = performance.now();
  
  try {
    // Validate input parameters
    const validation = validateObjectSchema(params, TOOL_SCHEMAS.unjucks_help);
    if (!validation.valid) {
      return createTextToolResult(`Invalid parameters: ${validation.errors.join(', ')}`, true);
    }

    const { generator, template } = params;

    // Validate generator and template names
    try {
      validateGeneratorName(generator);
      validateTemplateName(template);
    } catch (error) {
      return handleToolError(error, 'unjucks_help', 'parameter validation');
    }

    // Initialize generator instance
    const gen = new Generator();
    
    try {
      // Get templates directory
      const templatesDir = gen.getTemplatesDirectory();
      const generatorPath = path.join(templatesDir, generator);
      const templatePath = path.join(generatorPath, template);

      // Check if generator and template exist
      if (!(await fs.pathExists(generatorPath))) {
        const generators = await gen.listGenerators();
        const availableGenerators = generators.map(g => g.name).join(', ');
        return createTextToolResult(
          `Generator "${generator}" not found. Available generators: ${availableGenerators || 'none'}`,
          true
        );
      }

      if (!(await fs.pathExists(templatePath))) {
        const templates = await gen.listTemplates(generator);
        const availableTemplates = templates.map(t => t.name).join(', ');
        return createTextToolResult(
          `Template "${template}" not found in generator "${generator}". Available templates: ${availableTemplates || 'none'}`,
          true
        );
      }

      // Scan template for variables and metadata
      const { variables } = await gen.scanTemplateForVariables(generator, template);
      
      // Load generator configuration if it exists
      /** @type {any} */
      let generatorConfig = {};
      const configPath = path.join(generatorPath, 'config.yml');
      if (await fs.pathExists(configPath)) {
        try {
          const configContent = await fs.readFile(configPath, 'utf8');
          generatorConfig = yaml.parse(configContent);
        } catch (error) {
          // Ignore config parsing errors
        }
      }

      // Find template configuration
      /** @type {any} */
      const templateConfig = generatorConfig.templates?.find((t) => t.name === template) || {};

      // Get template files with sample content
      const templateFiles = await getTemplateFilesWithContent(templatePath);

      // Build comprehensive help information
      const helpInfo = {
        generator: {
          name: generator,
          description: generatorConfig.description || `Generator for ${generator}`,
          path: generatorPath
        },
        template: {
          name: template,
          description: templateConfig.description || `Template for ${template}`,
          path: templatePath
        },
        usage: {
          command: `unjucks generate ${generator} ${template}`,
          examples: generateUsageExamples(generator, template, variables)
        },
        variables: variables.map(v => ({
          name: v.name,
          type: v.type,
          description: v.description || `${v.name} variable`,
          defaultValue: v.defaultValue,
          required: v.required !== false,
          examples: generateVariableExamples(v.name, v.type)
        })),
        files: templateFiles.map(f => ({
          template: f.path,
          description: f.description || `Template file: ${f.name}`,
          variables: f.variables,
          frontmatter: f.frontmatter,
          size: f.size
        })),
        prompts: templateConfig.prompts || [],
        options: {
          dest: {
            description: "Destination directory for generated files",
            required: true,
            type: "string"
          },
          force: {
            description: "Force overwrite existing files",
            required: false,
            type: "boolean",
            default: false
          },
          dry: {
            description: "Dry run - show what would be generated without writing files",
            required: false,
            type: "boolean", 
            default: false
          }
        },
        tips: generateHelpTips(generator, template, variables),
        relatedCommands: [
          `unjucks list ${generator}`,
          `unjucks dry-run ${generator} ${template}`,
          'unjucks list'
        ]
      };

      // Performance logging
      const duration = performance.now() - startTime;
      logPerformance({
        operation: `help for ${generator}/${template}`,
        duration,
        filesProcessed: templateFiles.length
      });

      // Return formatted help information
      return {
        content: [
          {
            type: "text",
            text: formatHelpAsText(helpInfo)
          },
          {
            type: "text",
            text: JSON.stringify(helpInfo, null, 2)
          }
        ],
        isError: false,
        _meta: {
          generator,
          template,
          variableCount: variables.length,
          fileCount: templateFiles.length,
          timestamp: new Date().toISOString()
        }
      };
      
    } catch (error) {
      return handleToolError(error, 'unjucks_help', `getting help for ${generator}/${template}`);
    }
    
  } catch (error) {
    return handleToolError(error, 'unjucks_help', 'general operation');
  }
}

/**
 * Get template files with content analysis
 * @param {string} templatePath - Path to template directory
 * @returns {Promise<Array<any>>}
 */
async function getTemplateFilesWithContent(templatePath) {
  const files = [];
  
  /**
   * @param {string} dir - Directory to scan
   * @param {string} prefix - Path prefix
   */
  const scanDir = async (dir, prefix = '') => {
    const entries = await fs.readdir(dir);

    for (const entry of entries) {
      const entryPath = path.join(dir, entry);
      const stat = await fs.stat(entryPath);

      if (stat.isDirectory()) {
        await scanDir(entryPath, path.join(prefix, entry));
      } else {
        try {
          const content = await fs.readFile(entryPath, 'utf8');
          const relativePath = path.join(prefix, entry);
          
          // Extract frontmatter if present
          /** @type {any} */
          let frontmatter = {};
          let bodyContent = content;
          
          if (content.startsWith('---\n')) {
            const frontmatterEnd = content.indexOf('\n---\n', 4);
            if (frontmatterEnd > 0) {
              try {
                const frontmatterStr = content.slice(4, frontmatterEnd);
                frontmatter = yaml.parse(frontmatterStr) || {};
                bodyContent = content.slice(frontmatterEnd + 5);
              } catch {
                // Ignore frontmatter parsing errors
              }
            }
          }

          // Extract template variables from content
          const variables = extractVariablesFromContent(content);
          
          files.push({
            path: relativePath,
            name: entry,
            size: stat.size,
            frontmatter,
            variables,
            description: frontmatter.description || generateFileDescription(entry, variables),
            contentPreview: bodyContent.slice(0, 200) + (bodyContent.length > 200 ? '...' : '')
          });
        } catch (error) {
          // If we can't read the file, just include basic info
          files.push({
            path: path.join(prefix, entry),
            name: entry,
            size: stat.size,
            error: 'Could not read file content'
          });
        }
      }
    }
  };

  await scanDir(templatePath);
  return files;
}

/**
 * Extract variables from template content
 * @param {string} content - Template content
 * @returns {string[]}
 */
function extractVariablesFromContent(content) {
  const variables = new Set();
  
  // Nunjucks variables: {{ variable }}
  const nunjucksMatches = content.match(/\{\{\s*([^}\s|]+)(?:\s*\|[^}]*)?\s*\}\}/g);
  if (nunjucksMatches) {
    for (const match of nunjucksMatches) {
      const varMatch = match.match(/\{\{\s*([^}\s|]+)/);
      if (varMatch) {
        variables.add(varMatch[1]);
      }
    }
  }

  // EJS variables: <%= variable %>
  const ejsMatches = content.match(/<%=\s*([^%>]+)\s*%>/g);
  if (ejsMatches) {
    for (const match of ejsMatches) {
      const varMatch = match.match(/<%=\s*([^%>\s.()]+)/);
      if (varMatch) {
        variables.add(varMatch[1]);
      }
    }
  }

  return Array.from(variables).sort();
}

/**
 * Generate usage examples
 * @param {string} generator - Generator name
 * @param {string} template - Template name
 * @param {any[]} variables - Template variables
 * @returns {Array<{description: string, command: string}>}
 */
function generateUsageExamples(generator, template, variables) {
  const examples = [];
  
  // Basic example
  examples.push({
    description: "Basic usage",
    command: `unjucks generate ${generator} ${template} --dest ./output`
  });

  // Example with variables
  if (variables.length > 0) {
    const varExamples = variables
      .slice(0, 3) // Show first 3 variables
      .map(v => `--${v.name} ${getExampleValue(v)}`)
      .join(' ');
    
    examples.push({
      description: "With variables",
      command: `unjucks generate ${generator} ${template} --dest ./output ${varExamples}`
    });
  }

  // Dry run example
  examples.push({
    description: "Dry run (preview without writing files)",
    command: `unjucks generate ${generator} ${template} --dest ./output --dry`
  });

  // Force overwrite example
  examples.push({
    description: "Force overwrite existing files",
    command: `unjucks generate ${generator} ${template} --dest ./output --force`
  });

  return examples;
}

/**
 * Generate example values for variables
 * @param {any} variable - Variable definition
 * @returns {string}
 */
function getExampleValue(variable) {
  if (variable.defaultValue !== undefined) {
    return variable.defaultValue;
  }
  
  switch (variable.type) {
    case 'boolean':
      return 'true';
    case 'number':
      return '42';
    default:
      return variable.name.includes('name') ? 'MyProject' : 'example';
  }
}

/**
 * Generate variable examples
 * @param {string} name - Variable name
 * @param {string} type - Variable type
 * @returns {string[]}
 */
function generateVariableExamples(name, type) {
  const examples = [];
  
  switch (type) {
    case 'boolean':
      examples.push('true', 'false');
      break;
    case 'number':
      examples.push('1', '42', '100');
      break;
    default:
      if (name.toLowerCase().includes('name')) {
        examples.push('MyProject', 'MyComponent', 'MyService');
      } else if (name.toLowerCase().includes('description')) {
        examples.push('A sample description', 'My awesome project');
      } else {
        examples.push('example', 'sample', 'demo');
      }
  }
  
  return examples.slice(0, 3);
}

/**
 * Generate file description based on name and variables
 * @param {string} filename - File name
 * @param {string[]} variables - Template variables
 * @returns {string}
 */
function generateFileDescription(filename, variables) {
  const ext = path.extname(filename);
  const base = path.basename(filename, ext);
  
  let description = `Template file`;
  
  if (ext === '.ts' || ext === '.js') {
    description = `TypeScript/JavaScript ${base.includes('test') ? 'test' : 'source'} file`;
  } else if (ext === '.md') {
    description = 'Markdown documentation file';
  } else if (ext === '.json') {
    description = 'JSON configuration file';
  } else if (ext === '.yml' || ext === '.yaml') {
    description = 'YAML configuration file';
  }
  
  if (variables.length > 0) {
    description += ` using variables: ${variables.slice(0, 3).join(', ')}`;
    if (variables.length > 3) {
      description += ` and ${variables.length - 3} more`;
    }
  }
  
  return description;
}

/**
 * Generate helpful tips
 * @param {string} generator - Generator name
 * @param {string} template - Template name
 * @param {any[]} variables - Template variables
 * @returns {string[]}
 */
function generateHelpTips(generator, template, variables) {
  const tips = [];
  
  tips.push(`Use 'unjucks dry-run ${generator} ${template}' to preview files before generation`);
  
  if (variables.length > 0) {
    tips.push(`This template uses ${variables.length} variables. You can provide them via CLI arguments or prompts`);
  }
  
  tips.push(`Use --force to overwrite existing files, or check conflicts first with dry-run`);
  tips.push(`The --dest parameter determines where files will be generated`);
  
  return tips;
}

/**
 * Format help information as readable text
 * @param {any} helpInfo - Help information object
 * @returns {string}
 */
function formatHelpAsText(helpInfo) {
  const lines = [];
  
  lines.push(`# Help: ${helpInfo.generator.name}/${helpInfo.template.name}`);
  lines.push('');
  
  lines.push('## Description');
  lines.push(helpInfo.template.description);
  lines.push('');
  
  lines.push('## Usage');
  lines.push(`\`${helpInfo.usage.command} --dest <destination>\``);
  lines.push('');
  
  if (helpInfo.variables.length > 0) {
    lines.push('## Variables');
    for (const variable of helpInfo.variables) {
      lines.push(`- **${variable.name}** (${variable.type}${variable.required ? ', required' : ''}): ${variable.description}`);
      if (variable.defaultValue !== undefined) {
        lines.push(`  - Default: ${variable.defaultValue}`);
      }
      if (variable.examples.length > 0) {
        lines.push(`  - Examples: ${variable.examples.join(', ')}`);
      }
    }
    lines.push('');
  }
  
  lines.push('## Examples');
  for (const example of helpInfo.usage.examples) {
    lines.push(`### ${example.description}`);
    lines.push(`\`${example.command}\``);
    lines.push('');
  }
  
  if (helpInfo.files.length > 0) {
    lines.push('## Generated Files');
    for (const file of helpInfo.files) {
      lines.push(`- **${file.template}**: ${file.description}`);
    }
    lines.push('');
  }
  
  if (helpInfo.tips.length > 0) {
    lines.push('## Tips');
    for (const tip of helpInfo.tips) {
      lines.push(`- ${tip}`);
    }
    lines.push('');
  }
  
  return lines.join('\n');
}