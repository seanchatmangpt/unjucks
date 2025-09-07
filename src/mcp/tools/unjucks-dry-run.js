/**
 * Implementation of the unjucks_dry_run MCP tool
 * Provides preview functionality without writing files
 */

import { Generator } from '../../lib/generator.js';
import { 
  createTextToolResult, 
  createJSONToolResult, 
  handleToolError, 
  validateObjectSchema,
  validateDestination,
  validateGeneratorName,
  validateTemplateName,
  formatFileSize,
  logPerformance,
  createFileOperationSummary
} from '../utils.js';
import { TOOL_SCHEMAS } from '../types.js';
import path from 'node:path';
import fs from 'fs-extra';

/**
 * Perform a dry run of template generation showing what would be created
 * @param {import('../types.js').UnjucksDryRunParams} params - Dry run parameters
 * @returns {Promise<import('../types.js').ToolResult>}
 */
export async function unjucksDryRun(params) {
  const startTime = performance.now();
  
  try {
    // Validate input parameters
    const validation = validateObjectSchema(params, TOOL_SCHEMAS.unjucks_dry_run);
    if (!validation.valid) {
      return createTextToolResult(`Invalid parameters: ${validation.errors.join(', ')}`, true);
    }

    const { generator, template, dest, variables = {} } = params;

    // Validate generator and template names
    try {
      validateGeneratorName(generator);
      validateTemplateName(template);
    } catch (error) {
      return handleToolError(error, 'unjucks_dry_run', 'parameter validation');
    }

    // Validate and sanitize destination
    /** @type {string} */
    let destinationPath;
    try {
      destinationPath = validateDestination(dest);
    } catch (error) {
      return handleToolError(error, 'unjucks_dry_run', 'destination validation');
    }

    // Initialize generator instance
    const gen = new Generator();
    
    try {
      // Check if generator and template exist
      const generators = await gen.listGenerators();
      const foundGenerator = generators.find(g => g.name === generator);
      
      if (!foundGenerator) {
        const availableGenerators = generators.map(g => g.name).join(', ');
        return createTextToolResult(
          `Generator "${generator}" not found. Available generators: ${availableGenerators || 'none'}`,
          true
        );
      }

      const foundTemplate = foundGenerator.templates.find(t => t.name === template);
      if (!foundTemplate) {
        const availableTemplates = foundGenerator.templates.map(t => t.name).join(', ');
        return createTextToolResult(
          `Template "${template}" not found in generator "${generator}". Available templates: ${availableTemplates || 'none'}`,
          true
        );
      }

      // Check for existing files that would be affected
      const existingFiles = await checkExistingFiles(destinationPath, foundTemplate.files, variables, gen);
      
      // Perform dry run generation
      const generateOptions = {
        generator,
        template,
        dest: destinationPath,
        force: false, // Never force in dry run
        dry: true,    // Always dry run
        variables
      };

      const result = await gen.generate(generateOptions);
      
      // Process results for dry run output
      const dryRunFiles = await Promise.all(result.files.map(async (file) => {
        const relativePath = path.relative(destinationPath, file.path);
        const exists = await fs.pathExists(file.path);
        const fileSize = Buffer.byteLength(file.content, 'utf8');
        
        // Determine what would happen to this file
        let action = 'create';
        let warning = null;
        
        if (exists) {
          action = 'overwrite';
          warning = 'File exists and would be overwritten';
        }
        
        if (file.injectionResult) {
          if (file.injectionResult.action === 'inject') {
            action = 'inject';
          } else if (file.injectionResult.skipped) {
            action = 'skip';
            warning = file.injectionResult.message || 'File would be skipped';
          }
        }

        return {
          path: file.path,
          relativePath,
          content: file.content,
          size: fileSize,
          action,
          exists,
          warning,
          frontmatter: file.frontmatter,
          variables: extractVariablesFromContent(file.content)
        };
      }));

      // Create summary
      /** @type {Record<string, number>} */
      const actionCounts = dryRunFiles.reduce((acc, file) => {
        acc[file.action] = (acc[file.action] || 0) + 1;
        return acc;
      }, {});

      const summary = {
        totalFiles: dryRunFiles.length,
        actions: actionCounts,
        totalSize: dryRunFiles.reduce((sum, file) => sum + file.size, 0),
        warnings: dryRunFiles.filter(f => f.warning).length,
        existingFiles: dryRunFiles.filter(f => f.exists).length
      };

      // Build comprehensive dry run report
      const dryRunReport = {
        operation: 'dry-run',
        generator: {
          name: generator,
          template: template,
          variables: Object.keys(variables)
        },
        destination: {
          path: destinationPath,
          exists: await fs.pathExists(destinationPath)
        },
        preview: {
          files: dryRunFiles.map(file => ({
            path: file.relativePath,
            fullPath: file.path,
            action: file.action,
            size: formatFileSize(file.size),
            exists: file.exists,
            warning: file.warning,
            contentPreview: file.content.slice(0, 200) + (file.content.length > 200 ? '...' : ''),
            variables: file.variables.slice(0, 10) // Limit variables shown
          }))
        },
        summary: {
          ...summary,
          totalSizeFormatted: formatFileSize(summary.totalSize)
        },
        conflicts: existingFiles.filter(f => f.exists),
        recommendations: generateRecommendations(dryRunFiles, summary)
      };

      // Performance logging
      const duration = performance.now() - startTime;
      logPerformance({
        operation: `dry-run ${generator}/${template}`,
        duration,
        filesProcessed: dryRunFiles.length
      });

      // Create formatted text output
      const textOutput = formatDryRunReport(dryRunReport);

      return {
        content: [
          {
            type: "text",
            text: textOutput
          },
          {
            type: "text",
            text: JSON.stringify(dryRunReport, null, 2)
          }
        ],
        isError: false,
        _meta: {
          generator,
          template,
          fileCount: dryRunFiles.length,
          hasWarnings: summary.warnings > 0,
          hasConflicts: summary.existingFiles > 0,
          timestamp: new Date().toISOString()
        }
      };
      
    } catch (error) {
      return handleToolError(error, 'unjucks_dry_run', `dry run for ${generator}/${template}`);
    }
    
  } catch (error) {
    return handleToolError(error, 'unjucks_dry_run', 'general operation');
  }
}

/**
 * Check for existing files that would be affected
 * @param {string} destinationPath - Destination path
 * @param {string[]} templateFiles - Template files
 * @param {Record<string, any>} variables - Variables
 * @param {Generator} generator - Generator instance
 * @returns {Promise<Array<any>>}
 */
async function checkExistingFiles(destinationPath, templateFiles, variables, generator) {
  const existingFiles = [];
  
  for (const templateFile of templateFiles) {
    try {
      // Process template filename with variables (simplified)
      const processedName = templateFile.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, varName) => {
        return variables[varName] || varName;
      });
      
      const filePath = path.join(destinationPath, processedName);
      
      try {
        const stat = await fs.stat(filePath);
        existingFiles.push({
          template: templateFile,
          path: filePath,
          exists: true,
          size: stat.size,
          modified: stat.mtime
        });
      } catch {
        existingFiles.push({
          template: templateFile,
          path: filePath,
          exists: false
        });
      }
    } catch (error) {
      // Skip files that can't be processed
    }
  }
  
  return existingFiles;
}

/**
 * Extract variables from content (simplified version)
 * @param {string} content - File content
 * @returns {string[]}
 */
function extractVariablesFromContent(content) {
  const variables = new Set();
  
  // Nunjucks variables: {{ variable }}
  const matches = content.match(/\{\{\s*([^}\s|]+)/g);
  if (matches) {
    for (const match of matches) {
      const varName = match.replace(/\{\{\s*/, '');
      if (varName && !varName.includes('(') && !varName.includes('[')) {
        variables.add(varName);
      }
    }
  }
  
  return Array.from(variables).sort();
}

/**
 * Generate recommendations based on dry run results
 * @param {any[]} files - Dry run files
 * @param {any} summary - Summary data
 * @returns {string[]}
 */
function generateRecommendations(files, summary) {
  const recommendations = [];
  
  if (summary.existingFiles > 0) {
    recommendations.push(
      `⚠️  ${summary.existingFiles} files already exist. Use --force to overwrite them.`
    );
  }
  
  if (summary.warnings > 0) {
    recommendations.push(
      `⚠️  ${summary.warnings} files have warnings. Review the output above.`
    );
  }
  
  const injectFiles = files.filter(f => f.action === 'inject').length;
  if (injectFiles > 0) {
    recommendations.push(
      `ℹ️  ${injectFiles} files will have content injected rather than being overwritten.`
    );
  }
  
  const skipFiles = files.filter(f => f.action === 'skip').length;
  if (skipFiles > 0) {
    recommendations.push(
      `ℹ️  ${skipFiles} files will be skipped due to conditions in their frontmatter.`
    );
  }
  
  if (summary.totalSize > 1024 * 1024) { // > 1MB
    recommendations.push(
      `📁 Large output (${formatFileSize(summary.totalSize)}). Consider generating in smaller chunks.`
    );
  }
  
  if (recommendations.length === 0) {
    recommendations.push('✅ No issues detected. Ready to generate!');
  }
  
  return recommendations;
}

/**
 * Format dry run report as readable text
 * @param {any} report - Dry run report
 * @returns {string}
 */
function formatDryRunReport(report) {
  const lines = [];
  
  lines.push(`🔍 Dry Run: ${report.generator.name}/${report.generator.template}`);
  lines.push('');
  
  lines.push(`📁 Destination: ${report.destination.path}`);
  lines.push(`📊 Files to process: ${report.summary.totalFiles}`);
  lines.push(`💾 Total size: ${report.summary.totalSizeFormatted}`);
  lines.push('');
  
  // Summary by action
  lines.push('📋 Actions Summary:');
  for (const [action, count] of Object.entries(report.summary.actions)) {
    const emoji = getActionEmoji(action);
    lines.push(`  ${emoji} ${action}: ${count} files`);
  }
  lines.push('');
  
  // File list
  lines.push('📄 Files:');
  for (const file of report.preview.files) {
    const emoji = getActionEmoji(file.action);
    const warning = file.warning ? ` ⚠️ ${file.warning}` : '';
    const existing = file.exists ? ' (exists)' : '';
    lines.push(`  ${emoji} ${file.path} (${file.size})${existing}${warning}`);
  }
  lines.push('');
  
  // Conflicts
  if (report.conflicts.length > 0) {
    lines.push('⚠️  Conflicts:');
    for (const conflict of report.conflicts) {
      lines.push(`  - ${conflict.path} (${formatFileSize(conflict.size)}, modified ${conflict.modified})`);
    }
    lines.push('');
  }
  
  // Recommendations
  lines.push('💡 Recommendations:');
  for (const recommendation of report.recommendations) {
    lines.push(`  ${recommendation}`);
  }
  
  return lines.join('\n');
}

/**
 * Get emoji for file action
 * @param {string} action - Action type
 * @returns {string}
 */
function getActionEmoji(action) {
  switch (action) {
    case 'create': return '📝';
    case 'overwrite': return '🔄';
    case 'inject': return '💉';
    case 'skip': return '⏭️';
    default: return '📄';
  }
}